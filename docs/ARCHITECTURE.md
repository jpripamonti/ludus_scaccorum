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
of `npm test`. `scripts/e2e/gate.js` is the release gate (landing -> home -> classics
-> a scored classic round -> leave, desktop and phone, fresh profile, no console
errors); `play-session.js` covers the game core in depth, `smoke.js` the boot and the
service worker precache.

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
* **Scoring**: accuracy curve has `CURVE_SCALE = 1.8` (see `docs/SCORING.md`); mate blunders cap accuracy at 10;
  `assess(input, options)` takes `options.isSacrifice`; extra fields `needsEvaluation`, `isMasterMove`, `hintCost`.
  `Scoring.compatQuality(code)` maps to the 8 legacy CSS/quality codes. Colour tokens used: `--color-gold`, `--color-perfect`,
  `--color-good`, `--color-dubious`, `--color-blunder`, `--color-text-muted`.
* **Engine**: `Engine.create({createTransport?, hashMb?, ...})` defaults to a Worker on
  `vendor/stockfish-18-lite-single.js`; results carry `aborted`, `timedOut`, `terminal`; `analyze` accepts `newGame`.
* **Insights**: tag `pin_or_skewer`; extra tags `discovered_attack`, `missed_promotion`, `open_file`, `outpost`,
  `trade_when_ahead`; messages are `{key, params, tag, raw}` where `params` are already localized (call
  `Insights.renderMessage(m, lang)` after a language switch). `analyzeChoice` also accepts `timing`.
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

### Tests

`scripts/tests/kit.test.js` (28 tests, fake DOM in `scripts/tests/_uidom.js`) and `scripts/tests/ui-screens.test.js` (19: text parity,
home / daily / duel / landing / shell flows against the real Profile, Classics and Facts). Browser checks: Playwright with
`serviceWorkers: "block"`; axe-core injected in a `bypassCSP: true` context.
