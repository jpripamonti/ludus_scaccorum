// Tests for js/engine.js.
//
//   Part 1 (unit): parseInfoLine, and the driver against a scripted fake
//                  transport with a virtual clock (deterministic, instant).
//   Part 2 (integration): the driver against the REAL vendored Stockfish, run
//                  as a child process through scripts/tests/_engine_transport.js.
//                  If the vendored engine is missing this part FAILS, it never
//                  skips silently.
//
// Plain assert, no network, no framework. Searches are short (<= 400 ms).

"use strict";

const assert = require("assert");
const path = require("path");

const jsDir = path.resolve(__dirname, "..", "..", "js");
const { Chess, uciToMove } = require(path.join(jsDir, "chess.js"));
const Scoring = require(path.join(jsDir, "scoring.js"));
const Engine = require(path.join(jsDir, "engine.js"));
const { createNodeTransport, engineAvailable, ENGINE_PATH } = require("./_engine_transport.js");

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const tests = [];
function test(group, name, fn) {
  tests.push({ group, name, fn });
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms: ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function rejection(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new assert.AssertionError({ message: "expected the promise to reject, it resolved" });
}

// ---------- fakes: virtual clock and scripted transport ----------

function createFakeClock() {
  let time = 0;
  let nextId = 1;
  const timers = new Map();
  function schedule(fn, ms, repeat) {
    const id = nextId;
    nextId += 1;
    const delay = Math.max(0, Number(ms) || 0);
    timers.set(id, { at: time + delay, fn, interval: repeat ? Math.max(1, delay) : 0 });
    return id;
  }
  return {
    now: () => time,
    setTimeout: (fn, ms) => schedule(fn, ms, false),
    clearTimeout: (id) => { timers.delete(id); },
    setInterval: (fn, ms) => schedule(fn, ms, true),
    clearInterval: (id) => { timers.delete(id); },
    pending: () => timers.size,
    // Runs every timer due within `ms` of virtual time, in order, draining
    // microtasks between them.
    async advance(ms) {
      const end = time + ms;
      for (;;) {
        let dueId = null;
        let dueAt = Infinity;
        timers.forEach((timer, id) => {
          if (timer.at <= end && timer.at < dueAt) {
            dueAt = timer.at;
            dueId = id;
          }
        });
        if (dueId === null) break;
        const timer = timers.get(dueId);
        time = Math.max(time, timer.at);
        if (timer.interval) timer.at = time + timer.interval;
        else timers.delete(dueId);
        timer.fn();
        await flush();
      }
      time = end;
      await flush();
    },
  };
}

function createFakeTransport(options) {
  const settings = options || {};
  const listeners = { message: new Set(), error: new Set() };
  const transport = {
    sent: [],
    terminated: false,
    postMessage(line) {
      if (transport.terminated) throw new Error("transport terminated");
      transport.sent.push(line);
      if (settings.autoHandshake !== false) {
        // Like a real engine the answer arrives asynchronously.
        if (line === "uci") queueMicrotask(() => transport.emit("uciok"));
        if (line === "isready") queueMicrotask(() => transport.emit("readyok"));
      }
    },
    addEventListener(type, fn) {
      if (listeners[type]) listeners[type].add(fn);
    },
    removeEventListener(type, fn) {
      if (listeners[type]) listeners[type].delete(fn);
    },
    terminate() {
      transport.terminated = true;
    },
    emit(line) {
      Array.from(listeners.message).forEach((fn) => fn({ data: line }));
    },
    emitError(message) {
      Array.from(listeners.error).forEach((fn) => fn({ message }));
    },
    listenerCount() {
      return listeners.message.size + listeners.error.size;
    },
    count(prefix) {
      return transport.sent.filter((line) => line === prefix || line.startsWith(`${prefix} `)).length;
    },
  };
  return transport;
}

function makeEngine(options) {
  const settings = options || {};
  const clock = createFakeClock();
  const transports = [];
  const engine = Engine.create({
    createTransport: () => {
      const transport = createFakeTransport(settings.transport);
      transports.push(transport);
      return transport;
    },
    now: clock.now,
    timers: clock,
    ...settings.engine,
  });
  return {
    engine,
    clock,
    transports,
    get transport() {
      return transports[transports.length - 1];
    },
  };
}

function info(depth, multipv, cp, pv, extra) {
  return `info depth ${depth} seldepth ${depth + 2} multipv ${multipv} score cp ${cp}${extra || ""} nodes ${depth * 1000} nps 500000 time ${depth * 2} pv ${pv}`;
}

// ---------- unit: parseInfoLine ----------

test("unit", "parseInfoLine: centipawn score with every field", () => {
  const line = Engine.parseInfoLine("info depth 12 seldepth 18 multipv 1 score cp 34 nodes 1000 nps 400000 hashfull 3 time 25 pv e2e4 e7e5 g1f3");
  assert.deepStrictEqual(line, {
    multipv: 1, depth: 12, seldepth: 18, score: { type: "cp", value: 34 }, pv: ["e2e4", "e7e5", "g1f3"],
    nodes: 1000, nps: 400000, timeMs: 25,
  });
  assert.strictEqual("bound" in line, false, "an exact score has no bound flag");
});

test("unit", "parseInfoLine: negative centipawns, CRLF and extra spaces", () => {
  const line = Engine.parseInfoLine("  info   depth 7  multipv 1 score cp -120 pv d7d5 e2e4\r");
  assert.deepStrictEqual(line.score, { type: "cp", value: -120 });
  assert.deepStrictEqual(line.pv, ["d7d5", "e2e4"]);
});

test("unit", "parseInfoLine: mate scores, positive, negative and mate 0", () => {
  assert.deepStrictEqual(Engine.parseInfoLine("info depth 20 multipv 1 score mate 3 pv e1e8").score, { type: "mate", value: 3 });
  assert.deepStrictEqual(Engine.parseInfoLine("info depth 20 multipv 1 score mate -2 pv a2a3 g3g2").score, { type: "mate", value: -2 });
  const terminal = Engine.parseInfoLine("info depth 0 score mate 0");
  assert.deepStrictEqual(terminal, { multipv: 1, depth: 0, score: { type: "mate", value: 0 }, pv: [] });
});

test("unit", "parseInfoLine: lowerbound / upperbound are flagged, the score is kept", () => {
  const lower = Engine.parseInfoLine("info depth 15 seldepth 20 multipv 1 score cp 55 lowerbound nodes 9 nps 9 time 9 pv e2e4");
  assert.strictEqual(lower.bound, "lower");
  assert.deepStrictEqual(lower.score, { type: "cp", value: 55 });
  const upper = Engine.parseInfoLine("info depth 15 multipv 2 score cp -9 upperbound pv d2d4");
  assert.strictEqual(upper.bound, "upper");
  assert.strictEqual(upper.multipv, 2);
  const mateBound = Engine.parseInfoLine("info depth 9 multipv 1 score mate 4 lowerbound pv e1e8");
  assert.deepStrictEqual(mateBound.score, { type: "mate", value: 4 });
  assert.strictEqual(mateBound.bound, "lower");
});

test("unit", "parseInfoLine: multipv defaults to 1 and is read when present", () => {
  assert.strictEqual(Engine.parseInfoLine("info depth 5 score cp 10 pv e2e4").multipv, 1);
  assert.strictEqual(Engine.parseInfoLine("info depth 5 multipv 3 score cp 10 pv e2e4").multipv, 3);
});

test("unit", "parseInfoLine: a score line without pv is returned with an empty pv", () => {
  const line = Engine.parseInfoLine("info depth 9 multipv 1 score cp 14 nodes 500 nps 100000 time 5");
  assert.ok(line, "still a usable score line");
  assert.deepStrictEqual(line.pv, []);
  assert.strictEqual(line.score.value, 14);
});

test("unit", "parseInfoLine: pv stops at the first token that is not a UCI move", () => {
  assert.deepStrictEqual(Engine.parseInfoLine("info depth 5 score cp 1 pv e2e4 zz e7e5").pv, ["e2e4"]);
  assert.deepStrictEqual(Engine.parseInfoLine("info depth 5 score cp 1 pv e7e8q a1a1x").pv, ["e7e8q"]);
  assert.deepStrictEqual(Engine.parseInfoLine("info depth 5 score cp 1 pv (none)").pv, []);
});

test("unit", "parseInfoLine: field order does not matter, wdl and unknown keys are skipped", () => {
  const line = Engine.parseInfoLine("info nodes 10 hashfull 4 score cp 7 wdl 300 400 300 tbhits 0 multipv 2 depth 6 pv c2c4");
  assert.deepStrictEqual(line.score, { type: "cp", value: 7 });
  assert.strictEqual(line.multipv, 2);
  assert.strictEqual(line.depth, 6);
  assert.deepStrictEqual(line.pv, ["c2c4"]);
});

test("unit", "parseInfoLine: returns a fresh object every call", () => {
  const text = "info depth 5 score cp 1 pv e2e4";
  const a = Engine.parseInfoLine(text);
  const b = Engine.parseInfoLine(text);
  assert.notStrictEqual(a, b);
  assert.notStrictEqual(a.pv, b.pv);
});

test("unit", "parseInfoLine: everything that is not a usable score line is null", () => {
  [
    "info string NNUE evaluation using nn-9067e33176e8.nnue",
    "info depth 5 currmove e2e4 currmovenumber 1",
    "info depth 12 nodes 5000 nps 400000 hashfull 3 time 25",
    "bestmove e2e4 ponder e7e5",
    "uciok",
    "",
    "info",
    "info depth 3",
    "info score cp 20 pv e2e4",
    "info depth 5 score cp abc pv e2e4",
    "info depth 5 score cp",
    "info depth 5 score foo 3 pv e2e4",
    "info depth -1 score cp 1 pv e2e4",
    "info depth 5 multipv 0 score cp 1 pv e2e4",
    "info depth 5 multipv 999 score cp 1 pv e2e4",
    "info depth 5 score cp 1.5 pv e2e4",
  ].forEach((text) => assert.strictEqual(Engine.parseInfoLine(text), null, JSON.stringify(text)));
  [undefined, null, 42, {}, ["info depth 1 score cp 1"]].forEach((value) => {
    assert.strictEqual(Engine.parseInfoLine(value), null, `non-string ${String(value)}`);
  });
  assert.strictEqual(Engine.parseInfoLine(`info depth 5 score cp 1 pv ${"e2e4 ".repeat(3000)}`), null, "absurdly long lines are refused");
});

// ---------- unit: moverScore ----------

test("unit", "moverScore encodes like Scoring.encodeScore (one encoding for the whole app)", () => {
  const scores = [];
  [-3000, -1000, -35, -1, 0, 1, 35, 250, 1000, 3000].forEach((value) => scores.push({ type: "cp", value }));
  [-60, -50, -49, -10, -3, -2, -1, 0, 1, 2, 3, 10, 49, 50, 51, 200].forEach((value) => scores.push({ type: "mate", value }));
  scores.forEach((score) => {
    assert.strictEqual(Engine.moverScore({ multipv: 1, depth: 9, score, pv: ["e2e4"] }), Scoring.encodeScore(score), JSON.stringify(score));
    assert.strictEqual(Engine.moverScore(score), Scoring.encodeScore(score), "a bare score object works too");
  });
  assert.strictEqual(Engine.moverScore({ score: { type: "mate", value: 3 } }), 97000);
  assert.strictEqual(Engine.moverScore({ score: { type: "mate", value: -2 } }), -98000);
  assert.strictEqual(Engine.moverScore({ score: { type: "mate", value: 0 } }), -100000);
  assert.strictEqual(Engine.moverScore({ score: { type: "cp", value: 35 } }), 35);
  [null, undefined, {}, { score: null }, { score: { type: "cp", value: "x" } }, { score: { type: "wat", value: 1 } }, "e2e4"].forEach((bad) => {
    assert.ok(Number.isNaN(Engine.moverScore(bad)), `unusable input gives NaN: ${JSON.stringify(bad)}`);
  });
});

test("unit", "moverScore without scoring.js (engine.js loaded on its own) still encodes identically", () => {
  const vm = require("vm");
  const fs = require("fs");
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(jsDir, "engine.js"), "utf8"), context, { filename: "engine.js" });
  const standalone = context.Ludus.Engine;
  assert.strictEqual(context.Ludus.Scoring, undefined, "no Scoring in this context");
  const scores = [];
  [-99999, -3000, -35, -1, 0, 1, 35, 250, 1000, 49999, 80000].forEach((value) => scores.push({ type: "cp", value }));
  [-80, -50, -49, -10, -3, -2, -1, 0, 1, 2, 3, 10, 49, 50, 51, 200].forEach((value) => scores.push({ type: "mate", value }));
  scores.forEach((score2) => {
    assert.strictEqual(standalone.moverScore({ score: score2 }), Scoring.encodeScore(score2), JSON.stringify(score2));
  });
  assert.strictEqual(standalone.moverScore({ score: { type: "mate", value: 3 } }), 97000);
  assert.strictEqual(standalone.moverScore({ score: { type: "mate", value: -2 } }), -98000);
  assert.ok(Number.isNaN(standalone.moverScore(null)));
  assert.ok(Number.isNaN(standalone.moverScore({ score: { type: "cp", value: "x" } })));
});

