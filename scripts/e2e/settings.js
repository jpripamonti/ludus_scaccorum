// Browser end-to-end check of the Settings screen (js/ui/settings.js, css/settings.css) in real Chromium.
//
// Playwright is NOT a project dependency (the app has no runtime or dev dependencies) and this script is not
// part of `npm test`. Run it by hand:
//
//   python3 -m http.server 5010 &                      # serve the repo root
//   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/settings.js
//
// Environment (all optional):
//   LUDUS_URL             page to test               (default http://127.0.0.1:5010/)
//   LUDUS_E2E_ONLY        run only the scenarios whose name contains this text (e.g. "preview")
//   LUDUS_E2E_VIEWPORTS   comma list of WIDTHxHEIGHT to use in "layout" and "axe" instead of the seven defaults
//   LUDUS_CHROMIUM        chrome binary if Playwright cannot launch its own
//                         (falls back to /opt/pw-browsers/chromium-1194/chrome-linux/chrome)
//   LUDUS_E2E_SHOTS       directory for screenshots (none are saved when unset)
//   LUDUS_AXE             path to axe.min.js: turns on the axe scans of "layout" and "axe" (axe-core is not a
//                         project dependency; those scenarios run in a context that bypasses the CSP because
//                         axe is injected as a script, every other scenario enforces it)
//
// Scenarios (each in a fresh context with service workers blocked, CSP enforced):
//   persist    EVERY entry of Ludus.Settings.schema is changed through its control (tiles, switches, sliders by
//              keyboard, the clock presets and the custom seconds field), the value is read back from
//              Ludus.Settings, and after a reload every value is still there (and the controls show it).
//   applies    What a setting does to the page: the board theme attribute and the mini boards, the text size
//              (the root font size really grows), contrast, motion, the untimed clock on the real play screen,
//              the theme on the real board, the language.
//   preview    The live preview table: the numbers of docs/SCORING.md (50 cp -> 7.5, 150 cp -> 3.5 under the
//              defaults), every setting that must move the table moves it (best-move mode, tolerance, model,
//              strictness, lines, hints), and the table always says what Ludus.Scoring.assess says.
//   keyboard   Tab reaches every control with a visible ring, arrow keys move inside a radio group and change the
//              setting, Space flips a switch, arrow / Home / End move a slider, Enter on the section nav scrolls
//              and focuses the heading, Escape closes the reset-all dialog.
//   reset      Reset section (with a keyboard-reachable Undo that stays until used), reset all (confirm, cancel with Escape), the global reset, the "already
//              default" state.
//   reflow     320 px, text at 100 % and 130 %, es / en: no sideways scroll, no tile label broken inside a word, no check
//              badge over a label.
//   motion     No animation keeps running under prefers-reduced-motion or a11y.motion = reduce.
//   layout     Seven viewports x es / en: no horizontal scroll, nothing sticking out, 44x44 targets, no clipped
//              label, no overlapping controls, no repeated id, no raw key, every text at 4.5:1 (3:1 large) on the
//              colours it sits on, also with high contrast and the largest text; axe with LUDUS_AXE.
//   axe        (with LUDUS_AXE) no serious or critical violation in the default, judge, sound-off, high-contrast
//              and 130 % states, four viewports, both languages.
//
// Every scenario fails on any console error, uncaught page error or failed request. Exits 0 on success, 1 on the
// first failed scenario, 2 if Playwright is missing.

"use strict";

const common = require("./_settings-account-common.js");
const { assert, open, step, shot, settle, checkProblems, checkIssues, inspect, focusProbe, motionProbe, viewportsFromEnv, AXE_PATH, runScenarios } = common;

const settingsRow = (page, pathName) => page.locator(`[data-path="${pathName}"]`);
const valueOf = (page, pathName) => page.evaluate((p) => Ludus.Settings.get(p), pathName);
const allValues = (page) => page.evaluate(() => {
  const out = {};
  Ludus.Settings.schema.forEach((spec) => { out[spec.path] = Ludus.Settings.get(spec.path); });
  return out;
});
const openSettings = (browser, vp, options = {}) => open(browser, vp, Object.assign({ hash: "#/settings", screen: "settings" }, options));
const DESKTOP = { name: "desktop-1280", w: 1280, h: 800, touch: false };
const PHONE = { name: "phone-390", w: 390, h: 844, touch: true };

