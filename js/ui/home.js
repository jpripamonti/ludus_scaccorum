// Landing page and home hub (Ludus.Screens.landing, Ludus.Screens.home).
// Contract: docs/ARCHITECTURE.md sections 15 and 20; styles in css/home.css
// (prefixes .ld- for the landing, .home- for the hub, .duel- for the duel setup).
//
//   Ludus.Screens.landing.mount(el)   el = #landing-screen. index.html already holds
//                                     the hero (with #landing-start-btn, which app.js
//                                     binds); mount localises it and renders the
//                                     sections below it (steps, features, privacy,
//                                     footer). Re-renders on language:changed.
//   Ludus.Screens.home.mount(el)      el = #screen-home. Renders the hub from the
//                                     active profile, keeps itself fresh on
//                                     language:changed / profile:changed /
//                                     notebook:changed / session:completed.
//   Ludus.Screens.home.show()         (router onShow) refreshes and loads the daily
//                                     challenge; hide() is a no-op.
//   Ludus.Screens.home.startDaily()   starts today's daily challenge (also what the
//                                     "#/daily" hash and the PWA shortcut call).
//   Ludus.Screens.home.openDuelSetup() opens the duel setup dialog.
//
// Everything is built with Ludus.util.h (text is never parsed as HTML). Data
// comes from Ludus.Profile, Ludus.Classics and Ludus.Facts; sessions are started
// only through Ludus.game.startSession / openOwnGamesSetup (owned by app.js).
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Screens = root.Ludus.Screens || {};
  root.Ludus.Screens.home = api.home;
  root.Ludus.Screens.landing = api.landing;
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
    return i18n && typeof i18n.lang === "function" ? i18n.lang() : "es";
  }

  function icon(name, options) {
    const ui = L().ui;
    return ui && typeof ui.icon === "function" ? ui.icon(name, options) : null;
  }

  // Moves quoted in a fact ("1.e4 e5 2.Cf3 Cc6") are re-spelled by the data module for the notation setting like every move on screen
  // (Ludus.Classics.localizeQuotedMoves); the text is unchanged without it.
  function quotedText(text, language) {
    const Classics = L().Classics;
    if (!text || !Classics || typeof Classics.localizeQuotedMoves !== "function") return text;
    try {
      return Classics.localizeQuotedMoves(text, language === "en" ? "en" : "es");
    } catch (error) {
      return text;
    }
  }

  // A count in words: the singular form lives under "<key>.one" (both languages use one rule: exactly 1 is singular, 0 and the rest are plural).
  function tCount(key, n, params) {
    const i18n = L().i18n;
    const singular = Number(n) === 1 && i18n && typeof i18n.has === "function" && i18n.has(`${key}.one`);
    return t(singular ? `${key}.one` : key, Object.assign({ n }, params || {}));
  }

  function logError(...args) {
    if (root.console && typeof root.console.error === "function") root.console.error(...args);
  }

  // ---------- Text ----------

  const TEXT = {
    es: {
      "home.title": "Inicio",
      "home.greet.morning": "Buen día, {name}",
      "home.greet.afternoon": "Buenas tardes, {name}",
      "home.greet.evening": "Buenas noches, {name}",
      "home.greet.anon": "¡Hola! ¿Empezamos?",
      "home.sub.first": "Elegí cómo querés entrenar. Con tu primera posición empezamos a armar tu progreso.",
      "home.sub.risk": "Tu racha de {n} días depende de que entrenes hoy.",
      "home.sub.risk.one": "Tu racha de 1 día depende de que entrenes hoy.",
      "home.sub.due": "Tenés {n} posiciones para repasar en tu cuaderno de errores.",
      "home.sub.due.one": "Tenés 1 posición para repasar en tu cuaderno de errores.",
      "home.sub.default": "¿Qué entrenamos hoy? Cada posición es una oportunidad de aprender algo nuevo.",
      "home.level.label": "Nivel",
      "home.level.progress": "{xp} XP · faltan {n} para {next}",
      "home.level.progress.one": "{xp} XP · falta 1 para {next}",
      "home.level.max": "{xp} XP · nivel máximo",
      "home.level.first": "Cada posición suma hasta 100 XP. Jugá una para empezar a subir de nivel.",
      "home.stat.streak": "Racha",
      "home.stat.streak.hint": "días seguidos",
      "home.stat.streak.hint.one": "día seguido",
      "home.stat.positions": "Posiciones jugadas",
      "home.stat.accuracy": "Precisión media",
      "home.stat.accuracy.hint": "de 100",
      "home.section.modes": "Elegí cómo entrenar",
      "home.section.more": "Más para explorar",
      "home.mode.own.title": "Tus partidas",
      "home.mode.own.body": "Traemos tus partidas de Lichess o Chess.com y encontramos dónde te equivocaste.",
      "home.mode.classics.title": "Partidas clásicas",
      "home.mode.classics.body": "Posiciones clave de las grandes partidas de la historia, con la jugada del maestro.",
      "home.mode.review.title": "Repasar tus errores",
      "home.mode.review.due.one": "1 posición te espera. Repasarla hoy es lo que más rinde.",
      "home.mode.review.due": "{n} posiciones te esperan. Repasarlas hoy es lo que más rinde.",
      "home.mode.review.clear": "Estás al día. Tu cuaderno guarda {n} posiciones para más adelante.",
      "home.mode.review.clear.one": "Estás al día. Tu cuaderno guarda 1 posición para más adelante.",
      "home.mode.review.empty": "Todavía no hay errores para repasar. Jugá unas posiciones y los vamos guardando acá para que vuelvas a ellos.",
      "home.mode.review.badge": "Para repasar",
      "home.mode.duel.title": "Duelo",
      "home.mode.duel.body": "Dos personas, un dispositivo: cada uno juega su turno y comparan quién estuvo más cerca del motor.",
      "home.mode.cta": "Empezar",
      "home.tile.progress.title": "Progreso",
      "home.tile.progress.body": "Tus números, tendencias y logros.",
      "home.tile.museum.title": "Historia y curiosidades",
      "home.tile.museum.body": "Datos, hitos y anécdotas del ajedrez.",
      "home.tile.settings.title": "Ajustes",
      "home.tile.settings.body": "Tablero, sonido, reloj y accesibilidad.",
      "home.daily.eyebrow": "Desafío diario",
      "home.daily.title.pending": "La posición de hoy",
      "home.daily.title.done": "¡Desafío de hoy completado!",
      "home.daily.body.pending": "Una posición de una partida clásica cada día, sin repetirse durante meses. Encontrá la mejor jugada.",
      "home.daily.body.done": "Tu precisión fue {accuracy}%. Volvé mañana: te espera otra posición.",
      "home.daily.turn": "Juegan las {side}",
      "home.daily.streak": "Racha del desafío: {n} días",
      "home.daily.streak.one": "Racha del desafío: 1 día",
      "home.daily.risk": "Completalo hoy para no perder tu racha de {n} días.",
      "home.daily.risk.one": "Completalo hoy para no perder tu racha de 1 día.",
      "home.daily.play": "Jugar ahora",
      "home.daily.more": "Seguir con clásicos",
      "home.daily.done.badge": "Completado",
      "home.first.play": "Jugar la posición de hoy",
      "home.first.more": "Ver otras formas de entrenar",
      "home.daily.already": "Ya hiciste el desafío de hoy. Mañana te espera otra posición; mientras tanto, practicá con las partidas clásicas.",
      "home.daily.pending.badge": "Pendiente",
      "home.daily.board": "Posición del desafío diario",
      "home.daily.loading": "Cargando el desafío de hoy",
      "home.daily.error": "No pudimos cargar el desafío de hoy. Revisá tu conexión e intentá de nuevo.",
      "home.daily.sessionTitle": "Desafío diario",
      "home.daily.noGame": "El juego todavía no está listo. Probá de nuevo en un instante.",
      "home.fact.title": "¿Sabías que…?",
      "home.fact.next": "Otro dato",
      "home.fact.more": "Explorar Historia y curiosidades",
      "home.fact.empty": "Todavía no hay datos para mostrar.",
      "home.retry": "Reintentar",
      "home.error.start": "No se pudo abrir esa opción.",
      "duel.title": "Duelo en un dispositivo",
      "duel.intro": "Se turnan en este mismo dispositivo. Gana quien juegue más cerca de la mejor jugada.",
      "duel.fair": "Para que sea justo: se turnan para empezar cada posición. Quien va primero juega (con su reloj, si lo activaste) y el otro mira para otro lado hasta que le toque. Después se pasan el dispositivo: la jugada del primero queda oculta.",
      "duel.players": "Jugadores",
      "duel.player": "Participante {n}",
      "duel.who": "¿Quién es el jugador {n}?",
      "duel.guest": "Sin perfil (escribir un nombre)",
      "duel.guestName": "Nombre del jugador {n}",
      "duel.guestDefault": "Participante {n}",
      "duel.source": "Posiciones",
      "duel.source.mix": "Mezcla de clásicos",
      "duel.source.mix.hint": "Posiciones al azar de varias partidas de la historia.",
      "duel.source.game": "Una partida clásica",
      "duel.source.game.hint": "Las posiciones clave de una sola partida, en orden.",
      "duel.source.own": "Tus partidas",
      "duel.source.own.hint": "Descargamos partidas de Lichess o Chess.com, solo con tu permiso.",
      "duel.game": "Partida",
      "duel.count": "Cantidad de posiciones",
      "duel.count.option": "{n} posiciones",
      "duel.start": "Empezar duelo",
      "duel.preparing": "Preparando posiciones…",
      "duel.error.same": "Elegí dos jugadores distintos.",
      "duel.error.load": "No pudimos cargar las partidas clásicas. Revisá tu conexión e intentá de nuevo.",
      "duel.error.empty": "No encontramos posiciones para armar el duelo.",
      "duel.error.game": "Elegí una partida.",
      "duel.title.mix": "Duelo: mezcla de clásicos",
      "duel.title.game": "Duelo: {game}",
      "ld.eyebrow": "Entrenador de ajedrez",
      "ld.lead": "Aprendé ajedrez de tus errores y de las partidas clásicas: cuanto más cerca juegues de la mejor jugada, más puntos ganás.",
      "ld.cta": "Empezar a entrenar",
      "ld.how": "Cómo funciona",
      "ld.assure": "Sin registro. Tus datos quedan en tu dispositivo.",
      "ld.steps.eyebrow": "Cómo funciona",
      "ld.steps.title": "Tres pasos para aprender de cada posición",
      "ld.step": "Paso {n}",
      "ld.step1.title": "Mirá la posición",
      "ld.step1.body": "Te mostramos una posición real, de tus partidas o de una partida clásica. Pensá cuál es la mejor jugada.",
      "ld.step2.title": "Jugá y mirá qué tan cerca estuviste",
      "ld.step2.body": "El motor Stockfish evalúa tu jugada: cuanto más se acerca a la mejor, más puntos sumás.",
      "ld.step3.title": "Entendé el porqué y volvé más tarde",
      "ld.step3.body": "Cada error queda en tu cuaderno y reaparece cada vez más espaciado, hasta que lo dominás.",
      "ld.step.example": "Ejemplo ilustrativo",
      "ld.step2.yours": "Tu jugada",
      "ld.step2.best": "La mejor",
      "ld.step2.points": "Puntos",
      "ld.step3.days": "{n} d",
      "ld.step3.label": "Volvés a verla",
      "ld.step3.today": "Hoy",
      "ld.source.eyebrow": "Dos fuentes de posiciones",
      "ld.source.title": "Aprendé de tus partidas y de los maestros",
      "ld.own.title": "Tus propias partidas",
      "ld.own.body": "Traemos tus partidas públicas de Lichess o Chess.com, buscamos dónde te equivocaste y las convertimos en ejercicios a tu medida. Solo se descargan con tu permiso.",
      "ld.classic.title": "Las partidas clásicas",
      "ld.classic.body": "Posiciones clave de grandes partidas de la historia, con la jugada del maestro y el veredicto del motor. Aprendé cómo pensaban.",
      "ld.private.eyebrow": "Privado por diseño",
      "ld.private.title": "Tu ajedrez es tuyo",
      "ld.private.a.title": "Sin cuenta",
      "ld.private.a.body": "Abrís la página y entrenás. No hace falta registrarse.",
      "ld.private.b.title": "Datos en tu dispositivo",
      // polish-corecopy (PC-3): the disclosure that own-game rounds keep usernames and game links lives in this card, which every visitor sees.
      "ld.private.b.body": "Tu progreso vive en tu navegador. Esta app no tiene servidor ni base de datos, así que nada de esto nos llega. Si entrenás con tus partidas, también se guardan tu usuario, el de tus rivales y el enlace a cada partida. Lo borrás desde Cuenta.",
      "ld.private.c.title": "Sincronización opcional",
      "ld.private.c.body": "Si querés, iniciá sesión con Google para llevar tu progreso, con esos datos, a otros dispositivos a través de tu propio Google Drive.",
      "ld.private.d.title": "Vos decidís qué se descarga",
      "ld.private.d.body": "La app solo se conecta a Lichess o Chess.com cuando se lo pedís y confirmás tu usuario.",
      "ld.final.title": "¿Listo para tu primera posición?",
      "ld.final.body": "Tarda un minuto empezar. Lo demás lo va armando tu progreso.",
      "ld.footer.tagline": "Entrená tu ajedrez con posiciones reales.",
      "ld.footer.version": "Versión {version}",
      "ld.footer.license": "Licencia GPL-3.0-or-later",
      "ld.footer.engine": "Motor de ajedrez: Stockfish (GPL-3.0)",
      "ld.footer.notices": "Avisos de terceros",
      "ld.footer.newTab": "(se abre en otra pestaña)",
      "ld.footer.language": "Idioma",
      "ld.footer.top": "Volver arriba",
    },
    en: {
      "home.title": "Home",
      "home.greet.morning": "Good morning, {name}",
      "home.greet.afternoon": "Good afternoon, {name}",
      "home.greet.evening": "Good evening, {name}",
      "home.greet.anon": "Hello! Shall we start?",
      "home.sub.first": "Pick how you want to train. Your first position starts building your progress.",
      "home.sub.risk": "Your {n}-day streak depends on training today.",
      "home.sub.risk.one": "Your 1-day streak depends on training today.",
      "home.sub.due": "You have {n} positions to review in your mistake notebook.",
      "home.sub.due.one": "You have 1 position to review in your mistake notebook.",
      "home.sub.default": "What shall we train today? Every position is a chance to learn something new.",
      "home.level.label": "Level",
      "home.level.progress": "{xp} XP · {n} to {next}",
      "home.level.progress.one": "{xp} XP · 1 to {next}",
      "home.level.max": "{xp} XP · top level",
      "home.level.first": "Each position is worth up to 100 XP. Play one to start leveling up.",
      "home.stat.streak": "Streak",
      "home.stat.streak.hint": "days in a row",
      "home.stat.streak.hint.one": "day in a row",
      "home.stat.positions": "Positions played",
      "home.stat.accuracy": "Average accuracy",
      "home.stat.accuracy.hint": "out of 100",
      "home.section.modes": "Choose how to train",
      "home.section.more": "More to explore",
      "home.mode.own.title": "Your games",
      "home.mode.own.body": "We fetch your Lichess or Chess.com games and find where you went wrong.",
      "home.mode.classics.title": "Classic games",
      "home.mode.classics.body": "Key positions from the great games of history, with the master's move.",
      "home.mode.review.title": "Review your mistakes",
      "home.mode.review.due.one": "1 position is waiting. Reviewing it today pays off the most.",
      "home.mode.review.due": "{n} positions are waiting. Reviewing them today pays off the most.",
      "home.mode.review.clear": "You are up to date. Your notebook keeps {n} positions for later.",
      "home.mode.review.clear.one": "You are up to date. Your notebook keeps 1 position for later.",
      "home.mode.review.empty": "No mistakes to review yet. Play a few positions and we will save them here so you can come back to them.",
      "home.mode.review.badge": "To review",
      "home.mode.duel.title": "Duel",
      "home.mode.duel.body": "Two people, one device: each plays their turn and you compare who came closest to the engine.",
      "home.mode.cta": "Start",
      "home.tile.progress.title": "Progress",
      "home.tile.progress.body": "Your numbers, trends and achievements.",
      "home.tile.museum.title": "History and curiosities",
      "home.tile.museum.body": "Facts, milestones and stories from chess.",
      "home.tile.settings.title": "Settings",
      "home.tile.settings.body": "Board, sound, clock and accessibility.",
      "home.daily.eyebrow": "Daily challenge",
      "home.daily.title.pending": "Today's position",
      "home.daily.title.done": "Today's challenge is complete!",
      "home.daily.body.pending": "A position from a classic game every day, with no repeats for months. Find the best move.",
      "home.daily.body.done": "Your accuracy was {accuracy}%. Come back tomorrow: another position is waiting.",
      "home.daily.turn": "{side} to move",
      "home.daily.streak": "Challenge streak: {n} days",
      "home.daily.streak.one": "Challenge streak: 1 day",
      "home.daily.risk": "Complete it today to keep your {n}-day streak.",
      "home.daily.risk.one": "Complete it today to keep your 1-day streak.",
      "home.daily.play": "Play now",
      "home.daily.more": "Keep going with classics",
      "home.daily.done.badge": "Completed",
      "home.first.play": "Play today's position",
      "home.first.more": "See other ways to train",
      "home.daily.already": "You already played today's challenge. Another position is waiting tomorrow; meanwhile, practice with the classic games.",
      "home.daily.pending.badge": "Pending",
      "home.daily.board": "Daily challenge position",
      "home.daily.loading": "Loading today's challenge",
      "home.daily.error": "We could not load today's challenge. Check your connection and try again.",
      "home.daily.sessionTitle": "Daily challenge",
      "home.daily.noGame": "The game is not ready yet. Try again in a moment.",
      "home.fact.title": "Did you know?",
      "home.fact.next": "Next fact",
      "home.fact.more": "Explore History and curiosities",
      "home.fact.empty": "There are no facts to show yet.",
      "home.retry": "Try again",
      "home.error.start": "That option could not be opened.",
      "duel.title": "Duel on one device",
      "duel.intro": "You take turns on this device. Whoever plays closer to the best move wins.",
      "duel.fair": "To keep it fair: you take turns going first in each position. Whoever goes first plays (against the clock, if you turned it on) while the other looks away until it is their turn. Then you pass the device: the first move stays hidden.",
      "duel.players": "Players",
      "duel.player": "Player {n}",
      "duel.who": "Who is player {n}?",
      "duel.guest": "Guest (type a name)",
      "duel.guestName": "Name of player {n}",
      "duel.guestDefault": "Guest {n}",
      "duel.source": "Positions",
      "duel.source.mix": "Classic mix",
      "duel.source.mix.hint": "Random positions from several games in history.",
      "duel.source.game": "One classic game",
      "duel.source.game.hint": "The key positions of a single game, in order.",
      "duel.source.own": "Your games",
      "duel.source.own.hint": "We download games from Lichess or Chess.com, only with your permission.",
      "duel.game": "Game",
      "duel.count": "Number of positions",
      "duel.count.option": "{n} positions",
      "duel.start": "Start duel",
      "duel.preparing": "Preparing positions…",
      "duel.error.same": "Pick two different players.",
      "duel.error.load": "We could not load the classic games. Check your connection and try again.",
      "duel.error.empty": "We could not find positions for the duel.",
      "duel.error.game": "Pick a game.",
      "duel.title.mix": "Duel: classic mix",
      "duel.title.game": "Duel: {game}",
      "ld.eyebrow": "Chess trainer",
      "ld.lead": "Learn chess from your mistakes and from the classic games: the closer your move is to the best one, the more points you earn.",
      "ld.cta": "Start training",
      "ld.how": "How it works",
      "ld.assure": "No sign-up. Your data stays on your device.",
      "ld.steps.eyebrow": "How it works",
      "ld.steps.title": "Three steps to learn from every position",
      "ld.step": "Step {n}",
      "ld.step1.title": "See the position",
      "ld.step1.body": "We show you a real position, from your own games or a classic game. Work out the best move.",
      "ld.step2.title": "Play your move and see how close you were",
      "ld.step2.body": "The Stockfish engine scores your move: the closer to the best move, the more points you earn.",
      "ld.step3.title": "Understand why and come back later",
      "ld.step3.body": "Every mistake goes into your notebook and comes back at growing intervals until you have mastered it.",
      "ld.step.example": "Illustrative example",
      "ld.step2.yours": "Your move",
      "ld.step2.best": "The best",
      "ld.step2.points": "Points",
      "ld.step3.days": "{n} d",
      "ld.step3.label": "You see it again",
      "ld.step3.today": "Today",
      "ld.source.eyebrow": "Two sources of positions",
      "ld.source.title": "Learn from your own games and from the masters",
      "ld.own.title": "Your own games",
      "ld.own.body": "We fetch your public games from Lichess or Chess.com, find where you went wrong and turn them into exercises made for you. They are only downloaded with your permission.",
      "ld.classic.title": "The classic games",
      "ld.classic.body": "Key positions from great games in history, with the master's move and the engine's verdict. Learn how they thought.",
      "ld.private.eyebrow": "Private by design",
      "ld.private.title": "Your chess is yours",
      "ld.private.a.title": "No account",
      "ld.private.a.body": "Open the page and train. There is nothing to sign up for.",
      "ld.private.b.title": "Data on your device",
      "ld.private.b.body": "Your progress lives in your browser. This app has no server or database, so none of this reaches us. If you train with your own games, your username, your opponents' and the link to each game are saved too. You can delete it from Account.",
      "ld.private.c.title": "Optional sync",
      "ld.private.c.body": "If you like, sign in with Google to carry your progress, with that data, to other devices through your own Google Drive.",
      "ld.private.d.title": "You decide what is downloaded",
      "ld.private.d.body": "The app only connects to Lichess or Chess.com when you ask it to and confirm your username.",
      "ld.final.title": "Ready for your first position?",
      "ld.final.body": "It takes a minute to start. Your progress builds the rest.",
      "ld.footer.tagline": "Train your chess with real positions.",
      "ld.footer.version": "Version {version}",
      "ld.footer.license": "License GPL-3.0-or-later",
      "ld.footer.engine": "Chess engine: Stockfish (GPL-3.0)",
      "ld.footer.notices": "Third-party notices",
      "ld.footer.newTab": "(opens in a new tab)",
      "ld.footer.language": "Language",
      "ld.footer.top": "Back to top",
    },
  };

  function registerText() {
    const i18n = L().i18n;
    if (i18n && typeof i18n.register === "function") i18n.register(TEXT);
  }
  registerText();

  // ---------- Small helpers (pure, exported for tests) ----------

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  // "YYYY-MM-DD" in the LOCAL time zone (the same rule as Ludus.Profile).
  function localDateKey(date) {
    const d = date instanceof Date ? date : new Date(date === undefined ? Date.now() : date);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function greetingPart(hour) {
    const n = Number(hour);
    if (n >= 6 && n < 12) return "morning";
    if (n >= 12 && n < 20) return "afternoon";
    return "evening";
  }

  // "martes, 30 de septiembre" / "Tuesday, September 30" (upper-cased by the eyebrow style).
  function todayLabel() {
    try {
      return new Intl.DateTimeFormat(lang() === "en" ? "en-US" : "es-AR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    } catch (error) {
      return "";
    }
  }

  function formatNumber(value) {
    try {
      return new Intl.NumberFormat(lang() === "en" ? "en-US" : "es-AR").format(value);
    } catch (error) {
      return String(value);
    }
  }

  function sideOfFen(fen) {
    return String(fen || "").split(" ")[1] === "b" ? "b" : "w";
  }

  const DUEL_COUNTS = [5, 10, 20];

  // A duel player may have a name as long as a profile's (Profile.constants.NAME_MAX; 24 is the same number for a page without
  // the profile module), so the name of a profile that plays is never cut in silence (RC-2).
  function duelNameMax() {
    const profile = L().Profile;
    const max = profile && profile.constants ? Number(profile.constants.NAME_MAX) : NaN;
    return Number.isFinite(max) && max >= 1 ? Math.floor(max) : 24;
  }

  function cleanName(value) {
    return String(value === undefined || value === null ? "" : value).replace(/\s+/g, " ").trim().slice(0, duelNameMax());
  }

  // rows: [{ kind: "profile" | "guest", profileId, guestName }, x2]
  // profiles: Profile.list(). Returns { ok, error?, names, profileIds }.
  function resolveDuelPlayers(rows, profiles) {
    const known = new Map((Array.isArray(profiles) ? profiles : []).map((profile) => [profile.id, profile]));
    const names = [];
    const profileIds = [];
    (Array.isArray(rows) ? rows : []).slice(0, 2).forEach((row, index) => {
      const profile = row && row.kind === "profile" ? known.get(row.profileId) : null;
      if (profile) {
        names.push(cleanName(profile.name) || t("duel.guestDefault", { n: index + 1 }));
        profileIds.push(profile.id);
      } else {
        names.push(cleanName(row && row.guestName) || t("duel.guestDefault", { n: index + 1 }));
        profileIds.push(null);
      }
    });
    if (names.length !== 2) return { ok: false, error: "same", names, profileIds };
    const sameProfile = profileIds[0] && profileIds[0] === profileIds[1];
    const sameName = names[0].toLowerCase() === names[1].toLowerCase();
    if (sameProfile || sameName) return { ok: false, error: "same", names, profileIds };
    return { ok: true, names, profileIds };
  }

  function normalizeCount(value) {
    const n = Number(value);
    return DUEL_COUNTS.includes(n) ? n : 10;
  }

  // Positions for a duel from the classics library (must be loaded).
  function buildDuelPositions(source, count, gameId) {
    const Classics = L().Classics;
    if (!Classics) return [];
    const wanted = normalizeCount(count);
    if (source === "game") return gameId ? Classics.positions(gameId, { count: wanted }) : [];
    return Classics.random(wanted);
  }

  // ---------- Game / router bridges ----------

  function go(id, params) {
    const router = L().router;
    if (!router || typeof router.show !== "function") return false;
    return router.show(id, params) !== false;
  }

  function gameApi() {
    const game = L().game;
    return game && typeof game === "object" ? game : null;
  }

  function toast(message, kind) {
    const ui = L().ui;
    if (ui && typeof ui.toast === "function") ui.toast(message, { kind: kind || "info" });
  }

  function openOwnGames(options) {
    const game = gameApi();
    if (game && typeof game.openOwnGamesSetup === "function") {
      try {
        game.openOwnGamesSetup(options);
        return true;
      } catch (error) {
        logError("[Ludus.home] openOwnGamesSetup failed", error);
        toast(t("home.error.start"), "error");
        return false;
      }
    }
    return go("setup");
  }

  async function startSession(spec) {
    const game = gameApi();
    if (!game || typeof game.startSession !== "function") {
      toast(t("home.daily.noGame"), "warn");
      return false;
    }
    try {
      await game.startSession(spec);
      return true;
    } catch (error) {
      logError("[Ludus.home] startSession failed", error);
      toast(t("home.error.start"), "error");
      return false;
    }
  }

  // ---------- Profile data ----------

  function readProfileData() {
    const Profile = L().Profile;
    const data = { profile: null, profiles: [], stats: null, counts: { total: 0, due: 0, cleared: 0 }, dailyStatus: null };
    if (!Profile) return data;
    try {
      data.profile = typeof Profile.ensureActive === "function" ? Profile.ensureActive() : Profile.active();
      data.profiles = Profile.list();
      data.stats = Profile.stats();
      if (Profile.notebook && Profile.notebook.counts) data.counts = Profile.notebook.counts();
      if (Profile.daily && Profile.daily.status) data.dailyStatus = Profile.daily.status(localDateKey());
    } catch (error) {
      logError("[Ludus.home] reading the profile failed", error);
    }
    return data;
  }

  // ---------- Shared render helpers ----------

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function on(evt, fn, store) {
    const bus = L().bus;
    if (bus && typeof bus.on === "function") store.push(bus.on(evt, fn));
  }

  function coalesced(fn) {
    let queued = false;
    return () => {
      if (queued) return;
      queued = true;
      const run = () => {
        queued = false;
        fn();
      };
      if (typeof root.setTimeout === "function") root.setTimeout(run, 0);
      else run();
    };
  }

  function modeCardBody(iconName, title, body, extra) {
    return [
      h("span", { class: "home-mode-icon", "aria-hidden": "true" }, icon(iconName, { size: 26 })),
      h("span", { class: "home-mode-text" },
        h("span", { class: "home-mode-title" }, title),
        h("span", { class: "home-mode-body" }, body)),
      extra || null,
    ];
  }

  // ==========================================================================
  // Landing
  // ==========================================================================

  const OPERA_FEN = "4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w - - 1 16";

  const landingState = { mounted: false, container: null, offs: [], body: null, refs: {} };

  function ldStep(n, visual, title, body) {
    return h("li", { class: "ld-step card" },
      h("div", { class: "ld-step-visual", "aria-hidden": "true" }, visual),
      h("p", { class: "ld-step-num" }, t("ld.step", { n })),
      h("h3", { class: "ld-step-title" }, title),
      h("p", { class: "ld-step-body" }, body));
  }

  function ldStepVisuals() {
    const ui = L().ui;
    const board1 = ui.miniBoard(OPERA_FEN, { size: 168, highlight: [], coords: false, label: t("ld.step.example") });
    const board2 = ui.miniBoard(OPERA_FEN, {
      size: 120,
      arrows: [{ from: "b3", to: "b8", color: "best" }, { from: "b3", to: "b7", color: "user" }],
      label: t("ld.step.example"),
    });
    const gauge = ui.gauge({ value: 8.6, max: 10, size: 104, label: t("ld.step2.points") });
    const visual2 = h("div", { class: "ld-step2-visual" },
      board2,
      h("div", { class: "ld-step2-legend" },
        gauge,
        h("span", { class: "ld-swatch ld-swatch-user" }, t("ld.step2.yours")),
        h("span", { class: "ld-swatch ld-swatch-best" }, t("ld.step2.best"))));
    const days = [0, 1, 3, 7, 14];
    const visual3 = h("div", { class: "ld-step3-visual" },
      h("p", { class: "ld-step3-label" }, t("ld.step3.label")),
      h("ol", { class: "ld-intervals" }, days.map((d, i) => h("li", { class: `ld-interval${i === 0 ? " is-now" : ""}` },
        h("span", { class: "ld-interval-dot" }, i === 0 ? icon("check", { size: 14 }) : null),
        h("span", { class: "ld-interval-text" }, i === 0 ? t("ld.step3.today") : t("ld.step3.days", { n: d }))))));
    return [board1, visual2, visual3];
  }

  function ldFeature(iconName, title, body) {
    return h("article", { class: "ld-feature card card-accent" },
      h("span", { class: "ld-feature-icon", "aria-hidden": "true" }, icon(iconName, { size: 28 })),
      h("h3", { class: "ld-feature-title" }, title),
      h("p", { class: "ld-feature-body" }, body));
  }

  function ldPrivacyItem(iconName, title, body) {
    return h("li", { class: "ld-private-item" },
      h("span", { class: "ld-private-icon", "aria-hidden": "true" }, icon(iconName, { size: 24 })),
      h("div", null, h("h3", { class: "ld-private-title" }, title), h("p", { class: "ld-private-body" }, body)));
  }

  function googleSyncConfigured() {
    const Ludus = L();
    try {
      if (Ludus.Auth && typeof Ludus.Auth.isConfigured === "function") return Boolean(Ludus.Auth.isConfigured());
      return Boolean(Ludus.config && Ludus.config.googleClientId);
    } catch (error) {
      return false;
    }
  }

  function clickStart() {
    const btn = landingState.container && typeof landingState.container.querySelector === "function"
      ? landingState.container.querySelector("#landing-start-btn")
      : null;
    if (btn && typeof btn.click === "function") btn.click();
  }

  function footerLanguageSwitch() {
    const current = lang();
    const buttons = ["es", "en"].map((code) => h("button", {
      type: "button",
      class: "ld-lang-btn",
      role: "radio",
      "aria-checked": current === code ? "true" : "false",
      tabindex: current === code ? "0" : "-1",
      "data-lang": code,
      // polish-corecopy: named in its own language, like the header buttons in index.html ("ES" alone is spelled out letter by letter).
      lang: code,
      "aria-label": code === "es" ? "Español" : "English",
      onclick: () => setLanguageFromFooter(code),
      onkeydown: (event) => {
        if (!event) return;
        const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        if (!(event.key in keys)) return;
        if (typeof event.preventDefault === "function") event.preventDefault();
        setLanguageFromFooter(code === "es" ? "en" : "es", true);
      },
    }, code.toUpperCase()));
    return h("div", { class: "ld-lang", role: "radiogroup", "aria-label": t("ld.footer.language") }, buttons);
  }

  // Goes through the header buttons app.js binds, so app.js's own language
  // handling (persisting, re-translating the legacy screens) runs exactly once.
  function setLanguageFromFooter(code, focusNew) {
    const doc = getDoc();
    const headerBtn = doc && typeof doc.getElementById === "function" ? doc.getElementById(`language-btn-${code}`) : null;
    if (headerBtn && typeof headerBtn.click === "function") headerBtn.click();
    else if (L().i18n) L().i18n.setLanguage(code);
    if (focusNew && landingState.container && typeof landingState.container.querySelector === "function") {
      const next = landingState.container.querySelector(`.ld-lang-btn[data-lang="${code}"]`);
      if (next && typeof next.focus === "function") next.focus();
    }
  }

  function scrollToHow(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    const doc = getDoc();
    const target = doc && typeof doc.getElementById === "function" ? doc.getElementById("ld-how") : null;
    if (!target) return;
    const reduce = L().ui && L().ui.reducedMotion ? L().ui.reducedMotion() : false;
    try {
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    } catch (error) {
      target.scrollIntoView();
    }
    const heading = typeof target.querySelector === "function" ? target.querySelector("h2") : null;
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      try {
        heading.focus({ preventScroll: true });
      } catch (error) {
        // focus is best effort
      }
    }
  }

  function localizeHero(container) {
    const setText = (selector, text) => {
      const el = container.querySelector(selector);
      if (el) el.textContent = text;
    };
    setText(".ld-eyebrow", t("ld.eyebrow"));
    setText(".ld-lead", t("ld.lead"));
    setText(".ld-assure", t("ld.assure"));
    setText(".ld-how-link", t("ld.how"));
    const cta = container.querySelector("#landing-start-btn");
    if (cta) {
      clear(cta);
      cta.appendChild(h("span", { class: "btn-label" }, t("ld.cta")));
      cta.appendChild(icon("arrow-right", { size: 22 }));
    }
  }

  function renderLandingBody() {
    const ui = L().ui;
    const body = landingState.body;
    if (!body || !ui) return;
    clear(body);
    const version = L().version || "dev";
    const [visual1, visual2, visual3] = ldStepVisuals();

    const steps = h("section", { class: "ld-section ld-steps", id: "ld-how", "aria-labelledby": "ld-steps-title" },
      h("div", { class: "ld-section-head" },
        h("p", { class: "t-eyebrow" }, t("ld.steps.eyebrow")),
        h("h2", { class: "ld-h2", id: "ld-steps-title" }, t("ld.steps.title"))),
      h("ol", { class: "ld-step-list" },
        ldStep(1, visual1, t("ld.step1.title"), t("ld.step1.body")),
        ldStep(2, visual2, t("ld.step2.title"), t("ld.step2.body")),
        ldStep(3, visual3, t("ld.step3.title"), t("ld.step3.body"))));

    const sources = h("section", { class: "ld-section ld-sources", "aria-labelledby": "ld-sources-title" },
      h("div", { class: "ld-section-head" },
        h("p", { class: "t-eyebrow" }, t("ld.source.eyebrow")),
        h("h2", { class: "ld-h2", id: "ld-sources-title" }, t("ld.source.title"))),
      h("div", { class: "ld-feature-grid" },
        ldFeature("download", t("ld.own.title"), t("ld.own.body")),
        ldFeature("columns", t("ld.classic.title"), t("ld.classic.body"))));

    const privateItems = [
      ldPrivacyItem("user", t("ld.private.a.title"), t("ld.private.a.body")),
      ldPrivacyItem("lock", t("ld.private.b.title"), t("ld.private.b.body")),
      googleSyncConfigured()
        ? ldPrivacyItem("cloud", t("ld.private.c.title"), t("ld.private.c.body"))
        : ldPrivacyItem("shield", t("ld.private.d.title"), t("ld.private.d.body")),
    ];
    const privacy = h("section", { class: "ld-section ld-private", "aria-labelledby": "ld-private-title" },
      h("div", { class: "ld-private-panel" },
        h("div", { class: "ld-section-head" },
          h("p", { class: "t-eyebrow" }, t("ld.private.eyebrow")),
          h("h2", { class: "ld-h2", id: "ld-private-title" }, t("ld.private.title"))),
        h("ul", { class: "ld-private-list" }, privateItems)));

    const finalCta = h("section", { class: "ld-section ld-final", "aria-labelledby": "ld-final-title" },
      h("h2", { class: "ld-h2", id: "ld-final-title" }, t("ld.final.title")),
      h("p", { class: "ld-final-body" }, t("ld.final.body")),
      h("button", { type: "button", class: "btn btn-primary btn-lg ld-cta", onclick: clickStart }, h("span", { class: "btn-label" }, t("ld.cta")), icon("arrow-right", { size: 22 })));

    const footer = h("footer", { class: "ld-footer" },
      h("div", { class: "ld-footer-inner" },
        h("div", { class: "ld-footer-brand" },
          h("img", { class: "ld-footer-mark", src: "assets/brand/logo.svg", alt: "", width: 40, height: 40, loading: "lazy", decoding: "async" }),
          h("div", null, h("p", { class: "ld-footer-name" }, "Ludus Scaccorum"), h("p", { class: "ld-footer-tag" }, t("ld.footer.tagline")))),
        h("ul", { class: "ld-footer-links" },
          h("li", null, t("ld.footer.version", { version })),
          h("li", null, t("ld.footer.license")),
          h("li", null, t("ld.footer.engine")),
          h("li", null, h("a", { href: "THIRD_PARTY_NOTICES.md", target: "_blank", rel: "noopener" }, t("ld.footer.notices"), h("span", { class: "sr-only" }, ` ${t("ld.footer.newTab")}`)))),
        h("div", { class: "ld-footer-lang" }, h("span", { class: "ld-footer-lang-label" }, t("ld.footer.language")), footerLanguageSwitch())));

    [steps, sources, privacy, finalCta, footer].forEach((node) => body.appendChild(node));
  }

  function renderLanding() {
    if (!landingState.mounted) return;
    localizeHero(landingState.container);
    renderLandingBody();
  }

  const landing = {
    mount(container) {
      const doc = getDoc();
      if (!doc || !container || !L().util || !L().ui) return;
      if (landingState.mounted && landingState.container === container) {
        renderLanding();
        return;
      }
      landingState.container = container;
      landingState.mounted = true;
      let body = typeof container.querySelector === "function" ? container.querySelector(".ld-body") : null;
      if (!body) {
        body = h("div", { class: "ld-body" });
        container.appendChild(body);
      }
      landingState.body = body;
      const howLink = container.querySelector(".ld-how-link");
      if (howLink) howLink.addEventListener("click", scrollToHow);
      renderLanding();
      on("language:changed", renderLanding, landingState.offs);
    },
    show() {},
    hide() {},
    render: renderLanding,
    destroy() {
      landingState.offs.forEach((off) => off());
      landingState.offs = [];
      landingState.mounted = false;
    },
  };

  // ==========================================================================
  // Home hub
  // ==========================================================================

  const homeState = {
    mounted: false,
    container: null,
    offs: [],
    visible: false,
    daily: { status: "idle", position: null, key: null, promise: null },
    factId: null,
    factSeen: [],
    duelOpen: false,
  };

  function focusKeyOf(el) {
    return el && el.getAttribute ? el.getAttribute("data-fkey") : null;
  }

  // ----- Hero -----

  function heroSubline(data) {
    const stats = data.stats;
    const total = stats ? stats.totalPositions : 0;
    const streak = stats && stats.streak ? stats.streak : null;
    if (!total) return t("home.sub.first");
    if (streak && streak.atRisk && streak.current > 0) return tCount("home.sub.risk", streak.current);
    if (data.counts.due > 0) return tCount("home.sub.due", data.counts.due);
    return t("home.sub.default");
  }

  function levelLine(data) {
    const level = data.stats && data.stats.level ? data.stats.level : null;
    if (!level) return { title: "", text: "", progress: 0 };
    const Profile = L().Profile;
    let text;
    if (!data.stats.totalPositions && !level.xp) {
      text = t("home.level.first");
    } else if (level.max) {
      text = t("home.level.max", { xp: formatNumber(level.xp) });
    } else {
      let nextTitle = "";
      try {
        nextTitle = Profile.levelFor(level.nextXp).title;
      } catch (error) {
        nextTitle = "";
      }
      // The number is shown formatted ("1.250"), the singular is chosen by its value ("falta 1").
      text = tCount("home.level.progress", level.xpToNext, { xp: formatNumber(level.xp), n: formatNumber(level.xpToNext), next: nextTitle });
    }
    return { title: level.title || "", text, progress: Math.max(0, Math.min(1, level.progress || 0)) };
  }

  function renderHero(data) {
    const ui = L().ui;
    const profile = data.profile;
    const stats = data.stats;
    const defaultName = t("profile.defaultName");
    const totalPlayed = stats ? stats.totalPositions : 0;
    // Someone who never renamed the default profile and has not played yet is
    // greeted without a name ("Hola, Jugador" would read as a placeholder).
    const anonymous = !profile || !profile.name || (totalPlayed === 0 && profile.name === defaultName);
    const greeting = anonymous
      ? t("home.greet.anon")
      : t(`home.greet.${greetingPart(new Date().getHours())}`, { name: profile.name });
    const level = levelLine(data);
    const streak = stats && stats.streak ? stats.streak.current : 0;
    const total = stats ? stats.totalPositions : 0;
    const accuracy = stats && stats.overallAccuracy !== null && stats.overallAccuracy !== undefined ? Math.round(stats.overallAccuracy) : null;

    const statNodes = [];
    statNodes.push(ui.stat({
      label: t("home.stat.streak"),
      value: formatNumber(streak),
      hint: streak === 1 ? t("home.stat.streak.hint.one") : t("home.stat.streak.hint"),
      icon: "flame",
      tone: streak > 0 ? "gold" : null,
    }));
    if (total > 0) {
      statNodes.push(ui.stat({ label: t("home.stat.positions"), value: formatNumber(total), icon: "target" }));
      if (accuracy !== null) statNodes.push(ui.stat({ label: t("home.stat.accuracy"), value: `${accuracy}%`, hint: t("home.stat.accuracy.hint"), icon: "chart" }));
    }

    // A profile that has not played yet has no level, streak or XP worth a card: the hero is a greeting and ONE
    // primary action (on a phone that is the whole first screen), and the empty meters appear with the first round.
    if (!total) {
      return h("section", { class: "home-hero home-hero-first card card-accent", "aria-labelledby": "home-greeting" },
        h("div", { class: "home-hero-main" },
          h("p", { class: "t-eyebrow" }, todayLabel()),
          h("h1", { class: "home-greeting", id: "home-greeting", "data-screen-title": "" }, greeting),
          h("p", { class: "home-sub" }, heroSubline(data)),
          h("div", { class: "home-hero-actions" },
            h("button", { type: "button", class: "btn btn-primary btn-lg", "data-fkey": "hero-play", onclick: () => { startDaily(); } }, icon("play", { size: 20 }), h("span", { class: "btn-label" }, t("home.first.play"))),
            h("button", { type: "button", class: "btn btn-ghost btn-lg", "data-fkey": "hero-more", onclick: scrollToModes }, h("span", { class: "btn-label" }, t("home.first.more"))))));
    }

    return h("section", { class: "home-hero card card-accent", "aria-labelledby": "home-greeting" },
      h("div", { class: "home-hero-main" },
        h("p", { class: "t-eyebrow" }, todayLabel()),
        h("h1", { class: "home-greeting", id: "home-greeting", "data-screen-title": "" }, greeting),
        h("p", { class: "home-sub" }, heroSubline(data)),
        h("div", { class: "home-level" },
          h("div", { class: "home-level-head" },
            profile ? ui.avatar(profile, { size: 32 }) : null,
            level.title ? ui.levelBadge(stats.level) : null),
          ui.progress(level.progress, { size: "lg" }),
          h("p", { class: "home-level-text" }, level.text))),
      h("div", { class: "home-stats" }, statNodes));
  }

  // "See other ways to train": brings the mode cards into view and puts the focus on the first one.
  function scrollToModes() {
    const slot = homeState.slots && homeState.slots.modes;
    if (!slot) return;
    const reduce = L().ui && L().ui.reducedMotion ? L().ui.reducedMotion() : false;
    try {
      slot.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    } catch (error) {
      if (typeof slot.scrollIntoView === "function") slot.scrollIntoView();
    }
    const first = typeof slot.querySelector === "function" ? slot.querySelector("button, a[href]") : null;
    if (first && typeof first.focus === "function") first.focus({ preventScroll: true });
  }

  // ----- Daily challenge -----

  function dailyKeyNow() {
    return localDateKey();
  }

  function loadDaily(force) {
    const Classics = L().Classics;
    const state = homeState.daily;
    if (!Classics) {
      state.status = "error";
      renderDailySlot();
      return Promise.resolve();
    }
    const key = dailyKeyNow();
    if (!force && state.status === "ready" && state.key === key) return Promise.resolve();
    // One load at a time: show() can be called by the router and by the screen:changed hook.
    if (state.status === "loading" && state.key === key && state.promise) return state.promise;
    state.status = "loading";
    state.key = key;
    renderDailySlot();
    state.promise = (async () => {
      try {
        await Classics.load();
        const position = Classics.daily(key);
        if (!position) throw new Error("no daily position");
        state.position = position;
        state.status = "ready";
      } catch (error) {
        logError("[Ludus.home] the daily challenge could not be loaded", error);
        state.status = "error";
        state.position = null;
      }
      state.promise = null;
      renderDailySlot();
    })();
    return state.promise;
  }

  function startDaily() {
    const run = async () => {
      // Today's challenge is done: "#/daily" (a link, the PWA shortcut) must not start a second, timed round that pays
      // XP again. Home shows the completed card; a short message says why nothing started.
      const status = readProfileData().dailyStatus;
      if (status && status.done) {
        go("home");
        toast(t("home.daily.already"), "info");
        return false;
      }
      if (homeState.daily.status !== "ready" || homeState.daily.key !== dailyKeyNow()) await loadDaily(true);
      const position = homeState.daily.position;
      if (!position) {
        toast(t("home.daily.error"), "error");
        return false;
      }
      const key = homeState.daily.key;
      return startSession({
        kind: "daily",
        title: `${t("home.daily.sessionTitle")} · ${L().util.formatDate(Date.now(), lang())}`,
        positions: [Object.assign({}, position, { dailyKey: key })],
      });
    };
    return run();
  }

  function dailyHead(done) {
    return h("div", { class: "home-daily-head" },
      h("p", { class: "t-eyebrow" }, t("home.daily.eyebrow")),
      done
        ? h("span", { class: "badge badge-success" }, icon("check", { size: 12 }), t("home.daily.done.badge"))
        : h("span", { class: "badge badge-gold" }, t("home.daily.pending.badge")));
  }

  function renderDaily(data) {
    const ui = L().ui;
    const state = homeState.daily;
    const status = data.dailyStatus;
    const done = Boolean(status && status.done);
    const streakN = status ? status.streak : 0;

    if (state.status === "loading" || state.status === "idle") {
      return h("section", { class: "home-daily card", "aria-busy": "true", "aria-label": t("home.daily.loading") },
        h("div", { class: "home-daily-skel" }, ui.skeleton({ kind: "card" }), ui.skeleton({ kind: "title" }), ui.skeleton({ lines: 3 })));
    }
    if (state.status === "error") {
      return h("section", { class: "home-daily card", "aria-labelledby": "home-daily-title" },
        dailyHead(false),
        h("h2", { class: "home-daily-title", id: "home-daily-title" }, t("home.daily.title.pending")),
        h("p", { class: "home-daily-body" }, t("home.daily.error")),
        h("div", { class: "home-daily-actions" },
          h("button", { type: "button", class: "btn btn-secondary", "data-fkey": "daily-retry", onclick: () => loadDaily(true) }, icon("refresh", { size: 18 }), h("span", { class: "btn-label" }, t("home.retry")))));
    }

    const position = state.position;
    const side = sideOfFen(position.fen);
    const board = ui.miniBoard(position.fen, {
      size: 200,
      orientation: side,
      label: t("home.daily.board"),
    });
    const streakText = streakN > 0 ? (streakN === 1 ? t("home.daily.streak.one") : t("home.daily.streak", { n: streakN })) : "";
    const atRisk = Boolean(status && status.atRisk);
    const body = done
      ? t("home.daily.body.done", { accuracy: status.accuracy === null || status.accuracy === undefined ? "—" : Math.round(status.accuracy) })
      : t("home.daily.body.pending");
    const notes = [];
    notes.push(h("li", { class: "home-daily-note" }, icon("flag", { size: 16 }), t("home.daily.turn", { side: t(`ui.side.${side}`) })));
    if (streakText) notes.push(h("li", { class: "home-daily-note" }, icon("flame", { size: 16 }), streakText));
    if (!done && atRisk && streakN > 0) notes.push(h("li", { class: "home-daily-note is-risk" }, icon("alert", { size: 16 }), tCount("home.daily.risk", streakN)));

    const actions = done
      ? h("button", { type: "button", class: "btn btn-secondary", "data-fkey": "daily-more", onclick: () => go("classics") }, h("span", { class: "btn-label" }, t("home.daily.more")), icon("arrow-right", { size: 18 }))
      : h("button", { type: "button", class: "btn btn-primary btn-lg", "data-fkey": "daily-play", onclick: () => { startDaily(); } }, icon("play", { size: 20 }), h("span", { class: "btn-label" }, t("home.daily.play")));

    return h("section", { class: `home-daily card${done ? " is-done" : ""}`, "aria-labelledby": "home-daily-title" },
      h("div", { class: "home-daily-visual" }, board),
      h("div", { class: "home-daily-main" },
        dailyHead(done),
        h("h2", { class: "home-daily-title", id: "home-daily-title" }, done ? t("home.daily.title.done") : t("home.daily.title.pending")),
        h("p", { class: "home-daily-body" }, body),
        h("ul", { class: "home-daily-notes" }, notes),
        h("div", { class: "home-daily-actions" }, actions)));
  }

  function renderDailySlot() {
    if (!homeState.mounted || !homeState.slots || !homeState.slots.daily) return;
    const data = readProfileData();
    const slot = homeState.slots.daily;
    const hadFocus = focusKeyOf(getDoc() && getDoc().activeElement);
    clear(slot);
    slot.appendChild(renderDaily(data));
    if (hadFocus) restoreFocus(hadFocus);
  }

  // ----- Mode cards -----

  function modeCard(options) {
    const { key, iconName, title, body, onClick, extra, tone, disabled } = options;
    if (disabled) {
      return h("div", { class: "home-mode card card-flat is-disabled", "data-mode": key },
        ...modeCardBody(iconName, title, body, null));
    }
    return h("button", { type: "button", class: `home-mode card${tone ? ` home-mode-${tone}` : ""}`, "data-mode": key, "data-fkey": `mode-${key}`, onclick: onClick },
      ...modeCardBody(iconName, title, body, extra || h("span", { class: "home-mode-go", "aria-hidden": "true" }, icon("arrow-right", { size: 20 }))));
  }

  function renderModes(data) {
    const ui = L().ui;
    const due = data.counts.due;
    const total = data.counts.total;
    const reviewBody = due > 0
      ? (due === 1 ? t("home.mode.review.due.one") : t("home.mode.review.due", { n: due }))
      : total > 0
        ? (total === 1 ? t("home.mode.review.clear.one") : t("home.mode.review.clear", { n: total }))
        : t("home.mode.review.empty");

    const cards = [
      modeCard({
        key: "own",
        iconName: "download",
        title: t("home.mode.own.title"),
        body: t("home.mode.own.body"),
        onClick: () => openOwnGames({ mode: "solo" }),
      }),
      modeCard({
        key: "classics",
        iconName: "columns",
        title: t("home.mode.classics.title"),
        body: t("home.mode.classics.body"),
        onClick: () => go("classics"),
      }),
      modeCard({
        key: "review",
        iconName: "book",
        title: t("home.mode.review.title"),
        body: reviewBody,
        tone: due > 0 ? "due" : null,
        disabled: total === 0,
        onClick: () => go("notebook"),
        extra: due > 0
          ? h("span", { class: "home-mode-count" }, h("span", { class: "badge badge-count", "aria-hidden": "true" }, due > 99 ? "99+" : String(due)), h("span", { class: "sr-only" }, t("home.mode.review.badge")))
          : null,
      }),
      modeCard({
        key: "duel",
        iconName: "swords",
        title: t("home.mode.duel.title"),
        body: t("home.mode.duel.body"),
        onClick: () => openDuelSetup(),
      }),
    ];
    return h("section", { class: "home-section", "aria-labelledby": "home-modes-title" },
      h("h2", { class: "home-h2", id: "home-modes-title" }, t("home.section.modes")),
      h("div", { class: "home-modes" }, cards));
  }

  function tile(id, iconName, title, body) {
    return h("button", { type: "button", class: "home-tile card", "data-fkey": `tile-${id}`, onclick: () => go(id) },
      h("span", { class: "home-tile-icon", "aria-hidden": "true" }, icon(iconName, { size: 22 })),
      h("span", { class: "home-tile-title" }, title),
      h("span", { class: "home-tile-body" }, body));
  }

  function renderTiles() {
    return h("section", { class: "home-section", "aria-labelledby": "home-more-title" },
      h("h2", { class: "home-h2", id: "home-more-title" }, t("home.section.more")),
      h("div", { class: "home-tiles" },
        tile("progress", "chart", t("home.tile.progress.title"), t("home.tile.progress.body")),
        tile("museum", "history", t("home.tile.museum.title"), t("home.tile.museum.body")),
        tile("settings", "settings", t("home.tile.settings.title"), t("home.tile.settings.body"))));
  }

  // ----- Did you know? -----

  function pickFact(advance) {
    const Facts = L().Facts;
    if (!Facts || typeof Facts.pick !== "function") return null;
    if (!advance && homeState.factId && typeof Facts.get === "function") {
      const same = Facts.get(homeState.factId);
      if (same) return same;
    }
    const fact = Facts.pick({ exclude: homeState.factSeen });
    if (fact) {
      homeState.factId = fact.id;
      homeState.factSeen.push(fact.id);
      if (homeState.factSeen.length > 40) homeState.factSeen.shift();
    }
    return fact;
  }

  function renderFact() {
    const Facts = L().Facts;
    const fact = pickFact(false);
    const currentLang = lang();
    const factText = fact && Facts && typeof Facts.text === "function" ? quotedText(Facts.text(fact, currentLang), currentLang) : "";
    const category = fact && Facts && typeof Facts.categoryLabel === "function" ? Facts.categoryLabel(fact.cat, currentLang) : "";
    const year = fact && Facts && typeof Facts.formatYear === "function" ? Facts.formatYear(fact, currentLang) : "";
    const box = h("section", { class: "home-fact card", "aria-labelledby": "home-fact-title" },
      h("div", { class: "home-fact-head" },
        h("span", { class: "home-fact-icon", "aria-hidden": "true" }, icon("lightbulb", { size: 22 })),
        h("h2", { class: "home-fact-title", id: "home-fact-title" }, t("home.fact.title"))),
      fact
        ? h("div", { class: "home-fact-body", "aria-live": "polite", "aria-atomic": "true" },
          h("p", { class: "home-fact-meta" }, category ? h("span", { class: "chip" }, category) : null, year ? h("span", { class: "home-fact-year" }, year) : null),
          h("p", { class: "home-fact-text" }, factText))
        : h("p", { class: "home-fact-text t-muted" }, t("home.fact.empty")),
      h("div", { class: "home-fact-actions" },
        fact ? h("button", {
          type: "button",
          class: "btn btn-secondary",
          "data-fkey": "fact-next",
          onclick: () => {
            pickFact(true);
            updateFactSlot();
          },
        }, icon("refresh", { size: 18 }), h("span", { class: "btn-label" }, t("home.fact.next"))) : null,
        h("button", { type: "button", class: "btn btn-ghost", "data-fkey": "fact-more", onclick: () => go("museum") }, h("span", { class: "btn-label" }, t("home.fact.more")), icon("arrow-right", { size: 18 }))));
    return box;
  }

  // Only the fact card changes on "Next fact": the rest of the page (and the
  // focus on the button that was just pressed) stays where it is.
  function updateFactSlot() {
    const slot = homeState.slots && homeState.slots.fact;
    if (!slot) return;
    const hadFocus = focusKeyOf(getDoc() && getDoc().activeElement);
    clear(slot);
    slot.appendChild(renderFact());
    if (hadFocus) restoreFocus(hadFocus);
  }

  function restoreFocus(key) {
    const container = homeState.container;
    if (!container || typeof container.querySelector !== "function") return;
    const target = container.querySelector(`[data-fkey="${key}"]`);
    if (target && typeof target.focus === "function") target.focus({ preventScroll: true });
  }

  // ----- Whole page -----

  function render() {
    if (!homeState.mounted) return;
    const container = homeState.container;
    const doc = getDoc();
    const hadFocus = focusKeyOf(doc && doc.activeElement);
    const data = readProfileData();
    clear(container);

    const slots = {
      hero: h("div", { class: "home-slot-hero" }, renderHero(data)),
      daily: h("div", { class: "home-slot-daily" }, renderDaily(data)),
      modes: h("div", { class: "home-slot-modes" }, renderModes(data)),
      tiles: h("div", { class: "home-slot-tiles" }, renderTiles()),
      fact: h("div", { class: "home-slot-fact" }, renderFact()),
    };
    homeState.slots = slots;
    container.appendChild(h("div", { class: "home" },
      slots.hero,
      h("div", { class: "home-main" }, slots.daily, slots.modes),
      slots.tiles,
      slots.fact));
    if (hadFocus) restoreFocus(hadFocus);
  }

  // ==========================================================================
  // Duel setup
  // ==========================================================================

  function duelPlayerRow(index, profiles, initial, refs) {
    const selectId = `duel-who-${index}`;
    const guestId = `duel-guest-${index}`;
    const options = profiles.map((profile) => h("option", { value: `p:${profile.id}` }, profile.name));
    options.push(h("option", { value: "guest" }, t("duel.guest")));
    const select = h("select", { id: selectId, class: "select" }, options);
    select.value = initial.kind === "profile" ? `p:${initial.profileId}` : "guest";
    const guest = h("input", {
      id: guestId,
      class: "input",
      type: "text",
      maxlength: duelNameMax(),
      autocomplete: "off",
      spellcheck: "false",
      value: initial.guestName || "",
      placeholder: t("duel.guestDefault", { n: index + 1 }),
      "aria-label": t("duel.guestName", { n: index + 1 }),
    });
    const guestField = h("div", { class: "duel-guest", hidden: select.value !== "guest" }, guest);
    select.addEventListener("change", () => {
      guestField.hidden = select.value !== "guest";
      if (select.value === "guest") {
        guestField.removeAttribute("hidden");
        if (typeof guest.focus === "function") guest.focus();
      }
    });
    refs.rows[index] = { select, guest };
    return h("div", { class: "duel-player field" },
      h("label", { for: selectId }, t("duel.who", { n: index + 1 })),
      select,
      guestField);
  }

  function readDuelRow(row) {
    const value = row.select.value;
    if (typeof value === "string" && value.startsWith("p:")) return { kind: "profile", profileId: value.slice(2) };
    return { kind: "guest", guestName: row.guest.value };
  }

  function radioOption(name, value, label, hint, checked, onChange) {
    const input = h("input", { type: "radio", name, value, checked: checked || null, onchange: () => onChange(value) });
    return h("label", { class: "check duel-source-option" },
      input,
      h("span", { class: "check-box", "aria-hidden": "true" }),
      h("span", { class: "check-text" }, h("span", { class: "duel-source-title" }, label), hint ? h("span", { class: "duel-source-hint" }, hint) : null));
  }

  function openDuelSetup() {
    const ui = L().ui;
    const Profile = L().Profile;
    const Classics = L().Classics;
    if (!ui || typeof ui.modal !== "function") return null;
    if (homeState.duelOpen) return null;

    const profiles = (() => {
      try {
        return Profile ? Profile.list() : [];
      } catch (error) {
        return [];
      }
    })();
    const active = profiles.find((profile) => profile.active) || profiles[0] || null;
    const second = profiles.find((profile) => active && profile.id !== active.id) || null;
    const refs = { rows: [] };
    const form = { source: "mix", count: 10, gameId: "" };
    const uid = `duel-${Math.floor(Math.random() * 1e6)}`;

    const rows = [
      duelPlayerRow(0, profiles, active ? { kind: "profile", profileId: active.id } : { kind: "guest", guestName: "" }, refs),
      duelPlayerRow(1, profiles, second ? { kind: "profile", profileId: second.id } : { kind: "guest", guestName: "" }, refs),
    ];

    // Source: three radio options; the game picker only shows for "one classic game".
    const gameSelect = h("select", { id: `${uid}-game`, class: "select", disabled: true }, h("option", { value: "" }, t("duel.preparing")));
    const gameField = h("div", { class: "field duel-game", hidden: true }, h("label", { for: `${uid}-game` }, t("duel.game")), gameSelect);
    const error = h("p", { class: "field-error", role: "alert", hidden: true });
    let gamesLoaded = false;

    function showError(text) {
      error.textContent = text;
      error.hidden = false;
      error.removeAttribute("hidden");
    }

    function hideError() {
      error.hidden = true;
      error.setAttribute("hidden", "");
    }

    async function ensureGames() {
      if (gamesLoaded || !Classics) return;
      try {
        await Classics.load();
        const games = Classics.list();
        clear(gameSelect);
        gameSelect.appendChild(h("option", { value: "" }, "—"));
        games.forEach((game) => gameSelect.appendChild(h("option", { value: game.id }, game.title || `${game.white} - ${game.black}`)));
        gameSelect.disabled = false;
        gamesLoaded = true;
        if (form.gameId) gameSelect.value = form.gameId;
      } catch (error2) {
        logError("[Ludus.home] classics could not be loaded for the duel setup", error2);
        clear(gameSelect);
        gameSelect.appendChild(h("option", { value: "" }, "—"));
        showError(t("duel.error.load"));
      }
    }

    gameSelect.addEventListener("change", () => {
      form.gameId = gameSelect.value;
      hideError();
    });

    const sourceName = `${uid}-source`;
    function setSource(value) {
      form.source = value;
      hideError();
      const showGame = value === "game";
      gameField.hidden = !showGame;
      if (showGame) {
        gameField.removeAttribute("hidden");
        ensureGames();
      } else {
        gameField.setAttribute("hidden", "");
      }
    }
    const sourceGroup = h("fieldset", { class: "duel-fieldset" },
      h("legend", { class: "duel-legend" }, t("duel.source")),
      h("div", { class: "duel-sources" },
        radioOption(sourceName, "mix", t("duel.source.mix"), t("duel.source.mix.hint"), true, setSource),
        radioOption(sourceName, "game", t("duel.source.game"), t("duel.source.game.hint"), false, setSource),
        radioOption(sourceName, "own", t("duel.source.own"), t("duel.source.own.hint"), false, setSource)),
      gameField);

    // Count: a segmented group of native radios.
    const countName = `${uid}-count`;
    const countGroup = h("fieldset", { class: "duel-fieldset" },
      h("legend", { class: "duel-legend" }, t("duel.count")),
      h("div", { class: "duel-counts segmented", role: "presentation" }, DUEL_COUNTS.map((n) => h("label", { class: `duel-count${n === form.count ? " is-selected" : ""}` },
        h("input", {
          type: "radio",
          name: countName,
          value: String(n),
          checked: n === form.count || null,
          class: "duel-count-input",
          onchange: (event) => {
            form.count = n;
            const parent = event && event.target && event.target.parentNode && event.target.parentNode.parentNode;
            if (parent && parent.children) Array.from(parent.children).forEach((label) => label.classList.toggle("is-selected", label === event.target.parentNode));
          },
        }),
        h("span", null, t("duel.count.option", { n }))))));

    const players = h("fieldset", { class: "duel-fieldset" }, h("legend", { class: "duel-legend" }, t("duel.players")), h("div", { class: "duel-players" }, rows));
    const body = h("div", { class: "duel-form" }, h("p", { class: "modal-text" }, t("duel.intro")), h("p", { class: "duel-fair" }, icon("info", { size: 16 }), h("span", null, t("duel.fair"))), players, sourceGroup, countGroup, error);

    let handle = null;
    let starting = false;

    async function start() {
      if (starting) return;
      hideError();
      const plan = resolveDuelPlayers(rows.map((_, i) => readDuelRow(refs.rows[i])), profiles);
      if (!plan.ok) {
        showError(t("duel.error.same"));
        return;
      }
      const source = form.source;
      const count = normalizeCount(form.count);
      if (source === "own") {
        if (handle) handle.close("own");
        openOwnGames({ mode: "duel", names: plan.names, profileIds: plan.profileIds, count });
        return;
      }
      if (source === "game" && !form.gameId) {
        showError(t("duel.error.game"));
        return;
      }
      starting = true;
      setBusy(true);
      try {
        await Classics.load();
      } catch (loadError) {
        logError("[Ludus.home] classics could not be loaded", loadError);
        showError(t("duel.error.load"));
        starting = false;
        setBusy(false);
        return;
      }
      const positions = buildDuelPositions(source, count, form.gameId);
      if (!positions.length) {
        showError(t("duel.error.empty"));
        starting = false;
        setBusy(false);
        return;
      }
      let title = t("duel.title.mix");
      if (source === "game") {
        const meta = Classics.get(form.gameId);
        title = t("duel.title.game", { game: meta && meta.title ? meta.title : form.gameId });
      }
      if (handle) handle.close("start");
      await startSession({ kind: "classic", mode: "duel", title, names: plan.names, profileIds: plan.profileIds, positions });
    }

    let startButtonEl = null;
    function setBusy(busy) {
      if (!startButtonEl) return;
      if (busy) startButtonEl.setAttribute("aria-busy", "true");
      else startButtonEl.removeAttribute("aria-busy");
      startButtonEl.disabled = busy;
    }

    homeState.duelOpen = true;
    handle = ui.modal({
      title: t("duel.title"),
      size: "md",
      body,
      actions: [
        { label: t("duel.start"), kind: "primary", icon: "swords", onClick: () => { start(); return false; } },
        { label: L().i18n.t("ui.cancel"), kind: "ghost", value: "cancel" },
      ],
      onClose: () => {
        homeState.duelOpen = false;
      },
    });
    if (handle.el && typeof handle.el.querySelector === "function") {
      const buttons = handle.el.querySelectorAll(".modal-actions .btn");
      startButtonEl = buttons && buttons[0] ? buttons[0] : null;
    }
    return handle;
  }

  const home = {
    // Router title (an i18n key): "Inicio - Ludus Scaccorum".
    title: "home.title",
    mount(container) {
      const doc = getDoc();
      if (!doc || !container || !L().util || !L().ui) return;
      if (homeState.mounted && homeState.container === container) {
        render();
        return;
      }
      homeState.container = container;
      homeState.mounted = true;
      render();
      const refresh = coalesced(() => {
        if (homeState.mounted) render();
      });
      on("language:changed", () => {
        render();
      }, homeState.offs);
      on("profile:changed", refresh, homeState.offs);
      on("notebook:changed", refresh, homeState.offs);
      on("session:completed", refresh, homeState.offs);
      // Works whether or not the router was told to call show()/hide().
      on("screen:changed", (payload) => {
        if (payload && payload.id === "home") home.show();
        else if (payload && payload.prev === "home") home.hide();
      }, homeState.offs);
      const router = L().router;
      if (router && typeof router.current === "function" && router.current() === "home") home.show();
    },
    show() {
      homeState.visible = true;
      if (!homeState.mounted) return;
      render();
      loadDaily(false);
    },
    hide() {
      homeState.visible = false;
    },
    render,
    startDaily,
    openDuelSetup,
    // Pure helpers (also used by the tests).
    helpers: { localDateKey, greetingPart, resolveDuelPlayers, buildDuelPositions, normalizeCount, DUEL_COUNTS, tCount, quotedText },
    TEXT,
    destroy() {
      homeState.offs.forEach((off) => off());
      homeState.offs = [];
      homeState.mounted = false;
    },
  };

  return {
    landing,
    home,
    // Pure helpers, exported for the tests.
    localDateKey,
    greetingPart,
    resolveDuelPlayers,
    buildDuelPositions,
    normalizeCount,
    DUEL_COUNTS: DUEL_COUNTS.slice(),
    TEXT,
    _state: { home: homeState, landing: landingState },
  };
});
