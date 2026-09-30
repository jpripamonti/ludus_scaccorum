// Unit tests for js/insights.js: position features, static exchange based
// "hanging" detection, and the tags / messages analyzeChoice produces. Every
// position is hand-built so the truth is known; the engine is not involved
// (the assessment the app would supply is injected). Plain assert, no network,
// deterministic.

"use strict";

const assert = require("assert");
const path = require("path");

const jsDir = path.resolve(__dirname, "..", "..", "js");
require(path.join(jsDir, "ludus.js"));
const { Chess } = require(path.join(jsDir, "chess.js"));
const Insights = require(path.join(jsDir, "insights.js"));
const Concepts = require(path.join(jsDir, "concepts.js"));

const { positionFeatures, analyzeChoice, moveFeatures, tagLabelKey, renderMessage, renderMessages, TAGS } = Insights;
const { i18n } = globalThis.Ludus;

// What the scoring layer would say about a clearly worse move.
const WORSE = Object.freeze({ isBest: false, winLossPct: 25 });

function analyze(fen, userUci, bestUci, extra) {
  const result = analyzeChoice(Object.assign({ fen, userUci, bestUci, assessment: WORSE }, extra));
  assert.ok(!result.error, `analyzeChoice must not fail: ${result.error}`);
  return result;
}

function message(result, tag) {
  return result.messages.find((entry) => entry.tag === tag);
}

function text(result, tag, lang) {
  return renderMessage(message(result, tag), lang || "en");
}

// ---------- API surface, catalog, strings ----------

assert.strictEqual(globalThis.Ludus.Insights, Insights, "js/insights.js registers itself as Ludus.Insights");
["positionFeatures", "analyzeChoice", "moveFeatures", "tagLabelKey", "renderMessage", "renderMessages"].forEach((name) => {
  assert.strictEqual(typeof Insights[name], "function", `Insights.${name}`);
});

const REQUIRED_TAGS = ["hangs_piece", "missed_capture", "missed_mate", "allows_mate", "missed_check", "quiet_best",
  "sacrifice_best", "back_rank", "fork_available", "pin_or_skewer", "development", "king_safety", "endgame_technique",
  "time_trouble", "solid"];
REQUIRED_TAGS.forEach((tag) => assert.ok(TAGS.includes(tag), `catalog has ${tag}`));
assert.ok(Object.isFrozen(TAGS), "the tag catalog is frozen");

TAGS.forEach((tag) => {
  const key = tagLabelKey(tag);
  assert.ok(key.startsWith("insight."), `label key of ${tag} uses the insight. prefix`);
  ["es", "en"].forEach((lang) => assert.notStrictEqual(i18n.t(key, null, lang), key, `${tag} has a ${lang} label`));
});
assert.strictEqual(tagLabelKey("no_such_tag"), "insight.tag.other", "unknown tags get the generic label");

// Every string is registered in both languages under the insight. prefix, and
// every message template fits in 140 characters even with worst-case values.
{
  const { STRINGS, localizeParams } = Insights.internals;
  assert.deepStrictEqual(Object.keys(STRINGS.es).sort(), Object.keys(STRINGS.en).sort(), "es and en define the same keys");
  Object.keys(STRINGS.es).forEach((key) => assert.ok(key.startsWith("insight."), `${key} has the insight. prefix`));

  const worst = {
    san: "Qa1xb2#", best: "Qa1xb2#", reply: "Qa1xb2#", piece: "N", target: "N", slider: "B", pinned: "N", front: "Q",
    behind: "R", sq: "h8", sq2: "h8", file: "h", n: 12, why: "outnumbered",
    targets: [{ p: "R", sq: "a8" }, { p: "K", sq: "e8" }, { p: "Q", sq: "d8" }],
  };
  const notMessages = /^insight\.(piece|pieceDef|fmt|why|tag)\./;
  const HEDGES = /(?<!\p{L})(looks?|looked|parecía|may|might|probably|seems?|usually|would|can|could|parece|puede|probablemente|quizá|suelen?|podría|conviene|atacaría)(?!\p{L})/iu;
  // Messages that state something the board (or an exact search) proves; the
  // rest interpret ("looks like", "may", ...) and must be hedged.
  const FACTS = new Set(["insight.allows_mate.san", "insight.missed_mate.san", "insight.missed_mate.forced",
    "insight.missed_check", "insight.missed_promotion", "insight.time_trouble", "insight.time_trouble.out",
    "insight.pin", "insight.discovered", "insight.outpost", "insight.open_file", "insight.open_file.seventh"]);
  let rendered = 0;
  ["es", "en"].forEach((lang) => {
    Object.keys(STRINGS[lang]).filter((key) => !notMessages.test(key)).forEach((key) => {
      const out = i18n.t(key, localizeParams(worst, lang), lang);
      rendered += 1;
      assert.ok(out.length <= 140, `${lang} ${key} is ${out.length} chars: ${out}`);
      assert.ok(!/[{}]/.test(out), `${lang} ${key} has an unfilled placeholder: ${out}`);
      if (!FACTS.has(key)) assert.ok(HEDGES.test(STRINGS[lang][key]), `${lang} ${key} should be hedged: ${STRINGS[lang][key]}`);
    });
  });
  assert.ok(rendered >= 80, "both languages were rendered for every message key");
}

