"use strict";

// "Your openings": Ludus.Openings (js/openings.js) over the bundled Lichess dataset (js/data/openings.data.js), the
// openings session of the own-games pipeline (app.js: the mistake search restricted to the opening phase, of one
// family and colour; the positions carry the opening and the book moves for the coach), the report the openings
// screen draws (app.js ownOpeningsReport, from the saved download and the mistake verdicts) and the screen itself
// (js/ui/openings.js).
//
//   node scripts/tests/openings.test.js

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { load, localScripts } = require("./_load.js");
const { createFakeDom, createFakeLocalStorage } = require("./_fakedom.js");
const { createFakeIndexedDB } = require("./_fakeidb.js");
const { FakeDocument, findAll, byClass } = require("./_uidom.js");

const repoRoot = path.resolve(__dirname, "..", "..");
require(path.join(repoRoot, "js", "ludus.js"));
require(path.join(repoRoot, "js", "chess.js"));
const Openings = require(path.join(repoRoot, "js", "openings.js"));
const { Chess, sanToMove } = globalThis.Ludus.chess;

const sans = (text) => text.split(/\s+/).filter(Boolean);

// Ana's games. A: Ana has White, an Italian Game (Moeller attack); her mistakes are on move 11 (ply 20, opening phase)
// and move 15 (ply 28, after it). B: Ana has Black, a Sicilian Najdorf; her mistake is 6...e5 (ply 11).
const GAME_A = sans("e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Nc3 Nxe4 O-O Bxc3 d5 Bf6 Re1 Ne7 Rxe4 d6 Bg5 Bxg5 Nxg5 h6 Qe2 hxg5 Re1 Be6 dxe6 f6");
const GAME_B = sans("e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O");
const BLUNDERS = [{ game: GAME_A, ply: 20 }, { game: GAME_A, ply: 28 }, { game: GAME_B, ply: 11 }];

function pgnOf(moves, { white, black, result, site }) {
  const tokens = [];
  moves.forEach((san, ply) => {
    if (ply % 2 === 0) tokens.push(`${ply / 2 + 1}.`);
    tokens.push(san);
  });
  return [
    "[Event \"Rated blitz game\"]",
    `[Site "${site}"]`,
    "[Date \"2026.10.01\"]",
    `[White "${white}"]`,
    `[Black "${black}"]`,
    `[Result "${result}"]`,
    "",
    `${tokens.join(" ")} ${result}`,
    "",
  ].join("\n");
}

const PGN = [
  pgnOf(GAME_A, { white: "Ana", black: "Rival", result: "1-0", site: "https://lichess.org/aaaa1111" }),
  pgnOf(GAME_B, { white: "Otro", black: "Ana", result: "0-1", site: "https://lichess.org/bbbb2222" }),
].join("\n");

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// ---------------------------------------------------------------- the module

test("the data file is what scripts/build-openings.js makes of data/openings/ (no stale or hand-edited data)", () => {
  const { buildData, render, OUT_FILE } = require(path.join(repoRoot, "scripts", "build-openings.js"));
  assert.strictEqual(fs.readFileSync(OUT_FILE, "utf8"), render(buildData()), "run node scripts/build-openings.js");
});

test("positionKey: move counters do not count, and an en passant square only when a capture en passant is possible", async () => {
  const play = (moves) => {
    const chess = new Chess();
    sans(moves).forEach((san) => chess.makeMove(sanToMove(san, chess)));
    return chess.fen();
  };
  // 1.d4 Nf6 2.c4 (en passant square c3 in the FEN) and 1.c4 Nf6 2.d4 (d3): the same position.
  const a = play("d4 Nf6 c4");
  const b = play("c4 Nf6 d4");
  assert.notStrictEqual(a, b, "the FENs differ");
  assert.strictEqual(Openings.positionKey(a), Openings.positionKey(b));
  assert.ok(/ - $/.test(Openings.positionKey(a)) || / -$/.test(Openings.positionKey(a)));
  // A capture en passant that is possible keeps its square.
  const ep = play("e4 a6 e5 d5");
  assert.ok(/ d6$/.test(Openings.positionKey(ep)), Openings.positionKey(ep));
});

