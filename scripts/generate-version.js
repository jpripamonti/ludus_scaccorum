// Derives one content hash from EVERYTHING the deployed app loads and stamps it
// into the files that have to agree about it:
//
//   hashed: app.js, styles.css, config.js, manifest.json, everything under js/,
//           css/, assets/ and vendor/ (documentation inside them - *.md, *.txt,
//           SHA256SUMS - does not count), index.html with its own stamps
//           normalised away, sw.js with its generated constants normalised away,
//           and the precache list. A change to any of them, the CSP meta tag and
//           the engine included, is a new version.
//   stamped into:
//     - index.html: the ?v= query of every local <script src> and stylesheet
//       <link>, and <meta name="ludus-version"> (read at runtime as Ludus.version,
//       which js/ludus.js appends to lazily loaded scripts);
//     - sw.js: CACHE_NAME, CORE_ASSETS and the engine block (ENGINE_CACHE,
//       ENGINE_FILES).
//
// This replaces the hand-bumped "?v=maestroNNN" scheme: a content change now
// changes the hash automatically, so it is no longer possible to ship an
// index.html/sw.js combination that disagrees about which files they point at.
// See scripts/smoke-check.js for the check that fails the build on drift.
//
// The precache list is derived, not hand-edited: every local script and
// stylesheet that index.html loads and every lazily loaded data script
// (js/data/*.js, the Classics library) is precached (versioned); the static
// entries already in sw.js (icons, images, manifest, "./", "./index.html") are
// kept as they are. The engine (vendor/, 7.3 MB, only needed once somebody
// plays) is deliberately NOT precached: the service worker stores it the first
// time it is used, in its OWN cache named after the SHA-256 of the engine files
// (ENGINE_CACHE), which survives deploys that do not touch the engine, and only
// serves bytes whose SHA-256 is listed in ENGINE_FILES.
//
// Usage: node scripts/generate-version.js  (rewrites index.html and sw.js;
// running it again changes nothing)
// `computeVersionInfo()` and the pure helpers below are also required by
// smoke-check.js to verify the checked-in files without rewriting anything.

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const HASH_LENGTH = 12;
const CACHE_PREFIX = "ludus-scaccorum-static-";
const ENGINE_CACHE_PREFIX = "ludus-scaccorum-engine-";
// Top-level files and directories whose content is part of the version
// (index.html and sw.js are hashed too, see normalizedIndexHtml / normalizedServiceWorker).
const HASHED_FILES = ["app.js", "styles.css", "config.js", "manifest.json"];
const HASHED_DIRS = ["js", "css", "assets", "vendor"];
// Files inside those directories that are documentation, not something the app
// loads: editing them must not make every installed copy download the app again.
const DOC_FILE = /(?:\.(?:md|txt)|(?:^|\/)SHA256SUMS)$/i;
// The engine: what sw.js serves from ENGINE_CACHE (workers and WebAssembly).
const ENGINE_DIR = "vendor";
const ENGINE_FILE = /\.(?:js|wasm)$/i;
// Lazily loaded data scripts (Ludus.util.loadScript): precached so they are
// there offline from the first visit and versioned with the app.
const LAZY_DATA_DIR = "js/data";

function readFile(rel) {
  return fs.readFileSync(path.join(root, rel));
}