test("unit", "loads as Ludus.Engine in a browser-style context in any script order, with the default timers and clock", async () => {
  const { load } = require("./_load.js");
  const env = load({ app: false, scripts: ["js/ludus.js", "js/engine.js", "js/scoring.js"] }); // engine BEFORE scoring
  const loaded = env.Ludus.Engine;
  assert.strictEqual(typeof loaded.create, "function");
  assert.strictEqual(typeof loaded.parseInfoLine, "function");
  assert.strictEqual(loaded.moverScore({ score: { type: "mate", value: 2 } }), 98000, "Scoring is looked up at call time");
  assert.strictEqual(loaded.parseInfoLine("info depth 3 score cp 9 pv e2e4").score.value, 9);

  const transport = createFakeTransport();
  const engine = loaded.create({ createTransport: () => transport }); // real setTimeout / setInterval / clock
  const pending = engine.analyze({ fen: START_FEN, movetimeMs: 50, multiPv: 1 });
  await sleep(60);
  assert.strictEqual(transport.count("go"), 1);
  transport.emit(info(6, 1, 21, "e2e4 e7e5"));
  transport.emit("bestmove e2e4");
  const result = JSON.parse(JSON.stringify(await withTimeout(pending, 2000, "default timers search")));
  assert.strictEqual(result.bestMoveUci, "e2e4");
  assert.strictEqual(result.lines[0].score.value, 21);
  assert.ok(result.elapsedMs >= 40, `default clock measured ${result.elapsedMs} ms`);
  engine.terminate();
});

// ---------- unit: driver against the fake transport ----------

test("unit", "handshake: uci, Hash, isready; ready() resolves true", async () => {
  const ctx = makeEngine({ engine: { hashMb: 48 } });
  assert.strictEqual(ctx.engine.isReady, false);
  assert.strictEqual(await ctx.engine.ready(), true);
  assert.strictEqual(ctx.engine.isReady, true);
  assert.deepStrictEqual(ctx.transport.sent, ["uci", "setoption name Hash value 48", "isready"]);
  assert.strictEqual(await ctx.engine.ready(), true, "a second ready() is a no-op");
  assert.strictEqual(ctx.transports.length, 1, "no second transport");
});

