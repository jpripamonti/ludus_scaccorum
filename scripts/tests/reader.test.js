// Unit tests for js/reader.js: the reading-time formula, the pure scheduler
// that drives the carousel, and the carousel itself (DOM, timing, pausing,
// wraparound, announcements, reduced motion, language, destroy).
//
// Everything runs in Node with a fake clock (nothing waits in real time) and a
// tiny fake DOM defined below. The carousel suite runs twice: once building the
// DOM through Ludus.util.h (a document is installed as the global, like in the
// browser) and once through the reader's own fallback builder.

"use strict";

const assert = require("assert");
const path = require("path");

const jsDir = path.resolve(__dirname, "..", "..", "js");
require(path.join(jsDir, "ludus.js"));
const Facts = require(path.join(jsDir, "facts.js"));
const Reader = require(path.join(jsDir, "reader.js"));
const Ludus = globalThis.Ludus;

// ---------- Fake clock ----------

function createClock() {
  let now = 0;
  let seq = 0;
  const timers = new Map();
  return {
    now: () => now,
    setTimeout(fn, ms) {
      seq += 1;
      timers.set(seq, { id: seq, at: now + Math.max(0, Number(ms) || 0), fn });
      return seq;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let next = null;
        timers.forEach((timer) => {
          if (timer.at <= target && (!next || timer.at < next.at || (timer.at === next.at && timer.id < next.id))) next = timer;
        });
        if (!next) break;
        timers.delete(next.id);
        now = Math.max(now, next.at);
        next.fn();
      }
      now = target;
    },
    pending: () => timers.size,
  };
}

// ---------- Fake DOM (just what the carousel touches) ----------

function withEvents(target) {
  target.listeners = new Map();
  target.addEventListener = function addEventListener(type, handler) {
    if (typeof handler !== "function") return;
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  };
  target.removeEventListener = function removeEventListener(type, handler) {
    const list = this.listeners.get(type);
    if (list) this.listeners.set(type, list.filter((entry) => entry !== handler));
  };
  target.dispatch = function dispatch(type, event) {
    (this.listeners.get(type) || []).slice().forEach((handler) => handler.call(this, Object.assign({ type, target: this }, event)));
  };
  target.listenerCount = function listenerCount() {
    let total = 0;
    this.listeners.forEach((list) => { total += list.length; });
    return total;
  };
}

class FakeText {
  constructor(data) {
    this.nodeType = 3;
    this.data = String(data);
    this.parentNode = null;
  }

  get textContent() {
    return this.data;
  }
}

class FakeElement {
  constructor(tagName, namespaceURI) {
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.namespaceURI = namespaceURI || null;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.dataset = {};
    this.style = { props: {}, setProperty(name, value) { this.props[name] = String(value); } };
    this.offsetWidth = 0;
    this._text = "";
    this._classes = new Set();
    const self = this;
    this.classList = {
      add(...names) { names.forEach((name) => self._classes.add(name)); },
      remove(...names) { names.forEach((name) => self._classes.delete(name)); },
      toggle(name, force) {
        const on = force === undefined ? !self._classes.has(name) : Boolean(force);
        if (on) self._classes.add(name);
        else self._classes.delete(name);
        return on;
      },
      contains(name) { return self._classes.has(name); },
    };
    withEvents(this);
  }

  get textContent() {
    return this._text + this.children.map((child) => child.textContent).join("");
  }

  set textContent(value) {
    this.children.forEach((child) => { child.parentNode = null; });
    this.children = [];
    this._text = String(value);
  }

  // The carousel must build DOM nodes, never parse HTML.
  set innerHTML(_value) { throw new Error("innerHTML must not be used"); }

  get innerHTML() { return ""; }

  set outerHTML(_value) { throw new Error("outerHTML must not be used"); }

  setAttribute(name, value) {
    if (name === "class") this._classes = new Set(String(value).split(/\s+/).filter(Boolean));
    else this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    if (name === "class") return this._classes.size ? Array.from(this._classes).join(" ") : null;
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return name === "class" ? this._classes.size > 0 : this.attributes.has(name);
  }

  removeAttribute(name) {
    if (name === "class") this._classes = new Set();
    else this.attributes.delete(name);
  }

  appendChild(child) {
    if (child.parentNode && child.parentNode !== this) child.parentNode.removeChild(child);
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  contains(node) {
    if (node === this) return true;
    return this.children.some((child) => typeof child.contains === "function" && child.contains(node));
  }
}

class FakeDocument {
  constructor() {
    this.hidden = false;
    this.visibilityState = "visible";
    this.documentElement = new FakeElement("html");
    withEvents(this);
  }

  createElement(tag) { return new FakeElement(tag); }

  createElementNS(ns, tag) { return new FakeElement(tag, ns); }

