// Unit tests for js/ludus.js (namespace, bus, i18n, storage, router, util,
// loadScript, config). Plain assert, no framework, no network.

"use strict";

const assert = require("assert");
const path = require("path");
const { FakeElement, createFakeDom, createFakeLocalStorage, createThrowingLocalStorage } = require("./_fakedom.js");

const ludusPath = path.resolve(__dirname, "..", "..", "js", "ludus.js");
const { createCore } = require(ludusPath);

function quietConsole() {
  const calls = { error: [], warn: [], info: [] };
  return {
    calls,
    error: (...args) => calls.error.push(args),
    warn: (...args) => calls.warn.push(args),
    info: (...args) => calls.info.push(args),
    log: () => {},
  };
}

// Builds an isolated core against fake globals. Everything is injectable.
function makeCore(options = {}) {
  const dom = createFakeDom({ languages: options.languages, localStorage: options.localStorage });
  const consoleStub = quietConsole();
  const env = {
    document: dom.document,
    localStorage: dom.localStorage,
    navigator: dom.navigator,
    console: consoleStub,
    scrollTo: () => {},
    LUDUS_CONFIG: options.config,
    LUDUS_TEST_HOOKS: options.hooks,
  };
  // defineProperties (not assign) so a getter that throws can be injected.
  if (options.env) Object.defineProperties(env, Object.getOwnPropertyDescriptors(options.env));
  return { L: createCore(env), dom, env, console: consoleStub };
}

// ---------- The real global namespace ----------

{
  // Requiring the module in Node attaches it to globalThis and returns it.
  assert.strictEqual(globalThis.Ludus, require(ludusPath), "require() returns the global namespace");
  const names = ["version", "config", "bus", "i18n", "storage", "router", "util", "createCore"];
  names.forEach((name) => assert.ok(name in globalThis.Ludus, `Ludus.${name} should exist`));
  ["on", "off", "emit"].forEach((fn) => assert.strictEqual(typeof Ludus.bus[fn], "function"));
  ["register", "t", "plural", "lang", "setLanguage", "onChange"].forEach((fn) => assert.strictEqual(typeof Ludus.i18n[fn], "function"));
  ["get", "set", "remove", "keys"].forEach((fn) => assert.strictEqual(typeof Ludus.storage[fn], "function"));
  ["register", "show", "current", "back"].forEach((fn) => assert.strictEqual(typeof Ludus.router[fn], "function"));
  ["clamp", "escapeHtml", "uid", "hashString", "now", "h", "formatDate", "formatRelativeDays", "formatDuration", "loadScript"]
    .forEach((fn) => assert.strictEqual(typeof Ludus.util[fn], "function", `Ludus.util.${fn}`));
}

// ---------- Version and config ----------

{
  const { L } = makeCore();
  assert.strictEqual(L.version, "dev", "no <meta name=ludus-version> means \"dev\"");

  const meta = new FakeElement("meta");
  meta.setAttribute("content", " abc123def456 ");
  const withMeta = makeCore({
    env: { document: Object.assign(createFakeDom().document, { querySelector: (sel) => (sel.includes("ludus-version") ? meta : null) }) },
  });
  assert.strictEqual(withMeta.L.version, "abc123def456", "the version comes from the meta tag, trimmed");

  assert.strictEqual(L.config.googleClientId, "", "defaults are filled when no config is present");
  assert.strictEqual(L.config.features.classics, true);
  assert.ok(Object.isFrozen(L.config) && Object.isFrozen(L.config.features), "config is frozen");

  const raw = { googleClientId: "  1234.apps.googleusercontent.com ", features: { classics: 0, extra: "yes" }, custom: { nested: [1, 2] } };
  const configured = makeCore({ config: raw }).L.config;
  assert.strictEqual(configured.googleClientId, "1234.apps.googleusercontent.com");
  assert.strictEqual(configured.features.classics, false, "feature flags are coerced to booleans");
  assert.strictEqual(configured.features.extra, true);
  assert.strictEqual(configured.features.museum, true, "unspecified flags keep their default");
  assert.deepStrictEqual(configured.custom, { nested: [1, 2] }, "unknown keys are preserved");
  raw.googleClientId = "changed";
  assert.strictEqual(configured.googleClientId, "1234.apps.googleusercontent.com", "config is a copy, not a live reference");
  assert.throws(() => { configured.googleClientId = "x"; }, TypeError, "frozen config cannot be mutated");

  assert.strictEqual(makeCore({ config: { googleClientId: 42 } }).L.config.googleClientId, "", "a non-string client id becomes empty");
  assert.strictEqual(makeCore({ config: "garbage" }).L.config.googleClientId, "");
  const polluted = makeCore({ config: JSON.parse('{"__proto__": {"admin": true}, "features": {"__proto__": {"x": true}}}') }).L.config;
  assert.strictEqual(polluted.admin, undefined, "__proto__ keys are dropped");
  assert.strictEqual({}.admin, undefined, "Object.prototype is untouched");
}

// ---------- bus ----------

