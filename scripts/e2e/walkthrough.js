// Cross-screen user journey in real Chromium: what one person does in their first session, from the landing page to the
// reading room, on a brand-new profile, at desktop and phone size, in Spanish and English (four journeys).
//
// Playwright is NOT a project dependency (the app has no runtime or dev dependencies) and this script is not part of
// `npm test`. Run it by hand:
//
//   python3 -m http.server 5010 &                      # serve the repo root
//   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/walkthrough.js
//
// Environment (all optional):
//   LUDUS_URL             page to test               (default http://127.0.0.1:5010/)
//   LUDUS_E2E_ONLY        run only the journeys whose name contains this text (e.g. "desktop-es", "phone", "-en")
//   LUDUS_CHROMIUM        chrome binary if Playwright cannot launch its own
//                         (falls back to /opt/pw-browsers/chromium-1194/chrome-linux/chrome)
//   LUDUS_E2E_SHOTS       directory for screenshots (none are saved when unset); one picture per stage, named
//                         <viewport>-<lang>-<NN>-<stage>.png, plus "-full" pictures of the long screens
//   LUDUS_AXE             path to axe.min.js: every stage is also scanned (serious / critical violations fail). axe is
//                         injected as an inline script, so with this variable the contexts bypass the CSP.
//
// The journey (each step asserts what it says; every stage also checks no horizontal scroll, no repeated id, no raw
// i18n key or "undefined / NaN" on screen, and that document.title follows the screen):
//   1  landing            a first visit; the language follows the browser
//   2  home               the start button, the hub
//   3  classics           the gallery of 28 games
//   4  a game             open "The Opera Game", replay a few moves, a training position shows its cue; "Try this
//                         position" starts a one-position session and leaving it asks for confirmation
//   5  training           2 positions: the best move by DRAG (mouse on desktop, touch on the phone), then the worst
//                         legal move by CLICK; the coach panel of each result; the summary
//   6  notebook           the wrong move made a card; reviewing it is graded by the recorded round
//   7  progress           the numbers, the heatmap and the charts show the new data
//   8  settings           board theme + untimed clock; the next session wears both
//   9  account            a second profile; the duel setup names both; a duel of 2 classic positions between the two
//                         profiles is played and each profile records its own rounds
//   10 museum             the reading room
// At the end: no console errors, no uncaught page errors, no failed requests, no HTTP status >= 400.
//
// Exits 0 on success, 1 on the first failed assertion, 2 if Playwright is missing.

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright is not installed. Run with NODE_PATH=/opt/node22/lib/node_modules (see the header of this file).");
  process.exit(2);
}

const BASE_URL = process.env.LUDUS_URL || "http://127.0.0.1:5010/";
const FALLBACK_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SHOT_DIR = process.env.LUDUS_E2E_SHOTS || "";
const AXE_PATH = process.env.LUDUS_AXE || "";
const ONLY = process.env.LUDUS_E2E_ONLY || "";
const RESULT_TIMEOUT_MS = 60000;
const GAME = "opera-1858"; // 6 training positions, 3 hand-written moments
const VIEWPORTS = [
  { name: "desktop", w: 1280, h: 800, mobile: false },
  { name: "phone", w: 390, h: 844, mobile: true },
];
const LANGS = [
  { lang: "es", locale: "es-AR" },
  { lang: "en", locale: "en-US" },
];

// ---------- helpers ----------

async function launchBrowser() {
  const args = ["--no-sandbox"];
  try {
    return await chromium.launch({ args });
  } catch (firstError) {
    const explicit = process.env.LUDUS_CHROMIUM || FALLBACK_CHROMIUM;
    if (!fs.existsSync(explicit)) throw firstError;
    return chromium.launch({ executablePath: explicit, args });
  }
}

let axeSource = null;

