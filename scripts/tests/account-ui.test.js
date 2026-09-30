// Tests for the Account screen (js/ui/account.js) against the real Profile, Settings and kit modules, a
// controllable stand-in for Auth (the real Auth flows, with Google and Drive faked, are in scripts/e2e/account.js
// and scripts/tests/auth.test.js) and the fake DOM of _uidom.js.
//
// Covers: text parity es / en; the pure helpers (export file name, byte sizes, storage usage, typed
// confirmations, "how long ago", picture URLs, import summaries and errors, the install state, the sync
// card's view model for every Auth state); and the screen: profile cards, create / rename / switch /
// delete (typed name) through the real dialogs, export through a Blob and a[download], import (dry run, then
// merge or replace, errors, the drop area) and the export -> wipe -> import round trip, delete-all with a
// typed word, the quiet "not configured" card, the sync card in every state with an escaped name, the
// install prompt, about, the language switch, and the degradation without Profile / Auth / the kit.

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { FakeDocument, findAll } = require("./_uidom.js");
const { createFakeLocalStorage } = require("./_fakedom.js");

const repoRoot = path.resolve(__dirname, "..", "..");
const SCRIPTS = ["js/ludus.js", "js/scoring.js", "js/settings.js", "js/profile.js", "js/auth.js", "js/ui/kit.js", "js/ui/account.js"];
const CLIENT_ID = "1234567890-abcdefghij.apps.googleusercontent.com";

function fenN(n) {
  const squareOf = (k) => (8 - (2 + Math.floor(k / 8))) * 8 + (k % 8);
  const i = n % 48;
  let j = Math.floor(n / 48) % 47;
  if (j >= i) j += 1;
  const board = Array(64).fill("");
  board[56] = "K";
  board[7] = "k";
  board[squareOf(i)] = "P";
  board[squareOf(j)] = "p";
  const rows = [];
  for (let r = 0; r < 8; r += 1) {
    let row = "";
    let empty = 0;
    for (let f = 0; f < 8; f += 1) {
      const piece = board[r * 8 + f];
      if (piece) { if (empty) row += empty; empty = 0; row += piece; } else { empty += 1; }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join("/")} w - - 0 1`;
}

function roundRecord(n, overrides) {
  return Object.assign({
    id: `r${n}`, ts: Date.now() - 3600000 - n * 1000, sessionId: "s1", sessionKind: "classic", source: "classic",
    positionId: `classic:${n}`, fen: fenN(n), sideToMove: "w", phase: "middlegame",
    userUci: "e2e4", userSan: "e4", bestUci: "d2d4", bestSan: "d4",
    points: 7.5, accuracy: 75, qualityCode: "good", winLossPct: 4, cpLoss: 35, isBest: false, rank: 2,
    onlyMove: false, timeSpentMs: 12000, hintsUsed: 0, timedOut: false, tags: [],
    lines: [{ uci: "d2d4", san: "d4", score: 30, pv: ["d2d4", "d7d5", "c2c4"] }],
    meta: { players: "A vs B", event: "Test", year: 1900 },
  }, overrides || {});
}

// A stand-in for Ludus.Auth whose state the test drives.
function makeFakeAuth(initial) {
  let snapshot = Object.assign({ status: "signed_out", user: null, error: "", needsReconnect: false, lastSyncAt: 0 }, initial || {});
  const listeners = [];
  const calls = [];
  return {
    calls,
    listeners,
    isConfigured: () => true,
    state: () => Object.assign({}, snapshot),
    status: () => snapshot.status,
    user: () => snapshot.user,
    needsReconnect: () => snapshot.needsReconnect,
    onChange(fn) { listeners.push(fn); return () => { const index = listeners.indexOf(fn); if (index >= 0) listeners.splice(index, 1); }; },
    signIn() { calls.push("signIn"); return Promise.resolve({ ok: true }); },
    signOut(options) { calls.push(options && options.revoke ? "signOut:revoke" : "signOut"); snapshot = Object.assign({}, snapshot, { status: "signed_out", user: null, needsReconnect: false, error: "" }); listeners.slice().forEach((fn) => fn(snapshot)); return Promise.resolve({ ok: true }); },
    syncNow() { calls.push("syncNow"); return Promise.resolve({ ok: true }); },
    // The link step of Auth (SEC-005): nothing is uploaded until a profile is chosen. `results` lets a test answer with a failure.
    results: {},
    linkProfile(id) { calls.push(`linkProfile:${id}`); return Promise.resolve(this.results.link || { ok: true, linked: true, profileId: id }); },
    unlinkProfile(id) { calls.push(`unlinkProfile:${id}`); return this.results.unlink || { ok: true, profileId: id }; },
    importFromDrive() { calls.push("importFromDrive"); return Promise.resolve(this.results.import || { ok: true, imported: true }); },
    preload() { calls.push("preload"); return Promise.resolve(true); },
    errorMessage: (code, lang) => `ERR:${code}:${lang}`,
    set(next) { snapshot = Object.assign({}, snapshot, next); listeners.slice().forEach((fn) => fn(snapshot)); },
  };
}

function createEnv({ language = "es", skip = [], configured = false, userAgent = "Mozilla/5.0 (X11; Linux x86_64)", standalone = false, storage } = {}) {
  const doc = new FakeDocument();
  const storageMap = new Map();
  const clock = { now: 0, seq: 0, timers: new Map() };
  const winListeners = new Map();
  const blobs = [];
  const downloads = [];
  class FakeBlob {
    constructor(parts, options) { this.parts = parts; this.type = options && options.type; blobs.push(this); }
  }
  const URLStub = { createObjectURL: (blob) => `blob:test/${blobs.indexOf(blob)}`, revokeObjectURL() {} };
  const sandbox = {
    console, Date, Math, JSON, Object, Array, String, Number, Promise, Map, Set, Intl, structuredClone, WeakMap, WeakSet, performance: { now: () => clock.now },
    URL: URLStub, Blob: FakeBlob,
    setTimeout(fn, ms) { clock.seq += 1; clock.timers.set(clock.seq, { at: clock.now + Number(ms || 0), fn }); return clock.seq; },
    clearTimeout(id) { clock.timers.delete(id); },
    document: doc,
    navigator: { languages: [language], language, userAgent, maxTouchPoints: 0, standalone },
    localStorage: storage || createFakeLocalStorage(storageMap),
    location: { hash: "", pathname: "/", search: "" },
    LUDUS_CONFIG: configured ? { googleClientId: CLIENT_ID } : {},
    addEventListener(type, fn) { if (!winListeners.has(type)) winListeners.set(type, []); winListeners.get(type).push(fn); },
    removeEventListener(type, fn) { winListeners.set(type, (winListeners.get(type) || []).filter((entry) => entry !== fn)); },
  };
  sandbox.window = sandbox;
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
  const el = mk("section", { id: "screen-account", class: "screen hidden" });
  const other = mk("section", { id: "screen-home", class: "screen hidden" });
  app.appendChild(el);
  app.appendChild(other);
  Ludus.router.register("account", { el, onShow: (params) => Ludus.Screens.account.show(params), onHide: () => Ludus.Screens.account.hide() });
  Ludus.router.register("home", { el: other });
  // Every a[download] the screen appends to the body is a download: record it.
  const originalAppend = doc.body.appendChild.bind(doc.body);
  doc.body.appendChild = (node) => {
    if (node && node.getAttribute && node.getAttribute("download")) downloads.push(node);
    return originalAppend(node);
  };
  const fire = (type, event) => (winListeners.get(type) || []).slice().forEach((fn) => fn(Object.assign({ type, preventDefault() { this.defaultPrevented = true; } }, event)));
  return { Ludus, doc, el, sandbox, storageMap, advance, blobs, downloads, fire };
}

const text = (node) => node.textContent.replace(/\s+/g, " ").trim();
const q = (root, selector) => root.querySelector(selector);
const qa = (root, selector) => root.querySelectorAll(selector);
const plain = (value) => JSON.parse(JSON.stringify(value));
const deepEq = (actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message);
const placeholders = (string) => Array.from(String(string).matchAll(/\{(\w+)\}/g), (m) => m[1]).sort().join(",");
const isHidden = (node) => node.hasAttribute("hidden");
const settle = async () => { for (let i = 0; i < 8; i += 1) await new Promise((resolve) => setImmediate(resolve)); };

function mountAndShow(env) {
  env.Ludus.Profile.ensureActive();
  env.Ludus.Screens.account.mount(env.el);
  env.Ludus.router.show("account");
  return env;
}

const modalOf = (env) => qa(env.doc.body, ".modal").pop() || null;
const modalButton = (env, kind) => q(modalOf(env), `.modal-actions .btn-${kind}`);
function closeModal(env) {
  const cancel = q(modalOf(env), ".modal-actions .btn-secondary");
  cancel.click();
  env.advance(400);
}
const card = (env, id) => q(env.el, `[data-card="${id}"]`);
const profileCards = (env) => qa(env.el, "li.account-profile");
const action = (root, name, id) => q(root, id ? `[data-action="${name}"][data-id="${id}"]` : `[data-action="${name}"]`);

function fileLike(name, content, size) {
  return { name, size: size === undefined ? content.length : size, text: () => Promise.resolve(content) };
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

test("text: es and en have the same keys and placeholders, none empty, all under account.; the title key resolves", () => {
  const { Ludus } = createEnv();
  const { es, en } = Ludus.Screens.account.TEXT;
  deepEq(Object.keys(es).sort(), Object.keys(en).sort());
  Object.keys(es).forEach((key) => {
    assert.ok(es[key].length > 0 && en[key].length > 0, `${key} is empty`);
    assert.strictEqual(placeholders(es[key]), placeholders(en[key]), `${key}: placeholders differ`);
    assert.ok(key.startsWith("account."), key);
  });
  assert.strictEqual(Ludus.Screens.account.titleKey, "account.title");
  assert.strictEqual(Ludus.i18n.t("account.title", null, "es"), "Cuenta y datos");
  assert.strictEqual(Ludus.i18n.t("account.title", null, "en"), "Account and data");
  assert.ok(es["account.sub"].includes("querés") && es["account.profiles.lead"].includes("elige"), "rioplatense");
  assert.ok(es["account.danger.word"] === "BORRAR" && en["account.danger.word"] === "DELETE");
});

test("export file name: dated, slugged, never empty, never unsafe", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.account.helpers;
  const ts = new Date(2026, 8, 30, 12, 0, 0).getTime();
  assert.strictEqual(h.dateStamp(ts), "2026-09-30");
  assert.strictEqual(h.exportFileName("one", "Ana", ts), "ludus-scaccorum-ana-2026-09-30.json");
  assert.strictEqual(h.exportFileName("all", "Ana", ts), "ludus-scaccorum-all-profiles-2026-09-30.json");
  assert.strictEqual(h.exportFileName("one", "José María ✓", ts), "ludus-scaccorum-jose-maria-2026-09-30.json");
  assert.strictEqual(h.exportFileName("one", "../../etc/passwd", ts), "ludus-scaccorum-etc-passwd-2026-09-30.json");
  assert.strictEqual(h.exportFileName("one", "???", ts), "ludus-scaccorum-progress-2026-09-30.json");
  assert.strictEqual(h.exportFileName("one", "", ts), "ludus-scaccorum-progress-2026-09-30.json");
  assert.ok(!/[^a-z0-9.-]/.test(h.exportFileName("one", "A/B\\C:D*E?\"<>|", ts)));
  assert.ok(h.exportFileName("one", "x".repeat(200), ts).length < 60);
  assert.strictEqual(h.slugify("  Ñandú  Grande "), "nandu-grande");
  assert.strictEqual(h.dateStamp(NaN).length, 10);
});

test("byte sizes and the storage indicator", () => {
  const { Ludus } = createEnv({ language: "en" });
  const h = Ludus.Screens.account.helpers;
  assert.strictEqual(h.formatBytes(0, "en"), "0 B");
  assert.strictEqual(h.formatBytes(512, "en"), "512 B");
  assert.strictEqual(h.formatBytes(2048, "en"), "2.0 KB");
  assert.strictEqual(h.formatBytes(300 * 1024, "en"), "300 KB");
  assert.strictEqual(h.formatBytes(5 * 1024 * 1024, "en"), "5.0 MB");
  assert.strictEqual(h.formatBytes(5 * 1024 * 1024, "es"), "5,0 MB");
  assert.strictEqual(h.formatBytes(-5, "en"), "0 B");
  const map = new Map([["ludus.a", "12345"], ["ludus.b", "xy"], ["other.key", "z".repeat(1000)]]);
  const usage = h.storageUsage(createFakeLocalStorage(map));
  assert.strictEqual(usage.available, true);
  assert.strictEqual(usage.keys, 2, "only the app's own keys count");
  assert.strictEqual(usage.bytes, ("ludus.a".length + 5 + "ludus.b".length + 2) * 2);
  assert.strictEqual(usage.limit, 5 * 1024 * 1024);
  const { createThrowingLocalStorage } = require("./_fakedom.js");
  assert.strictEqual(h.storageUsage(createThrowingLocalStorage()).available, false);
  assert.strictEqual(h.storageUsage(null).available, false);
});

test("typed confirmations: case, accents and spaces around the name do not matter, an empty answer never matches", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.account.helpers;
  assert.strictEqual(h.confirmationMatches("Ana", "Ana"), true);
  assert.strictEqual(h.confirmationMatches("  ana ", "Ana"), true);
  assert.strictEqual(h.confirmationMatches("ANA", "Ana"), true);
  assert.strictEqual(h.confirmationMatches("Ana  María", "Ana María"), true);
  assert.strictEqual(h.confirmationMatches("Ana", "Anna"), false);
  assert.strictEqual(h.confirmationMatches("Ana ", "Ana M"), false);
  assert.strictEqual(h.confirmationMatches("", ""), false);
  assert.strictEqual(h.confirmationMatches("   ", "   "), false);
  assert.strictEqual(h.confirmationMatches(null, "Ana"), false);
  assert.strictEqual(h.confirmationMatches("borrar", "BORRAR"), true);
  assert.strictEqual(h.confirmationMatches("José", "José"), true, "composed and decomposed accents are the same name");
});

test("formatAgo: just now, minutes, hours, then a date; empty for no time", () => {
  const { Ludus } = createEnv({ language: "en" });
  const h = Ludus.Screens.account.helpers;
  const now = Date.UTC(2026, 8, 30, 12, 0, 0);
  assert.strictEqual(h.formatAgo(now - 20000, now, "en"), "just now");
  assert.strictEqual(h.formatAgo(now - 5 * 60000, now, "en"), "5 min ago");
  assert.strictEqual(h.formatAgo(now - 3 * 3600000, now, "en"), "3 h ago");
  assert.ok(/2026|Sep/.test(h.formatAgo(now - 3 * 86400000, now, "en")), "a date after a day");
  assert.strictEqual(h.formatAgo(0, now, "en"), "");
  assert.strictEqual(h.formatAgo("x", now, "en"), "");
  assert.strictEqual(h.formatAgo(now + 5000, now, "en"), "just now", "a clock a little ahead is not negative");
  Ludus.i18n.setLanguage("es", { persist: false });
  assert.strictEqual(h.formatAgo(now - 5 * 60000, now, "es"), "hace 5 min");
});

test("safePictureUrl: only https on googleusercontent.com, never anything else", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.account.helpers;
  assert.strictEqual(h.safePictureUrl("https://lh3.googleusercontent.com/a/abc=s96-c"), "https://lh3.googleusercontent.com/a/abc=s96-c");
  ["http://lh3.googleusercontent.com/a", "https://evil.com/a.png", "https://googleusercontent.com.evil.com/a", "javascript:alert(1)", "data:image/png;base64,AAAA",
    "https://lh3.googleusercontent.com/a\"onerror=\"x", "//lh3.googleusercontent.com/a", "https://lh3.googleusercontent.com.evil.com/", "", null, undefined, 42, {}].forEach((bad) => {
    assert.strictEqual(h.safePictureUrl(bad), "", String(bad));
  });
  assert.strictEqual(h.safePictureUrl(`https://lh3.googleusercontent.com/${"a".repeat(600)}`), "", "too long");
});