test("unit", "handshake: a silent engine times out, ready() is false, analyze rejects, ready() retries", async () => {
  const ctx = makeEngine({ transport: { autoHandshake: false }, engine: { readyTimeoutMs: 5000 } });
  const readyPromise = ctx.engine.ready();
  const analyzed = rejection(ctx.engine.analyze({ fen: START_FEN, movetimeMs: 100 }));
  await ctx.clock.advance(4999);
  assert.strictEqual(ctx.engine.state, "starting");
  await ctx.clock.advance(2);
  assert.strictEqual(await readyPromise, false);
  assert.strictEqual((await analyzed).code, "engine-timeout", "the pending request learns the real cause");
  assert.strictEqual(ctx.transport.terminated, true, "the dead transport is dropped");
  assert.strictEqual(ctx.engine.state, "failed");
  assert.strictEqual((await rejection(ctx.engine.analyze({ fen: START_FEN }))).code, "engine-failed", "failure is sticky for analyze()");
  // ready() is the explicit retry; this time the engine answers.
  const retry = ctx.engine.ready();
  ctx.transport.emit("uciok");
  await flush(); // the driver sends isready after uciok, and only then waits for readyok
  ctx.transport.emit("readyok");
  assert.strictEqual(await retry, true);
  assert.strictEqual(ctx.transports.length, 2);
});

test("unit", "handshake: a synchronous transport (answers inside postMessage) also works", async () => {
  const transports = [];
  const engine = Engine.create({
    createTransport: () => {
      const listeners = new Set();
      const transport = {
        sent: [],
        postMessage(line) {
          transport.sent.push(line);
          if (line === "uci") listeners.forEach((fn) => fn({ data: "uciok" }));
          if (line === "isready") listeners.forEach((fn) => fn({ data: "readyok" }));
        },
        addEventListener(type, fn) { if (type === "message") listeners.add(fn); },
        removeEventListener() {},
        terminate() {},
      };
      transports.push(transport);
      return transport;
    },
  });
  assert.strictEqual(await withTimeout(engine.ready(), 2000, "sync handshake"), true);
});

test("unit", "no transport available: ready() is false and analyze rejects, nothing throws", async () => {
  const engine = Engine.create({});
  assert.strictEqual(await engine.ready(), false);
  assert.strictEqual((await rejection(engine.analyze({ fen: START_FEN }))).code, "engine-failed");
  const throwing = Engine.create({ createTransport: () => { throw new Error("no worker"); } });
  assert.strictEqual(await throwing.ready(), false);
  const broken = Engine.create({ createTransport: () => ({}) });
  assert.strictEqual(await broken.ready(), false, "an object that is not a transport");
});

test("unit", "go command: movetime, depth, searchmoves last, MultiPV set per request", async () => {
  const ctx = makeEngine();
  const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
  const pending = ctx.engine.analyze({ fen, movetimeMs: 250, depth: 12, multiPv: 3, searchMoves: ["e7e5", "D7D5", "e7e5"] });
  await flush();
  await flush();
  const sent = ctx.transport.sent;
  assert.deepStrictEqual(sent.slice(-3), [
    "setoption name MultiPV value 3",
    `position fen ${fen}`,
    "go movetime 250 depth 12 searchmoves e7e5 d7d5",
  ]);
  ctx.transport.emit("bestmove e7e5");
  await pending;

  const depthOnly = ctx.engine.analyze({ fen: START_FEN, depth: 10 });
  await flush();
  assert.strictEqual(ctx.transport.sent[ctx.transport.sent.length - 1], "go depth 10");
  assert.strictEqual(ctx.transport.sent[ctx.transport.sent.length - 3], "setoption name MultiPV value 1", "multiPv defaults to 1");
  ctx.transport.emit("bestmove e2e4");
  await depthOnly;

  const dflt = ctx.engine.analyze({ fen: START_FEN });
  await flush();
  assert.strictEqual(ctx.transport.sent[ctx.transport.sent.length - 1], "go movetime 1000", "no limit given: 1 second");
  ctx.transport.emit("bestmove e2e4");
  await dflt;

  const clamps = [[0, 1], [-4, 1], [99, 8], [2.6, 3], ["abc", 1], [undefined, 1], [5, 5]];
  for (const [given, expected] of clamps) {
    const p = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 50, multiPv: given });
    await flush();
    const multipvLine = ctx.transport.sent[ctx.transport.sent.length - 3];
    assert.strictEqual(multipvLine, `setoption name MultiPV value ${expected}`, `multiPv ${String(given)}`);
    ctx.transport.emit("bestmove e2e4");
    await p;
  }
  const tiny = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 1 });
  await flush();
  assert.strictEqual(ctx.transport.sent[ctx.transport.sent.length - 1], "go movetime 10", "movetime is clamped to 10..120000 ms");
  ctx.transport.emit("bestmove e2e4");
  await tiny;
});

test("unit", "validation: nothing unsafe reaches the engine", async () => {
  const ctx = makeEngine();
  await ctx.engine.ready();
  const before = ctx.transport.sent.length;
  const bad = [
    [{ fen: `${START_FEN}\nquit` }, "engine-bad-fen"],
    [{ fen: `${START_FEN}; go infinite` }, "engine-bad-fen"],
    [{ fen: "not a fen" }, "engine-bad-fen"],
    [{ fen: "" }, "engine-bad-fen"],
    [{ fen: 42 }, "engine-bad-fen"],
    [{}, "engine-bad-fen"],
    [null, "engine-bad-request"],
    [undefined, "engine-bad-request"],
    ["8/8/8/8/8/8/8/8 w - -", "engine-bad-request"],
    [{ fen: START_FEN, searchMoves: ["e2e4; quit"] }, "engine-bad-move"],
    [{ fen: START_FEN, searchMoves: ["e2e9"] }, "engine-bad-move"],
    [{ fen: START_FEN, searchMoves: "e2e4" }, "engine-bad-move"],
    [{ fen: START_FEN, searchMoves: [42] }, "engine-bad-move"],
  ];
  for (const [request, code] of bad) {
    const error = await rejection(ctx.engine.analyze(request));
    assert.strictEqual(error.code, code, JSON.stringify(request));
    assert.strictEqual(error.message, code);
  }
  assert.strictEqual(ctx.transport.sent.length, before, "no command was sent for any rejected request");
  // Whitespace in a FEN is normalised, an empty searchMoves list means "all moves".
  const ok = ctx.engine.analyze({ fen: `  ${START_FEN.replace(/ /g, "  ")}  `, movetimeMs: 50, searchMoves: [] });
  await flush();
  assert.strictEqual(ctx.transport.sent[ctx.transport.sent.length - 1], "go movetime 50");
  assert.strictEqual(ctx.transport.sent[ctx.transport.sent.length - 2], `position fen ${START_FEN}`);
  ctx.transport.emit("bestmove e2e4");
  await ok;
});

test("unit", "lines: deepest complete exact set, bounds ignored, incomplete depth skipped", async () => {
  const ctx = makeEngine();
  const promise = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 100, multiPv: 2 });
  await flush();
  await flush();
  const t = ctx.transport;
  t.emit("info string NNUE evaluation using something");
  t.emit(info(10, 1, 20, "e2e4 e7e5"));
  t.emit(info(10, 2, 10, "d2d4 d7d5"));
  t.emit(info(11, 1, 50, "e2e4 e7e5", " lowerbound"));
  t.emit(info(11, 1, 30, "e2e4 e7e5"));
  t.emit(info(11, 2, 5, "d2d4 d7d5"));
  t.emit(info(11, 2, 999, "d2d4 d7d5", " upperbound")); // late bound for a slot that has an exact line
  t.emit(info(12, 1, 40, "e2e4 e7e5")); // depth 12 never gets its second line
  t.emit("bestmove e2e4 ponder e7e5");
  const result = await promise;
  assert.strictEqual(result.depth, 11);
  assert.deepStrictEqual(result.lines.map((l) => [l.multipv, l.depth, l.score.value]), [[1, 11, 30], [2, 11, 5]]);
  result.lines.forEach((line) => assert.strictEqual("bound" in line, false, "exact lines carry no bound flag"));
  assert.strictEqual(result.bestMoveUci, "e2e4");
  assert.strictEqual(result.aborted, false);
  assert.strictEqual(result.timedOut, false);
  assert.strictEqual(result.terminal, false);
  assert.strictEqual(result.nodes, 12000, "nodes of the most advanced info line");
});