// One journey = one browser context = one fresh profile. `stage()` is the only place that asserts the things every screen
// must satisfy, so a screen that breaks one of them is named by its stage.
async function openJourney(browser, vp, lang) {
  const tag = `${vp.name}-${lang.lang}`;
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    locale: lang.locale,
    serviceWorkers: "block", // the service worker is cache-first and would serve stale files
    bypassCSP: Boolean(AXE_PATH),
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: vp.mobile ? 2 : 1,
  });
  const page = await context.newPage();
  const problems = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => problems.push(`requestfailed: ${request.url()} (${request.failure() && request.failure().errorText})`));
  page.on("response", (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  const cdp = vp.mobile ? await context.newCDPSession(page) : null;
  const journey = { tag, vp, lang: lang.lang, context, page, cdp, problems, titles: [], shots: 0, findings: [] };
  return journey;
}

function say(journey, message) {
  console.log(`  - ${message}`);
}

async function shot(journey, name, options = {}) {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  journey.shots += 1;
  const nn = String(journey.shots).padStart(2, "0");
  await journey.page.screenshot({ path: path.join(SHOT_DIR, `${journey.tag}-${nn}-${name}${options.full ? "-full" : ""}.png`), fullPage: Boolean(options.full) });
}

// What every screen has to satisfy, whatever its content.
function pageFacts() {
  const root = document.documentElement;
  const seen = {};
  const duplicated = [];
  document.querySelectorAll("[id]").forEach((el) => {
    seen[el.id] = (seen[el.id] || 0) + 1;
    if (seen[el.id] === 2) duplicated.push(el.id);
  });
  // Text a person can read right now: every element that is displayed, minus scripts and styles.
  const visible = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const el = node.parentElement;
    const text = node.nodeValue.replace(/\s+/g, " ").trim();
    if (el && text && !/^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)) {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0) visible.push(text);
    }
    node = walker.nextNode();
  }
  // The tab title is read too: the router builds it from the shared dictionary, and a screen whose key is not in it shows the key.
  const text = `${visible.join(" | ")} | ${document.title}`;
  const rawKeys = text.match(/\b(?:home|classics|museum|notebook|progress|settings|account|shell|play|coach|game|core|wizard|meta|cdata|facts|insight|reader|kit|duel|ld|bd|score|common|provider|buttons|labels|result|evaluation|analysis)\.[a-zA-Z][\w-]*(?:\.[\w-]+)*/g) || [];
  const broken = text.match(/\b(?:undefined|NaN|Infinity|\[object Object\])\b/g) || [];
  return {
    scrollWidth: root.scrollWidth,
    clientWidth: root.clientWidth,
    duplicated,
    rawKeys: Array.from(new Set(rawKeys)),
    broken: Array.from(new Set(broken)),
    title: document.title,
    lang: document.documentElement.lang,
    screen: document.body.dataset.screen || "",
    router: window.Ludus && Ludus.router ? Ludus.router.current() : "",
    mains: Array.from(document.querySelectorAll('main, [role="main"]')).filter((el) => {
      const rect = el.getBoundingClientRect();
      return getComputedStyle(el).display !== "none" && rect.width > 0 && rect.height > 0 && !el.closest("[hidden], [inert]");
    }).length,
    h1: Array.from(document.querySelectorAll("h1")).filter((el) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== "none").length,
  };
}

async function axeScan(journey, label, scope) {
  if (!AXE_PATH) return;
  const { page } = journey;
  if (axeSource === null) axeSource = fs.readFileSync(AXE_PATH, "utf8");
  if (!(await page.evaluate(() => typeof window.axe !== "undefined"))) await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async (selector) => {
    const target = selector ? document.querySelector(selector) || document : document;
    const run = await window.axe.run(target, { resultTypes: ["violations"] });
    return run.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
  }, scope || "");
  violations.forEach((v) => {
    const line = `${journey.tag} ${label}: axe ${v.impact} ${v.id} (${v.help}) at ${v.nodes.join(" | ")}`;
    if (v.impact === "serious" || v.impact === "critical") journey.findings.push(line);
    else console.log(`    (${line})`);
  });
}

// Asserts the invariants of a stage and takes its picture. `expect.screen` is the router id the stage must be on.
async function stage(journey, name, expect = {}) {
  const { page } = journey;
  await page.waitForTimeout(expect.settle === undefined ? 450 : expect.settle);
  const facts = await page.evaluate(pageFacts);
  const label = `${journey.tag} / ${name}`;
  assert.ok(facts.scrollWidth <= facts.clientWidth, `${label}: the page scrolls sideways (${facts.scrollWidth}px > ${facts.clientWidth}px)`);
  assert.deepStrictEqual(facts.duplicated, [], `${label}: repeated ids`);
  assert.deepStrictEqual(facts.rawKeys, [], `${label}: raw i18n keys on screen`);
  assert.deepStrictEqual(facts.broken, [], `${label}: broken values on screen`);
  assert.strictEqual(facts.lang, journey.lang, `${label}: <html lang> follows the language`);
  assert.ok(facts.title && facts.title.trim().length > 2, `${label}: the page has a title`);
  if (expect.screen) {
    assert.strictEqual(facts.router, expect.screen, `${label}: the router is on ${expect.screen}`);
    assert.strictEqual(facts.screen, expect.screen, `${label}: body[data-screen] is ${expect.screen}`);
  }
  if (!expect.dialog) assert.strictEqual(facts.mains, 1, `${label}: exactly one main landmark is exposed (${facts.mains})`);
  journey.titles.push({ stage: name, screen: facts.router, title: facts.title });
  await shot(journey, name);
  if (expect.full) await shot(journey, name, { full: true });
  await axeScan(journey, name, expect.axeScope);
  return facts;
}

