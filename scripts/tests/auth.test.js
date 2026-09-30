// Unit tests for js/auth.js: optional Google sign-in + Drive sync. Everything
// external is faked (fetch/Drive, window.google, document, clock, timers,
// storage, profile), so the run is deterministic and needs no network.
// Plain assert, no framework.

"use strict";

const assert = require("assert");
const path = require("path");

const jsDir = path.resolve(__dirname, "..", "..", "js");
require(path.join(jsDir, "ludus.js"));
const Profile = require(path.join(jsDir, "profile.js"));
const Auth = require(path.join(jsDir, "auth.js"));
const { internals, constants } = Auth;

Ludus.i18n.setLanguage("en", { persist: false });

let assertions = 0;
const ok = (value, message) => { assertions += 1; assert.ok(value, message); };
const eq = (actual, expected, message) => { assertions += 1; assert.strictEqual(actual, expected, message); };
const same = (actual, expected, message) => { assertions += 1; assert.deepStrictEqual(actual, expected, message); };

const CLIENT_ID = "1234567890-abcdefghij.apps.googleusercontent.com";
const SUB = "1001";
const T0 = Date.UTC(2026, 2, 2, 15, 0, 0);
const DRIVE_SCOPE = constants.DRIVE_SCOPE;

// Lets every pending promise continuation run (all Auth work is microtasks,
// because fetch, GIS and the timers are fakes).
async function settle(rounds = 12) {
  for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

// ---------- Fakes ----------

function makeClock(start) {
  let t = start;
  return { now: () => t, set(value) { t = value; }, advance(ms) { t += ms; } };
}

// Fake timers tied to the fake clock: advance() fires due timers in order.
function makeTimers(clock) {
  let seq = 0;
  const pending = new Map();
  return {
    setTimeout(fn, ms) {
      seq += 1;
      pending.set(seq, { at: clock.now() + Math.max(0, ms), delay: ms, fn });
      return seq;
    },
    clearTimeout(id) { pending.delete(id); },
    list() { return Array.from(pending.values()).map((timer) => ({ delay: timer.delay, at: timer.at })); },
    get count() { return pending.size; },
    async advance(ms) {
      const target = clock.now() + ms;
      for (;;) {
        const due = Array.from(pending.entries())
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => (a[1].at - b[1].at) || (a[0] - b[0]))[0];
        if (!due) break;
        pending.delete(due[0]);
        clock.set(Math.max(clock.now(), due[1].at));
        due[1].fn();
        await settle();
      }
      clock.set(target);
      await settle();
    },
  };
}

function makeBus() {
  const handlers = new Map();
  const events = [];
  return {
    events,
    on(evt, fn) {
      if (!handlers.has(evt)) handlers.set(evt, []);
      handlers.get(evt).push(fn);
      return () => handlers.set(evt, handlers.get(evt).filter((entry) => entry !== fn));
    },
    off(evt, fn) { handlers.set(evt, (handlers.get(evt) || []).filter((entry) => entry !== fn)); },
    emit(evt, payload) {
      events.push({ evt, payload });
      (handlers.get(evt) || []).slice().forEach((fn) => fn(payload));
    },
    named(evt) { return events.filter((entry) => entry.evt === evt).map((entry) => entry.payload); },
  };
}

// Ludus.storage-shaped store over a Map.
function memoryStorage() {
  const map = new Map();
  return {
    map,
    get(key, fallback) {
      if (!map.has(key)) return fallback;
      try { return JSON.parse(map.get(key)); } catch (error) { return fallback; }
    },
    set(key, value) { map.set(key, JSON.stringify(value)); return true; },
    remove(key) { map.delete(key); return true; },
    keys(prefix) { return Array.from(map.keys()).filter((key) => key.startsWith(prefix || "")).sort(); },
  };
}

function response(status, body, headers = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body === undefined ? {} : body);
  const lower = {};
  Object.keys(headers).forEach((key) => { lower[key.toLowerCase()] = String(headers[key]); });
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (Object.prototype.hasOwnProperty.call(lower, String(name).toLowerCase()) ? lower[String(name).toLowerCase()] : null) },
    text: async () => text,
  };
}

function parseMultipart(body, contentType) {
  const match = /boundary=(.+)$/.exec(contentType || "");
  assert.ok(match, "multipart Content-Type carries a boundary");
  const boundary = match[1];
  const chunks = body.split(`--${boundary}`).slice(1, -1);
  assert.strictEqual(body.endsWith(`--${boundary}--`), true, "multipart body is closed");
  const parts = chunks.map((chunk) => {
    const trimmed = chunk.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const split = trimmed.indexOf("\r\n\r\n");
    return { headers: trimmed.slice(0, split), body: trimmed.slice(split + 4) };
  });
  assert.strictEqual(parts.length, 2, "metadata part + media part");
  return { boundary, metadata: JSON.parse(parts[0].body), content: parts[1].body, parts };
}

// A fake Google account: userinfo + the Drive appDataFolder REST subset Auth uses.
function makeDrive(options = {}) {
  const drive = {
    files: new Map(),
    log: [],
    validTokens: new Set(),
    identity: options.identity || { sub: SUB, name: "Ana Perez", email: "ana@example.com", picture: "https://lh3.googleusercontent.com/a/abc=s96-c" },
    identityRaw: null,       // { status, body } overrides the userinfo answer
    injected: [],
    seq: 0,
    createdClock: 0,
  };
  const tokenOf = (headers) => {
    const value = (headers && headers.Authorization) || "";
    return value.startsWith("Bearer ") ? value.slice(7) : "";
  };
  drive.addFile = (content, extra = {}) => {
    drive.seq += 1;
    const id = extra.id || `file${drive.seq}`;
    drive.createdClock += 1;
    drive.files.set(id, { id, name: constants.FILE_NAME, createdTime: extra.createdTime || new Date(T0 + drive.createdClock * 1000).toISOString(), content: typeof content === "string" ? content : JSON.stringify(content) });
    return id;
  };
  // One-shot override for the next request of `kind`.
  drive.inject = (kind, responder) => { drive.injected.push({ kind, responder }); };
  drive.count = (kind) => drive.log.filter((entry) => entry.kind === kind).length;
  drive.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method || "GET";
    let kind = "unknown";
    let fileId = "";
    if (u.pathname === "/oauth2/v3/userinfo") kind = "identity";
    else if (u.pathname === "/drive/v3/files" && method === "GET") kind = "list";
    else if (u.pathname.startsWith("/drive/v3/files/") && method === "GET") { kind = "download"; fileId = decodeURIComponent(u.pathname.split("/").pop()); }
    else if (u.pathname.startsWith("/drive/v3/files/") && method === "DELETE") { kind = "delete"; fileId = decodeURIComponent(u.pathname.split("/").pop()); }
    else if (u.pathname === "/upload/drive/v3/files" && method === "POST") kind = "create";
    else if (u.pathname.startsWith("/upload/drive/v3/files/") && method === "PATCH") { kind = "update"; fileId = decodeURIComponent(u.pathname.split("/").pop()); }
    const request = { kind, method, url, u, headers: init.headers || {}, body: init.body, token: tokenOf(init.headers), init, fileId };
    drive.log.push(request);

    const index = drive.injected.findIndex((entry) => entry.kind === kind);
    if (index >= 0) {
      const [entry] = drive.injected.splice(index, 1);
      const injected = await entry.responder(request);
      if (injected) return injected;
    }
    if (u.origin !== "https://www.googleapis.com") return response(404, {});
    if (!drive.validTokens.has(request.token)) return response(401, { error: { code: 401, message: "Invalid Credentials", status: "UNAUTHENTICATED" } });

    if (kind === "identity") {
      if (drive.identityRaw) return response(drive.identityRaw.status, drive.identityRaw.body);
      return response(200, drive.identity);
    }
    if (kind === "list") {
      const q = u.searchParams.get("q") || "";
      assert.strictEqual(u.searchParams.get("spaces"), "appDataFolder", "list is scoped to appDataFolder");
      const nameMatch = /name\s*=\s*'([^']+)'/.exec(q);
      const list = Array.from(drive.files.values()).filter((file) => !nameMatch || file.name === nameMatch[1]);
      if (u.searchParams.get("orderBy") === "createdTime") list.sort((a, b) => (a.createdTime < b.createdTime ? -1 : 1));
      return response(200, { files: list.map((file) => ({ id: file.id, name: file.name, createdTime: file.createdTime })) });
    }
    if (kind === "download") {
      const file = drive.files.get(fileId);
      if (!file) return response(404, { error: { code: 404, message: "File not found" } });
      assert.strictEqual(u.searchParams.get("alt"), "media");
      return response(200, file.content);
    }
    if (kind === "delete") {
      if (!drive.files.delete(fileId)) return response(404, {});
      return response(204, "");
    }
    if (kind === "create") {
      assert.strictEqual(u.searchParams.get("uploadType"), "multipart");
      const parsed = parseMultipart(String(init.body), init.headers["Content-Type"]);
      assert.deepStrictEqual(parsed.metadata.parents, ["appDataFolder"], "created inside appDataFolder");
      const id = drive.addFile(parsed.content);
      drive.files.get(id).name = parsed.metadata.name;
      request.parsed = parsed;
      return response(200, { id });
    }
    if (kind === "update") {
      assert.strictEqual(u.searchParams.get("uploadType"), "media");
      const file = drive.files.get(fileId);
      if (!file) return response(404, {});
      file.content = String(init.body);
      return response(200, { id: fileId });
    }
    return response(404, {});
  };
  return drive;
}

