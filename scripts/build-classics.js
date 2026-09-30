#!/usr/bin/env node
"use strict";

// Builds js/data/classics.data.js (Ludus.ClassicsData) from
//   data/classics/games/<id>.pgn   the scores (one game per file)
//   data/classics/notes.json       hand-written titles, blurbs, sources, moments
// and the vendored Stockfish (run over stdin/stdout in a child process).
//
// Pipeline (contract: docs/ARCHITECTURE.md section 14, notes: docs/CLASSICS_DATA.md):
//   1. every PGN is replayed with js/chess.js; an illegal move fails the build,
//      and the final position must agree with the recorded result;
//   2. quick pass  (depth 12, MultiPV 3) over EVERY position of every game: the
//      sanity report (no stream of engine blunders that would hint at a
//      corrupted score, final position clearly decided);
//   3. mid pass    (depth 16, MultiPV 3) over the protagonist's moves, then the
//      selection: per game 6..12 positions on the protagonist's side where the
//      master's move is the engine's best (or within 20 cp), the alternatives
//      are clearly worse or the move is a tactic / sacrifice, and it is not a
//      trivial recapture; spread across the game; hand-written moments kept;
//   4. deep pass   (depth 18, MultiPV 5) on the shortlist -> reference lines;
//      positions are re-scored on the deep data and the final ones are kept;
//   5. emit js/data/classics.data.js and data/classics/verification.json.
//
// Engine output is cached in data/classics/.cache/ (git-ignored), so a rebuild
// is fast, resumable and deterministic for a given cache.
//
// Usage:
//   node scripts/build-classics.js                build (uses/extends the cache)
//   node scripts/build-classics.js --check        verify PGNs replay and the committed data is not stale
//   node scripts/build-classics.js --analyze      quick pass + report only (no notes needed)
//   options: --jobs N (engine processes, default 3, max 4)  --only id,id  --no-write
//   env:     LUDUS_BUILT_AT=<ISO string> (stamped into the data; default is a fixed date)

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data", "classics");
const GAMES_DIR = path.join(DATA_DIR, "games");
const NOTES_FILE = path.join(DATA_DIR, "notes.json");
const CACHE_DIR = path.join(DATA_DIR, ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "engine.json");
const VERIFY_FILE = path.join(DATA_DIR, "verification.json");
const OUT_FILE = path.join(ROOT, "js", "data", "classics.data.js");
const ENGINE_FILE = path.join(ROOT, "vendor", "stockfish-18-lite-single.js");
const ENGINE_SUMS = path.join(ROOT, "vendor", "SHA256SUMS");

require(path.join(ROOT, "js", "ludus.js"));
const chessApi = require(path.join(ROOT, "js", "chess.js"));
const pgnApi = require(path.join(ROOT, "js", "pgn.js"));
const { Chess, uciToMove, moveToUci, moveToSan } = chessApi;

// ---------------------------------------------------------------- constants

// Bump when the selection/classification logic or the output shape changes:
// `--check` treats data built by another version as stale.
const BUILDER_VERSION = 3; // 3: the data carries `names` and `events` (display forms per language)
const DATA_VERSION = 1;
const QUICK = { depth: 12, multipv: 3 };
const MID = { depth: 16, multipv: 3 };   // candidate detection (deep combinations are invisible at depth 12)
const DEEP = { depth: 18, multipv: 5 };
const PV_PLIES = 8;             // reference lines keep this many plies
const SACRIFICE_PV_PLIES = 12;   // ...but the sacrifice test looks a little further
const DEFAULT_BUILT_AT = "2026-09-30T00:00:00.000Z";
const MIN_POSITIONS = 6;
const MAX_POSITIONS = 12;
const TOLERANCE_CP = 20;          // quick pass: master move must be within this of the best
const DEEP_TOLERANCE_CP = 30;     // deep pass: a little slack for depth noise
const MIN_LEGAL_MOVES = 8;
const DEFAULT_MIN_PLY = 6;        // no positions before the 4th move unless a moment asks for it
const ONLY_MOVE_GAP_PCT = 12;     // same threshold as Scoring (best vs 2nd line, win%)
const BLUNDER_CP = 300;           // sanity pass: eval drop that counts as a blunder
const MAX_BLUNDERS_PER_GAME = 6;  // above this a game is flagged (needs a documented override)
const MATE_LIMIT = 50000;

const RESULTS = ["1-0", "0-1", "1/2-1/2"];
const PIECE_VALUES = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

// ------------------------------------------------------------------ helpers

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const stripCheck = (san) => String(san).replace(/[+#]+$/, "");

function sha(text, len = 16) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, len);
}

function normalizeText(text) {
  return String(text).replace(/\r\n?/g, "\n");
}

function readText(file) {
  return normalizeText(fs.readFileSync(file, "utf8"));
}

function fail(message) {
  const error = new Error(message);
  error.classicsBuild = true;
  throw error;
}

// Mate encoding of docs/ARCHITECTURE.md section 7: +-(100000 - 1000 * min(50, n)).
function encodeScore(type, value) {
  if (type === "mate") {
    const magnitude = 100000 - 1000 * Math.min(50, Math.abs(value));
    return value < 0 ? -magnitude : magnitude;
  }
  return value;
}

const isMate = (score) => Math.abs(score) >= MATE_LIMIT;
const mateIn = (score) => Math.round((100000 - Math.abs(score)) / 1000);

