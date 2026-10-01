// Ludus Scaccorum service worker: offline app shell + a cache for the chess engine.
//
// Three kinds of requests, three policies (docs/ARCHITECTURE.md section 16):
//
//   1. Navigations (the page itself): served from the precache, NEVER waiting for
//      the network. The shell in CACHE_NAME is index.html of the same build as the
//      scripts it names (their ?v=<hash> URLs are in the same cache), so the page
//      can never run one version's HTML with another version's code, and a dead
//      network (Wi-Fi with no internet, a tunnel that accepts connections and never
//      answers) costs nothing. Freshness comes from the service worker update, not
//      from the page request: every navigation checks for a new sw.js (at most one
//      check per UPDATE_CHECK_MS), a new build installs in the background and waits;
//      the page offers "Update ready - reload" and sends { type: "SKIP_WAITING" } when
//      the person agrees (js app.js registerServiceWorker). Nothing swaps under a
//      running session: there is no automatic skipWaiting.
//   2. The engine (vendor/*.js and *.wasm, 7.3 MB, unversioned file names): its OWN
//      cache, ENGINE_CACHE, named after the SHA-256 of the engine files. A deploy that
//      does not touch the engine keeps it (and offline play keeps the strong engine);
//      one that does gets a new name and the old cache is deleted on activate. Only
//      bytes whose SHA-256 is listed in ENGINE_FILES are ever stored or served, so a
//      stale HTTP-cache copy, a half-deployed site or a tampered file is refused
//      (the page then falls back to the built-in engine) instead of pinned forever.
//   3. Everything else that is ours: precached files (CORE_ASSETS, cache-first) and,
//      on demand, files under assets/ and js/data/ (bounded, same-origin 200 responses
//      only, no odd query strings). Anything else is not intercepted at all.
//
// Only caches whose name starts with CACHE_PREFIX are ever deleted: on a GitHub Pages
// user site every project shares one origin and one Cache Storage.
//
// The constants below marked "generated" are written by scripts/generate-version.js
// (content hash of everything the app loads); do not edit them by hand.

const CACHE_PREFIX = "ludus-scaccorum-";
const STATIC_PREFIX = `${CACHE_PREFIX}static-`;
const ENGINE_PREFIX = `${CACHE_PREFIX}engine-`;

// generated
const CACHE_NAME = "ludus-scaccorum-static-828d9118dbde";
// generated
const ENGINE_CACHE = "ludus-scaccorum-engine-64d9ab68faad";
// generated: SHA-256 of every engine file this build was made for
const ENGINE_FILES = {
  "vendor/stockfish-18-lite-single.js": "2278005057f381491f1c9bb3e44c9f5920b3a00bef9759e33cc6582769a1f1fe",
  "vendor/stockfish-18-lite-single.wasm": "a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1",
};
// generated
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./js/boot.js?v=828d9118dbde",
  "./styles.css?v=828d9118dbde",
  "./css/system.css?v=828d9118dbde",
  "./css/shell.css?v=828d9118dbde",
  "./css/board.css?v=828d9118dbde",
  "./css/coach.css?v=828d9118dbde",
  "./css/home.css?v=828d9118dbde",
  "./css/classics.css?v=828d9118dbde",
  "./css/notebook.css?v=828d9118dbde",
  "./css/progress.css?v=828d9118dbde",
  "./css/museum.css?v=828d9118dbde",
  "./css/settings.css?v=828d9118dbde",
  "./css/account.css?v=828d9118dbde",
  "./config.js?v=828d9118dbde",
  "./js/ludus.js?v=828d9118dbde",
  "./js/chess.js?v=828d9118dbde",
  "./js/pgn.js?v=828d9118dbde",
  "./js/engine.js?v=828d9118dbde",
  "./js/scoring.js?v=828d9118dbde",
  "./js/insights.js?v=828d9118dbde",
  "./js/concepts.js?v=828d9118dbde",
  "./js/settings.js?v=828d9118dbde",
  "./js/profile.js?v=828d9118dbde",
  "./js/facts.js?v=828d9118dbde",
  "./js/reader.js?v=828d9118dbde",
  "./js/audio.js?v=828d9118dbde",
  "./js/auth.js?v=828d9118dbde",
  "./js/classics.js?v=828d9118dbde",
  "./js/ui/kit.js?v=828d9118dbde",
  "./js/ui/shell.js?v=828d9118dbde",
  "./js/ui/board.js?v=828d9118dbde",
  "./js/ui/coach.js?v=828d9118dbde",
  "./js/ui/home.js?v=828d9118dbde",
  "./js/ui/classics.js?v=828d9118dbde",
  "./js/ui/notebook.js?v=828d9118dbde",
  "./js/ui/progress.js?v=828d9118dbde",
  "./js/ui/museum.js?v=828d9118dbde",
  "./js/ui/settings.js?v=828d9118dbde",
  "./js/ui/account.js?v=828d9118dbde",
  "./app.js?v=828d9118dbde",
  "./js/data/classics.data.js?v=828d9118dbde",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/brand/logo.svg",
  "./assets/brand/favicon.svg",
  "./assets/fonts/inter-latin-wght.woff2",
  "./assets/fonts/cormorant-latin-wght.woff2",
  "./assets/fonts/inter-latin-ext-wght.woff2",
  "./assets/fonts/cormorant-latin-ext-wght.woff2",
  "./assets/pieces/cburnett/bB.svg",
  "./assets/pieces/cburnett/bK.svg",
  "./assets/pieces/cburnett/bN.svg",
  "./assets/pieces/cburnett/bP.svg",
  "./assets/pieces/cburnett/bQ.svg",
  "./assets/pieces/cburnett/bR.svg",
  "./assets/pieces/cburnett/wB.svg",
  "./assets/pieces/cburnett/wK.svg",
  "./assets/pieces/cburnett/wN.svg",
  "./assets/pieces/cburnett/wP.svg",
  "./assets/pieces/cburnett/wQ.svg",
  "./assets/pieces/cburnett/wR.svg",
];