// ---------- positionFeatures ----------

{
  const start = positionFeatures(Chess.START_FEN);
  assert.strictEqual(start.phase, "opening");
  assert.deepStrictEqual(start.material, { w: 39, b: 39, diff: 0 });
  assert.strictEqual(start.legalCount, 20);
  assert.strictEqual(start.inCheck, false);
  assert.deepStrictEqual(start.hanging, { w: [], b: [] });
  assert.deepStrictEqual(start.passedPawns, { w: [], b: [] });
  assert.deepStrictEqual(start.backRankWeak, { w: false, b: false }, "a king walled in by its own pieces is not a back-rank target");
  assert.deepStrictEqual(start.kings, {
    w: { sq: "e1", shield: 3, openFiles: 0, halfOpenFiles: 0 },
    b: { sq: "e8", shield: 3, openFiles: 0, halfOpenFiles: 0 },
  });
  const thin = positionFeatures("6k1/5ppp/8/8/8/8/6P1/6K1 w - - 0 1").kings.w;
  assert.deepStrictEqual(thin, { sq: "g1", shield: 1, openFiles: 0, halfOpenFiles: 2 }, "f and h are half open: only Black has pawns there");
  assert.strictEqual(positionFeatures("not a fen"), null, "bad FEN -> null");
  assert.strictEqual(positionFeatures(null), null);
}

assert.strictEqual(positionFeatures("8/5k2/8/3P4/8/8/8/6K1 w - - 0 1").phase, "endgame");
assert.strictEqual(positionFeatures("3q2k1/5ppp/8/8/8/8/5PPP/R2Q2K1 w - - 0 1").phase, "middlegame", "two queens and a rook: 23 points of non-pawn material");
assert.deepStrictEqual(positionFeatures("4k3/8/8/8/8/8/8/R3K3 w - - 0 1").material, { w: 5, b: 0, diff: 5 });

{
  // Hanging: the rook is attacked by the queen and only the king's distance matters.
  assert.deepStrictEqual(positionFeatures("4k3/8/8/8/3q4/8/8/3RK3 w - - 0 1").hanging.w, [], "rook defended by the king is not hanging (Qxd1+ Kxd1)");
  const loose = positionFeatures("4k3/8/8/8/3q4/8/8/3R2K1 w - - 0 1");
  assert.deepStrictEqual(loose.hanging.w, ["d1"], "attacked and undefended");
  assert.strictEqual(loose.hangingDetail.w[0].why, "free");
  assert.strictEqual(loose.hangingDetail.w[0].loss, 5);
  // Attacked by a cheaper piece although defended.
  const cheaper = positionFeatures("4k3/8/8/2p5/3N4/8/8/3RK3 w - - 0 1");
  assert.deepStrictEqual(cheaper.hanging.w, ["d4"]);
  assert.strictEqual(cheaper.hangingDetail.w[0].why, "cheaper");
  // An even trade offer, and a defended piece, are not hanging; the loose enemy knight is.
  const trade = positionFeatures("4k3/8/8/5n2/3N4/4P3/4K3/8 w - - 0 1");
  assert.deepStrictEqual(trade.hanging.w, [], "knight defended by a pawn, attacked by a knight");
  assert.deepStrictEqual(trade.hanging.b, ["f5"], "the black knight is attacked by Nd4 and has no defender");
  // A pinned attacker cannot capture, so it does not make anything hang.
  assert.deepStrictEqual(positionFeatures("4k3/4n3/8/5B2/8/8/8/4R1K1 w - - 0 1").hanging.w, [], "Ne7 is pinned to the king by Re1");
}