test("unit", "lines: bound-flagged lines are the fallback only when no all-exact set exists", async () => {
  const ctx = makeEngine();
  const promise = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 100, multiPv: 2 });
  await flush();
  await flush();
  const t = ctx.transport;
  t.emit(info(5, 1, 20, "e2e4 e7e5"));
  t.emit(info(5, 2, 40, "d2d4 d7d5", " lowerbound"));
  t.emit("bestmove e2e4");
  const result = await promise;
  assert.strictEqual(result.depth, 5);
  assert.strictEqual(result.lines.length, 2);
  assert.strictEqual(result.lines[1].bound, "lower", "the fallback line stays flagged");
  assert.strictEqual("bound" in result.lines[0], false);
});

test("unit", "lines: a deeper set that needs a bound line loses to a shallower all-exact set", async () => {
  const ctx = makeEngine();
  const promise = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 100, multiPv: 2 });
  await flush();
  await flush();
  const t = ctx.transport;
  t.emit(info(10, 1, 20, "e2e4 e7e5"));
  t.emit(info(10, 2, 10, "d2d4 d7d5"));
  t.emit(info(11, 1, 25, "e2e4 e7e5"));
  t.emit(info(11, 2, 90, "d2d4 d7d5", " lowerbound")); // complete at depth 11, but slot 2 is only a bound
  t.emit("bestmove e2e4");
  const result = await promise;
  assert.strictEqual(result.depth, 10, "exact beats deeper-but-bounded");
  assert.deepStrictEqual(result.lines.map((l) => l.score.value), [20, 10]);
});

test("unit", "lines: a single legal slot completes a MultiPV-3 request; slots above the request are ignored", async () => {
  const ctx = makeEngine();
  const first = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 100, multiPv: 3 });
  await flush();
  await flush();
  ctx.transport.emit(info(6, 1, 10, "e2e4"));
  ctx.transport.emit(info(6, 2, 0, "d2d4"));
  ctx.transport.emit(info(7, 1, 12, "e2e4"));
  ctx.transport.emit(info(7, 2, 1, "d2d4"));
  ctx.transport.emit("bestmove e2e4");
  const two = await first;
  assert.deepStrictEqual(two.lines.map((l) => l.multipv), [1, 2], "two legal moves: two lines, depth 7");
  assert.strictEqual(two.depth, 7);

  const second = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 100, multiPv: 1 });
  await flush();
  ctx.transport.emit(info(4, 1, 10, "e2e4"));
  ctx.transport.emit(info(4, 2, 99, "d2d4")); // an engine that ignores MultiPV 1
  ctx.transport.emit("bestmove e2e4");
  const one = await second;
  assert.deepStrictEqual(one.lines.map((l) => l.multipv), [1]);
});

test("unit", "lines: results are copies (mutating one does not touch later ones)", async () => {
  const ctx = makeEngine();
  const promise = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 100, onInfo: () => {} });
  await flush();
  await flush();
  ctx.transport.emit(info(3, 1, 10, "e2e4 e7e5"));
  ctx.transport.emit("bestmove e2e4");
  const result = await promise;
  result.lines[0].pv.push("hacked");
  result.lines[0].score.value = 9999;
  assert.strictEqual(result.lines.length, 1);
});

test("unit", "terminal positions: no pv lines, bestmove (none) -> lines [], terminal true, bestMoveUci null", async () => {
  const ctx = makeEngine();
  const promise = ctx.engine.analyze({ fen: "R5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1", movetimeMs: 100 });
  await flush();
  await flush();
  ctx.transport.emit("info depth 0 score mate 0");
  ctx.transport.emit("bestmove (none)");
  const result = await promise;
  assert.deepStrictEqual(result.lines, []);
  assert.strictEqual(result.terminal, true);
  assert.strictEqual(result.bestMoveUci, null);
  assert.strictEqual(result.depth, 0);
});

test("unit", "one transport message may carry several lines", async () => {
  const ctx = makeEngine();
  const promise = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 100 });
  await flush();
  await flush();
  ctx.transport.emit(`${info(8, 1, 31, "e2e4 e7e5")}\r\nbestmove e2e4 ponder e7e5\r\n`);
  const result = await promise;
  assert.strictEqual(result.bestMoveUci, "e2e4");
  assert.strictEqual(result.lines[0].score.value, 31);
});

test("unit", "requests are serialized: the next go is only sent after the previous bestmove", async () => {
  const ctx = makeEngine();
  const order = [];
  const first = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 100 }).then((r) => { order.push("first"); return r; });
  const second = ctx.engine.analyze({ fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", movetimeMs: 100 }).then((r) => { order.push("second"); return r; });
  const third = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 100 }).then((r) => { order.push("third"); return r; });
  await flush();
  await flush();
  const t = ctx.transport;
  assert.strictEqual(t.count("go"), 1, "only one search on the wire");
  assert.ok(t.sent.includes(`position fen ${START_FEN}`));
  t.emit(info(4, 1, 15, "e2e4 e7e5"));
  t.emit("bestmove e2e4");
  await flush();
  await flush();
  assert.strictEqual(t.count("go"), 2, "second search started after the first finished");
  assert.strictEqual(t.sent[t.sent.length - 2], "position fen 6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1");
  t.emit("info depth 245 multipv 1 score mate 1 pv a1a8");
  t.emit("bestmove a1a8");
  await flush();
  await flush();
  assert.strictEqual(t.count("go"), 3);
  t.emit(info(4, 1, 15, "d2d4 d7d5"));
  t.emit("bestmove d2d4");
  const results = await Promise.all([first, second, third]);
  assert.deepStrictEqual(order, ["first", "second", "third"]);
  assert.strictEqual(results[0].bestMoveUci, "e2e4");
  assert.strictEqual(results[1].bestMoveUci, "a1a8");
  assert.deepStrictEqual(results[1].lines[0].score, { type: "mate", value: 1 });
  assert.strictEqual(results[2].bestMoveUci, "d2d4");
});

test("unit", "newGame: ucinewgame + isready, position only after readyok", async () => {
  const ctx = makeEngine();
  const promise = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 100, newGame: true });
  await flush();
  await flush();
  const sent = ctx.transport.sent;
  const at = (text) => sent.findIndex((line) => line === text || line.startsWith(text));
  assert.ok(at("ucinewgame") > at("setoption name Hash"), "after the handshake");
  assert.ok(sent.lastIndexOf("isready") > at("ucinewgame"), "isready follows ucinewgame");
  assert.ok(at("position fen") > sent.lastIndexOf("isready"), "position only after the sync");
  ctx.transport.emit("bestmove e2e4");
  await promise;
});

