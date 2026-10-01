// Tests for the copy of the home hub and the landing page (js/ui/home.js): the polish pass over its words.
//
// Covers: PD-1 (the daily challenge is not promised to be "different every day": the cycle of Classics.daily is measured and the
// copy is held to it), PD-2 (rioplatense voseo, no tuteo), PD-3 (plural forms: "1 día", "1 posición", "falta 1", never "1 días" or "(s)"),
// the terminology rules (one name per concept, American English, no contractions, no English words inside Spanish strings, no
// ASCII "..." in place of the ellipsis) and the moves quoted in the fact card (they follow the notation setting).
// The page-level behaviour of the hub is covered by ui-screens.test.js; this file only adds what the copy needs.

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
  "js/facts.js", "js/classics.js", "js/data/classics.data.js", "js/ui/kit.js", "js/ui/home.js",
];

function createEnv({ language = "es" } = {}) {
  const doc = new FakeDocument();
  const storageMap = new Map();
  const location = { hash: "", pathname: "/", search: "" };
  const sandbox = {
    console, setTimeout, clearTimeout, Date, Math, JSON, Object, Array, String, Number, Promise, Map, Set, Intl, URL, structuredClone,
    document: doc,
    navigator: { languages: [language], language },
    localStorage: createFakeLocalStorage(storageMap),
    location,
  };
  sandbox.window = sandbox;
  sandbox.history = { state: null, replaceState() {} };
  const context = vm.createContext(sandbox);
  SCRIPTS.forEach((rel) => vm.runInContext(fs.readFileSync(path.join(repoRoot, rel), "utf8"), context, { filename: rel }));
  const Ludus = context.Ludus;
  Ludus.i18n.setLanguage(language, { persist: false });
  Ludus.ui._setTimers({ setTimeout, clearTimeout, raf(fn) { fn(); }, now: () => Date.now() });
  const mk = (tag, attrs) => {
    const el = doc.createElement(tag);
    Object.keys(attrs || {}).forEach((key) => el.setAttribute(key, attrs[key]));
    return el;
  };
  const app = mk("div", { class: "app" });
  doc.body.appendChild(app);
  const homeEl = mk("section", { id: "screen-home", class: "screen hidden" });
  app.appendChild(homeEl);
  Ludus.router.register("home", { el: homeEl });
  Ludus.game = { startSession: async () => {}, openOwnGamesSetup() {}, isActive: () => false };
  return { Ludus, doc, homeEl };
}

