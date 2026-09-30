// Tests for the History screen (js/ui/museum.js) against the real Facts, Concepts, Insights and Reader
// modules and the fake DOM of _uidom.js.
//
// Covers: text parity es / en; the pure helpers (tab hash routes, eras and timeline grouping for the real
// 36 milestones, the facts of each milestone's time, jump-to-year, accent-blind fact search, the surprise
// picker, the lesson filters, the example move of every lesson in SAN); and the screen: the accessible
// tablist (roles, one tab stop, arrow keys, panels), the timeline (eras, expandable items, jump to a year
// and to an era), curiosities (categories, search, show more, surprise me), the chess school (a board with
// the best-move arrow on every lesson, the mistake tags), the reading room (the real Reader carousel is
// created, restarted on a topic, stopped on leaving), hash mirroring, the language switch and the
// degradation without its modules.

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { FakeDocument, findAll, byClass } = require("./_uidom.js");
const { createFakeLocalStorage } = require("./_fakedom.js");

const repoRoot = path.resolve(__dirname, "..", "..");
const SCRIPTS = [
  "js/ludus.js", "js/chess.js", "js/facts.js", "js/reader.js", "js/insights.js", "js/concepts.js", "js/ui/kit.js", "js/ui/museum.js",
];

function createEnv({ language = "es", skip = [] } = {}) {
  const doc = new FakeDocument();
  const storageMap = new Map();
  const location = { hash: "", pathname: "/", search: "" };
  const clock = { now: 0, seq: 0, timers: new Map() };
  const winListeners = new Map();
  const sandbox = {
    console, Date, Math, JSON, Object, Array, String, Number, Promise, Map, Set, Intl, URL, structuredClone, WeakMap, performance: { now: () => clock.now },
    setTimeout(fn, ms) { clock.seq += 1; clock.timers.set(clock.seq, { at: clock.now + Number(ms || 0), fn }); return clock.seq; },
    clearTimeout(id) { clock.timers.delete(id); },
    document: doc,
    navigator: { languages: [language], language },
    localStorage: createFakeLocalStorage(storageMap),
    location,
    addEventListener(type, fn) { if (!winListeners.has(type)) winListeners.set(type, []); winListeners.get(type).push(fn); },
    removeEventListener(type, fn) { winListeners.set(type, (winListeners.get(type) || []).filter((entry) => entry !== fn)); },
  };
  sandbox.window = sandbox;
  sandbox.history = { state: null, replaceState(_state, _title, url) { location.hash = (String(url).match(/#.*$/) || [""])[0]; } };
  const context = vm.createContext(sandbox);
  SCRIPTS.filter((rel) => !skip.includes(rel)).forEach((rel) => vm.runInContext(fs.readFileSync(path.join(repoRoot, rel), "utf8"), context, { filename: rel }));
  const Ludus = context.Ludus;
  Ludus.i18n.setLanguage(language, { persist: false });
  if (Ludus.ui) Ludus.ui._setTimers({ setTimeout: sandbox.setTimeout, clearTimeout: sandbox.clearTimeout, raf(fn) { fn(); }, now: () => clock.now });
  const advance = (ms) => {
    const target = clock.now + ms;
    for (;;) {
      let next = null;
      let nextId = 0;
      clock.timers.forEach((timer, id) => { if (timer.at <= target && (!next || timer.at < next.at)) { next = timer; nextId = id; } });
      if (!next) break;
      clock.timers.delete(nextId);
      clock.now = Math.max(clock.now, next.at);
      next.fn();
    }
    clock.now = target;
  };
  const mk = (tag, attrs) => {
    const el = doc.createElement(tag);
    Object.keys(attrs || {}).forEach((key) => el.setAttribute(key, attrs[key]));
    return el;
  };
  const app = mk("div", { class: "app" });
  doc.body.appendChild(app);
  const el = mk("section", { id: "screen-museum", class: "screen hidden" });
  const other = mk("section", { id: "screen-home", class: "screen hidden" });
  app.appendChild(el);
  app.appendChild(other);
  Ludus.router.register("museum", { el, onShow: (params) => Ludus.Screens.museum.show(params), onHide: () => Ludus.Screens.museum.hide() });
  Ludus.router.register("home", { el: other });
  const fire = (type) => (winListeners.get(type) || []).slice().forEach((fn) => fn({ type }));
  return { Ludus, doc, el, location, advance, fire, setGame: (game) => { Ludus.game = game; } };
}

const text = (node) => node.textContent.replace(/\s+/g, " ").trim();
const one = (root, predicate) => findAll(root, predicate)[0];
const q = (root, selector) => root.querySelector(selector);
const plain = (value) => JSON.parse(JSON.stringify(value));
const deepEq = (actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message);
const placeholders = (string) => Array.from(String(string).matchAll(/\{(\w+)\}/g), (m) => m[1]).sort().join(",");
const panel = (el, tab) => q(el, `#museum-panel-${tab}`);
const tabButton = (el, tab) => q(el, `#museum-tab-${tab}`);
const hidden = (node) => node.hasAttribute("hidden");

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

test("text: es and en have the same keys and placeholders, none empty; the title key resolves", () => {
  const { Ludus } = createEnv();
  const { es, en } = Ludus.Screens.museum.TEXT;
  deepEq(Object.keys(es).sort(), Object.keys(en).sort());
  Object.keys(es).forEach((key) => {
    assert.ok(es[key].length > 0 && en[key].length > 0, `${key} is empty`);
    assert.strictEqual(placeholders(es[key]), placeholders(en[key]), `${key}: placeholders differ`);
    assert.ok(key.startsWith("museum."));
  });
  assert.strictEqual(Ludus.Screens.museum.titleKey, "museum.title");
  assert.strictEqual(Ludus.i18n.t("museum.title", null, "es"), "Historia");
  assert.strictEqual(Ludus.i18n.t("museum.title", null, "en"), "History");
  assert.ok(es["museum.timeline.lead"].includes("Abrí") && es["museum.room.lead"].includes("podés"), "rioplatense");
});

test("tab routes: #/museum/<tab> for the four tabs only", () => {
  const h = createEnv().Ludus.Screens.museum.helpers;
  deepEq(h.TABS, ["timeline", "curiosities", "school", "room"]);
  assert.strictEqual(h.parseMuseumHash("#/museum/school"), "school");
  assert.strictEqual(h.parseMuseumHash("#/museum/room/"), "room");
  assert.strictEqual(h.parseMuseumHash("#/museum"), null);
  assert.strictEqual(h.parseMuseumHash("#/museum/nope"), null);
  assert.strictEqual(h.parseMuseumHash("#/museum/__proto__"), null);
  assert.strictEqual(h.parseMuseumHash("#/classics/timeline"), null);
  assert.strictEqual(h.isMuseumHash("#/museum"), true);
  assert.strictEqual(h.isMuseumHash("#/museum/school"), false);
  assert.strictEqual(h.buildMuseumHash("timeline"), "#/museum");
  assert.strictEqual(h.buildMuseumHash("room"), "#/museum/room");
  assert.strictEqual(h.buildMuseumHash("nope"), "#/museum");
  assert.strictEqual(h.cleanTab("school"), "school");
  assert.strictEqual(h.cleanTab("x"), "timeline");
});

test("eras and grouping: the 36 real milestones land in ordered eras, none lost", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.museum.helpers;
  const items = Ludus.Facts.timeline();
  assert.strictEqual(items.length, 36);
  assert.strictEqual(h.eraOfYear(600), "e0");
  assert.strictEqual(h.eraOfYear(999), "e0");
  assert.strictEqual(h.eraOfYear(1000), "e1");
  assert.strictEqual(h.eraOfYear(1499), "e1");
  assert.strictEqual(h.eraOfYear(1500), "e2");
  assert.strictEqual(h.eraOfYear(1851), "e3");
  assert.strictEqual(h.eraOfYear(1886), "e4");
  assert.strictEqual(h.eraOfYear(1948), "e5");
  assert.strictEqual(h.eraOfYear(1997), "e6");
  assert.strictEqual(h.eraOfYear(2006), "e7");
  assert.strictEqual(h.eraOfYear(2100), "e7");
  assert.strictEqual(h.eraOfYear("garbage"), "e0");
  const groups = h.groupTimeline(items);
  assert.strictEqual(groups.reduce((n, g) => n + g.items.length, 0), 36, "every milestone is in an era");
  deepEq(groups.map((g) => g.id), ["e0", "e1", "e2", "e3", "e4", "e5", "e6", "e7"].filter((id) => groups.some((g) => g.id === id)));
  const flat = groups.flatMap((g) => g.items.map((i) => i.id));
  deepEq(flat, items.map((i) => i.id), "the order is the timeline's own");
  groups.forEach((g) => {
    assert.ok(g.first <= g.last);
    g.items.forEach((i) => assert.strictEqual(h.eraOfYear(i.year), g.id));
  });
  deepEq(h.groupTimeline([]), []);
  deepEq(h.groupTimeline(null), []);
  assert.strictEqual(h.groupTimeline([{ id: "x", year: "abc" }, { id: "y", year: 1900 }]).length, 1, "items without a year are skipped");
});

test("facts of a milestone's time: from its year up to the next milestone", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.museum.helpers;
  const facts = Ludus.Facts.all();
  const items = Ludus.Facts.timeline();
  const related = h.relatedByItem(items, facts);
  assert.strictEqual(related.size, 36);
  let total = 0;
  items.forEach((item, i) => {
    const next = items[i + 1];
    related.get(item.id).forEach((fact) => {
      assert.ok(fact.year >= item.year && (!next || fact.year < next.year), `${fact.id} belongs to ${item.id}`);
    });
    const years = related.get(item.id).map((f) => f.year);
    deepEq(years, years.slice().sort((a, b) => a - b));
    total += related.get(item.id).length;
  });
  assert.strictEqual(total, facts.filter((f) => typeof f.year === "number" && f.year >= items[0].year).length, "every dated fact appears under exactly one milestone");
  deepEq(h.factsBetween([{ id: "a" }, { id: "b", year: 1900 }], 1800, 2000).map((f) => f.id), ["b"], "undated facts never match");
  assert.strictEqual(h.factsBetween(null, 0, 1).length, 0);
  assert.strictEqual(h.factsBetween([{ id: "c", year: 2030 }], 2000, null).length, 1, "no upper limit");
});

test("jump to a year: the first milestone at or after it, the last one beyond, nothing for a non-year", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.museum.helpers;
  const items = Ludus.Facts.timeline();
  const at = (value) => { const i = h.findYearTarget(items, value); return i === null ? null : items[i].year; };
  assert.strictEqual(at("600"), 600);
  assert.strictEqual(at("601"), 700);
  assert.strictEqual(at(1970), 1970);
  assert.strictEqual(at("1971"), 1972);
  assert.strictEqual(at("100"), 600, "before the first: the first");
  assert.strictEqual(at("2024"), 2024);
  assert.strictEqual(at("2999"), 2024, "after the last: the last");
  assert.strictEqual(at("  1858 "), 1858);
  assert.strictEqual(at(""), null);
  assert.strictEqual(at("abc"), null);
  assert.strictEqual(at("19x0"), null);
  assert.strictEqual(at("12345"), null);
  assert.strictEqual(at(null), null);
  assert.strictEqual(h.findYearTarget([], "1900"), null);
});

test("fact search: category, accent-blind words, year and category label", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.museum.helpers;
  const facts = Ludus.Facts.all();
  const label = (cat) => Ludus.Facts.categoryLabel(cat, "es");
  const f = (options) => h.filterFacts(facts, Object.assign({ categoryLabel: label }, options), "es");
  assert.strictEqual(f({}).length, 126);
  assert.strictEqual(f({ category: "all" }).length, 126);
  assert.strictEqual(f({ category: "machines" }).length, 17);
  assert.ok(f({ category: "machines" }).every((fact) => fact.cat === "machines"));
  const fischer = f({ query: "fischer" });
  assert.ok(fischer.length >= 3 && fischer.every((fact) => /fischer/i.test(fact.text.es)));
  assert.strictEqual(f({ query: "FISCHER" }).length, fischer.length, "case");
  assert.ok(f({ query: "kasparov" }).length === f({ query: "kaspárov" }).length && f({ query: "Kaspárov" }).length > 0, "accents");
  assert.ok(f({ query: "1972" }).length >= 1, "the year is searchable");
  assert.ok(f({ query: "orígenes" }).length >= 1, "the category label is searchable");
  assert.ok(f({ query: "fischer", category: "champions" }).length <= fischer.length);
  assert.strictEqual(f({ query: "zzzzqq" }).length, 0);
  assert.strictEqual(f({ query: "   " }).length, 126);
  assert.ok(h.filterFacts(facts, { query: "clock" }, "en").length >= 1, "English text in English");
  assert.strictEqual(h.filterFacts(null, {}, "es").length, 0);
});