// Lichess logistic on clamped centipawns; mates map to 0 / 100.
function winPct(score) {
  if (score >= MATE_LIMIT) return 100;
  if (score <= -MATE_LIMIT) return 0;
  const cp = clamp(score, -1000, 1000);
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

// ----------------------------------------------------- game loading / replay

function listGameIds() {
  return fs.readdirSync(GAMES_DIR).filter((f) => f.endsWith(".pgn")).map((f) => f.slice(0, -4)).sort();
}

function loadNotes() {
  let raw;
  try {
    raw = fs.readFileSync(NOTES_FILE, "utf8");
  } catch (error) {
    fail(`cannot read ${path.relative(ROOT, NOTES_FILE)}: ${error.message}`);
  }
  try {
    return { text: normalizeText(raw), json: JSON.parse(raw) };
  } catch (error) {
    fail(`${path.relative(ROOT, NOTES_FILE)} is not valid JSON: ${error.message}`);
  }
  return null;
}

// Replays one PGN. Returns { id, tags, moves:[{san, uci, fenBefore, capture, to, piece}], fens, finalFen, ... }.
function loadGame(id) {
  const file = path.join(GAMES_DIR, `${id}.pgn`);
  const text = readText(file);
  const parts = pgnApi.splitGamesFromText(text);
  if (parts.length !== 1) fail(`${id}.pgn must contain exactly one game (found ${parts.length})`);
  const built = pgnApi.buildGameFromText(parts[0]);
  if (!built) fail(`${id}.pgn: could not be parsed (oversized or malformed)`);
  const { tags, sanMoves } = built;
  const start = pgnApi.resolveGameStartFen(tags);
  if (!start.valid) fail(`${id}.pgn: invalid SetUp/FEN tags`);
  if (start.fen !== Chess.START_FEN) fail(`${id}.pgn: classic games must start from the initial position`);
  const missing = ["Event", "Site", "Date", "White", "Black", "Result"].filter((k) => !pgnApi.cleanTagValue(tags[k]) && k !== "Date");
  if (missing.length) fail(`${id}.pgn: missing tags ${missing.join(", ")}`);
  if (!RESULTS.includes(tags.Result)) fail(`${id}.pgn: Result must be one of ${RESULTS.join(" | ")}`);
  if (!/^\d{4}\.(\d\d|\?\?)\.(\d\d|\?\?)$/.test(tags.Date || "")) fail(`${id}.pgn: Date must look like 1858.11.02 or 1858.??.??`);
  if (tags.ECO && !/^[A-E]\d\d$/.test(tags.ECO)) fail(`${id}.pgn: ECO must look like C41`);

  const chess = new Chess();
  const moves = [];
  const fens = [chess.fen()];
  for (let i = 0; i < sanMoves.length; i += 1) {
    const move = chessApi.sanToMove(sanMoves[i], chess);
    if (!move) {
      const number = Math.floor(i / 2) + 1;
      const dots = i % 2 === 0 ? "." : "...";
      fail(`${id}.pgn: illegal or unparsable move "${sanMoves[i]}" at ${number}${dots} (ply index ${i}) in position ${chess.fen()}`);
    }
    const san = moveToSan(chess, move);
    moves.push({
      san,
      uci: moveToUci(move),
      fenBefore: chess.fen(),
      capture: Boolean(move.capture || move.enPassant),
      to: move.to,
      piece: move.piece,
    });
    chess.makeMove(move);
    fens.push(chess.fen());
  }
  const legal = chess.generateMoves();
  const inCheck = chess.inCheck(chess.turn);
  const terminal = legal.length === 0 ? (inCheck ? "checkmate" : "stalemate") : null;
  if (terminal === "checkmate") {
    const expected = chess.turn === "w" ? "0-1" : "1-0";
    if (tags.Result !== expected) fail(`${id}.pgn: the game ends in checkmate but Result is ${tags.Result} (expected ${expected})`);
  } else if (terminal === "stalemate" && tags.Result !== "1/2-1/2") {
    fail(`${id}.pgn: the game ends in stalemate but Result is ${tags.Result}`);
  }
  return { id, tags, moves, fens, terminal, finalTurn: chess.turn, text, hash: sha(text) };
}

// ------------------------------------------------------------- UCI engine

function parseInfo(line) {
  if (!line.startsWith("info ") || line.includes(" lowerbound") || line.includes(" upperbound")) return null;
  const t = line.split(" ");
  let depth = null;
  let mpv = 1;
  let type = null;
  let value = null;
  let pv = null;
  for (let i = 1; i < t.length; i += 1) {
    if (t[i] === "depth") depth = Number(t[++i]);
    else if (t[i] === "multipv") mpv = Number(t[++i]);
    else if (t[i] === "score") {
      type = t[++i];
      value = Number(t[++i]);
    } else if (t[i] === "pv") {
      pv = t.slice(i + 1);
      break;
    }
  }
  if (depth === null || !Number.isFinite(depth) || !type || !Number.isFinite(value) || !pv || pv.length === 0) return null;
  if (type !== "cp" && type !== "mate") return null;
  return { depth, mpv, type, value, pv };
}

class UciEngine {
  constructor() {
    this.child = spawn(process.execPath, [ENGINE_FILE], { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });
    this.partial = "";
    this.listener = null;
    this.onDeath = null;
    this.dead = false;
    this.child.stdout.on("data", (chunk) => this.feed(chunk.toString("utf8")));
    this.child.stderr.on("data", () => {});
    this.child.stdin.on("error", () => {});
    this.child.on("error", (error) => this.die(error));
    this.child.on("exit", () => this.die(new Error("engine process exited")));
  }

  feed(text) {
    this.partial += text;
    let index = this.partial.indexOf("\n");
    while (index !== -1) {
      const line = this.partial.slice(0, index).replace(/\r$/, "");
      this.partial = this.partial.slice(index + 1);
      if (this.listener) this.listener(line);
      index = this.partial.indexOf("\n");
    }
  }

  die(error) {
    if (this.dead) return;
    this.dead = true;
    if (this.onDeath) this.onDeath(error);
  }

  send(line) {
    if (this.dead) return;
    this.child.stdin.write(`${line}\n`);
  }

  exchange(commands, isDone, onLine, timeoutMs = 10 * 60 * 1000) {
    return new Promise((resolve, reject) => {
      if (this.dead) {
        reject(new Error("engine is not running"));
        return;
      }
      const finish = (fn, value) => {
        clearTimeout(timer);
        this.listener = null;
        this.onDeath = null;
        fn(value);
      };
      const timer = setTimeout(() => finish(reject, new Error("engine timeout")), timeoutMs);
      this.onDeath = (error) => finish(reject, error);
      this.listener = (line) => {
        if (onLine) onLine(line);
        if (isDone(line)) finish(resolve, line);
      };
      commands.forEach((command) => this.send(command));
    });
  }

  async init() {
    await this.exchange(["uci"], (l) => l === "uciok", null, 60000);
    this.send("setoption name Hash value 32");
    this.send("setoption name Threads value 1");
    await this.exchange(["isready"], (l) => l === "readyok", null, 60000);
  }

  // Returns [{ type, value, pv:[uci...] }] ordered by multipv, from the mover's point of view.
  async analyze({ fen, depth, multipv, searchmoves }) {
    await this.exchange(["ucinewgame", "isready"], (l) => l === "readyok", null, 60000);
    const best = new Map();
    const go = `go depth ${depth}${searchmoves && searchmoves.length ? ` searchmoves ${searchmoves.join(" ")}` : ""}`;
    await this.exchange(
      [`setoption name MultiPV value ${multipv}`, `position fen ${fen}`, go],
      (l) => l.startsWith("bestmove"),
      (l) => {
        const info = parseInfo(l);
        if (!info) return;
        const prev = best.get(info.mpv);
        if (!prev || info.depth >= prev.depth) best.set(info.mpv, info);
      },
    );
    return [...best.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => ({ type: v.type, value: v.value, pv: v.pv, depth: v.depth }));
  }

  close() {
    if (this.dead) return;
    try {
      this.send("quit");
      this.child.stdin.end();
    } catch (error) {
      // ignore
    }
    setTimeout(() => {
      try {
        this.child.kill();
      } catch (error) {
        // ignore
      }
    }, 500).unref();
  }
}

// ------------------------------------------------------------ engine cache

function engineId() {
  try {
    return sha(readText(ENGINE_SUMS), 16);
  } catch (error) {
    return "unknown";
  }
}

class EngineCache {
  constructor() {
    this.entries = {};
    this.dirty = 0;
    this.engine = engineId();
  }

  static key(job) {
    return sha(`${job.fen}|d${job.depth}|m${job.multipv}|${(job.searchmoves || []).join(",")}`, 20);
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
      if (parsed && parsed.v === 1 && parsed.engine === this.engine && parsed.entries && typeof parsed.entries === "object") {
        this.entries = parsed.entries;
      }
    } catch (error) {
      // no cache yet (or unreadable): start empty
    }
  }

  get(job) {
    const entry = this.entries[EngineCache.key(job)];
    if (!entry) return null;
    return entry.l.map(([type, value, pv, depth]) => ({ type: type === "m" ? "mate" : "cp", value, pv: pv.split(" "), depth }));
  }

  set(job, lines) {
    this.entries[EngineCache.key(job)] = {
      l: lines.map((l) => [l.type === "mate" ? "m" : "c", l.value, l.pv.join(" "), l.depth]),
    };
    this.dirty += 1;
  }

  save() {
    if (!this.dirty) return;
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const tmp = `${CACHE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ v: 1, engine: this.engine, entries: this.entries }));
    fs.renameSync(tmp, CACHE_FILE);
    this.dirty = 0;
  }
}

// Runs every job that is not cached yet on a pool of engine processes.
async function runJobs(jobs, cache, concurrency, label) {
  const seen = new Set();
  const todo = [];
  for (const job of jobs) {
    const key = EngineCache.key(job);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!cache.get(job)) todo.push(job);
  }
  if (!todo.length) {
    console.log(`[${label}] ${seen.size} positions, all cached`);
    return;
  }
  console.log(`[${label}] ${seen.size} positions, ${todo.length} to analyse with ${concurrency} engine process(es)`);
  const started = Date.now();
  let done = 0;
  let lastLog = 0;
  let firstError = null;
  const queue = todo.slice();

  async function worker(index) {
    let engine = null;
    const start = async () => {
      engine = new UciEngine();
      await engine.init();
    };
    try {
      await start();
      while (queue.length && !firstError) {
        const job = queue.shift();
        let lines = null;
        for (let attempt = 0; attempt < 2 && !lines; attempt += 1) {
          try {
            lines = await engine.analyze(job);
          } catch (error) {
            engine.close();
            if (attempt === 1) throw error;
            await start();
          }
        }
        cache.set(job, lines);
        done += 1;
        const now = Date.now();
        if (now - lastLog > 15000) {
          lastLog = now;
          const rate = done / ((now - started) / 1000);
          const eta = Math.round((todo.length - done) / Math.max(rate, 0.001));
          console.log(`[${label}] ${done}/${todo.length}  ${rate.toFixed(2)}/s  eta ${eta}s`);
          cache.save();
        }
      }
    } catch (error) {
      firstError = firstError || error;
    } finally {
      if (engine) engine.close();
    }
    return index;
  }

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
  cache.save();
  if (firstError) fail(`engine failure: ${firstError.message}`);
  console.log(`[${label}] done in ${Math.round((Date.now() - started) / 1000)}s`);
}

// ------------------------------------------------------------ line helpers

function toLines(raw) {
  return raw.map((l) => ({ score: encodeScore(l.type, l.value), pv: l.pv, depth: l.depth }));
}

function materialOf(chess) {
  let white = 0;
  let black = 0;
  let nonPawn = 0;
  for (const piece of chess.board) {
    if (!piece) continue;
    const upper = piece.toUpperCase();
    const value = PIECE_VALUES[upper];
    if (piece === upper) white += value;
    else black += value;
    if (upper !== "P" && upper !== "K") nonPawn += value;
  }
  return { white, black, balance: white - black, nonPawn };
}

function phaseOf(chess) {
  const { nonPawn } = materialOf(chess);
  const queens = chess.board.filter((piece) => piece && piece.toUpperCase() === "Q").length;
  if (nonPawn <= 16 || (queens === 0 && nonPawn <= 26)) return "endgame";
  if (chess.fullmove <= 10 && nonPawn >= 50) return "opening";
  return "middlegame";
}

// Plays the PV on a copy of the position; returns the material balance (in
// pawns, from the mover's point of view, relative to the start) after every
// ply, and whether the PV ends in checkmate.
function pvMaterial(fen, pv) {
  const chess = new Chess(fen);
  const mover = chess.turn;
  const sign = mover === "w" ? 1 : -1;
  const base = materialOf(chess).balance * sign;
  const stops = [];
  let mate = false;
  for (let i = 0; i < pv.length; i += 1) {
    const move = uciToMove(pv[i], chess);
    if (!move) break;
    chess.makeMove(move);
    stops.push({ ply: i + 1, delta: materialOf(chess).balance * sign - base, evenStop: i % 2 === 1 });
    if (chess.generateMoves().length === 0 && chess.inCheck(chess.turn)) mate = true;
  }
  return { stops, mate };
}

// Material the mover gives up in the first exchange and does not get back
// during the next one, or a PV that ends in mate after such an exchange. A PV cut
// in the middle of a trade must not count, hence the second stop.
function isSacrifice(fen, pv) {
  const { stops, mate } = pvMaterial(fen, pv.slice(0, SACRIFICE_PV_PLIES));
  const even = stops.filter((s) => s.evenStop);
  if (!even.length || even[0].delta > -2) return false;
  if (mate) return true;
  return even.length < 2 || even[1].delta <= -2;
}

// Static exchange on one square: what the side to move nets by capturing there
// (it may always stop, so never negative). Uses legal captures only, so pins and
// x-rays are respected.
function seeGain(chess, square, guard = 0) {
  if (guard > 12) return 0;
  const captures = chess.generateMoves()
    .filter((m) => m.to === square && (m.capture || m.enPassant))
    .sort((a, b) => PIECE_VALUES[a.piece.toUpperCase()] - PIECE_VALUES[b.piece.toUpperCase()]);
  if (!captures.length) return 0;
  const move = captures[0];
  const victim = chess.board[square];
  const value = victim ? PIECE_VALUES[victim.toUpperCase()] : 1;
  if (victim && victim.toUpperCase() === "K") return 0;
  const next = chess.clone();
  next.makeMove(move);
  return Math.max(0, value - seeGain(next, square, guard + 1));
}

// True when the master's move leaves material that the opponent can win by
// force on the destination square (net of what the move itself captured).
function seeSacrifice(fen, uci) {
  const chess = new Chess(fen);
  const move = uciToMove(uci, chess);
  if (!move) return false;
  const victim = chess.board[move.to];
  const captured = victim ? PIECE_VALUES[victim.toUpperCase()] : move.enPassant ? 1 : 0;
  chess.makeMove(move);
  if (move.castle) return false;
  return captured - seeGain(chess, move.to) <= -2;
}

// ----------------------------------------------- candidate features / scoring

// Everything the selection needs about one position (before the master's move).
function describeCandidate(game, ply, lines) {
  const move = game.moves[ply];
  const chess = new Chess(move.fenBefore);
  const legal = chess.generateMoves();
  const masterObj = uciToMove(move.uci, chess);
  const after = chess.clone();
  after.makeMove(masterObj);
  const isCheck = after.inCheck(after.turn);
  const previous = ply > 0 ? game.moves[ply - 1] : null;
  const rankIndex = lines.findIndex((l) => l.pv[0] === move.uci);
  const best = lines[0] ? lines[0].score : null;
  const second = lines[1] ? lines[1].score : null;
  const masterScore = rankIndex >= 0 ? lines[rankIndex].score : null;
  return {
    actualLine: game.moves.slice(ply, ply + SACRIFICE_PV_PLIES).map((m) => m.uci),
    seeSacrifice: seeSacrifice(move.fenBefore, move.uci),
    ply,
    fen: move.fenBefore,
    uci: move.uci,
    san: move.san,
    legalCount: legal.length,
    inCheckBefore: chess.inCheck(chess.turn),
    isCapture: move.capture,
    isCheck,
    isPromotion: Boolean(masterObj.promotion),
    isCastle: Boolean(masterObj.castle),
    isRecapture: Boolean(previous && previous.capture && move.capture && previous.to === move.to),
    rank: rankIndex,
    best,
    second,
    masterScore,
    lossCp: masterScore === null || best === null ? null : best - masterScore,
    gapPct: best !== null && second !== null ? Math.max(0, winPct(best) - winPct(second)) : 0,
    phase: phaseOf(chess),
    fullmove: chess.fullmove,
    mover: chess.turn,
    lines,
    masterPv: rankIndex >= 0 ? lines[rankIndex].pv : (lines[0] ? lines[0].pv : []),
  };
}

function acceptableMaster(c, toleranceCp) {
  if (c.rank < 0 || c.best === null) return false;
  if (c.lossCp <= toleranceCp) return true;
  // both lines mate: accept a mate that is at most one move slower
  if (isMate(c.best) && isMate(c.masterScore) && c.best > 0 && c.masterScore > 0) return mateIn(c.masterScore) - mateIn(c.best) <= 1;
  return false;
}

function classify(c) {
  const sacrifice = c.seeSacrifice || isSacrifice(c.fen, c.masterPv) || isSacrifice(c.fen, c.actualLine);
  const mateLine = c.best !== null && isMate(c.best) && c.best > 0;
  const forcing = c.isCapture || c.isCheck || c.isPromotion;
  let kind;
  if (sacrifice) kind = "sacrifice";
  else if (c.phase === "endgame") kind = "endgame";
  else if ((mateLine && mateIn(c.best) <= 6) || (forcing && c.gapPct >= 8)) kind = "tactic";
  else if (c.gapPct >= ONLY_MOVE_GAP_PCT) kind = "only-move";
  else if (c.fullmove <= 10) kind = "opening";
  else kind = "quiet";
  return { kind, sacrifice, mateLine };
}

// 1-3 from what the data says about how hard the move is to find: quiet and
// only-move decisions, sacrifices, moves the engine only prefers when it looks
// deeper, and slow mates are harder; mates in one or two, obvious winning
// captures/checks and book moves are easier.
function difficultyOf(c, cls) {
  const quiet = !c.isCapture && !c.isCheck && !c.isPromotion;
  const mateN = cls.mateLine ? mateIn(c.best) : null;
  let s = 0;
  if (cls.sacrifice) s += 1;
  if (quiet && c.gapPct >= ONLY_MOVE_GAP_PCT) s += 1;
  if (quiet && c.gapPct >= 25) s += 0.5;
  if (cls.kind === "endgame" && c.gapPct >= ONLY_MOVE_GAP_PCT) s += 0.5;
  if (c.quickRank !== undefined && c.quickRank !== 0) s += 1;
  if (mateN !== null && mateN >= 3 && !c.isCheck) s += 0.5;
  if (mateN !== null && mateN <= 2) s -= 1;
  if (!quiet && c.gapPct >= 25 && !cls.sacrifice) s -= 0.5;
  if (c.fullmove <= 8) s -= 0.5;
  return s < 0.75 ? 1 : s < 1.75 ? 2 : 3;
}

// Higher is a better training position.
function scoreCandidate(c, cls, hasMoment) {
  let score = Math.min(c.gapPct, 40);
  if (cls.sacrifice) score += 18;
  if (cls.kind === "tactic") score += 6;
  if (cls.mateLine && c.second !== null && !isMate(c.second)) score += 20;
  if (cls.mateLine && mateIn(c.best) === 1) score -= 14; // the last move: nice, but keep at most a couple
  if (c.isCheck && c.legalCount < 12) score -= 3;
  if (c.inCheckBefore && c.legalCount < 15) score -= 12; // choosing among a few ways out of check is rarely instructive
  if (cls.kind === "opening") score -= 4;
  if (hasMoment) score += 100;
  return score;
}

function targetCount(game, notes) {
  const protagonistMoves = Math.ceil(game.moves.length / 2);
  const wanted = notes && Number.isInteger(notes.target) ? notes.target : Math.round(protagonistMoves * 0.3);
  return clamp(wanted, MIN_POSITIONS, MAX_POSITIONS);
}

// Greedy pick with a proximity penalty so the positions spread over the game.
function pickPositions(cands, target, forced) {
  const chosen = [];
  const pool = cands.slice();
  const take = (c) => {
    chosen.push(c);
    pool.splice(pool.indexOf(c), 1);
  };
  forced.forEach((ply) => {
    const c = pool.find((x) => x.ply === ply);
    if (c) take(c);
  });
  // Neighbouring positions are penalised; a run of forced-mate moves is penalised harder so a
  // finish like "mate in 4, 3, 2, 1" does not eat the whole selection.
  const penalty = (c) => chosen.reduce((sum, s) => {
    const distance = Math.abs(s.ply - c.ply);
    const both = c.cls.mateLine && s.cls.mateLine && distance <= 6 ? 8 : 0;
    return sum + Math.max(0, 8 - distance) * 1.5 + both;
  }, 0);
  let mateOnes = chosen.filter((c) => c.cls.mateLine && mateIn(c.best) === 1).length;
  while (chosen.length < target && pool.length) {
    let bestIndex = -1;
    let bestValue = -Infinity;
    pool.forEach((c, i) => {
      if (c.cls.mateLine && mateIn(c.best) === 1 && mateOnes >= 2) return;
      const value = c.score - penalty(c);
      if (value > bestValue || (value === bestValue && bestIndex >= 0 && c.ply < pool[bestIndex].ply)) {
        bestValue = value;
        bestIndex = i;
      }
    });
    if (bestIndex < 0) break;
    const c = pool[bestIndex];
    if (c.cls.mateLine && mateIn(c.best) === 1) mateOnes += 1;
    take(c);
  }
  return chosen.sort((a, b) => a.ply - b.ply);
}

// ------------------------------------------------------------ notes checks

const LANGS = ["es", "en"];

function checkText(where, obj, min, max) {
  if (!obj || typeof obj !== "object") fail(`${where}: expected {es, en}`);
  for (const lang of LANGS) {
    const value = obj[lang];
    if (typeof value !== "string" || value.trim().length < min) fail(`${where}.${lang}: missing or too short`);
    if (value.length > max) fail(`${where}.${lang}: too long (${value.length} > ${max})`);
    if (/[<>]/.test(value)) fail(`${where}.${lang}: must be plain text (no < or >)`);
  }
}

function validateNotes(ids, notesJson) {
  if (!notesJson || notesJson.v !== 1 || !notesJson.games || typeof notesJson.games !== "object") {
    fail(`${path.relative(ROOT, NOTES_FILE)}: expected { "v": 1, "games": { ... } }`);
  }
  const noteIds = Object.keys(notesJson.games);
  ids.forEach((id) => {
    if (!notesJson.games[id]) fail(`notes.json: no entry for game "${id}"`);
  });
  noteIds.forEach((id) => {
    if (!ids.includes(id)) fail(`notes.json: entry "${id}" has no PGN in data/classics/games/`);
  });
  ids.forEach((id) => {
    const n = notesJson.games[id];
    const where = `notes.json:${id}`;
    checkText(`${where}.title`, n.title, 3, 60);
    checkText(`${where}.blurb`, n.blurb, 80, 700);
    checkText(`${where}.opening`, n.opening, 3, 80);
    if (!Array.isArray(n.themes) || n.themes.length < 1 || n.themes.length > 6 || n.themes.some((t) => !/^[a-z][a-z-]*$/.test(t))) {
      fail(`${where}.themes: 1-6 kebab-case ids`);
    }
    if (![1, 2, 3].includes(n.difficulty)) fail(`${where}.difficulty must be 1, 2 or 3`);
    if (!["w", "b"].includes(n.protagonist)) fail(`${where}.protagonist must be "w" or "b"`);
    if (!Array.isArray(n.sources) || n.sources.length < 2 || n.sources.some((s) => typeof s !== "string" || s.length < 8 || s.length > 300)) {
      fail(`${where}.sources: at least 2 source strings (8-300 chars)`);
    }
    (n.moments || []).forEach((m, i) => {
      if (!Number.isInteger(m.ply) || m.ply < 0) fail(`${where}.moments[${i}].ply must be a 0-based ply index`);
      if (typeof m.san !== "string") fail(`${where}.moments[${i}].san is required (guards against off-by-one plies)`);
      checkText(`${where}.moments[${i}].note`, m.note, 10, 320);
    });
    ["include", "exclude"].forEach((key) => {
      if (n[key] !== undefined && (!Array.isArray(n[key]) || n[key].some((p) => !Number.isInteger(p) || p < 0))) fail(`${where}.${key} must be an array of ply indexes`);
    });
  });
}

// Display forms for the raw PGN tags (QA CNT-028): every White/Black and Event tag needs a { es, en } entry in
// notes.json "names" / "events", so the two languages spell each person and each event one way only. Unused
// entries fail too, which keeps the tables from drifting away from the games.
function validateDisplay(ids, games, notesJson) {
  const tables = { names: notesJson && notesJson.names, events: notesJson && notesJson.events };
  Object.keys(tables).forEach((key) => {
    const table = tables[key];
    if (!table || typeof table !== "object" || Array.isArray(table)) fail(`notes.json: "${key}" is required: { "<raw PGN tag>": { "es": "...", "en": "..." } }`);
    Object.keys(table).forEach((raw) => checkText(`notes.json:${key}["${raw}"]`, table[raw], 2, 80));
  });
  const used = { names: new Set(), events: new Set() };
  ids.forEach((id) => {
    const game = games[id];
    if (!game) return;
    [["names", game.tags.White], ["names", game.tags.Black], ["events", game.tags.Event]].forEach(([key, raw]) => {
      if (!tables[key][raw]) fail(`notes.json: ${id} needs a "${key}" entry for "${raw}" (es and en display forms)`);
      used[key].add(raw);
    });
  });
  Object.keys(tables).forEach((key) => {
    Object.keys(tables[key]).forEach((raw) => {
      if (!used[key].has(raw)) fail(`notes.json: "${key}" has an entry for "${raw}" that no game uses`);
    });
  });
}

// --------------------------------------------------------------------- main

function parseArgs(argv) {
  const args = { check: false, analyze: false, candidates: false, jobs: 3, only: null, write: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--check") args.check = true;
    else if (a === "--analyze") args.analyze = true;
    else if (a === "--candidates") {
      args.analyze = true;
      args.candidates = true;
    }
    else if (a === "--no-write") args.write = false;
    else if (a === "--jobs") args.jobs = clamp(Number(argv[++i]) || 3, 1, 4);
    else if (a === "--only") args.only = String(argv[++i] || "").split(",").filter(Boolean);
    else fail(`unknown argument ${a}`);
  }
  return args;
}

function sanityFor(game, quickLines, finalDeepScore) {
  // quickLines[i] = lines of position i (i in 0..moves.length), position N is the final one.
  const evalAt = [];
  for (let i = 0; i <= game.moves.length; i += 1) {
    if (i === game.moves.length && game.terminal) {
      evalAt.push(game.terminal === "checkmate" ? -100000 : 0);
    } else {
      evalAt.push(quickLines[i][0].score);
    }
  }
  const drops = [];
  for (let i = 0; i < game.moves.length; i += 1) {
    const before = clamp(evalAt[i], -1500, 1500);
    const afterForMover = -clamp(evalAt[i + 1], -1500, 1500);
    const loss = before - afterForMover;
    drops.push({ ply: i, san: game.moves[i].san, loss });
  }
  const blunders = drops.filter((d) => d.loss >= BLUNDER_CP);
  const worst = drops.slice().sort((a, b) => b.loss - a.loss).slice(0, 3);
  const finalEval = finalDeepScore !== null && finalDeepScore !== undefined ? finalDeepScore : evalAt[game.moves.length];
  const winner = game.tags.Result === "1-0" ? "w" : game.tags.Result === "0-1" ? "b" : null;
  let finalKind;
  let decided;
  if (game.terminal === "checkmate") {
    finalKind = "checkmate";
    decided = true;
  } else if (winner) {
    const winnerEval = game.finalTurn === winner ? finalEval : -finalEval;
    finalKind = "decided";
    decided = winnerEval >= 300;
  } else {
    finalKind = game.terminal === "stalemate" ? "stalemate" : "drawn";
    decided = Math.abs(finalEval) <= 150;
  }
  return { blunders, worst, finalEval, finalKind, decided, drops };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ids = listGameIds();
  if (!ids.length) fail("no PGN files in data/classics/games/");
  const selectedIds = args.only ? ids.filter((id) => args.only.includes(id)) : ids;
  if (args.only && selectedIds.length !== args.only.length) fail(`--only names an unknown game (known: ${ids.join(", ")})`);
  if (args.only && !args.analyze) fail("--only can only be combined with --analyze (a partial build would produce incomplete data)");

  if (args.check) {
    runCheck(ids);
    return;
  }

  let notesFile = { text: "", json: null };
  if (args.analyze) {
    try {
      notesFile = loadNotes();
    } catch (error) {
      console.log("(no usable notes.json yet: analysing the scores only)");
    }
  } else {
    notesFile = loadNotes();
    validateNotes(ids, notesFile.json);
  }
  const notesById = (notesFile.json && notesFile.json.games) || {};

  // 1. replay everything
  const games = {};
  ids.forEach((id) => {
    games[id] = loadGame(id);
  });
  console.log(`replayed ${ids.length} games, ${ids.reduce((s, id) => s + games[id].moves.length, 0)} plies: all legal`);
  if (notesFile.json && !args.analyze) validateDisplay(ids, games, notesFile.json);

  const cache = new EngineCache();
  cache.load();

  // 2. quick pass over every position of every (selected) game
  const quickJobs = [];
  selectedIds.forEach((id) => {
    const g = games[id];
    for (let i = 0; i <= g.moves.length; i += 1) {
      if (i === g.moves.length && g.terminal) continue;
      const fen = i === g.moves.length ? g.fens[i] : g.moves[i].fenBefore;
      quickJobs.push({ fen, depth: QUICK.depth, multipv: QUICK.multipv });
    }
  });
  await runJobs(quickJobs, cache, args.jobs, "quick");
  // The last position of each game is also searched deeper: "clearly decided" is judged on that.
  const finalJobs = selectedIds
    .filter((id) => !games[id].terminal)
    .map((id) => ({ fen: games[id].fens[games[id].moves.length], depth: DEEP.depth, multipv: 1 }));
  await runJobs(finalJobs, cache, args.jobs, "final");

  const quick = {};
  const report = {};
  let flagged = 0;
  selectedIds.forEach((id) => {
    const g = games[id];
    const lines = [];
    for (let i = 0; i <= g.moves.length; i += 1) {
      if (i === g.moves.length && g.terminal) {
        lines.push(null);
        continue;
      }
      const fen = i === g.moves.length ? g.fens[i] : g.moves[i].fenBefore;
      lines.push(toLines(cache.get({ fen, depth: QUICK.depth, multipv: QUICK.multipv })));
    }
    quick[id] = lines;
    const finalDeep = g.terminal ? null : toLines(cache.get({ fen: g.fens[g.moves.length], depth: DEEP.depth, multipv: 1 }))[0].score;
    const sanity = sanityFor(g, lines, finalDeep);
    report[id] = sanity;
    const override = (notesById[id] && notesById[id].sanity) || null;
    const limit = override && Number.isInteger(override.maxBlunders) ? override.maxBlunders : MAX_BLUNDERS_PER_GAME;
    const problems = [];
    if (sanity.blunders.length > limit) problems.push(`${sanity.blunders.length} engine blunders (limit ${limit})`);
    if (!sanity.decided) problems.push(`final position not decided for result ${g.tags.Result} (eval ${sanity.finalEval})`);
    const summary = sanity.blunders.map((b) => `${Math.floor(b.ply / 2) + 1}${b.ply % 2 ? "..." : "."}${b.san}(${b.loss})`).join(" ");
    console.log(`${id.padEnd(32)} plies ${String(g.moves.length).padStart(3)}  final ${sanity.finalKind} ${sanity.finalEval}  blunders>=${BLUNDER_CP}: ${sanity.blunders.length}${summary ? "  " + summary : ""}`);
    if (problems.length) {
      flagged += 1;
      console.log(`   FLAGGED: ${problems.join("; ")}`);
    }
  });
  const protagonistOf = (id) => {
    const n = notesById[id];
    if (n && n.protagonist) return n.protagonist;
    return games[id].tags.Result === "0-1" ? "b" : "w";
  };
  const forcedPliesOf = (id) => {
    const n = notesById[id] || {};
    return new Set([...(n.include || []), ...(n.moments || []).map((m) => m.ply)]);
  };
  const minPlyOf = (id) => (notesById[id] && Number.isInteger(notesById[id].minPly) ? notesById[id].minPly : DEFAULT_MIN_PLY);

  // 3a. mid pass on the protagonist's moves
  const mid = {};
  if (!args.analyze || args.candidates) {
    const midJobs = [];
    const midPlies = {};
    selectedIds.forEach((id) => {
      const g = games[id];
      const parity = protagonistOf(id) === "w" ? 0 : 1;
      const exclude = new Set((notesById[id] && notesById[id].exclude) || []);
      const forced = forcedPliesOf(id);
      midPlies[id] = [];
      for (let ply = 0; ply < g.moves.length; ply += 1) {
        if (ply % 2 !== parity || exclude.has(ply)) continue;
        if (ply < minPlyOf(id) && !forced.has(ply)) continue;
        midPlies[id].push(ply);
        midJobs.push({ fen: g.moves[ply].fenBefore, depth: MID.depth, multipv: MID.multipv });
      }
    });
    await runJobs(midJobs, cache, args.jobs, "mid");
    selectedIds.forEach((id) => {
      mid[id] = {};
      midPlies[id].forEach((ply) => {
        mid[id][ply] = toLines(cache.get({ fen: games[id].moves[ply].fenBefore, depth: MID.depth, multipv: MID.multipv }));
      });
    });
  }

  if (args.analyze) {
    if (args.candidates) selectedIds.forEach((id) => printCandidates(games[id], protagonistOf(id), mid[id]));
    if (flagged) console.log(`\n${flagged} game(s) flagged`);
    return;
  }
  if (flagged) fail(`${flagged} game(s) failed the sanity pass (see FLAGGED lines above). Fix the score, or document a justified "sanity" override in notes.json.`);

  // 3b. candidates + shortlist
  const stage = {};
  selectedIds.forEach((id) => {
    const g = games[id];
    const n = notesById[id];
    const protagonistParity = n.protagonist === "w" ? 0 : 1;
    const momentPlies = new Set((n.moments || []).map((m) => m.ply));
    (n.moments || []).forEach((m) => {
      if (m.ply >= g.moves.length) fail(`${id}: moment ply ${m.ply} is beyond the game`);
      if (m.ply % 2 !== protagonistParity) fail(`${id}: moment at ply ${m.ply} (${g.moves[m.ply].san}) is not on the protagonist's side`);
      if (stripCheck(g.moves[m.ply].san) !== stripCheck(m.san)) fail(`${id}: moment at ply ${m.ply} says "${m.san}" but the score has "${g.moves[m.ply].san}"`);
    });
    const forcedPlies = forcedPliesOf(id);
    const cands = [];
    Object.keys(mid[id]).map(Number).forEach((ply) => {
      const forced = forcedPlies.has(ply);
      const c = describeCandidate(g, ply, mid[id][ply]);
      c.quickRank = quick[id][ply].findIndex((l) => l.pv[0] === c.uci);
      if (!forced && (c.legalCount < MIN_LEGAL_MOVES || c.isRecapture)) return;
      if (!forced && !acceptableMaster(c, TOLERANCE_CP)) return;
      const cls = classify(c);
      c.cls = cls;
      c.hasMoment = momentPlies.has(ply);
      c.forced = forced;
      c.score = scoreCandidate(c, cls, forced);
      cands.push(c);
    });
    cands.sort((a, b) => a.ply - b.ply);
    const target = targetCount(g, n);
    const shortlist = cands.slice().sort((a, b) => b.score - a.score || a.ply - b.ply).slice(0, Math.min(cands.length, target * 2 + 4));
    forcedPlies.forEach((ply) => {
      const c = cands.find((x) => x.ply === ply);
      if (c && !shortlist.includes(c)) shortlist.push(c);
    });
    stage[id] = { cands, shortlist, target, forced: [...forcedPlies].filter((p) => cands.some((c) => c.ply === p)) };
  });

  // 4. deep pass on the shortlist (+ master move searched alone when it is outside the top 5)
  const deepJobs = [];
  selectedIds.forEach((id) => stage[id].shortlist.forEach((c) => deepJobs.push({ fen: c.fen, depth: DEEP.depth, multipv: DEEP.multipv })));
  await runJobs(deepJobs, cache, args.jobs, "deep");
  const masterJobs = [];
  selectedIds.forEach((id) => {
    stage[id].shortlist.forEach((c) => {
      const lines = toLines(cache.get({ fen: c.fen, depth: DEEP.depth, multipv: DEEP.multipv }));
      c.deepLines = lines;
      if (!lines.some((l) => l.pv[0] === c.uci)) masterJobs.push({ fen: c.fen, depth: DEEP.depth, multipv: 1, searchmoves: [c.uci] });
    });
  });
  await runJobs(masterJobs, cache, args.jobs, "deep-master");

  // 5. re-score on deep data and pick
  const out = [];
  const forcedFailures = [];
  const verification = { v: 1, engine: engineLabel(), quick: QUICK, deep: DEEP, builderVersion: BUILDER_VERSION, games: {} };
  ids.forEach((id) => {
    const g = games[id];
    const n = notesById[id];
    const st = stage[id];
    const final = [];
    if (st) {
      const momentPlies = new Set((n.moments || []).map((m) => m.ply));
      const refined = [];
      st.shortlist.forEach((c) => {
        const lines = c.deepLines;
        let masterLine = lines.find((l) => l.pv[0] === c.uci);
        if (!masterLine) {
          const only = cache.get({ fen: c.fen, depth: DEEP.depth, multipv: 1, searchmoves: [c.uci] });
          if (only && only[0]) masterLine = toLines(only)[0];
        }
        if (!masterLine) fail(`${id}: no deep score for the master move at ply ${c.ply}`);
        const d = describeCandidate(g, c.ply, lines);
        d.masterScore = masterLine.score;
        d.lossCp = d.best - masterLine.score;
        d.masterPv = masterLine.pv;
        d.rank = lines.findIndex((l) => l.pv[0] === c.uci);
        d.quickRank = c.quickRank;
        const forced = c.forced;
        const acceptable = acceptableMaster({ ...d, rank: d.rank < 0 ? 0 : d.rank }, DEEP_TOLERANCE_CP);
        if (!acceptable) {
          if (forced) forcedFailures.push(`${id}: ply ${c.ply} (${c.san}) is a moment/include pick but the master move is ${(d.lossCp / 100).toFixed(2)} pawns worse than the engine best at depth ${DEEP.depth}: remove it from notes.json`);
          return;
        }
        d.cls = classify(d);
        d.hasMoment = momentPlies.has(c.ply);
        d.forced = forced;
        d.score = scoreCandidate(d, d.cls, forced);
        refined.push(d);
      });
      const chosen = pickPositions(refined, st.target, st.forced);
      momentPlies.forEach((ply) => {
        if (!chosen.some((c) => c.ply === ply)) fail(`${id}: the moment at ply ${ply} (${g.moves[ply].san}) did not survive selection (master move not within ${DEEP_TOLERANCE_CP} cp of the engine best, or not on the protagonist's side). Fix or remove the moment.`);
      });
      if (chosen.length < 4) fail(`${id}: only ${chosen.length} usable training positions (need at least 4); relax notes (include/minPly) or drop the game`);
      chosen.forEach((c) => final.push(c));
    }
    const finalFlat = final.map((c) => {
      const moment = (n.moments || []).find((m) => m.ply === c.ply);
      const chessBefore = new Chess(c.fen);
      const lines = c.lines.map((l) => {
        const mv = uciToMove(l.pv[0], chessBefore);
        return { uci: l.pv[0], san: mv ? moveToSan(chessBefore, mv) : l.pv[0], score: l.score, pv: l.pv.slice(0, PV_PLIES) };
      });
      const position = {
        ply: c.ply,
        fen: c.fen,
        uci: c.uci,
        san: c.san,
        kind: c.cls.kind,
        phase: c.phase,
        difficulty: difficultyOf(c, c.cls),
      };
      if (moment) position.note = { es: moment.note.es, en: moment.note.en };
      position.ms = c.masterScore;
      position.mpv = c.masterPv.slice(0, PV_PLIES);
      position.lines = lines;
      return position;
    });
    const sanity = report[id];
    verification.games[id] = {
      hash: g.hash,
      plies: g.moves.length,
      final: sanity ? { kind: sanity.finalKind, eval: sanity.finalEval, decided: sanity.decided } : null,
      blunders: sanity ? sanity.blunders.map((b) => ({ ply: b.ply, san: b.san, loss: b.loss })) : [],
      positions: finalFlat.length,
    };
    const tags = g.tags;
    out.push({
      id,
      title: { es: n.title.es, en: n.title.en },
      white: tags.White,
      black: tags.Black,
      event: tags.Event,
      site: tags.Site,
      year: Number(tags.Date.slice(0, 4)),
      date: tags.Date,
      result: tags.Result,
      eco: tags.ECO || "",
      opening: { es: n.opening.es, en: n.opening.en },
      blurb: { es: n.blurb.es, en: n.blurb.en },
      themes: n.themes.slice(),
      difficulty: n.difficulty,
      protagonist: n.protagonist,
      moves: g.moves.map((m) => m.san),
      positions: finalFlat,
      sources: n.sources.slice(),
    });
  });

  if (forcedFailures.length) fail(forcedFailures.join("\n  "));

  // Chronological order (the library screen lists them this way); the id breaks ties.
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));

  const inputs = { notes: sha(notesFile.text), games: {} };
  ids.forEach((id) => {
    inputs.games[id] = games[id].hash;
  });
  const data = {
    v: DATA_VERSION,
    engine: engineLabel(),
    depth: DEEP.depth,
    builtAt: process.env.LUDUS_BUILT_AT || DEFAULT_BUILT_AT,
    builder: BUILDER_VERSION,
    inputs,
    names: notesFile.json.names,
    events: notesFile.json.events,
    games: out,
  };
  emit(data, verification, args);
}

