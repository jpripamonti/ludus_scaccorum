// Browser end-to-end check of the game core's navigation and session safety (QA fix pass, F1).
//
// Playwright is NOT a project dependency (the app has no runtime or dev dependencies) and this script
// is not part of `npm test`. Run it by hand:
//
//   python3 -m http.server 5010 &                      # serve the repo root (or: node scripts/dev/serve.js 5010, which serves only the deployed files)
//   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/navigation.js
//
// Environment (all optional): LUDUS_URL (default http://127.0.0.1:5010/), LUDUS_E2E_ONLY (history | guard |
// wizard | resume | clock | downloads | museum), LUDUS_CHROMIUM, LUDUS_E2E_SHOTS (screenshot directory).
//
//   history    the browser's Back and Forward move between the screens of the app (UX-001);
//   guard      Back in the middle of a game asks; "keep playing" stays, "leave" goes on, and the finished game
//              is not a place Forward can return to (UX-001);
//   wizard     the steps of the own-games wizard are history entries (UX-001);
//   resume     a reload in the middle of a session warns (beforeunload) and then offers to go on with what is
//              left; leaving by the normal roads clears it (UX-002, COR-020);
//   clock      the round clock does not run while the page is hidden (UX-003);
//   downloads  the download's failures say what failed and offer a remedy (404, rate limit with its countdown),
//              and a hanging download can be cancelled (UX-006, UX-009, UX-010, UX-012).
//   museum     the museum's tabs are entries of the history: Back and Forward (a phone's Back gesture) walk through them before they leave
//              the screen, the tab title and the address follow, a typed address and a cold start on a tab behave (polish PD-4).
//
// Every scenario fails on a console error, an uncaught page error or a failed request of the app's own files.
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
const ONLY = process.env.LUDUS_E2E_ONLY || "";

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

