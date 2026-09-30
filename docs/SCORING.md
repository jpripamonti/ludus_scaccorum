# Scoring: how a move becomes points

Owner: `js/scoring.js` (`Ludus.Scoring`). Contract: `docs/ARCHITECTURE.md`
section 7. Tests: `scripts/tests/scoring.test.js`. The tables in this file are
**generated from the code** (see "Regenerating the tables" at the end), so what
you read here is what the app does.

The product rule is simple: **the closer the learner's move is to the engine's
best move, the more points; the further, the fewer.** Everything below exists to
make that rule smooth (no cliffs, no plateaus except one deliberate one),
bounded (0 to 10 points, one decimal) and explainable.

## 1. Inputs and output

```js
Scoring.assess({ lines, userUci, userScore, masterUci, settings, reason, hintsUsed },
               { isSacrifice })  // -> Assessment
```

* `lines`: the engine's MultiPV lines from the mover's point of view.
  `lines[0]` is the reference best. Both shapes are accepted: engine lines
  (`{ multipv, depth, score: {type, value}, pv }`) and the compact reference
  lines stored on a `Position` (`{ uci, san, score: number, pv }`). Invalid
  entries and repeated moves are dropped, the order is kept.
* `userUci`: the move played, or `null` (no move).
* `userScore`: score of the user's move **when it is not in `lines`**.
  Normally obtained by searching only that move (`Engine.analyze({ searchMoves:
  [userUci] })`, which gives the score from the same point of view and depth
  family as the best line). See section 9.
* `masterUci`: the historical move; only used by `bestMode: "masters"`.
* `reason`: `"" | "timeout" | "skip"`. `hintsUsed`: `0 | 1 | 2 | 3`.
* `options.isSacrifice`: set by the caller when the move gives up material;
  the only way to earn `"brilliant"`.

Output fields are the contract's (`points`, `rawPoints`, `maxPoints`,
`accuracy`, `qualityCode`, `winLossPct`, `cpLoss`, `isBest`, `rank`, `bestUci`,
`bestScore`, `userScore`, `onlyMove`, `gapToSecondPct`, `reason`,
`hintPenalty`) plus a few extras: `needsEvaluation` (bool), `isMasterMove`
(bool), `mateExtraMoves` (number), `hintCost` (the fraction that was applied)
and, only when there were no usable lines at all, `error: "no_lines"`.

## 2. Score encoding

A score is one number: **centipawns from the point of view of the side to
move**, mate encoded as `+-(100000 - 1000 * min(50, n))` where `n` is the UCI
`score mate` value. That is exactly what `app.js` already did.

| UCI | number | note |
| --- | ---: | --- |
| `cp 35` | 35 | centipawns are clamped to +-49999 so they can never look like a mate |
| `mate 1` | 99000 | the mover mates next move |
| `mate 3` | 97000 | |
| `mate -2` | -98000 | the mover is mated |
| `mate 0` | -100000 | the mover is already mated |
| `mate 60` | 50000 | distances beyond 50 saturate |

`decodeScore` returns `{ kind: "mate", matePly, mateMoves }`. **`matePly` is a
misnomer inherited from `app.js`**: like the UCI value it counts *full moves*
of the mating side, not plies. `mateMoves` is the same number under an honest
name; prefer it in new code.

Scores measured **after** a move (opponent to move) can be brought back to the
mover's point of view with `Scoring.flipAfterMove(score)`: centipawns flip
sign; "the opponent mates in n" becomes "I am mated in n"; "the opponent is
mated (0, -1, -2, ...)" becomes "I mate in 1, 2, 3, ...". Prefer `searchMoves`
over this whenever you can, it costs nothing extra and needs no conversion.

## 3. Win%

`winPercent(score)` is the Lichess logistic: `50 + 50 * (2 / (1 + e^(-0.00368208
* cp)) - 1)` with `cp` clamped to +-1000 (so anything better than +10.00 is
"already 97.5 %"). A mate is worth the win% of a large centipawn equivalent that
still orders by distance: mate in 1 is 2000 cp, mate in 10 or more is 1100 cp
(negative for the side that gets mated). Consequences, all covered by tests:
any mate for the mover beats every centipawn score, a closer mate beats a
farther one, and `winPercent(-x) = 100 - winPercent(x)`. A non-numeric input
is "unknown" and returns 50 (never `NaN`).

The logistic is what makes the same centipawn loss cost less when you are
already winning (or already losing) than in a balanced position: see Table 1.

## 4. From loss to points (precision model)

