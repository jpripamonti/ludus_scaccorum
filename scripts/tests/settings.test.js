// Unit tests for js/settings.js (schema, validation, persistence, migration,
// events, derived helpers). Plain assert, no framework, no network.

"use strict";

const assert = require("assert");
const path = require("path");
const { createFakeLocalStorage, createThrowingLocalStorage } = require("./_fakedom.js");

const jsDir = path.resolve(__dirname, "..", "..", "js");
require(path.join(jsDir, "ludus.js"));
require(path.join(jsDir, "scoring.js"));
const Settings = require(path.join(jsDir, "settings.js"));

let assertions = 0;
const ok = (value, message) => { assertions += 1; assert.ok(value, message); };
const eq = (actual, expected, message) => { assertions += 1; assert.strictEqual(actual, expected, message); };
const same = (actual, expected, message) => { assertions += 1; assert.deepStrictEqual(actual, expected, message); };

// A storage with the Ludus.storage shape over a plain Map, with switches to
// simulate quota errors and blocked storage.
function memoryStorage(options = {}) {
  const map = options.map || new Map();
  const api = {
    map,
    failWrites: false,
    throwAlways: false,
    writes: 0,
    get(key, fallback) {
      if (api.throwAlways) throw new Error("blocked");
      if (!map.has(key)) return fallback;
      try {
        return JSON.parse(map.get(key));
      } catch (error) {
        return fallback;
      }
    },
    set(key, value) {
      if (api.throwAlways) throw new Error("blocked");
      if (api.failWrites) return false;
      api.writes += 1;
      map.set(key, JSON.stringify(value));
      return true;
    },
    remove(key) { map.delete(key); return true; },
    keys(prefix) { return Array.from(map.keys()).filter((key) => key.startsWith(prefix || "")).sort(); },
  };
  return api;
}

function makeBus() {
  const handlers = new Map();
  return {
    on(evt, fn) {
      if (!handlers.has(evt)) handlers.set(evt, []);
      handlers.get(evt).push(fn);
      return () => handlers.set(evt, handlers.get(evt).filter((entry) => entry !== fn));
    },
    off(evt, fn) { handlers.set(evt, (handlers.get(evt) || []).filter((entry) => entry !== fn)); },
    emit(evt, payload) { (handlers.get(evt) || []).slice().forEach((fn) => fn(payload)); },
  };
}

function fakeDoc() {
  const attrs = new Map();
  const style = new Map();
  return {
    attrs,
    style,
    documentElement: {
      setAttribute: (name, value) => attrs.set(name, String(value)),
      style: { setProperty: (name, value) => style.set(name, String(value)) },
    },
  };
}

function make(options = {}) {
  const storage = options.storage || memoryStorage();
  const bus = makeBus();
  const events = [];
  bus.on("settings:changed", (payload) => events.push(payload));
  const doc = options.doc || null;
  const instance = Settings.create({ storage, bus, doc, autoApply: Boolean(options.autoApply), listenStorage: false });
  return { s: instance, storage, bus, events, doc };
}

// ---------- Schema ----------

