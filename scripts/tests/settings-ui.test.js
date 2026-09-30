// Tests for the Settings screen (js/ui/settings.js) against the real Settings, Scoring, Audio and kit
// modules and the fake DOM of _uidom.js.
//
// Covers: text parity es / en; the pure helpers (sections cover every schema path once, control kinds,
// value formatting, showWhen rules, the wait estimate, the centipawn <-> win% conversion, the summary
// chips, what "reset" would change); the LIVE PREVIEW (Scoring.assess on the canned lines: values under the
// defaults and how every setting moves them); and the screen: one row per schema path, controls by type,
// the theme picker, live application through Settings.set, in-place repaint on an outside change, showWhen
// rows, per-section reset with undo, reset all with confirm, the clock presets and custom seconds, the
// sound tests, language switch, and the degradation without Scoring / Audio / the kit / an unknown schema entry.

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { FakeDocument, findAll } = require("./_uidom.js");
const { createFakeLocalStorage } = require("./_fakedom.js");

const repoRoot = path.resolve(__dirname, "..", "..");
const SCRIPTS = ["js/ludus.js", "js/scoring.js", "js/settings.js", "js/audio.js", "js/ui/kit.js", "js/ui/settings.js"];

function createEnv({ language = "es", skip = [], storage } = {}) {
  const doc = new FakeDocument();
  const storageMap = new Map();
  const clock = { now: 0, seq: 0, timers: new Map() };
  const sandbox = {
    console, Date, Math, JSON, Object, Array, String, Number, Promise, Map, Set, Intl, URL, structuredClone, WeakMap, WeakSet, performance: { now: () => clock.now },
    setTimeout(fn, ms) { clock.seq += 1; clock.timers.set(clock.seq, { at: clock.now + Number(ms || 0), fn }); return clock.seq; },
    clearTimeout(id) { clock.timers.delete(id); },
    document: doc,
    navigator: { languages: [language], language },
    localStorage: storage || createFakeLocalStorage(storageMap),
    location: { hash: "", pathname: "/", search: "" },
    addEventListener() {},
    removeEventListener() {},
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  SCRIPTS.filter((rel) => !skip.includes(rel)).forEach((rel) => vm.runInContext(fs.readFileSync(path.join(repoRoot, rel), "utf8"), context, { filename: rel }));
  const Ludus = context.Ludus;
  Ludus.i18n.setLanguage(language, { persist: false });
  if (Ludus.ui) Ludus.ui._setTimers({ setTimeout: sandbox.setTimeout, clearTimeout: sandbox.clearTimeout, raf(fn) { fn(); }, now: () => clock.now });
  const mk = (tag, attrs) => {
    const el = doc.createElement(tag);
    Object.keys(attrs || {}).forEach((key) => el.setAttribute(key, attrs[key]));
    return el;
  };
  const app = mk("div", { class: "app" });
  doc.body.appendChild(app);
  const el = mk("section", { id: "screen-settings", class: "screen hidden" });
  const other = mk("section", { id: "screen-home", class: "screen hidden" });
  app.appendChild(el);
  app.appendChild(other);
  Ludus.router.register("settings", { el, onShow: (params) => Ludus.Screens.settings.show(params), onHide: () => Ludus.Screens.settings.hide() });
  Ludus.router.register("home", { el: other });
  return { Ludus, doc, el, sandbox, storageMap };
}

const text = (node) => node.textContent.replace(/\s+/g, " ").trim();
const q = (root, selector) => root.querySelector(selector);
const qa = (root, selector) => root.querySelectorAll(selector);
const plain = (value) => JSON.parse(JSON.stringify(value));
const deepEq = (actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message);
const placeholders = (string) => Array.from(String(string).matchAll(/\{(\w+)\}/g), (m) => m[1]).sort().join(",");
const row = (el, pathName) => q(el, `[data-path="${pathName}"]`);
const isHidden = (node) => node.hasAttribute("hidden");
const points = (rows, id) => rows.find((entry) => entry.id === id);

function mountAndShow(env) {
  env.Ludus.Screens.settings.mount(env.el);
  env.Ludus.router.show("settings");
  return env;
}

function pick(el, pathName, value) {
  const label = q(row(el, pathName), `label[data-value="${String(value)}"]`);
  assert.ok(label, `no tile ${pathName}=${value}`);
  const input = q(label, "input");
  input.checked = true;
  input.dispatch("change");
}

function isChecked(el, pathName, value) {
  const label = q(row(el, pathName), `label[data-value="${String(value)}"]`);
  return Boolean(q(label, "input").checked);
}

let passed = 0;
const pending = [];
function test(name, fn) {
  pending.push({ name, fn });
}
async function runAll() {
  for (const { name, fn } of pending) {
    let watchdog = null;
    try {
      await Promise.race([fn(), new Promise((_, reject) => { watchdog = setTimeout(() => reject(new Error(`test never settled: ${name}`)), 8000); })]);
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

// ---------- pure ----------

test("text: es and en have the same keys and placeholders, none empty, both use the settings prefixes; the title key resolves", () => {
  const { Ludus } = createEnv();
  const { es, en } = Ludus.Screens.settings.TEXT;
  deepEq(Object.keys(es).sort(), Object.keys(en).sort());
  Object.keys(es).forEach((key) => {
    assert.ok(es[key].length > 0 && en[key].length > 0, `${key} is empty`);
    assert.strictEqual(placeholders(es[key]), placeholders(en[key]), `${key}: placeholders differ`);
    assert.ok(key.startsWith("settings."), key);
  });
  assert.strictEqual(Ludus.Screens.settings.titleKey, "settings.title");
  assert.strictEqual(Ludus.i18n.t("settings.title", null, "es"), "Ajustes");
  assert.strictEqual(Ludus.i18n.t("settings.title", null, "en"), "Settings");
  assert.ok(es["settings.section.judge.lead"].includes("elegís") && es["settings.ui.sound.testHint"].includes("Tocá"), "rioplatense");
});

test("text: every option of the schema has a label in both languages (the screen never shows a raw key)", () => {
  const { Ludus } = createEnv();
  Ludus.Settings.schema.forEach((spec) => {
    ["es", "en"].forEach((lng) => {
      assert.notStrictEqual(Ludus.i18n.t(spec.labelKey, null, lng), spec.labelKey, `${spec.labelKey} ${lng}`);
      assert.notStrictEqual(Ludus.i18n.t(spec.hintKey, null, lng), spec.hintKey, `${spec.hintKey} ${lng}`);
      (spec.options || []).forEach((option) => assert.notStrictEqual(Ludus.i18n.t(option.labelKey, null, lng), option.labelKey, `${option.labelKey} ${lng}`));
    });
  });
});

test("sections: every schema path is in exactly one section; an unclaimed group lands in a trailing one", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.settings.helpers;
  const sections = h.buildSections(Ludus.Settings.schema, Ludus.Settings.groups);
  deepEq(sections.map((section) => section.id), ["board", "judge", "play", "sound", "access"]);
  const all = sections.flatMap((section) => section.paths);
  deepEq(all.slice().sort(), Ludus.Settings.schema.map((spec) => spec.path).sort());
  assert.strictEqual(new Set(all).size, all.length, "no path twice");
  // haptics belongs to the sound group although its path has no "sound."
  assert.ok(sections.find((section) => section.id === "sound").paths.includes("haptics"));
  const extra = Ludus.Settings.schema.concat([{ path: "lab.x", group: "lab", type: "boolean", default: false, labelKey: "a", hintKey: "b" }]);
  const withExtra = h.buildSections(extra, Ludus.Settings.groups.concat([{ id: "lab", labelKey: "x", hintKey: "y" }]));
  deepEq(withExtra.map((section) => section.id), ["board", "judge", "play", "sound", "access", "more"]);
  deepEq(withExtra[5].paths, ["lab.x"]);
  const orphan = h.buildSections(extra, Ludus.Settings.groups);
  deepEq(orphan[orphan.length - 1].paths, ["lab.x"], "a group missing from the groups list is still shown");
  deepEq(h.buildSections([], []), []);
  deepEq(h.buildSections(null, null), []);
});

test("controlKind: switch, tiles, slider, number and select by type; nothing for an unknown type", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.settings.helpers;
  const spec = (path) => Ludus.Settings.schema.find((entry) => entry.path === path);
  assert.strictEqual(h.controlKind(spec("board.coords")), "switch");
  assert.strictEqual(h.controlKind(spec("board.theme")), "tiles");
  assert.strictEqual(h.controlKind(spec("sound.volume")), "slider");
  assert.strictEqual(h.controlKind(spec("clock.seconds")), "slider");
  assert.strictEqual(h.controlKind({ type: "number", min: 0, max: 100000, step: 1 }), "number");
  assert.strictEqual(h.controlKind({ type: "enum", options: [1, 2, 3, 4, 5, 6, 7] }), "select");
  assert.strictEqual(h.controlKind({ type: "mystery" }), "none");
  assert.strictEqual(h.controlKind(null), "none");
});

test("formatValue: percent, milliseconds, seconds and plain numbers, in both languages", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.settings.helpers;
  const spec = (path) => Ludus.Settings.schema.find((entry) => entry.path === path);
  assert.strictEqual(h.formatValue(spec("sound.volume"), 0.5, "en"), "50 %");
  assert.strictEqual(h.formatValue(spec("scoring.tolerancePct"), 1.5, "en"), "1.5 %");
  assert.strictEqual(h.formatValue(spec("scoring.tolerancePct"), 1.5, "es"), "1,5 %");
  assert.strictEqual(h.formatValue(spec("engine.movetimeMs"), 1500, "en"), "1.5 s");
  assert.strictEqual(h.formatValue(spec("engine.movetimeMs"), 2000, "en"), "2 s");
  assert.strictEqual(h.formatValue(spec("clock.seconds"), 90, "en"), "90 s");
  assert.strictEqual(h.formatValue(spec("engine.multiPv"), 3, "en"), "3");
  assert.strictEqual(h.formatValue(spec("engine.multiPv"), "x", "en"), "x");
  assert.strictEqual(h.formatClock(90), "1:30");
  assert.strictEqual(h.formatClock(360), "6:00");
  assert.strictEqual(h.formatClock(5), "0:05");
  assert.strictEqual(h.formatClock("nope"), "0:00");
});

test("isVisible: showWhen and the tolerance rule", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.settings.helpers;
  const spec = (path) => Ludus.Settings.schema.find((entry) => entry.path === path);
  const get = (values) => (path) => values[path];
  assert.strictEqual(h.isVisible(spec("clock.seconds"), get({ "clock.mode": "timed" })), true);
  assert.strictEqual(h.isVisible(spec("clock.seconds"), get({ "clock.mode": "untimed" })), false);
  assert.strictEqual(h.isVisible(spec("sound.volume"), get({ "sound.enabled": false })), false);
  assert.strictEqual(h.isVisible(spec("engine.movetimeMs"), get({ "engine.strength": "custom" })), true);
  assert.strictEqual(h.isVisible(spec("engine.movetimeMs"), get({ "engine.strength": "deep" })), false);
  assert.strictEqual(h.isVisible(spec("scoring.tolerancePct"), get({ "scoring.bestMode": "engine" })), false);
  assert.strictEqual(h.isVisible(spec("scoring.tolerancePct"), get({ "scoring.bestMode": "band" })), true);
  assert.strictEqual(h.isVisible(spec("scoring.tolerancePct"), get({ "scoring.bestMode": "masters" })), true);
  assert.strictEqual(h.isVisible(spec("board.coords"), get({})), true);
  assert.strictEqual(h.isVisible(null, get({})), false);
});

