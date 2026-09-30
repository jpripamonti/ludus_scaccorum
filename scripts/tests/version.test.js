// Tests for scripts/generate-version.js (the content hash and what it stamps) and
// for the coherence checks of scripts/smoke-check.js (sw.js, the hash, the CSP and
// the deploy copy list must agree). Everything runs on a temporary COPY of the
// deployable tree: the repository is never touched.
//
// SEC-001 / PERF-006: the hash covers index.html (minus its own stamps), manifest.json,
// assets/, vendor/ and sw.js, so an engine swap, an asset-only deploy or a CSP-only
// change is a new version.
// PERF-002: the engine has its own checksum-keyed cache name.
// Plain assert, no framework, deterministic.

"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repo = path.resolve(__dirname, "..", "..");
const TREE = ["index.html", "app.js", "styles.css", "config.js", "sw.js", "manifest.json", "LICENSE", "THIRD_PARTY_NOTICES.md", "js", "css", "assets", "vendor", ".github"];
const SCRIPTS = ["generate-version.js", "smoke-check.js"];

let assertions = 0;
const ok = (value, message) => { assertions += 1; assert.ok(value, message); };
const eq = (actual, expected, message) => { assertions += 1; assert.strictEqual(actual, expected, message); };
const same = (actual, expected, message) => { assertions += 1; assert.deepStrictEqual(actual, expected, message); };

function copyTree(target) {
  fs.mkdirSync(path.join(target, "scripts"), { recursive: true });
  for (const entry of TREE) fs.cpSync(path.join(repo, entry), path.join(target, entry), { recursive: true });
  for (const script of SCRIPTS) fs.copyFileSync(path.join(repo, "scripts", script), path.join(target, "scripts", script));
}

const read = (dir, rel) => fs.readFileSync(path.join(dir, rel));
const write = (dir, rel, data) => fs.writeFileSync(path.join(dir, rel), data);

function run(dir, script) {
  const result = spawnSync(process.execPath, [path.join(dir, "scripts", script)], { cwd: dir, encoding: "utf8", timeout: 120000 });
  return { status: result.status, out: `${result.stdout || ""}${result.stderr || ""}` };
}

// Regenerates in `dir` and returns what was stamped.
function generate(dir) {
  const result = run(dir, "generate-version.js");
  assert.strictEqual(result.status, 0, `generate-version failed: ${result.out}`);
  const sw = read(dir, "sw.js").toString("utf8");
  return {
    hash: (result.out.match(/content hash ([a-f0-9]{12})/) || [])[1],
    engine: (sw.match(/const ENGINE_CACHE = "ludus-scaccorum-engine-([a-f0-9]{12})"/) || [])[1],
    sw,
    html: read(dir, "index.html").toString("utf8"),
    out: result.out,
  };
}

// The failures of the smoke check that are about version / service worker / workflow coherence.
function coherenceFailures(dir) {
  const result = run(dir, "smoke-check.js");
  return result.out.split("\n").filter((line) => /^smoke-check failed:/.test(line) && /sw\.js|CACHE_NAME|CORE_ASSETS|ENGINE|workflow|deploy-pages|Permissions-Policy|content hash|ludus-version|SHA256SUMS/.test(line));
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ludus-version-"));
const base = path.join(tmp, "base");
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("generating is idempotent and the result is coherent (sw.js, index.html, the workflow)", async () => {
  copyTree(base);
  const first = generate(base);
  ok(/^[a-f0-9]{12}$/.test(first.hash), "a 12 hex digit content hash");
  ok(/^[a-f0-9]{12}$/.test(first.engine), "and an engine id");
  ok(first.html.includes(`<meta name="ludus-version" content="${first.hash}"`));
  ok(first.sw.includes(`const CACHE_NAME = "ludus-scaccorum-static-${first.hash}";`));
  const swBefore = read(base, "sw.js");
  const htmlBefore = read(base, "index.html");
  const second = generate(base);
  eq(second.hash, first.hash, "same hash the second time");
  ok(read(base, "sw.js").equals(swBefore) && read(base, "index.html").equals(htmlBefore), "and not a byte changes");
  same(coherenceFailures(base), [], "nothing the coherence checks care about is reported");
});

test("what sw.js is stamped with: versioned precache (lazy data included), no engine in it, the engine by SHA-256", async () => {
  const { hash, engine, sw } = generate(base);
  const core = (sw.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)[1].match(/"([^"]*)"/g) || []).map((entry) => entry.slice(1, -1));
  ok(core.includes("./") && core.includes("./index.html"));
  ok(core.includes(`./js/data/classics.data.js?v=${hash}`), "the Classics library is precached (offline from the first visit)");
  ok(core.some((entry) => entry === `./app.js?v=${hash}`), "app.js is versioned");
  ok(!core.some((entry) => entry.startsWith("./vendor/")), "the 7.3 MB engine is not precached");
  const files = {};
  for (const m of sw.match(/const ENGINE_FILES = \{([\s\S]*?)\};/)[1].matchAll(/"([^"]+)":\s*"([a-f0-9]{64})"/g)) files[m[1]] = m[2];
  ok(Object.keys(files).length >= 2, "at least the engine script and the wasm");
  for (const [rel, digest] of Object.entries(files)) {
    eq(crypto.createHash("sha256").update(read(base, rel)).digest("hex"), digest, `${rel}: the pinned SHA-256 is the file's`);
    ok(/\.(js|wasm)$/.test(rel), "only executable engine files are pinned");
  }
  eq(engine.length, 12);
});