1. `loss = max(0, winPercent(best) - winPercent(user))` (in win% points).
2. **Equivalent-move band.** `excess = max(0, loss - band)`. In `bestMode:
   "band"` the band is `tolerancePct` (default 1 %, 0 to 5 %), in `"engine"` it
   is 0, in `"masters"` it is `tolerancePct` except for the master's own move,
   where it is `max(tolerancePct, 3 %)`. Measuring the excess *beyond* the band
   (instead of switching the score off at the edge) is what makes the curve
   continuous: at the edge of the band the score is still 10.0 and it starts to
   fall from there. **The band is the only plateau in the model.**
3. **Strictness.** `E = excess * k`, with `k` = 0.6 (relaxed), 1 (standard) or
   1.6 (strict). `E` is "effective loss"; every label threshold is expressed in
   `E`, so stricter play changes labels as well as points.
4. **Curve.** `accuracy = clamp(103.1668 * e^(-0.04354 * 1.8 * E) - 3.1669, 0,
   100)`, and `points = round(accuracy / 10, 1 decimal)`. `E <= 0` gives exactly
   100. The curve is strictly decreasing until it reaches 0 (at `E` of about
   44, a loss of about 45 win%), after which it stays at 0. Property tests walk
   a grid of evaluations and losses to check that more loss never gives more
   points and that accuracy is strictly decreasing.
5. **Hints.** `points = round(rawPoints * (1 - cost), 1 decimal)`, section 8.

### Calibration (why the 1.8)

The contract specified the plain Lichess curve (`103.1668 e^(-0.04354 loss k) -
3.1669`) with `k` = 0.6 / 1 / 1.6. Run as is, a balanced-position 150 cp mistake
scored 5.5 and a 300 cp blunder 3.2, which the product owner's targets rule out
(inaccuracy of ~50 cp: 6.5 to 8; mistake of ~150 cp: 3 to 5; blunder: 0 to 1).
Instead of changing the strictness multipliers (other modules and the settings
UI describe them as 0.6 / 1 / 1.6) the whole curve is stretched by one global
constant, `CURVE_SCALE = 1.8`, which is equivalent to multiplying every `k` by
1.8 and is the only deviation from the contract's formula. With it:

* 50 cp at +0.30 / +1.50 / -1.00: **7.5 / 7.6 / 7.6** (target 6.5 to 8)
* 150 cp: **3.5 / 3.6 / 3.9** (target 3 to 5)
* 300 cp: 1.2 / 1.0 / 1.6 and 500 cp: 0.3 / 0.1 / 0.7 (target 0 to 1 for a blunder)
* a loss inside the band: 10.0

Note that `accuracy` is therefore *not* Lichess's accuracy percentage: it has
the same shape but decays 1.8 times faster. `accuracy` is model-independent
(the tiers model reports the same accuracy) and is what the notebook uses (a
position enters the mistake notebook below 70, which with the defaults is a
loss of about 5.4 win%, roughly 60 cp in a balanced position).

To retune, change `CURVE_SCALE` (one number), run the tests (the calibration
targets are asserted), regenerate the tables below.

## 5. Quality labels

The label depends on `E` only (so on loss, band and strictness), never on the
model. Table 3 gives the boundaries.

| code | meaning | legacy code (`compatQuality`) |
| --- | --- | --- |
| `brilliant` | best (or equivalent) **and** the caller says it is a sacrifice | `perfect` |
| `great` | best (or equivalent) **and** the only move (section 7) | `perfect` |
| `perfect` | best or equivalent (inside the band) | `perfect` |
| `very_good` | `E` up to 2 | `very_good` |
| `good` | `E` up to 4.5 | `good` |
| `interesting` | `E` up to 8 | `interesting` |
| `dubious` | `E` up to 12 | `dubious` |
| `bad` | `E` up to 19 | `bad` |
| `blunder` | above 19, or a mate blunder (section 6) | `blunder` |
| `no_move` | no move, timeout or skip | `no_move` |

`brilliant` and `great` are only awarded when **no hint was used**: a move you
were pointed to is not brilliant. `qualityMeta(code)` gives `{ order, colorToken,
glyph, labelKey }`: the colour token is an existing `styles.css` token, and every
label has its own glyph (`!!`, `!`, star, check, circle, `!?`, `?!`, `?`, `??`,
dash) so colour is never the only cue. `Scoring.qualityLabel(code, lang)` and
`Scoring.reasonLabel(reason, lang)` return the localized text (Spanish and
English are registered through `Ludus.i18n`).

## 6. Mates

