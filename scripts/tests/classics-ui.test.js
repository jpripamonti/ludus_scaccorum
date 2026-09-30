// Tests for the classic games screen (js/ui/classics.js) against the real Classics data and the fake DOM
// of _uidom.js.
//
// Covers: text parity es / en; the pure helpers (eras, accent-blind search, filters that combine, sorting,
// facets, the signature position of every game, train counts, the mix availability against
// Ludus.Classics.random, the "verified" rule, safe source links, hash routes, display names, events and
// sites in both languages); the replay model for ALL 28 games (squares of every ply, checks, castling,
// training flags and notes agree with the data); the replay state machine and the auto play delay; and the
// screen itself: gallery, filters, chips, empty state, mix, daily strip, game page, replay controls,
// keyboard, training launchers, hash mirroring, language switch, load failure with retry and the board
// fallback.

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { FakeDocument, findAll, byClass } = require("./_uidom.js");
const { createFakeLocalStorage } = require("./_fakedom.js");

const repoRoot = path.resolve(__dirname, "..", "..");
const SCRIPTS = [
  "js/ludus.js", "js/chess.js", "js/pgn.js", "js/scoring.js", "js/settings.js", "js/profile.js",
  "js/facts.js", "js/reader.js", "js/classics.js", "js/data/classics.data.js", "js/ui/kit.js", "js/ui/classics.js",
];

