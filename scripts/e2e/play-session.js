// Browser end-to-end check of the game core: plays real sessions in Chromium
// against the real Stockfish Worker.
//
// Playwright is NOT a project dependency (the app has no runtime or dev
// dependencies) and this script is not part of `npm test`. Run it by hand:
//
//   python3 -m http.server 5010 &                      # serve the repo root (or: node scripts/dev/serve.js 5010, which serves only the deployed files)
//   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/play-session.js
//
// Environment (all optional):
//   LUDUS_URL             page to test               (default http://127.0.0.1:5010/)
//   LUDUS_E2E_ONLY        "classic", "first", "own" or "terms" to run only one scenario
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
// Scenario "terms" (PF-1): a move that is not among the reference lines is searched to the depth of the best line (the
// position's own reference depth, or what the root search reached), under a time ceiling that is not shorter than the best
// line's, and never twice; the Worker commands are recorded by wrapping the Worker handed to Ludus.game.configureEngine.
//
// All fail on any console error, uncaught page error or failed request.
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
//
// The very first session of a profile has no clock and a how-to-play note (UX-027). The scenarios
// below are about the normal session, so the flag that says "the first session was played" is
// seeded before the page loads; the "first run" scenario leaves it out on purpose.
async function newSession(browser, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "en-US",
    serviceWorkers: "block",
    bypassCSP: false,
  });
  if (!options.firstRun) {
    await context.addInitScript(() => {
      try {
        if (window.localStorage.getItem("ludus.firstRun.v1") === null) window.localStorage.setItem("ludus.firstRun.v1", "1");
      } catch (error) {
        // Storage blocked: the scenario will say so.
      }
    });
  }
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
    assert.strictEqual((await page.locator("#round-status").textContent()).trim(), "Position 1 of 3");
    assert.match(await page.locator("#solo-clock-value").textContent(), /^\d\d:\d\d$/);
    await shot(page, "02-classic-round");

    step("position 1: a hint marks the piece and costs 15%");
    const best1 = positions[0].reference.lines[0].uci;
    assert.strictEqual(await page.locator("#hint-btn").isDisabled(), false);
    // The words of the button are its label; the icon and the cost chip around it are decoration.
    const hintLabel = () => page.locator("#hint-btn-label").textContent();
    assert.match(await hintLabel(), /15%/);
    await page.locator("#hint-btn").click();
    assert.strictEqual(await page.locator("#board .square.hint-from").count(), 1, "the piece to move is highlighted");
    assert.strictEqual(await page.locator("#board .square.hint-from").getAttribute("data-square"), best1.slice(0, 2));
    // The live region is emptied and refilled a moment later so that a repeated text is read again.
    await page.waitForFunction((from) => document.querySelector("#hint-announce").textContent.includes(from), best1.slice(0, 2), { timeout: 2000 });
    assert.match(await hintLabel(), /35%/, "the button now says what the next level costs");
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
    // RC-7: what the overlay of the evaluation says while the move is searched (the words it shows are recorded as they change).
    await page.evaluate(() => {
      window.__overlayWords = { meta: new Set(), progress: new Set() };
      const read = () => {
        const meta = document.getElementById("position-search-meta");
        const progress = document.getElementById("position-search-progress-label");
        if (meta && meta.textContent.trim()) window.__overlayWords.meta.add(meta.textContent.trim());
        if (progress && progress.textContent.trim()) window.__overlayWords.progress.add(progress.textContent.trim());
      };
      new MutationObserver(read).observe(document.getElementById("position-search-overlay"), { childList: true, subtree: true, characterData: true });
    });
    await playUci(page, poor);
    await waitForResult(page);
    const overlayWords = await page.evaluate(() => ({ meta: Array.from(window.__overlayWords.meta), progress: Array.from(window.__overlayWords.progress) }));
    assert.ok(overlayWords.meta.length >= 1, "the evaluation overlay said how long it takes");
    overlayWords.meta.forEach((words) => {
      assert.ok(/usually takes a few seconds/.test(words) && !/\d/.test(words), `no number of seconds is promised: "${words}"`);
    });
    overlayWords.progress.forEach((words) => assert.match(words, /^\d+% · \d+\.\d s$/, "the progress line has what has passed, no ceiling"));
    const context3 = await resultContext(page);
    assert.strictEqual(context3.assessment.needsEvaluation, false, "the move was searched, not estimated");
    assert.ok(context3.assessment.points < 10 && context3.assessment.points >= 0, `points ${context3.assessment.points}`);
    assert.notStrictEqual(context3.assessment.qualityCode, "perfect");
    assert.ok(Number.isFinite(context3.assessment.cpLoss));
    const notes = await page.locator("#round-result").textContent();
    assert.ok(notes && notes.trim().length > 0, "the result explains itself");
    assert.ok((await page.locator("#round-result .co-hero-verdict").textContent()).trim().length > 10, "with a verdict in words");

    step("the session ends with a summary and one session record, written at the last answer");
    assert.strictEqual((await events(page)).completed.length, 1, "the session is recorded when the last position is answered, not when the summary is opened");
    assert.match(await page.locator("#next-btn").textContent(), /Finish|See the summary|summary/i);
    await clickNext(page);
    await page.waitForFunction(() => !document.querySelector("#session-summary-result").classList.contains("hidden"));
    const summary = await page.locator("#session-summary-result .co-sum-stats").textContent();
    assert.match(summary, /\/ 30/, "the points against the points that were possible");
    assert.match(await page.locator("#result-overlay-points").textContent(), /\/ 30 pts/, "and the live region reads them");
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
    for (let level = 1; level <= 2; level += 1) {
      await page.locator("#hint-btn").click();
      await page.waitForTimeout(500); // taps closer than this are read as a double tap and ignored
    }
    assert.strictEqual(await page.locator("#board .square.hint-to").count(), 1, "level 2 also marks the destination");
    assert.match(await page.locator("#hint-btn-label").textContent(), /0 pts/, "the button warns that the last level gives the move away");
    await page.locator("#hint-btn").click();
    assert.strictEqual(await evalState(page, "STATE.hintsUsed"), 2, "the first tap on the last level only asks");
    assert.match(await page.locator("#hint-btn-label").textContent(), /[Tt]ap again/, "and says so");
    await page.waitForTimeout(500);
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
    // The first position starts covered, like every duel position (PF-2): Ana goes first, and the tap starts her clock.
    await page.waitForFunction(() => STATE.ui.phase === "duel_ready");
    assert.match(await page.locator("#handoff-overlay-title").textContent(), /^Ana, get ready$/);
    await page.locator("#handoff-overlay").click();
    await page.waitForFunction(() => STATE.ui.phase === "playing");
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
    assert.match(await page.locator("#session-summary-result .co-sum-title").textContent(), /Ana/, "the winner is the headline of the summary");
    assert.match(await page.locator("#result-overlay-points").textContent(), /Winner: Ana/);
    await page.evaluate(() => Ludus.game.abort());

    step("no console errors, page errors or failed requests");
    checkProblems("classic", problems);
  } finally {
    await context.close();
  }
}