test("waitEstimate follows the game core (0.8x to 1.6x, 0.3 s to 3.5 s); cpForWinLoss is about 11 cp per 1 %", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.settings.helpers;
  deepEq(h.waitEstimate(1500), { loMs: 1200, hiMs: 2400 });
  deepEq(h.waitEstimate(700), { loMs: 560, hiMs: 1120 });
  deepEq(h.waitEstimate(4000), { loMs: 3200, hiMs: 3500 });
  deepEq(h.waitEstimate(300), { loMs: 300, hiMs: 480 });
  deepEq(h.waitEstimate(10000), { loMs: 3500, hiMs: 3500 });
  deepEq(h.waitEstimate("junk"), { loMs: 1200, hiMs: 2400 });
  assert.strictEqual(h.movetimeFor({ "engine.strength": "fast" }), 700);
  assert.strictEqual(h.movetimeFor({ "engine.strength": "custom", "engine.movetimeMs": 2500 }), 2500);
  assert.strictEqual(h.movetimeFor({}), 1500);
  const one = h.cpForWinLoss(1);
  assert.ok(one >= 10 && one <= 12, `1% is ${one} cp`);
  assert.ok(h.cpForWinLoss(3) > h.cpForWinLoss(1) && h.cpForWinLoss(5) > h.cpForWinLoss(3));
  assert.strictEqual(h.cpForWinLoss(0), 0);
  assert.strictEqual(h.cpForWinLoss("x"), 0);
  // The same loss costs more centipawns when one side is already winning.
  assert.ok(h.cpForWinLoss(1, 400) > h.cpForWinLoss(1, 0));
});

test("ruleSentence: engine only, band with the tolerance in % and cp, masters with 3 %", () => {
  const { Ludus } = createEnv({ language: "en" });
  const h = Ludus.Screens.settings.helpers;
  assert.strictEqual(h.ruleSentence({ "scoring.bestMode": "engine" }, "en"), "Only the engine's move counts as the best.");
  const band = h.ruleSentence({ "scoring.bestMode": "band", "scoring.tolerancePct": 2 }, "en");
  assert.ok(band.includes("less than 2 % of win chance") && /about \d+ cp/.test(band), band);
  const masters = h.ruleSentence({ "scoring.bestMode": "masters", "scoring.tolerancePct": 1 }, "en");
  assert.ok(masters.includes("master's move") && masters.includes("3 %"), masters);
});

// ---------- the live preview ----------