{
  const schema = Settings.schema;
  // 23 paths of the contract + notation.style (piece letters); later additions only grow it.
  ok(schema.length >= 24 && schema.some((spec) => spec.path === "notation.style"), "the contract's 23 paths plus notation.style");
  eq(new Set(schema.map((spec) => spec.path)).size, schema.length, "paths are unique");
  ok(Object.isFrozen(schema) && schema.every((spec) => Object.isFrozen(spec)), "the schema is frozen");
  const groupIds = Settings.groups.map((group) => group.id);
  ok(schema.every((spec) => groupIds.includes(spec.group)), "every entry belongs to a declared group");
  ok(schema.every((spec) => ["boolean", "enum", "number"].includes(spec.type)), "types are boolean | enum | number");
  ok(schema.every((spec) => spec.labelKey === `settings.${spec.path}.label` && spec.hintKey === `settings.${spec.path}.hint`), "label/hint keys follow the naming rule");
  ok(schema.filter((spec) => spec.type === "number").every((spec) => spec.min < spec.max && spec.step > 0), "numbers declare min, max and step");
  ok(schema.filter((spec) => spec.type === "enum").every((spec) => spec.options.length >= 2 && spec.options.every((option) => option.labelKey.startsWith(`settings.${spec.path}.option.`))), "enums declare options with label keys");
  ok(schema.every((spec) => Settings.validate(spec.path, spec.default).ok), "every default validates");
  const paths = schema.map((spec) => spec.path);
  [
    "board.theme", "board.coords", "board.legalDots", "board.lastMove", "board.animation", "board.drag",
    "sound.enabled", "sound.volume", "haptics", "clock.mode", "clock.seconds", "engine.strength", "engine.movetimeMs",
    "engine.multiPv", "scoring.model", "scoring.strictness", "scoring.bestMode", "scoring.tolerancePct", "hints.enabled",
    "mistakes.sensitivity", "a11y.textScale", "a11y.contrast", "a11y.motion",
  ].forEach((expected) => ok(paths.includes(expected), `schema has ${expected}`));
  same(schema.find((spec) => spec.path === "board.theme").options.map((option) => option.value), ["walnut", "classic", "ocean", "forest", "slate", "contrast"]);
  same(schema.find((spec) => spec.path === "a11y.textScale").options.map((option) => option.value), [1, 1.15, 1.3]);
  eq(schema.find((spec) => spec.path === "clock.seconds").showWhen.path, "clock.mode", "dependent controls declare showWhen");
}

// ---------- i18n: every visible string in Spanish and English ----------

{
  const i18n = Ludus.i18n;
  const keys = [];
  Settings.schema.forEach((spec) => {
    keys.push(spec.labelKey, spec.hintKey);
    if (spec.options) spec.options.forEach((option) => keys.push(option.labelKey));
  });
  Settings.groups.forEach((group) => keys.push(group.labelKey, group.hintKey));
  let missing = 0;
  let identical = 0;
  keys.forEach((key) => {
    const es = i18n.t(key, null, "es");
    const en = i18n.t(key, null, "en");
    if (es === key || en === key || !es.trim() || !en.trim()) missing += 1;
    if (es === en) identical += 1;
  });
  eq(missing, 0, "every settings key has an es and an en string");
  ok(keys.length > 90, "labels, hints, options and groups are all covered");
  ok(identical < 12, "the Spanish and English texts are really different languages");
  ok(/Elegí/.test(i18n.t("settings.board.theme.hint", null, "es")), "Spanish uses the rioplatense voseo");
  ok(/podés/.test(i18n.t("settings.board.drag.hint", null, "es")), "voseo verb forms");
  eq(i18n.t("settings.a11y.textScale.option.1_15", null, "en"), "Large", "numeric option values map \".\" to \"_\" in the key");
  eq(Settings.registerText(i18n), false, "registering twice on the same i18n is a no-op");
}

// ---------- Defaults and reads ----------

{
  const { s } = make();
  same(s.get(), Settings.DEFAULTS, "a fresh instance returns the documented defaults");
  eq(s.get("sound.volume"), 0.5);
  eq(s.get("clock.seconds"), 90);
  eq(s.get("engine.multiPv"), 3);
  eq(s.get("scoring.tolerancePct"), 1);
  eq(s.get("a11y.textScale"), 1);
  eq(s.get("haptics"), true, "haptics is a top-level path");
  eq(s.get("sound.haptics"), true, "sound.haptics is an alias of haptics");
  same(s.get("board"), Settings.DEFAULTS.board, "a group prefix returns the group object");
  eq(s.get("nope"), undefined, "an unknown path reads as undefined");
  eq(s.get("board.theme.deeper"), undefined);
  const tree = s.get();
  tree.board.theme = "hacked";
  eq(s.get("board.theme"), "walnut", "the returned tree is a copy");
  ok(Object.isFrozen(Settings.DEFAULTS) && Object.isFrozen(Settings.DEFAULTS.board), "DEFAULTS is frozen");
}

