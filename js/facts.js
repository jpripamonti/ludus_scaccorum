// History facts and timeline data. Contract: docs/ARCHITECTURE.md section 12.
//
// Every fact is `{ id, cat, year?, approx?, text:{es,en}, source }`:
//   id      stable slug "<category>-<topic>", never reused
//   cat     origins | champions | machines | rules | openings | culture | records | mind
//   year    the year the fact is about (optional; `approx` marks "c. 600")
//   text    1-3 sentences, <= 260 characters per language; the Spanish is the
//           rioplatense register ("vos") wherever the text talks to the reader
//   source  a short hint of the type of source / reference the claim rests on
//           (language-neutral: titles, institutions, article names). The
//           verification notes for each id live in docs/FACTS_SOURCES.md.
//
// Timeline items are `{ id, year, approx?, title:{es,en}, text:{es,en}, source }`,
// strictly increasing by year.
//
// Only claims that are well documented are included. Where the historical
// record is disputed or only anecdotal, the text says so ("the story goes",
// "reportedly", "it is often said").
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Facts = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const CATEGORIES = ["origins", "champions", "machines", "rules", "openings", "culture", "records", "mind"];

  const CATEGORY_LABELS = {
    origins: { es: "Orígenes", en: "Origins" },
    champions: { es: "Campeones", en: "Champions" },
    machines: { es: "Máquinas", en: "Machines" },
    rules: { es: "Reglas", en: "Rules" },
    openings: { es: "Aperturas", en: "Openings" },
    culture: { es: "Cultura", en: "Culture" },
    records: { es: "Récords", en: "Records" },
    mind: { es: "Mente", en: "Mind" },
  };

  // ---------- Facts ----------

  const RAW_FACTS = [
    // ===== origins =====
    {
      id: "origins-chaturanga", cat: "origins", year: 600, approx: true,
      es: "El ajedrez desciende del chaturanga, un juego de estrategia surgido en la India hacia el siglo VI. Su nombre sánscrito significa «cuatro divisiones», las del ejército antiguo: infantería, caballería, elefantes y carros.",
      en: "Chess descends from chaturanga, a strategy game that emerged in India around the 6th century. Its Sanskrit name means “four divisions”, those of the ancient army: infantry, cavalry, elephants and chariots.",
      source: "Encyclopaedia Britannica, 'Chess'; H. J. R. Murray, A History of Chess (1913); Wiktionary 'chaturanga'",
    },
    {
      id: "origins-persia-chatrang", cat: "origins", year: 600, approx: true,
      es: "Al llegar a Persia, el juego pasó a llamarse chatrang. El texto en persa medio Chatrang-nāmag cuenta que un emisario indio lo llevó a la corte del rey Cosroes I. Es una historia legendaria, pero muestra cómo se recordaba su origen.",
      en: "In Persia the game became chatrang. The Middle Persian text Chatrang-nāmag tells how an Indian envoy brought it to the court of King Khosrow I. It is a legendary tale, but it shows how the game's origin was remembered.",
      source: "Chatrang-nāmag (Middle Persian text) as summarised in Wikipedia 'Chatrang' and Murray, A History of Chess",
    },
    {
      id: "origins-etymology-ajedrez", cat: "origins",
      es: "«Ajedrez» viene del árabe aš-šiṭranj, que a su vez viene del persa chatrang y este del sánscrito chaturanga: un mismo nombre transformado a lo largo de tres idiomas.",
      en: "The Spanish word “ajedrez” comes from Arabic ash-shiṭranj, which came from Persian chatrang and, before that, Sanskrit chaturanga: one name reshaped across three languages.",
      source: "Wiktionary 'ajedrez' (etymology); Encyclopaedia Britannica, 'Chess'",
    },
    {
      id: "origins-etymology-checkmate", cat: "origins",
      es: "«Jaque mate» viene del persa shāh māt. Suele traducirse como «el rey ha muerto», pero en persa māt significa «desconcertado, sin recursos»: el rey se queda sin salida.",
      en: "“Checkmate” comes from the Persian shāh māt. It is often translated “the king is dead”, but in Persian māt means “helpless” or “at a loss”: the king has nowhere left to go.",
      source: "Online Etymology Dictionary 'checkmate'; Wiktionary 'checkmate'",
    },
    {
      id: "origins-shatranj-islam", cat: "origins", year: 800, approx: true,
      es: "En el mundo islámico medieval el juego se llamó shatranj y se estudió con dedicación: hubo jugadores célebres, problemas y tratados. Desde allí llegó a Europa por varias rutas, entre ellas la España musulmana.",
      en: "In the medieval Islamic world the game was called shatranj and was studied seriously, with famous players, problems and treatises. From there it reached Europe by several routes, including Muslim Spain.",
      source: "Encyclopaedia Britannica, 'Chess'; Murray, A History of Chess (1913)",
    },
    {
      id: "origins-einsiedeln", cat: "origins", year: 1000, approx: true,
      es: "Uno de los textos europeos más antiguos sobre ajedrez es el poema latino de Einsiedeln, de hacia el año 1000 y conservado en una abadía suiza. Muestra que el juego ya se conocía en Europa occidental.",
      en: "One of the oldest European texts about chess is the Latin Einsiedeln poem, from about the year 1000, preserved in a Swiss abbey. It shows the game was already known in western Europe.",
      source: "Wikipedia 'Versus de scachis' (Einsiedeln Verses); Murray, A History of Chess (1913)",
    },
    {
      id: "origins-alfonso-x", cat: "origins", year: 1283,
      es: "En 1283 se completó el Libro de los juegos, encargado por Alfonso X de Castilla. Es uno de los tratados europeos de ajedrez más antiguos que se conservan y reúne problemas de ajedrez junto con juegos de dados y tablas.",
      en: "The Libro de los juegos, commissioned by Alfonso X of Castile, was completed in 1283. It is one of the oldest surviving European chess treatises and collects chess problems along with games of dice and tables.",
      source: "Wikipedia 'Libro de los juegos'; manuscript T.I.6, Real Biblioteca de El Escorial",
    },
    {
      id: "origins-cessolis", cat: "origins", year: 1300, approx: true,
      es: "Hacia 1300, el fraile Jacobo de Cessolis escribió un tratado que usa las piezas del ajedrez como alegoría de la sociedad medieval. Se copió y tradujo muchísimo, y Caxton lo imprimió en inglés hacia 1474.",
      en: "Around 1300 the friar Jacobus de Cessolis wrote a treatise that uses the chess pieces as an allegory of medieval society. It was copied and translated widely, and Caxton printed an English version around 1474.",
      source: "Project Gutenberg, 'The Game and Playe of the Chesse' (Caxton); Morgan Library incunabula record",
    },
    {
      id: "origins-old-pieces", cat: "origins",
      es: "Antes de fines del siglo XV la dama era una pieza débil que se movía una casilla en diagonal, y el alfil saltaba de a dos casillas en diagonal. Con las reglas modernas el juego se volvió mucho más dinámico.",
      en: "Before the late 15th century the queen was a weak piece that moved one square diagonally, and the bishop leapt exactly two squares diagonally. The modern rules made the game far more dynamic.",
      source: "Encyclopaedia Britannica, 'Chess'; Murray, A History of Chess (1913)",
    },
    {
      id: "origins-scachs-damor", cat: "origins", year: 1475, approx: true,
      es: "El poema valenciano Scachs d'amor, de hacia 1475, describe una partida alegórica, la más antigua que se conoce con los movimientos modernos de la dama y el alfil. Por eso se lo cita al hablar del nacimiento del ajedrez moderno.",
      en: "The Valencian poem Scachs d'amor, from about 1475, describes an allegorical game, the earliest known with the modern moves of the queen and bishop. That is why it is cited for the birth of modern chess.",
      source: "Wikipedia 'Scachs d'amor'; ChessBase, 'Scachs d'amor: the empowered queen'",
    },
    {
      id: "origins-lucena", cat: "origins", year: 1497, approx: true,
      es: "El libro de Luis Ramírez de Lucena, impreso en Salamanca hacia 1497, es el libro impreso más antiguo que se conserva sobre cómo jugar al ajedrez. Explica tanto las reglas antiguas como las nuevas, con la dama poderosa.",
      en: "Luis Ramírez de Lucena's book, printed in Salamanca around 1497, is the oldest surviving printed book on how to play chess. It covers both the old rules and the new ones, with the powerful queen.",
      source: "Wikipedia 'Luis Ramírez de Lucena' and 'Francesc Vicent'; ChessBase auction report on the surviving copy",
    },
    {
      id: "origins-lewis-chessmen", cat: "origins", year: 1150, approx: true,
      es: "Las piezas de Lewis, halladas en 1831 en una isla de Escocia, se tallaron en marfil de morsa y dientes de ballena en el siglo XII, probablemente en Noruega. La mayoría está hoy en el Museo Británico y otras en Edimburgo.",
      en: "The Lewis chessmen, found in 1831 on a Scottish island, were carved from walrus ivory and whale teeth in the 12th century, probably in Norway. Most are now in the British Museum, and others in Edinburgh.",
      source: "British Museum collection (1831,1101); Metropolitan Museum 'The Game of Kings' (2011); Wikipedia 'Lewis chessmen'",
    },
    {
      id: "origins-bishop-names", cat: "origins",
      es: "En español el alfil conserva el nombre árabe del elefante (al-fīl), la pieza original. En ruso todavía se llama «elefante» (slon); en francés es fou («bufón») y en inglés, bishop («obispo»).",
      en: "In Spanish the bishop keeps the Arabic word for elephant (al-fīl), the original piece. In Russian it is still “elephant” (slon), in French it is fou (“jester”), and in English, bishop.",
      source: "Wiktionary 'alfil', 'слон', 'fou'; Encyclopaedia Britannica, 'Chess'",
    },

    // ===== rules =====
    {
      id: "rules-fide-1924", cat: "rules", year: 1924,
      es: "La FIDE (Fédération Internationale des Échecs) se fundó en París el 20 de julio de 1924. Su lema, «Gens una sumus», significa «somos una sola familia».",
      en: "FIDE (Fédération Internationale des Échecs), the World Chess Federation, was founded in Paris on 20 July 1924. Its motto, “Gens una sumus”, means “We are one family”.",
      source: "FIDE history pages ('FIDE turns 99'); Wikipedia 'FIDE'",
    },
    {
      id: "rules-elo-1970", cat: "rules", year: 1970,
      es: "El sistema Elo, ideado por el físico húngaro-estadounidense Arpad Elo, lo adoptó la federación de Estados Unidos en 1960 y la FIDE en 1970. Estima la fuerza de cada jugador a partir de sus resultados.",
      en: "The Elo system, devised by the Hungarian-born physicist Arpad Elo, was adopted by the US chess federation in 1960 and by FIDE in 1970. It estimates each player's strength from their results.",
      source: "ChessBase, 'Arpad Elo and the Elo Rating System'; World Chess Hall of Fame; Wikipedia 'Elo rating system'",
    },
    {
      id: "rules-elo-expected", cat: "rules",
      es: "En el sistema Elo, una diferencia de 200 puntos significa que el favorito espera sumar cerca del 76% de los puntos. Con 100 puntos de diferencia, alrededor del 64%.",
      en: "In the Elo system, a 200-point rating gap means the favourite is expected to score about 76% of the points. With a 100-point gap, about 64%.",
      source: "Elo expected-score formula E = 1 / (1 + 10^(-d/400)); the two figures were computed from it",
    },
    {
      id: "rules-grandmaster-1950", cat: "rules", year: 1950,
      es: "En 1950 la FIDE otorgó por primera vez, de manera oficial, el título de gran maestro. Antes, la expresión circulaba como un elogio informal para los mejores jugadores.",
      en: "In 1950 FIDE officially awarded the title of grandmaster for the first time. Before that, the word circulated as an informal compliment for the strongest players.",
      source: "Wikipedia 'FIDE titles'; Edward Winter, Chess Notes, 'Grandmasters' (chesshistory.com)",
    },
    {
      id: "rules-clock-1883", cat: "rules", year: 1883,
      es: "En el torneo de Londres de 1883 se usaron por primera vez en competencia los relojes de ajedrez dobles, inventados por Thomas Bright Wilson. Antes, el tiempo se controlaba de forma más rudimentaria, por ejemplo con relojes de arena.",
      en: "The London 1883 tournament was the first to use double chess clocks in competition, invented by Thomas Bright Wilson. Before that, time was controlled more crudely, for example with sand-glasses.",
      source: "Wikipedia 'Chess clock' and 'London 1883 chess tournament'; ChessBase 'London 1883: prelude to the first World Championship match'",
    },
    {
      id: "rules-fischer-clock", cat: "rules", year: 1988,
      es: "Bobby Fischer solicitó en 1988 la patente de un reloj digital (concedida en 1989) que suma tiempo extra después de cada jugada (el «incremento»). Hoy los controles de tiempo con incremento están muy extendidos.",
      en: "Bobby Fischer filed in 1988 for a patent (granted 1989) on a digital clock that adds extra time after every move (the “increment”). Time controls with increment are now very widespread.",
      source: "US patent 4,884,255 (filed 1988, granted 1989); Wikipedia 'Chess clock'",
    },
    {
      id: "rules-promotion", cat: "rules",
      es: "Un peón que llega a la última fila se corona: puede convertirse en dama, torre, alfil o caballo, pero no en rey. Elegir caballo en vez de dama se llama subpromoción y a veces es la única jugada ganadora.",
      en: "A pawn that reaches the last rank promotes: it can become a queen, rook, bishop or knight, but not a king. Choosing a knight instead of a queen is called underpromotion, and sometimes it is the only winning move.",
      source: "FIDE Laws of Chess, Article 3.7 (promotion)",
    },
    {
      id: "rules-en-passant", cat: "rules",
      es: "El avance de dos casillas del peón se sumó al ajedrez europeo hacia el siglo XV para acelerar el juego. Se suele explicar que la captura al paso nació como remedio para que ese salto no dejara pasar sin castigo a un peón enemigo.",
      en: "The pawn's two-square first move joined European chess around the 15th century to speed up the game. En passant capture is usually explained as the remedy so that this jump could not let an enemy pawn slip past unpunished.",
      source: "Wikipedia 'En passant'; Murray, A History of Chess (1913)",
    },
    {
      id: "rules-castling", cat: "rules",
      es: "El enroque es la única jugada en la que se mueven dos piezas a la vez. Se fue formando en Europa durante siglos y sus reglas actuales se terminaron de uniformar recién a fines del siglo XIX.",
      en: "Castling is the only move in which two pieces move at once. It took shape in Europe over centuries, and its present rules were only standardised in the late 19th century.",
      source: "Wikipedia 'Castling' (history section); Murray, A History of Chess (1913)",
    },
    {
      id: "rules-stalemate", cat: "rules",
      es: "El ahogado (rey sin jugadas legales y sin estar en jaque) hoy es tablas. En el shatranj solía ser, en cambio, una victoria para quien lo provocaba, y en Europa las reglas variaron durante siglos; la actual se generalizó a principios del siglo XIX.",
      en: "Stalemate (no legal move and not in check) is a draw today. In shatranj it was generally a win for the player who caused it, and rules varied across Europe for centuries; the present rule became standard in the early 19th century.",
      source: "Wikipedia 'Stalemate' (history); Murray, A History of Chess (1913)",
    },
    {
      id: "rules-fifty-move", cat: "rules",
      es: "Según la regla de las 50 jugadas, se puede reclamar tablas si en 50 jugadas de cada bando no hubo capturas ni movimientos de peón. La FIDE agregó además un empate automático a las 75 jugadas de cada bando.",
      en: "Under the 50-move rule a player can claim a draw if 50 moves by each side pass without a capture or a pawn move. FIDE also has an automatic draw after 75 moves by each side.",
      source: "FIDE Laws of Chess, Articles 9.3 and 9.6",
    },
    {
      id: "rules-stamma-notation", cat: "rules", year: 1737,
      es: "Philipp Stamma, un maestro nacido en Alepo, publicó en 1737 una versión casi completa de la notación algebraica, la que hoy usamos para anotar las jugadas.",
      en: "Philipp Stamma, a master born in Aleppo, published in 1737 an almost fully developed form of algebraic notation, the one we use today to record moves.",
      source: "Wikipedia 'Philipp Stamma'; Chess.com, 'The creator of algebraic chess notation'",
    },
    {
      id: "rules-chess960", cat: "rules", year: 1996,
      es: "Bobby Fischer anunció en 1996, en Buenos Aires, el ajedrez aleatorio (Chess960): las piezas de la fila trasera se sortean con algunas restricciones (alfiles en colores opuestos, rey entre las torres), y hay 960 posiciones iniciales posibles.",
      en: "Bobby Fischer announced Fischer Random Chess (Chess960) in Buenos Aires in 1996: the back-rank pieces are shuffled within a few restrictions (bishops on opposite colours, king between the rooks), giving 960 possible starting positions.",
      source: "Wikipedia 'Chess960'; FIDE Fischer Random Chess history page",
    },

    // ===== champions =====
    {
      id: "champions-steinitz-1886", cat: "champions", year: 1886,
      es: "En 1886, Wilhelm Steinitz venció a Johannes Zukertort por 12,5 a 7,5 en el primer match por el título mundial reconocido como oficial. Se jugó en Nueva York, San Luis y Nueva Orleans.",
      en: "In 1886 Wilhelm Steinitz beat Johannes Zukertort 12.5-7.5 in the first World Championship match regarded as official. It was played in New York, St. Louis and New Orleans.",
      source: "Wikipedia 'World Chess Championship 1886'; Chess.com, 'Steinitz: the official World Chess Champion'",
    },
    {
      id: "champions-lasker-reign", cat: "champions", year: 1894,
      es: "Emanuel Lasker fue campeón mundial de 1894 a 1921, casi 27 años: el reinado más largo de un campeón mundial oficial.",
      en: "Emanuel Lasker was world champion from 1894 to 1921, nearly 27 years: the longest reign of any officially recognised world champion.",
      source: "Wikipedia 'Emanuel Lasker'; Chess.com, '27 years as world champion'",
    },
    {
      id: "champions-lasker-math", cat: "champions", year: 1905,
      es: "Lasker era doctor en matemáticas (Erlangen, 1902). El teorema de Lasker–Noether, del álgebra conmutativa, se apoya en un resultado que él publicó en 1905.",
      en: "Lasker held a doctorate in mathematics (Erlangen, 1902). The Lasker–Noether theorem in commutative algebra builds on a result he published in 1905.",
      source: "MacTutor History of Mathematics, 'Emanuel Lasker'; Wikipedia 'Primary decomposition'",
    },
    {
      id: "champions-capablanca-unbeaten", cat: "champions", year: 1924,
      es: "José Raúl Capablanca pasó unos ocho años, de 1916 a 1924, sin perder una partida de torneo o match: 63 seguidas, según los registros. Lo derrotó Richard Réti en el torneo de Nueva York de 1924.",
      en: "José Raúl Capablanca went about eight years, from 1916 to 1924, without losing a tournament or match game: 63 in a row, according to the records. Richard Réti beat him at New York 1924.",
      source: "Wikipedia 'New York 1924 chess tournament'; ChessBase report on New York 1924, round 5",
    },
    {
      id: "champions-capablanca-life", cat: "champions", year: 1913,
      es: "Según su propio relato, Capablanca aprendió a jugar a los cuatro años mirando a su padre. En 1913 entró al servicio exterior cubano como embajador itinerante, un cargo que le permitió viajar por el mundo.",
      en: "By his own account, Capablanca learned to play at age four by watching his father. In 1913 he joined the Cuban foreign service as a roving ambassador, a post that let him travel the world.",
      source: "Capablanca, My Chess Career (1920); Chess.com biography; World Chess Hall of Fame",
    },
    {
      id: "champions-alekhine-died", cat: "champions", year: 1946,
      es: "Alexander Alekhine es el único campeón mundial que murió siendo campeón: falleció en Estoril, Portugal, en 1946, mientras se negociaba un match con Botvinnik.",
      en: "Alexander Alekhine is the only world champion to die while still holding the title. He died in Estoril, Portugal, in 1946, while a match with Botvinnik was being negotiated.",
      source: "Wikipedia 'Alexander Alekhine'; ChessBase, 'Alekhine's death'",
    },
    {
      id: "champions-botvinnik-1948", cat: "champions", year: 1948,
      es: "Tras la muerte de Alekhine, la FIDE organizó en 1948 un torneo entre cinco grandes maestros en La Haya y Moscú. Lo ganó Mikhail Botvinnik, que se convirtió así en campeón mundial.",
      en: "After Alekhine's death, FIDE organised a five-player tournament in The Hague and Moscow in 1948. Mikhail Botvinnik won it and became world champion.",
      source: "Wikipedia 'World Chess Championship 1948'; New In Chess, 'World Chess Championship 1948'",
    },
    {
      id: "champions-botvinnik-engineer", cat: "champions", year: 1951,
      es: "Botvinnik era ingeniero electricista: obtuvo el doctorado en ciencias técnicas en 1951 y fue pionero de la programación de computadoras para jugar al ajedrez.",
      en: "Botvinnik was an electrical engineer: he earned a doctorate in technical sciences in 1951 and was a pioneer in programming computers to play chess.",
      source: "Wikipedia 'Mikhail Botvinnik'; ChessBase, 'Mikhail Botvinnik - hundredth anniversary'",
    },
    {
      id: "champions-euwe", cat: "champions", year: 1935,
      es: "Max Euwe, campeón mundial de 1935 a 1937, era doctor en matemáticas (1926), fue profesor de programación de computadoras en universidades neerlandesas y presidió la FIDE de 1970 a 1978.",
      en: "Max Euwe, world champion from 1935 to 1937, held a doctorate in mathematics (1926), was a professor of computer programming at Dutch universities and was FIDE president from 1970 to 1978.",
      source: "Wikipedia 'Max Euwe'; MacTutor History of Mathematics, 'Machgielis Euwe'",
    },
    {
      id: "champions-bronstein-1951", cat: "champions", year: 1951,
      es: "En 1951, David Bronstein empató 12 a 12 el match por el título con Botvinnik, y por reglamento el campeón conservó la corona. Tras 22 partidas, Bronstein iba arriba por 11,5 a 10,5.",
      en: "In 1951 David Bronstein drew the title match with Botvinnik 12-12, and under the rules the champion kept the crown. After 22 games Bronstein had been ahead 11.5-10.5.",
      source: "Wikipedia 'World Chess Championship 1951'; Chessentials, 'Botvinnik - Bronstein 1951'",
    },
    {
      id: "champions-tal-1960", cat: "champions", year: 1960,
      es: "Mikhail Tal, el «Mago de Riga», ganó el título mundial en 1960, con 23 años, al vencer a Botvinnik por 12,5 a 8,5. Era famoso por sus sacrificios audaces.",
      en: "Mikhail Tal, the “Magician from Riga”, won the world title in 1960, aged 23, beating Botvinnik 12.5-8.5. He was famous for his daring sacrifices.",
      source: "Wikipedia 'Mikhail Tal'; Encyclopaedia Britannica, 'Mikhail Tal'",
    },
    {
      id: "champions-fischer-1972", cat: "champions", year: 1972,
      es: "En 1972, en Reikiavik, Bobby Fischer venció a Boris Spassky por 12,5 a 8,5 y fue el primer campeón mundial nacido en Estados Unidos. Ese año llegó a un rating de 2785, el más alto de la historia hasta entonces.",
      en: "In 1972, in Reykjavik, Bobby Fischer beat Boris Spassky 12.5-8.5 and became the first American-born world champion. That year he reached a rating of 2785, the highest in history up to then.",
      source: "Encyclopaedia Britannica, 'Bobby Fischer'; History.com; Wikipedia 'World Chess Championship 1972' and 'Wilhelm Steinitz' (naturalised US citizen in 1888)",
    },
    {
      id: "champions-fischer-streak", cat: "champions", year: 1971,
      es: "Entre 1970 y 1971, Fischer ganó 20 partidas seguidas contra rivales de élite, incluidas dos barridas por 6 a 0, sin precedentes, en los Candidatos: contra Taimanov y contra Larsen.",
      en: "Between 1970 and 1971 Fischer won 20 games in a row against elite opponents, including two unprecedented 6-0 sweeps in the Candidates: against Taimanov and against Larsen.",
      source: "Encyclopaedia Britannica, 'Bobby Fischer'; Wikipedia 'Bobby Fischer'",
    },
    {
      id: "champions-karpov-1975", cat: "champions", year: 1975,
      es: "En 1975, Fischer no defendió su título por desacuerdos con la FIDE sobre las condiciones del match, y Anatoli Kárpov fue proclamado campeón sin jugar.",
      en: "In 1975 Fischer did not defend his title after disagreements with FIDE over the match conditions, and Anatoly Karpov was declared champion without playing.",
      source: "Wikipedia 'World Chess Championship 1975'; Encyclopaedia Britannica, 'Bobby Fischer'",
    },
    {
      id: "champions-karpov-kasparov", cat: "champions", year: 1990,
      es: "Kárpov y Kaspárov jugaron cinco matches por el título entre 1984 y 1990: 144 partidas, con 21 victorias de Kaspárov, 19 de Kárpov y 104 tablas.",
      en: "Karpov and Kasparov played five title matches between 1984 and 1990: 144 games, with 21 wins for Kasparov, 19 for Karpov and 104 draws.",
      source: "Wikipedia 'Karpov-Kasparov rivalry'; Timman, The Longest Game",
    },
    {
      id: "champions-1984-halted", cat: "champions", year: 1985,
      es: "El match de 1984-85 entre Kárpov y Kaspárov, a seis victorias, se suspendió sin resultado tras más de cinco meses y 48 partidas, con Kárpov arriba por 5 a 3.",
      en: "The 1984-85 Karpov-Kasparov match, played to six wins, was halted without a result after more than five months and 48 games, with Karpov ahead 5-3.",
      source: "Wikipedia 'World Chess Championship 1984'; Timman, The Longest Game",
    },
    {
      id: "champions-kasparov-1985", cat: "champions", year: 1985,
      es: "En 1985, Garry Kaspárov derrotó a Kárpov y, con 22 años, se convirtió en el campeón mundial más joven hasta ese momento.",
      en: "In 1985 Garry Kasparov beat Karpov and, aged 22, became the youngest world champion up to that time.",
      source: "Encyclopaedia Britannica, 'Garry Kasparov'; Wikipedia 'Garry Kasparov'",
    },
    {
      id: "champions-kramnik-2000", cat: "champions", year: 2000,
      es: "En Londres 2000, Vladimir Krámnik venció a Kaspárov por 8,5 a 6,5 sin perder ninguna partida (2 victorias y 13 tablas), apoyado en la sólida Defensa Berlinesa.",
      en: "In London 2000 Vladimir Kramnik beat Kasparov 8.5-6.5 without losing a single game (2 wins and 13 draws), relying on the solid Berlin Defence.",
      source: "ChessBase, '25 years ago: Kramnik beats Kasparov'; Encyclopaedia Britannica",
    },
    {
      id: "champions-menchik-title", cat: "champions", year: 1927,
      es: "Vera Menchik ganó el primer Campeonato Mundial Femenino en 1927 y conservó el título hasta 1944, cuando murió al caer una bomba voladora V-1 sobre su casa de Londres.",
      en: "Vera Menchik won the first Women's World Championship in 1927 and kept the title until 1944, when she died after a V-1 flying bomb hit her home in London.",
      source: "World Chess Hall of Fame, 'Vera Menchik'; British Chess News",
    },
    {
      id: "champions-menchik-club", cat: "champions", year: 1929,
      es: "Cuenta la anécdota que en 1929 Albert Becker bromeó con que quien perdiera contra Vera Menchik ingresaría a su «club»; él fue el primer socio. Luego se sumaron maestros como Max Euwe y Sultan Khan.",
      en: "The story goes that in 1929 Albert Becker joked that anyone who lost to Vera Menchik would join her “club”; he became its first member. Masters such as Max Euwe and Sultan Khan later joined.",
      source: "Edward Winter, 'The Vera Menchik Club' (chesshistory.com; notes the story may be apocryphal); Wikipedia 'Albert Becker'",
    },
    {
      id: "champions-polgar-top10", cat: "champions", year: 2005,
      es: "Judit Polgár llegó al puesto 8 del ranking mundial en 2005 y, hasta ahora, es la única mujer que estuvo entre los diez mejores del mundo. En 2002 le ganó una partida rápida a Kaspárov.",
      en: "Judit Polgár reached No. 8 in the world rankings in 2005 and is, so far, the only woman ever to be in the world's top ten. In 2002 she beat Kasparov in a rapid game.",
      source: "Wikipedia 'Judit Polgár'; FIDE 'Women of the Month: Judit Polgar'",
    },
    {
      id: "champions-polgar-1991", cat: "champions", year: 1991,
      es: "En 1991, Judit Polgár se hizo gran maestra a los 15 años y 4 meses, y superó el récord de Fischer, que llevaba 33 años vigente. Ese año su hermana Susan fue la primera mujer en lograr el título por normas.",
      en: "In 1991 Judit Polgár became a grandmaster at 15 years and 4 months, beating Fischer's 33-year-old record. That year her sister Susan was the first woman to earn the title through norms.",
      source: "Wikipedia 'Judit Polgár' and 'Susan Polgar'; FIDE Women in Chess pages",
    },
    {
      id: "champions-carlsen", cat: "champions", year: 2013,
      es: "Magnus Carlsen se hizo gran maestro en 2004, con 13 años, y fue campeón mundial en 2013, tras vencer a Viswanathan Anand en Chennai por 6,5 a 3,5.",
      en: "Magnus Carlsen became a grandmaster in 2004, aged 13, and world champion in 2013 after beating Viswanathan Anand in Chennai 6.5-3.5.",
      source: "Wikipedia 'Magnus Carlsen'; FIDE World Championship 2013 pages",
    },
    {
      id: "champions-ding-2023", cat: "champions", year: 2023,
      es: "En 2023, Ding Liren venció a Ian Nepomniachtchi en el desempate y se convirtió en el primer chino campeón mundial masculino.",
      en: "In 2023 Ding Liren beat Ian Nepomniachtchi in the tiebreak and became the first Chinese men's world champion.",
      source: "Wikipedia 'World Chess Championship 2023'; FIDE news",
    },
    {
      id: "champions-gukesh-2024", cat: "champions", year: 2024,
      es: "En diciembre de 2024, con 18 años, Gukesh Dommaraju se convirtió en el campeón mundial más joven de la historia al vencer a Ding Liren por 7,5 a 6,5 en Singapur.",
      en: "In December 2024, aged 18, Gukesh Dommaraju became the youngest world champion in history by beating Ding Liren 7.5-6.5 in Singapore.",
      source: "FIDE news on the 2024 World Championship; Guinness World Records; press reports of 12 Dec 2024",
    },
    {
      id: "champions-morphy", cat: "champions", year: 1857,
      es: "Paul Morphy se recibió de abogado en Luisiana a los 19 años, todavía sin edad para ejercer. En 1857 ganó el primer Congreso de Ajedrez de Estados Unidos y en 1858 viajó a Europa, donde venció a los mejores del momento.",
      en: "Paul Morphy earned his law degree in Louisiana at 19, still too young to practise. In 1857 he won the first American Chess Congress and in 1858 he travelled to Europe, where he beat the leading players of the day.",
      source: "Wikipedia 'Paul Morphy'; Encyclopaedia Britannica, 'Paul Charles Morphy'",
    },
    {
      id: "champions-opera-game", cat: "champions", year: 1858,
      es: "En 1858, Morphy jugó la «Partida de la Ópera» desde un palco de París, mientras se representaba Norma. Ganó en 17 jugadas a dos aficionados nobles que jugaban en consulta: el duque de Brunswick y el conde Isouard.",
      en: "In 1858 Morphy played the “Opera Game” from a box at the opera in Paris, during a performance of Norma. He won in 17 moves against two noble amateurs playing in consultation: the Duke of Brunswick and Count Isouard.",
      source: "Wikipedia 'Opera Game'; ChessBase, '50 games you should know: Morphy vs Duke of Brunswick and Count Isouard'",
    },
    {
      id: "champions-immortal-game", cat: "champions", year: 1851,
      es: "El 21 de junio de 1851, al margen del torneo de Londres, Adolf Anderssen ganó la «Partida Inmortal» a Lionel Kieseritzky: sacrificó dos torres, un alfil y la dama, y dio mate con las tres piezas menores que le quedaban.",
      en: "On 21 June 1851, on the sidelines of the London tournament, Adolf Anderssen won the “Immortal Game” against Lionel Kieseritzky: he gave up both rooks, a bishop and his queen, and mated with his three remaining minor pieces.",
      source: "Wikipedia 'Immortal Game'; ChessBase, '175 years ago: Anderssen's Immortal Game'",
    },
    {
      id: "champions-rubinstein-1912", cat: "champions", year: 1912,
      es: "En 1912, Akiba Rubinstein ganó varios torneos importantes y desafió a Lasker por el título. El match se acordó para el otoño de 1914, pero la Primera Guerra Mundial lo canceló.",
      en: "In 1912 Akiba Rubinstein won several major tournaments and challenged Lasker for the title. The match was agreed for autumn 1914, but the First World War cancelled it.",
      source: "Wikipedia 'Akiba Rubinstein'; Chess.com player biography",
    },
    {
      id: "champions-keres", cat: "champions", year: 1962,
      es: "Paul Keres terminó segundo, o compartió el segundo puesto, en los torneos de Candidatos de 1953, 1956, 1959 y 1962, pero nunca jugó un match por el título mundial. Se lo llamó «el eterno segundo».",
      en: "Paul Keres finished second, or shared second place, in the Candidates tournaments of 1953, 1956, 1959 and 1962, but never played a world championship match. He was nicknamed “the eternal second”.",
      source: "Wikipedia 'Paul Keres'; chess24 'Paul Keres VI: the eternal second'",
    },
    {
      id: "champions-najdorf-1939", cat: "champions", year: 1939,
      es: "Miguel Najdorf jugaba por Polonia en la Olimpíada de Buenos Aires cuando estalló la Segunda Guerra Mundial, en 1939. Decidió quedarse en Argentina, de la que obtuvo la ciudadanía en 1944.",
      en: "Miguel Najdorf was playing for Poland at the Buenos Aires Olympiad when the Second World War broke out in 1939. He decided to stay in Argentina, whose citizenship he obtained in 1944.",
      source: "Wikipedia 'Miguel Najdorf'; FIDE Museum, 8th Chess Olympiad bulletin",
    },
    {
      id: "champions-korchnoi-stateless", cat: "champions", year: 1978,
      es: "Tras huir de la Unión Soviética en 1976, Viktor Kórchnoi compitió sin nacionalidad a fines de los años 70, incluido el match por el título de 1978. Se nacionalizó suizo hacia 1980.",
      en: "After leaving the Soviet Union in 1976, Viktor Korchnoi competed as a stateless player in the late 1970s, including the 1978 title match. He became a Swiss citizen around 1980.",
      source: "Wikipedia 'Viktor Korchnoi'; Swissinfo obituary (2016)",
    },
    {
      id: "champions-korchnoi-yogurt", cat: "champions", year: 1978,
      es: "En el match de 1978, el equipo de Kórchnoi protestó por un yogur de arándanos que le llevaron a Kárpov en plena partida: temían que fuera una señal en clave. Se reglamentó qué yogur y a qué hora podía servirse.",
      en: "In the 1978 match Korchnoi's team protested a blueberry yogurt delivered to Karpov mid-game, fearing it was a coded signal. Rules were then set for which yogurt could be served, and when.",
      source: "Wikipedia 'World Chess Championship 1978'; Philippine press retrospectives (Inquirer, Cover Story)",
    },
    {
      id: "champions-smyslov-singer", cat: "champions", year: 1957,
      es: "Vasili Smyslov, campeón mundial en 1957-58, era barítono: en 1950 se presentó a una audición del Teatro Bolshói y más tarde dio conciertos de canto.",
      en: "Vasily Smyslov, world champion in 1957-58, was a baritone: in 1950 he auditioned for the Bolshoi Theatre and later gave singing concerts.",
      source: "Wikipedia 'Vasily Smyslov'; FIDE Museum, 'Smyslov's concert setlist'",
    },
    {
      id: "champions-taimanov-pianist", cat: "champions",
      es: "Mark Taimanov fue gran maestro y también pianista de concierto: durante años formó un dúo de piano con su primera esposa, Liubov Bruk.",
      en: "Mark Taimanov was a grandmaster and also a concert pianist: for years he performed in a piano duo with his first wife, Lyubov Bruk.",
      source: "Wikipedia 'Mark Taimanov'; The Week in Chess obituary (2016)",
    },
    {
      id: "champions-fine-psychologist", cat: "champions", year: 1951,
      es: "Reuben Fine, uno de los mejores del mundo en los años 30 y 40, dejó el ajedrez profesional hacia 1951 para dedicarse a la psicología; se había doctorado en 1948.",
      en: "Reuben Fine, one of the world's best in the 1930s and 1940s, gave up professional chess around 1951 to work in psychology; he had earned his doctorate in 1948.",
      source: "Wikipedia 'Reuben Fine'; Edward Winter, Chess Notes on Fine",
    },
    {
      id: "champions-reshevsky-accountant", cat: "champions", year: 1920,
      es: "Samuel Reshevsky fue un niño prodigio que a los ocho años daba simultáneas contra adultos. Ya grande se recibió de contador en la Universidad de Chicago (1934) y trabajó en esa profesión.",
      en: "Samuel Reshevsky was a child prodigy who gave simultaneous exhibitions against adults at eight. As an adult he graduated in accounting from the University of Chicago (1934) and worked in that profession.",
      source: "Wikipedia 'Samuel Reshevsky'; Encyclopedia.com biography",
    },
    {
      id: "champions-vidmar-engineer", cat: "champions",
      es: "Milan Vidmar fue gran maestro y a la vez ingeniero eléctrico, especialista en transformadores. Ayudó a fundar la Facultad de Ingeniería Eléctrica de la Universidad de Liubliana y fue rector de esa universidad.",
      en: "Milan Vidmar was both a grandmaster and an electrical engineer, a specialist in power transformers. He helped found the Faculty of Electrical Engineering at the University of Ljubljana and served as the university's rector.",
      source: "Wikipedia 'Milan Vidmar'; Chess.com, 'The engineering career of Milan Vidmar'",
    },

    // ===== machines =====
    {
      id: "machines-turk", cat: "machines", year: 1770,
      es: "El Turco, construido en 1770 por Wolfgang von Kempelen, parecía un autómata que jugaba al ajedrez, pero escondía a una persona en su interior. Recorrió Europa y América durante décadas hasta que un incendio lo destruyó en 1854.",
      en: "The Turk, built in 1770 by Wolfgang von Kempelen, looked like a chess-playing automaton but hid a human player inside. It toured Europe and America for decades until a fire destroyed it in 1854.",
      source: "History.com, 'How a phony 18th-century chess robot fooled the world'; Big Think; Standage, The Turk (2002)",
    },
    {
      id: "machines-turk-napoleon", cat: "machines", year: 1809,
      es: "Según los relatos, en 1809 el Turco jugó contra Napoleón, y cuando este hizo una jugada ilegal el autómata barrió las piezas del tablero. También se dice que enfrentó a Benjamin Franklin en París hacia 1783.",
      en: "According to the accounts, in 1809 the Turk played Napoleon, and when he made an illegal move the automaton swept the pieces off the board. It is also said to have played Benjamin Franklin in Paris around 1783.",
      source: "History.com and Big Think articles on the Mechanical Turk; Standage, The Turk (2002). Anecdotal details, hence 'according to'",
    },
    {
      id: "machines-torres-quevedo", cat: "machines", year: 1912,
      es: "El ingeniero español Leonardo Torres Quevedo construyó en 1912 El Ajedrecista, una máquina electromecánica que daba mate de rey y torre contra rey sin ayuda humana. Se presentó en París en 1914.",
      en: "The Spanish engineer Leonardo Torres Quevedo built El Ajedrecista in 1912, an electromechanical machine that delivered king-and-rook against king mate with no human help. It was shown in Paris in 1914.",
      source: "Wikipedia 'Leonardo Torres Quevedo'; historyofinformation.com; Communications of the ACM, 'AI began in 1912'",
    },
    {
      id: "machines-turochamp", cat: "machines", year: 1948,
      es: "En 1948, Alan Turing y David Champernowne diseñaron Turochamp, un programa de ajedrez pensado para ejecutarse a mano. En 1952 Turing lo simuló paso a paso contra Alick Glennie, y perdió.",
      en: "In 1948 Alan Turing and David Champernowne designed Turochamp, a chess program meant to be run by hand. In 1952 Turing simulated it step by step against Alick Glennie, and it lost.",
      source: "Wikipedia 'Turochamp'; ChessBase, 'Reconstructing Turing's paper machine'",
    },
    {
      id: "machines-shannon-paper", cat: "machines", year: 1950,
      es: "En 1950, Claude Shannon publicó «Programming a Computer for Playing Chess», donde describe cómo una máquina podría elegir jugadas buscando variantes y evaluando posiciones. Es un trabajo fundacional del ajedrez por computadora.",
      en: "In 1950 Claude Shannon published “Programming a Computer for Playing Chess”, describing how a machine could choose moves by searching variations and evaluating positions. It is a founding paper of computer chess.",
      source: "Shannon, Philosophical Magazine 41 (1950); Wikipedia 'Shannon number'",
    },
    {
      id: "machines-prinz-1951", cat: "machines", year: 1951,
      es: "En noviembre de 1951 corrió en la Ferranti Mark 1 de Manchester el programa de Dietrich Prinz, que resolvía problemas de mate en dos. Es uno de los primeros programas de ajedrez que funcionó en una computadora real.",
      en: "In November 1951 Dietrich Prinz's program ran on the Ferranti Mark 1 in Manchester, solving mate-in-two problems. It is one of the first chess programs to run on a real computer.",
      source: "Wikipedia 'Chess (Dietrich Prinz)'; Computer History Museum, Ferranti Mark 1 pages",
    },
    {
      id: "machines-deep-thought", cat: "machines", year: 1988,
      es: "En 1988, Deep Thought, creada por estudiantes de la Universidad Carnegie Mellon, le ganó al gran maestro Bent Larsen en Long Beach. Fue la primera vez que una computadora venció a un gran maestro en un torneo.",
      en: "In 1988 Deep Thought, built by Carnegie Mellon students, beat grandmaster Bent Larsen in Long Beach. It was the first time a computer beat a grandmaster in a regular tournament game.",
      source: "Wikipedia 'Deep Thought (chess computer)'; Christian Science Monitor and Sports Illustrated archives (1989)",
    },
    {
      id: "machines-deepblue-1996", cat: "machines", year: 1996,
      es: "En febrero de 1996, Deep Blue le ganó la primera partida a Kaspárov en Filadelfia: la primera derrota de un campeón mundial vigente ante una computadora con ritmo de torneo. Kaspárov igual ganó el match, 4 a 2.",
      en: "In February 1996 Deep Blue won the first game against Kasparov in Philadelphia: the first loss by a reigning world champion to a computer at tournament time controls. Kasparov still won the match, 4-2.",
      source: "Wikipedia 'Deep Blue versus Garry Kasparov'; History.com, 'Kasparov loses chess game to computer'",
    },
    {
      id: "machines-deepblue-1997", cat: "machines", year: 1997,
      es: "En mayo de 1997, Deep Blue derrotó a Kaspárov por 3,5 a 2,5 en Nueva York. Según IBM, la máquina evaluaba hasta unos 200 millones de posiciones por segundo.",
      en: "In May 1997 Deep Blue beat Kasparov 3.5-2.5 in New York. According to IBM, the machine could evaluate up to about 200 million positions per second.",
      source: "IBM Archives, 'Deep Blue'; Wikipedia 'Deep Blue versus Garry Kasparov'",
    },
    {
      id: "machines-advanced-chess", cat: "machines", year: 1998,
      es: "En 1998, en León (España), Kaspárov y Topalov jugaron el primer match de «ajedrez avanzado», en el que cada uno usaba una computadora durante la partida. Terminó 3 a 3.",
      en: "In 1998, in León (Spain), Kasparov and Topalov played the first “advanced chess” match, in which each used a computer during the game. It ended 3-3.",
      source: "Wikipedia 'Advanced chess'; The Week in Chess 171 and 188 (1998); ChessBase, 'A hand for Topalov'",
    },
    {
      id: "machines-freestyle-2005", cat: "machines", year: 2005,
      es: "En 2005, un torneo de ajedrez libre (humanos con computadoras) lo ganó ZackS, un equipo de dos aficionados con rating bajo que usaban tres computadoras, y venció a equipos con grandes maestros.",
      en: "In 2005 a freestyle chess tournament (humans with computers) was won by ZackS, a team of two low-rated amateurs using three computers, ahead of teams that included grandmasters.",
      source: "ChessBase, 'Dark horse ZackS wins Freestyle Chess Tournament'; Regan, freestyle chess study (University at Buffalo)",
    },
    {
      id: "machines-stockfish-2008", cat: "machines", year: 2008,
      es: "Stockfish, de código abierto, nació en 2008 (versión 1.0), cuando Marco Costalba lo desarrolló a partir del motor Glaurung de Tord Romstad. Es gratuito, y este entrenador lo ejecuta en tu propio navegador.",
      en: "Stockfish, which is open source, was born in 2008 (version 1.0) when Marco Costalba developed it from Tord Romstad's Glaurung engine. It is free, and this trainer runs it in your own browser.",
      source: "Chessprogramming wiki 'Stockfish'; Wikipedia 'Stockfish (chess)'",
    },
    {
      id: "machines-alphazero", cat: "machines", year: 2017,
      es: "En diciembre de 2017, DeepMind presentó AlphaZero, que aprendió ajedrez jugando contra sí misma, sin libros de aperturas. En un match de 100 partidas contra Stockfish 8 ganó 28 y empató 72; las condiciones del match se discutieron.",
      en: "In December 2017 DeepMind presented AlphaZero, which learned chess by playing against itself, with no opening books. In a 100-game match against Stockfish 8 it won 28 and drew 72; the match conditions were debated.",
      source: "DeepMind preprint (Dec 2017) and Science paper (Dec 2018); Wikipedia 'AlphaZero'; ChessBase report",
    },
    {
      id: "machines-leela", cat: "machines", year: 2018,
      es: "Leela Chess Zero, un proyecto abierto y colaborativo inspirado en AlphaZero, se publicó en 2018. Entrena su red neuronal con partidas jugadas por voluntarios de todo el mundo.",
      en: "Leela Chess Zero, an open collaborative project based on AlphaZero, was released in 2018. It trains its neural network with games generated by volunteers around the world.",
      source: "Wikipedia 'Leela Chess Zero'; chessprogramming wiki 'LCZero'",
    },
    {
      id: "machines-nnue", cat: "machines", year: 2020,
      es: "Desde Stockfish 12 (2020), el motor incorporó una red neuronal llamada NNUE para evaluar posiciones. Combina la búsqueda clásica con aprendizaje automático.",
      en: "Since Stockfish 12 (2020) the engine has used a neural network called NNUE to evaluate positions. It combines classical search with machine learning.",
      source: "Wikipedia 'Stockfish (chess)'; chessprogramming wiki 'Stockfish NNUE'",
    },
    {
      id: "machines-tablebases", cat: "machines", year: 2012,
      es: "Las tablas de finales contienen la solución exacta de todas las posiciones con hasta siete piezas. En 2012 se calcularon las de siete piezas en la supercomputadora Lomonosov, de la Universidad de Moscú.",
      en: "Endgame tablebases hold the exact solution of every position with up to seven pieces. The seven-piece tables were computed in 2012 on the Lomonosov supercomputer at Moscow State University.",
      source: "Wikipedia 'Endgame tablebase' and 'Solving chess'; Lichess blog, '7 piece Syzygy tablebases are complete'",
    },
    {
      id: "machines-mate-549", cat: "machines", year: 2012,
      es: "En finales de siete piezas, las tablas Lomonosov revelaron un mate forzado en 549 jugadas, el más largo que se conoce y sin contar la regla de las 50. Ninguna persona podría jugarlo de memoria.",
      en: "In seven-piece endgames the Lomonosov tablebases revealed a forced mate in 549 moves, the longest known, ignoring the 50-move rule. No person could play it from memory.",
      source: "Wikipedia 'Solving chess' (Haworth's finding in the Lomonosov tablebase; 549 is depth-to-mate, some references show 546 under another metric); Chessdom, '7-men tablebases'",
    },

    // ===== openings =====
    {
      id: "openings-ruy-lopez", cat: "openings", year: 1561,
      es: "La Apertura Española, o Ruy López, lleva el nombre del sacerdote Ruy López de Segura, que la analizó en su libro de 1561, publicado en Alcalá de Henares.",
      en: "The Ruy Lopez opening is named after the Spanish priest Ruy López de Segura, who analysed it in his book of 1561, published in Alcalá de Henares.",
      source: "Wikipedia 'Ruy Lopez' and 'Ruy López de Segura'; his Libro de la invención liberal y arte del juego del axedrez (1561)",
    },
    {
      id: "openings-sicilian", cat: "openings", year: 1594,
      es: "La Defensa Siciliana (1.e4 c5) ya la analizaron autores italianos como Giulio Polerio (manuscrito de 1594) y, a comienzos del siglo XVII, Gioachino Greco. Hoy es una de las respuestas más populares a 1.e4.",
      en: "The Sicilian Defence (1.e4 c5) was already analysed by Italian authors such as Giulio Polerio (manuscript of 1594) and, in the early 17th century, Gioachino Greco. Today it is one of the most popular replies to 1.e4.",
      source: "Wikipedia 'Sicilian Defence' (Polerio's 1594 manuscript analysed it without using the name; Greco's analysis is from 1623, after Salvio 1604 and Carrera c. 1617)",
    },
    {
      id: "openings-queens-gambit", cat: "openings", year: 1500, approx: true,
      es: "El Gambito de Dama (1.d4 d5 2.c4) figura entre las aperturas documentadas más antiguas: aparece en el manuscrito de Gotinga, de hacia 1500 (su datación es incierta). No es un gambito estricto, porque las blancas pueden recuperar el peón.",
      en: "The Queen's Gambit (1.d4 d5 2.c4) is among the oldest documented openings: it appears in the Göttingen manuscript, from around 1500 (its dating is uncertain). It is not a true gambit, since White can win the pawn back.",
      source: "Wikipedia 'Göttingen manuscript' and 'Queen's Gambit' (the manuscript's date is uncertain, hence 'c.')",
    },
    {
      id: "openings-gambit-word", cat: "openings",
      es: "«Gambito» viene del italiano gambetto, «zancadilla»: en la lucha, hacer trastabillar al rival. En ajedrez es ofrecer material, casi siempre un peón, a cambio de ventaja en desarrollo o iniciativa.",
      en: "“Gambit” comes from the Italian gambetto, “a tripping up”, a wrestling term. In chess it means offering material, usually a pawn, in return for a lead in development or initiative.",
      source: "Online Etymology Dictionary 'gambit'; Wiktionary 'gambit'",
    },
    {
      id: "openings-kings-gambit", cat: "openings", year: 1851,
      es: "El Gambito de Rey (1.e4 e5 2.f4) fue una de las aperturas más populares del siglo XIX. La Partida Inmortal de 1851 empezó con esa jugada.",
      en: "The King's Gambit (1.e4 e5 2.f4) was one of the most popular openings of the 19th century. The Immortal Game of 1851 began with that move.",
      source: "Wikipedia 'King's Gambit' and 'Immortal Game' (score of the game)",
    },
    {
      id: "openings-philidor", cat: "openings", year: 1749,
      es: "François-André Philidor, también compositor de óperas, escribió en 1749 que «los peones son el alma del ajedrez». La Defensa Philidor (1.e4 e5 2.Cf3 d6) lleva su nombre.",
      en: "François-André Philidor, who was also an opera composer, wrote in 1749 that “the pawns are the soul of chess”. The Philidor Defence (1.e4 e5 2.Nf3 d6) is named after him.",
      source: "Wikipedia 'François-André Danican Philidor'; FIDE Museum, 'L'Analyse des Échecs'; Britannica 'Development of theory'",
    },
    {
      id: "openings-marshall-attack", cat: "openings", year: 1918,
      es: "En 1918, en Nueva York, Frank Marshall jugó contra Capablanca un contraataque en la Española que hoy se llama Ataque Marshall. Suele decirse que lo tenía guardado desde hacía años, pero eso no está probado. Capablanca defendió bien y ganó.",
      en: "In 1918, in New York, Frank Marshall played against Capablanca a counterattack in the Ruy Lopez now called the Marshall Attack. It is often said he had saved it for years, but that is unproven. Capablanca defended well and won.",
      source: "Wikipedia 'Marshall Attack'; Chess.com, 'A century of chess: New York 1918'; Edward Winter's Chess Notes on the 'saved for years' story and on earlier games with the same line (Walbrodt 1893)",
    },
    {
      id: "openings-berlin-wall", cat: "openings", year: 2000,
      es: "La Defensa Berlinesa (1.e4 e5 2.Cf3 Cc6 3.Ab5 Cf6) se consideraba pasiva hasta que Krámnik la usó con éxito contra Kaspárov en 2000. Desde entonces es un arma sólida y muy respetada en la élite.",
      en: "The Berlin Defence (1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6) was seen as passive until Kramnik used it successfully against Kasparov in 2000. Since then it has been a solid, much-respected weapon at the top.",
      source: "ChessBase, '25 years ago: Kramnik beats Kasparov'; Encyclopaedia Britannica",
    },
    {
      id: "openings-scholars-mate", cat: "openings",
      es: "El «mate pastor» (1.e4 e5 2.Dh5 Cc6 3.Ac4 Cf6?? 4.Dxf7#) es una trampa clásica de principiantes. Se evita desarrollando las piezas y mirando qué amenaza la dama rival.",
      en: "Scholar's mate (1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6?? 4.Qxf7#) is a classic beginner's trap. You avoid it by developing your pieces and checking what the enemy queen threatens.",
      source: "Standard opening theory; the move sequence is verified as legal and mating in the test suite",
    },
    {
      id: "openings-eco", cat: "openings",
      es: "El código ECO clasifica las aperturas con una letra de la A a la E y dos cifras: hay 500 códigos, de A00 a E99. Muchos archivos de partidas y este entrenador lo usan.",
      en: "The ECO code classifies openings with a letter from A to E and two digits: there are 500 codes, from A00 to E99. Many game files, and this trainer, use it.",
      source: "Encyclopaedia of Chess Openings (Chess Informant); PGN specification ('ECO' tag)",
    },

    // ===== culture =====
    {
      id: "culture-staunton", cat: "culture", year: 1849,
      es: "El diseño Staunton se registró en 1849 a nombre de Nathaniel Cooke y lo fabricó Jaques de Londres. Lleva el nombre de Howard Staunton, que lo recomendó públicamente, y se volvió el modelo estándar de las piezas.",
      en: "The Staunton design was registered in 1849 in the name of Nathaniel Cooke and made by Jaques of London. It is named after Howard Staunton, who publicly endorsed it, and became the standard pattern of chess pieces.",
      source: "House of Staunton, 'The Staunton Chessmen History'; Wikipedia 'Staunton chess set'",
    },
    {
      id: "culture-london-1851", cat: "culture", year: 1851,
      es: "El torneo de Londres de 1851, el primer torneo internacional, se organizó junto con la Gran Exposición. Fue por eliminación directa y lo ganó Adolf Anderssen, que venció a Staunton en las semifinales.",
      en: "The London 1851 tournament, the first international tournament, was organised alongside the Great Exhibition. It was a knockout event won by Adolf Anderssen, who beat Staunton in the semi-final.",
      source: "Chess.com, 'London 1851: the first international chess tournament'; Wikipedia 'London 1851 chess tournament'",
    },
    {
      id: "culture-name-latin", cat: "culture", year: 1300, approx: true,
      es: "«Ludus scaccorum» es latín medieval para «juego de ajedrez». La expresión aparece, en formas como «ludo scaccorum», en el título de la obra de Cessolis (hacia 1300) y da nombre a este entrenador.",
      en: "“Ludus scaccorum” is medieval Latin for “game of chess”. The phrase appears, in forms such as “ludo scaccorum”, in the title of Cessolis's work (around 1300) and gives this trainer its name.",
      source: "Manuscript catalogues (Yale Beinecke, British Library) listing 'Liber de moribus hominum et officiis nobilium super ludo scacchorum'",
    },
    {
      id: "culture-caissa", cat: "culture", year: 1763,
      es: "La idea de una ninfa del ajedrez aparece en un poema latino de Marco Girolamo Vida (1527). Sir William Jones escribió en inglés en 1763 el poema que la llamó Caïssa (se publicó en 1772); desde entonces los ajedrecistas la invocan como su diosa protectora.",
      en: "The idea of a chess nymph appears in a Latin poem by Marco Girolamo Vida (1527). Sir William Jones wrote in 1763 the English poem that named her Caïssa (published in 1772); chess players have invoked her as their patron goddess ever since.",
      source: "Wikipedia 'Caïssa'; Vida, Scacchia ludus (1527); William Jones, 'Caissa, or the Game at Chess' (1763)",
    },
    {
      id: "culture-alice", cat: "culture", year: 1871,
      es: "«A través del espejo» (1871), de Lewis Carroll, sigue el esquema de un problema de ajedrez: Alicia es un peón blanco que avanza hasta coronar como reina. El libro abre con un diagrama de ajedrez.",
      en: "Lewis Carroll's “Through the Looking-Glass” (1871) follows the pattern of a chess problem: Alice is a white pawn who advances until she is crowned a queen. The book opens with a chess diagram.",
      source: "Wikipedia 'White Queen (Through the Looking-Glass)'; Chess.com, 'Lewis Carroll's chess problem'",
    },
    {
      id: "culture-hal-2001", cat: "culture", year: 1968,
      es: "En «2001: Odisea del espacio» (1968), la computadora HAL 9000 le gana al ajedrez a Frank Poole. La partida de la película reproduce el final de una real: Roesch–Schlage, Hamburgo 1910.",
      en: "In “2001: A Space Odyssey” (1968) the computer HAL 9000 beats Frank Poole at chess. The film's game reproduces the ending of a real one: Roesch-Schlage, Hamburg 1910.",
      source: "Wikipedia 'Poole versus HAL 9000' and 'Willi Schlage'; Chess.com, '2001: a chess space odyssey'",
    },
    {
      id: "culture-duchamp", cat: "culture", year: 1928,
      es: "El artista Marcel Duchamp fue maestro de ajedrez y representó a Francia en cuatro Olimpíadas entre 1928 y 1933. Decía que todos los ajedrecistas son artistas.",
      en: "The artist Marcel Duchamp was a chess master and represented France in four Olympiads between 1928 and 1933. He said that all chess players are artists.",
      source: "The Article, 'Marcel Duchamp: chess master'; Frieze, 'Art and chess'; Oxford Companion to Chess",
    },
    {
      id: "culture-olympiad-1927", cat: "culture", year: 1927,
      es: "La primera Olimpíada de ajedrez oficial se jugó en Londres en 1927 y la ganó Hungría, que recibió la copa Hamilton-Russell. Ese mismo año, también en Londres, se disputó el primer Campeonato Mundial Femenino.",
      en: "The first official Chess Olympiad was held in London in 1927 and won by Hungary, which received the Hamilton-Russell Cup. The first Women's World Championship was held in London that same year.",
      source: "Wikipedia 'Chess Olympiad'; FIDE Museum; World Chess Hall of Fame, 'Vera Menchik'",
    },
    {
      id: "culture-space-1970", cat: "culture", year: 1970,
      es: "En 1970, desde la nave Soyuz 9, los cosmonautas Andriyán Nikoláyev y Vitali Sevastiánov jugaron una partida de consulta contra Kamanin y Gorbatko, en la Tierra. Duró unas seis horas y terminó en tablas.",
      en: "In 1970, aboard Soyuz 9, cosmonauts Nikolayev and Sevastyanov played a consultation game against Kamanin and Gorbatko on Earth. It lasted about six hours and ended in a draw.",
      source: "Wikipedia 'Soyuz 9'; Guinness World Records, 'First board game in space'; FIDE news",
    },
    {
      id: "culture-kasparov-world", cat: "culture", year: 1999,
      es: "En 1999, Kaspárov jugó por internet contra «el Mundo»: más de 50.000 personas de más de 75 países votaron las jugadas de las negras. Kaspárov ganó tras 62 jugadas y cuatro meses, y la llamó la partida más importante de la historia.",
      en: "In 1999 Kasparov played “the World” online: over 50,000 people from more than 75 countries voted on Black's moves. Kasparov won after 62 moves and four months, and called it the most important game ever played.",
      source: "Wikipedia 'Kasparov versus the World'; Microsoft news archive, 21 June 1999",
    },
    {
      id: "culture-carlsen-gates", cat: "culture", year: 2014,
      es: "En enero de 2014, Carlsen le ganó a Bill Gates en 9 jugadas en un programa de televisión noruego. Gates tenía más tiempo: 2 minutos contra 30 segundos.",
      en: "In January 2014 Carlsen beat Bill Gates in 9 moves on a Norwegian TV show. Gates had more time on the clock: 2 minutes against 30 seconds.",
      source: "NBC News; The Local (Norway); GeekWire; Chess.com game showcase (January 2014)",
    },
    {
      id: "culture-chessboxing", cat: "culture", year: 2003,
      es: "El ajedrez boxeo se inspiró en la historieta «Froid Équateur» (1992), de Enki Bilal. La primera competencia con rondas alternadas de ajedrez y boxeo se hizo en Berlín en 2003, y ese año se disputó en Ámsterdam el primer campeonato mundial.",
      en: "Chessboxing was inspired by Enki Bilal's comic “Froid Équateur” (1992). The first competition with alternating rounds of chess and boxing was held in Berlin in 2003, and the first world championship followed that year in Amsterdam.",
      source: "Wikipedia 'World Chess Boxing Organisation' and 'Chess boxing'; Worldcrunch feature",
    },
    {
      id: "culture-armenia-schools", cat: "culture", year: 2011,
      es: "A partir de 2011, Armenia hizo del ajedrez una materia obligatoria en la primaria (de 2.º a 4.º grado), con dos clases por semana; se la presentó como el primer país del mundo en hacerlo.",
      en: "From 2011 Armenia made chess a compulsory subject in primary school (grades 2 to 4), with two lessons a week; it was billed as the first country in the world to do so.",
      source: "Radio Free Europe/Radio Liberty (2011); Deseret News (2011); the 'first country' wording is the claim of the press and the Armenian government, not independently confirmed",
    },
    {
      id: "culture-lichess", cat: "culture", year: 2010,
      es: "Lichess, creado en 2010 por Thibault Duplessis, es gratuito, no tiene publicidad y es de código abierto: se financia con donaciones.",
      en: "Lichess, created in 2010 by Thibault Duplessis, is free, ad-free and open source, and is funded by donations.",
      source: "Wikipedia 'Lichess'; lichess.org/about",
    },
    {
      id: "culture-queens-gambit-series", cat: "culture", year: 2020,
      es: "La serie «Gambito de dama» (Netflix, 2020), basada en la novela de Walter Tevis de 1983, tuvo 62 millones de hogares en sus primeros 28 días, según Netflix, y disparó el interés por aprender ajedrez.",
      en: "The series “The Queen's Gambit” (Netflix, 2020), based on Walter Tevis's 1983 novel, reached 62 million households in its first 28 days, according to Netflix, and sparked interest in learning chess.",
      source: "Bloomberg, 23 Nov 2020 (Netflix figures); /Film and Tubefilter coverage; Google Trends reports of the time",
    },
    {
      id: "culture-streaming", cat: "culture", year: 2020,
      es: "Desde 2020, las transmisiones de ajedrez en vivo crecieron enormemente. Jugadores de élite como Hikaru Nakamura combinan los torneos con el streaming.",
      en: "Since 2020, live chess streaming has grown enormously. Elite players such as Hikaru Nakamura combine tournament play with streaming.",
      source: "General knowledge, widely reported (Twitch chess category growth from 2020); Nakamura's public channel and titles",
    },

    // ===== records =====
    {
      id: "records-najdorf-blindfold", cat: "records", year: 1947,
      es: "En 1947, en San Pablo, Miguel Najdorf jugó a ciegas 45 partidas simultáneas durante unas 23 horas: ganó 39, empató 4 y perdió 2. Fue el récord reconocido hasta 2011.",
      en: "In 1947, in São Paulo, Miguel Najdorf played 45 blindfold games at once over about 23 hours: he won 39, drew 4 and lost 2. It stood as the recognised record until 2011.",
      source: "Guinness World Records; ChessBase, 'Remembering Miguel Najdorf'; Wikipedia 'Blindfold chess'",
    },
    {
      id: "records-gareyev-blindfold", cat: "records", year: 2016,
      es: "En diciembre de 2016, en Las Vegas, Timur Gareyev jugó a ciegas 48 partidas simultáneas durante más de 19 horas: ganó 35, empató 7 y perdió 6. Es récord Guinness.",
      en: "In December 2016, in Las Vegas, Timur Gareyev played 48 blindfold games at once over more than 19 hours: he won 35, drew 7 and lost 6. It is a Guinness record.",
      source: "Guinness World Records; ChessBase, 'Gareyev breaks the world blindfold simul record'; FIDE news",
    },
    {
      id: "records-longest-game", cat: "records", year: 1989,
      es: "La partida más larga de un torneo oficial que se conoce es Nikolić–Arsović, Belgrado 1989: 269 jugadas y más de 20 horas, y terminó en tablas. En esa época la regla de las 50 jugadas tenía excepciones.",
      en: "The longest known game in official tournament play is Nikolić-Arsović, Belgrade 1989: 269 moves and over 20 hours, ending in a draw. At the time the 50-move rule had exceptions.",
      source: "Chess.com and Lichess record lists; Wikipedia 'Longest chess game' (repeated in several secondary sources)",
    },
    {
      id: "records-fools-mate", cat: "records",
      es: "El mate más corto posible es el «mate del loco»: 1.f3 e5 2.g4 Dh4#. Las negras lo dan en su segunda jugada; las blancas necesitan al menos tres.",
      en: "The shortest possible checkmate is Fool's Mate: 1.f3 e5 2.g4 Qh4#. Black can deliver it on its second move; White needs at least three.",
      source: "Standard chess reference; the sequence is verified as legal and mating in the test suite",
    },
    {
      id: "records-mishra", cat: "records", year: 2021,
      es: "En 2021, Abhimanyu Mishra se hizo gran maestro a los 12 años, 4 meses y 25 días y batió el récord de Serguéi Kariakin, que tenía 12 años y 7 meses desde 2002.",
      en: "In 2021 Abhimanyu Mishra became a grandmaster at 12 years, 4 months and 25 days, breaking Sergey Karjakin's record of 12 years and 7 months, set in 2002.",
      source: "FIDE news, 30 June 2021; ChessBase report",
    },
    {
      id: "records-ding-unbeaten", cat: "records", year: 2018,
      es: "Entre agosto de 2017 y noviembre de 2018, Ding Liren estuvo 100 partidas clásicas sin perder (29 victorias y 71 tablas). Lo derrotó Maxime Vachier-Lagrave en Shenzhen.",
      en: "Between August 2017 and November 2018 Ding Liren went 100 classical games without a loss (29 wins and 71 draws). Maxime Vachier-Lagrave beat him in Shenzhen.",
      source: "Wikipedia 'Ding Liren'; FIDE and ChessBase reports",
    },
    {
      id: "records-carlsen-rating", cat: "records", year: 2014,
      es: "En mayo de 2014, Magnus Carlsen alcanzó un rating FIDE de 2882, el más alto de la historia hasta ahora.",
      en: "In May 2014 Magnus Carlsen reached a FIDE rating of 2882, the highest ever recorded so far.",
      source: "Wikipedia 'Magnus Carlsen'; FIDE rating lists",
    },
    {
      id: "records-first-moves", cat: "records",
      es: "Las blancas tienen 20 primeras jugadas posibles, y las negras otras 20 de respuesta: 400 secuencias tras una jugada por bando. Tras dos jugadas por bando ya son 197.281.",
      en: "White has 20 possible first moves and Black 20 replies: 400 move sequences after one move each. After two moves each there are already 197,281.",
      source: "Perft counts (perft(2) = 400, perft(4) = 197,281), chessprogramming wiki; the counts are reproduced by this project's chess module tests",
    },
    {
      id: "records-legal-positions", cat: "records", year: 2021,
      es: "Se estima que existen del orden de 10^44 posiciones legales de ajedrez, según un muestreo que John Tromp coordinó en 2021 con ayuda de otras personas. Es una estimación, no un conteo exacto.",
      en: "There are estimated to be on the order of 10^44 legal chess positions, according to a sampling project coordinated by John Tromp in 2021 with help from others. It is an estimate, not an exact count.",
      source: "TalkChess thread 'The number of legal chess positions is ~ 4.8 * 10^44' (J. Tromp, 2021); Tromp's ChessPositionRanking project",
    },
    {
      id: "records-shannon-number", cat: "records", year: 1950,
      es: "El número de Shannon, unos 10^120, es una estimación, por lo bajo, de cuántas partidas de ajedrez de duración normal son posibles. Es muchísimo más que los cerca de 10^80 átomos del universo observable.",
      en: "The Shannon number, about 10^120, is a conservative lower-bound estimate of how many chess games of normal length are possible. It is vastly more than the roughly 10^80 atoms in the observable universe.",
      source: "Shannon, Philosophical Magazine 41 (1950); Wikipedia 'Shannon number'",
    },

    // ===== mind =====
    {
      id: "mind-degroot", cat: "mind", year: 1946,
      es: "Adriaan de Groot mostró que los maestros reconstruyen de memoria una posición real con muy pocos errores después de mirarla apenas unos segundos, mucho mejor que los jugadores más débiles.",
      en: "Adriaan de Groot showed that masters can rebuild a real position from memory with very few errors after looking at it for only a few seconds, far better than weaker players.",
      source: "de Groot, Thought and Choice in Chess (1946 thesis; English edition 1965); Chase & Simon (1973)",
    },
    {
      id: "mind-chunks", cat: "mind", year: 1973,
      es: "Chase y Simon (1973) vieron que esa ventaja casi desaparece si las piezas están ubicadas al azar: los expertos no memorizan casillas, sino patrones conocidos que reconocen de un vistazo.",
      en: "Chase and Simon (1973) found that this advantage all but disappears when the pieces are placed at random: experts do not memorise squares, they recognise familiar patterns at a glance.",
      source: "Chase & Simon, 'Perception in chess', Cognitive Psychology 4 (1973)",
    },
    {
      id: "mind-50000-patterns", cat: "mind", year: 1973,
      es: "Una estimación clásica de Simon y Gilmartin (1973) sugiere que un maestro guarda al menos unos 50.000 patrones de piezas en la memoria a largo plazo. Es una estimación de orden de magnitud, no un conteo.",
      en: "A classic estimate by Simon and Gilmartin (1973) suggests a master stores at least about 50,000 piece patterns in long-term memory. It is an order-of-magnitude estimate, not a count.",
      source: "Simon & Gilmartin, 'A simulation of memory for chess positions', Cognitive Psychology 5 (1973)",
    },
    {
      id: "mind-einstellung", cat: "mind", year: 2008,
      es: "Un estudio con seguimiento ocular (Bilalić y colegas, 2008) mostró que la primera idea conocida lleva a jugadores expertos a ignorar una solución mejor, aunque crean estar buscando alternativas. Antes de jugar, buscá a propósito otra idea.",
      en: "An eye-tracking study (Bilalić and colleagues, 2008) showed that a familiar first idea makes expert players overlook a better solution, even when they believe they are looking for alternatives. Before you play, deliberately look for another idea.",
      source: "Bilalić, McLeod & Gobet, Cognition 108 (2008); PLoS ONE 2013 follow-up on boundary conditions",
    },
    {
      id: "mind-kotov", cat: "mind", year: 1971,
      es: "El gran maestro Alexander Kotov describió en 1971 un error común: calcular una y otra vez las mismas variantes y, sin tiempo, terminar jugando otra jugada sin analizar. Se lo conoce como «síndrome de Kotov».",
      en: "Grandmaster Alexander Kotov described a common error in 1971: analysing the same variations again and again and then, short of time, playing a different move without checking it. It is called “Kotov syndrome”.",
      source: "Kotov, Think Like a Grandmaster (Batsford, 1971); Wikipedia 'Alexander Kotov'",
    },
    {
      id: "mind-transfer", cat: "mind", year: 2016,
      es: "Un metaanálisis de 2016 (Sala y Gobet) encontró que enseñar ajedrez a chicos mejora algo su rendimiento en matemática. Los autores advierten que faltan estudios con buenos grupos de control.",
      en: "A 2016 meta-analysis (Sala and Gobet) found that teaching chess to children modestly improves their maths performance. The authors warn that studies with good control groups are still lacking.",
      source: "Sala & Gobet, 'Do the benefits of chess instruction transfer to academic and cognitive skills? A meta-analysis', Educational Research Review (2016)",
    },
    {
      id: "mind-spacing", cat: "mind", year: 1885,
      es: "Repasar tus errores a intervalos crecientes aprovecha el efecto de espaciado, descrito por Hermann Ebbinghaus en 1885: suele dar mejor retención que repasar todo de una sola vez.",
      en: "Reviewing your mistakes at growing intervals uses the spacing effect, described by Hermann Ebbinghaus in 1885: it usually gives better retention than reviewing everything at once.",
      source: "Ebbinghaus, Über das Gedächtnis (1885); Wikipedia 'Spacing effect'; Leitner system",
    },
    {
      id: "mind-eight-queens", cat: "mind", year: 1848,
      es: "El problema de las ocho damas, planteado por Max Bezzel en 1848, pide ubicar ocho damas sin que se ataquen. Hay 92 soluciones, o 12 si se consideran iguales las rotaciones y los reflejos.",
      en: "The eight queens puzzle, posed by Max Bezzel in 1848, asks you to place eight queens so that none attacks another. There are 92 solutions, or 12 if rotations and reflections count as the same.",
      source: "Wikipedia 'Eight queens puzzle'; Chess.com 'Eight queens puzzle'",
    },
    {
      id: "mind-knights-tour", cat: "mind",
      es: "El recorrido del caballo, que pasa una vez por cada casilla, fascinó a Euler en el siglo XVIII. En el tablero de 8×8 hay más de 26 billones (26 millones de millones) de recorridos cerrados dirigidos.",
      en: "The knight's tour, visiting every square exactly once, fascinated Euler in the 18th century. On the 8×8 board there are more than 26 trillion directed closed tours.",
      source: "Wikipedia 'Knight's tour' (26,534,728,821,064 directed closed tours; Euler's 18th-century analysis)",
    },
  ];

  // ---------- Timeline ----------

  const RAW_TIMELINE = [
    {
      id: "tl-chaturanga", year: 600, approx: true,
      title: { es: "Nace el chaturanga", en: "Chaturanga appears" },
      es: "En la India aparece el chaturanga, antepasado del ajedrez, con piezas que representan las divisiones del ejército: infantería, caballería, elefantes y carros.",
      en: "In India chaturanga appears, the ancestor of chess, with pieces standing for the divisions of the army: infantry, cavalry, elephants and chariots.",
      source: "Encyclopaedia Britannica, 'Chess'; Murray, A History of Chess (1913)",
    },
    {
      id: "tl-shatranj", year: 700, approx: true,
      title: { es: "Del chatrang al shatranj", en: "From chatrang to shatranj" },
      es: "Adoptado en Persia como chatrang, el juego se difunde con la expansión del islam, ya como shatranj, por Oriente Medio, el norte de África y la península ibérica.",
      en: "Adopted in Persia as chatrang, the game spreads with the expansion of Islam, now as shatranj, across the Middle East, North Africa and the Iberian peninsula.",
      source: "Encyclopaedia Britannica, 'Chess'; Murray, A History of Chess (1913)",
    },
    {
      id: "tl-europe", year: 1000, approx: true,
      title: { es: "Llega a Europa", en: "Chess reaches Europe" },
      es: "Hacia el año 1000 ya se juega en Europa occidental: el poema latino de Einsiedeln es una de las primeras descripciones escritas del juego en el continente.",
      en: "By about the year 1000 chess is played in western Europe: the Latin Einsiedeln poem is one of the first written descriptions of the game on the continent.",
      source: "Wikipedia 'Versus de scachis'; Murray, A History of Chess (1913)",
    },
    {
      id: "tl-alfonso-x", year: 1283,
      title: { es: "El Libro de los juegos", en: "The Book of Games" },
      es: "Alfonso X de Castilla completa el Libro de los juegos, uno de los tratados europeos de ajedrez más antiguos que se conservan, con problemas y miniaturas de jugadores.",
      en: "Alfonso X of Castile completes the Libro de los juegos, one of the oldest surviving European chess treatises, with problems and miniatures of players.",
      source: "Wikipedia 'Libro de los juegos'",
    },
    {
      id: "tl-cessolis", year: 1300, approx: true,
      title: { es: "El ajedrez como alegoría", en: "Chess as allegory" },
      es: "El fraile Jacobo de Cessolis escribe su tratado, que usa el ajedrez como alegoría de la sociedad. Se copiará y traducirá por toda Europa.",
      en: "The friar Jacobus de Cessolis writes his treatise using chess as an allegory of society. It will be copied and translated across Europe.",
      source: "Project Gutenberg, Caxton's 'Game and Playe of the Chesse'; Morgan Library",
    },
    {
      id: "tl-modern-queen", year: 1475, approx: true,
      title: { es: "La dama poderosa", en: "The powerful queen" },
      es: "El poema valenciano Scachs d'amor describe la primera partida conocida con la dama y el alfil modernos: el ajedrez empieza a tomar la forma que hoy conocemos.",
      en: "The Valencian poem Scachs d'amor describes the earliest known game with the modern queen and bishop: chess starts to take the form we know today.",
      source: "Wikipedia 'Scachs d'amor'",
    },
    {
      id: "tl-lucena", year: 1497, approx: true,
      title: { es: "Manual de ajedrez impreso más antiguo", en: "Oldest surviving printed chess manual" },
      es: "Se imprime en Salamanca el libro de Luis Ramírez de Lucena, el más antiguo que se conserva impreso sobre cómo jugar al ajedrez (uno anterior, de Francesc Vicent, 1495, se perdió).",
      en: "Luis Ramírez de Lucena's book is printed in Salamanca, the oldest surviving printed book on how to play chess (an earlier one, by Francesc Vicent, 1495, is lost).",
      source: "Wikipedia 'Luis Ramírez de Lucena' and 'Francesc Vicent' (Llibre dels jochs partits, Valencia 1495, lost); Cessolis was printed earlier but is an allegory, not a playing manual",
    },
    {
      id: "tl-ruy-lopez", year: 1561,
      title: { es: "Ruy López publica su libro", en: "Ruy López publishes his book" },
      es: "El sacerdote Ruy López de Segura publica en Alcalá de Henares su libro de ajedrez, donde analiza la apertura que hoy lleva su nombre.",
      en: "The priest Ruy López de Segura publishes his chess book in Alcalá de Henares, analysing the opening that now bears his name.",
      source: "Wikipedia 'Ruy López de Segura'",
    },
    {
      id: "tl-philidor", year: 1749,
      title: { es: "Philidor y los peones", en: "Philidor and the pawns" },
      es: "François-André Philidor publica el Analyse du jeu des Échecs, con su idea de que «los peones son el alma del ajedrez». Será un manual de referencia por un siglo.",
      en: "François-André Philidor publishes the Analyse du jeu des Échecs, with his idea that “the pawns are the soul of chess”. It will be a standard manual for a century.",
      source: "FIDE Museum, 'L'Analyse des Échecs'; Britannica, 'Development of theory'",
    },
    {
      id: "tl-turk", year: 1770,
      title: { es: "El Turco", en: "The Turk" },
      es: "Wolfgang von Kempelen presenta al Turco, un falso autómata ajedrecista que escondía a una persona y asombraría a Europa durante décadas.",
      en: "Wolfgang von Kempelen presents the Turk, a fake chess automaton that hid a human player and would astonish Europe for decades.",
      source: "History.com, 'How a phony 18th-century chess robot fooled the world'",
    },
    {
      id: "tl-staunton", year: 1849,
      title: { es: "Las piezas Staunton", en: "The Staunton pieces" },
      es: "Se registra el diseño de piezas que Jaques de Londres empieza a vender ese año y que Howard Staunton recomienda: el futuro estándar mundial.",
      en: "The design of pieces that Jaques of London starts selling that year, and that Howard Staunton endorses, is registered: the future world standard.",
      source: "House of Staunton, 'The Staunton Chessmen History'",
    },
    {
      id: "tl-london-1851", year: 1851,
      title: { es: "Primer torneo internacional", en: "First international tournament" },
      es: "Londres 1851, junto a la Gran Exposición, reúne a los mejores de Europa. Gana Adolf Anderssen, que ese año juega también la Partida Inmortal.",
      en: "London 1851, held alongside the Great Exhibition, gathers Europe's best. Adolf Anderssen wins, and that year he also plays the Immortal Game.",
      source: "Chess.com, 'London 1851'; Wikipedia 'London 1851 chess tournament'; ChessBase on the Immortal Game",
    },
    {
      id: "tl-morphy-1858", year: 1858,
      title: { es: "Morphy en Europa", en: "Morphy in Europe" },
      es: "El joven estadounidense Paul Morphy viaja a Europa y vence a los mejores del momento. En París juega la famosa Partida de la Ópera.",
      en: "The young American Paul Morphy travels to Europe and beats the leading players of the day. In Paris he plays the famous Opera Game.",
      source: "Wikipedia 'Paul Morphy' and 'Opera Game'",
    },
    {
      id: "tl-clocks-1883", year: 1883,
      title: { es: "Relojes de ajedrez", en: "Chess clocks" },
      es: "El torneo de Londres estrena en competencia el reloj doble de Thomas Bright Wilson, con el que cada jugador controla su propio tiempo.",
      en: "The London tournament introduces Thomas Bright Wilson's double clock in competition, with each player's time tracked separately.",
      source: "Wikipedia 'Chess clock' and 'London 1883 chess tournament'",
    },
    {
      id: "tl-steinitz-1886", year: 1886,
      title: { es: "Primer campeón oficial", en: "First official champion" },
      es: "Wilhelm Steinitz vence a Zukertort y es considerado el primer campeón mundial oficial. Populariza un juego más posicional y científico.",
      en: "Wilhelm Steinitz beats Zukertort and is regarded as the first official world champion. He popularises a more positional, scientific style.",
      source: "Wikipedia 'World Chess Championship 1886'; Chess.com on Steinitz",
    },
    {
      id: "tl-lasker-1894", year: 1894,
      title: { es: "Lasker, campeón", en: "Lasker becomes champion" },
      es: "Emanuel Lasker le gana el título a Steinitz. Lo conservará hasta 1921, el reinado más largo de un campeón mundial oficial.",
      en: "Emanuel Lasker takes the title from Steinitz. He will keep it until 1921, the longest reign of any officially recognised champion.",
      source: "Wikipedia 'Emanuel Lasker'",
    },
    {
      id: "tl-ajedrecista-1912", year: 1912,
      title: { es: "El Ajedrecista", en: "El Ajedrecista" },
      es: "Leonardo Torres Quevedo construye una máquina que da mate de rey y torre contra rey sin ayuda humana; la presentará en París en 1914.",
      en: "Leonardo Torres Quevedo builds a machine that delivers king-and-rook mate with no human help; he will present it in Paris in 1914.",
      source: "Wikipedia 'Leonardo Torres Quevedo'; Communications of the ACM, 'AI began in 1912'",
    },
    {
      id: "tl-capablanca-1921", year: 1921,
      title: { es: "Capablanca, campeón", en: "Capablanca becomes champion" },
      es: "José Raúl Capablanca vence a Lasker en La Habana y se convierte en campeón mundial. Su estilo, claro y casi sin errores, será leyenda.",
      en: "José Raúl Capablanca beats Lasker in Havana and becomes world champion. His clear, almost error-free style becomes legendary.",
      source: "Wikipedia 'José Raúl Capablanca'; Britannica biography",
    },
    {
      id: "tl-fide-1924", year: 1924,
      title: { es: "Se funda la FIDE", en: "FIDE is founded" },
      es: "El 20 de julio se funda en París la FIDE, la federación internacional de ajedrez. Su lema es «Gens una sumus»: somos una sola familia.",
      en: "On 20 July FIDE, the international chess federation, is founded in Paris. Its motto is “Gens una sumus”: we are one family.",
      source: "FIDE history pages; Wikipedia 'FIDE'",
    },
    {
      id: "tl-olympiad-1927", year: 1927,
      title: { es: "Primera Olimpíada oficial", en: "First official Olympiad" },
      es: "Londres organiza la primera Olimpíada de ajedrez oficial, que gana Hungría, y el primer Campeonato Mundial Femenino, que gana Vera Menchik.",
      en: "London hosts the first official Chess Olympiad, won by Hungary, and the first Women's World Championship, won by Vera Menchik.",
      source: "Wikipedia 'Chess Olympiad'; World Chess Hall of Fame, 'Vera Menchik'",
    },
    {
      id: "tl-buenos-aires-1939", year: 1939,
      title: { es: "Olimpíada de Buenos Aires", en: "The Buenos Aires Olympiad" },
      es: "La Olimpíada de Buenos Aires coincide con el comienzo de la Segunda Guerra Mundial. Algunos jugadores europeos, como Najdorf, se quedan en Sudamérica.",
      en: "The Buenos Aires Olympiad coincides with the start of the Second World War. Some European players, such as Najdorf, stay in South America.",
      source: "Wikipedia 'Miguel Najdorf'; FIDE Museum, 8th Chess Olympiad",
    },
    {
      id: "tl-botvinnik-1948", year: 1948,
      title: { es: "La FIDE toma el título", en: "FIDE takes over the title" },
      es: "Tras la muerte de Alekhine, la FIDE organiza un torneo mundial en La Haya y Moscú. Lo gana Botvinnik y comienza la era de dominio soviético.",
      en: "After Alekhine's death, FIDE organises a world championship tournament in The Hague and Moscow. Botvinnik wins it, beginning the era of Soviet dominance.",
      source: "Wikipedia 'World Chess Championship 1948'; New In Chess",
    },
    {
      id: "tl-shannon-1950", year: 1950,
      title: { es: "Shannon y el ajedrez por computadora", en: "Shannon and computer chess" },
      es: "Claude Shannon publica «Programming a Computer for Playing Chess», el trabajo fundacional sobre cómo una máquina podría jugar al ajedrez.",
      en: "Claude Shannon publishes “Programming a Computer for Playing Chess”, the founding paper on how a machine could play chess.",
      source: "Shannon, Philosophical Magazine 41 (1950)",
    },
    {
      id: "tl-elo-1970", year: 1970,
      title: { es: "El sistema Elo", en: "The Elo system" },
      es: "La FIDE adopta el sistema de rating de Arpad Elo, que la federación estadounidense usaba desde 1960. Desde entonces la FIDE publica listas con un número que mide la fuerza de cada jugador.",
      en: "FIDE adopts Arpad Elo's rating system, used by the US federation since 1960. FIDE then began publishing rating lists, a number measuring each player's strength.",
      source: "ChessBase, 'Arpad Elo and the Elo Rating System'; Wikipedia 'Elo rating system'",
    },
    {
      id: "tl-fischer-1972", year: 1972,
      title: { es: "Fischer, campeón", en: "Fischer becomes champion" },
      es: "En Reikiavik, Bobby Fischer vence a Boris Spassky en un match seguido por todo el mundo y es el primer campeón mundial nacido en Estados Unidos.",
      en: "In Reykjavik, Bobby Fischer beats Boris Spassky in a match followed around the world and becomes the first American-born world champion.",
      source: "Encyclopaedia Britannica, 'Bobby Fischer'; History.com; Wikipedia 'Wilhelm Steinitz' (naturalised US citizen in 1888)",
    },
    {
      id: "tl-kasparov-1985", year: 1985,
      title: { es: "Kaspárov, campeón", en: "Kasparov becomes champion" },
      es: "Garry Kaspárov vence a Kárpov y, con 22 años, es el campeón mundial más joven hasta entonces. Su duelo con Kárpov marcó una década.",
      en: "Garry Kasparov beats Karpov and, aged 22, is the youngest world champion up to then. His rivalry with Karpov defined a decade.",
      source: "Encyclopaedia Britannica, 'Garry Kasparov'; Wikipedia 'Karpov-Kasparov rivalry'",
    },
    {
      id: "tl-deepblue-1996", year: 1996,
      title: { es: "Deep Blue gana una partida", en: "Deep Blue wins a game" },
      es: "En Filadelfia, Deep Blue le gana una partida a Kaspárov con ritmo de torneo, algo inédito. Kaspárov igual gana el match 4 a 2.",
      en: "In Philadelphia, Deep Blue beats Kasparov in a game at tournament time controls, a first. Kasparov still wins the match 4-2.",
      source: "Wikipedia 'Deep Blue versus Garry Kasparov'; History.com",
    },
    {
      id: "tl-deepblue-1997", year: 1997,
      title: { es: "Deep Blue gana el match", en: "Deep Blue wins the match" },
      es: "En Nueva York, Deep Blue vence a Kaspárov por 3,5 a 2,5. Es la primera vez que una computadora gana un match a un campeón mundial vigente con ritmo de torneo.",
      en: "In New York, Deep Blue beats Kasparov 3.5-2.5. It is the first time a computer wins a match against a reigning world champion at standard tournament time controls.",
      source: "IBM Archives, 'Deep Blue'; Wikipedia 'Deep Blue versus Garry Kasparov'",
    },
    {
      id: "tl-kasparov-world-1999", year: 1999,
      title: { es: "Kaspárov contra el Mundo", en: "Kasparov versus the World" },
      es: "Más de 50.000 personas de más de 75 países juegan por internet contra Kaspárov, votando cada jugada. Él gana tras cuatro meses y 62 jugadas.",
      en: "More than 50,000 people from over 75 countries play Kasparov online, voting on every move. He wins after four months and 62 moves.",
      source: "Wikipedia 'Kasparov versus the World'; Microsoft news archive, 1999",
    },
    {
      id: "tl-reunification-2006", year: 2006,
      title: { es: "Se unifica el título", en: "The title is reunified" },
      es: "Krámnik vence a Topalov en Elista y pone fin a la división del título mundial, que había empezado en 1993 con el enfrentamiento entre Kaspárov y la FIDE.",
      en: "Kramnik beats Topalov in Elista and ends the split in the world title that began in 1993 with the break between Kasparov and FIDE.",
      source: "Wikipedia 'World Chess Championship 1993' and 'FIDE World Chess Championship 2006'",
    },
    {
      id: "tl-lichess-2010", year: 2010,
      title: { es: "Nace Lichess", en: "Lichess is born" },
      es: "Thibault Duplessis crea Lichess, un sitio de ajedrez gratuito, sin publicidad y de código abierto que se financia con donaciones.",
      en: "Thibault Duplessis creates Lichess, a free, ad-free, open-source chess site funded by donations.",
      source: "Wikipedia 'Lichess'; lichess.org/about",
    },
    {
      id: "tl-carlsen-2013", year: 2013,
      title: { es: "Carlsen, campeón", en: "Carlsen becomes champion" },
      es: "Magnus Carlsen vence a Viswanathan Anand en Chennai y se convierte en campeón mundial. En 2014 alcanzará un rating de 2882, el más alto registrado hasta ahora.",
      en: "Magnus Carlsen beats Viswanathan Anand in Chennai and becomes world champion. In 2014 he will reach a rating of 2882, the highest recorded so far.",
      source: "Wikipedia 'Magnus Carlsen'",
    },
    {
      id: "tl-alphazero-2017", year: 2017,
      title: { es: "AlphaZero", en: "AlphaZero" },
      es: "DeepMind presenta AlphaZero, una red neuronal que aprende ajedrez a partir de las reglas, solo jugando contra sí misma. Cambia la manera en que se piensan los motores.",
      en: "DeepMind presents AlphaZero, a neural network that learns chess from the rules alone, purely by playing itself. It changes how engines are thought about.",
      source: "Wikipedia 'AlphaZero'; ChessBase report (Dec 2017)",
    },
    {
      id: "tl-boom-2020", year: 2020,
      title: { es: "El auge del ajedrez online", en: "The online chess boom" },
      es: "La pandemia y la serie «Gambito de dama» disparan el interés: las búsquedas de «cómo jugar al ajedrez» llegan a su nivel más alto en nueve años, según reportes de la época.",
      en: "The pandemic and the series “The Queen's Gambit” spark a surge of interest: searches for “how to play chess” hit a nine-year high, according to reports at the time.",
      source: "Bloomberg (Netflix figures); Slashfilm and eBay/Google search reports (late 2020)",
    },
    {
      id: "tl-ding-2023", year: 2023,
      title: { es: "Ding Liren, campeón", en: "Ding Liren becomes champion" },
      es: "Ding Liren vence a Ian Nepomniachtchi en el desempate y es el primer chino campeón mundial masculino.",
      en: "Ding Liren beats Ian Nepomniachtchi in the tiebreak and becomes the first Chinese men's world champion.",
      source: "Wikipedia 'World Chess Championship 2023'",
    },
    {
      id: "tl-gukesh-2024", year: 2024,
      title: { es: "Gukesh, el más joven", en: "Gukesh, the youngest" },
      es: "Con 18 años, Gukesh Dommaraju vence a Ding Liren en Singapur y se convierte en el campeón mundial más joven de la historia.",
      en: "Aged 18, Gukesh Dommaraju beats Ding Liren in Singapore and becomes the youngest world champion in history.",
      source: "FIDE news; Guinness World Records; press reports of 12 Dec 2024",
    },
  ];

  // ---------- Normalisation (everything is frozen) ----------

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach((key) => deepFreeze(value[key]));
    }
    return value;
  }

  function buildFact(raw) {
    const fact = { id: raw.id, cat: raw.cat };
    if (typeof raw.year === "number") {
      fact.year = raw.year;
      if (raw.approx) fact.approx = true;
    }
    fact.text = { es: raw.es, en: raw.en };
    fact.source = raw.source;
    return fact;
  }

  function buildTimelineItem(raw) {
    const item = { id: raw.id, year: raw.year };
    if (raw.approx) item.approx = true;
    item.title = { es: raw.title.es, en: raw.title.en };
    item.text = { es: raw.es, en: raw.en };
    item.source = raw.source;
    return item;
  }

  const FACTS = deepFreeze(RAW_FACTS.map(buildFact));
  const TIMELINE = deepFreeze(RAW_TIMELINE.map(buildTimelineItem));
  const FACTS_BY_ID = new Map(FACTS.map((fact) => [fact.id, fact]));
  const CATEGORY_LIST = deepFreeze(CATEGORIES.slice());

  // ---------- i18n ----------

  function registerStrings() {
    const i18n = root.Ludus && root.Ludus.i18n;
    if (!i18n || typeof i18n.register !== "function") return;
    const bundle = {
      es: {
        "facts.title": "Historia y curiosidades",
        "facts.timeline": "Línea de tiempo",
        "facts.category": "Categoría",
        "facts.allCategories": "Todas",
        "facts.source": "Fuente",
        "facts.circa": "c. {year}",
      },
      en: {
        "facts.title": "History and curiosities",
        "facts.timeline": "Timeline",
        "facts.category": "Category",
        "facts.allCategories": "All",
        "facts.source": "Source",
        "facts.circa": "c. {year}",
      },
    };
    CATEGORIES.forEach((cat) => {
      bundle.es[`facts.cat.${cat}`] = CATEGORY_LABELS[cat].es;
      bundle.en[`facts.cat.${cat}`] = CATEGORY_LABELS[cat].en;
    });
    i18n.register(bundle);
  }
  registerStrings();

  // ---------- Helpers ----------

  function langKey(lang) {
    return lang === "en" ? "en" : "es";
  }

  function currentLang() {
    const i18n = root.Ludus && root.Ludus.i18n;
    try {
      return i18n && typeof i18n.lang === "function" ? langKey(i18n.lang()) : "es";
    } catch (error) {
      return "es";
    }
  }

  function isCategory(cat) {
    return CATEGORIES.includes(cat);
  }

  function poolFor(category) {
    if (category === undefined || category === null || category === "" || category === "all") return FACTS;
    return isCategory(category) ? FACTS.filter((fact) => fact.cat === category) : [];
  }

  // Accepts an array, a Set, a single id or nothing.
  function excludeList(exclude) {
    if (exclude === undefined || exclude === null) return [];
    if (typeof exclude === "string") return [exclude];
    if (Array.isArray(exclude)) return exclude.map((entry) => (entry && typeof entry === "object" ? entry.id : entry));
    if (typeof exclude[Symbol.iterator] === "function") {
      return Array.from(exclude, (entry) => (entry && typeof entry === "object" ? entry.id : entry));
    }
    return [];
  }

  function randomIndex(length, random) {
    const source = typeof random === "function" ? random : Math.random;
    const value = Number(source());
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(length - 1, Math.floor(value * length)));
  }

  // Fisher-Yates on a copy.
  function shuffleCopy(list, random) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = randomIndex(i + 1, random);
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function localized(fact, lang) {
    const key = langKey(lang);
    return Object.freeze(Object.assign({}, fact, { lang: key, body: fact.text[key] }));
  }

  // ---------- Public API ----------

  // Every fact. The objects are frozen; the array is new on every call.
  function all() {
    return FACTS.slice();
  }

  function get(id) {
    return FACTS_BY_ID.get(String(id)) || null;
  }

  function byCategory(category) {
    return poolFor(category === undefined || category === null || category === "" ? "all" : category).slice();
  }

  // One fact, chosen at random, that is not in `exclude` (ids, or facts).
  // While something is left the pick never repeats an excluded fact. When the
  // pool is exhausted (everything is excluded) the cycle restarts: any fact of
  // the pool can come back, except the last excluded one so the same fact never
  // shows twice in a row. Returns null only for an unknown/empty category.
  // With `lang` the result also carries `lang` and `body` (the text in that
  // language). `random` is injectable for tests.
  function pick(options) {
    const opts = options && typeof options === "object" ? options : {};
    const pool = poolFor(opts.category);
    if (!pool.length) return null;
    const excluded = excludeList(opts.exclude);
    const excludedSet = new Set(excluded);
    let candidates = pool.filter((fact) => !excludedSet.has(fact.id));
    if (!candidates.length) {
      const last = excluded.length ? excluded[excluded.length - 1] : null;
      candidates = pool.length > 1 ? pool.filter((fact) => fact.id !== last) : pool;
    }
    const chosen = candidates[randomIndex(candidates.length, opts.random)];
    return opts.lang ? localized(chosen, opts.lang) : chosen;
  }

  // The facts of a category (or all) in random order, for playlists.
  function shuffled(options) {
    const opts = options && typeof options === "object" ? options : {};
    return shuffleCopy(poolFor(opts.category), opts.random);
  }

  // The text of a fact (an id or a fact object) in one language.
  function text(idOrFact, lang) {
    const fact = idOrFact && typeof idOrFact === "object" ? idOrFact : get(idOrFact);
    if (!fact || !fact.text) return "";
    return fact.text[langKey(lang || currentLang())] || "";
  }

  // Timeline milestones, oldest first. The objects are frozen; the array is new.
  function timeline() {
    return TIMELINE.slice();
  }

  function categoryLabel(category, lang) {
    const labels = CATEGORY_LABELS[category];
    if (!labels) return "";
    return labels[langKey(lang || currentLang())];
  }

  // [{ id, label:{es,en}, labelKey, count }] in display order.
  function categories() {
    return CATEGORIES.map((cat) => ({
      id: cat,
      label: { es: CATEGORY_LABELS[cat].es, en: CATEGORY_LABELS[cat].en },
      labelKey: `facts.cat.${cat}`,
      count: FACTS.reduce((total, fact) => total + (fact.cat === cat ? 1 : 0), 0),
    }));
  }

  // "c. 600" (approximate years) or "1851". Accepts a fact/timeline item or a year.
  function formatYear(itemOrYear, lang) {
    const item = itemOrYear && typeof itemOrYear === "object" ? itemOrYear : { year: itemOrYear };
    if (typeof item.year !== "number" || !Number.isFinite(item.year)) return "";
    const year = String(Math.round(item.year));
    if (!item.approx) return year;
    const i18n = root.Ludus && root.Ludus.i18n;
    if (i18n && typeof i18n.t === "function") return i18n.t("facts.circa", { year }, langKey(lang || currentLang()));
    return `c. ${year}`;
  }

  return {
    CATEGORIES: CATEGORY_LIST,
    all,
    get,
    byCategory,
    pick,
    shuffled,
    text,
    timeline,
    categories,
    categoryLabel,
    formatYear,
  };
});
