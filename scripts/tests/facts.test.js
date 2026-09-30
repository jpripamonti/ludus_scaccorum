// Unit tests for js/facts.js: the history facts and the timeline.
//
// Checks the data (ids, both languages, length limits, a source hint for every
// entry, every category used, a chronological timeline), the API (all, get,
// byCategory, pick with exclude/category/lang and an injected random, shuffled,
// categories, formatYear, i18n labels) and the claims that can be verified by
// code: the move sequences quoted in the texts are replayed with js/chess.js and
// the Elo percentages are recomputed from the formula. docs/FACTS_SOURCES.md must
// list every id.

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");
const jsDir = path.join(repoRoot, "js");
require(path.join(jsDir, "ludus.js"));
const { Chess, sanToMove } = require(path.join(jsDir, "chess.js"));
const Facts = require(path.join(jsDir, "facts.js"));

const CATEGORIES = ["origins", "champions", "machines", "rules", "openings", "culture", "records", "mind"];
const MAX_TEXT = 260;
const MIN_TEXT = 40;

// ---------- API surface ----------

assert.strictEqual(globalThis.Ludus.Facts, Facts, "js/facts.js registers itself as Ludus.Facts");
["all", "get", "byCategory", "pick", "shuffled", "text", "timeline", "categories", "categoryLabel", "formatYear"].forEach((name) => {
  assert.strictEqual(typeof Facts[name], "function", `Facts.${name}`);
});
assert.deepStrictEqual(Facts.CATEGORIES.slice(), CATEGORIES, "the eight categories, in display order");
assert.ok(Object.isFrozen(Facts.CATEGORIES), "CATEGORIES is frozen");

const all = Facts.all();
const timeline = Facts.timeline();
assert.ok(all.length >= 100, `at least 100 facts (have ${all.length})`);
assert.ok(timeline.length >= 26, `at least 26 milestones (have ${timeline.length})`);
assert.notStrictEqual(Facts.all(), Facts.all(), "all() returns a new array each time");
assert.notStrictEqual(Facts.timeline(), Facts.timeline(), "timeline() returns a new array each time");
assert.ok(Object.isFrozen(all[0]) && Object.isFrozen(all[0].text), "facts are immutable");
assert.ok(Object.isFrozen(timeline[0]) && Object.isFrozen(timeline[0].title), "timeline items are immutable");

// ---------- Facts: shape ----------

function sentenceCount(value) {
  return value.split(/(?<=[.!?])\s+/).filter((part) => part.trim().length > 0).length;
}