test("unit", "onInfo is throttled (~8 per second) with a trailing update and a final flush", async () => {
  const ctx = makeEngine();
  const calls = [];
  const promise = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 5000, onInfo: (payload) => calls.push({ ...payload, at: ctx.clock.now() }) });
  await flush();
  await flush();
  for (let depth = 1; depth <= 30; depth += 1) {
    ctx.transport.emit(info(depth, 1, depth, "e2e4 e7e5"));
    await ctx.clock.advance(10);
  }
  assert.ok(calls.length >= 2 && calls.length <= 4, `300 ms of updates gave ${calls.length} calls`);
  assert.strictEqual(calls[0].depth, 1, "the first update is immediate");
  assert.strictEqual(calls[0].at, 0);
  ctx.transport.emit("bestmove e2e4");
  const result = await promise;
  const last = calls[calls.length - 1];
  assert.strictEqual(last.depth, 30, "the final state is flushed when the search ends");
  assert.strictEqual(result.depth, 30);
  for (let i = 1; i < calls.length; i += 1) {
    assert.ok(calls[i].depth > calls[i - 1].depth, "depth only grows");
    assert.ok(calls[i].elapsedMs >= calls[i - 1].elapsedMs, "elapsed only grows");
  }
  assert.ok(last.elapsedMs >= 290, `elapsedMs comes from the injected clock (${last.elapsedMs})`);
  assert.deepStrictEqual(last.lines, result.lines);
  assert.strictEqual(ctx.clock.pending(), 0, "no timer is left behind after the search");
});

test("unit", "onInfo: a burst followed by silence still delivers the last state (trailing edge)", async () => {
  const ctx = makeEngine();
  const calls = [];
  const promise = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 5000, onInfo: (payload) => calls.push(payload) });
  await flush();
  await flush();
  ctx.transport.emit(info(1, 1, 1, "e2e4"));
  ctx.transport.emit(info(2, 1, 2, "e2e4"));
  ctx.transport.emit(info(3, 1, 3, "e2e4"));
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].depth, 1);
  await ctx.clock.advance(200);
  assert.strictEqual(calls.length, 2, "the trailing update fired without another info line");
  assert.strictEqual(calls[1].depth, 3);
  ctx.transport.emit("bestmove e2e4");
  await promise;
  assert.strictEqual(calls.length, 2, "nothing new to flush at the end");
});

test("unit", "onInfo: a throwing handler does not break the search", async () => {
  const ctx = makeEngine();
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args);
  try {
    const promise = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 100, onInfo: () => { throw new Error("ui bug"); } });
    await flush();
    await flush();
    ctx.transport.emit(info(3, 1, 3, "e2e4"));
    ctx.transport.emit("bestmove e2e4");
    const result = await promise;
    assert.strictEqual(result.bestMoveUci, "e2e4");
  } finally {
    console.error = originalError;
  }
  assert.ok(errors.length >= 1, "the handler error is reported, not swallowed silently");
});

test("unit", "abort through a plain { aborted } flag: stop is sent, the promise resolves with what it has", async () => {
  const ctx = makeEngine();
  const signal = { aborted: false };
  const promise = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 5000, signal });
  await flush();
  await flush();
  ctx.transport.emit(info(5, 1, 12, "e2e4 e7e5"));
  await ctx.clock.advance(100);
  assert.strictEqual(ctx.transport.count("stop"), 0, "not aborted yet");
  signal.aborted = true;
  await ctx.clock.advance(50); // one poll tick
  assert.strictEqual(ctx.transport.count("stop"), 1);
  await ctx.clock.advance(100); // still inside the wait for bestmove
  assert.strictEqual(ctx.transport.count("stop"), 1, "stop is sent exactly once");
  ctx.transport.emit(info(6, 1, 14, "e2e4 e7e5"));
  ctx.transport.emit("bestmove e2e4");
  const result = await promise;
  assert.strictEqual(result.aborted, true);
  assert.strictEqual(result.bestMoveUci, "e2e4");
  assert.strictEqual(result.depth, 6);
  assert.strictEqual(ctx.clock.pending(), 0);
});

test("unit", "abort through an AbortSignal is immediate (no polling needed)", async () => {
  const ctx = makeEngine();
  const controller = new AbortController();
  const promise = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 5000, signal: controller.signal });
  await flush();
  await flush();
  ctx.transport.emit(info(5, 1, 12, "e2e4 e7e5"));
  controller.abort();
  assert.strictEqual(ctx.transport.count("stop"), 1, "stop went out synchronously with the abort event");
  ctx.transport.emit("bestmove e2e4");
  const result = await promise;
  assert.strictEqual(result.aborted, true);
  assert.strictEqual(result.lines.length, 1);
});

test("unit", "abort before the search starts: resolves at once, the engine is never started", async () => {
  const ctx = makeEngine();
  const result = await ctx.engine.analyze({ fen: START_FEN, movetimeMs: 5000, signal: { aborted: true } });
  assert.deepStrictEqual(result, { lines: [], depth: 0, nodes: 0, elapsedMs: 0, bestMoveUci: null, aborted: true, timedOut: false, terminal: false });
  assert.strictEqual(ctx.transports.length, 0);
  const controller = new AbortController();
  controller.abort();
  assert.strictEqual((await ctx.engine.analyze({ fen: START_FEN, signal: controller.signal })).aborted, true);
});

test("unit", "abort while queued: resolves (empty, aborted) without waiting for the running search", async () => {
  const ctx = makeEngine();
  const first = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 5000 });
  const flag = { aborted: false };
  const second = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 5000, signal: flag });
  await flush();
  await flush();
  flag.aborted = true;
  await ctx.clock.advance(50);
  const result = await second;
  assert.strictEqual(result.aborted, true);
  assert.deepStrictEqual(result.lines, []);
  assert.strictEqual(ctx.transport.count("go"), 1, "the aborted request never reached the engine");
  ctx.transport.emit("bestmove e2e4");
  assert.strictEqual((await first).aborted, false, "the running search was not affected");
});

test("unit", "stop() aborts the running search; stop({ all: true }) also drops the queue", async () => {
  const ctx = makeEngine();
  const first = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 5000 });
  const second = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 5000 });
  await flush();
  await flush();
  ctx.engine.stop();
  assert.strictEqual(ctx.transport.count("stop"), 1);
  ctx.transport.emit(info(3, 1, 3, "e2e4"));
  ctx.transport.emit("bestmove e2e4");
  assert.strictEqual((await first).aborted, true);
  await flush();
  await flush();
  assert.strictEqual(ctx.transport.count("go"), 2, "plain stop() lets the queue continue");
  const third = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 5000 });
  ctx.engine.stop({ all: true });
  ctx.transport.emit("bestmove e2e4");
  const [b, c] = await Promise.all([second, third]);
  assert.strictEqual(b.aborted, true);
  assert.strictEqual(c.aborted, true);
  assert.strictEqual(ctx.transport.count("go"), 2, "nothing else was started");
  ctx.engine.stop(); // no search running: harmless
});

test("unit", "an engine that ignores stop: the caller is released early, the engine stays reserved until bestmove", async () => {
  const ctx = makeEngine({ engine: { abortWaitMs: 300 } });
  const signal = { aborted: false };
  const first = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 9000, signal });
  const second = ctx.engine.analyze({ fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", movetimeMs: 100 });
  await flush();
  await flush();
  ctx.transport.emit(info(7, 1, 20, "e2e4 e7e5"));
  signal.aborted = true;
  await ctx.clock.advance(40); // poll tick: stop sent, but no bestmove comes
  assert.strictEqual(ctx.transport.count("stop"), 1);
  await ctx.clock.advance(300);
  const early = await first;
  assert.strictEqual(early.aborted, true);
  assert.strictEqual(early.bestMoveUci, "e2e4", "falls back to the first move of the best line");
  assert.strictEqual(early.lines.length, 1);
  assert.strictEqual(ctx.transport.count("go"), 1, "the second search must not start while the engine is still searching");
  ctx.transport.emit("bestmove e2e4 ponder e7e5"); // the late answer to the aborted search
  await flush();
  await flush();
  assert.strictEqual(ctx.transport.count("go"), 2, "now the second search runs");
  ctx.transport.emit("info depth 245 multipv 1 score mate 1 pv a1a8");
  ctx.transport.emit("bestmove a1a8");
  const result = await second;
  assert.strictEqual(result.bestMoveUci, "a1a8");
  assert.strictEqual(result.aborted, false);
});