// A tile: the real click on its label (the radio inside covers it).
async function clickTile(page, pathName, value) {
  const tile = settingsRow(page, pathName).locator(`label.settings-tile[data-value="${value}"]`);
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
}

async function clickSwitch(page, pathName) {
  const label = settingsRow(page, pathName).locator("label.switch");
  await label.scrollIntoViewIfNeeded();
  await label.click();
}

// ---------- scenario: persist ----------

async function persistFlow(browser) {
  const ctx = await openSettings(browser, DESKTOP, { lang: "en", tag: "persist" });
  const { page } = ctx;
  const schema = await page.evaluate(() => JSON.parse(JSON.stringify(Ludus.Settings.schema)));
  const expected = {};
  for (const spec of schema) {
    // Rows that only exist while another setting allows them are switched on first.
    if (spec.path === "engine.movetimeMs") await clickTile(page, "engine.strength", "custom");
    if (spec.path === "sound.volume" && !(await valueOf(page, "sound.enabled"))) await clickSwitch(page, "sound.enabled");
    if (spec.path === "clock.seconds" && (await valueOf(page, "clock.mode")) !== "timed") await clickTile(page, "clock.mode", "timed");
    if (spec.path === "scoring.tolerancePct" && (await valueOf(page, "scoring.bestMode")) === "engine") await clickTile(page, "scoring.bestMode", "band");
    const row = settingsRow(page, spec.path);
    assert.ok(await row.isVisible(), `${spec.path}: its row is visible`);
    if (spec.type === "boolean") {
      const before = await valueOf(page, spec.path);
      await clickSwitch(page, spec.path);
      assert.strictEqual(await valueOf(page, spec.path), !before, `${spec.path} flips`);
      expected[spec.path] = !before;
    } else if (spec.type === "enum") {
      const target = spec.options.map((option) => option.value).filter((value) => value !== spec.default).pop();
      await clickTile(page, spec.path, target);
      assert.strictEqual(await valueOf(page, spec.path), target, `${spec.path} = ${target}`);
      expected[spec.path] = target;
    } else if (spec.path === "clock.seconds") {
      await clickTile(page, spec.path, 180);
      assert.strictEqual(await valueOf(page, spec.path), 180);
      const field = row.locator(".settings-seconds-input");
      await field.fill("45");
      assert.strictEqual(await valueOf(page, spec.path), 45, "a custom number of seconds is applied while typing");
      expected[spec.path] = 45;
    } else {
      const slider = row.locator("input[type=\"range\"]");
      await slider.scrollIntoViewIfNeeded();
      await slider.focus();
      await page.keyboard.press("End");
      const max = await valueOf(page, spec.path);
      assert.strictEqual(max, spec.max, `${spec.path}: End gives the maximum`);
      await page.keyboard.press("Home");
      assert.strictEqual(await valueOf(page, spec.path), spec.min, `${spec.path}: Home gives the minimum`);
      await page.keyboard.press("End");
      await page.keyboard.press("ArrowLeft");
      const stepped = await valueOf(page, spec.path);
      assert.ok(stepped < spec.max && stepped >= spec.min, `${spec.path}: an arrow key moves one step (${stepped})`);
      expected[spec.path] = stepped;
      assert.strictEqual(await slider.getAttribute("aria-valuetext") !== null, true, `${spec.path}: a spoken value`);
    }
  }
  // The prerequisites were switched on for the rows that depend on them: what counts is what is set now.
  for (const pathName of ["sound.enabled", "clock.mode", "engine.strength", "scoring.bestMode"]) expected[pathName] = await valueOf(page, pathName);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("ludus.settings.v2")));
  assert.strictEqual(stored.v, 2);
  Object.keys(expected).forEach((pathName) => assert.deepStrictEqual(stored.values[pathName], expected[pathName], `${pathName} is in storage`));
  step(`${schema.length} settings changed through their controls and stored`);
  await shot(page, "persist-changed", { fullPage: true });

  await page.reload();
  await page.waitForFunction(() => window.Ludus && Ludus.router.current() === "settings");
  const after = await allValues(page);
  Object.keys(expected).forEach((pathName) => assert.deepStrictEqual(after[pathName], expected[pathName], `${pathName} survives a reload`));
  // ...and the controls show it
  for (const spec of schema) {
    const row = settingsRow(page, spec.path);
    if (!(await row.isVisible())) continue;
    if (spec.type === "boolean") {
      assert.strictEqual(await row.locator("input[role=\"switch\"]").isChecked(), expected[spec.path], `${spec.path}: the switch shows the stored value`);
    } else if (spec.type === "enum" && spec.path !== "clock.seconds") {
      const checked = await row.locator(`label.settings-tile[data-value="${expected[spec.path]}"] input`).isChecked();
      assert.ok(checked, `${spec.path}: the tile of the stored value is checked`);
    } else if (spec.path !== "clock.seconds") {
      assert.strictEqual(Number(await row.locator("input[type=\"range\"]").inputValue()), expected[spec.path], `${spec.path}: the slider shows the stored value`);
    }
  }
  step("after a reload every value is still there and every control shows it");
  checkProblems("persist", ctx.problems);
  await ctx.context.close();
}