// ---------- Validation and clamping ----------

{
  const { s } = make();
  eq(s.set("board.theme", "ocean"), true);
  eq(s.get("board.theme"), "ocean");
  eq(s.set("board.theme", "neon"), false, "an enum value outside the options is rejected");
  eq(s.get("board.theme"), "ocean", "a rejected value changes nothing");
  eq(s.set("board.theme", "OCEAN"), false, "enums are case sensitive");
  eq(s.set("board.coords", "yes"), false, "booleans accept booleans only");
  eq(s.set("board.coords", 1), false);
  eq(s.set("board.coords", false), true);
  eq(s.get("board.coords"), false);

  s.set("clock.seconds", 1);
  eq(s.get("clock.seconds"), 5, "clock.seconds clamps up to 5");
  s.set("clock.seconds", 99999);
  eq(s.get("clock.seconds"), 360, "clock.seconds clamps down to 360");
  s.set("clock.seconds", "45");
  eq(s.get("clock.seconds"), 45, "numeric strings from an <input> are accepted");
  s.set("clock.seconds", 45.6);
  eq(s.get("clock.seconds"), 46, "seconds snap to whole numbers");
  [NaN, Infinity, -Infinity, null, undefined, {}, [], "abc", "", true].forEach((bad) => {
    eq(s.set("clock.seconds", bad), false, `clock.seconds rejects ${String(bad)}`);
  });
  eq(s.get("clock.seconds"), 46, "rejections leave the value alone");

  s.set("engine.movetimeMs", 1234);
  eq(s.get("engine.movetimeMs"), 1200, "movetime snaps to its 100 ms step");
  s.set("engine.movetimeMs", 5);
  eq(s.get("engine.movetimeMs"), 300);
  s.set("engine.movetimeMs", 1e9);
  eq(s.get("engine.movetimeMs"), 10000);
  s.set("engine.multiPv", 9);
  eq(s.get("engine.multiPv"), 5);
  s.set("engine.multiPv", 0);
  eq(s.get("engine.multiPv"), 1);
  s.set("sound.volume", 0.33);
  eq(s.get("sound.volume"), 0.35, "volume snaps to 0.05 without float noise");
  s.set("sound.volume", -3);
  eq(s.get("sound.volume"), 0);
  s.set("sound.volume", 7);
  eq(s.get("sound.volume"), 1);
  s.set("scoring.tolerancePct", 1.26);
  eq(s.get("scoring.tolerancePct"), 1.3);
  s.set("scoring.tolerancePct", 99);
  eq(s.get("scoring.tolerancePct"), 5);

  eq(s.set("a11y.textScale", 1.15), true);
  eq(s.get("a11y.textScale"), 1.15);
  eq(s.set("a11y.textScale", "1.3"), true, "a numeric string matches a numeric option");
  eq(s.get("a11y.textScale"), 1.3);
  eq(s.set("a11y.textScale", 1.2), false, "a number that is not an option is rejected");
  eq(s.set("a11y.textScale", "big"), false);

  same(s.validate("clock.seconds", 1000), { ok: true, value: 360 }, "validate() reports the clamped value");
  same(s.validate("nope", 1), { ok: false, reason: "unknown-path" });
  same(s.validate("board.theme", "x"), { ok: false, reason: "invalid-value" });
}

// ---------- Unknown and hostile paths ----------

{
  const { s, events } = make();
  ["", "nope", "board", "board.", ".theme", "board.theme.x", "__proto__", "constructor", "prototype",
    "board.__proto__", "__proto__.polluted", "toString", "hasOwnProperty", "board.constructor"].forEach((bad) => {
    eq(s.set(bad, "x"), false, `set(${JSON.stringify(bad)}) is rejected`);
  });
  [null, undefined, 42, {}, ["board.theme"]].forEach((bad) => eq(s.set(bad, "walnut"), false, "non-string path is rejected"));
  eq(events.length, 0, "rejected sets emit nothing");
  eq({}.polluted, undefined, "Object.prototype was not touched");
  eq(s.reset("nope"), false, "reset of an unknown prefix reports false");
  eq(s.reset("__proto__"), false);
}

