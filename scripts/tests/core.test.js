"use strict";

// Tests for the game core (app.js) as integrated with the logic layer: sessions
// started with Ludus.game.startSession, the round flow (engine -> Ludus.Scoring ->
// result -> events), hints, duel, abort, the records Profile keeps, and the local
// fallback when the strong engine is not there.
//
// The engine is a deterministic fake behind the transport interface of
// js/engine.js: it answers UCI from canned tables (no Stockfish, no network, no
// wall clock beyond a few milliseconds), so a failure here is a bug in app.js.
//
//   node scripts/tests/core.test.js

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { load, localScripts } = require("./_load.js");
const { createFakeDom, FakeElement } = require("./_fakedom.js");

// The fake elements' style is a bare object; app.js sets CSS custom properties.
Object.defineProperty(FakeElement.prototype, "style", {
  configurable: true,
  get() {
    if (!this._style) this._style = { setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; }, getPropertyValue(name) { return this[name] || ""; } };
    return this._style;
  },
  set(value) {
    Object.assign(this.style, value);
  },
});

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// ---------- the fake engine ----------

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Positions reached by playing moves from the start (so every FEN is legal and
// the table entries below are keyed by them).
function fensAlong(env, ucis) {
  const { Chess, uciToMove } = env.Ludus.chess;
  const game = new Chess();
  const fens = [game.fen()];
  ucis.forEach((uci) => {
    game.makeMove(uciToMove(uci, game));
    fens.push(game.fen());
  });
  return fens;
}

// lines: what a MultiPV search reports (best first, mover point of view);
// moves: what a `searchmoves` search reports for a move outside the lines.
function entry(lines, moves = {}) {
  return { lines, moves };
}

function buildTable(env) {
  const fens = fensAlong(env, ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"]);
  const table = {};
  table[fens[0]] = entry(
    [{ uci: "e2e4", cp: 30, pv: ["e2e4", "e7e5"] }, { uci: "d2d4", cp: 25, pv: ["d2d4", "d7d5"] }, { uci: "g1f3", cp: 20, pv: ["g1f3", "d7d5"] }],
    { a2a4: -40, f2f3: -80, g2g4: -250 },
  );
  table[fens[1]] = entry(
    [{ uci: "e7e5", cp: 25, pv: ["e7e5", "g1f3"] }, { uci: "c7c5", cp: 22, pv: ["c7c5", "g1f3"] }, { uci: "e7e6", cp: 15, pv: ["e7e6", "d2d4"] }],
    { g7g5: -200, a7a6: 5 },
  );
  table[fens[2]] = entry(
    [{ uci: "g1f3", cp: 30, pv: ["g1f3", "b8c6"] }, { uci: "b1c3", cp: 20, pv: ["b1c3", "g8f6"] }, { uci: "f1c4", cp: 18, pv: ["f1c4", "g8f6"] }],
    { d2d3: 5, h2h3: -20, f2f3: -150 },
  );
  table[fens[3]] = entry(
    [{ uci: "b8c6", cp: 25, pv: ["b8c6", "f1b5"] }, { uci: "g8f6", cp: 22, pv: ["g8f6", "f3e5"] }, { uci: "d7d6", cp: 10, pv: ["d7d6", "d2d4"] }],
    { f7f6: -100 },
  );
  table[fens[4]] = entry(
    [{ uci: "f1b5", cp: 35, pv: ["f1b5", "g8f6"] }, { uci: "f1c4", cp: 28, pv: ["f1c4", "g8f6"] }, { uci: "d2d4", cp: 25, pv: ["d2d4", "e5d4"] }],
    { h2h3: -30, a2a3: -35 },
  );
  // A mate in one for White (Qg7# and Qf8# both mate).
  table["7k/5Q2/6K1/8/8/8/8/8 w - - 0 1"] = entry(
    [{ uci: "f7g7", mate: 1, pv: ["f7g7"] }, { uci: "f7f8", mate: 1, pv: ["f7f8"] }],
    { f7f1: 900, g6h6: 0 },
  );
  return { table, fens };
}

function scoreText(value) {
  if (value && typeof value === "object" && "mate" in value) return `score mate ${value.mate}`;
  return `score cp ${value}`;
}

// A transport (see js/engine.js) that answers UCI from the table. `log` collects
// every command the app sent; `options` can break it on purpose.
function createFakeEngine(table, options = {}) {
  const log = [];
  const transports = [];
  function factory() {
    if (options.failStart) throw new Error("no worker in this environment");
    const listeners = { message: new Set(), error: new Set() };
    let multiPv = 1;
    let fen = "";
    let dead = false;
    const emit = (line) => setImmediate(() => {
      if (!dead) listeners.message.forEach((fn) => fn({ data: line }));
    });
    const transport = {
      postMessage(line) {
        log.push(line);
        if (line === "uci") {
          emit("id name FakeFish");
          emit("uciok");
        } else if (line === "isready") {
          emit("readyok");
        } else if (line.startsWith("setoption name MultiPV value ")) {
          multiPv = Number(line.split(" ").pop());
        } else if (line.startsWith("position fen ")) {
          fen = line.slice("position fen ".length);
        } else if (line.startsWith("go")) {
          if (options.dieOnGo) {
            setImmediate(() => listeners.error.forEach((fn) => fn({ message: "engine crashed" })));
            return;
          }
          const searchIndex = line.indexOf(" searchmoves ");
          const searchMoves = searchIndex >= 0 ? line.slice(searchIndex + " searchmoves ".length).split(" ") : null;
          const known = table[fen] || entry([]);
          let lines;
          if (searchMoves) {
            lines = searchMoves.map((uci) => {
              const inLines = known.lines.find((candidate) => candidate.uci === uci);
              const value = inLines ? (inLines.mate !== undefined ? { mate: inLines.mate } : inLines.cp) : (uci in known.moves ? known.moves[uci] : -400);
              return { uci, value, pv: [uci] };
            });
          } else {
            lines = known.lines.slice(0, multiPv).map((candidate) => ({ uci: candidate.uci, value: candidate.mate !== undefined ? { mate: candidate.mate } : candidate.cp, pv: candidate.pv }));
          }
          lines.forEach((candidate, index) => {
            emit(`info depth 14 seldepth 18 multipv ${index + 1} ${scoreText(candidate.value)} nodes 12000 nps 400000 time 30 pv ${candidate.pv.join(" ")}`);
          });
          emit(`bestmove ${lines.length ? lines[0].uci : "(none)"}`);
        }
      },
      addEventListener(type, fn) {
        if (listeners[type]) listeners[type].add(fn);
      },
      removeEventListener(type, fn) {
        if (listeners[type]) listeners[type].delete(fn);
      },
      terminate() {
        dead = true;
      },
    };
    transports.push(transport);
    return transport;
  }
  return {
    factory,
    log,
    transports,
    goCommands: () => log.filter((line) => line.startsWith("go")),
    positions: () => log.filter((line) => line.startsWith("position fen ")),
  };
}

// ---------- the app in a fake DOM ----------

// Loads the logic layer and app.js. The screens (js/ui/*.js) are other people's
// work and are replaced by tiny stand-ins: this file tests the core, not them.
function loadApp(dom, consoleSpy, screenStubs) {
  const uiScripts = localScripts().filter((script) => script.startsWith("js/ui/"));
  const env = load({
    dom,
    console: consoleSpy,
    app: false,
    skip: uiScripts,
    globals: { requestAnimationFrame: (fn) => setTimeout(fn, 0) },
  });
  const Ludus = env.context.Ludus;
  Ludus.ui = {};
  Ludus.Screens = {};
  Ludus.shell = { mounted: 0, mount() { this.mounted += 1; } };
  ["home", "classics", "notebook", "progress", "museum", "settings", "account"].forEach((name) => {
    Ludus.Screens[name] = {
      shown: 0,
      hidden: 0,
      mount(container) { container.appendChild(dom.document.createElement("div")); },
      show() { this.shown += 1; },
      hide() { this.hidden += 1; },
    };
  });
  Object.assign(Ludus.Screens, screenStubs || {});
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "app.js"), "utf8"), env.context, { filename: "app.js" });
  return env;
}

function makeEnv(options = {}) {
  const errors = [];
  const consoleSpy = {
    log() {},
    info() {},
    debug() {},
    warn() {},
    error(...args) {
      errors.push(args.map((arg) => (arg && arg.stack ? arg.stack : String(arg))).join(" "));
    },
  };
  const dom = createFakeDom({ languages: options.languages || ["en"], storageMap: options.storageMap });
  // The very first session of a profile has no clock (first-run behaviour, tested on its own): every other test
  // plays as someone who has been here before.
  if (!options.firstRun) dom.storageMap.set("ludus.firstRun.v1", "1");
  const env = loadApp(dom, consoleSpy, options.screens);
  const Ludus = env.context.Ludus;
  const built = buildTable(env);
  const engine = options.engine === null ? null : createFakeEngine(built.table, options.engineOptions || {});
  if (engine) Ludus.game.configureEngine({ createTransport: engine.factory, minEvalVisibleMs: 0, retryBaseMs: 1 });
  else Ludus.game.configureEngine({ minEvalVisibleMs: 0, retryBaseMs: 1 });

  const events = { started: [], rounds: [], completed: [], toasts: [], sounds: [] };
  // Payloads are copied out of the app's vm context so they compare with deepStrictEqual.
  const copy = (value) => JSON.parse(JSON.stringify(value));
  Ludus.bus.on("session:started", (payload) => events.started.push(copy(payload.session)));
  Ludus.bus.on("round:completed", (payload) => events.rounds.push(copy(payload.round)));
  Ludus.bus.on("session:completed", (payload) => events.completed.push(copy(payload.session)));
  Ludus.ui.toast = (message, opts) => events.toasts.push({ message, opts });
  Ludus.Audio.play = (name) => {
    events.sounds.push(name);
    return true;
  };
  return { env, dom, Ludus, engine, events, errors, fens: built.fens, table: built.table };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(condition, label, timeoutMs = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    let value = false;
    try {
      value = condition();
    } catch (error) {
      value = false;
    }
    if (value) return value;
    await delay(4);
  }
  throw new Error(`timed out waiting for ${label}`);
}