test("classifyGame: the deepest named position, the ply where the game left the book and who left it", async () => {
  await Openings.load();
  assert.ok(Openings.count() > 3800, "the whole dataset");
  const a = Openings.classifyGame({ sanMoves: GAME_A });
  assert.strictEqual(a.family, "Italian Game");
  assert.ok(/^Italian Game: Classical Variation/.test(a.name), a.name);
  assert.strictEqual(a.eco, "C54");
  assert.strictEqual(a.leftPly, 25, "13...hxg5 is the first move off the book");
  assert.strictEqual(a.leftBy, "b");
  const italian = Openings.classifyGame({ sanMoves: sans("e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 a3 h6") });
  assert.strictEqual(italian.leftPly, 10, "6.a3 leaves it");
  assert.strictEqual(italian.leftBy, "w");
  assert.strictEqual(italian.name, "Italian Game: Classical Variation, Center Attack");
  // A game that never leaves the book in its moves.
  assert.strictEqual(Openings.classifyGame({ sanMoves: sans("e4 c5") }).leftPly, -1);
  // Not from the initial position, or nothing legal: no name.
  assert.strictEqual(Openings.classifyGame({ startFen: "8/8/8/8/8/8/8/K6k w - - 0 1", sanMoves: ["Kb1"] }), null);
  assert.strictEqual(Openings.classifyGame({ sanMoves: ["Ke2"] }), null);
});

test("classifyGame: a transposition finds the same name (another move order to the Nimzo-Indian)", async () => {
  await Openings.load();
  const usual = Openings.classifyGame({ sanMoves: sans("d4 Nf6 c4 e6 Nc3 Bb4 a3") });
  const other = Openings.classifyGame({ sanMoves: sans("c4 e6 Nc3 Nf6 d4 Bb4 a3") });
  assert.strictEqual(usual.name, "Nimzo-Indian Defense: Sämisch Variation");
  assert.strictEqual(other.name, usual.name);
  assert.strictEqual(other.leftPly, -1, "every position of the other order is in the book too");
  // Through a position no line passes, back into a named one: 1.Nf3 d5 2.d4 is the Queen's Pawn Game.
  const reti = Openings.classifyGame({ sanMoves: sans("Nf3 d5 d4 Nf6 c4 e6 Nc3 Be7") });
  assert.strictEqual(reti.family, "Queen's Gambit Declined");
});

test("continuations: the legal moves that stay in the book, named ones first, with what they lead to", async () => {
  await Openings.load();
  const chess = new Chess();
  sans("e4 e5 Nf3 Nc6 Bc4 Bc5").forEach((san) => chess.makeMove(sanToMove(san, chess)));
  const here = Openings.entry(chess.fen());
  assert.strictEqual(here.name, "Italian Game: Giuoco Piano");
  const moves = Openings.continuations(chess.fen());
  const bySan = Object.fromEntries(moves.map((m) => [m.san, m]));
  assert.strictEqual(bySan.c3.name, "Italian Game: Classical Variation");
  assert.strictEqual(bySan.b4.name, "Italian Game: Evans Gambit");
  assert.strictEqual(bySan.d3.name, "Italian Game: Giuoco Pianissimo");
  assert.ok(moves.every((m) => /^[a-h][1-8][a-h][1-8]/.test(m.uci)));
  const firstUnnamed = moves.findIndex((m) => !m.name);
  assert.ok(firstUnnamed === -1 || moves.slice(firstUnnamed).every((m) => !m.name), "named ones first");
  assert.ok(!bySan.a3, "a move off the book is not listed");
  // Out of the book there is nothing to list; bookContext says where the game left it.
  chess.makeMove(sanToMove("a3", chess));
  assert.deepStrictEqual(Openings.continuations(chess.fen()), []);
  const context = Openings.bookContext(chess.fen(), { eco: "C50", name: "Italian Game: Giuoco Piano", leftPly: 6, leftBy: "w" });
  assert.strictEqual(context.inBook, false);
  assert.strictEqual(context.leftMove, 4);
  assert.strictEqual(context.name, "Italian Game: Giuoco Piano");
});

