// Tests for the progress screen (js/ui/progress.js) against the real Profile, Scoring, Insights, Concepts and
// notebook screen and the fake DOM of _uidom.js.
//
// Covers: text parity es / en; the pure helpers (number and time formatting, level and streak, the heatmap
// grid across DST changes and the turn of the year with an injected clock, chart scale maths, the trend
// sessions, the stacked quality bar, the rows of the breakdowns, what data is still missing, the achievements
// list and its filters); and the screen: the honest empty state, partial data (what is missing and how to get
// it), a full dashboard against Profile.stats (level, streak, numbers, heatmap, trend with focusable points and
// a tooltip, phases, origins, qualities, weak themes with their links, achievements, recent sessions), the
// profile switcher (it looks at another profile without changing the active one), the streak at risk, the
// language switch and the degradation without its modules. Nothing on the screen is invented: every number
// is compared with what Profile reports.

"use strict";

// A time zone with daylight saving time, set before any Date is used.
process.env.TZ = "Europe/Madrid";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { FakeDocument, findAll } = require("./_uidom.js");
const { createFakeLocalStorage } = require("./_fakedom.js");

const repoRoot = path.resolve(__dirname, "..", "..");
const SCRIPTS = [
  "js/ludus.js", "js/chess.js", "js/scoring.js", "js/insights.js", "js/concepts.js", "js/profile.js", "js/ui/kit.js", "js/ui/notebook.js", "js/ui/progress.js",
];

const NOW = new Date(2026, 8, 30, 12, 0, 0).getTime();
const DAY = 86400000;
const at = (y, m, d, hh = 12, mm = 0) => new Date(y, m, d, hh, mm).getTime();