// A value read from inside the app's vm context; objects are copied out as plain JSON
// (a NaN becomes null), so they compare with assert.deepStrictEqual.
const plain = (value) => (value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value);
const state = (t, expression) => {
  const value = t.env.run(`(${expression})`);
  return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value;
};

// The person clicks a piece and then its destination.
function click(t, from, to) {
  t.env.run(`onSquareClick(${JSON.stringify(from)})`);
  t.env.run(`onSquareClick(${JSON.stringify(to)})`);
}

async function waitForResult(t, label = "the result") {
  await waitFor(() => state(t, "STATE.ui.phase") === "result" && state(t, "Boolean(STATE.resultView.context)"), label);
}

async function playAndWait(t, from, to) {
  click(t, from, to);
  await waitForResult(t);
}

// A position as the mistake search of the own games makes it: it knows the best move
// (so a hint is possible) but brings no reference lines (the round analyses it).
function position(t, index, extra = {}) {
  const known = t.table[t.fens[index]];
  return {
    fen: t.fens[index],
    source: "classic",
    bestMoveUci: known ? known.lines[0].uci : undefined,
    meta: { players: "White vs Black", event: "Test", year: "1900", moveNumber: index + 1 },
    ...extra,
  };
}

function assertClean(t) {
  assert.deepStrictEqual(t.errors, [], `unexpected console.error: ${t.errors.join(" | ")}`);
}

// ---------- boot and the bridges ----------

test("boot: a first visit shows the landing page, a returning one goes home", async () => {
  const first = makeEnv();
  assert.strictEqual(first.Ludus.router.current(), "landing");
  assert.strictEqual(first.dom.document.body.dataset.screen, "landing");
  assert.ok(first.dom.document.body.classList.contains("landing-active"));
  assert.ok(first.Ludus.Profile.active(), "a profile exists after boot");

  // The landing's start button marks the page as seen and goes home (not into the wizard).
  first.env.run("startFromLanding()");
  assert.strictEqual(first.Ludus.router.current(), "home");
  assert.strictEqual(first.Ludus.storage.get("ludus.seen.v1", 0), 1);
  assert.ok(!first.dom.document.body.classList.contains("landing-active"));

  const storageMap = new Map(first.dom.storageMap);
  const second = makeEnv({ storageMap });
  assert.strictEqual(second.Ludus.router.current(), "home", "the flag alone is enough");

  // No flag, but rounds in the profile: also home.
  const played = makeEnv();
  played.Ludus.Profile.recordRound({ fen: START, points: 5, accuracy: 50 });
  played.env.run("goHome()");
  const again = makeEnv({ storageMap: new Map(played.dom.storageMap) });
  assert.strictEqual(again.Ludus.router.current(), "home", "a profile with rounds skips the landing page");
  [first, second, played, again].forEach(assertClean);
});

test("boot: one broken screen does not take the app down", async () => {
  const errors = [];
  const consoleSpy = { log() {}, info() {}, debug() {}, warn() {}, error: (...args) => errors.push(args.join(" ")) };
  const dom = createFakeDom({ languages: ["en"] });
  dom.storageMap.set("ludus.seen.v1", "1");
  const env = loadApp(dom, consoleSpy, { notebook: { mount() { throw new Error("boom"); }, show() {}, hide() {} } });
  const Ludus = env.context.Ludus;
  assert.ok(errors.some((line) => line.includes("notebook") && line.includes("failed to mount")), "the failure is reported");
  assert.strictEqual(Ludus.router.current(), "home");
  assert.strictEqual(Ludus.shell.mounted, 1, "the shell was mounted");
  assert.strictEqual(Ludus.router.show("progress"), true, "the healthy screens are registered");
  assert.strictEqual(Ludus.Screens.progress.shown, 1);
  assert.strictEqual(Ludus.router.show("notebook"), false, "the broken one is not");
  assert.strictEqual(Ludus.router.show("game"), true, "the game screen is a router screen");
  assert.ok(dom.document.body.classList.contains("playing-mode"));
  Ludus.router.show("setup");
  assert.ok(!dom.document.body.classList.contains("playing-mode"));
  assert.strictEqual(Ludus.Screens.progress.hidden, 1, "hide() is called when a screen goes away");
  Ludus.router.show("home");

  // If home itself fails to mount, the landing page stands in for it.
  const broken = loadApp(createFakeDom({ languages: ["en"] }), { log() {}, info() {}, debug() {}, warn() {}, error() {} }, { home: { mount() { throw new Error("no home"); } } });
  broken.run("markLandingSeen()");
  broken.run("goHome()");
  assert.strictEqual(broken.context.Ludus.router.current(), "landing", "legacy landing behaviour when home is not there");
  broken.run("startFromLanding()");
  assert.strictEqual(broken.context.Ludus.router.current(), "setup", "and its start button opens the wizard as before");
});

test("the language: app.js falls back to the shared dictionary and both directions stay in sync", async () => {
  const t = makeEnv();
  const { Ludus, env } = t;
  assert.strictEqual(env.run('t("quality.brilliant", {}, "en")'), "Brilliant", "a key app.js does not know comes from Ludus.i18n");
  assert.strictEqual(env.run('t("quality.perfect", {}, "en")'), "Perfect", "its own keys still win");
  assert.strictEqual(env.run('t("no.such.key")'), "no.such.key");

  let changes = 0;
  Ludus.bus.on("language:changed", () => {
    changes += 1;
  });
  env.run('setLanguage("es")');
  assert.strictEqual(Ludus.i18n.lang(), "es", "setLanguage() drives the shared i18n");
  assert.strictEqual(state(t, "STATE.language"), "es");
  assert.strictEqual(changes, 1, "exactly one language:changed, no echo loop");

  Ludus.i18n.setLanguage("en"); // changed from elsewhere (the shell, settings)
  assert.strictEqual(state(t, "STATE.language"), "en", "app.js follows a change made elsewhere");
  assert.strictEqual(changes, 2, "and does not emit it again");
  assert.strictEqual(t.dom.document.documentElement.lang, "en");
  assertClean(t);
});

test("the wizard: openOwnGamesSetup skips step 1 and counts only the visible steps", async () => {
  const t = makeEnv();
  const { Ludus, env } = t;
  Ludus.game.openOwnGamesSetup({ mode: "solo" });
  assert.strictEqual(Ludus.router.current(), "setup");
  assert.strictEqual(state(t, "STATE.setupWizard.mode"), "solo");
  assert.strictEqual(state(t, "STATE.setupWizard.step"), 2, "step 1 is skipped");
  assert.strictEqual(state(t, 'document.getElementById("wizard-step-indicator").textContent'), "Step 1 of 2");
  assert.strictEqual(state(t, 'document.getElementById("wizard-prev-btn").classList.contains("hidden")'), true, "there is no step to go back to");

  Ludus.game.openOwnGamesSetup({ mode: "duel", names: ["Ana", "Beto"] });
  assert.strictEqual(state(t, "STATE.setupWizard.mode"), "duel");
  assert.deepStrictEqual(state(t, "STATE.setupWizard.duelNames"), ["Ana", "Beto"]);
  assert.strictEqual(state(t, "STATE.setupWizard.step"), 2);

  // A duel without names still needs step 1 to ask for them.
  Ludus.game.openOwnGamesSetup({ mode: "duel" });
  assert.strictEqual(state(t, "STATE.setupWizard.step"), 1);
  assert.strictEqual(state(t, 'document.getElementById("wizard-step-indicator").textContent'), "Step 1 of 3");
  assert.strictEqual(state(t, "STATE.setupWizard.mode"), "duel", "with the mode preselected");

  // Back to the start: the next wizard is the full one again.
  env.run("restartToSetup()");
  assert.strictEqual(Ludus.router.current(), "home");
  assert.strictEqual(state(t, "STATE.setupWizard.skipModeStep"), false);
  assertClean(t);
});

// Regression (found by the walkthrough): the router builds document.title from the SHARED dictionary, and the play and setup
// screens are registered by app.js, whose own strings are not in it: the tab said "play.title - Ludus Scaccorum".
test("the document title names the setup and play screens, in both languages", async () => {
  const t = makeEnv();
  const { Ludus, dom } = t;
  Ludus.game.openOwnGamesSetup({ mode: "solo" });
  assert.strictEqual(dom.document.title, "Guided setup - Ludus Scaccorum");
  await Ludus.game.startSession({ kind: "classic", title: "Titles", positions: [position(t, 0), position(t, 1)] });
  assert.strictEqual(Ludus.router.current(), "game");
  assert.strictEqual(dom.document.title, "Training - Ludus Scaccorum");
  Ludus.i18n.setLanguage("es");
  Ludus.router.show("game");
  assert.strictEqual(dom.document.title, "Entrenamiento - Ludus Scaccorum");
  assert.ok(!/\b(play|wizard)\.title\b/.test(dom.document.title), "never a raw key");
  Ludus.game.abort();
  assertClean(t);
});

// ---------- scoring a session ----------

