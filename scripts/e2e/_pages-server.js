// A stand-in for GitHub Pages for the service worker checks (scripts/e2e/sw.js):
// serves a directory the way Pages does (gzip, ETag, Cache-Control: max-age=600,
// which is what makes stale HTTP-cache copies possible), lets a test swap the
// directory while the server keeps running (a "deploy") and lets it make the
// network misbehave:
//
//   mode "ok"      normal
//   mode "refuse"  every connection is reset at once (offline, server gone)
//   mode "hang"    the connection is accepted and never answered (a captive
//                  portal, a tunnel, Wi-Fi with no internet behind it)
//
// `requests` lists every request that reached the server ({ time, method, path }),
// so a test can prove that something did NOT hit the network.

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const zlib = require("zlib");

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
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};
const COMPRESSIBLE = new Set([".html", ".js", ".css", ".json", ".svg", ".wasm", ".md", ".txt"]);

function createPagesServer(initialRoot) {
  let root = path.resolve(initialRoot);
  let mode = "ok";
  const requests = [];
  const sockets = new Set();
  const gzipCache = new Map();

  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    requests.push({ time: Date.now(), method: request.method, path: url.pathname + url.search });
    if (mode === "refuse") {
      request.socket.destroy();
      return;
    }
    if (mode === "hang") return; // accepted, never answered
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch (error) {
      response.writeHead(400);
      response.end();
      return;
    }
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.join(root, pathname);
    if (!file.startsWith(root + path.sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) {
        response.writeHead(404, { "Content-Type": "text/html", "Cache-Control": "max-age=600" });
        response.end("<h1>404</h1>");
        return;
      }
      const body = fs.readFileSync(file);
      const extension = path.extname(file).toLowerCase();
      const etag = `"${crypto.createHash("md5").update(body).digest("hex").slice(0, 16)}"`;
      const headers = {
        "Content-Type": TYPES[extension] || "application/octet-stream",
        "Cache-Control": "max-age=600",
        ETag: etag,
        "Last-Modified": stat.mtime.toUTCString(),
        Vary: "Accept-Encoding",
      };
      if (request.headers["if-none-match"] === etag) {
        response.writeHead(304, headers);
        response.end();
        return;
      }
      let out = body;
      if (COMPRESSIBLE.has(extension) && body.length > 1024 && /gzip/.test(request.headers["accept-encoding"] || "")) {
        const key = `${file}${etag}`;
        if (!gzipCache.has(key)) gzipCache.set(key, zlib.gzipSync(body, { level: 6 }));
        out = gzipCache.get(key);
        headers["Content-Encoding"] = "gzip";
      }
      headers["Content-Length"] = out.length;
      response.writeHead(200, headers);
      response.end(request.method === "HEAD" ? undefined : out);
    });
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  return {
    requests,
    get root() { return root; },
    get mode() { return mode; },
    // A deploy: the next request is answered from `nextRoot`.
    deploy(nextRoot) { root = path.resolve(nextRoot); },
    setMode(next) {
      mode = next;
      if (next === "refuse") sockets.forEach((socket) => socket.destroy());
    },
    listen(port) {
      return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server.address().port)));
    },
    close() {
      sockets.forEach((socket) => socket.destroy());
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

module.exports = { createPagesServer };