test("groupByFamily: by family and colour, results, early mistakes and the move where the book most often ends", () => {
  const op = (family, rest, leftPly, leftBy) => ({ eco: "X00", name: rest ? `${family}: ${rest}` : family, family, leftPly, leftBy });
  const groups = Openings.groupByFamily([
    { color: "w", result: "win", opening: op("Italian Game", "Giuoco Piano", 8, "w"), earlyMistakes: 1 },
    { color: "w", result: "loss", opening: op("Italian Game", "Two Knights Defense", 8, "b"), earlyMistakes: 2 },
    { color: "w", result: "draw", opening: op("Italian Game", "Giuoco Piano", 12, "w"), earlyMistakes: 0 },
    { color: "b", result: "loss", opening: op("Italian Game", "", 5, "b"), earlyMistakes: 0 },
    { color: "b", result: "win", opening: op("Sicilian Defense", "Najdorf Variation", -1, null), earlyMistakes: 1 },
    { color: "w", result: "win", opening: null, earlyMistakes: 0 },
  ]);
  assert.deepStrictEqual(groups.map((g) => `${g.color}|${g.family}|${g.games}`), ["w|Italian Game|3", "b|Sicilian Defense|1", "b|Italian Game|1"], "most played first, then the most early mistakes");
  const italian = groups[0];
  assert.deepStrictEqual([italian.wins, italian.draws, italian.losses], [1, 1, 1]);
  assert.strictEqual(italian.earlyMistakes, 3);
  assert.strictEqual(italian.gamesWithEarlyMistake, 2);
  assert.strictEqual(italian.leftMove, 5, "ply 8 is move 5, twice");
  assert.strictEqual(italian.leftMoveCount, 2);
  assert.strictEqual(italian.leftByMe, 2, "Ana (White) left it in two of the three");
  assert.deepStrictEqual(italian.variations.map((v) => [v.name, v.games]), [["Italian Game: Giuoco Piano", 2], ["Italian Game: Two Knights Defense", 1]]);
  assert.strictEqual(groups[1].inBookToEnd, 1);
  assert.strictEqual(groups[1].leftMove, 0);
});

// ---------------------------------------------------------------- the game core

function loadApp(indexedDB) {
  const dom = createFakeDom({ languages: ["en"] });
  const uiScripts = localScripts().filter((script) => script.startsWith("js/ui/"));
  const env = load({
    dom,
    console: { log() {}, info() {}, debug() {}, warn() {}, error: console.error },
    app: false,
    skip: uiScripts,
    globals: { requestAnimationFrame: (fn) => setTimeout(fn, 0), indexedDB },
  });
  const Ludus = env.context.Ludus;
  // The data file, as the browser's loadScript would run it.
  vm.runInContext(fs.readFileSync(path.join(repoRoot, "js", "data", "openings.data.js"), "utf8"), env.context, { filename: "openings.data.js" });
  Ludus.ui = {};
  Ludus.Screens = {};
  Ludus.shell = { mount() {} };
  ["home", "classics", "notebook", "progress", "museum", "settings", "account", "openings"].forEach((name) => {
    Ludus.Screens[name] = { mount(container) { container.appendChild(dom.document.createElement("div")); }, show() {}, hide() {} };
  });
  vm.runInContext(fs.readFileSync(path.join(repoRoot, "app.js"), "utf8"), env.context, { filename: "app.js" });
  installEngine(env);
  return env;
}

// The stub engine: in a blunder position the best move is +300 and the played one -200; anywhere else the played move
// is 10 cp behind the best. Every position of both games is known.
function installEngine(env) {
  const { Chess: C, sanToMove: toMove, moveToUci } = env.context.Ludus.chess;
  const positions = new Map();
  [GAME_A, GAME_B].forEach((game) => {
    const chess = new C();
    game.forEach((san, ply) => {
      const move = toMove(san, chess);
      const blunder = BLUNDERS.some((b) => b.game === game && b.ply === ply);
      positions.set(chess.fen(), { uci: moveToUci(move), legal: chess.generateMoves().map(moveToUci), blunder });
      chess.makeMove(move);
    });
  });
  const line = (uci, value, depth) => ({ multipv: 1, depth, score: { type: "cp", value }, pv: [uci] });
  env.searched = [];
  env.context.engineSourceName = () => "stockfish";
  env.context.analyzePosition = async (fen, options = {}) => {
    env.searched.push(fen);
    const info = positions.get(fen);
    const depth = options.noCache ? 8 : 14;
    if (options.searchMoves && options.searchMoves.length) {
      return { lines: [line(options.searchMoves[0], info.blunder ? -200 : 20, depth)], source: "stockfish", depth, aborted: false };
    }
    return { lines: [line(info.legal.find((uci) => uci !== info.uci), info.blunder ? 300 : 30, depth)], source: "stockfish", depth, aborted: false };
  };
}

