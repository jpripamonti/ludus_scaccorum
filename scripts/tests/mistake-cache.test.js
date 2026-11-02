"use strict";

// The mistake search over the person's own games (app.js): the verdicts it reaches are kept per game, ply and
// detection settings, next to the downloaded games in IndexedDB, so a later session over the same games does not
// search them again; a change of settings starts from nothing; "Clear saved game data" forgets them. Games the
// server analysed ([%eval] comments, Lichess evals=true) pick their candidates from those evals; games without
// evals keep the engine screening.
//
// The engine is a stub of analyzePosition that knows which positions hold a mistake and counts every search; the
// IndexedDB is the in-memory one of ./_fakeidb.js, shared between two loads of the app (a reload of the page).
//
//   node scripts/tests/mistake-cache.test.js

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { load, localScripts } = require("./_load.js");
const { createFakeDom } = require("./_fakedom.js");
const { createFakeIndexedDB } = require("./_fakeidb.js");

const DB = "ludus.remotePgnCache.v1";

// Ana (White) blunders on 4.Ng5 (ply 6) and, worse, on 8.Nxf7 (ply 14); every other move of hers is fine.
const MOVES = "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. d4 exd4 7. O-O Be7 8. Nxf7 Kxf7";
const SAN = MOVES.replace(/\d+\.\s*/g, "").split(/\s+/);
const BLUNDER_PLIES = [6, 14];
// What Lichess writes after each move with evals=true (White's point of view).
const EVALS = ["0.3", "0.3", "0.3", "0.3", "0.25", "0.3", "-1.2", "-1.2", "-1.3", "-1.3", "-1.4", "-1.4", "-1.5", "-1.5", "#-5", "#-4"];

function pgn({ date = "2024.01.01", site = "https://lichess.org/abcd1234", evals = false } = {}) {
  const tokens = [];
  SAN.forEach((san, ply) => {
    if (ply % 2 === 0) tokens.push(`${ply / 2 + 1}.`);
    else if (evals) tokens.push(`${(ply - 1) / 2 + 1}...`);
    tokens.push(san);
    if (evals) tokens.push(`{ [%eval ${EVALS[ply]}] [%clk 0:03:00] }`);
  });
  return [
    "[Event \"Rated blitz game\"]",
    `[Site "${site}"]`,
    `[Date "${date}"]`,
    "[White \"Ana\"]",
    "[Black \"Rival\"]",
    "[Result \"*\"]",
    "",
    `${tokens.join(" ")} *`,
    "",
  ].join("\n");
}

function loadApp(indexedDB, dom = createFakeDom({ languages: ["en"] })) {
  const uiScripts = localScripts().filter((script) => script.startsWith("js/ui/"));
  const env = load({
    dom,
    console: { log() {}, info() {}, debug() {}, warn() {}, error: console.error },
    app: false,
    skip: uiScripts,
    globals: { requestAnimationFrame: (fn) => setTimeout(fn, 0), indexedDB },
  });
  const Ludus = env.context.Ludus;
  Ludus.ui = {};
  Ludus.Screens = {};
  Ludus.shell = { mount() {} };
  ["home", "classics", "notebook", "progress", "museum", "settings", "account"].forEach((name) => {
    Ludus.Screens[name] = { mount(container) { container.appendChild(dom.document.createElement("div")); }, show() {}, hide() {} };
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "app.js"), "utf8"), env.context, { filename: "app.js" });
  return env;
}

// The positions before each of Ana's moves and the move she played there.
function plyInfo(env) {
  const { Chess, sanToMove, moveToUci } = env.context.Ludus.chess;
  const chess = new Chess();
  const out = [];
  SAN.forEach((san) => {
    const move = sanToMove(san, chess);
    out.push({ fen: chess.fen(), uci: moveToUci(move), legal: chess.generateMoves().map(moveToUci) });
    chess.makeMove(move);
  });
  return out;
}

// The stub engine: in a blunder position the best move is +300 and the played one -200; anywhere else the played
// move is 10 cp behind the best. Counts the screening searches (noCache) and the confirming ones.
function installEngine(env) {
  const plies = plyInfo(env);
  const blunders = new Map(BLUNDER_PLIES.map((ply) => [plies[ply].fen, plies[ply]]));
  const calls = { screening: 0, confirming: 0, fens: [] };
  const line = (uci, value, depth, multipv = 1) => ({ multipv, depth, score: { type: "cp", value }, pv: [uci] });
  env.context.engineSourceName = () => "stockfish";
  env.context.analyzePosition = async (fen, options = {}) => {
    if (options.noCache) calls.screening += 1;
    else calls.confirming += 1;
    calls.fens.push(fen);
    const info = plies.find((entry) => entry.fen === fen);
    const blunder = blunders.get(fen);
    const best = blunder ? blunder.legal.find((uci) => uci !== blunder.uci) : info.legal.find((uci) => uci !== info.uci);
    const depth = options.noCache ? 8 : 14;
    if (options.searchMoves && options.searchMoves.length) {
      return { lines: [line(options.searchMoves[0], blunder ? -200 : 20, depth)], source: "stockfish", depth, aborted: false };
    }
    return { lines: [line(best, blunder ? 300 : 30, depth)], source: "stockfish", depth, aborted: false };
  };
  return calls;
}

