// Browser smoke test: loads the real site in Chromium at desktop and phone
// sizes and checks that it boots cleanly.
//
// Playwright is NOT a project dependency (the app has no runtime or dev
// dependencies) and this script is not part of `npm test`. Run it by hand:
//
//   python3 -m http.server 5010 &                      # serve the repo root
//   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/smoke.js
//
// Environment (all optional):
//   LUDUS_URL             page to test               (default http://127.0.0.1:5010/)
//   PLAYWRIGHT_BROWSERS_PATH  where Playwright finds its Chromium; picked up
//                         automatically. If Playwright cannot launch its own
//                         build, the script falls back to
//                         /opt/pw-browsers/chromium-1194/chrome-linux/chrome
//                         (or LUDUS_CHROMIUM=/path/to/chrome).
//   LUDUS_E2E_SHOTS       directory for screenshots (none are saved when unset)
//
// It asserts, for each viewport (1280x800 and 390x844): no console errors, no
// uncaught page errors, no failed or 4xx/5xx requests (service worker requests
// included); the landing screen is visible; Ludus.chess.Chess exists and every
// script carries the build version; the start button leads to the home hub;
// the own-games wizard (opened through Ludus.game.openOwnGamesSetup) still
// steps forward/back and toggles duel mode, and its back button goes home;
// the ES/EN toggle switches language. On the desktop run it also waits for the service worker
// and checks that the precache holds exactly the files sw.js lists.
// Exits 0 on success, 1 on the first failed assertion, 2 if Playwright is
// missing.

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright is not installed. Run with NODE_PATH=/opt/node22/lib/node_modules (see the header of this file).");
  process.exit(2);
}

const BASE_URL = process.env.LUDUS_URL || "http://127.0.0.1:5010/";
const FALLBACK_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SHOT_DIR = process.env.LUDUS_E2E_SHOTS || "";
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800, checkServiceWorker: true },
  { name: "phone", width: 390, height: 844, checkServiceWorker: false },
];

async function launchBrowser() {
  const args = ["--no-sandbox"];
  try {
    // Uses PLAYWRIGHT_BROWSERS_PATH / the default cache when it has the right build.
    return await chromium.launch({ args });
  } catch (firstError) {
    const explicit = process.env.LUDUS_CHROMIUM || FALLBACK_CHROMIUM;
    if (!fs.existsSync(explicit)) throw firstError;
    return chromium.launch({ executablePath: explicit, args });
  }
}

function step(message) {
  console.log(`  - ${message}`);
}

async function shot(page, name) {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
}

async function isHidden(page, selector) {
  return page.locator(selector).evaluate((el) => {
    const style = getComputedStyle(el);
    return el.classList.contains("hidden") || style.display === "none" || style.visibility === "hidden";
  });
}