// --candidates: a table of the protagonist's moves with the features the selection looks at.
function printCandidates(game, side, midLines) {
  console.log(`\n== ${game.id} (${game.tags.White} - ${game.tags.Black} ${game.tags.Result}) protagonist ${side}`);
  for (let ply = side === "w" ? 0 : 1; ply < game.moves.length; ply += 2) {
    if (!midLines[ply]) continue;
    const c = describeCandidate(game, ply, midLines[ply]);
    const cls = classify(c);
    const fmt = (v) => (v === null ? "  -  " : isMate(v) ? `${v < 0 ? "-" : ""}M${mateIn(v)}` : (v / 100).toFixed(2));
    const flags = [c.isCapture ? "x" : "", c.isCheck ? "+" : "", c.isRecapture ? "recap" : "", c.legalCount < MIN_LEGAL_MOVES ? "few" : ""].filter(Boolean).join(",");
    console.log(
      `${String(ply).padStart(3)} ${String(Math.floor(ply / 2) + 1).padStart(2)}${side === "w" ? "." : "..."}${c.san.padEnd(8)} rank ${c.rank < 0 ? "-" : c.rank + 1} best ${fmt(c.best).padStart(6)} 2nd ${fmt(c.second).padStart(6)} master ${fmt(c.masterScore).padStart(6)} gap ${c.gapPct.toFixed(0).padStart(3)}% ${cls.kind.padEnd(9)} ${flags}`,
    );
  }
}