// A whole session's search, as the pipeline runs it: the context, then searches until nothing is left.
async function runSession(env, text, config = { moveTimeMs: 250, thresholdCp: 80 }) {
  env.context.getActivePgnTextSources = async () => [{ name: "games.pgn", text, username: "Ana" }];
  const ctx = await env.context.loadCandidateAnalysisContext(config);
  assert.ok(ctx, "a search context");
  const found = [];
  let firstAfterCalls = null;
  const calls = env.calls;
  for (let guard = 0; guard < 50; guard += 1) {
    const mistake = await env.context.searchNextMistake(ctx);
    if (!mistake) break;
    if (firstAfterCalls === null) firstAfterCalls = calls.screening + calls.confirming;
    found.push(mistake);
  }
  await env.context.flushMistakeVerdicts();
  return { ctx, found, firstAfterCalls };
}

function freshApp(indexedDB) {
  const env = loadApp(indexedDB);
  env.calls = installEngine(env);
  return env;
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test("a second session over the same games searches nothing: confirmed mistakes come back with their analysis, cleared moves are skipped", async () => {
  const idb = createFakeIndexedDB();
  const first = freshApp(idb);
  const one = await runSession(first, pgn());
  assert.deepStrictEqual(one.found.map((m) => m.gameMoveSan).sort(), ["Ng5", "Nxf7"], "the two mistakes are found");
  assert.ok(first.calls.screening >= 8, `every move of Ana's is screened (${first.calls.screening} searches)`);
  assert.strictEqual(first.calls.confirming, 4, "each mistake is confirmed (root + the played move)");
  const stored = idb.dump(DB, "verdicts");
  assert.strictEqual(stored.length, 8, "a verdict for each of Ana's 8 moves");
  assert.strictEqual(stored.filter((entry) => entry.verdict === "mistake").length, 2);
  assert.ok(stored.every((entry) => entry.verdict === "mistake" || !entry.data), "a cleared move keeps no numbers, only its verdict");
  assert.ok(stored.filter((entry) => entry.verdict === "mistake").every((entry) => entry.data.lines.length && entry.data.depth === 14), "a mistake keeps the confirming analysis, not the screening");

  // The page is loaded again (a new session another day): the verdicts come from IndexedDB.
  const second = freshApp(idb);
  const two = await runSession(second, pgn());
  assert.strictEqual(second.calls.screening + second.calls.confirming, 0, "no engine search at all");
  assert.strictEqual(two.ctx.candidates.length, 2, "only the known mistakes are left to serve");
  assert.strictEqual(two.ctx.queueStats.knownClean, 6);
  assert.deepStrictEqual(two.found.map((m) => m.gameMoveSan).sort(), ["Ng5", "Nxf7"]);
  const byMove = (list) => Object.fromEntries(list.map((m) => [m.gameMoveSan, m]));
  const a = byMove(one.found);
  const b = byMove(two.found);
  for (const san of ["Ng5", "Nxf7"]) {
    assert.strictEqual(b[san].fen, a[san].fen);
    assert.strictEqual(b[san].bestMoveUci, a[san].bestMoveUci);
    assert.strictEqual(b[san].lossPct, a[san].lossPct);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(b[san].reference)), JSON.parse(JSON.stringify(a[san].reference)), "the same reference analysis");
  }
});

test("a change of the detection settings starts from nothing", async () => {
  const idb = createFakeIndexedDB();
  await runSession(freshApp(idb), pgn());
  const threshold = freshApp(idb);
  await runSession(threshold, pgn(), { moveTimeMs: 250, thresholdCp: 150 });
  assert.ok(threshold.calls.screening >= 8, "another sensitivity screens again");
  const time = freshApp(idb);
  await runSession(time, pgn(), { moveTimeMs: 600, thresholdCp: 80 });
  assert.ok(time.calls.screening >= 8, "another screening time screens again");
  const budget = freshApp(idb);
  budget.context.Ludus.Settings.set("engine.multiPv", 5);
  await runSession(budget, pgn());
  assert.ok(budget.calls.screening >= 8, "another budget of the confirming analysis screens again");
  // ...and the original settings still find theirs.
  const same = freshApp(idb);
  await runSession(same, pgn());
  assert.strictEqual(same.calls.screening + same.calls.confirming, 0);
  // Another game (same moves, another day) is another game.
  const other = freshApp(idb);
  await runSession(other, pgn({ date: "2024.02.02", site: "https://lichess.org/zzzz9999" }));
  assert.ok(other.calls.screening >= 8);
});

