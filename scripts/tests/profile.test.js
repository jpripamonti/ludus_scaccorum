// Unit tests for js/profile.js: profiles, records, notebook + spaced repetition,
// stats, XP / levels, achievements, daily challenge, strict import / export and
// the merge properties. Plain assert, no framework, no network, deterministic
// (injected clock, ids and storage).

"use strict";

// Every date in this file is built from local components, so pin the zone the
// day-boundary tests reason about (the DST sections switch it on purpose).
process.env.TZ = "America/New_York";

const assert = require("assert");
const path = require("path");
const { createFakeLocalStorage, createThrowingLocalStorage } = require("./_fakedom.js");

const jsDir = path.resolve(__dirname, "..", "..", "js");
require(path.join(jsDir, "ludus.js"));
const Profile = require(path.join(jsDir, "profile.js"));
const { internals, constants } = Profile;

Ludus.i18n.setLanguage("en", { persist: false });

let assertions = 0;
const ok = (value, message) => { assertions += 1; assert.ok(value, message); };
const eq = (actual, expected, message) => { assertions += 1; assert.strictEqual(actual, expected, message); };
const same = (actual, expected, message) => { assertions += 1; assert.deepStrictEqual(actual, expected, message); };
const near = (actual, expected, epsilon, message) => { assertions += 1; assert.ok(Math.abs(actual - expected) <= epsilon, `${message || "near"}: ${actual} vs ${expected}`); };

// ---------- Harness ----------

// Ludus.storage-shaped store over a Map. failWrites: every set fails (quota);
// failKey(key): only some keys fail; maxChars: a set fails when the serialized
// value is longer; throwAlways: everything throws (blocked storage).
function memoryStorage() {
  const map = new Map();
  const api = {
    map,
    failWrites: false,
    failKey: null,
    maxChars: Infinity,
    throwAlways: false,
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
      if (api.failWrites || (api.failKey && api.failKey(key))) return false;
      const text = JSON.stringify(value);
      if (text.length > api.maxChars) return false;
      map.set(key, text);
      return true;
    },
    remove(key) {
      if (api.throwAlways) throw new Error("blocked");
      map.delete(key);
      return true;
    },
    keys(prefix) {
      if (api.throwAlways) throw new Error("blocked");
      return Array.from(map.keys()).filter((key) => key.startsWith(prefix || "")).sort();
    },
    snapshot() { return JSON.stringify(Array.from(map.entries()).sort()); },
  };
  return api;
}

const at = (y, m, d, h = 10, mi = 0, s = 0) => new Date(y, m - 1, d, h, mi, s).getTime();
const T0 = at(2026, 3, 2, 10, 0); // Monday, before the March DST change

function makeClock(start) {
  let t = start;
  return { now: () => t, set(value) { t = value; }, advance(ms) { t += ms; } };
}

function makeUid(tag = "") {
  let n = 0;
  return (prefix) => `${prefix || ""}${tag}${(++n).toString(36)}`;
}

function make(options = {}) {
  const storage = options.storage || memoryStorage();
  const clock = options.clock || makeClock(T0);
  const events = [];
  const handlers = new Map();
  const bus = {
    on(evt, fn) {
      if (!handlers.has(evt)) handlers.set(evt, []);
      handlers.get(evt).push(fn);
      return () => handlers.set(evt, handlers.get(evt).filter((entry) => entry !== fn));
    },
    off() {},
    emit(evt, payload) {
      events.push({ evt, payload });
      (handlers.get(evt) || []).slice().forEach((fn) => fn(payload));
    },
  };
  const p = Profile.createInstance({
    storage,
    bus,
    now: clock.now,
    uid: options.uid || makeUid(),
    i18n: Ludus.i18n,
    rethrow: options.rethrow !== false,
    listenStorage: false,
  });
  const named = (evt) => events.filter((entry) => entry.evt === evt).map((entry) => entry.payload);
  return { p, storage, clock, events, bus, named };
}

// n-th distinct legal-looking position: kings in the corners, one white and one
// black pawn placed by n (48 x 47 combinations).
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
      if (piece) {
        if (empty) row += empty;
        empty = 0;
        row += piece;
      } else {
        empty += 1;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join("/")} w - - 0 1`;
}

// A RoundRecord as the game would emit it. Default: an unremarkable 75-accuracy
// move, so it neither creates a notebook card nor unlocks streak achievements.
function rr(n, overrides = {}) {
  return Object.assign({
    id: `r${n}`,
    ts: T0,
    sessionId: "s1",
    sessionKind: "classic",
    source: "classic",
    positionId: `classic:${n}`,
    fen: fenN(n),
    sideToMove: "w",
    phase: "middlegame",
    userUci: "e2e4",
    userSan: "e4",
    bestUci: "d2d4",
    bestSan: "d4",
    points: 7.5,
    accuracy: 75,
    qualityCode: "good",
    winLossPct: 4,
    cpLoss: 35,
    isBest: false,
    rank: 2,
    onlyMove: false,
    timeSpentMs: 12000,
    hintsUsed: 0,
    timedOut: false,
    tags: [],
    lines: [{ uci: "d2d4", san: "d4", score: 30, pv: ["d2d4", "d7d5", "c2c4"] }],
    meta: { players: "A vs B", event: "Test", year: 1900 },
  }, overrides);
}

// A bad move: creates a notebook card.
const bad = (n, overrides = {}) => rr(n, Object.assign({ points: 2, accuracy: 20, qualityCode: "bad", isBest: false, cpLoss: 300, winLossPct: 25 }, overrides));

function seed(storage, id, raw, meta) {
  const index = storage.get(constants.INDEX_KEY, { v: 1, active: null, profiles: [] });
  index.profiles.push(Object.assign({ id, name: id, color: "#2f6f4f", createdAt: T0 - 1000 }, meta));
  if (!index.active) index.active = id;
  storage.map.set(constants.INDEX_KEY, JSON.stringify(index));
  storage.map.set(`ludus.p.${id}.v1`, JSON.stringify(Object.assign({ v: 1 }, raw)));
}

const dataOf = (storage, id) => JSON.parse(storage.map.get(`ludus.p.${id}.v1`));
const CTRL = String.fromCharCode(0, 7, 27);

// ---------- Levels ----------

{
  const info = internals.levelInfo(0);
  eq(info.level, 1);
  eq(info.rank, "pawn");
  eq(info.sub, 1);
  eq(info.roman, "I");
  eq(info.xpToNext, 300);
  eq(info.progress, 0);
  eq(internals.levelInfo(299).level, 1);
  near(internals.levelInfo(299).progress, 0.9967, 0.0001, "progress inside a level");
  eq(internals.levelInfo(300).level, 2);
  eq(internals.levelInfo(700).sub, 3);
  eq(internals.levelInfo(1200).rank, "knight");
  eq(internals.levelInfo(1200).level, 4);
  eq(internals.levelInfo(4000).rank, "bishop");
  eq(internals.levelInfo(10000).rank, "rook");
  eq(internals.levelInfo(22000).rank, "queen");
  eq(internals.levelInfo(43000).rank, "king");
  const top = internals.levelInfo(110000);
  eq(top.level, 21);
  eq(top.rank, "grandmaster");
  eq(top.max, true);
  eq(top.xpToNext, 0);
  eq(top.progress, 1);
  eq(internals.levelInfo(1e12).level, 21, "no level above the last");
  eq(internals.levelInfo(-50).level, 1, "negative xp is level 1");
  eq(internals.levelInfo(NaN).xp, 0);
  eq(internals.levelInfo("300").xp, 0, "non-numbers are not xp");
  eq(constants.LEVEL_THRESHOLDS.length, constants.RANKS.length * 3, "seven ranks with three sub-levels");
  ok(constants.LEVEL_THRESHOLDS.every((value, i, list) => i === 0 || value > list[i - 1]), "thresholds strictly increase");
  const { p } = make();
  eq(p.levelFor(1200, "es").title, "Caballo I", "Spanish rank title");
  eq(p.levelFor(1200, "en").title, "Knight I", "English rank title");
  eq(p.levelFor(110000, "es").title, "Gran Maestro III");
}

// ---------- Profiles ----------

{
  const { p, storage, named } = make();
  same(p.list(), [], "no profiles at first");
  eq(p.active(), null);
  const first = p.ensureActive();
  eq(first.name, "Player", "the default profile is created on first use (English)");
  eq(first.active, true);
  eq(p.list().length, 1);
  eq(p.ensureActive().id, first.id, "ensureActive is idempotent");
  const index = JSON.parse(storage.map.get("ludus.profiles.v1"));
  eq(index.v, 1, "the index is versioned");
  eq(index.active, first.id);
  ok(storage.map.has(`ludus.p.${first.id}.v1`), "the profile data is stored under ludus.p.<id>.v1");
  eq(dataOf(storage, first.id).v, 1, "profile data is versioned");
  ok(named("profile:changed").some((payload) => payload.profileId === first.id), "creating emits profile:changed");

  const ana = p.create({ name: `  Ana${CTRL}\n  María  `, color: "#ABCDEF" });
  eq(ana.name, "Ana María", "names lose control characters and extra whitespace");
  eq(ana.color, "#abcdef", "valid hex colors are normalized");
  eq(ana.active, false, "a new profile does not steal the active one");
  eq(p.create({ name: "x".repeat(60) }).name.length, 24, "names are capped at 24 characters");
  const plain = p.create({ color: "red" });
  ok(constants.PALETTE.includes(plain.color), "an invalid color falls back to the palette");
  eq(plain.name, "Player", "a missing name falls back to the default");
  eq(new Set(p.list().map((profile) => profile.id)).size, 4, "ids are unique");
  eq(constants.MAX_PROFILES, 4);
  eq(p.list().length, constants.MAX_PROFILES, "four profiles fit");
  eq(p.create({ name: "one too many" }), null, "the fifth is refused");
  eq(p.lastError(), "limit");

  eq(p.rename(ana.id, "  Ana  L. "), true);
  eq(p.list().find((profile) => profile.id === ana.id).name, "Ana L.");
  eq(p.rename(ana.id, "   "), false, "an empty name is refused");
  eq(p.lastError(), "invalid-name");
  eq(p.rename("nope", "X"), false);
  eq(p.lastError(), "not-found");

  eq(p.setActive(ana.id), true);
  eq(p.active().id, ana.id);
  eq(JSON.parse(storage.map.get("ludus.profiles.v1")).active, ana.id, "the active profile is persisted");
  eq(p.setActive("nope"), false);

  eq(p.setGoogleSub(ana.id, "1234567890"), true);
  eq(p.list().find((profile) => profile.id === ana.id).googleSub, "1234567890");
  eq(p.setGoogleSub(ana.id, "bad sub!"), false, "a malformed subject is refused");
  eq(p.setGoogleSub(ana.id, null), true);
  eq(p.list().find((profile) => profile.id === ana.id).googleSub, undefined);

  eq(p.remove(ana.id), true, "removing the active profile works");
  ok(p.active() && p.active().id !== ana.id, "another profile becomes active");
  ok(!storage.map.has(`ludus.p.${ana.id}.v1`), "its data is deleted");
  eq(p.remove(ana.id), false, "removing twice fails");
  p.list().map((profile) => profile.id).forEach((id) => p.remove(id));
  same(p.list(), [], "all profiles can be removed");
  eq(p.active(), null);
  eq(p.ensureActive().name, "Player", "and a new default appears on demand");

  Ludus.i18n.setLanguage("es", { persist: false });
  const spanish = make().p.ensureActive();
  eq(spanish.name, "Jugador", "the default name follows the language");
  Ludus.i18n.setLanguage("en", { persist: false });
}

{
  // Two people on one device: rounds go to the profile they name.
  const { p } = make();
  const a = p.create({ name: "A" });
  const b = p.create({ name: "B" });
  const ra = p.recordRound(rr(1, { profileId: a.id }));
  const rb = p.recordRound(rr(2, { profileId: b.id }));
  eq(ra.profileId, a.id);
  eq(rb.profileId, b.id);
  eq(p.stats(a.id).totalPositions, 1);
  eq(p.stats(b.id).totalPositions, 1);
  const stray = p.recordRound(rr(3, { profileId: "gone" }));
  eq(stray.profileId, a.id, "an unknown profileId falls back to the active profile");
  const viaNull = p.recordRound(rr(4, { profileId: null }));
  eq(viaNull.profileId, a.id, "a null profileId means the active profile");
  eq(p.stats(a.id).totalPositions, 3);
  eq(p.rounds(b.id).length, 1);
  eq(p.rounds("nope").length, 0);
}

// ---------- recordRound ----------

{
  const { p, storage, events, named } = make();
  const result = p.recordRound(rr(1));
  ok(result && result.ok, "a valid round is recorded");
  eq(result.xpGained, 75, "xp per position is round(points x 10)");
  eq(result.card, null, "a 75-accuracy move creates no card");
  eq(result.round.accuracy, 75);
  same(result.unlocked.map((entry) => entry.id), ["first_round"], "the first round unlocks first_round");
  eq(p.stats().totalPositions, 1);
  eq(dataOf(storage, p.active().id).rounds.length, 1, "the round is stored");
  eq(dataOf(storage, p.active().id).xp, 75, "xp is stored (derived)");
  ok(named("profile:changed").length >= 1);
  eq(named("achievement:unlocked").length, 1, "achievement:unlocked is emitted once");
  eq(named("achievement:unlocked")[0].achievement.id, "first_round");
  eq(named("notebook:changed").length, 0, "no card, no notebook event");

  const before = events.length;
  const again = p.recordRound(rr(1));
  eq(again.duplicate, true, "the same round id twice is ignored");
  eq(again.xpGained, 0);
  eq(p.stats().totalPositions, 1);
  eq(events.length, before, "a duplicate emits nothing");
}

{
  const { p } = make();
  [null, undefined, 5, "x", [], {}, rr(1, { fen: "not a fen" }), rr(1, { fen: "" }), rr(1, { fen: "8/8/8/8/8/8/8/8 x - - 0 1" }),
    rr(1, { fen: "9/8/8/8/8/8/8/8 w - - 0 1" }), rr(1, { fen: `${fenN(1)}<script>` }),
    rr(1, { points: undefined, accuracy: undefined }), rr(1, { points: "10", accuracy: "100" })].forEach((bad, i) => {
    eq(p.recordRound(bad), false, `invalid round #${i} is refused`);
  });
  eq(p.lastError(), "invalid-round");
  eq(p.stats().totalPositions, 0, "nothing was stored");

  const derived = p.recordRound(rr(2, { points: undefined, accuracy: 60, qualityCode: undefined }));
  eq(derived.round.points, 6, "points derive from accuracy when missing");
  eq(derived.round.qualityCode, "interesting", "quality derives from accuracy when missing");
  const clampedRound = p.recordRound(rr(3, { points: 99, accuracy: 500, cpLoss: 1e9, winLossPct: -4, hintsUsed: 9, timeSpentMs: 1e12 }));
  eq(clampedRound.round.points, 10, "points clamp to 10");
  eq(clampedRound.round.accuracy, 100);
  eq(clampedRound.round.cpLoss, 2500);
  eq(clampedRound.round.winLossPct, 0);
  eq(clampedRound.round.hintsUsed, 3);
  eq(clampedRound.round.timeSpentMs, 3600000);
  eq(clampedRound.xpGained, 100);
}

{
  // Dates: nothing dated far ahead is trusted; ordinary skew is tolerated.
  const { p, clock } = make();
  const future = p.recordRound(rr(1, { ts: clock.now() + 5 * 86400000 }));
  eq(future.round.ts, clock.now(), "a timestamp more than a day ahead becomes now");
  const slight = p.recordRound(rr(2, { ts: clock.now() + 3600000 }));
  eq(slight.round.ts, clock.now() + 3600000, "an hour of skew is kept");
  const ancient = p.recordRound(rr(3, { ts: 5 }));
  eq(ancient.round.ts, clock.now(), "an impossible timestamp becomes now");
  const noTs = p.recordRound(rr(4, { ts: undefined, id: undefined }));
  eq(noTs.round.ts, clock.now(), "a missing timestamp becomes now");
  ok(/^r_/.test(noTs.round.id), "a missing id is generated");
}

{
  // Untrusted fields inside a round are whitelisted and cleaned.
  const { p } = make();
  const meta = JSON.parse('{"__proto__":{"polluted":1},"constructor":{"x":1},"extra":"dropped"}');
  Object.assign(meta, {
    players: `A${CTRL}   vs  B`,
    event: "<img src=x onerror=alert(1)>",
    year: "1999",
    eco: "C20xxxxxxxxxxxxxx",
    moveNumber: 12.4,
    sideToMove: "b",
  });
  const result = p.recordRound(rr(1, {
    tags: ["fork", "Bad Tag", "<b>", "pin", "fork", 5, null, "a".repeat(80)],
    lines: [
      { uci: "e2e4", san: "e4", score: 1e9, pv: ["e2e4", "zzzz", "e7e5"] },
      { uci: "nope" },
      "junk",
      { uci: "d2d4", san: "<b>", pv: "not an array" },
      { uci: "c2c4" }, { uci: "g1f3" }, { uci: "b1c3" },
    ],
    meta,
    userUci: "e2e9", userSan: "<script>", masterUci: "e2e4", masterSan: "e4",
    sessionId: "bad id!", positionId: "x y", source: "elsewhere", phase: "midgame", sessionKind: "weird",
  }));
  const r = result.round;
  same(r.tags, ["fork", "pin"], "only well-formed unique tags survive");
  eq(r.lines.length, 3, "junk lines are skipped and at most three valid ones are kept");
  eq(r.lines[2].uci, "c2c4");
  eq(r.lines[0].score, 100000, "scores clamp");
  same(r.lines[0].pv, ["e2e4"], "a principal variation stops at its first bad move");
  eq(r.lines[1].san, "", "an unsafe SAN becomes empty");
  eq(r.meta.players, "A vs B", "meta text is cleaned");
  ok(!Object.prototype.hasOwnProperty.call(r.meta, "__proto__") && r.meta.extra === undefined && r.meta.constructor === Object, "unknown and pollution keys in meta are dropped");
  eq(r.meta.year, 1999, "a numeric string year becomes a number");
  eq(r.meta.eco.length, 8);
  eq(r.meta.moveNumber, 12);
  eq(r.userUci, null, "an invalid UCI becomes null");
  eq(r.userSan, null);
  eq(r.masterUci, "e2e4");
  eq(r.sessionId, "", "an unsafe session id is dropped");
  eq(r.source, "own", "an unknown source falls back");
  eq(r.phase, null, "an unknown phase is null, not invented");
  eq(r.sessionKind, "own");
  ok(/^own:/.test(r.positionId), "a bad position id is derived from the position");
  eq({}.polluted, undefined, "Object.prototype is untouched");
}

