"use strict";

// Tests for the classic games library: the generated data (js/data/classics.data.js),
// the selector (js/classics.js) and the build tooling (scripts/build-classics.js).
// Plain node "assert"; no engine, no network, no clock: deterministic.
//
//   node scripts/tests/classics.test.js

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
require(path.join(ROOT, "js", "ludus.js"));
const chessApi = require(path.join(ROOT, "js", "chess.js"));
require(path.join(ROOT, "js", "pgn.js"));
const Classics = require(path.join(ROOT, "js", "classics.js"));
const builder = require(path.join(ROOT, "scripts", "build-classics.js"));
const data = require(path.join(ROOT, "js", "data", "classics.data.js"));
const { Chess, uciToMove, moveToUci, moveToSan, sanToMove } = chessApi;

const DATA_FILE = path.join(ROOT, "js", "data", "classics.data.js");
const KINDS = ["only-move", "tactic", "sacrifice", "quiet", "endgame", "opening"];
const PHASES = ["opening", "middlegame", "endgame"];
const RESULTS = ["1-0", "0-1", "1/2-1/2"];

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function isText(obj, min, max) {
  return obj && ["es", "en"].every((l) => typeof obj[l] === "string" && obj[l].trim().length >= min && obj[l].length <= max && !/[<>]/.test(obj[l]));
}

// Replays a game; returns the FEN before every ply plus the final board.
function replay(game) {
  const chess = new Chess();
  const fens = [chess.fen()];
  const objs = [];
  game.moves.forEach((san, i) => {
    const move = sanToMove(san, chess);
    assert.ok(move, `${game.id}: illegal move ${san} at ply ${i}`);
    assert.strictEqual(moveToSan(chess, move), san, `${game.id}: ply ${i} SAN is not canonical`);
    objs.push(move);
    chess.makeMove(move);
    fens.push(chess.fen());
  });
  return { fens, chess, objs };
}

function playPv(fen, pv, where) {
  const chess = new Chess(fen);
  pv.forEach((uci, i) => {
    const move = uciToMove(uci, chess);
    assert.ok(move, `${where}: pv move ${i} (${uci}) is not legal`);
    chess.makeMove(move);
  });
}

function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ data

test("data: header, size budget and provenance", () => {
  assert.strictEqual(data.v, 1);
  assert.strictEqual(data.builder, builder.BUILDER_VERSION, "data was built by another builder version: rebuild");
  assert.strictEqual(data.engine, "Stockfish 18 lite (depth 18)");
  assert.strictEqual(data.depth, 18);
  assert.ok(!Number.isNaN(Date.parse(data.builtAt)), "builtAt must be an ISO date");
  assert.ok(data.inputs && typeof data.inputs.notes === "string" && /^[0-9a-f]{16}$/.test(data.inputs.notes));
  const size = fs.statSync(DATA_FILE).size;
  assert.ok(size < 700 * 1024, `data file is ${size} bytes (budget 700 KB)`);
  assert.ok(data.games.length >= 24 && data.games.length <= 30, `expected 24-30 games, got ${data.games.length}`);
});

test("data: unique ids, well-formed metadata and bilingual text", () => {
  const ids = new Set();
  data.games.forEach((g) => {
    assert.ok(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.id), `bad id ${g.id}`);
    assert.ok(!ids.has(g.id), `duplicate id ${g.id}`);
    ids.add(g.id);
    assert.ok(data.inputs.games[g.id] && /^[0-9a-f]{16}$/.test(data.inputs.games[g.id]), `${g.id}: missing input hash`);
    assert.ok(isText(g.title, 3, 60), `${g.id}: title`);
    assert.ok(isText(g.blurb, 80, 700), `${g.id}: blurb`);
    assert.ok(isText(g.opening, 3, 80), `${g.id}: opening`);
    assert.ok(g.blurb.es !== g.blurb.en && g.title.es.length > 0, `${g.id}: es/en must be written separately`);
    assert.ok(Array.isArray(g.themes) && g.themes.length >= 1 && g.themes.length <= 6, `${g.id}: themes`);
    g.themes.forEach((t) => assert.ok(Classics.THEMES.includes(t), `${g.id}: unknown theme ${t}`));
    assert.ok([1, 2, 3].includes(g.difficulty), `${g.id}: difficulty`);
    assert.ok(["w", "b"].includes(g.protagonist), `${g.id}: protagonist`);
    assert.ok(RESULTS.includes(g.result), `${g.id}: result`);
    assert.ok(Number.isInteger(g.year) && g.year >= 1800 && g.year <= 2100, `${g.id}: year`);
    assert.ok(/^\d{4}\.(\d\d|\?\?)\.(\d\d|\?\?)$/.test(g.date) && g.date.startsWith(String(g.year)), `${g.id}: date ${g.date}`);
    assert.ok(g.white && g.black && g.event && g.site, `${g.id}: players/event/site`);
    assert.ok(g.eco === "" || /^[A-E]\d\d$/.test(g.eco), `${g.id}: eco`);
    assert.ok(Array.isArray(g.sources) && g.sources.length >= 2, `${g.id}: needs at least two sources`);
    g.sources.forEach((s) => assert.ok(typeof s === "string" && s.length >= 8 && s.length <= 300, `${g.id}: source length`));
    assert.ok(g.sources.some((s) => /^Facts/.test(s)), `${g.id}: needs a "Facts" source (headline facts confirmed on the web)`);
    assert.ok(Array.isArray(g.moves) && g.moves.length >= 15 && g.moves.length <= 600, `${g.id}: moves`);
  });
  assert.ok(data.games.some((g) => g.protagonist === "b") && data.games.some((g) => g.protagonist === "w"));
  assert.ok(new Set(data.games.map((g) => g.year)).size >= 15, "games should span many years");
  assert.ok(data.games.some((g) => g.year < 1880) && data.games.some((g) => g.year > 2010), "both centuries and styles");
});