Mates are compared by rule, before the usual loss logic, because "how many
centipawns is a mate worth" has no good answer.

* **Allowing a mate** (your move leads to `mate <= 0` for you while the best
  line is not itself mated): `qualityCode: "blunder"`, `reason: "allows_mate"`,
  `cpLoss: 2500`.
* **Missing a forced mate** (the best line mates for you and your move does not
  mate): `"blunder"`, `reason: "missed_mate"`, `cpLoss: 1200 + 40 *
  min(mateIn, 20)` (the legacy convention).
* In both cases accuracy is capped at 10, so points never exceed **1.0**,
  whatever the strictness. This is a deliberate second plateau: if you missed a
  mate but stayed at +9.5, the win% loss is small, and the cap is what keeps the
  verdict aligned with the product rule "a missed mate is a blunder". Below the
  cap the usual curve still orders results (leaving the mate for a lost position
  scores less than leaving it for a winning one). In the tiers model they score 0.
* **A slower mate that still mates** is a small deduction, not a blunder:
  `E = k * min(6, 0.75 * extraMoves)` on top of any centipawn excess, `reason:
  "ok"`, `isBest: false`, `mateExtraMoves` set. With the defaults one move
  slower costs about 0.6 points and the deduction never goes below "interesting"
  (about 5.8 points, Table 4). The same rule applies to a defender who gets mated sooner
  than necessary when every move loses to mate.
* A mate that is faster than the reference, or a mate when the reference is not
  one, is simply better than the best: loss 0, full marks.

See Table 4 for concrete numbers.

## 7. Best move, "only move", brilliant and great

* `isBest`: `loss <= band`, no mate blunder, no slower mate. In `"engine"` mode
  the band is 0, so only the engine's move or one with an identical score is
  best (two different mates in 1 are equally best). In `"masters"` mode the
  master's move counts within 3 %.
* `rank`: 1-based index of the move in `lines`, or `null`.
* `onlyMove`: the best line beats the best *other* line by at least **12 win%**
  (needs 2 or more lines; `gapToSecondPct` is `null` with one line). Extension
  over the contract: finding the only mating move counts as an only move even if
  the runner-up is also "winning" on paper (best is a mate for the mover, the
  runner-up is not).
* `great` = best and `onlyMove`; `brilliant` = best and
  `options.isSacrifice === true` (the caller decides what a sacrifice is; the
  scorer does not look at the board). Neither is granted after using a hint.

## 8. Hints

`hintsUsed` 0, 1, 2, 3 multiplies the raw points by `(1 - cost)` with
`DEFAULTS.hintCost`: level 1 (piece highlight) 15 %, level 2 (destination) 35 %,
reveal 100 % (0 points). Costs are not cumulative: the level reached is the cost.
Values above 3 count as a reveal, negative or non-numeric as 0. `hintPenalty` is
the number of points deducted (`rawPoints - points`), `hintCost` the fraction.
Hints never change `accuracy` or `qualityCode`: they describe the move, not the
help. (Consequence for the notebook: revealing the answer and playing it gives
accuracy 100, so the caller should also look at `hintsUsed` when deciding
whether a position was really solved.)

## 9. A move that is not in the lines (`needsEvaluation`)

MultiPV shows only the top N moves. If the user plays something else and the
caller supplies no `userScore`, the assessment cannot be exact. Instead of
guessing silently, `assess` returns a **provisional** result and says so:

* `needsEvaluation: true`, `userScore: null`, `reason: "ok"`, `rank: null`;
* the estimate assumes the move is worse than the worst listed line by a margin
  (`winPercent(worstLine) - 8`), so it is never better than what the worst
  listed move would have got;
* mate rules are not applied (unknown), `isBest` is `false`;
* `cpLoss` is the gap to the worst line plus 80.

The caller should then search that one move (`Engine.analyze({ fen, searchMoves:
[userUci], movetimeMs })`, take `lines[0]`), call `assess` again with
`userScore = Engine.moverScore(line)` and use that result. Showing the
provisional numbers in the meantime is fine as long as they are visibly marked.

## 10. No move

`userUci` missing or not a UCI move, or `reason` `"timeout"` / `"skip"`:
`points: 0`, `accuracy: 0`, `qualityCode: "no_move"`, `reason` set,
`winLossPct` / `cpLoss` 0 (consumers averaging cp loss should filter on
`qualityCode`). The best move and its score are still reported so the UI can show
what was best. If there are no usable lines at all the result is unrated:
`points: 0`, `qualityCode: "no_move"`, `needsEvaluation: true`, `error: "no_lines"`.

