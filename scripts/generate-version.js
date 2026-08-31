// Derives a single content hash from app.js + styles.css + the precache asset
// list, and stamps that hash into index.html's stylesheet/script query
// strings and into sw.js's cache name. This replaces the hand-bumped
// "?v=maestroNNN" scheme: a content change now changes the hash automatically,
// so it is no longer possible to ship an index.html/sw.js combination that
// disagrees about which app.js/styles.css they point at. See
// scripts/smoke-check.js for the check that fails the build if drift occurs.
//
// Usage: node scripts/generate-version.js  (rewrites index.html and sw.js)
// `computeVersionInfo()` below is also required by smoke-check.js to verify
// the checked-in files match the current content without rewriting anything.

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const HASH_LENGTH = 12;
const CACHE_PREFIX = "ludus-scaccorum-static-";

function readFile(rel) {
  return fs.readFileSync(path.join(root, rel));
}

function extractCoreAssets(swSource) {
  const match = swSource.match(/const CORE_ASSETS = \[([\s\S]*?)\];/);
  if (!match) throw new Error("could not find CORE_ASSETS array in sw.js");
  return [...match[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
}

// Only styles.css and app.js carry a cache-busting version query; every other
// precached asset (svgs, images, the manifest) is referenced by a stable path.
function isVersionedAsset(assetPath) {
  return /(^|\/)(styles\.css|app\.js)$/.test(assetPath);
}

function stripVersion(assetPath) {
  return assetPath.replace(/\?v=[^"]*$/, "");
}

function computeVersionInfo() {
  const appJs = readFile("app.js");
  const stylesCss = readFile("styles.css");
  const swSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");

  const rawAssets = extractCoreAssets(swSource);
  const canonicalAssets = rawAssets.map(stripVersion);

  const hash = crypto.createHash("sha256");
  hash.update(appJs);
  hash.update(stylesCss);
  hash.update(JSON.stringify(canonicalAssets));
  const versionHash = hash.digest("hex").slice(0, HASH_LENGTH);

  const versionedAssets = canonicalAssets.map((assetPath) =>
    isVersionedAsset(assetPath) ? `${assetPath}?v=${versionHash}` : assetPath,
  );

  return {
    versionHash,
    cacheName: `${CACHE_PREFIX}${versionHash}`,
    canonicalAssets,
    rawAssets,
    versionedAssets,
    swSource,
  };
}

function main() {
  const info = computeVersionInfo();
  const swPath = path.join(root, "sw.js");
  const htmlPath = path.join(root, "index.html");

  const assetsBlock = info.versionedAssets.map((a) => `  "${a}",`).join("\n");
  let newSw = info.swSource.replace(
    /const CACHE_NAME = "[^"]*";/,
    `const CACHE_NAME = "${info.cacheName}";`,
  );
  newSw = newSw.replace(
    /const CORE_ASSETS = \[[\s\S]*?\];/,
    `const CORE_ASSETS = [\n${assetsBlock}\n];`,
  );

  let html = fs.readFileSync(htmlPath, "utf8");
  html = html.replace(
    /(href="styles\.css)(\?v=[^"]*)?(")/,
    `$1?v=${info.versionHash}$3`,
  );
  html = html.replace(
    /(src="app\.js)(\?v=[^"]*)?(")/,
    `$1?v=${info.versionHash}$3`,
  );

  fs.writeFileSync(swPath, newSw);
  fs.writeFileSync(htmlPath, html);

  console.log(`generate-version: content hash ${info.versionHash}`);
  console.log(`  sw.js CACHE_NAME -> ${info.cacheName}`);
  console.log(`  index.html styles.css / app.js -> ?v=${info.versionHash}`);
}

module.exports = { computeVersionInfo, isVersionedAsset, HASH_LENGTH, CACHE_PREFIX };

if (require.main === module) main();
