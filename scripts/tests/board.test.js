"use strict";

// Unit tests for js/ui/board.js (Ludus.Board): the pure helpers (square maths, keyboard
// navigation, arrow geometry, move planning for the slide animation, motion rules,
// the drag state machine) and the view against the fake DOM of scripts/tests/_uidom.js
// (build, diff render, highlights, labels, click / keyboard / pointer input, ghost,
// arrows, animation bookkeeping, settings). Layout, real pointers and real animation are
// covered by the browser script scripts/e2e/board.js.
//
//   node scripts/tests/board.test.js

const assert = require("assert");
const path = require("path");
const vm = require("vm");
const fs = require("fs");

const repoRoot = path.resolve(__dirname, "..", "..");
const { FakeDocument, findAll } = require("./_uidom.js");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
// Values made inside the module's vm context have another Object.prototype: compare them as plain JSON.
const plain = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const same = (actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message);

// One vm context with the namespace, the chess primitives and the board module.
function createEnv() {
  const doc = new FakeDocument();
  const windowStub = {
    document: doc,
    PointerEvent: function PointerEvent() {},
    Image: function Image() {},
    addEventListener() {},
    removeEventListener() {},
  };
  const sandbox = { console, setTimeout, clearTimeout, Date, Math, JSON, Object, Array, String, Number, Promise, Map, Set, Intl, document: doc, window: windowStub };
  sandbox.navigator = { languages: ["en"], language: "en" };
  const context = vm.createContext(sandbox);
  ["js/ludus.js", "js/chess.js", "js/ui/board.js"].forEach((rel) => {
    vm.runInContext(fs.readFileSync(path.join(repoRoot, rel), "utf8"), context, { filename: rel });
  });
  const Ludus = context.Ludus;
  Ludus.i18n.setLanguage("en", { persist: false });
  return { context, doc, Ludus, Board: Ludus.Board, Chess: Ludus.chess.Chess, windowStub };
}

const env = createEnv();
const { Board, Chess } = env;
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function boardOf(fen) {
  return new Chess(fen).board.slice();
}

function after(fen, ...ucis) {
  const game = new Chess(fen);
  ucis.forEach((uci) => game.makeMove(env.Ludus.chess.uciToMove(uci, game)));
  return game.board.slice();
}

// ---------- squares ----------

test("squares: names, indexes and colours agree with the Chess class", () => {
  for (let i = 0; i < 64; i += 1) {
    const name = Board.indexSquare(i);
    assert.strictEqual(Board.squareIndex(name), i, `round trip ${name}`);
    assert.strictEqual(Chess.squareToIndex(name), i, `same index as Chess for ${name}`);
  }
  assert.strictEqual(Board.indexSquare(0), "a8");
  assert.strictEqual(Board.indexSquare(63), "h1");
  assert.strictEqual(Board.parseSquare("i1"), null);
  assert.strictEqual(Board.parseSquare("a9"), null);
  assert.strictEqual(Board.parseSquare("a"), null);
  assert.strictEqual(Board.parseSquare(null), null);
  assert.strictEqual(Board.squareIndex("zz"), -1);
  assert.strictEqual(Board.indexSquare(64), null);
  assert.strictEqual(Board.squareName(8, 0), null);
});

test("squares: a1 is dark and h1 is light (regression: the old board painted a1 light)", () => {
  assert.strictEqual(Board.isDarkSquare("a1"), true);
  assert.strictEqual(Board.isDarkSquare("h1"), false);
  assert.strictEqual(Board.isDarkSquare("a8"), false);
  assert.strictEqual(Board.isDarkSquare("h8"), true);
  assert.strictEqual(Board.isDarkSquare("e4"), false);
  assert.strictEqual(Board.isDarkSquare("d4"), true);
  // Squares of one colour never touch along an edge.
  for (let file = 0; file < 7; file += 1) {
    for (let rank = 0; rank < 8; rank += 1) {
      assert.notStrictEqual(Board.isDarkSquare(Board.squareName(file, rank)), Board.isDarkSquare(Board.squareName(file + 1, rank)));
    }
  }
});

test("cells: the drawn position of a square depends on which side is at the bottom", () => {
  same(Board.cellOf("a8", "w"), { col: 0, row: 0 });
  same(Board.cellOf("h1", "w"), { col: 7, row: 7 });
  same(Board.cellOf("a8", "b"), { col: 7, row: 7 });
  same(Board.cellOf("h1", "b"), { col: 0, row: 0 });
  ["w", "b"].forEach((o) => {
    for (let i = 0; i < 64; i += 1) {
      const name = Board.indexSquare(i);
      const cell = Board.cellOf(name, o);
      assert.strictEqual(Board.squareAtCell(cell.col, cell.row, o), name, `${o} ${name}`);
    }
  });
  assert.strictEqual(Board.squareAtCell(8, 0, "w"), null);
  assert.strictEqual(Board.squareAtCell(0, -1, "w"), null);
  assert.strictEqual(Board.cellOf("nope", "w"), null);
});

test("squareFromPoint: pointer position to square, with the board offset, both orientations", () => {
  const rect = { left: 100, top: 50, width: 400, height: 400 };
  assert.strictEqual(Board.squareFromPoint(101, 51, rect, "w"), "a8");
  assert.strictEqual(Board.squareFromPoint(499, 449, rect, "w"), "h1");
  assert.strictEqual(Board.squareFromPoint(101, 51, rect, "b"), "h1");
  assert.strictEqual(Board.squareFromPoint(499, 449, rect, "b"), "a8");
  assert.strictEqual(Board.squareFromPoint(100 + 4 * 50 + 25, 50 + 4 * 50 + 25, rect, "w"), "e4");
  assert.strictEqual(Board.squareFromPoint(100 + 49.9, 50 + 25, rect, "w"), "a8", "just inside the first column");
  assert.strictEqual(Board.squareFromPoint(150, 75, rect, "w"), "b8", "the boundary belongs to the next square");
  assert.strictEqual(Board.squareFromPoint(99, 100, rect, "w"), null, "left of the board");
  assert.strictEqual(Board.squareFromPoint(500, 100, rect, "w"), null, "the right edge is outside");
  assert.strictEqual(Board.squareFromPoint(200, 450, rect, "w"), null, "the bottom edge is outside");
  assert.strictEqual(Board.squareFromPoint(200, 200, null, "w"), null);
  assert.strictEqual(Board.squareFromPoint(200, 200, { left: 0, top: 0, width: 0, height: 0 }, "w"), null);
  assert.strictEqual(Board.squareFromPoint(NaN, 10, rect, "w"), null);
});

test("nextSquare: arrows follow the screen, edges stop, Home/End/PageUp/PageDown jump", () => {
  assert.strictEqual(Board.nextSquare("e4", "ArrowUp", "w"), "e5");
  assert.strictEqual(Board.nextSquare("e4", "ArrowDown", "w"), "e3");
  assert.strictEqual(Board.nextSquare("e4", "ArrowRight", "w"), "f4");
  assert.strictEqual(Board.nextSquare("e4", "ArrowLeft", "w"), "d4");
  // With Black at the bottom "up" is towards rank 1 and "right" towards the a-file.
  assert.strictEqual(Board.nextSquare("e4", "ArrowUp", "b"), "e3");
  assert.strictEqual(Board.nextSquare("e4", "ArrowDown", "b"), "e5");
  assert.strictEqual(Board.nextSquare("e4", "ArrowRight", "b"), "d4");
  assert.strictEqual(Board.nextSquare("e4", "ArrowLeft", "b"), "f4");
  assert.strictEqual(Board.nextSquare("a1", "ArrowLeft", "w"), null);
  assert.strictEqual(Board.nextSquare("a1", "ArrowDown", "w"), null);
  assert.strictEqual(Board.nextSquare("h8", "ArrowRight", "w"), null);
  assert.strictEqual(Board.nextSquare("h8", "ArrowUp", "w"), null);
  assert.strictEqual(Board.nextSquare("a1", "ArrowLeft", "b"), "b1", "a1 is at the right edge for Black");
  assert.strictEqual(Board.nextSquare("e4", "Home", "w"), "a4");
  assert.strictEqual(Board.nextSquare("e4", "End", "w"), "h4");
  assert.strictEqual(Board.nextSquare("e4", "PageUp", "w"), "e8");
  assert.strictEqual(Board.nextSquare("e4", "PageDown", "w"), "e1");
  assert.strictEqual(Board.nextSquare("e4", "Home", "b"), "h4");
  assert.strictEqual(Board.nextSquare("a4", "Home", "w"), null, "already there");
  assert.strictEqual(Board.nextSquare("e4", "Enter", "w"), null);
  assert.strictEqual(Board.nextSquare("zz", "ArrowUp", "w"), null);
});

