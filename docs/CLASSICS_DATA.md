# Classic games library: data, build and verification

"Learn from the masters": the learner picks a classic game (or a random mix) and,
position by position, plays the move they would choose as the side the master
played; they are scored against the engine's best move and are then shown the
master's move with its story. This document explains where that data comes from,
how it is rebuilt, how far it can be trusted and what is in it. The module
contract is in `docs/ARCHITECTURE.md` section 14.

## Files

| Path | What it is |
| --- | --- |
| `data/classics/games/<id>.pgn` | One game per file: standard tags + plain movetext (no comments, no NAGs). Hand-curated. |
| `data/classics/notes.json` | Per game: bilingual title, blurb and opening name, themes, difficulty, protagonist side, sources, optional moments; plus the two top-level display tables `names` and `events` (see "Display names"). Hand-written. |
| `data/classics/verification.json` | Generated. Per game: input hash, ply count, engine sanity result (blunder list, final-position check). |
| `data/classics/.cache/` | Git-ignored raw Stockfish output (resumable, deterministic rebuilds). |
| `scripts/build-classics.js` | The builder (`--check`, `--analyze`, `--candidates` modes). |
| `js/data/classics.data.js` | Generated, committed: `Ludus.ClassicsData` (about 270 KB, budget 700 KB). Loaded lazily by `Ludus.Classics.load()`. |
| `js/classics.js` | `Ludus.Classics`: loader and selector (list, get, positions, random, daily, story). |
| `scripts/tests/classics.test.js` | Validates the data, the selector and the build tooling. Part of `npm test`. |

## Adding or changing a game

1. Get the score from at least two independent sources (see "Verification standard").
   Save it as `data/classics/games/<id>.pgn`. `<id>` is kebab-case, for example
   `capablanca-marshall-1918`. Write only the tags Event, Site, Date, White, Black,
   Result, ECO (and Round if known) and plain movetext; use `????.??.??`-style
   placeholders (`1858.??.??`) for unknown date parts, never guess a date.
   ASCII names (Reti, Saemisch) are fine: display names come from the notes. A date is only as fine as it
   was confirmed: day or month precision needs evidence in the game's `sources` (and an entry in the
   `CONFIRMED` list of `scripts/tests/classics.test.js`), otherwise use `1858.??.??`.