async function runSearch(env, focus) {
  env.run(`STATE.setupWizard.openings = ${JSON.stringify(focus)}`);
  env.context.getActivePgnTextSources = async () => [{ name: "games.pgn", text: PGN, username: "Ana" }];
  const ctx = await env.context.loadCandidateAnalysisContext({ moveTimeMs: 250, thresholdCp: 80 });
  assert.ok(ctx, "a search context");
  const found = [];
  for (let guard = 0; guard < 60; guard += 1) {
    const mistake = await env.context.searchNextMistake(ctx);
    if (!mistake) break;
    found.push(mistake);
  }
  await env.context.flushMistakeVerdicts();
  return { ctx, found };
}

const key = (m) => `${m.gameMoveSan}@${m.meta.moveNumber}`;

test("an openings session looks only at the person's moves up to move 12, and its positions carry the opening and the book moves", async () => {
  const env = loadApp(createFakeIndexedDB());
  const { ctx, found } = await runSearch(env, { family: "", color: "" });
  assert.ok(ctx.openings, "the search knows it is an openings session");
  assert.ok(ctx.candidates.length > 0 && ctx.candidates.every((c) => c.ply < 24), "no candidate after move 12");
  assert.strictEqual(ctx.queueStats.playerMoves, 12 + 8, "Ana's 12 moves as White and her 8 as Black");
  assert.deepStrictEqual(found.map(key).sort(), ["Rxe4@11", "e5@6"], "move 15 is never searched");
  const rxe4 = found.find((m) => m.gameMoveSan === "Rxe4");
  assert.ok(/^Italian Game: Classical Variation/.test(rxe4.opening.name), rxe4.opening.name);
  assert.strictEqual(rxe4.opening.inBook, true, "the position before 11.Rxe4 is still a book position");
  assert.ok(rxe4.opening.continuations.some((m) => m.san === "Rxe4"), "the book move from there is listed");
  const e5 = found.find((m) => m.gameMoveSan === "e5");
  assert.strictEqual(e5.opening.family, "Sicilian Defense");
  // The session's title names it.
  assert.strictEqual(env.run("t(\"core.session.openings\", { user: \"Ana\" })"), "Your openings: Ana");
});

test("one family and colour: only those games are searched", async () => {
  const env = loadApp(createFakeIndexedDB());
  const { ctx, found } = await runSearch(env, { family: "Sicilian Defense", color: "b" });
  assert.strictEqual(ctx.openings.family, "Sicilian Defense");
  assert.ok(ctx.candidates.every((c) => c.gameIdx === 1), "only the Sicilian game");
  assert.deepStrictEqual(found.map(key), ["e5@6"]);
  // A family Ana did not play with that colour: nothing to search, said in the words of the openings session.
  const none = loadApp(createFakeIndexedDB());
  none.run("STATE.setupWizard.openings = { family: \"Italian Game\", color: \"b\" }");
  none.context.getActivePgnTextSources = async () => [{ name: "games.pgn", text: PGN, username: "Ana" }];
  let sentKey = "";
  none.context.sendWizardBackToSourceStep = (k) => {
    sentKey = k;
  };
  assert.strictEqual(await none.context.loadCandidateAnalysisContext({ moveTimeMs: 250, thresholdCp: 80 }), null);
  assert.strictEqual(sentKey, "core.openings.noGames");
});

test("an ordinary own-games session is unchanged: every move, no opening on the positions", async () => {
  const env = loadApp(createFakeIndexedDB());
  const { ctx, found } = await runSearch(env, null);
  assert.strictEqual(ctx.openings, null);
  assert.deepStrictEqual(found.map(key).sort(), ["Re1@15", "Rxe4@11", "e5@6"]);
  assert.ok(found.every((m) => !m.opening));
});