// ---------- scenario: first run ----------

// UX-027: the very first session of a profile has no clock and says how to play; it ends with the
// first answered round, and the next session is timed again.
async function firstRunScenario(browser) {
  console.log("scenario: first run");
  const { context, page, problems } = await newSession(browser, { firstRun: true });
  try {
    await boot(page);
    await collectEvents(page);
    const positions = await page.evaluate(async () => {
      await Ludus.Classics.load();
      const game = Ludus.Classics.list()[0];
      window.__positions = Ludus.Classics.positions(game.id, { count: 2 });
      return JSON.parse(JSON.stringify(window.__positions));
    });

    step("the first session has no clock and a how-to-play note at the top of the panel");
    await page.evaluate(() => Ludus.game.startSession({ kind: "classic", title: "First", positions: window.__positions }));
    assert.strictEqual((await page.locator("#solo-clock-value").textContent()).trim(), "\u221E");
    assert.strictEqual(await page.locator("#coach-thinking .co-first-run").count(), 1, "the note is there");
    assert.match(await page.locator("#coach-thinking .co-first-run").textContent(), /Tap a piece/);
    await shot(page, "08-first-run");
    await playUci(page, positions[0].reference.lines[0].uci);
    await waitForResult(page);
    assert.strictEqual(await evalState(page, 'Ludus.storage.get("ludus.firstRun.v1", 0)'), 1, "the first answered round ends the first run");
    await page.evaluate(() => Ludus.game.abort());

    step("the next session is timed again and has no note");
    await page.evaluate(() => Ludus.game.startSession({ kind: "classic", title: "Second", positions: window.__positions.slice(0, 1) }));
    assert.match(await page.locator("#solo-clock-value").textContent(), /^\d\d:\d\d$/);
    assert.strictEqual(await page.locator("#coach-thinking .co-first-run").count(), 0);
    await page.evaluate(() => Ludus.game.abort());

    checkProblems("first run", problems);
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
    // RC-2 / RC-3: the duel's name fields take what a profile's name may have and start from the neutral default of the language.
    assert.deepStrictEqual(await page.evaluate(() => ["duel-player-a", "duel-player-b"].map((id) => [document.getElementById(id).getAttribute("maxlength"), document.getElementById(id).value])), [["24", "Player 1"], ["24", "Player 2"]]);
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
    // RC-4: the consent says what the profile keeps of the person's own games, like the landing's privacy card.
    await page.locator("#consent-overlay-username-input").waitFor({ state: "visible" });
    const consentText = await page.locator("#consent-overlay-body").textContent();
    assert.ok(/players' names and the link to each game/.test(consentText) && /Account/.test(consentText), `the consent names what the profile keeps: "${consentText}"`);
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

// ---------- scenario: terms (PF-1) ----------

// A move that is not among the reference lines is judged on the best line's terms: it is searched to the depth the best
// line reached (the position's own reference, or what the root search got to), with a time ceiling that is not shorter
// than the best line's, and never searched twice. The real Stockfish Worker runs; its commands are recorded by wrapping the
// Worker the page hands to the engine (Ludus.game.configureEngine, the hook the tests use).
function parseGo(line) {
  const movetime = /\bmovetime (\d+)/.exec(line);
  const depth = /\bdepth (\d+)/.exec(line);
  const index = line.indexOf(" searchmoves ");
  return { movetime: movetime ? Number(movetime[1]) : null, depth: depth ? Number(depth[1]) : null, searchmoves: index >= 0 ? line.slice(index + 13).split(" ") : null };
}

async function termsScenario(browser) {
  console.log("scenario: the learner's move is judged on the best line's terms");
  const { context, page, problems } = await newSession(browser);
  try {
    await boot(page);
    await collectEvents(page);
    await page.evaluate(() => {
      window.__uci = [];
      Ludus.game.configureEngine({
        minEvalVisibleMs: 0,
        createTransport: () => {
          const worker = new Worker("vendor/stockfish-18-lite-single.js");
          const post = worker.postMessage.bind(worker);
          worker.postMessage = (line) => {
            window.__uci.push(String(line));
            post(line);
          };
          return worker;
        },
      });
    });
    const gos = () => page.evaluate(() => window.__uci.filter((line) => line.startsWith("go")));
    const searchesOf = async (uci) => (await gos()).map(parseGo).filter((go) => go.searchmoves && go.searchmoves[0] === uci).length;
    const timeIt = async (action) => {
      const started = Date.now();
      await action();
      await waitForResult(page);
      return Date.now() - started;
    };

    step("a classic position (best line searched offline to depth 18): the move outside its lines is searched to depth 18");
    const positions = await page.evaluate(async () => {
      await Ludus.Classics.load();
      window.__positions = Ludus.Classics.positions(Ludus.Classics.list()[0].id, { count: 2 });
      return JSON.parse(JSON.stringify(window.__positions));
    });
    await page.evaluate(() => Ludus.game.startSession({ kind: "classic", title: "Terms", positions: window.__positions.slice(0, 1), options: { clock: { mode: "untimed" } } }));
    await page.waitForFunction(() => STATE.engine.ready === true, null, { timeout: 60000 });
    const poor = await page.evaluate(() => {
      const position = STATE.positions[STATE.index];
      const known = position.reference.lines.map((line) => line.uci);
      return new Chess(position.fen).generateMoves().map((move) => moveToUci(move)).filter((uci) => !known.includes(uci)).pop();
    });
    const referenceDepth = positions[0].reference.depth;
    const classicMs = await timeIt(() => playUci(page, poor));
    const classicMove = (await gos()).map(parseGo).find((go) => go.searchmoves && go.searchmoves[0] === poor);
    assert.ok(classicMove, "the move was searched");
    assert.strictEqual(classicMove.depth, referenceDepth, "to the depth of the best line");
    assert.ok(classicMove.movetime >= 700 && classicMove.movetime <= 3500, `with a ceiling (${classicMove.movetime} ms), not a fixed time`);
    const classicContext = await resultContext(page);
    assert.strictEqual(classicContext.assessment.needsEvaluation, false);
    assert.strictEqual(classicContext.engine.source, "stockfish");
    step(`  searched to depth ${classicMove.depth} under a ${classicMove.movetime} ms ceiling; the answer was scored ${classicMs} ms after the move`);
    await page.evaluate(() => Ludus.game.abort());

    step("a position with no lines of its own: the best line gets a MultiPV search, the move the depth that search reached");
    const italian = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
    await page.evaluate((fen) => Ludus.game.startSession({ kind: "classic", title: "No lines", positions: [{ fen, source: "classic" }], options: { clock: { mode: "untimed" } } }), italian);
    await page.waitForFunction(() => STATE.engine.ready === true, null, { timeout: 60000 });
    const ownMs = await timeIt(() => playUci(page, "h2h3"));
    const log = (await gos()).map(parseGo);
    const root = log.find((go) => !go.searchmoves && go.depth === null);
    const move = log.find((go) => go.searchmoves && go.searchmoves[0] === "h2h3");
    const ownContext = await resultContext(page);
    assert.ok(root && move, "the best line and the move were both searched");
    assert.strictEqual(move.depth, ownContext.engine.depth, "the move is searched to the depth the best line reached");
    assert.ok(move.depth >= 8, `a real depth (${move.depth})`);
    assert.ok(move.movetime >= root.movetime && move.movetime <= 3500, `a ceiling that is not below the best line's time (${move.movetime} against ${root.movetime})`);
    assert.strictEqual(ownContext.assessment.needsEvaluation, false);
    step(`  the best line: ${root.movetime} ms (reached depth ${ownContext.engine.depth}); the move: depth ${move.depth} under a ${move.movetime} ms ceiling; scored ${ownMs} ms after the move`);
    await page.evaluate(() => Ludus.game.abort());

    step("the same position and move in another session are not searched again");
    const before = await searchesOf("h2h3");
    const rootsBefore = (await gos()).map(parseGo).filter((go) => !go.searchmoves).length;
    await page.evaluate((fen) => Ludus.game.startSession({ kind: "classic", title: "Again", positions: [{ fen, source: "classic" }], options: { clock: { mode: "untimed" } } }), italian);
    await page.waitForFunction(() => STATE.engine.ready === true, null, { timeout: 60000 });
    const againMs = await timeIt(() => playUci(page, "h2h3"));
    assert.strictEqual(await searchesOf("h2h3"), before, "no second search of the move");
    assert.strictEqual((await gos()).map(parseGo).filter((go) => !go.searchmoves).length, rootsBefore, "nor of the best line");
    step(`  scored ${againMs} ms after the move (from the cache; the first time took ${ownMs} ms)`);
    await page.evaluate(() => Ludus.game.abort());

    step("no console errors, page errors or failed requests");
    checkProblems("terms", problems);
  } finally {
    await context.close();
  }
}

// ---------- run ----------

(async () => {
  const browser = await launchBrowser();
  try {
    if (!ONLY || ONLY === "classic") await classicScenario(browser);
    if (!ONLY || ONLY === "first") await firstRunScenario(browser);
    if (!ONLY || ONLY === "own") await ownGamesScenario(browser);
    if (!ONLY || ONLY === "terms") await termsScenario(browser);
    console.log("play-session passed");
  } catch (error) {
    console.error("play-session FAILED");
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