test("surprise: unseen first, never the same twice in a row, robust to nothing", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.museum.helpers;
  const facts = Ludus.Facts.all().slice(0, 4);
  const ids = facts.map((f) => f.id);
  assert.strictEqual(h.pickSurprise(facts, [ids[0], ids[1], ids[2]], () => 0).id, ids[3], "the only unseen one");
  assert.strictEqual(h.pickSurprise(facts, [], () => 0).id, ids[0]);
  assert.strictEqual(h.pickSurprise(facts, [], () => 0.999).id, ids[3]);
  assert.strictEqual(h.pickSurprise(facts, [], () => NaN).id, ids[0], "a broken random still picks something");
  const all = h.pickSurprise(facts, ids, () => 0);
  assert.notStrictEqual(all.id, ids[3], "when everything was seen, not the last one again");
  assert.strictEqual(h.pickSurprise([], [], () => 0), null);
  assert.strictEqual(h.pickSurprise(null, [], () => 0), null);
  assert.strictEqual(h.pickSurprise(facts.slice(0, 1), [ids[0]], () => 0).id, ids[0], "a pool of one");
  let seen = [];
  for (let i = 0; i < 300; i += 1) seen = h.rememberSeen(seen, `f${i}`);
  assert.strictEqual(seen.length, 24, "the memory is bounded");
  assert.strictEqual(seen[seen.length - 1], "f299");
  deepEq(h.rememberSeen(["a", "b"], "a"), ["b", "a"], "a repeat moves to the end");
  // Statistically it varies.
  const picked = new Set();
  for (let i = 0; i < 40; i += 1) picked.add(h.pickSurprise(Ludus.Facts.all(), [], Math.random).id);
  assert.ok(picked.size > 10);
});