// ---------- scenario: applies ----------

async function appliesFlow(browser) {
  const ctx = await openSettings(browser, DESKTOP, { lang: "en", tag: "applies" });
  const { page } = ctx;
  const html = page.locator("html");
  // themes: the page, every mini board and the preview follow
  for (const theme of ["classic", "ocean", "forest", "slate", "contrast", "walnut"]) {
    await clickTile(page, "board.theme", theme);
    assert.strictEqual(await html.getAttribute("data-board-theme"), theme);
    assert.strictEqual(await page.locator(".settings-preview-board svg.mini-board").getAttribute("data-board-theme"), theme);
    assert.strictEqual(await page.locator(".settings-chip[data-chip=\"board\"]").count(), 1);
  }
  const light = (theme) => page.evaluate((name) => {
    const probe = document.createElement("div");
    probe.setAttribute("data-board-theme", name);
    probe.style.background = "var(--board-light)";
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, theme);
  assert.notStrictEqual(await light("walnut"), await light("ocean"), "the themes really are different colours");
  step("six themes: attribute, mini boards and preview follow");

  // text size: the root font size grows with the setting
  const rootSize = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  const base = await rootSize();
  await clickTile(page, "a11y.textScale", 1.3);
  const large = await rootSize();
  assert.ok(Math.abs(large / base - 1.3) < 0.02, `the text grows by 30 % (${base} -> ${large})`);
  await clickTile(page, "a11y.textScale", 1.15);
  assert.ok(Math.abs((await rootSize()) / base - 1.15) < 0.02);
  await clickTile(page, "a11y.textScale", 1);
  assert.strictEqual(await rootSize(), base);
  await clickTile(page, "a11y.contrast", "high");
  assert.strictEqual(await html.getAttribute("data-contrast"), "high");
  const borderNormal = await page.evaluate(() => { document.documentElement.dataset.contrast = "normal"; const c = getComputedStyle(document.documentElement).getPropertyValue("--color-border").trim(); document.documentElement.dataset.contrast = "high"; return c; });
  const borderHigh = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-border").trim());
  assert.notStrictEqual(borderNormal, borderHigh, "high contrast changes the tokens");
  await clickTile(page, "a11y.contrast", "normal");
  await clickTile(page, "a11y.motion", "reduce");
  assert.strictEqual(await html.getAttribute("data-motion"), "reduce");
  await clickTile(page, "a11y.motion", "auto");
  step("text size, contrast and motion apply to the page at once");

  // untimed clock on the real play screen, the theme on the real board
  // (the very first session of a profile is untimed whatever Settings say, so the first-run flag is set: this checks the setting)
  await page.evaluate(() => Ludus.storage.set("ludus.firstRun.v1", 1));
  await clickTile(page, "clock.mode", "untimed");
  await clickTile(page, "board.theme", "ocean");
  await page.evaluate(async () => {
    await Ludus.Classics.load();
    const game = Ludus.Classics.list()[0];
    await Ludus.game.startSession({ kind: "classic", title: game.title.en, mode: "solo", positions: Ludus.Classics.positions(game.id, { count: 2 }) });
  });
  await page.waitForFunction(() => document.querySelector("#game-layout") && !document.querySelector("#game-layout").classList.contains("hidden"));
  const rail = page.locator("#solo-clock-rail");
  assert.ok((await rail.getAttribute("class")).includes("is-untimed"), "the play clock is untimed");
  assert.match(await rail.getAttribute("aria-label"), /No time limit/, "and it says so to a screen reader");
  const squareColor = await page.locator("#board .square.light").first().evaluate((el) => getComputedStyle(el).backgroundColor);
  assert.strictEqual(squareColor, await light("ocean"), "the real board wears the chosen theme");
  step("the untimed clock and the theme reach the real play screen");
  await page.evaluate(() => Ludus.game.abort());
  await page.waitForFunction(() => Ludus.router.current() === "home");
  await page.evaluate(() => Ludus.router.show("settings"));
  await clickTile(page, "clock.mode", "timed");
  await clickTile(page, "clock.seconds", 60);
  await page.evaluate(async () => {
    await Ludus.Classics.load();
    const game = Ludus.Classics.list()[0];
    await Ludus.game.startSession({ kind: "classic", title: game.title.en, mode: "solo", positions: Ludus.Classics.positions(game.id, { count: 2 }) });
  });
  await page.waitForFunction(() => document.querySelector("#game-layout") && !document.querySelector("#game-layout").classList.contains("hidden"));
  assert.ok(!(await rail.getAttribute("class")).includes("is-untimed"));
  assert.match(await page.locator("#solo-clock-value").innerText(), /^(01:0\d|00:5\d)$/, "a timed session starts at one minute");
  await page.evaluate(() => Ludus.game.abort());

  // language: the screen redraws in Spanish and back, values kept
  await page.evaluate(() => Ludus.router.show("settings"));
  await clickTile(page, "scoring.strictness", "strict");
  await page.evaluate(() => Ludus.i18n.setLanguage("es"));
  assert.match(await page.locator("#screen-settings h1").innerText(), /Ajustes/);
  assert.ok(await settingsRow(page, "scoring.strictness").locator("label[data-value=\"strict\"] input").isChecked());
  assert.match(await page.title(), /Ajustes/, "document.title follows the language");
  await page.evaluate(() => Ludus.i18n.setLanguage("en"));
  assert.match(await page.locator("#screen-settings h1").innerText(), /Settings/);
  step("the language switch redraws the screen and keeps the values");
  checkProblems("applies", ctx.problems);
  await ctx.context.close();
}

// ---------- scenario: preview ----------

const previewPoints = (page, id) => page.locator(`tr[data-case="${id}"] .settings-points`).getAttribute("data-points").then(Number);
const previewText = (page, id) => page.locator(`tr[data-case="${id}"]`).innerText();

async function previewFlow(browser) {
  const ctx = await openSettings(browser, DESKTOP, { lang: "en", tag: "preview" });
  const { page } = ctx;
  await page.locator("table.settings-table").scrollIntoViewIfNeeded();
  // the defaults reproduce docs/SCORING.md, Table 1 (50 cp at +0.30 = 7.5, 150 cp = 3.5)
  assert.strictEqual(await previewPoints(page, "best"), 10);
  assert.strictEqual(await previewPoints(page, "inaccuracy"), 7.5);
  assert.strictEqual(await previewPoints(page, "mistake"), 3.5);
  assert.ok((await previewPoints(page, "blunder")) <= 1);
  assert.match(await previewText(page, "only"), /Great/);
  assert.strictEqual(await previewPoints(page, "equal"), 10, "an equivalent move counts");
  assert.match(await previewText(page, "equal"), /Counts as the best/);
  assert.strictEqual(await page.locator("table.settings-table tbody tr").count(), 10);
  step("defaults: the numbers of docs/SCORING.md");

  await clickTile(page, "scoring.bestMode", "engine");
  assert.ok((await previewPoints(page, "equal")) < 10, "engine only: an equivalent move is no longer worth 10");
  assert.ok(!(await previewText(page, "equal")).includes("Counts as the best"));
  assert.strictEqual(await settingsRow(page, "scoring.tolerancePct").isVisible(), false, "no tolerance when only the engine counts");
  await clickTile(page, "scoring.bestMode", "masters");
  assert.ok((await previewPoints(page, "master")) >= 9.7, "the master's move is worth full marks within 3 %");
  await clickTile(page, "scoring.bestMode", "band");
  const tolerance = settingsRow(page, "scoring.tolerancePct").locator("input[type=\"range\"]");
  await tolerance.focus();
  await page.keyboard.press("End");
  assert.strictEqual(await previewPoints(page, "close"), 10, "with 5 % tolerance a 20 cp slip is still the best");
  assert.match(await page.locator(".settings-rule").innerText(), /less than 5\s?%/);
  await page.keyboard.press("Home");
  assert.ok((await previewPoints(page, "close")) < 10);
  step("best-move mode and tolerance move the table");

  await clickTile(page, "scoring.strictness", "strict");
  const strict = await previewPoints(page, "mistake");
  await clickTile(page, "scoring.strictness", "relaxed");
  const relaxed = await previewPoints(page, "mistake");
  assert.ok(strict < 3.5 && relaxed > 3.5, `strict ${strict} < 3.5 < relaxed ${relaxed}`);
  await clickTile(page, "scoring.strictness", "standard");
  await clickTile(page, "scoring.model", "tiers");
  for (const id of ["best", "equal", "close", "master", "inaccuracy", "mistake", "blunder", "mate"]) {
    assert.ok([0, 2.5, 5, 7.5, 10].includes(await previewPoints(page, id)), `tiers: ${id} is a fixed number of points`);
  }
  await clickTile(page, "scoring.model", "precision");
  step("strictness and model move the table");

  const lines = settingsRow(page, "engine.multiPv").locator("input[type=\"range\"]");
  await lines.focus();
  await page.keyboard.press("Home");
  assert.doesNotMatch(await previewText(page, "only"), /Great/, "with one line only moves are not recognised");
  await page.keyboard.press("ArrowRight");
  assert.match(await previewText(page, "only"), /Great/);
  await clickSwitch(page, "hints.enabled");
  assert.strictEqual(await page.locator("tr[data-case=\"hint\"]").count(), 0);
  await clickSwitch(page, "hints.enabled");
  assert.ok(Math.abs((await previewPoints(page, "hint")) - 8.5) < 0.05);
  step("lines and hints move the table");

  // the table always says what Scoring.assess says (model = the screen's own helper, checked against Scoring)
  const mismatches = await page.evaluate(() => {
    const out = [];
    const rows = Ludus.Screens.settings.helpers.previewRows({ scoring: Ludus.Settings.scoringSettings(), multiPv: Ludus.Settings.get("engine.multiPv"), hintsEnabled: Ludus.Settings.get("hints.enabled") }, Ludus.i18n.lang());
    rows.forEach((row) => {
      const cell = document.querySelector(`tr[data-case="${row.id}"] .settings-points`);
      if (!cell || Number(cell.getAttribute("data-points")) !== row.points) out.push(row.id);
    });
    return out;
  });
  assert.deepStrictEqual(mismatches, [], "the table equals the model");
  await shot(page, "preview-table", { fullPage: false });
  // the same rows in the pure scorer, independent of the screen
  const direct = await page.evaluate(() => {
    const s = Ludus.Settings.scoringSettings();
    const mk = (uci, score) => ({ uci, san: uci, score, pv: [uci] });
    const lines = [mk("e2e4", 30), mk("d2d4", 24), mk("g1f3", 12)];
    const a = Ludus.Scoring.assess({ lines, userUci: "b1c3", userScore: -20, settings: s, hintsUsed: 0 }, { isSacrifice: false });
    return a.points;
  });
  assert.strictEqual(await previewPoints(page, "inaccuracy"), direct);
  step("the table equals Ludus.Scoring.assess");
  checkProblems("preview", ctx.problems);
  await ctx.context.close();
}

// ---------- scenario: keyboard ----------

async function keyboardFlow(browser) {
  const ctx = await openSettings(browser, DESKTOP, { lang: "en", tag: "keyboard" });
  const { page } = ctx;
  // Tab through the whole screen: every stop shows a ring, none is lost.
  const stops = await focusProbe(page, 120, "#screen-settings");
  const inside = stops.filter((stop) => !stop.outside);
  assert.ok(inside.length > 40, `many stops inside the screen (${inside.length})`);
  const noRing = inside.filter((stop) => !stop.visibleRing || !stop.focusVisible);
  assert.deepStrictEqual(noRing.map((stop) => stop.name), [], "every tab stop shows a focus ring");
  step(`${inside.length} tab stops, every one with a visible ring`);

  // a radio group: one stop, arrows move and apply
  await page.locator("[data-path=\"scoring.strictness\"] label[data-value=\"standard\"] input").focus();
  await page.keyboard.press("ArrowRight");
  assert.strictEqual(await valueOf(page, "scoring.strictness"), "strict");
  await page.keyboard.press("ArrowLeft");
  assert.strictEqual(await valueOf(page, "scoring.strictness"), "standard");
  await page.keyboard.press("ArrowLeft");
  assert.strictEqual(await valueOf(page, "scoring.strictness"), "relaxed");
  // a switch: Space
  await page.locator("[data-path=\"board.coords\"] input").focus();
  await page.keyboard.press("Space");
  assert.strictEqual(await valueOf(page, "board.coords"), false);
  await page.keyboard.press("Space");
  assert.strictEqual(await valueOf(page, "board.coords"), true);
  // a slider: arrows, Home, End, PageUp
  await page.locator("[data-path=\"engine.multiPv\"] input[type=\"range\"]").focus();
  await page.keyboard.press("ArrowRight");
  assert.strictEqual(await valueOf(page, "engine.multiPv"), 4);
  await page.keyboard.press("End");
  assert.strictEqual(await valueOf(page, "engine.multiPv"), 5);
  await page.keyboard.press("Home");
  assert.strictEqual(await valueOf(page, "engine.multiPv"), 1);
  // the custom seconds field commits complete numbers only
  const seconds = page.locator("[data-path=\"clock.seconds\"] .settings-seconds-input");
  await seconds.focus();
  await seconds.fill("");
  await page.keyboard.type("1");
  assert.notStrictEqual(await valueOf(page, "clock.seconds"), 5, "a half-typed number is not clamped under the fingers");
  assert.ok(await page.locator("[data-path=\"clock.seconds\"] .settings-error").isVisible());
  await page.keyboard.type("20");
  assert.strictEqual(await valueOf(page, "clock.seconds"), 120);
  assert.ok(!(await page.locator("[data-path=\"clock.seconds\"] .settings-error").isVisible()));
  step("radio groups, switches, sliders and the seconds field work from the keyboard");

  // the section nav: Enter scrolls and focuses the heading
  await page.locator("button[data-nav=\"sound\"]").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.textContent.trim()), "Sound and vibration");
  const top = await page.locator("section[data-section=\"sound\"]").evaluate((el) => el.getBoundingClientRect().top);
  assert.ok(top < 400 && top > -50, `the section is in view (${Math.round(top)})`);
  // reset all: Escape cancels, focus returns to the button
  await page.locator("#settings-reset-all").focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector(".modal");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".modal", { state: "detached" });
  assert.strictEqual(await valueOf(page, "scoring.strictness"), "relaxed", "cancelled");
  assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.id), "settings-reset-all", "focus is back on the button");
  step("the section nav and the reset-all dialog work from the keyboard");
  checkProblems("keyboard", ctx.problems);
  await ctx.context.close();
}

