const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");

function fail(message) {
  console.error(`smoke-check failed: ${message}`);
  process.exitCode = 1;
}

function assertFile(file) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    fail(`missing required file: ${file}`);
  }
}

function assertDirectory(dir) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    fail(`missing required directory: ${dir}`);
  }
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
}

// Every file with the given extension under `dir` (posix paths, sorted).
function listFiles(dir, extension) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  const found = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...listFiles(rel, extension));
    else if (entry.isFile() && rel.endsWith(extension)) found.push(rel);
  }
  return found.sort();
}

const LOGIC_MODULES = [
  "js/ludus.js",
  "js/chess.js",
  "js/pgn.js",
  "js/engine.js",
  "js/scoring.js",
  "js/insights.js",
  "js/concepts.js",
  "js/settings.js",
  "js/profile.js",
  "js/facts.js",
  "js/reader.js",
  "js/audio.js",
  "js/auth.js",
  "js/classics.js",
];
const SCREEN_NAMES = ["home", "classics", "notebook", "progress", "museum", "settings", "account"];
const UI_SUPPORT_NAMES = ["kit", "shell", "board", "coach"];
const SCREEN_MODULES = [...UI_SUPPORT_NAMES, ...SCREEN_NAMES].map((name) => `js/ui/${name}.js`);
const CSS_FILES = ["css/system.css", "css/shell.css", "css/board.css", "css/coach.css", ...SCREEN_NAMES.map((name) => `css/${name}.css`)];

[
  "index.html",
  "styles.css",
  "app.js",
  "config.js",
  "sw.js",
  "manifest.json",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/landing/maestro.jpg",
  "assets/landing/maestro.webp",
  "vendor/stockfish-18-lite-single.js",
  "vendor/stockfish-18-lite-single.wasm",
  "vendor/SHA256SUMS",
  ...LOGIC_MODULES,
  ...SCREEN_MODULES,
  ...CSS_FILES,
].forEach(assertFile);
assertDirectory("js/data");

[
  "bB.svg",
  "bK.svg",
  "bN.svg",
  "bP.svg",
  "bQ.svg",
  "bR.svg",
  "wB.svg",
  "wK.svg",
  "wN.svg",
  "wP.svg",
  "wQ.svg",
  "wR.svg",
].forEach((piece) => assertFile(`assets/pieces/cburnett/${piece}`));

// Every JavaScript file the site ships must at least parse.
const jsFiles = ["app.js", "sw.js", "config.js", ...listFiles("js", ".js")];
for (const file of jsFiles) {
  if (!fs.existsSync(path.join(root, file))) continue;
  try {
    execFileSync(process.execPath, ["--check", path.join(root, file)], { stdio: "pipe" });
  } catch (error) {
    fail(`${file} syntax check failed\n${error.stderr || error.message}`);
  }
}

const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