test("a solo session: perfect, mediocre, blunder, skip and timeout, with the documented events", async () => {
  const t = makeEnv();
  const { Ludus, env, events, engine } = t;
  const scoring = Ludus.Scoring;
  await Ludus.game.startSession({
    kind: "classic",
    title: "Test games",
    positions: [position(t, 0), position(t, 1), position(t, 2), position(t, 3), position(t, 4)],
  });
  assert.strictEqual(Ludus.game.isActive(), true);
  assert.strictEqual(Ludus.router.current(), "game");
  assert.strictEqual(events.started.length, 1);
  const started = events.started[0];
  assert.strictEqual(started.kind, "classic");
  assert.strictEqual(started.title, "Test games");
  assert.strictEqual(started.mode, "solo");
  assert.strictEqual(started.positions, 5);
  assert.ok(/^s_/.test(started.id));
  assert.strictEqual(state(t, "STATE.targetPositions"), 5, "the session length is the list");
  assert.strictEqual(state(t, "STATE.analysisContext"), null, "so the session ends after the last one");
  assert.strictEqual(state(t, 'document.getElementById("session-title").textContent'), "Test games");
  assert.strictEqual(state(t, 'document.getElementById("round-status").textContent'), "Position 1 of 5");

  // 1. The engine's best move: 10 points, perfect.
  await playAndWait(t, "e2", "e4");
  let round = events.rounds[0];
  assert.strictEqual(round.points, 10);
  assert.strictEqual(round.qualityCode, "perfect");
  assert.strictEqual(round.isBest, true);
  assert.strictEqual(round.userUci, "e2e4");
  assert.strictEqual(round.userSan, "e4");
  assert.strictEqual(round.bestUci, "e2e4");
  assert.strictEqual(round.source, "classic");
  assert.strictEqual(round.sessionId, started.id);
  assert.strictEqual(round.sessionKind, "classic");
  assert.strictEqual(round.sideToMove, "w");
  assert.strictEqual(round.hintsUsed, 0);
  assert.strictEqual(round.timedOut, false);
  assert.strictEqual(round.profileId, Ludus.Profile.active().id, "solo rounds belong to the active profile");
  assert.ok(round.lines.length >= 1 && round.lines.length <= 3, "at most three compact lines");
  round.lines.forEach((line) => {
    assert.ok(line.uci && typeof line.san === "string" && Number.isFinite(line.score));
    assert.ok(line.pv.length <= 6);
  });
  assert.ok(Number.isFinite(round.timeSpentMs) && round.timeSpentMs >= 0);
  assert.strictEqual(round.meta.event, "Test");
  let context = state(t, "STATE.resultView.context");
  assert.strictEqual(context.kind, "round_solo");
  assert.strictEqual(context.points, 10);
  assert.strictEqual(state(t, 'document.getElementById("result-overlay-points").textContent'), "You earned 10 / 10");
  assert.strictEqual(state(t, "STATE.score"), 10);
  assert.strictEqual(state(t, 'document.getElementById("play-score-value").textContent'), "10", "the header shows the points earned");
  assert.strictEqual(state(t, 'document.getElementById("play-score-max").textContent'), "/ 10", "and what was on offer so far");
  assert.ok(events.sounds.includes("move") && events.sounds.includes("correct"), `sounds: ${events.sounds}`);

  // The context carries what a coach panel needs.
  assert.strictEqual(context.assessment.qualityCode, "perfect");
  assert.strictEqual(context.assessment.maxPoints, 10);
  assert.ok(context.lines.length >= 1);
  assert.strictEqual(context.lines[0].san, "e4");
  assert.strictEqual(context.lines[0].evalText, scoring.formatEval(30, "en"), "lines carry their evaluation, formatted by Scoring");
  assert.deepStrictEqual(context.lines[0].pvSan, ["e4", "e5"]);
  assert.ok(context.fact && context.fact.id && context.fact.text.es && context.fact.text.en, "a curiosity for the round");
  assert.ok(Array.isArray(context.insights.messages));
  assert.strictEqual(context.best.san, "e4");
  assert.strictEqual(context.engine.source, "stockfish");
  assert.strictEqual(context.answers[0].hit, true);

  // The engine was asked once for this position: one MultiPV search (a cache hit later).
  assert.ok(engine.log.includes("setoption name MultiPV value 3"), "the reference is a MultiPV search with the setting's width");
  const goFor = (fen) => engine.log.reduce((count, line, index) => count + (line.startsWith("go") && engine.log[index - 1] === `position fen ${fen}` ? 1 : 0), 0);
  assert.strictEqual(goFor(t.fens[0]), 1);

  // 2. Another move that is not among the lines: searched on its own, scored by how far it is.
  await env.context.nextPosition();
  assert.strictEqual(state(t, "STATE.index"), 1);
  // While the person thinks, the engine is already analysing this position (nothing was asked yet).
  await waitFor(() => engine.log.includes(`position fen ${t.fens[1]}`), "the analysis started while the person thinks");
  assert.strictEqual(events.rounds.length, 1);
  click(t, "g7", "g5"); // -200 against +25: a blunder, not in the lines
  await waitForResult(t);
  round = events.rounds[1];
  assert.strictEqual(round.userUci, "g7g5");
  assert.ok(round.points <= 2.5, `a 225 cp mistake is worth little (got ${round.points})`);
  assert.ok(["bad", "blunder"].includes(round.qualityCode), round.qualityCode);
  assert.strictEqual(round.isBest, false);
  assert.ok(engine.goCommands().some((line) => line.includes("searchmoves g7g5")), "the move outside the lines is searched with searchmoves");
  const expected = scoring.assess({
    lines: [{ uci: "e7e5", score: 25 }, { uci: "c7c5", score: 22 }, { uci: "e7e6", score: 15 }],
    userUci: "g7g5",
    userScore: -200,
    settings: Ludus.Settings.scoringSettings(),
  });
  assert.strictEqual(round.points, expected.points, "the points are exactly what Scoring.assess says");
  assert.strictEqual(round.accuracy, expected.accuracy);
  assert.strictEqual(round.cpLoss, expected.cpLoss);
  assert.ok(events.sounds.includes("wrong"));

  // 3. A mediocre move (-20 cp against +30 best... not in lines).
  await env.context.nextPosition();
  click(t, "d2", "d3"); // +5 against +30
  await waitForResult(t);
  round = events.rounds[2];
  assert.strictEqual(round.userUci, "d2d3");
  assert.ok(round.points > 5 && round.points < 10, `a small inaccuracy keeps most points (got ${round.points})`);
  assert.ok(["good", "very_good", "interesting"].includes(round.qualityCode), round.qualityCode);

  // 4. Skipping the position: nothing to measure, 0 points.
  await env.context.nextPosition();
  // Skipping needs a second tap (UX-018): the first one only arms it and says so.
  t.dom.document.getElementById("skip-btn").dispatch("click");
  await delay(30);
  assert.strictEqual(events.rounds.length, 3, "one tap on skip scores nothing");
  assert.strictEqual(state(t, "STATE.roundSubmitted"), false);
  assert.strictEqual(t.dom.document.getElementById("skip-btn-label").textContent, "Tap again to skip", "the button says what the next tap does");
  t.dom.document.getElementById("skip-btn").dispatch("click");
  await waitForResult(t);
  round = events.rounds[3];
  assert.strictEqual(round.userUci, null);
  assert.strictEqual(round.points, 0);
  assert.strictEqual(round.qualityCode, "no_move");
  assert.strictEqual(round.timedOut, false);
  assert.strictEqual(state(t, 'document.getElementById("result-overlay-points").textContent'), "You did not play a move: 0 pts.");

  // 5. The clock running out.
  await env.context.nextPosition();
  await env.context.submitNoMove("timeout");
  await waitForResult(t);
  round = events.rounds[4];
  assert.strictEqual(round.timedOut, true);
  assert.strictEqual(round.points, 0);
  assert.strictEqual(round.qualityCode, "no_move");
  assert.strictEqual(state(t, 'document.getElementById("result-overlay-points").textContent'), "Time ran out: 0 pts.");

  // The session is recorded the moment its LAST position is answered (leaving afterwards by any road loses
  // nothing, COR-005), and the summary that follows does not record it again.
  assert.strictEqual(events.completed.length, 1, "recorded as soon as the last answer is in");
  await env.context.nextPosition();
  assert.strictEqual(events.completed.length, 1, "once");
  const record = events.completed[0];
  assert.strictEqual(record.id, started.id);
  assert.strictEqual(record.kind, "classic");
  assert.strictEqual(record.title, "Test games");
  assert.strictEqual(record.mode, "solo");
  assert.strictEqual(record.positions, 5);
  assert.strictEqual(record.maxPoints, 50);
  assert.strictEqual(record.points, Math.round(events.rounds.reduce((sum, item) => sum + item.points, 0) * 10) / 10);
  assert.deepStrictEqual(record.roundIds, events.rounds.map((item) => item.id));
  assert.strictEqual(record.byQuality.perfect, 1);
  assert.strictEqual((record.byQuality.bad || 0) + (record.byQuality.blunder || 0), 1);
  assert.strictEqual(record.byQuality.no_move, 2);
  assert.ok(record.durationMs >= 0 && record.avgAccuracy >= 0 && record.avgAccuracy <= 100);
  assert.strictEqual(record.profileId, Ludus.Profile.active().id);
  assert.strictEqual(Ludus.game.isActive(), false, "a finished session is no longer in progress");
  assert.strictEqual(state(t, 'document.getElementById("round-status").textContent'), "Session finished!");
  const summaryText = state(t, 'document.getElementById("result-overlay-points").textContent');
  assert.ok(summaryText.includes("/ 50") && /pts/.test(summaryText), `the live region reads the final score: ${summaryText}`);
  assert.strictEqual(state(t, 'document.getElementById("summary-actions").classList.contains("hidden")'), false, "the summary brings its own actions");
  // Going back to the start does not record it a second time.
  env.run("restartToSetup()");
  assert.strictEqual(events.completed.length, 1);
  assert.strictEqual(Ludus.router.current(), "home");
  assert.strictEqual(state(t, 'document.getElementById("summary-actions").classList.contains("hidden")'), true, "the summary actions are put away when the session is left");

  // Profile recorded it all through the bus.
  assert.strictEqual(Ludus.Profile.rounds().length, 5);
  assert.strictEqual(Ludus.Profile.sessions().length, 1);
  assertClean(t);
});