test("toCells / pieceUrl / colorOf", () => {
  const cells = Board.toCells(START);
  assert.strictEqual(cells[0], "r");
  assert.strictEqual(cells[4], "k");
  assert.strictEqual(cells[60], "K");
  assert.strictEqual(cells[63], "R");
  assert.strictEqual(cells.filter(Boolean).length, 32);
  same(Board.toCells(START.split(" ")[0]), cells, "the placement field alone works");
  same(Board.toCells(new Chess().board), cells);
  assert.strictEqual(Board.toCells(null).filter(Boolean).length, 0);
  assert.strictEqual(Board.toCells("8/8/8/8/8/8/8/9x").filter(Boolean).length, 0, "an invalid FEN is an empty board");
  assert.strictEqual(Board.pieceUrl("N"), "assets/pieces/cburnett/wN.svg");
  assert.strictEqual(Board.pieceUrl("q"), "assets/pieces/cburnett/bQ.svg");
  assert.strictEqual(Board.pieceUrl("x"), "");
  assert.strictEqual(Board.colorOf("K"), "w");
  assert.strictEqual(Board.colorOf("k"), "b");
  assert.strictEqual(Board.colorOf(""), null);
});

// ---------- arrows ----------

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

test("arrowGeometry: a straight arrow starts inside its square and ends with a head on the target", () => {
  const g = Board.arrowGeometry("e2", "e4", { orientation: "w" });
  assert.strictEqual(g.knight, false);
  assert.strictEqual(g.points.length, 2);
  const from = Board.centerOf("e2", "w");
  const to = Board.centerOf("e4", "w");
  assert.ok(dist(g.points[0], [from.x, from.y]) > 5 && dist(g.points[0], [from.x, from.y]) < 40, "the tail leaves a little of the square free");
  // Head: a triangle whose tip is on the target square and whose base is where the shaft stops.
  const [tip, b1, b2] = g.head;
  assert.ok(dist(tip, [to.x, to.y]) < 20, "the tip is near the centre of the target");
  const base = [(b1[0] + b2[0]) / 2, (b1[1] + b2[1]) / 2];
  assert.ok(dist(base, g.points[1]) < 0.02, "the shaft ends at the base of the head");
  assert.ok(dist(b1, b2) > 30, "the head is wider than the shaft is thick");
  // e2 -> e4 goes up the screen: y shrinks.
  assert.ok(g.points[1][1] < g.points[0][1]);
  assert.strictEqual(g.points[0][0], g.points[1][0], "vertical");
});

test("arrowGeometry: orientation mirrors it and a knight move is an L", () => {
  const w = Board.arrowGeometry("e2", "e4", { orientation: "w" });
  const b = Board.arrowGeometry("e2", "e4", { orientation: "b" });
  assert.ok(b.points[1][1] > b.points[0][1], "with Black at the bottom the same move points down the screen");
  assert.ok(Math.abs(w.head[0][0] - (800 - b.head[0][0])) < 0.02 || Math.abs(w.head[0][0] - b.head[0][0]) < 60);
  const knight = Board.arrowGeometry("g1", "f3", { orientation: "w" });
  assert.strictEqual(knight.knight, true);
  assert.strictEqual(knight.points.length, 3, "two legs");
  const corner = knight.points[1];
  const g1 = Board.centerOf("g1", "w");
  assert.strictEqual(corner[0], g1.x, "the long leg (two ranks) comes first, so the corner is on the g file");
  assert.strictEqual(corner[1], Board.centerOf("f3", "w").y);
  const flat = Board.arrowGeometry("b1", "d2", { orientation: "w" });
  assert.strictEqual(flat.points[1][1], Board.centerOf("b1", "w").y, "a wide knight move goes along the rank first");
  const straightKnight = Board.arrowGeometry("g1", "f3", { orientation: "w", knight: false });
  assert.strictEqual(straightKnight.points.length, 2);
});

test("arrowGeometry: nothing to draw for the same square or a bad one; diagonals and long moves are fine", () => {
  assert.strictEqual(Board.arrowGeometry("e4", "e4"), null);
  assert.strictEqual(Board.arrowGeometry("e4", "z9"), null);
  assert.strictEqual(Board.arrowGeometry(null, "e4"), null);
  const long = Board.arrowGeometry("a1", "h8", { orientation: "w" });
  assert.strictEqual(long.points.length, 2);
  assert.ok(dist(long.points[0], long.points[1]) > 800);
  const one = Board.arrowGeometry("e4", "e5", { orientation: "w" });
  assert.ok(dist(one.points[0], one.points[1]) >= 0, "a one-square arrow still has a head");
  one.points.concat(one.head).forEach((p) => p.forEach((n) => assert.ok(Number.isFinite(n))));
});

// ---------- motion ----------

test("motionEnabled: off is still, in-app reduce beats on, auto follows the system", () => {
  assert.strictEqual(Board.motionEnabled({ animation: "off" }), false);
  assert.strictEqual(Board.motionEnabled({ animation: "off", prefersReduced: false }), false);
  assert.strictEqual(Board.motionEnabled({ animation: "on" }), true);
  assert.strictEqual(Board.motionEnabled({ animation: "on", prefersReduced: true }), true, "the person asked for it here");
  assert.strictEqual(Board.motionEnabled({ animation: "on", a11yMotion: "reduce" }), false, "the accessibility setting wins");
  assert.strictEqual(Board.motionEnabled({ animation: "auto", prefersReduced: true }), false);
  assert.strictEqual(Board.motionEnabled({ animation: "auto", a11yMotion: "reduce" }), false);
  assert.strictEqual(Board.motionEnabled({ animation: "auto", prefersReduced: false }), true);
  assert.strictEqual(Board.motionEnabled({}), true, "defaults: auto, no reduction asked");
  assert.strictEqual(Board.motionEnabled(), true);
  assert.strictEqual(Board.motionEnabled({ animation: "weird" }), true, "unknown values behave as auto");
});

test("slideDuration grows with distance and stays within 170..300 ms", () => {
  let last = 0;
  for (let n = 1; n <= 8; n += 1) {
    const ms = Board.slideDuration(n);
    assert.ok(ms >= 170 && ms <= 300, `${n} squares: ${ms}`);
    assert.ok(ms >= last);
    last = ms;
  }
  assert.strictEqual(Board.slideDuration(100), 300);
  assert.strictEqual(Board.slideDuration(NaN) >= 170, true);
});

test("feedbackKind: check beats capture beats a quiet move; feedback is guarded", () => {
  assert.strictEqual(Board.feedbackKind({ capture: true }, true), "check");
  assert.strictEqual(Board.feedbackKind({ capture: "p" }, false), "capture");
  assert.strictEqual(Board.feedbackKind({ enPassant: true }, false), "capture");
  assert.strictEqual(Board.feedbackKind({}, false), "move");
  assert.strictEqual(Board.feedbackKind(null, false), "move");
  const played = [];
  const haptics = [];
  env.Ludus.Audio = { play: (k) => played.push(k), haptic: (k) => haptics.push(k) };
  Board.feedback("capture");
  same(played, ["capture"]);
  same(haptics, ["capture"]);
  env.Ludus.Audio = { play() { throw new Error("no audio here"); }, haptic() { throw new Error("no vibration here"); } };
  assert.doesNotThrow(() => Board.feedback("move"));
  env.Ludus.Audio = undefined;
  assert.doesNotThrow(() => Board.feedback("move"), "no Audio module at all");
});

// ---------- move planning ----------