// url(...) references in every stylesheet resolve, relative to that stylesheet.
const cssFiles = ["styles.css", ...listFiles("css", ".css")];
let allCss = "";
for (const cssFile of cssFiles) {
  if (!fs.existsSync(path.join(root, cssFile))) continue;
  const source = fs.readFileSync(path.join(root, cssFile), "utf8");
  allCss += `\n${source}`;
  for (const match of source.matchAll(/url\(([^)]+)\)/g)) {
    const raw = match[1].trim().replace(/^['"]|['"]$/g, "");
    if (!raw || raw.startsWith("data:") || /^https?:\/\//.test(raw)) continue;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(cssFile), raw.split(/[?#]/)[0]));
    assertFile(target);
  }
}

if (/fonts\.(googleapis|gstatic)\.com/i.test(html + css + allCss)) {
  fail("external Google Fonts reference detected");
}

for (const match of sw.matchAll(/["']\.\/([^"']+)["']/g)) {
  const asset = match[1];
  if (!asset || asset === "") continue;
  if (asset === "index.html") {
    assertFile(asset);
    continue;
  }
  assertFile(asset.split(/[?#]/)[0]);
}

const sums = fs.readFileSync(path.join(root, "vendor/SHA256SUMS"), "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

for (const line of sums) {
  const match = line.match(/^([a-f0-9]{64})\s+(.+)$/i);
  if (!match) {
    fail(`invalid checksum line: ${line}`);
    continue;
  }
  const [, expected, file] = match;
  assertFile(file);
  const actual = sha256(file);
  if (actual !== expected.toLowerCase()) {
    fail(`checksum mismatch for ${file}: expected ${expected}, got ${actual}`);
  }
}

// ---------------------------------------------------------------------------
// index.html structure: everything it references exists, the script order is
// the one docs/ARCHITECTURE.md promises, and no module file is left unloaded.
// ---------------------------------------------------------------------------

const { localAssetTags } = require("./generate-version.js");

function checkIndexReferences() {
  // Every local src/href (scripts, stylesheets, icons, manifest, images).
  for (const match of html.matchAll(/\s(?:src|href)\s*=\s*"([^"]*)"/gi)) {
    const url = match[1];
    if (!url || url.startsWith("#") || /^([a-z][a-z0-9+.-]*:)?\/\//i.test(url) || /^[a-z][a-z0-9+.-]*:/i.test(url)) continue;
    const target = url.split(/[?#]/)[0].replace(/^\.\//, "");
    if (target) assertFile(target);
  }

  const scripts = localAssetTags(html).filter((item) => item.attr === "src").map((item) => item.path);
  const head = ["config.js", "js/ludus.js", "js/chess.js", "js/pgn.js"];
  head.forEach((file, i) => {
    if (scripts[i] !== file) fail(`index.html script #${i + 1} must be ${file} (found ${scripts[i] || "nothing"})`);
  });
  if (scripts[scripts.length - 1] !== "app.js") fail("index.html must load app.js last");
  const firstScreen = scripts.findIndex((file) => file.startsWith("js/ui/"));
  const lastLogic = Math.max(...scripts.map((file, i) => (file.startsWith("js/") && !file.startsWith("js/ui/") ? i : -1)));
  if (firstScreen !== -1 && lastLogic > firstScreen) fail("index.html must load js/ui/*.js after the logic modules in js/*.js");
  if (new Set(scripts).size !== scripts.length) fail("index.html loads the same script twice");

  // js/data/* is fetched lazily; every other file under js/ must be loaded by index.html.
  for (const file of listFiles("js", ".js")) {
    if (file.startsWith("js/data/")) continue;
    if (!scripts.includes(file)) fail(`${file} exists but index.html has no <script> for it`);
  }
  // The same for stylesheets.
  const sheets = localAssetTags(html).filter((item) => item.attr === "href").map((item) => item.path);
  for (const file of listFiles("css", ".css")) {
    if (!sheets.includes(file)) fail(`${file} exists but index.html has no <link rel="stylesheet"> for it`);
  }
}

checkIndexReferences();

// ---------------------------------------------------------------------------
// Content Security Policy: it may allow Google Identity (sign-in is optional)
// and nothing else beyond what the app has always needed.
// ---------------------------------------------------------------------------

function checkContentSecurityPolicy() {
  const match = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i);
  if (!match) {
    fail("index.html has no Content-Security-Policy meta tag");
    return;
  }
  const directives = {};
  for (const part of match[1].split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) directives[name] = values;
  }
  const allowed = {
    "script-src": ["'self'", "'wasm-unsafe-eval'", "https://accounts.google.com/gsi/client"],
    "connect-src": [
      "'self'",
      "https://lichess.org",
      "https://api.chess.com",
      "https://accounts.google.com",
      "https://oauth2.googleapis.com",
      "https://www.googleapis.com",
    ],
    "frame-src": ["https://accounts.google.com"],
    "img-src": ["'self'", "data:", "https://*.googleusercontent.com"],
    "style-src": ["'self'", "'unsafe-inline'", "https://accounts.google.com/gsi/style"],
    "font-src": ["'self'"],
    "worker-src": ["'self'"],
    "default-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": ["'none'"],
  };
  for (const [name, values] of Object.entries(directives)) {
    if (!allowed[name]) {
      fail(`CSP has an unexpected directive: ${name}`);
      continue;
    }
    for (const value of values) {
      if (!allowed[name].includes(value)) fail(`CSP ${name} allows an unexpected source: ${value}`);
    }
  }
  Object.keys(allowed).forEach((name) => {
    if (!directives[name]) fail(`CSP is missing the ${name} directive`);
  });
}

checkContentSecurityPolicy();

// index.html's ?v= query strings, <meta name="ludus-version">, sw.js's
// CACHE_NAME and its CORE_ASSETS list must all agree with the current content
// hash (see scripts/generate-version.js). If someone edits any shipped file
// without re-running that script, this catches it instead of silently
// shipping a mismatched combination to installed clients.
function checkVersionCoherence() {
  const gv = require("./generate-version.js");
  let info;
  try {
    info = gv.computeVersionInfo();
  } catch (error) {
    fail(`version-coherence check could not run: ${error.message}`);
    return;
  }
  const rerun = "run node scripts/generate-version.js";

  const staleTags = gv.localAssetTags(html).filter((item) => {
    const found = (item.url.match(/\?v=([^&#]*)/) || [])[1];
    return found !== info.versionHash;
  });
  if (staleTags.length) {
    const shown = staleTags.slice(0, 3).map((item) => item.path).join(", ");
    fail(
      `index.html: ${staleTags.length} script/stylesheet tag(s) (${shown}${staleTags.length > 3 ? ", ..." : ""}) ` +
      `do not carry ?v=${info.versionHash}, the current content hash; ${rerun}`,
    );
  }

  const metaVersion = gv.ludusVersionMeta(html);
  if (metaVersion !== info.versionHash) {
    fail(
      `index.html <meta name="ludus-version"> (${metaVersion || "missing"}) does not match ` +
      `the current content hash (${info.versionHash}); ${rerun}`,
    );
  }

  const cacheNameMatch = sw.match(/const CACHE_NAME = "([^"]*)";/);
  if (!cacheNameMatch || cacheNameMatch[1] !== info.cacheName) {
    fail(
      `sw.js CACHE_NAME (${cacheNameMatch ? cacheNameMatch[1] : "missing"}) does not match ` +
      `the current content hash (${info.cacheName}); ${rerun}`,
    );
  }

  const raw = info.rawAssets;
  const expected = info.versionedAssets;
  for (const entry of expected) {
    if (!raw.includes(entry)) fail(`sw.js CORE_ASSETS is missing or has a stale entry for ${entry}; ${rerun}`);
  }
  for (const entry of raw) {
    if (!expected.includes(entry)) fail(`sw.js CORE_ASSETS has an unexpected entry ${entry}; ${rerun}`);
    if (/^\.\/(vendor\/|js\/data\/)/.test(entry)) {
      fail(`sw.js CORE_ASSETS must not precache ${entry} (loaded lazily, cached at runtime)`);
    }
  }
  if (raw.length === expected.length && raw.some((entry, i) => entry !== expected[i])) {
    fail(`sw.js CORE_ASSETS is in a different order than generate-version.js writes it; ${rerun}`);
  }
}

checkVersionCoherence();

// Every literal getElementById("...") string in app.js and js/**/*.js should
// name an id that exists: in index.html, or declared by the code that builds
// the element (id: "x" / id="x" / setAttribute("id", "x")). That catches a
// renamed/removed id in the markup or a typo in the script, without forcing
// screens that render their own DOM to add placeholders to index.html.
// This is a static string check, not a DOM parse, so a computed id (a
// template literal, say) is skipped rather than flagged.
function checkIdContract() {
  const knownIds = new Set();
  for (const match of html.matchAll(/\bid=["']([^"']+)["']/g)) {
    knownIds.add(match[1]);
  }

  const sources = ["app.js", ...listFiles("js", ".js").filter((file) => !file.startsWith("js/data/"))];
  const contents = new Map(sources.map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")]));

  for (const source of contents.values()) {
    for (const match of source.matchAll(/\bid\s*[:=]\s*\\?["']([A-Za-z][\w:.-]*)\\?["']/g)) knownIds.add(match[1]);
    for (const match of source.matchAll(/setAttribute\(\s*["']id["']\s*,\s*["']([^"']+)["']\s*\)/g)) knownIds.add(match[1]);
    for (const match of source.matchAll(/\bid=\\?["']([A-Za-z][\w:.-]*)\\?["']/g)) knownIds.add(match[1]);
  }

  for (const [file, source] of contents) {
    for (const match of source.matchAll(/getElementById\(\s*["']([^"']+)["']\s*\)/g)) {
      if (!knownIds.has(match[1])) {
        fail(`${file} calls getElementById("${match[1]}") but neither index.html nor any script declares an element with that id`);
      }
    }
  }
}

checkIdContract();

// The deploy workflow copies an explicit list of files into the Pages
// artifact. Anything index.html (or the service worker registration) needs
// but the workflow forgets to copy would 404 in production only, so check it
// here: every top-level file/directory referenced must appear in a cp/rsync.
function checkDeployWorkflow() {
  const workflowFile = ".github/workflows/deploy-pages.yml";
  if (!fs.existsSync(path.join(root, workflowFile))) {
    fail(`missing ${workflowFile}`);
    return;
  }
  const workflow = fs.readFileSync(path.join(root, workflowFile), "utf8");
  const copied = new Set();
  for (const line of workflow.split(/\r?\n/)) {
    if (!/^\s*(cp|rsync)\s/.test(line)) continue;
    for (const token of line.trim().split(/\s+/).slice(1)) {
      if (token.startsWith("-")) continue;
      copied.add(token.replace(/^\.\//, "").replace(/\/+$/, ""));
    }
  }

  // What the page (and app.js, for the service worker and the engine) needs.
  const needed = new Set(["index.html", "app.js", "styles.css", "config.js", "sw.js", "manifest.json", "assets", "vendor", "js", "css"]);
  for (const match of html.matchAll(/\s(?:src|href)\s*=\s*"([^"]*)"/gi)) {
    const url = match[1];
    if (!url || url.startsWith("#") || /^([a-z][a-z0-9+.-]*:)?\/\//i.test(url) || /^[a-z][a-z0-9+.-]*:/i.test(url)) continue;
    const top = url.split(/[?#]/)[0].replace(/^\.\//, "").split("/")[0];
    if (top) needed.add(top);
  }
  for (const name of needed) {
    if (!copied.has(name)) {
      fail(`${workflowFile} does not copy "${name}" into the Pages artifact (it is needed at runtime)`);
    }
  }
}

checkDeployWorkflow();

if (process.exitCode) process.exit(process.exitCode);
console.log("smoke-check passed");