const VERSION = CACHE_NAME.slice(STATIC_PREFIX.length);
const SCOPE_URL = new URL("./", self.location.href);
const RUNTIME_MAX_ENTRIES = 40; // files cached on demand next to the precache
const RUNTIME_PATHS = ["assets/", "js/data/"];
const UPDATE_CHECK_MS = 15 * 60 * 1000;
const NAVIGATION_TIMEOUT_MS = 8000; // only when the precached shell is missing

const CORE_SET = new Set(CORE_ASSETS.map((asset) => {
  const url = new URL(asset, SCOPE_URL);
  return url.pathname + url.search;
}));

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

// ---------- Small helpers ----------

// The path of a request inside this worker's scope ("" for the root, "js/app.js"),
// or null when it is another origin or outside the scope.
function scopedPath(url) {
  if (url.origin !== SCOPE_URL.origin || !url.pathname.startsWith(SCOPE_URL.pathname)) return null;
  return url.pathname.slice(SCOPE_URL.pathname.length);
}

// A failure that would otherwise be silent (quota, a refused engine file): logged
// here and sent to the open pages, which log it too.
function report(kind, detail) {
  const text = detail && detail.message ? detail.message : String(detail || "");
  try {
    console.warn("[Ludus SW]", kind, text);
  } catch (error) {
    // No console, nothing to do.
  }
  return self.clients.matchAll({ type: "window" })
    .then((list) => list.forEach((client) => client.postMessage({ type: "ludus-sw", event: kind, detail: text })))
    .catch(() => {});
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function defaultType(url) {
  return /\.wasm$/i.test(url) ? "application/wasm" : "text/javascript";
}

// A fresh Response around verified bytes: only the content type is kept (the body
// is already decoded, so a copied Content-Encoding would be wrong).
function engineBytes(buffer, type, url) {
  return new Response(buffer, { status: 200, headers: { "content-type": type || defaultType(url) } });
}

// ---------- Install: precache, all or nothing ----------

// Every file is fetched past the HTTP cache (GitHub Pages sends max-age=600, which
// would hand back the previous deploy's bytes for ten minutes), and the page that
// lands in the cache must be the build this worker was made for.
async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(CORE_ASSETS.map(async (asset) => {
    const request = new Request(new URL(asset, SCOPE_URL).href, { cache: "reload", credentials: "same-origin" });
    const response = await fetch(request);
    if (!response.ok) throw new Error(`precache: ${response.status} for ${asset}`);
    await cache.put(request.url, response);
  }));
  const shell = await cache.match(new URL("./index.html", SCOPE_URL).href);
  const html = shell ? await shell.text() : "";
  const found = (html.match(/<meta\s+name="ludus-version"\s+content="([^"]*)"/i) || [])[1];
  if (found !== VERSION) {
    // A deploy is half way: the next update check tries again (the old worker keeps running).
    throw new Error(`precache: index.html is build ${found || "?"}, this worker is ${VERSION}`);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

// ---------- Activate: migrate the engine, drop only our own old caches ----------

// An engine downloaded by an older worker lives in its (about to be deleted)
// static cache: keep it, if it is byte-for-byte the one this build expects.
async function migrateEngine() {
  const target = await caches.open(ENGINE_CACHE);
  const older = (await caches.keys()).filter((key) => key.startsWith(STATIC_PREFIX) && key !== CACHE_NAME);
  for (const rel of Object.keys(ENGINE_FILES)) {
    const url = new URL(rel, SCOPE_URL).href;
    if (await target.match(url)) continue;
    for (const key of older) {
      const hit = await (await caches.open(key)).match(url);
      if (!hit) continue;
      const buffer = await hit.arrayBuffer();
      if (await sha256Hex(buffer) !== ENGINE_FILES[rel]) continue;
      await target.put(url, engineBytes(buffer, hit.headers.get("content-type"), url));
      break;
    }
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      await migrateEngine();
    } catch (error) {
      report("engine-migration-failed", error);
    }
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => (key.startsWith(STATIC_PREFIX) && key !== CACHE_NAME) || (key.startsWith(ENGINE_PREFIX) && key !== ENGINE_CACHE))
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

// The page asks for the swap only when the person agrees to reload.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && typeof data === "object" && data.type === "SKIP_WAITING") self.skipWaiting();
});

