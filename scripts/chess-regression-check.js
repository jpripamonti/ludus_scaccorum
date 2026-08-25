const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  toggle(name, force) {
    const enabled = force === undefined ? !this.values.has(name) : Boolean(force);
    if (enabled) this.values.add(name);
    else this.values.delete(name);
    return enabled;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.dataset = {};
    this.style = {};
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
    this.disabled = false;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener() {}

  focus() {}

  remove() {}

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  querySelector() {
    return new FakeElement();
  }

  querySelectorAll() {
    return [];
  }

  insertAdjacentHTML(_position, html) {
    this.innerHTML += html;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 512, height: 512 };
  }

  get clientWidth() {
    return 512;
  }

  get clientHeight() {
    return 512;
  }
}

const elements = new Map();
function elementFor(id) {
  if (!elements.has(id)) elements.set(id, new FakeElement());
  return elements.get(id);
}

const localStorageMap = new Map();
const document = {
  documentElement: new FakeElement("html"),
  body: new FakeElement("body"),
  title: "",
  currentScript: { src: "app.js" },
  getElementById: elementFor,
  querySelector: () => new FakeElement(),
  querySelectorAll: () => [],
  createElement: (tagName) => new FakeElement(tagName),
  createElementNS: (_ns, tagName) => new FakeElement(tagName),
};

const window = {
  document,
  navigator: { languages: ["en"], language: "en" },
  localStorage: {
    getItem: (key) => localStorageMap.get(key) || null,
    setItem: (key, value) => localStorageMap.set(key, String(value)),
  },
  addEventListener: () => {},
  scrollTo: () => {},
  confirm: () => true,
  requestIdleCallback: () => {},
};

const context = {
  console,
  document,
  window,
  navigator: window.navigator,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  fetch: async () => {
    throw new Error("network disabled in regression test");
  },
};
context.globalThis = context;

const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
vm.runInNewContext(`${appSource}\nglobalThis.__ludusTest = { Chess, STATE, uciToMove, moveToSan, sanToMove, localFallbackDepth, sessionSummaryScoreText, cpQualityCode, pointsFromQualityCode, encodeMateScore, decodeEvaluation, remoteFetchThrottleBlock, recordRemoteFetch, writeRemoteFetchLog, resolveTargetPlayerName, hasAnyPgnSource, installRemotePgnSource, findNextMistake, restoreBoardToRoundStart };`, context);

const { Chess, STATE, uciToMove, moveToSan, sanToMove, localFallbackDepth, sessionSummaryScoreText, cpQualityCode, pointsFromQualityCode, encodeMateScore, decodeEvaluation, remoteFetchThrottleBlock, recordRemoteFetch, writeRemoteFetchLog, resolveTargetPlayerName, hasAnyPgnSource, installRemotePgnSource, findNextMistake, restoreBoardToRoundStart } = context.__ludusTest;

function play(game, uci) {
  const move = uciToMove(uci, game);
  assert(move, `expected legal move for ${uci}`);
  game.makeMove(move);
  return game.fen();
}

