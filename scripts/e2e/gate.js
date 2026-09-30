// Release gate in a real browser: the shortest path a new person takes through
// the app, at desktop and phone size, on a brand-new profile each time.
//
// Playwright is NOT a project dependency (the app has no runtime or dev
// dependencies) and this script is not part of `npm test`. Run it by hand:
//
//   python3 -m http.server 5030 &                      # serve the repo root (or: node scripts/dev/serve.js 5030, which serves only the deployed files)
//   NODE_PATH=/opt/node22/lib/node_modules LUDUS_URL=http://127.0.0.1:5030/ \
//     LUDUS_E2E_SHOTS=/tmp/ludus-gate node scripts/e2e/gate.js
//
// Environment (all optional):
//   LUDUS_URL             page to test               (default http://127.0.0.1:5030/)
//   LUDUS_CHROMIUM        chrome binary if Playwright cannot launch its own
//                         (falls back to /opt/pw-browsers/chromium-1194/chrome-linux/chrome)
//   LUDUS_E2E_SHOTS       directory for screenshots (none are saved when unset)
//
// For each viewport (1280x800 and 390x844) it opens a fresh browser context
// (fresh storage = fresh profile, service workers blocked because the service
// worker is cache-first and would serve stale files, CSP enforced) and:
//   1. loads the app and sees the landing page in Spanish (the browser locale);
//   2. clicks the start button and arrives at the home hub with its four mode
//      cards; toggles the language and checks that <html lang> follows it;
//   3. opens the classics screen from its mode card and from the navigation and
//      comes back (while that screen is still a stub it only checks that the
//      router shows it without error);
//   4. starts a session through Ludus.game.startSession with positions from
//      Ludus.Classics (after `await Ludus.Classics.load()`), plays the best move
//      by clicking the from/to squares of position.bestMoveUci, waits for the
//      result panel and checks the score shown is a number between 0 and 10 (it
//      must be exactly 10: it is the engine's own move, no hint, no time-out);
//   5. leaves through the "back to start" button and its confirmation, then
//      starts another session and aborts it with Ludus.game.abort(): both end at
//      home, the abort records nothing.
// On every step it also checks: no horizontal page scroll, no duplicated ids.
// At the end: no console errors, no uncaught page errors, no failed requests and
// no HTTP status >= 400 (a console *warning* such as "service worker blocked by
// Playwright" is expected and ignored).
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

const BASE_URL = process.env.LUDUS_URL || "http://127.0.0.1:5030/";
const FALLBACK_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SHOT_DIR = process.env.LUDUS_E2E_SHOTS || "";
const RESULT_TIMEOUT_MS = 60000;
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800, mobile: false },
  { name: "phone", width: 390, height: 844, mobile: true },
];

// ---------- helpers ----------

async function launchBrowser() {
  const args = ["--no-sandbox"];
  try {
    // Uses PLAYWRIGHT_BROWSERS_PATH / the default cache when it has the right build.
    return await chromium.launch({ args });
  } catch (firstError) {
    const explicit = process.env.LUDUS_CHROMIUM || FALLBACK_CHROMIUM;
    if (!fs.existsSync(explicit)) throw firstError;
    return chromium.launch({ executablePath: explicit, args });
  }
}

function step(message) {
  console.log(`  - ${message}`);
}

async function shot(page, viewport, name) {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${viewport.name}-${name}.png`) });
}

const evalIn = (page, expression) => page.evaluate(`(${expression})`);
const square = (page, name) => page.locator(`#board .square[data-square="${name}"]`);

// The page must never scroll sideways and an id must never be used twice (the
// static index.html is covered by smoke-check; this covers what scripts build).
async function checkLayoutBasics(page, label) {
  const facts = await page.evaluate(() => {
    const root = document.documentElement;
    const seen = {};
    const duplicated = [];
    document.querySelectorAll("[id]").forEach((el) => {
      seen[el.id] = (seen[el.id] || 0) + 1;
      if (seen[el.id] === 2) duplicated.push(el.id);
    });
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, duplicated };
  });
  assert.ok(facts.scrollWidth <= facts.clientWidth, `${label}: the page scrolls sideways (${facts.scrollWidth}px > ${facts.clientWidth}px)`);
  assert.deepStrictEqual(facts.duplicated, [], `${label}: duplicated ids`);
}

async function currentScreen(page) {
  return page.evaluate(() => ({
    router: Ludus.router.current(),
    body: document.body.dataset.screen,
  }));
}

async function waitForScreen(page, id) {
  await page.waitForFunction((screen) => Ludus.router.current() === screen && document.body.dataset.screen === screen, id, { timeout: 15000 });
}

async function waitForResult(page) {
  await page.waitForFunction(() => {
    const overlay = document.getElementById("result-overlay");
    const points = document.getElementById("result-overlay-points");
    return Boolean(overlay && !overlay.classList.contains("hidden") && points && /\d/.test(points.textContent));
  }, null, { timeout: RESULT_TIMEOUT_MS });
}