test("import summary and errors: counts with singular forms; every Profile error code has words, never a raw key", () => {
  const { Ludus } = createEnv({ language: "en" });
  const h = Ludus.Screens.account.helpers;
  assert.strictEqual(h.importSummaryText({ profiles: 1, rounds: 340, sessions: 1, cards: 0 }), "1 profile · 340 positions · 1 session · 0 notebook cards");
  assert.strictEqual(h.importSummaryText({ profiles: 2, rounds: 1, sessions: 12, cards: 1 }), "2 profiles · 1 position · 12 sessions · 1 notebook card");
  assert.strictEqual(h.importSummaryText(null), "0 profiles · 0 positions · 0 sessions · 0 notebook cards");
  deepEq(h.importCounts({ profiles: 2, rounds: -3, sessions: "x" }).map((item) => item.n), [2, 0, 0, 0]);
  ["too-large", "invalid-json", "invalid-format", "unsupported-version", "no-profiles", "limit", "storage-failed", "read-only", "invalid-mode", "no-such-profile"].forEach((code) => {
    const message = h.profileErrorText(code);
    assert.ok(message.length > 10 && !message.includes("profile.import.error") && !message.includes("{"), `${code}: ${message}`);
  });
  assert.ok(h.profileErrorText("limit").includes("(4 maximum)"), "the limit is named");
  assert.strictEqual(h.profileErrorText("invalid-json"), "The file is not valid JSON.");
  assert.strictEqual(h.profileErrorText("storage"), "Could not save: browser storage is full or blocked.");
  assert.strictEqual(h.profileErrorText("something-new"), "The action could not be completed.");
  assert.strictEqual(h.profileErrorText(""), "The action could not be completed.");
  assert.strictEqual(h.profileErrorText(undefined), "The action could not be completed.");
});

