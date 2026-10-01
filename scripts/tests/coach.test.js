// Tests for the coach (js/ui/coach.js, Ludus.Coach) and the strings of the play screen.
//
// Two layers. The pure helpers (verdict text, win bars, safe game links, the position card
// model, progress dots, rewards, the session summary numbers, the share text, PV numbering)
// run with no DOM at all. The renderers (thinking, evaluating, solo result, duel result, dots,
// summary and its actions) run against the fake DOM of _uidom.js with the real scoring,
// insights, concepts, facts and classics modules, so a change in what those modules answer
// that the coach cannot draw shows up here.
//
// Also covered: es/en text parity (same keys, same {placeholders}), every key the coach and
// the game markup ask for exists in both languages, nothing in the text table is orphaned,
// text never becomes markup, a missing kit or no DOM degrades quietly, and a language change
// draws the same data in the other language.

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { FakeDocument, findAll, byClass } = require("./_uidom.js");
const { createFakeLocalStorage } = require("./_fakedom.js");
const { load } = require("./_load.js");

const repoRoot = path.resolve(__dirname, "..", "..");
const SCRIPTS = [
  "js/ludus.js", "js/chess.js", "js/scoring.js", "js/insights.js", "js/concepts.js", "js/settings.js", "js/profile.js",
  "js/facts.js", "js/classics.js", "js/data/classics.data.js", "js/ui/kit.js", "js/ui/coach.js",
];

// A document, the real modules and the coach, in the language asked for. `withKit: false`
// leaves out js/ui/kit.js to prove the coach can still draw (and never throws) without it.
function createEnv({ language = "es", withKit = true, withDocument = true, setup = null } = {}) {
  const doc = withDocument ? new FakeDocument() : null;
  // `setup(doc)` runs before any script: markup the modules look for when they load (the dock under the board).
  if (doc && typeof setup === "function") setup(doc);
  const sandbox = { console, setTimeout, clearTimeout, Date, Math, JSON, Object, Array, String, Number, Promise, Map, Set, Intl, URL, structuredClone };
  if (doc) sandbox.document = doc;
  sandbox.window = sandbox;
  sandbox.navigator = { languages: [language], language };
  sandbox.localStorage = createFakeLocalStorage(new Map());
  const context = vm.createContext(sandbox);
  SCRIPTS.filter((rel) => withKit || rel !== "js/ui/kit.js").forEach((rel) => {
    vm.runInContext(fs.readFileSync(path.join(repoRoot, rel), "utf8"), context, { filename: rel });
  });
  const Ludus = context.Ludus;
  Ludus.i18n.setLanguage(language, { persist: false });
  if (withKit) {
    // Animation frames run at once and no timer outlives the test.
    Ludus.ui._setTimers({ setTimeout() { return 0; }, clearTimeout() {}, raf(fn) { fn(); }, now: () => 0 });
  }
  return { Ludus, Coach: Ludus.Coach, doc, context };
}

const text = (node) => node.textContent.replace(/\s+/g, " ").trim();
const all = (root, className) => findAll(root, byClass(className));
const first = (root, className) => all(root, className)[0] || null;
// Arrays and objects made inside the vm context are not of this realm: compare them as data.
const sameData = (actual, expected, message) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)), message);
const placeholders = (string) => Array.from(String(string).matchAll(/\{(\w+)\}/g), (m) => m[1]).sort().join(",");

