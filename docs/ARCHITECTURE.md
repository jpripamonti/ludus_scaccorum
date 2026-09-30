# Ludus Scaccorum — architecture and module contract

This document is the contract between the modules of the app. It exists so
that several people (or agents) can build modules in parallel and have them
fit together. If code and this document disagree, fix one of them in the same
change.

## 1. Product in one paragraph

Ludus Scaccorum is a chess **trainer**. The learner is shown a position, plays
the move they think is best, and is scored by how close that move is to the
engine's best move: the closer, the more points; the further, the fewer. The
positions come from (a) the learner's own Lichess / Chess.com games (where they
actually erred), (b) a library of **classic games**, (c) their **mistake
notebook** (spaced repetition of positions they got wrong), (d) a **daily
challenge**. One person can train alone, or two people can play a **duel** on
one device. Progress, streaks, levels and insights are stored locally; an
optional Google sign-in syncs progress across devices through the user's own
Google Drive (no server of ours).

There is **no backend**. Everything is static files on GitHub Pages. Stockfish
runs in the browser (WASM in a Worker).

## 2. Ground rules

* Vanilla JS, no bundler, no framework, no runtime dependencies. Classic
  `<script>` tags, `'self'` scripts only (see the CSP in `index.html`).
* Every module is a **UMD-lite IIFE** that attaches to the single global
  namespace `Ludus` and also works with `require()` in Node (for tests):

  ```js
  (function (root, factory) {
    const api = factory(root);
    root.Ludus = root.Ludus || {};
    root.Ludus.Scoring = api;                       // (name per module)
    if (typeof module !== "undefined" && module.exports) module.exports = api;
  })(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
    "use strict";
    /* ... */
    return { /* public API */ };
  });
  ```

  Inside a module, get another module with `root.Ludus.X` **at call time**
  (never at load time, so load order between modules does not matter, except
  that `js/ludus.js` loads first). In Node tests, `require("../js/foo.js")`
  after `require("../js/ludus.js")` (the tests helper `scripts/tests/_load.js`
  loads the whole set into one context).
* Pure logic modules have **no DOM access at load time** and take their
  environment (storage, clock, transport, random) by injection with sane
  defaults, so they run under Node.
* Every user-visible string goes through `Ludus.i18n` (Spanish **and**
  English, rioplatense Spanish "vos" register for `es`). No string is ever
  concatenated into HTML without `Ludus.util.escapeHtml`.
* Persisted data is versioned (`v` field), validated on load, size-capped, and
  every storage access is wrapped in try/catch (private mode, quota).
* Nothing leaves the device except: downloads from Lichess / Chess.com (only
  after the existing consent step), and — only if the user opts in — Google
  Identity / Drive calls from `js/auth.js`.
* Accessibility is part of "done": keyboard operable, visible focus,
  `prefers-reduced-motion`, contrast ≥ 4.5:1 for text, touch targets ≥ 44px,
  no information conveyed by colour alone.
* Files load from `index.html` in this order: `config.js`, `js/ludus.js`,
  `js/chess.js`, `js/pgn.js`, then the rest of `js/*.js` (see `index.html`
  for the authoritative list, the test harness derives its load order from
  it), and last `app.js`. UI screens `js/ui/*.js` load after the logic
  modules and before `app.js`.

## 3. File layout

```
index.html               shell + screen containers + script/link tags
js/boot.js               <head> guard, runs before the first paint: returning visitor / framed / old browser flags on <html>
config.js                window.LUDUS_CONFIG (googleClientId, feature flags)
styles.css               tokens (:root) + base + legacy game screen styles
css/*.css                one file per screen/module (prefix classes!)
app.js                   the game core (board, session flow, wizard, own-games pipeline)
js/ludus.js              namespace, bus, i18n, storage, router, util, loadScript
js/chess.js              Chess class + uci/san helpers      -> Ludus.chess
js/pgn.js                PGN parsing helpers                -> Ludus.pgn
js/engine.js             UCI driver (MultiPV, searchmoves)  -> Ludus.Engine
js/scoring.js            win%, accuracy, points, labels     -> Ludus.Scoring
js/insights.js           tactical/positional tags + text    -> Ludus.Insights
js/concepts.js           short lessons (fork, pin, ...)     -> Ludus.Concepts
js/settings.js           persisted settings                 -> Ludus.Settings
js/profile.js            profiles, records, notebook, SRS,
                         stats, XP/levels, achievements,
                         export/import                      -> Ludus.Profile
js/facts.js              history facts + timeline data      -> Ludus.Facts
js/reader.js             reading-time + fact carousel       -> Ludus.Reader
js/audio.js              synthesized sounds + haptics       -> Ludus.Audio
js/auth.js               optional Google sign-in + Drive sync -> Ludus.Auth
js/data/classics.data.js generated (lazy) classic games + reference analysis
js/classics.js           loader/selector over the data      -> Ludus.Classics
js/ui/*.js               screens: home, classics, notebook, progress,
                         museum, settings, account          -> Ludus.Screens.*
scripts/                 tooling (versioning, checks, data builders)
scripts/tests/*.test.js  node tests, run by `npm test`
docs/                    this file, GOOGLE_SIGNIN.md, data build notes
```

## 4. Core namespace (`js/ludus.js`)

```js
Ludus.version                   // from <meta name="ludus-version">, "dev" if absent
Ludus.config                    // frozen copy of window.LUDUS_CONFIG (defaults filled)

Ludus.bus.on(evt, fn) -> off()  // sync pub/sub; handler errors are caught + console.error
Ludus.bus.off(evt, fn)
Ludus.bus.emit(evt, payload)

Ludus.i18n.register({ es: {...}, en: {...} })   // merge; later registrations win
Ludus.i18n.t(key, params?, lang?)               // "{name}" interpolation; falls back es->key
Ludus.i18n.plural(lang, n, {one, other})        // tiny helper
Ludus.i18n.lang()                               // "es" | "en"
Ludus.i18n.setLanguage(lang)                    // emits "language:changed"
Ludus.i18n.onChange(fn) -> off()

Ludus.storage.get(key, fallback)   // JSON, never throws
Ludus.storage.set(key, value)      // -> boolean (false on quota/private mode)
Ludus.storage.remove(key)
Ludus.storage.keys(prefix)         // -> string[]
Ludus.storage.available            // boolean

Ludus.router.register(id, { el, title?, onShow?(params), onHide? })
Ludus.router.show(id, params?)     // hides every other registered screen; emits "screen:changed"
Ludus.router.current()             // -> id
Ludus.router.back()                // previous screen (stack of 10)
                                   // browser history, guards and sub-states: pushSub/popSub/canLeave/canEnter/transient, see section 19

Ludus.util.clamp, escapeHtml, uid(), hashString(str)->hex, now(), 
Ludus.util.h(tag, attrs, ...children)     // safe DOM builder (attrs: class, dataset, aria-*, on*)
Ludus.util.formatDate(ts, lang), formatRelativeDays(ts, lang), formatDuration(ms)
Ludus.util.loadScript(path, {timeoutMs?}) -> Promise   // appends ?v=<Ludus.version>, dedupes, rejects on error or after 20 s
```

`app.js` keeps its own `t()`; when a key is not in `TRANSLATIONS` it falls back
to `Ludus.i18n.t(key)`. `app.js`'s `setLanguage()` calls
`Ludus.i18n.setLanguage()` so every screen re-renders.

### Bus events (payload shapes in section 9)

`language:changed {lang}` · `screen:changed {id, prev}` · `settings:changed {path, value, settings}` ·
`profile:changed {profileId}` · `session:started {session}` ·
`round:completed {round}` · `session:completed {session}` ·
`notebook:changed {count, due}` · `achievement:unlocked {achievement}` ·
`auth:changed {status}` · `storage:failed {reason, key, at}` (once per page load, see section 11)

## 5. Chess primitives

`js/chess.js` → `Ludus.chess = { Chess, uciToMove, moveToUci, moveToSan, sanToMove }`
(moved verbatim out of `app.js`; `app.js` does `const { Chess, ... } = Ludus.chess`).

The `Chess` class API used across modules: `new Chess(fen?)`, `.fen()`,
`.turn` (`"w"|"b"`), `.board` (array of 64, index 0 = a8; uppercase = white),
`.generateMoves()` (legal), `.makeMove(move)`, `.clone()`, `.inCheck(color)`,
`.isSquareAttacked(index, byColor)`, `Chess.START_FEN`,
`Chess.squareToIndex(sq)`, `Chess.indexToSquare(i)`. A move object is
`{from, to, piece, capture?, enPassant?, castle?, promotion?}`.
Additions allowed in `js/chess.js`: `isCheckmate()`, `isStalemate()`,
`isInsufficientMaterial()`, `Chess.pieceValue(p)`.

**Notation (piece letters).** `moveToSan` always writes English letters (`Nf3`), and that
is what is stored and compared everywhere (records, notebook, `raw` message
params). Whatever is *shown* goes through `Ludus.chess.localizeSan(san, lang, opts?)`:
Spanish letters (R rey, D dama, T torre, A alfil, C caballo, promotions `=D`;
castling, pawn moves, `x`, `+`, `#` unchanged) when the setting `notation.style`
is `"spanish"`, or `"auto"` (default) and `lang` is Spanish; English otherwise
(`opts.style` overrides the setting, for a preview). It never throws, is not idempotent
(feed it the English SAN, never text that was already localized: `Rg1` is a king
move once it is Spanish) and returns `""` for a missing SAN, so callers that
may run before it exists guard it: `Ludus.chess.localizeSan ? Ludus.chess.localizeSan(san, lang) : san`.
Also `Ludus.chess.notationStyle(lang, opts?)` -> `"english"|"spanish"` (what the
setting resolves to) and `Ludus.chess.spokenSan(san, lang)` (the move in words for
an `aria-label`: `Nxf3+` -> "caballo captura en f3, jaque" / "knight takes f3, check").

`js/pgn.js` → `Ludus.pgn = { parseTags, resolveGameStartFen, tokenizeSanMoves,
splitGamesFromText, buildGameFromText, removeVariations, hasOversizedComment,
cleanTagValue }` (moved verbatim from `app.js`, same limits).
`buildGameFromText(text) -> { tags, sanMoves } | null`.

## 6. Engine (`js/engine.js`)

Wraps a UCI engine behind a **transport** so it runs in a Worker in the
browser and over a child process in Node tests.

```js
Transport = { postMessage(line), addEventListener(type, fn), removeEventListener(type, fn), terminate() }
            // "message" events carry { data: "<one UCI output line>" }; "error" events allowed

const eng = Ludus.Engine.create({ createTransport: () => new Worker("vendor/stockfish-18-lite-single.js"),
                                  hashMb: 32, readyTimeoutMs: 30000 });
await eng.ready()                      // -> boolean
const res = await eng.analyze({
  fen, movetimeMs?, depth?, multiPv: 1..8 (default 1),
  searchMoves?: ["e2e4", ...],         // UCI "go ... searchmoves"
  onInfo?({ depth, elapsedMs, lines }),// throttled ~8/s
  signal?: { aborted: boolean }        // polled; abort => engine "stop", promise resolves with what it has
});
// res = { lines: Line[], depth, nodes, elapsedMs, bestMoveUci|null }
// Line = { multipv, depth, score: { type: "cp"|"mate", value }, pv: string[] }  // from the SIDE TO MOVE's point of view
eng.stop(); eng.terminate(); eng.isReady
Ludus.Engine.parseInfoLine(line) -> Line | null            // pure, exported for tests
```

Requests are serialized (one search at a time). Each `analyze` resets to a
clean state (`ucinewgame` only when asked; `MultiPV` set per request).
Terminated/failed transports reject pending promises with `Error("engine-...")`.
The existing 3-ply JS fallback evaluator stays in `app.js`; callers fall back
to it when `ready()` is false.

## 7. Scoring (`js/scoring.js`)

Scores are numbers in **centipawns from the mover's point of view**, with mate
encoded exactly like `app.js` does (`±(100000 − 1000·min(50, n))`).

```js
Scoring.encodeScore({type, value}) -> number      Scoring.decodeScore(n) -> {kind:"cp"|"mate", cp?, matePly?}
Scoring.winPercent(n) -> 0..100                   // Lichess logistic on clamped cp; mate -> ~cp equivalent
Scoring.formatEval(n, lang) -> "+0.35" | "-1.20" | "M3" | "-M2"   // pawn units, sign, mate
Scoring.DEFAULTS = { model:"precision", strictness:"standard", bestMode:"band", tolerancePct:1, hintCost:{ level1:0.15, level2:0.35, reveal:1 } }
Scoring.normalizeSettings(partial) -> full

Scoring.assess({
  lines,            // Line[] from Engine (MultiPV, mover POV) — lines[0] is the reference best
  userUci,          // string | null   (null => no move)
  userScore,        // number | undefined: mover-POV score of the user's move when it is NOT in `lines`
  masterUci,        // optional: the historical/game move (used by bestMode "masters")
  settings,         // Scoring.DEFAULTS-shaped
  reason,           // "" | "timeout" | "skip"
  hintsUsed         // 0 | 1 | 2 | 3  (3 = revealed)
}) -> Assessment
```

`Assessment`:

