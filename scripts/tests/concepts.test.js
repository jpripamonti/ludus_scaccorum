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
  // (the pawn push uses a pin that is already there and wins a bishop for a pawn: no pattern message, and nothing invented)
  assert.ok(!pin.error && !pin.tags.includes("fork_available"), `the pin lesson is analysed without inventing a pattern: ${pin.tags}`);
  // Without an engine line nothing is claimed about the pattern (the claim needs the evidence).
  const bare = Insights.analyzeChoice({ fen: Concepts.get("fork").fen, userUci: "e1e2", bestUci: "b5c7", assessment: { isBest: false, winLossPct: 30 } });
  assert.ok(!bare.tags.includes("fork_available"));
}

// ---------- American English (the English of the app is American: scripts/tests/ui-screens-spelling.test.js has the full list) ----------

{
  const BRITISH = /\b(?:centre|centres|defence|defences|offence|neighbour\w*|colour\w*|favour\w*|towards|analys(?:e|ed|ing)|practis(?:e|ed|ing)|recognis\w*|organis\w*|grey|whilst|learnt|judgement|behaviour\w*)\b/i;
  all.forEach((concept) => {
    [concept.title.en, concept.body.en].forEach((text) => assert.ok(!BRITISH.test(text), `${concept.id}: British spelling "${(text.match(BRITISH) || [])[0]}" in the English text`));
  });
}

// ---------- Moves quoted in prose follow the notation setting (RT-1) ----------

// The museum prints a lesson's body as it is (js/ui/museum.js) and the coach opens it in a dialog (js/ui/coach.js): neither passes
// it through Ludus.Classics.localizeQuotedMoves, and that helper only knows numbered runs ("15.Bxh7+") anyway. So a lesson never
// quotes a piece move ("Nf3" / "Cf3"): the piece-letter spelling would ignore Settings -> Notation. A pawn move ("e4") is the same
// SAN in both notations and may stay. Facts and timeline entries do quote real moves, in numbered runs, and the museum runs them
// through the helper: the property below proves the helper changes nothing but the piece letters of those moves, and all of them.
{
  const Classics = require(path.join(jsDir, "classics.js"));
  const Facts = require(path.join(jsDir, "facts.js"));
  const chessApi = require(path.join(jsDir, "chess.js"));
  const ES_TO_EN = {};
  Object.keys(chessApi.SPANISH_LETTERS).forEach((english) => { ES_TO_EN[chessApi.SPANISH_LETTERS[english]] = english; });
  // A piece move in SAN with either alphabet (English K Q R B N, Spanish R D T A C): the letter, an optional origin hint,
  // an optional capture, the square, an optional promotion, then check and annotation marks. Whole tokens only.
  const PIECE_MOVE = /(?<![A-Za-z0-9])[KQRBNDTAC](?:[a-h][1-8]?|[1-8])?x?[a-h][1-8](?:=[KQRBNDTAC])?[+#]?[!?]{0,2}(?![A-Za-z0-9])/g;

  const corpus = [];
  all.forEach((concept) => ["es", "en"].forEach((lang) => {
    corpus.push({ where: `concept ${concept.id} title ${lang}`, lang, text: concept.title[lang], lesson: true });
    corpus.push({ where: `concept ${concept.id} body ${lang}`, lang, text: concept.body[lang], lesson: true });
  }));
  Facts.all().forEach((fact) => ["es", "en"].forEach((lang) => corpus.push({ where: `fact ${fact.id} ${lang}`, lang, text: fact.text[lang] })));
  Facts.timeline().forEach((item) => ["es", "en"].forEach((lang) => {
    corpus.push({ where: `timeline ${item.id} title ${lang}`, lang, text: item.title[lang] });
    corpus.push({ where: `timeline ${item.id} text ${lang}`, lang, text: item.text[lang] });
  }));
  assert.ok(corpus.length > 400, `the corpus covers every concept, fact and timeline text in both languages (${corpus.length})`);

  // 1. A lesson quotes no piece move at all.
  corpus.filter((entry) => entry.lesson).forEach((entry) => {
    const found = entry.text.match(PIECE_MOVE);
    assert.ok(!found, `${entry.where}: quotes the piece move ${found}; write it with squares ("the knight to f3"), a lesson is printed as it is and could not follow the notation setting`);
  });

  // 2. Every real move of every text is converted to the other alphabet, and nothing else changes.
  let converted = 0;
  corpus.forEach((entry) => {
    const other = entry.lang === "es" ? "english" : "spanish";
    const same = entry.lang === "es" ? "spanish" : "english";
    // the notation the text was written in: no change at all
    assert.strictEqual(Classics.localizeQuotedMoves(entry.text, entry.lang, { lang: entry.lang, style: same }), entry.text, `${entry.where}: unchanged in its own notation`);
    const out = Classics.localizeQuotedMoves(entry.text, entry.lang, { lang: entry.lang, style: other });
    assert.strictEqual(out.length, entry.text.length, `${entry.where}: only letters were swapped`);
    const letterAt = new Map(); // index -> the letter the move must carry in the other notation
    let match = PIECE_MOVE.exec(entry.text);
    while (match) {
      const swap = (letter) => (entry.lang === "es" ? ES_TO_EN[letter] : chessApi.SPANISH_LETTERS[letter]);
      letterAt.set(match.index, swap(match[0][0]));
      const promotion = match[0].indexOf("=");
      if (promotion >= 0) letterAt.set(match.index + promotion + 1, swap(match[0][promotion + 1]));
      match = PIECE_MOVE.exec(entry.text);
    }
    PIECE_MOVE.lastIndex = 0;
    for (let i = 0; i < entry.text.length; i += 1) {
      if (letterAt.has(i)) {
        assert.strictEqual(out[i], letterAt.get(i), `${entry.where}: the move at ${i} ("${entry.text.slice(Math.max(0, i - 6), i + 8)}") was not converted to ${other} letters (a move quoted outside a numbered run such as "15.Nf3" is out of the helper's reach)`);
        converted += 1;
      } else {
        assert.strictEqual(out[i], entry.text[i], `${entry.where}: "${entry.text.slice(Math.max(0, i - 6), i + 8)}" was altered at ${i} and is not a move`);
      }
    }
  });
  assert.ok(converted >= 20, `the corpus has real moves to convert (${converted} piece letters), so the property is not vacuous`);

  // 3. Ordinary words that begin with a piece letter, in both languages, survive every setting.
  const prose = "Cada Dama y cada Rey cuentan. Torre, Alfil, Caballo, Reina, Tablero, Rook, Knight, Queen, King, Bishop, Check, Dad, Ada, Bea, Ana, Beda. "
    + "La Defensa Alekhine (1.e4 Cf6) es de 1921; Ra1 no es prosa; 18.º campeonato, 1.er Congreso, 2½-2½ y 1-0.";
  ["spanish", "english"].forEach((style) => ["es", "en"].forEach((lang) => {
    const out = Classics.localizeQuotedMoves(prose, lang, { lang, style });
    const words = (text) => text.split(/\s+/);
    words(prose).forEach((word, index) => {
      const after = words(out)[index];
      if (/^[A-Z][a-z]+[,.]?$/.test(word) || /^(?:Dad|Ada|Bea|Ana|Beda)[,.]?$/.test(word)) assert.strictEqual(after, word, `"${word}" is a word, not a move (${lang}, ${style})`);
    });
    assert.strictEqual(out.length, prose.length);
  }));
}

console.log("concepts.test.js: all assertions passed");