test("preview under the defaults: the canned cases, in order, with the documented points and verdicts", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.settings.helpers;
  const rows = h.previewRows({ scoring: Ludus.Settings.scoringSettings(), multiPv: 3, hintsEnabled: true }, "en");
  deepEq(rows.map((entry) => entry.id), ["best", "only", "equal", "close", "master", "inaccuracy", "mistake", "blunder", "mate", "hint"]);
  const by = (id) => points(rows, id);
  assert.strictEqual(by("best").points, 10);
  assert.strictEqual(by("best").quality, "perfect");
  assert.strictEqual(by("only").quality, "great", "with 3 lines the only move is recognised");
  assert.strictEqual(by("equal").points, 10, "inside the 1 % band");
  assert.strictEqual(by("equal").isBest, true);
  assert.ok(by("close").points > 9 && by("close").points < 10, `close ${by("close").points}`);
  assert.ok(by("master").points > 8 && by("master").points < 10);
  assert.ok(by("inaccuracy").points >= 6.5 && by("inaccuracy").points <= 8, "the documented 50 cp target");
  assert.ok(by("mistake").points >= 3 && by("mistake").points <= 5, "the documented 150 cp target");
  assert.ok(by("blunder").points <= 1);
  assert.strictEqual(by("blunder").quality, "blunder");
  assert.strictEqual(by("mate").reason, "missed_mate");
  assert.ok(by("mate").points <= 1);
  assert.ok(Math.abs(by("hint").points - 8.5) < 0.05, "a level 1 hint costs 15 %");
  // Points never grow as the move gets worse.
  const order = ["best", "equal", "close", "inaccuracy", "mistake", "blunder"].map((id) => by(id).points);
  for (let i = 1; i < order.length; i += 1) assert.ok(order[i] <= order[i - 1], `monotonic at ${i}: ${order.join(", ")}`);
  assert.strictEqual(by("mistake").cp, 150);
  assert.strictEqual(by("inaccuracy").detailKey, "settings.ui.preview.detail.eval");
  assert.strictEqual(by("mate").detailKey, "settings.ui.preview.detail.mate");
});

test("preview reacts to every setting that matters, and only to those", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.settings.helpers;
  const run = (partial, extra) => h.previewRows(Object.assign({ scoring: Ludus.Scoring.normalizeSettings(partial), multiPv: 3, hintsEnabled: true }, extra || {}), "en");
  const base = run({});
  // bestMode "engine": the equivalent move is no longer worth 10
  const engine = run({ bestMode: "engine" });
  assert.ok(points(engine, "equal").points < 10 && points(engine, "equal").isBest === false);
  assert.strictEqual(points(engine, "best").points, 10);
  // a wider tolerance lifts the "slightly worse" move to 10
  const wide = run({ tolerancePct: 3 });
  assert.strictEqual(points(wide, "close").points, 10);
  assert.ok(points(wide, "inaccuracy").points > points(base, "inaccuracy").points);
  // masters: the master's move counts
  const masters = run({ bestMode: "masters" });
  assert.ok(points(masters, "master").points > points(base, "master").points);
  // strictness
  assert.ok(points(run({ strictness: "strict" }), "mistake").points < points(base, "mistake").points);
  assert.ok(points(run({ strictness: "relaxed" }), "mistake").points > points(base, "mistake").points);
  // tiers: fixed points
  const tiers = run({ model: "tiers" });
  ["best", "equal"].forEach((id) => assert.strictEqual(points(tiers, id).points, 10));
  assert.ok([10, 7.5, 5, 2.5, 0].includes(points(tiers, "inaccuracy").points), `${points(tiers, "inaccuracy").points}`);
  assert.strictEqual(points(tiers, "blunder").points, 0);
  // one line: no "only move", so "perfect" instead of "great"
  assert.strictEqual(points(run({}, { multiPv: 1 }), "only").quality, "perfect");
  assert.strictEqual(points(run({}, { multiPv: 2 }), "only").quality, "great");
  // no hints: that row is gone
  assert.ok(!points(run({}, { hintsEnabled: false }), "hint"));
  assert.strictEqual(run({}, { hintsEnabled: false }).length, base.length - 1);
  // a custom hint cost flows through the settings
  const costly = run({ hintCost: { level1: 0.5, level2: 0.7, reveal: 1 } });
  assert.strictEqual(points(costly, "hint").points, 5);
});

test("preview degrades: no Scoring gives no rows; a throwing Scoring skips the case instead of throwing", () => {
  const { Ludus } = createEnv({ skip: ["js/scoring.js"] });
  deepEq(Ludus.Screens.settings.helpers.previewRows({ scoring: {}, multiPv: 3 }, "en"), []);
  const real = createEnv();
  const h = real.Ludus.Screens.settings.helpers;
  real.Ludus.Scoring.assess = () => { throw new Error("boom"); };
  deepEq(h.previewRows({ scoring: {}, multiPv: 3 }, "en"), []);
});

test("summaryItems: a short sentence per area, and the changes show up", () => {
  const { Ludus } = createEnv({ language: "en" });
  const h = Ludus.Screens.settings.helpers;
  const values = {};
  Ludus.Settings.schema.forEach((spec) => { values[spec.path] = Ludus.Settings.get(spec.path); });
  const items = h.summaryItems(values, "en");
  deepEq(items.map((item) => item.id), ["board", "clock", "engine", "scoring", "best", "hints", "sound", "access"]);
  const byId = (id) => items.find((item) => item.id === id).text;
  assert.strictEqual(byId("board"), "Walnut board");
  assert.strictEqual(byId("clock"), "1:30 per move");
  assert.ok(byId("engine").includes("Balanced") && byId("engine").includes("1.5 s") && byId("engine").includes("3 lines"), byId("engine"));
  assert.strictEqual(byId("scoring"), "Smooth scoring · Standard");
  assert.strictEqual(byId("best"), "Best move: within 1 %");
  assert.strictEqual(byId("hints"), "Hints on");
  assert.strictEqual(byId("sound"), "Sound 50 %");
  assert.strictEqual(byId("access"), "Text 100 %");
  const changed = h.summaryItems(Object.assign({}, values, {
    "clock.mode": "untimed", "engine.multiPv": 1, "scoring.bestMode": "engine", "hints.enabled": false, "sound.enabled": false,
    "a11y.contrast": "high", "a11y.motion": "reduce", "a11y.textScale": 1.3, "engine.strength": "custom", "engine.movetimeMs": 2500,
  }), "en");
  const c = (id) => changed.find((item) => item.id === id).text;
  assert.strictEqual(c("clock"), "No clock");
  assert.ok(c("engine").includes("2.5 s") && c("engine").includes("1 line"), c("engine"));
  assert.strictEqual(c("best"), "Best move: Engine's move only");
  assert.strictEqual(c("hints"), "Hints off");
  assert.strictEqual(c("sound"), "Sound off");
  assert.strictEqual(c("access"), "Text 130 % · high contrast · reduced motion");
  deepEq(h.summaryItems({}, "en"), []);
});

test("changedPaths: what a reset would touch", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.settings.helpers;
  const values = { "board.theme": "ocean", "board.coords": true, "clock.seconds": 90 };
  deepEq(h.changedPaths(["board.theme", "board.coords", "clock.seconds", "nope"], values, Ludus.Settings.schema), ["board.theme"]);
  deepEq(h.changedPaths(["board.coords"], values, Ludus.Settings.schema), []);
  deepEq(h.changedPaths(null, values, Ludus.Settings.schema), []);
});

// ---------- the screen ----------