```js
{ points,            // 0..10, one decimal, hint penalty applied
  rawPoints,         // before hint penalty
  maxPoints: 10,
  accuracy,          // 0..100 (Lichess-style curve on win% loss, strictness applied)
  qualityCode,       // "brilliant"|"great"|"perfect"|"very_good"|"good"|"interesting"|"dubious"|"bad"|"blunder"|"no_move"
  winLossPct,        // >= 0
  cpLoss,            // >= 0, clamped 0..2500
  isBest,            // equals lines[0] or within tolerance (bestMode)
  rank,              // 1-based index in `lines` or null
  bestUci, bestScore, userScore,
  onlyMove,          // best is better than the 2nd line by >= 12 win% (needs multiPv >= 2)
  gapToSecondPct,    // or null
  reason,            // "ok"|"no_move"|"timeout"|"skip"|"allows_mate"|"missed_mate"
  hintPenalty }
```

Rules: `precision` model → `accuracy = clamp(103.1668·e^(−0.04354·loss·k) − 3.1669, 0, 100)`
where `k` = strictness (relaxed 0.6 / standard 1 / strict 1.6) and `points =
accuracy / 10`. `tiers` model → fixed points by quality (10/7.5/5/2.5/0/0/0).
`bestMode`: `engine` (only lines[0] is best), `band` (any move within
`tolerancePct` win% is best), `masters` (band + the master's move counts if
within 3%). `brilliant` = best (or within band) **and** a sacrifice (set by the
caller through `options.isSacrifice`) ; `great` = best and `onlyMove`.
Allowing a mate is always `blunder` (reason `allows_mate`); missing a forced mate sets reason `missed_mate`
and costs a fixed extra effective loss on top of the win% given up (`docs/SCORING.md` section 6), so a move that still
wins is an inaccuracy or dubious, not a blunder.
Also exports `Scoring.qualityMeta(code) -> { order, colorToken, glyph }`,
`Scoring.summarize(assessments) -> { count, points, maxPoints, avgAccuracy, byQuality }`.

## 8. Insights, concepts (`js/insights.js`, `js/concepts.js`)

```js
Insights.positionFeatures(fen) -> { phase:"opening"|"middlegame"|"endgame", material:{w,b,diff}, legalCount, inCheck,
                                    hanging:{w:[sq], b:[sq]}, ... }
Insights.analyzeChoice({ fen, userUci, bestUci, assessment, lines?, userPv?, masterUci? })
  -> { tags: string[],            // e.g. "hangs_piece","missed_capture","missed_mate","allows_mate","missed_check",
                                  //      "quiet_best","sacrifice_best","back_rank","fork_available","pin","development","king_safety",
                                  //      "loses_material","tactic_available"...
       phase,
       messages: [{ key, params }],   // i18n keys registered by insights.js; already ordered by importance, max 3 (2 when a mate explains it)
       conceptIds: string[] }          // ids into Concepts
Insights.gamePhase(fen | Chess | cells[, fullmove]) -> "opening"|"middlegame"|"endgame"
Insights.tagLabelKey(tag) -> i18n key
Concepts.list() / get(id) -> { id, title:{es,en}, body:{es,en}, fen, bestUci, tags:[...] }
```
Tags are heuristics, never claims of certainty: wording must be hedged
("looks like", "may").

## 9. Data shapes

### Position (input to a session)

```js
{ id,                       // stable string; source:hash(fen)
  fen,
  source: "own"|"classic"|"notebook"|"daily",
  meta: { players, event, year, site, eco, result, moveNumber, sideToMove },  // same shape app.js builds today
  gameMoveUci?, gameMoveSan?, gameEvalText?,   // the move actually played in the game
  bestMoveUci?, bestMoveSan?, bestEvalText?,   // when present app.js does NOT search for a best move
  lossCp?, thresholdUsed?, phase?,
  reference?: { depth, lines: [{ uci, san, score /*mover POV number*/, pv: [uci...] }], origin: "precomputed"|"runtime" },
  classic?: { gameId, ply, kind: "only-move"|"tactic"|"sacrifice"|"quiet"|"endgame"|"opening", difficulty: 1|2|3, note?: {es,en} },
  tags?: string[] }
```

### RoundRecord (`round:completed`, stored by Profile)

```js
{ id, ts, profileId|null, sessionId, sessionKind, source, positionId, fen, sideToMove, phase,
  userUci|null, userSan, bestUci, bestSan, masterUci?, masterSan?,
  points, accuracy, qualityCode, winLossPct, cpLoss, isBest, rank, onlyMove,
  timeSpentMs, hintsUsed, timedOut, tags: string[],
  lines: [{ uci, san, score, pv: [uci] }]   // top lines, compacted (<= 3, pv <= 6 plies)
  meta: {...} }
```

### SessionRecord (`session:completed`)

```js
{ id, ts, profileId|null, kind: "own"|"classic"|"review"|"daily", title, mode: "solo"|"duel",
  positions, points, maxPoints, avgAccuracy, durationMs, byQuality: {...}, roundIds: [...] , duel?: {names, scores} }
```

### Session launcher (implemented by `app.js`)

```js
Ludus.game.startSession({
  kind: "classic"|"review"|"daily"|"own",
  title: string,                     // shown in the play header
  mode: "solo"|"duel", names?: [a, b], profileIds?: [id|null, id|null],
  positions: Position[],             // fixed list; the session length is positions.length
  options?: { clock?: {mode:"timed"|"untimed", seconds}, hints?: boolean, scoring?: partial Scoring settings }
}) -> Promise<void>
Ludus.game.isActive() -> boolean
Ludus.game.abort() -> void         // returns to the previous screen without recording a completed session
```

The "own games" flow keeps its lazy pipeline (wizard → download → search) and
uses the same round/session events and records.

## 10. Settings (`js/settings.js`)

Persisted at `ludus.settings.v2` (migrates `ludus.setup.v1`). Paths:

```
board.theme        "walnut"|"classic"|"ocean"|"forest"|"slate"|"contrast"
board.coords       boolean          board.legalDots  boolean      board.lastMove boolean
board.animation    "auto"|"on"|"off"        board.drag  boolean
notation.style     "auto"|"english"|"spanish"   (piece letters of written moves, group "board"; `Ludus.chess.localizeSan`)
sound.enabled      boolean (default true)   sound.volume 0..1 (0.5)     haptics boolean (true)
clock.mode         "timed"|"untimed"        clock.seconds 5..360 (90)
engine.strength    "fast"|"balanced"|"deep"|"custom"   engine.movetimeMs 300..10000
engine.multiPv     1..5 (3)
scoring.model      "precision"|"tiers"      scoring.strictness "relaxed"|"standard"|"strict"
scoring.bestMode   "engine"|"band"|"masters"        scoring.tolerancePct 0..5 (1)
hints.enabled      boolean (true)
mistakes.sensitivity "high"|"standard"|"low"   // 50 / 80 / 150 cp for own-game mistake detection
a11y.textScale     1|1.15|1.3     a11y.contrast "normal"|"high"     a11y.motion "auto"|"reduce"
```
`Settings.get(path?)`, `Settings.set(path, value)` (validated, emits
`settings:changed`), `Settings.reset(pathPrefix?)`, `Settings.scoringSettings()`
(→ Scoring shape), `Settings.engineBudget()` (→ `{movetimeMs, multiPv}` from
strength preset: fast 700ms · balanced 1500ms · deep 4000ms).
`Settings.applyToDocument()` sets `data-board-theme`, `data-contrast`,
`data-motion`, `--text-scale` on `<html>`.

## 11. Profile (`js/profile.js`)

Storage keys: `ludus.profiles.v1` (index: `{ v, active, profiles:[{id,name,color,createdAt,googleSub?}] }`),
`ludus.p.<id>.v1` (`{ v, rounds:[...cap 600], sessions:[...cap 200], notebook:[...cap 1000], xp, achievements:{id:ts}, daily:{lastDate, streak, best}, updatedAt }`).
API (all sync): `list()`, `active()`, `create({name,color})`, `rename(id,name)`,
`remove(id)`, `setActive(id)`, `ensureActive()` (creates "Player" on first use),
`recordRound(round)`, `recordSession(session)`, `stats(id?)`, `levelFor(xp)`,
`notebook.{list(filter), get(id), due(now, limit), grade(id, accuracy, now), add(round), remove(id), counts(now)}`,
`achievements.{catalog(), unlocked(id?), evaluate(id?) -> newly}`,
`daily.{status(date), complete(date, accuracy)}`,
`exportJSON(id?|"all") -> string`, `importJSON(text, {mode}) -> {ok, error?, profiles, rounds, cards}`,
`merge(a, b)` (pure, used by sync), `wipe(id?|"all")`.

Spaced repetition: Leitner boxes `[0,1,3,7,14,30]` days. A card is created from
any round with `accuracy < 70` (configurable constant) or `isBest === false &&
qualityCode in {bad, blunder, dubious}`. Passing a review (`accuracy >= 70`)
moves it up one box; failing sends it back to box 1 (due next day). A card
remembers `fen`, the reference `lines`, tags, source meta.

XP: `round(points × 10)` per position + streak/daily bonuses. Levels are
chess-themed (`Peón → Caballo → Alfil → Torre → Dama → Rey → Gran Maestro` with
sub-levels), thresholds in code, titles registered via i18n.

QA fixes (F6, authoritative over the text above):

- **Hints are not passes.** A review (a round of source `notebook`, or `notebook.grade(id, acc, now, { hintsUsed })`) that used ANY hint
  (`hintsUsed >= 1`) does not advance or clear the card: it is graded as a failed review (box 1, due tomorrow). The achievements that say "you found
  it" (`first_perfect`, `only_move`, `sacrifice`, `mate_found`, `hot_streak`) only count rounds with `hintsUsed === 0`; their descriptions say
  "sin pistas / without hints".
- **Played is not solved.** A round that was skipped, timed out or closed by the last hint (`qualityCode "no_move"`, `timedOut`, `hintsUsed 3`) counts
  as a position PLAYED (`stats().totalPositions`, unchanged) but not SOLVED: `stats().solvedPositions` (new) is what `first_round`, `positions_100` and
  `positions_500` measure, such a round does not count as a source for `explorer`, and a classic session whose `byQuality` says every position was
  `no_move` is not a completed classic (`first_classic`, `classics_10`). Rounds older than the 600-round window cannot be told apart in the XP ledger
  and stay counted as solved.
- **Named profiles are never redirected.** `recordRound`, `recordSession` (also a duel whose `profileIds` are all gone), `notebook.add` and
  `daily.complete` with a `profileId` that is not in the index return `false` / `null` with `lastError() === "unknown-profile"` (text: `Profile.errorKey`);
  nothing is written and no "Player" is created. An omitted `profileId` (`undefined`, `null`, `""`) still means the active profile.
- **Storage health.** `Profile.storageStatus()` -> `{ ok, available, reason: "" | "blocked" | "quota", failures, unsavedRounds, unsavedSessions,
  lastFailureAt, lastFailureKey, recovered }` (`available` = `Ludus.storage.available`, so false when site data is blocked from the start; `ok` is about the
  last write; the counters are since the page loaded). The first failed operation of a page load (and `attach()` when storage is unusable from the
  start) emits ONE bus event `storage:failed` `{ reason, key, at }`; a screen that mounts later reads `storageStatus()`. `recordRound` / `recordSession`
  keep returning `false` with `lastError() === "storage"`, which is how the game core knows a round was not saved. Nothing ever throws.
- The default profile name is `Participante` / `Player` (neutral; existing profiles keep the name they were created with).

## 12. Facts, reader, audio

* `Facts.all() / byCategory(cat) / pick({exclude, category, lang}) / timeline()`.
  Each fact `{id, cat, year?, text:{es,en}}`; categories: `origins`, `champions`,
  `machines`, `rules`, `openings`, `culture`, `records`, `mind`. Timeline items
  `{year, title:{es,en}, text:{es,en}}`. Every claim is checked: see
  `docs/FACTS_SOURCES.md`.
* `Reader.readingTimeMs(text, lang)` → `clamp(words / 3.0 * 1000 + 1500, 6000, 24000)` (≈ 180 wpm).
  `Reader.createCarousel(container, {category?, lang, onlyWhile?})` → controller
  `{ start(), stop(), next(), prev(), pause(), resume(), destroy() }`. Never
  advances before the reading time of the current fact has elapsed, pauses on
  hover / focus / touch / when the tab is hidden, has visible prev/next and a
  progress ring, honours reduced motion, announces only on user action.
* `Audio.play(name)` where name ∈ `move capture check correct great wrong levelup click`; WebAudio
  synthesized (no asset files), lazily unlocked on first user gesture,
  honours `sound.enabled/volume`. `Audio.haptic(kind)` uses `navigator.vibrate`
  when `haptics` is on.

## 13. Auth and sync (`js/auth.js`) — optional

Only active when `Ludus.config.googleClientId` is non-empty. Nothing is
requested from Google before the user presses "Sign in with Google". Uses
Google Identity Services (`accounts.google.com/gsi/client`, loaded on demand)
for the identity and an OAuth **token client** with scope
`https://www.googleapis.com/auth/drive.appdata` to read/write a single hidden
file (`ludus-progress-v1.json`) in the user's Drive `appDataFolder`. Access
tokens live in memory only. Sync = download → `Profile.merge` → upload.
`Auth.isConfigured()`, `Auth.status()` (`signed_out|signing_in|signed_in|syncing|error`),
`Auth.user()` (`{name,email,picture,sub}`), `Auth.signIn()`, `Auth.signOut()`,
`Auth.syncNow()`, `Auth.onChange(fn)`. The Google ID token payload is decoded
for display only and is never treated as proof of identity by us: the Drive
appdata scope is what actually authorises access to the data. See
`docs/GOOGLE_SIGNIN.md` for the one-time setup the site owner must do.

