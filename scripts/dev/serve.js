// Local dev server (`npm start`): serves exactly what the Pages deployment publishes,
// on 127.0.0.1 only.
//
//   python3 -m http.server (what `npm start` used to be) listens on every network
//   interface and serves the whole working tree: anyone on the same Wi-Fi could read
//   .git/ (the full history), gitignored files, docs, the scripts. This server binds
//   to the loopback address and only answers for the files of the deploy list
//   (.github/workflows/deploy-pages.yml copies the same ones): index.html, the
//   top-level app files and the js/, css/, assets/ and vendor/ trees.
//
// Usage: node scripts/dev/serve.js [port]   (default 5010, or $PORT)
// `createServer(root)` is exported for the tests.

"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");

const DEFAULT_PORT = 5010;
const HOST = "127.0.0.1";
const TOP_FILES = new Set(["index.html", "app.js", "styles.css", "config.js", "sw.js", "manifest.json", "LICENSE", "THIRD_PARTY_NOTICES.md"]);
const TOP_DIRS = new Set(["js", "css", "assets", "vendor"]);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

// The file a URL path names, or null when it is not part of the deploy list.
function resolveRequest(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (error) {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) return null;
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const parts = relative.split("/");
  if (parts.some((part) => part === "" || part === "." || part === ".." || part.startsWith("."))) return null;
  if (!(parts.length === 1 ? TOP_FILES.has(parts[0]) : TOP_DIRS.has(parts[0]))) return null;
  const file = path.join(root, ...parts);
  return file.startsWith(root + path.sep) ? file : null;
}

function createServer(root) {
  const base = path.resolve(root);
  return http.createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }
    const pathname = new URL(request.url, "http://localhost").pathname;
    const file = resolveRequest(base, pathname);
    fs.stat(file || base, (error, stat) => {
      if (!file || error || !stat.isFile()) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      response.writeHead(200, {
        // LICENSE has no extension: show it instead of downloading it.
        "Content-Type": TYPES[path.extname(file).toLowerCase()] || (path.extname(file) ? "application/octet-stream" : "text/plain; charset=utf-8"),
        "Content-Length": stat.size,
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      if (request.method === "HEAD") response.end();
      else fs.createReadStream(file).pipe(response);
    });
  });
}

module.exports = { createServer, resolveRequest, HOST, TOP_FILES, TOP_DIRS };

if (require.main === module) {
  const port = Number(process.argv[2] || process.env.PORT) || DEFAULT_PORT;
  createServer(path.resolve(__dirname, "..", "..")).listen(port, HOST, () => {
    console.log(`Ludus Scaccorum dev server: http://localhost:${port}/ (listening on ${HOST} only; serves the deploy list, not the repository)`);
  });
}
