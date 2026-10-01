// Unit tests for js/chess.js: move generation (perft), FEN, UCI/SAN helpers,
// game-state helpers (checkmate, stalemate, insufficient material) and
// Chess.pieceValue. Plain assert, deterministic, no network.
//
// Perft counts are the published reference numbers (Chess Programming Wiki);
// they are the best regression net for the move generator.

"use strict";

const assert = require("assert");
const path = require("path");

const chessApi = require(path.resolve(__dirname, "..", "..", "js", "chess.js"));
const { Chess, files, uciToMove, moveToUci, moveToSan, sanToMove } = chessApi;

// ---------- API surface ----------

assert.strictEqual(globalThis.Ludus.chess, chessApi, "js/chess.js registers itself as Ludus.chess");
assert.deepStrictEqual(Object.keys(chessApi).sort(), [
  "Chess", "NOTATION_STYLES", "SPANISH_LETTERS", "files", "localizeSan", "moveToSan", "moveToUci", "notationStyle", "sanToMove", "spokenSan", "uciToMove",
]);
assert.deepStrictEqual(files, ["a", "b", "c", "d", "e", "f", "g", "h"]);
assert.strictEqual(Chess.START_FEN, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
assert.strictEqual(typeof Chess.isValidFen, "function");

// ---------- Squares ----------

assert.strictEqual(Chess.squareToIndex("a8"), 0, "index 0 is a8");
assert.strictEqual(Chess.squareToIndex("h8"), 7);
assert.strictEqual(Chess.squareToIndex("a1"), 56);
assert.strictEqual(Chess.squareToIndex("h1"), 63);
assert.strictEqual(Chess.squareToIndex("e4"), 36);
for (let i = 0; i < 64; i += 1) {
  assert.strictEqual(Chess.squareToIndex(Chess.indexToSquare(i)), i, `square round trip ${i}`);
}

// ---------- FEN ----------

const KIWIPETE = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
const POSITION_3 = "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1";
const POSITION_4 = "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1";
const POSITION_5 = "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8";
const POSITION_6 = "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10";

[Chess.START_FEN, KIWIPETE, POSITION_3, POSITION_4, POSITION_5, POSITION_6,
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2"].forEach((fen) => {
  assert.strictEqual(new Chess(fen).fen(), fen, `FEN round trip: ${fen}`);
});

{
  const game = new Chess();
  assert.strictEqual(game.turn, "w");
  assert.strictEqual(game.board.length, 64);
  assert.strictEqual(game.board[0], "r", "a8 holds the black rook");
  assert.strictEqual(game.board[60], "K", "e1 holds the white king");
  assert.strictEqual(new Chess("8/8/8/8/8/8/8/K6k w - - 5 20").halfmove, 5);
  assert.strictEqual(new Chess("8/8/8/8/8/8/8/K6k w - - 5 20").fullmove, 20);
  assert.strictEqual(new Chess("8/8/8/8/8/8/8/K6k w - -").halfmove, 0, "missing counters default to 0 / 1");
  assert.strictEqual(new Chess("8/8/8/8/8/8/8/K6k w - -").fullmove, 1);

  // clone() is independent of the original.
  const copy = game.clone();
  copy.makeMove(uciToMove("e2e4", copy));
  assert.strictEqual(game.fen(), Chess.START_FEN, "moving on the clone leaves the original alone");
  assert.notStrictEqual(copy.fen(), game.fen());
}

// ---------- Chess.isValidFen ----------