// ---------- Events ----------

{
  const { s, events } = make();
  s.set("board.theme", "forest");
  eq(events.length, 1);
  eq(events[0].path, "board.theme");
  eq(events[0].value, "forest");
  eq(events[0].settings.board.theme, "forest", "the payload carries the full settings tree");
  s.set("board.theme", "forest");
  eq(events.length, 1, "setting the same value does not emit again");
  s.set("clock.seconds", 9999);
  eq(events[1].value, 360, "the event carries the clamped value");

  const seen = [];
  const off = s.onChange((payload) => seen.push(payload.path));
  const boardSeen = [];
  const offBoard = s.onChange("board", (payload) => boardSeen.push(payload.path));
  s.set("board.coords", false);
  s.set("sound.enabled", false);
  same(seen, ["board.coords", "sound.enabled"]);
  same(boardSeen, ["board.coords"], "onChange(prefix, fn) filters by group");
  off();
  offBoard();
  s.set("board.drag", false);
  eq(seen.length, 2, "the unsubscribe function stops delivery");
  eq(typeof s.onChange("x", "not-a-function"), "function", "a bad handler yields a harmless off()");

  const before = events.length;
  s.reset("board");
  const resetPaths = events.slice(before).map((event) => event.path).sort();
  same(resetPaths, ["board.coords", "board.drag", "board.theme"], "reset emits one event per path that actually changed");
  eq(s.get("board.theme"), "walnut");
  eq(s.get("sound.enabled"), false, "reset(group) leaves other groups alone");
  s.reset("sound.enabled");
  eq(s.get("sound.enabled"), true, "reset(leaf) restores one path");
  s.set("haptics", false);
  s.set("sound.volume", 0.9);
  s.set("sound.enabled", false);
  const soundSeen = [];
  const offSound = s.onChange("sound", (payload) => soundSeen.push(payload.path));
  s.reset("sound");
  same(soundSeen.sort(), ["haptics", "sound.enabled", "sound.volume"], "a group id covers haptics too (it is in the sound group)");
  eq(s.get("haptics"), true);
  eq(s.get("sound.volume"), 0.5);
  offSound();
  eq(s.reset(42), false, "a non-string prefix matches nothing");
  s.reset();
  same(s.get(), Settings.DEFAULTS, "reset() restores everything");
  const after = events.length;
  s.reset();
  eq(events.length, after, "resetting defaults emits nothing");
}

// ---------- Persistence ----------

{
  const storage = memoryStorage();
  const a = make({ storage }).s;
  a.set("board.theme", "slate");
  a.set("a11y.textScale", 1.3);
  a.set("clock.seconds", 30);
  const stored = JSON.parse(storage.map.get("ludus.settings.v2"));
  eq(stored.v, 2, "stored blob is versioned");
  eq(stored.values["board.theme"], "slate");
  eq(Object.keys(stored.values).length, Settings.schema.length, "every path is stored");
  const b = make({ storage }).s;
  eq(b.get("board.theme"), "slate", "a new instance reads what was saved");
  eq(b.get("a11y.textScale"), 1.3);
  eq(b.get("clock.seconds"), 30);
}

