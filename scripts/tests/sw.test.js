// Unit tests for sw.js: the service worker's routing and cache policy, run in a
// node:vm sandbox against a fake Cache Storage, a fake network and real
// Request / Response / crypto.subtle objects. The worker source is the real one
// (scripts/generate-version.js stamps it with a small synthetic build), so this
// checks the code that ships. Browser-level lifecycle checks (first visit, warm
// cache, offline, a new deploy, a dead network) are in scripts/e2e/sw.js.
// Plain assert, no framework, no network, deterministic.

"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..", "..");
const gv = require(path.join(root, "scripts", "generate-version.js"));
const swSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");

const ORIGIN = "https://example.test";
const SCOPE = `${ORIGIN}/app/`;
const VERSION = "aaaaaaaaaaaa";
const ENGINE_ID = "eeeeeeeeeeee";
const CACHE_STATIC = `ludus-scaccorum-static-${VERSION}`;
const CACHE_ENGINE = `ludus-scaccorum-engine-${ENGINE_ID}`;

let assertions = 0;
const ok = (value, message) => { assertions += 1; assert.ok(value, message); };
const eq = (actual, expected, message) => { assertions += 1; assert.strictEqual(actual, expected, message); };
const same = (actual, expected, message) => { assertions += 1; assert.deepStrictEqual(actual, expected, message); };
const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

const unhandled = [];
process.on("unhandledRejection", (error) => unhandled.push(error));

// ---------- Fakes ----------

const ENGINE_JS = Buffer.from("/* engine js */ self.onmessage = function () {};");
const ENGINE_WASM = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0, 9, 9, 9, 9]);
const ENGINE = { "vendor/e.js": ENGINE_JS, "vendor/e.wasm": ENGINE_WASM };
const ENGINE_SHA = { "vendor/e.js": sha256(ENGINE_JS), "vendor/e.wasm": sha256(ENGINE_WASM) };

const shellHtml = (version) => `<!doctype html><html><head><meta name="ludus-version" content="${version}" /></head><body>shell ${version}</body></html>`;

// A Response that looks like one fetched from the network (type "basic").
function netResponse(body, init = {}) {
  const response = new Response(body, { status: init.status === undefined ? 200 : init.status, headers: init.headers || {} });
  Object.defineProperty(response, "type", { value: init.type || "basic" });
  return response;
}

function keyOf(input) {
  return typeof input === "string" ? new URL(input, SCOPE).href : input.url;
}

// Cache Storage over Maps; `failPut(cacheName, url)` makes a put throw like a full quota does.
function makeCaches(state) {
  const stores = state.stores || new Map();
  async function open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      async match(request) {
        const hit = store.get(keyOf(request));
        return hit ? new Response(hit.body, { status: hit.status, headers: hit.headers }) : undefined;
      },
      async put(request, response) {
        if (state.failPut && state.failPut(name, keyOf(request))) throw new DOMException("quota", "QuotaExceededError");
        store.set(keyOf(request), { status: response.status, headers: [...response.headers], body: Buffer.from(await response.arrayBuffer()) });
      },
      async keys() { return [...store.keys()].map((url) => ({ url })); },
      async delete(request) { return store.delete(keyOf(request)); },
    };
  }
  return {
    stores,
    open,
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async has(name) { return stores.has(name); },
  };
}

