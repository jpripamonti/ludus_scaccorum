// PGN parsing helpers: tags, SetUp/FEN start position, SAN tokenising and game
// splitting, with the per-game safety budgets (size, comments, plies,
// variation depth).
//
// Moved verbatim out of app.js (same limits, same behaviour). Pure logic; it
// only needs Ludus.chess (for the initial FEN and FEN validation), which is
// resolved at call time. API: docs/ARCHITECTURE.md section 5.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.pgn = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  // Per-game and per-annotation caps applied while parsing PGN text, so one
  // pathological game (huge, a giant single comment, absurd move count, or
  // absurdly nested variations) gets skipped instead of freezing the tab.
  const PGN_GAME_MAX_CHARS = 512 * 1024;
  const PGN_COMMENT_MAX_CHARS = 4000;
  const PGN_MAX_PLIES = 600;
  const PGN_MAX_VARIATION_DEPTH = 12;

  // The chess module is looked up when a helper runs, never at load time.
  function chessApi() {
    return root.Ludus.chess;
  }

  // Strips (parenthesised variations). Bails out once nesting goes past
  // PGN_MAX_VARIATION_DEPTH so a single pathological game (accidental or
  // hostile) cannot force unbounded work here or in later parsing steps; the
  // caller treats an overflowed result as a malformed game and skips it.
  function removeVariations(text) {
    let out = "";
    let level = 0;
    for (const ch of text) {
      if (ch === "(") {
        level += 1;
        if (level > PGN_MAX_VARIATION_DEPTH) return { text: out, overflowed: true };
      } else if (ch === ")") {
        level = Math.max(0, level - 1);
      } else if (level === 0) {
        out += ch;
      }
    }
    return { text: out, overflowed: false };
  }

  // True when any single {...} comment in the raw game text is longer than a
  // normal annotation. Used to skip the game outright rather than spend work
  // stripping it.
  function hasOversizedComment(gameText) {
    const comments = gameText.match(/\{[^}]*\}/g);
    if (!comments) return false;
    return comments.some((comment) => comment.length > PGN_COMMENT_MAX_CHARS);
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

  // Standard PGN semantics: a game that starts from a composed or resumed
  // position (not the initial one) carries SetUp "1" together with a FEN tag.
  // Replaying such a game's SAN moves from the initial position instead would
  // either fail to resolve them or, worse, resolve them against the wrong
  // position if the same move text happens to also be legal from move 1. A game
  // whose SetUp/FEN pair is missing half or names an invalid FEN is reported as
  // invalid so the caller can skip it explicitly instead of guessing.
  function resolveGameStartFen(tags) {
    const { Chess } = chessApi();
    const hasSetUp = String(tags.SetUp || "").trim() === "1";
    const hasFen = typeof tags.FEN === "string" && tags.FEN.trim().length > 0;
    if (!hasSetUp && !hasFen) return { fen: Chess.START_FEN, valid: true };
    if (hasSetUp !== hasFen) return { fen: null, valid: false };
    const fen = tags.FEN.trim();
    if (!Chess.isValidFen(fen)) return { fen: null, valid: false };
    return { fen, valid: true };
  }

  function cleanTagValue(v) {
    const trimmed = String(v || "").trim();
    if (!trimmed || trimmed === "?" || trimmed === "????.??.??") return "";
    return trimmed;
  }

  // Returns the SAN move list, or null when the game is malformed/pathological
  // (variation nesting too deep, or more plies than any realistic game) so the
  // caller can skip just this game instead of crashing or hanging on it.
  function tokenizeSanMoves(gameText) {
    const movesText = gameText
      .split("\n")
      .filter((line) => !line.startsWith("["))
      .join(" ");
    const stripped = removeVariations(
      movesText
        .replace(/\{[^}]*\}/g, " ")
        .replace(/;.*$/gm, " ")
        .replace(/\$\d+/g, " ")
        .replace(/\r/g, " "),
    );
    if (stripped.overflowed) return null;
    const normalized = stripped.text
      .replace(/\d+\.(\.\.)?/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const tokens = normalized.split(" ").filter(Boolean);
    const sanMoves = tokens.filter((token) => !["1-0", "0-1", "1/2-1/2", "*"].includes(token));
    if (sanMoves.length > PGN_MAX_PLIES) return null;
    return sanMoves;
  }

  function splitGamesFromText(text) {
    return text
      .replace(/\r/g, "")
      .split(/\n\n(?=\[Event|\[Site|\[Date|\[Round|\[White|\[Black|\[Result)/g)
      .filter((g) => g.trim().length > 0);
  }

  // Builds one game's parsed record, or null when it trips a parsing budget
  // (oversized text, an oversized single comment, too many plies, or variation
  // nesting too deep) - see PGN_GAME_MAX_CHARS and friends. A single hostile or
  // corrupted game degrades to "skipped", not a frozen tab.
  function buildGameFromText(gameText) {
    if (gameText.length > PGN_GAME_MAX_CHARS) return null;
    if (hasOversizedComment(gameText)) return null;
    const sanMoves = tokenizeSanMoves(gameText);
    if (!sanMoves) return null;
    return { tags: parseTags(gameText), sanMoves };
  }

  const limits = Object.freeze({
    gameMaxChars: PGN_GAME_MAX_CHARS,
    commentMaxChars: PGN_COMMENT_MAX_CHARS,
    maxPlies: PGN_MAX_PLIES,
    maxVariationDepth: PGN_MAX_VARIATION_DEPTH,
  });

  return {
    removeVariations,
    hasOversizedComment,
    parseTags,
    resolveGameStartFen,
    cleanTagValue,
    tokenizeSanMoves,
    splitGamesFromText,
    buildGameFromText,
    limits,
  };
});
