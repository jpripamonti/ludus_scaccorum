# History and curiosities: sources and verification

This file backs the claims in `js/facts.js` (`Ludus.Facts`, see `docs/ARCHITECTURE.md` section 12). Every fact and every timeline milestone has a row: its id, its year, a verification status, the short source hint stored next to the text in `js/facts.js`, and notes on what was checked.

Accuracy comes first: a claim only stays when it is well documented. Where the record is disputed or anecdotal the text itself says so ("cuenta la anécdota", "reportedly", "según los relatos").

## How this was checked

* Checked on 2026-09-30 with web searches (WebSearch). The page-fetch tool was blocked for Wikipedia, Britannica, FIDE, chessgames.com and chessprogramming.org, so **primary pages were not opened**: the confirmations below come from search-result summaries that cite those sites and others (Wikipedia, Britannica, FIDE, ChessBase, chess.com, IBM, museum catalogues, news archives). A claim confirmed by several independent results is marked `WEB`.
* Claims that can be checked by running code are checked in `scripts/tests/facts.test.js` (marked `CODE`): the move sequences quoted in the texts are replayed with `js/chess.js`, the perft counts, the Elo percentages and the eight-queens count are recomputed, and the score arithmetic (for example 12.5-7.5, 144 games) is asserted.
* `KNOWN` means standard, widely documented history that was not re-fetched in this session (confidence high; the notes say which parts).
* `HEDGED` means the record is disputed, anecdotal or an estimate, and the text is worded that way on purpose.

### Status legend

| Status | Meaning |
| --- | --- |
| `WEB` | Confirmed by web searches (secondary sources) |
| `CODE` | Also checked by code in the test suite |
| `KNOWN` | Standard history, not re-fetched |
| `HEDGED` | Disputed, anecdotal or an estimate; worded accordingly |

## Fact-check pass (2026-09-30)

A second, independent review of every fact and milestone produced a list of findings (wrong, imprecise, doubtful, ok-note). This pass applied them. Each row that changed ends with a "Fact-check 2026-09-30" note saying what changed and why.

**Limits of this pass (please read).** The WebSearch budget of the session was already exhausted (200 of 200 calls) when the pass started, and `WebFetch` was refused by the egress proxy for every host tried (en.wikipedia.org, patents.google.com, www.history.com, en.wikisource.org, www.fide.com, archive.org). So the findings could **not** be re-verified against the web here. They were applied on the strength of (a) the checkers' search-result summaries, (b) the author's background knowledge of chess history, and (c) code where possible (the classic games were replayed with `js/chess.js`, see `docs/CLASSICS_DATA.md`). Almost every change narrows or hedges a claim ("one of the oldest", "American-born", "officially recognised", "at least", "usually explained"), which is the safe direction; the few that add a specific are marked below. A source pass with web access should re-check them.

Changes that add a specific claim and rest on the checkers' summaries or background knowledge, not on a page opened in this pass:

* `tl-lucena` and `origins-lucena`: Francesc Vicent's 1495 Llibre dels jochs partits is lost (the text says an earlier book "se perdió").
* `champions-keres`: 1953 and 1962 shared second places (search results) and sole second places in 1956 and 1959 (background knowledge).
* `champions-menchik-title`: the V-1 flying bomb on her London home.
* `machines-stockfish-2008`: Marco Costalba as the developer of the Glaurung fork.
* `culture-armenia-schools`: grades 2 to 4.
* `culture-chessboxing`: the first world championship in Amsterdam in 2003.
* `culture-caissa`: written in 1763, published in 1772.
* `openings-sicilian`: Greco's analysis dates from the early 17th century (1623).