// One service worker instance: the real sw.js stamped for a synthetic build.
function makeWorker(options = {}) {
  const version = options.version || VERSION;
  const engineId = options.engineId || ENGINE_ID;
  const site = options.site || defaultSite(version);
  const state = options.state || { stores: new Map() };
  const caches = makeCaches(state);
  const net = options.net || { down: false, hang: false, calls: [], handler: null };
  const handlers = {};
  const log = { skipWaiting: 0, claim: 0, update: 0, posted: [], warnings: [] };
  const engine = options.engine || ENGINE;
  const assets = options.assets || [
    "./", "./index.html", `./styles.css?v=${version}`, `./js/app.js?v=${version}`, `./js/data/lib.data.js?v=${version}`, "./assets/icon.png",
  ];

  const source = gv.stampServiceWorker(swSource, {
    cacheName: `ludus-scaccorum-static-${version}`,
    engineCacheName: `ludus-scaccorum-engine-${engineId}`,
    engineFiles: Object.fromEntries(Object.keys(engine).map((rel) => [rel, sha256(engine[rel])])),
    versionedAssets: assets,
  });

  async function fakeFetch(input, init = {}) {
    const url = typeof input === "string" ? input : input.url;
    const call = { url, cache: (typeof input === "object" && input.cache) || init.cache || "default", signal: init.signal || null };
    net.calls.push(call);
    if (net.down) throw new TypeError("Failed to fetch");
    if (net.hang) {
      return new Promise((resolve, reject) => {
        if (call.signal) call.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    }
    if (net.handler) {
      const custom = net.handler(call);
      if (custom) return custom;
    }
    const u = new URL(url);
    const hit = site[u.pathname + u.search] || site[u.pathname];
    if (!hit) return netResponse("not found", { status: 404 });
    return typeof hit === "function" ? hit(call) : netResponse(hit.body, { status: hit.status, type: hit.type, headers: hit.headers });
  }

  const self = {
    location: { href: `${SCOPE}sw.js` },
    addEventListener(type, fn) { handlers[type] = fn; },
    registration: { async update() { log.update += 1; if (options.updateFails) throw new TypeError("offline"); } },
    skipWaiting() { log.skipWaiting += 1; return Promise.resolve(); },
    clients: {
      async claim() { log.claim += 1; },
      async matchAll() { return [{ postMessage: (message) => log.posted.push(message) }]; },
    },
  };
  const sandbox = {
    self,
    caches,
    fetch: fakeFetch,
    Request,
    Response,
    Headers,
    URL,
    AbortController,
    crypto: globalThis.crypto,
    console: { warn: (...args) => log.warnings.push(args.join(" ")), info() {}, error() {}, log() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 20)), // the 8 s navigation timeout, in 20 ms
    clearTimeout,
    Date,
    Promise,
    Set,
    Array,
    Object,
    String,
    Uint8Array,
    Error,
    TypeError,
    JSON,
    Math,
  };
  vm.runInNewContext(source, sandbox, { filename: "sw.js" });

  const world = { handlers, log, net, caches, state, version, site, source };

  world.install = async () => {
    const ev = { promises: [], waitUntil(p) { this.promises.push(Promise.resolve(p)); } };
    handlers.install(ev);
    await Promise.all(ev.promises);
  };
  world.activate = async () => {
    const ev = { promises: [], waitUntil(p) { this.promises.push(Promise.resolve(p)); } };
    handlers.activate(ev);
    await Promise.all(ev.promises);
  };
  world.fetch = (url, init = {}) => {
    const request = { url, method: init.method || "GET", mode: init.mode || "no-cors", headers: new Headers(init.headers || {}) };
    const ev = {
      request,
      responded: false,
      response: null,
      promises: [],
      respondWith(p) { this.responded = true; this.response = Promise.resolve(p); },
      waitUntil(p) { this.promises.push(Promise.resolve(p)); },
    };
    handlers.fetch(ev);
    ev.done = async () => { await Promise.all(ev.promises); await tick(); };
    return ev;
  };
  world.navigate = (url) => world.fetch(url, { mode: "navigate" });
  world.cacheUrls = (name) => [...(state.stores.get(name) || new Map()).keys()].map((url) => url.slice(SCOPE.length - 1));
  return world;
}

function defaultSite(version) {
  const site = {
    "/app/": { body: shellHtml(version), headers: { "content-type": "text/html" } },
    "/app/index.html": { body: shellHtml(version), headers: { "content-type": "text/html" } },
    [`/app/styles.css?v=${version}`]: { body: "body{}", headers: { "content-type": "text/css" } },
    [`/app/js/app.js?v=${version}`]: { body: "/*app*/", headers: { "content-type": "text/javascript" } },
    [`/app/js/data/lib.data.js?v=${version}`]: { body: "/*data*/", headers: { "content-type": "text/javascript" } },
    "/app/assets/icon.png": { body: "png", headers: { "content-type": "image/png" } },
    "/app/vendor/e.js": { body: ENGINE_JS, headers: { "content-type": "text/javascript" } },
    "/app/vendor/e.wasm": { body: ENGINE_WASM, headers: { "content-type": "application/wasm" } },
    "/app/assets/extra.webp": { body: "webp", headers: { "content-type": "image/webp" } },
    "/app/package.json": { body: "{}", headers: { "content-type": "application/json" } },
    "/app/LICENSE": { body: "licence", headers: { "content-type": "text/plain" } },
  };
  return site;
}

async function readyWorker(options) {
  const w = makeWorker(options);
  await w.install();
  await w.activate();
  return w;
}

const text = async (response) => (await response).text();

// ---------- Tests ----------

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("the stamped build is what the tests think it is, and the worker source keeps its safety rules", async () => {
  const w = makeWorker();
  ok(w.source.includes(`const CACHE_NAME = "${CACHE_STATIC}";`));
  ok(w.source.includes(`const ENGINE_CACHE = "${CACHE_ENGINE}";`));
  ok(!/ignoreSearch\s*:\s*true/.test(swSource), "no cache lookup that ignores the query string (it mixes builds)");
  eq((swSource.match(/skipWaiting\(\)/g) || []).length, 1, "skipWaiting() appears once");
  ok(swSource.indexOf("skipWaiting()") > swSource.indexOf('addEventListener("message"'), "and only in the message handler");
  ok(/key\.startsWith\(STATIC_PREFIX\)/.test(swSource) && /key\.startsWith\(ENGINE_PREFIX\)/.test(swSource), "activate deletes by prefix");
});

test("install: precaches every file past the HTTP cache, in one cache, all or nothing, without taking over", async () => {
  const w = makeWorker();
  await w.install();
  eq(w.log.skipWaiting, 0, "a new build never swaps itself in");
  same(w.cacheUrls(CACHE_STATIC).sort(), [
    "/", "/assets/icon.png", "/index.html", `/js/app.js?v=${VERSION}`, `/js/data/lib.data.js?v=${VERSION}`, `/styles.css?v=${VERSION}`,
  ].sort(), "the shell, the versioned code, the lazily loaded data and the static assets");
  ok(w.net.calls.length >= 6 && w.net.calls.every((call) => call.cache === "reload"), "every request bypasses the HTTP cache (Pages sends max-age=600)");
  eq(w.caches.stores.has(CACHE_ENGINE), false, "the engine is not precached");

  // A half-deployed site: the shell of another build must not be installed.
  const site = defaultSite(VERSION);
  site["/app/"] = { body: shellHtml("bbbbbbbbbbbb") };
  site["/app/index.html"] = { body: shellHtml("bbbbbbbbbbbb") };
  const stale = makeWorker({ site });
  await assert.rejects(stale.install(), /index\.html is build bbbbbbbbbbbb, this worker is aaaaaaaaaaaa/);
  assertions += 1;

  // One missing file fails the whole install (the old worker keeps running).
  const broken = defaultSite(VERSION);
  delete broken[`/app/js/app.js?v=${VERSION}`];
  await assert.rejects(makeWorker({ site: broken }).install(), /precache: 404/);
  assertions += 1;
  // An error page is not a precache entry either.
  const dead = makeWorker();
  dead.net.down = true;
  await assert.rejects(dead.install());
  assertions += 1;
});

test("activate: deletes only this app's old caches, keeps the engine that still matches, claims the page", async () => {
  const state = { stores: new Map() };
  const w = makeWorker({ state });
  await w.install();
  for (const name of [
    "ludus-scaccorum-static-oldhash", "ludus-scaccorum-engine-oldengine", "sibling-app-offline-v1", "workbox-precache-v2", "other-project-static-1",
  ]) await w.caches.open(name);
  await w.activate();
  same([...state.stores.keys()].sort(), [CACHE_ENGINE, CACHE_STATIC, "other-project-static-1", "sibling-app-offline-v1", "workbox-precache-v2"].sort(),
    "the sibling projects' caches of a shared github.io origin are untouched");
  eq(w.log.claim, 1, "it claims the open page");
  eq(w.log.skipWaiting, 0);
});

test("activate: an engine downloaded by an older worker is kept when it is byte for byte the expected one", async () => {
  const state = { stores: new Map() };
  const old = await makeCaches(state).open("ludus-scaccorum-static-previous");
  await old.put(`${SCOPE}vendor/e.js`, new Response(ENGINE_JS, { headers: { "content-type": "text/javascript" } }));
  await old.put(`${SCOPE}vendor/e.wasm`, new Response(Buffer.from("tampered wasm"), { headers: { "content-type": "application/wasm" } }));
  const w = makeWorker({ state });
  await w.install();
  await w.activate();
  same(w.cacheUrls(CACHE_ENGINE), ["/vendor/e.js"], "the matching file moved over, the tampered one did not");
  eq(state.stores.has("ludus-scaccorum-static-previous"), false, "the old cache is gone");
  // The kept file is served without the network; the missing one is downloaded and verified.
  w.net.calls.length = 0;
  const js = w.fetch(`${SCOPE}vendor/e.js`);
  eq(await text(js.response), ENGINE_JS.toString());
  eq(w.net.calls.length, 0, "no network for the migrated engine file");
  const wasm = w.fetch(`${SCOPE}vendor/e.wasm`);
  eq(Buffer.from(await (await wasm.response).arrayBuffer()).equals(ENGINE_WASM), true);
  eq(w.net.calls.length, 1);
});

test("navigations: the precached shell, at once, whatever the network does (dead, hanging, offline)", async () => {
  const w = await readyWorker();
  for (const mode of ["down", "hang"]) {
    w.net[mode] = true;
    for (const url of [SCOPE, `${SCOPE}index.html`, `${SCOPE}?utm_source=x`, `${SCOPE}?a=1&b=2`]) {
      const ev = w.navigate(url);
      ok(ev.responded, `${url} is answered by the worker (${mode})`);
      const started = Date.now();
      const body = await Promise.race([text(ev.response), tick(400).then(() => "TIMEOUT")]);
      ok(Date.now() - started < 300, `${url} answers immediately while the network is ${mode}`);
      ok(body.includes(`shell ${VERSION}`), `${url} is the shell of this build`);
      await ev.done();
    }
    w.net[mode] = false;
  }
  eq(w.net.calls.filter((call) => !call.url.includes("/app/vendor")).length, 6 /* the install */ + 0, "no navigation touched the network");
});

test("navigations: a new build is looked for on the way (at most once per interval), never waited for", async () => {
  const w = await readyWorker();
  eq(w.log.update, 0);
  const first = w.navigate(SCOPE);
  await first.done();
  eq(w.log.update, 1, "the first navigation checks for a newer sw.js");
  await w.navigate(SCOPE).done();
  await w.navigate(`${SCOPE}index.html`).done();
  eq(w.log.update, 1, "and the next ones inside the interval do not");
  // A failing update check (offline) is swallowed: the page is still answered.
  const failing = await readyWorker({ updateFails: true });
  const ev = failing.navigate(SCOPE);
  ok((await text(ev.response)).includes("shell"));
  await ev.done();
  eq(failing.log.update, 1, "it did try");
  eq(unhandled.length, 0, "and a failed check is not an unhandled rejection");
});

test("navigations: only the page itself; a link to another file or to another origin is left to the browser", async () => {
  const w = await readyWorker();
  eq(w.navigate(`${SCOPE}LICENSE`).responded, false, "LICENSE");
  eq(w.navigate(`${SCOPE}THIRD_PARTY_NOTICES.md`).responded, false, "a markdown file");
  eq(w.navigate(`${ORIGIN}/other/`).responded, false, "outside the scope");
  eq(w.navigate("https://elsewhere.test/app/").responded, false, "another origin");
  eq(w.navigate(`${SCOPE}index.html`).responded, true);
});

test("navigations: without a precached shell (evicted by the browser) the network is tried, but never forever", async () => {
  const w = await readyWorker();
  (await w.caches.open(CACHE_STATIC)); // still there...
  await (await w.caches.open(CACHE_STATIC)).delete(`${SCOPE}index.html`); // ...except the shell
  w.net.hang = true;
  const hanging = w.navigate(SCOPE);
  const started = Date.now();
  await assert.rejects(hanging.response, /abort/i);
  assertions += 1;
  ok(Date.now() - started < 1000, "it gave up (an AbortController timer), it did not hang");
  w.net.hang = false;
  const fine = w.navigate(SCOPE);
  ok((await text(fine.response)).includes("shell"), "with a network it is served from there");
});

test("engine: downloaded once, verified against the build's SHA-256, then served from its own cache with no network", async () => {
  const w = await readyWorker();
  w.net.calls.length = 0;
  for (const rel of Object.keys(ENGINE)) {
    const ev = w.fetch(`${SCOPE}${rel}`);
    ok(ev.responded);
    const response = await ev.response;
    eq(response.status, 200);
    eq(Buffer.from(await response.arrayBuffer()).equals(ENGINE[rel]), true, `${rel} bytes`);
    eq(response.headers.get("content-type"), rel.endsWith(".wasm") ? "application/wasm" : "text/javascript", `${rel} content type survives`);
    await ev.done();
  }
  eq(w.net.calls.length, 2, "one download per file");
  same(w.cacheUrls(CACHE_ENGINE).sort(), ["/vendor/e.js", "/vendor/e.wasm"]);
  eq(w.cacheUrls(CACHE_STATIC).some((url) => url.startsWith("/vendor")), false, "and not in the versioned cache (a deploy would delete it)");
  w.net.down = true;
  for (const url of ["vendor/e.js", "vendor/e.wasm", "vendor/e.js?cachebust=1"]) {
    const ev = w.fetch(`${SCOPE}${url}`);
    eq((await (await ev.response).arrayBuffer()).byteLength > 0, true, `${url} works offline`);
  }
  eq(w.net.calls.length, 2, "no network at all once it is cached");
});

test("engine: bytes that do not match the build are refused, never cached (stale, half-deployed or tampered)", async () => {
  const site = defaultSite(VERSION);
  site["/app/vendor/e.wasm"] = { body: Buffer.from("not the engine you are looking for"), headers: { "content-type": "application/wasm" } };
  const w = await readyWorker({ site });
  w.net.calls.length = 0;
  const ev = w.fetch(`${SCOPE}vendor/e.wasm`);
  const response = await ev.response;
  eq(response.type, "error", "the worker answers with a network error: the page falls back to its built-in engine");
  await ev.done();
  same(w.net.calls.map((call) => call.cache), ["default", "reload"], "it tried once more past the HTTP cache before giving up");
  eq(w.cacheUrls(CACHE_ENGINE).includes("/vendor/e.wasm"), false, "nothing was stored");
  ok(w.log.posted.some((message) => message.type === "ludus-sw" && message.event === "engine-refused"), "the pages are told");
  ok(w.log.warnings.some((line) => /engine-refused/.test(line)), "and it is logged");

  // A stale HTTP-cache copy that the retry replaces with the right bytes is accepted.
  const w2 = await readyWorker();
  w2.net.handler = (call) => (call.url.endsWith("/vendor/e.js") && call.cache !== "reload" ? netResponse("stale bytes") : null);
  const ev2 = w2.fetch(`${SCOPE}vendor/e.js`);
  eq(await text(ev2.response), ENGINE_JS.toString());
  await ev2.done();
  same(w2.net.calls.filter((call) => call.url.endsWith("/vendor/e.js")).map((call) => call.cache), ["default", "reload"]);
  eq(w2.cacheUrls(CACHE_ENGINE).includes("/vendor/e.js"), true, "and cached");

  // An error status is not an engine.
  const w3 = await readyWorker();
  w3.net.handler = (call) => (call.url.endsWith("/vendor/e.js") ? netResponse("oops", { status: 503 }) : null);
  eq((await w3.fetch(`${SCOPE}vendor/e.js`).response).type, "error");
  // A dead network while downloading is an error for the page too, not a hang.
  const w4 = await readyWorker();
  w4.net.down = true;
  await assert.rejects(w4.fetch(`${SCOPE}vendor/e.js`).response);
  assertions += 1;
});

test("engine: a full quota does not break playing: the verified bytes are still returned", async () => {
  const state = { stores: new Map(), failPut: (name) => name === CACHE_ENGINE };
  const w = await readyWorker({ state });
  const ev = w.fetch(`${SCOPE}vendor/e.js`);
  eq(await text(ev.response), ENGINE_JS.toString());
  await ev.done();
  ok(w.log.posted.some((message) => message.event === "engine-cache-failed"), "the failure is reported, not swallowed");
  eq(unhandled.length, 0, "and it is not an unhandled rejection");
});

test("a deploy that does not touch the engine keeps it; one that changes the engine drops the old one", async () => {
  const state = { stores: new Map() };
  const a = await readyWorker({ state });
  for (const rel of Object.keys(ENGINE)) await a.fetch(`${SCOPE}${rel}`).response;
  await tick();
  same(a.cacheUrls(CACHE_ENGINE).sort(), ["/vendor/e.js", "/vendor/e.wasm"]);

  // Deploy B: other JS, same engine files -> same engine cache name.
  const b = makeWorker({ state, version: "bbbbbbbbbbbb", site: defaultSite("bbbbbbbbbbbb") });
  await b.install();
  ok(state.stores.has(CACHE_STATIC) && state.stores.has("ludus-scaccorum-static-bbbbbbbbbbbb"), "while B is waiting both versions exist");
  await b.activate();
  eq(state.stores.has(CACHE_STATIC), false, "A's static cache is gone");
  same(b.cacheUrls(CACHE_ENGINE).sort(), ["/vendor/e.js", "/vendor/e.wasm"], "the 7 MB engine survived the deploy");
  b.net.down = true;
  eq((await (await b.fetch(`${SCOPE}vendor/e.wasm`).response).arrayBuffer()).byteLength, ENGINE_WASM.length, "and works offline right after it");

  // Deploy C: a new engine (other bytes -> other id).
  const newJs = Buffer.from("/* engine js v2 */");
  const site = defaultSite("cccccccccccc");
  site["/app/vendor/e.js"] = { body: newJs };
  const c = makeWorker({ state, version: "cccccccccccc", engineId: "ffffffffffff", site, engine: { "vendor/e.js": newJs, "vendor/e.wasm": ENGINE_WASM } });
  await c.install();
  await c.activate();
  eq(state.stores.has(CACHE_ENGINE), false, "the old engine cache is deleted");
  ok(state.stores.has("ludus-scaccorum-engine-ffffffffffff"), "and the new one has its own name");
  eq(await text(c.fetch(`${SCOPE}vendor/e.js`).response), newJs.toString(), "the new engine is what gets served");
});

test("files of the app: precached ones offline, on-demand ones under assets/ and js/data/, nothing else, bounded", async () => {
  const w = await readyWorker();
  w.net.down = true;
  for (const url of ["styles.css?v=" + VERSION, "js/app.js?v=" + VERSION, "js/data/lib.data.js?v=" + VERSION, "assets/icon.png"]) {
    const ev = w.fetch(`${SCOPE}${url}`);
    ok(ev.responded, `${url} is handled`);
    eq((await ev.response).status, 200, `${url} is served offline from the precache`);
  }
  w.net.down = false;

  // On demand: stored the first time, served offline afterwards.
  const first = w.fetch(`${SCOPE}assets/extra.webp`);
  eq(await text(first.response), "webp");
  await first.done();
  eq(w.cacheUrls(CACHE_STATIC).includes("/assets/extra.webp"), true, "an image under assets/ is kept");
  w.net.down = true;
  eq(await text(w.fetch(`${SCOPE}assets/extra.webp`).response), "webp", "and is there offline");
  w.net.down = false;

  // Not stored: error pages, other response types, odd query strings, other builds' files.
  const missing = w.fetch(`${SCOPE}assets/missing.png`);
  eq((await missing.response).status, 404, "a 404 reaches the page...");
  await missing.done();
  eq(w.cacheUrls(CACHE_STATIC).includes("/assets/missing.png"), false, "...but is never cached");
  const site = w.site;
  site["/app/assets/cors.png"] = (call) => netResponse("x", { type: "cors" });
  site["/app/assets/opaque.png"] = (call) => netResponse("", { type: "opaque" });
  site["/app/assets/partial.png"] = (call) => netResponse("part", { status: 206 });
  for (const url of ["assets/cors.png", "assets/opaque.png", "assets/partial.png", "assets/extra.webp?junk=1", "assets/extra.webp?v=oldbuild", "assets/extra.webp?v=" + VERSION + "&x=2"]) {
    const ev = w.fetch(`${SCOPE}${url}`);
    await ev.response;
    await ev.done();
    eq(w.cacheUrls(CACHE_STATIC).includes(`/${url}`), false, `${url} is not cached`);
  }
  const junkBefore = w.cacheUrls(CACHE_STATIC).length;
  for (let i = 0; i < 25; i += 1) {
    const ev = w.fetch(`${SCOPE}assets/icon.png?junk=${i}`);
    await ev.response;
    await ev.done();
  }
  eq(w.cacheUrls(CACHE_STATIC).length, junkBefore, "a flood of ?junk=N URLs does not grow the cache");

  // Not ours: the worker does not even answer.
  for (const [url, init] of [
    [`${SCOPE}package.json`, {}],
    [`${SCOPE}data/classics/notes.json`, {}],
    [`${SCOPE}docs/ARCHITECTURE.md`, {}],
    [`${SCOPE}LICENSE`, {}],
    ["https://cdn.test/lib.js", {}],
    [`${ORIGIN}/other/app.js`, {}],
    [`${SCOPE}assets/icon.png`, { method: "POST" }],
    [`${SCOPE}assets/icon.png`, { headers: { range: "bytes=0-10" } }],
  ]) {
    eq(w.fetch(url, init).responded, false, `${url} ${JSON.stringify(init)} is left alone`);
  }
});

test("lazily loaded data: a script of another build is refused, not mixed in; the right build is served", async () => {
  const w = await readyWorker();
  w.net.calls.length = 0;
  const stale = w.fetch(`${SCOPE}js/data/lib.data.js?v=oldbuildold1`);
  eq((await stale.response).type, "error", "an old tab asking for its own build's data gets an error, not the new build's bytes");
  eq(w.net.calls.length, 0, "without touching the network");
  eq(await text(w.fetch(`${SCOPE}js/data/lib.data.js?v=${VERSION}`).response), "/*data*/");
  w.net.down = true;
  eq(await text(w.fetch(`${SCOPE}js/data/lib.data.js?v=${VERSION}`).response), "/*data*/", "and it is there offline from the first visit");
});

test("on-demand entries are capped and never push out the precache", async () => {
  const w = await readyWorker();
  for (let i = 0; i < 55; i += 1) {
    w.site[`/app/assets/n${i}.png`] = { body: `n${i}` };
    const ev = w.fetch(`${SCOPE}assets/n${i}.png`);
    await ev.response;
    await ev.done();
  }
  const urls = w.cacheUrls(CACHE_STATIC);
  const extras = urls.filter((url) => /^\/assets\/n\d+\.png$/.test(url));
  ok(extras.length <= 40 && extras.length >= 30, `the extras are capped (${extras.length})`);
  ok(extras.includes("/assets/n54.png") && !extras.includes("/assets/n0.png"), "the oldest went first");
  for (const core of ["/", "/index.html", `/styles.css?v=${VERSION}`, `/js/app.js?v=${VERSION}`, `/js/data/lib.data.js?v=${VERSION}`, "/assets/icon.png"]) {
    ok(urls.includes(core), `${core} is still precached`);
  }
});

test("a full quota while caching an on-demand file: the page still gets it, the failure is reported, nothing is unhandled", async () => {
  const state = { stores: new Map() };
  const w = await readyWorker({ state });
  state.failPut = (name, url) => url.endsWith("/assets/extra.webp");
  const ev = w.fetch(`${SCOPE}assets/extra.webp`);
  eq(await text(ev.response), "webp");
  await ev.done();
  ok(w.log.posted.some((message) => message.event === "cache-put-failed"), "reported to the page");
  ok(w.log.warnings.some((line) => /cache-put-failed/.test(line)), "and logged");
  eq(unhandled.length, 0);
});

test("the page decides when a new build takes over: SKIP_WAITING, and nothing else", async () => {
  const w = await readyWorker();
  w.handlers.message({ data: { type: "SKIP_WAITING" } });
  eq(w.log.skipWaiting, 1);
  for (const data of [{ type: "OTHER" }, null, undefined, "SKIP_WAITING", 42, { type: 1 }, []]) w.handlers.message({ data });
  eq(w.log.skipWaiting, 1, "nothing but the exact message swaps the worker");
});

test("the real sw.js of the repository is syntactically a service worker with all its listeners", async () => {
  const w = makeWorker();
  for (const type of ["install", "activate", "fetch", "message"]) eq(typeof w.handlers[type], "function", `${type} listener`);
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
  eq(unhandled.length, 0, `no unhandled rejection (${unhandled.map(String).join("; ")})`);
  console.log(`sw.test.js: ${done} tests, ${assertions} assertions passed`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
