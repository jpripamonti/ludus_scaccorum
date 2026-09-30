// Browser end-to-end check of the game core: plays real sessions in Chromium
// against the real Stockfish Worker.
//
// Playwright is NOT a project dependency (the app has no runtime or dev
// dependencies) and this script is not part of `npm test`. Run it by hand:
//
//   python3 -m http.server 5010 &                      # serve the repo root
//   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/play-session.js
//
// Environment (all optional):
//   LUDUS_URL             page to test               (default http://127.0.0.1:5010/)
//   LUDUS_E2E_ONLY        "classic" or "own" to run only one scenario
//   LUDUS_CHROMIUM        chrome binary if Playwright cannot launch its own
//                         (falls back to /opt/pw-browsers/chromium-1194/chrome-linux/chrome)
//   LUDUS_E2E_SHOTS       directory for screenshots (none are saved when unset)
//
// Scenario "classic": first visit shows the landing page, its start button goes
// home; a session of classic positions is started with Ludus.game.startSession
// after `await Ludus.Classics.load()`; the best move is played by clicking
// squares and must score "You earned 10 / 10"; a hint costs 15%; a move outside
// the reference lines is searched and scored by its distance; the session ends
// with a summary and a "session:completed" record; an untimed session shows the
// infinity clock; a 5 second clock really times out; a duel is played on one
// device; the language switch updates the result; abort goes home.
//
// Scenario "own": the own-games flow (wizard with step 1 skipped -> download
// with consent -> mistake search -> rounds -> next search -> summary) with the
// Lichess request intercepted and answered from a PGN written here (the network
// is never touched), checking the facts carousel of the waiting screens.
//
// Both fail on any console error, uncaught page error or failed request.
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
const RESULT_TIMEOUT_MS = 60000;

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

function step(message) {
  console.log(`  - ${message}`);
}

async function shot(page, name) {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
}

// A fresh context per run, service workers blocked (the service worker is
// cache-first and would serve stale files), CSP enforced.
async function newSession(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "en-US",
    serviceWorkers: "block",
    bypassCSP: false,
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
  return { context, page, problems };
}

async function boot(page) {
  await page.goto(BASE_URL);
  await page.waitForFunction(() => window.Ludus && Ludus.game && typeof Ludus.game.startSession === "function");
}

// Collects the bus events the app announces, from the page.
async function collectEvents(page) {
  await page.evaluate(() => {
    window.__events = { started: [], rounds: [], completed: [] };
    Ludus.bus.on("session:started", (payload) => window.__events.started.push(payload.session));
    Ludus.bus.on("round:completed", (payload) => window.__events.rounds.push(payload.round));
    Ludus.bus.on("session:completed", (payload) => window.__events.completed.push(payload.session));
  });
}

const events = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__events)));
const evalState = (page, expression) => page.evaluate(`(${expression})`);
const square = (page, name) => page.locator(`#board .square[data-square="${name}"]`);

async function playUci(page, uci) {
  await square(page, uci.slice(0, 2)).click();
  await square(page, uci.slice(2, 4)).click();
  if (uci.length > 4) await page.locator(`#promotion-choice-${uci[4]}`).click();
}

async function waitForResult(page) {
  await page.waitForFunction(() => STATE.ui.phase === "result" && Boolean(STATE.resultView.context), null, { timeout: RESULT_TIMEOUT_MS });
}

async function resultContext(page) {
  return page.evaluate(() => JSON.parse(JSON.stringify(STATE.resultView.context)));
}

async function clickNext(page) {
  await page.locator("#next-btn").click();
}

function checkProblems(label, problems) {
  assert.deepStrictEqual(problems, [], `${label}: the page reported problems:\n  ${problems.join("\n  ")}`);
}

// ---------- scenario: classic ----------

