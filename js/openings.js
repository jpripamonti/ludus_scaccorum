// Ludus.Openings: the names of the openings (the Lichess "chess-openings" dataset, CC0, bundled in
// js/data/openings.data.js by scripts/build-openings.js) and what a game did with them.
//
//   Ludus.Openings.load()                 lazy, idempotent -> Promise<void> (the data file is ~170 KB)
//   Ludus.Openings.isLoaded()             -> boolean
//   Ludus.Openings.positionKey(fen)       board, side, castling and en passant (only when a capture en passant is
//                                         possible), so transpositions and move counters do not matter
//   Ludus.Openings.keyHash(key)           the short hash the data file stores per position
//   Ludus.Openings.entry(fen)             -> null (not a book position) | { named, eco, name, family }
//   Ludus.Openings.familyOf(name)         "Italian Game: Giuoco Piano" -> "Italian Game"
//   Ludus.Openings.classifyGame(game)     game = { startFen?, sanMoves } -> null (not from the initial position, or
//                                         nothing named) | { eco, name, family, ply, leftPly, leftBy }: the deepest named
//                                         position the game reached in its first MAX_SCAN_PLY plies (ply = 0-based
//                                         index of the move that reached it), and the first move that left the
//                                         book (leftPly, -1 when it never did in those plies) with its mover ("w"|"b")
//   Ludus.Openings.continuations(fen)     -> [{ uci, san, eco, name, family }]: the legal moves that stay in the book
//   Ludus.Openings.bookContext(fen, cls)  -> { eco, name, family, inBook, leftMove, leftBy, continuations } for the coach
//   Ludus.Openings.groupByFamily(games)   -> per family and colour: games, results, early mistakes, where the book ends
//
// Everything but load() is synchronous and returns null / [] until the data is loaded. Pure logic: no DOM access.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Openings = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const DATA_PATH = "js/data/openings.data.js";
  const DATA_VERSION = 1;
  // Names are looked for in the first 20 moves; after that a "named position" is a coincidence.
  const MAX_SCAN_PLY = 40;
  const MAX_CONTINUATIONS = 8;

  let prepared = null;
  let loadPromise = null;

  function chessApi() {
    const api = root.Ludus && root.Ludus.chess;
    if (!api || !api.Chess) throw new Error("Ludus.Openings needs Ludus.chess (load js/chess.js first)");
    return api;
  }

  function hashString(text) {
    const util = root.Ludus && root.Ludus.util;
    return util.hashString(text);
  }

  // The en passant square counts only when a pawn of the side to move stands beside the pawn that just moved
  // (chess.js writes it after every double step): otherwise 1.d4 Nf6 2.c4 and 1.c4 Nf6 2.d4 would differ.
  function positionKey(fen) {
    const parts = String(fen || "").trim().split(/\s+/);
    if (parts.length < 4) return "";
    let ep = parts[3];
    if (ep !== "-") {
      const file = ep.charCodeAt(0) - 97;
      const rank = Number(ep[1]);
      const side = parts[1];
      // The pawn that can capture stands on the rank of the pawn that moved: rank 5 for White, rank 4 for Black.
      const pawnRank = side === "w" ? 5 : 4;
      const pawn = side === "w" ? "P" : "p";
      const rows = parts[0].split("/");
      const row = rows[8 - pawnRank] || "";
      const cells = [];
      for (const ch of row) {
        if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i += 1) cells.push("");
        else cells.push(ch);
      }
      const capturer = (file > 0 && cells[file - 1] === pawn) || (file < 7 && cells[file + 1] === pawn);
      if (!(rank === 3 || rank === 6) || !capturer) ep = "-";
    }
    return `${parts[0]} ${parts[1]} ${parts[2]} ${ep}`;
  }

  // 40 bits of the app's string hash, in base 36 (8 characters at most): ~8,000 book positions against a game's
  // ~40 lookups give a false match about once in 3,000 years of daily play.
  function keyHash(key) {
    const hex = hashString(key);
    return parseInt(hex.slice(-10), 16).toString(36);
  }

  function familyOf(name) {
    const text = String(name || "");
    const cut = text.indexOf(":");
    return (cut === -1 ? text : text.slice(0, cut)).trim();
  }

  function rawData() {
    const data = root.Ludus && root.Ludus.OpeningsData;
    return data && data.v === DATA_VERSION && typeof data.positions === "string" ? data : null;
  }

  function prepare() {
    if (prepared) return prepared;
    const data = rawData();
    if (!data) return null;
    const families = Array.isArray(data.families) ? data.families : [];
    const names = String(data.names || "").split("\n").map((line) => {
      const [eco, familyIndex, rest] = line.split("\t");
      const family = families[Number(familyIndex)] || "";
      return { eco: eco || "", family, name: rest ? `${family}: ${rest}` : family };
    });
    const positions = new Map();
    String(data.positions).split(" ").forEach((token) => {
      if (!token) return;
      const dot = token.indexOf(".");
      if (dot === -1) positions.set(token, -1);
      else positions.set(token.slice(0, dot), parseInt(token.slice(dot + 1), 36));
    });
    prepared = { names, positions, count: names.length };
    return prepared;
  }

  function load() {
    if (prepare()) return Promise.resolve();
    if (loadPromise) return loadPromise;
    const util = root.Ludus && root.Ludus.util;
    let attempt;
    if (typeof require === "function" && !(root.document && util && typeof util.loadScript === "function")) {
      // Node (tests, build tooling): the data file is a plain script.
      attempt = new Promise((resolve, reject) => {
        try {
          require("./data/openings.data.js");
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    } else if (util && typeof util.loadScript === "function") {
      attempt = util.loadScript(DATA_PATH);
    } else {
      attempt = Promise.reject(new Error("Openings.load: no way to load the data file"));
    }
    loadPromise = attempt.then(() => {
      if (!prepare()) throw new Error("Openings.load: data file loaded but it is empty or from another version");
    }).catch((error) => {
      loadPromise = null; // a later call retries (offline, flaky network)
      throw error;
    });
    return loadPromise;
  }

  function isLoaded() {
    return Boolean(prepare());
  }

  function entryForKey(key) {
    const data = prepare();
    if (!data || !key) return null;
    const hash = keyHash(key);
    if (!data.positions.has(hash)) return null;
    const index = data.positions.get(hash);
    const named = index >= 0 ? data.names[index] : null;
    return named
      ? { named: true, eco: named.eco, name: named.name, family: named.family }
      : { named: false, eco: "", name: "", family: "" };
  }

  function entry(fen) {
    return entryForKey(positionKey(fen));
  }

  function isStandardStart(fen) {
    const { Chess } = chessApi();
    return !fen || positionKey(fen) === positionKey(Chess.START_FEN);
  }

  function classifyGame(game) {
    if (!prepare() || !game || !Array.isArray(game.sanMoves)) return null;
    if (!isStandardStart(game.startFen)) return null;
    const { Chess, sanToMove } = chessApi();
    const chess = new Chess();
    let deepest = null;
    let leftPly = -1;
    let leftBy = null;
    const limit = Math.min(game.sanMoves.length, MAX_SCAN_PLY);
    for (let ply = 0; ply < limit; ply += 1) {
      const move = sanToMove(game.sanMoves[ply], chess);
      if (!move) break;
      const mover = chess.turn;
      chess.makeMove(move);
      const found = entry(chess.fen());
      if (!found) {
        if (leftPly === -1) {
          leftPly = ply;
          leftBy = mover;
        }
        continue;
      }
      if (found.named) deepest = { eco: found.eco, name: found.name, family: found.family, ply };
    }
    if (!deepest) return null;
    return { eco: deepest.eco, name: deepest.name, family: deepest.family, ply: deepest.ply, leftPly, leftBy };
  }

  // The legal moves that keep the position in the book, the named ones first.
  function continuations(fen) {
    if (!prepare() || !fen) return [];
    const { Chess, moveToUci, moveToSan } = chessApi();
    let chess;
    try {
      chess = new Chess(fen);
    } catch (error) {
      return [];
    }
    const out = [];
    chess.generateMoves().forEach((move) => {
      const next = chess.clone();
      next.makeMove(move);
      const found = entry(next.fen());
      if (!found) return;
      out.push({ uci: moveToUci(move), san: moveToSan(chess, move), eco: found.eco, name: found.name, family: found.family });
    });
    out.sort((a, b) => (Number(Boolean(b.name)) - Number(Boolean(a.name))) || (a.san < b.san ? -1 : a.san > b.san ? 1 : 0));
    return out.slice(0, MAX_CONTINUATIONS);
  }

  // What the coach tells after a move of an opening session: the opening of the game, whether this position is
  // still in the book (then the moves the book plays here), and otherwise where the game left it.
  function bookContext(fen, classification) {
    if (!prepare()) return null;
    const here = entry(fen);
    const cls = classification && typeof classification === "object" ? classification : null;
    const name = (here && here.named ? here.name : "") || (cls ? cls.name : "");
    if (!name && !here) return null;
    const eco = (here && here.named ? here.eco : "") || (cls ? cls.eco : "");
    return {
      eco,
      name,
      family: familyOf(name),
      inBook: Boolean(here),
      leftMove: cls && cls.leftPly >= 0 ? Math.floor(cls.leftPly / 2) + 1 : 0,
      leftBy: cls && cls.leftPly >= 0 ? cls.leftBy : null,
      continuations: here ? continuations(fen) : [],
    };
  }

  // games: [{ color: "w"|"b", result: "win"|"draw"|"loss"|null, opening: classifyGame(...)|null, earlyMistakes }]
  // -> [{ family, color, games, wins, draws, losses, earlyMistakes, gamesWithEarlyMistake, leftMove, leftByMe,
  //       leftCount, inBookToEnd, variations: [{ name, eco, games }] }], most played first.
  function groupByFamily(games) {
    const groups = new Map();
    (Array.isArray(games) ? games : []).forEach((game) => {
      if (!game || !game.opening || (game.color !== "w" && game.color !== "b")) return;
      const family = game.opening.family || familyOf(game.opening.name);
      if (!family) return;
      const id = `${game.color}|${family}`;
      let group = groups.get(id);
      if (!group) {
        group = {
          family, color: game.color, games: 0, wins: 0, draws: 0, losses: 0, earlyMistakes: 0, gamesWithEarlyMistake: 0,
          leftMove: 0, leftByMe: 0, leftCount: 0, inBookToEnd: 0, variations: [], _moves: new Map(), _variations: new Map(),
        };
        groups.set(id, group);
      }
      group.games += 1;
      if (game.result === "win") group.wins += 1;
      else if (game.result === "draw") group.draws += 1;
      else if (game.result === "loss") group.losses += 1;
      const mistakes = Math.max(0, Number(game.earlyMistakes) || 0);
      group.earlyMistakes += mistakes;
      if (mistakes > 0) group.gamesWithEarlyMistake += 1;
      const opening = game.opening;
      if (Number.isInteger(opening.leftPly) && opening.leftPly >= 0) {
        const move = Math.floor(opening.leftPly / 2) + 1;
        group._moves.set(move, (group._moves.get(move) || 0) + 1);
        group.leftCount += 1;
        if (opening.leftBy === game.color) group.leftByMe += 1;
      } else {
        group.inBookToEnd += 1;
      }
      const variation = group._variations.get(opening.name) || { name: opening.name, eco: opening.eco || "", games: 0 };
      variation.games += 1;
      group._variations.set(opening.name, variation);
    });
    const out = Array.from(groups.values()).map((group) => {
      // The move where the book ends most often (the earlier one on a tie).
      let best = 0;
      let bestCount = 0;
      group._moves.forEach((count, move) => {
        if (count > bestCount || (count === bestCount && move < best)) {
          best = move;
          bestCount = count;
        }
      });
      const variations = Array.from(group._variations.values())
        .sort((a, b) => b.games - a.games || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      const { _moves, _variations, ...rest } = group;
      return Object.assign(rest, { leftMove: best, leftMoveCount: bestCount, variations });
    });
    out.sort((a, b) => b.games - a.games || b.earlyMistakes - a.earlyMistakes || (a.family < b.family ? -1 : a.family > b.family ? 1 : 0));
    return out;
  }

  return {
    MAX_SCAN_PLY,
    DATA_VERSION,
    load,
    isLoaded,
    positionKey,
    keyHash,
    familyOf,
    entry,
    classifyGame,
    continuations,
    bookContext,
    groupByFamily,
    count: () => (prepare() ? prepare().count : 0),
  };
});