test("installState: installed, promptable, iOS (also an iPad that looks like a Mac), or the generic hint", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.account.helpers;
  assert.strictEqual(h.installState({ standalone: true, canPrompt: true }), "installed");
  assert.strictEqual(h.installState({ matchMedia: () => ({ matches: true }), userAgent: "x" }), "installed");
  assert.strictEqual(h.installState({ matchMedia: () => ({ matches: false }), canPrompt: true }), "prompt");
  assert.strictEqual(h.installState({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" }), "ios");
  assert.strictEqual(h.installState({ userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)" }), "ios");
  assert.strictEqual(h.installState({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 5 }), "ios");
  assert.strictEqual(h.installState({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 0 }), "other");
  assert.strictEqual(h.installState({ userAgent: "Mozilla/5.0 (X11; Linux x86_64)" }), "other");
  assert.strictEqual(h.installState({ matchMedia() { throw new Error("no"); }, standalone: false }), "other");
  assert.strictEqual(h.installState(), "other");
});

test("syncModel: what the sync card offers in every Auth state", () => {
  const { Ludus } = createEnv();
  const h = Ludus.Screens.account.helpers;
  const user = { name: "Ana", email: "ana@example.com", picture: "", sub: "1" };
  const out = h.syncModel({ status: "signed_out", user: null });
  assert.deepStrictEqual([out.showSignIn, out.canSync, out.canReconnect, out.canSignOut, out.busy, out.remembered], [true, false, false, false, false, false]);
  const connecting = h.syncModel({ status: "signing_in", user: null });
  assert.deepStrictEqual([connecting.showSignIn, connecting.busy, connecting.tone], [false, true, "info"]);
  const inn = h.syncModel({ status: "signed_in", user, needsReconnect: false, lastSyncAt: 5 });
  assert.deepStrictEqual([inn.showSignIn, inn.canSync, inn.canReconnect, inn.canSignOut, inn.tone, inn.lastSyncAt], [false, true, false, true, "success", 5]);
  const syncing = h.syncModel({ status: "syncing", user });
  assert.deepStrictEqual([syncing.canSync, syncing.busy, syncing.canSignOut], [false, true, true]);
  const failed = h.syncModel({ status: "error", user, error: "network", needsReconnect: false });
  assert.deepStrictEqual([failed.tone, failed.error, failed.canSync, failed.canReconnect], ["danger", "network", true, false]);
  const expired = h.syncModel({ status: "error", user, error: "reconnect-required", needsReconnect: true });
  assert.deepStrictEqual([expired.canReconnect, expired.canSync], [true, false]);
  const remembered = h.syncModel({ status: "signed_out", user, needsReconnect: true });
  assert.deepStrictEqual([remembered.remembered, remembered.canReconnect, remembered.showSignIn, remembered.canSignOut, remembered.tone], [true, true, false, true, "warn"]);
  const failedSignIn = h.syncModel({ status: "error", user: null, error: "popup-blocked" });
  assert.deepStrictEqual([failedSignIn.showSignIn, failedSignIn.canSync, failedSignIn.tone], [true, false, "danger"]);
  assert.strictEqual(h.syncModel(null).status, "signed_out");
  assert.strictEqual(h.syncModel({ status: "bogus" }).status, "signed_out");
});

test("tCount picks the singular form only when the language has one", () => {
  const { Ludus } = createEnv({ language: "en" });
  const h = Ludus.Screens.account.helpers;
  assert.strictEqual(h.tCount("account.profile.positions", 1), "1 position played");
  assert.strictEqual(h.tCount("account.profile.positions", 5), "5 positions played");
  assert.strictEqual(h.tCount("account.profile.positions", 0), "0 positions played");
});

// ---------- profiles ----------

test("profiles: a card per profile with avatar, name, level, positions, the active marker and its actions", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const P = Ludus.Profile;
  const first = P.active();
  [0, 1, 2].forEach((n) => assert.ok(P.recordRound(roundRecord(n))));
  const second = P.create({ name: "Bruno" });
  Ludus.Screens.account.render();
  const cards = profileCards(env);
  assert.strictEqual(cards.length, 2);
  const one = cards[0];
  assert.strictEqual(one.getAttribute("data-active"), "true");
  assert.strictEqual(text(q(one, ".account-profile-name")), first.name);
  assert.ok(q(one, ".avatar") && q(one, ".level-badge"));
  assert.ok(text(one).includes("3 positions played"), text(one));
  assert.ok(text(one).includes("Active"));
  assert.ok(!action(one, "use"), "the active profile has no switch button");
  assert.ok(action(one, "rename") && action(one, "delete"));
  const two = cards[1];
  assert.strictEqual(two.getAttribute("data-active"), "false");
  assert.strictEqual(text(q(two, ".account-profile-name")), "Bruno");
  assert.ok(text(two).includes("No positions played yet"));
  assert.ok(action(two, "use"));
  // every button names the profile it acts on
  qa(two, "button").forEach((button) => assert.ok(button.getAttribute("aria-label").includes("Bruno"), button.getAttribute("aria-label")));
  assert.strictEqual(text(q(card(env, "profiles"), ".chip")), "2 of 4 profiles");
  // the "add" tile is there while there is room
  assert.ok(q(el, "[data-action=\"add\"]"));
  assert.ok(second);
});

test("profiles: switching makes the other one active and says so", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const toasts = [];
  Ludus.ui.toast = (message) => { toasts.push(message); return null; };
  const second = Ludus.Profile.create({ name: "Bruno" });
  Ludus.Screens.account.render();
  action(el, "use", second.id).click();
  assert.strictEqual(Ludus.Profile.active().id, second.id);
  assert.strictEqual(profileCards(env).find((c) => c.getAttribute("data-active") === "true").getAttribute("data-profile-id"), second.id, "repainted by profile:changed");
  assert.deepStrictEqual(toasts, ["You are now playing as Bruno"]);
  assert.ok(env.doc.activeElement && env.doc.activeElement.classList.contains("account-profile-name"), "focus lands on the profile that is now active");
});

test("create: the dialog asks for a name and a colour, refuses an empty name, creates, switches when asked", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const toasts = [];
  Ludus.ui.toast = (message) => { toasts.push(message); return null; };
  const before = Ludus.Profile.list().length;
  q(el, "[data-action=\"add\"]").click();
  const modal = modalOf(env);
  assert.ok(modal && text(q(modal, ".modal-title")) === "New profile");
  const input = q(modal, "input[type=\"text\"]");
  assert.ok(input && input.getAttribute("maxlength") === "24");
  assert.strictEqual(qa(modal, ".account-swatch-input").length, Ludus.Profile.constants.PALETTE.length);
  assert.strictEqual(qa(modal, ".account-swatch-input").filter((radio) => radio.checked).length, 1, "a colour is preselected");
  assert.strictEqual(qa(modal, "[role=\"radiogroup\"]").length, 1);
  // QA A11Y-026: the swatches are named by colour, every one differently, never "Colour 3".
  const swatchNames = qa(modal, ".account-swatch-input").map((radio) => radio.getAttribute("aria-label"));
  assert.strictEqual(new Set(swatchNames).size, swatchNames.length, "distinct names");
  assert.ok(swatchNames.every((name) => !/^Colour \d+$/.test(name)), `named by colour: ${swatchNames.join(", ")}`);
  assert.deepStrictEqual(swatchNames.slice(0, 3), ["Green", "Brown", "Blue"]);
  // empty name: stays open with an alert, nothing created
  modalButton(env, "primary").click();
  assert.ok(modalOf(env), "still open");
  const error = q(modal, ".field-error");
  assert.ok(!isHidden(error) && text(error) === "Type a name for the profile.");
  assert.strictEqual(input.getAttribute("aria-invalid"), "true");
  assert.strictEqual(Ludus.Profile.list().length, before);
  // a name and another colour
  input.value = "  Carla  ";
  const swatches = qa(modal, ".account-swatch-input");
  swatches[3].checked = true;
  swatches[3].dispatch("change");
  modalButton(env, "primary").click();
  env.advance(400);
  assert.ok(!modalOf(env) || !env.doc.body.contains(modalOf(env)), "closed");
  const created = Ludus.Profile.list().find((entry) => entry.name === "Carla");
  assert.ok(created, "the name is trimmed and saved");
  assert.strictEqual(created.color, Ludus.Profile.constants.PALETTE[3]);
  assert.strictEqual(Ludus.Profile.active().id, created.id, "the switch box was ticked by default");
  assert.deepStrictEqual(toasts, ["Profile created: Carla"]);
  assert.strictEqual(profileCards(env).length, before + 1);
  // not switching
  q(el, "[data-action=\"add\"]").click();
  const again = modalOf(env);
  q(again, "input[type=\"text\"]").value = "Dani";
  const box = q(again, "input[type=\"checkbox\"]");
  box.checked = false;
  modalButton(env, "primary").click();
  env.advance(400);
  assert.strictEqual(Ludus.Profile.active().id, created.id, "the active profile did not change");
});

test("create: at the limit there is no add tile, only the note; Enter in the name field creates too", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  ["Bruno", "Carla", "Dani"].forEach((name) => assert.ok(Ludus.Profile.create({ name })));
  Ludus.Screens.account.render();
  assert.strictEqual(profileCards(env).length, 4);
  assert.ok(!q(el, "[data-action=\"add\"]"));
  assert.ok(text(card(env, "profiles")).includes("limit of 4 profiles"));
  assert.strictEqual(text(q(card(env, "profiles"), ".chip")), "4 of 4 profiles");
  // free one slot and use Enter
  Ludus.Profile.remove(Ludus.Profile.list()[3].id);
  Ludus.Screens.account.render();
  q(el, "[data-action=\"add\"]").click();
  const modal = modalOf(env);
  const input = q(modal, "input[type=\"text\"]");
  input.value = "Elena";
  const event = input.dispatch("keydown", { key: "Enter" });
  assert.ok(event.defaultPrevented, "Enter does not submit the form");
  env.advance(400);
  assert.ok(Ludus.Profile.list().some((entry) => entry.name === "Elena"));
});

