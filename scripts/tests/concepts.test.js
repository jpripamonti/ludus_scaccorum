// Unit tests for js/concepts.js: the 14 short lessons. Checks the data shape,
// that every illustrative position is legal and every bestUci is a legal move
// in it, that the texts exist in both languages, and that the Insights
// detector recognises the idea in the concepts it is meant to explain. The
// engine is not involved here; scripts/dev/verify-concepts.js asks Stockfish
// whether each move really is the best one.

"use strict";

const assert = require("assert");
const path = require("path");

const jsDir = path.resolve(__dirname, "..", "..", "js");
require(path.join(jsDir, "ludus.js"));
const { Chess, uciToMove } = require(path.join(jsDir, "chess.js"));
const Insights = require(path.join(jsDir, "insights.js"));
const Concepts = require(path.join(jsDir, "concepts.js"));

const EXPECTED_IDS = ["fork", "pin", "skewer", "discovered_attack", "back_rank_mate", "hanging_piece", "zugzwang",
  "opposition", "passed_pawn", "open_file", "outpost", "development_center", "king_safety", "trade_when_ahead"];

// ---------- API ----------

assert.strictEqual(globalThis.Ludus.Concepts, Concepts, "js/concepts.js registers itself as Ludus.Concepts");
["list", "get", "byTag", "text"].forEach((name) => assert.strictEqual(typeof Concepts[name], "function", `Concepts.${name}`));

const all = Concepts.list();
assert.deepStrictEqual(all.map((concept) => concept.id), EXPECTED_IDS, "14 lessons, in teaching order");
assert.notStrictEqual(Concepts.list(), Concepts.list(), "list() returns a new array each time");
assert.ok(Object.isFrozen(all[0]) && Object.isFrozen(all[0].title) && Object.isFrozen(all[0].tags), "the lessons are immutable");
assert.strictEqual(Concepts.get("fork").id, "fork");
assert.strictEqual(Concepts.get("nope"), null);
assert.strictEqual(Concepts.get(undefined), null);
assert.strictEqual(new Set(all.map((concept) => concept.fen)).size, all.length, "every lesson has its own position");

// ---------- Texts ----------

function sentenceCount(textValue) {
  return textValue.split(/(?<=[.!?])\s+/).filter((part) => part.trim().length > 0).length;
}

all.forEach((concept) => {
  ["es", "en"].forEach((lang) => {
    assert.strictEqual(typeof concept.title[lang], "string", `${concept.id} ${lang} title`);
    assert.ok(concept.title[lang].length >= 3 && concept.title[lang].length <= 40, `${concept.id} ${lang} title length`);
    assert.strictEqual(typeof concept.body[lang], "string", `${concept.id} ${lang} body`);
    const sentences = sentenceCount(concept.body[lang]);
    assert.ok(sentences >= 2 && sentences <= 4, `${concept.id} ${lang} body has ${sentences} sentences (want 2-4)`);
    assert.ok(concept.body[lang].length <= 520, `${concept.id} ${lang} body is ${concept.body[lang].length} chars`);
    assert.ok(!/[{}<>]/.test(concept.body[lang] + concept.title[lang]), `${concept.id} ${lang} has no markup or placeholders`);
  });
  if (concept.id !== "zugzwang") { // the one loan word that is spelled the same in both languages
    assert.notStrictEqual(concept.title.es, concept.title.en, `${concept.id}: the two titles are not the same text`);
  }
  assert.deepStrictEqual(Concepts.text(concept.id, "en"), { title: concept.title.en, body: concept.body.en });
  assert.deepStrictEqual(Concepts.text(concept.id, "es"), { title: concept.title.es, body: concept.body.es });
  // The lessons are registered with i18n as well, so screens can use plain keys.
  assert.strictEqual(globalThis.Ludus.i18n.t(`concept.${concept.id}.title`, null, "en"), concept.title.en);
  assert.strictEqual(globalThis.Ludus.i18n.t(`concept.${concept.id}.body`, null, "es"), concept.body.es);
});
assert.strictEqual(Concepts.text("nope", "en"), null);
assert.strictEqual(Concepts.text("fork", "fr").title, Concepts.get("fork").title.es, "unknown language falls back to Spanish");