{
  const valid = ["8/8/8/8/8/8/8/K6k w - - 0 1", Chess.START_FEN, KIWIPETE, POSITION_5, "  " + Chess.START_FEN + "  "];
  valid.forEach((fen) => assert.strictEqual(Chess.isValidFen(fen), true, `valid: ${fen}`));

  const invalid = [
    [null, "not a string"],
    [42, "a number"],
    ["", "empty"],
    ["8/8/8/8/8/8/8/K6k w - - 0", "five fields"],
    ["8/8/8/8/8/8/K6k w - - 0 1", "seven ranks"],
    ["8/8/8/8/8/8/8/8/K6k w - - 0 1", "nine ranks"],
    ["8/8/8/8/8/8/8/K7k w - - 0 1", "rank with nine squares"],
    ["8/8/8/8/8/8/8/K5k w - - 0 1", "rank with seven squares"],
    ["8/8/8/8/8/8/8/7k w - - 0 1", "no white king"],
    ["8/8/8/8/8/8/8/K7 w - - 0 1", "no black king"],
    ["K7/8/8/8/8/8/8/K6k w - - 0 1", "two white kings"],
    ["8/8/8/8/8/8/8/K5xk w - - 0 1", "unknown piece letter"],
    ["8/8/8/8/8/8/8/K6k x - - 0 1", "bad side to move"],
    ["r3k2r/8/8/8/8/8/8/R3K2R w QK - 0 1", "castling rights out of order"],
    ["r3k2r/8/8/8/8/8/8/4K3 w K - 0 1", "castling right without the rook"],
    ["r3k2r/8/8/8/8/8/8/R3K2R w KQkq e4 0 1", "en passant square on the wrong rank"],
    ["8/8/8/8/8/8/8/K6k w - - -1 1", "negative halfmove"],
    ["8/8/8/8/8/8/8/K6k w - - 0 0", "fullmove 0"],
    ["8/8/8/8/8/8/8/K6k w - - x 1", "non-numeric halfmove"],
  ];
  invalid.forEach(([fen, why]) => assert.strictEqual(Chess.isValidFen(fen), false, `invalid (${why})`));
}

// ---------- Perft: the move generator against published counts ----------

function perft(game, depth) {
  const moves = game.generateMoves();
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const move of moves) {
    const next = game.clone();
    next.makeMove(move);
    nodes += perft(next, depth - 1);
  }
  return nodes;
}

const PERFT_CASES = [
  { name: "start position", fen: Chess.START_FEN, counts: [20, 400, 8902, 197281] },
  { name: "Kiwipete", fen: KIWIPETE, counts: [48, 2039, 97862] },
  { name: "position 3 (en passant, pins)", fen: POSITION_3, counts: [14, 191, 2812, 43238] },
  { name: "position 4 (promotions, castling)", fen: POSITION_4, counts: [6, 264, 9467] },
  { name: "position 4 mirrored", fen: "r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1", counts: [6, 264, 9467] },
  { name: "position 5", fen: POSITION_5, counts: [44, 1486, 62379] },
  { name: "position 6", fen: POSITION_6, counts: [46, 2079, 89890] },
];

PERFT_CASES.forEach(({ name, fen, counts }) => {
  counts.forEach((expected, index) => {
    const depth = index + 1;
    assert.strictEqual(perft(new Chess(fen), depth), expected, `perft(${name}, depth ${depth})`);
  });
});

// ---------- UCI ----------

{
  const game = new Chess();
  const e4 = uciToMove("e2e4", game);
  assert.ok(e4, "e2e4 is legal");
  assert.strictEqual(e4.doublePawn, true);
  assert.strictEqual(moveToUci(e4), "e2e4");
  assert.strictEqual(uciToMove("e2e5", game), null, "an illegal move is null");
  assert.strictEqual(uciToMove("e7e5", game), null, "the other side's move is null");
  assert.strictEqual(uciToMove("(none)", game), null);
  assert.strictEqual(uciToMove("", game), null);
  assert.strictEqual(uciToMove(null, game), null);
  assert.strictEqual(moveToUci(null), "");

  // Every legal move of several positions survives a UCI round trip.
  [Chess.START_FEN, KIWIPETE, POSITION_3, POSITION_4, POSITION_5, POSITION_6].forEach((fen) => {
    const board = new Chess(fen);
    board.generateMoves().forEach((move) => {
      const uci = moveToUci(move);
      const back = uciToMove(uci, board);
      assert.ok(back, `${uci} should resolve in ${fen}`);
      assert.strictEqual(back.from, move.from);
      assert.strictEqual(back.to, move.to);
      assert.strictEqual(back.promotion, move.promotion);
    });
  });

  // Promotions: the letter picks the piece, in either case convention.
  const promo = new Chess("7k/P7/8/8/8/8/8/K7 w - - 0 1");
  ["q", "r", "b", "n"].forEach((letter) => {
    const move = uciToMove(`a7a8${letter}`, promo);
    assert.strictEqual(move.promotion, letter.toUpperCase(), `white a7a8${letter}`);
    assert.strictEqual(moveToUci(move), `a7a8${letter}`, "UCI promotion letters are lower case");
  });
  const blackPromo = new Chess("7k/8/8/8/8/8/6p1/K7 b - - 0 1");
  assert.strictEqual(uciToMove("g2g1n", blackPromo).promotion, "n");
  assert.strictEqual(uciToMove("a7a8", promo).promotion, "Q", "without a letter the first (queen) promotion is used");
}