// Timers of the sandbox are manual, so nothing here waits in real time.
function createEnv({ language = "es", withBoard = false, homeStub = false } = {}) {
  const doc = new FakeDocument();
  const storageMap = new Map();
  const location = { hash: "", pathname: "/", search: "" };
  const clock = { now: 0, seq: 0, timers: new Map() };
  const winListeners = new Map();
  const sandbox = {
    console, Date, Math, JSON, Object, Array, String, Number, Promise, Map, Set, Intl, URL, structuredClone, WeakMap,
    setTimeout(fn, ms) { clock.seq += 1; clock.timers.set(clock.seq, { at: clock.now + Number(ms || 0), fn }); return clock.seq; },
    clearTimeout(id) { clock.timers.delete(id); },
    document: doc,
    navigator: { languages: [language], language },
    localStorage: createFakeLocalStorage(storageMap),
    location,
    addEventListener(type, fn) { if (!winListeners.has(type)) winListeners.set(type, []); winListeners.get(type).push(fn); },
    removeEventListener(type, fn) { winListeners.set(type, (winListeners.get(type) || []).filter((entry) => entry !== fn)); },
  };
  sandbox.window = sandbox;
  sandbox.history = { state: null, replaceState(_state, _title, url) { location.hash = (String(url).match(/#.*$/) || [""])[0]; } };
  const context = vm.createContext(sandbox);
  const scripts = SCRIPTS.slice();
  if (withBoard) scripts.splice(scripts.indexOf("js/ui/classics.js"), 0, "js/ui/board.js");
  scripts.forEach((rel) => vm.runInContext(fs.readFileSync(path.join(repoRoot, rel), "utf8"), context, { filename: rel }));
  const Ludus = context.Ludus;
  Ludus.i18n.setLanguage(language, { persist: false });
  Ludus.ui._setTimers({ setTimeout: sandbox.setTimeout, clearTimeout: sandbox.clearTimeout, raf(fn) { fn(); }, now: () => clock.now });
  // Runs every timer due within `ms` (the search debounce, the auto play).
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
  const el = mk("section", { id: "screen-classics", class: "screen hidden" });
  const other = mk("section", { id: "screen-home", class: "screen hidden" });
  app.appendChild(el);
  app.appendChild(other);
  const shown = [];
  Ludus.router.register("classics", { el, onShow: (params) => { shown.push("classics"); Ludus.Screens.classics.show(params); }, onHide: () => Ludus.Screens.classics.hide() });
  Ludus.router.register("home", { el: other, onShow: () => shown.push("home") });
  Ludus.router.register("game", { el: mk("section", { id: "game" }), onShow: () => shown.push("game") });
  const calls = { sessions: [] };
  let active = false;
  Ludus.game = {
    startSession: async (spec) => { calls.sessions.push(spec); },
    isActive: () => active,
  };
  if (homeStub) {
    Ludus.Screens.home = { startDaily: async () => { calls.sessions.push({ kind: "daily", viaHome: true }); } };
  }
  const fire = (type) => (winListeners.get(type) || []).slice().forEach((fn) => fn({ type }));
  return { Ludus, doc, context, el, calls, location, advance, storageMap, shown, fire, setActive: (value) => { active = value; } };
}

const flush = async (times = 6) => {
  for (let i = 0; i < times; i += 1) await new Promise((resolve) => setImmediate(resolve));
};
const text = (node) => node.textContent.replace(/\s+/g, " ").trim();
const one = (root, predicate) => findAll(root, predicate)[0];
const q = (root, selector) => root.querySelector(selector);
const byFkey = (value) => (el) => el.getAttribute("data-fkey") === value;
const byAction = (value) => (el) => el.getAttribute("data-action") === value;
const cardIds = (root) => findAll(root, (el) => el.classList.contains("classics-item") && el.hasAttribute("data-game")).map((el) => el.getAttribute("data-game"));
const counter = (root) => text(q(root, ".classics-counter"));

let passed = 0;
const pending = [];
function test(name, fn) {
  pending.push({ name, fn });
}
async function runAll() {
  for (const { name, fn } of pending) {
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

// Values built inside the vm context come from another realm: compare them as plain JSON.
const plain = (value) => JSON.parse(JSON.stringify(value));
const deepEq = (actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message);
const notDeepEq = (actual, expected, message) => assert.notDeepStrictEqual(plain(actual), plain(expected), message);

const placeholders = (string) => Array.from(String(string).matchAll(/\{(\w+)\}/g), (m) => m[1]).sort().join(",");

// ---------- pure ----------

test("text: es and en have the same keys and placeholders, none empty", () => {
  const { Ludus } = createEnv();
  const { es, en } = Ludus.Screens.classics.TEXT;
  deepEq(Object.keys(es).sort(), Object.keys(en).sort());
  Object.keys(es).forEach((key) => {
    assert.ok(es[key].length > 0 && en[key].length > 0, `${key} is empty`);
    assert.strictEqual(placeholders(es[key]), placeholders(en[key]), `${key}: placeholders differ`);
    assert.ok(key.startsWith("classics."), `${key} keeps the screen prefix`);
  });
  assert.strictEqual(Ludus.Screens.classics.titleKey, "classics.title");
  assert.ok(Ludus.i18n.t("classics.title", null, "es") !== "classics.title" && Ludus.i18n.t("classics.title", null, "en") !== "classics.title");
  // Spanish is the rioplatense register ("vos") wherever it speaks to the learner.
  assert.ok(es["classics.sub"].includes("Jugá") && es["classics.train.how"].includes("elegís"));
});

test("eras: before 1900, 1900-1949, 1950-1999, 2000 on", () => {
  const { eraOf } = createEnv().Ludus.Screens.classics.helpers;
  assert.strictEqual(eraOf(1851), "e1");
  assert.strictEqual(eraOf(1899), "e1");
  assert.strictEqual(eraOf(1900), "e2");
  assert.strictEqual(eraOf(1949), "e2");
  assert.strictEqual(eraOf(1950), "e3");
  assert.strictEqual(eraOf(1999), "e3");
  assert.strictEqual(eraOf(2000), "e4");
  assert.strictEqual(eraOf(2021), "e4");
  assert.strictEqual(eraOf("garbage"), "e1");
});

test("search: accents, case and word order do not matter; every word must match", async () => {
  const { Ludus } = createEnv();
  await Ludus.Classics.load();
  const h = Ludus.Screens.classics.helpers;
  const games = Ludus.Classics.list();
  const ids = (filters) => h.filterGames(games, filters, "es").map((g) => g.id);
  assert.strictEqual(h.normalizeText("  Réti, Ámsterdam!  "), "reti amsterdam");
  deepEq(ids({ q: "morphy" }), ["paulsen-morphy-1857", "opera-1858"]);
  deepEq(ids({ q: "MORPHY paulsen" }), ["paulsen-morphy-1857"]);
  deepEq(ids({ q: "paulsen morphy" }), ["paulsen-morphy-1857"], "word order");
  deepEq(ids({ q: "réti" }), ["reti-tartakower-1910"], "typed with the accent, stored without");
  deepEq(ids({ q: "hastings" }), ["steinitz-bardeleben-1895"], "event / place");
  assert.ok(ids({ q: "siciliana" }).length === 2 && ids({ q: "sicilian" }).length === 2, "opening in both languages");
  deepEq(ids({ q: "C33" }), ["immortal-1851"], "ECO");
  deepEq(ids({ q: "1851" }), ["immortal-1851"], "year");
  deepEq(ids({ q: "la inmortal" }).slice(0, 1), ["immortal-1851"], "the title in Spanish");
  assert.strictEqual(ids({ q: "zzzz" }).length, 0);
  assert.strictEqual(ids({ q: "   " }).length, 28, "blank means no filter");
  assert.strictEqual(ids({}).length, 28);
});

test("filters combine, unknown values mean no filter, sort is not a filter", async () => {
  const { Ludus } = createEnv();
  await Ludus.Classics.load();
  const h = Ludus.Screens.classics.helpers;
  const games = Ludus.Classics.list();
  const f = (filters) => h.filterGames(games, filters, "en");
  const hard = f({ difficulty: 3 });
  assert.ok(hard.length > 5 && hard.every((g) => g.difficulty === 3));
  const hardModern = f({ difficulty: 3, era: "e4" });
  assert.ok(hardModern.length > 0 && hardModern.length < hard.length && hardModern.every((g) => g.year >= 2000 && g.difficulty === 3));
  assert.ok(f({ era: "e1" }).every((g) => g.year < 1900));
  assert.ok(f({ era: "e2" }).every((g) => g.year >= 1900 && g.year < 1950));
  assert.strictEqual(f({ era: "e1" }).length + f({ era: "e2" }).length + f({ era: "e3" }).length + f({ era: "e4" }).length, 28, "the eras partition the library");
  const theme = games[0].themes[0];
  assert.ok(f({ theme }).every((g) => g.themes.includes(theme)));
  const sac = f({ kind: "sacrifice" });
  assert.ok(sac.length > 0 && sac.every((g) => g.kinds.sacrifice > 0));
  assert.strictEqual(f({ era: "e9", difficulty: 9, theme: "", kind: "", sort: "nope" }).length, 28, "garbage falls back to no filter");
  deepEq(h.cleanFilters(null), h.defaultFilters());
  assert.strictEqual(h.hasActiveFilters({ sort: "title" }), false, "sorting is not a filter");
  assert.strictEqual(h.hasActiveFilters({ q: " x " }), true);
  assert.strictEqual(h.hasActiveFilters({ q: "  " }), false);
  assert.strictEqual(h.activeFilterCount({ q: "a", difficulty: 2, era: "e3", theme: "attack", kind: "tactic" }), 5);
  assert.strictEqual(h.cleanFilters({ q: "x".repeat(200) }).q.length, 80, "the search is capped");
});

test("sort: chronological, by difficulty then year, by title in the language", async () => {
  const { Ludus } = createEnv();
  await Ludus.Classics.load();
  const h = Ludus.Screens.classics.helpers;
  const games = Ludus.Classics.list().reverse();
  const chrono = h.sortGames(games, "chrono", "es");
  assert.strictEqual(chrono[0].id, "immortal-1851");
  assert.strictEqual(chrono[27].id, "carlsen-nepomniachtchi-2021-g6");
  chrono.forEach((g, i) => { if (i) assert.ok(chrono[i - 1].year <= g.year); });
  const diff = h.sortGames(games, "difficulty", "es");
  diff.forEach((g, i) => {
    if (!i) return;
    assert.ok(diff[i - 1].difficulty <= g.difficulty);
    if (diff[i - 1].difficulty === g.difficulty) assert.ok(diff[i - 1].year <= g.year, "ties by year");
  });
  const titlesEn = h.sortGames(games, "title", "en").map((g) => g.title.en);
  deepEq(titlesEn, titlesEn.slice().sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));
  notDeepEq(h.sortGames(games, "title", "es").map((g) => g.id), h.sortGames(games, "title", "en").map((g) => g.id), "the order follows the language");
  assert.strictEqual(games[0].id, "carlsen-nepomniachtchi-2021-g6", "the input is not mutated");
});

test("facets, summary, signature position and train counts", async () => {
  const { Ludus } = createEnv();
  await Ludus.Classics.load();
  const h = Ludus.Screens.classics.helpers;
  const games = Ludus.Classics.list();
  const facets = h.facetOptions(games);
  assert.ok(facets.themes.length >= 10 && facets.themes.every((t) => Ludus.Classics.THEMES.includes(t.id) && t.count >= 1));
  assert.ok(facets.kinds.every((k) => Ludus.Classics.KINDS.includes(k.id)));
  const summary = h.summarize(games);
  assert.strictEqual(summary.games, 28);
  assert.strictEqual(summary.from, 1851);
  assert.strictEqual(summary.to, 2021);
  assert.strictEqual(summary.positions, games.reduce((n, g) => n + g.positionCount, 0));
  deepEq(h.summarize([]), { games: 0, positions: 0, from: null, to: null });
  games.forEach((g) => {
    const record = Ludus.Classics.get(g.id);
    const sig = h.signatureOf(record);
    assert.ok(sig && record.positions.some((p) => p.fen === sig.fen && p.ply === sig.ply), `${g.id}: the signature is one of its positions`);
    assert.strictEqual(sig.orientation, g.protagonist, `${g.id}: the person's side is at the bottom`);
  });
  assert.strictEqual(h.signatureOf(null), null);
  assert.strictEqual(h.signatureOf({ positions: [] }), null);
  deepEq(h.trainCounts(12), [5, 10, 12]);
  deepEq(h.trainCounts(10), [5, 10]);
  deepEq(h.trainCounts(7), [5, 7]);
  deepEq(h.trainCounts(5), [5]);
  deepEq(h.trainCounts(3), [3]);
  deepEq(h.trainCounts(0), []);
  assert.strictEqual(h.moveCountOf(45), 23);
  assert.strictEqual(h.moveCountOf(46), 23);
});

test("mix availability agrees with Ludus.Classics.random (forced mates in one stay out)", async () => {
  const { Ludus } = createEnv();
  await Ludus.Classics.load();
  const h = Ludus.Screens.classics.helpers;
  const records = Ludus.Classics.list().map((g) => Ludus.Classics.get(g.id));
  [1, 2, 3].forEach((level) => {
    const drawn = Ludus.Classics.random(200, { maxDifficulty: level }).length;
    const counted = h.countMixPositions(records, level);
    assert.strictEqual(Math.min(200, counted), drawn, `difficulty ${level}: counted ${counted}, drawn ${drawn}`);
  });
  assert.ok(h.countMixPositions(records, 1) < h.countMixPositions(records, 2));
  assert.strictEqual(h.countMixPositions(null, 3), 0);
});

test("progress: the best attempt on each position, hints that reveal the answer count for nothing", async () => {
  const { Ludus } = createEnv();
  await Ludus.Classics.load();
  const h = Ludus.Screens.classics.helpers;
  const records = ["opera-1858", "immortal-1851"].map((id) => Ludus.Classics.get(id));
  const hash = Ludus.util.hashString;
  const pid = (record, i) => `classic:${hash(record.positions[i].fen)}`;
  const rounds = [
    { positionId: pid(records[0], 0), accuracy: 40, hintsUsed: 0 },
    { positionId: pid(records[0], 0), accuracy: 90, hintsUsed: 0 }, // the best of the position
    { positionId: pid(records[0], 1), accuracy: 100, hintsUsed: 3 }, // revealed: worth nothing
    { positionId: pid(records[0], 2), accuracy: 70, hintsUsed: 1 }, // exactly the pass mark
    { positionId: "classic:unknown", accuracy: 100 },
    { positionId: pid(records[1], 0), accuracy: 55 },
    null,
  ];
  const progress = h.progressByGame(records, rounds, hash);
  const opera = progress.get("opera-1858");
  assert.deepStrictEqual({ played: opera.played, total: opera.total, passed: opera.passed, accuracy: opera.accuracy }, { played: 3, total: 6, passed: 2, accuracy: Math.round((90 + 0 + 70) / 3) });
  assert.deepStrictEqual({ played: progress.get("immortal-1851").played, passed: progress.get("immortal-1851").passed }, { played: 1, passed: 0 });
  assert.strictEqual(progress.size, 2, "games without answers are not listed");
  assert.strictEqual(h.progressByGame([], rounds, hash).size, 0);
  assert.strictEqual(h.progressByGame(records, null, hash).size, 0);
  assert.strictEqual(h.progressByGame(null, rounds).size, 0);
});

test("progress: answers already given show on the cards and on the game page, and follow new answers", async () => {
  const { Ludus, el } = createEnv();
  const screen = Ludus.Screens.classics;
  screen.mount(el);
  Ludus.router.show("classics");
  await flush();
  const card = () => one(el, (n) => n.getAttribute("data-game") === "opera-1858");
  assert.ok(text(card()).includes("6 posiciones de entrenamiento") && findAll(card(), (n) => n.getAttribute("role") === "progressbar").length === 0, "nothing before the first answer");
  const positions = Ludus.Classics.positions("opera-1858", {});
  positions.slice(0, 3).forEach((pos, i) => Ludus.Profile.recordRound({
    id: `p${i}`, ts: Date.now() - i * 1000, source: "classic", sessionKind: "classic", positionId: pos.id, fen: pos.fen, userUci: pos.bestMoveUci, bestUci: pos.bestMoveUci,
    accuracy: [95, 80, 40][i], points: 9, phase: pos.phase, timeSpentMs: 4000,
  }));
  Ludus.bus.emit("profile:changed", {});
  const bar = findAll(card(), (n) => n.getAttribute("role") === "progressbar")[0];
  assert.ok(bar, "a progress bar on the card");
  assert.strictEqual(bar.getAttribute("aria-valuenow"), "50");
  assert.strictEqual(bar.getAttribute("aria-label"), "Practicadas: 3 de 6");
  assert.ok(text(card()).includes("3 de 6 practicadas"));
  Ludus.router.show("classics", { game: "opera-1858" });
  await flush();
  const line = q(el, ".classics-progress-text");
  assert.ok(text(line).includes("Ya practicaste 3 de 6") && text(line).includes("superaste 2") && text(line).includes("72 %"), text(line));
  Ludus.i18n.setLanguage("en", { persist: false });
  assert.ok(text(q(el, ".classics-progress-text")).includes("You have practised 3 of 6") && text(q(el, ".classics-progress-text")).includes("passed 2"));
  // All six practised: the sentence changes and the bar is complete.
  positions.slice(3).forEach((pos, i) => Ludus.Profile.recordRound({
    id: `q${i}`, ts: Date.now() + i, source: "classic", sessionKind: "classic", positionId: pos.id, fen: pos.fen, userUci: pos.bestMoveUci, bestUci: pos.bestMoveUci,
    accuracy: 100, points: 10, phase: pos.phase, timeSpentMs: 4000,
  }));
  Ludus.bus.emit("session:completed", {});
  Ludus.router.show("classics");
  await flush();
  const done = findAll(card(), (n) => n.getAttribute("role") === "progressbar")[0];
  assert.strictEqual(done.getAttribute("aria-valuenow"), "100");
});

test("verified rule and safe source links", async () => {
  const { Ludus } = createEnv();
  await Ludus.Classics.load();
  const h = Ludus.Screens.classics.helpers;
  Ludus.Classics.list().forEach((g) => assert.strictEqual(h.isVerified(Ludus.Classics.get(g.id)), true, g.id));
  assert.strictEqual(h.isVerified({ sources: ["Score: x"] }), false, "one source is not enough");
  assert.strictEqual(h.isVerified({ sources: ["Facts: a", "Facts: b"] }), false, "no source names the score");
  assert.strictEqual(h.isVerified({}), false);
  assert.strictEqual(h.isVerified(null), false);
  const parts = h.linkifySource("Facts (1851): summaries of https://www.chess.com/article/view/the-immortal-game and https://example.org/a_b?c=1, plus javascript:alert(1) and http://insecure.test/x.");
  const links = parts.filter((p) => p.href);
  deepEq(links.map((p) => p.href), ["https://www.chess.com/article/view/the-immortal-game", "https://example.org/a_b?c=1"], "only https, no trailing punctuation");
  assert.strictEqual(parts.map((p) => p.text).join(""), "Facts (1851): summaries of https://www.chess.com/article/view/the-immortal-game and https://example.org/a_b?c=1, plus javascript:alert(1) and http://insecure.test/x.", "nothing is lost");
  assert.ok(!parts.some((p) => p.href && !p.href.startsWith("https://")));
  deepEq(h.linkifySource("plain"), [{ text: "plain" }]);
  deepEq(h.linkifySource(null), []);
});

test("hash routes: #/classics/<id> only for a plain id", () => {
  const h = createEnv().Ludus.Screens.classics.helpers;
  assert.strictEqual(h.parseGameHash("#/classics/opera-1858"), "opera-1858");
  assert.strictEqual(h.parseGameHash("#/classics/opera-1858/"), "opera-1858");
  assert.strictEqual(h.parseGameHash("#/classics"), null);
  assert.strictEqual(h.parseGameHash("#/classics/"), null);
  assert.strictEqual(h.parseGameHash("#/classics/../home"), null);
  assert.strictEqual(h.parseGameHash("#/classics/A B"), null);
  assert.strictEqual(h.parseGameHash("#/classics/<script>"), null);
  assert.strictEqual(h.parseGameHash("#/classics/" + "a".repeat(200)), null);
  assert.strictEqual(h.parseGameHash("#/museum/timeline"), null);
  assert.strictEqual(h.isClassicsHash("#/classics"), true);
  assert.strictEqual(h.isClassicsHash("#/classics/opera-1858"), false);
  assert.strictEqual(h.buildGameHash("opera-1858"), "#/classics/opera-1858");
  assert.strictEqual(h.buildGameHash(null), "#/classics");
});

test("display: names, events, sites, results in both languages", async () => {
  const { Ludus } = createEnv();
  await Ludus.Classics.load();
  const h = Ludus.Screens.classics.helpers;
  assert.strictEqual(h.displayName("Jose Raul Capablanca", "es"), "José Raúl Capablanca");
  assert.strictEqual(h.displayName("Richard Reti", "en"), "Richard Réti");
  assert.strictEqual(h.displayName("Paul Morphy", "es"), "Paul Morphy");
  assert.strictEqual(h.displayName("Duke Karl of Brunswick and Count Isouard", "es"), "el duque Carlos de Brunswick y el conde Isouard");
  assert.strictEqual(h.eventLabel("Casual game", "es"), "Partida amistosa");
  assert.strictEqual(h.eventLabel("Casual game", "en"), "Casual game");
  assert.strictEqual(h.eventLabel("Hastings", "es"), "Hastings", "proper names are kept");
  // The coach card and the notebook show a stored classic's metadata through localizeMeta (regression: a Spanish page
  // used to say "Casual game" and "Duke Karl of Brunswick and Count Isouard").
  const stored = { players: "Paul Morphy vs Duke Karl of Brunswick and Count Isouard", event: "Casual game", year: "1858", site: "Paris FRA", moveNumber: 7 };
  const shownEs = h.localizeMeta(stored, "es");
  assert.strictEqual(shownEs.players, "Paul Morphy vs el duque Carlos de Brunswick y el conde Isouard");
  assert.strictEqual(shownEs.event, "Partida amistosa");
  assert.strictEqual(shownEs.year, "1858");
  assert.strictEqual(shownEs.moveNumber, 7, "the other fields pass through");
  assert.strictEqual(stored.event, "Casual game", "the stored metadata is not touched");
  assert.strictEqual(h.localizeMeta(stored, "en").event, "Casual game");
  assert.strictEqual(h.localizeMeta({ players: "Ana vs Marta_92", event: "Lichess blitz" }, "es").players, "Ana vs Marta_92", "a person's own games pass through");
  assert.strictEqual(h.localizeMeta({ players: "Somebody" }, "es").players, "Somebody", "not two players: unchanged");
  assert.strictEqual(Object.keys(h.localizeMeta(null, "es")).length, 0, "no metadata: an empty one");
  assert.strictEqual(h.siteLabel("London ENG", "es"), "Londres, Inglaterra");
  assert.strictEqual(h.siteLabel("London ENG", "en"), "London, England");
  assert.strictEqual(h.siteLabel("New York USA", "es"), "Nueva York, EE. UU.");
  assert.strictEqual(h.siteLabel("Somewhere", "en"), "Somewhere");
  assert.strictEqual(h.cityLabel("Moscow URS", "es"), "Moscú");
  Ludus.Classics.list().forEach((g) => {
    ["es", "en"].forEach((lang) => {
      const site = h.siteLabel(g.site, lang);
      assert.ok(site && !/\b(?!USA\b)[A-Z]{3}$/.test(site), `${g.id}/${lang}: no country code left in "${site}"`);
      assert.ok(h.eventLabel(g.event, lang).length > 0);
    });
  });
  assert.strictEqual(h.resultSide("1-0"), "w");
  assert.strictEqual(h.resultSide("0-1"), "b");
  assert.strictEqual(h.resultSide("1/2-1/2"), "d");
  assert.strictEqual(h.prettyResult("1/2-1/2"), "½–½");
  assert.strictEqual(h.prettyResult("1-0"), "1–0");
});

// ---------- replay ----------

test("replay model: every game, every ply (squares, checks, castling, training and notes)", async () => {
  const { Ludus } = createEnv();
  await Ludus.Classics.load();
  const h = Ludus.Screens.classics.helpers;
  const { Chess } = Ludus.chess;
  let plies = 0;
  Ludus.Classics.list().forEach((g) => {
    const record = Ludus.Classics.get(g.id);
    const story = Ludus.Classics.story(g.id);
    const model = h.buildReplayModel(story, Ludus.chess);
    assert.ok(model, `${g.id}: the model is built`);
    assert.strictEqual(model.total, record.moves.length);
    assert.strictEqual(h.fenAt(model, 0), Chess.START_FEN);
    assert.strictEqual(h.fenAt(model, model.total), story.plies[story.plies.length - 1].fen);
    assert.strictEqual(h.fenAt(model, 9999), h.fenAt(model, model.total), "clamped");
    assert.strictEqual(h.fenAt(model, -3), Chess.START_FEN, "clamped");
    assert.strictEqual(model.plies.filter((p) => p.training).length, record.positions.length, `${g.id}: one marker per training position`);
    model.plies.forEach((p, i) => {
      plies += 1;
      assert.ok(/^[a-h][1-8]$/.test(p.from) && /^[a-h][1-8]$/.test(p.to) && p.from !== p.to, `${g.id} ply ${i}`);
      // The squares are the move: the piece that was on `from` is (or became) the piece on `to`.
      const before = new Chess(p.fenBefore).board[Chess.squareToIndex(p.from)];
      assert.ok(before, `${g.id} ply ${i}: there is a piece on ${p.from}`);
      assert.strictEqual(before === before.toUpperCase(), p.color === "w", `${g.id} ply ${i}: the mover's colour`);
      assert.ok(new Chess(p.fen).board[Chess.squareToIndex(p.to)], `${g.id} ply ${i}: something stands on ${p.to}`);
      if (p.check) {
        const after = new Chess(p.fen);
        const king = after.board[Chess.squareToIndex(p.check)];
        assert.strictEqual(king, after.turn === "w" ? "K" : "k", `${g.id} ply ${i}: the checked king`);
        assert.ok(p.san.includes("+") || p.san.includes("#"));
      } else {
        assert.ok(!/[+#]/.test(p.san), `${g.id} ply ${i}: a check has its square`);
      }
      assert.strictEqual(p.capture, p.san.includes("x"));
      assert.strictEqual(p.mate, p.san.endsWith("#"));
      if (p.san.startsWith("O-O")) {
        assert.ok(p.from === "e1" || p.from === "e8", "castling is the king's move");
        assert.ok(["g1", "c1", "g8", "c8"].includes(p.to));
      }
      if (p.note) assert.ok(p.training && p.note.es && p.note.en, "notes are on training plies");
    });
    record.positions.forEach((pos) => {
      const entry = model.plies[pos.ply];
      assert.ok(entry.training, `${g.id}: ply ${pos.ply} is a training ply`);
      assert.strictEqual(entry.san, pos.san);
      assert.strictEqual(entry.fenBefore, pos.fen, "the position before it is the training position");
      assert.strictEqual(Boolean(entry.note), Boolean(pos.note));
    });
    assert.strictEqual(model.protagonist, g.protagonist);
  });
  assert.ok(plies > 1500, `${plies} plies checked`);
  const opera = h.buildReplayModel(Ludus.Classics.story("opera-1858"), Ludus.chess);
  assert.strictEqual(opera.plies[0].from, "e2");
  assert.strictEqual(opera.plies[0].to, "e4");
  assert.strictEqual(h.formatPly(opera.plies[0]), "1. e4");
  assert.strictEqual(h.formatPly(opera.plies[1]), "1... e5");
  assert.strictEqual(h.plyAt(opera, 0), null);
  assert.strictEqual(h.plyAt(opera, 1).san, "e4");
  assert.strictEqual(h.plyAt(opera, opera.total + 1), null);
  assert.strictEqual(h.nextPlyAt(opera, 0).san, "e4");
  assert.strictEqual(h.nextPlyAt(opera, opera.total), null);
  assert.strictEqual(opera.plies[32].mate, true, "Rd8# mates");
  assert.strictEqual(opera.plies[32].check, "e8");
  assert.strictEqual(h.buildReplayModel(null, Ludus.chess), null);
  assert.strictEqual(h.buildReplayModel({ plies: [{ san: "Zz9", fen: "", fenBefore: "" }], startFen: Chess.START_FEN }, Ludus.chess), null, "an illegal move gives no model instead of a broken board");
  assert.strictEqual(h.buildReplayModel(Ludus.Classics.story("opera-1858"), {}), null, "without chess.js there is no model");
});

test("move rows pair White and Black by move number", async () => {
  const { Ludus } = createEnv();
  await Ludus.Classics.load();
  const h = Ludus.Screens.classics.helpers;
  const model = h.buildReplayModel(Ludus.Classics.story("immortal-1851"), Ludus.chess);
  const rows = h.buildMoveRows(model);
  assert.strictEqual(rows.length, Math.ceil(model.total / 2));
  deepEq(rows.slice(0, 2).map((r) => [r.no, r.white.san, r.black.san]), [[1, "e4", "e5"], [2, "f4", "exf4"]]);
  assert.strictEqual(rows[rows.length - 1].black, null, "an odd number of plies ends on White");
  assert.strictEqual(rows.reduce((n, r) => n + (r.white ? 1 : 0) + (r.black ? 1 : 0), 0), model.total);
  deepEq(h.buildMoveRows(null), []);
});

test("replay state machine: clamps, stops at the end, play restarts, tick", () => {
  const { createReplayState } = createEnv().Ludus.Screens.classics.helpers;
  const r = createReplayState(5, { speed: "fast" });
  deepEq(JSON.parse(JSON.stringify(r.state())), { index: 0, total: 5, playing: false, speed: "fast", atStart: true, atEnd: false });
  assert.strictEqual(r.prev().index, 0, "no going before the start");
  assert.strictEqual(r.next().index, 1);
  assert.strictEqual(r.goto(99).index, 5, "clamped to the end");
  assert.strictEqual(r.goto(-4).index, 0);
  assert.strictEqual(r.goto("3").index, 3);
  assert.strictEqual(r.goto("x").index, 0);
  assert.strictEqual(r.tick(), false, "not playing: nothing moves");
  r.play();
  assert.strictEqual(r.state().playing, true);
  assert.strictEqual(r.tick(), true);
  assert.strictEqual(r.state().index, 1);
  assert.strictEqual(r.next().index, 2);
  assert.strictEqual(r.state().playing, true, "next does not stop by itself (the screen pauses it)");
  r.goto(4);
  assert.strictEqual(r.tick(), true);
  assert.strictEqual(r.state().index, 5);
  assert.strictEqual(r.state().playing, false, "auto play stops on the last position");
  assert.strictEqual(r.tick(), false);
  r.play();
  assert.strictEqual(r.state().index, 0, "play at the end starts over");
  assert.strictEqual(r.state().playing, true);
  r.pause();
  assert.strictEqual(r.state().playing, false);
  r.toggle();
  assert.strictEqual(r.state().playing, true);
  r.toggle();
  assert.strictEqual(r.state().playing, false);
  r.last();
  assert.strictEqual(r.state().index, 5);
  assert.strictEqual(r.toggle().playing, true, "toggle at the end restarts");
  assert.strictEqual(r.state().index, 0);
  r.first();
  assert.strictEqual(r.state().index, 0);
  assert.strictEqual(r.setSpeed("slow").speed, "slow");
  assert.strictEqual(r.setSpeed("warp").speed, "slow", "an unknown speed is ignored");
  const empty = createReplayState(0);
  assert.strictEqual(empty.play().playing, false, "nothing to play");
  assert.strictEqual(empty.next().index, 0);
  assert.strictEqual(createReplayState(4, { index: 9 }).state().index, 4);
  assert.strictEqual(createReplayState(4, { speed: "nope" }).state().speed, "normal");
});

test("auto play delay: the speed's pace, or the reading time of the note", () => {
  const { autoDelayMs, SPEED_MS } = createEnv().Ludus.Screens.classics.helpers;
  assert.ok(SPEED_MS.fast < SPEED_MS.normal && SPEED_MS.normal < SPEED_MS.slow);
  assert.strictEqual(autoDelayMs("normal", "", null), SPEED_MS.normal);
  assert.strictEqual(autoDelayMs("nope", "", null), SPEED_MS.normal);
  assert.strictEqual(autoDelayMs("fast", "a note", () => 6000), 6000, "a note is read first");
  assert.strictEqual(autoDelayMs("slow", "a note", () => 1000), SPEED_MS.slow, "never faster than the pace");
  assert.strictEqual(autoDelayMs("fast", "a note", () => { throw new Error("x"); }), SPEED_MS.fast, "a failing reader does not break the replay");
});

test("describeFen: who moves and where the pieces stand, in the language", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.classics.helpers;
  const fen = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1";
  const es = h.describeFen(fen);
  assert.ok(es.includes("juegan las blancas") && es.includes("Rey e1") && es.includes("Peón e2") && es.includes("Negras: Rey e8"), es);
  Ludus.i18n.setLanguage("en", { persist: false });
  const en = h.describeFen(fen);
  assert.ok(en.includes("White to move") && en.includes("King e1") && en.includes("Pawn e2"), en);
  assert.strictEqual(h.describeFen("garbage"), "");
});

// ---------- the screen ----------

test("gallery: 28 cards with a board, links, counts; the shell of the screen is idempotent", async () => {
  const { Ludus, el } = createEnv();
  const screen = Ludus.Screens.classics;
  screen.mount(el);
  screen.mount(el);
  assert.strictEqual(findAll(el, byClass("classics")).length, 1, "mounting twice draws once");
  assert.strictEqual(findAll(el, (n) => n.tagName === "H1").length, 1);
  assert.strictEqual(cardIds(el).length, 0, "nothing is loaded at mount");
  assert.ok(findAll(el, byClass("skeleton")).length > 0 || findAll(el, byClass("classics-loading")).length > 0, "a skeleton while there is no data");
  Ludus.router.show("classics");
  await flush();
  assert.strictEqual(cardIds(el).length, 28);
  assert.strictEqual(text(q(el, ".classics-count")), "28 partidas");
  const card = one(el, (n) => n.getAttribute("data-game") === "opera-1858");
  assert.strictEqual(findAll(card, (n) => n.tagName.toLowerCase() === "svg" && n.classList.contains("mini-board")).length, 1);
  const link = q(card, ".classics-card-link");
  assert.strictEqual(link.getAttribute("href"), "#/classics/opera-1858");
  assert.ok(text(card).includes("La Ópera") && text(card).includes("Paul Morphy") && text(card).includes("Defensa Philidor") && text(card).includes("6 posiciones de entrenamiento"));
  assert.ok(text(card).includes("Jugadas contrastadas"), "the verified mark shows because the data has sources");
  assert.ok(text(card).includes("Fácil"), "difficulty is written, not only drawn");
  assert.strictEqual(findAll(card, byClass("classics-diff-dot")).length, 3);
  assert.strictEqual(findAll(card, (n) => n.classList.contains("classics-diff-dot") && n.classList.contains("is-on")).length, 1);
  assert.ok(text(card).includes("París"), "sites are localised");
  assert.strictEqual(Ludus.router.current(), "classics");
});

test("gallery: search, filters, chips and the empty state", async () => {
  const { Ludus, el } = createEnv({ language: "en" });
  Ludus.Screens.classics.mount(el);
  Ludus.router.show("classics");
  await flush();
  const search = q(el, "#classics-search");
  search.value = "morphy";
  search.dispatch("input");
  search.dispatch("keydown", { key: "Enter" });
  deepEq(cardIds(el), ["paulsen-morphy-1857", "opera-1858"]);
  assert.strictEqual(text(q(el, ".classics-count")), "2 of 28 games");
  const chips = findAll(el, byClass("classics-active-chip"));
  assert.strictEqual(chips.length, 1);
  assert.ok(text(chips[0]).includes("morphy"));
  assert.ok(chips[0].getAttribute("aria-label").startsWith("Remove filter"));
  chips[0].click();
  assert.strictEqual(cardIds(el).length, 28);
  assert.strictEqual(search.value, "", "removing the chip empties the box");
  const seg = (value) => q(el, `.classics-diff-seg button[data-value="${value}"]`);
  seg("1").click();
  const easy = cardIds(el);
  assert.ok(easy.length > 0 && easy.length < 28 && easy.every((id) => Ludus.Classics.get(id).difficulty === 1));
  assert.strictEqual(seg("1").getAttribute("aria-pressed"), "true");
  assert.strictEqual(seg("0").getAttribute("aria-pressed"), "false");
  const era = q(el, "#classics-era");
  era.value = "e4";
  era.dispatch("change");
  assert.ok(cardIds(el).every((id) => Ludus.Classics.get(id).year >= 2000 && Ludus.Classics.get(id).difficulty === 1));
  assert.strictEqual(findAll(el, byClass("classics-active-chip")).length, 2);
  q(el, ".classics-clear").click();
  assert.strictEqual(cardIds(el).length, 28);
  assert.strictEqual(era.value, "all");
  assert.strictEqual(seg("0").getAttribute("aria-pressed"), "true");
  const sort = q(el, "#classics-sort");
  sort.value = "title";
  sort.dispatch("change");
  const titles = findAll(el, byClass("classics-card-title")).map((n) => text(n));
  deepEq(titles, titles.slice().sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));
  search.value = "zzzz";
  search.dispatch("input");
  search.dispatch("keydown", { key: "Enter" });
  assert.strictEqual(cardIds(el).length, 0);
  const empty = q(el, ".classics-empty");
  assert.ok(!empty.hasAttribute("hidden"));
  assert.ok(text(empty).includes("No game matches"));
  q(empty, ".btn").click();
  assert.strictEqual(cardIds(el).length, 28);
  assert.ok(empty.hasAttribute("hidden"));
  assert.strictEqual(sort.value, "title", "clearing the filters keeps the sort order");
});

test("gallery: the search box is debounced and keeps its node (focus) while typing", async () => {
  const { Ludus, el, advance } = createEnv();
  Ludus.Screens.classics.mount(el);
  Ludus.router.show("classics");
  await flush();
  const search = q(el, "#classics-search");
  search.value = "hast";
  search.dispatch("input");
  assert.strictEqual(cardIds(el).length, 28, "not yet: the debounce is waiting");
  advance(200);
  assert.strictEqual(cardIds(el).length, 1);
  assert.strictEqual(q(el, "#classics-search"), search, "the input is the same node");
});

test("mix: difficulty and count reach Ludus.Classics.random; the choice is stored; a short pool is said", async () => {
  const { Ludus, el, calls, storageMap } = createEnv();
  Ludus.Screens.classics.mount(el);
  Ludus.router.show("classics");
  await flush();
  const mix = q(el, ".classics-mix");
  const pick = (label, value) => q(findAll(mix, (n) => n.getAttribute("aria-label") === label)[0], `button[data-value="${value}"]`).click();
  pick("Dificultad máxima", 1);
  pick("Cantidad de posiciones", 20);
  const easyPool = Ludus.Classics.random(200, { maxDifficulty: 1 }).length;
  assert.ok(text(q(mix, ".classics-mix-hint")).includes(String(easyPool)), text(q(mix, ".classics-mix-hint")));
  const expectedCount = Math.min(20, easyPool);
  assert.ok(text(q(mix, ".classics-mix-start")).includes(`${expectedCount} posiciones`));
  q(mix, ".classics-mix-start").click();
  await flush();
  assert.strictEqual(calls.sessions.length, 1);
  const spec = calls.sessions[0];
  assert.strictEqual(spec.kind, "classic");
  assert.strictEqual(spec.title, "Mezcla de clásicos");
  assert.ok(spec.positions.length === expectedCount && spec.positions.every((p) => p.classic.difficulty <= 1 && p.source === "classic"));
  assert.ok(new Set(spec.positions.map((p) => p.classic.gameId)).size > 3, "one per game before repeating");
  const stored = JSON.parse(storageMap.get("ludus.classics.mix.v1"));
  assert.strictEqual(stored.difficulty, 1);
  assert.strictEqual(stored.count, 20);
  // A new screen remembers it.
  const again = createEnv();
  again.storageMap.set("ludus.classics.mix.v1", JSON.stringify({ v: 1, difficulty: 2, count: 5 }));
  again.Ludus.Screens.classics.mount(again.el);
  again.Ludus.router.show("classics");
  await flush();
  assert.strictEqual(q(again.el, '.classics-mix [data-value="2"]').getAttribute("aria-pressed"), "true");
  assert.strictEqual(q(again.el, '.classics-mix .classics-seg [data-value="5"]').getAttribute("aria-pressed"), "true");
  // Garbage in storage means the defaults.
  const bad = createEnv();
  bad.storageMap.set("ludus.classics.mix.v1", JSON.stringify({ difficulty: 99, count: "x" }));
  bad.Ludus.Screens.classics.mount(bad.el);
  bad.Ludus.router.show("classics");
  await flush();
  assert.strictEqual(q(bad.el, '.classics-mix [data-value="3"]').getAttribute("aria-pressed"), "true");
});

test("mix: fewer positions than asked says so and uses what exists", async () => {
  const { Ludus, el, calls } = createEnv();
  Ludus.Screens.classics.mount(el);
  Ludus.router.show("classics");
  await flush();
  Ludus.Screens.classics._state.mixAvailable[1] = 4; // a small pool
  Ludus.Screens.classics._state.mix = { difficulty: 1, count: 10 };
  Ludus.Screens.classics.render();
  const mix = q(el, ".classics-mix");
  assert.ok(text(q(mix, ".classics-mix-hint")).includes("Hay solo 4"));
  assert.ok(text(q(mix, ".classics-mix-start")).includes("4 posiciones"));
  Ludus.Screens.classics._state.mixAvailable[1] = 0;
  Ludus.Screens.classics.render();
  assert.strictEqual(q(el, ".classics-mix-start").disabled, true, "nothing to start");
  assert.strictEqual(calls.sessions.length, 0);
});

test("daily strip: pending shows the play button (through the home screen when there is one), done does not", async () => {
  const { Ludus, el, calls } = createEnv({ homeStub: true });
  Ludus.Screens.classics.mount(el);
  Ludus.router.show("classics");
  await flush();
  const strip = q(el, ".classics-daily");
  assert.ok(strip && strip.classList.contains("card"));
  assert.strictEqual(findAll(strip, (n) => n.tagName.toLowerCase() === "svg" && n.classList.contains("mini-board")).length, 1);
  assert.ok(text(strip).includes("La posición de hoy") && text(strip).includes("Pendiente"));
  findAll(strip, byFkey("daily-play"))[0].click();
  await flush();
  deepEq(calls.sessions.map((s) => s.kind), ["daily"]);
  assert.strictEqual(calls.sessions[0].viaHome, true);
  Ludus.Profile.daily.complete(Ludus.Screens.classics.helpers.localDateKey(), 88);
  Ludus.bus.emit("profile:changed", {});
  await flush();
  const done = q(el, ".classics-daily");
  assert.ok(done.classList.contains("is-done") && text(done).includes("¡Desafío de hoy completado!") && text(done).includes("88%"));
  assert.strictEqual(findAll(done, byFkey("daily-play")).length, 0);

  // Without the home screen the strip starts the daily session itself (same position, with its date key).
  const solo = createEnv();
  solo.Ludus.Screens.classics.mount(solo.el);
  solo.Ludus.router.show("classics");
  await flush();
  findAll(solo.el, byFkey("daily-play"))[0].click();
  await flush();
  const spec = solo.calls.sessions[0];
  const key = solo.Ludus.Screens.classics.helpers.localDateKey();
  assert.strictEqual(spec.kind, "daily");
  assert.strictEqual(spec.positions[0].dailyKey, key);
  assert.strictEqual(spec.positions[0].id, solo.Ludus.Classics.daily(key).id);
});

test("game page: opening a card shows the replay, mirrors the hash and moves focus to the title", async () => {
  const { Ludus, el } = createEnv();
  const screen = Ludus.Screens.classics;
  screen.mount(el);
  Ludus.router.show("classics");
  await flush();
  const link = one(el, byFkey("open-opera-1858"));
  const evt = link.dispatch("click", { button: 0 });
  assert.strictEqual(evt.defaultPrevented, true, "the anchor is handled in the screen");
  assert.strictEqual(screen._state.view, "game");
  assert.strictEqual(screen._state.gameId, "opera-1858");
  const page = q(el, ".classics-detail-page");
  assert.strictEqual(page.getAttribute("data-game"), "opera-1858");
  assert.strictEqual(text(q(el, ".classics-detail-title")), "La Ópera");
  assert.strictEqual(el.ownerDocument.activeElement, q(el, ".classics-detail-title"));
  assert.strictEqual(findAll(el, (n) => n.tagName === "H1").length, 1);
  assert.strictEqual(counter(el), "0 / 33");
  assert.strictEqual(findAll(el, byClass("classics-move")).length, 33);
  assert.strictEqual(findAll(el, byClass("classics-tick")).length, 6);
  assert.strictEqual(findAll(el, (n) => n.classList.contains("classics-move") && n.classList.contains("is-training")).length, 6);
  assert.ok(text(q(el, ".classics-train-how")).startsWith("Jugás con las blancas: en cada posición elegís tu jugada"));
  assert.ok(text(q(el, ".classics-about")).includes("Fuentes y verificación"));
  const links = findAll(q(el, ".classics-sources"), (n) => n.tagName === "A");
  assert.ok(links.length >= 1 && links.every((a) => a.getAttribute("href").startsWith("https://") && a.getAttribute("rel") === "noopener noreferrer" && a.getAttribute("target") === "_blank"));
});

test("game page: hash mirrored, back returns to the gallery with focus on the card", async () => {
  const env = createEnv();
  const { Ludus, el, location, advance } = env;
  const screen = Ludus.Screens.classics;
  screen.mount(el);
  Ludus.router.show("classics");
  await flush();
  one(el, byFkey("open-opera-1858")).dispatch("click", { button: 0 });
  advance(5);
  assert.strictEqual(location.hash, "#/classics/opera-1858");
  one(el, byFkey("back")).click();
  advance(5);
  assert.strictEqual(location.hash, "#/classics");
  assert.strictEqual(screen._state.view, "list");
  assert.strictEqual(cardIds(el).length, 28);
  assert.strictEqual(el.ownerDocument.activeElement.getAttribute("data-fkey"), "open-opera-1858", "focus returns to the card");
  // A modified click (open in a new tab) is left to the browser.
  const modified = one(el, byFkey("open-opera-1858")).dispatch("click", { button: 0, ctrlKey: true });
  assert.strictEqual(modified.defaultPrevented, false);
  assert.strictEqual(screen._state.view, "list");
});

test("route params: show({game}) opens the page; an unknown id shows the gallery with a notice; no params = gallery", async () => {
  const { Ludus, el } = createEnv();
  const screen = Ludus.Screens.classics;
  screen.mount(el);
  Ludus.router.show("classics", { game: "immortal-1851" });
  await flush();
  assert.strictEqual(text(q(el, ".classics-detail-title")), "La Inmortal");
  Ludus.router.show("classics");
  assert.strictEqual(screen._state.view, "list", "the nav link goes back to the gallery");
  assert.strictEqual(cardIds(el).length, 28);
  Ludus.router.show("classics", { game: "nope" });
  await flush();
  assert.strictEqual(cardIds(el).length, 28);
  assert.ok(text(q(el, ".classics-notice")).includes("No encontramos esa partida"));
  Ludus.router.show("classics", { gameId: "opera-1858" });
  assert.strictEqual(screen._state.gameId, "opera-1858", "gameId works too");
});

test("replay controls: next / previous / first / last, the scrubber, the list, flip, aria-disabled keeps focus", async () => {
  const { Ludus, el } = createEnv();
  const screen = Ludus.Screens.classics;
  screen.mount(el);
  Ludus.router.show("classics", { game: "opera-1858" });
  await flush();
  const btn = (action) => one(el, byAction(action));
  assert.strictEqual(btn("first").getAttribute("aria-disabled"), "true");
  assert.strictEqual(btn("prev").getAttribute("aria-disabled"), "true");
  assert.strictEqual(btn("next").getAttribute("aria-disabled"), "false");
  assert.ok(text(q(el, ".classics-now")).includes("Posición inicial"));
  btn("next").click();
  assert.strictEqual(counter(el), "1 / 33");
  assert.ok(text(q(el, ".classics-now")).includes("1. e4"));
  assert.ok(text(q(el, ".classics-now")).includes("Blancas · jugada 1"));
  assert.strictEqual(btn("prev").getAttribute("aria-disabled"), "false");
  btn("next").click();
  assert.ok(text(q(el, ".classics-now")).includes("1... e5") && text(q(el, ".classics-now")).includes("Negras · jugada 1"));
  btn("last").click();
  assert.strictEqual(counter(el), "33 / 33");
  assert.strictEqual(btn("next").getAttribute("aria-disabled"), "true");
  assert.ok(text(q(el, ".classics-now")).includes("Fin de la partida") && text(q(el, ".classics-now")).includes("Rd8#"));
  btn("next").click();
  assert.strictEqual(counter(el), "33 / 33", "a click on an aria-disabled button does nothing");
  btn("first").click();
  assert.strictEqual(counter(el), "0 / 33");
  // The scrubber.
  const slider = q(el, ".classics-scrub-input");
  slider.value = "20";
  slider.dispatch("input");
  assert.strictEqual(counter(el), "20 / 33");
  assert.strictEqual(slider.getAttribute("aria-valuetext"), "Jugada 20 de 33");
  // The list of moves: one tab stop, the current one marked, a click jumps.
  const moves = findAll(el, byClass("classics-move"));
  assert.strictEqual(moves.filter((m) => m.getAttribute("tabindex") === "0").length, 1);
  assert.strictEqual(moves.filter((m) => m.getAttribute("aria-current") === "step").length, 1);
  assert.strictEqual(one(el, (n) => n.getAttribute("aria-current") === "step").getAttribute("data-ply"), "19");
  moves[10].click();
  assert.strictEqual(counter(el), "11 / 33");
  assert.strictEqual(el.ownerDocument.activeElement, moves[10], "focus stays on the move that was clicked");
  assert.ok(moves[10].getAttribute("aria-label").includes("Blancas") || moves[10].getAttribute("aria-label").includes("Negras"));
  // Flip keeps the position.
  assert.strictEqual(screen._state.detail.orientation, "w");
  btn("flip").click();
  assert.strictEqual(screen._state.detail.orientation, "b");
  assert.strictEqual(counter(el), "11 / 33");
  const strips = findAll(el, byClass("classics-player"));
  assert.ok(strips[0].classList.contains("classics-player-w") && strips[1].classList.contains("classics-player-b"), "with Black at the bottom the strips swap");
  assert.ok(text(strips[1]).length > 0);
  assert.ok(findAll(el, byClass("classics-player-tag")).length === 1 && text(q(el, ".classics-player-w")).includes("Entrenás con este bando"), "the trained side is tagged");
});

test("replay: the note of a moment shows after its move, the cue with the try button before it", async () => {
  const { Ludus, el, calls } = createEnv();
  Ludus.Screens.classics.mount(el);
  Ludus.router.show("classics", { game: "opera-1858" });
  await flush();
  // Looked up each time: a language switch redraws the page.
  const goto = (n) => { const slider = q(el, ".classics-scrub-input"); slider.value = String(n); slider.dispatch("input"); };
  const record = Ludus.Classics.get("opera-1858");
  const moment = record.positions.find((p) => p.note);
  goto(moment.ply);
  assert.strictEqual(findAll(el, byClass("classics-note")).length, 0, "no spoiler before the master's move");
  const cue = q(el, ".classics-cue");
  assert.ok(cue && text(cue).includes("Posición de entrenamiento") && text(cue).includes("¿Cuál elegirías?"));
  findAll(cue, byFkey("try-position"))[0].click();
  await flush();
  assert.strictEqual(calls.sessions.length, 1);
  assert.strictEqual(calls.sessions[0].positions.length, 1);
  assert.strictEqual(calls.sessions[0].positions[0].classic.ply, moment.ply);
  assert.strictEqual(calls.sessions[0].positions[0].fen, moment.fen);
  assert.strictEqual(calls.sessions[0].kind, "classic");
  goto(moment.ply + 1);
  assert.strictEqual(text(q(el, ".classics-note-text")), moment.note.es);
  assert.ok(text(q(el, ".classics-note-label")).includes("Momento clave"));
  Ludus.i18n.setLanguage("en", { persist: false });
  assert.strictEqual(counter(el), `${moment.ply + 1} / 33`, "a language switch keeps the position");
  assert.strictEqual(text(q(el, ".classics-note-text")), moment.note.en);
  // A training move without a written note gets the plain cue afterwards.
  const plain = record.positions.find((p) => !p.note);
  goto(plain.ply + 1);
  assert.ok(text(q(el, ".classics-cue")).includes("Esta jugada es una de las posiciones de entrenamiento") || text(q(el, ".classics-cue")).includes("This move is one of the training positions"));
});

test("keyboard: arrows, Home, End and Space act from the document; keys aimed elsewhere are left alone", async () => {
  const { Ludus, el, doc } = createEnv();
  Ludus.Screens.classics.mount(el);
  Ludus.router.show("classics", { game: "opera-1858" });
  await flush();
  const press = (key, target) => {
    const evt = { key, target: target || doc.body, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    (doc.listeners.get("keydown") || []).slice().forEach((fn) => fn(evt));
    return evt;
  };
  assert.strictEqual(press("ArrowRight").defaultPrevented, true);
  press("ArrowRight");
  assert.strictEqual(counter(el), "2 / 33");
  press("ArrowLeft");
  assert.strictEqual(counter(el), "1 / 33");
  press("End");
  assert.strictEqual(counter(el), "33 / 33");
  press("Home");
  assert.strictEqual(counter(el), "0 / 33");
  press(" ");
  assert.strictEqual(Ludus.Screens.classics._state.detail.replay.state().playing, true);
  press(" ");
  assert.strictEqual(Ludus.Screens.classics._state.detail.replay.state().playing, false);
  // Inside the list, up / down jump a whole move.
  const move = findAll(el, byClass("classics-move"))[4];
  move.click();
  assert.strictEqual(counter(el), "5 / 33");
  press("ArrowDown", move);
  assert.strictEqual(counter(el), "7 / 33");
  press("ArrowUp", move);
  assert.strictEqual(counter(el), "5 / 33");
  assert.strictEqual(press("ArrowDown").defaultPrevented, false, "outside the list ArrowDown scrolls the page");
  // A select or a text field keeps its own keys.
  const select = q(el, ".classics-speed");
  assert.strictEqual(press("ArrowRight", select).defaultPrevented, false);
  assert.strictEqual(counter(el), "5 / 33");
  // Space on a button is that button's click, not play / pause.
  assert.strictEqual(press(" ", one(el, byAction("next"))).defaultPrevented, false);
  // A key from another part of the page (a dialog) is ignored.
  const outside = el.ownerDocument.createElement("button");
  el.ownerDocument.body.appendChild(outside);
  press("ArrowRight", outside);
  assert.strictEqual(counter(el), "5 / 33");
  // After leaving the screen nothing answers.
  Ludus.router.show("home");
  const before = (doc.listeners.get("keydown") || []).length;
  assert.strictEqual(before, 0, "the listener is removed with the page");
});

test("auto play: moves on the timer, waits the reading time on a note, pauses when stepped by hand, stops on hide", async () => {
  const { Ludus, el, advance } = createEnv();
  const screen = Ludus.Screens.classics;
  screen.mount(el);
  Ludus.router.show("classics", { game: "opera-1858" });
  await flush();
  const replay = () => screen._state.detail.replay.state();
  one(el, byAction("play")).click();
  assert.strictEqual(replay().playing, true);
  assert.strictEqual(one(el, byAction("play")).getAttribute("aria-pressed"), "true");
  advance(1300);
  assert.strictEqual(replay().index, 0, "not before the pace has passed");
  advance(200);
  assert.strictEqual(replay().index, 1);
  advance(1400);
  assert.strictEqual(replay().index, 2);
  assert.strictEqual(one(el, byAction("play")).getAttribute("aria-pressed"), "true");
  // Faster.
  const speed = q(el, ".classics-speed");
  speed.value = "fast";
  speed.dispatch("change");
  advance(750);
  assert.strictEqual(replay().index, 3);
  // Stepping by hand stops it.
  one(el, byAction("next")).click();
  assert.strictEqual(replay().playing, false);
  advance(5000);
  assert.strictEqual(replay().index, 4, "nothing moves on its own after a manual step");
  // A moment with a note holds for its reading time (at least 6 s), whatever the speed.
  const record = Ludus.Classics.get("opera-1858");
  const moment = record.positions.find((p) => p.note);
  const slider = q(el, ".classics-scrub-input");
  slider.value = String(moment.ply);
  slider.dispatch("input");
  one(el, byAction("play")).click();
  advance(800);
  assert.strictEqual(replay().index, moment.ply + 1, "one step to the note");
  advance(5500);
  assert.strictEqual(replay().index, moment.ply + 1, "the note is being read");
  advance(1800);
  assert.strictEqual(replay().index, moment.ply + 2, "on to the next move once its reading time (7.2 s for 17 words) has passed");
  // Leaving the screen stops the timer and drops the board.
  assert.strictEqual(replay().playing, true);
  Ludus.router.show("home");
  assert.strictEqual(screen._state.detail, null);
  advance(20000);
  assert.strictEqual(screen._state.detail, null);
  // Playing to the end stops by itself.
  Ludus.router.show("classics", { game: "reti-tartakower-1910" });
  await flush();
  const rs = () => screen._state.detail.replay.state();
  q(el, ".classics-speed").value = "fast";
  q(el, ".classics-speed").dispatch("change");
  one(el, byAction("last")).click();
  one(el, byAction("first")).click();
  one(el, byAction("play")).click();
  for (let i = 0; i < 40 && rs().playing; i += 1) advance(9000);
  assert.strictEqual(rs().index, rs().total);
  assert.strictEqual(rs().playing, false);
  assert.strictEqual(one(el, byAction("play")).getAttribute("aria-pressed"), "false");
});

test("training: count, hints and shuffle reach Ludus.game.startSession; the header, card and cue buttons agree", async () => {
  const { Ludus, el, calls } = createEnv();
  Ludus.Screens.classics.mount(el);
  Ludus.router.show("classics", { game: "opera-1858" });
  await flush();
  const start = one(el, byFkey("train-start"));
  assert.strictEqual(text(start), "Entrenar 6 posiciones", "a six-position game is played whole by default");
  const counts = q(el, ".classics-train-counts");
  deepEq(findAll(counts, (n) => n.tagName === "BUTTON").map((b) => text(b)), ["5", "Todas (6)"]);
  q(counts, 'button[data-value="5"]').click();
  assert.strictEqual(text(start), "Entrenar 5 posiciones");
  assert.strictEqual(one(el, byFkey("head-train")).getAttribute("aria-label"), "Entrenar 5 posiciones");
  const hints = q(el, "#classics-train-hints");
  assert.strictEqual(hints.checked, true, "hints follow the setting (on by default)");
  hints.checked = false;
  hints.dispatch("change");
  start.click();
  await flush();
  assert.strictEqual(calls.sessions.length, 1);
  let spec = calls.sessions[0];
  assert.strictEqual(spec.kind, "classic");
  assert.strictEqual(spec.title, "La Ópera");
  assert.strictEqual(spec.positions.length, 5);
  assert.ok(spec.positions.every((p) => p.classic.gameId === "opera-1858"));
  deepEq(JSON.parse(JSON.stringify(spec.options)), { hints: false });
  deepEq(spec.positions.map((p) => p.classic.ply), spec.positions.map((p) => p.classic.ply).slice().sort((a, b) => a - b), "in the order of the game");
  // The header button uses the same choices.
  one(el, byFkey("head-train")).click();
  await flush();
  spec = calls.sessions[1];
  assert.strictEqual(spec.positions.length, 5);
  assert.strictEqual(spec.options.hints, false);
  // Whole game, shuffled.
  q(counts, 'button[data-value="6"]').click();
  const shuffle = q(el, "#classics-train-shuffle");
  shuffle.checked = true;
  shuffle.dispatch("change");
  start.click();
  await flush();
  spec = calls.sessions[2];
  assert.strictEqual(spec.positions.length, 6);
  assert.strictEqual(new Set(spec.positions.map((p) => p.id)).size, 6);
  // A card's quick button trains five positions with the hints setting.
  Ludus.router.show("classics");
  await flush();
  findAll(one(el, (n) => n.getAttribute("data-game") === "immortal-1851"), byClass("classics-card-train"))[0].click();
  await flush();
  spec = calls.sessions[3];
  assert.strictEqual(spec.positions.length, 5);
  assert.ok(spec.positions.every((p) => p.classic.gameId === "immortal-1851"));
  assert.strictEqual(spec.title, "La Inmortal");
  assert.strictEqual(spec.options.hints, true);
});

test("training: a failing session shows a toast, a missing game core says so; buttons are never left busy", async () => {
  const { Ludus, el, calls } = createEnv();
  Ludus.Screens.classics.mount(el);
  Ludus.router.show("classics", { game: "opera-1858" });
  await flush();
  Ludus.game.startSession = async () => { throw new Error("boom"); };
  const toasts = [];
  Ludus.ui.toast = (message, options) => { toasts.push({ message, kind: options && options.kind }); };
  const originalError = console.error;
  console.error = () => {};
  const start = one(el, byFkey("train-start"));
  start.click();
  await flush();
  console.error = originalError;
  deepEq(toasts.map((t) => t.kind), ["error"]);
  assert.ok(!start.hasAttribute("aria-busy"), "not busy after a failure");
  delete Ludus.game.startSession;
  start.click();
  await flush();
  assert.strictEqual(toasts[1].kind, "warn");
  assert.strictEqual(calls.sessions.length, 0);
});

test("language: the gallery and the game page re-render in place (filters and position kept)", async () => {
  const { Ludus, el } = createEnv({ language: "es" });
  Ludus.Screens.classics.mount(el);
  Ludus.router.show("classics");
  await flush();
  const search = q(el, "#classics-search");
  search.value = "morphy";
  search.dispatch("input");
  search.dispatch("keydown", { key: "Enter" });
  Ludus.i18n.setLanguage("en", { persist: false });
  assert.ok(text(q(el, ".classics-title")).includes("Classic games"));
  assert.strictEqual(q(el, "#classics-search").value, "morphy", "the filter survives a language switch");
  deepEq(cardIds(el), ["paulsen-morphy-1857", "opera-1858"]);
  assert.strictEqual(text(q(el, ".classics-count")), "2 of 28 games");
  assert.ok(text(one(el, (n) => n.getAttribute("data-game") === "opera-1858")).includes("The Opera Game"));
  assert.ok(text(one(el, (n) => n.getAttribute("data-game") === "opera-1858")).includes("Philidor Defence") || text(one(el, (n) => n.getAttribute("data-game") === "opera-1858")).toLowerCase().includes("philidor defence"));
  Ludus.router.show("classics", { game: "opera-1858" });
  await flush();
  assert.ok(text(q(el, ".classics-train-how")).startsWith("You play White"));
  assert.ok(text(q(el, ".classics-detail-where")).includes("Casual game") && text(q(el, ".classics-detail-where")).includes("Paris"));
  Ludus.i18n.setLanguage("es", { persist: false });
  assert.ok(text(q(el, ".classics-detail-where")).includes("Partida amistosa"));
});

test("loading: a failing load shows an error with a retry (never a blank screen); retry loads it", async () => {
  const { Ludus, el } = createEnv();
  // load() rejects once (offline), then works.
  const realLoad = Ludus.Classics.load;
  let attempts = 0;
  Ludus.Classics.load = () => {
    attempts += 1;
    return attempts === 1 ? Promise.reject(new Error("offline")) : realLoad();
  };
  const originalError = console.error;
  console.error = () => {};
  Ludus.Screens.classics.mount(el);
  Ludus.router.show("classics");
  await flush();
  console.error = originalError;
  assert.strictEqual(cardIds(el).length, 0);
  assert.ok(text(el).includes("No pudimos cargar las partidas") && text(el).includes("Revisá tu conexión"));
  const retry = one(el, (n) => n.tagName === "BUTTON" && text(n).includes("Reintentar"));
  assert.ok(retry, "there is a retry button");
  retry.click();
  await flush();
  assert.strictEqual(cardIds(el).length, 28, "the retry loads the gallery");
  assert.strictEqual(attempts, 2);
});

test("degrading: no Ludus.Classics, no Ludus.game, no Ludus.ui: the screen still draws something and never throws", async () => {
  const noClassics = createEnv();
  delete noClassics.Ludus.Classics;
  const originalError = console.error;
  console.error = () => {};
  noClassics.Ludus.Screens.classics.mount(noClassics.el);
  noClassics.Ludus.router.show("classics");
  await flush();
  console.error = originalError;
  assert.ok(text(noClassics.el).includes("No pudimos cargar"), "an error state instead of a blank");

  const noUi = createEnv();
  delete noUi.Ludus.ui;
  noUi.Ludus.Screens.classics.mount(noUi.el);
  noUi.Ludus.router.show("classics");
  await flush();
  assert.strictEqual(cardIds(noUi.el).length, 28, "cards without mini boards or icons");
  assert.strictEqual(findAll(noUi.el, byClass("mini-board")).length, 0);
  noUi.Ludus.router.show("classics", { game: "opera-1858" });
  await flush();
  assert.strictEqual(counter(noUi.el), "0 / 33");
  one(noUi.el, byAction("next")).click();
  assert.strictEqual(counter(noUi.el), "1 / 33");
});

test("without chess.js or Ludus.Board: the replay falls back to the mini board; without the story the game can still be trained", async () => {
  const fallback = createEnv();
  fallback.Ludus.Screens.classics.mount(fallback.el);
  fallback.Ludus.router.show("classics", { game: "opera-1858" });
  await flush();
  const stage = q(fallback.el, ".classics-stage");
  const boards = findAll(stage, (n) => n.tagName.toLowerCase() === "svg" && n.classList.contains("mini-board"));
  assert.strictEqual(boards.length, 1, "Ludus.Board is not loaded here: a mini board is drawn");
  one(fallback.el, byAction("next")).click();
  assert.strictEqual(findAll(stage, (n) => n.tagName.toLowerCase() === "svg" && n.classList.contains("mini-board")).length, 1, "and replaced, not stacked");
  assert.ok(findAll(stage, (n) => n.classList.contains("mb-hl")).length >= 2, "the last move is highlighted");

  const noStory = createEnv();
  noStory.Ludus.Classics.story = () => { throw new Error("no chess"); };
  const originalError = console.error;
  console.error = () => {};
  noStory.Ludus.Screens.classics.mount(noStory.el);
  noStory.Ludus.router.show("classics", { game: "opera-1858" });
  await flush();
  console.error = originalError;
  assert.strictEqual(findAll(noStory.el, byClass("classics-replay")).length, 0);
  assert.ok(text(q(noStory.el, ".classics-replay-missing")).includes("no está disponible"));
  one(noStory.el, byFkey("train-start")).click();
  await flush();
  assert.strictEqual(noStory.calls.sessions.length, 1, "training does not need the replay");
});

test("with Ludus.Board: the replay board has 64 squares, the last move, the check, no focusable squares", async () => {
  const env = createEnv({ withBoard: true });
  const { Ludus, el } = env;
  Ludus.Screens.classics.mount(el);
  Ludus.router.show("classics", { game: "opera-1858" });
  await flush();
  const board = q(el, ".classics-board");
  assert.ok(board, "the board of Ludus.Board");
  assert.strictEqual(findAll(board, byClass("square")).length, 64);
  assert.strictEqual(board.getAttribute("aria-hidden"), "true");
  assert.strictEqual(findAll(board, (n) => n.classList.contains("bd-piece")).length, 32);
  assert.strictEqual(findAll(board, (n) => n.hasAttribute("tabindex")).length, 0, "no square is focusable");
  assert.strictEqual(findAll(el, (n) => n.tagName.toLowerCase() === "svg" && n.classList.contains("mini-board")).length, 0, "no fallback board");
  one(el, byAction("next")).click();
  const last = findAll(board, (n) => n.classList.contains("bd-last")).map((n) => n.dataset.square).sort();
  assert.deepStrictEqual(last, ["e2", "e4"]);
  one(el, byAction("last")).click();
  assert.ok(findAll(board, (n) => n.classList.contains("bd-check")).length === 1, "the mated king glows");
  assert.strictEqual(findAll(board, (n) => n.classList.contains("bd-check"))[0].dataset.square, "e8");
  assert.strictEqual(findAll(board, (n) => n.hasAttribute("tabindex")).length, 0, "still no focusable square after more renders");
  // Flip rebuilds the squares with Black at the bottom.
  one(el, byAction("flip")).click();
  assert.strictEqual(board.getAttribute("data-orientation"), "b");
  assert.strictEqual(findAll(board, byClass("square")).length, 64);
  assert.strictEqual(findAll(board, (n) => n.classList.contains("bd-check")).length, 1, "the position is kept");
  // Leaving destroys the view: no board is left behind.
  Ludus.router.show("home");
  assert.strictEqual(findAll(el, byClass("classics-board")).length, 0);
});

test("hashchange and cold start: #/classics/<id> is followed, a running session is not interrupted", async () => {
  const env = createEnv();
  const { Ludus, el, location } = env;
  location.hash = "#/classics/opera-1858";
  Ludus.Screens.classics.mount(el);
  // The cold start navigates on a timer (the boot code replaces the hash first).
  location.hash = "";
  env.advance(5);
  await flush();
  assert.strictEqual(Ludus.router.current(), "classics");
  assert.strictEqual(Ludus.Screens.classics._state.gameId, "opera-1858");
  // hashchange to another game, then to the plain screen.
  location.hash = "#/classics/immortal-1851";
  env.fire("hashchange");
  await flush();
  assert.strictEqual(Ludus.Screens.classics._state.gameId, "immortal-1851");
  location.hash = "#/classics";
  env.fire("hashchange");
  assert.strictEqual(Ludus.Screens.classics._state.view, "list");
  // Another hash while a session is running is ignored.
  Ludus.router.show("home");
  env.setActive(true);
  location.hash = "#/classics/immortal-1851";
  env.fire("hashchange");
  assert.strictEqual(Ludus.router.current(), "home");
  env.setActive(false);
  env.fire("hashchange");
  assert.strictEqual(Ludus.router.current(), "classics");
  // Nothing follows once the screen is destroyed.
  Ludus.Screens.classics.destroy();
  Ludus.router.show("home");
  env.fire("hashchange");
  assert.strictEqual(Ludus.router.current(), "home");
});

runAll().then(() => {
  console.log(`classics-ui: ${passed} tests passed`);
}).catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