async function classicScenario(browser) {
  console.log("scenario: classic games");
  const { context, page, problems } = await newSession(browser);
  try {
    await boot(page);
    await collectEvents(page);

    step("a first visit shows the landing page and its start button goes home");
    assert.strictEqual(await evalState(page, "Ludus.router.current()"), "landing");
    assert.strictEqual(await evalState(page, "document.body.dataset.screen"), "landing");
    await shot(page, "01-landing");
    await page.locator("#landing-start-btn").click();
    assert.strictEqual(await evalState(page, "Ludus.router.current()"), "home", "the start button no longer goes straight into the wizard");
    assert.strictEqual(await evalState(page, 'Ludus.storage.get("ludus.seen.v1", 0)'), 1);

    step("a session of classic positions starts through Ludus.game.startSession");
    const positions = await page.evaluate(async () => {
      await Ludus.Classics.load();
      const list = Ludus.Classics.list();
      const game = list[0];
      window.__positions = Ludus.Classics.positions(game.id, { count: 3 });
      await Ludus.game.startSession({ kind: "classic", title: `Classics: ${game.title.en}`, positions: window.__positions });
      return JSON.parse(JSON.stringify(window.__positions));
    });
    assert.strictEqual(positions.length, 3);
    assert.strictEqual(await evalState(page, "Ludus.router.current()"), "game");
    assert.strictEqual(await evalState(page, "Ludus.game.isActive()"), true);
    assert.ok((await page.locator("#session-title").textContent()).startsWith("Classics: "), "the session title is in the round bar");
    assert.strictEqual((await page.locator("#round-status").textContent()).trim(), "Position 1/3");
    assert.match(await page.locator("#solo-clock-value").textContent(), /^\d\d:\d\d$/);
    await shot(page, "02-classic-round");

    step("position 1: a hint marks the piece and costs 15%");
    const best1 = positions[0].reference.lines[0].uci;
    assert.strictEqual(await page.locator("#hint-btn").isDisabled(), false);
    assert.match(await page.locator("#hint-btn").textContent(), /15%/);
    await page.locator("#hint-btn").click();
    assert.strictEqual(await page.locator("#board .square.hint-from").count(), 1, "the piece to move is highlighted");
    assert.strictEqual(await page.locator("#board .square.hint-from").getAttribute("data-square"), best1.slice(0, 2));
    assert.ok((await page.locator("#solo-clock-announce").textContent()).includes(best1.slice(0, 2)), "and announced in words");
    assert.match(await page.locator("#hint-btn").textContent(), /35%/, "the button now says what the next level costs");
    await shot(page, "03-hint");
    await playUci(page, best1);
    await waitForResult(page);
    let context1 = await resultContext(page);
    assert.strictEqual(context1.assessment.points, 8.5, "the engine's best move after one hint");
    assert.strictEqual(context1.assessment.accuracy, 100);
    assert.strictEqual(context1.hintsUsed, 1);
    assert.strictEqual(context1.engine.source, "stockfish", "scored by the real engine, not the fallback");
    assert.match(await page.locator("#result-overlay-points").textContent(), /^You earned 8\.5 \/ 10$/);

    step("position 2: the best move without help is worth 10 points");
    await clickNext(page);
    const best2 = positions[1].reference.lines[0].uci;
    await playUci(page, best2);
    await waitForResult(page);
    const context2 = await resultContext(page);
    assert.strictEqual(context2.assessment.points, 10);
    assert.ok(["perfect", "great", "brilliant"].includes(context2.assessment.qualityCode), context2.assessment.qualityCode);
    assert.match(await page.locator("#result-overlay-points").textContent(), /^You earned 10 \/ 10$/);
    assert.ok(context2.lines.length >= 3 && context2.lines[0].evalText, "the lines carry their evaluation");
    assert.ok(context2.fact && context2.fact.text.en, "a curiosity is kept for the result panel");
    await shot(page, "04-result-perfect");

    step("the language switch redraws the result");
    await page.evaluate(() => Ludus.i18n.setLanguage("es"));
    assert.match(await page.locator("#result-overlay-points").textContent(), /^Sumaste 10 \/ 10$/);
    await page.evaluate(() => Ludus.i18n.setLanguage("en"));
    assert.match(await page.locator("#result-overlay-points").textContent(), /^You earned 10 \/ 10$/);

    step("position 3: a move outside the reference lines is searched and scored by its distance");
    await clickNext(page);
    const poor = await page.evaluate(() => {
      const position = STATE.positions[STATE.index];
      const known = position.reference.lines.map((line) => line.uci);
      const board = new Chess(position.fen);
      const moves = board.generateMoves().map((move) => moveToUci(move));
      // The last legal move of the list is rarely a good one.
      return moves.filter((uci) => !known.includes(uci)).pop();
    });
    await playUci(page, poor);
    await waitForResult(page);
    const context3 = await resultContext(page);
    assert.strictEqual(context3.assessment.needsEvaluation, false, "the move was searched, not estimated");
    assert.ok(context3.assessment.points < 10 && context3.assessment.points >= 0, `points ${context3.assessment.points}`);
    assert.notStrictEqual(context3.assessment.qualityCode, "perfect");
    assert.ok(Number.isFinite(context3.assessment.cpLoss));
    const notes = await page.locator("#round-result").textContent();
    assert.ok(notes && notes.trim().length > 0, "the result explains itself");

    step("the session ends with a summary and one session record");
    await clickNext(page);
    await page.waitForFunction(() => !document.querySelector("#session-summary-result").classList.contains("hidden"));
    const summary = await page.locator("#session-summary-result .summary-score-display").textContent();
    assert.match(summary, /\/ 30 pts$/);
    const log = await events(page);
    assert.strictEqual(log.started.length, 1);
    assert.strictEqual(log.rounds.length, 3);
    assert.strictEqual(log.completed.length, 1);
    const record = log.completed[0];
    assert.strictEqual(record.kind, "classic");
    assert.strictEqual(record.maxPoints, 30);
    assert.strictEqual(record.positions, 3);
    assert.strictEqual(record.roundIds.length, 3);
    assert.strictEqual(Math.round(record.points * 10) / 10, Math.round(log.rounds.reduce((sum, round) => sum + round.points, 0) * 10) / 10);
    log.rounds.forEach((round) => {
      assert.strictEqual(round.source, "classic");
      assert.ok(round.lines.length >= 1 && round.lines.length <= 3);
      assert.ok(round.timeSpentMs >= 0);
    });
    assert.strictEqual(log.rounds[0].hintsUsed, 1);
    const profile = await page.evaluate(() => ({ rounds: Ludus.Profile.rounds().length, sessions: Ludus.Profile.sessions().length, cards: Ludus.Profile.notebook.list().length }));
    assert.strictEqual(profile.rounds, 3, "Profile recorded the rounds through the bus");
    assert.strictEqual(profile.sessions, 1);
    assert.ok(profile.cards >= 1, "the weak answer became a notebook card");
    await shot(page, "05-summary");
    await page.locator("#summary-menu-btn").click();
    assert.strictEqual(await evalState(page, "Ludus.router.current()"), "home", "every back-to-start goes home");
    assert.strictEqual((await events(page)).completed.length, 1, "going back does not record the session again");

    step("an untimed session shows the infinity clock and never times out");
    await page.evaluate(() => Ludus.game.startSession({ kind: "classic", title: "Untimed", positions: window.__positions.slice(0, 1), options: { clock: { mode: "untimed" } } }));
    assert.strictEqual((await page.locator("#solo-clock-value").textContent()).trim(), "\u221E");
    await page.waitForTimeout(1500);
    assert.strictEqual(await evalState(page, "STATE.ui.phase"), "playing");
    await shot(page, "06-untimed");
    await page.evaluate(() => Ludus.game.abort());
    assert.strictEqual(await evalState(page, "Ludus.router.current()"), "home");
    assert.strictEqual(await evalState(page, "STATE.timer.intervalId === null"), true, "abort stops the clock");

    step("the last hint shows the move with an arrow and ends the round for zero points");
    await page.evaluate(() => Ludus.game.startSession({ kind: "classic", title: "Reveal", positions: window.__positions.slice(1, 2), options: { clock: { mode: "untimed" } } }));
    for (let level = 1; level <= 2; level += 1) await page.locator("#hint-btn").click();
    assert.strictEqual(await page.locator("#board .square.hint-to").count(), 1, "level 2 also marks the destination");
    assert.match(await page.locator("#hint-btn").textContent(), /0 pts/, "the button warns that the last level gives the move away");
    await page.locator("#hint-btn").click();
    await page.waitForFunction(() => document.querySelectorAll("#board-arrows line").length >= 1, null, { timeout: 5000 });
    await waitForResult(page);
    const revealed = await resultContext(page);
    assert.strictEqual(revealed.assessment.points, 0);
    assert.strictEqual(revealed.assessment.reason, "skip");
    assert.strictEqual(revealed.hintsUsed, 3);
    assert.match(await page.locator("#result-overlay-points").textContent(), /^Move revealed: 0 pts$/);
    assert.ok((await page.locator("#board-arrows line").count()) >= 1, "the arrow of the move stays in the result");
    await shot(page, "07-revealed");
    await page.evaluate(() => Ludus.game.abort());

    step("a 5 second clock times out for real");
    await page.evaluate(() => Ludus.game.startSession({ kind: "classic", title: "Timed", positions: window.__positions.slice(0, 1), options: { clock: { mode: "timed", seconds: 5 }, hints: false } }));
    assert.strictEqual(await page.locator("#hint-btn").isVisible(), false, "the session turned hints off");
    await waitForResult(page);
    const timedOut = (await events(page)).rounds.pop();
    assert.strictEqual(timedOut.timedOut, true);
    assert.strictEqual(timedOut.points, 0);
    assert.match(await page.locator("#result-overlay-points").textContent(), /^Time ran out: 0 pts\.$/);
    await page.evaluate(() => Ludus.game.abort());

    step("a duel on one device: both players are scored against the same reference");
    await page.evaluate(() => Ludus.game.startSession({ kind: "classic", title: "Duel", mode: "duel", names: ["Ana", "Beto"], positions: window.__positions.slice(0, 1), options: { clock: { mode: "untimed" } } }));
    await playUci(page, positions[0].reference.lines[0].uci);
    await page.waitForFunction(() => STATE.ui.phase === "handoff_ready");
    await page.locator("#handoff-overlay").click();
    const duelPoor = await page.evaluate(() => {
      const position = STATE.positions[STATE.index];
      const known = position.reference.lines.map((line) => line.uci);
      return new Chess(position.fen).generateMoves().map((move) => moveToUci(move)).filter((uci) => !known.includes(uci)).pop();
    });
    await playUci(page, duelPoor);
    await waitForResult(page);
    assert.match(await page.locator("#result-overlay-points").textContent(), /^R1: Ana 10 \u00B7 Beto \d/);
    const duelRounds = (await events(page)).rounds.slice(-2);
    assert.strictEqual(duelRounds.length, 2, "one record per player");
    assert.ok(duelRounds[0].points > duelRounds[1].points);
    await clickNext(page);
    await page.waitForFunction(() => !document.querySelector("#session-summary-result").classList.contains("hidden"));
    assert.match(await page.locator("#session-summary-result .summary-details-text").textContent(), /Winner: Ana/);
    await page.evaluate(() => Ludus.game.abort());

    step("no console errors, page errors or failed requests");
    checkProblems("classic", problems);
  } finally {
    await context.close();
  }
}

