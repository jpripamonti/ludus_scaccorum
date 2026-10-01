// Tests for the notebook screen (js/ui/notebook.js) against the real Profile, Chess, Insights, Concepts and
// Scoring modules and the fake DOM of _uidom.js.
//
// Covers: text parity es / en; the pure helpers (when a card is due in words across DST changes and midnight,
// the summary and its next review, statuses, filters and sorts, weak spots, which cards a session takes,
// the position built from a card with and without a complete set of lines, where a card comes from, your
// move against the best one, the box chart geometry, the engine lines as text); and the screen: the empty
// state, the summary against Profile.notebook.counts, "Review N now" and its session (kind, title, the
// positions with their card ids and references), the 5 / 10 / 20 picker remembered in storage, "Practice
// anyway" when nothing is due, the weak spots that train one theme, filters, search and sort, the show more
// button, the stored lines panel, review of one card, the confirmed removal, the lesson dialog, a failing
// game core, the language switch and the degradation without its modules. The screen never grades a card
// itself (Profile does when the game core records the round).

"use strict";

// A time zone with daylight saving time, set before any Date is used: the "days" tests cross a change.
process.env.TZ = "Europe/Madrid";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { FakeDocument, findAll, byClass } = require("./_uidom.js");
const { createFakeLocalStorage } = require("./_fakedom.js");

const repoRoot = path.resolve(__dirname, "..", "..");
const SCRIPTS = [
  "js/ludus.js", "js/chess.js", "js/scoring.js", "js/insights.js", "js/concepts.js", "js/profile.js", "js/ui/kit.js", "js/ui/notebook.js",
];

const NOW = new Date(2026, 8, 30, 12, 0, 0).getTime(); // Wednesday 30 September 2026, noon
const DAY = 86400000;