// ---------- scenario: reset ----------

async function resetFlow(browser) {
  const ctx = await openSettings(browser, DESKTOP, { lang: "en", tag: "reset" });
  const { page } = ctx;
  const resetBtn = (section) => page.locator(`section[data-section="${section}"] .settings-reset`);
  assert.strictEqual(await resetBtn("board").getAttribute("aria-disabled"), "true", "already at the defaults");
  await clickTile(page, "board.theme", "forest");
  await clickTile(page, "board.animation", "off");
  await clickTile(page, "scoring.model", "tiers");
  assert.strictEqual(await resetBtn("board").getAttribute("aria-disabled"), null);
  await resetBtn("board").click();
  assert.strictEqual(await valueOf(page, "board.theme"), "walnut");
  assert.strictEqual(await valueOf(page, "board.animation"), "auto");
  assert.strictEqual(await valueOf(page, "scoring.model"), "tiers", "the other section is untouched");
  // QA A11Y-005: the Undo is a notice under the section heading (no timed toast): it is the very next Tab stop after Reset, it is still there
  // long after the old five seconds, and using it or closing it gives the focus back to Reset.
  const notice = page.locator('section[data-section="board"] .settings-undo');
  await notice.waitFor();
  assert.strictEqual(await page.locator(".toast").count(), 0, "no toast");
  assert.match(await notice.innerText(), /back to its original values/);
  await page.keyboard.press("Tab");
  assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("data-action")), "undo", "Undo is the next Tab stop");
  await settle(page, 6500);
  assert.strictEqual(await notice.count(), 1, "still there after the old toast would be gone");
  await page.keyboard.press("Enter");
  assert.strictEqual(await valueOf(page, "board.theme"), "forest", "Undo brings the values back");
  assert.strictEqual(await valueOf(page, "board.animation"), "off");
  assert.strictEqual(await notice.count(), 0, "using it closes the notice");
  assert.ok(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("settings-reset")), "focus is back on Reset");
  step("reset section with a keyboard-reachable, persistent undo");
  await resetBtn("board").click();
  await settle(page, 200);
  await page.locator("#settings-reset-all").click();
  await page.waitForSelector(".modal");
  assert.match(await page.locator(".modal-title").innerText(), /Reset all settings\?/);
  await page.locator(".modal .btn-secondary").click();
  await page.waitForSelector(".modal", { state: "detached" });
  assert.strictEqual(await valueOf(page, "scoring.model"), "tiers", "cancel keeps everything");
  await page.locator("#settings-reset-all").click();
  await page.locator(".modal .btn-danger").click();
  await page.waitForSelector(".modal", { state: "detached" });
  const values = await allValues(page);
  const defaults = await page.evaluate(() => Object.fromEntries(Ludus.Settings.schema.map((spec) => [spec.path, spec.default])));
  assert.deepStrictEqual(values, defaults, "everything is back to the defaults");
  assert.strictEqual(await page.locator("html").getAttribute("data-board-theme"), "walnut");
  step("reset all asks first, cancels, and restores every default");
  checkProblems("reset", ctx.problems);
  await ctx.context.close();
}

