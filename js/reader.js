// Reading time and the history/curiosities carousel. Contract:
// docs/ARCHITECTURE.md section 12.
//
//   Reader.readingTimeMs(text, lang)   clamp(words / 3 * 1000 + 1500, 6000, 24000)
//   Reader.createCarousel(container, { category?, lang?, onlyWhile?, ... }) -> controller
//       controller = { start, stop, next, prev, pause, resume, destroy }
//                    (+ current(), state(), element)
//
// The timing rules live in a small pure scheduler (Reader.createScheduler) so
// they can be unit-tested with a fake clock: a fact is never replaced before its
// reading time has been *counted* (time spent paused does not count), the carousel
// pauses for hover / keyboard focus / touch / hidden tab / the user's pause
// button, and resumes with the remaining time. Screen readers are told about a
// new fact only when the user pressed previous/next (never on the automatic
// rotation). With reduced motion there is no animated ring and no fade-in.
//
// The DOM is built with Ludus.util.h (textContent only, never innerHTML), every
// element carries an "rd-" class (listed in docs/FACTS_SOURCES.md, "Reader
// classes") and no CSS file is needed for the carousel to be usable: the live
// region is hidden with CSSOM styles (no style="" attribute, so a strict
// style-src CSP is fine) and the progress ring has inline SVG attributes.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Reader = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  // ---------- Constants ----------

  const MIN_READ_MS = 6000;
  const MAX_READ_MS = 24000;
  const WORDS_PER_SECOND = 3; // 180 words per minute
  const BASE_MS = 1500; // time to take in the new card before reading
  const TOUCH_RELEASE_MS = 5000; // how long a touch keeps the carousel paused
  const TICK_MS = 100; // progress ring refresh
  const SVG_RING_RADIUS = 9;
  const SVG_RING_LENGTH = 2 * Math.PI * SVG_RING_RADIUS;
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
  // Set through the CSSOM (el.style.x = ...), which a strict style-src CSP allows,
  // unlike a style="..." attribute.
  const VISUALLY_HIDDEN_STYLE = Object.freeze({
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: "-1px",
    padding: "0",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
    border: "0",
  });

  // Letters/digits, keeping internal apostrophes and hyphens inside a word
  // ("don't", "well-known"). Punctuation and symbols do not count.
  const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;

  const STRINGS = {
    es: {
      "reader.region": "Historia y curiosidades del ajedrez",
      "reader.controls": "Controles de los datos",
      "reader.prev": "Dato anterior",
      "reader.next": "Dato siguiente",
      "reader.pause": "Pausar la rotación automática",
      "reader.play": "Reanudar la rotación automática",
      "reader.progress": "Tiempo hasta el próximo dato",
    },
    en: {
      "reader.region": "Chess history and curiosities",
      "reader.controls": "Fact controls",
      "reader.prev": "Previous fact",
      "reader.next": "Next fact",
      "reader.pause": "Pause automatic rotation",
      "reader.play": "Resume automatic rotation",
      "reader.progress": "Time until the next fact",
    },
  };

  function registerStrings() {
    const i18n = root.Ludus && root.Ludus.i18n;
    if (i18n && typeof i18n.register === "function") i18n.register(STRINGS);
  }
  registerStrings();

  const noop = () => {};

  function langKey(lang) {
    return lang === "en" ? "en" : "es";
  }

  function currentLang() {
    const i18n = root.Ludus && root.Ludus.i18n;
    try {
      return i18n && typeof i18n.lang === "function" ? langKey(i18n.lang()) : "es";
    } catch (error) {
      return "es";
    }
  }

  function translate(key, params, lang) {
    const i18n = root.Ludus && root.Ludus.i18n;
    if (i18n && typeof i18n.t === "function") {
      const value = i18n.t(key, params, lang);
      if (value !== key) return value;
    }
    const table = STRINGS[langKey(lang)] || STRINGS.es;
    return table[key] || key;
  }

  // ---------- Reading time ----------

  // Words in a text, Unicode-aware (accents, ñ, digits; punctuation and
  // symbols such as em dashes or "«" do not count).
  function countWords(text) {
    if (text === undefined || text === null) return 0;
    const matches = String(text).match(WORD_PATTERN);
    return matches ? matches.length : 0;
  }

  // Milliseconds a reader needs for `text`: 3 words per second plus 1.5 s to
  // notice the change, never less than 6 s and never more than 24 s. `lang` is
  // accepted for future per-language tuning; Spanish and English share the rate.
  function readingTimeMs(text, lang) {
    void lang;
    const raw = (countWords(text) / WORDS_PER_SECOND) * 1000 + BASE_MS;
    return Math.round(Math.min(MAX_READ_MS, Math.max(MIN_READ_MS, raw)));
  }

  // ---------- Pure helpers ----------

  // Index modulo n, also for negative numbers; 0 when there is nothing to index.
  function wrapIndex(index, count) {
    const n = Math.floor(Number(count));
    if (!(n > 0)) return 0;
    const i = Math.floor(Number(index));
    return ((i % n) + n) % n;
  }

  function randomIndex(length, random) {
    const source = typeof random === "function" ? random : Math.random;
    const value = Number(source());
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(length - 1, Math.floor(value * length)));
  }

  // Fisher-Yates on a copy.
  function shuffle(list, random) {
    const copy = Array.from(list);
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = randomIndex(i + 1, random);
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function defaultTimers() {
    const perf = root.performance;
    const setT = typeof root.setTimeout === "function" ? root.setTimeout.bind(root) : setTimeout;
    const clearT = typeof root.clearTimeout === "function" ? root.clearTimeout.bind(root) : clearTimeout;
    return {
      setTimeout: setT,
      clearTimeout: clearT,
      now: () => (perf && typeof perf.now === "function" ? perf.now() : Date.now()),
    };
  }

  function normalizeTimers(timers) {
    const base = defaultTimers();
    const given = timers && typeof timers === "object" ? timers : {};
    return {
      setTimeout: typeof given.setTimeout === "function" ? given.setTimeout : base.setTimeout,
      clearTimeout: typeof given.clearTimeout === "function" ? given.clearTimeout : base.clearTimeout,
      now: typeof given.now === "function" ? given.now : base.now,
    };
  }

  // ---------- Scheduler (the controller's timing logic, no DOM) ----------

  // One countdown that can be paused for several independent reasons at once
  // ("user", "hover", "focus", "touch", "hidden"...). It fires `onFire` when the
  // duration has been counted down while active and not paused.
  //
  //   start(ms)   become active and count `ms` down (from the full value)
  //   set(ms)     replace the duration and restart the count (keeps the reasons;
  //               it only runs when active and not paused)
  //   stop()      inactive, timer cleared, nothing pending
  //   pause(why)  freeze, remembering what is left
  //   resume(why) drop that reason; when no reason is left, continue with what
  //               was left (not with the full duration)
  //   remainingMs(), progress() (0..1 elapsed), isCounting(), isPaused(),
  //   isActive(), reasons(), durationMs(), destroy()
  function createScheduler(options) {
    const opts = options && typeof options === "object" ? options : {};
    const timers = normalizeTimers(opts);
    const onFire = typeof opts.onFire === "function" ? opts.onFire : noop;
    const pauseReasons = new Set();
    let timer = null;
    let active = false;
    let destroyed = false;
    let duration = 0;
    let remaining = 0;
    let startedAt = 0;

    function clear() {
      if (timer !== null) {
        timers.clearTimeout(timer);
        timer = null;
      }
    }

    function arm() {
      clear();
      startedAt = timers.now();
      timer = timers.setTimeout(fire, Math.max(0, remaining));
    }

    function fire() {
      timer = null;
      if (destroyed || !active) return;
      // A timer that fires a hair early must not cut the reading time short.
      const left = remaining - (timers.now() - startedAt);
      if (left > 0) {
        remaining = left;
        arm();
        return;
      }
      remaining = 0;
      onFire();
    }

    function sanitize(ms) {
      const value = Number(ms);
      return Number.isFinite(value) && value > 0 ? value : 0;
    }

    function set(ms) {
      if (destroyed) return;
      clear();
      duration = sanitize(ms);
      remaining = duration;
      if (active && pauseReasons.size === 0) arm();
    }

    function start(ms) {
      if (destroyed) return;
      active = true;
      set(ms);
    }

    function stop() {
      if (destroyed) return;
      active = false;
      clear();
      remaining = duration;
    }

    function remainingMs() {
      if (timer !== null) return Math.max(0, remaining - (timers.now() - startedAt));
      return remaining;
    }

    function pause(reason) {
      if (destroyed) return;
      const why = reason === undefined ? "user" : String(reason);
      if (pauseReasons.has(why)) return;
      if (timer !== null) {
        remaining = remainingMs();
        clear();
      }
      pauseReasons.add(why);
    }

    function resume(reason) {
      if (destroyed) return;
      const why = reason === undefined ? "user" : String(reason);
      if (!pauseReasons.delete(why)) return;
      if (active && pauseReasons.size === 0 && timer === null) arm();
    }

    function progress() {
      if (!(duration > 0)) return 0;
      return Math.min(1, Math.max(0, 1 - remainingMs() / duration));
    }

    function destroy() {
      if (destroyed) return;
      clear();
      active = false;
      pauseReasons.clear();
      destroyed = true;
    }

    return {
      start,
      set,
      stop,
      pause,
      resume,
      remainingMs,
      progress,
      destroy,
      durationMs: () => duration,
      isActive: () => active,
      isCounting: () => timer !== null,
      isPaused: () => pauseReasons.size > 0,
      hasReason: (reason) => pauseReasons.has(String(reason)),
      reasons: () => Array.from(pauseReasons),
    };
  }

  // ---------- DOM building ----------

  // Ludus.util.h when it works on this document, otherwise a tiny builder with
  // the same shape (string/number children become text nodes, no HTML parsing).
  function pickBuilder(doc) {
    const util = root.Ludus && root.Ludus.util;
    if (util && typeof util.h === "function" && root.document === doc) return util.h;
    const SVG_NS = "http://www.w3.org/2000/svg";
    return function localH(tag, attrs, ...children) {
      let attributes = attrs;
      if (attributes !== null && attributes !== undefined
        && (typeof attributes !== "object" || Array.isArray(attributes) || typeof attributes.nodeType === "number")) {
        children.unshift(attributes);
        attributes = null;
      }
      const isSvg = String(tag).startsWith("svg:");
      const name = isSvg ? String(tag).slice(4) : String(tag);
      if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(name)) throw new TypeError(`Reader: invalid tag name "${tag}"`);
      const el = isSvg ? doc.createElementNS(SVG_NS, name) : doc.createElement(name);
      Object.keys(attributes || {}).forEach((key) => {
        const value = attributes[key];
        if (value === null || value === undefined) return;
        if (key === "dataset" && typeof value === "object") {
          Object.keys(value).forEach((field) => { el.dataset[field] = String(value[field]); });
        } else if (key === "class") {
          el.setAttribute("class", String(value));
        } else if (key === "style" && typeof value === "object") {
          Object.keys(value).forEach((property) => { el.style[property] = String(value[property]); });
        } else if (key.length > 2 && key.startsWith("on") && typeof value === "function") {
          el.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (value !== false || key.startsWith("aria-")) {
          el.setAttribute(key, value === true && !key.startsWith("aria-") ? "" : String(value));
        }
      });
      children.forEach((child) => {
        if (child === null || child === undefined || typeof child === "boolean") return;
        el.appendChild(typeof child === "object" && typeof child.nodeType === "number" ? child : doc.createTextNode(String(child)));
      });
      return el;
    };
  }

  // ---------- Carousel ----------

  function createCarousel(container, options) {
    const opts = options && typeof options === "object" ? options : {};
    if (!container || typeof container.appendChild !== "function") {
      throw new TypeError("Reader.createCarousel needs a container element");
    }
    const doc = opts.document || container.ownerDocument || root.document;
    if (!doc || typeof doc.createElement !== "function") {
      throw new Error("Reader.createCarousel needs a document");
    }
    const Facts = opts.facts || (root.Ludus && root.Ludus.Facts);
    if (!Facts || typeof Facts.byCategory !== "function") {
      throw new Error("Reader.createCarousel needs Ludus.Facts (js/facts.js)");
    }
    registerStrings();
    const win = opts.window || root.window || root;
    let mediaQuery = null;
    try {
      mediaQuery = win && typeof win.matchMedia === "function" ? win.matchMedia(REDUCED_MOTION_QUERY) : null;
    } catch (error) {
      mediaQuery = null;
    }
    const timers = normalizeTimers(opts.timers);
    const h = pickBuilder(doc);
    const fixedLang = opts.lang === "en" || opts.lang === "es" ? opts.lang : null;
    const lang = () => fixedLang || currentLang();

    // The playlist: every fact of the category, shuffled once, walked in a
    // circle by next/prev (so a fact only repeats after all the others).
    const facts = typeof Facts.shuffled === "function"
      ? Facts.shuffled({ category: opts.category, random: opts.random })
      : shuffle(Facts.byCategory(opts.category), opts.random);
    const playlist = facts.length ? facts : shuffle(Facts.byCategory("all"), opts.random);
    let index = 0;
    let started = false;
    let destroyed = false;
    let tickTimer = null;
    let touchTimer = null;
    let motionSetting = null; // "reduce" | "auto" | null (unknown), from Settings
    let reduced = false; // cached by refresh(); see computeReduced()

    const disposers = [];

    // ----- elements -----

    const chip = h("span", { class: "rd-chip" });
    const yearEl = h("span", { class: "rd-year", hidden: true });
    const body = h("p", { class: "rd-text" });
    // The plain space keeps "Cultura 1851" readable even before any stylesheet exists.
    const card = h("div", { class: "rd-card" }, h("div", { class: "rd-meta" }, chip, " ", yearEl), body);

    const prevIcon = h("span", { class: "rd-icon", "aria-hidden": "true" }, "‹");
    const nextIcon = h("span", { class: "rd-icon", "aria-hidden": "true" }, "›");
    const toggleIcon = h("span", { class: "rd-icon", "aria-hidden": "true" }, "❚❚");
    const prevButton = h("button", { type: "button", class: "rd-btn rd-prev" }, prevIcon);
    const nextButton = h("button", { type: "button", class: "rd-btn rd-next" }, nextIcon);
    const toggleButton = h("button", { type: "button", class: "rd-btn rd-toggle" }, toggleIcon);

    const ringTrack = h("svg:circle", {
      class: "rd-ring-track", cx: 12, cy: 12, r: SVG_RING_RADIUS, fill: "none", stroke: "currentColor",
      "stroke-width": 2, "stroke-opacity": "0.25",
    });
    const ringArc = h("svg:circle", {
      class: "rd-ring-arc", cx: 12, cy: 12, r: SVG_RING_RADIUS, fill: "none", stroke: "currentColor",
      "stroke-width": 2, "stroke-linecap": "round", transform: "rotate(-90 12 12)",
      "stroke-dasharray": SVG_RING_LENGTH.toFixed(3), "stroke-dashoffset": SVG_RING_LENGTH.toFixed(3),
    });
    const ring = h("svg:svg", { class: "rd-ring", viewBox: "0 0 24 24", width: 24, height: 24, focusable: "false" }, ringTrack, ringArc);
    const progressEl = h("span", { class: "rd-progress", "aria-hidden": "true" }, ring);

    const controls = h("div", { class: "rd-controls", role: "group" }, prevButton, toggleButton, nextButton, progressEl);
    // Only written to when the user pressed previous/next.
    const live = h("div", { class: "rd-live", "aria-live": "polite", "aria-atomic": "true", style: VISUALLY_HIDDEN_STYLE });
    const rootEl = h("section", { class: "rd-carousel", role: "region", "aria-roledescription": "carousel" }, card, controls, live);

    // ----- helpers -----

    function current() {
      return playlist.length ? playlist[wrapIndex(index, playlist.length)] : null;
    }

    function factText(fact) {
      return fact && fact.text ? fact.text[lang()] || fact.text.es || "" : "";
    }

    function yearLabel(fact) {
      if (!fact || typeof fact.year !== "number") return "";
      if (typeof Facts.formatYear === "function") return Facts.formatYear(fact, lang());
      return `${fact.approx ? "c. " : ""}${fact.year}`;
    }

    function categoryLabel(fact) {
      if (!fact) return "";
      if (typeof Facts.categoryLabel === "function") return Facts.categoryLabel(fact.cat, lang());
      return String(fact.cat);
    }

    function readMs() {
      return readingTimeMs(factText(current()), lang());
    }

    function computeReduced() {
      if (typeof opts.reducedMotion === "function") {
        try {
          return Boolean(opts.reducedMotion());
        } catch (error) {
          return false;
        }
      }
      if (typeof opts.reducedMotion === "boolean") return opts.reducedMotion;
      let setting = motionSetting;
      if (setting === null) {
        try {
          const html = doc.documentElement;
          setting = html && typeof html.getAttribute === "function" ? html.getAttribute("data-motion") : null;
        } catch (error) {
          setting = null;
        }
      }
      if (setting === "reduce") return true;
      return Boolean(mediaQuery && mediaQuery.matches);
    }

    function setBooleanAttribute(el, name, on) {
      if (on) el.setAttribute(name, "");
      else el.removeAttribute(name);
    }

    function userPaused() {
      return sched.hasReason("user");
    }

    // `onlyWhile` is the caller's reason to rotate at all (for example "the
    // engine is still thinking"). A throwing predicate counts as "no".
    function rotationAllowed() {
      if (typeof opts.onlyWhile !== "function") return true;
      try {
        return Boolean(opts.onlyWhile());
      } catch (error) {
        return false;
      }
    }

    // ----- rendering -----

    function relabel() {
      const l = lang();
      rootEl.setAttribute("aria-label", translate("reader.region", null, l));
      controls.setAttribute("aria-label", translate("reader.controls", null, l));
      prevButton.setAttribute("aria-label", translate("reader.prev", null, l));
      nextButton.setAttribute("aria-label", translate("reader.next", null, l));
      const paused = userPaused();
      toggleButton.setAttribute("aria-label", translate(paused ? "reader.play" : "reader.pause", null, l));
      toggleIcon.textContent = paused ? "▶" : "❚❚";
      toggleButton.classList.toggle("rd-toggle--paused", paused);
      progressEl.setAttribute("title", translate("reader.progress", null, l));
    }

    function renderFact(announce) {
      const fact = current();
      if (!fact) {
        chip.textContent = "";
        yearEl.textContent = "";
        setBooleanAttribute(yearEl, "hidden", true);
        body.textContent = "";
        return;
      }
      const label = categoryLabel(fact);
      const year = yearLabel(fact);
      const text = factText(fact);
      chip.setAttribute("class", `rd-chip rd-chip--${fact.cat}`);
      chip.textContent = label;
      yearEl.textContent = year;
      setBooleanAttribute(yearEl, "hidden", !year);
      body.textContent = text;
      rootEl.setAttribute("data-cat", fact.cat);
      rootEl.setAttribute("data-fact", fact.id);
      if (!reduced) {
        // Restart the (optional) fade-in the stylesheet may attach to .rd-enter.
        card.classList.remove("rd-enter");
        void card.offsetWidth;
        card.classList.add("rd-enter");
      }
      if (announce) live.textContent = `${label}. ${year ? `${year}. ` : ""}${text}`;
    }

    function updateProgress() {
      const p = sched.progress();
      try {
        if (rootEl.style && typeof rootEl.style.setProperty === "function") rootEl.style.setProperty("--rd-progress", p.toFixed(3));
      } catch (error) {
        // Cosmetic only.
      }
      ringArc.setAttribute("stroke-dashoffset", (SVG_RING_LENGTH * (1 - p)).toFixed(3));
    }

    function stateName() {
      if (!started) return "idle";
      return sched.isPaused() ? "paused" : "running";
    }

    function clearTick() {
      if (tickTimer !== null) {
        timers.clearTimeout(tickTimer);
        tickTimer = null;
      }
    }

    function tick() {
      tickTimer = null;
      if (destroyed) return;
      updateProgress();
      syncTick();
    }

    // The ring only ticks while time is really being counted and motion is allowed.
    function syncTick() {
      const wanted = !destroyed && started && !reduced && sched.isCounting();
      if (!wanted) {
        clearTick();
        return;
      }
      if (tickTimer === null) tickTimer = timers.setTimeout(tick, TICK_MS);
    }

    // Everything that depends on the timing state, after any change.
    function refresh() {
      if (destroyed) return;
      reduced = computeReduced();
      const state = stateName();
      rootEl.setAttribute("data-state", state);
      rootEl.setAttribute("data-motion", reduced ? "reduce" : "full");
      rootEl.classList.toggle("rd-reduced", reduced);
      rootEl.classList.toggle("rd-is-paused", state === "paused");
      rootEl.classList.toggle("rd-is-running", state === "running");
      setBooleanAttribute(progressEl, "hidden", reduced);
      relabel();
      updateProgress();
      syncTick();
    }

    // ----- navigation -----

    function go(delta, byUser) {
      if (destroyed || !playlist.length) return;
      index = wrapIndex(index + delta, playlist.length);
      renderFact(byUser);
      sched.set(readMs());
      refresh();
      if (typeof opts.onChange === "function") {
        try {
          opts.onChange(current(), { user: Boolean(byUser), index });
        } catch (error) {
          // A listener must not break the rotation.
        }
      }
    }

    function onTimeUp() {
      if (destroyed) return;
      if (!rotationAllowed()) {
        // The reason is gone: keep the current fact and wait for start().
        started = false;
        sched.stop();
        refresh();
        return;
      }
      go(1, false);
    }

    const sched = createScheduler({
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
      now: timers.now,
      onFire: onTimeUp,
    });

    // ----- public controller -----

    function start() {
      if (destroyed || started || !playlist.length || !rotationAllowed()) return;
      started = true;
      sched.start(readMs());
      refresh();
    }

    function stop() {
      if (destroyed) return;
      started = false;
      sched.stop();
      clearTick();
      refresh();
    }

    function pause() {
      if (destroyed) return;
      sched.pause("user");
      refresh();
    }

    function resume() {
      if (destroyed) return;
      sched.resume("user");
      refresh();
    }

    function next() {
      go(1, true);
    }

    function prev() {
      go(-1, true);
    }

    function state() {
      return {
        index: wrapIndex(index, playlist.length),
        count: playlist.length,
        factId: current() ? current().id : null,
        state: stateName(),
        started,
        paused: sched.isPaused(),
        reasons: sched.reasons(),
        remainingMs: Math.round(sched.remainingMs()),
        durationMs: Math.round(sched.durationMs()),
        reduced,
        destroyed,
      };
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      started = false;
      clearTick();
      if (touchTimer !== null) {
        timers.clearTimeout(touchTimer);
        touchTimer = null;
      }
      sched.destroy();
      disposers.splice(0).forEach((dispose) => {
        try {
          dispose();
        } catch (error) {
          // Ignore: the element is going away anyway.
        }
      });
      try {
        if (typeof rootEl.remove === "function") rootEl.remove();
        else if (rootEl.parentNode && typeof rootEl.parentNode.removeChild === "function") rootEl.parentNode.removeChild(rootEl);
      } catch (error) {
        // Ignore.
      }
    }

    // ----- listeners -----

    function listen(target, type, handler, listenerOptions) {
      if (!target || typeof target.addEventListener !== "function") return;
      target.addEventListener(type, handler, listenerOptions);
      disposers.push(() => {
        if (typeof target.removeEventListener === "function") target.removeEventListener(type, handler, listenerOptions);
      });
    }

    function isMouseLike(event) {
      const type = event && event.pointerType;
      return !type || type === "mouse" || type === "pen";
    }

    // A mouse click on a button also focuses it; only keyboard focus should
    // pause the rotation, otherwise clicking "next" would freeze it for good.
    function isKeyboardFocus(target) {
      if (!target || typeof target.matches !== "function") return true;
      try {
        return target.matches(":focus-visible");
      } catch (error) {
        return true;
      }
    }

    function within(node) {
      if (!node) return false;
      if (node === rootEl) return true;
      return typeof rootEl.contains === "function" ? rootEl.contains(node) : false;
    }

    function clearTouchTimer() {
      if (touchTimer !== null) {
        timers.clearTimeout(touchTimer);
        touchTimer = null;
      }
    }

    listen(rootEl, "pointerenter", (event) => {
      if (!isMouseLike(event)) return;
      sched.pause("hover");
      refresh();
    });
    listen(rootEl, "pointerleave", (event) => {
      if (!isMouseLike(event)) return;
      sched.resume("hover");
      refresh();
    });
    listen(rootEl, "touchstart", () => {
      clearTouchTimer();
      sched.pause("touch");
      refresh();
    }, { passive: true });
    const releaseTouch = () => {
      clearTouchTimer();
      // Keep the pause for a few seconds so a reader who tapped is not cut off.
      touchTimer = timers.setTimeout(() => {
        touchTimer = null;
        sched.resume("touch");
        refresh();
      }, TOUCH_RELEASE_MS);
    };
    listen(rootEl, "touchend", releaseTouch);
    listen(rootEl, "touchcancel", releaseTouch);
    listen(rootEl, "focusin", (event) => {
      if (!isKeyboardFocus(event && event.target)) return;
      sched.pause("focus");
      refresh();
    });
    listen(rootEl, "focusout", (event) => {
      if (within(event && event.relatedTarget)) return;
      sched.resume("focus");
      refresh();
    });

    listen(prevButton, "click", prev);
    listen(nextButton, "click", next);
    listen(toggleButton, "click", () => (userPaused() ? resume() : pause()));

    function syncVisibility() {
      const hidden = Boolean(doc.hidden) || doc.visibilityState === "hidden";
      if (hidden) sched.pause("hidden");
      else sched.resume("hidden");
      refresh();
    }
    listen(doc, "visibilitychange", syncVisibility);

    // Reduced motion may change while the carousel is on screen (OS setting).
    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === "function") listen(mediaQuery, "change", refresh);
      else if (typeof mediaQuery.addListener === "function") {
        mediaQuery.addListener(refresh);
        disposers.push(() => mediaQuery.removeListener(refresh));
      }
    }

    const L = root.Ludus || {};
    if (L.bus && typeof L.bus.on === "function") {
      const offSettings = L.bus.on("settings:changed", (payload) => {
        if (payload && payload.path === "a11y.motion") {
          motionSetting = payload.value === "reduce" ? "reduce" : "auto";
          refresh();
        }
      });
      if (typeof offSettings === "function") disposers.push(offSettings);
    }
    if (!fixedLang && L.i18n && typeof L.i18n.onChange === "function") {
      const offLang = L.i18n.onChange(() => {
        if (destroyed) return;
        renderFact(false); // the timer keeps its remaining time
        relabel();
      });
      if (typeof offLang === "function") disposers.push(offLang);
    }

    // ----- mount -----

    container.appendChild(rootEl);
    reduced = computeReduced();
    renderFact(false);
    syncVisibility();

    return { start, stop, next, prev, pause, resume, destroy, current, state, element: rootEl };
  }

  return {
    readingTimeMs,
    countWords,
    createCarousel,
    createScheduler,
    wrapIndex,
    shuffle,
    // The DOM-free pieces the controller is made of, grouped for unit tests.
    controllerLogic: Object.freeze({ createScheduler, wrapIndex, shuffle, countWords, readingTimeMs }),
    LIMITS: Object.freeze({
      minMs: MIN_READ_MS,
      maxMs: MAX_READ_MS,
      wordsPerSecond: WORDS_PER_SECOND,
      baseMs: BASE_MS,
      touchReleaseMs: TOUCH_RELEASE_MS,
      tickMs: TICK_MS,
    }),
  };
});
