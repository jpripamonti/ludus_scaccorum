// Tactical and positional insights: turns "the engine says X is better" into a
// few short, hedged sentences about WHY, in Spanish and English.
//
// Contract: docs/ARCHITECTURE.md section 8. Pure logic, no DOM, no storage;
// it only needs Ludus.chess (and Ludus.i18n to render text) at call time.
//
// API
//   Insights.positionFeatures(fen) -> null (unusable FEN) | {
//       fen, turn, fullmove, phase, material:{w,b,diff}, legalCount, inCheck,
//       isCheckmate, isStalemate,
//       hanging:{w:[sq],b:[sq]}, hangingDetail:{w:[{sq,piece,loss,why}],b:[...]},
//       passedPawns:{w:[sq],b:[sq]}, backRankWeak:{w,b},
//       kings:{w:{sq,shield,openFiles,halfOpenFiles},b:{...}} }
//   Insights.analyzeChoice({ fen, userUci, bestUci, assessment?, lines?, userPv?, masterUci?,
//                            timing?:{timeSpentMs,limitMs,timedOut}, timeTrouble? })
//       -> { tags:[tag], phase, messages:[{key, params, tag, raw}], conceptIds:[id],
//            verdict:"same"|"equivalent"|"close"|"worse"|"nomove"|"unknown",
//            features:{best, user} (see moveFeatures), error? }
//     Never throws (on internal failure `error` is set and the rest is empty).
//     `assessment` is the Scoring assessment (isBest, winLossPct, reason,
//     userScore, bestScore, mateExtraMoves); without it the engine `lines`
//     decide whether the user's move was about as good. `lines` also carry the
//     engine's principal variations (`pv`, UCI moves): every claim that says a
//     move "wins" or "loses" material is checked against the material along
//     that line (see "Evidence"); `userPv` is the engine's line after the
//     user's move when it is not one of `lines` (app.js has it from the
//     restricted search). `masterUci` is accepted for contract compatibility
//     and not used yet. userUci null = no move (timeout / skip).
//     A perfect answer (user played best) gets no tags; an equivalent or close
//     one gets only "solid"; nothing is invented.
//   Insights.moveFeatures(fen, uci, { lines?, pv? }?) -> null | { uci, san, piece, from, to,
//       capture, captured, promotion, castle, check, mate, quiet, sacrifice, gain, loss }
//     `sacrifice` is what the scoring layer needs for the "brilliant" quality;
//     it follows the engine line when `lines`/`pv` are given and the reply to the
//     move alone otherwise.
//   Insights.gamePhase(fen | Chess | cells[, fullmove]) -> "opening"|"middlegame"|"endgame"
//     The one game-phase classifier of the app (see "Phase" below).
//   Insights.renderMessage(message, lang?) / renderMessages(messages, lang?)
//     -> plain text (never HTML: escape it before putting it in markup). Uses the
//     language-neutral `message.raw`, so a message built in one language can be
//     shown in the other; `Ludus.i18n.t(message.key, message.params)` also works
//     and gives the language current when the analysis ran.
//   Insights.tagLabelKey(tag) -> i18n key of the tag's short label; Insights.TAGS.
//   Strings live under the "insight." prefix and are registered in es and en.
//
// Everything here is a heuristic over a static board. The rules of thumb are:
//   * a tag is only produced from facts we can check on the board (an exact
//     mate-in-one search, a static exchange, an attack pattern) or from what
//     the engine assessment says (missed/allowed mate);
//   * wording is hedged ("looks like", "may", "probably");
//   * when nothing solid is found we say less, never something doubtful.
//
// Definitions used below (all material in pawn units P1 N3 B3 R5 Q9):
//
//   Static exchange (SEE). The classic swap algorithm on one square: both
//   sides capture with their least valuable attacker while it pays, x-rays are
//   revealed as attackers leave, the king counts as a very valuable last
//   attacker. The FIRST capture is restricted to attackers that are legal
//   (not pinned / not leaving their own king in check). Later captures ignore
//   pins, which is why the result is an approximation: it can miss that a
//   defender is pinned, so it errs towards saying "defended", i.e. towards
//   saying less.
//
//   Hanging. A non-king piece of colour c is hanging when the opponent could
//   start a capture on its square that wins material by SEE (result >= 1 for a
//   pawn, >= 2 for any other piece) and colour c has no capture of its own,
//   right after that first capture, that wins at least as much elsewhere.
//   Covers both "attacked and not defended" and "attacked by a cheaper piece"
//   and "attacked more often than defended". It is the threat view: the
//   opponent is treated as being to move, whoever's turn it really is.
//
//   Evidence. A sentence that says a move wins or loses material is only
//   written when the material along the engine's line agrees. The line is
//   played on the board (`traceLine`) and after every ply the captures that are
//   hanging at that moment are settled with a legal-move quiescence search
//   (captures, promotions and check evasions, stand pat otherwise); the result
//   is the mover's material change against the start, in pawn units. A line
//   "wins material" when it ends at least 1.5 units up (1 for a plain capture)
//   or in checkmate, and "loses material" when it ends at least 2 down. Without
//   a line of three or more plies only the settled reply to the move is known,
//   which is enough for a plain capture and too little for a fork, a pin or a
//   discovered attack (those say nothing then). The same trace defines the next
//   two terms.
//
//   Sacrifice. The move is not checkmate, the moved piece is not the king and
//   the settled material of its line sits at least 2 units below the start on
//   two plies in a row (or at the end of the line, or right before a mate), the
//   first of them within the first four plies and counted from the opponent's
//   actual reply on (a minor piece for a pawn, an exchange, a queen for a mating
//   attack, ...),
//   while the line does not leave the mover worse than about -1.00 (a losing
//   side giving things up is not sacrificing). Without a line only the settled
//   reply to the move can be looked at. Giving up a single pawn is a gambit, not
//   a sacrifice. It does not matter whether the material comes back: a sacrifice
//   that is recouped is still one, and a capture that is simply recaptured never
//   is. An offer the engine's best defence declines (17...Be6!!) is no sacrifice
//   along its line; app.js also counts the master's move of a classic marked
//   "sacrifice" by the data.
//
//   Phase. Total non-pawn material of both sides (N 3, B 3, R 5, Q 9; 62 at the
//   start), how many pieces are left and the move number: endgame when that
//   material is 16 or less, or only four pieces or fewer remain, or there are no
//   queens and it is 26 or less; opening while it is 50 or more (at most one
//   minor piece traded) up to move 10; everything else is middlegame. app.js
//   takes its phase from here. The classics builder (scripts/build-classics.js
//   phaseOf) has the same rule except for the "four pieces or fewer" clause (it
//   calls 7 of the 248 training positions middlegames that are endgames), so its
//   `phase` field should call this function too.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Insights = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  // ---------------------------------------------------------------------------
  // Catalog
  // ---------------------------------------------------------------------------

  const TAGS = Object.freeze([
    "hangs_piece", "missed_capture", "missed_mate", "allows_mate", "missed_check",
    "quiet_best", "sacrifice_best", "back_rank", "fork_available", "pin_or_skewer",
    "discovered_attack", "missed_promotion", "development", "king_safety",
    "endgame_technique", "open_file", "outpost", "trade_when_ahead",
    "time_trouble", "solid", "loses_material", "tactic_available",
  ]);

  // Lower number = shown first. Tags that explain a concrete loss come first.
  const PRIORITY = {
    allows_mate: 10, missed_mate: 12, hangs_piece: 20, loses_material: 22,
    // Among the tactics the pattern comes before the plain capture: it says WHY the capture wins.
    fork_available: 28, pin_or_skewer: 29, discovered_attack: 31, missed_capture: 32, back_rank: 38,
    sacrifice_best: 40, missed_promotion: 42, tactic_available: 44, missed_check: 50, king_safety: 52,
    development: 54, open_file: 56, outpost: 57, trade_when_ahead: 58,
    endgame_technique: 60, quiet_best: 70, time_trouble: 80, solid: 90,
  };

  // Three messages are plenty (two when a mate explains the answer): the ones
  // that follow say the same thing again or dilute it.
  const MAX_MESSAGES = 3;
  const MAX_MATE_MESSAGES = 2;
  // Two independent 1.5 s searches of the same move differ by 1.9 win% on
  // average (measured on the 28 classic games, docs/SCORING.md section 15), so a
  // sentence that says "as good as the best move" needs a margin: under 1.5
  // points it is called solid (8% of those were more than 3.5 worse in a second
  // search, against 15% with the old 3-point line); between 1.5 and 3 the move is
  // only "close"; from 3 up we start explaining what went wrong.
  const EQUIVALENT_LOSS_PCT = 1.5;
  const CLOSE_LOSS_PCT = 3;
  const CLOSE_MESSAGE_MAX_PCT = 2.5;
  // "Clearly better" (and the wording that goes with it) starts here.
  const BIG_LOSS_PCT = 8;
  // A claim about a mate length is only made when it is reliable: the engine
  // reports a mate it may have shortened later, never one that is shorter, so
  // "in N or fewer" holds; a mate against the user from a short search is only
  // trusted up to 6 (measured: every claim up to 6 held, most beyond 7 did not).
  const MAX_MISSED_MATE_CLAIM = 8;
  const MAX_ALLOWED_MATE_CLAIM = 6;
  // Material (pawn units) an engine line has to win for a sentence to say so.
  const WIN_CLAIM = 1.5;
  const LOSS_CLAIM = 2;
  // What "the engine's line wins material" needs to say when nothing more specific
  // explains the best move: a piece's worth, held for two plies (audit: lines that
  // gain 2 only on the last ply were unconfirmed by a second search in 1 of 2 cases).
  const TACTIC_CLAIM = 3;
  const TACTIC_MIN_SCORE = 50; // centipawns
  const SACRIFICE_MIN = 2;
  const SACRIFICE_MIN_SCORE = 100; // centipawns: a "sacrifice" that leaves the mover worse than this is just a bad position
  const TRACE_PLIES = 8;
  const SACRIFICE_PLIES = 6;
  const SACRIFICE_LATEST_PLY = 4; // the material has to be given up by the fourth ply
  const QS_DEPTH = 6;
  const QS_NODE_LIMIT = 6000; // per traceLine call (measured on 3,000 answers: median 156, largest 886)

  // ---------------------------------------------------------------------------
  // Strings (Spanish rioplatense "vos" + English)
  // ---------------------------------------------------------------------------

  const STRINGS = {
    es: {
      "insight.piece.N": "caballo", "insight.piece.B": "alfil", "insight.piece.R": "torre",
      "insight.piece.Q": "dama", "insight.piece.P": "peón", "insight.piece.K": "rey",
      "insight.pieceDef.N": "el caballo", "insight.pieceDef.B": "el alfil", "insight.pieceDef.R": "la torre",
      "insight.pieceDef.Q": "la dama", "insight.pieceDef.P": "el peón", "insight.pieceDef.K": "el rey",
      "insight.fmt.on": "{piece} en {sq}",
      "insight.fmt.and": " y ",
      "insight.why.free": "parece quedar sin protección",
      "insight.why.cheaper": "se puede capturar con una pieza más barata",
      "insight.why.outnumbered": "recibe más ataques que defensas",

      "insight.allows_mate.san": "Después de {san}, el rival tiene {reply}, que es mate. Revisá sus jugadas forzadas antes de mover.",
      "insight.allows_mate.forced": "{san} probablemente permite un mate forzado en {n} jugadas o menos. Revisá primero las jugadas forzadas del rival.",
      "insight.allows_mate.generic": "{san} parece dejarte ante un ataque decisivo, quizá un mate forzado. Mirá todos los jaques del rival antes de mover.",
      "insight.missed_mate.san": "{best} era mate. Cuando el rey rival tiene pocas casillas, mirá primero los jaques.",
      "insight.missed_mate.forced": "{best} empieza un mate forzado en {n} jugadas o menos. Los jaques y las jugadas forzadas merecen la primera mirada.",
      "insight.missed_mate.generic": "Parecía haber un mate forzado empezando con {best}. Mirá primero jaques y jugadas forzadas.",
      "insight.slower_mate": "Tu jugada también lleva a un mate forzado, pero {best} llega antes. Cuando veas un mate, contá si hay uno más corto.",
      "insight.hangs_piece.moved": "Después de {san}, tu {piece} en {sq} {why}, así que probablemente perdés material.",
      "insight.hangs_piece.left": "Tu {piece} en {sq} ya estaba en peligro ({why}) y {san} quizá no lo resolvió.",
      "insight.hangs_piece.exposed": "Después de {san}, tu {piece} en {sq} {why}. Quizá la jugada abrió una línea o quitó un defensor.",
      "insight.missed_capture.free": "{best} parece ganar {targetDef} en {sq}, que está sin protección.",
      "insight.missed_capture.cheaper": "{best} parece ganar material: {targetDef} en {sq} cae ante una pieza de menor valor.",
      "insight.missed_capture.win": "{best} parece ganar material al capturar {targetDef} en {sq}.",
      "insight.fork": "{best} parece un doble ataque: {pieceDef} atacaría {targets} a la vez.",
      "insight.pin": "{best} clava {pinnedDef} en {sq} contra el rey: no puede moverse con libertad.",
      "insight.skewer": "{best} parece una ensartada: {frontDef} está bajo ataque y, cuando se mueva, {behindDef} en {sq} podría caer.",
      "insight.discovered": "{best} descubre un ataque: {sliderDef} en {sq} ahora ataca {targetDef} en {sq2}.",
      "insight.back_rank.exploit": "El rey rival parece encerrado en su fila de fondo: {best} puede aprovecharlo.",
      "insight.back_rank.own": "Tu fila de fondo parece frágil: el rey no tiene casilla de escape. Una jugada de peón (ventana) puede ayudar.",
      "insight.sacrifice_best": "{best} parece un sacrificio: entrega material a propósito. Calculalo con cuidado y mirá qué recupera después.",
      "insight.missed_promotion": "{best} corona un peón. Un peón a un paso de coronar merece la primera mirada.",
      "insight.missed_check": "{best} da jaque. Antes de jugar algo tranquilo, conviene mirar todos los jaques.",
      "insight.missed_check.after": "Antes de jugar {san}, conviene mirar todos los jaques: {best} da jaque.",
      "insight.tactic_available": "Después de {best}, la línea del motor parece ganar material: unos {n} puntos (peón 1, pieza 3, torre 5, dama 9).",
      "insight.loses_material": "Después de {san}, la línea del motor parece costarte material: unos {n} puntos. Mirá qué puede capturar o atacar el rival.",
      "insight.king_safety.pawn": "Mover el peón de {sq} puede debilitar el refugio que rodea a tu rey.",
      "insight.king_safety.king": "{san} saca al rey de su refugio, y eso puede dejarlo expuesto.",
      "insight.king_safety.castle": "{best} es enroque: el rey sigue en el centro y ponerlo a salvo parece urgente.",
      "insight.development.castle": "{best} es enroque: guarda al rey y conecta las torres. Suele convenir hacerlo temprano.",
      "insight.development.twice": "{san} mueve una pieza que ya salió mientras otras siguen en casa; {best} parece más útil.",
      "insight.development.first": "Primero el desarrollo: {best} pone otra pieza en juego, y eso suele valer más que otras jugadas acá.",
      "insight.open_file": "{best} pone la torre en la columna {file} abierta, donde gana actividad.",
      "insight.open_file.seventh": "{best} usa la columna {file} abierta para llevar la torre a la séptima fila, donde ataca peones por detrás.",
      "insight.outpost": "{best} pone el caballo en {sq}: lo protege un peón y ningún peón rival puede atacarlo ahí.",
      "insight.trade_when_ahead": "Vas arriba en material: {best} cambia piezas, y los cambios suelen favorecer a quien va ganando.",
      "insight.endgame.king": "En los finales el rey suele ser una pieza activa: {best} lo acerca al centro.",
      "insight.endgame.passed": "{best} avanza el peón pasado de {sq}; en los finales suele convenir empujarlo.",
      "insight.quiet_best.saves": "{best} es una jugada tranquila que parece salvar tu {piece} en {sq}, que estaba en peligro.",
      "insight.quiet_best.threat": "{best} es una jugada tranquila que parece amenazar {targetDef} en {sq}.",
      "insight.quiet_best.generic": "{best} es tranquila: sin captura ni jaque. Mejorar una pieza puede valer más que una jugada forzada.",
      "insight.time_trouble": "Usaste casi todo el tiempo. Con el reloj en contra, mirá primero jaques, capturas y amenazas.",
      "insight.time_trouble.out": "Se acabó el tiempo antes de que movieras. Con el reloj en contra, mirá primero jaques, capturas y amenazas.",
      "insight.solid": "No es la primera opción del motor, pero {san} parece una alternativa sólida, casi igual de buena.",
      "insight.close": "{san} parece quedar cerca de {best}: la diferencia es chica, del orden del margen de error del motor.",
      "insight.no_clear_reason": "El motor prefiere {best}. El motivo puede ser posicional o una táctica más larga.",
      "insight.no_clear_reason.big": "{best} era claramente mejor. Antes de mover, mirá las capturas, jaques y amenazas del rival.",

      "insight.tag.hangs_piece": "Pieza colgada",
      "insight.tag.missed_capture": "Captura perdida",
      "insight.tag.missed_mate": "Mate perdido",
      "insight.tag.allows_mate": "Permite mate",
      "insight.tag.missed_check": "Jaque perdido",
      "insight.tag.quiet_best": "Mejor jugada tranquila",
      "insight.tag.sacrifice_best": "Sacrificio",
      "insight.tag.back_rank": "Mate del pasillo",
      "insight.tag.fork_available": "Doble ataque",
      "insight.tag.pin_or_skewer": "Clavada o ensartada",
      "insight.tag.discovered_attack": "Ataque descubierto",
      "insight.tag.missed_promotion": "Coronación perdida",
      "insight.tag.development": "Desarrollo",
      "insight.tag.king_safety": "Seguridad del rey",
      "insight.tag.endgame_technique": "Técnica de finales",
      "insight.tag.open_file": "Columna abierta",
      "insight.tag.outpost": "Puesto avanzado",
      "insight.tag.trade_when_ahead": "Cambiar cuando ganás",
      "insight.tag.time_trouble": "Apuro de tiempo",
      "insight.tag.solid": "Alternativa sólida",
      "insight.tag.loses_material": "Pierde material",
      "insight.tag.tactic_available": "Táctica disponible",
      "insight.tag.other": "Otro motivo",
    },
    en: {
      "insight.piece.N": "knight", "insight.piece.B": "bishop", "insight.piece.R": "rook",
      "insight.piece.Q": "queen", "insight.piece.P": "pawn", "insight.piece.K": "king",
      "insight.pieceDef.N": "the knight", "insight.pieceDef.B": "the bishop", "insight.pieceDef.R": "the rook",
      "insight.pieceDef.Q": "the queen", "insight.pieceDef.P": "the pawn", "insight.pieceDef.K": "the king",
      "insight.fmt.on": "{piece} on {sq}",
      "insight.fmt.and": " and ",
      "insight.why.free": "looks unprotected",
      "insight.why.cheaper": "can be captured by a cheaper piece",
      "insight.why.outnumbered": "is attacked more often than it is defended",

      "insight.allows_mate.san": "After {san}, the opponent has {reply}, which is checkmate. Check their forcing replies before you move.",
      "insight.allows_mate.forced": "{san} probably allows a forced mate in {n} moves or fewer. Check every forcing reply from the opponent first.",
      "insight.allows_mate.generic": "{san} looks like it leaves you facing a decisive attack, perhaps a forced mate. Check every check the opponent has before moving.",
      "insight.missed_mate.san": "{best} was checkmate. When the enemy king is short of squares, look at checks first.",
      "insight.missed_mate.forced": "{best} starts a forced mate in {n} moves or fewer. Checks and forcing moves deserve the first look.",
      "insight.missed_mate.generic": "There looked to be a forced mate starting with {best}. Look at checks and forcing moves first.",
      "insight.slower_mate": "Your move also leads to a forced mate, but {best} gets there sooner. When you see a mate, count whether a shorter one exists.",
      "insight.hangs_piece.moved": "After {san}, your {piece} on {sq} {why}, so you probably lose material.",
      "insight.hangs_piece.left": "Your {piece} on {sq} was already in danger ({why}) and {san} may not have solved that.",
      "insight.hangs_piece.exposed": "After {san}, your {piece} on {sq} {why}. The move may have opened a line or removed a defender.",
      "insight.missed_capture.free": "{best} looks like it wins {targetDef} on {sq}, which has no protection.",
      "insight.missed_capture.cheaper": "{best} looks like it wins material: {targetDef} on {sq} falls to a cheaper piece.",
      "insight.missed_capture.win": "{best} looks like it wins material by capturing {targetDef} on {sq}.",
      "insight.fork": "{best} looks like a fork: {pieceDef} would attack {targets} at once.",
      "insight.pin": "{best} pins {pinnedDef} on {sq} against the king, so it cannot move freely.",
      "insight.skewer": "{best} looks like a skewer: {frontDef} is attacked and, once it moves, {behindDef} on {sq} may fall.",
      "insight.discovered": "{best} uncovers an attack: {sliderDef} on {sq} now attacks {targetDef} on {sq2}.",
      "insight.back_rank.exploit": "The enemy king looks boxed in on its back rank: {best} may exploit that.",
      "insight.back_rank.own": "Your back rank looks fragile: the king has no escape square. A pawn move (luft) may help.",
      "insight.sacrifice_best": "{best} looks like a sacrifice: it gives up material on purpose. Calculate it carefully and check what it wins back.",
      "insight.missed_promotion": "{best} promotes a pawn. A pawn one step from queening deserves the first look.",
      "insight.missed_check": "{best} gives check. Before quiet moves, it is worth looking at every check.",
      "insight.missed_check.after": "Before you play {san}, it is worth looking at every check: {best} gives check.",
      "insight.tactic_available": "After {best}, the engine's line looks like it wins material: about {n} points (pawn 1, minor piece 3, rook 5, queen 9).",
      "insight.loses_material": "After {san}, the engine's line looks like it costs you material: about {n} points. Check what your opponent can capture or attack.",
      "insight.king_safety.pawn": "Moving the pawn on {sq} may weaken the shelter around your king.",
      "insight.king_safety.king": "{san} walks the king out of its shelter, which may leave it exposed.",
      "insight.king_safety.castle": "{best} castles: the king is still in the centre, and getting it to safety looks urgent.",
      "insight.development.castle": "{best} castles: it tucks the king away and connects the rooks. That usually comes early.",
      "insight.development.twice": "{san} moves a piece that has already left home while others sit at home; {best} looks more useful.",
      "insight.development.first": "Development first: {best} brings another piece into play, which is usually worth more than other moves here.",
      "insight.open_file": "{best} puts the rook on the open {file}-file, where it can become active.",
      "insight.open_file.seventh": "{best} uses the open {file}-file to put the rook on the seventh rank, where it attacks pawns from behind.",
      "insight.outpost": "{best} puts the knight on {sq}: a pawn protects it and no enemy pawn can attack it there.",
      "insight.trade_when_ahead": "You are ahead in material: {best} trades pieces, and trades usually favour the side that is ahead.",
      "insight.endgame.king": "In endgames the king is usually an active piece: {best} brings it toward the centre.",
      "insight.endgame.passed": "{best} pushes the passed pawn on {sq}; passed pawns are usually worth advancing in endgames.",
      "insight.quiet_best.saves": "{best} is a quiet move that seems to rescue your {piece} on {sq}, which was in danger.",
      "insight.quiet_best.threat": "{best} is a quiet move that seems to threaten {targetDef} on {sq}.",
      "insight.quiet_best.generic": "{best} is quiet: no capture, no check. Improving a piece can beat a forcing move.",
      "insight.time_trouble": "You used almost all of the clock. Under the time pressure, scan checks, captures and threats first.",
      "insight.time_trouble.out": "Time ran out before you moved. Under the clock, scan checks, captures and threats first.",
      "insight.solid": "Not the engine's first choice, but {san} looks like a solid alternative, nearly as good.",
      "insight.close": "{san} looks close to {best}: the gap is small, about the size of the engine's margin of error.",
      "insight.no_clear_reason": "The engine prefers {best}. The reason may be positional or a longer tactic.",
      "insight.no_clear_reason.big": "{best} was clearly better. Before moving, check your opponent's captures, checks and threats.",

      "insight.tag.hangs_piece": "Hanging piece",
      "insight.tag.missed_capture": "Missed capture",
      "insight.tag.missed_mate": "Missed mate",
      "insight.tag.allows_mate": "Allows mate",
      "insight.tag.missed_check": "Missed check",
      "insight.tag.quiet_best": "Quiet best move",
      "insight.tag.sacrifice_best": "Sacrifice",
      "insight.tag.back_rank": "Back rank",
      "insight.tag.fork_available": "Fork",
      "insight.tag.pin_or_skewer": "Pin or skewer",
      "insight.tag.discovered_attack": "Discovered attack",
      "insight.tag.missed_promotion": "Missed promotion",
      "insight.tag.development": "Development",
      "insight.tag.king_safety": "King safety",
      "insight.tag.endgame_technique": "Endgame technique",
      "insight.tag.open_file": "Open file",
      "insight.tag.outpost": "Outpost",
      "insight.tag.trade_when_ahead": "Trade when ahead",
      "insight.tag.time_trouble": "Time trouble",
      "insight.tag.solid": "Solid alternative",
      "insight.tag.loses_material": "Loses material",
      "insight.tag.tactic_available": "Tactic available",
      "insight.tag.other": "Other reason",
    },
  };

  // Raw message parameters holding a piece letter; each is expanded to the
  // localized noun ("knight") and the noun with its article ("the knight",
  // key + "Def").
  const PIECE_KEYS = ["piece", "target", "slider", "pinned", "front", "behind"];
  // Raw parameters that hold a move in SAN. They stay English in `raw` and are
  // written with the person's piece letters (R = rey in Spanish notation) only
  // when a message is rendered: Ludus.chess.localizeSan follows the language and
  // the notation setting at that moment.
  const SAN_KEYS = ["best", "san", "reply"];

  // The tags that say what the best move WINS; an answer gets one of them (two
  // that say "it wins something" repeat each other or, worse, differ).
  const TACTIC_TAGS = ["missed_capture", "fork_available", "pin_or_skewer", "discovered_attack", "tactic_available"];
  // Any tag that already explains the best move tactically: "tactic_available" is only the fallback.
  const EXPLAINING_TAGS = TACTIC_TAGS.concat(["sacrifice_best", "missed_promotion", "back_rank", "missed_check"]);

  // Concept ids (js/concepts.js) that explain each tag.
  const CONCEPT_FOR_TAG = {
    hangs_piece: "hanging_piece",
    missed_capture: "hanging_piece",
    fork_available: "fork",
    discovered_attack: "discovered_attack",
    back_rank: "back_rank_mate",
    development: "development_center",
    king_safety: "king_safety",
    open_file: "open_file",
    outpost: "outpost",
    trade_when_ahead: "trade_when_ahead",
  };

  let stringsRegistered = false;
  function ensureStrings() {
    if (stringsRegistered) return;
    const i18n = root.Ludus && root.Ludus.i18n;
    if (i18n && typeof i18n.register === "function") {
      i18n.register(STRINGS);
      stringsRegistered = true;
    }
  }
  ensureStrings();

  function currentLang() {
    const i18n = root.Ludus && root.Ludus.i18n;
    try {
      const lang = i18n && typeof i18n.lang === "function" ? i18n.lang() : "es";
      return lang === "en" ? "en" : "es";
    } catch (error) {
      return "es";
    }
  }

  function interpolate(text, params) {
    return String(text).replace(/\{(\w+)\}/g, (_, key) => {
      const value = params && Object.prototype.hasOwnProperty.call(params, key) ? params[key] : undefined;
      return value == null ? "" : String(value);
    });
  }

  function translate(key, params, lang) {
    ensureStrings();
    const language = lang === "en" ? "en" : lang === "es" ? "es" : currentLang();
    const i18n = root.Ludus && root.Ludus.i18n;
    if (i18n && typeof i18n.t === "function") {
      const out = i18n.t(key, params, language);
      if (out !== key) return out;
    }
    const own = STRINGS[language][key] !== undefined ? STRINGS[language][key] : STRINGS.es[key];
    return own === undefined ? key : interpolate(own, params);
  }

  function localizeSan(san, lang) {
    const api = root.Ludus && root.Ludus.chess;
    try {
      return api && typeof api.localizeSan === "function" ? api.localizeSan(san, lang) : san;
    } catch (error) {
      return san;
    }
  }

  // Raw params keep language-neutral codes (piece letters, squares, English
  // SAN); this expands them to text for one language.
  function localizeParams(raw, lang) {
    const out = {};
    Object.keys(raw || {}).forEach((key) => {
      const value = raw[key];
      if (PIECE_KEYS.includes(key) && typeof value === "string") {
        out[key] = translate(`insight.piece.${value}`, null, lang);
        out[`${key}Def`] = translate(`insight.pieceDef.${value}`, null, lang);
      } else if (key === "targets" && Array.isArray(value)) {
        const parts = value.map((entry) => translate("insight.fmt.on", {
          piece: translate(`insight.pieceDef.${entry.p}`, null, lang),
          sq: entry.sq,
        }, lang));
        const joiner = translate("insight.fmt.and", null, lang);
        out.targets = parts.length <= 1 ? parts.join("")
          : `${parts.slice(0, -1).join(", ")}${joiner}${parts[parts.length - 1]}`;
      } else if (key === "why" && typeof value === "string") {
        out.why = translate(`insight.why.${value}`, null, lang);
      } else if (SAN_KEYS.includes(key) && typeof value === "string") {
        out[key] = localizeSan(value, lang);
      } else {
        out[key] = value;
      }
    });
    return out;
  }

  // ---------------------------------------------------------------------------
  // Board helpers (a board is the 64-cell array of Chess#board, index 0 = a8)
  // ---------------------------------------------------------------------------

  function chessApi() {
    const api = root.Ludus && root.Ludus.chess;
    if (!api || !api.Chess) throw new Error("insights: Ludus.chess is not loaded");
    return api;
  }

  const SEE_VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 100 };
  const MATERIAL_VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
  const KNIGHT_JUMPS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING_STEPS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const FILE_LETTERS = "abcdefgh";

  const sqOf = (index) => chessApi().Chess.indexToSquare(index);
  const colorOf = (piece) => (piece === piece.toUpperCase() ? "w" : "b");
  const other = (color) => (color === "w" ? "b" : "w");
  const typeOf = (piece) => piece.toUpperCase();
  const seeValue = (piece) => (piece ? SEE_VALUE[piece.toUpperCase()] || 0 : 0);
  const materialValue = (piece) => (piece ? MATERIAL_VALUE[piece.toUpperCase()] || 0 : 0);

  function slidingDirs(type) {
    if (type === "R") return ROOK_DIRS;
    if (type === "B") return BISHOP_DIRS;
    if (type === "Q") return ROOK_DIRS.concat(BISHOP_DIRS);
    return [];
  }

  // First occupied square from `from` along (dr, df), or -1.
  function firstPieceOnRay(cells, from, dr, df) {
    let r = (from >> 3) + dr;
    let f = (from & 7) + df;
    while (r >= 0 && r < 8 && f >= 0 && f < 8) {
      if (cells[r * 8 + f]) return r * 8 + f;
      r += dr;
      f += df;
    }
    return -1;
  }

  // Indices of `color`'s pieces that attack `to` (pseudo-legal: pins ignored;
  // sliders behind a removed piece show up once it is removed, which is what
  // the static exchange relies on).
  function attackersOf(cells, to, color) {
    const out = [];
    const row = to >> 3;
    const col = to & 7;
    const white = color === "w";
    const pawnRow = row + (white ? 1 : -1);
    const pawn = white ? "P" : "p";
    if (pawnRow >= 0 && pawnRow < 8) {
      if (col > 0 && cells[pawnRow * 8 + col - 1] === pawn) out.push(pawnRow * 8 + col - 1);
      if (col < 7 && cells[pawnRow * 8 + col + 1] === pawn) out.push(pawnRow * 8 + col + 1);
    }
    const knight = white ? "N" : "n";
    for (const [dr, df] of KNIGHT_JUMPS) {
      const r = row + dr;
      const f = col + df;
      if (r < 0 || r > 7 || f < 0 || f > 7) continue;
      if (cells[r * 8 + f] === knight) out.push(r * 8 + f);
    }
    const king = white ? "K" : "k";
    for (const [dr, df] of KING_STEPS) {
      const r = row + dr;
      const f = col + df;
      if (r < 0 || r > 7 || f < 0 || f > 7) continue;
      if (cells[r * 8 + f] === king) out.push(r * 8 + f);
    }
    const rook = white ? "R" : "r";
    const bishop = white ? "B" : "b";
    const queen = white ? "Q" : "q";
    for (const [dr, df] of ROOK_DIRS) {
      const idx = firstPieceOnRay(cells, to, dr, df);
      if (idx >= 0 && (cells[idx] === rook || cells[idx] === queen)) out.push(idx);
    }
    for (const [dr, df] of BISHOP_DIRS) {
      const idx = firstPieceOnRay(cells, to, dr, df);
      if (idx >= 0 && (cells[idx] === bishop || cells[idx] === queen)) out.push(idx);
    }
    return out;
  }

  // Squares attacked by the piece standing on `from` (first blocker included).
  function attackedSquares(cells, from) {
    const piece = cells[from];
    const out = [];
    if (!piece) return out;
    const row = from >> 3;
    const col = from & 7;
    const type = typeOf(piece);
    if (type === "P") {
      const dr = piece === "P" ? -1 : 1;
      [-1, 1].forEach((df) => {
        const r = row + dr;
        const f = col + df;
        if (r >= 0 && r < 8 && f >= 0 && f < 8) out.push(r * 8 + f);
      });
    } else if (type === "N" || type === "K") {
      (type === "N" ? KNIGHT_JUMPS : KING_STEPS).forEach(([dr, df]) => {
        const r = row + dr;
        const f = col + df;
        if (r >= 0 && r < 8 && f >= 0 && f < 8) out.push(r * 8 + f);
      });
    } else {
      slidingDirs(type).forEach(([dr, df]) => {
        const hit = firstPieceOnRay(cells, from, dr, df);
        let r = row + dr;
        let f = col + df;
        while (r >= 0 && r < 8 && f >= 0 && f < 8) {
          const idx = r * 8 + f;
          out.push(idx);
          if (idx === hit) break;
          r += dr;
          f += df;
        }
      });
    }
    return out;
  }

  function leastValuable(cells, list) {
    let best = -1;
    let bestValue = Infinity;
    for (const idx of list) {
      const value = seeValue(cells[idx]);
      if (value < bestValue) {
        best = idx;
        bestValue = value;
      }
    }
    return best;
  }

  // The subset of `list` (indices of `color` pieces attacking `to`) whose
  // capture on `to` is legal, i.e. does not leave that colour's king attacked.
  // `sim` is a Chess instance whose board is restored before returning.
  function legalAttackers(sim, to, color, list) {
    const cells = sim.board;
    const king = color === "w" ? "K" : "k";
    const kingIdx = cells.indexOf(king);
    const out = [];
    const target = cells[to];
    for (const from of list) {
      const piece = cells[from];
      cells[from] = null;
      cells[to] = piece;
      const kingSquare = piece === king ? to : kingIdx;
      const illegal = kingSquare >= 0 && sim.isSquareAttacked(kingSquare, color);
      cells[to] = target;
      cells[from] = piece;
      if (!illegal) out.push(from);
    }
    return out;
  }

  // Static exchange on `to`: `side` captures first (with `first`, or with its
  // least valuable attacker). Returns the net pawn units `side` wins when both
  // sides keep capturing only while it pays; negative when the initial capture
  // itself loses material; 0 when there is nothing to capture with.
  function seeSwap(cells, to, side, first) {
    const board = cells.slice();
    const target = board[to];
    if (!target || typeOf(target) === "K") return 0;
    let from = first === undefined || first === null ? leastValuable(board, attackersOf(board, to, side)) : first;
    if (from < 0 || !board[from]) return 0;
    const gain = [seeValue(target)];
    let attacker = board[from];
    let color = side;
    let depth = 0;
    for (;;) {
      depth += 1;
      gain[depth] = seeValue(attacker) - gain[depth - 1];
      board[from] = null; // removing the attacker reveals x-ray attackers
      color = other(color);
      from = leastValuable(board, attackersOf(board, to, color));
      if (from < 0) break;
      attacker = board[from];
    }
    while ((depth -= 1) > 0) gain[depth - 1] = -Math.max(-gain[depth - 1], gain[depth]);
    return gain[0];
  }

  // What the opponent of `color` would win by capturing on `sq` (a piece of
  // `color`), or null. See "Hanging" in the header comment.
  function threatOn(sim, sq, color) {
    const cells = sim.board;
    const piece = cells[sq];
    if (!piece || typeOf(piece) === "K") return null;
    const opponent = other(color);
    const attackers = legalAttackers(sim, sq, opponent, attackersOf(cells, sq, opponent));
    if (!attackers.length) return null;
    const first = leastValuable(cells, attackers);
    const loss = seeSwap(cells, sq, opponent, first);
    if (loss <= 0) return null;
    const defenders = attackersOf(cells, sq, color).length;
    let why = "outnumbered";
    if (defenders === 0) why = "free";
    else if (seeValue(cells[first]) < seeValue(piece)) why = "cheaper";
    return { idx: sq, sq: sqOf(sq), piece: typeOf(piece), loss, why, by: typeOf(cells[first]), firstIdx: first };
  }

  // After the opponent starts the winning exchange on `threat.idx`, can
  // `color` (the owner of the threatened piece) win at least as much somewhere
  // else with a capture of its own (a counter-attack, or the opponent leaving a
  // bigger piece hanging)? Then the exchange is not a clean loss and we stay
  // silent. Only the first capture is simulated; recaptures on the same square
  // are already part of the static exchange, so that square is ignored.
  function hasCounterCapture(sim, threat, color) {
    const scratch = sim.clone();
    const cells = scratch.board;
    cells[threat.idx] = cells[threat.firstIdx];
    cells[threat.firstIdx] = null;
    const opponent = other(color);
    for (let i = 0; i < 64; i += 1) {
      const piece = cells[i];
      if (i === threat.idx || !piece || colorOf(piece) !== opponent) continue;
      const counter = threatOn(scratch, i, opponent);
      if (counter && counter.loss >= threat.loss) return true;
    }
    return false;
  }

  // A capture that only nets one pawn unit is a real loss for a pawn but not
  // for a piece (a knight "hanging" for one pawn is really a pawn threat via an
  // exchange), so pieces must lose at least two units to count as hanging.
  function hangingList(sim, color) {
    const out = [];
    for (let i = 0; i < 64; i += 1) {
      const piece = sim.board[i];
      if (!piece || colorOf(piece) !== color) continue;
      const threat = threatOn(sim, i, color);
      if (threat && (threat.piece === "P" || threat.loss >= 2) && !hasCounterCapture(sim, threat, color)) out.push(threat);
    }
    return out;
  }

  // How safe is the piece `mover` just put on `to`? `safe` means the opponent
  // has no legal capture there, or every capture loses material for them (an
  // even trade is NOT safe: it would simply remove the piece).
  function destSafety(sim, to, mover) {
    const cells = sim.board;
    const opponent = other(mover);
    const attackers = legalAttackers(sim, to, opponent, attackersOf(cells, to, opponent));
    if (!attackers.length) return { attackers: 0, see: null, safe: true };
    const value = seeSwap(cells, to, opponent, leastValuable(cells, attackers));
    return { attackers: attackers.length, see: value, safe: value < 0 };
  }

  // ---------------------------------------------------------------------------
  // Evidence: material settled along an engine line
  // ---------------------------------------------------------------------------

  const QS_MATE = -99; // value for the side to move when it is checkmated inside the quiescence search
  const MATE_DELTA = 50; // a settled change beyond this is a checkmate, not material

  function balanceFor(cells, color) {
    let total = 0;
    for (let i = 0; i < 64; i += 1) {
      const piece = cells[i];
      if (piece) total += colorOf(piece) === color ? materialValue(piece) : -materialValue(piece);
    }
    return total;
  }

  // Captures and promotions of the side to move (pseudo-legal), richest victim first.
  function forcingMoves(pos) {
    const out = [];
    for (let i = 0; i < 64; i += 1) {
      const piece = pos.board[i];
      if (!piece || colorOf(piece) !== pos.turn) continue;
      for (const move of pos.generatePieceMoves(i, piece)) {
        if (move.capture || move.enPassant || move.promotion) out.push(move);
      }
    }
    out.sort((a, b) => (materialValue(pos.board[b.to]) - materialValue(pos.board[a.to]))
      || (materialValue(a.piece) - materialValue(b.piece)));
    return out;
  }

  // Material the side to move can secure with captures alone, over LEGAL moves:
  // it may stand pat unless it is in check, and then every evasion is tried.
  let qsNodes = 0;
  function quiesce(pos, alpha, beta, depth) {
    const color = pos.turn;
    const inCheck = pos.inCheck(color);
    const stand = balanceFor(pos.board, color);
    // A runaway capture tree (a position full of hanging pieces) settles at the
    // material on the board rather than freeze the page.
    if (depth <= 0 || (qsNodes += 1) > QS_NODE_LIMIT) return stand;
    let moves;
    let best;
    if (inCheck) {
      moves = pos.generateMoves();
      if (!moves.length) return QS_MATE;
      best = -999;
    } else {
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
      moves = forcingMoves(pos);
      best = stand;
    }
    for (const move of moves) {
      const next = pos.clone();
      next.makeMove(move);
      if (!inCheck && next.inCheck(color)) continue; // pseudo-legal: leaves the own king attacked
      const score = -quiesce(next, -beta, -alpha, depth - 1);
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }

  // `color`'s material after `pos` is left to the captures that are hanging.
  function settledFor(pos, color) {
    const value = quiesce(pos, -999, 999, QS_DEPTH);
    return pos.turn === color ? value : -value;
  }

  // Plays `pv` (UCI moves from `chess`) and returns what the mover has won (+)
  // or lost (-) against the start after each ply, settled as above:
  //   { deltas, plies, end, min, mate, matedSelf }
  // A checkmate anywhere on the line sets `mate` (of the opponent) or
  // `matedSelf` and stops the trace; material numbers are clamped to +-50.
  function traceLine(chess, pv, maxPlies) {
    qsNodes = 0;
    const mover = chess.turn;
    const base = balanceFor(chess.board, mover);
    const limit = Math.min(Array.isArray(pv) ? pv.length : 0, maxPlies || TRACE_PLIES);
    const deltas = [];
    let mate = false;
    let matedSelf = false;
    let pos = chess;
    for (let i = 0; i < limit; i += 1) {
      const move = findLegalMove(pos.generateMoves(), pv[i]);
      if (!move) break;
      pos = pos.clone();
      pos.makeMove(move);
      const delta = settledFor(pos, mover) - base;
      if (delta >= MATE_DELTA) {
        mate = true;
        deltas.push(MATE_DELTA);
        break;
      }
      if (delta <= -MATE_DELTA) {
        matedSelf = true;
        deltas.push(-MATE_DELTA);
        break;
      }
      deltas.push(delta);
    }
    return {
      deltas,
      plies: deltas.length,
      end: deltas.length ? deltas[deltas.length - 1] : 0,
      min: deltas.length ? Math.min(...deltas) : 0,
      mate,
      matedSelf,
    };
  }

  // The engine's line for `uci` (the first move must match): { pv, score } or
  // null (score is the engine's score for the mover, a number or null).
  function lineForMove(lines, uci) {
    if (!Array.isArray(lines) || !uci) return null;
    for (const line of lines) {
      const pv = line && Array.isArray(line.pv) ? line.pv.filter((move) => typeof move === "string") : null;
      const first = line && typeof line.uci === "string" ? line.uci : pv && pv[0];
      if (pv && pv.length && first === uci && pv[0] === uci) return { pv, score: lineScore(line) };
    }
    return null;
  }


  // What the line of a described move shows. Without a line of its own the
  // move is followed by its settled reply only (`deep` false).
  function evidenceOf(desc) {
    return memo(desc, "evidence", () => {
      const pv = desc.pv && desc.pv[0] === desc.uci ? desc.pv : [desc.uci];
      const trace = traceLine(desc.root, pv, desc.traceLimit || TRACE_PLIES);
      trace.deep = trace.plies >= 3;
      return trace;
    });
  }

  // Does the line back "this move wins about `need` pawn units"?
  function winsMaterial(desc, need, allowShallow) {
    const evidence = evidenceOf(desc);
    if (evidence.mate) return true;
    return (evidence.deep || allowShallow === true) && evidence.end >= need;
  }

  // ---------------------------------------------------------------------------
  // Static position features
  // ---------------------------------------------------------------------------

  // The game phase ("Phase" in the header comment): material of both sides
  // (62 at the start), pieces left, queens and, for "opening", the move number.
  // `input` is a FEN, a Chess instance or the 64 cells of a board; a board with
  // no move number (`fullmove` undefined) can still be an opening on material alone.
  // Anything unusable is "middlegame", the phase that changes nothing downstream.
  function gamePhase(input, fullmove) {
    let cells = null;
    let move = Number.isFinite(fullmove) ? fullmove : NaN;
    try {
      if (typeof input === "string") {
        const chess = new (chessApi().Chess)(normalizeFen(input));
        cells = chess.board;
        if (!Number.isFinite(move)) move = chess.fullmove;
      } else if (input && Array.isArray(input.board)) {
        cells = input.board;
        if (!Number.isFinite(move)) move = Number(input.fullmove);
      } else if (Array.isArray(input) && input.length === 64) {
        cells = input;
      }
    } catch (error) {
      cells = null;
    }
    if (!cells) return "middlegame";
    let nonPawn = 0;
    let queens = 0;
    let pieces = 0;
    for (const piece of cells) {
      if (!piece) continue;
      const type = typeOf(piece);
      if (type === "P" || type === "K") continue;
      pieces += 1;
      nonPawn += MATERIAL_VALUE[type];
      if (type === "Q") queens += 1;
    }
    if (nonPawn <= 16 || pieces <= 4 || (queens === 0 && nonPawn <= 26)) return "endgame";
    if (nonPawn >= 50 && (!Number.isFinite(move) || move <= 10)) return "opening";
    return "middlegame";
  }

  function nonPawnMaterial(cells) {
    let total = 0;
    let queens = 0;
    for (const piece of cells) {
      if (!piece) continue;
      const type = typeOf(piece);
      if (type === "Q") queens += 1;
      if (type !== "P" && type !== "K") total += MATERIAL_VALUE[type];
    }
    return { total, queens };
  }

  function materialOf(cells) {
    const out = { w: 0, b: 0 };
    for (const piece of cells) {
      if (piece) out[colorOf(piece)] += materialValue(piece);
    }
    return { w: out.w, b: out.b, diff: out.w - out.b };
  }

  // Pawns with no enemy pawn ahead on their own or the two adjacent files.
  function passedPawnIndices(cells, color) {
    const pawn = color === "w" ? "P" : "p";
    const enemy = color === "w" ? "p" : "P";
    const dir = color === "w" ? -1 : 1;
    const out = [];
    for (let i = 0; i < 64; i += 1) {
      if (cells[i] !== pawn) continue;
      const row = i >> 3;
      const col = i & 7;
      let passed = true;
      for (let r = row + dir; r >= 0 && r < 8 && passed; r += dir) {
        for (let f = Math.max(0, col - 1); f <= Math.min(7, col + 1); f += 1) {
          if (cells[r * 8 + f] === enemy) {
            passed = false;
            break;
          }
        }
      }
      if (passed) out.push(i);
    }
    return out;
  }

  // Pawn shelter of `color`'s king: how many of the king's file and the two
  // adjacent files hold an own pawn within two ranks in front of the king, and
  // how many of those files are open (no pawn at all) or half open (only an
  // enemy pawn).
  function kingShelter(cells, color) {
    const king = color === "w" ? "K" : "k";
    const idx = cells.indexOf(king);
    if (idx < 0) return null;
    const pawn = color === "w" ? "P" : "p";
    const enemyPawn = color === "w" ? "p" : "P";
    const dir = color === "w" ? -1 : 1;
    const row = idx >> 3;
    const col = idx & 7;
    let shield = 0;
    let open = 0;
    let half = 0;
    for (let f = Math.max(0, col - 1); f <= Math.min(7, col + 1); f += 1) {
      let ownOnFile = false;
      let enemyOnFile = false;
      for (let r = 0; r < 8; r += 1) {
        if (cells[r * 8 + f] === pawn) ownOnFile = true;
        if (cells[r * 8 + f] === enemyPawn) enemyOnFile = true;
      }
      for (let step = 1; step <= 2; step += 1) {
        const r = row + dir * step;
        if (r >= 0 && r < 8 && cells[r * 8 + f] === pawn) {
          shield += 1;
          break;
        }
      }
      if (!ownOnFile && !enemyOnFile) open += 1;
      else if (!ownOnFile) half += 1;
    }
    return {
      idx,
      sq: sqOf(idx),
      shield,
      openFiles: open,
      halfOpenFiles: half,
      onBackRank: row === (color === "w" ? 7 : 0),
      nearHome: Math.abs(row - (color === "w" ? 7 : 0)) <= 1,
    };
  }

  // King on its back rank whose forward squares are all filled by its own
  // pieces (no "luft"), and with at least one side square where a rook or
  // queen check along the rank could land. A king walled in by its own pieces
  // on both sides (the starting position) cannot be checked along the rank.
  function backRankWeak(cells, color) {
    const king = color === "w" ? "K" : "k";
    const idx = cells.indexOf(king);
    if (idx < 0) return false;
    const row = idx >> 3;
    const col = idx & 7;
    if (row !== (color === "w" ? 7 : 0)) return false;
    const forward = color === "w" ? row - 1 : row + 1;
    for (let f = Math.max(0, col - 1); f <= Math.min(7, col + 1); f += 1) {
      const cell = cells[forward * 8 + f];
      if (!cell || colorOf(cell) !== color) return false;
    }
    for (const side of [-1, 1]) {
      const f = col + side;
      if (f < 0 || f > 7) continue;
      const cell = cells[row * 8 + f];
      if (!cell || colorOf(cell) !== color) return true;
    }
    return false;
  }

  // Rank number seen from `color`'s side: 1 = its own back rank.
  function relativeRank(color, idx) {
    return color === "w" ? 8 - (idx >> 3) : (idx >> 3) + 1;
  }

  function centerDistance(idx) {
    const row = idx >> 3;
    const col = idx & 7;
    return Math.max(Math.min(Math.abs(row - 3), Math.abs(row - 4)), Math.min(Math.abs(col - 3), Math.abs(col - 4)));
  }

  function fileIsOpen(cells, col) {
    for (let r = 0; r < 8; r += 1) {
      const cell = cells[r * 8 + col];
      if (cell && typeOf(cell) === "P") return false;
    }
    return true;
  }

  const HOME_MINORS = { w: [57, 58, 61, 62], b: [1, 2, 5, 6] };

  function undevelopedMinors(cells, color) {
    return HOME_MINORS[color].filter((idx) => {
      const cell = cells[idx];
      return cell && colorOf(cell) === color && (typeOf(cell) === "N" || typeOf(cell) === "B");
    }).length;
  }

  function normalizeFen(fen) {
    const text = String(fen || "").trim();
    const parts = text.split(/\s+/);
    if (parts.length < 4) throw new Error("invalid-fen");
    const rows = parts[0].split("/");
    if (rows.length !== 8) throw new Error("invalid-fen");
    let whiteKings = 0;
    let blackKings = 0;
    for (const ch of parts[0]) {
      if (ch === "K") whiteKings += 1;
      if (ch === "k") blackKings += 1;
    }
    if (whiteKings !== 1 || blackKings !== 1) throw new Error("invalid-fen");
    if (parts[1] !== "w" && parts[1] !== "b") throw new Error("invalid-fen");
    while (parts.length < 6) parts.push(parts.length === 4 ? "0" : "1");
    return parts.slice(0, 6).join(" ");
  }

  function threatSquares(list) {
    return list.map((entry) => entry.sq);
  }

  // Pure function of the FEN. Returns null when the FEN is not usable.
  function positionFeatures(fen) {
    let chess;
    try {
      const { Chess } = chessApi();
      chess = new Chess(normalizeFen(fen));
    } catch (error) {
      return null;
    }
    return buildPositionFeatures(chess, chess.generateMoves());
  }

  function buildPositionFeatures(chess, legal) {
    const cells = chess.board;
    const mate = legal.length === 0 && chess.inCheck(chess.turn);
    const hangingDetail = { w: hangingList(chess, "w"), b: hangingList(chess, "b") };
    const shelterW = kingShelter(cells, "w");
    const shelterB = kingShelter(cells, "b");
    return {
      fen: chess.fen(),
      turn: chess.turn,
      fullmove: chess.fullmove,
      phase: gamePhase(chess),
      material: materialOf(cells),
      legalCount: legal.length,
      inCheck: chess.inCheck(chess.turn),
      isCheckmate: mate,
      isStalemate: legal.length === 0 && !mate,
      hanging: { w: threatSquares(hangingDetail.w), b: threatSquares(hangingDetail.b) },
      hangingDetail: {
        w: hangingDetail.w.map(({ sq, piece, loss, why }) => ({ sq, piece, loss, why })),
        b: hangingDetail.b.map(({ sq, piece, loss, why }) => ({ sq, piece, loss, why })),
      },
      passedPawns: {
        w: passedPawnIndices(cells, "w").map(sqOf),
        b: passedPawnIndices(cells, "b").map(sqOf),
      },
      backRankWeak: { w: backRankWeak(cells, "w"), b: backRankWeak(cells, "b") },
      kings: {
        w: shelterW && { sq: shelterW.sq, shield: shelterW.shield, openFiles: shelterW.openFiles, halfOpenFiles: shelterW.halfOpenFiles },
        b: shelterB && { sq: shelterB.sq, shield: shelterB.shield, openFiles: shelterB.openFiles, halfOpenFiles: shelterB.halfOpenFiles },
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Moves
  // ---------------------------------------------------------------------------

  function findLegalMove(legal, uci) {
    if (typeof uci !== "string" || !/^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(uci)) return null;
    const { Chess } = chessApi();
    const from = Chess.squareToIndex(uci.slice(0, 2));
    const to = Chess.squareToIndex(uci.slice(2, 4));
    const promo = uci[4] ? uci[4].toLowerCase() : "";
    return legal.find((move) => move.from === from && move.to === to
      && (!promo || (move.promotion && move.promotion.toLowerCase() === promo))) || null;
  }

  // Everything cheap we know about a move, plus the position after it. `pv` is
  // the engine's line for the move (UCI, starting with it) when there is one.
  function describeMove(chess, move, pv, score) {
    const { moveToSan, moveToUci } = chessApi();
    const after = chess.clone();
    after.makeMove(move);
    const color = chess.turn;
    const san = moveToSan(chess, move);
    // En passant takes the pawn that stands beside the destination square.
    const capturedIdx = move.enPassant ? move.to + (color === "w" ? 8 : -8) : move.to;
    const capturedPiece = move.enPassant ? (color === "w" ? "p" : "P") : chess.board[move.to];
    const captured = capturedPiece ? typeOf(capturedPiece) : null;
    const promotion = move.promotion ? typeOf(move.promotion) : null;
    const gain = (captured ? MATERIAL_VALUE[captured] : 0) + (promotion ? MATERIAL_VALUE[promotion] - 1 : 0);
    return {
      move,
      uci: moveToUci(move),
      san,
      color,
      piece: typeOf(move.piece),
      from: sqOf(move.from),
      to: sqOf(move.to),
      fromIdx: move.from,
      toIdx: move.to,
      capture: Boolean(captured),
      captured,
      capturedIdx,
      promotion,
      onTo: promotion || typeOf(move.piece), // the piece that stands on the destination afterwards
      castle: move.castle || null,
      check: /[+#]$/.test(san),
      mate: /#$/.test(san),
      gain,
      after,
      root: chess,
      pv: Array.isArray(pv) && pv.length ? pv : null,
      lineScore: Number.isFinite(score) ? score : null,
      cache: {},
    };
  }

  function memo(desc, key, compute) {
    if (!(key in desc.cache)) desc.cache[key] = compute();
    return desc.cache[key];
  }

  // Opponent's best exchange on the destination square, or null.
  function destThreat(desc) {
    return memo(desc, "destThreat", () => (desc.piece === "K" ? null : threatOn(desc.after, desc.toIdx, desc.color)));
  }

  function destLoss(desc) {
    const threat = destThreat(desc);
    return threat ? threat.loss : 0;
  }

  // Every piece of the mover that the opponent could win after the move.
  function threatsAfter(desc) {
    return memo(desc, "threatsAfter", () => hangingList(desc.after, desc.color));
  }

  function moveNet(desc) {
    return desc.gain - destLoss(desc);
  }

  // The settled material of the move's line sits at least SACRIFICE_MIN below
  // the start on two plies in a row (or at the end of the line) within the first
  // SACRIFICE_PLIES plies, counted from the opponent's actual reply on: the first
  // ply alone assumes the opponent takes what is on offer (a poisoned pawn is
  // bait, not a sacrifice) and a single ply is usually a capture in the middle of
  // an exchange. A side that is simply losing and giving things up is not
  // sacrificing: the line must not leave the mover worse than about -1.00 (only
  // checked when the engine's score is known). With no line, only the settled
  // reply to the move itself can be looked at.
  function isSacrifice(desc) {
    return memo(desc, "sacrifice", () => {
      if (desc.mate || desc.piece === "K") return false;
      const evidence = evidenceOf(desc);
      if (evidence.matedSelf) return false;
      if (Number.isFinite(desc.lineScore) && desc.lineScore < -SACRIFICE_MIN_SCORE) return false;
      if (evidence.plies < 2) return evidence.deltas.length > 0 && evidence.deltas[0] <= -SACRIFICE_MIN;
      // The dip has to start within the first four plies: a material loss that only
      // appears on the last plies of the line is the search's horizon (audit: 3 of the
      // 7 false claims started at ply 5 or later, against 10 of 81 true ones).
      const last = Math.min(evidence.plies, SACRIFICE_PLIES, SACRIFICE_LATEST_PLY) - 1;
      for (let i = 1; i <= last; i += 1) {
        // (a dip that ends in checkmate is the classic sacrifice for a mating attack)
        if (evidence.deltas[i] <= -SACRIFICE_MIN
          && (i === evidence.plies - 1 || evidence.deltas[i + 1] <= -SACRIFICE_MIN || (evidence.mate && i === evidence.plies - 2))) return true;
      }
      return false;
    });
  }

  function isQuiet(desc) {
    return !desc.capture && !desc.check && !desc.promotion && !desc.castle;
  }

  function findMateInOne(pos) {
    const moves = pos.generateMoves();
    for (const move of moves) {
      const next = pos.clone();
      next.makeMove(move);
      if (next.inCheck(next.turn) && next.generateMoves().length === 0) return move;
    }
    return null;
  }

  // The moved piece attacks two or more valuable enemy targets at once (or a
  // target and the king) and cannot simply be taken or traded off.
  function forkOf(desc) {
    return memo(desc, "fork", () => {
      if (desc.mate || desc.piece === "K") return null;
      const sim = desc.after;
      const cells = sim.board;
      const mover = desc.color;
      const opponent = other(mover);
      const targets = [];
      for (const idx of attackedSquares(cells, desc.toIdx)) {
        const piece = cells[idx];
        if (!piece || colorOf(piece) !== opponent) continue;
        const type = typeOf(piece);
        if (type === "K") {
          targets.push({ idx, p: "K", sq: sqOf(idx), value: 100 });
          continue;
        }
        if (type === "P") continue;
        if (!legalAttackers(sim, idx, mover, [desc.toIdx]).length) continue;
        if (seeSwap(cells, idx, mover, desc.toIdx) >= 1) {
          targets.push({ idx, p: type, sq: sqOf(idx), value: seeValue(piece) });
        }
      }
      if (targets.length < 2) return null;
      if (!destSafety(sim, desc.toIdx, mover).safe) return null;
      targets.sort((a, b) => b.value - a.value);
      return { piece: desc.onTo, sq: desc.to, targets: targets.slice(0, 3).map(({ p, sq }) => ({ p, sq })) };
    });
  }

  // A bishop, rook or queen that pins a piece to the king, or skewers the king
  // or queen against a piece behind it that would then be won.
  function pinOf(desc) {
    return memo(desc, "pin", () => {
      if (desc.mate || !["B", "R", "Q"].includes(desc.onTo)) return null;
      const sim = desc.after;
      const cells = sim.board;
      const mover = desc.color;
      const opponent = other(mover);
      if (!destSafety(sim, desc.toIdx, mover).safe) return null;
      for (const [dr, df] of slidingDirs(desc.onTo)) {
        const front = firstPieceOnRay(cells, desc.toIdx, dr, df);
        if (front < 0 || colorOf(cells[front]) !== opponent) continue;
        const behind = firstPieceOnRay(cells, front, dr, df);
        if (behind < 0 || colorOf(cells[behind]) !== opponent) continue;
        const frontType = typeOf(cells[front]);
        const behindType = typeOf(cells[behind]);
        if (behindType === "K" && frontType !== "K" && frontType !== "P") {
          return { kind: "pin", slider: desc.onTo, front: { p: frontType, sq: sqOf(front) }, behind: { p: "K", sq: sqOf(behind) } };
        }
        if ((frontType === "K" || (frontType === "Q" && behindType !== "Q")) && behindType !== "K" && behindType !== "P"
          && seeValue(cells[behind]) >= 3 && seeValue(cells[front]) > seeValue(cells[behind])) {
          const scratch = cells.slice();
          scratch[front] = null;
          if (seeSwap(scratch, behind, mover, desc.toIdx) >= 1) {
            return { kind: "skewer", slider: desc.onTo, front: { p: frontType, sq: sqOf(front) }, behind: { p: behindType, sq: sqOf(behind) } };
          }
        }
      }
      return null;
    });
  }

  // Moving this piece opens the line of one of the mover's sliders onto the
  // enemy king (discovered check) or onto a piece that would be won.
  function discoveredOf(chess, desc) {
    return memo(desc, "discovered", () => {
      if (desc.mate) return null;
      const before = chess.board;
      const cells = desc.after.board;
      const mover = desc.color;
      const opponent = other(mover);
      for (let s = 0; s < 64; s += 1) {
        const piece = cells[s];
        if (s === desc.toIdx || !piece || colorOf(piece) !== mover || before[s] !== piece) continue;
        const type = typeOf(piece);
        if (type !== "R" && type !== "B" && type !== "Q") continue;
        for (const [dr, df] of slidingDirs(type)) {
          if (firstPieceOnRay(before, s, dr, df) !== desc.fromIdx) continue;
          const hit = firstPieceOnRay(cells, s, dr, df);
          if (hit < 0 || colorOf(cells[hit]) !== opponent) continue;
          const targetType = typeOf(cells[hit]);
          if (targetType === "K" || ((targetType === "Q" || targetType === "R") && seeSwap(cells, hit, mover, s) >= 2)) {
            return { slider: type, sq: sqOf(s), target: targetType, sq2: sqOf(hit) };
          }
        }
      }
      return null;
    });
  }

  // ---------------------------------------------------------------------------
  // Verdict: was the user's move about as good as the best one?
  // ---------------------------------------------------------------------------

  const MATE_BASE = 100000;
  const MATE_STEP = 1000;
  const MATE_MAX = 50;
  const MATE_THRESHOLD = MATE_BASE - MATE_MAX * MATE_STEP;

  function scoreNumber(score) {
    if (typeof score === "number" && Number.isFinite(score)) return score;
    if (score && typeof score === "object" && Number.isFinite(score.value)) {
      if (score.type === "mate") {
        const magnitude = MATE_BASE - Math.min(Math.abs(score.value), MATE_MAX) * MATE_STEP;
        return score.value > 0 ? magnitude : -magnitude;
      }
      return score.value;
    }
    return null;
  }

  // -> { forMover, n } when the score encodes a forced mate, else null.
  function mateOfScore(score) {
    const value = scoreNumber(score);
    if (value === null || Math.abs(value) < MATE_THRESHOLD) return null;
    return { forMover: value > 0, n: Math.max(1, Math.round((MATE_BASE - Math.abs(value)) / MATE_STEP)) };
  }

  function winPercent(score) {
    const scoring = root.Ludus && root.Ludus.Scoring;
    if (scoring && typeof scoring.winPercent === "function") {
      const value = scoring.winPercent(score);
      if (Number.isFinite(value)) return value;
    }
    const cp = Math.max(-1000, Math.min(1000, Math.abs(score) >= MATE_THRESHOLD ? Math.sign(score) * 1000 : score));
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  }

  function lineScore(line) {
    return line ? scoreNumber(line.score) : null;
  }

  function judge(input) {
    const { userUci, bestUci, assessment, lines } = input;
    if (!userUci) return { verdict: "nomove", lossPct: null };
    if (userUci === bestUci) return { verdict: "same", lossPct: 0 };
    // A forced mate that was missed or allowed is never "nearly as good", however
    // little win% the numbers say it cost (the win% curve saturates at +10 pawns).
    if (assessment && (assessment.reason === "missed_mate" || assessment.reason === "allows_mate")) {
      return { verdict: "worse", lossPct: Number.isFinite(assessment.winLossPct) ? assessment.winLossPct : null };
    }
    if (assessment && assessment.isBest === true) return { verdict: "equivalent", lossPct: assessment.winLossPct };
    let lossPct = null;
    if (assessment && Number.isFinite(assessment.winLossPct)) {
      lossPct = assessment.winLossPct;
    } else if (Array.isArray(lines) && lines.length) {
      const bestScore = lineScore(lines[0]);
      const userLine = lines.find((line) => line && Array.isArray(line.pv) && line.pv[0] === userUci);
      const userScore = lineScore(userLine);
      if (bestScore !== null && userScore !== null) lossPct = Math.max(0, winPercent(bestScore) - winPercent(userScore));
    }
    if (lossPct !== null && lossPct < EQUIVALENT_LOSS_PCT) return { verdict: "equivalent", lossPct };
    if (lossPct !== null && lossPct < CLOSE_LOSS_PCT) return { verdict: "close", lossPct };
    return { verdict: "worse", lossPct };
  }

  // ---------------------------------------------------------------------------
  // analyzeChoice
  // ---------------------------------------------------------------------------

  function pushCandidate(list, tag, key, raw, options) {
    list.push({
      tag,
      key,
      raw: raw || {},
      priority: PRIORITY[tag] || 99,
      late: Boolean(options && (options.late || options.filler)),
      filler: Boolean(options && options.filler),
      concept: (options && options.concept) || CONCEPT_FOR_TAG[tag] || null,
    });
  }

  // Which explanation to give when the opponent's capture would win material:
  // the piece the user hung.
  function hangingClass(before, worst, user) {
    if (worst.idx === user.toIdx) return "moved";
    const wasThreatened = before.some((entry) => entry.idx === worst.idx && entry.loss >= 1);
    if (wasThreatened && worst.idx !== user.fromIdx) return "left";
    return "exposed";
  }

  function analyzeUserSide(ctx, list) {
    const { chess, user, best, mover } = ctx;
    // Allowing an immediate checkmate: exact.
    const reply = findMateInOne(user.after);
    if (reply) {
      const { moveToSan } = chessApi();
      const replySan = moveToSan(user.after, reply);
      pushCandidate(list, "allows_mate", "insight.allows_mate.san", { san: user.san, reply: replySan }, { concept: null });
      const isBackRankMate = ["R", "Q"].includes(typeOf(reply.piece))
        && (reply.to >> 3) === (mover === "w" ? 7 : 0)
        && backRankWeak(user.after.board, mover);
      if (isBackRankMate) pushCandidate(list, "back_rank", "insight.back_rank.own", {});
    } else if (ctx.allowsMateHint) {
      // A length is only claimed when it is reliable (see MAX_ALLOWED_MATE_CLAIM).
      const mate = ctx.allowsMateHint;
      if (mate.n && mate.n <= MAX_ALLOWED_MATE_CLAIM) {
        pushCandidate(list, "allows_mate", "insight.allows_mate.forced", { san: user.san, n: mate.n }, { concept: null });
      } else {
        pushCandidate(list, "allows_mate", "insight.allows_mate.generic", { san: user.san }, { concept: null });
      }
    }

    // Leaving material en prise, unless the best move gives up as much.
    const afterThreats = threatsAfter(user);
    if (afterThreats.length) {
      let worst = afterThreats[0];
      for (const entry of afterThreats) {
        if (entry.loss > worst.loss || (entry.loss === worst.loss && entry.idx === user.toIdx)) worst = entry;
      }
      const userNet = worst.loss - user.gain;
      let bestNet = 0;
      if (best) {
        const bestThreats = threatsAfter(best);
        const bestWorst = bestThreats.reduce((max, entry) => Math.max(max, entry.loss), 0);
        bestNet = bestWorst - best.gain;
      }
      if (userNet >= 1 && userNet > bestNet) {
        const kind = hangingClass(ctx.beforeThreats, worst, user);
        // When the engine's own line after the user's move is known and keeps the
        // material (a counter-capture the exchange count cannot see), the piece
        // is not really lost and we say nothing about it.
        const userLine = user.pv ? evidenceOf(user) : null;
        const refuted = Boolean(userLine && userLine.deep && !userLine.matedSelf && userLine.end > -1);
        // A pawn that was already under attack before the move is too minor to
        // blame on a move that may have dealt with bigger things.
        if (!refuted && !(kind === "left" && worst.piece === "P")) {
          pushCandidate(list, "hangs_piece", `insight.hangs_piece.${kind}`, {
            san: user.san, piece: worst.piece, sq: worst.sq, why: worst.why,
          });
        }
      }
    }

    // Material lost further down the engine's line (a fork, a pin, a combination
    // that a one-capture exchange count cannot see). Needs the engine's line.
    if (!list.some((entry) => entry.tag === "hangs_piece") && user.pv) {
      const line = evidenceOf(user);
      // The loss has to be in sight within four plies and still there at the end:
      // a dip that only shows on the last plies of the line is the search's horizon.
      const firstLoss = line.deltas.findIndex((value) => value <= -LOSS_CLAIM);
      if (line.deep && !line.matedSelf && line.end <= -LOSS_CLAIM && firstLoss >= 0 && firstLoss <= 3) {
        pushCandidate(list, "loses_material", "insight.loses_material", { san: user.san, n: Math.round(-line.end) });
      }
    }

    // King safety: the move thins out the pawn shelter of a castled-looking king.
    if (ctx.phase !== "endgame" && (user.piece === "P" || user.piece === "K") && !user.castle && !user.capture) {
      const before = kingShelter(chess.board, mover);
      const after = kingShelter(user.after.board, mover);
      const opponentHeavy = nonPawnMaterial(chess.board);
      const bestKeeps = !best || !(best.piece === "P" || best.piece === "K") || (() => {
        const bestAfter = kingShelter(best.after.board, mover);
        return bestAfter && before && bestAfter.shield >= before.shield;
      })();
      const castledLooking = before && (before.idx & 7) !== 3 && (before.idx & 7) !== 4 && (before.idx & 7) !== 5;
      if (before && after && castledLooking && before.nearHome && after.shield < before.shield && after.shield <= 2
        && opponentHeavy.total >= 12 && bestKeeps
        && (user.piece === "P" || (before.onBackRank && (!after.nearHome || after.shield === 0)))) {
        if (user.piece === "P") pushCandidate(list, "king_safety", "insight.king_safety.pawn", { sq: user.from });
        else pushCandidate(list, "king_safety", "insight.king_safety.king", { san: user.san });
      }
    }
  }

  function analyzeBestSide(ctx, list) {
    const { chess, best, user, mover, phase } = ctx;
    const cells = chess.board;
    const opponent = other(mover);
    const userNet = user ? moveNet(user) : 0;

    if (best.mate) {
      pushCandidate(list, "missed_mate", "insight.missed_mate.san", { best: best.san }, { concept: null });
    } else if (ctx.missedMateHint) {
      // "In N or fewer": the engine may have found a shorter mate later, never a longer one.
      const mate = ctx.missedMateHint;
      if (mate.n && mate.n <= MAX_MISSED_MATE_CLAIM) {
        pushCandidate(list, "missed_mate", "insight.missed_mate.forced", { best: best.san, n: mate.n }, { concept: null });
      } else {
        pushCandidate(list, "missed_mate", "insight.missed_mate.generic", { best: best.san }, { concept: null });
      }
    }

    // Back rank: a rook or queen check against a king boxed in on its back rank.
    if (best.check && ["R", "Q"].includes(best.piece) && (best.toIdx >> 3) === (opponent === "w" ? 7 : 0)
      && backRankWeak(cells, opponent)) {
      pushCandidate(list, "back_rank", "insight.back_rank.exploit", { best: best.san });
    }

    // Winning material by capture. The exchange count on the square says it
    // wins; the material settled after the capture, and along the engine's line,
    // has to say so too (a capture that walks into a fork, or that the engine
    // gives back a move later, is not "winning material").
    if (best.capture && !best.mate) {
      const net = moveNet(best);
      if (net >= 1 && net > userNet) {
        const targetIdx = best.capturedIdx;
        const evidence = evidenceOf(best);
        const need = best.captured === "P" ? 1 : 2;
        if (evidence.plies >= 1 && (evidence.mate || (evidence.deltas[0] >= need && evidence.end >= 1))) {
          const defenders = attackersOf(cells, targetIdx, opponent).length;
          let key = "insight.missed_capture.win";
          if (defenders === 0) key = "insight.missed_capture.free";
          else if (seeValue(cells[best.fromIdx]) < seeValue(cells[targetIdx])) key = "insight.missed_capture.cheaper";
          pushCandidate(list, "missed_capture", key, { best: best.san, target: best.captured, sq: sqOf(targetIdx) });
        }
      }
    }

    if (!best.mate) {
      // A fork, pin, skewer or discovered attack is only named when the engine's
      // line really wins material (or mates) after it: the geometry alone is
      // often just a check or a harmless attack.
      const pays = winsMaterial(best, WIN_CLAIM);
      const bestFork = pays ? forkOf(best) : null;
      if (bestFork && !(user && forkOf(user))) {
        pushCandidate(list, "fork_available", "insight.fork", { best: best.san, piece: bestFork.piece, targets: bestFork.targets });
      }
      const bestPin = pays ? pinOf(best) : null;
      if (bestPin && !(user && pinOf(user))) {
        if (bestPin.kind === "pin") {
          pushCandidate(list, "pin_or_skewer", "insight.pin", { best: best.san, pinned: bestPin.front.p, sq: bestPin.front.sq }, { concept: "pin" });
        } else {
          pushCandidate(list, "pin_or_skewer", "insight.skewer", {
            best: best.san, front: bestPin.front.p, behind: bestPin.behind.p, sq: bestPin.behind.sq,
          }, { concept: "skewer" });
        }
      }
      const bestDisc = pays ? discoveredOf(chess, best) : null;
      if (bestDisc && !(user && discoveredOf(chess, user))) {
        pushCandidate(list, "discovered_attack", "insight.discovered", {
          best: best.san, slider: bestDisc.slider, sq: bestDisc.sq, target: bestDisc.target, sq2: bestDisc.sq2,
        });
      }
      if (isSacrifice(best) && !(user && isSacrifice(user))) {
        pushCandidate(list, "sacrifice_best", "insight.sacrifice_best", { best: best.san }, { concept: null });
      }
      if (best.promotion && !(user && user.promotion)) {
        pushCandidate(list, "missed_promotion", "insight.missed_promotion", { best: best.san }, { concept: null });
      }
      // A check is only worth a habit tip when it leads somewhere (mate or a
      // material win along the line); a learner who captured or promoted is not
      // told to look before "quiet" moves.
      if (best.check && !(user && user.check) && pays) {
        if (user && !isQuiet(user)) {
          pushCandidate(list, "missed_check", "insight.missed_check.after", { best: best.san, san: user.san }, { concept: null });
        } else {
          pushCandidate(list, "missed_check", "insight.missed_check", { best: best.san }, { concept: null });
        }
      }
    }

    // Development and castling early on.
    const fullmove = Number.isFinite(chess.fullmove) ? chess.fullmove : 1;
    const bestDevelops = (best.piece === "N" || best.piece === "B") && HOME_MINORS[mover].includes(best.fromIdx);
    if (phase === "opening" && fullmove <= 15 && (best.castle || bestDevelops) && !best.capture && !best.check) {
      const userDevelops = user && (user.castle || ((user.piece === "N" || user.piece === "B") && HOME_MINORS[mover].includes(user.fromIdx)));
      const userCentralPawn = user && user.piece === "P" && "cde".includes(user.from[0]);
      const userForcing = user && (user.capture || user.check);
      if (user && !userDevelops && !userCentralPawn && !userForcing) {
        const undeveloped = undevelopedMinors(cells, mover);
        if (undeveloped >= 1 || best.castle) {
          const twice = (user.piece === "N" || user.piece === "B") && !HOME_MINORS[mover].includes(user.fromIdx) && undeveloped >= 1;
          if (twice) pushCandidate(list, "development", "insight.development.twice", { san: user.san, best: best.san });
          else if (best.castle) pushCandidate(list, "development", "insight.development.castle", { best: best.san });
          else pushCandidate(list, "development", "insight.development.first", { best: best.san });
        }
      }
    } else if (phase !== "opening" && phase !== "endgame" && best.castle && user && !user.castle) {
      pushCandidate(list, "king_safety", "insight.king_safety.castle", { best: best.san });
    }

    // Rook to an open file, or along one to the seventh rank.
    if (best.piece === "R" && !best.capture && fileIsOpen(cells, best.toIdx & 7) && destSafety(best.after, best.toIdx, mover).safe) {
      const file = FILE_LETTERS[best.toIdx & 7];
      const onto = (desc) => desc && desc.piece === "R" && fileIsOpen(cells, desc.toIdx & 7) && !fileIsOpen(cells, desc.fromIdx & 7);
      const seventh = (desc) => desc && desc.piece === "R" && (desc.fromIdx & 7) === (desc.toIdx & 7)
        && fileIsOpen(cells, desc.toIdx & 7) && relativeRank(mover, desc.toIdx) === 7;
      if (onto(best) && !onto(user)) {
        pushCandidate(list, "open_file", "insight.open_file", { best: best.san, file });
      } else if (seventh(best) && !seventh(user)) {
        pushCandidate(list, "open_file", "insight.open_file.seventh", { best: best.san, file });
      }
    }

    // Knight to an outpost: supported by a pawn, no enemy pawn can ever attack it.
    if (best.piece === "N" && !best.mate && isOutpost(best)) {
      if (!(user && user.piece === "N" && isOutpost(user))) {
        pushCandidate(list, "outpost", "insight.outpost", { best: best.san, sq: best.to });
      }
    }

    // Simplifying when ahead.
    if (best.capture && best.captured !== "P" && seeValue(best.captured) >= 3 && moveNet(best) === 0 && destLoss(best) > 0
      && !(user && user.capture)) {
      const mat = materialOf(cells);
      const ahead = mover === "w" ? mat.diff : -mat.diff;
      if (ahead >= 2 && phase !== "opening") {
        pushCandidate(list, "trade_when_ahead", "insight.trade_when_ahead", { best: best.san });
      }
    }

    // Endgames: king activity and passed pawns.
    if (phase === "endgame") {
      const np = nonPawnMaterial(cells);
      if (best.piece === "K" && !best.capture && !best.check && np.queens === 0 && np.total <= 20
        && centerDistance(best.toIdx) < centerDistance(best.fromIdx)
        && !(user && user.piece === "K" && centerDistance(user.toIdx) < centerDistance(user.fromIdx))) {
        pushCandidate(list, "endgame_technique", "insight.endgame.king", { best: best.san });
      } else if (best.piece === "P" && !best.capture && !best.promotion && passedPawnIndices(cells, mover).includes(best.fromIdx)
        && destSafety(best.after, best.toIdx, mover).safe && !(user && user.fromIdx === best.fromIdx)) {
        pushCandidate(list, "endgame_technique", "insight.endgame.passed", { best: best.san, sq: best.from }, { concept: "passed_pawn" });
      }
    }

    // A quiet best move: say why when we can. Without a reason the tag is only
    // given when the user went for a forcing move (capture or check) instead.
    if (isQuiet(best) && !best.mate) {
      const afterBest = threatsAfter(best);
      const rescued = ctx.beforeThreats.filter((entry) => {
        const now = entry.idx === best.fromIdx ? best.toIdx : entry.idx;
        return !afterBest.some((later) => later.idx === now);
      });
      if (rescued.length) {
        const top = rescued.reduce((a, b) => (b.loss > a.loss ? b : a));
        pushCandidate(list, "quiet_best", "insight.quiet_best.saves", { best: best.san, piece: top.piece, sq: top.sq }, { concept: "hanging_piece" });
      } else {
        const before = ctx.enemyThreatsBefore;
        const fresh = hangingList(best.after, opponent).filter((entry) => entry.loss >= 2
          && !before.some((old) => old.idx === entry.idx));
        if (fresh.length) {
          const top = fresh.reduce((a, b) => (b.loss > a.loss ? b : a));
          pushCandidate(list, "quiet_best", "insight.quiet_best.threat", { best: best.san, target: top.piece, sq: top.sq });
        } else if (user && (user.capture || user.check)) {
          pushCandidate(list, "quiet_best", "insight.quiet_best.generic", { best: best.san }, { filler: true });
        }
      }
    }

    // None of the above named what the engine's line wins after the best move:
    // say how much (mates and checks have their own messages). Only from a line
    // of three or more plies, and not when the user's own line wins as much.
    if (!best.mate && !list.some((entry) => EXPLAINING_TAGS.includes(entry.tag))) {
      const line = evidenceOf(best);
      const userLine = user && user.pv ? evidenceOf(user) : null;
      let run = 0;
      let sustained = 0;
      line.deltas.forEach((value) => {
        run = value >= LOSS_CLAIM ? run + 1 : 0;
        sustained = Math.max(sustained, run);
      });
      // A line that "wins" a piece in a position the engine does not call better for the mover
      // (+0.50) is compensated material, not a win: 7 of the 11 unconfirmed claims had a score
      // at or below +0.20.
      const evaluated = !Number.isFinite(best.lineScore) || best.lineScore >= TACTIC_MIN_SCORE;
      if (!line.mate && line.deep && line.end >= TACTIC_CLAIM && sustained >= 2 && evaluated
        && !(userLine && userLine.deep && userLine.end >= line.end - 1)) {
        pushCandidate(list, "tactic_available", "insight.tactic_available", { best: best.san, n: Math.round(line.end) }, { concept: null });
      }
    }
  }

  function isOutpost(desc) {
    return memo(desc, "outpost", () => {
      const cells = desc.after.board;
      const color = desc.color;
      const idx = desc.toIdx;
      const row = idx >> 3;
      const col = idx & 7;
      const relRank = color === "w" ? 8 - row : row + 1;
      if (relRank < 4 || relRank > 6 || col < 2 || col > 5) return false; // rim knights are not outposts
      const ownPawn = color === "w" ? "P" : "p";
      const enemyPawn = color === "w" ? "p" : "P";
      const supportRow = row + (color === "w" ? 1 : -1);
      let supported = false;
      for (const df of [-1, 1]) {
        const f = col + df;
        if (f >= 0 && f <= 7 && supportRow >= 0 && supportRow < 8 && cells[supportRow * 8 + f] === ownPawn) supported = true;
      }
      if (!supported) return false;
      // Enemy pawns that could still reach a square attacking `idx` (they move
      // towards their promotion rank, i.e. towards our side of the board).
      for (const df of [-1, 1]) {
        const f = col + df;
        if (f < 0 || f > 7) continue;
        for (let r = 0; r < 8; r += 1) {
          if (cells[r * 8 + f] !== enemyPawn) continue;
          const behindEnemy = color === "w" ? r < row : r > row;
          if (behindEnemy) return false;
        }
      }
      return destSafety(desc.after, idx, color).safe;
    });
  }

  // Drop tags that would only repeat or dilute a stronger explanation, and keep
  // a single tactical explanation of the best move: two that say "it wins
  // something" are the same advice twice and, when they differ, the learner
  // cannot tell which to trust.
  function suppress(list) {
    const has = (tag) => list.some((entry) => entry.tag === tag);
    const drop = (...tags) => {
      for (let i = list.length - 1; i >= 0; i -= 1) if (tags.includes(list[i].tag)) list.splice(i, 1);
    };
    const mateFact = has("missed_mate") || has("allows_mate");
    if (list.some((entry) => entry.key === "insight.missed_mate.san")) {
      drop("missed_capture", "fork_available", "pin_or_skewer", "discovered_attack", "sacrifice_best", "missed_promotion",
        "missed_check", "tactic_available", "king_safety", "development", "open_file", "outpost", "trade_when_ahead",
        "endgame_technique", "quiet_best");
    } else if (has("missed_mate")) {
      // The mate already says everything the checks, captures and sacrifices on
      // the way to it could: they are steps of the same line.
      drop("missed_capture", "fork_available", "pin_or_skewer", "discovered_attack", "sacrifice_best", "missed_promotion",
        "missed_check", "tactic_available", "king_safety", "development", "open_file", "outpost", "trade_when_ahead",
        "endgame_technique", "quiet_best");
    }
    if (mateFact) drop("quiet_best", "loses_material");
    if (has("hangs_piece")) {
      drop("loses_material");
      // "Your piece was already in danger" goes well with "this move rescues it";
      // any other quiet-move remark next to a hanging piece is just noise.
      const rescue = list.some((entry) => entry.key === "insight.hangs_piece.left")
        && list.some((entry) => entry.key === "insight.quiet_best.saves");
      if (!rescue) drop("quiet_best");
    }
    if (has("missed_capture") || has("fork_available") || has("pin_or_skewer") || has("discovered_attack") || has("back_rank")) {
      drop("missed_check");
    }
    if (["missed_capture", "fork_available", "pin_or_skewer", "discovered_attack", "sacrifice_best", "development", "open_file",
      "outpost", "trade_when_ahead", "endgame_technique", "missed_promotion", "back_rank", "tactic_available"].some(has)
      || list.some((entry) => entry.key === "insight.king_safety.castle")) {
      drop("quiet_best");
    }
    if (has("missed_capture")) drop("trade_when_ahead");
    // One tactical explanation of the best move, the most concrete first (the
    // list is sorted by priority before this runs).
    let seenTactic = false;
    for (let i = 0; i < list.length; i += 1) {
      if (!TACTIC_TAGS.includes(list[i].tag)) continue;
      if (seenTactic) {
        list.splice(i, 1);
        i -= 1;
      }
      seenTactic = true;
    }
  }

  function emptyResult(extra) {
    return Object.assign({
      tags: [], phase: "middlegame", messages: [], conceptIds: [], verdict: "unknown", features: { best: null, user: null },
    }, extra || {});
  }

  function moveToUciSafe(move) {
    return chessApi().moveToUci(move);
  }

  function publicMove(desc, eager) {
    if (!desc) return null;
    const out = {
      uci: desc.uci, san: desc.san, piece: desc.piece, from: desc.from, to: desc.to,
      capture: desc.capture, captured: desc.captured, promotion: desc.promotion, castle: desc.castle,
      check: desc.check, mate: desc.mate, quiet: isQuiet(desc) && !desc.mate,
      gain: desc.gain, loss: destLoss(desc),
    };
    // `sacrifice` replays the engine's line (the costly part of an analysis):
    // a perfect or equivalent answer never needs it, so it is worked out when
    // somebody reads it. A plain value wherever the result is copied.
    if (eager) {
      out.sacrifice = isSacrifice(desc);
    } else {
      Object.defineProperty(out, "sacrifice", { enumerable: true, configurable: true, get: () => isSacrifice(desc) });
    }
    return out;
  }

  function analyze(input) {
    const { Chess } = chessApi();
    const chess = new Chess(normalizeFen(input.fen));
    const mover = chess.turn;
    const legal = chess.generateMoves();
    const phase = gamePhase(chess);
    const assessment = input.assessment && typeof input.assessment === "object" ? input.assessment : null;

    const bestMove = findLegalMove(legal, input.bestUci);
    const userMove = input.userUci ? findLegalMove(legal, input.userUci) : null;
    // The engine's lines for both moves, when we were given them: what every
    // claim about material is checked against (see "Evidence" above).
    const lineOf = (move, extraPv, extraScore) => {
      if (!move) return { pv: null, score: null };
      const uci = moveToUciSafe(move);
      if (Array.isArray(extraPv) && extraPv[0] === uci) {
        return { pv: extraPv.filter((entry) => typeof entry === "string"), score: scoreNumber(extraScore) };
      }
      return lineForMove(input.lines, uci) || { pv: null, score: null };
    };
    const bestLine = lineOf(bestMove, null, null);
    const userLine = lineOf(userMove, input.userPv, assessment ? assessment.userScore : null);
    const best = bestMove ? describeMove(chess, bestMove, bestLine.pv, bestLine.score) : null;
    const user = userMove ? describeMove(chess, userMove, userLine.pv, userLine.score) : null;

    const judged = judge({
      userUci: user ? user.uci : null,
      bestUci: best ? best.uci : null,
      assessment,
      lines: input.lines,
    });
    const verdict = judged.verdict;
    const result = emptyResult({ phase, verdict, features: { best: publicMove(best), user: publicMove(user) } });
    const list = [];

    const timing = input.timing && typeof input.timing === "object" ? input.timing : {};
    const timedOut = timing.timedOut === true || (assessment && assessment.reason === "timeout");
    const slow = Number.isFinite(timing.timeSpentMs) && Number.isFinite(timing.limitMs) && timing.limitMs > 0
      && timing.timeSpentMs >= 0.85 * timing.limitMs;

    if (verdict === "equivalent" || verdict === "close") {
      if (assessment && assessment.mateExtraMoves > 0 && best) {
        // Both moves mate (or win by force); the user's is just slower.
        pushCandidate(list, "solid", "insight.slower_mate", { best: best.san }, { late: true, concept: null });
      } else if (verdict === "close" && best) {
        // "The gap is small" is only said up to 2.5 win% (beyond it a second search put
        // the move clearly further behind one time in three): above that, nothing.
        if (!(judged.lossPct >= CLOSE_MESSAGE_MAX_PCT)) {
          pushCandidate(list, "solid", "insight.close", { san: user.san, best: best.san }, { late: true, concept: null });
        }
      } else {
        pushCandidate(list, "solid", "insight.solid", { san: user.san }, { late: true, concept: null });
      }
    } else if (verdict === "worse" || verdict === "nomove") {
      const ctx = {
        chess, mover, phase, best, user,
        beforeThreats: hangingList(chess, mover),
        enemyThreatsBefore: hangingList(chess, other(mover)),
        allowsMateHint: null,
        missedMateHint: null,
      };
      // Engine facts about forced mates that a mate-in-one search cannot see.
      if (assessment) {
        const userMate = mateOfScore(assessment.userScore);
        const bestMate = mateOfScore(assessment.bestScore);
        if (assessment.reason === "allows_mate" || (userMate && !userMate.forMover)) {
          ctx.allowsMateHint = { n: userMate && !userMate.forMover ? userMate.n : 0 };
        }
        if (assessment.reason === "missed_mate" || (bestMate && bestMate.forMover && !(userMate && userMate.forMover))) {
          ctx.missedMateHint = { n: bestMate && bestMate.forMover ? bestMate.n : 0 };
        }
      }
      if (user && verdict === "worse") analyzeUserSide(ctx, list);
      if (best) analyzeBestSide(ctx, list);
      if (timedOut) {
        pushCandidate(list, "time_trouble", user ? "insight.time_trouble" : "insight.time_trouble.out", {}, { late: true, concept: null });
      } else if ((slow || input.timeTrouble === true) && user) {
        pushCandidate(list, "time_trouble", "insight.time_trouble", {}, { late: true, concept: null });
      }
      list.sort((a, b) => a.priority - b.priority);
      suppress(list);
    }

    list.sort((a, b) => a.priority - b.priority);
    const lang = currentLang();

    const tags = [];
    list.forEach((entry) => {
      if (!tags.includes(entry.tag)) tags.push(entry.tag);
    });

    // Strong explanations first; a filler (a generic remark) only when there is
    // nothing better; then the "late" notes (time, solid). One message per tag,
    // three at most (two when a forced mate explains the answer).
    const chosen = [];
    const usedTags = new Set();
    const strongLimit = list.some((entry) => entry.tag === "missed_mate" || entry.tag === "allows_mate") ? MAX_MATE_MESSAGES : MAX_MESSAGES;
    const take = (entry, limit) => {
      if (usedTags.has(entry.tag) || chosen.length >= limit) return;
      usedTags.add(entry.tag);
      chosen.push(entry);
    };
    list.filter((entry) => !entry.late).forEach((entry) => take(entry, strongLimit));
    if (!chosen.length) list.filter((entry) => entry.filler).forEach((entry) => take(entry, strongLimit));
    if (!chosen.length && (verdict === "worse" || verdict === "nomove") && best) {
      // We do not know why. Say so; and when the move was clearly worse do not
      // reassure with "it may only be positional".
      const big = verdict === "worse" && Number.isFinite(judged.lossPct) && judged.lossPct >= BIG_LOSS_PCT;
      chosen.push({ tag: null, key: big ? "insight.no_clear_reason.big" : "insight.no_clear_reason", raw: { best: best.san }, concept: null });
    }
    list.filter((entry) => entry.late && !entry.filler).forEach((entry) => take(entry, MAX_MESSAGES));
    result.tags = tags;
    result.messages = chosen.map((entry) => ({
      key: entry.key,
      params: localizeParams(entry.raw, lang),
      tag: entry.tag,
      raw: entry.raw,
    }));
    const concepts = [];
    list.forEach((entry) => {
      if (entry.concept && !concepts.includes(entry.concept) && concepts.length < 3) concepts.push(entry.concept);
    });
    result.conceptIds = concepts;
    return result;
  }

  // Public: never throws. On any internal failure the result is empty and
  // carries an `error` string (callers may ignore it).
  function analyzeChoice(input) {
    try {
      return analyze(input && typeof input === "object" ? input : {});
    } catch (error) {
      return emptyResult({ error: String(error && error.message ? error.message : error) });
    }
  }

  // Public: facts about a single move in a position (or null when the FEN or
  // the move is unusable). `sacrifice` is the flag the scoring layer needs for
  // the "brilliant" quality.
  // `options.lines` (the engine's lines of the position) or `options.pv` (the
  // line of this move) make `sacrifice` follow the engine line; without them it
  // only looks at the settled reply to the move.
  function moveFeatures(fen, uci, options) {
    try {
      const { Chess } = chessApi();
      const chess = new Chess(normalizeFen(fen));
      const move = findLegalMove(chess.generateMoves(), uci);
      if (!move) return null;
      const opts = options && typeof options === "object" ? options : {};
      const moveUci = moveToUciSafe(move);
      const given = Array.isArray(opts.pv) && opts.pv[0] === moveUci
        ? { pv: opts.pv.filter((entry) => typeof entry === "string"), score: scoreNumber(opts.score) }
        : lineForMove(opts.lines, moveUci);
      return publicMove(describeMove(chess, move, given ? given.pv : null, given ? given.score : null), true);
    } catch (error) {
      return null;
    }
  }

  function tagLabelKey(tag) {
    return TAGS.includes(tag) ? `insight.tag.${tag}` : "insight.tag.other";
  }

  // Renders one message ({key, params, raw}) as plain text in `lang` (defaults
  // to the current language). Uses the language-neutral `raw` parameters when
  // present so a message built in one language can be shown in the other.
  function renderMessage(message, lang) {
    if (!message || typeof message.key !== "string") return "";
    const params = message.raw ? localizeParams(message.raw, lang || currentLang()) : message.params;
    return translate(message.key, params, lang);
  }

  function renderMessages(messages, lang) {
    return (Array.isArray(messages) ? messages : []).map((message) => renderMessage(message, lang)).filter(Boolean);
  }

  return {
    TAGS,
    MAX_MESSAGES,
    positionFeatures,
    moveFeatures,
    analyzeChoice,
    tagLabelKey,
    renderMessage,
    renderMessages,
    gamePhase,
    // Exposed for tests and for other modules that need the same board logic.
    internals: { seeSwap, attackersOf, backRankWeak, passedPawnIndices, traceLine, settledFor, STRINGS, localizeParams },
  };
});