test("planMoves: a quiet move, a capture, castling, en passant and promotions", () => {
  const start = boardOf(START);
  let plan = Board.planMoves(start, after(START, "e2e4"));
  assert.strictEqual(plan.simple, true);
  same(plan.moves.map((m) => [m.piece, m.from, m.to, m.promotedFrom]), [["P", "e2", "e4", null]]);
  assert.strictEqual(plan.captured.length, 0);
  assert.strictEqual(plan.changed, 2);

  const italian = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
  plan = Board.planMoves(boardOf(italian), after(italian, "f3e5"));
  assert.strictEqual(plan.simple, true);
  same(plan.moves.map((m) => [m.piece, m.from, m.to]), [["N", "f3", "e5"]]);
  same(plan.captured.map((c) => [c.piece, c.square]), [["p", "e5"]], "the pawn that stood on e5 is captured");

  const castle = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
  plan = Board.planMoves(boardOf(castle), after(castle, "e1g1"));
  assert.strictEqual(plan.simple, true);
  same(plan.moves.map((m) => `${m.piece}${m.from}${m.to}`).sort(), ["Ke1g1", "Rh1f1"]);
  plan = Board.planMoves(boardOf(castle), after(castle, "e1c1"));
  same(plan.moves.map((m) => `${m.piece}${m.from}${m.to}`).sort(), ["Ke1c1", "Ra1d1"]);

  const ep = "8/8/8/3pP3/8/8/8/K6k w - d6 0 1";
  plan = Board.planMoves(boardOf(ep), after(ep, "e5d6"));
  same(plan.moves.map((m) => `${m.piece}${m.from}${m.to}`), ["Pe5d6"]);
  same(plan.captured.map((c) => c.square), ["d5"], "en passant removes the pawn from a different square than the destination");

  const promo = "7k/P7/8/8/8/8/8/K7 w - - 0 1";
  plan = Board.planMoves(boardOf(promo), after(promo, "a7a8q"));
  assert.strictEqual(plan.simple, true);
  same(plan.moves.map((m) => [m.piece, m.from, m.to, m.promotedFrom]), [["Q", "a7", "a8", "P"]]);
  assert.strictEqual(plan.appeared.length, 0);
  const promoCapture = "1r5k/P7/8/8/8/8/8/K7 w - - 0 1";
  plan = Board.planMoves(boardOf(promoCapture), after(promoCapture, "a7b8n"));
  same(plan.moves.map((m) => [m.piece, m.from, m.to, m.promotedFrom]), [["N", "a7", "b8", "P"]]);
  same(plan.captured.map((c) => [c.piece, c.square]), [["r", "b8"]]);
  const black = "8/8/8/8/8/1K6/p7/7k b - - 0 1";
  plan = Board.planMoves(boardOf(black), after(black, "a2a1r"));
  same(plan.moves.map((m) => [m.piece, m.from, m.to, m.promotedFrom]), [["r", "a2", "a1", "p"]], "Black promotes on the first rank");
});

test("planMoves: undoing a capture is still one move (the captured piece comes back in place)", () => {
  const italian = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
  const plan = Board.planMoves(after(italian, "f3e5"), boardOf(italian));
  assert.strictEqual(plan.simple, true);
  same(plan.moves.map((m) => `${m.piece}${m.from}${m.to}`), ["Ne5f3"]);
  same(plan.appeared.map((a) => `${a.piece}${a.square}`), ["pe5"]);
  assert.strictEqual(plan.captured.length, 0);
});

test("planMoves: identical pieces are matched by distance and unrelated positions are not simple", () => {
  // Two knights: the one that moved is the nearer one.
  const knights = "8/8/8/8/8/8/8/1N2K1Nk w - - 0 1";
  const plan = Board.planMoves(boardOf(knights), after(knights, "g1f3"));
  same(plan.moves.map((m) => `${m.from}${m.to}`), ["g1f3"]);

  const nothing = Board.planMoves(boardOf(START), boardOf(START));
  assert.strictEqual(nothing.simple, false);
  assert.strictEqual(nothing.changed, 0);
  same(nothing.moves, []);

  const unrelated = Board.planMoves(boardOf(START), boardOf("r3k2r/pp3ppp/2n2n2/2b1p3/4P3/2N2N2/PP3PPP/R1B1K2R w KQkq - 0 1"));
  assert.strictEqual(unrelated.simple, false, "a different position is not a move");
  const fromEmpty = Board.planMoves(new Array(64).fill(null), boardOf(START));
  assert.strictEqual(fromEmpty.simple, false);
  assert.strictEqual(fromEmpty.appeared.length, 32);
  const toEmpty = Board.planMoves(boardOf(START), null);
  assert.strictEqual(toEmpty.simple, false);
  assert.strictEqual(toEmpty.captured.length, 32);
  // Two moves apart (like resetting an analysis after a few moves) is still animated when small.
  const two = Board.planMoves(boardOf(START), after(START, "e2e4", "e7e5"));
  assert.strictEqual(two.simple, true);
  assert.strictEqual(two.moves.length, 2);
});

// ---------- drag state machine ----------

function machineWith(targets) {
  const legal = new Set(targets);
  return Board.createDragMachine({ isLegal: (sq) => legal.has(sq) });
}

const types = (actions) => actions.map((a) => a.type);

test("drag machine: a tap on an own piece selects it and swallows the click", () => {
  const m = machineWith(["e3", "e4"]);
  same(types(m.down({ id: 1, type: "mouse", x: 0, y: 0, square: "e2", draggable: true, selected: false })), ["select"]);
  assert.strictEqual(m.state, "pressed");
  same(m.move({ id: 1, x: 2, y: 1, square: "e2" }), [], "below the threshold it is still a press");
  same(types(m.up({ id: 1, x: 2, y: 1, square: "e2" })), ["suppressClick"]);
  assert.strictEqual(m.state, "idle");
});

test("drag machine: a tap on the piece that is already selected deselects it", () => {
  const m = machineWith([]);
  same(m.down({ id: 1, type: "touch", x: 0, y: 0, square: "e2", draggable: true, selected: true }), []);
  same(types(m.up({ id: 1, x: 0, y: 0, square: "e2" })), ["toggle", "suppressClick"]);
});

test("drag machine: presses that are not on a movable piece are left to the click", () => {
  const m = machineWith(["e4"]);
  same(m.down({ id: 1, type: "mouse", x: 0, y: 0, square: "e7", draggable: false }), []);
  assert.strictEqual(m.state, "idle");
  same(m.move({ id: 1, x: 50, y: 50, square: "e5" }), []);
  same(m.up({ id: 1, x: 50, y: 50, square: "e5" }), []);
  same(m.down(null), []);
  same(m.down({ id: 1, draggable: true, square: null, x: 0, y: 0 }), []);
});

test("drag machine: the threshold depends on the kind of pointer", () => {
  const mouse = machineWith([]);
  mouse.down({ id: 1, type: "mouse", x: 0, y: 0, square: "e2", draggable: true });
  same(mouse.move({ id: 1, x: 3, y: 0, square: "e2" }), []);
  same(types(mouse.move({ id: 1, x: 5, y: 0, square: "e2" })), ["start", "move"]);
  const touch = machineWith([]);
  touch.down({ id: 7, type: "touch", x: 0, y: 0, square: "e2", draggable: true });
  same(touch.move({ id: 7, x: 6, y: 0, square: "e2" }), [], "a finger wobbles more than a mouse");
  same(types(touch.move({ id: 7, x: 9, y: 0, square: "e2" })), ["start", "move"]);
});

test("drag machine: drop on a legal target, snap back on an illegal one, cancel outside, keep on the own square", () => {
  function drag(machine, endSquare) {
    machine.down({ id: 1, type: "mouse", x: 0, y: 0, square: "e2", draggable: true, selected: true });
    machine.move({ id: 1, x: 40, y: -40, square: "e3" });
    return machine.up({ id: 1, x: 40, y: -40, square: endSquare });
  }
  const legal = drag(machineWith(["e3", "e4"]), "e4");
  same(legal[0], { type: "drop", from: "e2", to: "e4" });
  assert.strictEqual(legal[1].type, "suppressClick");
  const illegal = drag(machineWith(["e3", "e4"]), "d5");
  same(illegal[0], { type: "snapback", from: "e2", to: "d5" });
  const outside = drag(machineWith(["e3", "e4"]), null);
  same(outside[0], { type: "cancel", reason: "outside" });
  const home = drag(machineWith(["e3", "e4"]), "e2");
  same(home[0], { type: "return", square: "e2" });
});