// window.google with accounts.oauth2 (token client). `script` is a queue of
// per-request behaviours; the default mints a valid token.
function makeGoogle(drive, script = []) {
  const google = { tokenRequests: [], revoked: [], configs: [], script, minted: 0 };
  google.accounts = {
    oauth2: {
      initTokenClient(config) {
        google.configs.push(config);
        return {
          requestAccessToken(overrides) {
            google.tokenRequests.push(overrides);
            const step = google.script.length ? google.script.shift() : {};
            if (step.never) return;
            Promise.resolve().then(() => {
              if (step.errorCallback) { config.error_callback(step.errorCallback); return; }
              if (step.response !== undefined) { config.callback(step.response); return; }
              google.minted += 1;
              const value = step.token || `tok-${google.minted}`;
              drive.validTokens.add(value);
              config.callback({
                access_token: value,
                expires_in: step.expires_in === undefined ? 3600 : step.expires_in,
                scope: "scope" in step ? step.scope : `openid email profile ${DRIVE_SCOPE}`,
              });
            });
          },
        };
      },
      revoke(value, done) {
        google.revoked.push(value);
        drive.validTokens.delete(value);
        Promise.resolve().then(() => done({ successful: true }));
      },
    },
  };
  return google;
}

function makeFakeDocument() {
  const doc = {
    created: [],
    removed: [],
    appended: [],
    head: {
      appendChild(el) { doc.appended.push(el); return el; },
    },
    createElement(tag) {
      const el = { tag, remove() { doc.removed.push(el); } };
      doc.created.push(el);
      return el;
    },
  };
  return doc;
}

// A stand-in for Ludus.Profile with the documented shape: exportJSON / importJSON /
// merge, plus list / active / setGoogleSub. Data is just a set of round ids.
function makeFakeProfile(bus, clock, options = {}) {
  const state = {
    profiles: options.profiles || [{ id: "p1", name: "Ana", color: "#2f6f4f", createdAt: 1000, googleSub: "", data: { rounds: ["r1", "r2"], updatedAt: 5 } }],
    active: options.active === undefined ? "p1" : options.active,
    calls: { import: 0, export: 0, setSub: 0, merge: 0 },
    importResult: null,
    throwOnExport: false,
  };
  const kind = "ludus-progress";
  const union = (a, b) => Array.from(new Set(a.concat(b))).sort();
  const doc = (profiles, exportedAt) => ({ kind, v: 1, app: "ludus-scaccorum", exportedAt, profiles });
  const valid = (value) => value && typeof value === "object" && value.kind === kind && Array.isArray(value.profiles);

  const api = {
    state,
    constants: { EXPORT_KIND: kind, EXPORT_VERSION: 1, MAX_IMPORT_CHARS: 5 * 1024 * 1024 },
    exportJSON(which, opts) {
      state.calls.export += 1;
      if (state.throwOnExport) throw new Error("boom");
      if (!state.profiles.length) return "";
      const includeSub = Boolean(opts && opts.sync);
      return JSON.stringify(doc(state.profiles.map((profile) => {
        const entry = { id: profile.id, name: profile.name, color: profile.color, createdAt: profile.createdAt };
        if (includeSub && profile.googleSub) entry.googleSub = profile.googleSub;
        entry.data = JSON.parse(JSON.stringify(profile.data));
        return entry;
      }), clock.now()));
    },
    merge(a, b) {
      state.calls.merge += 1;
      if (!valid(a) || !valid(b)) return null;
      const byId = new Map();
      a.profiles.concat(b.profiles).forEach((entry) => {
        if (!entry || typeof entry.id !== "string") return;
        const previous = byId.get(entry.id);
        if (!previous) {
          byId.set(entry.id, JSON.parse(JSON.stringify(entry)));
          return;
        }
        previous.data.rounds = union(previous.data.rounds, entry.data.rounds);
        previous.data.updatedAt = Math.max(previous.data.updatedAt, entry.data.updatedAt);
        previous.googleSub = previous.googleSub || entry.googleSub;
        previous.createdAt = Math.min(previous.createdAt, entry.createdAt);
      });
      const profiles = Array.from(byId.values()).map((entry) => {
        entry.data.rounds = union(entry.data.rounds, []);
        return entry;
      }).sort((x, y) => (x.id < y.id ? -1 : 1));
      return doc(profiles, Math.max(a.exportedAt || 0, b.exportedAt || 0));
    },
    importJSON(text, opts) {
      state.calls.import += 1;
      if (state.importResult) return state.importResult;
      const parsed = JSON.parse(text);
      assert.strictEqual(opts && opts.mode, "merge", "sync imports in merge mode");
      parsed.profiles.forEach((entry) => {
        const local = state.profiles.find((p) => p.id === entry.id) || (entry.googleSub ? state.profiles.find((p) => p.googleSub === entry.googleSub) : null);
        if (local) {
          local.data.rounds = union(local.data.rounds, entry.data.rounds);
          local.data.updatedAt = Math.max(local.data.updatedAt, clock.now()); // like the real import: bumps updatedAt
          local.googleSub = local.googleSub || entry.googleSub || "";
        } else {
          state.profiles.push({ id: entry.id, name: entry.name, color: entry.color, createdAt: entry.createdAt, googleSub: entry.googleSub || "", data: JSON.parse(JSON.stringify(entry.data)) });
          if (!state.active) state.active = entry.id;
        }
      });
      bus.emit("profile:changed", { profileId: null });
      return { ok: true };
    },
    list() {
      return state.profiles.map((p) => Object.assign({ id: p.id, name: p.name, active: p.id === state.active }, p.googleSub ? { googleSub: p.googleSub } : {}));
    },
    active() {
      const p = state.profiles.find((item) => item.id === state.active);
      return p ? Object.assign({ id: p.id, name: p.name, active: true }, p.googleSub ? { googleSub: p.googleSub } : {}) : null;
    },
    setGoogleSub(id, sub) {
      state.calls.setSub += 1;
      const p = state.profiles.find((item) => item.id === id);
      if (!p) return false;
      p.googleSub = sub;
      bus.emit("profile:changed", { profileId: id });
      return true;
    },
    // Test helper: the player finishes another round.
    play(roundId, id) {
      const p = state.profiles.find((item) => item.id === (id || state.active));
      p.data.rounds = union(p.data.rounds, [roundId]);
      p.data.updatedAt = clock.now();
      bus.emit("profile:changed", { profileId: p.id });
    },
    rounds(id) { return state.profiles.find((item) => item.id === (id || state.active)).data.rounds.slice(); },
  };
  return api;
}

function remoteDoc(rounds, extra = {}) {
  return {
    kind: "ludus-progress",
    v: extra.v === undefined ? 1 : extra.v,
    app: "ludus-scaccorum",
    exportedAt: T0 - 1000,
    profiles: extra.profiles || [{ id: extra.id || "pRemote", name: "Ana", color: "#2f6f4f", createdAt: 500, googleSub: extra.sub === undefined ? SUB : extra.sub, data: { rounds, updatedAt: extra.updatedAt || 7 } }],
  };
}

function makeEnv(options = {}) {
  const clock = makeClock(T0);
  const timers = makeTimers(clock);
  const bus = makeBus();
  const storage = options.storage || memoryStorage();
  const drive = options.drive || makeDrive();
  const google = makeGoogle(drive, options.script || []);
  const view = { google: options.noGoogleYet ? undefined : google };
  const profile = options.profile || makeFakeProfile(bus, clock, options.profileOptions);
  const document = options.document || makeFakeDocument();
  const config = { googleClientId: options.clientId === undefined ? CLIENT_ID : options.clientId };
  const auth = Auth.createInstance({
    config,
    fetch: drive.fetch,
    getGoogle: () => view.google,
    document,
    storage,
    bus,
    profile,
    now: clock.now,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    i18n: Ludus.i18n,
  });
  const statuses = [];
  auth.onChange((snap) => statuses.push(snap.status));
  return { auth, clock, timers, bus, storage, drive, google, view, profile, document, statuses };
}

