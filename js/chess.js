// Chess primitives: board, legal move generation, FEN, UCI and SAN helpers.
//
// Moved verbatim out of app.js (behaviour unchanged); the only additions are
// Chess#isCheckmate, #isStalemate, #isInsufficientMaterial and
// Chess.pieceValue. Pure logic: no DOM, no storage, so it runs under Node.
// API: docs/ARCHITECTURE.md section 5.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.chess = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

  // Material values in pawn units (see Chess.pieceValue).
  const PIECE_VALUES = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

  class Chess {
    constructor(fen) {
      this.loadFen(fen || Chess.START_FEN);
    }

    loadFen(fen) {
      const parts = fen.split(" ");
      const rows = parts[0].split("/");
      this.board = Array(64).fill(null);
      rows.forEach((row, rankIdx) => {
        let file = 0;
        for (const char of row) {
          if (Number.isNaN(Number(char))) {
            this.board[rankIdx * 8 + file] = char;
            file += 1;
          } else {
            file += Number(char);
          }
        }
      });
      this.turn = parts[1];
      this.castling = parts[2];
      this.enPassant = parts[3] === "-" ? -1 : Chess.squareToIndex(parts[3]);
      const halfmove = Number(parts[4]);
      const fullmove = Number(parts[5]);
      this.halfmove = Number.isFinite(halfmove) ? halfmove : 0;
      this.fullmove = Number.isFinite(fullmove) && fullmove > 0 ? fullmove : 1;
    }

    fen() {
      let placement = "";
      for (let rank = 0; rank < 8; rank += 1) {
        let empty = 0;
        for (let file = 0; file < 8; file += 1) {
          const piece = this.board[rank * 8 + file];
          if (!piece) {
            empty += 1;
          } else {
            if (empty) {
              placement += empty;
              empty = 0;
            }
            placement += piece;
          }
        }
        if (empty) placement += empty;
        if (rank !== 7) placement += "/";
      }
      const ep = this.enPassant === -1 ? "-" : Chess.indexToSquare(this.enPassant);
      return `${placement} ${this.turn} ${this.castling || "-"} ${ep} ${this.halfmove} ${this.fullmove}`;
    }

    static indexToSquare(index) {
      const rank = 8 - Math.floor(index / 8);
      const file = files[index % 8];
      return `${file}${rank}`;
    }

    static squareToIndex(square) {
      const file = files.indexOf(square[0]);
      const rank = Number(square[1]);
      return (8 - rank) * 8 + file;
    }

    pieceAt(index) { return this.board[index]; }
    isWhite(piece) { return piece && piece === piece.toUpperCase(); }
    isBlack(piece) { return piece && piece === piece.toLowerCase(); }
    isOpponent(piece, color) { return color === "w" ? this.isBlack(piece) : this.isWhite(piece); }
    inBounds(index) { return index >= 0 && index < 64; }
    isPromotionRank(index, color) {
      const rank = Math.floor(index / 8);
      return color === "w" ? rank === 0 : rank === 7;
    }

    generateMoves() {
      const moves = [];
      for (let i = 0; i < 64; i += 1) {
        const piece = this.board[i];
        if (!piece) continue;
        if (this.turn === "w" && this.isBlack(piece)) continue;
        if (this.turn === "b" && this.isWhite(piece)) continue;
        moves.push(...this.generatePieceMoves(i, piece));
      }
      return moves.filter((move) => this.isLegal(move));
    }

    generatePieceMoves(index, piece) {
      const moves = [];
      const rank = Math.floor(index / 8);
      const file = index % 8;
      const color = this.isWhite(piece) ? "w" : "b";
      const dir = color === "w" ? -1 : 1;

      const pushMove = (to, extras = {}) => moves.push({ from: index, to, piece, ...extras });

      switch (piece.toUpperCase()) {
        case "P": {
          const forward = index + dir * 8;
          if (this.inBounds(forward) && !this.board[forward]) {
            if (this.isPromotionRank(forward, color)) {
              ["Q", "R", "B", "N"].forEach((promo) => {
                pushMove(forward, { promotion: color === "w" ? promo : promo.toLowerCase() });
              });
            } else {
              pushMove(forward);
            }
            const startRank = color === "w" ? 6 : 1;
            const doubleForward = index + dir * 16;
            if (rank === startRank && !this.board[doubleForward]) {
              pushMove(doubleForward, { doublePawn: true });
            }
          }
          [-1, 1].forEach((df) => {
            const captureFile = file + df;
            if (captureFile < 0 || captureFile > 7) return;
            const captureIndex = index + dir * 8 + df;
            if (!this.inBounds(captureIndex)) return;
            const target = this.board[captureIndex];
            if (target && this.isOpponent(target, color)) {
              if (this.isPromotionRank(captureIndex, color)) {
                ["Q", "R", "B", "N"].forEach((promo) => {
                  pushMove(captureIndex, { capture: true, promotion: color === "w" ? promo : promo.toLowerCase() });
                });
              } else {
                pushMove(captureIndex, { capture: true });
              }
            }
            if (this.enPassant === captureIndex) {
              pushMove(captureIndex, { capture: true, enPassant: true });
            }
          });
          break;
        }
        case "N": {
          const jumps = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
          jumps.forEach(([dr, df]) => {
            const r = rank + dr;
            const f = file + df;
            if (r < 0 || r > 7 || f < 0 || f > 7) return;
            const to = r * 8 + f;
            const target = this.board[to];
            if (!target || this.isOpponent(target, color)) pushMove(to, { capture: Boolean(target) });
          });
          break;
        }
        case "B":
        case "R":
        case "Q": {
          const directions = [];
          if (piece.toUpperCase() !== "B") directions.push([1, 0], [-1, 0], [0, 1], [0, -1]);
          if (piece.toUpperCase() !== "R") directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
          directions.forEach(([dr, df]) => {
            let r = rank + dr;
            let f = file + df;
            while (r >= 0 && r < 8 && f >= 0 && f < 8) {
              const to = r * 8 + f;
              const target = this.board[to];
              if (!target) {
                pushMove(to);
              } else {
                if (this.isOpponent(target, color)) pushMove(to, { capture: true });
                break;
              }
              r += dr;
              f += df;
            }
          });
          break;
        }
        case "K": {
          for (let dr = -1; dr <= 1; dr += 1) {
            for (let df = -1; df <= 1; df += 1) {
              if (dr === 0 && df === 0) continue;
              const r = rank + dr;
              const f = file + df;
              if (r < 0 || r > 7 || f < 0 || f > 7) continue;
              const to = r * 8 + f;
              const target = this.board[to];
              if (!target || this.isOpponent(target, color)) pushMove(to, { capture: Boolean(target) });
            }
          }
          moves.push(...this.generateCastlingMoves(index, color));
          break;
        }
        default:
          break;
      }

      return moves;
    }

    generateCastlingMoves(index, color) {
      const moves = [];
      if (this.inCheck(color)) return moves;
      const rank = color === "w" ? 7 : 0;
      if (index !== rank * 8 + 4) return moves;
      const rights = this.castling;
      // The castling rights string can outlive the rook it describes (a FEN can
      // simply claim a right that doesn't match the board). Require the actual
      // rook on its corner square, or makeMove below would "castle" with nothing.
      const rook = color === "w" ? "R" : "r";

      if ((color === "w" && rights.includes("K")) || (color === "b" && rights.includes("k"))) {
        if (this.board[rank * 8 + 7] === rook
          && !this.board[rank * 8 + 5] && !this.board[rank * 8 + 6]
          && !this.isSquareAttacked(rank * 8 + 5, color) && !this.isSquareAttacked(rank * 8 + 6, color)) {
          moves.push({ from: index, to: rank * 8 + 6, piece: color === "w" ? "K" : "k", castle: "K" });
        }
      }

      if ((color === "w" && rights.includes("Q")) || (color === "b" && rights.includes("q"))) {
        if (this.board[rank * 8 + 0] === rook
          && !this.board[rank * 8 + 3] && !this.board[rank * 8 + 2] && !this.board[rank * 8 + 1]
          && !this.isSquareAttacked(rank * 8 + 3, color) && !this.isSquareAttacked(rank * 8 + 2, color)) {
          moves.push({ from: index, to: rank * 8 + 2, piece: color === "w" ? "K" : "k", castle: "Q" });
        }
      }

      return moves;
    }

    isLegal(move) {
      const snapshot = this.clone();
      snapshot.makeMove(move);
      return !snapshot.inCheck(this.turn);
    }

    makeMove(move) {
      const movingPiece = this.board[move.from];
      const captured = this.board[move.to];
      const wasBlackMove = this.turn === "b";
      const resetsHalfmove = Boolean(movingPiece && movingPiece.toUpperCase() === "P") || Boolean(captured) || Boolean(move.enPassant);
      this.board[move.from] = null;

      if (move.enPassant) {
        const dir = this.isWhite(movingPiece) ? 1 : -1;
        this.board[move.to + dir * 8] = null;
      }

      if (move.castle) {
        const rank = this.isWhite(movingPiece) ? 7 : 0;
        if (move.castle === "K") {
          this.board[rank * 8 + 5] = this.board[rank * 8 + 7];
          this.board[rank * 8 + 7] = null;
        } else {
          this.board[rank * 8 + 3] = this.board[rank * 8 + 0];
          this.board[rank * 8 + 0] = null;
        }
      }

      this.board[move.to] = move.promotion || movingPiece;
      this.updateCastlingRights(movingPiece, move, captured);

      if (move.doublePawn) {
        this.enPassant = move.from + (this.isWhite(movingPiece) ? -8 : 8);
      } else {
        this.enPassant = -1;
      }

      this.halfmove = resetsHalfmove ? 0 : (Number.isFinite(this.halfmove) ? this.halfmove + 1 : 1);
      if (wasBlackMove) {
        this.fullmove = Number.isFinite(this.fullmove) ? this.fullmove + 1 : 1;
      }
      this.turn = this.turn === "w" ? "b" : "w";
    }

    updateCastlingRights(piece, move, captured) {
      if (piece.toUpperCase() === "K") {
        this.castling = this.castling.replace(this.isWhite(piece) ? /K|Q/g : /k|q/g, "");
      }
      if (piece.toUpperCase() === "R") {
        const from = move.from;
        if (from === 56) this.castling = this.castling.replace("Q", "");
        if (from === 63) this.castling = this.castling.replace("K", "");
        if (from === 0) this.castling = this.castling.replace("q", "");
        if (from === 7) this.castling = this.castling.replace("k", "");
      }
      if (captured && captured.toUpperCase() === "R") {
        if (move.to === 56) this.castling = this.castling.replace("Q", "");
        if (move.to === 63) this.castling = this.castling.replace("K", "");
        if (move.to === 0) this.castling = this.castling.replace("q", "");
        if (move.to === 7) this.castling = this.castling.replace("k", "");
      }
    }

    inCheck(color) {
      const king = color === "w" ? "K" : "k";
      const kingIndex = this.board.findIndex((piece) => piece === king);
      return this.isSquareAttacked(kingIndex, color);
    }

    isSquareAttacked(index, color) {
      if (index < 0) return false;
      const enemy = color === "w" ? "b" : "w";
      const rank = Math.floor(index / 8);
      const file = index % 8;

      const enemyPawn = enemy === "w" ? "P" : "p";
      const pawnDir = enemy === "w" ? 1 : -1;
      for (const df of [-1, 1]) {
        const r = rank + pawnDir;
        const f = file + df;
        if (r < 0 || r > 7 || f < 0 || f > 7) continue;
        const idx = r * 8 + f;
        if (this.board[idx] === enemyPawn) return true;
      }

      const knight = enemy === "w" ? "N" : "n";
      const jumps = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
      for (const [dr, df] of jumps) {
        const r = rank + dr;
        const f = file + df;
        if (r < 0 || r > 7 || f < 0 || f > 7) continue;
        if (this.board[r * 8 + f] === knight) return true;
      }

      const rook = enemy === "w" ? "R" : "r";
      const bishop = enemy === "w" ? "B" : "b";
      const queen = enemy === "w" ? "Q" : "q";
      const king = enemy === "w" ? "K" : "k";

      const lines = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (const [dr, df] of lines) {
        let r = rank + dr;
        let f = file + df;
        while (r >= 0 && r < 8 && f >= 0 && f < 8) {
          const idx = r * 8 + f;
          const piece = this.board[idx];
          if (piece) {
            const isDiagonal = dr !== 0 && df !== 0;
            if (piece === queen) return true;
            if (isDiagonal && piece === bishop) return true;
            if (!isDiagonal && piece === rook) return true;
            break;
          }
          r += dr;
          f += df;
        }
      }

      for (let dr = -1; dr <= 1; dr += 1) {
        for (let df = -1; df <= 1; df += 1) {
          if (dr === 0 && df === 0) continue;
          const r = rank + dr;
          const f = file + df;
          if (r < 0 || r > 7 || f < 0 || f > 7) continue;
          if (this.board[r * 8 + f] === king) return true;
        }
      }

      return false;
    }

    clone() { return new Chess(this.fen()); }

    // ----- Additions over the class that used to live in app.js -----

    // The side to move is in check and has no legal move.
    isCheckmate() {
      return this.inCheck(this.turn) && this.generateMoves().length === 0;
    }

    // The side to move is not in check but has no legal move.
    isStalemate() {
      return !this.inCheck(this.turn) && this.generateMoves().length === 0;
    }

    // True when neither side can ever deliver mate: bare kings, one lone minor
    // piece, or only bishops that all stand on the same colour of square. Any
    // pawn, rook or queen (or two knights, or a bishop and a knight) can still
    // mate, so those positions are reported as sufficient material.
    isInsufficientMaterial() {
      const minors = [];
      for (let i = 0; i < 64; i += 1) {
        const piece = this.board[i];
        if (!piece) continue;
        const type = piece.toUpperCase();
        if (type === "K") continue;
        if (type !== "B" && type !== "N") return false;
        minors.push({ type, index: i });
      }
      if (minors.length <= 1) return true;
      if (!minors.every((minor) => minor.type === "B")) return false;
      const squareColor = (index) => (Math.floor(index / 8) + (index % 8)) % 2;
      const first = squareColor(minors[0].index);
      return minors.every((minor) => squareColor(minor.index) === first);
    }

    // Material value in pawn units (P1 N3 B3 R5 Q9 K0), for either colour.
    // Anything that is not a piece letter is worth 0.
    static pieceValue(piece) {
      if (typeof piece !== "string" || piece.length !== 1) return 0;
      const value = PIECE_VALUES[piece.toUpperCase()];
      return value === undefined ? 0 : value;
    }
  }

  Chess.START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  // Structural FEN validation for FEN strings coming from outside the app (e.g.
  // a PGN "FEN" tag). loadFen() itself stays permissive, since every other
  // caller only ever feeds it FEN strings the app generated itself; this is the
  // gate untrusted input goes through before it is trusted enough to load.
  Chess.isValidFen = function isValidFen(fen) {
    if (typeof fen !== "string") return false;
    const parts = fen.trim().split(/\s+/);
    if (parts.length !== 6) return false;
    const [placement, turn, castling, enPassant, halfmove, fullmove] = parts;

    const rows = placement.split("/");
    if (rows.length !== 8) return false;
    const board = Array(64).fill(null);
    let whiteKings = 0;
    let blackKings = 0;
    for (let rankIdx = 0; rankIdx < 8; rankIdx += 1) {
      let file = 0;
      for (const char of rows[rankIdx]) {
        if (/[1-8]/.test(char)) {
          file += Number(char);
        } else if (/[pnbrqkPNBRQK]/.test(char)) {
          if (file > 7) return false;
          board[rankIdx * 8 + file] = char;
          if (char === "K") whiteKings += 1;
          if (char === "k") blackKings += 1;
          file += 1;
        } else {
          return false;
        }
      }
      if (file !== 8) return false;
    }
    if (whiteKings !== 1 || blackKings !== 1) return false;

    if (turn !== "w" && turn !== "b") return false;

    if (castling !== "-") {
      if (!castling || !/^K?Q?k?q?$/.test(castling)) return false;
      // A castling right is only meaningful with its rook still on the corner;
      // a FEN claiming otherwise is exactly the inconsistency generateCastlingMoves
      // guards against, so it is rejected here too rather than loaded.
      if (castling.includes("K") && board[63] !== "R") return false;
      if (castling.includes("Q") && board[56] !== "R") return false;
      if (castling.includes("k") && board[7] !== "r") return false;
      if (castling.includes("q") && board[0] !== "r") return false;
    }

    if (enPassant !== "-" && !/^[a-h][36]$/.test(enPassant)) return false;
    if (!/^\d+$/.test(halfmove)) return false;
    if (!/^\d+$/.test(fullmove) || Number(fullmove) < 1) return false;

    return true;
  };

  function moveToUci(move) {
    if (!move) return "";
    return `${Chess.indexToSquare(move.from)}${Chess.indexToSquare(move.to)}${move.promotion ? move.promotion.toLowerCase() : ""}`;
  }

  function uciToMove(uci, board) {
    if (!uci || uci === "(none)") return null;
    const from = Chess.squareToIndex(uci.slice(0, 2));
    const to = Chess.squareToIndex(uci.slice(2, 4));
    const promo = uci[4];
    return board.generateMoves().find((move) => {
      if (move.from !== from || move.to !== to) return false;
      if (promo) {
        const expected = board.turn === "w" ? promo.toUpperCase() : promo.toLowerCase();
        return move.promotion === expected;
      }
      return true;
    }) || null;
  }

  function moveToSan(board, move) {
    if (!move) return "-";
    const after = board.clone();
    after.makeMove(move);
    const opponentTurn = after.turn;
    const suffix = after.inCheck(opponentTurn)
      ? (after.generateMoves().length === 0 ? "#" : "+")
      : "";
    if (move.castle === "K") return `O-O${suffix}`;
    if (move.castle === "Q") return `O-O-O${suffix}`;
    const piece = move.piece.toUpperCase();
    const destination = Chess.indexToSquare(move.to);
    const capture = move.capture || move.enPassant ? "x" : "";
    const promo = move.promotion ? `=${move.promotion.toUpperCase()}` : "";
    if (piece === "P") {
      const file = files[move.from % 8];
      return `${capture ? file : ""}${capture}${destination}${promo}${suffix}`;
    }

    const ambiguousMoves = board.generateMoves().filter((candidate) => (
      candidate !== move
      && candidate.to === move.to
      && candidate.from !== move.from
      && candidate.piece.toUpperCase() === piece
    ));
    let disambiguation = "";
    if (ambiguousMoves.length > 0) {
      const file = files[move.from % 8];
      const rank = String(8 - Math.floor(move.from / 8));
      const sameFile = ambiguousMoves.some((candidate) => files[candidate.from % 8] === file);
      const sameRank = ambiguousMoves.some((candidate) => String(8 - Math.floor(candidate.from / 8)) === rank);
      if (!sameFile) {
        disambiguation = file;
      } else if (!sameRank) {
        disambiguation = rank;
      } else {
        disambiguation = `${file}${rank}`;
      }
    }
    return `${piece}${disambiguation}${capture}${destination}${promo}${suffix}`;
  }

  function sanToMove(san, chess) {
    let clean = String(san || "")
      .replace(/\s*e\.p\.$/i, "")
      .replace(/[+#!?]/g, "");
    if (clean === "O-O" || clean === "0-0") return chess.generateMoves().find((m) => m.castle === "K");
    if (clean === "O-O-O" || clean === "0-0-0") return chess.generateMoves().find((m) => m.castle === "Q");

    const match = clean.match(/^([NBRQK])?([a-h])?([1-8])?(x)?([a-h][1-8])(=([NBRQK]))?$/);
    if (!match) return null;

    const [, pieceLetter, fileHint, rankHint, captureFlag, destination, , promo] = match;
    const piece = pieceLetter || "P";
    const dest = Chess.squareToIndex(destination);
    const promoPiece = promo ? (chess.turn === "w" ? promo : promo.toLowerCase()) : null;

    return chess.generateMoves().find((move) => {
      if (move.to !== dest) return false;
      if (move.piece.toUpperCase() !== piece) return false;
      if (promoPiece && move.promotion !== promoPiece) return false;
      if (captureFlag && !move.capture && !move.enPassant) return false;
      if (!captureFlag && (move.capture || move.enPassant)) return false;
      if (fileHint && files[move.from % 8] !== fileHint) return false;
      if (rankHint && String(8 - Math.floor(move.from / 8)) !== rankHint) return false;
      return true;
    }) || null;
  }

  return { Chess, files, uciToMove, moveToUci, moveToSan, sanToMove };
});