test("data: every game replays legally and ends consistently with its result", () => {
  data.games.forEach((g) => {
    const { chess } = replay(g);
    const legal = chess.generateMoves();
    if (legal.length === 0 && chess.inCheck(chess.turn)) {
      assert.strictEqual(g.result, chess.turn === "w" ? "0-1" : "1-0", `${g.id}: checkmate does not match the result`);
    } else {
      assert.ok(legal.length > 0, `${g.id}: ends in stalemate`);
      assert.ok(g.result !== "1/2-1/2" || g.moves.length > 20, `${g.id}: suspicious draw`);
    }
  });
});

test("data: verification.json agrees with the data (no corrupted scores, decided finals)", () => {
  const verification = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "classics", "verification.json"), "utf8"));
  assert.strictEqual(verification.v, 1);
  data.games.forEach((g) => {
    const v = verification.games[g.id];
    assert.ok(v, `${g.id}: not in verification.json`);
    assert.strictEqual(v.hash, data.inputs.games[g.id], `${g.id}: verification.json is stale`);
    assert.strictEqual(v.plies, g.moves.length);
    assert.strictEqual(v.positions, g.positions.length);
    assert.ok(v.final && v.final.decided === true, `${g.id}: final position is not clearly decided`);
    assert.ok(v.blunders.length <= 6, `${g.id}: ${v.blunders.length} engine blunders look like a corrupted score`);
  });
});

test("data: training positions match the replayed game and their reference lines are legal and sorted", () => {
  const allFens = new Set();
  data.games.forEach((g) => {
    const { fens, objs } = replay(g);
    assert.ok(g.positions.length >= 4 && g.positions.length <= 12, `${g.id}: ${g.positions.length} positions (expected 4-12)`);
    const plies = new Set();
    let last = -1;
    g.positions.forEach((p) => {
      const where = `${g.id} ply ${p.ply}`;
      assert.ok(Number.isInteger(p.ply) && p.ply >= 0 && p.ply < g.moves.length, `${where}: ply range`);
      assert.ok(p.ply > last, `${where}: positions must be in game order`);
      last = p.ply;
      assert.ok(!plies.has(p.ply));
      plies.add(p.ply);
      assert.strictEqual(p.ply % 2, g.protagonist === "w" ? 0 : 1, `${where}: not the protagonist's move`);
      assert.strictEqual(p.fen, fens[p.ply], `${where}: fen differs from the replayed position`);
      assert.ok(!allFens.has(p.fen), `${where}: FEN appears twice in the dataset`);
      allFens.add(p.fen);
      assert.strictEqual(g.moves[p.ply], p.san, `${where}: san differs from the game`);
      assert.strictEqual(p.uci, moveToUci(objs[p.ply]), `${where}: uci differs from the game`);
      assert.ok(KINDS.includes(p.kind), `${where}: kind ${p.kind}`);
      assert.ok(PHASES.includes(p.phase), `${where}: phase ${p.phase}`);
      assert.ok([1, 2, 3].includes(p.difficulty), `${where}: difficulty`);
      if (p.note) assert.ok(isText(p.note, 10, 320), `${where}: note`);

      const board = new Chess(p.fen);
      assert.strictEqual(board.turn, g.protagonist, `${where}: side to move`);
      assert.ok(board.generateMoves().length >= 1);
      assert.ok(Array.isArray(p.lines) && p.lines.length >= 1 && p.lines.length <= 5, `${where}: lines`);
      const seen = new Set();
      p.lines.forEach((l, i) => {
        const lw = `${where} line ${i}`;
        const move = uciToMove(l.uci, board);
        assert.ok(move, `${lw}: ${l.uci} is not legal`);
        assert.strictEqual(moveToSan(board, move), l.san, `${lw}: san`);
        assert.ok(Number.isInteger(l.score), `${lw}: score must be an integer`);
        assert.ok(Array.isArray(l.pv) && l.pv.length >= 1 && l.pv.length <= 8 && l.pv[0] === l.uci, `${lw}: pv`);
        playPv(p.fen, l.pv, lw);
        assert.ok(!seen.has(l.uci), `${lw}: duplicate move`);
        seen.add(l.uci);
        if (i > 0) assert.ok(l.score <= p.lines[i - 1].score, `${lw}: lines must be sorted by score`);
      });
      assert.ok(Number.isInteger(p.ms), `${where}: master score`);
      assert.ok(Array.isArray(p.mpv) && p.mpv[0] === p.uci && p.mpv.length <= 8, `${where}: master pv`);
      playPv(p.fen, p.mpv, `${where} master pv`);
      const own = p.lines.find((l) => l.uci === p.uci);
      if (own) assert.strictEqual(own.score, p.ms, `${where}: master score differs from its line`);
      assert.ok(p.ms <= p.lines[0].score + 50, `${where}: master move cannot be far better than the engine best`);
      const loss = p.lines[0].score - p.ms;
      assert.ok(loss <= 30 || (Math.abs(p.lines[0].score) >= 50000 && Math.abs(p.ms) >= 50000), `${where}: master move loses ${loss} cp against the engine best`);
    });
    // Every hand-written moment must have made it to a training position.
    assert.ok(g.positions.every((p) => !p.note || p.note.es !== p.note.en));
  });
  assert.ok(allFens.size >= 150, `only ${allFens.size} training positions in total`);
});