function extractCoreAssets(swSource) {
  const match = swSource.match(/const CORE_ASSETS = \[([\s\S]*?)\];/);
  if (!match) throw new Error("could not find CORE_ASSETS array in sw.js");
  return [...match[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
}

// JS and CSS carry a cache-busting version query; every other precached asset
// (svgs, images, the manifest) is referenced by a stable path.
function isVersionedAsset(assetPath) {
  return /\.(?:js|css)(?:\?.*)?$/.test(assetPath);
}

function stripVersion(assetPath) {
  return assetPath.replace(/\?v=[^"]*$/, "");
}

function isRemote(url) {
  return /^([a-z][a-z0-9+.-]*:)?\/\//i.test(url) || /^[a-z][a-z0-9+.-]*:/i.test(url);
}

// Every non-hidden file under `dir`, recursively, as posix paths relative to
// the repo root. Hidden files (.gitkeep, .DS_Store) are ignored so that
// editor or OS litter cannot make two checkouts disagree about the hash.
function listFilesUnder(dir) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  const found = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...listFilesUnder(rel));
    else if (entry.isFile()) found.push(rel);
  }
  return found;
}

// The files whose content defines the version, sorted by path. index.html and
// sw.js are included by computeVersionInfo() through their normalised forms.
function hashedFiles() {
  const files = HASHED_FILES.filter((rel) => fs.existsSync(path.join(root, rel)));
  HASHED_DIRS.forEach((dir) => files.push(...listFilesUnder(dir).filter((rel) => !DOC_FILE.test(rel))));
  return files.sort();
}

// The engine files and their SHA-256, sorted by path: { "vendor/x.js": "<hex>" }.
function engineFiles() {
  const out = {};
  listFilesUnder(ENGINE_DIR)
    .filter((rel) => ENGINE_FILE.test(rel))
    .sort()
    .forEach((rel) => {
      out[rel] = crypto.createHash("sha256").update(readFile(rel)).digest("hex");
    });
  return out;
}

// Short id of the engine: same files, same id, whatever else was deployed.
function engineId(files) {
  const lines = Object.keys(files).sort().map((rel) => `${rel} ${files[rel]}\n`).join("");
  return crypto.createHash("sha256").update(lines).digest("hex").slice(0, HASH_LENGTH);
}

// The lazily loaded data scripts as canonical precache entries.
function lazyDataAssets() {
  return listFilesUnder(LAZY_DATA_DIR).filter((rel) => rel.endsWith(".js")).sort().map((rel) => `./${rel}`);
}

// ---- index.html helpers (pure: they take and return strings) ----

const SCRIPT_TAG = /<script\b[^>]*>/gi;
const LINK_TAG = /<link\b[^>]*>/gi;

function attributeOf(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i"));
  return match ? match[1] : null;
}

function isStylesheetTag(tag) {
  return /\srel\s*=\s*"stylesheet"/i.test(tag);
}

// Local scripts and stylesheets index.html loads, in document order.
// [{ tag, attr, url, path }] where `path` has no query string and no "./".
function localAssetTags(html) {
  const source = String(html).replace(/<!--[\s\S]*?-->/g, (comment) => " ".repeat(comment.length));
  const found = [];
  const collect = (regex, attr, accept) => {
    for (const match of source.matchAll(regex)) {
      const tag = match[0];
      if (accept && !accept(tag)) continue;
      const url = attributeOf(tag, attr);
      if (!url || isRemote(url)) continue;
      found.push({ index: match.index, tag, attr, url, path: url.split(/[?#]/)[0].replace(/^\.\//, "") });
    }
  };
  collect(SCRIPT_TAG, "src");
  collect(LINK_TAG, "href", isStylesheetTag);
  return found.sort((a, b) => a.index - b.index);
}

// Canonical precache entries ("./css/x.css") for the assets index.html loads.
function htmlCodeAssets(html) {
  const seen = new Set();
  const assets = [];
  for (const { path: assetPath } of localAssetTags(html)) {
    if (seen.has(assetPath)) continue;
    seen.add(assetPath);
    assets.push(`./${assetPath}`);
  }
  return assets;
}

function withVersion(url, hash) {
  return `${url.replace(/\?v=[^"&#]*/, "").replace(/\?$/, "")}?v=${hash}`;
}

// index.html exactly as generate-version writes it for `hash`.
function stampIndexHtml(html, hash) {
  let out = String(html);
  const tags = localAssetTags(out);
  // Replace from the end so earlier offsets stay valid.
  for (const item of tags.slice().reverse()) {
    const replacement = item.tag.replace(
      new RegExp(`(\\s${item.attr}\\s*=\\s*")([^"]*)(")`, "i"),
      (_, open, url, close) => `${open}${withVersion(url, hash)}${close}`,
    );
    out = out.slice(0, item.index) + replacement + out.slice(item.index + item.tag.length);
  }
  if (!/<meta\s+name="ludus-version"\s+content="[^"]*"/i.test(out)) {
    throw new Error('index.html has no <meta name="ludus-version" content="...">');
  }
  return out.replace(/(<meta\s+name="ludus-version"\s+content=")[^"]*(")/i, `$1${hash}$2`);
}

function ludusVersionMeta(html) {
  const match = String(html).match(/<meta\s+name="ludus-version"\s+content="([^"]*)"/i);
  return match ? match[1] : null;
}

// ---- version info ----

// Static entries (icons, images, manifest, "./", "./index.html") stay as they
// are in sw.js; JS and CSS entries are regenerated from index.html.
function buildCanonicalAssets(rawAssets, html) {
  const staticAssets = rawAssets.map(stripVersion).filter((asset) => !isVersionedAsset(asset));
  const head = staticAssets.filter((asset) => asset === "./" || asset === "./index.html");
  const tail = staticAssets.filter((asset) => asset !== "./" && asset !== "./index.html");
  const scripts = htmlCodeAssets(html);
  const lazy = lazyDataAssets().filter((asset) => !scripts.includes(asset));
  return [...head, ...scripts, ...lazy, ...tail];
}

// index.html with its own stamps (?v=..., the ludus-version meta) blanked: the
// version must not depend on itself, but anything else in the page (the CSP, the
// markup, the preload hints) is part of it.
function normalizedIndexHtml(html) {
  return stampIndexHtml(html, "");
}

// sw.js with the constants generate-version writes blanked, for the same reason.
function normalizedServiceWorker(swSource) {
  return String(swSource)
    .replace(/const CACHE_NAME = "[^"]*";/, 'const CACHE_NAME = "";')
    .replace(/const ENGINE_CACHE = "[^"]*";/, 'const ENGINE_CACHE = "";')
    .replace(/const ENGINE_FILES = \{[\s\S]*?\};/, "const ENGINE_FILES = {};")
    .replace(/const CORE_ASSETS = \[[\s\S]*?\];/, "const CORE_ASSETS = [];");
}

function computeVersionInfo() {
  const swSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

  const rawAssets = extractCoreAssets(swSource);
  const canonicalAssets = buildCanonicalAssets(rawAssets, html);

  const files = hashedFiles();
  const hash = crypto.createHash("sha256");
  for (const rel of files) {
    hash.update(`file:${rel}\n`);
    hash.update(readFile(rel));
    hash.update("\n");
  }
  hash.update("file:index.html (normalised)\n");
  hash.update(normalizedIndexHtml(html));
  hash.update("\nfile:sw.js (normalised)\n");
  hash.update(normalizedServiceWorker(swSource));
  hash.update("\n");
  hash.update(JSON.stringify(canonicalAssets));
  const versionHash = hash.digest("hex").slice(0, HASH_LENGTH);
  const engine = engineFiles();
  const engineCacheName = `${ENGINE_CACHE_PREFIX}${engineId(engine)}`;

  const versionedAssets = canonicalAssets.map((assetPath) =>
    isVersionedAsset(assetPath) ? `${assetPath}?v=${versionHash}` : assetPath,
  );

  return {
    versionHash,
    cacheName: `${CACHE_PREFIX}${versionHash}`,
    engineCacheName,
    engineFiles: engine,
    hashedFiles: files,
    canonicalAssets,
    rawAssets,
    versionedAssets,
    swSource,
    html,
  };
}

function engineBlock(files) {
  const lines = Object.keys(files).sort().map((rel) => `  "${rel}": "${files[rel]}",`).join("\n");
  return `const ENGINE_FILES = {\n${lines}\n};`;
}

function stampServiceWorker(swSource, info) {
  const assetsBlock = info.versionedAssets.map((a) => `  "${a}",`).join("\n");
  // Replacer functions, not strings: "$" sequences in the text must stay literal.
  return swSource
    .replace(/const CACHE_NAME = "[^"]*";/, () => `const CACHE_NAME = "${info.cacheName}";`)
    .replace(/const ENGINE_CACHE = "[^"]*";/, () => `const ENGINE_CACHE = "${info.engineCacheName}";`)
    .replace(/const ENGINE_FILES = \{[\s\S]*?\};/, () => engineBlock(info.engineFiles))
    .replace(/const CORE_ASSETS = \[[\s\S]*?\];/, () => `const CORE_ASSETS = [\n${assetsBlock}\n];`);
}

function main() {
  const info = computeVersionInfo();
  const swPath = path.join(root, "sw.js");
  const htmlPath = path.join(root, "index.html");

  fs.writeFileSync(swPath, stampServiceWorker(info.swSource, info));
  fs.writeFileSync(htmlPath, stampIndexHtml(info.html, info.versionHash));

  console.log(`generate-version: content hash ${info.versionHash} (${info.hashedFiles.length} files hashed)`);
  console.log(`  sw.js CACHE_NAME -> ${info.cacheName}`);
  console.log(`  sw.js ENGINE_CACHE -> ${info.engineCacheName} (${Object.keys(info.engineFiles).length} engine files)`);
  console.log(`  sw.js CORE_ASSETS -> ${info.versionedAssets.length} entries`);
  console.log(`  index.html: ${localAssetTags(info.html).length} script/stylesheet tags and <meta name="ludus-version"> -> ${info.versionHash}`);
}

module.exports = {
  computeVersionInfo,
  isVersionedAsset,
  hashedFiles,
  engineFiles,
  engineId,
  lazyDataAssets,
  normalizedIndexHtml,
  normalizedServiceWorker,
  localAssetTags,
  htmlCodeAssets,
  stampIndexHtml,
  stampServiceWorker,
  ludusVersionMeta,
  HASH_LENGTH,
  CACHE_PREFIX,
  ENGINE_CACHE_PREFIX,
  HASHED_FILES,
  HASHED_DIRS,
};

if (require.main === module) main();
