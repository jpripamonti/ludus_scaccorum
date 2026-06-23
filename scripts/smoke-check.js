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

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
}

[
  "index.html",
  "styles.css",
  "app.js",
  "sw.js",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "assets/landing/maestro.png",
  "assets/landing/maestro.webp",
  "vendor/stockfish-18-lite-single.js",
  "vendor/stockfish-18-lite-single.wasm",
  "vendor/SHA256SUMS",
].forEach(assertFile);

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

try {
  execFileSync(process.execPath, ["--check", path.join(root, "app.js")], { stdio: "pipe" });
} catch (error) {
  fail(`app.js syntax check failed\n${error.stderr || error.message}`);
}

try {
  execFileSync(process.execPath, ["--check", path.join(root, "sw.js")], { stdio: "pipe" });
} catch (error) {
  fail(`sw.js syntax check failed\n${error.stderr || error.message}`);
}

const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
for (const match of css.matchAll(/url\(([^)]+)\)/g)) {
  const raw = match[1].trim().replace(/^['"]|['"]$/g, "");
  if (!raw || raw.startsWith("data:") || /^https?:\/\//.test(raw)) continue;
  assertFile(raw.split(/[?#]/)[0]);
}

if (/fonts\.(googleapis|gstatic)\.com/i.test(html + css)) {
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

if (process.exitCode) process.exit(process.exitCode);
console.log("smoke-check passed");