test("data: positions are spread across the game and mix kinds", () => {
  const kinds = new Set();
  data.games.forEach((g) => {
    g.positions.forEach((p) => kinds.add(p.kind));
    if (g.positions.length >= 6 && g.moves.length >= 40) {
      const first = g.positions[0].ply;
      const lastPly = g.positions[g.positions.length - 1].ply;
      assert.ok(lastPly - first >= g.moves.length * 0.35, `${g.id}: positions are bunched together (${first}..${lastPly} of ${g.moves.length})`);
    }
  });
  assert.ok(kinds.size >= 5, `only ${kinds.size} kinds of positions: ${[...kinds].join(", ")}`);
  const total = data.games.reduce((s, g) => s + g.positions.length, 0);
  const notes = data.games.reduce((s, g) => s + g.positions.filter((p) => p.note).length, 0);
  assert.ok(notes >= 20 && notes < total, `moments: ${notes} of ${total}`);
});

// ------------------------------------------------------------ selector API

test("Classics.load is lazy and idempotent, and the static queries work", async () => {
  const first = Classics.load();
  const second = Classics.load();
  assert.ok(first instanceof Promise && second instanceof Promise);
  const [a, b] = await Promise.all([first, second]);
  assert.strictEqual(a, b);
  assert.strictEqual(a, data);
  assert.ok(Classics.isLoaded());

  const list = Classics.list();
  assert.strictEqual(list.length, data.games.length);
  list.forEach((m) => {
    assert.ok(m.id && m.title.es && m.title.en && m.blurb.es && m.plies > 0 && m.positionCount >= 4);
    assert.strictEqual(m.moves, undefined, "list() is metadata only");
    assert.strictEqual(m.positions, undefined, "list() is metadata only");
    assert.strictEqual(m.sources, undefined);
  });
  const g = Classics.get("opera-1858");
  assert.ok(g && g.moves.length === 33 && g.result === "1-0" && g.protagonist === "w");
  assert.ok(Object.isFrozen(g) && Object.isFrozen(g.positions[0]));
  assert.strictEqual(Classics.get("does-not-exist"), null);
  assert.strictEqual(Classics.get(undefined), null);
  assert.strictEqual(Classics.movesText("opera-1858", 4), "1. e4 e5 2. Nf3 d6");
  assert.ok(Classics.movesText("opera-1858").endsWith("17. Rd8#"));
  assert.strictEqual(Classics.movesText("nope"), "");
});

test("Classics.positions returns Position objects in the ARCHITECTURE shape", async () => {
  await Classics.load();
  const positions = Classics.positions("opera-1858");
  const game = Classics.get("opera-1858");
  assert.strictEqual(positions.length, game.positions.length);
  positions.forEach((p, i) => {
    const stored = game.positions[i];
    assert.ok(/^classic:[0-9a-f]{14}$/.test(p.id), p.id);
    assert.strictEqual(p.fen, stored.fen);
    assert.strictEqual(p.source, "classic");
    assert.deepStrictEqual(Object.keys(p.meta).sort(), ["eco", "event", "moveNumber", "players", "result", "sideToMove", "site", "year"]);
    assert.strictEqual(p.meta.players, `${game.white} vs ${game.black}`);
    assert.strictEqual(p.meta.result, "1-0");
    assert.strictEqual(p.meta.year, "1858");
    assert.strictEqual(p.meta.moveNumber, Math.floor(stored.ply / 2) + 1);
    assert.strictEqual(p.meta.sideToMove, "w");
    assert.strictEqual(p.gameMoveUci, stored.uci);
    assert.strictEqual(p.gameMoveSan, stored.san);
    assert.strictEqual(p.bestMoveUci, stored.lines[0].uci);
    assert.strictEqual(p.bestMoveSan, stored.lines[0].san);
    assert.ok(typeof p.gameEvalText === "string" && typeof p.bestEvalText === "string");
    assert.ok(p.lossCp >= 0 && p.lossCp <= 30);
    assert.ok(PHASES.includes(p.phase));
    assert.strictEqual(p.reference.origin, "precomputed");
    assert.strictEqual(p.reference.depth, 18);
    assert.deepStrictEqual(p.reference.lines, stored.lines);
    assert.notStrictEqual(p.reference.lines, stored.lines, "callers get their own copy");
    assert.strictEqual(p.classic.gameId, "opera-1858");
    assert.strictEqual(p.classic.ply, stored.ply);
    assert.strictEqual(p.classic.kind, stored.kind);
    assert.strictEqual(p.classic.difficulty, stored.difficulty);
    if (stored.note) assert.deepStrictEqual(p.classic.note, stored.note);
    p.reference.lines[0].score = 12345; // mutating the copy must not touch the data
    assert.notStrictEqual(stored.lines[0].score, 12345);
  });
  // ids are stable and unique
  assert.strictEqual(new Set(positions.map((p) => p.id)).size, positions.length);
  assert.deepStrictEqual(Classics.positions("opera-1858").map((p) => p.id), positions.map((p) => p.id));
  // mate encoding is formatted, not leaked
  const mate = positions.find((p) => /M\d/.test(p.bestEvalText));
  assert.ok(mate, "the Opera Game has a forced mate position");
});

