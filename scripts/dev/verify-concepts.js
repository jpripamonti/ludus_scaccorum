// Verifies the illustrative positions of js/concepts.js with the vendored
// Stockfish. Development tool: it needs the engine and takes a few seconds per
// concept, so it is NOT part of `npm test` (scripts/tests/concepts.test.js
// re-checks the engine-free part: legality).
//
//   node scripts/dev/verify-concepts.js                 # every concept, depth 16
//   node scripts/dev/verify-concepts.js --depth 18      # deeper
//   node scripts/dev/verify-concepts.js --only fork pin # some concepts
//
// For each concept it checks that
//   1. the FEN is legal (both kings, the side NOT to move is not in check,
//      castling rights match the rooks) and the position is not over;
//   2. bestUci is a legal move in it;
//   3. Stockfish agrees with the move. It passes when the move is
//        - the engine's first choice ("best"), or
//        - within 1 win-percentage point of the first choice ("band", the
//          same tolerance the trainer's default scoring calls "best"), or
//        - clearly winning: the engine scores it at +300 cp or more and it is
//          at most 60 cp behind the first choice ("winning").
// It exits with status 1 when any concept fails and prints one line per
// concept with the engine's top lines, so a bad example is easy to fix.
//
// The engine runs as a child process ("node vendor/stockfish-18-lite-single.js")
// and talks UCI over stdin/stdout.

"use strict";

const path = require("path");
const { spawn } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
require(path.join(repoRoot, "js", "ludus.js"));
const { Chess, uciToMove } = require(path.join(repoRoot, "js", "chess.js"));
const Concepts = require(path.join(repoRoot, "js", "concepts.js"));

const MULTI_PV = 5;
const BAND_WIN_PCT = 1;
const WINNING_CP = 300;
const WINNING_MAX_LOSS_CP = 60;
const SEARCH_TIMEOUT_MS = 120000;

function parseArgs(argv) {
  const out = { depth: 16, only: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--depth") {
      out.depth = Number(argv[i + 1]);
      i += 1;
    } else if (argv[i] === "--only") {
      while (argv[i + 1] && !argv[i + 1].startsWith("--")) {
        out.only.push(argv[i + 1]);
        i += 1;
      }
    } else {
      throw new Error(`unknown argument: ${argv[i]}`);
    }
  }
  if (!Number.isInteger(out.depth) || out.depth < 1 || out.depth > 40) throw new Error("--depth must be an integer 1..40");
  return out;
}

// ---------- Legality (engine-free) ----------

function legalityProblems(concept) {
  const problems = [];
  if (!Chess.isValidFen(concept.fen)) {
    problems.push("FEN is not structurally valid");
    return problems;
  }
  const game = new Chess(concept.fen);
  const waiting = game.turn === "w" ? "b" : "w";
  if (game.inCheck(waiting)) problems.push("the side that is not to move is in check (illegal position)");
  if (game.generateMoves().length === 0) problems.push("the position is already over (no legal moves)");
  if (concept.bestUci) {
    if (!uciToMove(concept.bestUci, game)) problems.push(`bestUci ${concept.bestUci} is not legal`);
  }
  return problems;
}

// ---------- Minimal UCI client ----------

class Engine {
  constructor() {
    this.child = spawn(process.execPath, [path.join(repoRoot, "vendor", "stockfish-18-lite-single.js")], {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "inherit"],
    });
    this.buffer = "";
    this.listeners = [];
    this.child.stdout.on("data", (chunk) => {
      this.buffer += chunk;
      let index;
      while ((index = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, index).trim();
        this.buffer = this.buffer.slice(index + 1);
        this.listeners = this.listeners.filter((listener) => !listener(line));
      }
    });
    this.child.on("error", (error) => {
      throw error;
    });
  }

  send(line) {
    this.child.stdin.write(`${line}\n`);
  }

  // Resolves with the first line the predicate accepts (it returns true to stop).
  waitFor(predicate, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${label}`)), SEARCH_TIMEOUT_MS);
      this.listeners.push((line) => {
        if (!predicate(line)) return false;
        clearTimeout(timer);
        resolve(line);
        return true;
      });
    });
  }

  async init() {
    this.send("uci");
    await this.waitFor((line) => line === "uciok", "uciok");
    this.send("isready");
    await this.waitFor((line) => line === "readyok", "readyok");
  }

  // Score of each line from the side to move's point of view, in centipawns
  // (a forced mate is encoded as +-(100000 - 1000 * moves), like the app does).
  async search(fen, depth, multiPv, searchMoves) {
    const lines = new Map();
    const collect = (line) => {
      const match = line.match(/^info depth (\d+) .*?multipv (\d+) score (cp|mate) (-?\d+).*? pv (.+)$/);
      if (match) {
        const value = Number(match[4]);
        const score = match[3] === "mate"
          ? (value > 0 ? 1 : -1) * (100000 - 1000 * Math.min(50, Math.abs(value)))
          : value;
        lines.set(Number(match[2]), { depth: Number(match[1]), score, mate: match[3] === "mate" ? value : null, pv: match[5].split(" ") });
      }
      return false;
    };
    this.listeners.push(collect);
    this.send(`setoption name MultiPV value ${multiPv}`);
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}${searchMoves ? ` searchmoves ${searchMoves.join(" ")}` : ""}`);
    await this.waitFor((line) => line.startsWith("bestmove"), "bestmove");
    this.listeners = this.listeners.filter((listener) => listener !== collect);
    return Array.from(lines.keys()).sort((a, b) => a - b).map((key) => lines.get(key));
  }

  quit() {
    try {
      this.send("quit");
    } catch (error) {
      // Already gone.
    }
    this.child.kill();
  }
}