// ---------- XP, streak bonus, the 600 round window ----------

{
  const { p, clock } = make();
  const a = p.recordRound(rr(1, { points: 8, ts: clock.now() }));
  eq(a.xpGained, 80, "first day: no streak bonus");
  eq(a.bonusXp, 0);
  clock.advance(3600000);
  const sameDay = p.recordRound(rr(2, { points: 8, ts: clock.now() }));
  eq(sameDay.bonusXp, 0, "a second round the same day earns no second bonus");
  clock.set(at(2026, 3, 3, 10));
  const b = p.recordRound(rr(3, { points: 8, ts: clock.now() }));
  eq(b.bonusXp, 10, "day 2 of a streak: 2 x 5");
  eq(b.xpGained, 90);
  clock.set(at(2026, 3, 4, 10));
  eq(p.recordRound(rr(4, { points: 8, ts: clock.now() })).bonusXp, 15, "day 3: 3 x 5");
  eq(p.stats().xp, 80 + 80 + 90 + 95, "xp is the sum of every event");
  ok(p.stats().level.title, "stats carries the localized level title");

  for (let day = 5; day <= 16; day += 1) {
    clock.set(at(2026, 3, day, 10));
    p.recordRound(rr(100 + day, { points: 8, ts: clock.now() }));
  }
  clock.set(at(2026, 3, 17, 10));
  eq(p.recordRound(rr(200, { points: 8, ts: clock.now() })).bonusXp, 50, "the streak bonus caps at 50");

  clock.set(at(2026, 3, 19, 10));
  eq(p.recordRound(rr(201, { points: 8, ts: clock.now() })).bonusXp, 0, "a gap of a day ends the streak, no bonus");
}

{
  // The window keeps 600 rounds; XP and the position count keep everything.
  const { p, storage, clock } = make();
  const profile = p.ensureActive();
  let expected = 0;
  for (let i = 0; i < 640; i += 1) {
    const points = 5 + (i % 5);
    expected += Math.round(points * 10);
    p.recordRound(rr(i, { id: `w${i}`, ts: T0 + i * 1000, points, accuracy: points * 10, fen: fenN(i % 1000) }));
  }
  const stats = p.stats();
  eq(stats.windowPositions, 600, "only 600 rounds are kept in the window");
  eq(stats.totalPositions, 640, "the lifetime position count survives the window");
  eq(stats.xp, expected, "xp survives the window (no level drop when old rounds roll off)");
  const stored = dataOf(storage, profile.id);
  eq(stored.rounds.length, 600);
  eq(stored.rounds[0].id, "w40", "the oldest rounds are the ones evicted");
  eq(stored.xp, expected, "the stored xp equals the recomputed sum");
  eq(stored.xpFloor.rounds, 0, "nothing needed the floor yet");
}

// ---------- Notebook and spaced repetition ----------

{
  const { p, clock, named } = make();
  eq(p.recordRound(rr(1, { accuracy: 70, points: 7 })).card, null, "accuracy 70 is a pass: no card");
  eq(p.recordRound(rr(2, { accuracy: 69.9, points: 6.99 })).card.created, true, "accuracy below 70 creates a card");
  const dubious = p.recordRound(rr(3, { accuracy: 75, qualityCode: "dubious", isBest: false }));
  eq(dubious.card && dubious.card.created, true, "a non-best dubious move creates a card even at 75");
  eq(p.recordRound(rr(4, { accuracy: 75, qualityCode: "dubious", isBest: null })).card, null, "isBest must be exactly false");
  eq(p.recordRound(rr(5, { accuracy: 75, qualityCode: "good", isBest: false })).card, null, "a merely good move creates nothing");
  eq(p.recordRound(rr(6, { accuracy: 75, qualityCode: "blunder", isBest: true })).card, null, "the best move never creates a card");
  eq(p.recordRound(rr(7, { accuracy: 75, qualityCode: "bad", isBest: false })).card.created, true);
  eq(p.notebook.counts().total, 3);

  const card = p.notebook.list()[0];
  ok(/^c_[0-9a-f]{14}$/.test(card.id), "card ids are c_<hash>");
  eq(card.box, 0, "a new card starts in box 0");
  eq(card.due, clock.now(), "and is due immediately");
  same(card.lines[0].uci, "d2d4", "the reference lines are remembered");
  eq(card.meta.event, "Test", "and the source meta");
  eq(card.reviews, 0);
  eq(named("notebook:changed").length, 3, "notebook:changed on every card creation");
  same(Object.keys(named("notebook:changed")[0]).sort(), ["count", "due", "profileId"]);
  eq(named("notebook:changed")[2].count, 3);
  eq(named("notebook:changed")[2].due, 3);

  const sameFen = internals.cardIdFor(fenN(2));
  eq(sameFen, internals.cardIdFor(fenN(2).replace(" 0 1", " 17 42")), "move counters do not change the card id");
  ok(sameFen !== internals.cardIdFor(fenN(3)), "different positions are different cards");
  eq(p.notebook.get(card.id).fen, card.fen, "get() returns the card");
  eq(p.notebook.get("c_missing"), null);
  const copy = p.notebook.get(card.id);
  copy.box = 5;
  eq(p.notebook.get(card.id).box, 0, "reads are copies");
}

{
  // Box progression 0,1,3,7,14,30 days (local calendar days).
  const { p, clock, named } = make();
  p.recordRound(bad(1, { ts: clock.now() }));
  const id = p.notebook.list()[0].id;
  const days = (n) => at(2026, 3, 2 + n, 0, 0); // local midnight n days after Monday

  let result = p.notebook.grade(id, 90, T0);
  eq(result.passed, true);
  eq(result.box, 1, "a pass moves up one box");
  eq(result.due, days(1), "box 1 is due at the next local midnight");
  eq(p.notebook.due(at(2026, 3, 2, 23, 59)).length, 0, "not due late the same day");
  eq(p.notebook.due(days(1)).length, 1, "due at local midnight");
  eq(p.notebook.counts(days(1)).due, 1);

  const expectedBoxes = [[2, 3], [3, 7], [4, 14], [5, 30]];
  let t = days(1) + 9 * 3600000;
  expectedBoxes.forEach(([box, interval]) => {
    result = p.notebook.grade(id, 85, t);
    eq(result.box, box, `pass -> box ${box}`);
    eq(new Date(result.due).getHours() * 60 + new Date(result.due).getMinutes(), 0, "always due at a local midnight");
    const dayDelta = Math.round((result.due - new Date(t).setHours(0, 0, 0, 0)) / 86400000);
    eq(dayDelta, interval, `box ${box} is ${interval} days out`);
    t = result.due + 3600000;
  });
  ok(p.notebook.get(id).clearedAt !== null, "reaching box 3 clears the card");
  result = p.notebook.grade(id, 100, t);
  eq(result.box, 5, "the last box holds");
  result = p.notebook.grade(id, 40, t + 1000);
  eq(result.passed, false);
  eq(result.box, 1, "a failed review goes back to box 1");
  eq(p.notebook.get(id).lapses, 1);
  ok(p.notebook.get(id).clearedAt !== null, "clearedAt is a lifetime marker");
  ok(p.notebook.get(id).history.length <= 20 && p.notebook.get(id).history.length >= 8, "history is kept and capped");
  eq(p.notebook.grade(id, 70, t + 2000).passed, true, "exactly 70 passes");
  eq(p.notebook.grade(id, 69.99, t + 3000).passed, false, "69.99 fails");
  eq(p.notebook.grade("c_missing", 90, t), false);
  eq(p.notebook.grade(id, NaN, t), false, "a non-numeric accuracy is refused");
  eq(p.notebook.grade(id, 150, t + 4000).box >= 1, true, "accuracy clamps");
  ok(named("notebook:changed").length >= 8);
  eq(p.notebook.grade(id, 95, t + 5000, { hintsUsed: 3 }).passed, false, "a revealed answer is never a pass");
}

{
  // Rounds meeting an existing card (the "review" flow and everything else).
  const { p, clock } = make();
  p.recordRound(bad(1, { ts: clock.now(), tags: ["fork"], lines: [{ uci: "d2d4", san: "d4", score: 10, pv: [] }] }));
  const id = p.notebook.list()[0].id;
  clock.set(at(2026, 3, 3, 9));
  const pass = p.recordRound(rr(50, { id: "rev1", fen: fenN(1), source: "notebook", sessionKind: "review", accuracy: 90, points: 9, ts: clock.now() }));
  eq(pass.card.passed, true, "a notebook round that passes advances the card");
  eq(pass.card.box, 1);
  eq(p.notebook.get(id).reviews, 1);
  const fail = p.recordRound(rr(51, { id: "rev2", fen: fenN(1), source: "notebook", sessionKind: "review", accuracy: 30, points: 3, tags: ["pin"], lines: [{ uci: "a2a3", san: "a3", score: 5, pv: [] }], ts: clock.now() + 1000 }));
  eq(fail.card.passed, false);
  eq(p.notebook.get(id).box, 1, "a failed notebook round sends the card back to box 1");
  eq(p.notebook.get(id).lapses, 1);
  same(p.notebook.get(id).tags.slice().sort(), ["fork", "pin"], "tags accumulate on the card");
  eq(p.notebook.get(id).lines[0].uci, "a2a3", "the newest reference lines replace the old");

  const early = p.recordRound(rr(52, { id: "own1", fen: fenN(1), source: "own", accuracy: 95, points: 9.5, ts: clock.now() + 2000 }));
  eq(early.card, null, "a good answer elsewhere before the card is due changes nothing");
  eq(p.notebook.get(id).box, 1);
  const failElsewhere = p.recordRound(rr(53, { id: "own2", fen: fenN(1), source: "own", accuracy: 20, points: 2, qualityCode: "bad", isBest: false, ts: clock.now() + 3000 }));
  eq(failElsewhere.card.passed, false, "a mistake on a known position is a lapse from any source");
  eq(p.notebook.get(id).lapses, 2);
  clock.set(at(2026, 3, 5, 9));
  const dueNow = p.recordRound(rr(54, { id: "own3", fen: fenN(1), source: "classic", accuracy: 95, points: 9.5, ts: clock.now() }));
  eq(dueNow.card.passed, true, "once due, a good answer from any source counts");
  eq(p.notebook.get(id).box, 2);
  const revealed = p.recordRound(rr(55, { id: "rev3", fen: fenN(1), source: "notebook", accuracy: 100, points: 10, hintsUsed: 3, ts: clock.now() + 1000 }));
  eq(revealed.card.passed, false, "a revealed answer in a review is a fail");
  eq(p.notebook.get(id).box, 1);
}

{
  // add / remove / list filters.
  const { p, clock } = make();
  const manual = p.notebook.add(rr(1, { accuracy: 95, points: 9.5, tags: ["quiet_best"], phase: "endgame", source: "own" }));
  ok(manual && manual.box === 0, "add() saves a position regardless of the score");
  eq(p.notebook.add(rr(1)).id, manual.id, "adding the same position returns the existing card");
  eq(p.notebook.counts().total, 1);
  ok(p.notebook.add({ fen: fenN(2) }), "add() accepts a bare position");
  eq(p.notebook.add({ fen: "junk" }), null, "and refuses garbage");
  p.recordRound(bad(3, { tags: ["fork", "hangs_piece"], phase: "opening", source: "classic", ts: clock.now() }));
  p.recordRound(bad(4, { tags: ["hangs_piece"], phase: "middlegame", source: "own", ts: clock.now() + 1 }));
  eq(p.notebook.list().length, 4);
  eq(p.notebook.list({ tag: "hangs_piece" }).length, 2);
  eq(p.notebook.list({ tags: ["fork", "quiet_best"] }).length, 2);
  eq(p.notebook.list({ phase: "opening" }).length, 1);
  eq(p.notebook.list({ source: "own" }).length, 3, "the manual card, the bare position (source defaults to own) and round 4");
  eq(p.notebook.list({ box: 0 }).length, 4);
  eq(p.notebook.list({ box: 3 }).length, 0);
  eq(p.notebook.list({ cleared: true }).length, 0);
  eq(p.notebook.list({ limit: 2 }).length, 2);
  eq(p.notebook.list({ limit: 2, offset: 3 }).length, 1);
  eq(p.notebook.list({ query: "hangs" }).length, 2, "free text searches tags");
  eq(p.notebook.list({ dueOnly: true, now: clock.now() + 10 }).length, 4);
  eq(p.notebook.list({ sort: "created" })[0].createdAt >= p.notebook.list({ sort: "created" })[3].createdAt, true);
  eq(p.notebook.list({ sort: "constructor" }).length, 4, "a hostile sort key falls back to the default");
  eq(p.notebook.due(clock.now() + 10, 3).length, 3, "due() honours the limit");
  eq(p.notebook.remove(manual.id), true);
  eq(p.notebook.remove(manual.id), false);
  eq(p.notebook.counts().total, 3);
}

{
  // DST: Sunday 2026-03-08 has 23 hours in New York. "Next day" is still a calendar day.
  const { p } = make();
  p.recordRound(bad(1, { ts: at(2026, 3, 7, 22, 0) }));
  const id = p.notebook.list()[0].id;
  let result = p.notebook.grade(id, 90, at(2026, 3, 7, 22, 0));
  eq(new Date(result.due).getDate(), 8, "due the next calendar day");
  eq(new Date(result.due).getHours(), 0, "at local midnight");
  result = p.notebook.grade(id, 90, at(2026, 3, 8, 12, 0));
  eq(result.box, 2);
  const due = new Date(result.due);
  eq(due.getDate(), 11, "three calendar days after Mar 8, across the DST change");
  eq(due.getHours(), 0);
  eq(due.getTimezoneOffset(), 240, "and now in daylight time");

  // Fall back: Sunday 2026-11-01 has 25 hours.
  const other = make().p;
  other.recordRound(bad(2, { ts: at(2026, 10, 31, 23, 30) }));
  const id2 = other.notebook.list()[0].id;
  const r2 = other.notebook.grade(id2, 80, at(2026, 10, 31, 23, 30));
  eq(new Date(r2.due).getDate(), 1);
  eq(new Date(r2.due).getHours(), 0);
  const r3 = other.notebook.grade(id2, 80, at(2026, 11, 1, 1, 30));
  eq(new Date(r3.due).getDate(), 4, "box 2 after the fall-back day: +3 calendar days");
}

// ---------- Streaks with an injected clock (midnight and DST) ----------

{
  const { p, clock } = make();
  const record = (n, ts) => p.recordRound(rr(n, { ts }));
  clock.set(at(2026, 3, 2, 23, 59, 59));
  record(1, clock.now());
  eq(p.stats().streak.current, 1);
  clock.set(at(2026, 3, 3, 0, 0, 1));
  record(2, clock.now());
  eq(p.stats().streak.current, 2, "23:59:59 and 00:00:01 are two different days");
  clock.set(at(2026, 3, 3, 23, 59, 59));
  record(3, clock.now());
  eq(p.stats().streak.current, 2, "the same day twice is one day");
  eq(p.stats().streak.activeToday, true);
  clock.set(at(2026, 3, 4, 8));
  let streak = p.stats().streak;
  eq(streak.current, 2, "not played yet today: the streak is still alive");
  eq(streak.atRisk, true, "but at risk");
  eq(streak.activeToday, false);
  clock.set(at(2026, 3, 5, 0, 0, 1));
  streak = p.stats().streak;
  eq(streak.current, 0, "a full missed day ends it");
  eq(streak.best, 2, "the best streak is kept");
  eq(streak.lastDate, "2026-03-03");
  clock.set(at(2026, 3, 5, 12));
  record(4, clock.now());
  streak = p.stats().streak;
  eq(streak.current, 1, "a new streak starts");
  eq(streak.best, 2);
}