test("the report of the openings screen: the newest saved download, each game named, with its result and the early mistakes the search confirmed", async () => {
  const idb = createFakeIndexedDB();
  const first = loadApp(idb);
  // Nothing downloaded yet.
  assert.deepStrictEqual(JSON.parse(JSON.stringify(await first.context.ownOpeningsReport())), { status: "empty" });
  // A session over every move confirms the three mistakes (verdicts in IndexedDB), and the download is saved.
  await runSearch(first, null);
  await first.context.writeCachedRemotePgn("lichess|ana|sig", { provider: "lichess", username: "Ana", text: PGN, games: 2 });

  const env = loadApp(idb); // another visit: nothing in memory, the saved download and verdicts only
  const report = await env.context.ownOpeningsReport();
  assert.strictEqual(report.status, "ok");
  assert.strictEqual(report.provider, "lichess");
  assert.strictEqual(report.username, "Ana");
  assert.strictEqual(report.maxMove, 12);
  assert.ok(report.fetchedAt > 0);
  const [a, b] = report.games;
  assert.strictEqual(a.color, "w");
  assert.strictEqual(a.result, "win");
  assert.strictEqual(a.opening.family, "Italian Game");
  assert.strictEqual(a.earlyMistakes, 1, "move 11 counts, move 15 does not");
  assert.strictEqual(b.color, "b");
  assert.strictEqual(b.result, "win");
  assert.strictEqual(b.opening.family, "Sicilian Defense");
  assert.strictEqual(b.earlyMistakes, 1);
  const groups = env.context.Ludus.Openings.groupByFamily(report.games);
  assert.deepStrictEqual(Array.from(groups, (g) => `${g.color}|${g.family}`).sort(), ["b|Sicilian Defense", "w|Italian Game"]);
});

test("the report by account: every saved account is listed, the chosen one is read, an unknown one falls back to the default", async () => {
  const idb = createFakeIndexedDB();
  const seed = loadApp(idb);
  await seed.context.writeCachedRemotePgn("lichess|ana|sig", { provider: "lichess", username: "Ana", text: PGN, games: 2 });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await seed.context.writeCachedRemotePgn("chesscom|ana|sig", { provider: "chesscom", username: "ana", text: PGN, games: 2 });
  // An older download of the same account does not make a second entry.
  await seed.context.writeCachedRemotePgn("chesscom|ana|other", { provider: "chesscom", username: "Ana", text: PGN, games: 2 });

  const env = loadApp(idb);
  const ids = (report) => Array.from(report.accounts, (a) => `${a.provider}|${a.username.toLowerCase()}`);
  const def = await env.context.ownOpeningsReport();
  assert.strictEqual(def.provider, "chesscom", "no choice: the newest download");
  assert.deepStrictEqual(ids(def).sort(), ["chesscom|ana", "lichess|ana"]);
  const lichess = await env.context.ownOpeningsReport({ provider: "lichess", username: "ANA" });
  assert.strictEqual(lichess.provider, "lichess");
  assert.strictEqual(lichess.username, "Ana");
  assert.strictEqual(lichess.games.length, 2);
  const unknown = await env.context.ownOpeningsReport({ provider: "lichess", username: "nobody" });
  assert.strictEqual(unknown.provider, "chesscom");
  // The tab's own download comes first by default, and is the same account as its saved copy.
  env.run(`STATE.remotePgnSources = [{ provider: "lichess", username: "Ana", text: ${JSON.stringify(PGN)} }]`);
  const live = await env.context.ownOpeningsReport();
  assert.strictEqual(live.provider, "lichess");
  assert.strictEqual(live.accounts.length, 2);
});

test("the wizard opened from the openings screen: solo, the provider and user of the download, the focus; any other road clears the focus", () => {
  const env = loadApp(createFakeIndexedDB());
  env.context.ensureStockfishLoading = () => {};
  env.context.Ludus.game.openOwnGamesSetup({ mode: "solo", openings: { family: "Sicilian Defense", color: "b" }, provider: "chesscom", username: "Ana_82" });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(env.run("STATE.setupWizard.openings"))), { family: "Sicilian Defense", color: "b" });
  assert.strictEqual(env.run("getRemoteProviderModeFromUi()"), "chesscom");
  assert.strictEqual(env.run("getConfiguredRemoteUsername()"), "Ana_82");
  assert.strictEqual(env.run("t(STATE.setupWizard.openings ? \"core.openings.heading\" : \"wizard.heading\")"), "Train your openings in 2 steps");
  env.context.Ludus.game.openOwnGamesSetup({ mode: "solo" });
  assert.strictEqual(env.run("STATE.setupWizard.openings"), null);
  // A duel is never an openings session.
  env.context.Ludus.game.openOwnGamesSetup({ mode: "duel", openings: {} });
  assert.strictEqual(env.run("STATE.setupWizard.openings"), null);
});