test("school: the tags that have lessons, the filter, the example move of every lesson", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.museum.helpers;
  const tags = h.schoolTags(Array.from(Ludus.Insights.TAGS), Ludus.Concepts);
  assert.ok(tags.length >= 12 && tags.every((tag) => Ludus.Concepts.byTag(tag).length > 0));
  assert.ok(!tags.includes("time_trouble") && !tags.includes("solid"), "tags without a lesson are not offered");
  deepEq(h.schoolTags(null, Ludus.Concepts), []);
  deepEq(h.schoolTags(["fork_available"], null), []);
  const list = Ludus.Concepts.list();
  assert.strictEqual(h.filterConcepts(list, "all").length, list.length);
  assert.strictEqual(h.filterConcepts(list, undefined).length, list.length);
  deepEq(h.filterConcepts(list, "fork_available").map((c) => c.id), ["fork"]);
  assert.strictEqual(h.filterConcepts(list, "pin_or_skewer").length, 2);
  assert.strictEqual(h.filterConcepts(list, "no_such_tag").length, 0);
  deepEq(h.uciSquares("b5c7"), { from: "b5", to: "c7" });
  deepEq(h.uciSquares("a7a8q"), { from: "a7", to: "a8" });
  assert.strictEqual(h.uciSquares("zz"), null);
  assert.strictEqual(h.uciSquares(null), null);
  const sans = list.map((concept) => h.conceptMoveSan(concept, Ludus.chess));
  assert.ok(sans.every((san) => typeof san === "string" && san.length >= 2), `every lesson replays: ${sans}`);
  assert.strictEqual(sans[0], "Nc7+");
  assert.strictEqual(h.conceptMoveSan({ fen: "garbage", bestUci: "e2e4" }, Ludus.chess), null);
  assert.strictEqual(h.conceptMoveSan(list[0], {}), null);
});