test("Classics.positions filters: count, side, maxDifficulty, shuffle", async () => {
  await Classics.load();
  const id = data.games.find((g) => g.positions.length >= 8).id;
  const all = Classics.positions(id);
  const game = Classics.get(id);
  assert.strictEqual(all.length, game.positions.length);

  const three = Classics.positions(id, { count: 3 });
  assert.strictEqual(three.length, 3);
  const plies = three.map((p) => p.classic.ply);
  assert.deepStrictEqual(plies.slice().sort((a, b) => a - b), plies, "count keeps game order");
  assert.ok(plies[2] - plies[0] >= (all[all.length - 1].classic.ply - all[0].classic.ply) / 3, "count spreads the positions over the game");
  assert.strictEqual(Classics.positions(id, { count: 0 }).length, 0);
  assert.strictEqual(Classics.positions(id, { count: 999 }).length, all.length);
  assert.strictEqual(Classics.positions(id, { count: -4 }).length, all.length, "invalid counts fall back to all");

  const side = game.protagonist;
  assert.strictEqual(Classics.positions(id, { side }).length, all.length);
  assert.strictEqual(Classics.positions(id, { side: side === "w" ? "b" : "w" }).length, 0);

  const easy = Classics.positions(id, { maxDifficulty: 1 });
  easy.forEach((p) => assert.strictEqual(p.classic.difficulty, 1));
  assert.strictEqual(easy.length, game.positions.filter((p) => p.difficulty === 1).length);
  Classics.positions(id, { maxDifficulty: 2 }).forEach((p) => assert.ok(p.classic.difficulty <= 2));
  assert.strictEqual(Classics.positions(id, { maxDifficulty: 99 }).length, all.length);

  const a = Classics.positions(id, { shuffle: true, random: seededRandom(7) }).map((p) => p.id);
  const b = Classics.positions(id, { shuffle: true, random: seededRandom(7) }).map((p) => p.id);
  const c = Classics.positions(id, { shuffle: true, random: seededRandom(8) }).map((p) => p.id);
  assert.deepStrictEqual(a, b, "same random source, same order");
  assert.notDeepStrictEqual(a, c);
  assert.deepStrictEqual(a.slice().sort(), all.map((p) => p.id).sort(), "shuffle keeps the same set");
  assert.strictEqual(Classics.positions(id, { shuffle: true, count: 2, random: seededRandom(3) }).length, 2);

  assert.deepStrictEqual(Classics.positions("missing"), []);
  assert.deepStrictEqual(Classics.positions(null), []);
});