## 11. Tiers model

`model: "tiers"` replaces the smooth curve by fixed points per label:
perfect / great / brilliant 10, very_good 7.5, good 5, interesting 2.5, dubious 0,
bad 0, blunder 0. Labels, band, strictness, mates and hints work exactly as in
the precision model; `accuracy` is still the precision accuracy.

## 12. Generated tables

The block between the markers is rewritten by
`node scripts/tests/scoring.test.js --write-docs` and verified (byte for byte) by
the same test file, so a change to the maths that is not reflected here fails
`npm test`.

<!-- BEGIN GENERATED TABLES (node scripts/tests/scoring.test.js --write-docs) -->

### Table 1 - what a loss costs (standard strictness, band 1 %, precision model)

Each cell: `win% loss -> points (label)`. Best move worth the evaluation in the header column, the user's move `cp loss` centipawns worse.

| cp loss | at +0.30 | at +1.50 | at -1.00 |
| ---: | --- | --- | --- |
| 10 | 0.9 % -> **10.0** (perfect) | 0.9 % -> **10.0** (perfect) | 0.9 % -> **10.0** (perfect) |
| 25 | 2.3 % -> **9.0** (very_good) | 2.2 % -> **9.1** (very_good) | 2.2 % -> **9.1** (very_good) |
| 50 | 4.6 % -> **7.5** (good) | 4.4 % -> **7.6** (good) | 4.4 % -> **7.6** (good) |
| 75 | 6.9 % -> **6.2** (interesting) | 6.6 % -> **6.3** (interesting) | 6.5 % -> **6.4** (interesting) |
| 100 | 9.2 % -> **5.1** (dubious) | 8.9 % -> **5.2** (interesting) | 8.5 % -> **5.4** (interesting) |
| 150 | 13.6 % -> **3.5** (bad) | 13.5 % -> **3.6** (bad) | 12.4 % -> **3.9** (dubious) |
| 200 | 17.9 % -> **2.4** (bad) | 18.1 % -> **2.4** (bad) | 16.0 % -> **2.9** (bad) |
| 300 | 25.8 % -> **1.2** (blunder) | 26.9 % -> **1.0** (blunder) | 22.3 % -> **1.6** (blunder) |
| 500 | 37.7 % -> **0.3** (blunder) | 41.9 % -> **0.1** (blunder) | 31.0 % -> **0.7** (blunder) |
| 800 | 47.2 % -> **0.0** (blunder) | 55.1 % -> **0.0** (blunder) | 37.4 % -> **0.3** (blunder) |

### Table 2 - the three strictness levels (best move at +0.30)

| cp loss | relaxed (k 0.6) | standard (k 1) | strict (k 1.6) |
| ---: | ---: | ---: | ---: |
| 25 | 9.4 (very_good) | 9.0 (very_good) | 8.4 (good) |
| 50 | 8.4 (good) | 7.5 (good) | 6.3 (interesting) |
| 100 | 6.7 (interesting) | 5.1 (dubious) | 3.4 (bad) |
| 150 | 5.4 (interesting) | 3.5 (bad) | 1.8 (blunder) |
| 300 | 2.9 (bad) | 1.2 (blunder) | 0.1 (blunder) |
| 500 | 1.5 (blunder) | 0.3 (blunder) | 0.0 (blunder) |

### Table 3 - label boundaries (standard strictness, band 1 %)

`E` is the effective loss (`(win% loss - band) * k`). Points are the precision-model points exactly at the boundary; the cp column is the loss that reaches it from an equal position (0.00).

| label | E up to | win% loss up to | about cp loss (from 0.00) | points at the boundary | tiers-model points |
| --- | ---: | ---: | ---: | ---: | ---: |
| perfect | 0 | 1.0 | 10 | 10.0 | 10 |
| very_good | 2 | 3.0 | 35 | 8.5 | 7.5 |
| good | 4.5 | 5.5 | 60 | 6.9 | 5 |
| interesting | 8 | 9.0 | 100 | 5.2 | 2.5 |
| dubious | 12 | 13.0 | 145 | 3.7 | 0 |
| bad | 19 | 20.0 | 230 | 2.0 | 0 |
| blunder | above 19 | above 20.0 | above 230 | under 2.0 | 0 |

### Table 4 - mates (standard strictness)