// ---------- the screen ----------

test("tablist: roles, one tab stop, panels; the timeline is the default; mounting is idempotent", async () => {
  const { Ludus, el } = createEnv();
  const screen = Ludus.Screens.museum;
  screen.mount(el);
  screen.mount(el);
  Ludus.router.show("museum");
  assert.strictEqual(findAll(el, byClass("museum")).length, 1);
  assert.strictEqual(findAll(el, (n) => n.tagName === "H1").length, 1);
  const tabs = findAll(el, (n) => n.getAttribute("role") === "tab");
  assert.strictEqual(tabs.length, 4);
  assert.strictEqual(q(el, '[role="tablist"]').getAttribute("aria-label"), "Secciones de Historia");
  assert.strictEqual(tabs.filter((t) => t.getAttribute("tabindex") === "0").length, 1);
  assert.strictEqual(tabs.filter((t) => t.getAttribute("aria-selected") === "true").length, 1);
  assert.strictEqual(tabButton(el, "timeline").getAttribute("aria-selected"), "true");
  const panels = findAll(el, (n) => n.getAttribute("role") === "tabpanel");
  assert.strictEqual(panels.length, 4);
  assert.strictEqual(panels.filter((p) => !hidden(p)).length, 1, "one panel at a time");
  tabs.forEach((tab) => {
    const p = q(el, `#${tab.getAttribute("aria-controls")}`);
    assert.strictEqual(p.getAttribute("aria-labelledby"), tab.getAttribute("id"), "panel and tab name each other");
  });
  assert.strictEqual(findAll(panel(el, "curiosities"), byClass("museum-fact")).length, 0, "other tabs are not drawn until opened");
  assert.strictEqual(tabs.map((t) => text(t)).join("|"), "Línea de tiempo|Curiosidades|Escuela de ajedrez|Sala de lectura");
});