async function runViewport(browser, viewport) {
  console.log(`\n[${viewport.name}] ${viewport.width}x${viewport.height}`);
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: "es-AR",
    serviceWorkers: "allow",
  });
  const problems = [];
  const note = (kind, detail) => problems.push(`${kind}: ${detail}`);

  // Context-level listeners also see requests made by the service worker.
  context.on("requestfailed", (request) => note("request failed", `${request.method()} ${request.url()} (${request.failure() && request.failure().errorText})`));
  context.on("response", (response) => {
    if (response.status() >= 400) note(`HTTP ${response.status()}`, response.url());
  });

  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") note("console error", message.text());
  });
  page.on("pageerror", (error) => note("page error", error.stack || error.message));

  await page.goto(BASE_URL, { waitUntil: "load" });

  // ----- Landing screen -----
  step("landing screen is visible");
  await page.locator("#landing-screen").waitFor({ state: "visible" });
  assert.strictEqual(await isHidden(page, "#landing-screen"), false, "landing screen visible");
  assert.strictEqual(await isHidden(page, "#landing-start-btn"), false, "start button visible");
  assert.strictEqual(await isHidden(page, "#setup-panel"), true, "setup wizard is not shown yet");
  assert.strictEqual(await page.evaluate(() => document.documentElement.lang), "es", "es-AR browser starts in Spanish");
  assert.strictEqual((await page.locator("#landing-start-btn").innerText()).trim(), "Empezar a entrenar");
  await shot(page, `landing-${viewport.width}x${viewport.height}`);

  // ----- Modules and versioning -----
  step("Ludus namespace, chess module and build version");
  const info = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll("script[src]")).map((el) => el.getAttribute("src"));
    const sheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((el) => el.getAttribute("href"));
    return {
      hasChess: typeof Ludus.chess.Chess === "function" && typeof Ludus.chess.uciToMove === "function",
      startFen: new Ludus.chess.Chess().fen(),
      hasPgn: typeof Ludus.pgn.parseTags === "function",
      version: Ludus.version,
      metaVersion: document.querySelector('meta[name="ludus-version"]').getAttribute("content"),
      lang: Ludus.i18n.lang(),
      htmlLang: document.documentElement.lang,
      scripts,
      sheets,
      screens: ["home", "classics", "notebook", "progress", "museum", "settings", "account"].map((name) => {
        const el = document.getElementById(`screen-${name}`);
        return { name, exists: Boolean(el), hidden: Boolean(el && el.classList.contains("hidden")) };
      }),
      screenApi: ["home", "classics", "notebook", "progress", "museum", "settings", "account"].every((name) => typeof Ludus.Screens[name].mount === "function"),
      namespaces: ["Engine", "Scoring", "Insights", "Concepts", "Settings", "Profile", "Facts", "Reader", "Audio", "Auth", "Classics"].filter((name) => !Ludus[name]),
      iconHrefs: Array.from(document.querySelectorAll('link[rel="icon"]')).map((el) => el.getAttribute("href")),
    };
  });
  assert.strictEqual(info.hasChess, true, "Ludus.chess.Chess exists");
  assert.strictEqual(info.startFen, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  assert.strictEqual(info.hasPgn, true, "Ludus.pgn exists");
  assert.match(info.version, /^[0-9a-f]{12}$/, "Ludus.version is the content hash stamped into the page");
  assert.strictEqual(info.version, info.metaVersion);
  assert.strictEqual(info.lang, info.htmlLang, "Ludus.i18n and app.js agree on the initial language");
  assert.deepStrictEqual(info.namespaces, [], "every module namespace is registered");
  assert.strictEqual(info.screenApi, true, "every screen exposes mount()");
  info.screens.forEach((screen) => {
    assert.ok(screen.exists && screen.hidden, `#screen-${screen.name} exists and starts hidden`);
  });
  [...info.scripts, ...info.sheets].forEach((url) => {
    assert.ok(url.endsWith(`?v=${info.version}`), `${url} carries ?v=${info.version}`);
  });
  assert.strictEqual(info.scripts[0].split("?")[0], "js/boot.js", "the boot guard is the one script in <head>");
  assert.strictEqual(info.scripts[1].split("?")[0], "config.js");
  assert.strictEqual(info.scripts[info.scripts.length - 1].split("?")[0], "app.js");
  assert.ok(info.iconHrefs.includes("assets/icons/icon-192.png"), "the PNG icon is declared");
  assert.ok(info.iconHrefs.includes("assets/brand/favicon.svg"), "the SVG favicon is declared");

  // ----- Start button leads home; the wizard is opened from there -----
  step("start button goes to the home hub, not straight into the wizard");
  await page.locator("#landing-start-btn").click();
  await page.locator("#screen-home").waitFor({ state: "visible" });
  assert.strictEqual(await page.evaluate(() => Ludus.router.current()), "home");
  assert.strictEqual(await isHidden(page, "#landing-screen"), true, "landing hides");
  assert.strictEqual(await isHidden(page, "#setup-panel"), true, "the wizard is not shown yet");

  step("the own-games wizard opens on step 1");
  await page.evaluate(() => Ludus.game.openOwnGamesSetup());
  await page.locator("#setup-panel").waitFor({ state: "visible" });
  assert.strictEqual(await isHidden(page, "#wizard-step-1"), false, "wizard step 1 shows");
  assert.strictEqual(await isHidden(page, "#wizard-step-2"), true);
  assert.match(await page.locator("#wizard-step-indicator").innerText(), /1/, "step indicator says step 1");
  await page.waitForTimeout(400); // let the step's fade-in finish so the screenshot is representative
  await shot(page, `wizard-${viewport.width}x${viewport.height}`);

  step("wizard steps forward and back, duel option toggles");
  await page.locator("#wizard-mode-duel").click();
  assert.strictEqual(await isHidden(page, "#duel-config"), false, "duel names appear");
  await page.locator("#wizard-mode-solo").click();
  assert.strictEqual(await isHidden(page, "#duel-config"), true, "duel names disappear");
  await page.locator("#wizard-next-btn").click();
  await page.locator("#wizard-step-2").waitFor({ state: "visible" });
  assert.strictEqual(await isHidden(page, "#wizard-step-1"), true, "step 1 hides on step 2");
  assert.match(await page.locator("#wizard-step-indicator").innerText(), /2/, "step indicator says step 2");
  await page.locator("#wizard-prev-btn").click();
  await page.locator("#wizard-step-1").waitFor({ state: "visible" });

  // ----- Language toggle -----
  step("language toggle switches to English and back");
  await page.locator("#language-btn-en").click();
  await page.waitForFunction(() => document.documentElement.lang === "en");
  assert.strictEqual(await page.locator("#language-btn-en").getAttribute("aria-checked"), "true");
  assert.strictEqual(await page.locator("#language-btn-es").getAttribute("aria-checked"), "false");
  assert.match(await page.locator(".wizard-header h2").innerText(), /3 steps/, "wizard heading is English");
  assert.strictEqual(await page.evaluate(() => localStorage.getItem("ludus.language")), "en", "the choice is stored");
  await page.locator("#language-btn-es").click();
  await page.waitForFunction(() => document.documentElement.lang === "es");
  assert.match(await page.locator(".wizard-header h2").innerText(), /3 pasos/, "wizard heading is Spanish again");

  // ----- Back to the start -----
  step("back button returns to the home hub (the landing page only stands in when home failed to mount)");
  await page.locator("#source-back-btn").click();
  await page.locator("#screen-home").waitFor({ state: "visible" });
  assert.strictEqual(await page.evaluate(() => Ludus.router.current()), "home");

  // ----- Layout sanity -----
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `no horizontal scroll (overflow ${overflow}px)`);

  // ----- Service worker precache (desktop run only) -----
  if (viewport.checkServiceWorker) {
    step("service worker installs and precaches exactly what sw.js lists");
    const cacheReport = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const source = await (await fetch("sw.js", { cache: "no-store" })).text();
      const listed = [...(source.match(/const CORE_ASSETS = \[([\s\S]*?)\];/) || ["", ""])[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      const names = (await caches.keys()).filter((name) => name.startsWith("ludus-scaccorum-static-"));
      const cache = await caches.open(names[0]);
      const cachedPaths = (await cache.keys()).map((request) => new URL(request.url).pathname + new URL(request.url).search);
      return { names, listed, cachedCount: cachedPaths.length, cachedPaths, version: Ludus.version };
    });
    assert.deepStrictEqual(cacheReport.names, [`ludus-scaccorum-static-${cacheReport.version}`], "one cache, named after the build version");
    assert.ok(cacheReport.listed.length >= 40, "CORE_ASSETS lists the app files");
    assert.ok(cacheReport.cachedCount >= cacheReport.listed.length, "every listed asset is in the cache");
    assert.ok(cacheReport.cachedPaths.some((p) => p.includes("/js/chess.js?v=")), "js/chess.js is precached with its version");
    // (The engine may well be in the cache by now: the wizard starts loading it and the
    // service worker stores whatever is fetched. What matters is that it is not in the list.)
    assert.ok(!cacheReport.listed.some((p) => p.includes("stockfish") || p.includes("vendor/")), "the engine is not in the precache list");
    assert.ok(!cacheReport.listed.some((p) => p.includes("js/data/")), "lazily loaded data is not in the precache list");
  }

  // Give any late request a moment to fail, then report everything at once.
  await page.waitForTimeout(500);
  await context.close();
  assert.deepStrictEqual(problems, [], `console/page/network problems:\n  ${problems.join("\n  ")}`);
  console.log(`[${viewport.name}] ok`);
}

async function main() {
  const browser = await launchBrowser();
  try {
    for (const viewport of VIEWPORTS) {
      await runViewport(browser, viewport);
    }
  } finally {
    await browser.close();
  }
  console.log("\nsmoke.js passed");
}

main().catch((error) => {
  console.error("\nsmoke.js FAILED");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