function createEnv({ language = "es", skip = [], now = NOW } = {}) {
  const doc = new FakeDocument();
  const storageMap = new Map();
  const clock = { now: 0, seq: 0, timers: new Map() };
  const winListeners = new Map();
  const sandbox = {
    console, Date, Math, JSON, Object, Array, String, Number, Promise, Map, Set, Intl, URL, structuredClone, WeakMap, WeakSet, performance: { now: () => clock.now },
    setTimeout(fn, ms) { clock.seq += 1; clock.timers.set(clock.seq, { at: clock.now + Number(ms || 0), fn }); return clock.seq; },
    clearTimeout(id) { clock.timers.delete(id); },
    document: doc,
    navigator: { languages: [language], language },
    localStorage: createFakeLocalStorage(storageMap),
    location: { hash: "", pathname: "/", search: "" },
    addEventListener(type, fn) { if (!winListeners.has(type)) winListeners.set(type, []); winListeners.get(type).push(fn); },
    removeEventListener(type, fn) { winListeners.set(type, (winListeners.get(type) || []).filter((entry) => entry !== fn)); },
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
  const el = mk("section", { id: "screen-progress", class: "screen hidden" });
  const home = mk("section", { id: "screen-home", class: "screen hidden" });
  const notebook = mk("section", { id: "screen-notebook", class: "screen hidden" });
  app.appendChild(el);
  app.appendChild(home);
  app.appendChild(notebook);
  Ludus.router.register("progress", { el, onShow: (params) => Ludus.Screens.progress.show(params), onHide: () => Ludus.Screens.progress.hide() });
  Ludus.router.register("home", { el: home });
  const shown = [];
  Ludus.router.register("notebook", { el: notebook, onShow: (params) => shown.push(params) });
  const env = { Ludus, doc, el, advance, now, storageMap, shown, fire: (type) => (winListeners.get(type) || []).slice().forEach((fn) => fn({ type })) };
  return env;
}

const text = (node) => node.textContent.replace(/\s+/g, " ").trim();
const q = (root, selector) => root.querySelector(selector);
const all = (root, selector) => root.querySelectorAll(selector);
const plain = (value) => JSON.parse(JSON.stringify(value));
const deepEq = (actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message);
const placeholders = (string) => Array.from(String(string).matchAll(/\{(\w+)\}/g), (m) => m[1]).sort().join(",");
const hidden = (node) => node.hasAttribute("hidden");

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

const FENS = [
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
  "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
  "8/5pk1/6p1/8/8/6P1/5PK1/8 w - - 0 40",
  "r2q1rk1/ppp2ppp/2np1n2/2b1p1B1/2B1P1b1/2NP1N2/PPP2PPP/R2Q1RK1 w - - 0 8",
  "r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R1BQ1RK1 w - - 0 9",
];

let roundSeq = 0;
function makeRound(env, overrides = {}) {
  roundSeq += 1;
  const fen = FENS[roundSeq % FENS.length];
  const { Chess, moveToUci, moveToSan } = env.Ludus.chess;
  const chess = new Chess(fen);
  const moves = chess.generateMoves();
  const user = moves[0];
  const accuracy = "accuracy" in overrides ? overrides.accuracy : 80;
  return Object.assign({
    id: `r_p${roundSeq}`,
    ts: NOW - 3600000,
    sessionId: "s_p1",
    sessionKind: "classic",
    source: "classic",
    fen,
    sideToMove: chess.turn,
    phase: "middlegame",
    userUci: moveToUci(user),
    userSan: moveToSan(chess, user),
    bestUci: moveToUci(moves[1]),
    bestSan: moveToSan(chess, moves[1]),
    points: accuracy / 10,
    accuracy,
    qualityCode: accuracy >= 90 ? "very_good" : accuracy >= 75 ? "good" : accuracy >= 55 ? "interesting" : accuracy >= 35 ? "dubious" : "bad",
    winLossPct: 100 - accuracy,
    cpLoss: 100 - accuracy,
    isBest: accuracy >= 96,
    rank: 2,
    onlyMove: false,
    timeSpentMs: 12000,
    hintsUsed: 0,
    timedOut: false,
    tags: [],
    lines: [],
    meta: {},
  }, overrides);
}

function record(env, rounds, profileId) {
  const Profile = env.Ludus.Profile;
  rounds.forEach((r) => {
    const result = Profile.recordRound(profileId ? Object.assign({ profileId }, r) : r);
    assert.ok(result && result.ok, `recordRound: ${Profile.lastError()}`);
  });
}

function session(env, overrides = {}) {
  const points = "points" in overrides ? overrides.points : 30;
  return env.Ludus.Profile.recordSession(Object.assign({
    id: `s_p${Math.random().toString(36).slice(2, 9)}`,
    ts: NOW - 3600000,
    kind: "classic",
    title: "Partidas clásicas",
    mode: "solo",
    positions: 5,
    points,
    maxPoints: 50,
    avgAccuracy: 60,
    durationMs: 245000,
    byQuality: { good: 3, dubious: 2 },
    roundIds: [],
  }, overrides));
}

// A learner with n rounds spread over `days` days (newest today), sessions of 5 rounds.
function fullLearner(env, { days = 30, perDay = 4, tags = true } = {}) {
  const Profile = env.Ludus.Profile;
  Profile.ensureActive();
  const rounds = [];
  const phases = ["opening", "middlegame", "endgame"];
  const sources = ["classic", "own", "notebook", "daily"];
  const qualityBands = [95, 80, 60, 40, 15];
  let n = 0;
  for (let d = days - 1; d >= 0; d -= 1) {
    for (let i = 0; i < perDay; i += 1) {
      n += 1;
      const accuracy = qualityBands[(n * 7) % qualityBands.length] + (d < 10 ? 5 : 0);
      rounds.push(makeRound(env, {
        ts: NOW - d * DAY - i * 60000,
        accuracy,
        phase: phases[n % 3],
        source: sources[n % 4],
        tags: tags ? (n % 3 === 0 ? ["hangs_piece"] : n % 3 === 1 ? ["fork_available"] : []) : [],
        sessionId: `s_day${d}`,
      }));
    }
  }
  record(env, rounds);
  for (let d = days - 1; d >= 0; d -= 1) {
    session(env, { id: `s_day${d}`, ts: NOW - d * DAY, avgAccuracy: 50 + ((days - d) % 9) * 4, points: 25 + (d % 5), title: d % 6 === 0 ? "Repaso del cuaderno" : "Partidas clásicas", kind: d % 6 === 0 ? "review" : "classic" });
  }
  return rounds;
}

function open(env, params) {
  env.Ludus.Screens.progress.mount(env.el);
  env.Ludus.router.show("progress", params);
  return env.el;
}

const pr = (env) => env.Ludus.Screens.progress;
const helpers = (env) => env.Ludus.Screens.progress.helpers;

// ---------- pure ----------

test("text: es and en have the same keys and placeholders, none empty; the title key resolves; rioplatense", () => {
  const env = createEnv();
  const { es, en } = pr(env).TEXT;
  deepEq(Object.keys(es).sort(), Object.keys(en).sort());
  Object.keys(es).forEach((key) => {
    assert.ok(es[key].length > 0 && en[key].length > 0, `${key} is empty`);
    assert.strictEqual(placeholders(es[key]), placeholders(en[key]), `${key}: placeholders differ`);
    assert.ok(key.startsWith("progress."));
  });
  assert.strictEqual(pr(env).titleKey, "progress.title");
  assert.strictEqual(env.Ludus.i18n.t("progress.title", null, "es"), "Progreso");
  assert.strictEqual(env.Ludus.i18n.t("progress.title", null, "en"), "Progress");
  assert.ok(es["progress.streak.risk"].includes("Entrená") && es["progress.gap.first.need"].includes("Jugá"), "voseo");
  ["progress.stat.positions.hint", "progress.streak.best", "progress.trend.lead", "progress.improve.up", "progress.bar.aria", "progress.bar.n", "progress.sessions.positions", "progress.activity.item"].forEach((key) => {
    assert.ok(`${key}.one` in es && `${key}.one` in en, `${key} has a singular`);
  });
});

test("formatting: numbers follow the language, practice time is data (s, min, h + min)", () => {
  const h = helpers(createEnv());
  assert.strictEqual(h.formatNumber(1408, 0, "es"), "1.408");
  assert.strictEqual(h.formatNumber(1408, 0, "en"), "1,408");
  assert.strictEqual(h.formatNumber(66.54, 1, "es"), "66,5");
  assert.strictEqual(h.formatNumber(66.54, 1, "en"), "66.5");
  assert.strictEqual(h.formatNumber(50, 1, "es"), "50", "no trailing zero");
  assert.strictEqual(h.formatNumber(NaN, 1, "es"), "");
  assert.strictEqual(h.formatNumber(null, 1, "es"), "", "null is not a number here");
  deepEq(h.splitDuration(0), { kind: "s", h: 0, m: 0, s: 0 });
  deepEq(h.splitDuration(59400), { kind: "s", h: 0, m: 0, s: 59 });
  deepEq(h.splitDuration(60000), { kind: "m", h: 0, m: 1, s: 0 });
  deepEq(h.splitDuration(29 * 60000 + 31000), { kind: "m", h: 0, m: 30, s: 0 }, "rounds to the minute");
  deepEq(h.splitDuration(3600000), { kind: "hm", h: 1, m: 0, s: 0 });
  deepEq(h.splitDuration(91 * 60000), { kind: "hm", h: 1, m: 31, s: 0 });
  deepEq(h.splitDuration(NaN), { kind: "s", h: 0, m: 0, s: 0 });
  deepEq(h.splitDuration(-5), { kind: "s", h: 0, m: 0, s: 0 });
});

test("level and streak: the XP bar in numbers, the three states of the streak", () => {
  const env = createEnv();
  const h = helpers(env);
  const level = env.Ludus.Profile.levelFor(450);
  const info = h.xpInfo(level);
  assert.strictEqual(info.into, 150);
  assert.strictEqual(info.span, 400);
  assert.strictEqual(info.toNext, 250);
  assert.strictEqual(info.ratio, 0.375);
  assert.strictEqual(info.max, false);
  const top = h.xpInfo(env.Ludus.Profile.levelFor(200000));
  assert.strictEqual(top.max, true);
  assert.strictEqual(top.ratio, 1);
  assert.strictEqual(top.toNext, 0);
  assert.strictEqual(h.xpInfo(null).ratio, 0);
  deepEq(h.streakInfo({ streak: { current: 4, best: 9, activeToday: true, atRisk: false } }), { current: 4, best: 9, state: "today" });
  deepEq(h.streakInfo({ streak: { current: 4, best: 9, activeToday: false, atRisk: true } }), { current: 4, best: 9, state: "risk" });
  deepEq(h.streakInfo({ streak: { current: 0, best: 9, activeToday: false, atRisk: false } }), { current: 0, best: 9, state: "none" });
  deepEq(h.streakInfo(null), { current: 0, best: 0, state: "none" });
});

test("heatmap levels and daily counts: five levels, local days (a late night is still that day)", () => {
  const h = helpers(createEnv());
  deepEq([0, 1, 2, 3, 5, 6, 9, 10, 40].map(h.heatLevel), [0, 1, 1, 2, 2, 3, 3, 4, 4]);
  assert.strictEqual(h.heatLevel(-3), 0);
  assert.strictEqual(h.heatLevel("x"), 0);
  const counts = h.activityCounts([
    { ts: at(2026, 8, 30, 23, 59) }, { ts: at(2026, 8, 30, 0, 1) }, { ts: at(2026, 9, 1, 0, 30) }, { ts: at(2026, 2, 29, 1, 30) }, { ts: "x" }, null,
  ]);
  deepEq(counts, { "2026-09-30": 2, "2026-10-01": 1, "2026-03-29": 1 });
  assert.strictEqual(h.dateKeyOf(at(2027, 0, 1, 0, 0)), "2027-01-01");
});

test("heatmap grid: 12 weeks of 7 days ending with today, Monday or Sunday first, nothing in the future", () => {
  const h = helpers(createEnv());
  const grid = h.heatmapGrid({ now: NOW, weeks: 12, counts: { "2026-09-30": 3, "2026-09-29": 12, "2026-07-14": 1, "2026-10-01": 99 }, weekStart: 1 });
  assert.strictEqual(grid.columns.length, 12);
  assert.ok(grid.columns.every((column) => column.length === 7));
  // 30 September 2026 is a Wednesday: the last column has Monday..Wednesday up to today, then the future.
  const last = grid.columns[11];
  deepEq(last.map((cell) => cell.key), ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
  deepEq(last.map((cell) => cell.future), [false, false, false, true, true, true, true]);
  assert.strictEqual(last[2].today, true);
  assert.strictEqual(last[3].count, 0, "a future day never counts, even when the data says so");
  assert.strictEqual(last[2].count, 3);
  assert.strictEqual(last[1].level, 4);
  assert.strictEqual(grid.columns[0][0].key, "2026-07-13", "11 weeks before the last Monday");
  assert.strictEqual(grid.startKey, "2026-07-13");
  assert.strictEqual(grid.endKey, "2026-09-30");
  assert.strictEqual(grid.days, 11 * 7 + 3);
  assert.strictEqual(grid.positions, 3 + 12 + 1);
  assert.strictEqual(grid.activeDays, 3);
  deepEq(grid.best, { key: "2026-09-29", ts: at(2026, 8, 29, 0, 0), count: 12 });
  deepEq(grid.months.map((m) => m.month), [6, 7, 8], "July, August, September: a label where the month changes");
  const sunday = h.heatmapGrid({ now: NOW, weeks: 12, counts: {}, weekStart: 0 });
  assert.strictEqual(sunday.columns[11][0].key, "2026-09-27", "Sunday first");
  assert.strictEqual(sunday.columns[0][0].key, "2026-07-12");
  deepEq(h.weekdayOrder(1), [1, 2, 3, 4, 5, 6, 0]);
  deepEq(h.weekdayOrder(0), [0, 1, 2, 3, 4, 5, 6]);
  const empty = h.heatmapGrid({ now: NOW, counts: null });
  assert.strictEqual(empty.positions, 0);
  assert.strictEqual(empty.best, null);
  assert.strictEqual(h.heatmapGrid({ now: NOW, weeks: 99 }).columns.length, 53, "at most a year");
});

test("heatmap grid: every day appears once, in order, across DST changes and the turn of the year", () => {
  const h = helpers(createEnv());
  const nows = [
    at(2026, 2, 29, 12), // the day Europe/Madrid springs forward (23 hours)
    at(2026, 2, 30, 0, 30), // just after
    at(2026, 9, 25, 12), // the day it falls back (25 hours)
    at(2026, 9, 26, 23, 59),
    at(2026, 0, 3, 12), // first days of the year: the grid reaches into the last year
    at(2026, 11, 31, 23, 59),
    at(2024, 1, 29, 12), // a leap day
  ];
  nows.forEach((now) => {
    const grid = h.heatmapGrid({ now, weeks: 12, counts: {}, weekStart: 1 });
    const keys = grid.columns.reduce((list, column) => list.concat(column.map((cell) => cell.key)), []);
    assert.strictEqual(keys.length, 84);
    assert.strictEqual(new Set(keys).size, 84, `no repeated day for ${new Date(now).toString()}`);
    keys.reduce((prev, key) => {
      if (prev) {
        const expected = new Date(Number(prev.slice(0, 4)), Number(prev.slice(5, 7)) - 1, Number(prev.slice(8, 10)) + 1);
        assert.strictEqual(key, h.dateKeyOf(expected.getTime()), `${prev} is followed by ${key}`);
      }
      return key;
    }, null);
    assert.strictEqual(grid.columns[0][0].ts <= grid.columns[11][6].ts, true);
    assert.ok(grid.columns.flat().filter((cell) => cell.today).length === 1, "exactly one today");
    grid.columns.forEach((column) => column.forEach((cell) => assert.strictEqual(new Date(cell.ts).getHours(), 0, "every cell is a local midnight")));
    assert.strictEqual(grid.columns[0][0].ts === new Date(new Date(grid.columns[0][0].ts).getFullYear(), new Date(grid.columns[0][0].ts).getMonth(), new Date(grid.columns[0][0].ts).getDate()).getTime(), true);
  });
  const year = h.heatmapGrid({ now: at(2026, 0, 3, 12), weeks: 12, counts: { "2025-12-31": 2, "2026-01-01": 1 }, weekStart: 1 });
  assert.strictEqual(year.activeDays, 2, "activity on both sides of New Year");
  assert.ok(year.months.some((m) => m.month === 11) && year.months.some((m) => m.month === 0));
});

test("chart scale: a y axis in whole steps inside 0..100, points inside the plot, one point centred, no NaN", () => {
  const h = helpers(createEnv());
  const domain = h.niceDomain([52, 68, 71]);
  assert.strictEqual(domain.min, 40);
  assert.strictEqual(domain.max, 80);
  deepEq(domain.ticks, [40, 50, 60, 70, 80]);
  const wide = h.niceDomain([5, 96]);
  assert.strictEqual(wide.step, 20);
  deepEq([wide.min, wide.max], [0, 100]);
  const flat = h.niceDomain([60, 60, 60]);
  assert.ok(flat.max - flat.min >= 2 * flat.step, "a flat series still gets a readable axis");
  assert.ok(flat.min <= 60 && flat.max >= 60);
  const top = h.niceDomain([98, 100]);
  assert.strictEqual(top.max, 100);
  assert.ok(top.min >= 0 && top.max - top.min >= 2 * top.step);
  deepEq(h.niceDomain([]), { min: 0, max: 100, step: 20, ticks: [0, 20, 40, 60, 80, 100] });
  deepEq(h.niceDomain([NaN, "x"]).ticks, [0, 20, 40, 60, 80, 100]);
  const scale = h.scaleLinear(0, 100, 200, 0);
  assert.strictEqual(scale(0), 200);
  assert.strictEqual(scale(100), 0);
  assert.strictEqual(scale(25), 150);
  assert.strictEqual(h.scaleLinear(5, 5, 0, 10)(5), 5, "a zero span does not divide by zero");

  const geo = h.trendGeometry([50, 62, 58, 80], { width: 640, height: 240 });
  assert.strictEqual(geo.points.length, 4);
  geo.points.forEach((p) => {
    assert.ok(p.x >= geo.plot.x0 && p.x <= geo.plot.x1 && p.y >= geo.plot.y0 && p.y <= geo.plot.y1, `point ${JSON.stringify(p)} inside the plot`);
  });
  assert.strictEqual(geo.points[0].x, geo.plot.x0);
  assert.strictEqual(geo.points[3].x, geo.plot.x1);
  assert.ok(geo.points[3].y < geo.points[0].y, "a higher value is drawn higher (smaller y)");
  assert.ok(geo.linePath.startsWith("M") && !geo.linePath.includes("NaN"));
  assert.ok(geo.areaPath.endsWith("Z") && geo.areaPath.includes(`${geo.plot.y1}`), "the area closes on the baseline");
  assert.strictEqual(geo.ticks.length, geo.domain.ticks.length);
  assert.ok(geo.ticks[0].y > geo.ticks[geo.ticks.length - 1].y, "the lowest tick is at the bottom");
  const one = h.trendGeometry([70], {});
  assert.strictEqual(one.points[0].x, (one.plot.x0 + one.plot.x1) / 2, "one point sits in the middle");
  assert.strictEqual(one.linePath, "");
  assert.strictEqual(one.areaPath, "");
  const none = h.trendGeometry([], {});
  assert.deepStrictEqual(plain(none.points), []);
  assert.ok(!JSON.stringify(none).includes("NaN"));
  const clamped = h.trendGeometry([120, -10], {});
  assert.ok(clamped.points.every((p) => p.y >= clamped.plot.y0 && p.y <= clamped.plot.y1), "values are clamped into the axis");
});

test("trend sessions: the last 20 that are not duels, oldest first", () => {
  const h = helpers(createEnv());
  const newestFirst = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, mode: i % 7 === 3 ? "duel" : "solo", avgAccuracy: 50 + i }));
  const out = h.trendSessions(newestFirst, 20);
  assert.strictEqual(out.length, 20);
  assert.ok(out.every((s) => s.mode !== "duel"));
  assert.ok(out[0].id > out[19].id === false || Number(out[0].id.slice(1)) > Number(out[19].id.slice(1)), "reversed to oldest first");
  assert.strictEqual(out[19].id, "s0", "the newest session is last");
  assert.strictEqual(h.trendSessions([{ mode: "duel", avgAccuracy: 50 }], 20).length, 0);
  assert.strictEqual(h.trendSessions(null).length, 0);
  assert.strictEqual(h.trendSessions([{ avgAccuracy: "x" }]).length, 0);
});