test("unit", "a search that overruns its budget is stopped, then the engine is declared dead if it still says nothing", async () => {
  const ctx = makeEngine({ engine: { stopGraceMs: 4000, abortWaitMs: 300 } });
  const promise = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 100 });
  await flush();
  await flush();
  ctx.transport.emit(info(3, 1, 3, "e2e4"));
  await ctx.clock.advance(4099);
  assert.strictEqual(ctx.transport.count("stop"), 0, "still inside movetime + grace");
  await ctx.clock.advance(2);
  assert.strictEqual(ctx.transport.count("stop"), 1, "over budget: stop is sent");
  await ctx.clock.advance(300);
  const result = await promise;
  assert.strictEqual(result.timedOut, true);
  assert.strictEqual(result.aborted, true);
  assert.strictEqual(result.lines.length, 1);
  assert.strictEqual(ctx.engine.state, "ready", "one overrun is survivable");
  await ctx.clock.advance(4000);
  assert.strictEqual(ctx.engine.state, "failed", "no bestmove even after stop: the engine is wedged");
  assert.strictEqual(ctx.transport.terminated, true);
});

test("unit", "a depth-only search is bounded by maxSearchMs", async () => {
  const ctx = makeEngine({ engine: { maxSearchMs: 2000, abortWaitMs: 100 } });
  const promise = ctx.engine.analyze({ fen: START_FEN, depth: 60 });
  await flush();
  await flush();
  await ctx.clock.advance(2001);
  assert.strictEqual(ctx.transport.count("stop"), 1);
  ctx.transport.emit(info(30, 1, 5, "e2e4"));
  ctx.transport.emit("bestmove e2e4");
  const result = await promise;
  assert.strictEqual(result.timedOut, true);
  assert.strictEqual(result.bestMoveUci, "e2e4");
});

test("unit", "terminate(): pending and queued requests reject with engine-terminated, the transport is released", async () => {
  const ctx = makeEngine();
  const first = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 5000 });
  const second = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 5000 });
  await flush();
  await flush();
  const t = ctx.transport;
  const beforeListeners = t.listenerCount();
  assert.ok(beforeListeners > 0);
  const errors = Promise.all([rejection(first), rejection(second)]);
  ctx.engine.terminate();
  const [a, b] = await errors;
  assert.strictEqual(a.code, "engine-terminated");
  assert.strictEqual(b.message, "engine-terminated");
  assert.strictEqual(t.terminated, true);
  assert.ok(t.sent.includes("quit"), "the engine is told to quit");
  assert.strictEqual(t.listenerCount(), 0, "listeners are removed");
  assert.strictEqual(ctx.clock.pending(), 0, "timers are cleared");
  assert.strictEqual(ctx.engine.isReady, false);
  assert.strictEqual(ctx.engine.state, "terminated");
  assert.strictEqual(await ctx.engine.ready(), false);
  assert.strictEqual((await rejection(ctx.engine.analyze({ fen: START_FEN }))).code, "engine-terminated");
  ctx.engine.terminate(); // idempotent
  ctx.engine.stop();
  assert.strictEqual(ctx.transports.length, 1, "no new transport after terminate()");
});

test("unit", "terminate() while the engine is still starting", async () => {
  const ctx = makeEngine({ transport: { autoHandshake: false } });
  const readyPromise = ctx.engine.ready();
  const analyzePromise = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 100 });
  const rejected = rejection(analyzePromise);
  await flush();
  ctx.engine.terminate();
  assert.strictEqual(await readyPromise, false);
  assert.strictEqual((await rejected).code, "engine-terminated");
  assert.strictEqual(ctx.clock.pending(), 0, "the handshake timeout is cleared");
});

test("unit", "a transport error rejects everything pending; ready() can recover with a fresh transport", async () => {
  const ctx = makeEngine();
  const running = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 5000 });
  const queued = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 5000 });
  await flush();
  await flush();
  const rejected = Promise.all([rejection(running), rejection(queued)]);
  ctx.transport.emitError("worker crashed");
  const [a, b] = await rejected;
  assert.strictEqual(a.code, "engine-failed");
  assert.strictEqual(b.code, "engine-failed");
  assert.strictEqual(ctx.engine.state, "failed");
  assert.strictEqual(ctx.engine.isReady, false);
  assert.strictEqual(ctx.transport.terminated, true);
  assert.strictEqual((await rejection(ctx.engine.analyze({ fen: START_FEN }))).code, "engine-failed");
  assert.strictEqual(await ctx.engine.ready(), true, "explicit retry");
  assert.strictEqual(ctx.transports.length, 2);
  const again = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 100 });
  await flush();
  await flush();
  ctx.transport.emit("bestmove e2e4");
  assert.strictEqual((await again).bestMoveUci, "e2e4");
});

test("unit", "a postMessage that throws fails the engine instead of leaving promises hanging", async () => {
  const ctx = makeEngine();
  await ctx.engine.ready();
  ctx.transport.postMessage = () => { throw new Error("worker gone"); };
  const error = await withTimeout(rejection(ctx.engine.analyze({ fen: START_FEN, movetimeMs: 100 })), 2000, "analyze after broken transport");
  assert.strictEqual(error.code, "engine-failed");
});

test("unit", "messages that are not strings, and stray lines with no search running, are ignored", async () => {
  const ctx = makeEngine();
  await ctx.engine.ready();
  ctx.transport.emit(undefined);
  ctx.transport.emit(42);
  ctx.transport.emit("bestmove e2e4");
  ctx.transport.emit(info(3, 1, 3, "e2e4"));
  const promise = ctx.engine.analyze({ fen: START_FEN, movetimeMs: 100 });
  await flush();
  await flush();
  ctx.transport.emit({ weird: true });
  ctx.transport.emit("bestmove e2e4");
  const result = await promise;
  assert.deepStrictEqual(result.lines, [], "the stray info line from before the search did not leak in");
});

// ---------- integration: the real vendored Stockfish ----------

test("integration", "the vendored engine is present", () => {
  assert.ok(engineAvailable(), `vendored Stockfish missing: ${ENGINE_PATH} (and its .wasm) must exist; the integration tests never skip`);
});

function createRealEngine(extra) {
  const transports = [];
  const log = [];
  const engine = Engine.create({
    createTransport: () => {
      const transport = createNodeTransport({ log });
      transports.push(transport);
      return transport;
    },
    readyTimeoutMs: 20000,
    ...extra,
  });
  return { engine, transports, log };
}

let shared = null;

test("integration", "handshake with the real engine", async () => {
  shared = createRealEngine();
  assert.strictEqual(await withTimeout(shared.engine.ready(), 25000, "engine start"), true);
  assert.strictEqual(shared.engine.isReady, true);
  assert.ok(shared.log.some((entry) => entry.dir === "in" && entry.line === "uciok"));
});

test("integration", "mate in 1: mate score from the mover's point of view and the right bestmove", async () => {
  const fen = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1";
  const result = await withTimeout(shared.engine.analyze({ fen, movetimeMs: 300, multiPv: 2 }), 10000, "mate in 1");
  assert.strictEqual(result.bestMoveUci, "a1a8");
  assert.strictEqual(result.lines.length >= 1, true);
  assert.deepStrictEqual(result.lines[0].score, { type: "mate", value: 1 });
  assert.strictEqual(result.lines[0].pv[0], "a1a8");
  assert.strictEqual(Engine.moverScore(result.lines[0]), 99000);
  assert.strictEqual(result.terminal, false);
  // Cross-check with the shared chess module: the move is legal and mates.
  const board = new Chess(fen);
  const move = uciToMove(result.bestMoveUci, board);
  assert.ok(move, "the engine's move is legal for Ludus.chess");
  board.makeMove(move);
  assert.strictEqual(board.isCheckmate(), true);
});