function winPercent(cp) {
  const clamped = Math.max(-1000, Math.min(1000, Math.abs(cp) >= 50000 ? Math.sign(cp) * 1000 : cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

function formatScore(line) {
  return line.mate !== null ? `M${line.mate}` : `${line.score >= 0 ? "+" : ""}${line.score}`;
}

async function verifyWithEngine(engine, concept, depth) {
  const lines = await engine.search(concept.fen, depth, MULTI_PV);
  if (!lines.length) return { ok: false, reason: "engine returned no lines", lines };
  const top = lines[0];
  const rank = lines.findIndex((line) => line.pv[0] === concept.bestUci);
  let mine = rank >= 0 ? lines[rank] : null;
  if (!mine) {
    const extra = await engine.search(concept.fen, depth, 1, [concept.bestUci]);
    mine = extra[0] || null;
  }
  if (!mine) return { ok: false, reason: "engine gave no score for bestUci", lines };
  const cpLoss = Math.max(0, top.score - mine.score);
  const winLoss = Math.max(0, winPercent(top.score) - winPercent(mine.score));
  let verdict = null;
  if (rank === 0) verdict = "best";
  else if (winLoss <= BAND_WIN_PCT) verdict = "band";
  else if (mine.score >= WINNING_CP && cpLoss <= WINNING_MAX_LOSS_CP) verdict = "winning";
  return {
    ok: verdict !== null,
    verdict,
    reason: verdict ? "" : `engine prefers ${top.pv[0]} (${formatScore(top)}); ${concept.bestUci} scores ${formatScore(mine)}`,
    rank: rank >= 0 ? rank + 1 : null,
    score: mine.score,
    lines,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let concepts = Concepts.list();
  if (args.only.length) {
    const unknown = args.only.filter((id) => !Concepts.get(id));
    if (unknown.length) throw new Error(`unknown concept id(s): ${unknown.join(", ")}`);
    concepts = concepts.filter((concept) => args.only.includes(concept.id));
  }
  console.log(`Verifying ${concepts.length} concept(s) with Stockfish at depth ${args.depth}`);

  const engine = new Engine();
  let failures = 0;
  try {
    await engine.init();
    for (const concept of concepts) {
      const problems = legalityProblems(concept);
      if (problems.length) {
        failures += 1;
        console.log(`FAIL ${concept.id}: ${problems.join("; ")}`);
        continue;
      }
      if (!concept.bestUci) {
        console.log(`skip ${concept.id}: no concrete move`);
        continue;
      }
      const result = await verifyWithEngine(engine, concept, args.depth);
      const top = result.lines.slice(0, 3).map((line) => `${line.pv[0]} ${formatScore(line)}`).join(" | ");
      if (result.ok) {
        console.log(`ok   ${concept.id}: ${concept.bestUci} is ${result.verdict} (${formatScore({ score: result.score, mate: null })})  [${top}]`);
      } else {
        failures += 1;
        console.log(`FAIL ${concept.id}: ${result.reason}  [${top}]`);
      }
    }
  } finally {
    engine.quit();
  }

  if (failures) {
    console.error(`\n${failures} concept(s) failed verification`);
    process.exit(1);
  }
  console.log("\nAll concept positions verified");
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