test("a bad answer creates a notebook card; a notebook review grades it without notebook.grade", async () => {
  const t = makeEnv();
  const { Ludus, env, events } = t;
  const fen = t.fens[0];
  await Ludus.game.startSession({ kind: "classic", title: "Cards", positions: [position(t, 0)] });
  click(t, "g2", "g4");
  await waitForResult(t);
  assert.strictEqual(events.rounds[0].points < 3, true);
  const cards = Ludus.Profile.notebook.list();
  assert.strictEqual(cards.length, 1, "a blunder becomes a card");
  assert.strictEqual(cards[0].fen, fen);
  assert.strictEqual(cards[0].box, 0);
  assert.strictEqual(cards[0].bestUci, "e2e4");
  await env.context.nextPosition();
  env.run("restartToSetup()");

  // Reviewing it: a position of source "notebook" carrying its card and lines.
  let graded = 0;
  const realGrade = Ludus.Profile.notebook.grade;
  Ludus.Profile.notebook.grade = (...args) => {
    graded += 1;
    return realGrade(...args);
  };
  const card = cards[0];
  const searchesBefore = t.engine.log.filter((line) => line === `position fen ${fen}`).length;
  await Ludus.game.startSession({
    kind: "review",
    title: "Review",
    positions: [{ fen: card.fen, source: "notebook", cardId: card.id, bestMoveUci: card.bestUci, reference: { depth: 14, lines: card.lines, origin: "runtime" }, meta: card.meta }],
  });
  click(t, "e2", "e4");
  await waitForResult(t);
  const reviewRound = events.rounds[1];
  assert.strictEqual(reviewRound.source, "notebook");
  assert.strictEqual(reviewRound.sessionKind, "review");
  assert.strictEqual(reviewRound.points, 10);
  assert.strictEqual(graded, 0, "the review is graded by Profile from the round, not by a separate call");
  const after = Ludus.Profile.notebook.get(card.id);
  assert.strictEqual(after.reviews, 1, "the card was reviewed");
  assert.strictEqual(after.box, 1, "and moved up a box");
  assert.strictEqual(t.engine.goCommands().filter((line) => line.includes("movetime")).length >= 1, true);
  // The reference came with the position: no MultiPV search for it (only the first session made one).
  assert.strictEqual(t.engine.log.filter((line) => line === `position fen ${fen}`).length, searchesBefore, "the position's own lines are the reference: nothing is searched");
  Ludus.Profile.notebook.grade = realGrade;
  env.run("restartToSetup()");
  assertClean(t);
});

test("a position that brings its lines is scored against them; a move outside them is searched", async () => {
  const t = makeEnv();
  const { Ludus, events, engine } = t;
  const reference = {
    depth: 20,
    origin: "precomputed",
    lines: [
      { uci: "e2e4", san: "e4", score: 30, pv: ["e2e4", "e7e5"] },
      { uci: "d2d4", san: "d4", score: 25, pv: ["d2d4", "d7d5"] },
    ],
  };
  await Ludus.game.startSession({
    kind: "classic",
    title: "Ref",
    positions: [position(t, 0, { reference, gameMoveUci: "g1f3", gameMoveSan: "Nf3", bestMoveUci: "e2e4" })],
  });
  click(t, "a2", "a4");
  await waitForResult(t);
  const round = events.rounds[0];
  assert.strictEqual(round.userUci, "a2a4");
  assert.strictEqual(round.bestUci, "e2e4");
  // a2a4 = -40 (searched), the game move g1f3 = +20 (searched): no MultiPV search happened.
  assert.ok(!engine.log.includes("setoption name MultiPV value 3"), "no reference search for a position with lines");
  const gos = engine.goCommands();
  assert.ok(gos.some((line) => line.includes("searchmoves a2a4")));
  assert.ok(gos.some((line) => line.includes("searchmoves g1f3")), "the move of the game is evaluated too, to show its evaluation");
  const context = state(t, "STATE.resultView.context");
  assert.strictEqual(context.master.uci, "g1f3");
  assert.strictEqual(context.master.san, "Nf3");
  assert.strictEqual(context.master.evalText, Ludus.Scoring.formatEval(20, "en"));
  assert.strictEqual(context.engine.origin, "precomputed");
  assert.strictEqual(context.lines[0].isBest, true);
  assert.strictEqual(context.lines.find((line) => line.uci === "e2e4").isBest, true);
  assert.ok(round.points > 5 && round.points < 8, `a 70 cp inaccuracy (got ${round.points})`);
  await Ludus.game.abort();
  assertClean(t);
});

test("mates: missing a forced mate is a blunder with its reason; playing the mate is worth ten", async () => {
  const t = makeEnv();
  const { Ludus, events } = t;
  const mateFen = "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1";
  await Ludus.game.startSession({ kind: "classic", title: "Mates", positions: [{ fen: mateFen, source: "classic" }, { fen: mateFen, source: "classic", id: "classic:other" }] });
  click(t, "f7", "f1"); // wins the queen back? no: a "+9" move that misses the mate
  await waitForResult(t);
  const missed = events.rounds[0];
  assert.strictEqual(missed.qualityCode, "blunder");
  assert.ok(missed.points <= 1, `missed mate is capped at 1 point (got ${missed.points})`);
  const context = state(t, "STATE.resultView.context");
  assert.strictEqual(context.assessment.reason, "missed_mate");
  assert.ok(state(t, 'document.getElementById("round-result").textContent').includes("forced mate"), "the reason is explained");
  await t.env.context.nextPosition();
  click(t, "f7", "g7");
  await waitForResult(t);
  assert.strictEqual(events.rounds[1].points, 10);
  assert.ok(["perfect", "great", "brilliant"].includes(events.rounds[1].qualityCode));
  await Ludus.game.abort();
  assertClean(t);
});

// ---------- hints ----------

test("hints: three levels, their cost, and the last one reveals the move for zero points", async () => {
  const t = makeEnv();
  const { Ludus, events, dom } = t;
  const scoring = Ludus.Scoring;
  await Ludus.game.startSession({
    kind: "classic",
    title: "Hints",
    positions: [position(t, 0), position(t, 1), position(t, 2)],
  });
  const hintBtn = dom.document.getElementById("hint-btn");
  // The words of the button live in its label (the icon and the cost chip are decoration).
  const hintText = () => dom.document.getElementById("hint-btn-label").textContent;
  assert.strictEqual(hintBtn.disabled, false, "a position with a known best move offers a hint");
  assert.ok(hintText().includes("15%"), `the button says what level 1 costs: ${hintText()}`);

  // A position whose best move is not known before the answer offers none.
  const blind = { fen: t.fens[0], source: "own", meta: {} };
  await Ludus.game.startSession({ kind: "classic", title: "Blind", positions: [blind] });
  assert.strictEqual(hintBtn.disabled, true, "no known best move, no hint");
  assert.strictEqual(Ludus.game.hint(), null);
  await Ludus.game.startSession({ kind: "classic", title: "Hints", positions: [position(t, 0), position(t, 1), position(t, 2)] });

  const level1 = Ludus.game.hint();
  assert.deepStrictEqual(plain(level1), { level: 1, from: "e2" });
  assert.strictEqual(state(t, "STATE.hintsUsed"), 1);
  await delay(60);
  // A hint speaks through a live region of its own (the clock's milestones cannot overwrite it), in words, with its article.
  assert.strictEqual(dom.document.getElementById("hint-announce").textContent.includes("e2"), true, "announced once, in words");
  assert.ok(/move the white pawn on e2/.test(dom.document.getElementById("hint-announce").textContent), dom.document.getElementById("hint-announce").textContent);
  assert.ok(hintText().includes("35%"), `next: level 2 (${hintText()})`);
  const level2 = Ludus.game.hint();
  assert.deepStrictEqual(plain(level2), { level: 2, from: "e2", to: "e4" });
  assert.ok(hintText().includes("0 pts"), `next: the reveal (${hintText()})`);

  click(t, "e2", "e4");
  await waitForResult(t);
  const hinted = events.rounds[0];
  assert.strictEqual(hinted.hintsUsed, 2);
  const full = scoring.assess({ lines: [{ uci: "e2e4", score: 30 }], userUci: "e2e4", settings: Ludus.Settings.scoringSettings() });
  assert.strictEqual(hinted.points, Math.round(full.points * (1 - 0.35) * 10) / 10, "level 2 costs 35% of the points");
  assert.strictEqual(hinted.points, 6.5);
  assert.strictEqual(hinted.accuracy, 100, "hints never change the accuracy");
  assert.ok(!["brilliant", "great"].includes(hinted.qualityCode));
  assert.strictEqual(Ludus.game.hint(), null, "no hint once the round is scored");
  assert.strictEqual(hintBtn.disabled, true);

  // Level 1 only: 15%.
  await t.env.context.nextPosition();
  assert.deepStrictEqual(plain(Ludus.game.hint()), { level: 1, from: "e7" });
  click(t, "e7", "e5");
  await waitForResult(t);
  assert.strictEqual(events.rounds[1].hintsUsed, 1);
  assert.strictEqual(events.rounds[1].points, 8.5);

  // The third level shows the move and closes the round: 0 points, "skip".
  await t.env.context.nextPosition();
  assert.deepStrictEqual(plain(Ludus.game.hint()), { level: 1, from: "g1" });
  assert.deepStrictEqual(plain(Ludus.game.hint()), { level: 2, from: "g1", to: "f3" });
  const revealed = Ludus.game.hint();
  assert.deepStrictEqual(plain(revealed), { level: 3, from: "g1", to: "f3", uci: "g1f3" });
  assert.strictEqual(state(t, "Boolean(STATE.revealed.best)"), true, "the arrow of the move is on the board");
  await waitForResult(t);
  const reveal = events.rounds[2];
  assert.strictEqual(reveal.hintsUsed, 3);
  assert.strictEqual(reveal.points, 0);
  assert.strictEqual(reveal.userUci, null);
  assert.strictEqual(reveal.qualityCode, "no_move");
  assert.strictEqual(state(t, "STATE.resultView.context.assessment.reason"), "skip");
  assert.strictEqual(state(t, 'document.getElementById("result-overlay-points").textContent'), "Move revealed: 0 pts");
  assert.strictEqual(state(t, "STATE.resultView.context.answers[0].hit"), false, "a revealed answer is never a hit");
  await Ludus.game.abort();
  assertClean(t);
});

