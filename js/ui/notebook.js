// Screen "notebook": the mistake notebook with spaced repetition (Leitner boxes).
//   Summary      cards due now, total, cleared and new, the next review date, a small chart of the five boxes and the
//                big action "Review N now" (N = 5 / 10 / 20 per session); when nothing is due it says when the next
//                card comes back and offers to practise anyway with the cards of the lowest boxes
//   Weak spots   the themes (Ludus.Insights tags) that repeat in the cards, each with "Train this weakness"
//   Cards        filters (status, origin, theme, phase, how bad the mistake was, text) and sort; every card has a
//                mini board (side to move at the bottom, arrow on the best move), where it comes from, your move
//                against the best one, theme chips that open the lesson, the five box pips with the next review in
//                words, and actions: review this one, see the stored engine lines, remove
// Contract: docs/ARCHITECTURE.md sections 11, 15, 19 and 20; styles in css/notebook.css (prefix .notebook-).
//
//   Ludus.Screens.notebook.mount(el)    el = #screen-notebook. Idempotent and cheap (the data loads in show()).
//   Ludus.Screens.notebook.show(params) params.tag / .status / .source / .phase preset the filters (the progress
//                                       screen links here with a tag). Reads the profile again every time.
//   Ludus.Screens.notebook.hide()       stops the search debounce; nothing else runs in the background.
//   Ludus.Screens.notebook.render()     repaints from the current state (also on language:changed).
//   Ludus.Screens.notebook.openConcept(tag)  the lesson of a theme in a dialog (also used by the progress screen).
//   Ludus.Screens.notebook.titleKey     "notebook.title", the i18n key of document.title.
//
// Grading is not done here: a review is a session of kind "review" whose positions carry source "notebook" and the
// card id, and Ludus.Profile grades the card when it records the round (docs/ARCHITECTURE.md section 19). This
// module never calls Profile.notebook.grade. Built with Ludus.util.h only; a missing module (Profile, Insights,
// Concepts, Scoring, the kit, the game core) removes the part that needs it and never breaks the rest. Pure helpers
// are exported under `helpers` for scripts/tests/notebook-ui.test.js.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Screens = root.Ludus.Screens || {};
  root.Ludus.Screens.notebook = api;
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

  // "1 card" / "{n} cards": the singular lives under "<key>.one".
  function tCount(key, n, params) {
    return t(n === 1 ? `${key}.one` : key, Object.assign({ n }, params || {}));
  }

  // ---------- Text ----------

  const TEXT = {
    es: {
      "notebook.title": "Cuaderno",
      "notebook.eyebrow": "Cuaderno de errores",
      "notebook.heading": "Tu cuaderno de errores",
      "notebook.sub": "Cada posición en la que te equivocaste vuelve a intervalos cada vez más largos, hasta que la jugás bien varias veces seguidas.",
      "notebook.unavailable": "El cuaderno no está disponible en este momento.",

      "notebook.empty.title": "Tu cuaderno todavía está vacío",
      "notebook.empty.body": "Cada vez que te equivocás en una posición la guardamos acá y te la volvemos a mostrar más adelante. Jugá unas posiciones y empezá a llenarlo.",
      "notebook.empty.classics": "Jugar partidas clásicas",
      "notebook.empty.own": "Analizar tus partidas",
      "notebook.empty.how": "Cómo funciona",
      "notebook.empty.step1.title": "Te equivocás",
      "notebook.empty.step1.body": "Una jugada con menos de 70 de precisión guarda la posición.",
      "notebook.empty.step2.title": "Se guarda",
      "notebook.empty.step2.body": "Con la jugada del motor y el tema del error, en la caja 0.",
      "notebook.empty.step3.title": "Vuelve",
      "notebook.empty.step3.body": "A 1, 3, 7, 14 y 30 días: cada acierto la sube de caja.",

      "notebook.summary": "Resumen del cuaderno",
      "notebook.due.label": "para repasar ahora",
      "notebook.due.label.one": "para repasar ahora",
      "notebook.due.clear": "Estás al día",
      "notebook.due.clear.body": "No hay tarjetas para repasar ahora.",
      "notebook.due.session": "La sesión toma {n} de las {due}.",
      "notebook.next": "Próximo repaso: {when}",
      "notebook.next.count": "{n} tarjetas",
      "notebook.next.count.one": "1 tarjeta",
      "notebook.next.after": "Después de estas: {when}",
      "notebook.next.none": "Ninguna tarjeta tiene un repaso pendiente.",
      "notebook.review.start": "Repasar {n} ahora",
      "notebook.review.start.one": "Repasar 1 ahora",
      "notebook.review.size": "Posiciones por sesión",
      "notebook.review.size.n": "{n} posiciones",
      "notebook.review.hint": "Cada repaso aprobado sube la tarjeta de caja; uno fallado la manda a la caja 1.",
      "notebook.practice.start": "Practicar igual",
      "notebook.practice.hint": "Practicar antes de tiempo también cuenta como repaso: si la aprobás, la tarjeta sube de caja.",
      "notebook.stat.total": "Tarjetas",
      "notebook.stat.cleared": "Superadas",
      "notebook.stat.cleared.hint": "En la caja 3 o más",
      "notebook.stat.new": "Nuevas",
      "notebook.stat.new.hint": "Todavía sin repasar",
      "notebook.boxes.title": "Cajas de repaso",
      "notebook.boxes.caption": "Cuántas tarjetas hay en cada caja y cada cuánto vuelven. Las de oro ya están superadas.",
      "notebook.boxes.new": "Nueva",
      "notebook.boxes.day": "{n} d",
      "notebook.boxes.aria": "Caja {n}: {count}, vuelve {interval}",
      "notebook.boxes.aria.new": "Caja 0, tarjetas nuevas: {count}",
      "notebook.boxes.interval": "cada {n} días",
      "notebook.boxes.interval.one": "cada día",
      "notebook.boxes.col.box": "Caja",
      "notebook.boxes.col.cards": "Tarjetas",

      "notebook.weak.title": "Puntos débiles",
      "notebook.weak.lead": "Los temas que más se repiten en tus errores. Entrená uno y repasá solo esas tarjetas.",
      "notebook.weak.list": "Puntos débiles del cuaderno",
      "notebook.weak.cards": "{n} tarjetas · {open} sin superar",
      "notebook.weak.cards.one": "1 tarjeta · {open} sin superar",
      "notebook.weak.train": "Entrenar este punto débil",
      "notebook.weak.train.aria": "Entrenar este punto débil: {tag}",
      "notebook.weak.show": "Ver tarjetas",
      "notebook.weak.filter": "Ver las tarjetas de {tag}",

      "notebook.list.title": "Tus tarjetas",
      "notebook.list.region": "Tarjetas del cuaderno",
      "notebook.search": "Buscar",
      "notebook.search.placeholder": "Jugadores, evento o jugada",
      "notebook.search.clear": "Borrar la búsqueda",
      "notebook.sort": "Ordenar por",
      "notebook.sort.due": "Próximo repaso",
      "notebook.sort.recent": "Más recientes",
      "notebook.sort.worst": "Peores primero",
      "notebook.status.group": "Estado",
      "notebook.status.all": "Todas",
      "notebook.status.due": "Para repasar",
      "notebook.status.new": "Nuevas",
      "notebook.status.learning": "En estudio",
      "notebook.status.cleared": "Superadas",
      "notebook.filter.source": "Origen",
      "notebook.filter.tag": "Tema",
      "notebook.filter.phase": "Fase",
      "notebook.filter.quality": "Tu error",
      "notebook.filter.all": "Todos",
      "notebook.filter.allTags": "Todos los temas",
      "notebook.filter.allPhases": "Todas",
      "notebook.filter.more": "Más filtros",
      "notebook.filter.more.n": "Más filtros ({n})",
      "notebook.filter.clear": "Limpiar filtros",
      "notebook.source.own": "Tus partidas",
      "notebook.source.classic": "Clásicos",
      "notebook.source.daily": "Desafío diario",
      "notebook.source.notebook": "Cuaderno",
      "notebook.phase.opening": "Apertura",
      "notebook.phase.middlegame": "Medio juego",
      "notebook.phase.endgame": "Final",
      "notebook.quality.blunder": "Error grave",
      "notebook.quality.bad": "Error",
      "notebook.quality.dubious": "Dudosa",
      "notebook.quality.mild": "Leve",
      "notebook.count": "{n} tarjetas",
      "notebook.count.one": "1 tarjeta",
      "notebook.count.of": "{n} de {total} tarjetas",
      "notebook.count.of.one": "1 de {total} tarjetas",
      "notebook.more": "Mostrar más",
      "notebook.more.n": "Mostrar más ({n} restantes)",
      "notebook.list.empty.title": "Ninguna tarjeta coincide",
      "notebook.list.empty.body": "Probá con otros filtros o borrá la búsqueda.",

      "notebook.card.fallback": "Posición {n}",
      "notebook.card.aria": "Tarjeta: {title}",
      "notebook.origin.own": "Tu partida",
      "notebook.origin.own.vs": "Tu partida contra {name}",
      "notebook.origin.classic": "Partida clásica",
      "notebook.origin.daily": "Desafío diario",
      "notebook.origin.notebook": "Cuaderno",
      "notebook.origin.move": "Jugada {n}",
      "notebook.side.w": "Juegan las blancas",
      "notebook.side.b": "Juegan las negras",
      "notebook.card.yours": "Tu jugada",
      "notebook.card.yours.unknown": "Un error tuyo",
      "notebook.card.best": "La mejor",
      "notebook.card.best.pending": "Se calcula cuando la repases",
      "notebook.card.accuracy": "{n}% de precisión",
      "notebook.card.points": "{n} pts",
      "notebook.card.last": "Último repaso: {n}% de precisión",
      "notebook.card.never": "Todavía no la repasaste.",
      "notebook.card.board": "Posición de la tarjeta",
      "notebook.box.label": "Caja {n} de 5",
      "notebook.box.new": "Tarjeta nueva",
      "notebook.box.pips": "{label}",
      "notebook.box.cleared": "superada",
      "notebook.when.label": "Próximo repaso",
      "notebook.when.today": "Hoy",
      "notebook.when.later": "Hoy, más tarde",
      "notebook.when.overdue": "Vencida hace {n} días",
      "notebook.when.overdue.one": "Vencida desde ayer",
      "notebook.when.tomorrow": "Mañana",
      "notebook.when.days": "En {n} días",
      "notebook.when.due": "Para repasar",
      "notebook.action.review": "Repasar esta",
      "notebook.action.review.aria": "Repasar esta tarjeta: {title}",
      "notebook.action.lines": "Líneas",
      "notebook.action.remove": "Quitar",
      "notebook.action.remove.aria": "Quitar la tarjeta: {title}",
      "notebook.lines.title": "Líneas guardadas del motor",
      "notebook.lines.empty": "Todavía no hay líneas guardadas: el motor las calcula cuando repasás la tarjeta.",
      "notebook.lines.rank": "Línea {n}",
      "notebook.history.title": "Historial de repasos",
      "notebook.history.pass": "Aprobado",
      "notebook.history.fail": "Fallado",
      "notebook.history.empty": "Todavía sin repasos.",

      "notebook.remove.title": "¿Quitar esta tarjeta?",
      "notebook.remove.body": "Se borra de tu cuaderno y no vuelve a aparecer para repasar. Si te equivocás de nuevo en esta posición, se crea otra vez.",
      "notebook.remove.confirm": "Quitar tarjeta",
      "notebook.remove.done": "Tarjeta quitada del cuaderno.",
      "notebook.remove.failed": "No pudimos quitar la tarjeta. Probá de nuevo.",

      "notebook.session.review": "Repaso del cuaderno",
      "notebook.session.practice": "Práctica del cuaderno",
      "notebook.session.one": "Repaso de una tarjeta",
      "notebook.session.tag": "Repaso: {tag}",
      "notebook.error.start": "No pudimos empezar el repaso. Probá de nuevo.",
      "notebook.error.game": "El juego no está disponible en este momento.",

      "notebook.concept.example": "Ejemplo en el tablero",
      "notebook.concept.best": "Jugada del ejemplo: {san}",
      "notebook.concept.none": "Todavía no tenemos una lección sobre este tema.",
      "notebook.concept.school": "Ver la escuela de ajedrez",
      "notebook.concept.chip": "Ver la lección: {tag}",
      "notebook.concept.board": "Ejemplo de {title}",
    },
    en: {
      "notebook.title": "Notebook",
      "notebook.eyebrow": "Mistake notebook",
      "notebook.heading": "Your mistake notebook",
      "notebook.sub": "Every position you got wrong comes back at growing intervals, until you play it well several times in a row.",
      "notebook.unavailable": "The notebook is not available right now.",

      "notebook.empty.title": "Your notebook is still empty",
      "notebook.empty.body": "Whenever you get a position wrong we save it here and show it to you again later. Play a few positions to start filling it.",
      "notebook.empty.classics": "Play classic games",
      "notebook.empty.own": "Analyse your games",
      "notebook.empty.how": "How it works",
      "notebook.empty.step1.title": "You slip",
      "notebook.empty.step1.body": "A move below 70 accuracy saves the position.",
      "notebook.empty.step2.title": "It is saved",
      "notebook.empty.step2.body": "With the engine's move and the theme of the mistake, in box 0.",
      "notebook.empty.step3.title": "It comes back",
      "notebook.empty.step3.body": "After 1, 3, 7, 14 and 30 days: every pass moves it up a box.",

      "notebook.summary": "Notebook summary",
      "notebook.due.label": "to review now",
      "notebook.due.label.one": "to review now",
      "notebook.due.clear": "You are all caught up",
      "notebook.due.clear.body": "There are no cards to review right now.",
      "notebook.due.session": "The session takes {n} of the {due}.",
      "notebook.next": "Next review: {when}",
      "notebook.next.count": "{n} cards",
      "notebook.next.count.one": "1 card",
      "notebook.next.after": "After these: {when}",
      "notebook.next.none": "No card has a review pending.",
      "notebook.review.start": "Review {n} now",
      "notebook.review.start.one": "Review 1 now",
      "notebook.review.size": "Positions per session",
      "notebook.review.size.n": "{n} positions",
      "notebook.review.hint": "Every review you pass moves the card up a box; one you fail sends it back to box 1.",
      "notebook.practice.start": "Practise anyway",
      "notebook.practice.hint": "Practising early counts as a review too: if you pass it, the card moves up a box.",
      "notebook.stat.total": "Cards",
      "notebook.stat.cleared": "Cleared",
      "notebook.stat.cleared.hint": "In box 3 or higher",
      "notebook.stat.new": "New",
      "notebook.stat.new.hint": "Not reviewed yet",
      "notebook.boxes.title": "Review boxes",
      "notebook.boxes.caption": "How many cards sit in each box and how often they come back. The gold ones are cleared.",
      "notebook.boxes.new": "New",
      "notebook.boxes.day": "{n} d",
      "notebook.boxes.aria": "Box {n}: {count}, comes back {interval}",
      "notebook.boxes.aria.new": "Box 0, new cards: {count}",
      "notebook.boxes.interval": "every {n} days",
      "notebook.boxes.interval.one": "every day",
      "notebook.boxes.col.box": "Box",
      "notebook.boxes.col.cards": "Cards",

      "notebook.weak.title": "Weak spots",
      "notebook.weak.lead": "The themes that repeat most in your mistakes. Train one and review only those cards.",
      "notebook.weak.list": "Weak spots of the notebook",
      "notebook.weak.cards": "{n} cards · {open} not cleared",
      "notebook.weak.cards.one": "1 card · {open} not cleared",
      "notebook.weak.train": "Train this weakness",
      "notebook.weak.train.aria": "Train this weakness: {tag}",
      "notebook.weak.show": "Show cards",
      "notebook.weak.filter": "Show the cards about {tag}",

      "notebook.list.title": "Your cards",
      "notebook.list.region": "Notebook cards",
      "notebook.search": "Search",
      "notebook.search.placeholder": "Players, event or move",
      "notebook.search.clear": "Clear the search",
      "notebook.sort": "Sort by",
      "notebook.sort.due": "Next review",
      "notebook.sort.recent": "Most recent",
      "notebook.sort.worst": "Worst first",
      "notebook.status.group": "Status",
      "notebook.status.all": "All",
      "notebook.status.due": "Due",
      "notebook.status.new": "New",
      "notebook.status.learning": "Learning",
      "notebook.status.cleared": "Cleared",
      "notebook.filter.source": "Origin",
      "notebook.filter.tag": "Theme",
      "notebook.filter.phase": "Phase",
      "notebook.filter.quality": "Your mistake",
      "notebook.filter.all": "All",
      "notebook.filter.allTags": "All themes",
      "notebook.filter.allPhases": "All",
      "notebook.filter.more": "More filters",
      "notebook.filter.more.n": "More filters ({n})",
      "notebook.filter.clear": "Clear filters",
      "notebook.source.own": "Your games",
      "notebook.source.classic": "Classics",
      "notebook.source.daily": "Daily challenge",
      "notebook.source.notebook": "Notebook",
      "notebook.phase.opening": "Opening",
      "notebook.phase.middlegame": "Middlegame",
      "notebook.phase.endgame": "Endgame",
      "notebook.quality.blunder": "Serious mistake",
      "notebook.quality.bad": "Mistake",
      "notebook.quality.dubious": "Dubious",
      "notebook.quality.mild": "Mild",
      "notebook.count": "{n} cards",
      "notebook.count.one": "1 card",
      "notebook.count.of": "{n} of {total} cards",
      "notebook.count.of.one": "1 of {total} cards",
      "notebook.more": "Show more",
      "notebook.more.n": "Show more ({n} left)",
      "notebook.list.empty.title": "No card matches",
      "notebook.list.empty.body": "Try other filters or clear the search.",

      "notebook.card.fallback": "Position {n}",
      "notebook.card.aria": "Card: {title}",
      "notebook.origin.own": "Your game",
      "notebook.origin.own.vs": "Your game against {name}",
      "notebook.origin.classic": "Classic game",
      "notebook.origin.daily": "Daily challenge",
      "notebook.origin.notebook": "Notebook",
      "notebook.origin.move": "Move {n}",
      "notebook.side.w": "White to move",
      "notebook.side.b": "Black to move",
      "notebook.card.yours": "Your move",
      "notebook.card.yours.unknown": "A mistake of yours",
      "notebook.card.best": "The best",
      "notebook.card.best.pending": "Worked out when you review it",
      "notebook.card.accuracy": "{n}% accuracy",
      "notebook.card.points": "{n} pts",
      "notebook.card.last": "Last review: {n}% accuracy",
      "notebook.card.never": "You have not reviewed it yet.",
      "notebook.card.board": "Position of the card",
      "notebook.box.label": "Box {n} of 5",
      "notebook.box.new": "New card",
      "notebook.box.pips": "{label}",
      "notebook.box.cleared": "cleared",
      "notebook.when.label": "Next review",
      "notebook.when.today": "Today",
      "notebook.when.later": "Later today",
      "notebook.when.overdue": "Overdue by {n} days",
      "notebook.when.overdue.one": "Overdue since yesterday",
      "notebook.when.tomorrow": "Tomorrow",
      "notebook.when.days": "In {n} days",
      "notebook.when.due": "Due",
      "notebook.action.review": "Review this one",
      "notebook.action.review.aria": "Review this card: {title}",
      "notebook.action.lines": "Lines",
      "notebook.action.remove": "Remove",
      "notebook.action.remove.aria": "Remove the card: {title}",
      "notebook.lines.title": "Stored engine lines",
      "notebook.lines.empty": "No lines are stored yet: the engine works them out when you review the card.",
      "notebook.lines.rank": "Line {n}",
      "notebook.history.title": "Review history",
      "notebook.history.pass": "Passed",
      "notebook.history.fail": "Failed",
      "notebook.history.empty": "No reviews yet.",

      "notebook.remove.title": "Remove this card?",
      "notebook.remove.body": "It is deleted from your notebook and will not come back to review. If you get this position wrong again, a new card is created.",
      "notebook.remove.confirm": "Remove card",
      "notebook.remove.done": "Card removed from the notebook.",
      "notebook.remove.failed": "We could not remove the card. Try again.",

      "notebook.session.review": "Notebook review",
      "notebook.session.practice": "Notebook practice",
      "notebook.session.one": "Review of one card",
      "notebook.session.tag": "Review: {tag}",
      "notebook.error.start": "We could not start the review. Try again.",
      "notebook.error.game": "The game is not available right now.",

      "notebook.concept.example": "Example on the board",
      "notebook.concept.best": "Move of the example: {san}",
      "notebook.concept.none": "We do not have a lesson about this theme yet.",
      "notebook.concept.school": "Open the chess school",
      "notebook.concept.chip": "Open the lesson: {tag}",
      "notebook.concept.board": "Example of {title}",
    },
  };

  function registerText() {
    const i18n = L().i18n;
    if (i18n && typeof i18n.register === "function") i18n.register(TEXT);
  }
  registerText();

  // ---------- Constants and pure helpers ----------

  const DAY_MS = 86400000;
  const FALLBACK_LEITNER = [0, 1, 3, 7, 14, 30];
  const FALLBACK_CLEARED_BOX = 3;
  const SESSION_SIZES = [5, 10, 20];
  const DEFAULT_SIZE = 10;
  const PAGE_SIZE = 12;
  const WEAK_LIMIT = 4;
  const MIN_REFERENCE_LINES = 2; // fewer lines cannot tell an only move from a good one
  const STATUSES = ["all", "due", "new", "learning", "cleared"];
  const SORTS = ["due", "recent", "worst"];
  const PHASES = ["opening", "middlegame", "endgame"];
  const QUALITY_FILTERS = ["blunder", "bad", "dubious", "mild"];
  const SOURCES = ["own", "classic", "daily", "notebook"];
  const PREFS_KEY = "ludus.notebook.prefs.v1";
  const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

  function profileConstants() {
    const Profile = L().Profile;
    const c = Profile && Profile.constants ? Profile.constants : {};
    const leitner = Array.isArray(c.LEITNER_DAYS) && c.LEITNER_DAYS.length ? Array.from(c.LEITNER_DAYS) : FALLBACK_LEITNER;
    return {
      leitner,
      cleared: Number.isInteger(c.CLEARED_BOX) ? c.CLEARED_BOX : FALLBACK_CLEARED_BOX,
    };
  }

  const finite = (value) => typeof value === "number" && Number.isFinite(value);

  // Calendar day number of the LOCAL date (23 and 25 hour days of a DST change are still one day).
  function localDayNumber(ts) {
    const d = new Date(ts);
    return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
  }

  function daysBetween(fromTs, toTs) {
    return localDayNumber(toTs) - localDayNumber(fromTs);
  }

  function sideOfFen(fen) {
    return String(fen || "").split(" ")[1] === "b" ? "b" : "w";
  }

  function isDue(card, now) {
    return Boolean(card) && finite(card.due) && card.due <= now;
  }

  // "cleared" = box 3 or higher (7 day interval); "new" = never reviewed; everything else is being learned.
  function statusOf(card, clearedBox) {
    const cleared = Number.isInteger(clearedBox) ? clearedBox : profileConstants().cleared;
    if (card.box >= cleared) return "cleared";
    if (!card.reviews) return "new";
    return "learning";
  }

  // When a card is due, as data for the words: { kind, n, due } with kind today | later | overdue | tomorrow | days.
  function whenOf(dueTs, now) {
    const days = daysBetween(now, dueTs);
    if (dueTs <= now) {
      const late = -days;
      return late <= 0 ? { kind: "today", n: 0, due: true } : { kind: "overdue", n: late, due: true };
    }
    if (days <= 0) return { kind: "later", n: 0, due: false };
    if (days === 1) return { kind: "tomorrow", n: 1, due: false };
    return { kind: "days", n: days, due: false };
  }

  function whenText(dueTs, now) {
    const when = whenOf(dueTs, now);
    if (when.kind === "overdue") return tCount("notebook.when.overdue", when.n);
    if (when.kind === "days") return t("notebook.when.days", { n: when.n });
    return t(`notebook.when.${when.kind}`);
  }

  // Counts, boxes and the next review of the whole notebook (computed here, from the cards, so the numbers on
  // the screen always agree with the list below them).
  function summarize(cards, now, clearedBox) {
    const list = Array.isArray(cards) ? cards : [];
    const { leitner } = profileConstants();
    const cleared = Number.isInteger(clearedBox) ? clearedBox : profileConstants().cleared;
    const byBox = leitner.map(() => 0);
    const out = { total: list.length, due: 0, cleared: 0, fresh: 0, learning: 0, byBox, next: null };
    list.forEach((card) => {
      const box = Math.max(0, Math.min(byBox.length - 1, Number(card.box) || 0));
      byBox[box] += 1;
      if (isDue(card, now)) out.due += 1;
      const status = statusOf(card, cleared);
      if (status === "cleared") out.cleared += 1;
      else if (status === "new") out.fresh += 1;
      else out.learning += 1;
      if (!isDue(card, now) && finite(card.due) && (out.next === null || card.due < out.next.ts)) out.next = { ts: card.due, count: 0 };
    });
    if (out.next) {
      const day = localDayNumber(out.next.ts);
      out.next.count = list.filter((card) => !isDue(card, now) && finite(card.due) && localDayNumber(card.due) === day).length;
    }
    return out;
  }

  function cleanSize(value) {
    const n = Number(value);
    return SESSION_SIZES.includes(n) ? n : DEFAULT_SIZE;
  }

  // ----- text search and quality -----

  function normalizeText(value) {
    let text = value === undefined || value === null ? "" : String(value);
    try {
      text = text.normalize("NFD");
    } catch (error) {
      // compare as it is
    }
    return text.replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  // The accuracy bands Ludus.Profile uses to name a quality when the round has none.
  function qualityFromAccuracy(accuracy) {
    if (!finite(accuracy)) return null;
    if (accuracy >= 99.5) return "perfect";
    if (accuracy >= 90) return "very_good";
    if (accuracy >= 75) return "good";
    if (accuracy >= 55) return "interesting";
    if (accuracy >= 35) return "dubious";
    if (accuracy >= 10) return "bad";
    return "blunder";
  }

  // blunder | bad | dubious | mild: how bad the mistake that created the card was.
  function qualityBucket(code) {
    if (code === "blunder" || code === "bad" || code === "dubious") return code;
    return "mild";
  }

  // The history entry of the mistake that created the card: the one in box 0 (a review can never send a card
  // there), else the first failed one, else the first of all.
  function mistakeEntryOf(card) {
    const history = Array.isArray(card && card.history) ? card.history : [];
    return history.find((entry) => entry.box === 0)
      || history.find((entry) => entry.passed === false)
      || history[0]
      || null;
  }

  // What the card knows about the move that made it: from the stored round when it is still there (Profile keeps
  // the last 600), else only the accuracy that the card history kept.
  function yourMoveOf(card, roundsById) {
    const entry = mistakeEntryOf(card);
    if (!entry) return null;
    const round = entry.roundId && roundsById && typeof roundsById.get === "function" ? roundsById.get(entry.roundId) : null;
    if (round) {
      return {
        san: round.userSan || null,
        uci: round.userUci || null,
        accuracy: finite(round.accuracy) ? round.accuracy : entry.accuracy,
        points: finite(round.points) ? round.points : null,
        quality: round.qualityCode || qualityFromAccuracy(entry.accuracy),
        exact: true,
      };
    }
    return { san: null, uci: null, accuracy: entry.accuracy, points: null, quality: qualityFromAccuracy(entry.accuracy), exact: false };
  }

  // ----- filters and sorts -----

  const DEFAULT_FILTERS = Object.freeze({ status: "all", source: "all", tag: "all", phase: "all", quality: "all", query: "" });

  function cleanFilters(input) {
    const f = input && typeof input === "object" ? input : {};
    return {
      status: STATUSES.includes(f.status) ? f.status : "all",
      source: typeof f.source === "string" && f.source ? f.source : "all",
      tag: typeof f.tag === "string" && f.tag ? f.tag : "all",
      phase: PHASES.includes(f.phase) ? f.phase : "all",
      quality: QUALITY_FILTERS.includes(f.quality) ? f.quality : "all",
      query: typeof f.query === "string" ? f.query : "",
    };
  }

  // How many of the "more filters" (everything but the status pills and the search box) are on.
  function moreFiltersActive(filters) {
    const f = cleanFilters(filters);
    return ["source", "tag", "phase", "quality"].filter((key) => f[key] !== "all").length;
  }

  function anyFilterActive(filters) {
    const f = cleanFilters(filters);
    return f.status !== "all" || Boolean(normalizeText(f.query)) || moreFiltersActive(f) > 0;
  }

  // ctx: { now, qualityOf(card) -> code | null, tagLabel(tag) -> text, localize(meta) -> meta } (the last one so the text
  // the card shows is also what the search finds).
  function filterCards(cards, filters, ctx) {
    const f = cleanFilters(filters);
    const c = ctx || {};
    const now = finite(c.now) ? c.now : Date.now();
    const words = normalizeText(f.query).split(" ").filter(Boolean);
    const cleared = profileConstants().cleared;
    return (Array.isArray(cards) ? cards : []).filter((card) => {
      if (f.status === "due" && !isDue(card, now)) return false;
      if (f.status !== "all" && f.status !== "due" && statusOf(card, cleared) !== f.status) return false;
      if (f.source !== "all" && card.source !== f.source) return false;
      if (f.tag !== "all" && !(Array.isArray(card.tags) && card.tags.includes(f.tag))) return false;
      if (f.phase !== "all" && card.phase !== f.phase) return false;
      if (f.quality !== "all") {
        const code = typeof c.qualityOf === "function" ? c.qualityOf(card) : null;
        if (qualityBucket(code) !== f.quality) return false;
      }
      if (words.length) {
        const meta = card.meta || {};
        const labels = typeof c.tagLabel === "function" ? (card.tags || []).map((tag) => c.tagLabel(tag)).join(" ") : (card.tags || []).join(" ");
        const shown = typeof c.localize === "function" ? c.localize(meta) || meta : meta;
        const hay = normalizeText([meta.players, meta.event, shown.players, shown.event, meta.site, meta.year, meta.eco, card.bestSan, labels].join(" "));
        if (!words.every((word) => hay.includes(word))) return false;
      }
      return true;
    });
  }

  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  function sortCards(cards, sort) {
    const list = Array.isArray(cards) ? cards.slice() : [];
    const accuracyOf = (card) => (finite(card.lastAccuracy) ? card.lastAccuracy : 101);
    const sorters = {
      due: (a, b) => (a.due - b.due) || (a.box - b.box) || byId(a, b),
      recent: (a, b) => (b.createdAt - a.createdAt) || byId(a, b),
      worst: (a, b) => (accuracyOf(a) - accuracyOf(b)) || (a.box - b.box) || (a.due - b.due) || byId(a, b),
    };
    return list.sort(SORTS.includes(sort) ? sorters[sort] : sorters.due);
  }

  // Values that exist in the cards, for the selects: { sources: [{value, count}], tags: [...], phases: [...] }.
  function distinctOptions(cards) {
    const count = (map, key) => map.set(key, (map.get(key) || 0) + 1);
    const sources = new Map();
    const tags = new Map();
    const phases = new Map();
    (Array.isArray(cards) ? cards : []).forEach((card) => {
      if (card.source) count(sources, card.source);
      if (card.phase) count(phases, card.phase);
      (card.tags || []).forEach((tag) => count(tags, tag));
    });
    const rows = (map, order) => Array.from(map.entries())
      .map(([value, n]) => ({ value, count: n }))
      .sort((a, b) => {
        if (order) return (order.indexOf(a.value) + 1 || 99) - (order.indexOf(b.value) + 1 || 99);
        return (b.count - a.count) || (a.value < b.value ? -1 : 1);
      });
    return { sources: rows(sources, SOURCES), tags: rows(tags), phases: rows(phases, PHASES) };
  }

  // The themes that repeat in the cards that are not cleared yet, most open cards first.
  function weakSpots(cards, options) {
    const opts = options || {};
    const limit = Number.isInteger(opts.limit) ? opts.limit : WEAK_LIMIT;
    const cleared = Number.isInteger(opts.clearedBox) ? opts.clearedBox : profileConstants().cleared;
    const map = new Map();
    (Array.isArray(cards) ? cards : []).forEach((card) => {
      (card.tags || []).forEach((tag) => {
        const row = map.get(tag) || { tag, count: 0, open: 0 };
        row.count += 1;
        if (card.box < cleared) row.open += 1;
        map.set(tag, row);
      });
    });
    return Array.from(map.values())
      .filter((row) => row.open > 0)
      .sort((a, b) => (b.open - a.open) || (b.count - a.count) || (a.tag < b.tag ? -1 : 1))
      .slice(0, Math.max(0, limit));
  }

  // ----- which cards a session takes -----

  // mode "due": the cards that are due, most overdue first; "practice": the lowest boxes first (used when
  // nothing is due); "tag": the cards of one theme, due ones first, then the lowest boxes.
  function pickReviewCards(cards, options) {
    const opts = options || {};
    const size = cleanSize(opts.size);
    const now = finite(opts.now) ? opts.now : Date.now();
    const list = Array.isArray(cards) ? cards : [];
    const cmpDue = (a, b) => (a.due - b.due) || (a.box - b.box) || byId(a, b);
    if (opts.mode === "practice") {
      return list.slice().sort((a, b) => (a.box - b.box) || (a.due - b.due) || byId(a, b)).slice(0, size);
    }
    if (opts.mode === "tag") {
      return list
        .filter((card) => Array.isArray(card.tags) && card.tags.includes(opts.tag))
        .sort((a, b) => (Number(isDue(b, now)) - Number(isDue(a, now))) || (a.box - b.box) || cmpDue(a, b))
        .slice(0, size);
    }
    return list.filter((card) => isDue(card, now)).sort(cmpDue).slice(0, size);
  }

  // ----- building the position of a session from a card -----

  // The reference lines of a card, or null. A card made while the fallback engine was in charge has no lines (the
  // records never keep lines that a 3-ply search guessed), and a set with fewer than two lines cannot tell an
  // only move from a merely good one: in both cases the round analyses the position at its root instead, exactly
  // like a position without a reference (docs/ARCHITECTURE.md section 19).
  function referenceFromCard(card, chessApi) {
    const raw = Array.isArray(card && card.lines) ? card.lines : [];
    const lines = [];
    raw.forEach((line) => {
      if (!line || typeof line !== "object" || !UCI_RE.test(String(line.uci || "")) || !finite(line.score)) return;
      if (lines.some((entry) => entry.uci === line.uci)) return;
      const pv = Array.isArray(line.pv) ? line.pv.filter((move) => UCI_RE.test(String(move))) : [];
      lines.push({ uci: line.uci, san: typeof line.san === "string" ? line.san : "", score: line.score, pv: pv.length ? pv : [line.uci] });
    });
    if (!lines.length) return null;
    // Best first: a set that is not ordered by score did not come from one multi-line search.
    if (lines.some((line) => line.score > lines[0].score)) return null;
    let legalMoves = null;
    const api = chessApi || L().chess;
    if (api && api.Chess && typeof api.uciToMove === "function") {
      try {
        const chess = new api.Chess(card.fen);
        legalMoves = chess.generateMoves().length;
        if (!lines.every((line) => api.uciToMove(line.uci, chess))) return null;
      } catch (error) {
        return null;
      }
    }
    const needed = Math.min(MIN_REFERENCE_LINES, legalMoves === null ? MIN_REFERENCE_LINES : legalMoves);
    if (lines.length < needed) return null;
    return { origin: "precomputed", lines };
  }

  // The Position of docs/ARCHITECTURE.md section 9 for one card.
  function positionFromCard(card, options) {
    const opts = options || {};
    const meta = Object.assign({}, card.meta || {});
    if (!meta.sideToMove) meta.sideToMove = card.sideToMove === "b" || card.sideToMove === "w" ? card.sideToMove : sideOfFen(card.fen);
    const position = {
      id: `notebook:${card.id}`,
      fen: card.fen,
      source: "notebook",
      cardId: card.id,
      meta,
      tags: Array.isArray(card.tags) ? card.tags.slice() : [],
    };
    if (card.phase) position.phase = card.phase;
    const reference = referenceFromCard(card, opts.chess);
    if (reference) {
      const first = reference.lines[0];
      position.reference = reference;
      position.bestMoveUci = first.uci;
      const san = first.san || (card.bestUci === first.uci ? card.bestSan : "");
      if (san) position.bestMoveSan = san;
    }
    return position;
  }

  // ----- where a card comes from -----

  function samePerson(a, b) {
    const x = normalizeText(a);
    return Boolean(x) && x === normalizeText(b);
  }

  // { kind, title, detail }: `title` is the line that names the game ("Your game against Anna", "Morphy vs Duke"),
  // empty when the card knows nothing about it (the caller then names the card by its number); `detail` is the
  // rest ("Lichess · 2024 · Move 21"). The origin itself ("Your game", "Classic game") is shown by the caller
  // from `kind`. `options.t(key, params)` translates, `options.profileName` finds the opponent in your own games,
  // `options.localize(meta)` gives the metadata in the language of the page (a classic is stored in English / ASCII).
  function originOf(card, options) {
    const opts = options || {};
    const tr = typeof opts.t === "function" ? opts.t : (key) => key;
    const stored = (card && card.meta) || {};
    const meta = typeof opts.localize === "function" ? opts.localize(stored) || stored : stored;
    const source = SOURCES.includes(card && card.source) ? card.source : "own";
    const players = typeof meta.players === "string" ? meta.players.trim() : "";
    let title = players;
    if (source === "own" && players) {
      const parts = players.split(/\s+vs\.?\s+/i).map((part) => part.trim()).filter(Boolean);
      const me = opts.profileName;
      if (parts.length === 2 && me && (samePerson(parts[0], me) || samePerson(parts[1], me))) {
        title = tr("notebook.origin.own.vs", { name: samePerson(parts[0], me) ? parts[1] : parts[0] });
      }
    }
    if (!title && source !== "own" && meta.event) title = String(meta.event);
    const detail = [];
    if (meta.event && String(meta.event) !== title) detail.push(String(meta.event));
    if (meta.year) detail.push(String(meta.year));
    if (finite(meta.moveNumber) && meta.moveNumber > 0) detail.push(tr("notebook.origin.move", { n: meta.moveNumber }));
    return { kind: source, title, detail };
  }

  // ----- the box chart -----

  // Geometry of the bars, as numbers (the SVG is drawn from it): a column per box, at most 24 wide, growing from
  // one baseline. Empty boxes keep no bar; the caller draws a hairline stub instead.
  function boxBars(counts, options) {
    const opts = options || {};
    const width = finite(opts.width) ? opts.width : 320;
    const height = finite(opts.height) ? opts.height : 132;
    const top = finite(opts.top) ? opts.top : 22;
    const bottom = finite(opts.bottom) ? opts.bottom : 26;
    const list = (Array.isArray(counts) ? counts : []).map((n) => Math.max(0, Number(n) || 0));
    const slot = list.length ? width / list.length : width;
    const barW = Math.max(6, Math.min(24, slot - 14));
    const plotH = Math.max(1, height - top - bottom);
    const max = Math.max(1, ...list);
    return list.map((value, i) => {
      const barH = value > 0 ? Math.max(4, Math.round((plotH * value) / max)) : 0;
      return {
        index: i,
        value,
        cx: Math.round((slot * i + slot / 2) * 100) / 100,
        x: Math.round((slot * i + (slot - barW) / 2) * 100) / 100,
        y: top + plotH - barH,
        w: barW,
        h: barH,
        baseline: top + plotH,
      };
    });
  }

  // A column with a rounded top and a square foot (a bar grows from its baseline).
  function roundedTopPath(x, y, w, hgt, radius) {
    const r = Math.max(0, Math.min(radius, hgt / 2, w / 2));
    return `M${x} ${y + hgt}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + hgt}Z`;
  }

  // ----- lines of the engine as text -----

  // "14. Qxd5 Nc6 15. Bxc6" from the FEN, the UCI moves and Ludus.chess; UCI text when the moves do not replay.
  function formatPv(fen, pv, chessApi) {
    const moves = Array.isArray(pv) ? pv : [];
    const api = chessApi || L().chess;
    if (!moves.length) return "";
    if (!api || !api.Chess || typeof api.uciToMove !== "function" || typeof api.moveToSan !== "function") return moves.join(" ");
    const out = [];
    try {
      const chess = new api.Chess(fen);
      const parts = String(fen).split(" ");
      let number = Number(parts[5]) > 0 ? Number(parts[5]) : 1;
      let white = chess.turn === "w";
      moves.forEach((uci, index) => {
        const move = api.uciToMove(uci, chess);
        if (!move) throw new Error("illegal");
        const san = api.moveToSan(chess, move);
        chess.makeMove(move);
        if (white) out.push(`${number}. ${san}`);
        else out.push(index === 0 ? `${number}… ${san}` : san);
        if (!white) number += 1;
        white = !white;
      });
    } catch (error) {
      return moves.join(" ");
    }
    return out.join(" ");
  }

  // ---------- Small DOM helpers ----------

  const state = {
    mounted: false,
    container: null,
    visible: false,
    dirty: false,
    starting: false,
    cards: [],
    rounds: new Map(),
    now: 0,
    profileName: "",
    filters: Object.assign({}, DEFAULT_FILTERS),
    sort: "due",
    size: DEFAULT_SIZE,
    shown: PAGE_SIZE,
    expanded: new Set(),
    moreOpen: false,
    refs: {},
    offs: [],
    searchTimer: null,
    refreshTimer: null,
    pendingFocus: null,
  };

  function nowMs() {
    const util = L().util;
    try {
      return util && typeof util.now === "function" ? util.now() : Date.now();
    } catch (error) {
      return Date.now();
    }
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function setHidden(el, on) {
    if (!el) return;
    el.hidden = Boolean(on);
    if (on) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  }

  function reducedMotion() {
    const ui = L().ui;
    try {
      return Boolean(ui && typeof ui.reducedMotion === "function" && ui.reducedMotion());
    } catch (error) {
      return false;
    }
  }

  function focusNode(el) {
    if (!el || typeof el.focus !== "function") return;
    if (typeof el.setAttribute === "function" && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    try {
      el.focus({ preventScroll: true });
    } catch (error) {
      // focus is best effort
    }
  }

  function scrollToNode(el) {
    if (!el || typeof el.scrollIntoView !== "function") return;
    try {
      el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    } catch (error) {
      el.scrollIntoView();
    }
  }

  function toast(message, kind) {
    const ui = L().ui;
    try {
      if (ui && typeof ui.toast === "function") ui.toast(message, { kind: kind || "info" });
    } catch (error) {
      // a toast is a courtesy
    }
  }

  function numberFormat(n, digits) {
    const value = Number(n);
    if (!Number.isFinite(value)) return "";
    try {
      return new Intl.NumberFormat(lang() === "en" ? "en-US" : "es-AR", { maximumFractionDigits: digits === undefined ? 0 : digits }).format(value);
    } catch (error) {
      return String(Math.round(value * 10) / 10);
    }
  }

  function dateText(ts, options) {
    const util = L().util;
    if (!util || typeof util.formatDate !== "function") return "";
    // formatDate always adds year / month / day; naming only some of them needs the others switched off.
    const wanted = options ? Object.assign({ year: undefined, month: undefined, day: undefined }, options) : undefined;
    return util.formatDate(ts, lang(), wanted);
  }

  function tagLabel(tag) {
    const Insights = L().Insights;
    const key = Insights && typeof Insights.tagLabelKey === "function" ? Insights.tagLabelKey(tag) : "";
    const text = key ? t(key) : "";
    if (text && text !== key) return text;
    return String(tag).replace(/_/g, " ");
  }

  function conceptsFor(tag) {
    const Concepts = L().Concepts;
    try {
      return Concepts && typeof Concepts.byTag === "function" ? Concepts.byTag(tag) : [];
    } catch (error) {
      return [];
    }
  }

  function loadPrefs() {
    const storage = L().storage;
    let prefs = null;
    try {
      prefs = storage && typeof storage.get === "function" ? storage.get(PREFS_KEY, null) : null;
    } catch (error) {
      prefs = null;
    }
    if (prefs && typeof prefs === "object") {
      state.size = cleanSize(prefs.size);
      state.sort = SORTS.includes(prefs.sort) ? prefs.sort : "due";
    }
  }

  function savePrefs() {
    const storage = L().storage;
    try {
      if (storage && typeof storage.set === "function") storage.set(PREFS_KEY, { v: 1, size: state.size, sort: state.sort });
    } catch (error) {
      // remembering is a courtesy
    }
  }

  // A trash can: the kit has no such icon.
  function trashIcon(size) {
    return h("svg:svg", {
      class: "ui-icon ui-icon-trash", width: size || 18, height: size || 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
      "stroke-width": 1.75, "stroke-linecap": "round", "stroke-linejoin": "round", focusable: "false", "aria-hidden": "true",
    }, h("svg:path", { d: "M4.5 7h15" }), h("svg:path", { d: "M9.5 7V4.8h5V7" }), h("svg:path", { d: "M6.5 7l.8 12a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9L17.5 7" }),
      h("svg:path", { d: "M10 11v5.5" }), h("svg:path", { d: "M14 11v5.5" }));
  }

  // ---------- Data ----------

  function load() {
    const Profile = L().Profile;
    state.now = nowMs();
    let cards = [];
    try {
      cards = Profile && Profile.notebook && typeof Profile.notebook.list === "function" ? Profile.notebook.list({ sort: "due", now: state.now }) : [];
    } catch (error) {
      logError("[Ludus.notebook] the cards could not be read", error);
      cards = [];
    }
    state.cards = Array.isArray(cards) ? cards : [];
    state.rounds = new Map();
    try {
      const wanted = new Set();
      state.cards.forEach((card) => (card.history || []).forEach((entry) => entry.roundId && wanted.add(entry.roundId)));
      const rounds = wanted.size && Profile && typeof Profile.rounds === "function" ? Profile.rounds() : [];
      rounds.forEach((round) => {
        if (wanted.has(round.id)) state.rounds.set(round.id, round);
      });
    } catch (error) {
      state.rounds = new Map();
    }
    try {
      const active = Profile && typeof Profile.active === "function" ? Profile.active() : null;
      state.profileName = active && active.name ? String(active.name) : "";
    } catch (error) {
      state.profileName = "";
    }
  }

  function qualityOfCard(card) {
    const move = yourMoveOf(card, state.rounds);
    return move ? move.quality : null;
  }

  function filterContext() {
    return { now: state.now, qualityOf: qualityOfCard, tagLabel, localize: localizeMeta };
  }

  function visibleCards() {
    return sortCards(filterCards(state.cards, state.filters, filterContext()), state.sort);
  }

  // ---------- Starting a review ----------

  function setBusy(button, on) {
    if (state.container) state.container.classList.toggle("is-starting", Boolean(on));
    if (button && typeof button.setAttribute === "function") {
      if (on) button.setAttribute("aria-busy", "true");
      else button.removeAttribute("aria-busy");
    }
  }

  async function startReview(cards, title, button) {
    if (state.starting) return false;
    const game = L().game;
    if (!game || typeof game.startSession !== "function") {
      toast(t("notebook.error.game"), "error");
      return false;
    }
    const chess = L().chess;
    const positions = cards.map((card) => positionFromCard(card, { chess }));
    if (!positions.length) return false;
    state.starting = true;
    setBusy(button, true);
    try {
      await game.startSession({ kind: "review", title, mode: "solo", positions });
      return true;
    } catch (error) {
      logError("[Ludus.notebook] the review could not start", error);
      toast(t("notebook.error.start"), "error");
      return false;
    } finally {
      state.starting = false;
      setBusy(button, false);
    }
  }

  function reviewDue(button) {
    return startReview(pickReviewCards(state.cards, { mode: "due", size: state.size, now: state.now }), t("notebook.session.review"), button);
  }

  function practiceAnyway(button) {
    return startReview(pickReviewCards(state.cards, { mode: "practice", size: state.size, now: state.now }), t("notebook.session.practice"), button);
  }

  function reviewOne(card, button) {
    return startReview([card], t("notebook.session.one"), button);
  }

  function trainTag(tag, button) {
    return startReview(pickReviewCards(state.cards, { mode: "tag", tag, size: state.size, now: state.now }), t("notebook.session.tag", { tag: tagLabel(tag) }), button);
  }

  // ---------- The lesson of a theme ----------

  function uciSquares(uci) {
    const match = /^([a-h][1-8])([a-h][1-8])[qrbn]?$/.exec(String(uci || ""));
    return match ? { from: match[1], to: match[2] } : null;
  }

  function conceptMoveSan(concept) {
    const api = L().chess;
    if (!concept || !api || !api.Chess || typeof api.uciToMove !== "function" || typeof api.moveToSan !== "function") return null;
    try {
      const chess = new api.Chess(concept.fen);
      const move = api.uciToMove(concept.bestUci, chess);
      return move ? api.moveToSan(chess, move) : null;
    } catch (error) {
      return null;
    }
  }

  // Opens the lessons that explain a theme in a dialog. `options.train` adds "Train this weakness" (only when the
  // notebook has cards of that theme). Resolves to the modal handle, or null when there is no kit.
  function openConcept(tag, options) {
    const ui = L().ui;
    const opts = options || {};
    if (!ui || typeof ui.modal !== "function" || !getDoc()) return null;
    const language = lang();
    const concepts = conceptsFor(tag);
    const Concepts = L().Concepts;
    const body = concepts.length
      ? concepts.map((concept) => {
        const copy = Concepts && typeof Concepts.text === "function" ? Concepts.text(concept.id, language) : null;
        const title = copy ? copy.title : concept.id;
        const move = uciSquares(concept.bestUci);
        const san = conceptMoveSan(concept);
        // Focusable so that a lesson taller than a phone can be scrolled with the keyboard (the dialog body is a
        // scroll region and needs something to focus inside it).
        return h("article", { class: "notebook-concept", tabindex: "0", role: "group", "aria-label": title },
          h("div", { class: "notebook-concept-board" },
            typeof ui.miniBoard === "function"
              ? ui.miniBoard(concept.fen, {
                size: 200,
                orientation: sideOfFen(concept.fen),
                arrows: move ? [{ from: move.from, to: move.to, color: "best" }] : [],
                label: t("notebook.concept.board", { title }),
              })
              : null),
          h("div", { class: "notebook-concept-text" },
            // One lesson named like the dialog itself: the heading would only say it twice.
            concepts.length === 1 && normalizeText(title) === normalizeText(tagLabel(tag)) ? null : h("h3", { class: "notebook-concept-title" }, title),
            h("p", { class: "notebook-concept-body" }, copy ? copy.body : ""),
            san ? h("p", { class: "notebook-concept-move" }, icon("lightbulb", { size: 16 }), t("notebook.concept.best", { san })) : null));
      })
      : [h("p", { class: "notebook-concept-none" }, t("notebook.concept.none"))];
    const actions = [];
    if (opts.train && state.cards.some((card) => (card.tags || []).includes(tag))) {
      actions.push({ label: t("notebook.weak.train"), kind: "primary", icon: "target", onClick: () => { void trainTag(tag); } });
    }
    actions.push({
      label: t("notebook.concept.school"),
      kind: "secondary",
      onClick: () => {
        const router = L().router;
        if (router && typeof router.show === "function") router.show("museum", { tab: "school" });
      },
    });
    actions.push({ label: t("ui.close"), kind: "ghost", value: "close" });
    return ui.modal({ title: tagLabel(tag), body, actions, size: "md", className: "notebook-concept-modal" });
  }

  // ---------- Pieces of the screen ----------

  function tagChip(tag) {
    const label = tagLabel(tag);
    if (conceptsFor(tag).length && getDoc()) {
      return h("button", {
        type: "button",
        class: "chip notebook-tag",
        "data-tag": tag,
        "aria-label": t("notebook.concept.chip", { tag: label }),
        onclick: () => openConcept(tag, { train: true }),
      }, icon("lightbulb", { size: 14 }), label);
    }
    return h("span", { class: "chip notebook-tag is-plain", "data-tag": tag }, label);
  }

  function pips(card, clearedBox) {
    const box = Math.max(0, Math.min(5, Number(card.box) || 0));
    const label = box === 0 ? t("notebook.box.new") : t("notebook.box.label", { n: box });
    const items = [];
    for (let i = 1; i <= 5; i += 1) {
      items.push(h("span", { class: `notebook-pip${i <= box ? " is-on" : ""}${i <= box && box >= clearedBox ? " is-cleared" : ""}` }));
    }
    return h("span", { class: "notebook-pips", role: "img", "aria-label": label }, items,
      h("span", { class: "notebook-pips-text", "aria-hidden": "true" }, label));
  }

  // The classics screen owns the display names of the games; without it the stored text is shown as it is.
  function localizeMeta(meta) {
    const screen = L().Screens && L().Screens.classics;
    const helpers = screen && screen.helpers;
    if (!helpers || typeof helpers.localizeMeta !== "function") return meta;
    try {
      return helpers.localizeMeta(meta, lang());
    } catch (error) {
      return meta;
    }
  }

  function cardTitle(card, index) {
    const origin = originOf(card, { t, profileName: state.profileName, localize: localizeMeta });
    return origin.title || t("notebook.card.fallback", { n: index + 1 });
  }

  function movesBlock(card) {
    const mine = yourMoveOf(card, state.rounds);
    const rows = [];
    const yourMeta = [];
    if (mine && finite(mine.accuracy)) yourMeta.push(t("notebook.card.accuracy", { n: numberFormat(mine.accuracy, 0) }));
    if (mine && finite(mine.points)) yourMeta.push(t("notebook.card.points", { n: numberFormat(mine.points, 1) }));
    if (mine) {
      const ui = L().ui;
      rows.push(h("div", { class: "notebook-move is-yours" },
        h("dt", { class: "notebook-move-label" }, mine.san ? t("notebook.card.yours") : t("notebook.card.yours.unknown")),
        h("dd", { class: "notebook-move-value" },
          mine.san ? h("span", { class: "notebook-san" }, mine.san) : null,
          mine.quality && ui && typeof ui.qualityBadge === "function" ? ui.qualityBadge(mine.quality) : null,
          yourMeta.length ? h("span", { class: "notebook-move-meta" }, yourMeta.join(" · ")) : null)));
    }
    const bestSan = card.bestSan || (Array.isArray(card.lines) && card.lines[0] && card.lines[0].san) || "";
    rows.push(h("div", { class: "notebook-move is-best" },
      h("dt", { class: "notebook-move-label" }, t("notebook.card.best")),
      h("dd", { class: "notebook-move-value" },
        bestSan ? h("span", { class: "notebook-san is-best" }, bestSan) : h("span", { class: "notebook-move-meta" }, t("notebook.card.best.pending")))));
    return h("dl", { class: "notebook-moves" }, rows);
  }

  function linesPanel(card, panelId, open) {
    const language = lang();
    const Scoring = L().Scoring;
    const lines = Array.isArray(card.lines) ? card.lines : [];
    const history = Array.isArray(card.history) ? card.history.slice().reverse() : [];
    const evalText = (score) => {
      try {
        return Scoring && typeof Scoring.formatEval === "function" ? Scoring.formatEval(score, language) : String(score);
      } catch (error) {
        return String(score);
      }
    };
    return h("div", { class: "notebook-panel", id: panelId, hidden: !open },
      h("div", { class: "notebook-panel-block" },
        h("h4", { class: "notebook-panel-title" }, t("notebook.lines.title")),
        lines.length
          ? h("ol", { class: "notebook-lines" }, lines.map((line, index) => {
            const first = formatPv(card.fen, line.pv && line.pv.length ? line.pv : [line.uci]);
            return h("li", { class: "notebook-line" },
              h("span", { class: "notebook-line-eval", "aria-label": `${t("notebook.lines.rank", { n: index + 1 })}: ${evalText(line.score)}` }, evalText(line.score)),
              h("span", { class: "notebook-line-pv" }, first));
          }))
          : h("p", { class: "notebook-panel-empty" }, t("notebook.lines.empty"))),
      h("div", { class: "notebook-panel-block" },
        h("h4", { class: "notebook-panel-title" }, t("notebook.history.title")),
        history.length
          ? h("ul", { class: "notebook-history" }, history.slice(0, 6).map((entry) => h("li", { class: "notebook-history-item" },
            h("span", { class: "notebook-history-date" }, dateText(entry.ts, { day: "numeric", month: "short" })),
            h("span", { class: "notebook-history-acc" }, t("notebook.card.accuracy", { n: numberFormat(entry.accuracy, 0) })),
            h("span", { class: `notebook-history-flag ${entry.passed ? "is-pass" : "is-fail"}` }, entry.passed ? t("notebook.history.pass") : t("notebook.history.fail")))))
          : h("p", { class: "notebook-panel-empty" }, t("notebook.history.empty"))));
  }

  function cardNode(card, index) {
    const ui = L().ui;
    const { cleared } = profileConstants();
    const title = cardTitle(card, index);
    const origin = originOf(card, { t, profileName: state.profileName, localize: localizeMeta });
    const side = card.sideToMove === "b" || card.sideToMove === "w" ? card.sideToMove : sideOfFen(card.fen);
    const bestUci = card.bestUci || (card.lines && card.lines[0] && card.lines[0].uci) || "";
    const arrow = uciSquares(bestUci);
    const due = isDue(card, state.now);
    const when = whenOf(card.due, state.now);
    const open = state.expanded.has(card.id);
    const panelId = `notebook-panel-${card.id}`;
    const headId = `notebook-card-${card.id}`;
    const reviewButton = h("button", {
      type: "button",
      class: "btn btn-secondary notebook-action",
      "aria-label": t("notebook.action.review.aria", { title }),
      onclick: () => { void reviewOne(card, reviewButton); },
    }, icon("play", { size: 18 }), h("span", { class: "btn-label" }, t("notebook.action.review")));
    const linesButton = h("button", {
      type: "button",
      class: `btn btn-ghost notebook-action notebook-lines-toggle${open ? " is-open" : ""}`,
      "aria-expanded": String(open),
      "aria-controls": panelId,
      onclick: () => toggleLines(card, linesButton),
    }, h("span", { class: "btn-label" }, t("notebook.action.lines")), icon("chevron-down", { size: 16 }));
    const removeButton = h("button", {
      type: "button",
      class: "btn btn-ghost btn-icon notebook-remove",
      "aria-label": t("notebook.action.remove.aria", { title }),
      title: t("notebook.action.remove"),
      onclick: () => { void removeCard(card, removeButton); },
    }, trashIcon(18));
    const lastLine = card.reviews > 0 && finite(card.lastAccuracy)
      ? t("notebook.card.last", { n: numberFormat(card.lastAccuracy, 0) })
      : t("notebook.card.never");
    return h("li", { class: "notebook-item" },
      h("article", { class: `card notebook-card${due ? " is-due" : ""}${card.box >= cleared ? " is-cleared" : ""}`, "aria-labelledby": headId, "data-card": card.id },
        h("div", { class: "notebook-card-board" },
          ui && typeof ui.miniBoard === "function"
            ? ui.miniBoard(card.fen, {
              size: 132,
              orientation: side,
              arrows: arrow ? [{ from: arrow.from, to: arrow.to, color: "best" }] : [],
              label: t("notebook.card.board"),
            })
            : null),
        h("div", { class: "notebook-card-main" },
          h("p", { class: "notebook-card-kicker" },
            h("span", { class: `notebook-origin is-${origin.kind}` }, t(`notebook.origin.${origin.kind}`)),
            h("span", { class: "notebook-side" }, t(`notebook.side.${side}`))),
          h("h3", { class: "notebook-card-title", id: headId }, title),
          origin.detail.length ? h("p", { class: "notebook-card-detail" }, origin.detail.join(" · ")) : null,
          movesBlock(card)),
        card.tags && card.tags.length ? h("div", { class: "notebook-tags" }, card.tags.map(tagChip)) : null,
        h("div", { class: "notebook-card-foot" },
          pips(card, cleared),
          h("p", { class: `notebook-when${due ? " is-due" : ""}` },
            h("span", { class: "notebook-when-label" }, due ? t("notebook.when.due") : t("notebook.when.label")),
            h("span", { class: "notebook-when-text" }, whenText(card.due, state.now)),
            !due || when.kind === "overdue" ? h("span", { class: "notebook-when-date" }, dateText(card.due, { weekday: "short", day: "numeric", month: "short" })) : null),
          h("p", { class: "notebook-last" }, lastLine)),
        h("div", { class: "notebook-actions" }, reviewButton, linesButton, removeButton),
        linesPanel(card, panelId, open)));
  }

  function toggleLines(card, button) {
    const open = !state.expanded.has(card.id);
    if (open) state.expanded.add(card.id);
    else state.expanded.delete(card.id);
    button.setAttribute("aria-expanded", String(open));
    button.classList.toggle("is-open", open);
    const panel = state.container ? state.container.querySelector(`#notebook-panel-${card.id}`) : null;
    setHidden(panel, !open);
  }

  async function removeCard(card, button) {
    const ui = L().ui;
    const Profile = L().Profile;
    if (!Profile || !Profile.notebook || typeof Profile.notebook.remove !== "function") return;
    const confirmed = ui && typeof ui.confirm === "function"
      ? await ui.confirm({
        title: t("notebook.remove.title"),
        body: t("notebook.remove.body"),
        confirmLabel: t("notebook.remove.confirm"),
        cancelLabel: t("ui.cancel"),
        danger: true,
      })
      : true;
    if (!confirmed) {
      focusNode(button);
      return;
    }
    let ok = false;
    try {
      ok = Boolean(Profile.notebook.remove(card.id));
    } catch (error) {
      ok = false;
    }
    if (!ok) {
      toast(t("notebook.remove.failed"), "error");
      return;
    }
    state.expanded.delete(card.id);
    toast(t("notebook.remove.done"), "success");
    // Profile emits notebook:changed, which repaints; the focus goes to the list heading so it is not lost.
    state.pendingFocus = "list";
    scheduleRefresh();
  }

  // ----- summary -----

  function statTile(label, value, hint, tone) {
    return h("li", { class: `notebook-stat${tone ? ` is-${tone}` : ""}` },
      h("span", { class: "notebook-stat-value" }, numberFormat(value)),
      h("span", { class: "notebook-stat-label" }, label),
      hint ? h("span", { class: "notebook-stat-hint" }, hint) : null);
  }

  function boxChart(summary) {
    const { leitner, cleared } = profileConstants();
    const geometry = boxBars(summary.byBox, { width: 320, height: 132 });
    const intervalText = (days) => (days === 0 ? t("notebook.boxes.new") : t("notebook.boxes.day", { n: days }));
    const svgChildren = [];
    geometry.forEach((bar, i) => {
      const isCleared = i >= cleared;
      if (bar.h > 0) {
        svgChildren.push(h("svg:path", { class: `notebook-bar${isCleared ? " is-cleared" : ""}`, d: roundedTopPath(bar.x, bar.y, bar.w, bar.h, 4) }));
      } else {
        svgChildren.push(h("svg:rect", { class: "notebook-bar-stub", x: bar.x, y: bar.baseline - 2, width: bar.w, height: 2, rx: 1 }));
      }
      svgChildren.push(h("svg:text", { class: "notebook-bar-value", x: bar.cx, y: bar.y - 5, "text-anchor": "middle" }, numberFormat(bar.value)));
      svgChildren.push(h("svg:text", { class: "notebook-bar-label", x: bar.cx, y: 126, "text-anchor": "middle" }, intervalText(leitner[i])));
    });
    const svg = h("svg:svg", { class: "notebook-boxes-svg", viewBox: "0 0 320 132", focusable: "false", "aria-hidden": "true" },
      h("svg:line", { class: "notebook-bar-axis", x1: 0, x2: 320, y1: geometry[0] ? geometry[0].baseline : 106, y2: geometry[0] ? geometry[0].baseline : 106 }),
      svgChildren);
    const table = h("div", { class: "sr-only" }, h("table", null,
      h("caption", null, t("notebook.boxes.title")),
      h("thead", null, h("tr", null, h("th", { scope: "col" }, t("notebook.boxes.col.box")), h("th", { scope: "col" }, t("notebook.boxes.col.cards")))),
      h("tbody", null, summary.byBox.map((count, i) => h("tr", null,
        h("th", { scope: "row" }, i === 0 ? t("notebook.boxes.aria.new", { count }) : t("notebook.boxes.aria", { n: i, count, interval: tCount("notebook.boxes.interval", leitner[i]) })),
        h("td", null, String(count)))))));
    return h("figure", { class: "notebook-boxes", "aria-label": t("notebook.boxes.title") },
      h("figcaption", { class: "notebook-boxes-title" }, t("notebook.boxes.title")),
      svg,
      h("p", { class: "notebook-boxes-caption" }, t("notebook.boxes.caption")),
      table);
  }

  function sizePicker() {
    return h("div", { class: "notebook-size", role: "group", "aria-label": t("notebook.review.size") },
      h("span", { class: "notebook-size-label", "aria-hidden": "true" }, t("notebook.review.size")),
      h("div", { class: "segmented notebook-size-seg" }, SESSION_SIZES.map((n) => h("button", {
        type: "button",
        "aria-pressed": String(state.size === n),
        "aria-label": t("notebook.review.size.n", { n }),
        "data-size": String(n),
        onclick: () => {
          state.size = n;
          savePrefs();
          paintSummary();
          const again = state.container && state.container.querySelector(`.notebook-size-seg [data-size="${n}"]`);
          focusNode(again);
        },
      }, String(n)))));
  }

  function summaryNode(summary) {
    const takes = Math.min(summary.due, state.size);
    const nextCount = summary.next ? summary.next.count : 0;
    let left;
    const startButton = summary.due > 0
      ? h("button", {
        type: "button",
        class: "btn btn-primary btn-lg notebook-start",
        id: "notebook-start",
        onclick: () => { void reviewDue(startButton); },
      }, icon("play", { size: 22 }), h("span", { class: "btn-label" }, tCount("notebook.review.start", takes)))
      : h("button", {
        type: "button",
        class: "btn btn-secondary btn-lg notebook-start",
        id: "notebook-start",
        onclick: () => { void practiceAnyway(startButton); },
      }, icon("play", { size: 22 }), h("span", { class: "btn-label" }, t("notebook.practice.start")));
    if (summary.due > 0) {
      left = h("div", { class: "notebook-due" },
        h("p", { class: "notebook-due-figure" },
          h("span", { class: "notebook-due-count" }, numberFormat(summary.due)),
          h("span", { class: "notebook-due-label" }, tCount("notebook.due.label", summary.due))),
        summary.due > takes ? h("p", { class: "notebook-due-note" }, t("notebook.due.session", { n: takes, due: summary.due })) : null,
        // The rest of the notebook is waiting for its day: say which one is the next.
        summary.next
          ? h("p", { class: "notebook-due-note is-after" }, t("notebook.next.after", { when: `${whenText(summary.next.ts, state.now)} · ${dateText(summary.next.ts, { weekday: "long", day: "numeric", month: "long" })}` }),
            nextCount ? ` (${tCount("notebook.next.count", nextCount)})` : "")
          : null,
        h("div", { class: "notebook-cta" }, startButton, sizePicker()),
        h("p", { class: "notebook-hint" }, t("notebook.review.hint")));
    } else {
      left = h("div", { class: "notebook-due is-clear" },
        h("p", { class: "notebook-clear-title" }, icon("check", { size: 26 }), t("notebook.due.clear")),
        summary.next
          ? h("p", { class: "notebook-due-note" }, t("notebook.next", { when: `${whenText(summary.next.ts, state.now)} · ${dateText(summary.next.ts, { weekday: "long", day: "numeric", month: "long" })}` }),
            nextCount ? ` (${tCount("notebook.next.count", nextCount)})` : "")
          : h("p", { class: "notebook-due-note" }, t("notebook.next.none")),
        h("div", { class: "notebook-cta" }, startButton, sizePicker()),
        h("p", { class: "notebook-hint" }, t("notebook.practice.hint")));
    }
    return h("section", { class: "card card-accent notebook-summary", "aria-label": t("notebook.summary") },
      left,
      h("div", { class: "notebook-side-panel" },
        h("ul", { class: "notebook-stats" },
          statTile(t("notebook.stat.total"), summary.total),
          statTile(t("notebook.stat.cleared"), summary.cleared, t("notebook.stat.cleared.hint"), "gold"),
          statTile(t("notebook.stat.new"), summary.fresh, t("notebook.stat.new.hint"))),
        boxChart(summary)));
  }

  function paintSummary() {
    const host = state.refs.summaryHost;
    if (!host) return;
    clear(host);
    host.appendChild(summaryNode(summarize(state.cards, state.now)));
  }

  // ----- weak spots -----

  function weakNode() {
    const rows = weakSpots(state.cards, { limit: WEAK_LIMIT });
    if (!rows.length) return null;
    return h("section", { class: "notebook-weak", "aria-labelledby": "notebook-weak-title" },
      h("header", { class: "notebook-section-head" },
        h("h2", { class: "notebook-h2", id: "notebook-weak-title" }, t("notebook.weak.title")),
        h("p", { class: "notebook-lead" }, t("notebook.weak.lead"))),
      h("ul", { class: "notebook-weak-list", role: "list", "aria-label": t("notebook.weak.list") }, rows.map((row) => {
        const label = tagLabel(row.tag);
        const trainButton = h("button", {
          type: "button",
          class: "btn btn-secondary notebook-weak-train",
          "data-tag": row.tag,
          "aria-label": t("notebook.weak.train.aria", { tag: label }),
          onclick: () => { void trainTag(row.tag, trainButton); },
        }, icon("target", { size: 18 }), h("span", { class: "btn-label" }, t("notebook.weak.train")));
        return h("li", { class: "notebook-weak-item card card-flat" },
          h("div", { class: "notebook-weak-top" },
            h("h3", { class: "notebook-weak-name" }, label),
            conceptsFor(row.tag).length
              ? h("button", {
                type: "button",
                class: "btn btn-ghost btn-icon notebook-weak-info",
                "aria-label": t("notebook.concept.chip", { tag: label }),
                onclick: () => openConcept(row.tag, { train: true }),
              }, icon("lightbulb", { size: 18 }))
              : null),
          h("p", { class: "notebook-weak-count" }, tCount("notebook.weak.cards", row.count, { open: row.open })),
          h("div", { class: "notebook-weak-actions" },
            trainButton,
            h("button", {
              type: "button",
              class: "btn btn-ghost notebook-weak-filter",
              "aria-label": t("notebook.weak.filter", { tag: label }),
              onclick: () => {
                state.filters = Object.assign({}, DEFAULT_FILTERS, { tag: row.tag });
                state.shown = PAGE_SIZE;
                state.moreOpen = true;
                render();
                scrollToNode(state.refs.listTitle);
                focusNode(state.refs.listTitle);
              },
            }, h("span", { class: "btn-label" }, t("notebook.weak.show")), icon("arrow-right", { size: 16 }))));
      })));
  }

  // ----- toolbar and list -----

  function selectField(id, label, options, value, onChange) {
    const select = h("select", { class: "select", id, onchange: () => onChange(select.value) },
      options.map((option) => h("option", { value: option.value, selected: option.value === value }, option.label)));
    select.value = value;
    return h("div", { class: "field notebook-field" }, h("label", { for: id }, label), select);
  }

  function toolbarNode(summary) {
    const options = distinctOptions(state.cards);
    const activeMore = moreFiltersActive(state.filters);
    const searchInput = h("input", {
      type: "search",
      class: "input notebook-search-input",
      id: "notebook-search",
      value: state.filters.query,
      autocomplete: "off",
      spellcheck: "false",
      placeholder: t("notebook.search.placeholder"),
      oninput: () => {
        const value = searchInput.value;
        if (state.searchTimer && typeof root.clearTimeout === "function") root.clearTimeout(state.searchTimer);
        const apply = () => {
          state.searchTimer = null;
          state.filters.query = value;
          state.shown = PAGE_SIZE;
          paintList();
        };
        if (typeof root.setTimeout === "function") state.searchTimer = root.setTimeout(apply, 140);
        else apply();
      },
    });
    const statusCounts = { all: summary.total, due: summary.due, new: summary.fresh, learning: summary.learning, cleared: summary.cleared };
    const statusGroup = h("div", { class: "segmented notebook-status", role: "group", "aria-label": t("notebook.status.group") },
      STATUSES.map((status) => h("button", {
        type: "button",
        "data-status": status,
        "aria-pressed": String(state.filters.status === status),
        onclick: () => {
          state.filters.status = status;
          state.shown = PAGE_SIZE;
          Array.from(statusGroup.querySelectorAll("button")).forEach((button) => button.setAttribute("aria-pressed", String(button.getAttribute("data-status") === status)));
          paintList();
        },
      }, t(`notebook.status.${status}`), h("span", { class: "notebook-status-n" }, numberFormat(statusCounts[status])))));
    const sourceOptions = [{ value: "all", label: t("notebook.filter.all") }].concat(options.sources.map((row) => ({ value: row.value, label: `${t(`notebook.source.${row.value}`)} (${row.count})` })));
    const tagOptions = [{ value: "all", label: t("notebook.filter.allTags") }].concat(options.tags.map((row) => ({ value: row.value, label: `${tagLabel(row.value)} (${row.count})` })));
    if (state.filters.tag !== "all" && !options.tags.some((row) => row.value === state.filters.tag)) state.filters.tag = "all";
    const phaseOptions = [{ value: "all", label: t("notebook.filter.allPhases") }].concat(options.phases.map((row) => ({ value: row.value, label: `${t(`notebook.phase.${row.value}`)} (${row.count})` })));
    const qualityOptions = [{ value: "all", label: t("notebook.filter.all") }].concat(QUALITY_FILTERS.map((value) => ({ value, label: t(`notebook.quality.${value}`) })));
    const change = (key) => (value) => {
      state.filters[key] = value;
      state.shown = PAGE_SIZE;
      paintList();
    };
    const moreSummary = h("summary", { class: "notebook-more-summary" }, icon("chevron-down", { size: 16 }),
      h("span", { class: "notebook-more-text" }, activeMore ? t("notebook.filter.more.n", { n: activeMore }) : t("notebook.filter.more")));
    state.refs.moreSummary = moreSummary;
    const more = h("details", { class: "notebook-more", open: state.moreOpen || activeMore > 0, ontoggle: () => { state.moreOpen = Boolean(more.open); } },
      moreSummary,
      h("div", { class: "notebook-more-grid" },
        selectField("notebook-f-source", t("notebook.filter.source"), sourceOptions, state.filters.source, change("source")),
        selectField("notebook-f-tag", t("notebook.filter.tag"), tagOptions, state.filters.tag, change("tag")),
        selectField("notebook-f-phase", t("notebook.filter.phase"), phaseOptions, state.filters.phase, change("phase")),
        selectField("notebook-f-quality", t("notebook.filter.quality"), qualityOptions, state.filters.quality, change("quality"))));
    const clearButton = h("button", {
      type: "button",
      class: "btn btn-ghost notebook-clear",
      onclick: () => {
        state.filters = Object.assign({}, DEFAULT_FILTERS);
        state.shown = PAGE_SIZE;
        render();
        focusNode(state.refs.listTitle);
      },
    }, icon("x", { size: 16 }), h("span", { class: "btn-label" }, t("notebook.filter.clear")));
    state.refs.clearButton = clearButton;
    setHidden(clearButton, !anyFilterActive(state.filters));
    const sortSelect = selectField("notebook-sort", t("notebook.sort"), SORTS.map((value) => ({ value, label: t(`notebook.sort.${value}`) })), state.sort, (value) => {
      state.sort = SORTS.includes(value) ? value : "due";
      savePrefs();
      paintList();
    });
    return h("div", { class: "notebook-tools" },
      h("div", { class: "notebook-tools-row" },
        h("div", { class: "field notebook-field notebook-search" }, h("label", { for: "notebook-search" }, t("notebook.search")), searchInput),
        sortSelect),
      statusGroup,
      more,
      clearButton);
  }

  function paintMoreSummary() {
    const node = state.refs.moreSummary;
    if (!node) return;
    const n = moreFiltersActive(state.filters);
    const text = node.querySelector(".notebook-more-text");
    if (text) text.textContent = n ? t("notebook.filter.more.n", { n }) : t("notebook.filter.more");
  }

  function syncClearButton() {
    setHidden(state.refs.clearButton, !anyFilterActive(state.filters));
  }

  function paintList() {
    const list = state.refs.list;
    const count = state.refs.count;
    const moreHost = state.refs.moreHost;
    if (!list || !count || !moreHost) return;
    // Whatever changed the filters, the "clear" button and the number of extra filters follow.
    syncClearButton();
    paintMoreSummary();
    const all = visibleCards();
    const shown = all.slice(0, state.shown);
    clear(list);
    clear(moreHost);
    const total = state.cards.length;
    count.textContent = all.length === total ? tCount("notebook.count", all.length) : tCount("notebook.count.of", all.length, { total });
    if (!all.length) {
      const ui = L().ui;
      list.appendChild(h("li", { class: "notebook-list-empty" },
        ui && typeof ui.emptyState === "function"
          ? ui.emptyState({
            icon: "book",
            title: t("notebook.list.empty.title"),
            body: t("notebook.list.empty.body"),
            level: 3,
            action: {
              label: t("notebook.filter.clear"),
              kind: "secondary",
              onClick: () => {
                state.filters = Object.assign({}, DEFAULT_FILTERS);
                state.shown = PAGE_SIZE;
                render();
                focusNode(state.refs.listTitle);
              },
            },
          })
          : h("p", null, t("notebook.list.empty.title"))));
      return;
    }
    shown.forEach((card, index) => list.appendChild(cardNode(card, index)));
    if (all.length > shown.length) {
      moreHost.appendChild(h("button", {
        type: "button",
        class: "btn btn-secondary notebook-more-btn",
        onclick: () => {
          const before = state.shown;
          state.shown += PAGE_SIZE;
          paintList();
          const firstNew = state.refs.list.children[before];
          const target = firstNew && firstNew.querySelector ? firstNew.querySelector(".notebook-card-title") : null;
          focusNode(target);
        },
      }, t("notebook.more.n", { n: all.length - shown.length })));
    }
  }

  function listNode(summary) {
    state.refs.count = h("p", { class: "notebook-count", role: "status", "aria-live": "polite" });
    state.refs.list = h("ul", { class: "notebook-cards", role: "list", "aria-label": t("notebook.list.region") });
    state.refs.moreHost = h("div", { class: "notebook-more-host" });
    state.refs.listTitle = h("h2", { class: "notebook-h2", id: "notebook-list-title", tabindex: "-1" }, t("notebook.list.title"));
    return h("section", { class: "notebook-list", "aria-labelledby": "notebook-list-title" },
      h("header", { class: "notebook-section-head notebook-list-head" }, state.refs.listTitle, state.refs.count),
      toolbarNode(summary),
      state.refs.list,
      state.refs.moreHost);
  }

  // ----- empty state -----

  function emptyNode() {
    const ui = L().ui;
    const router = L().router;
    const game = L().game;
    const go = (id) => () => {
      if (router && typeof router.show === "function") router.show(id);
    };
    const own = () => {
      if (game && typeof game.openOwnGamesSetup === "function") {
        try {
          game.openOwnGamesSetup({ mode: "solo" });
          return;
        } catch (error) {
          logError("[Ludus.notebook] the own games setup could not open", error);
        }
      }
      go("home")();
    };
    const steps = [1, 2, 3].map((n) => h("li", { class: "notebook-step" },
      h("span", { class: "notebook-step-n", "aria-hidden": "true" }, String(n)),
      h("div", { class: "notebook-step-text" },
        h("h3", { class: "notebook-step-title" }, t(`notebook.empty.step${n}.title`)),
        h("p", { class: "notebook-step-body" }, t(`notebook.empty.step${n}.body`)))));
    return h("div", { class: "notebook-empty" },
      ui && typeof ui.emptyState === "function"
        ? ui.emptyState({
          icon: "book",
          title: t("notebook.empty.title"),
          body: t("notebook.empty.body"),
          level: 2,
          action: { label: t("notebook.empty.classics"), kind: "primary", icon: "columns", onClick: go("classics") },
        })
        : h("p", null, t("notebook.empty.title")),
      h("div", { class: "notebook-empty-more" },
        h("button", { type: "button", class: "btn btn-secondary", onclick: own }, icon("download", { size: 18 }), h("span", { class: "btn-label" }, t("notebook.empty.own")))),
      h("section", { class: "notebook-how", "aria-labelledby": "notebook-how-title" },
        h("h2", { class: "notebook-h2", id: "notebook-how-title" }, t("notebook.empty.how")),
        h("ol", { class: "notebook-steps" }, steps)));
  }

  // ---------- The screen ----------

  function headNode() {
    return h("header", { class: "notebook-head" },
      h("p", { class: "t-eyebrow" }, t("notebook.eyebrow")),
      h("h1", { class: "screen-title notebook-title", "data-screen-title": "", tabindex: "-1" }, t("notebook.heading")),
      h("p", { class: "screen-sub notebook-sub" }, t("notebook.sub")));
  }

  function render() {
    if (!state.mounted || !state.container || !getDoc() || !L().util) return;
    if (state.searchTimer && typeof root.clearTimeout === "function") root.clearTimeout(state.searchTimer);
    state.searchTimer = null;
    const container = state.container;
    clear(container);
    state.refs = {};
    const Profile = L().Profile;
    if (!Profile || !Profile.notebook || typeof Profile.notebook.list !== "function") {
      container.appendChild(h("div", { class: "notebook" }, headNode(), h("p", { class: "notebook-unavailable" }, icon("info", { size: 16 }), t("notebook.unavailable"))));
      return;
    }
    if (!state.cards.length) {
      container.appendChild(h("div", { class: "notebook" }, headNode(), emptyNode()));
      return;
    }
    const summary = summarize(state.cards, state.now);
    state.refs.summaryHost = h("div", { class: "notebook-summary-host" });
    const weak = weakNode();
    container.appendChild(h("div", { class: "notebook" }, headNode(), state.refs.summaryHost, weak, listNode(summary)));
    paintSummary();
    paintList();
  }

  // Reads the profile again and repaints. `focus: "list"` puts the focus on the list heading afterwards (used
  // when the card that had it is gone).
  function refresh(options) {
    if (!state.mounted) return;
    load();
    render();
    if (options && options.focus === "list") focusNode(state.refs.listTitle);
  }

  function scheduleRefresh() {
    if (!state.mounted) return;
    if (!state.visible) {
      state.dirty = true;
      return;
    }
    if (state.refreshTimer !== null) return;
    const run = () => {
      state.refreshTimer = null;
      const focus = state.pendingFocus;
      state.pendingFocus = null;
      if (state.visible) refresh({ focus });
    };
    // One round emits profile:changed and notebook:changed in the same tick: one repaint.
    if (typeof root.setTimeout === "function") state.refreshTimer = root.setTimeout(run, 0);
    else run();
  }

  function applyParams(params) {
    const p = params && typeof params === "object" ? params : null;
    if (!p) return false;
    let changed = false;
    const next = Object.assign({}, state.filters);
    if (typeof p.tag === "string" && state.cards.some((card) => (card.tags || []).includes(p.tag))) {
      next.tag = p.tag;
      changed = true;
    }
    if (STATUSES.includes(p.status)) {
      next.status = p.status;
      changed = true;
    }
    if (typeof p.source === "string" && state.cards.some((card) => card.source === p.source)) {
      next.source = p.source;
      changed = true;
    }
    if (PHASES.includes(p.phase)) {
      next.phase = p.phase;
      changed = true;
    }
    if (changed) {
      state.filters = cleanFilters(next);
      state.shown = PAGE_SIZE;
      state.moreOpen = moreFiltersActive(state.filters) > 0;
    }
    return changed;
  }

  function on(evt, fn) {
    const bus = L().bus;
    if (bus && typeof bus.on === "function") state.offs.push(bus.on(evt, fn));
  }

  const screen = {
    // Router title (an i18n key): "Cuaderno - Ludus Scaccorum".
    titleKey: "notebook.title",
    title: "notebook.title",
    mount(container) {
      if (!getDoc() || !container || !L().util) return;
      if (state.mounted && state.container === container) {
        render();
        return;
      }
      state.container = container;
      state.mounted = true;
      loadPrefs();
      // The data is read in show(); until then the screen only has its heading.
      container.appendChild(h("div", { class: "notebook" }, headNode()));
      on("language:changed", () => {
        registerText();
        if (state.visible) render();
        else state.dirty = true;
      });
      on("profile:changed", scheduleRefresh);
      on("notebook:changed", scheduleRefresh);
      on("session:completed", scheduleRefresh);
      const router = L().router;
      if (router && typeof router.current === "function" && router.current() === "notebook") screen.show({});
    },
    show(params) {
      state.visible = true;
      state.dirty = false;
      if (!state.mounted) return;
      load();
      const preset = applyParams(params);
      render();
      if (preset && state.refs.listTitle) {
        scrollToNode(state.refs.listTitle);
      }
    },
    hide() {
      state.visible = false;
      if (state.searchTimer && typeof root.clearTimeout === "function") root.clearTimeout(state.searchTimer);
      state.searchTimer = null;
      if (state.refreshTimer !== null && typeof root.clearTimeout === "function") root.clearTimeout(state.refreshTimer);
      state.refreshTimer = null;
    },
    render() {
      if (!state.mounted) return;
      if (state.visible) load();
      render();
    },
    openConcept,
    destroy() {
      screen.hide();
      state.offs.splice(0).forEach((off) => off());
      state.mounted = false;
    },
    // Pure helpers (also used by scripts/tests/notebook-ui.test.js).
    helpers: {
      SESSION_SIZES,
      STATUSES,
      SORTS,
      QUALITY_FILTERS,
      PAGE_SIZE,
      DEFAULT_FILTERS,
      localDayNumber,
      daysBetween,
      isDue,
      statusOf,
      whenOf,
      summarize,
      cleanSize,
      cleanFilters,
      moreFiltersActive,
      anyFilterActive,
      normalizeText,
      qualityFromAccuracy,
      qualityBucket,
      mistakeEntryOf,
      yourMoveOf,
      filterCards,
      sortCards,
      distinctOptions,
      weakSpots,
      pickReviewCards,
      referenceFromCard,
      positionFromCard,
      originOf,
      boxBars,
      roundedTopPath,
      formatPv,
    },
    TEXT,
    _state: state,
  };

  return screen;
});