| situation | points | label | reason |
| --- | ---: | --- | --- |
| best is mate in 2, you play it | 10.0 | perfect | ok |
| best is mate in 2, you play another mate in 2 | 10.0 | perfect | ok |
| best is mate in 2, you mate in 3 | 9.4 | very_good | ok |
| best is mate in 2, you mate in 4 | 8.9 | very_good | ok |
| best is mate in 2, you mate in 6 | 7.8 | good | ok |
| best is mate in 2, you mate in 10 | 5.8 | interesting | ok |
| best is mate in 2, you mate in 30 | 5.8 | interesting | ok |
| best is mate in 2, you play +3.00 (missed mate) | 1.0 | blunder | missed_mate |
| best is mate in 2, you play +9.50 (missed mate) | 1.0 | blunder | missed_mate |
| best is +0.50, you play a move that gets mated in 2 | 0.0 | blunder | allows_mate |
| every move is mated: best is -M5, you allow -M2 | 8.3 | good | ok |

### Table 5 - hints (a perfect move, raw 10.0, and a 50 cp inaccuracy, raw 7.5)

| hints used | cost | perfect move | 50 cp inaccuracy |
| --- | ---: | ---: | ---: |
| 0 - none | 0 % | 10.0 | 7.5 |
| 1 - level 1 (piece highlight) | 15 % | 8.5 | 6.4 |
| 2 - level 2 (destination) | 35 % | 6.5 | 4.9 |
| 3 - reveal | 100 % | 0.0 | 0.0 |

### Table 6 - win% of common evaluations

| evaluation | win% | | evaluation | win% |
| ---: | ---: | --- | ---: | ---: |
| 0.00 | 50.0 | | +3.00 | 75.1 |
| +0.50 | 54.6 | | +5.00 | 86.3 |
| +1.00 | 59.1 | | +8.00 | 95.0 |
| +1.50 | 63.5 | | +10.00 | 97.5 |
| +2.00 | 67.6 | | M10 | 98.3 |

<!-- END GENERATED TABLES -->

## 13. Engine to scoring, end to end

```js
const engine = Ludus.Engine.create({ createTransport: () => new Worker("vendor/stockfish-18-lite-single.js") });
if (await engine.ready()) {
  // 1. Reference: the best lines, once per position (or precomputed).
  const ref = await engine.analyze({ fen, movetimeMs: 1500, multiPv: 3 });
  // 2. The user's move, scored against them.
  let a = Ludus.Scoring.assess({ lines: ref.lines, userUci, settings, hintsUsed }, { isSacrifice });
  // 3. Not among the top lines? Search just that move (right after step 1, so
  //    the hash table is warm) and score again with the exact number.
  if (a.needsEvaluation) {
    const one = await engine.analyze({ fen, movetimeMs: 1500, searchMoves: [userUci] });
    a = Ludus.Scoring.assess({ lines: ref.lines, userUci, userScore: Ludus.Engine.moverScore(one.lines[0]), settings, hintsUsed }, { isSacrifice });
  }
}
```

* `Engine.moverScore(line)` is `Scoring.encodeScore(line.score)`: the one number
  encoding used everywhere. `line.score` is already from the side to move's
  point of view (that is what UCI reports), so no sign flipping is needed.
* Use the same `movetimeMs` for the reference and the restricted search so both
  scores have comparable reliability.
* `res.lines` from the engine is the deepest *complete* MultiPV set (see the
  header of `js/engine.js`), so `lines[0]` is a consistent reference even when a
  search was aborted.
* If you only have an evaluation of the position after the move (opponent to
  move), convert it with `Scoring.flipAfterMove`.
* `Position.reference.lines` (`{ uci, san, score, pv }`) can be passed to
  `assess` as they are.

## 14. Regenerating the tables

After changing any constant in `js/scoring.js`:

```
node scripts/tests/scoring.test.js            # fails if the tables are stale
node scripts/tests/scoring.test.js --write-docs
node scripts/tests/scoring.test.js            # passes again; review the diff
```

Then re-read the calibration paragraph in section 4: its numbers are quoted
from Table 1 (the tests assert the target ranges, not the exact quoted digits).

## 15. Known limitations

* The score model knows nothing about the board: `brilliant` depends entirely on
  the caller's `isSacrifice`, and "only move" is measured on the MultiPV lines it
  is given (with `multiPv: 1` there is no only move).
* Lines of different depths are compared as if equally reliable (for example a
  fresh `searchMoves` line against the MultiPV lines). At the movetimes the app
  uses the difference is a few centipawns, well inside the 1 % band.
* Mate distances beyond 50 moves are indistinguishable (`mate 60` = `mate 50`).
* With a win% clamp at +-10.00 pawns, moves that are all "completely winning"
  are equal to the scorer even if their centipawn values differ.