// ---------- scenario: motion ----------

async function motionFlow(browser) {
  for (const mode of ["system", "setting"]) {
    const ctx = await openSettings(browser, DESKTOP, { lang: "en", tag: `motion-${mode}`, reducedMotion: mode === "system" });
    const { page } = ctx;
    if (mode === "setting") await clickTile(page, "a11y.motion", "reduce");
    await page.waitForTimeout(700); // the entrance of the screen
    await clickTile(page, "scoring.strictness", "strict"); // the preview row flash
    await clickTile(page, "board.theme", "ocean");
    await page.waitForTimeout(80);
    const running = await motionProbe(page, "#screen-settings");
    assert.deepStrictEqual(running, [], `${mode}: nothing keeps moving inside the screen`);
    checkProblems(`motion-${mode}`, ctx.problems);
    await ctx.context.close();
  }
  // with motion allowed the changed row does flash (the animation is the hint, not decoration)
  const ctx = await openSettings(browser, DESKTOP, { lang: "en", tag: "motion-normal" });
  await clickTile(ctx.page, "scoring.strictness", "strict");
  const flashing = await ctx.page.evaluate(() => document.querySelectorAll("tr.settings-case.is-changed").length);
  assert.ok(flashing > 0, "rows whose points changed are marked");
  await ctx.context.close();
}