{
  // Across a spring-forward day, a fall-back day, half-hour and no-DST zones.
  const scenarios = [
    ["America/New_York", [[2026, 3, 7], [2026, 3, 8], [2026, 3, 9]]],
    ["America/New_York", [[2026, 10, 31], [2026, 11, 1], [2026, 11, 2]]],
    ["Europe/Madrid", [[2026, 3, 28], [2026, 3, 29], [2026, 3, 30]]],
    ["Europe/Madrid", [[2026, 10, 24], [2026, 10, 25], [2026, 10, 26]]],
    ["Asia/Kolkata", [[2026, 6, 1], [2026, 6, 2], [2026, 6, 3]]],
    ["America/Argentina/Buenos_Aires", [[2026, 12, 30], [2026, 12, 31], [2027, 1, 1]]],
    ["Pacific/Auckland", [[2026, 9, 26], [2026, 9, 27], [2026, 9, 28]]],
  ];
  const original = process.env.TZ;
  try {
    scenarios.forEach(([zone, days]) => {
      process.env.TZ = zone;
      const { p, clock } = make({ clock: makeClock(0) });
      days.forEach(([y, m, d], i) => {
        clock.set(at(y, m, d, 23, 30));
        p.recordRound(rr(i, { ts: clock.now() }));
      });
      const streak = p.stats().streak;
      eq(streak.current, 3, `${zone}: three calendar days in a row`);
      eq(streak.best, 3);
      const keys = internals.dateKeyOf(at(days[1][0], days[1][1], days[1][2], 0, 30));
      eq(keys, `${days[1][0]}-${String(days[1][1]).padStart(2, "0")}-${String(days[1][2]).padStart(2, "0")}`, `${zone}: local date keys`);
    });
    process.env.TZ = "America/New_York";
    // An hour apart but on different local days near midnight.
    const { p, clock } = make({ clock: makeClock(at(2026, 3, 7, 23, 30)) });
    p.recordRound(rr(1, { ts: at(2026, 3, 7, 23, 30) }));
    clock.set(at(2026, 3, 8, 0, 30));
    p.recordRound(rr(2, { ts: at(2026, 3, 8, 0, 30) }));
    eq(p.stats().streak.current, 2, "an hour apart, two local days");
  } finally {
    process.env.TZ = original;
  }
  eq(internals.dayNumber("2026-03-09") - internals.dayNumber("2026-03-08"), 1, "day numbers are DST proof");
  eq(internals.dayNumber("2026-02-30"), null, "impossible dates are rejected");
  eq(internals.dayNumber("1999-12-31"), null);
  eq(internals.keyFromDayNumber(internals.dayNumber("2026-12-31") + 1), "2027-01-01");
  const streaks = internals.computeStreaks(["2026-03-01", "2026-03-02", "2026-03-04", "2026-03-05", "2026-03-06"], "2026-03-06");
  eq(streaks.current, 3);
  eq(streaks.best, 3);
  eq(internals.computeStreaks([], "2026-03-06").current, 0);
}

// ---------- Stats ----------

{
  const { p } = make();
  same(p.stats().overallAccuracy, null, "no data: accuracy is null, not 0");
  eq(p.stats().avgPoints, null);
  eq(p.stats().improvement, null);
  eq(p.stats().totalPositions, 0);
  eq(p.stats().streak.current, 0);
  eq(p.stats().byPhase.opening.accuracy, null);
  same(p.stats().trend, []);
  eq(p.stats("nope").totalPositions, 0, "an unknown profile reads as empty");
}

{
  const { p, clock } = make();
  const rows = [];
  let n = 0;
  const add = (count, o) => { for (let i = 0; i < count; i += 1) { rows.push(rr(n, Object.assign({ ts: clock.now() + n }, o))); n += 1; } };
  add(4, { phase: "opening", accuracy: 90, points: 9, qualityCode: "very_good", tags: ["a"], source: "classic", timeSpentMs: 10000, isBest: true });
  add(3, { phase: "middlegame", accuracy: 60, points: 6, qualityCode: "interesting", tags: ["a", "b"], source: "own", timeSpentMs: 20000 });
  add(3, { phase: "endgame", accuracy: 30, points: 3, qualityCode: "bad", tags: ["b"], source: "notebook", timeSpentMs: 30000 });
  add(2, { phase: "endgame", accuracy: 20, points: 2, qualityCode: "blunder", tags: ["c"], source: "daily", timeSpentMs: 0 });
  rows.forEach((row) => p.recordRound(row));
  const stats = p.stats();
  eq(stats.totalPositions, 12);
  eq(stats.windowPositions, 12);
  eq(stats.overallAccuracy, 55.8, "mean accuracy = (4x90 + 3x60 + 3x30 + 2x20) / 12");
  eq(stats.avgPoints, 5.58, "average points per position");
  eq(stats.totalPoints, 67);
  eq(stats.timeSpentMs, 190000, "time spent adds up");
  eq(stats.avgTimeMs, 15833);
  same(stats.byPhase.opening, { count: 4, accuracy: 90, avgPoints: 9, errorRate: 0 });
  eq(stats.byPhase.middlegame.accuracy, 60);
  eq(stats.byPhase.endgame.count, 5);
  eq(stats.byPhase.endgame.accuracy, 26);
  eq(stats.byPhase.endgame.avgPoints, 2.6);
  eq(stats.byPhase.endgame.errorRate, 1, "every endgame answer was below 70");
  same(Object.keys(stats.bySource).sort(), ["classic", "daily", "notebook", "own"]);
  eq(stats.bySource.classic.count, 4);
  eq(stats.bySource.own.accuracy, 60);
  eq(stats.bySource.notebook.count, 3);
  eq(stats.bySource.daily.count, 2);
  eq(stats.byQuality.very_good, 4);
  eq(stats.byQuality.interesting, 3);
  eq(stats.byQuality.bad, 3);
  eq(stats.byQuality.blunder, 2);
  eq(stats.byQuality.perfect, 0, "every quality code is present, zero when unseen");
  same(stats.byTag.map((row) => [row.tag, row.count]), [["a", 7], ["b", 6], ["c", 2]], "tags sorted by frequency");
  eq(stats.byTag[0].accuracy, 77.1);
  eq(stats.byTag[0].errorRate, 0.429);
  same(stats.weakestTags.map((row) => row.tag), ["b", "a"], "weakest tags need >= 5 samples and sort by accuracy");
  same(p.stats(undefined, { minTagSample: 7 }).weakestTags.map((row) => row.tag), ["a"], "the sample size is configurable");
  same(p.stats(undefined, { minTagSample: 2 }).weakestTags.map((row) => row.tag), ["c", "b", "a"]);
  eq(stats.notebook.total, 8, "the eight sub-70 answers became cards");
  eq(stats.notebook.byBox[0], 8);
  eq(stats.achievements.total, 24);
}

{
  // Trend: the last 20 sessions, oldest first.
  const { p, clock } = make();
  for (let i = 0; i < 25; i += 1) {
    p.recordSession({ id: `s${i}`, ts: clock.now() + i * 1000, kind: "classic", title: `Game ${i}`, mode: "solo", positions: 5, points: 30 + i, maxPoints: 50, avgAccuracy: 60 + i, durationMs: 60000 });
  }
  const stats = p.stats();
  eq(stats.trend.length, 20);
  eq(stats.trend[0].id, "s5", "the trend starts with the 6th session");
  eq(stats.trend[19].id, "s24");
  eq(stats.trend[19].accuracy, 84);
  eq(stats.sessions, 25);
  eq(p.sessions(undefined, { limit: 3 })[0].id, "s24", "sessions() lists newest first");
}

{
  // Improvement between the first and last 50 rounds.
  const build = (count, first, last, window) => {
    const rounds = [];
    for (let i = 0; i < count; i += 1) {
      const accuracy = i < window ? first : (i >= count - window ? last : 60);
      rounds.push(rr(i, { id: `q${i}`, ts: T0 - (count - i) * 60000, accuracy, points: accuracy / 10, qualityCode: "good", fen: fenN(i) }));
    }
    return rounds;
  };
  const check = (count, window) => {
    const { p, storage } = make();
    seed(storage, "p1", { rounds: build(count, 50, 70, window) });
    return p.stats().improvement;
  };
  same(check(100, 50), { window: 50, first: 50, last: 70, delta: 20 }, "100 rounds: first 50 vs last 50");
  same(check(40, 20), { window: 20, first: 50, last: 70, delta: 20 }, "fewer rounds: half against half");
  eq(check(20, 10).window, 10, "20 rounds is enough for a 10 vs 10 comparison");
  eq(check(19, 9), null, "below that there is no comparison");
  const declining = make();
  seed(declining.storage, "p1", { rounds: build(100, 80, 60, 50) });
  eq(declining.p.stats().improvement.delta, -20, "a decline is a negative delta");
}

{
  // 600 rounds recompute in well under 20 ms.
  const { p, storage } = make();
  const rounds = [];
  for (let i = 0; i < 600; i += 1) {
    rounds.push(rr(i, { id: `p${i}`, ts: T0 - (600 - i) * 60000, tags: ["fork", "pin", `t${i % 7}`], accuracy: 40 + (i % 60), points: (40 + (i % 60)) / 10, phase: ["opening", "middlegame", "endgame"][i % 3] }));
  }
  seed(storage, "p1", { rounds });
  const best = (fn) => {
    let fastest = Infinity;
    for (let i = 0; i < 7; i += 1) {
      const t0 = process.hrtime.bigint();
      fn();
      fastest = Math.min(fastest, Number(process.hrtime.bigint() - t0) / 1e6);
    }
    return fastest;
  };
  eq(p.stats().windowPositions, 600);
  const hot = best(() => p.stats());
  ok(hot < 20, `stats() over 600 rounds took ${hot.toFixed(2)} ms (< 20)`);
  const cold = best(() => { p.reload(); p.stats(); });
  ok(cold < 20, `reload + validate + stats over 600 rounds took ${cold.toFixed(2)} ms (< 20)`);
  const sanitize = best(() => internals.sanitizeData(dataOf(storage, "p1"), internals.trustedCtx(T0, () => "x")));
  ok(sanitize < 20, `sanitizing 600 stored rounds took ${sanitize.toFixed(2)} ms (< 20)`);
}

// ---------- Sessions ----------

{
  const { p, clock, named } = make();
  const session = {
    id: "s1", ts: clock.now(), kind: "classic", title: "Immortal Game", mode: "solo", positions: 5, points: 42.5, maxPoints: 50,
    avgAccuracy: 85, durationMs: 300000, byQuality: { good: 3, perfect: 2, bogus: 9, blunder: 0 }, roundIds: ["r1", "r2", "r1", "bad id"],
  };
  const result = p.recordSession(session);
  ok(result.ok, "a session is recorded");
  same(result.session.byQuality, { good: 3, perfect: 2 }, "unknown quality codes and zero counts are dropped");
  same(result.session.roundIds, ["r1", "r2"], "round ids are unique and well formed");
  eq(result.xpGained, 0, "an ordinary session earns no bonus");
  same(result.unlocked.map((entry) => entry.id), ["first_classic"]);
  eq(p.recordSession(session).duplicate, true, "the same session twice is ignored");
  eq(p.sessions().length, 1);
  eq(p.recordSession("nope"), false);
  eq(p.recordSession(null), false);
  eq(p.lastError(), "invalid-session");
  const hostile = p.recordSession({ id: "s2", ts: clock.now(), kind: "space", mode: "battle", positions: 1e9, points: -5, maxPoints: "x", avgAccuracy: 900, durationMs: -1, duel: { names: ["a", "b"], scores: [1, 2] } });
  eq(hostile.session.kind, "own");
  eq(hostile.session.mode, "solo", "an unknown mode is solo");
  eq(hostile.session.positions, 1000);
  eq(hostile.session.points, 0);
  eq(hostile.session.avgAccuracy, 100);
  eq(hostile.session.duel, undefined, "duel data is only kept for duels");
  ok(named("profile:changed").length >= 2);

  const perfect = p.recordSession({ id: "s3", ts: clock.now(), kind: "own", mode: "solo", positions: 5, points: 50, maxPoints: 50, avgAccuracy: 100, durationMs: 1000 });
  eq(perfect.xpGained, 50, "a perfect session earns a bonus");
  eq(perfect.unlocked.map((entry) => entry.id).includes("perfect_session"), true);
  eq(p.recordSession({ id: "s4", ts: clock.now(), kind: "own", mode: "solo", positions: 4, points: 40, maxPoints: 40, avgAccuracy: 100, durationMs: 1000 }).xpGained, 0, "four positions is too few to be perfect");
  eq(p.recordSession({ id: "s5", ts: clock.now(), kind: "own", mode: "solo", positions: 5, points: 49.9, maxPoints: 50, avgAccuracy: 99, durationMs: 1000 }).xpGained, 0, "49.9 of 50 is not full marks");
  eq(p.stats().xp, 50);
}

{
  // Duels: one device, two profiles.
  const { p, clock } = make();
  const a = p.create({ name: "A" });
  const b = p.create({ name: "B" });
  const duel = (id, scores, extra = {}) => Object.assign({
    id, ts: clock.now(), kind: "classic", mode: "duel", positions: 6, points: 30, maxPoints: 60, avgAccuracy: 50, durationMs: 1000,
    duel: { names: ["A", "B"], scores, profileIds: [a.id, b.id] },
  }, extra);
  p.recordSession(duel("d1", [35, 25]));
  const ids = (profileId) => p.achievements.unlocked(profileId).map((entry) => entry.id);
  ok(ids(a.id).includes("duel_win"), "the winner unlocks duel_win");
  ok(!ids(b.id).includes("duel_win"), "the loser does not");
  eq(p.sessions(a.id)[0].duel.me, 0, "each profile stores its own side");
  eq(p.sessions(b.id)[0].duel.me, 1);
  eq(p.sessions(a.id).length, 1, "the duel is recorded for both players");
  eq(p.sessions(b.id).length, 1);
  p.recordSession(duel("d2", [10, 40]));
  ok(ids(b.id).includes("duel_win"), "and the second player wins the next one");
  const c = p.create({ name: "C" });
  p.recordSession(duel("d3", [3, 5], { duel: { names: ["C", "X"], scores: [3, 5] } }));
  eq(p.sessions(a.id).length, 3, "without profileIds the session belongs to the active profile as player 1");
  eq(p.sessions(c.id).length, 0);
  eq(p.sessions(a.id)[0].duel.me, 0);
  const tie = p.recordSession(duel("d4", [4, 4]));
  ok(tie.ok);
  eq(p.achievements.unlocked(c.id).length, 0);
}

// ---------- Achievements ----------

{
  const catalog = Profile.achievements.catalog("en");
  eq(catalog.length, 24, "about two dozen achievements");
  eq(new Set(catalog.map((entry) => entry.id)).size, 24, "unique ids");
  let untranslated = 0;
  let sameText = 0;
  catalog.forEach((entry) => {
    ["name", "desc"].forEach((part) => {
      const key = entry[`${part}Key`];
      const es = Ludus.i18n.t(key, null, "es");
      const en = Ludus.i18n.t(key, null, "en");
      if (es === key || en === key || !es || !en) untranslated += 1;
      if (es === en) sameText += 1;
    });
    ok(entry.glyph && entry.target >= 1 && entry.category, `${entry.id} has a glyph, target and category`);
  });
  eq(untranslated, 0, "every achievement has a Spanish and an English name and description");
  ok(sameText <= 2, "and they really differ between languages");
  eq(Profile.achievements.catalog("es").find((entry) => entry.id === "hot_streak").name, "Racha caliente");
  eq(Profile.achievements.catalog("en").find((entry) => entry.id === "hot_streak").name, "Hot streak");
  ok(/Encadená/.test(Profile.achievements.catalog("es").find((entry) => entry.id === "hot_streak").description), "voseo in Spanish descriptions");
  ["moves", "habit", "classics", "notebook", "volume", "sessions", "daily", "progress"].forEach((category) => {
    ok(Ludus.i18n.t(`achievement.category.${category}`, null, "es") !== `achievement.category.${category}`, `category ${category} is translated`);
  });
  ["pawn", "knight", "bishop", "rook", "queen", "king", "grandmaster"].forEach((rank) => {
    ok(Ludus.i18n.t(`profile.rank.${rank}`, null, "es") !== `profile.rank.${rank}`, `rank ${rank} is translated`);
  });
}