test("stacked quality bar: quality order, a fixed 2 unit gap, a visible minimum, widths that add up", () => {
  const h = helpers(createEnv());
  const counts = { blunder: 5, perfect: 40, good: 30, dubious: 2, bad: 0, no_move: 1 };
  const { total, segments } = h.stackSegments(counts, 320, { gap: 2, minWidth: 4 });
  assert.strictEqual(total, 78);
  deepEq(segments.map((s) => s.code), ["perfect", "good", "dubious", "blunder", "no_move"], "best to worst, empty ones left out");
  segments.forEach((s, i) => {
    if (i > 0) assert.ok(Math.abs(s.x - (segments[i - 1].x + segments[i - 1].w + 2)) < 0.02, "a 2 unit gap between neighbours");
    assert.ok(s.w >= 3.99, `${s.code} is at least 4 wide`);
  });
  const last = segments[segments.length - 1];
  assert.ok(Math.abs(last.x + last.w - 320) < 0.05, "the bar spans the whole width");
  assert.ok(Math.abs(segments.reduce((sum, s) => sum + s.pct, 0) - 100) < 0.6, "shares add up to 100");
  assert.strictEqual(segments[0].pct, 51.3);
  deepEq(h.stackSegments({}, 320), { total: 0, segments: [] });
  deepEq(h.stackSegments(null, 320), { total: 0, segments: [] });
  const many = h.stackSegments({ perfect: 1000, good: 1, dubious: 1, bad: 1, blunder: 1 }, 100);
  assert.ok(Math.abs(many.segments[4].x + many.segments[4].w - 100) < 0.05, "tiny segments do not push the bar past its width");
  assert.ok(many.segments.every((s) => s.w >= 3.99));
  const single = h.stackSegments({ good: 9 }, 320);
  assert.strictEqual(single.segments.length, 1);
  assert.strictEqual(single.segments[0].w, 320);
});

