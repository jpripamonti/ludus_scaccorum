const boardEl = document.getElementById("board");
const playerNameDetectedEl = document.getElementById("player-name-detected");
const pgnInputEl = document.getElementById("pgn-input");
const pgnHintEl = document.getElementById("pgn-hint");
const pgnLibraryEl = document.getElementById("pgn-library");
const pgnLibraryListEl = document.getElementById("pgn-library-list");
const pgnClearBtn = document.getElementById("pgn-clear-btn");
const sourceFileBtn = document.getElementById("source-file-btn");
const sourceOnlineBtn = document.getElementById("source-online-btn");
const setupWizardProgressLabelEl = document.getElementById("setup-wizard-progress-label");
const setupWizardProgressBarEl = document.getElementById("setup-wizard-progress-bar");
const landingScreenEl = document.getElementById("landing-screen");
const landingStudyBtn = document.getElementById("landing-study-btn");
const landingDuelBtn = document.getElementById("landing-duel-btn");
const landingHistoryBtn = document.getElementById("landing-history-btn");
const landingOptionsBtn = document.getElementById("landing-options-btn");
const landingNoteEl = document.getElementById("landing-note");
const wizardStepModeEl = document.getElementById("wizard-step-mode");
const wizardStepSourceEl = document.getElementById("wizard-step-source");
const wizardStepDataEl = document.getElementById("wizard-step-data");
const sourceBackBtn = document.getElementById("source-back-btn");
const dataBackBtn = document.getElementById("data-back-btn");
const sourceSelectedHintEl = document.getElementById("source-selected-hint");
const modeLevelSwitchEls = Array.from(document.querySelectorAll("[data-mode-level-switch]"));
const modeSwitchNormalEls = Array.from(document.querySelectorAll('[data-mode-label="citizen"]'));
const modeSwitchEngineerEls = Array.from(document.querySelectorAll('[data-mode-label="engineer"]'));
const sourceFilePanelEl = document.getElementById("source-file-panel");
const sourceOnlinePanelEl = document.getElementById("source-online-panel");
const onlineProviderSelectEl = document.getElementById("online-provider-select");
const onlineUserInputEl = document.getElementById("online-user-input");
const onlineMinSlowGamesEl = document.getElementById("online-min-slow-games");
const onlineFallbackBlitzEl = document.getElementById("online-fallback-blitz");
const onlinePlanSummaryEl = document.getElementById("online-plan-summary");
const onlineNormalProtocolEl = document.getElementById("online-normal-protocol");
const onlineStatusEl = document.getElementById("online-status");
const goConfigBtn = document.getElementById("go-config-btn");
const backUploadBtn = document.getElementById("back-upload-btn");
const setupStepUploadEl = document.getElementById("setup-step-upload");
const setupStepConfigEl = document.getElementById("setup-step-config");
const configPrepProgressLabelEl = document.getElementById("config-prep-progress-label");
const configPrepProgressBarEl = document.getElementById("config-prep-progress-bar");
const configPrepProgressHintEl = document.getElementById("config-prep-progress-hint");
const configFilesStatusEl = document.getElementById("config-files-status");
const playerTargetLabelEl = document.getElementById("player-target-label");
const playerTargetHintEl = document.getElementById("player-target-hint");
const analysisTimeMsEl = document.getElementById("analysis-time-ms");
const thresholdEl = document.getElementById("error-threshold");
const scoringSystemEl = document.getElementById("scoring-system");
const scoringSystemHintEl = document.getElementById("scoring-system-hint");
const gameFormatEl = document.getElementById("game-format");
const gameFormatHintEl = document.getElementById("game-format-hint");
const duelConfigEl = document.getElementById("duel-config");
const duelPlayerAEl = document.getElementById("duel-player-a");
const duelPlayerBEl = document.getElementById("duel-player-b");
const turnTimeSecondsEl = document.getElementById("turn-time-seconds");
const analyzeBtn = document.getElementById("analyze-btn");
const analysisStatusEl = document.getElementById("analysis-status");
const analysisMetricsEl = document.getElementById("analysis-metrics");
const analysisProgressWrapEl = document.getElementById("analysis-progress-wrap");
const analysisProgressBarEl = document.getElementById("analysis-progress-bar");
const analysisProgressLabelEl = document.getElementById("analysis-progress-label");
const setupPanelEl = document.getElementById("setup-panel");
const sessionSizeEl = document.getElementById("session-size");
const sessionHintEl = document.getElementById("session-hint");

const gameLayoutEl = document.getElementById("game-layout");
const roundStatusEl = document.getElementById("round-status");
const sessionProgressEl = document.getElementById("session-progress");
const turnSignalEl = document.getElementById("turn-signal");
const orientationSignalEl = document.getElementById("orientation-signal");
const scoreSignalEl = document.getElementById("score-signal");
const roundResultEl = document.getElementById("round-result");
const roundResultPanelEl = document.getElementById("round-result-panel");
const turnTimerEl = document.getElementById("turn-timer");
const turnTimerValueEl = document.getElementById("turn-timer-value");
const turnTimerBarEl = document.getElementById("turn-timer-bar");
const scorePanelEl = document.getElementById("score-panel");
const competitiveStatusEl = document.getElementById("competitive-status");
const scoreLabelEl = document.getElementById("score-label");
const scoreEl = document.getElementById("score");
const historyEl = document.getElementById("history");
const nextBtn = document.getElementById("next-btn");
const skipBtn = document.getElementById("skip-btn");
const restartBtn = document.getElementById("restart-btn");
const gameDetailsMiniEl = document.getElementById("game-details-mini");
const feedbackStripEl = document.getElementById("feedback-strip");
const feedbackStripQualityEl = document.getElementById("feedback-strip-quality");
const feedbackStripDeltaEl = document.getElementById("feedback-strip-delta");
const feedbackStripPointsEl = document.getElementById("feedback-strip-points");
const feedbackStripBarEl = document.getElementById("feedback-strip-bar");

const INTERNAL_ANALYSIS_DEPTH = 3;
const DEFAULT_SCORING_SYSTEM = "cp_exponential";
const DEFAULT_CITIZEN_THRESHOLD = 80;
const DEFAULT_CITIZEN_MOVETIME = 400;
const DEFAULT_CITIZEN_SESSION_SIZE = 10;
const DEFAULT_TURN_TIME_SECONDS = 90;
const CLOCK_TICK_MS = 100;
const DUEL_DEFAULT_PLAYERS = ["Jugador 1", "Jugador 2"];

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const PIECE_IMAGES = {
  P: "assets/pieces/cburnett/wP.svg",
  N: "assets/pieces/cburnett/wN.svg",
  B: "assets/pieces/cburnett/wB.svg",
  R: "assets/pieces/cburnett/wR.svg",
  Q: "assets/pieces/cburnett/wQ.svg",
  K: "assets/pieces/cburnett/wK.svg",
  p: "assets/pieces/cburnett/bP.svg",
  n: "assets/pieces/cburnett/bN.svg",
  b: "assets/pieces/cburnett/bB.svg",
  r: "assets/pieces/cburnett/bR.svg",
  q: "assets/pieces/cburnett/bQ.svg",
  k: "assets/pieces/cburnett/bK.svg",
};

const STATE = {
  allMistakes: [],
  positions: [],
  index: 0,
  board: null,
  selection: null,
  legalMoves: [],
  userMove: null,
  score: 0,
  engine: { mode: "local", worker: null, ready: false, evalCache: new Map() },
  boardPerspective: "w",
  revealed: { best: null, game: null, user: null, userAlt: null },
  historyEntries: [],
  historySelectedIdx: -1,
  analysisContext: null,
  analysisInProgress: false,
  roundSubmitted: false,
  isResolvingRound: false,
  targetPositions: 10,
  sessionPlayed: 0,
  sessionHits: 0,
  scoringSystem: DEFAULT_SCORING_SYSTEM,
  setupStep: "upload",
  setupWizardStep: 1,
  sourceMode: "file",
  localPgnSources: [],
  localPlayerGuess: { name: "", tiedTop: [] },
  remotePgnSources: [],
  userMode: "citizen",
  gameFormat: "solo",
  turnTimeSeconds: DEFAULT_TURN_TIME_SECONDS,
  timer: { intervalId: null, deadlineMs: 0, durationMs: 0 },
  duel: {
    players: [...DUEL_DEFAULT_PLAYERS],
    scores: [0, 0],
    hits: [0, 0],
    currentPlayer: 0,
    roundResults: [null, null],
  },
};

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
    this.halfmove = Number(parts[4]);
    this.fullmove = Number(parts[5]);
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

    if ((color === "w" && rights.includes("K")) || (color === "b" && rights.includes("k"))) {
      if (!this.board[rank * 8 + 5] && !this.board[rank * 8 + 6]
        && !this.isSquareAttacked(rank * 8 + 5, color) && !this.isSquareAttacked(rank * 8 + 6, color)) {
        moves.push({ from: index, to: rank * 8 + 6, piece: color === "w" ? "K" : "k", castle: "K" });
      }
    }

    if ((color === "w" && rights.includes("Q")) || (color === "b" && rights.includes("q"))) {
      if (!this.board[rank * 8 + 3] && !this.board[rank * 8 + 2] && !this.board[rank * 8 + 1]
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
}

Chess.START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// ---------- Utility ----------

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pgnFilesCount() {
  if (Array.isArray(STATE.localPgnSources) && STATE.localPgnSources.length > 0) {
    return STATE.localPgnSources.length;
  }
  return pgnInputEl && pgnInputEl.files ? pgnInputEl.files.length : 0;
}

function getLocalPgnFileSignature(file) {
  if (!file) return "";
  const name = String(file.name || "").trim();
  const size = Number(file.size) || 0;
  const modified = Number(file.lastModified) || 0;
  return `${name}::${size}::${modified}`;
}

async function appendLocalPgnFiles(filesList) {
  if (!Array.isArray(filesList) || filesList.length === 0) return 0;
  const existing = new Set(
    (Array.isArray(STATE.localPgnSources) ? STATE.localPgnSources : [])
      .map((entry) => String(entry.signature || ""))
      .filter(Boolean),
  );
  let added = 0;
  for (const file of filesList) {
    const signature = getLocalPgnFileSignature(file);
    if (!signature || existing.has(signature)) continue;
    const text = await file.text();
    STATE.localPgnSources.push({
      name: String(file.name || "archivo.pgn"),
      text,
      signature,
      games: countPgnGames(text),
    });
    existing.add(signature);
    added += 1;
  }
  return added;
}

function clearLocalPgnSources() {
  STATE.localPgnSources = [];
  STATE.localPlayerGuess = { name: "", tiedTop: [] };
}

function removeLocalPgnSource(signature) {
  if (!signature) return;
  STATE.localPgnSources = STATE.localPgnSources.filter((entry) => String(entry.signature || "") !== String(signature));
  if (STATE.localPgnSources.length === 0) {
    STATE.localPlayerGuess = { name: "", tiedTop: [] };
  }
}

function localPgnGamesCount() {
  if (!Array.isArray(STATE.localPgnSources) || STATE.localPgnSources.length === 0) return 0;
  return STATE.localPgnSources.reduce((acc, entry) => acc + (Number(entry.games) || countPgnGames(entry.text)), 0);
}

function refreshLocalPlayerGuess() {
  const sources = Array.isArray(STATE.localPgnSources) ? STATE.localPgnSources : [];
  if (sources.length === 0) {
    STATE.localPlayerGuess = { name: "", tiedTop: [] };
    return STATE.localPlayerGuess;
  }

  const map = new Map();
  sources.forEach((source) => {
    splitGamesFromText(source.text).forEach((gameText) => {
      const tags = parseTags(gameText);
      [tags.White, tags.Black].forEach((raw) => {
        const clean = cleanTagValue(raw);
        if (!clean) return;
        map.set(clean, (map.get(clean) || 0) + 1);
      });
    });
  });

  const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    STATE.localPlayerGuess = { name: "", tiedTop: [] };
    return STATE.localPlayerGuess;
  }

  const topScore = sorted[0][1];
  const tiedTop = sorted.filter(([, count]) => count === topScore).map(([name]) => name);
  STATE.localPlayerGuess = { name: sorted[0][0], tiedTop };
  return STATE.localPlayerGuess;
}

function renderLocalPgnLibrary() {
  if (!pgnLibraryEl || !pgnLibraryListEl) return;
  const list = Array.isArray(STATE.localPgnSources) ? STATE.localPgnSources : [];
  if (list.length === 0) {
    pgnLibraryEl.classList.add("hidden");
    pgnLibraryListEl.innerHTML = "";
    return;
  }
  pgnLibraryEl.classList.remove("hidden");
  pgnLibraryListEl.innerHTML = list
    .map((entry) => {
      const name = escapeHtml(entry.name || "archivo.pgn");
      const games = Number(entry.games) || countPgnGames(entry.text);
      const gamesLabel = `${games} partida(s)`;
      const signature = encodeURIComponent(String(entry.signature || ""));
      return `<li class="pgn-item">
        <span class="pgn-item-name" title="${name}">${name}</span>
        <span class="pgn-item-games">${gamesLabel}</span>
        <button type="button" class="pgn-remove-btn" data-pgn-remove="${signature}">Quitar</button>
      </li>`;
    })
    .join("");
}