// Spanish stays in the rioplatense "vos" register.
assert.ok(/\b(movés|atacás|capturás|enrocá|peleá|Poné|Evitá|fijate|Antes de mover)\b/i.test(all.map((concept) => concept.body.es).join(" ")), "vos forms appear");
assert.ok(!/\b(tú|tienes|puedes|mueves|ataca tu)\b/i.test(all.map((concept) => concept.body.es).join(" ")), "no tú forms");

// ---------- Positions ----------

const TAGS = new Set(Insights.TAGS);

all.forEach((concept) => {
  assert.ok(Chess.isValidFen(concept.fen), `${concept.id}: FEN is structurally valid`);
  const game = new Chess(concept.fen);
  assert.strictEqual(game.fen(), concept.fen, `${concept.id}: FEN round-trips`);
  const waiting = game.turn === "w" ? "b" : "w";
  assert.ok(!game.inCheck(waiting), `${concept.id}: the side that is not to move must not be in check`);
  const legal = game.generateMoves();
  assert.ok(legal.length > 0, `${concept.id}: the position is not over`);

  assert.ok(/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(concept.bestUci), `${concept.id}: bestUci looks like UCI`);
  const move = uciToMove(concept.bestUci, game);
  assert.ok(move, `${concept.id}: bestUci ${concept.bestUci} is legal in its FEN`);

  assert.ok(Array.isArray(concept.tags) && concept.tags.length >= 1, `${concept.id}: has tags`);
  concept.tags.forEach((tag) => assert.ok(TAGS.has(tag), `${concept.id}: ${tag} is a known Insights tag`));
  assert.ok(Concepts.byTag(concept.tags[0]).some((entry) => entry.id === concept.id), `${concept.id}: byTag finds it`);
});
assert.deepStrictEqual(Concepts.byTag("fork_available").map((concept) => concept.id), ["fork"]);
assert.deepStrictEqual(Concepts.byTag("no_such_tag"), []);

// Specific examples say what the text says.
{
  const play = (id) => {
    const concept = Concepts.get(id);
    const game = new Chess(concept.fen);
    const move = uciToMove(concept.bestUci, game);
    const san = require(path.join(jsDir, "chess.js")).moveToSan(game, move);
    game.makeMove(move);
    return { san, game };
  };
  assert.strictEqual(play("back_rank_mate").san, "Ra8#", "the back-rank example is mate in one");
  assert.ok(play("back_rank_mate").game.isCheckmate());
  assert.strictEqual(play("fork").san, "Nc7+", "the knight jumps to c7 with check");
  assert.strictEqual(play("skewer").san, "Ra8+");
  assert.strictEqual(play("discovered_attack").san, "Nxf7+");
  assert.strictEqual(play("hanging_piece").san, "Rxd5");
  assert.strictEqual(play("pin").san, "d5");
  assert.strictEqual(play("outpost").san, "Ne5");
  assert.strictEqual(play("king_safety").san, "O-O");
  assert.strictEqual(play("development_center").san, "e4");
  assert.strictEqual(play("trade_when_ahead").san, "Rxe8+");
  assert.strictEqual(play("open_file").san, "Rc7");
  assert.strictEqual(play("passed_pawn").san, "a6");
  assert.strictEqual(play("opposition").san, "Ke6");
  assert.strictEqual(play("zugzwang").san, "Ka5");
}

// ---------- The detector recognises the ideas it explains ----------