{
  const { L, console: consoleStub } = makeCore();
  const seen = [];
  const offA = L.bus.on("evt", (payload) => seen.push(["a", payload]));
  L.bus.on("evt", (payload) => seen.push(["b", payload]));
  assert.strictEqual(L.bus.emit("evt", 1), 2, "emit reports how many handlers ran");
  assert.deepStrictEqual(seen, [["a", 1], ["b", 1]], "handlers run in registration order");

  offA();
  offA(); // idempotent
  L.bus.emit("evt", 2);
  assert.deepStrictEqual(seen.slice(2), [["b", 2]], "the function returned by on() unsubscribes");

  const once = () => seen.push(["c"]);
  L.bus.on("evt", once);
  L.bus.on("evt", once);
  L.bus.off("evt", once);
  seen.length = 0;
  L.bus.emit("evt", 3);
  assert.deepStrictEqual(seen, [["b", 3]], "off(evt, fn) removes every registration of fn");

  assert.strictEqual(L.bus.emit("nobody-listens", 1), 0);
  L.bus.off("nobody-listens", () => {});
  assert.strictEqual(typeof L.bus.on("evt", "not a function"), "function", "a non-function handler is ignored, not fatal");

  // A throwing handler is reported and does not stop the others or the emitter.
  const order = [];
  L.bus.on("boom", () => { throw new Error("handler failed"); });
  L.bus.on("boom", () => order.push("after"));
  assert.doesNotThrow(() => L.bus.emit("boom"));
  assert.deepStrictEqual(order, ["after"]);
  assert.strictEqual(consoleStub.calls.error.length, 1, "the handler error is logged with console.error");

  // A handler removed by an earlier handler in the same emit does not run.
  const removed = [];
  let offLater = () => {};
  L.bus.on("mutate", () => offLater());
  offLater = L.bus.on("mutate", () => removed.push("should not run"));
  L.bus.emit("mutate");
  assert.deepStrictEqual(removed, []);

  // A handler may subscribe another handler; it only sees later emits.
  const late = [];
  L.bus.on("grow", () => L.bus.on("grow", () => late.push(1)));
  L.bus.emit("grow");
  assert.deepStrictEqual(late, []);
}

// ---------- i18n ----------

{
  const { L } = makeCore({ languages: ["es-AR"] });
  assert.strictEqual(L.i18n.lang(), "es", "a Spanish browser starts in Spanish");
  assert.strictEqual(makeCore({ languages: ["en-GB", "es"] }).L.i18n.lang(), "en", "the first supported entry of the preference list wins (same rule as app.js)");
  assert.strictEqual(makeCore({ languages: ["es-MX", "en-US"] }).L.i18n.lang(), "es", "...in either order");
  // UX-005: only a browser that asks for Spanish gets Spanish; everybody else (French, German, Portuguese...) gets English.
  ["fr-FR", "pt-BR", "de-DE", "it-IT", "ca-ES", "zh-CN", "et", "eo"].forEach((code) => {
    assert.strictEqual(makeCore({ languages: [code] }).L.i18n.lang(), "en", `${code} gets English, not Spanish`);
  });
  assert.strictEqual(makeCore({ languages: ["fr-FR", "es-AR"] }).L.i18n.lang(), "es", "an unsupported first choice does not hide a supported second one");
  assert.strictEqual(makeCore({ languages: ["es"] }).L.i18n.lang(), "es");
  assert.strictEqual(makeCore({ languages: ["ES-ar"] }).L.i18n.lang(), "es", "codes are case-insensitive");
  assert.strictEqual(makeCore({ languages: [] }).L.i18n.lang(), "en", "no language at all: English");

  // The stored choice is the raw string app.js writes under "ludus.language".
  const stored = createFakeLocalStorage(new Map([["ludus.language", "en"]]));
  assert.strictEqual(makeCore({ languages: ["es"], localStorage: stored }).L.i18n.lang(), "en", "a stored language wins over the browser");
  const junk = createFakeLocalStorage(new Map([["ludus.language", "klingon"]]));
  assert.strictEqual(makeCore({ languages: ["en"], localStorage: junk }).L.i18n.lang(), "es", "an unsupported stored value normalises to es, exactly like app.js");
  assert.strictEqual(makeCore({ languages: ["en"], localStorage: createThrowingLocalStorage() }).L.i18n.lang(), "en", "unreadable storage falls back to the browser language");

  L.i18n.register({
    es: { "t.hello": "Hola {name}", "t.only_es": "Solo español", "t.count": "{n} cosas", "t.blank": "[{a}|{b}]" },
    en: { "t.hello": "Hello {name}", "t.count": "{n} things" },
  });
  assert.strictEqual(L.i18n.t("t.hello", { name: "Ana" }), "Hola Ana");
  assert.strictEqual(L.i18n.t("t.hello", { name: "Ana" }, "en"), "Hello Ana", "the third argument overrides the language");
  assert.strictEqual(L.i18n.t("t.only_es", {}, "en"), "Solo español", "a missing English string falls back to Spanish");
  assert.strictEqual(L.i18n.t("t.unknown.key"), "t.unknown.key", "an unknown key comes back as the key");
  assert.strictEqual(L.i18n.t("t.blank", { a: 0 }), "[0|]", "0 is printed, a missing param becomes empty (same as app.js interpolate)");
  assert.strictEqual(L.i18n.t("t.hello"), "Hola ", "no params at all still strips the placeholder");
  assert.strictEqual(L.i18n.t("t.hello", { name: "<b>" }), "Hola <b>", "t() returns plain text; escaping is the caller's job");
  assert.strictEqual(L.i18n.t("constructor"), "constructor", "prototype keys are not translations");
  assert.strictEqual(L.i18n.t("t.hello", { name: "x" }, "fr"), "Hola x", "an unsupported language behaves like es");

  L.i18n.register({ es: { "t.hello": "Buenas {name}" }, en: null });
  assert.strictEqual(L.i18n.t("t.hello", { name: "Ana" }), "Buenas Ana", "later registrations win");
  assert.strictEqual(L.i18n.t("t.hello", { name: "Ana" }, "en"), "Hello Ana", "registering only es leaves en alone");
  assert.strictEqual(L.i18n.register({ es: { bad: 42, worse: { a: 1 }, ok: "ok" } }), 1, "only string values are registered");
  assert.strictEqual(L.i18n.t("bad"), "bad");
  assert.strictEqual(L.i18n.register(null), 0);
  L.i18n.register({ es: JSON.parse('{"__proto__": "x"}') });
  assert.strictEqual({}.toString, Object.prototype.toString);

  // plural
  const forms = { one: "{n} posición", other: "{n} posiciones" };
  assert.strictEqual(L.i18n.plural("es", 1, forms), "1 posición");
  assert.strictEqual(L.i18n.plural("es", 0, forms), "0 posiciones");
  assert.strictEqual(L.i18n.plural("es", 2, forms), "2 posiciones");
  assert.strictEqual(L.i18n.plural("en", 1, { one: "one move", other: "moves" }), "one move");
  assert.strictEqual(L.i18n.plural("en", 5, { one: "one move" }), "one move", "a missing form falls back to the other one");
  assert.strictEqual(L.i18n.plural("en", 5, null), "");

  // setLanguage / onChange
  const events = [];
  L.bus.on("language:changed", (payload) => events.push(payload));
  const changes = [];
  const offChange = L.i18n.onChange((lang) => changes.push(lang));
  assert.strictEqual(L.i18n.setLanguage("en"), "en");
  assert.strictEqual(L.i18n.lang(), "en");
  assert.strictEqual(L.i18n.t("t.hello", { name: "Ana" }), "Hello Ana", "t() follows the current language");
  assert.deepStrictEqual(events, [{ lang: "en" }], "language:changed carries {lang}");
  assert.deepStrictEqual(changes, ["en"], "onChange receives the language code");
  assert.strictEqual(L.i18n.setLanguage("EN"), "en", "case-insensitive");
  assert.strictEqual(L.i18n.setLanguage("de"), "es", "an unsupported language normalises to es");
  offChange();
  L.i18n.setLanguage("en");
  assert.deepStrictEqual(changes, ["en", "en", "es"], "the function returned by onChange unsubscribes");
}