const flush = async (times = 6) => {
  for (let i = 0; i < times; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};
const text = (node) => node.textContent.replace(/\s+/g, " ").trim();

// The profile the hub reads, with the numbers a test needs on top of the real module (so the hero is the full one).
function stubProfile(Ludus, { streak, due = 0, total = 0, xpToNext, dailyDone = false, dailyStreak = 0, atRisk = false }) {
  const real = Ludus.Profile;
  Ludus.Profile = Object.assign({}, real, {
    stats: () => {
      const base = real.stats();
      const level = Object.assign({}, base.level, xpToNext === undefined ? {} : { max: false, xpToNext, nextXp: base.level.xp + xpToNext, progress: 0.5 });
      return Object.assign({}, base, { totalPositions: 12, overallAccuracy: 81, streak: { current: streak, best: streak, atRisk }, level });
    },
    notebook: Object.assign({}, real.notebook, { counts: () => ({ total, due, cleared: total - due }) }),
    daily: Object.assign({}, real.daily, { status: () => ({ done: dailyDone, accuracy: 87, streak: dailyStreak, atRisk }) }),
  });
}

async function render(env) {
  env.Ludus.Screens.home.mount(env.homeEl);
  env.Ludus.router.show("home");
  await flush();
  return env.homeEl;
}

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

// ---------- PD-1: the daily challenge copy ----------

test("daily: the cycle of Classics.daily is measured and the copy only promises what it delivers (PD-1)", async () => {
  const env = createEnv();
  const { Ludus } = env;
  await Ludus.Classics.load();
  // The first day whose position was already shown on an earlier day of the run.
  const seen = new Map();
  let firstRepeat = -1;
  const start = Date.UTC(2026, 0, 1);
  for (let day = 0; day < 900 && firstRepeat < 0; day += 1) {
    const key = new Date(start + day * 86400000).toISOString().slice(0, 10);
    const position = Ludus.Classics.daily(key);
    const id = position.id;
    if (seen.has(id)) firstRepeat = day;
    seen.set(id, day);
  }
  assert.ok(firstRepeat > 0, "the daily position does repeat in the end: the copy must not say it never does");
  // "Months" in the copy needs at least a few months of different positions behind it.
  assert.ok(firstRepeat >= 180, `the first repeat comes after ${firstRepeat} days`);
  const { es, en } = Ludus.Screens.home.TEXT;
  assert.ok(/meses/.test(es["home.daily.body.pending"]) && /months/.test(en["home.daily.body.pending"]), "it says how long without repeating, in words");
  assert.ok(!/distinta cada d|siempre distinta|different every day|always different/i.test(`${es["home.daily.body.pending"]} ${en["home.daily.body.pending"]}`));
  // Tomorrow's position is "another one", not a new one: after the cycle it may be one the person has seen.
  ["home.daily.body.done", "home.daily.already"].forEach((key) => {
    assert.ok(!/nueva|new position/i.test(`${es[key]} ${en[key]}`), `${key} must not promise a new position`);
  });
  assert.ok(es["home.daily.body.pending"].includes("Encontrá la mejor jugada") && en["home.daily.body.pending"].includes("Find the best move"));
});

test("daily: the card shows the honest copy in the page, in both languages", async () => {
  for (const language of ["es", "en"]) {
    const env = createEnv({ language });
    const root = await render(env);
    const body = text(findAll(root, byClass("home-daily-body"))[0]);
    assert.strictEqual(body, env.Ludus.Screens.home.TEXT[language]["home.daily.body.pending"]);
  }
});

// ---------- PD-2 and the terminology rules: the words ----------

test("register: every Spanish string is voseo, none is tuteo (PD-2)", () => {
  const { es } = createEnv().Ludus.Screens.home.TEXT;
  // The imperatives a tuteo would write, next to the voseo ones that the page uses.
  const tuteo = /\b(\w+éndeme|prueba|elige|escoge|toca|escribe|busca|vuelve|pulsa|selecciona|haz|ve|sigue|empieza|entrena|repasa|revisa|completa|intenta|puedes|quieres|tienes|sabes|eres|tú)\b/i;
  Object.keys(es).forEach((key) => assert.ok(!tuteo.test(es[key]), `${key} is not voseo: ${es[key]}`));
  ["Elegí", "Jugá", "Aprendé", "Mirá", "Volvé", "Completalo", "Probá", "Revisá", "Tenés", "querés", "iniciá", "Entendé"].forEach((word) => {
    assert.ok(Object.values(es).some((value) => value.includes(word)), `${word} is used`);
  });
});

test("terminology and spelling: American English, no contractions, no ASCII dots, no \"(s)\", one name per concept", () => {
  const { es, en } = createEnv().Ludus.Screens.home.TEXT;
  Object.keys(en).forEach((key) => {
    assert.ok(!/\b(colour|centre|defence|licence|favour|organis|analys|practis|levell|recognis|behaviour|grey|cancell)/i.test(en[key]), `${key} is not American English: ${en[key]}`);
    assert.ok(!/n't|'re\b|'ve\b|'ll\b|'d\b/.test(en[key]), `${key} has a contraction: ${en[key]}`);
    assert.ok(!/\(s\)/.test(en[key]) && !/\(s\)|\(es\)/.test(es[key]), `${key} hedges the plural`);
    assert.ok(!/\.\.\./.test(en[key]) && !/\.\.\./.test(es[key]), `${key} writes the ellipsis as three dots`);
    // The names of the concepts: "win chance" (never "winning chances" / "odds"), "accuracy" for a session's percentage, "points" for 0-10.
    assert.ok(!/winning chances|win probability|\bodds\b/i.test(en[key]), `${key}: the concept is called "win chance"`);
    assert.ok(!/\bprecision\b/i.test(en[key]), `${key}: "accuracy", not "precision"`);
  });
  Object.keys(es).forEach((key) => {
    assert.ok(!/probabilidad de ganar|posibilidades de ganar/i.test(es[key]), `${key}: the win chance has one name`);
    // No English words inside the Spanish copy (proper names and "XP" aside; the {placeholders} are not words).
    const stripped = es[key].replace(/\{\w+\}/g, "").replace(/Lichess|Chess\.com|Stockfish|GPL-3\.0-or-later|GPL-3\.0|Google Drive|Google|XP|ES|EN/g, "");
    assert.ok(!/\b(fallback|blitz|bullet|streak|win chance|accuracy|score|level|daily|puzzle|the|and|your)\b/i.test(stripped), `${key} has English inside: ${es[key]}`);
  });
  assert.ok(en["home.stat.accuracy"] === "Average accuracy" && es["home.stat.accuracy"] === "Precisión media", "the session percentage is the accuracy");
  assert.ok(/points/i.test(en["ld.step2.points"]) && es["ld.step2.points"] === "Puntos", "the 0-10 score of a position is points");
});

// ---------- PD-3: plural forms ----------

test("plurals: one is singular, 0 and the rest plural, in both languages (PD-3)", () => {
  const { Ludus } = createEnv();
  const tCount = Ludus.Screens.home.helpers.tCount;
  const forms = [
    ["home.sub.risk", 1, {}, "Tu racha de 1 día depende de que entrenes hoy.", "Your 1-day streak depends on training today."],
    ["home.sub.risk", 5, {}, "Tu racha de 5 días depende de que entrenes hoy.", "Your 5-day streak depends on training today."],
    ["home.sub.due", 1, {}, "Tenés 1 posición para repasar en tu cuaderno de errores.", "You have 1 position to review in your mistake notebook."],
    ["home.sub.due", 3, {}, "Tenés 3 posiciones para repasar en tu cuaderno de errores.", "You have 3 positions to review in your mistake notebook."],
    ["home.daily.risk", 1, {}, "Completalo hoy para no perder tu racha de 1 día.", "Complete it today to keep your 1-day streak."],
    ["home.daily.risk", 12, {}, "Completalo hoy para no perder tu racha de 12 días.", "Complete it today to keep your 12-day streak."],
    ["home.level.progress", 1, { xp: "90", n: "1", next: "Maestro" }, "90 XP · falta 1 para Maestro", "90 XP · 1 to Maestro"],
    ["home.level.progress", 10, { xp: "90", n: "10", next: "Maestro" }, "90 XP · faltan 10 para Maestro", "90 XP · 10 to Maestro"],
    ["home.daily.streak", 1, {}, "Racha del desafío: 1 día", "Challenge streak: 1 day"],
    ["home.daily.streak", 2, {}, "Racha del desafío: 2 días", "Challenge streak: 2 days"],
    ["home.mode.review.due", 1, {}, "1 posición te espera. Repasarla hoy es lo que más rinde.", "1 position is waiting. Reviewing it today pays off the most."],
    ["home.mode.review.clear", 1, {}, "Estás al día. Tu cuaderno guarda 1 posición para más adelante.", "You are up to date. Your notebook keeps 1 position for later."],
    ["home.stat.streak.hint", 1, {}, "día seguido", "day in a row"],
  ];
  forms.forEach(([key, n, params, es, en]) => {
    Ludus.i18n.setLanguage("es", { persist: false });
    assert.strictEqual(tCount(key, n, params), es, `${key} ${n} es`);
    Ludus.i18n.setLanguage("en", { persist: false });
    assert.strictEqual(tCount(key, n, params), en, `${key} ${n} en`);
  });
  // The singular and its plural exist for every string that counts something, in both languages.
  const { es, en } = Ludus.Screens.home.TEXT;
  ["home.sub.risk", "home.sub.due", "home.level.progress", "home.daily.risk", "home.daily.streak", "home.mode.review.due", "home.mode.review.clear", "home.stat.streak.hint"].forEach((key) => {
    assert.ok(`${key}.one` in es && `${key}.one` in en, `${key} has a singular`);
    assert.ok(!/\b1 (días|posiciones|partidas|jugadas)\b/.test(es[`${key}.one`]), `${key}.one: "1" followed by a plural`);
  });
  assert.ok(!Object.values(es).some((value) => /\b1 (días|posiciones|partidas|jugadas)\b/.test(value)), "no Spanish string says \"1 posiciones\"");
});

test("plurals in the page: a one-day streak, one position to review, one XP to go (PD-3)", async () => {
  const check = async (language, options, expected) => {
    const env = createEnv({ language });
    stubProfile(env.Ludus, options);
    const root = await render(env);
    const page = text(root);
    expected.forEach((fragment) => assert.ok(page.includes(fragment), `${language}: "${fragment}" is on the page: ${page.slice(0, 400)}`));
    return page;
  };
  // A streak of one day that is at risk, and the daily challenge saying the same.
  await check("es", { streak: 1, atRisk: true, dailyStreak: 1, total: 1, due: 0 }, ["Tu racha de 1 día depende de que entrenes hoy.", "Completalo hoy para no perder tu racha de 1 día."]);
  await check("en", { streak: 1, atRisk: true, dailyStreak: 1, total: 1, due: 0 }, ["Your 1-day streak depends on training today.", "Complete it today to keep your 1-day streak."]);
  const many = await check("es", { streak: 7, atRisk: true, dailyStreak: 7, total: 1, due: 0 }, ["Tu racha de 7 días depende de que entrenes hoy."]);
  assert.ok(!many.includes("1 días"));
  // One position due: the sub line counts it in words (a streak not at risk, so this line is the one shown).
  await check("es", { streak: 3, atRisk: false, total: 4, due: 1 }, ["Tenés 1 posición para repasar en tu cuaderno de errores."]);
  await check("en", { streak: 3, atRisk: false, total: 4, due: 1 }, ["You have 1 position to review in your mistake notebook."]);
  await check("es", { streak: 3, atRisk: false, total: 9, due: 4 }, ["Tenés 4 posiciones para repasar en tu cuaderno de errores."]);
  // One XP to the next level: "falta 1", not "faltan 1".
  const one = await check("es", { streak: 2, atRisk: false, total: 0, due: 0, xpToNext: 1 }, ["falta 1 para"]);
  assert.ok(!one.includes("faltan 1 "));
  await check("es", { streak: 2, atRisk: false, total: 0, due: 0, xpToNext: 40 }, ["faltan 40 para"]);
});

// ---------- the fact card: moves follow the notation setting ----------

test("notation: moves quoted in the fact card follow the notation setting like every move on screen", () => {
  const { Ludus } = createEnv();
  const quoted = Ludus.Screens.home.helpers.quotedText;
  const berlin = "La Defensa Berlinesa (1.e4 e5 2.Cf3 Cc6 3.Ab5 Cf6) se consideraba pasiva.";
  assert.strictEqual(quoted(berlin, "es"), berlin, "a Spanish page on automatic notation keeps the Spanish letters as written");
  Ludus.Settings.set("notation.style", "english");
  assert.strictEqual(quoted(berlin, "es"), "La Defensa Berlinesa (1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6) se consideraba pasiva.");
  assert.strictEqual(quoted("The Berlin Defence (1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6) was passive.", "en"), "The Berlin Defence (1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6) was passive.");
  Ludus.Settings.set("notation.style", "spanish");
  assert.strictEqual(quoted("The Berlin Defence (1.e4 e5 2.Nf3 Nc6) was passive.", "en"), "The Berlin Defence (1.e4 e5 2.Cf3 Cc6) was passive.");
  assert.strictEqual(quoted("", "es"), "");
  assert.strictEqual(quoted("No moves here, only 1984.", "en"), "No moves here, only 1984.");
});

// ---------- RC-2 / RC-3: the names of a duel ----------

test("duel names: a profile's whole name fits (one shared limit), and nobody is called by the masculine generic", async () => {
  const env = createEnv({ language: "es" });
  const { Ludus } = env;
  const max = Ludus.Profile.constants.NAME_MAX;
  assert.strictEqual(max, 24, "the limit comes from the profile module");
  const helpers = Ludus.Screens.home.helpers;
  const longest = "Maximiliano Alejandro Pe";
  assert.strictEqual(longest.length, max);
  const resolved = helpers.resolveDuelPlayers([{ kind: "profile", profileId: "p1" }, { kind: "guest", guestName: `${longest}ZZZ` }], [{ id: "p1", name: longest }]);
  assert.deepStrictEqual(Array.from(resolved.names), [longest, longest], "a profile name is whole and a typed one is cut at the same limit");
  // The dialog: the guest fields take as many letters as a profile name, and the placeholders are the neutral default.
  for (const language of ["es", "en"]) {
    const page = createEnv({ language });
    page.Ludus.Screens.home.openDuelSetup();
    const dialog = findAll(page.doc.body, (el) => el.classList.contains("modal")).pop();
    assert.ok(dialog, "the dialog opens");
    const inputs = findAll(dialog, (el) => el.tagName === "INPUT" && (el.getAttribute("id") || "").startsWith("duel-guest"));
    assert.strictEqual(inputs.length, 2);
    inputs.forEach((input, index) => {
      assert.strictEqual(String(input.getAttribute("maxlength")), String(max), `${language}: the field takes ${max} letters`);
      assert.ok(!/Jugador \d/.test(input.getAttribute("placeholder") || ""), "no 'Jugador 1' placeholder");
      assert.strictEqual(input.getAttribute("placeholder"), language === "es" ? `Participante ${index + 1}` : `Guest ${index + 1}`);
    });
    const none = page.Ludus.Screens.home.helpers.resolveDuelPlayers([{ kind: "guest", guestName: "" }, { kind: "guest", guestName: " " }], []);
    assert.deepStrictEqual(Array.from(none.names), language === "es" ? ["Participante 1", "Participante 2"] : ["Guest 1", "Guest 2"]);
  }
  const source = fs.readFileSync(path.join(repoRoot, "js", "ui", "home.js"), "utf8");
  assert.ok(!/"Jugador \{n\}"/.test(source), "the unused masculine default string is gone");
});

runAll().then(() => {
  console.log(`home-ui: ${passed} tests passed`);
}).catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