test("screen: one row per schema path (none twice), five sections, the nav, the summary chips and the reset controls", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  Ludus.Settings.schema.forEach((spec) => {
    const rows = qa(el, `[data-path="${spec.path}"]`);
    assert.strictEqual(rows.length, 1, `${spec.path}: ${rows.length} rows`);
  });
  const sections = qa(el, "section.settings-section");
  deepEq(sections.map((section) => section.getAttribute("data-section")), ["board", "judge", "play", "sound", "access"]);
  sections.forEach((section) => {
    const heading = q(section, "h2");
    assert.ok(heading && text(heading).length > 2, "every section has a heading");
    assert.strictEqual(section.getAttribute("aria-labelledby"), heading.getAttribute("id"));
    assert.ok(q(section, ".settings-reset"), "and a reset button");
  });
  assert.strictEqual(qa(el, ".settings-nav-btn").length, 5);
  assert.strictEqual(qa(el, ".settings-chip").length, 8);
  assert.ok(q(el, "#settings-reset-all"));
  assert.strictEqual(text(q(el, "h1")), "Settings");
  assert.ok(q(el, "h1").hasAttribute("data-screen-title"));
  assert.ok(q(el, "h1").getAttribute("tabindex") === "-1");
  assert.ok(!/settings\.[a-z]/i.test(text(el).replace(/docs\/[A-Z_.a-z]+/g, "")), `no raw keys on screen: ${text(el).slice(0, 200)}`);
  assert.strictEqual(qa(el, "table.settings-table tbody tr").length, 10);
});

test("screen: every row shows the label and hint of the schema; every control is labelled", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  Ludus.Settings.schema.forEach((spec) => {
    const node = row(el, spec.path);
    const content = text(node);
    assert.ok(content.includes(Ludus.i18n.t(spec.labelKey)), `${spec.path} label`);
    assert.ok(content.includes(Ludus.i18n.t(spec.hintKey)), `${spec.path} hint`);
    findAll(node, (n) => ["input", "select"].includes(n.tagName.toLowerCase())).forEach((input) => {
      const labelled = input.getAttribute("aria-labelledby") || input.getAttribute("aria-label")
        || (input.getAttribute("id") && qa(node, `label[for="${input.getAttribute("id")}"]`).length)
        || input.closest("label");
      assert.ok(labelled, `${spec.path}: an unlabelled ${input.getAttribute("type")} input`);
    });
  });
  // the label an input points at exists and says what it should
  const coords = q(row(el, "board.coords"), "input");
  assert.strictEqual(coords.getAttribute("role"), "switch");
  const labelId = coords.getAttribute("aria-labelledby");
  assert.strictEqual(text(q(el, `#${labelId}`)), "Show coordinates");
  assert.strictEqual(text(q(el, `#${coords.getAttribute("aria-describedby")}`)), Ludus.i18n.t("settings.board.coords.hint"));
  // a radio group is named by its label
  const group = q(row(el, "scoring.model"), "[role=\"radiogroup\"]");
  assert.strictEqual(text(q(el, `#${group.getAttribute("aria-labelledby")}`)), "Scoring model");
});

test("screen: the theme picker has one tile per theme with a mini board in it, and only the current theme is checked", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const tiles = qa(row(el, "board.theme"), "label.settings-tile");
  deepEq(tiles.map((tile) => tile.getAttribute("data-value")), ["walnut", "classic", "ocean", "forest", "slate", "contrast"]);
  tiles.forEach((tile) => {
    const board = q(tile, "svg.mini-board");
    assert.ok(board, "a mini board in every tile");
    assert.strictEqual(board.getAttribute("data-board-theme"), tile.getAttribute("data-value"));
    assert.strictEqual(qa(board, "rect.mb-sq").length, 64);
    assert.strictEqual(q(tile, ".settings-tile-preview").getAttribute("aria-hidden"), "true", "the board is decoration inside the labelled tile");
  });
  assert.strictEqual(isChecked(el, "board.theme", "walnut"), true);
  assert.strictEqual(isChecked(el, "board.theme", "ocean"), false);
  pick(el, "board.theme", "ocean");
  assert.strictEqual(Ludus.Settings.get("board.theme"), "ocean");
  assert.strictEqual(Ludus.Settings.get("board.theme"), "ocean");
  assert.strictEqual(env.doc.documentElement.getAttribute("data-board-theme"), "ocean", "the theme applies to the page at once");
  assert.strictEqual(isChecked(el, "board.theme", "ocean"), true);
  assert.strictEqual(isChecked(el, "board.theme", "walnut"), false);
  // the large preview follows the theme
  assert.strictEqual(q(el, ".settings-preview-board svg.mini-board").getAttribute("data-board-theme"), "ocean");
  assert.ok(text(q(el, ".settings-chips")).includes("Ocean board"));
});

test("screen: the board preview follows coordinates, last move and legal-move dots", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const preview = () => q(el, ".settings-preview-board");
  assert.strictEqual(qa(preview(), "text.mb-coord").length, 16);
  assert.strictEqual(qa(preview(), "circle.settings-dot").length, 5);
  assert.ok(qa(preview(), "rect.mb-hl").length >= 3, "last move and the selected piece are tinted");
  const toggle = (path, on) => {
    const input = q(row(el, path), "input");
    input.checked = on;
    input.dispatch("change");
  };
  toggle("board.coords", false);
  assert.strictEqual(Ludus.Settings.get("board.coords"), false);
  assert.strictEqual(qa(preview(), "text.mb-coord").length, 0);
  toggle("board.legalDots", false);
  assert.strictEqual(qa(preview(), "circle.settings-dot").length, 0);
  const highlights = qa(preview(), "rect.mb-hl").length;
  toggle("board.lastMove", false);
  assert.ok(qa(preview(), "rect.mb-hl").length < highlights, "the last move tint is gone");
  toggle("board.lastMove", true);
  toggle("board.coords", true);
  toggle("board.legalDots", true);
  assert.strictEqual(qa(preview(), "text.mb-coord").length, 16);
});

test("screen: switches, tiles, sliders apply live through Settings.set and persist", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el, storageMap } = env;
  // a switch
  const sw = q(row(el, "hints.enabled"), "input");
  assert.strictEqual(sw.checked, true);
  sw.checked = false;
  sw.dispatch("change");
  assert.strictEqual(Ludus.Settings.get("hints.enabled"), false);
  // tiles: text size, contrast, motion (document attributes follow)
  pick(el, "a11y.textScale", 1.3);
  assert.strictEqual(Ludus.Settings.get("a11y.textScale"), 1.3);
  assert.strictEqual(env.doc.documentElement.style.props["--text-scale"], "1.3");
  pick(el, "a11y.contrast", "high");
  assert.strictEqual(env.doc.documentElement.getAttribute("data-contrast"), "high");
  pick(el, "a11y.motion", "reduce");
  assert.strictEqual(env.doc.documentElement.getAttribute("data-motion"), "reduce");
  // engine strength, scoring options
  pick(el, "engine.strength", "deep");
  pick(el, "scoring.model", "tiers");
  pick(el, "scoring.strictness", "strict");
  pick(el, "scoring.bestMode", "masters");
  assert.strictEqual(Ludus.Settings.get("engine.strength"), "deep");
  assert.strictEqual(Ludus.Settings.get("scoring.model"), "tiers");
  assert.strictEqual(Ludus.Settings.get("scoring.strictness"), "strict");
  assert.strictEqual(Ludus.Settings.get("scoring.bestMode"), "masters");
  // a slider
  const slider = q(row(el, "engine.multiPv"), "input[type=\"range\"]");
  assert.strictEqual(slider.getAttribute("min"), "1");
  assert.strictEqual(slider.getAttribute("max"), "5");
  slider.value = "5";
  slider.dispatch("input");
  assert.strictEqual(Ludus.Settings.get("engine.multiPv"), 5);
  assert.strictEqual(slider.getAttribute("aria-valuetext"), "5");
  const tolerance = q(row(el, "scoring.tolerancePct"), "input[type=\"range\"]");
  tolerance.value = "2.5";
  tolerance.dispatch("input");
  assert.strictEqual(Ludus.Settings.get("scoring.tolerancePct"), 2.5);
  assert.strictEqual(tolerance.getAttribute("aria-valuetext"), "2.5 %");
  // everything reached storage
  const stored = JSON.parse(storageMap.get("ludus.settings.v2"));
  assert.strictEqual(stored.values["a11y.textScale"], 1.3);
  assert.strictEqual(stored.values["engine.multiPv"], 5);
  assert.strictEqual(stored.values["scoring.bestMode"], "masters");
  assert.strictEqual(stored.values["hints.enabled"], false);
});