test("create: a failure of the store is explained inside the dialog and the dialog stays open", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  q(el, "[data-action=\"add\"]").click();
  const modal = modalOf(env);
  q(modal, "input[type=\"text\"]").value = "Fran";
  const realCreate = Ludus.Profile.create;
  const realLast = Ludus.Profile.lastError;
  Ludus.Profile.create = () => null;
  Ludus.Profile.lastError = () => "storage";
  modalButton(env, "primary").click();
  assert.ok(text(q(modal, ".field-error")).includes("storage is full or blocked"));
  assert.ok(env.doc.body.contains(modal));
  Ludus.Profile.create = realCreate;
  Ludus.Profile.lastError = realLast;
  closeModal(env);
});

test("rename: prefilled, trims, refuses empty, updates the card and gives focus back to the button", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const toasts = [];
  Ludus.ui.toast = (message) => { toasts.push(message); return null; };
  const me = Ludus.Profile.active();
  action(el, "rename", me.id).click();
  const modal = modalOf(env);
  const input = q(modal, "input[type=\"text\"]");
  assert.strictEqual(input.value, me.name);
  input.value = "   ";
  modalButton(env, "primary").click();
  assert.ok(env.doc.body.contains(modal) && text(q(modal, ".field-error")) === "Type a name for the profile.");
  input.value = "  Alicia ";
  modalButton(env, "primary").click();
  env.advance(400);
  assert.strictEqual(Ludus.Profile.active().name, "Alicia");
  assert.strictEqual(text(q(profileCards(env)[0], ".account-profile-name")), "Alicia");
  assert.deepStrictEqual(toasts, ["Now called Alicia"]);
  assert.ok(env.doc.activeElement === action(el, "rename", me.id), "focus returns to the Rename button of the rebuilt card");
});

test("delete: the confirm button stays off until the name is typed, then removes the profile", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const toasts = [];
  Ludus.ui.toast = (message) => { toasts.push(message); return null; };
  const bruno = Ludus.Profile.create({ name: "Bruno Díaz" });
  Ludus.Profile.recordRound(roundRecord(1), bruno.id);
  Ludus.Profile.recordRound(Object.assign(roundRecord(2), { profileId: bruno.id }));
  Ludus.Screens.account.render();
  action(el, "delete", bruno.id).click();
  const modal = modalOf(env);
  assert.strictEqual(modal.getAttribute("role"), "alertdialog");
  assert.ok(text(q(modal, ".modal-title")).includes("Bruno Díaz"));
  // the dialog is described by the consequence, not by the whole form (the typed-name field, the export button)
  const describedIds = String(modal.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
  assert.ok(describedIds.length >= 1, "the alert dialog has a description");
  const described = describedIds.map((id) => qa(modal, "p").find((node) => node.id === id || node.getAttribute("id") === id));
  assert.ok(described.every(Boolean) && described.some((node) => text(node).includes("erased from this device for good")), "the consequence paragraph is the description");
  assert.ok(!described.some((node) => node.querySelector && node.querySelector("input")), "the form is not");
  const confirm = modalButton(env, "danger");
  assert.strictEqual(confirm.hasAttribute("disabled"), true, "off at first");
  assert.ok(text(modal).includes("This cannot be undone"));
  const input = q(modal, "input[type=\"text\"]");
  input.value = "Bruno";
  input.dispatch("input");
  assert.strictEqual(confirm.hasAttribute("disabled"), true, "a part of the name is not enough");
  input.value = "  bruno díaz ";
  input.dispatch("input");
  assert.strictEqual(confirm.hasAttribute("disabled"), false, "case and spaces are forgiven");
  // a click on a disabled-looking button whose state was forced still verifies the name
  input.value = "nope";
  confirm.click();
  assert.ok(Ludus.Profile.list().some((entry) => entry.id === bruno.id), "the handler checks the name again");
  input.value = "Bruno Díaz";
  input.dispatch("input");
  confirm.click();
  env.advance(400);
  assert.ok(!Ludus.Profile.list().some((entry) => entry.id === bruno.id));
  assert.strictEqual(profileCards(env).length, 1);
  assert.deepStrictEqual(toasts, ["Profile deleted: Bruno Díaz"]);
});

test("delete: the only profile can be deleted (a fresh one takes its place); a copy can be downloaded first", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const me = Ludus.Profile.active();
  Ludus.Profile.recordRound(roundRecord(1));
  Ludus.Screens.account.render();
  action(el, "delete", me.id).click();
  const modal = modalOf(env);
  assert.ok(text(modal).includes("the only profile"));
  const downloadBtn = qa(modal, "button").find((button) => text(button).includes("Download a copy first"));
  downloadBtn.click();
  assert.strictEqual(env.downloads.length, 1, "the copy is offered from inside the dialog");
  assert.ok(env.downloads[0].getAttribute("download").startsWith("ludus-scaccorum-"));
  const input = q(modal, "input[type=\"text\"]");
  input.value = me.name;
  input.dispatch("input");
  modalButton(env, "danger").click();
  env.advance(400);
  const left = Ludus.Profile.list();
  assert.strictEqual(left.length, 1);
  assert.notStrictEqual(left[0].id, me.id, "a new empty profile");
  assert.strictEqual(Ludus.Profile.stats(left[0].id).totalPositions, 0);
});

test("delete: Escape and Cancel change nothing", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const me = Ludus.Profile.active();
  action(el, "delete", me.id).click();
  closeModal(env);
  assert.strictEqual(Ludus.Profile.list().length, 1);
  action(el, "delete", me.id).click();
  const modal = modalOf(env);
  modal.parentNode.dispatch("keydown", { key: "Escape", target: modal });
  env.advance(400);
  assert.strictEqual(Ludus.Profile.list().length, 1);
});

// ---------- your data ----------

test("export: a dated JSON file through a Blob and a[download]; one profile or all of them", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const toasts = [];
  Ludus.ui.toast = (message) => { toasts.push(message); return null; };
  const me = Ludus.Profile.active();
  Ludus.Profile.rename(me.id, "Ana");
  [0, 1, 2, 3].forEach((n) => Ludus.Profile.recordRound(roundRecord(n)));
  Ludus.Screens.account.render();
  assert.ok(!action(el, "export-all"), "one profile: no 'all' button");
  action(el, "export-active").click();
  assert.strictEqual(env.downloads.length, 1);
  const link = env.downloads[0];
  assert.match(link.getAttribute("download"), /^ludus-scaccorum-ana-\d{4}-\d{2}-\d{2}\.json$/);
  assert.ok(link.getAttribute("href").startsWith("blob:"));
  assert.ok(!link.isConnected, "the temporary link is gone");
  const doc = JSON.parse(env.blobs[0].parts.join(""));
  assert.strictEqual(doc.kind, "ludus-progress");
  assert.strictEqual(doc.profiles.length, 1);
  assert.strictEqual(doc.profiles[0].data.rounds.length, 4);
  assert.strictEqual(env.blobs[0].type, "application/json");
  assert.ok(text(q(el, "[data-msg=\"data\"]")).includes("Downloaded ludus-scaccorum-ana-"));
  assert.strictEqual(toasts.length, 1);
  // two profiles: both buttons
  Ludus.Profile.create({ name: "Bruno" });
  Ludus.Screens.account.render();
  action(el, "export-all").click();
  assert.match(env.downloads[1].getAttribute("download"), /^ludus-scaccorum-all-profiles-/);
  assert.strictEqual(JSON.parse(env.blobs[1].parts.join("")).profiles.length, 2);
});

test("export: without Blob support the person is told instead of getting nothing", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { el, sandbox } = env;
  sandbox.Blob = undefined;
  action(el, "export-active").click();
  assert.strictEqual(env.downloads.length, 0);
  const message = q(el, "[data-msg=\"data\"] .account-msg");
  assert.ok(message.classList.contains("is-error") && message.getAttribute("role") === "alert");
  assert.ok(text(message).includes("could not be created"));
});

test("storage indicator: a meter with a name and the words", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const meter = q(env.el, ".account-storage [role=\"progressbar\"]");
  assert.ok(meter && meter.getAttribute("aria-label") === "Storage space used by Ludus Scaccorum");
  assert.match(text(q(env.el, ".account-storage")), /You use .* of about 5\.0 MB that the browser allows\./);
  const blocked = mountAndShow(createEnv({ language: "en", storage: require("./_fakedom.js").createThrowingLocalStorage() }));
  assert.strictEqual(q(blocked.el, "[data-storage]").getAttribute("data-storage"), "unavailable");
});