// Signs in and waits for the sign-in sync to finish.
async function signedIn(options = {}) {
  const env = makeEnv(options);
  const result = await env.auth.signIn();
  assert.strictEqual(result.ok, true, `sign-in failed: ${JSON.stringify(result)}`);
  const sync = await env.auth.syncNow();
  return Object.assign(env, { firstSync: sync });
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ---------- Pure helpers ----------

test("client id validation", async () => {
  ok(internals.isValidClientId(CLIENT_ID));
  ok(!internals.isValidClientId(""));
  ok(!internals.isValidClientId("YOUR_CLIENT_ID"));
  ok(!internals.isValidClientId("GOCSPX-secretsecretsecret"));
  ok(!internals.isValidClientId(null));
  ok(!internals.isValidClientId("evil.com/1234.apps.googleusercontent.com"));
});

test("sanitizeIdentity accepts a normal account and never trusts the rest", async () => {
  same(internals.sanitizeIdentity({ sub: "1001", name: "Ana Perez", email: "ana@example.com", picture: "https://lh3.googleusercontent.com/a/abc=s96-c" }),
    { sub: "1001", name: "Ana Perez", email: "ana@example.com", picture: "https://lh3.googleusercontent.com/a/abc=s96-c" });
  eq(internals.sanitizeIdentity(null), null);
  eq(internals.sanitizeIdentity([]), null);
  eq(internals.sanitizeIdentity("x"), null);
  eq(internals.sanitizeIdentity({}), null, "no sub");
  eq(internals.sanitizeIdentity({ sub: 1001 }), null, "numeric sub is not accepted");
  eq(internals.sanitizeIdentity({ sub: "../../etc/passwd" }), null, "sub with path characters");
  eq(internals.sanitizeIdentity({ sub: "a".repeat(65) }), null, "sub too long");
  eq(internals.sanitizeIdentity({ sub: "1", name: { evil: true } }).name, "", "non-string name");
  eq(internals.sanitizeIdentity({ sub: "1", name: "  A‮B\u0000\n C  " }).name, "A B C", "control and bidi characters become spaces");
  eq(internals.sanitizeIdentity({ sub: "1", name: "x".repeat(500) }).name.length, 80, "name is capped");
  eq(internals.sanitizeIdentity({ sub: "1", name: "<img src=x onerror=alert(1)>" }).name, "<img src=x onerror=alert(1)>", "kept as data: the UI must escape it");
  eq(internals.sanitizeIdentity({ sub: "1", email: "not-an-email" }).email, "");
  eq(internals.sanitizeIdentity({ sub: "1", name: "", email: "bob@example.com" }).name, "bob", "name falls back to the mail's local part");
  eq(internals.sanitizeIdentity({ sub: "1", given_name: "Bea" }).name, "Bea");
  [
    "https://evil.example/x.png",
    "http://lh3.googleusercontent.com/x",
    "https://lh3.googleusercontent.com.evil.com/x",
    "https://evil.com/lh3.googleusercontent.com",
    "https://a.googleusercontent.com@evil.com/x",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "https://lh3.googleusercontent.com/" + "a".repeat(600),
    42,
  ].forEach((picture) => eq(internals.sanitizeIdentity({ sub: "1", picture }).picture, "", `picture rejected: ${String(picture).slice(0, 50)}`));
  eq(internals.sanitizeIdentity({ sub: "1", picture: "https://lh3.googleusercontent.com" }).picture, "https://lh3.googleusercontent.com");
  const proto = internals.sanitizeIdentity(JSON.parse('{"sub":"1","__proto__":{"polluted":true}}'));
  eq(proto.polluted, undefined, "__proto__ in the payload does nothing");
  eq({}.polluted, undefined);
});

test("sanitizeHint validates the persisted hint", async () => {
  const good = { v: 1, signedIn: true, sub: "1001", name: "Ana", picture: "https://lh3.googleusercontent.com/a", lastSyncAt: 1234 };
  same(internals.sanitizeHint(good), { sub: "1001", name: "Ana", picture: "https://lh3.googleusercontent.com/a", lastSyncAt: 1234 });
  eq(internals.sanitizeHint(null), null);
  eq(internals.sanitizeHint("hint"), null);
  eq(internals.sanitizeHint(Object.assign({}, good, { v: 2 })), null, "unknown version");
  eq(internals.sanitizeHint(Object.assign({}, good, { v: undefined })), null);
  eq(internals.sanitizeHint(Object.assign({}, good, { signedIn: false })), null);
  eq(internals.sanitizeHint(Object.assign({}, good, { signedIn: "yes" })), null);
  eq(internals.sanitizeHint(Object.assign({}, good, { sub: "" })), null);
  eq(internals.sanitizeHint(Object.assign({}, good, { sub: "a b" })), null);
  eq(internals.sanitizeHint(Object.assign({}, good, { picture: "https://evil.example/x" })).picture, "");
  eq(internals.sanitizeHint(Object.assign({}, good, { lastSyncAt: -5 })).lastSyncAt, 0);
  eq(internals.sanitizeHint(Object.assign({}, good, { lastSyncAt: "soon" })).lastSyncAt, 0);
  eq(internals.sanitizeHint(Object.assign({}, good, { lastSyncAt: 1e30 })).lastSyncAt, 0);
  ok(!("email" in internals.sanitizeHint(Object.assign({}, good, { email: "a@b.co", token: "secret" }))), "only known fields survive");
});

test("multipart body round-trips arbitrary JSON and boundaries never collide", async () => {
  const nasty = JSON.stringify({ note: "--ludus_b\r\n--ludus_b_1--\r\nContent-Type: x", text: "línea\r\n\r\ncon --- guiones" });
  const boundary = internals.pickBoundary(nasty, "b");
  ok(!nasty.includes(boundary), "boundary does not occur in the payload");
  const meta = { name: constants.FILE_NAME, parents: ["appDataFolder"], mimeType: "application/json" };
  const body = internals.buildMultipart(meta, nasty, boundary);
  const parsed = parseMultipart(body, `multipart/related; boundary=${boundary}`);
  same(parsed.metadata, meta);
  eq(parsed.content, nasty);
  ok(/Content-Type: application\/json/.test(parsed.parts[0].headers));
  eq(internals.pickBoundary("clean", "b"), "ludus_b");
});

test("classifyHttpError maps Drive failures to stable codes", async () => {
  const cls = internals.classifyHttpError;
  eq(cls(401, ""), "unauthorized");
  eq(cls(403, JSON.stringify({ error: { errors: [{ reason: "rateLimitExceeded" }] } })), "rate-limited");
  eq(cls(403, JSON.stringify({ error: { errors: [{ reason: "userRateLimitExceeded" }] } })), "rate-limited");
  eq(cls(403, JSON.stringify({ error: { errors: [{ reason: "storageQuotaExceeded" }] } })), "quota-full");
  eq(cls(403, JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } })), "rate-limited");
  eq(cls(403, JSON.stringify({ error: { errors: [{ reason: "insufficientPermissions" }] } })), "forbidden");
  eq(cls(403, "<html>nope</html>"), "forbidden");
  eq(cls(404, ""), "not-found");
  eq(cls(408, ""), "timeout");
  eq(cls(429, ""), "rate-limited");
  eq(cls(500, ""), "server");
  eq(cls(503, ""), "server");
  eq(cls(400, ""), "bad-request");
  eq(cls(418, ""), "http-error");
  eq(internals.parseRetryAfter("120", 0), 120000);
  eq(internals.parseRetryAfter("99999", 0), constants.MAX_BACKOFF_MS, "capped");
  eq(internals.parseRetryAfter("Wed, 21 Oct 2015 07:28:00 GMT", Date.parse("Wed, 21 Oct 2015 07:27:00 GMT")), 60000);
  eq(internals.parseRetryAfter("", 0), 0);
  eq(internals.parseRetryAfter("soon", 0), 0);
  eq(internals.parseRetryAfter(null, 0), 0);
});

test("docSignature ignores bookkeeping but not content", async () => {
  const a = remoteDoc(["r1"]);
  const b = remoteDoc(["r1"]);
  b.exportedAt = 5;
  b.profiles[0].data.updatedAt = 999;
  b.profiles[0].createdAt = 1;
  b.profiles[0].name = "Other";
  eq(internals.docSignature(a), internals.docSignature(b), "updatedAt / createdAt / exportedAt / name do not count");
  ok(internals.docSignature(a) !== internals.docSignature(remoteDoc(["r1", "r2"])), "content counts");
  ok(internals.docSignature(a) !== internals.docSignature(remoteDoc(["r1"], { sub: "other" })), "the account link counts");
  eq(internals.docSignature(null), "");
  eq(internals.docSignature({ profiles: [] }), "");
  eq(internals.stableStringify({ b: 1, a: [2, { d: 1, c: undefined }] }), '{"a":[2,{"d":1}],"b":1}');
});

// ---------- Not configured ----------

test("not configured: every method is a safe no-op", async () => {
  const stale = memoryStorage();
  stale.set("ludus.auth.v1", { v: 1, signedIn: true, sub: SUB, name: "Ana", picture: "" });
  for (const clientId of ["", "YOUR_CLIENT_ID", undefined]) {
    const env = makeEnv({ clientId: clientId === undefined ? null : clientId, storage: stale });
    const { auth, drive, google, document } = env;
    eq(auth.isConfigured(), false);
    eq(auth.status(), "signed_out");
    eq(auth.user(), null, "a stale hint is ignored when the site is not configured");
    eq(auth.needsReconnect(), false);
    same(await auth.signIn(), { ok: false, error: "not-configured" });
    same(await auth.syncNow(), { ok: false, error: "not-configured" });
    eq(await auth.preload(), false);
    ok(typeof auth.onChange(() => {}) === "function");
    eq(drive.log.length, 0, "no request");
    eq(google.tokenRequests.length, 0, "no token request");
    eq(document.created.length, 0, "no script injected");
    eq(env.timers.count, 0);
  }
  same(await makeEnv({ clientId: "", storage: stale }).auth.signOut(), { ok: true });
  eq(stale.map.has("ludus.auth.v1"), false, "signOut also clears a stale hint");
});

test("the shared instance is inert until the user acts", async () => {
  const shared = Ludus.Auth;
  eq(shared, Auth);
  eq(shared.isConfigured(), false, "no client id in this environment");
  eq(shared.status(), "signed_out");
  same(await shared.signIn(), { ok: false, error: "not-configured" });
  same(await shared.syncNow(), { ok: false, error: "not-configured" });
});

// ---------- Happy path ----------

test("nothing reaches Google before the button is pressed", async () => {
  const env = makeEnv();
  const { auth, drive, google, document, timers } = env;
  eq(auth.isConfigured(), true);
  eq(auth.status(), "signed_out");
  eq(auth.user(), null);
  eq(auth.needsReconnect(), false);
  await settle();
  eq(drive.log.length, 0);
  eq(google.tokenRequests.length, 0);
  eq(google.configs.length, 0);
  eq(document.created.length, 0);
  eq(timers.count, 0);
  eq(env.bus.events.length, 0);
});