function countPgnGames(pgnText) {
  if (!pgnText) return 0;
  const matches = pgnText.match(/(^|\n)\[Event\s+"/g);
  return matches ? matches.length : 0;
}

function isRemoteSourceMode(mode = STATE.sourceMode) {
  return mode === "lichess" || mode === "chesscom";
}

function getRemoteProvider(entry) {
  if (!entry) return "";
  return String(entry.provider || "lichess");
}

function getRemoteProviderModeFromUi() {
  if (!onlineProviderSelectEl) return "lichess";
  return onlineProviderSelectEl.value === "chesscom" ? "chesscom" : "lichess";
}

function updateOnlineProviderUi() {
  if (!onlineUserInputEl) return;
  onlineUserInputEl.placeholder = getRemoteProviderModeFromUi() === "chesscom"
    ? "Ej: Hikaru"
    : "Ej: MagnusCarlsen";
}

function getConfiguredRemoteUsername() {
  return String(onlineUserInputEl ? onlineUserInputEl.value : "").trim();
}

function hasAnyPgnSource(requireDownloadedRemote = false) {
  if (isRemoteSourceMode()) {
    if (!requireDownloadedRemote) {
      return getConfiguredRemoteUsername().length > 0;
    }
    const remote = STATE.remotePgnSources[0];
    if (!remote) return false;
    return getRemoteProvider(remote) === STATE.sourceMode;
  }
  return pgnFilesCount() > 0;
}

function sourceModeLabel(mode = STATE.sourceMode) {
  if (mode === "lichess") return "Base online (Lichess)";
  if (mode === "chesscom") return "Base online (Chess.com)";
  return "Archivo PGN";
}

function setUploadWizardStep(step) {
  const safeStep = clamp(Number(step) || 1, 1, 2);
  STATE.setupWizardStep = safeStep;
  if (wizardStepModeEl) wizardStepModeEl.classList.add("hidden");
  if (wizardStepSourceEl) wizardStepSourceEl.classList.toggle("hidden", safeStep !== 1);
  if (wizardStepDataEl) wizardStepDataEl.classList.toggle("hidden", safeStep !== 2);
  if (setupWizardProgressLabelEl) setupWizardProgressLabelEl.textContent = `Paso ${safeStep} de 3`;
  if (setupWizardProgressBarEl) {
    const pct = safeStep === 1 ? 33 : 66;
    setupWizardProgressBarEl.style.width = `${pct}%`;
  }
  updateSetupCognitiveMode();
}

function setSourceMode(mode) {
  const nextMode = mode === "lichess" || mode === "chesscom" ? mode : "file";
  if (nextMode !== "file" && STATE.remotePgnSources.length > 0) {
    const provider = getRemoteProvider(STATE.remotePgnSources[0]);
    if (provider !== nextMode) {
      clearRemotePgnSources();
    }
  }
  STATE.sourceMode = nextMode;
  if (sourceFilePanelEl) sourceFilePanelEl.classList.toggle("hidden", nextMode !== "file");
  if (sourceOnlinePanelEl) sourceOnlinePanelEl.classList.toggle("hidden", !isRemoteSourceMode(nextMode));
  if (sourceFileBtn) sourceFileBtn.classList.toggle("active", nextMode === "file");
  if (sourceOnlineBtn) sourceOnlineBtn.classList.toggle("active", isRemoteSourceMode(nextMode));
  if (onlineProviderSelectEl && isRemoteSourceMode(nextMode)) {
    onlineProviderSelectEl.value = nextMode;
  }
  updateOnlineProviderUi();
  if (sourceSelectedHintEl) sourceSelectedHintEl.textContent = `Fuente elegida: ${sourceModeLabel(nextMode)}.`;
}

function clearRemotePgnSources() {
  STATE.remotePgnSources = [];
}

function showSourceNeedsRedownloadMessage(message) {
  if (!isRemoteSourceMode()) return;
  if (onlineStatusEl) onlineStatusEl.textContent = message;
}

function modeLabel(mode = STATE.userMode) {
  return mode === "engineer" ? "Opciones detalladas" : "Opciones básicas";
}

function updateSetupCognitiveMode() {
  const compact = STATE.setupStep === "config"
    || (STATE.setupStep === "upload" && Number(STATE.setupWizardStep) > 1);
  document.body.classList.toggle("setup-minimal", compact);
}

function normalizeGameFormat(value) {
  return value === "duel" ? "duel" : "solo";
}

function isDuelMode() {
  return STATE.gameFormat === "duel";
}

function sanitizePlayerName(value, fallback) {
  const cleaned = String(value || "").trim().replace(/\s+/g, " ");
  return cleaned || fallback;
}

function duelPlayerName(index) {
  const fallback = DUEL_DEFAULT_PLAYERS[index] || `Jugador ${index + 1}`;
  return sanitizePlayerName(STATE.duel.players[index], fallback);
}

function formatClock(remainingMs) {
  const clamped = Math.max(0, Math.round(remainingMs));
  const totalSeconds = Math.ceil(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function setThinkingMode(active) {
  document.body.classList.toggle("thinking-mode", Boolean(active));
}

function setScoringInfoVisible(visible) {
  const show = Boolean(visible);
  if (scorePanelEl) scorePanelEl.classList.toggle("hidden", !show);
  if (competitiveStatusEl) competitiveStatusEl.classList.toggle("hidden", !show);
}

function updateFeedbackStrip(scored, bestMover, userMover, playerLabel = "") {
  if (!feedbackStripEl || !feedbackStripBarEl || !feedbackStripQualityEl || !feedbackStripDeltaEl || !feedbackStripPointsEl) return;
  if (!scored) {
    feedbackStripEl.classList.add("hidden");
    return;
  }
  const accuracy = Number.isFinite(scored.diff)
    ? clamp(Math.round(100 * Math.exp(-scored.diff / 240)), 0, 100)
    : 0;
  const deltaLabel = formatDelta(bestMover, userMover);
  const prefix = playerLabel ? `${playerLabel}: ` : "";
  feedbackStripQualityEl.textContent = `${prefix}${scored.qualityLabel}`;
  feedbackStripDeltaEl.textContent = `Delta ${deltaLabel}`;
  feedbackStripPointsEl.textContent = `${formatSigned(scored.points)} pts`;
  feedbackStripBarEl.style.width = `${accuracy}%`;
  feedbackStripEl.classList.remove("tone-good", "tone-mid", "tone-low");
  if (accuracy >= 72) feedbackStripEl.classList.add("tone-good");
  else if (accuracy >= 42) feedbackStripEl.classList.add("tone-mid");
  else feedbackStripEl.classList.add("tone-low");
  feedbackStripEl.classList.remove("hidden");
}

function hideFeedbackStrip() {
  if (!feedbackStripEl) return;
  feedbackStripEl.classList.add("hidden");
}

function currentTurnLabel() {
  if (!STATE.board) return "-";
  return STATE.board.turn === "w" ? "Blancas" : "Negras";
}

function orientationLabel() {
  return STATE.boardPerspective === "b" ? "Negras abajo" : "Blancas abajo";
}

function scoreSignalText() {
  if (isDuelMode()) {
    const p1 = duelPlayerName(0);
    const p2 = duelPlayerName(1);
    return `${p1} ${STATE.duel.scores[0]} - ${STATE.duel.scores[1]} ${p2}`;
  }
  return `${STATE.score} pts`;
}

function updateDecisionSignals() {
  if (turnSignalEl) turnSignalEl.textContent = currentTurnLabel();
  if (orientationSignalEl) orientationSignalEl.textContent = orientationLabel();
  if (scoreSignalEl) scoreSignalEl.textContent = scoreSignalText();
}

function updateScoreDisplay() {
  if (!scoreEl) return;
  if (isDuelMode()) {
    if (scoreLabelEl) scoreLabelEl.textContent = "Marcador duelo";
    const p1 = duelPlayerName(0);
    const p2 = duelPlayerName(1);
    scoreEl.textContent = `${p1}: ${STATE.duel.scores[0]} | ${p2}: ${STATE.duel.scores[1]}`;
    updateDecisionSignals();
    return;
  }
  if (scoreLabelEl) scoreLabelEl.textContent = "Puntos totales";
  scoreEl.textContent = String(STATE.score);
  updateDecisionSignals();
}

function updateCompetitiveStatus() {
  if (!competitiveStatusEl) return;
  const t = clamp(Number(STATE.turnTimeSeconds) || DEFAULT_TURN_TIME_SECONDS, 5, 300);
  const system = scoringSystemLabel(STATE.scoringSystem);
  if (!isDuelMode()) {
    competitiveStatusEl.textContent = `Modo Estudio · ${t}s por posición · ${system}`;
    return;
  }
  competitiveStatusEl.textContent = `Duelo local · ${t}s por turno · ${system}`;
}

function resetDuelState() {
  STATE.duel.scores = [0, 0];
  STATE.duel.hits = [0, 0];
  STATE.duel.currentPlayer = 0;
  STATE.duel.roundResults = [null, null];
}

function applyGameFormat(format) {
  const safe = normalizeGameFormat(format);
  STATE.gameFormat = safe;
  if (gameFormatEl) gameFormatEl.value = safe;
  if (duelConfigEl) duelConfigEl.classList.toggle("hidden", safe !== "duel");
  if (gameFormatHintEl) {
    gameFormatHintEl.textContent = safe === "duel"
      ? "Competitivo local: ambos jugadores reciben exactamente las mismas posiciones y tiempo."
      : "Entrenamiento individual con puntaje total acumulado.";
  }
  document.body.classList.toggle("duel-mode", safe === "duel");
  if (safe !== "duel") {
    resetDuelState();
  }
  updateScoreDisplay();
  updateCompetitiveStatus();
  renderSessionProgress();
}

function readSessionTimingConfig() {
  const seconds = clamp(Number(turnTimeSecondsEl ? turnTimeSecondsEl.value : DEFAULT_TURN_TIME_SECONDS) || DEFAULT_TURN_TIME_SECONDS, 5, 300);
  STATE.turnTimeSeconds = seconds;
  if (turnTimeSecondsEl) turnTimeSecondsEl.value = String(seconds);
}

function readDuelPlayersFromInputs() {
  STATE.duel.players = [
    sanitizePlayerName(duelPlayerAEl ? duelPlayerAEl.value : "", DUEL_DEFAULT_PLAYERS[0]),
    sanitizePlayerName(duelPlayerBEl ? duelPlayerBEl.value : "", DUEL_DEFAULT_PLAYERS[1]),
  ];
  if (duelPlayerAEl) duelPlayerAEl.value = STATE.duel.players[0];
  if (duelPlayerBEl) duelPlayerBEl.value = STATE.duel.players[1];
}

function stopRoundTimer() {
  if (STATE.timer.intervalId) {
    clearInterval(STATE.timer.intervalId);
    STATE.timer.intervalId = null;
  }
}

function updateRoundTimerUi(remainingMs = STATE.timer.deadlineMs - Date.now()) {
  if (!turnTimerEl || !turnTimerValueEl || !turnTimerBarEl) return;
  const duration = Math.max(1, STATE.timer.durationMs || Math.round(STATE.turnTimeSeconds * 1000));
  const safeRemaining = Math.max(0, remainingMs);
  const ratio = clamp(safeRemaining / duration, 0, 1);
  turnTimerValueEl.textContent = formatClock(safeRemaining);
  turnTimerBarEl.style.width = `${Math.round(ratio * 100)}%`;
  turnTimerEl.classList.remove("urgency-mid", "urgency-high");
  if (ratio <= 0.2) {
    turnTimerEl.classList.add("urgency-high");
  } else if (ratio <= 0.45) {
    turnTimerEl.classList.add("urgency-mid");
  }
}

function startRoundTimer() {
  stopRoundTimer();
  const durationMs = Math.round(clamp(Number(STATE.turnTimeSeconds) || DEFAULT_TURN_TIME_SECONDS, 5, 300) * 1000);
  STATE.timer.durationMs = durationMs;
  STATE.timer.deadlineMs = Date.now() + durationMs;
  updateRoundTimerUi(durationMs);
  STATE.timer.intervalId = setInterval(() => {
    const remainingMs = STATE.timer.deadlineMs - Date.now();
    if (remainingMs <= 0) {
      updateRoundTimerUi(0);
      stopRoundTimer();
      if (!STATE.roundSubmitted && !STATE.isResolvingRound) {
        void submitNoMove("timeout");
      }
      return;
    }
    updateRoundTimerUi(remainingMs);
  }, CLOCK_TICK_MS);
}

function setUserMode(mode) {
  const safe = mode === "engineer" ? "engineer" : "citizen";
  const previous = STATE.userMode;
  STATE.userMode = safe;
  document.body.classList.toggle("mode-engineer", safe === "engineer");
  document.body.classList.toggle("mode-citizen", safe === "citizen");
  modeLevelSwitchEls.forEach((toggleEl) => {
    toggleEl.checked = safe === "engineer";
  });
  modeSwitchNormalEls.forEach((labelEl) => {
    labelEl.classList.toggle("active", safe === "citizen");
  });
  modeSwitchEngineerEls.forEach((labelEl) => {
    labelEl.classList.toggle("active", safe === "engineer");
  });

  if (safe === "citizen") {
    if (thresholdEl) thresholdEl.value = String(DEFAULT_CITIZEN_THRESHOLD);
    if (analysisTimeMsEl) analysisTimeMsEl.value = String(DEFAULT_CITIZEN_MOVETIME);
    if (scoringSystemEl) scoringSystemEl.value = DEFAULT_SCORING_SYSTEM;
    if (sessionSizeEl && (!Number.isFinite(Number(sessionSizeEl.value)) || Number(sessionSizeEl.value) <= 0)) {
      sessionSizeEl.value = String(DEFAULT_CITIZEN_SESSION_SIZE);
    }
    if (turnTimeSecondsEl && (!Number.isFinite(Number(turnTimeSecondsEl.value)) || Number(turnTimeSecondsEl.value) < 5)) {
      turnTimeSecondsEl.value = String(DEFAULT_TURN_TIME_SECONDS);
    }
  }

  if (previous && previous !== safe && isRemoteSourceMode() && STATE.remotePgnSources.length > 0) {
    clearRemotePgnSources();
    showSourceNeedsRedownloadMessage("Modo cambiado. La base online se descargará de nuevo al comenzar.");
  }

  updatePgnSelectionUi();
}

function getLichessFetchSettings() {
  const targetPositions = clamp(
    Number(sessionSizeEl ? sessionSizeEl.value : DEFAULT_CITIZEN_SESSION_SIZE) || DEFAULT_CITIZEN_SESSION_SIZE,
    1,
    200,
  );
  if (sessionSizeEl) sessionSizeEl.value = String(targetPositions);
  const maxGames = clamp(Math.round(targetPositions * 5), 20, 300);

  if (STATE.userMode === "citizen") {
    const minSlowGames = clamp(Math.min(Math.max(12, Math.round(targetPositions * 2)), maxGames), 1, maxGames);
    return {
      maxGames,
      preferredPerf: ["classical", "rapid"],
      minSlowGames,
      fallbackBlitz: true,
    };
  }

  const preferredPerf = ["classical", "rapid"];
  const minSlowRaw = Number(onlineMinSlowGamesEl ? onlineMinSlowGamesEl.value : Math.max(12, Math.round(targetPositions * 2)))
    || Math.max(12, Math.round(targetPositions * 2));
  const minSlowGames = clamp(minSlowRaw, 1, maxGames);
  if (onlineMinSlowGamesEl) onlineMinSlowGamesEl.value = String(minSlowGames);

  const fallbackBlitz = !onlineFallbackBlitzEl || onlineFallbackBlitzEl.checked;

  return { maxGames, preferredPerf, minSlowGames, fallbackBlitz };
}

function describeLichessPlan(settings = getLichessFetchSettings()) {
  const preferredLabel = settings.preferredPerf.map((p) => p[0].toUpperCase() + p.slice(1)).join("/");
  if (settings.fallbackBlitz) {
    return `Plan: partidas públicas de los últimos 12 meses en ${preferredLabel}. Si no llega a ${settings.minSlowGames}, se completa con Blitz hasta ${settings.maxGames}.`;
  }
  return `Plan: partidas públicas de los últimos 12 meses en ${preferredLabel}, sin fallback a Blitz. Objetivo: hasta ${settings.maxGames}.`;
}

function describeLichessNormalProtocol(settings = getLichessFetchSettings()) {
  const preferredLabel = settings.preferredPerf.map((p) => p[0].toUpperCase() + p.slice(1)).join("/");
  return `Protocolo modo normal: se descargan partidas públicas del último año. Primero ${preferredLabel}; si no llega a ${settings.minSlowGames}, se completa con Blitz hasta ${settings.maxGames}.`;
}

function getChessComFetchSettings() {
  const targetPositions = clamp(
    Number(sessionSizeEl ? sessionSizeEl.value : DEFAULT_CITIZEN_SESSION_SIZE) || DEFAULT_CITIZEN_SESSION_SIZE,
    1,
    200,
  );
  if (sessionSizeEl) sessionSizeEl.value = String(targetPositions);
  const maxGames = clamp(Math.round(targetPositions * 5), 20, 300);

  if (STATE.userMode === "citizen") {
    const minSlowGames = clamp(Math.min(Math.max(12, Math.round(targetPositions * 2)), maxGames), 1, maxGames);
    return {
      maxGames,
      preferredSlowClasses: ["rapid", "daily"],
      minSlowGames,
      fallbackBlitz: true,
    };
  }

  const preferredSlowClasses = ["rapid", "daily"];
  const minSlowRaw = Number(onlineMinSlowGamesEl ? onlineMinSlowGamesEl.value : Math.max(12, Math.round(targetPositions * 2)))
    || Math.max(12, Math.round(targetPositions * 2));
  const minSlowGames = clamp(minSlowRaw, 1, maxGames);
  if (onlineMinSlowGamesEl) onlineMinSlowGamesEl.value = String(minSlowGames);

  const fallbackBlitz = !onlineFallbackBlitzEl || onlineFallbackBlitzEl.checked;
  return { maxGames, preferredSlowClasses, minSlowGames, fallbackBlitz };
}

function describeChessComPlan(settings = getChessComFetchSettings()) {
  const preferredLabel = settings.preferredSlowClasses.map((p) => p[0].toUpperCase() + p.slice(1)).join("/");
  if (settings.fallbackBlitz) {
    return `Plan: partidas públicas de los últimos 12 meses en ${preferredLabel}. Si no llega a ${settings.minSlowGames}, se completa con Blitz hasta ${settings.maxGames}.`;
  }
  return `Plan: partidas públicas de los últimos 12 meses en ${preferredLabel}, sin fallback a Blitz. Objetivo: hasta ${settings.maxGames}.`;
}

function describeChessComNormalProtocol(settings = getChessComFetchSettings()) {
  const preferredLabel = settings.preferredSlowClasses.map((p) => p[0].toUpperCase() + p.slice(1)).join("/");
  return `Protocolo modo normal: se descargan partidas públicas del último año desde archivos mensuales. Primero ${preferredLabel}; si no llega a ${settings.minSlowGames}, se completa con Blitz hasta ${settings.maxGames}.`;
}

function getEffectiveAnalysisConfig() {
  if (STATE.userMode === "citizen") {
    return {
      moveTimeMs: DEFAULT_CITIZEN_MOVETIME,
      thresholdCp: DEFAULT_CITIZEN_THRESHOLD,
      scoringSystem: DEFAULT_SCORING_SYSTEM,
    };
  }
  return {
    moveTimeMs: clamp(Number(analysisTimeMsEl.value) || DEFAULT_CITIZEN_MOVETIME, 50, 10000),
    thresholdCp: clamp(Number(thresholdEl.value) || DEFAULT_CITIZEN_THRESHOLD, 50, 800),
    scoringSystem: normalizeScoringSystem(scoringSystemEl ? scoringSystemEl.value : DEFAULT_SCORING_SYSTEM),
  };
}

function updatePgnSelectionUi() {
  const filesCount = pgnFilesCount();
  const localGames = localPgnGamesCount();
  const hasRemote = isRemoteSourceMode() && hasAnyPgnSource(true);
  const remote = hasRemote ? STATE.remotePgnSources[0] : null;
  const lichessSettings = getLichessFetchSettings();
  const chessComSettings = getChessComFetchSettings();
  const remoteUser = getConfiguredRemoteUsername();
  if (sourceSelectedHintEl) sourceSelectedHintEl.textContent = `Fuente elegida: ${sourceModeLabel()}.`;

  if (STATE.sourceMode === "file") {
    pgnHintEl.textContent = filesCount > 0
      ? `${filesCount} archivo(s) cargados | ${localGames} partida(s) detectadas.`
      : "Sin archivos seleccionados.";
  } else {
    pgnHintEl.textContent = filesCount > 0
      ? `${filesCount} archivo(s) seleccionados (no activos).`
      : "Sin archivos seleccionados.";
  }
  renderLocalPgnLibrary();

  if (onlinePlanSummaryEl && isRemoteSourceMode()) {
    onlinePlanSummaryEl.textContent = STATE.sourceMode === "chesscom"
      ? describeChessComPlan(chessComSettings)
      : describeLichessPlan(lichessSettings);
  }
  if (onlineNormalProtocolEl && isRemoteSourceMode()) {
    onlineNormalProtocolEl.textContent = STATE.sourceMode === "chesscom"
      ? describeChessComNormalProtocol(chessComSettings)
      : describeLichessNormalProtocol(lichessSettings);
  }
  if (onlineStatusEl && isRemoteSourceMode() && !hasRemote) {
    if (!remoteUser) {
      onlineStatusEl.textContent = "Ingresá tu usuario para continuar.";
    } else if (STATE.userMode === "citizen") {
      onlineStatusEl.textContent = STATE.sourceMode === "chesscom"
        ? describeChessComNormalProtocol(chessComSettings)
        : describeLichessNormalProtocol(lichessSettings);
    } else {
      const settings = STATE.sourceMode === "chesscom" ? chessComSettings : lichessSettings;
      onlineStatusEl.textContent = `Se descargarán hasta ${settings.maxGames} partidas automáticamente al comenzar la sesión.`;
    }
  }

  if (configFilesStatusEl) {
    if (STATE.sourceMode === "lichess" && hasRemote) {
      const games = Number.isFinite(remote.games) ? remote.games : 0;
      const slowGames = Number.isFinite(remote?.detail?.slow) ? remote.detail.slow : null;
      const blitzGames = Number.isFinite(remote?.detail?.blitz) ? remote.detail.blitz : null;
      if (Number.isFinite(slowGames) && Number.isFinite(blitzGames)) {
        configFilesStatusEl.textContent = `Fuente: Lichess (${remote.username}) | ${games} partida(s): ${slowGames} lentas + ${blitzGames} blitz.`;
      } else {
        const gamesText = games > 0 ? `${games} partida(s)` : "partidas";
        configFilesStatusEl.textContent = `Fuente: Lichess (${remote.username}) | ${gamesText} cargadas.`;
      }
    } else if (STATE.sourceMode === "chesscom" && hasRemote) {
      const games = Number.isFinite(remote.games) ? remote.games : 0;
      const slowGames = Number.isFinite(remote?.detail?.slow) ? remote.detail.slow : null;
      const blitzGames = Number.isFinite(remote?.detail?.blitz) ? remote.detail.blitz : null;
      if (Number.isFinite(slowGames) && Number.isFinite(blitzGames)) {
        configFilesStatusEl.textContent = `Fuente: Chess.com (${remote.username}) | ${games} partida(s): ${slowGames} lentas + ${blitzGames} blitz.`;
      } else {
        const gamesText = games > 0 ? `${games} partida(s)` : "partidas";
        configFilesStatusEl.textContent = `Fuente: Chess.com (${remote.username}) | ${gamesText} cargadas.`;
      }
    } else if (isRemoteSourceMode() && remoteUser) {
      configFilesStatusEl.textContent = "";
    } else if (isRemoteSourceMode()) {
      configFilesStatusEl.textContent = "";
    } else {
      configFilesStatusEl.textContent = `PGN cargados: ${filesCount} archivo(s) | ${localGames} partida(s).`;
    }
  }

  if (playerNameDetectedEl && playerTargetLabelEl && playerTargetHintEl) {
    if (isRemoteSourceMode()) {
      playerTargetLabelEl.textContent = "Usuario objetivo del análisis";
      if (hasRemote && remote?.username) {
        playerNameDetectedEl.textContent = String(remote.username);
        playerTargetHintEl.textContent = "Se usa este usuario como referencia para seleccionar jugadas.";
      } else if (remoteUser) {
        playerNameDetectedEl.textContent = remoteUser;
        playerTargetHintEl.textContent = "Se usará este usuario al preparar automáticamente la base online.";
      } else {
        playerNameDetectedEl.textContent = "Ingresá el usuario en el paso anterior.";
        playerTargetHintEl.textContent = "Cuando completes el usuario, se tomará como referencia de análisis.";
      }
    } else {
      playerTargetLabelEl.textContent = "Jugador detectado automáticamente";
      const guess = refreshLocalPlayerGuess();
      if (guess.name) {
        playerNameDetectedEl.textContent = guess.name;
        if (Array.isArray(guess.tiedTop) && guess.tiedTop.length > 1) {
          const tiedLabel = guess.tiedTop.slice(0, 3).join(", ");
          playerTargetHintEl.textContent = `Empate en frecuencia (${tiedLabel}). Se usará ${guess.name} salvo que cambie la base.`;
        } else {
          playerTargetHintEl.textContent = "Detectado al cargar PGN: se usa el nombre más repetido entre blancas y negras.";
        }
      } else {
        playerNameDetectedEl.textContent = "Se detectará al cargar los PGN.";
        playerTargetHintEl.textContent = "Se toma el nombre que más se repite entre blancas y negras.";
      }
    }
  }

  if (goConfigBtn) {
    goConfigBtn.disabled = !hasAnyPgnSource(false);
  }
}

function setConfigPreparationProgress(stage = "config", analysisPct = 0) {
  if (!configPrepProgressBarEl || !configPrepProgressLabelEl || !configPrepProgressHintEl) return;
  const safeStage = stage === "analyzing" || stage === "ready" ? stage : "config";
  if (safeStage === "config") {
    configPrepProgressBarEl.style.width = "100%";
    configPrepProgressLabelEl.textContent = "Paso 3 de 3";
    configPrepProgressHintEl.textContent = "Revisá ajustes y comenzá la sesión.";
    return;
  }
  if (safeStage === "analyzing") {
    const normalized = clamp(Number(analysisPct) || 0, 0, 100);
    const visualPct = Math.round((55 + (normalized / 100) * 45) * 100) / 100;
    configPrepProgressBarEl.style.width = `${visualPct}%`;
    configPrepProgressLabelEl.textContent = "Paso 3 de 3";
    configPrepProgressHintEl.textContent = `Preparando posiciones para la sesión (${Math.round(normalized)}%).`;
    return;
  }
  configPrepProgressBarEl.style.width = "100%";
  configPrepProgressLabelEl.textContent = "Paso 3 de 3";
  configPrepProgressHintEl.textContent = "Primera posición lista. Iniciando partida.";
}

function setLandingNote(message) {
  if (!landingNoteEl) return;
  landingNoteEl.textContent = String(message || "").trim() || "Elegí un modo para empezar.";
}

function showLandingScreen(note = "") {
  if (landingScreenEl) {
    landingScreenEl.classList.remove("hidden");
    landingScreenEl.style.display = "";
  }
  document.body.classList.add("landing-active");
  if (setupPanelEl) {
    setupPanelEl.classList.add("hidden");
    setupPanelEl.style.display = "";
  }
  setLandingNote(note);
}

function openSetupFromLanding({ format = null, wizardStep = 1, statusMessage = "" } = {}) {
  if (landingScreenEl) {
    landingScreenEl.classList.add("hidden");
    landingScreenEl.style.display = "none";
  }
  document.body.classList.remove("landing-active");
  if (setupPanelEl) {
    setupPanelEl.classList.remove("hidden");
    setupPanelEl.style.display = "grid";
  }
  setSetupStep("upload");
  setUploadWizardStep(clamp(Number(wizardStep) || 1, 1, 2));
  // Hard guard: always land in upload/source flow after choosing Study/Duel.
  if (setupStepUploadEl) setupStepUploadEl.classList.remove("hidden");
  if (setupStepConfigEl) setupStepConfigEl.classList.add("hidden");
  if (wizardStepSourceEl) wizardStepSourceEl.classList.remove("hidden");
  if (wizardStepDataEl) wizardStepDataEl.classList.add("hidden");
  if (setupWizardProgressLabelEl) setupWizardProgressLabelEl.textContent = "Paso 1 de 3";
  if (setupWizardProgressBarEl) setupWizardProgressBarEl.style.width = "33%";
  STATE.setupStep = "upload";
  STATE.setupWizardStep = 1;
  if (format) {
    const normalized = normalizeGameFormat(format);
    if (gameFormatEl) gameFormatEl.value = normalized;
    applyGameFormat(normalized);
  }
  if (statusMessage && analysisStatusEl) {
    analysisStatusEl.textContent = statusMessage;
  }
  window.scrollTo({ top: 0, behavior: "auto" });
  updatePgnSelectionUi();
}

function startStudyFromLanding() {
  setUserMode("citizen");
  openSetupFromLanding({
    format: "solo",
    wizardStep: 1,
    statusMessage: "Modo Estudio listo. Elegí fuente para continuar.",
  });
}

function startDuelFromLanding() {
  setUserMode("citizen");
  openSetupFromLanding({
    format: "duel",
    wizardStep: 1,
    statusMessage: "Duelo de Caballeros listo. Elegí fuente para continuar.",
  });
}

function openOptionsFromLanding() {
  openSetupFromLanding({
    wizardStep: 1,
    statusMessage: "Configurá modo, fuente y opciones de análisis.",
  });
}

function showHistoryFromLanding() {
  const rounds = Array.isArray(STATE.historyEntries) ? STATE.historyEntries.length : 0;
  if (rounds > 0) {
    setLandingNote(`Historial actual: ${rounds} ronda(s) en esta sesión. Iniciá un modo para seguir sumando partidas.`);
  } else {
    setLandingNote("Todavía no hay historial en esta sesión. Jugá una partida para empezar a registrarlo.");
  }
}

window.startStudyFromLanding = startStudyFromLanding;
window.startDuelFromLanding = startDuelFromLanding;
window.openOptionsFromLanding = openOptionsFromLanding;
window.showHistoryFromLanding = showHistoryFromLanding;

function setSetupStep(step) {
  const safeStep = step === "config" ? "config" : "upload";
  STATE.setupStep = safeStep;
  if (setupStepUploadEl) setupStepUploadEl.classList.toggle("hidden", safeStep !== "upload");
  if (setupStepConfigEl) setupStepConfigEl.classList.toggle("hidden", safeStep !== "config");
  if (safeStep === "upload") {
    setUploadWizardStep(1);
  } else {
    updateSetupCognitiveMode();
  }
  setConfigPreparationProgress("config");
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function yieldToUi() {
  await sleepMs(0);
}

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
  if (move.castle === "K") return "O-O";
  if (move.castle === "Q") return "O-O-O";
  const piece = move.piece.toUpperCase();
  const destination = Chess.indexToSquare(move.to);
  const capture = move.capture || move.enPassant ? "x" : "";
  const promo = move.promotion ? `=${move.promotion.toUpperCase()}` : "";
  if (piece === "P") {
    const file = files[move.from % 8];
    return `${capture ? file : ""}${capture}${destination}${promo}`;
  }
  return `${piece}${capture}${destination}${promo}`;
}

function toMoverScore(whiteScore, moverTurn) {
  return moverTurn === "w" ? whiteScore : -whiteScore;
}

function decodeEvaluation(moverScore) {
  if (!Number.isFinite(moverScore)) return null;
  const abs = Math.abs(moverScore);
  if (abs >= 90000) {
    const mateDistance = Math.max(1, Math.round((100000 - abs) / 1000));
    return { kind: "mate", matePly: moverScore >= 0 ? mateDistance : -mateDistance, score: moverScore };
  }
  return { kind: "cp", cp: Math.round(moverScore), score: moverScore };
}

function evaluationToText(evalObj) {
  if (!evalObj) return "No disponible";
  if (evalObj.kind === "cp") {
    const cp = Math.round(evalObj.cp);
    const sign = cp > 0 ? "+" : "";
    return `${sign}${cp} cp`;
  }
  return evalObj.matePly > 0 ? `Mate en ${evalObj.matePly}` : `Recibe mate en ${Math.abs(evalObj.matePly)}`;
}

const SCORING_SYSTEMS = {
  cp_exponential: {
    label: "Centipawns (curva suave)",
    description: "Puntaje 0..100 con curva exponencial según cp perdidos vs la mejor del módulo.",
  },
  cp_linear: {
    label: "Centipawns (lineal)",
    description: "Puntaje 0..100 lineal: 0 cp = 100, 400 cp o más = 0.",
  },
  cp_labels: {
    label: "Etiquetas por centipawns",
    description: "Clasifica por calidad (muy buena, buena, dudosa, mala, blunder) y puede restar puntos.",
  },
  expected_points_labels: {
    label: "Etiquetas por expected points",
    description: "Usa pérdida de expected points (estilo Lichess/Chess.com) y la convierte en etiquetas + puntos.",
  },
  exact_best: {
    label: "Priorizar jugada exacta",
    description: "Premia fuerte la jugada exacta del módulo; las alternativas puntúan mucho menos.",
  },
};

const WIN_CHANCE_MULTIPLIER = -0.00368208;

function normalizeScoringSystem(value) {
  return SCORING_SYSTEMS[value] ? value : DEFAULT_SCORING_SYSTEM;
}

function getScoringSystemMeta(value) {
  return SCORING_SYSTEMS[normalizeScoringSystem(value)];
}

function scoringSystemLabel(value) {
  return getScoringSystemMeta(value).label;
}

function updateScoringSystemHint() {
  if (!scoringSystemHintEl) return;
  scoringSystemHintEl.textContent = getScoringSystemMeta(STATE.scoringSystem).description;
}

function formatSigned(value) {
  if (!Number.isFinite(value)) return "-";
  const n = Math.round(value);
  if (n > 0) return `+${n}`;
  return String(n);
}

function formatExpectedLoss(value) {
  if (!Number.isFinite(value)) return "No disponible";
  return `${(value * 100).toFixed(1)}%`;
}

function pointsFromLossExponential(loss) {
  if (!Number.isFinite(loss)) return 0;
  return clamp(Math.round(100 * Math.exp(-loss / 260)), 0, 100);
}

function pointsFromLossLinear(loss) {
  if (!Number.isFinite(loss)) return 0;
  return clamp(Math.round(100 - (loss * 100) / 400), 0, 100);
}

function scoreToWinningChance(score) {
  if (!Number.isFinite(score)) return null;
  const abs = Math.abs(score);
  if (abs >= 90000) {
    const mateDistance = Math.max(1, Math.round((100000 - abs) / 1000));
    const cp = (21 - Math.min(10, mateDistance)) * 100;
    const signed = cp * (score >= 0 ? 1 : -1);
    return 2 / (1 + Math.exp(WIN_CHANCE_MULTIPLIER * signed)) - 1;
  }
  const limitedCp = clamp(score, -1000, 1000);
  return 2 / (1 + Math.exp(WIN_CHANCE_MULTIPLIER * limitedCp)) - 1;
}

function scoreToExpectedPoints(score) {
  const chance = scoreToWinningChance(score);
  if (!Number.isFinite(chance)) return null;
  return (chance + 1) / 2;
}

function cpQualityLabel(loss, exactBest = false) {
  if (exactBest) return "Mejor (exacta)";
  if (!Number.isFinite(loss)) return "Sin jugada";
  if (loss <= 1) return "Mejor equivalente";
  if (loss <= 20) return "Muy buena";
  if (loss <= 60) return "Buena";
  if (loss <= 120) return "Dudosa";
  if (loss <= 220) return "Mala";
  return "Blunder";
}

function computeLossAgainstBest(bestMoverScore, choiceMoverScore) {
  if (!Number.isFinite(choiceMoverScore)) {
    return { loss: Number.POSITIVE_INFINITY, diff: null, reason: "Sin jugada", best: null, choice: null };
  }
  const best = decodeEvaluation(bestMoverScore);
  const choice = decodeEvaluation(choiceMoverScore);
  if (!best || !choice) {
    return { loss: 2000, diff: null, reason: "Evaluación inválida", best, choice };
  }

  let loss = 0;
  let reason = "Diferencia centipeones";

  if (choice.kind === "mate" && choice.matePly < 0 && !(best.kind === "mate" && best.matePly < 0)) {
    loss = 2500;
    reason = "Permite mate";
  } else if (best.kind === "mate" && best.matePly > 0) {
    if (choice.kind === "mate" && choice.matePly > 0) {
      loss = 40 * Math.max(0, choice.matePly - best.matePly);
      reason = loss === 0 ? "Mate óptimo" : "Mate más lento";
    } else {
      loss = 1200 + 40 * Math.min(best.matePly, 20);
      reason = "Se escapó mate forzado";
    }
  } else if (best.kind === "cp" && choice.kind === "cp") {
    loss = clamp(best.cp - choice.cp, 0, 2000);
  } else {
    loss = clamp(best.score - choice.score, 0, 2500);
  }

  return {
    loss,
    diff: Number.isFinite(loss) ? Math.round(loss) : null,
    reason,
    best,
    choice,
  };
}

function scoreMoveAgainstBest(bestMoverScore, choiceMoverScore, scoringSystem = STATE.scoringSystem, options = {}) {
  const system = normalizeScoringSystem(scoringSystem);
  const base = computeLossAgainstBest(bestMoverScore, choiceMoverScore);
  const exactBest = Boolean(options.exactBest);
  let points = 0;
  let qualityLabel = cpQualityLabel(base.loss, exactBest);
  const bestExpected = scoreToExpectedPoints(bestMoverScore);
  const choiceExpected = scoreToExpectedPoints(choiceMoverScore);
  const expectedLoss = Number.isFinite(bestExpected) && Number.isFinite(choiceExpected)
    ? clamp(bestExpected - choiceExpected, 0, 1)
    : null;

  if (base.reason === "Sin jugada") {
    qualityLabel = "Sin jugada";
    points = 0;
  } else {
    switch (system) {
      case "cp_linear": {
        points = pointsFromLossLinear(base.loss);
        break;
      }
      case "cp_labels": {
        if (exactBest) {
          qualityLabel = "Mejor (exacta)";
          points = 100;
        } else if (base.loss <= 1) {
          qualityLabel = "Mejor equivalente";
          points = 96;
        } else if (base.loss <= 20) {
          qualityLabel = "Muy buena";
          points = 82;
        } else if (base.loss <= 60) {
          qualityLabel = "Buena";
          points = 65;
        } else if (base.loss <= 120) {
          qualityLabel = "Dudosa";
          points = 25;
        } else if (base.loss <= 220) {
          qualityLabel = "Mala";
          points = -10;
        } else {
          qualityLabel = "Blunder";
          points = -45;
        }
        break;
      }
      case "expected_points_labels": {
        if (exactBest) {
          qualityLabel = "Mejor (exacta)";
          points = 100;
        } else if (!Number.isFinite(expectedLoss)) {
          qualityLabel = "No clasificable";
          points = 0;
        } else if (expectedLoss <= 0.001) {
          qualityLabel = "Mejor equivalente";
          points = 96;
        } else if (expectedLoss <= 0.02) {
          qualityLabel = "Excelente";
          points = 88;
        } else if (expectedLoss <= 0.05) {
          qualityLabel = "Buena";
          points = 68;
        } else if (expectedLoss <= 0.1) {
          qualityLabel = "Dudosa";
          points = 28;
        } else if (expectedLoss <= 0.2) {
          qualityLabel = "Mala";
          points = -12;
        } else {
          qualityLabel = "Blunder";
          points = -55;
        }
        break;
      }
      case "exact_best": {
        if (exactBest) {
          qualityLabel = "Exacta del módulo";
          points = 120;
        } else if (base.loss <= 15) {
          qualityLabel = "Casi exacta";
          points = 35;
        } else if (base.loss <= 60) {
          qualityLabel = "Aceptable";
          points = 10;
        } else if (base.loss <= 140) {
          qualityLabel = "Floja";
          points = -20;
        } else {
          qualityLabel = "Mala";
          points = -60;
        }
        break;
      }
      case "cp_exponential":
      default: {
        points = pointsFromLossExponential(base.loss);
        break;
      }
    }
  }

  return {
    ...base,
    points,
    qualityLabel,
    expectedLoss,
    scoringSystem: system,
    scoringSystemLabel: scoringSystemLabel(system),
  };
}

function getGamePhase(board) {
  let nonPawnMaterial = 0;
  let queens = 0;
  for (const piece of board.board) {
    if (!piece) continue;
    const p = piece.toUpperCase();
    if (p === "Q") queens += 1;
    if (p === "N" || p === "B") nonPawnMaterial += 3;
    if (p === "R") nonPawnMaterial += 5;
    if (p === "Q") nonPawnMaterial += 9;
  }
  if (nonPawnMaterial <= 10 || queens <= 1) return "endgame";
  if (nonPawnMaterial >= 24) return "opening";
  return "middlegame";
}

function adaptiveThreshold(baseThresholdCp, board) {
  const phase = getGamePhase(board);
  const base = clamp(Number(baseThresholdCp) || 150, 50, 800);
  if (phase === "opening") return { phase, threshold: Math.round(base * 1.1) };
  if (phase === "endgame") return { phase, threshold: Math.round(base * 0.75) };
  return { phase, threshold: base };
}

function adaptiveMoveTime(baseMoveTimeMs, board) {
  const base = clamp(Number(baseMoveTimeMs) || 400, 50, 10000);
  const legal = board.generateMoves();
  const legalCount = legal.length;
  const captureCount = legal.filter((move) => move.capture || move.enPassant).length;
  const inCheck = board.inCheck(board.turn);
  const phase = getGamePhase(board);

  let factor = 1;
  if (inCheck) factor += 0.55;
  if (legalCount >= 32) factor += 0.35;
  else if (legalCount >= 22) factor += 0.18;
  if (captureCount >= 6) factor += 0.3;
  else if (captureCount >= 3) factor += 0.16;
  if (phase === "opening") factor += 0.1;
  if (phase === "endgame") factor += 0.2;

  return clamp(Math.round(base * factor), 50, 10000);
}

function formatDelta(referenceScore, comparedScore) {
  if (!Number.isFinite(referenceScore) || !Number.isFinite(comparedScore)) return "No disponible";
  const delta = Math.round(comparedScore - referenceScore);
  if (delta === 0) return "Igual";
  if (Math.abs(delta) >= 90000) return delta > 0 ? "Mejor (mate/casi mate)" : "Peor (mate/casi mate)";
  return delta > 0 ? `+${delta} cp (mejor)` : `${delta} cp (peor)`;
}

// ---------- Local fallback evaluator ----------

const pieceValues = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0, p: -100, n: -320, b: -330, r: -500, q: -900, k: 0 };
function evaluateMaterial(board) {
  let score = 0;
  for (let i = 0; i < 64; i += 1) {
    const piece = board.board[i];
    if (!piece) continue;
    score += pieceValues[piece];
  }
  return score;
}

function evaluatePosition(board, depth) {
  if (depth <= 0) return evaluateMaterial(board);
  const moves = board.generateMoves();
  if (moves.length === 0) return board.inCheck(board.turn) ? (board.turn === "w" ? -99999 : 99999) : 0;
  let best = board.turn === "w" ? -Infinity : Infinity;
  moves.forEach((move) => {
    const clone = board.clone();
    clone.makeMove(move);
    const score = evaluatePosition(clone, depth - 1);
    if (board.turn === "w") {
      if (score > best) best = score;
    } else if (score < best) {
      best = score;
    }
  });
  return best;
}

function searchBestMove(board, depth) {
  let bestScore = board.turn === "w" ? -Infinity : Infinity;
  let bestMove = null;
  board.generateMoves().forEach((move) => {
    const clone = board.clone();
    clone.makeMove(move);
    const score = evaluatePosition(clone, depth - 1);
    if (board.turn === "w") {
      if (score > bestScore) { bestScore = score; bestMove = move; }
    } else if (score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  });
  return { move: bestMove, score: Math.round(bestScore) };
}

function normalizeScore(score, turn) {
  return turn === "w" ? score : -score;
}

function resetEngineToLocal() {
  if (STATE.engine.worker) {
    try {
      STATE.engine.worker.terminate();
    } catch (error) {
      // ignore terminate failures
    }
  }
  STATE.engine = { mode: "local", worker: null, ready: false, evalCache: new Map() };
}

function cacheGet(key) {
  return STATE.engine.evalCache.get(key);
}

function cacheSet(key, value) {
  if (STATE.engine.evalCache.size > 25000) {
    STATE.engine.evalCache.clear();
  }
  STATE.engine.evalCache.set(key, value);
}

async function waitForWorkerReady(worker, timeoutMs = 7000) {
  return new Promise((resolve) => {
    let done = false;
    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      worker.removeEventListener("message", onMessage);
      resolve(false);
    }, timeoutMs);

    const onMessage = (event) => {
      const line = typeof event.data === "string" ? event.data : "";
      if (line === "readyok") {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
        resolve(true);
      }
      if (line.startsWith("engine-error")) {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
        resolve(false);
      }
    };

    worker.addEventListener("message", onMessage);
    worker.postMessage("uci");
    worker.postMessage("isready");
  });
}

async function setupStockfish() {
  resetEngineToLocal();
  try {
    const response = await fetch("vendor/stockfish-18-lite-single.js", { method: "HEAD" });
    if (!response.ok) return;
    const worker = new Worker("vendor/stockfish-18-lite-single.js");
    worker.onerror = () => resetEngineToLocal();
    const ready = await waitForWorkerReady(worker, 7000);
    if (!ready) {
      try {
        worker.terminate();
      } catch (error) {
        // ignore
      }
      return;
    }
    STATE.engine = { mode: "stockfish", worker, ready: true, evalCache: new Map() };
  } catch (error) {
    resetEngineToLocal();
  }
}

async function stockfishEvaluate(fen, depth, moveTimeMs) {
  return new Promise((resolve, reject) => {
    if (!STATE.engine.worker) {
      reject(new Error("Worker no disponible"));
      return;
    }

    let lastScore = 0;
    let finished = false;
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      STATE.engine.worker.removeEventListener("message", handler);
      reject(new Error("Timeout del motor"));
    }, 15000);

    const handler = (event) => {
      const line = event.data;
      if (typeof line !== "string") return;
      if (line.includes("score cp")) {
        const match = line.match(/score cp (-?\d+)/);
        if (match) lastScore = Number(match[1]);
      }
      if (line.includes("score mate")) {
        const match = line.match(/score mate (-?\d+)/);
        if (match) {
          const mate = Number(match[1]);
          lastScore = mate > 0 ? 100000 - mate * 1000 : -100000 - mate * 1000;
        }
      }
      if (line.startsWith("bestmove")) {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        const bestMove = line.split(" ")[1];
        STATE.engine.worker.removeEventListener("message", handler);
        resolve({ bestMove, score: lastScore });
      }
    };

    STATE.engine.worker.addEventListener("message", handler);
    STATE.engine.worker.postMessage(`position fen ${fen}`);
    const safeMoveTime = clamp(Number(moveTimeMs) || 0, 0, 10000);
    if (safeMoveTime > 0) {
      STATE.engine.worker.postMessage(`go movetime ${safeMoveTime}`);
    } else {
      STATE.engine.worker.postMessage(`go depth ${depth}`);
    }
  });
}