{
  // Persistence uses the same raw value as app.js and survives storage failures.
  const { L, dom } = makeCore({ languages: ["es"] });
  L.i18n.setLanguage("en");
  assert.strictEqual(dom.storageMap.get("ludus.language"), "en", "stored as the raw string app.js reads");
  assert.strictEqual(dom.document.documentElement.lang, "en", "<html lang> follows");
  L.i18n.setLanguage("es", { persist: false });
  assert.strictEqual(dom.storageMap.get("ludus.language"), "en", "persist:false does not write");

  const blocked = makeCore({ languages: ["es"], localStorage: createThrowingLocalStorage() });
  assert.doesNotThrow(() => blocked.L.i18n.setLanguage("en"));
  assert.strictEqual(blocked.L.i18n.lang(), "en", "the language still changes for this visit");
}

// ---------- storage ----------

{
  const { L, dom } = makeCore();
  assert.strictEqual(L.storage.available, true);
  assert.strictEqual(dom.storageMap.size, 0, "the availability probe cleans up after itself");

  assert.strictEqual(L.storage.set("ludus.test.a", { v: 1, list: [1, "x", null] }), true);
  assert.deepStrictEqual(L.storage.get("ludus.test.a"), { v: 1, list: [1, "x", null] });
  assert.strictEqual(L.storage.get("ludus.test.missing", "fallback"), "fallback");
  assert.strictEqual(L.storage.get("ludus.test.missing"), undefined);
  L.storage.set("ludus.test.zero", 0);
  L.storage.set("ludus.test.false", false);
  assert.strictEqual(L.storage.get("ludus.test.zero", 9), 0, "falsy values round-trip");
  assert.strictEqual(L.storage.get("ludus.test.false", true), false);
  L.storage.set("other.key", 1);
  assert.deepStrictEqual(L.storage.keys("ludus.test."), ["ludus.test.a", "ludus.test.false", "ludus.test.zero"], "keys(prefix) filters and sorts");
  assert.deepStrictEqual(L.storage.keys().length, 4, "keys() without a prefix lists everything");

  dom.storageMap.set("ludus.test.corrupt", "{not json");
  assert.strictEqual(L.storage.get("ludus.test.corrupt", "fb"), "fb", "corrupt JSON falls back instead of throwing");

  assert.strictEqual(L.storage.remove("ludus.test.a"), true);
  assert.strictEqual(L.storage.get("ludus.test.a", "gone"), "gone");

  const circular = {};
  circular.self = circular;
  assert.strictEqual(L.storage.set("ludus.test.circ", circular), false, "an unserialisable value reports false");
  assert.strictEqual(L.storage.set("ludus.test.undef", undefined), false, "undefined is not storable");
  assert.strictEqual(L.storage.set("", 1), false, "an empty key is refused");
  assert.strictEqual(L.storage.get(null, "fb"), "fb");
}

{
  // A localStorage that throws on everything (private mode / blocked site data).
  const { L } = makeCore({ localStorage: createThrowingLocalStorage() });
  assert.strictEqual(L.storage.available, false);
  assert.strictEqual(L.storage.get("k", "fb"), "fb");
  assert.strictEqual(L.storage.set("k", 1), false);
  assert.strictEqual(L.storage.remove("k"), false);
  assert.deepStrictEqual(L.storage.keys("k"), []);
}

{
  // Reading works but writing hits the quota.
  const map = new Map([["ludus.k", "5"]]);
  const quota = createFakeLocalStorage(map);
  quota.setItem = () => { const error = new Error("quota"); error.name = "QuotaExceededError"; throw error; };
  const { L } = makeCore({ localStorage: quota });
  assert.strictEqual(L.storage.available, false, "a failing write probe means not available");
  assert.strictEqual(L.storage.get("ludus.k"), 5, "reads still work");
  assert.strictEqual(L.storage.set("ludus.k", 6), false, "quota errors are reported as false");
}

{
  // Merely accessing window.localStorage can throw (SecurityError).
  const env = {};
  Object.defineProperty(env, "localStorage", { get() { throw new Error("SecurityError"); } });
  const { L } = makeCore({ env });
  assert.strictEqual(L.storage.available, false);
  assert.strictEqual(L.storage.get("k", "fb"), "fb");
  assert.strictEqual(L.storage.set("k", 1), false);
  assert.strictEqual(L.i18n.lang(), "en", "language detection survives too");

  const none = makeCore({ env: { localStorage: null, window: null } });
  assert.strictEqual(none.L.storage.available, false, "no localStorage at all is just unavailable");
}