function createEnv({ language = "es", skip = [], now = NOW } = {}) {
  const doc = new FakeDocument();
  const storageMap = new Map();
  const clock = { now: 0, seq: 0, timers: new Map() };
  const sandbox = {
    console, Date, Math, JSON, Object, Array, String, Number, Promise, Map, Set, Intl, URL, structuredClone, WeakMap, WeakSet, performance: { now: () => clock.now },
    setTimeout(fn, ms) { clock.seq += 1; clock.timers.set(clock.seq, { at: clock.now + Number(ms || 0), fn }); return clock.seq; },
    clearTimeout(id) { clock.timers.delete(id); },
    document: doc,
    navigator: { languages: [language], language },
    localStorage: createFakeLocalStorage(storageMap),
    location: { hash: "", pathname: "/", search: "" },
    addEventListener() {},
    removeEventListener() {},
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  SCRIPTS.filter((rel) => !skip.includes(rel)).forEach((rel) => vm.runInContext(fs.readFileSync(path.join(repoRoot, rel), "utf8"), context, { filename: rel }));
  const Ludus = context.Ludus;
  Ludus.i18n.setLanguage(language, { persist: false });
  Ludus.util.now = () => env.now;
  if (Ludus.ui) Ludus.ui._setTimers({ setTimeout: sandbox.setTimeout, clearTimeout: sandbox.clearTimeout, raf(fn) { fn(); }, now: () => clock.now });
  const advance = (ms) => {
    const target = clock.now + ms;
    for (;;) {
      let next = null;
      let nextId = 0;
      clock.timers.forEach((timer, id) => { if (timer.at <= target && (!next || timer.at < next.at)) { next = timer; nextId = id; } });
      if (!next) break;
      clock.timers.delete(nextId);
      clock.now = Math.max(clock.now, next.at);
      next.fn();
    }
    clock.now = target;
  };
  const mk = (tag, attrs) => {
    const el = doc.createElement(tag);
    Object.keys(attrs || {}).forEach((key) => el.setAttribute(key, attrs[key]));
    return el;
  };
  const app = mk("div", { class: "app" });
  doc.body.appendChild(app);
  const el = mk("section", { id: "screen-notebook", class: "screen hidden" });
  const other = mk("section", { id: "screen-home", class: "screen hidden" });
  const museum = mk("section", { id: "screen-museum", class: "screen hidden" });
  const classics = mk("section", { id: "screen-classics", class: "screen hidden" });
  app.appendChild(el);
  app.appendChild(other);
  app.appendChild(museum);
  app.appendChild(classics);
  Ludus.router.register("notebook", { el, onShow: (params) => Ludus.Screens.notebook.show(params), onHide: () => Ludus.Screens.notebook.hide() });
  Ludus.router.register("home", { el: other });
  Ludus.router.register("museum", { el: museum });
  Ludus.router.register("classics", { el: classics });
  const calls = [];
  const game = { calls, fail: false, startSession: async (config) => { calls.push(config); if (game.fail) throw new Error("no playable positions"); }, isActive: () => false };
  Ludus.game = game;
  const env = { Ludus, doc, el, advance, game, calls, now, storageMap };
  return env;
}

const text = (node) => node.textContent.replace(/\s+/g, " ").trim();
const q = (root, selector) => root.querySelector(selector);
const all = (root, selector) => root.querySelectorAll(selector);
const plain = (value) => JSON.parse(JSON.stringify(value));
const deepEq = (actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message);
const placeholders = (string) => Array.from(String(string).matchAll(/\{(\w+)\}/g), (m) => m[1]).sort().join(",");

let passed = 0;
const pending = [];
function test(name, fn) {
  pending.push({ name, fn });
}
async function runAll() {
  for (const { name, fn } of pending) {
    if (process.env.ONLY && !name.includes(process.env.ONLY)) continue;
    let watchdog = null;
    try {
      await Promise.race([fn(), new Promise((_, reject) => { watchdog = setTimeout(() => reject(new Error(`test never settled: ${name}`)), 8000); })]);
      clearTimeout(watchdog);
      passed += 1;
      console.log(`  ok  ${name}`);
    } catch (error) {
      clearTimeout(watchdog);
      console.error(`  FAIL  ${name}`);
      throw error;
    }
  }
}

// ---------- fixtures ----------

const FENS = [
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
  "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
  "8/5pk1/6p1/8/8/6P1/5PK1/8 w - - 0 40",
  "r2q1rk1/ppp2ppp/2np1n2/2b1p1B1/2B1P1b1/2NP1N2/PPP2PPP/R2Q1RK1 w - - 0 8",
  "r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R1BQ1RK1 w - - 0 9",
  "2r3k1/pp3ppp/8/3p4/3P4/2P5/PP3PPP/2R3K1 w - - 0 25",
  "r3k2r/pppq1ppp/2n1bn2/3pp3/3PP3/2N1BN2/PPPQ1PPP/R3K2R w KQkq - 4 9",
];

// Real legal first moves of a position, as lines with descending scores.
function linesFor(env, fen, count = 3) {
  const { Chess, moveToUci, moveToSan } = env.Ludus.chess;
  const chess = new Chess(fen);
  const moves = chess.generateMoves().slice(0, count);
  return moves.map((move, i) => ({ uci: moveToUci(move), san: moveToSan(chess, move), score: 120 - i * 60, pv: [moveToUci(move)] }));
}

let roundSeq = 0;
function round(env, fen, overrides = {}) {
  roundSeq += 1;
  const lines = "lines" in overrides ? overrides.lines : linesFor(env, fen);
  const { Chess, moveToUci, moveToSan } = env.Ludus.chess;
  const chess = new Chess(fen);
  const moves = chess.generateMoves();
  const userMove = moves[moves.length - 1];
  return Object.assign({
    id: `r_t${roundSeq}`,
    ts: NOW - DAY * 10,
    sessionId: "s_t1",
    sessionKind: "own",
    source: "own",
    fen,
    sideToMove: chess.turn,
    phase: "middlegame",
    userUci: moveToUci(userMove),
    userSan: moveToSan(chess, userMove),
    bestUci: lines[0] ? lines[0].uci : null,
    bestSan: lines[0] ? lines[0].san : "",
    points: 2,
    accuracy: 20,
    qualityCode: "blunder",
    winLossPct: 30,
    cpLoss: 300,
    isBest: false,
    rank: 5,
    onlyMove: false,
    timeSpentMs: 9000,
    hintsUsed: 0,
    timedOut: false,
    tags: ["hangs_piece"],
    lines,
    meta: { players: "Lucía vs Marta", event: "Lichess blitz", year: 2026, moveNumber: 12 },
  }, overrides);
}

// n mistake cards (one per FEN), all due; returns the cards.
function seedCards(env, n, tweak) {
  const Profile = env.Ludus.Profile;
  Profile.ensureActive();
  for (let i = 0; i < n; i += 1) {
    const fen = FENS[i % FENS.length];
    // Distinct positions beyond the fixtures: change the halfmove clock part is not enough (the card id ignores
    // the counters), so move a pawn's en passant square... simply use the fixtures only.
    assert.ok(i < FENS.length, "the fixtures hold 8 positions");
    const r = round(env, fen, Object.assign({ ts: NOW - DAY * (12 - i) }, tweak ? tweak(i) : {}));
    const result = Profile.recordRound(r);
    assert.ok(result && result.ok, `recordRound ${i}: ${Profile.lastError()}`);
  }
  return Profile.notebook.list({ sort: "due", now: env.now });
}

// A card passed at `ts` (a review round of source "notebook"): Profile grades it.
function passCard(env, card, ts, accuracy = 90) {
  const result = env.Ludus.Profile.recordRound(round(env, card.fen, { ts, source: "notebook", sessionKind: "review", accuracy, points: accuracy / 10, qualityCode: "very_good", isBest: true, tags: [], lines: card.lines }));
  assert.ok(result && result.ok);
}

function open(env, params) {
  env.Ludus.Screens.notebook.mount(env.el);
  env.Ludus.router.show("notebook", params);
  return env.el;
}

const nb = (env) => env.Ludus.Screens.notebook;
const helpers = (env) => env.Ludus.Screens.notebook.helpers;
const cardEls = (el) => all(el, ".notebook-card");
const startBtn = (el) => q(el, "#notebook-start");

// ---------- pure ----------

test("text: es and en have the same keys and placeholders, none empty; the title key resolves; rioplatense", () => {
  const env = createEnv();
  const { es, en } = nb(env).TEXT;
  deepEq(Object.keys(es).sort(), Object.keys(en).sort());
  Object.keys(es).forEach((key) => {
    assert.ok(es[key].length > 0 && en[key].length > 0, `${key} is empty`);
    assert.strictEqual(placeholders(es[key]), placeholders(en[key]), `${key}: placeholders differ`);
    assert.ok(key.startsWith("notebook."));
  });
  assert.strictEqual(nb(env).titleKey, "notebook.title");
  assert.strictEqual(env.Ludus.i18n.t("notebook.title", null, "es"), "Cuaderno");
  assert.strictEqual(env.Ludus.i18n.t("notebook.title", null, "en"), "Notebook");
  assert.ok(es["notebook.empty.body"].includes("te equivocás") && es["notebook.sub"].includes("jugás"), "voseo");
  ["notebook.count", "notebook.next.count", "notebook.review.start", "notebook.due.label", "notebook.when.overdue", "notebook.weak.cards", "notebook.count.of", "notebook.boxes.cards"].forEach((key) => {
    assert.ok(`${key}.one` in es && `${key}.one` in en, `${key} has a singular`);
  });
});

test("when: today, later today, overdue, tomorrow and n days, counted in calendar days across DST changes", () => {
  const h = helpers(createEnv());
  const at = (y, m, d, hh = 0, mm = 0) => new Date(y, m, d, hh, mm).getTime();
  deepEq(h.whenOf(at(2026, 8, 30, 9), at(2026, 8, 30, 12)), { kind: "today", n: 0, due: true });
  deepEq(h.whenOf(at(2026, 8, 30, 18), at(2026, 8, 30, 12)), { kind: "later", n: 0, due: false });
  deepEq(h.whenOf(at(2026, 8, 24, 0), at(2026, 8, 30, 12)), { kind: "overdue", n: 6, due: true });
  deepEq(h.whenOf(at(2026, 8, 29, 0), at(2026, 8, 30, 12)), { kind: "overdue", n: 1, due: true });
  // The card is due at local midnight; one minute before it, it is tomorrow.
  deepEq(h.whenOf(at(2026, 9, 1, 0), at(2026, 8, 30, 23, 59)), { kind: "tomorrow", n: 1, due: false });
  deepEq(h.whenOf(at(2026, 9, 3, 0), at(2026, 8, 30, 12)), { kind: "days", n: 3, due: false });
  // Spring forward (Sunday 29 March 2026 has 23 hours) and fall back (Sunday 25 October 2026 has 25 hours).
  deepEq(h.whenOf(at(2026, 2, 30, 0), at(2026, 2, 28, 22)), { kind: "days", n: 2, due: false });
  deepEq(h.whenOf(at(2026, 9, 26, 0), at(2026, 9, 24, 22)), { kind: "days", n: 2, due: false });
  deepEq(h.whenOf(at(2026, 2, 29, 0), at(2026, 2, 28, 23, 30)), { kind: "tomorrow", n: 1, due: false });
  // The turn of the year.
  deepEq(h.whenOf(at(2027, 0, 2, 0), at(2026, 11, 31, 20)), { kind: "days", n: 2, due: false });
  assert.strictEqual(h.localDayNumber(at(2026, 9, 25, 23, 59)) - h.localDayNumber(at(2026, 9, 25, 0, 1)), 0);
  assert.strictEqual(h.daysBetween(at(2026, 9, 24, 12), at(2026, 9, 26, 12)), 2);
});

test("when: the words come from the language of the screen", () => {
  const env = createEnv();
  const t = (key, params) => env.Ludus.i18n.t(key, params);
  assert.strictEqual(t("notebook.when.days", { n: 3 }), "En 3 días");
  assert.strictEqual(t("notebook.when.tomorrow"), "Mañana");
  env.Ludus.i18n.setLanguage("en", { persist: false });
  assert.strictEqual(env.Ludus.i18n.t("notebook.when.days", { n: 3 }), "In 3 days");
  assert.strictEqual(env.Ludus.i18n.t("notebook.when.overdue.one"), "Overdue since yesterday");
});

test("summarize: counts, boxes and the next review of the cards not due yet", () => {
  const h = helpers(createEnv());
  const card = (id, box, due, extra) => Object.assign({ id, box, due, reviews: box > 0 ? 1 : 0, createdAt: 1, lastAccuracy: null }, extra);
  const tomorrow = new Date(2026, 9, 1).getTime();
  const cards = [
    card("a", 0, NOW - DAY), card("b", 1, NOW - 1000), card("c", 3, tomorrow), card("d", 4, tomorrow + 3600000), card("e", 2, new Date(2026, 9, 5).getTime()), card("f", 5, new Date(2026, 9, 30).getTime()),
  ];
  const s = h.summarize(cards, NOW, 3);
  deepEq(s.byBox, [1, 1, 1, 1, 1, 1]);
  assert.strictEqual(s.total, 6);
  assert.strictEqual(s.due, 2);
  assert.strictEqual(s.cleared, 3, "box 3 or higher");
  assert.strictEqual(s.fresh, 1);
  assert.strictEqual(s.learning, 2);
  deepEq(s.next, { ts: tomorrow, count: 2 }, "two cards come back on the same day");
  assert.strictEqual(h.summarize([card("z", 1, NOW - 5)], NOW, 3).next, null, "nothing to wait for when everything is due");
  deepEq(h.summarize([], NOW, 3).byBox, [0, 0, 0, 0, 0, 0]);
  assert.strictEqual(h.summarize(null, NOW).total, 0);
});

test("statuses and filters: status, source, tag, phase, how bad the mistake was, accent-blind words", () => {
  const h = helpers(createEnv());
  const cards = [
    { id: "1", box: 0, reviews: 0, due: NOW - 5, source: "own", phase: "opening", tags: ["hangs_piece"], bestSan: "Nf3", meta: { players: "Lucía vs Ángel", event: "Lichess" } },
    { id: "2", box: 1, reviews: 2, due: NOW + DAY, source: "classic", phase: "endgame", tags: ["fork_available", "hangs_piece"], bestSan: "Qxd5", meta: { players: "Morphy vs Duke", event: "Paris", year: 1858 } },
    { id: "3", box: 4, reviews: 5, due: NOW + 9 * DAY, source: "daily", phase: "middlegame", tags: [], bestSan: "Rd1", meta: {} },
  ];
  const qualities = { 1: "blunder", 2: "dubious", 3: "interesting" };
  const ctx = { now: NOW, qualityOf: (card) => qualities[card.id], tagLabel: (tag) => tag.replace("_", " ") };
  const ids = (filters) => h.filterCards(cards, filters, ctx).map((c) => c.id).join(",");
  assert.strictEqual(ids({}), "1,2,3");
  assert.strictEqual(ids({ status: "due" }), "1");
  assert.strictEqual(ids({ status: "new" }), "1");
  assert.strictEqual(ids({ status: "learning" }), "2");
  assert.strictEqual(ids({ status: "cleared" }), "3");
  assert.strictEqual(ids({ source: "classic" }), "2");
  assert.strictEqual(ids({ tag: "hangs_piece" }), "1,2");
  assert.strictEqual(ids({ tag: "fork_available", phase: "endgame" }), "2");
  assert.strictEqual(ids({ phase: "opening" }), "1");
  assert.strictEqual(ids({ quality: "blunder" }), "1");
  assert.strictEqual(ids({ quality: "dubious" }), "2");
  assert.strictEqual(ids({ quality: "interesting" }), "3", "anything that is not blunder / bad / dubious is the least severe bucket (an inaccuracy)");
  assert.strictEqual(ids({ quality: "mild" }), "1,2,3", "the old word is not a bucket any more: ignored like any unknown value");
  assert.strictEqual(ids({ query: "angel" }), "1", "accent-blind");
  assert.strictEqual(ids({ query: "morphy paris" }), "2", "every word must match");
  assert.strictEqual(ids({ query: "1858" }), "2");
  assert.strictEqual(ids({ query: "nf3" }), "1", "the best move");
  assert.strictEqual(ids({ query: "fork" }), "2", "the label of a theme");
  assert.strictEqual(ids({ query: "zzz" }), "");
  assert.strictEqual(ids({ status: "nonsense", phase: "nonsense", quality: "nonsense" }), "1,2,3", "unknown values are ignored");
  deepEq(h.cleanFilters({ status: "due", tag: 5, query: 7 }), { status: "due", source: "all", tag: "all", phase: "all", quality: "all", query: "" });
  assert.strictEqual(h.moreFiltersActive({ source: "own", tag: "x", status: "due" }), 2);
  assert.strictEqual(h.anyFilterActive({ query: "  " }), false);
  assert.strictEqual(h.anyFilterActive({ status: "cleared" }), true);
});

test("quality of a mistake: from the stored round, else from the accuracy bands; the mistake entry is the one in box 0", () => {
  const h = helpers(createEnv());
  const card = { history: [{ ts: 1, accuracy: 20, passed: false, box: 0, roundId: "r1" }, { ts: 2, accuracy: 90, passed: true, box: 1, roundId: "r2" }] };
  const rounds = new Map([["r1", { id: "r1", userSan: "Qh5", userUci: "d1h5", accuracy: 22.5, points: 2.2, qualityCode: "bad" }]]);
  deepEq(h.yourMoveOf(card, rounds), { san: "Qh5", uci: "d1h5", accuracy: 22.5, points: 2.2, quality: "bad", exact: true });
  deepEq(h.yourMoveOf(card, new Map()), { san: null, uci: null, accuracy: 20, points: null, quality: "bad", exact: false });
  assert.strictEqual(h.yourMoveOf({ history: [] }, rounds), null);
  assert.strictEqual(h.mistakeEntryOf({ history: [{ passed: true, box: 2 }, { passed: false, box: 1 }] }).box, 1, "no box 0: the first failed one");
  assert.strictEqual(h.mistakeEntryOf({ history: [{ passed: false, box: 1, ts: 5 }, { passed: false, box: 0, ts: 9 }] }).ts, 9, "box 0 wins");
  ["blunder:5", "bad:20", "dubious:40", "interesting:60", "good:80", "very_good:95", "perfect:100"].forEach((pair) => {
    const [code, accuracy] = pair.split(":");
    assert.strictEqual(h.qualityFromAccuracy(Number(accuracy)), code);
  });
  assert.strictEqual(h.qualityFromAccuracy(null), null);
  assert.strictEqual(h.qualityBucket("brilliant"), "interesting");
  assert.strictEqual(h.qualityBucket(null), "interesting");
});

test("sort: next review, most recent, worst first (never-reviewed cards last); stable by id", () => {
  const h = helpers(createEnv());
  const cards = [
    { id: "b", due: 5, box: 1, createdAt: 10, lastAccuracy: 50 },
    { id: "a", due: 5, box: 1, createdAt: 30, lastAccuracy: null },
    { id: "c", due: 1, box: 3, createdAt: 20, lastAccuracy: 10 },
    { id: "d", due: 9, box: 0, createdAt: 20, lastAccuracy: 50 },
  ];
  const order = (sort) => h.sortCards(cards, sort).map((c) => c.id).join("");
  assert.strictEqual(order("due"), "cabd");
  assert.strictEqual(order("recent"), "acdb");
  assert.strictEqual(order("worst"), "cdba", "lowest last accuracy first, box breaks the tie, null last");
  assert.strictEqual(order("nonsense"), "cabd");
  assert.strictEqual(cards[0].id, "b", "the input is not reordered");
});

test("weak spots: themes of the cards not cleared, most open cards first, limited", () => {
  const h = helpers(createEnv());
  const cards = [
    { box: 0, tags: ["hangs_piece", "fork_available"] }, { box: 1, tags: ["hangs_piece"] }, { box: 4, tags: ["hangs_piece", "back_rank"] },
    { box: 2, tags: ["fork_available"] }, { box: 5, tags: ["back_rank"] }, { box: 0, tags: [] },
  ];
  deepEq(h.weakSpots(cards, { clearedBox: 3 }), [
    { tag: "hangs_piece", count: 3, open: 2 },
    { tag: "fork_available", count: 2, open: 2 },
  ], "back_rank has no open card and is left out; equal open counts break by the total");
  assert.strictEqual(h.weakSpots(cards, { clearedBox: 3, limit: 1 }).length, 1);
  deepEq(h.weakSpots([], {}), []);
});

test("which cards a session takes: due by date, the lowest boxes to practise, one theme with due ones first", () => {
  const h = helpers(createEnv());
  const mk = (id, box, due, tags) => ({ id, box, due, tags: tags || [] });
  const cards = [mk("a", 2, NOW - 3 * DAY), mk("b", 0, NOW - 1), mk("c", 1, NOW + DAY), mk("d", 0, NOW + 2 * DAY, ["x"]), mk("e", 3, NOW - 2 * DAY, ["x"]), mk("f", 1, NOW + 5 * DAY, ["x"])];
  const ids = (options) => h.pickReviewCards(cards, Object.assign({ now: NOW }, options)).map((c) => c.id).join("");
  assert.strictEqual(ids({ mode: "due", size: 10 }), "aeb", "most overdue first");
  assert.strictEqual(ids({ mode: "due", size: 5 }), "aeb");
  assert.strictEqual(h.pickReviewCards(Array.from({ length: 30 }, (_, i) => mk(`c${i}`, 0, NOW - i - 1)), { now: NOW, size: 20 }).length, 20);
  assert.strictEqual(h.pickReviewCards(Array.from({ length: 30 }, (_, i) => mk(`c${i}`, 0, NOW - i - 1)), { now: NOW, size: 7 }).length, 10, "an unknown size is 10");
  assert.strictEqual(ids({ mode: "practice", size: 5 }), "bdcfa", "lowest boxes first, then the soonest");
  assert.strictEqual(ids({ mode: "tag", tag: "x", size: 5 }), "edf", "the due card first, then the lowest box");
  assert.strictEqual(ids({ mode: "tag", tag: "nothing" }), "");
  assert.strictEqual(h.cleanSize(5), 5);
  assert.strictEqual(h.cleanSize("20"), 20);
  assert.strictEqual(h.cleanSize(7), 10);
});

test("position from a card: fen, source notebook, card id, meta, tags; the reference only from a complete set of lines", () => {
  const env = createEnv();
  const h = helpers(env);
  const fen = FENS[1];
  const lines = linesFor(env, fen, 3);
  const card = { id: "c_abc", fen, box: 1, source: "own", phase: "opening", sideToMove: "b", bestUci: lines[0].uci, bestSan: lines[0].san, lines, tags: ["hangs_piece"], meta: { players: "A vs B", year: 2025 } };
  const position = h.positionFromCard(card, { chess: env.Ludus.chess });
  assert.strictEqual(position.id, "notebook:c_abc");
  assert.strictEqual(position.fen, fen);
  assert.strictEqual(position.source, "notebook");
  assert.strictEqual(position.cardId, "c_abc");
  assert.strictEqual(position.phase, "opening");
  deepEq(position.tags, ["hangs_piece"]);
  assert.strictEqual(position.meta.players, "A vs B");
  assert.strictEqual(position.meta.sideToMove, "b", "filled in from the card");
  assert.strictEqual(position.reference.origin, "precomputed");
  deepEq(position.reference.lines.map((l) => l.uci), lines.map((l) => l.uci));
  assert.strictEqual(position.bestMoveUci, lines[0].uci);
  assert.strictEqual(position.bestMoveSan, lines[0].san);
  position.tags.push("x");
  assert.strictEqual(card.tags.length, 1, "the card is not shared with the position");

  // No lines (a card made while the fallback engine was in charge): neither reference nor best move.
  const bare = h.positionFromCard(Object.assign({}, card, { lines: [], bestUci: null, bestSan: "" }), { chess: env.Ludus.chess });
  assert.strictEqual(bare.reference, undefined);
  assert.strictEqual("bestMoveUci" in bare, false);
  assert.strictEqual("bestMoveSan" in bare, false);
  assert.strictEqual(bare.cardId, "c_abc");
  // A best move stored without lines is not enough either: the round analyses at the root.
  const onlyBest = h.positionFromCard(Object.assign({}, card, { lines: [] }), { chess: env.Ludus.chess });
  assert.strictEqual(onlyBest.reference, undefined);
  assert.strictEqual("bestMoveUci" in onlyBest, false);
});

test("reference lines: one line of many legal moves, unordered scores, illegal moves and junk are not a complete set", () => {
  const env = createEnv();
  const h = helpers(env);
  const fen = FENS[2];
  const good = linesFor(env, fen, 3);
  const ref = (lines, chess) => h.referenceFromCard({ fen, lines }, chess === undefined ? env.Ludus.chess : chess);
  assert.ok(ref(good));
  assert.strictEqual(ref(good.slice(0, 1)), null, "a single line: an only move cannot be told");
  assert.ok(ref(good.slice(0, 2)), "two lines are enough (multiPv 2 is a setting)");
  assert.strictEqual(ref([good[1], good[0], good[2]]), null, "lines that are not best first were not one search");
  assert.strictEqual(ref([{ uci: "a1a1", san: "", score: 0, pv: [] }, good[1]]), null, "a junk move");
  assert.strictEqual(ref([{ uci: "a1a8", san: "", score: 100, pv: ["a1a8"] }, { uci: "h1h8", san: "", score: 50, pv: [] }]), null, "moves that do not exist in the position");
  assert.strictEqual(ref([good[0], { uci: good[0].uci, san: "", score: -5, pv: [] }]), null, "a repeated move leaves one line");
  assert.strictEqual(ref([{ uci: good[0].uci, san: "x", score: "12", pv: [] }, good[1]]), null, "a score that is not a number");
  assert.strictEqual(ref(null), null);
  assert.strictEqual(h.referenceFromCard({ fen: "not a fen", lines: good }, env.Ludus.chess), null, "an unplayable position");
  // A position with a single legal move has one line and that is complete.
  const oneMove = { Chess: class { constructor() { this.turn = "w"; } generateMoves() { return [{}]; } }, uciToMove: () => ({}) };
  assert.ok(h.referenceFromCard({ fen, lines: good.slice(0, 1) }, oneMove));
  const noApi = h.referenceFromCard({ fen, lines: good.slice(0, 2) }, null);
  assert.ok(noApi === null || noApi.lines.length === 2, "without a chess module the shape alone decides");
});

test("origin: your game names the opponent when the profile is one of the players; classics keep the players", () => {
  const h = helpers(createEnv());
  const tr = (key, params) => (params && params.name ? `${key}:${params.name}` : params && params.n ? `${key}:${params.n}` : key);
  const own = h.originOf({ source: "own", meta: { players: "Lucía vs Marta_92", event: "Lichess blitz", year: 2026, moveNumber: 14 } }, { t: tr, profileName: "lucía" });
  deepEq(own, { kind: "own", title: "notebook.origin.own.vs:Marta_92", detail: ["Lichess blitz", "2026", "notebook.origin.move:14"] });
  assert.strictEqual(h.originOf({ source: "own", meta: { players: "Ana vs Marta_92" } }, { t: tr, profileName: "Lucía" }).title, "Ana vs Marta_92");
  assert.strictEqual(h.originOf({ source: "own", meta: { players: "Marta_92 vs Lucía" } }, { t: tr, profileName: "Lucía" }).title, "notebook.origin.own.vs:Marta_92");
  const classic = h.originOf({ source: "classic", meta: { players: "Morphy vs Duke Karl", event: "Paris Opera", year: 1858 } }, { t: tr });
  deepEq(classic, { kind: "classic", title: "Morphy vs Duke Karl", detail: ["Paris Opera", "1858"] });
  // The stored text of a classic is English: the page shows it through options.localize.
  const localize = (meta) => Object.assign({}, meta, { players: "Morphy contra el duque", event: "Partida amistosa" });
  deepEq(h.originOf({ source: "classic", meta: { players: "Morphy vs Duke", event: "Casual game", year: 1858 } }, { t: tr, localize }), { kind: "classic", title: "Morphy contra el duque", detail: ["Partida amistosa", "1858"] });
  assert.strictEqual(h.originOf({ source: "classic", meta: { players: "A vs B" } }, { t: tr, localize: () => null }).title, "A vs B", "a helper that answers nothing keeps the stored text");
  assert.strictEqual(h.originOf({ source: "daily", meta: { event: "Hastings" } }, { t: tr }).title, "Hastings");
  assert.strictEqual(h.originOf({ source: "own", meta: {} }, { t: tr }).title, "", "nothing known: the caller numbers the card");
  assert.strictEqual(h.originOf({ source: "weird", meta: {} }, { t: tr }).kind, "own");
});

test("box chart geometry: columns of at most 24 units from one baseline, an empty box has no bar", () => {
  const h = helpers(createEnv());
  const bars = h.boxBars([6, 13, 7, 0, 4, 9], { width: 320, height: 132 });
  assert.strictEqual(bars.length, 6);
  bars.forEach((b) => {
    assert.ok(b.w <= 24 && b.w >= 6);
    assert.strictEqual(b.y + b.h, b.baseline, "every bar stands on the same baseline");
    assert.ok(b.x >= 0 && b.x + b.w <= 320);
  });
  assert.strictEqual(bars[3].h, 0, "an empty box");
  assert.ok(bars[1].h > bars[0].h && bars[0].h > bars[4].h, "heights follow the counts");
  assert.strictEqual(bars[1].h, 132 - 22 - 26, "the tallest bar fills the plot");
  assert.ok(h.boxBars([1, 0, 0], {})[0].h >= 4, "a small value is still visible");
  deepEq(h.boxBars([], {}), []);
  assert.ok(h.boxBars([0, 0, 0], {}).every((b) => b.h === 0), "all empty: no NaN");
  const path = h.roundedTopPath(10, 20, 24, 40, 4);
  assert.ok(/^M10 60V24Q10 20 14 20H30Q34 20 34 24V60Z$/.test(path), path);
  assert.strictEqual(h.roundedTopPath(0, 0, 24, 2, 4).includes("NaN"), false);
});

test("engine lines as text: numbered from the FEN, black to move gets an ellipsis, junk falls back to UCI", () => {
  const env = createEnv();
  const h = helpers(env);
  assert.strictEqual(h.formatPv(FENS[2], ["d2d3", "g8f6", "e1g1"], env.Ludus.chess), "4. d3 Nf6 5. O-O");
  assert.strictEqual(h.formatPv(FENS[1], ["g8f6", "d2d3"], env.Ludus.chess), "3… Nf6 4. d3");
  assert.strictEqual(h.formatPv(FENS[2], ["a1a8"], env.Ludus.chess), "a1a8", "an illegal move: the UCI text");
  assert.strictEqual(h.formatPv(FENS[2], [], env.Ludus.chess), "");
  assert.strictEqual(h.formatPv(FENS[2], ["d2d3", "g8f6"], {}), "d2d3 g8f6", "without a chess module: UCI text");
  // QA CNT-006: what the person reads goes through the notation setting (Spanish letters on a Spanish page), the stored text does not.
  assert.strictEqual(h.formatPv(FENS[2], ["d2d3", "g8f6", "e1g1"], env.Ludus.chess, h.shownSan), "4. d3 Cf6 5. O-O");
  assert.strictEqual(h.shownSan("Qxd5+"), "Dxd5+");
  assert.strictEqual(h.shownSan("e4"), "e4");
  assert.strictEqual(h.shownSan(""), "");
  assert.strictEqual(createEnv({ language: "en" }).Ludus.Screens.notebook.helpers.shownSan("Qxd5+"), "Qxd5+", "an English page keeps the English letters");
});

// ---------- the screen ----------

test("mount is idempotent and cheap: the heading is there before show(), the data is read in show()", () => {
  const env = createEnv();
  const reads = [];
  const list = env.Ludus.Profile.notebook.list;
  env.Ludus.Profile.notebook.list = (...args) => { reads.push(1); return list(...args); };
  nb(env).mount(env.el);
  nb(env).mount(env.el);
  assert.strictEqual(reads.length <= 1, true, "mounting twice reads at most once");
  assert.strictEqual(all(env.el, "h1").length, 1);
  assert.strictEqual(text(q(env.el, "h1")), "Tu cuaderno de errores");
  assert.strictEqual(all(env.el, ".notebook").length, 1);
  assert.strictEqual(q(env.el, "h1").hasAttribute("data-screen-title"), true);
  nb(env).mount(null);
});

test("empty notebook: an invitation with two ways to play and how it works; nothing else", () => {
  const env = createEnv();
  open(env);
  assert.strictEqual(all(env.el, ".notebook-summary").length, 0);
  assert.strictEqual(all(env.el, ".notebook-card").length, 0);
  assert.ok(text(env.el).includes("Tu cuaderno todavía está vacío"));
  const buttons = all(env.el, "button").map((b) => text(b));
  assert.ok(buttons.includes("Jugar partidas clásicas") && buttons.includes("Analizar tus partidas"), buttons.join("|"));
  assert.strictEqual(all(env.el, ".notebook-step").length, 3);
  assert.strictEqual(all(env.el, "h2").length >= 2, true);
  // The buttons lead where they say.
  let opened = null;
  env.Ludus.game.openOwnGamesSetup = (options) => { opened = options; };
  const own = all(env.el, "button").find((b) => text(b) === "Analizar tus partidas");
  own.click();
  deepEq(opened, { mode: "solo" });
  all(env.el, "button").find((b) => text(b) === "Jugar partidas clásicas").click();
  assert.strictEqual(env.Ludus.router.current(), "classics", "the first button goes to the classics");
});

test("summary: the numbers agree with Profile.notebook.counts, the action says how many it takes", () => {
  const env = createEnv();
  seedCards(env, 8);
  const cards = env.Ludus.Profile.notebook.list({});
  passCard(env, cards[0], NOW - DAY * 3); // box 1, due since 2 days ago
  passCard(env, cards[1], NOW - 3600000); // box 1, due tomorrow
  passCard(env, cards[1], NOW - 1800000); // box 2
  const counts = env.Ludus.Profile.notebook.counts(NOW);
  open(env);
  const el = env.el;
  assert.strictEqual(text(q(el, ".notebook-due-count")), String(counts.due));
  assert.strictEqual(text(q(el, ".notebook-due-label")), "para repasar ahora");
  assert.strictEqual(text(startBtn(el)), `Repasar ${Math.min(counts.due, 10)} ahora`);
  const stats = all(el, ".notebook-stat").map((s) => text(q(s, ".notebook-stat-value")));
  const listed = env.Ludus.Profile.notebook.list({});
  deepEq(stats, [String(counts.total), String(listed.filter((c) => c.box >= 3).length), String(counts.new)], "cards, cleared (box 3 or more), new");
  assert.strictEqual(all(el, ".notebook-boxes-svg .notebook-bar, .notebook-boxes-svg .notebook-bar-stub").length, 6);
  const rows = all(q(el, ".notebook-boxes"), "tbody tr");
  assert.strictEqual(rows.length, 6, "a text table for screen readers");
  deepEq(rows.map((r) => Number(text(all(r, "td")[0]))), counts.byBox);
  assert.strictEqual(all(el, ".notebook-card").length, Math.min(12, counts.total));
  assert.ok(text(q(el, ".notebook-count")).startsWith(`${counts.total} tarjetas`));
});

test("Review N now: a review session of the due cards, in order, with the card ids and the references", () => {
  const env = createEnv();
  const seeded = seedCards(env, 8, (i) => (i === 3 ? { lines: [], bestUci: null, bestSan: "" } : {}));
  open(env);
  startBtn(env.el).click();
  assert.strictEqual(env.calls.length, 1);
  const call = env.calls[0];
  assert.strictEqual(call.kind, "review");
  assert.strictEqual(call.mode, "solo");
  assert.strictEqual(call.title, "Repaso del cuaderno");
  assert.strictEqual(call.positions.length, 8);
  deepEq(call.positions.map((p) => p.cardId), seeded.map((c) => c.id), "most overdue first");
  call.positions.forEach((position) => {
    assert.strictEqual(position.source, "notebook");
    assert.ok(position.id.startsWith("notebook:c_"));
    assert.ok(position.fen && position.meta && Array.isArray(position.tags));
  });
  const bare = call.positions.find((p) => p.cardId === seeded.find((c) => c.lines.length === 0).id);
  assert.strictEqual(bare.reference, undefined, "a card without lines is analysed at the root");
  assert.strictEqual("bestMoveUci" in bare, false);
  const full = call.positions.find((p) => p !== bare);
  assert.strictEqual(full.reference.lines.length, 3);
  assert.strictEqual(full.bestMoveUci, full.reference.lines[0].uci);
  // The screen never grades: the cards are as they were.
  assert.ok(env.Ludus.Profile.notebook.list({}).every((c) => c.reviews === 0 && c.box === 0));
});

test("the 5 / 10 / 20 picker changes the label and the session, is remembered, and survives a redraw", () => {
  const env = createEnv();
  seedCards(env, 8);
  const cards = env.Ludus.Profile.notebook.list({});
  cards.slice(0, 8).forEach((card, i) => i > 0 && passCard(env, card, NOW - DAY * 3 - i));
  open(env);
  const size = (n) => q(env.el, `.notebook-size-seg [data-size="${n}"]`);
  assert.strictEqual(size(10).getAttribute("aria-pressed"), "true", "10 by default");
  const due = env.Ludus.Profile.notebook.counts(NOW).due;
  assert.strictEqual(due >= 6, true, `due ${due}`);
  size(5).click();
  assert.strictEqual(text(startBtn(env.el)), "Repasar 5 ahora");
  const note = q(env.el, ".notebook-due-note");
  assert.strictEqual(Boolean(note) && text(note).includes("5 de las"), due > 5, "the note says the session takes fewer than are due");
  assert.strictEqual(size(5).getAttribute("aria-pressed"), "true");
  assert.strictEqual(env.doc.activeElement.getAttribute("data-size"), "5", "the focus stays on the picker");
  startBtn(env.el).click();
  assert.strictEqual(env.calls[0].positions.length, 5);
  assert.deepStrictEqual(plain(env.Ludus.storage.get("ludus.notebook.prefs.v1", null)), { v: 1, size: 5, sort: "due" });
  // A new instance of the screen remembers it.
  const again = createEnv();
  again.storageMap.set("ludus.notebook.prefs.v1", JSON.stringify({ v: 1, size: 20, sort: "worst" }));
  seedCards(again, 3);
  open(again);
  assert.strictEqual(q(again.el, '.notebook-size-seg [data-size="20"]').getAttribute("aria-pressed"), "true");
  assert.strictEqual(q(again.el, "#notebook-sort").value, "worst");
  again.storageMap.set("ludus.notebook.prefs.v1", "{not json");
});

test("nothing due: it says so, when the next card comes back, and offers to practise with the lowest boxes", () => {
  const env = createEnv();
  const cards = seedCards(env, 4);
  cards.forEach((card, i) => {
    passCard(env, card, NOW - 3600000 - i); // box 1: due at the next midnight
    if (i < 2) passCard(env, card, NOW - 1800000 - i); // box 2
  });
  assert.strictEqual(env.Ludus.Profile.notebook.counts(NOW).due, 0);
  open(env);
  const el = env.el;
  assert.ok(text(el).includes("Estás al día"));
  assert.strictEqual(all(el, ".notebook-due-count").length, 0);
  assert.ok(/Próximo repaso: Mañana · /.test(text(q(el, ".notebook-due-note"))), text(q(el, ".notebook-due-note")));
  assert.ok(text(q(el, ".notebook-due-note")).includes("(2 tarjetas)"), "the two box-1 cards return the same day");
  assert.strictEqual(text(startBtn(el)), "Practicar igual");
  assert.ok(q(el, ".notebook-hint") && text(q(el, ".notebook-hint")).includes("sube de caja"));
  startBtn(el).click();
  const call = env.calls[0];
  assert.strictEqual(call.kind, "review");
  assert.strictEqual(call.title, "Práctica del cuaderno");
  assert.strictEqual(call.positions.length, 4);
  const boxes = call.positions.map((p) => env.Ludus.Profile.notebook.get(p.cardId).box);
  deepEq(boxes, boxes.slice().sort((a, b) => a - b), "the lowest boxes first");
});

test("weak spots: the themes of the open cards, each trains only its own cards; the lesson chip opens a dialog", () => {
  const env = createEnv();
  seedCards(env, 6, (i) => ({ tags: i < 4 ? ["hangs_piece"] : i === 4 ? ["fork_available"] : ["back_rank", "hangs_piece"] }));
  open(env);
  const items = all(env.el, ".notebook-weak-item");
  assert.strictEqual(items.length, 3);
  assert.strictEqual(text(q(items[0], ".notebook-weak-name")), "Pieza colgada", "the most repeated theme first");
  assert.ok(text(q(items[0], ".notebook-weak-count")).startsWith("5 tarjetas · 5 sin superar"));
  assert.strictEqual(q(items[0], ".notebook-weak-train").getAttribute("aria-label"), "Entrenar este punto débil: Pieza colgada");
  q(items[0], ".notebook-weak-train").click();
  const call = env.calls[0];
  assert.strictEqual(call.title, "Repaso: Pieza colgada");
  assert.strictEqual(call.positions.length, 5);
  assert.ok(call.positions.every((p) => p.tags.includes("hangs_piece")));
  // "Show cards" filters the list by that theme and opens the extra filters.
  const secondTag = q(items[1], ".notebook-weak-train").getAttribute("data-tag");
  q(items[1], ".notebook-weak-filter").click();
  assert.strictEqual(q(env.el, "#notebook-f-tag").value, secondTag);
  assert.strictEqual(all(env.el, ".notebook-card").length >= 1, true);
  assert.strictEqual(q(env.el, ".notebook-more").hasAttribute("open"), true);
  // The lesson.
  const chip = all(env.el, ".notebook-tag").find((c) => c.tagName === "BUTTON");
  assert.ok(chip, "a theme with a lesson is a button");
  chip.click();
  const modal = q(env.doc.body, ".notebook-concept-modal");
  assert.ok(modal, "the dialog opens");
  assert.ok(all(modal, ".notebook-concept").length >= 1);
  assert.ok(all(modal, "svg.mini-board").length >= 1, "an example on a board");
  assert.ok(text(modal).includes("Jugada de ejemplo"));
  assert.ok(all(modal, "button").map((b) => text(b)).includes("Ver la escuela de ajedrez"));
});

test("theme without a lesson is a plain chip, not a button", () => {
  const env = createEnv();
  seedCards(env, 2, () => ({ tags: ["time_trouble"] }));
  open(env);
  const chips = all(env.el, ".notebook-tag");
  assert.ok(chips.length >= 2);
  assert.ok(chips.every((c) => c.tagName !== "BUTTON"), "no lesson to open");
  assert.strictEqual(nb(env).openConcept("time_trouble") !== null, true, "the dialog still says there is no lesson");
  assert.ok(text(q(env.doc.body, ".notebook-concept-modal")).includes("Todavía no tenemos una lección"));
});

test("cards: board oriented to the side to move with the best-move arrow, origin, your move against the best, pips, next review", () => {
  const env = createEnv();
  seedCards(env, 3, (i) => ({ source: i === 1 ? "classic" : "own", meta: i === 1 ? { players: "Morphy vs Duke", event: "Paris", year: 1858 } : { players: "Lucía vs Marta", year: 2026, moveNumber: 12 } }));
  open(env);
  const cards = cardEls(env.el);
  assert.strictEqual(cards.length, 3);
  cards.forEach((card) => {
    assert.strictEqual(all(card, "svg.mini-board").length, 1);
    assert.strictEqual(all(card, "svg.mini-board .mb-arrow").length, 1, "an arrow for the best move");
    assert.ok(all(card, ".notebook-pips").length === 1 && all(card, ".notebook-pip").length === 5);
    assert.strictEqual(q(card, ".notebook-pips").getAttribute("role"), "img");
    assert.strictEqual(q(card, ".notebook-pips").getAttribute("aria-label"), "Tarjeta nueva");
    assert.ok(q(card, ".notebook-san.is-best"));
    assert.ok(text(card).includes("Tu jugada") && text(card).includes("La mejor"));
    assert.ok(text(card).includes("Para repasar"), "due");
    assert.ok(all(card, ".q-badge").length === 1, "the quality of your move");
    assert.ok(text(card).includes("20% de precisión · 2 pts"), text(card));
    assert.strictEqual(q(card, "h3").hasAttribute("id"), true);
    assert.strictEqual(card.getAttribute("aria-labelledby"), q(card, "h3").getAttribute("id"));
  });
  const classic = cards.find((c) => text(c).includes("Morphy vs Duke"));
  assert.ok(classic && text(classic).includes("Paris · 1858"));
  assert.ok(text(classic).includes("PARTIDA CLÁSICA") || text(classic).includes("Partida clásica"));
  const own = cards.find((c) => text(c).includes("Tu partida contra Marta") || text(c).includes("Lucía vs Marta"));
  assert.ok(own, "your own game");
  const sideBlack = all(env.el, ".mini-board").filter((b) => b.getAttribute("data-orientation") === "b");
  const black = env.Ludus.Profile.notebook.list({}).filter((c) => c.sideToMove === "b").length;
  assert.strictEqual(sideBlack.length, black, "the board looks from the side to move");
});

test("a card without a stored best move says it will be worked out; a card without its round still shows the accuracy", () => {
  const env = createEnv();
  seedCards(env, 1, () => ({ lines: [], bestUci: null, bestSan: "" }));
  open(env);
  const card = cardEls(env.el)[0];
  assert.ok(text(card).includes("Se calcula cuando la repases"));
  assert.strictEqual(all(card, ".mb-arrow").length, 0, "no arrow without a best move");
  // The round of the card was never stored (a card saved with notebook.add, or older than the 600 rounds
  // Profile keeps): the accuracy of the card's own history remains.
  const env2 = createEnv();
  env2.Ludus.Profile.ensureActive();
  assert.ok(env2.Ludus.Profile.notebook.add(round(env2, FENS[3], { ts: NOW - DAY * 2 })));
  open(env2);
  const card2 = cardEls(env2.el)[0];
  assert.ok(text(card2).includes("Un error tuyo"), text(card2));
  assert.ok(text(card2).includes("20% de precisión"));
  assert.strictEqual(all(card2, ".notebook-san").length, 1, "only the best move is known");
});

test("filters and sort: status pills, text, theme, sort; the count reads 'x of y'; clearing brings everything back", () => {
  const env = createEnv();
  const cards = seedCards(env, 8, (i) => ({ tags: i % 2 ? ["fork_available"] : ["hangs_piece"], phase: i < 3 ? "opening" : "endgame", meta: { players: i === 2 ? "Kasparov vs Topalov" : "Lucía vs Marta", year: 2026 }, source: i === 5 ? "classic" : "own" }));
  passCard(env, cards[0], NOW - DAY * 3);
  passCard(env, cards[0], NOW - DAY * 2);
  passCard(env, cards[0], NOW - DAY * 1);
  passCard(env, cards[1], NOW - 3600000);
  open(env);
  const el = env.el;
  const listCount = () => text(q(el, ".notebook-count"));
  assert.strictEqual(listCount(), "8 tarjetas");
  const status = (s) => q(el, `.notebook-status [data-status="${s}"]`);
  const counts = env.Ludus.Profile.notebook.counts(NOW);
  status("due").click();
  assert.strictEqual(listCount(), `${counts.due} de 8 tarjetas`);
  assert.strictEqual(status("due").getAttribute("aria-pressed"), "true");
  assert.strictEqual(status("all").getAttribute("aria-pressed"), "false");
  status("cleared").click();
  assert.strictEqual(cardEls(el).length, all(el, ".notebook-card.is-cleared").length, "only cleared cards");
  status("new").click();
  assert.ok(cardEls(el).every((c) => text(c).includes("Tarjeta nueva")));
  status("all").click();
  // text
  const search = q(el, "#notebook-search");
  search.value = "kasparov";
  search.dispatch("input");
  assert.strictEqual(cardEls(el).length, 8, "the search waits a moment (debounce)");
  env.advance(200);
  assert.strictEqual(cardEls(el).length, 1);
  assert.ok(text(cardEls(el)[0]).includes("Kasparov vs Topalov"));
  assert.ok(!q(el, ".notebook-clear").hasAttribute("hidden"), "clear appears with a filter on");
  search.value = "";
  search.dispatch("input");
  env.advance(200);
  // selects
  const pick = (id, value) => { const select = q(el, `#${id}`); select.value = value; select.dispatch("change"); };
  pick("notebook-f-tag", "fork_available");
  assert.strictEqual(cardEls(el).length, 4);
  assert.ok(text(q(el, ".notebook-more-summary")).includes("(1)"), "the number of extra filters on");
  pick("notebook-f-phase", "opening");
  assert.strictEqual(cardEls(el).length, 1, "theme and phase combine");
  pick("notebook-f-phase", "all");
  pick("notebook-f-tag", "all");
  pick("notebook-f-source", "classic");
  assert.strictEqual(cardEls(el).length, 1);
  pick("notebook-f-source", "all");
  pick("notebook-f-quality", "blunder");
  assert.strictEqual(cardEls(el).length, 8);
  pick("notebook-f-quality", "interesting");
  assert.strictEqual(all(el, ".notebook-card").length, 0);
  assert.ok(text(q(el, ".notebook-list-empty")).includes("Ninguna tarjeta coincide"));
  // clear
  const clear = all(el, "button").find((b) => text(b) === "Limpiar filtros" && !b.hasAttribute("hidden"));
  assert.ok(clear);
  clear.click();
  assert.strictEqual(cardEls(el).length, 8);
  assert.strictEqual(q(el, ".notebook-clear").hasAttribute("hidden"), true);
  // sort
  const sort = q(el, "#notebook-sort");
  sort.value = "recent";
  sort.dispatch("change");
  const ids = cardEls(el).map((c) => c.getAttribute("data-card"));
  const expected = env.Ludus.Profile.notebook.list({ sort: "created" }).map((c) => c.id);
  deepEq(ids, expected, "the same order Profile gives by creation");
  assert.strictEqual(env.Ludus.storage.get("ludus.notebook.prefs.v1", null).sort, "recent");
});

// ---------- polish pass: PB-1 quality words, PB-2 search, PB-6 SAN, PB-7 plurals ----------

test("the 'Your move' filter takes its words from Scoring.qualityLabel, in both languages, and keeps none of its own (PB-1, CNT-014)", () => {
  const env = createEnv();
  seedCards(env, 3);
  open(env);
  const labelsOf = () => all(q(env.el, "#notebook-f-quality"), "option").map((o) => text(o));
  const scorer = (code) => env.Ludus.Scoring.qualityLabel(code, env.Ludus.i18n.lang());
  const expected = () => [env.Ludus.i18n.t("notebook.filter.all")].concat(["blunder", "bad", "dubious", "interesting"].map(scorer));
  deepEq(labelsOf(), expected());
  deepEq(labelsOf(), ["Todos", "Error grave", "Error", "Dudosa", "Imprecisa"]);
  assert.strictEqual(text(q(env.el, 'label[for="notebook-f-quality"]')), "Tu jugada");
  env.Ludus.i18n.setLanguage("en", { persist: false });
  deepEq(labelsOf(), expected());
  deepEq(labelsOf(), ["All", "Serious mistake", "Mistake", "Dubious", "Inaccuracy"]);
  assert.strictEqual(text(q(env.el, 'label[for="notebook-f-quality"]')), "Your move");
  // The notebook registers no quality words of its own, and the badge of a card says what the filter says.
  Object.keys(nb(env).TEXT.es).concat(Object.keys(nb(env).TEXT.en)).forEach((key) => assert.ok(!key.startsWith("notebook.quality."), `${key}: the words are the scorer's`));
  assert.strictEqual(nb(env).helpers.qualityText("blunder"), "Serious mistake");
  // Choosing "Inaccuracy" shows the cards whose move the scorer calls an inaccuracy (code "interesting"), nothing else.
  const el2 = createEnv({ language: "en" });
  seedCards(el2, 4, (i) => ({ qualityCode: ["blunder", "bad", "dubious", "interesting"][i], accuracy: [5, 20, 40, 60][i] }));
  open(el2);
  const select = q(el2.el, "#notebook-f-quality");
  select.value = "interesting";
  select.dispatch("change");
  const badges = all(el2.el, ".notebook-card").map((card) => text(q(card, ".q-badge")));
  assert.strictEqual(badges.length, 1);
  assert.strictEqual(badges[0].replace(/[^A-Za-z ]/g, "").trim(), "Inaccuracy", "the card badge and the filter option are the same word");
});

test("without the scorer there is no quality filter instead of a second vocabulary (PB-1)", () => {
  const env = createEnv({ skip: ["js/scoring.js"] });
  seedCards(env, 2, () => ({}));
  open(env);
  assert.ok(!q(env.el, "#notebook-f-quality"), "the select is left out");
  assert.ok(q(env.el, "#notebook-f-phase"), "the other filters stay");
  assert.strictEqual(nb(env).helpers.qualityText("blunder"), "");
});

test("search matches what the card shows: the Spanish letters, the English ones, your move and the best move, the players and the event (PB-2)", () => {
  const env = createEnv();
  const { localizeSan } = env.Ludus.chess;
  const cards = [
    { id: "a", box: 0, reviews: 0, due: NOW, bestSan: "Nf3", meta: { players: "Lucía vs Marta", event: "Lichess blitz" } },
    { id: "b", box: 0, reviews: 0, due: NOW, bestSan: "Qxd5+", meta: { players: "Morphy vs Duke", event: "Casual game" } },
    { id: "c", box: 0, reviews: 0, due: NOW, bestSan: "e4", meta: {} },
    { id: "d", box: 0, reviews: 0, due: NOW, bestSan: "Kg1", meta: {} },
    { id: "e", box: 0, reviews: 0, due: NOW, bestSan: "Rg1", meta: {} },
  ];
  const mine = { a: "Bb5", b: "Nc3", c: "O-O", d: "Kh1", e: "Ra1" };
  const ctx = { now: NOW, sansOf: (card) => [mine[card.id], card.bestSan], showSan: (san) => localizeSan(san, "es"), localize: (meta) => meta };
  const h = helpers(env);
  const ids = (query) => h.filterCards(cards, { query }, ctx).map((c) => c.id).join(",");
  assert.strictEqual(localizeSan("Nf3", "es"), "Cf3");
  assert.strictEqual(ids("cf3"), "a", "the letter a Spanish page draws for the knight");
  assert.strictEqual(ids("nf3"), "a", "and the English one it is stored with");
  assert.strictEqual(ids("dxd5"), "b", "dama (queen)");
  assert.strictEqual(ids("qxd5"), "b");
  assert.strictEqual(ids("ab5"), "a", "your move, not only the best one: alfil (bishop)");
  assert.strictEqual(ids("bb5"), "a");
  assert.strictEqual(ids("cc3"), "b", "your move: caballo");
  assert.strictEqual(ids("rg1"), "d,e", "in Spanish R is the king (stored Kg1) and in English the rook (stored Rg1): both are found");
  assert.strictEqual(ids("th1"), "", "no such move");
  assert.strictEqual(ids("ta1"), "e", "torre (rook)");
  assert.strictEqual(ids("e4"), "c");
  assert.strictEqual(ids("xd5"), "b", "captures and checks are not part of the words typed");
  assert.strictEqual(ids("morphy"), "b", "the players");
  assert.strictEqual(ids("blitz"), "a", "the event");
  assert.strictEqual(ids("marta cf3"), "a", "every word must match");
  assert.strictEqual(ids("marta cc3"), "", "all of them");
  // Without a mapper (the English form only) the stored letters still match, as before.
  assert.strictEqual(h.filterCards(cards, { query: "nf3" }, { now: NOW }).map((c) => c.id).join(), "a");
  assert.strictEqual(h.filterCards(cards, { query: "cf3" }, { now: NOW }).length, 0, "nothing to translate with: only what is stored");
});

test("the screen's search: type the move as it is drawn (Spanish letters) or as it is stored; the English page too (PB-2)", () => {
  const env = createEnv();
  const cards = seedCards(env, 8);
  open(env);
  const withPiece = cards.filter((c) => /^[NBRQK]/.test(c.bestSan));
  assert.ok(withPiece.length >= 1, "the fixtures have a piece move");
  const target = withPiece[0];
  const spanish = env.Ludus.chess.localizeSan(target.bestSan, "es");
  assert.notStrictEqual(spanish, target.bestSan, "the letters differ");
  const search = q(env.el, "#notebook-search");
  const type = (value) => { search.value = value; search.dispatch("input"); env.advance(200); };
  const shownIds = () => cardEls(env.el).map((c) => c.getAttribute("data-card"));
  type(spanish.replace(/[+#]/g, ""));
  assert.ok(shownIds().includes(target.id), "the move as the page draws it finds the card");
  assert.ok(shownIds().length < 8 || withPiece.length === 8);
  type(target.bestSan.replace(/[+#]/g, ""));
  assert.ok(shownIds().includes(target.id), "so does the stored one");
  // The move of the person (userSan of the round) is searched too.
  const card0 = cards[0];
  const round0 = env.Ludus.Profile.rounds().find((r) => r.id === card0.history[0].roundId);
  const userSpanish = env.Ludus.chess.localizeSan(round0.userSan, "es").replace(/[+#]/g, "");
  type(userSpanish);
  assert.ok(shownIds().includes(card0.id), `your move ${userSpanish}`);
  env.Ludus.i18n.setLanguage("en", { persist: false });
  nb(env).render();
  const english = q(env.el, "#notebook-search");
  english.value = target.bestSan.replace(/[+#]/g, "");
  english.dispatch("input");
  env.advance(200);
  assert.ok(cardEls(env.el).map((c) => c.getAttribute("data-card")).includes(target.id), "English page, English letters");
});

test("every move on a card is drawn through the notation setting and said in words (PB-6, A11Y-016)", () => {
  const env = createEnv();
  seedCards(env, 3);
  open(env);
  const card = cardEls(env.el)[0];
  const fromCard = env.Ludus.Profile.notebook.list({ sort: "due", now: NOW }).find((c) => c.id === card.getAttribute("data-card"));
  const mine = all(card, ".notebook-san").find((node) => !node.classList.contains("is-best"));
  const best = q(card, ".notebook-san.is-best");
  assert.ok(mine && best);
  const drawn = q(best, '[aria-hidden="true"]');
  const spoken = q(best, ".sr-only");
  assert.strictEqual(text(drawn), env.Ludus.chess.localizeSan(fromCard.bestSan, "es"), "drawn in Spanish letters");
  assert.strictEqual(text(spoken), env.Ludus.chess.spokenSan(fromCard.bestSan, "es"), "said in words");
  const round0 = env.Ludus.Profile.rounds().find((r) => r.id === fromCard.history[0].roundId);
  assert.strictEqual(text(q(mine, ".sr-only")), env.Ludus.chess.spokenSan(round0.userSan, "es"));
  env.Ludus.i18n.setLanguage("en", { persist: false });
  nb(env).render();
  const bestEn = q(cardEls(env.el)[0], ".notebook-san.is-best");
  assert.strictEqual(text(q(bestEn, '[aria-hidden="true"]')), fromCard.bestSan, "English page: the stored letters");
  assert.strictEqual(text(q(bestEn, ".sr-only")), env.Ludus.chess.spokenSan(fromCard.bestSan, "en"));
  // The stored lines: the first move of each is drawn and said the same way, whole lines included.
  const toggle = q(cardEls(env.el)[0], ".notebook-lines-toggle");
  toggle.click();
  const pv = q(cardEls(env.el)[0], ".notebook-line-pv");
  assert.ok(pv && q(pv, '[aria-hidden="true"]') && q(pv, ".sr-only"), "a line has a drawn form and a spoken one");
  assert.ok(/knight|bishop|rook|queen|king|pawn/.test(text(q(pv, ".sr-only"))), text(q(pv, ".sr-only")));
  // The lesson dialog: "Jugada de ejemplo: <drawn> <spoken>".
  env.Ludus.i18n.setLanguage("es", { persist: false });
  nb(env).render();
  nb(env).openConcept("fork_available");
  const line = q(q(env.doc.body, ".notebook-concept-modal"), ".notebook-concept-move");
  assert.ok(line && q(line, ".sr-only") && q(line, '[aria-hidden="true"]'), "the lesson's move has both forms");
  assert.ok(text(line).startsWith("Jugada de ejemplo: "), text(line));
});

test("plurals: a notebook of one card says '0 of 1 card', and the box table names the cards it counts (PB-7)", () => {
  const env = createEnv();
  seedCards(env, 1);
  open(env);
  const search = q(env.el, "#notebook-search");
  search.value = "zzzz";
  search.dispatch("input");
  env.advance(200);
  assert.strictEqual(text(q(env.el, ".notebook-count")), "0 de 1 tarjeta", "no '1 tarjetas'");
  env.Ludus.i18n.setLanguage("en", { persist: false });
  nb(env).render();
  assert.strictEqual(text(q(env.el, ".notebook-count")), "0 of 1 card");
  // Several cards keep the plural noun, and the singular of a count of one is not a plural.
  const many = createEnv();
  seedCards(many, 3);
  open(many);
  const s2 = q(many.el, "#notebook-search");
  s2.value = "zzzz";
  s2.dispatch("input");
  many.advance(200);
  assert.strictEqual(text(q(many.el, ".notebook-count")), "0 de 3 tarjetas");
  const rows = all(many.el, ".notebook-boxes table tbody th").map((th) => text(th));
  assert.strictEqual(rows[0], "Caja 0, tarjetas nuevas: 3");
  assert.strictEqual(rows[1], "Caja 1: 0 tarjetas, vuelve cada día");
  const one = createEnv();
  seedCards(one, 1);
  one.Ludus.i18n.setLanguage("en", { persist: false });
  open(one);
  const oneRows = all(one.el, ".notebook-boxes table tbody th").map((th) => text(th));
  assert.strictEqual(oneRows[0], "Box 0, new cards: 1");
  assert.strictEqual(oneRows[2], "Box 2: 0 cards, comes back every 3 days");
  assert.strictEqual(many.Ludus.i18n.t("notebook.boxes.cards", { n: 4 }), "4 tarjetas");
  assert.strictEqual(many.Ludus.i18n.t("notebook.boxes.cards.one"), "1 tarjeta");
});

test("terminology: American spelling in English, no tuteo in Spanish (PB-7)", () => {
  const env = createEnv();
  const { es, en } = nb(env).TEXT;
  const british = /\b(practis\w*|analys\w*|colour\w*|favour\w*|centre\w*|defence|licence|organis\w*|recognis\w*|catalogue)\b/i;
  Object.keys(en).forEach((key) => assert.ok(!british.test(en[key]), `${key}: British spelling in "${en[key]}"`));
  // Second person singular imperatives and verbs of the tú register ("vuelve" is third person here: the card comes back).
  const tuteo = /\b(elige|prueba|puedes|tienes|quieres|toca|pulsa|haz|mira|selecciona|tú)\b/i;
  Object.keys(es).forEach((key) => assert.ok(!tuteo.test(es[key]), `${key}: tuteo in "${es[key]}"`));
  assert.strictEqual(en["notebook.practice.start"], "Practice anyway");
  assert.strictEqual(en["notebook.empty.own"], "Analyze your games");
  Object.keys(en).forEach((key) => assert.ok(!/winning chances|win probability|odds/i.test(en[key]), `${key}: one name for win chance`));
  Object.keys(es).forEach((key) => assert.ok(!/probabilidad de ganar|chances de victoria/i.test(es[key]), key));
});

test("show more: 12 at a time, the focus goes to the first new card", () => {
  // The fixtures hold 8 positions: hand the screen 30 cards instead of what Profile lists.
  const env = createEnv();
  const [base] = seedCards(env, 1);
  env.Ludus.Profile.notebook.list = () => Array.from({ length: 30 }, (_, i) => Object.assign({}, base, { id: `c_${String(i).padStart(3, "0")}`, due: NOW - DAY - i }));
  open(env);
  assert.strictEqual(cardEls(env.el).length, 12);
  const more = q(env.el, ".notebook-more-btn");
  assert.strictEqual(text(more), "Mostrar más (18 restantes)");
  more.click();
  assert.strictEqual(cardEls(env.el).length, 24);
  assert.strictEqual(env.doc.activeElement && env.doc.activeElement.classList.contains("notebook-card-title"), true);
  assert.ok(env.doc.activeElement.textContent.length > 0);
  q(env.el, ".notebook-more-btn").click();
  assert.strictEqual(cardEls(env.el).length, 30);
  assert.strictEqual(q(env.el, ".notebook-more-btn"), null);
  assert.strictEqual(text(q(env.el, ".notebook-count")), "30 tarjetas");
});

test("stored lines: the toggle shows the engine lines and the history; aria-expanded follows", () => {
  const env = createEnv();
  const cards = seedCards(env, 2);
  passCard(env, cards[0], NOW - DAY * 2);
  open(env);
  const card = cardEls(env.el).find((c) => c.getAttribute("data-card") === cards[0].id);
  const toggle = q(card, ".notebook-lines-toggle");
  const panel = q(card, ".notebook-panel");
  assert.strictEqual(toggle.getAttribute("aria-expanded"), "false");
  assert.strictEqual(panel.hasAttribute("hidden"), true);
  assert.strictEqual(toggle.getAttribute("aria-controls"), panel.getAttribute("id"));
  toggle.click();
  assert.strictEqual(toggle.getAttribute("aria-expanded"), "true");
  assert.strictEqual(panel.hasAttribute("hidden"), false);
  assert.strictEqual(text(q(toggle, ".btn-label")), "Líneas", "the label is stable, aria-expanded says the state");
  assert.strictEqual(all(panel, ".notebook-line").length, 3);
  assert.strictEqual(text(q(panel, ".notebook-line-eval")), "+1,20", "pawn units with the decimal comma of the language");
  assert.strictEqual(all(panel, ".notebook-history-item").length, 2, "the creation and the review");
  assert.ok(text(panel).includes("Aprobado") && text(panel).includes("Fallado"));
  // it survives a redraw of the list
  q(env.el, "#notebook-sort").value = "recent";
  q(env.el, "#notebook-sort").dispatch("change");
  const again = cardEls(env.el).find((c) => c.getAttribute("data-card") === cards[0].id);
  assert.strictEqual(q(again, ".notebook-lines-toggle").getAttribute("aria-expanded"), "true");
  // a card without lines says so
  const env2 = createEnv();
  seedCards(env2, 1, () => ({ lines: [], bestUci: null, bestSan: "" }));
  open(env2);
  q(env2.el, ".notebook-lines-toggle").click();
  assert.ok(text(q(env2.el, ".notebook-panel")).includes("Todavía no hay líneas guardadas"));
});

test("review one card: a session of that card only", () => {
  const env = createEnv();
  const cards = seedCards(env, 3);
  open(env);
  const card = cardEls(env.el).find((c) => c.getAttribute("data-card") === cards[1].id);
  const button = q(card, ".notebook-action");
  assert.ok(text(button).includes("Repasar esta"));
  assert.ok(button.getAttribute("aria-label").startsWith("Repasar esta tarjeta: "));
  button.click();
  const call = env.calls[0];
  assert.strictEqual(call.title, "Repaso de una tarjeta");
  assert.strictEqual(call.positions.length, 1);
  assert.strictEqual(call.positions[0].cardId, cards[1].id);
  assert.strictEqual(call.positions[0].fen, cards[1].fen);
});

test("remove: asks first; cancel keeps it, confirm deletes it, says so and keeps the focus somewhere sensible", async () => {
  const env = createEnv();
  const cards = seedCards(env, 3);
  open(env);
  const target = cardEls(env.el).find((c) => c.getAttribute("data-card") === cards[0].id);
  const remove = q(target, ".notebook-remove");
  assert.ok(remove.getAttribute("aria-label").startsWith("Quitar la tarjeta: "));
  remove.click();
  await Promise.resolve();
  let dialog = q(env.doc.body, ".modal");
  assert.ok(dialog, "a confirmation dialog");
  assert.strictEqual(dialog.getAttribute("role"), "alertdialog");
  assert.ok(text(dialog).includes("¿Quitar esta tarjeta?"));
  all(dialog, "button").find((b) => text(b) === "Cancelar").click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(env.Ludus.Profile.notebook.list({}).length, 3, "cancel keeps the card");
  cardEls(env.el).find((c) => c.getAttribute("data-card") === cards[0].id).querySelector(".notebook-remove").click();
  await Promise.resolve();
  dialog = all(env.doc.body, ".modal").pop();
  all(dialog, "button").find((b) => text(b) === "Quitar tarjeta").click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(env.Ludus.Profile.notebook.get(cards[0].id), null, "removed from the profile");
  env.advance(10);
  assert.strictEqual(cardEls(env.el).length, 2, "and from the list");
  assert.ok(all(env.doc.body, ".toast").some((t) => text(t).includes("Tarjeta quitada")), "a toast says so");
  // QA A11Y-020: the focus lands on the card now at that place in the list (visible, in the thick of the list), not on the heading above it.
  const left = cardEls(env.el);
  const focusedId = env.doc.activeElement && env.doc.activeElement.getAttribute("id");
  assert.ok(focusedId && focusedId.startsWith("notebook-card-") && left.some((c) => `notebook-card-${c.getAttribute("data-card")}` === focusedId), `the focus is on a remaining card: ${focusedId}`);
  // removing the last card of the list: the focus goes to the new last one; removing the only card: to the list heading
  const order = cardEls(env.el).map((c) => c.getAttribute("data-card"));
  const lastCard = cardEls(env.el).find((c) => c.getAttribute("data-card") === order[order.length - 1]);
  q(lastCard, ".notebook-remove").click();
  await Promise.resolve();
  all(all(env.doc.body, ".modal").pop(), "button").find((b) => text(b) === "Quitar tarjeta").click();
  await new Promise((resolve) => setImmediate(resolve));
  env.advance(10);
  assert.strictEqual(env.doc.activeElement && env.doc.activeElement.getAttribute("id"), `notebook-card-${order[0]}`, "the last card was removed: the new last one has the focus");
  assert.ok(all(target.ownerDocument.body, "button").length > 0);
});

test("the Lines button of every card names its card (QA A11Y-020)", () => {
  const env = createEnv();
  seedCards(env, 3);
  open(env);
  const names = all(env.el, ".notebook-lines-toggle").map((b) => b.getAttribute("aria-label"));
  assert.strictEqual(names.length, 3);
  assert.strictEqual(new Set(names).size, 3, "three different names");
  assert.ok(names.every((name) => name.startsWith("Líneas")), "they still start with the visible word");
});

test("a failing game core never breaks the screen: an error toast, the buttons work again", async () => {
  const env = createEnv();
  seedCards(env, 2);
  open(env);
  env.game.fail = true;
  const originalError = console.error;
  console.error = () => {};
  try {
    startBtn(env.el).click();
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(all(env.doc.body, ".toast").some((t) => text(t).includes("No pudimos empezar el repaso")));
    assert.strictEqual(startBtn(env.el).hasAttribute("aria-busy"), false);
    assert.strictEqual(nb(env)._state.starting, false);
    env.game.fail = false;
    startBtn(env.el).click();
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(env.calls.length, 2);
    // No game core at all.
    env.Ludus.game = undefined;
    startBtn(env.el).click();
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(all(env.doc.body, ".toast").some((t) => text(t).includes("El juego no está disponible")));
  } finally {
    console.error = originalError;
  }
});

test("a session started twice quickly is one session", async () => {
  const env = createEnv();
  seedCards(env, 2);
  open(env);
  let release = null;
  env.game.startSession = (config) => { env.calls.push(config); return new Promise((resolve) => { release = resolve; }); };
  startBtn(env.el).click();
  startBtn(env.el).click();
  await Promise.resolve();
  assert.strictEqual(env.calls.length, 1);
  assert.strictEqual(startBtn(env.el).getAttribute("aria-busy"), "true");
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(nb(env)._state.starting, false);
});

test("presets from another screen: a theme, a status; unknown themes are ignored", () => {
  const env = createEnv();
  seedCards(env, 4, (i) => ({ tags: i < 2 ? ["fork_available"] : ["hangs_piece"] }));
  open(env, { tag: "fork_available" });
  assert.strictEqual(cardEls(env.el).length, 2);
  assert.strictEqual(q(env.el, "#notebook-f-tag").value, "fork_available");
  assert.strictEqual(q(env.el, ".notebook-more").hasAttribute("open"), true);
  env.Ludus.router.show("home");
  env.Ludus.router.show("notebook", { tag: "no_such_theme", status: "cleared" });
  assert.strictEqual(nb(env)._state.filters.tag, "fork_available", "an unknown theme changes nothing");
  assert.strictEqual(nb(env)._state.filters.status, "cleared");
});

test("events: a recorded round or a removed card repaints while visible; a hidden screen waits until it is shown", () => {
  const env = createEnv();
  seedCards(env, 3);
  open(env);
  assert.strictEqual(cardEls(env.el).length, 3);
  env.Ludus.Profile.recordRound(round(env, FENS[6], { ts: NOW - DAY, tags: ["back_rank"] }));
  env.advance(5);
  assert.strictEqual(cardEls(env.el).length, 4, "a new mistake appears at once");
  env.Ludus.router.show("home");
  env.Ludus.Profile.recordRound(round(env, FENS[7], { ts: NOW - DAY, tags: ["back_rank"] }));
  env.advance(5);
  assert.strictEqual(cardEls(env.el).length, 4, "nothing is drawn behind a hidden screen");
  assert.strictEqual(nb(env)._state.dirty, true);
  env.Ludus.router.show("notebook");
  assert.strictEqual(cardEls(env.el).length, 5);
});

test("language: the screen is redrawn in English and back, keeping the filters", () => {
  const env = createEnv();
  seedCards(env, 4, (i) => ({ tags: i < 2 ? ["fork_available"] : ["hangs_piece"] }));
  open(env);
  q(env.el, '.notebook-status [data-status="due"]').click();
  env.Ludus.i18n.setLanguage("en", { persist: false });
  assert.strictEqual(text(q(env.el, "h1")), "Your mistake notebook");
  assert.strictEqual(text(startBtn(env.el)), "Review 4 now");
  assert.strictEqual(q(env.el, '.notebook-status [data-status="due"]').getAttribute("aria-pressed"), "true", "the filter stays");
  assert.ok(text(cardEls(env.el)[0]).includes("Your move"));
  assert.ok(!/notebook\.[a-z]/.test(text(env.el)), "no raw keys");
  env.Ludus.i18n.setLanguage("es", { persist: false });
  assert.strictEqual(text(q(env.el, "h1")), "Tu cuaderno de errores");
  assert.ok(!/notebook\.[a-z]/.test(text(env.el)));
});

test("never builds markup from strings: hostile names are text", () => {
  const env = createEnv();
  seedCards(env, 1, () => ({ meta: { players: "<img src=x onerror=alert(1)> vs <b>x</b>", event: "<script>x</script>" } }));
  open(env);
  const card = cardEls(env.el)[0];
  assert.ok(text(card).includes("<img src=x onerror=alert(1)>"));
  assert.strictEqual(all(card, "img").length, 0);
  assert.strictEqual(all(env.el, "script").length, 0);
});

test("degrading: without Profile, kit, Insights, Concepts, Scoring or the game core the screen still draws", () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const noProfile = createEnv({ skip: ["js/profile.js"] });
    open(noProfile);
    assert.ok(text(noProfile.el).includes("no está disponible"));
    assert.strictEqual(all(noProfile.el, "h1").length, 1);

    const noKit = createEnv({ skip: ["js/ui/kit.js"] });
    seedCards(noKit, 3);
    open(noKit);
    assert.strictEqual(cardEls(noKit.el).length, 3, "cards without mini boards or icons");
    assert.strictEqual(all(noKit.el, "svg.mini-board").length, 0);
    startBtn(noKit.el).click();
    assert.strictEqual(noKit.calls.length, 1);
    const removeButton = q(cardEls(noKit.el)[0], ".notebook-remove");
    removeButton.click();

    const noInsights = createEnv({ skip: ["js/insights.js", "js/concepts.js"] });
    seedCards(noInsights, 2);
    open(noInsights);
    assert.ok(all(noInsights.el, ".notebook-tag").every((c) => c.tagName !== "BUTTON"));
    assert.ok(text(noInsights.el).includes("hangs piece"), "the tag itself, humanised");

    const noScoring = createEnv({ skip: ["js/scoring.js"] });
    seedCards(noScoring, 1);
    open(noScoring);
    q(noScoring.el, ".notebook-lines-toggle").click();
    assert.strictEqual(all(noScoring.el, ".notebook-line").length, 3);

    const noGame = createEnv();
    seedCards(noGame, 1);
    noGame.Ludus.game = undefined;
    open(noGame);
    startBtn(noGame.el).click();
    assert.strictEqual(cardEls(noGame.el).length, 1);

    const noChess = createEnv({ skip: ["js/chess.js"] });
    noChess.Ludus.chess = undefined;
    open(noChess);
  } finally {
    console.error = originalError;
  }
});

runAll().then(() => {
  console.log(`notebook-ui: ${passed} tests passed`);
}).catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