async function getBestMoveWithEngine(board, depth, moveTimeMs) {
  const effectiveMoveTime = adaptiveMoveTime(moveTimeMs, board);
  const cacheKey = `best|${STATE.engine.mode}|${board.fen()}|d${depth}|t${effectiveMoveTime}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return { move: uciToMove(cached.bestMove, board), score: cached.score };
  }

  if (STATE.engine.mode === "stockfish") {
    try {
      const result = await stockfishEvaluate(board.fen(), depth, effectiveMoveTime);
      const normalized = normalizeScore(result.score, board.turn);
      cacheSet(cacheKey, { bestMove: result.bestMove, score: normalized });
      return { move: uciToMove(result.bestMove, board), score: normalized };
    } catch (error) {
      resetEngineToLocal();
    }
  }

  const local = searchBestMove(board, depth);
  cacheSet(cacheKey, { bestMove: moveToUci(local.move), score: local.score });
  return local;
}

async function evaluateMoveWithEngine(board, move, depth, moveTimeMs) {
  const clone = board.clone();
  clone.makeMove(move);
  const effectiveMoveTime = adaptiveMoveTime(moveTimeMs, board);
  const cacheKey = `eval|${STATE.engine.mode}|${clone.fen()}|d${depth}|t${effectiveMoveTime}`;
  const cached = cacheGet(cacheKey);
  if (Number.isFinite(cached)) return cached;

  if (STATE.engine.mode === "stockfish") {
    try {
      const result = await stockfishEvaluate(clone.fen(), depth, effectiveMoveTime);
      const normalized = normalizeScore(result.score, clone.turn);
      cacheSet(cacheKey, normalized);
      return normalized;
    } catch (error) {
      resetEngineToLocal();
    }
  }

  const localScore = evaluatePosition(clone, depth);
  cacheSet(cacheKey, localScore);
  return localScore;
}

// ---------- PGN parsing ----------

function removeVariations(text) {
  let out = "";
  let level = 0;
  for (const ch of text) {
    if (ch === "(") level += 1;
    else if (ch === ")") level = Math.max(0, level - 1);
    else if (level === 0) out += ch;
  }
  return out;
}

function parseTags(gameText) {
  const tags = {
    Event: "Partida",
    White: "Blancas",
    Black: "Negras",
    Site: "",
    Date: "",
    ECO: "",
    Result: "",
  };
  gameText
    .split("\n")
    .filter((line) => line.startsWith("["))
    .forEach((line) => {
      const match = line.match(/^\[(\w+)\s+"(.*)"\]$/);
      if (!match) return;
      const [, key, value] = match;
      tags[key] = value;
    });
  return tags;
}

function cleanTagValue(v) {
  const trimmed = String(v || "").trim();
  if (!trimmed || trimmed === "?" || trimmed === "????.??.??") return "";
  return trimmed;
}

function tokenizeSanMoves(gameText) {
  const movesText = gameText
    .split("\n")
    .filter((line) => !line.startsWith("["))
    .join(" ");
  const normalized = removeVariations(
    movesText
      .replace(/\{[^}]*\}/g, " ")
      .replace(/;.*$/gm, " ")
      .replace(/\$\d+/g, " ")
      .replace(/\r/g, " "),
  )
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = normalized.split(" ").filter(Boolean);
  return tokens.filter((token) => !["1-0", "0-1", "1/2-1/2", "*"].includes(token));
}

function splitGamesFromText(text) {
  return text
    .replace(/\r/g, "")
    .split(/\n\n(?=\[Event|\[Site|\[Date|\[Round|\[White|\[Black|\[Result)/g)
    .filter((g) => g.trim().length > 0);
}

function sanToMove(san, chess) {
  let clean = san.replace(/[+#!?]/g, "");
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

function inferPlayerName(games) {
  const map = new Map();
  games.forEach((g) => {
    [g.tags.White, g.tags.Black].forEach((n) => {
      const clean = cleanTagValue(n);
      if (!clean) return;
      map.set(clean, (map.get(clean) || 0) + 1);
    });
  });
  const best = Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : "";
}

function getPlayerColor(tags, targetName) {
  const white = normalizeName(tags.White);
  const black = normalizeName(tags.Black);
  const target = normalizeName(targetName);
  if (!target) return null;
  if (white === target) return "w";
  if (black === target) return "b";
  return null;
}

function buildMeta(tags, moveNumber, sideToMove) {
  const players = `${cleanTagValue(tags.White) || "Blancas"} vs ${cleanTagValue(tags.Black) || "Negras"}`;
  const event = cleanTagValue(tags.Event) || "Partida";
  const date = cleanTagValue(tags.Date);
  const yearMatch = date.match(/^(\d{4})/);
  const year = yearMatch ? yearMatch[1] : "";
  const site = cleanTagValue(tags.Site);
  const eco = cleanTagValue(tags.ECO);
  const result = cleanTagValue(tags.Result);
  return {
    players,
    event,
    year,
    site,
    eco,
    result,
    moveNumber,
    sideToMove: sideToMove === "w" ? "blancas" : "negras",
  };
}

function buildRandomCandidateQueue(games, targetName) {
  const byGame = [];
  games.forEach((game, gameIdx) => {
    const playerColor = getPlayerColor(game.tags, targetName);
    if (!playerColor) return;
    const plyIndices = [];
    for (let ply = 0; ply < game.sanMoves.length; ply += 1) {
      const mover = ply % 2 === 0 ? "w" : "b";
      if (mover === playerColor) plyIndices.push(ply);
    }
    if (plyIndices.length === 0) return;
    byGame.push({ gameIdx, playerColor, plyIndices: shuffle(plyIndices) });
  });

  const shuffledGames = shuffle(byGame);
  const queue = [];

  // Interleave candidates by game so sessions naturally mix different games.
  let remaining = true;
  while (remaining) {
    remaining = false;
    shuffledGames.forEach((entry) => {
      const ply = entry.plyIndices.pop();
      if (!Number.isInteger(ply)) return;
      remaining = true;
      queue.push({ gameIdx: entry.gameIdx, playerColor: entry.playerColor, ply });
    });
  }
  return queue;
}

function updateAnalysisProgress(done, total, detected, extraText) {
  const safeTotal = Math.max(total || 0, 1);
  const pctRaw = clamp((done / safeTotal) * 100, 0, 100);
  let pctLabel = Math.round(pctRaw * 100) / 100;
  if (done > 0 && pctRaw > 0 && pctLabel === 0) pctLabel = 0.01;
  const pctVisual = done > 0 ? Math.max(pctRaw, 0.35) : 0;
  analysisProgressWrapEl.classList.remove("hidden");
  analysisProgressBarEl.style.width = `${pctVisual}%`;
  analysisProgressLabelEl.textContent = `${pctLabel}% (${done}/${total || 0})${extraText ? ` - ${extraText}` : ""}`;
  setConfigPreparationProgress("analyzing", pctRaw);
  if (STATE.userMode === "engineer") {
    analysisMetricsEl.classList.remove("hidden");
    analysisMetricsEl.textContent = `Posiciones totales: ${total || 0} | Posiciones analizadas: ${done} | Posiciones detectadas (>= umbral): ${detected || 0}`;
  } else {
    analysisMetricsEl.classList.add("hidden");
  }
}

function resetAnalysisProgress() {
  analysisProgressBarEl.style.width = "0%";
  analysisProgressLabelEl.textContent = "0%";
  analysisMetricsEl.classList.add("hidden");
  analysisMetricsEl.textContent = "Posiciones totales: 0 | Posiciones analizadas: 0 | Posiciones detectadas (>= umbral): 0";
}

function updateNextSearchStatus(ctx, phaseText = "", ordinal = null) {
  if (!roundStatusEl || !ctx) return;
  const total = Number.isFinite(ctx.total) ? ctx.total : 0;
  const analyzed = Number.isFinite(ctx.analyzed) ? ctx.analyzed : 0;
  const detected = Number.isFinite(ctx.detected) ? ctx.detected : 0;
  const targetTotal = Math.max(1, Number(STATE.targetPositions) || 1);
  const targetRemaining = Math.max(0, targetTotal - STATE.positions.length);
  const candidatePart = Number.isFinite(ordinal)
    ? `Candidata ${ordinal}/${total}`
    : (phaseText || "Buscando error");
  roundStatusEl.textContent = `Buscando próxima posición... ${candidatePart} | Analizadas: ${analyzed}/${total} | Detectadas: ${detected} | Restantes objetivo: ${targetRemaining}`;
}

async function evaluateCandidateForMistake(candidate, ctx) {
  const game = ctx.games[candidate.gameIdx];
  if (!game) return null;
  const { tags, sanMoves } = game;

  const chess = new Chess(Chess.START_FEN);
  for (let ply = 0; ply <= candidate.ply; ply += 1) {
    const san = sanMoves[ply];
    const move = sanToMove(san, chess);
    if (!move) return null;

    if (ply === candidate.ply) {
      const moverColor = chess.turn;
      if (moverColor !== candidate.playerColor) return null;

      const before = chess.clone();
      const moveNumber = Math.floor(ply / 2) + 1;
      const adaptive = adaptiveThreshold(ctx.thresholdCp, before);

      const best = await getBestMoveWithEngine(before, ctx.depth, ctx.moveTimeMs);
      const playedEvalWhite = await evaluateMoveWithEngine(before, move, Math.max(1, ctx.depth - 1), ctx.moveTimeMs);

      const bestMover = toMoverScore(best.score, moverColor);
      const playedMover = toMoverScore(playedEvalWhite, moverColor);
      const scored = computeLossAgainstBest(bestMover, playedMover);

      if ((scored.diff || 0) < adaptive.threshold) return null;

      return {
        fen: before.fen(),
        meta: buildMeta(tags, moveNumber, moverColor),
        gameIdx: candidate.gameIdx,
        gameMoveUci: moveToUci(move),
        gameMoveSan: moveToSan(before, move),
        gameEvalText: evaluationToText(decodeEvaluation(playedMover)),
        bestMoveUci: moveToUci(best.move),
        bestMoveSan: moveToSan(before, best.move),
        bestEvalText: evaluationToText(decodeEvaluation(bestMover)),
        lossCp: scored.diff || 0,
        thresholdUsed: adaptive.threshold,
        phase: adaptive.phase,
        gameIndex: candidate.gameIdx + 1,
      };
    }

    chess.makeMove(move);
  }
  return null;
}

async function findNextMistake(ctx, extraStatusPrefix = "") {
  if (!ctx || STATE.analysisInProgress) return null;
  STATE.analysisInProgress = true;
  const isNextSearch = String(extraStatusPrefix || "").trim().toLowerCase().startsWith("siguiente");
  try {
    if (!Array.isArray(ctx.repeatMistakes)) ctx.repeatMistakes = [];
    if (ctx.cursor >= ctx.candidates.length && ctx.repeatMistakes.length > 0) {
      const fallback = ctx.repeatMistakes.shift();
      const usedGames = ctx.usedGameIndices instanceof Set ? ctx.usedGameIndices : null;
      if (usedGames && Number.isInteger(fallback.gameIdx)) usedGames.add(fallback.gameIdx);
      ctx.detected += 1;
      updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, "Posición detectada (repetida)");
      analysisStatusEl.textContent = `${extraStatusPrefix}Posición detectada (${ctx.detected}). Se reutiliza partida por falta de alternativas.`;
      if (isNextSearch) updateNextSearchStatus(ctx, "Posición detectada (repetida)");
      return fallback;
    }

    let scannedThisCall = 0;
    const maxScanPerCall = 140;
    while (ctx.cursor < ctx.candidates.length) {
      const candidate = ctx.candidates[ctx.cursor];
      const ordinal = ctx.cursor + 1;
      analysisStatusEl.textContent = `${extraStatusPrefix}Analizando candidata ${ordinal}/${ctx.total}. Detectadas: ${ctx.detected}.`;
      updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, `Evaluando ${ordinal}/${ctx.total}`);
      if (isNextSearch) updateNextSearchStatus(ctx, "Evaluando candidata", ordinal);
      await yieldToUi();

      ctx.cursor += 1;
      const mistake = await evaluateCandidateForMistake(candidate, ctx);
      ctx.analyzed += 1;
      if (mistake) {
        const gameIdx = Number.isInteger(mistake.gameIdx) ? mistake.gameIdx : candidate.gameIdx;
        const usedGames = ctx.usedGameIndices instanceof Set ? ctx.usedGameIndices : null;
        const uniqueGameCount = Number.isInteger(ctx.uniqueGameCount) ? ctx.uniqueGameCount : 0;
        const alreadyUsed = usedGames ? usedGames.has(gameIdx) : false;
        const canStillDiversify = usedGames && uniqueGameCount > 0 && usedGames.size < uniqueGameCount;

        if (!alreadyUsed || !canStillDiversify) {
          if (usedGames) usedGames.add(gameIdx);
          ctx.detected += 1;
          updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, "Posición detectada");
          analysisStatusEl.textContent = `${extraStatusPrefix}Posición detectada (${ctx.detected}). Podés jugar.`;
          if (isNextSearch) updateNextSearchStatus(ctx, "Posición detectada");
          return mistake;
        }

        // Keep repeated-game candidates as fallback and continue searching unseen games.
        ctx.repeatMistakes.push(mistake);
      }

      scannedThisCall += 1;
      if (scannedThisCall >= maxScanPerCall && ctx.repeatMistakes.length > 0) {
        const fallback = ctx.repeatMistakes.shift();
        const usedGames = ctx.usedGameIndices instanceof Set ? ctx.usedGameIndices : null;
        if (usedGames && Number.isInteger(fallback.gameIdx)) usedGames.add(fallback.gameIdx);
        ctx.detected += 1;
        updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, "Posición detectada (repetida)");
        analysisStatusEl.textContent = `${extraStatusPrefix}Posición detectada (${ctx.detected}). Se priorizó continuidad de sesión.`;
        if (isNextSearch) updateNextSearchStatus(ctx, "Posición detectada (repetida)");
        return fallback;
      }

      if (ctx.analyzed % 2 === 0) {
        updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, "Buscando error");
        if (isNextSearch) updateNextSearchStatus(ctx, "Buscando error");
        await yieldToUi();
      }
    }

    if (ctx.repeatMistakes.length > 0) {
      const deferredRepeat = ctx.repeatMistakes.shift();
      const usedGames = ctx.usedGameIndices instanceof Set ? ctx.usedGameIndices : null;
      if (usedGames && Number.isInteger(deferredRepeat.gameIdx)) usedGames.add(deferredRepeat.gameIdx);
      ctx.detected += 1;
      updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, "Posición detectada (repetida)");
      analysisStatusEl.textContent = `${extraStatusPrefix}Posición detectada (${ctx.detected}). No hubo más partidas nuevas en el umbral.`;
      if (isNextSearch) updateNextSearchStatus(ctx, "Posición detectada (repetida)");
      return deferredRepeat;
    }

    updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, "Búsqueda finalizada");
    analysisStatusEl.textContent = `${extraStatusPrefix}No quedan más posiciones en el umbral.`;
    if (isNextSearch) updateNextSearchStatus(ctx, "Búsqueda finalizada");
    return null;
  } finally {
    STATE.analysisInProgress = false;
  }
}

// ---------- UI / Gameplay ----------

function setBoardPerspective(turn) {
  const perspective = turn === "b" ? "b" : "w";
  if (STATE.boardPerspective !== perspective) {
    STATE.boardPerspective = perspective;
    buildBoard();
  }
  updateDecisionSignals();
}

function buildBoard() {
  boardEl.innerHTML = "";
  const ranks = STATE.boardPerspective === "b" ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const orderedFiles = STATE.boardPerspective === "b" ? [...files].reverse() : files;
  const leftEdgeFile = STATE.boardPerspective === "b" ? "h" : "a";
  const bottomEdgeRank = STATE.boardPerspective === "b" ? 8 : 1;

  for (const rank of ranks) {
    for (const fileLetter of orderedFiles) {
      const fileNum = files.indexOf(fileLetter) + 1;
      const square = document.createElement("div");
      square.className = `square ${(rank + fileNum) % 2 === 0 ? "light" : "dark"}`;
      square.dataset.square = `${fileLetter}${rank}`;
      square.addEventListener("click", () => onSquareClick(square.dataset.square));

      if (fileLetter === leftEdgeFile) {
        const rankCoord = document.createElement("span");
        rankCoord.className = "coord coord-rank";
        rankCoord.textContent = String(rank);
        square.appendChild(rankCoord);
      }
      if (rank === bottomEdgeRank) {
        const fileCoord = document.createElement("span");
        fileCoord.className = "coord coord-file";
        fileCoord.textContent = fileLetter;
        square.appendChild(fileCoord);
      }

      boardEl.appendChild(square);
    }
  }
}

function renderBoard() {
  boardEl.querySelectorAll(".square").forEach((square) => {
    square.classList.remove(
      "selected", "legal", "capture",
      "best-from", "best-to", "game-from", "game-to", "user-from", "user-to", "user-alt-from", "user-alt-to",
    );
    const existingPiece = square.querySelector(".piece-img");
    if (existingPiece) existingPiece.remove();

    if (!STATE.board) return;
    const index = Chess.squareToIndex(square.dataset.square);
    const piece = STATE.board.pieceAt(index);
    if (piece) {
      const image = document.createElement("img");
      image.className = "piece-img";
      image.src = PIECE_IMAGES[piece];
      image.alt = piece;
      image.draggable = false;
      square.appendChild(image);
    }
  });

  if (STATE.selection) {
    const selected = boardEl.querySelector(`[data-square="${STATE.selection}"]`);
    if (selected) selected.classList.add("selected");
  }

  STATE.legalMoves.forEach((move) => {
    const target = boardEl.querySelector(`[data-square="${Chess.indexToSquare(move.to)}"]`);
    if (!target) return;
    target.classList.add(move.capture ? "capture" : "legal");
  });

  const paint = (move, fromClass, toClass) => {
    if (!move) return;
    const from = boardEl.querySelector(`[data-square="${Chess.indexToSquare(move.from)}"]`);
    const to = boardEl.querySelector(`[data-square="${Chess.indexToSquare(move.to)}"]`);
    if (from) from.classList.add(fromClass);
    if (to) to.classList.add(toClass);
  };

  paint(STATE.revealed.best, "best-from", "best-to");
  paint(STATE.revealed.game, "game-from", "game-to");
  paint(STATE.revealed.user, "user-from", "user-to");
  paint(STATE.revealed.userAlt, "user-alt-from", "user-alt-to");
}

function renderGameInfo(position) {
  const m = position.meta;
  const event = m.event || "Partida";
  const year = m.year || "?";
  const eco = m.eco || "-";
  const result = m.result || "-";
  const move = m.moveNumber ? String(m.moveNumber) : "-";
  const players = m.players || "-";
  if (gameDetailsMiniEl) {
    if (STATE.userMode === "citizen") {
      gameDetailsMiniEl.textContent = `${players} | ${event} ${year} | Movida ${move}`;
    } else {
      gameDetailsMiniEl.textContent = `${players} | ${event} ${year} | ECO ${eco} | Resultado ${result} | Movida ${move}`;
    }
  }
}

function snapshotMove(move) {
  if (!move || !Number.isFinite(move.from) || !Number.isFinite(move.to)) return null;
  const copy = { from: move.from, to: move.to };
  if (move.promotion) copy.promotion = move.promotion;
  return copy;
}

function historyEntryLabel(entry) {
  const round = Number.isFinite(entry?.round) ? entry.round : "-";
  return `Posición ${round}`;
}

function renderHistoryPreview(entry) {
  if (!roundResultEl || !entry) return;
  const moduleLine = `<p><strong>Módulo:</strong> ${escapeHtml(entry.bestSan || "-")}</p>`;
  const gameLine = `<p><strong>Partida:</strong> ${escapeHtml(entry.gameSan || "-")}</p>`;
  let userLines = "";
  if (entry.mode === "duel") {
    userLines = `
      <p><strong>${escapeHtml(entry.player1Name || "Jugador 1")}:</strong> ${escapeHtml(entry.player1San || "Sin jugada")}</p>
      <p><strong>${escapeHtml(entry.player2Name || "Jugador 2")}:</strong> ${escapeHtml(entry.player2San || "Sin jugada")}</p>
    `;
  } else {
    userLines = `<p><strong>Tu jugada:</strong> ${escapeHtml(entry.userSan || "Sin jugada")}</p>`;
  }
  roundResultEl.innerHTML = `
    <div class="history-preview">
      <p class="history-preview-title"><strong>${escapeHtml(historyEntryLabel(entry))}</strong></p>
      ${moduleLine}
      ${gameLine}
      ${userLines}
    </div>
  `;
}

function openHistoryEntry(index) {
  if (!Array.isArray(STATE.historyEntries) || STATE.historyEntries.length === 0) return;
  const idx = Number(index);
  if (!Number.isInteger(idx) || idx < 0 || idx >= STATE.historyEntries.length) return;
  const entry = STATE.historyEntries[idx];
  STATE.historySelectedIdx = idx;
  renderHistoryList();

  if (!entry || !entry.fen) return;
  STATE.board = new Chess(entry.fen);
  setBoardPerspective(STATE.board.turn);
  if (entry.meta) {
    renderGameInfo({ meta: entry.meta });
  }
  if (roundStatusEl) {
    roundStatusEl.textContent = `Revisión · ${historyEntryLabel(entry)}`;
  }
  STATE.selection = null;
  STATE.legalMoves = [];
  STATE.userMove = null;
  if (entry.mode === "duel") {
    const primaryUserMove = entry.player2Move || entry.player1Move || null;
    const secondaryUserMove = entry.player2Move && entry.player1Move ? entry.player1Move : null;
    STATE.revealed = {
      best: entry.bestMove || null,
      game: entry.gameMove || null,
      user: primaryUserMove,
      userAlt: secondaryUserMove,
    };
  } else {
    STATE.revealed = {
      best: entry.bestMove || null,
      game: entry.gameMove || null,
      user: entry.userMove || null,
      userAlt: null,
    };
  }
  renderBoard();
  hideFeedbackStrip();
  if (roundResultPanelEl) roundResultPanelEl.classList.remove("hidden");
  renderHistoryPreview(entry);
}

function renderHistoryList() {
  if (!historyEl) return;
  if (!Array.isArray(STATE.historyEntries) || STATE.historyEntries.length === 0) {
    historyEl.innerHTML = '<li class="history-empty">Sin posiciones jugadas.</li>';
    return;
  }
  historyEl.innerHTML = "";
  STATE.historyEntries.forEach((entry, idx) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "history-item-btn";
    btn.dataset.historyIndex = String(idx);
    btn.textContent = historyEntryLabel(entry);
    btn.addEventListener("click", () => openHistoryEntry(idx));
    if (idx === STATE.historySelectedIdx) btn.classList.add("active");
    li.appendChild(btn);
    historyEl.appendChild(li);
  });
}

function pushHistoryEntry(entry) {
  if (!entry) return;
  STATE.historyEntries.unshift(entry);
  STATE.historySelectedIdx = 0;
  renderHistoryList();
}

function renderSessionProgress() {
  const played = STATE.sessionPlayed;
  const remaining = Math.max(0, STATE.targetPositions - played);
  if (!isDuelMode()) {
    const hits = STATE.sessionHits;
    sessionProgressEl.textContent = `Aciertos: ${hits} · Restan: ${remaining}`;
    return;
  }
  const p1 = duelPlayerName(0);
  const p2 = duelPlayerName(1);
  const currentRound = Math.min(Math.max(1, STATE.index + 1), Math.max(1, STATE.targetPositions));
  sessionProgressEl.textContent = `Ronda ${currentRound}/${STATE.targetPositions} · Restan: ${remaining} · Aciertos: ${p1} ${STATE.duel.hits[0]} - ${STATE.duel.hits[1]} ${p2}`;
}

function startRound(options = {}) {
  const position = STATE.positions[STATE.index];
  if (!position) return;

  const preserveDuelRoundResults = Boolean(options.preserveDuelRoundResults);
  if (isDuelMode() && !preserveDuelRoundResults) {
    STATE.duel.roundResults = [null, null];
  }

  STATE.board = new Chess(position.fen);
  setBoardPerspective(STATE.board.turn);
  STATE.selection = null;
  STATE.legalMoves = [];
  STATE.userMove = null;
  STATE.roundSubmitted = false;
  STATE.isResolvingRound = false;
  STATE.revealed = { best: null, game: null, user: null, userAlt: null };

  renderGameInfo(position);
  const totalTarget = Math.max(1, STATE.targetPositions || STATE.positions.length || 1);
  if (isDuelMode()) {
    const activePlayer = duelPlayerName(STATE.duel.currentPlayer);
    const turnNumber = STATE.duel.currentPlayer + 1;
    roundStatusEl.textContent = `Posición ${STATE.index + 1}/${totalTarget} · Juega ${activePlayer} (${turnNumber}/2)`;
  } else {
    roundStatusEl.textContent = `Posición ${STATE.index + 1}/${totalTarget}`;
  }
  roundResultPanelEl.classList.add("hidden");
  roundResultEl.innerHTML = "";
  hideFeedbackStrip();
  setScoringInfoVisible(false);
  renderSessionProgress();
  updateScoreDisplay();
  updateCompetitiveStatus();
  setThinkingMode(true);
  stopRoundTimer();
  startRoundTimer();
  nextBtn.disabled = true;
  skipBtn.disabled = false;
  nextBtn.textContent = isDuelMode() && STATE.duel.currentPlayer === 0
    ? `Turno de ${duelPlayerName(1)}`
    : "Siguiente posición";

  renderBoard();
}

function onSquareClick(square) {
  if (!STATE.board || !STATE.positions.length || nextBtn.disabled === false) return;
  if (STATE.roundSubmitted || STATE.isResolvingRound) return;

  const index = Chess.squareToIndex(square);
  const piece = STATE.board.pieceAt(index);

  if (STATE.selection) {
    const move = STATE.legalMoves.find((candidate) => candidate.to === index);
    if (move) {
      submitUserMove(move);
      return;
    }
  }

  if (!piece) {
    STATE.selection = null;
    STATE.legalMoves = [];
    renderBoard();
    return;
  }

  if ((STATE.board.turn === "w" && piece === piece.toLowerCase()) ||
      (STATE.board.turn === "b" && piece === piece.toUpperCase())) {
    STATE.selection = null;
    STATE.legalMoves = [];
    renderBoard();
    return;
  }

  STATE.selection = square;
  STATE.legalMoves = STATE.board.generateMoves().filter((m) => m.from === index);
  renderBoard();
}

async function submitUserMove(move) {
  await resolveRound(move);
}

async function submitNoMove(reason = "no_move") {
  await resolveRound(null, { noMoveReason: reason });
}

function renderRoundFeedbackTable(bestSan, bestEvalText, gameSan, gameEvalText, userSan, userEvalText, bestMover, gameMover, userMover, scored, noMoveReason = "") {
  const noMove = !Number.isFinite(userMover);
  const noMoveNote = noMoveReason === "timeout"
    ? "Se agotó el tiempo: puntuación automática = 0."
    : (noMove ? "No moviste en esta posición: puntuación automática = 0." : "");
  if (STATE.userMode === "citizen") {
    roundResultEl.innerHTML = `
      <div class="feedback-brief">
        <p><strong>Mejor:</strong> ${escapeHtml(bestSan)}</p>
        <p><strong>Tu jugada:</strong> ${escapeHtml(userSan)}</p>
      </div>
      ${noMoveNote ? `<p class="feedback-note">${escapeHtml(noMoveNote)}</p>` : ""}
    `;
    return;
  }

  const expectedLossNote = Number.isFinite(scored.expectedLoss)
    ? ` | <strong>Expected points perdidos:</strong> ${escapeHtml(formatExpectedLoss(scored.expectedLoss))}`
    : "";
  roundResultEl.innerHTML = `
    <div class="legend">
      <span><i class="swatch best"></i> Verde: referencia única (mejor del módulo)</span>
      <span><i class="swatch game"></i> Castaño: lo que se jugó en la partida</span>
      <span><i class="swatch user"></i> Naranja: tu jugada</span>
    </div>
    <table class="feedback-table">
      <thead>
        <tr>
          <th>Referencia</th>
          <th>Jugada</th>
          <th>Evaluación</th>
          <th>Delta vs referencia</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Mejor del módulo</td>
          <td>${escapeHtml(bestSan)}</td>
          <td>${escapeHtml(bestEvalText)}</td>
          <td>Referencia</td>
        </tr>
        <tr>
          <td>Lo que se jugó en la partida</td>
          <td>${escapeHtml(gameSan)}</td>
          <td>${escapeHtml(gameEvalText)}</td>
          <td>${escapeHtml(formatDelta(bestMover, gameMover))}</td>
        </tr>
        <tr>
          <td>Tu jugada</td>
          <td>${escapeHtml(userSan)}</td>
          <td>${escapeHtml(userEvalText)}</td>
          <td>${escapeHtml(formatDelta(bestMover, userMover))}</td>
        </tr>
      </tbody>
    </table>
    <p class="feedback-note"><strong>Sistema:</strong> ${escapeHtml(scored.scoringSystemLabel)} | <strong>Clasificación:</strong> ${escapeHtml(scored.qualityLabel)} | <strong>Pérdida vs referencia:</strong> ${scored.diff ?? "-"} cp${expectedLossNote} | <strong>Puntos:</strong> ${escapeHtml(formatSigned(scored.points))}${noMoveNote ? ` | ${escapeHtml(noMoveNote)}` : ""}</p>
  `;
}

function finalSessionSummaryText() {
  if (!isDuelMode()) return `Puntaje final: ${STATE.score}`;
  const p1 = duelPlayerName(0);
  const p2 = duelPlayerName(1);
  const s1 = STATE.duel.scores[0];
  const s2 = STATE.duel.scores[1];
  let winner = "Resultado final: empate.";
  if (s1 > s2) winner = `Ganador: ${p1}.`;
  if (s2 > s1) winner = `Ganador: ${p2}.`;
  return `Marcador final: ${p1} ${s1} - ${p2} ${s2}. ${winner}`;
}

async function resolveRound(move, options = {}) {
  if (STATE.roundSubmitted || STATE.isResolvingRound) return;
  stopRoundTimer();
  STATE.roundSubmitted = true;
  STATE.isResolvingRound = true;
  try {
    const depth = INTERNAL_ANALYSIS_DEPTH;
    const moveTimeMs = getEffectiveAnalysisConfig().moveTimeMs;
    const position = STATE.positions[STATE.index];
    const base = new Chess(position.fen);
    const moverTurn = base.turn;

    const noMove = !move;
    const noMoveReason = noMove ? (options.noMoveReason || "no_move") : "";
    STATE.userMove = move || null;
    STATE.selection = null;
    STATE.legalMoves = [];
    skipBtn.disabled = true;

    if (noMoveReason === "timeout") {
      roundResultEl.textContent = "Tiempo agotado. Evaluando posición...";
    } else {
      roundResultEl.textContent = noMove ? "Cerrando posición sin jugada..." : "Evaluando tu jugada...";
    }

    if (move) {
      // Show the played move immediately on board so the user sees the piece in destination square.
      STATE.board.makeMove(move);
      STATE.revealed = { ...STATE.revealed, user: move };
      renderBoard();
    }

    const best = uciToMove(position.bestMoveUci, base) || (await getBestMoveWithEngine(base, depth, moveTimeMs)).move;
    const game = uciToMove(position.gameMoveUci, base);

    const bestEvalSource = best ? await evaluateMoveWithEngine(base, best, Math.max(1, depth - 1), moveTimeMs) : null;
    const gameEvalWhite = game ? await evaluateMoveWithEngine(base, game, Math.max(1, depth - 1), moveTimeMs) : NaN;
    const userEvalWhite = move ? await evaluateMoveWithEngine(base, move, Math.max(1, depth - 1), moveTimeMs) : NaN;

    const bestMover = toMoverScore(bestEvalSource, moverTurn);
    const gameMover = toMoverScore(gameEvalWhite, moverTurn);
    const userMover = toMoverScore(userEvalWhite, moverTurn);

    const isExactBest = Boolean(move && best && moveToUci(move) === moveToUci(best));
    const scored = scoreMoveAgainstBest(bestMover, userMover, STATE.scoringSystem, { exactBest: isExactBest });
    const hitThreshold = Number.isFinite(position.thresholdUsed) ? position.thresholdUsed : 120;
    const hit = !noMove && Number.isFinite(scored.diff) && scored.diff <= hitThreshold;

    const userSan = move ? moveToSan(base, move) : "Sin jugada";
    const gameSan = game ? moveToSan(base, game) : position.gameMoveSan || "-";
    const bestSan = best ? moveToSan(base, best) : position.bestMoveSan || "-";

    const bestEvalText = evaluationToText(decodeEvaluation(bestMover));
    const gameEvalText = Number.isFinite(gameMover) ? evaluationToText(decodeEvaluation(gameMover)) : position.gameEvalText || "No disponible";
    const userEvalText = evaluationToText(decodeEvaluation(userMover));

    setThinkingMode(false);

    if (!isDuelMode()) {
      STATE.revealed = { best, game, user: move || null, userAlt: null };
      renderBoard();
      renderRoundFeedbackTable(
        bestSan,
        bestEvalText,
        gameSan,
        gameEvalText,
        userSan,
        userEvalText,
        bestMover,
        gameMover,
        userMover,
        scored,
        noMoveReason,
      );
      roundResultPanelEl.classList.remove("hidden");
      STATE.score += scored.points;
      STATE.sessionPlayed += 1;
      if (hit) STATE.sessionHits += 1;
      pushHistoryEntry({
        round: STATE.index + 1,
        mode: "solo",
        fen: position.fen,
        meta: position.meta,
        bestSan,
        gameSan,
        userSan,
        bestMove: snapshotMove(best),
        gameMove: snapshotMove(game),
        userMove: snapshotMove(move),
      });
      updateFeedbackStrip(scored, bestMover, userMover);
      nextBtn.textContent = "Siguiente posición";
      nextBtn.disabled = false;
      skipBtn.disabled = true;
      renderSessionProgress();
      updateScoreDisplay();
      updateCompetitiveStatus();
      setScoringInfoVisible(true);
      return;
    }

    const playerIdx = STATE.duel.currentPlayer;
    const playerName = duelPlayerName(playerIdx);
    STATE.duel.roundResults[playerIdx] = {
      points: scored.points,
      diff: scored.diff,
      qualityLabel: scored.qualityLabel,
      bestSan,
      userSan,
      userMove: snapshotMove(move),
      hit,
    };

    if (playerIdx === 0) {
      const nextPlayer = duelPlayerName(1);
      STATE.revealed = { best: null, game: null, user: null, userAlt: null };
      renderBoard();
      hideFeedbackStrip();
      roundResultPanelEl.classList.remove("hidden");
      roundResultEl.innerHTML = `<p class="feedback-note"><strong>${escapeHtml(playerName)}</strong> ya jugó. Ahora juega <strong>${escapeHtml(nextPlayer)}</strong> con la misma posición y el mismo reloj.</p>`;
      nextBtn.textContent = `Turno de ${nextPlayer}`;
      nextBtn.disabled = false;
      skipBtn.disabled = true;
      renderSessionProgress();
      updateScoreDisplay();
      updateCompetitiveStatus();
      setScoringInfoVisible(false);
      return;
    }

    const p1 = duelPlayerName(0);
    const p2 = duelPlayerName(1);
    const r1 = STATE.duel.roundResults[0];
    const r2 = STATE.duel.roundResults[1];

    if (r1) {
      STATE.duel.scores[0] += r1.points || 0;
      if (r1.hit) STATE.duel.hits[0] += 1;
    }
    STATE.duel.scores[1] += scored.points;
    if (hit) STATE.duel.hits[1] += 1;

    STATE.revealed = {
      best,
      game,
      user: move || null,
      userAlt: r1 ? (r1.userMove || null) : null,
    };
    renderBoard();
    renderRoundFeedbackTable(
      bestSan,
      bestEvalText,
      gameSan,
      gameEvalText,
      userSan,
      userEvalText,
      bestMover,
      gameMover,
      userMover,
      scored,
      noMoveReason,
    );
    roundResultPanelEl.classList.remove("hidden");
    updateFeedbackStrip(scored, bestMover, userMover, playerName);

    let winnerText = "Comparativa: empate.";
    if (r1 && r2 && r1.points > r2.points) winnerText = `Comparativa: ventaja para ${p1}.`;
    if (r1 && r2 && r2.points > r1.points) winnerText = `Comparativa: ventaja para ${p2}.`;
    roundResultEl.insertAdjacentHTML(
      "beforeend",
      `<p class="feedback-note"><strong>Duelo:</strong> ${escapeHtml(p1)} ${formatSigned(r1 ? r1.points : 0)} | ${escapeHtml(p2)} ${formatSigned(r2 ? r2.points : 0)}. ${escapeHtml(winnerText)}</p>`,
    );
    STATE.sessionPlayed += 1;
    pushHistoryEntry({
      round: STATE.index + 1,
      mode: "duel",
      fen: position.fen,
      meta: position.meta,
      bestSan,
      gameSan,
      bestMove: snapshotMove(best),
      gameMove: snapshotMove(game),
      player1Name: p1,
      player2Name: p2,
      player1San: r1 ? r1.userSan : "Sin jugada",
      player2San: r2 ? r2.userSan : "Sin jugada",
      player1Move: r1 ? r1.userMove : null,
      player2Move: r2 ? r2.userMove : null,
    });
    nextBtn.textContent = "Siguiente posición";
    nextBtn.disabled = false;
    skipBtn.disabled = true;
    renderSessionProgress();
    updateScoreDisplay();
    updateCompetitiveStatus();
    setScoringInfoVisible(true);
  } catch (error) {
    roundResultEl.textContent = `Error al evaluar la ronda: ${error.message || "desconocido"}`;
    STATE.roundSubmitted = false;
    skipBtn.disabled = false;
    nextBtn.disabled = true;
    startRoundTimer();
  } finally {
    STATE.isResolvingRound = false;
  }
}

async function nextPosition() {
  if (isDuelMode() && STATE.duel.currentPlayer === 0 && STATE.duel.roundResults[0] && !STATE.duel.roundResults[1]) {
    STATE.duel.currentPlayer = 1;
    startRound({ preserveDuelRoundResults: true });
    return;
  }

  if (isDuelMode()) {
    STATE.duel.currentPlayer = 0;
  }

  if (STATE.index >= Math.max(1, STATE.targetPositions) - 1) {
    roundStatusEl.textContent = `Sesión terminada. ${finalSessionSummaryText()}`;
    nextBtn.disabled = true;
    skipBtn.disabled = true;
    stopRoundTimer();
    setThinkingMode(false);
    updateCompetitiveStatus();
    setScoringInfoVisible(true);
    return;
  }

  if (STATE.index >= STATE.positions.length - 1) {
    const ctx = STATE.analysisContext;
    if (!ctx) {
      roundStatusEl.textContent = `Sesión terminada. ${finalSessionSummaryText()}`;
      nextBtn.disabled = true;
      skipBtn.disabled = true;
      stopRoundTimer();
      setThinkingMode(false);
      setScoringInfoVisible(true);
      return;
    }

    nextBtn.disabled = true;
    skipBtn.disabled = true;
    roundStatusEl.textContent = "Buscando próxima posición...";
    const nextMistake = await findNextMistake(ctx, "Siguiente: ");
    if (!nextMistake) {
      roundStatusEl.textContent = `Sesión terminada. ${finalSessionSummaryText()} No se encontraron más posiciones.`;
      nextBtn.disabled = true;
      skipBtn.disabled = true;
      stopRoundTimer();
      setThinkingMode(false);
      setScoringInfoVisible(true);
      return;
    }
    STATE.positions.push(nextMistake);
    STATE.allMistakes.push(nextMistake);
    STATE.index += 1;
    startRound();
    return;
  }
  STATE.index += 1;
  startRound();
}

function restartToSetup() {
  stopRoundTimer();
  setThinkingMode(false);
  setScoringInfoVisible(false);
  document.body.classList.remove("playing-mode");
  setupPanelEl.classList.remove("hidden");
  gameLayoutEl.classList.add("hidden");
  STATE.positions = [];
  STATE.index = 0;
  STATE.selection = null;
  STATE.legalMoves = [];
  STATE.userMove = null;
  STATE.board = null;
  STATE.revealed = { best: null, game: null, user: null, userAlt: null };
  STATE.sessionPlayed = 0;
  STATE.sessionHits = 0;
  resetDuelState();
  hideFeedbackStrip();
  renderSessionProgress();
  updateScoreDisplay();
  updateCompetitiveStatus();
  roundResultPanelEl.classList.add("hidden");
  roundResultEl.innerHTML = "";
  analysisStatusEl.textContent = "Esperando datos de partida.";
  if (playerNameDetectedEl) playerNameDetectedEl.textContent = "Se detectará al analizar los PGN.";
  resetAnalysisProgress();
  analysisProgressWrapEl.classList.add("hidden");
  skipBtn.disabled = true;
  nextBtn.disabled = true;
  setSetupStep("upload");
  setUploadWizardStep(1);
  updatePgnSelectionUi();
  showLandingScreen("Elegí un modo para iniciar una nueva sesión.");
  buildBoard();
  renderBoard();
}

async function getActivePgnTextSources() {
  if (isRemoteSourceMode()) {
    if (!hasAnyPgnSource(true)) return [];
    return STATE.remotePgnSources.map((entry) => ({ name: entry.name, text: entry.text }));
  }
  if (Array.isArray(STATE.localPgnSources) && STATE.localPgnSources.length > 0) {
    return STATE.localPgnSources.map((entry) => ({ name: entry.name, text: entry.text }));
  }
  const filesList = Array.from(pgnInputEl.files || []);
  return Promise.all(filesList.map(async (file) => ({ name: file.name, text: await file.text() })));
}

async function fetchLichessPgn() {
  const rawUser = getConfiguredRemoteUsername();
  if (!rawUser) {
    if (onlineStatusEl) onlineStatusEl.textContent = "Ingresá un usuario de Lichess.";
    return false;
  }

  const settings = getLichessFetchSettings();
  const nowMs = Date.now();
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  const sinceMs = nowMs - oneYearMs;
  const preferredLabel = settings.preferredPerf.map((p) => p[0].toUpperCase() + p.slice(1)).join("/");

  if (onlineStatusEl) {
    if (STATE.userMode === "citizen") {
      onlineStatusEl.textContent = `Descargando para ${rawUser}. ${describeLichessNormalProtocol(settings)}`;
    } else {
      onlineStatusEl.textContent = `Buscando hasta ${settings.maxGames} partida(s) de ${rawUser}: primero ${preferredLabel} (últimos 12 meses)...`;
    }
  }

  const fetchChunk = async (perfTypes, max) => {
    const params = new URLSearchParams();
    params.set("max", String(max));
    params.set("since", String(sinceMs));
    params.set("perfType", perfTypes.join(","));
    const url = `https://lichess.org/api/games/user/${encodeURIComponent(rawUser)}?${params.toString()}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/x-chess-pgn" },
    });
    if (!response.ok) {
      throw new Error(`Lichess respondió ${response.status}`);
    }
    const text = await response.text();
    return { text, games: countPgnGames(text) };
  };

  try {
    const slow = await fetchChunk(settings.preferredPerf, settings.maxGames);
    let finalText = slow.text;
    let totalGames = slow.games;
    let blitzGames = 0;

    if (settings.fallbackBlitz && totalGames < settings.minSlowGames && totalGames < settings.maxGames) {
      const remaining = settings.maxGames - totalGames;
      if (onlineStatusEl) {
        onlineStatusEl.textContent = `Se descargaron ${totalGames} partida(s) ${preferredLabel}. Completando con Blitz (${remaining} restantes)...`;
      }
      await sleepMs(220);
      const blitz = await fetchChunk(["blitz"], remaining);
      blitzGames = blitz.games;
      totalGames += blitzGames;
      if (blitz.text && blitz.text.trim()) {
        finalText = finalText && finalText.trim() ? `${finalText.trim()}\n\n${blitz.text.trim()}\n` : blitz.text;
      }
    }

    if (totalGames <= 0) {
      throw new Error("No se encontraron partidas públicas en los ritmos/filtros elegidos.");
    }

    const safeUser = rawUser.replace(/[^a-z0-9_-]+/gi, "") || "user";
    const today = new Date().toISOString().slice(0, 10);
    STATE.remotePgnSources = [{
      name: `lichess_${safeUser}_${today}.pgn`,
      text: finalText,
      provider: "lichess",
      username: rawUser,
      games: totalGames,
      detail: { slow: slow.games, blitz: blitzGames, preferred: settings.preferredPerf.join(",") },
    }];

    if (pgnInputEl) pgnInputEl.value = "";
    setSourceMode("lichess");
    updatePgnSelectionUi();
    if (onlineStatusEl) {
      if (blitzGames > 0) {
        onlineStatusEl.textContent = `Listo: ${totalGames} partida(s) de ${rawUser}. ${slow.games} en ${preferredLabel} + ${blitzGames} Blitz (fallback).`;
      } else {
        onlineStatusEl.textContent = `Listo: ${totalGames} partida(s) de ${rawUser} en ${preferredLabel}.`;
      }
    }
    return true;
  } catch (error) {
    if (onlineStatusEl) onlineStatusEl.textContent = `No se pudo descargar: ${error.message || "error desconocido"}.`;
    return false;
  }
}