{
  const ids = (p) => p.achievements.unlocked().map((entry) => entry.id).sort();
  const fresh = () => make();

  let { p, named, clock } = fresh();
  p.recordRound(rr(1, { qualityCode: "perfect", accuracy: 100, points: 10, isBest: true }));
  same(ids(p), ["first_perfect", "first_round"], "a perfect move unlocks first_perfect");
  const unlocked = p.achievements.unlocked();
  eq(unlocked[0].ts, clock.now(), "unlock time is the clock at that moment");
  ok(unlocked[0].name && unlocked[0].description && unlocked[0].nameKey, "unlocked() carries names and keys");
  const events = named("achievement:unlocked");
  eq(events.length, 2);
  eq(events[0].achievement.id === "first_round" || events[0].achievement.id === "first_perfect", true);
  ok(events[0].achievement.name && events[0].profileId, "the event carries the achievement and the profile");
  same(p.achievements.evaluate(), [], "evaluate() is idempotent");
  eq(p.achievements.unlocked()[0].ts, unlocked[0].ts, "unlock times never move");
  clock.advance(5000);
  p.recordRound(rr(2, { qualityCode: "perfect", accuracy: 100, points: 10, isBest: true }));
  eq(named("achievement:unlocked").length, 2, "nothing is announced twice");

  ({ p } = fresh());
  p.recordRound(rr(1, { onlyMove: true, isBest: false }));
  ok(!ids(p).includes("only_move"), "an only-move you missed does not count");
  p.recordRound(rr(2, { onlyMove: true, isBest: true, accuracy: 100, points: 10, qualityCode: "great" }));
  ok(ids(p).includes("only_move"), "finding an only-move does");

  ({ p } = fresh());
  p.recordRound(rr(1, { tags: ["sacrifice_best"], isBest: false }));
  ok(!ids(p).includes("sacrifice"), "a missed sacrifice does not count");
  p.recordRound(rr(2, { tags: ["sacrifice_best"], isBest: true, accuracy: 100, points: 10 }));
  ok(ids(p).includes("sacrifice"), "finding a sacrifice counts");
  ({ p } = fresh());
  p.recordRound(rr(1, { qualityCode: "brilliant", accuracy: 100, points: 10, isBest: true }));
  ok(ids(p).includes("sacrifice"), "a brilliant move counts as a sacrifice");

  ({ p } = fresh());
  const mate = (score, isBest) => ({ isBest, accuracy: 100, points: 10, lines: [{ uci: "d2d4", san: "d4", score, pv: [] }] });
  p.recordRound(rr(1, mate(99000, false)));
  p.recordRound(rr(2, mate(49999, true)));
  ok(!ids(p).includes("mate_found"));
  p.recordRound(rr(3, mate(99000, true)));
  ok(ids(p).includes("mate_found"), "finding the best move when it is a forced mate");

  ({ p } = fresh());
  p.recordRound(rr(1, { accuracy: 96, points: 9.6, timeSpentMs: 6000 }));
  p.recordRound(rr(2, { accuracy: 96, points: 9.6, timeSpentMs: 0 }));
  p.recordRound(rr(3, { accuracy: 96, points: 9.6, timeSpentMs: 3000, hintsUsed: 1 }));
  p.recordRound(rr(4, { accuracy: 90, points: 9, timeSpentMs: 3000 }));
  ok(!ids(p).includes("quick_draw"), "too slow, unknown time, hints or too weak: no quick_draw");
  p.recordRound(rr(5, { accuracy: 96, points: 9.6, timeSpentMs: 4900 }));
  ok(ids(p).includes("quick_draw"));

  ({ p } = fresh());
  for (let i = 0; i < 9; i += 1) p.recordRound(rr(i, { accuracy: 85, points: 8.5, ts: T0 + i }));
  ok(!ids(p).includes("hot_streak"), "nine in a row is not ten");
  p.recordRound(rr(9, { accuracy: 79.9, points: 7.99, ts: T0 + 9 }));
  for (let i = 10; i < 19; i += 1) p.recordRound(rr(i, { accuracy: 85, points: 8.5, ts: T0 + i }));
  ok(!ids(p).includes("hot_streak"), "a 79.9 breaks the streak");
  p.recordRound(rr(19, { accuracy: 80, points: 8, ts: T0 + 19 }));
  ok(ids(p).includes("hot_streak"), "ten in a row at 80 or more unlocks it (80 counts)");
  eq(p.achievements.progress().hot_streak.unlocked, true);

  ({ p } = fresh());
  for (let i = 0; i < 19; i += 1) p.recordRound(rr(i, { accuracy: 92, points: 9.2 }));
  ok(!ids(p).includes("sharp_eye"));
  p.recordRound(rr(19, { accuracy: 92, points: 9.2, hintsUsed: 1 }));
  ok(!ids(p).includes("sharp_eye"), "a hinted answer is not clean");
  p.recordRound(rr(20, { accuracy: 92, points: 9.2 }));
  ok(ids(p).includes("sharp_eye"), "twenty clean 90+ answers");

  ({ p } = fresh());
  const sources = ["own", "classic", "notebook"];
  sources.forEach((source, i) => p.recordRound(rr(i, { source })));
  ok(!ids(p).includes("explorer"), "three sources are not four");
  p.recordRound(rr(9, { source: "daily" }));
  ok(ids(p).includes("explorer"));

  ({ p } = fresh());
  for (let i = 0; i < 9; i += 1) p.recordSession({ id: `c${i}`, ts: T0 + i, kind: "classic", mode: "solo", positions: 3, points: 10, maxPoints: 30, avgAccuracy: 40, durationMs: 1 });
  ok(ids(p).includes("first_classic"));
  ok(!ids(p).includes("classics_10"), "nine classic games");
  p.recordSession({ id: "c9", ts: T0 + 9, kind: "classic", mode: "solo", positions: 3, points: 10, maxPoints: 30, avgAccuracy: 40, durationMs: 1 });
  ok(ids(p).includes("classics_10"), "ten classic games");
  p.recordSession({ id: "o1", ts: T0, kind: "own", mode: "solo", positions: 3, points: 10, maxPoints: 30, avgAccuracy: 40, durationMs: 1 });
  eq(p.achievements.progress().classics_10.current, 10, "only classic sessions count");
}

{
  // Achievements that need history are seeded, then triggered by one recorded round.
  const ids = (p) => p.achievements.unlocked().map((entry) => entry.id).sort();
  const dayKeys = (count, endKey) => Array.from({ length: count }, (_, i) => internals.keyFromDayNumber(internals.dayNumber(endKey) - count + 1 + i));

  let { p, storage } = make();
  seed(storage, "p1", { days: dayKeys(2, "2026-03-01") });
  p.recordRound(rr(1));
  ok(ids(p).includes("streak_3") && !ids(p).includes("streak_7"), "2 seeded days + today = a 3 day streak");
  ({ p, storage } = make());
  seed(storage, "p1", { days: dayKeys(29, "2026-03-01") });
  p.recordRound(rr(1));
  ok(["streak_3", "streak_7", "streak_30"].every((id) => ids(p).includes(id)), "29 seeded days + today = 30");
  eq(p.stats().streak.best, 30);

  ({ p, storage } = make());
  const oldRounds = Array.from({ length: 4 }, (_, i) => rr(i, { id: `o${i}`, ts: T0 - (i + 1) * 60000, fen: fenN(i) }));
  seed(storage, "p1", { rounds: oldRounds, xpFloor: { upTo: at(2026, 1, 1), xp: 3000, rounds: 495 } });
  eq(p.stats().totalPositions, 499, "the floor's rounds count as positions played");
  p.recordRound(rr(50));
  eq(p.stats().totalPositions, 500);
  ok(ids(p).includes("positions_100") && ids(p).includes("positions_500"), "500 positions, counted across the window");
  ok(p.stats().xp >= 3000 + 75, "and xp includes the floor");

  ({ p, storage } = make());
  const cards = Array.from({ length: 10 }, (_, i) => ({ fen: fenN(i), box: 3, due: T0, createdAt: T0 - 9e6, updatedAt: T0 - 8e6, clearedAt: T0 - 7e6, reviews: 3 }));
  seed(storage, "p1", { notebook: cards });
  same(p.achievements.evaluate().map((entry) => entry.id).sort(), ["first_card_cleared", "notebook_10"], "evaluate() finds what the data already earns");
  eq(p.achievements.progress().notebook_10.current, 10);

  ({ p, storage } = make());
  p.recordRound(bad(1));
  const id = p.notebook.list()[0].id;
  p.notebook.grade(id, 90, T0);
  p.notebook.grade(id, 90, T0 + 86400000 * 2);
  ok(!ids(p).includes("first_card_cleared"), "box 2 is not cleared yet");
  const graded = p.notebook.grade(id, 90, T0 + 86400000 * 5);
  eq(graded.newlyCleared, true, "the third pass clears the card");
  ok(ids(p).includes("first_card_cleared"), "grading evaluates achievements");
  eq(graded.unlocked.map((entry) => entry.id).includes("first_card_cleared"), true);

  ({ p, storage } = make());
  seed(storage, "p1", { xpFloor: { upTo: at(2026, 1, 1), xp: 1198, rounds: 0, bonuses: 20 } });
  same(p.achievements.evaluate(), []);
  p.recordRound(rr(1, { points: 0.1, accuracy: 1 }));
  ok(!ids(p).includes("rank_knight"));
  p.recordRound(bad(2, { points: 1, accuracy: 10 }));
  ok(ids(p).includes("rank_knight"), "crossing 1200 xp reaches Knight");

  const trendRounds = (from, to) => Array.from({ length: 100 }, (_, i) => rr(i, { id: `i${i}`, ts: T0 - (100 - i) * 60000, accuracy: i < 50 ? from : (i >= 50 ? to : 60), points: (i < 50 ? from : to) / 10, fen: fenN(i) }));
  ({ p, storage } = make());
  seed(storage, "p1", { rounds: trendRounds(50, 70) });
  ok(p.achievements.evaluate().map((entry) => entry.id).includes("improver"), "+20 between the first and last 50");
  ({ p, storage } = make());
  seed(storage, "p1", { rounds: trendRounds(50, 55) });
  ok(!p.achievements.evaluate().map((entry) => entry.id).includes("improver"), "+5 is not enough");
  eq(p.achievements.progress().improver.unlocked, false);
}

{
  const { p } = make();
  for (let i = 0; i < 12; i += 1) p.recordRound(rr(i));
  const progress = p.achievements.progress();
  eq(progress.positions_100.current, 12);
  eq(progress.positions_100.target, 100);
  eq(progress.positions_100.unlocked, false);
  eq(progress.first_round.current, 1);
  eq(progress.first_round.unlocked, true);
  eq(Object.keys(progress).length, 24);
}

// ---------- Daily challenge ----------

{
  const { p, clock, named } = make();
  same(p.daily.status("2026-03-02"), { date: "2026-03-02", done: false, accuracy: null, streak: 0, best: 0, lastDate: null, atRisk: false });
  const first = p.daily.complete("2026-03-02", 80);
  ok(first.ok);
  eq(first.streak, 1);
  eq(first.best, 1);
  eq(first.already, false);
  eq(first.xpGained, 40 + 32 + 5, "40 + 0.4 x accuracy + 5 per streak day");
  eq(p.stats().xp, 77, "the daily bonus is part of the xp total");
  eq(p.stats().dailyStreak.current, 1);
  const status = p.daily.status("2026-03-02");
  eq(status.done, true);
  eq(status.accuracy, 80);
  eq(status.streak, 1);
  eq(status.atRisk, false);
  ok(first.unlocked.map((entry) => entry.id).includes("daily_first"));

  const again = p.daily.complete("2026-03-02", 95);
  eq(again.already, true, "completing the same day twice is not a second completion");
  eq(again.xpGained, 0);
  eq(again.streak, 1);
  eq(p.daily.status("2026-03-02").accuracy, 95, "but a better score is kept");
  p.daily.complete("2026-03-02", 50);
  eq(p.daily.status("2026-03-02").accuracy, 95, "a worse one is not");
  eq(p.stats().xp, 77);

  clock.set(at(2026, 3, 3, 10));
  const morning = p.daily.status("2026-03-03");
  eq(morning.streak, 1, "yesterday's streak is still alive");
  eq(morning.atRisk, true, "and at risk until today is done");
  eq(morning.done, false);
  const second = p.daily.complete("2026-03-03", 100);
  eq(second.streak, 2);
  eq(second.xpGained, 40 + 40 + 10);
  eq(second.best, 2);

  clock.set(at(2026, 3, 6, 10));
  eq(p.daily.status("2026-03-06").streak, 0, "two missed days end the streak");
  eq(p.daily.status("2026-03-06").best, 2);
  const restart = p.daily.complete("2026-03-06", 60);
  eq(restart.streak, 1, "and it restarts at 1");
  eq(restart.best, 2, "the best is kept");
  eq(p.daily.complete("2026-03-05", 90), false, "back-filling a day before the last completed one is refused");
  eq(p.lastError(), "date-out-of-range");
  eq(p.daily.status("2026-03-06").streak, 1, "so the streak cannot be inflated after the fact");
  eq(p.daily.complete("2026-03-01", 50), false, "older than yesterday is refused");
  eq(p.lastError(), "date-out-of-range");
  eq(p.daily.complete("2026-03-09", 50), false, "beyond tomorrow is refused");
  eq(p.daily.complete("2026-03-07", 50).ok, true, "tomorrow is allowed (time zones)");
  eq(p.daily.complete("2026-13-45", 50), false);
  eq(p.lastError(), "invalid-date");
  eq(p.daily.complete("abc", 50), false);
  eq(p.daily.complete(null, 50), false);
  eq(p.daily.complete("2026-03-06", NaN), false);
  eq(p.lastError(), "invalid-accuracy");
  eq(p.daily.complete("2026-03-06", "80"), false, "accuracy must be a number");
  ok(named("profile:changed").length > 3);
  eq(p.daily.status("nonsense"), null);
}

{
  // Across midnight, and other ways to name a day.
  const { p, clock } = make({ clock: makeClock(at(2026, 3, 2, 23, 59, 30)) });
  eq(p.daily.complete(new Date(clock.now()), 70).streak, 1, "a Date names its local day");
  clock.set(at(2026, 3, 3, 0, 0, 30));
  eq(p.daily.complete(clock.now(), 70).streak, 2, "a timestamp names its local day; 00:00:30 is the next day");
  eq(p.daily.status(undefined).date, "2026-03-03", "no date means today");
  eq(p.daily.complete("2026-03-03", 70).already, true);
  for (let day = 4; day <= 8; day += 1) {
    clock.set(at(2026, 3, day, 12));
    p.daily.complete(`2026-03-0${day}`, 60);
  }
  eq(p.daily.status("2026-03-08").streak, 7);
  ok(p.achievements.unlocked().map((entry) => entry.id).includes("daily_streak_7"), "seven daily challenges in a row");
}

// ---------- Storage: quota, blocked storage, corruption ----------

{
  // A full storage: false, nothing stored touched, memory rolled back, no events.
  const { p, storage, events } = make();
  p.recordRound(rr(1));
  p.recordRound(bad(2));
  const profileId = p.active().id;
  const cardId = p.notebook.list()[0].id;
  const before = storage.snapshot();
  const eventCount = events.length;
  storage.failWrites = true;
  eq(p.recordRound(rr(3)), false, "a full storage refuses the round");
  eq(p.lastError(), "storage");
  eq(storage.snapshot(), before, "and nothing already stored is touched");
  eq(events.length, eventCount, "no event announces a change that did not happen");
  same(p.rounds().map((round) => round.id), ["r2", "r1"], "memory rolled back with the store");
  eq(p.stats().totalPositions, 2);
  eq(p.notebook.grade(cardId, 90, T0), false, "grading fails the same way");
  eq(p.notebook.get(cardId).box, 0, "and leaves the card alone");
  eq(p.daily.complete("2026-03-02", 50), false);
  eq(p.daily.status("2026-03-02").done, false);
  eq(p.recordSession({ id: "s", ts: T0, kind: "own", mode: "solo", positions: 1, points: 1, maxPoints: 10, avgAccuracy: 10, durationMs: 1 }), false);
  eq(p.create({ name: "New" }), null, "creating a profile fails cleanly");
  eq(p.lastError(), "storage");
  eq(p.rename(profileId, "Renamed"), false);
  eq(p.list().length, 1, "the profile list did not change");
  eq(p.list()[0].name, "Player");
  eq(p.notebook.remove(cardId), false, "removing a card fails cleanly");
  eq(p.notebook.counts().total, 1);
  eq(p.wipe(profileId), false);
  eq(p.stats().totalPositions, 2, "a failed wipe keeps the data");
  storage.failWrites = false;
  ok(p.recordRound(rr(3)).ok, "and it works again once space is back");
  same(p.rounds().map((round) => round.id), ["r3", "r2", "r1"], "the failed round never sneaks in");
  eq(p.stats().xp, 75 + 20 + 75);
}