test("Classics.random mixes games, honours exclude and maxDifficulty, and is reproducible", async () => {
  await Classics.load();
  const n = data.games.length;
  const mix = Classics.random(n, { random: seededRandom(11) });
  assert.strictEqual(mix.length, n);
  assert.strictEqual(new Set(mix.map((p) => p.classic.gameId)).size, n, "one position per game before any game repeats");
  assert.strictEqual(new Set(mix.map((p) => p.id)).size, n);
  assert.deepStrictEqual(Classics.random(n, { random: seededRandom(11) }).map((p) => p.id), mix.map((p) => p.id));
  assert.notDeepStrictEqual(Classics.random(n, { random: seededRandom(12) }).map((p) => p.id), mix.map((p) => p.id));

  const ten = Classics.random(10, { random: seededRandom(1) });
  assert.strictEqual(ten.length, 10);
  const excludeIds = ten.slice(0, 4).map((p) => p.id);
  const again = Classics.random(30, { random: seededRandom(1), exclude: excludeIds });
  again.forEach((p) => assert.ok(!excludeIds.includes(p.id)));
  const skipGames = Classics.random(30, { random: seededRandom(2), exclude: ["opera-1858", "immortal-1851"] });
  skipGames.forEach((p) => assert.ok(!["opera-1858", "immortal-1851"].includes(p.classic.gameId)));
  Classics.random(40, { maxDifficulty: 1, random: seededRandom(5) }).forEach((p) => assert.strictEqual(p.classic.difficulty, 1));
  const subset = Classics.random(20, { gameIds: ["opera-1858", "reti-tartakower-1910"], random: seededRandom(6) });
  assert.ok(subset.length > 0 && subset.every((p) => ["opera-1858", "reti-tartakower-1910"].includes(p.classic.gameId)));
  const totalPositions = data.games.reduce((s, g) => s + g.positions.length, 0);
  const trivial = data.games.reduce((s, g) => s + g.positions.filter((p) => p.lines[0].score >= 99000).length, 0);
  assert.ok(trivial > 0, "the data has mate-in-one finishes");
  assert.strictEqual(Classics.random(100000, { random: seededRandom(4) }).length, Math.min(200, totalPositions - trivial));
  assert.strictEqual(Classics.random(100000, { random: seededRandom(4), includeTrivial: true }).length, Math.min(200, totalPositions));
  Classics.random(200, { random: seededRandom(9) }).forEach((p) => assert.ok(p.reference.lines[0].score < 99000, "no mate-in-one challenges by default"));
  assert.strictEqual(Classics.random(0).length, 0);
});

test("Classics.daily is deterministic, varies across days and validates its key", async () => {
  await Classics.load();
  const a = Classics.daily("2026-10-01");
  const b = Classics.daily("2026-10-01");
  assert.deepStrictEqual(a, b);
  assert.ok(a && a.source === "classic" && a.reference.lines.length >= 1 && a.bestMoveUci);
  const ids = new Set();
  for (let day = 1; day <= 30; day += 1) {
    ids.add(Classics.daily(`2026-11-${String(day).padStart(2, "0")}`).id);
  }
  assert.strictEqual(ids.size, 30, "30 consecutive days must give 30 different positions");
  assert.notStrictEqual(Classics.daily("2026-10-01").id, Classics.daily("2026-10-02").id);
  for (let day = 1; day <= 28; day += 1) {
    assert.ok(Classics.daily(`2027-02-${String(day).padStart(2, "0")}`).reference.lines[0].score < 99000, "the daily challenge is never a mate in one");
  }
  // crossing month/year boundaries keeps working
  assert.notStrictEqual(Classics.daily("2026-12-31").id, Classics.daily("2027-01-01").id);
  // non-date keys and junk do not throw
  assert.deepStrictEqual(Classics.daily("hello"), Classics.daily("hello"));
  assert.ok(Classics.daily(undefined) && Classics.daily(null) && Classics.daily(12345));
  Classics.daily("2026-10-05", { maxDifficulty: 1 }) && assert.strictEqual(Classics.daily("2026-10-05", { maxDifficulty: 1 }).classic.difficulty, 1);
});

test("Classics.story lists every ply with position flags", async () => {
  await Classics.load();
  const story = Classics.story("immortal-1851");
  const game = Classics.get("immortal-1851");
  assert.strictEqual(story.plies.length, game.moves.length);
  assert.strictEqual(story.startFen, Chess.START_FEN);
  const { fens } = replay(game);
  story.plies.forEach((e, i) => {
    assert.strictEqual(e.ply, i);
    assert.strictEqual(e.fenBefore, fens[i]);
    assert.strictEqual(e.fen, fens[i + 1]);
    assert.strictEqual(e.san, game.moves[i]);
    assert.strictEqual(e.color, i % 2 === 0 ? "w" : "b");
    assert.strictEqual(e.moveNumber, Math.floor(i / 2) + 1);
    assert.strictEqual(e.training, game.positions.some((p) => p.ply === i));
  });
  assert.strictEqual(Classics.story("immortal-1851"), story, "cached");
  assert.strictEqual(Classics.story("nope"), null);
  assert.ok(story.plies.some((e) => e.note), "the Immortal Game has hand-written moments");
});

test("Classics registers Spanish and English labels", () => {
  Classics.registerI18n();
  const i18n = global.Ludus.i18n;
  ["es", "en"].forEach((lang) => {
    Classics.KINDS.forEach((k) => {
      assert.notStrictEqual(i18n.t(`cdata.kind.${k}`, null, lang), `cdata.kind.${k}`);
      assert.notStrictEqual(i18n.t(`cdata.kindHint.${k}`, null, lang), `cdata.kindHint.${k}`);
    });
    Classics.THEMES.forEach((t) => assert.notStrictEqual(i18n.t(`cdata.theme.${t}`, null, lang), `cdata.theme.${t}`));
    [1, 2, 3].forEach((n) => assert.notStrictEqual(i18n.t(`cdata.difficulty.${n}`, null, lang), `cdata.difficulty.${n}`));
    ["w", "b"].forEach((s) => assert.notStrictEqual(i18n.t(`cdata.playing.${s}`, null, lang), `cdata.playing.${s}`));
  });
  assert.strictEqual(Classics.kindLabel("sacrifice", "es"), "Sacrificio");
  assert.strictEqual(Classics.kindLabel("sacrifice", "en"), "Sacrifice");
  assert.strictEqual(Classics.themeLabel("zugzwang", "en"), "Zugzwang");
  assert.strictEqual(Classics.difficultyLabel(3, "es"), "Difícil");
  assert.strictEqual(Classics.playingLabel("w", "es"), "Jugás con las blancas", "rioplatense voseo");
  assert.strictEqual(Classics.kindLabel("unknown-kind", "en"), "unknown-kind");
  assert.ok(Classics.THEMES.every((t) => Classics.themeLabel(t, "es") && Classics.themeLabel(t, "en")));
});

