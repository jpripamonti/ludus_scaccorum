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
vm.runInNewContext(`${appSource}\nglobalThis.__ludusTest = { Chess, STATE, uciToMove, moveToSan, sanToMove, localFallbackDepth, sessionSummaryScoreText, cpQualityCode, pointsFromQualityCode };`, context);

const { Chess, STATE, uciToMove, moveToSan, sanToMove, localFallbackDepth, sessionSummaryScoreText, cpQualityCode, pointsFromQualityCode } = context.__ludusTest;

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

console.log("chess-regression-check passed");
