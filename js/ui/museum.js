// Screen "museum" (History): the story of chess and a small school of concepts, in four tabs.
//   Timeline       the milestones of Ludus.Facts.timeline() grouped by era, each one expandable to the
//                  curiosities of its time and its source; jump to an era or to a year
//   Curiosities    the facts of Ludus.Facts by category, with search, "show more" and "surprise me"
//   Chess school   the lessons of Ludus.Concepts, each with its example on a board and the best move,
//                  linked to the mistakes (Ludus.Insights.TAGS) they help to avoid
//   Reading room   Ludus.Reader.createCarousel in a calm, full-width view: it never advances before
//                  the reading time, with previous / next / pause
// Contract: docs/ARCHITECTURE.md sections 12, 15 and 20; styles in css/museum.css (prefix .museum-).
//
//   Ludus.Screens.museum.mount(el)    el = #screen-museum. Idempotent and cheap (the data is local).
//   Ludus.Screens.museum.show(params) params.tab = timeline | curiosities | school | room. The hash
//                                     "#/museum/<tab>" does the same (cold start and hashchange).
//   Ludus.Screens.museum.hide()       stops the reading room (its timers) and the observers.
//   Ludus.Screens.museum.render()     repaints from the current state (also on language:changed).
//   Ludus.Screens.museum.titleKey     "museum.title", the i18n key of document.title.
//
// Nothing is stored (no "seen" state, no bookmarks): everything on this screen is reading. Built with
// Ludus.util.h only; a missing module (Facts, Concepts, Insights, Reader, the kit) removes the part that
// needs it and never breaks the rest. Pure helpers are exported under `helpers` for
// scripts/tests/museum-ui.test.js.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Screens = root.Ludus.Screens || {};
  root.Ludus.Screens.museum = api;
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

  function tCount(key, n, params) {
    return t(n === 1 ? `${key}.one` : key, Object.assign({ n }, params || {}));
  }

  // ---------- Text ----------

  const TEXT = {
    es: {
      "museum.title": "Historia",
      "museum.eyebrow": "El juego más allá del tablero",
      "museum.heading": "Historia y curiosidades",
      "museum.sub": "Una línea de tiempo del ajedrez, curiosidades con su fuente, una pequeña escuela de conceptos y una sala para leer sin apuro.",
      "museum.tabs": "Secciones de Historia",
      "museum.tab.timeline": "Línea de tiempo",
      "museum.tab.curiosities": "Curiosidades",
      "museum.tab.school": "Escuela de ajedrez",
      "museum.tab.room": "Sala de lectura",
      "museum.unavailable": "Esta sección no está disponible en este momento.",

      "museum.timeline.title": "Línea de tiempo",
      "museum.timeline.lead": "Los hitos del ajedrez, del chaturanga a los campeones de hoy. Abrí cada hito para ver las curiosidades de su época y de dónde sale el dato.",
      "museum.timeline.jump": "Ir a",
      "museum.timeline.eras": "Épocas",
      "museum.timeline.year": "Ir al año",
      "museum.timeline.year.hint": "Entre {from} y {to}",
      "museum.timeline.year.go": "Ir",
      "museum.timeline.year.invalid": "Escribí un año entre {from} y {to}.",
      "museum.timeline.year.found": "Año {year}: te llevamos a “{title}” ({at}).",
      "museum.timeline.milestones": "{n} hitos",
      "museum.timeline.milestones.one": "1 hito",
      "museum.timeline.more": "Más de esta época",
      "museum.timeline.more.n": "Más de esta época ({n})",
      "museum.timeline.less": "Ocultar",
      "museum.timeline.related": "Curiosidades de esta época",
      "museum.timeline.source": "Fuente",
      "museum.era.e0": "Orígenes",
      "museum.era.e1": "Edad Media",
      "museum.era.e2": "Nace el ajedrez moderno",
      "museum.era.e3": "La era romántica",
      "museum.era.e4": "Los primeros campeones del mundo",
      "museum.era.e5": "La FIDE y la Guerra Fría",
      "museum.era.e6": "Hombre contra máquina",
      "museum.era.e7": "La era digital",
      "museum.era.range": "{from}–{to}",
      "museum.era.before": "Antes de {to}",
      "museum.era.from": "Desde {from}",

      "museum.facts.title": "Curiosidades",
      "museum.facts.lead": "Datos del juego y de su historia, cada uno con su fuente.",
      "museum.facts.search": "Buscar curiosidades",
      "museum.facts.search.placeholder": "Por ejemplo: Fischer, reloj, dama",
      "museum.facts.search.clear": "Borrar la búsqueda",
      "museum.facts.categories": "Categorías",
      "museum.facts.all": "Todas",
      "museum.facts.surprise": "Sorpréndeme",
      "museum.facts.another": "Otra sorpresa",
      "museum.facts.surprise.title": "Una curiosidad para vos",
      "museum.facts.surprise.close": "Cerrar",
      "museum.facts.count": "{shown} de {total} curiosidades",
      "museum.facts.count.one": "1 de {total} curiosidades",
      "museum.facts.more": "Mostrar más",
      "museum.facts.more.n": "Mostrar más ({n} restantes)",
      "museum.facts.empty.title": "No encontramos curiosidades",
      "museum.facts.empty.body": "Probá con otra palabra o elegí otra categoría.",
      "museum.facts.empty.clear": "Ver todas",
      "museum.facts.source": "Fuente: {source}",
      "museum.facts.list": "Curiosidades",

      "museum.school.title": "Escuela de ajedrez",
      "museum.school.lead": "Pequeñas lecciones con un ejemplo en el tablero. Cada una explica una idea que se repite y el error que ayuda a evitar.",
      "museum.school.filter": "Ver lecciones sobre",
      "museum.school.all": "Todas las lecciones",
      "museum.school.related": "Errores que ayuda a evitar",
      "museum.school.related.filter": "Ver lecciones sobre: {name}",
      "museum.school.best": "Jugada del ejemplo: {san}",
      "museum.school.board": "Ejemplo de {title}",
      "museum.school.count": "{n} lecciones",
      "museum.school.count.one": "1 lección",
      "museum.school.empty": "No hay lecciones para ese error todavía.",

      "museum.room.title": "Sala de lectura",
      "museum.room.lead": "Un lugar tranquilo para leer a tu ritmo. El dato cambia solo cuando pasó el tiempo de lectura, y podés pausar o moverte con los botones cuando quieras.",
      "museum.room.topic": "Tema de lectura",
      "museum.room.counter": "Dato {n} de {total}",
      "museum.room.hint": "Al pasar el cursor, al enfocar un botón o al tocar el dato, la lectura se pausa sola.",
      "museum.room.empty": "No hay datos para leer en esta categoría.",
    },
    en: {
      "museum.title": "History",
      "museum.eyebrow": "The game beyond the board",
      "museum.heading": "History and curiosities",
      "museum.sub": "A timeline of chess, curiosities with their sources, a small school of concepts and a room to read at your own pace.",
      "museum.tabs": "History sections",
      "museum.tab.timeline": "Timeline",
      "museum.tab.curiosities": "Curiosities",
      "museum.tab.school": "Chess school",
      "museum.tab.room": "Reading room",
      "museum.unavailable": "This section is not available right now.",

      "museum.timeline.title": "Timeline",
      "museum.timeline.lead": "The milestones of chess, from chaturanga to today's champions. Open each milestone to see the curiosities of its time and where the fact comes from.",
      "museum.timeline.jump": "Jump to",
      "museum.timeline.eras": "Eras",
      "museum.timeline.year": "Go to year",
      "museum.timeline.year.hint": "Between {from} and {to}",
      "museum.timeline.year.go": "Go",
      "museum.timeline.year.invalid": "Type a year between {from} and {to}.",
      "museum.timeline.year.found": "Year {year}: taking you to “{title}” ({at}).",
      "museum.timeline.milestones": "{n} milestones",
      "museum.timeline.milestones.one": "1 milestone",
      "museum.timeline.more": "More from this era",
      "museum.timeline.more.n": "More from this era ({n})",
      "museum.timeline.less": "Hide",
      "museum.timeline.related": "Curiosities from this era",
      "museum.timeline.source": "Source",
      "museum.era.e0": "Origins",
      "museum.era.e1": "The Middle Ages",
      "museum.era.e2": "Modern chess takes shape",
      "museum.era.e3": "The romantic era",
      "museum.era.e4": "The first world champions",
      "museum.era.e5": "FIDE and the Cold War",
      "museum.era.e6": "Man against machine",
      "museum.era.e7": "The digital age",
      "museum.era.range": "{from}–{to}",
      "museum.era.before": "Before {to}",
      "museum.era.from": "From {from}",

      "museum.facts.title": "Curiosities",
      "museum.facts.lead": "Facts about the game and its history, each one with its source.",
      "museum.facts.search": "Search curiosities",
      "museum.facts.search.placeholder": "For example: Fischer, clock, queen",
      "museum.facts.search.clear": "Clear the search",
      "museum.facts.categories": "Categories",
      "museum.facts.all": "All",
      "museum.facts.surprise": "Surprise me",
      "museum.facts.another": "Another surprise",
      "museum.facts.surprise.title": "A curiosity for you",
      "museum.facts.surprise.close": "Close",
      "museum.facts.count": "{shown} of {total} curiosities",
      "museum.facts.count.one": "1 of {total} curiosities",
      "museum.facts.more": "Show more",
      "museum.facts.more.n": "Show more ({n} left)",
      "museum.facts.empty.title": "No curiosities found",
      "museum.facts.empty.body": "Try another word or pick another category.",
      "museum.facts.empty.clear": "Show all",
      "museum.facts.source": "Source: {source}",
      "museum.facts.list": "Curiosities",

      "museum.school.title": "Chess school",
      "museum.school.lead": "Small lessons with an example on the board. Each one explains an idea that keeps coming back and the mistake it helps to avoid.",
      "museum.school.filter": "Show lessons about",
      "museum.school.all": "All lessons",
      "museum.school.related": "Mistakes it helps to avoid",
      "museum.school.related.filter": "Show lessons about: {name}",
      "museum.school.best": "Move of the example: {san}",
      "museum.school.board": "Example of {title}",
      "museum.school.count": "{n} lessons",
      "museum.school.count.one": "1 lesson",
      "museum.school.empty": "There are no lessons for that mistake yet.",

      "museum.room.title": "Reading room",
      "museum.room.lead": "A quiet place to read at your own pace. The fact changes by itself only after its reading time has passed, and you can pause or move with the buttons whenever you like.",
      "museum.room.topic": "Reading topic",
      "museum.room.counter": "Fact {n} of {total}",
      "museum.room.hint": "Hovering, focusing a button or touching the fact pauses the reading on its own.",
      "museum.room.empty": "There are no facts to read in this category.",
    },
  };

  function registerText() {
    const i18n = L().i18n;
    if (i18n && typeof i18n.register === "function") i18n.register(TEXT);
  }
  registerText();

  // ---------- Pure helpers ----------

  const TABS = ["timeline", "curiosities", "school", "room"];
  const TAB_ICONS = { timeline: "history", curiosities: "lightbulb", school: "columns", room: "book" };
  const PAGE_SIZE = 24;
  const SEEN_LIMIT = 24;

  function cleanTab(value) {
    return TABS.includes(value) ? value : "timeline";
  }

  // "#/museum/school" -> "school"; "#/museum" and anything else -> null.
  function parseMuseumHash(hash) {
    const match = /^#\/museum\/([a-z]+)\/?$/.exec(String(hash || ""));
    return match && TABS.includes(match[1]) ? match[1] : null;
  }

  function isMuseumHash(hash) {
    return /^#\/museum\/?$/.test(String(hash || ""));
  }

  function buildMuseumHash(tab) {
    return TABS.includes(tab) && tab !== "timeline" ? `#/museum/${tab}` : "#/museum";
  }

  // The eras of the timeline: [from, to] inclusive, `to` null = open ended.
  const ERAS = [
    { id: "e0", from: null, to: 999 },
    { id: "e1", from: 1000, to: 1499 },
    { id: "e2", from: 1500, to: 1799 },
    { id: "e3", from: 1800, to: 1885 },
    { id: "e4", from: 1886, to: 1947 },
    { id: "e5", from: 1948, to: 1989 },
    { id: "e6", from: 1990, to: 2005 },
    { id: "e7", from: 2006, to: null },
  ];

  function eraOfYear(year) {
    const y = Number(year);
    if (!Number.isFinite(y)) return ERAS[0].id;
    const era = ERAS.find((entry) => (entry.from === null || y >= entry.from) && (entry.to === null || y <= entry.to));
    return era ? era.id : ERAS[ERAS.length - 1].id;
  }

  // Timeline items grouped by era, in order; an era without milestones is left out.
  // -> [{ id, from, to, items: [item] }] with from / to the years of its first and last milestone.
  function groupTimeline(items) {
    const list = Array.isArray(items) ? items.filter((item) => item && Number.isFinite(Number(item.year))) : [];
    const groups = [];
    ERAS.forEach((era) => {
      const inEra = list.filter((item) => eraOfYear(item.year) === era.id);
      if (!inEra.length) return;
      groups.push({ id: era.id, from: era.from, to: era.to, first: inEra[0].year, last: inEra[inEra.length - 1].year, items: inEra });
    });
    return groups;
  }

  // The facts dated inside [from, to) (to = null: no upper limit), oldest first. Undated facts never match.
  function factsBetween(facts, from, to) {
    return (Array.isArray(facts) ? facts : [])
      .filter((fact) => typeof fact.year === "number" && fact.year >= from && (to === null || to === undefined || fact.year < to))
      .sort((a, b) => a.year - b.year || String(a.id).localeCompare(String(b.id)));
  }

  // Map of timeline item id -> the facts of its time (up to the next milestone).
  function relatedByItem(items, facts) {
    const map = new Map();
    const list = Array.isArray(items) ? items : [];
    list.forEach((item, index) => {
      const next = list[index + 1];
      map.set(item.id, factsBetween(facts, item.year, next ? next.year : null));
    });
    return map;
  }

  // The milestone a typed year leads to: the first one at or after it, or the last one when it is later
  // than every milestone. null for something that is not a year.
  function findYearTarget(items, value) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return null;
    const text = String(value === undefined || value === null ? "" : value).trim();
    if (!/^-?\d{1,4}$/.test(text)) return null;
    const year = Number(text);
    const index = list.findIndex((item) => item.year >= year);
    return index < 0 ? list.length - 1 : index;
  }

  function normalizeText(value) {
    let text = value === undefined || value === null ? "" : String(value);
    try {
      text = text.normalize("NFD");
    } catch (error) {
      // compare as it is
    }
    return text.replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function factText(fact, language) {
    if (!fact || !fact.text) return "";
    return fact.text[language === "en" ? "en" : "es"] || fact.text.es || "";
  }

  // Facts of a category (or "all") whose text, year or category label contain every word of the query.
  function filterFacts(facts, options, language) {
    const opts = options && typeof options === "object" ? options : {};
    const category = opts.category && opts.category !== "all" ? opts.category : null;
    const words = normalizeText(opts.query).split(" ").filter(Boolean);
    const labelOf = typeof opts.categoryLabel === "function" ? opts.categoryLabel : () => "";
    return (Array.isArray(facts) ? facts : []).filter((fact) => {
      if (category && fact.cat !== category) return false;
      if (!words.length) return true;
      const hay = normalizeText(`${factText(fact, language)} ${fact.year === undefined ? "" : fact.year} ${labelOf(fact.cat)}`);
      return words.every((word) => hay.includes(word));
    });
  }

  // A random fact that has not been shown lately; when everything has, the oldest seen one comes back
  // (never the very last one, so the same fact does not show twice in a row).
  function pickSurprise(facts, seenIds, random) {
    const list = Array.isArray(facts) ? facts : [];
    if (!list.length) return null;
    const seen = Array.isArray(seenIds) ? seenIds : [];
    const rnd = typeof random === "function" ? random : Math.random;
    let pool = list.filter((fact) => !seen.includes(fact.id));
    if (!pool.length) {
      const last = seen[seen.length - 1];
      pool = list.length > 1 ? list.filter((fact) => fact.id !== last) : list;
    }
    const value = Number(rnd());
    const index = Number.isFinite(value) ? Math.max(0, Math.min(pool.length - 1, Math.floor(value * pool.length))) : 0;
    return pool[index];
  }

  function rememberSeen(seenIds, id) {
    const seen = (Array.isArray(seenIds) ? seenIds : []).filter((entry) => entry !== id);
    seen.push(id);
    return seen.slice(-SEEN_LIMIT);
  }

  // The Insights tags that have at least one lesson, in the order of Insights.TAGS.
  function schoolTags(tags, concepts) {
    const api = concepts && typeof concepts.byTag === "function" ? concepts : null;
    if (!api) return [];
    return (Array.isArray(tags) ? tags : []).filter((tag) => api.byTag(tag).length > 0);
  }

  function filterConcepts(list, tag) {
    const concepts = Array.isArray(list) ? list : [];
    if (!tag || tag === "all") return concepts.slice();
    return concepts.filter((concept) => Array.isArray(concept.tags) && concept.tags.includes(tag));
  }

  // "b5c7" -> { from: "b5", to: "c7" }; anything else -> null.
  function uciSquares(uci) {
    const match = /^([a-h][1-8])([a-h][1-8])[qrbn]?$/.exec(String(uci || ""));
    return match ? { from: match[1], to: match[2] } : null;
  }

  // The example move of a lesson in SAN ("Nc7+"), or null when the position or move do not replay.
  function conceptMoveSan(concept, chessApi) {
    const api = chessApi || L().chess;
    if (!concept || !api || !api.Chess || typeof api.uciToMove !== "function" || typeof api.moveToSan !== "function") return null;
    try {
      const chess = new api.Chess(concept.fen);
      const move = api.uciToMove(concept.bestUci, chess);
      return move ? api.moveToSan(chess, move) : null;
    } catch (error) {
      return null;
    }
  }

  function sideOfFen(fen) {
    return String(fen || "").split(" ")[1] === "b" ? "b" : "w";
  }

  function pickLocalized(value, language) {
    if (!value || typeof value !== "object") return typeof value === "string" ? value : "";
    return value[language === "en" ? "en" : "es"] || value.es || "";
  }

  // ---------- Private icons (the kit has none for "search") ----------

  function searchGlyph() {
    return h("svg:svg", {
      class: "ui-icon ui-icon-search",
      width: 18,
      height: 18,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1.75,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      focusable: "false",
      "aria-hidden": "true",
    }, h("svg:circle", { cx: 11, cy: 11, r: 6.5 }), h("svg:path", { d: "M16.5 16.5 21 21" }));
  }

  // ---------- State ----------

  const state = {
    mounted: false,
    container: null,
    visible: false,
    tab: "timeline",
    built: {},
    refs: {},
    panels: {},
    tabButtons: {},
    facts: { category: "all", query: "", shown: PAGE_SIZE },
    surprise: { id: null, seen: [] },
    school: { tag: "all" },
    room: { category: "all", controller: null, counter: null },
    timeline: { open: new Set(), observer: null, activeEra: null },
    searchTimer: null,
    offs: [],
    domOffs: [],
    hashOnMount: "",
  };

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

  function reducedMotion() {
    const ui = L().ui;
    try {
      return Boolean(ui && typeof ui.reducedMotion === "function" && ui.reducedMotion());
    } catch (error) {
      return false;
    }
  }

  function factsApi() {
    const api = L().Facts;
    return api && typeof api.all === "function" ? api : null;
  }

  function categoryLabel(cat) {
    const Facts = factsApi();
    return Facts && typeof Facts.categoryLabel === "function" ? Facts.categoryLabel(cat, lang()) : String(cat);
  }

  function yearLabel(item) {
    const Facts = factsApi();
    if (Facts && typeof Facts.formatYear === "function") return Facts.formatYear(item, lang());
    return item && typeof item.year === "number" ? String(item.year) : "";
  }

  function unavailable() {
    return h("p", { class: "museum-unavailable" }, icon("info", { size: 16 }), t("museum.unavailable"));
  }

  function scrollTo(el) {
    if (!el || typeof el.scrollIntoView !== "function") return;
    try {
      el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    } catch (error) {
      el.scrollIntoView();
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

  // ---------- Small shared builders ----------

  function categoryChip(cat) {
    return h("span", { class: `rd-chip rd-chip--${cat} museum-cat` }, categoryLabel(cat));
  }

  function panelHead(titleKey, leadKey) {
    return h("header", { class: "museum-panel-head" },
      h("h2", { class: "museum-h2" }, t(titleKey)),
      h("p", { class: "museum-lead" }, t(leadKey)));
  }

  // ==========================================================================
  // Timeline
  // ==========================================================================

  function eraTitle(group) {
    return t(`museum.era.${group.id}`);
  }

  function eraRange(group) {
    if (group.from === null) return t("museum.era.before", { to: group.to + 1 });
    if (group.to === null) return t("museum.era.from", { from: group.from });
    return t("museum.era.range", { from: group.from, to: group.to });
  }

  function timelineEvent(item, related, onToggle) {
    const language = lang();
    const id = `museum-ev-${item.id}`;
    const panelId = `${id}-more`;
    const open = state.timeline.open.has(item.id);
    const sourceText = typeof item.source === "string" ? item.source : "";
    const hasMore = related.length > 0 || Boolean(sourceText);
    const panel = hasMore
      ? h("div", { class: "museum-more-panel", id: panelId, hidden: !open },
        related.length
          ? h("div", { class: "museum-related" },
            h("h5", { class: "museum-related-title" }, t("museum.timeline.related")),
            h("ul", { class: "museum-related-list" }, related.map((fact) => h("li", null,
              h("span", { class: "museum-related-year" }, yearLabel(fact)),
              h("span", { class: "museum-related-text" }, factText(fact, language))))))
          : null,
        sourceText ? h("p", { class: "museum-source" }, h("span", { class: "museum-source-label" }, t("museum.timeline.source")), ` ${sourceText}`) : null)
      : null;
    const button = hasMore
      ? h("button", {
        type: "button",
        class: "btn btn-ghost btn-sm museum-more",
        "aria-expanded": String(open),
        "aria-controls": panelId,
        onclick: () => onToggle(item, button, panel),
      }, h("span", { class: "btn-label" }, open ? t("museum.timeline.less") : (related.length ? t("museum.timeline.more.n", { n: related.length }) : t("museum.timeline.more"))), icon("chevron-down", { size: 16 }))
      : null;
    return h("li", { class: "museum-event", id, "data-year": String(item.year), "data-item": item.id },
      h("span", { class: "museum-node", "aria-hidden": "true" }),
      h("div", { class: "museum-event-year" }, h("span", { class: "museum-year" }, yearLabel(item))),
      h("article", { class: "museum-event-card card", "aria-labelledby": `${id}-title` },
        h("h4", { class: "museum-event-title", id: `${id}-title`, tabindex: "-1" }, pickLocalized(item.title, language)),
        h("p", { class: "museum-event-text" }, pickLocalized(item.text, language)),
        button,
        panel));
  }

  function toggleEvent(item, button, panel) {
    const open = button.getAttribute("aria-expanded") !== "true";
    if (open) state.timeline.open.add(item.id);
    else state.timeline.open.delete(item.id);
    button.setAttribute("aria-expanded", String(open));
    setHidden(panel, !open);
    const related = panel ? panel.querySelectorAll(".museum-related-list li").length : 0;
    const label = button.querySelector(".btn-label");
    if (label) label.textContent = open ? t("museum.timeline.less") : (related ? t("museum.timeline.more.n", { n: related }) : t("museum.timeline.more"));
    button.classList.toggle("is-open", open);
  }

  function disconnectObserver() {
    const observer = state.timeline.observer;
    if (observer && typeof observer.disconnect === "function") observer.disconnect();
    state.timeline.observer = null;
  }

  function markActiveEra(id) {
    state.timeline.activeEra = id;
    const nav = state.refs.eraNav;
    if (!nav || typeof nav.querySelectorAll !== "function") return;
    Array.from(nav.querySelectorAll("button[data-era]")).forEach((button) => {
      if (button.getAttribute("data-era") === id) button.setAttribute("aria-current", "location");
      else button.removeAttribute("aria-current");
    });
  }

  function observeEras(panel) {
    disconnectObserver();
    const Observer = root.IntersectionObserver;
    if (typeof Observer !== "function" || !panel || typeof panel.querySelectorAll !== "function") return;
    const visible = new Set();
    const order = Array.from(panel.querySelectorAll(".museum-era")).map((el) => el.getAttribute("data-era"));
    try {
      const observer = new Observer((entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute("data-era");
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        });
        const first = order.find((id) => visible.has(id));
        if (first) markActiveEra(first);
      }, { rootMargin: "-20% 0px -60% 0px" });
      panel.querySelectorAll(".museum-era").forEach((el) => observer.observe(el));
      state.timeline.observer = observer;
    } catch (error) {
      state.timeline.observer = null;
    }
  }

  function jumpToEra(id) {
    const panel = state.panels.timeline;
    const target = panel && typeof panel.querySelector === "function" ? panel.querySelector(`.museum-era[data-era="${id}"]`) : null;
    if (!target) return;
    scrollTo(target);
    focusNode(target.querySelector(".museum-era-title"));
    markActiveEra(id);
  }

  function jumpToYear(items, value) {
    const status = state.refs.yearStatus;
    const first = items[0] ? items[0].year : 0;
    const last = items.length ? items[items.length - 1].year : 0;
    const index = findYearTarget(items, value);
    if (index === null) {
      if (status) {
        status.textContent = t("museum.timeline.year.invalid", { from: first, to: last });
        status.classList.add("is-error");
      }
      return false;
    }
    const item = items[index];
    const panel = state.panels.timeline;
    const target = panel && typeof panel.querySelector === "function" ? panel.querySelector(`[data-item="${item.id}"]`) : null;
    if (status) {
      status.classList.remove("is-error");
      status.textContent = t("museum.timeline.year.found", { year: String(value).trim(), title: pickLocalized(item.title, lang()), at: yearLabel(item) });
    }
    if (target) {
      scrollTo(target);
      focusNode(target.querySelector(".museum-event-title"));
      target.classList.remove("is-target");
      // Restart the highlight animation (there is none under reduced motion: the system rule stops it).
      void target.offsetWidth;
      target.classList.add("is-target");
    }
    return true;
  }

  function buildTimeline(panel) {
    const Facts = factsApi();
    clear(panel);
    if (!Facts || typeof Facts.timeline !== "function") {
      panel.appendChild(unavailable());
      return;
    }
    const items = Facts.timeline();
    const groups = groupTimeline(items);
    const related = relatedByItem(items, Facts.all());
    const first = items.length ? items[0].year : 0;
    const last = items.length ? items[items.length - 1].year : 0;

    state.refs.eraNav = h("nav", { class: "museum-era-nav", "aria-label": t("museum.timeline.eras") },
      groups.map((group) => h("button", {
        type: "button",
        class: "museum-era-link",
        "data-era": group.id,
        onclick: () => jumpToEra(group.id),
      }, h("span", { class: "museum-era-link-name" }, eraTitle(group)), h("span", { class: "museum-era-link-range" }, eraRange(group)))));

    const yearInput = h("input", {
      type: "text",
      inputmode: "numeric",
      pattern: "[0-9]*",
      id: "museum-year",
      class: "input museum-year-input",
      autocomplete: "off",
      maxlength: 4,
      "aria-describedby": "museum-year-hint museum-year-status",
      placeholder: String(first + Math.round((last - first) / 2)),
    });
    state.refs.yearStatus = h("p", { class: "museum-year-status", id: "museum-year-status", role: "status", "aria-live": "polite" });
    const yearForm = h("form", {
      class: "museum-year-form",
      novalidate: "",
      onsubmit: (event) => {
        if (event && typeof event.preventDefault === "function") event.preventDefault();
        jumpToYear(items, yearInput.value);
      },
    },
    h("div", { class: "field" },
      h("label", { for: "museum-year" }, t("museum.timeline.year")),
      h("div", { class: "museum-year-row" }, yearInput, h("button", { type: "submit", class: "btn btn-secondary" }, h("span", { class: "btn-label" }, t("museum.timeline.year.go")))),
      h("p", { class: "field-hint", id: "museum-year-hint" }, t("museum.timeline.year.hint", { from: first, to: last }))),
    state.refs.yearStatus);

    const side = h("aside", { class: "museum-timeline-side" },
      h("p", { class: "museum-side-title" }, t("museum.timeline.jump")),
      state.refs.eraNav,
      yearForm);

    const list = h("div", { class: "museum-timeline" },
      groups.map((group) => h("section", { class: "museum-era", "data-era": group.id, "aria-labelledby": `museum-era-${group.id}` },
        h("header", { class: "museum-era-head" },
          h("span", { class: "museum-era-mark", "aria-hidden": "true" }),
          h("p", { class: "museum-era-range" }, eraRange(group)),
          h("h3", { class: "museum-era-title", id: `museum-era-${group.id}`, tabindex: "-1" }, eraTitle(group)),
          h("p", { class: "museum-era-count" }, tCount("museum.timeline.milestones", group.items.length))),
        h("ol", { class: "museum-events" }, group.items.map((item) => timelineEvent(item, related.get(item.id) || [], toggleEvent))))));

    panel.appendChild(panelHead("museum.timeline.title", "museum.timeline.lead"));
    panel.appendChild(h("div", { class: "museum-timeline-layout" }, side, list));
    observeEras(panel);
    if (groups.length) markActiveEra(state.timeline.activeEra || groups[0].id);
  }

  // ==========================================================================
  // Curiosities
  // ==========================================================================

  function currentFacts() {
    const Facts = factsApi();
    if (!Facts) return [];
    return filterFacts(Facts.all(), { category: state.facts.category, query: state.facts.query, categoryLabel }, lang());
  }

  // The inside of a fact: its category, its year, the text and (in the featured one) the source.
  function factParts(fact, featured) {
    const year = yearLabel(fact);
    const source = typeof fact.source === "string" ? fact.source : "";
    return [
      h("div", { class: "museum-fact-meta" }, categoryChip(fact.cat), year ? h("span", { class: "museum-fact-year" }, year) : null),
      h("p", { class: "museum-fact-text", tabindex: "-1" }, factText(fact, lang())),
      featured && source ? h("p", { class: "museum-source" }, h("span", { class: "museum-source-label" }, t("museum.timeline.source")), ` ${source}`) : null,
    ];
  }

  function factCard(fact) {
    return h("li", { class: "museum-fact-item" }, h("article", { class: "museum-fact card" }, ...factParts(fact, false)));
  }

  function renderFactsList() {
    const refs = state.refs;
    if (!refs.factGrid) return;
    const list = currentFacts();
    const shown = Math.min(state.facts.shown, list.length);
    clear(refs.factGrid);
    list.slice(0, shown).forEach((fact) => refs.factGrid.appendChild(factCard(fact)));
    setHidden(refs.factGrid, list.length === 0);
    refs.factCount.textContent = tCount("museum.facts.count", shown, { shown, total: list.length });
    setHidden(refs.factEmpty, list.length !== 0);
    const remaining = list.length - shown;
    setHidden(refs.factMore, remaining <= 0);
    if (remaining > 0) {
      refs.factMore.querySelector(".btn-label").textContent = t("museum.facts.more.n", { n: remaining });
    }
    Array.from(refs.factCats.querySelectorAll("button")).forEach((button) => {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-cat") === state.facts.category));
    });
    setHidden(refs.factClear, !state.facts.query);
  }

  function showSurprise() {
    const Facts = factsApi();
    const refs = state.refs;
    if (!Facts || !refs.surprise) return;
    const pool = filterFacts(Facts.all(), { category: state.facts.category, query: "", categoryLabel }, lang());
    const fact = pickSurprise(pool.length ? pool : Facts.all(), state.surprise.seen);
    if (!fact) return;
    state.surprise.id = fact.id;
    state.surprise.seen = rememberSeen(state.surprise.seen, fact.id);
    paintSurprise();
    refs.surpriseButton.querySelector(".btn-label").textContent = t("museum.facts.another");
    const box = refs.surprise;
    if (!reducedMotion() && typeof box.scrollIntoView === "function") {
      try {
        const rect = box.getBoundingClientRect();
        const outside = rect.top < 72 || rect.bottom > (root.innerHeight || 800);
        if (outside) box.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (error) {
        // the card is shown anyway
      }
    }
  }

  function paintSurprise() {
    const Facts = factsApi();
    const box = state.refs.surprise;
    if (!box) return;
    clear(box);
    const fact = state.surprise.id && Facts ? Facts.get(state.surprise.id) : null;
    setHidden(box, !fact);
    if (!fact) return;
    box.appendChild(h("div", { class: "museum-surprise-inner card card-accent" },
      h("div", { class: "museum-surprise-head" },
        h("p", { class: "t-eyebrow" }, icon("sparkles", { size: 14 }), t("museum.facts.surprise.title")),
        h("button", {
          type: "button",
          class: "btn btn-ghost btn-sm",
          onclick: () => {
            state.surprise.id = null;
            paintSurprise();
            state.refs.surpriseButton.querySelector(".btn-label").textContent = t("museum.facts.surprise");
            focusNode(state.refs.surpriseButton);
          },
        }, icon("x", { size: 14 }), h("span", { class: "btn-label" }, t("museum.facts.surprise.close")))),
      h("div", { class: "museum-fact is-featured" }, ...factParts(fact, true))));
  }

  function buildCuriosities(panel) {
    const Facts = factsApi();
    clear(panel);
    if (!Facts) {
      panel.appendChild(unavailable());
      return;
    }
    const refs = state.refs;
    const scheduleSearch = (flush) => {
      if (state.searchTimer && typeof root.clearTimeout === "function") root.clearTimeout(state.searchTimer);
      state.searchTimer = null;
      const run = () => {
        state.searchTimer = null;
        state.facts.shown = PAGE_SIZE;
        renderFactsList();
      };
      if (flush || typeof root.setTimeout !== "function") run();
      else state.searchTimer = root.setTimeout(run, 110);
    };

    refs.factSearch = h("input", {
      id: "museum-search",
      class: "input museum-search-input",
      type: "search",
      autocomplete: "off",
      spellcheck: "false",
      maxlength: 60,
      placeholder: t("museum.facts.search.placeholder"),
      oninput: (event) => {
        state.facts.query = event.target.value;
        if (refs.factClear) setHidden(refs.factClear, !state.facts.query);
        scheduleSearch(false);
      },
    });
    refs.factSearch.value = state.facts.query;
    refs.factClear = h("button", {
      type: "button",
      class: "museum-search-clear",
      "aria-label": t("museum.facts.search.clear"),
      hidden: !state.facts.query,
      onclick: () => {
        state.facts.query = "";
        refs.factSearch.value = "";
        scheduleSearch(true);
        refs.factSearch.focus();
      },
    }, icon("x", { size: 16 }));

    const total = Facts.all().length;
    const chips = [{ id: "all", label: t("museum.facts.all"), count: total }].concat(Facts.categories().map((entry) => ({ id: entry.id, label: pickLocalized(entry.label, lang()), count: entry.count })));
    refs.factCats = h("div", { class: "museum-pills", role: "group", "aria-label": t("museum.facts.categories") },
      chips.map((entry) => h("button", {
        type: "button",
        class: "chip museum-pill",
        "data-cat": entry.id,
        "aria-pressed": String(entry.id === state.facts.category),
        onclick: () => {
          state.facts.category = entry.id;
          state.facts.shown = PAGE_SIZE;
          renderFactsList();
        },
      }, entry.label, h("span", { class: "museum-pill-count" }, String(entry.count)))));

    refs.surpriseButton = h("button", {
      type: "button",
      class: "btn btn-primary museum-surprise-btn",
      "data-fkey": "surprise",
      onclick: showSurprise,
    }, icon("sparkles", { size: 18 }), h("span", { class: "btn-label" }, state.surprise.id ? t("museum.facts.another") : t("museum.facts.surprise")));
    refs.surprise = h("div", { class: "museum-surprise", role: "region", "aria-live": "polite", "aria-label": t("museum.facts.surprise.title"), hidden: true });
    refs.factCount = h("p", { class: "museum-count", role: "status", "aria-live": "polite" });
    refs.factGrid = h("ul", { class: "museum-facts", role: "list", "aria-label": t("museum.facts.list") });
    refs.factMore = h("button", {
      type: "button",
      class: "btn btn-secondary museum-more-facts",
      onclick: () => {
        const before = state.facts.shown;
        state.facts.shown += PAGE_SIZE;
        renderFactsList();
        const cards = refs.factGrid.querySelectorAll(".museum-fact-item");
        const firstNew = cards[before];
        if (firstNew) focusNode(firstNew.querySelector(".museum-fact-text"));
      },
    }, h("span", { class: "btn-label" }));
    refs.factEmpty = h("div", { class: "museum-empty", hidden: true },
      L().ui && L().ui.emptyState
        ? L().ui.emptyState({
          icon: "lightbulb",
          title: t("museum.facts.empty.title"),
          body: t("museum.facts.empty.body"),
          action: {
            label: t("museum.facts.empty.clear"),
            kind: "secondary",
            onClick: () => {
              state.facts.query = "";
              state.facts.category = "all";
              refs.factSearch.value = "";
              state.facts.shown = PAGE_SIZE;
              renderFactsList();
            },
          },
        })
        : h("p", null, t("museum.facts.empty.title")));

    panel.appendChild(panelHead("museum.facts.title", "museum.facts.lead"));
    panel.appendChild(h("div", { class: "museum-toolbar" },
      h("div", { class: "field museum-field-search" },
        h("label", { for: "museum-search" }, t("museum.facts.search")),
        h("div", { class: "museum-search" }, searchGlyph(), refs.factSearch, refs.factClear)),
      refs.surpriseButton));
    panel.appendChild(refs.factCats);
    panel.appendChild(refs.surprise);
    panel.appendChild(refs.factCount);
    panel.appendChild(refs.factGrid);
    panel.appendChild(refs.factEmpty);
    panel.appendChild(h("div", { class: "museum-more-row" }, refs.factMore));
    paintSurprise();
    renderFactsList();
  }

  // ==========================================================================
  // Chess school
  // ==========================================================================

  function tagName(tag) {
    const Insights = L().Insights;
    return Insights && typeof Insights.tagLabelKey === "function" ? t(Insights.tagLabelKey(tag)) : String(tag);
  }

  function conceptCard(concept) {
    const ui = L().ui;
    const language = lang();
    const title = pickLocalized(concept.title, language);
    const squares = uciSquares(concept.bestUci);
    const side = sideOfFen(concept.fen);
    const board = ui && ui.miniBoard
      ? ui.miniBoard(concept.fen, {
        size: 280,
        orientation: side,
        coords: true,
        label: t("museum.school.board", { title }),
        highlight: squares ? [{ square: squares.from, kind: "best" }] : [],
        arrows: squares ? [{ from: squares.from, to: squares.to, color: "best" }] : [],
      })
      : null;
    const san = conceptMoveSan(concept);
    const tags = Array.isArray(concept.tags) ? concept.tags : [];
    const id = `museum-concept-${concept.id}`;
    return h("li", { class: "museum-concept-item", "data-concept": concept.id },
      h("article", { class: "museum-concept card", "aria-labelledby": `${id}-title` },
        h("div", { class: "museum-concept-board" },
          board,
          san ? h("p", { class: "museum-concept-move" }, icon("target", { size: 14 }), t("museum.school.best", { san })) : null),
        h("div", { class: "museum-concept-body" },
          h("h3", { class: "museum-concept-title", id: `${id}-title` }, title),
          h("p", { class: "museum-concept-text" }, pickLocalized(concept.body, language)),
          tags.length
            ? h("div", { class: "museum-concept-tags" },
              h("p", { class: "museum-concept-tags-label" }, t("museum.school.related")),
              h("div", { class: "museum-pills" }, tags.map((tag) => h("button", {
                type: "button",
                class: "chip museum-pill museum-pill-tag",
                "aria-label": t("museum.school.related.filter", { name: tagName(tag) }),
                onclick: () => {
                  state.school.tag = tag;
                  renderSchoolList();
                  const target = state.refs.schoolFilter && state.refs.schoolFilter.querySelector(`[data-tag="${tag}"]`);
                  scrollTo(state.refs.schoolFilter);
                  focusNode(target);
                },
              }, tagName(tag)))))
            : null)));
  }

  function renderSchoolList() {
    const refs = state.refs;
    const Concepts = L().Concepts;
    if (!refs.schoolGrid || !Concepts) return;
    const list = filterConcepts(Concepts.list(), state.school.tag);
    clear(refs.schoolGrid);
    list.forEach((concept) => refs.schoolGrid.appendChild(conceptCard(concept)));
    refs.schoolCount.textContent = tCount("museum.school.count", list.length);
    setHidden(refs.schoolEmpty, list.length !== 0);
    Array.from(refs.schoolFilter.querySelectorAll("button")).forEach((button) => {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-tag") === state.school.tag));
    });
  }

  function buildSchool(panel) {
    const Concepts = L().Concepts;
    const Insights = L().Insights;
    clear(panel);
    if (!Concepts || typeof Concepts.list !== "function") {
      panel.appendChild(unavailable());
      return;
    }
    const refs = state.refs;
    const tags = schoolTags(Insights && Insights.TAGS ? Array.from(Insights.TAGS) : [], Concepts);
    refs.schoolFilter = h("div", { class: "museum-pills", role: "group", "aria-label": t("museum.school.filter") },
      [{ tag: "all", label: t("museum.school.all") }].concat(tags.map((tag) => ({ tag, label: tagName(tag) }))).map((entry) => h("button", {
        type: "button",
        class: "chip museum-pill",
        "data-tag": entry.tag,
        "aria-pressed": String(entry.tag === state.school.tag),
        onclick: () => {
          state.school.tag = entry.tag;
          renderSchoolList();
        },
      }, entry.label)));
    refs.schoolCount = h("p", { class: "museum-count", role: "status", "aria-live": "polite" });
    refs.schoolGrid = h("ul", { class: "museum-concepts", role: "list" });
    refs.schoolEmpty = h("p", { class: "museum-unavailable", hidden: true }, icon("info", { size: 16 }), t("museum.school.empty"));
    panel.appendChild(panelHead("museum.school.title", "museum.school.lead"));
    panel.appendChild(refs.schoolFilter);
    panel.appendChild(refs.schoolCount);
    panel.appendChild(refs.schoolGrid);
    panel.appendChild(refs.schoolEmpty);
    renderSchoolList();
  }

  // ==========================================================================
  // Reading room
  // ==========================================================================

  function destroyRoom() {
    const r = state.room;
    if (r.controller && typeof r.controller.destroy === "function") {
      try {
        r.controller.destroy();
      } catch (error) {
        // already gone
      }
    }
    r.controller = null;
  }

  function updateRoomCounter() {
    const r = state.room;
    if (!r.counter) return;
    const info = r.controller && typeof r.controller.state === "function" ? r.controller.state() : null;
    r.counter.textContent = info && info.count ? t("museum.room.counter", { n: info.index + 1, total: info.count }) : "";
  }

  function startRoom() {
    const Reader = L().Reader;
    const Facts = factsApi();
    const host = state.refs.roomHost;
    destroyRoom();
    // Nothing runs behind a hidden screen (a language switch redraws even then): show() starts it.
    if (!state.visible || !host || !Reader || typeof Reader.createCarousel !== "function" || !Facts) return;
    clear(host);
    const category = state.room.category === "all" ? undefined : state.room.category;
    if (Facts.byCategory(category || "all").length === 0) {
      host.appendChild(h("p", { class: "museum-unavailable" }, icon("info", { size: 16 }), t("museum.room.empty")));
      return;
    }
    try {
      state.room.controller = Reader.createCarousel(host, {
        category,
        // The reading only advances while this tab is the one being read.
        onlyWhile: () => state.visible && state.tab === "room",
        onChange: () => updateRoomCounter(),
      });
      state.room.controller.start();
      updateRoomCounter();
    } catch (error) {
      logError("[Ludus.museum] the reading room could not start", error);
      state.room.controller = null;
      host.appendChild(unavailable());
    }
  }

  function buildRoom(panel) {
    const Facts = factsApi();
    clear(panel);
    destroyRoom();
    if (!Facts || !L().Reader) {
      panel.appendChild(unavailable());
      return;
    }
    const refs = state.refs;
    const chips = [{ id: "all", label: t("museum.facts.all") }].concat(Facts.categories().map((entry) => ({ id: entry.id, label: pickLocalized(entry.label, lang()) })));
    refs.roomCats = h("div", { class: "museum-pills", role: "group", "aria-label": t("museum.room.topic") },
      chips.map((entry) => h("button", {
        type: "button",
        class: "chip museum-pill",
        "data-cat": entry.id,
        "aria-pressed": String(entry.id === state.room.category),
        onclick: () => {
          state.room.category = entry.id;
          Array.from(refs.roomCats.querySelectorAll("button")).forEach((button) => button.setAttribute("aria-pressed", String(button.getAttribute("data-cat") === entry.id)));
          startRoom();
        },
      }, entry.label)));
    refs.roomHost = h("div", { class: "museum-room-host" });
    state.room.counter = h("p", { class: "museum-room-counter", "aria-hidden": "true" });
    panel.appendChild(h("div", { class: "museum-room" },
      h("header", { class: "museum-room-head" },
        h("h2", { class: "museum-h2" }, t("museum.room.title")),
        h("p", { class: "museum-lead" }, t("museum.room.lead"))),
      refs.roomCats,
      h("div", { class: "museum-room-stage card" }, refs.roomHost, state.room.counter),
      h("p", { class: "museum-room-hint" }, icon("info", { size: 14 }), t("museum.room.hint"))));
    startRoom();
  }

  // ==========================================================================
  // Tabs and the whole screen
  // ==========================================================================

  const BUILDERS = { timeline: buildTimeline, curiosities: buildCuriosities, school: buildSchool, room: buildRoom };

  function paintTabs() {
    TABS.forEach((tab) => {
      const button = state.tabButtons[tab];
      const panel = state.panels[tab];
      const selected = tab === state.tab;
      if (button) {
        button.setAttribute("aria-selected", String(selected));
        button.setAttribute("tabindex", selected ? "0" : "-1");
      }
      setHidden(panel, !selected);
    });
  }

  // The tab title names the section the person is reading ("Escuela de ajedrez - Historia - Ludus Scaccorum"); the router only knows the screen
  // (QA A11Y-024, WCAG 2.4.2). Only while the screen is showing, so a hidden museum never rewrites another screen's title.
  function docTitleFor(tab, label, screenTitle) {
    return [label, screenTitle, "Ludus Scaccorum"].filter(Boolean).join(" - ");
  }

  function syncDocTitle() {
    const doc = getDoc();
    if (!doc || !state.visible) return;
    try {
      doc.title = docTitleFor(state.tab, t(`museum.tab.${state.tab}`), t("museum.title"));
    } catch (error) {
      // cosmetic only
    }
  }

  function mirrorHash(tab) {
    const run = () => {
      try {
        if (!state.visible || !root.history || typeof root.history.replaceState !== "function" || !root.location) return;
        const wanted = buildMuseumHash(tab);
        if (root.location.hash === wanted) return;
        root.history.replaceState(root.history.state, "", `${root.location.pathname}${root.location.search}${wanted}`);
      } catch (error) {
        // sandboxed frames and file:// can refuse; the hash is only a convenience
      }
    };
    // After the shell has mirrored the screen id into the hash (it does so on screen:changed).
    if (typeof root.setTimeout === "function") root.setTimeout(run, 0);
    else run();
  }

  function showTab(tab, options) {
    const opts = options || {};
    const next = cleanTab(tab);
    const previous = state.tab;
    state.tab = next;
    if (previous === "room" && next !== "room") destroyRoom();
    if (previous === "timeline" && next !== "timeline") disconnectObserver();
    const panel = state.panels[next];
    if (panel && !state.built[next]) {
      try {
        BUILDERS[next](panel);
        state.built[next] = true;
      } catch (error) {
        logError(`[Ludus.museum] the "${next}" tab could not be drawn`, error);
        clear(panel);
        panel.appendChild(unavailable());
        state.built[next] = true;
      }
    }
    // Coming back to a tab that was already drawn: its timers and observers are started again.
    if (next === "room" && !state.room.controller) startRoom();
    if (next === "timeline" && !state.timeline.observer && panel) observeEras(panel);
    paintTabs();
    syncDocTitle();
    if (opts.focus && state.tabButtons[next] && typeof state.tabButtons[next].focus === "function") state.tabButtons[next].focus();
    if (opts.mirror !== false) mirrorHash(next);
  }

  function onTabKey(event) {
    const keys = { ArrowRight: 1, ArrowLeft: -1 };
    let next = null;
    const at = TABS.indexOf(state.tab);
    if (event.key in keys) next = TABS[(at + keys[event.key] + TABS.length) % TABS.length];
    else if (event.key === "Home") next = TABS[0];
    else if (event.key === "End") next = TABS[TABS.length - 1];
    if (!next) return;
    if (typeof event.preventDefault === "function") event.preventDefault();
    showTab(next, { focus: true });
  }

  function render() {
    if (!state.mounted || !state.container || !getDoc() || !L().util) return;
    disconnectObserver();
    destroyRoom();
    const container = state.container;
    clear(container);
    state.built = {};
    state.refs = {};
    state.panels = {};
    state.tabButtons = {};
    const tabs = h("div", { class: "museum-tabs tabs", role: "tablist", "aria-label": t("museum.tabs"), onkeydown: onTabKey },
      TABS.map((tab) => {
        const button = h("button", {
          type: "button",
          class: "museum-tab",
          role: "tab",
          id: `museum-tab-${tab}`,
          "aria-controls": `museum-panel-${tab}`,
          "aria-selected": "false",
          tabindex: "-1",
          "data-tab": tab,
          onclick: () => showTab(tab),
        }, icon(TAB_ICONS[tab], { size: 20 }), h("span", { class: "museum-tab-label" }, t(`museum.tab.${tab}`)));
        state.tabButtons[tab] = button;
        return button;
      }));
    const panels = TABS.map((tab) => {
      const panel = h("section", {
        class: `museum-panel museum-panel-${tab}`,
        role: "tabpanel",
        id: `museum-panel-${tab}`,
        "aria-labelledby": `museum-tab-${tab}`,
        tabindex: "0",
        hidden: true,
      });
      state.panels[tab] = panel;
      return panel;
    });
    container.appendChild(h("div", { class: "museum" },
      h("header", { class: "museum-head" },
        h("p", { class: "t-eyebrow" }, t("museum.eyebrow")),
        h("h1", { class: "screen-title museum-title", "data-screen-title": "", tabindex: "-1" }, t("museum.heading")),
        h("p", { class: "screen-sub museum-sub" }, t("museum.sub"))),
      tabs,
      panels));
    showTab(state.tab, { mirror: false });
  }

  function tabFromParams(params) {
    const p = params && typeof params === "object" ? params : {};
    return TABS.includes(p.tab) ? p.tab : null;
  }

  function goToHash(hash) {
    const tab = parseMuseumHash(hash);
    if (!tab) return false;
    const game = L().game;
    try {
      if (game && typeof game.isActive === "function" && game.isActive()) return false;
    } catch (error) {
      return false;
    }
    const router = L().router;
    if (router && typeof router.show === "function") return router.show("museum", { tab }) !== false;
    return false;
  }

  function onHashChange() {
    const hash = root.location ? root.location.hash : "";
    const tab = parseMuseumHash(hash);
    if (tab) {
      if (state.visible && state.tab === tab) return;
      goToHash(hash);
    } else if (isMuseumHash(hash) && state.visible && state.tab !== "timeline") {
      showTab("timeline", { mirror: false });
    }
  }

  function on(evt, fn) {
    const bus = L().bus;
    if (bus && typeof bus.on === "function") state.offs.push(bus.on(evt, fn));
  }

  const screen = {
    // Router title (an i18n key): "Historia - Ludus Scaccorum".
    titleKey: "museum.title",
    title: "museum.title",
    mount(container) {
      const doc = getDoc();
      if (!doc || !container || !L().util) return;
      if (state.mounted && state.container === container) {
        render();
        return;
      }
      state.container = container;
      state.mounted = true;
      state.hashOnMount = root.location ? String(root.location.hash || "") : "";
      render();
      on("language:changed", () => render());
      if (typeof root.addEventListener === "function") {
        root.addEventListener("hashchange", onHashChange);
        state.domOffs.push(() => root.removeEventListener("hashchange", onHashChange));
      }
      // A page opened straight on "#/museum/<tab>": the shell only knows the plain screen ids.
      if (parseMuseumHash(state.hashOnMount) && typeof root.setTimeout === "function") {
        const wanted = state.hashOnMount;
        root.setTimeout(() => { goToHash(wanted); }, 0);
      }
      const router = L().router;
      if (router && typeof router.current === "function" && router.current() === "museum") screen.show({});
    },
    show(params) {
      state.visible = true;
      if (!state.mounted) return;
      const wanted = tabFromParams(params);
      showTab(wanted || state.tab);
    },
    hide() {
      state.visible = false;
      destroyRoom();
      disconnectObserver();
      if (state.searchTimer && typeof root.clearTimeout === "function") root.clearTimeout(state.searchTimer);
      state.searchTimer = null;
    },
    render,
    destroy() {
      screen.hide();
      state.offs.splice(0).forEach((off) => off());
      state.domOffs.splice(0).forEach((off) => off());
      state.mounted = false;
    },
    // Pure helpers (also used by scripts/tests/museum-ui.test.js).
    helpers: {
      TABS,
      ERAS,
      PAGE_SIZE,
      cleanTab,
      docTitleFor,
      parseMuseumHash,
      isMuseumHash,
      buildMuseumHash,
      eraOfYear,
      groupTimeline,
      factsBetween,
      relatedByItem,
      findYearTarget,
      normalizeText,
      filterFacts,
      pickSurprise,
      rememberSeen,
      schoolTags,
      filterConcepts,
      uciSquares,
      conceptMoveSan,
    },
    TEXT,
    _state: state,
  };

  return screen;
});
