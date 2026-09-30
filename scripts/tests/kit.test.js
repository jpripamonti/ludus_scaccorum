// Unit tests for js/ui/kit.js (Ludus.ui) against a small but real-enough fake
// DOM (scripts/tests/_uidom.js): element tree, attributes, classList, events,
// focus and a selector engine for what the kit queries. Nothing waits in real time: the
// kit's timers are replaced by a manual clock.
//
// Covers: icons, escaping (text never becomes markup), avatar, level badge,
// gauge / ring / sparkline / bar chart text alternatives, the mini board (64
// squares, piece placement for a known FEN, orientation, arrows, theme, label),
// toast queue and roles, modal (aria, scroll lock, inert, focus trap, Escape,
// focus restore), confirm as a Promise<boolean>, and the no-DOM behaviour.

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..", "..");

const { FakeDocument, findAll, byClass } = require("./_uidom.js");
// The most recent alertdialog (a closed one stays in the tree until its exit animation ends).
const lastDialog = (doc) => findAll(doc.body, (el) => el.getAttribute("role") === "alertdialog").pop();

// ---------- Environment ----------

function createEnv({ withDocument = true, language = "es" } = {}) {
  const doc = withDocument ? new FakeDocument() : null;
  const sandbox = { console, setTimeout, clearTimeout, Date, Math, JSON, Object, Array, String, Number, Promise, Map, Set, Intl };
  if (doc) {
    sandbox.document = doc;
    sandbox.window = { document: doc };
  }
  // Ludus.core reads navigator.languages to pick the language.
  sandbox.navigator = { languages: [language], language };
  const context = vm.createContext(sandbox);
  ["js/ludus.js", "js/ui/kit.js"].forEach((rel) => {
    vm.runInContext(fs.readFileSync(path.join(repoRoot, rel), "utf8"), context, { filename: rel });
  });
  const Ludus = context.Ludus;
  Ludus.i18n.setLanguage(language, { persist: false });

  // Manual clock and synchronous animation frames.
  const clock = { now: 0, seq: 0, timers: new Map() };
  Ludus.ui._setTimers({
    setTimeout(fn, ms) {
      clock.seq += 1;
      clock.timers.set(clock.seq, { at: clock.now + Number(ms || 0), fn });
      return clock.seq;
    },
    clearTimeout(id) { clock.timers.delete(id); },
    raf(fn) { fn(); },
    now: () => clock.now,
  });
  function advance(ms) {
    const target = clock.now + ms;
    for (;;) {
      let next = null;
      let nextId = 0;
      clock.timers.forEach((timer, id) => {
        if (timer.at <= target && (!next || timer.at < next.at || (timer.at === next.at && id < nextId))) {
          next = timer;
          nextId = id;
        }
      });
      if (!next) break;
      clock.timers.delete(nextId);
      clock.now = Math.max(clock.now, next.at);
      next.fn();
    }
    clock.now = target;
  }
  return { Ludus, ui: Ludus.ui, doc, context, advance, clock };
}

// ---------- Tests ----------

let passed = 0;
const pending = [];

function test(name, fn) {
  pending.push({ name, fn });
}

// A test that awaits a promise nobody resolves would let Node exit silently with
// code 0 (empty event loop); the watchdog turns that into a visible failure.
async function runAll() {
  for (const { name, fn } of pending) {
    let watchdog = null;
    try {
      await Promise.race([
        fn(),
        new Promise((_, reject) => {
          watchdog = setTimeout(() => reject(new Error(`test never settled: ${name}`)), 4000);
        }),
      ]);
      clearTimeout(watchdog);
      passed += 1;
      console.log(`  ok  ${name}`);
    } catch (error) {
      clearTimeout(watchdog);
      console.error(`  FAIL  ${name}`);
      throw error;
    }
  }
}

test("i18n: every ui.* key exists in both languages", () => {
  const { Ludus } = createEnv();
  const keys = ["ui.close", "ui.cancel", "ui.confirm", "ui.toast.dismiss", "ui.gauge.aria", "ui.miniBoard.aria", "ui.piece.K", "ui.side.w", "ui.sparkline.aria"];
  keys.forEach((key) => {
    assert.ok(Ludus.i18n.has(key, "es"), `es ${key}`);
    assert.ok(Ludus.i18n.has(key, "en"), `en ${key}`);
    assert.notStrictEqual(Ludus.i18n.t(key, {}, "es"), key);
  });
});