  createTextNode(text) { return new FakeText(text); }
}

function walk(node, fn) {
  fn(node);
  (node.children || []).forEach((child) => walk(child, fn));
}

function findAll(rootNode, predicate) {
  const found = [];
  walk(rootNode, (node) => { if (node.nodeType === 1 && predicate(node)) found.push(node); });
  return found;
}

function byClass(rootNode, cls) {
  return findAll(rootNode, (node) => node._classes.has(cls))[0] || null;
}

function totalListeners(rootNode) {
  let total = 0;
  walk(rootNode, (node) => { if (node.nodeType === 1) total += node.listenerCount(); });
  return total;
}

// Counts live subscriptions to the bus and to i18n language changes.
function instrumentSubscriptions() {
  const realBusOn = Ludus.bus.on;
  const realOnChange = Ludus.i18n.onChange;
  const counts = { bus: 0, lang: 0 };
  // i18n.onChange subscribes to the bus internally, so only count the
  // "settings:changed" subscriptions as the reader's own bus subscriptions.
  function wrap(real, self, key, only) {
    return function subscribe(...args) {
      const counted = !only || args[0] === only;
      if (counted) counts[key] += 1;
      const off = real.apply(self, args);
      let released = false;
      return function unsubscribe() {
        if (counted && !released) {
          released = true;
          counts[key] -= 1;
        }
        return off();
      };
    };
  }
  Ludus.bus.on = wrap(realBusOn, Ludus.bus, "bus", "settings:changed");
  Ludus.i18n.onChange = wrap(realOnChange, Ludus.i18n, "lang");
  return {
    counts,
    restore() {
      Ludus.bus.on = realBusOn;
      Ludus.i18n.onChange = realOnChange;
    },
  };
}

// ---------- Reading time ----------

assert.strictEqual(globalThis.Ludus.Reader, Reader, "js/reader.js registers itself as Ludus.Reader");
["readingTimeMs", "countWords", "createCarousel", "createScheduler", "wrapIndex", "shuffle"].forEach((name) => {
  assert.strictEqual(typeof Reader[name], "function", `Reader.${name}`);
});
assert.deepStrictEqual(Object.keys(Reader.controllerLogic).sort(), ["countWords", "createScheduler", "readingTimeMs", "shuffle", "wrapIndex"], "the pure controller helpers are grouped");
assert.strictEqual(Reader.controllerLogic.createScheduler, Reader.createScheduler);
assert.ok(Object.isFrozen(Reader.controllerLogic) && Object.isFrozen(Reader.LIMITS));
// The UI strings exist in both languages ("reader." keys).
["region", "controls", "prev", "next", "pause", "play", "progress"].forEach((name) => {
  ["es", "en"].forEach((lang) => {
    const value = Ludus.i18n.t(`reader.${name}`, null, lang);
    assert.ok(value !== `reader.${name}` && value.length > 3, `reader.${name} is registered in ${lang}`);
  });
  assert.notStrictEqual(Ludus.i18n.t(`reader.${name}`, null, "es"), Ludus.i18n.t(`reader.${name}`, null, "en"), `reader.${name} differs between languages`);
});
assert.deepStrictEqual({ ...Reader.LIMITS }, { minMs: 6000, maxMs: 24000, wordsPerSecond: 3, baseMs: 1500, touchReleaseMs: 5000, tickMs: 100 });

const words = (n) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(" ");
// [words, expected ms]: clamp(words / 3 * 1000 + 1500, 6000, 24000), rounded.
const TABLE = [
  [0, 6000], [1, 6000], [5, 6000], [10, 6000], [13, 6000], [14, 6167], [15, 6500], [20, 8167], [30, 11500], [45, 16500],
  [60, 21500], [67, 23833], [68, 24000], [69, 24000], [100, 24000], [500, 24000],
];
TABLE.forEach(([count, expected]) => {
  assert.strictEqual(Reader.readingTimeMs(words(count), "es"), expected, `${count} words -> ${expected} ms`);
  assert.strictEqual(Reader.readingTimeMs(words(count), "en"), expected, `${count} words -> ${expected} ms (en)`);
});
assert.strictEqual(Reader.readingTimeMs(undefined), 6000);
assert.strictEqual(Reader.readingTimeMs(null, "es"), 6000);
assert.strictEqual(Reader.readingTimeMs("", "en"), 6000);
assert.strictEqual(Reader.readingTimeMs(12345, "es"), 6000, "non-strings are stringified");
// Unicode-aware counting.
assert.strictEqual(Reader.countWords("canción"), 1, "accents stay inside a word");
assert.strictEqual(Reader.countWords("Ñandú año"), 2);
assert.strictEqual(Reader.countWords("¿Sabías qué…?"), 2, "punctuation is not a word");
assert.strictEqual(Reader.countWords("años—dijo"), 2, "an em dash separates words");
assert.strictEqual(Reader.countWords("«ajedrez» (1851)"), 2, "quotes and brackets do not count, digits do");
assert.strictEqual(Reader.countWords("don't stop, don’t"), 3, "internal apostrophes keep a word whole");
assert.strictEqual(Reader.countWords("well-known"), 1);
assert.strictEqual(Reader.countWords("10^120"), 2);
assert.strictEqual(Reader.countWords("a b\tc\nd"), 4, "any whitespace separates words");
assert.strictEqual(Reader.countWords("   "), 0);
assert.strictEqual(Reader.countWords("Кириллица и 漢字"), 3, "any script counts");

// Every fact of the corpus fits: never clamped at the maximum, never below the minimum.
{
  let longest = 0;
  Facts.all().concat(Facts.timeline()).forEach((entry) => {
    ["es", "en"].forEach((lang) => {
      const ms = Reader.readingTimeMs(entry.text[lang], lang);
      assert.ok(ms >= 6000 && ms < 24000, `${entry.id} ${lang}: ${ms} ms is inside the clamp`);
      longest = Math.max(longest, ms);
    });
  });
  assert.ok(longest <= 20000, `the longest fact takes ${longest} ms to read`);
}

// ---------- wrapIndex / shuffle ----------

assert.strictEqual(Reader.wrapIndex(0, 5), 0);
assert.strictEqual(Reader.wrapIndex(5, 5), 0);
assert.strictEqual(Reader.wrapIndex(7, 5), 2);
assert.strictEqual(Reader.wrapIndex(-1, 5), 4);
assert.strictEqual(Reader.wrapIndex(-6, 5), 4);
assert.strictEqual(Reader.wrapIndex(3, 0), 0);
assert.strictEqual(Reader.wrapIndex(3, NaN), 0);
assert.strictEqual(Reader.wrapIndex(-1, 1), 0);
{
  const input = [1, 2, 3, 4, 5, 6];
  const out = Reader.shuffle(input, () => 0);
  assert.notStrictEqual(out, input, "shuffle returns a copy");
  assert.deepStrictEqual(input, [1, 2, 3, 4, 5, 6], "the input is untouched");
  assert.deepStrictEqual(out.slice().sort(), input, "it is a permutation");
  assert.deepStrictEqual(Reader.shuffle([], Math.random), []);
  assert.deepStrictEqual(Reader.shuffle([7], Math.random), [7]);
}

// ---------- Scheduler (pure timing logic) ----------

{
  const clock = createClock();
  let fired = 0;
  const sched = Reader.createScheduler({ ...clock, onFire: () => { fired += 1; } });
  assert.strictEqual(sched.isActive(), false);
  assert.strictEqual(clock.pending(), 0, "nothing is scheduled by creating it");

  // Fires exactly when the duration has been counted, not a millisecond earlier.
  sched.start(1000);
  assert.strictEqual(sched.isCounting(), true);
  clock.advance(999);
  assert.strictEqual(fired, 0, "999 ms is too early");
  assert.strictEqual(sched.remainingMs(), 1);
  assert.strictEqual(Math.round(sched.progress() * 1000), 999);
  clock.advance(1);
  assert.strictEqual(fired, 1, "fires at exactly 1000 ms");
  assert.strictEqual(sched.isCounting(), false, "nothing keeps ticking after it fired");
  clock.advance(10000);
  assert.strictEqual(fired, 1, "it fires once per set/start");

  // Pause and resume keep the remaining time.
  sched.set(1000);
  clock.advance(400);
  sched.pause("hover");
  assert.strictEqual(sched.remainingMs(), 600);
  assert.strictEqual(clock.pending(), 0, "no timer while paused");
  clock.advance(100000);
  assert.strictEqual(fired, 1, "paused time does not count");
  assert.strictEqual(sched.remainingMs(), 600);
  assert.strictEqual(sched.progress(), 0.4);
  sched.resume("hover");
  clock.advance(599);
  assert.strictEqual(fired, 1);
  clock.advance(1);
  assert.strictEqual(fired, 2, "resumes with the remaining 600 ms, not the full 1000");

  // Independent reasons: every one must be released.
  sched.set(1000);
  sched.pause("hover");
  sched.pause("focus");
  sched.pause("hover"); // idempotent
  assert.deepStrictEqual(sched.reasons().sort(), ["focus", "hover"]);
  assert.strictEqual(sched.isPaused(), true);
  sched.resume("hover");
  assert.strictEqual(sched.isCounting(), false, "still paused for focus");
  sched.resume("hover"); // releasing something that is not held is harmless
  sched.resume("focus");
  assert.strictEqual(sched.isCounting(), true);
  assert.strictEqual(sched.remainingMs(), 1000);
  clock.advance(1000);
  assert.strictEqual(fired, 3);

  // pause() with no argument is the "user" reason.
  sched.set(500);
  sched.pause();
  assert.strictEqual(sched.hasReason("user"), true);
  sched.resume();
  assert.strictEqual(sched.isPaused(), false);

  // set() while paused resets the time but stays paused.
  sched.set(2000);
  clock.advance(500);
  sched.pause("touch");
  sched.set(3000);
  assert.strictEqual(sched.remainingMs(), 3000);
  assert.strictEqual(sched.isCounting(), false);
  sched.resume("touch");
  assert.strictEqual(sched.isCounting(), true);
  clock.advance(3000);
  assert.strictEqual(fired, 4);

  // stop() clears everything; resume/set while inactive do not arm.
  sched.set(1000);
  sched.stop();
  assert.strictEqual(sched.isActive(), false);
  assert.strictEqual(clock.pending(), 0);
  sched.set(1000);
  sched.pause("x");
  sched.resume("x");
  assert.strictEqual(clock.pending(), 0, "inactive schedulers never arm a timer");
  clock.advance(5000);
  assert.strictEqual(fired, 4);
  sched.start(700);
  clock.advance(700);
  assert.strictEqual(fired, 5, "start() after stop() runs again");

  // Invalid durations count as 0 (fire on the next tick) instead of NaN timers.
  sched.start("abc");
  assert.strictEqual(sched.durationMs(), 0);
  assert.strictEqual(sched.progress(), 0);
  clock.advance(0);
  assert.strictEqual(fired, 6);
  sched.start(-50);
  assert.strictEqual(sched.durationMs(), 0);
  sched.stop();

  // destroy(): nothing pending, everything else becomes a no-op.
  sched.start(1000);
  sched.pause("hover");
  sched.resume("hover");
  sched.destroy();
  assert.strictEqual(clock.pending(), 0);
  sched.start(1000);
  sched.set(1000);
  sched.pause("a");
  clock.advance(10000);
  assert.strictEqual(fired, 6, "a destroyed scheduler never fires");
  assert.strictEqual(sched.isActive(), false);
  assert.strictEqual(sched.isPaused(), false);
  sched.destroy(); // twice is fine
}

// A timer that fires a little early must not cut the reading time short.
{
  const clock = createClock();
  let fired = 0;
  let skew = 5;
  const sched = Reader.createScheduler({
    now: clock.now,
    clearTimeout: clock.clearTimeout,
    setTimeout: (fn, ms) => {
      const early = skew;
      skew = 0;
      return clock.setTimeout(fn, ms - early);
    },
    onFire: () => { fired += 1; },
  });
  sched.start(1000);
  clock.advance(995);
  assert.strictEqual(fired, 0, "the early timer re-arms instead of firing");
  clock.advance(4);
  assert.strictEqual(fired, 0);
  clock.advance(1);
  assert.strictEqual(fired, 1, "fires once the full 1000 ms were counted");
}

// The scheduler works with the real timers too (defaults), without leaving any behind.
{
  const sched = Reader.createScheduler({ onFire: () => assert.fail("must not fire") });
  sched.start(60000);
  assert.strictEqual(sched.isCounting(), true);
  sched.destroy();
}

// ---------- Carousel ----------

const CATEGORY_LABEL = (cat, lang) => Facts.categoryLabel(cat, lang);

function makeEnv(mode, extra, setup) {
  const clock = createClock();
  const doc = new FakeDocument();
  if (setup) setup(doc);
  const container = new FakeElement("div");
  container.ownerDocument = doc;
  const options = Object.assign({ document: doc, timers: clock, random: () => 0, reducedMotion: false, lang: "es" }, extra);
  let carousel;
  if (mode === "util") {
    globalThis.document = doc; // Ludus.util.h builds on the global document
    try {
      carousel = Reader.createCarousel(container, options);
    } finally {
      delete globalThis.document;
    }
  } else {
    carousel = Reader.createCarousel(container, options);
  }
  const el = carousel.element;
  return {
    clock,
    doc,
    container,
    carousel,
    el,
    prev: byClass(el, "rd-prev"),
    next: byClass(el, "rd-next"),
    toggle: byClass(el, "rd-toggle"),
    live: byClass(el, "rd-live"),
    card: byClass(el, "rd-card"),
    text: byClass(el, "rd-text"),
    chip: byClass(el, "rd-chip"),
    year: byClass(el, "rd-year"),
    progress: byClass(el, "rd-progress"),
    arc: byClass(el, "rd-ring-arc"),
  };
}

const ORDER = Facts.shuffled({ random: () => 0 }); // the playlist makeEnv() produces
const TIMES = ORDER.map((fact) => Reader.readingTimeMs(fact.text.es, "es"));
const TOTAL = TIMES.reduce((sum, ms) => sum + ms, 0);

function announcementFor(fact, lang) {
  const label = CATEGORY_LABEL(fact.cat, lang);
  const year = Facts.formatYear(fact, lang);
  return `${label}. ${year ? `${year}. ` : ""}${fact.text[lang]}`;
}

function runCarouselSuite(mode) {
  const tag = `[${mode}]`;

  // --- structure and rendering ---
  {
    const env = makeEnv(mode);
    const { el, carousel } = env;
    assert.strictEqual(env.container.children[0], el, `${tag} the carousel is mounted in the container`);
    assert.strictEqual(el.tagName, "SECTION");
    assert.strictEqual(el.getAttribute("role"), "region");
    assert.strictEqual(el.getAttribute("aria-roledescription"), "carousel");
    assert.strictEqual(el.getAttribute("aria-label"), "Historia y curiosidades del ajedrez");
    ["rd-carousel", "rd-card", "rd-chip", "rd-year", "rd-text", "rd-controls", "rd-btn", "rd-prev", "rd-next", "rd-toggle",
      "rd-progress", "rd-ring", "rd-ring-track", "rd-ring-arc", "rd-live", "rd-icon", "rd-meta"].forEach((cls) => {
      assert.ok(byClass(el, cls) || el._classes.has(cls), `${tag} has an element with class ${cls}`);
    });
    // Every element is prefixed; no stray unprefixed classes.
    walk(el, (node) => {
      if (node.nodeType !== 1) return;
      node._classes.forEach((cls) => assert.ok(cls.startsWith("rd-"), `${tag} class ${cls} is rd- prefixed`));
    });
    // Buttons: real buttons, labelled, not submit buttons.
    [[env.prev, "Dato anterior"], [env.next, "Dato siguiente"], [env.toggle, "Pausar la rotación automática"]].forEach(([button, label]) => {
      assert.strictEqual(button.tagName, "BUTTON");
      assert.strictEqual(button.getAttribute("type"), "button", `${tag} buttons never submit forms`);
      assert.strictEqual(button.getAttribute("aria-label"), label);
    });
    assert.strictEqual(byClass(el, "rd-controls").getAttribute("role"), "group");
    assert.strictEqual(env.progress.getAttribute("aria-hidden"), "true", `${tag} the ring is decorative`);
    // The live region: polite, atomic, hidden by an inline style, empty until the user acts.
    assert.strictEqual(env.live.getAttribute("aria-live"), "polite");
    assert.strictEqual(env.live.getAttribute("aria-atomic"), "true");
    assert.strictEqual(env.live.style.clip, "rect(0 0 0 0)", `${tag} the live region is visually hidden without a stylesheet`);
    assert.strictEqual(env.live.style.position, "absolute");
    assert.strictEqual(env.live.style.width, "1px");
    assert.strictEqual(env.live.style.height, "1px");
    assert.strictEqual(env.live.style.overflow, "hidden");
    assert.strictEqual(env.live.getAttribute("style"), null, `${tag} no style="..." attribute: it works under a strict style-src CSP`);
    assert.strictEqual(env.live.textContent, "");
    // Only the live region is live.
    assert.deepStrictEqual(findAll(el, (node) => node.hasAttribute("aria-live")), [env.live]);
    assert.deepStrictEqual(findAll(el, (node) => node.hasAttribute("role") && /alert|status|log/.test(node.getAttribute("role"))), []);
    // The ring is an SVG with a track and an arc.
    assert.strictEqual(byClass(el, "rd-ring").namespaceURI, "http://www.w3.org/2000/svg", `${tag} the ring is a real SVG`);
    assert.strictEqual(env.arc.namespaceURI, "http://www.w3.org/2000/svg");
    assert.ok(Number(env.arc.getAttribute("stroke-dasharray")) > 50);

    // The first fact is visible before start().
    assert.strictEqual(carousel.state().state, "idle");
    assert.strictEqual(carousel.current(), ORDER[0]);
    assert.strictEqual(env.text.textContent, ORDER[0].text.es);
    assert.strictEqual(env.clock.pending(), 0, `${tag} nothing is scheduled before start()`);
    assert.strictEqual(el.getAttribute("data-state"), "idle");
    carousel.destroy();
  }

  // --- every fact renders correctly (chip, year, text, ids) ---
  {
    const env = makeEnv(mode);
    for (let i = 0; i < ORDER.length; i += 1) {
      const fact = ORDER[i];
      assert.strictEqual(env.carousel.state().factId, fact.id);
      assert.strictEqual(env.text.textContent, fact.text.es, `${tag} fact ${fact.id}: text`);
      assert.strictEqual(env.chip.textContent, CATEGORY_LABEL(fact.cat, "es"));
      assert.strictEqual(env.chip.getAttribute("class"), `rd-chip rd-chip--${fact.cat}`);
      const hasYear = typeof fact.year === "number";
      assert.strictEqual(env.year.hasAttribute("hidden"), !hasYear, `${tag} fact ${fact.id}: year hidden only when there is no year`);
      assert.strictEqual(env.year.textContent, hasYear ? Facts.formatYear(fact, "es") : "");
      assert.strictEqual(env.el.getAttribute("data-cat"), fact.cat);
      assert.strictEqual(env.el.getAttribute("data-fact"), fact.id);
      env.carousel.next();
    }
    assert.strictEqual(env.carousel.state().index, 0, `${tag} a full lap of next() is back at the start`);
    env.carousel.destroy();
  }

  // --- never advances early; advances exactly on time; wraps ---
  {
    const env = makeEnv(mode);
    const { clock, carousel } = env;
    carousel.start();
    assert.strictEqual(carousel.state().state, "running");
    assert.strictEqual(carousel.state().durationMs, TIMES[0]);
    clock.advance(TIMES[0] - 1);
    assert.strictEqual(carousel.state().index, 0, `${tag} still on fact 0 one ms before its reading time`);
    assert.strictEqual(env.text.textContent, ORDER[0].text.es);
    clock.advance(1);
    assert.strictEqual(carousel.state().index, 1, `${tag} moves on at exactly the reading time`);
    assert.strictEqual(env.text.textContent, ORDER[1].text.es);
    assert.strictEqual(carousel.state().durationMs, TIMES[1], `${tag} the next fact gets its own reading time`);
    clock.advance(TIMES[1] - 1);
    assert.strictEqual(carousel.state().index, 1);
    clock.advance(1);
    assert.strictEqual(carousel.state().index, 2);
    // A whole lap, exactly: back to fact 2 + (TOTAL - TIMES[0] - TIMES[1]) ms later the carousel wraps to 0.
    clock.advance(TOTAL - TIMES[0] - TIMES[1] - 1);
    assert.strictEqual(carousel.state().index, ORDER.length - 1, `${tag} on the last fact just before the wrap`);
    clock.advance(1);
    assert.strictEqual(carousel.state().index, 0, `${tag} the auto-advance wraps around`);
    // A lot of time: still consistent (index equals the number of elapsed reading times modulo N).
    carousel.stop();
    carousel.destroy();
  }

  // --- progress ring and CSS variable follow the counted time ---
  {
    const env = makeEnv(mode);
    const { clock, carousel } = env;
    const length = Number(env.arc.getAttribute("stroke-dasharray"));
    assert.ok(Math.abs(Number(env.arc.getAttribute("stroke-dashoffset")) - length) < 0.01, `${tag} the ring starts empty`);
    carousel.start();
    assert.strictEqual(clock.pending(), 2, `${tag} one reading timer and one ring tick`);
    clock.advance(TIMES[0] / 2);
    const half = Number(env.el.style.props["--rd-progress"]);
    assert.ok(Math.abs(half - 0.5) < 0.03, `${tag} --rd-progress is about 0.5 halfway (${half})`);
    const offset = Number(env.arc.getAttribute("stroke-dashoffset"));
    assert.ok(Math.abs(offset - length * (1 - half)) < 0.05, `${tag} the arc follows the variable`);
    assert.ok(offset < length && offset > 0);
    // Hovering freezes the ring and stops ticking.
    env.el.dispatch("pointerenter", { pointerType: "mouse" });
    const frozen = env.el.style.props["--rd-progress"];
    assert.strictEqual(clock.pending(), 0, `${tag} paused: no reading timer and no ring tick`);
    clock.advance(30000);
    assert.strictEqual(env.el.style.props["--rd-progress"], frozen);
    env.el.dispatch("pointerleave", { pointerType: "mouse" });
    assert.strictEqual(clock.pending(), 2);
    carousel.destroy();
  }

  // --- pause and resume with the remaining time ---
  {
    const env = makeEnv(mode);
    const { clock, carousel, el } = env;
    carousel.start();
    clock.advance(4000);
    el.dispatch("pointerenter", { pointerType: "mouse" });
    assert.deepStrictEqual(carousel.state().reasons, ["hover"]);
    assert.strictEqual(carousel.state().state, "paused");
    assert.strictEqual(carousel.state().remainingMs, TIMES[0] - 4000);
    assert.strictEqual(el.getAttribute("data-state"), "paused");
    assert.ok(el._classes.has("rd-is-paused") && !el._classes.has("rd-is-running"));
    clock.advance(600000);
    assert.strictEqual(carousel.state().index, 0, `${tag} never advances while hovered`);
    el.dispatch("pointerleave", { pointerType: "mouse" });
    assert.strictEqual(carousel.state().state, "running");
    assert.ok(el._classes.has("rd-is-running") && !el._classes.has("rd-is-paused"));
    clock.advance(TIMES[0] - 4000 - 1);
    assert.strictEqual(carousel.state().index, 0, `${tag} resumes with the remaining time (not the full time)`);
    clock.advance(1);
    assert.strictEqual(carousel.state().index, 1);
    // Pausing twice at different moments accumulates correctly.
    clock.advance(1000);
    el.dispatch("pointerenter", { pointerType: "pen" });
    clock.advance(9999);
    el.dispatch("pointerleave", { pointerType: "pen" });
    clock.advance(2000);
    el.dispatch("pointerenter", {});
    clock.advance(1);
    el.dispatch("pointerleave", {});
    assert.strictEqual(carousel.state().remainingMs, TIMES[1] - 3000, `${tag} 1000 + 2000 ms were counted, the pauses were not`);
    carousel.destroy();
  }

  // --- hover from touch pointers is ignored (sticky hover on phones) ---
  {
    const env = makeEnv(mode);
    env.carousel.start();
    env.el.dispatch("pointerenter", { pointerType: "touch" });
    assert.deepStrictEqual(env.carousel.state().reasons, [], `${tag} a touch pointer is not a hover`);
    env.el.dispatch("pointerleave", { pointerType: "touch" });
    env.clock.advance(TIMES[0]);
    assert.strictEqual(env.carousel.state().index, 1);
    env.carousel.destroy();
  }

  // --- keyboard focus pauses; mouse focus does not; moving focus inside keeps the pause ---
  {
    const env = makeEnv(mode);
    const { clock, carousel, el } = env;
    carousel.start();
    clock.advance(1000);
    el.dispatch("focusin", { target: { matches: () => false } }); // a mouse click focusing a button
    assert.deepStrictEqual(carousel.state().reasons, [], `${tag} mouse focus does not freeze the carousel`);
    el.dispatch("focusin", { target: env.next }); // no matches(): treated as keyboard focus
    assert.deepStrictEqual(carousel.state().reasons, ["focus"]);
    clock.advance(100000);
    assert.strictEqual(carousel.state().index, 0, `${tag} never advances while keyboard focus is inside`);
    el.dispatch("focusout", { target: env.next, relatedTarget: env.prev }); // moved inside
    assert.deepStrictEqual(carousel.state().reasons, ["focus"], `${tag} focus moving between the controls keeps the pause`);
    el.dispatch("focusin", { target: { matches: (selector) => selector === ":focus-visible" } });
    el.dispatch("focusout", { target: env.prev, relatedTarget: null }); // left the widget
    assert.deepStrictEqual(carousel.state().reasons, []);
    clock.advance(TIMES[0] - 1000 - 1);
    assert.strictEqual(carousel.state().index, 0);
    clock.advance(1);
    assert.strictEqual(carousel.state().index, 1);
    // relatedTarget outside the widget also releases the pause.
    el.dispatch("focusin", { target: env.prev });
    el.dispatch("focusout", { target: env.prev, relatedTarget: new FakeElement("a") });
    assert.deepStrictEqual(carousel.state().reasons, []);
    // A browser without :focus-visible support throws: treat it as keyboard focus.
    el.dispatch("focusin", { target: { matches: () => { throw new SyntaxError("unsupported selector"); } } });
    assert.deepStrictEqual(carousel.state().reasons, ["focus"]);
    carousel.destroy();
  }

  // --- touch pauses and keeps the pause 5 s after the finger lifts ---
  {
    const env = makeEnv(mode);
    const { clock, carousel, el } = env;
    carousel.start();
    clock.advance(2000);
    el.dispatch("touchstart", {});
    assert.deepStrictEqual(carousel.state().reasons, ["touch"]);
    clock.advance(60000);
    assert.strictEqual(carousel.state().index, 0, `${tag} never advances while a finger is down`);
    el.dispatch("touchend", {});
    clock.advance(4999);
    assert.deepStrictEqual(carousel.state().reasons, ["touch"], `${tag} still paused just before the grace period ends`);
    clock.advance(1);
    assert.deepStrictEqual(carousel.state().reasons, [], `${tag} released after 5 s`);
    assert.strictEqual(carousel.state().remainingMs, TIMES[0] - 2000);
    // A new touch during the grace period cancels the pending release.
    el.dispatch("touchstart", {});
    el.dispatch("touchend", {});
    clock.advance(3000);
    el.dispatch("touchstart", {});
    clock.advance(20000);
    assert.deepStrictEqual(carousel.state().reasons, ["touch"], `${tag} the old release timer was cancelled`);
    el.dispatch("touchcancel", {});
    clock.advance(5000);
    assert.deepStrictEqual(carousel.state().reasons, [], `${tag} touchcancel behaves like touchend`);
    carousel.destroy();
    assert.strictEqual(clock.pending(), 0);
  }

  // --- hidden tab pauses and resumes; a carousel created in a hidden tab waits ---
  {
    const env = makeEnv(mode);
    const { clock, carousel, doc } = env;
    carousel.start();
    clock.advance(3000);
    doc.hidden = true;
    doc.visibilityState = "hidden";
    doc.dispatch("visibilitychange", {});
    assert.deepStrictEqual(carousel.state().reasons, ["hidden"]);
    clock.advance(999999);
    assert.strictEqual(carousel.state().index, 0, `${tag} nothing advances in a background tab`);
    doc.hidden = false;
    doc.visibilityState = "visible";
    doc.dispatch("visibilitychange", {});
    assert.strictEqual(carousel.state().remainingMs, TIMES[0] - 3000);
    clock.advance(TIMES[0] - 3000);
    assert.strictEqual(carousel.state().index, 1);
    carousel.destroy();

    const hiddenEnv = makeEnv(mode, {}, (d) => { d.hidden = true; });
    hiddenEnv.carousel.start();
    assert.deepStrictEqual(hiddenEnv.carousel.state().reasons, ["hidden"]);
    assert.strictEqual(hiddenEnv.clock.pending(), 0, `${tag} started in a hidden tab: nothing counts yet`);
    hiddenEnv.doc.hidden = false;
    hiddenEnv.doc.dispatch("visibilitychange", {});
    assert.strictEqual(hiddenEnv.clock.pending() > 0, true);
    hiddenEnv.clock.advance(TIMES[0]);
    assert.strictEqual(hiddenEnv.carousel.state().index, 1);
    hiddenEnv.carousel.destroy();
  }

  // --- the user's pause button (and pause()/resume()) ---
  {
    const env = makeEnv(mode);
    const { clock, carousel, el, toggle } = env;
    carousel.start();
    clock.advance(2500);
    toggle.dispatch("click", {});
    assert.deepStrictEqual(carousel.state().reasons, ["user"]);
    assert.strictEqual(toggle.getAttribute("aria-label"), "Reanudar la rotación automática", `${tag} the label says what the button does now`);
    assert.ok(toggle._classes.has("rd-toggle--paused"));
    assert.strictEqual(byClass(toggle, "rd-icon").textContent, "▶");
    // Hover in/out does not undo the user's pause.
    el.dispatch("pointerenter", { pointerType: "mouse" });
    el.dispatch("pointerleave", { pointerType: "mouse" });
    clock.advance(500000);
    assert.strictEqual(carousel.state().index, 0, `${tag} paused by the user stays paused`);
    assert.strictEqual(carousel.state().state, "paused");
    toggle.dispatch("click", {});
    assert.deepStrictEqual(carousel.state().reasons, []);
    assert.strictEqual(toggle.getAttribute("aria-label"), "Pausar la rotación automática");
    assert.ok(!toggle._classes.has("rd-toggle--paused"));
    assert.strictEqual(carousel.state().remainingMs, TIMES[0] - 2500);
    // Programmatic pause()/resume() are the same thing.
    carousel.pause();
    assert.strictEqual(toggle.getAttribute("aria-label"), "Reanudar la rotación automática");
    carousel.pause(); // idempotent
    carousel.resume();
    carousel.resume();
    assert.deepStrictEqual(carousel.state().reasons, []);
    clock.advance(TIMES[0] - 2500);
    assert.strictEqual(carousel.state().index, 1);
    carousel.destroy();
  }

  // --- next / prev: wraparound, restart of the reading time, announcements ---
  {
    const env = makeEnv(mode);
    const { clock, carousel, live } = env;
    const N = ORDER.length;
    assert.strictEqual(carousel.state().count, N);
    // prev from the first wraps to the last.
    env.prev.dispatch("click", {});
    assert.strictEqual(carousel.state().index, N - 1, `${tag} prev wraps to the last fact`);
    assert.strictEqual(env.text.textContent, ORDER[N - 1].text.es);
    env.next.dispatch("click", {});
    assert.strictEqual(carousel.state().index, 0, `${tag} next wraps to the first fact`);
    for (let i = 0; i < N; i += 1) carousel.next();
    assert.strictEqual(carousel.state().index, 0);
    for (let i = 0; i < N + 3; i += 1) carousel.prev();
    assert.strictEqual(carousel.state().index, N - 3);
    assert.strictEqual(clock.pending(), 0, `${tag} navigating without start() schedules nothing`);
    carousel.next();
    carousel.next();
    carousel.next();
    assert.strictEqual(carousel.state().index, 0);

    // Announcements: only for prev/next (navigating a carousel that was never
    // started by API calls above did announce; a fresh one starts silent).
    assert.notStrictEqual(live.textContent, "", `${tag} calling next()/prev() directly is a user action and is announced`);
    const fresh = makeEnv(mode);
    assert.strictEqual(fresh.live.textContent, "");
    fresh.carousel.start();
    fresh.clock.advance(TIMES[0]);
    assert.strictEqual(fresh.carousel.state().index, 1);
    assert.strictEqual(fresh.live.textContent, "", `${tag} the automatic rotation is never announced`);
    fresh.next.dispatch("click", {});
    assert.strictEqual(fresh.live.textContent, announcementFor(ORDER[2], "es"), `${tag} next is announced`);
    fresh.clock.advance(TIMES[2]);
    assert.strictEqual(fresh.carousel.state().index, 3);
    assert.strictEqual(fresh.live.textContent, announcementFor(ORDER[2], "es"), `${tag} an automatic change leaves the last announcement alone`);
    fresh.prev.dispatch("click", {});
    assert.strictEqual(fresh.live.textContent, announcementFor(ORDER[2], "es"));
    fresh.prev.dispatch("click", {});
    assert.strictEqual(fresh.live.textContent, announcementFor(ORDER[1], "es"), `${tag} prev is announced`);
    fresh.carousel.destroy();

    // Manual navigation restarts the reading time of the new fact.
    const timing = makeEnv(mode);
    timing.carousel.start();
    timing.clock.advance(5000);
    timing.carousel.next();
    assert.strictEqual(timing.carousel.state().index, 1);
    assert.strictEqual(timing.carousel.state().remainingMs, TIMES[1], `${tag} next gives the new fact its full reading time`);
    timing.clock.advance(TIMES[1] - 1);
    assert.strictEqual(timing.carousel.state().index, 1);
    timing.clock.advance(1);
    assert.strictEqual(timing.carousel.state().index, 2);
    timing.carousel.prev();
    assert.strictEqual(timing.carousel.state().remainingMs, TIMES[1]);
    timing.carousel.destroy();

    // Navigating while paused (by the user, or by hover) changes the fact but stays paused.
    const paused = makeEnv(mode);
    paused.carousel.start();
    paused.carousel.pause();
    paused.carousel.next();
    assert.strictEqual(paused.carousel.state().index, 1);
    assert.strictEqual(paused.carousel.state().remainingMs, TIMES[1]);
    paused.clock.advance(1e6);
    assert.strictEqual(paused.carousel.state().index, 1, `${tag} still paused after next()`);
    paused.carousel.resume();
    paused.clock.advance(TIMES[1]);
    assert.strictEqual(paused.carousel.state().index, 2);
    paused.carousel.destroy();
  }

  // --- onChange ---
  {
    const calls = [];
    const env = makeEnv(mode, { onChange: (fact, info) => { calls.push([fact.id, info.user, info.index]); if (calls.length === 2) throw new Error("listener bug"); } });
    env.carousel.start();
    env.clock.advance(TIMES[0]);
    env.carousel.next();
    env.carousel.prev(); // the listener threw on the second call; it must not break anything
    env.clock.advance(TIMES[0]);
    assert.deepStrictEqual(calls, [
      [ORDER[1].id, false, 1],
      [ORDER[2].id, true, 2],
      [ORDER[1].id, true, 1],
      [ORDER[2].id, false, 2],
    ]);
    env.carousel.destroy();
  }

  // --- reduced motion ---
  {
    const reduced = makeEnv(mode, { reducedMotion: true });
    reduced.carousel.start();
    assert.strictEqual(reduced.clock.pending(), 1, `${tag} reduced motion: only the reading timer, no ring ticks`);
    assert.strictEqual(reduced.el.getAttribute("data-motion"), "reduce");
    assert.ok(reduced.el._classes.has("rd-reduced"));
    assert.strictEqual(reduced.progress.getAttribute("hidden"), "", `${tag} the ring is hidden`);
    assert.strictEqual(reduced.carousel.state().reduced, true);
    reduced.clock.advance(TIMES[0]);
    reduced.carousel.next();
    assert.ok(!reduced.card._classes.has("rd-enter"), `${tag} no fade-in class with reduced motion`);
    assert.strictEqual(reduced.clock.pending(), 1);
    reduced.clock.advance(TIMES[2] + TIMES[3]);
    assert.strictEqual(reduced.carousel.state().index, 4, `${tag} the rotation itself still works with reduced motion`);
    reduced.carousel.destroy();

    const full = makeEnv(mode, { reducedMotion: false });
    assert.ok(full.card._classes.has("rd-enter"), `${tag} the first fact fades in when motion is allowed`);
    full.carousel.start();
    assert.strictEqual(full.clock.pending(), 2);
    assert.strictEqual(full.el.getAttribute("data-motion"), "full");
    assert.ok(!full.progress.hasAttribute("hidden"));
    full.card.classList.remove("rd-enter");
    full.carousel.next();
    assert.ok(full.card._classes.has("rd-enter"), `${tag} each new fact restarts the fade-in class`);
    full.carousel.destroy();

    // The preference can change while the carousel is on screen (function form).
    let reduce = false;
    const live = makeEnv(mode, { reducedMotion: () => reduce });
    live.carousel.start();
    assert.strictEqual(live.clock.pending(), 2);
    reduce = true;
    live.carousel.next();
    assert.strictEqual(live.el.getAttribute("data-motion"), "reduce");
    assert.strictEqual(live.clock.pending(), 1, `${tag} the ring tick stops when reduced motion turns on`);
    reduce = false;
    live.carousel.next();
    assert.strictEqual(live.clock.pending(), 2, `${tag} and comes back when it turns off`);
    live.carousel.destroy();

    // From the a11y.motion setting: the data-motion attribute and the settings event.
    const viaAttr = makeEnv(mode, { reducedMotion: undefined }, (d) => d.documentElement.setAttribute("data-motion", "reduce"));
    assert.strictEqual(viaAttr.carousel.state().reduced, true, `${tag} <html data-motion="reduce"> is honoured`);
    viaAttr.carousel.destroy();
    const viaBus = makeEnv(mode, { reducedMotion: undefined });
    viaBus.carousel.start();
    assert.strictEqual(viaBus.carousel.state().reduced, false);
    Ludus.bus.emit("settings:changed", { path: "a11y.motion", value: "reduce" });
    assert.strictEqual(viaBus.carousel.state().reduced, true, `${tag} the settings event turns reduced motion on`);
    assert.strictEqual(viaBus.clock.pending(), 1);
    Ludus.bus.emit("settings:changed", { path: "board.theme", value: "ocean" });
    assert.strictEqual(viaBus.carousel.state().reduced, true, `${tag} unrelated settings are ignored`);
    Ludus.bus.emit("settings:changed", { path: "a11y.motion", value: "auto" });
    assert.strictEqual(viaBus.carousel.state().reduced, false, `${tag} "auto" falls back to the OS preference (none here)`);
    viaBus.carousel.destroy();

    // From the OS preference (matchMedia), including live changes.
    const mediaListeners = [];
    const mq = {
      matches: true,
      addEventListener: (type, fn) => mediaListeners.push([type, fn]),
      removeEventListener: (type, fn) => {
        const at = mediaListeners.findIndex(([t, f]) => t === type && f === fn);
        if (at !== -1) mediaListeners.splice(at, 1);
      },
    };
    const queries = [];
    const viaMedia = makeEnv(mode, {
      reducedMotion: undefined,
      window: { matchMedia: (query) => { queries.push(query); return mq; } },
    });
    assert.deepStrictEqual(queries, ["(prefers-reduced-motion: reduce)"]);
    assert.strictEqual(viaMedia.carousel.state().reduced, true, `${tag} prefers-reduced-motion is honoured`);
    viaMedia.carousel.start();
    assert.strictEqual(viaMedia.clock.pending(), 1);
    mq.matches = false;
    mediaListeners.forEach(([, fn]) => fn({ matches: false }));
    assert.strictEqual(viaMedia.carousel.state().reduced, false, `${tag} follows a live change of the OS setting`);
    assert.strictEqual(viaMedia.clock.pending(), 2);
    viaMedia.carousel.destroy();
    assert.strictEqual(mediaListeners.length, 0, `${tag} the matchMedia listener is removed on destroy`);
  }

  // --- language: fixed by option, or following Ludus.i18n ---
  {
    const english = makeEnv(mode, { lang: "en" });
    assert.strictEqual(english.text.textContent, ORDER[0].text.en);
    assert.strictEqual(english.chip.textContent, CATEGORY_LABEL(ORDER[0].cat, "en"));
    assert.strictEqual(english.next.getAttribute("aria-label"), "Next fact");
    assert.strictEqual(english.el.getAttribute("aria-label"), "Chess history and curiosities");
    assert.strictEqual(english.toggle.getAttribute("aria-label"), "Pause automatic rotation");
    english.carousel.start();
    assert.strictEqual(english.carousel.state().durationMs, Reader.readingTimeMs(ORDER[0].text.en, "en"), `${tag} the timer uses the English text length`);
    english.carousel.next();
    assert.strictEqual(english.live.textContent, announcementFor(ORDER[1], "en"));
    Ludus.i18n.setLanguage("es", { persist: false });
    assert.strictEqual(english.text.textContent, ORDER[1].text.en, `${tag} a fixed language ignores the global language`);
    english.carousel.destroy();

    Ludus.i18n.setLanguage("es", { persist: false });
    try {
      const follow = makeEnv(mode, { lang: undefined });
      follow.carousel.start();
      follow.clock.advance(2000);
      const before = follow.carousel.state().remainingMs;
      assert.strictEqual(follow.text.textContent, ORDER[0].text.es);
      Ludus.i18n.setLanguage("en", { persist: false });
      assert.strictEqual(follow.text.textContent, ORDER[0].text.en, `${tag} follows the language switch`);
      assert.strictEqual(follow.chip.textContent, CATEGORY_LABEL(ORDER[0].cat, "en"));
      assert.strictEqual(follow.next.getAttribute("aria-label"), "Next fact");
      assert.strictEqual(follow.carousel.state().remainingMs, before, `${tag} switching language keeps the remaining time`);
      assert.strictEqual(follow.live.textContent, "", `${tag} a language switch is not announced`);
      follow.clock.advance(before);
      assert.strictEqual(follow.carousel.state().index, 1);
      Ludus.i18n.setLanguage("es", { persist: false });
      assert.strictEqual(follow.text.textContent, ORDER[1].text.es);
      follow.carousel.destroy();
    } finally {
      Ludus.i18n.setLanguage("es", { persist: false });
    }
  }

  // --- onlyWhile ---
  {
    let allowed = true;
    const env = makeEnv(mode, { onlyWhile: () => allowed });
    env.carousel.start();
    env.clock.advance(TIMES[0]);
    assert.strictEqual(env.carousel.state().index, 1, `${tag} rotates while onlyWhile() is true`);
    allowed = false;
    env.clock.advance(TIMES[1]);
    assert.strictEqual(env.carousel.state().index, 1, `${tag} does not advance when onlyWhile() turned false`);
    assert.strictEqual(env.carousel.state().state, "idle");
    assert.strictEqual(env.clock.pending(), 0, `${tag} and leaves no timers behind`);
    env.carousel.start();
    assert.strictEqual(env.carousel.state().state, "idle", `${tag} start() refuses while onlyWhile() is false`);
    env.clock.advance(1e6);
    assert.strictEqual(env.carousel.state().index, 1);
    allowed = true;
    env.carousel.start();
    assert.strictEqual(env.carousel.state().state, "running");
    env.clock.advance(TIMES[1]);
    assert.strictEqual(env.carousel.state().index, 2);
    env.carousel.destroy();

    const broken = makeEnv(mode, { onlyWhile: () => { throw new Error("predicate bug"); } });
    broken.carousel.start();
    assert.strictEqual(broken.carousel.state().state, "idle", `${tag} a throwing predicate counts as "no"`);
    broken.carousel.destroy();
  }

  // --- stop / start ---
  {
    const env = makeEnv(mode);
    env.carousel.start();
    env.carousel.start(); // a second start() changes nothing
    assert.strictEqual(env.clock.pending(), 2);
    env.clock.advance(3000);
    env.carousel.stop();
    assert.strictEqual(env.carousel.state().state, "idle");
    assert.strictEqual(env.clock.pending(), 0, `${tag} stop() clears every timer`);
    env.clock.advance(1e6);
    assert.strictEqual(env.carousel.state().index, 0);
    env.carousel.start();
    assert.strictEqual(env.carousel.state().remainingMs, TIMES[0], `${tag} restarting gives the fact its full reading time again`);
    env.clock.advance(TIMES[0] - 1);
    assert.strictEqual(env.carousel.state().index, 0);
    env.clock.advance(1);
    assert.strictEqual(env.carousel.state().index, 1);
    env.carousel.stop();
    env.carousel.stop();
    env.carousel.destroy();
  }

  // --- category option ---
  {
    const machines = Facts.byCategory("machines");
    const env = makeEnv(mode, { category: "machines" });
    assert.strictEqual(env.carousel.state().count, machines.length);
    const seen = [];
    for (let i = 0; i < machines.length; i += 1) {
      seen.push(env.carousel.state().factId);
      assert.strictEqual(env.carousel.current().cat, "machines");
      env.carousel.next();
    }
    assert.strictEqual(new Set(seen).size, machines.length, `${tag} a lap shows every fact of the category once`);
    assert.strictEqual(env.carousel.state().factId, seen[0], `${tag} and wraps back to the first`);
    env.carousel.destroy();

    const unknown = makeEnv(mode, { category: "no-such-category" });
    assert.strictEqual(unknown.carousel.state().count, Facts.all().length, `${tag} an unknown category falls back to every fact`);
    unknown.carousel.destroy();
  }

  // --- the DOM never parses HTML from the facts ---
  {
    const evil = {
      id: "evil-1",
      cat: "origins",
      year: 1,
      text: { es: "<img src=x onerror=alert(1)> &amp; <script>alert(2)</script>", en: "<b>bold</b> \"quotes\" 'x'" },
      source: "test",
    };
    const fakeFacts = {
      byCategory: () => [evil],
      shuffled: () => [evil],
      formatYear: () => "<b>1</b>",
      categoryLabel: () => "<i>Cat</i>",
    };
    const env = makeEnv(mode, { facts: fakeFacts });
    assert.strictEqual(env.text.textContent, evil.text.es, `${tag} the text is plain text`);
    assert.strictEqual(env.text.children.length, 0);
    assert.strictEqual(env.chip.textContent, "<i>Cat</i>");
    assert.strictEqual(env.chip.children.length, 0);
    assert.strictEqual(env.year.textContent, "<b>1</b>");
    env.carousel.next();
    assert.strictEqual(env.live.textContent, `<i>Cat</i>. <b>1</b>. ${evil.text.es}`);
    assert.strictEqual(env.live.children.length, 0);
    const tags = new Set();
    walk(env.el, (node) => { if (node.nodeType === 1) tags.add(node.tagName); });
    assert.deepStrictEqual(Array.from(tags).sort(), ["BUTTON", "CIRCLE", "DIV", "P", "SECTION", "SPAN", "SVG"], `${tag} only the expected elements exist`);
    // A single fact rotates onto itself without trouble.
    env.carousel.start();
    env.clock.advance(Reader.readingTimeMs(evil.text.es) * 3);
    assert.strictEqual(env.carousel.state().index, 0);
    env.carousel.destroy();

    // Empty corpus: renders nothing, schedules nothing, does not throw.
    const empty = makeEnv(mode, { facts: { byCategory: () => [], shuffled: () => [] } });
    empty.carousel.start();
    empty.carousel.next();
    empty.carousel.prev();
    assert.strictEqual(empty.carousel.current(), null);
    assert.strictEqual(empty.carousel.state().count, 0);
    assert.strictEqual(empty.carousel.state().state, "idle");
    assert.strictEqual(empty.clock.pending(), 0);
    empty.carousel.destroy();
  }

  // --- destroy(): timers, listeners, subscriptions and DOM are all gone ---
  {
    const spy = instrumentSubscriptions();
    try {
      const media = { matches: false, list: [], addEventListener(t, f) { this.list.push(f); }, removeEventListener(t, f) { this.list = this.list.filter((x) => x !== f); } };
      const env = makeEnv(mode, { lang: undefined, reducedMotion: undefined, window: { matchMedia: () => media } });
      assert.strictEqual(spy.counts.bus, 1, `${tag} one bus subscription while alive`);
      assert.strictEqual(spy.counts.lang, 1, `${tag} one language subscription while alive`);
      assert.ok(env.doc.listenerCount() > 0 && totalListeners(env.el) > 0 && media.list.length === 1);
      env.carousel.start();
      env.clock.advance(1234);
      env.el.dispatch("pointerenter", { pointerType: "mouse" });
      env.el.dispatch("touchstart", {});
      env.el.dispatch("touchend", {}); // leaves the 5 s release timer pending
      env.el.dispatch("pointerleave", { pointerType: "mouse" });
      assert.ok(env.clock.pending() > 0);
      const before = env.carousel.state();
      env.carousel.destroy();
      assert.strictEqual(env.clock.pending(), 0, `${tag} destroy() clears the reading timer, the ring tick and the touch timer`);
      assert.strictEqual(env.container.children.length, 0, `${tag} the DOM is removed`);
      assert.strictEqual(env.el.parentNode, null);
      assert.strictEqual(env.doc.listenerCount(), 0, `${tag} document listeners removed`);
      assert.strictEqual(totalListeners(env.el), 0, `${tag} element listeners removed`);
      assert.strictEqual(media.list.length, 0, `${tag} matchMedia listener removed`);
      assert.strictEqual(spy.counts.bus, 0, `${tag} bus subscription released`);
      assert.strictEqual(spy.counts.lang, 0, `${tag} language subscription released`);
      assert.strictEqual(env.carousel.state().destroyed, true);
      assert.strictEqual(env.carousel.state().state, "idle");
      // Everything is a harmless no-op afterwards.
      const html = env.text.textContent;
      env.carousel.start();
      env.carousel.next();
      env.carousel.prev();
      env.carousel.pause();
      env.carousel.resume();
      env.carousel.stop();
      env.carousel.destroy();
      env.doc.dispatch("visibilitychange", {});
      Ludus.bus.emit("settings:changed", { path: "a11y.motion", value: "reduce" });
      Ludus.i18n.setLanguage("en", { persist: false });
      Ludus.i18n.setLanguage("es", { persist: false });
      env.clock.advance(1e7);
      assert.strictEqual(env.clock.pending(), 0);
      assert.strictEqual(env.carousel.state().index, before.index);
      assert.strictEqual(env.text.textContent, html, `${tag} a destroyed carousel does not touch its DOM`);
    } finally {
      spy.restore();
    }
  }
}

runCarouselSuite("util");
runCarouselSuite("local");

// ---------- Construction errors and defaults ----------

assert.throws(() => Reader.createCarousel(null, {}), TypeError, "a container is required");
assert.throws(() => Reader.createCarousel({}, {}), TypeError, "the container must be an element");
{
  const doc = new FakeDocument();
  const container = new FakeElement("div");
  container.ownerDocument = doc;
  assert.throws(() => Reader.createCarousel(container, { document: doc, facts: {} }), /Ludus\.Facts/, "facts are required");
  assert.throws(() => Reader.createCarousel(new FakeElement("div"), {}), /document/, "a document is required");
  // Default timers (real ones): start, then destroy right away; nothing may keep running.
  const real = Reader.createCarousel(container, { document: doc, reducedMotion: true });
  real.start();
  assert.strictEqual(real.state().state, "running");
  real.destroy();
  assert.strictEqual(container.children.length, 0);
}

console.log(`reader.test.js: all checks passed (${TABLE.length} reading-time rows, scheduler, carousel suite x2 for Ludus.util.h and the fallback builder)`);
