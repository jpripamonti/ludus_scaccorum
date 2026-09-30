// Unit tests for js/pgn.js: tags, SetUp/FEN start positions, SAN tokenising,
// game splitting and the per-game safety budgets. Plain assert, no network.

"use strict";

const assert = require("assert");
const path = require("path");

const jsDir = path.resolve(__dirname, "..", "..", "js");
const { Chess, sanToMove, moveToUci } = require(path.join(jsDir, "chess.js"));
const pgn = require(path.join(jsDir, "pgn.js"));
const {
  removeVariations,
  hasOversizedComment,
  parseTags,
  resolveGameStartFen,
  cleanTagValue,
  tokenizeSanMoves,
  splitGamesFromText,
  buildGameFromText,
  limits,
} = pgn;

// ---------- API surface and limits ----------

assert.strictEqual(globalThis.Ludus.pgn, pgn, "js/pgn.js registers itself as Ludus.pgn");
["removeVariations", "hasOversizedComment", "parseTags", "resolveGameStartFen", "cleanTagValue",
  "tokenizeSanMoves", "splitGamesFromText", "buildGameFromText"].forEach((name) => {
  assert.strictEqual(typeof pgn[name], "function", `Ludus.pgn.${name}`);
});
assert.deepStrictEqual(
  { ...limits },
  { gameMaxChars: 512 * 1024, commentMaxChars: 4000, maxPlies: 600, maxVariationDepth: 12 },
  "the safety limits are the ones app.js always used",
);
assert.ok(Object.isFrozen(limits));

// ---------- parseTags ----------

{
  const tags = parseTags('[Event "Casual"]\n[White "Ana"]\n[Black "Bruno"]\n[ECO "C20"]\n[WhiteElo "1500"]\n\n1. e4 e5 *');
  assert.strictEqual(tags.Event, "Casual");
  assert.strictEqual(tags.White, "Ana");
  assert.strictEqual(tags.Black, "Bruno");
  assert.strictEqual(tags.ECO, "C20");
  assert.strictEqual(tags.WhiteElo, "1500", "unknown tags are kept");
  assert.strictEqual(tags.Site, "", "missing standard tags default to empty");

  const defaults = parseTags("1. e4 e5 *");
  assert.strictEqual(defaults.Event, "Partida");
  assert.strictEqual(defaults.White, "Blancas");
  assert.strictEqual(defaults.Black, "Negras");
  assert.strictEqual(defaults.Result, "");

  const odd = parseTags('[Event "A \\"quoted\\" name"]\n[Broken\n[White ]\n[ "x"]\nnot a tag\n[Black "Zoe"]');
  assert.strictEqual(odd.Event, 'A \\"quoted\\" name', "the raw text between the outer quotes is kept");
  assert.strictEqual(odd.Black, "Zoe", "malformed tag lines are skipped without stopping the parse");
  assert.strictEqual(odd.White, "Blancas");
}

// ---------- cleanTagValue ----------

{
  assert.strictEqual(cleanTagValue("  Magnus  "), "Magnus");
  assert.strictEqual(cleanTagValue("?"), "", "PGN's unknown marker is empty");
  assert.strictEqual(cleanTagValue("????.??.??"), "", "an unknown date is empty");
  assert.strictEqual(cleanTagValue(""), "");
  assert.strictEqual(cleanTagValue("   "), "");
  assert.strictEqual(cleanTagValue(null), "");
  assert.strictEqual(cleanTagValue(undefined), "");
  assert.strictEqual(cleanTagValue(1985), "1985");
  assert.strictEqual(cleanTagValue("1985.??.??"), "1985.??.??", "a partially known date is kept as is");
}

// ---------- resolveGameStartFen ----------

{
  const ordinary = resolveGameStartFen(parseTags('[White "A"]\n[Black "B"]\n'));
  assert.deepStrictEqual(ordinary, { fen: Chess.START_FEN, valid: true });

  const fen = "r3k2r/8/8/3pP3/8/8/8/R3K2R w KQkq d6 0 1";
  assert.deepStrictEqual(resolveGameStartFen({ SetUp: "1", FEN: fen }), { fen, valid: true });
  assert.deepStrictEqual(resolveGameStartFen({ SetUp: " 1 ", FEN: `  ${fen}  ` }), { fen, valid: true }, "whitespace is trimmed");
  assert.deepStrictEqual(resolveGameStartFen({ FEN: fen }), { fen: null, valid: false }, "FEN without SetUp is an inconsistent pair");
  assert.deepStrictEqual(resolveGameStartFen({ SetUp: "1" }), { fen: null, valid: false }, "SetUp without FEN is an inconsistent pair");
  assert.deepStrictEqual(resolveGameStartFen({ SetUp: "1", FEN: "4k3/8/8/8/8/8/8/4K3 w K - 0 1" }), { fen: null, valid: false }, "an invalid FEN is rejected");
  assert.deepStrictEqual(resolveGameStartFen({ SetUp: "0" }), { fen: Chess.START_FEN, valid: true }, "SetUp 0 with no FEN means the initial position");
  assert.deepStrictEqual(resolveGameStartFen({ SetUp: "1", FEN: "   " }), { fen: null, valid: false });
}