**First link is an explicit step (QA fix SEC-005 / SEC-006 / SEC-016, authoritative over the text above).** Signing in links nothing, uploads nothing
and downloads nothing: `signIn()` resolves `{ ok, user, linkRequired }`, and `Auth.state()` gained `linkedProfiles: [{ id, name }]` (the local profiles
linked to the signed-in account, normally one: an account has ONE cloud profile) and `linkRequired` (a user is known and none is linked). Until a profile
is linked `syncNow()` answers `{ ok: false, error: "link-required" }` (not an error status, no network) and no automatic sync is scheduled. A profile
linked by an earlier version or session keeps syncing right after the sign-in without asking again. The account UI drives the choice:

- `Auth.remoteSummary()` -> `{ ok, exists, profiles: [{ id, name, rounds, sessions, notebook, xp, updatedAt }] }`: a read-only look at what this account's
  Drive already holds (only entries linked to this account), to say "Drive already has progress for 'Ana' (120 positions)" before asking. Names are plain
  data: escape them.
- `Auth.linkProfile(profileId)` -> "save THIS local profile to my Drive": links it (`Profile.setGoogleSub`) and runs the first sync (merge with what the Drive
  holds + upload). Resolves `{ ok, linked: true, profileId, imported, uploaded, created }`; when the link was made but the sync could not run (session to
  reconnect) it is `{ ok: false, error, linked: true }` and the sync runs after the next sign-in. Failures: `not-signed-in`, `profile-not-found`,
  `linked-elsewhere` (the profile belongs to another Google account; never taken over silently), `already-linked` (`profileId` = the profile already
  linked: one per account, call `unlinkProfile` first), `link-failed` (the store refused, e.g. storage full), `profile-unavailable`.
- `Auth.unlinkProfile(profileId)` -> `{ ok, profileId }`: stops syncing it (the local profile and the Drive copy stay as they are).
- `Auth.importFromDrive()` -> "bring my Drive progress to this device" (first sign-in on a second device): downloads the account's profile and imports it
  (it arrives linked), uploads nothing, resolves like `syncNow()` (`empty: true` when the Drive has nothing for this account); a device that already holds
  `Profile.constants.MAX_PROFILES` profiles answers `{ ok: false, error: "import-failed", detail: "limit" }`. With a profile already linked it is a plain sync.

Sync itself only imports entries of the downloaded document whose `googleSub` is the signed-in account (other or missing `googleSub` are dropped, and dropped
from the file when it is rewritten), and refuses a document with more than `Auth.constants.MAX_REMOTE_PROFILES` (16) entries as `bad-remote` (size was
already capped by `Profile.constants.MAX_IMPORT_CHARS`). Error texts added: `auth.error.link-required|linked-elsewhere|already-linked|link-failed|profile-not-found`.
With no `googleClientId` the module removes a stale `ludus.auth.v1` hint the first time it is asked anything.

## 14. Classics (`js/classics.js` + `js/data/classics.data.js`)

`scripts/build-classics.js` reads `data/classics/*.pgn` + `data/classics/notes.json`,
replays every game with `Chess` (any illegal move fails the build), analyses
selected positions with the vendored Stockfish in Node (depth ≥ 18, MultiPV 5)
and writes `js/data/classics.data.js` (`Ludus.ClassicsData = { v, engine, games:[...] }`).
`Ludus.Classics`: `load()` (lazy `loadScript`), `list()`, `get(id)`,
`positions(gameId, {count, side, maxDifficulty})` → `Position[]` (each with
`reference.lines`), `daily(dateKey)` → deterministic Position, `random(count, {exclude})`.

Addendum (QA pass, backward compatible; details in `docs/CLASSICS_DATA.md`, "Display names, events and
quoted moves"): the data also carries `names` and `events`, tables keyed by the raw PGN tag with the
`{es, en}` display form of each person and event (`white`/`black`/`event` stay the raw, stable tags).
`Classics.displayName(raw, lang)` and `Classics.displayEvent(raw, lang)` read them (unknown input comes
back unchanged), `Classics.list()` items carry `display: {white, black, event}`, and
`Classics.localizeQuotedMoves(text, textLang)` re-spells the moves quoted inside a blurb or note for the
notation setting (`Ludus.chess.localizeSan`). The Spanish texts quote moves with Spanish piece letters
(R D T A C), the English ones with K Q R B N. Dates are year-only unless confirmed.

## 15. Screens (`js/ui/*.js`)

`Ludus.Screens.<name> = { mount(containerEl), show(params), hide() }`. Rendering
uses `Ludus.util.h` / escaped templates only. Screens re-render on
`language:changed` and `profile:changed`. Navigation only through
`Ludus.router.show(id)`; starting play only through `Ludus.game.startSession`.
Screen ids and containers (in `index.html`): `landing`, `home`, `setup` (the
existing own-games wizard), `classics`, `notebook`, `progress`, `museum`,
`settings`, `account`, `game`.

CSS: tokens live in `styles.css :root`; shared components in `css/system.css`;
each screen has `css/<screen>.css` with a class prefix unique to it.

## 16. Versioning, offline, deploy

**The version.** `scripts/generate-version.js` hashes everything the deployed app loads: `app.js`, `styles.css`, `config.js`, `manifest.json`, every
file under `js/`, `css/`, `assets/` and `vendor/` (documentation in them, `*.md` / `*.txt` / `SHA256SUMS`, does not count), `index.html` with its own stamps
blanked (so the CSP meta tag, the markup and the preload hints are part of the version) and `sw.js` with its generated constants blanked, plus the precache
list. The 12-digit hash is stamped into every local `<script>` / `<link>` `?v=` and `<meta name="ludus-version">` of `index.html` and into `sw.js`
(`CACHE_NAME`, `CORE_ASSETS`, `ENGINE_CACHE`, `ENGINE_FILES`). It is idempotent (running it twice changes nothing; stamps never feed back into the hash) and
independent of modification times. Lazily loaded files (`js/data/*.js`) are fetched with `?v=` (see `Ludus.util.loadScript`). GitHub Pages ignores
`?v=` (an old URL returns the new bytes), which is why the service worker, not the URL, is what keeps builds apart.

**The service worker (`sw.js`).** Three policies, and requests that are not the app's are not intercepted at all (other origins, `LICENSE`, markdown files,
`package.json`, Range requests):

1. *Navigations* (`/`, `/index.html`, any query): the precached shell, immediately, whatever the network does. The shell and the scripts it names are the same
   build by construction (one versioned cache), a dead or hanging network costs nothing (measured: the page commits in ~40 ms with a network that accepts
   connections and never answers; it used to hang for 75 s and more), and nothing is ever mixed. Freshness comes from the worker update, not from the page
   request: each navigation asks `registration.update()` (at most once per 15 min), a new build installs in the background and WAITS (there is no automatic
   `skipWaiting`). The precache is all-or-nothing, fetched past the HTTP cache (`cache: "reload"`: Pages sends `max-age=600`), and the installed `index.html`
   must carry this worker's own version or the install fails and is retried at the next check (a deploy half way).
2. *The engine* (`vendor/*.js`, `*.wasm`, unversioned file names, 7.3 MB): its own cache `ENGINE_CACHE`, named after the SHA-256 of the engine files. A deploy
   that does not touch `vendor/` keeps the same cache name, so the engine survives it and plays offline right after (measured: no request to the server at all);
   an old worker's copy is migrated into it on activate when it is byte-for-byte the expected one. Only bytes whose SHA-256 is in `ENGINE_FILES` are stored or
   served (one retry past the HTTP cache, then a network error: the page falls back to the built-in engine and the refusal is logged and reported).
3. *Everything else that is ours*: the precache (`CORE_ASSETS`: code, styles, fonts, icons, the piece set and `js/data/classics.data.js`, so Classics works offline
   from the first visit) cache-first, and on demand only files under `assets/` and `js/data/`: a complete same-origin 200, no query string but the build
   `?v=`, never another build's, at most 40 extra entries (oldest out first), every `cache.put` rejection caught and reported, never an error page, an opaque or a
   partial response. A lazily loaded `js/data/*` file of ANOTHER build (an old tab after an update) is refused instead of answered with the new bytes.

Activate deletes only caches whose names start with `ludus-scaccorum-static-` / `ludus-scaccorum-engine-` and are not the current ones: on a GitHub Pages user
site every project shares one origin and one Cache Storage (`docs/GOOGLE_SIGNIN.md`, "Shared origin"). `scripts/smoke-check.js` checks that rule and the
absence of any other `skipWaiting()` on the worker's source.

**The page side (`registerServiceWorker` in `app.js`).** A first install says "ready offline" once (`ludus.pwa.offline.v1`). A waiting build is offered as a
persistent toast "a new version is ready - Reload" (never while `Ludus.game.isActive()`: it waits for `screen:changed` / `session:completed`), and only when the
person agrees does the page send `{ type: "SKIP_WAITING" }` and reload on `controllerchange`. A tab that did not ask (another tab took the worker) is offered a plain
reload and never reloaded by itself. A window that comes back after 30 minutes asks for an update. Failures the worker would swallow (install refused by the
storage quota, `cache.put` rejections, a refused engine file) are logged: `console.warn` on the page, from the worker's `{ type: "ludus-sw", event, detail }`
messages. With service workers absent or stubbed out (automation, locked-down browsers) nothing is registered and nothing is logged as an error.

**Deploy.** `deploy-pages.yml` has two jobs. `build` (permissions: `contents: read`) regenerates the version, runs `npm test`, copies `index.html app.js styles.css
config.js sw.js manifest.json LICENSE THIRD_PARTY_NOTICES.md js css assets vendor` into `_site` and uploads it; `deploy` (`pages: write`, `id-token: write`, the
`github-pages` environment) only publishes that artifact and runs no project code. `npm start` is `scripts/dev/serve.js`: loopback only, the deploy list
only (no `.git`, docs, scripts, data, dotfiles). `scripts/smoke-check.js` verifies: files exist, hash and stamps coherent (index.html, `CACHE_NAME`,
`CORE_ASSETS` incl. `js/data`, `ENGINE_CACHE` / `ENGINE_FILES` against `vendor/`), no `vendor/` in the precache, a 4 MiB precache budget, the service worker's
deletion / `skipWaiting` rules, the CSP allow-list, no `Permissions-Policy` meta, the deploy workflow copies everything the hash and the precache cover and does
not grant the Pages token to the job that runs project code. `.github/workflows/e2e.yml` runs `scripts/e2e/sw.js` and `scripts/e2e/csp.js` in Chromium (it cannot
be run from the development sandbox; it is meant as a separate, initially non-required check: `npm test` stays the required gate).