test("drag machine: moves report the square under the pointer and whether it is legal; other pointers are ignored", () => {
  const m = machineWith(["e4"]);
  m.down({ id: 1, type: "mouse", x: 0, y: 0, square: "e2", draggable: true });
  m.move({ id: 1, x: 30, y: 0, square: "f2" });
  const moved = m.move({ id: 1, x: 31, y: -50, square: "e4" });
  same(moved, [{ type: "move", x: 31, y: -50, over: "e4", legal: true }]);
  same(m.move({ id: 1, x: 0, y: 0, square: null }), [{ type: "move", x: 0, y: 0, over: null, legal: false }]);
  same(m.move({ id: 2, x: 1, y: 1, square: "e4" }), [], "a second finger does nothing");
  same(m.up({ id: 2, x: 1, y: 1, square: "e4" }), []);
  same(m.down({ id: 2, type: "touch", x: 0, y: 0, square: "d2", draggable: true }), [], "and cannot start a press");
  assert.strictEqual(m.state, "dragging");
  same(m.cancel("escape"), [{ type: "cancel", reason: "escape" }]);
  assert.strictEqual(m.state, "idle");
  same(m.cancel("again"), []);
  m.down({ id: 3, type: "mouse", x: 0, y: 0, square: "e2", draggable: true });
  same(m.cancel("pointercancel"), [], "cancelling a mere press has nothing to undo");
  assert.strictEqual(m.state, "idle");
});

// ---------- the view ----------

function withAnimate(doc, calls) {
  const original = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const node = original(tag);
    node.animate = (keyframes, options) => {
      const animation = { keyframes, options, cancelled: false, finished: false, node };
      animation.cancel = () => {
        if (animation.cancelled || animation.finished) return;
        animation.cancelled = true;
        if (animation.oncancel) animation.oncancel();
      };
      animation.finish = () => {
        if (animation.cancelled || animation.finished) return;
        animation.finished = true;
        if (animation.onfinish) animation.onfinish();
      };
      calls.push(animation);
      return animation;
    };
    return node;
  };
}

function makeView(overrides = {}) {
  const doc = new FakeDocument();
  const context = env.context;
  const wrap = doc.createElement("div");
  const el = doc.createElement("div");
  const svg = doc.createElement("svg");
  wrap.appendChild(el);
  wrap.appendChild(svg);
  doc.body.appendChild(wrap);
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 800 });
  const calls = [];
  if (overrides.animate) withAnimate(doc, calls);
  const log = { squares: [], moves: [], cancels: [], focus: [] };
  const settings = Object.assign({ "board.drag": true, "board.animation": "on", "board.lastMove": true, "board.coords": true, "board.legalDots": true, "a11y.motion": "auto" }, overrides.settings);
  // Ludus.util.h creates nodes through the context's document: point it at this fake document.
  // Ludus.util.h builds nodes with the context's current document; this view lives in `doc`.
  context.document = doc;
  const win = Object.assign({}, env.windowStub, { document: doc, addEventListener() {}, removeEventListener() {} }, overrides.window);
  const view = Board.create({
    el,
    arrowsEl: svg,
    wrapEl: wrap,
    document: doc,
    window: win,
    orientation: overrides.orientation || "w",
    getSetting: (p) => settings[p],
    onSquare: (sq, info) => log.squares.push([sq, info.via]),
    onMove: (from, to) => log.moves.push([from, to]),
    onCancel: (reason) => log.cancels.push(reason),
    onFocusSquare: (sq) => log.focus.push(sq),
    describe: (info) => `${info.square}:${info.piece || "-"}${info.selected ? ":sel" : ""}${info.legal ? ":legal" : ""}${info.capture ? ":cap" : ""}${info.check ? ":check" : ""}${info.hintFrom ? ":hf" : ""}${info.hintTo ? ":ht" : ""}${info.disabled ? ":off" : ""}`,
  });
  return { view, el, svg, wrap, doc, log, calls, settings, win };
}

const squareEl = (el, name) => findAll(el, (n) => n.dataset && n.dataset.square === name)[0];
// The pieces standing on a square (a captured one that is still fading out does not count).
const piecesIn = (sq) => sq.children.filter((c) => c.classList.contains("bd-piece") && !c.classList.contains("bd-leaving"));
const classesOf = (el, name) => squareEl(el, name).getAttribute("class").split(/\s+/);

function model(fen, extra) {
  const game = new Chess(fen);
  return Object.assign({ pieces: game.board.slice(), turn: game.turn, interactive: true, lang: "en", label: "Board" }, extra);
}

test("create needs an element; build makes 64 accessible squares, a1 dark, coordinates on the edges", () => {
  assert.strictEqual(Board.create({}), null);
  assert.strictEqual(Board.create(null), null);
  const { view, el } = makeView();
  assert.strictEqual(el.getAttribute("role"), "grid");
  const squares = findAll(el, (n) => n.dataset && n.dataset.square);
  assert.strictEqual(squares.length, 64);
  assert.strictEqual(findAll(el, (n) => n.getAttribute("role") === "row").length, 8);
  assert.ok(squares.every((s) => s.getAttribute("role") === "gridcell" && s.getAttribute("aria-colindex") && s.getAttribute("aria-rowindex")));
  assert.ok(classesOf(el, "a1").includes("dark"));
  assert.ok(classesOf(el, "h1").includes("light"));
  assert.ok(classesOf(el, "a8").includes("light"));
  assert.ok(classesOf(el, "h8").includes("dark"));
  // White at the bottom: a8 is the first square drawn, h1 the last.
  assert.strictEqual(squares[0].dataset.square, "a8");
  assert.strictEqual(squares[63].dataset.square, "h1");
  const rank = findAll(el, (n) => n.classList.contains("coord-rank")).map((n) => n.textContent);
  const file = findAll(el, (n) => n.classList.contains("coord-file")).map((n) => n.textContent);
  same(rank, ["8", "7", "6", "5", "4", "3", "2", "1"]);
  same(file, ["a", "b", "c", "d", "e", "f", "g", "h"]);
  assert.ok(findAll(el, (n) => n.classList.contains("coord")).every((n) => n.getAttribute("aria-hidden") === "true"), "coordinates are decoration");
  assert.strictEqual(el.getAttribute("data-orientation"), "w");
  view.destroy();
});

test("build with Black at the bottom mirrors the squares and the coordinates", () => {
  const { view, el } = makeView({ orientation: "b" });
  const squares = findAll(el, (n) => n.dataset && n.dataset.square);
  assert.strictEqual(squares[0].dataset.square, "h1");
  assert.strictEqual(squares[63].dataset.square, "a8");
  assert.ok(classesOf(el, "a1").includes("dark"), "a square keeps its colour when the board turns");
  same(findAll(el, (n) => n.classList.contains("coord-rank")).map((n) => n.textContent), ["1", "2", "3", "4", "5", "6", "7", "8"]);
  same(findAll(el, (n) => n.classList.contains("coord-file")).map((n) => n.textContent), ["h", "g", "f", "e", "d", "c", "b", "a"]);
  view.setOrientation("w");
  assert.strictEqual(findAll(el, (n) => n.dataset && n.dataset.square)[0].dataset.square, "a8");
  view.setOrientation("w");
  assert.strictEqual(view.orientation, "w");
  view.destroy();
});

test("render places the pieces, labels every square and keeps exactly one tab stop", () => {
  const { view, el } = makeView();
  assert.strictEqual(view.render(model(START, { focus: "e2" })), true);
  assert.strictEqual(findAll(el, (n) => n.classList.contains("bd-piece")).length, 32);
  assert.strictEqual(piecesIn(squareEl(el, "e1")).length, 1);
  assert.strictEqual(piecesIn(squareEl(el, "e1"))[0].dataset.piece, "wK");
  assert.strictEqual(piecesIn(squareEl(el, "e1"))[0].getAttribute("src"), "assets/pieces/cburnett/wK.svg");
  assert.strictEqual(piecesIn(squareEl(el, "e1"))[0].getAttribute("aria-hidden"), "true");
  assert.strictEqual(piecesIn(squareEl(el, "e1"))[0].getAttribute("alt"), "");
  assert.strictEqual(piecesIn(squareEl(el, "e4")).length, 0);
  assert.strictEqual(squareEl(el, "e2").getAttribute("aria-label"), "e2:P");
  assert.strictEqual(squareEl(el, "e4").getAttribute("aria-label"), "e4:-");
  assert.strictEqual(el.getAttribute("aria-label"), "Board");
  const tabbable = findAll(el, (n) => n.dataset && n.dataset.square && n.getAttribute("tabindex") === "0");
  same(tabbable.map((n) => n.dataset.square), ["e2"]);
  view.destroy();
});