test("import: a dry run shows what is in the file, nothing is written until the person chooses, merge keeps both", async () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const toasts = [];
  Ludus.ui.toast = (message) => { toasts.push(message); return null; };
  // A backup made elsewhere: another device's profile with 3 positions.
  const other = Ludus.Profile.createInstance({ storage: { get: () => null, set: () => true, remove: () => true, keys: () => [] }, bus: { on() {}, emit() {} }, listenStorage: false });
  const source = Ludus.Profile.createInstance({ storage: (() => { const m = new Map(); return { get: (k, f) => (m.has(k) ? JSON.parse(m.get(k)) : f), set: (k, v) => { m.set(k, JSON.stringify(v)); return true; }, remove: (k) => m.delete(k), keys: (p) => Array.from(m.keys()).filter((k) => k.startsWith(p)) }; })(), bus: { on() {}, emit() {} }, listenStorage: false, i18n: Ludus.i18n });
  source.create({ name: "Imported" });
  [10, 11, 12].forEach((n) => source.recordRound(roundRecord(n)));
  const backup = source.exportJSON("all");
  assert.ok(other);
  Ludus.Profile.recordRound(roundRecord(1));
  const input = q(el, "input[type=\"file\"]");
  assert.ok(input.getAttribute("accept").includes(".json"));
  input.files = [fileLike("mine.json", backup)];
  input.dispatch("change");
  await settle();
  const review = q(el, ".account-import-review");
  assert.ok(review, "the review replaces the drop area");
  assert.ok(text(review).includes("mine.json"));
  assert.strictEqual(text(q(review, "[data-found=\"profiles\"]")), "1 profile");
  assert.strictEqual(text(q(review, "[data-found=\"rounds\"]")), "3 positions");
  assert.strictEqual(Ludus.Profile.list().length, 1, "a dry run wrote nothing");
  assert.strictEqual(Ludus.Profile.stats().totalPositions, 1);
  assert.strictEqual(env.doc.activeElement, q(el, "[data-import-review]"), "focus moves to the review");
  const modes = qa(review, "input[type=\"radio\"]");
  deepEq(modes.map((radio) => radio.getAttribute("value")), ["merge", "replace"]);
  assert.strictEqual(modes[0].checked, true, "merge is the default");
  assert.ok(text(review).includes("Recommended"));
  action(review, "import-run").click();
  assert.strictEqual(Ludus.Profile.list().length, 2, "the profile from the file was added");
  assert.ok(!q(el, ".account-import-review") && q(el, ".account-drop"), "back to the drop area");
  assert.ok(text(q(el, "[data-msg=\"data\"]")).includes("Done: 1 profile and 3 positions loaded."));
  assert.strictEqual(toasts.length, 1);
  assert.strictEqual(profileCards(env).length, 2, "the profile list repainted");
  assert.strictEqual(Ludus.Profile.stats(Ludus.Profile.list().find((entry) => entry.name === "Imported").id).totalPositions, 3);
});

test("import: cancel goes back to the drop area with focus on the picker; the drop area takes a dropped file", async () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  Ludus.Profile.recordRound(roundRecord(1));
  const backup = Ludus.Profile.exportJSON("all");
  const zone = q(el, ".account-drop");
  const over = zone.dispatch("dragover", {});
  assert.ok(over.defaultPrevented && zone.classList.contains("is-over"));
  zone.dispatch("dragleave", {});
  assert.ok(!zone.classList.contains("is-over"));
  const drop = zone.dispatch("drop", { dataTransfer: { files: [fileLike("dropped.json", backup)] } });
  assert.ok(drop.defaultPrevented);
  await settle();
  assert.ok(q(el, ".account-import-review"));
  action(el, "import-cancel").click();
  assert.ok(!q(el, ".account-import-review"));
  assert.ok(env.doc.activeElement === q(el, "[data-import-pick]"));
  // a drop with no file does nothing
  q(el, ".account-drop").dispatch("drop", { dataTransfer: { files: [] } });
  await settle();
  assert.ok(!q(el, ".account-import-review"));
});

test("import: replace overwrites the matching profile; export -> wipe -> import restores everything (round trip)", async () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const me = Ludus.Profile.active();
  [0, 1, 2, 3, 4].forEach((n) => Ludus.Profile.recordRound(roundRecord(n)));
  const backup = Ludus.Profile.exportJSON("all");
  // things change afterwards
  Ludus.Profile.recordRound(roundRecord(50));
  assert.strictEqual(Ludus.Profile.stats(me.id).totalPositions, 6);
  const input = q(el, "input[type=\"file\"]");
  input.files = [fileLike("backup.json", backup)];
  input.dispatch("change");
  await settle();
  const replace = qa(el, ".account-import-review input[type=\"radio\"]")[1];
  replace.checked = true;
  replace.dispatch("change");
  action(el, "import-run").click();
  assert.strictEqual(Ludus.Profile.stats(me.id).totalPositions, 5, "the file wins on a match");
  // the whole round trip: wipe everything, then load the file
  Ludus.Profile.wipe("all");
  assert.strictEqual(Ludus.Profile.list().length, 0);
  Ludus.Screens.account.render();
  const again = q(el, "input[type=\"file\"]");
  again.files = [fileLike("backup.json", backup)];
  again.dispatch("change");
  await settle();
  action(el, "import-run").click();
  assert.strictEqual(Ludus.Profile.list().length, 1);
  assert.strictEqual(Ludus.Profile.stats(Ludus.Profile.list()[0].id).totalPositions, 5);
  assert.strictEqual(Ludus.Profile.list()[0].name, me.name);
});

test("import: a bad file is explained in words and changes nothing (not JSON, not a backup, too big, unreadable, over the limit)", async () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const before = Ludus.Profile.exportJSON("all");
  const attempt = async (file) => {
    const input = q(el, "input[type=\"file\"]");
    input.files = [file];
    input.dispatch("change");
    await settle();
    return q(el, "[data-msg=\"data\"] .account-msg");
  };
  let message = await attempt(fileLike("x.json", "{ this is not json"));
  assert.ok(message.classList.contains("is-error") && message.getAttribute("role") === "alert");
  assert.strictEqual(text(message), "The file is not valid JSON.");
  message = await attempt(fileLike("x.json", JSON.stringify({ hello: "world" })));
  assert.ok(text(message).includes("does not look like a Ludus Scaccorum backup"));
  message = await attempt(fileLike("big.json", "{}", 6 * 1024 * 1024));
  assert.ok(text(message).includes("too large"));
  message = await attempt({ name: "x.json", size: 2, text: () => Promise.reject(new Error("read failed")) });
  assert.ok(text(message).includes("could not read that file"), text(message));
  assert.ok(!q(el, ".account-import-review"), "no review for a bad file");
  assert.ok(q(el, ".account-drop"), "the drop area is still there to try again");
  assert.strictEqual(Ludus.Profile.exportJSON("all").length, before.length, "nothing changed");
  // a valid file that does not fit: 4 profiles here, 2 more in the file
  ["Bruno", "Carla", "Dani"].forEach((name) => Ludus.Profile.create({ name }));
  const source = Ludus.Profile.createInstance({ storage: (() => { const m = new Map(); return { get: (k, f) => (m.has(k) ? JSON.parse(m.get(k)) : f), set: (k, v) => { m.set(k, JSON.stringify(v)); return true; }, remove: (k) => m.delete(k), keys: (p) => Array.from(m.keys()).filter((k) => k.startsWith(p)) }; })(), bus: { on() {}, emit() {} }, listenStorage: false, i18n: Ludus.i18n });
  source.create({ name: "Zed" });
  source.create({ name: "Yara" });
  Ludus.Screens.account.render();
  const input = q(el, "input[type=\"file\"]");
  input.files = [fileLike("two.json", source.exportJSON("all"))];
  input.dispatch("change");
  await settle();
  action(el, "import-run").click();
  const limit = q(el, "[data-msg=\"data\"] .account-msg");
  assert.ok(limit && text(limit).includes("no room for more profiles (4 maximum)"), limit && text(limit));
  assert.strictEqual(Ludus.Profile.list().length, 4);
  assert.ok(q(el, ".account-import-review"), "the review stays so the person can choose again or cancel");
});

