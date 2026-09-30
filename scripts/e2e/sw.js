// Browser checks of the service worker on a deploy-shaped copy of the site
// (PERF-001, PERF-002, PERF-007, PERF-008, PERF-010, SEC-001, SEC-010, SEC-015).
//
// Unlike the other scripts in this folder it needs no server of its own: it builds
// the sites it needs in a temporary directory (the deployable files of the repo, the
// content hash regenerated there, exactly as deploy-pages.yml does; the repository is
// not modified) and serves them with a GitHub-Pages-like server that can "deploy" a
// new build, reset connections (offline) or accept them and never answer (dead network):
//
//   A  the current tree            B  a next deploy: js/pgn.js and <title> changed (same engine)
//   C  a deploy that swaps the engine
//
// Scenarios (LUDUS_SW_ONLY=1,3 runs a subset):
//   1  first visit, warm cache, offline and a dead network: the shell opens at once
//   2  a deploy: no mixed versions, an "update ready" prompt, the 7 MB engine survives it
//   3  the update prompt never appears over a running session
//   4  an engine that does not match the worker's build is refused (built-in engine), and a
//      new engine reaches the player through the update
//   5  a storage quota too small for the precache: logged, the app still works online
//   6  two tabs: one accepts the update, the other is offered a reload
//   7  service workers blocked or absent: the app boots with no console error
//
// Playwright is not a project dependency (see smoke.js for how to run it):
//   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/sw.js
// Environment: LUDUS_SW_PORT (default 5116), LUDUS_CHROMIUM (path to a Chromium).
// Exits 0 on success, 1 on the first failed assertion, 2 if Playwright is missing.

"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright is not installed. Run with NODE_PATH=/opt/node22/lib/node_modules (see the header of this file).");
  process.exit(2);
}
const { createPagesServer } = require("./_pages-server.js");

const repo = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.LUDUS_SW_PORT) || 5116;
const BASE = `http://localhost:${PORT}/`;
const FALLBACK_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const ONLY = (process.env.LUDUS_SW_ONLY || "").split(",").map((entry) => entry.trim()).filter(Boolean);
const DEPLOY_SET = ["index.html", "app.js", "styles.css", "config.js", "sw.js", "manifest.json", "LICENSE", "THIRD_PARTY_NOTICES.md", "js", "css", "assets", "vendor"];

const step = (message) => console.log(`  - ${message}`);

// ---------- Building the sites ----------

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ludus-sw-e2e-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));

function buildSite(name, mutate) {
  const work = path.join(tmp, `${name}-repo`);
  fs.mkdirSync(path.join(work, "scripts"), { recursive: true });
  for (const entry of DEPLOY_SET) fs.cpSync(path.join(repo, entry), path.join(work, entry), { recursive: true });
  fs.copyFileSync(path.join(repo, "scripts", "generate-version.js"), path.join(work, "scripts", "generate-version.js"));
  if (mutate) mutate(work);
  const result = spawnSync(process.execPath, [path.join(work, "scripts", "generate-version.js")], { cwd: work, encoding: "utf8" });
  assert.strictEqual(result.status, 0, `generate-version failed: ${result.stdout}${result.stderr}`);
  const site = path.join(tmp, name);
  fs.mkdirSync(site, { recursive: true });
  for (const entry of DEPLOY_SET) fs.cpSync(path.join(work, entry), path.join(site, entry), { recursive: true, filter: (source) => !source.endsWith(".gitkeep") });
  const html = fs.readFileSync(path.join(site, "index.html"), "utf8");
  const version = (html.match(/name="ludus-version" content="([a-f0-9]{12})"/) || [])[1];
  const sw = fs.readFileSync(path.join(site, "sw.js"), "utf8");
  return {
    dir: site,
    version,
    engine: (sw.match(/ENGINE_CACHE = "(ludus-scaccorum-engine-[a-f0-9]{12})"/) || [])[1],
    precache: (sw.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)[1].match(/"[^"]*"/g) || []).length,
  };
}

// ---------- Browser helpers ----------

