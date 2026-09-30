// Scoring: win%, accuracy, points and quality labels for one chosen move.
// Contract: docs/ARCHITECTURE.md section 7. The maths, the calibration tables
// and the reasoning behind every constant live in docs/SCORING.md (the tables
// there are generated from this file and checked by scripts/tests/scoring.test.js).
//
// Vocabulary
//   score        a number: centipawns from the MOVER's point of view, mate encoded
//                as +-(100000 - 1000 * min(50, n)) where n is the UCI "mate" value
//                (full moves, positive = the mover mates). Same encoding as app.js.
//   win%         0..100, Lichess logistic on centipawns clamped to +-1000.
//   loss         win% of the best line minus win% of the user's move (>= 0).
//   excess       loss beyond the "equivalent move" tolerance band.
//   E            effective loss = excess * strictness (the number every label
//                threshold and the accuracy curve are expressed in).
//   accuracy     clamp(103.1668 * e^(-0.04354 * CURVE_SCALE * E) - 3.1669, 0, 100)
//   points       accuracy / 10 (precision model) or a fixed tier (tiers model),
//                one decimal, then multiplied by (1 - hint cost).
//
// Pure logic: no DOM, no storage, no clock, no randomness.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Scoring = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  // ---------- constants ----------

  const MATE_BASE = 100000;
  const MATE_STEP = 1000;
  const MATE_MAX_DISTANCE = 50;
  const MATE_THRESHOLD = MATE_BASE - MATE_MAX_DISTANCE * MATE_STEP; // |score| >= this is a mate
  const CP_LIMIT = MATE_THRESHOLD - 1; // largest centipawn value that still decodes as centipawns

  const WIN_CP_CLAMP = 1000; // Lichess clamps centipawns before the logistic
  const WIN_SLOPE = 0.00368208; // Lichess win% logistic constant

  const ACCURACY_A = 103.1668; // Lichess per-move accuracy curve
  const ACCURACY_B = 0.04354;
  const ACCURACY_C = 3.1669;

  // Strictness multiplier k on the effective loss (ARCHITECTURE.md section 7).
  const STRICTNESS_K = Object.freeze({ relaxed: 0.6, standard: 1, strict: 1.6 });

  // Global calibration of the curve, on top of k. With the plain Lichess curve a
  // 150 cp mistake in a balanced position still scored 5.5/10 and a 300 cp
  // blunder 3.2/10, which did not match the product owner's targets (inaccuracy
  // 6.5-8, mistake 3-5, blunder 0-1). See docs/SCORING.md "Calibration".
  const CURVE_SCALE = 1.8;

  // Label thresholds, in E units (effective loss, strictness already applied):
  // E == 0 perfect; <= 2 very_good; <= 4.5 good; <= 8 interesting; <= 12
  // dubious; <= 19 bad; above that blunder.
  const LABEL_LIMITS = Object.freeze([
    ["very_good", 2],
    ["good", 4.5],
    ["interesting", 8],
    ["dubious", 12],
    ["bad", 19],
  ]);

  const TIER_POINTS = Object.freeze({
    brilliant: 10, great: 10, perfect: 10, very_good: 7.5, good: 5, interesting: 2.5, dubious: 0, bad: 0, blunder: 0,
  });

  const ONLY_MOVE_GAP_PCT = 12; // best beats the second line by this many win% -> "only move"
  const MASTER_TOLERANCE_PCT = 3; // bestMode "masters": the master's move counts within this loss
  const UNKNOWN_MOVE_MARGIN_PCT = 8; // move not in the lines and no userScore: worst line minus this
  const UNKNOWN_MOVE_MARGIN_CP = 80;
  const MATE_BLUNDER_MAX_ACCURACY = 10; // missing / allowing a mate never scores above 1.0 point
  const MATE_SLOWER_STEP_E = 0.75; // effective loss per extra move of a slower (still winning) mate
  const MATE_SLOWER_CAP_E = 6; // ...capped, so a slower mate is never worse than "interesting"
  const MAX_CP_LOSS = 2500;
  const MAX_LINES = 64;
  const MAX_POINTS = 10;
  const EPS = 1e-9;

  const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

  const QUALITY_CODES = Object.freeze([
    "brilliant", "great", "perfect", "very_good", "good", "interesting", "dubious", "bad", "blunder", "no_move",
  ]);

  const QUALITY_META = Object.freeze({
    brilliant: Object.freeze({ order: 0, colorToken: "--color-gold", glyph: "!!" }),
    great: Object.freeze({ order: 1, colorToken: "--color-perfect", glyph: "!" }),
    perfect: Object.freeze({ order: 2, colorToken: "--color-perfect", glyph: "★" }),
    very_good: Object.freeze({ order: 3, colorToken: "--color-perfect", glyph: "✓" }),
    good: Object.freeze({ order: 4, colorToken: "--color-good", glyph: "○" }),
    interesting: Object.freeze({ order: 5, colorToken: "--color-dubious", glyph: "!?" }),
    dubious: Object.freeze({ order: 6, colorToken: "--color-dubious", glyph: "?!" }),
    bad: Object.freeze({ order: 7, colorToken: "--color-blunder", glyph: "?" }),
    blunder: Object.freeze({ order: 8, colorToken: "--color-blunder", glyph: "??" }),
    no_move: Object.freeze({ order: 9, colorToken: "--color-text-muted", glyph: "—" }),
  });

  // The eight codes the pre-existing CSS / app.js know about.
  const LEGACY_QUALITY = Object.freeze({
    brilliant: "perfect", great: "perfect", perfect: "perfect", very_good: "very_good", good: "good",
    interesting: "interesting", dubious: "dubious", bad: "bad", blunder: "blunder", no_move: "no_move",
  });

  const MODELS = Object.freeze(["precision", "tiers"]);
  const STRICTNESS_LEVELS = Object.freeze(["relaxed", "standard", "strict"]);
  const BEST_MODES = Object.freeze(["engine", "band", "masters"]);

  const DEFAULTS = Object.freeze({
    model: "precision",
    strictness: "standard",
    bestMode: "band",
    tolerancePct: 1,
    hintCost: Object.freeze({ level1: 0.15, level2: 0.35, reveal: 1 }),
  });

  // ---------- small helpers ----------

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round1(value) {
    const rounded = Math.round(value * 10) / 10;
    return rounded === 0 ? 0 : rounded; // never -0
  }

  function round2(value) {
    const rounded = Math.round(value * 100) / 100;
    return rounded === 0 ? 0 : rounded;
  }

  function isNumeric(value) {
    return (typeof value === "number" && Number.isFinite(value))
      || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)));
  }

  // ---------- score encoding ----------

  // {type: "cp"|"mate", value} (as parsed from UCI) -> number. NaN if unusable.
  function encodeScore(score) {
    if (!score || typeof score !== "object") return NaN;
    const value = Number(score.value);
    if (!Number.isFinite(value)) return NaN;
    if (score.type === "mate") {
      const distance = Math.min(MATE_MAX_DISTANCE, Math.abs(Math.round(value)));
      const magnitude = MATE_BASE - distance * MATE_STEP;
      return value > 0 ? magnitude : -magnitude; // mate 0 = the mover is mated
    }
    if (score.type === "cp") return clamp(Math.round(value), -CP_LIMIT, CP_LIMIT);
    return NaN;
  }

  // number -> { kind: "cp", cp } | { kind: "mate", matePly, mateMoves } | null.
  // NOTE: `matePly` keeps the name used by app.js and the contract, but like
  // the UCI "score mate" value it counts full MOVES of the mating side (mate in
  // 3 = 3), not plies. `mateMoves` is the same number under an honest name.
  // Positive: the mover mates; negative or 0: the mover is (about to be) mated.
  function decodeScore(score) {
    const n = Number(score);
    if (typeof score === "boolean" || score === null || score === "" || !Number.isFinite(n)) return null;
    const abs = Math.abs(n);
    if (abs >= MATE_THRESHOLD) {
      const distance = Math.round((MATE_BASE - Math.min(abs, MATE_BASE)) / MATE_STEP);
      if (n > 0) {
        const moves = Math.max(1, distance);
        return { kind: "mate", matePly: moves, mateMoves: moves };
      }
      const moves = distance === 0 ? 0 : -distance;
      return { kind: "mate", matePly: moves, mateMoves: moves };
    }
    return { kind: "cp", cp: Math.round(n) };
  }

  // A score measured by the engine AFTER the move was played (so from the
  // OPPONENT's point of view, opponent to move) -> the same quantity from the
  // mover's point of view BEFORE the move, in the same encoding. Centipawns
  // just flip sign; a mate distance shifts by the move itself: the opponent
  // mating in n means the mover is mated in n; the opponent being mated (0, -1,
  // -2, ...) means the mover mates in 1, 2, 3, ...
  function flipAfterMove(score) {
    const decoded = decodeScore(score);
    if (!decoded) return NaN;
    if (decoded.kind === "cp") return decoded.cp === 0 ? 0 : -decoded.cp;
    const n = decoded.mateMoves;
    return encodeScore({ type: "mate", value: n > 0 ? -n : 1 - n });
  }

  // ---------- win% ----------

  // 0..100. Centipawns are clamped to +-1000 (Lichess). A mate is worth the
  // win% of a big centipawn equivalent that still orders by distance
  // (mate in 1 = 2000 cp ... mate in 10+ = 1100 cp, sign for who gets mated), so
  // any mate for the mover beats any non-mate score and a closer mate beats a
  // farther one. Non-numeric input is "unknown": 50.
  function winPercent(score) {
    const n = Number(score);
    if (typeof score === "boolean" || score === null || score === "" || !Number.isFinite(n)) return 50;
    let cp;
    if (Math.abs(n) >= MATE_THRESHOLD) {
      const distance = Math.max(1, Math.round((MATE_BASE - Math.min(Math.abs(n), MATE_BASE)) / MATE_STEP));
      cp = (21 - Math.min(10, distance)) * 100 * (n > 0 ? 1 : -1);
    } else {
      cp = clamp(n, -WIN_CP_CLAMP, WIN_CP_CLAMP);
    }
    return 50 + 50 * (2 / (1 + Math.exp(-WIN_SLOPE * cp)) - 1);
  }

  // ---------- formatting ----------

  function currentLanguage() {
    const i18n = root.Ludus && root.Ludus.i18n;
    try {
      if (i18n && typeof i18n.lang === "function") return i18n.lang();
    } catch (error) {
      // Fall through to the default.
    }
    return "es";
  }

  // "+0.35" | "-1.20" | "0.00" | "M3" | "-M2". Pawn units with two decimals;
  // Spanish uses the decimal comma ("+0,35"). "?" when the score is unusable.
  function formatEval(score, lang) {
    const decoded = decodeScore(score);
    if (!decoded) return "?";
    if (decoded.kind === "mate") {
      return `${decoded.mateMoves > 0 ? "" : "-"}M${Math.abs(decoded.mateMoves)}`;
    }
    let text = (Math.abs(decoded.cp) / 100).toFixed(2);
    if ((lang || currentLanguage()) === "es") text = text.replace(".", ",");
    if (decoded.cp > 0) return `+${text}`;
    if (decoded.cp < 0) return `-${text}`;
    return text;
  }

  // ---------- settings ----------

  function normalizeTolerance(value) {
    if (!isNumeric(value)) return DEFAULTS.tolerancePct;
    return round2(clamp(Number(value), 0, 5));
  }

  function normalizeHintCost(value) {
    const source = value && typeof value === "object" ? value : {};
    const pick = (key) => (isNumeric(source[key]) ? clamp(Number(source[key]), 0, 1) : DEFAULTS.hintCost[key]);
    const level1 = pick("level1");
    const level2 = Math.max(level1, pick("level2"));
    const reveal = Math.max(level2, pick("reveal"));
    return { level1: round2(level1), level2: round2(level2), reveal: round2(reveal) };
  }

  // Partial (or garbage) -> a complete, validated, fresh settings object.
  function normalizeSettings(partial) {
    const source = partial && typeof partial === "object" ? partial : {};
    return {
      model: MODELS.includes(source.model) ? source.model : DEFAULTS.model,
      strictness: STRICTNESS_LEVELS.includes(source.strictness) ? source.strictness : DEFAULTS.strictness,
      bestMode: BEST_MODES.includes(source.bestMode) ? source.bestMode : DEFAULTS.bestMode,
      tolerancePct: normalizeTolerance(source.tolerancePct),
      hintCost: normalizeHintCost(source.hintCost),
    };
  }

  function normalizeHints(value) {
    const n = Number(value);
    if (typeof value === "boolean" || !Number.isFinite(n)) return 0;
    return clamp(Math.round(n), 0, 3);
  }

  function hintCostFor(settings, hintsUsed) {
    if (hintsUsed <= 0) return 0;
    if (hintsUsed === 1) return settings.hintCost.level1;
    if (hintsUsed === 2) return settings.hintCost.level2;
    return settings.hintCost.reveal;
  }

  // ---------- the precision curve ----------

  // Effective loss E (>= 0) -> accuracy 0..100 (not rounded).
  function curve(effectiveLoss) {
    if (!(effectiveLoss > 0)) return 100;
    return clamp(ACCURACY_A * Math.exp(-ACCURACY_B * CURVE_SCALE * effectiveLoss) - ACCURACY_C, 0, 100);
  }

  function bandFor(settings, isMasterMove) {
    if (settings.bestMode === "engine") return 0;
    if (settings.bestMode === "masters" && isMasterMove) return Math.max(settings.tolerancePct, MASTER_TOLERANCE_PCT);
    return settings.tolerancePct;
  }

  // Public helper: win% loss -> unrounded accuracy for the given settings
  // (tolerance band and strictness applied). This is the function the
  // calibration tables in docs/SCORING.md are built from.
  function accuracyFromLoss(winLossPct, settings) {
    const s = normalizeSettings(settings);
    const loss = Number(winLossPct);
    if (!Number.isFinite(loss)) return 0;
    const excess = Math.max(0, loss - bandFor(s, false));
    return curve(excess * STRICTNESS_K[s.strictness]);
  }

  function labelForEffectiveLoss(effectiveLoss) {
    if (effectiveLoss <= EPS) return "perfect";
    for (let i = 0; i < LABEL_LIMITS.length; i += 1) {
      if (effectiveLoss <= LABEL_LIMITS[i][1]) return LABEL_LIMITS[i][0];
    }
    return "blunder";
  }

  // ---------- assess ----------

  function normalizeUci(value) {
    if (typeof value !== "string") return null;
    const uci = value.trim().toLowerCase();
    return UCI_MOVE.test(uci) ? uci : null;
  }

  // A score given as a number (already encoded) or as an engine {type, value}.
  function toEncodedScore(value) {
    if (typeof value === "number") return Number.isFinite(value) ? clamp(value, -MATE_BASE, MATE_BASE) : NaN;
    if (value && typeof value === "object") return encodeScore(value);
    return NaN;
  }

  // Accepts Engine lines ({multipv, depth, score: {type, value}, pv}) and the
  // compact form stored in Position.reference ({uci, score: number, pv}).
  // Invalid entries and repeated moves are dropped; the order is kept, so
  // lines[0] stays the reference best.
  function normalizeLines(lines) {
    const out = [];
    if (!Array.isArray(lines)) return out;
    const seen = new Set();
    for (let i = 0; i < lines.length && out.length < MAX_LINES; i += 1) {
      const line = lines[i];
      if (!line || typeof line !== "object") continue;
      const pv = Array.isArray(line.pv) ? line.pv.filter((move) => typeof move === "string") : [];
      const uci = normalizeUci(typeof line.uci === "string" ? line.uci : pv[0]);
      if (!uci || seen.has(uci)) continue;
      const score = toEncodedScore(line.score);
      if (!Number.isFinite(score)) continue;
      seen.add(uci);
      out.push({ uci, score });
    }
    return out;
  }

  function blankAssessment() {
    return {
      points: 0,
      rawPoints: 0,
      maxPoints: MAX_POINTS,
      accuracy: 0,
      qualityCode: "no_move",
      winLossPct: 0,
      cpLoss: 0,
      isBest: false,
      rank: null,
      bestUci: null,
      bestScore: null,
      userScore: null,
      onlyMove: false,
      gapToSecondPct: null,
      reason: "ok",
      hintPenalty: 0,
      // Extras beyond the contract:
      needsEvaluation: false,
      isMasterMove: false,
      mateExtraMoves: 0,
      hintCost: 0,
    };
  }

  function applyHints(assessment, rawPoints, cost) {
    assessment.rawPoints = round1(rawPoints);
    assessment.hintCost = cost;
    assessment.points = round1(assessment.rawPoints * (1 - cost));
    assessment.hintPenalty = round1(assessment.rawPoints - assessment.points);
    return assessment;
  }

  // Scores one chosen move against the engine's lines. See the file header and
  // docs/SCORING.md. `options.isSacrifice` (set by the caller) allows "brilliant".
  //
  // A move that is not in `lines` and has no `userScore` cannot be measured:
  // the result is a PROVISIONAL estimate (the worst listed line minus a margin),
  // flagged needsEvaluation: true, userScore: null, reason "ok". The caller
  // should search that move (Engine searchMoves) and call assess again.
  function assess(input, options) {
    const inp = input && typeof input === "object" ? input : {};
    const opts = options && typeof options === "object" ? options : {};
    const settings = normalizeSettings(inp.settings);
    const k = STRICTNESS_K[settings.strictness];
    const lines = normalizeLines(inp.lines);
    const hintsUsed = normalizeHints(inp.hintsUsed);
    const cost = hintCostFor(settings, hintsUsed);
    const userUci = normalizeUci(inp.userUci);
    const masterUci = normalizeUci(inp.masterUci);
    const isSacrifice = opts.isSacrifice === true || inp.isSacrifice === true;

    const result = blankAssessment();
    const bestLine = lines.length ? lines[0] : null;
    if (bestLine) {
      result.bestUci = bestLine.uci;
      result.bestScore = bestLine.score;
    }

    // Second best, for "only move": the best of the OTHER lines.
    let second = null;
    for (let i = 1; i < lines.length; i += 1) {
      if (!second || lines[i].score > second.score) second = lines[i];
    }
    const bestWin = bestLine ? winPercent(bestLine.score) : 0;
    const bestDecoded = bestLine ? decodeScore(bestLine.score) : null;
    const bestMateWin = Boolean(bestDecoded && bestDecoded.kind === "mate" && bestDecoded.mateMoves > 0);
    if (bestLine && second) {
      const secondDecoded = decodeScore(second.score);
      const secondMateWin = Boolean(secondDecoded && secondDecoded.kind === "mate" && secondDecoded.mateMoves > 0);
      result.gapToSecondPct = round2(bestWin - winPercent(second.score));
      // Finding the only mating move is an only move even when the runner-up
      // is also "winning" on paper.
      result.onlyMove = result.gapToSecondPct >= ONLY_MOVE_GAP_PCT || (bestMateWin && !secondMateWin);
    }

    // No move, timeout, skip: nothing to measure.
    const skipReason = inp.reason === "timeout" || inp.reason === "skip" ? inp.reason : "";
    if (skipReason || !userUci) {
      result.reason = skipReason || "no_move";
      return applyHints(result, 0, 0);
    }
    if (!bestLine) {
      // Nothing to compare with (the engine gave no lines): unrated, not a no-move.
      result.needsEvaluation = true;
      result.error = "no_lines";
      return applyHints(result, 0, cost);
    }

    // Find the user's move.
    const index = lines.findIndex((line) => line.uci === userUci);
    let userScore = null;
    if (index >= 0) {
      userScore = lines[index].score;
      result.rank = index + 1;
    } else {
      const supplied = toEncodedScore(inp.userScore);
      if (Number.isFinite(supplied)) userScore = supplied;
    }
    const provisional = userScore === null;
    result.userScore = userScore;
    result.needsEvaluation = provisional;
    result.isMasterMove = Boolean(masterUci && masterUci === userUci);

    // Loss in win%.
    let userWin;
    if (provisional) {
      let worst = lines[0].score;
      lines.forEach((line) => {
        if (line.score < worst) worst = line.score;
      });
      userWin = Math.max(0, winPercent(worst) - UNKNOWN_MOVE_MARGIN_PCT);
      result.cpLoss = clamp(Math.round(bestLine.score - worst) + UNKNOWN_MOVE_MARGIN_CP, 0, MAX_CP_LOSS);
    } else {
      userWin = winPercent(userScore);
    }
    const loss = Math.max(0, bestWin - userWin);
    result.winLossPct = round2(loss);

    // Mate rules (only for a measured move).
    let reason = "ok";
    let mateExtra = 0;
    let userDecoded = null;
    if (!provisional) {
      userDecoded = decodeScore(userScore);
      const bestMated = Boolean(bestDecoded && bestDecoded.kind === "mate" && bestDecoded.mateMoves <= 0);
      const userMateWin = Boolean(userDecoded && userDecoded.kind === "mate" && userDecoded.mateMoves > 0);
      const userMated = Boolean(userDecoded && userDecoded.kind === "mate" && userDecoded.mateMoves <= 0);
      if (userMated && !bestMated) {
        reason = "allows_mate";
      } else if (bestMateWin && !userMateWin) {
        reason = "missed_mate";
      } else if (bestMateWin && userMateWin && userDecoded.mateMoves > bestDecoded.mateMoves) {
        mateExtra = userDecoded.mateMoves - bestDecoded.mateMoves; // a slower mate: small deduction
      } else if (bestMated && userMated && Math.abs(userDecoded.mateMoves) < Math.abs(bestDecoded.mateMoves)) {
        mateExtra = Math.abs(bestDecoded.mateMoves) - Math.abs(userDecoded.mateMoves); // mated sooner than necessary
      }
      result.cpLoss = clamp(Math.round(bestLine.score - userScore), 0, MAX_CP_LOSS);
      if (reason === "allows_mate") result.cpLoss = MAX_CP_LOSS;
      else if (reason === "missed_mate") result.cpLoss = Math.min(MAX_CP_LOSS, 1200 + 40 * Math.min(bestDecoded.mateMoves, 20));
      else if (mateExtra > 0) result.cpLoss = Math.min(MAX_CP_LOSS, 40 * mateExtra);
    }
    result.reason = reason;
    result.mateExtraMoves = mateExtra;
    const mateBlunder = reason === "allows_mate" || reason === "missed_mate";

    // Best or equivalent?
    const band = bandFor(settings, result.isMasterMove);
    const inBand = loss <= band + EPS;
    result.isBest = !provisional && !mateBlunder && mateExtra === 0 && inBand;

    // Effective loss and accuracy.
    const excess = Math.max(0, loss - band);
    let effective = excess * k;
    if (mateExtra > 0) effective += k * Math.min(MATE_SLOWER_CAP_E, MATE_SLOWER_STEP_E * mateExtra);
    let accuracy = curve(effective);
    if (mateBlunder) accuracy = Math.min(accuracy, MATE_BLUNDER_MAX_ACCURACY);
    result.accuracy = round1(accuracy);

    // Label.
    let quality = mateBlunder ? "blunder" : labelForEffectiveLoss(effective);
    if (result.isBest && effective <= EPS && hintsUsed === 0) {
      if (isSacrifice) quality = "brilliant";
      else if (result.onlyMove) quality = "great";
    }
    result.qualityCode = quality;

    const rawPoints = settings.model === "tiers" ? TIER_POINTS[quality] : accuracy / 10;
    return applyHints(result, clamp(rawPoints, 0, MAX_POINTS), cost);
  }

  // ---------- labels, meta, summary ----------

  function qualityMeta(code) {
    const known = Object.prototype.hasOwnProperty.call(QUALITY_META, code) ? code : "no_move";
    const meta = QUALITY_META[known];
    return { order: meta.order, colorToken: meta.colorToken, glyph: meta.glyph, labelKey: `quality.${known}` };
  }

  // The new 10 codes -> the 8 the legacy CSS classes and app.js understand.
  function compatQuality(code) {
    return Object.prototype.hasOwnProperty.call(LEGACY_QUALITY, code) ? LEGACY_QUALITY[code] : "no_move";
  }

  function summarize(assessments) {
    const byQuality = {};
    QUALITY_CODES.forEach((code) => {
      byQuality[code] = 0;
    });
    let count = 0;
    let points = 0;
    let maxPoints = 0;
    let accuracySum = 0;
    let bestCount = 0;
    (Array.isArray(assessments) ? assessments : []).forEach((item) => {
      if (!item || typeof item !== "object" || !Number.isFinite(item.points)) return;
      count += 1;
      points += item.points;
      maxPoints += Number.isFinite(item.maxPoints) ? item.maxPoints : MAX_POINTS;
      accuracySum += Number.isFinite(item.accuracy) ? item.accuracy : 0;
      if (item.isBest) bestCount += 1;
      const code = Object.prototype.hasOwnProperty.call(byQuality, item.qualityCode) ? item.qualityCode : "no_move";
      byQuality[code] += 1;
    });
    return {
      count,
      points: round1(points),
      maxPoints,
      avgAccuracy: count ? round1(accuracySum / count) : 0,
      byQuality,
      bestCount,
    };
  }

  // ---------- UI text ----------

  const STRINGS = {
    es: {
      "quality.brilliant": "Brillante",
      "quality.great": "Gran jugada",
      "quality.perfect": "Perfecta",
      "quality.very_good": "Muy buena",
      "quality.good": "Buena",
      "quality.interesting": "Interesante",
      "quality.dubious": "Dudosa",
      "quality.bad": "Mala",
      "quality.blunder": "Error grave",
      "quality.no_move": "Sin jugada",
      "scoring.reason.allows_mate": "Esta jugada permite un mate.",
      "scoring.reason.missed_mate": "Había un mate forzado y no lo jugaste.",
      "scoring.reason.timeout": "Se acabó el tiempo.",
      "scoring.reason.skip": "Salteaste esta posición.",
      "scoring.reason.no_move": "No elegiste ninguna jugada.",
      "scoring.note.slower_mate": "Das mate, pero había un mate más rápido.",
      "scoring.note.provisional": "Estimación provisional: todavía hay que evaluar esta jugada.",
      "scoring.note.hint_penalty": "Usaste una pista: se descuenta el {percent}% de los puntos.",
    },
    en: {
      "quality.brilliant": "Brilliant",
      "quality.great": "Great move",
      "quality.perfect": "Perfect",
      "quality.very_good": "Very good",
      "quality.good": "Good",
      "quality.interesting": "Interesting",
      "quality.dubious": "Dubious",
      "quality.bad": "Bad",
      "quality.blunder": "Serious mistake",
      "quality.no_move": "No move",
      "scoring.reason.allows_mate": "This move allows a checkmate.",
      "scoring.reason.missed_mate": "There was a forced mate and you missed it.",
      "scoring.reason.timeout": "Time ran out.",
      "scoring.reason.skip": "You skipped this position.",
      "scoring.reason.no_move": "No move was chosen.",
      "scoring.note.slower_mate": "You mate, but a faster mate existed.",
      "scoring.note.provisional": "Provisional estimate: this move still has to be evaluated.",
      "scoring.note.hint_penalty": "You used a hint: {percent}% of the points are deducted.",
    },
  };

  function registerStrings() {
    const i18n = root.Ludus && root.Ludus.i18n;
    try {
      if (i18n && typeof i18n.register === "function") i18n.register(STRINGS);
    } catch (error) {
      // UI text is optional for the maths; never let it break loading.
    }
  }
  registerStrings();

  // Text through Ludus.i18n when it is loaded, straight from the table otherwise
  // (Node tests, or a page that loads scoring.js on its own).
  function text(key, params, lang) {
    const i18n = root.Ludus && root.Ludus.i18n;
    if (i18n && typeof i18n.t === "function") return i18n.t(key, params, lang);
    const language = lang === "en" ? "en" : "es";
    const template = STRINGS[language][key] || STRINGS.es[key] || key;
    return template.replace(/\{(\w+)\}/g, (_, name) => (params && params[name] !== undefined && params[name] !== null ? String(params[name]) : ""));
  }

  function qualityLabel(code, lang) {
    return text(qualityMeta(code).labelKey, {}, lang);
  }

  // A one-sentence explanation for the assessment's reason, "" when there is
  // nothing special to say.
  function reasonLabel(reason, lang) {
    const known = ["allows_mate", "missed_mate", "timeout", "skip", "no_move"];
    return known.includes(reason) ? text(`scoring.reason.${reason}`, {}, lang) : "";
  }

  const CONSTANTS = Object.freeze({
    MATE_BASE,
    MATE_STEP,
    MATE_MAX_DISTANCE,
    MATE_THRESHOLD,
    WIN_CP_CLAMP,
    STRICTNESS_K,
    CURVE_SCALE,
    LABEL_LIMITS,
    TIER_POINTS,
    ONLY_MOVE_GAP_PCT,
    MASTER_TOLERANCE_PCT,
    UNKNOWN_MOVE_MARGIN_PCT,
    UNKNOWN_MOVE_MARGIN_CP,
    MATE_BLUNDER_MAX_ACCURACY,
    MATE_SLOWER_STEP_E,
    MATE_SLOWER_CAP_E,
    MAX_CP_LOSS,
    QUALITY_CODES,
  });

  return {
    encodeScore,
    decodeScore,
    flipAfterMove,
    winPercent,
    formatEval,
    DEFAULTS,
    normalizeSettings,
    assess,
    accuracyFromLoss,
    qualityMeta,
    qualityLabel,
    reasonLabel,
    compatQuality,
    summarize,
    CONSTANTS,
  };
});