test("render is a diff: a move reuses the piece element and touches two squares only", () => {
  const { view, el } = makeView();
  view.render(model(START));
  const pawn = piecesIn(squareEl(el, "e2"))[0];
  const writes = [];
  findAll(el, (n) => n.dataset && n.dataset.square).forEach((sq) => {
    const original = sq.setAttribute.bind(sq);
    sq.setAttribute = (name, value) => {
      writes.push(sq.dataset.square);
      original(name, value);
    };
  });
  view.render(model(START), {});
  same(writes, [], "the same model again writes nothing");
  view.render(model(new Chess(START).fen(), { pieces: after(START, "e2e4") }));
  assert.strictEqual(piecesIn(squareEl(el, "e4"))[0], pawn, "the very element of the pawn is now on e4");
  assert.strictEqual(piecesIn(squareEl(el, "e2")).length, 0);
  // Only the two squares whose piece changed are written to (their label names the piece).
  same(Array.from(new Set(writes)).sort(), ["e2", "e4"]);
  view.destroy();
});

test("highlights: selection, legal dots, captures, last move, check, hints and result marks are classes", () => {
  const { view, el } = makeView();
  const fen = "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1";
  view.render(model(fen, {
    selected: "e4",
    targets: [{ square: "e5", capture: false }, { square: "d5", capture: true }],
    lastMove: { from: "e2", to: "e4" },
    check: "e8",
    hint: { from: "e1", to: "e2" },
    marks: { best: { from: "e4", to: "d5" }, user: { from: "e1", to: "d1" }, userAlt: { from: "e1", to: "f1" }, game: { from: "e4", to: "e5" } },
  }));
  const e4 = classesOf(el, "e4");
  ["selected", "bd-last", "best-from", "game-from"].forEach((c) => assert.ok(e4.includes(c), `e4 has ${c}: ${e4}`));
  assert.ok(classesOf(el, "e5").includes("legal") && classesOf(el, "e5").includes("game-to"));
  assert.ok(classesOf(el, "d5").includes("capture") && classesOf(el, "d5").includes("best-to"));
  assert.ok(classesOf(el, "e8").includes("bd-check"));
  assert.ok(classesOf(el, "e1").includes("hint-from") && classesOf(el, "e1").includes("user-from") && classesOf(el, "e1").includes("user-alt-from"));
  assert.ok(classesOf(el, "e2").includes("hint-to") && classesOf(el, "e2").includes("bd-last"));
  assert.ok(classesOf(el, "d1").includes("user-to"));
  assert.ok(classesOf(el, "f1").includes("user-alt-to"));
  // The labels carry the state too (not colour alone).
  assert.strictEqual(squareEl(el, "e4").getAttribute("aria-label"), "e4:P:sel");
  assert.strictEqual(squareEl(el, "e4").getAttribute("aria-selected"), "true");
  assert.strictEqual(squareEl(el, "d5").getAttribute("aria-label"), "d5:p:cap");
  assert.strictEqual(squareEl(el, "e5").getAttribute("aria-label"), "e5:-:legal");
  assert.strictEqual(squareEl(el, "e8").getAttribute("aria-label"), "e8:k:check");
  assert.strictEqual(squareEl(el, "e1").getAttribute("aria-label"), "e1:K:hf");
  assert.strictEqual(squareEl(el, "e2").getAttribute("aria-label"), "e2:-:ht");
  // Clearing them removes the classes again.
  view.render(model(fen));
  assert.ok(!classesOf(el, "e4").includes("selected") && !classesOf(el, "e4").includes("bd-last") && !classesOf(el, "e4").includes("best-from"));
  assert.strictEqual(squareEl(el, "e4").getAttribute("aria-selected"), "false");
  view.destroy();
});

test("board.lastMove off hides the last-move highlight; a stopped board is aria-disabled and cannot be dragged", () => {
  const { view, el, settings } = makeView();
  const m = model(START, { lastMove: { from: "e2", to: "e4" } });
  view.render(m);
  assert.ok(classesOf(el, "e2").includes("bd-last"));
  assert.ok(classesOf(el, "e2").includes("bd-can-drag"), "own pieces can be dragged");
  assert.ok(!classesOf(el, "e7").includes("bd-can-drag"), "the other side's cannot");
  settings["board.lastMove"] = false;
  env.Ludus.bus.emit("settings:changed", { path: "board.lastMove", value: false });
  assert.ok(!classesOf(el, "e2").includes("bd-last"), "live: no reload needed");
  view.render(model(START, { interactive: false }));
  assert.strictEqual(squareEl(el, "e2").getAttribute("aria-disabled"), "true");
  assert.ok(!classesOf(el, "e2").includes("bd-can-drag"), "input is blocked");
  assert.ok(squareEl(el, "e2").getAttribute("aria-label").endsWith(":off"));
  settings["board.drag"] = false;
  view.render(model(START));
  assert.ok(!classesOf(el, "e2").includes("bd-can-drag"), "board.drag off: no drag handles");
  assert.strictEqual(el.getAttribute("data-drag"), "off");
  view.destroy();
});

test("settings: coords, legal dots and drag are data attributes that follow settings:changed", () => {
  const { view, el, settings } = makeView();
  view.render(model(START));
  assert.strictEqual(el.getAttribute("data-coords"), "on");
  assert.strictEqual(el.getAttribute("data-legal"), "on");
  settings["board.coords"] = false;
  settings["board.legalDots"] = false;
  env.Ludus.bus.emit("settings:changed", { path: "board.coords", value: false });
  assert.strictEqual(el.getAttribute("data-coords"), "off");
  assert.strictEqual(el.getAttribute("data-legal"), "off");
  env.Ludus.bus.emit("settings:changed", { path: "engine.multiPv", value: 3 });
  view.destroy();
  settings["board.coords"] = true;
  env.Ludus.bus.emit("settings:changed", { path: "board.coords", value: true });
  assert.strictEqual(el.getAttribute("data-coords"), "off", "a destroyed view ignores the bus");
});

test("board.theme changes ask Settings to reapply the document attributes", () => {
  const { view } = makeView();
  let applied = 0;
  const saved = env.Ludus.Settings;
  env.Ludus.Settings = { get: () => undefined, applyToDocument: () => { applied += 1; } };
  env.Ludus.bus.emit("settings:changed", { path: "board.theme", value: "ocean" });
  assert.strictEqual(applied, 1);
  env.Ludus.bus.emit("settings:changed", { path: "sound.volume", value: 0.2 });
  assert.strictEqual(applied, 1, "sound settings are read live by Audio, nothing to do here");
  env.Ludus.Settings = saved;
  view.destroy();
});

test("arrows: one group per distinct move with a shaft line and a head, the best one on top, duplicates merged", () => {
  const { view, svg } = makeView();
  view.render(model(START, {
    arrows: [
      { kind: "user", from: "e2", to: "e4" },
      { kind: "best", from: "d2", to: "d4" },
      { kind: "game", from: "g1", to: "f3" },
      { kind: "best", from: "e2", to: "e4" },
      { kind: "user", from: "e2", to: "e2" },
      { kind: "user", from: "zz", to: "e4" },
    ],
  }));
  const groups = findAll(svg, (n) => n.classList.contains("bd-arrow"));
  assert.strictEqual(groups.length, 3);
  assert.strictEqual(svg.getAttribute("viewBox"), "0 0 800 800");
  assert.strictEqual(svg.getAttribute("preserveAspectRatio"), "none");
  const kinds = groups.map((g) => g.dataset.kind);
  assert.strictEqual(kinds[kinds.length - 1], "best", "the green arrow is drawn last, over the others");
  const e2e4 = groups.filter((g) => g.dataset.from === "e2" && g.dataset.to === "e4");
  assert.strictEqual(e2e4.length, 1);
  assert.strictEqual(e2e4[0].dataset.kind, "best", "your move equals the best move: one arrow, and it is the best one");
  const knight = groups.find((g) => g.dataset.from === "g1");
  assert.strictEqual(findAll(knight, (n) => n.tagName === "LINE").length, 2, "a knight is an L of two lines");
  assert.strictEqual(findAll(knight, (n) => n.tagName === "POLYGON").length, 1);
  assert.ok(findAll(svg, (n) => n.tagName === "LINE").length >= 3, "the lines exist for tests and screen shots");
  view.render(model(START));
  assert.strictEqual(findAll(svg, (n) => n.classList.contains("bd-arrow")).length, 0);
  view.destroy();
});