test("screen: the preview table follows the settings the person changes", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { el } = env;
  const cell = (id) => text(q(el, `tr[data-case="${id}"]`));
  const pointsOf = (id) => Number(q(q(el, `tr[data-case="${id}"]`), ".settings-points").getAttribute("data-points"));
  assert.strictEqual(pointsOf("equal"), 10);
  assert.ok(cell("equal").includes("Perfect") || cell("equal").includes("perfect"), cell("equal"));
  pick(el, "scoring.bestMode", "engine");
  assert.ok(pointsOf("equal") < 10, "an equivalent move stops counting as the best");
  assert.ok(q(q(el, "tr[data-case=\"equal\"]"), ".settings-points"));
  pick(el, "scoring.model", "tiers");
  assert.ok([10, 7.5, 5, 2.5, 0].includes(pointsOf("inaccuracy")));
  pick(el, "scoring.bestMode", "band");
  const tolerance = q(row(el, "scoring.tolerancePct"), "input[type=\"range\"]");
  tolerance.value = "3";
  tolerance.dispatch("input");
  assert.strictEqual(pointsOf("close"), 10);
  // the sentence above the table tells the rule in words
  assert.ok(text(q(el, ".settings-rule")).includes("less than 3 %"), text(q(el, ".settings-rule")));
  // hints off removes the hint row
  const sw = q(row(el, "hints.enabled"), "input");
  sw.checked = false;
  sw.dispatch("change");
  assert.strictEqual(qa(el, "tr[data-case=\"hint\"]").length, 0);
  // one line: the only move stops being "great"
  const lines = q(row(el, "engine.multiPv"), "input[type=\"range\"]");
  lines.value = "1";
  lines.dispatch("input");
  assert.ok(!cell("only").includes("Great"), cell("only"));
  // every row has its title and detail; the points are announced as words (the number is decoration)
  qa(el, "tr.settings-case").forEach((tr) => {
    assert.ok(q(tr, ".settings-case-title") && q(tr, ".settings-case-detail"));
    assert.ok(/out of 10 points/.test(text(q(tr, ".settings-points"))));
    assert.ok(q(tr, ".q-badge"), "the verdict is a badge with a glyph and words");
  });
});

test("screen: a change from outside repaints the controls in place (same nodes, so focus and a drag survive)", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const sliderBefore = q(row(el, "engine.multiPv"), "input[type=\"range\"]");
  const tileBefore = q(row(el, "scoring.strictness"), "label[data-value=\"strict\"] input");
  Ludus.Settings.set("engine.multiPv", 2);
  Ludus.Settings.set("scoring.strictness", "strict");
  Ludus.Settings.set("clock.mode", "untimed");
  const sliderAfter = q(row(el, "engine.multiPv"), "input[type=\"range\"]");
  assert.strictEqual(sliderAfter, sliderBefore, "not rebuilt");
  assert.strictEqual(sliderAfter.value, "2");
  assert.strictEqual(q(row(el, "scoring.strictness"), "label[data-value=\"strict\"] input"), tileBefore);
  assert.strictEqual(isChecked(el, "scoring.strictness", "strict"), true);
  assert.strictEqual(isChecked(el, "scoring.strictness", "standard"), false);
  assert.ok(text(q(el, ".settings-chips")).includes("No clock"));
  // a reset from elsewhere too
  Ludus.Settings.reset();
  assert.strictEqual(sliderAfter.value, "3");
  assert.strictEqual(isChecked(el, "scoring.strictness", "standard"), true);
  assert.ok(text(q(el, ".settings-chips")).includes("1:30 per move"));
});

test("screen: an unrelated change does not redraw the board preview or the preview table", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const board = q(el, ".settings-preview-board");
  const rows = q(el, "tr[data-case=\"best\"]");
  Ludus.Settings.set("sound.volume", 0.8);
  Ludus.Settings.set("clock.seconds", 120);
  assert.strictEqual(q(el, ".settings-preview-board"), board, "the board preview is the same node");
  assert.strictEqual(q(el, "tr[data-case=\"best\"]"), rows, "and so are the table rows");
  Ludus.Settings.set("board.theme", "slate");
  assert.notStrictEqual(q(el, ".settings-preview-board"), board, "a board setting redraws the board preview");
  assert.strictEqual(q(el, "tr[data-case=\"best\"]"), rows, "but not the table");
  Ludus.Settings.set("scoring.model", "tiers");
  assert.notStrictEqual(q(el, "tr[data-case=\"best\"]"), rows, "a scoring setting redraws the table");
});

test("screen: rows appear and disappear with showWhen (clock seconds, volume, custom engine time, tolerance)", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  assert.strictEqual(isHidden(row(el, "clock.seconds")), false);
  pick(el, "clock.mode", "untimed");
  assert.strictEqual(isHidden(row(el, "clock.seconds")), true);
  pick(el, "clock.mode", "timed");
  assert.strictEqual(isHidden(row(el, "clock.seconds")), false);
  assert.strictEqual(isHidden(row(el, "engine.movetimeMs")), true);
  pick(el, "engine.strength", "custom");
  assert.strictEqual(isHidden(row(el, "engine.movetimeMs")), false);
  const custom = q(row(el, "engine.movetimeMs"), "input[type=\"range\"]");
  custom.value = "2500";
  custom.dispatch("input");
  assert.strictEqual(Ludus.Settings.get("engine.movetimeMs"), 2500);
  assert.strictEqual(custom.getAttribute("aria-valuetext"), "2.5 s");
  assert.ok(text(row(el, "engine.strength")).includes("2 s to 3.5 s"), text(row(el, "engine.strength")));
  assert.strictEqual(isHidden(row(el, "sound.volume")), false);
  const sound = q(row(el, "sound.enabled"), "input");
  sound.checked = false;
  sound.dispatch("change");
  assert.strictEqual(isHidden(row(el, "sound.volume")), true);
  assert.strictEqual(isHidden(row(el, "scoring.tolerancePct")), false);
  pick(el, "scoring.bestMode", "engine");
  assert.strictEqual(isHidden(row(el, "scoring.tolerancePct")), true);
});

test("screen: the engine strength shows the wait it means and the lines note follows the slider", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { el } = env;
  const strength = text(row(el, "engine.strength"));
  assert.ok(strength.includes("1.2 s to 2.4 s"), strength);
  ["fast", "balanced", "deep", "custom"].forEach((value) => {
    const tile = q(row(el, "engine.strength"), `label[data-value="${value}"]`);
    assert.ok(text(q(tile, ".settings-tile-desc")).length > 5, `${value} has its description`);
  });
  assert.ok(text(q(row(el, "engine.strength"), "label[data-value=\"fast\"]")).includes("0.7 s"));
  pick(el, "engine.strength", "fast");
  assert.ok(text(row(el, "engine.strength")).includes("0.6 s to 1.1 s"), text(row(el, "engine.strength")));
  const lines = q(row(el, "engine.multiPv"), "input[type=\"range\"]");
  lines.value = "1";
  lines.dispatch("input");
  assert.ok(text(row(el, "engine.multiPv")).includes("cannot recognise"));
  lines.value = "4";
  lines.dispatch("input");
  assert.ok(text(row(el, "engine.multiPv")).includes("With 4 lines"));
});