test("rows of the breakdowns: phase and origin with their sample size; a small sample is flagged, none is empty", () => {
  const h = helpers(createEnv());
  const stats = {
    byPhase: { opening: { count: 40, accuracy: 71.2 }, middlegame: { count: 3, accuracy: 80 }, endgame: { count: 0, accuracy: null } },
    bySource: { own: { count: 10, accuracy: 55 }, classic: { count: 0, accuracy: null }, notebook: { count: 5, accuracy: 66 } },
  };
  const phases = h.phaseRows(stats, 5);
  deepEq(phases.map((r) => r.key), ["opening", "middlegame", "endgame"]);
  deepEq(phases.map((r) => [r.small, r.empty]), [[false, false], [true, false], [false, true]]);
  const sources = h.sourceRows(stats, 5);
  deepEq(sources.map((r) => r.key), ["own", "classic", "notebook", "daily"], "the four origins, even the ones without data");
  assert.strictEqual(sources[3].empty, true);
  assert.strictEqual(sources[2].small, false, "5 is enough");
  assert.strictEqual(h.phaseRows(null, 5).every((r) => r.empty), true);
  assert.strictEqual(h.bestTagSample({ byTag: [{ count: 3 }, { count: 9 }] }), 9);
  assert.strictEqual(h.bestTagSample({}), 0);
});

test("what is missing: each chart's requirement with how much there is", () => {
  const h = helpers(createEnv());
  const gaps = (stats, sessions) => Object.fromEntries(h.dataGaps(stats, sessions).map((g) => [g.id, g]));
  const none = gaps({ totalPositions: 0, windowPositions: 0, byTag: [] }, 0);
  assert.strictEqual(none.first.done, false);
  deepEq([none.trend.need, none.improve.need, none.weak.need], [2, 20, 5]);
  const some = gaps({ totalPositions: 12, windowPositions: 12, byTag: [{ count: 4 }] }, 1);
  assert.strictEqual(some.first.done, true);
  assert.strictEqual(some.trend.done, false);
  assert.strictEqual(some.trend.have, 1);
  assert.strictEqual(some.improve.have, 12);
  assert.strictEqual(some.weak.have, 4);
  const full = gaps({ totalPositions: 90, windowPositions: 90, byTag: [{ count: 7 }] }, 5);
  assert.ok(Object.values(full).every((g) => g.done));
});

test("achievements: unlocked first (newest first), then the closest to unlocking; filters; counts", () => {
  const env = createEnv();
  const h = helpers(env);
  const catalog = env.Ludus.Profile.achievements.catalog("es");
  assert.strictEqual(catalog.length, 24);
  const unlocked = [{ id: catalog[2].id, ts: 100 }, { id: catalog[5].id, ts: 300 }];
  const progress = {};
  catalog.forEach((entry, i) => { progress[entry.id] = { current: (i % 4) * 2, target: entry.target, unlocked: false }; });
  progress[catalog[2].id] = { current: catalog[2].target, target: catalog[2].target, unlocked: true };
  progress[catalog[5].id] = { current: catalog[5].target, target: catalog[5].target, unlocked: true };
  const rows = h.achievementRows(catalog, unlocked, progress, "all");
  assert.strictEqual(rows.length, 24);
  deepEq(rows.slice(0, 2).map((r) => r.id), [catalog[5].id, catalog[2].id], "newest unlock first");
  assert.ok(rows.slice(2).every((r) => !r.unlocked));
  const ratios = rows.slice(2).map((r) => r.ratio);
  deepEq(ratios, ratios.slice().sort((a, b) => b - a), "the closest to unlocking first");
  assert.strictEqual(h.achievementRows(catalog, unlocked, progress, "done").length, 2);
  assert.strictEqual(h.achievementRows(catalog, unlocked, progress, "todo").length, 22);
  assert.strictEqual(h.achievementRows(catalog, unlocked, progress, "nonsense").length, 24);
  deepEq(h.achievementCounts(rows), { unlocked: 2, total: 24 });
  rows.forEach((r) => assert.ok(r.ratio >= 0 && r.ratio <= 1 && r.name && r.description));
  assert.strictEqual(rows.find((r) => r.id === catalog[2].id).ts, 100);
  assert.strictEqual(h.achievementRows(null, null, null, "all").length, 0);
  assert.strictEqual(h.achievementRows(catalog, [], {}, "todo").every((r) => r.current === 0), true, "no progress data: nothing is invented");
});

// ---------- the screen ----------