test("icon: ~30 names, 24px grid, decorative by default, labelled on request", () => {
  const { ui } = createEnv();
  const wanted = ["home", "book", "target", "chart", "settings", "user", "users", "flame", "star", "trophy", "clock", "lightbulb",
    "chevron-left", "chevron-right", "chevron-down", "arrow-right", "play", "pause", "check", "x", "sparkles", "columns", "museum",
    "swords", "download", "upload", "globe", "cloud", "lock", "refresh", "flag", "eye", "undo", "info", "alert"];
  wanted.forEach((name) => assert.ok(ui.iconNames().includes(name), `icon ${name} missing`));
  wanted.forEach((name) => {
    const svg = ui.icon(name, { size: 18 });
    assert.strictEqual(svg.tagName, "SVG");
    assert.strictEqual(svg.getAttribute("viewBox"), "0 0 24 24");
    assert.strictEqual(svg.getAttribute("width"), "18");
    assert.strictEqual(svg.getAttribute("aria-hidden"), "true");
    assert.strictEqual(svg.getAttribute("stroke"), "currentColor");
    assert.ok(svg.children.length >= 1, `icon ${name} has no shapes`);
  });
  const labelled = ui.icon("home", { title: "Inicio" });
  assert.strictEqual(labelled.getAttribute("role"), "img");
  assert.strictEqual(labelled.getAttribute("aria-label"), "Inicio");
  assert.strictEqual(labelled.getAttribute("aria-hidden"), null);
  // Unknown names and hostile names never throw and never leak into the class as markup.
  const unknown = ui.icon('"><script>', { size: 999999 });
  assert.strictEqual(unknown.children.length, 0);
  assert.ok(!/[<>"]/.test(unknown.getAttribute("class")));
  assert.ok(Number(unknown.getAttribute("width")) <= 256);
});

test("escaping: strings are text nodes, never markup", () => {
  const { ui } = createEnv();
  const evil = '<img src=x onerror="alert(1)">';
  const state = ui.emptyState({ title: evil, body: evil, action: { label: evil, onClick() {} } });
  assert.strictEqual(findAll(state, (el) => el.tagName === "IMG").length, 0);
  assert.ok(state.textContent.includes(evil));
  const toastHandle = ui.toast(evil, { duration: 0 });
  assert.strictEqual(findAll(toastHandle.el, (el) => el.tagName === "IMG").length, 0);
  assert.ok(toastHandle.el.textContent.includes(evil));
  const chip = ui.chip(evil);
  assert.strictEqual(chip.children.filter((c) => c.nodeType === 1).length, 0);
  const chart = ui.barChart([{ label: evil, value: 3 }]);
  assert.strictEqual(findAll(chart, (el) => el.tagName === "IMG").length, 0);
  assert.ok(chart.textContent.includes(evil));
  const b = ui.button(evil, { href: "javascript:alert(1)" });
  assert.strictEqual(b.getAttribute("href"), null, "javascript: URLs are dropped by Ludus.util.h");
});

test("avatar: initials, colour, readable text, decorative unless labelled", () => {
  const { ui } = createEnv();
  const a = ui.avatar({ name: "Ana María López", color: "#2f6f4f" }, { size: 40 });
  assert.strictEqual(a.textContent, "AL");
  assert.strictEqual(a.style.props["--avatar-bg"], "#2f6f4f");
  assert.strictEqual(a.style.props["--avatar-size"], "40px");
  assert.strictEqual(a.style.props["--avatar-fg"], "#ffffff");
  assert.strictEqual(a.getAttribute("aria-hidden"), "true");
  const light = ui.avatar({ name: "Zed", color: "#f0e0a0" });
  assert.strictEqual(light.style.props["--avatar-fg"], "#0b1118", "dark ink on a light colour");
  const bad = ui.avatar({ name: "", color: "red; background:url(x)" });
  assert.strictEqual(bad.textContent, "?");
  assert.strictEqual(bad.style.props["--avatar-bg"], "#2b5f8a");
  const labelled = ui.avatar({ name: "Juan" }, { label: true });
  assert.strictEqual(labelled.getAttribute("role"), "img");
  assert.strictEqual(labelled.getAttribute("aria-label"), "Juan");
  assert.strictEqual(ui.avatar(null).textContent, "?");
});

test("levelBadge: piece image and title from a Profile.levelFor() result", () => {
  const { ui, Ludus } = createEnv();
  const level = { level: 4, rank: "knight", rankKey: "profile.rank.knight", roman: "II", title: "Caballo II" };
  const node = ui.levelBadge(level);
  assert.strictEqual(node.getAttribute("data-rank"), "knight");
  const img = findAll(node, (el) => el.tagName === "IMG")[0];
  assert.strictEqual(img.getAttribute("src"), "assets/pieces/cburnett/wN.svg");
  assert.strictEqual(img.getAttribute("alt"), "");
  assert.ok(node.textContent.includes("Caballo II"));
  // Without a title it is composed from the rank key through i18n.
  Ludus.i18n.register({ es: { "profile.rank.rook": "Torre" }, en: { "profile.rank.rook": "Rook" } });
  const composed = ui.levelBadge({ rank: "rook", rankKey: "profile.rank.rook", roman: "III" });
  assert.ok(composed.textContent.includes("Torre III"));
  assert.ok(ui.levelBadge({ rank: "grandmaster", roman: "I" }).classList.contains("is-gm"));
  assert.ok(ui.levelBadge(undefined));
});

test("gauge: text alternative, clamped value, tone by ratio, arc reaches its target", () => {
  const { ui } = createEnv();
  const g = ui.gauge({ value: 7.5, max: 10, label: "Puntos", size: 120 });
  assert.strictEqual(g.getAttribute("role"), "img");
  assert.strictEqual(g.getAttribute("aria-label"), "Puntos: 7.5 de 10");
  assert.ok(g.classList.contains("gauge-good"));
  const arc = findAll(g, byClass("gauge-arc"))[0];
  const sweep = Number(arc.getAttribute("stroke-dasharray").split(" ")[0]);
  assert.ok(Math.abs(Number(arc.getAttribute("stroke-dashoffset")) - sweep * 0.25) < 0.05, "75% of the arc is drawn");
  assert.strictEqual(findAll(g, byClass("gauge-value"))[0].textContent, "7.5");
  assert.ok(ui.gauge({ value: 10 }).classList.contains("gauge-perfect"));
  assert.ok(ui.gauge({ value: 1 }).classList.contains("gauge-blunder"));
  assert.ok(ui.gauge({ value: 5 }).classList.contains("gauge-dubious"));
  const over = ui.gauge({ value: 99, max: 10 });
  assert.strictEqual(findAll(over, byClass("gauge-value"))[0].textContent, "10");
  assert.strictEqual(ui.gauge({ value: "nope" }).getAttribute("aria-label"), "0 de 10");
  assert.ok(ui.gauge({ value: 3, tone: "brilliant" }).classList.contains("gauge-brilliant"));
});

test("gauge: no animation under reduced motion (arc is set at once and flagged static)", () => {
  const { ui, doc } = createEnv();
  doc.documentElement.setAttribute("data-motion", "reduce");
  const g = ui.gauge({ value: 5, max: 10 });
  assert.ok(findAll(g, byClass("gauge-arc"))[0].classList.contains("is-static"));
});

test("ring and sparkline: labels, geometry, empty input", () => {
  const { ui } = createEnv();
  const ring = ui.ring(0.42, { size: 40, label: "Nivel" });
  assert.strictEqual(ring.getAttribute("aria-label"), "Nivel: 42%");
  const arc = findAll(ring, byClass("ring-arc"))[0];
  const total = Number(arc.getAttribute("stroke-dasharray"));
  assert.ok(Math.abs(Number(arc.getAttribute("stroke-dashoffset")) - total * 0.58) < 0.05);
  assert.strictEqual(ui.ring(5).getAttribute("aria-hidden"), "true");
  assert.ok(Math.abs(Number(findAll(ui.ring(5), byClass("ring-arc"))[0].getAttribute("stroke-dashoffset"))) < 0.01, "progress is clamped to 1");

  const spark = ui.sparkline([1, 2, 3, NaN, 5, "7"], { width: 100, height: 30 });
  assert.strictEqual(spark.getAttribute("role"), "img");
  assert.ok(/5 valores/.test(spark.getAttribute("aria-label")), spark.getAttribute("aria-label"));
  assert.ok(/de 1 a 7/.test(spark.getAttribute("aria-label")));
  assert.strictEqual(findAll(spark, byClass("spark-line")).length, 1);
  assert.strictEqual(findAll(spark, byClass("spark-dot")).length, 1);
  const single = ui.sparkline([4]);
  assert.strictEqual(findAll(single, byClass("spark-line")).length, 0);
  assert.strictEqual(findAll(single, byClass("spark-dot")).length, 1);
  const empty = ui.sparkline([]);
  assert.strictEqual(empty.getAttribute("aria-label"), "Todavía no hay datos para mostrar una tendencia.");
  assert.strictEqual(ui.sparkline([2, 2, 2]).children.length > 0, true, "flat data does not divide by zero");
  assert.strictEqual(ui.sparkline([1, 2], { label: "Precisión" }).getAttribute("aria-label"), "Precisión");
});

test("barChart: SVG is decorative, a hidden table carries the numbers", () => {
  const { ui } = createEnv();
  const chart = ui.barChart([{ label: "Apertura", value: 6.5 }, { label: "Final", value: 8, tone: "good" }, { label: "bad", value: NaN }], { label: "Precisión por fase" });
  assert.strictEqual(chart.getAttribute("aria-label"), "Precisión por fase");
  const svg = findAll(chart, (el) => el.tagName === "SVG")[0];
  assert.strictEqual(svg.getAttribute("aria-hidden"), "true");
  assert.strictEqual(findAll(chart, byClass("chart-bar")).length, 2, "non-finite values are dropped");
  const rows = findAll(chart, (el) => el.tagName === "TR");
  assert.strictEqual(rows.length, 3, "header + 2 data rows");
  assert.ok(rows[1].textContent.includes("Apertura") && rows[1].textContent.includes("6.5"));
  assert.ok(findAll(chart, byClass("chart-bar"))[1].classList.contains("chart-bar-good"));
  const empty = ui.barChart([]);
  assert.ok(empty.classList.contains("chart-empty"));
  const custom = ui.barChart([{ label: "x", value: 1, color: "red;background:url(evil)" }, { label: "y", value: 2, color: "#ff0000" }]);
  const bars = findAll(custom, byClass("chart-bar"));
  assert.strictEqual(bars[0].style.props && bars[0].style.props["--bar-color"], undefined, "unsafe colours are ignored");
  assert.strictEqual(bars[1].style.props["--bar-color"], "#ff0000");
});

test("chip, badge, qualityBadge, button, progress, stat, skeleton, emptyState", () => {
  const { ui, Ludus } = createEnv();
  Ludus.i18n.register({ es: { "quality.blunder": "Error grave" }, en: { "quality.blunder": "Serious mistake" } });
  assert.ok(ui.chip("Tag", { tone: "gold", icon: "star" }).classList.contains("chip-gold"));
  assert.ok(ui.badge("3", { tone: "danger" }).classList.contains("badge-danger"));
  const q = ui.qualityBadge("blunder");
  assert.ok(q.classList.contains("q-blunder") && q.classList.contains("q-badge"));
  assert.ok(q.textContent.includes("??") && q.textContent.includes("Error grave"), "glyph and label, not colour alone");
  assert.ok(ui.qualityBadge("nonsense").classList.contains("q-no_move"));
  assert.strictEqual(ui.QUALITY_CODES.length, 10);

  const clicks = [];
  const primary = ui.button("Ir", { kind: "primary", size: "lg", icon: "arrow-right", onClick: () => clicks.push(1), loading: true, block: true });
  assert.ok(primary.classList.contains("btn") && primary.classList.contains("btn-primary") && primary.classList.contains("btn-lg") && primary.classList.contains("btn-block"));
  assert.strictEqual(primary.getAttribute("aria-busy"), "true");
  assert.strictEqual(primary.getAttribute("type"), "button");
  primary.click();
  assert.strictEqual(clicks.length, 1);
  const link = ui.button("Web", { href: "https://example.org", disabled: true });
  assert.strictEqual(link.tagName, "A");
  assert.strictEqual(link.getAttribute("aria-disabled"), "true");
  const icon = ui.iconButton("settings", "Ajustes", { size: "sm" });
  assert.strictEqual(icon.getAttribute("aria-label"), "Ajustes");
  assert.ok(icon.classList.contains("btn-icon"));

  const p = ui.progress(0.5, { label: "Nivel" });
  assert.strictEqual(p.getAttribute("role"), "progressbar");
  assert.strictEqual(p.getAttribute("aria-valuenow"), "50");
  assert.strictEqual(findAll(p, byClass("progress-bar"))[0].style.width, "50%");
  assert.strictEqual(ui.progress(3, { max: 2 }).getAttribute("aria-hidden"), "true");
  assert.strictEqual(findAll(ui.progress(9, { max: 2 }), byClass("progress-bar"))[0].style.width, "100%");

  const s = ui.stat({ label: "Racha", value: 7, hint: "días", icon: "flame" });
  assert.ok(s.textContent.includes("Racha") && s.textContent.includes("7") && s.textContent.includes("días"));
  assert.strictEqual(findAll(ui.skeleton({ lines: 3 }), byClass("skeleton")).length, 3);
  assert.strictEqual(ui.skeleton({ kind: "card" }).getAttribute("aria-hidden"), "true");

  const empty = ui.emptyState({ icon: "book", title: "Nada", body: "Aún no hay", action: { label: "Empezar", onClick() {} }, level: 2 });
  assert.strictEqual(findAll(empty, (el) => el.tagName === "H2").length, 1);
  assert.strictEqual(findAll(empty, (el) => el.tagName === "BUTTON").length, 1);
});

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

test("miniBoard: 64 squares, 32 pieces, correct placement for the start position", () => {
  const { ui } = createEnv();
  const board = ui.miniBoard(START_FEN, { size: 200 });
  assert.strictEqual(board.getAttribute("role"), "img");
  assert.strictEqual(board.getAttribute("viewBox"), "0 0 80 80");
  assert.strictEqual(board.getAttribute("width"), "200");
  const squares = findAll(board, byClass("mb-sq"));
  assert.strictEqual(squares.length, 64);
  assert.strictEqual(squares.filter(byClass("mb-light")).length, 32);
  // a1 is a dark square; h1 is a light one.
  assert.ok(squares.find((s) => s.getAttribute("data-square") === "a1").classList.contains("mb-dark"));
  assert.ok(squares.find((s) => s.getAttribute("data-square") === "h1").classList.contains("mb-light"));
  const pieces = findAll(board, byClass("mb-piece"));
  assert.strictEqual(pieces.length, 32);
  const at = (piece) => pieces.filter((p) => p.getAttribute("data-piece") === piece);
  assert.strictEqual(at("wP").length, 8);
  assert.strictEqual(at("bK").length, 1);
  // White king on e1 = file 4 (x 40), rank 1 (bottom row, y 70); black queen on d8 = x 30, y 0.
  const wk = at("wK")[0];
  assert.strictEqual(wk.getAttribute("x"), "40");
  assert.strictEqual(wk.getAttribute("y"), "70");
  assert.strictEqual(wk.getAttribute("href"), "assets/pieces/cburnett/wK.svg");
  const bq = at("bQ")[0];
  assert.strictEqual(bq.getAttribute("x"), "30");
  assert.strictEqual(bq.getAttribute("y"), "0");
});

test("miniBoard: a known middlegame FEN puts pieces where the FEN says", () => {
  const { ui } = createEnv();
  const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
  const board = ui.miniBoard(fen);
  const pieces = findAll(board, byClass("mb-piece"));
  const place = (piece) => pieces.filter((p) => p.getAttribute("data-piece") === piece).map((p) => [Number(p.getAttribute("x")) / 10, 7 - Number(p.getAttribute("y")) / 10]);
  assert.deepStrictEqual(place("wQ"), [[7, 4]], "queen on h5");
  assert.deepStrictEqual(place("wB").sort(), [[2, 0], [2, 3]].sort(), "bishops on c1 and c4");
  assert.deepStrictEqual(place("bN").sort(), [[2, 5], [5, 5]].sort(), "knights on c6 and f6");
  assert.strictEqual(pieces.length, 32, "all 32 pieces of this position");
});

test("miniBoard: black orientation mirrors the board", () => {
  const { ui } = createEnv();
  const board = ui.miniBoard(START_FEN, { orientation: "b" });
  assert.strictEqual(board.getAttribute("data-orientation"), "b");
  const wk = findAll(board, byClass("mb-piece")).find((p) => p.getAttribute("data-piece") === "wK");
  // e1 seen from Black: file e -> column 7-4 = 3 (x 30), rank 1 at the top (y 0).
  assert.strictEqual(wk.getAttribute("x"), "30");
  assert.strictEqual(wk.getAttribute("y"), "0");
  const first = findAll(board, byClass("mb-sq"))[0];
  assert.strictEqual(first.getAttribute("data-square"), "h1", "top-left is h1 when Black is at the bottom");
});

test("miniBoard: highlights, arrows, coordinates, theme, invalid input", () => {
  const { ui } = createEnv();
  const board = ui.miniBoard(START_FEN, {
    highlight: ["e2", { square: "e4", kind: "best" }, "z9"],
    arrows: [{ from: "e2", to: "e4", color: "best" }, { from: "g1", to: "f3", color: "#ff00aa" }, { from: "a1", to: "a1" }, { from: "x", to: "y" }],
    coords: true,
    theme: "ocean",
  });
  const hls = findAll(board, byClass("mb-hl"));
  assert.strictEqual(hls.length, 2, "an invalid square is skipped");
  assert.ok(hls[1].classList.contains("mb-hl-best"));
  assert.strictEqual(hls[0].getAttribute("x"), "40");
  assert.strictEqual(findAll(board, byClass("mb-arrow")).length, 2, "same-square and malformed arrows are skipped");
  assert.strictEqual(findAll(board, byClass("mb-arrow"))[0].style.props["--mb-c"], "var(--color-perfect)");
  assert.strictEqual(findAll(board, byClass("mb-arrow"))[1].style.props["--mb-c"], "#ff00aa");
  assert.strictEqual(findAll(board, byClass("mb-coord")).length, 16);
  assert.strictEqual(board.getAttribute("data-board-theme"), "ocean");
  const evilTheme = ui.miniBoard(START_FEN, { theme: 'x" onload="alert(1)' });
  assert.strictEqual(evilTheme.getAttribute("data-board-theme"), null);
  const unsafeArrow = ui.miniBoard(START_FEN, { arrows: [{ from: "e2", to: "e4", color: "red; x:url(a)" }] });
  assert.strictEqual(findAll(unsafeArrow, byClass("mb-arrow"))[0].style.props["--mb-c"], "var(--color-gold)");
  const invalid = ui.miniBoard("not a fen");
  assert.strictEqual(findAll(invalid, byClass("mb-sq")).length, 64);
  assert.strictEqual(findAll(invalid, byClass("mb-piece")).length, 0);
  assert.strictEqual(invalid.getAttribute("aria-label"), "Posición no válida.");
  assert.strictEqual(ui.miniBoard(undefined).getAttribute("aria-label"), "Posición no válida.");
});

test("miniBoard: aria-label states whose move it is and lists the pieces (es and en)", () => {
  const es = createEnv({ language: "es" });
  const label = es.ui.miniBoard(START_FEN, { label: "Partida de Fischer" }).getAttribute("aria-label");
  assert.ok(label.startsWith("Partida de Fischer. Posición de ajedrez: juegan las blancas."), label);
  assert.ok(label.includes("Blancas: Rey e1, Dama d1"), label);
  assert.ok(label.includes("Negras: Rey e8"), label);
  const blackToMove = es.ui.miniBoard("4k3/8/8/8/8/8/8/4K3 b - - 0 1").getAttribute("aria-label");
  assert.ok(blackToMove.includes("juegan las negras"), blackToMove);
  const en = createEnv({ language: "en" });
  const enLabel = en.ui.miniBoard(START_FEN).getAttribute("aria-label");
  assert.ok(enLabel.startsWith("Chess position: White to move."), enLabel);
  assert.ok(enLabel.includes("White: King e1, Queen d1"), enLabel);
  assert.strictEqual(en.ui.miniBoard("8/8/8/8/8/8/8/8 w - - 0 1").getAttribute("aria-label"), "Board without pieces.");
});

test("parseFen rejects malformed placements", () => {
  const { ui } = createEnv();
  assert.strictEqual(ui.parseFen("8/8/8/8/8/8/8"), null);
  assert.strictEqual(ui.parseFen("9/8/8/8/8/8/8/8"), null);
  assert.strictEqual(ui.parseFen("rnbqkbnr/ppppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"), null);
  assert.strictEqual(ui.parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNX"), null);
  assert.strictEqual(ui.parseFen(42), null);
  assert.strictEqual(ui.parseFen(START_FEN).pieces.length, 32);
});

test("toast: roles, kinds, queue of three, dismiss, action, pause on hover", () => {
  const { ui, doc, advance } = createEnv();
  const info = ui.toast("Guardado", { kind: "success", duration: 1000 });
  const stack = doc.body.children.find((c) => c.classList.contains("toast-stack"));
  assert.ok(stack, "stack is attached to the body");
  assert.strictEqual(stack.getAttribute("role"), "region");
  const lists = stack.children;
  const alertList = lists.find((l) => l.getAttribute("role") === "alert");
  const politeList = lists.find((l) => l.getAttribute("aria-live") === "polite");
  assert.ok(alertList && politeList);
  assert.strictEqual(politeList.children.length, 1);
  assert.ok(info.el.textContent.includes("Guardado"));
  assert.ok(info.el.textContent.includes("Listo"), "the kind is also written in words (no colour-only meaning)");
  ui.toast("Falló", { kind: "error", duration: 0 });
  assert.strictEqual(alertList.children.length, 1, "errors go to the assertive region");

  // Queue: at most 3 visible.
  ui.toast("uno", { duration: 0 });
  ui.toast("dos", { duration: 0 });
  assert.strictEqual(ui._state.toast.visible.length, 3);
  assert.strictEqual(ui._state.toast.queue.length, 1, "the fourth toast waits");
  advance(1400);
  assert.strictEqual(ui._state.toast.visible.length, 3, "the waiting toast took the freed slot");
  assert.strictEqual(ui._state.toast.queue.length, 0);
  ui.clearToasts();
  assert.strictEqual(ui._state.toast.visible.length, 0);

  // Action + dismiss button + pause on hover. A toast with an action is raised to 12 s (a keyboard user cannot reach
  // "Undo" in 3 s), so 2 s elapsed leave 10 s after resuming.
  const calls = [];
  const withAction = ui.toast("Borrado", { duration: 3000, action: { label: "Deshacer", onClick: () => calls.push("undo") } });
  const buttons = findAll(withAction.el, (el) => el.tagName === "BUTTON");
  assert.strictEqual(buttons.length, 2);
  assert.strictEqual(buttons[1].getAttribute("aria-label"), "Cerrar aviso");
  advance(2000);
  withAction.el.dispatch("mouseenter");
  advance(20000);
  assert.strictEqual(ui._state.toast.visible.length, 1, "hovering keeps the toast");
  withAction.el.dispatch("mouseleave");
  advance(9000);
  assert.strictEqual(ui._state.toast.visible.length, 1, "an action toast asked for 3 s lasts 12 s: 10 s remain after resuming");
  advance(1200);
  assert.strictEqual(ui._state.toast.visible.length, 0);
  const again = ui.toast("Otra", { duration: 0, action: { label: "Deshacer", onClick: () => calls.push("undo") } });
  findAll(again.el, (el) => el.tagName === "BUTTON")[0].click();
  assert.deepStrictEqual(calls, ["undo"]);
  assert.strictEqual(ui._state.toast.visible.length, 0);
  // dismiss() through the handle also works for queued toasts.
  ui.clearToasts();
  const a = ui.toast("a", { duration: 0 });
  ui.toast("b", { duration: 0 });
  ui.toast("c", { duration: 0 });
  const queued = ui.toast("d", { duration: 0 });
  assert.strictEqual(ui._state.toast.queue.length, 1);
  queued.dismiss();
  assert.strictEqual(ui._state.toast.queue.length, 0);
  a.dismiss();
  assert.strictEqual(ui._state.toast.visible.length, 2);
  ui.clearToasts();
});

test("toast: an action toast is reachable from the keyboard (time, persistence, focus, Escape)", () => {
  const { ui, doc, advance } = createEnv();
  // Time: the default with an action is 12 s, a shorter explicit duration is raised, 0 and persistent keep it.
  const plain = ui.toast("Listo");
  const withAction = ui.toast("Borrado", { action: { label: "Deshacer", onClick() {} } });
  advance(6000);
  assert.strictEqual(ui._state.toast.visible.length, 1, "the plain toast went at 5.2 s, the action one is still there");
  advance(6100);
  assert.strictEqual(ui._state.toast.visible.length, 0, "and it goes after 12 s");
  assert.ok(plain && withAction);
  const persistent = ui.toast("Quedate", { persistent: true });
  const zero = ui.toast("Quedate también", { duration: 0, action: { label: "Deshacer" } });
  advance(600000);
  assert.strictEqual(ui._state.toast.visible.length, 2, "persistent: true and duration: 0 stay until dismissed");
  persistent.dismiss();
  zero.dismiss();

  // Focus: opt-in; it goes to the action and comes back to the trigger when the toast is gone.
  const trigger = doc.createElement("button");
  doc.body.appendChild(trigger);
  trigger.focus();
  const calls = [];
  const undo = ui.toast("Sección restablecida", { focus: true, action: { label: "Deshacer", onClick: () => calls.push("undo") } });
  const actionBtn = findAll(undo.el, (el) => el.tagName === "BUTTON" && el.classList.contains("toast-action"))[0];
  assert.strictEqual(doc.activeElement, actionBtn, "focus: true puts the keyboard on Undo");
  actionBtn.click();
  assert.deepStrictEqual(calls, ["undo"]);
  assert.strictEqual(doc.activeElement, trigger, "after Undo the focus is back where the person was");

  // Escape on a focused toast closes it and gives the focus back; without focus: true nothing is moved.
  trigger.focus();
  const second = ui.toast("Otra", { focus: true, action: { label: "Deshacer" } });
  assert.notStrictEqual(doc.activeElement, trigger);
  second.el.dispatch("keydown", { key: "Escape" });
  assert.strictEqual(ui._state.toast.visible.length, 0, "Escape dismisses the toast that has the focus");
  assert.strictEqual(doc.activeElement, trigger);
  trigger.focus();
  ui.toast("Sin robar foco", { action: { label: "Deshacer" } });
  assert.strictEqual(doc.activeElement, trigger, "by default a toast never takes the focus");
  ui.clearToasts();
});

test("modal: describedBy accepts true, an id, an element or a list; an alertdialog is described by its body", () => {
  const { ui, doc } = createEnv();
  const dialog = (opts) => ui.modal(Object.assign({ title: "Borrar", body: "Se borra para siempre" }, opts));
  const plain = dialog({});
  assert.strictEqual(plain.el.getAttribute("aria-describedby"), null, "a plain dialog is described by its title only");
  plain.close();
  const whole = dialog({ describedBy: true });
  assert.ok(/^ui-modal-\d+-body$/.test(whole.el.getAttribute("aria-describedby")), "true points at the body");
  whole.close();
  const warning = doc.createElement("p");
  const node = dialog({ body: [warning, doc.createElement("input")], describedBy: warning });
  assert.ok(warning.id, "an element without an id is given one");
  assert.strictEqual(node.el.getAttribute("aria-describedby"), warning.id, "an element is referenced by its id");
  node.close();
  assert.strictEqual(dialog({ describedBy: "a-id" }).el.getAttribute("aria-describedby"), "a-id");
  const both = dialog({ describedBy: ["x-1", warning] });
  assert.strictEqual(both.el.getAttribute("aria-describedby"), `x-1 ${warning.id}`);
  const alert = dialog({ role: "alertdialog" });
  assert.ok(/-body$/.test(alert.el.getAttribute("aria-describedby")), "an alertdialog reads its message on opening");
  alert.close();
  assert.strictEqual(dialog({ role: "alertdialog", describedBy: false }).el.getAttribute("aria-describedby"), null, "unless told otherwise");
  ui.clearToasts();
});

test("toast: the achievement and level-up kinds app.js uses have their own look and stay polite", () => {
  const { ui } = createEnv();
  const a = ui.toast("Logro desbloqueado: Primer paso", { kind: "achievement", duration: 0 });
  const l = ui.toast("Subiste de nivel", { kind: "levelup", duration: 0 });
  assert.strictEqual(a.el.getAttribute("data-kind"), "achievement");
  assert.ok(a.el.classList.contains("toast-achievement") && l.el.classList.contains("toast-levelup"));
  assert.ok(a.el.textContent.includes("Logro."), "the kind is spoken too");
  assert.strictEqual(a.el.parentNode.getAttribute("aria-live"), "polite", "celebrations never interrupt");
  ui.clearToasts();
});

test("toast: invalid options fall back to safe defaults", () => {
  const { ui } = createEnv();
  const handle = ui.toast(undefined, { kind: "explode", duration: -5 });
  assert.strictEqual(handle.el.getAttribute("data-kind"), "info");
  handle.dismiss();
  ui.clearToasts();
});

test("modal: ARIA, scroll lock, inert background, Escape, focus restore, promise", async () => {
  const { ui, doc, advance } = createEnv();
  const app = doc.createElement("div");
  doc.body.appendChild(app);
  const opener = doc.createElement("button");
  app.appendChild(opener);
  opener.focus();
  const closedWith = [];
  const handle = ui.modal({
    title: "Nuevo perfil",
    body: [doc.createElement("input")],
    actions: [{ label: "Crear", kind: "primary", value: "ok" }, { label: "Cancelar", kind: "secondary" }],
    onClose: (result) => closedWith.push(result),
  });
  assert.strictEqual(handle.el.getAttribute("role"), "dialog");
  assert.strictEqual(handle.el.getAttribute("aria-modal"), "true");
  const titleId = handle.el.getAttribute("aria-labelledby");
  const title = findAll(handle.el, (el) => el.getAttribute("id") === titleId)[0];
  assert.strictEqual(title.textContent, "Nuevo perfil");
  assert.ok(doc.body.classList.contains("ui-scroll-lock"));
  assert.strictEqual(app.getAttribute("inert"), "", "the page behind is inert");
  advance(0);
  assert.strictEqual(doc.activeElement.tagName, "INPUT", "focus goes to the first control of the body");

  // Escape closes the top-most dialog, restores focus, unlocks scroll and resolves the promise.
  const backdrop = handle.el.parentNode;
  backdrop.dispatch("keydown", { key: "Escape" });
  assert.deepStrictEqual(closedWith, ["escape"]);
  assert.strictEqual(await handle.closed, "escape");
  assert.strictEqual(doc.activeElement, opener, "focus returns to the opener");
  assert.ok(!doc.body.classList.contains("ui-scroll-lock"));
  assert.strictEqual(app.hasAttribute("inert"), false);
  advance(400);
  assert.ok(!backdrop.parentNode, "the dialog is removed after its exit");
  handle.close("again");
  assert.deepStrictEqual(closedWith, ["escape"], "closing twice is a no-op");
});

test("modal: non-dismissible ignores Escape and backdrop; action results; keep-open action", async () => {
  const { ui, doc, advance } = createEnv();
  let kept = 0;
  const handle = ui.modal({
    title: "Importante",
    body: "texto",
    dismissible: false,
    actions: [
      { label: "Reintentar", kind: "primary", onClick: () => { kept += 1; return false; } },
      { label: "Salir", value: "salir", kind: "danger" },
    ],
  });
  const backdrop = handle.el.parentNode;
  assert.strictEqual(findAll(handle.el, byClass("modal-close")).length, 0, "no close button");
  backdrop.dispatch("keydown", { key: "Escape" });
  backdrop.dispatch("mousedown", { target: backdrop });
  backdrop.dispatch("click", { target: backdrop });
  assert.ok(handle.el.isConnected, "still open");
  const [retry, quit] = findAll(handle.el, (el) => el.tagName === "BUTTON");
  retry.click();
  assert.strictEqual(kept, 1);
  assert.ok(handle.el.isConnected, "an action returning false keeps the dialog open");
  quit.click();
  assert.strictEqual(await handle.closed, "salir");
  advance(400);
  assert.ok(!handle.el.isConnected);
});

test("modal: backdrop click dismisses only when the press started on the backdrop", async () => {
  const { ui } = createEnv();
  const handle = ui.modal({ title: "x", body: "y" });
  const backdrop = handle.el.parentNode;
  backdrop.dispatch("mousedown", { target: handle.el });
  backdrop.dispatch("click", { target: backdrop });
  assert.ok(handle.el.isConnected, "a drag that started inside must not close it");
  backdrop.dispatch("mousedown", { target: backdrop });
  backdrop.dispatch("click", { target: backdrop });
  assert.strictEqual(await handle.closed, "backdrop");
});

test("modal: Tab and Shift+Tab are trapped inside the dialog", () => {
  const { ui, doc, advance } = createEnv();
  const handle = ui.modal({ title: "Trampa", body: [doc.createElement("input")], actions: [{ label: "A" }, { label: "B" }] });
  advance(0);
  const focusables = findAll(handle.el, (el) => ["BUTTON", "INPUT"].includes(el.tagName));
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const backdrop = handle.el.parentNode;
  last.focus();
  const forward = backdrop.dispatch("keydown", { key: "Tab" });
  assert.ok(forward.defaultPrevented);
  assert.strictEqual(doc.activeElement, first, "Tab from the last control wraps to the first");
  first.focus();
  const backward = backdrop.dispatch("keydown", { key: "Tab", shiftKey: true });
  assert.ok(backward.defaultPrevented);
  assert.strictEqual(doc.activeElement, last, "Shift+Tab from the first control wraps to the last");
  handle.close();
});

test("modal: nested dialogs; only the top one reacts to Escape and inert is restored in order", async () => {
  const { ui, doc } = createEnv();
  const page = doc.createElement("main");
  doc.body.appendChild(page);
  const outer = ui.modal({ title: "Fuera", body: "a" });
  const inner = ui.modal({ title: "Dentro", body: "b" });
  assert.strictEqual(outer.el.parentNode.getAttribute("inert"), "", "the lower dialog is inert while another is on top");
  inner.el.parentNode.dispatch("keydown", { key: "Escape" });
  assert.strictEqual(await inner.closed, "escape");
  assert.strictEqual(outer.el.parentNode.hasAttribute("inert"), false);
  assert.strictEqual(page.getAttribute("inert"), "", "the page stays inert while the outer dialog is open");
  assert.ok(doc.body.classList.contains("ui-scroll-lock"));
  outer.close("x");
  assert.strictEqual(page.hasAttribute("inert"), false);
  assert.ok(!doc.body.classList.contains("ui-scroll-lock"));
});

test("sheet is a modal with the sheet variant", () => {
  const { ui } = createEnv();
  const handle = ui.sheet({ title: "Más", body: "x" });
  assert.ok(handle.el.classList.contains("sheet"));
  assert.ok(handle.el.parentNode.classList.contains("is-sheet"));
  assert.strictEqual(findAll(handle.el, byClass("sheet-handle")).length, 1);
  handle.close();
});

test("confirm: resolves true/false, Escape is false, danger focuses Cancel", async () => {
  const { ui, doc, advance } = createEnv();
  const yes = ui.confirm({ title: "¿Borrar?", body: "No se puede deshacer", confirmLabel: "Borrar", cancelLabel: "Mejor no", danger: true });
  advance(0);
  const dialog = lastDialog(doc);
  assert.ok(dialog, "confirm is an alertdialog");
  assert.ok(dialog.getAttribute("aria-describedby"));
  const buttons = findAll(dialog, (el) => el.tagName === "BUTTON" && !el.classList.contains("modal-close"));
  assert.deepStrictEqual(buttons.map((b) => b.textContent), ["Mejor no", "Borrar"]);
  assert.ok(buttons[1].classList.contains("btn-danger"));
  assert.strictEqual(doc.activeElement, buttons[0], "destructive confirm starts on Cancel");
  buttons[1].click();
  assert.strictEqual(await yes, true);

  const no = ui.confirm({ title: "¿Seguro?" });
  const dialog2 = lastDialog(doc);
  findAll(dialog2, (el) => el.tagName === "BUTTON" && !el.classList.contains("modal-close"))[0].click();
  assert.strictEqual(await no, false);

  const esc = ui.confirm({ title: "¿Otra vez?" });
  const dialog3 = lastDialog(doc);
  dialog3.parentNode.dispatch("keydown", { key: "Escape" });
  assert.strictEqual(await esc, false);

  const closeBtn = ui.confirm({ title: "x" });
  const dialog4 = lastDialog(doc);
  findAll(dialog4, byClass("modal-close"))[0].click();
  assert.strictEqual(await closeBtn, false);

  const plain = ui.confirm({ title: "Por defecto" });
  const dialog5 = lastDialog(doc);
  const labels = findAll(dialog5, (el) => el.tagName === "BUTTON" && !el.classList.contains("modal-close")).map((b) => b.textContent);
  assert.deepStrictEqual(labels, ["Cancelar", "Confirmar"], "default labels come from i18n");
  assert.strictEqual(doc.activeElement.textContent, "Confirmar", "a plain confirm starts on the confirm button");
  findAll(dialog5, (el) => el.tagName === "BUTTON" && el.textContent === "Confirmar")[0].click();
  assert.strictEqual(await plain, true);
});

test("English strings when the language is en", () => {
  const { ui } = createEnv({ language: "en" });
  const handle = ui.modal({ title: "T", body: "b" });
  assert.strictEqual(findAll(handle.el, byClass("modal-close"))[0].getAttribute("aria-label"), "Close");
  handle.close();
  assert.strictEqual(ui.gauge({ value: 2, label: "Score" }).getAttribute("aria-label"), "Score: 2 out of 10");
});

test("no document: builders answer null, toast/modal/confirm degrade instead of throwing", async () => {
  const { ui } = createEnv({ withDocument: false });
  assert.strictEqual(ui.icon("home"), null);
  assert.strictEqual(ui.gauge({ value: 3 }), null);
  assert.strictEqual(ui.miniBoard(START_FEN), null);
  assert.strictEqual(ui.avatar({ name: "A" }), null);
  const handle = ui.toast("hola");
  assert.strictEqual(handle.el, null);
  handle.dismiss();
  const m = ui.modal({ title: "x" });
  assert.strictEqual(await m.closed, "no-document");
  assert.strictEqual(await ui.confirm({ title: "x" }), false);
  assert.strictEqual(ui.parseFen(START_FEN).turn, "w");
  assert.strictEqual(ui.reducedMotion(), false);
});

runAll().then(() => {
  console.log(`kit.test.js: ${passed} tests passed`);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
