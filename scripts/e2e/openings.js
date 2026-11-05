// Browser end-to-end check of "Your openings" (js/ui/openings.js, js/openings.js and the openings session of app.js),
// in Chromium with the real Stockfish Worker and the Lichess request intercepted (the network is never touched).
//
// Playwright is NOT a project dependency and this script is not part of `npm test`. Run it by hand:
//
//   node scripts/dev/serve.js 5010 &
//   NODE_PATH=$(npm root -g) node scripts/e2e/openings.js
//
// Environment (all optional):
//   LUDUS_URL         page to test (default http://127.0.0.1:5010/)
//   LUDUS_CHROMIUM    chrome binary if Playwright cannot launch its own
//   LUDUS_E2E_SHOTS   directory for screenshots (none are saved when unset)
//
// The journey: home -> the openings card -> the empty state (nothing downloaded) -> its button opens the own-games
// wizard as an openings session ("Train your openings in 2 steps") -> download with consent -> the first position is a
// mistake of the opening phase (move 12 or earlier) and carries its opening -> the best move -> the coach names the
// opening -> home -> the openings screen now lists the games by colour and family, with the mistake the session confirmed
// -> a family's "Train" opens the wizard focused on it, with the provider and user of the download. Desktop and phone
// widths, no sideways scroll. Fails on any console error, page error or failed request.

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright is not installed. Run with NODE_PATH=$(npm root -g) (see the header of this file).");
  process.exit(2);
}

const BASE_URL = process.env.LUDUS_URL || "http://127.0.0.1:5010/";
const SHOT_DIR = process.env.LUDUS_E2E_SHOTS || "";

async function launchBrowser() {
  const args = ["--no-sandbox"];
  try {
    return await chromium.launch({ args });
  } catch (firstError) {
    const explicit = process.env.LUDUS_CHROMIUM;
    if (!explicit || !fs.existsSync(explicit)) throw firstError;
    return chromium.launch({ executablePath: explicit, args });
  }
}

function step(message) {
  console.log(`  - ${message}`);
}

async function shot(page, name, options) {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot(Object.assign({ path: path.join(SHOT_DIR, `${name}.png`) }, options || {}));
}

// TestUser's games: early blunders in several openings, with both colours. Four copies (different events) so that no
// fallback download is asked for.
function buildPgn() {
  const bodies = [
    ["Rival", "TestUser", "1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0"],
    ["TestUser", "Rival", "1. f3 e5 2. g4 Qh4# 0-1"],
    ["TestUser", "Rival", "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5 5. Nxf7 Qxg2 6. Rf1 Qxe4+ 7. Be2 Nf3# 0-1"],
    ["Rival", "TestUser", "1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0"],
    ["Rival", "TestUser", "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Bg5 e6 7. f4 Qb6 8. Qd2 Qxb2 9. Rb1 Qa3 1/2-1/2"],
  ];
  const games = [];
  for (let copy = 0; copy < 4; copy += 1) {
    bodies.forEach(([white, black, moves], index) => {
      const result = moves.slice(moves.lastIndexOf(" ") + 1);
      games.push([
        `[Event "E2E ${copy * bodies.length + index + 1}"]`, '[Site "https://lichess.org/e2e"]', `[Date "2026.10.${String(index + 1).padStart(2, "0")}"]`, '[Round "-"]',
        `[White "${white}"]`, `[Black "${black}"]`, `[Result "${result}"]`, '[TimeControl "600+0"]', "", moves, "",
      ].join("\n"));
    });
  }
  return `${games.join("\n")}\n`;
}

async function noSidewaysScroll(page, where) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `${where}: the page scrolls sideways by ${overflow}px`);
}