test("Classics returns nothing (and does not throw) while the data is missing", () => {
  const saved = global.Ludus.ClassicsData;
  delete global.Ludus.ClassicsData;
  try {
    assert.deepStrictEqual(Classics.list(), []);
    assert.strictEqual(Classics.get("opera-1858"), null);
    assert.deepStrictEqual(Classics.positions("opera-1858"), []);
    assert.deepStrictEqual(Classics.random(5), []);
    assert.strictEqual(Classics.daily("2026-01-01"), null);
    assert.strictEqual(Classics.story("opera-1858"), null);
    assert.strictEqual(Classics.isLoaded(), false);
  } finally {
    global.Ludus.ClassicsData = saved;
  }
  assert.strictEqual(Classics.isLoaded(), true);
  global.Ludus.ClassicsData = { v: 99, games: [] };
  try {
    assert.strictEqual(Classics.isLoaded(), false, "data from another version is ignored");
  } finally {
    global.Ludus.ClassicsData = saved;
  }
});

// ----------------------------------------------------------- build helpers

test("builder: score encoding and win percentage follow the ARCHITECTURE conventions", () => {
  assert.strictEqual(builder.encodeScore("cp", 35), 35);
  assert.strictEqual(builder.encodeScore("mate", 3), 97000);
  assert.strictEqual(builder.encodeScore("mate", -2), -98000);
  assert.strictEqual(builder.encodeScore("mate", 1), 99000);
  assert.strictEqual(builder.encodeScore("mate", 70), 50000, "mate distance is capped at 50");
  assert.ok(builder.isMate(97000) && !builder.isMate(4999) && builder.mateIn(97000) === 3);
  assert.strictEqual(builder.winPct(0), 50);
  assert.ok(builder.winPct(300) > 70 && builder.winPct(300) < 80);
  assert.strictEqual(builder.winPct(97000), 100);
  assert.strictEqual(builder.winPct(-97000), 0);
  assert.ok(Math.abs(builder.winPct(150) + builder.winPct(-150) - 100) < 1e-9);
  assert.deepStrictEqual(builder.parseInfo("info depth 12 seldepth 19 multipv 2 score cp -37 nodes 29760 nps 541090 time 55 pv e7e5 g1f3"), { depth: 12, mpv: 2, type: "cp", value: -37, pv: ["e7e5", "g1f3"] });
  assert.strictEqual(builder.parseInfo("info depth 5 score cp 10 lowerbound pv e2e4"), null);
  assert.strictEqual(builder.parseInfo("info string NNUE evaluation"), null);
  assert.strictEqual(builder.parseInfo("bestmove e2e4"), null);
  assert.strictEqual(builder.parseInfo("info depth 3 multipv 1 score mate 2 pv d1h5 g8f6").type, "mate");
});