// ---------- Navigations ----------

let lastUpdateCheck = 0;

function checkForUpdate() {
  const now = Date.now();
  if (now - lastUpdateCheck < UPDATE_CHECK_MS) return Promise.resolve();
  lastUpdateCheck = now;
  return self.registration.update().catch(() => {});
}

async function shellResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const shell = await cache.match(new URL("./index.html", SCOPE_URL).href);
  if (shell) return shell;
  // The browser evicted the precache (storage pressure): the network, but never forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS);
  try {
    return await fetch(request.url, { signal: controller.signal, credentials: "same-origin", cache: "no-cache" });
  } finally {
    clearTimeout(timer);
  }
}

// ---------- The engine ----------

// One network fetch whose bytes must match the expected SHA-256; null when they do not.
async function fetchVerified(url, expected, bypassHttpCache) {
  const response = await fetch(new Request(url, { cache: bypassHttpCache ? "reload" : "default", credentials: "same-origin" }));
  if (response.status !== 200) return null;
  const buffer = await response.arrayBuffer();
  if (await sha256Hex(buffer) !== expected) return null;
  return engineBytes(buffer, response.headers.get("content-type"), url);
}

async function engineResponse(event, rel) {
  const cache = await caches.open(ENGINE_CACHE);
  const url = new URL(rel, SCOPE_URL).href;
  const hit = await cache.match(url);
  if (hit) return hit;
  const expected = ENGINE_FILES[rel];
  let verified = await fetchVerified(url, expected, false);
  if (!verified) verified = await fetchVerified(url, expected, true); // once more, past a stale HTTP-cache copy
  if (!verified) {
    event.waitUntil(report("engine-refused", `${rel} does not match the build of this service worker`));
    return Response.error();
  }
  event.waitUntil(cache.put(url, verified.clone()).catch((error) => report("engine-cache-failed", error)));
  return verified;
}

// ---------- Everything else ----------

const versionOf = (url) => url.searchParams.get("v");

// May this response be kept? Only a complete same-origin 200 of a file that is ours,
// with no query string but the build version, and never another build's.
function storable(url, path, response) {
  if (response.status !== 200 || response.type !== "basic") return false;
  if (!(CORE_SET.has(url.pathname + url.search) || RUNTIME_PATHS.some((prefix) => path.startsWith(prefix)))) return false;
  for (const key of url.searchParams.keys()) {
    if (key !== "v") return false;
  }
  const version = versionOf(url);
  return version === null || version === VERSION;
}

async function trim(cache) {
  const extra = (await cache.keys()).filter((key) => {
    const url = new URL(key.url);
    return !CORE_SET.has(url.pathname + url.search);
  });
  for (let i = 0; i < extra.length - RUNTIME_MAX_ENTRIES; i += 1) await cache.delete(extra[i]);
}

async function remember(cache, request, response) {
  try {
    await cache.put(request, response);
    await trim(cache);
  } catch (error) {
    report("cache-put-failed", error); // quota: the page still got its response
  }
}

async function staticResponse(event, request, url, path) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(request);
  if (hit) return hit;
  // A lazily loaded script of ANOTHER build (an old tab, after an update): refuse it
  // rather than mix versions; the page reports that loading failed and offers a reload.
  const version = versionOf(url);
  if (path.startsWith("js/data/") && version !== null && version !== VERSION) return Response.error();
  const response = await fetch(request);
  if (storable(url, path, response)) event.waitUntil(remember(cache, request, response.clone()));
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  let url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return;
  }
  const path = scopedPath(url);
  if (path === null) return; // not ours: another origin, or outside the scope

  if (request.mode === "navigate") {
    if (path === "" || path === "index.html") {
      event.waitUntil(checkForUpdate());
      event.respondWith(shellResponse(request));
    }
    return; // a link to LICENSE, a markdown file, ...: the browser's own business
  }
  if (hasOwn(ENGINE_FILES, path)) {
    event.respondWith(engineResponse(event, path));
    return;
  }
  if (request.headers.has("range")) return;
  if (!CORE_SET.has(url.pathname + url.search) && !RUNTIME_PATHS.some((prefix) => path.startsWith(prefix))) return;
  event.respondWith(staticResponse(event, request, url, path));
});