// The title of a screen is the one its module names; it must change when the screen does.
async function checkTitle(journey, screenId, previousScreen) {
  const info = await journey.page.evaluate((id) => {
    const screen = Ludus.Screens && Ludus.Screens[id];
    const key = screen && screen.titleKey;
    return { title: document.title, key: key || null, text: key ? Ludus.i18n.t(key) : null };
  }, screenId);
  if (info.key) assert.ok(info.title.includes(info.text), `${journey.tag}: the title on ${screenId} is "${info.title}", expected to contain "${info.text}" (${info.key})`);
  const before = journey.titles.filter((entry) => entry.screen === previousScreen).pop();
  if (before && previousScreen !== screenId) assert.notStrictEqual(info.title, before.title, `${journey.tag}: the title did not change from ${previousScreen} to ${screenId}`);
}

const evalIn = (page, fn, arg) => page.evaluate(fn, arg);
const square = (page, name) => page.locator(`#board .square[data-square="${name}"]`);

async function waitForScreen(page, id) {
  await page.waitForFunction((screen) => Ludus.router.current() === screen && document.body.dataset.screen === screen, id, { timeout: 15000 });
}

const waitPhase = (page, phase, timeout = RESULT_TIMEOUT_MS) => page.waitForFunction((wanted) => {
  const layout = document.querySelector("#game-layout");
  return Boolean(layout) && layout.getAttribute("data-phase") === wanted;
}, phase, { timeout });
const waitResult = (page) => page.waitForFunction(() => STATE.ui.phase === "result" && Boolean(STATE.resultView.context) && document.querySelector("#game-layout").getAttribute("data-phase") === "result", null, { timeout: RESULT_TIMEOUT_MS });

// The navigation control that reaches a screen at this width: the top bar, the bottom tabs, or the "More" sheet.
async function goTo(journey, id) {
  const { page } = journey;
  const link = page.locator(`a[data-nav="${id}"]:visible`).first();
  if (await link.count()) {
    await link.click();
  } else if (id === "account" && !journey.vp.mobile) {
    await page.locator(".sh-profile-chip:visible").first().click();
    await page.locator(".sh-pop-account:visible").click();
  } else {
    await page.locator("button.sh-more:visible").click();
    await page.locator(".modal .sh-more-item").nth(["museum", "settings", "account"].indexOf(id)).click();
  }
  await waitForScreen(page, id);
}