// For these lessons the best move is one Insights can name; the user plays some
// other, quieter move and the analysis must point at the concept's own tag. A
// sentence about a fork, a skewer or a discovered attack is only written when the
// engine's line wins material after it, so each lesson brings Stockfish's line
// for its position (depth ~20, 8 plies).
{
  const ENGINE_LINE = {
    fork: { uci: "b5c7", score: 1063, pv: ["b5c7", "e8d7", "c7a6", "d7c6", "a6b4", "c6b5", "b4c2", "b5a6"] },
    skewer: { uci: "a1a8", score: 395, pv: ["a1a8", "d8e7", "a8h8", "e7e6", "e1d2", "e6d6", "d2c3", "d6e5"] },
    discovered_attack: { uci: "e5f7", score: 481, pv: ["e5f7", "e8d7", "g1f2", "d7c6", "f7h8", "c6d6", "f2f3", "d6d7"] },
    hanging_piece: { uci: "d1d5", score: 410, pv: ["d1d5", "e8e7", "e1f2", "e7e6", "d5d1", "e6e7", "d1e1", "e7d7"] },
    pin: { uci: "d4d5", score: 522, pv: ["d4d5", "e8e7", "d5e6", "f7e6", "e1a1", "e7f6", "a1a7", "d7d5"] },
  };
  const OTHER_MOVE = {
    fork: "e1e2",
    skewer: "e1e2",
    discovered_attack: "g1g2",
    back_rank_mate: "a1a2",
    hanging_piece: "e1e2",
    open_file: "g1f1",
    outpost: "g1f1",
    trade_when_ahead: "g1f1",
    king_safety: "a2a3",
    development_center: "a2a3",
  };
  const EXPECTED_TAG = {
    fork: "fork_available",
    skewer: "pin_or_skewer",
    discovered_attack: "discovered_attack",
    back_rank_mate: "missed_mate",
    hanging_piece: "missed_capture",
    open_file: "open_file",
    outpost: "outpost",
    trade_when_ahead: "trade_when_ahead",
    king_safety: "development",
    development_center: null,
  };
  Object.keys(OTHER_MOVE).forEach((id) => {
    const concept = Concepts.get(id);
    const result = Insights.analyzeChoice({
      fen: concept.fen, userUci: OTHER_MOVE[id], bestUci: concept.bestUci, assessment: { isBest: false, winLossPct: 30 },
      lines: ENGINE_LINE[id] ? [ENGINE_LINE[id]] : undefined,
    });
    assert.ok(!result.error, `${id}: analysis works (${result.error})`);
    const wanted = EXPECTED_TAG[id];
    if (wanted) assert.ok(result.tags.includes(wanted), `${id}: expected ${wanted}, got ${result.tags.join(",") || "nothing"}`);
    result.conceptIds.forEach((conceptId) => assert.ok(Concepts.get(conceptId), `${id}: concept ${conceptId} exists`));
  });
  // The concepts point back at themselves through their own tags.
  const fork = Insights.analyzeChoice({ fen: Concepts.get("fork").fen, userUci: "e1e2", bestUci: "b5c7", assessment: { isBest: false, winLossPct: 30 }, lines: [ENGINE_LINE.fork] });
  assert.deepStrictEqual(fork.conceptIds.filter((id) => id === "fork"), ["fork"]);
  const skewer = Insights.analyzeChoice({ fen: Concepts.get("skewer").fen, userUci: "e1e2", bestUci: "a1a8", assessment: { isBest: false, winLossPct: 30 }, lines: [ENGINE_LINE.skewer] });
  assert.ok(skewer.conceptIds.includes("skewer"));
  const pin = Insights.analyzeChoice({ fen: Concepts.get("pin").fen, userUci: "g1f1", bestUci: "d4d5", assessment: { isBest: false, winLossPct: 30 }, lines: [ENGINE_LINE.pin] });
  // (the pawn push uses a pin that is already there: no pattern message, but the engine line wins the bishop and says so)
  assert.ok(pin.tags.includes("tactic_available") || pin.tags.includes("pin_or_skewer"), `the pin lesson is explained: ${pin.tags}`);
  // Without an engine line nothing is claimed about the pattern (the claim needs the evidence).
  const bare = Insights.analyzeChoice({ fen: Concepts.get("fork").fen, userUci: "e1e2", bestUci: "b5c7", assessment: { isBest: false, winLossPct: 30 } });
  assert.ok(!bare.tags.includes("fork_available"));
}

console.log("concepts.test.js: all assertions passed");