test("mount is idempotent and cheap: only the heading is drawn until show()", () => {
  const env = createEnv();
  let reads = 0;
  const stats = env.Ludus.Profile.stats;
  env.Ludus.Profile.stats = (...args) => { reads += 1; return stats(...args); };
  pr(env).mount(env.el);
  pr(env).mount(env.el);
  assert.ok(reads <= 1, `stats read ${reads} times while mounting`);
  assert.strictEqual(all(env.el, "h1").length, 1);
  assert.strictEqual(text(q(env.el, "h1")), "Tu progreso");
  assert.strictEqual(all(env.el, ".progress-root").length, 1);
  assert.strictEqual(q(env.el, "h1").hasAttribute("data-screen-title"), true);
  pr(env).mount(null);
});

test("no data at all: the level and the achievements, and an honest list of what appears with what it takes", () => {
  const env = createEnv();
  open(env);
  const el = env.el;
  assert.strictEqual(text(q(el, ".progress-level-title")), "Peón I");
  assert.ok(text(q(el, ".progress-level")).includes("Nivel 1 de 21"));
  assert.strictEqual(text(q(el, ".progress-streak-count")), "0");
  assert.ok(text(q(el, ".progress-streak-msg")).includes("Entrená hoy para empezar una racha"));
  assert.strictEqual(all(el, ".progress-heat-svg").length, 0, "no charts");
  assert.strictEqual(all(el, ".progress-trend-svg").length, 0);
  assert.strictEqual(all(el, ".progress-stats").length, 0, "no fabricated numbers");
  const gaps = all(el, ".progress-gap");
  assert.strictEqual(gaps.length, 5);
  assert.ok(text(gaps[2]).includes("Completá 2 sesiones (llevás 0)"), text(gaps[2]));
  assert.ok(text(gaps[3]).includes("Jugá 20 posiciones (llevás 0)"));
  assert.ok(text(gaps[4]).includes("Juntá 5 posiciones sobre el mismo tema"));
  assert.ok(all(el, "button").some((b) => text(b) === "Elegir cómo entrenar"));
  all(el, "button").find((b) => text(b) === "Elegir cómo entrenar").click();
  assert.strictEqual(env.Ludus.router.current(), "home");
  env.Ludus.router.show("progress");
  assert.strictEqual(all(el, ".progress-ach").length, 24, "the whole catalogue, all locked");
  assert.strictEqual(all(el, ".progress-ach.is-unlocked").length, 0);
  assert.ok(text(q(el, ".progress-ach-card")).includes("0 de 24 desbloqueados"));
  assert.strictEqual(all(el, ".progress-session").length, 0);
  assert.ok(!text(el).includes("Sesiones recientes"), "no empty list of sessions");
});

test("partial data: 3 rounds and 1 session say what is still missing, with numbers", () => {
  const env = createEnv();
  env.Ludus.Profile.ensureActive();
  record(env, [makeRound(env, { accuracy: 90, ts: NOW - 5000 }), makeRound(env, { accuracy: 40, ts: NOW - 4000 }), makeRound(env, { accuracy: 70, ts: NOW - 3000, phase: "endgame" })]);
  session(env, { avgAccuracy: 66.7, positions: 3, points: 20, maxPoints: 30 });
  open(env);
  const el = env.el;
  assert.strictEqual(all(el, ".progress-gap").length, 0, "there is data: no empty state");
  const stats = all(el, ".progress-stat").map((s) => text(s));
  assert.ok(stats[0].includes("3") && stats[0].includes("1 sesión"), stats[0]);
  assert.ok(stats[1].includes("66,7%"), stats[1]);
  assert.ok(text(q(el, ".progress-improve")).includes("hacen falta 20 posiciones") && text(q(el, ".progress-improve")).includes("Llevás 3"), text(q(el, ".progress-improve")));
  assert.strictEqual(all(el, ".progress-pt").length, 1, "one session, one point");
  assert.ok(text(q(el, ".progress-trend-card")).includes("Con una sesión ya hay un punto"));
  assert.strictEqual(all(el, ".progress-trend-svg .progress-line").length, 0, "no line from a single point");
  const bars = all(el, ".progress-bar-row");
  assert.strictEqual(bars.length, 7, "3 phases and 4 origins");
  assert.ok(bars.some((b) => text(b).includes("Sin datos todavía")), "an empty phase says so");
  assert.ok(bars.some((b) => text(b).includes("Pocos datos: 1 posición")), "a sample of 1 is called small");
  assert.ok(bars.every((b) => b.getAttribute("role") === null && q(b, '[role="img"]').getAttribute("aria-label")), "a list item holding a picture with its text alternative");
  assert.ok(text(q(el, ".progress-weak")).includes("Todavía no hay temas con datos suficientes"));
  assert.ok(text(q(el, ".progress-activity")).includes("3"), "today's positions on the calendar");
});

test("a full dashboard: every number is what Profile reports", () => {
  const env = createEnv();
  const rounds = fullLearner(env, { days: 30, perDay: 4 });
  const stats = env.Ludus.Profile.stats();
  open(env);
  const el = env.el;
  // level and XP
  assert.strictEqual(text(q(el, ".progress-level-title")), stats.level.title);
  assert.ok(text(q(el, ".progress-level")).includes(`Nivel ${stats.level.level} de 21`));
  const bar = q(el, ".progress-level .progress");
  assert.strictEqual(bar.getAttribute("role"), "progressbar");
  assert.strictEqual(Number(bar.getAttribute("aria-valuenow")), Math.round(stats.level.progress * 100));
  const xpText = text(q(el, ".progress-xp"));
  assert.ok(xpText.includes(`Faltan ${stats.level.xpToNext.toLocaleString("es-AR")} XP`), xpText);
  // streak
  assert.strictEqual(text(q(el, ".progress-streak-count")), String(stats.streak.current));
  assert.ok(text(q(el, ".progress-streak-best")).includes(String(stats.streak.best)));
  assert.strictEqual(stats.streak.activeToday, true);
  assert.ok(text(q(el, ".progress-streak-msg")).includes("Ya entrenaste hoy"));
  assert.strictEqual(all(el, ".progress-streak-msg.is-risk").length, 0);
  // numbers
  const tiles = all(el, ".progress-stat");
  assert.strictEqual(tiles.length, 4);
  assert.strictEqual(text(q(tiles[0], ".progress-stat-value")), String(stats.totalPositions));
  assert.strictEqual(text(q(tiles[1], ".progress-stat-value")), `${String(stats.overallAccuracy).replace(".", ",")}%`);
  assert.strictEqual(text(q(tiles[2], ".progress-stat-value")), String(Math.round(stats.avgPoints * 10) / 10).replace(".", ","), "points per position, one decimal");
  assert.ok(/^\d+ min$|^\d+ h( \d+ min)?$/.test(text(q(tiles[3], ".progress-stat-value"))), text(q(tiles[3], ".progress-stat-value")));
  assert.strictEqual(text(q(tiles[0], ".progress-stat-hint")), `${stats.sessions} sesiones`);
  // heatmap: the cells add up to the rounds of the 12 weeks
  const cells = all(el, ".progress-heat-cell");
  assert.strictEqual(cells.length, 11 * 7 + 3, "no cell for the future days");
  const total = cells.reduce((sum, c) => sum + Number(c.getAttribute("data-count")), 0);
  assert.strictEqual(total, rounds.length);
  assert.strictEqual(cells.filter((c) => c.classList.contains("is-today")).length, 1);
  assert.ok(cells.every((c) => q(c, "title") && text(q(c, "title")).length > 0), "every cell has a tooltip");
  assert.strictEqual(q(el, ".progress-heat-svg").getAttribute("role"), "img");
  assert.ok(q(el, ".progress-heat-svg").getAttribute("aria-label").includes(`${rounds.length} posiciones`));
  const list = all(q(el, ".progress-list-details"), "li");
  assert.strictEqual(list.length, 30, "the alternative: one line per active day");
  assert.ok(text(list[0]).includes("4 posiciones"));
  // phases, origins, qualities
  const bars = all(el, ".progress-bar-row");
  assert.strictEqual(bars.length, 7);
  ["opening", "middlegame", "endgame"].forEach((phase, i) => {
    assert.ok(text(bars[i]).includes(`${stats.byPhase[phase].accuracy}`.replace(".", ",")), `phase ${phase}`);
    assert.ok(text(bars[i]).includes(`${stats.byPhase[phase].count} posiciones`));
  });
  const legend = all(el, ".progress-legend-item");
  const legendTotal = legend.reduce((sum, item) => sum + Number(text(q(item, ".progress-legend-count")).split(" ")[0].replace(/\./g, "")), 0);
  assert.strictEqual(legendTotal, rounds.length, "the legend repeats every number of the stacked bar");
  assert.strictEqual(all(el, ".progress-stack-svg .progress-seg").length, legend.length);
  assert.ok(q(el, ".progress-stack-svg").getAttribute("aria-label").includes(`${rounds.length} jugadas`));
  // weak themes
  const weak = all(el, ".progress-weak-item");
  assert.strictEqual(weak.length, stats.weakestTags.length);
  assert.ok(weak.length >= 2);
  weak.forEach((item, i) => {
    assert.ok(text(q(item, ".progress-weak-meta")).includes(`${stats.weakestTags[i].count} posiciones`));
  });
  // sessions
  const sessions = all(el, ".progress-session");
  assert.strictEqual(sessions.length, 8, "the eight most recent");
  assert.ok(all(sessions[0], "dl div").length === 3);
  const noMore = env.Ludus.Profile.sessions(undefined, { limit: 1 })[0];
  assert.ok(text(sessions[0]).includes(noMore.title));
});

