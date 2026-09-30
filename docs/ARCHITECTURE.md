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

Ludus.util.clamp, escapeHtml, uid(), hashString(str)->hex, now(), 
Ludus.util.h(tag, attrs, ...children)     // safe DOM builder (attrs: class, dataset, aria-*, on*)
Ludus.util.formatDate(ts, lang), formatRelativeDays(ts, lang), formatDuration(ms)
Ludus.util.loadScript(path) -> Promise   // appends ?v=<Ludus.version>, dedupes, rejects on error
```

`app.js` keeps its own `t()`; when a key is not in `TRANSLATIONS` it falls back
to `Ludus.i18n.t(key)`. `app.js`'s `setLanguage()` calls
`Ludus.i18n.setLanguage()` so every screen re-renders.

### Bus events (payload shapes in section 9)

`language:changed {lang}` · `screen:changed {id, prev}` · `settings:changed {path, value, settings}` ·
`profile:changed {profileId}` · `session:started {session}` ·
`round:completed {round}` · `session:completed {session}` ·
`notebook:changed {count, due}` · `achievement:unlocked {achievement}` ·
`auth:changed {status}`

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
Allowing mate / missing a forced mate is always `blunder` with reason set.
Also exports `Scoring.qualityMeta(code) -> { order, colorToken, glyph }`,
`Scoring.summarize(assessments) -> { count, points, maxPoints, avgAccuracy, byQuality }`.

## 8. Insights, concepts (`js/insights.js`, `js/concepts.js`)

```js
Insights.positionFeatures(fen) -> { phase:"opening"|"middlegame"|"endgame", material:{w,b,diff}, legalCount, inCheck,
                                    hanging:{w:[sq], b:[sq]}, ... }
Insights.analyzeChoice({ fen, userUci, bestUci, assessment, lines?, masterUci? })
  -> { tags: string[],            // e.g. "hangs_piece","missed_capture","missed_mate","allows_mate","missed_check",
                                  //      "quiet_best","sacrifice_best","back_rank","fork_available","pin","development","king_safety"...
       phase,
       messages: [{ key, params }],   // i18n keys registered by insights.js; already ordered by importance, max 4
       conceptIds: string[] }          // ids into Concepts
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

## 14. Classics (`js/classics.js` + `js/data/classics.data.js`)

`scripts/build-classics.js` reads `data/classics/*.pgn` + `data/classics/notes.json`,
replays every game with `Chess` (any illegal move fails the build), analyses
selected positions with the vendored Stockfish in Node (depth ≥ 18, MultiPV 5)
and writes `js/data/classics.data.js` (`Ludus.ClassicsData = { v, engine, games:[...] }`).
`Ludus.Classics`: `load()` (lazy `loadScript`), `list()`, `get(id)`,
`positions(gameId, {count, side, maxDifficulty})` → `Position[]` (each with
`reference.lines`), `daily(dateKey)` → deterministic Position, `random(count, {exclude})`.

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

`scripts/generate-version.js` hashes **every file in `app.js`, `styles.css`,
`config.js`, `js/**`, `css/**`** plus the precache list, stamps the hash into
every local `<script>`/`<link>` `?v=` in `index.html`, into
`<meta name="ludus-version">`, and into `sw.js` (`CACHE_NAME`, `CORE_ASSETS`).
Lazily-loaded files are fetched with `?v=` (see `Ludus.util.loadScript`) and
cached at runtime by the service worker. `deploy-pages.yml` copies
`index.html app.js styles.css config.js sw.js manifest.json js css assets vendor`.
`scripts/smoke-check.js` verifies all of it (files exist, hashes coherent,
deploy copies every top-level directory that `index.html` references).

## 17. Testing

`npm test` = smoke check + the existing chess regression + every
`scripts/tests/*.test.js` (plain `assert`, no framework) + the classics data
validation. Browser-level checks live in `scripts/e2e/*.js` (Playwright is not
a project dependency; the scripts explain how to run them) and are **not** part
of `npm test`.
