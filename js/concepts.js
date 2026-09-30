// Short lessons (fork, pin, ...). Contract: docs/ARCHITECTURE.md section 8.
//
// Each concept is `{ id, title:{es,en}, body:{es,en}, fen, bestUci, tags }`:
// a title, a body of 2-4 sentences, one illustrative position (side to move
// can always win or improve something concrete) and the move that shows the
// idea in UCI. `tags` are the Insights tags this lesson explains.
//
// Every FEN is legal and every bestUci is a legal move in its FEN
// (scripts/tests/concepts.test.js), and Stockfish agrees that the move is the
// best one, or within the "same as best" band, or clearly winning
// (scripts/dev/verify-concepts.js; not part of `npm test`, it needs the engine).
//
// The moves in the texts are described with squares ("the knight jumps to c7")
// instead of SAN letters, so they read the same in Spanish and English.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Concepts = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const DATA = [
    {
      id: "fork",
      title: { es: "Doble ataque (horquilla)", en: "Fork" },
      body: {
        es: "Un doble ataque es una jugada que ataca dos o más objetivos a la vez, así que el rival solo puede salvar uno. Los caballos son los mejores para esto porque pocas piezas pueden espantarlos. Acá el caballo salta a c7 con jaque y ataca también a la dama: el rey tiene que moverse y el caballo se lleva la dama.",
        en: "A fork is one move that attacks two or more targets at once, so the opponent can only save one. Knights are the classic forkers because few pieces can chase them away. Here the knight jumps to c7 with check and also attacks the queen: the king has to move and the knight takes the queen.",
      },
      fen: "4k3/8/q7/1N6/8/8/P7/4K3 w - - 0 1",
      bestUci: "b5c7",
      tags: ["fork_available"],
    },
    {
      id: "pin",
      title: { es: "Clavada", en: "Pin" },
      body: {
        es: "Una clavada inmoviliza una pieza: si se mueve, queda expuesta otra más valiosa detrás (muchas veces el rey). Además, una pieza clavada es un blanco porque no puede escapar. Acá la torre de e1 clava el alfil de e6 contra el rey, así que el peón avanza a d5, lo ataca y lo gana por un peón.",
        en: "A pin freezes a piece: if it moves, a more valuable piece behind it (often the king) is exposed. A pinned piece is also a target, because it cannot run away. Here the rook on e1 pins the bishop on e6 to the king, so the pawn advances to d5, attacks it and wins it for a pawn.",
      },
      fen: "4k3/3p1ppp/4b3/8/3P4/8/5PPP/4R1K1 w - - 0 1",
      bestUci: "d4d5",
      tags: ["pin_or_skewer"],
    },
    {
      id: "skewer",
      title: { es: "Ensartada", en: "Skewer" },
      body: {
        es: "Una ensartada es una clavada al revés: atacás una pieza valiosa y, cuando se aparta, capturás la que estaba detrás. Alfiles, torres y damas la hacen por columnas, filas y diagonales. Acá la torre da jaque desde a8 por la octava fila; cuando el rey se aparta, se lleva la dama de h8.",
        en: "A skewer is a pin in reverse: you attack a valuable piece and, when it moves away, you capture the piece behind it. Bishops, rooks and queens make skewers along files, ranks and diagonals. Here the rook checks from a8 along the eighth rank; when the king steps aside, the rook takes the queen on h8.",
      },
      fen: "3k3q/8/8/8/8/8/8/R3K3 w - - 0 1",
      bestUci: "a1a8",
      tags: ["pin_or_skewer"],
    },
    {
      id: "discovered_attack",
      title: { es: "Ataque descubierto", en: "Discovered attack" },
      body: {
        es: "Un ataque descubierto ocurre cuando movés una pieza y dejás al descubierto el ataque de otra que estaba detrás. La pieza que se movió también puede hacer algo útil, así que el rival enfrenta dos amenazas. Acá el caballo captura la dama de f7 y abre el jaque de la torre por la columna e: las negras deben atender el jaque, y las blancas ganan la dama por un caballo.",
        en: "A discovered attack happens when you move one piece and uncover an attack by another piece behind it. The moved piece can do something useful too, so the opponent faces two threats. Here the knight takes the queen on f7 and opens the rook's check on the e-file: Black must deal with the check, and White wins the queen for a knight.",
      },
      fen: "4k3/5q2/8/4N3/8/8/8/4R1K1 w - - 0 1",
      bestUci: "e5f7",
      tags: ["discovered_attack"],
    },
    {
      id: "back_rank_mate",
      title: { es: "Mate del pasillo", en: "Back-rank mate" },
      body: {
        es: "El mate del pasillo ocurre cuando el rey queda encerrado en su última fila por sus propios peones y una torre o dama da jaque por esa fila. Es una de las formas más comunes de perder una partida ganada. Acá la torre da mate en a8: los peones de f7, g7 y h7 le quitan todas las casillas de escape. Antes de mover, fijate si tu rey tiene una casilla de escape (una ventana).",
        en: "A back-rank mate happens when a king is trapped on its first rank by its own pawns and a rook or queen checks along that rank. It is one of the most common ways to lose a won game. Here the rook mates on a8: the pawns on f7, g7 and h7 take away every escape square. Before you move, check that your own king has a flight square (a luft).",
      },
      fen: "6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1",
      bestUci: "a1a8",
      tags: ["back_rank", "missed_mate", "allows_mate"],
    },
    {
      id: "hanging_piece",
      title: { es: "Pieza colgada", en: "Hanging piece" },
      body: {
        es: "Una pieza colgada está atacada y no tiene defensa suficiente, así que se puede capturar gratis (o en un mal cambio). Antes de cada jugada, revisá qué está atacado de los dos lados: lo tuyo y lo del rival. Acá el alfil de d5 no tiene defensa, así que la torre simplemente lo captura.",
        en: "A hanging piece is attacked without enough defence, so it can be captured for free (or in a bad trade). Before every move, check what is attacked on both sides: yours and your opponent's. Here the bishop on d5 has no defender, so the rook simply takes it.",
      },
      fen: "4k3/8/8/3b4/8/8/8/3RK3 w - - 0 1",
      bestUci: "d1d5",
      tags: ["hangs_piece", "missed_capture"],
    },
    {
      id: "zugzwang",
      title: { es: "Zugzwang", en: "Zugzwang" },
      body: {
        es: "El zugzwang es una posición en la que el bando que mueve preferiría pasar, porque cualquier jugada legal empeora su situación. Es típico de los finales de peones, donde los reyes tienen pocas casillas seguras. Acá el rey blanco va a a5: las negras tienen que mover su rey y dejan entrar al rey blanco a ganar el peón de e6, mientras que con las blancas a mover no se lograría nada.",
        en: "Zugzwang is a position where the side to move would love to pass, because every legal move makes things worse. It is typical of pawn endgames, where the kings have few safe squares. Here the white king goes to a5: Black has to move the king and lets White's king in to win the e6 pawn, while with White to move nothing would be gained.",
      },
      fen: "8/k7/4p3/4P3/K7/8/8/8 w - - 0 1",
      bestUci: "a4a5",
      tags: ["endgame_technique"],
    },
    {
      id: "opposition",
      title: { es: "Oposición", en: "Opposition" },
      body: {
        es: "Los reyes nunca pueden quedar pegados, así que cuando se enfrentan con una casilla en medio, el bando que NO tiene que mover tiene la oposición. Ese bando puede obligar al otro rey a ceder el paso. Acá el rey blanco va a e6: con las negras a mover, el rey negro debe apartarse y el peón blanco llegará a coronar.",
        en: "Kings can never stand next to each other, so when they face each other with one square between them, the side that does NOT have to move holds the opposition. That side can force the other king to give way. Here the white king goes to e6: with Black to move, the black king must step aside and the white pawn will queen.",
      },
      fen: "4k3/8/3K4/4P3/8/8/8/8 w - - 0 1",
      bestUci: "d6e6",
      tags: ["endgame_technique"],
    },
    {
      id: "passed_pawn",
      title: { es: "Peón pasado", en: "Passed pawn" },
      body: {
        es: "Un peón pasado no tiene peones rivales delante ni en las columnas vecinas, así que solo las piezas pueden detenerlo. Cuanto más cerca de coronar, más fuerte es, y fuera del alcance del rey rival puede decidir la partida. Acá el peón de a queda fuera del cuadrado que alcanza el rey negro: las blancas lo empujan y coronan; cualquier jugada más lenta deja que el rey lo alcance.",
        en: "A passed pawn has no enemy pawn in front of it or on the neighbouring files, so only pieces can stop it. It gets stronger the closer it is to promotion, and out of reach of the enemy king it can decide the game. Here the a-pawn is outside the square the black king can reach: White pushes and queens, and any slower move lets the king catch up.",
      },
      fen: "8/8/8/P3k3/8/8/8/K7 w - - 0 1",
      bestUci: "a5a6",
      tags: ["endgame_technique"],
    },
    {
      id: "open_file",
      title: { es: "Columna abierta", en: "Open file" },
      body: {
        es: "Una columna abierta no tiene peones. A las torres les encantan porque llegan al campo rival y atacan peones por detrás. Duplicar torres o invadir la séptima fila desde una columna abierta es un plan clásico. Acá la torre usa la columna c abierta para llegar a c7 y atacar el peón débil de b7.",
        en: "An open file has no pawns on it. Rooks love open files because they reach the enemy side of the board and attack pawns from behind. Doubling rooks or invading the seventh rank from an open file is a classic plan. Here the rook uses the open c-file to land on c7 and attack the weak b7 pawn.",
      },
      fen: "r5k1/pp3ppp/5n2/8/8/3B4/PP3PPP/2R3K1 w - - 0 1",
      bestUci: "c1c7",
      tags: ["open_file"],
    },
    {
      id: "outpost",
      title: { es: "Puesto avanzado", en: "Outpost" },
      body: {
        es: "Un puesto avanzado es una casilla adelantada, idealmente entre la cuarta y la sexta fila, protegida por un peón propio y que ningún peón rival puede atacar. Un caballo ahí es muy difícil de echar y controla muchas casillas del campo contrario. Acá el caballo va a e5: lo protege el peón de d4 y las negras ya no tienen peones en d ni en f para echarlo.",
        en: "An outpost is an advanced square, ideally on the fourth to sixth rank, protected by your own pawn and out of reach of enemy pawns. A knight there is very hard to dislodge and controls many squares in the enemy camp. Here the knight goes to e5: the d4 pawn protects it and Black has no d- or f-pawn left to chase it away.",
      },
      fen: "r4rk1/pp2b1pp/1nb5/8/3P4/2N1BN2/PP3PP1/R4RK1 w - - 0 1",
      bestUci: "f3e5",
      tags: ["outpost"],
    },
    {
      id: "development_center",
      title: { es: "Desarrollo y centro", en: "Development and centre" },
      body: {
        es: "En la apertura, peleá por el centro con peones, sacá los caballos y alfiles antes de mover dos veces la misma pieza, y enrocá temprano. Las piezas en el centro alcanzan más casillas, y un rey que se queda en el medio es fácil de atacar. Desde la posición inicial, e4 reclama el centro y abre líneas para el alfil y la dama.",
        en: "In the opening, fight for the centre with pawns, bring your knights and bishops out before moving the same piece twice, and castle early. Pieces in the centre reach more squares, and a king that stays in the middle is easy to attack. From the starting position, e4 claims the centre and opens lines for the bishop and the queen.",
      },
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      bestUci: "e2e4",
      tags: ["development"],
    },
    {
      id: "king_safety",
      title: { es: "Seguridad del rey", en: "King safety" },
      body: {
        es: "Poné tu rey a salvo antes de atacar: enrocá, mantené los peones delante de él y tené cuidado al abrir líneas hacia él. Un rey en el centro puede ser atacado por todas las piezas, así que un tiempo dedicado a enrocar casi siempre vale la pena. Acá las blancas ya sacaron un caballo y un alfil, así que enrocar es el paso natural.",
        en: "Put your king in safety before you attack: castle, keep the pawns in front of it, and be careful about opening lines towards it. A king in the centre can be attacked by every piece, so a tempo spent castling is almost always worth it. Here White has already developed a knight and a bishop, so castling is the natural next step.",
      },
      fen: "r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
      bestUci: "e1g1",
      tags: ["king_safety", "development"],
    },
    {
      id: "trade_when_ahead",
      title: { es: "Cambiar cuando vas ganando", en: "Trading when ahead" },
      body: {
        es: "Cuando vas ganando material, cambiar piezas hace que tu ventaja pese más: con menos piezas en el tablero, la pieza de más vale una parte mayor y el rival tiene menos contrajuego. Evitá los cambios cuando vas perdiendo, salvo que te ayuden. Acá las blancas tienen un caballo de más, así que cambiar un par de torres es una forma simple de ir hacia un final ganado.",
        en: "When you are ahead in material, trading pieces makes your advantage count for more: with fewer pieces left, the extra piece is a bigger share of what remains and the opponent has less counterplay. Avoid trades when you are behind, unless they help you. Here White is a knight up, so trading a pair of rooks is a simple way to head for a winning endgame.",
      },
      fen: "2r1r1k1/5ppp/8/8/8/2N5/5PPP/2R1R1K1 w - - 0 1",
      bestUci: "e1e8",
      tags: ["trade_when_ahead"],
    },
  ];

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach((key) => deepFreeze(value[key]));
    }
    return value;
  }

  const CONCEPTS = deepFreeze(DATA);
  const BY_ID = new Map(CONCEPTS.map((concept) => [concept.id, concept]));

  // Also register the texts with Ludus.i18n (concept.<id>.title / .body) so a
  // screen can use plain i18n keys and follow the language switch.
  function registerStrings() {
    const i18n = root.Ludus && root.Ludus.i18n;
    if (!i18n || typeof i18n.register !== "function") return;
    const bundle = { es: {}, en: {} };
    CONCEPTS.forEach((concept) => {
      ["es", "en"].forEach((lang) => {
        bundle[lang][`concept.${concept.id}.title`] = concept.title[lang];
        bundle[lang][`concept.${concept.id}.body`] = concept.body[lang];
      });
    });
    i18n.register(bundle);
  }
  registerStrings();

  // Every concept, in teaching order. The objects are frozen; the array is new.
  function list() {
    return CONCEPTS.slice();
  }

  function get(id) {
    return BY_ID.get(String(id)) || null;
  }

  // Concepts that explain an Insights tag.
  function byTag(tag) {
    return CONCEPTS.filter((concept) => concept.tags.includes(tag));
  }

  // { title, body } in one language ("es" when unknown), or null.
  function text(id, lang) {
    const concept = get(id);
    if (!concept) return null;
    const key = lang === "en" ? "en" : "es";
    return { title: concept.title[key], body: concept.body[key] };
  }

  return { list, get, byTag, text };
});