test("hints can be switched off by the settings or by the session", async () => {
  const t = makeEnv();
  const { Ludus, dom } = t;
  Ludus.Settings.set("hints.enabled", false);
  await Ludus.game.startSession({ kind: "classic", title: "No hints", positions: [position(t, 0)] });
  assert.strictEqual(Ludus.game.hint(), null);
  assert.strictEqual(dom.document.getElementById("hint-btn").classList.contains("hidden"), true);
  await Ludus.game.abort();
  Ludus.Settings.set("hints.enabled", true);
  await Ludus.game.startSession({ kind: "classic", title: "Session says no", positions: [position(t, 0)], options: { hints: false } });
  assert.strictEqual(Ludus.game.hint(), null, "the session's option wins over the setting");
  await Ludus.game.abort();
  await Ludus.game.startSession({ kind: "classic", title: "Yes", positions: [position(t, 0)], options: { hints: true } });
  assert.strictEqual(Ludus.game.hint().level, 1);
  await Ludus.game.abort();
  assertClean(t);
});

// ---------- the clock ----------

test("the clock: untimed shows an infinity sign and never times out; timed counts down", async () => {
  const t = makeEnv();
  const { Ludus, dom } = t;
  await Ludus.game.startSession({ kind: "classic", title: "Timed", positions: [position(t, 0)], options: { clock: { mode: "timed", seconds: 45 } } });
  assert.notStrictEqual(state(t, "STATE.timer.intervalId === null"), true, "a countdown is running");
  assert.strictEqual(state(t, "STATE.timer.durationMs"), 45000);
  assert.strictEqual(dom.document.getElementById("solo-clock-value").textContent, "00:45");
  await Ludus.game.abort();
  assert.strictEqual(state(t, "STATE.timer.intervalId === null"), true, "abort stops the timer");

  await Ludus.game.startSession({ kind: "classic", title: "Untimed", positions: [position(t, 0)], options: { clock: { mode: "untimed" } } });
  assert.strictEqual(state(t, "STATE.timer.intervalId === null"), true, "no countdown");
  assert.strictEqual(dom.document.getElementById("solo-clock-value").textContent, "∞");
  assert.strictEqual(dom.document.getElementById("solo-clock-rail").classList.contains("is-untimed"), true);
  assert.strictEqual(dom.document.getElementById("solo-clock-rail").classList.contains("hidden"), false, "the rail stays in the DOM and on screen");
  await Ludus.game.abort();

  // The settings decide when the session does not say.
  Ludus.Settings.set("clock.mode", "untimed");
  await Ludus.game.startSession({ kind: "classic", title: "Setting", positions: [position(t, 0)] });
  assert.strictEqual(state(t, "STATE.clockMode"), "untimed");
  await Ludus.game.abort();
  Ludus.Settings.set("clock.mode", "timed");
  Ludus.Settings.set("clock.seconds", 30);
  await Ludus.game.startSession({ kind: "classic", title: "Setting", positions: [position(t, 0)] });
  assert.strictEqual(state(t, "STATE.timer.durationMs"), 30000, "clock.seconds is the round time");
  assert.strictEqual(t.dom.storageMap.has("ludus.setup.v1"), false, "the legacy key is not written any more");
  await Ludus.game.abort();
  assertClean(t);
});

// ---------- duel ----------

test("duel: two players are scored against the same reference in one pass, one record each", async () => {
  const t = makeEnv();
  const { Ludus, env, events, engine } = t;
  const guest = null;
  const linked = Ludus.Profile.active().id;
  await Ludus.game.startSession({
    kind: "classic",
    title: "Duel",
    mode: "duel",
    names: ["Ana", "Beto"],
    profileIds: [linked, guest],
    positions: [position(t, 0), position(t, 1)],
  });
  assert.strictEqual(events.started[0].mode, "duel");
  assert.deepStrictEqual(events.started[0].names, ["Ana", "Beto"]);
  assert.strictEqual(state(t, "duelPlayerName(0)"), "Ana");

  // Player 1 plays the best move: nothing is evaluated yet, the board is handed over.
  click(t, "e2", "e4");
  await waitFor(() => state(t, "STATE.ui.phase") === "handoff_ready", "the handoff");
  assert.strictEqual(events.rounds.length, 0, "nothing is announced until both have played");
  assert.strictEqual(engine.goCommands().length, 0, "and the engine has not been asked yet");

  // Player 2 blunders.
  env.run("revealDuelSecondTurn()");
  assert.strictEqual(state(t, "STATE.duel.currentPlayer"), 1);
  click(t, "g2", "g4");
  await waitForResult(t);

  assert.strictEqual(events.rounds.length, 2, "one record per player");
  const [first, second] = events.rounds;
  assert.strictEqual(first.profileId, linked);
  assert.strictEqual(second.profileId, null, "a guest is emitted with a null profile");
  assert.strictEqual(first.userUci, "e2e4");
  assert.strictEqual(first.points, 10);
  assert.strictEqual(second.userUci, "g2g4");
  assert.ok(second.points < 3);
  assert.strictEqual(first.sessionId, second.sessionId);
  const roots = engine.log.filter((line) => line === "setoption name MultiPV value 3").length;
  assert.strictEqual(roots, 1, "one reference analysis serves both players");
  assert.strictEqual(state(t, "STATE.duel.scores[0]"), 10);
  assert.strictEqual(state(t, "STATE.duel.scores[1]"), second.points);
  assert.strictEqual(state(t, "STATE.duel.hits[0]"), 1);
  assert.strictEqual(state(t, "STATE.duel.hits[1]"), 0);
  assert.ok(state(t, 'document.getElementById("result-overlay-points").textContent').startsWith("R1: Ana 10 · Beto "));
  assert.ok(state(t, 'document.getElementById("result-overlay-points").textContent').includes("edge for Ana"), "the comparison names the winner");
  assert.strictEqual(state(t, "duelMatchScoreText()"), `Ana 10 - ${second.points} Beto (max. 10 pts)`, "the header keeps the match score");

  // The guest's round is not filed under anybody's profile.
  assert.strictEqual(Ludus.Profile.rounds().length, 1);
  assert.strictEqual(Ludus.Profile.rounds()[0].userUci, "e2e4");

  // Second position, then the end.
  await env.context.nextPosition();
  assert.strictEqual(state(t, "STATE.duel.currentPlayer"), 0);
  // From the second position on the first player's clock waits for a tap: the position is covered, the board ignores
  // the touch, nothing runs, and the cover says whose turn it is (and not, like the handoff, that somebody has played).
  assert.strictEqual(state(t, "STATE.ui.phase"), "duel_ready");
  assert.strictEqual(state(t, "STATE.duel.readyWait"), true);
  const startedBefore = state(t, "STATE.roundStartedAt");
  await delay(15);
  assert.strictEqual(state(t, "document.getElementById('game-layout').dataset.phase"), "handoff");
  assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-title").textContent'), "Ana, get ready");
  assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-eyebrow").textContent'), "Position 2 of 2");
  click(t, "e7", "e5");
  assert.strictEqual(state(t, "STATE.roundSubmitted"), false, "a touch on the covered board is ignored");
  assert.strictEqual(state(t, "STATE.roundStartedAt"), startedBefore, "the round has not started behind the cover");
  env.run("revealDuelSecondTurn()");
  assert.strictEqual(state(t, "STATE.ui.phase"), "playing");
  assert.strictEqual(state(t, "STATE.duel.readyWait"), false);
  assert.ok(state(t, "STATE.roundStartedAt") > startedBefore, "the tap starts the round (and its clock)");
  click(t, "e7", "e5");
  await waitFor(() => state(t, "STATE.ui.phase") === "handoff_ready", "the handoff");
  env.run("revealDuelSecondTurn()");
  click(t, "e7", "e5");
  await waitForResult(t);
  await env.context.nextPosition();
  assert.strictEqual(events.completed.length, 1);
  const record = events.completed[0];
  assert.strictEqual(record.mode, "duel");
  assert.strictEqual(record.positions, 2);
  assert.deepStrictEqual(record.duel.names, ["Ana", "Beto"]);
  assert.deepStrictEqual(record.duel.profileIds, [linked, null]);
  assert.strictEqual(record.duel.scores[0], 20);
  assert.strictEqual(record.maxPoints, 40, "both players count");
  assert.strictEqual(record.roundIds.length, 4);
  assert.ok(state(t, 'document.getElementById("session-summary-result").classList.contains("hidden")') === false);
  assert.ok(state(t, 'document.getElementById("result-overlay-points").textContent').includes("Winner: Ana"), "the winner logic works on the 0..10 scale");
  assert.strictEqual(Ludus.Profile.sessions().length, 1, "recorded for the linked profile");
  assert.strictEqual(Ludus.Profile.sessions()[0].duel.me, 0);
  assertClean(t);
});

// ---------- abort ----------