Findings that needed no text change: the coverage notes (`_coverage`, `meta-verification-limits`) only list what the checkers could not confirm (chaturanga and chatrang details, Einsiedeln, the etymology of ajedrez, FIDE 1924, promotion, Tal 1960, Kramnik 2000, Carlsen, Ding, Gukesh, Steinitz 12.5-7.5, Alekhine's death, Keres 1956 and 1959, the Karpov-Kasparov totals, Prinz 1951, Ebbinghaus spacing, Bezzel 1848 and the 92/12 solutions, the knight's-tour count, the FIDE founding date, Buenos Aires 1939, Carlsen's 2882, the Berlin narrative, NNUE and tablebase dates). Treat those as `KNOWN`, not `WEB`, until someone re-checks them.

## Rules for adding a fact

1. One to three sentences, at most 260 characters per language, Spanish (rioplatense, "vos" wherever the text talks to the reader) and English.
2. Add a `source` hint (a type of source or a reference in words, never a URL that was not opened) and a row here with the id, the status and what was checked. `scripts/tests/facts.test.js` fails when an id is missing from this file.
3. Prefer documented facts. Avoid myths, folklore and precise numbers that cannot be sourced. If a story is popular but doubtful, either leave it out or word it as a story.
4. Anything that can rot (records, "the youngest", "the only woman") carries a hedge ("hasta ahora", "so far") and is listed under "Things that can go stale".

## Audit of the previous facts

The 46 facts that `app.js` showed while the engine was thinking (`ROUND_THINKING_FACTS` and its English twin) were reviewed one by one.

| Old fact | Outcome | New id | Why |
| --- | --- | --- | --- |
| Lasker, 27-year reign | kept | `champions-lasker-reign` | Reworded to 'casi 27 años' (26 years 11 months). |
| Kasparov lost to Deep Blue in 1997, 'first time a reigning champion fell to a machine' | corrected | `machines-deepblue-1996`, `machines-deepblue-1997` | The first loss of a game to a computer at tournament time controls was in 1996; 1997 was the first lost match. |
| Marshall kept a sacrifice for years against Capablanca (1918) | corrected | `openings-marshall-attack` | 'Saved for years' is unproven (Edward Winter); the text now says so. |
| Opera Game at the 'Teatro de la Ópera de París' | corrected | `champions-opera-game` | A box at the Italian Opera in Paris during Norma; consultation game, mate on move 17. |
| Korchnoi accused Karpov's team of yogurt signals | corrected | `champions-korchnoi-yogurt` | His seconds protested one blueberry yogurt and rules were set; framing made neutral. |
| Carlsen beat Bill Gates in a promotional game under two minutes | corrected | `culture-carlsen-gates` | It was a TV show (Skavlan, January 2014) with a time handicap for Carlsen. |
| Rubinstein strongest in 1912; WWI and money stopped the match | corrected | `champions-rubinstein-1912` | WWI cancelled the agreed 1914 match; 'financial problems' is not supported and was dropped. |
| Alekhine died as champion | kept | `champions-alekhine-died` | Confirmed. |
| Fischer won 20 games in a row (Interzonal and Candidates) | kept | `champions-fischer-streak` | Confirmed (Britannica); added the two 6-0 sweeps. |
| Vera Menchik 'club': she said losers joined it | corrected | `champions-menchik-club` | It was Becker's joke, and the story may be apocryphal. |
| Kramnik and the Berlin Defence, 2000 | kept | `champions-kramnik-2000`, `openings-berlin-wall` | Added the score (+2 =13 -0). |
| Bronstein one game from the title, 1951 | corrected | `champions-bronstein-1951` | Drew 12-12 and led 11.5-10.5 after 22 games; the champion kept the title on a tie. |
| Keres: five times among the leaders of the Candidates | corrected | `champions-keres` | Second or shared second in 1953, 1956, 1959 and 1962 (see the fact-check note in `champions-keres`); the old 'five' seems to count the 1938 AVRO near-miss as well. |
| Najdorf: 45 blindfold games, 39-4-2 (1947) | kept | `records-najdorf-blindfold` | Added place, date and duration. |
| Judit Polgár No. 8 and 'strongest woman in history' | corrected | `champions-polgar-top10` | Kept the verifiable part (No. 8 in 2005, only woman in the top ten); the superlative is an opinion. |
| Morphy's law degree at 19 | kept | `champions-morphy` | Confirmed (LL.B., 7 April 1857). |
| Botvinnik the electrical engineer | kept | `champions-botvinnik-engineer` | Confirmed (doctorate 1951). |
| Capablanca and the Cuban diplomatic service | kept | `champions-capablanca-life` | Refined: roving ambassador from 1913. |
| Lasker's doctorate and philosophy | kept | `champions-lasker-math` | Kept the doctorate (Erlangen, 1902) and added the Lasker-Noether theorem; the philosophy remark was dropped for space. |
| Euwe the mathematician and professor | kept | `champions-euwe` | Added the 1926 doctorate and FIDE presidency. |
| Smyslov the baritone | kept | `champions-smyslov-singer` | Softened to what the sources support. |
| Korchnoi stateless | corrected | `champions-korchnoi-stateless` | Stateless in the late 1970s, Swiss citizen around 1980 (sources disagree; see the fact-check note in `champions-korchnoi-stateless`). |
| Reshevsky child prodigy | kept | `champions-reshevsky-accountant` | Merged with the accounting fact. |
| Alekhine studied law in Paris | dropped | - | His claimed doctorate could not be documented (searches found no evidence of a conferred degree). Guarded by the test. |
| Taimanov the pianist | kept | `champions-taimanov-pianist` | Confirmed. |
| Reuben Fine the psychologist | kept | `champions-fine-psychologist` | Confirmed (PhD 1948). |
| Vidmar the electrical engineer | kept | `champions-vidmar-engineer` | Confirmed. |
| Capablanca learned by watching his father | kept | `champions-capablanca-life` | Worded 'by his own account'. |
| Lasker demanded high fees | dropped | - | Interpretive and unsourced. |
| Reshevsky studied accounting | kept | `champions-reshevsky-accountant` | Merged (see above). |
| 1984-85 match halted with Karpov 5-3 up | kept | `champions-1984-halted` | Added the 48 games. |
| Ding Liren 100 games unbeaten (2017-18) | corrected | `records-ding-unbeaten` | Added exact months, the 29+71 split and who ended it. |
| Mishra, youngest grandmaster | kept | `records-mishra` | Confirmed (FIDE news). |
| Susan Polgar, first woman GM by norms (1991) | kept | `champions-polgar-1991` | Confirmed. |
| Nakamura, elite player and streaming superstar | corrected | `culture-streaming` | Softened: no superlatives or numbers. |
| GothamChess nickname comes from New York | dropped | - | Unverified etymology. Guarded by the test. |
| Botez Gambit joke | dropped | - | Internet joke whose origin could not be verified. Guarded by the test. |
| Pepe Cuenca is an engineer | dropped | - | Unverified. Guarded by the test. |
| BotezLive as mass entertainment | dropped | - | Vague and promotional. |
| Shannon number: more games than atoms | corrected | `records-shannon-number` | It is a lower-bound estimate of game-tree complexity, not an exact count of games. |
| Tal's hypnotic stare | dropped | - | Folklore. Kept the verifiable 1960 title (champions-tal-1960). |
| The Turk: 84 years, played Napoleon and Franklin | corrected | `machines-turk`, `machines-turk-napoleon` | The '84 years' hid long dormant periods; the famous opponents are worded as reported accounts. |
| First Earth-space game, Soyuz 9 (1970) | corrected | `culture-space-1970` | It was a consultation game against Kamanin and Gorbatko, about six hours, drawn. |
| Steinitz could give God a pawn and still win | dropped | - | An anecdote; Edward Winter notes the columnist who published it admitted it was untrue. Guarded by the test. |
| Longest official game, 20 h 15 min | kept | `records-longest-game` | Kept with 'que se conoce'; the game predates rule changes. |
| Fischer's Chess960 | kept | `rules-chess960` | Added the Buenos Aires announcement (1996). |

Summary: 46 old facts: 22 kept, 16 corrected, 8 dropped.

## Facts

### Origins (`origins`, 13)

| Id | Year | Status | Source hint (as stored) | What was checked |
| --- | --- | --- | --- | --- |
| `origins-chaturanga` | c. 600 | WEB | Encyclopaedia Britannica, 'Chess'; H. J. R. Murray, A History of Chess (1913); Wiktionary 'chaturanga' | Chess appears to descend from chaturanga, developed in India in the 6th century; Sanskrit 'four parts/divisions'; in epic poetry a battle formation of infantry, cavalry, elephants and chariots. |
| `origins-persia-chatrang` | c. 600 | WEB HEDGED | Chatrang-nāmag (Middle Persian text) as summarised in Wikipedia 'Chatrang' and Murray, A History of Chess | Chatrang-nāmag: the narrator Bozorgmehr says chess was brought to Persia from India in the reign of Khosrow I; the earliest texts on chess origins date from about the early 7th century. The text calls the story legendary. |
| `origins-etymology-ajedrez` |  | WEB | Wiktionary 'ajedrez' (etymology); Encyclopaedia Britannica, 'Chess' | Wiktionary: Spanish ajedrez < Old Spanish axedrez < Arabic šiṭranj (via Andalusian Arabic) < Middle Persian čatrang < Sanskrit caturaṅga. |
| `origins-etymology-checkmate` |  | WEB | Online Etymology Dictionary 'checkmate'; Wiktionary 'checkmate' | Etymonline and Wiktionary summaries: Old French eschec mat < Arabic/Persian shāh māt; Persian māt = helpless/at a loss; 'the king is dead' is the popular (folk) reading. |
| `origins-shatranj-islam` | c. 800 | KNOWN | Encyclopaedia Britannica, 'Chess'; Murray, A History of Chess (1913) | General history (Britannica, Murray). Deliberately vague ('several routes, including Muslim Spain'). The year 800 is only an 'approx' marker for the Abbasid-era flowering. |
| `origins-einsiedeln` | c. 1000 | WEB | Wikipedia 'Versus de scachis' (Einsiedeln Verses); Murray, A History of Chess (1913) | Einsiedeln Verses ('Versus de scachis'): earliest Middle Latin reference to chess, most likely written around 1000 (some sources say c. 997) and preserved at Einsiedeln Abbey, Switzerland. |
| `origins-alfonso-x` | 1283 | WEB | Wikipedia 'Libro de los juegos'; manuscript T.I.6, Real Biblioteca de El Escorial | Libro de los juegos completed in 1283 for Alfonso X; earliest European treatise on chess and the most extensive medieval compendium of chess problems; earliest manuscript El Escorial T.I.6. Fact-check 2026-09-30: 'the oldest' became 'one of the oldest': the Lombard Bonus Socius compendium is dated only to the second half of the 13th century and may be contemporary or earlier. |
| `origins-cessolis` | c. 1300 | WEB | Project Gutenberg, 'The Game and Playe of the Chesse' (Caxton); Morgan Library incunabula record | Cessolis, Liber de moribus hominum et officiis nobilium super ludo scacchorum (late 13th to early 14th century, hence 'around 1300'); Caxton's English translation printed in 1474 (Bruges or Utrecht, after 31 March 1474), second edition 1483. Fact-check 2026-09-30: Spanish spelling 'Jacobo de Cessolis', matching the Latin form and the English text. |
| `origins-old-pieces` |  | KNOWN | Encyclopaedia Britannica, 'Chess'; Murray, A History of Chess (1913) | Standard description of shatranj/medieval chess: ferz (vizier) one square diagonally, alfil two squares diagonally with a jump. Not re-fetched. |
| `origins-scachs-damor` | c. 1475 | WEB | Wikipedia 'Scachs d'amor'; ChessBase, 'Scachs d'amor: the empowered queen' | Poem by Castellví, Fenollar and Vinyoles, probably 1475, Valencia; manuscript discovered in 1905; the earliest documented game with the modern queen and bishop. Fact-check 2026-09-30: the text now says the game is allegorical (Mars against Venus, 64 stanzas per the checkers); the dating to about 1475 rests on an astronomical reference in the poem (a planetary conjunction of 30 June 1475, per the checkers). |
| `origins-lucena` | c. 1497 | WEB | Wikipedia 'Luis Ramírez de Lucena' and 'Francesc Vicent'; ChessBase auction report on the surviving copy | Repetición de amores y arte de ajedrez, Salamanca, c. 1497; the oldest surviving printed book on how to play chess; describes both the old and the new versions of the game. Fact-check 2026-09-30: 'tratado / chess book' narrowed to 'the oldest surviving printed book on how to play chess' (see tl-lucena). |
| `origins-lewis-chessmen` | c. 1150 | WEB | British Museum collection (1831,1101); Metropolitan Museum 'The Game of Kings' (2011); Wikipedia 'Lewis chessmen' | Found in 1831 on the Isle of Lewis; walrus ivory and whales' teeth; 12th century; generally believed made in Norway (Trondheim proposed); most pieces in the British Museum, 11 in Edinburgh. Counts differ between sources, so the text quotes no numbers. |
| `origins-bishop-names` |  | KNOWN | Wiktionary 'alfil', 'слон', 'fou'; Encyclopaedia Britannica, 'Chess' | Etymology-level knowledge: alfil < al-fīl 'the elephant'; Russian слон 'elephant'; French fou 'fool/jester'. Not re-fetched. |

### Champions (`champions`, 38)

| Id | Year | Status | Source hint (as stored) | What was checked |
| --- | --- | --- | --- | --- |
| `champions-steinitz-1886` | 1886 | WEB | Wikipedia 'World Chess Championship 1886'; Chess.com, 'Steinitz: the official World Chess Champion' | 11 January to 29 March 1886 in New York, St. Louis and New Orleans; 12.5-7.5 (10 wins, 5 losses, 5 draws). |
| `champions-lasker-reign` | 1894 | WEB | Wikipedia 'Emanuel Lasker'; Chess.com, '27 years as world champion' | Champion 1894-1921, the longest reign of any officially recognised champion (26 years 11 months, so 'nearly 27'). Fact-check 2026-09-30: qualified to 'a champion officially recognised'. Some authors count Steinitz as champion from 1866, which would make his reign longer than Lasker's. |
| `champions-lasker-math` | 1905 | WEB | MacTutor History of Mathematics, 'Emanuel Lasker'; Wikipedia 'Primary decomposition' | Doctorate at Erlangen in 1902; Lasker (1905) proved primary decomposition for polynomial rings and convergent power series rings, generalised by Emmy Noether in 1921. |
| `champions-capablanca-unbeaten` | 1924 | WEB | Wikipedia 'New York 1924 chess tournament'; ChessBase report on New York 1924, round 5 | Lost to Chajes in 1916 (one source gives 21 January, a ChessBase result 8 February, so the row no longer states a day); next loss in a tournament or match game was to Réti in New York 1924: an eight-year, 63-game unbeaten streak (search result quoting Wikipedia); the text says 'de torneo o match'. |
| `champions-capablanca-life` | 1913 | WEB | Capablanca, My Chess Career (1920); Chess.com biography; World Chess Hall of Fame | Learned at four watching his father (his own account, hence 'by his own account'); Cuban Foreign Office post in September 1913 as a roving ambassador ('ambassador at large'). |
| `champions-alekhine-died` | 1946 | WEB | Wikipedia 'Alexander Alekhine'; ChessBase, 'Alekhine's death' | Died on 24 March 1946 in Estoril; the only champion to die holding the title; negotiations with Botvinnik were under way. |
| `champions-botvinnik-1948` | 1948 | WEB | Wikipedia 'World Chess Championship 1948'; New In Chess, 'World Chess Championship 1948' | FIDE tournament in The Hague and Moscow, 1948, five players: Botvinnik, Smyslov, Reshevsky, Keres, Euwe. |
| `champions-botvinnik-engineer` | 1951 | WEB | Wikipedia 'Mikhail Botvinnik'; ChessBase, 'Mikhail Botvinnik - hundredth anniversary' | Doctorate in engineering in 1951; electrical engineer; computer chess pioneer (his Pioneer program never actually played a game). Fact-check 2026-09-30: 'doctorado en ciencias técnicas': candidate dissertation in 1937, doctoral dissertation on synchronous machines in 1951 (Doctor of Technical Sciences). |
| `champions-euwe` | 1935 | WEB | Wikipedia 'Max Euwe'; MacTutor History of Mathematics, 'Machgielis Euwe' | PhD in mathematics 1926 (supervisor Brouwer); professor of computer programming at Rotterdam and Tilburg; champion 1935-37; FIDE president 1970-78. Fact-check 2026-09-30: Spanish 'enseñó informática' and English 'taught computer programming' now agree: professor of computer programming at Dutch universities (Rotterdam, Tilburg). |
| `champions-bronstein-1951` | 1951 | WEB | Wikipedia 'World Chess Championship 1951'; Chessentials, 'Botvinnik - Bronstein 1951' | 15 March to 11 May 1951; 12-12 (five wins each, 14 draws); Bronstein led 11.5-10.5 after 22 of the 24 games; the champion kept the title on a tie. |
| `champions-tal-1960` | 1960 | WEB | Wikipedia 'Mikhail Tal'; Encyclopaedia Britannica, 'Mikhail Tal' | Won 12.5-8.5 (six wins, two losses, thirteen draws) aged 23; 'Magician from Riga' nickname. |
| `champions-fischer-1972` | 1972 | WEB | Encyclopaedia Britannica, 'Bobby Fischer'; History.com; Wikipedia 'World Chess Championship 1972' and 'Wilhelm Steinitz' (naturalised US citizen in 1888) | Reykjavik, 12.5-8.5, the first American-born champion; peak rating 2785 in July 1972, the highest at that time. Fact-check 2026-09-30: 'first American champion' became 'first American-born': Steinitz was naturalised in 1888 and held the title until 1894. |
| `champions-fischer-streak` | 1971 | WEB | Encyclopaedia Britannica, 'Bobby Fischer'; Wikipedia 'Bobby Fischer' | Britannica: 20 consecutive wins in the 1970 Interzonal and the 1971 Candidates, including 6-0 sweeps over Taimanov and Larsen; the streak ended against Petrosian. |
| `champions-karpov-1975` | 1975 | WEB | Wikipedia 'World Chess Championship 1975'; Encyclopaedia Britannica, 'Bobby Fischer' | Fischer refused the match conditions and forfeited; Karpov was named champion by default on 3 April 1975. |
| `champions-karpov-kasparov` | 1990 | WEB CODE | Wikipedia 'Karpov-Kasparov rivalry'; Timman, The Longest Game | Five matches 1984-90, 144 games: Karpov 19 wins, Kasparov 21, 104 draws (48 + 4 * 24 games; sums checked in the test). |
| `champions-1984-halted` | 1985 | KNOWN | Wikipedia 'World Chess Championship 1984'; Timman, The Longest Game | First to six wins; halted after 48 games with Karpov leading 5-3. A search snippet confirms the roughly six-month length and the controversial halt; the 48 games and 5-3 detail come from standard references and were not re-fetched. |
| `champions-kasparov-1985` | 1985 | WEB | Encyclopaedia Britannica, 'Garry Kasparov'; Wikipedia 'Garry Kasparov' | Youngest champion, aged 22, until Gukesh in 2024. |
| `champions-kramnik-2000` | 2000 | WEB CODE | ChessBase, '25 years ago: Kramnik beats Kasparov'; Encyclopaedia Britannica | London, 8 October to 4 November 2000; 8.5-6.5 (+2 =13 -0). |
| `champions-menchik-title` | 1927 | WEB | World Chess Hall of Fame, 'Vera Menchik'; British Chess News | First Women's World Champion in 1927 (London); kept the title until 1944, when she died with her sister and mother in a V-1 attack on London (27 June 1944). Fact-check 2026-09-30: 'bombing raid' made precise: a V-1 flying bomb hit her home in Clapham (26 or 27 June 1944, sources differ by a day). |
| `champions-menchik-club` | 1929 | WEB HEDGED | Edward Winter, 'The Vera Menchik Club' (chesshistory.com; notes the story may be apocryphal); Wikipedia 'Albert Becker' | Albert Becker as first member (Carlsbad 1929); Edward Winter notes the earliest known source is a 1980 book, so the story may be apocryphal ('cuenta la anécdota'). Later 'members' include Euwe, Sultan Khan, Colle, Znosko-Borovsky and Mieses. |
| `champions-polgar-top10` | 2005 | WEB | Wikipedia 'Judit Polgár'; FIDE 'Women of the Month: Judit Polgar' | No. 8 in the July 2005 FIDE list; peak rating 2735; beat Kasparov in September 2002 in a rapid game (Russia vs the Rest of the World). 'Only woman in the top ten' is true as far as the sources go, hence 'hasta ahora'. |
| `champions-polgar-1991` | 1991 | WEB | Wikipedia 'Judit Polgár' and 'Susan Polgar'; FIDE Women in Chess pages | Judit was 15 years 4 months, breaking Fischer's 33-year-old record; Susan was the first woman to earn the title the conventional way (three norms and a 2500 rating) in January 1991. |
| `champions-carlsen` | 2013 | WEB | Wikipedia 'Magnus Carlsen'; FIDE World Championship 2013 pages | Grandmaster on 26 April 2004 (13 years 148 days); champion on 22 November 2013, beating Anand 6.5-3.5 in Chennai. |
| `champions-ding-2023` | 2023 | WEB | Wikipedia 'World Chess Championship 2023'; FIDE news | Beat Nepomniachtchi in the tiebreak of the 2023 match; first Chinese men's world champion (Chinese women had been champions before, hence 'masculino'). |
| `champions-gukesh-2024` | 2024 | WEB | FIDE news on the 2024 World Championship; Guinness World Records; press reports of 12 Dec 2024 | 12 December 2024, Singapore, 7.5-6.5; aged 18 years 197 days, four years younger than Kasparov's 1985 record. |
| `champions-morphy` | 1857 | WEB | Wikipedia 'Paul Morphy'; Encyclopaedia Britannica, 'Paul Charles Morphy' | LL.B. from the University of Louisiana on 7 April 1857 (born 22 June 1837, so 19); the 1857 American Chess Congress and the 1858 European trip are standard biography (not re-fetched). |
| `champions-opera-game` | 1858 | WEB CODE | Wikipedia 'Opera Game'; ChessBase, '50 games you should know: Morphy vs Duke of Brunswick and Count Isouard' | October/November 1858, Paris; Norma was performed on 21 October 1858; Duke Karl II of Brunswick and Count Isouard; consultation game; mate on White's 17th move (replayed in the test). |
| `champions-immortal-game` | 1851 | WEB CODE | Wikipedia 'Immortal Game'; ChessBase, '175 years ago: Anderssen's Immortal Game' | 21 June 1851 in London; replayed in the test: it ends 23.Be7# (White's 23rd move; the test string ends 'Qf6+ Nxf6 Be7#') with two knights and a bishop left and no rooks or queen. |
| `champions-rubinstein-1912` | 1912 | WEB | Wikipedia 'Akiba Rubinstein'; Chess.com player biography | Rubinstein challenged Lasker in 1912 and Lasker accepted; match set for autumn 1914 and cancelled by the First World War. The old text's 'financial problems' was not supported and was dropped. |
| `champions-keres` | 1962 | WEB | Wikipedia 'Paul Keres'; chess24 'Paul Keres VI: the eternal second' | Second or shared second in the Candidates of 1953, 1956, 1959 and 1962; nicknames 'Paul the Second', 'The Eternal Second', 'Crown Prince of Chess'. Fact-check 2026-09-30: 'runner-up' became 'second, or shared second place'. In 1953 he tied for 2nd-4th (16/28 with Bronstein and Reshevsky, Smyslov 18); in 1962 he tied for 2nd-3rd with Geller (17/27, Petrosian 17.5); he was sole second in 1956 and 1959 (background knowledge). |
| `champions-najdorf-1939` | 1939 | WEB | Wikipedia 'Miguel Najdorf'; FIDE Museum, 8th Chess Olympiad bulletin | 8th Olympiad, Buenos Aires, August-September 1939; Najdorf played second board for Poland, stayed in Argentina and became a citizen in 1944. |
| `champions-korchnoi-stateless` | 1978 | WEB | Wikipedia 'Viktor Korchnoi'; Swissinfo obituary (2016) | Defected in the Netherlands in 1976; stateless in the late 1970s (1977-79 in the source used); Swiss citizen around 1980. (My first recollection of 1994 was wrong and was corrected by the search.) Fact-check 2026-09-30: sources disagree on when the stateless period ended (1979, 1980, even 1991). The text now says 'late 1970s' and 'around 1980'. The 1978 Baguio match was played without national flags on the table. |
| `champions-korchnoi-yogurt` | 1978 | WEB HEDGED | Wikipedia 'World Chess Championship 1978'; Philippine press retrospectives (Inquirer, Cover Story) | Game 2 of Baguio 1978: Korchnoi's seconds protested a blueberry yogurt delivered to Karpov at move 24; afterwards only a set yogurt at a set time was allowed. Some accounts say the protest was partly a parody; the text reports only the protest and the rule. |
| `champions-smyslov-singer` | 1957 | WEB | Wikipedia 'Vasily Smyslov'; FIDE Museum, 'Smyslov's concert setlist' | Baritone; a 1950 Bolshoi audition is reported (one source calls it failed; the text says only 'auditioned'); FIDE Museum holds his concert set list. |
| `champions-taimanov-pianist` |  | WEB | Wikipedia 'Mark Taimanov'; The Week in Chess obituary (2016) | Concert pianist; formed a piano duo with his first wife Lyubov Bruk (Wikipedia and obituaries). |
| `champions-fine-psychologist` | 1951 | WEB | Wikipedia 'Reuben Fine'; Edward Winter, Chess Notes on Fine | PhD (USC) in 1948; gave up professional chess around 1951 to become a Freudian psychologist. |
| `champions-reshevsky-accountant` | 1920 | WEB | Wikipedia 'Samuel Reshevsky'; Encyclopedia.com biography | Beat masters in simultaneous exhibitions at eight (France, 1920 photograph); graduated from the University of Chicago in 1934 with a degree in accounting. |
| `champions-vidmar-engineer` |  | WEB | Wikipedia 'Milan Vidmar'; Chess.com, 'The engineering career of Milan Vidmar' | Electrical engineer, power transformers; professor at the University of Ljubljana, founder of its Faculty of Electrical Engineering, rector 1928-29. Fact-check 2026-09-30: 'ayudó a fundar' / 'helped found': sources differ between 'founded' and 'helped to set up' the Faculty. He was rector in 1928-29, later dean of the technical faculty, and an inaugural FIDE grandmaster in 1950. |

