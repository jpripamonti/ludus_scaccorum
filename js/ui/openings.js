// Screen "openings": the openings the person plays in their downloaded games (Lichess or Chess.com, the same download
// and cache as "Your games"), grouped by family (the name before ":") and split by colour: games, results, the mistakes
// the search has confirmed in their first moves, and where the game most often leaves the book. Each family trains its
// opening-phase mistakes (Ludus.game.openOwnGamesSetup({ openings: { family, color } }): the own-games wizard and
// mistake search, restricted to those moves; the coach then names the opening and the book moves).
// Contract: docs/ARCHITECTURE.md sections 15 and 19; styles in css/openings.css (prefix .openings-).
//
//   Ludus.Screens.openings.mount(el)   el = #screen-openings. Cheap: the games are read in show().
//   Ludus.Screens.openings.show()      reads the games again (Ludus.game.openingsReport()) and repaints.
//   Ludus.Screens.openings.hide()      nothing runs in the background.
//   Ludus.Screens.openings.titleKey    "openings.title", the i18n key of document.title.
//
// The opening names are the dataset's (English); everything around them is in the page language. Built with
// Ludus.util.h only; without the game core or the openings module it says so instead of breaking. Pure helpers are
// exported under `helpers` for scripts/tests/openings-ui.test.js.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Screens = root.Ludus.Screens || {};
  root.Ludus.Screens.openings = api;
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

  // "1 game" / "{n} games": the singular lives under "<key>.one".
  function tCount(key, n, params) {
    return t(n === 1 ? `${key}.one` : key, Object.assign({ n }, params || {}));
  }

  // ---------- Text ----------

  const TEXT = {
    es: {
      "openings.title": "Tus aperturas",
      "openings.eyebrow": "Tus aperturas",
      "openings.heading": "Cómo te va en la apertura",
      "openings.sub": "Las aperturas de tus partidas descargadas, con el nombre del libro: cuántas jugaste, cómo te fue, dónde salís del libro y en cuáles te equivocás temprano.",
      "openings.loading": "Leyendo tus partidas…",
      "openings.error": "No pudimos leer las aperturas. Probá de nuevo en un rato.",
      "openings.retry": "Probar de nuevo",
      "openings.unavailable": "Esta parte no está disponible en este navegador.",
      "openings.empty.title": "Todavía no hay partidas descargadas",
      "openings.empty.body": "Descargá tus partidas de Lichess o Chess.com: te mostramos qué aperturas jugás, cómo te va con cada una y dónde salís del libro, y entrenás los errores de tus primeras jugadas.",
      "openings.empty.action": "Descargar y entrenar mis aperturas",
      "openings.source": "{provider} · {user} · {games}",
      "openings.games": "{n} partidas",
      "openings.games.one": "1 partida",
      "openings.saved": "descargadas {when}",
      "openings.stat.families": "Aperturas distintas",
      "openings.stat.early": "Partidas con un error en las primeras {max} jugadas",
      "openings.stat.leave": "Salís del libro, casi siempre, en la jugada",
      "openings.stat.none": "-",
      "openings.note": "Los errores cuentan solo las jugadas que el motor ya revisó: se suman a medida que entrenás.",
      "openings.train.all": "Entrenar mis aperturas",
      "openings.train": "Entrenar",
      "openings.train.aria": "Entrenar tus errores en {family} con {color}",
      "openings.color.w": "Con blancas",
      "openings.color.b": "Con negras",
      "openings.color.w.short": "blancas",
      "openings.color.b.short": "negras",
      "openings.results": "{w} ganadas, {d} tablas, {l} perdidas",
      "openings.results.aria": "Resultados: {w} ganadas, {d} tablas, {l} perdidas",
      "openings.mistakes": "{n} errores en tus primeras {max} jugadas",
      "openings.mistakes.one": "1 error en tus primeras {max} jugadas",
      "openings.mistakes.none": "Sin errores encontrados todavía en tus primeras {max} jugadas",
      "openings.leave": "Sale del libro en la jugada {move} ({count} de {games})",
      "openings.leave.you": "Salís vos del libro en {mine} de {games} partidas",
      "openings.leave.never": "Nunca salió del libro en las primeras jugadas",
      "openings.variations": "Variantes",
      "openings.variation.main": "Línea principal",
      "openings.provider.lichess": "Lichess",
      "openings.provider.chesscom": "Chess.com",
    },
    en: {
      "openings.title": "Your openings",
      "openings.eyebrow": "Your openings",
      "openings.heading": "How your openings go",
      "openings.sub": "The openings of your downloaded games, with their book names: how often you played each one, how it went, where you leave the book and where you go wrong early.",
      "openings.loading": "Reading your games…",
      "openings.error": "We could not read the openings. Try again in a while.",
      "openings.retry": "Try again",
      "openings.unavailable": "This part is not available in this browser.",
      "openings.empty.title": "No downloaded games yet",
      "openings.empty.body": "Download your Lichess or Chess.com games: we show you which openings you play, how each one goes and where you leave the book, and you train the mistakes of your first moves.",
      "openings.empty.action": "Download and train my openings",
      "openings.source": "{provider} · {user} · {games}",
      "openings.games": "{n} games",
      "openings.games.one": "1 game",
      "openings.saved": "downloaded {when}",
      "openings.stat.families": "Different openings",
      "openings.stat.early": "Games with a mistake in the first {max} moves",
      "openings.stat.leave": "You usually leave the book on move",
      "openings.stat.none": "-",
      "openings.note": "Mistakes count only the moves the engine has already checked: they add up as you train.",
      "openings.train.all": "Train my openings",
      "openings.train": "Train",
      "openings.train.aria": "Train your mistakes in the {family} with {color}",
      "openings.color.w": "With White",
      "openings.color.b": "With Black",
      "openings.color.w.short": "White",
      "openings.color.b.short": "Black",
      "openings.results": "{w} won, {d} drawn, {l} lost",
      "openings.results.aria": "Results: {w} won, {d} drawn, {l} lost",
      "openings.mistakes": "{n} mistakes in your first {max} moves",
      "openings.mistakes.one": "1 mistake in your first {max} moves",
      "openings.mistakes.none": "No mistakes found yet in your first {max} moves",
      "openings.leave": "Leaves the book on move {move} ({count} of {games})",
      "openings.leave.you": "You leave the book in {mine} of {games} games",
      "openings.leave.never": "Never left the book in the first moves",
      "openings.variations": "Variations",
      "openings.variation.main": "Main line",
      "openings.provider.lichess": "Lichess",
      "openings.provider.chesscom": "Chess.com",
    },
  };

  function registerText() {
    const i18n = L().i18n;
    if (i18n && typeof i18n.register === "function") i18n.register(TEXT);
  }
  registerText();

  // ---------- Pure helpers ----------

  // The most common move where the book ends, over every family (0: none left it).
  function overallLeaveMove(games) {
    const counts = new Map();
    (games || []).forEach((game) => {
      const ply = game && game.opening ? game.opening.leftPly : -1;
      if (!Number.isInteger(ply) || ply < 0) return;
      const move = Math.floor(ply / 2) + 1;
      counts.set(move, (counts.get(move) || 0) + 1);
    });
    let best = 0;
    let bestCount = 0;
    counts.forEach((count, move) => {
      if (count > bestCount || (count === bestCount && move < best)) {
        best = move;
        bestCount = count;
      }
    });
    return best;
  }

  // What the summary shows: { games, named, families, earlyGames, leaveMove }.
  function summaryModel(report, groups) {
    const games = report && Array.isArray(report.games) ? report.games : [];
    const named = games.filter((game) => game && game.opening);
    return {
      games: games.length,
      named: named.length,
      families: new Set((groups || []).map((group) => group.family)).size,
      earlyGames: games.filter((game) => game && game.earlyMistakes > 0).length,
      leaveMove: overallLeaveMove(named),
    };
  }

  // A variation as the card lists it: the part after "Family: " (the family is the card's title).
  function variationLabel(name, family) {
    const text = String(name || "");
    const prefix = `${family}: `;
    if (text === family) return t("openings.variation.main");
    return text.startsWith(prefix) ? text.slice(prefix.length) : text;
  }

  // The words of one family card.
  function cardModel(group, maxMove) {
    const max = maxMove || 12;
    const mistakes = group.earlyMistakes > 0
      ? tCount("openings.mistakes", group.earlyMistakes, { max })
      : t("openings.mistakes.none", { max });
    let leave;
    if (group.leftCount > 0 && group.leftMove > 0) {
      leave = t("openings.leave", { move: group.leftMove, count: group.leftMoveCount, games: group.games });
    } else {
      leave = t("openings.leave.never");
    }
    return {
      title: group.family,
      games: tCount("openings.games", group.games),
      results: t("openings.results", { w: group.wins, d: group.draws, l: group.losses }),
      resultsAria: t("openings.results.aria", { w: group.wins, d: group.draws, l: group.losses }),
      mistakes,
      hasMistakes: group.earlyMistakes > 0,
      leave,
      leaveYou: group.leftCount > 0 ? t("openings.leave.you", { mine: group.leftByMe, games: group.leftCount }) : "",
      variations: group.variations.slice(0, 4).map((entry) => ({ label: variationLabel(entry.name, group.family), eco: entry.eco, games: entry.games })),
    };
  }

  // ---------- State ----------

  const state = {
    mounted: false,
    container: null,
    visible: false,
    dirty: false,
    status: "idle", // idle | loading | error | empty | ok | unavailable
    report: null,
    groups: [],
    token: 0,
    offs: [],
  };

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function gameApi() {
    const game = L().game;
    return game && typeof game === "object" ? game : null;
  }

  function train(options) {
    const game = gameApi();
    if (!game || typeof game.openOwnGamesSetup !== "function") return;
    const report = state.report && state.report.status === "ok" ? state.report : null;
    try {
      game.openOwnGamesSetup({
        mode: "solo",
        openings: { family: options && options.family ? options.family : "", color: options && options.color ? options.color : "" },
        provider: report ? report.provider : undefined,
        username: report ? report.username : undefined,
      });
    } catch (error) {
      if (root.console && typeof root.console.error === "function") root.console.error("[Ludus.openings] the setup could not open", error);
    }
  }

  async function load() {
    const game = gameApi();
    const openings = L().Openings;
    const token = (state.token += 1);
    if (!game || typeof game.openingsReport !== "function" || !openings) {
      state.status = "unavailable";
      render();
      return;
    }
    state.status = "loading";
    render();
    let report = null;
    try {
      report = await game.openingsReport();
    } catch (error) {
      if (token !== state.token) return;
      if (root.console && typeof root.console.warn === "function") root.console.warn("[Ludus.openings] the report failed", error);
      state.status = "error";
      render();
      return;
    }
    if (token !== state.token) return;
    state.report = report;
    if (!report || report.status !== "ok") {
      state.status = "empty";
      state.groups = [];
    } else {
      state.status = "ok";
      state.groups = openings.groupByFamily(report.games);
    }
    render();
  }

  // ---------- DOM ----------

  function headNode() {
    return h("header", { class: "openings-head" },
      h("p", { class: "t-eyebrow" }, t("openings.eyebrow")),
      h("h1", { class: "screen-title openings-title", "data-screen-title": "", tabindex: "-1" }, t("openings.heading")),
      h("p", { class: "screen-sub openings-sub" }, t("openings.sub")));
  }

  function emptyNode() {
    const ui = L().ui;
    const action = { label: t("openings.empty.action"), kind: "primary", icon: "download", onClick: () => train({}) };
    if (ui && typeof ui.emptyState === "function") {
      return h("div", { class: "openings-empty" }, ui.emptyState({ icon: "rook", title: t("openings.empty.title"), body: t("openings.empty.body"), level: 2, action }));
    }
    return h("div", { class: "openings-empty" },
      h("h2", null, t("openings.empty.title")),
      h("p", null, t("openings.empty.body")),
      h("button", { type: "button", class: "btn btn-primary", onclick: action.onClick }, t("openings.empty.action")));
  }

  function savedWhen(ts) {
    const util = L().util;
    if (!ts || !util || typeof util.formatRelativeDays !== "function") return "";
    try {
      return t("openings.saved", { when: util.formatRelativeDays(ts, lang()) });
    } catch (error) {
      return "";
    }
  }

  function statNode(label, value) {
    return h("div", { class: "openings-stat" }, h("dt", null, label), h("dd", null, value));
  }

  function summaryNode(report, model) {
    const provider = report.provider === "chesscom" ? t("openings.provider.chesscom") : t("openings.provider.lichess");
    const when = savedWhen(report.fetchedAt);
    const source = t("openings.source", { provider, user: report.username, games: tCount("openings.games", model.games) });
    return h("section", { class: "openings-summary card", "aria-labelledby": "openings-summary-source" },
      h("p", { class: "openings-source", id: "openings-summary-source" }, icon("download", { size: 16 }), h("span", null, when ? `${source} · ${when}` : source)),
      h("dl", { class: "openings-stats" },
        statNode(t("openings.stat.families"), String(model.families)),
        statNode(t("openings.stat.early", { max: report.maxMove }), `${model.earlyGames} / ${model.games}`),
        statNode(t("openings.stat.leave"), model.leaveMove > 0 ? String(model.leaveMove) : t("openings.stat.none"))),
      h("div", { class: "openings-actions" },
        h("button", { type: "button", class: "btn btn-primary btn-lg", "data-openings-train": "all", onclick: () => train({}) },
          icon("play", { size: 20 }), h("span", { class: "btn-label" }, t("openings.train.all")))),
      h("p", { class: "openings-note" }, icon("info", { size: 14 }), h("span", null, t("openings.note"))));
  }

  // Won / drawn / lost as a bar whose segments carry their own numbers (never colour alone).
  function resultsBar(group, model) {
    const total = Math.max(1, group.wins + group.draws + group.losses);
    const seg = (kind, n) => (n > 0
      ? h("span", { class: `openings-bar-seg openings-bar-${kind}`, style: { flexGrow: String(n / total) } }, String(n))
      : null);
    return h("div", { class: "openings-results" },
      h("div", { class: "openings-bar", role: "img", "aria-label": model.resultsAria }, seg("win", group.wins), seg("draw", group.draws), seg("loss", group.losses)),
      h("p", { class: "openings-results-text", "aria-hidden": "true" }, model.results));
  }

  function familyCard(group, maxMove) {
    const model = cardModel(group, maxMove);
    const colorWord = t(`openings.color.${group.color}.short`);
    const id = `openings-${group.color}-${String(group.family).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    return h("li", { class: "openings-card card", "data-family": group.family, "data-color": group.color },
      h("div", { class: "openings-card-head" },
        h("h3", { class: "openings-card-title", id }, model.title),
        h("span", { class: "openings-card-games" }, model.games)),
      resultsBar(group, model),
      h("ul", { class: "openings-facts" },
        h("li", { class: model.hasMistakes ? "openings-fact is-warn" : "openings-fact" }, icon(model.hasMistakes ? "alert" : "check", { size: 16 }), h("span", null, model.mistakes)),
        h("li", { class: "openings-fact" }, icon("flag", { size: 16 }), h("span", null, model.leave)),
        model.leaveYou ? h("li", { class: "openings-fact" }, icon("user", { size: 16 }), h("span", null, model.leaveYou)) : null),
      model.variations.length
        ? h("div", { class: "openings-vars" },
          h("p", { class: "openings-vars-title" }, t("openings.variations")),
          h("ul", { class: "openings-vars-list" }, model.variations.map((entry) => h("li", { class: "openings-var" },
            entry.eco ? h("span", { class: "openings-var-eco" }, entry.eco) : null,
            h("span", { class: "openings-var-name" }, entry.label),
            h("span", { class: "openings-var-n" }, `×${entry.games}`)))))
        : null,
      h("div", { class: "openings-card-foot" },
        h("button", {
          type: "button",
          class: "btn btn-secondary",
          "data-openings-train": group.family,
          "aria-label": t("openings.train.aria", { family: group.family, color: colorWord }),
          "aria-describedby": id,
          onclick: () => train({ family: group.family, color: group.color }),
        }, icon("target", { size: 18 }), h("span", { class: "btn-label" }, t("openings.train")))));
  }

  function colorSection(color, groups, maxMove) {
    const list = groups.filter((group) => group.color === color);
    if (!list.length) return null;
    const games = list.reduce((sum, group) => sum + group.games, 0);
    const titleId = `openings-color-${color}`;
    return h("section", { class: "openings-color", "data-color": color, "aria-labelledby": titleId },
      h("h2", { class: "openings-h2", id: titleId },
        h("span", { class: `openings-swatch openings-swatch-${color}`, "aria-hidden": "true" }),
        h("span", null, t(`openings.color.${color}`)),
        h("span", { class: "openings-h2-count" }, tCount("openings.games", games))),
      h("ul", { class: "openings-list" }, list.map((group) => familyCard(group, maxMove))));
  }

  function render() {
    if (!state.mounted || !state.container || !getDoc() || !L().util) return;
    const container = state.container;
    clear(container);
    const parts = [headNode()];
    if (state.status === "loading" || state.status === "idle") {
      parts.push(h("p", { class: "openings-loading", role: "status" }, t("openings.loading")));
    } else if (state.status === "unavailable") {
      parts.push(h("p", { class: "openings-loading" }, icon("info", { size: 16 }), t("openings.unavailable")));
    } else if (state.status === "error") {
      parts.push(h("div", { class: "openings-error", role: "alert" },
        h("p", null, t("openings.error")),
        h("button", { type: "button", class: "btn btn-secondary", onclick: () => void load() }, icon("refresh", { size: 18 }), h("span", { class: "btn-label" }, t("openings.retry")))));
    } else if (state.status === "empty") {
      parts.push(emptyNode());
    } else {
      const report = state.report;
      const model = summaryModel(report, state.groups);
      parts.push(summaryNode(report, model));
      parts.push(colorSection("w", state.groups, report.maxMove));
      parts.push(colorSection("b", state.groups, report.maxMove));
    }
    container.appendChild(h("div", { class: "openings" }, parts));
  }

  function on(evt, fn) {
    const bus = L().bus;
    if (bus && typeof bus.on === "function") state.offs.push(bus.on(evt, fn));
  }

  const screen = {
    titleKey: "openings.title",
    title: "openings.title",
    mount(container) {
      if (!getDoc() || !container || !L().util) return;
      if (state.mounted && state.container === container) {
        render();
        return;
      }
      state.container = container;
      state.mounted = true;
      container.appendChild(h("div", { class: "openings" }, headNode()));
      on("language:changed", () => {
        registerText();
        if (state.visible) render();
        else state.dirty = true;
      });
      // A session finds mistakes (and a new download brings games): read them again next time.
      on("session:completed", () => {
        state.dirty = true;
      });
      on("profile:changed", () => {
        state.dirty = true;
      });
    },
    show() {
      state.visible = true;
      state.dirty = false;
      if (!state.mounted) return;
      void load();
    },
    hide() {
      state.visible = false;
      state.token += 1;
    },
    render() {
      if (state.mounted) render();
    },
    destroy() {
      screen.hide();
      state.offs.splice(0).forEach((off) => off());
      state.mounted = false;
    },
    helpers: { summaryModel, cardModel, variationLabel, overallLeaveMove },
    TEXT,
    _state: state,
  };

  return screen;
});