test("trend: one focusable point per session (one tab stop), arrow keys, a tooltip with the numbers, a table for screen readers", () => {
  const env = createEnv();
  fullLearner(env, { days: 30, perDay: 3 });
  open(env);
  const el = env.el;
  const points = all(el, ".progress-pt");
  assert.strictEqual(points.length, 20, "the last 20 sessions");
  assert.strictEqual(points.filter((p) => p.getAttribute("tabindex") === "0").length, 1, "roving tab stop");
  assert.strictEqual(points[19].getAttribute("tabindex"), "0", "the newest session by default");
  points.forEach((p, i) => {
    assert.strictEqual(p.getAttribute("role"), "img");
    assert.ok(/^Sesión \d+ de 20: [\d,]+% de precisión, /.test(p.getAttribute("aria-label")), p.getAttribute("aria-label"));
    assert.ok(p.getAttribute("aria-label").startsWith(`Sesión ${i + 1} de 20`));
  });
  // QA CNT-029: the accuracy shown is not Lichess's; it says so where the curve is drawn.
  assert.ok(text(q(el, ".progress-trend-card")).includes("más exigente que la de Lichess o Chess.com"));
  const tip = q(el, ".progress-tip");
  assert.strictEqual(hidden(tip), true);
  points[19].dispatch("focus");
  assert.strictEqual(hidden(tip), false, "focus shows the tooltip");
  const sessions = env.Ludus.Profile.sessions(undefined, { limit: 60 }).filter((s) => s.mode !== "duel").slice(0, 20).reverse();
  assert.ok(text(q(tip, ".progress-tip-value")).startsWith(String(sessions[19].avgAccuracy).replace(".", ",")), text(tip));
  assert.ok(text(tip).includes(sessions[19].title));
  assert.ok(text(tip).includes("puntos") && text(tip).includes("posiciones"));
  assert.strictEqual(hidden(q(el, ".progress-cross")), false, "the crosshair follows");
  points[19].dispatch("blur");
  assert.strictEqual(hidden(tip), true);
  // arrows
  points[19].dispatch("keydown", { key: "ArrowLeft" });
  assert.strictEqual(points[18].getAttribute("tabindex"), "0");
  assert.strictEqual(points[19].getAttribute("tabindex"), "-1");
  assert.ok(env.doc.activeElement === points[18], "focus");
  points[18].dispatch("keydown", { key: "Home" });
  assert.ok(env.doc.activeElement === points[0], "focus");
  points[0].dispatch("keydown", { key: "ArrowLeft" });
  assert.ok(env.doc.activeElement === points[0], "no wrapping past the first session");
  points[0].dispatch("keydown", { key: "End" });
  assert.ok(env.doc.activeElement === points[19], "focus");
  points[19].dispatch("focus");
  points[19].dispatch("keydown", { key: "Escape" });
  assert.strictEqual(hidden(tip), true, "Escape hides the tooltip");
  // the alternative
  const table = q(q(el, ".progress-trend"), "table");
  assert.ok(table.parentNode.classList.contains("sr-only"), "hidden by a wrapper (a table does not clip its own overflow)");
  assert.strictEqual(all(table, "tbody tr").length, 20);
  assert.strictEqual(all(table, "thead th").length, 4);
  assert.ok(text(all(table, "tbody tr")[19]).includes(sessions[19].title));
  // the improvement
  const stats = env.Ludus.Profile.stats();
  assert.strictEqual(stats.improvement === null, false);
  assert.ok(text(q(el, ".progress-improve")).includes(`${stats.improvement.window} posiciones`), text(q(el, ".progress-improve")));
  const delta = Math.abs(stats.improvement.delta);
  if (delta >= 0.05) assert.ok(text(q(el, ".progress-improve-headline")).includes(String(delta).replace(".", ",")), text(q(el, ".progress-improve-headline")));
});

test("trend: duels are left out of the curve and the screen says so", () => {
  const env = createEnv();
  env.Ludus.Profile.ensureActive();
  record(env, [makeRound(env, { accuracy: 50 })]);
  session(env, { id: "s_solo1", ts: NOW - 5 * DAY, avgAccuracy: 55 });
  session(env, { id: "s_duel1", ts: NOW - 3 * DAY, avgAccuracy: 99, mode: "duel", duel: { names: ["Lucía", "Dani"], scores: [24.5, 21], me: 0 } });
  session(env, { id: "s_solo2", ts: NOW - DAY, avgAccuracy: 65 });
  open(env);
  assert.strictEqual(all(env.el, ".progress-pt").length, 2, "the duel is not a point");
  assert.ok(text(q(env.el, ".progress-trend-card")).includes("Los duelos no se incluyen"));
  const sessions = all(env.el, ".progress-session");
  assert.strictEqual(sessions.length, 3, "but it is in the recent sessions");
  const duel = sessions.find((s) => text(s).includes("Duelo"));
  assert.ok(duel && text(duel).includes("Duelo: Lucía 24,5 a 21 Dani"), duel && text(duel));
  assert.ok(text(q(duel, ".progress-session-num dd")) === "—", "no accuracy for a duel");
});