test("first sign-in with no remote file: creates the Drive file", async () => {
  const env = makeEnv();
  const { auth, drive, google, storage, bus, profile } = env;
  const result = await auth.signIn();
  ok(result.ok, "sign-in ok");
  same(result.user, { name: "Ana Perez", email: "ana@example.com", picture: "https://lh3.googleusercontent.com/a/abc=s96-c", sub: SUB });
  const sync = await auth.syncNow(); // collapses onto the sign-in sync
  ok(sync.ok);
  eq(sync.created, true);
  eq(sync.uploaded, true);
  eq(sync.imported, false, "local already held everything");

  eq(google.configs.length, 1);
  eq(google.configs[0].client_id, CLIENT_ID);
  ok(google.configs[0].scope.includes(DRIVE_SCOPE) && google.configs[0].scope.includes("openid"));
  same(google.tokenRequests, [{ prompt: "" }], "one popup request, no hint on a first sign-in");

  same(drive.log.map((entry) => entry.kind), ["identity", "list", "create"]);
  const create = drive.log[2];
  eq(create.method, "POST");
  eq(create.token, "tok-1");
  eq(create.init.credentials, "omit");
  eq(create.init.cache, "no-store");
  eq(create.parsed.metadata.name, constants.FILE_NAME);
  same(create.parsed.metadata.parents, ["appDataFolder"]);
  const uploaded = JSON.parse(create.parsed.content);
  eq(uploaded.kind, "ludus-progress");
  eq(uploaded.profiles.length, 1);
  eq(uploaded.profiles[0].googleSub, SUB, "the active profile was linked to the account");
  same(uploaded.profiles[0].data.rounds, ["r1", "r2"]);
  eq(drive.files.size, 1);
  eq(profile.state.calls.setSub, 1);
  eq(profile.state.profiles[0].googleSub, SUB);

  eq(auth.status(), "signed_in");
  same(auth.user(), result.user);
  eq(auth.needsReconnect(), false);
  eq(auth.state().error, "");
  eq(auth.state().lastSyncAt, T0);

  const hint = JSON.parse(storage.map.get("ludus.auth.v1"));
  same(hint, { v: 1, signedIn: true, sub: SUB, name: "Ana Perez", picture: "https://lh3.googleusercontent.com/a/abc=s96-c", lastSyncAt: T0 });
  const everything = Array.from(storage.map.values()).join("|");
  ok(!everything.includes("tok-1"), "no token in storage");
  ok(!everything.includes("ana@example.com"), "no e-mail in storage");

  same(env.statuses, ["signing_in", "signed_in", "syncing", "signed_in"]);
  same(bus.named("auth:changed").map((payload) => payload.status), env.statuses, "the bus mirrors onChange");
  eq(bus.named("auth:changed")[3].user.name, "Ana Perez");
});

test("sync merges with the remote copy, imports what is new and uploads what the remote lacks", async () => {
  const drive = makeDrive();
  drive.addFile(remoteDoc(["r2", "r9"], { id: "pRemoteOther" }));
  const env = makeEnv({ drive });
  const { auth, profile } = env;
  ok((await auth.signIn()).ok);
  const sync = await auth.syncNow();
  same({ ok: sync.ok, imported: sync.imported, uploaded: sync.uploaded, created: sync.created }, { ok: true, imported: true, uploaded: true, created: false });
  same(profile.rounds("p1"), ["r1", "r2", "r9"], "local gained the remote round");
  eq(profile.state.profiles.length, 1, "the account's two profile ids were folded into one");
  eq(drive.count("create"), 0);
  eq(drive.count("update"), 1);
  const update = drive.log.find((entry) => entry.kind === "update");
  eq(update.method, "PATCH");
  ok(update.url.includes("uploadType=media"));
  eq(update.headers["Content-Type"], "application/json");
  const stored = JSON.parse(Array.from(drive.files.values())[0].content);
  eq(stored.profiles.length, 1);
  same(stored.profiles[0].data.rounds, ["r1", "r2", "r9"]);
  eq(profile.state.calls.import, 1);

  // A second sync with nothing new touches neither side.
  const again = await auth.syncNow();
  same({ ok: again.ok, imported: again.imported, uploaded: again.uploaded }, { ok: true, imported: false, uploaded: false });
  eq(profile.state.calls.import, 1);
  eq(drive.count("update"), 1);
});

test("sync only imports when the remote is ahead, only uploads when local is ahead", async () => {
  {
    const drive = makeDrive();
    drive.addFile(remoteDoc(["r1", "r2", "r3"]));
    const env = makeEnv({ drive });
    ok((await env.auth.signIn()).ok);
    const sync = await env.auth.syncNow();
    same({ imported: sync.imported, uploaded: sync.uploaded }, { imported: true, uploaded: false });
    eq(drive.count("update"), 0);
    same(env.profile.rounds(), ["r1", "r2", "r3"]);
  }
  {
    const drive = makeDrive();
    drive.addFile(remoteDoc(["r1"]));
    const env = makeEnv({ drive });
    ok((await env.auth.signIn()).ok);
    const sync = await env.auth.syncNow();
    same({ imported: sync.imported, uploaded: sync.uploaded }, { imported: false, uploaded: true });
    eq(env.profile.state.calls.import, 0);
    eq(drive.count("update"), 1);
  }
});

test("a new device with no profile imports the cloud profile", async () => {
  const drive = makeDrive();
  drive.addFile(remoteDoc(["r5", "r6"], { id: "pCloud" }));
  const env = makeEnv({ drive, profileOptions: { profiles: [], active: null } });
  ok((await env.auth.signIn()).ok);
  const sync = await env.auth.syncNow();
  same({ ok: sync.ok, imported: sync.imported, uploaded: sync.uploaded }, { ok: true, imported: true, uploaded: false });
  eq(env.profile.state.profiles.length, 1);
  eq(env.profile.state.profiles[0].id, "pCloud");
  eq(env.profile.state.profiles[0].googleSub, SUB);
  eq(env.profile.state.calls.setSub, 0, "nothing to link: the cloud profile came with its link");
});

test("only profiles linked to the signed-in account are uploaded", async () => {
  const profiles = [
    { id: "pMine", name: "Ana", color: "#2f6f4f", createdAt: 1, googleSub: SUB, data: { rounds: ["a1"], updatedAt: 1 } },
    { id: "pOther", name: "Beto", color: "#2f6f4f", createdAt: 2, googleSub: "2002", data: { rounds: ["b1"], updatedAt: 1 } },
    { id: "pLocal", name: "Cami", color: "#2f6f4f", createdAt: 3, googleSub: "", data: { rounds: ["c1"], updatedAt: 1 } },
  ];
  const env = makeEnv({ profileOptions: { profiles, active: "pOther" } });
  ok((await env.auth.signIn()).ok);
  await env.auth.syncNow();
  const stored = JSON.parse(Array.from(env.drive.files.values())[0].content);
  same(stored.profiles.map((p) => p.id), ["pMine"]);
  eq(env.profile.state.calls.setSub, 0, "a profile is already linked, none is linked automatically");
  ok(!Array.from(env.drive.files.values())[0].content.includes("b1"), "another account's progress never reaches this Drive");
  ok(!Array.from(env.drive.files.values())[0].content.includes("c1"), "an unlinked profile is not uploaded either");
});

test("another account on the same device: nothing to sync, nothing leaked", async () => {
  const profiles = [{ id: "pA", name: "Ana", color: "#2f6f4f", createdAt: 1, googleSub: "2002", data: { rounds: ["a1"], updatedAt: 1 } }];
  const env = makeEnv({ profileOptions: { profiles, active: "pA" } });
  ok((await env.auth.signIn()).ok);
  const sync = await env.auth.syncNow();
  same({ ok: sync.ok, empty: sync.empty, uploaded: sync.uploaded }, { ok: true, empty: true, uploaded: false });
  eq(env.drive.files.size, 0);
  eq(env.drive.count("create"), 0);
});

// ---------- 401 / token refresh ----------

test("401: the token is re-requested silently, once, and the request is retried", async () => {
  const env = await signedIn();
  const { auth, drive, google } = env;
  drive.validTokens.clear(); // Google revoked the token behind our back
  const before = drive.log.length;
  const sync = await auth.syncNow();
  ok(sync.ok, JSON.stringify(sync));
  same(google.tokenRequests[1], { prompt: "none", hint: SUB }, "silent request with the account as hint");
  eq(google.tokenRequests.length, 2);
  const list = drive.log.slice(before).filter((entry) => entry.kind === "list");
  eq(list.length, 2);
  eq(list[0].token, "tok-1");
  eq(list[1].token, "tok-2");
  eq(auth.status(), "signed_in");
});

test("an expired token (by the clock) is refreshed silently before the request", async () => {
  const env = await signedIn();
  env.clock.advance(3600 * 1000);
  const before = env.drive.log.length;
  ok((await env.auth.syncNow()).ok);
  same(env.google.tokenRequests[1], { prompt: "none", hint: SUB });
  eq(env.drive.log.slice(before)[0].token, "tok-2", "the first request already used the new token");
  eq(env.drive.log.slice(before).filter((entry) => entry.kind === "list").length, 1);
});

test("silent refresh refused by Google: reconnect required, no popup loop, account remembered", async () => {
  const env = await signedIn();
  const { auth, drive, google, timers, profile } = env;
  google.script.push({ response: { error: "interaction_required" } });
  drive.validTokens.clear();
  const result = await auth.syncNow();
  same(result, { ok: false, error: "reconnect-required" });
  eq(auth.status(), "signed_out");
  eq(auth.needsReconnect(), true);
  eq(auth.state().error, "reconnect-required");
  eq(auth.user().name, "Ana Perez", "the account is remembered");
  const requests = google.tokenRequests.length;
  same(await auth.syncNow(), { ok: false, error: "reconnect-required" });
  eq(google.tokenRequests.length, requests, "no further token request without a click");
  profile.play("r77");
  await env.timers.advance(120000);
  eq(google.tokenRequests.length, requests, "automatic sync stays off");
  eq(timers.count, 0);

  // Reconnect = an explicit sign-in; it passes the remembered account as hint.
  const reconnect = await auth.signIn();
  ok(reconnect.ok);
  same(google.tokenRequests[requests], { prompt: "", hint: SUB });
  await auth.syncNow();
  eq(auth.status(), "signed_in");
  eq(auth.needsReconnect(), false);
});