async function launch() {
  const args = ["--no-sandbox"];
  try {
    return await chromium.launch({ args });
  } catch (firstError) {
    const explicit = process.env.LUDUS_CHROMIUM || FALLBACK_CHROMIUM;
    if (!fs.existsSync(explicit)) throw firstError;
    return chromium.launch({ executablePath: explicit, args });
  }
}

function watch(page, log) {
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error") log.errors.push(text);
    if (message.type() === "warning") log.warnings.push(text);
  });
  page.on("pageerror", (error) => log.errors.push(error.stack || error.message));
  page.on("requestfailed", (request) => log.failed.push(`${request.method()} ${request.url()} ${request.failure() && request.failure().errorText}`));
}

const newLog = () => ({ errors: [], warnings: [], failed: [] });

async function open(browser, server, site, options = {}) {
  server.setMode("ok");
  server.deploy(site.dir);
  const context = await browser.newContext({ serviceWorkers: "allow", locale: "es-AR", viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const log = newLog();
  watch(page, log);
  if (options.quota) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Storage.overrideQuotaForOrigin", { origin: `http://localhost:${PORT}`, quotaSize: options.quota });
  }
  await page.goto(BASE, { waitUntil: "load" });
  return { context, page, log };
}

const controlled = (page) => page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 30000 });
const booted = (page, timeout = 8000) => page.waitForFunction(() => window.Ludus && Ludus.router && Ludus.router.current(), null, { timeout });
const toasts = (page) => page.locator(".toast-message").allInnerTexts();
const metaVersion = (page) => page.evaluate(() => document.querySelector('meta[name="ludus-version"]').content);

async function waitForToast(page, pattern, timeout = 30000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const found = (await toasts(page)).find((text) => pattern.test(text));
    if (found) return found;
    if (Date.now() > deadline) throw new Error(`no toast matching ${pattern} (saw: ${JSON.stringify(await toasts(page))})`);
    await page.waitForTimeout(250);
  }
}

// The caches of the origin: { name: ["path?query", ...] }.
function cacheState(page) {
  return page.evaluate(async () => {
    const out = {};
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      out[key] = (await cache.keys()).map((request) => {
        const url = new URL(request.url);
        return url.pathname.replace(/^\//, "") + url.search;
      });
    }
    return out;
  });
}

async function startSession(page) {
  await page.evaluate(async () => {
    await Ludus.Classics.load();
    const game = Ludus.Classics.list()[0];
    Ludus.game.startSession({ kind: "classic", title: "sw e2e", positions: Ludus.Classics.positions(game.id, { count: 1 }) });
  });
}

const strongEngine = (page, timeout = 90000) => page.waitForFunction(() => Ludus.game.isUsingFallbackEngine() === false, null, { timeout });
const vendorRequests = (server, since) => server.requests.filter((request) => request.time >= since && request.path.startsWith("/vendor/"));

// ---------- Scenarios ----------