test("tablist: click, arrow keys, Home / End and the hash", async () => {
  const env = createEnv();
  const { Ludus, el, location, advance } = env;
  Ludus.Screens.museum.mount(el);
  Ludus.router.show("museum");
  const key = (name) => { const evt = q(el, '[role="tablist"]').dispatch("keydown", { key: name }); return evt.defaultPrevented; };
  tabButton(el, "curiosities").click();
  assert.strictEqual(tabButton(el, "curiosities").getAttribute("aria-selected"), "true");
  assert.ok(hidden(panel(el, "timeline")) && !hidden(panel(el, "curiosities")));
  advance(5);
  assert.strictEqual(location.hash, "#/museum/curiosities");
  assert.strictEqual(key("ArrowRight"), true);
  assert.strictEqual(tabButton(el, "school").getAttribute("aria-selected"), "true");
  assert.strictEqual(el.ownerDocument.activeElement, tabButton(el, "school"), "focus follows");
  key("End");
  assert.strictEqual(tabButton(el, "room").getAttribute("aria-selected"), "true");
  key("ArrowRight");
  assert.strictEqual(tabButton(el, "timeline").getAttribute("aria-selected"), "true", "wraps around");
  key("ArrowLeft");
  assert.strictEqual(tabButton(el, "room").getAttribute("aria-selected"), "true");
  key("Home");
  advance(5);
  assert.strictEqual(location.hash, "#/museum");
  assert.strictEqual(key("ArrowDown"), false, "vertical arrows are left to the page");
  assert.strictEqual(key("a"), false);
  // Route params.
  Ludus.router.show("museum", { tab: "school" });
  assert.strictEqual(tabButton(el, "school").getAttribute("aria-selected"), "true");
  Ludus.router.show("museum", { tab: "bogus" });
  assert.strictEqual(tabButton(el, "school").getAttribute("aria-selected"), "true", "an unknown tab keeps the current one");
});

test("timeline: eras, 36 expandable milestones with related facts and sources, nothing but text nodes", async () => {
  const { Ludus, el } = createEnv();
  Ludus.Screens.museum.mount(el);
  Ludus.router.show("museum");
  const root = panel(el, "timeline");
  const events = findAll(root, byClass("museum-event"));
  assert.strictEqual(events.length, 36);
  const eras = findAll(root, byClass("museum-era"));
  assert.ok(eras.length >= 6 && eras.every((era) => era.getAttribute("aria-labelledby")));
  assert.strictEqual(findAll(root, byClass("museum-era-link")).length, eras.length, "one link per era");
  assert.ok(text(eras[0]).includes("Orígenes") && text(eras[0]).includes("c. 600"), text(eras[0]));
  assert.strictEqual(findAll(root, byClass("museum-year"))[0].textContent, "c. 600");
  events.forEach((event) => assert.ok(text(q(event, ".museum-event-text")).length > 40));
  const first = events[0];
  const more = q(first, ".museum-more");
  const region = q(first, ".museum-more-panel");
  assert.strictEqual(more.getAttribute("aria-expanded"), "false");
  assert.strictEqual(more.getAttribute("aria-controls"), region.getAttribute("id"));
  assert.ok(hidden(region));
  assert.ok(text(more).includes("Más de esta época (2)"));
  more.click();
  assert.strictEqual(more.getAttribute("aria-expanded"), "true");
  assert.ok(!hidden(region));
  assert.strictEqual(findAll(region, (n) => n.tagName === "LI").length, 2, "two curiosities of that time");
  assert.ok(text(region).includes("Fuente"));
  assert.ok(text(more).includes("Ocultar"));
  more.click();
  assert.ok(hidden(region));
  assert.ok(text(more).includes("Más de esta época (2)"));
  // The expansion is remembered across a redraw (a language switch) and follows the language.
  more.click();
  Ludus.i18n.setLanguage("en", { persist: false });
  const again = q(panel(el, "timeline"), ".museum-more");
  assert.strictEqual(again.getAttribute("aria-expanded"), "true");
  assert.ok(text(panel(el, "timeline")).includes("Origins") && text(panel(el, "timeline")).includes("The Middle Ages"));
  assert.strictEqual(findAll(panel(el, "timeline"), byClass("museum-year"))[0].textContent, "c. 600");
});

test("timeline: jump to a year focuses the milestone; a bad year says so; an era link focuses its title", async () => {
  const { Ludus, el, doc } = createEnv();
  Ludus.Screens.museum.mount(el);
  Ludus.router.show("museum");
  const root = panel(el, "timeline");
  const input = q(root, "#museum-year");
  const form = q(root, ".museum-year-form");
  input.value = "1970";
  form.dispatch("submit");
  const focused = doc.activeElement;
  assert.ok(focused.classList.contains("museum-event-title"));
  const event = focused.closest(".museum-event");
  assert.strictEqual(event.getAttribute("data-year"), "1970");
  assert.ok(event.classList.contains("is-target"));
  const status = q(root, "#museum-year-status");
  assert.ok(text(status).includes("1970") && text(status).includes("El sistema Elo"), text(status));
  assert.ok(!status.classList.contains("is-error"));
  input.value = "1971";
  form.dispatch("submit");
  assert.strictEqual(doc.activeElement.closest(".museum-event").getAttribute("data-year"), "1972", "the next milestone");
  input.value = "no";
  form.dispatch("submit");
  assert.ok(status.classList.contains("is-error") && text(status).includes("Escribí un año entre 600 y 2024"));
  const link = q(root, '.museum-era-link[data-era="e7"]');
  link.click();
  assert.ok(doc.activeElement.classList.contains("museum-era-title") && text(doc.activeElement).includes("digital"));
  assert.strictEqual(link.getAttribute("aria-current"), "location");
  assert.strictEqual(findAll(root, (n) => n.getAttribute("aria-current") === "location").length, 1);
});