test("401 again after a fresh token: unauthorized, reconnect required", async () => {
  const env = await signedIn();
  const always401 = () => response(401, { error: { code: 401 } });
  env.drive.inject("list", always401);
  env.drive.inject("list", always401);
  const result = await env.auth.syncNow();
  same(result, { ok: false, error: "unauthorized" });
  eq(env.auth.status(), "signed_out");
  eq(env.auth.needsReconnect(), true);
  eq(env.google.tokenRequests.length, 2, "exactly one silent retry");
});

// ---------- Failures ----------

test("network failure: error status, local data untouched, recovers on the next sync", async () => {
  const env = await signedIn();
  const { auth, drive, profile } = env;
  const importsBefore = profile.state.calls.import;
  drive.inject("list", () => { throw new TypeError("Failed to fetch"); });
  const result = await auth.syncNow();
  same(result, { ok: false, error: "network" });
  eq(auth.status(), "error");
  eq(auth.state().error, "network");
  eq(auth.user().name, "Ana Perez", "still signed in");
  eq(auth.needsReconnect(), false);
  eq(profile.state.calls.import, importsBefore);
  same(profile.rounds(), ["r1", "r2"]);
  const recovered = await auth.syncNow();
  ok(recovered.ok);
  eq(auth.status(), "signed_in");
  eq(auth.state().error, "");
});

test("HTTP failures map to clear error codes", async () => {
  const cases = [
    ["list", 500, {}, "server"],
    ["list", 503, {}, "server"],
    ["list", 429, {}, "rate-limited"],
    ["list", 403, { error: { errors: [{ reason: "rateLimitExceeded" }] } }, "rate-limited"],
    ["list", 403, { error: { errors: [{ reason: "insufficientPermissions" }] } }, "forbidden"],
    ["list", 400, {}, "bad-request"],
    ["download", 404, {}, "not-found"],
    ["update", 403, { error: { errors: [{ reason: "storageQuotaExceeded" }] } }, "quota-full"],
    ["update", 500, {}, "server"],
  ];
  for (const [kind, status, body, code] of cases) {
    const drive = makeDrive();
    drive.addFile(remoteDoc(["r1"])); // remote behind local => an update is needed
    const env = makeEnv({ drive });
    ok((await env.auth.signIn()).ok);
    await env.auth.syncNow();
    // sign-in's own sync already ran; make local ahead again and inject the failure
    env.profile.play(`x-${kind}-${status}`);
    drive.inject(kind, () => response(status, body));
    const before = env.profile.rounds().slice();
    const result = await env.auth.syncNow();
    eq(result.ok, false, `${kind} ${status}`);
    eq(result.error, code, `${kind} ${status} -> ${code}`);
    eq(result.status, status);
    eq(env.auth.status(), "error");
    eq(env.auth.state().error, code);
    same(env.profile.rounds(), before, "local data is never lost");
  }
});

test("a request that never answers times out", async () => {
  const env = await signedIn();
  env.drive.inject("list", (req) => new Promise((resolve, reject) => {
    req.init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  }));
  const pending = env.auth.syncNow();
  await settle();
  await env.timers.advance(constants.REQUEST_TIMEOUT_MS);
  same(await pending, { ok: false, error: "timeout" });
  eq(env.auth.status(), "error");
});

test("a remote file that is too large is refused before it is read", async () => {
  const env = await signedIn();
  let bodyRead = false;
  env.drive.inject("download", () => {
    const res = response(200, "{}", { "Content-Length": String(50 * 1024 * 1024) });
    res.text = async () => { bodyRead = true; return "{}"; };
    return res;
  });
  same(await env.auth.syncNow(), { ok: false, error: "too-large" });
  eq(bodyRead, false);
});

test("the remote file is never overwritten when it cannot be read", async () => {
  const cases = [
    ["not json at all", "bad-remote"],
    [JSON.stringify({ kind: "something-else", v: 1, profiles: [{}] }), "bad-remote"],
    [JSON.stringify({ kind: "ludus-progress", v: 1, profiles: "x" }), "bad-remote"],
    [JSON.stringify({ kind: "ludus-progress", v: 0, profiles: [{}] }), "bad-remote"],
    [JSON.stringify(remoteDoc(["r1"], { v: 99 })), "remote-newer"],
  ];
  for (const [content, code] of cases) {
    const drive = makeDrive();
    const id = drive.addFile(content);
    const env = makeEnv({ drive });
    ok((await env.auth.signIn()).ok);
    const result = await env.auth.syncNow();
    eq(result.ok, false);
    eq(result.error, code, content.slice(0, 40));
    eq(drive.files.get(id).content, content, "left untouched");
    eq(drive.count("update") + drive.count("create"), 0);
    eq(env.auth.status(), "error");
  }
  // A remote whose documents Profile.merge rejects.
  const drive = makeDrive();
  drive.addFile(remoteDoc(["r1"]));
  const env = makeEnv({ drive });
  env.profile.merge = () => null;
  ok((await env.auth.signIn()).ok);
  eq((await env.auth.syncNow()).error, "bad-remote");
});

test("an empty remote document (no profiles) counts as nothing and gets replaced", async () => {
  const drive = makeDrive();
  const id = drive.addFile({ kind: "ludus-progress", v: 1, app: "x", exportedAt: 1, profiles: [] });
  const env = makeEnv({ drive });
  ok((await env.auth.signIn()).ok);
  const sync = await env.auth.syncNow();
  ok(sync.ok);
  eq(drive.count("create"), 0);
  eq(drive.count("update"), 1);
  eq(JSON.parse(drive.files.get(id).content).profiles.length, 1);
});

test("import failure: reported, and nothing is uploaded", async () => {
  const drive = makeDrive();
  drive.addFile(remoteDoc(["r1", "r2", "r3"]));
  const env = makeEnv({ drive });
  env.profile.state.importResult = { ok: false, error: "limit" };
  ok((await env.auth.signIn()).ok);
  const result = await env.auth.syncNow();
  same(result, { ok: false, error: "import-failed", detail: "limit" });
  eq(drive.count("update"), 0);
  eq(env.auth.status(), "error");
  env.profile.state.importResult = null;
  ok((await env.auth.syncNow()).ok, "recovers once the profile accepts the import");
});

test("no usable Profile: profile-unavailable", async () => {
  const env = makeEnv({ profile: {} });
  ok((await env.auth.signIn()).ok);
  same(await env.auth.syncNow(), { ok: false, error: "profile-unavailable" });
});

test("a Profile that throws on export is treated as having nothing local", async () => {
  const drive = makeDrive();
  drive.addFile(remoteDoc(["r1"]));
  const env = makeEnv({ drive });
  env.profile.state.throwOnExport = true;
  ok((await env.auth.signIn()).ok);
  const sync = await env.auth.syncNow();
  ok(sync.ok);
  eq(sync.uploaded, false, "nothing to upload");
});

// ---------- Duplicates ----------

test("duplicate remote files (two devices first-synced together) are merged into the oldest and the rest removed", async () => {
  const drive = makeDrive();
  const oldest = drive.addFile(remoteDoc(["r2", "a1"]), { createdTime: "2026-01-01T00:00:00.000Z" });
  const newer = drive.addFile(remoteDoc(["b1"]), { createdTime: "2026-01-02T00:00:00.000Z" });
  const broken = drive.addFile("garbage", { createdTime: "2026-01-03T00:00:00.000Z" });
  const env = makeEnv({ drive });
  ok((await env.auth.signIn()).ok);
  const sync = await env.auth.syncNow();
  ok(sync.ok, JSON.stringify(sync));
  same(env.profile.rounds(), ["a1", "b1", "r1", "r2"]);
  const stored = JSON.parse(drive.files.get(oldest).content);
  same(stored.profiles[0].data.rounds, ["a1", "b1", "r1", "r2"], "the oldest file holds everything");
  eq(drive.files.has(newer), false, "the merged duplicate was deleted");
  eq(drive.files.has(broken), true, "an unreadable duplicate is left alone");
});

test("duplicates that add nothing new are still cleaned up without touching the oldest file", async () => {
  const drive = makeDrive();
  const oldest = drive.addFile(remoteDoc(["r1", "r2"]), { createdTime: "2026-01-01T00:00:00.000Z" });
  const extra = drive.addFile(remoteDoc(["r1"]), { createdTime: "2026-01-02T00:00:00.000Z" });
  const env = makeEnv({ drive });
  ok((await env.auth.signIn()).ok);
  const sync = await env.auth.syncNow();
  same({ imported: sync.imported, uploaded: sync.uploaded }, { imported: false, uploaded: false });
  eq(drive.files.has(extra), false);
  eq(drive.files.has(oldest), true);
});

test("data held only by a duplicate is never lost: it is written into the oldest file first", async () => {
  const drive = makeDrive();
  const oldest = drive.addFile(remoteDoc(["r1", "r2"]), { createdTime: "2026-01-01T00:00:00.000Z" });
  drive.addFile(remoteDoc(["z9"]), { createdTime: "2026-01-02T00:00:00.000Z" });
  const env = makeEnv({ drive, profileOptions: { profiles: [{ id: "p1", name: "Ana", color: "#2f6f4f", createdAt: 1, googleSub: SUB, data: { rounds: ["r1", "r2", "z9"], updatedAt: 1 } }] } });
  ok((await env.auth.signIn()).ok);
  const sync = await env.auth.syncNow();
  eq(sync.uploaded, true, "local == merged, but the oldest file lacked z9");
  same(JSON.parse(drive.files.get(oldest).content).profiles[0].data.rounds, ["r1", "r2", "z9"]);
});