const ids = new Set();
all.forEach((fact) => {
  const where = `fact ${fact.id}`;
  assert.ok(/^[a-z]+(-[a-z0-9]+)+$/.test(fact.id), `${where}: id is a lowercase slug`);
  assert.ok(!ids.has(fact.id), `${where}: id is unique`);
  ids.add(fact.id);
  assert.ok(CATEGORIES.includes(fact.cat), `${where}: known category`);
  assert.ok(fact.id.startsWith(`${fact.cat}-`), `${where}: id starts with its category`);
  if ("year" in fact) {
    assert.ok(Number.isInteger(fact.year) && fact.year >= 500 && fact.year <= 2100, `${where}: sane year`);
  } else {
    assert.ok(!("approx" in fact), `${where}: approx only makes sense with a year`);
  }
  if ("approx" in fact) assert.strictEqual(fact.approx, true, `${where}: approx is true or absent`);
  assert.strictEqual(typeof fact.source, "string", `${where}: source hint`);
  assert.ok(fact.source.trim().length >= 10, `${where}: the source hint says something`);
  ["es", "en"].forEach((lang) => {
    const value = fact.text[lang];
    assert.strictEqual(typeof value, "string", `${where}: ${lang} text`);
    assert.ok(value.length >= MIN_TEXT && value.length <= MAX_TEXT, `${where}: ${lang} text is ${value.length} chars (want ${MIN_TEXT}-${MAX_TEXT})`);
    const sentences = sentenceCount(value);
    assert.ok(sentences >= 1 && sentences <= 3, `${where}: ${lang} text has ${sentences} sentences (want 1-3)`);
    assert.ok(!/[<>{}]/.test(value), `${where}: ${lang} text has no markup or placeholders`);
    assert.ok(!/\s{2,}/.test(value) && value === value.trim(), `${where}: ${lang} text has clean whitespace`);
    assert.ok(/[.!?)»”"]$/.test(value), `${where}: ${lang} text ends like a sentence`);
  });
  assert.notStrictEqual(fact.text.es, fact.text.en, `${where}: the two texts differ`);
  // Rioplatense register: no vosotros forms, no peninsular vocabulary.
  assert.ok(!/\b(vosotros|vuestr[oa]s?|habéis|tenéis|ordenadore?s?|móvil(es)?)\b/i.test(fact.text.es), `${where}: es text is rioplatense, not peninsular`);
  assert.ok(!/\btú\b/i.test(fact.text.es), `${where}: es text uses "vos", not "tú"`);
});
assert.strictEqual(ids.size, all.length);

// Every category is used, and none dominates so much that the mix feels off.
CATEGORIES.forEach((cat) => {
  const count = all.filter((fact) => fact.cat === cat).length;
  assert.ok(count >= 8, `category ${cat} has at least 8 facts (have ${count})`);
  assert.strictEqual(Facts.byCategory(cat).length, count, `byCategory(${cat})`);
});
assert.strictEqual(all.length, CATEGORIES.reduce((total, cat) => total + Facts.byCategory(cat).length, 0), "every fact is in exactly one category");

// ---------- Timeline ----------

const tlIds = new Set();
let previousYear = -Infinity;
timeline.forEach((item) => {
  const where = `timeline ${item.id}`;
  assert.ok(/^tl-[a-z0-9]+(-[a-z0-9]+)*$/.test(item.id), `${where}: id is a tl- slug`);
  assert.ok(!tlIds.has(item.id), `${where}: id is unique`);
  tlIds.add(item.id);
  assert.ok(!ids.has(item.id), `${where}: does not collide with a fact id`);
  assert.ok(Number.isInteger(item.year) && item.year >= 500 && item.year <= 2100, `${where}: sane year`);
  assert.ok(item.year > previousYear, `${where}: strictly chronological (${item.year} after ${previousYear})`);
  previousYear = item.year;
  if ("approx" in item) assert.strictEqual(item.approx, true, `${where}: approx is true or absent`);
  assert.ok(typeof item.source === "string" && item.source.trim().length >= 10, `${where}: source hint`);
  ["es", "en"].forEach((lang) => {
    assert.ok(item.title[lang].length >= 3 && item.title[lang].length <= 40, `${where}: ${lang} title is ${item.title[lang].length} chars`);
    const value = item.text[lang];
    assert.ok(value.length >= MIN_TEXT && value.length <= MAX_TEXT, `${where}: ${lang} text is ${value.length} chars`);
    const sentences = sentenceCount(value);
    assert.ok(sentences >= 1 && sentences <= 3, `${where}: ${lang} text has ${sentences} sentences`);
    assert.ok(!/[<>{}]/.test(value + item.title[lang]), `${where}: ${lang} has no markup`);
    assert.ok(/[.!?)»”"]$/.test(value), `${where}: ${lang} text ends like a sentence`);
  });
  assert.notStrictEqual(item.text.es, item.text.en, `${where}: the two texts differ`);
});
assert.strictEqual(tlIds.size, timeline.length);
assert.ok(timeline[0].year <= 700 && timeline[timeline.length - 1].year >= 2020, "the timeline spans origins to the present");

// ---------- get / byCategory ----------

assert.strictEqual(Facts.get(all[3].id), all[3], "get(id) returns the same frozen object as all()");
assert.strictEqual(Facts.get("no-such-fact"), null);
assert.strictEqual(Facts.get(undefined), null);
assert.strictEqual(Facts.get(null), null);
assert.deepStrictEqual(Facts.byCategory("nope"), [], "unknown category is empty");
assert.strictEqual(Facts.byCategory().length, all.length, "no category means every fact");
assert.strictEqual(Facts.byCategory("all").length, all.length);
assert.notStrictEqual(Facts.byCategory("rules"), Facts.byCategory("rules"), "byCategory returns a new array");

// ---------- pick ----------

const seq = (values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

assert.strictEqual(Facts.pick({ random: () => 0 }), all[0], "random 0 picks the first candidate");
assert.strictEqual(Facts.pick({ random: () => 0.9999999 }), all[all.length - 1], "random ~1 picks the last candidate");
assert.strictEqual(Facts.pick({ random: () => 1 }), all[all.length - 1], "random exactly 1 is clamped");
assert.strictEqual(Facts.pick({ random: () => -3 }), all[0], "negative random is clamped");
assert.strictEqual(Facts.pick({ random: () => NaN }), all[0], "NaN random falls back to the first candidate");
assert.strictEqual(Facts.pick().id.length > 0, true, "pick() with no arguments works");
assert.strictEqual(Facts.pick(null) !== null, true);
assert.strictEqual(Facts.pick({ category: "nope" }), null, "unknown category gives null");
assert.strictEqual(Facts.pick({ category: "mind", random: () => 0 }), Facts.byCategory("mind")[0]);

// It never repeats until the pool is exhausted, for every category and for all.
["all", ...CATEGORIES].forEach((category) => {
  const pool = Facts.byCategory(category);
  for (const random of [Math.random, () => 0, () => 0.5, () => 0.999999, seq([0.13, 0.77, 0.4, 0.91, 0.02])]) {
    const seen = [];
    for (let i = 0; i < pool.length; i += 1) {
      const fact = Facts.pick({ category, exclude: seen, random });
      assert.ok(fact, `pick ${i + 1}/${pool.length} in ${category}`);
      assert.ok(!seen.includes(fact.id), `${category}: no repeat before exhaustion (${fact.id})`);
      assert.ok(pool.includes(fact), `${category}: the pick belongs to the category`);
      seen.push(fact.id);
    }
    assert.strictEqual(new Set(seen).size, pool.length, `${category}: every fact was shown once`);
    // Exhausted: the cycle restarts, never null, and not the same fact twice in a row.
    const again = Facts.pick({ category, exclude: seen, random });
    assert.ok(again && pool.includes(again), `${category}: pick after exhaustion still returns a fact`);
    assert.notStrictEqual(again.id, seen[seen.length - 1], `${category}: the last shown fact is not repeated immediately`);
  }
});

// exclude accepts a Set, an array of facts, a single id and garbage.
{
  const firstTwo = all.slice(0, 2);
  const viaSet = Facts.pick({ exclude: new Set(firstTwo.map((fact) => fact.id)), random: () => 0 });
  assert.strictEqual(viaSet, all[2], "exclude as a Set of ids");
  assert.strictEqual(Facts.pick({ exclude: firstTwo, random: () => 0 }), all[2], "exclude as an array of facts");
  assert.strictEqual(Facts.pick({ exclude: all[0].id, random: () => 0 }), all[1], "exclude as one id");
  assert.strictEqual(Facts.pick({ exclude: 42, random: () => 0 }), all[0], "garbage exclude is ignored");
  assert.strictEqual(Facts.pick({ exclude: ["not-an-id"], random: () => 0 }), all[0], "unknown ids in exclude are harmless");
}

// A category with everything excluded but one fact returns exactly that fact.
{
  const pool = Facts.byCategory("openings");
  const exclude = pool.slice(1).map((fact) => fact.id);
  assert.strictEqual(Facts.pick({ category: "openings", exclude, random: Math.random }), pool[0]);
}

// lang: the same fact plus `lang` and `body`; without lang the identical object.
{
  const plain = Facts.pick({ random: () => 0 });
  const es = Facts.pick({ random: () => 0, lang: "es" });
  const en = Facts.pick({ random: () => 0, lang: "en" });
  const odd = Facts.pick({ random: () => 0, lang: "fr" });
  assert.strictEqual(plain, all[0]);
  assert.strictEqual(es.id, plain.id);
  assert.strictEqual(es.lang, "es");
  assert.strictEqual(es.body, plain.text.es);
  assert.strictEqual(en.lang, "en");
  assert.strictEqual(en.body, plain.text.en);
  assert.strictEqual(odd.lang, "es", "unknown languages fall back to Spanish");
  assert.deepStrictEqual(es.text, plain.text);
  assert.ok(Object.isFrozen(es));
}

// ---------- shuffled ----------

{
  const a = Facts.shuffled({ random: () => 0 });
  const b = Facts.shuffled({ random: () => 0 });
  assert.deepStrictEqual(a.map((fact) => fact.id), b.map((fact) => fact.id), "shuffled is deterministic for the same random");
  assert.strictEqual(a.length, all.length);
  assert.deepStrictEqual(a.map((fact) => fact.id).sort(), all.map((fact) => fact.id).sort(), "shuffled is a permutation");
  const real = Facts.shuffled();
  assert.strictEqual(real.length, all.length);
  assert.strictEqual(new Set(real.map((fact) => fact.id)).size, all.length);
  const machines = Facts.shuffled({ category: "machines" });
  assert.ok(machines.length > 0 && machines.every((fact) => fact.cat === "machines"));
  assert.deepStrictEqual(Facts.shuffled({ category: "nope" }), []);
  assert.notStrictEqual(Facts.byCategory("machines"), Facts.shuffled({ category: "machines" }));
  const ordered = Facts.byCategory("machines").map((fact) => fact.id).join();
  let different = 0;
  for (let i = 0; i < 20; i += 1) if (Facts.shuffled({ category: "machines" }).map((fact) => fact.id).join() !== ordered) different += 1;
  assert.ok(different > 0, "a real shuffle changes the order");
}

// ---------- text, categories, formatYear, i18n ----------

{
  const fact = Facts.get("origins-chaturanga");
  assert.strictEqual(Facts.text(fact, "en"), fact.text.en);
  assert.strictEqual(Facts.text(fact.id, "es"), fact.text.es);
  assert.strictEqual(Facts.text("nope", "es"), "");
  assert.strictEqual(Facts.text(null), "");

  const list = Facts.categories();
  assert.deepStrictEqual(list.map((entry) => entry.id), CATEGORIES);
  list.forEach((entry) => {
    assert.ok(entry.label.es.length >= 3 && entry.label.en.length >= 3, `${entry.id} has both labels`);
    assert.strictEqual(entry.labelKey, `facts.cat.${entry.id}`);
    assert.strictEqual(entry.count, Facts.byCategory(entry.id).length);
    assert.strictEqual(Facts.categoryLabel(entry.id, "es"), entry.label.es);
    assert.strictEqual(Facts.categoryLabel(entry.id, "en"), entry.label.en);
    // Registered with i18n under "facts.", in both languages.
    assert.strictEqual(globalThis.Ludus.i18n.t(entry.labelKey, null, "es"), entry.label.es);
    assert.strictEqual(globalThis.Ludus.i18n.t(entry.labelKey, null, "en"), entry.label.en);
  });
  assert.strictEqual(new Set(list.map((entry) => entry.label.es)).size, list.length, "Spanish labels are distinct");
  assert.strictEqual(Facts.categoryLabel("nope", "en"), "");
  ["facts.title", "facts.timeline", "facts.category", "facts.allCategories", "facts.source"].forEach((key) => {
    ["es", "en"].forEach((lang) => {
      const value = globalThis.Ludus.i18n.t(key, null, lang);
      assert.notStrictEqual(value, key, `${key} is registered in ${lang}`);
    });
  });

  assert.strictEqual(Facts.formatYear({ year: 1851 }, "es"), "1851");
  assert.strictEqual(Facts.formatYear({ year: 600, approx: true }, "es"), "c. 600");
  assert.strictEqual(Facts.formatYear({ year: 600, approx: true }, "en"), "c. 600");
  assert.strictEqual(Facts.formatYear(1497), "1497");
  assert.strictEqual(Facts.formatYear({}), "");
  assert.strictEqual(Facts.formatYear(undefined), "");
  assert.strictEqual(Facts.formatYear({ year: NaN }), "");
  assert.strictEqual(Facts.formatYear(timeline[0], "es"), timeline[0].approx ? `c. ${timeline[0].year}` : String(timeline[0].year));
}

// ---------- Claims checked by code ----------

function play(sans) {
  const game = new Chess();
  sans.forEach((san, i) => {
    const move = sanToMove(san, game);
    assert.ok(move, `illegal or unknown move ${san} at ply ${i + 1}`);
    game.makeMove(move);
  });
  return game;
}

// Scholar's mate and Fool's mate, exactly as printed in the texts.
{
  const scholar = Facts.get("openings-scholars-mate");
  assert.ok(scholar.text.es.includes("1.e4 e5 2.Dh5 Cc6 3.Ac4 Cf6?? 4.Dxf7#"), "Spanish text has the scholar's mate line");
  assert.ok(scholar.text.en.includes("1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6?? 4.Qxf7#"), "English text has the scholar's mate line");
  const game = play(["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"]);
  assert.ok(game.isCheckmate(), "scholar's mate is checkmate");

  const fool = Facts.get("records-fools-mate");
  assert.ok(fool.text.es.includes("1.f3 e5 2.g4 Dh4#") && fool.text.en.includes("1.f3 e5 2.g4 Qh4#"), "fool's mate line in both texts");
  const foolGame = play(["f3", "e5", "g4", "Qh4#"]);
  assert.ok(foolGame.isCheckmate(), "fool's mate is checkmate after two moves each");
  assert.strictEqual(foolGame.turn, "w", "White is the mated side (only Black can deliver it)");
}

// Opening lines quoted in the texts are legal.
{
  const berlin = Facts.get("openings-berlin-wall");
  assert.ok(berlin.text.en.includes("1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6"));
  play(["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"]);
  assert.ok(Facts.get("openings-philidor").text.en.includes("1.e4 e5 2.Nf3 d6"));
  play(["e4", "e5", "Nf3", "d6"]);
  assert.ok(Facts.get("openings-kings-gambit").text.en.includes("1.e4 e5 2.f4"));
  play(["e4", "e5", "f4"]);
  assert.ok(Facts.get("openings-queens-gambit").text.en.includes("1.d4 d5 2.c4"));
  play(["d4", "d5", "c4"]);
  assert.ok(Facts.get("openings-sicilian").text.en.includes("1.e4 c5"));
  play(["e4", "c5"]);
}

// The Immortal Game: legal, ends in mate, Anderssen keeps three minor pieces and
// has given up two rooks, a bishop and the queen.
{
  const moves = ("e4 e5 f4 exf4 Bc4 Qh4+ Kf1 b5 Bxb5 Nf6 Nf3 Qh6 d3 Nh5 Nh4 Qg5 Nf5 c6 g4 Nf6 Rg1 cxb5 h4 Qg6 h5 Qg5 Qf3 Ng8 Bxf4 Qf6 "
    + "Nc3 Bc5 Nd5 Qxb2 Bd6 Bxg1 e5 Qxa1+ Ke2 Na6 Nxg7+ Kd8 Qf6+ Nxf6 Be7#").split(" ");
  const game = play(moves);
  assert.ok(game.isCheckmate(), "the Immortal Game ends in checkmate");
  const white = game.board.filter((piece) => piece && piece === piece.toUpperCase());
  const count = (letter) => white.filter((piece) => piece === letter).length;
  assert.deepStrictEqual([count("Q"), count("R"), count("B"), count("N")], [0, 0, 1, 2], "White mates with one bishop and two knights, no queen, no rooks");
  const text = Facts.get("champions-immortal-game").text.en;
  assert.ok(/both rooks, a bishop and his queen/.test(text) && /three remaining minor pieces/.test(text));
}

// The Opera Game: legal, mate on move 17, as the text says.
{
  const moves = "e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#".split(" ");
  const game = play(moves);
  assert.ok(game.isCheckmate());
  assert.strictEqual(Math.ceil(moves.length / 2), 17, "mate arrives on Black's... White's 17th move");
  const fact = Facts.get("champions-opera-game");
  assert.ok(/in 17 moves/.test(fact.text.en) && /en 17 jugadas/.test(fact.text.es));
}

// perft counts quoted in the "first moves" fact.
{
  function perft(game, depth) {
    if (depth === 0) return 1;
    let total = 0;
    game.generateMoves().forEach((move) => {
      const child = game.clone();
      child.makeMove(move);
      total += perft(child, depth - 1);
    });
    return total;
  }
  const start = new Chess();
  assert.strictEqual(perft(start, 1), 20);
  assert.strictEqual(perft(start, 2), 400);
  assert.strictEqual(perft(start, 4), 197281);
  const fact = Facts.get("records-first-moves");
  assert.ok(fact.text.en.includes("197,281") && fact.text.es.includes("197.281") && fact.text.en.includes("400"));

  // Fool's mate: no checkmate is possible in the first three plies, and the only
  // ones at ply 4 are Black's (so White needs at least three moves).
  const mates = [0, 0, 0, 0];
  (function scan(game, ply) {
    if (ply === 4) return;
    game.generateMoves().forEach((move) => {
      const child = game.clone();
      child.makeMove(move);
      if (child.isCheckmate()) mates[ply] += 1;
      scan(child, ply + 1);
    });
  })(start, 0);
  assert.deepStrictEqual(mates, [0, 0, 0, 8], "mate first happens at ply 4 (Black's second move), 8 different ways");
  const fools = Facts.get("records-fools-mate").text;
  assert.ok(/second move; White needs at least three/.test(fools.en) && /segunda jugada; las blancas necesitan al menos tres/.test(fools.es));
}

// Elo expected scores quoted in the text (200 -> 76%, 100 -> 64%).
{
  const expected = (diff) => 1 / (1 + Math.pow(10, -diff / 400));
  assert.strictEqual(Math.round(expected(200) * 100), 76);
  assert.strictEqual(Math.round(expected(100) * 100), 64);
  const fact = Facts.get("rules-elo-expected");
  assert.ok(fact.text.en.includes("76%") && fact.text.en.includes("64%") && fact.text.es.includes("76%") && fact.text.es.includes("64%"));
}

// Arithmetic that appears in facts.
{
  // Chess960: bishops on opposite colours (4 * 4), queen (6 squares left), knights (C(5,2) = 10),
  // and the last three squares are rook, king, rook in that order (1 way).
  assert.strictEqual(4 * 4 * 6 * 10, 960, "Chess960 has 960 starting positions");
  assert.ok(Facts.get("rules-chess960").text.en.includes("960"));
  // 500 ECO codes: A00..E99.
  assert.strictEqual(5 * 100, 500);
  assert.ok(Facts.get("openings-eco").text.en.includes("500"));
  // Karjakin -> Mishra: 12y7m vs 12y4m25d, and Judit 15y4m vs Fischer 15y6m (Fischer's record stood 33 years: 1958 -> 1991).
  assert.strictEqual(1991 - 1958, 33);
  assert.ok(Facts.get("champions-polgar-1991").text.en.includes("33-year-old"));
  // Lasker: 1894 -> 1921 is nearly 27 years, Kasparov/Karpov total 144 games = 48 + 4 * 24 with 21 + 19 + 104.
  assert.strictEqual(1921 - 1894, 27);
  assert.strictEqual(48 + 4 * 24, 144);
  assert.strictEqual(21 + 19 + 104, 144);
  // Ding Liren: 29 wins + 71 draws = 100 games. Gareyev: 35 + 7 + 6 = 48. Najdorf: 39 + 4 + 2 = 45.
  assert.strictEqual(29 + 71, 100);
  assert.strictEqual(35 + 7 + 6, 48);
  assert.strictEqual(39 + 4 + 2, 45);
  // AlphaZero: 28 wins + 72 draws + 0 losses = 100. Kramnik 2 + 13 = 15 games, 8.5-6.5.
  assert.strictEqual(28 + 72, 100);
  assert.strictEqual(2 * 1 + 13 * 0.5, 8.5);
  assert.strictEqual(15 - 8.5, 6.5);
  // Steinitz 10 wins + 5 draws/2 = 12.5, Zukertort 5 + 2.5 = 7.5.
  assert.strictEqual(10 + 5 / 2, 12.5);
  assert.strictEqual(5 + 5 / 2, 7.5);
  // Bronstein 1951: five wins each, fourteen draws: 12-12.
  assert.strictEqual(5 + 14 / 2, 12);
  // Tal 1960: 6 wins + 13 draws/2 = 12.5; Botvinnik 2 + 6.5 = 8.5.
  assert.strictEqual(6 + 13 / 2, 12.5);
  assert.strictEqual(2 + 13 / 2, 8.5);
  // Deep Blue 1997: 2 wins + 3 draws/2 = 3.5 vs Kasparov 1 + 1.5 = 2.5 ; 1996: Kasparov 3 wins + 2 draws... 4-2.
  assert.strictEqual(2 + 3 / 2, 3.5);
  assert.strictEqual(1 + 3 / 2, 2.5);
  assert.strictEqual(3 + 2 / 2 + 0, 4);
  // 7.5-6.5 over 14 games.
  assert.strictEqual(7.5 + 6.5, 14);
  // Knight tours are quoted as "more than 26 trillion" (26,534,728,821,064) directed closed tours.
  assert.ok(26534728821064 > 26e12 && 26534728821064 < 27e12);
  // Eight queens: 92 solutions = 11 * 8 + 1 * 4, 12 fundamental.
  assert.strictEqual(11 * 8 + 1 * 4, 92);
}

// The eight queens count is cheap to recompute by brute force: check the "92".
{
  function queens(n) {
    let count = 0;
    const cols = [];
    (function place(row) {
      if (row === n) {
        count += 1;
        return;
      }
      for (let col = 0; col < n; col += 1) {
        if (cols.every((c, r) => c !== col && Math.abs(c - col) !== row - r)) {
          cols.push(col);
          place(row + 1);
          cols.pop();
        }
      }
    })(0);
    return count;
  }
  assert.strictEqual(queens(8), 92);
  const fact = Facts.get("mind-eight-queens");
  assert.ok(fact.text.en.includes("92 solutions") && fact.text.en.includes("12"));
}

// ---------- Guard against claims that were investigated and dropped ----------

{
  const everything = all.concat(timeline).map((entry) => `${entry.text.es}\n${entry.text.en}`).join("\n");
  [
    /pawn and (the )?move/i, // Steinitz "God" anecdote: an admitted invention
    /peón de ventaja a Dios/i,
    /GothamChess|Botez Gambit|Pepe Cuenca/, // unverified trivia
    /doctor(ate)? in law|doctorado en derecho/i, // Alekhine's doctorate could not be documented
    /longest possible game|partida más larga posible/i,
  ].forEach((pattern) => assert.ok(!pattern.test(everything), `dropped claim is back: ${pattern}`));
}

// ---------- The sources document lists every id ----------

{
  const docPath = path.join(repoRoot, "docs", "FACTS_SOURCES.md");
  assert.ok(fs.existsSync(docPath), "docs/FACTS_SOURCES.md exists");
  const doc = fs.readFileSync(docPath, "utf8");
  all.concat(timeline).forEach((entry) => {
    assert.ok(doc.includes(`\`${entry.id}\``), `docs/FACTS_SOURCES.md lists ${entry.id}`);
  });
  assert.ok(/Reader classes/.test(doc), "docs/FACTS_SOURCES.md has the Reader classes section");
  ["rd-carousel", "rd-card", "rd-chip", "rd-year", "rd-text", "rd-controls", "rd-btn", "rd-prev", "rd-next", "rd-toggle", "rd-progress", "rd-ring", "rd-live"].forEach((cls) => {
    assert.ok(doc.includes(cls), `Reader classes lists ${cls}`);
  });
}

console.log(`facts.test.js: all checks passed (${all.length} facts, ${timeline.length} timeline entries, ${CATEGORIES.length} categories)`);