test("delete all: needs the typed word in the current language, then wipes profiles, settings and app keys (not the language)", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el, storageMap } = env;
  const toasts = [];
  Ludus.ui.toast = (message) => { toasts.push(message); return null; };
  Ludus.Profile.recordRound(roundRecord(1));
  Ludus.Profile.create({ name: "Bruno" });
  Ludus.Settings.set("board.theme", "forest");
  Ludus.storage.set("ludus.classics.mix.v1", { a: 1 });
  Ludus.storage.set("ludus.language", "en");
  Ludus.storage.set("not.ours", 1);
  assert.ok(storageMap.has("ludus.settings.v2"));
  action(el, "delete-all").click();
  const modal = modalOf(env);
  assert.ok(text(modal).includes("To confirm, type DELETE"));
  const confirm = modalButton(env, "danger");
  assert.strictEqual(confirm.hasAttribute("disabled"), true);
  const input = q(modal, "input[type=\"text\"]");
  input.value = "BORRAR";
  input.dispatch("input");
  assert.strictEqual(confirm.hasAttribute("disabled"), true, "the Spanish word does not work in English");
  input.value = "delete";
  input.dispatch("input");
  assert.strictEqual(confirm.hasAttribute("disabled"), false);
  confirm.click();
  env.advance(400);
  const left = Ludus.Profile.list();
  assert.strictEqual(left.length, 1, "a fresh profile so the app always has one");
  assert.strictEqual(left[0].name, "Player");
  assert.strictEqual(Ludus.Profile.stats(left[0].id).totalPositions, 0);
  assert.strictEqual(Ludus.Settings.get("board.theme"), "walnut");
  assert.strictEqual(env.doc.documentElement.getAttribute("data-board-theme"), "walnut");
  assert.ok(!storageMap.has("ludus.classics.mix.v1"));
  assert.ok(storageMap.has("ludus.language"), "the interface language survives");
  assert.ok(storageMap.has("not.ours"), "other sites' keys are not ours to touch");
  assert.deepStrictEqual(toasts, ["All data on this device was deleted."]);
  assert.strictEqual(profileCards(env).length, 1);
  assert.ok(env.doc.activeElement === action(el, "delete-all"), "focus returns to the button");
});

test("delete all: in Spanish the word is BORRAR; Cancel wipes nothing", () => {
  const env = mountAndShow(createEnv({ language: "es" }));
  const { Ludus, el } = env;
  Ludus.Profile.recordRound(roundRecord(1));
  action(el, "delete-all").click();
  const modal = modalOf(env);
  assert.ok(text(modal).includes("escribí BORRAR"));
  closeModal(env);
  assert.strictEqual(Ludus.Profile.stats().totalPositions, 1);
  action(el, "delete-all").click();
  const again = modalOf(env);
  const input = q(again, "input[type=\"text\"]");
  input.value = "borrar";
  input.dispatch("input");
  modalButton(env, "danger").click();
  env.advance(400);
  assert.strictEqual(Ludus.Profile.stats().totalPositions, 0);
});

// ---------- sync ----------

test("sync: not configured is a quiet card with the sentence, the owner's pointer and no sign-in button", () => {
  const env = mountAndShow(createEnv({ language: "en", configured: false }));
  const { el } = env;
  const off = card(env, "sync-off");
  assert.ok(off, "the informational card");
  assert.ok(!card(env, "sync"));
  const content = text(off);
  assert.ok(content.includes("Sync with Google is not available in this version. Meanwhile, downloading your progress and loading it on the other device"));
  // QA UX-030: a player gets a sentence about what to do, not instructions for the owner of the site.
  assert.ok(!content.includes("docs/GOOGLE_SIGNIN.md") && !content.includes("Do you run this site"), "no owner instructions for a player");
  assert.strictEqual(qa(off, "a").length, 0, "no link for a player");
  assert.strictEqual(qa(off, "button").length, 0, "no dead button");
  assert.ok(!q(el, "[data-action=\"signin\"]"));
  // ... they appear on localhost and with ?debug (the owner trying it out).
  env.sandbox.location.hostname = "localhost";
  env.Ludus.Screens.account.render();
  assert.ok(text(card(env, "sync-off")).includes("docs/GOOGLE_SIGNIN.md"), "the owner's pointer on localhost");
  env.sandbox.location.hostname = "example.github.io";
  env.sandbox.location.search = "?debug";
  env.Ludus.Screens.account.render();
  const ownerCard = card(env, "sync-off");
  assert.ok(text(ownerCard).includes("docs/GOOGLE_SIGNIN.md"), "and with ?debug");
  const link = q(ownerCard, "a");
  assert.strictEqual(link.getAttribute("href"), "https://github.com/jpripamonti/ludus_scaccorum/blob/main/docs/GOOGLE_SIGNIN.md");
  assert.strictEqual(link.getAttribute("target"), "_blank");
  assert.ok(link.getAttribute("rel").includes("noopener"));
});

test("sync: signed out offers one button that preloads Google when pressed (never on hover or focus) and signs in on click", () => {
  const env = createEnv({ language: "en", configured: true });
  const auth = makeFakeAuth();
  env.Ludus.Auth = auth;
  mountAndShow(env);
  const sync = card(env, "sync");
  assert.ok(sync && text(sync).includes("Sign in with Google"));
  assert.ok(text(sync).includes("no server of ours"));
  const button = action(sync, "signin");
  assert.ok(button && !q(sync, "[data-action=\"sync\"]") && !q(sync, "[data-action=\"signout\"]"));
  assert.strictEqual(text(q(sync, ".account-status-badge")), "Signed out");
  assert.deepStrictEqual(auth.calls, [], "nothing is requested before the person acts");
  // QA SEC-009: Google's script is requested when the press starts, never on hover or focus.
  button.dispatch("pointerenter");
  button.dispatch("focus");
  button.dispatch("mouseover");
  assert.deepStrictEqual(auth.calls, [], "hovering or tabbing to the button tells Google nothing");
  button.dispatch("pointerdown");
  assert.deepStrictEqual(auth.calls, ["preload"]);
  button.click();
  assert.deepStrictEqual(auth.calls.slice(1), ["signIn"]);
  // what is stored where is explained
  const stored = text(sync);
  assert.ok(stored.includes("What is stored, and where") && stored.includes("ludus-progress-v1.json") && stored.includes("Nothing else is sent anywhere"));
});

test("sync: a first sign-in asks which profile goes to the Drive, uploads nothing by itself, and shows the linked one afterwards (QA SEC-005)", async () => {
  const env = createEnv({ language: "en", configured: true });
  const auth = makeFakeAuth();
  env.Ludus.Auth = auth;
  mountAndShow(env);
  const { Ludus } = env;
  const me = Ludus.Profile.active();
  const other = Ludus.Profile.create({ name: "Bruno" });
  Ludus.Profile.setActive(me.id);
  const user = { name: "Ana", email: "ana@example.com", picture: "", sub: "9" };
  auth.set({ status: "signed_in", user, lastSyncAt: 0, linkRequired: true, linkedProfiles: [] });
  const sync = () => card(env, "sync");
  const panel = q(sync(), "[data-link=\"required\"]");
  assert.ok(panel, "the choice is offered");
  assert.ok(text(panel).includes("Choose which profile to save to your Drive") && text(panel).includes("Nothing has been saved to your Drive yet"));
  assert.ok(text(panel).includes("the other profiles on this device stay here"), "it says who does NOT go");
  const radios = qa(panel, "input[type=\"radio\"]");
  assert.strictEqual(radios.length, 2, "every local profile is an option");
  assert.strictEqual(radios.filter((radio) => radio.checked)[0].getAttribute("data-profile-id"), me.id, "the active profile is preselected");
  assert.ok(q(panel, "[role=\"radiogroup\"]").getAttribute("aria-label"), "the group has a name");
  assert.ok(!action(sync(), "sync"), "no 'Sync now' while nothing is linked");
  assert.deepStrictEqual(auth.calls, [], "nothing was asked of Auth by the screen itself");
  // choosing another profile, then saving it
  radios.find((radio) => radio.getAttribute("data-profile-id") === other.id).dispatch("change");
  action(sync(), "link-save").click();
  await settle();
  assert.deepStrictEqual(auth.calls, [`linkProfile:${other.id}`], "exactly the chosen profile is linked");
  // a refusal is said in words and the choice stays
  auth.results.link = { ok: false, error: "linked-elsewhere" };
  auth.set({});
  action(sync(), "link-save").click();
  await settle();
  assert.ok(text(q(sync(), "[data-msg=\"link\"]")).includes("ERR:linked-elsewhere"), "the reason is shown");
  assert.ok(q(sync(), "[data-link=\"required\"]"), "still asking");
  // bring the Drive's progress here instead: no profile is uploaded
  auth.results.import = { ok: true, empty: true };
  action(sync(), "link-import").click();
  await settle();
  assert.ok(auth.calls.includes("importFromDrive") && auth.calls.filter((call) => call.startsWith("linkProfile")).length === 2);
  assert.ok(text(q(sync(), "[data-msg=\"link\"]")).includes("Your Drive has no saved progress yet"));
  // once a profile is linked: which one, and a way to stop
  auth.set({ status: "signed_in", user, lastSyncAt: Date.now(), linkRequired: false, linkedProfiles: [{ id: other.id, name: "Bruno" }] });
  assert.ok(!q(sync(), "[data-link=\"required\"]"));
  const done = q(sync(), "[data-link=\"done\"]");
  assert.ok(done && text(done).includes("You are syncing Bruno's profile") && text(done).includes("The other profiles on this device are not uploaded"));
  assert.ok(action(sync(), "sync"), "'Sync now' is back");
  action(sync(), "unlink", other.id).click();
  assert.ok(auth.calls.includes(`unlinkProfile:${other.id}`));
  assert.ok(text(q(sync(), "[data-msg=\"link\"]")).includes("Bruno is no longer synced"));
  // an Auth without the link step never asks (back compatibility)
  auth.set({ status: "signed_in", user, linkRequired: undefined, linkedProfiles: undefined });
  assert.ok(!q(sync(), "[data-link]") && action(sync(), "sync"));
});