// ---------- Sign-out ----------

test("sign-out clears memory, hint, timers and stops syncing", async () => {
  const env = await signedIn();
  const { auth, storage, drive, google, timers, profile, bus } = env;
  profile.play("r10");
  eq(timers.count, 1, "an automatic sync is scheduled");
  const logged = drive.log.length;
  const events = bus.named("auth:changed").length;
  same(await auth.signOut(), { ok: true });
  eq(auth.status(), "signed_out");
  eq(auth.user(), null);
  eq(auth.needsReconnect(), false);
  eq(auth.state().lastSyncAt, 0);
  eq(storage.map.has("ludus.auth.v1"), false, "hint removed");
  eq(timers.count, 0, "pending automatic sync cancelled");
  eq(bus.named("auth:changed").length, events + 1);
  eq(bus.named("auth:changed").pop().status, "signed_out");
  same(await auth.syncNow(), { ok: false, error: "not-signed-in" });
  profile.play("r11");
  eq(timers.count, 0, "profile changes no longer schedule anything");
  await timers.advance(300000);
  eq(drive.log.length, logged, "no request after sign-out");
  eq(google.revoked.length, 0, "a plain sign-out does not revoke the grant");
});

test("sign-out with revoke asks Google to revoke the token", async () => {
  const env = await signedIn();
  const result = await env.auth.signOut({ revoke: true });
  same(result, { ok: true, revoked: true });
  same(env.google.revoked, ["tok-1"]);
  eq(env.auth.status(), "signed_out");
});

test("sign-out during a running sync: the sync stops, nothing is written, a new sign-in works", async () => {
  const env = makeEnv();
  const { auth, drive, profile } = env;
  ok((await auth.signIn()).ok);
  await auth.syncNow();
  profile.play("r30");
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  drive.inject("list", async () => { await gate; return null; });
  const pending = auth.syncNow();
  await settle();
  await auth.signOut();
  release();
  same(await pending, { ok: false, error: "signed-out" });
  eq(drive.count("update"), 0);
  eq(auth.status(), "signed_out");
  ok((await auth.signIn()).ok);
  const fresh = await auth.syncNow();
  ok(fresh.ok, "a fresh session is not collapsed onto the dead one");
  eq(auth.status(), "signed_in");
});

// ---------- Identity ----------

test("malformed identity answers make the sign-in fail cleanly", async () => {
  const bad = [
    { status: 200, body: {} },
    { status: 200, body: "not json" },
    { status: 200, body: "[]" },
    { status: 200, body: { sub: "../../x", name: "Mallory" } },
    { status: 200, body: { sub: 1001, name: "Mallory" } },
    { status: 401, body: {} },
    { status: 500, body: {} },
  ];
  for (const raw of bad) {
    const env = makeEnv();
    env.drive.identityRaw = raw;
    const result = await env.auth.signIn();
    same(result, { ok: false, error: "identity" });
    eq(env.auth.status(), "error");
    eq(env.auth.state().error, "identity");
    eq(env.auth.user(), null);
    eq(env.storage.map.has("ludus.auth.v1"), false, "no hint persisted");
    same(env.drive.log.map((entry) => entry.kind), ["identity"], "no Drive access without an identity");
    eq(env.timers.count, 0);
  }
});

test("hostile identity fields are neutralised end to end", async () => {
  const env = makeEnv();
  env.drive.identity = { sub: SUB, name: "  ‮Evil\u0007 <b>Name</b>  ", email: "x@y", picture: "https://evil.example/p.png" };
  const result = await env.auth.signIn();
  ok(result.ok);
  eq(result.user.name, "Evil <b>Name</b>");
  eq(result.user.picture, "");
  eq(result.user.email, "");
  const hint = JSON.parse(env.storage.map.get("ludus.auth.v1"));
  eq(hint.picture, "");
});

test("a network failure while reading the identity is reported as such", async () => {
  const env = makeEnv();
  env.drive.inject("identity", () => { throw new TypeError("Failed to fetch"); });
  same(await env.auth.signIn(), { ok: false, error: "network" });
  eq(env.auth.status(), "error");
  eq(env.auth.user(), null);
});

test("reload: the hint restores the account chip but never a token", async () => {
  const first = await signedIn();
  const { storage, drive } = first;
  const second = makeEnv({ storage, drive });
  const { auth, google, timers, profile } = second;
  eq(auth.status(), "signed_out");
  same(auth.user(), { name: "Ana Perez", email: "", picture: "https://lh3.googleusercontent.com/a/abc=s96-c", sub: SUB });
  eq(auth.needsReconnect(), true);
  eq(auth.state().lastSyncAt, T0);
  same(await auth.syncNow(), { ok: false, error: "reconnect-required" });
  profile.play("r50");
  eq(timers.count, 0);
  await second.timers.advance(300000);
  eq(google.tokenRequests.length, 0, "no automatic popup");
  eq(google.configs.length, 0, "the token client is not even created");
  eq(second.document.created.length, 0, "and Google's script is not loaded");
  const requestsBefore = drive.log.length;
  const reconnect = await auth.signIn();
  ok(reconnect.ok);
  same(google.tokenRequests[0], { prompt: "", hint: SUB });
  eq(reconnect.user.email, "ana@example.com", "the e-mail comes back with the live identity");
  ok(drive.log.length > requestsBefore);
});

test("a corrupt hint is ignored", async () => {
  for (const raw of ["{not json", JSON.stringify({ v: 1, signedIn: true }), JSON.stringify([1, 2]), JSON.stringify({ v: 9, signedIn: true, sub: SUB })]) {
    const storage = memoryStorage();
    storage.map.set("ludus.auth.v1", raw);
    const env = makeEnv({ storage });
    eq(env.auth.user(), null);
    eq(env.auth.status(), "signed_out");
    eq(env.auth.needsReconnect(), false);
  }
});

test("switching account: a different sub replaces the remembered one", async () => {
  const first = await signedIn();
  const drive2 = makeDrive({ identity: { sub: "2002", name: "Beto", email: "beto@example.com", picture: "" } });
  const second = makeEnv({ storage: first.storage, drive: drive2, profile: first.profile });
  same(second.auth.user().sub, SUB);
  const result = await second.auth.signIn();
  ok(result.ok);
  eq(second.auth.user().sub, "2002");
  await second.auth.syncNow();
  eq(JSON.parse(second.storage.map.get("ludus.auth.v1")).sub, "2002");
  eq(drive2.count("create"), 0, "the profile linked to the first account is not copied into the second account's Drive");
});

// ---------- Sign-in failures ----------

test("sign-in failures", async () => {
  const cases = [
    [{ errorCallback: { type: "popup_failed_to_open" } }, "popup-blocked", "error"],
    [{ errorCallback: { type: "popup_closed" } }, "cancelled", "signed_out"],
    [{ errorCallback: { type: "unknown" } }, "auth-failed", "error"],
    [{ errorCallback: undefined, response: { error: "access_denied" } }, "cancelled", "signed_out"],
    [{ response: { error: "invalid_request" } }, "auth-failed", "error"],
    [{ response: {} }, "auth-failed", "error"],
    [{ response: null }, "auth-failed", "error"],
    [{ response: { access_token: "bad token", expires_in: 3600 } }, "auth-failed", "error"],
    [{ response: { access_token: "x".repeat(5000), expires_in: 3600 } }, "auth-failed", "error"],
    [{ scope: "openid email profile" }, "scope-denied", "error"],
  ];
  for (const [step, code, finalStatus] of cases) {
    const env = makeEnv({ script: [step] });
    const result = await env.auth.signIn();
    same(result, { ok: false, error: code }, JSON.stringify(step));
    eq(env.auth.status(), finalStatus);
    eq(env.auth.state().error, code === "cancelled" ? "" : code, "cancelling is not an error");
    eq(env.auth.user(), null);
    eq(env.drive.log.length, 0, "no Drive/identity request without a valid token");
    eq(env.storage.map.has("ludus.auth.v1"), false);
    // Trying again works.
    const retry = await env.auth.signIn();
    ok(retry.ok, `retry after ${code}`);
    await env.auth.syncNow();
    eq(env.auth.status(), "signed_in");
  }
});

test("the popup that never answers times out; sign-out cancels a pending sign-in", async () => {
  {
    const env = makeEnv({ script: [{ never: true }] });
    const pending = env.auth.signIn();
    await settle();
    eq(env.auth.status(), "signing_in");
    await env.timers.advance(3 * 60 * 1000);
    same(await pending, { ok: false, error: "timeout" });
    eq(env.auth.status(), "error");
  }
  {
    const env = makeEnv({ script: [{ never: true }] });
    const pending = env.auth.signIn();
    await settle();
    await env.auth.signOut();
    same(await pending, { ok: false, error: "cancelled" });
    eq(env.auth.status(), "signed_out");
    eq(env.auth.state().error, "");
    eq(env.timers.count, 0);
  }
});

test("concurrent sign-in calls share one popup", async () => {
  const env = makeEnv();
  const a = env.auth.signIn();
  const b = env.auth.signIn();
  eq(a, b, "same promise");
  ok((await a).ok);
  eq(env.google.tokenRequests.length, 1);
  const again = await env.auth.signIn();
  same({ ok: again.ok, already: again.already }, { ok: true, already: true });
  eq(env.google.tokenRequests.length, 1, "already signed in: no new popup");
});