// "Sumaste 10 / 10" (es) or "You earned 8.5 / 10" (en) -> 10, 8.5
function parsePoints(text) {
  const match = /(\d+(?:[.,]\d+)?)\s*\/\s*10\b/.exec(text || "");
  return match ? Number(match[1].replace(",", ".")) : NaN;
}

// Clicks the from and to squares of a UCI move (and the promotion choice).
async function playUci(page, uci) {
  await square(page, uci.slice(0, 2)).click();
  await square(page, uci.slice(2, 4)).click();
  if (uci.length > 4) await page.locator(`#promotion-choice-${uci[4]}`).click();
}

// The navigation link that is visible at this width (top bar or bottom tabs).
const navLink = (page, id) => page.locator(`a[data-nav="${id}"]:visible`).first();

// ---------- one viewport ----------

async function runViewport(browser, viewport) {
  console.log(`\n[${viewport.name}] ${viewport.width}x${viewport.height}`);
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: "es-AR",
    serviceWorkers: "block",
    bypassCSP: false,
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
  });
  const problems = [];
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => problems.push(`requestfailed: ${request.url()} (${request.failure() && request.failure().errorText})`));
  page.on("response", (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
  });

  try {
    // ----- landing -----
    step("the landing page is what a first visit shows");
    await page.goto(BASE_URL);
    await page.waitForFunction(() => window.Ludus && Ludus.game && typeof Ludus.game.startSession === "function" && Ludus.router && Ludus.router.current());
    assert.deepStrictEqual(await currentScreen(page), { router: "landing", body: "landing" });
    await page.locator("#landing-screen").waitFor({ state: "visible" });
    await page.locator("#landing-start-btn").waitFor({ state: "visible" });
    assert.strictEqual(await evalIn(page, "document.documentElement.lang"), "es", "an es-AR browser starts in Spanish");
    assert.ok((await page.locator("#landing-start-btn").innerText()).trim().length > 0, "the start button has a label");
    await checkLayoutBasics(page, "landing");
    await shot(page, viewport, "01-landing");

    // ----- home -----
    step("the start button leads to the home hub with its mode cards");
    await page.locator("#landing-start-btn").click();
    await waitForScreen(page, "home");
    await page.locator("#screen-home .home-mode").first().waitFor({ state: "visible" });
    const modes = await page.locator("#screen-home .home-mode").evaluateAll((cards) => cards.map((card) => card.getAttribute("data-mode")));
    assert.deepStrictEqual(modes, ["own", "classics", "review", "duel"], "the four mode cards");
    for (const mode of ["own", "classics", "duel"]) {
      assert.strictEqual(await page.locator(`#screen-home .home-mode[data-mode="${mode}"]`).isVisible(), true, `the ${mode} card is visible`);
    }
    assert.strictEqual(await evalIn(page, 'Ludus.storage.get("ludus.seen.v1", 0)'), 1, "the landing is not shown again");
    await checkLayoutBasics(page, "home");
    await shot(page, viewport, "02-home");

    step("the language toggle changes <html lang> and the screen text, and back");
    const titleEs = (await page.locator("#screen-home .home-mode").first().innerText()).trim();
    await page.locator("#language-btn-en").click();
    assert.strictEqual(await evalIn(page, "document.documentElement.lang"), "en");
    assert.strictEqual(await evalIn(page, "Ludus.i18n.lang()"), "en");
    const titleEn = (await page.locator("#screen-home .home-mode").first().innerText()).trim();
    assert.notStrictEqual(titleEn, titleEs, "the mode cards are redrawn in English");
    await shot(page, viewport, "03-home-en");
    await page.locator("#language-btn-es").click();
    assert.strictEqual(await evalIn(page, "document.documentElement.lang"), "es");
    assert.strictEqual((await page.locator("#screen-home .home-mode").first().innerText()).trim(), titleEs, "and back to Spanish");

    // ----- classics screen -----
    step("the classics screen opens from its mode card and from the navigation");
    await page.locator('#screen-home .home-mode[data-mode="classics"]').click();
    await waitForScreen(page, "classics");
    assert.strictEqual(await page.locator("#screen-classics").evaluate((el) => el.classList.contains("hidden")), false, "the classics section is shown");
    const classicsHasContent = await page.locator("#screen-classics").evaluate((el) => el.children.length > 0);
    if (classicsHasContent) {
      await page.locator("#screen-classics").waitFor({ state: "visible" });
      await checkLayoutBasics(page, "classics");
    } else {
      step("(the classics screen is still an empty stub: only the router is checked)");
    }
    await shot(page, viewport, "04-classics");
    await navLink(page, "home").click();
    await waitForScreen(page, "home");
    await navLink(page, "classics").click();
    await waitForScreen(page, "classics");
    await navLink(page, "home").click();
    await waitForScreen(page, "home");

    // ----- a session of classic positions -----
    step("a session of classic positions starts through Ludus.game.startSession");
    await page.evaluate(() => {
      window.__gate = { rounds: [], sessions: [], started: [] };
      Ludus.bus.on("session:started", (payload) => window.__gate.started.push(payload.session));
      Ludus.bus.on("round:completed", (payload) => window.__gate.rounds.push(payload.round));
      Ludus.bus.on("session:completed", (payload) => window.__gate.sessions.push(payload.session));
    });
    const positions = await page.evaluate(async () => {
      await Ludus.Classics.load();
      const game = Ludus.Classics.list()[0];
      window.__gate.positions = Ludus.Classics.positions(game.id, { count: 2 });
      await Ludus.game.startSession({ kind: "classic", title: game.title.es, positions: window.__gate.positions });
      return JSON.parse(JSON.stringify(window.__gate.positions));
    });
    assert.strictEqual(positions.length, 2);
    assert.ok(/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(positions[0].bestMoveUci), `the classic position carries its best move (${positions[0].bestMoveUci})`);
    assert.deepStrictEqual(await currentScreen(page), { router: "game", body: "game" });
    assert.strictEqual(await evalIn(page, "Ludus.game.isActive()"), true);
    await page.locator("#board").waitFor({ state: "visible" });
    assert.strictEqual(await page.locator("#board .square").count(), 64, "the board has 64 squares");
    assert.ok((await page.locator("#session-title").textContent()).trim().length > 0, "the round bar names the session");
    assert.match((await page.locator("#round-status").textContent()).trim(), /1\s*(\/|of|de)\s*2/, "position 1 of 2");
    await checkLayoutBasics(page, "game");
    await shot(page, viewport, "05-game");

    step("the engine's best move, played by clicking its squares, is worth 10 points");
    await playUci(page, positions[0].bestMoveUci);
    await waitForResult(page);
    const shown = parsePoints(await page.locator("#result-overlay-points").textContent());
    assert.ok(Number.isFinite(shown) && shown >= 0 && shown <= 10, `the result panel shows a score between 0 and 10 (${shown})`);
    assert.strictEqual(shown, 10, "the best move of the reference is worth 10");
    assert.strictEqual(await page.locator("#result-overlay").isVisible(), true, "the result panel is on screen");
    assert.strictEqual(await page.locator("#next-btn").isEnabled(), true, "the next position can be asked for");
    const round = await page.evaluate(() => window.__gate.rounds.slice(-1)[0]);
    assert.ok(round, "a round:completed event was announced");
    assert.strictEqual(round.points, 10);
    assert.strictEqual(round.source, "classic");
    assert.strictEqual(await evalIn(page, "Ludus.Profile.rounds().length"), 1, "Profile recorded the round through the bus");
    await checkLayoutBasics(page, "result");
    // Let the toasts and the arrows settle so the picture shows the steady state.
    await page.waitForTimeout(800);
    await shot(page, viewport, "06-result");

    // ----- leaving -----
    step("the back-to-start button asks for confirmation and goes home");
    await page.locator("#restart-btn").scrollIntoViewIfNeeded();
    await page.locator("#restart-btn").click();
    await page.locator("#consent-overlay-accept").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#consent-overlay-accept").click();
    await waitForScreen(page, "home");
    assert.strictEqual(await evalIn(page, "Ludus.game.isActive()"), false);
    assert.strictEqual(await evalIn(page, "window.__gate.sessions.length"), 0, "leaving early records no finished session");

    step("a second session is aborted with Ludus.game.abort() and records nothing");
    const roundsBefore = await evalIn(page, "Ludus.Profile.rounds().length");
    await page.evaluate(() => Ludus.game.startSession({ kind: "classic", title: "Abort", positions: window.__gate.positions.slice(0, 1) }));
    assert.strictEqual(await evalIn(page, "Ludus.game.isActive()"), true);
    assert.deepStrictEqual(await currentScreen(page), { router: "game", body: "game" });
    await page.evaluate(() => Ludus.game.abort());
    await waitForScreen(page, "home");
    assert.strictEqual(await evalIn(page, "Ludus.game.isActive()"), false);
    await page.locator("#screen-home .home-mode").first().waitFor({ state: "visible" });
    assert.strictEqual(await evalIn(page, "Ludus.Profile.rounds().length"), roundsBefore, "an aborted session records no round");
    assert.strictEqual(await evalIn(page, "window.__gate.sessions.length"), 0, "and no session");
    assert.strictEqual(await evalIn(page, "window.__gate.started.length"), 2, "both sessions announced their start");
    await checkLayoutBasics(page, "home after leaving");

    step("no console errors, page errors or failed requests");
    assert.deepStrictEqual(problems, [], `the page reported problems:\n  ${problems.join("\n  ")}`);
  } finally {
    await context.close();
  }
}

// ---------- run ----------

(async () => {
  const browser = await launchBrowser();
  try {
    for (const viewport of VIEWPORTS) await runViewport(browser, viewport);
    console.log("\ngate passed");
  } catch (error) {
    console.error("\ngate FAILED");
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
