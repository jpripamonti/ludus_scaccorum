// Tests for js/scoring.js: encoding, win%, the precision curve (property-style
// over grids), tolerance band, strictness, tiers, bestMode "masters", mate
// rules, hint penalties, brilliant/great, unknown moves, formatting, summary,
// UI text registration, and that the calibration tables in docs/SCORING.md are
// exactly what the code produces.
//
//   node scripts/tests/scoring.test.js               run the tests
//   node scripts/tests/scoring.test.js --write-docs  regenerate the tables in docs/SCORING.md
//
// Plain assert, deterministic (a seeded PRNG for the fuzz part), no network.

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");
const Scoring = require(path.join(repoRoot, "js", "scoring.js"));
const { load } = require("./_load.js");

const { assess, winPercent, encodeScore, decodeScore, formatEval, normalizeSettings, accuracyFromLoss, DEFAULTS, CONSTANTS } = Scoring;

const DOC_PATH = path.join(repoRoot, "docs", "SCORING.md");
const DOC_BEGIN = "<!-- BEGIN GENERATED TABLES (node scripts/tests/scoring.test.js --write-docs) -->";
const DOC_END = "<!-- END GENERATED TABLES -->";

const QUALITY_CODES = ["brilliant", "great", "perfect", "very_good", "good", "interesting", "dubious", "bad", "blunder", "no_move"];
const LEGACY_CODES = ["perfect", "very_good", "good", "interesting", "dubious", "bad", "blunder", "no_move"];
const REASONS = ["ok", "no_move", "timeout", "skip", "allows_mate", "missed_mate"];

let testCount = 0;
function test(name, fn) {
  try {
    fn();
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  }
  testCount += 1;
}

function isOneDecimal(value) {
  return Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;
}

function mate(moves) {
  return encodeScore({ type: "mate", value: moves });
}

// Assess "the user played a move worth `user` when the best is worth `best`".
function score(best, user, extra) {
  const spec = extra || {};
  return assess({
    lines: [{ uci: "e2e4", score: best }, { uci: "d2d4", score: best - 5 }],
    userUci: "a2a3",
    userScore: user,
    ...spec,
  }, spec.options);
}