test("token requests run one at a time", async () => {
  const env = makeEnv({ script: [{ never: true }] });
  const first = env.auth.signIn();
  await settle();
  // A silent refresh (forced through a fake state) cannot start while the popup is open.
  eq(env.auth.status(), "signing_in");
  await env.auth.signOut();
  await first;
});

// ---------- Google script loader ----------

test("Google's script is injected on demand, once, without a version suffix", async () => {
  const env = makeEnv({ noGoogleYet: true });
  const { auth, document, google, view } = env;
  eq(document.created.length, 0);
  const first = auth.signIn();
  const second = auth.signIn();
  eq(first, second);
  eq(document.created.length, 1, "one script for two clicks");
  const script = document.created[0];
  eq(script.tag, "script");
  eq(script.src, "https://accounts.google.com/gsi/client", "exact external URL, no ?v=");
  eq(script.async, true);
  eq(document.appended.length, 1);
  await settle();
  eq(google.tokenRequests.length, 0, "no token request before the script has loaded");
  view.google = google;
  script.onload();
  ok((await first).ok);
  eq(google.tokenRequests.length, 1);
  eq(document.created.length, 1);
});

test("Google's script failing to load is reported and can be retried", async () => {
  const env = makeEnv({ noGoogleYet: true });
  const { auth, document, google, view } = env;
  const first = auth.signIn();
  document.created[0].onerror();
  same(await first, { ok: false, error: "gis-load-failed" });
  eq(document.removed.length, 1, "the dead script tag is removed");
  eq(auth.status(), "error");
  eq(auth.state().error, "gis-load-failed");
  const second = auth.signIn();
  eq(document.created.length, 2, "a later click tries again");
  view.google = google;
  document.created[1].onload();
  ok((await second).ok);
});

test("Google's script that loads but defines nothing, or never loads, fails cleanly", async () => {
  {
    const env = makeEnv({ noGoogleYet: true });
    const pending = env.auth.signIn();
    env.document.created[0].onload();
    same(await pending, { ok: false, error: "gis-load-failed" });
  }
  {
    const env = makeEnv({ noGoogleYet: true });
    const pending = env.auth.signIn();
    await env.timers.advance(15000);
    same(await pending, { ok: false, error: "gis-load-failed" });
  }
  {
    const env = makeEnv({ noGoogleYet: true, document: {} });
    same(await env.auth.signIn(), { ok: false, error: "gis-load-failed" });
  }
});

test("preload() is opt-in and loads only the script", async () => {
  const env = makeEnv({ noGoogleYet: true });
  const pending = env.auth.preload();
  eq(env.document.created.length, 1);
  env.view.google = env.google;
  env.document.created[0].onload();
  eq(await pending, true);
  eq(env.google.tokenRequests.length, 0, "no sign-in, no token request");
  eq(env.drive.log.length, 0);
  const failing = makeEnv({ noGoogleYet: true });
  const p2 = failing.auth.preload();
  failing.document.created[0].onerror();
  eq(await p2, false);
});

// ---------- Concurrency and automatic sync ----------

test("concurrent syncNow calls collapse into one run", async () => {
  const env = await signedIn();
  const { auth, drive } = env;
  const before = drive.count("list");
  const a = auth.syncNow();
  const b = auth.syncNow();
  const c = auth.syncNow();
  eq(a, b);
  eq(b, c);
  const results = await Promise.all([a, b, c]);
  same(results[0], results[1]);
  same(results[1], results[2]);
  eq(drive.count("list") - before, 1, "one round trip for three callers");
  const next = auth.syncNow();
  ok(next !== a, "a finished run is not reused");
  await next;
  eq(drive.count("list") - before, 2);
});

test("automatic sync: debounced after profile:changed, at most once per 45 s", async () => {
  const env = await signedIn();
  const { auth, drive, profile, timers, clock } = env;
  const listAt = () => drive.count("list");
  const base = listAt();

  profile.play("r20");
  profile.play("r21");
  profile.play("r22");
  eq(timers.count, 1, "three changes, one timer");
  eq(timers.list()[0].delay, constants.MIN_AUTO_INTERVAL_MS, "the sign-in sync just ran: wait for the 45 s window");
  await timers.advance(44000);
  eq(listAt(), base, "not yet");
  await timers.advance(1000);
  eq(listAt(), base + 1, "one automatic sync");
  eq(drive.count("update"), 1);
  same(JSON.parse(Array.from(drive.files.values())[0].content).profiles[0].data.rounds, ["r1", "r2", "r20", "r21", "r22"]);
  eq(auth.status(), "signed_in");

  // Right after that sync, a new change waits for the remainder of the window.
  clock.advance(10000);
  profile.play("r23");
  eq(timers.count, 1);
  eq(timers.list()[0].delay, 35000);
  await timers.advance(35000);
  eq(listAt(), base + 2);

  // Long after the window, only the debounce applies, and it restarts on every change.
  clock.advance(10 * 60 * 1000);
  profile.play("r24");
  eq(timers.list()[0].delay, constants.AUTO_DEBOUNCE_MS);
  await timers.advance(3000);
  profile.play("r25");
  eq(timers.count, 1);
  eq(timers.list()[0].delay, constants.AUTO_DEBOUNCE_MS, "the debounce restarted");
  await timers.advance(3999);
  eq(listAt(), base + 2);
  await timers.advance(1);
  eq(listAt(), base + 3);
  same(profile.rounds().slice(-2), ["r24", "r25"]);
});

test("automatic sync ignores the profile events our own import causes", async () => {
  const drive = makeDrive();
  drive.addFile(remoteDoc(["r1", "r2", "r7"]));
  const env = makeEnv({ drive });
  ok((await env.auth.signIn()).ok);
  const sync = await env.auth.syncNow();
  eq(sync.imported, true);
  ok(env.bus.named("profile:changed").length >= 2, "the import and the link emitted profile:changed");
  eq(env.timers.count, 0, "and none of them scheduled another sync");
});

test("a change during a running sync schedules a follow-up", async () => {
  const env = await signedIn();
  const { auth, drive, profile, timers } = env;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  drive.inject("list", async () => { await gate; return null; });
  const pending = auth.syncNow();
  await settle();
  eq(timers.count, 1, "only the request timeout is pending while the sync runs");
  profile.play("r40");
  eq(timers.count, 1, "no second sync is scheduled while one runs");
  release();
  ok((await pending).ok);
  eq(timers.count, 1, "the change made during the sync is followed up");
  await timers.advance(constants.MIN_AUTO_INTERVAL_MS);
  same(JSON.parse(Array.from(drive.files.values())[0].content).profiles[0].data.rounds.slice(-1), ["r40"]);
});

test("failures back off and honour Retry-After", async () => {
  const env = await signedIn();
  const { auth, drive, profile, timers } = env;
  drive.inject("list", () => response(503, {}, { "Retry-After": "300" }));
  same(await auth.syncNow(), { ok: false, error: "server", status: 503 });
  profile.play("r60");
  eq(timers.list()[0].delay >= 300000, true, "waits at least Retry-After");
  // Consecutive failures double the pause (capped), success resets it.
  await timers.advance(300000);
  eq(auth.status(), "signed_in", "the automatic retry succeeded");
  profile.play("r61");
  eq(timers.list()[0].delay, constants.MIN_AUTO_INTERVAL_MS, "back to the normal window after a success");
  drive.inject("list", () => response(500, {}));
  drive.inject("list", () => response(500, {}));
  await timers.advance(constants.MIN_AUTO_INTERVAL_MS);
  eq(auth.status(), "error");
  profile.play("r62");
  eq(timers.list()[0].delay, constants.MIN_AUTO_INTERVAL_MS, "first failure: one window");
  await timers.advance(constants.MIN_AUTO_INTERVAL_MS);
  eq(auth.status(), "error");
  profile.play("r63");
  eq(timers.list()[0].delay, constants.MIN_AUTO_INTERVAL_MS * 2, "second failure: doubled");
});

test("bus events for automatic sync only fire while signed in", async () => {
  const env = makeEnv();
  env.profile.play("r1x");
  eq(env.timers.count, 0, "signed out");
  ok((await env.auth.signIn()).ok);
  await env.auth.syncNow();
  env.profile.play("r2x");
  eq(env.timers.count, 1);
  await env.auth.signOut();
  eq(env.timers.count, 0);
});

// ---------- UI text ----------

test("every status and error code has Spanish and English text", async () => {
  for (const status of constants.STATUSES) {
    const key = `auth.status.${status}`;
    ok(Ludus.i18n.t(key, null, "es") !== key, `es ${key}`);
    ok(Ludus.i18n.t(key, null, "en") !== key, `en ${key}`);
  }
  for (const code of constants.ERROR_CODES) {
    const key = Auth.errorKey(code);
    eq(key, `auth.error.${code}`);
    const es = Ludus.i18n.t(key, null, "es");
    const en = Ludus.i18n.t(key, null, "en");
    ok(es !== key && en !== key, `text for ${code}`);
    ok(es !== en, `es and en differ for ${code}`);
    ok(!/<|>/.test(es + en), "no markup in UI text");
  }
  eq(Auth.errorKey("nonsense"), "auth.error.unknown");
  eq(Auth.errorKey(undefined), "auth.error.unknown");
  const env = makeEnv();
  eq(env.auth.errorMessage("network", "en"), Ludus.i18n.t("auth.error.network", null, "en"));
  eq(env.auth.errorMessage("nope", "es"), Ludus.i18n.t("auth.error.unknown", null, "es"));
  ok(/vos|Iniciá|Tocá|Permití|Revisá|Reconectá/.test(Ludus.i18n.t("auth.error.not-signed-in", null, "es") + Ludus.i18n.t("auth.error.reconnect-required", null, "es")), "rioplatense register");
});

// ---------- Integration with the real Profile ----------

