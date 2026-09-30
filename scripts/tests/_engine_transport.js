// Test helper (not a test: the runner skips files starting with "_").
//
// A Node implementation of the engine Transport interface that spawns the
// vendored Stockfish (vendor/stockfish-18-lite-single.js speaks UCI on
// stdin/stdout when run under Node), so js/engine.js can be exercised against
// the real engine without a browser:
//
//   const { createNodeTransport } = require("./_engine_transport.js");
//   const eng = Ludus.Engine.create({ createTransport: () => createNodeTransport() });
//
// Transport = { postMessage(line), addEventListener(type, fn),
//               removeEventListener(type, fn), terminate() }
// "message" listeners get { data: "<one line of engine output>" }; "error"
// listeners get { message } when the process fails or dies unexpectedly.
// Extra members for tests: pid, exited (Promise resolving when the child is
// gone), log (every line sent/received, when options.log is an array).

"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const ENGINE_PATH = path.join(repoRoot, "vendor", "stockfish-18-lite-single.js");

// Every child ever spawned, so a test that dies half way cannot leave a
// Stockfish process behind.
const liveChildren = new Set();
process.on("exit", () => {
  liveChildren.forEach((child) => {
    try {
      child.kill("SIGKILL");
    } catch (error) {
      // Already gone.
    }
  });
});

function engineAvailable() {
  try {
    return fs.statSync(ENGINE_PATH).isFile() && fs.statSync(ENGINE_PATH.replace(/\.js$/, ".wasm")).isFile();
  } catch (error) {
    return false;
  }
}

function createNodeTransport(options) {
  const settings = options || {};
  if (!engineAvailable()) {
    throw new Error(`vendored Stockfish is missing: expected ${ENGINE_PATH} and its .wasm next to it`);
  }

  const child = spawn(process.execPath, [ENGINE_PATH], { stdio: ["pipe", "pipe", "pipe"], cwd: repoRoot });
  liveChildren.add(child);

  const listeners = { message: new Set(), error: new Set() };
  const log = Array.isArray(settings.log) ? settings.log : null;
  let closed = false; // terminate() was called: stay silent from then on
  let buffer = "";
  let stderrText = "";

  function emit(type, event) {
    Array.from(listeners[type]).forEach((fn) => {
      try {
        fn(event);
      } catch (error) {
        // A misbehaving listener must not break the pipe.
      }
    });
  }

  const exited = new Promise((resolve) => {
    child.on("exit", (code, signal) => {
      liveChildren.delete(child);
      if (!closed) {
        closed = true;
        emit("error", { message: `engine process exited (code ${code}, signal ${signal})${stderrText ? `: ${stderrText.slice(0, 200)}` : ""}` });
      }
      resolve({ code, signal });
    });
  });

  child.on("error", (error) => {
    if (closed) return;
    emit("error", { message: error && error.message ? error.message : "spawn failed" });
  });

  child.stdout.on("data", (chunk) => {
    if (closed) return;
    buffer += chunk.toString("utf8");
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).replace(/\r$/, "");
      buffer = buffer.slice(newline + 1);
      if (line) {
        if (log) log.push({ dir: "in", line, at: Date.now() });
        emit("message", { data: line });
      }
      newline = buffer.indexOf("\n");
    }
  });

  child.stderr.on("data", (chunk) => {
    stderrText += chunk.toString("utf8");
    if (stderrText.length > 2000) stderrText = stderrText.slice(-2000);
  });

  // Writing to a dead child raises EPIPE asynchronously.
  child.stdin.on("error", (error) => {
    if (closed) return;
    emit("error", { message: `engine stdin: ${error && error.message}` });
  });

  return {
    pid: child.pid,
    exited,
    postMessage(line) {
      if (closed) throw new Error("transport terminated");
      if (log) log.push({ dir: "out", line: String(line), at: Date.now() });
      child.stdin.write(`${line}\n`);
    },
    addEventListener(type, fn) {
      if (listeners[type] && typeof fn === "function") listeners[type].add(fn);
    },
    removeEventListener(type, fn) {
      if (listeners[type]) listeners[type].delete(fn);
    },
    terminate() {
      if (closed && child.exitCode !== null) return;
      closed = true;
      try {
        child.stdin.end();
      } catch (error) {
        // Ignore.
      }
      try {
        child.kill("SIGKILL");
      } catch (error) {
        // Ignore.
      }
    },
  };
}

module.exports = { createNodeTransport, engineAvailable, ENGINE_PATH };