let passed = 0;
const pending = [];
function test(name, fn) {
  pending.push({ name, fn });
}
async function runAll() {
  for (const { name, fn } of pending) {
    let watchdog = null;
    try {
      await Promise.race([fn(), new Promise((_, reject) => { watchdog = setTimeout(() => reject(new Error(`test never settled: ${name}`)), 6000); })]);
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

// ---------- Fixtures ----------

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const BLACK_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
const LINES = [
  { uci: "e2e4", score: 30 },
  { uci: "d2d4", score: 25 },
  { uci: "g1f3", score: 20 },
  { uci: "a2a3", score: -20 },
];

// The answer of a person, scored and analysed by the real modules (what app.js hands over).
function makeAnswer(env, { uci, san, name = "", hintsUsed = 0, noMoveReason = null, timeSpentMs = 6200, fen = START_FEN, lines = LINES } = {}) {
  const { Ludus } = env;
  const assessment = Ludus.Scoring.assess({ lines, userUci: uci || null, hintsUsed, settings: {} });
  const analyzed = uci ? Ludus.Insights.analyzeChoice({ fen, userUci: uci, bestUci: assessment.bestUci, assessment, lines }) : null;
  const insights = analyzed && !analyzed.error
    ? { tags: analyzed.tags || [], messages: analyzed.messages || [], conceptIds: analyzed.conceptIds || [], phase: analyzed.phase || null, verdict: analyzed.verdict || "unknown", texts: [] }
    : { tags: [], messages: [], conceptIds: [], phase: null, verdict: "unknown", texts: [] };
  return {
    playerIndex: 0,
    name,
    uci: uci || null,
    san: san || "",
    move: null,
    noMoveReason,
    reason: noMoveReason,
    hintsUsed,
    timeSpentMs,
    provisional: false,
    hit: Boolean(uci) && ["perfect", "great", "brilliant", "very_good", "good"].includes(assessment.qualityCode),
    isSacrifice: false,
    userScore: uci ? (lines.find((line) => line.uci === uci) || {}).score : undefined,
    assessment,
    insights,
  };
}

function makeContext(env, answers, extra = {}) {
  const duel = answers.length === 2;
  const primary = answers[answers.length - 1];
  return Object.assign({
    kind: duel ? "round_duel" : "round_solo",
    round: 1,
    positionId: "classic:test",
    fen: START_FEN,
    source: "classic",
    best: { uci: "e2e4", san: "e4", score: 30, evalText: "+0.30" },
    master: { uci: "d2d4", san: "d4", score: 25, rank: 2, evalText: "+0.25" },
    masterName: "Morphy",
    masterNote: { es: "Una apertura clásica.", en: "A classical opening." },
    lines: [
      { uci: "e2e4", san: "e4", score: 30, rank: 1, isBest: true, isUser: answers.some((a) => a.uci === "e2e4"), isMaster: false, pvSan: ["e4", "e5", "Nf3", "Nc6"] },
      { uci: "d2d4", san: "d4", score: 25, rank: 2, isBest: false, isUser: answers.some((a) => a.uci === "d2d4"), isMaster: true, pvSan: ["d4", "d5", "c4"] },
      { uci: "g1f3", san: "Nf3", score: 20, rank: 3, isBest: false, isUser: false, isMaster: false, pvSan: ["Nf3"] },
    ],
    answers,
    assessment: primary.assessment,
    assessments: answers.map((answer) => answer.assessment),
    insights: primary.insights,
    fact: env.Ludus.Facts.all()[0],
    engine: { source: "stockfish", origin: "search", depth: 18, movetimeMs: 1200 },
    hintsUsed: primary.hintsUsed,
    points: primary.assessment.points,
    maxPoints: primary.assessment.maxPoints,
    rewards: [],
    session: { id: "s_1", kind: "classic", title: "Test" },
  }, extra);
}

const RECORD = {
  id: "s_1", kind: "classic", title: "Tres partidas", mode: "solo", positions: 3, points: 21.5, maxPoints: 30, avgAccuracy: 84.2,
  durationMs: 185000, byQuality: { perfect: 1, good: 1, blunder: 1 },
};

function summaryRounds() {
  return [
    { index: 0, fen: START_FEN, side: "w", quality: "perfect", points: 10, hit: true, noMove: false, san: "e4", bestSan: "e4", bestUci: "e2e4", userUci: "e2e4", players: null },
    { index: 1, fen: BLACK_FEN, side: "b", quality: "good", points: 8.5, hit: true, noMove: false, san: "e5", bestSan: "c5", bestUci: "c7c5", userUci: "e7e5", players: null },
    { index: 2, fen: START_FEN, side: "w", quality: "blunder", points: 3, hit: false, noMove: false, san: "a3", bestSan: "e4", bestUci: "e2e4", userUci: "a2a3", players: null },
  ];
}

// ---------- Text ----------

test("text: Coach.TEXT has the same keys and placeholders in es and en, with nothing empty", () => {
  const { Coach } = createEnv();
  const es = Coach.TEXT.es;
  const en = Coach.TEXT.en;
  sameData(Object.keys(es).sort(), Object.keys(en).sort(), "the same keys in both languages");
  Object.keys(es).forEach((key) => {
    assert.ok(key.startsWith("coach."), `${key} lives under coach.*`);
    assert.ok(typeof es[key] === "string" && es[key].trim(), `es ${key} is empty`);
    assert.ok(typeof en[key] === "string" && en[key].trim(), `en ${key} is empty`);
    assert.strictEqual(placeholders(es[key]), placeholders(en[key]), `${key} placeholders differ`);
  });
  // Rioplatense in Spanish: the "vos" forms, never the tuteo, in what speaks to the person.
  assert.ok(!/\b(tu|tú) (puedes|tienes|eres)\b|\bpuedes\b|\btienes\b/i.test(Object.values(es).join(" ")), "Spanish uses vos, not tú");
});

test("text: every key the coach asks for exists in es and en, and none is left unused", () => {
  const { Ludus, Coach } = createEnv();
  const source = fs.readFileSync(path.join(repoRoot, "js/ui/coach.js"), "utf8");
  const start = source.indexOf("const TEXT = {");
  const end = source.indexOf("function registerText()");
  assert.ok(start > 0 && end > start, "found the text table");
  const code = source.slice(0, start) + source.slice(end);
  const asked = new Set();
  for (const match of code.matchAll(/\bt\(\s*"(coach\.[\w.]+)"/g)) asked.add(match[1]);
  for (const match of code.matchAll(/"(coach\.[\w.]+)"/g)) asked.add(match[1]);
  // The game core asks for a few of them too (the "back to the summary" button, the share toast).
  const appSource = fs.readFileSync(path.join(repoRoot, "app.js"), "utf8");
  for (const match of appSource.matchAll(/\bt\(\s*"(coach\.[\w.]+)"/g)) asked.add(match[1]);
  // Keys built from a template: the families and what fills them.
  const families = [];
  Coach.QUALITY_CODES.forEach((code2) => families.push(`coach.verdict.${code2}`));
  ["classic", "own", "review", "daily"].forEach((kind) => families.push(`coach.think.eyebrow.${kind}`));
  ["great", "good", "ok", "low"].forEach((tone) => families.push(`coach.sum.tone.${tone}`));
  families.forEach((key) => asked.add(key));
  asked.forEach((key) => {
    ["es", "en"].forEach((lang) => assert.ok(Ludus.i18n.has(key, lang), `${lang} is missing ${key}`));
  });
  const templates = Array.from(code.matchAll(/`(coach\.[\w.]*)\$\{/g), (m) => m[1]);
  Object.keys(Coach.TEXT.es).forEach((key) => {
    const used = asked.has(key) || templates.some((prefix) => key.startsWith(prefix));
    assert.ok(used, `${key} is in the table but nothing asks for it`);
  });
});

test("text: the game markup and app.js ask only for keys that exist in es and en", () => {
  const env = load();
  const { Ludus } = env;
  const html = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
  const game = html.slice(html.indexOf('id="screen-game"'), html.indexOf('id="screen-setup"') > 0 ? html.indexOf('id="screen-setup"') : undefined);
  const keys = new Set();
  for (const match of game.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) keys.add(match[1]);
  const app = fs.readFileSync(path.join(repoRoot, "app.js"), "utf8");
  for (const match of app.matchAll(/\bt\(\s*"((?:play|core|game|result|evaluation)\.[\w.]+)"/g)) keys.add(match[1]);
  assert.ok(keys.size > 30, `found the keys (${keys.size})`);
  // The game core keeps its own table and falls back to the shared one.
  const own = env.run("TRANSLATIONS");
  keys.forEach((key) => {
    ["es", "en"].forEach((lang) => assert.ok(Boolean(own[lang] && own[lang][key]) || Ludus.i18n.has(key, lang), `${lang} is missing ${key}`));
    assert.strictEqual(placeholders(own.es[key] || Ludus.i18n.t(key, {}, "es")), placeholders(own.en[key] || Ludus.i18n.t(key, {}, "en")), `${key} placeholders differ`);
  });
});

test("the coach builds every node with Ludus.util.h: no markup strings anywhere in it", () => {
  const source = fs.readFileSync(path.join(repoRoot, "js/ui/coach.js"), "utf8");
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(source), "no way to inject markup");
  assert.ok(!/eval\(|new Function\(/.test(source));
});

// ---------- Pure helpers ----------

test("qualityInfo and formatNumber: known codes, unknown codes fall to no_move, the decimal comma in Spanish", () => {
  const { Coach } = createEnv();
  Coach.QUALITY_CODES.forEach((code) => {
    const es = Coach.qualityInfo(code, "es");
    const en = Coach.qualityInfo(code, "en");
    assert.strictEqual(es.code, code);
    assert.ok(es.glyph && es.label && en.label, `${code} has a glyph and labels`);
    assert.strictEqual(es.tone, code.replace(/_/g, "-"));
  });
  assert.strictEqual(Coach.qualityInfo("nonsense", "en").code, "no_move");
  assert.strictEqual(Coach.qualityInfo(undefined, "en").code, "no_move");
  assert.strictEqual(Coach.qualityInfo("perfect", "en").hit, true);
  assert.strictEqual(Coach.qualityInfo("bad", "en").hit, false);
  assert.strictEqual(Coach.qualityInfo("interesting", "en").hit, false);
  // Colour is never the only channel: every quality has its own glyph.
  assert.strictEqual(new Set(Coach.QUALITY_CODES.map((code) => Coach.qualityInfo(code, "en").glyph)).size, Coach.QUALITY_CODES.length);
  assert.strictEqual(Coach.formatNumber(7.4, "es"), "7,4");
  assert.strictEqual(Coach.formatNumber(7.4, "en"), "7.4");
  assert.strictEqual(Coach.formatNumber(10, "es"), "10");
  assert.strictEqual(Coach.formatNumber(7.449, "en"), "7.4");
  assert.strictEqual(Coach.formatNumber(7.05, "en", 2), "7.05");
  assert.strictEqual(Coach.formatNumber(NaN, "en"), "-");
  assert.strictEqual(Coach.formatNumber(undefined, "es"), "-");
});

test("verdict: every branch has its sentence, in both languages, with the best move filled in", () => {
  const env = createEnv();
  const { Coach } = env;
  const best = { uci: "e2e4", san: "e4", score: 30 };
  const context = makeContext(env, [makeAnswer(env, { uci: "e2e4", san: "e4" })]);
  const perfect = context.answers[0];
  assert.strictEqual(Coach.verdictKey(context, perfect).key, "coach.verdict.perfect");
  // The master played the same move: the sentence names him.
  const withMaster = makeContext(env, [makeAnswer(env, { uci: "e2e4", san: "e4" })], { master: { uci: "e2e4", san: "e4", score: 30 }, masterName: "Morphy" });
  sameData(JSON.parse(JSON.stringify(Coach.verdictKey(withMaster, withMaster.answers[0]))), { key: "coach.verdict.masterSame", params: { master: "Morphy" } });
  // A move that is not the best names the best.
  const weak = makeContext(env, [makeAnswer(env, { uci: "a2a3", san: "a3" })]);
  const weakVerdict = Coach.verdictKey(weak, weak.answers[0]);
  assert.strictEqual(weakVerdict.params.best, "e4");
  assert.ok(Coach.verdictText(weak, weak.answers[0], "en").includes("e4") || !weakVerdict.key.includes("perfect"));
  // Without a move: revealed, timeout, skip, nothing.
  const none = (extra) => Object.assign(makeAnswer(env, { uci: null }), extra);
  const cases = [
    [none({ hintsUsed: 3 }), "coach.verdict.revealed"],
    [none({ noMoveReason: "hint_reveal" }), "coach.verdict.revealed"],
    [none({ noMoveReason: "timeout" }), "coach.verdict.timeout"],
    [none({ noMoveReason: "manual_skip" }), "coach.verdict.skip"],
    [none({ reason: "skip" }), "coach.verdict.skip"],
    [none({}), "coach.verdict.no_move"],
  ];
  cases.forEach(([answer, key]) => assert.strictEqual(Coach.verdictKey({ best, answers: [answer] }, answer).key, key, key));
  assert.strictEqual(Coach.verdictKey({ best, answers: [] }, null).key, "coach.verdict.no_move", "no answer at all");
  assert.strictEqual(Coach.verdictKey(null, null).key, "coach.verdict.no_move", "not even a context");
  // Mates come before the quality of the move.
  const mate = { uci: "a2a3", assessment: { reason: "missed_mate", qualityCode: "blunder" } };
  assert.strictEqual(Coach.verdictKey({ best }, mate).key, "coach.verdict.missed_mate");
  assert.strictEqual(Coach.verdictKey({ best }, { uci: "a2a3", assessment: { reason: "allows_mate", qualityCode: "bad" } }).key, "coach.verdict.allows_mate");
  // An unknown quality never leaves a raw key on screen.
  assert.strictEqual(Coach.verdictKey({ best }, { uci: "a2a3", assessment: { qualityCode: "weird" } }).key, "coach.verdict.no_move");
  // Every sentence exists, is filled in, and differs by language.
  Coach.QUALITY_CODES.forEach((code) => {
    const answer = { uci: "a2a3", assessment: { qualityCode: code } };
    const es = Coach.verdictText({ best }, answer, "es");
    const en = Coach.verdictText({ best }, answer, "en");
    [es, en].forEach((sentence) => assert.ok(sentence && !/[{}]|coach\./.test(sentence), `${code}: ${sentence}`));
  });
  assert.notStrictEqual(Coach.verdictText({ best }, perfect, "es"), Coach.verdictText({ best }, perfect, "en"));
});

test("winBars: win chance of the best move, of the answer and of the master, and what the answer gives up", () => {
  const env = createEnv();
  const { Coach, Ludus } = env;
  const win = (score) => Ludus.Scoring.winPercent(score);
  const played = makeContext(env, [makeAnswer(env, { uci: "e2e4", san: "e4" })]);
  const same = Coach.winBars(played, played.answers[0]);
  assert.strictEqual(same.best, win(30));
  assert.strictEqual(same.user, same.best, "playing the best move is the best win chance");
  assert.strictEqual(same.loss, 0);
  assert.strictEqual(same.master, win(25));
  // A weaker move: its own score.
  const weak = makeContext(env, [makeAnswer(env, { uci: "a2a3", san: "a3" })]);
  const bars = Coach.winBars(weak, weak.answers[0]);
  assert.strictEqual(bars.user, win(-20));
  assert.ok(bars.loss > 0 && bars.loss === Math.max(0, bars.best - bars.user));
  // Only the loss in win% is known: the answer is derived from it and clamped to 0..100.
  const derived = Coach.winBars({ best: { uci: "e2e4", score: 30 } }, { uci: "a2a3", assessment: { winLossPct: 12 } });
  assert.ok(Math.abs(derived.user - (win(30) - 12)) < 1e-9);
  const clamped = Coach.winBars({ best: { uci: "e2e4", score: -900 } }, { uci: "a2a3", assessment: { winLossPct: 50 } });
  assert.strictEqual(clamped.user, 0);
  // No move: nothing to compare, but the best move still has its bar.
  const none = Coach.winBars({ best: { uci: "e2e4", score: 30 } }, { uci: null });
  assert.strictEqual(none.user, null);
  assert.strictEqual(none.loss, null);
  assert.strictEqual(none.best, win(30));
  // Garbage never throws.
  sameData(JSON.parse(JSON.stringify(Coach.winBars(null, null))), { best: null, user: null, master: null, loss: null });
  assert.doesNotThrow(() => Coach.winBars({ best: { score: "x" }, master: {} }, { uci: "a2a3", userScore: "y" }));
});

test("safeGameUrl: only https links to lichess.org or chess.com become links", () => {
  const { Coach } = createEnv();
  sameData(JSON.parse(JSON.stringify(Coach.safeGameUrl("https://lichess.org/abcd1234"))), { href: "https://lichess.org/abcd1234", provider: "lichess" });
  sameData(JSON.parse(JSON.stringify(Coach.safeGameUrl("https://www.chess.com/game/live/123456"))), { href: "https://www.chess.com/game/live/123456", provider: "chesscom" });
  assert.strictEqual(Coach.safeGameUrl("Rated game https://lichess.org/AbCdEfGh played").provider, "lichess", "the URL is found inside the tag");
  assert.strictEqual(Coach.safeGameUrl("https://LICHESS.ORG/x1").provider, "lichess", "case does not matter");
  [
    "http://lichess.org/abcd1234",
    "javascript:alert(1)",
    "https://lichess.org.evil.example/abcd1234",
    "https://evil.example/lichess.org/abcd1234",
    "https://user:pass@lichess.org/abcd1234",
    "https://lichess.org:8443/abcd1234",
    "https://lichess.org",
    "https://lichess.org/",
    "https://notlichess.org/abcd1234",
    "ftp://lichess.org/abcd1234",
    "lichess.org/abcd1234",
    "Berlin GER",
    "",
    "https://" + "a".repeat(500) + ".lichess.org/x",
    null,
    undefined,
    42,
    {},
  ].forEach((site) => assert.strictEqual(Coach.safeGameUrl(site), null, String(site)));
});

test("positionModel: the card of a classic, an own game and a review; nothing missing breaks it", () => {
  const { Ludus, Coach } = createEnv();
  const classicPosition = {
    fen: START_FEN,
    source: "classic",
    meta: { event: "Opera Game", year: 1858, players: "Paul Morphy vs Duke of Brunswick", moveNumber: 10, eco: "C41", sideToMove: "w" },
    classic: { kind: "tactic", note: { es: "Nota en español.", en: "A note in English." } },
  };
  const es = Coach.positionModel({ position: classicPosition, session: { kind: "classic" }, lang: "es" });
  assert.strictEqual(es.event, "Opera Game");
  assert.strictEqual(es.year, "1858");
  assert.strictEqual(es.moveNumber, 10);
  assert.strictEqual(es.side, "w");
  assert.strictEqual(es.moverName, "Morphy", "the surname of the side to move");
  assert.strictEqual(es.note, "Nota en español.");
  assert.strictEqual(es.link, null, "a classic never links out");
  assert.ok(es.kind && es.kind.label && es.kind.code === "tactic");
  assert.strictEqual(es.eyebrow, Ludus.i18n.t("coach.think.eyebrow.classic", {}, "es"));
  const en = Coach.positionModel({ position: classicPosition, session: { kind: "classic" }, lang: "en" });
  assert.strictEqual(en.note, "A note in English.");
  assert.notStrictEqual(en.eyebrow, es.eyebrow);
  // The stored text of a classic is English / ASCII: the classics screen (when it is there) gives the words of the page.
  Ludus.Screens = Ludus.Screens || {};
  Ludus.Screens.classics = { helpers: { localizeMeta: (meta, lang) => Object.assign({}, meta, { event: `${meta.event}@${lang}`, players: `${meta.players}@${lang}` }) } };
  const localized = Coach.positionModel({ position: classicPosition, session: { kind: "classic" }, lang: "es" });
  assert.strictEqual(localized.event, "Opera Game@es");
  assert.strictEqual(localized.players, "Paul Morphy vs Duke of Brunswick@es");
  assert.strictEqual(localized.moverName, "Morphy", "the surname still comes from the stored names");
  Ludus.Screens.classics = { helpers: { localizeMeta() { throw new Error("broken"); } } };
  assert.strictEqual(Coach.positionModel({ position: classicPosition, session: { kind: "classic" }, lang: "es" }).event, "Opera Game", "a failing helper falls back to the stored text");
  delete Ludus.Screens.classics;
  // Black to move takes the other name.
  const black = Coach.positionModel({ position: Object.assign({}, classicPosition, { meta: Object.assign({}, classicPosition.meta, { sideToMove: "b" }) }), session: { kind: "classic" }, lang: "en" });
  assert.strictEqual(black.moverName, "Duke of Brunswick".split(" ").pop());
  assert.strictEqual(black.side, "b");
  // Name formats: "Surname, Name" and "A vs. B".
  assert.strictEqual(Coach.positionModel({ position: { fen: START_FEN, meta: { players: "Kasparov, Garry vs. Topalov, Veselin", sideToMove: "b" } }, session: { kind: "classic" }, lang: "en" }).moverName, "Topalov");
  assert.strictEqual(Coach.positionModel({ position: { fen: START_FEN, meta: { players: "Somebody" } }, session: { kind: "classic" }, lang: "en" }).moverName, "", "not two players, no name");
  // Own games: the link only when it is safe, never a master's name.
  const own = Coach.positionModel({ position: { fen: START_FEN, source: "own", meta: { players: "a vs b", site: "https://lichess.org/abcd1234", sideToMove: "w" } }, session: { kind: "own" }, lang: "en" });
  assert.strictEqual(own.moverName, "");
  assert.strictEqual(own.link.provider, "lichess");
  const hostile = Coach.positionModel({ position: { fen: START_FEN, source: "own", meta: { site: "https://evil.example/x" } }, session: { kind: "own" }, lang: "en" });
  assert.strictEqual(hostile.link, null);
  assert.strictEqual(Coach.positionModel({ position: { fen: START_FEN }, session: { kind: "review" }, lang: "en" }).eyebrow, Ludus.i18n.t("coach.think.eyebrow.review", {}, "en"));
  assert.strictEqual(Coach.positionModel({ position: { fen: START_FEN }, session: { kind: "weird" }, lang: "en" }).eyebrow, Ludus.i18n.t("coach.think.eyebrow.own", {}, "en"), "an unknown kind reads as own");
  // Nothing at all.
  const empty = Coach.positionModel({});
  assert.strictEqual(empty.event, "");
  assert.strictEqual(empty.moveNumber, null);
  assert.doesNotThrow(() => Coach.positionModel());
});

test("dotsModel: one dot per position, hit or miss or none, the current one, the rest to do", () => {
  const { Coach } = createEnv();
  const rounds = [
    { quality: "perfect", points: 10 },
    { quality: "bad", points: 2.5 },
    { quality: "no_move", points: 0 },
    { quality: "interesting", points: 6, hit: true },
  ];
  const model = Coach.dotsModel({ total: 6, current: 4, rounds, lang: "en" });
  assert.strictEqual(model.total, 6);
  assert.strictEqual(model.done, 4);
  assert.strictEqual(model.dense, false);
  sameData(model.items.map((item) => item.state), ["hit", "miss", "none", "hit", "current", "todo"]);
  sameData(model.items.map((item) => item.n), [1, 2, 3, 4, 5, 6]);
  // Shape and words are there for whoever cannot tell the colours apart.
  assert.ok(model.items.every((item) => item.label.includes(String(item.n))));
  assert.ok(model.items[0].label.toLowerCase().includes("perfect") && model.items[0].label.includes("10"));
  assert.ok(model.items[1].label.includes("2.5"));
  assert.notStrictEqual(model.items[2].label, model.items[1].label);
  assert.ok(model.summary.includes("4") && model.summary.includes("6"));
  assert.ok(Coach.dotsModel({ total: 3, current: 0, rounds: [{ quality: "good", points: 7.5 }], lang: "es" }).items[0].label.includes("7,5"), "the decimal comma");
  // On the result screen nothing is "current".
  assert.ok(!Coach.dotsModel({ total: 3, current: -1, rounds: [rounds[0]], lang: "en" }).items.some((item) => item.state === "current"));
  // A duel names both players.
  const duel = Coach.dotsModel({ total: 2, current: 1, rounds: [{ quality: "perfect", points: 10, duel: [{ name: "Ana", points: 10 }, { name: "Beto", points: 4.5 }] }], lang: "en" });
  assert.ok(duel.items[0].label.includes("Ana") && duel.items[0].label.includes("Beto") && duel.items[0].label.includes("4.5"));
  // Many positions collapse into one summary instead of dozens of tab stops.
  const dense = Coach.dotsModel({ total: 30, current: 0, rounds: [], lang: "en" });
  assert.strictEqual(dense.dense, true);
  assert.strictEqual(dense.items.length, 30);
  assert.strictEqual(Coach.dotsModel({ total: 24, current: 0, rounds: [] }).dense, false);
  // More rounds than positions (a stale array) never makes more dots than positions.
  assert.strictEqual(Coach.dotsModel({ total: 2, current: 0, rounds }).items.length, 2);
  assert.strictEqual(Coach.dotsModel({ total: 0 }).items.length, 0);
  assert.doesNotThrow(() => Coach.dotsModel());
});

test("rewardModel: XP, level, the notebook line and the achievements; null when there is nothing to say", () => {
  const { Coach } = createEnv();
  const now = Date.UTC(2026, 5, 10, 12);
  const day = 86400000;
  assert.strictEqual(Coach.rewardModel(null, now, "en"), null);
  assert.strictEqual(Coach.rewardModel({}, now, "en"), null);
  assert.strictEqual(Coach.rewardModel({ xpGained: 0, card: null, unlocked: [] }, now, "en"), null, "a guest earns nothing");
  const xp = Coach.rewardModel({ xpGained: 74.6, level: { level: 2 } }, now, "en");
  assert.strictEqual(xp.xp, 75);
  assert.strictEqual(xp.level.level, 2);
  assert.strictEqual(xp.card, null);
  assert.strictEqual(xp.levelUp, false);
  const card = (extra) => Coach.rewardModel({ xpGained: 5, card: extra }, now, "en").card;
  assert.strictEqual(card({ created: true, due: now + day }).tone, "info");
  assert.ok(/tomorrow/i.test(card({ created: true, due: now + day }).text), card({ created: true, due: now + day }).text);
  assert.ok(/3/.test(card({ created: true, due: now + 3 * day }).text), "in N days");
  assert.strictEqual(card({ updated: true, passed: true, due: now + 2 * day }).tone, "success");
  assert.strictEqual(card({ updated: true, passed: false, due: now + 1000 }).tone, "warn");
  assert.strictEqual(card({ newlyCleared: true }).tone, "success");
  assert.strictEqual(card({}), null, "a card the round did not touch says nothing");
  assert.notStrictEqual(card({ created: true, due: now + day }).text, Coach.rewardModel({ xpGained: 5, card: { created: true, due: now + day } }, now, "es").card.text, "the text follows the language");
  const unlocked = Coach.rewardModel({ xpGained: 0, levelUp: true, unlocked: [{ id: "a", name: "First steps" }, { id: "b" }, null] }, now, "en");
  assert.strictEqual(unlocked.levelUp, true);
  sameData(unlocked.unlocked.map((entry) => entry.name), ["First steps"], "an achievement without a name is left out");
  assert.doesNotThrow(() => Coach.rewardModel({ xpGained: "lots", card: 5, unlocked: "no" }, NaN, "en"));
});

test("summaryModel: the numbers of the closing summary, solo and duel", () => {
  const { Coach } = createEnv();
  const model = Coach.summaryModel({ record: RECORD, rounds: summaryRounds(), rewards: { xp: 120, cards: 1, unlocked: [] }, mode: "solo", lang: "en" });
  assert.strictEqual(model.mode, "solo");
  assert.strictEqual(model.points, 21.5);
  assert.strictEqual(model.maxPoints, 30);
  assert.strictEqual(model.positions, 3);
  assert.strictEqual(model.accuracy, 84.2);
  assert.strictEqual(model.hits, 2);
  assert.strictEqual(model.durationMs, 185000);
  assert.ok(Math.abs(model.ratio - 21.5 / 30) < 1e-9);
  assert.strictEqual(model.tone, "good", "72% is a good session");
  assert.strictEqual(model.gaugeTone, "good");
  sameData(model.segments.map((segment) => segment.code), ["perfect", "good", "blunder"], "in the order of quality, only what happened");
  assert.strictEqual(model.segments.reduce((sum, segment) => sum + segment.count, 0), 3);
  assert.ok(Math.abs(model.segments.reduce((sum, segment) => sum + segment.share, 0) - 1) < 1e-9);
  assert.ok(model.segments.every((segment) => segment.info.label && segment.info.glyph));
  assert.strictEqual(model.duel, null);
  assert.strictEqual(model.rewards.xp, 120);
  // Tones by ratio.
  const tone = (points) => Coach.summaryModel({ record: { positions: 10, points, maxPoints: 100 }, rounds: [] }).tone;
  sameData([95, 85, 84.9, 65, 64.9, 40, 39.9, 0].map(tone), ["great", "great", "good", "good", "ok", "ok", "low", "low"]);
  // Without a record's breakdown the rounds are counted.
  const counted = Coach.summaryModel({ record: { positions: 3 }, rounds: summaryRounds() });
  sameData(counted.segments.map((segment) => `${segment.code}:${segment.count}`), ["perfect:1", "good:1", "blunder:1"]);
  assert.strictEqual(counted.points, 21.5, "points from the rounds");
  assert.strictEqual(counted.maxPoints, 30);
  assert.strictEqual(counted.noMorePositions, false);
  assert.strictEqual(Coach.summaryModel({ record: RECORD, noMorePositions: true }).noMorePositions, true);
  // Nothing at all.
  const empty = Coach.summaryModel();
  assert.strictEqual(empty.points, 0);
  assert.strictEqual(empty.ratio, 0);
  sameData(empty.segments, []);
  // A duel: scores, accuracy per player, the winner (or none).
  const duelRounds = [
    { index: 0, fen: START_FEN, side: "w", quality: "perfect", points: 10, hit: true, players: [{ name: "Ana", points: 10, quality: "perfect", accuracy: 100 }, { name: "Beto", points: 4, quality: "bad", accuracy: 40 }] },
    { index: 1, fen: START_FEN, side: "w", quality: "good", points: 8, hit: true, players: [{ name: "Ana", points: 8, quality: "good", accuracy: 80 }, { name: "Beto", points: 7, quality: "good", accuracy: 70 }] },
  ];
  const duel = Coach.summaryModel({ record: { kind: "classic", mode: "duel", positions: 2, maxPoints: 40, duel: { names: ["Ana", "Beto"], scores: [18, 11] } }, rounds: duelRounds, mode: "duel", lang: "en" });
  assert.strictEqual(duel.mode, "duel");
  assert.strictEqual(duel.duel.winner, 0);
  sameData(duel.duel.accuracy, [90, 55]);
  sameData(duel.duel.names, ["Ana", "Beto"]);
  const flipped = Coach.summaryModel({ record: { mode: "duel", positions: 1, duel: { names: ["Ana", "Beto"], scores: [3, 9] } }, rounds: [] });
  assert.strictEqual(flipped.duel.winner, 1);
  const draw = Coach.summaryModel({ record: { mode: "duel", positions: 1, duel: { names: ["Ana", "Beto"], scores: [7, 7] } }, rounds: [] });
  assert.strictEqual(draw.duel.winner, -1);
  assert.strictEqual(draw.maxPoints, 20, "both players count when the record does not say");
});

test("shareText: plain text in the language asked, solo and duel, never a link or markup", () => {
  const { Coach } = createEnv();
  const solo = Coach.summaryModel({ record: RECORD, rounds: summaryRounds(), rewards: { xp: 120 }, lang: "en" });
  const en = Coach.shareText(solo, "en");
  assert.ok(en.includes("21.5") && en.includes("30") && en.includes("84"), en);
  assert.ok(en.includes("Tres partidas"), "the title of the session");
  assert.ok(/1 perfect/i.test(en) && /1 good/i.test(en) && /mistake/i.test(en), "the mix of answers");
  assert.ok(en.includes("120"), "the XP");
  assert.ok(!/<|>|http/.test(en), "plain text");
  const es = Coach.shareText(Coach.summaryModel({ record: RECORD, rounds: summaryRounds(), lang: "es" }), "es");
  assert.ok(es.includes("21,5"), `the decimal comma: ${es}`);
  assert.notStrictEqual(es, en);
  assert.ok(!es.includes("120"), "no XP line without XP");
  const duelModel = (scores) => Coach.summaryModel({ record: { mode: "duel", positions: 2, maxPoints: 40, duel: { names: ["Ana", "Beto"], scores } }, rounds: [], mode: "duel", lang: "en" });
  const won = Coach.shareText(duelModel([18, 11]), "en");
  assert.ok(won.includes("Ana") && won.includes("Beto") && won.includes("18") && won.includes("11"), won);
  assert.ok(/Ana wins/.test(won), won);
  assert.ok(!/wins/.test(Coach.shareText(duelModel([9, 9]), "en")), "a draw has no winner");
  assert.strictEqual(Coach.shareText(null, "en"), "");
  assert.doesNotThrow(() => Coach.shareText({}, "es"));
});

test("pvTokens: numbers a line the way a score sheet does", () => {
  const { Coach } = createEnv();
  const plain = (value) => JSON.parse(JSON.stringify(value));
  sameData(plain(Coach.pvTokens(START_FEN, ["e4", "e5", "Nf3"])), [
    { ply: 1, san: "e4", number: "1." },
    { ply: 2, san: "e5", number: "" },
    { ply: 3, san: "Nf3", number: "2." },
  ]);
  sameData(plain(Coach.pvTokens("r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 2 2", ["Bb4", "Bb5", "Nf6"])), [
    { ply: 1, san: "Bb4", number: "2..." },
    { ply: 2, san: "Bb5", number: "3." },
    { ply: 3, san: "Nf6", number: "" },
  ], "a line that starts with Black says so");
  sameData(plain(Coach.pvTokens("", ["e4"])), [{ ply: 1, san: "e4", number: "1." }], "no FEN reads as the start");
  sameData(Coach.pvTokens(START_FEN, []), []);
  sameData(Coach.pvTokens(START_FEN, null), []);
  assert.strictEqual(Coach.pvTokens(START_FEN, [42])[0].san, "42");
});

test("roundArrows: the best move, and the one played when it is another", () => {
  const { Coach } = createEnv();
  const plain = (value) => JSON.parse(JSON.stringify(value));
  sameData(plain(Coach.roundArrows("e2e4", "d2d4")), [{ from: "e2", to: "e4", color: "best" }, { from: "d2", to: "d4", color: "user" }]);
  sameData(plain(Coach.roundArrows("e2e4", "e2e4")), [{ from: "e2", to: "e4", color: "best" }], "one arrow when they agree");
  sameData(plain(Coach.roundArrows("e7e8q", null)), [{ from: "e7", to: "e8", color: "best" }], "a promotion keeps its squares");
  sameData(Coach.roundArrows("", undefined), []);
  sameData(Coach.roundArrows("xx", "<script>"), []);
});

// ---------- DOM ----------

test("renderThinking: the position card, the goal, the hint costs, and text never becomes markup", () => {
  const env = createEnv({ language: "en" });
  const { Coach, doc } = env;
  const el = doc.createElement("div");
  doc.body.appendChild(el);
  const hostile = "<img src=x onerror=alert(1)>";
  const model = Coach.positionModel({
    position: { fen: START_FEN, source: "own", meta: { event: hostile, players: `${hostile} vs b`, year: 2020, site: "https://lichess.org/abcd1234", moveNumber: 12, eco: "B20", sideToMove: "w" } },
    session: { kind: "own" }, lang: "en",
  });
  Coach.renderThinking(el, model, { hintCosts: [15, 35] });
  assert.ok(text(el).includes(hostile), "shown as text");
  assert.strictEqual(findAll(el, (node) => node.tagName === "IMG").length, 0, "and never as an element");
  assert.ok(text(el).includes("12") && text(el).includes("B20"));
  const link = findAll(el, (node) => node.tagName === "A")[0];
  assert.ok(link, "a safe game link");
  assert.strictEqual(link.getAttribute("href"), "https://lichess.org/abcd1234");
  assert.strictEqual(link.getAttribute("target"), "_blank");
  assert.ok(/noopener/.test(link.getAttribute("rel")) && /noreferrer/.test(link.getAttribute("rel")));
  assert.ok(link.getAttribute("aria-label"), "the link says where it goes");
  assert.ok(text(el).includes("15") && text(el).includes("35"), "the hint costs");
  assert.strictEqual(all(el, "co-turnbanner").length, 0, "no duel banner in a solo session");
  assert.strictEqual(all(el, "co-note-warn").length, 0);
  // Drawing again replaces the card, it does not pile up.
  Coach.renderThinking(el, model, {});
  assert.strictEqual(all(el, "co-ctx").length, 1);
  assert.ok(!text(el).includes("35%"), "no hint costs when hints are off");
  // A duel says whose turn it is; a backup engine says so.
  Coach.renderThinking(el, Coach.positionModel({ position: { fen: START_FEN, meta: {} }, session: { kind: "classic" }, lang: "en" }), {
    duel: { name: "Beto", initials: "BE" }, backupEngine: true,
  });
  const banner = first(el, "co-turnbanner");
  assert.ok(banner && text(banner).includes("Beto"));
  assert.strictEqual(first(banner, "co-turnbanner-avatar").getAttribute("aria-hidden"), "true");
  assert.strictEqual(all(el, "co-note-warn").length, 1, "the backup engine is announced");
});

test("renderEvaluating: the same silhouette as the result, busy, with something to focus", () => {
  const env = createEnv({ language: "en" });
  const { Coach, doc } = env;
  const el = doc.createElement("div");
  doc.body.appendChild(el);
  Coach.renderEvaluating(el, { lang: "en" });
  const hero = first(el, "co-hero");
  assert.ok(hero && hero.getAttribute("aria-busy") === "true");
  assert.ok(all(el, "co-skel").length >= 2, "cards where the result will have its cards");
  assert.ok(findAll(el, (node) => node.hasAttribute("data-focus")).length === 1);
  assert.ok(text(hero).length > 0);
});

test("renderRound: a perfect answer, hero first, then the comparison, the lines and the fact", () => {
  const env = createEnv({ language: "en" });
  const { Coach, doc, Ludus } = env;
  const el = doc.createElement("div");
  doc.body.appendChild(el);
  const context = makeContext(env, [makeAnswer(env, { uci: "e2e4", san: "e4" })]);
  context.rewards = [{ xpGained: 80, level: Ludus.Profile.levelFor(120), levelUp: false, card: null, unlocked: [{ id: "a", name: "First steps", description: "A first game", glyph: "★" }] }];
  Coach.renderRound(el, context, { lang: "en", gaugeSize: 96 });
  const hero = first(el, "co-hero");
  assert.strictEqual(hero.getAttribute("data-q"), "perfect");
  assert.ok(text(first(hero, "co-hero-title")).includes(Coach.qualityInfo("perfect", "en").label));
  assert.strictEqual(all(el, "co-hero-title")[0].getAttribute("tabindex"), "-1", "the verdict can take the focus");
  assert.ok(all(el, "co-hero-title")[0].hasAttribute("data-focus"));
  assert.ok(text(first(hero, "co-hero-verdict")).length > 10);
  assert.ok(text(hero).includes("80"), "the XP chip");
  assert.ok(text(hero).includes("6"), "the time chip");
  // The comparison: one row per distinct move, with who chose it.
  const rows = all(el, "co-cmp-row");
  sameData(rows.map((row) => text(first(row, "co-cmp-san"))), ["e4", "d4"], "you and the best are the same row; the master's is another");
  assert.ok(all(rows[0], "co-tag").length === 2, "e4 is yours and the engine's");
  assert.ok(all(rows[1], "co-tag").length === 1 && text(all(rows[1], "co-tag")[0]).includes("Morphy"));
  assert.ok(all(el, "co-bar").every((bar) => /%/.test(bar.getAttribute("aria-label"))), "every bar says its number");
  assert.ok(text(el).includes("A classical opening."), "the note of the classic in the language of the screen");
  // The three lines of the engine, each a button; the best one is marked.
  const lines = all(el, "co-line");
  assert.strictEqual(lines.length, 3);
  assert.ok(lines.every((line) => line.getAttribute("aria-pressed") === "false" && line.getAttribute("aria-label")));
  // The rest: what the round earned, the curiosity.
  assert.ok(first(el, "co-rewards") && text(first(el, "co-rewards")).includes("First steps"));
  assert.ok(first(el, "co-fact"), "a curiosity");
  // Drawing it again (the language changed) replaces everything.
  Coach.renderRound(el, context, { lang: "es" });
  assert.strictEqual(all(el, "co-hero").length, 1);
  assert.ok(text(el).includes("Una apertura clásica."), "the Spanish note");
  assert.ok(text(el).includes(Coach.qualityInfo("perfect", "es").label));
});

test("renderRound: a weak move says what it gave up; no move, hints, the backup engine and a provisional score are said", () => {
  const env = createEnv({ language: "en" });
  const { Coach, doc } = env;
  const el = doc.createElement("div");
  doc.body.appendChild(el);
  const weak = makeContext(env, [makeAnswer(env, { uci: "a2a3", san: "a3", hintsUsed: 1 })], { engine: { source: "local", depth: 8 } });
  weak.answers[0].provisional = true;
  Coach.renderRound(el, weak, { lang: "en" });
  assert.strictEqual(first(el, "co-hero").getAttribute("data-q"), weak.answers[0].assessment.qualityCode);
  assert.ok(/win chance|%/i.test(text(first(el, "co-compare"))), "what the move gives up");
  assert.ok(text(first(el, "co-hero")).includes("15"), "the hint chip says what it cost");
  const notes = all(el, "co-note").map(text);
  assert.strictEqual(notes.length, 2, "provisional and backup engine");
  // No move: skipped, timed out, revealed.
  [["timeout", 0], ["manual_skip", 0], ["hint_reveal", 3]].forEach(([reason, hints]) => {
    const context = makeContext(env, [makeAnswer(env, { uci: null, noMoveReason: reason, hintsUsed: hints })]);
    Coach.renderRound(el, context, { lang: "en" });
    assert.strictEqual(first(el, "co-hero").getAttribute("data-q"), "no_move", reason);
    assert.ok(text(first(el, "co-hero-verdict")).includes("e4"), `${reason} names the best move`);
    assert.ok(first(el, "co-compare"), `${reason} still compares`);
  });
  // The engine is still refining: a status, not an alarm.
  const refining = makeContext(env, [makeAnswer(env, { uci: "e2e4", san: "e4" })], { refining: true });
  Coach.renderRound(el, refining, { lang: "en" });
  assert.strictEqual(first(el, "co-refining").getAttribute("role"), "status");
});

test("renderRound: the engine lines step through a variation, and the panel says where it is", () => {
  const env = createEnv({ language: "en" });
  const { Coach, doc } = env;
  const el = doc.createElement("div");
  doc.body.appendChild(el);
  const steps = [];
  const context = makeContext(env, [makeAnswer(env, { uci: "e2e4", san: "e4" })]);
  Coach.renderRound(el, context, { lang: "en", onStep: (line, ply) => steps.push([line, ply]) });
  const lines = all(el, "co-line");
  const steppers = all(el, "co-stepper");
  assert.ok(steppers.every((stepper) => stepper.hidden), "closed until a line is chosen");
  lines[0].click();
  sameData(steps.pop(), [0, 1], "choosing a line shows its first move");
  assert.strictEqual(lines[0].getAttribute("aria-pressed"), "true");
  assert.strictEqual(lines[1].getAttribute("aria-pressed"), "false");
  assert.strictEqual(steppers[0].hidden, false);
  const buttons = all(steppers[0], "co-step-btn");
  assert.strictEqual(buttons.length, 4, "first, previous, next, last");
  assert.ok(buttons.every((button) => button.getAttribute("aria-label")), "every step button has a name");
  const [firstBtn, prevBtn, nextBtn, lastBtn] = buttons;
  assert.strictEqual(firstBtn.disabled, false);
  nextBtn.click();
  sameData(steps.pop(), [0, 2]);
  lastBtn.click();
  sameData(steps.pop(), [0, 4], "the last move of the line");
  assert.strictEqual(nextBtn.disabled, true, "nothing after the end");
  prevBtn.click();
  sameData(steps.pop(), [0, 3]);
  firstBtn.click();
  sameData(steps.pop(), [0, 0], "back to the position");
  assert.strictEqual(prevBtn.disabled, true);
  // A move of the line is a button too, with its number.
  const tokens = all(steppers[0], "co-tok");
  assert.strictEqual(tokens.length, 4);
  assert.ok(text(tokens[0]).includes("1.") && text(tokens[2]).includes("2."));
  tokens[1].click();
  sameData(steps.pop(), [0, 2]);
  assert.strictEqual(tokens[1].getAttribute("aria-current"), "step");
  // Another line takes over; choosing the same one again keeps the ply.
  lines[1].click();
  sameData(steps.pop(), [1, 1]);
  assert.strictEqual(steppers[0].hidden, true);
  assert.strictEqual(steppers[1].hidden, false);
  // The state the game holds is drawn again after a re-render (a language change mid-stepper).
  Coach.renderRound(el, context, { lang: "en", pv: { line: 1, ply: 2 } });
  assert.strictEqual(all(el, "co-line")[1].getAttribute("aria-pressed"), "true");
  assert.strictEqual(all(el, "co-stepper")[1].hidden, false);
  assert.ok(text(first(all(el, "co-stepper")[1], "co-step-pos")).includes("2"), "the counter follows");
});

test("renderRound: a concept chip opens the lesson in a dialog", () => {
  const env = createEnv({ language: "en" });
  const { Coach, doc, Ludus } = env;
  const el = doc.createElement("div");
  doc.body.appendChild(el);
  const conceptId = Ludus.Concepts.list()[0].id;
  const context = makeContext(env, [makeAnswer(env, { uci: "a2a3", san: "a3" })]);
  context.answers[0].insights.conceptIds = [conceptId, "not-a-concept"];
  Coach.renderRound(el, context, { lang: "en" });
  const chips = all(el, "co-concept");
  assert.strictEqual(chips.length, 1, "an unknown concept is left out");
  assert.ok(chips[0].getAttribute("aria-label"));
  chips[0].click();
  const dialog = findAll(doc.body, (node) => node.getAttribute("role") === "dialog" || node.getAttribute("role") === "alertdialog")[0];
  assert.ok(dialog, "the lesson opens as a dialog");
  assert.ok(text(dialog).includes(Ludus.Concepts.text(conceptId, "en").title));
  assert.strictEqual(Coach.openConcept("not-a-concept"), null);
});

test("openConcept: a wide and short window puts the board beside the words, and a scrolling lesson can be reached by keyboard", () => {
  const { FakeElement } = require("./_uidom.js");
  const env = createEnv({ language: "en" });
  const { Coach, doc, Ludus, context } = env;
  const conceptId = Ludus.Concepts.list()[0].id;
  const dialog = () => findAll(doc.body, byClass("modal")).pop();
  // A tall window: the board on top, at full size, nothing to scroll.
  context.innerWidth = 1280;
  context.innerHeight = 800;
  Coach.openConcept(conceptId, { lang: "en" });
  assert.strictEqual(all(dialog(), "is-beside").length, 0);
  assert.strictEqual(all(dialog(), "co-concept-board").length, 1);
  assert.strictEqual(first(dialog(), "modal-body").getAttribute("tabindex"), null, "a lesson that fits needs no extra tab stop");
  // A phone on its side: the board is beside the words and smaller.
  context.innerWidth = 844;
  context.innerHeight = 390;
  const scrolling = Object.getOwnPropertyDescriptor(FakeElement.prototype, "scrollHeight");
  Object.defineProperty(FakeElement.prototype, "scrollHeight", { configurable: true, get() { return this.classList.contains("modal-body") ? 500 : 0; } });
  Object.defineProperty(FakeElement.prototype, "clientHeight", { configurable: true, get() { return this.classList.contains("modal-body") ? 200 : 0; } });
  try {
    Coach.openConcept(conceptId, { lang: "en" });
    const modal = dialog();
    assert.strictEqual(all(modal, "is-beside").length, 1, "the words beside the board");
    const board = first(modal, "co-concept-board").children[0];
    assert.ok(Number(board.getAttribute("width")) <= 160, `a small board (${board.getAttribute("width")})`);
    // The body scrolls (its content is taller than it is): a keyboard reaches it and it has a name.
    const body = first(modal, "modal-body");
    assert.strictEqual(body.getAttribute("tabindex"), "0");
    assert.strictEqual(body.getAttribute("role"), "region");
    assert.ok(body.getAttribute("aria-label"));
  } finally {
    if (scrolling) Object.defineProperty(FakeElement.prototype, "scrollHeight", scrolling);
    else delete FakeElement.prototype.scrollHeight;
    delete FakeElement.prototype.clientHeight;
  }
});

test("renderDuel: who won, both players, one shared analysis", () => {
  const env = createEnv({ language: "en" });
  const { Coach, doc } = env;
  const el = doc.createElement("div");
  doc.body.appendChild(el);
  const ana = makeAnswer(env, { uci: "e2e4", san: "e4", name: "Ana" });
  const beto = Object.assign(makeAnswer(env, { uci: "a2a3", san: "a3", name: "Beto" }), { playerIndex: 1 });
  const context = makeContext(env, [ana, beto]);
  context.rewards = [{ xpGained: 60 }, null];
  Coach.renderDuel(el, context, { lang: "en", matchText: "Ana 10 - 2 Beto (max. 10 pts)" });
  const banner = first(el, "co-duel-banner");
  assert.ok(text(banner).includes("Ana") && text(banner).includes("Ana 10 - 2 Beto"), text(banner));
  assert.ok(first(banner, "co-duel-banner-title").hasAttribute("data-focus"));
  const players = all(el, "co-player");
  assert.strictEqual(players.length, 2);
  assert.ok(players[0].classList.contains("is-winner") && !players[1].classList.contains("is-winner"));
  assert.ok(text(players[0]).includes("Ana") && text(players[0]).includes("e4") && text(players[0]).includes("60"), "the winner's card");
  assert.ok(text(players[1]).includes("Beto") && text(players[1]).includes("a3"));
  assert.strictEqual(first(players[0], "co-player-avatar").getAttribute("aria-hidden"), "true");
  assert.ok(text(first(el, "co-compare")).includes("Ana") && text(first(el, "co-compare")).includes("Beto"), "the shared comparison names both");
  assert.ok(first(el, "co-lines") && first(el, "co-fact"));
  assert.strictEqual(all(el, "co-rewards").length, 0, "no experience card in a duel");
  // A tie has no crown; a player who did not move says so.
  const tie = makeContext(env, [makeAnswer(env, { uci: "e2e4", san: "e4", name: "Ana" }), Object.assign(makeAnswer(env, { uci: "e2e4", san: "e4", name: "Beto" }), { playerIndex: 1 })]);
  Coach.renderDuel(el, tie, { lang: "en" });
  assert.ok(first(el, "co-duel-banner").classList.contains("is-tie"));
  assert.strictEqual(all(el, "is-winner").length, 0);
  const silent = makeContext(env, [makeAnswer(env, { uci: "e2e4", san: "e4", name: "Ana" }), Object.assign(makeAnswer(env, { uci: null, noMoveReason: "timeout", name: "Beto" }), { playerIndex: 1 })]);
  Coach.renderDuel(el, silent, { lang: "en" });
  assert.ok(text(all(el, "co-player")[1]).length > 0);
  // A context without two answers draws nothing and does not throw.
  el.textContent = "keep";
  assert.doesNotThrow(() => Coach.renderDuel(el, makeContext(env, [ana]), {}));
  assert.strictEqual(text(el), "keep");
});

test("renderDots: a list of dots with words for each, or one picture when there are many", () => {
  const env = createEnv({ language: "en" });
  const { Coach, doc } = env;
  const el = doc.createElement("ol");
  doc.body.appendChild(el);
  Coach.renderDots(el, Coach.dotsModel({ total: 4, current: 2, rounds: [{ quality: "perfect", points: 10 }, { quality: "bad", points: 2 }], lang: "en" }));
  const dots = all(el, "co-dot");
  sameData(dots.map((dot) => dot.getAttribute("data-state")), ["hit", "miss", "current", "todo"]);
  assert.ok(dots.every((dot) => text(dot).length > 0), "each dot has its words (visually hidden by the stylesheet)");
  assert.strictEqual(el.getAttribute("role"), null);
  // Many positions: one image with a summary, the dots hidden from a screen reader.
  Coach.renderDots(el, Coach.dotsModel({ total: 30, current: 3, rounds: [], lang: "en" }));
  assert.strictEqual(all(el, "co-dot").length, 30);
  assert.strictEqual(el.getAttribute("role"), "img");
  assert.ok(el.getAttribute("aria-label").includes("30"));
  assert.ok(all(el, "co-dot").every((dot) => dot.getAttribute("aria-hidden") === "true" && text(dot) === ""));
  assert.ok(el.classList.contains("is-dense"));
  // And back: the picture role is removed.
  Coach.renderDots(el, Coach.dotsModel({ total: 3, current: 0, rounds: [], lang: "en" }));
  assert.strictEqual(el.getAttribute("role"), null);
  assert.ok(!el.classList.contains("is-dense"));
});

test("renderSummary: the hero, the mix of answers, the positions to reopen, the rewards", () => {
  const env = createEnv({ language: "en" });
  const { Coach, doc, Ludus } = env;
  const el = doc.createElement("div");
  doc.body.appendChild(el);
  const opened = [];
  const summary = Coach.summaryModel({
    record: RECORD, rounds: summaryRounds(), lang: "en",
    rewards: { xp: 240, cards: 2, unlocked: [{ id: "a", name: "First steps", description: "Your first game", glyph: "★" }], levelAfter: Ludus.Profile.levelFor(240), levelUp: true },
  });
  Coach.renderSummary(el, summary, { lang: "en", onOpenRound: (index) => opened.push(index) });
  assert.ok(first(el, "co-sum-title").hasAttribute("data-focus"));
  assert.ok(text(first(el, "co-sum-title")).length > 5, "a verdict on the session");
  const stats = text(first(el, "co-sum-stats"));
  assert.ok(stats.includes("21.5") && stats.includes("30") && stats.includes("2") && stats.includes("3"), stats);
  assert.ok(/3 min/.test(stats), "the duration");
  assert.strictEqual(all(el, "co-seg-part").length, 3);
  assert.strictEqual(all(el, "co-legend-item").length, 3);
  assert.ok(all(el, "co-legend-item").every((item) => text(item).length > 0), "every colour has a word and a glyph");
  assert.strictEqual(first(el, "co-seg").getAttribute("role"), "img");
  const positions = all(el, "co-pos");
  assert.strictEqual(positions.length, 3);
  assert.ok(positions.every((button) => button.tagName === "BUTTON" && button.getAttribute("aria-label")), "a real button with a name");
  positions[1].click();
  sameData(opened, [1], "reopens the analysis of that position");
  assert.ok(first(el, "co-sum-rewards") && text(first(el, "co-sum-rewards")).includes("240") && text(first(el, "co-sum-rewards")).includes("First steps"));
  assert.ok(text(first(el, "co-sum-rewards")).includes("2"), "the notebook cards");
  // No mention of the plain fallback text of the game core.
  assert.strictEqual(all(el, "summary-score-display").length, 0);
  // Nothing earned says so; a duel has no experience card; "no more positions" is said.
  Coach.renderSummary(el, Coach.summaryModel({ record: RECORD, rounds: summaryRounds(), lang: "en", noMorePositions: true }), { lang: "en" });
  assert.ok(text(first(el, "co-sum-rewards")).length > 0 && all(el, "co-achievement").length === 0);
  assert.ok(all(el, "co-note").some((note) => note.getAttribute("role") === "note"), "the note about running out of positions");
  const duelRounds = [{ index: 0, fen: START_FEN, side: "w", quality: "perfect", points: 10, hit: true, players: [{ name: "Ana", points: 10, quality: "perfect", accuracy: 100 }, { name: "Beto", points: 4, quality: "bad", accuracy: 40 }] }];
  const duel = Coach.summaryModel({ record: { kind: "classic", mode: "duel", positions: 1, maxPoints: 20, duel: { names: ["Ana", "Beto"], scores: [10, 4] } }, rounds: duelRounds, mode: "duel", lang: "en" });
  Coach.renderSummary(el, duel, { lang: "en" });
  assert.ok(text(first(el, "co-sum-title")).includes("Ana"), "the winner is the headline");
  assert.strictEqual(all(el, "co-sum-rewards").length, 0);
  assert.strictEqual(all(el, "co-sum-duelist").length, 2);
  assert.ok(all(el, "co-pos-duel").length === 2, "both scores under the position");
  // A draw.
  Coach.renderSummary(el, Coach.summaryModel({ record: { mode: "duel", positions: 1, maxPoints: 20, duel: { names: ["Ana", "Beto"], scores: [5, 5] } }, rounds: [], mode: "duel", lang: "en" }), { lang: "en" });
  assert.ok(text(first(el, "co-sum-title")).length > 0);
  assert.strictEqual(all(el, "co-pos").length, 0, "no positions, no grid");
});

test("renderSummaryActions: play again, review and share come and go, the home button stays", () => {
  const env = createEnv({ language: "en" });
  const { Coach, doc } = env;
  const el = doc.createElement("div");
  doc.body.appendChild(el);
  const home = doc.createElement("button");
  home.setAttribute("id", "summary-menu-btn");
  el.appendChild(home);
  const calls = [];
  const summary = Coach.summaryModel({ record: RECORD, rounds: summaryRounds(), lang: "en" });
  const api = { canReplay: true, canReview: true, onPlayAgain: () => calls.push("again"), onReview: () => calls.push("review"), onShare: () => calls.push("share") };
  Coach.renderSummaryActions(el, summary, api);
  const ids = () => findAll(el, (node) => node.tagName === "BUTTON").map((node) => node.getAttribute("id"));
  sameData(ids(), ["summary-again-btn", "summary-review-btn", "summary-share-btn", "summary-menu-btn"], "in this order, home last");
  assert.strictEqual(el.getAttribute("data-tail"), "odd", "review, share and home leave home alone on the last row: it takes the whole row");
  ["summary-again-btn", "summary-review-btn", "summary-share-btn"].forEach((id) => doc.getElementById(id).click());
  sameData(calls, ["again", "review", "share"]);
  // Drawing again does not duplicate them; what cannot be done is left out.
  Coach.renderSummaryActions(el, summary, { canReplay: false, canReview: false, onShare: () => {} });
  sameData(ids(), ["summary-share-btn", "summary-menu-btn"]);
  assert.strictEqual(el.getAttribute("data-tail"), "even", "share and home fill a row of two");
  Coach.renderSummaryActions(el, Coach.summaryModel({ record: { mode: "duel", positions: 1, duel: { names: ["A", "B"], scores: [1, 2] } }, rounds: [], mode: "duel", lang: "en" }), { canReplay: true, onPlayAgain: () => {} });
  assert.ok(/rematch/i.test(text(doc.getElementById("summary-again-btn"))), "a duel offers a rematch");
  assert.strictEqual(doc.getElementById("summary-menu-btn"), home, "the static home button is never rebuilt");
});

// ---------- The QA pass on the play screen ----------

test("verdict: a move as good as the best never claims to be the best (CNT-002)", () => {
  const env = createEnv({ language: "en" });
  const { Coach } = env;
  // d4 is listed second, 0.3 points of win chance below e4: inside the tolerance band, so "Perfect", but not the engine's first move.
  const second = makeContext(env, [makeAnswer(env, { uci: "d2d4", san: "d4" })], { master: null, masterName: "" });
  const answer = second.answers[0];
  assert.strictEqual(answer.assessment.qualityCode, "perfect");
  assert.strictEqual(answer.assessment.isBest, true, "inside the band");
  assert.strictEqual(Coach.verdictKey(second, answer).key, "coach.verdict.equivalent");
  ["en", "es"].forEach((lang) => {
    const sentence = Coach.verdictText(second, answer, lang);
    assert.ok(sentence.includes("e4"), `${lang}: names the move the engine lists first`);
    assert.ok(!/found the best move|encontraste la mejor/i.test(sentence), `${lang}: does not say that it was the best move: ${sentence}`);
  });
  // The same move as the master, while the engine prefers another by a hair.
  const master = makeContext(env, [makeAnswer(env, { uci: "d2d4", san: "d4" })], { master: { uci: "d2d4", san: "d4", score: 25, rank: 2 }, masterName: "Morphy" });
  const found = Coach.verdictKey(master, master.answers[0]);
  assert.strictEqual(found.key, "coach.verdict.masterSameEquivalent");
  assert.strictEqual(found.params.master, "Morphy");
  assert.strictEqual(found.params.best, "e4");
  assert.ok(!/: the best move\.$/.test(Coach.verdictText(master, master.answers[0], "en")));
  // When it really is the engine's first move the plain sentences stay.
  const best = makeContext(env, [makeAnswer(env, { uci: "e2e4", san: "e4" })], { master: { uci: "e2e4", san: "e4", score: 30 }, masterName: "Morphy" });
  assert.strictEqual(Coach.verdictKey(best, best.answers[0]).key, "coach.verdict.masterSame");
  // Brilliant and great have their own equivalents.
  const context = { best: { uci: "e2e4", san: "e4", score: 30 } };
  assert.strictEqual(Coach.verdictKey(context, { uci: "d2d4", assessment: { qualityCode: "brilliant" } }).key, "coach.verdict.brilliantEquivalent");
  assert.strictEqual(Coach.verdictKey(context, { uci: "d2d4", assessment: { qualityCode: "great" } }).key, "coach.verdict.greatEquivalent");
  assert.strictEqual(Coach.verdictKey(context, { uci: "e2e4", assessment: { qualityCode: "great" } }).key, "coach.verdict.great");
});

test("verdict: 'great' does not claim it was the only move (CNT-004) and 'dubious' needs an advantage to give up (CNT-008)", () => {
  const { Coach } = createEnv({ language: "en" });
  ["en", "es"].forEach((lang) => {
    const great = Coach.verdictText({ best: { uci: "e2e4", san: "e4", score: 30 } }, { uci: "e2e4", assessment: { qualityCode: "great" } }, lang);
    assert.ok(!/only one|única|the only/i.test(great), `${lang}: ${great}`);
    assert.ok(/worse|peores/i.test(great), `${lang}: says what the threshold measures (the rest were clearly worse)`);
  });
  const dubious = (score) => ({ context: { best: { uci: "e2e4", san: "e4", score } }, answer: { uci: "a2a3", assessment: { qualityCode: "dubious" } } });
  // An edge (+0.50 or more for the mover): the old sentence is true.
  assert.strictEqual(Coach.verdictKey(dubious(80).context, dubious(80).answer).key, "coach.verdict.dubious");
  // Level, or worse: there is no advantage to give up.
  [0, 30, -120].forEach((score) => assert.strictEqual(Coach.verdictKey(dubious(score).context, dubious(score).answer).key, "coach.verdict.dubiousNoEdge", `score ${score}`));
  // An unknown score does not assume an edge either.
  assert.strictEqual(Coach.verdictKey({ best: { uci: "e2e4", san: "e4" } }, dubious(0).answer).key, "coach.verdict.dubiousNoEdge");
  ["en", "es"].forEach((lang) => assert.ok(!/advantage|ventaja/i.test(Coach.verdictText(dubious(0).context, dubious(0).answer, lang))));
});

test("a missed mate that still wins is said so: the sentence, the title and the bars agree (CNT-007)", () => {
  const env = createEnv({ language: "en" });
  const { Coach, doc, Ludus } = env;
  const el = doc.createElement("div");
  doc.body.appendChild(el);
  // Best is mate in 3; the answer keeps +8.94 (a 96% win chance) but is not a mate.
  const mateLines = [{ uci: "e2e4", score: Ludus.Scoring.encodeScore({ type: "mate", value: 3 }) }, { uci: "d2d4", score: 894 }, { uci: "a2a3", score: -300 }];
  const winning = makeContext(env, [makeAnswer(env, { uci: "d2d4", san: "d4", lines: mateLines })], { best: { uci: "e2e4", san: "Qh4+", score: mateLines[0].score }, master: null, masterName: "" });
  const answer = winning.answers[0];
  assert.strictEqual(answer.assessment.reason, "missed_mate");
  assert.ok(answer.assessment.points < 10, "a missed mate is never worth full points");
  const found = Coach.verdictKey(winning, answer, "en");
  assert.strictEqual(found.key, "coach.verdict.missedMateWinning");
  assert.strictEqual(found.params.eval, "+8.94");
  assert.strictEqual(Coach.verdictKey(winning, answer, "es").params.eval, "+8,94", "the decimal comma");
  assert.ok(/still winning/.test(Coach.verdictText(winning, answer, "en")) && /Seguías ganando/.test(Coach.verdictText(winning, answer, "es")));
  Coach.renderRound(el, winning, { lang: "en" });
  // The title keeps the one vocabulary of the quality ladder (Scoring); the fact that it was a missed mate is a chip.
  assert.ok(text(first(el, "co-hero-title")).includes(Coach.qualityInfo(answer.assessment.qualityCode, "en").label));
  assert.ok(/Missed mate/.test(text(first(el, "co-chips"))), text(first(el, "co-chips")));
  const bars = all(first(el, "co-compare"), "co-bar-pct").map(text);
  assert.ok(bars.includes("96%") && bars.includes("100%"), `the bars show what the sentence says: ${bars}`);
  // A missed mate that throws the win away keeps the plain wording.
  const lost = makeContext(env, [makeAnswer(env, { uci: "a2a3", san: "a3", lines: mateLines })], { best: { uci: "e2e4", san: "Qh4+", score: mateLines[0].score }, master: null, masterName: "" });
  assert.strictEqual(Coach.verdictKey(lost, lost.answers[0], "en").key, "coach.verdict.missed_mate");
  Coach.renderRound(el, lost, { lang: "en" });
  assert.ok(/Missed mate/.test(text(first(el, "co-chips"))));
  // An assessment stored before Scoring set the flag is judged from the score of the move.
  const legacy = { uci: "d2d4", userScore: 894, assessment: { reason: "missed_mate", qualityCode: "blunder" } };
  assert.strictEqual(Coach.verdictKey({ best: { san: "Qh4+" } }, legacy, "en").key, "coach.verdict.missedMateWinning");
});

test("compare card: the note adds up with the bars it sits under, says what a win chance is and whose move was whose (CNT-012, UX-016)", () => {
  const env = createEnv({ language: "en" });
  const { Coach, doc, Ludus } = env;
  const el = doc.createElement("div");
  doc.body.appendChild(el);
  // Scores whose win chances round apart: 67.4 and 61.6 -> bars 67% and 62%, the raw gap 5.8 used to print "6".
  const lines = [{ uci: "e2e4", score: 240 }, { uci: "d2d4", score: 200 }, { uci: "a2a3", score: 185 }, { uci: "h2h3", score: -100 }];
  [["a2a3", "a3"], ["h2h3", "h3"]].forEach(([uci, san]) => {
    const context = makeContext(env, [makeAnswer(env, { uci, san, lines })], { best: { uci: "e2e4", san: "e4", score: 240 }, master: null, masterName: "" });
    Coach.renderRound(el, context, { lang: "en" });
    const bars = all(first(el, "co-compare"), "co-bar-pct").map(text).map((value) => Number(value.replace("%", "")));
    const note = all(first(el, "co-compare"), "co-cmp-note").map(text).find((value) => /win chance/.test(value));
    const match = /from (\d+)% to (\d+)% \((\d+) percentage points? less/.exec(note || "");
    assert.ok(match, `the loss note says where it goes from and to: ${note}`);
    const [best, user, gap] = match.slice(1).map(Number);
    assert.strictEqual(gap, best - user, "the percentage points are the difference of the two numbers printed (never plain \"points\": that word is the 0-10 score)");
    assert.deepStrictEqual([best, user], [Math.round(Ludus.Scoring.winPercent(240)), Math.round(Ludus.Scoring.winPercent(uci === "a2a3" ? 185 : -100))]);
    assert.ok(bars.includes(best) && bars.includes(user), "and they are the numbers of the bars");
  });
  // A move inside the tolerance band says "as good as the best", with no loss.
  const equal = makeContext(env, [makeAnswer(env, { uci: "d2d4", san: "d4" })], { master: null, masterName: "" });
  Coach.renderRound(el, equal, { lang: "en" });
  const notes = all(first(el, "co-compare"), "co-cmp-note").map(text);
  assert.ok(notes.some((value) => /as good as the best/i.test(value)), notes.join(" | "));
  assert.ok(!notes.some((value) => /drops from/.test(value)));
  // "Win chance" and the signed numbers are explained in a disclosure that a touch can open, and it stays open.
  const button = first(first(el, "co-compare"), "co-help-btn");
  const body = first(first(el, "co-compare"), "co-help-body");
  assert.ok(button && body && button.tagName === "BUTTON", "a real button");
  assert.strictEqual(button.getAttribute("aria-expanded"), "false");
  assert.strictEqual(button.getAttribute("aria-controls"), body.getAttribute("id"));
  assert.ok(body.hasAttribute("hidden"));
  assert.ok(/estimate, not a real probability/.test(text(body)) && /positive favors you/.test(text(body)), text(body));
  button.click();
  assert.strictEqual(button.getAttribute("aria-expanded"), "true");
  assert.ok(!body.hasAttribute("hidden") || body.hidden === false);
  Coach.renderRound(el, equal, { lang: "en" });
  assert.strictEqual(first(first(el, "co-compare"), "co-help-btn").getAttribute("aria-expanded"), "true", "drawn again (next position) it is still open");
  first(first(el, "co-compare"), "co-help-btn").click();
  // Stockfish and its depth are explained too.
  assert.ok(/Stockfish is the chess program/.test(text(first(el, "co-lines"))));
  // Whose move was it: the master's, or the one of the person's own game.
  const named = makeContext(env, [makeAnswer(env, { uci: "e2e4", san: "e4" })], { master: { uci: "d2d4", san: "d4", score: 25, rank: 2 }, masterName: "Morphy" });
  Coach.renderRound(el, named, { lang: "en" });
  assert.ok(text(first(el, "co-compare")).includes("Morphy's move was the engine's 2nd choice."));
  const own = makeContext(env, [makeAnswer(env, { uci: "e2e4", san: "e4" })], { master: { uci: "d2d4", san: "d4", score: 25, rank: 2 }, masterName: "" });
  Coach.renderRound(el, own, { lang: "en" });
  assert.ok(text(first(el, "co-compare")).includes("The move from your game was the engine's 2nd choice."));
  const out = makeContext(env, [makeAnswer(env, { uci: "e2e4", san: "e4" })], { master: { uci: "c2c3", san: "c3", score: -40 }, masterName: "" });
  Coach.renderRound(el, out, { lang: "en" });
  assert.ok(/from your game was not among the engine's top choices/.test(text(first(el, "co-compare"))));
});

test("the position card keeps its idea to itself until the answer is in (UX-017)", () => {
  const env = createEnv({ language: "en" });
  const { Coach, doc, Ludus } = env;
  const el = doc.createElement("div");
  doc.body.appendChild(el);
  const position = { fen: START_FEN, source: "classic", meta: { event: "Opera game", players: "Morphy, Paul vs Duke", year: 1858, moveNumber: 10, sideToMove: "w" }, classic: { kind: "sacrifice", note: { en: "x", es: "y" } } };
  const model = Coach.positionModel({ position, session: { kind: "classic" }, lang: "en" });
  assert.ok(model.kind && model.kind.label, "the model still knows the kind (the result uses it)");
  Coach.renderThinking(el, model, {});
  const thinking = text(el);
  assert.ok(!thinking.includes(Ludus.Classics.kindLabel("sacrifice", "en")), "no kind chip before the move");
  assert.ok(!thinking.includes(Ludus.Classics.kindHint("sacrifice", "en")), "no sentence about what the position is about");
  assert.ok(thinking.includes("Opera game") && thinking.includes("10"), "the event and the move number stay");
  // After the answer the theme is told, with its sentence.
  const context = makeContext(env, [makeAnswer(env, { uci: "e2e4", san: "e4" })], { classicKind: "sacrifice" });
  Coach.renderRound(el, context, { lang: "en" });
  const why = text(first(el, "co-why"));
  assert.ok(why.includes(Ludus.Classics.kindLabel("sacrifice", "en")) && why.includes(Ludus.Classics.kindHint("sacrifice", "en")), why);
  // No kind, no line (own games).
  Coach.renderRound(el, makeContext(env, [makeAnswer(env, { uci: "e2e4", san: "e4" })]), { lang: "en" });
  assert.strictEqual(all(el, "co-theme").length, 0);
  // The "only move" sentence makes no claim the engine's numbers can contradict.
  assert.ok(!/only one move keeps/i.test(Ludus.Classics.kindHint("only-move", "en")) && !/solo una jugada mantiene/i.test(Ludus.Classics.kindHint("only-move", "es")));
});

test("the backup engine is said next to the score, and first in the thinking panel (VIS-014)", () => {
  const env = createEnv({ language: "en" });
  const { Coach, doc } = env;
  const el = doc.createElement("div");
  doc.body.appendChild(el);
  const model = Coach.positionModel({ position: { fen: START_FEN, meta: {} }, session: { kind: "classic" }, lang: "en" });
  Coach.renderThinking(el, model, { backupEngine: true });
  assert.ok(el.children[0].classList.contains("co-note-warn"), "the notice is the first row of the panel, above the fold on a phone");
  const context = makeContext(env, [makeAnswer(env, { uci: "e2e4", san: "e4" })], { engine: { source: "local", depth: 3 } });
  Coach.renderRound(el, context, { lang: "en" });
  assert.ok(/Backup engine: estimate/.test(text(first(el, "co-chips"))), "a chip in the hero, visible in the collapsed sheet");
  Coach.renderRound(el, makeContext(env, [makeAnswer(env, { uci: "e2e4", san: "e4" })]), { lang: "en" });
  assert.ok(!/Backup engine/.test(text(first(el, "co-chips"))));
});

test("a duel summary keeps the two players apart: their own points, hits and moves, and one review button each (UX-020)", () => {
  const env = createEnv({ language: "en" });
  const { Coach, doc } = env;
  const el = doc.createElement("div");
  doc.body.appendChild(el);
  const rounds = [
    { index: 0, fen: START_FEN, side: "w", quality: "perfect", points: 10, hit: true, players: [{ name: "Ana", points: 10, quality: "perfect", accuracy: 100, hit: true }, { name: "Beto", points: 1, quality: "blunder", accuracy: 10, hit: false }] },
    { index: 1, fen: START_FEN, side: "w", quality: "good", points: 8, hit: true, players: [{ name: "Ana", points: 8, quality: "good", accuracy: 80, hit: true }, { name: "Beto", points: 2, quality: "bad", accuracy: 20, hit: false }] },
  ];
  const summary = Coach.summaryModel({
    record: { kind: "classic", mode: "duel", positions: 2, maxPoints: 40, points: 21, durationMs: 60000, byQuality: { perfect: 1, good: 1, blunder: 1, bad: 1 }, duel: { names: ["Ana", "Beto"], scores: [18, 3] } },
    rounds, mode: "duel", lang: "en",
    rewards: { players: [{ xp: 150, unlocked: [{ id: "a", name: "First steps" }] }, { xp: 0, unlocked: [] }] },
  });
  const players = summary.duel.players;
  assert.strictEqual(players.length, 2);
  assert.deepStrictEqual([players[0].hits, players[0].total, players[1].hits, players[1].total], [2, 2, 0, 2]);
  assert.strictEqual(players[0].accuracy, 90);
  sameData(players[1].segments.map((segment) => segment.code).sort(), ["bad", "blunder"], "each has their own mix, not the merged one");
  Coach.renderSummary(el, summary, { lang: "en" });
  const hero = text(first(el, "co-sum-hero"));
  assert.ok(!/points/i.test(hero) && !/hits|correct/i.test(hero), `no merged points or hits over two people: ${hero}`);
  assert.ok(hero.includes("Ana wins") && hero.includes("1 min"), "the winner, the time");
  const cards = all(el, "co-sum-duelist");
  assert.strictEqual(cards.length, 2);
  assert.ok(text(cards[0]).includes("2 of 2 correct") && text(cards[1]).includes("0 of 2 correct"), "hits per player");
  assert.ok(text(cards[0]).includes("+150 XP") && text(cards[0]).includes("First steps"), "what Ana earned, on Ana's card");
  assert.ok(!text(cards[1]).includes("First steps"));
  assert.strictEqual(all(cards[0], "co-seg").length, 1, "a bar of her own");
  assert.strictEqual(all(el, "co-breakdown").length, 0, "no merged bar");
  assert.ok(el.classList.contains("co-summary-duel"));
  assert.ok(!/sum-rewards/.test(el.children.map((child) => child.getAttribute("class")).join(" ")), "no experience card");
  // One review button per profile player, each calling back with that profile.
  const actions = doc.createElement("div");
  const home = doc.createElement("button");
  home.setAttribute("id", "summary-menu-btn");
  actions.appendChild(home);
  doc.body.appendChild(actions);
  const reviewed = [];
  Coach.renderSummaryActions(actions, summary, {
    canReplay: true, canReview: true, onReview: (id) => reviewed.push(id), onPlayAgain: () => {}, onShare: () => {},
    reviewPlayers: [{ name: "Ana", profileId: "p_ana" }, { name: "Beto", profileId: "p_beto" }],
  });
  const buttons = findAll(actions, (node) => node.tagName === "BUTTON").map((node) => [node.getAttribute("id"), text(node)]);
  assert.deepStrictEqual(buttons.map((entry) => entry[0]), ["summary-again-btn", "summary-review-btn-1", "summary-review-btn-2", "summary-share-btn", "summary-menu-btn"]);
  assert.ok(buttons[1][1].includes("Ana") && buttons[2][1].includes("Beto"));
  doc.getElementById("summary-review-btn-2").click();
  doc.getElementById("summary-review-btn-1").click();
  assert.deepStrictEqual(reviewed, ["p_beto", "p_ana"]);
  assert.strictEqual(actions.getAttribute("data-tail"), "even");
  // Only the players who have cards get a button; nobody: none (the single button of the active profile is for solo).
  Coach.renderSummaryActions(actions, summary, { canReplay: false, canReview: true, onReview: () => {}, reviewPlayers: [{ name: "Ana", profileId: "p_ana" }] });
  assert.deepStrictEqual(findAll(actions, (node) => node.tagName === "BUTTON").map((node) => node.getAttribute("id")), ["summary-review-btn-1", "summary-share-btn", "summary-menu-btn"]);
  Coach.renderSummaryActions(actions, summary, { canReplay: false, canReview: true, onReview: () => {}, reviewPlayers: [] });
  assert.deepStrictEqual(findAll(actions, (node) => node.tagName === "BUTTON").map((node) => node.getAttribute("id")), ["summary-share-btn", "summary-menu-btn"]);
  // Share text: the match, not a merged mix.
  assert.ok(!/blunder|perfect/i.test(Coach.shareText(summary, "en")));
});

test("a duel round card lists what its own player earned: celebrations live in the panel, not in a toast (VIS-008, UX-019)", () => {
  const env = createEnv({ language: "en" });
  const { Coach, doc, Ludus } = env;
  const el = doc.createElement("div");
  doc.body.appendChild(el);
  const ana = makeAnswer(env, { uci: "e2e4", san: "e4", name: "Ana" });
  const beto = Object.assign(makeAnswer(env, { uci: "a2a3", san: "a3", name: "Beto" }), { playerIndex: 1 });
  const context = makeContext(env, [ana, beto]);
  context.rewards = [{ xpGained: 60, level: Ludus.Profile.levelFor(400), levelUp: true, card: null, unlocked: [{ id: "a", name: "First steps" }] }, null];
  Coach.renderDuel(el, context, { lang: "en" });
  const cards = all(el, "co-player");
  assert.ok(text(cards[0]).includes("Level up!") && text(cards[0]).includes("Achievement unlocked: First steps"), text(cards[0]));
  assert.ok(!text(cards[1]).includes("Level up!"));
  // The solo card lists them as it always did.
  const solo = makeContext(env, [makeAnswer(env, { uci: "e2e4", san: "e4" })]);
  solo.rewards = context.rewards.slice(0, 1);
  Coach.renderRound(el, solo, { lang: "en" });
  assert.ok(text(first(el, "co-rewards")).includes("Level up!") && text(first(el, "co-rewards")).includes("First steps"));
});

test("the summary is laid out in regions a wide screen can fill: verdict and mix, rewards, then the positions as a row (VIS-017)", () => {
  const env = createEnv({ language: "en" });
  const { Coach, doc } = env;
  const el = doc.createElement("div");
  doc.body.appendChild(el);
  Coach.renderSummary(el, Coach.summaryModel({ record: RECORD, rounds: summaryRounds(), lang: "en", rewards: { xp: 10, cards: 0, unlocked: [] } }), { lang: "en" });
  const regions = el.children.map((child) => child.getAttribute("class"));
  assert.deepStrictEqual(regions, ["co-sum-col co-sum-main", "co-sum-col co-sum-aside", "co-sum-positions"].map((value) => value), regions.join(" | "));
  assert.ok(first(first(el, "co-sum-main"), "co-sum-hero") && first(first(el, "co-sum-main"), "co-breakdown"), "the verdict and the mix together");
  assert.ok(first(first(el, "co-sum-aside"), "co-sum-rewards"), "the rewards on their own");
  assert.strictEqual(all(first(el, "co-sum-positions"), "co-pos").length, 3);
  assert.ok(!el.classList.contains("co-summary-duel"), "drawn again as a solo summary it is no longer a duel layout");
});

test("the quality glyph is never tiny and the scroll region has an inset focus ring (VIS-015, A11Y-009)", () => {
  const css = fs.readFileSync(path.join(repoRoot, "css/coach.css"), "utf8");
  const glyph = /\.co-glyph \{([^}]*)\}/.exec(css);
  assert.ok(glyph && /font-size:\s*max\(0\.6875rem/.test(glyph[1]), "at least 11px: it was 0.5em of the parent, 7.5px in the legend");
  assert.ok(!/font-size:\s*0\.5em/.test(glyph[1]));
  // The ring is drawn inside the clipped panel through the --focus-ring-offset custom property (an outline-offset declared here never applied,
  // see the PL-4 test below), and the fade does not cut it.
  const ring = /\.co-scroll:focus-visible \{([^}]*)\}/.exec(css);
  assert.ok(ring && /--focus-ring-offset:\s*-\d/.test(ring[1]) && /mask-image:\s*none/.test(ring[1]), "the ring is drawn inside the clipped panel and the fade does not cut it");
});

test("every move the coach shows goes through Ludus.chess.localizeSan: Spanish letters for Spanish readers, the stored SAN stays English", () => {
  const env = createEnv({ language: "es" });
  const { Coach, doc, Ludus } = env;
  const el = doc.createElement("div");
  doc.body.appendChild(el);
  const lines = [{ uci: "g1f3", score: 40 }, { uci: "e2e4", score: 35 }, { uci: "a2a3", score: -20 }];
  const answer = makeAnswer(env, { uci: "a2a3", san: "a3", lines });
  const context = makeContext(env, [answer], {
    best: { uci: "g1f3", san: "Nf3", score: 40 }, master: { uci: "e2e4", san: "e4", score: 35, rank: 2 }, masterName: "Morphy",
    lines: [
      { uci: "g1f3", san: "Nf3", score: 40, rank: 1, isBest: true, pvSan: ["Nf3", "Nc6", "Bb5"] },
      { uci: "e2e4", san: "e4", score: 35, rank: 2, isMaster: true, pvSan: ["e4", "e5"] },
    ],
  });
  Coach.renderRound(el, context, { lang: "es" });
  const cmp = text(first(el, "co-compare"));
  assert.ok(cmp.includes("Cf3") && !cmp.includes("Nf3"), `the best move in Spanish letters: ${cmp}`);
  assert.ok(text(first(el, "co-hero-verdict")).includes("Cf3"), "and in the sentence that names it");
  const lineText = text(first(el, "co-lines"));
  assert.ok(lineText.includes("Cf3") && lineText.includes("Ab5"), `the line and its moves: ${lineText}`);
  // What a screen reader gets is the move in words, not "C f 3" (Ludus.chess.spokenSan; PL-6 below covers both notation settings).
  assert.ok(all(el, "co-line")[0].getAttribute("aria-label").includes("caballo a f3") && !all(el, "co-line")[0].getAttribute("aria-label").includes("Cf3"));
  // English readers, and a Spanish page that asks for English notation, see the stored letters.
  Coach.renderRound(el, context, { lang: "en" });
  assert.ok(text(first(el, "co-compare")).includes("Nf3"));
  Ludus.Settings.set("notation.style", "english");
  Coach.renderRound(el, context, { lang: "es" });
  assert.ok(text(first(el, "co-compare")).includes("Nf3"), "the notation setting wins over the language");
  Ludus.Settings.set("notation.style", "auto");
  // A build without the helper shows the stored text and never throws.
  const helper = Ludus.chess.localizeSan;
  delete Ludus.chess.localizeSan;
  try {
    Coach.renderRound(el, context, { lang: "es" });
    assert.ok(text(first(el, "co-compare")).includes("Nf3"));
  } finally {
    Ludus.chess.localizeSan = helper;
  }
  // A duel card shows the move of each player the same way.
  const ana = makeAnswer(env, { uci: "g1f3", san: "Nf3", name: "Ana", lines });
  const beto = Object.assign(makeAnswer(env, { uci: "a2a3", san: "a3", name: "Beto", lines }), { playerIndex: 1 });
  Coach.renderDuel(el, makeContext(env, [ana, beto]), { lang: "es" });
  assert.ok(text(all(el, "co-player")[0]).includes("Cf3"));
});

// ---------- The polish pass on the play screen (PL-1 .. PL-6) ----------

test("verdict: every sentence agrees with the quality ladder of Scoring.qualityLabel and with the only-move rule (PL-1)", () => {
  ["en", "es"].forEach((lang) => {
    const { Coach, Ludus } = createEnv({ language: lang });
    const best = { uci: "e2e4", san: "e4", score: 150 };
    const sentence = (code) => Coach.verdictText({ best }, { uci: "a2a3", assessment: { qualityCode: code } }, lang);
    const label = (code) => Ludus.Scoring.qualityLabel(code, lang).toLowerCase();
    // "Interesting, but X was clearly better" said a positive word for a clear loss: the sentence now says what the label says.
    const inaccuracy = sentence("interesting");
    assert.ok(!/interesting|interesante/i.test(inaccuracy), `${lang}: no positive word for a loss: ${inaccuracy}`);
    assert.ok(inaccuracy.toLowerCase().includes(label("interesting").slice(0, 6)), `${lang}: it names the label (${label("interesting")}): ${inaccuracy}`);
    assert.ok(inaccuracy.includes("e4"), "and the better move");
    // A mistake and a serious mistake are called that, in the words of the label.
    assert.ok(sentence("bad").toLowerCase().includes(label("bad")), `${lang}: ${sentence("bad")}`);
    assert.ok(sentence("blunder").toLowerCase().includes(label("blunder")), `${lang}: ${sentence("blunder")}`);
    assert.ok(sentence("dubious").toLowerCase().includes(label("dubious").slice(0, 5)), `${lang}: ${sentence("dubious")}`);
    // "Clearly better" is for the labels below the inaccuracy: a good move, a very good one and an inaccuracy are not clear losses.
    ["very_good", "good", "interesting"].forEach((code) => assert.ok(!/clearly|claramente/i.test(sentence(code)), `${lang} ${code}: ${sentence(code)}`));
    // The sentence of each answer of the ladder is its own (nothing repeats between neighbours).
    const ladder = ["perfect", "very_good", "good", "interesting", "dubious", "bad", "blunder"].map(sentence);
    assert.strictEqual(new Set(ladder).size, ladder.length, `${lang}: one sentence per rung`);
    // The labels the person reads are the ones of Scoring, not a second vocabulary kept here.
    Coach.QUALITY_CODES.forEach((code) => assert.strictEqual(Coach.qualityInfo(code, lang).label, Ludus.Scoring.qualityLabel(code, lang), `${lang} ${code}`));
  });
  // "Great move" is said exactly when Scoring says only move: every other line at least ONLY_MOVE_GAP_PCT of win chance worse.
  const env = createEnv({ language: "en" });
  const { Scoring } = env.Ludus;
  const gap = Scoring.CONSTANTS.ONLY_MOVE_GAP_PCT;
  const bestScore = 200;
  let second = bestScore;
  while (Scoring.winPercent(bestScore) - Scoring.winPercent(second) < gap) second -= 5;
  const verdictFor = (secondScore) => {
    const lines = [{ uci: "e2e4", score: bestScore }, { uci: "d2d4", score: secondScore }, { uci: "a2a3", score: secondScore - 300 }];
    const answer = makeAnswer(env, { uci: "e2e4", san: "e4", lines });
    const context = makeContext(env, [answer], { best: { uci: "e2e4", san: "e4", score: bestScore }, master: null, masterName: "" });
    return { answer, key: env.Coach.verdictKey(context, answer).key };
  };
  const atGap = verdictFor(second);
  assert.strictEqual(atGap.answer.assessment.onlyMove, true, "every other line is at least the gap worse");
  assert.strictEqual(atGap.key, "coach.verdict.great");
  const justShort = verdictFor(second + 5);
  assert.strictEqual(justShort.answer.assessment.onlyMove, false, "one step closer is not an only move");
  assert.notStrictEqual(justShort.key, "coach.verdict.great", "and the sentence about every other move being worse is not shown");
  ["en", "es"].forEach((lang) => {
    const { Coach } = createEnv({ language: lang });
    ["great", "greatEquivalent"].forEach((key) => {
      const sentence = Coach.TEXT[lang][`coach.verdict.${key}`];
      assert.ok(/worse|peores/.test(sentence) && !/only (one|move)|única|solo una/i.test(sentence), `${lang} ${key}: says what the rule measures (the others were clearly worse), not "the only move that keeps the position": ${sentence}`);
    });
  });
});

test("every tag Insights can emit has a picture: the kit's, or one drawn here in the same style, always decorative (PL-2)", () => {
  const { Coach, Ludus } = createEnv({ language: "en" });
  const kitNames = new Set(Ludus.ui.iconNames());
  assert.ok(kitNames.size > 20 && Ludus.Insights.TAGS.length >= 22, "the lists exist");
  ["loses_material", "tactic_available"].forEach((tag) => assert.ok(Ludus.Insights.TAGS.includes(tag), `${tag} is a tag of Insights`));
  Ludus.Insights.TAGS.concat(["other"]).forEach((tag) => {
    const found = Coach.insightIconFor(tag);
    assert.ok(found, `the tag ${tag} has an icon`);
    // The kit draws nothing for a name it does not have (an empty, invisible svg): the name has to exist there.
    if (found.source === "kit") assert.ok(kitNames.has(found.name), `${tag}: the kit has no icon called ${found.name}`);
    const node = Coach.insightIcon(tag, 18);
    assert.strictEqual(node.getAttribute("aria-hidden"), "true", `${tag}: decorative, the sentence carries the meaning`);
    assert.strictEqual(node.getAttribute("stroke"), "currentColor", `${tag}: follows the text colour in every theme`);
    assert.ok(findAll(node, (el) => el.tagName === "PATH" || el.tagName === "CIRCLE" || el.tagName === "RECT").length > 0, `${tag}: something is drawn`);
    assert.strictEqual(String(node.getAttribute("width")), "18");
  });
  assert.strictEqual(Coach.insightIconFor("not_a_tag"), null, "an unknown tag is reported, not hidden");
  // The two the kit has no picture for are drawn here in the kit's style (24 grid, 1.75 stroke, round joins).
  ["loses_material", "tactic_available"].forEach((tag) => {
    assert.strictEqual(Coach.insightIconFor(tag).source, "local");
    const node = Coach.insightIcon(tag, 18);
    assert.strictEqual(node.getAttribute("viewBox"), "0 0 24 24");
    assert.strictEqual(String(node.getAttribute("stroke-width")), "1.75");
    assert.strictEqual(node.getAttribute("stroke-linecap"), "round");
    assert.ok(node.classList.contains("ui-icon"));
  });
  // And the card puts it next to the sentence: a message of each of the two tags draws its own picture, not the "info" fallback.
  const env = createEnv({ language: "en" });
  const el = env.doc.createElement("div");
  env.doc.body.appendChild(el);
  ["loses_material", "tactic_available"].forEach((tag) => {
    const answer = makeAnswer(env, { uci: "a2a3", san: "a3" });
    answer.insights = { tags: [tag], messages: [{ key: `insight.${tag}`, params: { san: "a3", best: "e4", n: 3 }, tag, raw: { san: "a3", best: "e4", n: 3 } }], conceptIds: [], phase: null, verdict: "unknown", texts: [] };
    Coach.renderRound(el, makeContext(env, [answer]), { lang: "en" });
    const icon = first(first(el, "co-insight"), "co-insight-icon");
    assert.ok(icon, `${tag}: an insight row is drawn`);
    assert.ok(findAll(icon, (node) => node.tagName === "SVG" && node.classList.contains(`ui-icon-${tag.replace(/_/g, "-")}`)).length === 1, `${tag}: its own picture`);
  });
});

test("renderTurn: a long name gets the ellipsis, the side to move is never shortened (PL-3)", () => {
  ["es", "en"].forEach((lang) => {
    const env = createEnv({ language: lang });
    const { Coach, doc } = env;
    const name = "Maximiliano Alejandro Pe"; // 24 characters, the longest a profile can have
    assert.strictEqual(name.length, 24);
    const sentence = lang === "es" ? `${name} juega con las blancas` : `${name} plays White`;
    const side = lang === "es" ? "juega con las blancas" : "plays White";
    const el = doc.createElement("span");
    Coach.renderTurn(el, { text: sentence, name });
    const nameNode = all(el, "co-turn-name");
    const sideNode = all(el, "co-turn-side");
    assert.strictEqual(nameNode.length, 1);
    assert.strictEqual(sideNode.length, 1);
    assert.strictEqual(nameNode[0].textContent, name);
    assert.strictEqual(nameNode[0].getAttribute("title"), name, "the whole name is one hover away");
    assert.strictEqual(sideNode[0].textContent, side, "the side to move is its own piece of text");
    assert.strictEqual(el.textContent, sentence, "and what a screen reader reads is the whole sentence, name first, with its spaces");
    // Drawn again it replaces what was there; a sentence that does not contain the name is shown as it is.
    Coach.renderTurn(el, { text: sentence, name });
    assert.strictEqual(all(el, "co-turn-name").length, 1);
    Coach.renderTurn(el, { text: "Ana plays White", name: "Zed" });
    assert.strictEqual(el.textContent, "Ana plays White");
    assert.strictEqual(all(el, "co-turn-name").length, 0);
    // A template that puts words before the name keeps them too.
    Coach.renderTurn(el, { text: "Now Ana plays White", name: "Ana" });
    assert.deepStrictEqual(all(el, "co-turn-side").map((node) => node.textContent), ["Now", "plays White"]);
    assert.strictEqual(el.textContent, "Now Ana plays White");
  });
  // The CSS that makes it so: only the name shrinks and ends in an ellipsis, the side never does.
  const css = fs.readFileSync(path.join(repoRoot, "css/coach.css"), "utf8");
  const name = /\.co-turn-name \{([^}]*)\}/.exec(css);
  const side = /\.co-turn-side \{([^}]*)\}/.exec(css);
  assert.ok(name && /text-overflow:\s*ellipsis/.test(name[1]) && /min-width:\s*0/.test(name[1]) && /overflow:\s*hidden/.test(name[1]), "the name can shrink to an ellipsis");
  assert.ok(side && /flex:\s*none/.test(side[1]) && !/ellipsis|overflow/.test(side[1]), "the side keeps its full width");
  assert.ok(/\.co-turn-text:has\(\.co-turn-name\) \{[^}]*display:\s*flex/.test(css) && /\.co-turn-text:has\(\.co-turn-name\) \{[^}]*text-overflow:\s*clip/.test(css), "the line is a flex row only when it names a player (the old ellipsis no longer eats the side)");
  // And the game core draws the duel's line through it.
  const app = fs.readFileSync(path.join(repoRoot, "app.js"), "utf8");
  assert.ok(/coach\.renderTurn\(roundTurnEl, \{ text: sentence, name: player \}\)/.test(app), "app.js hands the sentence and the name to the coach");
});

test("focus rings: the play screen sets --focus-ring-offset on the focused state; an outline-offset there never applied (PL-4)", () => {
  const css = fs.readFileSync(path.join(repoRoot, "css/coach.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const global = fs.readFileSync(path.join(repoRoot, "styles.css"), "utf8");
  assert.ok(/outline-offset:\s*var\(--focus-ring-offset\)/.test(global), "the global ring reads the variable (the pattern depends on it)");
  const rules = Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g), (m) => ({ selector: m[1].trim(), body: m[2] }));
  rules.forEach((rule) => {
    if (/:focus-visible/.test(rule.selector)) {
      // (0,2,0) here against (0,3,0) there: the declaration is dead code that looks like it works.
      assert.ok(!/outline-offset\s*:/.test(rule.body), `${rule.selector} declares an outline-offset that the global :focus-visible rule overrides: set --focus-ring-offset`);
      assert.ok(!/(^|[;\s])outline\s*:/.test(rule.body), `${rule.selector} does not redeclare the ring`);
    }
    // A custom property is inherited: set on a region it would inset the rings of everything inside. It lives on the focused state only.
    if (/--focus-ring-offset\s*:/.test(rule.body)) assert.ok(/:focus-visible/.test(rule.selector), `${rule.selector} sets --focus-ring-offset outside a :focus-visible state`);
  });
  // The elements whose ring was clipped by an overflow:hidden parent draw it inside.
  [[".co-scroll:focus-visible", -3], [".co-handoff:focus-visible", -6], [".co-expand:focus-visible", -3]].forEach(([selector, offset]) => {
    const rule = rules.find((entry) => entry.selector === selector);
    assert.ok(rule, `${selector} has a rule`);
    const match = /--focus-ring-offset:\s*(-?\d+)px/.exec(rule.body);
    assert.ok(match && Number(match[1]) === offset, `${selector} draws its ring inside (${offset}px)`);
  });
});

test("text: one name per concept, American English, voseo and the right plural forms in what the coach says (PL-5, CNT-025, CNT-029..034)", () => {
  const { Coach, Ludus } = createEnv({ language: "en" });
  const en = Object.values(Coach.TEXT.en).join("\n");
  const es = Object.values(Coach.TEXT.es).join("\n");
  assert.ok(!/winning chances?|\bodds\b|win probability|chance of winning/i.test(en), "win chance, never winning chances or odds");
  assert.ok(!/colour|favour|centre|defence|\banalys(e|ed|ing)\b|practis|recognis|licence|judgement|behaviour|\bgrey\b|organis|cancell|levell/i.test(en), "American spelling");
  assert.ok(!/\bscore\b/i.test(en) && !/puntaje/i.test(es), "points are the 0-10 score of a position; no second word for it");
  assert.ok(!/\bprecision\b|precisión de los puntos/i.test(en), "accuracy summarises a session");
  assert.ok(!/\(s\)|\(es\)/.test(en + es), "no (s) hedges: the form follows the number");
  assert.ok(!/(?<![a-záéíóúüñ])(elige|prueba|selecciona|haz|pulsa|usa|sigue|intenta|entrena|copia|ten|pon|puedes|tienes|quieres|eres|tú)(?![a-záéíóúüñ])/i.test(es), "voseo (elegí, probá, entrená), never the tuteo");
  // "Points" is the 0-10 score; the difference of two win chances is percentage points.
  assert.ok(/percentage points?/.test(Coach.TEXT.en["coach.unit.pp.other"]) && /porcentuales/.test(Coach.TEXT.es["coach.unit.pp.other"]));
  // Quality words only come from Scoring.qualityLabel.
  assert.ok(!Object.keys(Coach.TEXT.es).some((key) => /^coach\.quality\./.test(key)), "the coach keeps no quality words of its own");
  // The unit follows the number: exactly one is singular ("1 point", "1 punto"), a half is not.
  const dots = (lang, points) => {
    const env = createEnv({ language: lang });
    return env.Coach.dotsModel({ total: 1, current: 0, rounds: [{ quality: "good", points }], lang }).items[0].label;
  };
  assert.ok(/, 1 point$/.test(dots("en", 1)) && /, 1 punto$/.test(dots("es", 1)), `${dots("en", 1)} | ${dots("es", 1)}`);
  assert.ok(/, 7\.5 points$/.test(dots("en", 7.5)) && /, 7,5 puntos$/.test(dots("es", 7.5)));
  assert.ok(/, 0\.5 points$/.test(dots("en", 0.5)) && /, 10 puntos$/.test(dots("es", 10)));
  assert.ok(!/\b1 puntos|\b1 points/.test(dots("en", 1) + dots("es", 1)));
  const duel = (lang) => createEnv({ language: lang }).Coach.dotsModel({ total: 1, current: 0, rounds: [{ quality: "perfect", points: 10, duel: [{ name: "Ana", points: 1 }, { name: "Beto", points: 4 }] }], lang }).items[0].label;
  assert.strictEqual(duel("en"), "Position 1: Ana 1 point, Beto 4 points");
  assert.strictEqual(duel("es"), "Posición 1: Ana 1 punto, Beto 4 puntos");
  // "0 of 1 positions played" and "1 of 1 hits" were wrong in both languages.
  const progress = (lang, total, done) => createEnv({ language: lang }).Coach.dotsModel({ total, current: done, rounds: Array.from({ length: done }, () => ({ quality: "good", points: 5 })), lang }).summary;
  assert.strictEqual(progress("es", 1, 0), "0 de 1 posición jugada");
  assert.strictEqual(progress("en", 1, 0), "0 of 1 position played");
  assert.strictEqual(progress("es", 3, 1), "1 de 3 posiciones jugadas");
  assert.strictEqual(progress("en", 3, 1), "1 of 3 positions played");
  const hits = (lang, total, hitCount) => {
    const env = createEnv({ language: lang });
    const doc = env.doc;
    const el = doc.createElement("div");
    doc.body.appendChild(el);
    const rounds = summaryRounds().slice(0, total).map((round, index) => Object.assign({}, round, { hit: index < hitCount }));
    const summary = env.Coach.summaryModel({ record: Object.assign({}, RECORD, { positions: total }), rounds, mode: "solo", lang });
    env.Coach.renderSummary(el, summary, { lang });
    return text(first(el, "co-sum-stats"));
  };
  assert.ok(hits("es", 1, 1).includes("1 de 1 acierto") && !hits("es", 1, 1).includes("aciertos"), hits("es", 1, 1));
  assert.ok(hits("en", 1, 0).includes("0 of 1 correct"), hits("en", 1, 0));
  assert.ok(hits("es", 3, 2).includes("2 de 3 aciertos") && hits("en", 3, 2).includes("2 of 3 correct"));
  // The gap between two win chances: "1 percentage point", not "1 percentage points", and never the bare word "points".
  const lossNote = (lang, secondScore) => {
    const env = createEnv({ language: lang });
    const el = env.doc.createElement("div");
    env.doc.body.appendChild(el);
    const lines = [{ uci: "e2e4", score: 100 }, { uci: "a2a3", score: secondScore }];
    const answer = makeAnswer(env, { uci: "a2a3", san: "a3", lines });
    env.Coach.renderRound(el, makeContext(env, [answer], { best: { uci: "e2e4", san: "e4", score: 100 }, master: null, masterName: "" }), { lang });
    return all(first(el, "co-compare"), "co-cmp-note").map(text).find((value) => /\d+%/.test(value)) || "";
  };
  const winAt = (cp) => Math.round(Ludus.Scoring.winPercent(cp));
  // The first score that is outside the tolerance band (it is no "as good as the best") and whose bar is one point of win chance lower.
  let oneStep = 100;
  while (winAt(100) - winAt(oneStep) < 1 || Ludus.Scoring.winPercent(100) - Ludus.Scoring.winPercent(oneStep) <= Ludus.Scoring.DEFAULTS.tolerancePct) oneStep -= 1;
  assert.strictEqual(winAt(100) - winAt(oneStep), 1, "a score one point of win chance below the best");
  assert.ok(/\(1 percentage point less than/.test(lossNote("en", oneStep)), lossNote("en", oneStep));
  assert.ok(/\(1 punto porcentual menos que/.test(lossNote("es", oneStep)), lossNote("es", oneStep));
  assert.ok(/\(\d\d? percentage points less than/.test(lossNote("en", -150)) && /puntos porcentuales menos/.test(lossNote("es", -150)));
  // English ordinals ("2nd choice"), the plain number in Spanish.
  const rank = (lang, n) => {
    const env = createEnv({ language: lang });
    const el = env.doc.createElement("div");
    env.doc.body.appendChild(el);
    const context = makeContext(env, [makeAnswer(env, { uci: "e2e4", san: "e4" })], { master: { uci: "d2d4", san: "d4", score: 25, rank: n }, masterName: "Morphy" });
    env.Coach.renderRound(el, context, { lang });
    return text(first(el, "co-compare"));
  };
  [[1, "1st"], [2, "2nd"], [3, "3rd"], [4, "4th"], [11, "11th"], [12, "12th"], [13, "13th"], [21, "21st"], [22, "22nd"], [103, "103rd"]].forEach(([n, ordinal]) => {
    assert.ok(rank("en", n).includes(`the engine's ${ordinal} choice`), `${n} -> ${ordinal}: ${rank("en", n)}`);
  });
  assert.ok(rank("es", 2).includes("era la opción 2 del motor"), rank("es", 2));
  // The sentence that tells the person what to do is the same in the two tables: hints cost "0 points" in both.
  assert.ok(/0 points\)/.test(Coach.TEXT.en["coach.think.hints"]) && /0 puntos\)/.test(Coach.TEXT.es["coach.think.hints"]));
});

test("every SAN the coach renders follows the notation setting: letters through localizeSan, spoken forms through spokenSan (PL-6)", () => {
  const SPOKEN = { es: { Nf3: "caballo a f3", Bb5: "alfil a b5", Nc6: "caballo a c6" }, en: { Nf3: "knight to f3", Bb5: "bishop to b5", Nc6: "knight to c6" } };
  ["spanish", "english"].forEach((style) => {
    ["es", "en"].forEach((lang) => {
      const env = createEnv({ language: lang });
      const { Coach, doc, Ludus } = env;
      Ludus.Settings.set("notation.style", style);
      const nf3 = style === "spanish" ? "Cf3" : "Nf3";
      const bb5 = style === "spanish" ? "Ab5" : "Bb5";
      const lines = [{ uci: "g1f3", score: 40 }, { uci: "e2e4", score: 35 }, { uci: "a2a3", score: -20 }];
      const answer = makeAnswer(env, { uci: "a2a3", san: "a3", lines });
      const context = makeContext(env, [answer], {
        best: { uci: "g1f3", san: "Nf3", score: 40 }, master: { uci: "e2e4", san: "e4", score: 35, rank: 2 }, masterName: "Morphy",
        lines: [
          { uci: "g1f3", san: "Nf3", score: 40, rank: 1, isBest: true, pvSan: ["Nf3", "Nc6", "Bb5"] },
          { uci: "e2e4", san: "e4", score: 35, rank: 2, isMaster: true, pvSan: ["e4", "e5"] },
        ],
      });
      const el = doc.createElement("div");
      doc.body.appendChild(el);
      Coach.renderRound(el, context, { lang });
      const other = style === "spanish" ? "Nf3" : "Cf3";
      const tag = `${style}/${lang}`;
      // What is written: the verdict, the comparison, the move list and its tokens.
      assert.ok(text(first(el, "co-hero-verdict")).includes(nf3) && !text(first(el, "co-hero-verdict")).includes(other), `${tag} verdict: ${text(first(el, "co-hero-verdict"))}`);
      assert.ok(text(first(el, "co-compare")).includes(nf3) && !text(first(el, "co-compare")).includes(other), `${tag} compare`);
      assert.ok(text(first(el, "co-lines")).includes(nf3) && text(first(el, "co-lines")).includes(bb5), `${tag} lines: ${text(first(el, "co-lines"))}`);
      assert.ok(all(el, "co-tok").some((node) => node.textContent.includes(bb5)), `${tag} tokens`);
      assert.ok(all(el, "co-tok").every((node) => !node.textContent.includes(style === "spanish" ? "Bb5" : "Ab5")), `${tag} tokens never mix the alphabets`);
      // What is read aloud: the move in words in the page language, for either setting (the words are not letters).
      const lineLabel = all(el, "co-line")[0].getAttribute("aria-label");
      assert.ok(lineLabel.includes(SPOKEN[lang].Nf3) && !lineLabel.includes(nf3) && !lineLabel.includes(other), `${tag} line aria-label: ${lineLabel}`);
      const tokenLabels = all(el, "co-tok").map((node) => node.getAttribute("aria-label"));
      assert.ok(tokenLabels.some((value) => value.includes(SPOKEN[lang].Bb5)) && tokenLabels.some((value) => value.includes(SPOKEN[lang].Nc6)), `${tag} token labels: ${tokenLabels.join(" | ")}`);
      // The stored move is never touched, and the helpers agree with the chess module.
      assert.strictEqual(context.best.san, "Nf3");
      assert.strictEqual(Coach.showSan("Nf3", lang), Ludus.chess.localizeSan("Nf3", lang));
      assert.strictEqual(Coach.speakSan("Nf3", lang), Ludus.chess.spokenSan("Nf3", lang));
      // A duel card shows the move of each player the same way.
      const ana = makeAnswer(env, { uci: "g1f3", san: "Nf3", name: "Ana", lines });
      const beto = Object.assign(makeAnswer(env, { uci: "a2a3", san: "a3", name: "Beto", lines }), { playerIndex: 1 });
      Coach.renderDuel(el, makeContext(env, [ana, beto]), { lang });
      assert.ok(text(all(el, "co-player")[0]).includes(nf3), `${tag} duel card`);
    });
  });
  // Without the helpers (a build that failed to load js/chess.js) the stored text is shown and nothing throws.
  const env = createEnv({ language: "es" });
  const chess = env.Ludus.chess;
  const keep = { localizeSan: chess.localizeSan, spokenSan: chess.spokenSan };
  delete chess.localizeSan;
  delete chess.spokenSan;
  try {
    assert.strictEqual(env.Coach.showSan("Nf3", "es"), "Nf3");
    assert.strictEqual(env.Coach.speakSan("Nf3", "es"), "Nf3");
  } finally {
    Object.assign(chess, keep);
  }
  assert.strictEqual(env.Coach.speakSan("", "es"), "");
});

test("the game core writes its moves the same way: the confirm button, the reveal buttons and the live-region announcements (PL-6)", () => {
  const app = fs.readFileSync(path.join(repoRoot, "app.js"), "utf8");
  // Every place that puts a SAN into a sentence goes through sanForPerson: letters for the eye, words for a live region.
  [["core.move.confirmSan", false], ["core.move.pending", true], ["core.hint.said.3", true], ["evaluation.bestPrefix", false], ["evaluation.gamePrefix", false]].forEach(([key, spoken]) => {
    const lines = app.split("\n").filter((line) => line.includes(`t("${key}", {`) && !/^\s*"/.test(line));
    assert.ok(lines.length >= 1, `${key} is used`);
    lines.forEach((line) => {
      assert.ok(spoken ? /sanForPerson\([^)]*, true\)/.test(line) : /sanForPerson\(/.test(line) && !/, true\)/.test(line), `${key}: ${line.trim()}`);
    });
  });
  // And the helper itself, run in the real game core.
  const env = load();
  const run = (code) => env.run(code);
  env.Ludus.i18n.setLanguage("es", { persist: false });
  run('STATE.language = "es"');
  assert.strictEqual(run('sanForPerson("Nf3")'), "Cf3", "Spanish readers see Spanish letters");
  assert.strictEqual(run('sanForPerson("Nf3", true)'), "caballo a f3", "and hear words");
  env.Ludus.Settings.set("notation.style", "english");
  assert.strictEqual(run('sanForPerson("Nf3")'), "Nf3", "the notation setting wins over the language");
  assert.strictEqual(run('sanForPerson("Nf3", true)'), "caballo a f3", "the words follow the language, not the letters");
  env.Ludus.Settings.set("notation.style", "auto");
  run('STATE.language = "en"');
  assert.strictEqual(run('sanForPerson("Nf3")'), "Nf3");
  assert.strictEqual(run('sanForPerson("Nf3", true)'), "knight to f3");
  assert.strictEqual(run('sanForPerson("")'), "");
  assert.strictEqual(run('sanForPerson(undefined)'), undefined);
});

test("the coach degrades: no kit, no document, no target and empty data never throw", () => {
  // No kit: the gauge and chips fall back to plain nodes.
  const bare = createEnv({ language: "en", withKit: false });
  const el = bare.doc.createElement("div");
  bare.doc.body.appendChild(el);
  const context = makeContext(bare, [makeAnswer(bare, { uci: "e2e4", san: "e4" })]);
  assert.doesNotThrow(() => bare.Coach.renderRound(el, context, { lang: "en" }));
  assert.ok(first(el, "co-hero") && first(el, "co-gauge-text"), "a text gauge in place of the kit's");
  assert.doesNotThrow(() => bare.Coach.renderEvaluating(el, {}));
  assert.doesNotThrow(() => bare.Coach.renderSummary(el, bare.Coach.summaryModel({ record: RECORD, rounds: summaryRounds() }), {}));
  assert.doesNotThrow(() => bare.Coach.renderSummaryActions(el, bare.Coach.summaryModel({ record: RECORD }), { canReplay: true }));
  assert.strictEqual(bare.Coach.openConcept("anything"), null);
  // No target, empty context, garbage: quiet.
  const env = createEnv({ language: "en" });
  const { Coach } = env;
  const target = env.doc.createElement("div");
  target.textContent = "untouched";
  assert.doesNotThrow(() => {
    Coach.renderRound(null, context, {});
    Coach.renderRound(target, null, {});
    Coach.renderRound(target, { answers: [] }, {});
    Coach.renderDuel(target, {}, {});
    Coach.renderThinking(target, null);
    Coach.renderDots(target, null);
    Coach.renderSummary(target, null, {});
    Coach.renderSummaryActions(target, null, {});
  });
  assert.strictEqual(target.textContent, "untouched", "a failed draw leaves what was there");
  // A context with almost nothing in it still draws.
  assert.doesNotThrow(() => Coach.renderRound(target, { answers: [{ uci: "e2e4", san: "e4", assessment: {} }], best: {}, lines: [{}, null, { san: "e4" }] }, {}));
  // No document at all.
  const none = createEnv({ withDocument: false });
  assert.doesNotThrow(() => {
    none.Coach.renderRound({}, context, {});
    none.Coach.renderEvaluating({}, {});
    none.Coach.renderDots({}, none.Coach.dotsModel({ total: 3 }));
    none.Coach.renderSummary({}, none.Coach.summaryModel({ record: RECORD }), {});
  });
  assert.ok(none.Coach.verdictText({ best: { san: "e4" } }, { uci: "a2a3", assessment: { qualityCode: "bad" } }, "en"), "the pure helpers do not need a document");
});

test("Coach registers its text with Ludus.i18n and follows the language of the page", () => {
  const env = createEnv({ language: "es" });
  const { Coach, Ludus } = env;
  const key = "coach.think.goal";
  assert.strictEqual(Ludus.i18n.t(key), Coach.TEXT.es[key]);
  Ludus.i18n.setLanguage("en", { persist: false });
  assert.strictEqual(Ludus.i18n.t(key), Coach.TEXT.en[key]);
  // Without a language given, the models follow the page.
  assert.strictEqual(Coach.dotsModel({ total: 1, current: 0, rounds: [{ quality: "perfect", points: 7.5 }] }).items[0].label.includes("7.5"), true);
  Ludus.i18n.setLanguage("es", { persist: false });
  assert.strictEqual(Coach.dotsModel({ total: 1, current: 0, rounds: [{ quality: "perfect", points: 7.5 }] }).items[0].label.includes("7,5"), true);
});

// ---------- Polish pass 2 (r2-coach): RK-2, RK-3, RK-4 ----------

test("every gauge has a full accessible name: the number, what it is out of, and its unit, in the language of the page (RK-2)", () => {
  const gaugeNames = (root) => all(root, "gauge").concat(all(root, "co-gauge-text")).map((node) => node.getAttribute("aria-label"));
  [true, false].forEach((withKit) => {
    ["en", "es"].forEach((lang) => {
      const env = createEnv({ language: lang, withKit });
      const { Coach, doc } = env;
      const el = doc.createElement("div");
      doc.body.appendChild(el);
      const answer = makeAnswer(env, { uci: "d2d4", san: "d4" });
      answer.assessment.points = 7.5;
      answer.assessment.maxPoints = 10;
      const expected = lang === "en" ? "7.5 out of 10 points" : "7,5 de 10 puntos";
      Coach.renderRound(el, makeContext(env, [answer]), { lang });
      assert.deepStrictEqual(gaugeNames(first(el, "co-hero-gauge")), [expected], `${lang} kit=${withKit}: the verdict's gauge`);
      // The same name when the score is a whole number (no ",0").
      answer.assessment.points = 10;
      Coach.renderRound(el, makeContext(env, [answer]), { lang });
      assert.deepStrictEqual(gaugeNames(first(el, "co-hero-gauge")), [lang === "en" ? "10 out of 10 points" : "10 de 10 puntos"]);
      // A duel: one per player, with the unit as well.
      const a = makeAnswer(env, { uci: "e2e4", san: "e4", name: "Ana" });
      const b = makeAnswer(env, { uci: "a2a3", san: "a3", name: "Beto" });
      a.assessment.points = 9;
      b.assessment.points = 2.5;
      Coach.renderDuel(el, makeContext(env, [a, b]), { lang });
      const names = gaugeNames(el);
      assert.deepStrictEqual(names.slice(0, 2), [lang === "en" ? "9 out of 10 points" : "9 de 10 puntos", lang === "en" ? "2.5 out of 10 points" : "2,5 de 10 puntos"], `${lang}: both players' gauges`);
      // The summary: accuracy is a percentage, named by what it is; a duel summary gauge is a score.
      Coach.renderSummary(el, Coach.summaryModel({ record: RECORD, rounds: summaryRounds(), lang }), { lang });
      assert.deepStrictEqual(gaugeNames(first(el, "co-sum-gauge")), [lang === "en" ? "Average accuracy: 84%" : "Precisión media: 84%"], `${lang}: the summary's gauge`);
      const duelRecord = Object.assign({}, RECORD, { mode: "duel", players: ["Ana", "Beto"] });
      const duelRounds = summaryRounds().map((round) => Object.assign({}, round, { players: [{ name: "Ana", points: 8, quality: "good", hit: true, san: "e4" }, { name: "Beto", points: 3.5, quality: "bad", hit: false, san: "a3" }] }));
      const duelModel = Coach.summaryModel({ record: duelRecord, rounds: duelRounds, mode: "duel", lang });
      assert.ok(duelModel.duel, "the duel summary model carries its two players");
      Coach.renderSummary(el, duelModel, { lang });
      const duelNames = gaugeNames(first(el, "co-sum-duel"));
      assert.strictEqual(duelNames.length, 2, `${lang}: one gauge per duelist`);
      duelNames.forEach((name) => assert.ok(lang === "en" ? /^[\d.]+ out of \d+ points$/.test(name) : /^[\d,]+ de \d+ puntos$/.test(name), `${lang}: ${name}`));
    });
  });
});

test("a slower mate is never said to give up ground: the verdict says it still wins, and only for a mate of the mover (RK-3)", () => {
  ["en", "es"].forEach((lang) => {
    const env = createEnv({ language: lang });
    const { Coach, Ludus } = env;
    const mate = (value) => Ludus.Scoring.encodeScore({ type: "mate", value });
    const context = (lines, uci, extra) => {
      const answer = makeAnswer(env, { uci, san: uci, lines });
      return { answer, context: makeContext(env, [answer], Object.assign({ best: { uci: lines[0].uci, san: "Qh4#", score: lines[0].score }, master: null, masterName: "" }, extra)) };
    };
    // Mate in 2 was there; the move mates in 5 instead: still winning, three moves slower.
    const slower = context([{ uci: "e2e4", score: mate(2) }, { uci: "d2d4", score: mate(5) }, { uci: "a2a3", score: -300 }], "d2d4");
    assert.strictEqual(slower.answer.assessment.reason, "ok");
    assert.ok(slower.answer.assessment.mateExtraMoves > 0, "Scoring recorded the extra moves");
    assert.ok(["very_good", "good", "interesting"].includes(slower.answer.assessment.qualityCode), `a slower mate lands on the soft part of the ladder: ${slower.answer.assessment.qualityCode}`);
    const found = Coach.verdictKey(slower.context, slower.answer, lang);
    assert.strictEqual(found.key, "coach.verdict.slowerMate");
    const sentence = Coach.verdictText(slower.context, slower.answer, lang);
    assert.ok(lang === "en" ? /Still winning/.test(sentence) && /takes longer/.test(sentence) : /Seguís ganando/.test(sentence) && /tarda más/.test(sentence), sentence);
    assert.ok(!/gives up|cede/i.test(sentence), `no claim of lost ground: ${sentence}`);
    assert.ok(sentence.includes(Coach.showSan("Qh4#", lang)), "and the faster mate is named");
    // The title is still the label of the ladder (the one vocabulary of Scoring).
    assert.strictEqual(Coach.qualityInfo(slower.answer.assessment.qualityCode, lang).label, Ludus.Scoring.qualityLabel(slower.answer.assessment.qualityCode, lang));
    // The same extra moves while LOSING (mated sooner than it had to be) are not "still winning".
    const sooner = context([{ uci: "e2e4", score: mate(-5) }, { uci: "d2d4", score: mate(-2) }, { uci: "a2a3", score: mate(-1) }], "d2d4");
    assert.ok(sooner.answer.assessment.mateExtraMoves > 0, "Scoring records the extra moves here too");
    assert.notStrictEqual(Coach.verdictKey(sooner.context, sooner.answer, lang).key, "coach.verdict.slowerMate", "mated sooner is not a slower mate of the mover");
    // An assessment that carries the extra moves but not the move's score says nothing it cannot know.
    const bare = { uci: "d2d4", assessment: { reason: "ok", qualityCode: "interesting", mateExtraMoves: 2 } };
    assert.notStrictEqual(Coach.verdictKey({ best: { san: "Qh4#" } }, bare, lang).key, "coach.verdict.slowerMate");
    // A plain inaccuracy keeps the sentence of its label.
    const plain = { uci: "d2d4", userScore: 100, assessment: { reason: "ok", qualityCode: "interesting", mateExtraMoves: 0, userScore: 100 } };
    assert.strictEqual(Coach.verdictKey({ best: { san: "e4" } }, plain, lang).key, "coach.verdict.interesting");
    // The result card shows it.
    const target = env.doc.createElement("div");
    env.doc.body.appendChild(target);
    Coach.renderRound(target, slower.context, { lang });
    assert.strictEqual(text(first(target, "co-hero-verdict")), sentence);
  });
});

test("every dock button has a translated tooltip with its key, and its accessible name is left alone (RK-4)", () => {
  const html = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
  const ids = Array.from(html.matchAll(/<button\b[^>]*\bid="([^"]+)"[^>]*\bclass="[^"]*\bco-dock-btn\b/g), (m) => m[1]);
  assert.ok(ids.length >= 7, `the dock markup was found: ${ids.join(", ")}`);
  const dockOf = (doc, withKeys) => {
    const dock = doc.createElement("div");
    dock.setAttribute("id", "board-dock");
    const keys = { "hint-btn": "H", "reveal-best-btn": "B", "reveal-game-btn": "M", "result-analysis-btn": "E" };
    ids.forEach((id) => {
      const button = doc.createElement("button");
      button.setAttribute("id", id);
      button.setAttribute("class", "btn co-dock-btn");
      if (id === "skip-btn") button.setAttribute("aria-label", "Skip this position for 0 points");
      if (withKeys && keys[id]) button.setAttribute("aria-keyshortcuts", keys[id]);
      const label = doc.createElement("span");
      label.setAttribute("class", "btn-label");
      label.textContent = `words of ${id}`;
      button.appendChild(label);
      dock.appendChild(button);
    });
    doc.body.appendChild(dock);
    return dock;
  };
  const env = createEnv({ language: "en", setup: (doc) => dockOf(doc, true) });
  const { Coach, doc, Ludus } = env;
  const dock = doc.getElementById("board-dock");
  const titleOf = (id) => doc.getElementById(id).getAttribute("title");
  // The coach wrote them when it loaded, in the language of the page, with the key where the button has one.
  assert.strictEqual(titleOf("hint-btn"), "Hint (H)");
  assert.strictEqual(titleOf("reveal-best-btn"), "Show the best move (B)");
  assert.strictEqual(titleOf("reveal-game-btn"), "Show the move of the game (M)");
  assert.strictEqual(titleOf("result-analysis-btn"), "Explore the board (E)");
  assert.strictEqual(titleOf("skip-btn"), "Skip this position (0 points)", "no key, no suffix");
  ids.forEach((id) => assert.ok(titleOf(id), `${id} has a tooltip`));
  // The names of the buttons are what they were: the aria-label stays, the words stay.
  assert.strictEqual(doc.getElementById("skip-btn").getAttribute("aria-label"), "Skip this position for 0 points");
  ids.forEach((id) => assert.strictEqual(text(doc.getElementById(id)), `words of ${id}`));
  ids.forEach((id) => assert.ok(!doc.getElementById(id).getAttribute("aria-describedby"), `${id}: a title, no aria-describedby`));
  // A change of language rewrites them (es: voseo-free noun phrases, the key kept).
  Ludus.i18n.setLanguage("es", { persist: false });
  assert.strictEqual(titleOf("hint-btn"), "Pista (H)");
  assert.strictEqual(titleOf("result-analysis-btn"), "Explorar el tablero (E)");
  assert.strictEqual(titleOf("skip-btn"), "Saltear esta posición (0 puntos)");
  assert.strictEqual(titleOf("result-analysis-reset-btn"), "Volver a la posición");
  // The shortcuts switched off (app.js removes aria-keyshortcuts): the tooltip loses the key when it is synced again.
  doc.getElementById("hint-btn").removeAttribute("aria-keyshortcuts");
  assert.strictEqual(Coach.syncDockTitles(dock, "en"), ids.length);
  assert.strictEqual(titleOf("hint-btn"), "Hint");
  // Every tooltip text exists in both languages.
  ["es", "en"].forEach((lang) => ids.forEach((id) => assert.ok(Coach.dockTitle(doc.getElementById(id), lang).length > 3, `${lang} ${id}`)));
  // A button the table does not know gets its own words; no label, no title; nothing breaks without a dock or a document.
  const stray = doc.createElement("button");
  stray.setAttribute("id", "stray-btn");
  stray.setAttribute("class", "co-dock-btn");
  const words = doc.createElement("span");
  words.setAttribute("class", "btn-label");
  words.textContent = "  Own   words ";
  stray.appendChild(words);
  assert.strictEqual(Coach.dockTitle(stray, "en"), "Own words");
  assert.strictEqual(Coach.dockTitle(doc.createElement("button"), "en"), "");
  assert.strictEqual(Coach.syncDockTitles(doc.createElement("div"), "en"), 0);
  assert.strictEqual(createEnv({ withDocument: false }).Coach.syncDockTitles(null), 0);
});

runAll().then(
  () => console.log(`coach.test.js: ${passed} tests passed`),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
