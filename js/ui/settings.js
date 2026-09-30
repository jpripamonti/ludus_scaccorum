// Screen "settings": every setting of Ludus.Settings, drawn from its schema, plus the pieces that need
// more than a control:
//   Board          a picker of miniature boards (one per theme) and a larger live preview that follows
//                  coordinates, last move and legal-move dots
//   How the best   the owner asked for this to be configurable: engine strength (with the wait it means),
//   move is        engine lines, scoring model, strictness, what counts as the best move and its tolerance,
//   decided        and a LIVE PREVIEW table that runs Ludus.Scoring.assess on canned example lines with the
//                  current settings, so a person sees what each option does to points and verdicts
//   Clock & help  timed / untimed with presets, hints and what they cost, how sensitive own-game mistake
//                  detection is (in centipawns, explained)
//   Sound          volume and a test button per Ludus.Audio.names, vibration
//   Accessibility  text size, contrast, motion
// plus a "Current setup" chip row, a per-section "Reset" (with undo) and a global "Reset all" (with confirm).
// Contract: docs/ARCHITECTURE.md sections 10, 15 and 20; styles in css/settings.css (prefix .settings-).
//
//   Ludus.Screens.settings.mount(el)    el = #screen-settings. Idempotent and cheap (nothing is drawn until show()).
//   Ludus.Screens.settings.show(params) params.section = board | judge | play | sound | access scrolls there.
//   Ludus.Screens.settings.hide()       nothing keeps running while it is hidden.
//   Ludus.Screens.settings.render()     rebuilds from the current settings (also on language:changed).
//   Ludus.Screens.settings.titleKey     "settings.title", the i18n key of document.title.
//
// Rendering is generic: every entry of Ludus.Settings.schema gets a control by its type (switch, choice
// tiles, select, slider, number), labelled with its labelKey / hintKey and hidden while its showWhen is
// false. A schema entry this file has never heard of therefore still appears, in an "Other settings"
// section. Changes go straight to Settings.set (live), and a "settings:changed" listener repaints the
// controls IN PLACE (never a rebuild), so focus and a slider being dragged are never lost. Built with
// Ludus.util.h only. Pure helpers are exported under `helpers` for scripts/tests/settings-ui.test.js.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Screens = root.Ludus.Screens || {};
  root.Ludus.Screens.settings = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const L = () => root.Ludus || {};
  const getDoc = () => {
    try {
      return root.document || null;
    } catch (error) {
      return null;
    }
  };

  function h(tag, attrs, ...children) {
    return L().util.h(tag, attrs, ...children);
  }

  function t(key, params) {
    const i18n = L().i18n;
    return i18n && typeof i18n.t === "function" ? i18n.t(key, params) : String(key);
  }

  function lang() {
    const i18n = L().i18n;
    try {
      return i18n && typeof i18n.lang === "function" && i18n.lang() === "en" ? "en" : "es";
    } catch (error) {
      return "es";
    }
  }

  function icon(name, options) {
    const ui = L().ui;
    return ui && typeof ui.icon === "function" ? ui.icon(name, options) : null;
  }

  function logError(...args) {
    if (root.console && typeof root.console.error === "function") root.console.error(...args);
  }

  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const cls = (...names) => names.filter(Boolean).join(" ");
  const NBSP = " ";

  // ---------- Text ----------
  // The label / hint / option texts of every setting are registered by js/settings.js
  // (settings.<path>.label ...); these are the words of the screen around them.

  const TEXT = {
    es: {
      "settings.title": "Ajustes",
      "settings.eyebrow": "Preferencias",
      "settings.heading": "Ajustes",
      "settings.sub": "Todo se guarda en este dispositivo y se aplica al instante, sin botón de guardar.",
      "settings.ui.nav": "Secciones de Ajustes",
      "settings.ui.summary": "Tu configuración actual",
      "settings.ui.summary.empty": "Todavía no hay ajustes para mostrar.",
      "settings.ui.summary.board": "Tablero {theme}",
      "settings.ui.summary.clock": "{seconds} por jugada",
      "settings.ui.summary.untimed": "Sin reloj",
      "settings.ui.summary.engine": "Motor {strength} · {lines}",
      "settings.ui.summary.lines": "{n} líneas",
      "settings.ui.summary.lines.one": "1 línea",
      "settings.ui.summary.scoring": "Puntaje {model} · {strictness}",
      "settings.ui.summary.best": "Mejor jugada: {mode}",
      "settings.ui.summary.best.band": "Mejor jugada: hasta {pct} de margen",
      "settings.ui.summary.hints.on": "Pistas activadas",
      "settings.ui.summary.hints.off": "Sin pistas",
      "settings.ui.summary.sound.on": "Sonido {volume}",
      "settings.ui.summary.sound.off": "Sonido apagado",
      "settings.ui.summary.text": "Texto {scale}",
      "settings.ui.summary.contrast": "alto contraste",
      "settings.ui.summary.motion": "menos movimiento",

      "settings.section.board": "Tablero",
      "settings.section.board.lead": "Elegí el estilo del tablero y cómo se maneja. Lo ves acá mismo, tal cual va a aparecer cuando juegues.",
      "settings.section.judge": "Cómo se decide la mejor jugada",
      "settings.section.judge.lead": "Acá elegís con cuánta profundidad mira el motor y cómo se convierte la distancia a la mejor jugada en puntos. La vista previa te muestra al instante qué hace cada opción.",
      "settings.section.play": "Reloj y ayudas",
      "settings.section.play.lead": "El tiempo que tenés para cada posición, las pistas y qué se considera un error en tus propias partidas.",
      "settings.section.sound": "Sonido y vibración",
      "settings.section.sound.lead": "Efectos cortos que se sintetizan en tu dispositivo, sin descargar nada. Probalos acá.",
      "settings.section.access": "Accesibilidad",
      "settings.section.access.lead": "Texto más grande, más contraste y menos movimiento. Se aplica a toda la app.",
      "settings.section.privacy": "Privacidad",
      "settings.section.privacy.lead": "Lo que esta app guarda en tu navegador cuando practicás con tus propias partidas. No tiene servidor propio: nada de esto se envía a nosotros.",
      "settings.section.more": "Otros ajustes",
      "settings.section.more.lead": "Ajustes que no entran en otra sección.",

      "settings.ui.reset": "Restablecer sección",
      "settings.ui.reset.aria": "Restablecer la sección {section} a sus valores originales",
      "settings.ui.reset.done": "Restablecimos «{section}» a sus valores originales.",
      "settings.ui.reset.undo": "Deshacer",
      "settings.ui.reset.undo.aria": "Deshacer el restablecimiento de «{section}»",
      "settings.ui.reset.dismiss": "Cerrar este aviso",
      "settings.ui.reset.undone": "Volvimos a tus valores anteriores.",
      "settings.ui.reset.nothing": "Esta sección ya tiene sus valores originales.",
      "settings.ui.privacy.keep": "Recordar mis partidas descargadas",
      "settings.ui.privacy.keep.hint": "Guarda en este navegador, por hasta 7 días, las partidas que descargás de Lichess o Chess.com y tu nombre de usuario, para no pedirlas de nuevo. Si lo apagás, se borran ahora y solo quedan mientras tengas abierta esta pestaña. En una computadora compartida conviene apagarlo.",
      "settings.ui.privacy.clear": "Borrar ahora las partidas guardadas",
      "settings.ui.privacy.clear.heading": "Partidas guardadas",
      "settings.ui.privacy.clear.button": "Borrar ahora",
      "settings.ui.privacy.clear.hint": "Borra las partidas descargadas y los nombres de usuario recordados. Tu progreso y tu cuaderno no se tocan.",
      "settings.ui.privacy.clear.title": "¿Borrar las partidas guardadas?",
      "settings.ui.privacy.clear.body": "Se borran de este navegador las partidas que descargaste y los nombres de usuario recordados. Tu progreso, tus perfiles y tu cuaderno no se tocan, y podés volver a descargar tus partidas cuando quieras.",
      "settings.ui.privacy.clear.confirm": "Borrar",
      "settings.ui.privacy.cleared": "Listo: borramos las partidas guardadas y los usuarios recordados.",
      "settings.ui.privacy.off.done": "No vamos a guardar tus partidas descargadas, y borramos las que había.",
      "settings.ui.privacy.on.done": "Volvimos a recordar tus partidas descargadas por hasta 7 días.",
      "settings.ui.privacy.error": "No pudimos borrar los datos guardados. Probá de nuevo.",
      "settings.ui.resetAll.heading": "Volver a empezar",
      "settings.ui.resetAll.lead": "Todos los ajustes vuelven a sus valores originales. Tu progreso, tus perfiles y tu cuaderno no se tocan.",
      "settings.ui.resetAll": "Restablecer todos los ajustes",
      "settings.ui.resetAll.title": "¿Restablecer todos los ajustes?",
      "settings.ui.resetAll.body": "Tablero, puntaje, reloj, sonido y accesibilidad vuelven a sus valores originales. Tu progreso y tus perfiles no se tocan.",
      "settings.ui.resetAll.confirm": "Restablecer todo",
      "settings.ui.resetAll.done": "Todos los ajustes volvieron a sus valores originales.",

      "settings.ui.board.previewTitle": "Vista previa",
      "settings.ui.board.previewLabel": "Vista previa del tablero, tema {theme}",
      "settings.ui.board.previewNote": "Así se va a ver tu tablero. Los puntos marcan a dónde puede ir la pieza elegida.",
      "settings.ui.board.themes": "Temas disponibles",
      "settings.ui.board.themeLabel": "Tema {theme}",
      "settings.ui.board.current": "(actual)",

      "settings.ui.judge.flowLabel": "Cómo se puntúa una jugada",
      "settings.ui.judge.flow.1.title": "El motor mira la posición",
      "settings.ui.judge.flow.1.body": "Stockfish busca las mejores jugadas y calcula qué chances de ganar deja cada una.",
      "settings.ui.judge.flow.2.title": "Compara con tu jugada",
      "settings.ui.judge.flow.2.body": "Mide cuántas chances de ganar cedés respecto de la mejor, no solo cuántos peones.",
      "settings.ui.judge.flow.3.title": "La distancia se vuelve puntos",
      "settings.ui.judge.flow.3.body": "De 0 a 10 por posición: cuanto más cerca de la mejor, más puntos.",
      "settings.ui.strength.fast": "Rondas ágiles. El motor piensa unos {s} por posición.",
      "settings.ui.strength.balanced": "Un buen punto medio para casi todos. Unos {s}.",
      "settings.ui.strength.deep": "El juicio más fino, con más espera. Unos {s}.",
      "settings.ui.strength.custom": "Vos elegís el tiempo, justo abajo.",
      "settings.ui.strength.estimate": "El motor piensa entre {lo} y {hi} por posición (menos si la posición ya trae su análisis). Más tiempo hace más fiable la evaluación; no cambia cómo se calculan los puntos.",
      "settings.ui.lines.one": "Con 1 línea el motor no puede reconocer las «jugadas únicas», las que se marcan como excelentes.",
      "settings.ui.lines.many": "Con {n} líneas se comparan más alternativas y se reconocen las jugadas únicas.",
      "settings.ui.desc.scoring.model.precision": "Los puntos bajan de forma suave a medida que tu jugada empeora.",
      "settings.ui.desc.scoring.model.tiers": "Puntos fijos por categoría: 10; 7,5; 5; 2,5 o 0. Más fácil de leer, menos fino.",
      "settings.ui.desc.scoring.strictness.relaxed": "Perdona los desvíos chicos: el mismo error cuesta menos.",
      "settings.ui.desc.scoring.strictness.standard": "El equilibrio recomendado.",
      "settings.ui.desc.scoring.strictness.strict": "Cada centipeón cuenta: los errores cuestan más.",
      "settings.ui.desc.scoring.bestMode.engine": "Solo la primera jugada del motor vale los 10 puntos.",
      "settings.ui.desc.scoring.bestMode.band": "Una jugada prácticamente igual de buena que la mejor también vale 10.",
      "settings.ui.desc.scoring.bestMode.masters": "Además, en las partidas clásicas cuenta la jugada real del maestro si está cerca.",
      "settings.ui.tolerance.now": "Hasta {pct} de chances de ganar, unos {cp} cp en una posición pareja.",
      "settings.ui.rule.title": "Con tus ajustes",
      "settings.ui.rule.engine": "Solo la jugada del motor cuenta como la mejor.",
      "settings.ui.rule.band": "Cuenta como la mejor la jugada del motor y cualquiera que ceda menos de {pct} de chances de ganar (unos {cp} cp).",
      "settings.ui.rule.masters": "Igual que la anterior, y la jugada del maestro también cuenta si cede menos de {master} de chances de ganar.",

      "settings.ui.preview.title": "Vista previa: qué puntos darían",
      "settings.ui.preview.lead": "Jugadas de ejemplo en una posición pareja, puntuadas con tus ajustes de ahora. Cambiá cualquier opción y mirá cómo se mueven los puntos.",
      "settings.ui.preview.caption": "Puntos y veredicto de jugadas de ejemplo con tus ajustes actuales",
      "settings.ui.preview.colCase": "Jugada de ejemplo",
      "settings.ui.preview.colResult": "Puntos y veredicto",
      "settings.ui.preview.points": "{points} de 10 puntos",
      "settings.ui.preview.best": "Cuenta como la mejor",
      "settings.ui.preview.detail.eval": "Mejor jugada {best} · la tuya {you}",
      "settings.ui.preview.detail.only": "Mejor jugada {best} · la siguiente {next}",
      "settings.ui.preview.detail.mate": "La mejor da mate en {n} · la tuya {you}",
      "settings.ui.preview.detail.hint": "Mejor jugada {best}, con una pista de nivel 1",
      "settings.ui.preview.case.best": "La mejor jugada del motor",
      "settings.ui.preview.case.only": "La única jugada que mantiene la ventaja",
      "settings.ui.preview.case.equal": "Una jugada casi igual de buena ({cp} cp menos)",
      "settings.ui.preview.case.close": "Una jugada un poco peor ({cp} cp menos)",
      "settings.ui.preview.case.master": "La jugada del maestro, {cp} cp por debajo del motor",
      "settings.ui.preview.case.inaccuracy": "Una imprecisión ({cp} cp menos)",
      "settings.ui.preview.case.mistake": "Un error claro ({cp} cp menos)",
      "settings.ui.preview.case.blunder": "Un error grave: se pierde una pieza ({cp} cp menos)",
      "settings.ui.preview.case.mate": "No ver un mate forzado",
      "settings.ui.preview.case.hint": "La mejor jugada, tras usar una pista",
      "settings.ui.preview.foot": "El motor solo cambia la fiabilidad de la evaluación, no la escala de puntos. Con una sola línea no se reconocen las jugadas únicas.",
      "settings.ui.preview.unavailable": "La vista previa no está disponible en este momento.",

      "settings.ui.clock.presets": "Duraciones habituales",
      "settings.ui.clock.preset.aria": "{seconds} segundos por jugada",
      "settings.ui.clock.custom": "Otra duración, en segundos",
      "settings.ui.clock.error": "Escribí un número de segundos entre {min} y {max}.",
      "settings.ui.clock.now": "Ahora: {seconds} por jugada. Es tu reloj de siempre: al armar una sesión con tus propias partidas podés elegir otro tiempo solo para esa sesión.",
      "settings.ui.movetime.cap": "Durante una ronda el motor nunca piensa más de {cap} por búsqueda, aunque elijas más tiempo.",
      "settings.ui.clock.untimed": "Sin reloj: pensás todo lo que quieras.",
      "settings.ui.hints.costs": "Cada pista resta puntos: el nivel 1 (marca la pieza) cuesta {l1}, el nivel 2 (marca también el destino) cuesta {l2}, y mostrar la jugada deja la posición en 0 puntos.",
      "settings.ui.hints.off": "Sin pistas no aparece el botón de ayuda mientras jugás.",
      "settings.ui.mistakes.explainTitle": "¿Qué es un centipeón?",
      "settings.ui.mistakes.explain": "Un centipeón (cp) es una centésima de peón: 100 cp son más o menos un peón de ventaja. Cuando el motor revisa tus partidas, una jugada cuenta como error si te hace perder más que este umbral respecto de la mejor.",
      "settings.ui.mistakes.now": "Ahora: se guardan como errores las jugadas que pierden más de {cp} cp (unos {pawns} peones).",
      "settings.ui.desc.clock.mode.timed": "Cada posición tiene un límite de tiempo.",
      "settings.ui.desc.clock.mode.untimed": "Sin límite: pensá todo lo que quieras.",
      "settings.ui.desc.mistakes.sensitivity.high": "Detecta hasta los desvíos chicos: muchas posiciones para estudiar.",
      "settings.ui.desc.mistakes.sensitivity.standard": "Errores de verdad sin demasiado ruido.",
      "settings.ui.desc.mistakes.sensitivity.low": "Solo los errores grandes: menos posiciones, más importantes.",

      "settings.ui.sound.testTitle": "Probar los sonidos",
      "settings.ui.sound.testHint": "Tocá un botón para escucharlo con el volumen actual.",
      "settings.ui.sound.off": "Los sonidos están desactivados. Activalos para probarlos.",
      "settings.ui.sound.unsupported": "Este navegador no puede reproducir sonidos.",
      "settings.ui.sound.played": "Sonido: {name}",
      "settings.ui.sound.name.move": "Jugada",
      "settings.ui.sound.name.capture": "Captura",
      "settings.ui.sound.name.check": "Jaque",
      "settings.ui.sound.name.correct": "Acierto",
      "settings.ui.sound.name.great": "Excelente",
      "settings.ui.sound.name.wrong": "Error",
      "settings.ui.sound.name.levelup": "Subir de nivel",
      "settings.ui.sound.name.click": "Toque",
      "settings.ui.haptics.test": "Probar la vibración",
      "settings.ui.haptics.unsupported": "Este dispositivo no vibra, o el navegador no lo permite.",

      "settings.ui.access.sample": "Aa",
      "settings.ui.access.motion.reduced": "Tu sistema pide menos movimiento, y «Automático» lo respeta.",
      "settings.ui.access.motion.normal": "Tu sistema no pide menos movimiento. Elegí «Reducido» para quitar las animaciones igual.",
    },
    en: {
      "settings.title": "Settings",
      "settings.eyebrow": "Preferences",
      "settings.heading": "Settings",
      "settings.sub": "Everything is saved on this device and applies instantly, with no save button.",
      "settings.ui.nav": "Settings sections",
      "settings.ui.summary": "Your current setup",
      "settings.ui.summary.empty": "There are no settings to show yet.",
      "settings.ui.summary.board": "{theme} board",
      "settings.ui.summary.clock": "{seconds} per move",
      "settings.ui.summary.untimed": "No clock",
      "settings.ui.summary.engine": "{strength} engine · {lines}",
      "settings.ui.summary.lines": "{n} lines",
      "settings.ui.summary.lines.one": "1 line",
      "settings.ui.summary.scoring": "{model} scoring · {strictness}",
      "settings.ui.summary.best": "Best move: {mode}",
      "settings.ui.summary.best.band": "Best move: within {pct}",
      "settings.ui.summary.hints.on": "Hints on",
      "settings.ui.summary.hints.off": "Hints off",
      "settings.ui.summary.sound.on": "Sound {volume}",
      "settings.ui.summary.sound.off": "Sound off",
      "settings.ui.summary.text": "Text {scale}",
      "settings.ui.summary.contrast": "high contrast",
      "settings.ui.summary.motion": "reduced motion",

      "settings.section.board": "Board",
      "settings.section.board.lead": "Pick the board style and how it is handled. You see it right here, just as it will look when you play.",
      "settings.section.judge": "How the best move is decided",
      "settings.section.judge.lead": "Here you choose how deeply the engine looks and how the distance to the best move becomes points. The preview shows what each option does, instantly.",
      "settings.section.play": "Clock and help",
      "settings.section.play.lead": "The time you get for each position, hints, and what counts as a mistake in your own games.",
      "settings.section.sound": "Sound and vibration",
      "settings.section.sound.lead": "Short effects synthesised on your device, nothing to download. Try them here.",
      "settings.section.access": "Accessibility",
      "settings.section.access.lead": "Larger text, more contrast and less motion. It applies to the whole app.",
      "settings.section.privacy": "Privacy",
      "settings.section.privacy.lead": "What this app keeps in your browser when you practise with your own games. It has no server of its own: none of this is sent to us.",
      "settings.section.more": "Other settings",
      "settings.section.more.lead": "Settings that do not fit another section.",

      "settings.ui.reset": "Reset section",
      "settings.ui.reset.aria": "Reset the {section} section to its original values",
      "settings.ui.reset.done": "“{section}” is back to its original values.",
      "settings.ui.reset.undo": "Undo",
      "settings.ui.reset.undo.aria": "Undo the reset of “{section}”",
      "settings.ui.reset.dismiss": "Dismiss this notice",
      "settings.ui.reset.undone": "Your previous values are back.",
      "settings.ui.reset.nothing": "This section already has its original values.",
      "settings.ui.privacy.keep": "Remember my downloaded games",
      "settings.ui.privacy.keep.hint": "Keeps the games you download from Lichess or Chess.com and your username in this browser for up to 7 days, so they are not requested again. If you turn it off they are deleted now and only last while this tab is open. On a shared computer, turning it off is wise.",
      "settings.ui.privacy.clear": "Delete saved games now",
      "settings.ui.privacy.clear.heading": "Saved games",
      "settings.ui.privacy.clear.button": "Delete now",
      "settings.ui.privacy.clear.hint": "Deletes the downloaded games and the remembered usernames. Your progress and notebook are not touched.",
      "settings.ui.privacy.clear.title": "Delete the saved games?",
      "settings.ui.privacy.clear.body": "The games you downloaded and the remembered usernames are deleted from this browser. Your progress, profiles and notebook are not touched, and you can download your games again whenever you like.",
      "settings.ui.privacy.clear.confirm": "Delete",
      "settings.ui.privacy.cleared": "Done: the saved games and remembered usernames are deleted.",
      "settings.ui.privacy.off.done": "Your downloaded games will not be kept, and the ones that were saved are deleted.",
      "settings.ui.privacy.on.done": "Your downloaded games are remembered again for up to 7 days.",
      "settings.ui.privacy.error": "We could not delete the saved data. Try again.",
      "settings.ui.resetAll.heading": "Start over",
      "settings.ui.resetAll.lead": "Every setting goes back to its original value. Your progress, profiles and notebook are not touched.",
      "settings.ui.resetAll": "Reset all settings",
      "settings.ui.resetAll.title": "Reset all settings?",
      "settings.ui.resetAll.body": "Board, scoring, clock, sound and accessibility go back to their original values. Your progress and profiles are not touched.",
      "settings.ui.resetAll.confirm": "Reset everything",
      "settings.ui.resetAll.done": "All settings are back to their original values.",

      "settings.ui.board.previewTitle": "Preview",
      "settings.ui.board.previewLabel": "Board preview, {theme} theme",
      "settings.ui.board.previewNote": "This is how your board will look. Dots show where the selected piece can go.",
      "settings.ui.board.themes": "Available themes",
      "settings.ui.board.themeLabel": "{theme} theme",
      "settings.ui.board.current": "(current)",

      "settings.ui.judge.flowLabel": "How a move is scored",
      "settings.ui.judge.flow.1.title": "The engine studies the position",
      "settings.ui.judge.flow.1.body": "Stockfish finds the best moves and works out the win chance each one leaves.",
      "settings.ui.judge.flow.2.title": "It compares them with your move",
      "settings.ui.judge.flow.2.body": "It measures how much win chance you give up against the best move, not just how many pawns.",
      "settings.ui.judge.flow.3.title": "The distance becomes points",
      "settings.ui.judge.flow.3.body": "0 to 10 per position: the closer to the best move, the more points.",
      "settings.ui.strength.fast": "Quick rounds. The engine thinks about {s} per position.",
      "settings.ui.strength.balanced": "A good middle ground for most people. About {s}.",
      "settings.ui.strength.deep": "The finest judgement, with a longer wait. About {s}.",
      "settings.ui.strength.custom": "You choose the time, right below.",
      "settings.ui.strength.estimate": "The engine thinks {lo} to {hi} per position (less when the position already comes with its analysis). More time makes the evaluation more reliable; it does not change how points are calculated.",
      "settings.ui.lines.one": "With 1 line the engine cannot recognise “only moves”, the ones marked as great.",
      "settings.ui.lines.many": "With {n} lines the engine compares more alternatives and can recognise “only moves”, the ones where a single move clearly beats every other.",
      "settings.ui.desc.scoring.model.precision": "Points fall smoothly as your move gets worse.",
      "settings.ui.desc.scoring.model.tiers": "Fixed points per category: 10, 7.5, 5, 2.5 or 0. Easier to read, less fine.",
      "settings.ui.desc.scoring.strictness.relaxed": "Forgives small slips: the same mistake costs fewer points.",
      "settings.ui.desc.scoring.strictness.standard": "The recommended balance.",
      "settings.ui.desc.scoring.strictness.strict": "Every centipawn counts: mistakes cost more.",
      "settings.ui.desc.scoring.bestMode.engine": "Only the engine's first move is worth the full 10 points.",
      "settings.ui.desc.scoring.bestMode.band": "A move practically as good as the best one is worth 10 too.",
      "settings.ui.desc.scoring.bestMode.masters": "In classic games the master's actual move also counts when it is close.",
      "settings.ui.tolerance.now": "Up to {pct} of win chance, about {cp} cp in an even position.",
      "settings.ui.rule.title": "With your settings",
      "settings.ui.rule.engine": "Only the engine's move counts as the best.",
      "settings.ui.rule.band": "The engine's move and any move that gives up less than {pct} of win chance (about {cp} cp) count as the best.",
      "settings.ui.rule.masters": "The same, and the master's move also counts when it gives up less than {master} of win chance.",

      "settings.ui.preview.title": "Preview: what points they would earn",
      "settings.ui.preview.lead": "Example moves in an even position, scored with your current settings. Change any option and watch the points move.",
      "settings.ui.preview.caption": "Points and verdict of example moves with your current settings",
      "settings.ui.preview.colCase": "Example move",
      "settings.ui.preview.colResult": "Points and verdict",
      "settings.ui.preview.points": "{points} out of 10 points",
      "settings.ui.preview.best": "Counts as the best",
      "settings.ui.preview.detail.eval": "Best move {best} · yours {you}",
      "settings.ui.preview.detail.only": "Best move {best} · the next one {next}",
      "settings.ui.preview.detail.mate": "The best mates in {n} · yours {you}",
      "settings.ui.preview.detail.hint": "Best move {best}, with a level 1 hint",
      "settings.ui.preview.case.best": "The engine's best move",
      "settings.ui.preview.case.only": "The only move that keeps the advantage",
      "settings.ui.preview.case.equal": "An almost equally good move ({cp} cp less)",
      "settings.ui.preview.case.close": "A slightly worse move ({cp} cp less)",
      "settings.ui.preview.case.master": "The master's move, {cp} cp below the engine",
      "settings.ui.preview.case.inaccuracy": "An inaccuracy ({cp} cp less)",
      "settings.ui.preview.case.mistake": "A clear mistake ({cp} cp less)",
      "settings.ui.preview.case.blunder": "A blunder: a piece is lost ({cp} cp less)",
      "settings.ui.preview.case.mate": "Missing a forced mate",
      "settings.ui.preview.case.hint": "The best move, after using a hint",
      "settings.ui.preview.foot": "Engine strength only changes how reliable the evaluation is, not the points scale. With a single line, “only moves” cannot be recognised.",
      "settings.ui.preview.unavailable": "The preview is not available right now.",

      "settings.ui.clock.presets": "Usual durations",
      "settings.ui.clock.preset.aria": "{seconds} seconds per move",
      "settings.ui.clock.custom": "Another duration, in seconds",
      "settings.ui.clock.error": "Type a number of seconds between {min} and {max}.",
      "settings.ui.clock.now": "Right now: {seconds} per move. This is your usual clock: when you set up a session with your own games you can pick another time for that session only.",
      "settings.ui.movetime.cap": "During a round the engine never thinks longer than {cap} per search, even if you choose more time.",
      "settings.ui.clock.untimed": "No clock: think as long as you like.",
      "settings.ui.hints.costs": "Every hint costs points: level 1 (marks the piece) costs {l1}, level 2 (also marks the destination) costs {l2}, and showing the move leaves the position at 0 points.",
      "settings.ui.hints.off": "With hints off there is no help button while you play.",
      "settings.ui.mistakes.explainTitle": "What is a centipawn?",
      "settings.ui.mistakes.explain": "A centipawn (cp) is a hundredth of a pawn: 100 cp is roughly a pawn of advantage. When the engine reviews your games, a move counts as a mistake if it loses more than this threshold compared with the best move.",
      "settings.ui.mistakes.now": "Right now: moves that lose more than {cp} cp (about {pawns} pawns) are collected as mistakes.",
      "settings.ui.desc.clock.mode.timed": "Each position has a time limit.",
      "settings.ui.desc.clock.mode.untimed": "No limit: think as long as you like.",
      "settings.ui.desc.mistakes.sensitivity.high": "Catches even small slips: many positions to study.",
      "settings.ui.desc.mistakes.sensitivity.standard": "Real mistakes without too much noise.",
      "settings.ui.desc.mistakes.sensitivity.low": "Only the big mistakes: fewer, more important positions.",

      "settings.ui.sound.testTitle": "Try the sounds",
      "settings.ui.sound.testHint": "Tap a button to hear it at the current volume.",
      "settings.ui.sound.off": "Sounds are turned off. Turn them on to try them.",
      "settings.ui.sound.unsupported": "This browser cannot play sounds.",
      "settings.ui.sound.played": "Sound: {name}",
      "settings.ui.sound.name.move": "Move",
      "settings.ui.sound.name.capture": "Capture",
      "settings.ui.sound.name.check": "Check",
      "settings.ui.sound.name.correct": "Correct",
      "settings.ui.sound.name.great": "Great",
      "settings.ui.sound.name.wrong": "Wrong",
      "settings.ui.sound.name.levelup": "Level up",
      "settings.ui.sound.name.click": "Click",
      "settings.ui.haptics.test": "Try the vibration",
      "settings.ui.haptics.unsupported": "This device does not vibrate, or the browser does not allow it.",

      "settings.ui.access.sample": "Aa",
      "settings.ui.access.motion.reduced": "Your system asks for less motion, and “Automatic” respects it.",
      "settings.ui.access.motion.normal": "Your system does not ask for less motion. Pick “Reduced” to remove animations anyway.",
    },
  };

  function registerText() {
    const i18n = L().i18n;
    try {
      if (i18n && typeof i18n.register === "function") i18n.register(TEXT);
    } catch (error) {
      // Text is cosmetic: the screen keeps working with raw keys.
    }
  }

  // ---------- Settings access (every call guarded: the screen degrades, never throws) ----------

  const settingsApi = () => L().Settings || null;

  function schemaList() {
    const api = settingsApi();
    return api && Array.isArray(api.schema) ? api.schema : [];
  }

  function groupList() {
    const api = settingsApi();
    return api && Array.isArray(api.groups) ? api.groups : [];
  }

  function getValue(path) {
    try {
      const api = settingsApi();
      return api && typeof api.get === "function" ? api.get(path) : undefined;
    } catch (error) {
      return undefined;
    }
  }

  function setValue(path, value) {
    try {
      const api = settingsApi();
      return Boolean(api && typeof api.set === "function" && api.set(path, value));
    } catch (error) {
      return false;
    }
  }

  // path -> value for every schema entry.
  function snapshot() {
    const values = {};
    schemaList().forEach((spec) => {
      values[spec.path] = getValue(spec.path);
    });
    return values;
  }

  const sameValue = (a, b) => (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-9 : a === b);

  // ---------- Sections (which schema groups live where) ----------

  const SECTION_DEFS = [
    { id: "board", icon: "rook", groups: ["board"] },
    { id: "judge", icon: "target", groups: ["engine", "scoring"] },
    { id: "play", icon: "clock", groups: ["clock", "hints", "mistakes"] },
    { id: "sound", icon: "sound", groups: ["sound"] },
    { id: "access", icon: "eye", groups: ["a11y"] },
  ];

  // Sections in display order, each with the schema paths it owns. A group nobody
  // claimed (a setting added later) lands in a trailing "more" section, so the
  // screen never silently loses a setting.
  function buildSections(schema, groups) {
    const list = Array.isArray(schema) ? schema : [];
    const claimed = new Set();
    const out = [];
    SECTION_DEFS.forEach((def) => {
      const present = def.groups.filter((id) => list.some((spec) => spec.group === id));
      if (!present.length) return;
      present.forEach((id) => claimed.add(id));
      out.push({ id: def.id, icon: def.icon, groups: present, paths: list.filter((spec) => present.includes(spec.group)).map((spec) => spec.path) });
    });
    const rest = (Array.isArray(groups) ? groups : []).map((group) => group.id)
      .filter((id) => !claimed.has(id) && list.some((spec) => spec.group === id));
    list.forEach((spec) => {
      if (!claimed.has(spec.group) && !rest.includes(spec.group)) rest.push(spec.group);
    });
    if (rest.length) {
      out.push({ id: "more", icon: "settings", groups: rest, paths: list.filter((spec) => rest.includes(spec.group)).map((spec) => spec.path) });
    }
    return out;
  }

  // ---------- Pure helpers ----------

  function decimalsOf(number) {
    const text = String(number);
    const dot = text.indexOf(".");
    return dot === -1 ? 0 : text.length - dot - 1;
  }

  function formatNumber(value, decimals, language) {
    const digits = clamp(Math.round(decimals || 0), 0, 3);
    try {
      return new Intl.NumberFormat(language === "en" ? "en" : "es", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
    } catch (error) {
      return Number(value).toFixed(digits);
    }
  }

  // The value of a number setting as a person reads it: "50 %", "1.5 s", "90 s".
  function formatValue(spec, value, language) {
    const n = Number(value);
    if (!spec || !Number.isFinite(n)) return String(value);
    const scale = Number(spec.displayScale) || 1;
    const decimals = decimalsOf(Number(spec.step) * scale || 1);
    if (spec.unit === "ms") return `${formatNumber(n / 1000, n % 1000 === 0 ? 0 : 1, language)}${NBSP}s`;
    if (spec.unit === "s") return `${formatNumber(n, 0, language)}${NBSP}s`;
    if (spec.unit === "%") return `${formatNumber(n * scale, decimals, language)}${NBSP}%`;
    return formatNumber(n * scale, decimals, language);
  }

  // Seconds as a clock: 90 -> "1:30", 360 -> "6:00".
  function formatClock(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  // Which control a schema entry gets when nothing more specific applies.
  function controlKind(spec) {
    if (!spec) return "none";
    if (spec.type === "boolean") return "switch";
    if (spec.type === "enum") return Array.isArray(spec.options) && spec.options.length > 6 ? "select" : "tiles";
    if (spec.type === "number") {
      const span = Number(spec.max) - Number(spec.min);
      const step = Number(spec.step) > 0 ? Number(spec.step) : 1;
      return span / step <= 400 ? "slider" : "number";
    }
    return "none";
  }

  // A row is shown while its showWhen holds (and while its own extra rule holds).
  const EXTRA_SHOW = {
    // The tolerance does nothing when only the engine's move counts.
    "scoring.tolerancePct": (get) => get("scoring.bestMode") !== "engine",
  };

  function isVisible(spec, get) {
    if (!spec) return false;
    const read = typeof get === "function" ? get : () => undefined;
    let visible = true;
    if (spec.showWhen && spec.showWhen.path) visible = sameValue(read(spec.showWhen.path), spec.showWhen.value);
    if (visible && hasOwn(EXTRA_SHOW, spec.path)) visible = Boolean(EXTRA_SHOW[spec.path](read));
    return visible;
  }

  // The engine's time per search after the game core's own scaling (app.js:
  // 0.8x for a quiet position to 1.6x for a crowded one, 300 ms to 3.5 s).
  const SEARCH_MIN_MS = 300;
  const SEARCH_MAX_MS = 3500;
  function waitEstimate(movetimeMs) {
    const base = Number(movetimeMs);
    const safe = Number.isFinite(base) && base > 0 ? base : 1500;
    return {
      loMs: clamp(Math.round(safe * 0.8), SEARCH_MIN_MS, SEARCH_MAX_MS),
      hiMs: clamp(Math.round(safe * 1.6), SEARCH_MIN_MS, SEARCH_MAX_MS),
    };
  }

  function movetimeFor(values) {
    const api = settingsApi();
    const presets = (api && api.ENGINE_PRESET_MS) || { fast: 700, balanced: 1500, deep: 4000 };
    const strength = values["engine.strength"];
    if (strength === "custom") return Number(values["engine.movetimeMs"]) || 1500;
    return hasOwn(presets, strength) ? presets[strength] : 1500;
  }

  function formatSeconds(ms, language) {
    const seconds = Number(ms) / 1000;
    const whole = Math.abs(seconds - Math.round(seconds)) < 0.05;
    return `${formatNumber(seconds, whole ? 0 : 1, language)}${NBSP}s`;
  }

  // Win% -> the centipawns that lose that much from an equal position (about
  // 11 cp per 1 %). Uses the real Scoring curve when it is loaded.
  function cpForWinLoss(pct, atCp) {
    const scoring = L().Scoring;
    const target = Number(pct);
    if (!Number.isFinite(target) || target <= 0) return 0;
    if (!scoring || typeof scoring.winPercent !== "function") return Math.round(target * 11);
    const from = Number.isFinite(atCp) ? atCp : 0;
    const start = scoring.winPercent(from);
    let lo = 0;
    let hi = 2000;
    for (let i = 0; i < 40; i += 1) {
      const mid = (lo + hi) / 2;
      if (start - scoring.winPercent(from - mid) < target) lo = mid;
      else hi = mid;
    }
    return Math.round((lo + hi) / 2);
  }

  // The sentence "what counts as the best move" for the current settings.
  function ruleSentence(values, language) {
    const mode = values["scoring.bestMode"];
    const pct = Number(values["scoring.tolerancePct"]);
    const shown = `${formatNumber(Number.isFinite(pct) ? pct : 1, decimalsOf(Number.isFinite(pct) ? pct : 1) ? 1 : 0, language)}${NBSP}%`;
    if (mode === "engine") return t("settings.ui.rule.engine");
    const params = { pct: shown, cp: cpForWinLoss(Number.isFinite(pct) ? pct : 1), master: `3${NBSP}%` };
    return t(mode === "masters" ? "settings.ui.rule.masters" : "settings.ui.rule.band", params);
  }

  // ---------- The live preview (Scoring.assess on canned lines) ----------

  const uciLine = (uci, san, score) => ({ uci, san, score, pv: [uci] });

  // Every case: what the reference lines are (mover's point of view, centipawns,
  // or a mate) and the move the learner "plays" with its score. The first line is
  // always e2e4, so "the best move" really is the engine's first.
  const PREVIEW_CASES = [
    { id: "best", lines: [30, 24, 12], user: { uci: "e2e4", score: 30 } },
    { id: "only", lines: [150, -80, -120], user: { uci: "e2e4", score: 150 } },
    { id: "equal", lines: [30, 24, 12], user: { uci: "b1c3", score: 22 } },
    { id: "close", lines: [30, 24, 12], user: { uci: "b1c3", score: 10 } },
    { id: "master", lines: [30, 24, 12], user: { uci: "b1c3", score: 5 }, master: true },
    { id: "inaccuracy", lines: [30, 24, 12], user: { uci: "b1c3", score: -20 } },
    { id: "mistake", lines: [30, 24, 12], user: { uci: "b1c3", score: -120 } },
    { id: "blunder", lines: [30, 24, 12], user: { uci: "b1c3", score: -370 } },
    { id: "mate", mate: 2, lines: [null, 300, 120], user: { uci: "d1d2", score: 300 } },
    { id: "hint", lines: [30, 24, 12], user: { uci: "e2e4", score: 30 }, hints: 1, needsHints: true },
  ];

  const LINE_MOVES = [["e2e4", "e4"], ["d2d4", "d4"], ["g1f3", "Nf3"], ["c2c4", "c4"], ["b2b3", "b3"]];

  function previewLines(def, multiPv) {
    const scoring = L().Scoring;
    const lines = def.lines.map((score, index) => {
      const move = LINE_MOVES[index];
      let value = score;
      if (value === null && def.mate && scoring && typeof scoring.encodeScore === "function") {
        value = scoring.encodeScore({ type: "mate", value: def.mate });
      }
      return uciLine(move[0], move[1], value === null ? 0 : value);
    });
    return lines.slice(0, clamp(Math.round(Number(multiPv) || 1), 1, lines.length));
  }

  // input: { scoring (Scoring.normalizeSettings shape), multiPv, hintsEnabled }.
  // Returns one row per case: { id, points, quality, isBest, reason, params,
  // detailKey, detailParams, cp }. Empty when Scoring is not loaded.
  function previewRows(input, language) {
    const scoring = L().Scoring;
    if (!scoring || typeof scoring.assess !== "function") return [];
    const opts = input || {};
    const settings = opts.scoring || {};
    const multiPv = Number.isFinite(opts.multiPv) ? opts.multiPv : 3;
    const evalText = (score) => {
      try {
        return typeof scoring.formatEval === "function" ? scoring.formatEval(score, language) : String(score);
      } catch (error) {
        return String(score);
      }
    };
    const rows = [];
    PREVIEW_CASES.forEach((def) => {
      if (def.needsHints && opts.hintsEnabled === false) return;
      const lines = previewLines(def, multiPv);
      const best = lines[0].score;
      let assessment;
      try {
        assessment = scoring.assess({
          lines,
          userUci: def.user.uci,
          userScore: def.user.score,
          masterUci: def.master ? def.user.uci : undefined,
          settings,
          reason: "",
          hintsUsed: def.hints || 0,
        }, { isSacrifice: false });
      } catch (error) {
        return;
      }
      if (!assessment || !Number.isFinite(assessment.points)) return;
      const cp = def.mate ? 0 : Math.max(0, best - def.user.score);
      let detailKey = "settings.ui.preview.detail.eval";
      let detailParams = { best: evalText(best), you: evalText(def.user.score) };
      if (def.id === "only") {
        detailKey = "settings.ui.preview.detail.only";
        detailParams = { best: evalText(best), next: evalText(def.lines[1]) };
      } else if (def.mate) {
        detailKey = "settings.ui.preview.detail.mate";
        detailParams = { n: def.mate, you: evalText(def.user.score) };
      } else if (def.hints) {
        detailKey = "settings.ui.preview.detail.hint";
        detailParams = { best: evalText(best) };
      }
      rows.push({
        id: def.id,
        points: assessment.points,
        quality: assessment.qualityCode,
        isBest: Boolean(assessment.isBest),
        reason: assessment.reason,
        cp,
        detailKey,
        detailParams,
      });
    });
    return rows;
  }

  // ---------- The summary chips ----------

  function optionLabel(spec, value) {
    if (!spec || !Array.isArray(spec.options)) return String(value);
    const option = spec.options.find((entry) => sameValue(entry.value, value));
    return option ? t(option.labelKey) : String(value);
  }

  function specOf(path) {
    return schemaList().find((spec) => spec.path === path) || null;
  }

  // [{ id, section, icon, text }] describing the current setup in a few words.
  function summaryItems(values, language) {
    const v = values || {};
    const has = (path) => hasOwn(v, path) && v[path] !== undefined;
    const items = [];
    const label = (path) => optionLabel(specOf(path), v[path]);
    if (has("board.theme")) items.push({ id: "board", section: "board", icon: "rook", text: t("settings.ui.summary.board", { theme: label("board.theme") }) });
    if (has("clock.mode")) {
      items.push({
        id: "clock", section: "play", icon: "clock",
        text: v["clock.mode"] === "untimed" ? t("settings.ui.summary.untimed") : t("settings.ui.summary.clock", { seconds: formatClock(v["clock.seconds"]) }),
      });
    }
    if (has("engine.strength")) {
      const lines = Number(v["engine.multiPv"]);
      const ms = movetimeFor(v);
      items.push({
        id: "engine", section: "judge", icon: "target",
        text: t("settings.ui.summary.engine", {
          strength: `${label("engine.strength")} (${formatSeconds(ms, language)})`,
          lines: t(lines === 1 ? "settings.ui.summary.lines.one" : "settings.ui.summary.lines", { n: lines }),
        }),
      });
    }
    if (has("scoring.model")) {
      items.push({
        id: "scoring", section: "judge", icon: "chart",
        text: t("settings.ui.summary.scoring", { model: label("scoring.model"), strictness: label("scoring.strictness") }),
      });
    }
    if (has("scoring.bestMode")) {
      const pct = Number(v["scoring.tolerancePct"]);
      const text = v["scoring.bestMode"] === "engine"
        ? t("settings.ui.summary.best", { mode: label("scoring.bestMode") })
        : t("settings.ui.summary.best.band", { pct: `${formatNumber(Number.isFinite(pct) ? pct : 1, decimalsOf(pct) ? 1 : 0, language)}${NBSP}%` });
      items.push({ id: "best", section: "judge", icon: "star", text });
    }
    if (has("hints.enabled")) {
      items.push({ id: "hints", section: "play", icon: "lightbulb", text: t(v["hints.enabled"] ? "settings.ui.summary.hints.on" : "settings.ui.summary.hints.off") });
    }
    if (has("sound.enabled")) {
      items.push({
        id: "sound", section: "sound", icon: "sound",
        text: v["sound.enabled"]
          ? t("settings.ui.summary.sound.on", { volume: `${Math.round((Number(v["sound.volume"]) || 0) * 100)}${NBSP}%` })
          : t("settings.ui.summary.sound.off"),
      });
    }
    if (has("a11y.textScale")) {
      const extras = [];
      if (v["a11y.contrast"] === "high") extras.push(t("settings.ui.summary.contrast"));
      if (v["a11y.motion"] === "reduce") extras.push(t("settings.ui.summary.motion"));
      const base = t("settings.ui.summary.text", { scale: `${Math.round(Number(v["a11y.textScale"]) * 100)}${NBSP}%` });
      items.push({ id: "access", section: "access", icon: "eye", text: extras.length ? `${base} · ${extras.join(" · ")}` : base });
    }
    return items;
  }

  // Which paths of a section differ from their defaults (what "Reset" would change).
  function changedPaths(paths, values, schema) {
    const list = Array.isArray(schema) ? schema : [];
    return (paths || []).filter((path) => {
      const spec = list.find((entry) => entry.path === path);
      return spec && hasOwn(values || {}, path) && !sameValue(values[path], spec.default);
    });
  }

  // ---------- Small builders ----------

  let idSeq = 0;
  const nextId = (prefix) => {
    idSeq += 1;
    return `${prefix}-${idSeq}`;
  };

  function setHidden(el, hidden) {
    if (!el) return;
    if (hidden) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
    el.hidden = Boolean(hidden);
  }

  function setChecked(input, checked) {
    if (!input) return;
    input.checked = Boolean(checked);
    if (checked) input.setAttribute("checked", "");
    else input.removeAttribute("checked");
  }

  function setAriaDisabled(el, disabled) {
    if (!el) return;
    if (disabled) el.setAttribute("aria-disabled", "true");
    else el.removeAttribute("aria-disabled");
  }

  // The speaker glyph is not in the kit's icon set: a private one, same stroke style.
  function speakerIcon(size) {
    return h("svg:svg", {
      class: "ui-icon ui-icon-sound", width: size || 20, height: size || 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
      "stroke-width": 1.75, "stroke-linecap": "round", "stroke-linejoin": "round", focusable: "false", "aria-hidden": "true",
    },
    h("svg:path", { d: "M4.5 9.6v4.8h3.6l4.4 3.7V5.9L8.1 9.6H4.5Z" }),
    h("svg:path", { d: "M15.6 9.2a4 4 0 0 1 0 5.6" }),
    h("svg:path", { d: "M18.2 6.6a7.6 7.6 0 0 1 0 10.8" }));
  }

  function sectionIcon(name, size) {
    return name === "sound" ? speakerIcon(size) : icon(name, { size });
  }

  function toast(message, options) {
    const ui = L().ui;
    if (ui && typeof ui.toast === "function") {
      try {
        return ui.toast(message, options);
      } catch (error) {
        logError("[Ludus.Screens.settings] toast failed", error);
      }
    }
    return null;
  }

  // ---------- The screen ----------

  const state = {
    el: null,
    mounted: false,
    visible: false,
    dirty: true,
    sections: [],
    controls: [], // { spec, row, sync(value, values) }
    notes: [], // { node, update(values) }
    sectionEls: new Map(),
    resetButtons: [],
    undoHosts: new Map(), // section id -> the live region under its heading
    undoOpen: new Map(), // section id -> { paths } while an undo notice is showing
    undoBusy: false, // true while Undo itself writes the old values back
    summaryEl: null,
    previewBody: null,
    previewRule: null,
    prevPoints: new Map(),
    boardPreview: null,
    live: null,
    offs: [],
    pendingSection: null,
    spy: null,
    navButtons: new Map(),
  };

  function announce(text) {
    if (!state.live) return;
    state.live.textContent = "";
    state.live.textContent = String(text || "");
  }

  function optionEntries(spec) {
    const descFor = (option) => {
      if (spec.path === "engine.strength") {
        // The wait each preset means, in words the person can weigh.
        const api = settingsApi();
        const presets = (api && api.ENGINE_PRESET_MS) || {};
        return t(`settings.ui.strength.${option.value}`, { s: hasOwn(presets, option.value) ? formatSeconds(presets[option.value], lang()) : "" });
      }
      const key = `settings.ui.desc.${spec.path}.${String(option.value).replace(/\./g, "_")}`;
      const text = t(key);
      return text === key ? "" : text;
    };
    return (spec.options || []).map((option) => ({ value: option.value, label: t(option.labelKey), desc: descFor(option) }));
  }

  // A group of radio tiles. The native radios are the control (arrow keys, one
  // tab stop, screen-reader semantics come with them); the tile is their face.
  function tileGroup(spec, ids, entries, config) {
    const opts = config || {};
    const name = nextId("settings-radio");
    const inputs = [];
    const group = h("div", {
      class: cls("settings-tiles", opts.cards && "is-cards", opts.compact && "is-compact", opts.className),
      role: "radiogroup",
      "aria-labelledby": ids.label,
      "aria-describedby": ids.hint,
    });
    entries.forEach((entry) => {
      const input = h("input", {
        type: "radio",
        class: "settings-tile-input",
        name,
        value: String(entry.value),
        "aria-label": entry.ariaLabel || null,
        onchange: () => {
          if (input.checked) setValue(spec.path, entry.value);
        },
      });
      inputs.push({ input, entry });
      group.appendChild(h("label", { class: "settings-tile", "data-value": String(entry.value) },
        input,
        h("span", { class: "settings-tile-face" },
          entry.preview ? h("span", { class: "settings-tile-preview", "aria-hidden": "true" }, entry.preview) : null,
          h("span", { class: "settings-tile-main" },
            h("span", { class: "settings-tile-label" }, entry.label),
            entry.desc ? h("span", { class: "settings-tile-desc" }, entry.desc) : null),
          h("span", { class: "settings-tile-check", "aria-hidden": "true" }, icon("check", { size: 14 })))));
    });
    return {
      node: group,
      sync(value) {
        inputs.forEach((item) => setChecked(item.input, sameValue(item.entry.value, value) || String(item.entry.value) === String(value)));
      },
    };
  }

  // ----- switch -----
  function switchControl(spec, ids) {
    const input = h("input", {
      type: "checkbox",
      role: "switch",
      "aria-labelledby": ids.label,
      "aria-describedby": ids.hint,
      onchange: () => {
        setValue(spec.path, Boolean(input.checked));
      },
    });
    const node = h("label", { class: "switch settings-switch" },
      input,
      h("span", { class: "switch-track", "aria-hidden": "true" }),
      h("span", { class: "switch-text" },
        h("span", { class: "settings-label", id: ids.label }, t(spec.labelKey)),
        h("span", { class: "switch-hint settings-hint", id: ids.hint }, t(spec.hintKey))));
    return { node, input, sync: (value) => setChecked(input, value === true) };
  }

  // ----- slider (range) -----
  function paintFill(input, spec) {
    // css/system.css paints the filled part of a .slider from --pct; the kit's
    // bindSlider does it on input events, this does it for programmatic changes.
    const min = Number(spec.min);
    const max = Number(spec.max);
    const ratio = max > min ? clamp((Number(input.value) - min) / (max - min), 0, 1) : 0;
    if (input.style && typeof input.style.setProperty === "function") input.style.setProperty("--pct", `${Math.round(ratio * 10000) / 100}%`);
  }

  function sliderControl(spec, ids, config) {
    const opts = config || {};
    const input = h("input", {
      type: "range",
      class: "slider",
      id: ids.control,
      min: String(spec.min),
      max: String(spec.max),
      step: String(spec.step || 1),
      value: String(spec.default),
      "aria-labelledby": ids.label,
      "aria-describedby": ids.hint,
    });
    // Sighted people read the value next to the slider; a screen reader gets it
    // from aria-valuetext (so the visible copy is hidden from it, no double reading).
    const out = h("span", { class: "slider-value settings-slider-value", "aria-hidden": "true" }, "");
    const paint = () => {
      const text = formatValue(spec, Number(input.value), lang());
      out.textContent = text;
      input.setAttribute("aria-valuetext", text);
    };
    const ui = L().ui;
    if (ui && typeof ui.bindSlider === "function") ui.bindSlider(input);
    input.addEventListener("input", () => {
      paint();
      setValue(spec.path, Number(input.value));
    });
    if (typeof opts.onCommit === "function") input.addEventListener("change", opts.onCommit);
    return {
      node: h("div", { class: "slider-row settings-slider" }, input, out),
      sync(value) {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && !sameValue(Number(input.value), numeric)) input.value = String(numeric);
        paintFill(input, spec);
        paint();
      },
    };
  }

  // ----- number (a plain field, for wide ranges) -----
  function numberControl(spec, ids) {
    const input = h("input", {
      type: "number", class: "input", id: ids.control, inputmode: "numeric", min: String(spec.min), max: String(spec.max), step: String(spec.step || 1),
      "aria-labelledby": ids.label, "aria-describedby": ids.hint,
    });
    input.addEventListener("change", () => {
      const number = Number(input.value);
      if (Number.isFinite(number)) setValue(spec.path, number);
      const stored = getValue(spec.path);
      if (stored !== undefined) input.value = String(stored);
    });
    return { node: h("div", { class: "settings-number" }, input), sync: (value) => { input.value = String(value); } };
  }

  // ----- select (many options) -----
  function selectControl(spec, ids) {
    const entries = optionEntries(spec);
    const select = h("select", { class: "select", id: ids.control, "aria-labelledby": ids.label, "aria-describedby": ids.hint },
      entries.map((entry) => h("option", { value: String(entry.value) }, entry.label)));
    select.addEventListener("change", () => {
      const match = entries.find((entry) => String(entry.value) === String(select.value));
      if (match) setValue(spec.path, match.value);
    });
    return { node: select, sync: (value) => { select.value = String(value); } };
  }

  // ----- board theme: a grid of miniature boards -----
  const PREVIEW_FEN = "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7";
  const PREVIEW_LAST = ["e8", "g8"];
  const PREVIEW_SELECTED = "f3";
  const PREVIEW_TARGETS = [{ square: "g5" }, { square: "h4" }, { square: "d2" }, { square: "e1" }, { square: "e5", capture: true }];

  function themeControl(spec, ids) {
    const ui = L().ui;
    const entries = optionEntries(spec).map((entry) => Object.assign(entry, {
      preview: ui && typeof ui.miniBoard === "function"
        ? ui.miniBoard(PREVIEW_FEN, { size: 120, theme: entry.value, label: t("settings.ui.board.themeLabel", { theme: entry.label }), highlight: PREVIEW_LAST })
        : null,
      ariaLabel: t("settings.ui.board.themeLabel", { theme: entry.label }),
    }));
    return tileGroup(spec, ids, entries, { className: "settings-themes" });
  }

  // Legal-move dots over a mini board: the board module draws them on the real
  // board; here a small SVG stands in so the toggle shows what it does.
  function dotsOverlay() {
    const cell = 10;
    const file = (sq) => sq.charCodeAt(0) - 97;
    const rank = (sq) => Number(sq[1]) - 1;
    const nodes = PREVIEW_TARGETS.map((target) => {
      const cx = file(target.square) * cell + cell / 2;
      const cy = (7 - rank(target.square)) * cell + cell / 2;
      return target.capture
        ? h("svg:circle", { class: "settings-dot settings-dot-capture", cx, cy, r: 4.3, fill: "none" })
        : h("svg:circle", { class: "settings-dot", cx, cy, r: 1.9 });
    });
    return h("svg:svg", { class: "settings-dots", viewBox: "0 0 80 80", "aria-hidden": "true", focusable: "false" }, nodes);
  }

  function buildBoardPreview() {
    const ui = L().ui;
    const values = snapshot();
    const theme = values["board.theme"] || "walnut";
    const spec = specOf("board.theme");
    const themeName = optionLabel(spec, theme);
    const highlight = [];
    if (values["board.lastMove"] !== false) PREVIEW_LAST.forEach((square) => highlight.push(square));
    highlight.push({ square: PREVIEW_SELECTED, kind: "user" });
    const board = ui && typeof ui.miniBoard === "function"
      ? ui.miniBoard(PREVIEW_FEN, {
        size: 300, theme, coords: values["board.coords"] !== false, highlight,
        label: t("settings.ui.board.previewLabel", { theme: themeName }),
      })
      : null;
    return h("div", { class: "settings-preview-board" }, board, values["board.legalDots"] !== false ? dotsOverlay() : null);
  }

  function paintBoardPreview() {
    const holder = state.boardPreview;
    if (!holder) return;
    holder.textContent = "";
    holder.appendChild(buildBoardPreview());
  }

  // ----- clock seconds: presets + a number field -----
  const CLOCK_PRESETS = [60, 90, 180, 360];

  function secondsControl(spec, ids) {
    const min = Number(spec.min);
    const max = Number(spec.max);
    const entries = CLOCK_PRESETS.map((seconds) => ({
      value: seconds,
      label: seconds % 60 === 0 ? `${seconds / 60}${NBSP}min` : formatClock(seconds),
      ariaLabel: t("settings.ui.clock.preset.aria", { seconds }),
    }));
    const presets = tileGroup(spec, ids, entries, { compact: true });
    const inputId = nextId("settings-seconds");
    const errorId = nextId("settings-seconds-error");
    const input = h("input", {
      type: "number", class: "input settings-seconds-input", id: inputId, inputmode: "numeric", min: String(min), max: String(max), step: "1",
      "aria-describedby": errorId,
    });
    const error = h("p", { class: "field-error settings-error", id: errorId, role: "alert" });
    setHidden(error, true);
    const showError = (on) => {
      setHidden(error, !on);
      error.textContent = on ? t("settings.ui.clock.error", { min, max }) : "";
      if (on) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    };
    // Typing commits only complete, in-range numbers (a half-typed "1" on the way to
    // "120" must not be clamped to 5 under the person's fingers); leaving the field
    // clamps whatever is there.
    input.addEventListener("input", () => {
      const raw = String(input.value).trim();
      const number = Number(raw);
      if (raw !== "" && Number.isFinite(number) && number >= min && number <= max) {
        showError(false);
        setValue(spec.path, Math.round(number));
      } else {
        showError(raw !== "");
      }
    });
    input.addEventListener("change", () => {
      const number = Number(String(input.value).trim());
      if (Number.isFinite(number) && String(input.value).trim() !== "") setValue(spec.path, Math.round(clamp(number, min, max)));
      showError(false);
      const stored = getValue(spec.path);
      if (stored !== undefined) input.value = String(stored);
    });
    const node = h("div", { class: "settings-seconds" },
      presets.node,
      h("div", { class: "field settings-seconds-field" },
        h("label", { for: inputId }, t("settings.ui.clock.custom")),
        input,
        error));
    return {
      node,
      sync(value) {
        presets.sync(value);
        if (state.el && getDoc() && getDoc().activeElement === input) return;
        input.value = String(value);
        showError(false);
      },
    };
  }

  // ----- notes (small live sentences under a control) -----
  function noteNode(update) {
    const node = h("p", { class: "settings-note" });
    const item = { node, update: (values) => { node.textContent = update(values) || ""; setHidden(node, !node.textContent); } };
    state.notes.push(item);
    return node;
  }

  function extraFor(spec) {
    switch (spec.path) {
      case "engine.strength":
        return noteNode((values) => {
          const wait = waitEstimate(movetimeFor(values));
          return t("settings.ui.strength.estimate", { lo: formatSeconds(wait.loMs, lang()), hi: formatSeconds(wait.hiMs, lang()) });
        });
      case "engine.multiPv":
        return noteNode((values) => {
          const lines = Number(values["engine.multiPv"]);
          return lines <= 1 ? t("settings.ui.lines.one") : t("settings.ui.lines.many", { n: lines });
        });
      case "scoring.tolerancePct":
        return noteNode((values) => {
          const pct = Number(values["scoring.tolerancePct"]);
          return t("settings.ui.tolerance.now", {
            pct: `${formatNumber(pct, decimalsOf(pct) ? 1 : 0, lang())}${NBSP}%`,
            cp: cpForWinLoss(pct),
          });
        });
      case "clock.seconds":
        return noteNode((values) => t("settings.ui.clock.now", { seconds: formatClock(values["clock.seconds"]) }));
      case "engine.movetimeMs":
        // The slider goes higher than a round ever uses: say so instead of promising a wait that never happens (QA PERF-018).
        return noteNode((values) => (Number(values["engine.movetimeMs"]) > SEARCH_MAX_MS ? t("settings.ui.movetime.cap", { cap: formatSeconds(SEARCH_MAX_MS, lang()) }) : ""));
      case "hints.enabled":
        return noteNode((values) => {
          if (values["hints.enabled"] === false) return t("settings.ui.hints.off");
          const scoring = L().Scoring;
          const cost = (scoring && scoring.DEFAULTS && scoring.DEFAULTS.hintCost) || { level1: 0.15, level2: 0.35 };
          return t("settings.ui.hints.costs", {
            l1: `${Math.round(cost.level1 * 100)}${NBSP}%`,
            l2: `${Math.round(cost.level2 * 100)}${NBSP}%`,
          });
        });
      case "mistakes.sensitivity":
        return noteNode(() => {
          const api = settingsApi();
          const cp = api && typeof api.mistakeThresholdCp === "function" ? api.mistakeThresholdCp() : 80;
          return t("settings.ui.mistakes.now", { cp, pawns: formatNumber(cp / 100, 1, lang()) });
        });
      case "a11y.motion":
        return noteNode(() => {
          let reduced = false;
          try {
            reduced = Boolean(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
          } catch (error) {
            reduced = false;
          }
          return t(reduced ? "settings.ui.access.motion.reduced" : "settings.ui.access.motion.normal");
        });
      default:
        return null;
    }
  }

  // ----- one row per schema entry -----
  function buildRow(spec) {
    const ids = { label: nextId("settings-label"), hint: nextId("settings-hint"), control: nextId("settings-control") };
    const kind = controlKind(spec);
    let built;
    if (spec.path === "board.theme") built = themeControl(spec, ids);
    else if (spec.path === "clock.seconds") built = secondsControl(spec, ids);
    else if (kind === "switch") built = switchControl(spec, ids);
    else if (kind === "slider") built = sliderControl(spec, ids, spec.path === "sound.volume" ? { onCommit: () => playTest("move", true) } : null);
    else if (kind === "number") built = numberControl(spec, ids);
    else if (kind === "select") built = selectControl(spec, ids);
    else if (kind === "tiles") {
      const entries = optionEntries(spec);
      const withDesc = entries.some((entry) => entry.desc);
      if (spec.path === "a11y.textScale") {
        entries.forEach((entry) => {
          entry.preview = h("span", { class: "settings-sample", style: { fontSize: `${Number(entry.value)}em` } }, t("settings.ui.access.sample"));
        });
      }
      built = tileGroup(spec, ids, entries, { cards: withDesc || spec.path === "scoring.bestMode" });
    } else return null;

    const extra = extraFor(spec);
    const isSwitch = kind === "switch";
    const row = h("div", { class: cls("settings-row", isSwitch && "is-switch", `settings-row-${spec.path.replace(/\./g, "-")}`), "data-path": spec.path });
    if (isSwitch) {
      row.appendChild(h("div", { class: "settings-row-control" }, built.node, extra));
    } else {
      row.appendChild(h("div", { class: "settings-row-text" },
        h("h3", { class: "settings-label", id: ids.label }, t(spec.labelKey)),
        h("p", { class: "settings-hint", id: ids.hint }, t(spec.hintKey))));
      row.appendChild(h("div", { class: "settings-row-control" }, built.node, extra));
    }
    state.controls.push({ spec, row, sync: built.sync });
    return row;
  }

  // ----- sound tests -----
  function playTest(name, quiet) {
    const audio = L().Audio;
    if (!audio || typeof audio.play !== "function") return false;
    let played = false;
    try {
      played = Boolean(audio.play(name));
    } catch (error) {
      played = false;
    }
    if (played && !quiet) announce(t("settings.ui.sound.played", { name: t(`settings.ui.sound.name.${name}`) }));
    return played;
  }

  function soundTests() {
    const audio = L().Audio;
    const names = audio && Array.isArray(audio.names) ? audio.names : [];
    if (!names.length) return null;
    const note = h("p", { class: "settings-note settings-sound-note" });
    const buttons = names.map((name) => h("button", {
      type: "button",
      class: "btn btn-secondary settings-test-btn",
      "data-sound": name,
      onclick: (event) => {
        if (getValue("sound.enabled") === false) return;
        playTest(name);
        if (event && typeof event.preventDefault === "function") event.preventDefault();
      },
    }, icon("play", { size: 16 }), h("span", { class: "btn-label" }, t(`settings.ui.sound.name.${name}`))));
    const hapticSupported = Boolean(root.navigator && typeof root.navigator.vibrate === "function");
    const hapticBtn = hapticSupported
      ? h("button", {
        type: "button", class: "btn btn-secondary settings-test-btn", "data-haptic": "correct",
        onclick: () => {
          try {
            if (typeof audio.haptic === "function") audio.haptic("correct");
          } catch (error) {
            logError("[Ludus.Screens.settings] haptic failed", error);
          }
        },
      }, icon("play", { size: 16 }), h("span", { class: "btn-label" }, t("settings.ui.haptics.test")))
      : null;
    const supported = typeof audio.isSupported === "function" ? audio.isSupported() : true;
    const box = h("div", { class: "settings-tests" },
      h("h3", { class: "settings-label" }, t("settings.ui.sound.testTitle")),
      h("p", { class: "settings-hint" }, t("settings.ui.sound.testHint")),
      h("div", { class: "settings-test-grid" }, buttons, hapticBtn),
      note,
      hapticSupported ? null : h("p", { class: "settings-note" }, t("settings.ui.haptics.unsupported")));
    // aria-disabled (not disabled): the buttons stay focusable, so a keyboard
    // person finds them and reads why they do nothing.
    state.notes.push({
      node: note,
      update(values) {
        const enabled = values["sound.enabled"] !== false;
        buttons.forEach((button) => setAriaDisabled(button, !enabled || !supported));
        let message = "";
        if (!supported) message = t("settings.ui.sound.unsupported");
        else if (!enabled) message = t("settings.ui.sound.off");
        note.textContent = message;
        setHidden(note, !message);
        if (hapticBtn) setAriaDisabled(hapticBtn, values.haptics === false);
      },
    });
    return box;
  }

  // ----- the preview table -----
  function qualityBadge(code) {
    const ui = L().ui;
    return ui && typeof ui.qualityBadge === "function" ? ui.qualityBadge(code) : h("span", { class: "badge" }, String(code));
  }

  function previewSection() {
    const scoring = L().Scoring;
    const head = h("div", { class: "settings-preview-head" },
      h("h3", { class: "settings-h3" }, t("settings.ui.preview.title")),
      h("p", { class: "settings-hint" }, t("settings.ui.preview.lead")));
    if (!scoring || typeof scoring.assess !== "function") {
      return h("div", { class: "settings-preview" }, head, h("p", { class: "settings-note" }, t("settings.ui.preview.unavailable")));
    }
    const body = h("tbody");
    state.previewBody = body;
    const rule = h("p", { class: "settings-rule" });
    state.previewRule = rule;
    const table = h("table", { class: "settings-table" },
      h("caption", { class: "sr-only" }, t("settings.ui.preview.caption")),
      h("thead", null, h("tr", null,
        h("th", { scope: "col" }, t("settings.ui.preview.colCase")),
        h("th", { scope: "col" }, t("settings.ui.preview.colResult")))),
      body);
    return h("div", { class: "settings-preview" }, head, rule, h("div", { class: "settings-table-wrap" }, table),
      h("p", { class: "settings-foot" }, t("settings.ui.preview.foot")));
  }

  function paintPreview(values) {
    const body = state.previewBody;
    if (!body) return;
    const api = settingsApi();
    let scoringSettings = {};
    try {
      scoringSettings = api && typeof api.scoringSettings === "function" ? api.scoringSettings() : {};
    } catch (error) {
      scoringSettings = {};
    }
    const rows = previewRows({ scoring: scoringSettings, multiPv: values["engine.multiPv"], hintsEnabled: values["hints.enabled"] }, lang());
    body.textContent = "";
    rows.forEach((row) => {
      const previous = state.prevPoints.get(row.id);
      const changed = previous !== undefined && previous !== row.points;
      state.prevPoints.set(row.id, row.points);
      const showBest = row.isBest && !["best", "only", "hint"].includes(row.id);
      body.appendChild(h("tr", { class: cls("settings-case", changed && "is-changed"), "data-case": row.id },
        h("th", { scope: "row", class: "settings-case-head" },
          h("span", { class: "settings-case-title" }, t(`settings.ui.preview.case.${row.id}`, { cp: row.cp })),
          h("span", { class: "settings-case-detail" }, t(row.detailKey, row.detailParams))),
        h("td", { class: "settings-case-result" },
          h("div", { class: "settings-result" },
            h("span", { class: "settings-points", "data-points": String(row.points) },
              h("span", { class: "sr-only" }, t("settings.ui.preview.points", { points: formatNumber(row.points, 1, lang()) })),
              h("span", { "aria-hidden": "true" }, formatNumber(row.points, 1, lang()))),
            h("span", { class: "settings-meter", "aria-hidden": "true" }, h("span", { class: "settings-meter-fill", style: { width: `${clamp(row.points * 10, 0, 100)}%` } })),
            qualityBadge(row.quality)),
          showBest ? h("span", { class: "settings-best" }, icon("check", { size: 13 }), t("settings.ui.preview.best")) : null)));
    });
    if (state.previewRule) {
      state.previewRule.textContent = "";
      state.previewRule.appendChild(h("strong", null, `${t("settings.ui.rule.title")}: `));
      state.previewRule.appendChild(h("span", null, ruleSentence(values, lang())));
    }
  }

  // ----- the judge section's explainer -----
  function judgeFlow() {
    const step = (n) => h("li", { class: "settings-flow-step" },
      h("span", { class: "settings-flow-num", "aria-hidden": "true" }, String(n)),
      h("div", null,
        h("p", { class: "settings-flow-title" }, t(`settings.ui.judge.flow.${n}.title`)),
        h("p", { class: "settings-flow-body" }, t(`settings.ui.judge.flow.${n}.body`))));
    return h("ol", { class: "settings-flow", "aria-label": t("settings.ui.judge.flowLabel") }, step(1), step(2), step(3));
  }

  // ----- sections -----
  function sectionHeader(section, id) {
    const button = h("button", {
      type: "button", class: "btn btn-ghost btn-sm settings-reset", "data-section": section.id,
      "aria-label": t("settings.ui.reset.aria", { section: t(`settings.section.${section.id}`) }),
      onclick: () => resetSection(section),
    }, icon("undo", { size: 16 }), h("span", { class: "btn-label" }, t("settings.ui.reset")));
    state.resetButtons.push({ button, section });
    return h("header", { class: "settings-section-head" },
      h("span", { class: "settings-section-icon", "aria-hidden": "true" }, sectionIcon(section.icon, 22)),
      h("div", { class: "settings-section-titles" },
        h("h2", { class: "settings-h2", id, tabindex: "-1" }, t(`settings.section.${section.id}`)),
        h("p", { class: "settings-lead" }, t(`settings.section.${section.id}.lead`))),
      button);
  }

  // ----- privacy: what is kept about downloaded games (QA SEC-008) -----
  // The app core owns the preference and the cache (app.js, Ludus.game.savedDownloads); the screen only offers them. Without that API
  // (the page is still booting, or a test) there is no privacy section at all, never a dead control.
  function privacyApi() {
    const game = L().game;
    const api = game && game.savedDownloads;
    return api && typeof api.keep === "function" && typeof api.setKeep === "function" && typeof api.clear === "function" ? api : null;
  }

  function buildPrivacySection() {
    const api = privacyApi();
    const headingId = nextId("settings-section");
    const keepLabelId = nextId("settings-label");
    const keepHintId = nextId("settings-hint");
    const note = h("p", { class: "settings-note settings-privacy-note", hidden: true });
    const say = (message) => {
      note.textContent = message || "";
      setHidden(note, !message);
      if (message) announce(message);
    };
    const clearSaved = () => Promise.resolve()
      .then(() => api.clear())
      .then(() => true)
      .catch((error) => {
        logError("[Ludus.Screens.settings] clearing the saved games failed", error);
        return false;
      });
    const keep = h("input", {
      type: "checkbox",
      role: "switch",
      class: "settings-privacy-keep",
      "aria-labelledby": keepLabelId,
      "aria-describedby": keepHintId,
      onchange: () => {
        const on = Boolean(keep.checked);
        try {
          api.setKeep(on);
        } catch (error) {
          logError("[Ludus.Screens.settings] the preference could not be saved", error);
        }
        // Turning it off also deletes what is already kept: "do not keep" that still held last week's games would be a lie.
        if (on) say(t("settings.ui.privacy.on.done"));
        else clearSaved().then((ok) => say(ok ? t("settings.ui.privacy.off.done") : t("settings.ui.privacy.error")));
      },
    });
    setChecked(keep, api.keep());
    const clearButton = h("button", {
      type: "button",
      class: "btn btn-secondary settings-privacy-clear",
      "data-action": "clear-saved",
      "aria-label": t("settings.ui.privacy.clear"),
      onclick: () => {
        const ui = L().ui;
        const run = () => clearSaved().then((ok) => say(ok ? t("settings.ui.privacy.cleared") : t("settings.ui.privacy.error")));
        if (ui && typeof ui.confirm === "function") {
          ui.confirm({
            title: t("settings.ui.privacy.clear.title"),
            body: t("settings.ui.privacy.clear.body"),
            confirmLabel: t("settings.ui.privacy.clear.confirm"),
            danger: true,
          }).then((yes) => {
            if (yes) run();
          });
        } else if (typeof root.confirm === "function" && root.confirm(t("settings.ui.privacy.clear.title"))) {
          run();
        }
      },
    }, h("span", { class: "btn-label" }, t("settings.ui.privacy.clear.button")));
    const keepRow = h("div", { class: "settings-row is-switch settings-row-privacy-keep" },
      h("div", { class: "settings-row-control" },
        h("label", { class: "switch settings-switch" },
          keep,
          h("span", { class: "switch-track", "aria-hidden": "true" }),
          h("span", { class: "switch-text" },
            h("span", { class: "settings-label", id: keepLabelId }, t("settings.ui.privacy.keep")),
            h("span", { class: "switch-hint settings-hint", id: keepHintId }, t("settings.ui.privacy.keep.hint"))))));
    const clearRow = h("div", { class: "settings-row settings-row-privacy-clear" },
      h("div", { class: "settings-row-text" },
        h("h3", { class: "settings-label" }, t("settings.ui.privacy.clear.heading")),
        h("p", { class: "settings-hint" }, t("settings.ui.privacy.clear.hint"))),
      h("div", { class: "settings-row-control" }, clearButton, note));
    return h("section", { class: cls("card", "settings-section", "settings-section-privacy"), "aria-labelledby": headingId, "data-section": "privacy" },
      h("header", { class: "settings-section-head" },
        h("span", { class: "settings-section-icon", "aria-hidden": "true" }, icon("shield", { size: 22 })),
        h("div", { class: "settings-section-titles" },
          h("h2", { class: "settings-h2", id: headingId, tabindex: "-1" }, t("settings.section.privacy")),
          h("p", { class: "settings-lead" }, t("settings.section.privacy.lead")))),
      h("div", { class: "settings-section-body" }, h("div", { class: "settings-rows" }, keepRow, clearRow)));
  }

  function buildSection(section) {
    if (section.custom === "privacy") {
      const node = buildPrivacySection();
      state.sectionEls.set(section.id, node);
      return node;
    }
    const headingId = nextId("settings-section");
    const body = h("div", { class: "settings-section-body" });
    const specs = section.paths.map(specOf).filter(Boolean);

    if (section.id === "board") {
      const holder = h("div", { class: "settings-preview-holder" });
      state.boardPreview = holder;
      paintBoardPreview();
      body.appendChild(h("aside", { class: "settings-board-aside" },
        h("h3", { class: "settings-h3" }, t("settings.ui.board.previewTitle")),
        holder,
        h("p", { class: "settings-note settings-board-note" }, t("settings.ui.board.previewNote"))));
    }
    if (section.id === "judge") body.appendChild(judgeFlow());

    const rows = h("div", { class: "settings-rows" });
    specs.forEach((spec) => {
      try {
        const row = buildRow(spec);
        if (row) rows.appendChild(row);
      } catch (error) {
        logError(`[Ludus.Screens.settings] could not draw ${spec.path}`, error);
      }
    });
    body.appendChild(rows);
    if (section.id === "judge") body.appendChild(previewSection());
    if (section.id === "play") {
      body.appendChild(h("div", { class: "settings-explain" },
        h("span", { class: "settings-explain-icon", "aria-hidden": "true" }, icon("info", { size: 18 })),
        h("div", null,
          h("h3", { class: "settings-explain-title" }, t("settings.ui.mistakes.explainTitle")),
          h("p", { class: "settings-explain-body" }, t("settings.ui.mistakes.explain")))));
    }
    if (section.id === "sound") {
      const tests = soundTests();
      if (tests) body.appendChild(tests);
    }

    // A persistent, keyboard-reachable Undo lives here (right after the Reset button in reading and Tab order); an empty live region that is
    // filled when a reset happens, so screen readers announce it once (QA A11Y-005).
    const undoHost = h("div", { class: "settings-undo-host", role: "status", "aria-live": "polite" });
    state.undoHosts.set(section.id, undoHost);
    const el = h("section", { class: cls("card", "settings-section", `settings-section-${section.id}`), "aria-labelledby": headingId, "data-section": section.id },
      sectionHeader(section, headingId), undoHost, body);
    state.sectionEls.set(section.id, el);
    return el;
  }

  function buildSummary() {
    const list = h("ul", { class: "settings-chips", "aria-label": t("settings.ui.summary") });
    state.summaryEl = list;
    return h("section", { class: "settings-summary", "aria-labelledby": "settings-summary-title" },
      h("h2", { class: "t-eyebrow settings-eyebrow", id: "settings-summary-title" }, t("settings.ui.summary")),
      list);
  }

  function paintSummary(values) {
    const list = state.summaryEl;
    if (!list) return;
    list.textContent = "";
    const items = summaryItems(values, lang());
    if (!items.length) {
      list.appendChild(h("li", { class: "settings-chips-empty" }, t("settings.ui.summary.empty")));
      return;
    }
    items.forEach((item) => {
      list.appendChild(h("li", { class: "chip settings-chip", "data-chip": item.id }, sectionIcon(item.icon, 14), h("span", null, item.text)));
    });
  }

  function buildNav(sections) {
    const scrollTo = (id) => {
      const target = state.sectionEls.get(id);
      if (!target) return;
      let smooth = true;
      try {
        smooth = !(L().ui && L().ui.reducedMotion && L().ui.reducedMotion());
      } catch (error) {
        smooth = true;
      }
      try {
        target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      } catch (error) {
        // scrollIntoView with options is not everywhere: the section still gets focus.
      }
      const heading = target.querySelector ? target.querySelector(".settings-h2") : null;
      if (heading && typeof heading.focus === "function") heading.focus({ preventScroll: true });
    };
    state.navButtons = new Map();
    return h("nav", { class: "settings-nav", "aria-label": t("settings.ui.nav") },
      h("ul", { class: "settings-nav-list" }, sections.map((section) => {
        const button = h("button", { type: "button", class: "settings-nav-btn", "data-nav": section.id, onclick: () => scrollTo(section.id) },
          sectionIcon(section.icon, 18), h("span", null, t(`settings.section.${section.id}`)));
        state.navButtons.set(section.id, button);
        return h("li", null, button);
      })));
  }

  // Marks the nav button of the section that is being read (aria-current), from where the sections
  // sit while scrolling. Without IntersectionObserver (or a DOM) nothing is marked: the nav still works.
  function stopSpy() {
    if (state.spy && typeof state.spy.disconnect === "function") state.spy.disconnect();
    state.spy = null;
  }

  function startSpy() {
    stopSpy();
    if (typeof root.IntersectionObserver !== "function" || !state.sectionEls.size) return;
    const setCurrent = (id) => {
      state.navButtons.forEach((button, key) => {
        if (key === id) button.setAttribute("aria-current", "true");
        else button.removeAttribute("aria-current");
      });
    };
    try {
      // A band under the header: the section crossing it is the one being read.
      state.spy = new root.IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target && entry.target.getAttribute) setCurrent(entry.target.getAttribute("data-section"));
        });
      }, { rootMargin: "-18% 0px -72% 0px", threshold: 0 });
      state.sectionEls.forEach((el) => state.spy.observe(el));
    } catch (error) {
      state.spy = null;
    }
  }

  function buildResetAll() {
    return h("section", { class: "card card-flat settings-resetall" },
      h("div", null,
        h("h2", { class: "settings-h3" }, t("settings.ui.resetAll.heading")),
        h("p", { class: "settings-hint" }, t("settings.ui.resetAll.lead"))),
      h("button", { type: "button", class: "btn btn-secondary", id: "settings-reset-all", onclick: resetAll },
        icon("refresh", { size: 18 }), h("span", { class: "btn-label" }, t("settings.ui.resetAll"))));
  }

  // ---------- Reset ----------

  function resetSection(section) {
    const api = settingsApi();
    if (!api || typeof api.reset !== "function") return;
    const specs = section.paths.map(specOf).filter(Boolean);
    const before = {};
    specs.forEach((spec) => {
      before[spec.path] = getValue(spec.path);
    });
    const changed = changedPaths(section.paths, before, schemaList());
    const name = t(`settings.section.${section.id}`);
    if (!changed.length) {
      announce(t("settings.ui.reset.nothing"));
      return;
    }
    section.groups.forEach((group) => {
      try {
        api.reset(group);
      } catch (error) {
        logError("[Ludus.Screens.settings] reset failed", error);
      }
    });
    // The toast with a five-second Undo used to be the only way back and a keyboard could not reach it in time; now the notice stays under the
    // section heading until it is used, closed or the person changes something in the section (QA A11Y-005). Without a host (a test, an
    // old layout) the toast remains the fallback.
    if (!showUndo(section, name, before, changed)) {
      announce(t("settings.ui.reset.done", { section: name }));
      toast(t("settings.ui.reset.done", { section: name }), {
        kind: "success",
        action: {
          label: t("settings.ui.reset.undo"),
          onClick: () => {
            changed.forEach((path) => setValue(path, before[path]));
            announce(t("settings.ui.reset.undone"));
          },
        },
      });
    }
  }

  function resetButtonOf(sectionId) {
    const item = state.resetButtons.find((entry) => entry.section.id === sectionId);
    return item ? item.button : null;
  }

  function closeUndo(sectionId, options) {
    const opts = options || {};
    const host = state.undoHosts.get(sectionId);
    state.undoOpen.delete(sectionId);
    if (host) host.textContent = "";
    if (opts.focus) {
      // The Undo button just disappeared: focus goes back to where the person started, never to the page top.
      const button = resetButtonOf(sectionId);
      if (button && typeof button.focus === "function") button.focus();
    }
  }

  function showUndo(section, name, before, changed) {
    const host = state.undoHosts.get(section.id);
    if (!host) return false;
    closeUndo(section.id);
    const undo = h("button", {
      type: "button", class: "btn btn-secondary btn-sm settings-undo-btn", "data-action": "undo",
      "aria-label": t("settings.ui.reset.undo.aria", { section: name }),
      onclick: () => {
        state.undoBusy = true;
        try {
          changed.forEach((path) => setValue(path, before[path]));
        } finally {
          state.undoBusy = false;
        }
        closeUndo(section.id, { focus: true });
        announce(t("settings.ui.reset.undone"));
      },
    }, icon("undo", { size: 16 }), h("span", { class: "btn-label" }, t("settings.ui.reset.undo")));
    const dismiss = h("button", {
      type: "button", class: "btn btn-ghost btn-icon btn-sm settings-undo-close", "data-action": "dismiss-undo",
      "aria-label": t("settings.ui.reset.dismiss"),
      onclick: () => closeUndo(section.id, { focus: true }),
    }, icon("x", { size: 16 }));
    host.appendChild(h("div", { class: "settings-undo" },
      h("p", { class: "settings-undo-text" }, t("settings.ui.reset.done", { section: name })),
      undo, dismiss));
    state.undoOpen.set(section.id, { paths: changed.slice() });
    return true;
  }

  function resetAll() {
    const api = settingsApi();
    if (!api || typeof api.reset !== "function") return;
    const ui = L().ui;
    const run = () => {
      api.reset();
      announce(t("settings.ui.resetAll.done"));
      toast(t("settings.ui.resetAll.done"), { kind: "success" });
    };
    if (ui && typeof ui.confirm === "function") {
      ui.confirm({
        title: t("settings.ui.resetAll.title"),
        body: t("settings.ui.resetAll.body"),
        confirmLabel: t("settings.ui.resetAll.confirm"),
        danger: true,
      }).then((yes) => {
        if (yes) run();
      });
    } else if (typeof root.confirm === "function" && root.confirm(t("settings.ui.resetAll.title"))) {
      run();
    }
  }

  // ---------- Painting the live parts ----------

  // The controls follow the settings without being rebuilt: focus stays where it is.
  // `changedPath` (when known) spares the parts that cannot have changed: the board preview is 100+
  // nodes and the table runs the scorer ten times, so a volume slider must not redraw them.
  function syncAll(changedPath) {
    const values = snapshot();
    const known = typeof changedPath === "string";
    const boardChanged = !known || changedPath.startsWith("board.");
    const previewChanged = !known || changedPath.startsWith("scoring.") || changedPath === "engine.multiPv" || changedPath === "hints.enabled";
    const get = (path) => values[path];
    state.controls.forEach((control) => {
      try {
        control.sync(values[control.spec.path], values);
        setHidden(control.row, !isVisible(control.spec, get));
      } catch (error) {
        logError(`[Ludus.Screens.settings] could not update ${control.spec.path}`, error);
      }
    });
    state.notes.forEach((note) => {
      try {
        note.update(values);
      } catch (error) {
        logError("[Ludus.Screens.settings] could not update a note", error);
      }
    });
    paintSummary(values);
    if (previewChanged) paintPreview(values);
    if (boardChanged) paintBoardPreview();
    const schema = schemaList();
    state.resetButtons.forEach((item) => {
      setAriaDisabled(item.button, changedPaths(item.section.paths, values, schema).length === 0);
    });
  }

  function onSettingsChanged(payload) {
    if (!state.mounted || !state.visible) {
      state.dirty = true;
      return;
    }
    // A change made after a reset (another control, another tab) makes "Undo" unsafe: it would overwrite it. Undo's own writes do not count.
    if (!state.undoBusy && state.undoOpen.size) {
      const path = payload && payload.path;
      Array.from(state.undoOpen.keys()).forEach((sectionId) => {
        const section = state.sections.find((item) => item.id === sectionId);
        if (!path || (section && section.paths.includes(path))) closeUndo(sectionId);
      });
    }
    if (state.controls.length) syncAll(payload && payload.path);
  }

  // ---------- Lifecycle ----------

  function render() {
    const doc = getDoc();
    const el = state.el;
    if (!doc || !el || !L().util || typeof L().util.h !== "function") return;
    registerText();
    state.controls = [];
    state.notes = [];
    state.sectionEls = new Map();
    state.resetButtons = [];
    state.undoHosts = new Map();
    state.undoOpen = new Map();
    state.previewBody = null;
    state.previewRule = null;
    state.prevPoints = new Map();
    state.boardPreview = null;
    const schema = schemaList();
    const sections = buildSections(schema, groupList());
    if (privacyApi()) sections.push({ id: "privacy", icon: "shield", groups: [], paths: [], custom: "privacy" });
    state.sections = sections;
    el.textContent = "";
    el.classList.add("settings");

    const sectionNodes = [];
    sections.forEach((section) => {
      try {
        sectionNodes.push(buildSection(section));
      } catch (error) {
        logError(`[Ludus.Screens.settings] section ${section.id} failed`, error);
      }
    });

    const live = h("div", { class: "sr-only", role: "status", "aria-live": "polite", id: "settings-live" });
    state.live = live;

    el.appendChild(h("div", { class: "page settings-page" },
      h("header", { class: "settings-head" },
        h("p", { class: "t-eyebrow settings-kicker" }, t("settings.eyebrow")),
        h("h1", { class: "screen-title settings-title", "data-screen-title": "", tabindex: "-1" }, t("settings.heading")),
        h("p", { class: "screen-sub settings-sub" }, t("settings.sub"))),
      schema.length ? buildSummary() : null,
      h("div", { class: "settings-layout" },
        sections.length > 1 ? buildNav(sections) : null,
        h("div", { class: "settings-content" }, sectionNodes, schema.length ? buildResetAll() : null)),
      live));
    state.dirty = false;
    syncAll();
    if (state.visible) startSpy();
    if (state.pendingSection) {
      const wanted = state.pendingSection;
      state.pendingSection = null;
      scrollToSection(wanted);
    }
  }

  function scrollToSection(id) {
    const target = state.sectionEls.get(id);
    if (!target) return;
    try {
      target.scrollIntoView({ block: "start" });
    } catch (error) {
      // Not everywhere; the heading focus below still moves the reader there.
    }
    const heading = target.querySelector ? target.querySelector(".settings-h2") : null;
    if (heading && typeof heading.focus === "function") heading.focus({ preventScroll: true });
  }

  function subscribe() {
    if (state.offs.length) return;
    const bus = L().bus;
    if (!bus || typeof bus.on !== "function") return;
    const refresh = () => {
      if (state.visible) render();
      else state.dirty = true;
    };
    state.offs.push(bus.on("settings:changed", onSettingsChanged));
    state.offs.push(bus.on("language:changed", refresh));
    state.offs.push(bus.on("profile:changed", () => {
      // Settings are per device, not per profile: nothing to redraw but the chips.
      if (state.visible && state.controls.length) syncAll();
    }));
  }

  // Cheap on purpose (it runs at boot): the container and the listeners only. The screen is drawn by
  // show(), the first time somebody opens it.
  function mount(el) {
    if (!el) return;
    if (state.el !== el) state.dirty = true;
    state.el = el;
    state.mounted = true;
    registerText();
    subscribe();
    if (el.classList && typeof el.classList.add === "function") el.classList.add("settings");
  }

  function show(params) {
    state.visible = true;
    if (!state.el) return;
    if (state.controls.length) startSpy();
    const wanted = params && typeof params === "object" && typeof params.section === "string" ? params.section : null;
    try {
      if (state.dirty || !state.controls.length) {
        state.pendingSection = wanted;
        render();
      } else {
        syncAll();
        if (wanted) scrollToSection(wanted);
      }
    } catch (error) {
      logError("[Ludus.Screens.settings] show failed", error);
    }
  }

  function hide() {
    state.visible = false;
    stopSpy();
  }

  function destroy() {
    stopSpy();
    state.offs.splice(0).forEach((off) => {
      try {
        if (typeof off === "function") off();
      } catch (error) {
        // already detached
      }
    });
    state.mounted = false;
    state.visible = false;
    state.dirty = true;
    state.controls = [];
    state.notes = [];
    if (state.el && typeof state.el.textContent !== "undefined") state.el.textContent = "";
  }

  registerText();

  return {
    titleKey: "settings.title",
    mount,
    show,
    hide,
    render,
    destroy,
    TEXT,
    helpers: {
      SECTION_DEFS,
      PREVIEW_CASES,
      CLOCK_PRESETS,
      buildSections,
      controlKind,
      isVisible,
      formatValue,
      formatClock,
      formatSeconds,
      waitEstimate,
      movetimeFor,
      cpForWinLoss,
      ruleSentence,
      previewRows,
      summaryItems,
      changedPaths,
    },
  };
});