test("the hash covers everything the app loads: a change to any of these is a new version", async () => {
  const baseline = generate(base);
  const cases = [
    ["index.html markup", "index.html", (text) => text.replace("</head>", "<!-- a change --></head>"), false],
    ["the CSP meta tag only", "index.html", (text) => text.replace("object-src 'none'", "object-src 'self'"), false],
    ["manifest.json", "manifest.json", (text) => text.replace('"display": "standalone"', '"display": "fullscreen"'), false],
    ["an asset (the logo)", "assets/brand/logo.svg", (text) => `${text}\n<!-- x -->`, false],
    ["app.js", "app.js", (text) => `${text}\n// x`, false],
    ["a stylesheet", "css/system.css", (text) => `${text}\n/* x */`, false],
    ["a script", "js/pgn.js", (text) => `${text}\n// x`, false],
    ["sw.js itself (logic, not the generated constants)", "sw.js", (text) => `${text}\n// a change in the worker's logic`, false],
    ["the engine script", "vendor/stockfish-18-lite-single.js", (buffer) => Buffer.concat([buffer, Buffer.from("\n//x")]), true],
    ["the engine wasm", "vendor/stockfish-18-lite-single.wasm", (buffer) => { const copy = Buffer.from(buffer); copy[copy.length - 1] ^= 0xff; return copy; }, true],
  ];
  for (const [label, rel, mutate, engineToo] of cases) {
    const original = read(base, rel);
    write(base, rel, engineToo ? mutate(original) : mutate(original.toString("utf8"))); // the engine files are binary
    const changed = generate(base);
    ok(changed.hash !== baseline.hash, `${label}: a new content hash`);
    eq(changed.engine !== baseline.engine, engineToo, `${label}: ${engineToo ? "a new" : "the same"} engine cache name`);
    write(base, rel, original);
    const restored = generate(base);
    eq(restored.hash, baseline.hash, `${label}: undoing the change gives the old hash back`);
    eq(restored.engine, baseline.engine);
  }
});