test("integration", "mate in 1 for Black: scores are relative to the side to move, not to White", async () => {
  const result = await withTimeout(shared.engine.analyze({ fen: "r5k1/8/8/8/8/8/5PPP/6K1 b - - 0 1", movetimeMs: 300 }), 10000, "black mate");
  assert.strictEqual(result.bestMoveUci, "a8a1");
  assert.deepStrictEqual(result.lines[0].score, { type: "mate", value: 1 }, "positive: Black is the one mating");
});

test("integration", "being mated: a negative mate score", async () => {
  const result = await withTimeout(shared.engine.analyze({ fen: "8/8/8/8/8/5kq1/P7/7K w - - 0 1", movetimeMs: 300, multiPv: 2 }), 10000, "mated");
  assert.strictEqual(result.lines.length, 2, "both pawn moves are listed");
  result.lines.forEach((line) => assert.deepStrictEqual(line.score, { type: "mate", value: -1 }));
  assert.strictEqual(Engine.moverScore(result.lines[0]), -99000);
  assert.deepStrictEqual(result.lines.map((l) => l.pv[0]).sort(), ["a2a3", "a2a4"]);
});

test("integration", "MultiPV = 3 from the start position: 3 distinct legal lines ordered by score", async () => {
  const result = await withTimeout(shared.engine.analyze({ fen: START_FEN, depth: 10, movetimeMs: 2000, multiPv: 3, newGame: true }), 10000, "multipv 3");
  assert.strictEqual(result.lines.length, 3);
  assert.deepStrictEqual(result.lines.map((l) => l.multipv), [1, 2, 3]);
  const firstMoves = result.lines.map((l) => l.pv[0]);
  assert.strictEqual(new Set(firstMoves).size, 3, `three different first moves: ${firstMoves}`);
  const board = new Chess(START_FEN);
  firstMoves.forEach((uci) => assert.ok(uciToMove(uci, board), `${uci} is legal`));
  const scores = result.lines.map((l) => Engine.moverScore(l));
  assert.ok(scores[0] >= scores[1] && scores[1] >= scores[2], `scores are ordered: ${scores}`);
  assert.ok(scores.every((s) => Math.abs(s) < 200), "opening scores are small centipawn values");
  assert.ok(result.lines.every((l) => l.depth === result.depth), "one consistent depth for the whole set");
  assert.ok(result.depth >= 6, `reached a reasonable depth (${result.depth})`);
  assert.strictEqual(result.bestMoveUci, result.lines[0].pv[0]);
  assert.ok(result.nodes > 0);
  assert.ok(result.elapsedMs > 0 && result.elapsedMs < 5000);
});

test("integration", "MultiPV is set per request (no leakage from a previous request)", async () => {
  const three = await withTimeout(shared.engine.analyze({ fen: START_FEN, movetimeMs: 150, multiPv: 3 }), 10000, "mpv 3");
  const one = await withTimeout(shared.engine.analyze({ fen: START_FEN, movetimeMs: 150, multiPv: 1 }), 10000, "mpv 1");
  const two = await withTimeout(shared.engine.analyze({ fen: START_FEN, movetimeMs: 150, multiPv: 2 }), 10000, "mpv 2");
  assert.strictEqual(three.lines.length, 3);
  assert.strictEqual(one.lines.length, 1);
  assert.strictEqual(two.lines.length, 2);
});

test("integration", "searchMoves restricts the search to the given moves", async () => {
  const single = await withTimeout(shared.engine.analyze({ fen: START_FEN, movetimeMs: 200, multiPv: 3, searchMoves: ["a2a3"] }), 10000, "searchmoves 1");
  assert.strictEqual(single.lines.length, 1, "only one move was allowed");
  assert.strictEqual(single.lines[0].pv[0], "a2a3");
  assert.strictEqual(single.bestMoveUci, "a2a3");

  const pair = await withTimeout(shared.engine.analyze({ fen: START_FEN, movetimeMs: 200, multiPv: 3, searchMoves: ["b1c3", "g1f3"] }), 10000, "searchmoves 2");
  assert.deepStrictEqual(pair.lines.map((l) => l.pv[0]).sort(), ["b1c3", "g1f3"]);
  assert.ok(["b1c3", "g1f3"].includes(pair.bestMoveUci));

  // The score of a restricted move is the score of that move (same POV as the free search).
  const free = await withTimeout(shared.engine.analyze({ fen: START_FEN, depth: 9, movetimeMs: 2000, multiPv: 5, newGame: true }), 10000, "free");
  const target = free.lines[free.lines.length - 1];
  const only = await withTimeout(shared.engine.analyze({ fen: START_FEN, depth: 9, movetimeMs: 2000, searchMoves: [target.pv[0]] }), 10000, "restricted");
  assert.strictEqual(only.lines[0].pv[0], target.pv[0]);
  assert.ok(Math.abs(Engine.moverScore(only.lines[0]) - Engine.moverScore(target)) < 120, "same ballpark as the MultiPV score for that move");
});

test("integration", "Scoring.flipAfterMove agrees with the engine: score after the move, flipped, equals the score before it", async () => {
  // Mate in 2 for White (Kg6 + Rg1 against Kh8): 1.Rb1 (or similar) and then mate.
  const fen = "7k/8/6K1/8/8/8/8/6R1 w - - 0 1";
  const before = await withTimeout(shared.engine.analyze({ fen, depth: 14, movetimeMs: 2000, newGame: true }), 10000, "mate in 2 before");
  assert.deepStrictEqual(before.lines[0].score, { type: "mate", value: 2 });
  const board = new Chess(fen);
  board.makeMove(uciToMove(before.lines[0].pv[0], board));
  const after = await withTimeout(shared.engine.analyze({ fen: board.fen(), depth: 14, movetimeMs: 2000 }), 10000, "mate in 2 after");
  assert.deepStrictEqual(after.lines[0].score, { type: "mate", value: -1 }, "the side to move (Black) is being mated in 1");
  assert.strictEqual(Scoring.flipAfterMove(Engine.moverScore(after.lines[0])), Engine.moverScore(before.lines[0]));

  // The other direction: my move allows a mate in 1.
  const lostFen = "8/8/8/8/8/5kq1/P7/7K w - - 0 1";
  const lostBefore = await withTimeout(shared.engine.analyze({ fen: lostFen, movetimeMs: 300, multiPv: 2, newGame: true }), 10000, "mated before");
  const lostBoard = new Chess(lostFen);
  lostBoard.makeMove(uciToMove("a2a3", lostBoard));
  const lostAfter = await withTimeout(shared.engine.analyze({ fen: lostBoard.fen(), movetimeMs: 300 }), 10000, "mated after");
  assert.deepStrictEqual(lostAfter.lines[0].score, { type: "mate", value: 1 }, "Black mates in 1");
  const viaSearchMoves = lostBefore.lines.find((line) => line.pv[0] === "a2a3");
  assert.strictEqual(Scoring.flipAfterMove(Engine.moverScore(lostAfter.lines[0])), Engine.moverScore(viaSearchMoves));

  // And a move that delivers mate is "mate in 1" for the mover (opponent has no move: no lines, terminal).
  const mateFen = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1";
  const mateBoard = new Chess(mateFen);
  mateBoard.makeMove(uciToMove("a1a8", mateBoard));
  const mated = await withTimeout(shared.engine.analyze({ fen: mateBoard.fen(), movetimeMs: 100 }), 10000, "already mated");
  assert.strictEqual(mated.terminal, true);
  assert.strictEqual(Scoring.flipAfterMove(Scoring.encodeScore({ type: "mate", value: 0 })), 99000, "mate 0 for the opponent = mate in 1 for me");
});