// ---------- SAN ----------

{
  const board = new Chess();
  assert.strictEqual(moveToSan(board, uciToMove("e2e4", board)), "e4");
  assert.strictEqual(moveToSan(board, uciToMove("g1f3", board)), "Nf3");
  assert.strictEqual(moveToSan(board, null), "-");

  const capture = new Chess("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2");
  assert.strictEqual(moveToSan(capture, uciToMove("e4d5", capture)), "exd5");

  // Castling, with check and without.
  const castle = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  assert.strictEqual(moveToSan(castle, uciToMove("e1g1", castle)), "O-O");
  assert.strictEqual(moveToSan(castle, uciToMove("e1c1", castle)), "O-O-O");
  const castleBlack = new Chess("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1");
  assert.strictEqual(moveToSan(castleBlack, uciToMove("e8g8", castleBlack)), "O-O");
  assert.strictEqual(moveToSan(castleBlack, uciToMove("e8c8", castleBlack)), "O-O-O");
  const castleWithCheck = new Chess("3k4/8/8/8/8/8/8/R3K3 w Q - 0 1");
  assert.strictEqual(moveToSan(castleWithCheck, uciToMove("e1c1", castleWithCheck)), "O-O-O+", "the castled rook gives check on the d-file");

  // En passant.
  const ep = new Chess("rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3");
  assert.strictEqual(moveToSan(ep, uciToMove("e5d6", ep)), "exd6");

  // Promotions, captures with promotion, check and mate suffixes.
  const promo = new Chess("7k/P7/8/8/8/8/8/K7 w - - 0 1");
  assert.strictEqual(moveToSan(promo, uciToMove("a7a8q", promo)), "a8=Q+");
  assert.strictEqual(moveToSan(promo, uciToMove("a7a8n", promo)), "a8=N");
  const promoCapture = new Chess("1n5k/P7/8/8/8/8/8/K7 w - - 0 1");
  assert.strictEqual(moveToSan(promoCapture, uciToMove("a7b8q", promoCapture)), "axb8=Q+");
  const mate = new Chess("6k1/5ppp/8/8/8/8/8/R3K3 w Q - 0 1");
  assert.strictEqual(moveToSan(mate, uciToMove("a1a8", mate)), "Ra8#");

  // Disambiguation: file, rank, both.
  const knights = new Chess("rnbqkbnr/pppppppp/8/8/8/5N2/PPP1PPPP/RNBQKB1R w KQkq - 0 1");
  assert.strictEqual(moveToSan(knights, uciToMove("b1d2", knights)), "Nbd2");
  assert.strictEqual(moveToSan(knights, uciToMove("f3d2", knights)), "Nfd2");
  const rooks = new Chess("4k3/8/8/R7/8/8/8/R3K3 w - - 0 1");
  assert.strictEqual(moveToSan(rooks, uciToMove("a5a3", rooks)), "R5a3");
  assert.strictEqual(moveToSan(rooks, uciToMove("a1a3", rooks)), "R1a3");
  const queens = new Chess("1k6/8/8/8/4Q2Q/8/8/K6Q w - - 0 1");
  assert.strictEqual(moveToSan(queens, uciToMove("h4e1", queens)), "Qh4e1", "file and rank both needed");
  assert.strictEqual(moveToSan(queens, uciToMove("e4e1", queens)), "Qee1", "file is enough");
  assert.strictEqual(moveToSan(queens, uciToMove("h1e1", queens)), "Q1e1", "rank is enough");
}