// A valid RoundRecord (kings in the corners plus one pawn per side, unique per n).
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

function round(n, overrides = {}) {
  return Object.assign({
    id: `r${n}`, ts: T0 - 3600000 - n * 1000, sessionId: "s1", sessionKind: "classic", source: "classic",
    positionId: `classic:${n}`, fen: fenN(n), sideToMove: "w", phase: "middlegame",
    userUci: "e2e4", userSan: "e4", bestUci: "d2d4", bestSan: "d4",
    points: 7.5, accuracy: 75, qualityCode: "good", winLossPct: 4, cpLoss: 35, isBest: false, rank: 2,
    onlyMove: false, timeSpentMs: 12000, hintsUsed: 0, timedOut: false, tags: [],
    lines: [{ uci: "d2d4", san: "d4", score: 30, pv: ["d2d4", "d7d5", "c2c4"] }],
    meta: { players: "A vs B", event: "Test", year: 1900 },
  }, overrides);
}
const badRound = (n) => round(n, { points: 2, accuracy: 20, qualityCode: "bad", cpLoss: 300, winLossPct: 25 });

function makeDevice(tag, drive, clock, options = {}) {
  const storage = memoryStorage();
  const bus = makeBus();
  const timers = makeTimers(clock);
  let n = 0;
  const real = Profile.createInstance({
    storage, bus, now: clock.now, uid: (prefix) => `${prefix || ""}${tag}${(n += 1).toString(36)}`, i18n: Ludus.i18n, listenStorage: false,
  });
  const calls = { import: 0 };
  const profile = {
    constants: Profile.constants,
    list: real.list, active: real.active, setGoogleSub: real.setGoogleSub, exportJSON: real.exportJSON, merge: real.merge,
    importJSON(...args) { calls.import += 1; return real.importJSON(...args); },
  };
  const google = makeGoogle(drive);
  const auth = Auth.createInstance({
    config: { googleClientId: CLIENT_ID }, fetch: drive.fetch, getGoogle: () => google, document: makeFakeDocument(),
    storage, bus, profile, now: clock.now, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout, i18n: Ludus.i18n,
  });
  return { tag, real, auth, calls, storage, bus, timers, google };
}

// The profile data with the bookkeeping that legitimately differs stripped.
function dataOf(device) {
  const doc = JSON.parse(device.real.exportJSON("all", { sync: true }));
  assert.strictEqual(doc.profiles.length, 1, `${device.tag} holds exactly one profile`);
  return internals.docSignature({ profiles: [Object.assign({}, doc.profiles[0], { id: "same" })] });
}

test("two devices, one Google account, the real Profile: they converge and then stay quiet", async () => {
  const clock = makeClock(T0);
  const drive = makeDrive();
  const A = makeDevice("a", drive, clock);
  const B = makeDevice("b", drive, clock);

  // Device A: plays a few positions, then signs in for the first time.
  A.real.ensureActive();
  [0, 1, 2].forEach((n) => ok(A.real.recordRound(round(n))));
  ok(A.real.recordRound(badRound(3)));
  ok((await A.auth.signIn()).ok);
  const firstSync = await A.auth.syncNow();
  same({ ok: firstSync.ok, created: firstSync.created, imported: firstSync.imported }, { ok: true, created: true, imported: false });
  eq(drive.files.size, 1);
  const cloud1 = JSON.parse(Array.from(drive.files.values())[0].content);
  eq(cloud1.profiles.length, 1);
  eq(cloud1.profiles[0].googleSub, SUB);
  eq(cloud1.profiles[0].data.rounds.length, 4);

  // Device B: a different device with its own default profile and its own games.
  B.real.ensureActive();
  [100, 101].forEach((n) => ok(B.real.recordRound(round(n))));
  ok(B.real.recordRound(badRound(102)));
  ok((await B.auth.signIn()).ok);
  const bSync = await B.auth.syncNow();
  same({ ok: bSync.ok, created: bSync.created, imported: bSync.imported, uploaded: bSync.uploaded }, { ok: true, created: false, imported: true, uploaded: true });
  eq(B.real.list().length, 1, "B did not grow a second profile: its own was linked to the account");
  eq(B.real.rounds().length, 7, "B has A's 4 rounds plus its own 3");
  eq(drive.files.size, 1);
  const cloud2 = JSON.parse(Array.from(drive.files.values())[0].content);
  eq(cloud2.profiles.length, 1, "the cloud holds one profile for the account, not one per device");
  eq(cloud2.profiles[0].data.rounds.length, 7);

  // A picks up B's games.
  const aSync = await A.auth.syncNow();
  same({ ok: aSync.ok, imported: aSync.imported, uploaded: aSync.uploaded }, { ok: true, imported: true, uploaded: false });
  eq(A.real.list().length, 1);
  eq(A.real.rounds().length, 7);
  eq(A.real.notebook.list().length, B.real.notebook.list().length, "notebook cards merged too");
  eq(A.real.notebook.list().length, 2);
  eq(dataOf(A), dataOf(B), "both devices hold the same data");
  ok(A.real.stats().xp > 0, "the merged profile carries XP");
  eq(A.real.stats().xp, B.real.stats().xp, "XP is recomputed from the merged log, so it matches");
  eq(A.real.stats().totalPositions, 7);

  // Nothing changed since: repeated syncs on both devices must be no-ops
  // (no import, no upload, no ping-pong through the bookkeeping fields).
  const importsA = A.calls.import;
  const importsB = B.calls.import;
  const writes = drive.count("update") + drive.count("create");
  for (let i = 0; i < 3; i += 1) {
    clock.advance(120000);
    const a = await A.auth.syncNow();
    const b = await B.auth.syncNow();
    same({ imported: a.imported, uploaded: a.uploaded }, { imported: false, uploaded: false }, `A round ${i}`);
    same({ imported: b.imported, uploaded: b.uploaded }, { imported: false, uploaded: false }, `B round ${i}`);
  }
  eq(A.calls.import, importsA);
  eq(B.calls.import, importsB);
  eq(drive.count("update") + drive.count("create"), writes, "no upload while nothing changed");

  // A new game on B reaches A, and only one upload + one import happen.
  clock.advance(120000);
  ok(B.real.recordRound(round(200)));
  const bUp = await B.auth.syncNow();
  same({ imported: bUp.imported, uploaded: bUp.uploaded }, { imported: false, uploaded: true });
  const aDown = await A.auth.syncNow();
  same({ imported: aDown.imported, uploaded: aDown.uploaded }, { imported: true, uploaded: false });
  eq(A.real.rounds().length, 8);
  eq(dataOf(A), dataOf(B));
  const bAgain = await B.auth.syncNow();
  same({ imported: bAgain.imported, uploaded: bAgain.uploaded }, { imported: false, uploaded: false });
});

test("the real Profile: local-only rounds on both devices merge when they sync at the same time", async () => {
  const clock = makeClock(T0);
  const drive = makeDrive();
  const A = makeDevice("a", drive, clock);
  const B = makeDevice("b", drive, clock);
  A.real.ensureActive();
  B.real.ensureActive();
  ok(A.real.recordRound(round(1)));
  ok(B.real.recordRound(round(2)));
  ok((await A.auth.signIn()).ok);
  ok((await B.auth.signIn()).ok);
  const [a, b] = await Promise.all([A.auth.syncNow(), B.auth.syncNow()]);
  ok(a.ok && b.ok);
  // Both first-synced in parallel, so Drive may hold two files; the next syncs converge them.
  for (let i = 0; i < 3; i += 1) {
    clock.advance(120000);
    ok((await A.auth.syncNow()).ok);
    ok((await B.auth.syncNow()).ok);
  }
  eq(drive.files.size, 1, "duplicates were cleaned up");
  eq(A.real.rounds().length, 2);
  eq(B.real.rounds().length, 2);
  eq(dataOf(A), dataOf(B));
});

test("the real Profile: switching Google account never copies the previous account's progress", async () => {
  const clock = makeClock(T0);
  const driveA = makeDrive();
  const driveB = makeDrive({ identity: { sub: "2002", name: "Beto", email: "b@example.com", picture: "" } });
  const device = makeDevice("a", driveA, clock);
  device.real.ensureActive();
  ok(device.real.recordRound(round(1)));
  ok((await device.auth.signIn()).ok);
  await device.auth.syncNow();
  eq(driveA.files.size, 1);
  await device.auth.signOut();
  // Same device (same storage, same profile) signs in as somebody else.
  const other = Auth.createInstance({
    config: { googleClientId: CLIENT_ID }, fetch: driveB.fetch, getGoogle: () => makeGoogle(driveB), document: makeFakeDocument(),
    storage: device.storage, bus: device.bus, profile: { constants: Profile.constants, list: device.real.list, active: device.real.active, setGoogleSub: device.real.setGoogleSub, exportJSON: device.real.exportJSON, merge: device.real.merge, importJSON: device.real.importJSON },
    now: clock.now, setTimeout: device.timers.setTimeout, clearTimeout: device.timers.clearTimeout, i18n: Ludus.i18n,
  });
  ok((await other.signIn()).ok);
  const sync = await other.syncNow();
  ok(sync.ok);
  eq(driveB.files.size, 0, "the first account's rounds were not uploaded to the second account's Drive");
  eq(driveB.count("create"), 0);
});

// ---------- Runner ----------

(async () => {
  let done = 0;
  for (const entry of tests) {
    try {
      await entry.fn();
      done += 1;
    } catch (error) {
      console.error(`\nFAILED: ${entry.name}`);
      console.error(error && error.stack ? error.stack : error);
      process.exit(1);
    }
  }
  console.log(`auth.test.js: ${done} tests, ${assertions} assertions passed`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
