# Known issues and backlog

What the last review rounds found and this project has **not** fixed yet, so nobody has to rediscover it. Nothing here
blocks using the app. Items are grouped by what they need. "Reviewer" means an independent read-only audit of the
finished app (regression, visual, copy). Ids (V03, C-12, ...) are the reviewers' own.

## Needs a real device or browser (could not be verified here)

* Safari / iOS, Firefox and Android Chrome were never run: everything was measured in Chromium with touch emulation.
  Check the new landscape-phone layout, `100dvh`, container queries and `:has()` there first.
* No notched phone: `viewport-fit=cover` is deliberately off. Turn it on only with a device that reports safe-area insets.
* No real screen reader (NVDA, VoiceOver, TalkBack): live regions, `spokenSan` labels and focus moves were checked by
  reading the DOM only. Voice-control users may not match the visible move text to the spoken accessible name (WCAG 2.5.3).
* Lichess, Chess.com, Google sign-in and Google Drive were never reached (the sandbox blocks them): their flows are covered
  by mocked tests only. Google sign-in needs the owner's own OAuth client id (`docs/GOOGLE_SIGNIN.md`).
* axe-core was not available offline: the axe scenarios of the e2e scripts are skipped unless `LUDUS_AXE=/path/to/axe.min.js`.
* Engine timing on a slow phone: the learner's move is now searched at the same depth as the best line (it costs up to about
  twice the time of one search). Measured on a desktop only.

## Play screen and layout

* V03 Focus falls to `<body>` after "Explore board", after Next while the next position is being searched, and after the
  download consent: keyboard and screen-reader users lose their place. Move focus to the new control.
* V05 While the next own-game position is being searched the coach panel is an empty dark rectangle (no skeleton or
  sentence) and the turn line still names the previous position's side.
* V08/V09 With 130% text on a 320 px phone the duel position-count control overflows and the duel ready cover clips its button.
* V16 Two contrast values just under 4.5:1: the "Dubious" badge (4.40) and the translucent header's nav labels (4.14-4.41).
* V17 At 820x1180 (tablet portrait) the coach sheet is small compared with the free height.
* V18 In 568x320 / 667x375 landscape a 20-character name wraps to 4 lines in the turn card.
* 568x320 landscape is width-limited: the board is about 244 px.
* The first viewport of Museum, Settings, Notebook, Progress and Classics is mostly header, tab bar and title (V15).
* Tab bar drops its labels at 130% text on phones (V20); some strips scroll sideways with no fade (V14).
* Several mouse-only controls are under 44 px at desktop sizes (V21). Coarse pointers are fine.
* Warning and error toasts differ only by border colour (V19a); hover feedback is missing on a few controls (V19b).
* V10 Two region labels (storage banner, toast stack) do not follow a language switch.
* V11 The end-of-duel summary marks the winner "round winner"; V12/C-03 follow-ups on the settings preview rows.

## Engine and scoring

* REG-FALLBACK-1 With the 3-ply backup engine (when WebAssembly SIMD is missing) a move outside the stored lines can only
  lose about 1% at most; the score is optimistic there. The app already says the backup engine is weaker.
* REG-PF1-1 (low confidence, n=30) a move that is also in the stored depth-18 lines can score slightly differently from the
  same move re-searched; see docs/SCORING.md section 13.
* REG-CLOCK-1 While a duel position is covered, repainting the clock shows a meaningless value (cosmetic).
* REG-PROFILE-1 Stored profiles that already share a name can be kept but not "saved unchanged"; new duplicates are refused.
* REG-HIST-1 A reload on a hash route adds one history entry (pre-existing).
* REG-BOOT-1 A first-time English visitor gets `<html lang="es">` and the Spanish static landing until the script boots.

## Data and content

* C-08 The "Sources and verification" list on classic games shows internal build and fact-check notes and GitHub mirror
  paths; replace them with short curated citations.
* C-12 The "inaccuracy" quality is drawn with `!?` ("interesting" in chess notation); use a neutral glyph.
* The data classification still labels a few capture/check moves "quiet" in the classics (see docs/CLASSICS_DATA.md).
* Only one game played by a woman is in the classics (Judit Polgar - Kasparov, 2002). More would be welcome; each needs two
  independent sources for the score.
* The new Polgar game rests on five public PGN files of two lineages plus one search result; no source page could be opened
  from the sandbox. Re-verify against chessgames.com before trusting its annotations.
* Daily challenge: adding positions reshuffles which position is "today's"; use a stable per-position hash if that matters.

## Copy backlog (the reviewer's low-severity list, C-14 to C-43)

Terminology that still differs between screens (round clock names, "daily challenge" variants, "weak spots" vs "weaknesses",
"percentage points" vs "accuracy points"), Spanish quote style («» vs ""), serial comma in English lists, `%` spacing in
settings, a few awkward or peninsular phrasings, achievement descriptions that promise slightly more than is measured,
"Depth" explained as "moves ahead", Title Case landing title, and Spanish-only meta description and manifest. None changes
behaviour.

## Engineering

* PERF-012 No minification or bundling (no build step by design); the page loads about 40 small files.
* SEC-002 The engine runs from a blob worker wrapper (needs `worker-src blob:`); a same-origin worker file would allow a stricter CSP.
* SEC-013 `style-src 'unsafe-inline'` can be removed once the remaining inline style attributes move to CSS.
* UX-023 Optional profile PIN and a "what's your name?" prompt on first run are not implemented.
* Deploy workflow action SHAs are unpinned and the Playwright CI job is written but was never run in CI.
* Synced identity is not verified by us (no server): the Drive file belongs to whoever signs in.