### Machines (`machines`, 17)

| Id | Year | Status | Source hint (as stored) | What was checked |
| --- | --- | --- | --- | --- |
| `machines-turk` | 1770 | WEB | History.com, 'How a phony 18th-century chess robot fooled the world'; Big Think; Standage, The Turk (2002) | Built in 1770 by von Kempelen; a hidden operator controlled it; destroyed in a fire in Philadelphia on 5 July 1854. |
| `machines-turk-napoleon` | 1809 | WEB HEDGED | History.com and Big Think articles on the Mechanical Turk; Standage, The Turk (2002). Anecdotal details, hence 'according to' | Napoleon (1809) and Franklin (Paris, about 1783) are reported in popular histories; the sweep-the-board detail is anecdotal, so the text says 'according to the accounts'. |
| `machines-torres-quevedo` | 1912 | WEB | Wikipedia 'Leonardo Torres Quevedo'; historyofinformation.com; Communications of the ACM, 'AI began in 1912' | Built in 1912, shown at the Sorbonne in Paris in 1914; mates with king and rook against king. |
| `machines-turochamp` | 1948 | WEB | Wikipedia 'Turochamp'; ChessBase, 'Reconstructing Turing's paper machine' | Turing and Champernowne, 1948; Turing executed it by hand against Alick Glennie in summer 1952 and lost (Glennie won in 29 moves). |
| `machines-shannon-paper` | 1950 | WEB | Shannon, Philosophical Magazine 41 (1950); Wikipedia 'Shannon number' | Philosophical Magazine, March 1950; introduced computer chess as a field. |
| `machines-prinz-1951` | 1951 | WEB | Wikipedia 'Chess (Dietrich Prinz)'; Computer History Museum, Ferranti Mark 1 pages | Ferranti Mark 1, first ran in November 1951; mate-in-two problems. |
| `machines-deep-thought` | 1988 | WEB | Wikipedia 'Deep Thought (chess computer)'; Christian Science Monitor and Sports Illustrated archives (1989) | Long Beach Thanksgiving tournament, November 1988; beat Bent Larsen; Carnegie Mellon students led by Feng-hsiung Hsu. |
| `machines-deepblue-1996` | 1996 | WEB | Wikipedia 'Deep Blue versus Garry Kasparov'; History.com, 'Kasparov loses chess game to computer' | 10-17 February 1996, Philadelphia; Deep Blue won game 1; Kasparov won the match 4-2. |
| `machines-deepblue-1997` | 1997 | WEB | IBM Archives, 'Deep Blue'; Wikipedia 'Deep Blue versus Garry Kasparov' | 3-11 May 1997, New York; 3.5-2.5; IBM archive: 200 million positions per second. |
| `machines-advanced-chess` | 1998 | WEB | Wikipedia 'Advanced chess'; The Week in Chess 171 and 188 (1998); ChessBase, 'A hand for Topalov' | Kasparov-Topalov, León, June 1998, 3-3 (Fritz 5 and ChessBase 7.0); Week in Chess and ChessBase reports. |
| `machines-freestyle-2005` | 2005 | WEB | ChessBase, 'Dark horse ZackS wins Freestyle Chess Tournament'; Regan, freestyle chess study (University at Buffalo) | PAL/CSS Freestyle 2005 on Playchess.com; ZackS (Steven Cramton and Zackary Stephen, about 1685 and 1398 USCF) beat grandmaster teams using three computers. |
| `machines-stockfish-2008` | 2008 | WEB | Chessprogramming wiki 'Stockfish'; Wikipedia 'Stockfish (chess)' | Stockfish 1.0, November 2008, from Glaurung (Romstad, Costalba, Kiiski); GPL. 'This trainer runs it in your browser' relies on the Ludus.Engine integration (WASM in a Worker, docs/ARCHITECTURE.md section 6); if the engine is ever dropped, revisit this text. Fact-check 2026-09-30: names Marco Costalba, who developed Stockfish as a fork of Glaurung (Tord Romstad and Joona Kiiski were co-authors). |
| `machines-alphazero` | 2017 | WEB HEDGED | DeepMind preprint (Dec 2017) and Science paper (Dec 2018); Wikipedia 'AlphaZero'; ChessBase report | Preprint 5 December 2017, Science paper 7 December 2018; 28 wins, 72 draws, no losses against Stockfish 8 in 100 games; self-play only, no opening books. The match conditions were criticised, which the text mentions. |
| `machines-leela` | 2018 | WEB | Wikipedia 'Leela Chess Zero'; chessprogramming wiki 'LCZero' | Released 9 January 2018 (Pascutto and Linscott); distributed training with volunteer-generated self-play games. |
| `machines-nnue` | 2020 | WEB | Wikipedia 'Stockfish (chess)'; chessprogramming wiki 'Stockfish NNUE' | NNUE was introduced into Stockfish in August 2020 and shipped in Stockfish 12. |
| `machines-tablebases` | 2012 | WEB | Wikipedia 'Endgame tablebase' and 'Solving chess'; Lichess blog, '7 piece Syzygy tablebases are complete' | Lomonosov (Moscow State University) generated the complete 7-piece tables in 2012; Syzygy 7-piece tables were completed later. |
| `machines-mate-549` | 2012 | WEB | Wikipedia 'Solving chess' (Haworth's finding in the Lomonosov tablebase; 549 is depth-to-mate, some references show 546 under another metric); Chessdom, '7-men tablebases' | The longest 7-piece depth-to-mate, 549, found by Guy Haworth in the Lomonosov tablebase, ignoring the 50-move rule. Fact-check 2026-09-30: 549 is a depth-to-mate (DTM) figure and the longest known 7-piece one (KQPKRBN); some references show 546 under another metric. The Spanish 'hay posiciones' (plural) became a single mate, as in the English text. |

### Rules (`rules`, 13)

| Id | Year | Status | Source hint (as stored) | What was checked |
| --- | --- | --- | --- | --- |
| `rules-fide-1924` | 1924 | WEB | FIDE history pages ('FIDE turns 99'); Wikipedia 'FIDE' | FIDE founded 20 July 1924 in Paris by the participants of the Paris tournament; motto 'Gens una sumus', 'We are one family'. |
| `rules-elo-1970` | 1970 | WEB | ChessBase, 'Arpad Elo and the Elo Rating System'; World Chess Hall of Fame; Wikipedia 'Elo rating system' | USCF adopted the system in 1960 and FIDE in 1970; Elo was a Hungarian-born physics professor at Marquette University. |
| `rules-elo-expected` |  | CODE | Elo expected-score formula E = 1 / (1 + 10^(-d/400)); the two figures were computed from it | E = 1 / (1 + 10^(-d/400)): 200 points gives 75.97%, 100 points gives 64.0%. Recomputed in scripts/tests/facts.test.js. |
| `rules-grandmaster-1950` | 1950 | WEB HEDGED | Wikipedia 'FIDE titles'; Edward Winter, Chess Notes, 'Grandmasters' (chesshistory.com) | FIDE first awarded the title in 1950 (list of 27 players dated 27 July 1950). The story that Tsar Nicholas II gave the title to five players in 1914 is questioned by Edward Winter (earliest sources 1940 and 1942), so it is deliberately not stated. |
| `rules-clock-1883` | 1883 | WEB | Wikipedia 'Chess clock' and 'London 1883 chess tournament'; ChessBase 'London 1883: prelude to the first World Championship match' | Thomas Bright Wilson's double clock was first used in competition at London 1883; a sand-glass had first been used officially in London in 1860. |
| `rules-fischer-clock` | 1988 | WEB | US patent 4,884,255 (filed 1988, granted 1989); Wikipedia 'Chess clock' | US patent 4,884,255, filed in 1988 and granted in 1989. Fact-check 2026-09-30: 'patentó en 1988' became 'solicitó en 1988 (concedida en 1989)', as in the patent data of the source hint. The increment was first used in the 1992 Fischer-Spassky match (not in the text). |
| `rules-promotion` |  | KNOWN | FIDE Laws of Chess, Article 3.7 (promotion) | FIDE Laws of Chess, Article 3.7(e). Not re-fetched. |
| `rules-en-passant` |  | KNOWN | Wikipedia 'En passant'; Murray, A History of Chess (1913) | The two-square pawn move was introduced in the 15th century (a search summary agrees) and en passant came with it. Wording is deliberately loose. Fact-check 2026-09-30: the motive is now worded as 'usually explained' (a customary explanation, not a documented one). Sources date the double step anywhere from the 13th to the 16th century (the Grant Acedrex of Alfonso X's 1283 book already has it) and Italy adopted en passant only c. 1880, hence the loose 'hacia el siglo XV'. |
| `rules-castling` |  | WEB | Wikipedia 'Castling' (history section); Murray, A History of Chess (1913) | Castling unknown before the 15th century; modern rules in France around 1620; not standardised until the late 19th century (search summary of the Wikipedia article on castling). |
| `rules-stalemate` |  | WEB | Wikipedia 'Stalemate' (history); Murray, A History of Chess (1913) | In shatranj stalemate was a win for the stalemating player (a loss in some places); the rule was finalised in the early 19th century (search summary). Fact-check 2026-09-30: the text now says shatranj stalemate was 'generally' a win for the stalemater (sources differ by region and author; al-Suli attributes one variant to the Indians only) and that European rules varied for centuries (draw in Italy and France, a loss for the stalemater in England c. 1600-1800). |
| `rules-fifty-move` |  | KNOWN | FIDE Laws of Chess, Articles 9.3 and 9.6 | FIDE Laws of Chess: Article 9.3 (claim after 50 moves by each side) and 9.6 (automatic draw after 75 moves). Not re-fetched. Fact-check 2026-09-30: 'a las 75 jugadas de cada bando': the 75-move rule counts 75 moves by EACH player (automatic draw, in the Laws since 2014, not applied when the last move is mate; background knowledge). |
| `rules-stamma-notation` | 1737 | WEB | Wikipedia 'Philipp Stamma'; Chess.com, 'The creator of algebraic chess notation' | Stamma, a native of Aleppo; Essai sur le jeu des échecs (1737) introduced algebraic notation in an almost fully developed form (he used p for pawn moves and the file letter for pieces). |
| `rules-chess960` | 1996 | WEB CODE | Wikipedia 'Chess960'; FIDE Fischer Random Chess history page | Fischer announced it on 19 June 1996 in Buenos Aires; 960 starting positions (4 * 4 * 6 * 10 is checked in the test). Fact-check 2026-09-30: the constraints behind 960 (bishops on opposite colours, king between the rooks) are now stated. The name 'Chess960' is later than the 1996 announcement (Fischer called it Fischer Random Chess). |

### Openings (`openings`, 10)

| Id | Year | Status | Source hint (as stored) | What was checked |
| --- | --- | --- | --- | --- |
| `openings-ruy-lopez` | 1561 | WEB | Wikipedia 'Ruy Lopez' and 'Ruy López de Segura'; his Libro de la invención liberal y arte del juego del axedrez (1561) | Ruy López de Segura, Libro de la invención liberal y arte del juego del axedrez (Alcalá de Henares, 1561; title and place from standard bibliographies, not re-fetched). The opening itself is older (Göttingen manuscript, Lucena). |
| `openings-sicilian` | 1594 | WEB | Wikipedia 'Sicilian Defence' (Polerio's 1594 manuscript analysed it without using the name; Greco's analysis is from 1623, after Salvio 1604 and Carrera c. 1617) | Polerio's 1594 manuscript analysed it without using the name; Greco followed. 'One of the most popular replies' is a safe statement. Fact-check 2026-09-30: the old text put Polerio AND Greco in the late 16th century. Polerio's manuscript is 1594; Greco's analysis is from 1623 (Salvio 1604 and Carrera c. 1617 come between). The text now says 'a comienzos del siglo XVII' for Greco. |
| `openings-queens-gambit` | c. 1500 | WEB HEDGED | Wikipedia 'Göttingen manuscript' and 'Queen's Gambit' (the manuscript's date is uncertain, hence 'c.') | Mentioned in the Göttingen manuscript, whose dating ranges from 1471 to c. 1505 (hence 'c. 1500'); White can regain the pawn, the usual reason it is not a true gambit. Fact-check 2026-09-30: the date is now 'hacia 1500 (su datación es incierta)': sources give 1471, about 1490 or 1500-1505. |
| `openings-gambit-word` |  | KNOWN | Online Etymology Dictionary 'gambit'; Wiktionary 'gambit' | Online Etymology Dictionary: from Italian gambetto, 'a tripping up', from gamba 'leg'. Not re-fetched. |
| `openings-kings-gambit` | 1851 | CODE | Wikipedia 'King's Gambit' and 'Immortal Game' (score of the game) | The Immortal Game, replayed in the test, starts 1.e4 e5 2.f4; 'one of the most popular of the 19th century' is standard opening history. |
| `openings-philidor` | 1749 | WEB CODE | Wikipedia 'François-André Danican Philidor'; FIDE Museum, 'L'Analyse des Échecs'; Britannica 'Development of theory' | Analyse du jeu des Échecs (1749): 'les pions sont l'âme du jeu'; Philidor was also a composer of comic operas (standard biography, not re-fetched); the Philidor Defence line is checked legal in the test. |
| `openings-marshall-attack` | 1918 | WEB HEDGED | Wikipedia 'Marshall Attack'; Chess.com, 'A century of chess: New York 1918'; Edward Winter's Chess Notes on the 'saved for years' story and on earlier games with the same line (Walbrodt 1893) | Played on 23 October 1918 at the Manhattan Chess Club, New York; Capablanca won. 'Saved for years' is unproven: Edward Winter found games from 1910-18 where Marshall passed up the chance, and an 1893 game with a similar line. Fact-check 2026-09-30: 'estrenó / unveiled' became 'played against': Edward Winter notes an undated Frere-Marshall game and an 1893 Walbrodt game with the same line, so 'first use' is not established. |
| `openings-berlin-wall` | 2000 | WEB CODE | ChessBase, '25 years ago: Kramnik beats Kasparov'; Encyclopaedia Britannica | Kramnik-Kasparov, London 2000; 'seen as passive' is the standard characterisation; the move order is checked legal in the test. |
| `openings-scholars-mate` |  | CODE | Standard opening theory; the move sequence is verified as legal and mating in the test suite | Replayed in the test: legal and ends in checkmate. |
| `openings-eco` |  | KNOWN | Encyclopaedia of Chess Openings (Chess Informant); PGN specification ('ECO' tag) | ECO has five volumes A-E with 100 codes each, 500 in all (arithmetic in the test); PGN files carry an 'ECO' tag. |

### Culture (`culture`, 16)

| Id | Year | Status | Source hint (as stored) | What was checked |
| --- | --- | --- | --- | --- |
| `culture-staunton` | 1849 | WEB HEDGED | House of Staunton, 'The Staunton Chessmen History'; Wikipedia 'Staunton chess set' | Design registered on 1 March 1849 by Nathaniel Cooke; Jaques supplied the trade from 29 September 1849; Staunton endorsed the sets in the Illustrated London News. Who designed it is disputed, hence 'in the name of Cooke'. |
| `culture-london-1851` | 1851 | WEB | Chess.com, 'London 1851: the first international chess tournament'; Wikipedia 'London 1851 chess tournament' | 26 May to 15 July 1851, alongside the Great Exhibition; knockout format; Anderssen beat Staunton 4-1 in the semi-final and Wyvill in the final. |
| `culture-name-latin` | c. 1300 | WEB | Manuscript catalogues (Yale Beinecke, British Library) listing 'Liber de moribus hominum et officiis nobilium super ludo scacchorum' | 'ludus scaccorum' (game of chess) appears in manuscript titles of Cessolis's work, for example 'super ludo scacchorum' (Yale and British Library catalogue entries). Fact-check 2026-09-30: 'Cessolis' spelling, and the text now says the phrase appears 'in forms such as ludo scaccorum' (catalogued Latin titles: super ludo scaccorum / scacchorum, Solatium ludi scaccorum, Ludus scacchorum, De ludo scacchorum). |
| `culture-caissa` | 1763 | WEB | Wikipedia 'Caïssa'; Vida, Scacchia ludus (1527); William Jones, 'Caissa, or the Game at Chess' (1763) | Vida's Scacchia ludus (1527) has a chess dryad named Scacchia; Jones named her Caïssa in 1763 (hence 'the idea of a chess nymph' for Vida and 'named her Caïssa' for Jones). Search results disagreed on the language of Jones's poem; the standard text is in English heroic couplets, which is what the text says. Fact-check 2026-09-30: Jones wrote the poem in 1763 (aged 17) but it was published in 1772; the text says so and no longer implies fame from 1763. Vida's Scacchia ludus (1527) is Latin, Jones's poem is in English couplets. |
| `culture-alice` | 1871 | WEB | Wikipedia 'White Queen (Through the Looking-Glass)'; Chess.com, 'Lewis Carroll's chess problem' | Through the Looking-Glass (1871) is structured as a chess game; the book opens with a chess problem diagram. Fact-check 2026-09-30: 'Alicia' (the Spanish name of the character) and 'follows the pattern of a chess problem': Carroll's own frame is a problem ('White Pawn (Alice) to play, and win in eleven moves'), not a full game. |
| `culture-hal-2001` | 1968 | WEB | Wikipedia 'Poole versus HAL 9000' and 'Willi Schlage'; Chess.com, '2001: a chess space odyssey' | The film's game is Roesch-Schlage, Hamburg 1910 (a 15-move miniature in the Ruy Lopez), reported in Chernev's 1955 collection. Fact-check 2026-09-30: the film starts from the position after Black's 13th move and reproduces the ending of the real game, not the whole game. |
| `culture-duchamp` | 1928 | WEB | The Article, 'Marcel Duchamp: chess master'; Frieze, 'Art and chess'; Oxford Companion to Chess | French Federation master title in 1925; France at four Olympiads between 1928 and 1933; the 'all chess players are artists' remark is quoted in the sources (Oxford Companion to Chess). |
| `culture-olympiad-1927` | 1927 | WEB | Wikipedia 'Chess Olympiad'; FIDE Museum; World Chess Hall of Fame, 'Vera Menchik' | First official Olympiad in London in 1927 (16 teams), won by Hungary (Hamilton-Russell Cup); the first Women's World Championship was also held in London in 1927. |
| `culture-space-1970` | 1970 | WEB | Wikipedia 'Soyuz 9'; Guinness World Records, 'First board game in space'; FIDE news | 9 June 1970, Soyuz 9; consultation game; Nikolayev and Sevastyanov against Kamanin and Gorbatko; about six hours; a draw. Fact-check 2026-09-30: Spanish transliteration (Nikoláyev, Sevastiánov) to match the other Spanish texts. |
| `culture-kasparov-world` | 1999 | WEB | Wikipedia 'Kasparov versus the World'; Microsoft news archive, 21 June 1999 | MSN Gaming Zone, 1999; 62 moves over four months; more than 50,000 participants from over 75 countries; Kasparov's 'the greatest game in the history of chess' remark. |
| `culture-carlsen-gates` | 2014 | WEB | NBC News; The Local (Norway); GeekWire; Chess.com game showcase (January 2014) | Skavlan TV show, Oslo, January 2014; nine moves; Gates had 2 minutes against Carlsen's 30 seconds. |
| `culture-chessboxing` | 2003 | WEB | Wikipedia 'World Chess Boxing Organisation' and 'Chess boxing'; Worldcrunch feature | Enki Bilal's comic Froid Équateur (1992); the first competition was in Berlin in 2003 (Iepe Rubingh). Fact-check 2026-09-30: added that the first world championship followed in Amsterdam in 2003 (newly founded WCBO). An earlier informal mix of chess and boxing is reported in 1970s London, hence 'competition with alternating rounds'. |
| `culture-armenia-schools` | 2011 | WEB | Radio Free Europe/Radio Liberty (2011); Deseret News (2011); the 'first country' wording is the claim of the press and the Armenian government, not independently confirmed | From the 2011 school year, second graders, two lessons a week (RFE/RL, Deseret News). Fact-check 2026-09-30: 'first country in the world' is a press and government claim (RFE/RL, BBC and Wikipedia repeat it) that could not be independently confirmed, so the text says it was 'presented as' the first. Rollout: grade 2 from 1 September 2011, grade 3 in 2012, grade 4 in 2013 (per the checkers). |
| `culture-lichess` | 2010 | WEB | Wikipedia 'Lichess'; lichess.org/about | Founded in 2010 by Thibault Duplessis; funded by donations; ad-free; open source. |
| `culture-queens-gambit-series` | 2020 | WEB | Bloomberg, 23 Nov 2020 (Netflix figures); /Film and Tubefilter coverage; Google Trends reports of the time | Netflix reported 62 million households in the first 28 days (Bloomberg, 23 November 2020); Tevis's novel is from 1983. |
| `culture-streaming` | 2020 | KNOWN | General knowledge, widely reported (Twitch chess category growth from 2020); Nakamura's public channel and titles | General knowledge; deliberately no numbers or rankings. Fact-check 2026-09-30: 'ganó un público masivo' (vague and unsourced) became 'crecieron enormemente'; streaming existed before 2020. |

### Records (`records`, 10)

| Id | Year | Status | Source hint (as stored) | What was checked |
| --- | --- | --- | --- | --- |
| `records-najdorf-blindfold` | 1947 | WEB CODE | Guinness World Records; ChessBase, 'Remembering Miguel Najdorf'; Wikipedia 'Blindfold chess' | 21 January 1947, São Paulo, 45 boards in 23 h 25 min, +39 =4 -2; the record stood until 2011 (Marc Lang, 46 boards). Fact-check 2026-09-30: 'the recognised record until 2011'. Janos Flesch claimed 52 boards in Budapest in 1960 (about five hours, score recounted aloud to him), which is not accepted. |
| `records-gareyev-blindfold` | 2016 | WEB CODE | Guinness World Records; ChessBase, 'Gareyev breaks the world blindfold simul record'; FIDE news | 3-4 December 2016, University of Nevada, Las Vegas; 48 boards in 19 h 9 min including a half-hour fire-alarm interruption, +35 =7 -6. |
| `records-longest-game` | 1989 | WEB HEDGED | Chess.com and Lichess record lists; Wikipedia 'Longest chess game' (repeated in several secondary sources) | Nikolić-Arsović, Belgrade 1989: 269 moves, 20 h 15 min, a draw; repeated by many secondary sources (chess.com and Lichess record lists), hence 'que se conoce'. The 50-move rule then had exceptions. |
| `records-fools-mate` |  | CODE | Standard chess reference; the sequence is verified as legal and mating in the test suite | Replayed in the test: checkmate after 1.f3 e5 2.g4 Qh4#, White is the mated side. A full search of the first four plies finds no mate before ply 4 and exactly 8 mates at ply 4, all by Black, so White needs at least three moves. |
| `records-mishra` | 2021 | WEB | FIDE news, 30 June 2021; ChessBase report | FIDE news of 30 June 2021: 12 years 4 months 25 days; Karjakin's record was 12 years 7 months (2002). Record as of writing. |
| `records-ding-unbeaten` | 2018 | WEB CODE | Wikipedia 'Ding Liren'; FIDE and ChessBase reports | August 2017 to November 2018, 100 games, 29 wins and 71 draws; ended by Vachier-Lagrave at the Shenzhen Masters 2018. Carlsen later surpassed the streak, which the text does not mention. |
| `records-carlsen-rating` | 2014 | WEB | Wikipedia 'Magnus Carlsen'; FIDE rating lists | Peak rating 2882 in May 2014; the 'so far' hedge covers future records. |
| `records-first-moves` |  | CODE | Perft counts (perft(2) = 400, perft(4) = 197,281), chessprogramming wiki; the counts are reproduced by this project's chess module tests | perft(1) = 20, perft(2) = 400, perft(4) = 197,281, computed with js/chess.js in the test. Perft counts move sequences, not distinct positions, hence the word 'sequences'. |
| `records-legal-positions` | 2021 | WEB HEDGED | TalkChess thread 'The number of legal chess positions is ~ 4.8 * 10^44' (J. Tromp, 2021); Tromp's ChessPositionRanking project | John Tromp's 2021 sampling estimate: reported as about 4.8 x 10^44 (thread title) and (4.48 +- 0.37) x 10^44 (search summary); the text says only 'on the order of 10^44' and calls it an estimate. Fact-check 2026-09-30: the estimate was shared through a TalkChess thread and GitHub with help from many people (notably Peter Österlund); it is not a peer-reviewed publication. |
| `records-shannon-number` | 1950 | WEB | Shannon, Philosophical Magazine 41 (1950); Wikipedia 'Shannon number' | A conservative lower bound of the game-tree complexity of chess (10^3 per move pair over about 40 pairs); about 10^80 atoms in the observable universe. Fact-check 2026-09-30: the Spanish text now says 'por lo bajo' and 'de duración normal', like the English one (about 10^3 possibilities per move pair over about 40 pairs). |

### Mind (`mind`, 9)

| Id | Year | Status | Source hint (as stored) | What was checked |
| --- | --- | --- | --- | --- |
| `mind-degroot` | 1946 | WEB | de Groot, Thought and Choice in Chess (1946 thesis; English edition 1965); Chase & Simon (1973) | De Groot's brief-exposure recall of real positions: masters far better than novices; the commonly quoted exposure is five seconds (Chase and Simon replication), so the text says 'unos segundos'. Fact-check 2026-09-30: 'jugadores más débiles' / 'weaker players' instead of beginners: de Groot compared grandmasters and masters with weaker club players; the comparison with true novices is Chase and Simon's replication. |
| `mind-chunks` | 1973 | WEB | Chase & Simon, 'Perception in chess', Cognitive Psychology 4 (1973) | Chase and Simon 1973: the recall advantage vanishes for random positions; chunking theory. Fact-check 2026-09-30: 'casi desaparece' / 'all but disappears'. Later work (Gobet and Simon, 1996; background knowledge) found that masters keep a small advantage on random positions. |
| `mind-50000-patterns` | 1973 | WEB HEDGED | Simon & Gilmartin, 'A simulation of memory for chess positions', Cognitive Psychology 5 (1973) | Simon and Gilmartin (1973) simulation: at least 50,000 chunks; an order-of-magnitude estimate, which the text says. Fact-check 2026-09-30: 'al menos unos 50.000' / 'at least about 50,000': Simon and Gilmartin give a lower bound, not a central estimate. |
| `mind-einstellung` | 2008 | WEB | Bilalić, McLeod & Gobet, Cognition 108 (2008); PLoS ONE 2013 follow-up on boundary conditions | Bilalić, McLeod and Gobet (2008), eye-movement evidence for the Einstellung effect. The closing tip ('probá siempre una jugada distinta') is advice, not a finding of the paper. Fact-check 2026-09-30: the closing tip is now 'before you play, deliberately look for another idea' (the old 'always try a different move' could be read as 'always play a different move'). Still advice, not a finding of the paper. |
| `mind-kotov` | 1971 | WEB | Kotov, Think Like a Grandmaster (Batsford, 1971); Wikipedia 'Alexander Kotov' | Kotov, Think Like a Grandmaster (Batsford, 1971); 'Kotov syndrome' as defined in chess glossaries. |
| `mind-transfer` | 2016 | WEB | Sala & Gobet, 'Do the benefits of chess instruction transfer to academic and cognitive skills? A meta-analysis', Educational Research Review (2016) | Sala and Gobet 2016 meta-analysis: 24 studies, d of about 0.38 for maths, and the authors' warning about weak control groups. |
| `mind-spacing` | 1885 | KNOWN | Ebbinghaus, Über das Gedächtnis (1885); Wikipedia 'Spacing effect'; Leitner system | Ebbinghaus 1885 (forgetting curve and spacing effect); the Leitner boxes in the notebook are a practical spacing system. Not re-fetched. |
| `mind-eight-queens` | 1848 | WEB CODE | Wikipedia 'Eight queens puzzle'; Chess.com 'Eight queens puzzle' | Bezzel, 1848; the 92 solutions are counted by brute force in the test; 12 fundamental solutions per Wikipedia. |
| `mind-knights-tour` |  | WEB | Wikipedia 'Knight's tour' (26,534,728,821,064 directed closed tours; Euler's 18th-century analysis) | 26,534,728,821,064 directed closed tours (Wikipedia 'Knight's tour'), about 26.5 x 10^12: '26 trillion' in English (short scale) and '26 billones' in Spanish (long scale, hence the '26 millones de millones' gloss). Euler's 18th-century interest. |

## Timeline (36 milestones)

| Id | Year | Status | Source hint (as stored) | What was checked |
| --- | --- | --- | --- | --- |
| `tl-chaturanga` | c. 600 | WEB | Encyclopaedia Britannica, 'Chess'; Murray, A History of Chess (1913) | As origins-chaturanga. |
| `tl-shatranj` | c. 700 | KNOWN | Encyclopaedia Britannica, 'Chess'; Murray, A History of Chess (1913) | Combines origins-persia-chatrang and origins-shatranj-islam; 'c. 700' is only a marker for the spread after the Arab conquest of Persia. Fact-check 2026-09-30: reworded so that the Persian adoption (see origins-persia-chatrang, c. 600) comes before the spread of shatranj with Islam, which is what the c. 700 marker stands for. |
| `tl-europe` | c. 1000 | WEB | Wikipedia 'Versus de scachis'; Murray, A History of Chess (1913) | As origins-einsiedeln. |
| `tl-alfonso-x` | 1283 | WEB | Wikipedia 'Libro de los juegos' | As origins-alfonso-x. Fact-check 2026-09-30: 'one of the oldest surviving European chess treatises', as in origins-alfonso-x. |
| `tl-cessolis` | c. 1300 | WEB | Project Gutenberg, Caxton's 'Game and Playe of the Chesse'; Morgan Library | As origins-cessolis. Fact-check 2026-09-30: Spanish spelling 'Cessolis' (see origins-cessolis). |
| `tl-modern-queen` | c. 1475 | WEB | Wikipedia 'Scachs d'amor' | As origins-scachs-damor. Fact-check 2026-09-30: 'chess as we know it is born' softened to 'starts to take the form we know today'; castling, stalemate and en passant were standardised over later centuries. |
| `tl-lucena` | c. 1497 | WEB | Wikipedia 'Luis Ramírez de Lucena' and 'Francesc Vicent' (Llibre dels jochs partits, Valencia 1495, lost); Cessolis was printed earlier but is an allegory, not a playing manual | As origins-lucena. Fact-check 2026-09-30: title and text narrowed from 'the first printed book' to the oldest SURVIVING printed book on how to play chess. Cessolis's allegory was printed from the 1470s (Caxton 1474) and Francesc Vicent's Llibre dels jochs partits (Valencia, 1495) is lost. The Vicent point comes from the checkers' search results; it could not be re-verified in this pass (see 'Fact-check pass'). |
| `tl-ruy-lopez` | 1561 | WEB | Wikipedia 'Ruy López de Segura' | As openings-ruy-lopez. |
| `tl-philidor` | 1749 | WEB | FIDE Museum, 'L'Analyse des Échecs'; Britannica, 'Development of theory' | As openings-philidor; 'a standard manual for a century' matches a search result ('a standard chess manual for at least a century'). |
| `tl-turk` | 1770 | WEB | History.com, 'How a phony 18th-century chess robot fooled the world' | As machines-turk. |
| `tl-staunton` | 1849 | WEB | House of Staunton, 'The Staunton Chessmen History' | As culture-staunton. |
| `tl-london-1851` | 1851 | WEB | Chess.com, 'London 1851'; Wikipedia 'London 1851 chess tournament'; ChessBase on the Immortal Game | As culture-london-1851 and champions-immortal-game. |
| `tl-morphy-1858` | 1858 | WEB | Wikipedia 'Paul Morphy' and 'Opera Game' | As champions-morphy and champions-opera-game. |
| `tl-clocks-1883` | 1883 | WEB | Wikipedia 'Chess clock' and 'London 1883 chess tournament' | As rules-clock-1883. |
| `tl-steinitz-1886` | 1886 | WEB | Wikipedia 'World Chess Championship 1886'; Chess.com on Steinitz | As champions-steinitz-1886; 'a more positional, scientific style' is the standard description of Steinitz's contribution. |
| `tl-lasker-1894` | 1894 | KNOWN | Wikipedia 'Emanuel Lasker' | As champions-lasker-reign; that Lasker won the title from Steinitz in 1894 is standard and was not re-fetched. Fact-check 2026-09-30: same qualifier as champions-lasker-reign ('officially recognised'). |
| `tl-ajedrecista-1912` | 1912 | WEB | Wikipedia 'Leonardo Torres Quevedo'; Communications of the ACM, 'AI began in 1912' | As machines-torres-quevedo. |
| `tl-capablanca-1921` | 1921 | KNOWN | Wikipedia 'José Raúl Capablanca'; Britannica biography | Havana 1921: Lasker resigned the match after 14 games, trailing (+4 =10 for Capablanca). Standard; not re-fetched. |
| `tl-fide-1924` | 1924 | WEB | FIDE history pages; Wikipedia 'FIDE' | As rules-fide-1924. |
| `tl-olympiad-1927` | 1927 | WEB | Wikipedia 'Chess Olympiad'; World Chess Hall of Fame, 'Vera Menchik' | As culture-olympiad-1927. |
| `tl-buenos-aires-1939` | 1939 | WEB | Wikipedia 'Miguel Najdorf'; FIDE Museum, 8th Chess Olympiad | As champions-najdorf-1939; a search result names Najdorf, Ståhlberg and Eliskases as players who stayed in South America. |
| `tl-botvinnik-1948` | 1948 | WEB | Wikipedia 'World Chess Championship 1948'; New In Chess | As champions-botvinnik-1948; 'Soviet dominance' is from the New In Chess description of the event. |
| `tl-shannon-1950` | 1950 | WEB | Shannon, Philosophical Magazine 41 (1950) | As machines-shannon-paper. |
| `tl-elo-1970` | 1970 | WEB | ChessBase, 'Arpad Elo and the Elo Rating System'; Wikipedia 'Elo rating system' | As rules-elo-1970. Fact-check 2026-09-30: FIDE adopted the system in 1970 but its first published list dates from January 1971 (background knowledge, not re-verified), so the text says FIDE 'publica listas' instead of implying that everyone had a number at once. |
| `tl-fischer-1972` | 1972 | WEB | Encyclopaedia Britannica, 'Bobby Fischer'; History.com; Wikipedia 'Wilhelm Steinitz' (naturalised US citizen in 1888) | As champions-fischer-1972. Fact-check 2026-09-30: 'first American-born world champion', same wording as champions-fischer-1972 (Steinitz was naturalised in 1888). |
| `tl-kasparov-1985` | 1985 | WEB | Encyclopaedia Britannica, 'Garry Kasparov'; Wikipedia 'Karpov-Kasparov rivalry' | As champions-kasparov-1985; 'defined a decade' is a mild judgement. |
| `tl-deepblue-1996` | 1996 | WEB | Wikipedia 'Deep Blue versus Garry Kasparov'; History.com | As machines-deepblue-1996. |
| `tl-deepblue-1997` | 1997 | WEB | IBM Archives, 'Deep Blue'; Wikipedia 'Deep Blue versus Garry Kasparov' | As machines-deepblue-1997; wording follows the IBM/Wikipedia phrasing 'first computer system to defeat a reigning world champion in a match under standard tournament controls'. Fact-check 2026-09-30: added 'at standard tournament time controls': Chess Genius beat Kasparov in a two-game 25-minute rapid match (Intel Grand Prix, London, August 1994). |
| `tl-kasparov-world-1999` | 1999 | WEB | Wikipedia 'Kasparov versus the World'; Microsoft news archive, 1999 | As culture-kasparov-world. |
| `tl-reunification-2006` | 2006 | WEB | Wikipedia 'World Chess Championship 1993' and 'FIDE World Chess Championship 2006' | The 1993 break (Kasparov and Short left FIDE, PCA) lasted until the 2006 Elista unification match, won by Kramnik after rapid tiebreaks. |
| `tl-lichess-2010` | 2010 | WEB | Wikipedia 'Lichess'; lichess.org/about | As culture-lichess. |
| `tl-carlsen-2013` | 2013 | WEB | Wikipedia 'Magnus Carlsen' | As champions-carlsen and records-carlsen-rating. |
| `tl-alphazero-2017` | 2017 | WEB | Wikipedia 'AlphaZero'; ChessBase report (Dec 2017) | As machines-alphazero; 'changes how engines are thought about' is a mild judgement. Fact-check 2026-09-30: 'from the rules alone' added (it started from the rules of the game and used tree search). |
| `tl-boom-2020` | 2020 | WEB HEDGED | Bloomberg (Netflix figures); Slashfilm and eBay/Google search reports (late 2020) | As culture-queens-gambit-series; the search-interest claim is reported as 'according to reports at the time' (Google searches for 'how to play chess' at a nine-year high). |
| `tl-ding-2023` | 2023 | WEB | Wikipedia 'World Chess Championship 2023' | As champions-ding-2023. |
| `tl-gukesh-2024` | 2024 | WEB | FIDE news; Guinness World Records; press reports of 12 Dec 2024 | As champions-gukesh-2024. |

## Things that can go stale

Re-check these when the game moves on (a record can be broken, a title can change hands):

* `records-mishra` (youngest grandmaster), `records-carlsen-rating` (highest rating), `champions-gukesh-2024` and `champions-kasparov-1985` (youngest champion), `champions-polgar-top10` (only woman in the top ten), `records-ding-unbeaten` (the streak was later surpassed), `records-longest-game`, the two blindfold records.
* `machines-stockfish-2008` says this trainer runs Stockfish in the browser; it depends on the engine integration described in `docs/ARCHITECTURE.md` section 6.
* `culture-streaming` and `tl-boom-2020` describe a trend and are worded loosely on purpose.

## API as implemented

Section 12 of `docs/ARCHITECTURE.md` is followed; the additions are marked (+).

```
Ludus.Facts.CATEGORIES                 (+) frozen array of the eight category ids
Facts.all()                            -> Fact[]   frozen objects, a new array each call
Facts.get(id)                          -> Fact | null
Facts.byCategory(cat?)                 -> Fact[]   ([] for an unknown category, every fact for none)
Facts.pick({ exclude?, category?, lang?, random? }) -> Fact | null
      exclude: array of ids or facts, a Set, or one id. An excluded fact is never returned while
      another is left in the pool. When the pool is exhausted the cycle restarts (any fact except the
      last excluded one), so a valid category never yields null. With lang the result also carries
      { lang, body } (the text in that language). random: () => [0,1), for tests.
Facts.shuffled({ category?, random? })  (+) the facts in random order (Fisher-Yates on a copy)
Facts.text(idOrFact, lang?)            (+) -> string
Facts.timeline()                       -> [{ id, year, approx?, title:{es,en}, text:{es,en}, source }], oldest first
Facts.categories()                     (+) -> [{ id, label:{es,en}, labelKey, count }]
Facts.categoryLabel(cat, lang?)        (+) -> string
Facts.formatYear(itemOrYear, lang?)    (+) -> "1851" | "c. 600" | ""
Fact = { id, cat, year?, approx?, text:{es,en}, source }   (+ source, approx)

Ludus.Reader.readingTimeMs(text, lang)
Ludus.Reader.createCarousel(container, options) -> { start, stop, next, prev, pause, resume, destroy,
                                                    current(), state(), element }   (+ current, state, element)
Ludus.Reader.countWords / createScheduler / wrapIndex / shuffle / controllerLogic / LIMITS   (+)
```

i18n keys registered: `facts.title`, `facts.timeline`, `facts.category`, `facts.allCategories`, `facts.source`, `facts.circa` ("c. {year}"), `facts.cat.<category>` (eight labels), and `reader.region`, `reader.controls`, `reader.prev`, `reader.next`, `reader.pause`, `reader.play`, `reader.progress`, each in Spanish and English.

Size note: `js/facts.js` is about 100 KB of text (126 facts and 36 milestones, each in two languages, plus source hints). If the initial download ever matters, it can be loaded lazily with `Ludus.util.loadScript` before the first `createCarousel`; nothing else depends on it at load time.

## Reader classes

`js/reader.js` builds its own DOM (with `Ludus.util.h`; text only through `textContent`). Every element carries an `rd-` class so the design agent can style it later; **no CSS file was touched**. The carousel is usable without CSS (the live region is hidden with CSSOM styles set from JS, so no `style=""` attribute is needed, and the progress ring is an inline SVG using `currentColor`).

```
section.rd-carousel  [role=region, aria-roledescription=carousel, aria-label]
  div.rd-card                       (+ .rd-enter on each new fact, never under reduced motion)
    div.rd-meta
      span.rd-chip.rd-chip--<category>   category label (origins, champions, machines, rules,
                                         openings, culture, records, mind)
      span.rd-year                       "1851" or "c. 600"; has the hidden attribute when there is no year
    p.rd-text                            the fact
  div.rd-controls  [role=group]
    button.rd-btn.rd-prev                aria-label "Dato anterior" / "Previous fact"
    button.rd-btn.rd-toggle              pause/resume; + .rd-toggle--paused while the user's pause is on
    button.rd-btn.rd-next                aria-label "Dato siguiente" / "Next fact"
    span.rd-progress  [aria-hidden]      hidden attribute under reduced motion
      svg.rd-ring   (24x24)
        circle.rd-ring-track
        circle.rd-ring-arc               stroke-dashoffset is driven by JS every 100 ms while counting
  div.rd-live  [aria-live=polite]        visually hidden (inline style); only written on prev/next
```

Each button holds a `span.rd-icon` (`aria-hidden`) with a text glyph (‹ ❚❚ / ▶ ›) that a stylesheet may replace or hide; the accessible names are on the buttons.

State hooks on `section.rd-carousel`:

| Hook | Values |
| --- | --- |
| `data-state` | `idle` (not started or stopped), `running`, `paused` |
| `data-motion` | `full`, `reduce` |
| `data-cat` / `data-fact` | category id and fact id of the visible fact |
| classes `rd-is-running`, `rd-is-paused`, `rd-reduced` | same states as classes |
| custom property `--rd-progress` | `0`..`1`, the share of the current reading time already elapsed; usable for a bar instead of the ring |

Styling notes: keep the three buttons at least 44px, keep a visible focus outline (`:focus-visible`), do not convey the paused state by colour alone (the toggle's glyph and label change too), do not hide `.rd-live` with `display:none` (it would stop announcing), and remember that author CSS such as `display:flex` beats the browser rule for the `hidden` attribute: add `.rd-year[hidden], .rd-progress[hidden] { display: none; }`. Under reduced motion the reader already skips the ring and `.rd-enter`; a stylesheet should also skip any transition on `.rd-card`.

### Behaviour summary

* Reading time per fact: `clamp(words / 3 * 1000 + 1500, 6000, 24000)` ms (about 180 words per minute); the timer never fires before that much *counted* time.
* Paused (independently, all must clear to resume) by: the user's pause button, pointer hover (mouse or pen only), keyboard focus inside the carousel (`:focus-visible`), touch (kept for 5 s after the finger lifts), and a hidden tab. Resuming continues with the remaining time.
* Previous/next restart the reading time of the newly shown fact and are announced through the live region; the automatic rotation never announces.
* Pure, DOM-free pieces (unit-tested with a fake clock): `Reader.controllerLogic = { createScheduler, wrapIndex, shuffle, countWords, readingTimeMs }`.
* `createCarousel(container, { category?, lang?, onlyWhile?, onChange?, reducedMotion?, timers?, document?, window?, facts?, random? })`. `lang` fixed (else it follows `Ludus.i18n`); `onlyWhile()` is checked whenever the timer fires and stops the rotation when it returns false (call `start()` again to restart); the other options exist for tests.