function parseChessComArchiveUrl(url) {
  const match = String(url || "").match(/\/games\/(\d{4})\/(\d{2})\/?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { url, year, month };
}

function isArchiveInLastTwelveMonths(year, month) {
  const monthDate = new Date(Date.UTC(year, month - 1, 1));
  const cutoff = new Date();
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 11);
  return monthDate >= cutoff;
}

async function fetchChessComPgn() {
  const rawUser = getConfiguredRemoteUsername();
  if (!rawUser) {
    if (onlineStatusEl) onlineStatusEl.textContent = "Ingresá un usuario de Chess.com.";
    return false;
  }

  const settings = getChessComFetchSettings();
  const preferredLabel = settings.preferredSlowClasses.map((p) => p[0].toUpperCase() + p.slice(1)).join("/");
  if (onlineStatusEl) {
    if (STATE.userMode === "citizen") {
      onlineStatusEl.textContent = `Descargando para ${rawUser}. ${describeChessComNormalProtocol(settings)}`;
    } else {
      onlineStatusEl.textContent = `Buscando hasta ${settings.maxGames} partida(s) de ${rawUser}: primero ${preferredLabel} (últimos 12 meses)...`;
    }
  }

  const monthGamesCache = new Map();
  const seenGames = new Set();
  const selectedPgn = [];

  const loadArchiveGames = async (archiveUrl) => {
    if (monthGamesCache.has(archiveUrl)) return monthGamesCache.get(archiveUrl);
    const response = await fetch(archiveUrl);
    if (!response.ok) {
      throw new Error(`Chess.com respondió ${response.status} al leer ${archiveUrl}.`);
    }
    const payload = await response.json();
    const games = Array.isArray(payload?.games) ? payload.games : [];
    monthGamesCache.set(archiveUrl, games);
    return games;
  };

  const takeGamesFromArchive = (games, allowedClassesSet, remaining) => {
    if (remaining <= 0) return 0;
    const ordered = games.slice().sort((a, b) => (Number(b.end_time) || 0) - (Number(a.end_time) || 0));
    let added = 0;
    for (const game of ordered) {
      if (added >= remaining) break;
      const rules = String(game?.rules || "chess").toLowerCase();
      if (rules !== "chess") continue;
      const timeClass = String(game?.time_class || "").toLowerCase();
      if (!allowedClassesSet.has(timeClass)) continue;
      const pgn = String(game?.pgn || "").trim();
      if (!pgn) continue;
      const key = String(game?.uuid || game?.url || `${timeClass}|${game?.end_time || 0}|${pgn.slice(0, 48)}`);
      if (seenGames.has(key)) continue;
      seenGames.add(key);
      selectedPgn.push(pgn);
      added += 1;
    }
    return added;
  };

  try {
    const archivesUrl = `https://api.chess.com/pub/player/${encodeURIComponent(rawUser.toLowerCase())}/games/archives`;
    const archivesResponse = await fetch(archivesUrl);
    if (!archivesResponse.ok) {
      if (archivesResponse.status === 404) {
        throw new Error("Usuario no encontrado o sin partidas públicas.");
      }
      throw new Error(`Chess.com respondió ${archivesResponse.status}`);
    }
    const archivesPayload = await archivesResponse.json();
    const archives = (Array.isArray(archivesPayload?.archives) ? archivesPayload.archives : [])
      .map(parseChessComArchiveUrl)
      .filter(Boolean)
      .filter((archive) => isArchiveInLastTwelveMonths(archive.year, archive.month))
      .sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));

    if (archives.length === 0) {
      throw new Error("No hay archivos mensuales públicos en los últimos 12 meses.");
    }

    const slowClasses = new Set(settings.preferredSlowClasses);
    let slowGames = 0;
    let blitzGames = 0;
    let totalGames = 0;

    for (const archive of archives) {
      if (totalGames >= settings.maxGames) break;
      const games = await loadArchiveGames(archive.url);
      const added = takeGamesFromArchive(games, slowClasses, settings.maxGames - totalGames);
      slowGames += added;
      totalGames += added;
    }

    if (settings.fallbackBlitz && totalGames < settings.minSlowGames && totalGames < settings.maxGames) {
      const remaining = settings.maxGames - totalGames;
      if (onlineStatusEl) {
        onlineStatusEl.textContent = `Se descargaron ${totalGames} partida(s) ${preferredLabel}. Completando con Blitz (${remaining} restantes)...`;
      }
      await sleepMs(220);
      const blitzClass = new Set(["blitz"]);
      for (const archive of archives) {
        if (totalGames >= settings.maxGames) break;
        const games = await loadArchiveGames(archive.url);
        const added = takeGamesFromArchive(games, blitzClass, settings.maxGames - totalGames);
        blitzGames += added;
        totalGames += added;
      }
    }

    if (totalGames <= 0 || selectedPgn.length === 0) {
      throw new Error("No se encontraron partidas públicas en los ritmos/filtros elegidos.");
    }

    const safeUser = rawUser.replace(/[^a-z0-9_-]+/gi, "") || "user";
    const today = new Date().toISOString().slice(0, 10);
    STATE.remotePgnSources = [{
      name: `chesscom_${safeUser}_${today}.pgn`,
      text: `${selectedPgn.join("\n\n")}\n`,
      provider: "chesscom",
      username: rawUser,
      games: totalGames,
      detail: {
        slow: slowGames,
        blitz: blitzGames,
        preferred: settings.preferredSlowClasses.join(","),
      },
    }];

    if (pgnInputEl) pgnInputEl.value = "";
    setSourceMode("chesscom");
    updatePgnSelectionUi();
    if (onlineStatusEl) {
      if (blitzGames > 0) {
        onlineStatusEl.textContent = `Listo: ${totalGames} partida(s) de ${rawUser}. ${slowGames} en ${preferredLabel} + ${blitzGames} Blitz (fallback).`;
      } else {
        onlineStatusEl.textContent = `Listo: ${totalGames} partida(s) de ${rawUser} en ${preferredLabel}.`;
      }
    }
    return true;
  } catch (error) {
    if (onlineStatusEl) onlineStatusEl.textContent = `No se pudo descargar: ${error.message || "error desconocido"}.`;
    return false;
  }
}