test("curiosities: 24 first, categories with counts, search, show more, empty state, surprise me", async () => {
  const { Ludus, el, advance } = createEnv();
  Ludus.Screens.museum.mount(el);
  Ludus.router.show("museum", { tab: "curiosities" });
  const root = panel(el, "curiosities");
  const items = () => findAll(root, byClass("museum-fact-item"));
  assert.strictEqual(items().length, 24);
  assert.strictEqual(text(q(root, ".museum-count")), "24 de 126 curiosidades");
  const pills = findAll(q(root, ".museum-pills"), (n) => n.tagName === "BUTTON");
  assert.strictEqual(pills.length, 9);
  assert.strictEqual(pills[0].getAttribute("aria-pressed"), "true");
  assert.ok(text(pills[0]).includes("Todas") && text(pills[0]).includes("126"));
  assert.ok(text(pills[2]).includes("Campeones") && text(pills[2]).includes("38"));
  const more = q(root, ".museum-more-facts");
  assert.ok(!hidden(more) && text(more).includes("102 restantes"));
  more.click();
  assert.strictEqual(items().length, 48);
  // A category.
  pills[3].click();
  assert.strictEqual(items().length, 17);
  assert.strictEqual(pills[3].getAttribute("aria-pressed"), "true");
  assert.strictEqual(pills[0].getAttribute("aria-pressed"), "false");
  assert.ok(hidden(more), "no more to show");
  assert.strictEqual(findAll(root, (n) => n.classList.contains("museum-fact") && findAll(n, byClass("rd-chip--machines")).length === 1).length, 17);
  // Search (debounced; Enter is not needed, the timer runs it) and the clear button.
  pills[0].click();
  const search = q(root, "#museum-search");
  search.value = "fischer";
  search.dispatch("input");
  assert.strictEqual(items().length, 24, "not yet");
  advance(200);
  const hits = items();
  assert.ok(hits.length > 2 && hits.length < 24);
  assert.ok(hits.every((item) => /fischer/i.test(text(item))));
  assert.strictEqual(q(root, ".museum-search-clear").hasAttribute("hidden"), false);
  q(root, ".museum-search-clear").click();
  assert.strictEqual(search.value, "");
  assert.strictEqual(items().length, 24);
  search.value = "zzzzqq";
  search.dispatch("input");
  advance(200);
  assert.strictEqual(items().length, 0);
  const empty = q(root, ".museum-empty");
  assert.ok(!hidden(empty) && text(empty).includes("No encontramos curiosidades"));
  q(empty, ".btn").click();
  assert.strictEqual(items().length, 24);
  assert.strictEqual(search.value, "");
  // Surprise me: a featured card with the source, another one, closing it; nothing is stored.
  const surprise = q(root, ".museum-surprise");
  assert.ok(hidden(surprise));
  const button = q(root, ".museum-surprise-btn");
  assert.ok(text(button).includes("Sorpréndeme"));
  button.click();
  assert.ok(!hidden(surprise));
  const first = text(q(surprise, ".museum-fact-text"));
  assert.ok(first.length > 40);
  assert.ok(text(surprise).includes("Fuente"));
  assert.ok(text(button).includes("Otra sorpresa"));
  const seen = new Set([first]);
  for (let i = 0; i < 6; i += 1) {
    button.click();
    seen.add(text(q(surprise, ".museum-fact-text")));
  }
  assert.ok(seen.size >= 5, `surprises differ (${seen.size})`);
  assert.strictEqual(surprise.getAttribute("aria-live"), "polite");
  one(surprise, (n) => n.tagName === "BUTTON").click();
  assert.ok(hidden(surprise));
  assert.ok(text(button).includes("Sorpréndeme"));
  assert.strictEqual(el.ownerDocument.activeElement, button, "focus returns to the button");
  assert.strictEqual(Ludus.storage.keys("ludus.museum").length + Ludus.storage.keys("ludus.facts").length, 0, "nothing is saved");
});