// ---------- router ----------

function screenEl(hidden = true) {
  const el = new FakeElement("section");
  if (hidden) el.classList.add("hidden");
  return el;
}

{
  const { L, dom, console: consoleStub } = makeCore();
  const home = screenEl();
  const notebook = screenEl();
  const progress = screenEl();
  const log = [];

  assert.strictEqual(L.router.current(), null, "no screen is current before the first show()");
  assert.strictEqual(L.router.register("home", { el: home, title: "Inicio", onShow: (p) => log.push(["show", "home", p]), onHide: () => log.push(["hide", "home"]) }), true);
  L.router.register("notebook", { el: notebook, onShow: (p) => log.push(["show", "notebook", p]), onHide: () => log.push(["hide", "notebook"]) });
  L.router.register("progress", { el: progress });
  L.router.register("ghost", {}); // no element at all
  L.router.register("ghost2", { el: null, onShow: () => log.push(["show", "ghost2"]) });
  assert.strictEqual(L.router.register("", { el: home }), false, "an empty id is refused");

  const changes = [];
  L.bus.on("screen:changed", (payload) => changes.push(payload));

  assert.strictEqual(L.router.show("home"), true);
  assert.strictEqual(L.router.current(), "home");
  assert.strictEqual(home.classList.contains("hidden"), false, "the shown screen loses .hidden");
  assert.strictEqual(home.getAttribute("aria-hidden"), "false");
  assert.strictEqual(notebook.classList.contains("hidden"), true, "every other registered screen is hidden");
  assert.strictEqual(notebook.getAttribute("aria-hidden"), "true");
  assert.strictEqual(progress.getAttribute("aria-hidden"), "true");
  assert.deepStrictEqual(log[0], ["show", "home", {}], "onShow gets {} when no params were passed");
  assert.deepStrictEqual(changes[0], { id: "home", prev: null });
  assert.ok(dom.document.title.startsWith("Inicio"), "the registered title reaches document.title");

  L.router.show("notebook", { cardId: "c1" });
  assert.deepStrictEqual(log.slice(1), [["hide", "home"], ["show", "notebook", { cardId: "c1" }]], "onHide runs before the next onShow");
  assert.strictEqual(home.classList.contains("hidden"), true);
  assert.strictEqual(notebook.classList.contains("hidden"), false);
  assert.deepStrictEqual(changes[1], { id: "notebook", prev: "home" });
  assert.strictEqual(dom.document.title, "Ludus Scaccorum - Mistake Training", "untitled screens fall back to the app title");

  // Unknown ids change nothing.
  const before = changes.length;
  assert.strictEqual(L.router.show("does-not-exist"), false);
  assert.strictEqual(L.router.current(), "notebook");
  assert.strictEqual(changes.length, before);

  // A screen without a container does not break navigation.
  assert.doesNotThrow(() => L.router.show("ghost"));
  assert.doesNotThrow(() => L.router.show("ghost2"));
  assert.strictEqual(L.router.current(), "ghost2");
  assert.strictEqual(notebook.classList.contains("hidden"), true);

  // Showing the current screen again re-runs onShow with the new params but is not a change.
  const changeCount = changes.length;
  L.router.show("ghost2", { again: true });
  assert.strictEqual(changes.length, changeCount, "re-showing the same screen emits no screen:changed");

  // back() restores the previous screen and its params.
  L.router.show("notebook", { cardId: "c9" });
  L.router.show("progress");
  assert.strictEqual(L.router.back(), "notebook");
  assert.strictEqual(L.router.current(), "notebook");
  assert.deepStrictEqual(log[log.length - 1], ["show", "notebook", { cardId: "c9" }], "back() restores the params");
  assert.strictEqual(progress.classList.contains("hidden"), true);
  assert.strictEqual(L.router.back(), "ghost2");
  assert.strictEqual(L.router.back(), "ghost");
  // Keep going until the stack is empty; it never returns a stale id.
  let guard = 0;
  while (L.router.back() && guard < 50) guard += 1;
  assert.ok(guard < 50, "back() terminates");
  assert.strictEqual(L.router.back(), null, "back() on an empty stack does nothing");

  // Hooks that throw are contained and logged.
  L.router.register("bad", { el: screenEl(), onShow: () => { throw new Error("onShow exploded"); }, onHide: () => { throw new Error("onHide exploded"); } });
  assert.doesNotThrow(() => L.router.show("bad"));
  assert.doesNotThrow(() => L.router.show("home"));
  assert.ok(consoleStub.calls.error.length >= 2, "hook failures are logged");
  assert.strictEqual(L.router.current(), "home");

  // A misbehaving element (no classList) is tolerated.
  L.router.register("weird", { el: { setAttribute() { throw new Error("no"); } } });
  assert.doesNotThrow(() => L.router.show("weird"));
}

{
  // Containers can be registered by id and are resolved lazily.
  const { L, dom } = makeCore();
  L.router.register("late", { el: "screen-late" });
  const el = dom.elementFor("screen-late");
  el.classList.add("hidden");
  L.router.show("late");
  assert.strictEqual(el.classList.contains("hidden"), false);

  // The history is capped at 10 entries.
  const ids = [];
  for (let i = 0; i < 15; i += 1) {
    ids.push(`s${i}`);
    L.router.register(`s${i}`, { el: screenEl() });
  }
  ids.forEach((id) => L.router.show(id));
  let depth = 0;
  while (L.router.back()) depth += 1;
  assert.strictEqual(depth, 10, "the back stack keeps the last 10 screens");
}

// ---------- util ----------

