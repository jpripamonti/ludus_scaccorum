// UCI driver: MultiPV, searchmoves, throttled progress, abort, serialized
// requests. It talks to the engine through an injected *transport* (a Worker in
// the browser, a child process in the Node tests), so this file has no DOM and
// no Node dependency at load time. Contract: docs/ARCHITECTURE.md section 6.
//
//   const eng = Ludus.Engine.create({ createTransport, hashMb, readyTimeoutMs });
//   await eng.ready();                                  // -> boolean, never rejects
//   const res = await eng.analyze({ fen, movetimeMs, depth, multiPv, searchMoves,
//                                   onInfo, signal, newGame });
//   res = { lines, depth, nodes, elapsedMs, bestMoveUci, aborted, timedOut, terminal }
//
// Design notes (the things a maintainer would otherwise have to rediscover):
//   * One search at a time. Every analyze() is queued; the next "go" is only
//     sent after the previous "bestmove" arrived, so a late bestmove can never
//     be mistaken for the answer to the next request.
//   * `lines` is the DEEPEST COMPLETE SET of MultiPV lines the engine reported:
//     every slot 1..N present at the same depth, with a proper (exact) score.
//     Lines flagged lowerbound/upperbound are only used when no exact line
//     exists for that depth+slot, and a set that needs them is only used when
//     no all-exact set exists at all. A search cut off mid-iteration therefore
//     returns the previous, consistent iteration instead of a half-updated one.
//     Rarely (a fail-high at the very end of the time budget) the engine's own
//     bestmove can differ from lines[0]; bestMoveUci is always the engine's
//     answer, lines[0] is always the last consistent iteration.
//   * Everything that goes to the engine is validated first (FEN shape, UCI
//     moves, integer ranges), so a hostile FEN cannot smuggle a second UCI
//     command onto the wire.
//   * Failure is explicit and sticky: a transport error or a hung engine
//     rejects everything pending with Error("engine-...") and further analyze()
//     calls reject immediately until ready() is called again (an explicit
//     retry). terminate() is final.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Engine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const MIN_MULTIPV = 1;
  const MAX_MULTIPV = 8;
  const DEFAULT_MOVETIME_MS = 1000;
  const MIN_MOVETIME_MS = 10;
  const MAX_MOVETIME_MS = 120000;
  const MAX_DEPTH = 99;
  const MAX_SEARCH_MOVES = 64;
  const MAX_INFO_LINE_LENGTH = 8192;

  const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
  // Piece placement, side, castling, en passant, optional clocks. Only the
  // characters a FEN can contain, single spaces, no control characters.
  const FEN_SHAPE = /^[1-8pnbrqkPNBRQK/]+ [wb] (?:-|[KQkq]{1,4}) (?:-|[a-h][36])(?: \d{1,4} \d{1,5})?$/;

  // ---------- Score encoding (shared with js/scoring.js) ----------
  // The single source of truth is Scoring.encodeScore. This local copy only
  // exists so engine.js also works when scoring.js is not loaded; a test keeps
  // the two identical.

  const MATE_BASE = 100000;
  const MATE_STEP = 1000;
  const MATE_MAX_DISTANCE = 50;

  function fallbackEncodeScore(score) {
    if (!score || typeof score !== "object") return NaN;
    const value = Number(score.value);
    if (!Number.isFinite(value)) return NaN;
    if (score.type === "mate") {
      const magnitude = MATE_BASE - Math.min(MATE_MAX_DISTANCE, Math.abs(Math.round(value))) * MATE_STEP;
      return value > 0 ? magnitude : -magnitude;
    }
    if (score.type === "cp") {
      const limit = MATE_BASE - MATE_MAX_DISTANCE * MATE_STEP - 1;
      return Math.max(-limit, Math.min(limit, Math.round(value)));
    }
    return NaN;
  }

  function scoringApi() {
    if (root.Ludus && root.Ludus.Scoring && typeof root.Ludus.Scoring.encodeScore === "function") {
      return root.Ludus.Scoring;
    }
    return null;
  }

  // Line (or bare {type, value} score) -> the number encoding used across the
  // app: centipawns from the side to move's point of view, mate as
  // +-(100000 - 1000 * min(50, n)). NaN when the input is unusable.
  function moverScore(line) {
    const score = line && typeof line === "object" && line.score && typeof line.score === "object" ? line.score : line;
    const scoring = scoringApi();
    return scoring ? scoring.encodeScore(score) : fallbackEncodeScore(score);
  }

  // ---------- Parsing ----------

  function toInt(token) {
    return typeof token === "string" && /^-?\d+$/.test(token) ? Number(token) : NaN;
  }

  // "info depth 12 seldepth 18 multipv 2 score cp -35 lowerbound nodes 1234 nps
  // 500000 time 80 pv e2e4 e7e5 ..." -> Line, or null when the line carries no
  // usable score (currmove, string, hashfull, garbage, ...).
  //
  // Line = { multipv, depth, score: {type: "cp"|"mate", value}, pv: string[],
  //          seldepth?, nodes?, nps?, timeMs?, bound?: "lower"|"upper" }
  //
  // A score line without a pv is returned with pv: [] (the position may simply
  // have no move, e.g. "info depth 0 score mate 0"); callers decide what to do
  // with it. pv is cut at the first token that is not a UCI move.
  function parseInfoLine(line) {
    if (typeof line !== "string" || line.length > MAX_INFO_LINE_LENGTH) return null;
    const tokens = line.trim().split(/\s+/);
    if (tokens[0] !== "info" || tokens.length < 3) return null;

    let depth = NaN;
    let multipv = 1;
    let score = null;
    let bound = null;
    let seldepth = null;
    let nodes = null;
    let nps = null;
    let timeMs = null;
    const pv = [];

    let i = 1;
    while (i < tokens.length) {
      const key = tokens[i];
      if (key === "string") return null; // free text, never carries a score
      if (key === "pv") {
        for (let j = i + 1; j < tokens.length; j += 1) {
          if (!UCI_MOVE.test(tokens[j])) break;
          pv.push(tokens[j]);
        }
        break;
      }
      if (key === "refutation" || key === "currline") break;
      if (key === "score") {
        const type = tokens[i + 1];
        const value = toInt(tokens[i + 2]);
        if ((type !== "cp" && type !== "mate") || !Number.isFinite(value)) return null;
        score = { type, value };
        i += 3;
        if (tokens[i] === "lowerbound") {
          bound = "lower";
          i += 1;
        } else if (tokens[i] === "upperbound") {
          bound = "upper";
          i += 1;
        }
        continue;
      }
      if (key === "wdl") {
        i += 4;
        continue;
      }
      const next = toInt(tokens[i + 1]);
      switch (key) {
        case "depth": depth = next; i += 2; continue;
        case "seldepth": seldepth = Number.isFinite(next) ? next : null; i += 2; continue;
        case "multipv": multipv = next; i += 2; continue;
        case "nodes": nodes = Number.isFinite(next) ? next : null; i += 2; continue;
        case "nps": nps = Number.isFinite(next) ? next : null; i += 2; continue;
        case "time": timeMs = Number.isFinite(next) ? next : null; i += 2; continue;
        default: i += 1; // currmove, hashfull, tbhits, cpuload, unknown keys
      }
    }

    if (!score) return null;
    if (!Number.isInteger(depth) || depth < 0 || depth > 1000) return null;
    if (!Number.isInteger(multipv) || multipv < 1 || multipv > 256) return null;

    const parsed = { multipv, depth, score, pv };
    if (seldepth !== null) parsed.seldepth = seldepth;
    if (nodes !== null) parsed.nodes = nodes;
    if (nps !== null) parsed.nps = nps;
    if (timeMs !== null) parsed.timeMs = timeMs;
    if (bound) parsed.bound = bound;
    return parsed;
  }

  function parseBestMove(line) {
    const tokens = String(line).trim().split(/\s+/);
    if (tokens[0] !== "bestmove") return { valid: false, move: null };
    const move = tokens[1];
    if (move === undefined) return { valid: false, move: null };
    if (UCI_MOVE.test(move)) return { valid: true, move };
    return { valid: true, move: null }; // "(none)" / "0000": no legal move
  }

  // ---------- Errors ----------

  function engineError(code, detail) {
    const error = new Error(`engine-${code}`);
    error.code = `engine-${code}`;
    if (detail) error.detail = String(detail);
    return error;
  }

  function asEngineError(error) {
    if (error && typeof error.message === "string" && error.message.indexOf("engine-") === 0) return error;
    return engineError("failed", error && error.message);
  }

  // ---------- Search state: which lines to report ----------

  function newSearchState() {
    return { depths: new Map(), maxSlot: 0, nodes: 0 };
  }

  function recordInfo(search, line, maxSlots) {
    if (!line.pv.length || line.multipv > maxSlots) return false;
    let slots = search.depths.get(line.depth);
    if (!slots) {
      slots = new Map();
      search.depths.set(line.depth, slots);
      if (search.depths.size > 128) {
        let oldest = Infinity;
        search.depths.forEach((_, depth) => {
          if (depth < oldest) oldest = depth;
        });
        search.depths.delete(oldest);
      }
    }
    const entry = slots.get(line.multipv) || { exact: null, bound: null };
    if (line.bound) entry.bound = line;
    else entry.exact = line;
    slots.set(line.multipv, entry);
    if (line.multipv > search.maxSlot) search.maxSlot = line.multipv;
    if (Number.isFinite(line.nodes) && line.nodes > search.nodes) search.nodes = line.nodes;
    return true;
  }

  // The deepest complete set (see the header comment for the exact rule).
  function pickLines(search) {
    const expected = search.maxSlot;
    if (!expected) return { depth: 0, lines: [] };
    const depths = Array.from(search.depths.keys()).sort((a, b) => b - a);
    let mixed = null;
    let partial = null;
    for (const depth of depths) {
      const slots = search.depths.get(depth);
      const exactLines = [];
      const anyLines = [];
      let exactComplete = true;
      let anyComplete = true;
      for (let slot = 1; slot <= expected; slot += 1) {
        const entry = slots.get(slot);
        if (entry && entry.exact) {
          exactLines.push(entry.exact);
          anyLines.push(entry.exact);
        } else if (entry && entry.bound) {
          exactComplete = false;
          anyLines.push(entry.bound);
        } else {
          exactComplete = false;
          anyComplete = false;
        }
      }
      if (exactComplete) return { depth, lines: exactLines };
      if (anyComplete && !mixed) mixed = { depth, lines: anyLines };
      else if (!anyComplete && anyLines.length && !partial) partial = { depth, lines: anyLines };
    }
    return mixed || partial || { depth: 0, lines: [] };
  }

  function cloneLine(line) {
    const copy = { ...line, score: { ...line.score }, pv: line.pv.slice() };
    return copy;
  }

  function lineKey(picked) {
    return `${picked.depth}|${picked.lines.map((l) => `${l.multipv}:${l.score.type}${l.score.value}:${l.pv.join("")}`).join(",")}`;
  }

  // ---------- Request validation ----------

  function clampInt(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function prepareRequest(request) {
    if (!request || typeof request !== "object") throw engineError("bad-request");
    const fen = typeof request.fen === "string" ? request.fen.trim().replace(/\s+/g, " ") : "";
    if (!fen || fen.length > 100 || !FEN_SHAPE.test(fen)) throw engineError("bad-fen");

    let searchMoves = null;
    if (request.searchMoves !== undefined && request.searchMoves !== null) {
      if (!Array.isArray(request.searchMoves) || request.searchMoves.length > MAX_SEARCH_MOVES) {
        throw engineError("bad-move", "searchMoves");
      }
      const seen = new Set();
      searchMoves = [];
      request.searchMoves.forEach((move) => {
        const uci = typeof move === "string" ? move.trim().toLowerCase() : "";
        if (!UCI_MOVE.test(uci)) throw engineError("bad-move", String(move).slice(0, 12));
        if (!seen.has(uci)) {
          seen.add(uci);
          searchMoves.push(uci);
        }
      });
      if (!searchMoves.length) searchMoves = null;
    }

    const hasTime = request.movetimeMs !== undefined && request.movetimeMs !== null;
    const hasDepth = request.depth !== undefined && request.depth !== null;
    const movetimeMs = hasTime ? clampInt(request.movetimeMs, MIN_MOVETIME_MS, MAX_MOVETIME_MS, DEFAULT_MOVETIME_MS) : null;
    const depth = hasDepth ? clampInt(request.depth, 1, MAX_DEPTH, null) : null;

    return {
      fen,
      searchMoves,
      multiPv: clampInt(request.multiPv, MIN_MULTIPV, MAX_MULTIPV, 1),
      movetimeMs: movetimeMs === null && depth === null ? DEFAULT_MOVETIME_MS : movetimeMs,
      depth,
      newGame: request.newGame === true,
      onInfo: typeof request.onInfo === "function" ? request.onInfo : null,
      signal: request.signal && typeof request.signal === "object" ? request.signal : null,
    };
  }

  function goCommand(job) {
    let command = "go";
    if (job.movetimeMs !== null) command += ` movetime ${job.movetimeMs}`;
    if (job.depth !== null) command += ` depth ${job.depth}`;
    // searchmoves must come last: it swallows every following token as a move.
    if (job.searchMoves) command += ` searchmoves ${job.searchMoves.join(" ")}`;
    return command;
  }

  function abortedResult() {
    return { lines: [], depth: 0, nodes: 0, elapsedMs: 0, bestMoveUci: null, aborted: true, timedOut: false, terminal: false };
  }

  // ---------- Driver ----------

  // WebAssembly SIMD128, which the engine's wasm needs (Chrome 91, Firefox 89, Safari 16.4 and later): a 29-byte module
  // with one v128 instruction is valid only where the browser can run it. Without it the file would be downloaded (7 MB)
  // and fail to start, every session; asking first lets the page say so and use the simpler engine at once.
  const SIMD_PROBE = [0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11];

  function supported() {
    try {
      const wasm = root.WebAssembly;
      if (!wasm || typeof wasm.validate !== "function" || typeof root.Worker !== "function") return false;
      return wasm.validate(new Uint8Array(SIMD_PROBE)) === true;
    } catch (error) {
      return false;
    }
  }

  function defaultCreateTransport() {
    if (typeof root.Worker === "function") {
      return () => new root.Worker("vendor/stockfish-18-lite-single.js");
    }
    return null;
  }

  function defaultNow() {
    if (root.performance && typeof root.performance.now === "function") return root.performance.now();
    return Date.now();
  }

  function create(options) {
    const config = options && typeof options === "object" ? options : {};
    const createTransport = typeof config.createTransport === "function" ? config.createTransport : defaultCreateTransport();
    const hashMb = clampInt(config.hashMb, 1, 512, 32);
    const readyTimeoutMs = clampInt(config.readyTimeoutMs, 1, 300000, 30000);
    const throttleMs = clampInt(config.throttleMs, 0, 5000, 125);
    const pollMs = clampInt(config.pollMs, 1, 1000, 40);
    const abortWaitMs = clampInt(config.abortWaitMs, 0, 10000, 300);
    const stopGraceMs = clampInt(config.stopGraceMs, 1, 60000, 4000);
    const maxSearchMs = clampInt(config.maxSearchMs, 1000, 3600000, 120000);
    // A search that has produced no line at all after this long means a worker that is gone without an error (a
    // killed tab process, a wedged wasm): it is declared failed then, not after the whole budget and both grace periods.
    const silenceMs = clampInt(config.silenceMs, 100, 60000, 3000);
    const now = typeof config.now === "function" ? config.now : defaultNow;
    const timerSource = config.timers && typeof config.timers === "object" ? config.timers : {};
    const timers = {
      setTimeout: timerSource.setTimeout || ((fn, ms) => root.setTimeout(fn, ms)),
      clearTimeout: timerSource.clearTimeout || ((id) => root.clearTimeout(id)),
      setInterval: timerSource.setInterval || ((fn, ms) => root.setInterval(fn, ms)),
      clearInterval: timerSource.clearInterval || ((id) => root.clearInterval(id)),
    };

    let state = "idle"; // idle | starting | ready | failed | terminated
    let transport = null;
    let startPromise = null;
    let waiter = null; // {text, resolve, reject}: one handshake / sync step at a time
    let current = null; // the job that owns the engine right now
    let queue = [];

    // ----- transport plumbing -----

    function send(line) {
      if (!transport) return false;
      try {
        transport.postMessage(line);
        return true;
      } catch (error) {
        failTransport(error);
        return false;
      }
    }

    function dropTransport(sayQuit) {
      const old = transport;
      transport = null;
      if (!old) return;
      try {
        if (sayQuit && typeof old.postMessage === "function") old.postMessage("quit");
      } catch (error) {
        // The engine may already be gone.
      }
      try {
        if (typeof old.removeEventListener === "function") {
          old.removeEventListener("message", onMessage);
          old.removeEventListener("error", onTransportError);
        }
      } catch (error) {
        // Ignore: we are tearing down anyway.
      }
      try {
        if (typeof old.terminate === "function") old.terminate();
      } catch (error) {
        // Ignore.
      }
    }

    function clearJobTimers(job) {
      if (job.pollTimer !== null) timers.clearInterval(job.pollTimer);
      if (job.deadlineTimer !== null) timers.clearTimeout(job.deadlineTimer);
      if (job.abortWaitTimer !== null) timers.clearTimeout(job.abortWaitTimer);
      if (job.trailTimer !== null) timers.clearTimeout(job.trailTimer);
      if (job.silenceTimer) timers.clearTimeout(job.silenceTimer);
      job.silenceTimer = null;
      job.pollTimer = null;
      job.deadlineTimer = null;
      job.abortWaitTimer = null;
      job.trailTimer = null;
      if (job.signalCleanup) {
        job.signalCleanup();
        job.signalCleanup = null;
      }
    }

    function rejectJob(job, error) {
      clearJobTimers(job);
      if (job.settled) return;
      job.settled = true;
      job.reject(error);
    }

    function rejectAll(error) {
      const running = current;
      const waiting = queue;
      current = null;
      queue = [];
      if (running) rejectJob(running, error);
      waiting.forEach((job) => rejectJob(job, error));
    }

    function failTransport(error) {
      if (state === "terminated" || state === "failed") return;
      state = "failed";
      const wrapped = asEngineError(error);
      dropTransport(false);
      if (waiter) {
        const pending = waiter;
        waiter = null;
        pending.reject(wrapped);
      }
      rejectAll(wrapped);
    }

    function onTransportError(event) {
      const detail = event && (event.message || (event.error && event.error.message));
      failTransport(engineError("failed", detail));
    }

    // Register BEFORE sending the command that provokes the answer: a transport
    // is allowed to reply synchronously. The no-op catch keeps a rejection that
    // nobody awaits (the caller bailed out early) from becoming unhandled.
    function waitFor(text) {
      const promise = new Promise((resolve, reject) => {
        waiter = { text, resolve, reject };
      });
      promise.catch(() => {});
      return promise;
    }

    // ----- startup handshake -----

    async function startTransport() {
      let created;
      try {
        if (!createTransport) throw new Error("no transport available");
        created = createTransport();
        if (!created || typeof created.postMessage !== "function" || typeof created.addEventListener !== "function") {
          throw new Error("invalid transport");
        }
      } catch (error) {
        state = "failed";
        return false;
      }
      transport = created;
      created.addEventListener("message", onMessage);
      created.addEventListener("error", onTransportError);
      const timeout = timers.setTimeout(() => {
        if (state === "starting") failTransport(engineError("timeout", "handshake"));
      }, readyTimeoutMs);
      try {
        const gotUciOk = waitFor("uciok");
        if (!send("uci")) return false;
        await gotUciOk;
        send(`setoption name Hash value ${hashMb}`);
        const gotReadyOk = waitFor("readyok");
        if (!send("isready")) return false;
        await gotReadyOk;
        if (state !== "starting") return false;
        state = "ready";
        return true;
      } catch (error) {
        if (state === "starting") failTransport(error);
        return false;
      } finally {
        timers.clearTimeout(timeout);
      }
    }

    function ensureStarted() {
      if (state === "terminated") return Promise.resolve(false);
      if (state === "ready") return Promise.resolve(true);
      if (state === "failed") return Promise.resolve(false);
      if (startPromise) return startPromise;
      state = "starting";
      const attempt = startTransport().then((ok) => {
        if (startPromise === attempt) startPromise = null;
        return ok;
      });
      startPromise = attempt;
      return attempt;
    }

    // ready() is also the explicit retry after a failure.
    function ready() {
      if (state === "failed") {
        state = "idle";
        startPromise = null;
      }
      return ensureStarted();
    }

    // ----- incoming lines -----

    function onMessage(event) {
      const data = event && typeof event === "object" && "data" in event ? event.data : event;
      if (typeof data !== "string" || data.length > 262144) return;
      const lines = data.indexOf("\n") === -1 ? [data] : data.split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i].trim();
        if (line) handleLine(line);
      }
    }

    function handleLine(line) {
      if (waiter && line === waiter.text) {
        const pending = waiter;
        waiter = null;
        pending.resolve(line);
        return;
      }
      const job = current;
      if (!job || (job.phase !== "searching" && job.phase !== "stopping" && job.phase !== "draining")) return;
      // Any line of the engine's answer is proof of life.
      if (job.silenceTimer && (line.startsWith("info ") || line.startsWith("bestmove"))) {
        timers.clearTimeout(job.silenceTimer);
        job.silenceTimer = null;
      }
      if (line.startsWith("info ")) {
        if (job.phase !== "draining") handleInfo(job, line);
      } else if (line.startsWith("bestmove")) {
        handleBestMove(job, line);
      }
    }

    function handleInfo(job, line) {
      const parsed = parseInfoLine(line);
      if (!parsed) return;
      if (!recordInfo(job.search, parsed, job.multiPv)) return;
      if (job.onInfo) noteInfo(job);
    }

    function handleBestMove(job, line) {
      const best = parseBestMove(line);
      if (!best.valid) return;
      if (job.phase === "draining") {
        // The caller already got its (early) answer; this only frees the engine.
        clearJobTimers(job);
        current = null;
        pump();
        return;
      }
      completeJob(job, best.move, best.move === null);
    }

    // ----- progress throttling -----

    function noteInfo(job) {
      const picked = pickLines(job.search);
      if (!picked.lines.length) return;
      const key = lineKey(picked);
      if (key === job.lastKey) return;
      job.dirty = true;
      const wait = job.lastEmitAt + throttleMs - now();
      if (wait <= 0) {
        emitInfo(job);
      } else if (job.trailTimer === null) {
        job.trailTimer = timers.setTimeout(() => {
          job.trailTimer = null;
          if (job.dirty && !job.settled) emitInfo(job);
        }, wait);
      }
    }

    function emitInfo(job) {
      if (job.trailTimer !== null) {
        timers.clearTimeout(job.trailTimer);
        job.trailTimer = null;
      }
      const picked = pickLines(job.search);
      job.dirty = false;
      job.lastEmitAt = now();
      job.lastKey = lineKey(picked);
      try {
        job.onInfo({ depth: picked.depth, elapsedMs: Math.max(0, Math.round(now() - job.startedAt)), lines: picked.lines.map(cloneLine) });
      } catch (error) {
        if (root.console && typeof root.console.error === "function") root.console.error("[engine] onInfo handler failed", error);
      }
    }

    // ----- job lifecycle -----

    function buildResult(job, bestMoveUci, extra) {
      const picked = pickLines(job.search);
      const lines = picked.lines.map(cloneLine);
      return {
        lines,
        depth: picked.depth,
        nodes: job.search.nodes,
        elapsedMs: Math.max(0, Math.round(now() - job.startedAt)),
        bestMoveUci: bestMoveUci !== undefined ? bestMoveUci : null,
        aborted: Boolean(extra && extra.aborted) || job.aborted,
        timedOut: Boolean(extra && extra.timedOut) || job.timedOut,
        terminal: Boolean(extra && extra.terminal),
      };
    }

    function completeJob(job, bestMoveUci, terminal) {
      if (job.dirty && job.onInfo) emitInfo(job);
      clearJobTimers(job);
      if (current === job) current = null;
      if (!job.settled) {
        job.settled = true;
        job.resolve(buildResult(job, bestMoveUci, { terminal }));
      }
      pump();
    }

    function signalAborted(job) {
      return Boolean(job.signal && job.signal.aborted);
    }

    // Resolves queued jobs whose signal is already aborted.
    function sweepQueue() {
      if (!queue.length) return;
      const keep = [];
      queue.forEach((job) => {
        if (signalAborted(job)) {
          clearJobTimers(job);
          job.settled = true;
          job.resolve(abortedResult());
        } else {
          keep.push(job);
        }
      });
      queue = keep;
    }

    function pump() {
      if (current || state !== "ready") return;
      sweepQueue();
      const job = queue.shift();
      if (!job) return;
      runJob(job);
    }

    function runJob(job) {
      current = job;
      job.startedAt = now();
      job.search = newSearchState();
      job.pollTimer = timers.setInterval(() => {
        if (signalAborted(job)) requestStop(job);
        sweepQueue();
      }, pollMs);
      if (job.newGame) {
        job.phase = "syncing";
        const synced = waitFor("readyok");
        if (!send("ucinewgame") || !send("isready")) return;
        synced.then(() => {
          if (current !== job || job.settled) return;
          if (job.aborted || signalAborted(job)) {
            job.aborted = true;
            clearJobTimers(job);
            current = null;
            job.settled = true;
            job.resolve(abortedResult());
            pump();
            return;
          }
          startSearch(job);
        }, () => {
          // failTransport() already rejected the job.
        });
      } else if (signalAborted(job)) {
        job.aborted = true;
        clearJobTimers(job);
        current = null;
        job.settled = true;
        job.resolve(abortedResult());
        pump();
      } else {
        startSearch(job);
      }
    }

    function startSearch(job) {
      job.phase = "searching";
      const deadline = job.movetimeMs !== null ? job.movetimeMs + stopGraceMs : maxSearchMs;
      job.deadlineTimer = timers.setTimeout(() => onDeadline(job), deadline);
      job.silenceTimer = timers.setTimeout(() => {
        job.silenceTimer = null;
        if (current === job && !job.settled && job.phase === "searching") failTransport(engineError("timeout", "no output from the engine"));
      }, silenceMs);
      if (!send(`setoption name MultiPV value ${job.multiPv}`)) return;
      if (!send(`position fen ${job.fen}`)) return;
      send(goCommand(job));
    }

    // First deadline: the engine overran its budget, ask it to stop. Second
    // deadline (stop went unanswered): the engine is wedged, give up on it.
    function onDeadline(job) {
      job.deadlineTimer = null;
      if (current !== job || job.settled && job.phase !== "draining") return;
      if (job.phase === "searching") {
        job.timedOut = true;
        job.aborted = true; // we are stopping it: the result is partial
        beginStop(job);
        job.deadlineTimer = timers.setTimeout(() => onDeadline(job), stopGraceMs);
      } else {
        failTransport(engineError("timeout", "no bestmove after stop"));
      }
    }

    function beginStop(job) {
      job.phase = "stopping";
      send("stop");
      if (job.abortWaitTimer === null) {
        job.abortWaitTimer = timers.setTimeout(() => resolveEarly(job), abortWaitMs);
      }
    }

    // The engine did not answer "stop" fast enough: hand the caller what we
    // have and keep the engine reserved until its bestmove finally arrives.
    function resolveEarly(job) {
      job.abortWaitTimer = null;
      if (current !== job || job.phase !== "stopping" || job.settled) return;
      if (job.trailTimer !== null) {
        timers.clearTimeout(job.trailTimer);
        job.trailTimer = null;
      }
      job.phase = "draining";
      job.settled = true;
      const result = buildResult(job, undefined, {});
      result.bestMoveUci = result.lines.length ? result.lines[0].pv[0] : null;
      result.aborted = true;
      job.resolve(result);
    }

    function requestStop(job) {
      if (current !== job || job.settled) return;
      job.aborted = true;
      if (job.phase === "searching") beginStop(job);
    }

    // ----- public API -----

    function analyze(request) {
      return new Promise((resolve, reject) => {
        let job;
        try {
          job = prepareRequest(request);
        } catch (error) {
          reject(error);
          return;
        }
        if (state === "terminated") {
          reject(engineError("terminated"));
          return;
        }
        if (state === "failed") {
          reject(engineError("failed", "call ready() to retry"));
          return;
        }
        if (signalAborted(job)) {
          resolve(abortedResult());
          return;
        }
        Object.assign(job, {
          resolve,
          reject,
          phase: "queued",
          settled: false,
          aborted: false,
          timedOut: false,
          search: null,
          startedAt: 0,
          lastEmitAt: -Infinity,
          lastKey: "",
          dirty: false,
          pollTimer: null,
          deadlineTimer: null,
          abortWaitTimer: null,
          trailTimer: null,
          silenceTimer: null,
          signalCleanup: null,
        });
        if (job.signal && typeof job.signal.addEventListener === "function") {
          const onAbort = () => {
            if (current === job) {
              requestStop(job);
            } else {
              sweepQueue();
            }
          };
          try {
            job.signal.addEventListener("abort", onAbort);
            job.signalCleanup = () => {
              try {
                job.signal.removeEventListener("abort", onAbort);
              } catch (error) {
                // Ignore.
              }
            };
          } catch (error) {
            job.signalCleanup = null;
          }
        }
        queue.push(job);
        ensureStarted().then((ok) => {
          if (ok) {
            pump();
          } else if (state === "terminated") {
            rejectAll(engineError("terminated"));
          } else {
            rejectAll(engineError("failed", "engine did not start"));
          }
        });
      });
    }

    // Stops the running search (it resolves with what it has). With
    // stop({ all: true }) or stop(true) queued requests are dropped too and
    // resolve as aborted.
    function stop(stopOptions) {
      const all = stopOptions === true || Boolean(stopOptions && stopOptions.all);
      if (all) {
        const waiting = queue;
        queue = [];
        waiting.forEach((job) => {
          clearJobTimers(job);
          job.settled = true;
          job.aborted = true;
          job.resolve(abortedResult());
        });
      }
      if (current) requestStop(current);
    }

    function terminate() {
      if (state === "terminated") return;
      state = "terminated";
      const error = engineError("terminated");
      dropTransport(true);
      if (waiter) {
        const pending = waiter;
        waiter = null;
        pending.reject(error);
      }
      rejectAll(error);
    }

    return {
      ready,
      analyze,
      stop,
      terminate,
      get isReady() {
        return state === "ready";
      },
      get state() {
        return state;
      },
    };
  }

  return { create, parseInfoLine, moverScore, supported, MAX_MULTIPV };
});