test("builder: material, phase and sacrifice detection", () => {
  assert.strictEqual(builder.materialOf(new Chess()).balance, 0);
  assert.strictEqual(builder.phaseOf(new Chess()), "opening");
  assert.strictEqual(builder.phaseOf(new Chess("8/8/4k3/8/8/4K3/4P3/8 w - - 0 1")), "endgame");
  assert.strictEqual(builder.phaseOf(new Chess("r2q1rk1/pp2bppp/2n1pn2/3p4/3P4/2N1PN2/PP2BPPP/R2Q1RK1 w - - 0 12")), "middlegame");
  // Opera Game, move 16: Qb8+! Nxb8 Rd8# is a queen sacrifice ending in mate
  assert.ok(!builder.isSacrifice("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ["e2e4", "e7e5", "g1f3", "b8c6"]));
  const opera = replayFromStart(["e4", "e5", "Nf3", "d6", "d4", "Bg4", "dxe5", "Bxf3", "Qxf3", "dxe5", "Bc4", "Nf6", "Qb3", "Qe7", "Nc3", "c6", "Bg5", "b5", "Nxb5", "cxb5", "Bxb5+", "Nbd7", "O-O-O", "Rd8", "Rxd7", "Rxd7", "Rd1", "Qe6", "Bxd7+", "Nxd7"]);
  assert.ok(builder.isSacrifice(opera, ["b3b8", "d7b8", "d1d8"]), "Qb8+ Nxb8 Rd8# is a sacrifice");
  assert.ok(!builder.isSacrifice(opera, ["b3b8"]), "a one-move PV cannot show a sacrifice");
  // a plain trade is not a sacrifice: 1.e4 d5 2.exd5 Qxd5 3.Nc3 Qa5
  assert.ok(!builder.isSacrifice("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2", ["e4d5", "d8d5", "b1c3", "d5a5"]));
});

function replayFromStart(sans) {
  const chess = new Chess();
  sans.forEach((san) => {
    const move = sanToMove(san, chess);
    assert.ok(move, `helper: ${san}`);
    chess.makeMove(move);
  });
  return chess.fen();
}

test("builder: static exchange finds real sacrifices and ignores plain moves", () => {
  const bauer = builder.loadGame("lasker-bauer-1889");
  assert.strictEqual(bauer.moves[28].san, "Bxh7+");
  assert.strictEqual(builder.seeSacrifice(bauer.moves[28].fenBefore, bauer.moves[28].uci), true, "Bxh7+ Kxh7 gives a bishop for a pawn");
  const opera = builder.loadGame("opera-1858");
  assert.strictEqual(opera.moves[30].san, "Qb8+");
  assert.strictEqual(builder.seeSacrifice(opera.moves[30].fenBefore, opera.moves[30].uci), true, "Qb8+ Nxb8 gives the queen");
  [0, 4, 8, 16, 26, 32].forEach((ply) => {
    assert.strictEqual(builder.seeSacrifice(opera.moves[ply].fenBefore, opera.moves[ply].uci), false, `${opera.moves[ply].san} is not a sacrifice`);
  });
  const fischer = builder.loadGame("byrne-fischer-1956");
  assert.strictEqual(fischer.moves[33].san, "Be6");
  assert.strictEqual(builder.seeSacrifice(fischer.moves[33].fenBefore, fischer.moves[33].uci), false, "the destination square of 17...Be6 is safe: the queen was already attacked");
  assert.strictEqual(builder.isSacrifice(fischer.moves[33].fenBefore, fischer.moves.slice(33, 45).map((m) => m.uci)), true, "but the game continuation shows the queen going");
  assert.strictEqual(builder.seeSacrifice(fischer.moves[35].fenBefore, fischer.moves[35].uci), false, "18...Bxc4+ wins a piece");
  assert.strictEqual(builder.seeSacrifice("8/8/8/8/8/8/8/K6k w - - 0 1", "a1a2"), false);
  assert.strictEqual(builder.seeSacrifice("8/8/8/8/8/8/8/K6k w - - 0 1", "e2e4"), false, "illegal moves are not sacrifices");
});

test("builder: pickPositions spreads the choice and always keeps forced ones", () => {
  const mk = (ply, score, extra) => ({ ply, score, best: 100, cls: { mateLine: false }, ...extra });
  const cands = [];
  for (let ply = 8; ply < 60; ply += 2) cands.push(mk(ply, 20 - Math.abs(ply - 34) / 4));
  const picked = builder.pickPositions(cands, 6, []);
  assert.strictEqual(picked.length, 6);
  const plies = picked.map((c) => c.ply);
  assert.deepStrictEqual(plies.slice().sort((a, b) => a - b), plies, "returned in game order");
  assert.ok(plies[plies.length - 1] - plies[0] >= 20, "spread over the game rather than clustered around the best score");
  const forced = builder.pickPositions(cands, 6, [8, 58]);
  assert.ok(forced.some((c) => c.ply === 8) && forced.some((c) => c.ply === 58));
  assert.strictEqual(builder.pickPositions(cands.slice(0, 3), 6, []).length, 3, "never invents positions");
  // at most two mate-in-one positions
  const mates = [];
  for (let ply = 10; ply < 30; ply += 2) mates.push({ ply, score: 50, best: 99000, cls: { mateLine: true } });
  assert.ok(builder.pickPositions(mates, 6, []).length <= 2);
});

test("builder: describeCandidate flags recaptures, checks and few legal moves", () => {
  const game = builder.loadGame("opera-1858");
  const lines = (uci) => [{ score: 100, pv: [uci], depth: 16 }];
  const recapture = builder.describeCandidate(game, 8, lines(game.moves[8].uci)); // 5.Qxf3 recaptures on f3
  assert.strictEqual(recapture.isRecapture, true);
  assert.strictEqual(recapture.isCapture, true);
  const check = builder.describeCandidate(game, 20, lines(game.moves[20].uci)); // 11.Bxb5+
  assert.strictEqual(check.isCheck, true);
  const first = builder.describeCandidate(game, 0, lines(game.moves[0].uci));
  assert.strictEqual(first.legalCount, 20);
  assert.strictEqual(first.rank, 0);
  assert.strictEqual(builder.acceptableMaster(first, 20), true);
  const off = builder.describeCandidate(game, 0, [{ score: 100, pv: ["d2d4"], depth: 16 }]);
  assert.strictEqual(builder.acceptableMaster(off, 20), false);
});

// ------------------------------------------------------------ --check mode

function run(cwd, args) {
  return spawnSync(process.execPath, [path.join(cwd, "scripts", "build-classics.js"), ...args], { cwd, encoding: "utf8" });
}

function copyTree(from, to, filter) {
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from, { withFileTypes: true }).forEach((entry) => {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (filter && !filter(source)) return;
    if (entry.isDirectory()) copyTree(source, target, filter);
    else fs.copyFileSync(source, target);
  });
}

test("build --check passes on the committed data", () => {
  const result = run(ROOT, ["--check"]);
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  assert.ok(/classics check ok/.test(result.stdout));
});

test("build --check detects illegal moves and stale data (on a scratch copy)", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ludus-classics-"));
  try {
    fs.mkdirSync(path.join(tmp, "scripts"), { recursive: true });
    fs.copyFileSync(path.join(ROOT, "scripts", "build-classics.js"), path.join(tmp, "scripts", "build-classics.js"));
    ["ludus.js", "chess.js", "pgn.js"].forEach((f) => {
      fs.mkdirSync(path.join(tmp, "js"), { recursive: true });
      fs.copyFileSync(path.join(ROOT, "js", f), path.join(tmp, "js", f));
    });
    fs.mkdirSync(path.join(tmp, "js", "data"), { recursive: true });
    fs.copyFileSync(DATA_FILE, path.join(tmp, "js", "data", "classics.data.js"));
    copyTree(path.join(ROOT, "data", "classics"), path.join(tmp, "data", "classics"), (p) => !p.includes(`${path.sep}.cache`));

    assert.strictEqual(run(tmp, ["--check"]).status, 0, "the scratch copy starts consistent");

    // 1. an illegal move in a PGN
    const pgnFile = path.join(tmp, "data", "classics", "games", "opera-1858.pgn");
    const original = fs.readFileSync(pgnFile, "utf8");
    fs.writeFileSync(pgnFile, original.replace("1. e4 e5 2. Nf3 d6", "1. e4 e5 2. Nf3 Nf3"));
    let result = run(tmp, ["--check"]);
    assert.notStrictEqual(result.status, 0);
    assert.ok(/illegal or unparsable move "Nf3"/.test(result.stderr), result.stderr);

    // 2. a legal but different score makes the data stale
    fs.writeFileSync(pgnFile, original.replace("[Site \"Paris FRA\"]", "[Site \"Paris\"]"));
    result = run(tmp, ["--check"]);
    assert.notStrictEqual(result.status, 0);
    assert.ok(/stale: opera-1858\.pgn changed/.test(result.stderr), result.stderr);
    fs.writeFileSync(pgnFile, original);
    assert.strictEqual(run(tmp, ["--check"]).status, 0);

    // 3. notes edits make the data stale too
    const notesFile = path.join(tmp, "data", "classics", "notes.json");
    const notes = fs.readFileSync(notesFile, "utf8");
    fs.writeFileSync(notesFile, notes.replace("The Opera Game", "The Opera Game!"));
    result = run(tmp, ["--check"]);
    assert.notStrictEqual(result.status, 0);
    assert.ok(/stale: data\/classics\/notes\.json changed/.test(result.stderr), result.stderr);
    fs.writeFileSync(notesFile, notes);

    // 4. a result that contradicts a checkmate
    fs.writeFileSync(pgnFile, original.replace('[Result "1-0"]', '[Result "0-1"]').replace(/1-0\s*$/, "0-1\n"));
    result = run(tmp, ["--check"]);
    assert.notStrictEqual(result.status, 0);
    assert.ok(/checkmate but Result is 0-1/.test(result.stderr), result.stderr);
    fs.writeFileSync(pgnFile, original);

    // 5. a PGN without notes
    fs.writeFileSync(path.join(tmp, "data", "classics", "games", "extra.pgn"), original);
    result = run(tmp, ["--check"]);
    assert.notStrictEqual(result.status, 0);
    assert.ok(/no entry for game "extra"/.test(result.stderr), result.stderr);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("source PGNs: every file has the standard tags and only movetext", () => {
  const dir = path.join(ROOT, "data", "classics", "games");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".pgn"));
  assert.strictEqual(files.length, data.games.length);
  files.forEach((f) => {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    ["Event", "Site", "Date", "White", "Black", "Result"].forEach((tag) => assert.ok(new RegExp(`^\\[${tag} "`, "m").test(text), `${f}: missing ${tag}`));
    const body = text.split(/\n\n/).slice(1).join("\n");
    assert.ok(!/[{};$]/.test(body), `${f}: movetext must be plain (no comments or NAGs)`);
    assert.ok(/(1-0|0-1|1\/2-1\/2)\s*$/.test(body), `${f}: movetext must end with the result`);
  });
});

// ---------------------------------------------------------------- runner

(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok   ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${name}\n${error && error.stack ? error.stack : error}`);
    }
  }
  if (failed) {
    console.error(`\n${failed} of ${tests.length} classics tests failed`);
    process.exit(1);
  }
  console.log(`\nclassics tests passed (${tests.length} tests, ${data.games.length} games, ${data.games.reduce((s, g) => s + g.positions.length, 0)} positions)`);
})();