const step = (message) => console.log(`  - ${message}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function shot(page, name) {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
}

// A fresh profile that has seen the landing page and played its first session, so that the screens are the
// ordinary ones (the first-run session has no clock, see play-session.js).
async function newSession(browser, options = {}) {
  const context = await browser.newContext({
    viewport: options.phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    hasTouch: Boolean(options.phone),
    locale: options.locale || "en-US",
    serviceWorkers: "block",
  });
  await context.addInitScript(() => {
    try {
      if (window.localStorage.getItem("ludus.firstRun.v1") === null) window.localStorage.setItem("ludus.firstRun.v1", "1");
      if (window.localStorage.getItem("ludus.seen.v1") === null) window.localStorage.setItem("ludus.seen.v1", "1");
    } catch (error) {
      // Storage blocked: the scenario will say so.
    }
  });
  const page = await context.newPage();
  const problems = [];
  const ignored = options.ignoreUrls || [];
  const own = (url) => !ignored.some((prefix) => url.startsWith(prefix));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // The browser logs every 4xx/5xx answer of a request that the test makes fail on purpose.
    if (/Failed to load resource/.test(message.text()) && ignored.length) return;
    problems.push(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    if (own(request.url())) problems.push(`requestfailed: ${request.url()} (${request.failure() && request.failure().errorText})`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && own(response.url())) problems.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  return { context, page, problems };
}

async function boot(page) {
  await page.goto(BASE_URL);
  await page.waitForFunction(() => window.Ludus && Ludus.game && typeof Ludus.game.startSession === "function");
  await page.waitForFunction(() => Ludus.router.current());
}

const evalIn = (page, expression) => page.evaluate(`(${expression})`);
const screenOf = (page) => evalIn(page, "Ludus.router.current()");
const square = (page, name) => page.locator(`#board .square[data-square="${name}"]`);

async function startClassic(page, options = {}) {
  await page.evaluate(async (opts) => {
    await Ludus.Classics.load();
    const game = Ludus.Classics.list()[0];
    window.__positions = Ludus.Classics.positions(game.id, { count: opts.count || 3 });
    await Ludus.game.startSession({ kind: "classic", title: opts.title || "Navigation", positions: window.__positions, options: opts.options || { clock: { mode: "untimed" } } });
  }, options);
}

async function playBest(page) {
  const uci = await page.evaluate(() => STATE.positions[STATE.index].reference.lines[0].uci);
  await square(page, uci.slice(0, 2)).click();
  await square(page, uci.slice(2, 4)).click();
  await page.waitForFunction(() => STATE.ui.phase === "result", null, { timeout: 60000 });
}

function check(label, problems) {
  assert.deepStrictEqual(problems, [], `${label}: the page reported problems:\n  ${problems.join("\n  ")}`);
}

// ---------- scenarios ----------

async function historyScenario(browser) {
  console.log("scenario: history");
  const { context, page, problems } = await newSession(browser);
  try {
    await boot(page);
    step("screens shown one after the other are entries of the browser's history");
    await page.evaluate(() => Ludus.router.show("classics"));
    await page.evaluate(() => Ludus.router.show("progress"));
    assert.strictEqual(await screenOf(page), "progress");
    await page.goBack();
    await page.waitForFunction(() => Ludus.router.current() === "classics");
    await page.goBack();
    await page.waitForFunction(() => Ludus.router.current() === "home");
    await page.goForward();
    await page.waitForFunction(() => Ludus.router.current() === "classics");
    assert.strictEqual(await evalIn(page, "document.body.dataset.screen"), "classics", "the body follows the router");
    step("no console errors, page errors or failed requests");
    check("history", problems);
  } finally {
    await context.close();
  }
}

async function guardScenario(browser) {
  console.log("scenario: guard");
  const { context, page, problems } = await newSession(browser);
  try {
    await boot(page);
    await startClassic(page);
    assert.strictEqual(await screenOf(page), "game");
    await playBest(page);

    step("Back in the middle of a game asks; 'keep playing' stays where it was");
    await page.goBack();
    await page.locator("#consent-overlay-accept").waitFor({ state: "visible", timeout: 5000 });
    await shot(page, "20-leave-game-dialog");
    await page.locator("#consent-overlay-cancel").click();
    await sleep(300);
    assert.strictEqual(await screenOf(page), "game");
    assert.strictEqual(await evalIn(page, "Ludus.game.isActive()"), true);
    assert.strictEqual(await evalIn(page, "STATE.ui.phase"), "result", "the result the person was reading is still there");

    step("Back and 'leave' goes home, and the finished game is not a place Forward can return to");
    await page.goBack();
    await page.locator("#consent-overlay-accept").waitFor({ state: "visible", timeout: 5000 });
    await page.locator("#consent-overlay-accept").click();
    await page.waitForFunction(() => Ludus.router.current() !== "game");
    assert.strictEqual(await evalIn(page, "Ludus.game.isActive()"), false);
    await page.goForward().catch(() => {});
    await sleep(700);
    assert.notStrictEqual(await screenOf(page), "game", "Forward cannot bring a dead game back");
    assert.strictEqual(await page.locator("#consent-overlay").isVisible(), false);
    step("no console errors, page errors or failed requests");
    check("guard", problems);
  } finally {
    await context.close();
  }
}

async function wizardScenario(browser) {
  console.log("scenario: wizard");
  const { context, page, problems } = await newSession(browser);
  try {
    await boot(page);
    await page.evaluate(() => Ludus.game.openOwnGamesSetup({}));
    const stepOf = () => evalIn(page, "STATE.setupWizard.step");
    assert.strictEqual(await stepOf(), 1);
    step("each step of the wizard is an entry: Back goes to the step before, then to the screen before the wizard");
    await page.locator("#wizard-mode-solo").click();
    await page.locator("#wizard-next-btn").click();
    assert.strictEqual(await stepOf(), 2);
    await page.locator("#online-user-input").fill("TestUser");
    await page.locator("#wizard-next-btn").click();
    assert.strictEqual(await stepOf(), 3);
    await page.goBack();
    await page.waitForFunction(() => STATE.setupWizard.step === 2);
    assert.strictEqual(await screenOf(page), "setup", "still in the wizard");
    await page.goBack();
    await page.waitForFunction(() => STATE.setupWizard.step === 1);
    await page.goBack();
    await page.waitForFunction(() => Ludus.router.current() !== "setup");
    step("no console errors, page errors or failed requests");
    check("wizard", problems);
  } finally {
    await context.close();
  }
}

async function resumeScenario(browser) {
  console.log("scenario: resume");
  const { context, page, problems } = await newSession(browser, { phone: true });
  try {
    await boot(page);
    await startClassic(page, { title: "Resume me", count: 3 });
    await playBest(page);
    await page.locator("#next-btn").tap();
    await page.waitForFunction(() => STATE.index === 1 && STATE.ui.phase === "playing");

    step("a reload in the middle of a session warns first");
    const dialogs = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.type());
      await dialog.accept();
    });
    await page.reload({ waitUntil: "load" });
    assert.deepStrictEqual(dialogs, ["beforeunload"]);

    step("and offers to carry on with the positions that are left");
    await page.waitForFunction(() => window.Ludus && Ludus.game);
    const carryOn = page.locator("#consent-overlay-accept");
    await carryOn.waitFor({ state: "visible", timeout: 6000 });
    assert.match(await page.locator("#consent-overlay").textContent(), /2/, "it says how many are left");
    await shot(page, "21-resume-offer");
    await carryOn.tap();
    await page.waitForFunction(() => Ludus.router.current() === "game" && STATE.ui.phase === "playing");
    assert.strictEqual(await evalIn(page, "STATE.positions.length"), 2, "the answered position is not played twice");

    step("finishing or leaving the session leaves nothing to resume");
    await page.evaluate(() => Ludus.game.abort());
    assert.strictEqual(await evalIn(page, 'sessionStorage.getItem("ludus.sessionProgress.v1")'), null);
    step("no console errors, page errors or failed requests");
    check("resume", problems);
  } finally {
    await context.close();
  }
}