// ---------- scenario: own games ----------

// Games in which TestUser errs badly, so the mistake search always finds something
// (Scholar's mate, Fool's mate, a queen given away, the Legal trap). Sixteen copies
// (different events) so that no fallback download is asked for.
function buildPgn() {
  const bodies = [
    ["Rival", "TestUser", "1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0"],
    ["TestUser", "Rival", "1. f3 e5 2. g4 Qh4# 0-1"],
    ["TestUser", "Rival", "1. e4 e5 2. Qh5 Nc6 3. Qxe5+ Nxe5 4. d4 Nc6 5. d5 Nb8 6. Nc3 Nf6 0-1"],
    ["Rival", "TestUser", "1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0"],
  ];
  const games = [];
  for (let copy = 0; copy < 4; copy += 1) {
    bodies.forEach(([white, black, moves], index) => {
      const result = moves.slice(moves.lastIndexOf(" ") + 1);
      games.push([
        `[Event "E2E ${copy * 4 + index + 1}"]`, '[Site "https://lichess.org/e2e"]', '[Date "2024.05.05"]', '[Round "-"]',
        `[White "${white}"]`, `[Black "${black}"]`, `[Result "${result}"]`, '[TimeControl "600+0"]', "", moves, "",
      ].join("\n"));
    });
  }
  return `${games.join("\n")}\n`;
}

