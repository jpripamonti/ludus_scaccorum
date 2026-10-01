// The coach (Ludus.Coach): everything the play screen shows about a position and an
// answer, drawn as DOM from plain data. app.js (the game core) owns the state, the
// board and the flow; this module owns the words and the pictures.
// Contract: docs/ARCHITECTURE.md sections 19 to 21; styles in css/coach.css (.co-).
//
//   Pure helpers (no DOM, tested in scripts/tests/coach.test.js)
//     qualityInfo(code, lang)                 { code, glyph, label, tone, hit }
//     verdictKey(context, answer) / verdictText(context, answer, lang)
//     winBars(context, answer)                { best, user, master, loss } in win% (0..100)
//     safeGameUrl(site)                       https URL on lichess.org / chess.com found in a Site tag, or null
//     positionModel({ position, session, lang })   what the "thinking" card shows
//     dotsModel({ total, current, rounds, mode })  the progress dots of the header
//     rewardModel(rewards, now, lang)         XP, level progress, notebook card line, achievements
//     summaryModel({ record, rounds, rewards, mode, lang })  the numbers of the closing summary
//     shareText(summary, lang)                plain text for navigator.share / the clipboard
//
//   DOM (every node is built with Ludus.util.h, never from strings; each returns quietly
//   when there is no DOM)
//     renderThinking(el, model)   position context while the person thinks
//     renderTurn(el, { text, name })  the duel's "Ana plays White" line: the name is shortened, the side to move never
//     renderEvaluating(el)        skeleton while the answer is scored (same size as the result)
//     renderRound(el, context, api)   solo result: gauge, verdict, comparison, insights, lines, rewards, fact
//     renderDuel(el, context, api)    duel result: two player cards, then the shared analysis
//     renderSummary(el, summary, api) closing summary: hero gauge, breakdown, positions, rewards, actions
//     renderDots(el, model)       the row of progress dots
//     openConcept(id)             modal with a lesson and a mini board
//
//   `api` (all optional): { onStep(lineIndex, ply), onOpenRound(index), onShare(), lang, pv:{line,ply} }.
//   `context` is STATE.resultView.context of app.js (docs section 19).
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Coach = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  // ---------- Environment (resolved at call time, so load order never matters) ----------

  const L = () => root.Ludus || {};
  const getDoc = () => {
    try {
      return root.document || null;
    } catch (error) {
      return null;
    }
  };

  function h(tag, attrs, ...children) {
    const util = L().util;
    if (!util || typeof util.h !== "function") throw new Error("Ludus.Coach needs Ludus.util.h (load js/ludus.js first)");
    return util.h(tag, attrs, ...children);
  }

  function t(key, params, lang) {
    const i18n = L().i18n;
    return i18n && typeof i18n.t === "function" ? i18n.t(key, params, lang) : String(key);
  }

  function currentLang() {
    const i18n = L().i18n;
    try {
      return i18n && typeof i18n.lang === "function" ? i18n.lang() : "es";
    } catch (error) {
      return "es";
    }
  }

  const langOf = (value) => (value === "en" ? "en" : value === "es" ? "es" : currentLang() === "en" ? "en" : "es");

  function ui() {
    return L().ui || {};
  }

  function icon(name, size, className) {
    const kit = ui();
    if (typeof kit.icon !== "function") return null;
    try {
      return kit.icon(name, { size: size || 18, className });
    } catch (error) {
      return null;
    }
  }

  function clear(el) {
    if (el) el.textContent = "";
  }

  function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  const cls = (...names) => names.filter(Boolean).join(" ");

  // A move as the person reads it: the SAN that is stored and compared is English (Nf3); Spanish piece letters (Cf3) are only for
  // the eye, when the language or the notation setting (Ludus.chess.localizeSan, js/chess.js) says so. Never applied twice.
  function showSan(value, lang) {
    if (typeof value !== "string" || !value) return value;
    const chess = L().chess;
    try {
      return chess && typeof chess.localizeSan === "function" ? chess.localizeSan(value, lang) : value;
    } catch (error) {
      return value;
    }
  }

  // The same move for a screen reader (aria-label, a tooltip, a live region): in words in the page language ("caballo a f3", "knight to f3"),
  // because "Cf3" is read letter by letter. It takes the stored English SAN too, never the localized one (Ludus.chess.spokenSan, js/chess.js).
  function speakSan(value, lang) {
    if (typeof value !== "string" || !value) return value;
    const chess = L().chess;
    try {
      return chess && typeof chess.spokenSan === "function" ? chess.spokenSan(value, langOf(lang)) : showSan(value, lang);
    } catch (error) {
      return showSan(value, lang);
    }
  }

  // ---------- Text ----------

  const TEXT = {
    es: {
      "coach.you": "Tu jugada",
      "coach.best": "La mejor",
      "coach.masterMove": "Jugó {name}",
      "coach.gameMove": "Tu partida",
      "coach.section.compare": "Tu jugada contra la mejor",
      "coach.section.why": "Por qué",
      "coach.section.lines": "Líneas del motor",
      "coach.section.concepts": "Para repasar",
      "coach.section.progress": "Tu progreso",
      "coach.section.fact": "¿Sabías que…?",
      "coach.section.note": "Nota del maestro",
      "coach.section.duel": "Los dos jugadores",
      "coach.winChance": "Chances de ganar",
      "coach.winChance.aria": "Chances de ganar: {pct}%",
      "coach.eval": "Evaluación {eval}",
      "coach.loss": "Tu chance de ganar baja de {best}% a {user}% ({pts} menos que con la mejor).",
      "coach.unit.points.one": "{n} punto",
      "coach.unit.points.other": "{n} puntos",
      "coach.unit.pp.one": "{n} punto porcentual",
      "coach.unit.pp.other": "{n} puntos porcentuales",
      "coach.cmp.same": "Jugaste la mejor jugada.",
      "coach.cmp.equivalent": "Tan buena como la mejor: la diferencia es mínima.",
      "coach.cmp.master.rank": "La jugada de {name} era la opción {rank} del motor.",
      "coach.cmp.master.out": "La jugada de {name} no estaba entre las primeras opciones del motor.",
      "coach.cmp.game.rank": "La jugada de tu partida era la opción {rank} del motor.",
      "coach.cmp.game.out": "La jugada de tu partida no estaba entre las primeras opciones del motor.",
      "coach.help.toggle": "¿Cómo leer estos números?",
      "coach.help.winChance": "Chances de ganar: cuánta chance tiene de ganar quien mueve, según el motor. Es una estimación, no una probabilidad real.",
      "coach.help.eval": "El número con signo (como +0,35) es la ventaja en peones de quien mueve: positivo te favorece, negativo favorece al rival. M3 significa mate en 3.",
      "coach.help.engine": "Stockfish es el programa de ajedrez que juzga las jugadas. La profundidad es cuántas jugadas por delante calculó: más profundidad, más confianza.",
      "coach.theme.title": "Tema de la posición",
      "coach.gauge.label": "puntos",
      "coach.chip.hint": "Pista usada (-{pct}%)",
      "coach.chip.revealed": "Jugada revelada",
      "coach.chip.time": "{seconds} s",
      "coach.chip.timeOut": "Sin tiempo",
      "coach.chip.xp": "+{xp} XP",
      "coach.chip.backup": "Motor de respaldo: estimación",
      "coach.note.provisional": "Puntos estimados: esta jugada no se pudo medir a fondo.",
      "coach.note.fallback": "El motor fuerte todavía no estaba listo: esta ronda la evaluó el de respaldo, que analiza menos a fondo. Tomá los puntos como una estimación.",
      "coach.note.refining": "Refinando el análisis…",
      "coach.verdict.brilliant": "¡Brillante! Encontraste la mejor jugada y era un sacrificio: entregás material a cambio de algo mejor.",
      "coach.verdict.brilliantEquivalent": "¡Brillante! Tu jugada es tan buena como la mejor y es un sacrificio: entregás material a cambio de algo mejor.",
      "coach.verdict.great": "Gran jugada: las demás jugadas eran claramente peores, y la encontraste.",
      "coach.verdict.greatEquivalent": "Gran jugada: elegiste una tan buena como la mejor, y las demás eran claramente peores.",
      "coach.verdict.perfect": "Encontraste la mejor jugada.",
      "coach.verdict.equivalent": "Tan buena como la mejor: el motor lista {best} primero, pero la diferencia en chances de ganar es mínima.",
      "coach.verdict.masterSame": "Jugaste lo mismo que {master}: la mejor jugada.",
      "coach.verdict.masterSameEquivalent": "Jugaste lo mismo que {master}. El motor prefiere {best} por muy poco: las dos son igual de buenas.",
      "coach.verdict.very_good": "Muy cerca de la mejor: el motor prefiere {best}, pero la tuya casi no pierde nada.",
      "coach.verdict.good": "Buena jugada, aunque {best} era algo más fuerte.",
      "coach.verdict.interesting": "Imprecisa: cede un poco de terreno. {best} era mejor.",
      "coach.verdict.dubious": "Dudosa: cede parte de tu ventaja. Con {best} la posición estaba mejor.",
      "coach.verdict.dubiousNoEdge": "Dudosa: {best} era claramente mejor y tu jugada empeora la posición.",
      "coach.verdict.bad": "Un error: esta jugada empeora tu posición. {best} era el camino.",
      "coach.verdict.blunder": "Un error grave: te cuesta muchas chances de ganar. Mirá {best}.",
      "coach.verdict.allows_mate": "Esta jugada le permite un mate forzado al rival. Antes de mover, revisá sus jaques. Era mejor {best}.",
      "coach.verdict.missed_mate": "Había un mate forzado y no lo jugaste: {best}.",
      "coach.verdict.missedMateWinning": "Seguías ganando ({eval}), pero había un mate forzado: {best}. Un mate perdido cuesta puntos igual.",
      "coach.label.missedMate": "Mate perdido",
      "coach.verdict.timeout": "Se acabó el tiempo antes de que movieras. La mejor era {best}.",
      "coach.verdict.skip": "Salteaste esta posición. La mejor era {best}.",
      "coach.verdict.revealed": "Miraste la respuesta: 0 puntos esta vez, pero ya conocés la idea: {best}.",
      "coach.verdict.no_move": "No elegiste ninguna jugada. La mejor era {best}.",
      "coach.insight.perfect": "No hay nada para corregir: jugaste lo mismo que el motor.",
      "coach.insight.solid": "Tu jugada es una alternativa razonable: el motor la considera casi igual de buena.",
      "coach.insight.unknown": "El motor prefiere {best}, pero no encontramos un motivo lo bastante claro como para explicarlo sin dudas.",
      "coach.lines.caption": "{engine}, profundidad {depth}",
      "coach.lines.engine.stockfish": "Stockfish",
      "coach.lines.engine.local": "Motor de respaldo",
      "coach.lines.hint": "Tocá una línea para recorrerla en el tablero.",
      "coach.lines.you": "Tu jugada",
      "coach.lines.best": "Mejor",
      "coach.lines.master": "Maestro",
      "coach.lines.aria": "Línea {rank}: {san}, evaluación {eval}",
      "coach.step.label": "Recorrer la línea {rank}",
      "coach.step.first": "Ir al inicio de la línea",
      "coach.step.prev": "Jugada anterior",
      "coach.step.next": "Jugada siguiente",
      "coach.step.last": "Ir al final de la línea",
      "coach.step.pos": "Jugada {n} de {total}",
      "coach.step.start": "Posición inicial",
      "coach.step.tip": "Desde acá podés jugar tus propias jugadas en el tablero.",
      "coach.step.token": "Ir a la jugada {san}",
      "coach.concept.aria": "Ver el concepto: {title}",
      "coach.concept.close": "Entendido",
      "coach.concept.example": "Ejemplo: {title}",
      "coach.level.up": "¡Subiste de nivel!",
      "coach.level.next": "{xp} XP para el próximo nivel",
      "coach.level.max": "Nivel máximo alcanzado",
      "coach.card.created": "Guardada en tu cuaderno para repasarla {when}.",
      "coach.card.pass": "Repaso aprobado: la vas a volver a ver {when}.",
      "coach.card.fail": "Todavía cuesta: esta posición vuelve al principio y la repasás {when}.",
      "coach.card.cleared": "¡Dominada! Esta posición sale de tu repaso.",
      "coach.card.when.now": "ahora mismo",
      "coach.card.when.today": "hoy",
      "coach.card.when.tomorrow": "mañana",
      "coach.card.when.days": "en {n} días",
      "coach.achievement": "Logro desbloqueado",
      "coach.duel.winner": "Ronda para {name}",
      "coach.duel.tie": "Ronda empatada",
      "coach.duel.winnerTag": "Ganó la ronda",
      "coach.duel.noMove": "Sin jugada",
      "coach.think.goal": "Encontrá la mejor jugada. Cuanto más cerca esté de la del motor, más puntos.",
      "coach.think.eyebrow.classic": "Partida clásica",
      "coach.think.eyebrow.own": "Tu partida",
      "coach.think.eyebrow.review": "Repaso de errores",
      "coach.think.eyebrow.daily": "Desafío del día",
      "coach.think.master": "Te ponés en el lugar de {name}.",
      "coach.think.move": "Jugada {n}",
      "coach.think.hints": "Pistas: la pieza (-{p1}%), la casilla (-{p2}%) o la jugada entera (0 puntos).",
      "coach.think.duelTurn": "Turno de {name}",
      "coach.think.duelRule": "Los dos juegan la misma posición y sus jugadas se comparan al final de la ronda.",
      "coach.think.backup": "El motor fuerte todavía no está listo: por ahora evalúa el de respaldo, que analiza menos a fondo.",
      "coach.link.lichess": "Ver la partida en Lichess",
      "coach.link.chesscom": "Ver la partida en Chess.com",
      "coach.link.aria": "{label} (se abre en una pestaña nueva)",
      "coach.eval.title": "Evaluando tu jugada",
      "coach.eval.sub": "El motor compara tu jugada con la mejor.",
      "coach.sum.title": "Sesión completada",
      "coach.sum.titleDuel": "Duelo terminado",
      "coach.sum.accuracy": "Precisión media",
      "coach.sum.points": "Puntos",
      "coach.sum.of": "{points} / {max}",
      "coach.sum.time": "Duración",
      "coach.sum.positions": "Posiciones",
      "coach.sum.breakdown": "Cómo fueron tus jugadas",
      "coach.sum.breakdownAria": "Distribución de jugadas por calidad",
      "coach.sum.list": "Las posiciones de la sesión",
      "coach.sum.open": "Abrir el análisis de la posición {n}",
      "coach.sum.pos": "Posición {n}",
      "coach.sum.pts": "{points} pts",
      "coach.sum.rewards": "Lo que ganaste",
      "coach.sum.xp": "+{xp} XP",
      "coach.sum.achievements": "Logros nuevos",
      "coach.sum.cards.one": "{n} posición se sumó a tu cuaderno para repasarla.",
      "coach.sum.cards.other": "{n} posiciones se sumaron a tu cuaderno para repasarlas.",
      "coach.sum.noRewards": "Jugá con tu perfil para sumar experiencia y armar tu cuaderno de errores.",
      "coach.sum.playAgain": "Jugar otra vez",
      "coach.sum.rematch": "Revancha",
      "coach.sum.review": "Repasar mis errores ahora",
      "coach.sum.reviewPlayer": "Repasar errores de {name}",
      "coach.sum.share": "Compartir",
      "coach.sum.copied": "Resumen copiado al portapapeles.",
      "coach.sum.shareFailed": "No se pudo compartir. Copiá el resumen a mano.",
      "coach.sum.noMore": "No se encontraron más posiciones.",
      "coach.sum.winner": "Ganó {name}",
      "coach.sum.draw": "Empate",
      "coach.sum.duelAcc": "Precisión: {acc}%",
      "coach.sum.hits": "{hits} de {total} aciertos",
      "coach.sum.hits.one": "{hits} de 1 acierto",
      "coach.sum.tone.great": "Sesión sobresaliente",
      "coach.sum.tone.good": "Buena sesión",
      "coach.sum.tone.ok": "Sesión de aprendizaje",
      "coach.sum.tone.low": "Una sesión para aprender",
      "coach.share.title": "Ludus Scaccorum",
      "coach.share.head": "{title}: {points} / {max} puntos, {acc}% de precisión.",
      "coach.share.duel": "Duelo {a} contra {b}: {sa} - {sb}. {winner}",
      "coach.share.xp": "+{xp} XP",
      "coach.share.cta": "Entrená con partidas clásicas y tus propios errores:",
      "coach.dots.done": "Posición {n}: {quality}, {points}",
      "coach.dots.noMove": "Posición {n}: sin jugada, 0 puntos",
      "coach.dots.duel": "Posición {n}: {a} {pa}, {b} {pb}",
      "coach.dots.current": "Posición {n}: la que estás jugando",
      "coach.dots.todo": "Posición {n}: pendiente",
      "coach.dots.summary": "{done} de {total} posiciones jugadas",
      "coach.dots.summary.one": "{done} de 1 posición jugada",
    },
    en: {
      "coach.you": "Your move",
      "coach.best": "Best",
      "coach.masterMove": "{name} played",
      "coach.gameMove": "Your game",
      "coach.section.compare": "Your move vs the best move",
      "coach.section.why": "Why",
      "coach.section.lines": "Engine lines",
      "coach.section.concepts": "Worth a review",
      "coach.section.progress": "Your progress",
      "coach.section.fact": "Did you know?",
      "coach.section.note": "Note from the master",
      "coach.section.duel": "Both players",
      "coach.winChance": "Win chance",
      "coach.winChance.aria": "Win chance: {pct}%",
      "coach.eval": "Evaluation {eval}",
      "coach.loss": "Your win chance drops from {best}% to {user}% ({pts} less than with the best move).",
      "coach.unit.points.one": "{n} point",
      "coach.unit.points.other": "{n} points",
      "coach.unit.pp.one": "{n} percentage point",
      "coach.unit.pp.other": "{n} percentage points",
      "coach.cmp.same": "You played the best move.",
      "coach.cmp.equivalent": "As good as the best: the difference is tiny.",
      "coach.cmp.master.rank": "{name}'s move was the engine's {rank} choice.",
      "coach.cmp.master.out": "{name}'s move was not among the engine's top choices.",
      "coach.cmp.game.rank": "The move from your game was the engine's {rank} choice.",
      "coach.cmp.game.out": "The move from your game was not among the engine's top choices.",
      "coach.help.toggle": "How to read these numbers",
      "coach.help.winChance": "Win chance: how likely the side to move is to win, according to the engine. It is an estimate, not a real probability.",
      "coach.help.eval": "The signed number (like +0.35) is the advantage in pawns for the side to move: positive favors you, negative favors your opponent. M3 means mate in 3.",
      "coach.help.engine": "Stockfish is the chess program that judges the moves. Depth is how many moves ahead it looked: the deeper, the more reliable.",
      "coach.theme.title": "Theme of the position",
      "coach.gauge.label": "points",
      "coach.chip.hint": "Hint used (-{pct}%)",
      "coach.chip.revealed": "Move revealed",
      "coach.chip.time": "{seconds} s",
      "coach.chip.timeOut": "Out of time",
      "coach.chip.xp": "+{xp} XP",
      "coach.chip.backup": "Backup engine: estimate",
      "coach.note.provisional": "Estimated points: this move could not be measured in depth.",
      "coach.note.fallback": "The strong engine was not ready yet: this round was scored by the backup engine, which looks less deeply. Take the points as an estimate.",
      "coach.note.refining": "Refining the analysis…",
      "coach.verdict.brilliant": "Brilliant! You found the best move and it was a sacrifice: you give up material for something better.",
      "coach.verdict.brilliantEquivalent": "Brilliant! Your move is as good as the best one and it is a sacrifice: you give up material for something better.",
      "coach.verdict.great": "Great move: every other move was clearly worse, and you found it.",
      "coach.verdict.greatEquivalent": "Great move: you chose one as good as the best, and every other move was clearly worse.",
      "coach.verdict.perfect": "You found the best move.",
      "coach.verdict.equivalent": "As good as the best: the engine lists {best} first, but the difference in win chance is negligible.",
      "coach.verdict.masterSame": "You played the same move as {master}: the best move.",
      "coach.verdict.masterSameEquivalent": "You played the same move as {master}. The engine prefers {best} by a hair: both are equally good.",
      "coach.verdict.very_good": "Very close to the best: the engine prefers {best}, but yours loses almost nothing.",
      "coach.verdict.good": "A good move, although {best} was a little stronger.",
      "coach.verdict.interesting": "An inaccuracy: it gives up a little ground. {best} was better.",
      "coach.verdict.dubious": "Dubious: it gives up part of your advantage. The position was better after {best}.",
      "coach.verdict.dubiousNoEdge": "Dubious: {best} was clearly better and your move worsens the position.",
      "coach.verdict.bad": "A mistake: this move makes your position worse. {best} was the way to go.",
      "coach.verdict.blunder": "A serious mistake: it costs you a lot of win chance. Look at {best}.",
      "coach.verdict.allows_mate": "This move lets the opponent force a checkmate. Check their checks before you move. {best} was better.",
      "coach.verdict.missed_mate": "There was a forced mate and you did not play it: {best}.",
      "coach.verdict.missedMateWinning": "You were still winning ({eval}), but there was a forced mate: {best}. A missed mate still costs points.",
      "coach.label.missedMate": "Missed mate",
      "coach.verdict.timeout": "Time ran out before you moved. The best move was {best}.",
      "coach.verdict.skip": "You skipped this position. The best move was {best}.",
      "coach.verdict.revealed": "You looked at the answer: 0 points this time, but now you know the idea: {best}.",
      "coach.verdict.no_move": "You did not choose a move. The best move was {best}.",
      "coach.insight.perfect": "Nothing to fix: you played the same move as the engine.",
      "coach.insight.solid": "Your move is a reasonable alternative: the engine rates it almost as good.",
      "coach.insight.unknown": "The engine prefers {best}, but we could not find a reason clear enough to explain it with confidence.",
      "coach.lines.caption": "{engine}, depth {depth}",
      "coach.lines.engine.stockfish": "Stockfish",
      "coach.lines.engine.local": "Backup engine",
      "coach.lines.hint": "Tap a line to step through it on the board.",
      "coach.lines.you": "Your move",
      "coach.lines.best": "Best",
      "coach.lines.master": "Master",
      "coach.lines.aria": "Line {rank}: {san}, evaluation {eval}",
      "coach.step.label": "Step through line {rank}",
      "coach.step.first": "Go to the start of the line",
      "coach.step.prev": "Previous move",
      "coach.step.next": "Next move",
      "coach.step.last": "Go to the end of the line",
      "coach.step.pos": "Move {n} of {total}",
      "coach.step.start": "Starting position",
      "coach.step.tip": "From here you can play your own moves on the board.",
      "coach.step.token": "Go to the move {san}",
      "coach.concept.aria": "See the concept: {title}",
      "coach.concept.close": "Got it",
      "coach.concept.example": "Example: {title}",
      "coach.level.up": "Level up!",
      "coach.level.next": "{xp} XP to the next level",
      "coach.level.max": "Top level reached",
      "coach.card.created": "Saved to your notebook, to review {when}.",
      "coach.card.pass": "Review passed: you will see it again {when}.",
      "coach.card.fail": "Still tricky: it goes back to the start and you review it {when}.",
      "coach.card.cleared": "Mastered! This position leaves your review.",
      "coach.card.when.now": "right now",
      "coach.card.when.today": "today",
      "coach.card.when.tomorrow": "tomorrow",
      "coach.card.when.days": "in {n} days",
      "coach.achievement": "Achievement unlocked",
      "coach.duel.winner": "Round to {name}",
      "coach.duel.tie": "Round drawn",
      "coach.duel.winnerTag": "Round winner",
      "coach.duel.noMove": "No move",
      "coach.think.goal": "Find the best move. The closer it is to the engine's choice, the more points you earn.",
      "coach.think.eyebrow.classic": "Classic game",
      "coach.think.eyebrow.own": "Your game",
      "coach.think.eyebrow.review": "Mistake review",
      "coach.think.eyebrow.daily": "Daily challenge",
      "coach.think.master": "You play as {name}.",
      "coach.think.move": "Move {n}",
      "coach.think.hints": "Hints: the piece (-{p1}%), the square (-{p2}%) or the whole move (0 points).",
      "coach.think.duelTurn": "{name}'s turn",
      "coach.think.duelRule": "Both play the same position and their moves are compared at the end of the round.",
      "coach.think.backup": "The strong engine is not ready yet: for now the backup engine scores, and it looks less deeply.",
      "coach.link.lichess": "View the game on Lichess",
      "coach.link.chesscom": "View the game on Chess.com",
      "coach.link.aria": "{label} (opens in a new tab)",
      "coach.eval.title": "Scoring your move",
      "coach.eval.sub": "The engine is comparing your move with the best one.",
      "coach.sum.title": "Session complete",
      "coach.sum.titleDuel": "Duel finished",
      "coach.sum.accuracy": "Average accuracy",
      "coach.sum.points": "Points",
      "coach.sum.of": "{points} / {max}",
      "coach.sum.time": "Time",
      "coach.sum.positions": "Positions",
      "coach.sum.breakdown": "How your moves went",
      "coach.sum.breakdownAria": "Moves by quality",
      "coach.sum.list": "The positions of this session",
      "coach.sum.open": "Open the analysis of position {n}",
      "coach.sum.pos": "Position {n}",
      "coach.sum.pts": "{points} pts",
      "coach.sum.rewards": "What you earned",
      "coach.sum.xp": "+{xp} XP",
      "coach.sum.achievements": "New achievements",
      "coach.sum.cards.one": "{n} position was added to your notebook to review.",
      "coach.sum.cards.other": "{n} positions were added to your notebook to review.",
      "coach.sum.noRewards": "Play with your profile to earn experience and build your mistake notebook.",
      "coach.sum.playAgain": "Play again",
      "coach.sum.rematch": "Rematch",
      "coach.sum.review": "Review my mistakes now",
      "coach.sum.reviewPlayer": "Review {name}'s mistakes",
      "coach.sum.share": "Share",
      "coach.sum.copied": "Summary copied to the clipboard.",
      "coach.sum.shareFailed": "Could not share. Copy the summary by hand.",
      "coach.sum.noMore": "No more positions were found.",
      "coach.sum.winner": "{name} wins",
      "coach.sum.draw": "Draw",
      "coach.sum.duelAcc": "Accuracy: {acc}%",
      "coach.sum.hits": "{hits} of {total} correct",
      "coach.sum.hits.one": "{hits} of 1 correct",
      "coach.sum.tone.great": "An outstanding session",
      "coach.sum.tone.good": "A good session",
      "coach.sum.tone.ok": "A learning session",
      "coach.sum.tone.low": "A session to learn from",
      "coach.share.title": "Ludus Scaccorum",
      "coach.share.head": "{title}: {points} / {max} points, {acc}% accuracy.",
      "coach.share.duel": "Duel {a} vs {b}: {sa} - {sb}. {winner}",
      "coach.share.xp": "+{xp} XP",
      "coach.share.cta": "Train with classic games and your own mistakes:",
      "coach.dots.done": "Position {n}: {quality}, {points}",
      "coach.dots.noMove": "Position {n}: no move, 0 points",
      "coach.dots.duel": "Position {n}: {a} {pa}, {b} {pb}",
      "coach.dots.current": "Position {n}: the one you are playing",
      "coach.dots.todo": "Position {n}: not played yet",
      "coach.dots.summary": "{done} of {total} positions played",
      "coach.dots.summary.one": "{done} of 1 position played",
    },
  };

  function registerText() {
    const i18n = L().i18n;
    try {
      if (i18n && typeof i18n.register === "function") i18n.register(TEXT);
    } catch (error) {
      // Text is optional for the maths; never let it break loading.
    }
  }
  registerText();

  // ---------- Small pure helpers ----------

  const QUALITY_CODES = ["brilliant", "great", "perfect", "very_good", "good", "interesting", "dubious", "bad", "blunder", "no_move"];
  // Answers that count as a hit in the dots: the same rule app.js uses for a "hit".
  const HIT_QUALITIES = ["brilliant", "great", "perfect", "very_good", "good"];
  const GLYPHS = { brilliant: "!!", great: "!", perfect: "★", very_good: "✓", good: "○", interesting: "!?", dubious: "?!", bad: "?", blunder: "??", no_move: "—" };

  function knownQuality(code) {
    return QUALITY_CODES.includes(code) ? code : "no_move";
  }

  function qualityInfo(code, lang) {
    const known = knownQuality(code);
    const scoring = L().Scoring;
    let glyph = GLYPHS[known];
    let label = t(`quality.${known}`, {}, lang);
    if (scoring && typeof scoring.qualityMeta === "function") {
      try {
        glyph = scoring.qualityMeta(known).glyph || glyph;
      } catch (error) {
        // keep the local glyph
      }
    }
    if (scoring && typeof scoring.qualityLabel === "function") {
      try {
        label = scoring.qualityLabel(known, lang) || label;
      } catch (error) {
        // keep the i18n label
      }
    }
    return { code: known, glyph, label, tone: known.replace(/_/g, "-"), hit: HIT_QUALITIES.includes(known) };
  }

  // "7.4" / "7,4" / "10": one decimal at most, the decimal comma in Spanish.
  function formatNumber(value, lang, decimals) {
    const digits = decimals === undefined ? 1 : decimals;
    if (!Number.isFinite(value)) return "-";
    const factor = Math.pow(10, digits);
    const rounded = Math.round(value * factor) / factor;
    let text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits).replace(/\.?0+$/, "");
    if (langOf(lang) === "es") text = text.replace(".", ",");
    return text;
  }

  // A number with its unit in the right form: "1 point" / "7.5 points", "1 punto" / "7,5 puntos" (never "1 puntos"). Only exactly one is
  // singular. kind: "points" (the 0-10 score of a position) or "pp" (percentage points of win chance).
  function unitText(kind, value, lang) {
    const singular = Math.abs(Number(value)) === 1;
    return t(`coach.unit.${kind}.${singular ? "one" : "other"}`, { n: formatNumber(value, lang) }, lang);
  }

  // "2nd choice" in English; Spanish keeps the plain number ("la opción 2 del motor").
  function rankText(rank, lang) {
    const n = Math.round(Number(rank));
    if (langOf(lang) === "es" || !Number.isFinite(n) || n < 1) return String(Number.isFinite(n) ? n : rank);
    const teen = n % 100 >= 11 && n % 100 <= 13;
    const suffix = teen ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th";
    return `${n}${suffix}`;
  }

  // "2 of 3 correct": the form follows the total (one position is "of 1 correct", "de 1 acierto").
  function hitsText(hits, total, lang) {
    return t(Number(total) === 1 ? "coach.sum.hits.one" : "coach.sum.hits", { hits, total }, lang);
  }

  function formatEval(score, lang) {
    const scoring = L().Scoring;
    if (Number.isFinite(score) && scoring && typeof scoring.formatEval === "function") {
      try {
        return scoring.formatEval(score, lang);
      } catch (error) {
        // fall through
      }
    }
    return "?";
  }

  function winPercent(score) {
    const scoring = L().Scoring;
    if (!Number.isFinite(score) || !scoring || typeof scoring.winPercent !== "function") return null;
    try {
      return scoring.winPercent(score);
    } catch (error) {
      return null;
    }
  }

  const answerOf = (context, index) => (context && Array.isArray(context.answers) ? context.answers[index || 0] : null) || null;

  // The move of the answer is the engine's best one.
  function playedBest(context, answer) {
    if (!answer || !answer.uci) return false;
    if (context && context.best && context.best.uci === answer.uci) return true;
    return Boolean(answer.assessment && (answer.assessment.rank === 1 || (answer.assessment.isBest && answer.assessment.winLossPct === 0)));
  }

  // ---------- Verdict ----------

  // A missed mate that keeps at least this win chance is still a winning position: the sentence says so instead of
  // treating the move like a collapse. Scoring decides it (`assessment.keptWin`, the same 75%); an assessment stored
  // without the flag is judged here from the score of the move.
  const STILL_WINNING_PCT = 75;
  // From this engine score (centipawns, the mover's point of view) the mover has an edge to give up.
  const EDGE_CP = 50;

  function stillWinningAfterMissedMate(answer) {
    const assessment = (answer && answer.assessment) || {};
    if (assessment.reason !== "missed_mate") return false;
    if (typeof assessment.keptWin === "boolean") return assessment.keptWin;
    const score = Number.isFinite(answer.userScore) ? answer.userScore : assessment.userScore;
    const pct = Number.isFinite(score) ? winPercent(score) : null;
    return pct !== null && pct >= STILL_WINNING_PCT;
  }

  // The i18n key of the one-sentence verdict, and the parameters it needs. The third argument is only
  // needed by sentences that quote an evaluation (its decimal comma follows the language).
  function verdictKey(context, answer, lang) {
    const ans = answer || answerOf(context, 0);
    if (!ans) return { key: "coach.verdict.no_move", params: {} };
    const best = context && context.best && context.best.san ? showSan(context.best.san, lang) : "-";
    const params = { best };
    if (!ans.uci) {
      if (ans.hintsUsed >= 3 || ans.noMoveReason === "hint_reveal") return { key: "coach.verdict.revealed", params };
      if (ans.noMoveReason === "timeout" || ans.reason === "timeout") return { key: "coach.verdict.timeout", params };
      if (ans.noMoveReason === "manual_skip" || ans.reason === "skip") return { key: "coach.verdict.skip", params };
      return { key: "coach.verdict.no_move", params };
    }
    const assessment = ans.assessment || {};
    if (assessment.reason === "allows_mate") return { key: "coach.verdict.allows_mate", params };
    if (assessment.reason === "missed_mate") {
      if (stillWinningAfterMissedMate(ans)) {
        const score = Number.isFinite(ans.userScore) ? ans.userScore : assessment.userScore;
        return { key: "coach.verdict.missedMateWinning", params: { best, eval: formatEval(score, lang) } };
      }
      return { key: "coach.verdict.missed_mate", params };
    }
    const code = knownQuality(assessment.qualityCode);
    // "Perfect", "Great" and "Brilliant" only need the move to be as good as the best one (inside the tolerance band):
    // when the engine lists another move first, the sentence must not claim that this was the best move.
    const first = playedBest(context, ans);
    const sameAsMaster = Boolean(context && context.master && context.master.uci === ans.uci && context.masterName);
    if (code === "perfect" && sameAsMaster) {
      return first
        ? { key: "coach.verdict.masterSame", params: { master: context.masterName } }
        : { key: "coach.verdict.masterSameEquivalent", params: { master: context.masterName, best } };
    }
    if (!first && code === "perfect") return { key: "coach.verdict.equivalent", params };
    if (!first && code === "brilliant") return { key: "coach.verdict.brilliantEquivalent", params };
    if (!first && code === "great") return { key: "coach.verdict.greatEquivalent", params };
    // "Gives up part of your advantage" is only true when there was an advantage to give up.
    if (code === "dubious") {
      const score = context && context.best ? context.best.score : undefined;
      if (!(Number.isFinite(score) && score >= EDGE_CP)) return { key: "coach.verdict.dubiousNoEdge", params };
    }
    return { key: `coach.verdict.${code}`, params };
  }

  function verdictText(context, answer, lang) {
    const found = verdictKey(context, answer, lang);
    return t(found.key, found.params, lang);
  }

  // ---------- Win chance ----------

  // Win% (0..100, mover's point of view) of the best move, of the answer and of the
  // master's move; `loss` is what the answer gives up, in win% points.
  function winBars(context, answer) {
    const ans = answer || answerOf(context, 0);
    const best = context && context.best ? winPercent(context.best.score) : null;
    let user = null;
    if (ans && ans.uci) {
      if (playedBest(context, ans)) user = best;
      else if (Number.isFinite(ans.userScore)) user = winPercent(ans.userScore);
      else if (ans.assessment && Number.isFinite(ans.assessment.winLossPct) && best !== null) user = clamp(best - ans.assessment.winLossPct, 0, 100);
    }
    const master = context && context.master && Number.isFinite(context.master.score) ? winPercent(context.master.score) : null;
    const loss = best !== null && user !== null ? Math.max(0, best - user) : null;
    return { best, user, master, loss };
  }

  // ---------- Links ----------

  const GAME_HOSTS = { "lichess.org": "lichess", "www.lichess.org": "lichess", "chess.com": "chesscom", "www.chess.com": "chesscom" };

  // The Site tag of a PGN may hold anything a stranger typed. Only an https URL on
  // lichess.org or chess.com (no credentials, no odd port, a real path) becomes a link.
  function safeGameUrl(site) {
    if (typeof site !== "string" || site.length > 400) return null;
    const match = /https:\/\/[^\s"'<>]+/i.exec(site);
    if (!match) return null;
    let url = null;
    try {
      url = new URL(match[0]);
    } catch (error) {
      return null;
    }
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const provider = GAME_HOSTS[url.hostname.toLowerCase()];
    if (!provider || url.pathname.length < 2) return null;
    return { href: url.href, provider };
  }

  // ---------- The position on screen (thinking state) ----------

  function moverSurname(players, side) {
    const parts = String(players || "").split(/\s+vs\.?\s+/i);
    if (parts.length !== 2) return "";
    const full = String(side === "b" ? parts[1] : parts[0]).trim().replace(/\s+/g, " ");
    if (!full) return "";
    if (full.includes(",")) return full.split(",")[0].trim();
    const words = full.split(" ");
    return words[words.length - 1];
  }

  // The stored metadata in the language of the page (a classic's players and event are kept in English / ASCII); without the
  // classics screen the raw text is shown.
  function localizedMeta(meta, lang) {
    const screen = L().Screens && L().Screens.classics;
    const helpers = screen && screen.helpers;
    if (helpers && typeof helpers.localizeMeta === "function") {
      try {
        return helpers.localizeMeta(meta, lang);
      } catch (error) {
        // keep the raw text
      }
    }
    return meta;
  }

  // The kind of a classic position ("sacrifice", "only-move"...) in words. It names the idea of the position, so it is
  // never shown before the answer (see renderThinking): the result card shows it afterwards.
  function themeInfo(code, lang) {
    if (!code) return null;
    const classics = L().Classics;
    let label = String(code);
    let hint = "";
    try {
      if (classics && typeof classics.kindLabel === "function") label = classics.kindLabel(code, lang) || label;
      if (classics && typeof classics.kindHint === "function") hint = classics.kindHint(code, lang) || "";
    } catch (error) {
      // keep the raw kind
    }
    return { code: String(code), label, hint };
  }

  // What the card shows while the person thinks. `position` is a Position (docs section 9).
  function positionModel(input) {
    const opts = input || {};
    const position = opts.position || {};
    const rawMeta = position.meta && typeof position.meta === "object" ? position.meta : {};
    const lang = langOf(opts.lang);
    const meta = localizedMeta(rawMeta, lang);
    const kind = opts.session && opts.session.kind ? opts.session.kind : position.source === "classic" ? "classic" : "own";
    const classic = position.classic && typeof position.classic === "object" ? position.classic : null;
    const kindInfo = classic && classic.kind ? themeInfo(classic.kind, lang) : null;
    const side = meta.sideToMove === "b" ? "b" : "w";
    const eyebrowKind = ["classic", "own", "review", "daily"].includes(kind) ? kind : "own";
    const link = kind === "own" || position.source === "own" ? safeGameUrl(meta.site) : null;
    const note = classic && classic.note && typeof classic.note === "object" ? classic.note[lang] || classic.note.es || "" : "";
    return {
      eyebrow: t(`coach.think.eyebrow.${eyebrowKind}`, {}, lang),
      event: String(meta.event || "").trim(),
      year: String(meta.year || "").trim(),
      players: String(meta.players || "").trim(),
      moveNumber: Number.isFinite(Number(meta.moveNumber)) ? Number(meta.moveNumber) : null,
      side,
      kind: kindInfo,
      note: String(note || ""),
      moverName: kind === "own" ? "" : moverSurname(rawMeta.players, side),
      link,
      eco: String(meta.eco || "").trim(),
      lang,
    };
  }

  // ---------- Progress dots ----------

  // input: { total, current (0-based index of the round on screen), rounds: [ { quality, points,
  // noMove, hit, duel: [{ name, points }] } ] (one per finished round, in order), lang }.
  function dotsModel(input) {
    const opts = input || {};
    const lang = langOf(opts.lang);
    const total = Math.max(0, Math.round(Number(opts.total) || 0));
    const rounds = Array.isArray(opts.rounds) ? opts.rounds : [];
    const current = Number.isFinite(Number(opts.current)) ? Math.round(Number(opts.current)) : rounds.length;
    const done = Math.min(rounds.length, total);
    const items = [];
    for (let i = 0; i < total; i += 1) {
      const n = i + 1;
      const round = rounds[i];
      if (round) {
        const q = knownQuality(round.quality);
        const noMove = q === "no_move" || round.noMove;
        const state = noMove ? "none" : round.hit === undefined ? (HIT_QUALITIES.includes(q) ? "hit" : "miss") : round.hit ? "hit" : "miss";
        let label;
        if (Array.isArray(round.duel) && round.duel.length === 2) {
          label = t("coach.dots.duel", { n, a: round.duel[0].name, pa: unitText("points", round.duel[0].points, lang), b: round.duel[1].name, pb: unitText("points", round.duel[1].points, lang) }, lang);
        } else if (noMove) {
          label = t("coach.dots.noMove", { n }, lang);
        } else {
          label = t("coach.dots.done", { n, quality: qualityInfo(q, lang).label, points: unitText("points", round.points, lang) }, lang);
        }
        items.push({ n, state, q, label });
      } else if (i === current) {
        items.push({ n, state: "current", q: "", label: t("coach.dots.current", { n }, lang) });
      } else {
        items.push({ n, state: "todo", q: "", label: t("coach.dots.todo", { n }, lang) });
      }
    }
    return { total, done, dense: total > 24, items, summary: t(total === 1 ? "coach.dots.summary.one" : "coach.dots.summary", { done, total }, lang) };
  }

  // ---------- Rewards (what Profile.recordRound answered) ----------

  function whenText(dueTs, now, lang) {
    if (!Number.isFinite(dueTs)) return t("coach.card.when.today", {}, lang);
    const days = Math.round((dueTs - now) / 86400000);
    if (dueTs - now <= 3600000) return t("coach.card.when.now", {}, lang);
    if (days <= 0) return t("coach.card.when.today", {}, lang);
    if (days === 1) return t("coach.card.when.tomorrow", {}, lang);
    return t("coach.card.when.days", { n: days }, lang);
  }

  // rewards: { xpGained, level (Profile.levelFor result), levelUp, card, unlocked: [{ id, name, description, glyph }] }.
  // The notebook line is null when the round did not touch a card.
  function rewardModel(rewards, now, lang) {
    if (!rewards || typeof rewards !== "object") return null;
    const language = langOf(lang);
    const stamp = Number.isFinite(now) ? now : Date.now();
    const xp = Number.isFinite(rewards.xpGained) ? Math.max(0, Math.round(rewards.xpGained)) : 0;
    const level = rewards.level && typeof rewards.level === "object" ? rewards.level : null;
    let card = null;
    const c = rewards.card && typeof rewards.card === "object" ? rewards.card : null;
    if (c) {
      const when = whenText(c.due, stamp, language);
      if (c.newlyCleared) card = { tone: "success", text: t("coach.card.cleared", {}, language) };
      else if (c.created) card = { tone: "info", text: t("coach.card.created", { when }, language) };
      else if (c.updated && c.passed) card = { tone: "success", text: t("coach.card.pass", { when }, language) };
      else if (c.updated) card = { tone: "warn", text: t("coach.card.fail", { when }, language) };
    }
    const unlocked = Array.isArray(rewards.unlocked) ? rewards.unlocked.filter((entry) => entry && entry.name) : [];
    if (!xp && !card && !unlocked.length && !rewards.levelUp) return null;
    return { xp, level, levelUp: Boolean(rewards.levelUp), card, unlocked };
  }

  // ---------- Summary ----------

  // record: SessionRecord (docs section 9); rounds: [{ index, fen, side, quality (of the primary answer), points,
  // hit, san, bestSan, bestUci, userUci, players: [{ name, san, uci, points, quality }] }]; rewards: { xp, cards,
  // unlocked, levelBefore, levelAfter }; mode: "solo" | "duel".
  function summaryModel(input) {
    const opts = input || {};
    const record = opts.record || {};
    const rounds = Array.isArray(opts.rounds) ? opts.rounds : [];
    const lang = langOf(opts.lang);
    const duel = opts.mode === "duel" || record.mode === "duel";
    const counts = {};
    QUALITY_CODES.forEach((code) => {
      counts[code] = 0;
    });
    const byQuality = record.byQuality && typeof record.byQuality === "object" ? record.byQuality : null;
    if (byQuality) {
      Object.keys(byQuality).forEach((code) => {
        if (QUALITY_CODES.includes(code)) counts[code] = Number(byQuality[code]) || 0;
      });
    } else {
      rounds.forEach((round) => {
        counts[knownQuality(round.quality)] += 1;
      });
    }
    const totalAnswers = QUALITY_CODES.reduce((sum, code) => sum + counts[code], 0);
    const segments = QUALITY_CODES.filter((code) => counts[code] > 0).map((code) => ({
      code,
      count: counts[code],
      share: totalAnswers ? counts[code] / totalAnswers : 0,
      info: qualityInfo(code, lang),
    }));
    const points = Number.isFinite(record.points) ? record.points : rounds.reduce((sum, round) => sum + (Number(round.points) || 0), 0);
    const positions = Number.isFinite(record.positions) ? record.positions : rounds.length;
    const maxPoints = Number.isFinite(record.maxPoints) ? record.maxPoints : positions * 10 * (duel ? 2 : 1);
    const accuracy = Number.isFinite(record.avgAccuracy) ? record.avgAccuracy : 0;
    const ratio = maxPoints > 0 ? points / maxPoints : 0;
    const tone = ratio >= 0.85 ? "great" : ratio >= 0.65 ? "good" : ratio >= 0.4 ? "ok" : "low";
    const gaugeTone = ratio >= 0.85 ? "perfect" : ratio >= 0.65 ? "good" : ratio >= 0.4 ? "dubious" : "blunder";
    const hits = rounds.filter((round) => round.hit).length;
    let duelInfo = null;
    if (duel) {
      const names = record.duel && Array.isArray(record.duel.names) ? record.duel.names : ["", ""];
      const scores = record.duel && Array.isArray(record.duel.scores) ? record.duel.scores.map((value) => Number(value) || 0) : [0, 0];
      const acc = [0, 0];
      // Each player has their own numbers (points, accuracy, hits, how their moves went): the two are never merged.
      const players = [0, 1].map((side) => {
        const entries = rounds.map((round) => (round.players && round.players[side] ? round.players[side] : null)).filter(Boolean);
        const sum = entries.reduce((total, entry) => total + (Number.isFinite(entry.accuracy) ? entry.accuracy : 0), 0);
        acc[side] = entries.length ? Math.round((sum / entries.length) * 10) / 10 : 0;
        const mine = {};
        QUALITY_CODES.forEach((code) => {
          mine[code] = 0;
        });
        entries.forEach((entry) => {
          mine[knownQuality(entry.quality)] += 1;
        });
        const hitsOf = entries.filter((entry) => (typeof entry.hit === "boolean" ? entry.hit : HIT_QUALITIES.includes(knownQuality(entry.quality)))).length;
        return {
          name: names[side],
          score: scores[side],
          accuracy: acc[side],
          hits: hitsOf,
          total: entries.length,
          segments: QUALITY_CODES.filter((code) => mine[code] > 0).map((code) => ({
            code, count: mine[code], share: entries.length ? mine[code] / entries.length : 0, info: qualityInfo(code, lang),
          })),
        };
      });
      const winner = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : -1;
      duelInfo = { names, scores, accuracy: acc, winner, players };
    }
    return {
      lang,
      kind: record.kind || "classic",
      title: String(record.title || ""),
      mode: duel ? "duel" : "solo",
      positions,
      points,
      maxPoints,
      accuracy,
      ratio,
      tone,
      gaugeTone,
      hits,
      durationMs: Number.isFinite(record.durationMs) ? record.durationMs : 0,
      segments,
      rounds,
      duel: duelInfo,
      rewards: opts.rewards || null,
      noMorePositions: Boolean(opts.noMorePositions),
    };
  }

  function shareText(summary, language) {
    const lang = langOf(language || (summary && summary.lang));
    if (!summary) return "";
    const lines = [];
    const points = formatNumber(summary.points, lang);
    const max = formatNumber(summary.maxPoints, lang, 0);
    const acc = formatNumber(summary.accuracy, lang, 0);
    lines.push(`${t("coach.share.title", {}, lang)}`);
    if (summary.mode === "duel" && summary.duel) {
      const winner = summary.duel.winner === -1 ? t("coach.sum.draw", {}, lang) : t("coach.sum.winner", { name: summary.duel.names[summary.duel.winner] }, lang);
      lines.push(t("coach.share.duel", {
        a: summary.duel.names[0], b: summary.duel.names[1],
        sa: formatNumber(summary.duel.scores[0], lang), sb: formatNumber(summary.duel.scores[1], lang), winner,
      }, lang));
    } else {
      lines.push(t("coach.share.head", { title: summary.title || t("coach.sum.title", {}, lang), points, max, acc }, lang));
    }
    // A duel has no merged mix: the two players' moves are not one set of answers.
    const mix = summary.mode === "duel" ? "" : (summary.segments || []).map((segment) => `${segment.count} ${segment.info.label.toLowerCase()}`).join(", ");
    if (mix) lines.push(mix);
    const xp = summary.rewards && Number.isFinite(summary.rewards.xp) ? summary.rewards.xp : 0;
    if (xp > 0) lines.push(t("coach.share.xp", { xp }, lang));
    return lines.join("\n");
  }

  // ---------- Principal variations ----------

  // Numbers a line of SAN moves the way a score sheet does: "12." before White's move,
  // "12..." when the line starts with Black's. `fen` says whose move it is and the move number.
  function pvTokens(fen, sans) {
    const parts = String(fen || "").split(/\s+/);
    let white = parts[1] !== "b";
    let move = Number(parts[5]) >= 1 ? Math.round(Number(parts[5])) : 1;
    return (Array.isArray(sans) ? sans : []).map((san, index) => {
      const number = white ? `${move}.` : index === 0 ? `${move}...` : "";
      if (!white) move += 1;
      white = !white;
      return { ply: index + 1, san: String(san), number };
    });
  }

  // Arrows for a mini board: the best move (green) and the one the person played (blue).
  function roundArrows(best, played) {
    const arrows = [];
    const add = (uci, color) => {
      if (typeof uci === "string" && /^[a-h][1-8][a-h][1-8]/.test(uci)) arrows.push({ from: uci.slice(0, 2), to: uci.slice(2, 4), color });
    };
    add(best, "best");
    if (played && played !== best) add(played, "user");
    return arrows;
  }

  // ---------- DOM: shared pieces ----------

  // One picture for every tag Insights can emit (Insights.TAGS; a test keeps the two lists together). The picture sits next to the sentence
  // that already says everything, so it is decoration (aria-hidden) and only has to tell the tags apart at a glance.
  const INSIGHT_ICONS = {
    hangs_piece: "alert", missed_capture: "target", missed_mate: "trophy", allows_mate: "alert", missed_check: "target",
    quiet_best: "lightbulb", sacrifice_best: "sparkles", back_rank: "shield", fork_available: "swords", pin_or_skewer: "target",
    discovered_attack: "eye", missed_promotion: "star", development: "rook", king_safety: "shield", endgame_technique: "book",
    open_file: "rook", outpost: "flag", trade_when_ahead: "refresh", time_trouble: "clock", solid: "check", other: "info",
  };

  // The tags the kit has no picture for are drawn here, in the same style as the kit's (24 grid, 1.75 stroke, round, currentColor, so
  // they take the gold of their tile in every board theme and in high contrast): a lightning bolt for a tactic, a pawn with an arrow down
  // for lost material.
  const INSIGHT_SHAPES = {
    tactic_available: ["M13.2 2.8 5 13.4h6l-1 7.8 8.2-10.6h-6l1-7.8Z"],
    loses_material: [
      "M9 4.2a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Z", "M6.6 11.2h4.8", "M7.4 11.2c0 2.4-.9 4-2.6 5.8h8.4c-1.7-1.8-2.6-3.4-2.6-5.8", "M4 20.2h10",
      "M19 6v10.4", "M16.2 13.6l2.8 2.8 2.8-2.8",
    ],
  };

  function svgIcon(paths, size, className) {
    return h("svg:svg", {
      class: cls("ui-icon", className), width: size || 18, height: size || 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
      "stroke-width": 1.75, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false",
    }, paths.map((d) => h("svg:path", { d })));
  }

  // Where the picture of a tag comes from: { source: "kit" | "local", name }, or null for a tag nobody drew (the test catches that).
  function insightIconFor(tag) {
    if (Object.prototype.hasOwnProperty.call(INSIGHT_SHAPES, tag)) return { source: "local", name: tag };
    if (Object.prototype.hasOwnProperty.call(INSIGHT_ICONS, tag)) return { source: "kit", name: INSIGHT_ICONS[tag] };
    return null;
  }

  function insightIcon(tag, size) {
    const found = insightIconFor(tag);
    if (found && found.source === "local") return svgIcon(INSIGHT_SHAPES[tag], size, `ui-icon-${found.name.replace(/_/g, "-")}`);
    return icon(found ? found.name : INSIGHT_ICONS.other, size);
  }

  const STEP_ICONS = {
    first: ["M17 6l-6 6 6 6", "M7 6v12"],
    prev: ["M14.5 6 8.5 12l6 6"],
    next: ["M9.5 6l6 6-6 6"],
    last: ["M7 6l6 6-6 6", "M17 6v12"],
  };

  function card(children, className, attrs) {
    return h("section", Object.assign({ class: cls("co-card", className) }, attrs || {}), children);
  }

  function eyebrow(text, iconName, id) {
    const attrs = { class: "co-eyebrow" };
    if (id) attrs.id = id;
    return h("h3", attrs, iconName ? icon(iconName, 14) : null, h("span", null, text));
  }

  function pill(text, tone, iconName) {
    return h("span", { class: cls("co-pill", tone && `co-pill-${tone}`) }, iconName ? icon(iconName, 13) : null, h("span", null, text));
  }

  function plainChip(text, tone, iconName) {
    const kit = ui();
    if (typeof kit.chip === "function") {
      try {
        return kit.chip(text, { tone, icon: iconName });
      } catch (error) {
        // fall through to the plain span
      }
    }
    return h("span", { class: cls("chip", tone && `chip-${tone}`) }, text);
  }

  function gaugeNode(value, max, size, tone, label) {
    const kit = ui();
    if (typeof kit.gauge === "function") {
      try {
        return kit.gauge({ value, max, size, tone, label });
      } catch (error) {
        // fall through to the text version
      }
    }
    return h("div", { class: "co-gauge-text", role: "img", "aria-label": `${formatNumber(value)} / ${max}` }, `${formatNumber(value)}/${max}`);
  }

  function insightTexts(answer, lang) {
    const insights = answer && answer.insights ? answer.insights : null;
    if (!insights) return [];
    const engine = L().Insights;
    const messages = Array.isArray(insights.messages) ? insights.messages : [];
    if (engine && typeof engine.renderMessages === "function" && messages.length) {
      try {
        const rendered = engine.renderMessages(messages.slice(0, 4), lang);
        return messages.slice(0, 4).map((message, index) => ({ text: rendered[index] || "", tag: message && message.tag ? message.tag : "other" })).filter((entry) => entry.text);
      } catch (error) {
        // fall back to the texts that were rendered when the round was scored
      }
    }
    const texts = Array.isArray(insights.texts) ? insights.texts : [];
    return texts.map((text, index) => ({ text: String(text), tag: messages[index] && messages[index].tag ? messages[index].tag : "other" })).filter((entry) => entry.text);
  }

  function tagLabel(tag, lang) {
    const engine = L().Insights;
    try {
      if (engine && typeof engine.tagLabelKey === "function") return t(engine.tagLabelKey(tag), {}, lang);
    } catch (error) {
      // fall through
    }
    return String(tag || "");
  }

  // ---------- DOM: the position while the person thinks ----------

  function renderThinking(el, model, extra) {
    if (!el || !getDoc() || !model) return;
    const opts = extra || {};
    const lang = langOf(model.lang);
    clear(el);
    const title = [model.event, model.year].filter(Boolean).join(" · ");
    const meta = [];
    if (model.moveNumber !== null) meta.push(t("coach.think.move", { n: model.moveNumber }, lang));
    if (model.eco) meta.push(`ECO ${model.eco}`);

    if (opts.duel) {
      el.appendChild(h("section", { class: "co-turnbanner", "aria-live": "polite" },
        h("span", { class: "co-turnbanner-avatar", "aria-hidden": "true" }, opts.duel.initials || "?"),
        h("div", { class: "co-turnbanner-copy" },
          h("p", { class: "co-turnbanner-title" }, t("coach.think.duelTurn", { name: opts.duel.name }, lang)),
          h("p", { class: "co-turnbanner-sub" }, t("coach.think.duelRule", {}, lang)))));
    }

    // The backup-engine notice is the first row of the panel: on a phone the rest of the card is below the fold,
    // and what it says (the score will be an estimate) matters before the first move.
    if (opts.backupEngine) {
      el.appendChild(h("p", { class: "co-note co-note-warn", role: "note" }, icon("alert", 16), h("span", null, t("coach.think.backup", {}, lang))));
    }

    // The kind of position (sacrifice, only move...) is deliberately not drawn here: naming the idea of the
    // position before the answer would hand over the very thing the person is training to find. The result shows it.
    const ctx = [
      h("div", { class: "co-ctx-top" },
        h("p", { class: "co-eyebrow co-eyebrow-gold" }, model.eyebrow)),
      title ? h("h2", { class: "co-ctx-title" }, title) : null,
      model.players ? h("p", { class: "co-ctx-players" }, model.players) : null,
      meta.length ? h("p", { class: "co-ctx-meta" }, meta.join(" · ")) : null,
      model.moverName ? h("p", { class: "co-ctx-mover" }, icon("users", 16), h("span", null, t("coach.think.master", { name: model.moverName }, lang))) : null,
    ];
    if (model.link) {
      const label = t(model.link.provider === "chesscom" ? "coach.link.chesscom" : "coach.link.lichess", {}, lang);
      ctx.push(h("a", {
        class: "co-ctx-link",
        href: model.link.href,
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-label": t("coach.link.aria", { label }, lang),
      }, icon("external", 16), h("span", null, label)));
    }
    el.appendChild(card(ctx, "co-ctx"));

    el.appendChild(card([
      h("p", { class: "co-goal-text" }, icon("target", 18), h("span", null, t("coach.think.goal", {}, lang))),
      opts.hintCosts ? h("p", { class: "co-goal-hints" }, icon("lightbulb", 16), h("span", null, t("coach.think.hints", { p1: opts.hintCosts[0], p2: opts.hintCosts[1] }, lang))) : null,
    ], "co-goal"));
  }

  // The line above the board in a duel: "Ana plays White". `text` is the whole sentence, `name` the player inside it. A name is whatever a
  // person typed, so when the line is too narrow the NAME gives way (an ellipsis, the whole name in a tooltip and in the text a screen
  // reader reads) and the side to move never does: it is the point of the line (css/coach.css .co-turn-name / .co-turn-side).
  function renderTurn(el, model) {
    if (!el) return;
    const doc = getDoc();
    const text = model && model.text !== undefined && model.text !== null ? String(model.text) : "";
    const name = model && model.name !== undefined && model.name !== null ? String(model.name) : "";
    clear(el);
    if (!doc) return;
    const at = name ? text.indexOf(name) : -1;
    if (at < 0) {
      el.textContent = text;
      return;
    }
    const before = text.slice(0, at).trim();
    const after = text.slice(at + name.length).trim();
    // A space between the pieces for whatever reads the text (a flex row draws none of them: the gap does).
    const space = () => doc.createTextNode(" ");
    if (before) el.appendChild(h("span", { class: "co-turn-side" }, before));
    if (before) el.appendChild(space());
    el.appendChild(h("span", { class: "co-turn-name", title: name }, name));
    if (after) el.appendChild(space());
    if (after) el.appendChild(h("span", { class: "co-turn-side" }, after));
  }

  // The same silhouette as the result, so nothing moves when the answer arrives.
  function renderEvaluating(el, extra) {
    if (!el || !getDoc()) return;
    const lang = langOf(extra && extra.lang);
    clear(el);
    const kit = ui();
    const skeleton = (options) => (typeof kit.skeleton === "function" ? kit.skeleton(options) : null);
    el.appendChild(h("section", { class: "co-hero co-hero-pending", "aria-busy": "true" },
      h("div", { class: "co-hero-gauge" }, skeleton({ kind: "circle" })),
      h("div", { class: "co-hero-copy" },
        h("h2", { class: "co-hero-title", tabindex: "-1", "data-focus": "" }, t("coach.eval.title", {}, lang)),
        h("p", { class: "co-hero-verdict" }, t("coach.eval.sub", {}, lang)))));
    el.appendChild(card([skeleton({ kind: "text", lines: 3 })], "co-skel"));
    el.appendChild(card([skeleton({ kind: "text", lines: 4 })], "co-skel"));
  }

  // ---------- DOM: the result of a solo round ----------

  function heroChips(context, answer, lang, rewards) {
    const chips = [];
    const assessment = answer.assessment || {};
    if (answer.hintsUsed >= 3) {
      chips.push(plainChip(t("coach.chip.revealed", {}, lang), "warn", "lightbulb"));
    } else if (answer.hintsUsed >= 1) {
      chips.push(plainChip(t("coach.chip.hint", { pct: Math.round((assessment.hintCost || 0) * 100) }, lang), "warn", "lightbulb"));
    }
    if (answer.noMoveReason === "timeout") chips.push(plainChip(t("coach.chip.timeOut", {}, lang), "danger", "clock"));
    else if (Number.isFinite(answer.timeSpentMs) && answer.timeSpentMs > 0 && answer.uci) {
      chips.push(plainChip(t("coach.chip.time", { seconds: Math.max(1, Math.round(answer.timeSpentMs / 1000)) }, lang), null, "clock"));
    }
    const reward = rewardModel(rewards, Date.now(), lang);
    if (reward && reward.xp > 0) chips.push(plainChip(t("coach.chip.xp", { xp: reward.xp }, lang), "gold", "star"));
    // "Missed mate" is a fact about the move whatever label the ladder gives it: a chip, so the title keeps the one vocabulary.
    if (answer.uci && assessment.reason === "missed_mate") chips.push(plainChip(t("coach.label.missedMate", {}, lang), "warn", "alert"));
    // The score of a round the backup engine judged is an estimate: said next to the score, not only in the long notes below.
    if (context && context.engine && context.engine.source === "local") chips.push(plainChip(t("coach.chip.backup", {}, lang), "warn", "alert"));
    return chips;
  }

  function hero(context, answer, lang, options) {
    const assessment = answer.assessment || {};
    const info = qualityInfo(answer.uci ? assessment.qualityCode : "no_move", lang);
    const points = Number.isFinite(assessment.points) ? assessment.points : 0;
    const max = Number.isFinite(assessment.maxPoints) ? assessment.maxPoints : 10;
    const chips = heroChips(context, answer, lang, options && options.rewards);
    const label = info.label;
    return h("section", { class: "co-hero", "data-q": info.code },
      h("div", { class: "co-hero-gauge" }, gaugeNode(points, max, options && options.gaugeSize ? options.gaugeSize : 116, info.tone, t("coach.gauge.label", {}, lang))),
      h("div", { class: "co-hero-copy" },
        h("h2", { class: "co-hero-title", tabindex: "-1", "data-focus": "" },
          h("span", { class: "co-glyph", "aria-hidden": "true" }, info.glyph), h("span", null, label)),
        h("p", { class: "co-hero-verdict" }, verdictText(context, answer, lang))),
      chips.length ? h("div", { class: "co-chips" }, chips) : null);
  }

  function notesFor(context, answer, lang) {
    const notes = [];
    if (context.refining) notes.push(h("p", { class: "co-note co-note-info co-refining", role: "status" }, h("span", { class: "co-dotsloader", "aria-hidden": "true" }, h("i"), h("i"), h("i")), h("span", null, t("coach.note.refining", {}, lang))));
    if (answer && answer.provisional) notes.push(h("p", { class: "co-note co-note-info", role: "note" }, icon("info", 16), h("span", null, t("coach.note.provisional", {}, lang))));
    if (context.engine && context.engine.source === "local") notes.push(h("p", { class: "co-note co-note-warn", role: "note" }, icon("alert", 16), h("span", null, t("coach.note.fallback", {}, lang))));
    return notes;
  }

  // A disclosure that explains the numbers of a card ("win chance", the signed evaluation, "Stockfish, depth"). A real button
  // (a title attribute does not exist on a phone); it stays open once the person opened it.
  const helpOpen = {};
  function helpBlock(id, keys, lang) {
    const open = Boolean(helpOpen[id]);
    const body = h("div", { class: "co-help-body", id, hidden: !open }, keys.map((key) => h("p", null, t(key, {}, lang))));
    const button = h("button", {
      type: "button",
      class: "co-help-btn",
      "aria-expanded": open ? "true" : "false",
      "aria-controls": id,
      onclick: () => {
        helpOpen[id] = !helpOpen[id];
        body.hidden = !helpOpen[id];
        button.setAttribute("aria-expanded", helpOpen[id] ? "true" : "false");
      },
    }, icon("info", 15), h("span", null, t("coach.help.toggle", {}, lang)));
    return h("div", { class: "co-help" }, button, body);
  }

  function winBar(pct, kind, lang) {
    const width = clamp(pct, 0, 100);
    return h("div", { class: "co-barrow" },
      h("div", { class: "co-bar", "data-kind": kind, role: "img", "aria-label": t("coach.winChance.aria", { pct: Math.round(width) }, lang) },
        h("span", { class: "co-bar-fill", style: { width: `${Math.round(width * 10) / 10}%` } })),
      h("span", { class: "co-bar-pct", "aria-hidden": "true" }, `${Math.round(width)}%`));
  }

  // One row per distinct move; the tags say who chose it (you, the engine, the master).
  function compareRows(context, answers, options) {
    const lang = options.lang;
    const rows = [];
    const byMove = new Map();
    const bars = options.bars;
    const put = (uci, entry) => {
      const key = uci || `none-${rows.length}`;
      if (byMove.has(key)) {
        const found = byMove.get(key);
        found.tags.push(entry.tag);
        return;
      }
      const row = Object.assign({ tags: [entry.tag] }, entry);
      byMove.set(key, row);
      rows.push(row);
    };
    answers.forEach((answer, index) => {
      if (!answer || !answer.uci) return;
      const isBest = playedBest(context, answer);
      const bar = options.duel ? winBars(context, answer) : bars;
      put(answer.uci, {
        tag: { kind: options.duel ? `p${index + 1}` : "user", text: options.duel ? answer.name : t("coach.you", {}, lang) },
        san: showSan(answer.san, lang),
        evalText: isBest ? formatEval(context.best.score, lang) : Number.isFinite(answer.userScore) ? formatEval(answer.userScore, lang) : "",
        pct: isBest ? bar.best : bar.user,
      });
    });
    if (context.best && context.best.uci) {
      put(context.best.uci, { tag: { kind: "best", text: t("coach.best", {}, lang) }, san: showSan(context.best.san, lang), evalText: formatEval(context.best.score, lang), pct: bars.best });
    }
    if (context.master && context.master.uci) {
      const name = context.masterName || "";
      put(context.master.uci, {
        tag: { kind: "master", text: name ? t("coach.masterMove", { name }, lang) : t("coach.gameMove", {}, lang) },
        san: showSan(context.master.san, lang),
        evalText: Number.isFinite(context.master.score) ? formatEval(context.master.score, lang) : context.master.evalText || "",
        pct: bars.master,
      });
    }
    return rows;
  }

  // The historical note of a classic comes in both languages ({ es, en }).
  function noteText(note, lang) {
    if (!note) return "";
    if (typeof note === "string") return note;
    return String(note[lang] || note.es || note.en || "");
  }

  function compareCard(context, answers, options) {
    const lang = options.lang;
    const bars = winBars(context, answers[answers.length - 1]);
    const rows = compareRows(context, answers, Object.assign({}, options, { bars }));
    const items = rows.map((row) => h("li", { class: "co-cmp-row", "data-kinds": row.tags.map((tag) => tag.kind).join(" ") },
      h("div", { class: "co-cmp-head" },
        h("strong", { class: "co-cmp-san" }, row.san || "-"),
        row.evalText ? h("span", { class: "co-cmp-eval", title: t("coach.eval", { eval: row.evalText }, lang) }, row.evalText) : null),
      h("div", { class: "co-cmp-tags" }, row.tags.map((tag) => h("span", { class: "co-tag", "data-kind": tag.kind }, tag.text))),
      Number.isFinite(row.pct) ? winBar(row.pct, row.tags[0].kind, lang) : null));
    const foot = [];
    const first = answers[0];
    // The note is computed from the same rounded numbers the bars print, so the arithmetic on screen always adds up
    // (rounding the gap of the unrounded values used to disagree by one point in a quarter of the answers).
    const bestPct = bars.best === null ? null : Math.round(clamp(bars.best, 0, 100));
    const userPct = bars.user === null ? null : Math.round(clamp(bars.user, 0, 100));
    const gapPts = bestPct !== null && userPct !== null ? bestPct - userPct : 0;
    if (!options.duel && first && first.uci && playedBest(context, first)) {
      foot.push(h("p", { class: "co-cmp-note co-cmp-good" }, icon("check", 15), h("span", null, t("coach.cmp.same", {}, lang))));
    } else if (!options.duel && first && first.uci && first.assessment && first.assessment.isBest) {
      // Inside the tolerance band: another move is listed first, but this one is just as good.
      foot.push(h("p", { class: "co-cmp-note co-cmp-good" }, icon("check", 15), h("span", null, t("coach.cmp.equivalent", {}, lang))));
    } else if (!options.duel && first && first.uci && gapPts >= 1) {
      foot.push(h("p", { class: "co-cmp-note" }, t("coach.loss", { best: bestPct, user: userPct, pts: unitText("pp", gapPts, lang) }, lang)));
    }
    if (context.master && Number.isFinite(context.master.rank)) {
      foot.push(h("p", { class: "co-cmp-note" }, t(context.masterName ? "coach.cmp.master.rank" : "coach.cmp.game.rank", { name: context.masterName || "", rank: rankText(context.master.rank, lang) }, lang)));
    } else if (context.master && context.master.uci && context.master.uci !== (context.best && context.best.uci)) {
      foot.push(h("p", { class: "co-cmp-note" }, t(context.masterName ? "coach.cmp.master.out" : "coach.cmp.game.out", { name: context.masterName || "" }, lang)));
    }
    const note = noteText(context.masterNote, lang);
    if (note) {
      foot.push(h("figure", { class: "co-quote" }, h("figcaption", { class: "co-quote-cap" }, t("coach.section.note", {}, lang)), h("blockquote", null, note)));
    }
    return card([
      eyebrow(t("coach.section.compare", {}, lang), "target"),
      h("p", { class: "co-caption" }, t("coach.winChance", {}, lang)),
      h("ul", { class: "co-cmp" }, items),
      foot,
      helpBlock("co-help-cmp", ["coach.help.winChance", "coach.help.eval"], lang),
    ], "co-compare");
  }

  function insightsCard(context, answer, lang) {
    if (!answer) return null;
    const list = insightTexts(answer, lang);
    let body;
    if (list.length) {
      body = h("ul", { class: "co-insights" }, list.map((entry) => h("li", { class: "co-insight" },
        h("span", { class: "co-insight-icon", "aria-hidden": "true" }, insightIcon(entry.tag, 18)),
        h("div", { class: "co-insight-body" },
          h("p", { class: "co-insight-text" }, entry.text),
          h("span", { class: "co-insight-tag" }, tagLabel(entry.tag, lang))))));
    } else if (answer.uci && playedBest(context, answer)) {
      body = h("p", { class: "co-empty" }, t("coach.insight.perfect", {}, lang));
    } else if (answer.uci && answer.assessment && (answer.assessment.qualityCode === "perfect" || answer.assessment.isBest)) {
      body = h("p", { class: "co-empty" }, t("coach.insight.solid", {}, lang));
    } else {
      body = h("p", { class: "co-empty" }, t("coach.insight.unknown", { best: context.best && context.best.san ? showSan(context.best.san, lang) : "-" }, lang));
    }
    // What kind of position this was (sacrifice, only move...): told now that the answer is in, not before.
    const theme = themeInfo(context.classicKind, lang);
    const parts = [eyebrow(t("coach.section.why", {}, lang), "lightbulb"), body];
    if (theme) {
      parts.push(h("div", { class: "co-theme" },
        h("p", { class: "co-theme-head" }, h("span", { class: "co-theme-label" }, t("coach.theme.title", {}, lang)), plainChip(theme.label, "gold")),
        theme.hint ? h("p", { class: "co-theme-hint" }, theme.hint) : null));
    }
    return card(parts, "co-why");
  }

  // ---------- Concepts ----------

  function openConcept(id, extra) {
    const concepts = L().Concepts;
    const kit = ui();
    if (!concepts || typeof kit.modal !== "function") return null;
    const lang = langOf(extra && extra.lang);
    let text = null;
    let concept = null;
    try {
      concept = concepts.get(id);
      text = concepts.text(id, lang);
    } catch (error) {
      return null;
    }
    if (!concept || !text) return null;
    const uci = concept.bestUci || "";
    // A window that is wide and short (a phone on its side) puts the board beside the words and shrinks it,
    // so the lesson fits without scrolling; anywhere else the board is on top at full size.
    const height = Number(root.innerHeight) || 800;
    const width = Number(root.innerWidth) || 1280;
    const beside = width > 640 && height < 560;
    // On a short phone (320x568) a 300px board would leave one line of the lesson visible: it gives up size first.
    const boardSize = beside ? Math.max(140, Math.min(300, height - 230)) : Math.max(180, Math.min(300, height - 360, width - 64));
    const board = typeof kit.miniBoard === "function"
      ? kit.miniBoard(concept.fen, {
        size: boardSize, orientation: concept.fen && concept.fen.split(" ")[1] === "b" ? "b" : "w", coords: !beside,
        arrows: roundArrows(uci, null), label: t("coach.concept.example", { title: text.title }, lang),
      })
      : null;
    const handle = kit.modal({
      title: text.title,
      size: "md",
      body: [h("div", { class: cls("co-concept-body", beside && "is-beside") }, board ? h("div", { class: "co-concept-board" }, board) : null, h("p", { class: "co-concept-text" }, text.body))],
      actions: [{ label: t("coach.concept.close", {}, lang), kind: "primary", autofocus: true }],
    });
    // A lesson taller than the window scrolls inside the dialog: a keyboard has to be able to reach the rest.
    try {
      const scroller = handle && handle.el && typeof handle.el.querySelector === "function" ? handle.el.querySelector(".modal-body") : null;
      if (scroller && scroller.scrollHeight > scroller.clientHeight + 1) {
        scroller.setAttribute("tabindex", "0");
        scroller.setAttribute("role", "region");
        scroller.setAttribute("aria-label", text.title);
      }
    } catch (error) {
      // the dialog works without it
    }
    return handle;
  }

  function conceptsRow(answer, lang) {
    const ids = answer && answer.insights && Array.isArray(answer.insights.conceptIds) ? answer.insights.conceptIds.slice(0, 3) : [];
    const concepts = L().Concepts;
    if (!ids.length || !concepts) return null;
    const chips = [];
    ids.forEach((id) => {
      let text = null;
      try {
        text = concepts.text(id, lang);
      } catch (error) {
        text = null;
      }
      if (!text) return;
      chips.push(h("button", {
        type: "button",
        class: "chip co-concept",
        "aria-label": t("coach.concept.aria", { title: text.title }, lang),
        onclick: () => openConcept(id, { lang }),
      }, icon("book", 14), text.title));
    });
    if (!chips.length) return null;
    return h("section", { class: "co-concepts", "aria-label": t("coach.section.concepts", {}, lang) },
      h("p", { class: "co-eyebrow" }, icon("book", 14), h("span", null, t("coach.section.concepts", {}, lang))),
      h("div", { class: "co-concept-chips" }, chips));
  }

  // ---------- Engine lines and the stepper ----------

  function linesCard(context, lang, options) {
    const lines = Array.isArray(context.lines) ? context.lines.filter((line) => line && (line.san || line.uci)) : [];
    if (!lines.length) return null;
    const api = options || {};
    const engine = context.engine || {};
    const engineName = t(engine.source === "local" ? "coach.lines.engine.local" : "coach.lines.engine.stockfish", {}, lang);
    const caption = engine.depth ? t("coach.lines.caption", { engine: engineName, depth: engine.depth }, lang) : engineName;
    const list = h("ol", { class: "co-line-list" });
    const state = { line: api.pv && Number.isInteger(api.pv.line) ? api.pv.line : -1, ply: api.pv && Number.isInteger(api.pv.ply) ? api.pv.ply : 0 };
    const views = [];

    const paint = () => {
      views.forEach((view, index) => {
        const selected = index === state.line;
        view.button.setAttribute("aria-pressed", selected ? "true" : "false");
        view.button.classList.toggle("is-selected", selected);
        view.stepper.hidden = !selected;
        if (selected) {
          const total = view.tokens.length;
          view.pos.textContent = state.ply > 0 ? t("coach.step.pos", { n: state.ply, total }, lang) : t("coach.step.start", {}, lang);
          view.tokenButtons.forEach((tok, i) => {
            if (i + 1 === state.ply) tok.setAttribute("aria-current", "step");
            else tok.removeAttribute("aria-current");
          });
          view.controls.first.disabled = state.ply <= 0;
          view.controls.prev.disabled = state.ply <= 0;
          view.controls.next.disabled = state.ply >= total;
          view.controls.last.disabled = state.ply >= total;
        }
      });
    };
    const go = (index, ply) => {
      const view = views[index];
      if (!view) return;
      state.line = index;
      state.ply = clamp(ply, 0, view.tokens.length);
      paint();
      if (typeof api.onStep === "function") api.onStep(index, state.ply);
    };

    lines.forEach((line, index) => {
      const sans = Array.isArray(line.pvSan) && line.pvSan.length ? line.pvSan : [line.san];
      const tokens = pvTokens(context.fen, sans);
      const evalText = Number.isFinite(line.score) ? formatEval(line.score, lang) : line.evalText || "";
      const marks = [];
      if (line.isBest) marks.push(pill(t("coach.lines.best", {}, lang), "best"));
      if (line.isUser) marks.push(pill(t("coach.lines.you", {}, lang), "user"));
      if (line.isMaster) marks.push(pill(context.masterName || t("coach.lines.master", {}, lang), "master"));
      const pvText = tokens.slice(0, 6).map((tok) => (tok.number ? `${tok.number} ${showSan(tok.san, lang)}` : showSan(tok.san, lang))).join(" ");
      const button = h("button", {
        type: "button",
        class: "co-line",
        "aria-pressed": "false",
        "aria-label": t("coach.lines.aria", { rank: line.rank || index + 1, san: speakSan(line.san || "", lang), eval: evalText }, lang),
        onclick: () => go(index, state.line === index ? state.ply : Math.min(1, tokens.length)),
      },
      h("span", { class: "co-line-rank", "aria-hidden": "true" }, String(line.rank || index + 1)),
      h("span", { class: "co-line-move" }, line.san ? showSan(line.san, lang) : line.uci),
      h("span", { class: "co-line-eval" }, evalText),
      marks.length ? h("span", { class: "co-line-marks" }, marks) : null,
      h("span", { class: "co-line-pv" }, pvText));

      const controls = {};
      const makeControl = (name, label, target) => {
        controls[name] = h("button", {
          type: "button",
          class: "btn btn-secondary btn-icon co-step-btn",
          "aria-label": label,
          onclick: () => go(index, target()),
        }, svgIcon(STEP_ICONS[name], 18));
        return controls[name];
      };
      const pos = h("span", { class: "co-step-pos", role: "status", "aria-live": "polite" });
      const tokenButtons = tokens.map((tok) => h("button", {
        type: "button",
        class: "co-tok",
        "aria-label": t("coach.step.token", { san: speakSan(tok.san, lang) }, lang),
        onclick: () => go(index, tok.ply),
      }, tok.number ? h("span", { class: "co-tok-n" }, tok.number) : null, showSan(tok.san, lang)));
      const stepper = h("div", { class: "co-stepper", role: "group", "aria-label": t("coach.step.label", { rank: line.rank || index + 1 }, lang), hidden: true },
        h("div", { class: "co-step-ctrl" },
          makeControl("first", t("coach.step.first", {}, lang), () => 0),
          makeControl("prev", t("coach.step.prev", {}, lang), () => state.ply - 1),
          pos,
          makeControl("next", t("coach.step.next", {}, lang), () => state.ply + 1),
          makeControl("last", t("coach.step.last", {}, lang), () => tokens.length)),
        h("div", { class: "co-step-san" }, tokenButtons),
        h("p", { class: "co-step-tip" }, t("coach.step.tip", {}, lang)));
      views.push({ button, stepper, tokens, pos, controls, tokenButtons });
      list.appendChild(h("li", { class: "co-line-item" }, button, stepper));
    });
    paint();
    return card([
      eyebrow(t("coach.section.lines", {}, lang), "columns"),
      h("p", { class: "co-caption" }, `${caption} · ${t("coach.lines.hint", {}, lang)}`),
      list,
      helpBlock("co-help-lines", ["coach.help.engine"], lang),
    ], "co-lines");
  }

  // ---------- Rewards and the curiosity ----------

  function rewardsCard(rewards, lang) {
    const model = rewardModel(rewards, Date.now(), lang);
    if (!model) return null;
    const kit = ui();
    const parts = [eyebrow(t("coach.section.progress", {}, lang), "trophy")];
    const row = [];
    if (model.xp > 0) row.push(h("span", { class: "co-xp" }, icon("star", 16), t("coach.chip.xp", { xp: model.xp }, lang)));
    if (model.level && typeof kit.levelBadge === "function") {
      try {
        row.push(kit.levelBadge(model.level));
      } catch (error) {
        // the level is decoration
      }
    }
    if (row.length) parts.push(h("div", { class: "co-xp-row" }, row));
    if (model.level && typeof kit.progress === "function") {
      const level = model.level;
      const text = level.max ? t("coach.level.max", {}, lang) : t("coach.level.next", { xp: level.xpToNext }, lang);
      try {
        parts.push(h("div", { class: "co-level" }, kit.progress(level.progress, { size: "sm" }), h("p", { class: "co-caption" }, text)));
      } catch (error) {
        // ignore
      }
    }
    if (model.levelUp) parts.push(h("p", { class: "co-note co-note-gold", role: "status" }, icon("sparkles", 16), h("span", null, t("coach.level.up", {}, lang))));
    if (model.card) {
      parts.push(h("p", { class: cls("co-note", `co-note-${model.card.tone}`) }, icon(model.card.tone === "warn" ? "refresh" : "book", 16), h("span", null, model.card.text)));
    }
    model.unlocked.forEach((entry) => {
      parts.push(h("div", { class: "co-achievement" },
        h("span", { class: "co-achievement-glyph", "aria-hidden": "true" }, entry.glyph || "★"),
        h("div", null,
          h("p", { class: "co-achievement-title" }, t("coach.achievement", {}, lang), ": ", h("strong", null, entry.name)),
          entry.description ? h("p", { class: "co-caption" }, entry.description) : null)));
    });
    return card(parts, "co-rewards");
  }

  function factCard(fact, lang) {
    if (!fact || !fact.text) return null;
    const facts = L().Facts;
    let text = "";
    try {
      text = facts && typeof facts.text === "function" ? facts.text(fact, lang) : fact.text[lang] || fact.text.es || "";
    } catch (error) {
      text = fact.text[lang] || "";
    }
    if (!text) return null;
    let category = "";
    let year = "";
    try {
      if (facts && fact.cat && typeof facts.categoryLabel === "function") category = facts.categoryLabel(fact.cat, lang);
      if (facts && typeof facts.formatYear === "function") year = facts.formatYear(fact, lang);
    } catch (error) {
      category = "";
    }
    return h("aside", { class: "co-card co-fact", "aria-label": t("coach.section.fact", {}, lang) },
      h("p", { class: "co-eyebrow co-eyebrow-gold" }, icon("sparkles", 14), h("span", null, t("coach.section.fact", {}, lang))),
      h("p", { class: "co-fact-text" }, text),
      category || year ? h("p", { class: "co-fact-meta" }, [category, year].filter(Boolean).join(" · ")) : null);
  }

  function renderRound(el, context, api) {
    if (!el || !getDoc() || !context) return;
    const opts = api || {};
    const lang = langOf(opts.lang);
    const answer = answerOf(context, 0);
    if (!answer) return;
    clear(el);
    [
      hero(context, answer, lang, { rewards: context.rewards && context.rewards[0], gaugeSize: opts.gaugeSize }),
      ...notesFor(context, answer, lang),
      compareCard(context, [answer], { lang }),
      insightsCard(context, answer, lang),
      conceptsRow(answer, lang),
      linesCard(context, lang, opts),
      rewardsCard(context.rewards && context.rewards[0], lang),
      factCard(context.fact, lang),
    ].filter(Boolean).forEach((node) => el.appendChild(node));
  }

  // ---------- DOM: the result of a duel round ----------

  function playerCard(context, answer, index, winner, lang) {
    const assessment = answer.assessment || {};
    const info = qualityInfo(answer.uci ? assessment.qualityCode : "no_move", lang);
    const points = Number.isFinite(assessment.points) ? assessment.points : 0;
    const max = Number.isFinite(assessment.maxPoints) ? assessment.maxPoints : 10;
    const isWinner = winner === index;
    const insight = insightTexts(answer, lang)[0];
    const reward = rewardModel(context.rewards && context.rewards[index], Date.now(), lang);
    const initials = (ui().initialsOf ? ui().initialsOf(answer.name) : String(answer.name || "?").slice(0, 2)).toUpperCase();
    return h("li", { class: cls("co-player", isWinner && "is-winner"), "data-player": String(index + 1), "data-q": info.code },
      isWinner ? h("span", { class: "co-player-crown" }, icon("trophy", 13), t("coach.duel.winnerTag", {}, lang)) : null,
      h("div", { class: "co-player-head" },
        h("span", { class: "co-player-avatar", "aria-hidden": "true" }, initials),
        h("h3", { class: "co-player-name", title: answer.name }, answer.name)),
      h("div", { class: "co-player-gauge" }, gaugeNode(points, max, 84, info.tone, "")),
      h("p", { class: "co-player-q" }, h("span", { class: "co-glyph", "aria-hidden": "true" }, info.glyph), h("span", null, info.label)),
      h("p", { class: "co-player-move" }, answer.uci ? showSan(answer.san, lang) : t("coach.duel.noMove", {}, lang)),
      insight ? h("p", { class: "co-player-why" }, insight.text) : null,
      reward && reward.xp > 0 ? h("p", { class: "co-player-xp" }, t("coach.chip.xp", { xp: reward.xp }, lang)) : null,
      // Celebrations belong to the card of the player who earned them (a toast over the play screen would hide the verdict).
      reward && reward.levelUp ? h("p", { class: "co-player-new" }, icon("sparkles", 14), h("span", null, t("coach.level.up", {}, lang))) : null,
      ...(reward ? reward.unlocked : []).map((entry) => h("p", { class: "co-player-new" }, icon("star", 14), h("span", null, `${t("coach.achievement", {}, lang)}: ${entry.name}`))));
  }

  function renderDuel(el, context, api) {
    if (!el || !getDoc() || !context || !Array.isArray(context.answers) || context.answers.length < 2) return;
    const opts = api || {};
    const lang = langOf(opts.lang);
    const [first, second] = context.answers;
    const p1 = Number.isFinite(first.assessment && first.assessment.points) ? first.assessment.points : 0;
    const p2 = Number.isFinite(second.assessment && second.assessment.points) ? second.assessment.points : 0;
    const winner = p1 > p2 ? 0 : p2 > p1 ? 1 : -1;
    clear(el);
    const banner = winner === -1 ? t("coach.duel.tie", {}, lang) : t("coach.duel.winner", { name: context.answers[winner].name }, lang);
    const nodes = [
      h("section", { class: cls("co-duel-banner", winner === -1 && "is-tie") },
        h("h2", { class: "co-duel-banner-title", tabindex: "-1", "data-focus": "" }, icon("trophy", 20), h("span", null, banner)),
        opts.matchText ? h("p", { class: "co-duel-banner-sub" }, opts.matchText) : null),
      h("ol", { class: "co-players", "aria-label": t("coach.section.duel", {}, lang) }, [playerCard(context, first, 0, winner, lang), playerCard(context, second, 1, winner, lang)]),
      ...notesFor(context, second, lang),
      compareCard(context, [first, second], { lang, duel: true }),
      linesCard(context, lang, opts),
      factCard(context.fact, lang),
    ];
    nodes.filter(Boolean).forEach((node) => el.appendChild(node));
  }

  // ---------- DOM: progress dots ----------

  function renderDots(el, model) {
    if (!el || !getDoc() || !model) return;
    clear(el);
    el.classList.toggle("is-dense", Boolean(model.dense));
    if (model.dense) {
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", model.summary);
    } else {
      el.removeAttribute("role");
      el.removeAttribute("aria-label");
    }
    model.items.forEach((item) => {
      const attrs = { class: "co-dot", "data-state": item.state };
      if (item.q) attrs["data-q"] = item.q;
      if (model.dense) el.appendChild(h("li", Object.assign(attrs, { "aria-hidden": "true" })));
      else el.appendChild(h("li", Object.assign(attrs, { title: item.label }), h("span", { class: "co-dot-text" }, item.label)));
    });
  }

  // ---------- DOM: the closing summary ----------

  function formatDuration(ms, lang) {
    const total = Math.max(0, Math.round((Number(ms) || 0) / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    if (minutes >= 60) return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
    return minutes > 0 ? `${minutes} min ${String(seconds).padStart(2, "0")} s` : `${seconds} s`;
  }

  function statBlock(label, value) {
    return h("div", { class: "co-sum-stat" }, h("dt", null, label), h("dd", null, value));
  }

  // The bar and its legend for a list of { code, count, info } segments (one player, or the solo session).
  function segmentsBlock(segments, lang, ariaLabel) {
    const bar = h("div", { class: "co-seg", role: "img", "aria-label": ariaLabel || t("coach.sum.breakdownAria", {}, lang) },
      segments.map((segment) => h("span", { class: "co-seg-part", "data-q": segment.code, style: { flexGrow: String(segment.count) }, title: `${segment.info.label}: ${segment.count}` })));
    const legend = h("ul", { class: "co-legend-list" }, segments.map((segment) => h("li", { class: "co-legend-item", "data-q": segment.code },
      h("span", { class: "co-legend-swatch", "aria-hidden": "true" }),
      h("span", { class: "co-glyph", "aria-hidden": "true" }, segment.info.glyph),
      h("span", { class: "co-legend-label" }, segment.info.label),
      h("strong", { class: "co-legend-count" }, String(segment.count)))));
    return [bar, legend];
  }

  function breakdownCard(summary, lang) {
    if (!summary.segments.length) return null;
    return card([eyebrow(t("coach.sum.breakdown", {}, lang), "chart"), ...segmentsBlock(summary.segments, lang)], "co-breakdown");
  }

  function summaryRewards(summary, lang) {
    const rewards = summary.rewards;
    const parts = [eyebrow(t("coach.sum.rewards", {}, lang), "trophy")];
    let any = false;
    const kit = ui();
    if (rewards && rewards.xp > 0) {
      any = true;
      const row = [h("span", { class: "co-xp co-xp-big" }, icon("star", 18), t("coach.sum.xp", { xp: rewards.xp }, lang))];
      if (rewards.levelAfter && typeof kit.levelBadge === "function") {
        try {
          row.push(kit.levelBadge(rewards.levelAfter));
        } catch (error) {
          // decoration
        }
      }
      parts.push(h("div", { class: "co-xp-row" }, row));
      if (rewards.levelAfter && typeof kit.progress === "function") {
        const level = rewards.levelAfter;
        try {
          parts.push(h("div", { class: "co-level" }, kit.progress(level.progress, { size: "sm" }), h("p", { class: "co-caption" }, level.max ? t("coach.level.max", {}, lang) : t("coach.level.next", { xp: level.xpToNext }, lang))));
        } catch (error) {
          // decoration
        }
      }
      if (rewards.levelUp) parts.push(h("p", { class: "co-note co-note-gold", role: "status" }, icon("sparkles", 16), h("span", null, t("coach.level.up", {}, lang))));
    }
    if (rewards && rewards.cards > 0) {
      any = true;
      const i18n = L().i18n;
      const key = i18n && typeof i18n.plural === "function" ? i18n.plural(lang, rewards.cards, { one: "coach.sum.cards.one", other: "coach.sum.cards.other" }) : rewards.cards === 1 ? "coach.sum.cards.one" : "coach.sum.cards.other";
      parts.push(h("p", { class: "co-note co-note-info" }, icon("book", 16), h("span", null, t(key, { n: rewards.cards }, lang))));
    }
    if (rewards && Array.isArray(rewards.unlocked) && rewards.unlocked.length) {
      any = true;
      parts.push(h("p", { class: "co-caption co-caption-strong" }, t("coach.sum.achievements", {}, lang)));
      rewards.unlocked.forEach((entry) => {
        parts.push(h("div", { class: "co-achievement" },
          h("span", { class: "co-achievement-glyph", "aria-hidden": "true" }, entry.glyph || "★"),
          h("div", null, h("p", { class: "co-achievement-title" }, h("strong", null, entry.name)), entry.description ? h("p", { class: "co-caption" }, entry.description) : null)));
      });
    }
    if (!any) parts.push(h("p", { class: "co-empty" }, t("coach.sum.noRewards", {}, lang)));
    return card(parts, "co-sum-rewards");
  }

  function positionCard(summary, round, lang, api) {
    const kit = ui();
    const orientation = round.side === "b" ? "b" : "w";
    const duel = summary.mode === "duel" && Array.isArray(round.players) && round.players.length === 2;
    let board = null;
    if (typeof kit.miniBoard === "function") {
      board = kit.miniBoard(round.fen, {
        size: 148, orientation, arrows: roundArrows(round.bestUci, duel ? null : round.userUci),
        label: t("coach.sum.pos", { n: round.index + 1 }, lang),
      });
    }
    const info = qualityInfo(round.quality, lang);
    const label = t("coach.sum.open", { n: round.index + 1 }, lang);
    const foot = duel
      ? round.players.map((player) => h("span", { class: "co-pos-duel", "data-q": qualityInfo(player.quality, lang).code },
        h("span", { class: "co-pos-duel-name" }, player.name), h("strong", null, formatNumber(player.points, lang))))
      : [h("span", { class: "co-pos-q", "data-q": info.code }, h("span", { class: "co-glyph", "aria-hidden": "true" }, info.glyph), h("span", null, info.label)),
        h("strong", { class: "co-pos-pts" }, t("coach.sum.pts", { points: formatNumber(round.points, lang) }, lang))];
    return h("li", { class: "co-pos-item" },
      h("button", { type: "button", class: "co-pos", "aria-label": `${label}. ${duel ? "" : `${info.label}, ${unitText("points", round.points, lang)}`}`.trim(), onclick: () => { if (api && typeof api.onOpenRound === "function") api.onOpenRound(round.index); } },
        board ? h("span", { class: "co-pos-board" }, board) : null,
        h("span", { class: "co-pos-n" }, String(round.index + 1)),
        h("span", { class: "co-pos-foot" }, foot)));
  }

  // One player of a duel: their own points, accuracy, hits, how their moves went, and what they earned.
  function duelistCard(summary, side, lang) {
    const info = summary.duel.players[side];
    const winner = summary.duel.winner === side;
    const max = Math.max(1, summary.maxPoints / 2);
    const earned = summary.rewards && Array.isArray(summary.rewards.players) ? summary.rewards.players[side] : null;
    const unlocked = earned && Array.isArray(earned.unlocked) ? earned.unlocked.filter((entry) => entry && entry.name) : [];
    const earnedLines = [];
    if (earned && earned.xp > 0) earnedLines.push(h("p", { class: "co-player-xp" }, t("coach.chip.xp", { xp: earned.xp }, lang)));
    if (unlocked.length) {
      earnedLines.push(h("p", { class: "co-sum-duelnew" }, icon("star", 14), h("span", null, `${t("coach.sum.achievements", {}, lang)}: ${unlocked.map((entry) => entry.name).join(", ")}`)));
    }
    return h("li", { class: cls("co-sum-duelist", winner && "is-winner"), "data-player": String(side + 1) },
      winner ? h("span", { class: "co-player-crown" }, icon("trophy", 13), t("coach.duel.winnerTag", {}, lang)) : null,
      h("h3", { class: "co-sum-duelname", title: info.name }, info.name),
      h("div", { class: "co-sum-duelgauge" }, gaugeNode(info.score, max, 104, winner ? "gold" : "good", "")),
      h("p", { class: "co-caption" }, t("coach.sum.duelAcc", { acc: formatNumber(info.accuracy, lang, 0) }, lang)),
      h("p", { class: "co-caption" }, hitsText(info.hits, info.total, lang)),
      info.segments.length ? h("div", { class: "co-sum-duelmix" }, ...segmentsBlock(info.segments, lang, `${info.name}: ${t("coach.sum.breakdownAria", {}, lang)}`)) : null,
      ...earnedLines);
  }

  function renderSummary(el, summary, api) {
    if (!el || !getDoc() || !summary) return;
    const opts = api || {};
    const lang = langOf(summary.lang || opts.lang);
    clear(el);
    const duel = summary.mode === "duel" && summary.duel;
    if (el.classList && typeof el.classList.toggle === "function") el.classList.toggle("co-summary-duel", Boolean(duel));
    const gaugeValue = summary.accuracy;
    const heroCopy = [
      h("p", { class: "co-eyebrow co-eyebrow-gold" }, t(duel ? "coach.sum.titleDuel" : "coach.sum.title", {}, lang)),
      h("h2", { class: "co-sum-title", tabindex: "-1", "data-focus": "" }, duel
        ? (summary.duel.winner === -1 ? t("coach.sum.draw", {}, lang) : t("coach.sum.winner", { name: summary.duel.names[summary.duel.winner] }, lang))
        : t(`coach.sum.tone.${summary.tone}`, {}, lang)),
      summary.title ? h("p", { class: "co-sum-sub" }, summary.title) : null,
    ];
    // A duel shows no merged points or hits (they belong to two people): the positions played and the time, then one card each.
    const stats = h("dl", { class: "co-sum-stats" },
      duel ? null : statBlock(t("coach.sum.points", {}, lang), t("coach.sum.of", { points: formatNumber(summary.points, lang), max: formatNumber(summary.maxPoints, lang, 0) }, lang)),
      statBlock(t("coach.sum.positions", {}, lang), duel ? String(summary.positions) : hitsText(summary.hits, summary.positions, lang)),
      summary.durationMs > 0 ? statBlock(t("coach.sum.time", {}, lang), formatDuration(summary.durationMs, lang)) : null);
    const heroVisual = duel ? null : h("div", { class: "co-sum-gauge" }, gaugeNode(gaugeValue, 100, 150, summary.gaugeTone, t("coach.sum.accuracy", {}, lang)));
    const hero = h("section", { class: cls("co-sum-hero", duel && "co-sum-hero-duel"), "data-tone": summary.tone }, heroVisual, h("div", { class: "co-sum-copy" }, heroCopy, stats));
    const note = summary.noMorePositions ? h("p", { class: "co-note co-note-info", role: "note" }, icon("info", 16), h("span", null, t("coach.sum.noMore", {}, lang))) : null;
    const players = duel ? h("ol", { class: "co-sum-duel", "aria-label": t("coach.section.duel", {}, lang) }, [0, 1].map((side) => duelistCard(summary, side, lang))) : null;
    // Columns on a wide screen: the verdict and the mix of moves on the left, what the session earned on the right (the tall
    // one: every achievement is listed), and the positions as a row of their own under both: no half-empty column. On a
    // phone they simply stack in this order. A duel is not recorded as progress of one person: no experience card, no merged mix.
    const main = h("div", { class: "co-sum-col co-sum-main" }, [hero, note, players, duel ? null : breakdownCard(summary, lang)].filter(Boolean));
    const aside = duel ? null : h("div", { class: "co-sum-col co-sum-aside" }, [summaryRewards(summary, lang)]);
    const grid = summary.rounds.length
      ? h("section", { class: "co-sum-positions", "aria-label": t("coach.sum.list", {}, lang) },
        eyebrow(t("coach.sum.list", {}, lang), "columns"),
        h("ul", { class: "co-pos-grid" }, summary.rounds.map((round) => positionCard(summary, round, lang, opts))))
      : null;
    el.appendChild(main);
    if (aside && aside.children.length) el.appendChild(aside);
    if (grid) el.appendChild(grid);
  }

  // The buttons of the footer: play again / rematch, review, share, home. The static
  // "home" button of index.html stays (app.js binds it); the rest is rebuilt each time.
  function renderSummaryActions(el, summary, api) {
    if (!el || !getDoc() || !summary) return;
    const opts = api || {};
    const lang = langOf(summary.lang || opts.lang);
    const kit = ui();
    Array.from(el.querySelectorAll ? el.querySelectorAll("[data-co]") : []).forEach((node) => node.remove());
    const home = typeof el.querySelector === "function" ? el.querySelector("#summary-menu-btn") : null;
    const make = (label, options) => {
      if (typeof kit.button !== "function") return null;
      const node = kit.button(label, options);
      if (node && node.setAttribute) node.setAttribute("data-co", "");
      return node;
    };
    const buttons = [];
    if (opts.canReplay !== false) {
      buttons.push(make(t(summary.mode === "duel" ? "coach.sum.rematch" : "coach.sum.playAgain", {}, lang), {
        kind: "primary", size: "lg", block: true, icon: "refresh", id: "summary-again-btn", onClick: () => opts.onPlayAgain && opts.onPlayAgain(),
      }));
    }
    const secondary = [];
    const reviewers = summary.mode === "duel" && Array.isArray(opts.reviewPlayers) ? opts.reviewPlayers.filter((player) => player && player.name) : null;
    if (reviewers) {
      // A duel: each profile's notebook is reviewed on its own (the guest has none), never "the active profile's" for both.
      reviewers.forEach((player, index) => {
        secondary.push(make(t("coach.sum.reviewPlayer", { name: player.name }, lang), {
          kind: "secondary", icon: "book", id: `summary-review-btn-${index + 1}`, onClick: () => opts.onReview && opts.onReview(player.profileId),
        }));
      });
    } else if (opts.canReview) {
      secondary.push(make(t("coach.sum.review", {}, lang), { kind: "secondary", icon: "book", id: "summary-review-btn", onClick: () => opts.onReview && opts.onReview() }));
    }
    secondary.push(make(t("coach.sum.share", {}, lang), { kind: "secondary", icon: "external", id: "summary-share-btn", onClick: () => opts.onShare && opts.onShare() }));
    buttons.filter(Boolean).forEach((node) => el.insertBefore(node, home));
    if (secondary.filter(Boolean).length) {
      const row = h("div", { class: "co-summary-row", "data-co": "" }, secondary.filter(Boolean));
      el.insertBefore(row, home);
    }
    // On two columns (a phone) the play-again button takes a row of its own, and the home button takes the
    // last one when the others would leave it alone in a corner: the stylesheet reads this.
    const others = secondary.filter(Boolean).length + (home ? 1 : 0);
    el.setAttribute("data-tail", others % 2 === 1 ? "odd" : "even");
  }

  return {
    TEXT,
    QUALITY_CODES: QUALITY_CODES.slice(),
    qualityInfo,
    formatNumber,
    showSan,
    speakSan,
    insightIconFor,
    insightIcon,
    verdictKey,
    verdictText,
    winBars,
    safeGameUrl,
    positionModel,
    dotsModel,
    rewardModel,
    summaryModel,
    shareText,
    pvTokens,
    roundArrows,
    renderThinking,
    renderTurn,
    renderEvaluating,
    renderRound,
    renderDuel,
    renderDots,
    renderSummary,
    renderSummaryActions,
    openConcept,
  };
});