// ---------- Main analyze action ----------

async function analyzePgnFiles() {
  setConfigPreparationProgress("config");
  if (!hasAnyPgnSource(false)) {
    if (isRemoteSourceMode()) {
      analysisStatusEl.textContent = "Completá el usuario de la base online.";
    } else {
      analysisStatusEl.textContent = "Subí al menos un archivo PGN.";
    }
    return;
  }

  analyzeBtn.disabled = true;
  resetAnalysisProgress();
  analysisProgressWrapEl.classList.remove("hidden");
  setConfigPreparationProgress("analyzing", 0);
  stopRoundTimer();
  setThinkingMode(false);
  setScoringInfoVisible(false);
  hideFeedbackStrip();
  STATE.allMistakes = [];
  STATE.positions = [];
  STATE.index = 0;
  STATE.score = 0;
  STATE.sessionPlayed = 0;
  STATE.sessionHits = 0;
  readSessionTimingConfig();
  applyGameFormat(gameFormatEl ? gameFormatEl.value : STATE.gameFormat);
  readDuelPlayersFromInputs();
  resetDuelState();
  updateRoundTimerUi(Math.round(STATE.turnTimeSeconds * 1000));
  updateScoreDisplay();
  renderSessionProgress();
  STATE.historyEntries = [];
  STATE.historySelectedIdx = -1;
  renderHistoryList();
  STATE.analysisContext = null;
  nextBtn.disabled = true;
  skipBtn.disabled = true;
  STATE.targetPositions = clamp(Number(sessionSizeEl.value) || 10, 1, 200);
  const effectiveConfig = getEffectiveAnalysisConfig();
  STATE.scoringSystem = effectiveConfig.scoringSystem;
  updateCompetitiveStatus();

  try {
    if (isRemoteSourceMode() && !hasAnyPgnSource(true)) {
      analysisStatusEl.textContent = `Preparando base online de ${STATE.sourceMode === "chesscom" ? "Chess.com" : "Lichess"}...`;
      const downloaded = STATE.sourceMode === "chesscom"
        ? await fetchChessComPgn()
        : await fetchLichessPgn();
      if (!downloaded || !hasAnyPgnSource(true)) {
        analysisStatusEl.textContent = "No se pudo preparar la base online para iniciar la sesión.";
        setConfigPreparationProgress("config");
        return;
      }
    }

    const sources = await getActivePgnTextSources();
    const allGames = sources.flatMap(({ text }) => splitGamesFromText(text).map((gameText) => ({
      tags: parseTags(gameText),
      sanMoves: tokenizeSanMoves(gameText),
    })));

    if (allGames.length === 0) {
      analysisStatusEl.textContent = "No se encontraron partidas válidas en los PGN.";
      setConfigPreparationProgress("config");
      return;
    }

    const playerName = inferPlayerName(allGames);
    if (!isRemoteSourceMode()) {
      const guess = refreshLocalPlayerGuess();
      if (guess.name) {
        playerNameDetectedEl.textContent = guess.name;
      } else {
        playerNameDetectedEl.textContent = playerName || "No detectado";
      }
    } else {
      playerNameDetectedEl.textContent = playerName || "No detectado";
    }

    if (!playerName) {
      analysisStatusEl.textContent = "No se pudo detectar automáticamente el jugador en los PGN.";
      setConfigPreparationProgress("config");
      return;
    }

    const depth = INTERNAL_ANALYSIS_DEPTH;
    const moveTimeMs = effectiveConfig.moveTimeMs;
    const threshold = effectiveConfig.thresholdCp;
    const candidates = buildRandomCandidateQueue(allGames, playerName);
    const uniqueGameCount = new Set(candidates.map((c) => c.gameIdx)).size;
    if (candidates.length === 0) {
      analysisStatusEl.textContent = "No hay jugadas analizables para el jugador detectado.";
      setConfigPreparationProgress("config");
      return;
    }

    updateAnalysisProgress(0, candidates.length, 0, "Buscando primera posición");
    analysisStatusEl.textContent = `Barajando ${allGames.length} partidas y buscando primera posición para ${playerName}...`;

    const ctx = {
      games: allGames,
      targetName: playerName,
      depth,
      moveTimeMs,
      thresholdCp: threshold,
      candidates,
      total: candidates.length,
      analyzed: 0,
      detected: 0,
      cursor: 0,
      usedGameIndices: new Set(),
      uniqueGameCount,
      repeatMistakes: [],
    };
    STATE.analysisContext = ctx;

    const firstMistake = await findNextMistake(ctx, "Inicio: ");
    if (!firstMistake) {
      analysisStatusEl.textContent = `No se detectaron errores en el umbral. Candidatas analizadas: ${ctx.analyzed}/${ctx.total}.`;
      setConfigPreparationProgress("config");
      return;
    }

    STATE.allMistakes = [firstMistake];
    STATE.positions = [firstMistake];
    if (STATE.userMode === "engineer") {
      sessionHintEl.textContent = `Objetivo de sesión: ${STATE.targetPositions} posiciones. Sistema: ${scoringSystemLabel(STATE.scoringSystem)}. Detectadas por ahora: ${ctx.detected}. Analizadas: ${ctx.analyzed}/${ctx.total}.`;
    } else {
      sessionHintEl.textContent = `Objetivo de sesión: ${STATE.targetPositions} posiciones. Detectadas: ${ctx.detected}.`;
    }
    analysisStatusEl.textContent = "Primera posición detectada. Ya podés jugar.";
    setConfigPreparationProgress("ready");
    setupPanelEl.classList.add("hidden");
    document.body.classList.add("playing-mode");
    gameLayoutEl.classList.remove("hidden");
    startRound();
  } catch (error) {
    analysisStatusEl.textContent = `Error durante el análisis: ${error.message || "desconocido"}`;
    setConfigPreparationProgress("config");
    analysisProgressWrapEl.classList.add("hidden");
    analysisMetricsEl.classList.add("hidden");
  } finally {
    analyzeBtn.disabled = false;
  }
}