test("chess school: 14 lessons, each with a board, the best-move arrow and its example move; tags filter", async () => {
  const { Ludus, el } = createEnv();
  Ludus.Screens.museum.mount(el);
  Ludus.router.show("museum", { tab: "school" });
  const root = panel(el, "school");
  const cards = () => findAll(root, byClass("museum-concept"));
  assert.strictEqual(cards().length, 14);
  assert.strictEqual(text(q(root, ".museum-count")), "14 lecciones");
  cards().forEach((card) => {
    const board = q(card, ".mini-board");
    assert.ok(board, "a board");
    assert.strictEqual(findAll(board, byClass("mb-arrow")).length, 1, "one arrow");
    assert.ok(findAll(board, byClass("mb-hl-best")).length === 1, "the piece to move is marked");
    assert.ok(/Ejemplo de /.test(board.getAttribute("aria-label")), board.getAttribute("aria-label"));
    assert.ok(text(card).includes("Jugada del ejemplo:"));
    assert.ok(text(q(card, ".museum-concept-text")).length > 100);
  });
  assert.ok(text(cards()[0]).includes("Doble ataque (horquilla)") && text(cards()[0]).includes("Nc7+"));
  const filter = q(root, '[role="group"]');
  const tagButtons = findAll(filter, (n) => n.tagName === "BUTTON");
  assert.ok(tagButtons.length >= 13);
  assert.strictEqual(tagButtons[0].getAttribute("aria-pressed"), "true");
  const pin = tagButtons.find((b) => b.getAttribute("data-tag") === "pin_or_skewer");
  assert.strictEqual(text(pin), "Clavada o ensartada");
  pin.click();
  assert.strictEqual(cards().length, 2);
  assert.strictEqual(text(q(root, ".museum-count")), "2 lecciones");
  assert.strictEqual(pin.getAttribute("aria-pressed"), "true");
  tagButtons[0].click();
  assert.strictEqual(cards().length, 14);
  // A related-mistake chip on a lesson filters by it.
  const chip = findAll(cards()[0], byClass("museum-pill-tag"))[0];
  assert.ok(chip.getAttribute("aria-label").startsWith("Ver lecciones sobre:"));
  chip.click();
  assert.ok(cards().length >= 1 && cards().length < 14);
  assert.ok(cards().every((card) => findAll(card, byClass("museum-pill-tag")).some((c) => text(c) === text(chip))));
  // The language switch.
  const filtered = cards().length;
  Ludus.i18n.setLanguage("en", { persist: false });
  const redrawn = findAll(panel(el, "school"), byClass("museum-concept"));
  assert.strictEqual(redrawn.length, filtered, "the filter survives the language switch");
  assert.ok(text(redrawn[0]).includes("Move of the example:"));
  assert.ok(text(panel(el, "school")).includes("All lessons"));
});

test("reading room: the real carousel starts, restarts on a topic, stops on leaving the tab and the screen", async () => {
  const env = createEnv({ language: "en" });
  const { Ludus, el } = env;
  const screen = Ludus.Screens.museum;
  screen.mount(el);
  Ludus.router.show("museum", { tab: "room" });
  const root = panel(el, "room");
  const controller = () => screen._state.room.controller;
  assert.ok(controller(), "a carousel is running");
  assert.strictEqual(findAll(root, byClass("rd-carousel")).length, 1);
  assert.strictEqual(controller().state().state, "running");
  assert.strictEqual(controller().state().count, 126);
  const duration = controller().state().durationMs;
  assert.ok(duration >= 6000 && duration <= 24000, `reading time ${duration}`);
  assert.strictEqual(text(q(root, ".museum-room-counter")), "Fact 1 of 126");
  assert.strictEqual(findAll(root, byClass("rd-btn")).length, 3, "previous, pause and next");
  assert.strictEqual(findAll(root, byClass("rd-carousel"))[0].getAttribute("aria-roledescription"), "carousel");
  // It only rotates while the tab is the one being read.
  q(root, ".rd-next").click();
  assert.strictEqual(text(q(root, ".museum-room-counter")), "Fact 2 of 126");
  // A topic restarts it with that category only.
  const mind = findAll(root, (n) => n.getAttribute("data-cat") === "mind")[0];
  const before = controller();
  mind.click();
  assert.notStrictEqual(controller(), before, "a new carousel");
  assert.strictEqual(controller().state().count, 9);
  assert.strictEqual(mind.getAttribute("aria-pressed"), "true");
  assert.strictEqual(findAll(root, byClass("rd-carousel")).length, 1, "the old one is gone");
  assert.strictEqual(text(q(root, ".museum-room-counter")), "Fact 1 of 9");
  // Leaving the tab destroys it; coming back starts a fresh one; leaving the screen stops it.
  tabButton(el, "timeline").click();
  assert.strictEqual(controller(), null);
  assert.strictEqual(findAll(root, byClass("rd-carousel")).length, 0);
  tabButton(el, "room").click();
  assert.ok(controller());
  Ludus.router.show("home");
  assert.strictEqual(controller(), null, "leaving the screen stops the reading");
  Ludus.router.show("museum");
  assert.ok(controller(), "and it is back when the room is the open tab");
  // The language switch redraws (the carousel follows the language by itself).
  Ludus.i18n.setLanguage("es", { persist: false });
  assert.ok(text(panel(el, "room")).includes("Sala de lectura"));
  assert.ok(controller());
  // A switch while the screen is hidden must not leave a carousel that never runs: it starts on show().
  Ludus.router.show("home");
  Ludus.i18n.setLanguage("en", { persist: false });
  assert.strictEqual(controller(), null, "nothing runs behind a hidden screen");
  Ludus.router.show("museum");
  assert.strictEqual(controller().state().state, "running", "it runs once the screen is shown again");
});