test("copy: profiles are not private, the export and the Drive file disclose usernames, the pieces licence is named (QA UX-023, SEC-004, SEC-020)", () => {
  const env = mountAndShow(createEnv({ language: "en", configured: true }));
  env.Ludus.Auth = makeFakeAuth();
  env.Ludus.Screens.account.render();
  assert.ok(text(card(env, "profiles")).includes("do not protect it: anyone using this device can open any profile"));
  const data = text(card(env, "data"));
  assert.ok(data.includes("usernames") && data.includes("a link to each game"), "the export says what it holds");
  assert.ok(!data.includes("or anything else"), "the old claim that it holds nothing else is gone");
  const sync = text(card(env, "sync"));
  assert.ok(sync.includes("usernames (your opponents' too)"), "the Drive file discloses the same");
  const about = text(card(env, "about"));
  assert.ok(about.includes("GPL, version 2 or later") && about.includes("Colin M. L. Burnett"), "the elected licence is credited");
  const es = mountAndShow(createEnv({ language: "es", configured: true }));
  assert.ok(text(card(es, "profiles")).includes("no lo protegen"));
  assert.ok(text(card(es, "data")).includes("nombres de los jugadores"));
  assert.ok(text(card(es, "about")).includes("GPL, versión 2 o posterior"));
});

test("sync: every state renders (connecting, signed in, syncing, error, reconnect) and follows Auth without a reload", () => {
  const env = createEnv({ language: "en", configured: true });
  const auth = makeFakeAuth();
  env.Ludus.Auth = auth;
  mountAndShow(env);
  const now = Date.now();
  const user = { name: "Ana Pérez", email: "ana@example.com", picture: "", sub: "1" };
  const sync = () => card(env, "sync");
  // connecting
  auth.set({ status: "signing_in" });
  assert.strictEqual(sync().getAttribute("data-card"), "sync");
  assert.strictEqual(q(sync(), ".account-sync-status").getAttribute("data-status"), "signing_in");
  assert.strictEqual(action(sync(), "signin").getAttribute("aria-busy"), "true");
  assert.ok(text(sync()).includes("Connecting"));
  // signed in
  auth.set({ status: "signed_in", user, lastSyncAt: now - 5 * 60000 });
  assert.strictEqual(text(q(sync(), ".account-status-badge")), "Signed in");
  assert.ok(text(sync()).includes("Signed in as Ana Pérez") && text(sync()).includes("ana@example.com"));
  assert.ok(text(sync()).includes("Last sync: 5 min ago"));
  assert.ok(action(sync(), "sync") && action(sync(), "signout") && action(sync(), "revoke"));
  assert.ok(!action(sync(), "signin") && !action(sync(), "reconnect"));
  assert.ok(text(sync()).includes("Removes the Drive permission"));
  // never synced yet
  auth.set({ lastSyncAt: 0 });
  assert.ok(text(sync()).includes("Not synced yet"));
  // syncing
  auth.set({ status: "syncing" });
  assert.strictEqual(action(sync(), "sync").getAttribute("aria-busy"), "true");
  assert.strictEqual(q(sync(), ".account-status-badge").parentNode.getAttribute("aria-live"), "polite");
  // sync error (network): the message of Auth, retry, sign out
  auth.set({ status: "error", error: "network" });
  const failure = q(sync(), ".field-error");
  assert.strictEqual(failure.getAttribute("role"), "alert");
  assert.ok(text(failure).includes("ERR:network:en"), "the message comes from Auth.errorMessage");
  assert.ok(text(action(sync(), "sync")).includes("Try again"));
  assert.ok(!action(sync(), "reconnect"));
  action(sync(), "sync").click();
  assert.ok(auth.calls.includes("syncNow"));
  // the connection expired: reconnect replaces sync
  auth.set({ status: "error", error: "reconnect-required", needsReconnect: true });
  assert.ok(action(sync(), "reconnect") && !action(sync(), "sync"));
  action(sync(), "reconnect").click();
  assert.strictEqual(auth.calls.filter((call) => call === "signIn").length, 1);
  // remembered after a reload
  auth.set({ status: "signed_out", error: "", needsReconnect: true });
  assert.ok(text(sync()).includes("You signed in as Ana Pérez on this device. Reconnect to keep syncing."));
  assert.ok(action(sync(), "reconnect") && action(sync(), "signout"));
  assert.ok(!action(sync(), "signin"));
  // the session expired while in use: Auth stays "signed out" but keeps the reason, and the reason is what is said
  auth.set({ status: "signed_out", user, error: "reconnect-required", needsReconnect: true });
  assert.ok(text(q(sync(), ".field-error")).includes("ERR:reconnect-required:en"));
  assert.ok(!text(sync()).includes("You signed in as"), "not both sentences");
  assert.ok(action(sync(), "reconnect"));
  // a failed sign-in with no account: the error and the button to try again
  auth.set({ status: "error", user: null, error: "popup-blocked", needsReconnect: false });
  assert.ok(text(q(sync(), ".field-error")).includes("ERR:popup-blocked"));
  assert.ok(action(sync(), "signin"));
});

test("sync: sign out and sign out with revoke call Auth, and the card goes back to the sign-in button", async () => {
  const env = createEnv({ language: "en", configured: true });
  const auth = makeFakeAuth({ status: "signed_in", user: { name: "Ana", email: "", picture: "", sub: "1" }, lastSyncAt: Date.now() });
  env.Ludus.Auth = auth;
  mountAndShow(env);
  action(card(env, "sync"), "signout").click();
  await settle();
  assert.deepStrictEqual(auth.calls, ["signOut"]);
  assert.ok(action(card(env, "sync"), "signin"));
  assert.ok(env.doc.activeElement === action(card(env, "sync"), "signin"), "focus goes to the button that replaced the one used");
  auth.set({ status: "signed_in", user: { name: "Ana", email: "", picture: "", sub: "1" } });
  action(card(env, "sync"), "revoke").click();
  await settle();
  assert.deepStrictEqual(auth.calls.slice(1), ["signOut:revoke"]);
});

test("sync: a name from Google is text, a picture only from googleusercontent.com; a broken picture falls back to the initials", () => {
  const env = createEnv({ language: "en", configured: true });
  const evil = "<img src=x onerror=alert(1)><script>alert(2)</script> Eve";
  const auth = makeFakeAuth({ status: "signed_in", user: { name: evil, email: "e@x.com", picture: "https://lh3.googleusercontent.com/a/photo=s96", sub: "1" } });
  env.Ludus.Auth = auth;
  mountAndShow(env);
  const sync = card(env, "sync");
  assert.strictEqual(qa(sync, "script").length, 0, "no element was made from the name");
  assert.strictEqual(qa(sync, "img").filter((img) => !img.classList.contains("account-photo")).length, 0);
  assert.ok(text(q(sync, ".account-user-name")).includes("<script>alert(2)</script>"), "shown literally");
  const photo = q(sync, "img.account-photo");
  assert.ok(photo);
  assert.strictEqual(photo.getAttribute("src"), "https://lh3.googleusercontent.com/a/photo=s96");
  assert.strictEqual(photo.getAttribute("alt"), "", "decorative: the name is next to it");
  assert.strictEqual(photo.getAttribute("referrerpolicy"), "no-referrer");
  photo.dispatch("error", {});
  assert.ok(!q(sync, "img.account-photo") && q(sync, ".avatar"), "initials instead");
  // a picture from anywhere else is never requested
  auth.set({ user: { name: "Eve", email: "", picture: "https://evil.example/pixel.png", sub: "1" } });
  assert.ok(!q(card(env, "sync"), "img"), "no img at all");
  assert.ok(q(card(env, "sync"), ".avatar"));
});

test("sync: the card listens to Auth only while the screen is visible", () => {
  const env = createEnv({ language: "en", configured: true });
  const auth = makeFakeAuth();
  env.Ludus.Auth = auth;
  env.Ludus.Profile.ensureActive();
  env.Ludus.Screens.account.mount(env.el);
  assert.strictEqual(auth.listeners.length, 0, "mount subscribes to nothing that costs");
  env.Ludus.router.show("account");
  assert.strictEqual(auth.listeners.length, 1);
  env.Ludus.router.show("account");
  assert.strictEqual(auth.listeners.length, 1, "no double subscription");
  env.Ludus.router.show("home");
  assert.strictEqual(auth.listeners.length, 0);
});

// ---------- install, about, language ----------

test("install: the prompt captured before the screen existed becomes a button; a second use is not offered", async () => {
  const env = createEnv({ language: "en" });
  let prompted = 0;
  const choice = Promise.resolve({ outcome: "accepted" });
  const event = { prompt() { prompted += 1; return Promise.resolve(); }, userChoice: choice };
  env.fire("beforeinstallprompt", event);
  mountAndShow(env);
  const install = card(env, "install");
  const button = action(install, "install");
  assert.ok(button && text(button).includes("Install Ludus Scaccorum"));
  assert.ok(!text(install).includes("from its menu"));
  button.click();
  await settle();
  assert.strictEqual(prompted, 1);
  assert.ok(!action(card(env, "install"), "install"), "the captured event is used once");
  assert.ok(text(card(env, "install")).includes("Done, it is being installed."));
});

