// Screen "progress": the learner's dashboard, built only from what Ludus.Profile has recorded on this device.
//   Level        title, XP bar and the XP left for the next level; the streak (current / best, a warning when today
//                would break it) and the daily challenge streak
//   Numbers      positions played, average accuracy, points per position and time spent
//   Activity     a 12 week calendar heatmap (hand written SVG, a list of days as its text alternative)
//   Accuracy     the trend of the last 20 sessions (focusable points, tooltip, table for screen readers) with the
//                improvement between the first and the last positions when there are enough of them, accuracy by
//                phase and by origin, and the quality of the moves as one stacked bar with its legend
//   Weak themes  the themes with the worst accuracy (only with a sample big enough to mean something), each with
//                its lesson and a link to the notebook filtered by that theme
//   Achievements the whole catalogue: unlocked (with the date) and locked (with the progress towards them)
//   Sessions     the most recent ones: title, date, accuracy, points, duration
//   Profiles     a switcher when the device has several: it changes which profile is being LOOKED AT, not the
//                active profile of the app
// Contract: docs/ARCHITECTURE.md sections 11, 15 and 20; styles in css/progress.css (prefix .progress-).
//
//   Ludus.Screens.progress.mount(el)     el = #screen-progress. Idempotent and cheap (the data loads in show()).
//   Ludus.Screens.progress.show(params)  params.profile = a profile id to look at (default: the active profile).
//   Ludus.Screens.progress.hide()        nothing runs in the background; this only marks the screen as hidden.
//   Ludus.Screens.progress.render()      repaints from the current state (also on language:changed).
//   Ludus.Screens.progress.titleKey      "progress.title", the i18n key of document.title.
//
// Nothing here is invented: a chart without enough data says what is missing and how to get it. Numbers are
// never rounded up, a small sample is labelled as small, and the rarity of an achievement is not shown because
// this device cannot know it. Every chart is SVG drawn here with colour tokens and comes with a text alternative.
// Built with Ludus.util.h only; a missing module (Profile, Scoring, Insights, the kit, the notebook screen)
// removes the part that needs it and never breaks the rest. Pure helpers are exported under `helpers` for
// scripts/tests/progress-ui.test.js.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Screens = root.Ludus.Screens || {};
  root.Ludus.Screens.progress = api;
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

  // "1 session" / "{n} sessions": the singular lives under "<key>.one".
  function tCount(key, n, params) {
    return t(n === 1 ? `${key}.one` : key, Object.assign({ n }, params || {}));
  }

  // ---------- Text ----------

  const TEXT = {
    es: {
      "progress.title": "Progreso",
      "progress.eyebrow": "Tu progreso",
      "progress.heading": "Tu progreso",
      "progress.sub": "Tu nivel, tu constancia y dónde estás mejorando, calculados con las posiciones que jugaste en este dispositivo.",
      "progress.unavailable": "El progreso no está disponible en este momento.",
      "progress.profiles": "Ver el progreso de",

      "progress.level.n": "Nivel {n} de {max}",
      "progress.level.bar": "Progreso hacia el próximo nivel",
      "progress.xp.into": "{a} de {b} XP",
      "progress.xp.next": "Faltan {n} XP para {title}",
      "progress.xp.max": "Llegaste al nivel más alto.",
      "progress.xp.total": "{n} XP en total",
      "progress.xp.rule": "Cada posición suma hasta 100 XP (puntos de experiencia), según su precisión.",

      "progress.streak.title": "Racha",
      "progress.streak.days": "días seguidos",
      "progress.streak.days.one": "día seguido",
      "progress.streak.best": "Mejor racha: {n} días",
      "progress.streak.best.one": "Mejor racha: 1 día",
      "progress.streak.today": "Ya entrenaste hoy.",
      "progress.streak.risk": "Entrená hoy para no perder tu racha de {n} días.",
      "progress.streak.risk.one": "Entrená hoy para no perder tu racha.",
      "progress.streak.none": "Entrená hoy para empezar una racha.",
      "progress.streak.daily": "Desafío diario: {n} días seguidos (mejor: {best})",
      "progress.streak.daily.one": "Desafío diario: 1 día seguido (mejor: {best})",
      "progress.streak.daily.none": "Todavía no completaste el desafío diario.",

      "progress.stat.positions": "Posiciones jugadas",
      "progress.stat.positions.hint": "{n} sesiones",
      "progress.stat.positions.hint.one": "1 sesión",
      "progress.stat.accuracy": "Precisión media",
      "progress.stat.accuracy.hint": "en tus últimas {n} posiciones",
      "progress.stat.accuracy.hint.one": "en tu última posición",
      "progress.stat.points": "Puntos por posición",
      "progress.stat.points.hint": "de un máximo de 10",
      "progress.stat.time": "Tiempo de práctica",
      "progress.stat.time.hint": "unos {s} s por posición",
      "progress.stat.none": "Sin datos",
      "progress.time.hm": "{h} h {m} min",
      "progress.time.m": "{m} min",
      "progress.time.s": "{s} s",

      "progress.activity.title": "Actividad",
      "progress.activity.lead": "Tus últimas 12 semanas: cuanto más dorado, más posiciones jugaste ese día.",
      "progress.activity.aria": "Actividad de las últimas 12 semanas: {days} de {total} días con práctica y {positions} posiciones.",
      "progress.activity.fact.days": "de {total} días con práctica",
      "progress.activity.fact.positions": "posiciones jugadas",
      "progress.activity.fact.positions.one": "posición jugada",
      "progress.activity.fact.best": "posiciones en tu mejor día ({date})",
      "progress.activity.fact.best.one": "posición en tu mejor día ({date})",
      "progress.activity.less": "Menos",
      "progress.activity.more": "Más",
      "progress.activity.legend": "Posiciones por día",
      "progress.activity.list": "Ver los días como lista",
      "progress.activity.item": "{date}: {n} posiciones",
      "progress.activity.item.one": "{date}: 1 posición",
      "progress.activity.cell": "{date}: {n} posiciones",
      "progress.activity.cell.one": "{date}: 1 posición",
      "progress.activity.cell.none": "{date}: sin práctica",
      "progress.activity.empty": "Todavía no hay práctica en estas 12 semanas. Cada posición que juegues pinta un día.",
      "progress.activity.cap": "Solo se guardan tus últimas {n} posiciones, así que los días más antiguos pueden verse más vacíos de lo que fueron.",

      "progress.trend.title": "Precisión por sesión",
      "progress.trend.lead": "La precisión media de tus últimas {n} sesiones, de la más antigua a la más reciente.",
      "progress.trend.lead.one": "La precisión de tu única sesión.",
      "progress.trend.none": "Todavía no completaste ninguna sesión. Cuando termines una, empieza tu curva.",
      "progress.trend.few": "Con una sesión ya hay un punto; con dos empieza a verse la tendencia.",
      "progress.trend.duels": "Los duelos no se incluyen: su precisión mezcla a los dos jugadores.",
      "progress.trend.scale": "Esta precisión es más exigente que la de Lichess o Chess.com: sirve para compararte con tu propio historial, no con esas cifras.",
      "progress.trend.point": "Sesión {n} de {total}: {acc}% de precisión, {date}",
      "progress.trend.axis": "Precisión (%)",
      "progress.trend.table": "Precisión de cada sesión",
      "progress.trend.col.date": "Fecha",
      "progress.trend.col.title": "Sesión",
      "progress.trend.col.acc": "Precisión",
      "progress.trend.col.points": "Puntos",
      "progress.trend.tip.points": "{a} de {b} puntos",
      "progress.trend.tip.positions": "{n} posiciones",
      "progress.trend.tip.positions.one": "1 posición",
      "progress.trend.keys": "Con las flechas te movés entre las sesiones.",
      "progress.improve.title": "Tu mejora",
      "progress.improve.up": "Subiste {n} puntos de precisión",
      "progress.improve.up.one": "Subiste 1 punto de precisión",
      "progress.improve.down": "Bajaste {n} puntos de precisión",
      "progress.improve.down.one": "Bajaste 1 punto de precisión",
      "progress.improve.flat": "Tu precisión se mantiene igual",
      "progress.improve.detail": "De {first}% en tus primeras {window} posiciones a {last}% en las últimas {window}.",
      "progress.improve.missing": "Para medir tu mejora hacen falta {need} posiciones (comparamos las primeras con las últimas). Llevás {have}.",

      "progress.phase.title": "Precisión por fase",
      "progress.phase.opening": "Apertura",
      "progress.phase.middlegame": "Medio juego",
      "progress.phase.endgame": "Final",
      "progress.source.title": "Precisión por origen",
      "progress.source.own": "Tus partidas",
      "progress.source.classic": "Clásicos",
      "progress.source.notebook": "Repaso del cuaderno",
      "progress.source.daily": "Desafío diario",
      "progress.bar.aria": "{label}: {acc}% de precisión en {n} posiciones",
      "progress.bar.aria.one": "{label}: {acc}% de precisión en 1 posición",
      "progress.bar.aria.none": "{label}: sin datos todavía",
      "progress.bar.n": "{n} posiciones",
      "progress.bar.n.one": "1 posición",
      "progress.bar.small": "Pocos datos: {n} posiciones",
      "progress.bar.small.one": "Pocos datos: 1 posición",
      "progress.bar.none": "Sin datos todavía",
      "progress.bar.caption": "La marca indica 70: debajo de eso cuenta como error.",

      "progress.quality.title": "Calidad de tus jugadas",
      "progress.quality.lead": "Cómo se reparten tus últimas {n} posiciones.",
      "progress.quality.lead.one": "Tu última posición.",
      "progress.quality.aria": "Calidad de {n} jugadas: {list}",
      "progress.quality.share": "{n} ({pct}%)",
      "progress.quality.none": "Todavía no hay jugadas para repartir por calidad.",

      "progress.weak.title": "Temas a reforzar",
      "progress.weak.lead": "Los temas donde tenés menos precisión, con al menos {min} posiciones para que el dato valga.",
      "progress.weak.acc": "{n}% de precisión",
      "progress.weak.lesson": "Ver la lección",
      "progress.weak.lesson.aria": "Ver la lección: {tag}",
      "progress.weak.notebook": "Ver en el cuaderno",
      "progress.weak.notebook.aria": "Ver en el cuaderno las tarjetas de {tag}",
      "progress.weak.empty": "Todavía no hay temas con datos suficientes. Hacen falta {min} posiciones sobre el mismo tema.",
      "progress.weak.empty.best": "Hacen falta {min} posiciones sobre el mismo tema; el que más tiene llega a {n}.",
      "progress.weak.list": "Temas con peor precisión",

      "progress.ach.title": "Logros",
      "progress.ach.count": "{n} de {total} desbloqueados",
      "progress.ach.filter": "Mostrar logros",
      "progress.ach.all": "Todos",
      "progress.ach.done": "Logrados",
      "progress.ach.todo": "Pendientes",
      "progress.ach.unlocked": "Desbloqueado el {date}",
      "progress.ach.unlocked.nodate": "Desbloqueado",
      "progress.ach.locked": "Bloqueado",
      "progress.ach.progress": "{cur} de {target}",
      "progress.ach.progress.aria": "{name}: {cur} de {target}",
      "progress.ach.empty": "No hay logros en esta vista.",
      "progress.ach.list": "Logros",

      "progress.sessions.title": "Sesiones recientes",
      "progress.sessions.list": "Sesiones recientes",
      "progress.sessions.empty": "Todavía no hay sesiones completadas.",
      "progress.sessions.acc": "Precisión",
      "progress.sessions.points": "Puntos",
      "progress.sessions.time": "Duración",
      "progress.sessions.positions": "{n} posiciones",
      "progress.sessions.positions.one": "1 posición",
      "progress.sessions.duel": "Duelo: {a} {sa} a {sb} {b}",
      "progress.sessions.kind.own": "Tus partidas",
      "progress.sessions.kind.classic": "Clásicos",
      "progress.sessions.kind.review": "Repaso",
      "progress.sessions.kind.daily": "Diario",
      "progress.sessions.kind.duel": "Duelo",
      "progress.sessions.untitled": "Sesión",

      "progress.empty.title": "Tu progreso empieza con la primera posición",
      "progress.empty.body": "Todavía no jugaste ninguna posición en este perfil. Esto es lo que va a aparecer acá y qué hace falta para verlo.",
      "progress.empty.cta": "Elegir cómo entrenar",
      "progress.gap.first": "Tu nivel, tu racha y tu actividad",
      "progress.gap.first.need": "Jugá tu primera posición.",
      "progress.gap.phase": "Precisión por fase, origen y calidad",
      "progress.gap.phase.need": "Desde la primera posición; con {min} en cada categoría el dato es confiable.",
      "progress.gap.trend": "La curva de precisión por sesión",
      "progress.gap.trend.need": "Completá {need} sesiones (llevás {have}).",
      "progress.gap.improve": "Tu mejora entre las primeras y las últimas posiciones",
      "progress.gap.improve.need": "Jugá {need} posiciones (llevás {have}).",
      "progress.gap.weak": "Los temas a reforzar",
      "progress.gap.weak.need": "Juntá {min} posiciones sobre el mismo tema (el máximo hoy es {have}).",
      "progress.gap.done": "Listo",
    },
    en: {
      "progress.title": "Progress",
      "progress.eyebrow": "Your progress",
      "progress.heading": "Your progress",
      "progress.sub": "Your level, your consistency and where you are improving, worked out from the positions you played on this device.",
      "progress.unavailable": "Progress is not available right now.",
      "progress.profiles": "See the progress of",

      "progress.level.n": "Level {n} of {max}",
      "progress.level.bar": "Progress towards the next level",
      "progress.xp.into": "{a} of {b} XP",
      "progress.xp.next": "{n} XP to {title}",
      "progress.xp.max": "You reached the highest level.",
      "progress.xp.total": "{n} XP in total",
      "progress.xp.rule": "Every position is worth up to 100 XP (experience points), depending on its accuracy.",

      "progress.streak.title": "Streak",
      "progress.streak.days": "days in a row",
      "progress.streak.days.one": "day in a row",
      "progress.streak.best": "Best streak: {n} days",
      "progress.streak.best.one": "Best streak: 1 day",
      "progress.streak.today": "You already trained today.",
      "progress.streak.risk": "Train today to keep your {n} day streak.",
      "progress.streak.risk.one": "Train today to keep your streak.",
      "progress.streak.none": "Train today to start a streak.",
      "progress.streak.daily": "Daily challenge: {n} days in a row (best: {best})",
      "progress.streak.daily.one": "Daily challenge: 1 day in a row (best: {best})",
      "progress.streak.daily.none": "You have not completed the daily challenge yet.",

      "progress.stat.positions": "Positions played",
      "progress.stat.positions.hint": "{n} sessions",
      "progress.stat.positions.hint.one": "1 session",
      "progress.stat.accuracy": "Average accuracy",
      "progress.stat.accuracy.hint": "over your last {n} positions",
      "progress.stat.accuracy.hint.one": "over your last position",
      "progress.stat.points": "Points per position",
      "progress.stat.points.hint": "out of a maximum of 10",
      "progress.stat.time": "Practice time",
      "progress.stat.time.hint": "about {s} s per position",
      "progress.stat.none": "No data",
      "progress.time.hm": "{h} h {m} min",
      "progress.time.m": "{m} min",
      "progress.time.s": "{s} s",

      "progress.activity.title": "Activity",
      "progress.activity.lead": "Your last 12 weeks: the more gold, the more positions you played that day.",
      "progress.activity.aria": "Activity of the last 12 weeks: {days} of {total} days with practice and {positions} positions.",
      "progress.activity.fact.days": "of {total} days with practice",
      "progress.activity.fact.positions": "positions played",
      "progress.activity.fact.positions.one": "position played",
      "progress.activity.fact.best": "positions on your best day ({date})",
      "progress.activity.fact.best.one": "position on your best day ({date})",
      "progress.activity.less": "Less",
      "progress.activity.more": "More",
      "progress.activity.legend": "Positions per day",
      "progress.activity.list": "See the days as a list",
      "progress.activity.item": "{date}: {n} positions",
      "progress.activity.item.one": "{date}: 1 position",
      "progress.activity.cell": "{date}: {n} positions",
      "progress.activity.cell.one": "{date}: 1 position",
      "progress.activity.cell.none": "{date}: no practice",
      "progress.activity.empty": "No practice in these 12 weeks yet. Every position you play colours a day.",
      "progress.activity.cap": "Only your last {n} positions are kept, so the oldest days can look emptier than they were.",

      "progress.trend.title": "Accuracy per session",
      "progress.trend.lead": "The average accuracy of your last {n} sessions, oldest to newest.",
      "progress.trend.lead.one": "The accuracy of your only session.",
      "progress.trend.none": "You have not completed a session yet. When you finish one, your curve starts.",
      "progress.trend.few": "One session gives a point; with two the trend starts to show.",
      "progress.trend.duels": "Duels are left out: their accuracy mixes both players.",
      "progress.trend.scale": "This accuracy is stricter than Lichess or Chess.com accuracy: use it to compare yourself with your own history, not with those numbers.",
      "progress.trend.point": "Session {n} of {total}: {acc}% accuracy, {date}",
      "progress.trend.axis": "Accuracy (%)",
      "progress.trend.table": "Accuracy of each session",
      "progress.trend.col.date": "Date",
      "progress.trend.col.title": "Session",
      "progress.trend.col.acc": "Accuracy",
      "progress.trend.col.points": "Points",
      "progress.trend.tip.points": "{a} of {b} points",
      "progress.trend.tip.positions": "{n} positions",
      "progress.trend.tip.positions.one": "1 position",
      "progress.trend.keys": "Use the arrow keys to move between sessions.",
      "progress.improve.title": "Your improvement",
      "progress.improve.up": "You gained {n} accuracy points",
      "progress.improve.up.one": "You gained 1 accuracy point",
      "progress.improve.down": "You lost {n} accuracy points",
      "progress.improve.down.one": "You lost 1 accuracy point",
      "progress.improve.flat": "Your accuracy is unchanged",
      "progress.improve.detail": "From {first}% over your first {window} positions to {last}% over the last {window}.",
      "progress.improve.missing": "To measure your improvement we need {need} positions (we compare the first ones with the last ones). You have {have}.",

      "progress.phase.title": "Accuracy by phase",
      "progress.phase.opening": "Opening",
      "progress.phase.middlegame": "Middlegame",
      "progress.phase.endgame": "Endgame",
      "progress.source.title": "Accuracy by origin",
      "progress.source.own": "Your games",
      "progress.source.classic": "Classics",
      "progress.source.notebook": "Notebook review",
      "progress.source.daily": "Daily challenge",
      "progress.bar.aria": "{label}: {acc}% accuracy over {n} positions",
      "progress.bar.aria.one": "{label}: {acc}% accuracy over 1 position",
      "progress.bar.aria.none": "{label}: no data yet",
      "progress.bar.n": "{n} positions",
      "progress.bar.n.one": "1 position",
      "progress.bar.small": "Little data: {n} positions",
      "progress.bar.small.one": "Little data: 1 position",
      "progress.bar.none": "No data yet",
      "progress.bar.caption": "The mark shows 70: below it counts as a mistake.",

      "progress.quality.title": "Quality of your moves",
      "progress.quality.lead": "How your last {n} positions split.",
      "progress.quality.lead.one": "Your last position.",
      "progress.quality.aria": "Quality of {n} moves: {list}",
      "progress.quality.share": "{n} ({pct}%)",
      "progress.quality.none": "There are no moves to split by quality yet.",

      "progress.weak.title": "Themes to work on",
      "progress.weak.lead": "The themes where your accuracy is lowest, with at least {min} positions so the figure means something.",
      "progress.weak.acc": "{n}% accuracy",
      "progress.weak.lesson": "Open the lesson",
      "progress.weak.lesson.aria": "Open the lesson: {tag}",
      "progress.weak.notebook": "See in the notebook",
      "progress.weak.notebook.aria": "See the notebook cards about {tag}",
      "progress.weak.empty": "No theme has enough data yet. We need {min} positions about the same theme.",
      "progress.weak.empty.best": "We need {min} positions about the same theme; the one with the most has {n}.",
      "progress.weak.list": "Themes with the lowest accuracy",

      "progress.ach.title": "Achievements",
      "progress.ach.count": "{n} of {total} unlocked",
      "progress.ach.filter": "Show achievements",
      "progress.ach.all": "All",
      "progress.ach.done": "Unlocked",
      "progress.ach.todo": "Pending",
      "progress.ach.unlocked": "Unlocked on {date}",
      "progress.ach.unlocked.nodate": "Unlocked",
      "progress.ach.locked": "Locked",
      "progress.ach.progress": "{cur} of {target}",
      "progress.ach.progress.aria": "{name}: {cur} of {target}",
      "progress.ach.empty": "There are no achievements in this view.",
      "progress.ach.list": "Achievements",

      "progress.sessions.title": "Recent sessions",
      "progress.sessions.list": "Recent sessions",
      "progress.sessions.empty": "No completed sessions yet.",
      "progress.sessions.acc": "Accuracy",
      "progress.sessions.points": "Points",
      "progress.sessions.time": "Duration",
      "progress.sessions.positions": "{n} positions",
      "progress.sessions.positions.one": "1 position",
      "progress.sessions.duel": "Duel: {a} {sa} to {sb} {b}",
      "progress.sessions.kind.own": "Your games",
      "progress.sessions.kind.classic": "Classics",
      "progress.sessions.kind.review": "Review",
      "progress.sessions.kind.daily": "Daily",
      "progress.sessions.kind.duel": "Duel",
      "progress.sessions.untitled": "Session",

      "progress.empty.title": "Your progress starts with the first position",
      "progress.empty.body": "You have not played any position on this profile yet. Here is what will show up on this screen and what it takes to see it.",
      "progress.empty.cta": "Choose how to train",
      "progress.gap.first": "Your level, your streak and your activity",
      "progress.gap.first.need": "Play your first position.",
      "progress.gap.phase": "Accuracy by phase, origin and quality",
      "progress.gap.phase.need": "From the first position; with {min} in each category the figure is reliable.",
      "progress.gap.trend": "The accuracy curve per session",
      "progress.gap.trend.need": "Complete {need} sessions (you have {have}).",
      "progress.gap.improve": "Your improvement between the first and the last positions",
      "progress.gap.improve.need": "Play {need} positions (you have {have}).",
      "progress.gap.weak": "The themes to work on",
      "progress.gap.weak.need": "Gather {min} positions about the same theme (the most today is {have}).",
      "progress.gap.done": "Done",
    },
  };

  function registerText() {
    const i18n = L().i18n;
    if (i18n && typeof i18n.register === "function") i18n.register(TEXT);
  }
  registerText();

  // ---------- Constants and pure helpers ----------

  const HEAT_WEEKS = 12;
  const HEAT_THRESHOLDS = [1, 3, 6, 10];
  const TREND_LIMIT = 20;
  const RECENT_LIMIT = 8;
  const IMPROVE_MIN_ROUNDS = 20; // Profile compares windows of at least 10: 2 x 10
  const FALLBACK_MIN_SAMPLE = 5;
  const FALLBACK_PASS = 70;
  const ROUND_CAP = 600;
  const QUALITY_ORDER = ["brilliant", "great", "perfect", "very_good", "good", "interesting", "dubious", "bad", "blunder", "no_move"];
  const PHASES = ["opening", "middlegame", "endgame"];
  const SOURCES = ["own", "classic", "notebook", "daily"];
  const ACH_FILTERS = ["all", "done", "todo"];
  const RANK_PIECE = { pawn: "P", knight: "N", bishop: "B", rook: "R", queen: "Q", king: "K", grandmaster: "K" };

  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const round1 = (value) => Math.round(value * 10) / 10;
  const round2 = (value) => Math.round(value * 100) / 100;
  const pad2 = (n) => String(n).padStart(2, "0");

  function profileConstants() {
    const Profile = L().Profile;
    const c = Profile && Profile.constants ? Profile.constants : {};
    return {
      minSample: Number.isInteger(c.MIN_TAG_SAMPLE) ? c.MIN_TAG_SAMPLE : FALLBACK_MIN_SAMPLE,
      pass: finite(c.PASS_ACCURACY) ? c.PASS_ACCURACY : FALLBACK_PASS,
      roundCap: c.CAPS && Number.isInteger(c.CAPS.rounds) ? c.CAPS.rounds : ROUND_CAP,
    };
  }

  // "2026-09-30" from a timestamp, in the LOCAL time zone (the same key Ludus.Profile uses for its days).
  function dateKeyOf(ts) {
    const d = new Date(ts);
    return `${String(d.getFullYear()).padStart(4, "0")}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  // ----- numbers and time -----

  function formatNumber(value, digits, language) {
    if (value === null || value === undefined || value === "") return "";
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    const d = Number.isInteger(digits) ? digits : 0;
    try {
      return new Intl.NumberFormat(language === "en" ? "en-US" : "es-AR", { minimumFractionDigits: 0, maximumFractionDigits: d }).format(n);
    } catch (error) {
      return String(round1(n));
    }
  }

  // Practice time as data: { kind: "hm" | "m" | "s", h, m, s }. Rounds to the minute from one minute up.
  function splitDuration(ms) {
    const total = finite(ms) ? Math.max(0, Math.round(ms / 1000)) : 0;
    if (total < 60) return { kind: "s", h: 0, m: 0, s: total };
    const minutes = Math.round(total / 60);
    if (minutes < 60) return { kind: "m", h: 0, m: minutes, s: 0 };
    return { kind: "hm", h: Math.floor(minutes / 60), m: minutes % 60, s: 0 };
  }

  // ----- level and streak -----

  // What the XP bar shows for a Ludus.Profile.levelFor() result.
  function xpInfo(level) {
    const info = level && typeof level === "object" ? level : {};
    // Without a level there is nothing to fill (and nothing that says "highest level").
    if (!finite(info.floorXp)) return { into: 0, span: 0, toNext: 0, ratio: 0, max: false };
    const floor = info.floorXp;
    const next = finite(info.nextXp) ? info.nextXp : null;
    const into = finite(info.xpInLevel) ? info.xpInLevel : Math.max(0, (finite(info.xp) ? info.xp : 0) - floor);
    const span = next === null ? 0 : Math.max(1, next - floor);
    return {
      into,
      span,
      toNext: next === null ? 0 : Math.max(0, next - (finite(info.xp) ? info.xp : floor + into)),
      ratio: next === null ? 1 : clamp(into / span, 0, 1),
      max: next === null,
    };
  }

  // The streak block as data: state is "today" (trained today), "risk" (trained yesterday, not today),
  // "none" (no streak alive).
  function streakInfo(stats) {
    const streak = stats && stats.streak ? stats.streak : {};
    const current = finite(streak.current) ? streak.current : 0;
    let state = "none";
    if (current > 0) state = streak.activeToday ? "today" : streak.atRisk ? "risk" : "none";
    return { current, best: finite(streak.best) ? streak.best : 0, state };
  }

  // ----- the activity heatmap -----

  function heatLevel(count) {
    const n = Number(count) || 0;
    let level = 0;
    HEAT_THRESHOLDS.forEach((limit, index) => {
      if (n >= limit) level = index + 1;
    });
    return level;
  }

  // { "2026-09-30": 5 }: how many positions were played on each local day.
  function activityCounts(rounds) {
    const counts = {};
    (Array.isArray(rounds) ? rounds : []).forEach((round) => {
      if (!round || !finite(round.ts)) return;
      const key = dateKeyOf(round.ts);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }

  // The grid of the calendar: `weeks` columns of 7 days, the last column holding today. Days are found by
  // calendar arithmetic on the local Y-M-D (new Date(y, m, d + n)), never by adding 24 hours, so a 23 or 25 hour
  // day of a DST change and the turn of the year cannot shift or repeat a cell. `weekStart` 1 = Monday, 0 = Sunday.
  // -> { columns: [[{ key, ts, row, count, level, future, today }]], months: [{ column, month }], days, activeDays,
  //      positions, best: { key, ts, count } | null, startKey, endKey }
  function heatmapGrid(options) {
    const o = options || {};
    const now = finite(o.now) ? o.now : Date.now();
    const weeks = Number.isInteger(o.weeks) ? clamp(o.weeks, 1, 53) : HEAT_WEEKS;
    const weekStart = o.weekStart === 0 ? 0 : 1;
    const counts = o.counts && typeof o.counts === "object" ? o.counts : {};
    const today = new Date(now);
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    const todayStart = new Date(y, m, d).getTime();
    const sinceWeekStart = (today.getDay() - weekStart + 7) % 7;
    const first = d - sinceWeekStart - 7 * (weeks - 1);
    const columns = [];
    const months = [];
    const out = { days: 0, activeDays: 0, positions: 0, best: null };
    for (let w = 0; w < weeks; w += 1) {
      const column = [];
      for (let r = 0; r < 7; r += 1) {
        const date = new Date(y, m, first + w * 7 + r);
        const ts = date.getTime();
        const key = `${String(date.getFullYear()).padStart(4, "0")}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
        const future = ts > todayStart;
        const count = future ? 0 : Math.max(0, Number(counts[key]) || 0);
        column.push({ key, ts, row: r, count, level: heatLevel(count), future, today: ts === todayStart, month: date.getMonth(), day: date.getDate() });
        if (!future) {
          out.days += 1;
          out.positions += count;
          if (count > 0) out.activeDays += 1;
          if (count > 0 && (!out.best || count > out.best.count)) out.best = { key, ts, count };
        }
      }
      columns.push(column);
      // A month is named above the column that holds its 1st; the first column names its own month.
      const firstOfMonth = column.find((cell) => cell.day === 1 && !cell.future);
      if (firstOfMonth) months.push({ column: w, month: firstOfMonth.month });
      else if (w === 0) months.push({ column: 0, month: column[0].month });
    }
    return Object.assign(out, {
      columns,
      months,
      weekStart,
      startKey: columns[0][0].key,
      endKey: dateKeyOf(now),
    });
  }

  // Which weekday (0 = Sunday) each row of the grid is.
  function weekdayOrder(weekStart) {
    const start = weekStart === 0 ? 0 : 1;
    return [0, 1, 2, 3, 4, 5, 6].map((row) => (start + row) % 7);
  }

  // ----- chart maths -----

  // A y axis for percentages: whole steps of 10 (20 when the range is wide), inside 0..100, at least two steps tall.
  function niceDomain(values) {
    const list = (Array.isArray(values) ? values : []).filter(finite);
    if (!list.length) return { min: 0, max: 100, step: 20, ticks: [0, 20, 40, 60, 80, 100] };
    const rawLo = Math.min(...list) - 4;
    const rawHi = Math.max(...list) + 4;
    const step = rawHi - rawLo <= 50 ? 10 : 20;
    let min = Math.max(0, Math.floor(rawLo / step) * step);
    let max = Math.min(100, Math.ceil(rawHi / step) * step);
    if (max - min < 2 * step) {
      max = Math.min(100, min + 2 * step);
      min = Math.max(0, max - 2 * step);
    }
    const ticks = [];
    for (let v = min; v <= max; v += step) ticks.push(v);
    return { min, max, step, ticks };
  }

  function scaleLinear(d0, d1, r0, r1) {
    const span = d1 - d0;
    return (value) => (span === 0 ? (r0 + r1) / 2 : r0 + ((value - d0) / span) * (r1 - r0));
  }

  // The drawing of the accuracy trend as numbers: the plot box, the ticks, one point per session (evenly spaced:
  // the sessions are the x axis, not the calendar), the line and the area under it.
  function trendGeometry(values, options) {
    const o = options || {};
    const width = finite(o.width) ? o.width : 640;
    const height = finite(o.height) ? o.height : 230;
    const left = finite(o.left) ? o.left : 40;
    const right = finite(o.right) ? o.right : 18;
    const top = finite(o.top) ? o.top : 16;
    const bottom = finite(o.bottom) ? o.bottom : 32;
    const list = (Array.isArray(values) ? values : []).filter(finite);
    const domain = niceDomain(list);
    const plot = { x0: left, x1: width - right, y0: top, y1: height - bottom };
    const y = scaleLinear(domain.min, domain.max, plot.y1, plot.y0);
    const x = (index) => (list.length <= 1 ? (plot.x0 + plot.x1) / 2 : plot.x0 + ((plot.x1 - plot.x0) * index) / (list.length - 1));
    const points = list.map((value, index) => ({ index, value, x: round2(x(index)), y: round2(y(clamp(value, domain.min, domain.max))) }));
    const linePath = points.length > 1 ? `M${points.map((p) => `${p.x} ${p.y}`).join("L")}` : "";
    const areaPath = points.length > 1
      ? `M${points[0].x} ${plot.y1}L${points.map((p) => `${p.x} ${p.y}`).join("L")}L${points[points.length - 1].x} ${plot.y1}Z`
      : "";
    return {
      width,
      height,
      plot,
      domain,
      ticks: domain.ticks.map((value) => ({ value, y: round2(y(value)) })),
      points,
      linePath,
      areaPath,
    };
  }

  // The last `limit` sessions that are not duels (a duel's accuracy mixes two players), oldest first.
  // `sessions` come newest first, as Ludus.Profile.sessions() returns them.
  function trendSessions(sessions, limit) {
    const cap = Number.isInteger(limit) ? limit : TREND_LIMIT;
    const list = (Array.isArray(sessions) ? sessions : []).filter((session) => session && session.mode !== "duel" && finite(session.avgAccuracy));
    return list.slice(0, cap).reverse();
  }

  // The stacked bar of the quality of the moves: segments in quality order, a fixed gap between them, and a
  // minimum width so a rare quality is still visible; the widths always add up to `width`.
  function stackSegments(counts, width, options) {
    const o = options || {};
    const order = Array.isArray(o.order) ? o.order : QUALITY_ORDER;
    const gap = finite(o.gap) ? o.gap : 2;
    const minWidth = finite(o.minWidth) ? o.minWidth : 4;
    const source = counts && typeof counts === "object" ? counts : {};
    const rows = order.map((code) => ({ code, count: Math.max(0, Number(source[code]) || 0) })).filter((row) => row.count > 0);
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    if (!total) return { total: 0, segments: [] };
    const usable = Math.max(1, width - gap * (rows.length - 1));
    let widths = rows.map((row) => Math.max(minWidth, (usable * row.count) / total));
    const sum = widths.reduce((a, b) => a + b, 0);
    if (sum > usable) {
      const shrinkable = widths.map((w) => Math.max(0, w - minWidth));
      const shrinkTotal = shrinkable.reduce((a, b) => a + b, 0);
      const extra = sum - usable;
      widths = widths.map((w, i) => (shrinkTotal > 0 ? w - (extra * shrinkable[i]) / shrinkTotal : w));
    }
    let x = 0;
    const segments = rows.map((row, i) => {
      const segment = { code: row.code, count: row.count, pct: round1((row.count / total) * 100), x: round2(x), w: round2(widths[i]) };
      x += widths[i] + gap;
      return segment;
    });
    return { total, segments };
  }

  // ----- rows of the breakdowns -----

  // One row of "accuracy by ...": count, accuracy (0..100 or null), and whether the sample is too small to trust.
  function barRow(key, bucket, minSample) {
    const count = bucket && finite(bucket.count) ? bucket.count : 0;
    const accuracy = bucket && finite(bucket.accuracy) ? bucket.accuracy : null;
    return { key, count, accuracy, empty: count === 0 || accuracy === null, small: count > 0 && count < minSample };
  }

  function phaseRows(stats, minSample) {
    const min = Number.isInteger(minSample) ? minSample : profileConstants().minSample;
    const by = stats && stats.byPhase ? stats.byPhase : {};
    return PHASES.map((phase) => barRow(phase, by[phase], min));
  }

  function sourceRows(stats, minSample) {
    const min = Number.isInteger(minSample) ? minSample : profileConstants().minSample;
    const by = stats && stats.bySource ? stats.bySource : {};
    return SOURCES.map((source) => barRow(source, by[source], min));
  }

  // The most positions any theme has: for saying how close the weak themes are to having enough data.
  function bestTagSample(stats) {
    const rows = stats && Array.isArray(stats.byTag) ? stats.byTag : [];
    return rows.reduce((best, row) => Math.max(best, finite(row.count) ? row.count : 0), 0);
  }

  // What the dashboard still lacks, for the empty state: { id, have, need, done }.
  function dataGaps(stats, sessionCount) {
    const minSample = profileConstants().minSample;
    const total = stats && finite(stats.totalPositions) ? stats.totalPositions : 0;
    const windowPositions = stats && finite(stats.windowPositions) ? stats.windowPositions : 0;
    const sessions = Number(sessionCount) || 0;
    const tagBest = bestTagSample(stats);
    return [
      { id: "first", have: total, need: 1, done: total >= 1 },
      { id: "phase", have: total, need: 1, done: total >= 1 },
      { id: "trend", have: sessions, need: 2, done: sessions >= 2 },
      { id: "improve", have: windowPositions, need: IMPROVE_MIN_ROUNDS, done: windowPositions >= IMPROVE_MIN_ROUNDS },
      { id: "weak", have: tagBest, need: minSample, done: tagBest >= minSample },
    ];
  }

  // ----- achievements -----

  // Unlocked ones first (newest first), then the ones closest to unlocking, then catalogue order.
  // `unlocked` is Profile.achievements.unlocked() (with ts), `progress` Profile.achievements.progress().
  function achievementRows(catalog, unlocked, progress, filter) {
    const stamp = new Map();
    (Array.isArray(unlocked) ? unlocked : []).forEach((entry) => {
      if (entry && entry.id) stamp.set(entry.id, entry.ts);
    });
    const info = progress && typeof progress === "object" ? progress : {};
    const rows = (Array.isArray(catalog) ? catalog : []).map((entry, index) => {
      const p = info[entry.id] || {};
      const isUnlocked = stamp.has(entry.id) || p.unlocked === true;
      const target = finite(p.target) ? p.target : entry.target;
      const current = isUnlocked ? target : finite(p.current) ? p.current : 0;
      return {
        id: entry.id,
        name: entry.name,
        description: entry.description,
        category: entry.category,
        glyph: entry.glyph,
        index,
        unlocked: isUnlocked,
        ts: stamp.has(entry.id) ? stamp.get(entry.id) : null,
        current,
        target,
        ratio: target > 0 ? clamp(current / target, 0, 1) : 0,
      };
    });
    const wanted = ACH_FILTERS.includes(filter) ? filter : "all";
    return rows
      .filter((row) => wanted === "all" || (wanted === "done" ? row.unlocked : !row.unlocked))
      .sort((a, b) => {
        if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
        if (a.unlocked) return ((b.ts || 0) - (a.ts || 0)) || (a.index - b.index);
        return (b.ratio - a.ratio) || (a.index - b.index);
      });
  }

  function achievementCounts(rows) {
    const list = Array.isArray(rows) ? rows : [];
    return { unlocked: list.filter((row) => row.unlocked).length, total: list.length };
  }

  // ---------- Small DOM helpers ----------

  const state = {
    mounted: false,
    container: null,
    visible: false,
    dirty: false,
    data: null,
    viewId: null,
    activeId: null,
    achFilter: "all",
    trendActive: null,
    trendWidth: 640,
    refs: {},
    offs: [],
    domOffs: [],
    refreshTimer: null,
    resizeTimer: null,
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

  function focusNode(el) {
    if (!el || typeof el.focus !== "function") return;
    if (typeof el.setAttribute === "function" && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    try {
      el.focus({ preventScroll: true });
    } catch (error) {
      // focus is best effort
    }
  }

  const num = (value, digits) => formatNumber(value, digits, lang());

  function dateText(ts, options) {
    const util = L().util;
    if (!util || typeof util.formatDate !== "function") return "";
    // formatDate always adds year / month / day; naming only some of them needs the others switched off.
    const wanted = options ? Object.assign({ year: undefined, month: undefined, day: undefined }, options) : undefined;
    return util.formatDate(ts, lang(), wanted);
  }

  function durationText(ms) {
    const d = splitDuration(ms);
    if (d.kind === "hm") return t("progress.time.hm", { h: d.h, m: d.m });
    if (d.kind === "m") return t("progress.time.m", { m: d.m });
    return t("progress.time.s", { s: d.s });
  }

  function clockText(ms) {
    const util = L().util;
    return util && typeof util.formatDuration === "function" ? util.formatDuration(ms) : "";
  }

  function tagLabel(tag) {
    const Insights = L().Insights;
    const key = Insights && typeof Insights.tagLabelKey === "function" ? Insights.tagLabelKey(tag) : "";
    const text = key ? t(key) : "";
    if (text && text !== key) return text;
    return String(tag).replace(/_/g, " ");
  }

  function qualityLabel(code) {
    const text = t(`quality.${code}`);
    return text === `quality.${code}` ? code.replace(/_/g, " ") : text;
  }

  function qualityGlyph(code) {
    const Scoring = L().Scoring;
    try {
      if (Scoring && typeof Scoring.qualityMeta === "function") {
        const meta = Scoring.qualityMeta(code);
        if (meta && meta.glyph) return meta.glyph;
      }
    } catch (error) {
      // fall through
    }
    return { brilliant: "!!", great: "!", perfect: "★", very_good: "✓", good: "○", interesting: "!?", dubious: "?!", bad: "?", blunder: "??", no_move: "—" }[code] || "";
  }

  // A visually hidden table with the numbers of a chart, for screen readers. The hiding is done by a wrapper:
  // "overflow: hidden" does not clip an element that is itself display: table, so a wide table would stretch the page.
  function srTable(caption, headers, rows) {
    return h("div", { class: "sr-only" }, h("table", null,
      h("caption", null, caption),
      h("thead", null, h("tr", null, headers.map((text) => h("th", { scope: "col" }, text)))),
      h("tbody", null, rows.map((row) => h("tr", null, row.map((cell, index) => (index === 0 ? h("th", { scope: "row" }, cell) : h("td", null, cell))))))));
  }

  // ---------- Data ----------

  function load() {
    const Profile = L().Profile;
    state.now = nowMs();
    const data = { profiles: [], stats: null, sessions: [], rounds: [], catalog: [], unlocked: [], progress: {}, active: null };
    if (!Profile || typeof Profile.stats !== "function") {
      state.data = null;
      return;
    }
    try {
      data.profiles = typeof Profile.list === "function" ? Profile.list() : [];
      data.active = typeof Profile.active === "function" ? Profile.active() : null;
      state.activeId = data.active ? data.active.id : null;
      if (!state.viewId || !data.profiles.some((profile) => profile.id === state.viewId)) state.viewId = state.activeId;
      const id = state.viewId || undefined;
      data.stats = Profile.stats(id);
      data.sessions = typeof Profile.sessions === "function" ? Profile.sessions(id, { limit: 60 }) : [];
      data.rounds = typeof Profile.rounds === "function" ? Profile.rounds(id) : [];
      if (Profile.achievements) {
        data.catalog = typeof Profile.achievements.catalog === "function" ? Profile.achievements.catalog(lang()) : [];
        data.unlocked = typeof Profile.achievements.unlocked === "function" ? Profile.achievements.unlocked(id, lang()) : [];
        data.progress = typeof Profile.achievements.progress === "function" ? Profile.achievements.progress(id) : {};
      }
    } catch (error) {
      logError("[Ludus.progress] the profile could not be read", error);
      state.data = null;
      return;
    }
    state.data = data;
  }

  // ---------- Pieces of the screen ----------

  function headNode() {
    return h("header", { class: "progress-head" },
      h("div", { class: "progress-head-text" },
        h("p", { class: "t-eyebrow" }, t("progress.eyebrow")),
        h("h1", { class: "screen-title progress-title", "data-screen-title": "", tabindex: "-1" }, t("progress.heading")),
        h("p", { class: "screen-sub progress-sub" }, t("progress.sub"))),
      switcherNode());
  }

  function switcherNode() {
    const data = state.data;
    const ui = L().ui;
    if (!data || data.profiles.length < 2) return null;
    return h("div", { class: "progress-switcher", role: "group", "aria-label": t("progress.profiles") },
      data.profiles.map((profile) => h("button", {
        type: "button",
        class: "progress-switch",
        "data-profile": profile.id,
        "aria-pressed": String(profile.id === state.viewId),
        onclick: () => {
          if (profile.id === state.viewId) return;
          state.viewId = profile.id;
          state.trendActive = null;
          state.pendingFocus = `[data-profile="${profile.id}"]`;
          load();
          render();
        },
      }, ui && typeof ui.avatar === "function" ? ui.avatar(profile, { size: 28 }) : null, h("span", { class: "progress-switch-name" }, profile.name))));
  }

  // ----- level and streak -----

  function levelNode(stats) {
    const Profile = L().Profile;
    const ui = L().ui;
    const level = stats.level || {};
    const info = xpInfo(level);
    const piece = RANK_PIECE[level.rank] || "P";
    let nextTitle = "";
    try {
      if (!info.max && Profile && typeof Profile.levelFor === "function") nextTitle = Profile.levelFor(level.nextXp).title;
    } catch (error) {
      nextTitle = "";
    }
    const levels = Profile && Profile.constants && Profile.constants.LEVEL_THRESHOLDS ? Profile.constants.LEVEL_THRESHOLDS.length : 21;
    return h("div", { class: "progress-level" },
      h("div", { class: "progress-level-head" },
        h("span", { class: `progress-medal${level.rank === "grandmaster" ? " is-gm" : ""}`, "aria-hidden": "true" },
          h("img", { class: "progress-medal-piece", src: `assets/pieces/cburnett/w${piece}.svg`, alt: "", width: 40, height: 40 })),
        h("div", { class: "progress-level-text" },
          h("p", { class: "t-eyebrow" }, t("progress.level.n", { n: level.level || 1, max: levels })),
          h("h2", { class: "progress-level-title" }, level.title || ""))),
      ui && typeof ui.progress === "function" ? ui.progress(info.ratio, { label: t("progress.level.bar"), size: "lg" }) : null,
      h("p", { class: "progress-xp" },
        info.max
          ? h("span", { class: "progress-xp-main" }, t("progress.xp.max"))
          : h("span", { class: "progress-xp-main" }, t("progress.xp.into", { a: num(info.into), b: num(info.span) }), " · ", t("progress.xp.next", { n: num(info.toNext), title: nextTitle })),
        h("span", { class: "progress-xp-total" }, t("progress.xp.total", { n: num(stats.xp) }))),
      h("p", { class: "progress-note" }, t("progress.xp.rule")));
  }

  function streakNode(stats) {
    const info = streakInfo(stats);
    const daily = stats.dailyStreak || {};
    let message;
    if (info.state === "today") message = h("p", { class: "progress-streak-msg is-ok" }, icon("check", { size: 16 }), t("progress.streak.today"));
    else if (info.state === "risk") message = h("p", { class: "progress-streak-msg is-risk", role: "status" }, icon("alert", { size: 16 }), tCount("progress.streak.risk", info.current));
    else message = h("p", { class: "progress-streak-msg" }, icon("flame", { size: 16 }), t("progress.streak.none"));
    return h("div", { class: "progress-streak" },
      h("p", { class: "progress-streak-label" }, icon("flame", { size: 18 }), t("progress.streak.title")),
      h("p", { class: "progress-streak-figure" },
        h("span", { class: "progress-streak-count" }, num(info.current)),
        h("span", { class: "progress-streak-unit" }, tCount("progress.streak.days", info.current, {}))),
      h("p", { class: "progress-streak-best" }, tCount("progress.streak.best", info.best)),
      message,
      daily.best > 0
        ? h("p", { class: "progress-streak-daily" }, tCount("progress.streak.daily", daily.current || 0, { best: daily.best || 0 }))
        : h("p", { class: "progress-streak-daily" }, t("progress.streak.daily.none")));
  }

  function heroNode(stats) {
    return h("section", { class: "card card-accent progress-hero", "aria-label": t("progress.level.bar") }, levelNode(stats), streakNode(stats));
  }

  function statsRow(stats) {
    const noData = t("progress.stat.none");
    const windowN = stats.windowPositions || 0;
    const avgSeconds = windowN ? Math.round((stats.timeSpentMs || 0) / windowN / 1000) : 0;
    const tile = (label, value, hint) => h("li", { class: "progress-stat" },
      h("span", { class: "progress-stat-label" }, label),
      h("span", { class: "progress-stat-value" }, value),
      hint ? h("span", { class: "progress-stat-hint" }, hint) : null);
    return h("ul", { class: "progress-stats" },
      tile(t("progress.stat.positions"), num(stats.totalPositions), stats.sessions ? tCount("progress.stat.positions.hint", stats.sessions) : null),
      tile(t("progress.stat.accuracy"), stats.overallAccuracy === null || stats.overallAccuracy === undefined ? noData : `${num(stats.overallAccuracy, 1)}%`,
        windowN ? tCount("progress.stat.accuracy.hint", windowN) : null),
      tile(t("progress.stat.points"), stats.avgPoints === null || stats.avgPoints === undefined ? noData : num(stats.avgPoints, 1), windowN ? t("progress.stat.points.hint") : null),
      tile(t("progress.stat.time"), windowN ? durationText(stats.timeSpentMs) : noData, windowN ? t("progress.stat.time.hint", { s: avgSeconds }) : null));
  }

  // ----- the calendar heatmap -----

  const HEAT_CELL = 16;
  const HEAT_GAP = 4;
  const HEAT_LEFT = 26;
  const HEAT_TOP = 18;

  function heatmapNode(grid) {
    const dayNames = weekdayOrder(grid.weekStart);
    const weekdayLabel = (dow) => {
      // 2024-01-07 was a Sunday: a fixed reference week gives the short weekday names of the language.
      const ts = new Date(2024, 0, 7 + dow).getTime();
      return dateText(ts, { weekday: "short" }).replace(/\.$/, "");
    };
    const width = HEAT_LEFT + grid.columns.length * (HEAT_CELL + HEAT_GAP) - HEAT_GAP;
    const height = HEAT_TOP + 7 * (HEAT_CELL + HEAT_GAP) - HEAT_GAP;
    const children = [];
    grid.months.forEach((entry, i) => {
      // A month label needs room: skip one that would touch the next.
      const next = grid.months[i + 1];
      if (next && next.column - entry.column < 2) return;
      const ts = new Date(2024, entry.month, 1).getTime();
      children.push(h("svg:text", { class: "progress-heat-label", x: HEAT_LEFT + entry.column * (HEAT_CELL + HEAT_GAP), y: 11 }, dateText(ts, { month: "short" }).replace(/\.$/, "")));
    });
    [0, 2, 4].forEach((row) => {
      children.push(h("svg:text", { class: "progress-heat-label", x: 0, y: HEAT_TOP + row * (HEAT_CELL + HEAT_GAP) + 12 }, weekdayLabel(dayNames[row])));
    });
    grid.columns.forEach((column, c) => {
      column.forEach((cell) => {
        if (cell.future) return;
        const label = cell.count > 0
          ? tCount("progress.activity.cell", cell.count, { date: dateText(cell.ts, { weekday: "long", day: "numeric", month: "long" }) })
          : t("progress.activity.cell.none", { date: dateText(cell.ts, { weekday: "long", day: "numeric", month: "long" }) });
        children.push(h("svg:rect", {
          class: `progress-heat-cell is-l${cell.level}${cell.today ? " is-today" : ""}`,
          x: HEAT_LEFT + c * (HEAT_CELL + HEAT_GAP),
          y: HEAT_TOP + cell.row * (HEAT_CELL + HEAT_GAP),
          width: HEAT_CELL,
          height: HEAT_CELL,
          rx: 3,
          "data-date": cell.key,
          "data-count": String(cell.count),
        }, h("svg:title", null, label)));
      });
    });
    return h("svg:svg", {
      class: "progress-heat-svg",
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: "img",
      focusable: "false",
      "aria-label": t("progress.activity.aria", { days: grid.activeDays, total: grid.days, positions: grid.positions }),
    }, children);
  }

  function factNode(value, label) {
    return h("li", { class: "progress-fact" }, h("span", { class: "progress-fact-value" }, value), h("span", { class: "progress-fact-label" }, label));
  }

  function activityNode(data) {
    const grid = heatmapGrid({ now: state.now, weeks: HEAT_WEEKS, counts: activityCounts(data.rounds), weekStart: lang() === "en" ? 0 : 1 });
    const { roundCap } = profileConstants();
    const truncated = data.rounds.length >= roundCap && data.rounds.length > 0 && data.rounds[data.rounds.length - 1].ts > grid.columns[0][0].ts;
    const activeDays = grid.columns.reduce((all, column) => all.concat(column.filter((cell) => !cell.future && cell.count > 0)), []).sort((a, b) => b.ts - a.ts);
    const legend = h("div", { class: "progress-heat-legend", role: "img", "aria-label": t("progress.activity.legend") },
      h("span", { class: "progress-heat-legend-text", "aria-hidden": "true" }, t("progress.activity.less")),
      [0, 1, 2, 3, 4].map((level) => h("span", { class: `progress-heat-swatch is-l${level}`, "aria-hidden": "true" })),
      h("span", { class: "progress-heat-legend-text", "aria-hidden": "true" }, t("progress.activity.more")));
    return h("section", { class: "card progress-card progress-activity", "aria-labelledby": "progress-activity-title" },
      h("header", { class: "progress-card-head" },
        h("h2", { class: "progress-h2", id: "progress-activity-title" }, t("progress.activity.title")),
        h("p", { class: "progress-lead" }, t("progress.activity.lead"))),
      grid.positions === 0
        ? h("p", { class: "progress-empty-note" }, icon("info", { size: 16 }), t("progress.activity.empty"))
        : h("div", { class: "progress-activity-body" },
          h("div", { class: "progress-heat" }, heatmapNode(grid), legend),
          h("ul", { class: "progress-activity-facts" },
            factNode(num(grid.activeDays), t("progress.activity.fact.days", { total: grid.days })),
            factNode(num(grid.positions), tCount("progress.activity.fact.positions", grid.positions)),
            grid.best ? factNode(num(grid.best.count), tCount("progress.activity.fact.best", grid.best.count, { date: dateText(grid.best.ts, { day: "numeric", month: "short" }) })) : null)),
      grid.positions === 0 ? null : h("details", { class: "progress-list-details" },
        h("summary", { class: "progress-list-summary" }, icon("chevron-down", { size: 16 }), t("progress.activity.list")),
        h("ul", { class: "progress-day-list" }, activeDays.map((cell) => h("li", null,
          tCount("progress.activity.item", cell.count, { date: dateText(cell.ts, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) }))))),
      truncated ? h("p", { class: "progress-note" }, t("progress.activity.cap", { n: roundCap })) : null);
  }

  // ----- accuracy trend -----

  function improvementNode(stats) {
    const improvement = stats.improvement;
    if (!improvement) {
      return h("div", { class: "progress-improve is-missing" },
        h("p", { class: "progress-improve-title" }, icon("info", { size: 16 }), t("progress.improve.title")),
        h("p", { class: "progress-improve-detail" }, t("progress.improve.missing", { need: IMPROVE_MIN_ROUNDS, have: stats.windowPositions || 0 })));
    }
    const delta = improvement.delta;
    const abs = Math.abs(delta);
    let headline;
    let tone = "flat";
    if (abs < 0.05) headline = t("progress.improve.flat");
    else if (delta > 0) {
      headline = tCount("progress.improve.up", abs === 1 ? 1 : 2, { n: num(abs, 1) });
      tone = "up";
    } else {
      headline = tCount("progress.improve.down", abs === 1 ? 1 : 2, { n: num(abs, 1) });
      tone = "down";
    }
    return h("div", { class: `progress-improve is-${tone}` },
      h("p", { class: "progress-improve-title" }, icon(tone === "down" ? "alert" : tone === "up" ? "arrow-right" : "info", { size: 16, className: tone === "up" ? "is-up" : "" }), t("progress.improve.title")),
      h("p", { class: "progress-improve-headline" }, headline),
      h("p", { class: "progress-improve-detail" }, t("progress.improve.detail", { first: num(improvement.first, 1), last: num(improvement.last, 1), window: improvement.window })));
  }

  // The drawing is made at the size it is shown at (see fitTrend), so its text stays 11px whatever the screen.
  function trendChart(sessions) {
    const values = sessions.map((session) => session.avgAccuracy);
    const width = state.trendWidth;
    const height = Math.round(clamp(width * (width < 480 ? 0.66 : 0.4), 190, 270));
    const geo = trendGeometry(values, { width, height, left: width < 480 ? 32 : 40 });
    const total = sessions.length;
    const active = state.trendActive !== null && state.trendActive < total ? state.trendActive : total - 1;
    const gridLines = geo.ticks.map((tick) => [
      h("svg:line", { class: "progress-grid", x1: geo.plot.x0, x2: geo.plot.x1, y1: tick.y, y2: tick.y }),
      h("svg:text", { class: "progress-axis-label", x: geo.plot.x0 - 8, y: tick.y + 4, "text-anchor": "end" }, String(tick.value)),
    ]);
    const labelIndexes = Array.from(new Set([0, Math.floor((total - 1) / 2), total - 1])).filter((i) => i >= 0);
    const xLabels = total > 1 ? labelIndexes.map((i) => h("svg:text", {
      class: "progress-axis-label",
      x: geo.points[i].x,
      y: geo.plot.y1 + 20,
      "text-anchor": i === 0 ? "start" : i === total - 1 ? "end" : "middle",
    }, dateText(sessions[i].ts, { day: "numeric", month: "short" }))) : [
      h("svg:text", { class: "progress-axis-label", x: geo.points[0].x, y: geo.plot.y1 + 20, "text-anchor": "middle" }, dateText(sessions[0].ts, { day: "numeric", month: "short" })),
    ];
    const cross = h("svg:line", { class: "progress-cross", x1: geo.points[active].x, x2: geo.points[active].x, y1: geo.plot.y0, y2: geo.plot.y1, hidden: true });
    const tip = h("div", { class: "progress-tip", "aria-hidden": "true", hidden: true });
    const dots = geo.points.map((point, index) => {
      const session = sessions[index];
      const label = t("progress.trend.point", { n: index + 1, total, acc: num(session.avgAccuracy, 1), date: dateText(session.ts, { day: "numeric", month: "long", year: "numeric" }) });
      return h("svg:g", {
        class: "progress-pt",
        tabindex: index === active ? "0" : "-1",
        role: "img",
        "aria-label": `${label}${session.title ? `. ${session.title}` : ""}`,
        "data-index": String(index),
        onfocus: () => showTip(index, geo, sessions, cross, tip),
        onblur: () => hideTip(cross, tip),
      },
      h("svg:circle", { class: "progress-pt-hit", cx: point.x, cy: point.y, r: 22 }),
      h("svg:circle", { class: "progress-pt-focus", cx: point.x, cy: point.y, r: 9 }),
      h("svg:circle", { class: `progress-pt-dot${index === total - 1 ? " is-last" : ""}`, cx: point.x, cy: point.y, r: 4.5 }));
    });
    const svg = h("svg:svg", {
      class: "progress-trend-svg",
      viewBox: `0 0 ${geo.width} ${geo.height}`,
      role: "group",
      "aria-label": t("progress.trend.title"),
      onkeydown: (event) => onTrendKey(event, total, cross, tip),
    },
    gridLines,
    geo.areaPath ? h("svg:path", { class: "progress-area", d: geo.areaPath }) : null,
    geo.linePath ? h("svg:path", { class: "progress-line", d: geo.linePath }) : null,
    cross,
    xLabels,
    dots);
    state.refs.trendSvg = svg;
    // The crosshair finds the session nearest to the pointer, so a finger does not have to hit a 9px dot.
    const nearest = (event) => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return -1;
      const x = ((event.clientX - rect.left) / rect.width) * geo.width;
      let best = 0;
      let distance = Infinity;
      geo.points.forEach((point, i) => {
        const d = Math.abs(point.x - x);
        if (d < distance) {
          distance = d;
          best = i;
        }
      });
      return best;
    };
    svg.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      const i = nearest(event);
      if (i >= 0) showTip(i, geo, sessions, cross, tip);
    });
    svg.addEventListener("pointerdown", (event) => {
      const i = nearest(event);
      if (i >= 0) showTip(i, geo, sessions, cross, tip);
    });
    svg.addEventListener("pointerleave", (event) => {
      // A finger lifts before it can read: on touch the readout stays until the next tap or Escape.
      if (event.pointerType !== "touch") hideTip(cross, tip);
    });
    const table = srTable(t("progress.trend.table"), [t("progress.trend.col.date"), t("progress.trend.col.title"), t("progress.trend.col.acc"), t("progress.trend.col.points")],
      sessions.map((session) => [dateText(session.ts), session.title || t("progress.sessions.untitled"), `${num(session.avgAccuracy, 1)}%`, `${num(session.points, 1)} / ${num(session.maxPoints, 1)}`]));
    const figure = h("figure", { class: "progress-trend", role: "group", "aria-label": t("progress.trend.table") },
      h("p", { class: "progress-axis-title", "aria-hidden": "true" }, t("progress.trend.axis")),
      h("div", { class: "progress-trend-plot" }, svg, tip),
      h("p", { class: "progress-note progress-trend-keys" }, t("progress.trend.keys")),
      table);
    return figure;
  }

  function showTip(index, geo, sessions, cross, tip) {
    const point = geo.points[index];
    const session = sessions[index];
    if (!point || !session) return;
    state.trendActive = index;
    cross.removeAttribute("hidden");
    cross.setAttribute("x1", String(point.x));
    cross.setAttribute("x2", String(point.x));
    clear(tip);
    tip.appendChild(h("p", { class: "progress-tip-value" }, `${num(session.avgAccuracy, 1)}%`));
    tip.appendChild(h("p", { class: "progress-tip-title" }, session.title || t("progress.sessions.untitled")));
    tip.appendChild(h("p", { class: "progress-tip-meta" }, dateText(session.ts, { day: "numeric", month: "short", year: "numeric" })));
    tip.appendChild(h("p", { class: "progress-tip-meta" },
      t("progress.trend.tip.points", { a: num(session.points, 1), b: num(session.maxPoints, 1) }), " · ", tCount("progress.trend.tip.positions", session.positions || 0)));
    const above = point.y / geo.height > 0.42;
    tip.classList.toggle("is-below", !above);
    // Placed in pixels once it is shown (so its own width is known) and kept inside the plot: the readout of the
    // last session must not hang out of the card on a phone.
    tip.style.left = `${clamp((point.x / geo.width) * 100, 10, 90)}%`;
    tip.style.top = `${(point.y / geo.height) * 100}%`;
    setHidden(tip, false);
    const plot = tip.parentNode;
    const plotWidth = plot && plot.clientWidth ? plot.clientWidth : 0;
    const tipWidth = tip.offsetWidth || 0;
    if (plotWidth && tipWidth) tip.style.left = `${clamp((point.x / geo.width) * plotWidth, tipWidth / 2, Math.max(tipWidth / 2, plotWidth - tipWidth / 2))}px`;
  }

  function hideTip(cross, tip) {
    setHidden(cross, true);
    setHidden(tip, true);
  }

  function onTrendKey(event, total, cross, tip) {
    if (event.key === "Escape") {
      hideTip(cross, tip);
      return;
    }
    const keys = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: 1, ArrowDown: -1 };
    const at = state.trendActive !== null ? state.trendActive : total - 1;
    let next = null;
    if (event.key in keys) next = clamp(at + keys[event.key], 0, total - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = total - 1;
    if (next === null) return;
    if (typeof event.preventDefault === "function") event.preventDefault();
    state.trendActive = next;
    const svg = state.refs.trendSvg;
    const dots = svg ? Array.from(svg.querySelectorAll(".progress-pt")) : [];
    dots.forEach((dot, i) => dot.setAttribute("tabindex", i === next ? "0" : "-1"));
    if (dots[next] && typeof dots[next].focus === "function") dots[next].focus();
  }

  function paintTrend() {
    const host = state.refs.trendMain;
    const data = state.data;
    if (!host || !data) return;
    clear(host);
    const sessions = trendSessions(data.sessions, TREND_LIMIT);
    const hasDuels = data.sessions.some((session) => session.mode === "duel");
    if (!sessions.length) host.appendChild(h("p", { class: "progress-empty-note" }, icon("info", { size: 16 }), t("progress.trend.none")));
    else {
      host.appendChild(trendChart(sessions));
      if (sessions.length < 2) host.appendChild(h("p", { class: "progress-note" }, t("progress.trend.few")));
    }
    if (hasDuels) host.appendChild(h("p", { class: "progress-note" }, t("progress.trend.duels")));
    // The number is not Lichess's accuracy (same curve, decaying 1.8 times faster: docs/SCORING.md section 4): say it where it is drawn (QA CNT-029).
    if (sessions.length) host.appendChild(h("p", { class: "progress-note progress-trend-scale" }, t("progress.trend.scale")));
  }

  // Draws the chart again at the width its box really has (a viewBox scaled down to a phone would shrink the text).
  function fitTrend() {
    const plot = state.container && typeof state.container.querySelector === "function" ? state.container.querySelector(".progress-trend-plot") : null;
    if (!plot) return;
    const width = Math.round(plot.clientWidth || 0);
    if (!width || Math.abs(width - state.trendWidth) < 8) return;
    state.trendWidth = clamp(width, 240, 900);
    paintTrend();
  }

  function trendNode(data) {
    const sessions = trendSessions(data.sessions, TREND_LIMIT);
    state.refs.trendMain = h("div", { class: "progress-trend-main" });
    const node = h("section", { class: "card progress-card progress-trend-card", "aria-labelledby": "progress-trend-title" },
      h("header", { class: "progress-card-head" },
        h("h2", { class: "progress-h2", id: "progress-trend-title" }, t("progress.trend.title")),
        sessions.length ? h("p", { class: "progress-lead" }, tCount("progress.trend.lead", sessions.length)) : null),
      h("div", { class: "progress-trend-layout" }, state.refs.trendMain, improvementNode(data.stats)));
    paintTrend();
    return node;
  }

  // ----- breakdown bars -----

  // A bar from 0 to 100 drawn as SVG: a track, the value and a mark on the pass line.
  function barSvg(row, pass) {
    const width = 300;
    const fill = row.empty ? 0 : clamp(row.accuracy, 0, 100) * (width / 100);
    return h("svg:svg", { class: `progress-bar-svg${row.small ? " is-small" : ""}`, viewBox: `0 0 ${width} 10`, preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" },
      h("svg:rect", { class: "progress-bar-track", x: 0, y: 0, width, height: 10, rx: 4 }),
      fill > 0 ? h("svg:rect", { class: "progress-bar-fill", x: 0, y: 0, width: round2(Math.max(fill, 3)), height: 10, rx: 4 }) : null,
      h("svg:rect", { class: "progress-bar-mark", x: round2(pass * (width / 100) - 1), y: -1, width: 2, height: 12 }));
  }

  function barRowNode(row, label, pass) {
    let aria;
    if (row.empty) aria = t("progress.bar.aria.none", { label });
    else aria = tCount("progress.bar.aria", row.count, { label, acc: num(row.accuracy, 1) });
    let detail;
    if (row.empty) detail = t("progress.bar.none");
    else if (row.small) detail = tCount("progress.bar.small", row.count);
    else detail = tCount("progress.bar.n", row.count);
    // The row stays a list item; the picture with its text alternative is what is inside it.
    return h("li", { class: `progress-bar-row${row.empty ? " is-empty" : ""}` },
      h("div", { class: "progress-bar-body", role: "img", "aria-label": aria },
        h("div", { class: "progress-bar-head", "aria-hidden": "true" },
          h("span", { class: "progress-bar-label" }, label),
          h("span", { class: "progress-bar-value" }, row.empty ? "—" : `${num(row.accuracy, 1)}%`)),
        barSvg(row, pass),
        h("span", { class: `progress-bar-n${row.small ? " is-small" : ""}`, "aria-hidden": "true" }, detail)));
  }

  function breakdownCard(id, titleKey, rows, labelOf) {
    const { pass } = profileConstants();
    return h("section", { class: "card progress-card progress-breakdown", "aria-labelledby": `progress-${id}-title` },
      h("header", { class: "progress-card-head" }, h("h2", { class: "progress-h2", id: `progress-${id}-title` }, t(titleKey))),
      h("ul", { class: "progress-bars", role: "list" }, rows.map((row) => barRowNode(row, labelOf(row.key), pass))),
      h("p", { class: "progress-note" }, t("progress.bar.caption")));
  }

  // ----- quality of the moves -----

  const QUALITY_W = 320;

  function qualityNode(stats) {
    const result = stackSegments(stats.byQuality, QUALITY_W, { gap: 2, minWidth: 4 });
    const head = h("header", { class: "progress-card-head" },
      h("h2", { class: "progress-h2", id: "progress-quality-title" }, t("progress.quality.title")),
      result.total ? h("p", { class: "progress-lead" }, tCount("progress.quality.lead", result.total)) : null);
    if (!result.total) {
      return h("section", { class: "card progress-card progress-quality", "aria-labelledby": "progress-quality-title" }, head,
        h("p", { class: "progress-empty-note" }, icon("info", { size: 16 }), t("progress.quality.none")));
    }
    const legendText = result.segments.map((segment) => `${qualityLabel(segment.code)} ${segment.count}`).join(", ");
    const svg = h("svg:svg", {
      class: "progress-stack-svg",
      viewBox: `0 0 ${QUALITY_W} 18`,
      preserveAspectRatio: "none",
      role: "img",
      focusable: "false",
      "aria-label": t("progress.quality.aria", { n: result.total, list: legendText }),
    }, result.segments.map((segment) => h("svg:rect", { class: `progress-seg q-${segment.code}`, x: segment.x, y: 0, width: segment.w, height: 18, rx: 3 })));
    const legend = h("ul", { class: "progress-legend", role: "list" }, result.segments.map((segment) => h("li", { class: "progress-legend-item" },
      h("span", { class: `progress-swatch q-${segment.code}`, "aria-hidden": "true" }),
      h("span", { class: "progress-legend-glyph", "aria-hidden": "true" }, qualityGlyph(segment.code)),
      h("span", { class: "progress-legend-label" }, qualityLabel(segment.code)),
      h("span", { class: "progress-legend-count" }, t("progress.quality.share", { n: num(segment.count), pct: num(segment.pct, segment.pct < 10 && segment.pct % 1 ? 1 : 0) })))));
    return h("section", { class: "card progress-card progress-quality", "aria-labelledby": "progress-quality-title" }, head, svg, legend);
  }

  // ----- weak themes -----

  function weakNode(stats) {
    const { minSample } = profileConstants();
    const rows = Array.isArray(stats.weakestTags) ? stats.weakestTags : [];
    const notebook = L().Screens && L().Screens.notebook;
    const conceptFor = (tag) => {
      const Concepts = L().Concepts;
      try {
        return Concepts && typeof Concepts.byTag === "function" && Concepts.byTag(tag).length > 0;
      } catch (error) {
        return false;
      }
    };
    let body;
    if (!rows.length) {
      const best = bestTagSample(stats);
      body = h("p", { class: "progress-empty-note" }, icon("info", { size: 16 }),
        best > 0 ? t("progress.weak.empty.best", { min: minSample, n: best }) : t("progress.weak.empty", { min: minSample }));
    } else {
      const { pass } = profileConstants();
      body = h("ul", { class: "progress-weak-list", role: "list", "aria-label": t("progress.weak.list") }, rows.map((row) => {
        const label = tagLabel(row.tag);
        const barRowData = barRow(row.tag, { count: row.count, accuracy: row.accuracy }, minSample);
        return h("li", { class: "progress-weak-item" },
          h("div", { class: "progress-weak-main" },
            h("h3", { class: "progress-weak-name" }, label),
            h("p", { class: "progress-weak-meta" }, t("progress.weak.acc", { n: num(row.accuracy, 1) }), " · ", tCount("progress.bar.n", row.count)),
            h("div", { class: "progress-weak-bar", role: "img", "aria-label": tCount("progress.bar.aria", row.count, { label, acc: num(row.accuracy, 1) }) }, barSvg(barRowData, pass))),
          h("div", { class: "progress-weak-actions" },
            conceptFor(row.tag) && notebook && typeof notebook.openConcept === "function"
              ? h("button", {
                type: "button",
                class: "btn btn-secondary progress-weak-lesson",
                "aria-label": t("progress.weak.lesson.aria", { tag: label }),
                onclick: () => notebook.openConcept(row.tag, { train: false }),
              }, icon("lightbulb", { size: 18 }), h("span", { class: "btn-label" }, t("progress.weak.lesson")))
              : null,
            h("button", {
              type: "button",
              class: "btn btn-ghost progress-weak-notebook",
              "aria-label": t("progress.weak.notebook.aria", { tag: label }),
              onclick: () => {
                const router = L().router;
                if (router && typeof router.show === "function") router.show("notebook", { tag: row.tag });
              },
            }, h("span", { class: "btn-label" }, t("progress.weak.notebook")), icon("arrow-right", { size: 16 }))));
      }));
    }
    return h("section", { class: "card progress-card progress-weak", "aria-labelledby": "progress-weak-title" },
      h("header", { class: "progress-card-head" },
        h("h2", { class: "progress-h2", id: "progress-weak-title" }, t("progress.weak.title")),
        h("p", { class: "progress-lead" }, t("progress.weak.lead", { min: minSample }))),
      body);
  }

  // ----- achievements -----

  function achievementCard(row) {
    const ui = L().ui;
    const category = t(`achievement.category.${row.category}`);
    return h("li", { class: `progress-ach${row.unlocked ? " is-unlocked" : " is-locked"}` },
      h("span", { class: "progress-ach-glyph", "aria-hidden": "true" }, row.glyph || "★"),
      h("div", { class: "progress-ach-body" },
        h("p", { class: "progress-ach-cat" }, category === `achievement.category.${row.category}` ? "" : category),
        h("h3", { class: "progress-ach-name" }, row.name),
        h("p", { class: "progress-ach-desc" }, row.description),
        row.unlocked
          ? h("p", { class: "progress-ach-state is-done" }, icon("check", { size: 16 }), row.ts ? t("progress.ach.unlocked", { date: dateText(row.ts) }) : t("progress.ach.unlocked.nodate"))
          : h("div", { class: "progress-ach-progress" },
            h("p", { class: "progress-ach-state" }, icon("lock", { size: 14 }), h("span", { class: "sr-only" }, `${t("progress.ach.locked")}. `),
              t("progress.ach.progress", { cur: num(row.current, 1), target: num(row.target) })),
            ui && typeof ui.progress === "function" ? ui.progress(row.ratio, { label: t("progress.ach.progress.aria", { name: row.name, cur: num(row.current, 1), target: num(row.target) }), size: "sm" }) : null)));
  }

  function achievementsNode(data) {
    const rowsAll = achievementRows(data.catalog, data.unlocked, data.progress, "all");
    if (!rowsAll.length) return null;
    const counts = achievementCounts(rowsAll);
    const list = h("ul", { class: "progress-ach-grid", role: "list", "aria-label": t("progress.ach.list") });
    state.refs.achList = list;
    const filterGroup = h("div", { class: "segmented progress-ach-filter", role: "group", "aria-label": t("progress.ach.filter") },
      ACH_FILTERS.map((filter) => h("button", {
        type: "button",
        "data-filter": filter,
        "aria-pressed": String(state.achFilter === filter),
        onclick: () => {
          state.achFilter = filter;
          Array.from(filterGroup.querySelectorAll("button")).forEach((button) => button.setAttribute("aria-pressed", String(button.getAttribute("data-filter") === filter)));
          paintAchievements();
        },
      }, t(`progress.ach.${filter}`))));
    const node = h("section", { class: "card progress-card progress-ach-card", "aria-labelledby": "progress-ach-title" },
      h("header", { class: "progress-card-head progress-ach-head" },
        h("div", null,
          h("h2", { class: "progress-h2", id: "progress-ach-title" }, t("progress.ach.title")),
          h("p", { class: "progress-lead" }, t("progress.ach.count", { n: counts.unlocked, total: counts.total }))),
        filterGroup),
      list);
    paintAchievements();
    return node;
  }

  function paintAchievements() {
    const list = state.refs.achList;
    const data = state.data;
    if (!list || !data) return;
    clear(list);
    const rows = achievementRows(data.catalog, data.unlocked, data.progress, state.achFilter);
    if (!rows.length) {
      list.appendChild(h("li", { class: "progress-empty-note" }, icon("info", { size: 16 }), t("progress.ach.empty")));
      return;
    }
    rows.forEach((row) => list.appendChild(achievementCard(row)));
  }

  // ----- recent sessions -----

  function sessionsNode(data) {
    const sessions = data.sessions.slice(0, RECENT_LIMIT);
    let body;
    if (!sessions.length) {
      body = h("p", { class: "progress-empty-note" }, icon("info", { size: 16 }), t("progress.sessions.empty"));
    } else {
      body = h("ul", { class: "progress-sessions", role: "list", "aria-label": t("progress.sessions.list") }, sessions.map((session) => {
        const duel = session.mode === "duel" && session.duel;
        const kindLabel = duel ? t("progress.sessions.kind.duel") : t(`progress.sessions.kind.${session.kind}`);
        const duelLine = duel
          ? t("progress.sessions.duel", { a: duel.names[0] || "", sa: num(duel.scores[0], 1), sb: num(duel.scores[1], 1), b: duel.names[1] || "" })
          : "";
        return h("li", { class: "progress-session" },
          h("div", { class: "progress-session-main" },
            h("h3", { class: "progress-session-title" }, session.title || t("progress.sessions.untitled")),
            h("p", { class: "progress-session-meta" },
              h("span", { class: `progress-kind is-${duel ? "duel" : session.kind}` }, kindLabel),
              h("span", null, dateText(session.ts, { day: "numeric", month: "short", year: "numeric" })),
              h("span", null, tCount("progress.sessions.positions", session.positions || 0)),
              duelLine ? h("span", null, duelLine) : null)),
          h("dl", { class: "progress-session-nums" },
            h("div", { class: "progress-session-num" },
              h("dt", null, t("progress.sessions.acc")),
              h("dd", null, duel ? "—" : `${num(session.avgAccuracy, 1)}%`)),
            h("div", { class: "progress-session-num" },
              h("dt", null, t("progress.sessions.points")),
              h("dd", null, `${num(session.points, 1)} / ${num(session.maxPoints, 0)}`)),
            h("div", { class: "progress-session-num" },
              h("dt", null, t("progress.sessions.time")),
              h("dd", null, clockText(session.durationMs)))));
      }));
    }
    return h("section", { class: "card progress-card progress-sessions-card", "aria-labelledby": "progress-sessions-title" },
      h("header", { class: "progress-card-head" }, h("h2", { class: "progress-h2", id: "progress-sessions-title" }, t("progress.sessions.title"))),
      body);
  }

  // ----- empty state -----

  function emptyNode(data) {
    const ui = L().ui;
    const router = L().router;
    const stats = data.stats;
    const { minSample } = profileConstants();
    const gaps = dataGaps(stats, trendSessions(data.sessions, 1000).length);
    const rows = gaps.map((gap) => {
      const params = { need: gap.need, have: gap.have, min: minSample };
      return h("li", { class: `progress-gap${gap.done ? " is-done" : ""}` },
        h("span", { class: "progress-gap-mark", "aria-hidden": "true" }, gap.done ? icon("check", { size: 16 }) : icon("clock", { size: 16 })),
        h("div", { class: "progress-gap-text" },
          h("h3", { class: "progress-gap-title" }, t(`progress.gap.${gap.id}`)),
          h("p", { class: "progress-gap-need" }, gap.done ? t("progress.gap.done") : t(`progress.gap.${gap.id}.need`, params))));
    });
    return h("section", { class: "card progress-card progress-empty", "aria-labelledby": "progress-empty-title" },
      h("header", { class: "progress-card-head" },
        h("h2", { class: "progress-h2", id: "progress-empty-title" }, t("progress.empty.title")),
        h("p", { class: "progress-lead" }, t("progress.empty.body"))),
      h("ul", { class: "progress-gaps", role: "list" }, rows),
      ui && typeof ui.button === "function"
        ? h("div", { class: "progress-empty-actions" }, ui.button(t("progress.empty.cta"), { kind: "primary", icon: "play", onClick: () => { if (router && typeof router.show === "function") router.show("home"); } }))
        : null);
  }

  // ---------- The screen ----------

  function render() {
    if (!state.mounted || !state.container || !getDoc() || !L().util) return;
    const container = state.container;
    clear(container);
    state.refs = {};
    if (!state.data) {
      container.appendChild(h("div", { class: "progress-root" }, headNode(), h("p", { class: "progress-unavailable" }, icon("info", { size: 16 }), t("progress.unavailable"))));
      return;
    }
    const data = state.data;
    const stats = data.stats;
    const nodes = [headNode(), heroNode(stats)];
    if (!stats.totalPositions && !data.sessions.length) {
      nodes.push(emptyNode(data));
    } else {
      nodes.push(statsRow(stats), activityNode(data), trendNode(data),
        h("div", { class: "progress-breakdowns" },
          breakdownCard("phase", "progress.phase.title", phaseRows(stats), (key) => t(`progress.phase.${key}`)),
          breakdownCard("source", "progress.source.title", sourceRows(stats), (key) => t(`progress.source.${key}`)),
          qualityNode(stats)),
        weakNode(stats));
    }
    nodes.push(achievementsNode(data));
    if (data.sessions.length) nodes.push(sessionsNode(data));
    container.appendChild(h("div", { class: "progress-root" }, nodes));
    fitTrend();
    if (state.pendingFocus) {
      const target = container.querySelector(state.pendingFocus);
      state.pendingFocus = null;
      focusNode(target);
    }
  }

  function refresh() {
    if (!state.mounted) return;
    load();
    render();
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
      if (state.visible) refresh();
    };
    if (typeof root.setTimeout === "function") state.refreshTimer = root.setTimeout(run, 0);
    else run();
  }

  function on(evt, fn) {
    const bus = L().bus;
    if (bus && typeof bus.on === "function") state.offs.push(bus.on(evt, fn));
  }

  const screen = {
    // Router title (an i18n key): "Progreso - Ludus Scaccorum".
    titleKey: "progress.title",
    title: "progress.title",
    mount(container) {
      if (!getDoc() || !container || !L().util) return;
      if (state.mounted && state.container === container) {
        render();
        return;
      }
      state.container = container;
      state.mounted = true;
      // The data is read in show(); until then the screen only has its heading.
      container.appendChild(h("div", { class: "progress-root" }, h("header", { class: "progress-head" },
        h("div", { class: "progress-head-text" },
          h("p", { class: "t-eyebrow" }, t("progress.eyebrow")),
          h("h1", { class: "screen-title progress-title", "data-screen-title": "", tabindex: "-1" }, t("progress.heading"))))));
      on("language:changed", () => {
        registerText();
        if (state.visible) refresh();
        else state.dirty = true;
      });
      on("profile:changed", scheduleRefresh);
      on("session:completed", scheduleRefresh);
      on("achievement:unlocked", scheduleRefresh);
      if (typeof root.addEventListener === "function") {
        const onResize = () => {
          if (!state.visible || typeof root.setTimeout !== "function") return;
          if (state.resizeTimer) root.clearTimeout(state.resizeTimer);
          state.resizeTimer = root.setTimeout(() => {
            state.resizeTimer = null;
            fitTrend();
          }, 150);
        };
        root.addEventListener("resize", onResize);
        state.domOffs.push(() => root.removeEventListener("resize", onResize));
      }
      const router = L().router;
      if (router && typeof router.current === "function" && router.current() === "progress") screen.show({});
    },
    show(params) {
      state.visible = true;
      state.dirty = false;
      if (!state.mounted) return;
      const p = params && typeof params === "object" ? params : {};
      const Profile = L().Profile;
      // The active profile may have changed while the screen was away: look at it, unless a profile was asked for.
      let activeNow = null;
      try {
        activeNow = Profile && typeof Profile.active === "function" ? Profile.active() : null;
      } catch (error) {
        activeNow = null;
      }
      if (typeof p.profile === "string" && p.profile) state.viewId = p.profile;
      else if (activeNow && activeNow.id !== state.activeId) state.viewId = activeNow.id;
      state.trendActive = null;
      refresh();
    },
    hide() {
      state.visible = false;
      if (state.refreshTimer !== null && typeof root.clearTimeout === "function") root.clearTimeout(state.refreshTimer);
      state.refreshTimer = null;
    },
    render() {
      if (!state.mounted) return;
      if (state.visible) load();
      render();
    },
    destroy() {
      screen.hide();
      state.offs.splice(0).forEach((off) => off());
      state.domOffs.splice(0).forEach((off) => off());
      state.mounted = false;
    },
    // Pure helpers (also used by scripts/tests/progress-ui.test.js).
    helpers: {
      HEAT_WEEKS,
      HEAT_THRESHOLDS,
      TREND_LIMIT,
      QUALITY_ORDER,
      PHASES,
      SOURCES,
      IMPROVE_MIN_ROUNDS,
      dateKeyOf,
      formatNumber,
      splitDuration,
      xpInfo,
      streakInfo,
      heatLevel,
      activityCounts,
      heatmapGrid,
      weekdayOrder,
      niceDomain,
      scaleLinear,
      trendGeometry,
      trendSessions,
      stackSegments,
      barRow,
      phaseRows,
      sourceRows,
      bestTagSample,
      dataGaps,
      achievementRows,
      achievementCounts,
    },
    TEXT,
    _state: state,
  };

  return screen;
});