test("the streak at risk: yesterday counts, today does not yet, and the warning is announced", () => {
  const env = createEnv();
  env.Ludus.Profile.ensureActive();
  record(env, [makeRound(env, { ts: NOW - DAY }), makeRound(env, { ts: NOW - 2 * DAY }), makeRound(env, { ts: NOW - 3 * DAY })]);
  const stats = env.Ludus.Profile.stats();
  assert.deepStrictEqual(plain({ c: stats.streak.current, r: stats.streak.atRisk, t: stats.streak.activeToday }), { c: 3, r: true, t: false });
  open(env);
  const warning = q(env.el, ".progress-streak-msg.is-risk");
  assert.ok(warning, "a warning");
  assert.strictEqual(warning.getAttribute("role"), "status");
  assert.strictEqual(text(warning), "Entrená hoy para no perder tu racha de 3 días.");
  assert.strictEqual(text(q(env.el, ".progress-streak-count")), "3");
  // A round today clears it.
  record(env, [makeRound(env, { ts: NOW - 1000 })]);
  env.advance(5);
  assert.strictEqual(all(env.el, ".progress-streak-msg.is-risk").length, 0);
  assert.ok(text(q(env.el, ".progress-streak-msg")).includes("Ya entrenaste hoy"));
  assert.strictEqual(text(q(env.el, ".progress-streak-count")), "4");
});

test("weak themes: each has its notebook link (a filtered notebook) and its lesson; a theme with too few positions is not listed", () => {
  const env = createEnv();
  env.Ludus.Profile.ensureActive();
  const rounds = [];
  for (let i = 0; i < 6; i += 1) rounds.push(makeRound(env, { accuracy: 30 + i, tags: ["hangs_piece"], ts: NOW - i * 60000 }));
  for (let i = 0; i < 5; i += 1) rounds.push(makeRound(env, { accuracy: 85, tags: ["fork_available"], ts: NOW - 10 * 60000 - i * 60000 }));
  for (let i = 0; i < 3; i += 1) rounds.push(makeRound(env, { accuracy: 10, tags: ["back_rank"], ts: NOW - 30 * 60000 - i * 60000 }));
  record(env, rounds);
  open(env);
  const items = all(env.el, ".progress-weak-item");
  deepEq(items.map((i) => text(q(i, ".progress-weak-name"))), ["Pieza colgada", "Doble ataque"], "worst first; back_rank has 3 positions: too few");
  assert.ok(text(items[0]).includes("32,5% de precisión") && text(items[0]).includes("6 posiciones"), text(items[0]));
  const link = q(items[0], ".progress-weak-notebook");
  assert.strictEqual(link.getAttribute("aria-label"), "Ver en el cuaderno las tarjetas de Pieza colgada");
  link.click();
  assert.strictEqual(env.Ludus.router.current(), "notebook");
  deepEq(env.shown[0], { tag: "hangs_piece" });
  env.Ludus.router.show("progress");
  const lesson = q(all(env.el, ".progress-weak-item")[0], ".progress-weak-lesson");
  assert.ok(lesson, "a theme with a lesson");
  lesson.click();
  assert.ok(q(env.doc.body, ".notebook-concept-modal"), "the lesson opens in the dialog of the notebook screen");
  // the empty variant names the best sample
  const env2 = createEnv();
  env2.Ludus.Profile.ensureActive();
  record(env2, [makeRound(env2, { tags: ["hangs_piece"] }), makeRound(env2, { tags: ["hangs_piece"] }), makeRound(env2, { tags: ["hangs_piece"] })]);
  open(env2);
  assert.ok(text(q(env2.el, ".progress-weak")).includes("el que más tiene llega a 3"), text(q(env2.el, ".progress-weak")));
});

test("achievements: the whole catalogue, unlocked with the date, locked with their progress; the filters", () => {
  const env = createEnv();
  fullLearner(env, { days: 12, perDay: 9 });
  open(env);
  const el = env.el;
  const stats = env.Ludus.Profile.stats();
  const unlocked = stats.achievements.unlocked;
  assert.ok(unlocked >= 3, `some achievements unlocked (${unlocked})`);
  assert.strictEqual(all(el, ".progress-ach").length, 24);
  assert.strictEqual(all(el, ".progress-ach.is-unlocked").length, unlocked);
  assert.ok(text(q(el, ".progress-ach-card")).includes(`${unlocked} de 24 desbloqueados`));
  const first = q(el, ".progress-ach.is-unlocked");
  assert.ok(/Desbloqueado el /.test(text(first)));
  assert.strictEqual(all(first, ".progress").length, 0, "no bar for what is done");
  const locked = q(el, ".progress-ach.is-locked");
  assert.ok(locked);
  const bar = q(locked, ".progress");
  assert.strictEqual(bar.getAttribute("role"), "progressbar");
  assert.ok(/: [\d,]+ de \d+$/.test(bar.getAttribute("aria-label")), bar.getAttribute("aria-label"));
  assert.ok(text(locked).includes("Bloqueado"), "locked is said in words too (screen readers)");
  assert.ok(all(locked, ".sr-only").some((n) => text(n).startsWith("Bloqueado")));
  assert.ok(!/%|de todos los jugadores|players/.test(text(q(el, ".progress-ach-card"))), "no rarity, no invented numbers");
  const filter = (name) => q(el, `.progress-ach-filter [data-filter="${name}"]`);
  // QA VIS-002 / CNT-027: the longest label of the control is short enough for a 320px phone ("Desbloqueados" collided with its neighbour).
  assert.deepStrictEqual(["all", "done", "todo"].map((name) => text(filter(name))), ["Todos", "Logrados", "Pendientes"]);
  assert.ok(["all", "done", "todo"].every((name) => text(filter(name)).length <= 10), "no label longer than 'Pendientes'");
  filter("done").click();
  assert.strictEqual(all(el, ".progress-ach").length, unlocked);
  assert.strictEqual(filter("done").getAttribute("aria-pressed"), "true");
  filter("todo").click();
  assert.strictEqual(all(el, ".progress-ach").length, 24 - unlocked);
  assert.strictEqual(all(el, ".progress-ach.is-unlocked").length, 0);
  filter("all").click();
  assert.strictEqual(all(el, ".progress-ach").length, 24);
  // progress bars agree with Profile
  const progress = env.Ludus.Profile.achievements.progress();
  const row = all(el, ".progress-ach.is-locked")[0];
  const id = Object.keys(progress).find((key) => !progress[key].unlocked && text(row).includes(env.Ludus.i18n.t(`achievement.${key}.name`)));
  assert.ok(id, "the locked card is one of the locked achievements");
  assert.ok(text(row).includes(`${String(progress[id].current).replace(".", ",")} de ${progress[id].target}`), text(row));
});