{
  // sanToMove: notation people actually type or paste.
  const board = new Chess();
  const pick = (san, b = board) => {
    const move = sanToMove(san, b);
    return move ? moveToUci(move) : null;
  };
  assert.strictEqual(pick("e4"), "e2e4");
  assert.strictEqual(pick("Nf3"), "g1f3");
  assert.strictEqual(pick("e4!?"), "e2e4", "annotation glyphs are ignored");
  assert.strictEqual(pick("Nf3+"), "g1f3", "check marks are ignored");
  assert.strictEqual(pick("e5"), null, "an illegal pawn move is not found");
  assert.strictEqual(pick("Nf6"), null);
  assert.strictEqual(pick("hello"), null, "garbage is null");
  assert.strictEqual(pick(""), null);
  assert.strictEqual(pick(null), null);
  assert.strictEqual(pick("Pe4"), null, "a leading P is not SAN");

  const castle = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  assert.strictEqual(pick("O-O", castle), "e1g1");
  assert.strictEqual(pick("0-0", castle), "e1g1", "zeros are accepted");
  assert.strictEqual(pick("O-O-O", castle), "e1c1");
  assert.strictEqual(pick("0-0-0", castle), "e1c1");
  const noCastle = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1");
  assert.ok(!sanToMove("O-O", noCastle), "castling without the right is not found");

  const ep = new Chess("rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3");
  assert.strictEqual(pick("exd6", ep), "e5d6");
  assert.strictEqual(pick("exd6 e.p.", ep), "e5d6", "e.p. suffix is ignored");
  assert.strictEqual(pick("e6", ep), "e5e6");

  const promo = new Chess("7k/P7/8/8/8/8/8/K7 w - - 0 1");
  assert.strictEqual(pick("a8=Q", promo), "a7a8q");
  assert.strictEqual(pick("a8=N", promo), "a7a8n");
  assert.strictEqual(pick("a8=Q+", promo), "a7a8q");

  const knights = new Chess("rnbqkbnr/pppppppp/8/8/8/5N2/PPP1PPPP/RNBQKB1R w KQkq - 0 1");
  assert.strictEqual(pick("Nbd2", knights), "b1d2");
  assert.strictEqual(pick("Nfd2", knights), "f3d2");
  const rooks = new Chess("4k3/8/8/R7/8/8/8/R3K3 w - - 0 1");
  assert.strictEqual(pick("R5a3", rooks), "a5a3");
  assert.strictEqual(pick("R1a3", rooks), "a1a3");
  const capture = new Chess("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2");
  assert.strictEqual(pick("exd5", capture), "e4d5");
  assert.strictEqual(pick("e4d5", capture), null, "coordinate notation is not SAN");
}

{
  // moveToSan -> sanToMove is the identity on every legal move.
  const samples = [Chess.START_FEN, KIWIPETE, POSITION_3, POSITION_4, POSITION_5, POSITION_6];
  const kiwi = new Chess(KIWIPETE);
  kiwi.generateMoves().forEach((move) => {
    const child = kiwi.clone();
    child.makeMove(move);
    samples.push(child.fen());
  });
  let checked = 0;
  samples.forEach((fen) => {
    const board = new Chess(fen);
    board.generateMoves().forEach((move) => {
      const san = moveToSan(board, move);
      const back = sanToMove(san, board);
      assert.ok(back, `${san} should resolve in ${fen}`);
      assert.strictEqual(back.from, move.from, `${san} from (${fen})`);
      assert.strictEqual(back.to, move.to, `${san} to (${fen})`);
      assert.strictEqual(back.promotion, move.promotion, `${san} promotion (${fen})`);
      checked += 1;
    });
  });
  assert.ok(checked > 1500, `SAN round trip covered ${checked} moves`);
}

// ---------- makeMove bookkeeping ----------

{
  const game = new Chess();
  const play = (uci) => {
    const move = uciToMove(uci, game);
    assert.ok(move, `${uci} legal`);
    game.makeMove(move);
    return game;
  };
  play("e2e4");
  assert.strictEqual(game.enPassant, Chess.squareToIndex("e3"), "a double push sets the en passant square");
  assert.strictEqual(game.halfmove, 0);
  play("g8f6");
  assert.strictEqual(game.enPassant, -1, "any other move clears it");
  assert.strictEqual(game.halfmove, 1);
  assert.strictEqual(game.fullmove, 2, "fullmove increments after Black moves");
  play("e1e2");
  assert.strictEqual(game.castling, "kq", "a king move drops both of its castling rights");
  play("h8g8");
  assert.strictEqual(game.castling, "q", "a rook move drops its own side's right");

  const capturedRook = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  capturedRook.makeMove(uciToMove("a1a8", capturedRook));
  assert.strictEqual(capturedRook.castling, "Kk", "capturing a rook on its corner removes that right (and the mover's own)");

  const enPassant = new Chess("rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3");
  enPassant.makeMove(uciToMove("e5d6", enPassant));
  assert.strictEqual(enPassant.board[Chess.squareToIndex("d5")], null, "the captured pawn is removed");
}