const opening = new Chess();
assert.strictEqual(play(opening, "e2e4"), "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
assert.strictEqual(play(opening, "e7e5"), "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2");
assert.strictEqual(play(opening, "g1f3"), "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2");
assert.strictEqual(play(opening, "b8c6"), "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3");

const ambiguousKnights = new Chess("rnbqkbnr/pppppppp/8/8/8/5N2/PPP1PPPP/RNBQKB1R w KQkq - 0 1");
assert.strictEqual(moveToSan(ambiguousKnights, uciToMove("b1d2", ambiguousKnights)), "Nbd2");
assert.strictEqual(moveToSan(ambiguousKnights, uciToMove("f3d2", ambiguousKnights)), "Nfd2");

const mateInOne = new Chess("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1");
assert.strictEqual(moveToSan(mateInOne, uciToMove("f7f8", mateInOne)), "Qf8#");

assert.strictEqual(localFallbackDepth(18), 3);
assert.strictEqual(localFallbackDepth(0), 3);
assert.strictEqual(localFallbackDepth(2), 2);

STATE.gameFormat = "solo";
STATE.score = 2.5;
assert.strictEqual(sessionSummaryScoreText(), "2.5 pts");

STATE.gameFormat = "duel";
STATE.duel.players = ["Alice", "Bob"];
STATE.duel.scores = [1, 0.5];
assert.strictEqual(sessionSummaryScoreText(), "Alice 1 - 0.5 Bob");

assert(!appSource.includes("player2.userSan"), "duel result re-render should use player2.san");

// ---------- Castling ----------

const whiteKingsideCastle = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
assert.strictEqual(
  play(whiteKingsideCastle, "e1g1"),
  "r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1",
  "white kingside castling should move king to g1 and rook to f1"
);

const blackQueensideCastle = new Chess("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1");
assert.strictEqual(
  play(blackQueensideCastle, "e8c8"),
  "2kr3r/8/8/8/8/8/8/R3K2R w KQ - 1 2",
  "black queenside castling should move king to c8 and rook to d8"
);

const castleWhileInCheck = new Chess("4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1");
assert.strictEqual(castleWhileInCheck.inCheck("w"), true, "setup should have white king in check");
assert.strictEqual(uciToMove("e1g1", castleWhileInCheck), null, "castling kingside must be illegal while in check");
assert.strictEqual(uciToMove("e1c1", castleWhileInCheck), null, "castling queenside must be illegal while in check");
assert.strictEqual(
  castleWhileInCheck.generateMoves().some((move) => move.castle),
  false,
  "no castling move should be legal while the king is in check"
);

const castleThroughAttackedSquare = new Chess("4k3/8/8/8/8/5r2/8/4K2R w K - 0 1");
assert.strictEqual(castleThroughAttackedSquare.inCheck("w"), false, "king itself should not be in check in this setup");
assert.strictEqual(
  uciToMove("e1g1", castleThroughAttackedSquare),
  null,
  "castling must be illegal when the king passes through an attacked square (f1)"
);

// ---------- En passant ----------

const enPassantGame = new Chess("rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3");
assert.strictEqual(
  play(enPassantGame, "e5d6"),
  "rnbqkbnr/ppp1pppp/3P4/8/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3",
  "en passant capture should remove the black pawn on d5 and land the white pawn on d6"
);

// ---------- Pawn promotion ----------

const whiteRookPromotion = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
assert.strictEqual(
  play(whiteRookPromotion, "a7a8r"),
  "R6k/8/8/8/8/8/8/7K b - - 0 1",
  "white pawn should be able to underpromote to a rook"
);

const blackKnightPromotion = new Chess("7k/8/8/8/8/8/6p1/K7 b - - 0 1");
assert.strictEqual(
  play(blackKnightPromotion, "g2g1n"),
  "7k/8/8/8/8/8/8/K5n1 w - - 0 2",
  "black pawn should be able to underpromote to a knight"
);

// ---------- Checkmate detection ----------

const foolsMate = new Chess("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");
assert.strictEqual(foolsMate.inCheck("w"), true, "fool's mate position should have white in check");
assert.strictEqual(foolsMate.generateMoves().length, 0, "fool's mate position should have no legal moves (checkmate)");

// ---------- Stalemate detection ----------

const stalemate = new Chess("k7/2K5/1Q6/8/8/8/8/8 b - - 0 1");
assert.strictEqual(stalemate.inCheck("b"), false, "stalemate position should not have black in check");
assert.strictEqual(stalemate.generateMoves().length, 0, "stalemate position should have no legal moves");

// ---------- Centipawn-loss quality thresholds ----------

assert.strictEqual(cpQualityCode(10), "perfect", "loss=10 should be perfect");
assert.strictEqual(cpQualityCode(11), "very_good", "loss=11 should be very_good");
assert.strictEqual(cpQualityCode(35), "very_good", "loss=35 should be very_good");
assert.strictEqual(cpQualityCode(36), "good", "loss=36 should be good");
assert.strictEqual(cpQualityCode(70), "good", "loss=70 should be good");
assert.strictEqual(cpQualityCode(71), "interesting", "loss=71 should be interesting");
assert.strictEqual(cpQualityCode(115), "interesting", "loss=115 should be interesting");
assert.strictEqual(cpQualityCode(116), "dubious", "loss=116 should be dubious");
assert.strictEqual(cpQualityCode(165), "dubious", "loss=165 should be dubious");
assert.strictEqual(cpQualityCode(166), "bad", "loss=166 should be bad");
assert.strictEqual(cpQualityCode(240), "bad", "loss=240 should be bad");
assert.strictEqual(cpQualityCode(241), "blunder", "loss=241 should be blunder");

// near-perfect via expected-points loss: only kicks in when loss is also <=18
assert.strictEqual(
  cpQualityCode(18, false, 0.008),
  "perfect",
  "loss=18 with expectedLoss=0.008 should be perfect (near-perfect by expected points)"
);
assert.strictEqual(
  cpQualityCode(19, false, 0.008),
  "very_good",
  "loss=19 with expectedLoss=0.008 should not qualify as near-perfect (loss above 18 cutoff)"
);
assert.strictEqual(
  cpQualityCode(18, false, 0.009),
  "very_good",
  "loss=18 with expectedLoss=0.009 should not qualify as near-perfect (expectedLoss above 0.008 cutoff)"
);

// exactBest always wins regardless of loss
assert.strictEqual(cpQualityCode(500, true), "perfect", "exactBest=true should always yield perfect");

// non-finite loss with no special reasonCode/exactBest
assert.strictEqual(cpQualityCode(NaN), "no_move", "non-finite loss should be treated as no_move");
assert.strictEqual(cpQualityCode(Infinity), "no_move", "infinite loss should be treated as no_move");

// special reasonCode overrides
assert.strictEqual(cpQualityCode(0, false, null, "no_move"), "no_move", "reasonCode=no_move should force no_move");
assert.strictEqual(
  cpQualityCode(0, false, null, "allows_mate"),
  "blunder",
  "reasonCode=allows_mate should force blunder even with zero loss"
);
assert.strictEqual(
  cpQualityCode(0, false, null, "missed_forced_mate"),
  "blunder",
  "reasonCode=missed_forced_mate should force blunder even with zero loss"
);
assert.strictEqual(
  cpQualityCode(500, false, null, "optimal_mate"),
  "perfect",
  "reasonCode=optimal_mate should force perfect even with high loss"
);

// ---------- Points awarded per quality code ----------

assert.strictEqual(pointsFromQualityCode("perfect"), 1);
assert.strictEqual(pointsFromQualityCode("very_good"), 0.75);
assert.strictEqual(pointsFromQualityCode("good"), 0.5);
assert.strictEqual(pointsFromQualityCode("interesting"), 0.25);
assert.strictEqual(pointsFromQualityCode("dubious"), 0);
assert.strictEqual(pointsFromQualityCode("bad"), -0.5);
assert.strictEqual(pointsFromQualityCode("blunder"), -1);
assert.strictEqual(pointsFromQualityCode("no_move"), 0);
assert.strictEqual(pointsFromQualityCode("unknown_code"), 0, "unrecognized codes should default to 0 points");

// ---------- Mate scores survive the round trip, including long mates ----------

for (const distance of [1, 5, 10, 11, 20, 49, 50]) {
  const positive = decodeEvaluation(encodeMateScore(distance));
  assert.strictEqual(positive.kind, "mate", `mate in ${distance} should decode as a mate, not centipawns`);
  assert.strictEqual(positive.matePly, distance, `mate in ${distance} should keep its distance`);

  const negative = decodeEvaluation(encodeMateScore(-distance));
  assert.strictEqual(negative.kind, "mate", `getting mated in ${distance} should decode as a mate`);
  assert.strictEqual(negative.matePly, -distance, `getting mated in ${distance} should keep its distance`);
}

// Mates further away than the encodable range are clamped, but still read as mates.
assert.strictEqual(decodeEvaluation(encodeMateScore(80)).kind, "mate");
assert.strictEqual(decodeEvaluation(encodeMateScore(80)).matePly, 50);
assert.strictEqual(decodeEvaluation(encodeMateScore(-80)).matePly, -50);

// "score mate 0" means the side to move is already mated.
assert.strictEqual(decodeEvaluation(encodeMateScore(0)).kind, "mate");
assert.strictEqual(decodeEvaluation(encodeMateScore(0)).matePly, -1);

// Ordinary evaluations stay centipawn evaluations.
assert.strictEqual(decodeEvaluation(0).kind, "cp");
assert.strictEqual(decodeEvaluation(-450).kind, "cp");
assert.strictEqual(decodeEvaluation(9000).kind, "cp");

// ---------- Courtesy limit on downloads from the public chess services ----------

writeRemoteFetchLog([]);
assert.strictEqual(remoteFetchThrottleBlock(), null, "a fresh browser should be allowed to download");

recordRemoteFetch();
const rightAfter = remoteFetchThrottleBlock();
assert.ok(rightAfter, "a second download immediately after the first should be held back");
assert.strictEqual(rightAfter.key, "provider.throttleWait");
assert.ok(rightAfter.params.seconds > 0 && rightAfter.params.seconds <= 20);

// Twelve downloads spread over the last half hour: the hourly ceiling applies.
const halfHourAgo = Date.now() - 30 * 60 * 1000;
writeRemoteFetchLog(Array.from({ length: 12 }, (_, i) => halfHourAgo + i * 1000));
const hourly = remoteFetchThrottleBlock();
assert.ok(hourly, "the hourly ceiling should hold back the thirteenth download");
assert.strictEqual(hourly.key, "provider.throttleHourly");
assert.strictEqual(hourly.params.max, 12);
assert.ok(hourly.params.minutes > 0 && hourly.params.minutes <= 60);

// The same twelve downloads, but two hours old: the window has rolled over.
const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
writeRemoteFetchLog(Array.from({ length: 12 }, (_, i) => twoHoursAgo + i * 1000));
assert.strictEqual(remoteFetchThrottleBlock(), null, "downloads older than the window should not count");

// Corrupted storage must not lock anyone out.
context.window.localStorage.setItem("ludus.remoteFetchThrottle.v1", "not json");
assert.strictEqual(remoteFetchThrottleBlock(), null, "unreadable storage should fail open");
writeRemoteFetchLog([]);

// ---------- Whose mistakes the session trains ----------

function gameBetween(white, black) {
  return { tags: { White: white, Black: black }, sanMoves: [] };
}

// One downloaded game: both names appear once, so counting names is a tie and
// the tie-break used to pick White. The requested user must win instead.
assert.strictEqual(resolveTargetPlayerName([gameBetween("Rival", "Ana")], "Ana").name, "Ana");
assert.strictEqual(resolveTargetPlayerName([gameBetween("Ana", "Rival")], "Ana").name, "Ana");

// A run of games against the same opponent never outvotes the requested user.
const rematches = [gameBetween("Rival", "Ana"), gameBetween("Rival", "Ana"), gameBetween("Rival", "Ana")];
assert.strictEqual(resolveTargetPlayerName(rematches, "Ana").name, "Ana");

// Names match regardless of capitalisation, and the spelling from the game is
// the one shown on screen.
assert.strictEqual(resolveTargetPlayerName([gameBetween("Rival", "AnaGM")], "anagm").name, "AnaGM");

// A base without the requested user is reported, never silently replaced by
// whoever happens to appear most often.
const missingUser = resolveTargetPlayerName([gameBetween("Rival", "Otro")], "Ana");
assert.strictEqual(missingUser.name, "");
assert.strictEqual(missingUser.requestedMissing, true);

// With no username to go by, frequency remains the fallback.
const noRequest = [gameBetween("Rival", "Ana"), gameBetween("Ana", "Otro")];
assert.strictEqual(resolveTargetPlayerName(noRequest, "").name, "Ana");

// ---------- A late download must not replace the base of another user ----------

const userField = document.getElementById("online-user-input");
const providerField = document.getElementById("online-provider-select");
providerField.value = "lichess";
userField.value = "Ana";
STATE.sourceMode = "lichess";
STATE.remotePgnSources = [];

const anaBase = { name: "lichess_ana.pgn", text: "", provider: "lichess", username: "Ana", games: 1 };
assert.strictEqual(installRemotePgnSource(anaBase), true, "a base for the name on screen should install");
assert.strictEqual(hasAnyPgnSource(true), true);

// The person edits the name while a second download is still in flight.
userField.value = "Bruno";
assert.strictEqual(hasAnyPgnSource(true), false, "the previous user's base must stop counting as ready");
assert.strictEqual(installRemotePgnSource(anaBase), false, "a download for the previous user must be discarded");
assert.strictEqual(STATE.remotePgnSources.length, 1);
assert.strictEqual(STATE.remotePgnSources[0].username, "Ana", "the discarded download must not overwrite what is stored");

// Same person, other platform: also a mismatch.
userField.value = "Ana";
assert.strictEqual(hasAnyPgnSource(true), true);
assert.strictEqual(installRemotePgnSource({ ...anaBase, provider: "chesscom" }), false, "a base from the other platform must be discarded");

STATE.remotePgnSources = [];
userField.value = "";

// ---------- Recovering from a failed evaluation ----------

// The move a person plays is shown on the board before the engine runs. If the
// evaluation fails, the board has to go back to the position the round started
// from: the next attempt is scored against that position, so leaving the played
// move on screen would score one board while showing another.
const roundStartFen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
STATE.positions = [{ fen: roundStartFen }];
STATE.index = 0;
STATE.board = new Chess(roundStartFen);
STATE.board.makeMove(uciToMove("f1b5", STATE.board));
STATE.userMove = { from: 61, to: 33 };
STATE.revealed = { best: null, game: null, user: { from: 61, to: 33 }, userAlt: null };
assert.notStrictEqual(STATE.board.fen(), roundStartFen, "the played move should be on the board first");

restoreBoardToRoundStart();
assert.strictEqual(STATE.board.fen(), roundStartFen, "a failed evaluation must put the board back");
assert.strictEqual(STATE.userMove, null);
assert.strictEqual(STATE.revealed.user, null);
STATE.positions = [];

// ---------- Cancelling the search for the next position ----------

function searchContext(candidates = []) {
  return {
    games: [],
    targetName: "Ana",
    depth: 1,
    moveTimeMs: 1,
    thresholdCp: 100,
    candidates,
    total: candidates.length,
    analyzed: 0,
    detected: 0,
    cursor: 0,
    usedGameIndices: new Set(),
    uniqueGameCount: 0,
    repeatMistakes: [],
  };
}

const somePosition = { fen: "8/8/8/8/8/8/8/K6k w - - 0 1", gameIdx: 0 };

async function searchChecks() {
  // Nothing left to look at: the session really has run out of positions.
  const exhausted = await findNextMistake(searchContext());
  assert.strictEqual(exhausted.status, "exhausted");
  assert.strictEqual(exhausted.mistake, null);

  // A position was found and is handed over.
  const withSpare = searchContext();
  withSpare.repeatMistakes.push(somePosition);
  const found = await findNextMistake(withSpare);
  assert.strictEqual(found.status, "found");
  assert.strictEqual(found.mistake, somePosition);

  const realEvaluate = context.evaluateCandidateForMistake;

  // Cancelling while a candidate is being evaluated stops the search there and
  // is reported as a cancellation, never as "there are no more positions".
  const cancelled = searchContext([{ gameIdx: 0 }, { gameIdx: 1 }, { gameIdx: 2 }]);
  context.evaluateCandidateForMistake = async () => {
    STATE.ui.searchCancelRequested = true;
    return null;
  };
  const cancelledOutcome = await findNextMistake(cancelled);
  assert.strictEqual(cancelledOutcome.status, "cancelled");
  assert.strictEqual(cancelledOutcome.mistake, null);
  assert.strictEqual(cancelled.cursor, 1, "the search should stop at the candidate that was running");

  // A position found in the very tick the person cancels is kept for the next
  // search instead of being handed over as if nothing had been cancelled.
  const cancelledAfterFinding = searchContext([{ gameIdx: 0 }, { gameIdx: 1 }]);
  context.evaluateCandidateForMistake = async () => {
    STATE.ui.searchCancelRequested = true;
    return somePosition;
  };
  const lateFind = await findNextMistake(cancelledAfterFinding);
  assert.strictEqual(lateFind.status, "cancelled");
  assert.strictEqual(lateFind.mistake, null);
  assert.strictEqual(cancelledAfterFinding.repeatMistakes.length, 1, "work already done should be kept for the next search");

  // Spare positions held back from an earlier search are not handed over during
  // a cancelled one either.
  const cancelledWithSpare = searchContext([{ gameIdx: 0 }]);
  cancelledWithSpare.repeatMistakes.push(somePosition);
  cancelledWithSpare.cursor = 0;
  const spareOutcome = await findNextMistake(cancelledWithSpare);
  assert.strictEqual(spareOutcome.status, "cancelled");

  context.evaluateCandidateForMistake = realEvaluate;
  STATE.ui.searchCancelRequested = false;
}

searchChecks().then(() => {
  console.log("chess-regression-check passed");
}, (error) => {
  console.error(error);
  process.exit(1);
});