{
  const { L } = makeCore();
  const u = L.util;

  assert.strictEqual(u.clamp(5, 0, 3), 3);
  assert.strictEqual(u.clamp(-5, 0, 3), 0);
  assert.strictEqual(u.clamp(2, 0, 3), 2);
  assert.strictEqual(u.clamp("2.5", 0, 3), 2.5);
  assert.strictEqual(u.clamp(NaN, 1, 3), 1, "NaN clamps to the lower bound");
  assert.strictEqual(u.clamp(Infinity, 0, 10), 10);

  assert.strictEqual(u.escapeHtml(`<img src=x onerror="a('b')">&`), "&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;");
  assert.strictEqual(u.escapeHtml(null), "");
  assert.strictEqual(u.escapeHtml(undefined), "");
  assert.strictEqual(u.escapeHtml(0), "0", "0 is a value, not an empty string");
  assert.strictEqual(u.escapeHtml(false), "false");

  // hashString: stable, fixed width, sensitive to every character. The locked
  // values are the published cyrb53 outputs ("a" and "b") plus our own.
  assert.strictEqual(u.hashString("a"), (7929297801672961).toString(16).padStart(14, "0"));
  assert.strictEqual(u.hashString("b"), (8684336938537663).toString(16).padStart(14, "0"));
  assert.strictEqual(u.hashString("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"), "0882680ebf1a2f");
  assert.strictEqual(u.hashString(""), "0bdcb81aee8d83");
  assert.strictEqual(u.hashString("a"), u.hashString("a"));
  assert.notStrictEqual(u.hashString("a"), u.hashString("A"));
  assert.notStrictEqual(u.hashString("ab"), u.hashString("ba"));
  assert.ok(/^[0-9a-f]{14}$/.test(u.hashString("anything at all ñ 😀")), "always 14 lowercase hex digits");
  assert.strictEqual(u.hashString(null), u.hashString(""), "null hashes like the empty string");
  assert.strictEqual(u.hashString(12), u.hashString("12"));

  // uid: unique, and deterministic under injected clock/random.
  const seen = new Set();
  for (let i = 0; i < 2000; i += 1) seen.add(u.uid());
  assert.strictEqual(seen.size, 2000, "uid() does not repeat");
  const fixed = makeCore({ hooks: { now: () => 1750000000000, random: () => 0.5 } }).L.util;
  const first = fixed.uid();
  const second = fixed.uid();
  assert.notStrictEqual(first, second, "the counter separates ids from the same millisecond");
  assert.ok(first.startsWith((1750000000000).toString(36)), "the clock is the leading part");
  assert.strictEqual(makeCore({ hooks: { now: () => 1750000000000, random: () => 0.5 } }).L.util.uid(), first, "same inputs give the same id");
  assert.ok(fixed.uid("r_").startsWith("r_"), "an optional prefix is honoured");
  assert.strictEqual(makeCore({ hooks: { now: () => 42 } }).L.util.now(), 42, "util.now() uses the injected clock");

  // formatDuration
  assert.strictEqual(u.formatDuration(0), "0:00");
  assert.strictEqual(u.formatDuration(5000), "0:05");
  assert.strictEqual(u.formatDuration(65999), "1:05", "seconds are floored");
  assert.strictEqual(u.formatDuration(187000), "3:07");
  assert.strictEqual(u.formatDuration(3723000), "1:02:03");
  assert.strictEqual(u.formatDuration(-4000), "0:00");
  assert.strictEqual(u.formatDuration("garbage"), "0:00");
  assert.strictEqual(u.formatDuration(undefined), "0:00");

  // formatDate (pinned to UTC so the machine's time zone cannot matter)
  const noon = Date.UTC(2026, 5, 15, 12, 0, 0);
  assert.ok(/15/.test(u.formatDate(noon, "es", { timeZone: "UTC" })) && /2026/.test(u.formatDate(noon, "es", { timeZone: "UTC" })));
  assert.ok(/jun/i.test(u.formatDate(noon, "es", { timeZone: "UTC" })), "Spanish month name");
  assert.ok(/Jun/.test(u.formatDate(noon, "en", { timeZone: "UTC" })), "English month name");
  assert.strictEqual(u.formatDate("not a date", "es"), "");
  assert.strictEqual(u.formatDate(undefined, "es"), "");
  assert.strictEqual(u.formatDate(new Date(noon), "en", { timeZone: "UTC" }), u.formatDate(noon, "en", { timeZone: "UTC" }), "Date objects work");

  // formatRelativeDays counts calendar days in local time.
  const localNoon = new Date(2026, 5, 15, 12, 0, 0).getTime();
  const daysFrom = (n) => new Date(2026, 5, 15 + n, 9, 30, 0).getTime();
  assert.strictEqual(u.formatRelativeDays(daysFrom(0), "es", localNoon), "hoy");
  assert.strictEqual(u.formatRelativeDays(daysFrom(-1), "es", localNoon), "ayer");
  assert.strictEqual(u.formatRelativeDays(daysFrom(1), "es", localNoon), "mañana");
  assert.strictEqual(u.formatRelativeDays(daysFrom(-3), "es", localNoon), "hace 3 días");
  assert.strictEqual(u.formatRelativeDays(daysFrom(0), "en", localNoon), "today");
  assert.strictEqual(u.formatRelativeDays(daysFrom(-1), "en", localNoon), "yesterday");
  assert.strictEqual(u.formatRelativeDays(daysFrom(-3), "en", localNoon), "3 days ago");
  assert.strictEqual(u.formatRelativeDays(daysFrom(2), "en", localNoon), "in 2 days");
  assert.strictEqual(u.formatRelativeDays("nope", "en", localNoon), "");
  const clocked = makeCore({ hooks: { now: () => localNoon } }).L.util;
  assert.strictEqual(clocked.formatRelativeDays(daysFrom(-1), "en"), "yesterday", "the injected clock is the default reference");
}

// ---------- util.h (safe DOM builder) ----------