2. Add an entry to `data/classics/notes.json` (`"games": { "<id>": { ... } }`):
   `title`, `blurb` (2-4 sentences, 80-700 characters), `opening`, all with `es` and
   `en` (Spanish in the rioplatense register when it addresses the learner);
   `themes` (ids from `Ludus.Classics.THEMES`), `difficulty` 1-3, `protagonist`
   `"w"|"b"` (the side the learner trains), `sources` (see below) and optionally:
   * `moments`: `[{ "ply": 33, "san": "Qxf3", "note": { "es": "...", "en": "..." } }]`.
     `ply` is the 0-based index of the move in the game (`moves[ply]`); `san` is checked
     against the score so an off-by-one fails the build. A moment is always kept as a
     training position and its note is shown with the master's move. The master's
     move must be within 30 cp of the engine's best at depth 18, otherwise the build
     fails and tells you to remove the moment.
   * `minPly` (default 6): no training positions before this ply. Use it when sources
     disagree about the early move order.
   * `target` (default about 30% of the protagonist's moves, clamped to 6-12),
     `include` / `exclude` (ply lists) and `sanity` (`{ "maxBlunders": n }`, a documented
     override for games the sanity pass flags).
   Every White, Black and Event tag of the new PGN also needs an entry in the top-level `names` /
   `events` tables of `notes.json` (the build fails otherwise, and fails on entries no game uses).
   Quoted moves in the texts use the piece letters of the text's language: English `K Q R B N`,
   Spanish `R D T A C` (see "Quoted moves and notation").
3. `node scripts/build-classics.js` (about 15-20 minutes for a cold cache on 3 engine
   processes, a few seconds when only text changed; set `LUDUS_BUILT_AT` to stamp a build
   date, the default is a fixed date so rebuilds are byte-identical).
   Run it in the background and read the log: the engine passes take a while.
4. `node scripts/tests/classics.test.js` and `node scripts/build-classics.js --check`.
5. Commit the PGN, `notes.json`, `verification.json` and the regenerated
   `js/data/classics.data.js` together. `--check` (also run by the tests) fails when
   any PGN no longer replays or when the committed data was built from different
   inputs (PGN and notes hashes) or by another builder version.

Bump `BUILDER_VERSION` in `scripts/build-classics.js` whenever the selection logic or
the output shape changes (3: the data carries `names` and `events`; 4: `phase` comes from `Insights.gamePhase`; 5: a capture, check or promotion that is not a tactic is `forcing`, no longer `quiet`).

Other modes: `--check` (no engine: PGNs replay, data not stale), `--analyze` (engine sanity
report only, needs no notes) and `--candidates` (adds a table of every protagonist move with
rank, scores, gap and computed kind, the quickest way to choose moments). `--jobs N` sets the
number of engine child processes (default 3, max 4); `--only id,id` restricts `--analyze`.

## Verification standard

A game is included only if all four hold.

1. **Legal.** Every move replays with `js/chess.js`. Enforced by the builder on every
   build and by `--check`; an illegal move fails with the game, the move and the
   position. SAN is regenerated by our own code, so the stored score is canonical.
2. **Result.** The final position agrees with the recorded result: checkmate for the
   winner, or a clearly decided position (the winner is at least +3.00 in a depth 18
   search of the final position, or mate) for a resignation. Enforced by the builder
   and recorded in `verification.json` (`final`).
3. **Facts.** Players, year, event and venue, result and the landmark moves named in the
   blurb and moment notes were confirmed by at least one web source, listed in the
   game's `sources` ("Facts ..." entries). The builder requires two or more source
   strings per game and the test requires a "Facts" one.
4. **No corrupted score.** A Stockfish pass (depth 12, MultiPV 3) over every position
   of the game must not show a stream of blunders: at most 6 eval drops of 300 cp or
   more. Isolated famous blunders (and the sacrifices of the romantic era, which the
   engine calls errors) are fine and are listed in `verification.json`. All 29 games are
   under the limit without overrides (the worst has 5, all in repetition and mate-score
   noise of one game).

Scores were reconstructed from several independent public PGN files: the PGN Mentor
archive (read from the public mirror `github.com/rozim/ChessData`) plus, for every game,
two or more files from other repositories (chessgames-style exports, hand-typed
annotated collections, Lichess study exports, the IBM match file in `python-chess`).
The files were compared move for move after replaying them with `Ludus.chess`; the
`sources` of each game name the ones that agree. Where copies disagree the difference
is documented in `sources` and never silently resolved (see "Known discrepancies").

## Limits of what was verified (please read)

* The network of the build environment was restricted. `WebFetch` was refused by the egress
  proxy for every chess site tried (chessgames.com, en.wikipedia.org, chessbase.com,
  365chess.com, pgnmentor.com, chesshistory.com, sparkchess.com, stmoroky.com, britannica.com,
  wikiwand.com), while public raw files on GitHub were reachable and `WebSearch` returned
  result summaries. So the scores were checked against public PGN files, and the headline
  facts (date, place, event, moves named in the text, quotations) were confirmed from
  **web search result summaries** of the pages listed in `sources`, not from a full read of
  those pages. Anything the summaries did not state is not asserted in the blurbs (exact
  rounds are left out where they were not confirmed, and dates are kept partial:
  `1857.??.??`).
* "Independent" means "different repositories and different file lineages"; several
  public files may descend from the same original database. Agreement between them
  rules out transcription errors, not an error present in all of them.
* The engine judges are Stockfish 18 lite (single thread, depth 12 / 16 / 18). Evaluations
  of deep sacrificial combinations at depth 12 are unreliable (for example Morphy's
  17...Qxf3 only shows up as best at depth 16 and above), which is why candidate
  detection uses depth 16.
* Blurbs and moment notes are short and factual by design. Moves that are famous but not
  the engine's best (for example 18.Bd6 in the Immortal Game or 14...Rh1 in Larsen-Spassky,
  which is 0.37 pawns behind the engine's choice at depth 16) are not training positions,
  because the learner would be marked down for playing the master's move.

## Fact-check pass (2026-09-30)

A second review of the blurbs and moment notes against the scores and against web search summaries found statements that were wrong or that no source supported. The corrections were applied in `data/classics/notes.json` and `js/data/classics.data.js` was rebuilt (`node scripts/build-classics.js`, everything served from the engine cache, so only the texts changed). Where a game's text was corrected, its `sources` carry a "Fact-check note" saying what was dropped or changed.

**Checked by code (replaying the scores with `js/chess.js`):**

* `capablanca-tartakower-1924`: 34.Bxf5 captures a knight and 34...gxf5 recaptures, a plain bishop-for-knight trade (material 13-13 before, 10-10 after). The material really given up is two pawns, on c3 and f4, both taken with check (35...Rxc3+, 37...Rxf4+), leaving White two pawns down after 38.Kg5. The blurb and the moment note for 34.Bxf5 said "a piece" was sacrificed; both were corrected.
* `larsen-spassky-1970`: Spassky gave up a knight (13...hxg3 leaves it to be taken by 13.hxg4) and a rook (14...Rh1) to create a passed h-pawn that promotes on f1. After 16...Qh4+ White has two legal replies (17.Kd1 and 17.Rf2), so the note no longer says the check "forces" 17.Kd1.
* `deepblue-kasparov-1997-g6`: at 8.Nxe6 Black has not castled (the king is still on e8); the sacrifice prevents castling. The Spanish note said it "dismantled the castled king" and was corrected; the English note was left unchanged here and aligned in the QA pass below.
* `botvinnik-capablanca-1938`: 30.Ba3 (Qxa3) and 31.Nh5+ (gxh5) are the two pieces given up.
* `byrne-fischer-1956`: for the queen Fischer gets a rook, two bishops and a pawn (material trace after 17...Be6).

**Dropped because no source could be found (and none was found in this pass either):**

* `steinitz-bardeleben-1895`: the vivid "looked at the move, glanced at Steinitz, left without a word" account and the nickname "the Pearl of Hastings" (the chessgames nickname is "The Battle of Hastings"). The walk-out is now told as the traditional account, with a note that details vary and that historians (Edward Winter) have questioned it; the moment note was changed the same way.
* `botvinnik-capablanca-1938`: the quotation attributed to Kasparov ("the game of his life") and "judged the most brilliant of the tournament".
* `byrne-fischer-1956`: "one of the ten best players in the United States" (replaced by "a tournament limited to twelve of the best players in the United States") and "the greatest game ever played by a junior" (replaced by the documented brilliancy prize and Hans Kmoch's name "The Game of the Century").
* `aronian-anand-2013`: the quotation attributed to Carlsen ("mind blowing"). Not replaced: the checkers saw a ChessBase "game of the year" remark and a New York Times "a game for the ages" line in summaries of the Wikipedia list, but they were not opened.
* `paulsen-morphy-1857`: Steinitz's praise of the combination.
* `kasparov-anand-1995-riga`: "the game provoked a lively debate about the gambit".
* `larsen-spassky-1970`: "regarded as the game of the event".
* `fischer-spassky-1972-g6`: "the great specialist in that opening".
* `rotlewi-rubinstein-1907`: Kasparov calling it Rubinstein's most famous creation (Kmoch's name stays).
* `saemisch-nimzowitsch-1923`: the Reuben Fine quotation. The checkers also found Nimzowitsch's own annotation of 25...h6 ("a brilliant move which announces the Zugzwang"); it was not added because it was not re-verified.
* `kasparov-topalov-1999`: "won the brilliancy prize".
* `opera-1858`: "autumn" (the scores carry no month); the venue is now said to be the opera during a performance of Norma.
* `reti-tartakower-1910`: "March" (the scores carry no month). The Tartakower and Chernev quotations and the Schachjahrbuch publication were kept but could not be re-checked against a second source.
* `evergreen-1852`: the magazine is now called "the German chess magazine" (the 1852 periodical was the Berliner Schachzeitung; "Deutsche Schachzeitung" is a later name).

**Still open (needs a source pass with web access):**

* `kasparov-anand-1995-riga`: the time control. The blurb states none. One search summary calls the 1995 Tal Memorial (Riga, 12-24 April, 11 players, Kasparov 7½/10 ahead of Anand 7) a PCA "Super Classic", which points to classical time controls, but that is not confirmed. The round (4) is left out because the stored PGN has no Round tag.
* `steinitz-bardeleben-1895`, `saemisch-nimzowitsch-1923`, `evergreen-1852`: the quotations still in the blurbs (Steinitz on the Evergreen) come from web search summaries and were not opened.
* Every "Facts" source in `notes.json` is a web search summary, not an opened page (the limits above still apply).
* `lasker-bauer-1889` and the other games not listed here: no change was needed.

## QA fact-check pass (2026-09-30, data fixer F7)

A review of the finished app (findings CNT-017 to CNT-020 and CNT-028) asked for the classic games' texts to be re-checked. This time `WebSearch` worked and `WebFetch` was again refused for every host (Wikipedia, chess.com, chesshistory.com, ChessBase, chessdailynews.com), so what follows rests on search-result summaries that cite those pages; no primary page was opened.

**Corrected or hedged (each game's `sources` carries a "Fact-check note" or "Date note"):**

* `capablanca-marshall-1918` (CNT-017): "Marshall kept his new gambit in reserve for years" is unproven (Edward Winter; the same correction is in the fact `openings-marshall-attack`), so the blurb now says so. Round 1 and Capablanca's unbeaten 10½/12 (+9 =3) were confirmed from the tournament standings in search summaries (Wikipedia, chess.com, ChessBase).
* `kasparov-topalov-1999` (CNT-018): the material trace (replaying the score with `js/chess.js`) shows only 24.Rxd4 and, much later, 37.Rd7 giving up a rook; 25.Re7+ is a check (the rook is not captured) and 30.Rxb7 captures a bishop. "Three rook sacrifices" became "an attack of sacrifices and checks", the two later moment notes no longer call those moves rook sacrifices, and the blurb gives what the board shows: Topalov's king is driven from c7 to d1. A test replays the game and fails if the claim comes back.
* `deepblue-kasparov-1997-g6` (CNT-020): the English moment note is now the same as the Spanish one: 8.Nxe6 exploits 7...h6; after 8...Qe7 9.O-O fxe6 10.Bg6+ the black king is stuck in the centre and cannot castle any more (the sequence is the game).
* `reti-tartakower-1910`: Edward Winter's page (via a search summary) says Tartakower called the game a "Freipartie" (casual game); the PGN event "Vienna" became "Casual game". The month ("März 1910") rests on a single annotation and was dropped from the date. Both quotations (Tartakower: "a splendid mate"; Chernev: "probably the most famous of all miniature games") and the publication in the Schachjahrbuch für 1910 (Ansbach, 1911) were confirmed there.
* `polugaevsky-nezhmetdinov-1958`: "sacrificed the queen and almost his whole army" is not what the board shows (the queen is the only big sacrifice) and "one of the most anthologised attacking games" had no source; both were dropped. Re-confirmed: the 18th RSFSR Championship, Sochi 1958, the white king driven to a5, and the name "Nezhmetdinov's Immortal". The month in the date (June) was not sourced and was dropped.
* `kasparov-anand-1995-riga`: "an opening almost absent from top-level chess for a century" became "rarely seen", with Wikipedia's "prompted a brief revival" (Evans Gambit article) as the only other claim.
* `karpov-kasparov-1985-g16`: "the win gave him the lead" was re-checked and **kept**: Wikipedia's match summary says Kasparov equalised in game 11 and took the lead in game 16, and the Christian Science Monitor headline reads "The game that gave the lead to challenger Kasparov" (the same summary that says 11½-9½ is about the situation after game 21). "the best game between the two" became "one of the best games of that match".
* `carlsen-nepomniachtchi-2021-g6`: "the longest game in world championship history" now says "so far"; the duration "7 h 45 min" became "nearly eight hours" because sources give 7 h 45 min and 7 h 47 min.
* `capablanca-tartakower-1924`: "cited in endgame books ever since" became "often cited in endgame books" (search summaries call it a staple of rook-ending books).
* `spassky-bronstein-1960`, `tal-larsen-1965`: the PGN dates carried a day (20 February, 8 August) that no source confirmed and PGN Mentor does not have (its files carry only the year). They keep the month, which follows from the schedule (the championship ran 26 January to 27 February and this was round 16 of 19; the match ran 23 July to 8 August and game 10 was the last one).
* Confirmed and kept: `alekhine-nimzowitsch-1931` (both wins over Nimzowitsch at Bled: 19 and 36 moves), `botvinnik-capablanca-1938` (Rotterdam, round 11), `short-timman-1991` (21 October 1991, round 4, Interpolis), `larsen-spassky-1970` (round 2 was played on 31 March; the match ran 29 March to 4 April), `aronian-anand-2013` (round 4, 15 January), `tal-larsen-1965` (game 10 decisive at 4½-4½, 5½-4½ final), `levitsky-marshall-1912` (queen attacked by the queen and two pawns), `saemisch-nimzowitsch-1923` (Copenhagen, March 1923), `lasker-bauer-1889` (first round, 26 August 1889), `rotlewi-rubinstein-1907` (Hans Kmoch's name), `byrne-fischer-1956` (17 October 1956, Kmoch's name), `lasker-thomas-1912` (Thomas British champion in 1923 and 1934).

**The dates** are now policed by a test: a game's `date` must be year-only or match the list of confirmed dates in `scripts/tests/classics.test.js`.

**One spelling per person** (CNT-028): the Spanish texts say Kaspárov, Kárpov, Kórchnoi and José Raúl Capablanca; `Karpov contra Kaspárov` and `Korchnoi-Karpov` were the two leftovers. A test rejects the English transliterations in any Spanish text.

**Not verified:** the exact day of `spassky-bronstein-1960` and `tal-larsen-1965`; the month of `reti-tartakower-1910` and `polugaevsky-nezhmetdinov-1958`; the time control of `kasparov-anand-1995-riga`; all the "Facts" sources remain search summaries.

**Done later (PX-2, see "Polish pass" below):** the library now has a game played by a woman, Judit Polgar-Kasparov, Moscow 2002.

## Polish pass (2026-10-01, data fixer polish-data)

**PX-1: one game-phase classifier.** `phaseOf` in `scripts/build-classics.js` now calls `Insights.gamePhase` (`js/insights.js`, loaded in Node after `js/chess.js`) instead of carrying its own copy of the rule, which lacked the "four pieces or fewer" clause. Seven of the 248 positions were middlegames by the copy and endgames by the app: `lasker-bauer-1889` ply 66, `botvinnik-capablanca-1938` plies 62 and 64, `carlsen-nepomniachtchi-2021-g6` plies 160, 196, 248 and 266. Because `classify` puts `endgame` before `tactic`, `only-move` and `quiet`, their `kind` became `endgame` as well (three tactics, two quiet moves, one only-move; the first of them, 32.Qg5+ in Botvinnik-Capablanca, has two queens and two knights left). The choice of positions and every difficulty were unchanged. `BUILDER_VERSION` is now 4. The phase counts of the 248 positions went from 36 / 201 / 11 to 36 / 194 / 18 (opening / middlegame / endgame); with the new game they are 36 / 199 / 25. `scripts/tests/classics.test.js` asserts that the stored `phase` of every position equals `Insights.gamePhase(fen)`, so a change to the rule fails the test until the data is rebuilt. The consumers read the stored field only (`Ludus.Classics.positions` -> `Position.phase`, the notebook phase filter, the progress by-phase chart) and their tests pass unchanged.

**PX-2: a game by a woman, Judit Polgar - Garry Kasparov** (`polgar-kasparov-2002`; Russia vs Rest of the World, Moscow, round 5, 9 September 2002, rapid 25 minutes plus 10 seconds a move, Berlin Defense, C67, 1-0 in 42 moves). It is the first game of the library played by a woman. What was checked:

* The score (84 plies) is identical move for move, replayed with `js/chess.js`, in five public files of two lineages: PGN Mentor (`github.com/rozim/ChessData`, `PgnMentor/Kasparov.pgn`; the same text is in `github.com/BD-Chess/bd-chessdb` and `github.com/Pranav-Bhatlapenumarthi/KibitzAI`) and a ChessBase-style export with `ECO C67t` and `EventDate 2002.09.08` (`github.com/ology/Chess-Inspector`, `github.com/LuisGoeppel/ChessFX`). A web search result for the opening moves returned the same full score. Every copy gives the date as 2002.09.09 and round 5.
* The facts (event, round, 9 September, rapid time control, Berlin Defense, "her first win against Kasparov") come from web search summaries of the chessgames.com page of the game, a chess.com article and the olimpbase.org page of the match. `WebFetch` was refused for chessgames.com and chessbase.com again, so no page was opened (the limits above apply).
* The engine pass found no corrupted score (no eval drop of 300 cp or more at depth 12) and the final position is clearly decided (White +3.59 at depth 18 after 42...Kc8). The build picked 12 training positions (5 quiet, 7 endgame by the phase rule; two moments, 24.Bf4 and 39.Rcc7, written from the board only and replay-checked by the quoted-move test).
* Dropped: a summary said Kasparov resigned "two pawns down". The material trace shows 4 pawns against 3 after 42...Kc8 (both white rooks on the seventh rank, which is why the engine sees +3.59), so the blurb does not say it, and a test fails if "two pawns" comes back. "The first time a woman beat the world number one" is in the summaries but not confirmed on a page, so the blurb says it "is usually presented as" that, in both languages.
* Not verified: the opening name beyond "Berlin Defense" and the ECO code C67 (both as the PGN files and the chessgames summary give them), the nickname the chessgames page carries (not used), and any annotation of the game: no commentary was used.
* Consequences: the library has 29 games and 260 positions (255 eligible for the daily challenge, which is a fixed shuffled list and so changed for every date: the position of a given day differs from before; a completed day stays completed because completion is stored per date). Tests that counted games now read the count from the data (`scripts/tests/classics-ui.test.js`, `scripts/e2e/learn.js`, `scripts/e2e/walkthrough.js`); the screen's table of country codes gained `RUS` (`js/ui/classics.js`).
* A latent bug found with this game's notes and fixed in `js/classics.js` (`quotedMoveRuns`): a quoted run that ends on a numbered move followed by punctuation ("27.Bxe5, and") was found a second time from its own move number, so a re-spelled text showed the move twice ("27.Bxe5Bxe5"). A regression test covers it, and another asserts that no text of the library lists a quoted move twice.

## Polish pass 2 (2026-10-01, data fixer r2-data)

**RD-1: American English in the English strings.** `js/facts.js` (texts, timeline titles, source hints), `data/classics/notes.json` (names, events, titles, blurbs, opening names, moment notes, sources) and the labels of `js/classics.js` follow American spelling: Defense (every opening name: "French Defense", "Sicilian Defense (Scheveningen)"...), analyzed, organized, recognized, favorite, colors, center, practice (the verb), traveled, canceled, math, toward, semifinal, Bolshoi Theater, leaped. `scripts/tests/_british.js` holds the word list (the `-our`, `-re`, `-ise`/`-yse`, `-ence`, doubled `l` families plus single words) and `scripts/tests/{facts,classics}.test.js` scan every English string with it, so a slip fails the test with the string and the American form. **Left on purpose** (titles and names as published, listed in `KEPT` of that helper with the reason, and the test fails if one is no longer used): "Encyclopaedia Britannica", "Encyclopaedia of Chess Openings", "World Chess Boxing Organisation", the French titles "L'Analyse des Échecs" and "Analyse du jeu des Échecs", and the Wikipedia article title "Sicilian Defence" in a source hint. No quotation in the data contained a British spelling, so no quotation had to be left alone. The docs outside the data keep their own prose. The Spanish texts are untouched by this item.

**RD-2: no English "match" in the Spanish.** See "Display names": three event forms and seven blurbs (Tal-Larsen, Larsen-Spassky, Fischer-Spassky, Karpov-Kasparov, Deep Blue-Kasparov, Polgar-Kasparov, Carlsen-Nepomniachtchi) and 17 Spanish fact and milestone texts of `js/facts.js` said "match"; all say "encuentro" (or "campeonato" / "duelo" in the event names) now, and a test rejects the word in any Spanish event name, blurb or note. The where-line of the classics screen (`whereParts`) names the city once: none of the new forms contains a city, so every game keeps its city and nothing is dropped.

**RD-3: the kind "quiet" was untrue for a fifth of its positions.** 18 of the 86 positions filed as `quiet` were a capture or a check (for example 21...Qxg6 in Aronian-Anand, 13.Nxh4 in Polgar-Kasparov, 26.Qg4+ in Lasker-Bauer), found when the label "Jugada tranquila" was read against the SAN. Builder 5 gives them their own kind, `forcing` ("Jugada forzante" / "Forcing move": a capture, a check or a promotion with no combination in sight, other good moves close). Nothing else moved: the same 260 positions, the same difficulties, phases and lines (compared field by field with the previous data; only `kind` of those 18 positions changed). The `quiet` sentence now says "No captures or checks" and a test replays every quiet SAN to keep it true. Counts of the 260 positions by kind: sacrifice 49, tactic 54, quiet 68, forcing 18, opening 28, endgame 25, only-move 18. Where kinds are shown: the "Position type" filter of the classics gallery and its chips, the "training" chip in the replay cue, the result card of the coach (label and sentence, after the answer) through `Classics.kindLabel` / `kindHint`, so a new code needs no UI change; `signatureOf` in `js/ui/classics.js` ranks kinds for the game card's board (an unknown code ranks last; the 29 signatures are the same with the new kind, checked, so nothing needs to change, and adding `forcing: 4` to its `rank` table would only make that explicit). The notebook filters and the progress chart do not use the kind (they use the tags of `Insights` and the phase), and no stored card or session keeps it (`classicKind` lives in the round context only).

**RD-4: the daily challenge reshuffles when the pool grows.** Documented and deferred, see "The daily challenge pool".

## Display names, events and quoted moves

**Display names (CNT-028).** The data keeps the raw PGN tags in `white`, `black`, `event`, `site`: they are stable keys (a notebook card stores `meta.players` as "Garry Kasparov vs Deep Blue"). The display forms live in two top-level tables of `notes.json`, copied unchanged into `Ludus.ClassicsData`:

```js
names:  { "Garry Kasparov": { es: "Garry Kaspárov", en: "Garry Kasparov" }, ... }   // keyed by the raw White/Black tag
events: { "Tal Memorial": { es: "Memorial Tal", en: "Tal Memorial" }, ... }        // keyed by the raw Event tag
```

One entry per person and per event, so the two languages spell each one a single way everywhere. The Spanish forms avoid the English word "match" (polish RD-2): `Candidates semifinal match` is "Semifinal de Candidatos", `World Championship match` is "Campeonato Mundial" and `IBM Man-Machine match` is "Duelo hombre contra máquina de IBM"; the Spanish blurbs and notes say "encuentro" (as do the Spanish facts of `js/facts.js`). `js/ui/classics.js` keeps a fallback table with the same forms (`EVENT_TEXT`), and a test of `classics-ui` compares the two for every game. The build fails when a tag has no entry or an entry is unused. For screens (owner of `js/ui/classics.js`: use these instead of the local `NAME_FIX` / `EVENT_TEXT` tables, which stay valid as a fallback while the data is not loaded):

* `Ludus.Classics.displayName(raw, lang)` and `Ludus.Classics.displayEvent(raw, lang)`: the es/en form of a raw tag; anything unknown (a person's own games, the data not loaded yet) comes back unchanged.
* `Ludus.Classics.list()` items carry `display: { white: {es, en}, black: {es, en}, event: {es, en} }` next to the raw tags.
* The site (`"Vienna AUT"`) is not in the tables: the screens turn the 3-letter country code and the city into words themselves.

**Quoted moves and notation (CNT-006, data side).** Blurbs and moment notes quote moves ("15.Bxh7+ Kxh7 16.Qxh5+"). Each language spells the pieces its own way in the stored text: Spanish `R D T A C` (rey, dama, torre, alfil, caballo; in Spanish `R` can only be the king), English `K Q R B N`; castling, pawn moves, `x`, `+`, `#` and `=` are the same. The Spanish facts (`js/facts.js`) follow the same rule. Tests replay every quoted move from the game's own position (`scripts/tests/classics.test.js`, "texts: every quoted move replays legally...") and check that both languages quote the same moves. A person who picked another notation in Settings (`notation.style`) gets the quotes re-spelled by `Ludus.Classics.localizeQuotedMoves(text, textLang)`, which finds the quoted runs (`Ludus.Classics.quotedMoveRuns(text)`) and writes each move with `Ludus.chess.localizeSan`; screens that show a blurb or note should pass it through this function (`textLang` is the language the text was written in). Without the function the text is still right for the default setting.

**The daily challenge pool (CNT-022, data side).** `Classics.daily` indexes a fixed shuffled list of the eligible positions (255 of the 260: forced mates in one are skipped), so the same position comes back after 255 days and "always different" is false. A larger pool helps: each game adds 6 to 12 positions (days before a repeat), so about 15 more games would cover a year. The copy ("without repeating for months") is the screens' owner's.

**Caveat: growing the library moves every day (polish RD-4, DEFERRED).** `Classics.daily(dateKey)` is `shuffled(eligible)[days % eligible.length]`. When a game is added `eligible.length` changes, so both the shuffle and the modulus change and *every* date, past and present, gets another position (measured: 0 of 365 dates keep theirs after 12 more positions). What survives: completion is stored per date (`daily.history`), so a finished day, the streak and the best streak are untouched; what changes is *which* position a date shows (a person who opens today's challenge before an update and again after it may see a different position on the same day). This is deliberate for now, because the two properties a stateless function can have are in conflict:

* "any N consecutive days never repeat" (tested: 30 different days in a row; promised by the copy "without repeating for months") needs a permutation of the pool, and a permutation of N items is not the permutation of N+12;
* "a date keeps its position when the pool grows" is what rendezvous hashing gives (the position of a date is the one with the highest `hash(date, positionId)`; measured: 338 of 365 dates unchanged after +12 positions, the rest take one of the new positions), but every day is then an independent draw and 221 of 300 sample 30-day windows contain a repeat. Ordering the pool by a stable per-position hash and keeping `days % N` does not help at all (0 of 365 dates unchanged, the modulus still moves).

A change that keeps both is possible but not small: rendezvous hashing with an exclusion window (`s(d)` = the highest-weight position that is not among `s(d-1) ... s(d-K)`, K about 120, computed forward from a fixed epoch day and memoized; a scratch simulation over a year with 12 more positions left 93% of the dates unchanged for K = 60, 89% for K = 120 and 80% for K = 200, and no position repeats within K days by construction), a fallback for dates before the epoch, a test for both properties and a decision about K. Until that is built: add games in batches (each batch reshuffles once), and for the screens' owner the cheap mitigation is to keep the id of the position served for a date in the daily record and prefer it over `Classics.daily` when it is still in the data.

## Data shape (`Ludus.ClassicsData`)

```js
{ v: 1, engine: "Stockfish 18 lite (depth 18)", depth: 18, builtAt: "<ISO>", builder: 5,
  inputs: { notes: "<hash>", games: { "<id>": "<hash of the PGN>" } },
  names:  { "<raw PGN White/Black tag>": { es, en } },       // display forms, see "Display names"
  events: { "<raw PGN Event tag>": { es, en } },
  games: [{
    id, title:{es,en}, white, black, event, site, year, date, result, eco,
    opening:{es,en}, blurb:{es,en}, themes:[...], difficulty, protagonist:"w"|"b",
    moves: ["e4", "e5", ...],                 // SAN, canonical
    positions: [{
      ply,                                    // 0-based index of the master's move
      fen,                                    // position BEFORE that move (= replay of moves[0..ply-1])
      uci, san,                               // the master's move
      kind, phase, difficulty,                // see below; phase is Insights.gamePhase(fen)
      note?: {es,en},                         // hand-written moment
      ms, mpv,                                // engine score of the master's move and its PV (uci, <= 8 plies)
      lines: [{ uci, san, score, pv }]        // depth 18, MultiPV 5, best first
    }],
    sources: [...] }] }
```

* Scores are centipawns from the point of view of the side to move; mates use the
  encoding of `docs/ARCHITECTURE.md` section 7: `+-(100000 - 1000 * min(50, n))`.
* `kind` (`only-move | tactic | forcing | sacrifice | quiet | endgame | opening`) and the
  position `difficulty` (1-3) are computed from the engine data, not hand-set:
  * `sacrifice`: the master's PV shows the mover giving up at least two pawns of
    material that stays given up over the last two exchanges (or ends in mate);
  * `endgame`: the position's phase is `endgame` by `Insights.gamePhase` (non-pawn material 16 or less, or four pieces or fewer, or no queens and 26 or less; see "Polish pass");
  * `tactic`: mate within 6, or a forcing move (capture, check, promotion) whose
    alternatives are at least 8 win-percent worse;
  * `only-move`: best line at least 12 win-percent better than the second line (the
    same threshold as `Scoring`); `opening`: up to move 10, no gap; then, for the rest,
    `forcing` when the master's move is a capture, a check or a promotion (the engine sees
    no combination behind it, otherwise it would be a `tactic`) and `quiet` when it is none
    of those. So a `quiet` position is never a capture or a check (a test replays the SAN of
    every one), which is what its label and sentence say (builder 5, polish RD-3).
  * difficulty rises for sacrifices, quiet only-moves and slow mates, and falls for
    mates in one or two and for large-gap captures or checks.
* `Ludus.Classics` turns a stored position into a `Position` of section 9 (source
  `"classic"`, `reference.lines`, `reference.origin: "precomputed"`, `classic{gameId, ply,
  kind, difficulty, note}`, `meta` like `app.js buildMeta`). Position ids are
  `classic:<hash of the FEN>` and are unique over the whole dataset (tested).

### How positions are chosen

For each game the builder looks at the protagonist's moves from `minPly` on and keeps a
move when the master's move is the engine's best or within 20 cp at depth 16 (30 cp at
depth 18), the position has at least 8 legal moves and the move is not a plain
recapture. Candidates are scored by the gap to the second line (capped), sacrifices,
forced mates against non-mates and hand-written moments (always kept); positions in
check with few replies are penalised and at most two "mate in one" positions are kept.
The final 6-12 are picked greedily with a proximity penalty so they spread over the
game. Then depth 18, MultiPV 5 is run on the shortlist and everything is re-scored on
that data before the final choice.

## Using the library from a screen

```js
await Ludus.Classics.load();                       // lazy: js/data/classics.data.js, ~270 KB, idempotent
Ludus.Classics.list();                             // metadata only, chronological
Ludus.Classics.get("opera-1858");                  // full frozen record (moves, positions, sources)
Ludus.Classics.positions("opera-1858", { count: 6, maxDifficulty: 2, shuffle: false });
Ludus.Classics.random(10, { exclude: [...], maxDifficulty: 3 });   // one per game before repeating
Ludus.Classics.daily("2026-10-01");                // same position all day, N different days in a row
Ludus.Classics.story("opera-1858");                // every ply with fen before/after, training flag, note
Ludus.Classics.movesText("opera-1858", 12);        // "1. e4 e5 2. Nf3 ..." for display
Ludus.game.startSession({ kind: "classic", title, mode, positions });  // section 9
```

`random()` and `daily()` skip forced mates in one (a fine finish for a game story, a poor
challenge on its own) unless `includeTrivial: true`. `positions()` keeps them, since a game
is played to its end. All randomness is injectable (`{ random: fn }`) for tests.

Labels are registered in Spanish and English through `Ludus.i18n` under the `cdata.` prefix:
`cdata.kind.<kind>`, `cdata.kindHint.<kind>`, `cdata.theme.<id>`, `cdata.difficulty.<1-3>`,
`cdata.playing.<w|b>` ("Jugás con las blancas" / "You play White"). The helpers `kindLabel`,
`kindHint`, `themeLabel`, `difficultyLabel` and `playingLabel` return the string for the
current (or a given) language. Blurbs, titles, openings and moment notes are `{es, en}`
objects: pick with `Ludus.i18n.lang()`.

## Provenance and licence

Only the moves and the standard tags (facts) were taken from the public PGN files; no
annotations or commentary were copied. Every title, blurb and note is original text. The
reference lines are Stockfish 18 lite output (`vendor/`, GPL, see `THIRD_PARTY_NOTICES.md`).

## Known discrepancies between public copies (handled)

* **Levitsky-Marshall 1912**: two lineages give `1.d4 e6 2.e4 d5` (used, the standard
  version) and `1.e4 e6 2.d4 d5`; same position from move 3.
* **Lasker-Bauer 1889**: `6.Nc3 Bb7 7.Nf3` (used) versus `6.Nf3 Bb7 7.Nc3`; same position
  from move 7. `minPly` keeps training positions after that point. Some editions stop
  after 33.Qg7+, the longer score (38 moves) is used.
* **Capablanca-Marshall 1918**: PGN Mentor and one other copy stop after 35.Bxf7+; two
  copies have the full 38 moves, which are used.
* **Steinitz-Bardeleben 1895**: the recorded score ends at 25.Rxh7+ (used); one copy
  continues to move 35.
* **Tal-Larsen 1965**: one copy (DHTMLGoodies) differs from move 18 on; the two copies
  that agree with PGN Mentor are used.
* **Immortal Game**: one copy (DHTMLGoodies) differs at move 18; the other six agree.
* **Evergreen Game**: two files carry a 40-ply variant; five files agree on 47 plies.

## Games

All 29 games passed the standard: they replay legally, the finals agree with the results,
the headline facts were confirmed (see each game's `sources` in `notes.json`) and the
engine pass found no corrupted score. "Copies that agree" counts the other public files
whose moves are identical to the stored score (see "Known discrepancies" for the
exceptions); "Engine blunders" is the number of eval drops of 300 cp or more in the
depth 12 pass (famous blunders and mate-score noise included). Sorted chronologically.

| Id | Game | Trains | Positions (moments) | Copies that agree | Engine blunders | Final |
| --- | --- | --- | --- | --- | --- | --- |
| `immortal-1851` | Adolf Anderssen - Lionel Kieseritzky, Casual game, London ENG, 1851 (1-0) | White | 7 (2) | PGN Mentor + 5 | 3 | checkmate |
| `evergreen-1852` | Adolf Anderssen - Jean Dufresne, Casual game, Berlin GER, 1852 (1-0) | White | 7 (2) | PGN Mentor + 4 | 1 | checkmate |
| `paulsen-morphy-1857` | Louis Paulsen - Paul Morphy, 1st American Chess Congress, New York USA, 1857 (0-1) | Black | 8 (2) | PGN Mentor + 3 | 5 | decided |
| `opera-1858` | Paul Morphy - Duke Karl of Brunswick and Count Isouard, Casual game, Paris FRA, 1858 (1-0) | White | 6 (3) | PGN Mentor + 7 | 2 | checkmate |
| `lasker-bauer-1889` | Emanuel Lasker - Johann Hermann Bauer, Amsterdam, Amsterdam NED, 1889 (1-0) | White | 11 (2) | 2 copies (+ PGN Mentor with a transposition) | 0 | decided |
| `steinitz-bardeleben-1895` | Wilhelm Steinitz - Curt von Bardeleben, Hastings, Hastings ENG, 1895 (1-0) | White | 8 (2) | PGN Mentor + 4 | 0 | decided |
| `rotlewi-rubinstein-1907` | Georg Rotlewi - Akiba Rubinstein, Lodz, Lodz POL, 1907 (0-1) | Black | 8 (3) | PGN Mentor + 8 | 0 | decided |
| `reti-tartakower-1910` | Richard Reti - Savielly Tartakower, Vienna, Vienna AUT, 1910 (1-0) | White | 6 (2) | PGN Mentor + 2 | 1 | checkmate |
| `levitsky-marshall-1912` | Stepan Levitsky - Frank James Marshall, 18th DSB Congress, Masters, Breslau GER, 1912 (0-1) | Black | 7 (1) | 3 copies (+ PGN Mentor with a transposition) | 0 | decided |
| `lasker-thomas-1912` | Edward Lasker - George Alan Thomas, Casual game, London ENG, 1912 (1-0) | White | 6 (2) | 6 copies (not in PGN Mentor) | 0 | checkmate |
| `capablanca-marshall-1918` | Jose Raul Capablanca - Frank James Marshall, New York, New York USA, 1918 (1-0) | White | 11 (0) | 2 copies (+ PGN Mentor, 2 moves shorter) | 0 | decided |
| `saemisch-nimzowitsch-1923` | Friedrich Saemisch - Aron Nimzowitsch, Copenhagen, Copenhagen DEN, 1923 (0-1) | Black | 8 (1) | PGN Mentor + 2 | 0 | decided |
| `capablanca-tartakower-1924` | Jose Raul Capablanca - Savielly Tartakower, New York, New York USA, 1924 (1-0) | White | 12 (2) | PGN Mentor + 3 | 0 | decided |
| `alekhine-nimzowitsch-1931` | Alexander Alekhine - Aron Nimzowitsch, Bled, Bled YUG, 1931 (1-0) | White | 6 (1) | PGN Mentor + 3 | 0 | decided |
| `botvinnik-capablanca-1938` | Mikhail Botvinnik - Jose Raul Capablanca, AVRO, Rotterdam NED, 1938 (1-0) | White | 12 (3) | PGN Mentor + 5 | 1 | decided |
| `byrne-fischer-1956` | Donald Byrne - Robert James Fischer, Third Rosenwald Trophy, New York USA, 1956 (0-1) | Black | 12 (3) | PGN Mentor + 7 | 2 | checkmate |
| `polugaevsky-nezhmetdinov-1958` | Lev Polugaevsky - Rashid Nezhmetdinov, 18th RSFSR Championship, Sochi URS, 1958 (0-1) | Black | 10 (2) | PGN Mentor + 5 | 3 | decided |
| `spassky-bronstein-1960` | Boris Spassky - David Bronstein, 27th USSR Championship, Leningrad URS, 1960 (1-0) | White | 7 (1) | PGN Mentor + 2 | 0 | decided |
| `tal-larsen-1965` | Mikhail Tal - Bent Larsen, Candidates semifinal match, Bled YUG, 1965 (1-0) | White | 11 (0) | PGN Mentor + 2 | 0 | decided |
| `larsen-spassky-1970` | Bent Larsen - Boris Spassky, USSR vs Rest of the World, Belgrade YUG, 1970 (0-1) | Black | 6 (2) | PGN Mentor + 3 | 1 | decided |
| `fischer-spassky-1972-g6` | Robert James Fischer - Boris Spassky, World Championship match, Reykjavik ISL, 1972 (1-0) | White | 12 (0) | PGN Mentor + 2 | 0 | decided |
| `karpov-kasparov-1985-g16` | Anatoly Karpov - Garry Kasparov, World Championship match, Moscow URS, 1985 (0-1) | Black | 12 (2) | PGN Mentor + 3 | 1 | decided |
| `short-timman-1991` | Nigel Short - Jan Timman, Interpolis, Tilburg NED, 1991 (1-0) | White | 10 (2) | PGN Mentor + 3 | 0 | decided |
| `kasparov-anand-1995-riga` | Garry Kasparov - Viswanathan Anand, Tal Memorial, Riga LAT, 1995 (1-0) | White | 8 (0) | PGN Mentor + 2 | 0 | decided |
| `deepblue-kasparov-1997-g6` | Deep Blue - Garry Kasparov, IBM Man-Machine match, New York USA, 1997 (1-0) | White | 6 (1) | PGN Mentor + 3 | 0 | decided |
| `kasparov-topalov-1999` | Garry Kasparov - Veselin Topalov, Hoogovens, Wijk aan Zee NED, 1999 (1-0) | White | 12 (3) | PGN Mentor + 5 | 2 | decided |
| `polgar-kasparov-2002` | Judit Polgar - Garry Kasparov, Russia vs Rest of the World, Moscow RUS, 2002 (1-0) | White | 12 (2) | PGN Mentor + 4 (two lineages) | 0 | decided |
| `aronian-anand-2013` | Levon Aronian - Viswanathan Anand, Tata Steel, Wijk aan Zee NED, 2013 (0-1) | Black | 7 (1) | PGN Mentor + 2 | 1 | decided |
| `carlsen-nepomniachtchi-2021-g6` | Magnus Carlsen - Ian Nepomniachtchi, World Championship match, Dubai UAE, 2021 (1-0) | White | 12 (0) | PGN Mentor + 2 | 0 | decided |

## Considered and not included

No game was dropped for failing the verification standard. The list stops at 29 to keep
exactness ahead of volume. These were considered and left out for now, none of them
cross-checked: Karpov-Kasparov 1985 game 24 and Kasparov-Anand 1995 game 10 (both are in
PGN Mentor), Carlsen-Caruana 2018 (round 13.1 in the collection) and Ding-Gukesh 2024 game 14
(each listed in one public collection only), Bogoljubow-Alekhine (Hastings 1922) and
Capablanca-Alekhine 1927 game 34 (present in public collections, not analysed).
Adding any of them means following "Adding or changing a game".