test("screen: the clock has presets, a custom field that commits only complete numbers, and clamps on leaving", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const seconds = row(el, "clock.seconds");
  deepEq(qa(seconds, "label.settings-tile").map((tile) => tile.getAttribute("data-value")), ["60", "90", "180", "360"]);
  assert.strictEqual(isChecked(el, "clock.seconds", "90"), true);
  pick(el, "clock.seconds", 180);
  assert.strictEqual(Ludus.Settings.get("clock.seconds"), 180);
  assert.strictEqual(isChecked(el, "clock.seconds", "180"), true);
  assert.strictEqual(q(seconds, ".settings-seconds-input").value, "180");
  const input = q(seconds, ".settings-seconds-input");
  const error = q(seconds, ".settings-error");
  assert.ok(isHidden(error));
  input.value = "1";
  input.dispatch("input");
  assert.strictEqual(Ludus.Settings.get("clock.seconds"), 180, "a half-typed number is not clamped and committed");
  assert.ok(!isHidden(error) && text(error).includes("between 5 and 360"));
  assert.strictEqual(input.getAttribute("aria-invalid"), "true");
  input.value = "120";
  input.dispatch("input");
  assert.strictEqual(Ludus.Settings.get("clock.seconds"), 120);
  assert.ok(isHidden(error) && !input.hasAttribute("aria-invalid"));
  assert.strictEqual(isChecked(el, "clock.seconds", "180"), false);
  assert.strictEqual(qa(seconds, "input[type=\"radio\"]").filter((radio) => radio.checked).length, 0, "no preset for a custom value");
  input.value = "5000";
  input.dispatch("input");
  assert.strictEqual(Ludus.Settings.get("clock.seconds"), 120);
  input.dispatch("change");
  assert.strictEqual(Ludus.Settings.get("clock.seconds"), 360, "clamped when the field is left");
  assert.strictEqual(input.value, "360");
  assert.ok(text(seconds).includes("6:00 per move"));
  assert.ok(text(qa(el, ".settings-chip").find((chip) => text(chip).includes("per move"))).includes("6:00"));
  // the presets carry a spoken duration
  assert.strictEqual(q(seconds, "label[data-value=\"60\"] input").getAttribute("aria-label"), "60 seconds per move");
});

test("screen: mistake sensitivity explains the centipawns and says the threshold now in force", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const play = q(el, "section[data-section=\"play\"]");
  assert.ok(text(play).includes("What is a centipawn?") && text(play).includes("100 cp is roughly a pawn"));
  assert.ok(text(row(el, "mistakes.sensitivity")).includes("more than 80 cp (about 0.8 pawns)"));
  pick(el, "mistakes.sensitivity", "low");
  assert.ok(text(row(el, "mistakes.sensitivity")).includes("more than 150 cp (about 1.5 pawns)"));
  assert.strictEqual(Ludus.Settings.mistakeThresholdCp(), 150);
  ["high", "standard", "low"].forEach((value) => assert.ok(text(q(row(el, "mistakes.sensitivity"), `label[data-value="${value}"]`)).includes("cp")));
  // hints: the costs come from Scoring
  assert.ok(text(row(el, "hints.enabled")).includes("level 1 (marks the piece) costs 15 %"));
  assert.ok(text(row(el, "hints.enabled")).includes("35 %"));
});

test("screen: sound tests, one per sound of Audio; they follow the sound setting", () => {
  const raw = createEnv({ language: "en" });
  const played = [];
  raw.Ludus.Audio.isSupported = () => true; // the fake page has no AudioContext
  raw.Ludus.Audio.play = (name) => { played.push(name); return true; };
  const env = mountAndShow(raw);
  const { Ludus, el } = env;
  const buttons = qa(el, "button.settings-test-btn[data-sound]");
  deepEq(buttons.map((button) => button.getAttribute("data-sound")), Ludus.Audio.names.slice());
  assert.strictEqual(buttons.length, 8);
  buttons.forEach((button) => assert.ok(text(button).length > 2 && !button.hasAttribute("aria-disabled")));
  buttons[1].click();
  buttons[4].click();
  deepEq(played, ["capture", "great"]);
  // the volume slider plays a sound when it is released
  const volume = q(row(el, "sound.volume"), "input[type=\"range\"]");
  volume.dispatch("change");
  assert.strictEqual(played[played.length - 1], "move");
  // sound off: buttons stay focusable but say so and do nothing
  const sw = q(row(el, "sound.enabled"), "input");
  sw.checked = false;
  sw.dispatch("change");
  buttons.forEach((button) => assert.strictEqual(button.getAttribute("aria-disabled"), "true"));
  assert.ok(text(q(el, ".settings-sound-note")).includes("turned off"));
  const before = played.length;
  buttons[0].click();
  assert.strictEqual(played.length, before, "nothing plays while sound is off");
  // vibration is only offered where the device has it
  assert.strictEqual(qa(el, "button[data-haptic]").length, 0);
  assert.ok(text(q(el, ".settings-tests")).includes("does not vibrate"));
  env.sandbox.navigator.vibrate = () => true;
  Ludus.Screens.settings.render();
  assert.strictEqual(qa(el, "button[data-haptic]").length, 1);
});

test("screen: without an audio engine the sound buttons say so instead of staying silent", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { el } = env;
  assert.ok(text(q(el, ".settings-sound-note")).includes("cannot play sounds"));
  qa(el, "button.settings-test-btn[data-sound]").forEach((button) => assert.strictEqual(button.getAttribute("aria-disabled"), "true"));
});

