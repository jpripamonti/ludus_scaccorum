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
vm.runInNewContext(`${appSource}\nglobalThis.__ludusTest = { Chess, STATE, uciToMove, moveToSan, sanToMove, localFallbackDepth, sessionSummaryScoreText };`, context);

const { Chess, STATE, uciToMove, moveToSan, sanToMove, localFallbackDepth, sessionSummaryScoreText } = context.__ludusTest;

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

console.log("chess-regression-check passed");