{
  // Tampered blobs: invalid values fall back per path, valid ones survive.
  const storage = memoryStorage();
  storage.map.set("ludus.settings.v2", JSON.stringify({
    v: 2,
    values: {
      "board.theme": "ocean",
      "clock.seconds": 100000,
      "engine.multiPv": "lots",
      "board.coords": "false",
      "sound.volume": 0.4,
      "extra.path": 1,
      "__proto__": { polluted: true },
      "constructor": { prototype: { polluted: true } },
    },
  }));
  const s = make({ storage }).s;
  eq(s.get("board.theme"), "ocean", "valid stored values are kept");
  eq(s.get("clock.seconds"), 360, "out-of-range stored numbers are clamped");
  eq(s.get("engine.multiPv"), 3, "a wrongly typed stored value falls back to the default");
  eq(s.get("board.coords"), true, "a string where a boolean is expected falls back");
  eq(s.get("sound.volume"), 0.4);
  eq(s.get("extra.path"), undefined, "unknown stored paths are ignored");
  eq({}.polluted, undefined, "stored __proto__ keys cannot pollute");
  ok(!Object.prototype.hasOwnProperty.call(s.get(), "extra"), "unknown keys never reach the tree");

  const wrongVersion = memoryStorage();
  wrongVersion.map.set("ludus.settings.v2", JSON.stringify({ v: 3, values: { "board.theme": "ocean" } }));
  eq(make({ storage: wrongVersion }).s.get("board.theme"), "walnut", "an unknown blob version is not trusted");
  ["null", "42", "\"text\"", "[]", "{\"v\":2,\"values\":[]}", "{\"v\":2}", "not json"].forEach((raw) => {
    const garbage = memoryStorage();
    garbage.map.set("ludus.settings.v2", raw);
    same(make({ storage: garbage }).s.get(), Settings.DEFAULTS, `garbage blob ${raw} yields defaults`);
  });
}

{
  // Quota and blocked storage never throw and never lose the in-memory value.
  const storage = memoryStorage();
  const { s } = make({ storage });
  s.set("board.theme", "ocean");
  storage.failWrites = true;
  eq(s.set("board.theme", "forest"), true, "a full storage does not reject a valid value");
  eq(s.get("board.theme"), "forest", "the value still applies for this session");
  eq(JSON.parse(storage.map.get("ludus.settings.v2")).values["board.theme"], "ocean", "the stored copy is not corrupted");

  const blocked = memoryStorage();
  blocked.throwAlways = true;
  const b = make({ storage: blocked }).s;
  same(b.get(), Settings.DEFAULTS, "a throwing storage reads as defaults");
  eq(b.set("board.theme", "slate"), true, "and still accepts changes");
  eq(b.get("board.theme"), "slate");

  const noStorage = Settings.create({ storage: null, bus: makeBus(), listenStorage: false });
  same(noStorage.get(), Settings.DEFAULTS, "no storage at all is fine");
}

// ---------- Legacy migration ----------

{
  const storage = memoryStorage();
  storage.map.set("ludus.setup.v1", JSON.stringify({ turnTimeSeconds: 45 }));
  const s = make({ storage }).s;
  eq(s.get("clock.seconds"), 45, "ludus.setup.v1 turnTimeSeconds becomes clock.seconds");
  eq(s.get("clock.mode"), "timed");
  eq(JSON.parse(storage.map.get("ludus.settings.v2")).values["clock.seconds"], 45, "the migration is written to v2 immediately");
  ok(storage.map.has("ludus.setup.v1"), "the legacy key is left for app.js");

  const again = make({ storage }).s;
  eq(again.get("clock.seconds"), 45, "the second load reads v2");
}

{
  const cases = [
    [{ turnTimeSeconds: 9999 }, 360],
    [{ turnTimeSeconds: 1 }, 5],
    [{ turnTimeSeconds: "120" }, 120],
    [{ turnTimeSeconds: 61.4 }, 61],
    [{ turnTimeSeconds: "abc" }, 90],
    [{ turnTimeSeconds: null }, 90],
    [{}, 90],
    [[], 90],
    ["text", 90],
  ];
  cases.forEach(([legacy, expected]) => {
    const storage = memoryStorage();
    storage.map.set("ludus.setup.v1", JSON.stringify(legacy));
    eq(make({ storage }).s.get("clock.seconds"), expected, `legacy ${JSON.stringify(legacy)} -> ${expected}`);
  });

  const both = memoryStorage();
  both.map.set("ludus.setup.v1", JSON.stringify({ turnTimeSeconds: 30 }));
  both.map.set("ludus.settings.v2", JSON.stringify({ v: 2, values: { "clock.seconds": 200 } }));
  eq(make({ storage: both }).s.get("clock.seconds"), 200, "v2 wins over the legacy key");

  const none = memoryStorage();
  make({ storage: none }).s.get();
  eq(none.writes, 0, "nothing is written when there is nothing to migrate or change");
}