{
  const { L } = makeCore();
  const h = L.util.h;
  let clicks = 0;
  const child = h("span", null, "inner");
  const other = h("i", null, "other");
  const node = h("div", {
    class: ["card", false, "wide", null],
    id: "x1",
    dataset: { kind: "test", n: 3, skip: null },
    "aria-label": "A label",
    "aria-hidden": false,
    hidden: true,
    disabled: false,
    title: 0,
    style: { color: "red", "--gap": "4px", missing: null },
    onClick: () => { clicks += 1; },
    onmouseenter: "alert(1)",
    innerHTML: "<img src=x onerror=alert(1)>",
    srcdoc: "<script>1</script>",
    "bad name": "x",
    "x\"y": "x",
  }, "text <b>bold</b>", 42, null, undefined, false, [child, ["nested"]], other);

  assert.strictEqual(node.tagName, "DIV");
  assert.strictEqual(node.getAttribute("class"), "card wide", "falsy class parts are dropped");
  assert.strictEqual(node.getAttribute("id"), "x1");
  assert.deepStrictEqual(node.dataset, { kind: "test", n: "3" });
  assert.strictEqual(node.getAttribute("aria-label"), "A label");
  assert.strictEqual(node.getAttribute("aria-hidden"), "false", "aria-* false is kept as the string \"false\"");
  assert.strictEqual(node.attributes.has("hidden"), true, "true sets a boolean attribute");
  assert.strictEqual(node.attributes.has("disabled"), false, "false omits a boolean attribute");
  assert.strictEqual(node.getAttribute("title"), "0", "numbers are stringified");
  assert.strictEqual(node.style.color, "red");
  assert.strictEqual(node.attributes.has("innerHTML"), false, "innerHTML is refused");
  assert.strictEqual(node.innerHTML, "", "innerHTML is never assigned");
  assert.strictEqual(node.attributes.has("srcdoc"), false);
  assert.strictEqual(node.attributes.has("onmouseenter"), false, "string event handlers are refused");
  assert.strictEqual(node.attributes.has("bad name"), false, "invalid attribute names are skipped");
  node.dispatch("click");
  assert.strictEqual(clicks, 1, "on<Event> functions become listeners");

  const kinds = node.children.map((c) => (c.nodeType === 3 ? `text:${c.textContent}` : c.tagName));
  assert.deepStrictEqual(kinds, ["text:text <b>bold</b>", "text:42", "SPAN", "text:nested", "I"], "strings are text nodes, arrays are flattened, empties skipped");
  assert.strictEqual(node.children.filter((c) => c.tagName === "B").length, 0, "markup in a string never becomes an element");

  // Attributes optional; a bare string or node is a child.
  const bare = h("p", "just text");
  assert.strictEqual(bare.children[0].textContent, "just text");
  const wrapped = h("div", child);
  assert.strictEqual(wrapped.children[0], child);
  assert.strictEqual(h("div").children.length, 0);

  // URLs
  assert.strictEqual(h("a", { href: "javascript:alert(1)" }).attributes.has("href"), false);
  assert.strictEqual(h("a", { href: " JaVa\nScRiPt:alert(1)" }).attributes.has("href"), false, "obfuscated javascript: is dropped");
  assert.strictEqual(h("a", { href: "data:text/html,<script>" }).attributes.has("href"), false);
  assert.strictEqual(h("img", { src: "vbscript:x" }).attributes.has("src"), false);
  assert.strictEqual(h("a", { href: "#/progress" }).getAttribute("href"), "#/progress");
  assert.strictEqual(h("a", { href: "https://example.org/a?b=1" }).getAttribute("href"), "https://example.org/a?b=1");
  assert.strictEqual(h("img", { src: "data:image/png;base64,AAAA" }).getAttribute("src"), "data:image/png;base64,AAAA", "data: images stay allowed");

  assert.strictEqual(h("button", { text: "<i>" }).textContent, "<i>", "text sets textContent");
  assert.strictEqual(h("svg:path", { d: "M0 0" }).tagName, "PATH");
  assert.throws(() => h("div><script"), /invalid tag/);
  assert.throws(() => h(""), /invalid tag/);
  assert.throws(() => h(null), /invalid tag/);
}

{
  const noDoc = makeCore({ env: { document: null } }).L;
  assert.throws(() => noDoc.util.h("div"), /document/, "h() needs a document and says so");
}

// ---------- loadScript ----------

async function loadScriptTests() {
  function scriptEnv(shouldLoad) {
    const dom = createFakeDom();
    const appended = [];
    dom.document.head.appendChild = (script) => {
      appended.push(script);
      Promise.resolve().then(() => (shouldLoad(script) ? script.onload() : script.onerror()));
      return script;
    };
    const core = makeCore({ env: { document: dom.document } });
    return { L: core.L, appended };
  }

  {
    const { L, appended } = scriptEnv(() => true);
    await L.util.loadScript("js/data/classics.data.js");
    assert.strictEqual(appended.length, 1);
    assert.strictEqual(appended[0].src, "js/data/classics.data.js?v=dev", "the version is appended as ?v=");
    assert.strictEqual(appended[0].async, true);

    const a = L.util.loadScript("js/data/classics.data.js");
    const b = L.util.loadScript("js/data/classics.data.js");
    assert.strictEqual(a, b, "the same path shares one promise");
    await Promise.all([a, b]);
    assert.strictEqual(appended.length, 1, "a script is only ever appended once");

    await L.util.loadScript("js/other.js?x=1");
    assert.strictEqual(appended[1].src, "js/other.js?x=1&v=dev", "an existing query string gets &v=");
  }

  {
    let fail = true;
    const { L, appended } = scriptEnv(() => !fail);
    await assert.rejects(L.util.loadScript("js/flaky.js"), /failed to load/, "a load error rejects");
    fail = false;
    await L.util.loadScript("js/flaky.js");
    assert.strictEqual(appended.length, 2, "after a failure the next call tries again");
  }

  {
    const { L } = scriptEnv(() => true);
    for (const bad of ["https://evil.example/x.js", "//evil.example/x.js", "javascript:alert(1)", "data:text/javascript,1", "", null]) {
      await assert.rejects(L.util.loadScript(bad), /same-origin|only/, `refuses ${bad}`);
    }
  }

  {
    const noDoc = makeCore({ env: { document: null } }).L;
    await assert.rejects(noDoc.util.loadScript("js/x.js"), /no document/, "rejects when there is no document (Node)");
    await assert.rejects(Ludus.util.loadScript("js/x.js"), /no document/, "the real Node namespace rejects too");
  }

  {
    // The version from the meta tag is used.
    const dom = createFakeDom();
    const meta = new FakeElement("meta");
    meta.setAttribute("content", "v123");
    dom.document.querySelector = (sel) => (sel.includes("ludus-version") ? meta : null);
    const appended = [];
    dom.document.head.appendChild = (script) => { appended.push(script); Promise.resolve().then(() => script.onload()); return script; };
    const { L } = makeCore({ env: { document: dom.document } });
    await L.util.loadScript("js/x.js");
    assert.strictEqual(appended[0].src, "js/x.js?v=v123");
  }
}