async function clockScenario(browser) {
  console.log("scenario: clock");
  const { context, page, problems } = await newSession(browser);
  try {
    await boot(page);
    await startClassic(page, { title: "Clock", count: 2, options: { clock: { mode: "timed", seconds: 10 } } });
    const clock = async () => (await page.locator("#solo-clock-value").textContent()).trim();
    const setHidden = (hidden) => page.evaluate((value) => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => value });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (value ? "hidden" : "visible") });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
    step("the clock counts down while the page is visible");
    await sleep(2200);
    const before = await clock();
    assert.notStrictEqual(before, "00:10");
    step("a hidden page does not spend the round: 9 seconds away, the clock has not moved and the round is not lost");
    await setHidden(true);
    const atHide = await clock();
    await sleep(9000);
    assert.strictEqual(await clock(), atHide);
    assert.strictEqual(await evalIn(page, "STATE.ui.phase"), "playing");
    await setHidden(false);
    await sleep(1400);
    assert.notStrictEqual(await clock(), atHide, "and it runs again when the page comes back");
    assert.strictEqual(await evalIn(page, "STATE.ui.phase"), "playing");
    await page.evaluate(() => Ludus.game.abort());
    step("no console errors, page errors or failed requests");
    check("clock", problems);
  } finally {
    await context.close();
  }
}

// Lichess answers come from here; the real network is never touched.
function buildPgn(user) {
  const moves = "1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0";
  const games = [];
  for (let index = 0; index < 4; index += 1) {
    games.push([`[Event "E2E ${index + 1}"]`, '[Site "https://lichess.org/e2e"]', '[Date "2024.05.05"]', '[Round "-"]', '[White "Rival"]', `[Black "${user}"]`, '[Result "1-0"]', '[TimeControl "600+0"]', "", moves, ""].join("\n"));
  }
  return `${games.join("\n")}\n`;
}