test("setArrows redraws only the arrows and survives a view that has nothing rendered yet", () => {
  const { view, svg, el } = makeView();
  assert.doesNotThrow(() => view.setArrows([{ kind: "best", from: "e2", to: "e4" }]), "no model yet: nothing to do");
  view.render(model(START));
  const pawn = piecesIn(squareEl(el, "e2"))[0];
  view.setArrows([{ kind: "best", from: "e2", to: "e4" }, { kind: "hint", from: "g1", to: "f3" }]);
  assert.strictEqual(findAll(svg, (n) => n.classList.contains("bd-arrow")).length, 2);
  assert.strictEqual(piecesIn(squareEl(el, "e2"))[0], pawn, "the pieces were not touched");
  view.setArrows(null);
  assert.strictEqual(findAll(svg, (n) => n.classList.contains("bd-arrow")).length, 0);
  view.destroy();
});

test("click: a click on a square (or on its piece) reports the square; suppressed clicks are ignored once", () => {
  const { view, el, log } = makeView();
  view.render(model(START));
  squareEl(el, "e2").dispatch("click", { clientX: 10, clientY: 10 });
  piecesIn(squareEl(el, "e7"))[0].dispatch("click");
  same(log.squares, [["e2", "click"], ["e7", "click"]]);
  // A click on the board element itself (pointer capture retargets it) is resolved from the coordinates.
  el.dispatch("click", { target: el, clientX: 4 * 100 + 50, clientY: 6 * 100 + 50 });
  same(log.squares[2], ["e2", "click"]);
  view.destroy();
});

test("keyboard: arrows move the tab stop and focus, Enter/Space activate, Escape cancels only with a selection", () => {
  const { view, el, log, doc } = makeView();
  view.render(model(START, { focus: "e2" }));
  const e2 = squareEl(el, "e2");
  const prevented = [];
  const key = (node, k, extra) => node.dispatch("keydown", Object.assign({ key: k, preventDefault() { prevented.push(k); } }, extra));
  key(e2, "ArrowUp");
  assert.strictEqual(doc.activeElement, squareEl(el, "e3"));
  assert.strictEqual(squareEl(el, "e3").getAttribute("tabindex"), "0");
  assert.strictEqual(squareEl(el, "e2").getAttribute("tabindex"), "-1", "roving tab index");
  assert.strictEqual(view.focus, "e3");
  key(squareEl(el, "e3"), "ArrowRight");
  assert.strictEqual(doc.activeElement, squareEl(el, "f3"));
  key(squareEl(el, "f3"), "Home");
  assert.strictEqual(doc.activeElement, squareEl(el, "a3"));
  const before = doc.activeElement;
  key(squareEl(el, "a3"), "ArrowLeft");
  assert.strictEqual(doc.activeElement, before, "the edge does not wrap");
  assert.ok(prevented.includes("ArrowLeft"), "the page does not scroll from an arrow key on the board");
  key(squareEl(el, "a3"), "Enter");
  key(squareEl(el, "a3"), " ");
  same(log.squares, [["a3", "key"], ["a3", "key"]]);
  key(squareEl(el, "a3"), "a", {});
  key(squareEl(el, "a3"), "Enter", { ctrlKey: true });
  assert.strictEqual(log.squares.length, 2, "shortcuts and other letters are left alone");
  key(squareEl(el, "a3"), "Escape");
  same(log.cancels, [], "nothing selected: Escape belongs to someone else");
  view.render(model(START, { selected: "e2", targets: [{ square: "e4" }] }));
  key(squareEl(el, "e2"), "Escape");
  same(log.cancels, ["escape"]);
  view.destroy();
});

test("keyboard: focusing a square reports it and moves the tab stop", () => {
  const { view, el, log } = makeView();
  view.render(model(START, { focus: "e2" }));
  squareEl(el, "b1").dispatch("focusin");
  same(log.focus, ["b1"]);
  assert.strictEqual(squareEl(el, "b1").getAttribute("tabindex"), "0");
  assert.strictEqual(squareEl(el, "e2").getAttribute("tabindex"), "-1");
  view.render(model(START, { focus: "b1" }));
  assert.strictEqual(squareEl(el, "b1").getAttribute("tabindex"), "0");
  view.destroy();
});

test("live region: created on first use, polite, and the text arrives on the next tick", async () => {
  const { view, wrap } = makeView();
  view.render(model(START));
  assert.strictEqual(findAll(wrap, (n) => n.classList.contains("bd-live")).length, 0, "created lazily");
  view.announce("Hello");
  await new Promise((resolve) => setTimeout(resolve, 60));
  const region = findAll(wrap, (n) => n.classList.contains("bd-live"))[0];
  assert.ok(region, "the region exists once something is announced");
  assert.strictEqual(region.getAttribute("role"), "status");
  assert.strictEqual(region.getAttribute("aria-live"), "polite");
  assert.strictEqual(region.textContent, "Hello");
  view.destroy();
});

test("announcements use the registered strings in both languages", () => {
  const { Ludus } = env;
  Ludus.i18n.setLanguage("es", { persist: false });
  assert.ok(/Elegiste g1/.test(Ludus.i18n.t("bd.live.selected", { square: "g1", list: "f3, h3" })));
  assert.ok(/no es una jugada posible/.test(Ludus.i18n.t("bd.live.illegal", { square: "a5" })));
  assert.strictEqual(Ludus.i18n.t("bd.state.check"), ", rey en jaque");
  Ludus.i18n.setLanguage("en", { persist: false });
  assert.ok(/Selected g1\. Can move to: f3, h3/.test(Ludus.i18n.t("bd.live.selected", { square: "g1", list: "f3, h3" })));
  assert.strictEqual(Ludus.i18n.t("bd.state.check"), ", king in check");
  ["selected", "selectedMany", "selectedNone", "cleared", "illegal"].forEach((k) => {
    ["es", "en"].forEach((lang) => assert.notStrictEqual(Ludus.i18n.t(`bd.live.${k}`, {}, lang), `bd.live.${k}`, `${lang} ${k}`));
  });
  ["check", "last", "best.from", "best.to", "user.from", "user.to", "userAlt.from", "userAlt.to", "game.from", "game.to"].forEach((k) => {
    ["es", "en"].forEach((lang) => assert.notStrictEqual(Ludus.i18n.t(`bd.state.${k}`, {}, lang), `bd.state.${k}`, `${lang} ${k}`));
  });
});

// Pointer input on the fake element. `pointerType` decides the threshold.
function pointer(target, type, x, y, extra) {
  return target.dispatch(type, Object.assign({ pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true, clientX: x, clientY: y, preventDefault() {} }, extra));
}
const at = (name, orientation = "w") => {
  const cell = Board.cellOf(name, orientation);
  return [cell.col * 100 + 50, cell.row * 100 + 50];
};

test("pointer: pressing an own piece selects it at once; a plain tap swallows its click and leaves it selected", () => {
  const { view, el, log } = makeView();
  view.render(model(START));
  const [x, y] = at("e2");
  pointer(squareEl(el, "e2"), "pointerdown", x, y);
  same(log.squares, [["e2", "press"]]);
  pointer(squareEl(el, "e2"), "pointerup", x, y);
  squareEl(el, "e2").dispatch("click", { clientX: x, clientY: y });
  same(log.squares, [["e2", "press"]], "the click that follows the tap is not handled twice");
  squareEl(el, "e2").dispatch("click", { clientX: x, clientY: y });
  assert.strictEqual(log.squares.length, 2, "but only that one click is swallowed");
  view.destroy();
});

test("pointer: nothing starts on the other side's piece, an empty square, a stopped board or with drag off", () => {
  const { view, el, log, settings } = makeView();
  view.render(model(START));
  pointer(squareEl(el, "e7"), "pointerdown", ...at("e7"));
  pointer(squareEl(el, "e4"), "pointerdown", ...at("e4"));
  pointer(squareEl(el, "e2"), "pointerdown", ...at("e2"), { button: 2 });
  pointer(squareEl(el, "e2"), "pointerdown", ...at("e2"), { isPrimary: false, pointerType: "touch" });
  same(log.squares, []);
  view.render(model(START, { interactive: false }));
  pointer(squareEl(el, "e2"), "pointerdown", ...at("e2"));
  same(log.squares, []);
  view.render(model(START));
  settings["board.drag"] = false;
  pointer(squareEl(el, "e2"), "pointerdown", ...at("e2"));
  same(log.squares, []);
  view.destroy();
});