// ---------- Attack and check queries ----------

{
  const game = new Chess("4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1");
  assert.strictEqual(game.inCheck("w"), true);
  assert.strictEqual(game.inCheck("b"), false);
  assert.strictEqual(game.isSquareAttacked(Chess.squareToIndex("e1"), "w"), true, "attacked by black");
  assert.strictEqual(game.isSquareAttacked(Chess.squareToIndex("a1"), "b"), false, "a1 is not attacked by white pieces");
  assert.strictEqual(game.isSquareAttacked(-1, "w"), false, "an off-board index is never attacked");
  assert.strictEqual(new Chess("8/8/8/8/8/8/8/7k w - - 0 1").inCheck("w"), false, "no king means no check");
}

// ---------- isCheckmate / isStalemate ----------

{
  const foolsMate = new Chess("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");
  assert.strictEqual(foolsMate.isCheckmate(), true, "fool's mate");
  assert.strictEqual(foolsMate.isStalemate(), false);

  const backRank = new Chess("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1");
  backRank.makeMove(uciToMove("a1a8", backRank));
  assert.strictEqual(backRank.isCheckmate(), true, "back-rank mate");

  const stalemate = new Chess("k7/2K5/1Q6/8/8/8/8/8 b - - 0 1");
  assert.strictEqual(stalemate.isStalemate(), true, "classic stalemate");
  assert.strictEqual(stalemate.isCheckmate(), false);

  const start = new Chess();
  assert.strictEqual(start.isCheckmate(), false);
  assert.strictEqual(start.isStalemate(), false);

  const checkOnly = new Chess("4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1");
  assert.strictEqual(checkOnly.inCheck("w"), true);
  assert.strictEqual(checkOnly.isCheckmate(), false, "in check but with a legal reply is not mate");
  assert.strictEqual(checkOnly.isStalemate(), false);
}

// ---------- isInsufficientMaterial ----------

{
  const insufficient = [
    ["8/8/8/8/8/8/8/K6k w - - 0 1", "bare kings"],
    ["8/8/8/8/8/8/8/KB5k w - - 0 1", "king and bishop v king"],
    ["8/8/8/8/8/8/8/KN5k w - - 0 1", "king and knight v king"],
    ["8/8/8/8/8/8/8/K5nk w - - 0 1", "king v king and knight"],
    ["8/8/8/8/8/8/8/K5bk w - - 0 1", "king v king and bishop"],
    ["8/8/8/8/8/8/8/KB1b3k w - - 0 1", "bishops on the same colour (b1 and d1)"],
  ];
  insufficient.forEach(([fen, why]) => {
    assert.strictEqual(new Chess(fen).isInsufficientMaterial(), true, `insufficient: ${why}`);
  });

  const sufficient = [
    ["8/8/8/8/8/8/P7/K6k w - - 0 1", "a pawn"],
    ["8/8/8/8/8/8/8/KR5k w - - 0 1", "a rook"],
    ["8/8/8/8/8/8/8/KQ5k w - - 0 1", "a queen"],
    ["8/8/8/8/8/8/8/KNN4k w - - 0 1", "two knights"],
    ["8/8/8/8/8/8/8/KBN4k w - - 0 1", "bishop and knight"],
    ["8/8/8/8/8/8/8/KB2b2k w - - 0 1", "bishops on opposite colours (b1 and e1)"],
    ["8/8/8/8/8/8/8/KBB4k w - - 0 1", "two bishops on opposite colours (b1 and c1)"],
    ["8/8/8/8/8/8/8/K3n1nk w - - 0 1", "two knights for Black"],
    ["8/8/8/8/8/8/8/KN4nk w - - 0 1", "a knight each"],
    [Chess.START_FEN, "the start position"],
  ];
  sufficient.forEach(([fen, why]) => {
    assert.strictEqual(new Chess(fen).isInsufficientMaterial(), false, `sufficient: ${why}`);
  });
}

