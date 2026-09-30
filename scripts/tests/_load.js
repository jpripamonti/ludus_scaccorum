// Builds a Node `vm` context with the fake DOM (./_fakedom.js) and loads, in
// order, the local <script src> files that index.html references. The list is
// parsed from index.html on every call, so it can never drift from what the
// browser actually loads.
//
//   const { load } = require("./_load.js");
//   const env = load();                       // everything, app.js included
//   const env = load({ app: false });         // modules only (no UI boot)
//   env.context   the vm context (globals such as Ludus live on it)
//   env.dom       the fake DOM (document, window, storageMap, elements)
//   env.run(code) evaluate code inside the context, returns its value; this is
//                 how a test reads app.js's top-level bindings, e.g.
//                 env.run("({ Chess, STATE })")
//   env.scripts   the files that were executed, in order
//
// Options: app (default true), skip (array of script paths), scripts (explicit
// list instead of index.html's), globals (extra context globals), console,
// languages (navigator.languages), minimal (only the globals the original
// regression check exposed; the default also adds Node's URL, performance,
// AbortController, TextEncoder, structuredClone, ... so modules that use them
// can be tested).

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createFakeDom } = require("./_fakedom.js");

const repoRoot = path.resolve(__dirname, "..", "..");

function isRemote(src) {
  return /^([a-z][a-z0-9+.-]*:)?\/\//i.test(src) || /^[a-z][a-z0-9+.-]*:/i.test(src);
}

// Local script paths, in document order, without query strings and "./".
function localScriptsFromHtml(html) {
  const withoutComments = String(html).replace(/<!--[\s\S]*?-->/g, "");
  const found = [];
  for (const match of withoutComments.matchAll(/<script\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    if (isRemote(match[1])) continue;
    found.push(match[1].split(/[?#]/)[0].replace(/^\.\//, ""));
  }
  return found;
}

// js/boot.js is the head-of-page guard (it flags <html> for the stylesheets and probes the browser): it has
// nothing to do with the app modules these tests load and has its own test (boot.test.js), so it is left out.
function localScripts() {
  return localScriptsFromHtml(fs.readFileSync(path.join(repoRoot, "index.html"), "utf8")).filter((file) => file !== "js/boot.js");
}

function load(options = {}) {
  const dom = options.dom || createFakeDom({ languages: options.languages });
  const host = {
    console: options.console || console,
    document: dom.document,
    window: dom.window,
    navigator: dom.navigator,
    localStorage: dom.localStorage,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: async () => {
      throw new Error("network disabled in tests");
    },
  };
  if (!options.minimal) {
    Object.assign(host, {
      performance,
      URL,
      URLSearchParams,
      TextEncoder,
      TextDecoder,
      AbortController,
      queueMicrotask,
      structuredClone,
      setImmediate,
      clearImmediate,
    });
  }
  Object.assign(host, options.globals);

  const context = vm.createContext(host);
  const skip = new Set(options.skip || []);
  if (options.app === false) skip.add("app.js");

  const executed = [];
  for (const rel of options.scripts || localScripts()) {
    if (skip.has(rel)) continue;
    const file = path.join(repoRoot, rel);
    vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
    executed.push(rel);
  }

  function run(code, filename = "test-snippet.js") {
    return vm.runInContext(String(code), context, { filename });
  }

  return {
    context,
    dom,
    run,
    scripts: executed,
    get Ludus() {
      return context.Ludus;
    },
  };
}

module.exports = { load, localScripts, localScriptsFromHtml, repoRoot };