function engineLabel() {
  return `Stockfish 18 lite (depth ${DEEP.depth})`;
}

function emit(data, verification, args) {
  const json = JSON.stringify(data);
  const banner = [
    "// GENERATED by scripts/build-classics.js from data/classics/ - do not edit by hand.",
    "// Classic games, training positions and Stockfish reference lines. See docs/CLASSICS_DATA.md.",
  ].join("\n");
  const body = `${banner}\n(function (root) {\n  "use strict";\n  root.Ludus = root.Ludus || {};\n  root.Ludus.ClassicsData = ${json};\n  if (typeof module !== "undefined" && module.exports) module.exports = root.Ludus.ClassicsData;\n})(typeof globalThis !== "undefined" ? globalThis : this);\n`;
  const positions = data.games.reduce((s, g) => s + g.positions.length, 0);
  console.log(`\n${data.games.length} games, ${positions} training positions, ${(Buffer.byteLength(body) / 1024).toFixed(1)} KB`);
  if (Buffer.byteLength(body) > 700 * 1024) fail(`generated data is ${Buffer.byteLength(body)} bytes; the budget is 700 KB`);
  if (!args.write) return;
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, body);
  fs.writeFileSync(VERIFY_FILE, `${JSON.stringify(verification, null, 2)}\n`);
  console.log(`wrote ${path.relative(ROOT, OUT_FILE)} and ${path.relative(ROOT, VERIFY_FILE)}`);
}