async function main() {
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "en-US", serviceWorkers: "block" });
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
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => problems.push(`requestfailed: ${request.url()} (${request.failure() && request.failure().errorText})`));
  page.on("response", (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  let lichessRequests = 0;
  await context.route("https://lichess.org/**", async (route) => {
    lichessRequests += 1;
    await route.fulfill({ status: 200, contentType: "application/x-chess-pgn", body: buildPgn() });
  });
  await context.route("https://api.chess.com/**", (route) => route.abort());

  try {
    console.log("scenario: your openings");
    await page.goto(BASE_URL);
    await page.waitForFunction(() => window.Ludus && Ludus.game && typeof Ludus.game.openingsReport === "function" && Ludus.router.current() === "home");

    step("home has the openings card; it opens the screen, which asks for a download first");
    await page.locator('#screen-home .home-mode[data-mode="openings"]').click();
    assert.strictEqual(await page.evaluate(() => Ludus.router.current()), "openings");
    await page.locator("#screen-openings .openings-empty").waitFor({ state: "visible" });
    assert.match(await page.title(), /Your openings/);
    await shot(page, "openings-01-empty");

    step("the empty state's button opens the wizard as an openings session");
    await page.locator("#screen-openings .openings-empty button").click();
    assert.strictEqual(await page.evaluate(() => Ludus.router.current()), "setup");
    assert.strictEqual((await page.locator("#setup-wizard .wizard-header h2").textContent()).trim(), "Train your openings in 2 steps");
    await page.locator("#online-user-input").fill("TestUser");
    await page.locator("#wizard-next-btn").click();
    await page.locator("#session-size").fill("2");
    await page.locator("#session-size").dispatchEvent("input");
    await page.locator("#analyze-btn").click();
    await page.locator("#consent-overlay-username-input").waitFor({ state: "visible" });
    await page.locator("#consent-overlay-username-input").fill("TestUser");
    await page.locator("#consent-overlay-accept").click();
    await page.waitForFunction(() => Ludus.router.current() === "game", null, { timeout: 180000 });
    assert.ok(lichessRequests >= 1, "the games came from the (intercepted) provider request");

    step("the first position is a mistake of the opening phase and carries its opening");
    const first = await page.evaluate(() => ({
      move: STATE.positions[0].meta.moveNumber,
      best: STATE.positions[0].bestMoveUci,
      opening: STATE.positions[0].opening,
      title: STATE.session.title,
    }));
    assert.ok(first.move <= 12, `move ${first.move}`);
    assert.ok(first.opening && first.opening.name, JSON.stringify(first.opening));
    assert.match(first.title, /^Your openings: TestUser/);
    await page.locator(`#board .square[data-square="${first.best.slice(0, 2)}"]`).click();
    await page.locator(`#board .square[data-square="${first.best.slice(2, 4)}"]`).click();
    await page.locator("#coach-panel .co-opening").waitFor({ state: "visible", timeout: 60000 });
    const coachText = await page.locator("#coach-panel .co-opening").innerText();
    assert.ok(coachText.includes(first.opening.name), coachText);
    if (first.opening.inBook && first.opening.continuations.length) assert.ok(await page.locator("#coach-panel .co-book-san").count() > 0, "the book moves");
    await shot(page, "openings-02-coach");
    await page.evaluate(() => Ludus.game.abort());

    step("the openings screen lists the games by colour and family");
    await page.evaluate(() => Ludus.router.show("openings"));
    await page.locator("#screen-openings .openings-card").first().waitFor({ state: "visible", timeout: 20000 });
    const cards = await page.locator("#screen-openings .openings-card").evaluateAll((nodes) => nodes.map((node) => `${node.dataset.color}|${node.dataset.family}`));
    assert.ok(cards.length >= 4, cards.join(", "));
    assert.ok(cards.includes("b|Sicilian Defense") && cards.some((c) => c.startsWith("w|")), cards.join(", "));
    const summary = await page.locator("#screen-openings .openings-summary").innerText();
    assert.ok(/TestUser/.test(summary) && /20 games/.test(summary), summary);
    const mistakes = await page.locator("#screen-openings .openings-fact.is-warn").count();
    assert.ok(mistakes >= 1, "the mistake the session confirmed is counted");
    await noSidewaysScroll(page, "desktop");
    await shot(page, "openings-03-screen", { fullPage: true });

    step("phone width");
    await page.setViewportSize({ width: 390, height: 844 });
    await noSidewaysScroll(page, "phone");
    const small = await page.locator("#screen-openings .openings-card button").evaluateAll((nodes) => nodes.filter((node) => node.getBoundingClientRect().height < 44).length);
    assert.strictEqual(small, 0, "every Train button is at least 44px tall");
    await shot(page, "openings-04-phone", { fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });

    step("a family's Train opens the wizard focused on it, with the download's provider and user");
    await page.locator('#screen-openings .openings-card[data-family="Sicilian Defense"] button').click();
    assert.strictEqual(await page.evaluate(() => Ludus.router.current()), "setup");
    const wizard = await page.evaluate(() => ({ focus: STATE.setupWizard.openings, user: document.getElementById("online-user-input").value }));
    assert.deepStrictEqual(wizard.focus, { family: "Sicilian Defense", color: "b" });
    assert.strictEqual(wizard.user, "TestUser");

    step("Spanish");
    await page.evaluate(() => Ludus.router.show("openings"));
    await page.evaluate(() => Ludus.i18n.setLanguage("es"));
    await page.locator("#screen-openings .openings-card").first().waitFor({ state: "visible" });
    assert.match(await page.locator("#screen-openings .openings-title").innerText(), /Cómo te va en la apertura/);
    assert.match(await page.locator("#screen-openings .openings-color").first().innerText(), /Con blancas/);

    if (problems.length) throw new Error(`problems:\n${problems.join("\n")}`);
    console.log("openings: ok");
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