async function downloadsScenario(browser) {
  console.log("scenario: downloads");
  const { context, page, problems } = await newSession(browser, { ignoreUrls: ["https://lichess.org/", "https://api.chess.com/"] });
  try {
    let mode = "404";
    let hits = 0;
    let hangingRoute = null;
    await context.route("https://lichess.org/**", async (route) => {
      hits += 1;
      if (mode === "404") return route.fulfill({ status: 404, body: "Not found" });
      if (mode === "429") return route.fulfill({ status: 429, headers: { "retry-after": "20" }, body: "slow down" });
      if (mode === "hang") {
        hangingRoute = route;
        return undefined;
      }
      return route.fulfill({ status: 200, contentType: "application/x-chess-pgn", body: buildPgn("TestUser") });
    });
    await context.route("https://api.chess.com/**", (route) => route.abort());
    await boot(page);
    await page.evaluate(() => Ludus.game.openOwnGamesSetup({ mode: "solo" }));
    const errorText = async () => (await page.locator("#wizard-source-error").textContent()).replace(/\s+/g, " ").trim();
    const startDownload = async (user) => {
      await page.locator("#online-user-input").fill(user);
      if ((await evalIn(page, "STATE.setupWizard.step")) === 1 || (await page.locator("#wizard-step-2").isVisible())) {
        await page.locator("#wizard-next-btn").click();
      }
      await page.locator("#analyze-btn").click();
      // The download asks for the person's consent once per provider and username.
      const consent = page.locator("#consent-overlay-accept");
      const asked = await consent.waitFor({ state: "visible", timeout: 2000 }).then(() => true, () => false);
      if (asked) {
        await page.locator("#consent-overlay-username-input").fill(user);
        await consent.click();
      }
    };

    step("a user that does not exist is said so in words, with a way out, back on the step that fixes it");
    await startDownload("TestUser");
    await page.locator("#wizard-source-error").waitFor({ state: "visible", timeout: 10000 });
    assert.match(await errorText(), /could not find TestUser on Lichess/i);
    assert.doesNotMatch(await errorText(), /Error|undefined|\[object|HTTP 404/);
    assert.strictEqual(await page.locator("#wizard-step-2").isVisible(), true, "the username field is on screen");
    assert.ok((await page.locator("#wizard-source-cta button:visible").count()) >= 1, "with at least one remedy button");
    await shot(page, "22-download-404");

    step("a rate limit says when the next try is and does not hammer the provider");
    mode = "429";
    const before = hits;
    await page.evaluate(() => { document.querySelector("#online-user-input").value = ""; });
    await startDownload("TestUser2");
    await page.locator("#wizard-source-error").waitFor({ state: "visible", timeout: 10000 });
    assert.match(await errorText(), /asked us to slow down/i);
    assert.match(await errorText(), /\d+ seconds?/, "with the wait");
    assert.strictEqual(hits - before, 1, "one request, no automatic retry inside it");
    await shot(page, "23-download-rate-limit");

    step("a download that hangs shows elapsed time and can be cancelled");
    await page.evaluate(() => Ludus.game.openOwnGamesSetup({ mode: "solo" }));
    mode = "hang";
    await page.evaluate(() => { try { window.localStorage.removeItem("ludus.remoteFetchCooldown.v1"); } catch (error) { /* ignore */ } });
    await startDownload("HangUser");
    await page.locator("#analysis-cancel-btn").waitFor({ state: "visible", timeout: 10000 });
    // The elapsed time appears once the wait stops being short (8 seconds).
    await page.waitForFunction(() => /\d/.test(document.querySelector("#analysis-elapsed").textContent), null, { timeout: 15000 });
    await shot(page, "24-download-cancel");
    await page.locator("#analysis-cancel-btn").click();
    await page.waitForFunction(() => !STATE.setupWizard.busy && !STATE.ui.setupAnalyzing, null, { timeout: 5000 });
    assert.strictEqual(await page.locator("#analysis-cancel-btn").isVisible(), false);
    if (hangingRoute) await hangingRoute.abort().catch(() => {});
    assert.strictEqual(await screenOf(page), "setup", "cancel stays in the wizard");
    step("no console errors, page errors or failed requests");
    check("downloads", problems);
  } finally {
    await context.close();
  }
}

// ---------- polish PD-4: the museum's tabs are history entries ----------

async function museumScenario(browser) {
  console.log("scenario: museum");
  const { context, page, problems } = await newSession(browser);
  try {
    await boot(page);
    const where = () => page.evaluate(() => {
      const tab = document.querySelector('.museum-tab[aria-selected="true"]');
      return { screen: Ludus.router.current(), tab: tab ? tab.dataset.tab : null, title: document.title, hash: window.location.hash };
    });
    const waitFor = (screen, tab) => page.waitForFunction(([wantedScreen, wantedTab]) => {
      const el = document.querySelector('.museum-tab[aria-selected="true"]');
      return Ludus.router.current() === wantedScreen && (wantedTab === null || (el && el.dataset.tab === wantedTab));
    }, [screen, tab], { timeout: 5000 });

    step("a tab the person opens is an entry: Back goes to the tab before, then to the screen before the museum");
    await page.evaluate(() => Ludus.router.show("museum"));
    await waitFor("museum", "timeline");
    await page.locator("#museum-tab-curiosities").click();
    await page.locator("#museum-tab-school").click();
    let now = await where();
    assert.strictEqual(now.tab, "school");
    assert.match(now.title, /^Chess school - History - Ludus Scaccorum$/, "the tab title names the section");
    assert.strictEqual(now.hash, "#/museum/school");
    await page.goBack();
    await waitFor("museum", "curiosities");
    now = await where();
    assert.match(now.title, /^Curiosities - History/, "the title follows the tab Back landed on");
    assert.strictEqual(now.hash, "#/museum/curiosities");
    await page.goBack();
    await waitFor("museum", "timeline");
    now = await where();
    assert.match(now.title, /^Timeline - History/);
    assert.strictEqual(now.hash, "#/museum");
    await page.goBack();
    await waitFor("home", null);

    step("Forward walks the tabs again");
    await page.goForward();
    await waitFor("museum", "timeline");
    await page.goForward();
    await waitFor("museum", "curiosities");
    await page.goForward();
    await waitFor("museum", "school");
    assert.strictEqual(await page.locator("#museum-panel-school").isVisible(), true);
    assert.strictEqual(await page.locator("#museum-panel-curiosities").isVisible(), false);
    assert.strictEqual((await where()).title, "Chess school - History - Ludus Scaccorum");

    step("the arrow keys move between tabs and each one is an entry; focus follows Back to the tab that is open");
    await page.locator("#museum-tab-school").focus();
    await page.keyboard.press("ArrowRight");
    await waitFor("museum", "room");
    assert.strictEqual(await evalIn(page, "document.activeElement && document.activeElement.id"), "museum-tab-room");
    await page.goBack();
    await waitFor("museum", "school");
    assert.strictEqual(await evalIn(page, "document.activeElement && document.activeElement.id"), "museum-tab-school", "the focus is on the open tab, not lost on the page");
    await page.goForward();
    await waitFor("museum", "room");

    step("focus inside a tab that Back hides goes to the tab that is open (the browser would drop it on the page)");
    await page.locator("#museum-tab-curiosities").click();
    await page.locator("#museum-search").focus();
    await page.goBack();
    await waitFor("museum", "room");
    assert.strictEqual(await evalIn(page, "document.activeElement && document.activeElement.id"), "museum-tab-room");

    step("another screen in between: Back returns to the tab the museum was left on, then to the tab before it");
    await page.evaluate(() => Ludus.router.show("classics"));
    await waitFor("classics", null);
    await page.goBack();
    await waitFor("museum", "room");
    await page.goBack();
    await waitFor("museum", "school");

    step("the language switch redraws the tab in place and Back still lands on the right one, titled in the new language");
    await page.evaluate(() => Ludus.i18n.setLanguage("es"));
    await page.waitForFunction(() => /Escuela de ajedrez/.test(document.title));
    await page.goBack();
    await waitFor("museum", "curiosities");
    assert.strictEqual((await where()).title, "Curiosidades - Historia - Ludus Scaccorum");
    assert.match(await page.locator("#museum-tab-curiosities").innerText(), /Curiosidades/);
    await page.evaluate(() => Ludus.i18n.setLanguage("en"));

    step("a tab typed in the address is an entry of its own (a tab opened after it does not overwrite it); Back goes to where the person was");
    await page.evaluate(() => { window.location.hash = "#/museum/room"; });
    await waitFor("museum", "room");
    await page.locator("#museum-tab-timeline").click();
    await waitFor("museum", "timeline");
    await page.goBack();
    await waitFor("museum", "room");
    await page.goBack();
    await waitFor("museum", "curiosities");

    step("a page opened on #/museum/<tab> shows that tab; Back goes to the tab before, then leaves the museum");
    await page.goto("about:blank");
    await page.goto(`${BASE_URL}#/museum/room`);
    await page.waitForFunction(() => window.Ludus && Ludus.router && Ludus.router.current() === "museum" && document.querySelector('.museum-tab[aria-selected="true"]'));
    await waitFor("museum", "room");
    await page.locator("#museum-tab-timeline").click();
    await waitFor("museum", "timeline");
    await page.goBack();
    await waitFor("museum", "room");
    await page.goBack();
    await page.waitForFunction(() => Ludus.router.current() === "home");

    step("no console errors, page errors or failed requests");
    check("museum", problems);
  } finally {
    await context.close();
  }
}

// ---------- run ----------

(async () => {
  const browser = await launchBrowser();
  try {
    const scenarios = { history: historyScenario, guard: guardScenario, wizard: wizardScenario, resume: resumeScenario, clock: clockScenario, downloads: downloadsScenario, museum: museumScenario };
    for (const [name, run] of Object.entries(scenarios)) {
      if (!ONLY || ONLY === name) await run(browser);
    }
    console.log("navigation passed");
  } catch (error) {
    console.error("navigation FAILED");
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
