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
const { createFakeDom, FakeElement, createThrowingLocalStorage } = require("./_fakedom.js");

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
          // A search that was given a depth stops there (the way UCI does); the others report what the test says
          // (options.rootDepth for MultiPV, options.moveDepth for a single move), 14 by default.
          const asked = /\bdepth (\d+)/.exec(line);
          const reported = asked ? Number(asked[1]) : (searchMoves ? options.moveDepth : options.rootDepth) || 14;
          lines.forEach((candidate, index) => {
            emit(`info depth ${reported} seldepth 18 multipv ${index + 1} ${scoreText(candidate.value)} nodes 12000 nps 400000 time 30 pv ${candidate.pv.join(" ")}`);
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
  const dom = createFakeDom({ languages: options.languages || ["en"], storageMap: options.storageMap, localStorage: options.localStorage });
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

// ---------- PF-1: the learner's move is judged on the best line's terms ----------

// "go movetime 1500 depth 16 searchmoves g7g5" -> { movetime: 1500, depth: 16, searchmoves: ["g7g5"] }
function parseGo(line) {
  const out = { movetime: null, depth: null, searchmoves: null };
  const movetime = /\bmovetime (\d+)/.exec(line);
  const depth = /\bdepth (\d+)/.exec(line);
  const searchIndex = line.indexOf(" searchmoves ");
  if (movetime) out.movetime = Number(movetime[1]);
  if (depth) out.depth = Number(depth[1]);
  if (searchIndex >= 0) out.searchmoves = line.slice(searchIndex + " searchmoves ".length).split(" ");
  return out;
}

test("PF-1: a move outside the lines is searched to the depth of the best line, with at least its time", async () => {
  const t = makeEnv({ engineOptions: { rootDepth: 16, moveDepth: 22 } });
  const { Ludus, events, engine } = t;
  // No lines of its own: the round searches the root with MultiPV (the best line reaches depth 16) and then the move.
  await Ludus.game.startSession({ kind: "classic", title: "Terms", positions: [position(t, 1)] });
  click(t, "g7", "g5"); // not among the lines
  await waitForResult(t);
  const gos = engine.goCommands().map(parseGo);
  const roots = gos.filter((go) => !go.searchmoves);
  const moves = gos.filter((go) => go.searchmoves && go.searchmoves[0] === "g7g5");
  assert.strictEqual(roots.length, 1, "one MultiPV search for the best line");
  assert.strictEqual(roots[0].depth, null, "the best line is searched for a time");
  assert.strictEqual(moves.length, 1, "and the move once");
  assert.strictEqual(moves[0].depth, 16, "to the depth the best line reached, not to the depth a single move could reach in the same time");
  assert.ok(moves[0].movetime >= roots[0].movetime, `never a smaller time ceiling (${moves[0].movetime} against ${roots[0].movetime})`);
  assert.ok(moves[0].movetime <= 3500, "and never past the longest search a round allows");
  assert.strictEqual(events.rounds[0].userUci, "g7g5");
  assert.ok(events.rounds[0].points <= 2.5, "and the score is still the move's own");
  await Ludus.game.abort();
  assertClean(t);
});

test("PF-1: a position's own lines carry their depth: the answer and the move of the game are searched to it", async () => {
  const t = makeEnv();
  const { Ludus, engine } = t;
  const reference = {
    depth: 18,
    origin: "precomputed",
    lines: [
      { uci: "e2e4", san: "e4", score: 30, pv: ["e2e4", "e7e5"] },
      { uci: "d2d4", san: "d4", score: 25, pv: ["d2d4", "d7d5"] },
    ],
  };
  await Ludus.game.startSession({ kind: "classic", title: "Ref", positions: [position(t, 0, { reference, gameMoveUci: "g1f3", gameMoveSan: "Nf3", bestMoveUci: "e2e4" })] });
  click(t, "a2", "a4");
  await waitForResult(t);
  const gos = engine.goCommands().map(parseGo);
  assert.ok(!gos.some((go) => !go.searchmoves), "no reference search: the lines came with the position");
  const answer = gos.find((go) => go.searchmoves && go.searchmoves[0] === "a2a4");
  const game = gos.find((go) => go.searchmoves && go.searchmoves[0] === "g1f3");
  assert.strictEqual(answer.depth, 18, "the learner's move reaches the depth the offline pass gave the best line");
  assert.strictEqual(game.depth, 18, "and so does the move of the game, shown next to it");
  assert.ok(answer.movetime >= 1000 && answer.movetime <= 3500, `a ceiling, not the budget (${answer.movetime})`);
  await Ludus.game.abort();
  assertClean(t);
});

test("PF-1: a depth is no budget when the best line is a mate or only a few plies deep: then it is the time, as before", async () => {
  // Mate: the engine stops at the first mate it finds, at any depth.
  const mate = makeEnv();
  const mateFen = "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1";
  await mate.Ludus.game.startSession({ kind: "classic", title: "Mate", positions: [{ fen: mateFen, source: "classic" }] });
  click(mate, "f7", "f1");
  await waitForResult(mate);
  const mateMove = mate.engine.goCommands().map(parseGo).find((go) => go.searchmoves && go.searchmoves[0] === "f7f1");
  assert.ok(mateMove, "the move was searched");
  assert.strictEqual(mateMove.depth, null, "no depth to match when the best line is a forced mate");
  assert.ok(mateMove.movetime > 0);
  await mate.Ludus.game.abort();
  assertClean(mate);

  // Too shallow to be a budget (a slow device that got to 6 plies).
  const slow = makeEnv({ engineOptions: { rootDepth: 6 } });
  await slow.Ludus.game.startSession({ kind: "classic", title: "Slow", positions: [position(slow, 1)] });
  click(slow, "g7", "g5");
  await waitForResult(slow);
  const slowMove = slow.engine.goCommands().map(parseGo).find((go) => go.searchmoves && go.searchmoves[0] === "g7g5");
  assert.strictEqual(slowMove.depth, null, "6 plies is not a depth worth matching");
  await slow.Ludus.game.abort();
  assertClean(slow);
});

test("PF-1: a move is never searched twice: the move of the game that is the answer, and the same round played again", async () => {
  const t = makeEnv();
  const { Ludus, engine } = t;
  const searchesOf = (uci) => engine.goCommands().map(parseGo).filter((go) => go.searchmoves && go.searchmoves[0] === uci).length;
  // The person plays the move that was played in the game, and it is not among the lines: one search serves the answer and the master's eval.
  const play = async () => {
    await Ludus.game.startSession({ kind: "classic", title: "Once", positions: [position(t, 1, { gameMoveUci: "g7g5", gameMoveSan: "g5" })] });
    click(t, "g7", "g5");
    await waitForResult(t);
  };
  await play();
  assert.strictEqual(searchesOf("g7g5"), 1, "the answer and the move of the game are one search");
  const roots = engine.goCommands().map(parseGo).filter((go) => !go.searchmoves).length;
  assert.strictEqual(roots, 1);
  await Ludus.game.abort();
  // The same position and the same move in another session (a rematch, a review): the engine is not asked again.
  await play();
  assert.strictEqual(searchesOf("g7g5"), 1, "the same position and move are answered from the cache");
  assert.strictEqual(engine.goCommands().map(parseGo).filter((go) => !go.searchmoves).length, roots, "and so is the best line");
  await Ludus.game.abort();
  assertClean(t);
});

test("PF-1: the backup engine searches the best line and the learner's move to the same fixed depth", async () => {
  const t = makeEnv({ engineOptions: { failStart: true } });
  const { Ludus, fens } = t;
  await Ludus.game.startSession({ kind: "classic", title: "Local", positions: [position(t, 1)] });
  await waitFor(() => Ludus.game.isUsingFallbackEngine(), "the fallback");
  const best = await Ludus.game.analyzePosition(fens[1], { multiPv: 3, movetimeMs: 300 });
  const move = await Ludus.game.analyzePosition(fens[1], { searchMoves: ["g7g5"], depth: 16, movetimeMs: 600 });
  assert.strictEqual(best.source, "local");
  assert.strictEqual(move.source, "local");
  assert.strictEqual(best.depth, move.depth, "the same depth for both, whatever depth was asked of the strong engine");
  await Ludus.game.abort();
  assertClean(t);
});

test("PF-1: the ceiling of a move's search is never below the best line's time and the whole round stays under the hard cap", async () => {
  const t = makeEnv();
  const { Ludus } = t;
  for (const strength of ["fast", "balanced", "deep"]) {
    Ludus.Settings.set("engine.strength", strength);
    for (const answers of [1, 2]) {
      for (const lines of [false, true]) {
        const plan = state(t, `getRoundEvaluationPlan(new Chess(), ${lines ? '{ reference: { depth: 18, lines: [{ uci: "e2e4", score: 30, pv: ["e2e4"] }] } }' : "{}"}, ${answers})`);
        assert.ok(plan.moveMovetimeMs >= plan.movetimeMs, `${strength}/${answers}/${lines}: ${plan.moveMovetimeMs} < ${plan.movetimeMs}`);
        assert.ok(plan.moveMovetimeMs <= 3500, `${strength}: the longest search a round allows`);
        assert.ok(plan.totalBudgetMs <= 10000, `${strength}/${answers}/${lines}: the round's ceiling is ${plan.totalBudgetMs}`);
      }
    }
  }
  assertClean(t);
});

test("mates: missing a forced mate costs points and says why; playing the mate is worth ten", async () => {
  const t = makeEnv();
  const { Ludus, events } = t;
  const mateFen = "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1";
  await Ludus.game.startSession({ kind: "classic", title: "Mates", positions: [{ fen: mateFen, source: "classic" }, { fen: mateFen, source: "classic", id: "classic:other" }] });
  click(t, "f7", "f1"); // wins the queen back? no: a "+9" move that misses the mate
  await waitForResult(t);
  const missed = events.rounds[0];
  // QA pass (COR-011): a missed mate costs a fixed amount on top of the win% given up instead of a cap at 1.0, so a
  // move that keeps the win (this one keeps almost all of it) is "dubious", far from the mate's 10 and from a blunder.
  assert.ok(["dubious", "bad", "blunder"].includes(missed.qualityCode), `missed mate in one: ${missed.qualityCode}`);
  assert.ok(missed.points <= 5, `a missed mate in one never scores like a good move (got ${missed.points})`);
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

  // The first position starts covered too (PF-2): the clock of the player who goes first waits for a tap, the board ignores
  // the touch, and the cover says who goes first, that the device goes to them and that nobody has played yet.
  assert.strictEqual(state(t, "STATE.ui.phase"), "duel_ready");
  assert.strictEqual(state(t, "STATE.duel.readyWait"), true);
  assert.strictEqual(state(t, "STATE.duel.firstPlayer"), 0, "the first player of the duel starts the first position");
  await delay(60); // the live region is refilled 30 ms after it is emptied
  assert.strictEqual(state(t, "document.getElementById('game-layout').dataset.phase"), "handoff");
  assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-title").textContent'), "Ana, get ready");
  assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-eyebrow").textContent'), "Position 1 of 2");
  assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-subtitle").textContent'), "Pass the device to Ana, who goes first this time. Beto waits without looking. The clock starts when you tap the screen.");
  assert.strictEqual(state(t, 'document.getElementById("play-announce").textContent').startsWith("Position 1 of 2. Ana, get ready. Pass the device to Ana"), true, "a screen reader is told, politely, once");
  const roundOneStarted = state(t, "STATE.roundStartedAt");
  click(t, "e2", "e4");
  assert.strictEqual(state(t, "STATE.roundSubmitted"), false, "a touch on the covered board is ignored");
  assert.strictEqual(state(t, "STATE.roundStartedAt"), roundOneStarted, "the round has not started behind the cover");
  env.run("revealDuelSecondTurn()");
  assert.strictEqual(state(t, "STATE.ui.phase"), "playing");
  assert.strictEqual(state(t, "STATE.duel.readyWait"), false);
  assert.ok(state(t, "STATE.roundStartedAt") > roundOneStarted, "the tap starts the round (and its clock)");

  // Player 1 plays the best move: nothing is evaluated yet, the board is handed over.
  click(t, "e2", "e4");
  await waitFor(() => state(t, "STATE.ui.phase") === "handoff_ready", "the handoff");
  assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-title").textContent'), "Pass the device to Beto");
  assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-eyebrow").textContent'), "Ana has played");
  assert.strictEqual(events.rounds.length, 0, "nothing is announced until both have played");
  // The engine may already be searching the position (the reference search starts while the first player thinks, behind the
  // cover too), but nobody's move has been searched: nothing is scored until both have played.
  assert.ok(engine.goCommands().every((line) => !line.includes("searchmoves")), "no move was asked of the engine yet");

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
  // What the round earned is kept per player (never added together): the profile's XP on its player, nothing for the guest,
  // and the coach gets it card by card.
  assert.ok(state(t, "STATE.session.rewards.players[0].xp") > 0, "the profile player's XP");
  assert.strictEqual(state(t, "STATE.session.rewards.players[1].xp"), 0, "a guest earns nothing");
  assert.strictEqual(state(t, "sessionRewardsView().players.length"), 2);
  assert.strictEqual(state(t, "sessionRewardsView().xp"), undefined, "no combined experience card in a duel");
  assert.strictEqual(state(t, "duelReviewPlayers().length >= 0"), true);
  assert.ok(state(t, "duelReviewPlayers().every((player) => player.profileId && player.name)"), "only profile players can review");

  // Second position, then the end. The players take turns going first (PF-2): this time it is Beto, so his clock is the one
  // that waits for a tap, the cover names him, and Ana is the one who is handed the device after he has played.
  assert.deepStrictEqual(state(t, "STATE.resultView.context.answers.map((answer) => answer.name)"), ["Ana", "Beto"], "the cards are in player order");
  await env.context.nextPosition();
  assert.strictEqual(state(t, "STATE.duel.firstPlayer"), 1, "the second player starts the second position");
  assert.strictEqual(state(t, "STATE.duel.currentPlayer"), 1);
  assert.strictEqual(state(t, "STATE.ui.phase"), "duel_ready");
  assert.strictEqual(state(t, "STATE.duel.readyWait"), true);
  const startedBefore = state(t, "STATE.roundStartedAt");
  await delay(15);
  assert.strictEqual(state(t, "document.getElementById('game-layout').dataset.phase"), "handoff");
  assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-title").textContent'), "Beto, get ready");
  assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-eyebrow").textContent'), "Position 2 of 2");
  assert.ok(state(t, 'document.getElementById("handoff-overlay-subtitle").textContent').startsWith("Pass the device to Beto, who goes first this time. Ana waits without looking."));
  assert.strictEqual(state(t, 'document.getElementById("duel-b").getAttribute("aria-current")'), "true", "the scoreboard points at who goes first");
  assert.strictEqual(state(t, 'document.getElementById("duel-a").getAttribute("aria-current")'), null);
  click(t, "e7", "e5");
  assert.strictEqual(state(t, "STATE.roundSubmitted"), false, "a touch on the covered board is ignored");
  assert.strictEqual(state(t, "STATE.roundStartedAt"), startedBefore, "the round has not started behind the cover");
  env.run("revealDuelSecondTurn()");
  assert.strictEqual(state(t, "STATE.ui.phase"), "playing");
  assert.strictEqual(state(t, "STATE.duel.readyWait"), false);
  assert.ok(state(t, "STATE.roundStartedAt") > startedBefore, "the tap starts the round (and its clock)");
  click(t, "e7", "e5");
  await waitFor(() => state(t, "STATE.ui.phase") === "handoff_ready", "the handoff");
  assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-title").textContent'), "Pass the device to Ana", "Beto went first, so Ana is next");
  assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-eyebrow").textContent'), "Beto has played");
  env.run("revealDuelSecondTurn()");
  assert.strictEqual(state(t, "STATE.duel.currentPlayer"), 0, "Ana moves second");
  assert.strictEqual(state(t, 'document.getElementById("duel-a").getAttribute("aria-current")'), "true");
  click(t, "e7", "e5");
  await waitForResult(t);
  // However the turns went, the answers, the scores and the records belong to the same people in the same places.
  assert.deepStrictEqual(state(t, "STATE.resultView.context.answers.map((answer) => answer.name)"), ["Ana", "Beto"]);
  assert.deepStrictEqual(state(t, "STATE.resultView.context.answers.map((answer) => answer.playerIndex)"), [0, 1]);
  assert.deepStrictEqual(events.rounds.slice(2).map((round) => round.profileId), [linked, null], "Ana's round is hers, Beto's is a guest's, although Beto went first");
  assert.ok(state(t, "STATE.resultView.context.rewards[0] !== null && STATE.resultView.context.rewards[1] === null"), "the profile's rewards are on Ana's card");
  assert.strictEqual(state(t, "STATE.duel.scores[0]"), 20);
  assert.strictEqual(state(t, "STATE.duel.hits[1]"), 1, "Beto's best move in position 2");
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

test("PF-2: the players take turns going first, every position starts covered, and the answers stay with their players", async () => {
  const t = makeEnv();
  const { Ludus, env, events, engine } = t;
  const cover = t.dom.document.getElementById("handoff-overlay");
  let focused = 0;
  cover.focus = () => { focused += 1; };
  await Ludus.game.startSession({
    kind: "classic",
    title: "Turns",
    mode: "duel",
    names: ["Ana", "Beto"],
    profileIds: [null, null],
    positions: [position(t, 0), position(t, 1), position(t, 2)],
    options: { clock: { mode: "untimed" } },
  });
  // Both play the same moves in every position; in the second one it is a move outside the lines (-200 cp).
  const moves = [["e2", "e4"], ["g7", "g5"], ["g1", "f3"]];
  const firsts = [];
  for (let index = 0; index < 3; index += 1) {
    const first = state(t, "STATE.duel.firstPlayer");
    const names = ["Ana", "Beto"];
    firsts.push(first);
    assert.strictEqual(state(t, "STATE.ui.phase"), "duel_ready", `position ${index + 1} starts covered`);
    assert.strictEqual(state(t, "STATE.duel.currentPlayer"), first);
    await delay(15);
    assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-title").textContent'), `${names[first]}, get ready`, "the cover names who goes first");
    assert.ok(state(t, 'document.getElementById("handoff-overlay-subtitle").textContent').startsWith(`Pass the device to ${names[first]}, who goes first this time. ${names[1 - first]} waits without looking.`));
    assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-avatar").textContent'), ["A", "B"][first], "and the avatar is theirs");
    assert.ok(focused >= 1, "the focus goes to the cover: a tap, Enter or Space starts the clock");
    focused = 0;
    env.run("revealDuelSecondTurn()");
    click(t, ...moves[index]);
    await waitFor(() => state(t, "STATE.ui.phase") === "handoff_ready", "the handoff");
    assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-title").textContent'), `Pass the device to ${names[1 - first]}`);
    env.run("revealDuelSecondTurn()");
    assert.strictEqual(state(t, "STATE.duel.currentPlayer"), 1 - first, "the other player moves second");
    click(t, ...moves[index]);
    await waitForResult(t);
    assert.deepStrictEqual(state(t, "STATE.resultView.context.answers.map((answer) => answer.name)"), ["Ana", "Beto"], "the cards are always Ana's then Beto's");
    if (index < 2) await env.context.nextPosition();
  }
  assert.deepStrictEqual(firsts, [0, 1, 0], "they take turns, starting with the first player of the duel");
  assert.deepStrictEqual(state(t, "STATE.session.records.map((record) => record.playerIndex)"), [0, 1, 0, 1, 0, 1], "every record belongs to the same player in every position");
  assert.strictEqual(events.rounds.length, 6);
  assert.strictEqual(state(t, "STATE.duel.scores[0]"), state(t, "STATE.duel.scores[1]"), "the same moves score the same for either player, whoever went first");
  // The move outside the lines that both players made is searched once, whoever went first (PF-1).
  assert.strictEqual(engine.goCommands().filter((line) => line.includes("searchmoves g7g5")).length, 1);

  // A new duel starts with the first player again, in the other language too.
  await Ludus.game.startSession({ kind: "classic", title: "Again", mode: "duel", names: ["Ana", "Beto"], positions: [position(t, 0), position(t, 1)], options: { clock: { mode: "untimed" } } });
  assert.strictEqual(state(t, "STATE.duel.firstPlayer"), 0);
  Ludus.i18n.setLanguage("es");
  await delay(15);
  assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-title").textContent'), "Ana, preparate");
  assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-subtitle").textContent'), "Pasale el dispositivo a Ana, que empieza esta vez. Beto espera sin mirar. El reloj arranca cuando toques la pantalla.");
  assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-eyebrow").textContent'), "Posición 1 de 2");
  Ludus.i18n.setLanguage("en");
  await Ludus.game.abort();
  assertClean(t);
});

test("PF-2: a long name wraps in the cover and nothing about whose turn it is depends on how long it is", async () => {
  const t = makeEnv();
  const { Ludus, env } = t;
  const long = ["Maximiliano Alejandro Pe", "WWWWWWWWWWWWWWWWWWWWWWWW"]; // 24 letters, the longest a profile name may be (a duel keeps 20)
  await Ludus.game.startSession({ kind: "classic", title: "Long", mode: "duel", names: long, positions: [position(t, 0), position(t, 1)], options: { clock: { mode: "untimed" } } });
  const kept = state(t, "STATE.session.names");
  assert.deepStrictEqual(kept, [long[0].slice(0, 20), long[1].slice(0, 20)], "a duel keeps 20 letters of a name");
  await delay(60);
  assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-title").textContent'), `${kept[0]}, get ready`);
  assert.ok(state(t, 'document.getElementById("handoff-overlay-subtitle").textContent').includes(`Pass the device to ${kept[0]}`));
  assert.ok(state(t, 'document.getElementById("handoff-overlay-subtitle").textContent').includes(`${kept[1]} waits without looking`));
  assert.ok(state(t, 'document.getElementById("play-announce").textContent').includes(kept[0]), "the announcement names the player too");
  env.run("revealDuelSecondTurn()");
  click(t, "e2", "e4");
  await waitFor(() => state(t, "STATE.ui.phase") === "handoff_ready", "the handoff");
  env.run("revealDuelSecondTurn()");
  click(t, "g2", "g4");
  await waitForResult(t);
  await env.context.nextPosition();
  assert.strictEqual(state(t, 'document.getElementById("handoff-overlay-title").textContent'), `${kept[1]}, get ready`, "the second player goes first in the second position");
  await Ludus.game.abort();
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
  const logBefore = engine.log.length;
  const found = await env.context.evaluateCandidateForMistake(candidate, ctxFor("g4"));
  assert.ok(found, "a 280 cp mistake is found");
  assert.strictEqual(found.source, "own");
  assert.strictEqual(found.fen, fens[0]);
  assert.strictEqual(found.bestMoveUci, "e2e4");
  assert.strictEqual(found.gameMoveUci, "g2g4");
  assert.strictEqual(found.gameMoveSan, "g4");
  assert.ok(found.lossCp >= 250);
  assert.ok(found.lossPct > 15, `the loss is measured in win chance too (${found.lossPct})`);
  assert.ok(/^own:/.test(found.id));
  const searches = engine.goCommands().slice(goBefore);
  // Two cheap single-line searches screen the candidate; one that may be a mistake is then confirmed by the analysis a round is
  // scored with (MultiPV, plus a search of its own for the played move, which is outside the lines).
  assert.strictEqual(searches.length, 4, "screening (best, played) and confirmation (MultiPV root, played)");
  assert.ok(searches[1].endsWith("searchmoves g2g4"));
  assert.ok(searches[3].endsWith("searchmoves g2g4"));
  const screeningLog = engine.log.slice(logBefore, engine.log.indexOf(searches[2], logBefore) - 2); // up to the options that precede the confirmation
  assert.ok(!screeningLog.some((line) => /MultiPV value [2-9]/.test(line)), "no MultiPV in the screening");
  assert.ok(engine.log.slice(engine.log.indexOf(searches[2], logBefore) - 2).some((line) => /MultiPV value 3/.test(line)), "the confirmation looks at several lines");
  // What confirmed the mistake is the round's reference: no second opinion that could disagree, and the hint agrees.
  assert.strictEqual(found.reference.origin, "runtime");
  assert.strictEqual(found.reference.lines[0].uci, "e2e4");
  // The shallow searches are never cached (a 250 ms answer must not stand in for a deep one).
  const before2 = engine.goCommands().length;
  await env.context.evaluateCandidateForMistake(candidate, ctxFor("g4"));
  assert.ok(engine.goCommands().length - before2 >= 2, "the screening searches run again");

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

// QA fixes (F1): language, copy, the clock, the guard rails of the play screen, daily, the record of a session.
test("UX-005: only a Spanish-speaking browser gets Spanish; French, German, Portuguese... get English", async () => {
  ["fr-FR", "pt-BR", "de-DE", "it-IT", "ca-ES"].forEach((code) => {
    const t = makeEnv({ languages: [code] });
    assert.strictEqual(state(t, "STATE.language"), "en", `${code} gets English`);
    assert.strictEqual(t.dom.document.documentElement.lang, "en");
  });
  assert.strictEqual(state(makeEnv({ languages: ["es-AR"] }), "STATE.language"), "es");
  assert.strictEqual(state(makeEnv({ languages: ["fr-FR", "es-MX"] }), "STATE.language"), "es", "the first supported language of the list wins");
  assert.strictEqual(state(makeEnv({ languages: ["en-GB", "es"] }), "STATE.language"), "en");
});

test("CNT-023/024/025/030: the hint names its piece with its article; plurals; no tuteo; no English inside Spanish", async () => {
  const t = makeEnv();
  const { env } = t;
  env.run('setLanguage("es")');
  assert.strictEqual(env.run('t("core.hint.said.1", { pieceDef: pieceDefiniteName("R"), square: "h1", pct: 15 }, "es")'), "Pista: mové la torre blanca de h1. Cuesta el 15% de los puntos.");
  assert.strictEqual(env.run('t("core.hint.said.2", { pieceDef: pieceDefiniteName("q"), from: "d8", to: "h4", pct: 35 }, "es")'), "Pista: mové la dama negra de d8 a h4. Cuesta el 35% de los puntos.");
  env.run('setLanguage("en")');
  assert.strictEqual(env.run('t("core.hint.said.1", { pieceDef: pieceDefiniteName("N"), square: "g1", pct: 15 }, "en")'), "Hint: move the white knight on g1. It costs 15% of the points.");
  assert.strictEqual(env.run('t("game.handoff.genericSubtitle", {}, "es")'), "Tocá para revelar", "vos, not tú");
  // One game, several games; one second, several seconds.
  assert.strictEqual(env.run('t("provider.usingCachedBase", { provider: "Lichess", user: "ana", games: 1 }, "es")'), "Usamos la base guardada de Lichess para ana: 1 partida.");
  assert.strictEqual(env.run('t("provider.usingCachedBase", { provider: "Lichess", user: "ana", games: 12 }, "es")'), "Usamos la base guardada de Lichess para ana: 12 partidas.");
  assert.strictEqual(env.run('t("provider.throttleWait", { seconds: 1 }, "en")'), "Please wait 1 second before downloading again, so we do not overload the service.");
  assert.strictEqual(env.run('t("provider.throttleHourly", { max: 12, minutes: 5 }, "es")'), "Ya se descargaron partidas 12 veces en la última hora. Probá de nuevo en unos 5 minutos.");
  assert.strictEqual(env.run('t("provider.throttleHourly", { max: 12, minutes: 1 }, "es")'), "Ya se descargaron partidas 12 veces en la última hora. Probá de nuevo en 1 minuto.", "a form of a plural may carry the number itself (PC-1)");
  // No "(s)" hedge and no English jargon left in the dictionary, and no contraction in English.
  const dictionary = env.run("TRANSLATIONS");
  ["es", "en"].forEach((lang) => Object.entries(dictionary[lang]).forEach(([key, text]) => {
    assert.ok(!/\(s\)/.test(text), `${lang} ${key} has a "(s)" hedge`);
  }));
  Object.entries(dictionary.es).forEach(([key, text]) => assert.ok(!/fallback/i.test(text), `es ${key} keeps English jargon`));
  Object.entries(dictionary.en).forEach(([key, text]) => assert.ok(!/\b\w+n't\b|\b(we|you|they)'(re|ll|ve)\b/i.test(text), `en ${key} uses a contraction: ${text}`));
  // Both languages have the same keys (nothing is written in one language only).
  assert.deepStrictEqual(Object.keys(dictionary.es).sort(), Object.keys(dictionary.en).sort());
});

test("PC-4: app.js picks the language the way js/ludus.js and js/boot.js do", async () => {
  // The same table scripts/tests/boot.test.js runs through js/boot.js and js/ludus.js: first es*/en* entry of the list wins, anything else is English,
  // a stored choice wins (and an unknown stored value means the default, Spanish).
  const table = [
    [{ languages: ["es-AR"], language: "es-AR" }, null, "es"],
    [{ languages: ["es"], language: "es" }, null, "es"],
    [{ languages: ["en-US", "es"], language: "en-US" }, null, "en"],
    [{ languages: ["fr-FR", "es-MX"], language: "fr-FR" }, null, "es"],
    [{ languages: ["fr"], language: "fr" }, null, "en"],
    [{ languages: [], language: undefined }, null, "en"],
    [{ languages: undefined, language: undefined }, null, "en"],
    [{ languages: undefined, language: "ES-ar" }, null, "es"],
    [{ languages: [], language: "es-ES" }, null, "es"],
    [{ languages: ["ast"], language: "ast" }, null, "en"],
    [{ languages: ["est"], language: "est" }, null, "en"],
    [{ languages: ["es_AR"], language: "es_AR" }, null, "es"],
    [{ languages: ["es-AR"], language: "es-AR" }, "en", "en"],
    [{ languages: ["en-US"], language: "en-US" }, "es", "es"],
    [{ languages: ["en-US"], language: "en-US" }, "ES", "es"],
    [{ languages: ["en-US"], language: "en-US" }, "fr", "es"],
  ];
  table.forEach(([navigator, stored, expected]) => {
    const t = makeEnv();
    t.dom.storageMap.delete("ludus.language");
    if (stored) t.dom.storageMap.set("ludus.language", stored);
    t.dom.navigator.languages = navigator.languages;
    t.dom.navigator.language = navigator.language;
    assert.strictEqual(t.env.run("detectInitialLanguage()"), expected, JSON.stringify([navigator, stored]));
  });
});

test("PC-1/CNT-029..034: one wording for the strings of app.js (win chance, points, American spelling, vos, ellipsis, plurals)", async () => {
  // Every string app.js puts on screen: its own dictionary and the "core." block it registers in the shared one, read from the source
  // (the two blocks are plain "key": "text" lines under "  es: {" / "  en: {").
  const source = fs.readFileSync(path.join(__dirname, "..", "..", "app.js"), "utf8").split("\n");
  const strings = { es: {}, en: {} };
  let language = null;
  source.forEach((line) => {
    if (/^  es: \{$/.test(line)) language = "es";
    else if (/^  en: \{$/.test(line)) language = "en";
    else if (/^  \},?$/.test(line) || /^\};$/.test(line) || /^\}\);$/.test(line)) language = null;
    const match = language && /^ {4}"([A-Za-z0-9_.]+)": ("(?:[^"\\]|\\.)*"),$/.exec(line);
    if (match) strings[language][match[1]] = JSON.parse(match[2]);
  });
  assert.ok(Object.keys(strings.es).length > 300 && Object.keys(strings.en).length > 300, "the dictionaries were found");
  assert.deepStrictEqual(Object.keys(strings.es).sort(), Object.keys(strings.en).sort(), "both languages have the same keys");
  const tokens = (text) => Array.from(new Set(Array.from(text.replace(/\{(\w+)\?(?:[^|{}]|\{\w+\})*\|(?:[^{}]|\{\w+\})*\}/g, "{$1}").matchAll(/\{(\w+)\}/g)).map((match) => match[1]))).sort();
  Object.keys(strings.es).forEach((key) => {
    const es = strings.es[key];
    const en = strings.en[key];
    assert.deepStrictEqual(tokens(es), tokens(en), `${key}: both languages use the same placeholders`);
    // Spanish: voseo, no English left over, one ellipsis character, no "(s)", "solo" without the accent, "7 %" without the space.
    assert.ok(!/\b(elige|prueba|tú|tienes|puedes|quieres|toca|vuelve|ingresa|selecciona|usted)\b/i.test(es), `es ${key}: tuteo in "${es}"`);
    assert.ok(!/\(s\)|\.\.\.|sólo|fallback|\bonline\b| %/i.test(es), `es ${key}: "${es}"`);
    assert.ok(!/\b(Omitir|Omití|Comenzar)\b/.test(es), `es ${key}: "Saltear" and "Empezar" are the words of the rest of the app: "${es}"`);
    assert.ok(!/\b1 (posiciones|partidas|días|aciertos|segundos|minutos)\b/.test(es), `es ${key}: plural of one in "${es}"`);
    assert.ok(!/\bPrecisi[oó]n\b \(0/.test(es), `es ${key}: the 0-10 score of a position is "puntos", accuracy is the percentage: "${es}"`);
    // English: American spelling, no contraction, one name for the win chance, "points" for the score.
    assert.ok(!/colour|analyse|analysing|favour|centre|defence|licence|practise|recognise|organis|prioritis|judgement|cancell/i.test(en), `en ${key}: American English in "${en}"`);
    assert.ok(!/\b\w+n't\b|\b(we|you|they)'(re|ll|ve)\b/i.test(en), `en ${key}: no contraction in "${en}"`);
    assert.ok(!/winning chances|win probability|\bodds\b|\bPrecision\b|\(s\)|\.\.\.|half way|carry on/i.test(en), `en ${key}: "${en}"`);
  });
  // The words of the two buttons the person presses most, in both languages.
  assert.strictEqual(strings.es["buttons.startSession"], "Empezar sesión");
  assert.strictEqual(strings.es["buttons.skipMove"], "Saltear (0 pts)");
  assert.strictEqual(strings.en["scoring.system.simple.label"], "Points (0 to 10)");
  assert.strictEqual(strings.es["scoring.system.simple.label"], "Puntos (0 a 10)");
  assert.strictEqual(strings.es["core.engine.downloading"], "Descargando el motor de análisis: {pct}%");
});

test("PC-2: the exit and resume questions never say 'saved' when the profile's storage failed", async () => {
  const askExit = async (t) => {
    let asked = null;
    t.env.context.showConfirmModal = async (options) => { asked = options; return false; };
    await t.env.context.confirmRestartToSetup();
    return asked && asked.body;
  };
  // Storage works: the promise is true and stays.
  const good = makeEnv();
  await good.Ludus.game.startSession({ kind: "classic", title: "Fine", positions: [position(good, 0), position(good, 1)], options: { clock: { mode: "untimed" } } });
  await playAndWait(good, "e2", "e4");
  assert.ok(/stays saved in your progress/.test(await askExit(good)), "when it was saved, the exit question says so");
  await good.Ludus.game.abort();

  // The browser refuses to store from now on (a full quota): the question says that the answers go with the session.
  const bad = makeEnv();
  bad.dom.localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
  await bad.Ludus.game.startSession({ kind: "classic", title: "Lost", positions: [position(bad, 0), position(bad, 1)], options: { clock: { mode: "untimed" } } });
  await playAndWait(bad, "e2", "e4");
  const exitBody = await askExit(bad);
  assert.ok(/is not saving your progress/.test(exitBody) && !/saved in your progress/.test(exitBody), exitBody);
  bad.env.run('setLanguage("es")');
  const exitEs = await askExit(bad);
  assert.ok(/no está guardando tu progreso/.test(exitEs) && /volvés/.test(exitEs) && !/queda guardado/.test(exitEs), exitEs);
  bad.env.run('setLanguage("en")');

  // The tab keeps what is needed to resume, and whether it was saved.
  const sessionMap = new Map();
  const fakeSessionStorage = {
    getItem: (key) => (sessionMap.has(key) ? sessionMap.get(key) : null),
    setItem: (key, value) => { sessionMap.set(key, String(value)); },
    removeItem: (key) => { sessionMap.delete(key); },
  };
  const first = makeEnv();
  first.dom.window.sessionStorage = fakeSessionStorage;
  await first.Ludus.game.startSession({ kind: "classic", title: "Interrupted", positions: [position(first, 0), position(first, 1), position(first, 2)], options: { clock: { mode: "untimed" } } });
  await playAndWait(first, "e2", "e4");
  assert.strictEqual(JSON.parse(sessionMap.get("ludus.sessionProgress.v1")).unsaved, "", "saved: the record says so");
  await first.Ludus.game.abort();

  const resumeBody = async (record, options = {}) => {
    sessionMap.set("ludus.sessionProgress.v1", JSON.stringify(record));
    const next = makeEnv(options);
    next.dom.window.sessionStorage = fakeSessionStorage;
    let asked = null;
    next.env.context.showConfirmModal = async (opts) => { asked = opts; return false; };
    await next.env.context.offerSessionResume();
    return { asked, next };
  };
  const base = { v: 1, at: Date.now(), id: "s_r", kind: "classic", title: "Interrupted", mode: "solo", options: {}, answered: 1, total: 3, remaining: [position(first, 1), position(first, 2)], unsaved: "" };
  const okAsk = (await resumeBody(base)).asked;
  assert.ok(/you answered 1 of 3 positions\. That is already saved in your progress\. Do you want to continue with the 2 that are left\?/.test(okAsk.body), okAsk.body);
  // One position left: singular, not "the 1 that are left".
  const one = (await resumeBody(Object.assign({}, base, { remaining: [position(first, 2)] }))).asked;
  assert.ok(/continue with the one that is left\?/.test(one.body) && !/1 that are/.test(one.body), one.body);
  // The old page's Profile saw the write fail: never "already saved".
  const lost = (await resumeBody(Object.assign({}, base, { unsaved: "quota" }))).asked;
  assert.ok(!/already saved/.test(lost.body) && /may not have been saved: browser storage is full/.test(lost.body), lost.body);
  const blockedBefore = (await resumeBody(Object.assign({}, base, { unsaved: "blocked" }))).asked;
  assert.ok(!/already saved/.test(blockedBefore.body) && /does not let this site store data/.test(blockedBefore.body) && /only kept in this tab while it stays open/.test(blockedBefore.body), blockedBefore.body);
  // The new page cannot store anything (private tab): the record looked fine, the storage now says no.
  const blockedNow = (await resumeBody(base, { localStorage: createThrowingLocalStorage() })).asked;
  assert.ok(blockedNow && !/already saved/.test(blockedNow.body) && /does not let this site store data/.test(blockedNow.body), blockedNow && blockedNow.body);
  // Spanish, voseo, same honesty.
  const es = await resumeBody(Object.assign({}, base, { unsaved: "blocked" }), { languages: ["es-AR"] });
  assert.ok(/respondiste 1 de 3 posiciones\. Pero no se guardó: este navegador no deja guardar datos en este sitio/.test(es.asked.body) && /solo se conserva en esta pestaña/.test(es.asked.body) && /¿Seguís con las 2 que faltan\?/.test(es.asked.body) && !/ya está guardado/.test(es.asked.body), es.asked.body);
  const esOne = (await resumeBody(Object.assign({}, base, { remaining: [position(first, 2)] }), { languages: ["es-AR"] })).asked;
  assert.ok(/¿Seguís con la que falta\?/.test(esOne.body), esOne.body);
  // The note of a session that cannot be rebuilt (a duel, the own games) says the same.
  const duel = await resumeBody({ v: 1, at: Date.now(), id: "s_d", kind: "classic", title: "Duel", mode: "duel", options: {}, answered: 2, total: 5, remaining: null, unsaved: "quota" });
  assert.ok(duel.next.events.toasts.some((entry) => /answered 2 of 5/.test(entry.message) && /may not have been saved/.test(entry.message) && !/already saved/.test(entry.message)), JSON.stringify(duel.next.events.toasts));
  const duelOk = await resumeBody({ v: 1, at: Date.now(), id: "s_d", kind: "classic", title: "Duel", mode: "duel", options: {}, answered: 2, total: 5, remaining: null });
  assert.ok(duelOk.next.events.toasts.some((entry) => /answered 2 of 5\. That is already saved in your progress\./.test(entry.message)), JSON.stringify(duelOk.next.events.toasts));
});

test("PC-1: a plural may carry its number; the clock says '1 second', not '1 seconds'", async () => {
  const t = makeEnv();
  const { env } = t;
  assert.strictEqual(env.run('interpolate("{n?1 minuto|unos {n} minutos}", { n: 1 })'), "1 minuto");
  assert.strictEqual(env.run('interpolate("{n?1 minuto|unos {n} minutos}", { n: 5 })'), "unos 5 minutos");
  assert.strictEqual(env.run('interpolate("{n} {n?día|días}", { n: 1 })'), "1 día", "the older form is unchanged");
  assert.strictEqual(env.run('interpolate("{n} {n?día|días}", { n: 0 })'), "0 días");
  assert.strictEqual(env.run('interpolate("{a?x|y {b}} {b}", { a: 2, b: "<i>" })'), "y <i> <i>", "values stay plain text");
  assert.strictEqual(env.run('t("provider.completingBlitz", { count: 3, preferred: "Rápido", remaining: 1 }, "es")'), "Descargamos 3 partidas de ritmo Rápido. Completando con Blitz (falta 1)…");
  assert.strictEqual(env.run('t("provider.completingBlitz", { count: 3, preferred: "Rápido", remaining: 4 }, "es")'), "Descargamos 3 partidas de ritmo Rápido. Completando con Blitz (faltan 4)…");
  assert.strictEqual(env.run('t("core.clock.resumed.one", {}, "es")'), "El reloj sigue: te queda 1 segundo.");
  assert.strictEqual(env.run('t("core.clock.resumed", { seconds: 12 }, "es")'), "El reloj sigue: te quedan 12 segundos.");
  assert.strictEqual(env.run('t("core.clock.resumed.one", {}, "en")'), "The clock is running again: 1 second left.");
  // The real thing: the page comes back with one second left.
  await t.Ludus.game.startSession({ kind: "classic", title: "Lock", positions: [position(t, 0), position(t, 1)], options: { clock: { mode: "timed", seconds: 60 } } });
  t.dom.document.visibilityState = "hidden";
  env.run("onPageVisibilityChange()");
  env.run("STATE.timer.remainingAtPause = 1000");
  t.dom.document.visibilityState = "visible";
  env.run("onPageVisibilityChange()");
  await delay(60);
  assert.strictEqual(state(t, 'document.getElementById("play-announce").textContent'), "The clock is running again: 1 second left.");
  await t.Ludus.game.abort();
});

test("PERF-015: the clock paints what changed and only that; it ticks once per displayed second", async () => {
  const t = makeEnv();
  const { env, dom } = t;
  await t.Ludus.game.startSession({ kind: "classic", title: "Clock", positions: [position(t, 0), position(t, 1)], options: { clock: { mode: "timed", seconds: 60 } } });
  const value = dom.document.getElementById("solo-clock-value");
  let writes = 0;
  let text = value.textContent;
  Object.defineProperty(value, "textContent", { configurable: true, get: () => text, set: (next) => { writes += 1; text = next; } });
  const arc = dom.document.getElementById("solo-clock-arc");
  let arcWrites = 0;
  const setAttribute = arc.setAttribute.bind(arc);
  arc.setAttribute = (name, next) => { if (name === "stroke-dashoffset") arcWrites += 1; setAttribute(name, next); };
  env.run("resetClockPaint()");
  for (let i = 0; i < 30; i += 1) env.run("updateRoundTimerUi(45000)");
  assert.strictEqual(text, "00:45");
  assert.strictEqual(writes, 1, "the same second is written once, not thirty times");
  assert.strictEqual(arcWrites, 1, "and so is the ring");
  env.run("updateRoundTimerUi(44000)");
  assert.strictEqual(writes, 2);
  assert.strictEqual(text, "00:44");
  // One wake-up per displayed second: the next tick is set for the moment the digits change (under one second), not every 100 ms.
  env.run("startRoundTimer()");
  assert.notStrictEqual(state(t, "STATE.timer.intervalId === null"), true, "a tick is pending");
  env.run("STATE.timer.deadlineMs = Date.now() + 59500");
  env.run("scheduleClockTick()");
  assert.notStrictEqual(state(t, "STATE.timer.intervalId === null"), true);
  await t.Ludus.game.abort();
  assertClean(t);
});

test("UX-003: the clock sleeps while the page is hidden and goes on from the same second; an answer past the deadline is a timeout", async () => {
  const t = makeEnv();
  const { env, dom, Ludus, events } = t;
  await Ludus.game.startSession({ kind: "classic", title: "Lock", positions: [position(t, 0), position(t, 1)], options: { clock: { mode: "timed", seconds: 60 } } });
  assert.strictEqual(state(t, "STATE.timer.running"), true);
  const remainingBefore = state(t, "STATE.timer.deadlineMs - Date.now()");
  // The phone is locked: the page is hidden, the clock pauses (no tick pending), nothing times out.
  dom.document.visibilityState = "hidden";
  env.run("onPageVisibilityChange()");
  assert.strictEqual(state(t, "STATE.timer.paused"), true);
  assert.strictEqual(state(t, "STATE.timer.intervalId === null"), true, "no tick while hidden");
  // ...for 100 seconds (longer than the round): the time is not spent.
  env.run("STATE.timer.roundHiddenAt = Date.now() - 100000");
  dom.document.visibilityState = "visible";
  env.run("onPageVisibilityChange()");
  assert.strictEqual(state(t, "STATE.timer.paused"), false);
  const remainingAfter = state(t, "STATE.timer.deadlineMs - Date.now()");
  assert.ok(Math.abs(remainingAfter - remainingBefore) < 1500, `the clock goes on from where it was (${remainingBefore} -> ${remainingAfter})`);
  assert.ok(state(t, "STATE.timer.pausedMs") >= 99000, "the hidden time is remembered, not spent");
  assert.strictEqual(events.rounds.length, 0, "no timeout was recorded");
  assert.strictEqual(state(t, "STATE.roundSubmitted"), false);
  // The time spent on the round leaves the hidden time out.
  click(t, "e2", "e4");
  await waitForResult(t);
  assert.ok(events.rounds[0].timeSpentMs < 5000, `timeSpentMs ignores the hidden 100 s (${events.rounds[0].timeSpentMs})`);

  // COR-008: a move that arrives after the deadline, before the next tick has noticed, is a timeout (no points).
  await env.context.nextPosition();
  env.run("STATE.timer.deadlineMs = Date.now() - 50");
  click(t, "e7", "e5");
  await waitForResult(t);
  assert.strictEqual(events.rounds[1].timedOut, true, "an answer after the deadline is a timeout");
  assert.strictEqual(events.rounds[1].points, 0);
  assert.strictEqual(events.rounds[1].userUci, null);
  await Ludus.game.abort();
  assertClean(t);
});

test("UX-018/COR-014: skip and the hint that shows the move need a second tap; a double click is one click", async () => {
  const t = makeEnv();
  const { env, dom, Ludus, events } = t;
  await Ludus.game.startSession({ kind: "classic", title: "Taps", positions: [position(t, 0), position(t, 1)], options: { clock: { mode: "untimed" } } });
  const label = () => dom.document.getElementById("hint-btn-label").textContent;
  // Level 1, then a second press within the moment of the first is the same press.
  assert.ok(env.run("requestHint({ fromUi: true })"), "the first press is a hint");
  assert.strictEqual(state(t, "STATE.hintsUsed"), 1);
  assert.strictEqual(env.run("requestHint({ fromUi: true })"), null, "a double click is not a second hint");
  assert.strictEqual(state(t, "STATE.hintsUsed"), 1);
  await delay(480);
  assert.ok(env.run("requestHint({ fromUi: true })"), "level 2 a moment later");
  assert.strictEqual(state(t, "STATE.hintsUsed"), 2);
  await delay(480);
  // The third level ends the round for nothing: the first press only arms it.
  assert.strictEqual(env.run("requestHint({ fromUi: true })"), null, "the reveal asks for a second tap");
  assert.strictEqual(state(t, "STATE.hintsUsed"), 2, "nothing was revealed");
  assert.ok(label().includes("Tap again"), `the button says what happens next: ${label()}`);
  await delay(60);
  assert.ok(dom.document.getElementById("hint-announce").textContent.includes("worth 0 points"), "and it is said aloud");
  assert.strictEqual(env.run("requestHint({ fromUi: true })").level, 3, "the second tap reveals");
  await waitForResult(t);
  assert.strictEqual(events.rounds[0].hintsUsed, 3);
  assert.strictEqual(events.rounds[0].points, 0);
  // The arming does not survive into the next round.
  await env.context.nextPosition();
  assert.strictEqual(state(t, "Boolean(armedConfirmations.reveal || armedConfirmations.skip)"), false);
  // Ludus.game.hint() is the API: no protection (a script knows what it asks).
  assert.strictEqual(Ludus.game.hint().level, 1);
  assert.strictEqual(Ludus.game.hint().level, 2);
  await Ludus.game.abort();
  assertClean(t);
});

test("UX-018: board.confirmMove puts a \"Confirm move\" step between the destination and the score", async () => {
  const t = makeEnv();
  const { env, dom, Ludus, events } = t;
  Ludus.Settings.set("board.confirmMove", "always");
  await Ludus.game.startSession({ kind: "classic", title: "Confirm", positions: [position(t, 0), position(t, 1)], options: { clock: { mode: "untimed" } } });
  const confirmBtn = dom.document.getElementById("confirm-move-btn");
  assert.strictEqual(confirmBtn.classList.contains("hidden"), true, "no confirmation before a move is chosen");
  click(t, "e2", "e4");
  await delay(30);
  assert.strictEqual(events.rounds.length, 0, "nothing is scored yet");
  assert.strictEqual(state(t, "STATE.roundSubmitted"), false);
  assert.strictEqual(state(t, "STATE.pendingMove.to"), 36, "e4 is waiting for its confirmation");
  assert.strictEqual(confirmBtn.classList.contains("hidden"), false);
  assert.strictEqual(dom.document.getElementById("confirm-move-label").textContent, "Confirm e4");
  assert.strictEqual(dom.document.getElementById("hint-btn").classList.contains("hidden"), true, "its button takes the hint's place");
  // Another square changes the choice; a second tap on the same square confirms.
  env.run('onSquareClick("e3")');
  assert.strictEqual(dom.document.getElementById("confirm-move-label").textContent, "Confirm e3");
  env.run('onSquareClick("d5")');
  assert.strictEqual(state(t, "STATE.pendingMove === null"), true, "an empty square that is not a destination drops the choice");
  env.run('onSquareClick("e2")');
  env.run('onSquareClick("e4")');
  assert.strictEqual(state(t, "STATE.pendingMove.to"), 36);
  env.run("cancelBoardSelection()");
  assert.strictEqual(state(t, "STATE.pendingMove === null"), true, "Escape cancels it");
  click(t, "e2", "e4");
  confirmBtn.dispatch("click");
  await waitForResult(t);
  assert.strictEqual(events.rounds.length, 1);
  assert.strictEqual(events.rounds[0].userUci, "e2e4", "the confirmed move is the one that was scored");
  assert.strictEqual(state(t, "STATE.pendingMove === null"), true);
  // With the setting off (the default) a move is scored at once.
  Ludus.Settings.set("board.confirmMove", "off");
  await env.context.nextPosition();
  click(t, "e7", "e5");
  await waitForResult(t);
  assert.strictEqual(events.rounds.length, 2);
  // "touch" asks only a finger.
  Ludus.Settings.set("board.confirmMove", "touch");
  assert.strictEqual(env.run('noteInputKind("mouse"), moveNeedsConfirmation()'), false);
  assert.strictEqual(env.run('noteInputKind("touch"), moveNeedsConfirmation()'), true);
  await Ludus.game.abort();
  assertClean(t);
});

test("A11Y-003: the single-letter shortcuts can be switched off and are told to assistive technology", async () => {
  const t = makeEnv();
  const { env, dom, Ludus } = t;
  await Ludus.game.startSession({ kind: "classic", title: "Keys", positions: [position(t, 0)], options: { clock: { mode: "untimed" } } });
  env.run("renderKeyLegend()");
  assert.strictEqual(dom.document.getElementById("hint-btn").getAttribute("aria-keyshortcuts"), "H");
  assert.strictEqual(dom.document.getElementById("next-btn").getAttribute("aria-keyshortcuts"), "N");
  dom.document.querySelector = () => null; // the fake answers every query with an element; "no dialog is open" needs null
  dom.document.getElementById("consent-overlay").classList.add("hidden");
  const press = (key, extra = {}) => env.context.onGameKeydown({ key, target: dom.document.getElementById("board"), preventDefault() {}, ...extra });
  press("h");
  assert.strictEqual(state(t, "STATE.hintsUsed"), 1, "H asks for a hint");
  // A held key is not three presses.
  press("h", { repeat: true });
  assert.strictEqual(state(t, "STATE.hintsUsed"), 1);
  Ludus.Settings.set("a11y.shortcuts", false);
  await delay(480);
  press("h");
  assert.strictEqual(state(t, "STATE.hintsUsed"), 1, "switched off: H does nothing");
  env.run("renderKeyLegend()");
  assert.strictEqual(dom.document.getElementById("hint-btn").getAttribute("aria-keyshortcuts"), null, "and nothing is promised");
  await Ludus.game.abort();
  assertClean(t);
});

test("COR-003: the daily challenge is completed by a real answer, not by a skip, a timeout or a revealed move", async () => {
  const t = makeEnv();
  const { env, Ludus, events } = t;
  const today = "2026-09-30";
  const dailyPosition = (index) => position(t, index, { dailyKey: today, source: "daily" });
  await Ludus.game.startSession({ kind: "daily", title: "Daily", positions: [dailyPosition(0), dailyPosition(1), dailyPosition(2)], options: { clock: { mode: "untimed" } } });
  env.run("armConfirmation = () => true"); // the tests below are about what the daily does, not about the two taps
  await env.context.submitNoMove("manual_skip");
  await waitForResult(t);
  assert.strictEqual(Ludus.Profile.daily.status(today).done, false, "a skip does not complete the day");
  await env.context.nextPosition();
  await env.context.submitNoMove("timeout");
  await waitForResult(t);
  assert.strictEqual(Ludus.Profile.daily.status(today).done, false, "neither does a timeout");
  await env.context.nextPosition();
  env.run("requestHint()"); env.run("requestHint()");
  env.run("requestHint()");
  await waitForResult(t);
  assert.strictEqual(Ludus.Profile.daily.status(today).done, false, "neither does a revealed move");
  assert.strictEqual(events.rounds.length, 3);
  await Ludus.game.abort();
  // A real answer does.
  await Ludus.game.startSession({ kind: "daily", title: "Daily", positions: [dailyPosition(0)], options: { clock: { mode: "untimed" } } });
  click(t, "e2", "e4");
  await waitForResult(t);
  assert.strictEqual(Ludus.Profile.daily.status(today).done, true, "a move completes it");
  await Ludus.game.abort();
  assertClean(t);
});

test("COR-005: the session is recorded the moment its last position is answered; leaving after that asks nothing and loses nothing", async () => {
  const t = makeEnv();
  const { env, Ludus, events } = t;
  await Ludus.game.startSession({ kind: "classic", title: "Last", positions: [position(t, 0), position(t, 1)], options: { clock: { mode: "untimed" } } });
  click(t, "e2", "e4");
  await waitForResult(t);
  assert.strictEqual(events.completed.length, 0, "not yet: one position is left");
  // Leaving now asks (there is a summary to lose and a position to play).
  let asked = 0;
  env.context.showConfirmModal = async () => { asked += 1; return true; };
  await env.context.nextPosition();
  click(t, "e7", "e5");
  await waitForResult(t);
  assert.strictEqual(events.completed.length, 1, "recorded at the last answer, before the summary is opened");
  assert.strictEqual(events.completed[0].positions, 2);
  assert.strictEqual(Ludus.Profile.stats().sessions, 1);
  // "Back to start" now asks nothing: every position was answered.
  assert.strictEqual(await Ludus.game.leave(), true);
  assert.strictEqual(asked, 0, "no question once everything is answered");
  assert.strictEqual(Ludus.router.current(), "home");
  assert.strictEqual(events.completed.length, 1, "and is not recorded a second time");
  assertClean(t);
});

test("COR-018: a position with a single legal move is no decision and is not offered", async () => {
  const t = makeEnv();
  const { Ludus } = t;
  await assert.rejects(Ludus.game.startSession({ kind: "classic", title: "Forced", positions: [{ fen: "7k/8/8/8/8/8/5q2/5K2 w - - 0 1", source: "classic" }] }), /no playable positions/);
  // Among playable ones it is simply left out.
  await Ludus.game.startSession({ kind: "classic", title: "Mixed", positions: [{ fen: "7k/8/8/8/8/8/5q2/5K2 w - - 0 1", source: "classic" }, position(t, 0)] });
  assert.strictEqual(state(t, "STATE.positions.length"), 1);
  await Ludus.game.abort();
  assertClean(t);
});

test("UX-007/F6: the summary says so when the browser did not save the session, in words and for the live region", async () => {
  const t = makeEnv();
  const { env, dom, Ludus } = t;
  const liveText = () => state(t, 'document.getElementById("result-overlay-points").textContent');
  // A session that saves: no note, no flag.
  await Ludus.game.startSession({ kind: "classic", title: "Saved", positions: [position(t, 0)], options: { clock: { mode: "untimed" } } });
  await playAndWait(t, "e2", "e4");
  await env.context.nextPosition();
  assert.strictEqual(state(t, "STATE.resultView.context.unsaved"), false);
  assert.strictEqual(liveText().includes("saved"), false, "nothing to warn about when it was saved");
  await Ludus.game.abort();

  // The browser's storage refuses from now on (a full quota): what the next session produces cannot be kept.
  dom.localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
  await Ludus.game.startSession({ kind: "classic", title: "Lost", positions: [position(t, 0)], options: { clock: { mode: "untimed" } } });
  await playAndWait(t, "e2", "e4");
  await env.context.nextPosition();
  assert.strictEqual(state(t, "STATE.resultView.context.kind"), "session_summary");
  assert.strictEqual(state(t, "STATE.resultView.context.unsaved"), true, "the summary context carries the flag");
  assert.strictEqual(state(t, "STATE.resultView.context.unsavedReason"), "quota");
  // (The summary panel itself is drawn by Ludus.Coach, which this test does not load: its live region carries the same words.)
  assert.ok(/may not have been saved: browser storage is full/.test(liveText()), "and the live region reads it: " + liveText());
  assert.ok(/Download a copy from Account/.test(state(t, "unsavedNoteText(STATE.resultView.context)")));
  // In Spanish, in the same words.
  await Ludus.i18n.setLanguage("es");
  assert.ok(/Es posible que esta sesión no se haya guardado/.test(liveText()), liveText());
  await Ludus.i18n.setLanguage("en");
  await Ludus.game.abort();
  assertClean(t);
});

test("COR-007: the promotion picker closes with the round (a timeout, a skip) and never plays a stale move into the next position", async () => {
  const t = makeEnv();
  const { env, dom, Ludus } = t;
  const promo = { fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1", source: "classic" };
  await Ludus.game.startSession({ kind: "classic", title: "Promo", positions: [promo, { ...promo, id: "classic:promo2", fen: "4k3/1P6/8/8/8/8/8/4K3 w - - 0 1" }], options: { clock: { mode: "untimed" } } });
  click(t, "a7", "a8");
  assert.strictEqual(dom.document.getElementById("promotion-picker").classList.contains("hidden"), false, "the picker is open");
  assert.ok(state(t, "STATE.pendingPromotion !== null"));
  await env.context.submitNoMove("timeout");
  assert.strictEqual(dom.document.getElementById("promotion-picker").classList.contains("hidden"), true, "closed with the round");
  assert.strictEqual(state(t, "STATE.pendingPromotion === null"), true);
  await waitForResult(t);
  await env.context.nextPosition();
  assert.strictEqual(dom.document.getElementById("promotion-picker").classList.contains("hidden"), true, "and not there in the next position");
  await Ludus.game.abort();
  assertClean(t);
});

// ---------- the downloads of the person's own games (QA fixes F1) ----------

// A stand-in for fetch: `handler(url, options)` answers with { status, body, headers } or throws.
function fakeResponse({ status = 200, body = "", headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[String(name).toLowerCase()] ?? headers[name] ?? null },
    text: async () => body,
  };
}

function ownGamesPgn(user = "Ana", games = 3) {
  const out = [];
  for (let i = 0; i < games; i += 1) {
    out.push([`[Event "E${i}"]`, '[Site "https://lichess.org/x"]', '[Date "2026.08.05"]', `[White "${user}"]`, '[Black "Rival"]', '[Result "1-0"]', "", "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0", ""].join("\n"));
  }
  return out.join("\n");
}

function setupOwnGames(t, { user = "Ana", provider = "lichess" } = {}) {
  const { env, dom } = t;
  dom.document.getElementById("online-user-input").value = user;
  dom.document.getElementById("online-provider-select").value = provider;
  env.run(`STATE.setupWizard.platform = ${JSON.stringify(provider)}; STATE.sourceMode = ${JSON.stringify(provider)}`);
  env.context.confirmRemoteFetchConsent = async () => true; // the consent itself is tested on its own
}

test("UX-006/UX-010: every failure of a download says what really happened, with the remedy that fits; a 429 is not retried", async () => {
  const cases = [
    { name: "404", reply: () => fakeResponse({ status: 404 }), key: "download.error.notFound", actions: ["user", "platform"] },
    { name: "500", reply: () => fakeResponse({ status: 500 }), key: "download.error.server", actions: ["retry", "platform"], status: 500 },
    { name: "empty", reply: () => fakeResponse({ status: 200, body: "" }), key: "download.error.noGames", actions: ["user", "platform"] },
    { name: "other user", reply: () => fakeResponse({ status: 200, body: ownGamesPgn("SomeoneElse") }), key: "provider.requestedPlayerMissing", actions: ["user", "platform"] },
    { name: "offline", reply: () => { throw new TypeError("Failed to fetch"); }, key: "download.error.network", actions: ["retry"] },
  ];
  for (const scenario of cases) {
    const t = makeEnv();
    setupOwnGames(t);
    let calls = 0;
    t.env.context.fetch = async () => { calls += 1; return scenario.reply(); };
    const result = await t.env.context.fetchLichessPgn();
    assert.strictEqual(result, false, scenario.name);
    const failure = state(t, "STATE.setupWizard.downloadFailure");
    assert.strictEqual(failure.key, scenario.key, `${scenario.name}: ${JSON.stringify(failure)}`);
    assert.deepStrictEqual(failure.actions, scenario.actions, scenario.name);
    // Never a raw exception text, in either language.
    ["en", "es"].forEach((lang) => {
      const text = t.env.run(`t(${JSON.stringify(failure.key)}, ${JSON.stringify(failure.params)}, ${JSON.stringify(lang)})`);
      assert.ok(!/Unexpected token|is not valid JSON|undefined|TypeError|Failed to fetch|\{|\}/.test(text), `${scenario.name}/${lang}: ${text}`);
    });
    if (scenario.status) assert.strictEqual(failure.params.status, scenario.status);
    if (scenario.name === "500") assert.strictEqual(calls, 3, "a 5xx is tried again (twice) before it is reported");
  }
  // 429: not retried, the pause it asked for is remembered and shown (Retry-After honoured), no Start before it is over.
  const t = makeEnv();
  setupOwnGames(t);
  let calls = 0;
  t.env.context.fetch = async () => { calls += 1; return fakeResponse({ status: 429, headers: { "retry-after": "40" } }); };
  assert.strictEqual(await t.env.context.fetchLichessPgn(), false);
  assert.strictEqual(calls, 1, "a 429 is not retried");
  const failure = state(t, "STATE.setupWizard.downloadFailure");
  assert.strictEqual(failure.key, "download.error.rateLimited");
  assert.strictEqual(failure.params.seconds, 40, "the wait the provider asked for");
  assert.strictEqual(failure.seconds, 40);
  const block = t.env.run('remoteFetchThrottleBlock("lichess")');
  assert.strictEqual(block.key, "download.error.rateLimited", "the page itself waits the pause out");
  assert.ok(block.seconds > 30 && block.seconds <= 40);
  assert.strictEqual(t.env.run('remoteFetchThrottleBlock("chesscom")'), null, "the pause is the provider's, not the other one's");
  // With no Retry-After it is the minute Lichess asks clients to wait.
  assert.strictEqual(t.env.run("retryAfterMs({ headers: { get: () => null } })"), 60000);
  assertClean(t);
});

test("UX-008: a wrong username or a failed request does not cost the courtesy wait; a download that worked does", async () => {
  const t = makeEnv();
  setupOwnGames(t);
  t.env.context.fetch = async () => fakeResponse({ status: 404 });
  assert.strictEqual(await t.env.context.fetchLichessPgn(), false);
  assert.strictEqual(t.env.run("remoteFetchThrottleBlock(\"lichess\")"), null, "a typo can be corrected at once");
  t.env.context.fetch = async () => { throw new TypeError("Failed to fetch"); };
  assert.strictEqual(await t.env.context.fetchLichessPgn(), false);
  assert.strictEqual(t.env.run("remoteFetchThrottleBlock(\"lichess\")"), null);
  t.env.context.fetch = async () => fakeResponse({ status: 200, body: ownGamesPgn("Ana", 30) });
  assert.strictEqual(await t.env.context.fetchLichessPgn(), true);
  const block = t.env.run('remoteFetchThrottleBlock("lichess")');
  assert.strictEqual(block.key, "provider.throttleWait", "after a download that worked the courtesy gap applies");
  assert.ok(block.seconds > 15 && block.seconds <= 20);
  assertClean(t);
});

test("UX-008/COR-016: the saved base does not depend on how many positions the session asked for", async () => {
  const t = makeEnv();
  const { env } = t;
  const entry = (requestedMax, games) => ({ source: { text: "x", requestedMax, games } });
  assert.strictEqual(env.run("cachedBaseCovers", ), env.context.cachedBaseCovers);
  assert.strictEqual(env.context.cachedBaseCovers(entry(50, 50), 25), true, "10 positions -> 5 positions: no new download");
  assert.strictEqual(env.context.cachedBaseCovers(entry(50, 50), 50), true);
  assert.strictEqual(env.context.cachedBaseCovers(entry(50, 50), 100), false, "a bigger session needs more games");
  assert.strictEqual(env.context.cachedBaseCovers(entry(100, 40), 200), true, "the person simply has fewer games than were asked for");
  assert.strictEqual(env.context.cachedBaseCovers({ source: { text: "x", games: 10 } }, 25), false, "an entry that does not say what it covers is not trusted");
  // The key no longer has the size in it.
  const a = env.run('cacheSignature({ provider: "lichess", preferredPerf: ["classical"], fallbackBlitz: true })');
  assert.ok(!/maxGames|minSlowGames/.test(a));
});

test("SEC-007/SEC-014: the consent is for a provider AND a username, and fails closed", async () => {
  const t = makeEnv();
  const { env, dom } = t;
  const overlay = dom.document.getElementById("consent-overlay");
  const accept = dom.document.getElementById("consent-overlay-accept");
  const input = dom.document.getElementById("consent-overlay-username-input");
  let shown = 0;
  // Accepts each dialog the way a person would (types the name again, presses accept).
  const answer = (user) => { input.value = user; accept.dispatch("click"); };
  const ask = async (provider, user) => {
    const pending = env.context.confirmRemoteFetchConsent(provider, user);
    shown += 1;
    await delay(5);
    answer(user);
    return pending;
  };
  assert.strictEqual(await ask("lichess", "Ana"), true);
  assert.strictEqual(shown, 1);
  assert.strictEqual(state(t, 'Object.keys(STATE.remoteConsent).join()'), "lichess|ana", "the consent is kept for that provider and that person");
  // The same person again: no second question.
  assert.strictEqual(await env.context.confirmRemoteFetchConsent("lichess", "ana"), true);
  // Somebody else, or the same name on the other site: asked again.
  const before = shown;
  const other = env.context.confirmRemoteFetchConsent("lichess", "SomeoneElse");
  await delay(5);
  assert.strictEqual(overlay.classList.contains("hidden"), false, "another username opens the dialog again");
  answer("SomeoneElse");
  assert.strictEqual(await other, true);
  const site = env.context.confirmRemoteFetchConsent("chesscom", "Ana");
  await delay(5);
  assert.strictEqual(overlay.classList.contains("hidden"), false, "another provider too");
  dom.document.getElementById("consent-overlay-cancel").dispatch("click");
  assert.strictEqual(await site, false, "cancel sends nothing");
  assert.ok(shown >= before);
});

test("SEC-014: showConfirmModal without the dialog's markup answers no (and the leave question is the only one that goes on)", async () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "app.js"), "utf8");
  // The markup is looked up once at load: load the app in a page that does not have it.
  const dom = createFakeDom({ languages: ["en"] });
  const original = dom.document.getElementById;
  dom.document.getElementById = (id) => (id === "consent-overlay" ? null : original(id));
  const env = loadApp(dom, { log() {}, info() {}, debug() {}, warn() {}, error() {} });
  assert.strictEqual(await env.run("showConfirmModal({ title: 'x' })"), false, "no dialog, no consent");
  assert.strictEqual(await env.run("showConfirmModal({ title: 'x', allowWithoutDialog: true })"), true, "leaving a session does not need it");
  assert.strictEqual(env.run("consentDialogAvailable()"), false);
  assert.ok(/allowWithoutDialog/.test(src));
});

test("SEC-017: only the monthly archives of the person on api.chess.com over https are ever requested", async () => {
  const t = makeEnv();
  const { env } = t;
  const ok = env.run('parseChessComArchiveUrl("https://api.chess.com/pub/player/magnus/games/2026/09", "Magnus")');
  assert.strictEqual(ok.year, 2026);
  assert.strictEqual(ok.month, 9);
  [
    "https://www.googleapis.com/drive/v3/files/games/2026/09",
    "https://lichess.org/api/account/games/2026/09",
    "https://evil.example/pub/player/magnus/games/2026/09",
    "http://api.chess.com/pub/player/magnus/games/2026/09",
    "https://api.chess.com.evil.example/pub/player/magnus/games/2026/09",
    "https://api.chess.com/pub/player/someoneelse/games/2026/09",
    "https://api.chess.com/pub/player/magnus/games/2026/13",
    "https://api.chess.com/pub/player/magnus/games/2026/09?token=1",
    "https://user:pass@api.chess.com/pub/player/magnus/games/2026/09",
    "/pub/player/magnus/games/2026/09",
    "not a url",
    "",
  ].forEach((bad) => assert.strictEqual(env.run(`parseChessComArchiveUrl(${JSON.stringify(bad)}, "Magnus")`), null, bad));
});

test("COR-017/UX-013: usernames are checked per platform, '@name' and pasted profile addresses mean the name", async () => {
  const t = makeEnv();
  const { env } = t;
  assert.strictEqual(env.run('remoteUsernameIsValid("ab", "lichess")'), true, "Lichess allows two characters");
  assert.strictEqual(env.run('remoteUsernameIsValid("ab", "chesscom")'), false, "Chess.com needs three");
  assert.strictEqual(env.run('remoteUsernameIsValid("a".repeat(31), "lichess")'), false);
  assert.strictEqual(env.run('remoteUsernameIsValid("a".repeat(26), "chesscom")'), false);
  assert.strictEqual(env.run('remoteUsernameIsValid("Magnus Carlsen", "lichess")'), false);
  assert.strictEqual(env.run('normalizeRemoteUsername("@MagnusCarlsen")'), "MagnusCarlsen");
  assert.strictEqual(env.run('normalizeRemoteUsername("  https://lichess.org/@/DrNykterstein ")'), "DrNykterstein");
  assert.strictEqual(env.run('normalizeRemoteUsername("https://www.chess.com/member/hikaru")'), "hikaru");
  assert.strictEqual(env.run('normalizeRemoteUsername("plain_name-1")'), "plain_name-1");
  // The message names the rule of the platform (and never the old "3 to 30").
  assert.ok(/2 to 30/.test(env.run('usernameRuleText("lichess")')), env.run('usernameRuleText("lichess")'));
  assert.ok(/3 to 25/.test(env.run('usernameRuleText("chesscom")')));
  // What the wizard validates is the name, not what was typed.
  const { dom } = t;
  dom.document.getElementById("online-user-input").value = "@ab";
  dom.document.getElementById("online-provider-select").value = "lichess";
  assert.strictEqual(state(t, "validateWizardStep(2).valid"), true);
  dom.document.getElementById("online-provider-select").value = "chesscom";
  assert.strictEqual(state(t, "validateWizardStep(2).valid"), false);
  assert.strictEqual(state(t, "validateWizardStep(2).field"), "username");
  assert.strictEqual(env.run("getConfiguredRemoteUsername()"), "ab", "the download uses the name");
});

test("UX-013: the line under the username says what is true of it now", async () => {
  const t = makeEnv();
  const { env, dom } = t;
  const status = () => dom.document.getElementById("online-status").textContent;
  dom.document.getElementById("online-user-input").value = "";
  env.run("refreshOnlineStatus()");
  assert.strictEqual(status(), "Enter your username to continue.");
  dom.document.getElementById("online-user-input").value = "Magnus Carlsen";
  env.run("refreshOnlineStatus()");
  assert.ok(/letters, numbers/.test(status()), "an impossible name is said at once, not 'ready to download'");
  dom.document.getElementById("online-user-input").value = "MagnusCarlsen";
  env.run("refreshOnlineStatus()");
  assert.ok(/Tap “Next”/.test(status()), status());
  assert.ok(!/Start session/.test(status()), "step 2 does not promise a button that is on step 3");
  // The last step does not say that "the next step" comes.
  assert.ok(!Object.values(env.run("TRANSLATIONS.en")).some((text) => /move on to the next step/.test(text)));
});

test("UX-015/A11Y-021: the wizard's clock is the session's own: it reads the setting, changes nothing else, and offers no limit", async () => {
  const t = makeEnv();
  const { env, dom, Ludus } = t;
  assert.strictEqual(Ludus.Settings.get("clock.seconds"), 90);
  env.run('resetSetupWizard({ mode: "solo" })');
  assert.strictEqual(state(t, "STATE.setupWizard.clockMode"), "timed");
  const html = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
  assert.ok(/class="wizard-size-chip wizard-timer-chip"[^>]*data-seconds="0"/.test(html), "a chip for no time limit sits next to 90/180/360");
  // Choosing 180 s changes the wizard, not the person's usual clock.
  env.run('setWizardClockMode("timed"); setWizardTurnTimeSeconds(180); renderWizardStep()');
  assert.strictEqual(Ludus.Settings.get("clock.seconds"), 90, "Settings is left alone");
  assert.strictEqual(state(t, "collectWizardConfig().turnTimeSeconds"), 180);
  assert.ok(/this session only/i.test(dom.document.getElementById("wizard-clock-note").textContent));
  // "No time limit" is a choice of the wizard.
  env.run('setWizardClockMode("untimed"); renderWizardStep()');
  assert.strictEqual(state(t, "collectWizardConfig().clockMode"), "untimed");
  assert.strictEqual(Ludus.Settings.get("clock.mode"), "timed", "the setting is untouched");
  assert.ok(/no limit/i.test(dom.document.getElementById("wizard-summary").innerHTML), dom.document.getElementById("wizard-summary").innerHTML);
  // Below 30 seconds there is a word about it.
  env.run('setWizardClockMode("timed"); setWizardTurnTimeSeconds(10); renderWizardStep()');
  assert.ok(/30 seconds/.test(dom.document.getElementById("wizard-clock-note").textContent));
  // A new wizard starts again from the setting.
  env.run('resetSetupWizard({ mode: "solo" })');
  assert.strictEqual(state(t, "STATE.setupWizard.turnTimeSeconds"), 90);
  assert.strictEqual(state(t, "STATE.setupWizard.clockMode"), "timed");
  // The session the pipeline starts carries the wizard's clock.
  env.run('setWizardClockMode("untimed")');
  env.run("STATE.targetPositions = 1");
  const mistake = { id: "own:x", source: "own", fen: t.fens[0], meta: { players: "Ana vs Rival", moveNumber: 1, sideToMove: "w" }, gameMoveUci: "g2g4", gameMoveSan: "g4", bestMoveUci: "e2e4", bestMoveSan: "e4", bestEvalText: "+0.30", gameEvalText: "-2.50", lossCp: 280, thresholdUsed: 80, phase: "opening", gameIndex: 1 };
  env.run("STATE.clockMode = STATE.setupWizard.clockMode");
  env.context.enterPlayModeWithFirstPosition(mistake, { detected: 1, analyzed: 1, total: 1 });
  assert.deepStrictEqual(state(t, "STATE.session.options.clock.mode"), "untimed");
  assert.strictEqual(state(t, "isUntimedSession()"), true);
  await Ludus.game.abort();
  assertClean(t);
});

test("UX-027: the very first session has no clock and says how to play; the next one is an ordinary session", async () => {
  const t = makeEnv({ firstRun: true });
  const { env, Ludus, events } = t;
  assert.strictEqual(state(t, "isFirstRun()"), true);
  await Ludus.game.startSession({ kind: "classic", title: "First", positions: [position(t, 0), position(t, 1)] });
  assert.strictEqual(state(t, "isUntimedSession()"), true, "no 90 s clock before the instructions");
  assert.strictEqual(state(t, "STATE.session.firstRun"), true);
  click(t, "e2", "e4");
  await waitForResult(t);
  assert.strictEqual(Ludus.storage.get("ludus.firstRun.v1", 0), 1, "it ends with the first answer");
  await Ludus.game.abort();
  assert.strictEqual(state(t, "isFirstRun()"), false);
  await Ludus.game.startSession({ kind: "classic", title: "Second", positions: [position(t, 0)] });
  assert.strictEqual(state(t, "isUntimedSession()"), false, "an ordinary clock from then on");
  await Ludus.game.abort();
  // A screen that asks for a clock gets it, even on the first run.
  const other = makeEnv({ firstRun: true });
  await other.Ludus.game.startSession({ kind: "classic", title: "Asked", positions: [position(other, 0)], options: { clock: { mode: "timed", seconds: 45 } } });
  assert.strictEqual(state(other, "isUntimedSession()"), false);
  await other.Ludus.game.abort();
  void events;
});

test("UX-002/COR-020: a reload in the middle of a session warns, and offers to go on with what is left", async () => {
  const sessionMap = new Map();
  const fakeSessionStorage = {
    getItem: (key) => (sessionMap.has(key) ? sessionMap.get(key) : null),
    setItem: (key, value) => { sessionMap.set(key, String(value)); },
    removeItem: (key) => { sessionMap.delete(key); },
  };
  const first = makeEnv();
  first.dom.window.sessionStorage = fakeSessionStorage;
  await first.Ludus.game.startSession({ kind: "classic", title: "Interrupted", positions: [position(first, 0), position(first, 1), position(first, 2)], options: { clock: { mode: "untimed" } } });
  // Nothing answered yet: nothing to warn about.
  assert.strictEqual(first.env.run("sessionNeedsLeaveWarning()"), false);
  click(first, "e2", "e4");
  await waitForResult(first);
  assert.strictEqual(first.env.run("sessionNeedsLeaveWarning()"), true, "one answer is something to lose");
  let prevented = 0;
  const event = { preventDefault() { prevented += 1; }, returnValue: undefined };
  first.env.context.onBeforeUnload(event);
  assert.strictEqual(prevented, 1);
  assert.strictEqual(event.returnValue, "", "the browser's own warning is asked for");
  const stored = JSON.parse(sessionMap.get("ludus.sessionProgress.v1"));
  assert.strictEqual(stored.answered, 1);
  assert.strictEqual(stored.remaining.length, 2, "what is left of the list is kept");
  // The page is reloaded: a new page of the same tab finds it.
  const second = makeEnv();
  second.dom.window.sessionStorage = fakeSessionStorage;
  let asked = null;
  second.env.context.showConfirmModal = async (options) => { asked = options; return true; };
  await second.env.context.offerSessionResume();
  assert.ok(asked && /Interrupted/.test(asked.body) && /1 of 3/.test(asked.body) && /2 that are left/.test(asked.body), asked && asked.body);
  assert.strictEqual(sessionMap.has("ludus.sessionProgress.v1"), false, "offered once");
  assert.strictEqual(state(second, "STATE.positions.length"), 2, "the session goes on with the two positions that were left");
  assert.strictEqual(second.Ludus.router.current(), "game");
  await second.Ludus.game.abort();
  assert.strictEqual(sessionMap.has("ludus.sessionProgress.v1"), false, "leaving on purpose forgets it");
  // A duel (or the own games) cannot be rebuilt: it only says that what was answered is saved.
  const duel = makeEnv();
  duel.dom.window.sessionStorage = fakeSessionStorage;
  sessionMap.set("ludus.sessionProgress.v1", JSON.stringify({ v: 1, at: Date.now(), id: "s_x", kind: "classic", title: "Duel", mode: "duel", options: {}, answered: 2, total: 5, remaining: null }));
  await duel.env.context.offerSessionResume();
  assert.ok(duel.events.toasts.some((entry) => /interrupted/i.test(entry.message) && /2/.test(entry.message)), JSON.stringify(duel.events.toasts));
  // Nothing answered, nothing offered.
  sessionMap.set("ludus.sessionProgress.v1", JSON.stringify({ v: 1, at: Date.now(), id: "s_y", kind: "classic", title: "Empty", mode: "solo", options: {}, answered: 0, total: 5, remaining: null }));
  const empty = makeEnv();
  empty.dom.window.sessionStorage = fakeSessionStorage;
  await empty.env.context.offerSessionResume();
  assert.strictEqual(empty.events.toasts.length, 0);
});

test("UX-021: a rematch draws fresh positions; 'same positions' is an explicit choice", async () => {
  const t = makeEnv();
  const { env, Ludus } = t;
  // A small pool of classic positions (the real data file is loaded lazily by a script tag, which Node does not have).
  const pool = [0, 1, 2, 3, 4].map((index) => position(t, index, { id: `classic:pool${index}` })).concat([{ fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1", source: "classic", id: "classic:pool5" }]);
  Ludus.Classics = {
    load: async () => {},
    positions: (gameId, opts) => pool.filter((entry) => !opts || !opts.exclude || !opts.exclude.includes(entry.id)),
    random: (count, opts) => pool.filter((entry) => !(opts && opts.exclude && opts.exclude.includes(entry.id))).slice(0, count),
  };
  const first = pool.slice(0, 3);
  await Ludus.game.startSession({ kind: "classic", title: "Duel", mode: "duel", names: ["Ana", "Beto"], positions: first, options: { clock: { mode: "untimed" } } });
  env.run("STATE.sessionPlayed = 3");
  env.run("STATE.session.completed = true");
  const playedIds = first.map((position) => position.id);
  await env.context.replaySession();
  const fresh = state(t, "STATE.positions.map((position) => position.id)");
  assert.strictEqual(fresh.length, 3);
  assert.ok(fresh.every((id) => !playedIds.includes(id)), "none of the positions whose best moves were just shown");
  env.run("STATE.sessionPlayed = 3");
  env.run("STATE.session.completed = true");
  await env.context.replaySession({ samePositions: true });
  assert.deepStrictEqual(state(t, "STATE.positions.map((position) => position.id)").sort(), fresh.slice().sort(), "'same positions' replays what was just played");
  await Ludus.game.abort();
  assertClean(t);
});

test("PERF-014: a browser that cannot run the engine's WebAssembly is told so and never downloads the file", async () => {
  const t = makeEnv({ engine: null });
  const { env, Ludus, events } = t;
  Ludus.Engine.supported = () => false;
  let fetched = 0;
  env.context.fetch = async () => { fetched += 1; return fakeResponse({ status: 200 }); };
  assert.strictEqual(await env.context.ensureStockfishLoading(), false);
  assert.strictEqual(state(t, "STATE.engineStatus"), "unsupported");
  assert.strictEqual(fetched, 0, "the 7 MB file is not fetched for a browser that cannot run it");
  assert.strictEqual(state(t, "engineFallbackReason()"), "unsupported");
  assert.ok(/cannot run the strong engine/.test(env.run("engineFallbackNotice()")));
  assert.ok(events.toasts.some((entry) => /cannot run the strong engine/.test(entry.message)), "said once");
  assert.strictEqual(await env.context.ensureStockfishLoading(), false, "and not asked again");
  assert.strictEqual(events.toasts.filter((entry) => /cannot run/.test(entry.message)).length, 1);
  // The app still works on the backup engine.
  await Ludus.game.startSession({ kind: "classic", title: "Backup", positions: [position(t, 0)], options: { clock: { mode: "untimed" } } });
  click(t, "e2", "e4");
  await waitForResult(t);
  assert.strictEqual(state(t, "STATE.resultView.context.engine.source"), "local");
  await Ludus.game.abort();
});

test("PERF-011: the engine download is given up when it stalls, never because it is slow; its progress is known", async () => {
  const t = makeEnv({ engine: null });
  const { env } = t;
  env.context.Ludus.game.configureEngine({ stallMs: 120, retryBaseMs: 1 });
  env.context.Ludus.Engine.supported = () => true;
  // A download that keeps delivering bytes (much longer than the stall limit in total) completes.
  const chunks = 12;
  env.context.fetch = async () => {
    let sent = 0;
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => (String(name).toLowerCase() === "content-length" ? String(chunks * 1000) : null) },
      body: { getReader: () => ({ read: async () => { await delay(30); if (sent >= chunks) return { done: true }; sent += 1; return { done: false, value: { byteLength: 1000 } }; } }) },
    };
  };
  const seen = [];
  const poll = setInterval(() => seen.push(state(t, "STATE.engineDownload.ratio")), 25);
  assert.strictEqual(await env.context.downloadEngineFiles(), true, "slow but alive: it completes");
  clearInterval(poll);
  assert.strictEqual(state(t, "STATE.engineFilesReady"), true);
  assert.ok(seen.some((ratio) => ratio > 0 && ratio < 1), "progress is known while it runs");
  // A download that stops delivering is given up after the stall limit.
  env.run("STATE.engineFilesReady = false");
  env.context.fetch = async (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener("abort", () => { const error = new Error("aborted"); error.name = "AbortError"; reject(error); });
  });
  const started = Date.now();
  assert.strictEqual(await env.context.downloadEngineFiles(), false);
  assert.ok(Date.now() - started < 1500, "given up after the stall limit, not after the old wall-clock limit");
  assert.strictEqual(state(t, "STATE.engineDownload.state"), "stalled");
  assert.strictEqual(state(t, "STATE.engineFilesReady"), false);
});

test("PERF-004: the backup engine gives the same answers with a tenth of the work and hands the page back while it thinks", async () => {
  const t = makeEnv({ engine: null });
  const { env } = t;
  // The reference: the plain minimax the backup engine used to be.
  const reference = env.run(`(() => {
    const plain = (board, depth) => {
      if (depth <= 0) return evaluateMaterial(board);
      const moves = board.generateMoves();
      if (moves.length === 0) return board.inCheck(board.turn) ? (board.turn === "w" ? -99999 : 99999) : 0;
      let best = board.turn === "w" ? -Infinity : Infinity;
      moves.forEach((move) => {
        const clone = board.clone();
        clone.makeMove(move);
        const score = plain(clone, depth - 1);
        if (board.turn === "w") { if (score > best) best = score; } else if (score < best) best = score;
      });
      return best;
    };
    return plain;
  })()`);
  const fens = [
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 2 3",
    "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
    "4k3/8/8/8/8/8/4q3/4K3 w - - 0 1",
    "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7",
  ];
  const { Chess } = t.Ludus.chess;
  let oldMs = 0;
  let newMs = 0;
  for (const fen of fens) {
    const base = new Chess(fen);
    let started = Date.now();
    const moves = base.generateMoves();
    let bestScore = base.turn === "w" ? -Infinity : Infinity;
    let bestMove = null;
    moves.forEach((move) => {
      const clone = base.clone();
      clone.makeMove(move);
      const score = reference(clone, 2);
      if (base.turn === "w" ? score > bestScore : score < bestScore) { bestScore = score; bestMove = move; }
    });
    oldMs += Date.now() - started;
    started = Date.now();
    const found = await env.context.searchBestMove(new Chess(fen), 3);
    newMs += Date.now() - started;
    assert.strictEqual(found.score, Math.round(bestScore), `${fen}: the same score`);
    assert.ok(found.move.from === bestMove.from && found.move.to === bestMove.to, `${fen}: the same move`);
    // A single move scored on its own is exact too.
    for (const move of moves.slice(0, 3)) {
      const a = base.clone(); a.makeMove(move);
      const b = base.clone(); b.makeMove(move);
      assert.strictEqual(env.context.evaluatePosition(a, 2), reference(b, 2));
    }
  }
  assert.ok(newMs * 2 < oldMs, `alpha-beta does the same in less than half the time (${newMs} ms against ${oldMs} ms)`);
  // The search gives the page back while it works.
  let yields = 0;
  await env.context.searchBestMove(new Chess(fens[1]), 3, async () => { yields += 1; });
  assert.ok(yields >= 10, `a yield point per root move (${yields})`);
});

test("COR-006/COR-013: a mistake is a loss of WIN CHANCE, confirmed by a proper analysis; a candidate that does not confirm is dropped", async () => {
  const t = makeEnv();
  const { env, engine, fens } = t;
  assert.strictEqual(await env.context.ensureStockfishLoading(), true);
  // The same 150 cp is a blunder in a level position and nothing when the game is already decided.
  const level = env.run("winLossPct(0, -150)");
  const decided = env.run("winLossPct(900, 750)");
  const limit = env.run("lossPctForCp(80)");
  assert.ok(level > limit, `150 cp in a level position (${level.toFixed(1)}%) is above the standard threshold (${limit.toFixed(1)}%)`);
  assert.ok(decided < limit, `150 cp with +9 on the board (${decided.toFixed(1)}%) is not a mistake`);
  assert.ok(env.run("winLossPct(100000 - 1000, 0)") > 30, "missing a mate is a big loss");
  // The thresholds still follow the sensitivity setting ("80 cp of a level position"), in win chance.
  assert.ok(Math.abs(limit - (t.Ludus.Scoring.winPercent(80) - 50)) < 1e-9);
  // A noisy first look: the cheap search says the played move loses a lot, the proper analysis says it is fine.
  const game = { tags: { White: "Ana", Black: "Rival", Event: "Casual", Date: "2024.01.01" }, sanMoves: ["e4"], startFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" };
  const ctx = { games: [game], depth: 3, moveTimeMs: 250, thresholdCp: 80 };
  const candidate = { gameIdx: 0, playerColor: "w", ply: 0 };
  const realAnalyze = env.context.analyzePosition;
  env.context.analyzePosition = async (fen, options) => {
    if (options.noCache) {
      // the screening: the best move is d2d4 (+200) and the played e2e4 scores +0: a 17% loss on paper
      if (options.searchMoves && options.searchMoves.length) return { lines: [{ multipv: 1, depth: 8, score: { type: "cp", value: 0 }, pv: ["e2e4"] }], source: "stockfish", depth: 8, aborted: false };
      return { lines: [{ multipv: 1, depth: 8, score: { type: "cp", value: 200 }, pv: ["d2d4"] }], source: "stockfish", depth: 8, aborted: false };
    }
    // the proper analysis: d2d4 is +30 and e2e4 +25 (a fine move)
    return { lines: [{ multipv: 1, depth: 14, score: { type: "cp", value: 30 }, pv: ["d2d4"] }, { multipv: 2, depth: 14, score: { type: "cp", value: 25 }, pv: ["e2e4"] }], source: "stockfish", depth: 14, aborted: false };
  };
  assert.strictEqual(await env.context.evaluateCandidateForMistake(candidate, ctx), null, "a candidate that does not confirm is dropped");
  // And the other way round: a real mistake the cheap search underrated (+16 against the truth, +185) is still confirmed.
  env.context.analyzePosition = async (fen, options) => {
    if (options.noCache) {
      if (options.searchMoves && options.searchMoves.length) return { lines: [{ multipv: 1, depth: 8, score: { type: "cp", value: 0 }, pv: ["e2e4"] }], source: "stockfish", depth: 8, aborted: false };
      return { lines: [{ multipv: 1, depth: 8, score: { type: "cp", value: 60 }, pv: ["d2d4"] }], source: "stockfish", depth: 8, aborted: false };
    }
    return { lines: [{ multipv: 1, depth: 14, score: { type: "cp", value: 185 }, pv: ["d2d4"] }, { multipv: 2, depth: 14, score: { type: "cp", value: -20 }, pv: ["e2e4"] }], source: "stockfish", depth: 14, aborted: false };
  };
  const confirmed = await env.context.evaluateCandidateForMistake(candidate, ctx);
  assert.ok(confirmed, "confirmed by the proper analysis");
  assert.strictEqual(confirmed.bestMoveUci, "d2d4", "the best move is the one of the proper analysis, not of the 250 ms look");
  assert.ok(confirmed.lossPct > 10);
  assert.strictEqual(confirmed.reference.lines[0].uci, "d2d4");
  env.context.analyzePosition = realAnalyze;
  void engine; void fens;
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