// ---------- Derived helpers ----------

{
  const { s } = make();
  const scoring = s.scoringSettings();
  same(scoring, Ludus.Scoring.normalizeSettings({}), "default scoringSettings() equals Scoring's normalized defaults");
  s.set("scoring.model", "tiers");
  s.set("scoring.strictness", "strict");
  s.set("scoring.bestMode", "masters");
  s.set("scoring.tolerancePct", 2.5);
  const custom = s.scoringSettings();
  eq(custom.model, "tiers");
  eq(custom.strictness, "strict");
  eq(custom.bestMode, "masters");
  eq(custom.tolerancePct, 2.5);
  same(custom.hintCost, Ludus.Scoring.DEFAULTS.hintCost, "hint costs come from Scoring");

  same(s.engineBudget(), { movetimeMs: 1500, multiPv: 3 }, "balanced is 1500 ms");
  s.set("engine.strength", "fast");
  eq(s.engineBudget().movetimeMs, 700);
  s.set("engine.strength", "deep");
  eq(s.engineBudget().movetimeMs, 4000);
  s.set("engine.strength", "custom");
  s.set("engine.movetimeMs", 2500);
  s.set("engine.multiPv", 5);
  same(s.engineBudget(), { movetimeMs: 2500, multiPv: 5 }, "custom uses engine.movetimeMs");
  s.set("engine.strength", "fast");
  eq(s.engineBudget().movetimeMs, 700, "presets ignore engine.movetimeMs");

  same(s.clockOptions(), { mode: "timed", seconds: 90 });
  s.set("clock.mode", "untimed");
  eq(s.clockOptions().mode, "untimed");
  eq(s.mistakeThresholdCp(), 80);
  s.set("mistakes.sensitivity", "high");
  eq(s.mistakeThresholdCp(), 50);
  s.set("mistakes.sensitivity", "low");
  eq(s.mistakeThresholdCp(), 150);

  const noScoring = Settings.create({ storage: memoryStorage(), bus: makeBus(), listenStorage: false });
  const saved = globalThis.Ludus.Scoring;
  delete globalThis.Ludus.Scoring;
  try {
    same(noScoring.scoringSettings().hintCost, { level1: 0.15, level2: 0.35, reveal: 1 }, "falls back to built-in hint costs without Scoring");
  } finally {
    globalThis.Ludus.Scoring = saved;
  }
}

// ---------- applyToDocument ----------

{
  const doc = fakeDoc();
  const { s } = make({ doc });
  eq(s.applyToDocument(), true);
  eq(doc.attrs.get("data-board-theme"), "walnut");
  eq(doc.attrs.get("data-contrast"), "normal");
  eq(doc.attrs.get("data-motion"), "auto");
  eq(doc.style.get("--text-scale"), "1");
  s.set("board.theme", "contrast");
  eq(doc.attrs.get("data-board-theme"), "walnut", "an instance without autoApply does not touch the document by itself");
  s.applyToDocument();
  eq(doc.attrs.get("data-board-theme"), "contrast");

  const auto = fakeDoc();
  const live = make({ doc: auto, autoApply: true }).s;
  live.set("a11y.textScale", 1.3);
  live.set("a11y.contrast", "high");
  live.set("a11y.motion", "reduce");
  eq(auto.style.get("--text-scale"), "1.3", "autoApply keeps <html> in sync on set()");
  eq(auto.attrs.get("data-contrast"), "high");
  eq(auto.attrs.get("data-motion"), "reduce");
  live.reset("a11y");
  eq(auto.attrs.get("data-motion"), "auto", "and on reset()");

  const bare = Settings.create({ storage: memoryStorage(), bus: makeBus(), doc: null, listenStorage: false });
  eq(bare.applyToDocument(), false, "no document: reports false instead of throwing");
  eq(bare.applyToDocument({}), false, "a document without documentElement is ignored");
  const plainStyle = { documentElement: { setAttribute() {}, style: {} } };
  eq(bare.applyToDocument(plainStyle), true, "falls back to assigning the custom property when setProperty is missing");
  eq(plainStyle.documentElement.style["--text-scale"], "1");
  const throwing = { get documentElement() { throw new Error("boom"); } };
  eq(bare.applyToDocument(throwing), false, "a throwing document is contained");
}