test("hash: cold start on #/museum/<tab>, hashchange, and a running session is not interrupted", async () => {
  const env = createEnv();
  const { Ludus, el, location } = env;
  location.hash = "#/museum/school";
  Ludus.Screens.museum.mount(el);
  location.hash = "";
  env.advance(5);
  assert.strictEqual(Ludus.router.current(), "museum");
  assert.strictEqual(tabButton(el, "school").getAttribute("aria-selected"), "true");
  location.hash = "#/museum/curiosities";
  env.fire("hashchange");
  assert.strictEqual(tabButton(el, "curiosities").getAttribute("aria-selected"), "true");
  location.hash = "#/museum";
  env.fire("hashchange");
  assert.strictEqual(tabButton(el, "timeline").getAttribute("aria-selected"), "true");
  Ludus.router.show("home");
  env.setGame({ isActive: () => true });
  location.hash = "#/museum/room";
  env.fire("hashchange");
  assert.strictEqual(Ludus.router.current(), "home", "not while a session runs");
  env.setGame({ isActive: () => false });
  env.fire("hashchange");
  assert.strictEqual(Ludus.router.current(), "museum");
  assert.strictEqual(tabButton(el, "room").getAttribute("aria-selected"), "true");
  Ludus.Screens.museum.destroy();
  Ludus.router.show("home");
  env.fire("hashchange");
  assert.strictEqual(Ludus.router.current(), "home", "nothing follows once destroyed");
});

test("language: every tab is redrawn in place and keeps its state", async () => {
  const { Ludus, el } = createEnv({ language: "es" });
  Ludus.Screens.museum.mount(el);
  Ludus.router.show("museum", { tab: "curiosities" });
  const root = () => panel(el, "curiosities");
  findAll(root(), (n) => n.getAttribute("data-cat") === "rules")[0].click();
  Ludus.i18n.setLanguage("en", { persist: false });
  assert.ok(text(el).includes("History and curiosities"));
  assert.strictEqual(tabButton(el, "curiosities").getAttribute("aria-selected"), "true");
  assert.strictEqual(findAll(root(), byClass("museum-fact-item")).length, 13, "the category is kept");
  assert.ok(text(findAll(root(), byClass("museum-fact-item"))[0]).length > 30);
  assert.ok(text(root()).includes("Curiosities"));
});

test("degrading: without Facts, Concepts, Insights, Reader or the kit the tabs say so and never throw", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const noFacts = createEnv({ skip: ["js/facts.js", "js/reader.js"] });
    noFacts.Ludus.Screens.museum.mount(noFacts.el);
    noFacts.Ludus.router.show("museum");
    assert.ok(text(panel(noFacts.el, "timeline")).includes("no está disponible"));
    tabButton(noFacts.el, "curiosities").click();
    assert.ok(text(panel(noFacts.el, "curiosities")).includes("no está disponible"));
    tabButton(noFacts.el, "room").click();
    assert.ok(text(panel(noFacts.el, "room")).includes("no está disponible"));
    tabButton(noFacts.el, "school").click();
    assert.strictEqual(findAll(panel(noFacts.el, "school"), byClass("museum-concept")).length, 14, "the school does not need the facts");

    const noSchool = createEnv({ skip: ["js/concepts.js", "js/insights.js"] });
    noSchool.Ludus.Screens.museum.mount(noSchool.el);
    noSchool.Ludus.router.show("museum", { tab: "school" });
    assert.ok(text(panel(noSchool.el, "school")).includes("no está disponible"));
    tabButton(noSchool.el, "timeline").click();
    assert.strictEqual(findAll(panel(noSchool.el, "timeline"), byClass("museum-event")).length, 36);

    const noReader = createEnv({ skip: ["js/reader.js"] });
    noReader.Ludus.Screens.museum.mount(noReader.el);
    noReader.Ludus.router.show("museum", { tab: "room" });
    assert.ok(text(panel(noReader.el, "room")).includes("no está disponible"));

    const noKit = createEnv({ skip: ["js/ui/kit.js"] });
    // Without the kit there is no ui at all: icons, mini boards and empty states are simply absent.
    noKit.Ludus.Screens.museum.mount(noKit.el);
    noKit.Ludus.router.show("museum", { tab: "school" });
    assert.strictEqual(findAll(panel(noKit.el, "school"), byClass("museum-concept")).length, 14);
    assert.strictEqual(findAll(panel(noKit.el, "school"), byClass("mini-board")).length, 0);
    tabButton(noKit.el, "curiosities").click();
    assert.strictEqual(findAll(panel(noKit.el, "curiosities"), byClass("museum-fact-item")).length, 24);
  } finally {
    console.error = originalError;
  }
});

runAll().then(() => {
  console.log(`museum-ui: ${passed} tests passed`);
}).catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
