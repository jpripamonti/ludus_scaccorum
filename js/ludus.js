// Ludus core: the single global namespace every other module hangs off.
//
//   Ludus.version / Ludus.config           build stamp and owner configuration
//   Ludus.bus                              synchronous publish/subscribe
//   Ludus.i18n                             es/en dictionaries, interpolation, language
//   Ludus.storage                          JSON localStorage that never throws
//   Ludus.router                           screen visibility + tiny history
//   Ludus.util                             small pure helpers + safe DOM builder
//
// This file loads first (after config.js). It has no dependency on any other
// Ludus module and touches the DOM only when a function that needs it is
// called, so it also runs under Node. `Ludus.createCore(env)` builds an
// isolated instance against a fake environment; tests use it, the app does not
// (env may carry LUDUS_TEST_HOOKS = { now, random } to make ids and relative
// dates deterministic). The contract lives in docs/ARCHITECTURE.md section 4.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = Object.assign(root.Ludus || {}, api);
  if (typeof module !== "undefined" && module.exports) module.exports = root.Ludus;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCore(root) {
  "use strict";

  // Same key and format as app.js (LANGUAGE_STORAGE_KEY): a raw "es" / "en"
  // string, not JSON, so both sides read and write the same value.
  const LANGUAGE_STORAGE_KEY = "ludus.language";
  const SUPPORTED_LANGUAGES = ["es", "en"];
  const DEFAULT_LANGUAGE = "es";
  const ROUTER_HISTORY_LIMIT = 10;
  const STORAGE_PROBE_KEY = "ludus.__probe";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const FORBIDDEN_KEYS = ["__proto__", "constructor", "prototype"];

  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const noop = () => {};

  // ---------- Environment access (all of it guarded) ----------

  function getDocument() {
    try {
      return root.document || null;
    } catch (error) {
      return null;
    }
  }

  function getLocalStorage() {
    try {
      const direct = root.localStorage;
      if (direct) return direct;
      return (root.window && root.window.localStorage) || null;
    } catch (error) {
      // Accessing localStorage itself throws when site data is blocked.
      return null;
    }
  }

  function getLog() {
    return root.console || (typeof console !== "undefined" ? console : { error: noop, warn: noop, info: noop });
  }

  function logError(...args) {
    try {
      getLog().error(...args);
    } catch (error) {
      // Nothing sensible left to do.
    }
  }

  const hooks = (root.LUDUS_TEST_HOOKS && typeof root.LUDUS_TEST_HOOKS === "object") ? root.LUDUS_TEST_HOOKS : {};
  const now = typeof hooks.now === "function" ? hooks.now : () => Date.now();

  function defaultRandom() {
    try {
      const webCrypto = root.crypto;
      if (webCrypto && typeof webCrypto.getRandomValues === "function") {
        const buffer = new Uint32Array(1);
        webCrypto.getRandomValues(buffer);
        return buffer[0] / 4294967296;
      }
    } catch (error) {
      // Fall through to Math.random.
    }
    return Math.random();
  }
  const random = typeof hooks.random === "function" ? hooks.random : defaultRandom;

  // ---------- Config ----------

  // config.js sets window.LUDUS_CONFIG; in a browser that is the global itself,
  // but a Node harness may keep `window` as a separate object.
  function readRawConfig() {
    try {
      return root.LUDUS_CONFIG || (root.window && root.window.LUDUS_CONFIG) || null;
    } catch (error) {
      return null;
    }
  }

  const CONFIG_DEFAULTS = {
    googleClientId: "",
    features: { classics: true, notebook: true, daily: true, museum: true, audio: true },
  };

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach((key) => deepFreeze(value[key]));
    }
    return value;
  }

  function cleanClone(value) {
    if (Array.isArray(value)) return value.map(cleanClone);
    if (value && typeof value === "object") {
      const out = {};
      Object.keys(value).forEach((key) => {
        if (FORBIDDEN_KEYS.includes(key)) return;
        out[key] = cleanClone(value[key]);
      });
      return out;
    }
    return value;
  }

  function buildConfig(raw) {
    let source = {};
    try {
      source = raw && typeof raw === "object" ? cleanClone(JSON.parse(JSON.stringify(raw))) : {};
    } catch (error) {
      source = {};
    }
    const features = Object.assign({}, CONFIG_DEFAULTS.features);
    if (source.features && typeof source.features === "object" && !Array.isArray(source.features)) {
      Object.keys(source.features).forEach((key) => {
        features[key] = Boolean(source.features[key]);
      });
    }
    const config = Object.assign({}, source, {
      googleClientId: typeof source.googleClientId === "string" ? source.googleClientId.trim() : "",
      features,
    });
    return deepFreeze(config);
  }

  function readVersion() {
    try {
      const doc = getDocument();
      const meta = doc && typeof doc.querySelector === "function"
        ? doc.querySelector('meta[name="ludus-version"]')
        : null;
      const value = meta && typeof meta.getAttribute === "function" ? meta.getAttribute("content") : "";
      return typeof value === "string" && value.trim() ? value.trim() : "dev";
    } catch (error) {
      return "dev";
    }
  }

  const version = readVersion();
  const config = buildConfig(readRawConfig());

  // ---------- Event bus ----------

  function createBus() {
    const handlers = new Map();

    function on(evt, fn) {
      if (typeof fn !== "function") return noop;
      const record = { fn, active: true };
      if (!handlers.has(evt)) handlers.set(evt, []);
      handlers.get(evt).push(record);
      return function off() {
        record.active = false;
        const list = handlers.get(evt);
        if (list) handlers.set(evt, list.filter((entry) => entry !== record));
      };
    }

    function off(evt, fn) {
      const list = handlers.get(evt);
      if (!list) return;
      list.forEach((record) => {
        if (record.fn === fn) record.active = false;
      });
      handlers.set(evt, list.filter((record) => record.active));
    }

    // Handlers run synchronously in registration order. A handler that throws
    // is reported and skipped; it never stops the others or the emitter.
    function emit(evt, payload) {
      const list = handlers.get(evt);
      if (!list || list.length === 0) return 0;
      let called = 0;
      list.slice().forEach((record) => {
        if (!record.active) return;
        called += 1;
        try {
          record.fn(payload);
        } catch (error) {
          logError(`[Ludus.bus] handler for "${evt}" threw`, error);
        }
      });
      return called;
    }

    return { on, off, emit };
  }

  const bus = createBus();

  // ---------- i18n ----------

  function normalizeLanguage(value) {
    const lower = String(value || "").toLowerCase();
    return SUPPORTED_LANGUAGES.includes(lower) ? lower : DEFAULT_LANGUAGE;
  }

  // The language a browser asks for: the first Spanish or English entry of its
  // preference list wins, and anything else (French, German, Portuguese...) gets
  // English, the language a stranger is most likely to read. Only a browser that
  // really asks for Spanish gets Spanish. Mirrored by app.js detectInitialLanguage().
  function languageFromBrowserList(list) {
    const languages = Array.isArray(list) ? list : [];
    for (let i = 0; i < languages.length; i += 1) {
      const code = String(languages[i] || "").toLowerCase();
      if (code === "es" || code.startsWith("es-") || code.startsWith("es_")) return "es";
      if (code === "en" || code.startsWith("en-") || code.startsWith("en_")) return "en";
    }
    return "en";
  }

  // A stored choice wins, otherwise the browser's preference (see above).
  function detectInitialLanguage() {
    try {
      const storage = getLocalStorage();
      const stored = storage ? storage.getItem(LANGUAGE_STORAGE_KEY) : null;
      if (stored) return normalizeLanguage(stored);
    } catch (error) {
      // Fall through to the browser language.
    }
    try {
      const nav = root.navigator || (root.window && root.window.navigator) || {};
      return languageFromBrowserList(Array.isArray(nav.languages) && nav.languages.length ? nav.languages : [nav.language]);
    } catch (error) {
      return "en";
    }
  }

  function interpolate(text, params) {
    const values = params && typeof params === "object" ? params : {};
    return String(text).replace(/\{(\w+)\}/g, (_, key) => {
      const value = hasOwn(values, key) ? values[key] : undefined;
      return value == null ? "" : String(value);
    });
  }

  function createI18n() {
    const dictionaries = { es: Object.create(null), en: Object.create(null) };
    let current = detectInitialLanguage();

    // Later registrations win. Only string values under a supported language
    // are kept; anything else is ignored rather than trusted.
    function register(bundle) {
      let added = 0;
      if (!bundle || typeof bundle !== "object") return added;
      SUPPORTED_LANGUAGES.forEach((lang) => {
        const entries = bundle[lang];
        if (!entries || typeof entries !== "object") return;
        Object.keys(entries).forEach((key) => {
          if (FORBIDDEN_KEYS.includes(key)) return;
          if (typeof entries[key] !== "string") return;
          dictionaries[lang][key] = entries[key];
          added += 1;
        });
      });
      return added;
    }

    function lookup(lang, key) {
      const dictionary = dictionaries[lang];
      return dictionary && key in dictionary ? dictionary[key] : undefined;
    }

    function has(key, lang) {
      return lookup(lang ? normalizeLanguage(lang) : current, String(key)) !== undefined;
    }

    // Unknown keys come back as the key itself (never interpolated) so a
    // missing string is visible instead of blank. The result is plain text:
    // callers that put it into HTML must escape it.
    function t(key, params, lang) {
      const id = String(key);
      const language = lang ? normalizeLanguage(lang) : current;
      let text = lookup(language, id);
      if (text === undefined) text = lookup(DEFAULT_LANGUAGE, id);
      if (text === undefined) return id;
      return interpolate(text, params);
    }

    // Both supported languages use the same rule: exactly one is singular.
    // "{n}" inside the chosen form is replaced by the number.
    function plural(lang, n, forms) {
      const source = forms && typeof forms === "object" ? forms : {};
      const singular = Math.abs(Number(n)) === 1;
      const form = singular ? (source.one ?? source.other) : (source.other ?? source.one);
      if (typeof form !== "string") return "";
      return interpolate(form, { n });
    }

    function lang() {
      return current;
    }

    function setLanguage(next, options) {
      current = normalizeLanguage(next);
      if (!(options && options.persist === false)) {
        try {
          const storage = getLocalStorage();
          if (storage) storage.setItem(LANGUAGE_STORAGE_KEY, current);
        } catch (error) {
          // Private mode or quota: the choice just does not survive a reload.
        }
      }
      try {
        const doc = getDocument();
        if (doc && doc.documentElement) doc.documentElement.lang = current;
      } catch (error) {
        // Ignore: cosmetic.
      }
      bus.emit("language:changed", { lang: current });
      return current;
    }

    // fn receives the new language code ("es" | "en").
    function onChange(fn) {
      if (typeof fn !== "function") return noop;
      return bus.on("language:changed", (payload) => fn(payload && payload.lang));
    }

    return { register, t, has, plural, lang, setLanguage, onChange, supported: SUPPORTED_LANGUAGES.slice() };
  }

  const i18n = createI18n();

  // Only what the core itself needs (the router's fallback document title).
  i18n.register({
    es: { "meta.title": "Ludus Scaccorum - Entrenamiento de Errores" },
    en: { "meta.title": "Ludus Scaccorum - Mistake Training" },
  });

  // ---------- Storage ----------

  function createStorage() {
    function usable(key) {
      return typeof key === "string" && key.length > 0;
    }

    function get(key, fallback) {
      if (!usable(key)) return fallback;
      try {
        const storage = getLocalStorage();
        if (!storage) return fallback;
        const raw = storage.getItem(key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch (error) {
        return fallback;
      }
    }

    function set(key, value) {
      if (!usable(key)) return false;
      try {
        const storage = getLocalStorage();
        if (!storage) return false;
        const serialized = JSON.stringify(value);
        if (typeof serialized !== "string") return false;
        storage.setItem(key, serialized);
        return true;
      } catch (error) {
        // Quota exceeded, private mode, or a value JSON cannot represent.
        return false;
      }
    }

    function remove(key) {
      if (!usable(key)) return false;
      try {
        const storage = getLocalStorage();
        if (!storage) return false;
        storage.removeItem(key);
        return true;
      } catch (error) {
        return false;
      }
    }

    function keys(prefix) {
      const wanted = typeof prefix === "string" ? prefix : "";
      const found = [];
      try {
        const storage = getLocalStorage();
        if (!storage) return found;
        for (let i = 0; i < storage.length; i += 1) {
          const key = storage.key(i);
          if (typeof key === "string" && key.startsWith(wanted)) found.push(key);
        }
      } catch (error) {
        return [];
      }
      return found.sort();
    }

    // One probe at load time: can we actually write here?
    let available = false;
    try {
      const storage = getLocalStorage();
      if (storage) {
        storage.setItem(STORAGE_PROBE_KEY, "1");
        storage.removeItem(STORAGE_PROBE_KEY);
        available = true;
      }
    } catch (error) {
      available = false;
    }

    return { get, set, remove, keys, available };
  }

  const storage = createStorage();

  // ---------- Utilities ----------

  function clamp(value, min, max) {
    const number = Number(value);
    if (Number.isNaN(number)) return min;
    return Math.min(max, Math.max(min, number));
  }

  function escapeHtml(value) {
    return (value === null || value === undefined ? "" : String(value))
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  let uidCounter = 0;
  // Unique enough for local records: clock + 32 random bits + a counter that
  // separates ids generated inside the same millisecond.
  function uid(prefix) {
    uidCounter = (uidCounter + 1) % 46656;
    const time = Math.floor(now()).toString(36);
    const noise = Math.floor(random() * 2821109907456).toString(36).padStart(8, "0");
    return `${prefix || ""}${time}${noise}${uidCounter.toString(36).padStart(3, "0")}`;
  }

  // cyrb53: a well-mixed 53-bit non-cryptographic hash. Deterministic across
  // platforms (it only uses 32-bit integer maths on UTF-16 code units), so it
  // is safe for stable ids such as "classic:<hash of the FEN>". 14 hex digits.
  function hashString(value) {
    const text = value === null || value === undefined ? "" : String(value);
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ code, 2654435761);
      h2 = Math.imul(h2 ^ code, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
  }

  function localeFor(lang) {
    return normalizeLanguage(lang) === "en" ? "en-US" : "es-AR";
  }

  function toDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // `options` is merged into the Intl.DateTimeFormat options (for example
  // { timeZone: "UTC" } to make output independent of the machine).
  function formatDate(ts, lang, options) {
    const date = toDate(ts);
    if (!date) return "";
    try {
      return new Intl.DateTimeFormat(
        localeFor(lang),
        Object.assign({ year: "numeric", month: "short", day: "numeric" }, options),
      ).format(date);
    } catch (error) {
      return date.toISOString().slice(0, 10);
    }
  }

  // "today", "yesterday", "3 days ago", "in 2 days" ... counted in calendar
  // days of the local time zone, not in 24-hour blocks. `nowMs` is optional.
  function formatRelativeDays(ts, lang, nowMs) {
    const date = toDate(ts);
    if (!date) return "";
    const reference = new Date(nowMs === undefined ? now() : nowMs);
    const dayOf = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const days = Math.round((dayOf(date) - dayOf(reference)) / 86400000);
    try {
      return new Intl.RelativeTimeFormat(localeFor(lang), { numeric: "auto" }).format(days, "day");
    } catch (error) {
      return formatDate(date, lang);
    }
  }

  // "3:07", "0:05" or "1:02:03" (seconds are floored; bad input gives "0:00").
  function formatDuration(ms) {
    const number = Number(ms);
    const total = Number.isFinite(number) ? Math.max(0, Math.floor(number / 1000)) : 0;
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const two = (n) => String(n).padStart(2, "0");
    return hours ? `${hours}:${two(minutes)}:${two(seconds)}` : `${minutes}:${two(seconds)}`;
  }

  // ----- Safe DOM builder -----
  // h("button", { class: "btn", "aria-label": "Close", onclick: fn }, "Close")
  // Strings are always text nodes (never parsed as HTML); "innerHTML" and
  // friends are refused; on* attributes accept functions only; javascript:
  // URLs are dropped. Use "svg:<tag>" (for example "svg:path") for SVG nodes.

  const URL_ATTRIBUTES = ["href", "src", "action", "formaction", "xlink:href"];
  const ATTRIBUTE_NAME = /^[A-Za-z_:][-A-Za-z0-9_:.]*$/;

  function isNode(value) {
    return Boolean(value) && typeof value === "object" && typeof value.nodeType === "number";
  }

  function classString(value) {
    if (Array.isArray(value)) return value.filter(Boolean).map(String).join(" ");
    return value ? String(value) : "";
  }

  function unsafeUrl(name, value) {
    const compact = String(value).replace(/[\u0000- \u007f]+/g, "").toLowerCase();
    if (/^(javascript|vbscript):/.test(compact)) return true;
    return (name === "href" || name === "action" || name === "formaction") && compact.startsWith("data:");
  }

  function appendChild(parent, child, doc) {
    if (child === null || child === undefined || typeof child === "boolean") return;
    if (Array.isArray(child)) {
      child.forEach((entry) => appendChild(parent, entry, doc));
      return;
    }
    if (isNode(child)) {
      parent.appendChild(child);
      return;
    }
    parent.appendChild(doc.createTextNode(String(child)));
  }

  function applyAttribute(el, name, value) {
    const isAria = name.startsWith("aria-") || name === "role";
    if (value === null || value === undefined) return;
    if (value === false && !isAria) return;

    if (name === "class" || name === "className") {
      const cls = classString(value);
      if (cls) el.setAttribute("class", cls);
      return;
    }
    if (name === "dataset") {
      if (typeof value === "object") {
        Object.keys(value).forEach((key) => {
          if (value[key] !== null && value[key] !== undefined && !FORBIDDEN_KEYS.includes(key)) {
            el.dataset[key] = String(value[key]);
          }
        });
      }
      return;
    }
    if (name === "style") {
      if (typeof value === "string") {
        el.setAttribute("style", value);
      } else if (typeof value === "object") {
        Object.keys(value).forEach((key) => {
          if (value[key] === null || value[key] === undefined) return;
          if (key.startsWith("--") && typeof el.style.setProperty === "function") {
            el.style.setProperty(key, String(value[key]));
          } else {
            el.style[key] = String(value[key]);
          }
        });
      }
      return;
    }
    if (name === "text" || name === "textContent") {
      el.textContent = String(value);
      return;
    }
    if (name === "innerHTML" || name === "outerHTML" || name === "srcdoc" || name === "insertAdjacentHTML") return;
    if (name.length > 2 && name.startsWith("on")) {
      if (typeof value === "function") el.addEventListener(name.slice(2).toLowerCase(), value);
      return;
    }
    if (!ATTRIBUTE_NAME.test(name)) return;
    if (URL_ATTRIBUTES.includes(name) && unsafeUrl(name, value)) return;
    if (value === true && !isAria) {
      el.setAttribute(name, "");
      return;
    }
    el.setAttribute(name, String(value));
  }

  function h(tag, attrs, ...children) {
    const doc = getDocument();
    if (!doc) throw new Error("Ludus.util.h needs a document");
    const isSvg = typeof tag === "string" && tag.startsWith("svg:");
    const name = isSvg ? tag.slice(4) : tag;
    if (typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9-]*$/.test(name)) {
      throw new TypeError(`Ludus.util.h: invalid tag name "${tag}"`);
    }
    let attributes = attrs;
    if (attributes !== null && attributes !== undefined
      && (typeof attributes !== "object" || Array.isArray(attributes) || isNode(attributes))) {
      children.unshift(attributes);
      attributes = null;
    }
    const el = isSvg ? doc.createElementNS(SVG_NS, name) : doc.createElement(name);
    if (attributes) {
      Object.keys(attributes).forEach((key) => applyAttribute(el, key, attributes[key]));
    }
    children.forEach((child) => appendChild(el, child, doc));
    return el;
  }

  // ----- Lazy script loading -----

  const scriptLoads = new Map();

  // Loads a same-origin script once. The version is appended as "?v=" so the
  // service worker and HTTP caches treat a new build as a new file. The
  // promise rejects when the script fails to load (and a later call retries)
  // or when there is no document (Node).
  function loadScript(path) {
    const doc = getDocument();
    if (!doc || typeof doc.createElement !== "function") {
      return Promise.reject(new Error("loadScript: no document"));
    }
    const target = String(path || "");
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//")) {
      return Promise.reject(new Error(`loadScript: only same-origin relative paths are allowed (${target})`));
    }
    if (scriptLoads.has(target)) return scriptLoads.get(target);

    const separator = target.includes("?") ? "&" : "?";
    const promise = new Promise((resolve, reject) => {
      const script = doc.createElement("script");
      script.src = `${target}${separator}v=${encodeURIComponent(version)}`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptLoads.delete(target);
        try {
          if (typeof script.remove === "function") script.remove();
        } catch (error) {
          // Ignore.
        }
        reject(new Error(`loadScript: failed to load ${target}`));
      };
      const parent = doc.head || doc.documentElement || doc.body;
      if (!parent) {
        scriptLoads.delete(target);
        reject(new Error("loadScript: document has no head"));
        return;
      }
      parent.appendChild(script);
    });
    scriptLoads.set(target, promise);
    return promise;
  }

  const util = {
    clamp,
    escapeHtml,
    uid,
    hashString,
    now: () => now(),
    h,
    formatDate,
    formatRelativeDays,
    formatDuration,
    loadScript,
  };

  // ---------- Router ----------

  function createRouter() {
    const screens = new Map();
    const stack = [];
    let currentId = null;
    let currentParams = {};

    function resolveEl(entry) {
      const ref = entry.el;
      if (typeof ref === "string") {
        const doc = getDocument();
        try {
          return doc && typeof doc.getElementById === "function" ? doc.getElementById(ref) : null;
        } catch (error) {
          return null;
        }
      }
      return ref || null;
    }

    function setVisible(entry, visible) {
      const el = resolveEl(entry);
      if (!el) return;
      try {
        if (el.classList && typeof el.classList.toggle === "function") el.classList.toggle("hidden", !visible);
        if (typeof el.setAttribute === "function") el.setAttribute("aria-hidden", visible ? "false" : "true");
      } catch (error) {
        // A misbehaving element must not break navigation.
      }
    }

    function callHook(entry, hook, arg) {
      if (!entry || typeof entry[hook] !== "function") return;
      try {
        entry[hook](arg);
      } catch (error) {
        logError(`[Ludus.router] ${hook} of "${entry.id}" threw`, error);
      }
    }

    function applyTitle(entry) {
      const doc = getDocument();
      if (!doc) return;
      try {
        let title = entry && entry.title;
        if (typeof title === "function") title = title();
        title = title ? i18n.t(String(title)) : "";
        doc.title = title ? `${title} - Ludus Scaccorum` : i18n.t("meta.title");
      } catch (error) {
        // Cosmetic only.
      }
    }

    function register(id, spec) {
      if (typeof id !== "string" || !id) return false;
      const options = spec && typeof spec === "object" ? spec : {};
      screens.set(id, {
        id,
        el: options.el,
        title: options.title,
        onShow: options.onShow,
        onHide: options.onHide,
      });
      return true;
    }

    function activate(id, params, remember) {
      const target = screens.get(id);
      if (!target) return false;
      const prevId = currentId;
      const prev = prevId ? screens.get(prevId) : null;
      const changing = prevId !== id;

      if (changing && prev) callHook(prev, "onHide");
      if (changing && remember && prevId) {
        stack.push({ id: prevId, params: currentParams });
        if (stack.length > ROUTER_HISTORY_LIMIT) stack.shift();
      }

      screens.forEach((entry) => setVisible(entry, entry === target));
      currentId = id;
      currentParams = params === undefined ? {} : params;
      applyTitle(target);
      try {
        if (typeof root.scrollTo === "function") root.scrollTo(0, 0);
      } catch (error) {
        // Not every environment can scroll.
      }
      callHook(target, "onShow", currentParams);
      if (changing) bus.emit("screen:changed", { id, prev: prevId });
      return true;
    }

    // Returns false (and changes nothing) for an id nobody registered.
    function show(id, params) {
      return activate(id, params, true);
    }

    function current() {
      return currentId;
    }

    // Goes to the previous screen and restores the params it was shown with.
    function back() {
      while (stack.length) {
        const previous = stack.pop();
        if (screens.has(previous.id) && activate(previous.id, previous.params, false)) return previous.id;
      }
      return null;
    }

    bus.on("language:changed", () => {
      if (currentId && screens.has(currentId)) applyTitle(screens.get(currentId));
    });

    return { register, show, current, back };
  }

  const router = createRouter();

  const api = { version, config, bus, i18n, storage, router, util };
  // Test hook: builds an isolated core against a fake environment (document,
  // localStorage, navigator, console, LUDUS_CONFIG, LUDUS_TEST_HOOKS).
  api.createCore = createCore;
  return api;
});