// A drag of a piece: the mouse on desktop, a real finger (CDP touch events) on the phone.
async function centerOf(page, name) {
  const box = await square(page, name).boundingBox();
  assert.ok(box, `square ${name} has a box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragMove(journey, uci) {
  const { page, cdp } = journey;
  const a = await centerOf(page, uci.slice(0, 2));
  const b = await centerOf(page, uci.slice(2, 4));
  if (cdp) {
    const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })) });
    await touch("touchStart", [a]);
    for (let i = 1; i <= 10; i += 1) await touch("touchMove", [{ x: a.x + ((b.x - a.x) * i) / 10, y: a.y + ((b.y - a.y) * i) / 10 }]);
    await touch("touchEnd", []);
  } else {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 6, a.y - 6, { steps: 3 });
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
  }
  if (uci.length > 4) await page.locator(`#promotion-choice-${uci[4]}`).click();
}

async function clickMove(page, uci) {
  await square(page, uci.slice(0, 2)).click();
  await square(page, uci.slice(2, 4)).click();
  if (uci.length > 4) await page.locator(`#promotion-choice-${uci[4]}`).click();
}

// The worst legal move of the position on screen according to the engine (a real blunder, so a notebook card follows).
const worstMove = (page) => page.evaluate(async () => {
  const position = STATE.positions[STATE.index];
  const analysis = await Ludus.game.analyzePosition(position.fen, { multiPv: 80, movetimeMs: 400 });
  const lines = analysis.lines.filter((line) => line.uci || (line.pv && line.pv[0]));
  const last = lines[lines.length - 1];
  return { uci: last.uci || last.pv[0], of: lines.length };
});

const resultPoints = (page) => page.evaluate(() => STATE.resultView.context.assessment.points);
const events = (page) => page.evaluate(() => window.__journey);

async function collectEvents(page) {
  await page.evaluate(() => {
    if (window.__journey) return;
    window.__journey = { started: [], rounds: [], completed: [] };
    Ludus.bus.on("session:started", (payload) => window.__journey.started.push(payload.session));
    Ludus.bus.on("round:completed", (payload) => window.__journey.rounds.push(payload.round));
    Ludus.bus.on("session:completed", (payload) => window.__journey.completed.push(payload.session));
  });
}

// "Leave" through the exit button and its confirmation, like a person would.
async function leaveThroughButton(page) {
  await page.locator("#restart-btn").scrollIntoViewIfNeeded();
  await page.locator("#restart-btn").click();
  await page.locator("#consent-overlay-accept").waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#consent-overlay-accept").click();
  await waitForScreen(page, "home");
}

// A tile of the settings screen: the real click on its label (the radio inside is covered by it).
async function clickTile(page, pathName, value) {
  const tile = page.locator(`[data-path="${pathName}"] label.settings-tile[data-value="${value}"]`);
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
}

// ---------- the journey ----------

async function journeyFlow(browser, vp, lang) {
  const journey = await openJourney(browser, vp, lang);
  const { page, problems } = journey;
  const es = lang.lang === "es";
  console.log(`\n[${journey.tag}] ${vp.w}x${vp.h}, ${lang.locale}`);
  try {
    // ----- 1. landing -----
    say(journey, "1 landing: a first visit shows it, in the language of the browser");
    await page.goto(BASE_URL);
    await page.waitForFunction(() => window.Ludus && Ludus.game && typeof Ludus.game.startSession === "function" && Ludus.router && Ludus.router.current());
    await waitForScreen(page, "landing");
    await page.locator("#landing-start-btn").waitFor({ state: "visible" });
    assert.strictEqual(await evalIn(page, () => Ludus.i18n.lang()), lang.lang, "the language follows the browser");
    assert.strictEqual(await page.evaluate(() => Ludus.Profile.rounds().length), 0, "a fresh profile has no rounds");
    await stage(journey, "landing", { screen: "landing", full: true });

    // ----- 2. home -----
    say(journey, "2 home: the start button leads to the hub");
    await page.locator("#landing-start-btn").click();
    await waitForScreen(page, "home");
    await page.locator("#screen-home .home-mode").first().waitFor({ state: "visible" });
    await checkTitle(journey, "home", "landing");
    await stage(journey, "home", { screen: "home" });
    await collectEvents(page);

    // ----- 2b. the own-games wizard opens from its card and the navigation leaves it -----
    say(journey, "2b the own-games wizard opens from its card; its title is not a raw key; the navigation leaves it");
    await page.locator('#screen-home .home-mode[data-mode="own"]').click();
    await waitForScreen(page, "setup");
    await page.locator("#wizard-step-indicator").waitFor({ state: "visible" });
    await stage(journey, "wizard", { screen: "setup" });
    await goTo(journey, "home");

    // ----- 3. classics -----
    say(journey, "3 classics: the gallery of 28 games");
    await goTo(journey, "classics");
    await page.waitForSelector(".classics-grid .classics-item", { timeout: 15000 });
    assert.strictEqual(await page.locator(".classics-item").count(), 28);
    await checkTitle(journey, "classics", "home");
    await stage(journey, "classics-gallery", { screen: "classics" });

    // ----- 4. a game: replay + the cue + "try this position" -----
    say(journey, "4 game: open The Opera Game and replay a few moves");
    await page.locator(`.classics-card-link[data-fkey="open-${GAME}"]`).scrollIntoViewIfNeeded();
    await page.locator(`.classics-card-link[data-fkey="open-${GAME}"]`).click();
    await page.waitForSelector(`.classics-detail-page[data-game="${GAME}"] .classics-board .square`, { timeout: 10000 });
    await page.waitForFunction((id) => location.hash === `#/classics/${id}`, GAME);
    const total = await evalIn(page, (id) => Ludus.Classics.get(id).moves.length, GAME);
    assert.strictEqual((await page.locator(".classics-counter").innerText()).trim(), `0 / ${total}`);
    for (let i = 1; i <= 4; i += 1) {
      await page.locator('[data-action="next"]').click();
      assert.strictEqual((await page.locator(".classics-counter").innerText()).trim(), `${i} / ${total}`);
    }
    assert.ok(await page.locator(".classics-board .bd-piece:not(.bd-leaving)").count() >= 30, "the board shows the position after 4 moves");
    const training = await evalIn(page, (id) => Ludus.Classics.get(id).positions.map((p) => p.ply), GAME);
    await page.locator(".classics-scrub-input").fill(String(training[0]));
    assert.ok(await page.locator(".classics-cue .classics-try").isVisible(), "the cue with the try button appears before the master's move");
    await stage(journey, "classics-replay", { screen: "classics", full: journey.vp.mobile });

    say(journey, "4b \"Try this position\" starts a one-position session; leaving asks and goes home");
    await page.locator('[data-fkey="try-position"]').click();
    await waitForScreen(page, "game");
    await waitPhase(page, "thinking");
    assert.strictEqual(await evalIn(page, () => Ludus.game.session().positions), 1);
    await stage(journey, "play-thinking", { screen: "game" });
    await leaveThroughButton(page);
    assert.strictEqual(await evalIn(page, () => Ludus.game.isActive()), false);
    assert.strictEqual(await evalIn(page, () => Ludus.Profile.rounds().length), 0, "leaving early records nothing");

    // ----- 5. training: best move by drag, wrong move by click -----
    say(journey, "5 training: 2 positions of the game");
    const positions = await page.evaluate(async (id) => {
      await Ludus.Classics.load();
      const game = Ludus.Classics.get(id);
      window.__positions = Ludus.Classics.positions(id, { count: 2 });
      await Ludus.game.startSession({ kind: "classic", title: game.title[Ludus.i18n.lang()] || game.title.es, mode: "solo", positions: window.__positions });
      return JSON.parse(JSON.stringify(window.__positions));
    }, GAME);
    assert.strictEqual(positions.length, 2);
    await waitForScreen(page, "game");
    await waitPhase(page, "thinking");
    await page.waitForSelector("#board .bd-piece");
    say(journey, "5a the best move, played by dragging the piece");
    await dragMove(journey, positions[0].bestMoveUci);
    await waitResult(page);
    assert.strictEqual(await resultPoints(page), 10, "the engine's move, played by drag, is worth 10");
    assert.ok(await page.locator("#round-result .co-hero").isVisible(), "the coach panel shows the verdict");
    await page.locator("#round-result .co-hero").scrollIntoViewIfNeeded();
    await stage(journey, "coach-best", { screen: "game", settle: 900 });
    if (journey.vp.mobile) {
      // On a phone the panel is a sheet: the handle opens it over the board.
      await page.locator("#coach-expand").click();
      await stage(journey, "coach-best-sheet", { screen: "game", settle: 600 });
      await page.locator("#coach-expand").click();
    }
    await page.locator("#next-btn").click();
    await waitPhase(page, "thinking");
    say(journey, "5b the worst legal move, played by clicking its squares");
    const worst = await worstMove(page);
    assert.ok(/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(worst.uci), `the engine ranks ${worst.of} legal moves and names the worst (${worst.uci})`);
    await clickMove(page, worst.uci);
    await waitResult(page);
    const wrongPoints = await resultPoints(page);
    assert.ok(wrongPoints < 5, `a blunder scores low (${wrongPoints})`);
    assert.ok(await page.locator("#round-result .co-hero").isVisible());
    await stage(journey, "coach-wrong", { screen: "game", settle: 900 });
    if (journey.vp.mobile) {
      await page.locator("#coach-expand").click();
      await stage(journey, "coach-wrong-sheet", { screen: "game", settle: 600 });
      await page.locator("#coach-expand").click();
    }
    await page.locator("#next-btn").click();
    await waitPhase(page, "summary");
    assert.ok(await page.locator("#session-summary-result").isVisible(), "the summary is on screen");
    await stage(journey, "summary", { screen: "game", settle: 900 });
    const log = await events(page);
    assert.strictEqual(log.rounds.length, 2, "two rounds were announced");
    assert.strictEqual(log.completed.length, 1, "one finished session");
    assert.strictEqual(await evalIn(page, () => Ludus.Profile.rounds().length), 2, "Profile recorded both rounds");
    await page.locator("#summary-menu-btn").click();
    await waitForScreen(page, "home");

    // ----- 6. notebook -----
    say(journey, "6 notebook: the wrong move became a card; reviewing it is graded");
    const counts = await evalIn(page, () => Ludus.Profile.notebook.counts());
    assert.ok(counts.total >= 1, `the wrong move made a notebook card (${JSON.stringify(counts)})`);
    await goTo(journey, "notebook");
    await page.waitForSelector(".notebook-card", { timeout: 10000 });
    await checkTitle(journey, "notebook", "home");
    assert.strictEqual(await page.locator(".notebook-card").count(), counts.total);
    const card = await evalIn(page, () => Ludus.Profile.notebook.list({})[0]);
    assert.strictEqual(card.reviews, 0, "a new card has not been reviewed");
    await stage(journey, "notebook", { screen: "notebook", full: true });
    await page.locator("#notebook-start").scrollIntoViewIfNeeded();
    await page.locator("#notebook-start").click();
    await waitForScreen(page, "game");
    await waitPhase(page, "thinking");
    assert.strictEqual(await evalIn(page, () => Ludus.game.session().kind), "review");
    const best = await evalIn(page, () => {
      const position = STATE.positions[0];
      return position.bestMoveUci || (position.reference && position.reference.lines && position.reference.lines[0] && position.reference.lines[0].uci) || null;
    });
    assert.ok(best, "the card carries the best move to be answered");
    await clickMove(page, best);
    await waitResult(page);
    assert.ok((await resultPoints(page)) >= 9, "the best move of the card is worth almost 10");
    await stage(journey, "review-result", { screen: "game", settle: 900 });
    const graded = await evalIn(page, (id) => Ludus.Profile.notebook.get(id), card.id);
    assert.strictEqual(graded.reviews, 1, "the recorded round graded the card");
    assert.ok(graded.box >= 1, "and it moved up a box");
    await page.locator("#next-btn").click();
    await waitPhase(page, "summary");
    await page.locator("#summary-menu-btn").click();
    await waitForScreen(page, "home");
    await goTo(journey, "notebook");
    await page.waitForSelector(".notebook-card", { timeout: 10000 });
    await stage(journey, "notebook-after-review", { screen: "notebook" });

    // ----- 7. progress -----
    say(journey, "7 progress: the charts render with the new data");
    await goTo(journey, "progress");
    await page.waitForSelector(".progress-root", { timeout: 10000 });
    await checkTitle(journey, "progress", "notebook");
    const rounds = await evalIn(page, () => Ludus.Profile.rounds().length);
    assert.strictEqual(rounds, 3, "two training rounds and one review round");
    const shown = await page.locator(".progress-root").evaluate((root) => ({
      svgs: root.querySelectorAll("svg").length,
      heat: root.querySelectorAll('[class*="heat"]').length,
      text: root.innerText,
    }));
    assert.ok(shown.svgs >= 1, "the charts are drawn");
    assert.ok(shown.heat >= 1, "the heatmap is drawn");
    assert.ok(/\b3\b/.test(shown.text), "the new data (3 positions) is in the numbers");
    await stage(journey, "progress", { screen: "progress", full: true });

    // ----- 8. settings -----
    say(journey, "8 settings: board theme and untimed clock reach the next session");
    await goTo(journey, "settings");
    await page.waitForSelector("[data-path=\"board.theme\"]", { timeout: 10000 });
    await checkTitle(journey, "settings", "progress");
    await clickTile(page, "board.theme", "ocean");
    await clickTile(page, "clock.mode", "untimed");
    assert.strictEqual(await page.locator("html").getAttribute("data-board-theme"), "ocean");
    assert.strictEqual(await evalIn(page, () => Ludus.Settings.get("clock.mode")), "untimed");
    await stage(journey, "settings", { screen: "settings", full: true });
    await goTo(journey, "classics");
    await page.waitForSelector(".classics-grid .classics-item", { timeout: 10000 });
    await page.locator(`.classics-item[data-game="${GAME}"] .classics-card-train`).click();
    await waitForScreen(page, "game");
    await waitPhase(page, "thinking");
    await page.waitForSelector("#board .bd-piece");
    const themed = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.setAttribute("data-board-theme", "ocean");
      document.body.appendChild(probe);
      const expected = getComputedStyle(probe).getPropertyValue("--board-light").trim();
      probe.remove();
      const light = document.querySelector("#board .square.light");
      const rail = document.querySelector("#solo-clock-rail");
      return { expected, actual: getComputedStyle(light).backgroundColor, untimed: rail && rail.classList.contains("is-untimed"), clock: (document.getElementById("solo-clock-value") || {}).textContent };
    });
    assert.strictEqual(themed.untimed, true, "the session is untimed");
    assert.strictEqual((themed.clock || "").trim(), "∞");
    assert.ok(themed.expected, "the ocean theme defines its light square");
    const swatch = await page.evaluate((colour) => {
      const probe = document.createElement("div");
      probe.style.backgroundColor = colour;
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    }, themed.expected);
    assert.strictEqual(themed.actual, swatch, "the real board wears the chosen theme");
    await stage(journey, "play-untimed-ocean", { screen: "game" });
    await evalIn(page, () => Ludus.game.abort());
    await waitForScreen(page, "home");

    // ----- 9. account: a second profile, then a duel between the two -----
    say(journey, "9 account: create a second profile");
    await goTo(journey, "account");
    await page.waitForSelector("li.account-profile", { timeout: 10000 });
    await checkTitle(journey, "account", "home");
    assert.strictEqual(await page.locator("li.account-profile").count(), 1);
    await stage(journey, "account", { screen: "account", full: true });
    await page.locator('[data-action="add"]').click();
    const dialog = page.locator(".modal");
    await dialog.waitFor();
    await dialog.locator('input[type="text"]').fill("Bruno");
    await stage(journey, "account-create-dialog", { screen: "account", dialog: true, axeScope: ".modal" });
    await dialog.locator(".modal-actions .btn-primary").click();
    await page.waitForSelector(".modal", { state: "detached" });
    const profiles = await evalIn(page, () => Ludus.Profile.list().map((p) => ({ id: p.id, name: p.name, active: p.active })));
    assert.strictEqual(profiles.length, 2);
    assert.deepStrictEqual(profiles.map((p) => p.name).sort(), ["Bruno", es ? "Jugador" : "Player"].sort());
    const [first, second] = [profiles.find((p) => p.name !== "Bruno"), profiles.find((p) => p.name === "Bruno")];
    await stage(journey, "account-two-profiles", { screen: "account", full: journey.vp.mobile });
    await evalIn(page, (id) => Ludus.Profile.setActive(id), first.id);

    say(journey, "9b the duel setup names both profiles; a duel of 2 classic positions between them");
    await goTo(journey, "home");
    await page.locator('#screen-home .home-mode[data-mode="duel"]').click();
    await dialog.waitFor();
    assert.strictEqual(await page.locator("#duel-who-0").inputValue(), `p:${first.id}`, "player 1 is the active profile");
    assert.strictEqual(await page.locator("#duel-who-1").inputValue(), `p:${second.id}`, "player 2 is the other profile");
    await stage(journey, "duel-setup", { screen: "home", dialog: true, axeScope: ".modal" });
    await page.locator(".duel-count-input[value=\"5\"]").evaluate((input) => input.click());
    await dialog.locator(".modal-actions .btn-primary").click();
    await waitForScreen(page, "game");
    await waitPhase(page, "thinking");
    const dueled = await evalIn(page, () => { const s = Ludus.game.session(); return { mode: s.mode, names: s.names, profileIds: s.profileIds, positions: s.positions }; });
    assert.strictEqual(dueled.mode, "duel");
    assert.deepStrictEqual(dueled.profileIds, [first.id, second.id]);
    assert.strictEqual(dueled.positions, 5);
    await evalIn(page, () => Ludus.game.abort());
    await waitForScreen(page, "home");

    const duelPositions = await page.evaluate(async ({ id, names, profileIds }) => {
      await Ludus.Classics.load();
      window.__positions = Ludus.Classics.positions(id, { count: 2 });
      await Ludus.game.startSession({ kind: "classic", title: "Duel", mode: "duel", names, profileIds, positions: window.__positions });
      return JSON.parse(JSON.stringify(window.__positions));
    }, { id: GAME, names: dueled.names, profileIds: dueled.profileIds });
    await waitPhase(page, "thinking");
    assert.strictEqual(await page.locator("#duel-score").isVisible(), true, "the duel scoreboard is on screen");
    await stage(journey, "duel-p1", { screen: "game" });
    const roundsBefore = await evalIn(page, (ids) => ids.map((id) => Ludus.Profile.rounds(id).length), dueled.profileIds);
    for (let index = 0; index < 2; index += 1) {
      await dragMove(journey, duelPositions[index].bestMoveUci); // player 1: the engine's move
      await waitPhase(page, "handoff");
      if (index === 0) await stage(journey, "duel-handoff", { screen: "game" });
      await page.locator("#handoff-overlay").click();
      await waitPhase(page, "thinking");
      if (index === 0) {
        await clickMove(page, (await worstMove(page)).uci); // player 2: a blunder
      } else {
        await clickMove(page, duelPositions[index].bestMoveUci); // player 2: the same move, a tie
      }
      await waitResult(page);
      await stage(journey, index === 0 ? "duel-result" : "duel-result-2", { screen: "game", settle: 900 });
      await page.locator("#next-btn").click();
      if (index === 0) {
        // The second position starts covered: the first player's clock waits for their tap.
        await waitPhase(page, "handoff");
        await page.locator("#handoff-overlay").click();
        await waitPhase(page, "thinking");
      }
    }
    await waitPhase(page, "summary");
    assert.ok((await page.locator(".co-sum-title").innerText()).includes(dueled.names[0]), "the headline names the winner");
    await stage(journey, "duel-summary", { screen: "game", settle: 900 });
    const roundsAfter = await evalIn(page, (ids) => ids.map((id) => Ludus.Profile.rounds(id).length), dueled.profileIds);
    assert.deepStrictEqual(roundsAfter.map((n, i) => n - roundsBefore[i]), [2, 2], "each profile recorded its own two rounds");
    await page.locator("#summary-menu-btn").click();
    await waitForScreen(page, "home");

    // ----- 9c. the second person opens their own progress -----
    say(journey, "9c switching profile from the header: progress and notebook show the other person's data");
    await page.locator(".sh-profile-chip:visible").first().click();
    await page.locator(`.sh-pop-row[aria-label*="Bruno"]`).click();
    assert.strictEqual(await evalIn(page, () => Ludus.Profile.active().name), "Bruno");
    await goTo(journey, "progress");
    await page.waitForSelector(".progress-root", { timeout: 10000 });
    const brunoRounds = await evalIn(page, () => Ludus.Profile.rounds().length);
    assert.strictEqual(brunoRounds, 2, "Bruno played the two positions of the duel");
    const brunoText = await page.locator(".progress-root").innerText();
    assert.ok(/\b2\b/.test(brunoText), "the numbers of the progress screen are Bruno's");
    await stage(journey, "progress-second-profile", { screen: "progress" });
    await goTo(journey, "notebook");
    await page.waitForSelector(".notebook", { timeout: 10000 });
    const brunoCards = await evalIn(page, () => Ludus.Profile.notebook.counts().total);
    assert.strictEqual(await page.locator(".notebook-card").count(), Math.min(12, brunoCards), "the notebook lists this profile's cards only");
    await stage(journey, "notebook-second-profile", { screen: "notebook" });

    // ----- 10. museum: the reading room -----
    say(journey, "10 museum: the reading room");
    await goTo(journey, "museum");
    await page.waitForSelector("#museum-tab-room", { timeout: 10000 });
    await checkTitle(journey, "museum", "home");
    await stage(journey, "museum", { screen: "museum" });
    await page.locator("#museum-tab-room").click();
    await page.waitForSelector("#museum-panel-room:not([hidden]) .rd-carousel", { timeout: 10000 });
    const fact = (await page.locator("#museum-panel-room .rd-text").first().innerText()).trim();
    assert.ok(fact.length > 20, "the reading room shows a fact");
    await stage(journey, "museum-room", { screen: "museum", settle: 800 });

    // ----- the titles told the screens apart -----
    const screens = journey.titles.filter((entry, i, list) => i === 0 || list[i - 1].screen !== entry.screen);
    const distinct = new Set(screens.filter((entry) => ["landing", "home", "classics", "notebook", "progress", "settings", "account", "museum"].includes(entry.screen)).map((entry) => entry.title));
    assert.ok(distinct.size >= 7, `the title changes per screen (${Array.from(distinct).join(" / ")})`);
    say(journey, `titles: ${screens.map((entry) => `${entry.screen}="${entry.title}"`).join(", ")}`);

    say(journey, "no console errors, page errors or failed requests");
    assert.deepStrictEqual(problems, [], `${journey.tag}: the page reported problems:\n  ${problems.join("\n  ")}`);
    assert.deepStrictEqual(journey.findings, [], `${journey.tag}: axe findings:\n  ${journey.findings.join("\n  ")}`);
  } finally {
    await journey.context.close();
  }
}

// ---------- run ----------

(async () => {
  const browser = await launchBrowser();
  try {
    for (const vp of VIEWPORTS) {
      for (const lang of LANGS) {
        if (ONLY && !`${vp.name}-${lang.lang}`.includes(ONLY)) continue;
        await journeyFlow(browser, vp, lang);
      }
    }
    console.log("\nwalkthrough passed");
  } catch (error) {
    console.error("\nwalkthrough FAILED");
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