// ---------- loadScript: a script that never answers ends in an error, not in a screen that waits for ever (UX-026) ----------

async function loadScriptTimeoutTests() {
  function hangingEnv() {
    const dom = createFakeDom();
    const appended = [];
    dom.document.head.appendChild = (script) => {
      appended.push(script);
      return script; // never loads, never fails
    };
    const core = makeCore({ env: { document: dom.document, setTimeout, clearTimeout } });
    return { L: core.L, appended };
  }
  {
    const { L, appended } = hangingEnv();
    const started = Date.now();
    await assert.rejects(L.util.loadScript("js/data/classics.data.js", { timeoutMs: 40 }), /timed out/, "a script that never answers rejects");
    assert.ok(Date.now() - started < 1000);
    assert.strictEqual(appended.length, 1);
    await assert.rejects(L.util.loadScript("js/data/classics.data.js", { timeoutMs: 40 }), /timed out/);
    assert.strictEqual(appended.length, 2, "after the timeout the next call tries again");
  }
  {
    // A script that answers in time is not rejected later by its own timer.
    const dom = createFakeDom();
    dom.document.head.appendChild = (script) => { setTimeout(() => script.onload(), 10); return script; };
    const { L } = makeCore({ env: { document: dom.document, setTimeout, clearTimeout } });
    await L.util.loadScript("js/ok.js", { timeoutMs: 60 });
    await new Promise((resolve) => setTimeout(resolve, 120));
    await L.util.loadScript("js/ok.js"); // still resolved: the same promise
  }
}

// ---------- router: one history entry per screen, Back and Forward move between screens (UX-001) ----------

