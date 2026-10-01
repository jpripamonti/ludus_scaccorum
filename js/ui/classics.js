// Screen "classics" ("Learn from the masters"): the gallery of the classic games,
// the random mix, the daily challenge shortcut and, for each game, a detail page
// with a full interactive replay and the "train this game" launcher.
// Contract: docs/ARCHITECTURE.md sections 14, 15, 19 and 20; styles in css/classics.css
// (every class starts with .classics-).
//
//   Ludus.Screens.classics.mount(el)   el = #screen-classics. Idempotent and cheap: it draws the
//                                      shell of the screen; the data (Ludus.Classics.load(), ~250 KB)
//                                      is fetched in show().
//   Ludus.Screens.classics.show(params) params.game (or .gameId / .id) opens that game's detail page,
//                                      nothing shows the gallery. The hash "#/classics/<id>" does the
//                                      same, on a cold start and on hashchange.
//   Ludus.Screens.classics.hide()      stops the replay and drops the board.
//   Ludus.Screens.classics.render()    repaints from the current state (also on language:changed).
//   Ludus.Screens.classics.titleKey    "classics.title", the i18n key of document.title.
//
// Sessions start only through Ludus.game.startSession (kind "classic", or "daily" for the strip).
// The replay board is Ludus.Board (the same board as the play screen, so it slides pieces, shows the
// last move and follows the board theme) and falls back to Ludus.ui.miniBoard when it is missing.
// Everything is built with Ludus.util.h (text is never parsed as HTML); every source of trouble
// (missing modules, empty data, storage failures) degrades to an empty or error state.
//
// Pure helpers for the tests are exported under `helpers` (filters, sort, eras, replay model and
// state machine, hash parsing, display names): scripts/tests/classics-ui.test.js.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Screens = root.Ludus.Screens || {};
  root.Ludus.Screens.classics = api;
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

  // The one-noun / many-nouns choice: "classics.count" and "classics.count.one".
  function tCount(key, n, params) {
    return t(n === 1 ? `${key}.one` : key, Object.assign({ n }, params || {}));
  }

  // ---------- Text ----------

  const TEXT = {
    es: {
      "classics.title": "Partidas clásicas",
      "classics.eyebrow": "Aprendé de los maestros",
      "classics.sub": "Jugá las posiciones clave de las grandes partidas de la historia. Te puntuamos según cuánto te acerques a la mejor jugada del motor y después te mostramos qué jugó el maestro.",
      "classics.stat.games": "partidas",
      "classics.stat.games.one": "partida",
      "classics.stat.positions": "posiciones de entrenamiento",
      "classics.stat.positions.one": "posición de entrenamiento",
      "classics.stat.years": "{from}–{to}",
      "classics.stat.span": "de historia del ajedrez",
      "classics.loading": "Cargando las partidas",
      "classics.error.title": "No pudimos cargar las partidas",
      "classics.error": "Revisá tu conexión e intentá de nuevo.",
      "classics.loading.slow": "Está tardando más de lo normal. Seguimos intentando; si tu conexión es lenta, puede demorar un poco más.",
      "classics.error.timeout.title": "Las partidas tardan demasiado en cargar",
      "classics.error.timeout": "La conexión parece lenta o cortada. Reintentá en un momento: lo que ya se descargó no se pierde.",
      "classics.retry": "Reintentar",
      "classics.nodata.title": "Todavía no hay partidas",
      "classics.nodata.body": "La biblioteca de partidas clásicas está vacía por ahora.",
      "classics.notFound": "No encontramos esa partida. Te mostramos todas.",
      "classics.noGame": "El juego todavía no está listo. Probá de nuevo en un instante.",
      "classics.startError": "No se pudo empezar el entrenamiento. Probá de nuevo.",
      "classics.newTab": "(se abre en otra pestaña)",

      "classics.mix.eyebrow": "Mezcla al azar",
      "classics.mix.title": "Un poco de cada partida",
      "classics.mix.body": "Posiciones de partidas distintas, en orden mezclado: ideal para practicar sin saber qué tema viene.",
      "classics.mix.difficulty": "Dificultad máxima",
      "classics.mix.count": "Cantidad de posiciones",
      "classics.mix.available": "Hay {n} posiciones hasta esa dificultad.",
      "classics.mix.available.one": "Hay 1 posición hasta esa dificultad.",
      "classics.mix.fewer": "Hay solo {n} posiciones hasta esa dificultad: armamos la mezcla con esas.",
      "classics.mix.fewer.one": "Hay solo 1 posición hasta esa dificultad: armamos la mezcla con esa.",
      "classics.mix.start": "Empezar la mezcla",
      "classics.mix.startN": "Empezar con {n} posiciones",
      "classics.mix.startN.one": "Empezar con 1 posición",
      "classics.mix.sessionTitle": "Mezcla de clásicos",
      "classics.mix.empty": "No hay posiciones para armar la mezcla.",

      "classics.daily.eyebrow": "Desafío diario",
      "classics.daily.title.pending": "La posición de hoy",
      "classics.daily.title.done": "¡Desafío de hoy completado!",
      "classics.daily.body.pending": "Una posición por día, sin repetirse durante meses. Encontrá la mejor jugada.",
      "classics.daily.body.done": "Tu precisión fue {accuracy}%. Volvé mañana: te espera otra posición.",
      "classics.daily.turn": "Juegan las {side}",
      "classics.daily.streak": "Racha: {n} días",
      "classics.daily.streak.one": "Racha: 1 día",
      "classics.daily.play": "Jugar ahora",
      "classics.daily.badge.pending": "Pendiente",
      "classics.daily.badge.done": "Completado",
      "classics.daily.board": "Posición del desafío diario",
      "classics.daily.loading": "Cargando el desafío de hoy",
      "classics.daily.error": "No pudimos cargar el desafío de hoy.",
      "classics.daily.sessionTitle": "Desafío diario",

      "classics.gallery.title": "Todas las partidas",
      "classics.filter.search": "Buscar",
      "classics.filter.search.placeholder": "Jugador, torneo o apertura",
      "classics.filter.search.clear": "Borrar la búsqueda",
      "classics.filter.difficulty": "Dificultad",
      "classics.filter.difficulty.all": "Todas",
      "classics.filter.era": "Época",
      "classics.filter.era.all": "Todas las épocas",
      "classics.filter.era.e1": "Antes de 1900",
      "classics.filter.era.e2": "1900–1949",
      "classics.filter.era.e3": "1950–1999",
      "classics.filter.era.e4": "Desde 2000",
      "classics.filter.theme": "Tema",
      "classics.filter.theme.all": "Todos los temas",
      "classics.filter.kind": "Tipo de posición",
      "classics.filter.kind.all": "Todos los tipos",
      "classics.filter.sort": "Ordenar por",
      "classics.sort.chrono": "Cronológico",
      "classics.sort.difficulty": "Dificultad",
      "classics.sort.title": "Título",
      "classics.filters.toggle": "Filtros",
      "classics.filters.toggle.n": "Filtros ({n})",
      "classics.filters.active": "Filtros activos",
      "classics.filters.remove": "Quitar el filtro: {name}",
      "classics.filters.clear": "Limpiar filtros",
      "classics.filters.q": "Búsqueda: {q}",
      "classics.count": "{shown} de {total} partidas",
      "classics.count.one": "1 de {total} partidas",
      "classics.count.all": "{total} partidas",
      "classics.count.all.one": "1 partida",
      "classics.empty.title": "Ninguna partida coincide",
      "classics.empty.body": "Probá con otra búsqueda o quitá algún filtro.",
      "classics.empty.clear": "Limpiar filtros",

      "classics.card.board": "Posición clave de {title}",
      "classics.card.open": "Ver la partida",
      "classics.card.positions": "{n} posiciones de entrenamiento",
      "classics.card.positions.one": "1 posición de entrenamiento",
      "classics.card.train": "Entrenar",
      "classics.card.trainLabel": "Entrenar con {title}",
      "classics.card.difficulty": "Dificultad: {label}",
      "classics.card.verified": "Jugadas contrastadas",
      "classics.card.verified.hint": "La partida se comparó con copias públicas y con las reglas del ajedrez.",
      "classics.card.more": "+{n}",
      "classics.card.moves": "{n} jugadas",
      "classics.card.practised": "{played} de {total} practicadas",
      "classics.progress.label": "Practicadas: {played} de {total}",
      "classics.progress.detail": "Ya practicaste {played} de {total} posiciones de esta partida y superaste {passed}. Precisión media de tu mejor intento: {accuracy}%.",
      "classics.progress.detail.one": "Ya practicaste 1 de {total} posiciones de esta partida y superaste {passed}. Precisión de tu mejor intento: {accuracy}%.",
      "classics.progress.done": "¡Practicaste todas las posiciones de esta partida! Precisión media de tu mejor intento: {accuracy}%.",

      "classics.detail.back": "Todas las partidas",
      "classics.detail.result.w": "Ganan las blancas",
      "classics.detail.result.b": "Ganan las negras",
      "classics.detail.result.d": "Tablas",
      "classics.detail.vs": "contra",
      "classics.detail.white": "Blancas",
      "classics.detail.black": "Negras",

      "classics.replay.title": "Repetición de la partida",
      "classics.replay.first": "Ir al inicio",
      "classics.replay.prev": "Jugada anterior",
      "classics.replay.next": "Jugada siguiente",
      "classics.replay.last": "Ir al final",
      "classics.replay.play": "Reproducir la partida",
      "classics.replay.pause": "Pausar la reproducción",
      "classics.replay.flip": "Girar el tablero",
      "classics.replay.speed": "Velocidad de la reproducción",
      "classics.replay.speed.slow": "0,5×",
      "classics.replay.speed.normal": "1×",
      "classics.replay.speed.fast": "2×",
      "classics.replay.scrub": "Posición dentro de la partida",
      "classics.replay.scrub.value": "Jugada {n} de {total}",
      "classics.replay.scrub.start": "Posición inicial",
      "classics.replay.counter": "{n} / {total}",
      "classics.replay.board": "Posición después de {move}",
      "classics.replay.board.start": "Posición inicial",
      "classics.replay.moves": "Jugadas",
      "classics.replay.moves.legend": "Posición de entrenamiento",
      "classics.replay.move.label": "{no}. {side}: {san}",
      "classics.replay.move.training": "posición de entrenamiento",
      "classics.replay.start.title": "Posición inicial",
      "classics.replay.start.hint": "Avanzá con el botón, con las flechas del teclado o tocando una jugada de la lista.",
      "classics.replay.turn.w": "Blancas · jugada {n}",
      "classics.replay.turn.b": "Negras · jugada {n}",
      "classics.replay.status": "Jugada {no}, {side}: {san}.",
      "classics.replay.status.start": "Posición inicial.",
      "classics.replay.status.end": "Fin de la partida. {result}.",
      "classics.replay.end": "Fin de la partida. {result}",
      "classics.replay.moment": "Momento clave",
      "classics.replay.training": "Posición de entrenamiento",
      "classics.replay.trainingNext": "Acá te pedimos la jugada del maestro. ¿Cuál elegirías?",
      "classics.replay.trainingPast": "Esta jugada es una de las posiciones de entrenamiento.",
      "classics.replay.try": "Probar esta posición",
      "classics.replay.unavailable": "La repetición de la partida no está disponible en este momento, pero podés entrenar igual.",
      "classics.replay.tip": "Un consejo: entrená primero y mirá la repetición después. Lo que encontrás vos mismo se recuerda mejor.",
      "classics.player.protagonist": "Entrenás con este bando",

      "classics.train.title": "Entrenar esta partida",
      "classics.train.how": "{playing}: en cada posición elegís tu jugada, te puntuamos según cuánto te acerques a la mejor jugada del motor y después te mostramos qué jugó el maestro.",
      "classics.train.count": "Cantidad de posiciones",
      "classics.train.all": "Todas ({n})",
      "classics.train.hints": "Pistas",
      "classics.train.hints.hint": "Podés pedir ayuda a cambio de algunos puntos.",
      "classics.train.shuffle": "Orden al azar",
      "classics.train.shuffle.hint": "Si no, siguen el orden de la partida.",
      "classics.train.start": "Entrenar {n} posiciones",
      "classics.train.start.one": "Entrenar 1 posición",

      "classics.about.title": "Sobre esta partida",
      "classics.about.event": "Torneo",
      "classics.about.place": "Lugar",
      "classics.about.date": "Fecha",
      "classics.about.opening": "Apertura",
      "classics.about.result": "Resultado",
      "classics.about.length": "Duración",
      "classics.about.length.value": "{n} jugadas",
      "classics.sources.title": "Fuentes y verificación",
      "classics.sources.note": "Las jugadas se compararon con copias públicas de la partida y se reprodujeron una por una con las reglas del ajedrez. Las fuentes están en inglés.",
      "classics.sources.count": "{n} fuentes",
      "classics.sources.count.one": "1 fuente",
    },
    en: {
      "classics.title": "Classic games",
      "classics.eyebrow": "Learn from the masters",
      "classics.sub": "Play the key positions of the great games in history. You are scored by how close you get to the engine's best move, then we show you what the master played.",
      "classics.stat.games": "games",
      "classics.stat.games.one": "game",
      "classics.stat.positions": "training positions",
      "classics.stat.positions.one": "training position",
      "classics.stat.years": "{from}–{to}",
      "classics.stat.span": "of chess history",
      "classics.loading": "Loading the games",
      "classics.error.title": "We could not load the games",
      "classics.error": "Check your connection and try again.",
      "classics.loading.slow": "This is taking longer than usual. We keep trying; on a slow connection it can take a little longer.",
      "classics.error.timeout.title": "The games are taking too long to load",
      "classics.error.timeout": "Your connection looks slow or cut off. Try again in a moment: what was already downloaded is not lost.",
      "classics.retry": "Try again",
      "classics.nodata.title": "There are no games yet",
      "classics.nodata.body": "The classic games library is empty for now.",
      "classics.notFound": "We could not find that game. Showing all of them.",
      "classics.noGame": "The game is not ready yet. Try again in a moment.",
      "classics.startError": "The training could not start. Try again.",
      "classics.newTab": "(opens in a new tab)",

      "classics.mix.eyebrow": "Random mix",
      "classics.mix.title": "A little of every game",
      "classics.mix.body": "Positions from different games, in shuffled order: ideal to practice without knowing which theme comes next.",
      "classics.mix.difficulty": "Maximum difficulty",
      "classics.mix.count": "Number of positions",
      "classics.mix.available": "There are {n} positions up to that difficulty.",
      "classics.mix.available.one": "There is 1 position up to that difficulty.",
      "classics.mix.fewer": "There are only {n} positions up to that difficulty: the mix is built from those.",
      "classics.mix.fewer.one": "There is only 1 position up to that difficulty: the mix is built from it.",
      "classics.mix.start": "Start the mix",
      "classics.mix.startN": "Start with {n} positions",
      "classics.mix.startN.one": "Start with 1 position",
      "classics.mix.sessionTitle": "Classic mix",
      "classics.mix.empty": "There are no positions to build the mix.",

      "classics.daily.eyebrow": "Daily challenge",
      "classics.daily.title.pending": "Today's position",
      "classics.daily.title.done": "Today's challenge is complete!",
      "classics.daily.body.pending": "One position a day, with no repeats for months. Find the best move.",
      "classics.daily.body.done": "Your accuracy was {accuracy}%. Come back tomorrow: another position is waiting.",
      "classics.daily.turn": "{side} to move",
      "classics.daily.streak": "Streak: {n} days",
      "classics.daily.streak.one": "Streak: 1 day",
      "classics.daily.play": "Play now",
      "classics.daily.badge.pending": "Pending",
      "classics.daily.badge.done": "Completed",
      "classics.daily.board": "Daily challenge position",
      "classics.daily.loading": "Loading today's challenge",
      "classics.daily.error": "We could not load today's challenge.",
      "classics.daily.sessionTitle": "Daily challenge",

      "classics.gallery.title": "All the games",
      "classics.filter.search": "Search",
      "classics.filter.search.placeholder": "Player, event or opening",
      "classics.filter.search.clear": "Clear the search",
      "classics.filter.difficulty": "Difficulty",
      "classics.filter.difficulty.all": "All",
      "classics.filter.era": "Era",
      "classics.filter.era.all": "All eras",
      "classics.filter.era.e1": "Before 1900",
      "classics.filter.era.e2": "1900–1949",
      "classics.filter.era.e3": "1950–1999",
      "classics.filter.era.e4": "2000 onwards",
      "classics.filter.theme": "Theme",
      "classics.filter.theme.all": "All themes",
      "classics.filter.kind": "Position type",
      "classics.filter.kind.all": "All types",
      "classics.filter.sort": "Sort by",
      "classics.sort.chrono": "Chronological",
      "classics.sort.difficulty": "Difficulty",
      "classics.sort.title": "Title",
      "classics.filters.toggle": "Filters",
      "classics.filters.toggle.n": "Filters ({n})",
      "classics.filters.active": "Active filters",
      "classics.filters.remove": "Remove filter: {name}",
      "classics.filters.clear": "Clear filters",
      "classics.filters.q": "Search: {q}",
      "classics.count": "{shown} of {total} games",
      "classics.count.one": "1 of {total} games",
      "classics.count.all": "{total} games",
      "classics.count.all.one": "1 game",
      "classics.empty.title": "No game matches",
      "classics.empty.body": "Try another search or remove a filter.",
      "classics.empty.clear": "Clear filters",

      "classics.card.board": "Key position of {title}",
      "classics.card.open": "Open the game",
      "classics.card.positions": "{n} training positions",
      "classics.card.positions.one": "1 training position",
      "classics.card.train": "Train",
      "classics.card.trainLabel": "Train with {title}",
      "classics.card.difficulty": "Difficulty: {label}",
      "classics.card.verified": "Moves cross-checked",
      "classics.card.verified.hint": "The game was compared with public copies and with the rules of chess.",
      "classics.card.more": "+{n}",
      "classics.card.moves": "{n} moves",
      "classics.card.practised": "{played} of {total} practiced",
      "classics.progress.label": "Practiced: {played} of {total}",
      "classics.progress.detail": "You have practiced {played} of {total} positions of this game and passed {passed}. Average accuracy of your best attempts: {accuracy}%.",
      "classics.progress.detail.one": "You have practiced 1 of {total} positions of this game and passed {passed}. Accuracy of your best attempt: {accuracy}%.",
      "classics.progress.done": "You have practiced every position of this game! Average accuracy of your best attempts: {accuracy}%.",

      "classics.detail.back": "All the games",
      "classics.detail.result.w": "White wins",
      "classics.detail.result.b": "Black wins",
      "classics.detail.result.d": "Draw",
      "classics.detail.vs": "vs",
      "classics.detail.white": "White",
      "classics.detail.black": "Black",

      "classics.replay.title": "Game replay",
      "classics.replay.first": "Go to the start",
      "classics.replay.prev": "Previous move",
      "classics.replay.next": "Next move",
      "classics.replay.last": "Go to the end",
      "classics.replay.play": "Play the game",
      "classics.replay.pause": "Pause playback",
      "classics.replay.flip": "Flip the board",
      "classics.replay.speed": "Playback speed",
      "classics.replay.speed.slow": "0.5×",
      "classics.replay.speed.normal": "1×",
      "classics.replay.speed.fast": "2×",
      "classics.replay.scrub": "Position within the game",
      "classics.replay.scrub.value": "Move {n} of {total}",
      "classics.replay.scrub.start": "Starting position",
      "classics.replay.counter": "{n} / {total}",
      "classics.replay.board": "Position after {move}",
      "classics.replay.board.start": "Starting position",
      "classics.replay.moves": "Moves",
      "classics.replay.moves.legend": "Training position",
      "classics.replay.move.label": "{no}. {side}: {san}",
      "classics.replay.move.training": "training position",
      "classics.replay.start.title": "Starting position",
      "classics.replay.start.hint": "Step forward with the button, the keyboard arrows or by tapping a move in the list.",
      "classics.replay.turn.w": "White · move {n}",
      "classics.replay.turn.b": "Black · move {n}",
      "classics.replay.status": "Move {no}, {side}: {san}.",
      "classics.replay.status.start": "Starting position.",
      "classics.replay.status.end": "End of the game. {result}.",
      "classics.replay.end": "End of the game. {result}",
      "classics.replay.moment": "Key moment",
      "classics.replay.training": "Training position",
      "classics.replay.trainingNext": "Here we ask you for the master's move. Which one would you choose?",
      "classics.replay.trainingPast": "This move is one of the training positions.",
      "classics.replay.try": "Try this position",
      "classics.replay.unavailable": "The game replay is not available right now, but you can still train.",
      "classics.replay.tip": "A tip: train first and watch the replay afterwards. What you find yourself is remembered better.",
      "classics.player.protagonist": "You train with this side",

      "classics.train.title": "Train this game",
      "classics.train.how": "{playing}: in each position you pick your move, we score you by how close you get to the engine's best move, and then we show you what the master played.",
      "classics.train.count": "Number of positions",
      "classics.train.all": "All ({n})",
      "classics.train.hints": "Hints",
      "classics.train.hints.hint": "You can ask for help in exchange for a few points.",
      "classics.train.shuffle": "Random order",
      "classics.train.shuffle.hint": "Otherwise they follow the order of the game.",
      "classics.train.start": "Train {n} positions",
      "classics.train.start.one": "Train 1 position",

      "classics.about.title": "About this game",
      "classics.about.event": "Event",
      "classics.about.place": "Place",
      "classics.about.date": "Date",
      "classics.about.opening": "Opening",
      "classics.about.result": "Result",
      "classics.about.length": "Length",
      "classics.about.length.value": "{n} moves",
      "classics.sources.title": "Sources and verification",
      "classics.sources.note": "The moves were compared with public copies of the game and replayed one by one with the rules of chess. The sources are in English.",
      "classics.sources.count": "{n} sources",
      "classics.sources.count.one": "1 source",
    },
  };

  function registerText() {
    const i18n = L().i18n;
    if (i18n && typeof i18n.register === "function") i18n.register(TEXT);
  }
  registerText();

  // ---------- Pure helpers ----------

  const FILTER_ERAS = ["e1", "e2", "e3", "e4"];
  const SORTS = ["chrono", "difficulty", "title"];
  const DIFFICULTIES = [1, 2, 3];
  const MIX_COUNTS = [5, 10, 20];
  // The accuracy that passes a review in Ludus.Profile (a position at or above it counts as "passed").
  const PASS_ACCURACY = 70;
  const SPEEDS = ["slow", "normal", "fast"];
  // Milliseconds between two moves of the automatic replay.
  const SPEED_MS = { slow: 2200, normal: 1400, fast: 700 };

  // Era of a year for the filter: before 1900, 1900-1949, 1950-1999, 2000 on.
  function eraOf(year) {
    const y = Number(year);
    if (!Number.isFinite(y)) return "e1";
    if (y < 1900) return "e1";
    if (y < 1950) return "e2";
    if (y < 2000) return "e3";
    return "e4";
  }

  // Lower case, no accents, only letters and digits separated by single spaces: what a search compares.
  function normalizeText(value) {
    let text = value === undefined || value === null ? "" : String(value);
    try {
      text = text.normalize("NFD");
    } catch (error) {
      // very old engines: compare as they are
    }
    return text
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9ßæł]+/g, " ")
      .trim();
  }

  function pickText(value, language) {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";
    const l = language === "en" ? "en" : "es";
    return value[l] || value.es || value.en || "";
  }

  function defaultFilters() {
    return { q: "", difficulty: 0, era: "all", theme: "all", kind: "all", sort: "chrono" };
  }

  // Anything unknown falls back to "no filter": a stale value can never hide every game.
  function cleanFilters(input) {
    const f = input && typeof input === "object" ? input : {};
    const difficulty = Number(f.difficulty);
    return {
      q: typeof f.q === "string" ? f.q.slice(0, 80) : "",
      difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : 0,
      era: FILTER_ERAS.includes(f.era) ? f.era : "all",
      theme: typeof f.theme === "string" && f.theme ? f.theme : "all",
      kind: typeof f.kind === "string" && f.kind ? f.kind : "all",
      sort: SORTS.includes(f.sort) ? f.sort : "chrono",
    };
  }

  // Sorting is a view preference, not a filter: "clear filters" keeps it.
  function hasActiveFilters(filters) {
    const f = cleanFilters(filters);
    return Boolean(normalizeText(f.q)) || f.difficulty !== 0 || f.era !== "all" || f.theme !== "all" || f.kind !== "all";
  }

  function activeFilterCount(filters) {
    const f = cleanFilters(filters);
    return (normalizeText(f.q) ? 1 : 0) + (f.difficulty ? 1 : 0) + (f.era !== "all" ? 1 : 0) + (f.theme !== "all" ? 1 : 0) + (f.kind !== "all" ? 1 : 0);
  }

  const haystackCache = new WeakMap();

  // Everything a person may type: players, event, place, year, opening and title in both languages, ECO.
  function haystackOf(game) {
    if (game && typeof game === "object" && haystackCache.has(game)) return haystackCache.get(game);
    const parts = [
      game && game.white, game && game.black, game && game.event, game && game.site, game && game.year, game && game.eco,
      pickText(game && game.title, "es"), pickText(game && game.title, "en"),
      pickText(game && game.opening, "es"), pickText(game && game.opening, "en"),
    ];
    const text = normalizeText(parts.filter((part) => part !== undefined && part !== null).join(" "));
    if (game && typeof game === "object") haystackCache.set(game, text);
    return text;
  }

  // Every word of the query must appear somewhere in the game (accents and case do not matter).
  function matchesQuery(game, query) {
    const words = normalizeText(query).split(" ").filter(Boolean);
    if (!words.length) return true;
    const hay = haystackOf(game);
    return words.every((word) => hay.includes(word));
  }

  function matchesGame(game, filters) {
    const f = cleanFilters(filters);
    if (!game) return false;
    if (f.difficulty && Number(game.difficulty) !== f.difficulty) return false;
    if (f.era !== "all" && eraOf(game.year) !== f.era) return false;
    if (f.theme !== "all" && !(Array.isArray(game.themes) && game.themes.includes(f.theme))) return false;
    if (f.kind !== "all" && !(game.kinds && Number(game.kinds[f.kind]) > 0)) return false;
    return matchesQuery(game, f.q);
  }

  function compareText(a, b, language) {
    try {
      return String(a).localeCompare(String(b), language === "en" ? "en" : "es", { sensitivity: "base" });
    } catch (error) {
      return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
    }
  }

  function sortGames(games, sortKey, language) {
    const list = Array.isArray(games) ? games.slice() : [];
    const byYear = (a, b) => (Number(a.year) - Number(b.year)) || compareText(a.date || "", b.date || "", "en") || compareText(a.id, b.id, "en");
    if (sortKey === "difficulty") {
      return list.sort((a, b) => (Number(a.difficulty) - Number(b.difficulty)) || byYear(a, b));
    }
    if (sortKey === "title") {
      return list.sort((a, b) => compareText(pickText(a.title, language), pickText(b.title, language), language) || byYear(a, b));
    }
    return list.sort(byYear);
  }

  function filterGames(games, filters, language) {
    const f = cleanFilters(filters);
    const list = Array.isArray(games) ? games : [];
    return sortGames(list.filter((game) => matchesGame(game, f)), f.sort, language);
  }

  // Options of the theme / kind selects: only what the data really has, with the number of games.
  function facetOptions(games) {
    const themes = new Map();
    const kinds = new Map();
    (Array.isArray(games) ? games : []).forEach((game) => {
      (Array.isArray(game.themes) ? game.themes : []).forEach((id) => themes.set(id, (themes.get(id) || 0) + 1));
      Object.keys(game.kinds || {}).forEach((id) => {
        if (Number(game.kinds[id]) > 0) kinds.set(id, (kinds.get(id) || 0) + 1);
      });
    });
    return {
      themes: Array.from(themes, ([id, count]) => ({ id, count })),
      kinds: Array.from(kinds, ([id, count]) => ({ id, count })),
    };
  }

  function summarize(games) {
    const list = Array.isArray(games) ? games : [];
    const years = list.map((game) => Number(game.year)).filter(Number.isFinite);
    return {
      games: list.length,
      positions: list.reduce((sum, game) => sum + (Number(game.positionCount) || 0), 0),
      from: years.length ? Math.min(...years) : null,
      to: years.length ? Math.max(...years) : null,
    };
  }

  // Full moves of a game ("45 plies" are 23 moves).
  function moveCountOf(plies) {
    return Math.ceil((Number(plies) || 0) / 2);
  }

  // The position drawn on the card: an instructive one (sacrifice, tactic, only move) with the person's
  // side at the bottom. `record` is the full game (Ludus.Classics.get).
  function signatureOf(record) {
    const positions = record && Array.isArray(record.positions) ? record.positions.filter((p) => p && typeof p.fen === "string") : [];
    if (!positions.length) return null;
    const rank = { sacrifice: 0, tactic: 1, "only-move": 2, endgame: 3, quiet: 4, opening: 5 };
    const scored = positions.map((pos) => ({
      pos,
      score: (rank[pos.kind] === undefined ? 6 : rank[pos.kind]) * 10 + (pos.note ? 0 : 5),
    }));
    // The lowest score wins; among equals the one closest to the middle of the game.
    const mid = record.moves && record.moves.length ? record.moves.length / 2 : 0;
    scored.sort((a, b) => (a.score - b.score) || (Math.abs(a.pos.ply - mid) - Math.abs(b.pos.ply - mid)) || (a.pos.ply - b.pos.ply));
    const pos = scored[0].pos;
    return { fen: pos.fen, ply: pos.ply, orientation: String(pos.fen).split(" ")[1] === "b" ? "b" : "w", kind: pos.kind };
  }

  // How many positions Ludus.Classics.random({ maxDifficulty }) can draw from: the same rule (the forced
  // mates in one, score 99000 or more, are left out of a mix) applied to the full game records.
  function countMixPositions(records, maxDifficulty) {
    let n = 0;
    (Array.isArray(records) ? records : []).forEach((record) => {
      (record && Array.isArray(record.positions) ? record.positions : []).forEach((pos) => {
        if (pos && pos.difficulty <= maxDifficulty && Array.isArray(pos.lines) && pos.lines.length && !(pos.lines[0].score >= 99000)) n += 1;
      });
    });
    return n;
  }

  // Options of the "how many positions" control of one game: 5, 10 and all of them (never more than exist).
  function trainCounts(total) {
    const n = Math.max(0, Math.floor(Number(total) || 0));
    if (!n) return [];
    const options = [5, 10].filter((value) => value < n);
    options.push(n);
    return options;
  }

  function clampChoice(value, allowed, fallback) {
    const n = Number(value);
    return allowed.includes(n) ? n : fallback;
  }

  // What the person has done with each game's training positions. `rounds` are RoundRecords of source "classic"
  // (Ludus.Profile.rounds), `hashFn` the hash of Ludus.util (a position id is "classic:<hash of the FEN>"). A hint
  // that revealed the answer never counts as an attempt worth anything. -> Map(gameId -> { played, total, passed,
  // accuracy }) with `accuracy` the mean of the best attempt of each played position (0-100), for games with rounds only.
  function progressByGame(records, rounds, hashFn) {
    const out = new Map();
    const hash = typeof hashFn === "function" ? hashFn : (value) => value;
    const owner = new Map();
    const totals = new Map();
    (Array.isArray(records) ? records : []).forEach((record) => {
      if (!record || !record.id || !Array.isArray(record.positions)) return;
      totals.set(record.id, record.positions.length);
      record.positions.forEach((pos) => owner.set(`classic:${hash(pos.fen)}`, record.id));
    });
    const best = new Map();
    (Array.isArray(rounds) ? rounds : []).forEach((round) => {
      if (!round || !owner.has(round.positionId)) return;
      const accuracy = Number(round.hintsUsed) >= 3 ? 0 : Math.max(0, Math.min(100, Number(round.accuracy) || 0));
      if (!best.has(round.positionId) || best.get(round.positionId) < accuracy) best.set(round.positionId, accuracy);
    });
    const perGame = new Map();
    best.forEach((accuracy, id) => {
      const gameId = owner.get(id);
      if (!perGame.has(gameId)) perGame.set(gameId, []);
      perGame.get(gameId).push(accuracy);
    });
    perGame.forEach((list, gameId) => {
      out.set(gameId, {
        played: list.length,
        total: totals.get(gameId) || list.length,
        passed: list.filter((accuracy) => accuracy >= PASS_ACCURACY).length,
        accuracy: Math.round(list.reduce((sum, value) => sum + value, 0) / list.length),
      });
    });
    return out;
  }

  // A game is "cross-checked" when its notes carry at least two sources and one of them names the score.
  function isVerified(record) {
    const sources = record && Array.isArray(record.sources) ? record.sources.filter((s) => typeof s === "string") : [];
    return sources.length >= 2 && sources.some((source) => /^score\b/i.test(source.trim()));
  }

  // "Text with https://example.org/page inside" -> [{ text }, { href, text }, { text }]. Only https links
  // (no trailing punctuation) become links; everything else stays plain text.
  function linkifySource(source) {
    const text = String(source === undefined || source === null ? "" : source);
    const parts = [];
    // Parentheses are part of a link ("Frank_Marshall_(chess_player)"); a closing one the link never opened is punctuation of the sentence.
    const pattern = /https:\/\/[A-Za-z0-9._~:/?#@!$&'*+,;=%()-]+/g;
    let last = 0;
    let match = pattern.exec(text);
    while (match) {
      let url = match[0];
      let trimmed = url.replace(/[.,;:!?]+$/, "");
      while (trimmed.endsWith(")") && (trimmed.match(/\)/g) || []).length > (trimmed.match(/\(/g) || []).length) trimmed = trimmed.slice(0, -1).replace(/[.,;:!?]+$/, "");
      if (trimmed.length < url.length) url = trimmed;
      if (match.index > last) parts.push({ text: text.slice(last, match.index) });
      parts.push({ href: url, text: url });
      last = match.index + url.length;
      pattern.lastIndex = last;
      match = pattern.exec(text);
    }
    if (last < text.length) parts.push({ text: text.slice(last) });
    return parts;
  }

  // A short accessible name for a source link ("Wikipedia: Opera Game") instead of the raw address read out letter by letter (QA A11Y-017).
  const SOURCE_SITES = {
    "wikipedia.org": "Wikipedia",
    "chessbase.com": "ChessBase",
    "chess.com": "Chess.com",
    "chesshistory.com": "Chess History",
    "chessprogramming.org": "Chess Programming Wiki",
    "chesskid.com": "ChessKid",
    "lichess.org": "Lichess",
    "chessgames.com": "Chessgames",
  };
  function sourceLinkLabel(url) {
    let parsed = null;
    try { parsed = new URL(String(url)); } catch (error) { parsed = null; }
    if (!parsed) return String(url === undefined || url === null ? "" : url);
    const host = parsed.hostname.replace(/^www\./, "");
    const known = Object.keys(SOURCE_SITES).find((domain) => host === domain || host.endsWith(`.${domain}`));
    const site = host === "books.chessbase.com" ? "ChessBase Books" : known ? SOURCE_SITES[known] : host;
    let slug = "";
    try { slug = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || ""); } catch (error) { slug = parsed.pathname.split("/").filter(Boolean).pop() || ""; }
    const words = slug.replace(/\.(html?|php)$/i, "").replace(/[_+-]+/g, " ").replace(/\s+/g, " ").trim();
    if (words.length < 3) return site;
    const title = words.length > 48 ? `${words.slice(0, 47).trimEnd()}…` : words;
    return `${site}: ${title.charAt(0).toUpperCase()}${title.slice(1)}`;
  }

  // "#/classics/opera-1858" -> "opera-1858"; "#/classics" and anything else -> null.
  function parseGameHash(hash) {
    const match = /^#\/classics\/([a-z0-9][a-z0-9-]{0,80})\/?$/.exec(String(hash || ""));
    return match ? match[1] : null;
  }

  function isClassicsHash(hash) {
    return /^#\/classics\/?$/.test(String(hash || ""));
  }

  function buildGameHash(id) {
    return id ? `#/classics/${id}` : "#/classics";
  }

  // ----- Display names (the data is written in English/ASCII: proper nouns get their accents) -----

  const NAME_FIX = {
    "Jose Raul Capablanca": "José Raúl Capablanca",
    "Richard Reti": "Richard Réti",
    "Friedrich Saemisch": "Friedrich Sämisch",
    "Stepan Levitsky": "Stepan Levitsky",
    "Duke Karl of Brunswick and Count Isouard": "Duke Karl of Brunswick and Count Isouard",
  };
  const NAME_FIX_ES = {
    "Duke Karl of Brunswick and Count Isouard": "el duque Carlos de Brunswick y el conde Isouard",
    // One Spanish spelling per person, the one the notes use (QA CNT-028).
    "Garry Kasparov": "Garry Kaspárov",
    "Anatoly Karpov": "Anatoli Kárpov",
  };

  // The display forms of the raw PGN tags come from the classics data (Ludus.Classics.displayName / displayEvent over the `names` and
  // `events` tables of notes.json, docs/CLASSICS_DATA.md), so every screen spells a person and an event one way per language. The local
  // tables below only serve while the data has not been loaded (the coach card and the notebook can draw a stored round before the
  // classics screen was opened); a test keeps them equal to the data.
  function dataLoaded() {
    const data = L().ClassicsData;
    return Boolean(data && Array.isArray(data.games) && data.games.length);
  }

  function dataForm(kind, raw, language) {
    const Classics = L().Classics;
    const fn = Classics && (kind === "names" ? Classics.displayName : Classics.displayEvent);
    if (typeof fn !== "function" || !dataLoaded()) return null;
    try {
      const shown = fn.call(Classics, raw, language === "en" ? "en" : "es");
      // Unchanged = the data has nothing to say (an old stored tag, somebody's own game): the local table may still know it.
      return typeof shown === "string" && shown && shown !== raw ? shown : null;
    } catch (error) {
      return null;
    }
  }

  function displayName(name, language) {
    const raw = String(name === undefined || name === null ? "" : name);
    const fromData = dataForm("names", raw, language);
    if (fromData !== null) return fromData;
    if (language === "es" && NAME_FIX_ES[raw]) return NAME_FIX_ES[raw];
    return NAME_FIX[raw] || raw;
  }

  const EVENT_TEXT = {
    "Casual game": { es: "Partida amistosa", en: "Casual game" },
    "1st American Chess Congress": { es: "1.er Congreso Americano de Ajedrez", en: "1st American Chess Congress" },
    "18th DSB Congress, Masters": { es: "18.º Congreso de la DSB (maestros)", en: "18th DSB Congress, Masters" },
    "Third Rosenwald Trophy": { es: "Tercer Trofeo Rosenwald", en: "Third Rosenwald Trophy" },
    "18th RSFSR Championship": { es: "18.º Campeonato de la RSFSR", en: "18th RSFSR Championship" },
    "27th USSR Championship": { es: "27.º Campeonato de la URSS", en: "27th USSR Championship" },
    "Candidates semifinal match": { es: "Semifinal de Candidatos", en: "Candidates semifinal match" }, // es: no English "match" (polish RD-2, data fixer r2-data: tiny cross-edit; the data table notes.json "events" has the same forms)
    "USSR vs Rest of the World": { es: "URSS contra el Resto del Mundo", en: "USSR vs Rest of the World" },
    "World Championship match": { es: "Campeonato Mundial", en: "World Championship match" },
    "IBM Man-Machine match": { es: "Duelo hombre contra máquina de IBM", en: "IBM Man-Machine match" },
    "Lodz": { es: "Torneo de Łódź", en: "Łódź tournament" },
    "Vienna": { es: "Torneo de Viena", en: "Vienna tournament" },
    "New York": { es: "Torneo de Nueva York", en: "New York tournament" },
    "Copenhagen": { es: "Torneo de Copenhague", en: "Copenhagen tournament" },
    "Amsterdam": { es: "Torneo de Ámsterdam", en: "Amsterdam tournament" },
    "Tal Memorial": { es: "Memorial Tal", en: "Tal Memorial" },
    "AVRO": { es: "Torneo AVRO", en: "AVRO tournament" },
    "Bled": { es: "Torneo de Bled", en: "Bled tournament" },
    "Hastings": { es: "Torneo de Hastings", en: "Hastings tournament" },
    "Hoogovens": { es: "Torneo Hoogovens", en: "Hoogovens tournament" },
    "Interpolis": { es: "Torneo Interpolis", en: "Interpolis tournament" },
    "Tata Steel": { es: "Torneo Tata Steel", en: "Tata Steel tournament" },
  };

  function eventLabel(event, language) {
    const raw = String(event === undefined || event === null ? "" : event);
    const fromData = dataForm("events", raw, language);
    if (fromData !== null) return fromData;
    const entry = EVENT_TEXT[raw];
    return entry ? entry[language === "en" ? "en" : "es"] : raw;
  }

  // The display form of a stored `meta` ({ players: "A vs B", event, ... }): the classics data is English / ASCII and the other
  // screens (the coach card, the notebook) show it too, so they ask here instead of writing "Casual game" on a Spanish page.
  // Only names and events this screen knows are changed, so the metadata of a person's own games passes through as it came.
  function localizeMeta(meta, language) {
    const source = meta && typeof meta === "object" ? meta : {};
    const out = Object.assign({}, source);
    if (typeof source.players === "string") {
      const sides = source.players.split(/\s+vs\.?\s+/i);
      if (sides.length === 2) out.players = sides.map((side) => displayName(side.trim(), language)).join(" vs ");
    }
    if (typeof source.event === "string") out.event = eventLabel(source.event, language);
    return out;
  }

  const COUNTRY = {
    ENG: { es: "Inglaterra", en: "England" },
    GER: { es: "Alemania", en: "Germany" },
    USA: { es: "EE. UU.", en: "USA" },
    FRA: { es: "Francia", en: "France" },
    NED: { es: "Países Bajos", en: "Netherlands" },
    AUT: { es: "Austria", en: "Austria" },
    POL: { es: "Polonia", en: "Poland" },
    DEN: { es: "Dinamarca", en: "Denmark" },
    YUG: { es: "Yugoslavia", en: "Yugoslavia" },
    URS: { es: "URSS", en: "USSR" },
    RUS: { es: "Rusia", en: "Russia" }, // polgar-kasparov-2002 (PX-2, data fixer: one-line cross-edit)
    ISL: { es: "Islandia", en: "Iceland" },
    LAT: { es: "Letonia", en: "Latvia" },
    UAE: { es: "Emiratos Árabes Unidos", en: "United Arab Emirates" },
  };
  const CITY_ES = {
    London: "Londres", Paris: "París", Berlin: "Berlín", Vienna: "Viena", Copenhagen: "Copenhague", Belgrade: "Belgrado",
    Moscow: "Moscú", Reykjavik: "Reikiavik", Dubai: "Dubái", "New York": "Nueva York", Lodz: "Łódź", Riga: "Riga", Breslau: "Breslavia",
    Amsterdam: "Ámsterdam",
  };
  // The place is spelled the way the event of the same game is ("Łódź tournament"), so a line never has two spellings of one city.
  const CITY_EN = { Lodz: "Łódź" };

  // "London ENG" -> "Londres, Inglaterra" / "London, England". Unknown sites are shown as they are.
  function siteLabel(site, language) {
    const raw = String(site === undefined || site === null ? "" : site).trim();
    const match = /^(.*?)\s+([A-Z]{3})$/.exec(raw);
    const country = match && COUNTRY[match[2]] ? COUNTRY[match[2]][language === "en" ? "en" : "es"] : "";
    const city = match && country ? match[1] : raw;
    const names = language === "es" ? CITY_ES : CITY_EN;
    const shown = Object.prototype.hasOwnProperty.call(names, city) ? names[city] : city;
    return country ? `${shown}, ${country}` : shown;
  }

  function cityLabel(site, language) {
    const label = siteLabel(site, language);
    return label.split(",")[0];
  }

  // What a search or a comparison sees in a place: no case, no accents, "ł" as "l" (normalizeText keeps it).
  function foldPlace(text) {
    return normalizeText(text).replace(/ł/g, "l");
  }

  // Many events are named after their city ("Torneo de Copenhague", "Hastings tournament"): under a game's title the line "event · city · year"
  // then said the place twice. True when the event already names the city (whole words, so "Bled" is not found inside another word).
  function eventNamesCity(event, city) {
    const place = foldPlace(city);
    return Boolean(place) && ` ${foldPlace(event)} `.includes(` ${place} `);
  }

  // The parts of the line under the title of a game, in order: the event, the city (left out when the event names it: nothing is lost, the
  // place is still there once, and the "Place" row of the page still gives city and country), the year.
  function whereParts(meta, language) {
    const source = meta && typeof meta === "object" ? meta : {};
    const event = eventLabel(source.event, language);
    const city = cityLabel(source.site, language);
    const parts = [];
    if (event) parts.push(event);
    if (city && !eventNamesCity(event, city)) parts.push(city);
    if (source.year !== undefined && source.year !== null && source.year !== "") parts.push(String(source.year));
    return parts;
  }

  // "1-0" -> "w", "0-1" -> "b", everything else -> "d".
  function resultSide(result) {
    if (result === "1-0") return "w";
    if (result === "0-1") return "b";
    return "d";
  }

  function resultText(result) {
    return t(`classics.detail.result.${resultSide(result)}`);
  }

  function prettyResult(result) {
    return String(result || "").replace(/-/g, "–").replace("1/2–1/2", "½–½");
  }

  // ----- The replay: model (every ply with its squares) and a small state machine -----

  // `story` is Ludus.Classics.story(id); `chessApi` is Ludus.chess. Every ply gets the squares it moves
  // (for the last-move highlight), the king in check and its training data.
  function buildReplayModel(story, chessApi) {
    if (!story || !Array.isArray(story.plies)) return null;
    const api = chessApi || (L().chess);
    if (!api || !api.Chess || typeof api.sanToMove !== "function") return null;
    const { Chess, sanToMove } = api;
    const chess = new Chess(story.startFen || Chess.START_FEN);
    const plies = [];
    for (let i = 0; i < story.plies.length; i += 1) {
      const entry = story.plies[i];
      const move = sanToMove(entry.san, chess);
      if (!move) return null;
      chess.makeMove(move);
      const checked = /[+#]/.test(entry.san);
      const kingIndex = checked ? chess.board.indexOf(chess.turn === "w" ? "K" : "k") : -1;
      plies.push({
        ply: entry.ply,
        moveNumber: entry.moveNumber,
        color: entry.color,
        san: entry.san,
        from: Chess.indexToSquare(move.from),
        to: Chess.indexToSquare(move.to),
        fen: entry.fen,
        fenBefore: entry.fenBefore,
        check: kingIndex >= 0 ? Chess.indexToSquare(kingIndex) : null,
        capture: entry.san.includes("x"),
        mate: entry.san.endsWith("#"),
        training: Boolean(entry.training),
        kind: entry.kind || null,
        note: entry.note || null,
      });
    }
    return {
      id: story.id,
      startFen: story.startFen || Chess.START_FEN,
      protagonist: story.protagonist === "b" ? "b" : "w",
      result: story.result,
      plies,
      total: plies.length,
    };
  }

  // Position `index` (0 = the starting position, n = after the n-th ply).
  function fenAt(model, index) {
    if (!model) return "";
    if (index <= 0) return model.startFen;
    const entry = model.plies[Math.min(index, model.total) - 1];
    return entry ? entry.fen : model.startFen;
  }

  function plyAt(model, index) {
    return model && index >= 1 && index <= model.total ? model.plies[index - 1] : null;
  }

  // The move that will be played from position `index`, if any.
  function nextPlyAt(model, index) {
    return model && index >= 0 && index < model.total ? model.plies[index] : null;
  }

  // "12. Nf5" for White, "12... Nf6" for Black.
  function formatPly(entry) {
    if (!entry) return "";
    return `${entry.moveNumber}${entry.color === "w" ? "." : "..."} ${entry.san}`;
  }

  // What a person reads: the SAN through the notation setting (Ludus.chess.localizeSan: Spanish letters R D T A C when the page or the setting
  // says so). The stored and replayed SAN stays English; only what is drawn or spoken goes through here. Unchanged without the helper.
  function shownSan(san) {
    const chess = L().chess;
    if (!chess || typeof chess.localizeSan !== "function") return san;
    try {
      return chess.localizeSan(san, lang());
    } catch (error) {
      return san;
    }
  }

  function showPly(entry) {
    return entry ? `${entry.moveNumber}${entry.color === "w" ? "." : "..."} ${shownSan(entry.san)}` : "";
  }

  // The same move for a screen reader, in words ("caballo a f3", "knight to f3"): "Cf3" is read letter by letter. It takes the replayed (English) SAN,
  // never a localized one (Ludus.chess.spokenSan). The drawn form without the helper. Every accessible name, tooltip and live region of the replay
  // goes through here; what is drawn goes through shownSan (QA A11Y-016, PB-6).
  function spokenSan(san) {
    const chess = L().chess;
    if (!san || !chess || typeof chess.spokenSan !== "function") return shownSan(san);
    try {
      return chess.spokenSan(san, lang());
    } catch (error) {
      return shownSan(san);
    }
  }

  // "12. Negras: caballo a f6": the name of a move button and, after "Position after", of the board.
  function spokenMove(entry) {
    return entry ? t("classics.replay.move.label", { no: entry.moveNumber, side: sideName(entry.color), san: spokenSan(entry.san) }) : "";
  }

  // Blurbs and notes quote moves ("24.Txd4!!"): they are re-spelled for the notation setting by the data module (Ludus.Classics.localizeQuotedMoves).
  function quotedText(text) {
    const Classics = L().Classics;
    if (!text || !Classics || typeof Classics.localizeQuotedMoves !== "function") return text;
    try {
      return Classics.localizeQuotedMoves(text, lang());
    } catch (error) {
      return text;
    }
  }

  // [{ no, white: ply | null, black: ply | null }] for the move list.
  function buildMoveRows(model) {
    const rows = [];
    if (!model) return rows;
    model.plies.forEach((entry) => {
      if (entry.color === "w") rows.push({ no: entry.moveNumber, white: entry, black: null });
      else if (rows.length && rows[rows.length - 1].no === entry.moveNumber) rows[rows.length - 1].black = entry;
      else rows.push({ no: entry.moveNumber, white: null, black: entry });
    });
    return rows;
  }

  function clampIndex(value, total) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(Math.max(0, total), n));
  }

  // The replay as a state machine without timers: the screen calls tick() when the delay of
  // autoDelayMs() has passed. Pressing play at the end starts over from the beginning.
  function createReplayState(total, options) {
    const opts = options && typeof options === "object" ? options : {};
    const size = Math.max(0, Math.floor(Number(total) || 0));
    const s = {
      index: clampIndex(opts.index || 0, size),
      playing: false,
      speed: SPEEDS.includes(opts.speed) ? opts.speed : "normal",
    };
    const snapshot = () => ({ index: s.index, total: size, playing: s.playing, speed: s.speed, atStart: s.index === 0, atEnd: s.index >= size });
    const stopAtEnd = () => {
      if (s.index >= size) s.playing = false;
    };
    return {
      state: snapshot,
      goto(value) {
        s.index = clampIndex(value, size);
        stopAtEnd();
        return snapshot();
      },
      first() {
        s.index = 0;
        return snapshot();
      },
      prev() {
        s.index = clampIndex(s.index - 1, size);
        return snapshot();
      },
      next() {
        s.index = clampIndex(s.index + 1, size);
        stopAtEnd();
        return snapshot();
      },
      last() {
        s.index = size;
        s.playing = false;
        return snapshot();
      },
      play() {
        if (!size) return snapshot();
        if (s.index >= size) s.index = 0;
        s.playing = true;
        return snapshot();
      },
      pause() {
        s.playing = false;
        return snapshot();
      },
      toggle() {
        if (s.playing) s.playing = false;
        else if (size) {
          if (s.index >= size) s.index = 0;
          s.playing = true;
        }
        return snapshot();
      },
      // One automatic step. Returns false when nothing moved (not playing, or already at the end).
      tick() {
        if (!s.playing) return false;
        if (s.index >= size) {
          s.playing = false;
          return false;
        }
        s.index += 1;
        stopAtEnd();
        return true;
      },
      setSpeed(speed) {
        if (SPEEDS.includes(speed)) s.speed = speed;
        return snapshot();
      },
    };
  }

  // How long the automatic replay stays on the position it has just reached: the speed's pace, or the
  // reading time of the hand-written note of that moment when that is longer.
  function autoDelayMs(speed, noteText, readingTimeFn) {
    const base = SPEED_MS[speed] || SPEED_MS.normal;
    if (!noteText) return base;
    let reading = 0;
    if (typeof readingTimeFn === "function") {
      try {
        reading = Number(readingTimeFn(noteText)) || 0;
      } catch (error) {
        reading = 0;
      }
    }
    return Math.max(base, reading);
  }

  // A spoken description of a position: who moves and where each piece stands (kit.parseFen order).
  function describeFen(fen, translate) {
    const say = typeof translate === "function" ? translate : t;
    const ui = L().ui;
    const parsed = ui && typeof ui.parseFen === "function" ? ui.parseFen(fen) : null;
    if (!parsed) return "";
    const order = "KQRBNP";
    const list = (white) => parsed.pieces
      .filter((entry) => (entry.piece === entry.piece.toUpperCase()) === white)
      .sort((a, b) => order.indexOf(a.piece.toUpperCase()) - order.indexOf(b.piece.toUpperCase()) || a.file - b.file || a.rank - b.rank)
      .map((entry) => `${say(`ui.piece.${entry.piece.toUpperCase()}`)} ${"abcdefgh"[entry.file]}${entry.rank + 1}`)
      .join(", ");
    return say("ui.miniBoard.aria", {
      label: "",
      side: say(`ui.side.${parsed.turn}`),
      white: say("ui.miniBoard.white", { list: list(true) }),
      black: say("ui.miniBoard.black", { list: list(false) }),
    }).trim();
  }

  // ---------- Small private icons (the kit has no "first", "last", "flip" or "search") ----------

  const GLYPHS = {
    first: ["M6.5 5.5v13", "M18 6.4 9.6 12l8.4 5.6Z"],
    last: ["M17.5 5.5v13", "M6 6.4 14.4 12 6 17.6Z"],
    flip: ["M8 5v13", "M4.8 8.2 8 5l3.2 3.2", "M16 19V6", "M12.8 15.8 16 19l3.2-3.2"],
    search: ["M16.5 16.5 21 21"],
    filter: ["M4 7h10", "M18 7h2", "M4 17h2", "M10 17h10"],
  };

  function glyph(name, size) {
    const shapes = (GLYPHS[name] || []).map((d) => h("svg:path", { d }));
    if (name === "search") shapes.unshift(h("svg:circle", { cx: 11, cy: 11, r: 6.5 }));
    if (name === "filter") {
      shapes.push(h("svg:circle", { cx: 16, cy: 7, r: 2.2 }));
      shapes.push(h("svg:circle", { cx: 8, cy: 17, r: 2.2 }));
    }
    return h("svg:svg", {
      class: `ui-icon ui-icon-${name}`,
      width: size || 20,
      height: size || 20,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1.75,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      focusable: "false",
      "aria-hidden": "true",
    }, shapes);
  }

  // ---------- State ----------

  const MIX_KEY = "ludus.classics.mix.v1";

  const state = {
    mounted: false,
    container: null,
    visible: false,
    offs: [],
    domOffs: [],
    status: "idle", // idle | loading | ready | error
    slow: false, // the load is taking longer than LOAD_SLOW_MS
    timedOut: false, // the load was given up on (error state says so) after LOAD_GIVE_UP_MS
    loadPromise: null,
    games: [],
    records: new Map(),
    facets: { themes: [], kinds: [] },
    filters: defaultFilters(),
    filtersOpen: false,
    view: "list", // list | game
    gameId: null,
    notice: "",
    mix: { difficulty: 3, count: 10 },
    mixAvailable: { 1: 0, 2: 0, 3: 0 },
    daily: { status: "idle", key: "", position: null, promise: null },
    cards: new Map(),
    cardsLang: "",
    progress: new Map(),
    refs: {},
    listScroll: 0,
    lastOpened: null,
    models: new Map(),
    prefs: { speed: "normal", orientation: null, train: null },
    detail: null,
    searchTimer: null,
    hashOnMount: "",
  };

  function readMix() {
    let stored = null;
    try {
      const storage = L().storage;
      stored = storage && typeof storage.get === "function" ? storage.get(MIX_KEY, null) : null;
    } catch (error) {
      stored = null;
    }
    const s = stored && typeof stored === "object" ? stored : {};
    return { difficulty: clampChoice(s.difficulty, DIFFICULTIES, 3), count: clampChoice(s.count, MIX_COUNTS, 10) };
  }

  function saveMix() {
    try {
      const storage = L().storage;
      if (storage && typeof storage.set === "function") storage.set(MIX_KEY, { v: 1, difficulty: state.mix.difficulty, count: state.mix.count });
    } catch (error) {
      // the choice just does not survive a reload
    }
  }

  // ---------- Bridges ----------

  function classicsApi() {
    const api = L().Classics;
    return api && typeof api.load === "function" ? api : null;
  }

  function toast(message, kind) {
    const ui = L().ui;
    if (ui && typeof ui.toast === "function") ui.toast(message, { kind: kind || "info" });
  }

  function gameApi() {
    const game = L().game;
    return game && typeof game === "object" ? game : null;
  }

  async function startSession(spec) {
    const game = gameApi();
    if (!game || typeof game.startSession !== "function") {
      toast(t("classics.noGame"), "warn");
      return false;
    }
    try {
      await game.startSession(spec);
      return true;
    } catch (error) {
      logError("[Ludus.classics] startSession failed", error);
      toast(t("classics.startError"), "error");
      return false;
    }
  }

  function sessionActive() {
    const game = gameApi();
    try {
      return Boolean(game && typeof game.isActive === "function" && game.isActive());
    } catch (error) {
      return false;
    }
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  // "YYYY-MM-DD" in the local time zone (the rule of Ludus.Profile and the home screen).
  function localDateKey(date) {
    const d = date instanceof Date ? date : new Date(date === undefined ? Date.now() : date);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  // The hidden property and the hidden attribute together (a builder may have written the attribute, and the
  // property alone would not clear it in every DOM).
  function setHidden(el, on) {
    if (!el) return;
    el.hidden = Boolean(on);
    if (on) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  // Changing the page inside the screen (gallery <-> game) must not glide: the page has scroll-behavior
  // smooth, and a glide would leave the new page moving under the reader's finger.
  function jumpTo(top) {
    try {
      if (typeof root.scrollTo !== "function") return;
      try {
        root.scrollTo({ top, left: 0, behavior: "instant" });
      } catch (error) {
        root.scrollTo(0, top);
      }
    } catch (error) {
      // not every environment can scroll
    }
  }

  function scrollToTop() {
    jumpTo(0);
  }

  // ---------- Data ----------

  // Milliseconds before the loading screen admits it is slow, and before it offers a retry.
  const LOAD_SLOW_MS = 6000;
  const LOAD_GIVE_UP_MS = 25000;

  function ensureData() {
    if (state.status === "ready") return Promise.resolve(true);
    if (state.loadPromise) return state.loadPromise;
    const Classics = classicsApi();
    if (!Classics) {
      state.status = "error";
      return Promise.resolve(false);
    }
    state.status = "loading";
    state.slow = false;
    state.timedOut = false;
    // A download that hangs must not leave a skeleton forever (QA UX-026): after a few seconds the screen says it is slow, after a longer
    // wait it offers "Try again" (the download itself is not abandoned: Classics.load() hands the same promise back, so a retry that comes
    // after the data arrived simply shows it).
    const repaint = () => {
      if (state.mounted && state.visible && state.view !== "game") render();
    };
    const setTimer = root.setTimeout;
    const slowTimer = typeof setTimer === "function" ? setTimer.call(root, () => {
      if (state.status !== "loading") return;
      state.slow = true;
      repaint();
    }, LOAD_SLOW_MS) : null;
    const giveUpTimer = typeof setTimer === "function" ? setTimer.call(root, () => {
      if (state.status !== "loading") return;
      state.status = "error";
      state.timedOut = true;
      repaint();
    }, LOAD_GIVE_UP_MS) : null;
    const stopTimers = () => {
      if (typeof root.clearTimeout === "function") {
        if (slowTimer !== null) root.clearTimeout(slowTimer);
        if (giveUpTimer !== null) root.clearTimeout(giveUpTimer);
      }
    };
    state.loadPromise = Promise.resolve()
      .then(() => Classics.load())
      .then(() => {
        indexData();
        state.status = state.games.length ? "ready" : "empty";
        state.timedOut = false;
        return true;
      })
      .catch((error) => {
        logError("[Ludus.classics] the classic games could not be loaded", error);
        state.status = "error";
        return false;
      })
      .then((ok) => {
        stopTimers();
        state.slow = false;
        state.loadPromise = null;
        return ok;
      });
    return state.loadPromise;
  }

  function indexData() {
    const Classics = classicsApi();
    state.games = Classics ? Classics.list() : [];
    state.records = new Map();
    state.games.forEach((game) => {
      const record = Classics.get(game.id);
      if (record) state.records.set(game.id, record);
    });
    state.facets = facetOptions(state.games);
    readProgress();
    state.cards.clear();
    DIFFICULTIES.forEach((level) => {
      state.mixAvailable[level] = countMixPositions(Array.from(state.records.values()), level);
    });
  }

  // ---------- Progress on the games ----------

  function readProgress() {
    const Profile = L().Profile;
    const util = L().util;
    let rounds = [];
    try {
      if (Profile && typeof Profile.rounds === "function") rounds = Profile.rounds(undefined, { source: "classic" });
    } catch (error) {
      rounds = [];
    }
    state.progress = progressByGame(Array.from(state.records.values()), rounds, util && util.hashString);
  }

  // A new answer changes the progress line of the cards: they are drawn again (the person is on the play screen
  // when it happens, so no focus is lost).
  function refreshProgress() {
    if (state.status !== "ready") return;
    readProgress();
    state.cards.clear();
    if (state.view === "list" && state.refs.grid) updateResults();
  }

  // ---------- Daily strip ----------

  function dailyStatus() {
    const Profile = L().Profile;
    try {
      if (Profile && Profile.daily && typeof Profile.daily.status === "function") return Profile.daily.status(localDateKey());
    } catch (error) {
      logError("[Ludus.classics] the daily status could not be read", error);
    }
    return null;
  }

  function loadDaily(force) {
    const d = state.daily;
    const key = localDateKey();
    if (!force && d.status === "ready" && d.key === key) return Promise.resolve();
    if (d.promise) return d.promise;
    d.status = "loading";
    d.promise = ensureData().then(() => {
      const Classics = classicsApi();
      try {
        const position = Classics ? Classics.daily(key) : null;
        if (!position) throw new Error("no daily position");
        d.position = position;
        d.key = key;
        d.status = "ready";
      } catch (error) {
        logError("[Ludus.classics] the daily challenge could not be loaded", error);
        d.status = "error";
        d.position = null;
      }
      d.promise = null;
      renderDailySlot();
    });
    return d.promise;
  }

  async function playDaily() {
    // The home screen owns the daily flow (its cache, its key): reuse it when it is there.
    const home = L().Screens && L().Screens.home;
    if (home && typeof home.startDaily === "function") {
      try {
        await home.startDaily();
        return true;
      } catch (error) {
        logError("[Ludus.classics] the daily challenge could not start through home", error);
      }
    }
    await loadDaily(false);
    const d = state.daily;
    if (!d.position) {
      toast(t("classics.daily.error"), "error");
      return false;
    }
    return startSession({
      kind: "daily",
      title: `${t("classics.daily.sessionTitle")} · ${L().util.formatDate(Date.now(), lang())}`,
      positions: [Object.assign({}, d.position, { dailyKey: d.key })],
    });
  }

  function renderDaily() {
    const ui = L().ui;
    const d = state.daily;
    const status = dailyStatus();
    const done = Boolean(status && status.done);
    if (d.status === "idle" || d.status === "loading") {
      return h("section", { class: "classics-daily card", "aria-busy": "true", "aria-label": t("classics.daily.loading") },
        ui && ui.skeleton ? ui.skeleton({ kind: "card" }) : null);
    }
    if (d.status === "error" || !d.position) {
      return h("section", { class: "classics-daily card", "aria-labelledby": "classics-daily-title" },
        h("p", { class: "t-eyebrow" }, t("classics.daily.eyebrow")),
        h("h2", { class: "classics-daily-title", id: "classics-daily-title" }, t("classics.daily.title.pending")),
        h("p", { class: "classics-daily-body" }, t("classics.daily.error")),
        h("button", { type: "button", class: "btn btn-secondary btn-sm", onclick: () => { loadDaily(true); } }, icon("refresh", { size: 16 }), h("span", { class: "btn-label" }, t("classics.retry"))));
    }
    const position = d.position;
    const side = String(position.fen).split(" ")[1] === "b" ? "b" : "w";
    const streak = status && status.streak > 0 ? status.streak : 0;
    const accuracy = status && status.accuracy !== null && status.accuracy !== undefined ? Math.round(status.accuracy) : "—";
    const board = ui && ui.miniBoard ? ui.miniBoard(position.fen, { size: 112, orientation: side, label: t("classics.daily.board") }) : null;
    return h("section", { class: `classics-daily card${done ? " is-done" : ""}`, "aria-labelledby": "classics-daily-title" },
      h("div", { class: "classics-daily-board" }, board),
      h("div", { class: "classics-daily-main" },
        h("div", { class: "classics-daily-head" },
          h("p", { class: "t-eyebrow" }, t("classics.daily.eyebrow")),
          done
            ? h("span", { class: "badge badge-success" }, icon("check", { size: 12 }), t("classics.daily.badge.done"))
            : h("span", { class: "badge badge-gold" }, t("classics.daily.badge.pending"))),
        h("h2", { class: "classics-daily-title", id: "classics-daily-title" }, done ? t("classics.daily.title.done") : t("classics.daily.title.pending")),
        h("p", { class: "classics-daily-body" }, done ? t("classics.daily.body.done", { accuracy }) : t("classics.daily.body.pending")),
        h("ul", { class: "classics-daily-notes" },
          h("li", null, icon("flag", { size: 15 }), t("classics.daily.turn", { side: t(`ui.side.${side}`) })),
          streak ? h("li", null, icon("flame", { size: 15 }), tCount("classics.daily.streak", streak)) : null),
        done
          ? null
          : h("button", { type: "button", class: "btn btn-primary classics-daily-play", "data-fkey": "daily-play", onclick: () => { playDaily(); } },
            icon("play", { size: 18 }), h("span", { class: "btn-label" }, t("classics.daily.play")))));
  }

  function renderDailySlot() {
    const slot = state.refs && state.refs.dailySlot;
    if (!state.mounted || !slot || state.view !== "list") return;
    clear(slot);
    slot.appendChild(renderDaily());
  }

  // ---------- Random mix ----------

  function mixEffectiveCount() {
    const available = state.mixAvailable[state.mix.difficulty] || 0;
    return Math.min(state.mix.count, available);
  }

  async function startMix() {
    const Classics = classicsApi();
    if (!Classics) return false;
    const positions = Classics.random(state.mix.count, { maxDifficulty: state.mix.difficulty });
    if (!positions.length) {
      toast(t("classics.mix.empty"), "warn");
      return false;
    }
    return startSession({ kind: "classic", title: t("classics.mix.sessionTitle"), positions });
  }

  function segmented(label, options, current, onPick, className) {
    return h("div", { class: `segmented classics-seg ${className || ""}`.trim(), role: "group", "aria-label": label },
      options.map((option) => h("button", {
        type: "button",
        "aria-pressed": String(option.value === current),
        "data-value": String(option.value),
        onclick: () => onPick(option.value),
      }, option.label)));
  }

  function syncSegmented(group, current) {
    if (!group || typeof group.querySelectorAll !== "function") return;
    Array.from(group.querySelectorAll("button")).forEach((button) => {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-value") === String(current)));
    });
  }

  function renderMix() {
    const refs = state.refs;
    const difficultyOptions = DIFFICULTIES.map((n) => ({ value: n, label: L().Classics ? L().Classics.difficultyLabel(n) : String(n) }));
    const countOptions = MIX_COUNTS.map((n) => ({ value: n, label: String(n) }));
    refs.mixDifficulty = segmented(t("classics.mix.difficulty"), difficultyOptions, state.mix.difficulty, (value) => {
      state.mix.difficulty = value;
      saveMix();
      syncMix();
    });
    refs.mixCount = segmented(t("classics.mix.count"), countOptions, state.mix.count, (value) => {
      state.mix.count = value;
      saveMix();
      syncMix();
    });
    refs.mixHint = h("p", { class: "classics-mix-hint", role: "status" });
    refs.mixStart = h("button", { type: "button", class: "btn btn-primary btn-lg classics-mix-start", "data-fkey": "mix-start", onclick: () => runBusy(refs.mixStart, startMix) },
      icon("sparkles", { size: 20 }), h("span", { class: "btn-label" }));
    const section = h("section", { class: "classics-mix card card-accent", "aria-labelledby": "classics-mix-title" },
      h("p", { class: "t-eyebrow" }, t("classics.mix.eyebrow")),
      h("h2", { class: "classics-mix-title", id: "classics-mix-title" }, t("classics.mix.title")),
      h("p", { class: "classics-mix-body" }, t("classics.mix.body")),
      h("div", { class: "classics-mix-controls" },
        h("div", { class: "field classics-mix-field" }, h("span", { class: "field-label", id: "classics-mix-diff-label" }, t("classics.mix.difficulty")), refs.mixDifficulty),
        h("div", { class: "field classics-mix-field" }, h("span", { class: "field-label", id: "classics-mix-count-label" }, t("classics.mix.count")), refs.mixCount)),
      h("div", { class: "classics-mix-foot" }, refs.mixHint, refs.mixStart));
    syncMix();
    return section;
  }

  function syncMix() {
    const refs = state.refs;
    if (!refs.mixHint) return;
    const available = state.mixAvailable[state.mix.difficulty] || 0;
    const effective = mixEffectiveCount();
    syncSegmented(refs.mixDifficulty, state.mix.difficulty);
    syncSegmented(refs.mixCount, state.mix.count);
    const fewer = available < state.mix.count;
    refs.mixHint.textContent = fewer ? tCount("classics.mix.fewer", available) : tCount("classics.mix.available", available);
    refs.mixHint.classList.toggle("is-warn", fewer);
    const label = refs.mixStart.querySelector(".btn-label");
    if (label) label.textContent = effective > 0 ? tCount("classics.mix.startN", effective) : t("classics.mix.start");
    refs.mixStart.disabled = effective <= 0;
  }

  // A button that shows a spinner (aria-busy) while its async action runs, and never runs twice at once.
  async function runBusy(button, action) {
    if (!button || button.getAttribute("aria-busy") === "true") return false;
    button.setAttribute("aria-busy", "true");
    try {
      return await action();
    } finally {
      button.removeAttribute("aria-busy");
    }
  }

  // ---------- Gallery ----------

  function difficultyMark(level) {
    const Classics = L().Classics;
    const label = Classics ? Classics.difficultyLabel(level) : String(level);
    const dots = [1, 2, 3].map((n) => h("span", { class: `classics-diff-dot${n <= level ? " is-on" : ""}` }));
    return h("span", { class: `classics-diff classics-diff-${level}`, title: t("classics.card.difficulty", { label }) },
      h("span", { class: "classics-diff-dots", "aria-hidden": "true" }, dots),
      h("span", { class: "classics-diff-label" }, label),
      h("span", { class: "sr-only" }, t("classics.card.difficulty", { label })));
  }

  function themeChips(themes, limit) {
    const Classics = L().Classics;
    const list = Array.isArray(themes) ? themes : [];
    const shown = list.slice(0, limit);
    const chips = shown.map((id) => h("span", { class: "chip classics-chip" }, Classics ? Classics.themeLabel(id) : id));
    if (list.length > shown.length) chips.push(h("span", { class: "chip classics-chip classics-chip-more" }, t("classics.card.more", { n: list.length - shown.length })));
    return chips;
  }

  function gameCard(meta) {
    const ui = L().ui;
    const language = lang();
    const record = state.records.get(meta.id) || null;
    const title = pickText(meta.title, language) || meta.id;
    const sig = signatureOf(record);
    const board = sig && ui && ui.miniBoard
      ? ui.miniBoard(sig.fen, { size: 320, orientation: sig.orientation, label: t("classics.card.board", { title }) })
      : null;
    const verified = isVerified(record);
    const white = displayName(meta.white, language);
    const black = displayName(meta.black, language);
    const opening = pickText(meta.opening, language);
    const positions = meta.positionCount || 0;
    const progress = state.progress.get(meta.id) || null;
    const titleId = `classics-card-${meta.id}`;
    return h("li", { class: "classics-item", "data-game": meta.id },
      h("article", { class: "classics-card card card-interactive", "aria-labelledby": titleId },
        h("div", { class: "classics-card-board" },
          h("div", { class: "classics-card-top" },
            h("span", { class: "classics-year badge badge-gold" }, String(meta.year)),
            verified
              ? h("span", { class: "classics-verified", title: t("classics.card.verified.hint") }, icon("shield", { size: 14 }), t("classics.card.verified"))
              : null),
          board),
        h("div", { class: "classics-card-body" },
          h("p", { class: "classics-card-opening" }, h("span", { class: "classics-card-opening-name", title: opening }, opening), meta.eco ? h("span", { class: "classics-eco" }, meta.eco) : null),
          h("h3", { class: "classics-card-title", id: titleId },
            h("a", { class: "classics-card-link", href: buildGameHash(meta.id), "data-fkey": `open-${meta.id}`, onclick: (event) => onOpenClick(event, meta.id) }, title)),
          h("p", { class: "classics-card-players" }, `${white} `, h("span", { class: "classics-vs" }, t("classics.detail.vs")), ` ${black}`),
          h("p", { class: "classics-card-where" }, `${cityLabel(meta.site, language)} · ${prettyResult(meta.result)} · ${t("classics.card.moves", { n: moveCountOf(meta.plies) })}`),
          h("div", { class: "classics-card-tags" }, difficultyMark(meta.difficulty), ...themeChips(meta.themes, 2)),
          progress && ui && ui.progress
            ? ui.progress(progress.played / progress.total, { label: t("classics.progress.label", { played: progress.played, total: progress.total }), size: "sm", tone: progress.passed >= progress.total ? "success" : null })
            : null),
        h("div", { class: "classics-card-foot" },
          h("span", { class: "classics-card-count" }, icon("target", { size: 16 }),
            progress ? t("classics.card.practised", { played: progress.played, total: progress.total }) : tCount("classics.card.positions", positions)),
          h("button", {
            type: "button",
            class: "btn btn-secondary btn-sm classics-card-train",
            "aria-label": t("classics.card.trainLabel", { title }),
            onclick: () => startGameTraining(meta.id, { count: 5, cardButton: true }),
          }, icon("play", { size: 14 }), h("span", { class: "btn-label" }, t("classics.card.train"))))));
  }

  function cardFor(meta) {
    const language = lang();
    if (state.cardsLang !== language) {
      state.cards.clear();
      state.cardsLang = language;
    }
    let card = state.cards.get(meta.id);
    if (!card) {
      card = gameCard(meta);
      state.cards.set(meta.id, card);
    }
    return card;
  }

  function onOpenClick(event, id) {
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (typeof event.button === "number" && event.button > 0))) return;
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    openGame(id, { fromList: true, record: "push" });
  }

  function filterChipList() {
    const f = cleanFilters(state.filters);
    const Classics = L().Classics;
    const chips = [];
    if (normalizeText(f.q)) chips.push({ key: "q", label: t("classics.filters.q", { q: f.q.trim() }) });
    if (f.difficulty) chips.push({ key: "difficulty", label: `${t("classics.filter.difficulty")}: ${Classics ? Classics.difficultyLabel(f.difficulty) : f.difficulty}` });
    if (f.era !== "all") chips.push({ key: "era", label: t(`classics.filter.era.${f.era}`) });
    if (f.theme !== "all") chips.push({ key: "theme", label: Classics ? Classics.themeLabel(f.theme) : f.theme });
    if (f.kind !== "all") chips.push({ key: "kind", label: Classics ? Classics.kindLabel(f.kind) : f.kind });
    return chips;
  }

  function resetFilter(key) {
    const base = defaultFilters();
    if (key === "q") state.filters.q = base.q;
    else if (key === "difficulty") state.filters.difficulty = 0;
    else state.filters[key] = "all";
  }

  function clearFilters() {
    const sort = state.filters.sort;
    state.filters = Object.assign(defaultFilters(), { sort });
    syncControls();
    updateResults();
    const input = state.refs.search;
    if (input && typeof input.focus === "function") input.focus();
  }

  function selectField(id, label, options, current, onChange) {
    const select = h("select", { id, class: "select", onchange: (event) => onChange(event.target.value) },
      options.map((option) => h("option", { value: String(option.value) }, option.label)));
    select.value = String(current);
    return { field: h("div", { class: `field classics-field classics-field-${id.replace(/^classics-/, "")}` }, h("label", { for: id }, label), select), select };
  }

  function buildControls() {
    const refs = state.refs;
    const Classics = L().Classics;
    const f = state.filters;
    const scheduleSearch = (flush) => {
      if (state.searchTimer && typeof root.clearTimeout === "function") root.clearTimeout(state.searchTimer);
      state.searchTimer = null;
      if (flush || typeof root.setTimeout !== "function") updateResults();
      else state.searchTimer = root.setTimeout(() => { state.searchTimer = null; updateResults(); }, 110);
    };

    refs.search = h("input", {
      id: "classics-search",
      class: "input classics-search-input",
      type: "search",
      autocomplete: "off",
      spellcheck: "false",
      maxlength: 80,
      placeholder: t("classics.filter.search.placeholder"),
      oninput: (event) => {
        state.filters.q = event.target.value;
        syncSearchClear();
        scheduleSearch(false);
      },
      onkeydown: (event) => {
        if (event.key === "Enter") {
          if (typeof event.preventDefault === "function") event.preventDefault();
          scheduleSearch(true);
        }
      },
    });
    refs.search.value = f.q;
    refs.searchClear = h("button", {
      type: "button",
      class: "classics-search-clear",
      "aria-label": t("classics.filter.search.clear"),
      hidden: !f.q,
      onclick: () => {
        state.filters.q = "";
        refs.search.value = "";
        syncSearchClear();
        scheduleSearch(true);
        refs.search.focus();
      },
    }, icon("x", { size: 16 }));
    const searchField = h("div", { class: "field classics-field classics-field-search" },
      h("label", { for: "classics-search" }, t("classics.filter.search")),
      h("div", { class: "classics-search" }, glyph("search", 18), refs.search, refs.searchClear));

    refs.difficulty = segmented(t("classics.filter.difficulty"),
      [{ value: 0, label: t("classics.filter.difficulty.all") }].concat(DIFFICULTIES.map((n) => ({ value: n, label: Classics ? Classics.difficultyLabel(n) : String(n) }))),
      f.difficulty, (value) => {
        state.filters.difficulty = value;
        syncControls();
        updateResults();
      }, "classics-diff-seg");
    const difficultyField = h("div", { class: "field classics-field classics-field-difficulty" },
      h("span", { class: "field-label" }, t("classics.filter.difficulty")), refs.difficulty);

    const eraSelect = selectField("classics-era", t("classics.filter.era"),
      [{ value: "all", label: t("classics.filter.era.all") }].concat(FILTER_ERAS.map((id) => ({ value: id, label: t(`classics.filter.era.${id}`) }))),
      f.era, (value) => { state.filters.era = value; syncControls(); updateResults(); });
    const themes = state.facets.themes
      .map((entry) => ({ value: entry.id, label: `${Classics ? Classics.themeLabel(entry.id) : entry.id} (${entry.count})` }))
      .sort((a, b) => compareText(a.label, b.label, lang()));
    const themeSelect = selectField("classics-theme", t("classics.filter.theme"),
      [{ value: "all", label: t("classics.filter.theme.all") }].concat(themes),
      f.theme, (value) => { state.filters.theme = value; syncControls(); updateResults(); });
    const kinds = state.facets.kinds
      .map((entry) => ({ value: entry.id, label: `${Classics ? Classics.kindLabel(entry.id) : entry.id} (${entry.count})` }))
      .sort((a, b) => compareText(a.label, b.label, lang()));
    const kindSelect = selectField("classics-kind", t("classics.filter.kind"),
      [{ value: "all", label: t("classics.filter.kind.all") }].concat(kinds),
      f.kind, (value) => { state.filters.kind = value; syncControls(); updateResults(); });
    const sortSelect = selectField("classics-sort", t("classics.filter.sort"),
      SORTS.map((id) => ({ value: id, label: t(`classics.sort.${id}`) })),
      f.sort, (value) => { state.filters.sort = cleanFilters({ sort: value }).sort; updateResults(); });
    refs.era = eraSelect.select;
    refs.theme = themeSelect.select;
    refs.kind = kindSelect.select;
    refs.sort = sortSelect.select;

    refs.filterToggle = h("button", {
      type: "button",
      class: "btn btn-secondary classics-filter-toggle",
      "aria-expanded": String(state.filtersOpen),
      "aria-controls": "classics-filter-panel",
      onclick: () => {
        state.filtersOpen = !state.filtersOpen;
        syncControls();
      },
    }, glyph("filter", 18), h("span", { class: "btn-label" }));
    refs.filterPanel = h("div", { class: "classics-filter-panel", id: "classics-filter-panel", "data-open": String(state.filtersOpen) },
      difficultyField, eraSelect.field, themeSelect.field, kindSelect.field, sortSelect.field);

    return h("div", { class: "classics-controls" },
      h("div", { class: "classics-controls-top" }, searchField, refs.filterToggle),
      refs.filterPanel);
  }

  function syncSearchClear() {
    const refs = state.refs;
    if (!refs.searchClear) return;
    setHidden(refs.searchClear, !state.filters.q);
  }

  // Puts the state of the filters back into the controls (after "clear", or when a chip is removed).
  function syncControls() {
    const refs = state.refs;
    const f = cleanFilters(state.filters);
    if (refs.search && refs.search.value !== f.q) refs.search.value = f.q;
    syncSearchClear();
    syncSegmented(refs.difficulty, f.difficulty);
    if (refs.era) refs.era.value = f.era;
    if (refs.theme) refs.theme.value = f.theme;
    if (refs.kind) refs.kind.value = f.kind;
    if (refs.sort) refs.sort.value = f.sort;
    if (refs.filterToggle) {
      const n = activeFilterCount(f);
      refs.filterToggle.setAttribute("aria-expanded", String(state.filtersOpen));
      const label = refs.filterToggle.querySelector(".btn-label");
      if (label) label.textContent = n ? t("classics.filters.toggle.n", { n }) : t("classics.filters.toggle");
    }
    if (refs.filterPanel) refs.filterPanel.setAttribute("data-open", String(state.filtersOpen));
  }

  function visibleGames() {
    return filterGames(state.games, state.filters, lang());
  }

  // Repaints only what depends on the filters (the grid, the count and the chips), so the search box
  // keeps its focus and its caret while somebody types.
  function updateResults() {
    const refs = state.refs;
    if (!state.mounted || !refs.grid) return;
    const list = visibleGames();
    const total = state.games.length;
    const active = hasActiveFilters(state.filters);
    clear(refs.grid);
    list.forEach((meta) => refs.grid.appendChild(cardFor(meta)));
    setHidden(refs.grid, list.length === 0);
    if (refs.count) {
      refs.count.textContent = active ? tCount("classics.count", list.length, { shown: list.length, total }) : tCount("classics.count.all", total, { total });
    }
    setHidden(refs.empty, list.length !== 0);
    if (refs.chips) {
      clear(refs.chips);
      const chips = filterChipList();
      chips.forEach((chip) => refs.chips.appendChild(h("button", {
        type: "button",
        class: "chip classics-active-chip",
        "aria-label": t("classics.filters.remove", { name: chip.label }),
        onclick: () => {
          resetFilter(chip.key);
          syncControls();
          updateResults();
        },
      }, h("span", null, chip.label), icon("x", { size: 12 }))));
      if (chips.length) {
        refs.chips.appendChild(h("button", { type: "button", class: "btn btn-ghost btn-sm classics-clear", onclick: clearFilters }, h("span", { class: "btn-label" }, t("classics.filters.clear"))));
      }
      setHidden(refs.chips, chips.length === 0);
    }
    syncControls();
  }

  function renderHead(summary) {
    const stat = (value, label) => h("li", { class: "classics-stat" }, h("strong", { class: "classics-stat-value" }, value), h("span", { class: "classics-stat-label" }, label));
    const stats = [];
    if (summary && summary.games) {
      stats.push(stat(String(summary.games), t(summary.games === 1 ? "classics.stat.games.one" : "classics.stat.games")));
      stats.push(stat(String(summary.positions), t(summary.positions === 1 ? "classics.stat.positions.one" : "classics.stat.positions")));
      if (summary.from && summary.to && summary.to > summary.from) stats.push(stat(t("classics.stat.years", { from: summary.from, to: summary.to }), t("classics.stat.span")));
    }
    return h("header", { class: "classics-head" },
      h("div", { class: "classics-head-text" },
        h("p", { class: "t-eyebrow" }, t("classics.eyebrow")),
        h("h1", { class: "screen-title classics-title", "data-screen-title": "", tabindex: "-1" }, t("classics.title")),
        h("p", { class: "screen-sub classics-sub" }, t("classics.sub"))),
      stats.length ? h("ul", { class: "classics-stats" }, stats) : null);
  }

  function renderListView(rootEl) {
    const ui = L().ui;
    const refs = state.refs;
    const summary = state.status === "ready" ? summarize(state.games) : null;
    rootEl.appendChild(renderHead(summary));
    if (state.notice) rootEl.appendChild(h("p", { class: "classics-notice", role: "status" }, icon("info", { size: 16 }), state.notice));

    if (state.status === "idle" || state.status === "loading") {
      const cards = [];
      for (let i = 0; i < 6; i += 1) cards.push(h("li", { class: "classics-item" }, h("div", { class: "classics-card card classics-card-skeleton" }, ui && ui.skeleton ? ui.skeleton({ kind: "card" }) : null, ui && ui.skeleton ? ui.skeleton({ kind: "title" }) : null, ui && ui.skeleton ? ui.skeleton({ lines: 2 }) : null)));
      if (state.slow) rootEl.appendChild(h("p", { class: "classics-notice", role: "status" }, icon("info", { size: 16 }), t("classics.loading.slow")));
      rootEl.appendChild(h("div", { class: "classics-loading", "aria-busy": "true", "aria-label": t("classics.loading") }, h("ul", { class: "classics-grid", role: "list" }, cards)));
      return;
    }
    if (state.status === "error" || state.status === "empty") {
      const isError = state.status === "error";
      rootEl.appendChild(ui && ui.emptyState
        ? ui.emptyState({
          icon: isError ? "alert" : "columns",
          title: isError ? t(state.timedOut ? "classics.error.timeout.title" : "classics.error.title") : t("classics.nodata.title"),
          body: isError ? t(state.timedOut ? "classics.error.timeout" : "classics.error") : t("classics.nodata.body"),
          action: isError ? { label: t("classics.retry"), onClick: () => retry(), kind: "primary" } : null,
        })
        : h("p", null, isError ? t("classics.error") : t("classics.nodata.body")));
      return;
    }

    refs.dailySlot = h("div", { class: "classics-slot-daily" }, renderDaily());
    rootEl.appendChild(h("div", { class: "classics-quick" }, renderMix(), refs.dailySlot));

    refs.count = h("p", { class: "classics-count", role: "status", "aria-live": "polite" });
    refs.chips = h("div", { class: "classics-chips", role: "group", "aria-label": t("classics.filters.active"), hidden: true });
    refs.grid = h("ul", { class: "classics-grid", role: "list" });
    refs.empty = h("div", { class: "classics-empty", hidden: true },
      ui && ui.emptyState
        ? ui.emptyState({ icon: "columns", title: t("classics.empty.title"), body: t("classics.empty.body"), action: { label: t("classics.empty.clear"), onClick: clearFilters, kind: "secondary" } })
        : h("p", null, t("classics.empty.title")));
    rootEl.appendChild(h("section", { class: "classics-gallery", "aria-labelledby": "classics-gallery-title" },
      h("div", { class: "classics-gallery-head" },
        h("h2", { class: "classics-h2", id: "classics-gallery-title" }, t("classics.gallery.title")),
        refs.count),
      buildControls(),
      refs.chips,
      refs.grid,
      refs.empty));
    updateResults();
    loadDaily(false);
  }

  function retry() {
    state.status = "idle";
    state.loadPromise = null;
    state.slow = false;
    state.timedOut = false;
    render();
    ensureData().then(() => {
      if (!state.mounted) return;
      applyPendingRoute();
      render();
    });
  }

  // ---------- Detail: the game page ----------

  function gameTitle(meta) {
    return pickText(meta && meta.title, lang()) || (meta && meta.id) || "";
  }

  function sideDot(color) {
    return h("span", { class: `classics-dot classics-dot-${color}`, "aria-hidden": "true" });
  }

  function playerStrip(color, name, isProtagonist) {
    return h("div", { class: `classics-player classics-player-${color}` },
      sideDot(color),
      h("span", { class: "classics-player-name", title: name }, name),
      h("span", { class: "sr-only" }, ` (${t(color === "w" ? "classics.detail.white" : "classics.detail.black")})`),
      isProtagonist ? h("span", { class: "badge badge-gold classics-player-tag" }, icon("star", { size: 12 }), t("classics.player.protagonist")) : null);
  }

  // The replay board: Ludus.Board when it is there (same look and motion as the play board), else a
  // static miniBoard that is redrawn on each step.
  function createBoardView(host, orientation) {
    const Board = L().Board;
    const ui = L().ui;
    const wrap = h("div", { class: "board-wrap classics-board-wrap" });
    host.appendChild(wrap);
    let view = null;
    let boardEl = null;
    let arrowsEl = null;
    let fallback = null;
    let current = orientation === "b" ? "b" : "w";
    let last = null;

    if (Board && typeof Board.create === "function") {
      try {
        boardEl = h("div", { class: "board classics-board", "aria-hidden": "true" });
        arrowsEl = h("svg:svg", { class: "board-arrows", "aria-hidden": "true", focusable: "false" });
        wrap.appendChild(boardEl);
        wrap.appendChild(arrowsEl);
        view = Board.create({ el: boardEl, arrowsEl, wrapEl: wrap, orientation: current, describe: () => "" });
        if (view && typeof view.build === "function") view.build(current);
        else view = null;
      } catch (error) {
        logError("[Ludus.classics] the board could not be created", error);
        view = null;
      }
      if (!view) {
        clear(wrap);
        boardEl = null;
      }
    }

    // The squares are decoration for a screen reader (the frame describes the position) and the stage is an
    // image: none of them may be focusable, or the arrow keys would move a square focus instead of stepping
    // the replay (and an image must not contain controls). The board gives one square a tabindex on every
    // render, so it is taken away again each time.
    function calmSquares() {
      if (!boardEl || typeof boardEl.querySelectorAll !== "function") return;
      Array.from(boardEl.querySelectorAll("[tabindex]")).forEach((node) => node.removeAttribute("tabindex"));
    }

    function render(input) {
      last = input;
      if (view) {
        try {
          view.render({
            pieces: input.fen,
            turn: String(input.fen).split(" ")[1] === "b" ? "b" : "w",
            interactive: false,
            lastMove: input.from && input.to ? { from: input.from, to: input.to } : null,
            check: input.check || null,
            arrows: [],
            lang: lang(),
          });
          calmSquares();
          return;
        } catch (error) {
          logError("[Ludus.classics] the board could not draw", error);
        }
      }
      if (ui && ui.miniBoard) {
        const board = ui.miniBoard(input.fen, {
          size: 640,
          orientation: current,
          coords: true,
          className: "classics-mini",
          highlight: [input.from, input.to].filter(Boolean).map((square) => ({ square })),
        });
        if (fallback && fallback.parentNode === wrap) {
          wrap.insertBefore(board, fallback);
          wrap.removeChild(fallback);
        } else {
          wrap.appendChild(board);
        }
        fallback = board;
      }
    }

    return {
      el: wrap,
      render,
      setOrientation(next) {
        current = next === "b" ? "b" : "w";
        if (view) {
          try {
            view.build(current);
          } catch (error) {
            logError("[Ludus.classics] the board could not turn", error);
          }
        }
        if (last) render(last);
      },
      usesBoard: () => Boolean(view),
      destroy() {
        if (view && typeof view.destroy === "function") {
          try {
            view.destroy();
          } catch (error) {
            // already gone
          }
        }
        view = null;
      },
    };
  }

  function defaultTrainState(record) {
    const settings = L().Settings;
    let hints = true;
    try {
      if (settings && typeof settings.get === "function") hints = settings.get("hints.enabled") !== false;
    } catch (error) {
      hints = true;
    }
    const counts = trainCounts(record ? record.positions.length : 0);
    // Ten positions are a good session; a short game is played whole.
    return { count: counts.includes(10) ? 10 : counts[counts.length - 1] || 0, hints, shuffle: false };
  }

  async function startGameTraining(id, options) {
    const Classics = classicsApi();
    const record = state.records.get(id);
    if (!Classics || !record) return false;
    const opts = options || {};
    const train = opts.train || { count: opts.count || 5, hints: defaultTrainState(record).hints, shuffle: false };
    const positions = Classics.positions(id, { count: train.count, shuffle: Boolean(train.shuffle) });
    if (!positions.length) {
      toast(t("classics.startError"), "error");
      return false;
    }
    const spec = { kind: "classic", title: gameTitle(record), positions, options: { hints: Boolean(train.hints) } };
    return startSession(spec);
  }

  async function startSinglePosition(id, ply) {
    const Classics = classicsApi();
    const record = state.records.get(id);
    if (!Classics || !record) return false;
    const position = Classics.positions(id, {}).find((entry) => entry.classic && entry.classic.ply === ply);
    if (!position) {
      toast(t("classics.startError"), "error");
      return false;
    }
    const train = state.detail && state.detail.train ? state.detail.train : defaultTrainState(record);
    return startSession({ kind: "classic", title: gameTitle(record), positions: [position], options: { hints: Boolean(train.hints) } });
  }

  function destroyDetail() {
    const d = state.detail;
    if (!d) return;
    if (d.timer && typeof root.clearTimeout === "function") root.clearTimeout(d.timer);
    d.timer = null;
    if (d.board) d.board.destroy();
    d.disposers.splice(0).forEach((dispose) => {
      try {
        dispose();
      } catch (error) {
        // the node is going away anyway
      }
    });
    state.detail = null;
  }

  function modelFor(id) {
    if (state.models.has(id)) return state.models.get(id);
    const Classics = classicsApi();
    let model = null;
    try {
      const story = Classics ? Classics.story(id) : null;
      model = buildReplayModel(story, L().chess);
    } catch (error) {
      logError("[Ludus.classics] the replay could not be built", error);
      model = null;
    }
    state.models.set(id, model);
    return model;
  }

  function noteText(entry) {
    return entry && entry.note ? quotedText(pickText(entry.note, lang())) : "";
  }

  function readingTime(text) {
    const Reader = L().Reader;
    return Reader && typeof Reader.readingTimeMs === "function" ? Reader.readingTimeMs(text, lang()) : 6000;
  }

  function sideName(color) {
    return t(color === "w" ? "classics.detail.white" : "classics.detail.black");
  }

  function renderDetailView(rootEl) {
    const id = state.gameId;
    const meta = state.games.find((game) => game.id === id);
    const record = state.records.get(id);
    if (!meta || !record) {
      state.view = "list";
      renderListView(rootEl);
      return;
    }
    const model = modelFor(id);
    const protagonist = meta.protagonist === "b" ? "b" : "w";
    const d = {
      id,
      meta,
      record,
      model,
      replay: createReplayState(model ? model.total : 0, { index: state.prefs.index || 0, speed: state.prefs.speed }),
      board: null,
      orientation: state.prefs.orientation || protagonist,
      refs: {},
      timer: null,
      disposers: [],
      train: state.prefs.train && state.prefs.trainFor === id ? state.prefs.train : defaultTrainState(record),
      userStep: false,
    };
    state.detail = d;

    const head = buildDetailHead(d);
    // The replay needs the game story (Ludus.Classics.story and Ludus.chess): without it the game is still
    // there to be trained.
    const replay = model
      ? buildReplayCard(d)
      : h("section", { class: "classics-replay-missing card card-flat", role: "status" }, icon("info", { size: 18 }), t("classics.replay.unavailable"));
    d.refs.now = model ? h("section", { class: "classics-now card", "aria-label": t("classics.replay.moment") }) : null;
    const moves = model ? buildMovesCard(d) : null;
    const train = buildTrainCard(d);
    const about = buildAboutCard(d);
    // The about card sits outside the two-column grid: a sticky replay would otherwise be allowed to slide over it.
    const page = h("div", { class: "classics-detail-page", "data-game": id },
      h("div", { class: "classics-detail" }, head, replay, d.refs.now, moves, train),
      about);
    rootEl.appendChild(page);
    if (model) bindReplayEvents(d, page);
    d.syncTrain();
    if (model) {
      updateReplay({ initial: true });
      if (d.replay.state().playing) scheduleAuto();
    }
  }

  function buildDetailHead(d) {
    const { id, meta } = d;
    const r = d.refs;
    const language = lang();
    r.headTrain = h("button", { type: "button", class: "btn btn-primary classics-head-train", "data-fkey": "head-train", onclick: () => runBusy(r.headTrain, () => startGameTraining(id, { train: d.train })) },
      icon("play", { size: 18 }), h("span", { class: "btn-label" }, t("classics.card.train")));
    return h("header", { class: "classics-detail-head" },
      h("div", { class: "classics-detail-top" },
        h("button", { type: "button", class: "btn btn-ghost btn-sm classics-back", "data-fkey": "back", onclick: () => leaveGame() },
          icon("chevron-left", { size: 18 }), h("span", { class: "btn-label" }, t("classics.detail.back"))),
        r.headTrain),
      h("p", { class: "t-eyebrow classics-detail-eyebrow" }, pickText(meta.opening, language), meta.eco ? ` · ${meta.eco}` : ""),
      h("h1", { class: "screen-title classics-detail-title", "data-screen-title": "", tabindex: "-1" }, gameTitle(meta)),
      h("p", { class: "classics-detail-players" },
        sideDot("w"), h("span", null, displayName(meta.white, language)), h("span", { class: "classics-vs" }, t("classics.detail.vs")), sideDot("b"), h("span", null, displayName(meta.black, language))),
      h("p", { class: "classics-detail-where" },
        `${whereParts(meta, language).join(" · ")} · `,
        h("span", { class: `classics-result classics-result-${resultSide(meta.result)}` }, prettyResult(meta.result))));
  }

  // The board with its player strips, the scrubber and the transport.
  function buildReplayCard(d) {
    const ui = L().ui;
    const { model } = d;
    const r = d.refs;
    r.stage = h("div", { class: "classics-stage", role: "img", "aria-label": "" });
    r.slider = h("input", {
      type: "range",
      class: "slider classics-scrub-input",
      min: "0",
      max: String(model.total),
      step: "1",
      value: "0",
      "aria-label": t("classics.replay.scrub"),
      oninput: (event) => {
        d.userStep = true;
        stopAuto();
        d.replay.pause();
        d.replay.goto(Number(event.target.value));
        updateReplay();
      },
    });
    if (ui && typeof ui.bindSlider === "function") ui.bindSlider(r.slider);
    r.counter = h("span", { class: "classics-counter t-num" });
    // A gold diamond on the track for each position the person can train.
    r.ticks = h("div", { class: "classics-ticks", "aria-hidden": "true" },
      model.plies.filter((entry) => entry.training).map((entry) => h("span", { class: "classics-tick", style: { "--at": String((entry.ply + 1) / model.total) } })));
    const scrub = h("div", { class: "classics-scrub" }, h("div", { class: "classics-scrub-track" }, r.slider, r.ticks), r.counter);

    const tbtn = (key, label, content, extra) => {
      const button = h("button", {
        type: "button",
        class: `classics-tbtn${extra ? ` ${extra}` : ""}`,
        "aria-label": label,
        title: label,
        "data-action": key,
        onclick: () => {
          if (button.getAttribute("aria-disabled") === "true") return;
          act(key);
        },
      }, content);
      return button;
    };
    r.first = tbtn("first", t("classics.replay.first"), glyph("first", 22));
    r.prev = tbtn("prev", t("classics.replay.prev"), icon("chevron-left", { size: 24 }));
    r.play = tbtn("play", t("classics.replay.play"), icon("play", { size: 24 }), "classics-tbtn-play");
    r.next = tbtn("next", t("classics.replay.next"), icon("chevron-right", { size: 24 }));
    r.last = tbtn("last", t("classics.replay.last"), glyph("last", 22));
    const transport = h("div", { class: "classics-transport", role: "group", "aria-label": t("classics.replay.title") }, r.first, r.prev, r.play, r.next, r.last);
    r.flip = tbtn("flip", t("classics.replay.flip"), glyph("flip", 20), "classics-tbtn-small classics-flip");
    r.speed = h("select", {
      class: "select classics-speed",
      "aria-label": t("classics.replay.speed"),
      title: t("classics.replay.speed"),
      onchange: (event) => {
        d.replay.setSpeed(event.target.value);
        state.prefs.speed = d.replay.state().speed;
        if (d.replay.state().playing) scheduleAuto();
      },
    }, SPEEDS.map((key) => h("option", { value: key }, t(`classics.replay.speed.${key}`))));
    r.speed.value = d.replay.state().speed;

    r.live = h("p", { class: "sr-only", role: "status", "aria-live": "polite", "aria-atomic": "true" });
    r.top = h("div", { class: "classics-player-slot classics-player-slot-top" });
    r.bottom = h("div", { class: "classics-player-slot classics-player-slot-bottom" });
    const card = h("section", { class: "classics-replay card", "aria-label": t("classics.replay.title") },
      r.top, r.stage, r.bottom,
      h("div", { class: "classics-dock" }, scrub, h("div", { class: "classics-controls-row" }, r.flip, transport, r.speed)),
      r.live);
    d.board = createBoardView(r.stage, d.orientation);
    return card;
  }

  // Two columns (White, Black) per move number; the current move is the only tab stop of the list.
  function buildMovesCard(d) {
    const r = d.refs;
    r.moves = h("div", { class: "classics-moves", role: "group", "aria-label": t("classics.replay.moves") });
    r.moveButtons = new Map();
    const cell = (entry) => {
      if (!entry) return h("span", { class: "classics-move-empty" });
      const label = spokenMove(entry) + (entry.training ? `, ${t("classics.replay.move.training")}` : "");
      const button = h("button", {
        type: "button",
        class: `classics-move${entry.training ? " is-training" : ""}`,
        tabindex: "-1",
        "aria-label": label,
        "data-ply": String(entry.ply),
        onclick: () => {
          d.userStep = true;
          stopAuto();
          d.replay.pause();
          d.replay.goto(entry.ply + 1);
          updateReplay({ focusMove: true });
        },
      }, h("span", { class: "classics-move-san" }, shownSan(entry.san)), entry.training ? h("span", { class: "classics-move-mark", "aria-hidden": "true" }) : null);
      r.moveButtons.set(entry.ply, button);
      return button;
    };
    buildMoveRows(d.model).forEach((row) => {
      r.moves.appendChild(h("div", { class: "classics-move-row" },
        h("span", { class: "classics-move-no", "aria-hidden": "true" }, `${row.no}.`), cell(row.white), cell(row.black)));
    });
    return h("section", { class: "classics-moves-card card", "aria-labelledby": "classics-moves-title" },
      h("div", { class: "classics-moves-head" },
        h("h2", { class: "classics-h3", id: "classics-moves-title" }, t("classics.replay.moves")),
        h("span", { class: "classics-legend" }, h("span", { class: "classics-move-mark", "aria-hidden": "true" }), t("classics.replay.moves.legend"))),
      r.moves);
  }

  function buildTrainCard(d) {
    const { id, record, meta } = d;
    const r = d.refs;
    const remember = () => {
      state.prefs.train = d.train;
      state.prefs.trainFor = id;
    };
    const counts = trainCounts(record.positions.length);
    r.trainCounts = segmented(t("classics.train.count"), counts.map((n) => ({ value: n, label: n === record.positions.length ? t("classics.train.all", { n }) : String(n) })), d.train.count, (value) => {
      d.train.count = value;
      remember();
      d.syncTrain();
    }, "classics-train-counts");
    const toggle = (inputId, key, value, label, hint) => {
      const input = h("input", {
        type: "checkbox",
        role: "switch",
        id: inputId,
        onchange: (event) => {
          d.train[key] = Boolean(event.target.checked);
          remember();
        },
      });
      input.checked = Boolean(value);
      return h("label", { class: "switch classics-switch", for: inputId },
        input, h("span", { class: "switch-track", "aria-hidden": "true" }),
        h("span", { class: "switch-text" }, label, h("span", { class: "switch-hint" }, hint)));
    };
    r.trainStart = h("button", { type: "button", class: "btn btn-primary btn-lg btn-block classics-train-start", "data-fkey": "train-start", onclick: () => runBusy(r.trainStart, () => startGameTraining(id, { train: d.train })) },
      icon("play", { size: 20 }), h("span", { class: "btn-label" }));
    // The count on the buttons follows the choice above them.
    d.syncTrain = () => {
      syncSegmented(r.trainCounts, d.train.count);
      const full = tCount("classics.train.start", d.train.count);
      const label = r.trainStart.querySelector(".btn-label");
      if (label) label.textContent = full;
      // The header button is short ("Train"); its accessible name says how many positions.
      if (r.headTrain) r.headTrain.setAttribute("aria-label", full);
    };
    return h("section", { class: "classics-train card card-accent", "aria-labelledby": "classics-train-title" },
      h("h2", { class: "classics-h3", id: "classics-train-title" }, t("classics.train.title")),
      h("p", { class: "classics-train-how" }, t("classics.train.how", { playing: L().Classics ? L().Classics.playingLabel(meta.protagonist === "b" ? "b" : "w") : "" })),
      progressLine(meta.id),
      counts.length > 1 ? h("div", { class: "field classics-train-field" }, h("span", { class: "field-label" }, t("classics.train.count")), r.trainCounts) : null,
      h("div", { class: "classics-train-switches" },
        toggle("classics-train-hints", "hints", d.train.hints, t("classics.train.hints"), t("classics.train.hints.hint")),
        toggle("classics-train-shuffle", "shuffle", d.train.shuffle, t("classics.train.shuffle"), t("classics.train.shuffle.hint"))),
      r.trainStart,
      h("p", { class: "classics-train-tip" }, icon("lightbulb", { size: 16 }), t("classics.replay.tip")));
  }

  // What the person has already done with this game (nothing is shown before the first answer).
  function progressLine(id) {
    const ui = L().ui;
    const progress = state.progress.get(id);
    if (!progress) return null;
    const params = { played: progress.played, total: progress.total, passed: progress.passed, accuracy: progress.accuracy };
    const done = progress.played >= progress.total;
    return h("div", { class: "classics-progress" },
      ui && ui.progress ? ui.progress(progress.played / progress.total, { label: t("classics.progress.label", params), size: "sm", tone: progress.passed >= progress.total ? "success" : null }) : null,
      h("p", { class: "classics-progress-text" }, icon("check", { size: 14 }), done ? t("classics.progress.done", params) : tCount("classics.progress.detail", progress.played, params)));
  }

  function buildAboutCard(d) {
    const { meta, record } = d;
    const language = lang();
    const facts = [
      [t("classics.detail.white"), displayName(meta.white, language)],
      [t("classics.detail.black"), displayName(meta.black, language)],
      [t("classics.about.event"), eventLabel(meta.event, language)],
      [t("classics.about.place"), siteLabel(meta.site, language)],
      [t("classics.about.date"), dateLabel(meta)],
      [t("classics.about.opening"), `${pickText(meta.opening, language)}${meta.eco ? ` (${meta.eco})` : ""}`],
      [t("classics.about.result"), `${prettyResult(meta.result)} · ${resultText(meta.result)}`],
      [t("classics.about.length"), t("classics.about.length.value", { n: moveCountOf(meta.plies) })],
    ];
    const sources = Array.isArray(record.sources) ? record.sources.filter((s) => typeof s === "string") : [];
    return h("section", { class: "classics-about card", "aria-labelledby": "classics-about-title" },
      h("h2", { class: "classics-h3", id: "classics-about-title" }, t("classics.about.title")),
      h("div", { class: "classics-about-grid" },
        h("div", { class: "classics-about-text" },
          h("p", { class: "classics-blurb" }, quotedText(pickText(meta.blurb, language))),
          h("div", { class: "classics-about-chips" },
            difficultyMark(meta.difficulty),
            ...themeChips(meta.themes, 8),
            isVerified(record) ? h("span", { class: "classics-verified classics-verified-inline", title: t("classics.card.verified.hint") }, icon("shield", { size: 14 }), t("classics.card.verified")) : null)),
        h("dl", { class: "classics-facts" }, facts.map(([label, value]) => h("div", { class: "classics-fact" }, h("dt", null, label), h("dd", null, value))))),
      sources.length
        ? h("details", { class: "classics-sources" },
          h("summary", null, icon("shield", { size: 16 }), h("span", null, t("classics.sources.title")), h("span", { class: "badge classics-sources-count" }, tCount("classics.sources.count", sources.length))),
          h("p", { class: "classics-sources-note" }, t("classics.sources.note")),
          // The notes of the sources are written in English whatever the page language says: lang="en" lets a screen reader pronounce them.
          h("ul", { class: "classics-sources-list" }, sources.map((source) => h("li", { lang: "en" }, ...linkifySource(source).map((part) => (part.href
            ? h("a", { href: part.href, title: part.href, target: "_blank", rel: "noopener noreferrer" }, sourceLinkLabel(part.href), h("span", { class: "sr-only", lang: language }, ` ${t("classics.newTab")}`))
            : part.text))))))
        : null);
  }

  // Arrow keys, Home / End and Space drive the replay from anywhere on the page except where the control
  // itself uses them (the board squares consume the arrows first: defaultPrevented). A hidden tab pauses it.
  function bindReplayEvents(d, detail) {
    const r = d.refs;
    const onKey = (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      const tag = target && target.tagName ? String(target.tagName).toUpperCase() : "";
      if (tag === "SELECT" || tag === "TEXTAREA" || (tag === "INPUT" && target.type !== "checkbox")) return;
      const inMoves = Boolean(target && r.moves && typeof r.moves.contains === "function" && r.moves.contains(target));
      let handled = true;
      switch (event.key) {
        case "ArrowLeft": act("prev", { focusMove: inMoves }); break;
        case "ArrowRight": act("next", { focusMove: inMoves }); break;
        case "ArrowUp": if (inMoves) act("back2", { focusMove: true }); else handled = false; break;
        case "ArrowDown": if (inMoves) act("fwd2", { focusMove: true }); else handled = false; break;
        case "Home": act("first", { focusMove: inMoves }); break;
        case "End": act("last", { focusMove: inMoves }); break;
        case " ":
        case "Spacebar":
          if (tag === "BUTTON" || tag === "A" || tag === "SUMMARY" || tag === "INPUT") handled = false;
          else act("toggle");
          break;
        default: handled = false;
      }
      if (handled && typeof event.preventDefault === "function") event.preventDefault();
    };
    const doc = getDoc();
    // On the document, so the keys still work when nothing on the page has focus (after a click on empty
    // space or when a control has just been disabled); only keys aimed at this page or at nothing count.
    const keyHost = doc && typeof doc.addEventListener === "function" ? doc : detail;
    const onDocKey = (event) => {
      if (state.detail !== d || !state.visible) return;
      const target = event.target;
      const inside = !target || target === doc.body || target === doc.documentElement || (typeof detail.contains === "function" && detail.contains(target));
      if (inside) onKey(event);
    };
    keyHost.addEventListener("keydown", onDocKey);
    d.disposers.push(() => keyHost.removeEventListener("keydown", onDocKey));

    if (doc && typeof doc.addEventListener === "function") {
      const onVisibility = () => {
        if (doc.hidden && d.replay.state().playing) {
          d.replay.pause();
          stopAuto();
          updateReplay();
        }
      };
      doc.addEventListener("visibilitychange", onVisibility);
      d.disposers.push(() => doc.removeEventListener("visibilitychange", onVisibility));
    }
  }

  function dateLabel(meta) {
    const raw = String(meta.date || "");
    const match = /^(\d{4})\.(\d{2}|\?\?)\.(\d{2}|\?\?)$/.exec(raw);
    if (!match) return String(meta.year || "");
    if (match[2] === "??") return match[1];
    const ts = Date.UTC(Number(match[1]), Number(match[2]) - 1, match[3] === "??" ? 1 : Number(match[3]));
    const options = match[3] === "??" ? { timeZone: "UTC", year: "numeric", month: "long" } : { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" };
    return L().util && L().util.formatDate ? L().util.formatDate(ts, lang(), options) : match[1];
  }

  // ----- Replay actions and painting -----

  function stopAuto() {
    const d = state.detail;
    if (d && d.timer && typeof root.clearTimeout === "function") root.clearTimeout(d.timer);
    if (d) d.timer = null;
  }

  function scheduleAuto() {
    const d = state.detail;
    if (!d || typeof root.setTimeout !== "function") return;
    stopAuto();
    const snap = d.replay.state();
    if (!snap.playing) return;
    const shown = plyAt(d.model, snap.index);
    const delay = autoDelayMs(snap.speed, noteText(shown), readingTime);
    d.timer = root.setTimeout(() => {
      d.timer = null;
      if (state.detail !== d) return;
      if (d.replay.tick()) {
        d.userStep = false;
        updateReplay();
        if (d.replay.state().playing) scheduleAuto();
      } else {
        updateReplay();
      }
    }, delay);
  }

  function act(action, options) {
    const d = state.detail;
    if (!d || !d.model) return;
    const opts = options || {};
    d.userStep = true;
    const idx = d.replay.state().index;
    switch (action) {
      case "first": stopAuto(); d.replay.pause(); d.replay.first(); break;
      case "prev": stopAuto(); d.replay.pause(); d.replay.prev(); break;
      case "next": stopAuto(); d.replay.pause(); d.replay.next(); break;
      case "last": stopAuto(); d.replay.pause(); d.replay.last(); break;
      case "back2": stopAuto(); d.replay.pause(); d.replay.goto(idx - 2); break;
      case "fwd2": stopAuto(); d.replay.pause(); d.replay.goto(idx + 2); break;
      case "play":
      case "toggle": {
        const wasPlaying = d.replay.state().playing;
        d.replay.toggle();
        if (wasPlaying) stopAuto();
        break;
      }
      case "flip": {
        d.orientation = d.orientation === "w" ? "b" : "w";
        state.prefs.orientation = d.orientation;
        d.board.setOrientation(d.orientation);
        updateReplay({ orientationOnly: true });
        return;
      }
      default: return;
    }
    updateReplay({ focusMove: opts.focusMove });
    if (d.replay.state().playing) scheduleAuto();
  }

  function scrollMoveIntoView(button) {
    const list = state.detail && state.detail.refs.moves;
    if (!list || !button) return;
    const top = button.offsetTop;
    const bottom = top + button.offsetHeight;
    const view = list.scrollTop;
    const height = list.clientHeight;
    if (!height) return;
    // Only the list scrolls (never the page): keep the current move inside it, near the middle.
    if (top < view + 8 || bottom > view + height - 8) list.scrollTop = Math.max(0, top - (height - button.offsetHeight) / 2);
  }

  function updateReplay(options) {
    const d = state.detail;
    if (!d) return;
    const opts = options || {};
    const r = d.refs;
    const snap = d.replay.state();
    const model = d.model;
    const meta = d.meta;
    const language = lang();
    const shown = plyAt(model, snap.index);
    const upcoming = nextPlyAt(model, snap.index);
    state.prefs.index = snap.index;

    // Board and its description.
    if (model && d.board) {
      d.board.render({ fen: fenAt(model, snap.index), from: shown ? shown.from : null, to: shown ? shown.to : null, check: shown ? shown.check : null });
    }
    const boardLabel = shown ? t("classics.replay.board", { move: spokenMove(shown) }) : t("classics.replay.board.start");
    const spoken = describeFen(fenAt(model, snap.index), t);
    r.stage.setAttribute("aria-label", spoken ? `${boardLabel}. ${spoken}` : boardLabel);

    // Player strips follow the orientation (the person's side is at the bottom by default).
    const white = displayName(meta.white, language);
    const black = displayName(meta.black, language);
    const protagonist = meta.protagonist === "b" ? "b" : "w";
    const strip = (color) => playerStrip(color, color === "w" ? white : black, color === protagonist);
    const topColor = d.orientation === "w" ? "b" : "w";
    if (r.topColor !== topColor || opts.initial || opts.orientationOnly) {
      r.topColor = topColor;
      clear(r.top);
      clear(r.bottom);
      r.top.appendChild(strip(topColor));
      r.bottom.appendChild(strip(topColor === "w" ? "b" : "w"));
    }

    // Controls.
    r.slider.value = String(snap.index);
    r.slider.setAttribute("aria-valuetext", snap.index === 0 ? t("classics.replay.scrub.start") : t("classics.replay.scrub.value", { n: snap.index, total: snap.total }));
    if (typeof r.slider.style.setProperty === "function") {
      const ratio = snap.total ? snap.index / snap.total : 0;
      r.slider.style.setProperty("--pct", `${Math.round(ratio * 1000) / 10}%`);
    }
    r.counter.textContent = t("classics.replay.counter", { n: snap.index, total: snap.total });
    // aria-disabled, not disabled: a disabled button would drop the keyboard focus the moment the end is reached.
    [[r.first, snap.atStart], [r.prev, snap.atStart], [r.next, snap.atEnd], [r.last, snap.atEnd]].forEach(([button, off]) => button.setAttribute("aria-disabled", String(off)));
    const label = snap.playing ? t("classics.replay.pause") : t("classics.replay.play");
    r.play.setAttribute("aria-label", label);
    r.play.setAttribute("title", label);
    r.play.setAttribute("aria-pressed", String(snap.playing));
    clear(r.play);
    const playIcon = icon(snap.playing ? "pause" : "play", { size: 24 });
    // Without the kit's icons the button keeps a text glyph, so it is never empty.
    r.play.appendChild(playIcon || getDoc().createTextNode(snap.playing ? "❚❚" : "▶"));

    // The note of the moment, the training cue and the state of the game.
    renderNow(d, shown, upcoming, snap);

    // The list of moves: the current one is marked and is the only tab stop.
    const activePly = shown ? shown.ply : -1;
    const stop = activePly >= 0 ? activePly : (model && model.total ? 0 : -1);
    // Only the two buttons that change are touched (a game of 271 plies has 271 of them).
    (r.marked || []).forEach((button) => {
      button.removeAttribute("aria-current");
      button.classList.remove("is-current");
      button.setAttribute("tabindex", "-1");
    });
    const marked = r.moveButtons.get(activePly);
    if (marked) {
      marked.setAttribute("aria-current", "step");
      marked.classList.add("is-current");
    }
    const current = r.moveButtons.get(stop);
    if (current) current.setAttribute("tabindex", "0");
    r.marked = [marked, current].filter(Boolean);
    if (current) {
      scrollMoveIntoView(r.moveButtons.get(activePly));
      if (opts.focusMove && typeof current.focus === "function") current.focus({ preventScroll: true });
    }

    // A person's step is announced; the automatic replay is not (it would talk over the person).
    if (d.userStep && !opts.initial && !opts.orientationOnly) {
      let text;
      if (!shown) text = t("classics.replay.status.start");
      else {
        text = t("classics.replay.status", { no: shown.moveNumber, side: sideName(shown.color), san: spokenSan(shown.san) });
        if (snap.atEnd) text += ` ${t("classics.replay.status.end", { result: resultText(meta.result) })}`;
      }
      r.live.textContent = text;
    }
  }

  function renderNow(d, shown, upcoming, snap) {
    const r = d.refs;
    const meta = d.meta;
    clear(r.now);
    const note = noteText(shown);
    const Classics = L().Classics;
    if (!shown) {
      r.now.appendChild(h("p", { class: "t-eyebrow" }, t("classics.replay.start.title")));
      r.now.appendChild(h("p", { class: "classics-now-hint" }, t("classics.replay.start.hint")));
    } else {
      r.now.appendChild(h("p", { class: "t-eyebrow" }, t(`classics.replay.turn.${shown.color}`, { n: shown.moveNumber })));
      // Drawn in the notation the person chose; a screen reader gets the move in words (the eyebrow above already says whose move and which number).
      const drawnPly = showPly(shown);
      const spokenPly = spokenSan(shown.san);
      r.now.appendChild(h("p", { class: "classics-now-move" },
        spokenPly && spokenPly !== drawnPly ? [h("span", { "aria-hidden": "true" }, drawnPly), " ", h("span", { class: "sr-only" }, spokenPly)] : drawnPly));
    }
    if (note) {
      r.now.appendChild(h("div", { class: "classics-note" },
        h("p", { class: "classics-note-label" }, icon("sparkles", { size: 14 }), t("classics.replay.moment")),
        h("p", { class: "classics-note-text" }, note)));
    } else if (shown && shown.training) {
      r.now.appendChild(h("div", { class: "classics-cue is-past" },
        h("p", { class: "classics-cue-label" }, icon("target", { size: 14 }), t("classics.replay.training"), shown.kind && Classics ? h("span", { class: "chip classics-chip" }, Classics.kindLabel(shown.kind)) : null),
        h("p", { class: "classics-cue-text" }, t("classics.replay.trainingPast"))));
    }
    if (upcoming && upcoming.training) {
      const tryButton = h("button", { type: "button", class: "btn btn-secondary btn-sm classics-try", "data-fkey": "try-position", onclick: () => runBusy(tryButton, () => startSinglePosition(d.id, upcoming.ply)) },
        icon("play", { size: 14 }), h("span", { class: "btn-label" }, t("classics.replay.try")));
      r.now.appendChild(h("div", { class: "classics-cue" },
        h("p", { class: "classics-cue-label" }, icon("target", { size: 14 }), t("classics.replay.training"), upcoming.kind && Classics ? h("span", { class: "chip classics-chip" }, Classics.kindLabel(upcoming.kind)) : null),
        h("p", { class: "classics-cue-text" }, t("classics.replay.trainingNext")),
        tryButton));
    }
    if (snap.atEnd && snap.total) {
      r.now.appendChild(h("p", { class: "classics-now-end" }, icon("flag", { size: 16 }), t("classics.replay.end", { result: `${resultText(meta.result)} (${prettyResult(meta.result)})` })));
    }
  }

  // ---------- Navigation ----------

  function gameIdFromParams(params) {
    const p = params && typeof params === "object" ? params : {};
    const id = p.game || p.gameId || p.id;
    return typeof id === "string" && id ? id : null;
  }

  // `immediate`: the person just opened or closed a game, so the entry that was written for it gets its address now; otherwise the address waits
  // until the shell has mirrored the screen id into the hash (it does so on screen:changed) and says whatever view is on show by then.
  function mirrorHash(id, immediate) {
    const run = () => {
      try {
        if (!state.visible || !root.history || typeof root.history.replaceState !== "function" || !root.location) return;
        const wanted = buildGameHash(immediate ? id : (state.view === "game" ? state.gameId : null));
        if (root.location.hash === wanted) return;
        root.history.replaceState(root.history.state, "", `${root.location.pathname}${root.location.search}${wanted}`);
      } catch (error) {
        // sandboxed frames and file:// can refuse; the hash is only a convenience
      }
    };
    if (immediate || typeof root.setTimeout !== "function") run();
    else root.setTimeout(run, 0);
  }

  // ----- Browser history: the game page is a sub-state of the screen (QA PB-5) -----
  //
  // The gallery is the base state of the classics entry and a game page is { game: id }, so the browser's Back and Forward (a phone's Back gesture)
  // go between the gallery and a game before they leave the screen, and the page's own "All games" is one step Back. `list: 1` marks a page that was
  // opened from the gallery entry right below it: only then is "All games" a real Back (a page that a route or a typed address opened has something
  // else below it, and the button closes it in place). When one of those entries comes back, the router calls onSub(sub). Without a history
  // (Node, a sandboxed frame) every call here is a no-op and the screen behaves as it always did.

  function gameSub(id, fromList) {
    if (!id) return null;
    return fromList ? { game: id, list: 1 } : { game: id };
  }

  // The router's entry on show ({ id, sub?, depth?, seq }), or null when the entry is not one of its (an address typed by hand made it) or there is no history.
  function historyEntry() {
    try {
      const entry = root.history && root.history.state && root.history.state.ludus;
      return entry && typeof entry === "object" ? entry : null;
    } catch (error) {
      return null;
    }
  }

  // The game an entry of this screen says it was left on, null for the gallery and for anything else.
  function gameOfEntry(entry) {
    return entry && entry.id === "classics" && entry.sub && typeof entry.sub.game === "string" && entry.sub.game ? entry.sub.game : null;
  }

  // push: the person opened a game (a new entry); otherwise the entry on show is made to say what the screen shows (an entry that a typed address
  // made is adopted, so a later push does not overwrite it). A popped entry answers for itself: show() runs before its onSub does.
  function recordView(push, fromList) {
    const router = L().router;
    if (!router || typeof router.pushSub !== "function" || typeof router.replaceSub !== "function") return false;
    try {
      if (typeof router.current === "function" && router.current() !== "classics") return false;
      const id = state.view === "game" ? state.gameId : null;
      if (push) return router.pushSub(gameSub(id, fromList)) !== false;
      const entry = historyEntry();
      if (entry && entry.id !== "classics") return false;
      if (!entry || gameOfEntry(entry) !== id) router.replaceSub(gameSub(id, false));
    } catch (error) {
      // The history is a convenience: the page is shown either way.
    }
    return false;
  }

  // Leaves the entry of a game page for the gallery with one step Back when the gallery is the entry right below it (the history keeps no dead
  // entry); true when that was done (the router then calls onSub(null)), false when the caller has to close the page itself.
  function stepBackToGallery() {
    const router = L().router;
    const entry = historyEntry();
    if (!entry || !entry.sub || !entry.sub.list || gameOfEntry(entry) !== state.gameId) return false;
    try {
      return Boolean(router && typeof router.popSub === "function" && typeof router.subDepth === "function" && router.subDepth() > 0 && router.popSub());
    } catch (error) {
      return false;
    }
  }

  function openGame(id, options) {
    const opts = options || {};
    if (!state.mounted) return false;
    if (state.status !== "ready") {
      state.pendingGame = id;
      return false;
    }
    if (!state.records.has(id)) {
      state.notice = t("classics.notFound");
      closeGame({ silent: true });
      return false;
    }
    if (opts.fromList) {
      try {
        state.listScroll = Number(root.scrollY || (root.pageYOffset) || 0);
      } catch (error) {
        state.listScroll = 0;
      }
      state.lastOpened = id;
    }
    if (state.gameId !== id) {
      state.prefs.index = 0;
      state.prefs.orientation = null;
    }
    state.notice = "";
    // A game the person opens from the gallery is a new entry of the history (recorded before anything is drawn, so the browser keeps the
    // gallery's scroll position with the entry it leaves); one that Back or Forward brought here already has its entry.
    const entry = historyEntry();
    const fromGallery = state.view === "list" && Boolean(entry && entry.id === "classics" && !entry.sub);
    state.view = "game";
    state.gameId = id;
    if (opts.record === "push") recordView(true, fromGallery);
    render();
    scrollToTop();
    focusHeading();
    mirrorHash(id, opts.record === "push");
    return true;
  }

  // `silent`: no scroll or focus to restore. `record: "none"`: the router already moved the entry (Back or Forward landed on the gallery).
  function closeGame(options) {
    const opts = options || {};
    const returning = state.lastOpened;
    state.view = "list";
    state.gameId = null;
    state.prefs.index = 0;
    state.prefs.orientation = null;
    render();
    if (!opts.silent) {
      const target = returning && state.container && typeof state.container.querySelector === "function"
        ? state.container.querySelector(`[data-fkey="open-${returning}"]`)
        : null;
      jumpTo(state.listScroll || 0);
      if (target && typeof target.focus === "function") target.focus({ preventScroll: true });
    }
    if (opts.record !== "none") recordView(false);
    mirrorHash(null);
  }

  // The "All games" button of a game page: one step Back when the gallery is the entry below (the router then closes the page through onSub),
  // else the page is closed where it stands.
  function leaveGame() {
    if (stepBackToGallery()) return;
    closeGame();
  }

  function focusHeading() {
    const el = state.container && typeof state.container.querySelector === "function" ? state.container.querySelector("[data-screen-title]") : null;
    if (el && typeof el.focus === "function") {
      try {
        el.focus({ preventScroll: true });
      } catch (error) {
        // focus is best effort
      }
    }
  }

  function applyPendingRoute() {
    if (state.pendingGame) {
      const id = state.pendingGame;
      state.pendingGame = null;
      if (state.records.has(id)) {
        state.view = "game";
        state.gameId = id;
        state.prefs.index = 0;
        state.prefs.orientation = null;
        mirrorHash(id);
      } else {
        state.notice = t("classics.notFound");
        state.view = "list";
        state.gameId = null;
        mirrorHash(null);
      }
    }
  }

  // #/classics/<id>: on a cold start (captured at mount: the boot code replaces the hash) and on hashchange.
  function goToHash(hash) {
    const id = parseGameHash(hash);
    if (!id || sessionActive()) return false;
    const router = L().router;
    if (router && typeof router.show === "function") return router.show("classics", { game: id }) !== false;
    return false;
  }

  function onHashChange(event) {
    let hash = root.location ? root.location.hash : "";
    // The address the event is about, not the one in the bar by now: while Back is being handled the shell may already have rewritten the bar to the
    // plain screen id ("#/classics"), which would read as a person asking for the gallery and close the game Back has just brought back.
    if (event && typeof event.newURL === "string") {
      const at = event.newURL.indexOf("#");
      hash = at < 0 ? "" : event.newURL.slice(at);
    }
    if (parseGameHash(hash)) {
      if (state.visible && state.view === "game" && state.gameId === parseGameHash(hash)) return;
      goToHash(hash);
    } else if (isClassicsHash(hash) && state.visible && state.view === "game") {
      closeGame({ silent: true });
    }
  }

  // ---------- Whole screen ----------

  // The tab title says where the person is: the router sets "Partidas clásicas - Ludus Scaccorum"; a game page puts the game first
  // ("La Ópera - Partidas clásicas - Ludus Scaccorum"). Only while the screen is showing (QA A11Y-024, WCAG 2.4.2).
  function docTitleFor(view, meta, language) {
    const site = "Ludus Scaccorum";
    const screenTitle = t("classics.title");
    const game = view === "game" && meta ? pickText(meta.title, language) : "";
    return game ? `${game} - ${screenTitle} - ${site}` : `${screenTitle} - ${site}`;
  }

  function syncDocTitle() {
    const doc = getDoc();
    if (!doc || !state.visible) return;
    const meta = state.view === "game" && state.status === "ready" ? state.games.find((game) => game.id === state.gameId) : null;
    try {
      doc.title = docTitleFor(meta ? "game" : "list", meta, lang());
    } catch (error) {
      // cosmetic only
    }
  }

  function render() {
    if (!state.mounted || !state.container || !getDoc() || !L().util) return;
    destroyDetail();
    const container = state.container;
    clear(container);
    state.refs = {};
    const rootEl = h("div", { class: `classics${state.view === "game" ? " is-detail" : ""}` });
    container.appendChild(rootEl);
    try {
      if (state.view === "game" && state.status === "ready") renderDetailView(rootEl);
      else renderListView(rootEl);
    } catch (error) {
      logError("[Ludus.classics] the screen could not be drawn", error);
      clear(rootEl);
      rootEl.appendChild(h("p", { class: "classics-notice" }, t("classics.error.title")));
    }
    syncDocTitle();
  }

  function on(evt, fn) {
    const bus = L().bus;
    if (bus && typeof bus.on === "function") state.offs.push(bus.on(evt, fn));
  }

  const screen = {
    // Router title (an i18n key): "Partidas clásicas - Ludus Scaccorum".
    titleKey: "classics.title",
    title: "classics.title",
    mount(container) {
      const doc = getDoc();
      if (!doc || !container || !L().util) return;
      if (state.mounted && state.container === container) {
        render();
        return;
      }
      state.container = container;
      state.mounted = true;
      state.mix = readMix();
      state.hashOnMount = root.location ? String(root.location.hash || "") : "";
      render();
      on("language:changed", () => {
        state.cards.clear();
        render();
      });
      on("profile:changed", () => { renderDailySlot(); refreshProgress(); });
      on("session:completed", () => { renderDailySlot(); refreshProgress(); });
      if (typeof root.addEventListener === "function") {
        root.addEventListener("hashchange", onHashChange);
        state.domOffs.push(() => root.removeEventListener("hashchange", onHashChange));
      }
      // A page opened straight on "#/classics/<id>": the shell only knows the plain screen ids.
      if (parseGameHash(state.hashOnMount) && typeof root.setTimeout === "function") {
        const wanted = state.hashOnMount;
        root.setTimeout(() => { goToHash(wanted); }, 0);
      }
      const router = L().router;
      if (router && typeof router.current === "function" && router.current() === "classics") screen.show({});
    },
    show(params) {
      const wasVisible = state.visible;
      state.visible = true;
      if (!state.mounted) return;
      let wanted = gameIdFromParams(params);
      // A popped entry of this screen says which view it was left on (the router calls show() before its onSub()); anything else that shows the screen
      // (a tab of the shell, a route without a game) starts on the gallery, and a game the person asked for by name is the one they get.
      if (!wanted && !wasVisible) wanted = gameOfEntry(historyEntry());
      // The Classics tab pressed on a game page: back to the gallery, in one step Back when the gallery is the entry below it.
      const leaving = !wanted && wasVisible && state.view === "game" && stepBackToGallery();
      state.notice = "";
      state.pendingGame = wanted;
      if (state.status === "ready") {
        applyPendingRoute();
        if (!wanted) {
          state.view = "list";
          state.gameId = null;
        }
        render();
        if (state.view === "game") focusHeading();
        if (!leaving) recordView(false);
        return;
      }
      if (!wanted) {
        state.view = "list";
        state.gameId = null;
      }
      render();
      ensureData().then(() => {
        if (!state.mounted || !state.visible) return;
        applyPendingRoute();
        render();
        recordView(false);
      });
    },
    // Back or Forward landed on one of this screen's entries (Ludus.router calls this with the entry's sub-state: null = the gallery).
    onSub(sub) {
      if (!state.mounted || !state.visible) return;
      const id = sub && typeof sub.game === "string" && sub.game ? sub.game : null;
      if (id) {
        if (state.view === "game" && state.gameId === id) return;
        openGame(id, { record: "none" });
      } else if (state.view === "game") {
        closeGame({ record: "none" });
      }
    },
    hide() {
      state.visible = false;
      stopAuto();
      const d = state.detail;
      if (d && d.replay) d.replay.pause();
      destroyDetail();
      // The page of a game holds a board and timers: it goes away with the screen (show() draws it again).
      if (d && state.container) clear(state.container);
    },
    render,
    destroy() {
      destroyDetail();
      state.offs.splice(0).forEach((off) => off());
      state.domOffs.splice(0).forEach((off) => off());
      state.mounted = false;
    },
    // Pure helpers (also used by scripts/tests/classics-ui.test.js).
    helpers: {
      eraOf,
      normalizeText,
      defaultFilters,
      cleanFilters,
      hasActiveFilters,
      activeFilterCount,
      matchesQuery,
      matchesGame,
      filterGames,
      sortGames,
      facetOptions,
      summarize,
      moveCountOf,
      signatureOf,
      trainCounts,
      countMixPositions,
      progressByGame,
      isVerified,
      linkifySource,
      sourceLinkLabel,
      docTitleFor,
      parseGameHash,
      isClassicsHash,
      buildGameHash,
      displayName,
      eventLabel,
      localizeMeta,
      siteLabel,
      cityLabel,
      whereParts,
      eventNamesCity,
      resultSide,
      prettyResult,
      buildReplayModel,
      fenAt,
      plyAt,
      nextPlyAt,
      formatPly,
      shownSan,
      spokenSan,
      spokenMove,
      showPly,
      buildMoveRows,
      createReplayState,
      autoDelayMs,
      describeFen,
      localDateKey,
      SPEED_MS,
      SPEEDS,
      MIX_COUNTS,
      FILTER_ERAS,
      SORTS,
    },
    TEXT,
    _state: state,
  };

  return screen;
});