function goToConfigStep() {
  if (!hasAnyPgnSource(false)) {
    updatePgnSelectionUi();
    return;
  }
  setSetupStep("config");
  if (analysisStatusEl) analysisStatusEl.textContent = "";
}

// ---------- Events ----------

if (pgnInputEl) {
  pgnInputEl.addEventListener("change", async () => {
    const selected = Array.from(pgnInputEl.files || []);
    if (selected.length > 0) {
      try {
        await appendLocalPgnFiles(selected);
        refreshLocalPlayerGuess();
        clearRemotePgnSources();
        setSourceMode("file");
      } catch (error) {
        if (analysisStatusEl) analysisStatusEl.textContent = `No se pudo leer uno o más PGN: ${error.message || "error desconocido"}.`;
      }
    }
    pgnInputEl.value = "";
    updatePgnSelectionUi();
  });
}

if (pgnLibraryListEl) {
  pgnLibraryListEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const signatureEncoded = target.getAttribute("data-pgn-remove");
    if (!signatureEncoded) return;
    removeLocalPgnSource(decodeURIComponent(signatureEncoded));
    refreshLocalPlayerGuess();
    updatePgnSelectionUi();
  });
}

if (pgnClearBtn) {
  pgnClearBtn.addEventListener("click", () => {
    clearLocalPgnSources();
    refreshLocalPlayerGuess();
    updatePgnSelectionUi();
  });
}