test("install: dismissed is answered kindly; an event that arrives while the screen is open shows the button at once; appinstalled says so", async () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  assert.ok(!action(card(env, "install"), "install"));
  assert.ok(text(card(env, "install")).includes("Your browser can install it from its menu"));
  const event = { prompt() {}, userChoice: Promise.resolve({ outcome: "dismissed" }), defaultPrevented: false };
  env.fire("beforeinstallprompt", event);
  assert.ok(action(card(env, "install"), "install"));
  action(card(env, "install"), "install").click();
  await settle();
  assert.ok(text(card(env, "install")).includes("No problem"));
  env.fire("appinstalled", {});
  assert.ok(text(card(env, "install")).includes("You are already using the installed app."));
  assert.ok(!action(card(env, "install"), "install"));
});

test("install: the default of the browser is prevented so the button is the way in; iOS gets the Share hint; standalone says installed", () => {
  const env = createEnv({ language: "en" });
  let prevented = false;
  env.fire("beforeinstallprompt", { prompt() {}, userChoice: Promise.resolve({}), preventDefault() { prevented = true; } });
  assert.strictEqual(prevented, true);
  const ios = mountAndShow(createEnv({ language: "en", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" }));
  assert.ok(text(card(ios, "install")).includes("tap the Share button and choose “Add to Home Screen”"));
  assert.strictEqual(qa(card(ios, "install"), "button").length, 0, "no dead button on iOS");
  const standalone = mountAndShow(createEnv({ language: "en", standalone: true }));
  assert.ok(text(card(standalone, "install")).includes("already using the installed app"));
  assert.strictEqual(qa(card(standalone, "install"), "button").length, 0);
});

test("about: version, licence, engine, credits, links that open safely, the privacy notes and the shortcut cheat sheet", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const about = card(env, "about");
  assert.strictEqual(text(q(about, "[data-about=\"licence\"]")), "GPL-3.0-or-later");
  assert.strictEqual(text(q(about, "[data-about=\"version\"]")), "development", "no version stamp in the test page");
  env.Ludus.version = "abc123def456";
  env.Ludus.Screens.account.render();
  assert.strictEqual(text(q(card(env, "about"), "[data-about=\"version\"]")), "abc123def456");
  const content = text(card(env, "about"));
  assert.ok(content.includes("Stockfish 18") && content.includes("Colin M. L. Burnett") && content.includes("SIL Open Font"));
  const links = qa(card(env, "about"), "a");
  assert.strictEqual(links.length, 3);
  const hrefs = links.map((link) => link.getAttribute("href"));
  assert.ok(hrefs.includes("https://github.com/jpripamonti/ludus_scaccorum"));
  assert.ok(hrefs.some((href) => href.endsWith("/THIRD_PARTY_NOTICES.md")) && hrefs.some((href) => href.endsWith("/LICENSE")));
  links.forEach((link) => {
    assert.strictEqual(link.getAttribute("target"), "_blank");
    assert.ok(link.getAttribute("rel").includes("noopener") && link.getAttribute("rel").includes("noreferrer"));
    assert.ok(q(link, ".sr-only") && text(q(link, ".sr-only")).includes("opens in a new tab"), "the new tab is announced");
  });
  assert.strictEqual(qa(card(env, "about"), ".account-privacy li").length, 4);
  assert.ok(text(qa(card(env, "about"), ".account-privacy li")[3]).includes("no ads and no tracking"));
  // the cheat sheet has the keys the game listens to
  const keys = qa(card(env, "about"), "kbd").map((kbd) => text(kbd));
  ["H", "N", "E", "B", "M", "Enter", "Space", "Esc", "Tab", "Home", "End"].forEach((key) => assert.ok(keys.includes(key), `key ${key}`));
  assert.strictEqual(qa(card(env, "about"), ".account-key-group").length, 4);
  assert.ok(text(card(env, "about")).includes("Ask for a hint, while you think"));
});

test("language switch redraws in the other language and keeps an import under review", async () => {
  const env = mountAndShow(createEnv({ language: "es" }));
  const { Ludus, el } = env;
  assert.strictEqual(text(q(el, "h1")), "Cuenta");
  Ludus.Profile.recordRound(roundRecord(1));
  const input = q(el, "input[type=\"file\"]");
  input.files = [fileLike("x.json", Ludus.Profile.exportJSON("all"))];
  input.dispatch("change");
  await settle();
  assert.ok(text(q(el, ".account-import-review")).includes("Esto hay en x.json"));
  Ludus.i18n.setLanguage("en", { persist: false });
  assert.strictEqual(text(q(el, "h1")), "Account");
  assert.ok(text(el).includes("Profiles on this device"));
  assert.ok(q(el, ".account-import-review") && text(q(el, ".account-import-review")).includes("This is what x.json holds"), "the pending file survives");
  assert.ok(!/account\.[a-z]/.test(text(el).replace(/docs\/[A-Z_.a-z]+/g, "")), "no raw keys");
});

test("mount is idempotent and cheap; hidden screens are marked dirty and drawn on show", () => {
  const env = createEnv({ language: "en" });
  const { Ludus, el } = env;
  Ludus.Profile.ensureActive();
  Ludus.Screens.account.mount(el);
  Ludus.Screens.account.mount(el);
  assert.strictEqual(qa(el, "h1").length, 0, "nothing is drawn or read at mount");
  Ludus.router.show("account");
  assert.strictEqual(qa(el, "h1").length, 1);
  assert.ok(q(el, "h1").hasAttribute("data-screen-title") && q(el, "h1").getAttribute("tabindex") === "-1");
  Ludus.router.show("home");
  Ludus.Profile.create({ name: "Bruno" });
  Ludus.i18n.setLanguage("es", { persist: false });
  Ludus.router.show("account");
  assert.strictEqual(profileCards(env).length, 2);
  assert.strictEqual(text(q(el, "h1")), "Cuenta");
});

// ---------- degradation ----------

test("degradation: without Profile, without Auth, without the kit and with Auth throwing, the screen still opens", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const noProfile = createEnv({ language: "en", skip: ["js/profile.js", "js/auth.js"] });
    noProfile.Ludus.Screens.account.mount(noProfile.el);
    noProfile.Ludus.router.show("account");
    assert.strictEqual(text(q(noProfile.el, "h1")), "Account");
    assert.ok(text(card(noProfile, "profiles")).includes("not available"));
    assert.ok(text(card(noProfile, "data")).includes("not available"));
    assert.ok(card(noProfile, "about") && card(noProfile, "install") && card(noProfile, "sync-off"));

    const noAuth = mountAndShow(createEnv({ language: "en", configured: true, skip: ["js/auth.js"] }));
    assert.ok(card(noAuth, "sync-off"), "no Auth module: the quiet card, not a dead button");

    const noKit = createEnv({ language: "en", skip: ["js/ui/kit.js"] });
    noKit.Ludus.Profile.ensureActive();
    noKit.Ludus.Screens.account.mount(noKit.el);
    noKit.Ludus.router.show("account");
    assert.strictEqual(profileCards(noKit).length, 1, "profiles are drawn without avatars");
    assert.strictEqual(qa(noKit.el, ".avatar").length, 0);
    q(noKit.el, "[data-action=\"add\"]").click();
    assert.strictEqual(modalOf(noKit), null, "without the kit there is no dialog and nothing throws");
    action(noKit.el, "export-active").click();
    assert.strictEqual(noKit.downloads.length, 1, "exporting does not need the kit");

    const throwing = createEnv({ language: "en", configured: true });
    const auth = makeFakeAuth();
    auth.state = () => { throw new Error("boom"); };
    auth.onChange = () => { throw new Error("boom"); };
    throwing.Ludus.Auth = auth;
    mountAndShow(throwing);
    assert.ok(card(throwing, "sync"), "the sync card falls back to the signed-out view");
    assert.ok(action(card(throwing, "sync"), "signin"));
  } finally {
    console.error = originalError;
  }
});

test("degradation: profile storage that refuses is reported, not thrown", () => {
  const env = mountAndShow(createEnv({ language: "en" }));
  const { Ludus, el } = env;
  const toasts = [];
  Ludus.ui.toast = (message) => { toasts.push(message); return null; };
  const bruno = Ludus.Profile.create({ name: "Bruno" });
  Ludus.Screens.account.render();
  const realRemove = Ludus.Profile.remove;
  const realLast = Ludus.Profile.lastError;
  Ludus.Profile.remove = () => false;
  Ludus.Profile.lastError = () => "storage";
  action(el, "delete", bruno.id).click();
  const modal = modalOf(env);
  const input = q(modal, "input[type=\"text\"]");
  input.value = "Bruno";
  input.dispatch("input");
  modalButton(env, "danger").click();
  assert.ok(env.doc.body.contains(modal), "the dialog stays open");
  assert.deepStrictEqual(toasts, ["Could not save: browser storage is full or blocked."]);
  Ludus.Profile.remove = realRemove;
  Ludus.Profile.lastError = realLast;
  closeModal(env);
  assert.ok(findAll(env.el, () => true).length > 100);
});

runAll().then(() => {
  console.log(`account-ui: ${passed} tests passed`);
}).catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