// ---------- removeVariations ----------

{
  assert.deepStrictEqual(removeVariations("1. e4 (1. d4 d5 (1... Nf6)) e5 2. Nf3"), { text: "1. e4  e5 2. Nf3", overflowed: false });
  assert.deepStrictEqual(removeVariations("no variations here"), { text: "no variations here", overflowed: false });
  assert.deepStrictEqual(removeVariations("a ) b"), { text: "a  b", overflowed: false }, "a stray closing parenthesis is tolerated");
  assert.deepStrictEqual(removeVariations("a (b c"), { text: "a ", overflowed: false }, "an unclosed variation swallows the rest");

  const atLimit = "(".repeat(limits.maxVariationDepth) + ")".repeat(limits.maxVariationDepth);
  assert.strictEqual(removeVariations(`x${atLimit}y`).overflowed, false, "nesting at the limit is fine");
  const overLimit = "(".repeat(limits.maxVariationDepth + 1) + ")".repeat(limits.maxVariationDepth + 1);
  const overflowed = removeVariations(`x${overLimit}y`);
  assert.strictEqual(overflowed.overflowed, true, "nesting past the limit overflows");
  assert.strictEqual(overflowed.text, "x", "and returns what was collected so far");
}

// ---------- hasOversizedComment ----------

{
  const comment = (chars) => `{${"c".repeat(chars)}}`;
  // The limit applies to the comment including its braces (as app.js always did).
  assert.strictEqual(hasOversizedComment(`1. e4 ${comment(limits.commentMaxChars - 2)} e5`), false, "exactly at the limit");
  assert.strictEqual(hasOversizedComment(`1. e4 ${comment(limits.commentMaxChars - 1)} e5`), true, "one over the limit");
  assert.strictEqual(hasOversizedComment("1. e4 e5 no comments"), false);
  assert.strictEqual(hasOversizedComment(`${comment(10)} ${comment(limits.commentMaxChars)}`), true, "any single comment counts");
}

// ---------- tokenizeSanMoves ----------