const scenarios = {
  1: async ({ browser, server, A }) => {
    const { context, page, log } = await open(browser, server, A);
    step("first visit: the worker installs, claims the page and says it is ready offline (once)");
    await controlled(page);
    await waitForToast(page, /sin conexión/i);
    let caches = await cacheState(page);
    assert.deepStrictEqual(Object.keys(caches).sort(), [`ludus-scaccorum-static-${A.version}`].concat(caches[A.engine] ? [A.engine] : []).sort(), "only this app's caches");
    assert.strictEqual(caches[`ludus-scaccorum-static-${A.version}`].length, A.precache, "everything in CORE_ASSETS is precached");
    assert.ok(caches[`ludus-scaccorum-static-${A.version}`].some((entry) => entry.startsWith("js/data/classics.data.js")), "the Classics library is precached");
    assert.ok(!Object.values(caches).flat().some((entry) => entry.startsWith("vendor/")), "the engine is not downloaded just for opening the app");
    await page.reload({ waitUntil: "load" });
    await booted(page);
    await page.waitForTimeout(1500);
    assert.ok(!(await toasts(page)).some((text) => /sin conexión/i.test(text)), "\"ready offline\" is said once, not on every visit");

    step("offline (the server resets every connection): the app opens from the cache at once, Classics data included");
    server.setMode("refuse");
    let started = Date.now();
    await page.reload({ waitUntil: "load" });
    await booted(page);
    assert.ok(Date.now() - started < 3000, `offline reload took ${Date.now() - started} ms`);
    step(`  (offline reload: ${Date.now() - started} ms)`);
    assert.strictEqual(await metaVersion(page), A.version);
    await page.evaluate(() => { location.hash = "#/classics"; });
    await page.waitForFunction(() => Ludus.Classics.list().length > 0 || Ludus.Classics.load().then(() => Ludus.Classics.list().length > 0), null, { timeout: 8000 });
    await page.goto(`${BASE}?utm_source=x#/home`, { waitUntil: "load" });
    await booted(page);

    step("dead network (connections accepted, never answered): the shell commits in under 2 s, not after a minute");
    server.setMode("hang");
    started = Date.now();
    await page.goto(BASE, { waitUntil: "commit", timeout: 20000 });
    const committed = Date.now() - started;
    assert.ok(committed < 2000, `navigation with a hanging network committed after ${committed} ms`);
    step(`  (dead network: the page committed after ${committed} ms; it used to hang for 75 s and more)`);
    await booted(page, 5000);
    assert.ok(Date.now() - started < 4000, "and the app is running shortly after");

    assert.deepStrictEqual(log.errors, [], `no console errors: ${JSON.stringify(log.errors)} (failed requests: ${JSON.stringify(log.failed)})`);
    await context.close();
  },

  2: async ({ browser, server, A, B }) => {
    const { context, page, log } = await open(browser, server, A);
    await controlled(page);
    await waitForToast(page, /sin conexión/i);
    await page.evaluate(() => caches.open("sibling-app-offline-v1")); // another project of a shared github.io origin

    step("play once online: the engine is downloaded into its own cache, not the versioned one");
    await startSession(page);
    await strongEngine(page);
    let caches = await cacheState(page);
    assert.deepStrictEqual(caches[A.engine].map((entry) => entry.replace(/\?.*/, "")).sort(), ["vendor/stockfish-18-lite-single.js", "vendor/stockfish-18-lite-single.wasm"]);
    assert.ok(!caches[`ludus-scaccorum-static-${A.version}`].some((entry) => entry.startsWith("vendor/")));
    await page.evaluate(() => Ludus.game.abort());

    step("a new deploy (B): the open page keeps running build A, B installs in the background, nothing is mixed");
    const deployedAt = Date.now();
    server.deploy(B.dir);
    await page.reload({ waitUntil: "load" });
    await booted(page);
    assert.strictEqual(await metaVersion(page), A.version, "a reload right after a deploy still opens build A (from the worker), consistently");
    const versions = await page.evaluate(() => [...document.querySelectorAll("script[src],link[rel=stylesheet]")].map((el) => (el.getAttribute("src") || el.getAttribute("href")).match(/\?v=([a-f0-9]+)/)?.[1]));
    assert.ok(versions.every((version) => version === A.version), "every script and stylesheet is build A's");
    const toast = await waitForToast(page, /versión nueva/i);
    assert.ok(/Ludus Scaccorum/.test(toast));
    caches = await cacheState(page);
    assert.ok(caches[`ludus-scaccorum-static-${A.version}`] && caches[`ludus-scaccorum-static-${B.version}`], "both builds are in Cache Storage while B waits");
    const shellB = await page.evaluate(async (name) => (await (await (await caches.open(name)).match("./index.html")).text()).match(/name="ludus-version" content="([a-f0-9]+)"/)[1], `ludus-scaccorum-static-${B.version}`);
    assert.strictEqual(shellB, B.version, "the precached page is B's, even though the HTTP cache still held A's for ten minutes");
    assert.strictEqual(vendorRequests(server, deployedAt).length, 0, "the deploy did not touch the engine");

    step("accepting the update: B takes over, A's cache goes, the engine and the sibling project's cache stay");
    await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.locator(".toast-action").first().click()]);
    await booted(page);
    assert.strictEqual(await metaVersion(page), B.version);
    const pgn = await page.evaluate(async () => {
      const src = [...document.scripts].map((script) => script.getAttribute("src")).find((url) => /js\/pgn\.js/.test(url));
      return (await (await fetch(src)).text()).includes("deploy B");
    });
    assert.ok(pgn, "the code that runs is B's (js/pgn.js carries B's marker)");
    caches = await cacheState(page);
    assert.deepStrictEqual(Object.keys(caches).sort(), [A.engine, "sibling-app-offline-v1", `ludus-scaccorum-static-${B.version}`].sort());
    assert.strictEqual(caches[A.engine].length, 2, "the 7 MB engine survived the deploy");

    step("offline right after the deploy: the strong engine is ready from the cache without a single request");
    server.setMode("refuse");
    const offlineAt = Date.now();
    await page.reload({ waitUntil: "load" });
    await booted(page);
    await startSession(page);
    await strongEngine(page, 20000);
    assert.strictEqual(vendorRequests(server, deployedAt).length, 0, "no engine download after the deploy, not even a revalidation");
    assert.ok(Date.now() - offlineAt < 20000);
    assert.deepStrictEqual(log.errors.filter((text) => !/ERR_CONNECTION_RESET|Failed to load resource/.test(text)), [], "no script errors");
    await context.close();
  },

  3: async ({ browser, server, A, B }) => {
    const { context, page } = await open(browser, server, A);
    await controlled(page);
    await waitForToast(page, /sin conexión/i);
    await page.waitForTimeout(8500); // let "ready offline" go
    step("a session is running when the deploy lands: no prompt over the board");
    await startSession(page);
    await page.waitForFunction(() => Ludus.game.isActive());
    server.deploy(B.dir);
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((registration) => registration.update()));
    await page.waitForFunction(() => navigator.serviceWorker.getRegistration().then((registration) => Boolean(registration.waiting)), null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    assert.ok(!(await toasts(page)).some((text) => /versión nueva/i.test(text)), "nothing is offered while a session runs");
    step("the session ends: now it is offered");
    await page.evaluate(() => Ludus.game.abort());
    await waitForToast(page, /versión nueva/i, 10000);
    await context.close();
  },

  4: async ({ browser, server, A, C }) => {
    const { context, page, log } = await open(browser, server, A);
    await controlled(page);
    await waitForToast(page, /sin conexión/i);
    step("the engine on the server is not the one this worker was built for: refused, the built-in engine plays");
    server.deploy(C.dir);
    await startSession(page);
    await page.waitForTimeout(6000);
    assert.strictEqual(await page.evaluate(() => Ludus.game.isUsingFallbackEngine()), true, "still the built-in engine");
    const caches = await cacheState(page);
    // C changed the engine script only: the unchanged wasm still matches the pinned hash and may be kept, the script may not.
    assert.ok(!Object.values(caches).flat().some((entry) => entry.startsWith("vendor/stockfish-18-lite-single.js")), "the engine script that does not match was not cached");
    assert.ok(log.warnings.some((text) => /engine-refused/.test(text)), `the refusal is logged: ${JSON.stringify(log.warnings)}`);
    await page.evaluate(() => Ludus.game.abort());
    step("the update brings the new engine");
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((registration) => registration.update()));
    await waitForToast(page, /versión nueva/i, 30000);
    await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.locator(".toast-action").first().click()]);
    await booted(page);
    assert.strictEqual(await metaVersion(page), C.version);
    await startSession(page);
    await strongEngine(page);
    const after = await cacheState(page);
    assert.deepStrictEqual(Object.keys(after).filter((name) => name.includes("engine")), [C.engine], "a single engine cache, the new one");
    await context.close();
  },

  5: async ({ browser, server, A }) => {
    step("storage too small for the precache: the install fails loudly in the console, the app still works");
    const { context, page, log } = await open(browser, server, A, { quota: 1024 * 1024 });
    await booted(page);
    await page.waitForTimeout(6000);
    assert.ok(log.warnings.some((text) => /service worker could not install/i.test(text)), `logged: ${JSON.stringify(log.warnings)}`);
    assert.strictEqual(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), false, "no worker controls the page");
    assert.ok(!(await toasts(page)).some((text) => /sin conexión/i.test(text)), "and nothing claims offline mode");
    await startSession(page);
    await page.waitForFunction(() => Ludus.game.isActive());
    await context.close();
  },

  6: async ({ browser, server, A, B }) => {
    const { context, page, log } = await open(browser, server, A);
    await controlled(page);
    await waitForToast(page, /sin conexión/i);
    const second = await context.newPage();
    watch(second, newLog());
    await second.goto(BASE, { waitUntil: "load" });
    await booted(second);
    server.deploy(B.dir);
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((registration) => registration.update()));
    await waitForToast(page, /versión nueva/i, 30000);
    await waitForToast(second, /versión nueva/i, 30000);
    step("one tab accepts: the other is offered a reload (it would otherwise run old code under the new worker)");
    await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.locator(".toast-action").first().click()]);
    await booted(page);
    assert.strictEqual(await metaVersion(page), B.version);
    assert.strictEqual(await metaVersion(second), A.version, "the other tab was NOT reloaded under the person's feet");
    await waitForToast(second, /versión nueva/i, 10000);
    await Promise.all([second.waitForNavigation({ waitUntil: "load" }), second.locator(".toast-action").first().click()]);
    await booted(second);
    assert.strictEqual(await metaVersion(second), B.version);
    assert.deepStrictEqual(log.errors, [], `no console errors: ${JSON.stringify(log.errors)}`);
    await context.close();
  },

  7: async ({ browser, server, A }) => {
    step("service workers blocked (Playwright's serviceWorkers: \"block\" stubs register() out): the app boots with no console error and no prompt");
    server.setMode("ok");
    server.deploy(A.dir);
    const context = await browser.newContext({ serviceWorkers: "block", locale: "es-AR", viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const log = newLog();
    watch(page, log);
    await page.goto(BASE, { waitUntil: "load" });
    await booted(page);
    await page.waitForTimeout(1500);
    assert.deepStrictEqual(log.errors, [], `no console errors: ${JSON.stringify(log.errors)}`);
    assert.deepStrictEqual(await toasts(page), [], "no offline or update message without a worker");
    await startSession(page);
    await page.waitForFunction(() => Ludus.game.isActive());
    assert.deepStrictEqual(log.errors, [], "and the app plays");
    await context.close();

    step("no service worker API at all (an old or locked-down browser)");
    const bare = await browser.newContext({ serviceWorkers: "allow", locale: "es-AR" });
    await bare.addInitScript(() => { Object.defineProperty(Navigator.prototype, "serviceWorker", { get: () => undefined }); });
    const barePage = await bare.newPage();
    const bareLog = newLog();
    watch(barePage, bareLog);
    await barePage.goto(BASE, { waitUntil: "load" });
    await booted(barePage);
    assert.deepStrictEqual(bareLog.errors, [], `no console errors: ${JSON.stringify(bareLog.errors)}`);
    await bare.close();
  },
};

// ---------- Main ----------

(async () => {
  console.log("building the test sites (A: current tree, B: next deploy, C: new engine)...");
  const A = buildSite("A");
  const B = buildSite("B", (work) => {
    fs.appendFileSync(path.join(work, "js", "pgn.js"), "\n/* deploy B */\n");
    const html = fs.readFileSync(path.join(work, "index.html"), "utf8");
    fs.writeFileSync(path.join(work, "index.html"), html.replace(/<\/title>/, " (B)</title>"));
  });
  const C = buildSite("C", (work) => {
    fs.appendFileSync(path.join(work, "vendor", "stockfish-18-lite-single.js"), "\n/* a different engine build */\n");
  });
  assert.notStrictEqual(A.version, B.version);
  assert.strictEqual(A.engine, B.engine, "B keeps the engine");
  assert.notStrictEqual(A.engine, C.engine, "C swaps it");

  const server = createPagesServer(A.dir);
  await server.listen(PORT);
  const browser = await launch();
  let failed = false;
  try {
    for (const id of Object.keys(scenarios)) {
      if (ONLY.length && !ONLY.includes(id)) continue;
      console.log(`\n[${id}]`);
      try {
        await scenarios[id]({ browser, server, A, B, C });
        console.log("  ok");
      } catch (error) {
        failed = true;
        console.error(`  FAILED: ${error && error.stack ? error.stack : error}`);
        break;
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
  if (failed) process.exit(1);
  console.log("\nsw e2e: all scenarios passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