test("\"Clear saved game data\" forgets the verdicts, in IndexedDB and in the tab; not keeping downloads keeps them only in the tab", async () => {
  const idb = createFakeIndexedDB();
  const env = freshApp(idb);
  await runSession(env, pgn());
  idb.seed(DB, 2, "pgn", [{ key: "lichess|ana|x", fetchedAt: Date.now(), source: { text: "x" } }]);
  assert.ok(idb.dump(DB, "verdicts").length > 0);
  await env.context.Ludus.game.savedDownloads.clear();
  assert.strictEqual(idb.dump(DB, "verdicts").length, 0, "nothing left in IndexedDB");
  assert.strictEqual(idb.dump(DB, "pgn").length, 0, "with the games");
  env.calls.screening = 0;
  await runSession(env, pgn());
  assert.ok(env.calls.screening >= 8, "the same tab searches again");

  const idb2 = createFakeIndexedDB();
  const keepNothing = freshApp(idb2);
  keepNothing.context.Ludus.game.savedDownloads.setKeep(false);
  await runSession(keepNothing, pgn());
  assert.strictEqual(idb2.dump(DB, "verdicts").length, 0, "not written when downloads are not kept");
  keepNothing.calls.screening = 0;
  keepNothing.calls.confirming = 0;
  await runSession(keepNothing, pgn());
  assert.strictEqual(keepNothing.calls.screening + keepNothing.calls.confirming, 0, "but this tab still remembers them");
});

test("a game with the server's evals: only the moves the evals flag are confirmed, biggest loss first, no screening", async () => {
  const env = freshApp(createFakeIndexedDB());
  const { ctx, found, firstAfterCalls } = await runSession(env, pgn({ evals: true }));
  const game = ctx.games[0];
  assert.strictEqual(game.evals.length, SAN.length, "one eval per ply");
  // Ply 0 has no eval before it: that one move falls back to the engine screening.
  assert.strictEqual(ctx.queueStats.evalCandidates, 2);
  assert.strictEqual(ctx.queueStats.evalCleared, 5);
  assert.deepStrictEqual(Array.from(ctx.candidates.slice(0, 2), (c) => c.ply), [14, 6], "the bigger loss first");
  assert.ok(ctx.candidates[0].evalLossPct > ctx.candidates[1].evalLossPct);
  assert.strictEqual(ctx.candidates[2].ply, 0);
  assert.strictEqual(ctx.candidates[2].evalLossPct, undefined);
  assert.strictEqual(firstAfterCalls, 2, "the first position costs one confirmation (root + played move), no screening");
  assert.deepStrictEqual(Array.from(found, (m) => m.gameMoveSan), ["Nxf7", "Ng5"]);
  assert.ok(found.every((m) => m.reference && m.reference.depth === 14), "scored against our own analysis");
  assert.strictEqual(env.calls.screening, 2, "only 1.e4 is screened (best + played)");
  assert.strictEqual(env.calls.confirming, 4);
});

test("an eval the engine does not confirm is dropped; a game without evals keeps today's screening", async () => {
  // The evals say 3.Bc4 lost a lot; the engine disagrees.
  const misleading = pgn({ evals: true }).replace("Bc4 { [%eval 0.25]", "Bc4 { [%eval -2.5]").replace("Nf6 { [%eval 0.3]", "Nf6 { [%eval -2.5]");
  const env = freshApp(createFakeIndexedDB());
  const { ctx, found } = await runSession(env, misleading);
  assert.ok(ctx.candidates.some((c) => c.ply === 4 && Number.isFinite(c.evalLossPct)), "3.Bc4 is an eval candidate");
  assert.ok(!found.some((m) => m.gameMoveSan === "Bc4"), "and is not served");

  const plain = freshApp(createFakeIndexedDB());
  const run = await runSession(plain, pgn());
  assert.strictEqual(run.ctx.games[0].evals, undefined, "no evals in the game");
  assert.ok(run.ctx.candidates.every((c) => c.evalLossPct === undefined));
  assert.strictEqual(run.ctx.candidates.length, 8, "every move of Ana's is a candidate");
  assert.ok(plain.calls.screening >= 8);
});

(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ok  ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`  FAIL ${name}\n${error && error.stack ? error.stack : error}`);
    }
  }
  if (failed) {
    console.error(`mistake-cache.test.js: ${failed} failed`);
    process.exit(1);
  }
  console.log(`mistake-cache.test.js passed (${tests.length} tests)`);
  process.exit(0);
})();