// ---------- scenario: layout ----------

async function layoutFlow(browser, axeMode) {
  for (const vp of viewportsFromEnv()) {
    for (const lang of ["es", "en"]) {
      const ctx = await openSettings(browser, vp, { lang, tag: `${vp.name}-${lang}`, bypassCSP: axeMode });
      const { page } = ctx;
      await settle(page, 600);
      await inspect(ctx, "default", "#screen-settings", { axe: axeMode, fullPage: true });
      // each section scrolled into view: the layout of a section does not depend on the scroll position
      for (const id of ["board", "judge", "play", "sound", "access"]) {
        await page.locator(`button[data-nav="${id}"]`).click();
        await settle(page, 500);
      }
      // the stress states: high contrast and the largest text (also hides nothing: the probes see every row)
      await page.evaluate(() => { Ludus.Settings.set("a11y.contrast", "high"); Ludus.Settings.set("a11y.textScale", 1.3); });
      await settle(page, 400);
      await inspect(ctx, "high-contrast-130", "#screen-settings", { axe: axeMode, fullPage: true });
      await page.evaluate(() => { Ludus.Settings.reset(); });
      // the custom rows too: every row visible at once
      await page.evaluate(() => { Ludus.Settings.set("engine.strength", "custom"); Ludus.Settings.set("scoring.bestMode", "masters"); });
      await settle(page, 300);
      await inspect(ctx, "all-rows", "#screen-settings", { axe: false });
      checkIssues(ctx.tag, ctx.issues);
      checkProblems(ctx.tag, ctx.problems);
      await ctx.context.close();
    }
    step(`${vp.name} (es + en): no findings`);
  }
}

