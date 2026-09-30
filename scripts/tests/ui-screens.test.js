// Tests for the shell, the landing page and the home hub (js/ui/shell.js,
// js/ui/home.js) running against the real logic modules (Profile, Classics,
// Facts, Settings) and the fake DOM of _uidom.js.
//
// Covers: text parity es/en (same keys, same {placeholders}), the pure helpers,
// the home hub in first-run / populated / done states, every mode card's action,
// the daily challenge (session started with dailyKey, done state), the duel setup
// (validation, the three sources, names and profile ids handed to the session),
// "Next fact", language and profile re-rendering, the landing page sections and
// its footer language switch, and the shell (nav, aria-current, notebook badge,
// profile popover and switching, hash routes, hidden on the game screen).

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
  "js/facts.js", "js/classics.js", "js/data/classics.data.js", "js/ui/kit.js", "js/ui/shell.js", "js/ui/home.js",
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
  sandbox.history = { state: null, replaceState(_state, _title, url) { location.hash = (String(url).match(/#.*$/) || [""])[0]; } };
  const context = vm.createContext(sandbox);
  SCRIPTS.forEach((rel) => vm.runInContext(fs.readFileSync(path.join(repoRoot, rel), "utf8"), context, { filename: rel }));
  const Ludus = context.Ludus;
  Ludus.i18n.setLanguage(language, { persist: false });
  // Deterministic kit timers: animation frames run at once, the clock is manual.
  const clock = { now: 0, seq: 0, timers: new Map() };
  Ludus.ui._setTimers({
    setTimeout(fn, ms) { clock.seq += 1; clock.timers.set(clock.seq, { at: clock.now + Number(ms || 0), fn }); return clock.seq; },
    clearTimeout(id) { clock.timers.delete(id); },
    raf(fn) { fn(); },
    now: () => clock.now,
  });
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
  // Elements the pages of index.html ship.
  const mk = (tag, attrs) => {
    const el = doc.createElement(tag);
    Object.keys(attrs || {}).forEach((key) => el.setAttribute(key, attrs[key]));
    return el;
  };
  const header = mk("header", { id: "shell-header", class: "sh-header" });
  const nav = mk("nav", { id: "shell-nav" });
  const status = mk("div", { id: "shell-status" });
  const langSwitch = mk("div", { id: "language-switch" });
  const btnEs = mk("button", { id: "language-btn-es" });
  const btnEn = mk("button", { id: "language-btn-en" });
  langSwitch.appendChild(btnEs);
  langSwitch.appendChild(btnEn);
  header.appendChild(mk("a", { id: "shell-brand", href: "#/home" }));
  header.appendChild(nav);
  header.appendChild(status);
  header.appendChild(langSwitch);
  doc.body.appendChild(header);
  const landingEl = mk("main", { id: "landing-screen" });
  const startBtn = mk("button", { id: "landing-start-btn" });
  const hero = mk("section", { class: "ld-hero" });
  ["ld-eyebrow", "ld-lead", "ld-assure"].forEach((name) => hero.appendChild(mk("p", { class: name })));
  hero.appendChild(startBtn);
  hero.appendChild(mk("a", { class: "ld-how-link", href: "#ld-how" }));
  landingEl.appendChild(hero);
  doc.body.appendChild(landingEl);
  const app = mk("div", { class: "app", id: "app-main" });
  doc.body.appendChild(app);
  const homeEl = mk("section", { id: "screen-home", class: "screen hidden" });
  app.appendChild(homeEl);
  const shown = [];
  ["landing", "home", "classics", "notebook", "progress", "museum", "settings", "account", "setup", "game"].forEach((id) => {
    const el = id === "landing" ? landingEl : id === "home" ? homeEl : mk("section", { id: `screen-${id}` });
    if (!el.parentNode) app.appendChild(el);
    Ludus.router.register(id, { el, onShow: () => shown.push(id) });
  });
  const calls = { sessions: [], own: [] };
  Ludus.game = {
    startSession: async (spec) => { calls.sessions.push(spec); },
    openOwnGamesSetup: (options) => { calls.own.push(options); },
    isActive: () => false,
  };
  return { Ludus, doc, context, advance, storageMap, location, shown, calls, els: { header, nav, status, landingEl, startBtn, homeEl, app, btnEs, btnEn } };
}

const flush = async (times = 6) => {
  for (let i = 0; i < times; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

function seedRounds(Ludus, count, { dailyDone = false } = {}) {
  const Profile = Ludus.Profile;
  const positions = Ludus.Classics.random(count);
  const now = Date.now();
  positions.forEach((pos, i) => {
    const acc = [96, 88, 72, 55, 34][i % 5];
    Profile.recordRound({
      id: `t${i}`, ts: now - i * 60000, source: "classic", sessionKind: "classic", fen: pos.fen, userUci: pos.bestMoveUci, bestUci: pos.bestMoveUci,
      accuracy: acc, points: acc / 10, phase: pos.phase, timeSpentMs: 9000,
    });
  });
  if (dailyDone) Profile.daily.complete(new Date().toISOString().slice(0, 10), 87);
}

const text = (node) => node.textContent.replace(/\s+/g, " ").trim();
const byData = (attr, value) => (el) => el.getAttribute(attr) === value;

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

const placeholders = (string) => Array.from(String(string).matchAll(/\{(\w+)\}/g), (m) => m[1]).sort().join(",");

test("text: shell, home, landing and kit have the same keys and placeholders in es and en", () => {
  const { Ludus } = createEnv();
  const sources = { shell: Ludus.shell.TEXT, home: Ludus.Screens.home.TEXT, ui: Ludus.ui.TEXT };
  Object.keys(sources).forEach((name) => {
    const { es, en } = sources[name];
    assert.deepStrictEqual(Object.keys(es).sort(), Object.keys(en).sort(), `${name}: key sets differ`);
    Object.keys(es).forEach((key) => {
      assert.ok(es[key].length > 0 && en[key].length > 0, `${name}.${key} is empty`);
      assert.strictEqual(placeholders(es[key]), placeholders(en[key]), `${name}.${key}: placeholders differ`);
    });
  });
  assert.ok(Object.keys(Ludus.Screens.home.TEXT.es).some((key) => key.startsWith("ld.")));
});

test("helpers: hash routes, date key, greeting part, duel players, counts", () => {
  const { Ludus } = createEnv();
  const { parseHash } = Ludus.shell;
  assert.deepStrictEqual(JSON.parse(JSON.stringify(parseHash("#/classics"))), { id: "classics" });
  assert.strictEqual(parseHash("#/daily").id, "daily");
  assert.strictEqual(parseHash("#/nope"), null);
  assert.strictEqual(parseHash("#/home/extra"), null);
  assert.strictEqual(parseHash(""), null);
  assert.strictEqual(parseHash("#/__proto__"), null);
  const helpers = Ludus.Screens.home.helpers;
  assert.strictEqual(helpers.localDateKey(new Date(2026, 8, 30, 23, 59)), "2026-09-30");
  assert.strictEqual(helpers.localDateKey(new Date(2026, 0, 5)), "2026-01-05");
  assert.strictEqual(helpers.greetingPart(5), "evening");
  assert.strictEqual(helpers.greetingPart(6), "morning");
  assert.strictEqual(helpers.greetingPart(12), "afternoon");
  assert.strictEqual(helpers.greetingPart(19), "afternoon");
  assert.strictEqual(helpers.greetingPart(20), "evening");
  assert.strictEqual(helpers.normalizeCount(5), 5);
  assert.strictEqual(helpers.normalizeCount("20"), 20);
  assert.strictEqual(helpers.normalizeCount(7), 10);
  const profiles = [{ id: "p1", name: "Ana" }, { id: "p2", name: "Luis" }];
  const ok = helpers.resolveDuelPlayers([{ kind: "profile", profileId: "p1" }, { kind: "guest", guestName: "  Invitada  " }], profiles);
  assert.strictEqual(ok.ok, true);
  assert.deepStrictEqual(Array.from(ok.names), ["Ana", "Invitada"]);
  assert.deepStrictEqual(Array.from(ok.profileIds), ["p1", null]);
  assert.strictEqual(helpers.resolveDuelPlayers([{ kind: "profile", profileId: "p1" }, { kind: "profile", profileId: "p1" }], profiles).ok, false);
  assert.strictEqual(helpers.resolveDuelPlayers([{ kind: "profile", profileId: "p1" }, { kind: "guest", guestName: "ana" }], profiles).ok, false, "same name, any case");
  const defaults = helpers.resolveDuelPlayers([{ kind: "guest", guestName: "" }, { kind: "guest", guestName: "" }], profiles);
  assert.deepStrictEqual(Array.from(defaults.names), ["Invitado 1", "Invitado 2"]);
  const unknown = helpers.resolveDuelPlayers([{ kind: "profile", profileId: "ghost" }, { kind: "guest", guestName: "x".repeat(60) }], profiles);
  assert.strictEqual(unknown.names[1].length, 20, "names are capped");
  assert.strictEqual(unknown.profileIds[0], null, "an unknown profile id becomes a guest");
  assert.strictEqual(helpers.resolveDuelPlayers([], profiles).ok, false);
});

test("home: first run is designed (greeting, four modes, disabled review, daily, fact), all through text nodes", async () => {
  const { Ludus, els, shown } = createEnv();
  Ludus.Screens.home.mount(els.homeEl);
  Ludus.router.show("home");
  await flush();
  const root = els.homeEl;
  assert.strictEqual(text(findAll(root, byClass("home-greeting"))[0]), "¡Hola! ¿Empezamos?");
  assert.ok(text(root).includes("Elegí cómo querés entrenar"), "first-run sub line in rioplatense");
  const modes = findAll(root, (el) => el.hasAttribute("data-mode"));
  assert.deepStrictEqual(modes.map((el) => el.getAttribute("data-mode")), ["own", "classics", "review", "duel"]);
  const review = modes.find(byData("data-mode", "review"));
  assert.strictEqual(review.tagName, "DIV", "with nothing to review the card is not a button");
  assert.ok(review.classList.contains("is-disabled"));
  assert.ok(text(review).includes("Todavía no hay errores para repasar"));
  assert.ok(modes.filter((m) => m.tagName === "BUTTON").length === 3);
  assert.ok(findAll(root, byClass("home-daily")).length === 1);
  assert.strictEqual(findAll(root, byClass("mini-board")).length, 1, "the daily position is drawn");
  assert.ok(findAll(root, byClass("home-fact-text"))[0].textContent.length > 20);
  assert.ok(shown.includes("home"));
  const tiles = findAll(root, byClass("home-tile"));
  assert.strictEqual(tiles.length, 3);
  // The page keeps a single h1 and named sections.
  assert.strictEqual(findAll(root, (el) => el.tagName === "H1").length, 1);
  findAll(root, (el) => el.tagName === "SECTION" && el !== root).forEach((section) => assert.ok(section.getAttribute("aria-labelledby") || section.getAttribute("aria-label"), "every section is named"));
});

test("home: mode cards route to the right place", async () => {
  const { Ludus, els, calls } = createEnv();
  Ludus.Screens.home.mount(els.homeEl);
  Ludus.router.show("home");
  await flush();
  const card = (mode) => findAll(els.homeEl, byData("data-mode", mode))[0];
  card("own").click();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(calls.own)), [{ mode: "solo" }]);
  card("classics").click();
  assert.strictEqual(Ludus.router.current(), "classics");
  Ludus.router.show("home");
  const tile = (id) => findAll(els.homeEl, byData("data-fkey", `tile-${id}`))[0];
  tile("progress").click();
  assert.strictEqual(Ludus.router.current(), "progress");
  Ludus.router.show("home");
  tile("museum").click();
  assert.strictEqual(Ludus.router.current(), "museum");
  Ludus.router.show("home");
  tile("settings").click();
  assert.strictEqual(Ludus.router.current(), "settings");
  Ludus.router.show("home");
  // Without Ludus.game.openOwnGamesSetup the card falls back to the setup screen.
  delete Ludus.game.openOwnGamesSetup;
  findAll(els.homeEl, byData("data-mode", "own"))[0].click();
  assert.strictEqual(Ludus.router.current(), "setup");
});

test("home: a populated profile shows stats, due count and an enabled review card", async () => {
  const { Ludus, els } = createEnv();
  await Ludus.Classics.load();
  Ludus.Profile.ensureActive();
  Ludus.Profile.rename(Ludus.Profile.active().id, "Juan");
  seedRounds(Ludus, 12);
  Ludus.Screens.home.mount(els.homeEl);
  Ludus.router.show("home");
  await flush();
  const root = els.homeEl;
  assert.ok(/^(Buen día|Buenas tardes|Buenas noches), Juan$/.test(text(findAll(root, byClass("home-greeting"))[0])));
  assert.ok(text(findAll(root, byClass("home-stats"))[0]).includes("12"), "positions played");
  const review = findAll(root, byData("data-mode", "review"))[0];
  assert.strictEqual(review.tagName, "BUTTON");
  const due = Ludus.Profile.notebook.counts().due;
  assert.ok(due > 0, "the seeded mistakes are due");
  assert.ok(text(review).includes(String(due)), text(review));
  review.click();
  assert.strictEqual(Ludus.router.current(), "notebook");
  // Language switch re-renders the whole hub.
  Ludus.router.show("home");
  Ludus.i18n.setLanguage("en", { persist: false });
  assert.ok(text(root).includes("Choose how to train"), "re-rendered in English");
  assert.ok(/^(Good morning|Good afternoon|Good evening), Juan$/.test(text(findAll(root, byClass("home-greeting"))[0])));
});

test("home: profile and notebook events refresh the hub (coalesced)", async () => {
  const { Ludus, els } = createEnv();
  await Ludus.Classics.load();
  Ludus.Screens.home.mount(els.homeEl);
  Ludus.router.show("home");
  await flush();
  assert.strictEqual(findAll(els.homeEl, byData("data-mode", "review"))[0].tagName, "DIV");
  seedRounds(Ludus, 6);
  await flush();
  assert.strictEqual(findAll(els.homeEl, byData("data-mode", "review"))[0].tagName, "BUTTON", "the notebook filled up while the hub was open");
  assert.ok(text(findAll(els.homeEl, byClass("home-stats"))[0]).includes("6"));
});

test("daily challenge: starts a one-position daily session with its date key; done state has no play button", async () => {
  const { Ludus, els, calls } = createEnv();
  await Ludus.Classics.load();
  Ludus.Screens.home.mount(els.homeEl);
  Ludus.router.show("home");
  await flush();
  const play = findAll(els.homeEl, byData("data-fkey", "daily-play"))[0];
  assert.ok(play, "pending state offers the play button");
  play.click();
  await flush();
  assert.strictEqual(calls.sessions.length, 1);
  const spec = calls.sessions[0];
  const key = Ludus.Screens.home.helpers.localDateKey();
  assert.strictEqual(spec.kind, "daily");
  assert.strictEqual(spec.positions.length, 1);
  assert.strictEqual(spec.positions[0].dailyKey, key);
  assert.strictEqual(spec.positions[0].id, Ludus.Classics.daily(key).id, "the position is the deterministic one for today");
  assert.ok(String(spec.title).includes("Desafío diario"));
  // Completed: a done badge, the accuracy, no play button, a next-day hint.
  Ludus.Profile.daily.complete(key, 91);
  await flush();
  assert.strictEqual(findAll(els.homeEl, byData("data-fkey", "daily-play")).length, 0);
  const daily = findAll(els.homeEl, byClass("home-daily"))[0];
  assert.ok(daily.classList.contains("is-done"));
  assert.ok(text(daily).includes("¡Desafío de hoy completado!"));
  assert.ok(text(daily).includes("91%"));
  assert.ok(text(daily).includes("Volvé mañana"));
  assert.ok(text(daily).includes("Racha del desafío: 1 día"));
  // startDaily() (the "#/daily" route) still works and is the same session.
  await Ludus.Screens.home.startDaily();
  assert.strictEqual(calls.sessions.length, 2);
});

test("daily challenge: a failing classics load shows an error with a retry, never a blank card", async () => {
  const { Ludus, els } = createEnv();
  const realLoad = Ludus.Classics.load;
  let fail = true;
  Ludus.Classics.load = () => (fail ? Promise.reject(new Error("offline")) : realLoad());
  const errors = [];
  const realError = console.error;
  console.error = (...args) => errors.push(args.join(" "));
  try {
    Ludus.Screens.home.mount(els.homeEl);
    Ludus.router.show("home");
    await flush();
    const daily = findAll(els.homeEl, byClass("home-daily"))[0];
    assert.ok(text(daily).includes("No pudimos cargar el desafío de hoy"));
    const retry = findAll(daily, byData("data-fkey", "daily-retry"))[0];
    assert.ok(retry, "a retry button");
    fail = false;
    retry.click();
    await flush();
    assert.strictEqual(findAll(els.homeEl, byClass("mini-board")).length, 1, "the retry loaded the position");
  } finally {
    console.error = realError;
  }
  assert.ok(errors.some((line) => line.includes("daily challenge could not be loaded")));
});

test("duel setup: two players, mix source, count -> startSession with names and profile ids", async () => {
  const { Ludus, els, calls, doc } = createEnv();
  await Ludus.Classics.load();
  const first = Ludus.Profile.ensureActive();
  Ludus.Profile.rename(first.id, "Ana");
  const second = Ludus.Profile.create({ name: "Luis" });
  Ludus.Screens.home.mount(els.homeEl);
  Ludus.router.show("home");
  await flush();
  findAll(els.homeEl, byData("data-mode", "duel"))[0].click();
  const dialog = findAll(doc.body, (el) => el.getAttribute("role") === "dialog" && el.classList.contains("modal"))[0];
  assert.ok(dialog, "the duel dialog opened");
  const selects = findAll(dialog, (el) => el.tagName === "SELECT" && el.getAttribute("id") && el.getAttribute("id").startsWith("duel-who"));
  assert.strictEqual(selects.length, 2);
  assert.strictEqual(selects[0].value, `p:${first.id}`, "player 1 defaults to the active profile");
  assert.strictEqual(selects[1].value, `p:${second.id}`, "player 2 defaults to the other profile");
  const options = findAll(selects[0], (el) => el.tagName === "OPTION").map((o) => o.textContent);
  assert.deepStrictEqual(options, ["Ana", "Luis", "Invitado (escribir un nombre)"]);
  // choose count 5
  const count5 = findAll(dialog, (el) => el.tagName === "INPUT" && el.getAttribute("value") === "5")[0];
  count5.dispatch("change");
  const start = findAll(dialog, (el) => el.classList.contains("btn") && text(el).includes("Empezar duelo"))[0];
  start.click();
  await flush(10);
  assert.strictEqual(calls.sessions.length, 1);
  const spec = calls.sessions[0];
  assert.strictEqual(spec.kind, "classic");
  assert.strictEqual(spec.mode, "duel");
  assert.deepStrictEqual(Array.from(spec.names), ["Ana", "Luis"]);
  assert.deepStrictEqual(Array.from(spec.profileIds), [first.id, second.id]);
  assert.strictEqual(spec.positions.length, 5);
  assert.ok(spec.positions.every((p) => p.reference && p.reference.lines.length));
  assert.ok(String(spec.title).includes("Duelo"));
  assert.ok(dialog.parentNode.classList.contains("is-closing"), "the setup dialog closed once the session started");
});

test("duel setup: the same player twice is refused, guests get default names, own games hands over names", async () => {
  const { Ludus, els, calls, doc } = createEnv();
  await Ludus.Classics.load();
  const first = Ludus.Profile.ensureActive();
  Ludus.Screens.home.mount(els.homeEl);
  Ludus.router.show("home");
  await flush();
  const open = () => {
    findAll(els.homeEl, byData("data-mode", "duel"))[0].click();
    return findAll(doc.body, (el) => el.classList.contains("modal")).pop();
  };
  let dialog = open();
  const selects = findAll(dialog, (el) => el.tagName === "SELECT" && (el.getAttribute("id") || "").startsWith("duel-who"));
  // Only one profile exists: player 2 defaults to a guest.
  assert.strictEqual(selects[1].value, "guest");
  const guestInputs = findAll(dialog, (el) => el.tagName === "INPUT" && (el.getAttribute("id") || "").startsWith("duel-guest"));
  guestInputs[1].value = "Jugador Mismo";
  selects[0].value = "guest";
  selects[0].dispatch("change");
  guestInputs[0].value = "jugador mismo";
  const startButton = () => findAll(dialog, (el) => el.classList.contains("btn") && text(el).includes("Empezar duelo"))[0];
  startButton().click();
  await flush();
  assert.strictEqual(calls.sessions.length, 0, "identical names never start a duel");
  const error = findAll(dialog, byClass("field-error"))[0];
  assert.ok(!error.hidden && text(error).includes("Elegí dos jugadores distintos"));
  // Fix the names, pick "Your games": the wizard is opened with the duel data instead of a session.
  guestInputs[0].value = "";
  guestInputs[1].value = "";
  const own = findAll(dialog, (el) => el.tagName === "INPUT" && el.getAttribute("value") === "own")[0];
  own.dispatch("change");
  startButton().click();
  await flush();
  assert.strictEqual(calls.sessions.length, 0);
  assert.strictEqual(calls.own.length, 1);
  const options = JSON.parse(JSON.stringify(calls.own[0]));
  assert.strictEqual(options.mode, "duel");
  assert.deepStrictEqual(options.names, ["Invitado 1", "Invitado 2"]);
  assert.deepStrictEqual(options.profileIds, [null, null]);
  // Reopening after it closed works, and a second click while it is open does not stack another dialog.
  dialog = open();
  assert.ok(dialog);
  const openCount = () => findAll(doc.body, (el) => el.classList.contains("modal") && !el.parentNode.classList.contains("is-closing")).length;
  assert.strictEqual(openCount(), 1);
  findAll(els.homeEl, byData("data-mode", "duel"))[0].click();
  assert.strictEqual(openCount(), 1, "only one duel dialog at a time");
  assert.ok(first.id);
});

test("duel setup: one classic game needs a game; the chosen game feeds the session", async () => {
  const { Ludus, els, calls, doc } = createEnv();
  await Ludus.Classics.load();
  Ludus.Profile.ensureActive();
  Ludus.Screens.home.mount(els.homeEl);
  Ludus.router.show("home");
  await flush();
  findAll(els.homeEl, byData("data-mode", "duel"))[0].click();
  const dialog = findAll(doc.body, (el) => el.classList.contains("modal")).pop();
  const source = findAll(dialog, (el) => el.tagName === "INPUT" && el.getAttribute("value") === "game")[0];
  source.dispatch("change");
  await flush();
  const gameSelect = findAll(dialog, (el) => el.tagName === "SELECT" && (el.getAttribute("id") || "").endsWith("-game"))[0];
  const gameOptions = findAll(gameSelect, (el) => el.tagName === "OPTION");
  assert.ok(gameOptions.length > 5, "the classics library is listed once loaded");
  const start = () => findAll(dialog, (el) => el.classList.contains("btn") && text(el).includes("Empezar duelo"))[0];
  start().click();
  await flush();
  assert.strictEqual(calls.sessions.length, 0);
  assert.ok(text(findAll(dialog, byClass("field-error"))[0]).includes("Elegí una partida"));
  const game = gameOptions.find((o) => o.getAttribute("value"));
  gameSelect.value = game.getAttribute("value");
  gameSelect.dispatch("change");
  start().click();
  await flush(10);
  assert.strictEqual(calls.sessions.length, 1);
  const spec = calls.sessions[0];
  assert.ok(spec.positions.length > 0);
  assert.ok(spec.positions.every((p) => p.classic.gameId === game.getAttribute("value")));
  assert.ok(String(spec.title).startsWith("Duelo: "));
});

test("home: Next fact moves to another fact without a full re-render and keeps focus", async () => {
  const { Ludus, els } = createEnv();
  Ludus.Screens.home.mount(els.homeEl);
  Ludus.router.show("home");
  await flush();
  const factText = () => text(findAll(els.homeEl, byClass("home-fact-text"))[0]);
  const before = factText();
  const grid = findAll(els.homeEl, byClass("home-modes"))[0];
  const seen = new Set([before]);
  for (let i = 0; i < 3; i += 1) {
    const next = findAll(els.homeEl, byData("data-fkey", "fact-next"))[0];
    next.focus(); // a real click focuses the button first
    next.click();
    seen.add(factText());
  }
  assert.ok(seen.size >= 3, "different facts came up");
  assert.strictEqual(findAll(els.homeEl, byClass("home-modes"))[0], grid, "the rest of the hub was not rebuilt");
  assert.strictEqual(els.homeEl.ownerDocument.activeElement.getAttribute("data-fkey"), "fact-next", "focus stays on the button");
  const live = findAll(els.homeEl, (el) => el.getAttribute("aria-live") === "polite");
  assert.strictEqual(live.length, 1, "one polite live region, only the fact");
});

test("landing: hero is localised, sections render, the start button is untouched, the footer switches language", async () => {
  const { Ludus, els, doc } = createEnv();
  const clicks = [];
  els.startBtn.addEventListener("click", () => clicks.push("start"));
  Ludus.Screens.landing.mount(els.landingEl);
  const root = els.landingEl;
  assert.strictEqual(root.querySelector("#landing-start-btn"), els.startBtn, "the button app.js binds is the same node");
  assert.ok(text(els.startBtn).includes("Empezar a entrenar"));
  assert.ok(text(root.querySelector(".ld-lead")).startsWith("Aprendé ajedrez"));
  const sections = findAll(root, (el) => el.tagName === "SECTION" && el.hasAttribute("aria-labelledby"));
  assert.ok(sections.length >= 4, "steps, sources, privacy and the closing call");
  const steps = findAll(root, byClass("ld-step"));
  assert.strictEqual(steps.length, 3);
  assert.ok(text(steps[0]).includes("Mirá la posición"));
  assert.ok(text(steps[1]).includes("Jugá y mirá qué tan cerca estuviste"));
  assert.ok(text(steps[2]).includes("Entendé el porqué y volvé más tarde"));
  assert.ok(findAll(root, byClass("mini-board")).length >= 2 && findAll(root, byClass("gauge")).length === 1);
  assert.ok(text(findAll(root, byClass("ld-private"))[0]).includes("Sin cuenta"));
  const footer = findAll(root, byClass("ld-footer"))[0];
  assert.ok(text(footer).includes("GPL-3.0-or-later") && text(footer).includes("Stockfish") && text(footer).includes(`Versión ${Ludus.version}`));
  const notices = findAll(footer, (el) => el.tagName === "A")[0];
  assert.strictEqual(notices.getAttribute("href"), "THIRD_PARTY_NOTICES.md");
  // The closing button forwards to the one app.js binds.
  findAll(root, byClass("ld-final"))[0].querySelector("button").click();
  assert.deepStrictEqual(clicks, ["start"]);
  // Footer language switch clicks the header buttons app.js binds, then the page follows language:changed.
  let headerClicks = 0;
  els.els = null;
  const en = doc.getElementById("language-btn-en");
  en.addEventListener("click", () => { headerClicks += 1; Ludus.i18n.setLanguage("en", { persist: false }); });
  const group = findAll(footer, (el) => el.getAttribute("role") === "radiogroup")[0];
  const radios = findAll(group, (el) => el.getAttribute("role") === "radio");
  assert.deepStrictEqual(radios.map((r) => r.getAttribute("aria-checked")), ["true", "false"]);
  radios[1].click();
  assert.strictEqual(headerClicks, 1);
  assert.ok(text(els.startBtn).includes("Start training"), "hero re-localised");
  assert.ok(text(root.querySelector(".ld-lead")).startsWith("Learn chess"));
  assert.ok(text(findAll(root, byClass("ld-step"))[0]).includes("See the position"));
  const radiosAfter = findAll(findAll(root, byClass("ld-footer"))[0], (el) => el.getAttribute("role") === "radio");
  assert.deepStrictEqual(radiosAfter.map((r) => r.getAttribute("aria-checked")), ["false", "true"]);
});

test("landing: the Google sync claim only appears when sign-in is configured", () => {
  const off = createEnv();
  off.Ludus.Screens.landing.mount(off.els.landingEl);
  assert.ok(!text(off.els.landingEl).includes("Sincronización opcional"), "no false promise without a client id");
  assert.ok(text(off.els.landingEl).includes("Vos decidís qué se descarga"));
  const on = createEnv();
  on.Ludus.Auth = { isConfigured: () => true };
  on.Ludus.Screens.landing.mount(on.els.landingEl);
  assert.ok(text(on.els.landingEl).includes("Sincronización opcional"));
});

test("shell: nav, aria-current, notebook badge, streak, language labels, hidden on the game screen", async () => {
  const { Ludus, els, doc, advance } = createEnv();
  await Ludus.Classics.load();
  Ludus.Profile.ensureActive();
  Ludus.shell.mount(els.app);
  const links = findAll(els.nav, (el) => el.tagName === "A");
  assert.deepStrictEqual(links.map((a) => a.getAttribute("data-nav")), ["home", "classics", "notebook", "progress", "museum"]);
  const labelsOf = () => findAll(els.nav, (el) => el.tagName === "A").map((a) => findAll(a, byClass("sh-nav-label"))[0].textContent);
  assert.deepStrictEqual(labelsOf(), ["Inicio", "Clásicos", "Cuaderno", "Progreso", "Historia"]);
  assert.strictEqual(els.nav.getAttribute("aria-label"), "Principal");
  assert.ok(findAll(doc.body, (el) => el.getAttribute("id") === "shell-tabbar").length === 1, "the phone tab bar exists");
  Ludus.router.show("classics");
  assert.strictEqual(doc.body.dataset.screen, "classics");
  const current = findAll(els.nav, (el) => el.getAttribute("aria-current") === "page");
  assert.strictEqual(current.length, 1);
  assert.strictEqual(current[0].getAttribute("data-nav"), "classics");
  // The badge follows the notebook.
  const badge = () => findAll(els.nav, byClass("sh-badge"))[0];
  assert.ok(badge().hidden, "no due cards, no badge");
  seedRounds(Ludus, 8);
  await flush();
  assert.ok(!badge().hidden && Number(text(badge())) > 0);
  assert.ok(text(findAll(els.nav, byClass("sh-badge-text"))[0]).includes("para repasar"));
  // Language: labels follow.
  Ludus.i18n.setLanguage("en", { persist: false });
  assert.deepStrictEqual(labelsOf(), ["Home", "Classics", "Notebook", "Progress", "History"]);
  // Streak is a link to Progress with a text alternative.
  const streak = findAll(els.status, byClass("sh-streak"))[0];
  assert.ok(streak.getAttribute("aria-label"));
  // Hidden while the game is on screen, minimal on the landing, back afterwards.
  Ludus.router.show("game");
  assert.strictEqual(doc.body.dataset.shell, "off");
  assert.ok(els.header.hidden);
  Ludus.router.show("landing");
  assert.strictEqual(doc.body.dataset.shell, "minimal");
  Ludus.router.show("home");
  assert.strictEqual(doc.body.dataset.shell, "on");
  assert.ok(!els.header.hidden);
  Ludus.shell.setVisible(false);
  assert.strictEqual(doc.body.dataset.shell, "off");
  Ludus.shell.setVisible(true);
  assert.strictEqual(doc.body.dataset.shell, "on");
  advance(10);
});

test("shell: profile chip and popover switch profiles, cap at 4, open the add-profile dialog", async () => {
  const { Ludus, els, doc } = createEnv();
  Ludus.Profile.ensureActive();
  Ludus.Profile.rename(Ludus.Profile.active().id, "Ana");
  const luis = Ludus.Profile.create({ name: "Luis" });
  Ludus.shell.mount(els.app);
  const chip = () => findAll(els.status, byClass("sh-profile-chip"))[0];
  assert.strictEqual(chip().getAttribute("aria-expanded"), "false");
  assert.ok(chip().getAttribute("aria-label").startsWith("Perfil de Ana"));
  chip().click();
  assert.strictEqual(chip().getAttribute("aria-expanded"), "true");
  const rows = findAll(els.status, byClass("sh-pop-row"));
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].getAttribute("aria-current"), "true");
  rows[1].click();
  assert.strictEqual(Ludus.Profile.active().id, luis.id, "Ludus.Profile.setActive was used");
  await flush();
  assert.ok(chip().getAttribute("aria-label").startsWith("Perfil de Luis"));
  assert.strictEqual(chip().getAttribute("aria-expanded"), "false", "the popover closed after switching");
  // Escape closes and returns focus to the chip.
  chip().click();
  const wrap = findAll(els.status, byClass("sh-profile"))[0];
  wrap.dispatch("keydown", { key: "Escape" });
  assert.strictEqual(chip().getAttribute("aria-expanded"), "false");
  assert.strictEqual(doc.activeElement, chip());
  // Add profile -> a dialog with a labelled field; creating one adds it and makes it active.
  chip().click();
  findAll(els.status, byClass("sh-pop-add"))[0].click();
  const dialog = findAll(doc.body, byClass("modal")).pop();
  assert.ok(dialog);
  const input = findAll(dialog, (el) => el.tagName === "INPUT")[0];
  const label = findAll(dialog, (el) => el.tagName === "LABEL")[0];
  assert.strictEqual(label.getAttribute("for"), input.getAttribute("id"));
  assert.ok(input.getAttribute("aria-describedby"));
  const create = findAll(dialog, (el) => el.classList.contains("btn-primary"))[0];
  create.click();
  assert.ok(!findAll(dialog, byClass("field-error"))[0].hidden, "an empty name is refused");
  assert.strictEqual(Ludus.Profile.list().length, 2);
  input.value = "Marta";
  create.click();
  assert.strictEqual(Ludus.Profile.list().length, 3);
  assert.strictEqual(Ludus.Profile.active().name, "Marta");
  // Fill to the limit: the add button is disabled with the reason.
  Ludus.Profile.create({ name: "Cuarta" });
  await flush();
  chip().click();
  const add = findAll(els.status, byClass("sh-pop-add"))[0];
  assert.ok(add.hasAttribute("disabled"));
  assert.ok(text(add).includes("Máximo 4 perfiles"));
});

test("shell: hash routes navigate (and #/daily starts the challenge), and never while a game is on", async () => {
  const env = createEnv();
  const { Ludus, els, location, calls } = env;
  await Ludus.Classics.load();
  Ludus.Profile.ensureActive();
  Ludus.Screens.home.mount(els.homeEl);
  Ludus.shell.mount(els.app);
  Ludus.router.show("home");
  // hashchange listener registered on the window (root)
  const fire = () => env.context.window.__hashListeners.forEach((fn) => fn());
  env.context.window.__hashListeners = [];
  env.context.addEventListener = (type, fn) => { if (type === "hashchange") env.context.window.__hashListeners.push(fn); };
  location.hash = "#/notebook";
  Ludus.shell.destroy();
  Ludus.shell.mount(els.app);
  // Boot code shows the landing page right after mounting the shell, which mirrors
  // "no route" into the hash; the cold-start route must survive that.
  Ludus.router.show("landing");
  assert.strictEqual(location.hash, "");
  await flush();
  assert.strictEqual(Ludus.router.current(), "notebook", "the initial hash is applied after boot");
  // the hash mirrors the current screen
  Ludus.router.show("progress");
  assert.strictEqual(location.hash, "#/progress");
  Ludus.router.show("landing");
  assert.strictEqual(location.hash, "", "no route for the landing page");
  // "#/daily": home + the daily session
  Ludus.router.show("home");
  location.hash = "#/daily";
  fire();
  await flush(10);
  assert.strictEqual(calls.sessions.length >= 1, true, "the daily challenge was started");
  // A game in progress ignores hash navigation.
  Ludus.game.isActive = () => true;
  Ludus.router.show("home");
  location.hash = "#/settings";
  fire();
  await flush();
  assert.strictEqual(Ludus.router.current(), "home");
});

test("shell: nav clicks call the router, modified clicks are left to the browser, brand goes home", async () => {
  const { Ludus, els, doc } = createEnv();
  Ludus.Profile.ensureActive();
  Ludus.shell.mount(els.app);
  Ludus.router.show("home");
  const link = (id) => findAll(els.nav, byData("data-nav", id))[0];
  const evt = link("progress").click();
  assert.ok(evt.defaultPrevented, "handled in-app");
  assert.strictEqual(Ludus.router.current(), "progress");
  const modified = link("classics").dispatch("click", { ctrlKey: true });
  assert.ok(!modified.defaultPrevented, "ctrl+click opens the hash link in the browser");
  assert.strictEqual(Ludus.router.current(), "progress");
  doc.getElementById("shell-brand").click();
  assert.strictEqual(Ludus.router.current(), "home");
  // The "More" sheet on phones lists History, Settings and Account.
  const more = findAll(doc.body, byClass("sh-more"))[0];
  more.click();
  const sheet = findAll(doc.body, byClass("sheet")).pop();
  const items = findAll(sheet, byClass("sh-more-item"));
  assert.deepStrictEqual(items.map((el) => text(el)), ["Historia", "Ajustes", "Cuenta"]);
  items[1].click();
  assert.strictEqual(Ludus.router.current(), "settings");
});

test("shell and screens do nothing (and do not throw) without a document", () => {
  const sandbox = { console, setTimeout, clearTimeout, Date, Math, JSON, Object, Array, String, Number, Promise, Map, Set, Intl };
  sandbox.navigator = { languages: ["es"], language: "es" };
  const context = vm.createContext(sandbox);
  ["js/ludus.js", "js/ui/kit.js", "js/ui/shell.js", "js/ui/home.js"].forEach((rel) => vm.runInContext(fs.readFileSync(path.join(repoRoot, rel), "utf8"), context, { filename: rel }));
  const { Ludus } = context;
  assert.strictEqual(Ludus.shell.mount({}), Ludus.shell);
  Ludus.shell.update();
  Ludus.shell.setVisible(false);
  Ludus.Screens.home.mount(null);
  Ludus.Screens.home.show();
  Ludus.Screens.landing.mount(null);
  assert.strictEqual(Ludus.Screens.home.helpers.localDateKey(new Date(2026, 8, 30)), "2026-09-30");
});

runAll().then(() => {
  console.log(`ui-screens.test.js: ${passed} tests passed`);
  // The home hub and the shell keep no timers alive; make sure the process ends.
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