// ---------------------------------------------------------------- the screen

function screenEnv({ language = "en", report = null, reportError = null } = {}) {
  const doc = new FakeDocument();
  const sandbox = { console, setTimeout, clearTimeout, Date, Math, JSON, Object, Array, String, Number, Promise, Map, Set, Intl, URL, structuredClone };
  sandbox.document = doc;
  sandbox.window = sandbox;
  sandbox.navigator = { languages: [language], language };
  sandbox.localStorage = createFakeLocalStorage(new Map());
  const context = vm.createContext(sandbox);
  ["js/ludus.js", "js/chess.js", "js/openings.js", "js/data/openings.data.js", "js/ui/kit.js", "js/ui/openings.js"].forEach((rel) => {
    vm.runInContext(fs.readFileSync(path.join(repoRoot, rel), "utf8"), context, { filename: rel });
  });
  const Ludus = context.Ludus;
  Ludus.i18n.setLanguage(language, { persist: false });
  const calls = [];
  Ludus.game = {
    openOwnGamesSetup: (options) => calls.push(JSON.parse(JSON.stringify(options))),
    openingsReport: async () => {
      if (reportError) throw reportError;
      return report;
    },
  };
  const el = doc.createElement("section");
  doc.body.appendChild(el);
  const screen = Ludus.Screens.openings;
  screen.mount(el);
  return { Ludus, screen, el, calls };
}

const text = (node) => node.textContent.replace(/\s+/g, " ").trim();
const all = (root, className) => findAll(root, byClass(className));
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function sampleReport() {
  const Data = globalThis.Ludus.Openings;
  return {
    status: "ok",
    provider: "chesscom",
    username: "jpr82",
    player: "jpr82",
    fetchedAt: Date.now(),
    maxMove: 12,
    games: [
      { color: "w", result: "win", opening: Data.classifyGame({ sanMoves: GAME_A }), earlyMistakes: 1 },
      { color: "w", result: "loss", opening: Data.classifyGame({ sanMoves: sans("e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 a3 h6") }), earlyMistakes: 0 },
      { color: "b", result: "draw", opening: Data.classifyGame({ sanMoves: GAME_B }), earlyMistakes: 2 },
    ],
  };
}

test("screen: the openings by colour and family, with results, early mistakes, where the book ends, and a training per family", async () => {
  await Openings.load();
  for (const language of ["en", "es"]) {
    const { el, screen, calls } = screenEnv({ language, report: sampleReport() });
    screen.show();
    await tick();
    const sections = all(el, "openings-color");
    assert.deepStrictEqual(sections.map((s) => s.getAttribute("data-color")), ["w", "b"]);
    const cards = all(el, "openings-card");
    assert.deepStrictEqual(cards.map((c) => `${c.getAttribute("data-color")}|${c.getAttribute("data-family")}`), ["w|Italian Game", "b|Sicilian Defense"]);
    const italian = text(cards[0]);
    assert.ok(language === "en" ? /1 won, 0 drawn, 1 lost/.test(italian) : /1 ganadas, 0 tablas, 1 perdidas/.test(italian), italian);
    assert.ok(language === "en" ? /1 mistake in your first 12 moves/.test(italian) : /1 error en tus primeras 12 jugadas/.test(italian), italian);
    // The book ends on move 6 in one game (6.a3, Ana's) and on 13 in the other: a tie goes to the earlier move.
    assert.ok(language === "en" ? /Leaves the book on move 6 \(1 of 2\)/.test(italian) : /Sale del libro en la jugada 6 \(1 de 2\)/.test(italian), italian);
    assert.ok(language === "en" ? /You leave the book in 1 of 2 games/.test(italian) : /Salís vos del libro en 1 de 2 partidas/.test(italian), italian);
    assert.ok(text(el).includes("jpr82") && text(el).includes("Chess.com"));
    // The bar says its numbers in words, not only in colour.
    assert.ok(all(el, "openings-bar").every((bar) => bar.getAttribute("role") === "img" && /\d/.test(bar.getAttribute("aria-label"))));
    // Training: one family and colour, or all, with the download's provider and user.
    findAll(cards[1], (node) => node.tagName === "BUTTON")[0].click();
    findAll(el, (node) => node.getAttribute && node.getAttribute("data-openings-train") === "all")[0].click();
    assert.deepStrictEqual(calls, [
      { mode: "solo", openings: { family: "Sicilian Defense", color: "b" }, provider: "chesscom", username: "jpr82" },
      { mode: "solo", openings: { family: "", color: "" }, provider: "chesscom", username: "jpr82" },
    ]);
  }
});