// ---------- scenario: axe ----------

async function axeFlow(browser) {
  const views = [DESKTOP, { name: "tablet-768", w: 768, h: 1024, touch: true }, PHONE, { name: "phone-360", w: 360, h: 740, touch: true }];
  for (const vp of views) {
    for (const lang of ["es", "en"]) {
      const ctx = await openSettings(browser, vp, { lang, tag: `axe-${vp.name}-${lang}`, bypassCSP: true });
      const { page } = ctx;
      await settle(page, 500);
      const states = [
        ["default", async () => {}],
        ["judge-custom", async () => { await page.evaluate(() => { Ludus.Settings.set("engine.strength", "custom"); Ludus.Settings.set("scoring.model", "tiers"); }); }],
        ["sound-off", async () => { await page.evaluate(() => { Ludus.Settings.reset(); Ludus.Settings.set("sound.enabled", false); Ludus.Settings.set("clock.mode", "untimed"); }); }],
        ["high-contrast", async () => { await page.evaluate(() => { Ludus.Settings.reset(); Ludus.Settings.set("a11y.contrast", "high"); }); }],
        ["text-130", async () => { await page.evaluate(() => { Ludus.Settings.reset(); Ludus.Settings.set("a11y.textScale", 1.3); Ludus.Settings.set("a11y.motion", "reduce"); }); }],
      ];
      for (const [label, apply] of states) {
        await apply();
        await settle(page, 350);
        await common.axeScan(ctx, label, { scope: "#screen-settings" });
      }
      checkIssues(ctx.tag, ctx.issues);
      await ctx.context.close();
    }
    step(`${vp.name} (es + en): no serious or critical axe violation in five states`);
  }
}