test("profile switcher: only with several profiles; it looks at another profile without changing the active one", () => {
  const env = createEnv();
  const Profile = env.Ludus.Profile;
  Profile.ensureActive();
  record(env, [makeRound(env, { accuracy: 90 }), makeRound(env, { accuracy: 90 })]);
  open(env);
  assert.strictEqual(all(env.el, ".progress-switcher").length, 0, "one profile: no switcher");
  const other = Profile.create({ name: "Dani" });
  const activeId = Profile.active().id;
  record(env, [makeRound(env, { accuracy: 20 }), makeRound(env, { accuracy: 30 }), makeRound(env, { accuracy: 40 }), makeRound(env, { accuracy: 50 })], other.id);
  env.advance(5);
  const buttons = all(env.el, ".progress-switch");
  assert.strictEqual(buttons.length, 2, "the switcher appears with a second profile");
  assert.strictEqual(q(env.el, ".progress-switcher").getAttribute("role"), "group");
  assert.strictEqual(buttons.filter((b) => b.getAttribute("aria-pressed") === "true").length, 1);
  assert.strictEqual(text(q(all(env.el, ".progress-stat")[0], ".progress-stat-value")), "2");
  buttons.find((b) => b.getAttribute("data-profile") === other.id).click();
  assert.strictEqual(text(q(all(env.el, ".progress-stat")[0], ".progress-stat-value")), "4", "Dani's positions");
  assert.strictEqual(Profile.active().id, activeId, "the active profile did not change");
  assert.strictEqual(env.doc.activeElement.getAttribute("data-profile"), other.id, "the focus stays on the switch");
  assert.strictEqual(all(env.el, ".progress-switch").find((b) => b.getAttribute("aria-pressed") === "true").getAttribute("data-profile"), other.id);
  // Coming back to the screen after the active profile changed shows the new active profile.
  env.Ludus.router.show("home");
  Profile.setActive(other.id);
  env.Ludus.router.show("progress");
  assert.strictEqual(all(env.el, ".progress-switch").find((b) => b.getAttribute("aria-pressed") === "true").getAttribute("data-profile"), other.id);
  Profile.setActive(activeId);
  env.Ludus.router.show("home");
  env.Ludus.router.show("progress");
  assert.strictEqual(all(env.el, ".progress-switch").find((b) => b.getAttribute("aria-pressed") === "true").getAttribute("data-profile"), activeId, "a change of the active profile is followed");
  // A profile that no longer exists falls back to the active one.
  env.Ludus.router.show("progress", { profile: "does_not_exist" });
  assert.strictEqual(all(env.el, ".progress-switch").find((b) => b.getAttribute("aria-pressed") === "true").getAttribute("data-profile"), activeId);
});

test("events: a completed session repaints while visible; a hidden screen waits", () => {
  const env = createEnv();
  env.Ludus.Profile.ensureActive();
  record(env, [makeRound(env, {})]);
  open(env);
  assert.strictEqual(all(env.el, ".progress-session").length, 0);
  session(env, { avgAccuracy: 71 });
  env.advance(5);
  assert.strictEqual(all(env.el, ".progress-session").length, 1);
  env.Ludus.router.show("home");
  session(env, { avgAccuracy: 72 });
  env.advance(5);
  assert.strictEqual(all(env.el, ".progress-session").length, 1, "nothing is drawn behind a hidden screen");
  assert.strictEqual(pr(env)._state.dirty, true);
  env.Ludus.router.show("progress");
  assert.strictEqual(all(env.el, ".progress-session").length, 2);
});

test("language: the dashboard is redrawn in English (decimal points, dates, labels) and back", () => {
  const env = createEnv();
  fullLearner(env, { days: 14, perDay: 3 });
  open(env);
  const stats = env.Ludus.Profile.stats();
  env.Ludus.i18n.setLanguage("en", { persist: false });
  assert.strictEqual(text(q(env.el, "h1")), "Your progress");
  assert.strictEqual(text(q(all(env.el, ".progress-stat")[1], ".progress-stat-value")), `${stats.overallAccuracy}%`, "decimal point");
  assert.ok(text(q(env.el, ".progress-streak")).includes("days in a row"));
  assert.ok(all(env.el, ".progress-pt")[0].getAttribute("aria-label").startsWith("Session 1 of"));
  assert.ok(text(q(env.el, ".progress-ach-card")).includes("unlocked"));
  assert.ok(!/progress\.[a-z]/.test(text(env.el)), "no raw keys");
  assert.strictEqual(q(env.el, ".progress-heat-svg").getAttribute("aria-label").startsWith("Activity of the last 12 weeks"), true);
  env.Ludus.i18n.setLanguage("es", { persist: false });
  assert.strictEqual(text(q(env.el, "h1")), "Tu progreso");
  assert.ok(!/progress\.[a-z]/.test(text(env.el)));
});

test("never builds markup from strings: hostile session titles and profile names are text", () => {
  const env = createEnv();
  env.Ludus.Profile.ensureActive();
  const Profile = env.Ludus.Profile;
  Profile.rename(Profile.active().id, "<img src=x onerror=alert(1)>");
  Profile.create({ name: "<b>Dani</b>" });
  record(env, [makeRound(env, {})]);
  session(env, { title: "<script>alert(1)</script>" });
  open(env);
  assert.ok(text(env.el).includes("<script>alert(1)</script>"));
  assert.strictEqual(all(env.el, "script").length, 0);
  assert.strictEqual(all(env.el, "img").filter((i) => i.getAttribute("src") === "x").length, 0);
});

test("degrading: without Profile, kit, Scoring, Insights, Concepts and the notebook screen the dashboard still draws", () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const noProfile = createEnv({ skip: ["js/profile.js"] });
    open(noProfile);
    assert.ok(text(noProfile.el).includes("no está disponible"));
    assert.strictEqual(all(noProfile.el, "h1").length, 1);

    const noKit = createEnv({ skip: ["js/ui/kit.js", "js/ui/notebook.js"] });
    fullLearner(noKit, { days: 10, perDay: 3 });
    open(noKit);
    assert.ok(all(noKit.el, ".progress-heat-cell").length > 0, "the charts are drawn here, not by the kit");
    assert.ok(all(noKit.el, ".progress-pt").length > 0);
    assert.ok(all(noKit.el, ".progress-ach").length === 24);
    assert.strictEqual(all(noKit.el, ".progress-weak-lesson").length, 0, "no lesson button without the notebook screen");

    const noScoring = createEnv({ skip: ["js/scoring.js"] });
    fullLearner(noScoring, { days: 10, perDay: 3 });
    open(noScoring);
    assert.ok(all(noScoring.el, ".progress-legend-item").length > 0, "quality labels fall back to the code");

    const noInsights = createEnv({ skip: ["js/insights.js", "js/concepts.js"] });
    fullLearner(noInsights, { days: 10, perDay: 3 });
    open(noInsights);
    assert.ok(text(noInsights.el).includes("hangs piece") || all(noInsights.el, ".progress-weak-item").length >= 0);
  } finally {
    console.error = originalError;
  }
});

test("the chart is redrawn at the width it is shown at; a resize repaints it; unmounting removes the listener", () => {
  const env = createEnv();
  fullLearner(env, { days: 12, perDay: 3 });
  open(env);
  const state = pr(env)._state;
  assert.strictEqual(state.trendWidth, 640, "the fake DOM has no layout: the default width");
  const plot = q(env.el, ".progress-trend-plot");
  Object.defineProperty(plot, "clientWidth", { value: 300, configurable: true });
  env.fire("resize");
  env.advance(200);
  assert.strictEqual(state.trendWidth, 300);
  const svg = q(env.el, ".progress-trend-svg");
  assert.ok(svg.getAttribute("viewBox").startsWith("0 0 300 "), svg.getAttribute("viewBox"));
  const height = Number(svg.getAttribute("viewBox").split(" ")[3]);
  assert.ok(height >= 190 && height <= 270);
  pr(env).destroy();
  env.fire("resize");
  env.advance(200);
});

runAll().then(() => {
  console.log(`progress-ui: ${passed} tests passed`);
}).catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