**What a `<meta>` CSP can and cannot do (SEC-002, SEC-012, SEC-013).** The policy in `index.html` governs the document. It does NOT govern a same-origin worker
script (`new Worker("vendor/stockfish-18-lite-single.js")` runs with no CSP of its own and can `fetch()` anywhere), and `Permissions-Policy`, `frame-ancestors` and
`sandbox` are header-only (GitHub Pages cannot send headers), so the `Permissions-Policy` meta that used to be here was removed (the app uses none of those
features) and clickjacking is handled by `js/boot.js`. The integrity of the engine therefore rests on `vendor/SHA256SUMS`, on the service worker's
`ENGINE_FILES` check above and on the review of any change to `vendor/`. A blob-wrapper was evaluated (fetch the engine, start it from `blob:`; blob workers
inherit the creator's CSP, and `worker-src blob:` without `'self'` would also close the same-origin-worker bypass): in Chromium 1194 with the real engine it works
(same UCI output and analysis, 500 ms to first bestmove) and the inherited `connect-src 'self'` blocks a probing `fetch()`. NOT implemented: the transport factory of
`js/engine.js` is synchronous (it would need a buffering facade), `worker-src blob:` cannot be tried in Firefox or Safari from here, and in a browser where it
failed the strong engine would silently become the backup one. Recipe if it is ever wanted: a facade in `defaultCreateTransport` that queues `postMessage` until the
fetch finished, `new Worker(blobUrl + "#" + encodeURIComponent(absoluteWasmUrl))` (the hash must NOT end in `,worker`: that makes the loader a pthread helper), CSP
`worker-src blob:`, and `scripts/e2e/sw.js` scenario 2 + `scripts/e2e/csp.js` as the regression check (does a blob worker get the page's service worker offline?).
`scripts/e2e/csp.js` walks every screen, the dialogs and a classic round with the real engine under the shipped policy and fails on any `securitypolicyviolation`;
run with `LUDUS_CSP_VARIANT=<name>` it shows which allowance is needed. Results (Chromium 1194, this tree): removing `'wasm-unsafe-eval'` breaks nothing (the engine runs in a
worker the policy does not govern and the page only calls `WebAssembly.validate`); it stays because a browser that applied the document's policy to that worker
would silently lose the strong engine and Firefox / Safari cannot be tried from here; removing `data:` from `img-src` blocks the inline icons of `js/ui/shell.js` and
`app.js`; removing `worker-src 'self'` breaks nothing but the fallback to `script-src` would also allow Google's script as a worker, so the directive stays;
removing `'unsafe-inline'` from `style-src` produces exactly one violation, the static `style="margin-bottom: 0;"` of the wizard in `index.html` (all JavaScript styling goes
through the CSSOM), so dropping it is one markup edit away: replace that attribute with a class, remove `'unsafe-inline'`, and `LUDUS_CSP_VARIANT=noUnsafeInlineStyle
node scripts/e2e/csp.js` must pass (the split `style-src-elem 'self' ...; style-src-attr 'unsafe-inline'`, which only stops injected `<style>` elements, also passes:
variant `styleAttrOnly`; not applied because the Google Identity flow could not be exercised from here). `https://*.googleusercontent.com` (profile photos) could not be narrowed without real Google accounts, and Firefox / Safari
were not available.

**Minification (PERF-012, not done).** Measured by the performance review: esbuild `--minify` takes JS from 1.76 MB to 1.02 MB raw (gzip 489 KB to 332 KB) and CSS
from 339 KB to 255 KB (gzip 76 KB to 52 KB): about 181 KB of the 859 KB first load. Left out on purpose: it needs a build tool in CI (the project has no dependencies),
the hash and the precache would have to be computed on the minified output (run the minifier into a temporary copy first, then `generate-version.js` there), the unit
tests run the sources rather than what ships, and a minifier bug would only show in production. The recipe above is the safe way to do it later, in the `build` job only.

## 17. Testing

`npm test` = smoke check + the existing chess regression + every
`scripts/tests/*.test.js` (plain `assert`, no framework) + the classics data
validation. Browser-level checks live in `scripts/e2e/*.js` (Playwright is not
a project dependency; the scripts explain how to run them) and are **not** part
of `npm test`. `scripts/e2e/gate.js` is the release gate (landing -> home -> classics
-> a scored classic round -> leave, desktop and phone, fresh profile, no console
errors); `play-session.js` covers the game core in depth (classic, first-run and own-games scenarios), `navigation.js` its browser history, leave
guard, wizard steps, reload/resume, hidden-tab clock and download failures, `smoke.js` the boot and the
service worker precache, `teach.js` what the coach teaches (piece letters in Spanish and
English and the notation setting, a missed mate scored by the new rule, the quality words). `scripts/e2e/walkthrough.js` is the cross-screen journey of a first
session (landing -> home -> classics: replay, a best move by drag and a blunder by click -> coach ->
summary -> notebook review -> progress -> settings -> account: second profile and a duel between
the two -> that profile's own progress -> museum) at 1280x800 and 390x844 in es and en, on a fresh
profile each time; every stage asserts no sideways scroll, no repeated id, no raw i18n key or
"undefined / NaN" on screen, one `main`, `document.title` that follows the screen, and takes a
picture (`LUDUS_E2E_SHOTS`); with `LUDUS_AXE` every stage is also scanned by axe.
`scripts/e2e/shell.js` checks what only a browser can: the boot guards (`js/boot.js`), the skip link, the keyboard ring of every Tab stop, focus not hidden
under the tab bar, forced colours, the contrast of the legal-move dots in the six themes, 44px targets, reflow at 130% text and with the text-spacing
override, the tab labels, the storage banner and the wizard; `scripts/tests/boot.test.js` is its node counterpart for `js/boot.js`.

PWA, build and security tests (F6): `scripts/tests/sw.test.js` runs the real `sw.js` in a `node:vm` sandbox against a fake Cache Storage / network (precache all-or-nothing,
shell with a dead or hanging network, engine verification and its cache surviving a deploy, runtime caching rules and bounds, quota failures, `SKIP_WAITING`);
`scripts/tests/version.test.js` runs `generate-version.js` and `smoke-check.js` on a temporary copy of the deployable tree (what the hash covers and does not, idempotence,
stamps never feeding back, every coherence failure of the QA findings reported); `scripts/tests/pwa.test.js` drives `registerServiceWorker` / `watchServiceWorker` of
`app.js` (offline-ready once, update prompt, never over a session, stubbed or blocked service workers); `scripts/tests/dev-server.test.js` covers `npm start`
(loopback only, deploy list only); `auth.test.js` and `profile.test.js` cover the explicit link, the account scope of sync, the storage status and the hint / pass /
solved rules. Browser: `scripts/e2e/sw.js` (first visit, warm cache, offline, a dead network, a deploy, the engine cache, the update prompt, two tabs, a too-small
quota, blocked service workers; builds its own deploy-shaped sites and serves them with `scripts/e2e/_pages-server.js`) and `scripts/e2e/csp.js` (no policy violation on
any screen). Both are also run by `.github/workflows/e2e.yml`.

## 18. Addenda after the logic layer was built (authoritative where it differs from above)

The modules are implemented and tested; where this document and the code differ, **the code wins** and
this section lists the differences that matter to integrators. Per-module details live in
`docs/SCORING.md`, `docs/FACTS_SOURCES.md` ("API as implemented"), `docs/CLASSICS_DATA.md`, `docs/GOOGLE_SIGNIN.md`.

* **Extra support modules** (stubs owned by the UI work): `js/ui/kit.js` (`Ludus.ui`: toast, modal, miniBoard, gauge,
  ring, sparkline, chips, empty states), `js/ui/shell.js` (`Ludus.shell`: top bar, nav, profile chip, bottom tabs),
  `js/ui/board.js` (`Ludus.Board`: board interaction and visuals used by `app.js`), `js/ui/coach.js` (`Ludus.Coach`:
  result coach panel and session summary). CSS: `css/shell.css` (`.sh-`), `css/board.css` (`.bd-`), `css/coach.css` (`.co-`).
* **i18n**: `Ludus.i18n.onChange(fn)` calls `fn(langString)`. `Ludus.i18n.setLanguage()` always emits `language:changed`.
  `app.js`'s `setLanguage()` must call it (and must react to `language:changed` coming from elsewhere).
* **Router**: `show(id, params)` returns false for an unknown id; `el` may be an element or an id string; sets `document.title`
  from the screen's `title` (i18n key). Nothing is routed through it yet: `app.js` owns the legacy sections
  (`#landing-screen`, `#setup-panel`, `#game-layout`) and must register them as `landing`, `setup`, `game`.
* **Scoring**: accuracy curve has `CURVE_SCALE = 1.8` (see `docs/SCORING.md`); ALLOWING a mate caps accuracy at 10, while
  MISSING one costs a fixed extra effective loss (8 for a mate in one or two, 6 longer) on top of the win% given up,
  `assessment.keptWin` says the move still wins and `Scoring.reasonLabel(reason, lang, assessment)` words it;
  `onlyMove` means every other line is at least 12 win% worse; the label words are one ladder (`Scoring.qualityLabel`:
  Perfect / Very good / Good / Inaccuracy / Dubious / Mistake / Serious mistake, codes unchanged) and the legacy `quality.*`
  strings were removed from `app.js`;
  `assess(input, options)` takes `options.isSacrifice`; extra fields `needsEvaluation`, `isMasterMove`, `hintCost`.
  `Scoring.compatQuality(code)` maps to the 8 legacy CSS/quality codes. Colour tokens used: `--color-gold`, `--color-perfect`,
  `--color-good`, `--color-dubious`, `--color-blunder`, `--color-text-muted`.
* **Engine**: `Engine.create({createTransport?, hashMb?, ...})` defaults to a Worker on
  `vendor/stockfish-18-lite-single.js`; results carry `aborted`, `timedOut`, `terminal`; `analyze` accepts `newGame`.
* **Insights**: tag `pin_or_skewer`; extra tags `discovered_attack`, `missed_promotion`, `open_file`, `outpost`,
  `trade_when_ahead`, and (QA pass) `loses_material`, `tactic_available`; messages are `{key, params, tag, raw}` where
  `params` are already localized (call `Insights.renderMessage(m, lang)` after a language switch; `raw` keeps English SAN
  and is localized with `Ludus.chess.localizeSan`, section 5). `analyzeChoice` also accepts `timing`, `lines` with their
  `pv` and `userPv` (the engine's line after a user move that is not among `lines`): every claim that a move wins or
  loses material is checked against the material along that line (`docs/SCORING.md` section 16); up to 3 messages (2 when
  a forced mate explains the answer). `Insights.moveFeatures(fen, uci, { lines?, pv? })` follows the line too.
  **`Insights.gamePhase(fen | Chess | cells[, fullmove]) -> "opening"|"middlegame"|"endgame"` is the one game-phase
  classifier** (app.js `getGamePhase`/`adaptiveThreshold`/`RoundRecord.phase` call it; the classics builder's `phaseOf`
  lacks the "four pieces" clause and calls 7 of the 248 positions middlegames that are endgames: it should call this
  function too): endgame when the non-pawn material of both sides (N 3, B 3, R 5, Q 9; 62 at the start) is 16 or less, or
  four pieces or fewer are left, or there are no queens and it is 26 or less; opening while it is 50 or more up to
  move 10; middlegame otherwise. Unusable input is `"middlegame"`. On the 248 classic positions: 36 / 194 / 18.
* **Profile**: max 4 local profiles; `Profile.attach()` subscribes to `round:completed` / `session:completed`
  (duplicate ids are ignored, so attach + direct `recordRound` is safe); `recordRound` returns
  `{ok, round, xpGained, card, unlocked, level, levelUp}`; a new notebook card starts in box 0 and is due immediately;
  "cleared" = box 3. Round `accuracy` ignores hints: a revealed answer never passes a review (handled inside Profile).
  `Profile.exportJSON(which, {sync:true})` includes `googleSub` for Drive sync.
* **Settings**: `Settings.clockOptions()`, `Settings.mistakeThresholdCp()`, `Settings.schema` / `Settings.groups`
  (for generic rendering), `Settings.registerText`. `ludus.setup.v1` is migrated once; from now on the wizard must read and
  write `Settings.get/set("clock.seconds")`. Call `Settings.applyToDocument()` at boot.
* **Auth**: identity comes from the userinfo endpoint through one OAuth popup (no ID token). `signIn()` doubles as
  "Reconnect". `Auth.preload()` should be called on hover/focus of the sign-in button. Never render `user().name` unescaped.
* **Classics**: `ply` is the 0-based index of the master's move in `moves[]`; i18n prefix `cdata.`; only the protagonist's
  side is trained; `random()`/`daily()` skip mate-in-one positions by default; `story(id)` / `movesText(id, upToPly)`
  support a replay view; data file is lazy (`Classics.load()`).
* **Facts/Reader**: `Reader.createCarousel(container, opts)` needs the CSS listed in `docs/FACTS_SOURCES.md`
  ("Reader classes"); it does not advance before the reading time, and pauses on hover/focus-visible/touch/hidden tab.
  `js/facts.js` (~100 KB) is loaded eagerly; the old `ROUND_THINKING_FACTS` rotation in `app.js` is to be removed.
* **Tooling**: `npm test` runs 17 steps (~25 s). After editing any hashed file run `node scripts/generate-version.js`.
  New `js/*.js` / `css/*.css` files must be listed in `index.html` (script/link tags) and in `sw.js` `CORE_ASSETS` and, for
  the file lists in `scripts/smoke-check.js` (`LOGIC_MODULES`, `UI_SUPPORT_NAMES`, `SCREEN_NAMES`, `CSS_FILES`).

## 19. The game core as integrated (`app.js`)

`app.js` is the game core; this section is what a screen needs to know about it (the code wins where they differ).

**Public API, `Ludus.game`** (defined at boot, before the screens mount):

* `startSession({ kind: "classic"|"review"|"daily"|"own", title, mode: "solo"|"duel", names?, profileIds?, positions, options? })`
  -> `Promise<void>`, resolved once round 1 is on screen. Fixed list: the session ends after `positions.length`. `options`:
  `clock: { mode, seconds }`, `hints: boolean`, `scoring: partial Scoring settings`; whatever is missing comes from the
  settings. Rejects when no position is playable. An unfinished session is ended quietly first. `profileIds` for a duel: `[id|null, id|null]`
  (`null` = guest, whose rounds are not recorded anywhere).
* `isActive()`, `abort()` (stops timers / engine / overlays, records nothing, routes to `home`), `leave()` (asks the same
  confirmation as "Volver al inicio", then goes home; resolves to a boolean), `session()` (a copy of the session info).
* `openOwnGamesSetup({ mode?, names?, profileIds? })`: the wizard of the person's own games with the mode already chosen;
  step 1 is skipped when the mode is `solo`, or `duel` with both names given ("Step 1 of 2").
* `hint()` -> `{ level, from?, to?, uci? } | null`: level 1 marks the piece, 2 also its destination, 3 shows the move and ends
  the round for 0 points (`reason: "skip"`, `hintsUsed: 3`). The cost is `Scoring.DEFAULTS.hintCost` (settings). The button is `#hint-btn`.
* `analyzePosition(fen, { multiPv, movetimeMs, depth, searchMoves, onProgress, signal })` -> `{ lines, source: "stockfish"|"local", depth, cached?, aborted? }`
  (cached, joins a running identical request, falls back to a 3-ply search of `app.js` with the same line shape).
* `resultContext()` = `STATE.resultView.context`, what the coach panel draws: `{ kind, round, fen, positionId, source, best, master,
  lines (SAN + eval), answers[] (assessment, insights, hit, hintsUsed, ...), assessment, assessments, insights, fact, engine, ... }`.
* `configureEngine({ createTransport?, minEvalVisibleMs?, retryBaseMs? })` and `isUsingFallbackEngine()`: for tests and e2e.
* `savedDownloads` (Settings > Privacy, QA SEC-008): `keep()` -> boolean (default `true`: downloaded games and the remembered usernames are kept for up to 7
  days), `setKeep(boolean)` (writes `ludus.noPersistDownloads.v1`), `clear()` -> `Promise` (deletes the saved games and the remembered usernames, like the
  wizard's "Clear saved game data"). The settings screen shows its privacy section only when this object exists.

**Events** (all on `Ludus.bus`): `session:started {session}`, `round:completed {round}` (a RoundRecord per answer, two in a duel,
each with the profile of its player), `session:completed {session}` (a SessionRecord; in a duel the totals count both players
and `duel: { names, scores, profileIds }`). An aborted session emits no `session:completed`. `Profile.attach()` records them;
a record with an explicit `profileId: null` is a guest and is skipped (a direct `recordRound()` keeps "null = the active profile").
Achievements and level-ups show `Ludus.ui.toast(message, { kind })` and play a sound, both guarded.

**Routing.** `landing`, `setup` (the wizard) and `game` are router screens registered by `app.js`; the others are the
screens' own. First visit (no `ludus.seen.v1`, no rounds) shows `landing`, everybody else `home`; the landing's start button
marks the flag and goes home; every "back to start" goes home (the landing page only stands in when `home` failed to mount).
Leaving `game` or `setup` by any router call abandons the session / stops the search. `document.body.dataset.screen` follows the router.

**Scoring a round.** Reference = the position's `reference.lines`, else one MultiPV search at the root
(`Settings.engineBudget()`, scaled 0.8x..1.6x by how crowded the position is, the whole round capped at 10 s); the analysis of a
position without lines starts while the person thinks. A move outside the lines is searched with `searchmoves`
at the same time and re-assessed; the move of the game is scored the same way. A "hit" is `isBest || accuracy >= 70` and no revealed hint.
With the fallback engine a precomputed reference is used through the difference the fallback measures (a move outside
the lines is never scored above the weakest reference line: the 3-ply search cannot see deep tactics and would otherwise
give a blunder "no loss"), and lines the fallback guessed are not kept in records.

### The QA fix pass in the game core (F1): history, clock, guard rails, downloads, engine

**Router and browser history (`js/ludus.js`).** `Ludus.router.show(id)` writes one history entry per screen, so Back and Forward (a phone's
Back gesture) move between the screens of the app. `history.state = { ludus: { id, sub?, depth?, seq } }`; an entry without it (the page as it
was opened) is adopted by the first screen. `register(id, opts)` accepts, besides `el/title/onShow/onHide`:
`transient: true` (the game and the wizard replace their entry when left by a screen change, no dead entry stays behind),
`canEnter(entry) -> boolean` (false: Back skips the entry, Forward bounces off it: a finished game), `canLeave({ to }) -> boolean | Promise<boolean>`
(asked before a popstate leaves the screen; "no" puts the popped entry back, the confirmation is the same one "Volver al inicio" shows) and
`onSub(sub)`. New methods: `pushSub(sub)`, `replaceSub(sub)`, `popSub()` (a screen's sub-states: a wizard step or a classics game) and `subDepth()`.
Without `window.history` (Node, old webviews) nothing is written and the router is what it was. `app.js` uses it for `setup` (wizard steps,
`canEnter: wizardOpenedInThisPage`) and `game` (`transient`, `canLeave: confirmRestartToSetup`, `canEnter: isSessionActive`).
`Ludus.util.loadScript(path, { timeoutMs = 20000 })` rejects with "loadScript: timed out loading ..." and forgets the attempt, so a later call retries.

**`Ludus.game` additions.** `hint()` is unchanged for callers (it asks the next level whatever the taps before it); the hint button and `H` are
protected instead (a second press within `HINT_TAP_GAP_MS` = 450 ms is the same press, and the level that shows the move needs a deliberate second press).
The session summary's API (`summaryApi`) gains `canPlaySamePositions` and `onPlaySamePositions`: "play again" draws fresh positions (UX-021); "the same
positions" (`canPlaySamePositions`, only in a duel on fixed positions) is an explicit choice for the coach screen to render. `savedDownloads` also forgets the remembered usernames.

**Settings added to the schema:** `board.confirmMove` (`off` default | `touch` | `always`: a "Confirm move" step between the destination and the score),
`a11y.shortcuts` (boolean, default `true`: the single-letter keys H N E B M; the buttons carry `aria-keyshortcuts` only while they are on).
`engine.movetimeMs` now stops at 3500, the longest search a round allows.

**The round clock.** It paints only when the displayed second changes (one timeout aimed at the next digit change, `STATE.timer.intervalId` is that
pending handle), is paused while the page is hidden (`pausedMs` is taken out of `timeSpentMs` and the deadline moves), and a move submitted after the
deadline is scored as a timeout (`roundClockExpired`). The wizard's clock choice is local to the session being set up (`STATE.setupWizard.clockMode`,
"Sin tiempo" chip `data-seconds="0"`); the global clock setting is only its starting value, and the first-ever session (no `ludus.firstRun.v1`, nothing
played) is untimed and starts with a how-to-play note. `session:completed` is emitted when the LAST position is answered, not when the summary is opened.

**Progress that was not saved.** The shell's storage banner is hidden while playing, so the summary says it itself: its context
(`Ludus.game.resultContext()`, `kind: "session_summary"`) carries `unsaved: boolean` and `unsavedReason: "" | "blocked" | "quota"`, derived from
`Profile.storageStatus()` (a write failed after the session started); `app.js` draws a `.co-unsaved` note at the top of `#session-summary-result`
(`css/coach.css`) and adds the same words to the result live region.

**Session resume.** While a session runs the tab keeps `sessionStorage["ludus.sessionProgress.v1"]` (the position list and the answered rounds, not the
profile's data); a reload offers "continue with what is left" once (`offerSessionResume`), and `beforeunload` warns while a session has unanswered
rounds. A session that was answered to the end leaves nothing behind.

**Own games: downloads and mistake detection.** Failures are `RemoteFetchError { code }` (`notFound`, `userMissing`, `noGames`, `rateLimited` with `retryAfterMs`,
`server`, `offline`, `network`, `timeout`, `malformed`, `tooLarge`, `consentUnavailable`, `cancelled`); the wizard maps every code to a sentence with its remedy buttons, and never shows a raw error.
A 429 is never retried inside the request: the cooldown of the provider lives in `ludus.remoteFetchCooldown.v1` and the wizard counts it down and retries.
The download is abortable (`#analysis-cancel-btn`, elapsed seconds in `#analysis-elapsed`). The consent is asked per `provider|username`, fails closed
when its dialog cannot be shown, and the Chess.com archive URLs are validated against the provider's host and the username. The last username per provider
is remembered (`ludus.lastUser.v1`, forgotten with the saved games). A mistake is a loss of WIN CHANCE (`Scoring.winPercent`), not of centipawns: candidates
are screened with a cheap search (never cached, `noCache`), confirmed with the round's own MultiPV analysis (`verifyMistakeCandidate`), and the confirmed
analysis becomes `position.reference` (`engine.origin: "runtime"`). `mistakes.sensitivity` keeps its centipawn labels; `lossPctForCp` converts. A position with
a single legal move is never a training position. The game phase comes from `Insights.gamePhase` (one classifier for the whole app).

**Engine.** `Engine.supported()` probes WebAssembly SIMD and Workers; an unsupported browser never downloads the file and is told it plays with the
backup engine. The download is prefetched as a stream (`downloadEngineFiles`) with a stall limit (`ENGINE_DOWNLOAD_STALL_MS` = 12 s without a byte, never
a wall-clock limit); a session that answers before the engine is up waits while bytes keep arriving. A worker that stays silent for `silenceMs` (3 s) after
`go` fails the transport, the round falls back at once and the strong engine is retried (`reviveEngineIfNeeded`). The backup engine is alpha-beta with
MVV-LVA ordering and yields to the page every `LOCAL_SLICE_MS` = 12 ms, so it gives the same answers with a tenth of the work and never blocks the page.

**Copy.** `interpolate` in `app.js` understands a tiny plural form `{n?one|other}` (Spanish and English share it); the Spanish is voseo.
Language detection: the first `es*` / `en*` entry of `navigator.languages` wins, anything else is English.

### Board contract (`js/ui/board.js` = `Ludus.Board`, `css/board.css`)

What is inside `.board-wrap` / `#board` belongs to the board module; the play-screen layout (grid, breakpoints, `--board-size`)
belongs to the play screen and only has to give `.board-wrap` a size. **Sizing**: `#board` is `width:100%`, `aspect-ratio:1/1`
(or `height:100%` in a square wrap), never sets a `max-width`, and is a size container (`container-type:inline-size`), so the
board is square for any box and everything inside scales with it (`cqw`). `.board-wrap` must be `position:relative`; the
promotion picker, the arrows svg and a polite live region are its children. If the wrap has `overflow:hidden` the board's own
outer shadow is clipped: give the wrap the shadow.

**DOM** (classes marked `*` are stable API for tests and other screens): `#board.board[role=grid]` with
`data-orientation="w|b"`, `data-coords`, `data-legal`, `data-drag` (`on|off`, from Settings) ; 8 `.board-row[role=row]`;
64 `.square*[role=gridcell][data-square="e4"]` `.light|.dark` (a1 is dark) with exactly one `tabindex="0"` (roving) and an
`aria-label` built by the game core (`describe` callback); state classes `selected* legal* capture* bd-last bd-check hint-from*
hint-to* best-from|to game-from|to user-from|to user-alt-from|to bd-can-drag bd-drag-src bd-over`; `.coord.coord-rank|coord-file`
(`aria-hidden`); pieces are `img.bd-piece[data-piece="wK"]` (`aria-hidden`, cburnett SVG, `.bd-moving` / `.bd-leaving`
while animating). `svg#board-arrows` (`viewBox 0 0 800 800`): `g.bd-arrow.bd-arrow-best|user|userAlt|game|hint` >
`line.board-arrow-line*` (two for a knight's L) + `polygon.bd-arrow-head`; the same move drawn twice keeps the highest of
best > game > user > userAlt > hint. While dragging: `img.bd-ghost` (child of `<body>`, `position:fixed`) and `body.bd-drag-active`.

**API**: `Ludus.Board.create({ el, arrowsEl, wrapEl, orientation, onSquare, onMove, onCancel, onFocusSquare, describe, getSetting })`
-> `{ build(orientation), setOrientation, render(model), setArrows(list), announce(text), setFocus, cancelDrag, isDragging, destroy }`.
`render(model)` is a diff (squares are built once per orientation; a render that changes nothing writes nothing; ~0.05 ms, ~1.3 ms
when pieces change): `model = { pieces (Chess#board | FEN), turn, interactive, selected, targets:[{square,capture}], lastMove:{from,to},
check, hint:{from,to?}, marks:{best,game,user,userAlt}, arrows:[{kind,from,to}], focus, label, lang }`, squares as names.
`app.js` builds it in `boardModel()` and keeps `onSquareClick`, `boardInputAcceptsMoves`, `renderBoard`, `renderBoardArrows`,
`buildBoard` as thin adapters (they work without `Ludus.Board`, they just draw nothing). Pure helpers, all unit-tested:
`parseSquare squareIndex indexSquare isDarkSquare cellOf squareAtCell squareFromPoint nextSquare arrowGeometry planMoves
motionEnabled slideDuration feedbackKind createDragMachine`; `Ludus.Board.feedback(kind)` plays the sound and the vibration.

**Input**: click-click (unchanged), keyboard (arrows relative to the screen, Home/End/PageUp/PageDown, Enter/Space, Escape), and
pointer drag (mouse, touch, pen; `board.drag`): a press on the mover's own piece selects it, moving 4 px (8 px for a finger)
starts a drag with a ghost under the pointer, releasing on a legal target calls `onMove(from, to)` (the game core plays the same two
clicks), on an illegal square snaps back keeping the selection, outside the board / Escape / `pointercancel` / blur cancels.
`touch-action:none` is set only on the squares whose piece can be dragged, so the page still scrolls from every other square.
Nothing is accepted while `boardInputAcceptsMoves()` is false. Choosing the selected piece again deselects it.

**Motion**: a render that moves pieces slides them with the Web Animations API (FLIP, 170-300 ms, `--ease-out`), the captured
piece fades after the mover arrives, a castling slides both pieces, a promotion slides the pawn and turns it into the new piece,
a piece dropped by the person does not slide, an unrelated position fades in. `board.animation` `off` is instant; `a11y.motion =
reduce` always wins; `on` animates even when the system asks for less; `auto` follows `prefers-reduced-motion`. A render that
moves pieces cancels what was still moving. The last move is remembered by the game core per Chess object (`lastBoardMove`):
replacing `STATE.board` clears it. **Sound and haptics** of the person's own move: `moveFeedback(move)` in `app.js`
(`Ludus.Audio.play` + `Ludus.Audio.haptic`, kinds `move|capture|check`). Live settings: `settings:changed` for `board.*` and
`a11y.*` re-renders (the view calls `Settings.applyToDocument()` for the theme); `sound.*` / `haptics` are read by Audio each time.
i18n keys `bd.live.*` (announcements) and `bd.state.*` (words for highlights, used in the square labels) are registered by the module.

### The play screen and the coach (`index.html #game-layout`, `css/coach.css` `.co-`, `js/ui/coach.js` = `Ludus.Coach`)

`#game-layout` (`<main>`) is one screen with a fixed grid: header (`#play-header`), stage (turn strip, `#board`, dock), panel
(`#coach-panel`: a handle `#coach-expand`, the scroll region `#coach-scroll`, the footer `#coach-foot`). The page never scrolls;
the panel is its own scroll region and its footer (`#next-btn`, or `#summary-actions`) is always on screen. `app.js`
(`syncGamePhase()`) mirrors the state into attributes, and the CSS only reads them: `data-phase` = `thinking | evaluating |
handoff | result | summary`, `data-view` = `play | summary`, `data-mode` = `solo | duel`, `data-expanded` = the phone/tablet sheet
open over the board. **Regimes**: side (>= 1100px, or landscape >= 560px: board left, panel right, `--board-size` from the
viewport), stacked (portrait: the board, the dock, the panel as a sheet; on a phone the board runs edge to edge and in a result
the handle opens the sheet over the board), and short landscape (a dock of small two-line labels without icons, the title kept
for a screen reader). **Short phones** (portrait, under 700px tall: 320x568, 360x640, 375x667) have their own metrics
(`--co-head-h`, strip, dock, gap, `--co-panel-min` of 184px, 156px in a duel) so the page never scrolls and the board gets what is
left; on a phone the turn strip and the dock take the width of the screen and only the board is centred. Every name a person typed
(duel players) wraps anywhere instead of overflowing; "Position 1 of 10" wraps to two lines under 400px instead of being cut.
`--co-head-h` is the header as it really is: the board is sized from it. The dock under the board swaps its content (hint /
skip while thinking, best / game / explore / reset on a result) at the same height, and the evaluating state draws skeletons in
the shape of the result: nothing moves when the answer arrives.

**Who draws what.** `app.js` owns the state, the flow and the words it needs even without the coach (`play.*`, `game.*`,
`core.*`: the header, the live regions `#play-announce` and `#result-overlay-live`, a plain-text fallback of the result and of the
summary when `Ludus.Coach` is missing). `Ludus.Coach` owns the words and pictures of the panel (`coach.*`, registered through
`Ludus.i18n.register`, es and en, tests keep both in step and reject unused keys). Pure helpers (no DOM): `qualityInfo`,
`verdictKey` / `verdictText`, `winBars`, `safeGameUrl` (only https on lichess.org / chess.com becomes a link), `positionModel`,
`dotsModel`, `rewardModel`, `summaryModel`, `shareText`, `pvTokens`, `roundArrows`. Renderers (every node with `Ludus.util.h`, quiet
without a DOM): `renderThinking(el, model, extra)`, `renderEvaluating(el)`, `renderRound(el, context, api)`, `renderDuel(el, context,
api)`, `renderDots(el, model)`, `renderSummary(el, summary, api)`, `renderSummaryActions(el, summary, api)`, `openConcept(id)`.
`api` (all optional): `{ lang, pv: { line, ply }, onStep(lineIndex, ply), onOpenRound(index), matchText, gaugeSize, canReplay,
canReview, reviewPlayers: [{ name, profileId }], onPlayAgain, onReview(profileId?), onShare }`: in a duel `reviewPlayers` (one per
profile player who has cards; a guest has none) replaces the single review button, and `onReview` receives that profile's id. The
context carries `classicKind` (the kind of a classic position): the result names the theme and its sentence, the thinking card never
does (naming the idea before the answer would hand over what is being trained). The result explains its own numbers in a disclosure
("How to read these numbers": win chance, the signed evaluation, Stockfish and its depth). A sentence never claims "the best move"
for a move that is only as good as the best (`coach.verdict.equivalent*`), and the loss note is computed from the rounded bars it
sits under. The result on screen is always drawn from `STATE.resultView.context` alone, so a
`language:changed` redraws it without recomputing anything and keeps the engine line that is open (`STATE.resultView.pv`).

**What a session keeps for the summary**: `STATE.session.rounds` (index, fen, side, context), so the summary can reopen any
position (`openSummaryRound(i)`: the board goes back to it, the header follows, `#next-btn` says "back to the summary" and
`backToSummary()` returns). `Profile.recordRound` is called first by `emitRoundCompleted` to get what the round earned (XP, level,
notebook card, achievements: `context.rewards`, one entry per answer); the bus event that follows is ignored by `Profile.attach()`.
**Celebrations** (level up, achievements) are not toasts while the play screen is up (`playScreenShowsRewards()`): the result card of a
round lists the XP, the level and the achievements that round earned (a duel, on the card of the player who earned them), the summary
of a solo session lists the session's, and the summary of a duel shows them per player (`STATE.session.rewards.players`, passed to
`summaryModel` as `rewards.players`); the sound still plays and a screen reader is told once the verdict has been read. On every other
screen they are one toast at a time. A duel summary never merges the two players (no combined points, hits or mix of moves).
**A duel from its second position on starts covered** (`STATE.duel.readyWait`, phase `duel_ready`, `data-phase="handoff"`): the
first player's clock does not run and the board ignores input until one tap on `#handoff-overlay` (`revealDuelSecondTurn()` handles
both covers). Leaving a running session by any road (nav, brand, "More" sheet, the address bar) asks the same question as the exit
button (`shell.js` `leaveGameThen()` -> `Ludus.game.leave()`), and only a yes goes on.

**Rules this screen keeps** (checked by `scripts/e2e/coach.js`): no horizontal scroll and no page scroll, nothing overlaps (header
items, board, dock, panel), every control is at least 44x44, every text is at least 4.5:1 (3:1 large) measured on the pixels it sits
on, the quality of an answer is never told by colour alone (glyph, label and words), a visible focus ring on every stop, N / H / E / B
keys as in the legend, no motion under `prefers-reduced-motion` or `a11y.motion = reduce`, no serious or critical axe violation.

`scripts/tests/coach.test.js` (39): the pure helpers, both languages, the renderers in the fake DOM, degradation without the kit or a
DOM. Browser: `scripts/e2e/coach.js` (scenarios `regimes` at ten viewports x es / en, `classic`, `duel`, `clock`, `own`, `motion`,
`keyboard`, `contrast`, and `axe` with `LUDUS_AXE=/path/to/axe.min.js`); the core flows stay in `play-session.js` and `gate.js`.

## 20. Design system quick reference (`styles.css`, `css/system.css`, `js/ui/kit.js`, `js/ui/shell.js`, `js/ui/home.js`)

(Numbered 20 because section 19 was taken by the game-core notes; the design-system brief called it "section 19".)

Direction: a scholarly study. Deep ink/navy surfaces, one warm gold accent, Cormorant (display) + Inter (UI), hairline
borders, soft layered shadows, restrained motion. Always dark (`color-scheme: dark`). Load order in `index.html`:
`styles.css` (tokens + base) -> `css/system.css` (components) -> `css/shell.css` -> screen CSS. `css/system.css` opens with a
comment block listing every component class; this section is the short version.

### Tokens (`styles.css :root`, never redefine them in a screen file)

* **Fonts** (self-hosted, `assets/fonts/`, licences in `THIRD_PARTY_NOTICES.md`): `--font-display` (titles, wordmark, big
  section headings; use weight 600-650, it is thin below 20px) and `--font-ui` (everything else), `--font-mono`. Body text uses lining
  figures (`font-variant-numeric: lining-nums` on `body`).
* **Type scale** in rem (it follows `a11y.textScale`, which sets `--text-scale` and scales `html`): `--text-xs` 12px, `-sm` 13, `-base` 15,
  `-md` 16 (body), `-lg` 18, `-xl` 20, `-2xl` 24, `-3xl` 32, `-4xl` 44, `-5xl` 60, `--text-display` (fluid hero size),
  `--lh-tight|snug|normal|loose`. Do not write `px` font sizes in new CSS.
* **Colour**: surface ramp `--color-bg` < `--color-surface` < `-surface-2` < `-surface-3` < `-surface-4`; `--color-border` /
  `--color-border-mid` are for things the user must find (inputs, buttons: 3:1), `--color-hairline` / `--color-hairline-strong` are
  decorative edges; `--color-text`, `--color-text-muted` (5.6:1 on `-surface-2`); gold ramp `--gold-100..-800` with
  `--color-gold` (400), `--color-gold-dim` (600), `--color-gold-bg` (900), `--color-on-gold` (ink on a gold fill),
  `--gold-gradient`; focus ring `--focus-ring` (+ `-width`, `-offset`), `--color-info` is the focus colour.
* **Verdicts**, the ten quality codes: `--q-<code>`, `--q-<code>-bg`, `--q-<code>-bd` for `brilliant great perfect very-good good
  interesting dubious bad blunder no-move` (underscore -> hyphen). Built on `--color-brilliant|great|very-good|interesting|bad`
  (new) and the existing `--color-perfect|good|dubious|blunder`. Status aliases `--color-success|warning|danger`. Colour is never the
  only signal: pair it with a glyph and words (`Ludus.ui.qualityBadge(code)` does).
* **Space** `--space-0..-11` (2, 4, 8, 12, 16, 20, 24, 32, 40, 56, 72, 96 px), **radii** `--radius-xs..-3xl`, `--radius-pill`,
  **elevation** `--shadow-1..3` (+ legacy `--shadow-board|panel|float`), **motion** `--ease-out|-in-out|-spring`, `--dur-1|2|3`
  (120 / 220 / 420 ms), **z-index** `--z-header 40, -tabbar 45, -popover 60, -overlay 90, -modal 110, -toast 130`, **layout**
  `--page-max`, `--page-gutter`, `--header-h`, `--tabbar-h`, `--hit` (44px).
* **Board themes**: `[data-board-theme="walnut|classic|ocean|forest|slate|contrast"]` (set on `<html>` by Settings, or on any
  element) define `--board-light`, `--board-dark`, `--board-hl`, `--board-coord-on-light|dark` (and the legacy
  `--color-board-light|dark`). `Ludus.ui.miniBoard` reads them.
* **Accessibility hooks on `<html>`**: `data-contrast="high"` (stronger borders and text: tokens are overridden),
  `data-motion="reduce"` (no animation; also honours `prefers-reduced-motion`), `--text-scale`. The `[hidden]` attribute always wins.

### Components (`css/system.css`)

`.btn` + `.btn-primary|-secondary|-ghost|-danger`, `.btn-sm|-lg|-icon|-block`, `aria-busy="true"` = loading, labels wrap. `.card`
(`.card-interactive`, `a.card`, `button.card`, `.card-flat`, `.card-accent`, `.card-head|-title|-text|-foot`). `.chip`, `.badge`
(`.badge-gold|success|warn|danger|info|count`, `.badge.q-<code>`), `.stat`, `.kbd`, `.avatar`, `.level-badge`. `.tabs` + `[role=tab]`,
`.segmented` (children with `aria-pressed|checked|selected`). Forms: `.field` + `label` / `.field-hint` / `.field-error`, `.input`,
`.select`, `.switch`, `.check`, `.slider` (+ `Ludus.ui.bindSlider(input)`). Feedback: `.progress`, `.ring`, `.gauge`,
`.sparkline`, `.chart`, `.spinner`, `.toast-stack`, `.modal-backdrop` + `.modal` (+ `.sheet`), `.skeleton`, `.empty`. Layout:
`.page`, `.stack`, `.cluster`, `.grid` (`--grid-min`), `.screen`, `.screen-head|-title|-sub`, `.section`. Type: `.t-display`,
`.t-title`, `.t-h2`, `.t-h3`, `.t-eyebrow`, `.t-lead`, `.t-muted`, `.t-small`, `.t-mono`, `.t-num`. Reader: all `.rd-*` classes.
The wizard (`.wizard-*`) and the consent overlay (`.consent-*`) are restyled by light overrides at the end of `system.css`.

A routed screen is a `<section id="screen-x" class="screen" role="main">` in `index.html` (only the visible one is exposed, so
the page has one `main`); give its top heading `data-screen-title` (the shell moves focus there after navigation) and build its
content from the components above. Every string goes through `Ludus.i18n.register` (es with "vos", and en).

### `Ludus.ui` (`js/ui/kit.js`), every node built with `Ludus.util.h`; builders return `null` without a DOM

`icon(name, {size, title, className})` (42 stroke icons, `iconNames()`), `toast(message, {kind: info|success|warn|error|achievement|levelup, duration,
action:{label,onClick}})` -> `{id, el, dismiss()}` (queue of 3, hover/focus pauses, errors in an assertive region, the rest polite),
`clearToasts()`, `modal({title, body, actions:[{label, kind, value, onClick(handle) -> false keeps open, autofocus, icon}], onClose,
dismissible, size: sm|md|lg, variant, initialFocus, role, describedBy, ariaLabel})` -> `{el, close(result), closed: Promise}`
(focus trap, Escape, focus restore, `aria-modal`, scroll lock, the rest of the page `inert`), `confirm({title, body, confirmLabel,
cancelLabel, danger})` -> `Promise<boolean>`, `sheet(opts)`, `avatar(profile, {size, label})`, `levelBadge(levelFor(xp))`,
`gauge({value, max, label, size, tone})`, `ring(0..1, {size, label, text})`, `sparkline(values, {width, height, min, max, label})`,
`barChart(items, {label, width, height, max, format, fill})` (natural size, `fill` stretches it; hidden data table for screen readers), `chip`, `badge`, `qualityBadge(code)`,
`button(label, {kind, size, icon, onClick, href, loading, block, disabled})`, `iconButton(icon, label, opts)`, `progress(v, {label,
tone, size})`, `stat({label, value, hint, icon, tone})`, `skeleton({kind: text|title|card|circle, lines})`, `spinner()`,
`emptyState({icon, title, body, action:{label,onClick,href,kind}, level})`,
`miniBoard(fen, {size, orientation, coords, highlight:[sq | {square, kind}], arrows:[{from,to,color}], theme, label})`
(static SVG, 64 squares, cburnett pieces, `role="img"` with a "who moves + piece list" label), `bindSlider(input)`,
`parseFen`, `reducedMotion()`.

**Integration rules found by the walkthrough** (keep them when touching these files):

* The stored `meta` of a classic (`players`, `event`) is English / ASCII and stays that way in records and notebook cards; the words of the
  page come from `Ludus.Screens.classics.helpers.localizeMeta(meta, lang)`, which `Coach.positionModel` and the notebook (`originOf`,
  the search) call at draw time (a missing classics screen shows the stored text). Never show `meta.event` / `meta.players` raw.
* A toast never covers what a person needs: while a `.modal-backdrop` is open the toast stack drops behind it (`css/system.css`, an error
  keeps its place), and on the play screen in stacked layouts it sits under the header, not over the exit button, score and clock
  (`css/coach.css`). Celebrations (achievements, level ups) are never toasts on the play screen: its panel lists them (section 19).
* A screen's root class must not be the name of a kit component (the progress screen is `.progress-root`: a bare `.progress` is the bar).
* `Ludus.router` builds `document.title` from the SHARED dictionary: a screen registered with a key that only app.js's own dictionary
  knows shows the key in the tab (`play.title`). The legacy screens use `core.title.setup` / `core.title.play`; the walkthrough scans
  the tab title for raw keys. Every screen the router shows also exposes exactly one `main` (`#setup-panel` carries `role="main"`).

### `Ludus.shell` (`js/ui/shell.js`)

`mount(appEl)` (idempotent; enhances `#shell-header`, `#shell-nav`, `#shell-status`, keeps `#language-switch`), `update()`,
`setVisible(bool)`, `destroy()`, `parseHash(hash)`. It sets `body.dataset.screen` on `screen:changed` and `body.dataset.shell` =
`on | minimal (landing) | off (game)`, marks the current nav item `aria-current="page"`, shows the due-card badge from
`Profile.notebook.counts().due`, the streak from `Profile.stats().streak`, the profile chip + popover (switch up to 4 profiles,
add a profile, Account link), and a bottom tab bar under 720px (Home, Classics, Notebook, Progress, More sheet). Hash routes
`#/home|classics|notebook|progress|museum|settings|account` navigate on load and on `hashchange`; `#/daily` opens home and starts the
daily challenge; the current screen is mirrored back with `replaceState`. Nothing navigates by hash while `Ludus.game.isActive()`.
The header's width steps are container queries in rem, so they follow the text size.

### Screens `Ludus.Screens.landing` and `Ludus.Screens.home` (`js/ui/home.js`)

`landing.mount(#landing-screen)`: the hero is static HTML in `index.html` (`#landing-start-btn` is app.js's), mount localises it and renders
steps, sources, privacy, closing call and footer (version, GPL-3.0-or-later, Stockfish, `THIRD_PARTY_NOTICES.md`, ES/EN switch that
clicks the header buttons). `home.mount(#screen-home)`, `show()` (also driven by `screen:changed`), `hide()`, `render()`,
`startDaily()`, `openDuelSetup()`, `title: "home.title"`, pure `helpers` for tests. The hub re-renders on `language:changed`,
`profile:changed`, `notebook:changed`, `session:completed`; the daily position loads lazily with a skeleton, an error state with a
retry, a done state; "Next fact" only touches the fact card.

### Boot guards (`js/boot.js`), the storage warning and the rules of the QA fix pass (F4)

* **`js/boot.js`** is the only script in `<head>` (first script of `index.html`, after the CSP meta, before every stylesheet; ES5, synchronous,
  same-origin, no inline code, so the CSP is untouched). It sets attributes on `<html>` that the stylesheets react to before the first paint:
  `data-returning` (localStorage `ludus.seen.v1`: `css/system.css` never paints the landing hero for this visitor and shows a quiet skeleton until the
  router sets `body[data-screen]`; a first-time visitor's header is already the floating landing header, see `css/shell.css`, so nothing shifts when
  the shell mounts; if no screen has been shown after 12 s a timer withdraws the flag so a failed load gives back the static landing instead of a permanent skeleton), `data-framed` (the page is inside another page's frame: everything but `#boot-notice` is hidden and the notice links to the app
  without the hash route: `frame-ancestors` cannot be sent from a meta CSP and top navigation is blocked, so hiding is the defence that works,
  sandboxed frames included; `bustFraming()` in `app.js` is now redundant but harmless) and `data-unsupported` (no `:has()` or container queries, which
  are also the proxy for the JavaScript syntax the other files use: a browser older than Safari 16 / Chrome 105 / Firefox 121 gets a bilingual
  "too old" notice instead of a blank page; WebAssembly is NOT probed here, the engine has a fallback and `app.js` reports SIMD). For first-time
  visitors only it injects the hero preload (`imagesrcset` + `media`, the very candidates of `.ld-hero-bg` in `css/home.css`: keep the two lists in
  step). `scripts/tests/_load.js` leaves it out of the modules it loads; `scripts/tests/boot.test.js` runs it in a bare context.
* **Hero photograph**: `assets/landing/maestro-1280.webp` (phones at 1x), `maestro-2000.webp` (desktop at 1x, phones at 2x) and the original
  `maestro.webp` (2816 px: 2x desktops, 3x phones); the JPEG stays the fallback. `sw.js` still precaches only `maestro.webp`.
* **Storage warning**: `Ludus.shell` paints a persistent, dismissible banner (`#shell-banner`, a polite live region that exists from the start, hidden
  on the landing and on the play screen) when `Profile.storageStatus().ok` is false, from `storage:failed` and from every shell repaint: "blocked"
  (nothing is ever saved: private tab, site data blocked) or "quota" (full: with a way to Account to download a copy). A dismissed reason stays
  dismissed until a different one appears; it disappears by itself when a later write works.
* **Toasts (`Ludus.ui.toast`)**: an `action` toast lasts 12 s at least (an explicit shorter `duration` is raised), `persistent: true` keeps any toast until
  dismissed, `focus: true` (for a toast that answers the person's own keystroke, like "Undo") moves the focus to the action and gives it back when the
  toast goes; Escape closes a toast that has the focus. `Ludus.ui.modal({ describedBy })` takes `true` (the whole body), an id, an Element or a list; an
  `alertdialog` is described by its body unless `describedBy: false`.
* **Focus rings**: the global ring (`styles.css`) has specificity (0,3,0) (`:is()` takes its most specific argument), so a component's own
  `.x:focus-visible { outline-offset: ... }` never applied. To move a ring (inside a clipping pill, say) redefine the variable instead:
  `.x { --focus-ring-offset: -3px; }` (`.segmented > *`, `.ld-lang-btn`); a scroll container (`overflow` other than visible) clips the ring on BOTH
  axes: give it padding and an equal negative margin (`.sh-nav`) or draw the ring inside. `scripts/e2e/shell.js` probes every Tab stop.
* **Forced colours**: one block at the end of `css/system.css` gives selected / pressed / current states and the bars back in system colours
  (`Highlight`, `HighlightText`, `CanvasText`), including the selectors of the screens' own classes; when you add a new selected state, add it there.
* **Board**: legal-move dots and capture rings use `--board-dot-on-light` / `--board-dot-on-dark` (per theme, >= 3:1 against their own square, stronger
  with high contrast); coordinates are drawn above the pieces with a halo and never under 10.5px; the four arrow kinds differ by width and dash as well as
  by hue.
* **Touch targets**: on `(pointer: coarse)` `.btn-sm` and button/link chips are 44px boxes; the language switch, brand, profile chip, toast buttons and
  the wizard's controls are 44px everywhere. **Tab bar**: the labels are one size under `--text-xs` and the bar is a container (`tabs`, in rem): under 19rem
  of content width (a 390px phone at 130% text) only the icons show, the words stay in the accessible name.
* **Skip link**: `href` is `#landing-screen` on the landing (the landing is a sibling of `#app-main`) and `#app-main` on every routed screen
  (`paintSkipTarget` in `js/ui/shell.js`). `#/daily` does not start a round when today's challenge is done (a message says so) and a first-time visitor who
  follows it stays on the landing. The first-run Home (no rounds yet) is a greeting and one primary action, "Play today's position".

### Screens `Ludus.Screens.classics` and `Ludus.Screens.museum` (`js/ui/classics.js`, `js/ui/museum.js`; `css/classics.css` `.classics-`, `css/museum.css` `.museum-`)

Both export `{ titleKey, mount, show(params), hide, render, destroy, helpers, TEXT }` and re-render on `language:changed`.

**classics** (`titleKey "classics.title"`): `mount` draws the shell, `show` loads `Ludus.Classics.load()` (skeleton, error state with retry).
Gallery of the 28 games (mini board of a signature position, bilingual title, players, opening, difficulty as dots + words, themes, number
of training positions, a "moves cross-checked" mark when the record has >= 2 sources and one names the score), search (accent-blind, every
word must match players, event, place, year, ECO, title, opening in both languages), difficulty / era (before 1900, 1900-1949, 1950-1999,
2000 on) / theme / position kind / sort, removable chips, result count (`role=status`), empty state. "Random mix" (max difficulty x 5/10/20,
remembered in `ludus.classics.mix.v1`) -> `Classics.random(...)` -> `startSession({kind:"classic", title, positions})`; the daily strip calls
`Ludus.Screens.home.startDaily()` (falls back to its own `kind:"daily"` session). Game page: `show({ game: id })` (also `gameId`/`id`) or the
hash `#/classics/<id>` (cold start captured at mount, `hashchange`, mirrored with `replaceState` after the shell's own mirror; ignored while
`Ludus.game.isActive()`). The replay uses `Ludus.Classics.story(id)` + `Ludus.chess` and draws with `Ludus.Board` (same board, slide animation
and theme as the play screen; `Ludus.ui.miniBoard` when it is missing): first / previous / play-pause / next / last (aria-disabled, so focus is
never lost), scrubber with a diamond on each training position, list of moves with a roving tab stop, flip, speed 0.5x / 1x / 2x, the
hand-written note of a moment after its move, a "try this position" cue before a training move (`startSession` with that one position),
arrow keys / Home / End / Space from the document (arrows inside the list also move focus; up / down jump a whole move). Auto play waits the
reading time of a note (`Reader.readingTimeMs`), pauses when the tab is hidden. "Train this game": count (5 / 10 / all), hints switch,
shuffle -> `startSession({kind:"classic", title, positions, options:{hints}})`; the sentence "you play the master's side..." is on the card.
The board squares are made non-focusable and the stage is `role=img` with a spoken description of the position.
QA pass: a load that hangs says so after 6 s ("taking longer than usual") and after 25 s becomes the error state with a retry that re-awaits the same
`Classics.load()` promise (an in-flight download is never abandoned); `document.title` names the game ("La Ópera - Partidas clásicas - Ludus Scaccorum");
every SAN drawn (move list, status, board label) goes through `Ludus.chess.localizeSan` and blurbs / notes through `Ludus.Classics.localizeQuotedMoves`
(`helpers.shownSan`, `showPly`; the replayed SAN stays English); names and events come from `Ludus.Classics.displayName / displayEvent` (the `names` /
`events` tables of the data) with local fallback tables only while the data is not loaded (a test keeps them equal to the data); a source link is named by
site and page (`helpers.sourceLinkLabel`), the source list is `lang="en"`; a player name wraps over up to 3 lines and carries its full name as `title`.

**museum** (`titleKey "museum.title"`, nav label "History"): accessible tablist (roles, roving tab stop, Left / Right / Home / End, panels built
on first use) with `timeline` (36 milestones grouped in 8 eras; each expands to the curiosities of its time and its source; era links; jump to
a year), `curiosities` (category pills with counts, accent-blind search, 24 at a time, "surprise me": a featured card, nothing is saved),
`school` (`Concepts.list()`, a miniBoard with the best-move arrow and the move in SAN, "mistakes it helps to avoid" from `Concepts.tags` /
`Insights.TAGS`, filter by tag) and `room` (`Reader.createCarousel`, created when the tab opens, destroyed when it closes or the screen hides;
`onlyWhile` keeps it from rotating in the background). `show({ tab })` and the hash `#/museum/<tab>` open a tab. A missing module (Facts,
Concepts, Insights, Reader, kit) turns that tab into a short notice. `document.title` follows the tab ("Escuela de ajedrez - Historia - Ludus Scaccorum");
below 18.5 rem of screen width (a 320px phone, or a larger text size: the query is in rem) the four tabs become two rows of two; example moves and moves
quoted in facts follow the notation setting like the rest.

### Screens `Ludus.Screens.notebook` and `Ludus.Screens.progress` (`js/ui/notebook.js`, `js/ui/progress.js`; `css/notebook.css` `.notebook-`, `css/progress.css` `.progress-`)

Both export `{ titleKey, mount, show(params), hide, render, destroy, helpers, TEXT }` (mount draws only the heading; the data is read in `show()`, again
on `profile:changed` / `notebook:changed` / `session:completed` while visible, and once more when a hidden screen is shown) and never call
`Profile.notebook.grade`: the game core's recorded round does.

**notebook** (`titleKey "notebook.title"`, nav label "Notebook"): the summary (due now, cards, cleared = box >= 3, new, the next review in words
and how many cards come back that day, a hand-written SVG of the six boxes with a table for screen readers), "Review N now" (N = 5 / 10 / 20, remembered
in `ludus.notebook.prefs.v1`) -> `Ludus.game.startSession({ kind: "review", title, mode: "solo", positions })`; with nothing due it offers "Practise
anyway" (the lowest boxes: passing early still moves the card up, the screen says so). **A position is built from a card** (`helpers.positionFromCard`):
`{ id: "notebook:<cardId>", fen, source: "notebook", cardId, meta, tags, phase }` plus `reference: { origin: "precomputed", lines }` and
`bestMoveUci` / `bestMoveSan` ONLY when the stored lines are a complete top-lines set (>= 2 lines, best first, every move legal, or as many lines
as legal moves); a card made under the fallback engine has none of that and the round analyses at the root. Weak spots (themes of the cards that are
not cleared) train one theme (`pickReviewCards mode "tag"`, due first) and the theme chips open the lesson (`Ludus.Screens.notebook.openConcept(tag,
{ train })`, a dialog with `Concepts` text and a mini board; the progress screen reuses it). The list filters by status (all / due / new / learning /
cleared), origin, theme, phase, how bad the mistake was (from the stored round of the card, else from the accuracy bands) and accent-blind text, sorts
by next review / most recent / worst first, shows 12 at a time, and each card has a board seen from the side to move with the best-move arrow, the
origin (your game names the opponent when the profile name is one of the players), your move against the best one, five box pips, the next review,
the stored lines and the review history, review-this-one and a confirmed removal. `show({ tag, status, source, phase })` presets the filters.
QA pass: after a confirmed removal the focus goes to the card now at that place in the list (the new last one when the last was removed, the list heading only when
none is left) and is scrolled into view; the review / lines / remove buttons are named "<title> (card n)" (`notebook.card.named`) because two cards of one game share a
title; SANs (your move, the best move, the engine lines, the lesson example) go through `Ludus.chess.localizeSan` (`helpers.shownSan`; `formatPv(fen, pv, chess, show)`
takes the display mapper as an optional 4th argument); the size control wraps its label above it when they do not fit.

**progress** (`titleKey "progress.title"`): level and XP bar, streak (with the "at risk" warning) and daily streak, the four numbers, a 12 week heatmap
(a grid computed by calendar arithmetic on local Y-M-D, so DST changes and New Year cannot shift a day; a list of the active days as its alternative),
the accuracy trend of the last 20 non-duel sessions (drawn at the width it is shown at, one tab stop with arrow keys, a tooltip on focus and on the
nearest session to the pointer, a table for screen readers) with the improvement between the first and the last positions, accuracy by phase and by
origin (a mark at 70, small samples labelled), the quality of the moves as one stacked bar whose legend repeats every number, the weakest themes
(only with `Profile.constants.MIN_TAG_SAMPLE` positions) linking to their lesson and to `router.show("notebook", { tag })`, the achievements catalogue
with progress, and the recent sessions. What is missing is said with numbers (`helpers.dataGaps`); nothing is invented (no rarity, no placeholders).
The profile switcher looks at another profile (`show({ profile })`) without changing the active one.
QA pass: `.progress-root` and `.progress-card` use an explicit `minmax(0, 1fr)` track (an implicit `auto` column grew to the widest unbreakable content and pushed the
whole page sideways at 320 px / 130 % text); the achievements filter reads "Todos / Logrados / Pendientes" and stacks as three full-width rows when its card is narrower
than 18 rem (a container query in rem); from 900 px the activity card puts its three numbers in a panel beside the heatmap and the quality legend spreads over the height of
the other two breakdown cards; the accuracy trend says that this accuracy is stricter than Lichess's (`progress.trend.scale`, docs/SCORING.md section 4).

### Screens `Ludus.Screens.settings` and `Ludus.Screens.account` (`js/ui/settings.js`, `js/ui/account.js`; `css/settings.css` `.settings-`, `css/account.css` `.account-`)

Both export `{ titleKey, mount, show, hide, render, destroy, TEXT, helpers }`; `mount` only stores the container and subscribes (nothing is drawn or read until
`show`), and both redraw on `language:changed`.

**settings** (`titleKey "settings.title"`): drawn from `Ludus.Settings.schema` / `groups`, so an entry it has never heard of still gets a control (a trailing
"Other settings" section). Five sections (`board`, `judge` = engine + scoring, `play` = clock + hints + mistakes, `sound`, `access`), a side nav on wide screens
(pills on small ones, `aria-current` follows the scroll), a "Current setup" chip row, a per-section Reset (with an Undo toast) and a global Reset all (confirm).
Controls by type: `boolean` -> `.switch`; `enum` -> a group of real radio inputs drawn as tiles (arrow keys, one tab stop; options with a
`settings.ui.desc.<path>.<value>` text become cards); `number` -> `.slider` with `aria-valuetext` (a plain number field for wide ranges); `showWhen` hides a
row. Every change goes to `Settings.set` (live) and the `settings:changed` listener repaints the controls IN PLACE (same nodes: focus and a drag survive),
sparing the board preview / the table when the changed path cannot affect them. Rich pieces: the theme picker (a `Ludus.ui.miniBoard` per theme) and a large
preview that follows `board.coords`, `board.lastMove` and `board.legalDots`; the "how the best move is decided" panel (a 3-step explainer, the wait the engine
preset means, `helpers.waitEstimate`, the sentence of what counts as best with the tolerance in cp) and the **live preview table**:
`helpers.previewRows({ scoring: Settings.scoringSettings(), multiPv, hintsEnabled })` runs `Scoring.assess` on ten canned cases (best, only move, equivalent,
20 cp, master, 50 / 150 / 400 cp, missed mate, best with a level 1 hint) with the lines cut to `engine.multiPv`; a case whose points changed flashes (not under
reduced motion). Clock: presets 60 / 90 / 180 / 360 s plus a number field that commits only complete in-range numbers while typing and clamps on leaving.
Sound: one test button per `Audio.names` (`aria-disabled` while sound is off, so the buttons stay focusable), the volume slider plays "move" on release, the
vibration test only where `navigator.vibrate` exists. A section's **Reset** shows a persistent notice under the section heading (a live region that exists all the
time, the very next Tab stop after the Reset button) with "Undo" and a close button instead of a five second toast; it closes when used, dismissed or when another
setting of the section changes, and the focus goes back to Reset (QA A11Y-005). A **Privacy** section (id `privacy`, after Accessibility) exists only when
`Ludus.game.savedDownloads` does: a switch "Remember my downloaded games" (off = delete what is kept now and keep nothing) and "Delete saved games now" (confirm).
The clock note says it is the usual clock (the wizard's time is for its session only); the analysis-time note appears when the chosen time is above the 3.5 s a round
ever uses; tiles put their check badge on the corner of the border so it never covers a label. Registered i18n: `settings.title|eyebrow|heading|sub`, `settings.section.*`, `settings.ui.*` (the schema's
own `settings.<path>.label|hint|option.<v>` come from `js/settings.js`).

**account** (`titleKey "account.title"`): profiles as cards (avatar, name, level badge, positions, active marker; create with a name + `Profile.constants.PALETTE`
colour and an optional switch, rename, switch, delete with the typed name; there is no recolour because `Profile` has no API for it; deleting the last profile
leaves a fresh empty one through `Profile.ensureActive()`), "Your data" (export through a Blob and `a[download]` named
`ludus-scaccorum-<name|all-profiles>-YYYY-MM-DD.json`; import through a real file input that is also the drop area: `Profile.importJSON(text, { dryRun: true })`
shows what is in the file, then `merge` (default) or `replace`; errors through `Profile.errorKey`; a 5 MB guard before reading; delete all with a typed word
(`BORRAR` / `DELETE`) that clears the profiles, the settings, every other `ludus.*` key except the language, the IndexedDB cache of downloaded games and
the local Google hint; the storage indicator counts the app's own `localStorage` keys), the Google sync card, "Install" and "About".
The **Google card** exists only when `Auth.isConfigured()`; otherwise a quiet informational card (no button) points the site owner to `docs/GOOGLE_SIGNIN.md`.
It is drawn from `helpers.syncModel(Auth.state())` and repaints from `Auth.onChange` (subscribed only while the screen is visible): signed out (one button,
`Auth.preload()` on pointer / focus), connecting, signed in (name as text, picture only if `helpers.safePictureUrl` accepts a googleusercontent.com https
URL, last sync, Sync now / Sign out / Sign out and revoke), syncing, error (`Auth.errorMessage(code)` in a `role="alert"`, Try again), expired or remembered after
a reload (Reconnect). Note the machine: an expired session is `status "signed_out"` + `error "reconnect-required"` + a remembered user. The install prompt is
captured when `js/ui/account.js` loads (the event fires early and once), `preventDefault()`ed, and used once from the button; iOS gets the Share hint and an installed
app the "already installed" line. QA pass: a first sign-in uploads nothing: when `Auth.state().linkRequired` the card asks which local profile goes to the Drive
(radios over `Profile.list()`, the active one preselected). It first looks at the Drive once (`Auth.remoteSummary()`, read-only) and says what is there;
"Save this profile to my Drive" asks for a confirmation that names the profile and says plainly that its whole history (and, for own-game rounds, the players'
usernames and game links) goes to the person's own Drive (and that what the Drive already holds is combined), then `Auth.linkProfile(id)`; "Bring my Drive progress
to this device" (`Auth.importFromDrive()`) is offered only when the Drive holds a profile (always when the Auth cannot look). Afterwards the card shows "You are
syncing <name>'s profile" with "Stop syncing this profile" (`Auth.unlinkProfile`), the profile card carries a "Synced with Google" mark, and "Sync now" stays hidden
until a profile is linked (an Auth without `linkRequired` never asks); the Google script is requested on `pointerdown` of the sign-in button, never on hover or focus; the
site owner's pointer of the "not configured" card shows only on localhost / 127.0.0.1 / `?debug`; profiles say they are not private; the export and Drive copy disclose
that own-game rounds keep the players' usernames and game links; About names the elected licence of the pieces; colour swatches are named by colour. Registered i18n: `account.*`.

### Tests

`scripts/tests/settings-ui.test.js` (34) and `scripts/tests/account-ui.test.js` (42): pure helpers, the preview values and how every setting moves them, both screens
against the real Settings / Profile / Scoring / kit in the fake DOM, a stand-in Auth for every sync state, the dialogs, the download / import round trip, degradation
without Scoring, Audio, the kit, Profile or Auth. Browser: `scripts/e2e/settings.js` (every setting changed through its control and persisted across a reload,
what each one applies to the real page and play screen, the preview against `docs/SCORING.md`, keyboard, reset, motion, 7 viewports x es / en with layout and contrast
probes, axe) and `scripts/e2e/account.js` (profiles, real downloads and the export -> delete -> import round trip, and the whole Google flow against an in-memory
mock of Google Identity, userinfo and Drive shared by two "devices"; helpers in `scripts/e2e/_settings-account-common.js`).

`scripts/tests/notebook-ui.test.js` (36) and `scripts/tests/progress-ui.test.js` (27): pure helpers (DST-safe days, filters, position building, chart
maths, heatmap grid with an injected clock) and both screens against the real Profile in the fake DOM. Browser: `scripts/e2e/track.js` (seeds a learner
through the real Profile API with `scripts/e2e/track-seed.js`: ~150 rounds over 40 days; a real review session graded by Profile; empty, partial and
at-risk states; 7 viewports x es / en; reduced motion; focus rings; axe on 46 states).

`scripts/tests/classics-ui.test.js` (36) and `scripts/tests/museum-ui.test.js` (18): pure helpers, the replay model of all 28 games, the
screens against the real data in the fake DOM. Browser: `scripts/e2e/learn.js` (gallery, replay, deep links, training launchers, history tabs,
the reading room against the real clock, 7 viewports x es / en, reduced motion, focus rings, axe).

`scripts/tests/kit.test.js` (28 tests, fake DOM in `scripts/tests/_uidom.js`) and `scripts/tests/ui-screens.test.js` (19: text parity,
home / daily / duel / landing / shell flows against the real Profile, Classics and Facts). Browser checks: Playwright with
`serviceWorkers: "block"`; axe-core injected in a `bypassCSP: true` context.