function approx(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message || "value"}: ${actual} vs ${expected} (+-${tolerance})`);
}

// ---------- encoding ----------

test("encodeScore / decodeScore: centipawns and mates round-trip", () => {
  assert.strictEqual(encodeScore({ type: "cp", value: 35 }), 35);
  assert.strictEqual(encodeScore({ type: "cp", value: -120 }), -120);
  assert.strictEqual(encodeScore({ type: "cp", value: 12.6 }), 13);
  assert.strictEqual(encodeScore({ type: "mate", value: 1 }), 99000);
  assert.strictEqual(encodeScore({ type: "mate", value: 3 }), 97000);
  assert.strictEqual(encodeScore({ type: "mate", value: -2 }), -98000);
  assert.strictEqual(encodeScore({ type: "mate", value: 0 }), -100000, "mate 0: the mover is mated");
  assert.strictEqual(encodeScore({ type: "mate", value: 50 }), 50000);
  assert.strictEqual(encodeScore({ type: "mate", value: 500 }), 50000, "distances beyond 50 saturate");
  assert.strictEqual(encodeScore({ type: "mate", value: -500 }), -50000);
  assert.strictEqual(encodeScore({ type: "cp", value: 80000 }), 49999, "a huge cp value never looks like a mate");
  assert.strictEqual(encodeScore({ type: "cp", value: -80000 }), -49999);
  [null, undefined, 5, "cp", {}, { type: "cp" }, { type: "cp", value: "x" }, { type: "wat", value: 3 }, { type: "mate", value: NaN }].forEach((bad) => {
    assert.ok(Number.isNaN(encodeScore(bad)), `unusable: ${JSON.stringify(bad)}`);
  });

  for (let cp = -3000; cp <= 3000; cp += 137) {
    assert.deepStrictEqual(decodeScore(encodeScore({ type: "cp", value: cp })), { kind: "cp", cp });
  }
  for (let n = 1; n <= 50; n += 1) {
    assert.deepStrictEqual(decodeScore(mate(n)), { kind: "mate", matePly: n, mateMoves: n }, `mate ${n}`);
    assert.deepStrictEqual(decodeScore(mate(-n)), { kind: "mate", matePly: -n, mateMoves: -n }, `mate -${n}`);
  }
  assert.deepStrictEqual(decodeScore(-100000), { kind: "mate", matePly: 0, mateMoves: 0 });
  assert.strictEqual(Object.is(decodeScore(-100000).matePly, 0), true, "no negative zero");
  assert.deepStrictEqual(decodeScore(49999), { kind: "cp", cp: 49999 });
  assert.strictEqual(decodeScore(50000).kind, "mate");
  [NaN, Infinity, undefined, null, "", "abc", true].forEach((bad) => assert.strictEqual(decodeScore(bad), null, String(bad)));
});

test("flipAfterMove: opponent's score after the move -> mover's score before it", () => {
  assert.strictEqual(Scoring.flipAfterMove(35), -35);
  assert.strictEqual(Scoring.flipAfterMove(-120), 120);
  assert.strictEqual(Object.is(Scoring.flipAfterMove(0), 0), true);
  // The opponent mates in 1 after my move: I am mated in 1.
  assert.strictEqual(Scoring.flipAfterMove(mate(1)), mate(-1));
  assert.strictEqual(Scoring.flipAfterMove(mate(4)), mate(-4));
  // My move delivered mate (opponent is mated: 0): that is mate in 1 for me.
  assert.strictEqual(Scoring.flipAfterMove(mate(0)), mate(1));
  // The opponent is mated in 2 after my move: I mate in 3.
  assert.strictEqual(Scoring.flipAfterMove(mate(-2)), mate(3));
  assert.ok(Number.isNaN(Scoring.flipAfterMove(NaN)));
});

// ---------- win% ----------

test("winPercent: known values, symmetry, clamp, monotonicity", () => {
  approx(winPercent(0), 50, 1e-9, "0 cp");
  approx(winPercent(100), 59.1, 0.15, "+1.00");
  approx(winPercent(300), 75.1, 0.3, "+3.00");
  approx(winPercent(1000), 97.5, 0.1, "+10.00");
  for (let cp = -1000; cp <= 1000; cp += 25) {
    approx(winPercent(cp) + winPercent(-cp), 100, 1e-9, `symmetry at ${cp}`);
  }
  for (let cp = -1000; cp < 1000; cp += 5) {
    assert.ok(winPercent(cp + 5) > winPercent(cp), `strictly increasing at ${cp}`);
  }
  assert.strictEqual(winPercent(5000), winPercent(1000), "clamped above +10");
  assert.strictEqual(winPercent(-5000), winPercent(-1000));
  const allValues = [];
  for (let cp = -2000; cp <= 2000; cp += 50) allValues.push(winPercent(cp));
  allValues.forEach((value) => assert.ok(value > 0 && value < 100));
});

test("winPercent: mates are ordered by distance and beat/lose to every centipawn score", () => {
  for (let n = 1; n < 50; n += 1) {
    assert.ok(winPercent(mate(n)) > winPercent(mate(n + 1)) || n >= 10, `M${n} >= M${n + 1}`);
    assert.ok(winPercent(mate(-n)) < winPercent(mate(-(n + 1))) || n >= 10, `-M${n} <= -M${n + 1}`);
  }
  assert.ok(winPercent(mate(1)) > winPercent(mate(2)));
  assert.ok(winPercent(mate(10)) > winPercent(1000), "even a slow mate beats +10.00");
  assert.ok(winPercent(mate(50)) > winPercent(49999 - 1));
  assert.ok(winPercent(mate(-10)) < winPercent(-1000));
  assert.ok(winPercent(mate(1)) < 100 && winPercent(mate(-1)) > 0);
  approx(winPercent(mate(3)) + winPercent(mate(-3)), 100, 1e-9, "mate symmetry");
  assert.strictEqual(winPercent(-100000) < 1, true, "already mated");
});

test("winPercent: unusable input is 'unknown' (50), never NaN", () => {
  [NaN, Infinity, -Infinity, undefined, null, "", "abc", true, {}].forEach((bad) => assert.strictEqual(winPercent(bad), 50, String(bad)));
  assert.strictEqual(winPercent("100"), winPercent(100), "numeric strings are accepted");
});

// ---------- formatEval ----------

test("formatEval: pawn units, sign, mate, Spanish decimal comma", () => {
  assert.strictEqual(formatEval(35, "en"), "+0.35");
  assert.strictEqual(formatEval(35, "es"), "+0,35");
  assert.strictEqual(formatEval(-120, "en"), "-1.20");
  assert.strictEqual(formatEval(-120, "es"), "-1,20");
  assert.strictEqual(formatEval(0, "en"), "0.00");
  assert.strictEqual(formatEval(0, "es"), "0,00");
  assert.strictEqual(formatEval(5, "en"), "+0.05");
  assert.strictEqual(formatEval(-4, "en"), "-0.04");
  assert.strictEqual(formatEval(2500, "en"), "+25.00");
  assert.strictEqual(formatEval(-0.4, "en"), "0.00", "no '-0.00'");
  assert.strictEqual(formatEval(mate(3), "en"), "M3");
  assert.strictEqual(formatEval(mate(3), "es"), "M3");
  assert.strictEqual(formatEval(mate(-2), "en"), "-M2");
  assert.strictEqual(formatEval(mate(1), "es"), "M1");
  assert.strictEqual(formatEval(mate(0), "en"), "-M0");
  assert.strictEqual(formatEval(mate(50), "en"), "M50");
  ["x", NaN, undefined, null].forEach((bad) => assert.strictEqual(formatEval(bad, "en"), "?"));
  assert.strictEqual(formatEval(35), "+0,35", "without i18n loaded the default language is Spanish");
});

// ---------- settings ----------

test("DEFAULTS are the contract's and frozen", () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(DEFAULTS)), {
    model: "precision", strictness: "standard", bestMode: "band", tolerancePct: 1, hintCost: { level1: 0.15, level2: 0.35, reveal: 1 },
  });
  assert.ok(Object.isFrozen(DEFAULTS) && Object.isFrozen(DEFAULTS.hintCost));
});

test("normalizeSettings: fills, validates, clamps and never aliases", () => {
  assert.deepStrictEqual(normalizeSettings(), { ...JSON.parse(JSON.stringify(DEFAULTS)) });
  assert.deepStrictEqual(normalizeSettings(null), normalizeSettings({}));
  assert.deepStrictEqual(normalizeSettings("strict"), normalizeSettings({}));
  const full = normalizeSettings({ model: "tiers", strictness: "strict", bestMode: "masters", tolerancePct: 2.5, hintCost: { level1: 0.1, level2: 0.5, reveal: 0.9 } });
  assert.deepStrictEqual(full, { model: "tiers", strictness: "strict", bestMode: "masters", tolerancePct: 2.5, hintCost: { level1: 0.1, level2: 0.5, reveal: 0.9 } });
  const partial = normalizeSettings({ strictness: "relaxed" });
  assert.strictEqual(partial.strictness, "relaxed");
  assert.strictEqual(partial.model, "precision");
  // Invalid values fall back to the default.
  const junk = normalizeSettings({ model: "elo", strictness: "brutal", bestMode: 3, tolerancePct: "many", hintCost: "free", extra: 1 });
  assert.deepStrictEqual(junk, normalizeSettings({}));
  assert.strictEqual("extra" in junk, false, "unknown keys are dropped");
  // Tolerance is clamped to 0..5 and accepts numeric strings.
  assert.strictEqual(normalizeSettings({ tolerancePct: -3 }).tolerancePct, 0);
  assert.strictEqual(normalizeSettings({ tolerancePct: 99 }).tolerancePct, 5);
  assert.strictEqual(normalizeSettings({ tolerancePct: "2.25" }).tolerancePct, 2.25);
  assert.strictEqual(normalizeSettings({ tolerancePct: NaN }).tolerancePct, 1);
  assert.strictEqual(normalizeSettings({ tolerancePct: null }).tolerancePct, 1);
  assert.strictEqual(normalizeSettings({ tolerancePct: 0 }).tolerancePct, 0, "0 is a valid tolerance");
  // Hint costs are clamped to 0..1 and kept non-decreasing.
  assert.deepStrictEqual(normalizeSettings({ hintCost: { level1: 5, level2: -1, reveal: 0 } }).hintCost, { level1: 1, level2: 1, reveal: 1 });
  assert.deepStrictEqual(normalizeSettings({ hintCost: { level1: 0.4 } }).hintCost, { level1: 0.4, level2: 0.4, reveal: 1 });
  // No aliasing of the frozen defaults or of the caller's objects.
  const a = normalizeSettings({});
  a.hintCost.level1 = 0.99;
  a.model = "tiers";
  assert.strictEqual(DEFAULTS.hintCost.level1, 0.15);
  assert.strictEqual(normalizeSettings({}).model, "precision");
  const input = { hintCost: { level1: 0.2 } };
  normalizeSettings(input).hintCost.level1 = 0.9;
  assert.strictEqual(input.hintCost.level1, 0.2);
});

// ---------- the precision curve ----------

test("accuracyFromLoss: full marks inside the band, strictly decreasing outside, bounded", () => {
  const settings = { bestMode: "band", tolerancePct: 1, strictness: "standard" };
  for (let loss = 0; loss <= 1; loss += 0.05) assert.strictEqual(accuracyFromLoss(loss, settings), 100, `inside the band at ${loss}`);
  let previous = 100;
  let sawZero = false;
  for (let loss = 1.05; loss <= 100; loss += 0.05) {
    const value = accuracyFromLoss(loss, settings);
    assert.ok(value >= 0 && value <= 100);
    if (value > 0) {
      assert.ok(value < previous, `strictly decreasing at loss ${loss.toFixed(2)}: ${value} < ${previous}`);
    } else {
      sawZero = true;
    }
    if (sawZero) assert.strictEqual(value, 0, "once it reaches the floor it stays there");
    previous = value;
  }
  assert.ok(sawZero, "very large losses reach 0");
  // Continuous at the band edge: no jump.
  assert.ok(100 - accuracyFromLoss(1.0001, settings) < 0.01);
  assert.ok(accuracyFromLoss(NaN, settings) === 0);
});

test("assess: points are bounded 0..10 with one decimal; never NaN", () => {
  for (let best = -1200; best <= 1200; best += 100) {
    for (let user = best + 200; user >= best - 1500; user -= 25) {
      const r = score(best, user);
      assert.ok(r.points >= 0 && r.points <= 10, `points ${r.points}`);
      assert.ok(isOneDecimal(r.points) && isOneDecimal(r.rawPoints), `one decimal: ${r.points}`);
      assert.ok(Number.isFinite(r.accuracy) && r.accuracy >= 0 && r.accuracy <= 100);
      assert.ok(r.winLossPct >= 0 && r.cpLoss >= 0 && r.cpLoss <= 2500);
    }
  }
});

test("assess: strictly ordered by loss - more loss never gives more points (grid of positions)", () => {
  const bases = [-1400, -800, -400, -100, -30, 0, 30, 100, 150, 400, 800, 1400, 3000];
  bases.forEach((best) => {
    let previous = Infinity;
    let previousAccuracy = Infinity;
    let dropped = false;
    for (let loss = 0; loss <= 2000; loss += 5) {
      const r = score(best, best - loss);
      assert.ok(r.points <= previous + 1e-9, `best ${best}, loss ${loss}: ${r.points} <= ${previous}`);
      assert.ok(r.accuracy <= previousAccuracy + 1e-9);
      if (r.points < previous) dropped = true;
      previous = r.points;
      previousAccuracy = r.accuracy;
    }
    assert.ok(dropped, `points do fall as the loss grows (best ${best})`);
  });
});

test("assess: calibration targets of the product owner", () => {
  // Inaccuracy of ~50 cp in a balanced position: 6.5 - 8 points.
  [30, 150, -100, 0, 60].forEach((best) => {
    const r = score(best, best - 50);
    assert.ok(r.points >= 6.5 && r.points <= 8, `50 cp at ${best}: ${r.points}`);
  });
  // A 150 cp mistake: 3 - 5 points.
  [30, 150, -100, 0, 60].forEach((best) => {
    const r = score(best, best - 150);
    assert.ok(r.points >= 3 && r.points <= 5, `150 cp at ${best}: ${r.points}`);
  });
  // Blunders sit near 0 - 1 (a 500 cp loss is under 1 point, a 300 cp one under 2).
  [30, 150, -100, 0].forEach((best) => {
    assert.ok(score(best, best - 500).points <= 1, `500 cp at ${best}`);
    assert.ok(score(best, best - 300).points <= 2, `300 cp at ${best}`);
    assert.strictEqual(score(best, best - 300).qualityCode, "blunder");
  });
  assert.strictEqual(score(30, 30 - 2000).points, 0);
  // Equal-ish moves get full marks.
  [30, 150, -100].forEach((best) => {
    const r = score(best, best - 8);
    assert.strictEqual(r.points, 10);
    assert.strictEqual(r.qualityCode, "perfect");
    assert.strictEqual(r.isBest, true);
  });
});

test("assess: symmetry - the same win% loss gives the same points whatever the sign of the evaluation", () => {
  for (let best = -900; best <= 900; best += 60) {
    for (let loss = 0; loss <= 700; loss += 35) {
      const user = best - loss;
      const a = score(best, user);
      const b = score(-user, -best); // the mirrored situation
      approx(a.winLossPct, b.winLossPct, 0.011, `win% loss ${best}/${user}`);
      approx(a.points, b.points, 0.1, `points ${best}/${user}`);
      approx(a.accuracy, b.accuracy, 0.2, `accuracy ${best}/${user}`);
    }
  }
  // Equal win% loss in different regions of the curve gives equal points.
  const nearZero = score(0, -90);
  const otherRegion = (() => {
    // find a loss at +2.50 that costs the same win%
    let user = 250;
    while (winPercent(250) - winPercent(user) < nearZero.winLossPct && user > -2000) user -= 1;
    return score(250, user);
  })();
  approx(nearZero.winLossPct, otherRegion.winLossPct, 0.15);
  approx(nearZero.points, otherRegion.points, 0.15, "same win% loss, same points");
  assert.ok(score(250, 250 - 90).points > nearZero.points, "the same cp loss costs less where the position is already winning");
});

// ---------- tolerance band ----------

test("tolerance band: edges, engine mode, widths", () => {
  const base = { settings: { bestMode: "band", tolerancePct: 1 } };
  // With best = 0 cp, a loss of `cp` centipawns costs about cp * 0.092 win%.
  const inside = score(0, -10, base); // ~0.92 %
  const outside = score(0, -12, base); // ~1.10 %
  assert.ok(inside.winLossPct < 1 && outside.winLossPct > 1, `${inside.winLossPct} / ${outside.winLossPct}`);
  assert.strictEqual(inside.points, 10);
  assert.strictEqual(inside.isBest, true);
  assert.strictEqual(inside.qualityCode, "perfect");
  assert.strictEqual(outside.isBest, false);
  assert.ok(outside.points < 10 && outside.points > 9.7, `just outside the band the score dips a little, not a cliff: ${outside.points}`);
  assert.notStrictEqual(outside.qualityCode, "perfect");

  // The band edge is inclusive: a tolerance equal to the loss keeps the move inside.
  const edgeLoss = score(0, -10).winLossPct; // 0.92 (rounded to 2 decimals)
  assert.strictEqual(score(0, -10, { settings: { bestMode: "band", tolerancePct: edgeLoss + 0.01 } }).isBest, true);
  assert.strictEqual(score(0, -10, { settings: { bestMode: "band", tolerancePct: 0.9 } }).isBest, false, "0.90 < 0.92: outside");
  assert.strictEqual(normalizeSettings({ tolerancePct: 100 }).tolerancePct, 5, "tolerance never exceeds 5");

  // tolerance 0 in band mode: only (numerically) equal moves are best.
  assert.strictEqual(score(0, -3, { settings: { bestMode: "band", tolerancePct: 0 } }).isBest, false);
  assert.strictEqual(score(0, 0, { settings: { bestMode: "band", tolerancePct: 0 } }).isBest, true);
  // A wider band forgives more.
  const narrow = score(0, -40, { settings: { bestMode: "band", tolerancePct: 1 } });
  const wide = score(0, -40, { settings: { bestMode: "band", tolerancePct: 5 } });
  assert.ok(wide.winLossPct === narrow.winLossPct);
  assert.strictEqual(wide.points, 10, "40 cp = 3.7% is inside a 5% band");
  assert.ok(narrow.points < 10);
  assert.ok(wide.isBest && !narrow.isBest);

  // Engine mode: no band, only the engine's move (or an equal one) is best.
  const engine = { settings: { bestMode: "engine" } };
  const almost = score(0, -10, engine);
  assert.strictEqual(almost.isBest, false);
  assert.ok(almost.points < 10 && almost.points >= 9, `no band: even 10 cp costs a little (${almost.points})`);
  assert.strictEqual(assess({ lines: [{ uci: "e2e4", score: 20 }, { uci: "d2d4", score: 5 }], userUci: "e2e4", ...engine }).isBest, true);
  assert.strictEqual(assess({ lines: [{ uci: "e2e4", score: 20 }, { uci: "d2d4", score: 20 }], userUci: "d2d4", ...engine }).isBest, true, "an equal score is equally best");
  assert.strictEqual(assess({ lines: [{ uci: "e2e4", score: 20 }, { uci: "d2d4", score: 19 }], userUci: "d2d4", ...engine }).isBest, false);
});

test("tolerance band: a move ranked 2nd but inside the band is best, rank is kept", () => {
  const r = assess({ lines: [{ uci: "e2e4", score: 30 }, { uci: "d2d4", score: 26 }, { uci: "g1f3", score: -50 }], userUci: "d2d4" });
  assert.strictEqual(r.rank, 2);
  assert.strictEqual(r.isBest, true);
  assert.strictEqual(r.points, 10);
  assert.strictEqual(r.bestUci, "e2e4");
  assert.strictEqual(r.userScore, 26);
  const third = assess({ lines: [{ uci: "e2e4", score: 30 }, { uci: "d2d4", score: 26 }, { uci: "g1f3", score: -50 }], userUci: "g1f3" });
  assert.strictEqual(third.rank, 3);
  assert.strictEqual(third.isBest, false);
  assert.ok(third.points < 8);
});

// ---------- strictness ----------

test("strictness: strict <= standard <= relaxed everywhere, strictly in the middle range", () => {
  const strictnesses = ["strict", "standard", "relaxed"];
  for (let best = -600; best <= 600; best += 150) {
    for (let loss = 0; loss <= 800; loss += 20) {
      const [strict, standard, relaxed] = strictnesses.map((strictness) => score(best, best - loss, { settings: { strictness } }));
      assert.ok(strict.points <= standard.points && standard.points <= relaxed.points, `${best}/${loss}: ${strict.points} ${standard.points} ${relaxed.points}`);
      assert.ok(strict.accuracy <= standard.accuracy && standard.accuracy <= relaxed.accuracy);
    }
  }
  const [strict, standard, relaxed] = strictnesses.map((strictness) => score(0, -100, { settings: { strictness } }));
  assert.ok(strict.points < standard.points && standard.points < relaxed.points, "100 cp separates the three levels");
  // The labels follow the strictness too.
  const codes = strictnesses.map((strictness) => score(0, -120, { settings: { strictness } }).qualityCode);
  assert.ok(QUALITY_CODES.indexOf(codes[0]) >= QUALITY_CODES.indexOf(codes[1]) && QUALITY_CODES.indexOf(codes[1]) >= QUALITY_CODES.indexOf(codes[2]), codes.join(","));
  assert.strictEqual(CONSTANTS.STRICTNESS_K.relaxed, 0.6);
  assert.strictEqual(CONSTANTS.STRICTNESS_K.standard, 1);
  assert.strictEqual(CONSTANTS.STRICTNESS_K.strict, 1.6);
});

// ---------- labels ----------

test("quality labels are ordered by loss and each class is reachable", () => {
  const seen = new Set();
  let previous = -1;
  for (let loss = 0; loss <= 1200; loss += 2) {
    const r = score(0, -loss);
    const rankInScale = QUALITY_CODES.indexOf(r.qualityCode);
    assert.ok(rankInScale >= previous, `label never improves as the loss grows (${loss}: ${r.qualityCode})`);
    previous = rankInScale;
    seen.add(r.qualityCode);
  }
  ["perfect", "very_good", "good", "interesting", "dubious", "bad", "blunder"].forEach((code) => assert.ok(seen.has(code), `reachable: ${code}`));
  assert.ok(!seen.has("brilliant") && !seen.has("great"), "brilliant / great never come from the loss alone");
});

// ---------- tiers ----------

test("tiers model: fixed points per quality (10 / 7.5 / 5 / 2.5 / 0 / 0 / 0)", () => {
  const expected = { brilliant: 10, great: 10, perfect: 10, very_good: 7.5, good: 5, interesting: 2.5, dubious: 0, bad: 0, blunder: 0 };
  const seen = new Set();
  for (let loss = 0; loss <= 1200; loss += 3) {
    const r = score(0, -loss, { settings: { model: "tiers" } });
    assert.strictEqual(r.points, expected[r.qualityCode], `loss ${loss}: ${r.qualityCode} -> ${r.points}`);
    seen.add(r.points);
  }
  assert.deepStrictEqual(Array.from(seen).sort((a, b) => a - b), [0, 2.5, 5, 7.5, 10]);
  // The precision accuracy is still reported (model-independent), points are the tier.
  const t = score(0, -50, { settings: { model: "tiers" } });
  const p = score(0, -50, { settings: { model: "precision" } });
  assert.strictEqual(t.accuracy, p.accuracy);
  assert.strictEqual(t.qualityCode, p.qualityCode);
  assert.strictEqual(t.points, 5);
  assert.notStrictEqual(t.points, p.points);
  // Strictness shifts the tiers.
  assert.ok(score(0, -50, { settings: { model: "tiers", strictness: "strict" } }).points <= t.points);
  assert.ok(score(0, -50, { settings: { model: "tiers", strictness: "relaxed" } }).points >= t.points);
  // Hints and mate blunders behave the same way in the tiers model.
  assert.strictEqual(score(0, 0, { settings: { model: "tiers" }, hintsUsed: 1 }).points, 8.5);
  assert.strictEqual(score(mate(2), 300, { settings: { model: "tiers" } }).points, 0);
});

// ---------- masters ----------

test("bestMode masters: the master's move counts as best within 3%, only when it is the user's move", () => {
  const settings = { bestMode: "masters", tolerancePct: 1 };
  const lines = [{ uci: "e2e4", score: 0 }, { uci: "d2d4", score: -25 }, { uci: "g1f3", score: -25 }, { uci: "h2h4", score: -60 }];
  // -25 cp = 2.3% loss: outside the 1% band, inside the masters' 3%.
  const master = assess({ lines, userUci: "d2d4", masterUci: "d2d4", settings });
  assert.strictEqual(master.isMasterMove, true);
  assert.strictEqual(master.isBest, true);
  assert.strictEqual(master.points, 10);
  const notMaster = assess({ lines, userUci: "g1f3", masterUci: "d2d4", settings });
  assert.strictEqual(notMaster.isMasterMove, false);
  assert.strictEqual(notMaster.isBest, false);
  assert.ok(notMaster.points < 10);
  // Beyond 3% the master's move is just a move (-60 cp = 5.4%).
  const tooFar = assess({ lines, userUci: "h2h4", masterUci: "h2h4", settings });
  assert.strictEqual(tooFar.isMasterMove, true);
  assert.strictEqual(tooFar.isBest, false);
  assert.ok(tooFar.points < 10);
  // A wider configured tolerance still wins over the 3% floor.
  const wider = [{ uci: "e2e4", score: 0 }, { uci: "h2h4", score: -50 }]; // -50 cp = 4.6%
  assert.strictEqual(assess({ lines: wider, userUci: "h2h4", masterUci: "h2h4", settings: { bestMode: "masters", tolerancePct: 5 } }).isBest, true);
  assert.strictEqual(assess({ lines: wider, userUci: "h2h4", masterUci: "h2h4", settings }).isBest, false, "4.6% is beyond the 3% floor with tolerance 1");
  // In band / engine modes the master's move is not special.
  ["band", "engine"].forEach((bestMode) => {
    const r = assess({ lines, userUci: "d2d4", masterUci: "d2d4", settings: { bestMode, tolerancePct: 1 } });
    assert.strictEqual(r.isBest, false, bestMode);
    assert.ok(r.points < 10, bestMode);
  });
  // A masterUci that is not legal-looking is ignored.
  assert.strictEqual(assess({ lines, userUci: "d2d4", masterUci: "nonsense", settings }).isMasterMove, false);
});

// ---------- mate rules ----------

test("mate: missing a forced mate costs a fixed amount on top of the win% given up; a blunder only when the win is thrown away (COR-011)", () => {
  // A move that throws the win away is still a blunder with reason missed_mate (under 2 points, like any blunder).
  ["standard", "relaxed", "strict"].forEach((strictness) => {
    [50, 150, -200].forEach((user) => {
      const r = score(mate(3), user, { settings: { strictness } });
      assert.strictEqual(r.reason, "missed_mate", `${strictness} ${user}`);
      assert.strictEqual(r.qualityCode, "blunder", `${strictness} ${user}`);
      assert.ok(r.points <= 2, `${strictness} ${user}: ${r.points}`);
      assert.ok(r.cpLoss >= 1200);
      assert.strictEqual(r.isBest, false);
      assert.strictEqual(r.keptWin, false, "the move is not winning any more");
    });
  });
  // A move that keeps the win is far from hanging the queen, but it never scores as if nothing was missed.
  const longMate = score(mate(6), 950);
  assert.strictEqual(longMate.reason, "missed_mate");
  assert.strictEqual(longMate.keptWin, true);
  assert.strictEqual(longMate.qualityCode, "interesting", "a clean miss of a long mate is an inaccuracy");
  assert.ok(longMate.points > 4.5 && longMate.points < 6.5, `mate in 6 missed, +9.50 kept: ${longMate.points}`);
  const shortMate = score(mate(2), 950);
  assert.strictEqual(shortMate.keptWin, true);
  assert.strictEqual(shortMate.qualityCode, "dubious", "missing a mate in two costs more than missing a mate in six");
  assert.ok(shortMate.points > 3 && shortMate.points < longMate.points, `mate in 2 missed: ${shortMate.points}`);
  assert.ok(shortMate.winLossPct < 4, "the win% the move gives up is small: the deduction is the miss itself");
  // Nothing is missed when the best is a plain +10: the same move is almost perfect.
  assert.ok(score(1000, 950).points > 9, "the same +9.50 without a mate to find is nearly perfect");
  // Monotone: the more of the advantage the move keeps, the more points, for every mate length and strictness.
  ["standard", "relaxed", "strict"].forEach((strictness) => {
    [1, 2, 3, 6, 12].forEach((n) => {
      let previous = -1;
      for (let user = -800; user <= 2000; user += 25) {
        const r = score(mate(n), user, { settings: { strictness } });
        assert.strictEqual(r.reason, "missed_mate");
        assert.ok(r.points >= previous - 1e-9, `${strictness} M${n} ${user}: ${r.points} after ${previous}`);
        previous = r.points;
      }
    });
  });
  // A better move in the lines wins over the miss: only the mating move is best.
  assert.strictEqual(score(mate(3), 900).isBest, false);
  // The kept-win flag follows +3.00.
  assert.strictEqual(score(mate(3), 350).keptWin, true);
  assert.strictEqual(score(mate(3), 250).keptWin, false);
  // Labels and explanation: the sentence fits the assessment.
  assert.ok(Scoring.reasonLabel("missed_mate", "en", shortMate).includes("still winning"));
  assert.ok(Scoring.reasonLabel("missed_mate", "es", shortMate).includes("sigue ganando"));
  assert.ok(!Scoring.reasonLabel("missed_mate", "en", score(mate(3), 50)).includes("still winning"));
  assert.ok(!Scoring.reasonLabel("missed_mate", "en").includes("still winning"), "no assessment: the plain sentence (true in both cases)");
  // Playing the mating move is perfect; another mating move as fast is too.
  const found = assess({ lines: [{ uci: "e2e4", score: mate(2) }, { uci: "d2d4", score: 300 }], userUci: "e2e4" });
  assert.strictEqual(found.reason, "ok");
  assert.strictEqual(found.points, 10);
  assert.strictEqual(found.qualityCode, "great", "the only mating move is a great move");
  assert.strictEqual(found.keptWin, false);
  const equalMate = assess({ lines: [{ uci: "e2e4", score: mate(1) }, { uci: "d2d4", score: mate(1) }], userUci: "d2d4" });
  assert.strictEqual(equalMate.points, 10);
  assert.strictEqual(equalMate.isBest, true);
  assert.strictEqual(equalMate.onlyMove, false, "two mating moves: neither is the only move");
});

test("labels: a move that scores 10.0 is always perfect, and the words are one ladder (CNT-014)", () => {
  // 1.01% loss with a 1% band: the points round to 10.0, so the label must not say "very good".
  const almost = assess({ lines: [{ uci: "e2e4", score: 0 }, { uci: "d2d4", score: -50 }], userUci: "d2d4", settings: { tolerancePct: 0.5 } });
  for (let cp = 0; cp <= 40; cp += 1) {
    const r = score(0, -cp);
    if (r.points === 10) assert.strictEqual(r.qualityCode, "perfect", `${cp} cp -> ${r.points} ${r.qualityCode}`);
    if (r.qualityCode === "perfect") assert.strictEqual(r.points, 10, `${cp} cp`);
  }
  assert.ok(almost.points < 10);
  assert.strictEqual(CONSTANTS.PERFECT_E, 0.06);
  // One ladder, worst to best.
  const ladder = ["blunder", "bad", "dubious", "interesting", "good", "very_good", "perfect"];
  const words = { es: ["Error grave", "Error", "Dudosa", "Imprecisa", "Buena", "Muy buena", "Perfecta"], en: ["Serious mistake", "Mistake", "Dubious", "Inaccuracy", "Good", "Very good", "Perfect"] };
  ["es", "en"].forEach((lang) => ladder.forEach((code, i) => assert.strictEqual(Scoring.qualityLabel(code, lang), words[lang][i], `${lang} ${code}`)));
  assert.strictEqual(new Set(words.en).size, 7);
  assert.ok(ladder.every((code) => !/interest|interes/i.test(Scoring.qualityLabel(code, "en")) && !/interes/i.test(Scoring.qualityLabel(code, "es"))), "no positive word for a clear loss");
});

test("mate: allowing a mate is blunder-class with reason allows_mate", () => {
  ["standard", "relaxed", "strict"].forEach((strictness) => {
    const r = score(50, mate(-2), { settings: { strictness } });
    assert.strictEqual(r.reason, "allows_mate");
    assert.strictEqual(r.qualityCode, "blunder");
    assert.ok(r.points <= 1);
    assert.strictEqual(r.cpLoss, 2500);
    assert.strictEqual(r.isBest, false);
  });
  const missedAndAllowed = score(mate(3), mate(-1));
  assert.strictEqual(missedAndAllowed.reason, "allows_mate", "allowing mate is the worse of the two");
  assert.ok(score(-300, mate(-4)).points <= 1, "allowing mate from a worse position too");
  assert.strictEqual(score(-300, mate(-4)).reason, "allows_mate");
  assert.strictEqual(score(50, mate(0)).reason, "allows_mate", "a move that is mated at once");
});

test("mate: when every move loses to mate, delaying it is a small matter, not a blunder", () => {
  const same = assess({ lines: [{ uci: "e2e4", score: mate(-5) }, { uci: "d2d4", score: mate(-3) }], userUci: "e2e4" });
  assert.strictEqual(same.points, 10);
  assert.strictEqual(same.qualityCode, "perfect");
  const faster = assess({ lines: [{ uci: "e2e4", score: mate(-5) }, { uci: "d2d4", score: mate(-3) }], userUci: "d2d4" });
  assert.strictEqual(faster.reason, "ok", "not allows_mate: the position was lost anyway");
  assert.ok(faster.points < 10 && faster.points > 5, `mated sooner than necessary: ${faster.points}`);
  assert.strictEqual(faster.mateExtraMoves, 2);
  assert.notStrictEqual(faster.qualityCode, "blunder");
});

test("mate: a slower mate that still mates is a small deduction, growing with the delay, never a blunder", () => {
  let previous = 10.1;
  for (let extra = 0; extra <= 40; extra += 1) {
    const r = assess({
      lines: [{ uci: "e2e4", score: mate(1) }, { uci: "d2d4", score: mate(1 + extra) }, { uci: "g1f3", score: 300 }],
      userUci: "d2d4",
    });
    assert.strictEqual(r.reason, "ok");
    assert.notStrictEqual(r.qualityCode, "blunder");
    assert.ok(r.points <= previous, `extra ${extra}: ${r.points} <= ${previous}`);
    assert.ok(r.points >= 5, `never below half marks: ${r.points}`);
    if (extra === 0) {
      assert.strictEqual(r.points, 10);
      assert.strictEqual(r.isBest, true);
    } else {
      assert.strictEqual(r.isBest, false, "a slower mate is not 'the best move'");
      assert.ok(r.points < 10, `extra ${extra} costs something`);
      assert.strictEqual(r.mateExtraMoves, extra);
      assert.ok(r.cpLoss <= 2500);
    }
    previous = r.points;
  }
  const oneSlower = assess({ lines: [{ uci: "e2e4", score: mate(2) }, { uci: "d2d4", score: mate(3) }], userUci: "d2d4" });
  assert.ok(oneSlower.points >= 9 && oneSlower.points < 10, `one move slower: ${oneSlower.points}`);
  assert.strictEqual(oneSlower.qualityCode, "very_good");
  // Strictness scales the deduction.
  const at = (strictness) => assess({ lines: [{ uci: "e2e4", score: mate(1) }, { uci: "d2d4", score: mate(4) }], userUci: "d2d4", settings: { strictness } }).points;
  assert.ok(at("strict") < at("standard") && at("standard") < at("relaxed"));
});

test("mate: a faster mate than the reference, or a mate when the best is not one, is full marks", () => {
  const faster = assess({ lines: [{ uci: "e2e4", score: mate(3) }, { uci: "d2d4", score: 100 }], userScore: mate(1), userUci: "a2a3" });
  assert.strictEqual(faster.points, 10);
  assert.strictEqual(faster.isBest, true);
  assert.strictEqual(faster.reason, "ok");
  const found = assess({ lines: [{ uci: "e2e4", score: 200 }, { uci: "d2d4", score: 100 }], userScore: mate(4), userUci: "a2a3" });
  assert.strictEqual(found.points, 10);
  assert.strictEqual(found.cpLoss, 0);
});

test("mate: cpLoss for mate cases follows the legacy convention", () => {
  assert.strictEqual(score(mate(3), 300).cpLoss, 1200 + 40 * 3);
  assert.strictEqual(score(mate(40), 300).cpLoss, 1200 + 40 * 20, "capped at 20 moves");
  assert.strictEqual(score(50, mate(-3)).cpLoss, 2500);
  assert.strictEqual(assess({ lines: [{ uci: "e2e4", score: mate(2) }, { uci: "d2d4", score: mate(5) }], userUci: "d2d4" }).cpLoss, 120);
});

// ---------- hints ----------

test("hints multiply the raw points by (1 - cost); reveal is worth nothing", () => {
  const raw = score(0, -50); // 7.5
  assert.strictEqual(raw.points, raw.rawPoints);
  assert.strictEqual(raw.hintPenalty, 0);
  const l1 = score(0, -50, { hintsUsed: 1 });
  const l2 = score(0, -50, { hintsUsed: 2 });
  const l3 = score(0, -50, { hintsUsed: 3 });
  assert.strictEqual(l1.rawPoints, raw.rawPoints);
  assert.strictEqual(l1.points, Math.round(raw.rawPoints * 0.85 * 10) / 10);
  assert.strictEqual(l2.points, Math.round(raw.rawPoints * 0.65 * 10) / 10);
  assert.strictEqual(l3.points, 0);
  assert.strictEqual(l1.hintPenalty, Math.round((raw.rawPoints - l1.points) * 10) / 10);
  assert.strictEqual(l3.hintPenalty, raw.rawPoints);
  assert.ok(raw.points > l1.points && l1.points > l2.points && l2.points > l3.points);
  // A perfect move with each hint level.
  assert.deepStrictEqual([0, 1, 2, 3].map((hintsUsed) => score(0, 0, { hintsUsed }).points), [10, 8.5, 6.5, 0]);
  // The quality of the move itself is not changed by hints.
  assert.strictEqual(l3.qualityCode, raw.qualityCode);
  assert.strictEqual(l3.accuracy, raw.accuracy);
  // Custom costs.
  assert.strictEqual(score(0, 0, { hintsUsed: 1, settings: { hintCost: { level1: 0.5 } } }).points, 5);
  assert.strictEqual(score(0, 0, { hintsUsed: 3, settings: { hintCost: { reveal: 0.5 } } }).points, 5);
  // Odd hintsUsed values.
  assert.strictEqual(score(0, 0, { hintsUsed: 7 }).points, 0, "above 3 counts as a reveal");
  assert.strictEqual(score(0, 0, { hintsUsed: -2 }).points, 10);
  assert.strictEqual(score(0, 0, { hintsUsed: NaN }).points, 10);
  assert.strictEqual(score(0, 0, { hintsUsed: "2" }).points, 6.5);
  assert.strictEqual(score(0, 0, { hintsUsed: true }).points, 10);
  assert.strictEqual(score(0, 0, { hintsUsed: 1.6 }).points, 6.5, "rounded to the nearest level");
});

test("hints never make points negative or above the raw value", () => {
  for (let loss = 0; loss <= 1000; loss += 50) {
    [0, 1, 2, 3].forEach((hintsUsed) => {
      const r = score(0, -loss, { hintsUsed });
      assert.ok(r.points >= 0 && r.points <= r.rawPoints, `${loss}/${hintsUsed}`);
      assert.ok(isOneDecimal(r.points) && isOneDecimal(r.hintPenalty));
      approx(r.rawPoints - r.points, r.hintPenalty, 0.0001);
    });
  }
});

// ---------- no move / timeout / skip ----------

test("no move, timeout and skip score 0 with qualityCode no_move", () => {
  const lines = [{ uci: "e2e4", score: 30 }, { uci: "d2d4", score: 10 }];
  const cases = [
    [{ lines, userUci: null }, "no_move"],
    [{ lines, userUci: "" }, "no_move"],
    [{ lines }, "no_move"],
    [{ lines, userUci: "banana" }, "no_move"],
    [{ lines, userUci: null, reason: "timeout" }, "timeout"],
    [{ lines, userUci: "e2e4", reason: "timeout" }, "timeout"],
    [{ lines, userUci: "e2e4", reason: "skip" }, "skip"],
    [{ lines, userUci: "e2e4", reason: "skip", hintsUsed: 2 }, "skip"],
  ];
  cases.forEach(([input, reason]) => {
    const r = assess(input);
    assert.strictEqual(r.points, 0, JSON.stringify(input));
    assert.strictEqual(r.rawPoints, 0);
    assert.strictEqual(r.accuracy, 0);
    assert.strictEqual(r.qualityCode, "no_move");
    assert.strictEqual(r.reason, reason);
    assert.strictEqual(r.isBest, false);
    assert.strictEqual(r.rank, null);
    assert.strictEqual(r.userScore, null);
    assert.strictEqual(r.maxPoints, 10);
    assert.strictEqual(r.bestUci, "e2e4", "the best move is still reported so it can be shown");
    assert.strictEqual(r.bestScore, 30);
    assert.strictEqual(r.needsEvaluation, false);
  });
  // An unknown reason string is not special.
  assert.strictEqual(assess({ lines, userUci: "e2e4", reason: "whatever" }).points, 10);
  assert.strictEqual(assess({ lines, userUci: "e2e4", reason: "" }).qualityCode, "perfect");
});

// ---------- brilliant / great ----------

test("brilliant needs isSacrifice and a best move; great needs best and an only move", () => {
  const onlyMoveLines = [{ uci: "e2e4", score: 200 }, { uci: "d2d4", score: -100 }];
  const closeLines = [{ uci: "e2e4", score: 200 }, { uci: "d2d4", score: 190 }]; // 0.8% apart at +2.00

  const great = assess({ lines: onlyMoveLines, userUci: "e2e4" });
  assert.strictEqual(great.qualityCode, "great");
  assert.strictEqual(great.onlyMove, true);
  assert.ok(great.gapToSecondPct >= 12);
  assert.strictEqual(great.points, 10);

  const brilliant = assess({ lines: onlyMoveLines, userUci: "e2e4" }, { isSacrifice: true });
  assert.strictEqual(brilliant.qualityCode, "brilliant");
  assert.strictEqual(brilliant.points, 10);

  const brilliantNotOnly = assess({ lines: closeLines, userUci: "d2d4" }, { isSacrifice: true });
  assert.strictEqual(brilliantNotOnly.qualityCode, "brilliant", "in the band: a sacrifice that is as good as the best");
  assert.strictEqual(assess({ lines: closeLines, userUci: "e2e4" }).qualityCode, "perfect", "no only-move, no sacrifice: plain perfect");

  // Not the best move: a sacrifice flag changes nothing.
  const bad = assess({ lines: onlyMoveLines, userUci: "d2d4" }, { isSacrifice: true });
  assert.strictEqual(bad.qualityCode, "blunder");
  const inaccurate = assess({ lines: closeLines, userUci: "d2d4", userScore: undefined, settings: { bestMode: "engine" } }, { isSacrifice: true });
  assert.notStrictEqual(inaccurate.qualityCode, "brilliant", "10 cp behind in engine mode is not best");

  // Only when the option is exactly true.
  ["yes", 1, "true", null, undefined, false].forEach((flag) => {
    assert.notStrictEqual(assess({ lines: onlyMoveLines, userUci: "e2e4" }, { isSacrifice: flag }).qualityCode, "brilliant", String(flag));
  });

  // A single line cannot establish an only move.
  const single = assess({ lines: [{ uci: "e2e4", score: 200 }], userUci: "e2e4" });
  assert.strictEqual(single.onlyMove, false);
  assert.strictEqual(single.gapToSecondPct, null);
  assert.strictEqual(single.qualityCode, "perfect");

  // Hints take the shine off.
  assert.strictEqual(assess({ lines: onlyMoveLines, userUci: "e2e4", hintsUsed: 1 }, { isSacrifice: true }).qualityCode, "perfect");
  assert.strictEqual(assess({ lines: onlyMoveLines, userUci: "e2e4", hintsUsed: 3 }).qualityCode, "perfect");

  // The gap threshold is 12 win%.
  const gap = (s2) => assess({ lines: [{ uci: "e2e4", score: 0 }, { uci: "d2d4", score: s2 }], userUci: "e2e4" });
  assert.strictEqual(gap(-100).onlyMove, false, "9.2% is not enough");
  assert.strictEqual(gap(-140).onlyMove, true, "12.7% is");
  // Second best is the best of the OTHER lines, wherever it sits.
  const unordered = assess({ lines: [{ uci: "e2e4", score: 0 }, { uci: "a2a3", score: -400 }, { uci: "d2d4", score: -10 }], userUci: "e2e4" });
  assert.strictEqual(unordered.onlyMove, false);
  assert.strictEqual(CONSTANTS.ONLY_MOVE_GAP_PCT, 12);
  // CNT-004: "only move" means every other line is materially worse. The only MATING move is not an only move when a
  // runner-up keeps +8.94 (Larsen-Spassky 1970: gap 3.3%, and "the others were clearly worse" was false) ...
  const mateBest = (second) => assess({ lines: [{ uci: "e2e4", score: mate(5) }, { uci: "d2d4", score: second }, { uci: "g1f3", score: 100 }], userUci: "e2e4" });
  assert.strictEqual(mateBest(894).onlyMove, false, "a runner-up at +8.94 is not materially worse than a mate");
  assert.strictEqual(mateBest(894).qualityCode, "perfect", "so it is perfect, not great");
  // ... but it is one when the runner-up is clearly worse (+3.00 is 24.8% below a mate).
  assert.strictEqual(mateBest(300).onlyMove, true);
  assert.strictEqual(mateBest(300).qualityCode, "great");
  // The gap is the distance to the BEST OTHER line, in win%: +5.00 against +2.00 is an only move (18.6%) although the runner-up still wins.
  const winning = assess({ lines: [{ uci: "e2e4", score: 500 }, { uci: "d2d4", score: 200 }], userUci: "e2e4" });
  assert.strictEqual(winning.onlyMove, true);
  assert.ok(winning.gapToSecondPct > 18 && winning.gapToSecondPct < 19);
});

// ---------- unknown moves ----------

test("a move that is not in the lines: userScore is used when given, otherwise a provisional estimate", () => {
  const lines = [{ uci: "e2e4", score: 30 }, { uci: "d2d4", score: 20 }, { uci: "g1f3", score: 0 }];
  const measured = assess({ lines, userUci: "a2a3", userScore: -100 });
  assert.strictEqual(measured.needsEvaluation, false);
  assert.strictEqual(measured.userScore, -100);
  assert.strictEqual(measured.rank, null);
  assert.ok(measured.points < 6);

  const unknown = assess({ lines, userUci: "a2a3" });
  assert.strictEqual(unknown.needsEvaluation, true);
  assert.strictEqual(unknown.userScore, null);
  assert.strictEqual(unknown.reason, "ok");
  assert.strictEqual(unknown.rank, null);
  assert.strictEqual(unknown.isBest, false);
  assert.ok(unknown.points > 0 && unknown.points < 10);
  assert.ok(unknown.winLossPct > 0);
  // Conservative: never better than the worst listed line would have scored...
  const worstListed = assess({ lines, userUci: "g1f3" });
  assert.ok(unknown.points < worstListed.points, `${unknown.points} < ${worstListed.points}`);
  assert.ok(unknown.accuracy < worstListed.accuracy);
  assert.ok(unknown.winLossPct >= worstListed.winLossPct + 7.9, "at least the margin worse");
  assert.notStrictEqual(unknown.qualityCode, "perfect");
  assert.notStrictEqual(unknown.qualityCode, "great");
  // ...and it does not invent mate reasons.
  const mateLines = [{ uci: "e2e4", score: mate(2) }, { uci: "d2d4", score: mate(4) }];
  const unknownVsMate = assess({ lines: mateLines, userUci: "a2a3" });
  assert.strictEqual(unknownVsMate.needsEvaluation, true);
  assert.strictEqual(unknownVsMate.reason, "ok");
  // Once it is evaluated, the real rules apply.
  assert.strictEqual(assess({ lines: mateLines, userUci: "a2a3", userScore: 150 }).reason, "missed_mate");
  // userScore may also be an engine-style score object.
  assert.strictEqual(assess({ lines, userUci: "a2a3", userScore: { type: "cp", value: -100 } }).userScore, -100);
  // A userScore is ignored when the move is in the lines.
  assert.strictEqual(assess({ lines, userUci: "d2d4", userScore: -900 }).userScore, 20);
  // Garbage userScore counts as missing.
  ["x", NaN, null, {}, [], true].forEach((bad) => assert.strictEqual(assess({ lines, userUci: "a2a3", userScore: bad }).needsEvaluation, true, String(bad)));
  // Margin constants are documented values.
  assert.strictEqual(CONSTANTS.UNKNOWN_MOVE_MARGIN_PCT, 8);
});

test("no usable lines: unrated, needs evaluation, no crash", () => {
  [[], null, undefined, "x", [null, 3, {}, { uci: "zzzz", score: 1 }, { uci: "e2e4", score: "x" }]].forEach((lines) => {
    const r = assess({ lines, userUci: "e2e4" });
    assert.strictEqual(r.points, 0);
    assert.strictEqual(r.qualityCode, "no_move");
    assert.strictEqual(r.needsEvaluation, true);
    assert.strictEqual(r.error, "no_lines");
    assert.strictEqual(r.bestUci, null);
    assert.strictEqual(r.bestScore, null);
  });
  assert.strictEqual(assess({}).qualityCode, "no_move");
  assert.strictEqual(assess().reason, "no_move");
  assert.strictEqual(assess(null).points, 0);
  assert.strictEqual(assess("nonsense").points, 0);
});

// ---------- input shapes ----------

test("lines: engine lines, compact reference lines, garbage entries and duplicates", () => {
  const engineLines = [
    { multipv: 1, depth: 14, score: { type: "cp", value: 34 }, pv: ["e2e4", "e7e5"] },
    { multipv: 2, depth: 14, score: { type: "cp", value: 20 }, pv: ["d2d4", "d7d5"] },
    { multipv: 3, depth: 14, score: { type: "mate", value: -3 }, pv: ["a2a3"] },
  ];
  const fromEngine = assess({ lines: engineLines, userUci: "d2d4" });
  assert.strictEqual(fromEngine.rank, 2);
  assert.strictEqual(fromEngine.userScore, 20);
  assert.strictEqual(fromEngine.bestScore, 34);
  const fromMate = assess({ lines: engineLines, userUci: "a2a3" });
  assert.strictEqual(fromMate.reason, "allows_mate");
  assert.strictEqual(fromMate.userScore, mate(-3));

  const compact = [
    { uci: "e2e4", san: "e4", score: 34, pv: ["e2e4", "e7e5"] },
    { uci: "d2d4", san: "d4", score: 20, pv: ["d2d4"] },
  ];
  assert.strictEqual(assess({ lines: compact, userUci: "d2d4" }).rank, 2);

  const messy = [null, 5, "e2e4", { uci: "nope", score: 1 }, { uci: "e2e4", score: NaN }, { uci: "E2E4", score: 34 }, { uci: "e2e4", score: -900 }, { pv: ["d2d4"], score: 20 }];
  const r = assess({ lines: messy, userUci: "d2d4" });
  assert.strictEqual(r.bestUci, "e2e4");
  assert.strictEqual(r.bestScore, 34, "the first valid entry for a move wins, the duplicate is ignored");
  assert.strictEqual(r.rank, 2);
  // Uppercase / padded user moves are normalised.
  assert.strictEqual(assess({ lines: compact, userUci: " D2D4 " }).rank, 2);
  // A promotion move is a normal UCI move.
  assert.strictEqual(assess({ lines: [{ uci: "e7e8q", score: 900 }, { uci: "e7e8n", score: 300 }], userUci: "e7e8n" }).rank, 2);
  // Only the first 64 lines are looked at.
  const many = Array.from({ length: 200 }, (_, i) => ({ uci: `a${1 + (i % 8)}b${1 + ((i * 3) % 8)}`, score: 100 - i }));
  assert.doesNotThrow(() => assess({ lines: many, userUci: many[150].uci }));
});

test("assess is pure: inputs may be frozen, results are stable", () => {
  const settings = Object.freeze({ model: "precision", strictness: "strict", bestMode: "band", tolerancePct: 2, hintCost: Object.freeze({ level1: 0.2 }) });
  const lines = Object.freeze([
    Object.freeze({ uci: "e2e4", score: 30, pv: Object.freeze(["e2e4"]) }),
    Object.freeze({ uci: "d2d4", score: -20, pv: Object.freeze(["d2d4"]) }),
  ]);
  const input = Object.freeze({ lines, userUci: "d2d4", settings, hintsUsed: 1 });
  const a = assess(input, Object.freeze({ isSacrifice: false }));
  const b = assess(input, Object.freeze({ isSacrifice: false }));
  assert.deepStrictEqual(a, b);
  assert.strictEqual(lines[0].score, 30);
});

test("assessment shape: every contract field is present with the right type", () => {
  const r = assess({ lines: [{ uci: "e2e4", score: 30 }, { uci: "d2d4", score: 10 }], userUci: "d2d4" });
  ["points", "rawPoints", "maxPoints", "accuracy", "winLossPct", "cpLoss", "hintPenalty"].forEach((key) => assert.strictEqual(typeof r[key], "number", key));
  ["qualityCode", "reason", "bestUci"].forEach((key) => assert.strictEqual(typeof r[key], "string", key));
  ["isBest", "onlyMove", "needsEvaluation"].forEach((key) => assert.strictEqual(typeof r[key], "boolean", key));
  ["bestScore", "userScore", "gapToSecondPct", "rank"].forEach((key) => assert.ok(r[key] === null || typeof r[key] === "number", key));
  assert.strictEqual(r.maxPoints, 10);
  assert.ok(QUALITY_CODES.includes(r.qualityCode));
  assert.ok(REASONS.includes(r.reason));
});

// ---------- fuzz ----------

test("fuzz: invariants hold for random inputs (seeded)", () => {
  let seed = 20260930;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const pick = (list) => list[Math.floor(random() * list.length)];
  const randomScore = () => {
    const r = random();
    if (r < 0.12) return mate(Math.floor(random() * 12) + 1);
    if (r < 0.24) return mate(-Math.floor(random() * 12));
    return Math.round((random() - 0.5) * 2 * (random() < 0.8 ? 600 : 3000));
  };
  const moves = ["e2e4", "d2d4", "g1f3", "b1c3", "c2c4", "a2a3", "h2h3", "f2f4"];
  for (let i = 0; i < 4000; i += 1) {
    const lineCount = 1 + Math.floor(random() * 4);
    const lines = moves.slice(0, lineCount).map((uci) => ({ uci, score: randomScore() }));
    const settings = {
      model: pick(["precision", "tiers"]),
      strictness: pick(["relaxed", "standard", "strict"]),
      bestMode: pick(["engine", "band", "masters"]),
      tolerancePct: pick([0, 0.5, 1, 2, 5]),
    };
    const userUci = pick([...moves, null]);
    const input = { lines, userUci, settings, hintsUsed: pick([0, 0, 0, 1, 2, 3]), reason: pick(["", "", "", "timeout", "skip"]), masterUci: pick(moves) };
    if (random() < 0.5) input.userScore = randomScore();
    const r = assess(input, { isSacrifice: random() < 0.2 });
    const label = JSON.stringify(input);
    assert.ok(r.points >= 0 && r.points <= 10 && isOneDecimal(r.points), label);
    assert.ok(r.rawPoints >= r.points && r.rawPoints <= 10, label);
    assert.ok(r.accuracy >= 0 && r.accuracy <= 100, label);
    assert.ok(r.winLossPct >= 0 && r.cpLoss >= 0 && r.cpLoss <= 2500, label);
    assert.ok(QUALITY_CODES.includes(r.qualityCode) && REASONS.includes(r.reason), label);
    assert.ok(Number.isFinite(r.bestScore) && r.bestUci === lines[0].uci, label);
    if (input.hintsUsed === 3) assert.strictEqual(r.points, 0, label);
    if (r.qualityCode === "no_move") assert.strictEqual(r.points, 0, label);
    if (r.reason === "allows_mate") assert.ok(r.points <= 1 && r.qualityCode === "blunder", label);
    if (r.reason === "missed_mate") assert.ok(r.isBest === false && !["brilliant", "great", "perfect", "very_good"].includes(r.qualityCode) && r.points <= 8, label);
    if (r.keptWin) assert.ok(r.reason === "missed_mate", label);
    if (r.isBest) assert.ok(r.reason === "ok" && !r.needsEvaluation && r.mateExtraMoves === 0, label);
    if (r.needsEvaluation) assert.strictEqual(r.userScore, null, label);
    if (r.qualityCode === "brilliant" || r.qualityCode === "great") assert.ok(r.isBest && input.hintsUsed === 0 && r.rawPoints === 10, label);
    // Strictness ordering holds on the same input.
    const order = ["strict", "standard", "relaxed"].map((strictness) => assess({ ...input, settings: { ...settings, strictness } }).rawPoints);
    assert.ok(order[0] <= order[1] && order[1] <= order[2], `${label} -> ${order}`);
  }
});

// ---------- meta, compat, summary ----------

test("qualityMeta: 10 codes, unique order, colour token, glyph, label key", () => {
  const orders = new Set();
  QUALITY_CODES.forEach((code, index) => {
    const meta = Scoring.qualityMeta(code);
    assert.strictEqual(meta.order, index, `${code} is at position ${index}`);
    orders.add(meta.order);
    assert.ok(/^--color-[a-z-]+$/.test(meta.colorToken), meta.colorToken);
    assert.ok(typeof meta.glyph === "string" && meta.glyph.length >= 1 && meta.glyph.length <= 3);
    assert.strictEqual(meta.labelKey, `quality.${code}`);
  });
  assert.strictEqual(orders.size, 10);
  const glyphs = QUALITY_CODES.map((code) => Scoring.qualityMeta(code).glyph);
  assert.strictEqual(new Set(glyphs).size, 10, "every quality has its own glyph (colour is never the only cue)");
  assert.deepStrictEqual(Scoring.qualityMeta("does-not-exist"), Scoring.qualityMeta("no_move"));
  assert.deepStrictEqual(Scoring.qualityMeta(undefined), Scoring.qualityMeta("no_move"));
  assert.deepStrictEqual(Scoring.qualityMeta("constructor"), Scoring.qualityMeta("no_move"), "no prototype leakage");
  const tokens = new Set(QUALITY_CODES.map((code) => Scoring.qualityMeta(code).colorToken));
  // Only tokens that exist in styles.css today.
  const css = fs.readFileSync(path.join(repoRoot, "styles.css"), "utf8");
  tokens.forEach((token) => assert.ok(css.includes(`${token}:`), `styles.css defines ${token}`));
});

test("compatQuality: the 10 codes map onto the 8 legacy codes", () => {
  assert.strictEqual(Scoring.compatQuality("brilliant"), "perfect");
  assert.strictEqual(Scoring.compatQuality("great"), "perfect");
  LEGACY_CODES.forEach((code) => assert.strictEqual(Scoring.compatQuality(code), code));
  QUALITY_CODES.forEach((code) => assert.ok(LEGACY_CODES.includes(Scoring.compatQuality(code)), code));
  ["nope", undefined, null, 5, "constructor", "__proto__"].forEach((bad) => assert.strictEqual(Scoring.compatQuality(bad), "no_move", String(bad)));
});

test("summarize: totals, average accuracy, per-quality counts", () => {
  const list = [
    score(0, 0),
    score(0, -50),
    score(0, -300),
    assess({ lines: [{ uci: "e2e4", score: 0 }], userUci: null }),
    score(0, 0, { hintsUsed: 3 }),
  ];
  const s = Scoring.summarize(list);
  assert.strictEqual(s.count, 5);
  assert.strictEqual(s.maxPoints, 50);
  const expectedPoints = Math.round(list.reduce((sum, item) => sum + item.points, 0) * 10) / 10;
  assert.strictEqual(s.points, expectedPoints);
  assert.strictEqual(s.avgAccuracy, Math.round(list.reduce((sum, item) => sum + item.accuracy, 0) / 5 * 10) / 10);
  assert.deepStrictEqual(Object.keys(s.byQuality), QUALITY_CODES);
  assert.strictEqual(Object.values(s.byQuality).reduce((a, b) => a + b, 0), 5);
  assert.strictEqual(s.byQuality.no_move, 1);
  assert.strictEqual(s.byQuality.perfect, 2);
  assert.strictEqual(s.byQuality.blunder, 1);
  assert.strictEqual(s.bestCount, 2);
  assert.deepStrictEqual(Scoring.summarize([]), { count: 0, points: 0, maxPoints: 0, avgAccuracy: 0, byQuality: Object.fromEntries(QUALITY_CODES.map((c) => [c, 0])), bestCount: 0 });
  assert.strictEqual(Scoring.summarize(null).count, 0);
  const tolerant = Scoring.summarize([null, 5, {}, { points: "x" }, { points: 4, accuracy: 40, qualityCode: "bogus" }, { points: 6, maxPoints: 12, accuracy: 60, qualityCode: "good" }]);
  assert.strictEqual(tolerant.count, 2);
  assert.strictEqual(tolerant.points, 10);
  assert.strictEqual(tolerant.maxPoints, 22);
  assert.strictEqual(tolerant.avgAccuracy, 50);
  assert.strictEqual(tolerant.byQuality.no_move, 1, "an unknown quality code is counted as no_move");
  assert.strictEqual(tolerant.byQuality.good, 1);
});

// ---------- UI text (through the real Ludus.i18n) ----------

test("UI text is registered in Spanish and English through Ludus.i18n", () => {
  const env = load({ app: false, scripts: ["js/ludus.js", "js/scoring.js"] });
  const { i18n, Scoring: loaded } = env.Ludus;
  const es = {
    brilliant: "Brillante", great: "Gran jugada", perfect: "Perfecta", very_good: "Muy buena", good: "Buena", interesting: "Imprecisa",
    dubious: "Dudosa", bad: "Error", blunder: "Error grave", no_move: "Sin jugada",
  };
  const en = {
    brilliant: "Brilliant", great: "Great move", perfect: "Perfect", very_good: "Very good", good: "Good", interesting: "Inaccuracy",
    dubious: "Dubious", bad: "Mistake", blunder: "Serious mistake", no_move: "No move",
  };
  QUALITY_CODES.forEach((code) => {
    assert.strictEqual(i18n.t(`quality.${code}`, {}, "es"), es[code], `es ${code}`);
    assert.strictEqual(i18n.t(`quality.${code}`, {}, "en"), en[code], `en ${code}`);
    assert.strictEqual(loaded.qualityLabel(code, "en"), en[code]);
    assert.strictEqual(loaded.qualityLabel(code, "es"), es[code]);
  });
  ["allows_mate", "missed_mate", "timeout", "skip", "no_move"].forEach((reason) => {
    const textEs = loaded.reasonLabel(reason, "es");
    const textEn = loaded.reasonLabel(reason, "en");
    assert.ok(textEs && textEn && textEs !== textEn, reason);
    assert.notStrictEqual(textEs, `scoring.reason.${reason}`);
  });
  assert.strictEqual(loaded.reasonLabel("ok", "en"), "");
  assert.strictEqual(loaded.reasonLabel("whatever", "en"), "");
  ["scoring.note.slower_mate", "scoring.note.provisional", "scoring.note.hint_penalty"].forEach((key) => {
    assert.notStrictEqual(i18n.t(key, { percent: 15 }, "es"), key);
    assert.notStrictEqual(i18n.t(key, { percent: 15 }, "en"), key);
  });
  assert.ok(i18n.t("scoring.note.hint_penalty", { percent: 15 }, "es").includes("15%"));
  // formatEval follows the current UI language when no language is passed.
  i18n.setLanguage("en");
  assert.strictEqual(loaded.formatEval(35), "+0.35");
  i18n.setLanguage("es");
  assert.strictEqual(loaded.formatEval(35), "+0,35");
  assert.strictEqual(loaded.formatEval(35, "en"), "+0.35", "an explicit language wins");
  // The same maths in the loaded copy.
  assert.strictEqual(loaded.assess({ lines: [{ uci: "e2e4", score: 30 }], userUci: "e2e4" }).points, 10);
});

test("standalone (no Ludus.i18n): labels fall back to the built-in table", () => {
  assert.strictEqual(Scoring.qualityLabel("good", "en"), "Good");
  assert.strictEqual(Scoring.qualityLabel("good", "es"), "Buena");
  assert.strictEqual(Scoring.qualityLabel("nope", "en"), "No move");
  assert.ok(Scoring.reasonLabel("missed_mate", "en").includes("mate"));
});

// ---------- docs/SCORING.md stays in sync with the code ----------

function buildDocTables() {
  const out = [];
  const contexts = [{ label: "+0.30", cp: 30 }, { label: "+1.50", cp: 150 }, { label: "-1.00", cp: -100 }];
  const losses = [10, 25, 50, 75, 100, 150, 200, 300, 500, 800];

  out.push("### Table 1 - what a loss costs (standard strictness, band 1 %, precision model)", "");
  out.push("Each cell: `win% loss -> points (label)`. Best move worth the evaluation in the header column, the user's move `cp loss` centipawns worse.", "");
  out.push(`| cp loss | ${contexts.map((c) => `at ${c.label}`).join(" | ")} |`);
  out.push(`| ---: | ${contexts.map(() => "---").join(" | ")} |`);
  losses.forEach((loss) => {
    const cells = contexts.map((c) => {
      const r = score(c.cp, c.cp - loss);
      return `${r.winLossPct.toFixed(1)} % -> **${r.points.toFixed(1)}** (${r.qualityCode})`;
    });
    out.push(`| ${loss} | ${cells.join(" | ")} |`);
  });

  out.push("", "### Table 2 - the three strictness levels (best move at +0.30)", "");
  out.push("| cp loss | relaxed (k 0.6) | standard (k 1) | strict (k 1.6) |");
  out.push("| ---: | ---: | ---: | ---: |");
  [25, 50, 100, 150, 300, 500].forEach((loss) => {
    const cells = ["relaxed", "standard", "strict"].map((strictness) => {
      const r = score(30, 30 - loss, { settings: { strictness } });
      return `${r.points.toFixed(1)} (${r.qualityCode})`;
    });
    out.push(`| ${loss} | ${cells.join(" | ")} |`);
  });

  out.push("", "### Table 3 - label boundaries (standard strictness, band 1 %)", "");
  out.push("`E` is the effective loss (`(win% loss - band) * k`). Points are the precision-model points exactly at the boundary; the cp column is the loss that reaches it from an equal position (0.00).", "");
  out.push("| label | E up to | win% loss up to | about cp loss (from 0.00) | points at the boundary | tiers-model points |");
  out.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  out.push(`| perfect | ${CONSTANTS.PERFECT_E} | ${(DEFAULTS.tolerancePct + CONSTANTS.PERFECT_E).toFixed(2)} | ${cpForLoss(DEFAULTS.tolerancePct + CONSTANTS.PERFECT_E)} | 10.0 | 10 |`);
  CONSTANTS.LABEL_LIMITS.forEach(([label, limit]) => {
    const winLoss = DEFAULTS.tolerancePct + limit;
    const points = Math.round(accuracyFromLoss(winLoss, {}) / 10 * 10) / 10;
    out.push(`| ${label} | ${limit} | ${winLoss.toFixed(1)} | ${cpForLoss(winLoss)} | ${points.toFixed(1)} | ${CONSTANTS.TIER_POINTS[label]} |`);
  });
  out.push("| blunder | above 19 | above 20.0 | above " + cpForLoss(20) + " | under 2.0 | 0 |");

  out.push("", "### Table 4 - mates (standard strictness)", "");
  out.push("| situation | points | label | reason |");
  out.push("| --- | ---: | --- | --- |");
  const mateRow = (name, r) => out.push(`| ${name} | ${r.points.toFixed(1)} | ${r.qualityCode} | ${r.reason} |`);
  const mateLines = (score2) => [{ uci: "e2e4", score: mate(2) }, { uci: "d2d4", score: score2 }, { uci: "g1f3", score: 300 }];
  mateRow("best is mate in 2, you play it", assess({ lines: mateLines(mate(3)), userUci: "e2e4" }));
  mateRow("best is mate in 2, you play another mate in 2", assess({ lines: [{ uci: "e2e4", score: mate(2) }, { uci: "d2d4", score: mate(2) }], userUci: "d2d4" }));
  [3, 4, 6, 10, 30].forEach((n) => mateRow(`best is mate in 2, you mate in ${n}`, assess({ lines: mateLines(mate(n)), userUci: "d2d4" })));
  mateRow("best is mate in 2, you play +9.50 (missed mate, still winning)", assess({ lines: mateLines(mate(3)), userUci: "a2a3", userScore: 950 }));
  mateRow("best is mate in 2, you play +5.00 (missed mate, still winning)", assess({ lines: mateLines(mate(3)), userUci: "a2a3", userScore: 500 }));
  mateRow("best is mate in 2, you play +3.00 (missed mate)", assess({ lines: mateLines(mate(3)), userUci: "g1f3" }));
  mateRow("best is mate in 6, you play +9.50 (missed mate, still winning)", assess({ lines: [{ uci: "e2e4", score: mate(6) }, { uci: "d2d4", score: 300 }], userUci: "a2a3", userScore: 950 }));
  mateRow("best is mate in 6, you play +5.00 (missed mate, still winning)", assess({ lines: [{ uci: "e2e4", score: mate(6) }, { uci: "d2d4", score: 300 }], userUci: "a2a3", userScore: 500 }));
  mateRow("best is mate in 6, you play +1.00 (the win is gone)", assess({ lines: [{ uci: "e2e4", score: mate(6) }, { uci: "d2d4", score: 300 }], userUci: "a2a3", userScore: 100 }));
  mateRow("best is +0.50, you play a move that gets mated in 2", assess({ lines: [{ uci: "e2e4", score: 50 }, { uci: "d2d4", score: 20 }], userUci: "a2a3", userScore: mate(-2) }));
  mateRow("every move is mated: best is -M5, you allow -M2", assess({ lines: [{ uci: "e2e4", score: mate(-5) }, { uci: "d2d4", score: mate(-2) }], userUci: "d2d4" }));

  out.push("", "### Table 5 - hints (a perfect move, raw 10.0, and a 50 cp inaccuracy, raw 7.5)", "");
  out.push("| hints used | cost | perfect move | 50 cp inaccuracy |");
  out.push("| --- | ---: | ---: | ---: |");
  [[0, "none", 0], [1, "level 1 (piece highlight)", 0.15], [2, "level 2 (destination)", 0.35], [3, "reveal", 1]].forEach(([used, name, cost]) => {
    out.push(`| ${used} - ${name} | ${Math.round(cost * 100)} % | ${score(0, 0, { hintsUsed: used }).points.toFixed(1)} | ${score(0, -50, { hintsUsed: used }).points.toFixed(1)} |`);
  });

  out.push("", "### Table 6 - win% of common evaluations", "");
  out.push("| evaluation | win% | | evaluation | win% |");
  out.push("| ---: | ---: | --- | ---: | ---: |");
  const rows = [[0, 300], [50, 500], [100, 800], [150, 1000], [200, mate(10)]];
  rows.forEach(([a, b]) => {
    out.push(`| ${Scoring.formatEval(a, "en")} | ${winPercent(a).toFixed(1)} | | ${Scoring.formatEval(b, "en")} | ${winPercent(b).toFixed(1)} |`);
  });
  return out.join("\n");
}

test("labels near a threshold (CNT-013): a pure function of the loss with no hysteresis, so a flip between two searches must come with a small change of points", () => {
  // Two independent searches of the same move differ by about 1.9 win% on average (docs/SCORING.md section 15), so a move that sits on a
  // label boundary can read as the neighbouring label in another run. Nothing can be remembered between calls (assess is pure), so what
  // keeps this honest is that the score is continuous at every boundary: the neighbouring label never comes with a cliff in the points.
  const order = ["perfect", "very_good", "good", "interesting", "dubious", "bad", "blunder"];
  ["relaxed", "standard", "strict"].forEach((strictness) => {
    const settings = { strictness };
    let previous = null;
    let flips = 0;
    for (let cp = 0; cp <= 600; cp += 1) {
      const result = score(30, 30 - cp, { settings });
      const again = score(30, 30 - cp, { settings });
      assert.deepStrictEqual(again, result, `${strictness} ${cp} cp: the same input gives the same label and points (no hidden state)`);
      assert.ok(order.includes(result.qualityCode), `${strictness} ${cp} cp: ${result.qualityCode}`);
      if (previous) {
        assert.ok(order.indexOf(result.qualityCode) >= order.indexOf(previous.qualityCode), `${strictness}: the label never improves as the loss grows (${previous.qualityCode} -> ${result.qualityCode} at ${cp} cp)`);
        assert.ok(result.points <= previous.points + 1e-9, `${strictness}: points never rise as the loss grows (${cp} cp)`);
        if (result.qualityCode !== previous.qualityCode) {
          flips += 1;
          // one centipawn is about 0.09 win%: the steepest point at a boundary is about 1.1 points per win% (strict)
          assert.ok(previous.points - result.points <= 0.25, `${strictness}: a flip ${previous.qualityCode} -> ${result.qualityCode} at ${cp} cp costs ${(previous.points - result.points).toFixed(2)} points`);
        }
      }
      previous = result;
    }
    assert.strictEqual(flips, 6, `${strictness}: the six boundaries of the ladder were all crossed`);
  });
  // The tiers model is a staircase by design ("easier to read, less fine"): a flip moves the points by exactly one step, never more.
  const steps = [];
  let before = null;
  for (let cp = 0; cp <= 600; cp += 1) {
    const result = score(30, 30 - cp, { settings: { model: "tiers" } });
    if (before && result.qualityCode !== before.qualityCode) steps.push(before.points - result.points);
    before = result;
  }
  assert.ok(steps.length >= 5 && steps.every((step) => step >= 0 && step <= 2.5 + 1e-9), `tiers: every flip is one step of at most 2.5 points (${steps.join(", ")})`);
});

// cp loss that costs `loss` win% starting from an equal position (bisection).
function cpForLoss(loss) {
  let low = 0;
  let high = 1000;
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (winPercent(mid) - 50 < loss) low = mid;
    else high = mid;
  }
  return Math.round(low / 5) * 5;
}

test("docs/SCORING.md tables are generated from the code (run with --write-docs after changing the maths)", () => {
  const generated = `${DOC_BEGIN}\n\n${buildDocTables()}\n\n${DOC_END}`;
  const doc = fs.readFileSync(DOC_PATH, "utf8");
  const start = doc.indexOf(DOC_BEGIN);
  const end = doc.indexOf(DOC_END);
  if (process.argv.includes("--write-docs")) {
    assert.ok(start >= 0 && end > start, "docs/SCORING.md must contain the BEGIN/END GENERATED TABLES markers");
    fs.writeFileSync(DOC_PATH, doc.slice(0, start) + generated + doc.slice(end + DOC_END.length));
    console.log("docs/SCORING.md tables rewritten");
    return;
  }
  assert.ok(start >= 0 && end > start, "docs/SCORING.md must contain the BEGIN/END GENERATED TABLES markers");
  const current = doc.slice(start, end + DOC_END.length);
  assert.strictEqual(current, generated, "docs/SCORING.md is out of date: run `node scripts/tests/scoring.test.js --write-docs`");
});

console.log(`scoring.test.js passed (${testCount} tests)`);