// ---------- Chess.pieceValue ----------

{
  const expected = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
  Object.keys(expected).forEach((piece) => {
    assert.strictEqual(Chess.pieceValue(piece), expected[piece], `white ${piece}`);
    assert.strictEqual(Chess.pieceValue(piece.toLowerCase()), expected[piece], `black ${piece.toLowerCase()}`);
  });
  ["", " ", "x", "NN", "constructor", null, undefined, 3, {}].forEach((value) => {
    assert.strictEqual(Chess.pieceValue(value), 0, `not a piece: ${String(value)}`);
  });

  const total = (fen) => new Chess(fen).board.reduce((sum, piece) => sum + Chess.pieceValue(piece), 0);
  assert.strictEqual(total(Chess.START_FEN), 78, "each side has 39 points at the start");
}

// ---------- Notation: localizeSan / notationStyle / spokenSan ----------

{
  const { localizeSan, notationStyle, spokenSan } = chessApi;
  const fixed = [
    ["Nf3", "Cf3"], ["Bb5", "Ab5"], ["Rg1", "Tg1"], ["Qxf7#", "Dxf7#"], ["Kf1", "Rf1"], ["Nxg7+", "Cxg7+"],
    ["Rad1", "Tad1"], ["N5f3", "C5f3"], ["Qh4xe1+", "Dh4xe1+"], ["e4", "e4"], ["exd5", "exd5"], ["bxc3", "bxc3"],
    ["e8=Q+", "e8=D+"], ["axb8=N", "axb8=C"], ["h1=R", "h1=T"], ["g8=B#", "g8=A#"],
    ["O-O", "O-O"], ["O-O-O+", "O-O-O+"],
  ];
  fixed.forEach(([english, spanish]) => {
    assert.strictEqual(localizeSan(english, "es", { style: "auto" }), spanish, `es: ${english}`);
    assert.strictEqual(localizeSan(english, "en", { style: "auto" }), english, `en: ${english} is unchanged`);
    assert.strictEqual(localizeSan(english, "en", { style: "spanish" }), spanish, `style spanish wins over an English UI: ${english}`);
    assert.strictEqual(localizeSan(english, "es", { style: "english" }), english, `style english wins over a Spanish UI: ${english}`);
  });
  assert.strictEqual(localizeSan("", "es"), "");
  assert.strictEqual(localizeSan(null, "es"), "");
  assert.strictEqual(localizeSan(undefined, "es"), "");
  assert.strictEqual(localizeSan("Rg1", "fr", { style: "auto" }), "Rg1", "unknown languages read English letters");
  assert.strictEqual(localizeSan("Rg1", "es-AR", { style: "auto" }), "Tg1", "regional Spanish is Spanish");

  assert.deepStrictEqual(chessApi.NOTATION_STYLES, ["auto", "english", "spanish"]);
  assert.strictEqual(notationStyle("es", { style: "auto" }), "spanish");
  assert.strictEqual(notationStyle("en", { style: "auto" }), "english");
  assert.strictEqual(notationStyle("en", { style: "spanish" }), "spanish");
  assert.strictEqual(notationStyle("es", { style: "english" }), "english");

  // The stored setting is what the UI follows (Settings is loaded at call time, never at load time).
  const saved = globalThis.Ludus.Settings;
  try {
    globalThis.Ludus.Settings = { get: (path) => (path === "notation.style" ? "spanish" : undefined) };
    assert.strictEqual(localizeSan("Nf3", "en"), "Cf3", "setting spanish, English UI");
    globalThis.Ludus.Settings = { get: () => "english" };
    assert.strictEqual(localizeSan("Nf3", "es"), "Nf3", "setting english, Spanish UI");
    globalThis.Ludus.Settings = { get: () => "auto" };
    assert.strictEqual(localizeSan("Nf3", "es"), "Cf3", "setting auto follows the language");
    globalThis.Ludus.Settings = { get: () => { throw new Error("storage blocked"); } };
    assert.strictEqual(localizeSan("Nf3", "es"), "Cf3", "a Settings failure degrades to auto");
    globalThis.Ludus.Settings = { get: () => "klingon" };
    assert.strictEqual(localizeSan("Nf3", "en"), "Nf3", "an unknown stored value degrades to auto");
  } finally {
    if (saved === undefined) delete globalThis.Ludus.Settings;
    else globalThis.Ludus.Settings = saved;
  }

  // Every SAN of the classics data (and every legal move of a few middlegames): localizing loses
  // nothing (the inverse map restores the English SAN exactly), "R" only ever means the king,
  // and nothing but the piece letters changes.
  const inverse = {};
  Object.keys(chessApi.SPANISH_LETTERS).forEach((english) => { inverse[chessApi.SPANISH_LETTERS[english]] = english; });
  assert.strictEqual(new Set(Object.values(chessApi.SPANISH_LETTERS)).size, 5, "the mapping is injective");
  const sans = [];
  try {
    require(path.resolve(__dirname, "..", "..", "js", "data", "classics.data.js"));
    (globalThis.Ludus.ClassicsData.games || []).forEach((game) => {
      const board = new Chess(game.startFen || Chess.START_FEN);
      game.moves.forEach((text) => {
        const move = sanToMove(text, board);
        if (!move) return;
        sans.push(moveToSan(board, move));
        board.makeMove(move);
      });
    });
  } catch (error) {
    // The classics file is optional for this test; the fixed list above still runs.
  }
  ["r3k2r/pp3ppp/2n1bn2/2bqp3/3P4/2N1BN2/PPQ1BPPP/R3K2R w KQkq - 0 1", "4k3/P6P/8/8/8/8/p6p/4K3 w - - 0 1",
    "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4"].forEach((fen) => {
    const board = new Chess(fen);
    board.generateMoves().forEach((move) => sans.push(moveToSan(board, move)));
  });
  assert.ok(sans.length > 500, `the corpus of SANs is big enough (${sans.length})`);
  assert.ok(sans.some((san) => /^K/.test(san)) && sans.some((san) => /=[QRBN]/.test(san)) && sans.some((san) => san === "O-O"), "the corpus has king moves, promotions and castling");
  sans.forEach((san) => {
    const spanish = localizeSan(san, "es", { style: "auto" });
    assert.strictEqual(spanish.length, san.length, `same length: ${san}`);
    assert.strictEqual(spanish.replace(/^[RDTAC]/, (letter) => inverse[letter]).replace(/=([RDTAC])/, (m, letter) => `=${inverse[letter]}`), san, `nothing lost: ${san} -> ${spanish}`);
    assert.ok(!/^[KQBN]/.test(spanish) && !/=[KQBN]/.test(spanish), `no English piece letter is left: ${spanish}`);
    assert.strictEqual(/^R/.test(spanish), /^K/.test(san), `R means the king and only the king: ${san} -> ${spanish}`);
    assert.strictEqual(spanish.replace(/[RDTAC]/g, "*"), san.replace(/[KQRBN]/g, "*"), `only piece letters change: ${san}`);
    assert.strictEqual(localizeSan(san, "en", { style: "auto" }), san, `English is untouched: ${san}`);
  });

  // Words for a screen reader.
  assert.strictEqual(spokenSan("Nxf3+", "es"), "caballo captura en f3, jaque");
  assert.strictEqual(spokenSan("Rg1", "en"), "rook to g1");
  assert.strictEqual(spokenSan("Rg1", "es"), "torre a g1");
  assert.strictEqual(spokenSan("Kf1", "es"), "rey a f1", "a king move says rey, not R");
  assert.strictEqual(spokenSan("Qxf7#", "en"), "queen takes f7, checkmate");
  assert.strictEqual(spokenSan("O-O", "es"), "enroque corto");
  assert.strictEqual(spokenSan("O-O-O+", "en"), "castles queenside, check");
  assert.strictEqual(spokenSan("e8=Q+", "en"), "pawn to e8, promotes to queen, check");
  assert.strictEqual(spokenSan("exd5", "es"), "peón desde e captura en d5");
  assert.strictEqual(spokenSan("Rad1", "en"), "rook from a, to d1");
  assert.strictEqual(spokenSan("hola", "es"), "hola", "text that is not SAN comes back unchanged");
  sans.forEach((san) => assert.ok(spokenSan(san, "es") !== san || /^[a-h]/.test(san) === false, `every SAN has a spoken form: ${san}`));
}

console.log("chess.test.js passed");