// ---------- reload (another tab wrote the storage) ----------

{
  const storage = memoryStorage();
  const { s, events } = make({ storage });
  s.get();
  const external = { v: 2, values: { "board.theme": "ocean", "sound.volume": 0.9 } };
  storage.map.set("ludus.settings.v2", JSON.stringify(external));
  s.reload();
  eq(s.get("board.theme"), "ocean", "reload() picks up external changes");
  same(events.map((event) => event.path).sort(), ["board.theme", "sound.volume"], "and announces only what changed");
  const count = events.length;
  s.reload();
  eq(events.length, count, "a reload with no differences is silent");
}

// ---------- The shared instance against a fake localStorage ----------

{
  const fakeStorage = createFakeLocalStorage();
  globalThis.localStorage = fakeStorage;
  const doc = fakeDoc();
  globalThis.document = doc;
  try {
    const shared = Ludus.Settings;
    eq(shared, Settings, "require() and Ludus.Settings are the same object");
    eq(shared.set("board.theme", "forest"), true);
    ok(JSON.parse(fakeStorage.getItem("ludus.settings.v2")).values["board.theme"] === "forest", "the shared instance persists through Ludus.storage");
    eq(doc.attrs.get("data-board-theme"), "forest", "the shared instance keeps the document in sync");
    const seen = [];
    const off = Ludus.bus.on("settings:changed", (payload) => seen.push(payload.path));
    shared.set("board.coords", false);
    off();
    same(seen, ["board.coords"], "the shared instance emits on Ludus.bus");
    shared.reset();
  } finally {
    delete globalThis.localStorage;
    delete globalThis.document;
  }

  // A browser that blocks site data: Ludus.storage swallows the errors.
  globalThis.localStorage = createThrowingLocalStorage();
  try {
    const blockedShared = Settings.create({ listenStorage: false });
    same(blockedShared.get(), Settings.DEFAULTS, "blocked localStorage reads as defaults");
    eq(blockedShared.set("board.theme", "slate"), true, "and settings still work in memory");
    eq(blockedShared.get("board.theme"), "slate");
  } finally {
    delete globalThis.localStorage;
  }
}

// ---------- No storage or DOM access at load time ----------

{
  const fs = require("fs");
  const vm = require("vm");
  const touched = { document: 0, localStorage: 0, storageCalls: 0 };
  const sandbox = { console, navigator: { languages: ["en"] }, setTimeout, clearTimeout };
  Object.defineProperty(sandbox, "document", { get() { touched.document += 1; return undefined; } });
  Object.defineProperty(sandbox, "localStorage", {
    get() {
      touched.localStorage += 1;
      const count = () => { touched.storageCalls += 1; return null; };
      return { getItem: count, setItem: count, removeItem: count, key: count, length: 0 };
    },
  });
  const context = vm.createContext(sandbox);
  const run = (name) => vm.runInContext(fs.readFileSync(path.join(jsDir, name), "utf8"), context, { filename: name });
  run("ludus.js");
  const baseline = JSON.stringify(touched);
  run("scoring.js");
  run("settings.js");
  run("profile.js");
  eq(JSON.stringify(touched), baseline, "loading settings.js and profile.js touches neither document nor localStorage");
  ok(context.Ludus.Settings && context.Ludus.Profile, "both attach to the Ludus namespace in a plain vm context");
  eq(typeof context.Ludus.Profile.recordRound, "function");
}

ok(assertions >= 80, `at least 80 assertions ran (${assertions})`);
console.log(`settings.test.js passed (${assertions} assertions)`);