// ---------- scenario: reflow ----------

// QA A11Y-006 / VIS-007 / VIS-011: on a 320 px phone, also with the text at 130 %, the page does not scroll sideways (the preview table used to
// reach 357 px), no tile label breaks inside a word ("Desactivad / a") and the selected tile's check badge never covers its label.
async function reflowFlow(browser) {
  for (const lang of ["es", "en"]) {
    for (const scale of [1, 1.3]) {
      const ctx = await openSettings(browser, { name: "phone-320", w: 320, h: 568, touch: true }, { lang, tag: `reflow-${lang}-${scale}` });
      const { page } = ctx;
      if (scale !== 1) await page.evaluate((value) => Ludus.Settings.set("a11y.textScale", value), scale);
      await settle(page, 400);
      const label = `${lang} x${scale}`;
      const wide = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
      assert.ok(wide.scrollWidth <= wide.clientWidth, `${label}: the settings page scrolls sideways (${wide.scrollWidth} > ${wide.clientWidth})`);
      const bad = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll(".settings-tile").forEach((tile) => {
          const text = tile.querySelector(".settings-tile-label");
          const check = tile.querySelector(".settings-tile-check");
          if (!text || tile.getBoundingClientRect().width === 0) return;
          const range = document.createRange();
          range.selectNodeContents(text);
          const rects = Array.from(range.getClientRects());
          const words = text.textContent.trim().split(/\s+/).length;
          if (rects.length > words) out.push(`${text.textContent.trim()}: a word is broken over lines`);
          if (check && getComputedStyle(check).opacity !== "0") {
            const box = check.getBoundingClientRect();
            if (rects.some((r) => r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top)) out.push(`${text.textContent.trim()}: the check covers the label`);
          }
        });
        return out;
      });
      assert.deepStrictEqual(bad, [], `${label}: tile labels`);
      await ctx.context.close();
    }
  }
  step("320 px, text at 100 % and 130 %: no sideways scroll, no broken tile label, no badge over a label (es + en)");
}

const scenarios = [
  ["persist", persistFlow],
  ["applies", appliesFlow],
  ["preview", previewFlow],
  ["keyboard", keyboardFlow],
  ["reset", resetFlow],
  ["reflow", reflowFlow],
  ["motion", motionFlow],
  ["layout", (browser) => layoutFlow(browser, Boolean(AXE_PATH))],
];
if (AXE_PATH) scenarios.push(["axe", axeFlow]);

runScenarios("settings e2e", scenarios);
