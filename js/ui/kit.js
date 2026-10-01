// Shared UI kit (Ludus.ui): the building blocks every screen uses, so that a
// toast, a dialog, a gauge or a mini board looks and behaves the same
// everywhere. Contract: docs/ARCHITECTURE.md sections 15 and 20; the classes
// these functions emit are defined in css/system.css.
//
//   Ludus.ui.icon(name, { size, title, className })      inline SVG, 24px grid, stroke icons
//   Ludus.ui.toast(message, { kind, duration, action, persistent, focus })  kind: info|success|warn|error|achievement|levelup; queue of 3
//   Ludus.ui.modal({ title, body, actions, onClose, dismissible, size, variant })
//   Ludus.ui.confirm({ title, body, confirmLabel, cancelLabel, danger }) -> Promise<boolean>
//   Ludus.ui.sheet(opts)                                 modal that is a bottom sheet on phones
//   Ludus.ui.avatar(profile, { size })                   initials on the profile colour
//   Ludus.ui.levelBadge(level)                           piece + title of a Profile.levelFor() result
//   Ludus.ui.gauge({ value, max, label, size, tone })    animated radial score gauge
//   Ludus.ui.ring(progress, { size, label })             small progress ring
//   Ludus.ui.sparkline(values, { width, height, min, max, label })
//   Ludus.ui.barChart(items, { width, height, max, label, format, fill })
//   Ludus.ui.chip(label, { tone, icon }) / badge(label, { tone }) / qualityBadge(code)
//   Ludus.ui.button(label, { kind, size, icon, onClick, href, loading, block })
//   Ludus.ui.iconButton(icon, label, { kind, size, onClick })
//   Ludus.ui.progress(value, { label, tone, size }) / stat({ label, value, hint, icon, tone })
//   Ludus.ui.skeleton({ kind, lines }) / spinner()
//   Ludus.ui.emptyState({ icon, title, body, action, level })
//   Ludus.ui.miniBoard(fen, { size, orientation, coords, highlight, arrows, theme, label })
//   Ludus.ui.bindSlider(input)                           paints the filled part of a .slider
//
// Every node is built with Ludus.util.h (strings are text nodes, never HTML).
// Nothing runs at load time except registering i18n text, and every function
// degrades safely without a DOM (Node tests use a fake one): where a real
// browser feature is missing (matchMedia, requestAnimationFrame, focus) the
// code skips it instead of throwing.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.ui = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  // ---------- Environment (all of it resolved at call time) ----------

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
    if (!util || typeof util.h !== "function") throw new Error("Ludus.ui needs Ludus.util.h (load js/ludus.js first)");
    return util.h(tag, attrs, ...children);
  }

  function t(key, params) {
    const i18n = L().i18n;
    return i18n && typeof i18n.t === "function" ? i18n.t(key, params) : String(key);
  }

  function lang() {
    const i18n = L().i18n;
    return i18n && typeof i18n.lang === "function" ? i18n.lang() : "es";
  }

  // Timers are injectable so the tests can drive toasts without waiting.
  const timers = {
    setTimeout: (fn, ms) => root.setTimeout(fn, ms),
    clearTimeout: (id) => root.clearTimeout(id),
    raf: (fn) => (typeof root.requestAnimationFrame === "function" ? root.requestAnimationFrame(fn) : root.setTimeout(fn, 16)),
    now: () => Date.now(),
  };

  function setTimers(next) {
    Object.keys(next || {}).forEach((key) => {
      if (typeof next[key] === "function") timers[key] = next[key];
    });
  }

  // data-motion="reduce" (Settings) or the OS preference: no decorative motion.
  function reducedMotion() {
    try {
      const doc = getDoc();
      const el = doc && doc.documentElement;
      if (el && typeof el.getAttribute === "function" && el.getAttribute("data-motion") === "reduce") return true;
    } catch (error) {
      // fall through
    }
    try {
      return Boolean(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (error) {
      return false;
    }
  }

  function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  const fmt = (n) => String(Math.round(n * 100) / 100);
  const cls = (...names) => names.filter(Boolean).join(" ");

  // ---------- i18n ----------

  const TEXT = {
    es: {
      "ui.close": "Cerrar",
      "ui.cancel": "Cancelar",
      "ui.accept": "Aceptar",
      "ui.confirm": "Confirmar",
      "ui.retry": "Reintentar",
      "ui.loading": "Cargando…",
      "ui.toast.region": "Avisos",
      "ui.toast.dismiss": "Cerrar aviso",
      "ui.toast.kind.info": "Información",
      "ui.toast.kind.success": "Listo",
      "ui.toast.kind.warn": "Atención",
      "ui.toast.kind.error": "Error",
      "ui.toast.kind.achievement": "Logro",
      "ui.toast.kind.levelup": "Nivel",
      "ui.gauge.aria": "{label}: {value} de {max}",
      "ui.gauge.ariaNoLabel": "{value} de {max}",
      "ui.ring.aria": "{label}: {percent}%",
      "ui.ring.ariaNoLabel": "{percent}%",
      "ui.sparkline.aria": "Tendencia de {n} valores: de {first} a {last} (mínimo {min}, máximo {max}).",
      "ui.sparkline.empty": "Todavía no hay datos para mostrar una tendencia.",
      "ui.chart.empty": "No hay datos para mostrar.",
      "ui.chart.table": "Datos del gráfico",
      "ui.chart.colLabel": "Categoría",
      "ui.chart.colValue": "Valor",
      "ui.miniBoard.aria": "{label}Posición de ajedrez: juegan las {side}. {white} {black}",
      "ui.miniBoard.empty": "{label}Tablero sin piezas.",
      "ui.miniBoard.invalid": "{label}Posición no válida.",
      "ui.miniBoard.white": "Blancas: {list}.",
      "ui.miniBoard.black": "Negras: {list}.",
      "ui.side.w": "blancas",
      "ui.side.b": "negras",
      "ui.piece.K": "Rey",
      "ui.piece.Q": "Dama",
      "ui.piece.R": "Torre",
      "ui.piece.B": "Alfil",
      "ui.piece.N": "Caballo",
      "ui.piece.P": "Peón",
      "ui.level.aria": "Nivel {title}",
    },
    en: {
      "ui.close": "Close",
      "ui.cancel": "Cancel",
      "ui.accept": "OK",
      "ui.confirm": "Confirm",
      "ui.retry": "Try again",
      "ui.loading": "Loading…",
      "ui.toast.region": "Notifications",
      "ui.toast.dismiss": "Dismiss notification",
      "ui.toast.kind.info": "Information",
      "ui.toast.kind.success": "Done",
      "ui.toast.kind.warn": "Warning",
      "ui.toast.kind.error": "Error",
      "ui.toast.kind.achievement": "Achievement",
      "ui.toast.kind.levelup": "Level",
      "ui.gauge.aria": "{label}: {value} out of {max}",
      "ui.gauge.ariaNoLabel": "{value} out of {max}",
      "ui.ring.aria": "{label}: {percent}%",
      "ui.ring.ariaNoLabel": "{percent}%",
      "ui.sparkline.aria": "Trend of {n} values: from {first} to {last} (minimum {min}, maximum {max}).",
      "ui.sparkline.empty": "There is no data yet to show a trend.",
      "ui.chart.empty": "There is no data to show.",
      "ui.chart.table": "Chart data",
      "ui.chart.colLabel": "Category",
      "ui.chart.colValue": "Value",
      "ui.miniBoard.aria": "{label}Chess position: {side} to move. {white} {black}",
      "ui.miniBoard.empty": "{label}Board without pieces.",
      "ui.miniBoard.invalid": "{label}Invalid position.",
      "ui.miniBoard.white": "White: {list}.",
      "ui.miniBoard.black": "Black: {list}.",
      "ui.side.w": "White",
      "ui.side.b": "Black",
      "ui.piece.K": "King",
      "ui.piece.Q": "Queen",
      "ui.piece.R": "Rook",
      "ui.piece.B": "Bishop",
      "ui.piece.N": "Knight",
      "ui.piece.P": "Pawn",
      "ui.level.aria": "Level {title}",
    },
  };

  function registerText() {
    const i18n = L().i18n;
    if (i18n && typeof i18n.register === "function") i18n.register(TEXT);
  }
  registerText();

  // ---------- Icons ----------
  //
  // 24x24 grid, 1.75 stroke, round caps and joins, currentColor. Each icon is a
  // list of shapes: a string is a path "d"; { c:[cx,cy,r] } a circle;
  // { dot:[cx,cy] } a filled dot; { r:[x,y,w,h,rx] } a rect; { l:[x1,y1,x2,y2] }
  // a line. Everything is built through Ludus.util.h, never parsed from text.

  function gearPath() {
    // Eight trapezoidal teeth around a ring, computed once so the path is exact.
    const cx = 12;
    const cy = 12;
    const rOut = 9.2;
    const rIn = 7.2;
    const teeth = 8;
    const step = (Math.PI * 2) / teeth;
    const pts = [];
    for (let i = 0; i < teeth; i += 1) {
      const a = i * step - Math.PI / 2;
      [[-0.30, rIn], [-0.17, rOut], [0.17, rOut], [0.30, rIn]].forEach(([offset, radius]) => {
        const angle = a + offset * (step / 0.6) * 0.6;
        pts.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
      });
    }
    return `M${pts.map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join("L")}Z`;
  }

  function starPath() {
    const cx = 12;
    const cy = 12.7;
    const pts = [];
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? 9 : 3.9;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
    }
    return `M${pts.map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join("L")}Z`;
  }

  // A sword drawn from the top left to the bottom right, mirrored for the other.
  const SWORD = ["M4.5 4.5L15.5 15.5", "M12.7 18.3L18.3 12.7", "M15.5 15.5L19.8 19.8"];
  const mirrorPath = (d) => d.replace(/([ML])\s*(-?[\d.]+)\s+(-?[\d.]+)/g, (_, cmd, x, y) => `${cmd}${fmt(24 - Number(x))} ${y}`);

  const ICONS = {
    home: ["M3.5 11 12 3.8 20.5 11", "M5.5 9.5V19a1 1 0 0 0 1 1H10v-5.5h4V20h3.5a1 1 0 0 0 1-1V9.5"],
    book: ["M12 6.6C10.6 5.4 8.4 4.8 5 4.8v13.4c3.4 0 5.6.6 7 1.8 1.4-1.2 3.6-1.8 7-1.8V4.8c-3.4 0-5.6.6-7 1.8Z", "M12 6.6V20"],
    target: [{ c: [12, 12, 9] }, { c: [12, 12, 5] }, { dot: [12, 12] }],
    chart: ["M4 4.5V19a1 1 0 0 0 1 1h15", "M8.5 16v-4.5", "M12.5 16V8", "M16.5 16v-6.5"],
    settings: [gearPath(), { c: [12, 12, 2.9] }],
    user: [{ c: [12, 8.2, 3.7] }, "M5 20c0-3.7 3.1-6 7-6s7 2.3 7 6"],
    users: [{ c: [9, 8.5, 3.2] }, "M3 19.5c0-3.2 2.6-5.3 6-5.3s6 2.1 6 5.3", { c: [17, 9.5, 2.6] }, "M17.6 14.3c2.3.4 3.9 2 3.9 4.7"],
    flame: ["M12 3c.6 3 4.6 5 4.6 10a4.6 4.6 0 0 1-9.2 0c0-1.7.6-3 1.6-4 .3 1.3 1 1.9 1.8 2.1C10.6 8.5 11 5.5 12 3Z"],
    star: [starPath()],
    trophy: ["M8 4h8v5a4 4 0 0 1-8 0V4Z", "M8 6H4.5v1.4A3.6 3.6 0 0 0 8.2 11", "M16 6h3.5v1.4A3.6 3.6 0 0 1 15.8 11", "M12 13v4", "M9 20.5h6", "M10 17h4v3.5h-4Z"],
    clock: [{ c: [12, 12, 9] }, "M12 7v5l3.2 2"],
    lightbulb: ["M9.2 17.5h5.6", "M10.2 20.5h3.6", "M12 3.5a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3.5Z"],
    "chevron-left": ["M14.5 6 8.5 12l6 6"],
    "chevron-right": ["M9.5 6l6 6-6 6"],
    "chevron-down": ["M6 9.5l6 6 6-6"],
    "arrow-right": ["M4.5 12h15", "M13.5 6l6 6-6 6"],
    play: ["M8 5.4v13.2a.6.6 0 0 0 .92.5l10.3-6.6a.6.6 0 0 0 0-1L8.92 4.9A.6.6 0 0 0 8 5.4Z"],
    pause: ["M9 5.5v13", "M15 5.5v13"],
    check: ["M5 12.5l4.5 4.5L19 7.5"],
    x: ["M6 6l12 12", "M18 6 6 18"],
    sparkles: ["M10.5 4c.6 3.7 2 5.1 5.7 5.7-3.7.6-5.1 2-5.7 5.7-.6-3.7-2-5.1-5.7-5.7C8.5 9.1 9.9 7.7 10.5 4Z", "M18 14.6c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5Z"],
    columns: ["M3.5 9.2 12 4l8.5 5.2", "M4.5 9.7h15", "M6.5 12.5v5.5", "M10 12.5v5.5", "M14 12.5v5.5", "M17.5 12.5v5.5", "M3.8 20.2h16.4"],
    swords: [SWORD[0], SWORD[1], SWORD[2], mirrorPath(SWORD[0]), mirrorPath(SWORD[1]), mirrorPath(SWORD[2])],
    download: ["M12 4v11", "M7.5 10.6 12 15l4.5-4.4", "M5 19.5h14"],
    upload: ["M12 15V4", "M7.5 8.4 12 4l4.5 4.4", "M5 19.5h14"],
    globe: [{ c: [12, 12, 9] }, "M3 12h18", "M12 3c2.6 2.6 3.8 5.6 3.8 9S14.6 18.4 12 21c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z"],
    cloud: ["M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.9 8.6 4.9 4.9 0 0 1 17 18.5H7Z"],
    lock: [{ r: [5, 10.5, 14, 9.5, 2.2] }, "M8 10.5V8a4 4 0 0 1 8 0v2.5", { dot: [12, 15.2] }],
    refresh: ["M19.5 8A8 8 0 0 0 5 9.5", "M4.5 4.8v4.7H9", "M4.5 16A8 8 0 0 0 19 14.5", "M19.5 19.2v-4.7H15"],
    flag: ["M6 21V4", "M6 4.5h11l-2.5 4 2.5 4H6"],
    eye: ["M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z", { c: [12, 12, 3] }],
    undo: ["M9 6 4.5 10.5 9 15", "M4.5 10.5H14a5 5 0 0 1 0 10h-4"],
    info: [{ c: [12, 12, 9] }, "M12 11v5.5", { dot: [12, 7.9] }],
    alert: ["M10.3 4.9 3.1 17.4A2 2 0 0 0 4.8 20.5h14.4a2 2 0 0 0 1.7-3.1L13.7 4.9a2 2 0 0 0-3.4 0Z", "M12 10v4", { dot: [12, 17.3] }],
    plus: ["M12 5v14", "M5 12h14"],
    more: [{ dot: [5.5, 12] }, { dot: [12, 12] }, { dot: [18.5, 12] }],
    shield: ["M12 3.5 5 6v5.5c0 4.2 2.9 7.4 7 9 4.1-1.6 7-4.8 7-9V6l-7-2.5Z", "M9 12l2.2 2.2L15.5 10"],
    calendar: [{ r: [4, 5.5, 16, 14.5, 2.2] }, "M4 10h16", "M8.5 3.5v4", "M15.5 3.5v4"],
    history: ["M4.5 12A7.5 7.5 0 1 0 7 6.4", "M4.5 4.5v3.2h3.2", "M12 8v4.2l2.8 1.6"],
    external: ["M14 4.5h5.5V10", "M19.5 4.5 11 13", "M17.5 14v4.5a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1H10"],
    rook: ["M6.5 20h11", "M8 20v-2.4l1.2-1.6V10.5h5.6V16l1.2 1.6V20", "M8.2 10.5V5h1.8v1.6h1.2V5h1.6v1.6h1.2V5h1.8v5.5", "M8.2 10.5h7.6"],
  };
  ICONS.museum = ICONS.columns;

  function iconNames() {
    return Object.keys(ICONS);
  }

  function shapeNode(shape) {
    if (typeof shape === "string") return h("svg:path", { d: shape });
    if (shape && shape.c) return h("svg:circle", { cx: shape.c[0], cy: shape.c[1], r: shape.c[2] });
    if (shape && shape.dot) return h("svg:circle", { cx: shape.dot[0], cy: shape.dot[1], r: 1.15, fill: "currentColor", stroke: "none" });
    if (shape && shape.r) return h("svg:rect", { x: shape.r[0], y: shape.r[1], width: shape.r[2], height: shape.r[3], rx: shape.r[4] });
    if (shape && shape.l) return h("svg:line", { x1: shape.l[0], y1: shape.l[1], x2: shape.l[2], y2: shape.l[3] });
    return null;
  }

  // Decorative by default (aria-hidden); pass `title` when the icon is the only
  // thing that says what a control does (better: label the control instead).
  function icon(name, options) {
    const opts = options || {};
    const size = clamp(opts.size === undefined ? 20 : opts.size, 8, 256);
    const shapes = Object.prototype.hasOwnProperty.call(ICONS, name) ? ICONS[name] : [];
    const attrs = {
      class: cls("ui-icon", `ui-icon-${String(name).replace(/[^a-z0-9-]/gi, "")}`, opts.className),
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": opts.strokeWidth || 1.75,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      focusable: "false",
    };
    if (opts.title) {
      attrs.role = "img";
      attrs["aria-label"] = String(opts.title);
    } else {
      attrs["aria-hidden"] = "true";
    }
    return h("svg:svg", attrs, shapes.map(shapeNode));
  }

  // ---------- Small components ----------

  function toneClass(prefix, tone) {
    return /^[a-z][a-z-]*$/.test(String(tone || "")) ? `${prefix}-${tone}` : "";
  }

  function chip(label, options) {
    const opts = options || {};
    return h("span", { class: cls("chip", toneClass("chip", opts.tone), opts.className) },
      opts.icon ? icon(opts.icon, { size: 14 }) : null,
      String(label === undefined || label === null ? "" : label));
  }

  function badge(label, options) {
    const opts = options || {};
    return h("span", { class: cls("badge", toneClass("badge", opts.tone), opts.className) }, String(label));
  }

  const QUALITY_CODES = ["brilliant", "great", "perfect", "very_good", "good", "interesting", "dubious", "bad", "blunder", "no_move"];
  const QUALITY_GLYPH = {
    brilliant: "!!", great: "!", perfect: "★", very_good: "✓", good: "○", interesting: "!?", dubious: "?!", bad: "?", blunder: "??", no_move: "—",
  };

  // Colour is never the only signal: the badge always carries the glyph and the
  // label (Scoring registers "quality.<code>").
  function qualityBadge(code, options) {
    const opts = options || {};
    const known = QUALITY_CODES.includes(code) ? code : "no_move";
    const scoring = L().Scoring;
    let glyph = QUALITY_GLYPH[known];
    if (scoring && typeof scoring.qualityMeta === "function") {
      try {
        glyph = scoring.qualityMeta(known).glyph || glyph;
      } catch (error) {
        // keep the local glyph
      }
    }
    const label = t(`quality.${known}`);
    return h("span", { class: cls("badge", "q-badge", `q-${known}`, opts.className) },
      h("span", { class: "q-glyph", "aria-hidden": "true" }, glyph),
      opts.glyphOnly ? h("span", { class: "sr-only" }, label) : label);
  }

  function spinner(options) {
    const opts = options || {};
    return h("span", { class: cls("spinner", opts.className), role: "status", "aria-label": opts.label || t("ui.loading") });
  }

  function button(label, options) {
    const opts = options || {};
    const attrs = {
      class: cls("btn", toneClass("btn", opts.kind || "secondary"), toneClass("btn", opts.size), opts.block && "btn-block", opts.className),
    };
    const tag = opts.href ? "a" : "button";
    if (opts.href) attrs.href = opts.href;
    else attrs.type = opts.type || "button";
    if (opts.disabled) {
      if (opts.href) attrs["aria-disabled"] = "true";
      else attrs.disabled = true;
    }
    if (opts.loading) attrs["aria-busy"] = "true";
    if (opts.id) attrs.id = opts.id;
    if (opts.ariaLabel) attrs["aria-label"] = opts.ariaLabel;
    if (typeof opts.onClick === "function") attrs.onclick = opts.onClick;
    return h(tag, attrs, opts.icon ? icon(opts.icon, { size: opts.size === "lg" ? 22 : 18 }) : null,
      label === undefined || label === null || label === "" ? null : h("span", { class: "btn-label" }, String(label)));
  }

  function iconButton(name, label, options) {
    const opts = options || {};
    const attrs = {
      class: cls("btn", "btn-icon", toneClass("btn", opts.kind || "ghost"), toneClass("btn", opts.size), opts.className),
      type: "button",
      "aria-label": String(label),
    };
    if (typeof opts.onClick === "function") attrs.onclick = opts.onClick;
    if (opts.disabled) attrs.disabled = true;
    if (opts.id) attrs.id = opts.id;
    return h("button", attrs, icon(name, { size: opts.iconSize || 20 }));
  }

  // value 0..1 (or use `max`). role="progressbar" only when a label names it.
  function progress(value, options) {
    const opts = options || {};
    const max = Number(opts.max) > 0 ? Number(opts.max) : 1;
    const ratio = clamp(Number(value) / max, 0, 1);
    const attrs = { class: cls("progress", toneClass("progress", opts.tone), toneClass("progress", opts.size)) };
    if (opts.label) {
      attrs.role = "progressbar";
      attrs["aria-label"] = String(opts.label);
      attrs["aria-valuemin"] = 0;
      attrs["aria-valuemax"] = 100;
      attrs["aria-valuenow"] = Math.round(ratio * 100);
    } else {
      attrs["aria-hidden"] = "true";
    }
    return h("div", attrs, h("div", { class: "progress-track" }, h("div", { class: "progress-bar", style: { width: `${fmt(ratio * 100)}%` } })));
  }

  function stat(options) {
    const opts = options || {};
    return h("div", { class: cls("stat", toneClass("stat", opts.tone), opts.className) },
      h("div", { class: "stat-label" }, opts.icon ? icon(opts.icon, { size: 16 }) : null, String(opts.label === undefined ? "" : opts.label)),
      h("div", { class: "stat-value" }, String(opts.value === undefined ? "" : opts.value)),
      opts.hint ? h("div", { class: "stat-hint" }, String(opts.hint)) : null);
  }

  function skeleton(options) {
    const opts = options || {};
    const kind = opts.kind || "text";
    if (kind === "card") {
      return h("div", { class: "skeleton skeleton-card", "aria-hidden": "true" });
    }
    if (kind === "circle") return h("span", { class: "skeleton skeleton-circle", "aria-hidden": "true" });
    const lines = clamp(opts.lines === undefined ? 1 : opts.lines, 1, 12);
    const nodes = [];
    for (let i = 0; i < lines; i += 1) {
      nodes.push(h("span", { class: cls("skeleton", kind === "title" ? "skeleton-title" : "skeleton-text", i === lines - 1 && lines > 1 && "is-short") }));
    }
    return h("div", { class: "skeleton-group", "aria-hidden": "true" }, nodes);
  }

  function emptyState(options) {
    const opts = options || {};
    const level = clamp(opts.level === undefined ? 3 : opts.level, 2, 6);
    let actionNode = null;
    if (opts.action && opts.action.label) {
      actionNode = button(opts.action.label, {
        kind: opts.action.kind || "primary",
        onClick: opts.action.onClick,
        href: opts.action.href,
        icon: opts.action.icon,
      });
    }
    return h("div", { class: cls("empty", opts.className) },
      h("div", { class: "empty-icon", "aria-hidden": "true" }, icon(opts.icon || "sparkles", { size: 28 })),
      h(`h${Math.round(level)}`, { class: "empty-title" }, String(opts.title === undefined ? "" : opts.title)),
      opts.body ? h("p", { class: "empty-body" }, String(opts.body)) : null,
      actionNode ? h("div", { class: "empty-actions" }, actionNode) : null);
  }

  // ---------- Avatar and level badge ----------

  const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

  function readableOn(hex) {
    const channel = (i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
    // White text unless the colour is light enough that ink reads better.
    return (1.05) / (luminance + 0.05) >= 4.5 ? "#ffffff" : "#0b1118";
  }

  function initialsOf(name) {
    const words = String(name === undefined || name === null ? "" : name).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "?";
    const first = Array.from(words[0])[0] || "?";
    const second = words.length > 1 ? Array.from(words[words.length - 1])[0] : "";
    return (first + (second || "")).toUpperCase();
  }

  function avatar(profile, options) {
    const opts = options || {};
    const size = clamp(opts.size === undefined ? 36 : opts.size, 16, 160);
    const person = profile && typeof profile === "object" ? profile : {};
    const color = typeof person.color === "string" && HEX_COLOR.test(person.color) ? person.color.toLowerCase() : "#2b5f8a";
    const attrs = {
      class: cls("avatar", opts.className),
      style: { "--avatar-size": `${size}px`, "--avatar-bg": color, "--avatar-fg": readableOn(color) },
    };
    if (opts.label) {
      attrs.role = "img";
      attrs["aria-label"] = String(person.name || "");
    } else {
      attrs["aria-hidden"] = "true";
    }
    return h("span", attrs, initialsOf(person.name));
  }

  const RANK_PIECE = { pawn: "P", knight: "N", bishop: "B", rook: "R", queen: "Q", king: "K", grandmaster: "K" };
  const PIECE_BASE = "assets/pieces/cburnett/";

  function levelTitle(level) {
    const info = level && typeof level === "object" ? level : {};
    if (typeof info.title === "string" && info.title) return info.title;
    const i18n = L().i18n;
    const rankName = info.rankKey && i18n ? i18n.t(info.rankKey) : String(info.rank || "");
    return `${rankName} ${info.roman || ""}`.trim();
  }

  // `level` is a Profile.levelFor(xp) result: { rank, rankKey, roman, level, title? }.
  function levelBadge(level) {
    const info = level && typeof level === "object" ? level : {};
    const piece = RANK_PIECE[info.rank] || "P";
    const title = levelTitle(info);
    return h("span", { class: cls("level-badge", info.rank === "grandmaster" && "is-gm"), "data-rank": String(info.rank || "") },
      h("img", { class: "level-badge-piece", src: `${PIECE_BASE}w${piece}.svg`, alt: "", width: 18, height: 18 }),
      h("span", { class: "level-badge-title" }, title));
  }

  // ---------- Gauge and ring ----------

  function afterPaint(fn) {
    if (reducedMotion() || !getDoc()) {
      fn(true);
      return;
    }
    timers.raf(() => timers.raf(() => fn(false)));
  }

  function gaugeTone(ratio) {
    if (ratio >= 0.85) return "perfect";
    if (ratio >= 0.65) return "good";
    if (ratio >= 0.4) return "dubious";
    return "blunder";
  }

  // A 270 degree radial gauge (open at the bottom). The arc grows from 0 to the
  // value with a CSS transition unless motion is reduced. The text alternative
  // is one label on the wrapper; the SVG itself is hidden from assistive tech.
  function gauge(options) {
    const opts = options || {};
    const max = Number(opts.max) > 0 ? Number(opts.max) : 10;
    const value = clamp(opts.value, 0, max);
    const ratio = max ? value / max : 0;
    const size = clamp(opts.size === undefined ? 120 : opts.size, 48, 480);
    const stroke = Math.max(6, Math.round(size * 0.09));
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const sweep = circumference * 0.75; // visible arc length
    const tone = /^[a-z][a-z-]*$/.test(String(opts.tone || "")) ? opts.tone : gaugeTone(ratio);
    const centre = size / 2;
    const rotate = `rotate(135 ${fmt(centre)} ${fmt(centre)})`;
    const plain = Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
    const shown = lang() === "es" ? plain.replace(".", ",") : plain;
    const track = h("svg:circle", {
      class: "gauge-track", cx: fmt(centre), cy: fmt(centre), r: fmt(radius), fill: "none", "stroke-width": stroke,
      "stroke-linecap": "round", "stroke-dasharray": `${fmt(sweep)} ${fmt(circumference)}`, transform: rotate,
    });
    const arc = h("svg:circle", {
      class: "gauge-arc", cx: fmt(centre), cy: fmt(centre), r: fmt(radius), fill: "none", "stroke-width": stroke,
      "stroke-linecap": "round", "stroke-dasharray": `${fmt(sweep)} ${fmt(circumference)}`, "stroke-dashoffset": fmt(sweep), transform: rotate,
    });
    const target = sweep * (1 - ratio);
    afterPaint((instant) => {
      if (instant) arc.classList.add("is-static");
      arc.setAttribute("stroke-dashoffset", fmt(target));
    });
    const svg = h("svg:svg", { class: "gauge-svg", width: size, height: size, viewBox: `0 0 ${size} ${size}`, "aria-hidden": "true", focusable: "false" }, track, arc);
    const label = opts.label ? String(opts.label) : "";
    const aria = label
      ? t("ui.gauge.aria", { label, value: shown, max: fmt(max) })
      : t("ui.gauge.ariaNoLabel", { value: shown, max: fmt(max) });
    return h("div", { class: cls("gauge", `gauge-${tone}`, opts.className), role: "img", "aria-label": aria, style: { "--gauge-size": `${size}px` } },
      svg,
      h("div", { class: "gauge-center", "aria-hidden": "true" },
        h("span", { class: "gauge-value" }, shown),
        h("span", { class: "gauge-max" }, `/${fmt(max)}`)),
      label ? h("div", { class: "gauge-label", "aria-hidden": "true" }, label) : null);
  }

  // progress 0..1 as a full ring. `label` (optional) is the text alternative;
  // without it the ring is decorative (aria-hidden) and something next to it
  // must say the same thing.
  function ring(progressValue, options) {
    const opts = options || {};
    const ratio = clamp(progressValue, 0, 1);
    const size = clamp(opts.size === undefined ? 40 : opts.size, 16, 240);
    const stroke = clamp(opts.stroke === undefined ? Math.max(3, Math.round(size * 0.1)) : opts.stroke, 1, 24);
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const centre = size / 2;
    const arc = h("svg:circle", {
      class: "ring-arc", cx: fmt(centre), cy: fmt(centre), r: fmt(radius), fill: "none", "stroke-width": stroke, "stroke-linecap": "round",
      "stroke-dasharray": fmt(circumference), "stroke-dashoffset": fmt(circumference), transform: `rotate(-90 ${fmt(centre)} ${fmt(centre)})`,
    });
    afterPaint((instant) => {
      if (instant) arc.classList.add("is-static");
      arc.setAttribute("stroke-dashoffset", fmt(circumference * (1 - ratio)));
    });
    const percent = Math.round(ratio * 100);
    const attrs = { class: cls("ring", toneClass("ring", opts.tone), opts.className), style: { "--ring-size": `${size}px` } };
    if (opts.label) {
      attrs.role = "img";
      attrs["aria-label"] = t("ui.ring.aria", { label: opts.label, percent });
    } else {
      attrs["aria-hidden"] = "true";
    }
    return h("span", attrs,
      h("svg:svg", { class: "ring-svg", width: size, height: size, viewBox: `0 0 ${size} ${size}`, focusable: "false", "aria-hidden": "true" },
        h("svg:circle", { class: "ring-track", cx: fmt(centre), cy: fmt(centre), r: fmt(radius), fill: "none", "stroke-width": stroke }),
        arc),
      opts.text !== undefined ? h("span", { class: "ring-text", "aria-hidden": "true" }, String(opts.text)) : null);
  }

  // ---------- Charts ----------

  function finiteList(values) {
    return (Array.isArray(values) ? values : []).map(Number).filter((n) => Number.isFinite(n));
  }

  function sparkline(values, options) {
    const opts = options || {};
    const data = finiteList(values);
    const width = clamp(opts.width === undefined ? 160 : opts.width, 24, 1200);
    const height = clamp(opts.height === undefined ? 40 : opts.height, 12, 400);
    const pad = 3;
    const rawMin = Number.isFinite(Number(opts.min)) && opts.min !== null && opts.min !== undefined ? Number(opts.min) : Math.min(...data);
    const rawMax = Number.isFinite(Number(opts.max)) && opts.max !== null && opts.max !== undefined ? Number(opts.max) : Math.max(...data);
    const min = data.length ? rawMin : 0;
    const max = data.length ? (rawMax === rawMin ? rawMin + 1 : rawMax) : 1;
    const x = (i) => (data.length === 1 ? width / 2 : pad + ((width - pad * 2) * i) / (data.length - 1));
    const y = (v) => pad + (height - pad * 2) * (1 - (clamp(v, min, max) - min) / (max - min));
    const points = data.map((v, i) => [x(i), y(v)]);
    const children = [];
    if (points.length > 1) {
      const line = points.map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join("L");
      children.push(h("svg:path", { class: "spark-area", d: `M${fmt(points[0][0])} ${height - pad}L${line}L${fmt(points[points.length - 1][0])} ${height - pad}Z` }));
      children.push(h("svg:path", { class: "spark-line", d: `M${line}`, fill: "none" }));
    }
    if (points.length) {
      const last = points[points.length - 1];
      children.push(h("svg:circle", { class: "spark-dot", cx: fmt(last[0]), cy: fmt(last[1]), r: 2.6 }));
    }
    const label = opts.label
      ? String(opts.label)
      : data.length
        ? t("ui.sparkline.aria", { n: data.length, first: fmt(data[0]), last: fmt(data[data.length - 1]), min: fmt(Math.min(...data)), max: fmt(Math.max(...data)) })
        : t("ui.sparkline.empty");
    return h("svg:svg", {
      class: cls("sparkline", opts.className), width, height, viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": label, focusable: "false",
    }, children);
  }

  const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|var\(--[a-z0-9-]+\))$/;

  // items: [{ label, value, tone?, color? }]. The SVG is decorative; a visually
  // hidden table right next to it carries the same numbers for screen readers.
  function barChart(items, options) {
    const opts = options || {};
    const list = (Array.isArray(items) ? items : [])
      .map((item) => ({ label: String(item && item.label !== undefined ? item.label : ""), value: Number(item && item.value), tone: item && item.tone, color: item && item.color }))
      .filter((item) => Number.isFinite(item.value));
    const formatValue = typeof opts.format === "function" ? opts.format : (v) => String(Math.round(v * 10) / 10);
    const label = opts.label ? String(opts.label) : t("ui.chart.table");
    if (!list.length) {
      return h("div", { class: cls("chart", "chart-empty", opts.className), role: "group", "aria-label": label }, h("p", { class: "t-muted" }, t("ui.chart.empty")));
    }
    const height = clamp(opts.height === undefined ? 140 : opts.height, 60, 600);
    const slot = 44;
    const width = clamp(opts.width === undefined ? Math.max(180, list.length * slot) : opts.width, 60, 2000);
    const labelH = 18;
    const valueH = 14;
    const plotH = height - labelH - valueH;
    const max = Number(opts.max) > 0 ? Number(opts.max) : Math.max(...list.map((item) => item.value), 1);
    const gap = 8;
    const barW = Math.max(6, (width - gap * (list.length + 1)) / list.length);
    const bars = list.map((item, i) => {
      const ratio = clamp(item.value / max, 0, 1);
      const barH = Math.max(ratio > 0 ? 2 : 0, plotH * ratio);
      const bx = gap + i * (barW + gap);
      const by = valueH + (plotH - barH);
      const attrs = { class: cls("chart-bar", toneClass("chart-bar", item.tone)), x: fmt(bx), y: fmt(by), width: fmt(barW), height: fmt(barH), rx: 3 };
      if (typeof item.color === "string" && SAFE_COLOR.test(item.color)) attrs.style = { "--bar-color": item.color };
      return h("svg:g", null,
        h("svg:rect", attrs),
        h("svg:text", { class: "chart-value", x: fmt(bx + barW / 2), y: fmt(by - 3), "text-anchor": "middle" }, formatValue(item.value)),
        h("svg:text", { class: "chart-label", x: fmt(bx + barW / 2), y: height - 4, "text-anchor": "middle" }, item.label));
    });
    const svg = h("svg:svg", { class: "chart-svg", viewBox: `0 0 ${fmt(width)} ${height}`, width, height, "aria-hidden": "true", focusable: "false" },
      h("svg:line", { class: "chart-axis", x1: 0, x2: fmt(width), y1: valueH + plotH, y2: valueH + plotH }), bars);
    const table = h("table", { class: "sr-only" },
      h("caption", null, label),
      h("thead", null, h("tr", null, h("th", { scope: "col" }, t("ui.chart.colLabel")), h("th", { scope: "col" }, t("ui.chart.colValue")))),
      h("tbody", null, list.map((item) => h("tr", null, h("th", { scope: "row" }, item.label), h("td", null, formatValue(item.value))))));
    return h("figure", { class: cls("chart", opts.fill && "chart-fill", opts.className), role: "group", "aria-label": label }, svg, table);
  }

  // ---------- Mini board ----------

  const FILES = "abcdefgh";
  const PIECE_ORDER = "KQRBNP";
  const ARROW_COLORS = { best: "var(--color-perfect)", user: "var(--color-good)", game: "var(--color-brilliant)", warn: "var(--color-dubious)", bad: "var(--color-blunder)", gold: "var(--color-gold)" };

  // Returns { board: [{ file, rank, piece }], turn } or null. Only the first two
  // FEN fields matter for drawing; anything malformed gives null.
  function parseFen(fen) {
    if (typeof fen !== "string") return null;
    const parts = fen.trim().split(/\s+/);
    const rows = (parts[0] || "").split("/");
    if (rows.length !== 8) return null;
    const pieces = [];
    for (let r = 0; r < 8; r += 1) {
      let file = 0;
      for (const ch of rows[r]) {
        if (/[1-8]/.test(ch)) {
          file += Number(ch);
        } else if (/[pnbrqkPNBRQK]/.test(ch)) {
          if (file > 7) return null;
          pieces.push({ file, rank: 7 - r, piece: ch });
          file += 1;
        } else {
          return null;
        }
      }
      if (file !== 8) return null;
    }
    return { pieces, turn: parts[1] === "b" ? "b" : "w" };
  }

  const squareName = (file, rank) => `${FILES[file]}${rank + 1}`;

  function parseSquare(text) {
    const m = /^([a-h])([1-8])$/.exec(String(text || "").toLowerCase());
    return m ? { file: FILES.indexOf(m[1]), rank: Number(m[2]) - 1 } : null;
  }

  function describePieces(pieces, color) {
    const wanted = color === "w" ? (p) => p === p.toUpperCase() : (p) => p === p.toLowerCase();
    return pieces
      .filter((entry) => wanted(entry.piece))
      .sort((a, b) => PIECE_ORDER.indexOf(a.piece.toUpperCase()) - PIECE_ORDER.indexOf(b.piece.toUpperCase()) || a.file - b.file || a.rank - b.rank)
      .map((entry) => `${t(`ui.piece.${entry.piece.toUpperCase()}`)} ${squareName(entry.file, entry.rank)}`)
      .join(", ");
  }

  function boardLabel(parsed, customLabel) {
    const prefix = customLabel ? `${String(customLabel).replace(/[.\s]+$/, "")}. ` : "";
    if (!parsed) return t("ui.miniBoard.invalid", { label: prefix });
    if (!parsed.pieces.length) return t("ui.miniBoard.empty", { label: prefix });
    const white = describePieces(parsed.pieces, "w");
    const black = describePieces(parsed.pieces, "b");
    return t("ui.miniBoard.aria", {
      label: prefix,
      side: t(`ui.side.${parsed.turn}`),
      white: white ? t("ui.miniBoard.white", { list: white }) : "",
      black: black ? t("ui.miniBoard.black", { list: black }) : "",
    }).replace(/\s+$/, "");
  }

  function arrowNode(arrow, toXY) {
    const from = parseSquare(arrow && arrow.from);
    const to = parseSquare(arrow && arrow.to);
    if (!from || !to || (from.file === to.file && from.rank === to.rank)) return null;
    const a = toXY(from);
    const b = toXY(to);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    const ux = dx / length;
    const uy = dy / length;
    const head = 3.4;
    const half = 2.1;
    const tip = [b[0] - ux * 0.6, b[1] - uy * 0.6];
    const base = [tip[0] - ux * head, tip[1] - uy * head];
    const start = [a[0] + ux * 2, a[1] + uy * 2];
    const left = [base[0] - uy * half, base[1] + ux * half];
    const right = [base[0] + uy * half, base[1] - ux * half];
    const named = ARROW_COLORS[arrow.color];
    const custom = typeof arrow.color === "string" && SAFE_COLOR.test(arrow.color) ? arrow.color : "";
    const color = named || custom || ARROW_COLORS.gold;
    return h("svg:g", { class: "mb-arrow", style: { "--mb-c": color } },
      h("svg:path", { class: "mb-arrow-line", d: `M${fmt(start[0])} ${fmt(start[1])}L${fmt(base[0])} ${fmt(base[1])}`, fill: "none" }),
      h("svg:path", { class: "mb-arrow-head", d: `M${fmt(tip[0])} ${fmt(tip[1])}L${fmt(left[0])} ${fmt(left[1])}L${fmt(right[0])} ${fmt(right[1])}Z` }));
  }

  // A static, non-interactive board: role="img" with a description of the
  // position. `highlight` is a list of squares or { square, kind } (kind:
  // best | user | bad); `arrows` is [{ from, to, color }] with color one of
  // best | user | game | warn | bad | gold or a #hex / var(--token).
  function miniBoard(fen, options) {
    const opts = options || {};
    const size = clamp(opts.size === undefined ? 240 : opts.size, 48, 1200);
    const flipped = opts.orientation === "b" || opts.orientation === "black";
    const parsed = parseFen(fen);
    const S = 10; // one square in viewBox units
    const toXY = (sq) => [((flipped ? 7 - sq.file : sq.file) + 0.5) * S, ((flipped ? sq.rank : 7 - sq.rank) + 0.5) * S];
    const children = [];

    for (let r = 0; r < 8; r += 1) {
      for (let f = 0; f < 8; f += 1) {
        const file = flipped ? 7 - f : f;
        const rank = flipped ? r : 7 - r;
        const light = (file + rank) % 2 === 1;
        children.push(h("svg:rect", { class: light ? "mb-sq mb-light" : "mb-sq mb-dark", x: f * S, y: r * S, width: S, height: S, "data-square": squareName(file, rank) }));
      }
    }

    (Array.isArray(opts.highlight) ? opts.highlight : []).forEach((entry) => {
      const square = parseSquare(entry && typeof entry === "object" ? entry.square : entry);
      if (!square) return;
      const xy = toXY(square);
      const kind = entry && typeof entry === "object" && /^[a-z]+$/.test(String(entry.kind || "")) ? entry.kind : "";
      children.push(h("svg:rect", { class: cls("mb-hl", kind && `mb-hl-${kind}`), x: fmt(xy[0] - S / 2), y: fmt(xy[1] - S / 2), width: S, height: S }));
    });

    if (opts.coords) {
      // Rank numbers down the left edge, file letters along the bottom edge; each
      // takes the colour that reads on the square it sits on.
      for (let r = 0; r < 8; r += 1) {
        const rank = flipped ? r : 7 - r;
        const file = flipped ? 7 : 0;
        children.push(h("svg:text", { class: cls("mb-coord", (file + rank) % 2 === 1 ? "on-light" : "on-dark"), x: 0.7, y: r * S + 2.7 }, String(rank + 1)));
      }
      for (let f = 0; f < 8; f += 1) {
        const file = flipped ? 7 - f : f;
        const rank = flipped ? 7 : 0;
        children.push(h("svg:text", { class: cls("mb-coord", (file + rank) % 2 === 1 ? "on-light" : "on-dark"), x: f * S + S - 0.9, y: 8 * S - 0.9, "text-anchor": "end" }, FILES[file]));
      }
    }

    if (parsed) {
      parsed.pieces.forEach((entry) => {
        const xy = toXY({ file: entry.file, rank: entry.rank });
        const color = entry.piece === entry.piece.toUpperCase() ? "w" : "b";
        children.push(h("svg:image", {
          class: "mb-piece", href: `${PIECE_BASE}${color}${entry.piece.toUpperCase()}.svg`, x: fmt(xy[0] - S / 2), y: fmt(xy[1] - S / 2), width: S, height: S,
          "data-piece": `${color}${entry.piece.toUpperCase()}`,
        }));
      });
    }

    (Array.isArray(opts.arrows) ? opts.arrows : []).forEach((arrow) => {
      const node = arrowNode(arrow, toXY);
      if (node) children.push(node);
    });

    const attrs = {
      class: cls("mini-board", opts.className),
      width: size,
      height: size,
      viewBox: "0 0 80 80",
      role: "img",
      "aria-label": boardLabel(parsed, opts.label),
      focusable: "false",
      "data-orientation": flipped ? "b" : "w",
    };
    if (/^[a-z]+$/.test(String(opts.theme || ""))) attrs["data-board-theme"] = opts.theme;
    return h("svg:svg", attrs, children);
  }

  // ---------- Toasts ----------

  const TOAST_MAX_VISIBLE = 3;
  const TOAST_DEFAULT_MS = 5200;
  // A toast that offers an action ("Undo", "Reload") is a chance to do something, not just a message: it stays long
  // enough to be reached (WCAG 2.2.1), or until dismissed.
  const TOAST_ACTION_MS = 12000;
  // The celebratory kinds are what app.js shows for an achievement and a level up.
  const TOAST_KIND_ICON = { info: "info", success: "check", warn: "alert", error: "alert", achievement: "star", levelup: "sparkles" };
  const toastState = { stack: null, polite: null, alert: null, visible: [], queue: [], seq: 0 };

  function ensureToastStack() {
    const doc = getDoc();
    if (!doc || !doc.body) return null;
    if (toastState.stack && toastState.stack.parentNode) return toastState.stack;
    toastState.polite = h("div", { class: "toast-list", "aria-live": "polite", "aria-relevant": "additions" });
    toastState.alert = h("div", { class: "toast-list", role: "alert" });
    toastState.stack = h("div", { class: "toast-stack", role: "region", "aria-label": t("ui.toast.region") }, toastState.alert, toastState.polite);
    doc.body.appendChild(toastState.stack);
    return toastState.stack;
  }

  // focus: true put the keyboard focus on the toast's action; when the toast goes, focus returns to where it was (if
  // it is still on the toast or was lost with it) so the person is not dropped at the top of the page.
  function restoreToastFocus(record) {
    const doc = getDoc();
    const back = record.returnTo;
    record.returnTo = null;
    if (!record.tookFocus || !doc || !back || back.isConnected === false || typeof back.focus !== "function") return;
    const active = doc.activeElement;
    const lost = !active || active === doc.body || (record.el && typeof record.el.contains === "function" && record.el.contains(active));
    if (!lost) return;
    try {
      back.focus();
    } catch (error) {
      // focus restore is best effort
    }
  }

  function removeToast(record, immediate) {
    if (!record || record.gone) return;
    record.gone = true;
    if (record.timer) timers.clearTimeout(record.timer);
    const index = toastState.visible.indexOf(record);
    if (index !== -1) toastState.visible.splice(index, 1);
    restoreToastFocus(record);
    const finish = () => {
      if (record.el && typeof record.el.remove === "function") record.el.remove();
      pumpToasts();
    };
    if (immediate || reducedMotion()) {
      finish();
    } else {
      record.el.classList.add("is-leaving");
      timers.setTimeout(finish, 220);
    }
  }

  function armToast(record) {
    if (record.gone || !(record.duration > 0) || record.paused) return;
    if (record.timer) timers.clearTimeout(record.timer);
    record.startedAt = timers.now();
    record.timer = timers.setTimeout(() => removeToast(record), record.remaining);
  }

  function pauseToast(record) {
    if (record.gone || record.paused) return;
    record.paused = true;
    if (record.timer) {
      timers.clearTimeout(record.timer);
      record.timer = null;
      record.remaining = Math.max(1500, record.remaining - (timers.now() - record.startedAt));
    }
  }

  function resumeToast(record) {
    if (record.gone || !record.paused) return;
    record.paused = false;
    armToast(record);
  }

  function pumpToasts() {
    while (toastState.queue.length && toastState.visible.length < TOAST_MAX_VISIBLE) {
      showToast(toastState.queue.shift());
    }
  }

  function showToast(record) {
    if (!ensureToastStack()) return;
    const list = record.kind === "error" || record.kind === "warn" ? toastState.alert : toastState.polite;
    const dismiss = h("button", { type: "button", class: "btn btn-ghost btn-icon btn-sm toast-close", "aria-label": t("ui.toast.dismiss"), onclick: () => removeToast(record) }, icon("x", { size: 16 }));
    const parts = [
      h("span", { class: "toast-icon", "aria-hidden": "true" }, icon(TOAST_KIND_ICON[record.kind], { size: 20 })),
      h("div", { class: "toast-body" },
        h("span", { class: "sr-only" }, `${t(`ui.toast.kind.${record.kind}`)}. `),
        h("span", { class: "toast-message" }, record.message)),
    ];
    let actionBtn = null;
    if (record.action && record.action.label) {
      actionBtn = h("button", {
        type: "button",
        class: "btn btn-secondary btn-sm toast-action",
        onclick: () => {
          try {
            if (typeof record.action.onClick === "function") record.action.onClick();
          } finally {
            removeToast(record);
          }
        },
      }, String(record.action.label));
      parts.push(actionBtn);
    }
    parts.push(dismiss);
    record.el = h("div", { class: cls("toast", `toast-${record.kind}`), "data-kind": record.kind }, parts);
    ["mouseenter", "focusin"].forEach((evt) => record.el.addEventListener(evt, () => pauseToast(record)));
    ["mouseleave", "focusout"].forEach((evt) => record.el.addEventListener(evt, () => resumeToast(record)));
    // A toast that has the focus closes with Escape (and gives the focus back).
    record.el.addEventListener("keydown", (event) => {
      if (event && event.key === "Escape") {
        if (typeof event.preventDefault === "function") event.preventDefault();
        removeToast(record);
      }
    });
    list.appendChild(record.el);
    toastState.visible.push(record);
    record.remaining = record.duration;
    armToast(record);
    if (record.focus && actionBtn) {
      const doc = getDoc();
      record.returnTo = doc && doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null;
      timers.raf(() => {
        if (record.gone || typeof actionBtn.focus !== "function") return;
        try {
          actionBtn.focus();
          record.tookFocus = true;
        } catch (error) {
          // focus is best effort
        }
      });
    }
  }

  // message: plain text. kind: info | success | warn | error. duration in ms
  // (0 = stays until dismissed; errors default to a longer time). Hovering or
  // focusing a toast pauses its timer. At most three show at once; the rest wait.
  // A toast with an `action` stays 12 s by default (an explicit shorter duration is raised to 12 s: nobody can press
  // "Undo" that fast from a keyboard), `persistent: true` keeps any toast until it is dismissed, and `focus: true`
  // (for a toast that answers the person's own keystroke, like "Undo") moves the focus to the action and gives it back
  // when the toast goes. Escape closes a toast that has the focus.
  function toast(message, options) {
    const opts = options || {};
    const kind = Object.prototype.hasOwnProperty.call(TOAST_KIND_ICON, opts.kind) ? opts.kind : "info";
    const action = opts.action && typeof opts.action === "object" ? opts.action : null;
    const hasAction = Boolean(action && action.label);
    const defaultMs = hasAction ? TOAST_ACTION_MS : kind === "error" ? TOAST_DEFAULT_MS * 1.6 : kind === "warn" ? TOAST_DEFAULT_MS * 1.3 : TOAST_DEFAULT_MS;
    let duration = opts.duration === undefined ? defaultMs : Math.max(0, Number(opts.duration) || 0);
    if (hasAction && duration > 0) duration = Math.max(duration, TOAST_ACTION_MS);
    if (opts.persistent === true) duration = 0;
    toastState.seq += 1;
    const record = {
      id: toastState.seq,
      kind,
      message: String(message === undefined || message === null ? "" : message),
      duration,
      remaining: duration,
      action,
      focus: opts.focus === true,
      returnTo: null,
      tookFocus: false,
      gone: false,
      paused: false,
      timer: null,
      el: null,
    };
    if (!getDoc()) return { id: record.id, dismiss() {}, el: null };
    if (toastState.visible.length >= TOAST_MAX_VISIBLE) toastState.queue.push(record);
    else showToast(record);
    return {
      id: record.id,
      get el() {
        return record.el;
      },
      dismiss() {
        const queued = toastState.queue.indexOf(record);
        if (queued !== -1) toastState.queue.splice(queued, 1);
        record.gone = record.gone || queued !== -1;
        removeToast(record, true);
      },
    };
  }

  function clearToasts() {
    toastState.queue.length = 0;
    toastState.visible.slice().forEach((record) => removeToast(record, true));
  }

  // ---------- Modal, confirm, sheet ----------

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
  const modalState = { stack: [], seq: 0, locks: 0 };

  function isVisible(el) {
    if (!el) return false;
    if (typeof el.getClientRects === "function") return el.getClientRects().length > 0;
    return true;
  }

  function focusablesIn(container) {
    if (!container || typeof container.querySelectorAll !== "function") return [];
    return Array.from(container.querySelectorAll(FOCUSABLE)).filter(isVisible);
  }

  function lockScroll(doc) {
    modalState.locks += 1;
    if (modalState.locks === 1 && doc.body && doc.body.classList) doc.body.classList.add("ui-scroll-lock");
  }

  function unlockScroll(doc) {
    modalState.locks = Math.max(0, modalState.locks - 1);
    if (modalState.locks === 0 && doc.body && doc.body.classList) doc.body.classList.remove("ui-scroll-lock");
  }

  // Everything else on the page becomes inert while a dialog is open, so the
  // virtual cursor and Tab cannot leave it. Only what this dialog inerted is
  // restored, which keeps nested dialogs correct.
  function inertSiblings(doc, keep) {
    const changed = [];
    const children = doc.body && doc.body.children ? Array.from(doc.body.children) : [];
    children.forEach((child) => {
      if (child === keep || !child || typeof child.setAttribute !== "function") return;
      if (child === toastState.stack) return;
      const tag = String(child.tagName || "").toLowerCase();
      if (tag === "script" || tag === "noscript") return;
      if (typeof child.hasAttribute === "function" && child.hasAttribute("inert")) return;
      child.setAttribute("inert", "");
      changed.push(child);
    });
    return changed;
  }

  function normalizeBody(body) {
    if (body === undefined || body === null || body === false) return [];
    return Array.isArray(body) ? body : [body];
  }

  // The aria-describedby value for a dialog: true -> the body's id; a string is an id (or a list of ids); an Element
  // is referenced by its id (one is given if it has none); an array combines those. Anything else -> no description.
  function describedByIds(spec, bodyId) {
    if (spec === true) return bodyId;
    const parts = [];
    (Array.isArray(spec) ? spec : [spec]).forEach((item) => {
      if (typeof item === "string" && item.trim()) {
        parts.push(item.trim());
      } else if (item && typeof item === "object" && typeof item.setAttribute === "function") {
        if (!item.id) {
          modalState.seq += 1;
          item.id = `ui-modal-desc-${modalState.seq}`;
        }
        parts.push(item.id);
      }
    });
    return parts.join(" ");
  }

  // options: { title, body (string | Node | array), actions: [{ label, kind:
  // "primary"|"secondary"|"danger"|"ghost", value, onClick(handle) -> false keeps
  // it open, autofocus, closes: true }], onClose(result), dismissible: true,
  // size: "sm"|"md"|"lg", variant: "modal"|"sheet", initialFocus: Element,
  // describedBy: true (the whole body) | an id | an Element | an array of ids/Elements (the node(s) that carry the message,
  // e.g. the consequence paragraph above a confirm field) | false; an alertdialog is described by its body unless told
  // otherwise, because a screen reader must read WHAT the alert says when it opens, not only its title }.
  // Returns { el, close(result), closed: Promise<result> }.
  function modal(options) {
    const opts = options || {};
    const doc = getDoc();
    let resolveClosed = () => {};
    const closedPromise = new Promise((resolve) => {
      resolveClosed = resolve;
    });
    if (!doc || !doc.body) {
      resolveClosed("no-document");
      return { el: null, close() {}, closed: closedPromise };
    }

    modalState.seq += 1;
    const id = `ui-modal-${modalState.seq}`;
    const dismissible = opts.dismissible !== false;
    const size = ["sm", "md", "lg"].includes(opts.size) ? opts.size : "md";
    const variant = opts.variant === "sheet" ? "sheet" : "modal";
    const previous = doc.activeElement || null;
    let closed = false;
    let inerted = [];

    const handle = { el: null, close: (result) => close(result === undefined ? "close" : result), closed: closedPromise };

    const actionButtons = (Array.isArray(opts.actions) ? opts.actions : []).map((action, index) => {
      const kind = ["primary", "secondary", "danger", "ghost"].includes(action && action.kind) ? action.kind : index === 0 ? "primary" : "secondary";
      const attrs = { type: "button", class: cls("btn", `btn-${kind}`, action && action.className) };
      if (action && action.autofocus) attrs["data-autofocus"] = "";
      return h("button", Object.assign(attrs, {
        onclick: () => {
          let keepOpen = false;
          try {
            if (typeof action.onClick === "function") keepOpen = action.onClick(handle) === false;
          } catch (error) {
            keepOpen = false;
            if (root.console && typeof root.console.error === "function") root.console.error("[Ludus.ui.modal] action threw", error);
          }
          if (!keepOpen && action.closes !== false) close(action.value === undefined ? action.label : action.value);
        },
      }), action && action.icon ? icon(action.icon, { size: 18 }) : null, h("span", { class: "btn-label" }, String((action && action.label) || "")));
    });

    const bodyId = `${id}-body`;
    const titleId = `${id}-title`;
    const head = opts.title || dismissible
      ? h("header", { class: "modal-head" },
        h("h2", { class: "modal-title", id: titleId }, String(opts.title === undefined ? "" : opts.title)),
        dismissible ? h("button", { type: "button", class: "btn btn-ghost btn-icon btn-sm modal-close", "aria-label": t("ui.close"), onclick: () => close("dismiss") }, icon("x", { size: 20 })) : null)
      : null;
    const bodyEl = h("div", { class: "modal-body", id: bodyId }, normalizeBody(opts.body));
    const footer = actionButtons.length ? h("footer", { class: "modal-actions" }, actionButtons) : null;

    const dialogAttrs = {
      class: cls("modal", `modal-${size}`, variant === "sheet" && "sheet", opts.className),
      role: opts.role === "alertdialog" ? "alertdialog" : "dialog",
      "aria-modal": "true",
      tabindex: "-1",
    };
    if (head && opts.title) dialogAttrs["aria-labelledby"] = titleId;
    else if (opts.ariaLabel) dialogAttrs["aria-label"] = String(opts.ariaLabel);
    const describedBy = describedByIds(opts.describedBy === undefined ? opts.role === "alertdialog" : opts.describedBy, bodyId);
    if (describedBy) dialogAttrs["aria-describedby"] = describedBy;

    const dialog = h("div", dialogAttrs, variant === "sheet" ? h("span", { class: "sheet-handle", "aria-hidden": "true" }) : null, head, bodyEl, footer);
    const backdrop = h("div", { class: cls("modal-backdrop", variant === "sheet" && "is-sheet") }, dialog);
    handle.el = dialog;

    function onKeydown(event) {
      if (!event) return;
      if (event.key === "Escape" && dismissible) {
        // Only the top-most dialog reacts.
        if (modalState.stack[modalState.stack.length - 1] !== record) return;
        if (typeof event.preventDefault === "function") event.preventDefault();
        if (typeof event.stopPropagation === "function") event.stopPropagation();
        close("escape");
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusablesIn(dialog);
      if (!items.length) {
        if (typeof event.preventDefault === "function") event.preventDefault();
        if (typeof dialog.focus === "function") dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = doc.activeElement;
      if (event.shiftKey && (active === first || active === dialog)) {
        if (typeof event.preventDefault === "function") event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        if (typeof event.preventDefault === "function") event.preventDefault();
        first.focus();
      }
    }

    // A press that starts AND ends on the backdrop dismisses; a drag that starts
    // inside the dialog (selecting text) and ends outside does not.
    let pressOnBackdrop = false;
    backdrop.addEventListener("mousedown", (event) => {
      pressOnBackdrop = event && event.target === backdrop;
    });
    backdrop.addEventListener("click", (event) => {
      if (dismissible && pressOnBackdrop && event && event.target === backdrop) close("backdrop");
      pressOnBackdrop = false;
    });
    backdrop.addEventListener("keydown", onKeydown);

    const record = { id, close: (result) => close(result) };

    function close(result) {
      if (closed) return;
      closed = true;
      const index = modalState.stack.indexOf(record);
      if (index !== -1) modalState.stack.splice(index, 1);
      inerted.forEach((el) => {
        if (typeof el.removeAttribute === "function") el.removeAttribute("inert");
      });
      inerted = [];
      unlockScroll(doc);
      const remove = () => {
        if (typeof backdrop.remove === "function") backdrop.remove();
      };
      if (reducedMotion()) {
        remove();
      } else {
        backdrop.classList.add("is-closing");
        timers.setTimeout(remove, 180);
      }
      // Focus goes back to whatever opened the dialog (if it is still there).
      try {
        if (previous && typeof previous.focus === "function" && previous.isConnected !== false) previous.focus();
      } catch (error) {
        // focus restore is best effort
      }
      try {
        if (typeof opts.onClose === "function") opts.onClose(result);
      } catch (error) {
        if (root.console && typeof root.console.error === "function") root.console.error("[Ludus.ui.modal] onClose threw", error);
      }
      resolveClosed(result);
    }

    doc.body.appendChild(backdrop);
    modalState.stack.push(record);
    lockScroll(doc);
    inerted = inertSiblings(doc, backdrop);
    // Toast stack stays interactive above the dialog, but it is not inerted.

    // Initial focus: the requested element, an [data-autofocus] action, the
    // first field/control of the body, else the dialog itself.
    timers.raf(() => {
      if (closed) return;
      let target = opts.initialFocus || null;
      if (!target && typeof dialog.querySelector === "function") {
        try {
          target = dialog.querySelector("[data-autofocus]") || dialog.querySelector("[autofocus]");
        } catch (error) {
          target = null;
        }
      }
      if (!target) {
        const inBody = focusablesIn(bodyEl);
        const inActions = focusablesIn(footer);
        target = inBody[0] || inActions[0] || focusablesIn(dialog)[0] || dialog;
      }
      try {
        if (target && typeof target.focus === "function") target.focus();
      } catch (error) {
        // ignore
      }
    });

    return handle;
  }

  function sheet(options) {
    return modal(Object.assign({}, options || {}, { variant: "sheet" }));
  }

  // -> Promise<boolean>. Escape, the close button and a backdrop click all
  // answer false. A danger confirm puts the initial focus on Cancel.
  function confirm(options) {
    const opts = options || {};
    return new Promise((resolve) => {
      let answer = false;
      const bodyNodes = normalizeBody(opts.body).map((entry) => (typeof entry === "string" ? h("p", { class: "modal-text" }, entry) : entry));
      const handle = modal({
        title: opts.title,
        body: bodyNodes,
        size: opts.size || "sm",
        role: "alertdialog",
        describedBy: true,
        dismissible: opts.dismissible !== false,
        actions: [
          { label: opts.cancelLabel || t("ui.cancel"), kind: "secondary", value: false, autofocus: Boolean(opts.danger), onClick: () => { answer = false; } },
          { label: opts.confirmLabel || t("ui.confirm"), kind: opts.danger ? "danger" : "primary", value: true, autofocus: !opts.danger, onClick: () => { answer = true; } },
        ],
        onClose: () => resolve(answer),
      });
      if (!handle.el) resolve(false);
    });
  }

  // Paints the filled part of a .slider (css/system.css reads --pct) now and on
  // every input event. Returns the element.
  function bindSlider(input) {
    if (!input || typeof input.addEventListener !== "function") return input;
    const update = () => {
      const min = Number(input.min === undefined || input.min === "" ? 0 : input.min);
      const max = Number(input.max === undefined || input.max === "" ? 100 : input.max);
      const value = Number(input.value);
      const ratio = max > min ? clamp((value - min) / (max - min), 0, 1) : 0;
      if (input.style && typeof input.style.setProperty === "function") input.style.setProperty("--pct", `${fmt(ratio * 100)}%`);
    };
    input.addEventListener("input", update);
    update();
    return input;
  }

  // Without a document (Node, a worker) every node builder answers null instead
  // of throwing, so a screen that renders on the server side of a test does not
  // need to special-case it.
  const safe = (fn) => function guarded(...args) {
    return getDoc() ? fn(...args) : null;
  };

  return {
    icon: safe(icon),
    iconNames,
    toast,
    clearToasts,
    modal,
    confirm,
    sheet,
    avatar: safe(avatar),
    levelBadge: safe(levelBadge),
    gauge: safe(gauge),
    ring: safe(ring),
    sparkline: safe(sparkline),
    barChart: safe(barChart),
    chip: safe(chip),
    badge: safe(badge),
    qualityBadge: safe(qualityBadge),
    button: safe(button),
    iconButton: safe(iconButton),
    progress: safe(progress),
    stat: safe(stat),
    skeleton: safe(skeleton),
    spinner: safe(spinner),
    emptyState: safe(emptyState),
    miniBoard: safe(miniBoard),
    bindSlider,
    // Exposed for the tests and for other modules that need the same helpers.
    parseFen,
    initialsOf,
    reducedMotion,
    QUALITY_CODES: QUALITY_CODES.slice(),
    TEXT,
    _setTimers: setTimers,
    _state: { toast: toastState, modal: modalState },
  };
});