test("screen: with several downloaded accounts a selector picks the account, the report is rebuilt for it, and training uses it", async () => {
  await Openings.load();
  const base = sampleReport();
  const accounts = [{ provider: "chesscom", username: "jpr82" }, { provider: "lichess", username: "juan" }];
  for (const language of ["en", "es"]) {
    const one = screenEnv({ language, report: Object.assign({}, base, { accounts: accounts.slice(0, 1) }) });
    one.screen.show();
    await tick();
    assert.strictEqual(all(one.el, "openings-account").length, 0, "one account: no selector");

    const asked = [];
    const env = screenEnv({ language, report: base });
    env.Ludus.game.openingsReport = async (choice) => {
      asked.push(choice || null);
      const picked = choice && choice.provider === "lichess" ? accounts[1] : accounts[0];
      return Object.assign({}, base, picked, { player: picked.username, accounts });
    };
    env.screen.show();
    await tick();
    const selects = all(env.el, "openings-account-select");
    assert.strictEqual(selects.length, 1);
    assert.strictEqual(findAll(selects[0], (node) => node.tagName === "OPTION").length, 2);
    assert.strictEqual(selects[0].value, "chesscom|jpr82");
    assert.ok(text(all(env.el, "openings-account")[0]).includes(language === "en" ? "Account" : "Cuenta"));
    selects[0].value = "lichess|juan";
    selects[0].dispatch("change", {});
    await tick();
    assert.deepStrictEqual(JSON.parse(JSON.stringify(asked)), [null, { provider: "lichess", username: "juan" }]);
    assert.ok(text(all(env.el, "openings-source")[0]).includes("juan"));
    assert.strictEqual(all(env.el, "openings-account-select")[0].value, "lichess|juan");
    findAll(env.el, (node) => node.getAttribute && node.getAttribute("data-openings-train") === "all")[0].click();
    assert.deepStrictEqual(env.calls, [{ mode: "solo", openings: { family: "", color: "" }, provider: "lichess", username: "juan" }]);
    // Leaving and coming back keeps the choice for the session.
    env.screen.hide();
    env.screen.show();
    await tick();
    assert.deepStrictEqual(JSON.parse(JSON.stringify(asked[asked.length - 1])), { provider: "lichess", username: "juan" });
  }
});

test("screen: no downloaded games sends to the download; a failure offers to try again", async () => {
  const empty = screenEnv({ report: { status: "empty" } });
  empty.screen.show();
  await tick();
  assert.strictEqual(all(empty.el, "openings-card").length, 0);
  const button = findAll(empty.el, (node) => node.tagName === "BUTTON")[0];
  assert.ok(/Download/.test(text(button)));
  button.click();
  assert.deepStrictEqual(empty.calls, [{ mode: "solo", openings: { family: "", color: "" } }]);

  const broken = screenEnv({ reportError: new Error("offline") });
  broken.screen.show();
  await tick();
  assert.ok(all(broken.el, "openings-error").length === 1);
});

test("screen text: the same keys and placeholders in es and en, nothing empty", () => {
  const { TEXT } = require(path.join(repoRoot, "js", "ui", "openings.js"));
  assert.deepStrictEqual(Object.keys(TEXT.es).sort(), Object.keys(TEXT.en).sort());
  const holes = (s) => Array.from(String(s).matchAll(/\{(\w+)\}/g), (m) => m[1]).sort().join(",");
  Object.keys(TEXT.es).forEach((k) => {
    assert.ok(TEXT.es[k] && TEXT.en[k], k);
    assert.strictEqual(holes(TEXT.es[k]), holes(TEXT.en[k]), k);
  });
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
    console.error(`openings.test.js: ${failed} failed`);
    process.exit(1);
  }
  console.log(`openings.test.js passed (${tests.length} tests)`);
  process.exit(0);
})();