test("abort: stops the timer, the engine work and the overlays, records nothing and goes home", async () => {
  const t = makeEnv();
  const { Ludus, events, engine } = t;
  await Ludus.game.startSession({ kind: "classic", title: "Abort me", positions: [position(t, 0), position(t, 1)] });
  assert.notStrictEqual(state(t, "STATE.timer.intervalId === null"), true);
  click(t, "e2", "e4");
  await waitForResult(t);
  assert.strictEqual(events.rounds.length, 1);
  await t.env.context.nextPosition();
  Ludus.game.hint();
  Ludus.game.abort();
  assert.strictEqual(Ludus.game.isActive(), false);
  assert.strictEqual(Ludus.router.current(), "home");
  assert.strictEqual(state(t, "STATE.timer.intervalId === null"), true);
  assert.strictEqual(state(t, "STATE.session"), null);
  assert.strictEqual(state(t, "STATE.positions.length"), 0);
  assert.strictEqual(state(t, "STATE.hintsUsed"), 0);
  assert.strictEqual(state(t, "STATE.ui.positionSearchState"), null);
  assert.strictEqual(t.dom.document.getElementById("position-search-overlay").classList.contains("hidden"), true);
  assert.strictEqual(t.dom.document.getElementById("result-overlay").classList.contains("hidden"), true);
  assert.ok(!t.dom.document.body.classList.contains("playing-mode"));
  assert.strictEqual(events.completed.length, 0, "an aborted session is not a completed one");
  assert.strictEqual(Ludus.Profile.sessions().length, 0);
  assert.strictEqual(Ludus.Profile.rounds().length, 1, "what was played before stays recorded");
  assert.strictEqual(state(t, 'STATE.engine.mode'), "local", "the engine is dropped at home and loaded again when needed");
  assert.ok(engine.transports.length >= 1);

  // Leaving the game screen by any other road (the shell's tabs) abandons the session too.
  await Ludus.game.startSession({ kind: "classic", title: "Again", positions: [position(t, 0)] });
  assert.strictEqual(Ludus.game.isActive(), true);
  Ludus.router.show("progress");
  assert.strictEqual(Ludus.router.current(), "progress");
  assert.strictEqual(Ludus.game.isActive(), false, "leaving the game screen ends the session");
  assert.strictEqual(state(t, "STATE.timer.intervalId === null"), true);

  // Aborting a session that is mid-evaluation: the late result never lands.
  const slow = makeEnv();
  await slow.Ludus.game.startSession({ kind: "classic", title: "Slow", positions: [position(slow, 0)] });
  click(slow, "e2", "e4");
  slow.Ludus.game.abort();
  await delay(60);
  assert.strictEqual(slow.events.rounds.length, 0, "the round that was being scored is dropped");
  assert.strictEqual(state(slow, "STATE.resultView.visible"), false);
  assertClean(t);
  assertClean(slow);
});

test("starting a session while another is running ends the first quietly", async () => {
  const t = makeEnv();
  const { Ludus, events } = t;
  await Ludus.game.startSession({ kind: "classic", title: "One", positions: [position(t, 0)] });
  await Ludus.game.startSession({ kind: "daily", title: "Two", positions: [position(t, 1, { source: "daily", dailyKey: "2026-09-30" })] });
  assert.strictEqual(events.started.length, 2);
  assert.strictEqual(events.completed.length, 0);
  assert.strictEqual(Ludus.game.session().title, "Two");
  assert.strictEqual(state(t, "STATE.index"), 0);
  await assert.rejects(() => Ludus.game.startSession({ kind: "classic", positions: [] }), /no playable positions/);
  await assert.rejects(() => Ludus.game.startSession({ kind: "classic", positions: [{ fen: "not a fen" }] }), /no playable positions/);
  assert.strictEqual(Ludus.game.session().title, "Two", "a refused start changes nothing");
  await Ludus.game.abort();
  assertClean(t);
});

test("a daily position completes the day after its round", async () => {
  const t = makeEnv();
  const { Ludus } = t;
  const today = new Date();
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  await Ludus.game.startSession({ kind: "daily", title: "Daily", positions: [position(t, 0, { source: "daily", dailyKey: key })] });
  click(t, "e2", "e4");
  await waitForResult(t);
  const status = Ludus.Profile.daily.status(key);
  assert.strictEqual(status.done, true, "the day is done");
  assert.strictEqual(status.accuracy, 100, "with the accuracy of the round");
  assert.strictEqual(status.streak, 1);
  assert.strictEqual(t.events.rounds[0].source, "daily");
  await Ludus.game.abort();
  assertClean(t);
});

// ---------- bus listeners ----------

test("a level up is celebrated once, in the result panel while the play screen is up (no toast over the verdict)", async () => {
  const t = makeEnv();
  const { Ludus, env, events } = t;
  assert.strictEqual(Ludus.Profile.stats().level.level, 1);
  await Ludus.game.startSession({ kind: "classic", title: "Levels", positions: [position(t, 0), position(t, 1), position(t, 2), position(t, 3)] });
  const plays = [["e2", "e4"], ["e7", "e5"], ["g1", "f3"], ["b8", "c6"]];
  for (let index = 0; index < plays.length; index += 1) {
    if (index > 0) await env.context.nextPosition();
    await playAndWait(t, plays[index][0], plays[index][1]);
    if (Ludus.Profile.stats().level.level > 1) break;
  }
  assert.ok(Ludus.Profile.stats().level.level >= 2, "four perfect rounds reach level 2 (300 xp)");
  // While the play screen is up the celebration is not a toast (it covered the verdict, the board and the score): the result
  // card lists it ("Level up!", the achievements), the sound still plays and a screen reader is told once the verdict was read.
  await delay(5);
  assert.strictEqual(events.toasts.filter((toast) => /Level up!|unlocked/.test(toast.message)).length, 0, "no toast over the play screen");
  assert.strictEqual(events.sounds.filter((name) => name === "levelup").length >= 1, true);
  assert.ok(state(t, "STATE.resultView.context.rewards.some((entry) => entry && entry.levelUp)"), "the level up is in the rewards the result panel draws");
  await Ludus.game.abort();
  // The same celebration on any other screen is a toast.
  Ludus.bus.emit("achievement:unlocked", { achievement: { id: "later", name: "Later" } });
  await delay(5);
  assert.strictEqual(events.toasts.filter((toast) => /Later/.test(toast.message)).length, 1, "a toast once the play screen is gone");
  assertClean(t);
});

test("achievements and level-ups are celebrated with a toast and a sound, guarded", async () => {
  const t = makeEnv();
  const { Ludus, events } = t;
  Ludus.bus.emit("achievement:unlocked", { achievement: { id: "x", name: "First steps" }, profileId: "p" });
  // Celebrations are merged into one toast per tick, so a level up and its achievements
  // do not pile up: the toast is there right after the tick.
  await delay(5);
  assert.strictEqual(events.toasts.length, 1);
  assert.ok(events.toasts[0].message.includes("First steps"));
  assert.ok(events.sounds.includes("levelup"));

  // Several at once are one toast, not three.
  Ludus.bus.emit("achievement:unlocked", { achievement: { id: "a", name: "One" } });
  Ludus.bus.emit("achievement:unlocked", { achievement: { id: "b", name: "Two" } });
  Ludus.bus.emit("achievement:unlocked", { achievement: { id: "c", name: "Three" } });
  await delay(5);
  assert.strictEqual(events.toasts.length, 2, "three achievements in the same tick make one toast");
  assert.ok(events.toasts[1].message.includes("3"), "that says how many");

  // Whatever the UI modules do, a missing or throwing toast never breaks the bus.
  Ludus.ui.toast = () => {
    throw new Error("ui broke");
  };
  Ludus.bus.emit("achievement:unlocked", { achievement: { id: "y", name: "Again" } });
  await delay(5);
  delete Ludus.ui.toast;
  Ludus.bus.emit("achievement:unlocked", { achievement: { id: "z", name: "No toast" } });
  await delay(5);
  Ludus.Audio.play = () => {
    throw new Error("audio broke");
  };
  await Ludus.game.startSession({ kind: "classic", title: "Sounds", positions: [position(t, 0)] });
  click(t, "e2", "e4");
  await waitForResult(t);
  assert.strictEqual(events.rounds.length, 1, "a broken sound module does not break the round");
  await Ludus.game.abort();
  assertClean(t);
});

test("the summary reopens one of its positions, shows that round and comes back to the summary", async () => {
  const t = makeEnv();
  const { Ludus, env } = t;
  await Ludus.game.startSession({ kind: "classic", title: "Two", positions: [position(t, 0), position(t, 1)] });
  await playAndWait(t, "e2", "e4");
  await env.context.nextPosition();
  await playAndWait(t, "e7", "e5");
  await env.context.nextPosition();
  const hidden = (id) => state(t, `document.getElementById("${id}").classList.contains("hidden")`);
  assert.strictEqual(state(t, "STATE.resultView.context.kind"), "session_summary");
  assert.strictEqual(hidden("session-summary-result"), false, "the summary is what the panel shows");
  assert.strictEqual(hidden("result-overlay-inner"), true);
  assert.strictEqual(state(t, "STATE.session.rounds.length"), 2, "the answers are kept for the summary");

  env.run("openSummaryRound(0)");
  assert.strictEqual(state(t, "STATE.resultView.context.kind"), "round_solo");
  assert.strictEqual(state(t, "STATE.resultView.review.index"), 0);
  assert.strictEqual(hidden("session-summary-result"), true, "the panel shows the round now, not the summary");
  assert.strictEqual(hidden("result-overlay-inner"), false);
  assert.strictEqual(state(t, 'document.getElementById("round-status").textContent'), "Position 1 of 2", "the header is on that position");
  assert.strictEqual(state(t, "document.getElementById('game-layout').dataset.phase"), "result");
  assert.strictEqual(state(t, 'document.getElementById("next-btn-label").textContent'), "Back to the summary");

  // "Next" from a reopened round is the way back; the session is not started again.
  await env.context.nextPosition();
  assert.strictEqual(state(t, "STATE.resultView.context.kind"), "session_summary");
  assert.strictEqual(state(t, "STATE.resultView.review"), null);
  assert.strictEqual(hidden("session-summary-result"), false);
  assert.strictEqual(hidden("result-overlay-inner"), true);
  assert.strictEqual(t.events.completed.length, 1, "reopening a round never records the session again");
  assert.strictEqual(t.events.started.length, 1);
  await Ludus.game.abort();
  assertClean(t);
});