if (sourceBackBtn) {
  sourceBackBtn.addEventListener("click", () => {
    showLandingScreen("Elegí un modo para empezar.");
  });
}

if (dataBackBtn) {
  dataBackBtn.addEventListener("click", () => {
    setUploadWizardStep(1);
  });
}

if (sourceFileBtn) {
  sourceFileBtn.addEventListener("click", () => {
    setSourceMode("file");
    setUploadWizardStep(2);
    updatePgnSelectionUi();
  });
}

if (sourceOnlineBtn) {
  sourceOnlineBtn.addEventListener("click", () => {
    setSourceMode(getRemoteProviderModeFromUi());
    setUploadWizardStep(2);
    updatePgnSelectionUi();
  });
}

modeLevelSwitchEls.forEach((toggleEl) => {
  toggleEl.addEventListener("change", () => {
    setUserMode(toggleEl.checked ? "engineer" : "citizen");
  });
});

if (onlineProviderSelectEl) {
  onlineProviderSelectEl.addEventListener("change", () => {
    const nextMode = getRemoteProviderModeFromUi();
    updateOnlineProviderUi();
    if (isRemoteSourceMode()) {
      setSourceMode(nextMode);
    }
    if (STATE.remotePgnSources.length > 0) {
      clearRemotePgnSources();
      if (onlineStatusEl) onlineStatusEl.textContent = "Plataforma cambiada. Se descargará la base correcta al comenzar.";
    }
    updatePgnSelectionUi();
  });
}