{
  assert.deepStrictEqual(positionFeatures("8/5k2/8/3P4/8/8/8/6K1 w - - 0 1").passedPawns, { w: ["d5"], b: [] });
  assert.deepStrictEqual(positionFeatures("8/5k2/4p3/3P4/8/8/8/6K1 w - - 0 1").passedPawns, { w: [], b: [] }, "opposed by a pawn on a neighbouring file");
  assert.deepStrictEqual(positionFeatures("6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1").backRankWeak, { w: true, b: true });
  assert.deepStrictEqual(positionFeatures("6k1/5pp1/7p/8/8/8/5PPP/6K1 w - - 0 1").backRankWeak, { w: true, b: false }, "h6 gives Black luft");
  const stalemate = positionFeatures("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
  assert.strictEqual(stalemate.isStalemate, true);
  assert.strictEqual(stalemate.isCheckmate, false);
  const mated = positionFeatures("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1");
  assert.strictEqual(mated.isCheckmate, true);
  assert.strictEqual(mated.inCheck, true);
  assert.strictEqual(mated.legalCount, 0);
}

// ---------- analyzeChoice: what went wrong ----------

// Hanging a piece.
{
  const free = analyze("4k3/8/p7/8/8/2N5/8/4K3 w - - 0 1", "c3b5", "e1d2");
  assert.ok(free.tags.includes("hangs_piece"), "Nb5 walks into the a6 pawn");
  assert.strictEqual(free.messages[0].key, "insight.hangs_piece.moved");
  assert.deepStrictEqual({ piece: free.messages[0].raw.piece, sq: free.messages[0].raw.sq, why: free.messages[0].raw.why },
    { piece: "N", sq: "b5", why: "free" });
  assert.ok(free.conceptIds.includes("hanging_piece"));
  assert.ok(/Nb5/.test(text(free, "hangs_piece", "en")) && /b5/.test(text(free, "hangs_piece", "en")), "the message names the move and the square");

  const bishop = analyze("4k3/8/p7/8/8/8/4B3/4K3 w - - 0 1", "e2b5", "e1d2");
  assert.strictEqual(bishop.messages[0].key, "insight.hangs_piece.moved", "a bishop walking into a pawn capture");
  assert.deepStrictEqual({ piece: bishop.messages[0].raw.piece, sq: bishop.messages[0].raw.sq }, { piece: "B", sq: "b5" });
  assert.strictEqual(text(bishop, "hangs_piece", "es"), "Después de Bb5+, tu alfil en b5 parece quedar sin protección, así que probablemente perdés material.");

  const cheaper = analyze("4k3/8/p7/8/8/2NB4/8/4K3 w - - 0 1", "c3b5", "e1d2");
  assert.strictEqual(cheaper.messages[0].raw.why, "cheaper", "defended by the bishop, but a pawn wins the exchange");

  // Not hanging: defended by a pawn against an equal trade, or against a rook.
  assert.ok(!analyze("4k3/8/5n2/8/2P5/2N5/8/4K3 w - - 0 1", "c3d5", "e1d2").tags.includes("hangs_piece"), "Nd5 is defended by c4 (a knight trade is fine)");
  assert.ok(!analyze("3rk3/8/8/8/2P5/2N5/8/4K3 w - - 0 1", "c3d5", "e1d2").tags.includes("hangs_piece"), "a rook does not take a pawn-protected knight");
  assert.ok(!analyze("4k3/4n3/8/8/8/8/2B5/4R1K1 w - - 0 1", "c2f5", "g1f1").tags.includes("hangs_piece"), "the only attacker of f5 is pinned");

  // The move takes away a defender: the piece that hangs is not the one that moved.
  const exposed = analyze("4k3/8/5n2/8/4P3/2N5/8/4K3 w - - 0 1", "c3d5", "e1d2");
  assert.strictEqual(exposed.messages[0].key, "insight.hangs_piece.exposed");
  assert.deepStrictEqual({ piece: exposed.messages[0].raw.piece, sq: exposed.messages[0].raw.sq, why: exposed.messages[0].raw.why },
    { piece: "P", sq: "e4", why: "free" });
  assert.ok(/opened a line or removed a defender/.test(text(exposed, "hangs_piece", "en")));

  // Already in danger and not addressed vs. best saving it.
  const left = analyze("4k3/8/8/8/8/1n6/8/R3K3 w - - 0 1", "e1e2", "a1a3");
  assert.strictEqual(message(left, "hangs_piece").key, "insight.hangs_piece.left");
  assert.ok(left.tags.includes("quiet_best"));
  assert.strictEqual(message(left, "quiet_best").key, "insight.quiet_best.saves", "Ra3 rescues the rook");

  // The best move gives up the same material: not blamed on the user's move.
  const bothHang = analyze("4k3/8/p7/8/8/2N5/8/4K3 w - - 0 1", "c3b5", "c3b5");
  assert.deepStrictEqual(bothHang.tags, [], "user played the best move");
}

// Missed captures.
{
  const free = analyze("4k3/8/8/3b4/8/8/8/3RK3 w - - 0 1", "e1e2", "d1d5");
  assert.deepStrictEqual(free.tags, ["missed_capture"]);
  assert.strictEqual(free.messages[0].key, "insight.missed_capture.free");
  assert.deepStrictEqual({ target: free.messages[0].raw.target, sq: free.messages[0].raw.sq }, { target: "B", sq: "d5" });
  assert.deepStrictEqual(free.conceptIds, ["hanging_piece"]);
  assert.ok(/Rxd5/.test(text(free, "missed_capture", "en")));

  const cheap = analyze("3qk3/8/8/3n4/4P3/8/8/4K3 w - - 0 1", "e1e2", "e4d5");
  assert.strictEqual(message(cheap, "missed_capture").key, "insight.missed_capture.cheaper", "a pawn takes a defended knight");

  // En passant: the message names the pawn that is taken, not the landing square.
  const enPassant = analyze("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "e1e2", "e5d6");
  assert.strictEqual(enPassant.messages[0].key, "insight.missed_capture.free");
  assert.deepStrictEqual({ target: enPassant.messages[0].raw.target, sq: enPassant.messages[0].raw.sq }, { target: "P", sq: "d5" });

  // An even trade is not a missed capture.
  assert.ok(!analyze("3rk3/8/8/8/8/8/8/3RK3 w - - 0 1", "e1e2", "d1d8").tags.includes("missed_capture"));
}

// Mates.
{
  const missed = analyze("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1", "a1a7", "a1a8");
  assert.deepStrictEqual(missed.tags, ["missed_mate", "back_rank"]);
  assert.strictEqual(missed.messages[0].key, "insight.missed_mate.san");
  assert.ok(text(missed, "missed_mate").startsWith("Ra8#"));
  assert.ok(missed.conceptIds.includes("back_rank_mate"));
  assert.ok(!missed.tags.includes("missed_check") && !missed.tags.includes("quiet_best"), "mate in one silences the weaker tags");

  const allowed = analyze("3r2k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", "a1a4", "h2h3");
  assert.ok(allowed.tags.includes("allows_mate") && allowed.tags.includes("back_rank"));
  assert.strictEqual(allowed.messages[0].key, "insight.allows_mate.san");
  assert.strictEqual(allowed.messages[0].raw.reply, "Rd1#");
  assert.ok(allowed.conceptIds.includes("back_rank_mate"));
  assert.ok(!analyze("3r2k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", "a1c1", "h2h3").tags.includes("allows_mate"), "Rc1 keeps the back rank covered");

  // A forced mate deeper than one move comes from the engine assessment.
  const deep = analyzeChoice({
    fen: "5r1k/6pp/7N/8/8/8/Q7/K7 w - - 0 1", userUci: "a1b1", bestUci: "a2g8",
    assessment: { isBest: false, winLossPct: 60, reason: "missed_mate", bestScore: 98000, userScore: 300 },
  });
  assert.ok(deep.tags.includes("missed_mate") && deep.tags.includes("sacrifice_best"), "the queen sacrifice starts the mate");
  assert.strictEqual(message(deep, "missed_mate").key, "insight.missed_mate.forced");
  assert.strictEqual(message(deep, "missed_mate").raw.n, 2);
  assert.ok(/mate in 2/.test(text(deep, "missed_mate")));
  assert.ok(!deep.tags.includes("quiet_best") && !deep.tags.includes("endgame_technique"), "a forced mate silences the strategic remarks");

  const hint = analyzeChoice({
    fen: "3r2k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", userUci: "a1c1", bestUci: "h2h3",
    assessment: { isBest: false, winLossPct: 90, reason: "allows_mate", userScore: -98000, bestScore: 0 },
  });
  assert.strictEqual(message(hint, "allows_mate").key, "insight.allows_mate.forced", "a mate in 2 is not visible to a mate-in-one search: the engine assessment supplies it");
  assert.strictEqual(message(hint, "allows_mate").raw.n, 2);
}

// Tactical patterns in the best move.
{
  const fork = analyze("r3k3/8/8/1N6/8/8/P7/4K3 w - - 0 1", "e1e2", "b5c7");
  assert.ok(fork.tags.includes("fork_available"));
  assert.ok(!fork.tags.includes("missed_check"), "the fork explains the check");
  assert.ok(fork.conceptIds.includes("fork"));
  assert.deepStrictEqual(message(fork, "fork_available").raw.targets, [{ p: "K", sq: "e8" }, { p: "R", sq: "a8" }]);
  assert.ok(/fork/.test(text(fork, "fork_available")) && /rook on a8/.test(text(fork, "fork_available")));
  assert.ok(/doble ataque/.test(text(fork, "fork_available", "es")) && /torre en a8/.test(text(fork, "fork_available", "es")));

  const queenFork = analyze("4k3/8/q7/1N6/8/8/P7/4K3 w - - 0 1", "e1e2", "b5c7");
  assert.ok(queenFork.tags.includes("fork_available"));

  // A "fork" whose forking piece can just be taken is not a fork.
  const unsafe = analyze("r2qk3/8/8/1N6/8/8/P7/4K3 w - - 0 1", "e1e2", "b5c7");
  assert.ok(!unsafe.tags.includes("fork_available"), "the queen on d8 simply takes the knight on c7");
  assert.ok(analyze("r3k3/1p6/8/1N6/8/8/P7/4K3 w - - 0 1", "e1e2", "b5c7").tags.includes("fork_available"), "a pawn on b7 does not cover c7");

  const skewer = analyze("3k3q/8/8/8/8/8/8/R3K3 w - - 0 1", "e1e2", "a1a8");
  assert.ok(skewer.tags.includes("pin_or_skewer"));
  assert.strictEqual(message(skewer, "pin_or_skewer").key, "insight.skewer");
  assert.strictEqual(message(skewer, "pin_or_skewer").raw.behind, "Q");
  assert.ok(skewer.conceptIds.includes("skewer"));

  const pin = analyze("4k3/8/2n5/8/8/8/4B3/4K3 w - - 0 1", "e1d1", "e2b5");
  assert.strictEqual(message(pin, "pin_or_skewer").key, "insight.pin");
  assert.deepStrictEqual({ p: message(pin, "pin_or_skewer").raw.pinned, sq: message(pin, "pin_or_skewer").raw.sq }, { p: "N", sq: "c6" });
  assert.ok(pin.conceptIds.includes("pin"));

  const discovered = analyze("4k3/5q2/8/4N3/8/8/8/4R1K1 w - - 0 1", "g1g2", "e5f7");
  assert.ok(discovered.tags.includes("discovered_attack"));
  assert.ok(discovered.tags.includes("missed_capture"), "it also wins the queen");
  assert.ok(discovered.conceptIds.includes("discovered_attack"));
}

// Sacrifices, quiet moves, checks, promotions.
{
  const sacrifice = analyze("5r1k/6pp/7N/8/8/8/Q7/K7 w - - 0 1", "a1b1", "a2g8");
  assert.ok(sacrifice.tags.includes("sacrifice_best"));
  assert.ok(!sacrifice.tags.includes("quiet_best"));
  assert.strictEqual(moveFeatures("5r1k/6pp/7N/8/8/8/Q7/K7 w - - 0 1", "a2g8").sacrifice, true, "a queen for nothing");
  assert.strictEqual(moveFeatures("6k1/pp3ppp/2n5/8/4B3/8/PPP2PPP/R3K3 w - - 0 1", "e4c6").sacrifice, false, "an even bishop-for-knight trade");
  assert.strictEqual(moveFeatures("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1", "a1a8").sacrifice, false, "mate is never a sacrifice");
  assert.strictEqual(moveFeatures("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1", "a1a8").mate, true);
  assert.strictEqual(moveFeatures("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1", "a1a9"), null, "illegal move -> null");

  // Quiet best move only when the user went for a forcing move, or there is a reason.
  const forcing = analyze("4k3/p7/8/8/8/8/8/R3K3 w - - 0 1", "a1a7", "e1f1");
  assert.ok(forcing.tags.includes("quiet_best"));
  assert.strictEqual(message(forcing, "quiet_best").key, "insight.quiet_best.generic");
  const plain = analyze("4k3/p7/8/8/8/8/8/R3K3 w - - 0 1", "e1d1", "e1f1");
  assert.deepStrictEqual(plain.tags, [], "two quiet moves: nothing to teach");
  assert.strictEqual(plain.messages[0].key, "insight.no_clear_reason", "we say so instead of inventing a reason");

  const check = analyze("4k3/8/8/8/8/8/8/4KB2 w - - 0 1", "e1d2", "f1b5");
  assert.deepStrictEqual(check.tags, ["missed_check"]);

  const promotion = analyze("8/4P1k1/8/8/8/8/8/4K3 w - - 0 1", "e1d2", "e7e8q");
  assert.deepStrictEqual(promotion.tags, ["missed_promotion"]);
}

// Strategic themes.
{
  const dev = analyze("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", "f3g5", "e1g1");
  assert.deepStrictEqual(dev.tags, ["development"]);
  assert.strictEqual(dev.messages[0].key, "insight.development.twice");
  assert.ok(dev.conceptIds.includes("development_center"));
  // A central pawn move or a developing move is not blamed.
  assert.ok(!analyze("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", "d2d3", "e1g1").tags.includes("development"));
  assert.ok(!analyze("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", "b1c3", "e1g1").tags.includes("development"));

  const shelter = analyze("r4rk1/pp3ppp/2p1p3/q7/8/2N1PN2/PP3PPP/R2Q1RK1 w - - 0 1", "g2g4", "a2a3");
  assert.ok(shelter.tags.includes("king_safety"));
  assert.strictEqual(message(shelter, "king_safety").raw.sq, "g2");
  assert.ok(!analyze("r4rk1/pp3ppp/2p1p3/q7/8/2N1PN2/PP3PPP/R2Q1RK1 w - - 0 1", "a2a3", "g2g4").tags.includes("king_safety"));

  const king = analyze("8/pp3k2/2p5/8/8/2P5/PP3K2/8 w - - 0 1", "b2b3", "f2e3");
  assert.deepStrictEqual(king.tags, ["endgame_technique"]);
  assert.strictEqual(king.messages[0].key, "insight.endgame.king");
  const passed = analyze("8/5k2/8/3P4/8/8/8/6K1 w - - 0 1", "g1f2", "d5d6");
  assert.strictEqual(passed.messages[0].key, "insight.endgame.passed");
  assert.ok(passed.conceptIds.includes("passed_pawn"));

  const seventh = analyze("r5k1/pp3ppp/5n2/8/8/3B4/PP3PPP/2R3K1 w - - 0 1", "g1f1", "c1c7");
  assert.deepStrictEqual(seventh.tags, ["open_file"]);
  assert.strictEqual(seventh.messages[0].key, "insight.open_file.seventh");
  const onto = analyze("4k3/pp3ppp/8/8/8/8/PP3PPP/1R2K3 w - - 0 1", "a2a3", "b1d1");
  assert.strictEqual(onto.messages[0].key, "insight.open_file");
  assert.strictEqual(onto.messages[0].raw.file, "d");

  const outpost = analyze("4k3/ppp3pp/8/8/3P4/5N2/PPP2PPP/4K3 w - - 0 1", "a2a3", "f3e5");
  assert.deepStrictEqual(outpost.tags, ["outpost"]);
  assert.ok(outpost.conceptIds.includes("outpost"));
  // Not an outpost when an enemy pawn can still challenge the square.
  assert.ok(!analyze("4k3/ppp2pp1/8/8/3P4/5N2/PPP2PPP/4K3 w - - 0 1", "a2a3", "f3e5").tags.includes("outpost"), "the f7 pawn can play f6");

  const trade = analyze("6k1/pp3ppp/2n5/8/4B3/8/PPP2PPP/R3K3 w - - 0 1", "e1d2", "e4c6");
  assert.deepStrictEqual(trade.tags, ["trade_when_ahead"]);
  assert.ok(trade.conceptIds.includes("trade_when_ahead"));
}

// ---------- analyzeChoice: verdicts ----------

{
  // A perfect answer: no tags and no messages, even in a rich tactical position.
  const perfect = analyzeChoice({ fen: "6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1", userUci: "a1a8", bestUci: "a1a8", assessment: { isBest: true } });
  assert.deepStrictEqual(perfect.tags, []);
  assert.deepStrictEqual(perfect.messages, []);
  assert.deepStrictEqual(perfect.conceptIds, []);
  assert.strictEqual(perfect.verdict, "same");
  assert.strictEqual(perfect.features.best.mate, true, "the caller can still read the features of the best move");

  // An equivalent move is "solid" and nothing else.
  const solid = analyzeChoice({ fen: "4k3/8/8/8/8/8/8/R3K3 w - - 0 1", userUci: "a1a2", bestUci: "a1a3", assessment: { isBest: true } });
  assert.deepStrictEqual(solid.tags, ["solid"]);
  assert.strictEqual(solid.messages[0].key, "insight.solid");
  const close = analyzeChoice({ fen: "4k3/8/8/8/8/8/8/R3K3 w - - 0 1", userUci: "a1a2", bestUci: "a1a3", assessment: { isBest: false, winLossPct: 2 } });
  assert.deepStrictEqual(close.tags, ["solid"], "a 2% loss is close enough");
  const byLines = analyzeChoice({
    fen: "4k3/8/8/8/8/8/8/R3K3 w - - 0 1", userUci: "a1a2", bestUci: "a1a3",
    lines: [{ score: 30, pv: ["a1a3"] }, { score: 27, pv: ["a1a2"] }],
  });
  assert.deepStrictEqual(byLines.tags, ["solid"], "no assessment: the engine lines decide");
  const notByLines = analyzeChoice({
    fen: "3r2k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", userUci: "a1a4", bestUci: "h2h3",
    lines: [{ score: { type: "cp", value: 30 }, pv: ["h2h3"] }, { score: { type: "mate", value: -1 }, pv: ["a1a4"] }],
  });
  assert.ok(notByLines.tags.includes("allows_mate"), "engine-style score objects are understood");

  // Time.
  const timedOut = analyzeChoice({ fen: "6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1", userUci: null, bestUci: "a1a8", assessment: { reason: "timeout" } });
  assert.ok(timedOut.tags.includes("time_trouble"));
  assert.strictEqual(message(timedOut, "time_trouble").key, "insight.time_trouble.out");
  assert.strictEqual(timedOut.verdict, "nomove");
  const slow = analyze("4k3/8/8/3b4/8/8/8/3RK3 w - - 0 1", "e1e2", "d1d5", { timing: { timeSpentMs: 9000, limitMs: 10000 } });
  assert.deepStrictEqual(slow.tags, ["missed_capture", "time_trouble"]);
  assert.ok(!analyze("4k3/8/8/3b4/8/8/8/3RK3 w - - 0 1", "e1e2", "d1d5", { timing: { timeSpentMs: 2000, limitMs: 10000 } }).tags.includes("time_trouble"));
  const skipped = analyzeChoice({ fen: "4k3/8/8/3b4/8/8/8/3RK3 w - - 0 1", userUci: null, bestUci: "d1d5", assessment: { reason: "skip" } });
  assert.deepStrictEqual(skipped.tags, ["missed_capture"], "skipping is not time trouble");
}

// ---------- analyzeChoice: shape, limits, robustness ----------

{
  const rich = analyze("r3k3/8/8/1N6/8/8/P7/4K3 w - - 0 1", "e1e2", "b5c7");
  assert.ok(rich.messages.length >= 1 && rich.messages.length <= 4, "at most four messages");
  assert.strictEqual(rich.phase, "endgame");
  rich.messages.forEach((entry) => {
    assert.strictEqual(typeof entry.key, "string");
    assert.ok(entry.key.startsWith("insight."));
    assert.strictEqual(typeof entry.params, "object");
    ["es", "en"].forEach((lang) => {
      const out = renderMessage(entry, lang);
      assert.ok(out.length > 0 && out.length <= 140 && !/[{}]/.test(out), `${lang}: ${out}`);
    });
  });
  assert.deepStrictEqual(rich.tags, ["fork_available"], "the a2 pawn was already attacked before Ke2: too minor to blame on the move");

  // At most 4 messages even when many tags fire; the strongest come first.
  const many = analyze("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", "f3g5", "e1g1", { timing: { timedOut: true } });
  assert.ok(many.messages.length <= 4);
  assert.strictEqual(many.tags[0], "development");
  assert.strictEqual(many.tags[many.tags.length - 1], "time_trouble", "time comes last");

  // Every concept id points at a real lesson.
  const conceptIds = new Set();
  [rich, many].forEach((result) => result.conceptIds.forEach((id) => conceptIds.add(id)));
  conceptIds.forEach((id) => assert.ok(Concepts.get(id), `concept ${id} exists`));

  // Language handling: messages carry language-neutral raw params.
  i18n.setLanguage("es", { persist: false });
  const inSpanish = analyze("4k3/8/8/3b4/8/8/8/3RK3 w - - 0 1", "e1e2", "d1d5");
  assert.strictEqual(i18n.t(inSpanish.messages[0].key, inSpanish.messages[0].params), "Rxd5 parece ganar el alfil en d5, que está sin protección.");
  assert.strictEqual(renderMessage(inSpanish.messages[0], "en"), "Rxd5 looks like it wins the bishop on d5, which has no protection.");
  assert.deepStrictEqual(renderMessages(inSpanish.messages, "es"), ["Rxd5 parece ganar el alfil en d5, que está sin protección."]);
  i18n.setLanguage("en", { persist: false });
  assert.strictEqual(renderMessage(inSpanish.messages[0]), "Rxd5 looks like it wins the bishop on d5, which has no protection.", "defaults to the current language");

  // Determinism and no mutation of the input.
  const input = Object.freeze({
    fen: "r3k3/8/8/1N6/8/8/P7/4K3 w - - 0 1", userUci: "e1e2", bestUci: "b5c7",
    assessment: Object.freeze({ isBest: false, winLossPct: 25 }), timing: Object.freeze({ timeSpentMs: 100, limitMs: 90000 }),
  });
  assert.deepStrictEqual(analyzeChoice(input), analyzeChoice(input), "same input, same output");
}

{
  // Bad input never throws.
  const bad = analyzeChoice({ fen: "garbage", userUci: "e2e4", bestUci: "e2e4" });
  assert.deepStrictEqual(bad.tags, []);
  assert.deepStrictEqual(bad.messages, []);
  assert.strictEqual(typeof bad.error, "string");
  assert.deepStrictEqual(analyzeChoice(undefined).tags, []);
  assert.deepStrictEqual(analyzeChoice(null).messages, []);
  const illegal = analyzeChoice({ fen: Chess.START_FEN, userUci: "e2e5", bestUci: "e2e4", assessment: WORSE });
  assert.ok(!illegal.error, "an illegal user move is treated as no move");
  assert.strictEqual(illegal.verdict, "nomove");
  const noBest = analyzeChoice({ fen: "4k3/8/p7/8/8/2N5/8/4K3 w - - 0 1", userUci: "c3b5", bestUci: null, assessment: WORSE });
  assert.ok(!noBest.error && noBest.tags.includes("hangs_piece"), "without a best move we can still see a hanging piece");
}

// ---------- Performance ----------

{
  // A busy middlegame: the whole analysis has to stay far below a frame budget.
  const fen = "r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P1B2/2PBPN2/PP1N1PPP/R2QK2R w KQ - 0 9";
  const runOnce = () => analyzeChoice({ fen, userUci: "f4g5", bestUci: "e1g1", assessment: WORSE });
  assert.ok(!runOnce().error);
  const samples = [];
  for (let i = 0; i < 30; i += 1) {
    const start = process.hrtime.bigint();
    runOnce();
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const median = samples[samples.length >> 1];
  assert.ok(median < 15, `analyzeChoice median ${median.toFixed(2)} ms must be < 15 ms`);
  console.log(`  (analyzeChoice on a middlegame: median ${median.toFixed(2)} ms, max ${samples[samples.length - 1].toFixed(2)} ms)`);
}

console.log("insights.test.js: all assertions passed");
