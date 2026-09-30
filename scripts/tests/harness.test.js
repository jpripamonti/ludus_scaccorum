// Tests for the test harness itself (scripts/tests/_load.js + _fakedom.js) and
// for the module wiring it exposes: the script list is derived from index.html,
// every namespace docs/ARCHITECTURE.md promises exists after loading, and
// contexts are isolated from each other.

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { load, localScripts, localScriptsFromHtml, repoRoot } = require("./_load.js");

// ---------- Script list comes from index.html ----------

assert.deepStrictEqual(
  localScriptsFromHtml(`
    <script src="https://example.org/remote.js"></script>
    <!-- <script src="commented-out.js"></script> -->
    <script src="./a.js?v=1"></script>
    <script defer src='b/c.js#x'></script>
    <script>inline()</script>
    <script src="//cdn.example.org/x.js"></script>
    <script src="d.js"></script>`),
  ["a.js", "b/c.js", "d.js"],
  "only local sources, in document order, without query strings",
);

const scripts = localScripts();
assert.deepStrictEqual(scripts.slice(0, 4), ["config.js", "js/ludus.js", "js/chess.js", "js/pgn.js"], "the documented head of the load order");
assert.strictEqual(scripts[scripts.length - 1], "app.js", "app.js loads last");
scripts.forEach((file) => assert.ok(fs.existsSync(path.join(repoRoot, file)), `${file} exists`));
["js/engine.js", "js/scoring.js", "js/profile.js", "js/classics.js", "js/ui/home.js", "js/ui/account.js"].forEach((file) => {
  assert.ok(scripts.includes(file), `index.html loads ${file}`);
});
assert.ok(!scripts.some((file) => file.startsWith("js/data/")), "lazily loaded data is not in index.html");
assert.ok(!scripts.some((file) => file.startsWith("vendor/")), "the engine worker is not a page script");

// ---------- Loading everything but app.js ----------

{
  const env = load({ app: false });
  assert.ok(!env.scripts.includes("app.js"));
  assert.deepStrictEqual(env.scripts, scripts.filter((file) => file !== "app.js"), "scripts run in index.html order");

  const { Ludus } = env;
  assert.strictEqual(typeof Ludus, "object");
  assert.strictEqual(Ludus.version, "dev", "the fake DOM has no <meta name=ludus-version>, so the version is dev");
  assert.strictEqual(Ludus.config.googleClientId, "", "config.js was executed and read (via window.LUDUS_CONFIG)");
  assert.strictEqual(typeof Ludus.chess.Chess, "function");
  assert.strictEqual(typeof Ludus.pgn.parseTags, "function");

  // Every module docs/ARCHITECTURE.md lists registers its namespace, even as a stub.
  ["Engine", "Scoring", "Insights", "Concepts", "Settings", "Profile", "Facts", "Reader", "Audio", "Auth", "Classics"].forEach((name) => {
    assert.ok(Ludus[name] && typeof Ludus[name] === "object", `Ludus.${name} is registered`);
  });
  ["home", "classics", "notebook", "progress", "museum", "settings", "account"].forEach((name) => {
    const screen = Ludus.Screens[name];
    assert.ok(screen, `Ludus.Screens.${name} is registered`);
    ["mount", "show", "hide"].forEach((fn) => assert.strictEqual(typeof screen[fn], "function", `Ludus.Screens.${name}.${fn}`));
  });
}

// ---------- Language detection agrees with app.js ----------

{
  assert.strictEqual(load({ app: false }).Ludus.i18n.lang(), "en", "the default fake browser is English");
  assert.strictEqual(load({ app: false, languages: ["es-AR"] }).Ludus.i18n.lang(), "es");
  const seeded = load({ app: false, languages: ["es"] });
  assert.strictEqual(seeded.dom.storageMap.size, 0, "loading writes nothing to storage (the probe cleans up)");
}

// ---------- app.js on top of the modules ----------

{
  const env = load({ minimal: true });
  assert.strictEqual(env.scripts[env.scripts.length - 1], "app.js");
  const { Chess, STATE, files } = env.run("({ Chess, STATE, files })");
  assert.strictEqual(Chess, env.Ludus.chess.Chess, "app.js uses the very class Ludus.chess exports");
  assert.strictEqual(files, env.Ludus.chess.files);
  assert.strictEqual(STATE.language, env.Ludus.i18n.lang(), "app.js and Ludus.i18n start in the same language");

  const spanish = load({ minimal: true, languages: ["es"] });
  assert.strictEqual(spanish.run("STATE.language"), "es");
  assert.strictEqual(spanish.Ludus.i18n.lang(), "es");
}

// ---------- Isolation ----------

{
  const one = load({ app: false });
  const two = load({ app: false });
  assert.notStrictEqual(one.Ludus, two.Ludus, "each load() gets its own Ludus");
  one.Ludus.bus.on("x", () => {});
  one.Ludus.i18n.register({ es: { "harness.only.one": "solo uno" } });
  assert.strictEqual(two.Ludus.i18n.t("harness.only.one"), "harness.only.one", "translations do not leak between contexts");
  assert.strictEqual(globalThis.Ludus === undefined || globalThis.Ludus !== one.Ludus, true, "and nothing leaks into the test process");
}

console.log("harness.test.js passed");