{
  // A quota that only bites for big values: the write is squeezed and retried.
  const { p, storage } = make();
  const long = (label, i) => `${label}${"x".repeat(60)}${i}`;
  const rounds = Array.from({ length: 600 }, (_, i) => rr(i, {
    id: `q${i}`, ts: T0 - (600 - i) * 60000, fen: fenN(i),
    lines: [1, 2, 3].map((k) => ({ uci: "d2d4", san: "d4", score: 30 * k, pv: ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3", "g8f6"] })),
    meta: { players: long("P", i), event: long("E", i), site: long("S", i) },
  }));
  seed(storage, "p1", { rounds });
  eq(p.stats().windowPositions, 600);
  const xpBefore = p.stats().xp;
  const key = "ludus.p.p1.v1";
  p.recordRound(rr(9001, { ts: T0 }));
  const size = storage.map.get(key).length;
  ok(size > 450000, `precondition: the profile is big (${size} chars)`);
  storage.maxChars = Math.floor(size * 0.9);
  const squeezed = p.recordRound(rr(9002, { ts: T0 + 1 }));
  ok(squeezed && squeezed.ok, "a write over the quota succeeds after compaction");
  const stored = dataOf(storage, "p1");
  ok(storage.map.get(key).length <= storage.maxChars, "and the stored value fits the quota");
  eq(stored.rounds.length, 600, "the window is still full");
  eq(stored.rounds[0].lines.length, 0, "old rounds lost their analysis lines first");
  eq(stored.rounds[597].lines.length, 3, "recent rounds kept theirs (index 597 is the newest seeded round)");
  eq(stored.xp, xpBefore + 75 + 75, "compaction never loses xp");
  eq(p.stats().totalPositions, 602, "or positions played");

  storage.maxChars = 1000;
  const snapshot = storage.snapshot();
  eq(p.recordRound(rr(9003, { ts: T0 + 2 })), false, "a quota nothing can satisfy still fails without corrupting anything");
  eq(storage.snapshot(), snapshot);
}

{
  // A maximal profile fits its budget; four of them export to a re-importable file.
  const { p, storage } = make();
  const rounds = Array.from({ length: 600 }, (_, i) => rr(i, {
    id: `b${i}`, ts: T0 - (600 - i) * 60000, fen: fenN(i), tags: ["fork", "pin", "hangs_piece"],
    lines: [1, 2, 3].map((k) => ({ uci: "d2d4", san: "d4", score: 30 * k, pv: ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3", "g8f6"] })),
    meta: { players: `Player One ${i} vs Player Two ${i}`, event: `Some Very Long Tournament Name ${i}`, site: "Somewhere", eco: "C20", result: "1-0", year: 1900 },
  }));
  const cards = Array.from({ length: 1000 }, (_, i) => ({
    fen: fenN(i + 700), box: i % 6, due: T0 + i * 1000, createdAt: T0 - 1e7 + i, updatedAt: T0 - 5e6 + i, tags: ["fork", "pin"], phase: "middlegame",
    bestUci: "d2d4", bestSan: "d4", reviews: 20, lapses: 3, lastAccuracy: 55.5,
    lines: [1, 2, 3].map((k) => ({ uci: "d2d4", san: "d4", score: 30 * k, pv: ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3", "g8f6"] })),
    history: Array.from({ length: 20 }, (_, h) => ({ ts: T0 - 4e6 + i * 100 + h, accuracy: 40 + h, passed: h % 2 === 0, box: h % 6, roundId: `hr${i}_${h}` })),
    meta: { players: `Player One ${i} vs Player Two ${i}`, event: "Tournament" },
  }));
  seed(storage, "p1", { rounds, notebook: cards, days: ["2026-02-20", "2026-02-21", "2026-02-22"], achievements: { first_round: T0 - 1000 } });
  eq(p.notebook.counts().total, 1000);
  const xpBefore = p.stats().xp;
  p.recordRound(rr(9000, { ts: T0 }));
  const text = storage.map.get("ludus.p.p1.v1");
  ok(text.length <= constants.PROFILE_BUDGET_CHARS, `a full profile is squeezed under its budget (${text.length} <= ${constants.PROFILE_BUDGET_CHARS})`);
  const stored = JSON.parse(text);
  eq(stored.rounds.length, 600);
  eq(stored.xp, xpBefore + 75, "xp survives the squeeze");
  eq(stored.days.length, 4, "activity days survive");
  eq(Object.keys(stored.achievements).length >= 1, true, "achievements survive");
  ok(stored.notebook.length >= 900, `almost the whole notebook survives (${stored.notebook.length})`);

  const bigStorage = memoryStorage();
  for (let i = 1; i <= constants.MAX_PROFILES; i += 1) seed(bigStorage, `p${i}`, stored, { name: `P${i}` });
  const bigEnv = make({ storage: bigStorage });
  const exported = bigEnv.p.exportJSON("all");
  ok(exported.length <= constants.MAX_IMPORT_CHARS, `four maximal profiles export within the import cap (${exported.length} <= ${constants.MAX_IMPORT_CHARS})`);
  const restored = make().p.importJSON(exported);
  ok(restored.ok && restored.profiles === constants.MAX_PROFILES, "and that export imports again");
}

{
  // Blocked storage: nothing throws, nothing works, nothing lies.
  const storage = memoryStorage();
  storage.throwAlways = true;
  const { p } = make({ storage });
  same(p.list(), []);
  eq(p.active(), null);
  eq(p.ensureActive(), null, "no profile can be created");
  eq(p.create({ name: "x" }), null);
  eq(p.recordRound(rr(1)), false);
  eq(p.recordSession({ id: "s", ts: T0, kind: "own", mode: "solo", positions: 1, points: 1, maxPoints: 10, avgAccuracy: 1, durationMs: 1 }), false);
  eq(p.stats().totalPositions, 0);
  eq(p.exportJSON("all"), "");
  eq(p.importJSON("{}").ok, false);
  eq(p.wipe("all"), false);
  same(p.notebook.list(), []);
  eq(p.notebook.counts().total, 0);
  eq(p.daily.complete("2026-03-02", 50), false);
  same(p.achievements.evaluate(), []);
}

{
  // Corrupt stored data is repaired on read and never crashes.
  const s1 = memoryStorage();
  s1.map.set("ludus.profiles.v1", "{oops");
  const a = make({ storage: s1 });
  same(a.p.list(), [], "an unreadable index reads as empty");
  eq(a.p.ensureActive().name, "Player");
  eq(JSON.parse(s1.map.get("ludus.profiles.v1")).profiles.length, 1, "and is rewritten on first use");

  const s2 = memoryStorage();
  s2.map.set("ludus.profiles.v1", JSON.stringify({
    v: 1,
    active: "ghost",
    profiles: [null, 5, "x", {}, { id: "bad id!" }, { id: "__proto__" }, { id: "ok1", name: 5, color: "nope", createdAt: "x" }, { id: "ok1", name: "dup" }, { id: "ok2", name: "Two", googleSub: "s 1" }],
  }));
  const b = make({ storage: s2 });
  same(b.p.list().map((profile) => profile.id), ["ok1", "ok2"], "garbage and duplicate entries are dropped");
  eq(b.p.list()[0].name, "Player", "a bad name falls back to the default");
  ok(constants.PALETTE.includes(b.p.list()[0].color), "a bad color falls back to the palette");
  eq(b.p.active().id, "ok1", "an active id that does not exist falls back to the first profile");
  eq(b.p.list()[1].googleSub, undefined, "a malformed subject is dropped");

  const s3 = memoryStorage();
  seed(s3, "p1", {});
  s3.map.set("ludus.p.p1.v1", JSON.stringify({
    v: 1,
    xp: 999999999,
    rounds: [null, 5, "x", {}, { id: "a" }, rr(1, { id: "good1" }), rr(1, { id: "good1", points: 1 }), rr(2, { id: "" }), rr(3, { fen: "x" })],
    sessions: "nope",
    notebook: { not: "an array" },
    achievements: [1, 2],
    daily: "x",
    days: "x",
  }));
  const c = make({ storage: s3 });
  eq(c.p.stats().windowPositions, 1, "invalid rounds are dropped, valid ones kept");
  eq(c.p.stats().xp, 10, "a tampered xp is ignored: it is recomputed from the (one) surviving round");
  eq(c.p.rounds()[0].points, 1, "duplicate ids keep one deterministic record (the canonically smaller one)");
  same(c.p.sessions(), []);
  ok(c.p.recordRound(rr(9)).ok, "recording still works on top of repaired data");

  const s4 = memoryStorage();
  seed(s4, "p1", {});
  s4.map.set("ludus.p.p1.v1", JSON.stringify("hello"));
  eq(make({ storage: s4 }).p.stats().totalPositions, 0, "data that is not even an object reads as empty");
}

{
  // Data written by a newer version is read-only, never overwritten.
  const storage = memoryStorage();
  seed(storage, "p1", { rounds: [rr(1)] });
  const raw = JSON.parse(storage.map.get("ludus.p.p1.v1"));
  raw.v = 2;
  raw.futureField = { keep: "me" };
  storage.map.set("ludus.p.p1.v1", JSON.stringify(raw));
  const before = storage.snapshot();
  const { p } = make({ storage });
  eq(p.stats().totalPositions, 1, "it can still be read");
  eq(p.recordRound(rr(2)), false, "but not written");
  eq(p.lastError(), "read-only");
  eq(p.notebook.add(rr(3)), null);
  eq(p.wipe("p1"), false);
  eq(storage.snapshot(), before, "the newer data is untouched");

  const newerIndex = memoryStorage();
  newerIndex.map.set("ludus.profiles.v1", JSON.stringify({ v: 2, active: "x", profiles: [{ id: "x", name: "X" }] }));
  const idx = make({ storage: newerIndex });
  eq(idx.p.create({ name: "y" }), null, "a newer index is not overwritten either");
  eq(idx.p.lastError(), "read-only");
  eq(idx.p.importJSON(JSON.stringify({ kind: "ludus-progress", v: 1, profiles: [{ id: "n1", name: "N", data: {} }] })).error, "read-only");
}

{
  // Creating a profile writes the data first; a failing index write leaves nothing behind.
  const { p, storage } = make();
  storage.failKey = (key) => key === "ludus.profiles.v1";
  eq(p.create({ name: "Ghost" }), null);
  eq(storage.keys("ludus.p.").length, 0, "no orphan data key stays behind");
  eq(p.list().length, 0);
  storage.failKey = null;
  ok(p.create({ name: "Real" }));
}

{
  // wipe
  const { p, storage, named } = make();
  const a = p.create({ name: "A" });
  p.recordRound(rr(1));
  p.recordRound(bad(2));
  eq(p.wipe(a.id), true);
  eq(p.stats().totalPositions, 0, "wipe(id) clears the data");
  eq(p.notebook.counts().total, 0);
  eq(p.list().length, 1, "but keeps the profile");
  eq(named("notebook:changed").pop().count, 0);
  const b = p.create({ name: "B" });
  storage.map.set("ludus.p.orphan.v1", JSON.stringify({ v: 1 }));
  storage.map.set("ludus.p.bad key.v1", "x");
  storage.map.set("ludus.settings.v2", "keep");
  eq(p.wipe("all"), true);
  same(p.list(), []);
  ok(!storage.map.has(`ludus.p.${b.id}.v1`) && !storage.map.has("ludus.p.orphan.v1") && !storage.map.has("ludus.profiles.v1"), "wipe('all') removes every profile key, orphans included");
  ok(storage.map.has("ludus.p.bad key.v1") && storage.map.has("ludus.settings.v2"), "and only those");
  eq(p.wipe("nope"), false);
  eq(p.active(), null);
}

// ---------- Export and import ----------

function sourceEnv(name, clock, tag) {
  const env = make({ clock, uid: makeUid(tag) });
  const profile = env.p.create({ name });
  env.p.recordRound(rr(1, { id: "x1", ts: clock.now(), fen: fenN(1) }));
  env.p.recordRound(rr(2, { id: "x2", ts: clock.now() + 1, fen: fenN(2), qualityCode: "perfect", accuracy: 100, points: 10, isBest: true }));
  env.p.recordRound(bad(3, { id: "x3", ts: clock.now() + 2, fen: fenN(3), tags: ["fork"] }));
  env.p.recordSession({ id: "xs1", ts: clock.now() + 3, kind: "classic", title: "Game", mode: "solo", positions: 3, points: 19.5, maxPoints: 30, avgAccuracy: 65, durationMs: 90000, roundIds: ["x1", "x2", "x3"] });
  env.p.daily.complete("2026-03-02", 88);
  return { env, id: profile.id, text: env.p.exportJSON() };
}

const strip = (text) => {
  const doc = JSON.parse(text);
  delete doc.exportedAt;
  return doc;
};

{
  const clock = makeClock(T0);
  const src = sourceEnv("Source", clock, "A");
  const doc = JSON.parse(src.text);
  eq(doc.kind, "ludus-progress");
  eq(doc.v, 1, "the export is versioned");
  eq(doc.app, "ludus-scaccorum");
  eq(doc.profiles.length, 1);
  eq(doc.profiles[0].googleSub, undefined, "a plain export does not carry the Google subject");
  same(Object.keys(doc.profiles[0].data).sort(), ["achievements", "daily", "days", "notebook", "rounds", "sessions", "updatedAt", "v", "xp", "xpFloor", "xpLog"]);
  eq(src.env.p.exportJSON("nope"), "", "an unknown profile exports nothing");
  eq(src.env.p.lastError(), "not-found");

  const target = make({ clock, uid: makeUid("B") });
  const res = target.p.importJSON(src.text);
  ok(res.ok, "the export imports");
  eq(res.profiles, 1);
  eq(res.rounds, 3);
  eq(res.cards, 1);
  eq(res.sessions, 1);
  eq(res.dropped, 0);
  eq(res.created, 1);
  eq(res.merged, 0);
  eq(res.mode, "merge");
  same(res.profileIds, [src.id]);
  same(target.p.list().map((profile) => profile.id), [src.id], "the profile keeps its id");
  same(strip(target.p.exportJSON()), strip(src.text), "export -> import -> export is lossless");
  const original = src.env.p.stats();
  const copy = target.p.stats();
  eq(copy.xp, original.xp);
  eq(copy.notebook.total, 1);
  eq(copy.achievements.unlocked, original.achievements.unlocked);
  eq(copy.dailyStreak.best, 1);
  ok(target.named("profile:changed").some((payload) => payload.profileId === src.id), "import emits profile:changed");
  eq(target.named("notebook:changed").pop().count, 1, "and notebook:changed");

  const again = target.p.importJSON(src.text);
  eq(again.merged, 1, "importing the same file again merges into the same profile");
  eq(again.created, 0);
  same(strip(target.p.exportJSON()), strip(src.text), "and changes nothing (idempotent)");

  const bom = make({ clock }).p.importJSON(String.fromCharCode(0xfeff) + src.text);
  ok(bom.ok, "a UTF-8 byte order mark is tolerated");

  const dry = make({ clock });
  const before = dry.storage.snapshot();
  const preview = dry.p.importJSON(src.text, { dryRun: true });
  ok(preview.ok && preview.dryRun === true && preview.rounds === 3, "dryRun reports what would be imported");
  eq(dry.storage.snapshot(), before, "and writes nothing");
  same(dry.p.list(), []);

  const both = make({ clock, uid: makeUid("C") });
  both.p.create({ name: "One" });
  both.p.create({ name: "Two" });
  const all = JSON.parse(both.p.exportJSON("all"));
  eq(all.profiles.length, 2, 'exportJSON("all") has every profile');
  eq(JSON.parse(both.p.exportJSON(both.p.list()[1].id)).profiles[0].name, "Two", "exportJSON(id) exports that profile");
  eq(JSON.parse(both.p.exportJSON()).profiles[0].name, "One", "exportJSON() exports the active profile");
  both.p.setGoogleSub(both.p.list()[0].id, "sub-1");
  eq(JSON.parse(both.p.exportJSON("all", { sync: true })).profiles[0].googleSub, "sub-1", "sync exports carry the Google subject");
  eq(JSON.parse(both.p.exportJSON("all")).profiles[0].googleSub, undefined, "manual ones do not");
}

{
  // Everything that is not a valid Ludus export is refused, and nothing is written.
  const clock = makeClock(T0);
  const src = sourceEnv("Source", clock, "A");
  const good = JSON.parse(src.text);
  const variant = (change) => {
    const doc = JSON.parse(src.text);
    change(doc);
    return JSON.stringify(doc);
  };
  const cases = [
    ["", "invalid-json"],
    ["not json", "invalid-json"],
    ["{", "invalid-json"],
    ["null", "invalid-format"],
    ["[]", "invalid-format"],
    ["42", "invalid-format"],
    ["\"text\"", "invalid-format"],
    ["{}", "invalid-format"],
    [variant((d) => { d.kind = "something-else"; }), "invalid-format"],
    [variant((d) => { delete d.kind; }), "invalid-format"],
    [variant((d) => { delete d.v; }), "invalid-format"],
    [variant((d) => { d.v = "1"; }), "invalid-format"],
    [variant((d) => { d.v = 1.5; }), "invalid-format"],
    [variant((d) => { d.v = 0; }), "invalid-format"],
    [variant((d) => { d.v = -3; }), "invalid-format"],
    [variant((d) => { d.v = 2; }), "unsupported-version"],
    [variant((d) => { d.v = 99; }), "unsupported-version"],
    [variant((d) => { d.profiles = "x"; }), "invalid-format"],
    [variant((d) => { d.profiles = {}; }), "invalid-format"],
    [variant((d) => { delete d.profiles; }), "invalid-format"],
    [variant((d) => { d.profiles = []; }), "no-profiles"],
    [variant((d) => { d.profiles = [1, null, "x", []]; }), "no-profiles"],
    ["x".repeat(constants.MAX_IMPORT_CHARS + 1), "too-large"],
  ];
  cases.forEach(([text, error], i) => {
    const target = make({ clock });
    const before = target.storage.snapshot();
    const result = target.p.importJSON(text);
    eq(result.ok, false, `hostile payload #${i} is refused`);
    eq(result.error, error, `hostile payload #${i}: ${error}`);
    eq(target.storage.snapshot(), before, `hostile payload #${i} wrote nothing`);
  });
  const target = make({ clock });
  eq(target.p.importJSON({ kind: "ludus-progress" }).error, "invalid-format", "only text is accepted");
  eq(target.p.importJSON(undefined).error, "invalid-format");
  eq(target.p.importJSON(src.text, { mode: "evil" }).error, "invalid-mode");
  eq(target.p.importJSON("x".repeat(constants.MAX_IMPORT_CHARS)).error, "invalid-json", "exactly the cap is read (and fails as JSON), one more is too large");
  eq(target.p.importJSON("[".repeat(200000) + "]".repeat(200000)).ok, false, "absurdly deep arrays are refused without a crash");
  eq(target.p.importJSON("{\"a\":".repeat(100000) + "1" + "}".repeat(100000)).ok, false, "and deep objects");
  const heavy = target.p.importJSON(JSON.stringify({ kind: "ludus-progress", v: 1, profiles: [{ name: "A".repeat(4000000), data: {} }] }));
  ok(heavy.ok && target.p.list()[0].name.length === 24, "a 4 MB name is cut to 24 characters");
  ok(good.profiles.length === 1);
}

{
  // A document that is well formed but full of hostile content is cleaned, not trusted.
  const clock = makeClock(T0);
  const src = sourceEnv("Source", clock, "A");
  const doc = JSON.parse(src.text);
  const template = doc.profiles[0].data.rounds[0];
  const evil = (overrides) => Object.assign({}, template, overrides);
  doc.profiles[0].data.rounds.push(
    evil({ id: "e_future", ts: Date.UTC(2999, 0, 1) }),
    evil({ id: "e_negative", ts: -5 }),
    evil({ id: "e_string_ts", ts: "2026-03-02" }),
    evil({ id: "<script>alert(1)</script>", ts: T0 }),
    evil({ id: "__proto__", ts: T0 }),
    evil({ id: "e_strings", ts: T0, points: "10", accuracy: "100" }),
    evil({ id: "e_badfen", ts: T0, fen: "javascript:alert(1)" }),
    evil({ id: "e_clamped", ts: T0 + 5, points: 99999, accuracy: -50, cpLoss: -1, hintsUsed: 77, tags: ["<b>", "ok_tag"] }),
    evil({ id: "e_almost_tomorrow", ts: T0 + 23 * 3600000 }),
    evil({ id: "e_two_days", ts: T0 + 48 * 3600000 }),
    evil({ id: "e_inf", ts: T0 + 6, points: 5, accuracy: 50, winLossPct: 777777771, timeSpentMs: 777777772 }),
    null, 5, "str", [],
  );
  let text = JSON.stringify(doc)
    .replace("777777771", "1e999")
    .replace("777777772", "-1e999");
  const target = make({ clock });
  const result = target.p.importJSON(text);
  ok(result.ok, "the document as a whole is accepted");
  const stored = dataOf(target.storage, src.id);
  const kept = stored.rounds.map((round) => round.id).sort();
  same(kept, ["e_almost_tomorrow", "e_clamped", "e_inf", "x1", "x2", "x3"], "future, malformed, mistyped and unsafe rounds are dropped; a day of clock skew is tolerated");
  ok(result.dropped >= 10, "and the drops are reported");
  const clamped = stored.rounds.find((round) => round.id === "e_clamped");
  eq(clamped.points, 10);
  eq(clamped.accuracy, 0);
  eq(clamped.cpLoss, 0);
  eq(clamped.hintsUsed, 3);
  same(clamped.tags, ["ok_tag"]);
  const inf = stored.rounds.find((round) => round.id === "e_inf");
  eq(inf.winLossPct, 0, "Infinity is not a number we keep");
  eq(inf.timeSpentMs, 0);
  ok(!/Infinity|NaN/.test(target.storage.map.get(`ludus.p.${src.id}.v1`)), "no non-finite value reaches storage");
}

{
  // Prototype pollution attempts in every place a key can be chosen by the attacker.
  const clock = makeClock(T0);
  const src = sourceEnv("Source", clock, "A");
  let text = src.text;
  const inject = (needle, extra) => {
    ok(text.includes(needle), `the payload has ${needle} to inject into`);
    text = text.replace(needle, needle + extra);
  };
  inject("\"kind\":", "\"ludus-progress\",\"__proto__\":{\"polluted\":\"top\"},\"constructor\":{\"prototype\":{\"polluted3\":1}},\"kind\":");
  inject("\"data\":{", "\"__proto__\":{\"polluted\":\"data\"},\"constructor\":{\"prototype\":{\"polluted2\":\"data\"}},\"prototype\":{},");
  inject("\"achievements\":{", "\"__proto__\":1785000000000,\"constructor\":1785000000000,\"prototype\":1785000000000,");
  inject("\"xpLog\":{", "\"__proto__\":[5,1785000000000],\"constructor\":[5,1785000000000],");
  inject("\"history\":{", "\"__proto__\":50,\"constructor\":50,");
  inject("\"rounds\":[{", "\"__proto__\":{\"polluted\":\"round\"},\"constructor\":{\"x\":1},");
  inject("\"notebook\":[{", "\"__proto__\":{\"polluted\":\"card\"},");
  inject("\"meta\":{", "\"__proto__\":{\"polluted\":\"meta\"},");
  text = text.replace("\"kind\":\"ludus-progress\",\"__proto__\"", "\"__proto__\"");
  const target = make({ clock });
  const result = target.p.importJSON(text);
  ok(result.ok, "a payload full of __proto__ keys still imports its legitimate content");
  eq({}.polluted, undefined, "Object.prototype.polluted is not set");
  eq({}.polluted2, undefined);
  eq({}.polluted3, undefined);
  eq(Object.getPrototypeOf(dataOf(target.storage, src.id)), Object.prototype);
  const storedText = Object.keys(Object.fromEntries(target.storage.map)).map((key) => target.storage.map.get(key)).join("\n");
  ok(!/"__proto__"|"constructor"|"prototype"/.test(storedText), "none of those keys reaches storage");
  const stored = dataOf(target.storage, src.id);
  same(Object.keys(stored.achievements).sort(), Object.keys(dataOf(src.env.storage, src.id).achievements).sort(), "only real achievements are kept");
  eq(stored.rounds.length, 3);
  ok(target.p.recordRound(rr(70, { ts: T0 + 10 })).ok, "the imported profile keeps working");
  const merged = make({ clock }).p.merge(text, src.text);
  eq({}.polluted, undefined, "merge() is equally safe");
  ok(merged === null || typeof merged === "object");
}

{
  // Inflated numbers, hostile cards and impossible dates.
  const clock = makeClock(T0);
  const src = sourceEnv("Source", clock, "A");
  const doc = JSON.parse(src.text);
  const data = doc.profiles[0].data;
  const truth = src.env.p.stats().xp;
  data.xp = 1e15;
  data.xpLog["r:x1"] = [999999, T0];
  data.xpLog["b:evil"] = [999999, T0];
  data.xpLog["r:ghost"] = [999999, T0];
  data.xpLog["../bad"] = [5, T0];
  data.xpLog["b:future"] = [5, Date.UTC(2999, 0, 1)];
  data.xpLog["b:short"] = [5];
  data.xpFloor = { upTo: 5, xp: 1e15, rounds: 1e15 };
  data.achievements.first_round = Date.UTC(2999, 0, 1);
  data.achievements.made_up = T0;
  data.days = ["2999-01-01", "2026-03-03", "2026-03-04", "2026-02-30", "nope", 5, "2026-03-02"];
  data.daily.lastDate = "2999-01-01";
  data.daily.history["2026-03-10"] = 50;
  data.daily.history["2026-03-02"] = 500;
  data.daily.streak = 1e9;
  data.notebook.push(
    { id: "../../etc/passwd", fen: fenN(40), box: 99, due: Date.UTC(3000, 0, 1), createdAt: -1, updatedAt: "yesterday", clearedAt: Date.UTC(3000, 0, 1),
      history: [null, 5, { ts: "x" }, { ts: T0, accuracy: 500, passed: "yes", box: -3, roundId: "<b>" }],
      tags: ["<b>", "ok"], lines: "nope", meta: "no", lastAccuracy: "high", reviews: -5, lapses: 1e9 },
    { fen: "junk" }, "card", null,
  );
  const target = make({ clock });
  const result = target.p.importJSON(JSON.stringify(doc));
  ok(result.ok);
  const stored = dataOf(target.storage, src.id);
  ok(stored.xp < 2000 && stored.xp >= truth - 1, `an inflated xp (1e15) is ignored (stored ${stored.xp}, honest ${truth})`);
  eq(stored.xpLog["r:x1"][0], 75, "a round's xp comes from the round, not the ledger");
  eq(stored.xpLog["b:evil"][0], 200, "a bonus entry is capped");
  ok(!("../bad" in stored.xpLog) && !("b:future" in stored.xpLog) && !("b:short" in stored.xpLog), "malformed ledger entries are dropped");
  eq(stored.xpFloor.upTo <= T0 + 86400000 && stored.xpFloor.rounds <= 1e7, true, "the floor is bounded");
  ok(stored.achievements.first_round <= clock.now(), "an unlock date in the future is clamped to now");
  ok(!("made_up" in stored.achievements), "unknown achievements are dropped");
  ok(stored.days.includes("2026-03-03") && stored.days.includes("2026-03-02"), "today and tomorrow are accepted as activity days");
  ok(!stored.days.some((day) => ["2999-01-01", "2026-03-04", "2026-02-30", "nope"].includes(day)), "future and impossible days are dropped");
  ok(stored.daily.lastDate !== "2999-01-01" && !("2026-03-10" in stored.daily.history), "future daily dates are dropped");
  eq(stored.daily.history["2026-03-02"], 100, "daily accuracy is clamped");
  ok(stored.daily.streak <= 100000, "the daily streak is bounded");
  const card = stored.notebook.find((item) => item.id === internals.cardIdFor(fenN(40)));
  ok(card, "the hostile card is kept, with a canonical id");
  eq(stored.notebook.length, 2, "and only it (junk cards are dropped)");
  eq(card.box, 5, "box clamps to the last one");
  ok(card.due <= T0 + 33 * 86400000, "an absurd due date is bounded by the longest interval");
  eq(card.createdAt, clock.now(), "an invalid creation date becomes now");
  eq(card.updatedAt, card.createdAt);
  ok(card.clearedAt <= clock.now(), "a future clearing date is clamped");
  same(card.history, [{ ts: T0, accuracy: 100, passed: false, box: 0 }], "only the well-formed history entry survives, cleaned");
  same(card.tags, ["ok"]);
  same(card.lines, []);
  same(card.meta, {});
  eq(card.lastAccuracy, null);
  eq(card.reviews, 0);
  eq(card.lapses, 100000);
}

{
  // Profile-level hostility, duplicates, and volume.
  const clock = makeClock(T0);
  const minimal = { v: 1 };
  const doc = { kind: "ludus-progress", v: 1, profiles: [
    { id: "p bad!", name: `<img src=x onerror=alert(1)>${CTRL}${"y".repeat(100)}`, color: "url(javascript:alert(1))", googleSub: "a b<script>", createdAt: "never", data: minimal },
    { id: "dup", name: "First", data: minimal },
    { id: "dup", name: "Second", data: minimal },
    { id: "ok_id", name: "   ", data: minimal },
  ] };
  const target = make({ clock });
  const result = target.p.importJSON(JSON.stringify(doc));
  ok(result.ok);
  eq(result.profiles, 4);
  const list = target.p.list();
  eq(list.length, 4, "every profile is imported");
  eq(new Set(list.map((profile) => profile.id)).size, 4, "duplicate and invalid ids are regenerated");
  ok(list.some((profile) => profile.id === "dup") && list.filter((profile) => /^p_/.test(profile.id)).length === 2, "the first 'dup' keeps its id, the others get fresh ones");
  ok(list.every((profile) => profile.name.length <= 24 && !/[\u0000-\u001f]/.test(profile.name) && constants.PALETTE.includes(profile.color) || /^#[0-9a-f]{6}$/.test(profile.color)), "names are capped and cleaned, colors are safe");
  eq(list.find((profile) => profile.id === "ok_id").name, "Player", "a blank name becomes the default");
  ok(list.every((profile) => profile.googleSub === undefined), "a malformed subject is dropped");
  eq(target.p.exportJSON("all").includes("javascript:"), false, "no hostile color survived");

  const many = { kind: "ludus-progress", v: 1, profiles: Array.from({ length: 20 }, (_, i) => ({ id: `m${i}`, name: `M${i}`, data: minimal })) };
  const limited = make({ clock });
  const before = limited.storage.snapshot();
  const overflow = limited.p.importJSON(JSON.stringify(many));
  eq(overflow.error, "limit", "more profiles than fit is an error");
  eq(overflow.max, constants.MAX_PROFILES);
  eq(limited.storage.snapshot(), before, "all or nothing: not even the first six were imported");

  const flood = { kind: "ludus-progress", v: 1, profiles: [{ id: "flood", name: "F", data: { rounds: [rr(1, { id: "v0" })].concat(Array.from({ length: 4999 }, () => ({}))) } }] };
  const floodTarget = make({ clock });
  const floodResult = floodTarget.p.importJSON(JSON.stringify(flood));
  ok(floodResult.ok);
  eq(floodResult.rounds, 1);
  eq(floodResult.dropped, 1999, "only the first 2000 entries of an array are even looked at");

  const volume = { kind: "ludus-progress", v: 1, profiles: [{ id: "vol", name: "V", data: { rounds: Array.from({ length: 700 }, (_, i) => rr(i, { id: `v${i}`, ts: T0 - (700 - i) * 1000, fen: fenN(i), points: 5, accuracy: 50 })) } }] };
  const volumeTarget = make({ clock });
  const volumeResult = volumeTarget.p.importJSON(JSON.stringify(volume));
  eq(volumeResult.rounds, 600, "700 rounds are capped to the window");
  eq(volumeTarget.p.stats("vol").windowPositions, 600);
  eq(volumeTarget.p.stats("vol").totalPositions, 700, "but all 700 count as positions played");
  eq(volumeTarget.p.stats("vol").xp, 700 * 50, "and all 700 pay their xp");
}

{
  // Import modes and profile matching.
  const clock = makeClock(T0);
  const rec = (env, n, extra = {}) => env.p.recordRound(rr(n, Object.assign({ id: `m${n}`, ts: clock.now() + n, fen: fenN(n) }, extra)));

  // merge into the same profile id
  const one = make({ clock, uid: makeUid("A") });
  one.p.create({ name: "Shared" });
  [1, 2, 3].forEach((n) => rec(one, n));
  const two = make({ clock, uid: makeUid("A") });
  two.p.create({ name: "Shared" });
  [3, 4].forEach((n) => rec(two, n));
  const merged = two.p.importJSON(one.p.exportJSON());
  eq(merged.merged, 1, "a profile with the same id is merged");
  eq(merged.created, 0);
  eq(two.p.list().length, 1);
  same(two.p.rounds().map((round) => round.id).sort(), ["m1", "m2", "m3", "m4"], "rounds are the union by id");
  eq(two.p.stats().xp, 4 * 75, "and the shared round pays once");
  const back = one.p.importJSON(two.p.exportJSON());
  ok(back.ok);
  same(strip(one.p.exportJSON()).profiles[0].data.rounds, strip(two.p.exportJSON()).profiles[0].data.rounds, "both sides end up identical");
  eq(one.p.stats().xp, two.p.stats().xp);

  // replace
  const rep = make({ clock, uid: makeUid("A") });
  rep.p.create({ name: "Old name" });
  rep.p.create({ name: "Other" });
  rec(rep, 9);
  const replaced = rep.p.importJSON(one.p.exportJSON(), { mode: "replace" });
  eq(replaced.merged, 1);
  same(rep.p.rounds(rep.p.list()[0].id).map((round) => round.id).sort(), ["m1", "m2", "m3", "m4"], "replace overwrites the matching profile");
  eq(rep.p.list()[0].name, "Shared", "including its name");
  eq(rep.p.list().length, 2, "and leaves the others alone");

  // add
  const add = make({ clock, uid: makeUid("A") });
  add.p.create({ name: "Mine" });
  rec(add, 20);
  const added = add.p.importJSON(one.p.exportJSON(), { mode: "add" });
  eq(added.created, 1, "add always creates");
  eq(add.p.list().length, 2);
  ok(add.p.list()[1].id !== one.p.list()[0].id, "with a fresh id");
  eq(add.p.rounds(add.p.list()[0].id).length, 1, "the existing profile is untouched");
  eq(add.p.rounds(add.p.list()[1].id).length, 4, "the copy holds everything the source profile had by then (m1..m4)");

  // limit, all or nothing
  const full = make({ clock, uid: makeUid("F") });
  for (let i = 0; i < constants.MAX_PROFILES - 1; i += 1) full.p.create({ name: `P${i}` });
  const two2 = { kind: "ludus-progress", v: 1, profiles: [{ id: "n1", name: "N1", data: { v: 1 } }, { id: "n2", name: "N2", data: { v: 1 } }] };
  const snapshot = full.storage.snapshot();
  eq(full.p.importJSON(JSON.stringify(two2)).error, "limit");
  eq(full.storage.snapshot(), snapshot);
  eq(full.p.importJSON(JSON.stringify(Object.assign({}, two2, { profiles: two2.profiles.slice(0, 1) }))).ok, true, "one more still fits");

  // into: merge a foreign profile into a chosen local one
  const local = make({ clock, uid: makeUid("L") });
  local.p.create({ name: "Local" });
  rec(local, 30);
  const into = local.p.importJSON(one.p.exportJSON(), { into: local.p.list()[0].id });
  eq(into.merged, 1);
  eq(local.p.list().length, 1, "no new profile");
  eq(local.p.list()[0].name, "Local", "the local name stays");
  eq(local.p.rounds().length, 5, "its own round plus the four imported");
  eq(local.p.importJSON(one.p.exportJSON(), { into: "nope" }).error, "no-such-profile");

  // Google subject
  const linked = make({ clock, uid: makeUid("G") });
  linked.p.create({ name: "Linked" });
  linked.p.setGoogleSub(linked.p.list()[0].id, "sub-123");
  one.p.setGoogleSub(one.p.list()[0].id, "sub-123");
  const bySub = linked.p.importJSON(one.p.exportJSON("all", { sync: true }));
  eq(bySub.merged, 1, "profiles with the same Google subject are the same person");
  eq(linked.p.list().length, 1);
  eq(linked.p.rounds().length, 4);
  eq(linked.p.list()[0].googleSub, "sub-123");
  one.p.setGoogleSub(one.p.list()[0].id, null);
}

{
  // Import is atomic: a failure part-way restores everything.
  const clock = makeClock(T0);
  const src = sourceEnv("Source", clock, "A");
  const local = make({ clock, uid: makeUid("A") });
  local.p.create({ name: "Local" });
  local.p.recordRound(rr(40, { id: "l1", ts: clock.now(), fen: fenN(40) }));
  const doc = JSON.parse(src.text);
  doc.profiles.push({ id: "extra", name: "Extra", data: { v: 1, rounds: [rr(41, { id: "e1", fen: fenN(41) })] } });
  const before = local.storage.snapshot();
  const statsBefore = local.p.stats();
  local.storage.failKey = (key) => key === "ludus.profiles.v1";
  const result = local.p.importJSON(JSON.stringify(doc));
  eq(result.error, "storage-failed");
  eq(local.storage.snapshot(), before, "every key is back to what it was (data keys written before the failure are rolled back)");
  local.storage.failKey = null;
  same(local.p.stats(), statsBefore, "and the in-memory state agrees");
  eq(local.p.list().length, 1);
  ok(local.p.importJSON(JSON.stringify(doc)).ok, "the same import works once the storage does");
}

{
  // Newly earned achievements found in imported data are announced.
  const clock = makeClock(T0);
  const src = sourceEnv("Source", clock, "A");
  const doc = JSON.parse(src.text);
  doc.profiles[0].data.achievements = {};
  const target = make({ clock });
  target.p.importJSON(JSON.stringify(doc));
  ok(target.p.achievements.unlocked().map((entry) => entry.id).includes("first_round"), "import re-evaluates achievements");
  ok(target.named("achievement:unlocked").length >= 1, "and announces them");
}

{
  // Two devices sync through export / import, linked by the Google subject.
  const clock = makeClock(T0);
  const a = make({ clock, uid: makeUid("A") });
  const b = make({ clock, uid: makeUid("B") });
  const idA = a.p.ensureActive().id;
  const idB = b.p.ensureActive().id;
  ok(idA !== idB, "the devices have different profile ids");
  a.p.setGoogleSub(idA, "sub-1");
  b.p.setGoogleSub(idB, "sub-1");
  a.p.recordRound(rr(1, { id: "a1", ts: clock.now(), fen: fenN(1) }));
  a.p.recordRound(bad(2, { id: "a2", ts: clock.now() + 1, fen: fenN(2) }));
  b.p.recordRound(rr(3, { id: "b1", ts: clock.now() + 2, fen: fenN(3) }));
  b.p.recordRound(rr(4, { id: "b2", ts: clock.now() + 3, fen: fenN(4), qualityCode: "perfect", accuracy: 100, points: 10, isBest: true }));
  b.p.daily.complete("2026-03-02", 70);

  b.p.importJSON(a.p.exportJSON("all", { sync: true }));
  a.p.importJSON(b.p.exportJSON("all", { sync: true }));
  eq(a.p.list().length, 1);
  eq(b.p.list().length, 1);
  const ids = (env) => env.p.rounds().map((round) => round.id).sort();
  same(ids(a), ["a1", "a2", "b1", "b2"]);
  same(ids(b), ["a1", "a2", "b1", "b2"]);
  eq(a.p.stats().xp, b.p.stats().xp, "both devices agree on xp");
  eq(a.p.stats().xp, 75 + 20 + 75 + 100 + (40 + 28 + 5), "and it is the honest sum");
  eq(a.p.notebook.counts().total, 1);
  eq(a.p.stats().dailyStreak.best, 1, "daily state travelled too");
  const settled = strip(a.p.exportJSON("all", { sync: true }));
  a.p.importJSON(b.p.exportJSON("all", { sync: true }));
  b.p.importJSON(a.p.exportJSON("all", { sync: true }));
  same(strip(a.p.exportJSON("all", { sync: true })), settled, "syncing again changes nothing");
  same(a.p.stats().achievements, b.p.stats().achievements);
}

// ---------- Caps on load ----------

{
  const { p, storage } = make();
  const cards = [];
  for (let i = 0; i < 1100; i += 1) {
    cards.push({ fen: fenN(i), box: i % 6, due: T0, createdAt: T0 - 1e7 + i, updatedAt: T0 - 1e6 + i, clearedAt: i < 50 ? T0 - 5e5 : null });
  }
  const sessions = Array.from({ length: 250 }, (_, i) => ({ id: `cs${i}`, ts: T0 - (250 - i) * 60000, kind: "own", mode: "solo", positions: 1, points: 5, maxPoints: 10, avgAccuracy: 50, durationMs: 1 }));
  const days = Array.from({ length: 900 }, (_, i) => internals.keyFromDayNumber(internals.dayNumber("2023-09-01") + i));
  const history = {};
  for (let i = 0; i < 150; i += 1) history[internals.keyFromDayNumber(internals.dayNumber("2025-10-01") + i)] = 50;
  seed(storage, "p1", { notebook: cards, sessions, days, daily: { lastDate: "2026-02-27", streak: 3, best: 3, history } });
  eq(p.notebook.counts().total, 1000, "the notebook is capped at 1000 cards");
  eq(p.notebook.list({ cleared: true }).length, 0, "cleared cards are the first to go");
  eq(p.notebook.get(internals.cardIdFor(fenN(10))), null);
  eq(p.notebook.get(internals.cardIdFor(fenN(53))), null, "then the highest boxes, oldest first");
  eq(p.notebook.get(internals.cardIdFor(fenN(347))), null);
  ok(p.notebook.get(internals.cardIdFor(fenN(353))), "a newer box-5 card stays");
  ok(p.notebook.get(internals.cardIdFor(fenN(54))), "and so does every box-0 card");
  eq(p.sessions().length, 200, "sessions are capped at 200");
  eq(p.sessions()[0].id, "cs249", "the newest are kept");
  eq(p.sessions()[199].id, "cs50");
  const stored = internals.sanitizeData(dataOf(storage, "p1"), internals.trustedCtx(T0, () => "x"));
  eq(stored.days.length, 800, "activity days are capped at 800");
  eq(stored.days[799], days[899], "keeping the newest");
  eq(Object.keys(stored.daily.history).length, 120, "daily history is capped at 120");
  eq(stored.daily.lastDate, "2026-02-27");
}

// ---------- Fuzzing the importer ----------

{
  // 400 documents with random nodes replaced by junk: nothing may throw, nothing
  // may pollute, and whatever gets stored must already be canonical.
  const clock = makeClock(T0);
  const src = sourceEnv("Source", clock, "A");
  const base = JSON.parse(src.text);
  const junk = [
    null, true, false, 0, -1, 1.5, 9e15, -9e15, 1e-9, "", "x".repeat(2000), "__proto__", "constructor", "<script>alert(1)</script>",
    "2999-01-01", "2026-03-02", [], {}, [[[]]], [null, null], { "__proto__": { polluted: "fuzz" } }, JSON.parse("{\"__proto__\":{\"polluted\":\"fuzz2\"}}"),
    String.fromCharCode(0, 1, 2, 27), "e2e4", "e2e9", "w", "8/8/8/8/8/8/8/8 w - - 0 1", Date.UTC(2999, 0, 1), Date.UTC(1970, 0, 1), T0,
  ];
  const rnd = mulberry32(20260302);
  const pathsOf = (value, prefix = []) => {
    const out = [prefix];
    if (value && typeof value === "object") {
      Object.keys(value).forEach((key) => pathsOf(value[key], prefix.concat(key)).forEach((path) => out.push(path)));
    }
    return out;
  };
  const setAt = (root, path, value) => {
    let node = root;
    for (let i = 0; i < path.length - 1; i += 1) node = node[path[i]];
    node[path[path.length - 1]] = value;
  };
  let accepted = 0;
  let refused = 0;
  for (let i = 0; i < 400; i += 1) {
    const doc = JSON.parse(JSON.stringify(base));
    const paths = pathsOf(doc).filter((path) => path.length > 0);
    for (let k = 1 + Math.floor(rnd() * 4); k > 0; k -= 1) {
      const path = paths[Math.floor(rnd() * paths.length)];
      try {
        setAt(doc, path, junk[Math.floor(rnd() * junk.length)]);
      } catch (error) {
        // the path was cut by an earlier replacement; skip it
      }
    }
    const text = JSON.stringify(doc);
    const target = make({ clock, rethrow: true });
    const before = target.storage.snapshot();
    let result;
    try {
      result = target.p.importJSON(text);
    } catch (error) {
      assert.fail(`fuzz #${i} threw: ${error && error.stack}\n${text.slice(0, 300)}`);
    }
    assertions += 1;
    if (result.ok) {
      accepted += 1;
      result.profileIds.forEach((id) => {
        const stored = dataOf(target.storage, id);
        const again = internals.sanitizeData(stored, internals.trustedCtx(clock.now(), () => "x"));
        try {
          assert.deepStrictEqual(again, stored);
        } catch (error) {
          assert.fail(`fuzz #${i}: stored data is not canonical\n${text.slice(0, 300)}`);
        }
        assert.ok(stored.rounds.length <= 600 && stored.notebook.length <= 1000 && Number.isFinite(stored.xp) && stored.xp >= 0);
      });
      assertions += 1;
    } else {
      refused += 1;
      eq(target.storage.snapshot(), before, `fuzz #${i}: a refused import wrote nothing`);
    }
    if ({}.polluted !== undefined || {}.polluted2 !== undefined || {}.fuzz !== undefined) assert.fail(`fuzz #${i} polluted Object.prototype`);
  }
  ok(accepted > 100 && refused > 20, `the fuzz exercised both outcomes (${accepted} accepted, ${refused} refused)`);
  eq({}.polluted, undefined);

  // The same junk through merge() and through recordRound().
  const { p } = make({ clock });
  let processed = 0;
  for (let i = 0; i < 300; i += 1) {
    const data = JSON.parse(JSON.stringify(base.profiles[0].data));
    const paths = pathsOf(data).filter((path) => path.length > 0);
    for (let k = 1 + Math.floor(rnd() * 3); k > 0; k -= 1) {
      const path = paths[Math.floor(rnd() * paths.length)];
      try {
        setAt(data, path, junk[Math.floor(rnd() * junk.length)]);
      } catch (error) {
        // skip
      }
    }
    const merged = p.merge(data, base.profiles[0].data);
    ok(merged === null || (merged.v === 1 && merged.rounds.length <= 600), `fuzzed merge #${i} returns clean data`);
    const round = JSON.parse(JSON.stringify(base.profiles[0].data.rounds[0]));
    const roundPaths = pathsOf(round).filter((path) => path.length > 0);
    setAt(round, roundPaths[Math.floor(rnd() * roundPaths.length)], junk[Math.floor(rnd() * junk.length)]);
    round.id = `fz${i}`;
    const recorded = p.recordRound(round);
    if (recorded) processed += 1;
    ok(recorded === false || recorded.ok === true, `fuzzed round #${i} is recorded or refused, never thrown`);
  }
  ok(processed > 50, `most fuzzed rounds are still recorded after cleaning (${processed})`);
  eq({}.polluted, undefined);
}

// ---------- merge(): pure, commutative, idempotent ----------

function mulberry32(seedValue) {
  let a = seedValue;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A raw profile data object drawn from shared pools, so two of them overlap
// (same rounds and sessions with equal content, the same cards in different
// states, the same days) the way two devices do.
function genData(seedValue) {
  const rnd = mulberry32(seedValue);
  const chance = (p) => rnd() < p;
  const int = (n) => Math.floor(rnd() * n);
  const rounds = [];
  for (let k = 0; k < 40; k += 1) {
    if (chance(0.6)) rounds.push(rr(k, { id: `m${k}`, ts: T0 - (40 - k) * 3600000, points: 1 + (k % 9), accuracy: 10 + (k % 9) * 10, fen: fenN(k), tags: k % 3 ? ["fork"] : [] }));
  }
  const sessions = [];
  for (let k = 0; k < 8; k += 1) {
    if (chance(0.6)) sessions.push({ id: `ms${k}`, ts: T0 - (8 - k) * 86400000, kind: "classic", title: `S${k}`, mode: "solo", positions: 5, points: 20 + k, maxPoints: 50, avgAccuracy: 40 + k, durationMs: 1000, byQuality: { good: 2 }, roundIds: [] });
  }
  const notebook = [];
  for (let k = 0; k < 12; k += 1) {
    if (!chance(0.6)) continue;
    const history = [];
    for (let h = int(4); h > 0; h -= 1) history.push({ ts: T0 - int(30) * 3600000, accuracy: int(100), passed: chance(0.5), box: int(6) });
    notebook.push({
      fen: fenN(k + 50), box: int(6), due: T0 + int(10) * 86400000, createdAt: T0 - 864e5 * (10 + int(3)), updatedAt: T0 - int(5) * 60000,
      reviews: int(5), lapses: int(3), lastAccuracy: int(100), clearedAt: chance(0.3) ? T0 - int(50) * 60000 : null, history, tags: chance(0.5) ? ["pin"] : [],
    });
  }
  const achievements = {};
  ["first_round", "hot_streak", "streak_3", "positions_100"].forEach((id) => {
    if (chance(0.5)) achievements[id] = T0 - int(100) * 3600000;
  });
  const days = [];
  for (let d = 0; d < 20; d += 1) {
    if (chance(0.5)) days.push(internals.keyFromDayNumber(internals.dayNumber("2026-02-10") + d));
  }
  const history = {};
  for (let d = 0; d < 10; d += 1) {
    if (chance(0.6)) history[internals.keyFromDayNumber(internals.dayNumber("2026-02-20") + d)] = int(101);
  }
  const dates = Object.keys(history).sort();
  let streak = 0;
  if (dates.length) {
    let n = internals.dayNumber(dates[dates.length - 1]);
    while (Object.prototype.hasOwnProperty.call(history, internals.keyFromDayNumber(n))) { streak += 1; n -= 1; }
  }
  const xpLog = {};
  for (let d = 0; d < 6; d += 1) {
    if (chance(0.5)) xpLog[`b:streak:2026-02-${10 + d}`] = [10 + int(41), T0 - 864e5 * 20 + d];
  }
  return {
    v: 1, rounds, sessions, notebook, achievements, days, xpLog,
    daily: { lastDate: dates.length ? dates[dates.length - 1] : null, streak: streak ? Math.max(1, streak - int(2)) : 0, best: streak + int(3), history },
    updatedAt: T0 - int(1000) * 60000,
  };
}

const toDoc = (id, data, extra = {}) => ({ kind: "ludus-progress", v: 1, app: "ludus-scaccorum", exportedAt: T0 - extra.age, profiles: [{ id, name: `N${id}`, color: "#2f6f4f", createdAt: T0 - 1e9, data }] });

{
  const { p } = make();
  const clean = (value) => JSON.parse(JSON.stringify(value));
  const empty = p.merge({}, {});
  ok(empty && empty.v === 1 && empty.xp === 0, "merging nothing yields empty canonical data");
  for (let seedValue = 1; seedValue <= 12; seedValue += 1) {
    const a = genData(seedValue);
    const b = genData(seedValue + 100);
    const c = genData(seedValue + 200);
    const snapshot = clean([a, b, c]);
    const ab = p.merge(a, b);
    same(ab, p.merge(b, a), `seed ${seedValue}: merge(a,b) equals merge(b,a)`);
    same(p.merge(a, a), p.merge(a, {}), `seed ${seedValue}: merge(a,a) is just a in canonical form`);
    same(p.merge(a, a), internals.sanitizeData(clean(a), internals.strictCtx(T0, () => "x")), `seed ${seedValue}: and that canonical form is what sanitizing a gives`);
    same(p.merge(ab, b), ab, `seed ${seedValue}: merging b again changes nothing`);
    same(p.merge(ab, a), ab, `seed ${seedValue}: merging a again changes nothing`);
    same(p.merge(ab, ab), ab, `seed ${seedValue}: merge(m,m) equals m`);
    same(p.merge(p.merge(a, b), c), p.merge(a, p.merge(b, c)), `seed ${seedValue}: merge is associative`);
    same(p.merge(p.merge(a, b), c), p.merge(p.merge(c, a), b), `seed ${seedValue}: any order gives the same result`);
    same(clean([a, b, c]), snapshot, `seed ${seedValue}: merge does not touch its inputs`);
    same(internals.sanitizeData(ab, internals.strictCtx(T0, () => "x")), ab, `seed ${seedValue}: the merged result is already canonical`);
    const expectedRounds = new Set(a.rounds.concat(b.rounds).map((round) => round.id)).size;
    eq(ab.rounds.length, expectedRounds, `seed ${seedValue}: rounds are the union by id`);
    const expectedCards = new Set(a.notebook.concat(b.notebook).map((card) => internals.cardIdFor(card.fen))).size;
    eq(ab.notebook.length, expectedCards, `seed ${seedValue}: cards are the union by position`);
  }
}

{
  const { p } = make();
  // XP is recomputed from the union, never added.
  const shared = rr(1, { id: "sh", ts: T0 - 5000, points: 5, fen: fenN(1) });
  const m1 = p.merge({ rounds: [shared, rr(2, { id: "ua", ts: T0 - 4000, points: 6, fen: fenN(2) })] }, { rounds: [shared, rr(3, { id: "ub", ts: T0 - 3000, points: 7, fen: fenN(3) })] });
  eq(m1.xp, 50 + 60 + 70, "a round both sides know is paid once, not twice");
  eq(m1.rounds.length, 3);
  eq(m1.xpLog["r:sh"][0], 50);

  const gone = { xpLog: { "r:gone": [40, T0 - 9000] } };
  const full = { rounds: [rr(4, { id: "gone", ts: T0 - 9000, points: 4, fen: fenN(4) })] };
  eq(p.merge(gone, full).xp, 40, "a round evicted on one side and still present on the other counts once");
  eq(p.merge(full, gone).xp, 40);
  eq(p.merge(gone, gone).xp, 40);
  eq(p.merge({ xpLog: { "b:streak:2026-02-11": [10, T0 - 5000] } }, { xpLog: { "b:streak:2026-02-11": [30, T0 - 4000] } }).xp, 30, "a bonus both sides recorded differently keeps the larger");
  eq(p.merge({ xpFloor: { upTo: T0 - 1e6, xp: 500, rounds: 5, bonuses: 0 } }, { xpFloor: { upTo: T0 - 2e6, xp: 300, rounds: 3, bonuses: 0 } }).xp, 500, "the more advanced floor wins");

  // Cards: later updatedAt wins, history merges, earliest creation and clearing.
  const base = { fen: fenN(5), source: "own", tags: ["x"] };
  const ca = Object.assign({}, base, { box: 1, due: T0, updatedAt: T0 - 1000, createdAt: T0 - 9e6, reviews: 1, lastReviewAt: T0 - 1000, history: [{ ts: T0 - 3000, accuracy: 20, passed: false, box: 0 }, { ts: T0 - 1000, accuracy: 80, passed: true, box: 1 }] });
  const cb = Object.assign({}, base, { box: 3, due: T0 + 7 * 86400000, updatedAt: T0 - 500, createdAt: T0 - 8e6, reviews: 3, clearedAt: T0 - 500, history: [{ ts: T0 - 3000, accuracy: 20, passed: false, box: 0 }, { ts: T0 - 500, accuracy: 90, passed: true, box: 3 }] });
  const cards = p.merge({ notebook: [ca] }, { notebook: [cb] });
  eq(cards.notebook.length, 1);
  eq(cards.notebook[0].box, 3, "the later updatedAt wins");
  eq(cards.notebook[0].history.length, 3, "histories merge (the shared entry once)");
  eq(cards.notebook[0].createdAt, T0 - 9e6, "the earliest creation date is kept");
  eq(cards.notebook[0].clearedAt, T0 - 500, "and the earliest clearing");
  same(cards, p.merge({ notebook: [cb] }, { notebook: [ca] }));
  const t1 = Object.assign({}, ca, { updatedAt: T0 - 100, box: 2 });
  const t2 = Object.assign({}, ca, { updatedAt: T0 - 100, box: 4 });
  same(p.merge({ notebook: [t1] }, { notebook: [t2] }), p.merge({ notebook: [t2] }, { notebook: [t1] }), "an updatedAt tie resolves identically in both orders");

  // Achievements: earliest unlock.
  same(p.merge({ achievements: { first_round: T0 - 100 } }, { achievements: { first_round: T0 - 500, hot_streak: T0 - 50 } }).achievements, { first_round: T0 - 500, hot_streak: T0 - 50 }, "achievements keep the earliest unlock and the union of ids");

  // Daily: the streak is rebuilt from the union of days.
  const dm = p.merge(
    { daily: { lastDate: "2026-03-01", streak: 2, best: 2, history: { "2026-02-28": 50, "2026-03-01": 60 } } },
    { daily: { lastDate: "2026-03-02", streak: 1, best: 5, history: { "2026-03-02": 70 } } },
  ).daily;
  eq(dm.lastDate, "2026-03-02");
  eq(dm.streak, 3, "Feb 28, Mar 1 and Mar 2 are consecutive");
  eq(dm.best, 5, "the best of both is kept");
  same(Object.keys(dm.history), ["2026-02-28", "2026-03-01", "2026-03-02"]);

  // Days and sessions union; conflicting content is deterministic.
  same(p.merge({ days: ["2026-03-01", "2026-03-02"] }, { days: ["2026-03-02", "2026-03-03"] }).days, ["2026-03-01", "2026-03-02", "2026-03-03"]);
  const sa = { id: "same", ts: T0, kind: "own", mode: "solo", positions: 1, points: 5, maxPoints: 10, avgAccuracy: 50, durationMs: 1 };
  const sb = Object.assign({}, sa, { points: 7 });
  same(p.merge({ sessions: [sa] }, { sessions: [sb] }), p.merge({ sessions: [sb] }, { sessions: [sa] }), "conflicting sessions with the same id resolve identically in both orders");
  eq(p.merge({ sessions: [sa] }, { sessions: [sb] }).sessions.length, 1);
  const ra = rr(1, { id: "same", points: 5 });
  const rb = rr(1, { id: "same", points: 9 });
  same(p.merge({ rounds: [ra] }, { rounds: [rb] }), p.merge({ rounds: [rb] }, { rounds: [ra] }), "so do conflicting rounds");

  // Volume: more than the window, and a ledger beyond its cap.
  const many = (prefix, from, to) => Array.from({ length: to - from }, (_, i) => rr(from + i, { id: `${prefix}${from + i}`, ts: T0 - (10000 - from - i) * 1000, points: 5, fen: fenN((from + i) % 1000) }));
  const big = p.merge({ rounds: many("a", 0, 400) }, { rounds: many("b", 400, 800) });
  eq(big.rounds.length, 600, "the union is capped to the window");
  eq(big.xp, 800 * 50, "but every round still pays");
  eq(Object.keys(big.xpLog).filter((key) => key.startsWith("r:")).length, 800);
  eq(big.rounds[0].id, "a200", "the oldest are the ones dropped: a0..a199 fell out, a200..a399 and b400..b799 stay");

  const ledger = (from, to) => {
    const log = {};
    for (let k = from; k < to; k += 1) log[`r:l${k}`] = [10, T0 - (6000 - k) * 1000];
    return { xpLog: log };
  };
  const la = ledger(0, 3000);
  const lb = ledger(2000, 5000);
  const lm = p.merge(la, lb);
  eq(Object.keys(lm.xpLog).length, 4000, "the ledger is capped at 4000 events");
  eq(lm.xpFloor.rounds, 1000, "and the oldest 1000 are folded into the floor");
  eq(lm.xp, 5000 * 10, "without losing a single xp");
  same(lm, p.merge(lb, la), "commutative even when the cap kicks in");
  same(p.merge(lm, lb), lm, "and idempotent");
  same(p.merge(lm, la), lm);
  same(p.merge(p.merge(la, lb), ledger(4500, 5500)), p.merge(la, p.merge(lb, ledger(4500, 5500))), "and associative here too");

  // Merge is as strict as import.
  const hostile = p.merge({ rounds: [rr(1, { id: "f1", ts: Date.UTC(2999, 0, 1) }), rr(2, { id: "ok", ts: T0 })], xp: 1e15 }, {});
  same(hostile.rounds.map((round) => round.id), ["ok"], "future rounds are refused by merge too");
  eq(hostile.xp, 75, "and xp is recomputed");
}

{
  // merge() on whole documents (what a sync sees) and on JSON text.
  const { p } = make();
  const docA = toDoc("pa", genData(7), { age: 1000 });
  docA.profiles.push({ id: "only_a", name: "OnlyA", color: "#8a4b2a", createdAt: T0 - 5e8, data: genData(8) });
  const docB = toDoc("pa", genData(9), { age: 500 });
  docB.profiles[0].name = "Renamed";
  docB.profiles[0].data.updatedAt = T0;
  docB.profiles.push({ id: "only_b", name: "OnlyB", color: "#2b5f8a", createdAt: T0 - 4e8, data: genData(10) });
  const ab = p.merge(docA, docB);
  same(ab, p.merge(docB, docA), "document merge is commutative");
  same(p.merge(ab, docB), ab, "and idempotent");
  same(p.merge(p.merge(docA, docB), docA), ab);
  same(p.merge(JSON.stringify(docA), JSON.stringify(docB)), ab, "JSON text and objects give the same result");
  eq(ab.kind, "ludus-progress");
  same(ab.profiles.map((profile) => profile.id).sort(), ["only_a", "only_b", "pa"], "profiles are matched by id, the others kept");
  eq(ab.profiles.find((profile) => profile.id === "pa").name, "Renamed", "the name of the more recently updated side wins");
  eq(ab.exportedAt, T0 - 500, "the newer export time is kept");
  eq(ab.profiles.find((profile) => profile.id === "pa").data.rounds.length, p.merge(docA.profiles[0].data, docB.profiles[0].data).rounds.length, "matched profiles merge like plain data");
  eq(p.merge("not json", docA), null, "unusable input gives null");
  eq(p.merge(docA, docB.profiles[0].data), null, "a document and plain data cannot be merged");
  eq(p.merge(null, {}), null);
  eq(p.merge(docA, { kind: "ludus-progress", v: 2, profiles: [] }).profiles.length, 2, "an unusable document counts as empty next to a good one");
  eq(p.merge({ kind: "ludus-progress", v: 2, profiles: [] }, { kind: "ludus-progress", v: 2, profiles: [] }), null);
}

// ---------- Idempotent grading, cross-tab freshness ----------

{
  const { p, clock } = make();
  p.recordRound(bad(1, { ts: clock.now() }));
  const id = p.notebook.list()[0].id;
  clock.set(at(2026, 3, 3, 9));
  const review = rr(60, { id: "rv1", fen: fenN(1), source: "notebook", sessionKind: "review", accuracy: 90, points: 9, ts: clock.now() });
  const recorded = p.recordRound(review);
  eq(recorded.card.box, 1);
  const again = p.notebook.grade(id, 90, clock.now(), { roundId: "rv1" });
  eq(again.duplicate, true, "grading with the id of a round already recorded is a no-op");
  eq(again.passed, true);
  eq(p.notebook.get(id).box, 1, "the card did not move twice");
  eq(p.notebook.get(id).reviews, 1);

  // the other way round: an explicit grade first, then the same round arrives
  p.recordRound(bad(2, { ts: clock.now() }));
  const id2 = p.notebook.list({ sort: "created" })[0].id;
  eq(p.notebook.grade(id2, 95, clock.now(), { roundId: "rv2" }).box, 1);
  const late = p.recordRound(rr(61, { id: "rv2", fen: fenN(2), source: "notebook", accuracy: 95, points: 9.5, ts: clock.now() }));
  eq(late.card, null, "the round finds its review already applied");
  eq(p.notebook.get(id2).box, 1);
  eq(p.notebook.get(id2).reviews, 1);
}

{
  // Another tab writes: after its "storage" event this tab reads the new state
  // instead of writing over it with a stale copy.
  const handlers = [];
  globalThis.addEventListener = (type, fn) => handlers.push([type, fn]);
  try {
    const storage = memoryStorage();
    const clock = makeClock(T0);
    const tabA = Profile.createInstance({ storage, now: clock.now, uid: makeUid("A"), i18n: Ludus.i18n, rethrow: true });
    const tabB = Profile.createInstance({ storage, now: clock.now, uid: makeUid("B"), i18n: Ludus.i18n, rethrow: true, listenStorage: false });
    const fire = (event) => handlers.filter(([type]) => type === "storage").forEach(([, fn]) => fn(event));
    tabA.ensureActive();
    tabA.recordRound(rr(1, { id: "a1" }));
    ok(handlers.some(([type]) => type === "storage"), "an instance listens for storage events by itself");
    tabB.recordRound(rr(2, { id: "b1", ts: T0 + 1 }));
    eq(tabA.stats().totalPositions, 1, "before the event, tab A still shows its cached copy");
    fire({ key: "unrelated.key" });
    eq(tabA.stats().totalPositions, 1, "an unrelated key changes nothing");
    fire({ key: "ludus.p.p_A1.v1" });
    eq(tabA.stats().totalPositions, 2, "the event for a profile key refreshes the cache");
    tabA.recordRound(rr(3, { id: "a2", ts: T0 + 2 }));
    same(JSON.parse(storage.map.get("ludus.p.p_A1.v1")).rounds.map((round) => round.id), ["a1", "b1", "a2"], "no update from the other tab was lost");
    eq(tabB.stats().totalPositions, 2, "tab B has not heard yet");
    tabB.reload();
    eq(tabB.stats().totalPositions, 3, "reload() refreshes it on demand");
    storage.map.clear();
    fire({ key: null });
    eq(tabA.stats().totalPositions, 0, "a cleared storage (key null) is noticed too");
  } finally {
    delete globalThis.addEventListener;
  }
}

// ---------- attach(), errors, the shared instance ----------

{
  const { p, bus, named } = make();
  eq(p.attach(), true);
  bus.emit("round:completed", { round: rr(1) });
  bus.emit("round:completed", { round: rr(1) });
  bus.emit("round:completed", {});
  bus.emit("round:completed", null);
  eq(p.stats().totalPositions, 1, "attach() records completed rounds (once, duplicates are ignored)");
  bus.emit("session:completed", { session: { id: "s1", ts: T0, kind: "classic", mode: "solo", positions: 1, points: 5, maxPoints: 10, avgAccuracy: 50, durationMs: 1 } });
  eq(p.sessions().length, 1, "and completed sessions");
  eq(p.recordRound(rr(1)).duplicate, true, "calling recordRound directly as well is harmless");
  p.detach();
  bus.emit("round:completed", { round: rr(2) });
  eq(p.stats().totalPositions, 1, "detach() stops it");
  ok(named("profile:changed").length > 0);
  eq(p.attach(), true);
  eq(p.attach(), true, "attaching twice does not double record");
  bus.emit("round:completed", { round: rr(3) });
  eq(p.stats().totalPositions, 2);
}

{
  // Guests (a duel player with no local profile) are emitted with profileId: null
  // and must not be filed under the active profile; recordRound() called directly
  // keeps its "null = the active profile" meaning (tested above).
  const { p, bus } = make();
  const a = p.create({ name: "A" });
  const b = p.create({ name: "B" });
  eq(p.attach(), true);
  bus.emit("round:completed", { round: rr(11, { profileId: a.id }) });
  bus.emit("round:completed", { round: rr(12, { profileId: null }) });
  bus.emit("round:completed", { round: rr(13, { profileId: b.id }) });
  eq(p.stats(a.id).totalPositions, 1, "a linked player's round is recorded");
  eq(p.stats(b.id).totalPositions, 1, "for each linked player");
  eq(p.rounds(a.id).length + p.rounds(b.id).length, 2, "the guest's round is recorded nowhere");
  const duel = (extra) => ({ id: "sd1", ts: T0, kind: "classic", mode: "duel", positions: 3, points: 40, maxPoints: 60, avgAccuracy: 66, durationMs: 1, duel: { names: ["A", "B"], scores: [22, 18] }, ...extra });
  bus.emit("session:completed", { session: duel({ profileId: null, duel: { names: ["A", "B"], scores: [22, 18], profileIds: [null, null] } }) });
  eq(p.sessions(a.id).length + p.sessions(b.id).length, 0, "a duel of two guests is recorded nowhere");
  bus.emit("session:completed", { session: duel({ id: "sd2", profileId: null, duel: { names: ["A", "B"], scores: [22, 18], profileIds: [a.id, null] } }) });
  eq(p.sessions(a.id).length, 1, "a duel with one linked player is recorded for that player");
  eq(p.sessions(b.id).length, 0);
}

{
  // Error messages exist in both languages.
  const { p } = make();
  ["too-large", "invalid-json", "invalid-format", "unsupported-version", "no-profiles", "limit", "storage-failed", "read-only", "invalid-mode", "no-such-profile"].forEach((code) => {
    const key = p.errorKey(code);
    const es = Ludus.i18n.t(key, { max: 4 }, "es");
    const en = Ludus.i18n.t(key, { max: 4 }, "en");
    ok(es !== key && en !== key && es !== en, `import error ${code} is translated`);
  });
  ok(/4/.test(Ludus.i18n.t(p.errorKey("limit"), { max: 4 }, "es")), "the limit message carries the number");
  eq(Profile.registerText(Ludus.i18n), false, "text is registered once");
}

{
  // The shared instance (what other modules use) against the real Ludus.storage / bus.
  const fake = createFakeLocalStorage();
  globalThis.localStorage = fake;
  const seen = [];
  const offs = ["profile:changed", "notebook:changed", "achievement:unlocked"].map((evt) => Ludus.bus.on(evt, (payload) => seen.push([evt, payload])));
  try {
    const profile = Profile.ensureActive();
    eq(profile.name, "Player");
    ok(fake.getItem("ludus.profiles.v1"), "the shared instance persists through Ludus.storage");
    const result = Profile.recordRound(bad(1, { ts: Date.now() }));
    ok(result && result.ok && result.card.created, "it records rounds and creates cards");
    ok(fake.getItem(`ludus.p.${profile.id}.v1`));
    ok(seen.some(([evt]) => evt === "notebook:changed"), "and emits on Ludus.bus");
    ok(seen.some(([evt]) => evt === "achievement:unlocked"));
    eq(Profile.stats().totalPositions, 1);
    eq(Profile.notebook.counts().total, 1);
    ok(JSON.parse(Profile.exportJSON()).profiles.length === 1);
    eq(Profile.wipe("all"), true);
    eq(fake.length, 0, "wipe('all') leaves nothing behind");
    globalThis.localStorage = createThrowingLocalStorage();
    Profile.reload();
    eq(Profile.recordRound(rr(2)), false, "with blocked storage the shared instance fails cleanly");
    eq(Profile.ensureActive(), null);
  } finally {
    offs.forEach((off) => off());
    Profile.detach();
    delete globalThis.localStorage;
    Profile.reload();
  }
  eq(Ludus.Profile, Profile, "require() and Ludus.Profile are the same object");
  ["list", "active", "create", "rename", "remove", "setActive", "ensureActive", "recordRound", "recordSession", "stats", "levelFor", "exportJSON", "importJSON", "merge", "wipe"].forEach((name) => {
    eq(typeof Profile[name], "function", `Profile.${name}`);
  });
  ["list", "get", "due", "grade", "add", "remove", "counts"].forEach((name) => eq(typeof Profile.notebook[name], "function", `Profile.notebook.${name}`));
  ["catalog", "unlocked", "evaluate"].forEach((name) => eq(typeof Profile.achievements[name], "function", `Profile.achievements.${name}`));
  ["status", "complete"].forEach((name) => eq(typeof Profile.daily[name], "function", `Profile.daily.${name}`));
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
console.log(`profile.test.js passed (${assertions} assertions)`);