test("documentation, stamps and timestamps do not change the hash", async () => {
  const baseline = generate(base);
  const untouched = [
    ["vendor/PROVENANCE.md", (text) => `${text}\nnote`],
    ["vendor/SHA256SUMS", (text) => `${text}\n`],
    ["assets/fonts/OFL-Inter.txt", (text) => `${text}\nnote`],
  ];
  for (const [rel, mutate] of untouched) {
    const original = read(base, rel);
    write(base, rel, mutate(original.toString("utf8")));
    eq(generate(base).hash, baseline.hash, `${rel} is documentation`);
    write(base, rel, original);
  }
  // Stale or corrupt stamps are simply rewritten: the hash never depends on them.
  const sw = read(base, "sw.js").toString("utf8");
  const html = read(base, "index.html").toString("utf8");
  write(base, "sw.js", sw.replace(/static-[a-f0-9]{12}/, "static-000000000000").replace(/engine-[a-f0-9]{12}/, "engine-000000000000").replace(/\?v=[a-f0-9]{12}/g, "?v=000000000000"));
  write(base, "index.html", html.replace(/\?v=[a-f0-9]{12}/g, "?v=000000000000").replace(/(name="ludus-version" content=")[a-f0-9]{12}/, "$1000000000000"));
  const again = generate(base);
  eq(again.hash, baseline.hash, "corrupt stamps do not feed back into the hash");
  eq(again.sw, baseline.sw, "and sw.js is restored to the same bytes");
  eq(again.html, baseline.html, "and so is index.html");
  // The same content with other modification times is the same version.
  const old = new Date(Date.UTC(2000, 0, 1));
  for (const rel of ["app.js", "styles.css", "vendor/stockfish-18-lite-single.wasm", "assets/brand/logo.svg", "index.html"]) fs.utimesSync(path.join(base, rel), old, old);
  eq(generate(base).hash, baseline.hash, "mtimes do not matter");
});

test("the engine cache name follows the engine and nothing else", async () => {
  const baseline = generate(base);
  const rel = "js/pgn.js";
  const original = read(base, rel);
  write(base, rel, `${original.toString("utf8")}\n// app change`);
  const appChange = generate(base);
  ok(appChange.hash !== baseline.hash);
  eq(appChange.engine, baseline.engine, "an app-only deploy keeps the engine cache (7.3 MB not downloaded again)");
  write(base, rel, original);
  generate(base);
});

test("the smoke check reports every incoherence the QA findings describe, and nothing on the coherent tree", async () => {
  same(coherenceFailures(base), [], "the baseline is clean");
  const bad = path.join(tmp, "bad");
  fs.cpSync(base, bad, { recursive: true });

  // (a) the engine changed but sw.js was not regenerated (SEC-001: a stale engine pinned for ever).
  const wasm = read(bad, "vendor/stockfish-18-lite-single.wasm");
  const flipped = Buffer.from(wasm);
  flipped[flipped.length - 1] ^= 0xff;
  write(bad, "vendor/stockfish-18-lite-single.wasm", flipped);
  // (b) index.html got a Permissions-Policy <meta> back (ineffective, SEC-012).
  write(bad, "index.html", read(bad, "index.html").toString("utf8").replace("</head>", '<meta http-equiv="Permissions-Policy" content="camera=()" /></head>'));
  // (c) the service worker takes over a running page by itself (PERF-010) and deletes every cache (SEC-010 / PERF-008).
  let sw = read(bad, "sw.js").toString("utf8");
  sw = sw.replace('event.waitUntil(precache());', "event.waitUntil(precache().then(() => self.skipWaiting()));");
  sw = sw.replace(".filter((key) => (key.startsWith(STATIC_PREFIX) && key !== CACHE_NAME) || (key.startsWith(ENGINE_PREFIX) && key !== ENGINE_CACHE))", "");
  write(bad, "sw.js", sw);
  // (d) the deploy workflow forgets the engine directory and grants the Pages token to every job (SEC-019).
  let workflow = read(bad, ".github/workflows/deploy-pages.yml").toString("utf8");
  workflow = workflow.replace(/^.*rsync -av --delete vendor\/ _site\/vendor\/\n/m, "");
  workflow = workflow.replace(/^permissions:\n  contents: read\n/m, "permissions:\n  contents: read\n  pages: write\n  id-token: write\n");
  write(bad, ".github/workflows/deploy-pages.yml", workflow);

  const failures = coherenceFailures(bad).join("\n");
  ok(/ENGINE_CACHE|ENGINE_FILES|content hash|CACHE_NAME/.test(failures), "(a) a changed engine without regenerating is caught");
  ok(/Permissions-Policy/.test(failures), "(b) the ineffective Permissions-Policy meta is caught");
  ok(/skipWaiting/.test(failures), "(c) an automatic skipWaiting is caught");
  ok(/activate must delete only caches/.test(failures), "(c) deleting every cache is caught");
  ok(/does not copy "vendor"/.test(failures), "(d) a workflow that forgets vendor/ is caught");
  ok(/grant pages\/id-token write to every job/.test(failures), "(d) workflow-wide Pages permissions are caught");
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
  console.log(`version.test.js: ${done} tests, ${assertions} assertions passed`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