// --check: cheap, no engine. PGNs must replay and the committed data must have been built from them.
function runCheck(ids) {
  const problems = [];
  const games = {};
  ids.forEach((id) => {
    try {
      games[id] = loadGame(id);
    } catch (error) {
      problems.push(error.message);
    }
  });
  let notes = null;
  try {
    notes = loadNotes();
    validateNotes(ids, notes.json);
    validateDisplay(ids, games, notes.json);
  } catch (error) {
    problems.push(error.message);
  }
  let data = null;
  try {
    delete require.cache[require.resolve(OUT_FILE)];
    data = require(OUT_FILE);
  } catch (error) {
    problems.push(`cannot load ${path.relative(ROOT, OUT_FILE)}: ${error.message} (run: node scripts/build-classics.js)`);
  }
  if (data && notes) {
    if (data.v !== DATA_VERSION) problems.push(`data version ${data.v} (expected ${DATA_VERSION})`);
    if (data.builder !== BUILDER_VERSION) problems.push(`data was built by builder v${data.builder}, the script is v${BUILDER_VERSION}: rebuild`);
    if (!data.inputs || data.inputs.notes !== sha(notes.text)) problems.push("classics.data.js is stale: data/classics/notes.json changed since the last build");
    ids.forEach((id) => {
      if (!games[id]) return;
      if (!data.inputs || !data.inputs.games || data.inputs.games[id] !== games[id].hash) problems.push(`classics.data.js is stale: ${id}.pgn changed since the last build`);
      if (!data.games.some((g) => g.id === id)) problems.push(`classics.data.js has no entry for ${id}`);
    });
    data.games.forEach((g) => {
      if (!ids.includes(g.id)) problems.push(`classics.data.js contains "${g.id}" which has no PGN any more`);
    });
    if (fs.existsSync(VERIFY_FILE)) {
      try {
        const v = JSON.parse(fs.readFileSync(VERIFY_FILE, "utf8"));
        ids.forEach((id) => {
          if (games[id] && (!v.games || !v.games[id] || v.games[id].hash !== games[id].hash)) problems.push(`verification.json is stale for ${id}`);
        });
      } catch (error) {
        problems.push(`verification.json unreadable: ${error.message}`);
      }
    } else {
      problems.push("data/classics/verification.json is missing");
    }
  }
  if (problems.length) {
    console.error(`classics check FAILED (${problems.length}):`);
    problems.forEach((p) => console.error(`  - ${p}`));
    process.exitCode = 1;
    return;
  }
  console.log(`classics check ok: ${ids.length} games replay legally, data is up to date`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.classicsBuild ? `build-classics: ${error.message}` : error);
    process.exit(1);
  });
}

module.exports = {
  BUILDER_VERSION,
  encodeScore,
  winPct,
  isMate,
  mateIn,
  materialOf,
  phaseOf,
  isSacrifice,
  seeSacrifice,
  seeGain,
  describeCandidate,
  acceptableMaster,
  classify,
  difficultyOf,
  scoreCandidate,
  pickPositions,
  parseInfo,
  sanityFor,
  loadGame,
  sha,
};