async function routerHistoryTests() {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
  // A window with history, location and popstate, as much as the router needs.
  function fakeWindow(initialUrl = "http://app.test/") {
    const entries = [{ state: null, url: initialUrl }];
    let index = 0;
    const listeners = {};
    const location = { get href() { return entries[index].url; }, get hash() { const i = entries[index].url.indexOf("#"); return i < 0 ? "" : entries[index].url.slice(i); } };
    const fire = (type, event) => (listeners[type] || []).slice().forEach((fn) => fn(event));
    const history = {
      get state() { return entries[index].state; },
      get length() { return entries.length; },
      pushState(state, title, url) {
        entries.splice(index + 1);
        entries.push({ state, url: url === undefined ? entries[index].url : new URL(url, entries[index].url).href });
        index += 1;
      },
      replaceState(state, title, url) {
        entries[index] = { state, url: url === undefined ? entries[index].url : new URL(url, entries[index].url).href };
      },
      back() { this.go(-1); },
      forward() { this.go(1); },
      go(delta) {
        const target = index + delta;
        if (target < 0 || target >= entries.length) return;
        setTimeout(() => { index = target; fire("popstate", { state: entries[index].state }); }, 0);
      },
    };
    return { history, location, addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); }, entries, at: () => index, fire };
  }
  function makeRouter(extra = {}) {
    const win = fakeWindow();
    const dom = createFakeDom();
    const { L } = makeCore({ env: { document: dom.document, history: win.history, location: win.location, addEventListener: win.addEventListener, setTimeout, clearTimeout } });
    const log = [];
    const screen = (id, more = {}) => L.router.register(id, { el: new FakeElement("section"), onShow: () => log.push(`show ${id}`), onHide: () => log.push(`hide ${id}`), ...more, ...(extra[id] || {}) });
    return { L, win, log, screen };
  }

  {
    // One entry per screen: the first adopts the page as it was opened, the others are pushed.
    const { L, win, log, screen } = makeRouter();
    ["home", "classics", "notebook"].forEach((id) => screen(id));
    L.router.show("home");
    assert.strictEqual(win.entries.length, 1, "the first screen takes the entry the page was opened with");
    assert.strictEqual(win.history.state.ludus.id, "home");
    L.router.show("classics");
    L.router.show("notebook");
    assert.strictEqual(win.entries.length, 3);
    L.router.show("notebook");
    assert.strictEqual(win.entries.length, 3, "showing the screen that is already on show writes nothing");
    win.history.back();
    await tick();
    assert.strictEqual(L.router.current(), "classics", "Back goes one screen up");
    win.history.back();
    await tick();
    assert.strictEqual(L.router.current(), "home");
    win.history.forward();
    await tick();
    assert.strictEqual(L.router.current(), "classics", "Forward goes on");
    assert.strictEqual(win.entries.length, 3, "moving through the history writes nothing");
    L.router.show("home");
    assert.strictEqual(win.entries.length, 3, "a new screen drops the forward entries (as any browser does) and adds its own");
    assert.ok(log.includes("hide classics"));
    // An entry that is not ours (a hash typed by hand) is left to the shell.
    win.fire("popstate", { state: null });
    assert.strictEqual(L.router.current(), "home");
    // A hash typed by hand makes an untagged entry: the next screen adopts it instead of adding one.
    win.history.pushState(null, "", "#/progress");
    const before = win.entries.length;
    L.router.show("classics");
    assert.strictEqual(win.entries.length, before, "the untagged entry is adopted");
    assert.strictEqual(win.history.state.ludus.id, "classics");
  }

  {
    // A transient screen (the game) gives its entry to the screen it is left for.
    const { L, win, screen } = makeRouter();
    screen("home");
    screen("classics");
    screen("game", { transient: true });
    L.router.show("home");
    L.router.show("classics");
    L.router.show("game");
    assert.strictEqual(win.entries.length, 3);
    L.router.show("home");
    assert.strictEqual(win.entries.length, 3, "the game's entry became home's: no dead entry is left behind");
    win.history.back();
    await tick();
    assert.strictEqual(L.router.current(), "classics", "Back from home goes to where the game was started from");
  }

  {
    // A screen can ask before Back leaves it: a "no" leaves the person where they were, a "yes" goes on.
    let answer = false;
    let asked = 0;
    const { L, win, screen } = makeRouter();
    screen("home");
    screen("classics");
    screen("game", { transient: true, canLeave: async (info) => { asked += 1; assert.strictEqual(info.to, "classics"); return answer; } });
    L.router.show("home");
    L.router.show("classics");
    L.router.show("game");
    const length = win.entries.length;
    win.history.back();
    await tick();
    await tick();
    assert.strictEqual(asked, 1, "asked once");
    assert.strictEqual(L.router.current(), "game", "a no: still in the game");
    assert.strictEqual(win.history.state.ludus.id, "game", "on the game's own entry (the one the browser popped is put back)");
    assert.strictEqual(win.entries.length, length, "no entries were added by asking");
    answer = true;
    win.history.back();
    await tick();
    await tick();
    await tick();
    assert.strictEqual(asked, 2);
    assert.strictEqual(L.router.current(), "classics", "a yes: on to where Back was going");
    assert.strictEqual(win.history.state.ludus.id, "classics");
    assert.strictEqual(win.entries.length, length, "the history is as if the question had not been asked");
  }

  {
    // Entries that cannot be shown any more are skipped (Back) or bounced off (Forward).
    let alive = true;
    const { L, win, screen } = makeRouter();
    screen("home");
    screen("game", { transient: true, canEnter: () => alive });
    screen("classics");
    L.router.show("home");
    L.router.show("classics");
    L.router.show("game");
    L.router.show("classics"); // the game's entry becomes classics'
    win.history.pushState({ ludus: { id: "game", seq: 99 } }, ""); // a dead game entry ahead (as a finished game leaves)
    win.history.back();
    await tick();
    alive = false;
    win.history.forward();
    await tick();
    await tick();
    assert.strictEqual(L.router.current(), "classics", "Forward into a finished game bounces back");
  }

  {
    // Sub-states: a wizard's steps are entries of the screen.
    const steps = [];
    const { L, win, screen } = makeRouter();
    screen("home");
    screen("setup", { onSub: (sub) => steps.push(sub && sub.step ? sub.step : 1) });
    L.router.show("home");
    L.router.show("setup");
    assert.strictEqual(L.router.subDepth(), 0);
    assert.strictEqual(L.router.pushSub({ step: 2 }), true);
    assert.strictEqual(L.router.pushSub({ step: 2 }), false, "the same sub-state is not pushed twice");
    L.router.pushSub({ step: 3 });
    assert.strictEqual(L.router.subDepth(), 2);
    win.history.back();
    await tick();
    assert.deepStrictEqual(steps, [2], "Back lands on step 2");
    assert.strictEqual(L.router.current(), "setup");
    assert.strictEqual(L.router.popSub(), true, "the screen's own Previous goes one step back as Back does");
    await tick();
    assert.deepStrictEqual(steps, [2, 1]);
    assert.strictEqual(L.router.popSub(), false, "nothing left to go back to on the screen");
    win.history.forward();
    await tick();
    win.history.forward();
    await tick();
    assert.deepStrictEqual(steps.slice(-2), [2, 3], "Forward walks the steps again");
    // A programmatic jump back is a replacement, not a new entry.
    const length = win.entries.length;
    L.router.replaceSub({ step: 2 });
    assert.strictEqual(win.entries.length, length);
    assert.strictEqual(win.history.state.ludus.sub.step, 2);
    // A second Back while a question is open does not stack questions.
  }

  {
    // Without a history (Node, a sandboxed frame) the router works as it always did.
    const dom = createFakeDom();
    const { L } = makeCore({ env: { document: dom.document } });
    L.router.register("a", { el: new FakeElement("section") });
    L.router.register("b", { el: new FakeElement("section") });
    assert.strictEqual(L.router.show("a"), true);
    assert.strictEqual(L.router.show("b"), true);
    assert.strictEqual(L.router.pushSub({ step: 2 }), false);
    assert.strictEqual(L.router.popSub(), false);
    assert.strictEqual(L.router.back(), "a");
    // A history that refuses (a sandboxed frame) does not break navigation either.
    const refusing = { pushState() { throw new Error("SecurityError"); }, replaceState() { throw new Error("SecurityError"); }, state: null };
    const core = makeCore({ env: { document: createFakeDom().document, history: refusing, location: { href: "http://x/" }, addEventListener() {} } });
    core.L.router.register("a", { el: new FakeElement("section") });
    core.L.router.register("b", { el: new FakeElement("section") });
    assert.strictEqual(core.L.router.show("a"), true);
    assert.strictEqual(core.L.router.show("b"), true);
  }
}

loadScriptTests().then(loadScriptTimeoutTests).then(routerHistoryTests).then(() => {
  console.log("ludus.test.js passed");
}, (error) => {
  console.error(error);
  process.exit(1);
});