if (onlineUserInputEl) {
  onlineUserInputEl.addEventListener("input", () => {
    if (isRemoteSourceMode() && STATE.remotePgnSources.length > 0) {
      clearRemotePgnSources();
      if (onlineStatusEl) onlineStatusEl.textContent = "Usuario cambiado. Se descargará la nueva base al comenzar.";
    }
    updatePgnSelectionUi();
  });
}

[onlineMinSlowGamesEl, onlineFallbackBlitzEl]
  .filter(Boolean)
  .forEach((control) => {
    control.addEventListener("change", () => {
      if (isRemoteSourceMode() && STATE.remotePgnSources.length > 0) {
        clearRemotePgnSources();
        if (onlineStatusEl) onlineStatusEl.textContent = "Configuración cambiada. Se aplicará en la próxima descarga automática.";
      }
      updatePgnSelectionUi();
    });
  });

if (sessionSizeEl) {
  sessionSizeEl.addEventListener("change", () => {
    if (isRemoteSourceMode() && STATE.remotePgnSources.length > 0) {
      clearRemotePgnSources();
      if (onlineStatusEl) onlineStatusEl.textContent = "Cantidad de posiciones cambiada. Se recalculará la descarga automáticamente.";
    }
    updatePgnSelectionUi();
  });
}

if (goConfigBtn) {
  goConfigBtn.addEventListener("click", () => {
    goToConfigStep();
  });
}

if (landingStudyBtn) {
  landingStudyBtn.addEventListener("click", () => {
    startStudyFromLanding();
  });
}

if (landingDuelBtn) {
  landingDuelBtn.addEventListener("click", () => {
    startDuelFromLanding();
  });
}

if (landingOptionsBtn) {
  landingOptionsBtn.addEventListener("click", () => {
    openOptionsFromLanding();
  });
}

if (landingHistoryBtn) {
  landingHistoryBtn.addEventListener("click", () => {
    showHistoryFromLanding();
  });
}

if (backUploadBtn) {
  backUploadBtn.addEventListener("click", () => {
    setSetupStep("upload");
    setUploadWizardStep(2);
    updatePgnSelectionUi();
  });
}

if (scoringSystemEl) {
  scoringSystemEl.addEventListener("change", () => {
    STATE.scoringSystem = normalizeScoringSystem(scoringSystemEl.value);
    scoringSystemEl.value = STATE.scoringSystem;
    updateScoringSystemHint();
    updateCompetitiveStatus();
  });
}

if (gameFormatEl) {
  gameFormatEl.addEventListener("change", () => {
    applyGameFormat(gameFormatEl.value);
  });
}

if (turnTimeSecondsEl) {
  turnTimeSecondsEl.addEventListener("change", () => {
    readSessionTimingConfig();
    updateRoundTimerUi(Math.round(STATE.turnTimeSeconds * 1000));
    updateCompetitiveStatus();
  });
}

[duelPlayerAEl, duelPlayerBEl]
  .filter(Boolean)
  .forEach((inputEl) => {
    inputEl.addEventListener("change", () => {
      readDuelPlayersFromInputs();
      updateScoreDisplay();
      updateCompetitiveStatus();
      renderSessionProgress();
    });
  });

if (analyzeBtn) {
  analyzeBtn.addEventListener("click", () => {
    void analyzePgnFiles();
  });
}

if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    void nextPosition();
  });
}
if (skipBtn) {
  skipBtn.addEventListener("click", () => {
    if (!STATE.board || !STATE.positions.length || (nextBtn && nextBtn.disabled === false)) return;
    void submitNoMove("manual_skip");
  });
}
if (restartBtn) restartBtn.addEventListener("click", () => restartToSetup());

skipBtn.disabled = true;
STATE.scoringSystem = normalizeScoringSystem(scoringSystemEl ? scoringSystemEl.value : DEFAULT_SCORING_SYSTEM);
if (scoringSystemEl) scoringSystemEl.value = STATE.scoringSystem;
updateScoringSystemHint();
setUserMode("citizen");
readSessionTimingConfig();
readDuelPlayersFromInputs();
applyGameFormat(gameFormatEl ? gameFormatEl.value : "solo");
setSourceMode("file");
setSetupStep("upload");
updatePgnSelectionUi();
updateRoundTimerUi(Math.round(STATE.turnTimeSeconds * 1000));
updateScoreDisplay();
updateCompetitiveStatus();
renderHistoryList();
showLandingScreen("Elegí un modo para empezar.");
void setupStockfish();
buildBoard();
renderBoard();
