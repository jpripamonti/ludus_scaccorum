// Browser check of the Content-Security-Policy in index.html (SEC-013): walks every
// screen in both languages, opens the dialogs, plays a classic round with the real
// engine, changes settings, and fails on the first `securitypolicyviolation`. It is
// the guard that lets the policy stay tight: a script, stylesheet, image, font,
// worker or connection that the policy does not allow shows up here, not in
// production. With LUDUS_CSP_VARIANT it re-runs the same walk under a policy with
// one allowance removed, which is how an allowance is shown to be needed or not
// (docs/ARCHITECTURE.md section 16 records the results).
//
// Serves the deployable files itself (scripts/dev/serve.js); Google is unreachable
// on purpose (every https request is aborted), the walk never signs in.
//
//   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/csp.js
//   LUDUS_CSP_VARIANT=noUnsafeInlineStyle node scripts/e2e/csp.js    # expected to fail if it is needed
//
// Environment: LUDUS_CSP_PORT (default 5116), LUDUS_CHROMIUM, LUDUS_CSP_VARIANT
// (baseline | noUnsafeInlineStyle | noWasmUnsafeEval | noDataImg | noGoogleFrame |
// noGoogleImg | noWorkerSrc | styleAttrOnly). Exits 0 when nothing was blocked.

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright is not installed. Run with NODE_PATH=/opt/node22/lib/node_modules.");
  process.exit(2);
}
const { createServer } = require("../dev/serve.js");

const PORT = Number(process.env.LUDUS_CSP_PORT) || 5116;
const BASE = `http://localhost:${PORT}/`;
const FALLBACK_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const VARIANT = process.env.LUDUS_CSP_VARIANT || "baseline";
const VARIANTS = {
  baseline: (csp) => csp,
  noUnsafeInlineStyle: (csp) => csp.replace(" 'unsafe-inline'", ""),
  noWasmUnsafeEval: (csp) => csp.replace(" 'wasm-unsafe-eval'", ""),
  noDataImg: (csp) => csp.replace("img-src 'self' data:", "img-src 'self'"),
  noGoogleFrame: (csp) => csp.replace("frame-src https://accounts.google.com; ", ""),
  noGoogleImg: (csp) => csp.replace(" https://*.googleusercontent.com", ""),
  noWorkerSrc: (csp) => csp.replace("worker-src 'self'; ", ""),
  styleAttrOnly: (csp) => csp.replace(/style-src 'self' 'unsafe-inline'( https:\/\/accounts\.google\.com\/gsi\/style)?/, (_, google) => `style-src-elem 'self'${google || ""}; style-src-attr 'unsafe-inline'`),
};
assert.ok(VARIANTS[VARIANT], `unknown variant ${VARIANT}`);

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

const step = (message) => console.log(`  - ${message}`);

(async () => {
  const server = createServer(path.resolve(__dirname, "..", ".."));
  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  const browser = await launch();
  const problems = [];
  try {
    for (const language of ["es", "en"]) {
      console.log(`\n[${language}] policy variant: ${VARIANT}`);
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: language === "es" ? "es-AR" : "en-US", serviceWorkers: "block" });
      await context.route("https://**/*", (route) => route.abort());
      await context.route(/localhost:\d+\/(index\.html)?(\?.*)?$/, async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        const match = body.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/);
        await route.fulfill({ response, body: match ? body.replace(match[1], VARIANTS[VARIANT](match[1])) : body });
      });
      const page = await context.newPage();
      const violations = [];
      page.on("pageerror", (error) => problems.push(`[${language}] page error: ${error.message}`));
      await page.addInitScript(() => {
        window.__csp = [];
        document.addEventListener("securitypolicyviolation", (event) => {
          window.__csp.push(`${event.violatedDirective} blocked ${event.blockedURI || "inline"} ${(event.sample || "").slice(0, 60)} (${(event.sourceFile || "").split("/").pop()}:${event.lineNumber})`);
        });
        try { localStorage.setItem("ludus.seen.v1", "1"); } catch (error) { /* ignore */ }
      });
      await page.goto(BASE, { waitUntil: "load" });
      await page.waitForFunction(() => window.Ludus && Ludus.game && Ludus.router && Ludus.router.current(), null, { timeout: 30000 });

      step("every screen and the landing");
      for (const hash of ["#/home", "#/classics", "#/notebook", "#/progress", "#/museum", "#/settings", "#/account", "#/home"]) {
        await page.evaluate((target) => { location.hash = target; }, hash);
        await page.waitForTimeout(400);
      }
      await page.evaluate(() => { location.hash = "#/classics"; });
      await page.waitForFunction(() => Ludus.Classics && Ludus.Classics.list().length > 0 || Ludus.Classics.load().then(() => true), null, { timeout: 15000 });
      const firstGame = await page.evaluate(() => Ludus.Classics.list()[0].id);
      await page.evaluate((id) => { location.hash = `#/classics/${id}`; }, firstGame);
      await page.waitForTimeout(800);

      step("settings: a theme, a toggle, the language switch");
      await page.evaluate(() => { location.hash = "#/settings"; });
      await page.waitForTimeout(500);
      await page.evaluate(() => { Ludus.Settings.set("board.theme", "walnut"); Ludus.Settings.set("a11y.highContrast", true); Ludus.Settings.set("a11y.highContrast", false); });
      await page.evaluate(() => { location.hash = "#/account"; });
      await page.waitForTimeout(500);

      step("a classic round with the real engine, its result, the summary and the wizard");
      await page.evaluate(async () => {
        await Ludus.Classics.load();
        Ludus.game.startSession({ kind: "classic", title: "csp", mode: "solo", positions: Ludus.Classics.random(2, {}) });
      });
      await page.waitForTimeout(2500);
      await page.locator("#skip-btn").click({ timeout: 10000 }).catch(() => {});
      await page.waitForFunction(() => ["result", "summary"].includes(document.querySelector("#game-layout").dataset.phase), null, { timeout: 40000 }).catch(() => {});
      await page.waitForTimeout(800);
      await page.evaluate(async () => { await Ludus.game.analyzePosition("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", { multiPv: 1, movetimeMs: 300 }); }).catch(() => {});
      const strong = await page.evaluate(() => !Ludus.game.isUsingFallbackEngine());
      if (!strong) problems.push(`[${language}] the strong engine did not start`);
      await page.evaluate(() => Ludus.game.abort());
      await page.evaluate(() => Ludus.game.openOwnGamesSetup({ mode: "duel" }));
      await page.waitForTimeout(600);
      await page.evaluate(() => Ludus.game.abort());
      await page.waitForTimeout(300);

      step("language switch");
      await page.locator(language === "es" ? "#language-btn-en" : "#language-btn-es").click().catch(() => {});
      await page.waitForTimeout(500);

      const seen = await page.evaluate(() => window.__csp);
      seen.forEach((entry) => violations.push(entry));
      if (violations.length) problems.push(`[${language}] ${violations.length} CSP violation(s): ${violations.slice(0, 6).join(" | ")}`);
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (problems.length) {
    console.error(`\nCSP check (${VARIANT}) found problems:\n - ${problems.join("\n - ")}`);
    process.exit(1);
  }
  console.log(`\ncsp e2e (${VARIANT}): no policy violation on any screen, the dialogs or a classic round`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