test("pointer: drag to a legal square shows a ghost, then drops; the ghost is gone and no slide is played for it", () => {
  const { view, el, log, doc } = makeView({ animate: true });
  const legal = [{ square: "e3" }, { square: "e4" }];
  const selected = model(START, { selected: "e2", targets: legal });
  view.render(model(START));
  const from = at("e2");
  pointer(squareEl(el, "e2"), "pointerdown", ...from);
  view.render(selected);
  assert.ok(!doc.body.classList.contains("bd-drag-active"));
  const to = at("e4");
  pointer(el, "pointermove", from[0] + 2, from[1] - 2);
  assert.strictEqual(view.isDragging(), false, "still below the threshold");
  pointer(el, "pointermove", from[0], from[1] - 60);
  assert.strictEqual(view.isDragging(), true);
  assert.ok(doc.body.classList.contains("bd-drag-active"));
  const ghosts = findAll(doc.body, (n) => n.classList.contains("bd-ghost"));
  assert.strictEqual(ghosts.length, 1);
  assert.strictEqual(ghosts[0].getAttribute("src"), "assets/pieces/cburnett/wP.svg");
  assert.strictEqual(ghosts[0].getAttribute("aria-hidden"), "true");
  assert.ok(classesOf(el, "e2").includes("bd-drag-src"), "the piece left behind is dimmed");
  pointer(el, "pointermove", ...to);
  assert.ok(classesOf(el, "e4").includes("bd-over"), "the square under the pointer is marked");
  assert.ok(/translate3d\(/.test(ghosts[0].style.transform));
  pointer(el, "pointerup", ...to);
  same(log.moves, [["e2", "e4"]]);
  assert.strictEqual(view.isDragging(), false);
  assert.ok(!doc.body.classList.contains("bd-drag-active"));
  assert.strictEqual(findAll(doc.body, (n) => n.classList.contains("bd-ghost")).length, 0, "the ghost is removed");
  assert.ok(!classesOf(el, "e2").includes("bd-drag-src") && !classesOf(el, "e4").includes("bd-over"));
  el.dispatch("click", { target: el, clientX: to[0], clientY: to[1] });
  same(log.squares, [["e2", "press"]], "the click after a drop is swallowed");
  view.destroy();
});

test("pointer: dropping where the piece cannot go snaps back and keeps the selection; outside the board cancels it", () => {
  const { view, el, log, doc } = makeView();
  view.render(model(START));
  const from = at("e2");
  const bad = at("a5");
  pointer(squareEl(el, "e2"), "pointerdown", ...from);
  view.render(model(START, { selected: "e2", targets: [{ square: "e4" }] }));
  pointer(el, "pointermove", from[0], from[1] - 50);
  pointer(el, "pointerup", ...bad);
  same(log.moves, []);
  same(log.cancels, [], "an illegal drop keeps the piece selected");
  assert.strictEqual(findAll(doc.body, (n) => n.classList.contains("bd-ghost")).length, 0);
  // Outside the board.
  pointer(squareEl(el, "e2"), "pointerdown", ...from);
  pointer(el, "pointermove", from[0], from[1] - 50);
  pointer(el, "pointerup", 900, 900);
  same(log.moves, []);
  same(log.cancels, ["outside"]);
  view.destroy();
});

test("pointer: Escape, pointercancel and blur cancel a drag cleanly", () => {
  const listeners = {};
  const { view, el, log, doc } = makeView({ window: { addEventListener(type, fn) { listeners[type] = fn; } } });
  view.render(model(START));
  const from = at("e2");
  function startDrag() {
    pointer(squareEl(el, "e2"), "pointerdown", ...from);
    view.render(model(START, { selected: "e2", targets: [{ square: "e4" }] }));
    pointer(el, "pointermove", from[0], from[1] - 50);
    assert.strictEqual(view.isDragging(), true);
  }
  startDrag();
  const handlers = doc.listeners.get("keydown") || [];
  assert.strictEqual(handlers.length, 1, "Escape is watched on the document while dragging");
  let prevented = false;
  handlers[0]({ key: "Escape", preventDefault() { prevented = true; }, stopPropagation() {} });
  assert.ok(prevented);
  assert.strictEqual(view.isDragging(), false);
  same(log.cancels, ["escape"]);
  assert.strictEqual((doc.listeners.get("keydown") || []).length, 0, "and no longer afterwards");
  startDrag();
  pointer(el, "pointercancel", 0, 0);
  assert.strictEqual(view.isDragging(), false);
  same(log.cancels, ["escape", "pointercancel"]);
  startDrag();
  listeners.blur();
  assert.strictEqual(view.isDragging(), false);
  same(log.cancels, ["escape", "pointercancel", "blur"]);
  assert.strictEqual(findAll(doc.body, (n) => n.classList.contains("bd-ghost")).length, 0);
  assert.ok(!doc.body.classList.contains("bd-drag-active"));
  view.destroy();
});

test("pointer: a drag of a touch pointer uses the finger threshold and the second finger is ignored", () => {
  const { view, el, log } = makeView();
  view.render(model(START));
  const from = at("g1");
  pointer(squareEl(el, "g1"), "pointerdown", ...from, { pointerType: "touch", pointerId: 5 });
  same(log.squares, [["g1", "press"]]);
  pointer(el, "pointermove", from[0] + 6, from[1], { pointerType: "touch", pointerId: 5 });
  assert.strictEqual(view.isDragging(), false);
  pointer(el, "pointerdown", ...at("b1"), { pointerType: "touch", pointerId: 6 });
  assert.strictEqual(log.squares.length, 1, "a second finger does not select anything");
  pointer(el, "pointermove", from[0] + 12, from[1] - 30, { pointerType: "touch", pointerId: 5 });
  assert.strictEqual(view.isDragging(), true);
  view.cancelDrag();
  assert.strictEqual(view.isDragging(), false);
  view.destroy();
});

test("contextmenu and dragstart are prevented on the board so a long press or a native image drag cannot interfere", () => {
  const { view, el } = makeView();
  view.render(model(START));
  let contextPrevented = 0;
  let dragPrevented = 0;
  el.dispatch("contextmenu", { pointerType: "touch", preventDefault() { contextPrevented += 1; } });
  el.dispatch("contextmenu", { pointerType: "mouse", preventDefault() { contextPrevented += 1; } });
  el.dispatch("dragstart", { preventDefault() { dragPrevented += 1; } });
  assert.strictEqual(contextPrevented, 1, "only for touch (or while pressing): a mouse right-click keeps its menu");
  assert.strictEqual(dragPrevented, 1);
  view.destroy();
});

// ---------- animation bookkeeping (Web Animations replaced by a recorder) ----------

test("animation: a move slides the same element from its old square, the capture fades after the mover arrives", () => {
  const { view, el, calls } = makeView({ animate: true });
  const italian = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
  view.render(model(italian));
  assert.strictEqual(calls.filter((c) => c.keyframes[0].transform).length, 0, "the first position is not a slide");
  assert.ok(calls.length > 0 && calls.every((c) => c.keyframes[0].opacity === 0), "it fades in instead");
  calls.splice(0);
  const knight = piecesIn(squareEl(el, "f3"))[0];
  const victim = piecesIn(squareEl(el, "e5"))[0];
  view.render(model(italian, { pieces: after(italian, "f3e5") }));
  const slide = calls.find((c) => c.node === knight);
  assert.ok(slide, "the knight is animated");
  // f3 -> e5: one file to the left, two ranks up: it starts one square right and two squares below its target.
  assert.strictEqual(slide.keyframes[0].transform, "translate(100%, 200%)");
  assert.strictEqual(slide.keyframes[1].transform, "translate(0%, 0%)");
  assert.ok(slide.options.duration >= 170 && slide.options.duration <= 300);
  assert.ok(knight.classList.contains("bd-moving"));
  const fade = calls.find((c) => c.node === victim);
  assert.ok(fade, "the captured pawn fades");
  assert.strictEqual(fade.options.delay > 0, true, "and waits for the knight to arrive");
  assert.strictEqual(victim.parentNode, squareEl(el, "e5"), "it stays in its square while it fades");
  assert.ok(victim.classList.contains("bd-leaving"));
  slide.finish();
  fade.finish();
  assert.ok(!knight.classList.contains("bd-moving"));
  assert.strictEqual(victim.parentNode, null, "removed when the fade ends");
  assert.strictEqual(piecesIn(squareEl(el, "e5")).length, 1);
  view.destroy();
});

test("animation: a new render while something is moving cancels it and leaves nothing behind", () => {
  const { view, el, calls } = makeView({ animate: true });
  const italian = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
  view.render(model(italian));
  calls.splice(0);
  const victim = piecesIn(squareEl(el, "e5"))[0];
  view.render(model(italian, { pieces: after(italian, "f3e5") }));
  assert.ok(calls.some((c) => c.node === victim));
  const running = calls.filter((c) => !c.finished && !c.cancelled);
  assert.ok(running.length >= 2);
  view.render(model(italian, { pieces: after(italian, "f3e5", "c6e5") }));
  assert.ok(running.every((c) => c.cancelled), "the earlier animations were cancelled");
  assert.strictEqual(victim.parentNode, null, "the fading piece is dropped at once");
  // Only the piece captured by the second move is fading; nothing is left from the first capture.
  const fading = findAll(el, (n) => n.classList.contains("bd-leaving"));
  assert.strictEqual(fading.length, 1);
  assert.strictEqual(fading[0].dataset.piece, "wN");
  assert.strictEqual(piecesIn(squareEl(el, "e5")).length, 1);
  view.destroy();
});

test("animation: castling slides both pieces, a promotion slides the pawn and turns it into the new piece", () => {
  const { view, el, calls } = makeView({ animate: true });
  const castle = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
  view.render(model(castle));
  calls.splice(0);
  const king = piecesIn(squareEl(el, "e1"))[0];
  const rook = piecesIn(squareEl(el, "h1"))[0];
  view.render(model(castle, { pieces: after(castle, "e1g1") }));
  const moved = calls.filter((c) => c.keyframes[0].transform).map((c) => c.node);
  assert.ok(moved.includes(king) && moved.includes(rook));
  assert.strictEqual(piecesIn(squareEl(el, "g1"))[0], king);
  assert.strictEqual(piecesIn(squareEl(el, "f1"))[0], rook);

  const promo = "7k/P7/8/8/8/8/8/K7 w - - 0 1";
  view.render(model(promo));
  const pawn = piecesIn(squareEl(el, "a7"))[0];
  calls.splice(0);
  view.render(model(promo, { pieces: after(promo, "a7a8q") }));
  const queen = piecesIn(squareEl(el, "a8"))[0];
  assert.strictEqual(queen, pawn, "the pawn element becomes the queen");
  assert.strictEqual(queen.dataset.piece, "wQ");
  assert.strictEqual(queen.getAttribute("src"), "assets/pieces/cburnett/wQ.svg");
  assert.ok(calls.some((c) => c.node === queen && c.keyframes[0].transform));
  view.destroy();
});

test("animation: a dropped piece does not slide (it is already there) but the captured piece still fades", () => {
  const { view, el, calls, log } = makeView({ animate: true });
  const italian = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
  view.render(model(italian));
  calls.splice(0);
  const targets = [{ square: "e5", capture: true }];
  // The person picks the knight and drops it on e5: the view notes the drop while the game core renders.
  const view2 = view;
  const from = at("f3");
  pointer(squareEl(el, "f3"), "pointerdown", ...from);
  view2.render(model(italian, { selected: "f3", targets }));
  pointer(el, "pointermove", from[0] - 60, from[1] - 60);
  const knight = piecesIn(squareEl(el, "f3"))[0];
  // onMove is where the core plays the move and renders synchronously.
  const original = log.moves.push.bind(log.moves);
  log.moves.push = (entry) => {
    original(entry);
    view2.render(model(italian, { pieces: after(italian, "f3e5") }));
  };
  pointer(el, "pointerup", ...at("e5"));
  same(log.moves, [["f3", "e5"]]);
  assert.strictEqual(piecesIn(squareEl(el, "e5"))[0], knight);
  assert.strictEqual(calls.filter((c) => c.node === knight && c.keyframes[0].transform).length, 0, "no slide for a dropped piece");
  assert.ok(calls.some((c) => c.keyframes[0].opacity === 1 && c.keyframes[1].opacity === 0), "the capture still fades");
  view.destroy();
});

test("animation: off, reduce and a missing Web Animations API all mean instant moves with no leftovers", () => {
  const italian = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
  [{ "board.animation": "off" }, { "board.animation": "on", "a11y.motion": "reduce" }].forEach((settings) => {
    const { view, el, calls } = makeView({ animate: true, settings });
    view.render(model(italian));
    view.render(model(italian, { pieces: after(italian, "f3e5") }));
    assert.strictEqual(calls.length, 0, JSON.stringify(settings));
    assert.strictEqual(piecesIn(squareEl(el, "e5")).length, 1, "the captured piece is gone immediately");
    assert.strictEqual(findAll(el, (n) => n.classList.contains("bd-leaving")).length, 0);
    view.destroy();
  });
  const { view, el } = makeView({ settings: { "board.animation": "on" } });
  view.render(model(italian));
  assert.doesNotThrow(() => view.render(model(italian, { pieces: after(italian, "f3e5") })), "no animate() on the elements");
  assert.strictEqual(piecesIn(squareEl(el, "e5")).length, 1);
  view.destroy();
});

test("animation: a chain of moves (one piece lands where another leaves) moves both elements, nothing fades", () => {
  const { view, el, calls } = makeView({ animate: true });
  const before = "4k3/8/8/4B3/8/2N5/8/4K3 w - - 0 1";
  const after = "4k3/8/8/3N4/8/2B5/8/4K3 w - - 0 1";
  view.render(model(before));
  const knight = piecesIn(squareEl(el, "c3"))[0];
  const bishop = piecesIn(squareEl(el, "e5"))[0];
  calls.splice(0);
  view.render(model(after));
  assert.strictEqual(piecesIn(squareEl(el, "d5"))[0], knight, "the knight element went to d5");
  assert.strictEqual(piecesIn(squareEl(el, "c3"))[0], bishop, "the bishop element went to c3");
  assert.strictEqual(findAll(el, (n) => n.classList.contains("bd-leaving")).length, 0, "nobody was taken for a capture");
  assert.strictEqual(calls.filter((c) => c.keyframes[0].transform).length, 2);
  view.destroy();
});

test("animation: an unrelated position (a new round) is faded in, not shuffled", () => {
  const { view, calls } = makeView({ animate: true });
  view.render(model(START));
  calls.splice(0);
  view.render(model("r3k2r/pp3ppp/2n2n2/2b1p3/4P3/2N2N2/PP3PPP/R1B1K2R w KQkq - 0 1"));
  assert.ok(calls.length > 0);
  assert.ok(calls.every((c) => c.keyframes[0].opacity === 0 && c.keyframes[1].opacity === 1), "only fades");
  view.destroy();
});

test("flipping the board rebuilds the squares and keeps the position", () => {
  const { view, el } = makeView();
  view.render(model(START));
  view.setOrientation("b");
  assert.strictEqual(findAll(el, (n) => n.dataset && n.dataset.square)[0].dataset.square, "h1");
  assert.strictEqual(findAll(el, (n) => n.classList.contains("bd-piece")).length, 32, "the pieces are drawn again after the flip");
  assert.strictEqual(piecesIn(squareEl(el, "e1")).length, 1);
  view.destroy();
});

test("render on a view without a model, with junk input or after destroy never throws", () => {
  const { view } = makeView();
  assert.doesNotThrow(() => view.render(null));
  assert.doesNotThrow(() => view.render({ pieces: "garbage", selected: "zz", targets: [null, { square: "q9" }, "e4"], marks: { best: { from: "e2" } }, arrows: [null, 3, {}], hint: { from: "nope" } }));
  view.destroy();
  assert.strictEqual(view.render(model(START)), false);
  assert.doesNotThrow(() => view.destroy());
});

test("board.js loads without any DOM and exposes the pure API", () => {
  const sandbox = {};
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(repoRoot, "js/ui/board.js"), "utf8"), context, { filename: "board.js" });
  assert.strictEqual(typeof context.Ludus.Board.planMoves, "function");
  assert.strictEqual(typeof context.Ludus.Board.create, "function");
  assert.strictEqual(context.Ludus.Board.create({}), null);
  assert.strictEqual(context.Ludus.Board.squareFromPoint(0.5, 0.5, { left: 0, top: 0, width: 8, height: 8 }, "w"), "a8");
});

// ---------- run ----------

(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok - ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`not ok - ${name}\n${error && error.stack ? error.stack : error}`);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} board tests passed`);
  if (failed) process.exit(1);
})();