{
  const text = [
    '[Event "Test"]',
    '[Result "1-0"]',
    "",
    "1. e4 {best by test} e5 2. Nf3",
    "Nc6 $1 3. Bb5 (3. Bc4 Bc5 (3... Nf6)) 3... a6 4. Ba4 Nf6 1-0",
  ].join("\n");
  assert.deepStrictEqual(tokenizeSanMoves(text), ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6"]);

  assert.deepStrictEqual(tokenizeSanMoves("1.e4 e5 2.Nf3 Nc6 *"), ["e4", "e5", "Nf3", "Nc6"], "move numbers glued to the move");
  assert.deepStrictEqual(tokenizeSanMoves("12... Qxe5+ 13. Rd1#  0-1"), ["Qxe5+", "Rd1#"], "black move numbers and results");
  assert.deepStrictEqual(tokenizeSanMoves("1. e4 e5 1/2-1/2"), ["e4", "e5"], "the draw marker is dropped");
  assert.deepStrictEqual(tokenizeSanMoves("1. e4 e5\r\n2. Nf3 *\r\n"), ["e4", "e5", "Nf3"], "Windows line endings");
  assert.deepStrictEqual(tokenizeSanMoves('[Event "x"]\n\n*'), [], "no moves at all is an empty list, not null");
  assert.deepStrictEqual(tokenizeSanMoves("1. O-O-O {castles} O-O"), ["O-O-O", "O-O"]);
  assert.deepStrictEqual(tokenizeSanMoves("1. e8=Q+ {promo} exd6 e.p. *"), ["e8=Q+", "exd6", "e.p."], "tokens are whitespace-separated only");

  const many = Array.from({ length: limits.maxPlies }, (_, i) => (i % 2 ? "Nc6" : "Nf3")).join(" ");
  assert.strictEqual(tokenizeSanMoves(many).length, limits.maxPlies, "exactly the maximum is accepted");
  assert.strictEqual(tokenizeSanMoves(`${many} Nf3`), null, "one ply over the maximum is rejected");

  const deep = `1. e4 ${"(".repeat(limits.maxVariationDepth + 1)}1. d4${")".repeat(limits.maxVariationDepth + 1)} e5`;
  assert.strictEqual(tokenizeSanMoves(deep), null, "variations nested too deeply are rejected");
}

// ---------- splitGamesFromText ----------

{
  const game = (n) => [`[Event "G${n}"]`, `[White "W${n}"]`, `[Black "B${n}"]`, `[Result "*"]`, "", "1. e4 e5 *"].join("\n");
  const three = [game(1), game(2), game(3)].join("\n\n");
  const split = splitGamesFromText(three);
  assert.strictEqual(split.length, 3);
  assert.ok(split[1].includes('[Event "G2"]') && !split[1].includes('[Event "G1"]'));
  assert.deepStrictEqual(split.map((g) => parseTags(g).Event), ["G1", "G2", "G3"]);

  assert.strictEqual(splitGamesFromText(game(1)).length, 1, "a single game stays whole (the blank line before the moves is not a split)");
  assert.strictEqual(splitGamesFromText(three.replace(/\n/g, "\r\n")).length, 3, "CRLF text splits the same way");
  assert.deepStrictEqual(splitGamesFromText(""), []);
  assert.deepStrictEqual(splitGamesFromText("\n\n   \n\n"), [], "blank input yields no games");
  assert.strictEqual(splitGamesFromText(`${game(1)}\n\n\n${game(2)}\n\n`).length, 2, "extra blank lines are fine");
}

// ---------- buildGameFromText ----------

{
  const text = '[Event "Test"]\n[White "Ana"]\n[Black "Bruno"]\n\n1. e4 e5 2. Nf3 *';
  const built = buildGameFromText(text);
  assert.strictEqual(built.tags.White, "Ana");
  assert.deepStrictEqual(built.sanMoves, ["e4", "e5", "Nf3"]);
  assert.deepStrictEqual(Object.keys(built).sort(), ["sanMoves", "tags"]);

  const atLimit = text + " ".repeat(limits.gameMaxChars - text.length);
  assert.strictEqual(atLimit.length, limits.gameMaxChars);
  assert.notStrictEqual(buildGameFromText(atLimit), null, "a game of exactly the size limit is kept");
  assert.strictEqual(buildGameFromText(`${atLimit} `), null, "one character over the size limit skips the game");
  assert.strictEqual(buildGameFromText(`${text}\n{${"c".repeat(limits.commentMaxChars)}}`), null, "an oversized comment skips the game");
  const many = Array.from({ length: limits.maxPlies + 1 }, () => "Nf3").join(" ");
  assert.strictEqual(buildGameFromText(`[Event "x"]\n\n${many}`), null, "too many plies skips the game");
  assert.strictEqual(buildGameFromText(`[Event "x"]\n\n1. e4 ${"(".repeat(13)}1. d4${")".repeat(13)} e5`), null, "over-nested variations skip the game");
}

// ---------- Whole pipeline: PGN text -> games -> legal replay ----------

{
  // Morphy's "Opera Game" (Paris, 1858), then a game that starts from a FEN.
  const opera = [
    '[Event "Paris"]',
    '[Site "Paris FRA"]',
    '[Date "1858.??.??"]',
    '[White "Paul Morphy"]',
    '[Black "Duke of Brunswick and Count Isouard"]',
    '[Result "1-0"]',
    "",
    "1. e4 e5 2. Nf3 d6 3. d4 Bg4 {This is a weak move already.--Fischer} 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6",
    "7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6",
    "15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0",
  ].join("\n");
  const fromFen = [
    '[Event "Puzzle"]',
    '[White "A"]',
    '[Black "B"]',
    '[SetUp "1"]',
    '[FEN "r3k2r/8/8/3pP3/8/8/8/R3K2R w KQkq d6 0 1"]',
    '[Result "*"]',
    "",
    "1. exd6 O-O *",
  ].join("\n");
  const broken = '[Event "Broken"]\n[SetUp "1"]\n[Result "*"]\n\n1. e4 *';

  const games = splitGamesFromText([opera, fromFen, broken].join("\n\n"))
    .map((text) => buildGameFromText(text))
    .filter(Boolean);
  assert.strictEqual(games.length, 3);

  const operaGame = games[0];
  assert.strictEqual(operaGame.tags.White, "Paul Morphy");
  assert.strictEqual(operaGame.sanMoves.length, 33, "the Opera Game has 17 moves (33 plies)");
  const board = new Chess(resolveGameStartFen(operaGame.tags).fen);
  operaGame.sanMoves.forEach((san, i) => {
    const move = sanToMove(san, board);
    assert.ok(move, `Opera Game ply ${i + 1} (${san}) should be legal`);
    board.makeMove(move);
  });
  assert.strictEqual(board.isCheckmate(), true, "the Opera Game ends in checkmate");
  assert.strictEqual(board.fen(), "1n1Rkb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2K5 b k - 1 17");

  const puzzleStart = resolveGameStartFen(games[1].tags);
  assert.strictEqual(puzzleStart.valid, true);
  const puzzleBoard = new Chess(puzzleStart.fen);
  assert.strictEqual(moveToUci(sanToMove(games[1].sanMoves[0], puzzleBoard)), "e5d6");
  assert.strictEqual(sanToMove(games[1].sanMoves[0], new Chess()), null, "the FEN game does not replay from the initial position");

  assert.strictEqual(resolveGameStartFen(games[2].tags).valid, false, "SetUp without FEN is reported invalid so the caller can skip it");
}

console.log("pgn.test.js passed");