test("screen: reset section restores the defaults and offers an undo; a section at its defaults says so", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const toasts = [];
  Ludus.ui.toast = (message, options) => { toasts.push({ message, options }); return null; };
  const resetBtn = (section) => q(q(el, `section[data-section="${section}"]`), ".settings-reset");
  assert.strictEqual(resetBtn("board").getAttribute("aria-disabled"), "true", "nothing to reset yet");
  resetBtn("board").click();
  assert.strictEqual(toasts.length, 0, "no toast for a no-op");
  assert.ok(text(q(el, "#settings-live")).includes("already has its original values"));
  pick(el, "board.theme", "forest");
  pick(el, "board.animation", "off");
  pick(el, "scoring.model", "tiers");
  assert.strictEqual(resetBtn("board").hasAttribute("aria-disabled"), false, "the button wakes up once something changed");
  assert.strictEqual(resetBtn("judge").hasAttribute("aria-disabled"), false);
  resetBtn("board").click();
  assert.strictEqual(Ludus.Settings.get("board.theme"), "walnut");
  assert.strictEqual(Ludus.Settings.get("board.animation"), "auto");
  assert.strictEqual(Ludus.Settings.get("scoring.model"), "tiers", "another section is untouched");
  // QA A11Y-005: no five-second toast any more: a notice under the section heading that stays until it is used, closed or made unsafe.
  assert.strictEqual(toasts.length, 0, "no toast with a timed Undo");
  const boardSection = () => q(el, 'section[data-section="board"]');
  const notice = () => q(boardSection(), ".settings-undo");
  assert.ok(notice() && text(notice()).includes("“Board” is back to its original values."), "the notice is there");
  assert.strictEqual(q(boardSection(), ".settings-undo-host").getAttribute("role"), "status", "inside a live region");
  const children = Array.from(boardSection().children).map((child) => child.getAttribute("class") || child.tagName);
  assert.ok(children.indexOf(children.find((c) => c.includes("settings-undo-host"))) === 1, "right after the heading: the next Tab stop after Reset");
  assert.strictEqual(resetBtn("board").getAttribute("aria-disabled"), "true");
  // changing something else in the section makes Undo unsafe: the notice goes
  Ludus.Settings.set("board.lastMove", false);
  assert.ok(!notice(), "a later change in the section closes the notice");
  Ludus.Settings.set("board.lastMove", true);
  pick(el, "board.theme", "forest");
  resetBtn("board").click();
  assert.ok(notice(), "a second reset offers it again");
  q(notice(), "[data-action=\"dismiss-undo\"]").click();
  assert.ok(!notice(), "the close button dismisses it");
  assert.strictEqual(Ludus.Settings.get("board.theme"), "walnut", "closing is not undoing");
  assert.strictEqual(env.doc.activeElement, resetBtn("board"), "focus goes back to Reset, never to the page top");
  pick(el, "board.theme", "forest");
  pick(el, "board.animation", "off");
  resetBtn("board").click();
  q(notice(), "[data-action=\"undo\"]").click();
  assert.strictEqual(Ludus.Settings.get("board.theme"), "forest");
  assert.strictEqual(Ludus.Settings.get("board.animation"), "off");
  assert.strictEqual(Ludus.Settings.get("scoring.model"), "tiers");
  assert.ok(!notice(), "using Undo closes the notice");
  assert.strictEqual(env.doc.activeElement, resetBtn("board"), "and gives the focus back to Reset");
  assert.ok(text(q(el, "#settings-live")).includes("previous values are back"), "Undo is announced once");
  // the judge section resets both of its groups
  pick(el, "engine.strength", "deep");
  resetBtn("judge").click();
  assert.strictEqual(Ludus.Settings.get("engine.strength"), "balanced");
  assert.strictEqual(Ludus.Settings.get("scoring.model"), "precision");
  assert.strictEqual(resetBtn("sound").getAttribute("aria-disabled"), "true");
});

test("screen: reset all asks first, does nothing on cancel and restores everything on confirm", async () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const toasts = [];
  Ludus.ui.toast = (message, options) => { toasts.push({ message, options }); return null; };
  pick(el, "board.theme", "slate");
  pick(el, "a11y.textScale", 1.15);
  let asked = null;
  Ludus.ui.confirm = (options) => { asked = options; return Promise.resolve(false); };
  q(el, "#settings-reset-all").click();
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(asked && asked.danger === true && asked.title === "Reset all settings?");
  assert.strictEqual(Ludus.Settings.get("board.theme"), "slate", "cancel keeps everything");
  Ludus.ui.confirm = () => Promise.resolve(true);
  q(el, "#settings-reset-all").click();
  await Promise.resolve();
  await Promise.resolve();
  assert.strictEqual(Ludus.Settings.get("board.theme"), "walnut");
  assert.strictEqual(Ludus.Settings.get("a11y.textScale"), 1);
  assert.strictEqual(env.doc.documentElement.style.props["--text-scale"], "1");
  assert.strictEqual(toasts.length, 1);
});

test("screen: the language switch redraws everything in the other language and keeps the values", () => {
  const env = mountAndShow(createEnv({ language: "es" }));
  const { Ludus, el } = env;
  assert.strictEqual(text(q(el, "h1")), "Ajustes");
  pick(el, "scoring.strictness", "strict");
  Ludus.i18n.setLanguage("en", { persist: false });
  assert.strictEqual(text(q(el, "h1")), "Settings");
  assert.ok(text(el).includes("How the best move is decided"));
  assert.strictEqual(isChecked(el, "scoring.strictness", "strict"), true);
  assert.ok(text(q(el, ".settings-chips")).includes("Strict"));
  Ludus.i18n.setLanguage("es", { persist: false });
  assert.ok(text(el).includes("Cómo se decide la mejor jugada"));
  assert.ok(text(q(el, ".settings-chips")).includes("Estricta"));
});

test("screen: rendered while hidden, a change is picked up on show (no work while hidden)", () => {
  const env = createEnv({ language: "en" });
  const { Ludus, el } = env;
  Ludus.Screens.settings.mount(el);
  Ludus.Screens.settings.mount(el);
  assert.strictEqual(qa(el, "h1").length, 0, "mount is idempotent and draws nothing yet");
  Ludus.Settings.set("board.theme", "forest");
  Ludus.router.show("settings");
  assert.strictEqual(qa(el, "h1").length, 1);
  assert.strictEqual(isChecked(el, "board.theme", "forest"), true);
  Ludus.router.show("home");
  Ludus.Settings.set("board.theme", "slate");
  Ludus.i18n.setLanguage("es", { persist: false });
  Ludus.router.show("settings");
  assert.strictEqual(isChecked(el, "board.theme", "slate"), true);
  assert.strictEqual(text(q(el, "h1")), "Ajustes");
});

test("screen: show({section}) moves to that section; nav buttons scroll and focus the heading", () => {
  const env = createEnv({ language: "en" });
  const { Ludus, el } = env;
  const scrolled = [];
  Ludus.Screens.settings.mount(el);
  qa(el, "section.settings-section").forEach((section) => { section.scrollIntoView = (options) => scrolled.push([section.getAttribute("data-section"), options]); });
  Ludus.router.show("settings", { section: "sound" });
  // show() had to render first when dirty; the sections were replaced only if it rebuilt
  const sound = q(el, "section[data-section=\"sound\"]");
  sound.scrollIntoView = (options) => scrolled.push(["sound", options]);
  q(el, "button[data-nav=\"access\"]").click();
  assert.ok(env.doc.activeElement === q(q(el, "section[data-section=\"access\"]"), ".settings-h2"), "the heading takes focus");
});