test("integration", "depth-limited search", async () => {
  const result = await withTimeout(shared.engine.analyze({ fen: START_FEN, depth: 8, newGame: true }), 10000, "depth 8");
  assert.ok(result.depth >= 8, `depth ${result.depth}`);
  assert.strictEqual(result.aborted, false);
  assert.strictEqual(result.timedOut, false);
});

test("integration", "checkmate and stalemate at the root", async () => {
  const mated = await withTimeout(shared.engine.analyze({ fen: "R5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1", movetimeMs: 200 }), 10000, "checkmate root");
  assert.deepStrictEqual([mated.lines, mated.bestMoveUci, mated.terminal], [[], null, true]);
  const stale = await withTimeout(shared.engine.analyze({ fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", movetimeMs: 200 }), 10000, "stalemate root");
  assert.deepStrictEqual([stale.lines, stale.bestMoveUci, stale.terminal], [[], null, true]);
});

test("integration", "onInfo is throttled and its last call equals the result", async () => {
  const calls = [];
  const result = await withTimeout(shared.engine.analyze({
    fen: START_FEN, movetimeMs: 400, multiPv: 2, newGame: true, onInfo: (payload) => calls.push(payload),
  }), 10000, "onInfo");
  assert.ok(calls.length >= 1, "progress was reported");
  assert.ok(calls.length <= Math.ceil(result.elapsedMs / 125) + 2, `${calls.length} updates in ${result.elapsedMs} ms`);
  assert.ok(calls.every((c) => c.lines.length >= 1 && c.depth >= 1));
  // Progress is keyed on what a person sees (depth, score, line), not on the node counters: a late info line that only
  // moved nodes / nps / timeMs is deliberately not re-emitted, so compare the meaningful fields (this used to flake).
  const seen = (line) => ({ multipv: line.multipv, score: line.score, pv: line.pv });
  assert.deepStrictEqual(calls[calls.length - 1].lines.map(seen), result.lines.map(seen));
  assert.strictEqual(calls[calls.length - 1].depth, result.depth);
});

test("integration", "abort resolves early with what the engine had, and the engine stays usable", async () => {
  const signal = { aborted: false };
  setTimeout(() => { signal.aborted = true; }, 250);
  const startedAt = Date.now();
  const result = await withTimeout(shared.engine.analyze({ fen: START_FEN, movetimeMs: 20000, multiPv: 2, signal, newGame: true }), 10000, "abort");
  const tookMs = Date.now() - startedAt;
  assert.ok(tookMs < 3000, `aborted search finished in ${tookMs} ms, not 20 s`);
  assert.strictEqual(result.aborted, true);
  assert.ok(result.lines.length >= 1, "partial result has lines");
  assert.ok(uciToMove(result.bestMoveUci, new Chess(START_FEN)), "and a legal best move");
  const after = await withTimeout(shared.engine.analyze({ fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", movetimeMs: 200 }), 10000, "after abort");
  assert.strictEqual(after.bestMoveUci, "a1a8", "the next request is answered correctly (no stale bestmove)");
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 150);
  const viaSignal = await withTimeout(shared.engine.analyze({ fen: START_FEN, movetimeMs: 20000, signal: controller.signal }), 10000, "AbortController");
  assert.strictEqual(viaSignal.aborted, true);
  shared.engine.stop(); // idle: no-op
});

test("integration", "two concurrent analyze() calls are serialized, each with its own answer", async () => {
  const before = shared.log.length;
  const a = shared.engine.analyze({ fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", movetimeMs: 300 });
  const b = shared.engine.analyze({ fen: START_FEN, movetimeMs: 300 });
  const [first, second] = await withTimeout(Promise.all([a, b]), 15000, "concurrent");
  assert.strictEqual(first.bestMoveUci, "a1a8");
  assert.deepStrictEqual(first.lines[0].score, { type: "mate", value: 1 });
  assert.ok(uciToMove(second.bestMoveUci, new Chess(START_FEN)), "the second answer belongs to the second position");
  assert.strictEqual(second.lines[0].score.type, "cp");
  const wire = shared.log.slice(before)
    .filter((entry) => (entry.dir === "out" && entry.line.startsWith("go")) || (entry.dir === "in" && entry.line.startsWith("bestmove")))
    .map((entry) => (entry.dir === "out" ? "go" : "bestmove"));
  assert.deepStrictEqual(wire, ["go", "bestmove", "go", "bestmove"], "never two searches at once");
});

test("integration", "terminate() rejects a running search and kills the process", async () => {
  const own = createRealEngine();
  assert.strictEqual(await withTimeout(own.engine.ready(), 25000, "second engine start"), true);
  const transport = own.transports[0];
  const pid = transport.pid;
  const running = own.engine.analyze({ fen: START_FEN, movetimeMs: 20000 });
  const queued = own.engine.analyze({ fen: START_FEN, movetimeMs: 20000 });
  const rejected = Promise.all([rejection(running), rejection(queued)]);
  await sleep(150);
  own.engine.terminate();
  const [a, b] = await withTimeout(rejected, 5000, "terminate rejections");
  assert.strictEqual(a.code, "engine-terminated");
  assert.strictEqual(b.code, "engine-terminated");
  await withTimeout(transport.exited, 5000, "process exit after terminate");
  assert.throws(() => process.kill(pid, 0), (error) => error.code === "ESRCH", "the Stockfish process is gone");
  assert.strictEqual(await own.engine.ready(), false);
  assert.strictEqual((await rejection(own.engine.analyze({ fen: START_FEN }))).code, "engine-terminated");
});

test("integration", "a crashing engine process fails the engine instead of hanging", async () => {
  const own = createRealEngine();
  assert.strictEqual(await withTimeout(own.engine.ready(), 25000, "third engine start"), true);
  const running = own.engine.analyze({ fen: START_FEN, movetimeMs: 20000 });
  await sleep(100);
  process.kill(own.transports[0].pid, "SIGKILL");
  const error = await withTimeout(rejection(running), 5000, "crash rejection");
  assert.strictEqual(error.code, "engine-failed");
  assert.strictEqual(own.engine.state, "failed");
  own.engine.terminate();
});

test("integration", "cleanup: the shared engine terminates and its process exits", async () => {
  const transport = shared.transports[0];
  shared.engine.terminate();
  await withTimeout(transport.exited, 5000, "shared engine exit");
  shared = null;
});

// ---------- runner ----------

let currentTest = "";
let finished = false;

// A test that awaits a promise which never settles leaves nothing on the event
// loop, and Node then exits with status 0 without a word. That must never look
// like success.
process.on("exit", (code) => {
  if (!finished && code === 0) {
    console.error(`engine.test.js: the process ended before the tests finished; a promise never settled in: ${currentTest}`);
    process.exitCode = 1;
  }
});

async function main() {
  const watchdog = setTimeout(() => {
    console.error("engine.test.js: overall timeout (120 s)");
    process.exit(1);
  }, 120000);
  watchdog.unref();

  const startedAt = Date.now();
  const counts = { unit: 0, integration: 0 };
  for (const { group, name, fn } of tests) {
    currentTest = `[${group}] ${name}`;
    try {
      await fn();
    } catch (error) {
      console.error(`FAIL [${group}] ${name}`);
      console.error(error && error.stack ? error.stack : error);
      if (shared) shared.engine.terminate();
      process.exit(1);
    }
    counts[group] += 1;
  }
  finished = true;
  console.log(`engine.test.js passed (${counts.unit} unit + ${counts.integration} integration tests against the real Stockfish, ${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