test("celebrations: a newer toast replaces the older one, and the summary of a solo session lists them instead", async () => {
  const t = makeEnv();
  const { Ludus, env, events } = t;
  let dismissed = 0;
  Ludus.ui.toast = (message, opts) => {
    events.toasts.push({ message, opts });
    return { dismiss() { dismissed += 1; } };
  };
  Ludus.bus.emit("achievement:unlocked", { achievement: { id: "a", name: "One" } });
  await delay(5);
  Ludus.bus.emit("achievement:unlocked", { achievement: { id: "b", name: "Two" } });
  await delay(5);
  assert.strictEqual(events.toasts.length, 2);
  assert.strictEqual(dismissed, 1, "the first toast made room for the second: one celebration on screen at a time");

  // On the play screen celebrations are not toasts at all (the result card lists them, and the summary of a solo session
  // lists the session's): the toast that was still up from another screen is taken down, and no new one is raised.
  await Ludus.game.startSession({ kind: "classic", title: "One", positions: [position(t, 0)] });
  await playAndWait(t, "e2", "e4");
  await delay(5);
  const shownBefore = events.toasts.length;
  assert.ok(dismissed >= 2, "the toast from the other screen is gone once the round's celebration folds into the panel");
  await env.context.nextPosition();
  assert.strictEqual(state(t, "STATE.resultView.context.kind"), "session_summary");
  assert.strictEqual(events.toasts.length, shownBefore, "no toast raised by the round or by the summary");
  Ludus.bus.emit("achievement:unlocked", { achievement: { id: "c", name: "Three" } });
  await delay(5);
  assert.strictEqual(events.toasts.length, shownBefore, "no toast over the summary");
  assert.ok(events.sounds.includes("levelup"), "but the sound still plays");
  await Ludus.game.abort();
  assertClean(t);
});

// ---------- the engine ----------

test("analyzePosition: cache, MultiPV, searchmoves, sharing a running search, abort", async () => {
  const t = makeEnv();
  const { Ludus, engine, fens } = t;
  await Ludus.game.startSession({ kind: "classic", title: "x", positions: [position(t, 0)] });
  await waitFor(() => state(t, "STATE.engine.ready"), "the engine");
  const before = engine.goCommands().length;
  const a = await Ludus.game.analyzePosition(fens[0], { multiPv: 3, movetimeMs: 300 });
  assert.strictEqual(a.source, "stockfish");
  assert.strictEqual(a.lines.length, 3);
  assert.deepStrictEqual(plain(a.lines.map((line) => line.pv[0])), ["e2e4", "d2d4", "g1f3"]);
  assert.deepStrictEqual(plain(a.lines[0].score), { type: "cp", value: 30 });
  const b = await Ludus.game.analyzePosition(fens[0], { multiPv: 3, movetimeMs: 300 });
  assert.strictEqual(b.cached, true, "the same request is answered from the cache");
  assert.strictEqual(engine.goCommands().length, before + 1);
  b.lines[0].score.value = 999; // a caller cannot corrupt the cache
  assert.strictEqual((await Ludus.game.analyzePosition(fens[0], { multiPv: 3, movetimeMs: 300 })).lines[0].score.value, 30);
  const c = await Ludus.game.analyzePosition(fens[0], { multiPv: 2, movetimeMs: 300 });
  assert.strictEqual(c.lines.length, 2, "another width is another search");
  const one = await Ludus.game.analyzePosition(fens[0], { searchMoves: ["a2a4"], movetimeMs: 300 });
  assert.deepStrictEqual(plain(one.lines.map((line) => line.pv[0])), ["a2a4"]);
  assert.deepStrictEqual(plain(one.lines[0].score), { type: "cp", value: -40 });
  assert.ok(engine.goCommands().some((line) => line.endsWith("searchmoves a2a4")), "searchmoves is the last token of go");
  const mate = await Ludus.game.analyzePosition("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1", { multiPv: 2, movetimeMs: 300 });
  assert.deepStrictEqual(plain(mate.lines[0].score), { type: "mate", value: 1 });
  assert.strictEqual(Ludus.Engine.moverScore(mate.lines[0]), 99000, "mate keeps the shared encoding");

  // Two identical requests at once run one search.
  const goCount = engine.goCommands().length;
  const [x, y] = await Promise.all([
    Ludus.game.analyzePosition(fens[1], { multiPv: 3, movetimeMs: 300 }),
    Ludus.game.analyzePosition(fens[1], { multiPv: 3, movetimeMs: 300 }),
  ]);
  assert.strictEqual(engine.goCommands().length, goCount + 1);
  assert.deepStrictEqual(plain(x.lines), plain(y.lines));

  // Progress reaches 1.
  const ratios = [];
  await Ludus.game.analyzePosition(fens[2], { multiPv: 3, movetimeMs: 300, onProgress: (p) => ratios.push(p.ratio) });
  assert.strictEqual(ratios[ratios.length - 1], 1);

  // Aborting cancels what is running: no lines, and the new session is not polluted.
  const pending = Ludus.game.analyzePosition(fens[3], { multiPv: 3, movetimeMs: 300 });
  Ludus.game.abort();
  const aborted = await pending;
  assert.strictEqual(aborted.aborted, true);
  assert.deepStrictEqual(plain(aborted.lines), []);
  assertClean(t);
});

test("without the strong engine everything still works on the local fallback", async () => {
  const t = makeEnv({ engineOptions: { failStart: true } });
  const { Ludus, events } = t;
  await Ludus.game.startSession({ kind: "classic", title: "Local", positions: [position(t, 0), { fen: t.fens[0], source: "classic", id: "classic:ref", reference: { depth: 18, origin: "precomputed", lines: [{ uci: "e2e4", san: "e4", score: 30, pv: ["e2e4"] }, { uci: "d2d4", san: "d4", score: 25, pv: ["d2d4"] }] } }] });
  click(t, "e2", "e4");
  await waitForResult(t);
  assert.strictEqual(Ludus.game.isUsingFallbackEngine(), true);
  const context = state(t, "STATE.resultView.context");
  assert.strictEqual(context.engine.source, "local");
  const round = events.rounds[0];
  assert.ok(round.points >= 0 && round.points <= 10 && Number.isFinite(round.accuracy));
  assert.ok(state(t, 'document.getElementById("round-result").textContent').includes("backup"), "the result says a backup engine did the scoring");
  assert.deepStrictEqual(plain(round.lines), [], "a guess by the shallow search is not kept as the position's lines");
  assert.strictEqual(round.bestUci, null);

  // A position with the master's precomputed lines is scored by transferring only the
  // difference the fallback measures, so the two engines' numbers are never mixed.
  await t.env.context.nextPosition();
  click(t, "e2", "e4");
  await waitForResult(t);
  assert.strictEqual(events.rounds[1].points, 10, "the best move of the reference is the best");
  assert.strictEqual(events.rounds[1].bestUci, "e2e4", "and the reference lines are trusted");
  await t.env.context.nextPosition();
  assertClean(t);

  // The local analysis has the shape of an engine line.
  const local = await Ludus.game.analyzePosition("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1", { movetimeMs: 200 });
  assert.strictEqual(local.source, "local");
  assert.strictEqual(local.lines.length, 1);
  assert.deepStrictEqual(plain(local.lines[0].score), { type: "mate", value: 1 }, "mates keep the shared encoding");
  assert.strictEqual(Ludus.Engine.moverScore(local.lines[0]), 99000);
  const searched = await Ludus.game.analyzePosition(t.fens[0], { searchMoves: ["g2g4"] });
  assert.strictEqual(searched.lines[0].pv[0], "g2g4");
  assert.strictEqual(searched.lines[0].score.type, "cp");
});

// Regression (found by the wave-2 gate with Stockfish blocked): the 3-ply fallback cannot see
// the mate in two of the Immortal Game (Qf6+ Nxf6 Be7#), so it ranked the quiet Kd2 above the
// mating Qf6+. The difference it measures was negative, was clamped to "no loss", and the
// blunder earned 10 points. A move outside the reference lines is now never worth more than
// the weakest of them.
test("the fallback never ranks a move outside the reference lines above the weakest line", async () => {
  const t = makeEnv({ engineOptions: { failStart: true } });
  const { Ludus, events } = t;
  const immortal = "r1bk2nr/p2p1pNp/n2B4/1p1NP2P/6P1/3P1Q2/P1P1K3/q5b1 w - - 1 22";
  await Ludus.game.startSession({
    kind: "classic",
    title: "Immortal",
    positions: [{
      id: "classic:immortal-fallback",
      fen: immortal,
      source: "classic",
      reference: {
        depth: 18,
        origin: "precomputed",
        lines: [
          { uci: "f3f6", san: "Qf6+", score: 98000, pv: ["f3f6", "g8f6", "d6e7"] },
          { uci: "f3f7", san: "Qxf7", score: 96000, pv: ["f3f7"] },
          { uci: "f3f4", san: "Qf4", score: 489, pv: ["f3f4"] },
        ],
      },
    }],
  });
  click(t, "e2", "d2");
  await waitFor(() => state(t, "STATE.ui.phase") === "result" && state(t, "Boolean(STATE.resultView.context)"), "the result of the outside move", 15000);
  assert.strictEqual(Ludus.game.isUsingFallbackEngine(), true);
  const round = events.rounds[0];
  assert.strictEqual(round.userUci, "e2d2");
  assert.strictEqual(round.isBest, false);
  assert.ok(round.points <= 2, `a move that gives up a forced mate is not worth ${round.points}`);
  assert.ok(round.cpLoss > 0, "and the loss is measured, not zero");

  // The best move of the same reference is still the best.
  await Ludus.game.startSession({ kind: "classic", title: "Immortal again", positions: [{ id: "classic:immortal-fallback-2", fen: immortal, source: "classic", reference: { depth: 18, origin: "precomputed", lines: [{ uci: "f3f6", san: "Qf6+", score: 98000, pv: ["f3f6"] }, { uci: "f3f7", san: "Qxf7", score: 96000, pv: ["f3f7"] }] } }] });
  click(t, "f3", "f6");
  await waitFor(() => state(t, "STATE.ui.phase") === "result" && state(t, "Boolean(STATE.resultView.context)"), "the result of the best move", 15000);
  assert.strictEqual(events.rounds[1].points, 10);
  assertClean(t);
});

test("an engine that dies in the middle of a round: the round is still scored, by the fallback", async () => {
  const t = makeEnv({ engineOptions: { dieOnGo: true } });
  const { Ludus, events } = t;
  await Ludus.game.startSession({ kind: "classic", title: "Crash", positions: [position(t, 0)] });
  click(t, "e2", "e4");
  await waitForResult(t);
  assert.strictEqual(events.rounds.length, 1);
  assert.strictEqual(state(t, "STATE.resultView.context.engine.source"), "local");
  assert.strictEqual(state(t, "STATE.engine.mode"), "local");
  await Ludus.game.abort();
  assertClean(t);
});