async function ownGamesScenario(browser) {
  console.log("scenario: own games");
  const { context, page, problems } = await newSession(browser);
  try {
    let lichessRequests = 0;
    await context.route("https://lichess.org/**", async (route) => {
      lichessRequests += 1;
      await route.fulfill({ status: 200, contentType: "application/x-chess-pgn", body: buildPgn() });
    });
    await context.route("https://api.chess.com/**", (route) => route.abort());

    await boot(page);
    await collectEvents(page);

    step("the wizard opens with the mode chosen: step 1 is skipped and the indicator is honest");
    await page.evaluate(() => Ludus.game.openOwnGamesSetup({ mode: "solo" }));
    assert.strictEqual(await evalState(page, "Ludus.router.current()"), "setup");
    assert.strictEqual((await page.locator("#wizard-step-indicator").textContent()).trim(), "Step 1 of 2");
    assert.strictEqual(await page.locator("#wizard-step-2").isVisible(), true);
    assert.strictEqual(await page.locator("#wizard-step-1").isVisible(), false);
    await shot(page, "10-wizard-step2");

    step("username, count, download with consent");
    await page.locator("#online-user-input").fill("TestUser");
    await page.locator("#wizard-next-btn").click();
    assert.strictEqual((await page.locator("#wizard-step-indicator").textContent()).trim(), "Step 2 of 2");
    await page.locator("#session-size").fill("2");
    await page.locator("#session-size").dispatchEvent("input");
    await page.evaluate(() => {
      window.__sawWizardFacts = false;
      window.__sawSearchFacts = false;
      new MutationObserver(() => {
        if (document.querySelector("#analysis-facts .rd-carousel")) window.__sawWizardFacts = true;
        if (document.querySelector("#position-search-facts .rd-carousel")) window.__sawSearchFacts = true;
      }).observe(document.body, { childList: true, subtree: true });
    });
    await page.locator("#analyze-btn").click();
    await page.locator("#consent-overlay-username-input").fill("TestUser");
    await page.locator("#consent-overlay-accept").click();
    await page.waitForFunction(() => Ludus.router.current() === "game", null, { timeout: 120000 });
    assert.ok(lichessRequests >= 1, "the games came from the (intercepted) provider request");
    assert.strictEqual(await evalState(page, "window.__sawWizardFacts"), true, "the wizard's waiting area showed the facts carousel");
    assert.strictEqual(await page.locator("#analysis-facts .rd-carousel").count(), 0, "and destroyed it when the wait was over");

    step("the first mistake is a session round with the same lifecycle");
    const started = (await events(page)).started;
    assert.strictEqual(started.length, 1);
    assert.strictEqual(started[0].kind, "own");
    assert.ok(started[0].title.includes("TestUser"), started[0].title);
    assert.strictEqual(await evalState(page, "STATE.positions[0].source"), "own");
    const first = await page.evaluate(() => ({ best: STATE.positions[0].bestMoveUci, game: STATE.positions[0].gameMoveUci, loss: STATE.positions[0].lossCp }));
    assert.ok(first.best && first.game && first.best !== first.game && first.loss >= 50, JSON.stringify(first));
    assert.strictEqual(await page.locator("#hint-btn").isDisabled(), false, "the mistake search found the best move: a hint is possible");
    await shot(page, "11-own-round");
    await playUci(page, first.best);
    await waitForResult(page);
    const ownContext = await resultContext(page);
    assert.strictEqual(ownContext.assessment.points, 10, "the engine's move is worth ten");
    assert.strictEqual(ownContext.master.uci, first.game, "the move of the game is shown for comparison");
    assert.strictEqual(ownContext.engine.source, "stockfish");
    assert.strictEqual(ownContext.engine.origin, "runtime", "one MultiPV analysis at the root was the reference");
    assert.ok(ownContext.lines.length >= 2, "MultiPV: several lines");

    step("next position: the search for the next mistake shows the carousel");
    await clickNext(page);
    await page.waitForFunction(() => STATE.index === 1 && STATE.ui.phase === "playing", null, { timeout: 120000 });
    assert.strictEqual(await evalState(page, "window.__sawSearchFacts"), true, "the search overlay showed the facts carousel");
    assert.strictEqual(await page.locator("#position-search-facts .rd-carousel").count(), 0, "and destroyed it");
    const second = await page.evaluate(() => STATE.positions[1].bestMoveUci);
    await playUci(page, second);
    await waitForResult(page);
    await clickNext(page);
    await page.waitForFunction(() => !document.querySelector("#session-summary-result").classList.contains("hidden"));
    const log = await events(page);
    assert.strictEqual(log.rounds.length, 2);
    log.rounds.forEach((round) => {
      assert.strictEqual(round.source, "own");
      assert.strictEqual(round.sessionKind, "own");
      assert.ok(round.masterUci && round.userUci);
    });
    assert.strictEqual(log.completed.length, 1);
    assert.strictEqual(log.completed[0].kind, "own");
    assert.strictEqual(log.completed[0].maxPoints, 20);
    await shot(page, "12-own-summary");
    await page.locator("#summary-menu-btn").click();
    assert.strictEqual(await evalState(page, "Ludus.router.current()"), "home");

    step("no console errors, page errors or failed requests");
    checkProblems("own games", problems);
  } finally {
    await context.close();
  }
}

// ---------- run ----------

(async () => {
  const browser = await launchBrowser();
  try {
    if (!ONLY || ONLY === "classic") await classicScenario(browser);
    if (!ONLY || ONLY === "own") await ownGamesScenario(browser);
    console.log("play-session passed");
  } catch (error) {
    console.error("play-session FAILED");
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
