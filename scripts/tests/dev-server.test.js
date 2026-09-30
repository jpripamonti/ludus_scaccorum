// Tests for scripts/dev/serve.js (`npm start`, SEC-018): loopback only, and it serves
// the deploy list, not the repository (.git, docs, scripts, data, dotfiles).
// Plain assert, no framework; it starts the server on an ephemeral port.

"use strict";

const assert = require("assert");
const http = require("http");
const path = require("path");
const { createServer, resolveRequest, HOST } = require("../dev/serve.js");

const root = path.resolve(__dirname, "..", "..");
const pkg = require(path.join(root, "package.json"));

function get(port, pathname, method = "GET") {
  return new Promise((resolve, reject) => {
    // `path` is sent verbatim (no normalisation), which is what an attacker's client does too.
    const request = http.request({ host: HOST, port, path: pathname, method }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    request.on("error", reject);
    request.end();
  });
}

(async () => {
  // `npm start` runs this server, bound to the loopback address.
  assert.ok(/scripts\/dev\/serve\.js/.test(pkg.scripts.start), "npm start runs the dev server");
  assert.ok(!/http\.server/.test(pkg.scripts.start), "and no longer python's http.server (all interfaces, the whole tree)");
  assert.strictEqual(HOST, "127.0.0.1");

  const server = createServer(root);
  await new Promise((resolve) => server.listen(0, HOST, resolve));
  const address = server.address();
  assert.strictEqual(address.address, "127.0.0.1", "listens on the loopback address only");
  const port = address.port;
  try {
    for (const [url, type] of [
      ["/", "text/html"],
      ["/index.html", "text/html"],
      ["/app.js", "text/javascript"],
      ["/sw.js", "text/javascript"],
      ["/styles.css?v=abc", "text/css"],
      ["/manifest.json", "application/json"],
      ["/js/ludus.js", "text/javascript"],
      ["/css/system.css", "text/css"],
      ["/assets/brand/logo.svg", "image/svg+xml"],
      ["/vendor/stockfish-18-lite-single.wasm", "application/wasm"],
      ["/LICENSE", "text/plain"],
    ]) {
      const res = await get(port, url);
      assert.strictEqual(res.status, 200, `${url} is served`);
      assert.ok(res.headers["content-type"].startsWith(type), `${url}: ${res.headers["content-type"]}`);
    }
    assert.ok((await get(port, "/")).body.toString().includes("<title>"), "/ is index.html");
    assert.strictEqual((await get(port, "/index.html", "HEAD")).body.length, 0, "HEAD has no body");

    // Not part of the deploy list, or not a file: nothing leaks.
    for (const url of [
      "/.git/HEAD", "/.git/config", "/.gitignore", "/.claude/launch.json", "/package.json", "/package-lock.json", "/README.md", "/TODO.md",
      "/docs/ARCHITECTURE.md", "/scripts/dev/serve.js", "/scripts/smoke-check.js", "/data/classics/notes.json", "/Reports/", "/progress.md",
      "/js/", "/js", "/assets/", "/js/data/.gitkeep", "/js/../package.json", "/js/%2e%2e/package.json", "/%2e%2e/%2e%2e/etc/passwd",
      "/..%2f..%2fetc/passwd", "/js%2f..%2f..%2fpackage.json", "/js\\..\\package.json", "/vendor/%00.js", "/%", "/vendor/nope.js",
    ]) {
      const res = await get(port, url);
      assert.strictEqual(res.status, 404, `${url} is not served (got ${res.status})`);
      assert.ok(!/ludus-scaccorum|ref: refs|\[core\]|root:/.test(res.body.toString()), `${url} leaked nothing`);
    }
    assert.strictEqual((await get(port, "/index.html", "POST")).status, 405, "GET and HEAD only");
    assert.strictEqual((await get(port, "/", "DELETE")).status, 405);
  } finally {
    server.close();
  }

  // The resolver on its own: the deploy list, and only it.
  assert.strictEqual(resolveRequest(root, "/"), path.join(root, "index.html"));
  assert.strictEqual(resolveRequest(root, "/js/data/classics.data.js"), path.join(root, "js", "data", "classics.data.js"));
  assert.strictEqual(resolveRequest(root, "/.git/HEAD"), null);
  assert.strictEqual(resolveRequest(root, "/docs/x.md"), null);
  assert.strictEqual(resolveRequest(root, "/js/../app.js"), null, "no dot segments at all");

  console.log("dev-server.test.js passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