// ---------- own games ----------

test("own games: the mistake search uses cheap single lines and the threshold of the settings", async () => {
  const t = makeEnv();
  const { Ludus, env, engine, fens } = t;
  assert.strictEqual(await env.context.ensureStockfishLoading(), true, "the engine loads when someone is about to play");

  const game = (san) => ({ tags: { White: "Ana", Black: "Rival", Event: "Casual", Date: "2024.01.01" }, sanMoves: [san], startFen: START });
  const ctxFor = (san) => ({ games: [game(san)], depth: 3, moveTimeMs: 250, thresholdCp: Ludus.Settings.mistakeThresholdCp() });
  const candidate = { gameIdx: 0, playerColor: "w", ply: 0 };

  // g2g4 is 280 cp worse than e2e4: a mistake at every sensitivity.
  const goBefore = engine.goCommands().length;
  const found = await env.context.evaluateCandidateForMistake(candidate, ctxFor("g4"));
  assert.ok(found, "a 280 cp mistake is found");
  assert.strictEqual(found.source, "own");
  assert.strictEqual(found.fen, fens[0]);
  assert.strictEqual(found.bestMoveUci, "e2e4");
  assert.strictEqual(found.gameMoveUci, "g2g4");
  assert.strictEqual(found.gameMoveSan, "g4");
  assert.ok(found.lossCp >= 250);
  assert.ok(/^own:/.test(found.id));
  const searches = engine.goCommands().slice(goBefore);
  assert.strictEqual(searches.length, 2, "one search for the best move and one for the played move");
  assert.ok(searches[1].endsWith("searchmoves g2g4"));
  assert.ok(!engine.log.slice(goBefore).some((line) => /MultiPV value [2-9]/.test(line)), "no MultiPV in the search");

  // The engine's own move is not a mistake and costs a single search.
  const fine = await env.context.evaluateCandidateForMistake(candidate, ctxFor("e4"));
  assert.strictEqual(fine, null);

  // f2f3 is 110 cp worse: a mistake for a sensitive setting, not for a relaxed one.
  Ludus.Settings.set("mistakes.sensitivity", "low"); // 150 cp
  assert.strictEqual(env.run("getEffectiveAnalysisConfig().thresholdCp"), 150, "the threshold is the setting's");
  assert.strictEqual(await env.context.evaluateCandidateForMistake(candidate, ctxFor("f3")), null);
  Ludus.Settings.set("mistakes.sensitivity", "high"); // 50 cp
  assert.strictEqual(env.run("getEffectiveAnalysisConfig().thresholdCp"), 50);
  const sensitive = await env.context.evaluateCandidateForMistake(candidate, { ...ctxFor("f3"), thresholdCp: Ludus.Settings.mistakeThresholdCp() });
  assert.ok(sensitive && sensitive.gameMoveUci === "f2f3");
  await Ludus.game.abort();
  assertClean(t);
});

test("own games: the pipeline joins the same lifecycle (session, events, records)", async () => {
  const t = makeEnv();
  const { Ludus, env, events } = t;
  // A one-mistake context, as loadCandidateAnalysisContext would build it.
  const mistake = {
    id: "own:test",
    source: "own",
    fen: t.fens[0],
    meta: { players: "Ana vs Rival", event: "Casual", year: "2024", moveNumber: 1, sideToMove: "w" },
    gameMoveUci: "g2g4",
    gameMoveSan: "g4",
    gameEvalText: "-2.50",
    bestMoveUci: "e2e4",
    bestMoveSan: "e4",
    bestEvalText: "+0.30",
    lossCp: 280,
    thresholdUsed: 80,
    phase: "opening",
    gameIndex: 1,
  };
  env.run("STATE.targetPositions = 1; STATE.setupWizard.username = \"Ana\"; STATE.gameFormat = \"solo\"");
  const ctx = { games: [], targetName: "Ana", depth: 3, moveTimeMs: 250, thresholdCp: 80, candidates: [], total: 1, analyzed: 1, detected: 1, cursor: 1, usedGameIndices: new Set(), uniqueGameCount: 1, repeatMistakes: [] };
  env.run("STATE.analysisContext = null");
  env.context.enterPlayModeWithFirstPosition(mistake, ctx);
  assert.strictEqual(Ludus.router.current(), "game");
  assert.strictEqual(events.started.length, 1);
  assert.strictEqual(events.started[0].kind, "own");
  assert.ok(events.started[0].title.includes("Ana"), events.started[0].title);
  click(t, "e2", "e4");
  await waitForResult(t);
  assert.strictEqual(events.rounds[0].source, "own");
  assert.strictEqual(events.rounds[0].sessionKind, "own");
  assert.strictEqual(events.rounds[0].userUci, "e2e4");
  assert.strictEqual(events.rounds[0].masterUci, "g2g4", "the move of the game is recorded as the master's");
  assert.strictEqual(state(t, "STATE.resultView.context.master.uci"), "g2g4");
  await env.context.nextPosition();
  assert.strictEqual(events.completed.length, 1);
  assert.strictEqual(events.completed[0].kind, "own");
  await Ludus.game.abort();
  assertClean(t);
});

// ---------- result analysis mode ----------

// Regression (found by the wave-2 gate in a real browser): entering "Explore board" drew
// the snapshot while the phase was still "result", so all 64 squares kept aria-disabled
// "true" and a "not interactive" label although the board was already playable. The fake
// DOM has no selectors, so the test watches what renderBoard() sees when it draws: that
// is what the attribute and the label are derived from.
test("result analysis: the explore board is drawn as playable, also after a reset", async () => {
  const t = makeEnv();
  const { Ludus } = t;
  await Ludus.game.startSession({ kind: "classic", title: "Explore", positions: [position(t, 0), position(t, 1)] });
  await playAndWait(t, "e2", "e4");
  assert.strictEqual(state(t, "boardInputAcceptsMoves()"), false, "while the result is shown the board does not take moves");

  t.env.run(`globalThis.__drawn = [];
    (function () {
      const original = renderBoard;
      renderBoard = function () {
        globalThis.__drawn.push({ phase: STATE.ui.phase, accepts: boardInputAcceptsMoves() });
        return original.apply(this, arguments);
      };
    })();`);

  t.env.run("enterResultAnalysisMode()");
  assert.strictEqual(state(t, "STATE.ui.phase"), "result_analysis");
  let drawn = state(t, "__drawn");
  assert.ok(drawn.length >= 1, "entering analysis draws the board");
  assert.ok(drawn.every((entry) => entry.accepts === true && entry.phase === "result_analysis"), `drawn as playable: ${JSON.stringify(drawn)}`);

  click(t, "d2", "d4");
  t.env.run("__drawn.length = 0; resetResultAnalysisBoard()");
  assert.strictEqual(state(t, "STATE.ui.phase"), "result_analysis", "a reset stays in analysis");
  drawn = state(t, "__drawn");
  assert.ok(drawn.length >= 1, "a reset draws the board again");
  assert.ok(drawn.every((entry) => entry.accepts === true), `the reset board is drawn as playable: ${JSON.stringify(drawn)}`);
  assertClean(t);
});

// ---------- overlay facts ----------

test("the thinking overlay no longer rotates facts by itself: it mounts and destroys the carousel", async () => {
  const fs = require("fs");
  const path = require("path");
  const source = fs.readFileSync(path.join(__dirname, "..", "..", "app.js"), "utf8");
  assert.ok(!/ROUND_THINKING_FACTS|ROUND_THINKING_MESSAGES|startRoundThinkingMessages/.test(source), "the 1.7 s rotation is gone");
  const t = makeEnv();
  const { env } = t;
  const created = [];
  t.Ludus.Reader.createCarousel = (container, options) => {
    const carousel = { container, options, started: 0, destroyed: 0, start() { this.started += 1; }, destroy() { this.destroyed += 1; } };
    created.push(carousel);
    return carousel;
  };
  env.run('showPositionSearchOverlay("Searching", "", { cancellable: true, facts: true })');
  assert.strictEqual(created.length, 1, "a long wait shows a carousel");
  assert.strictEqual(created[0].started, 1);
  assert.strictEqual(created[0].options.onlyWhile(), true, "it rotates only while the wait lasts");
  env.run('showPositionSearchOverlay("Searching", "again", { cancellable: true, facts: true })');
  assert.strictEqual(created.length, 1, "showing the overlay again keeps the carousel it has");
  env.run("hidePositionSearchOverlay()");
  assert.strictEqual(created[0].destroyed, 1, "hiding the overlay destroys it");
  assert.strictEqual(created[0].options.onlyWhile(), false);

  // A short evaluation does not flash one: it is held back.
  env.run('showPositionSearchOverlay("Evaluating", "", { showProgress: true, progressRatio: 0, facts: true, factsDelayMs: 900 })');
  assert.strictEqual(created.length, 1);
  env.run("hidePositionSearchOverlay()");
  await delay(30);
  assert.strictEqual(created.length, 1, "hidden before the delay: never created");

  // The wizard's waiting area has one too.
  env.run("startWizardFacts()");
  assert.strictEqual(created.length, 2);
  assert.strictEqual(created[1].options.onlyWhile(), false, "the wizard's follows the analysis state");
  env.run("STATE.ui.setupAnalyzing = true");
  assert.strictEqual(created[1].options.onlyWhile(), true);
  env.run("stopWizardFacts(); STATE.ui.setupAnalyzing = false");
  assert.strictEqual(created[1].destroyed, 1);
  assertClean(t);
});

// ---------- run ----------

(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ok  ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`  FAIL ${name}`);
      console.error(error && error.stack ? error.stack : error);
    }
  }
  if (failed) {
    console.error(`core.test.js: ${failed} of ${tests.length} failed`);
    process.exit(1);
  }
  console.log(`core.test.js passed (${tests.length} tests)`);
  // The app keeps a few timers alive (clock ticks, retries): the tests are done.
  process.exit(0);
})();