test("degradation: no Scoring, no Audio, no kit and a schema entry nobody knows never break the screen", () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const noScoring = createEnv({ language: "en", skip: ["js/scoring.js"] });
    mountAndShow(noScoring);
    assert.ok(text(noScoring.el).includes("The preview is not available"));
    assert.strictEqual(qa(noScoring.el, "table.settings-table").length, 0);
    assert.ok(qa(noScoring.el, "[data-path]").length >= 23, "every setting still has its control");
    pick(noScoring.el, "board.theme", "ocean");
    assert.strictEqual(noScoring.Ludus.Settings.get("board.theme"), "ocean");

    const noAudio = createEnv({ language: "en", skip: ["js/audio.js"] });
    mountAndShow(noAudio);
    assert.strictEqual(qa(noAudio.el, "button[data-sound]").length, 0);
    assert.ok(row(noAudio.el, "sound.volume"));

    const noKit = createEnv({ language: "en", skip: ["js/ui/kit.js"] });
    mountAndShow(noKit);
    assert.strictEqual(qa(noKit.el, "svg.mini-board").length, 0, "no mini boards without the kit");
    assert.strictEqual(qa(noKit.el, "label.settings-tile").length > 20, true, "the choices are still there");
    pick(noKit.el, "scoring.model", "tiers");
    assert.strictEqual(noKit.Ludus.Settings.get("scoring.model"), "tiers");
    q(noKit.el, "#settings-reset-all").click();

    const noSettings = createEnv({ language: "en", skip: ["js/settings.js", "js/audio.js"] });
    noSettings.Ludus.Screens.settings.mount(noSettings.el);
    noSettings.Ludus.router.show("settings");
    assert.strictEqual(text(q(noSettings.el, "h1")), "Settings");
    assert.strictEqual(qa(noSettings.el, "section.settings-section").length, 0);

    const extra = createEnv({ language: "en" });
    const real = extra.Ludus.Settings;
    const spec = { path: "lab.flag", group: "lab", type: "boolean", default: false, labelKey: "settings.lab.flag.label", hintKey: "settings.lab.flag.hint" };
    extra.Ludus.Settings = Object.assign({}, real, { schema: real.schema.concat([spec]), groups: real.groups.concat([{ id: "lab", labelKey: "x", hintKey: "y" }]) });
    extra.Ludus.i18n.register({ en: { "settings.lab.flag.label": "Lab flag", "settings.lab.flag.hint": "An experiment." } });
    mountAndShow(extra);
    const more = q(extra.el, "section[data-section=\"more\"]");
    assert.ok(more, "an unknown group gets a section");
    assert.ok(text(q(more, "[data-path=\"lab.flag\"]")).includes("Lab flag"));
    q(more, "input").dispatch("change");
  } finally {
    console.error = originalError;
  }
});

test("degradation: storage that throws leaves the screen usable and the values in memory", () => {
  const { createThrowingLocalStorage } = require("./_fakedom.js");
  const env = createEnv({ language: "en", storage: createThrowingLocalStorage() });
  mountAndShow(env);
  pick(env.el, "board.theme", "classic");
  assert.strictEqual(env.Ludus.Settings.get("board.theme"), "classic");
  assert.strictEqual(isChecked(env.el, "board.theme", "classic"), true);
});

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("privacy: the section exists only with the app core's API; the switch mirrors the preference; turning it off deletes what is saved (QA SEC-008)", async () => {
  const none = mountAndShow(createEnv({ language: "en" }));
  assert.ok(!q(none.el, "section[data-section=\"privacy\"]"), "no API, no section (never a dead control)");
  assert.ok(!qa(none.el, ".settings-nav-btn").some((button) => button.getAttribute("data-nav") === "privacy"));

  const env = createEnv({ language: "en" });
  const calls = [];
  let keep = true;
  env.Ludus.game = { savedDownloads: { keep: () => keep, setKeep: (value) => { keep = Boolean(value); calls.push(`setKeep:${value}`); }, clear: () => { calls.push("clear"); return Promise.resolve(); } } };
  mountAndShow(env);
  const { Ludus, el } = env;
  const section = q(el, "section[data-section=\"privacy\"]");
  assert.ok(section, "the privacy section");
  assert.ok(qa(el, ".settings-nav-btn").some((button) => button.getAttribute("data-nav") === "privacy"), "it is in the side nav");
  assert.ok(text(section).includes("Remember my downloaded games") && text(section).includes("up to 7 days"));
  const input = q(section, ".settings-privacy-keep");
  assert.strictEqual(input.getAttribute("role"), "switch");
  assert.strictEqual(input.checked, true, "on by default: downloads are kept, as before");
  assert.ok(input.getAttribute("aria-labelledby") && input.getAttribute("aria-describedby"), "named and described");
  // off: the preference is saved and what was kept is deleted
  input.checked = false;
  input.dispatch("change");
  await tick();
  assert.deepStrictEqual(calls, ["setKeep:false", "clear"]);
  assert.ok(text(q(section, ".settings-privacy-note")).includes("will not be kept") && !q(section, ".settings-privacy-note").hasAttribute("hidden"));
  assert.ok(text(q(el, "#settings-live")).includes("will not be kept"), "announced");
  // on again: only the preference
  input.checked = true;
  input.dispatch("change");
  assert.deepStrictEqual(calls.slice(2), ["setKeep:true"]);
  // the clear button asks first
  let asked = null;
  Ludus.ui.confirm = (options) => { asked = options; return Promise.resolve(false); };
  q(section, "[data-action=\"clear-saved\"]").click();
  await tick();
  assert.ok(asked && asked.danger === true && asked.title === "Delete the saved games?");
  assert.strictEqual(calls.filter((call) => call === "clear").length, 1, "cancel deletes nothing");
  Ludus.ui.confirm = () => Promise.resolve(true);
  q(section, "[data-action=\"clear-saved\"]").click();
  await tick();
  assert.strictEqual(calls.filter((call) => call === "clear").length, 2);
  assert.ok(text(q(section, ".settings-privacy-note")).includes("the saved games and remembered usernames are deleted"));
  // a failing clear is said, not swallowed
  Ludus.game.savedDownloads.clear = () => Promise.reject(new Error("blocked"));
  const originalError = console.error;
  console.error = () => {};
  try {
    q(section, "[data-action=\"clear-saved\"]").click();
    await tick();
  } finally {
    console.error = originalError;
  }
  assert.ok(text(q(section, ".settings-privacy-note")).includes("could not delete"));
  // Spanish
  Ludus.i18n.setLanguage("es", { persist: false });
  Ludus.bus.emit("language:changed", { lang: "es" });
  assert.ok(text(q(el, "section[data-section=\"privacy\"]")).includes("Recordar mis partidas descargadas"));
});

test("copy: the clock note says it is the usual clock, the analysis time says its real cap, the garbled English is fixed (QA UX-015, PERF-018, CNT-026)", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const clockNote = text(q(row(el, "clock.seconds"), ".settings-note"));
  assert.ok(clockNote.includes("your usual clock") && clockNote.includes("that session only"), clockNote);
  // the cap note appears only when the chosen time is above what a round ever uses
  const h = Ludus.Screens.settings.helpers;
  const spec = Ludus.Settings.schema.find((entry) => entry.path === "engine.movetimeMs");
  if (spec && Number(spec.max) > 3500) {
    pick(el, "engine.strength", "custom");
    Ludus.Settings.set("engine.movetimeMs", 8000);
    const note = row(el, "engine.movetimeMs") && q(row(el, "engine.movetimeMs"), ".settings-note");
    assert.ok(note && text(note).includes("never thinks longer than 3.5 s per search"), note && text(note));
    Ludus.Settings.set("engine.movetimeMs", 2000);
    assert.strictEqual(text(q(row(el, "engine.movetimeMs"), ".settings-note")), "", "no note under the cap");
  }
  const en = Ludus.Screens.settings.TEXT.en;
  assert.ok(en["settings.ui.lines.many"].includes("“only moves”") && !/only moves are/.test(en["settings.ui.lines.many"]), en["settings.ui.lines.many"]);
  assert.ok(en["settings.ui.preview.foot"].includes("“only moves” cannot be recognised"), en["settings.ui.preview.foot"]);
  Object.keys(en).forEach((key) => assert.ok(!/winning chance|win probability/i.test(en[key]), `one term for win chance: ${key}`));
  assert.ok(!h || typeof h === "object");
});

runAll().then(() => {
  console.log(`settings-ui: ${passed} tests passed`);
}).catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
