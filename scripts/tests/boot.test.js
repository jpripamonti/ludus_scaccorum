// Unit tests for js/boot.js, the synchronous guard that runs from <head>: returning-visitor flag, framing
// (clickjacking) and browser baseline. It is executed in a bare vm context with a tiny hand-made document, exactly
// like a browser would run a classic script, so it also proves that the file needs nothing but window/document.
// Plain assert, no framework. The CSS half (what the flags hide) is checked by scripts/e2e/shell.js.

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..", "..");
const source = fs.readFileSync(path.join(repoRoot, "js", "boot.js"), "utf8");
const html = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
const css = fs.readFileSync(path.join(repoRoot, "css", "system.css"), "utf8");

function makeElement(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    attributes: {},
    children: [],
    style: {},
    textContent: "",
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return name in this.attributes ? this.attributes[name] : null; },
    hasAttribute(name) { return name in this.attributes; },
    removeAttribute(name) { delete this.attributes[name]; },
    appendChild(child) { this.children.push(child); child.parent = this; return child; },
    insertBefore(child) { this.children.unshift(child); child.parent = this; return child; },
  };
  return el;
}

// options: stored (localStorage content), languages (or a whole navigator object), framed, topThrows, supports(fn), noCss, noFetch, bodyReady
function run(options = {}) {
  const root = makeElement("html");
  const head = makeElement("head");
  const body = makeElement("body");
  const listeners = {};
  const document = {
    documentElement: root,
    head,
    body: options.bodyReady === false ? null : body,
    createElement: makeElement,
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text) }),
    getElementById: (id) => [head, body].concat(body.children).reduce((found, el) => found || (el && el.id === id ? el : null), null),
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };
  // A text node carries its text in textContent: flatten an element the way the page would show it.
  function textOf(node) {
    if (!node) return "";
    if (node.nodeType === 3) return node.textContent;
    return (node.children || []).map(textOf).join(" ");
  }
  const storage = {
    getItem(key) {
      if (options.storageThrows) throw new Error("SecurityError");
      return Object.prototype.hasOwnProperty.call(options.stored || {}, key) ? options.stored[key] : null;
    },
  };
  const self = {};
  const timers = [];
  const win = {
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    document,
    navigator: options.navigator || { languages: options.languages || ["en-US"], language: (options.languages || ["en-US"])[0] },
    self,
    Promise,
    fetch: options.noFetch ? undefined : function fetch() {},
    CSS: options.noCss ? undefined : { supports: options.supports || (() => true) },
  };
  Object.defineProperty(win, "top", {
    get() {
      if (options.topThrows) throw new Error("SecurityError");
      return options.framed ? { other: true } : self;
    },
  });
  Object.defineProperty(win, "localStorage", { get() { return storage; } });
  Object.defineProperty(self, "location", { value: { href: "https://example.org/ludus_scaccorum/?x=1#/account" } });
  win.window = win;
  const context = vm.createContext(win);
  vm.runInContext(source, context, { filename: "js/boot.js" });
  return { root, head, body, document, win, listeners, textOf, timers };
}

// ---------- a first visit ----------

{
  const { root, head, body } = run();
  assert.ok(!root.hasAttribute("data-returning"), "a first visit is not flagged as returning");
  assert.ok(!root.hasAttribute("data-framed") && !root.hasAttribute("data-unsupported"));
  assert.strictEqual(body.children.length, 0, "no notice on a supported, unframed page");
  // The hero photograph is preloaded for first-time visitors only, one link per layout (phone / desktop), via media.
  assert.strictEqual(head.children.length, 2, "two preload links (phone and desktop candidates)");
  head.children.forEach((link) => {
    assert.strictEqual(link.rel, "preload");
    assert.strictEqual(link.as, "image");
    assert.ok(/^\((min|max)-width: \d+px\)$/.test(link.media), "each preload is tied to a media query");
    assert.ok(/maestro.*\.webp 1x/.test(link.getAttribute("imagesrcset")), "density descriptors mirror css/home.css");
  });
}

// ---------- a returning visitor ----------

{
  const { root, head } = run({ stored: { "ludus.seen.v1": "1" } });
  assert.ok(root.hasAttribute("data-returning"), "ludus.seen.v1 flags a returning visitor");
  assert.strictEqual(head.children.length, 0, "a returning visitor never requests the hero photograph");
  ["0", "false", "null", ""].forEach((value) => {
    assert.ok(!run({ stored: { "ludus.seen.v1": value } }).root.hasAttribute("data-returning"), `the stored value ${JSON.stringify(value)} is not a visit`);
  });
  // Blocked storage (private mode, sandboxed frame) must not throw: the page simply behaves as a first visit.
  const blocked = run({ storageThrows: true });
  assert.ok(!blocked.root.hasAttribute("data-returning"));
}

// A returning visitor must not stare at a skeleton for ever when the app never starts.
{
  const late = run({ stored: { "ludus.seen.v1": "1" } });
  assert.strictEqual(late.timers.length, 1, "one safety timer");
  assert.ok(late.timers[0].ms >= 8000, "long enough for a slow connection");
  late.timers[0].fn(); // no body[data-screen]: the app never showed a screen
  assert.ok(!late.root.hasAttribute("data-returning"), "the flag is withdrawn: the static landing comes back");
  const started = run({ stored: { "ludus.seen.v1": "1" } });
  started.body.attributes["data-screen"] = "home";
  started.timers[0].fn();
  assert.ok(started.root.hasAttribute("data-returning"), "an app that started is left alone");
}

// ---------- framing (clickjacking) ----------

{
  const framed = run({ framed: true });
  assert.ok(framed.root.hasAttribute("data-framed"), "a framed page is flagged before anything paints");
  assert.ok(!framed.root.hasAttribute("data-returning"), "nothing else runs when framed");
  assert.strictEqual(framed.head.children.length, 0, "no preload when framed");
  const notice = framed.body.children[0];
  assert.ok(notice && notice.id === "boot-notice", "a notice takes the place of the app");
  const link = notice.children.find((child) => child.tagName === "A");
  assert.ok(link, "the notice offers the app in its own tab");
  assert.strictEqual(link.href, "https://example.org/ludus_scaccorum/?x=1", "the link drops the hash: a frame cannot choose the screen");
  assert.strictEqual(link.target, "_blank");
  assert.strictEqual(link.rel, "noopener");
  assert.ok(framed.textOf(notice).includes("Open Ludus Scaccorum"), "English for an English browser");

  // A top window that cannot even be compared counts as framed (fail closed).
  assert.ok(run({ topThrows: true }).root.hasAttribute("data-framed"), "an unreadable window.top is treated as framed");

  // Spanish browsers and the stored choice decide the notice language.
  const es = run({ framed: true, languages: ["es-AR", "en"] });
  assert.ok(es.textOf(es.body.children[0]).includes("Abrir Ludus Scaccorum"));
  const forced = run({ framed: true, languages: ["es-AR"], stored: { "ludus.language": "en" } });
  assert.ok(forced.textOf(forced.body.children[0]).includes("Open Ludus Scaccorum"), "a stored language wins");

  // Before <body> exists the notice waits for DOMContentLoaded.
  const early = run({ framed: true, bodyReady: false });
  assert.strictEqual(typeof early.listeners.DOMContentLoaded, "function", "the notice is built when the body is ready");
}

// ---------- browser baseline ----------

{
  const ok = run();
  assert.ok(!ok.root.hasAttribute("data-unsupported"));

  const noHas = run({ supports: (prop) => !/has\(/.test(prop) });
  assert.ok(noHas.root.hasAttribute("data-unsupported"), "no :has() means too old");
  assert.ok(noHas.body.children[0] && noHas.body.children[0].attributes.role === "alert", "the notice is announced");
  assert.strictEqual(noHas.head.children.length, 0, "an unsupported browser does not preload anything");

  const noContainer = run({ supports: (prop) => prop !== "container-type" });
  assert.ok(noContainer.root.hasAttribute("data-unsupported"), "no container queries means too old");

  assert.ok(run({ noCss: true }).root.hasAttribute("data-unsupported"), "no CSS.supports at all is an old browser");
  assert.ok(run({ noFetch: true }).root.hasAttribute("data-unsupported"), "no fetch is an old browser");
  assert.ok(run({ supports: () => { throw new Error("boom"); } }).root.hasAttribute("data-unsupported"), "a throwing probe never throws out of boot.js");

  const es = run({ supports: () => false, languages: ["es-AR"] });
  assert.ok(es.textOf(es.body.children[0]).includes("Tu navegador es demasiado viejo"));
  const fr = run({ supports: () => false, languages: ["fr-FR"] });
  assert.ok(fr.textOf(fr.body.children[0]).includes("Your browser is too old"), "only Spanish browsers get Spanish");
}

// ---------- PC-4: the page language before the app loads is the one the app will pick ----------

{
  // js/ludus.js decides the language of the app (Ludus.i18n.lang()); js/boot.js has to pick the same one for its notices because it
  // runs earlier and cannot import. Both are run over the same table of inputs. A browser says its languages in navigator.languages (a list)
  // and, where that is empty or missing, in navigator.language (one string); a stored choice (ludus.language) wins over both.
  const ludusSource = fs.readFileSync(path.join(repoRoot, "js", "ludus.js"), "utf8");
  function appLanguage(navigator, stored, storageThrows) {
    const storage = {
      getItem(key) {
        if (storageThrows) throw new Error("SecurityError");
        return Object.prototype.hasOwnProperty.call(stored || {}, key) ? stored[key] : null;
      },
      setItem() {},
    };
    const context = vm.createContext({ navigator, localStorage: storage, console });
    vm.runInContext(ludusSource, context, { filename: "js/ludus.js" });
    return context.Ludus.i18n.lang();
  }
  function bootLanguage(navigator, stored, storageThrows) {
    // The language shows in the notice a framed page gets, the only visible output of boot.js.
    const framed = run({ framed: true, navigator, stored, storageThrows });
    const text = framed.textOf(framed.body.children[0]);
    if (text.includes("Abrir Ludus Scaccorum")) return "es";
    if (text.includes("Open Ludus Scaccorum")) return "en";
    throw new Error(`no notice language in: ${text}`);
  }
  const nav = (languages, language) => ({ languages, language });
  const table = [
    ["es-AR", nav(["es-AR"], "es-AR"), null, "es"],
    ["es", nav(["es"], "es"), null, "es"],
    ["en-US, es: the first of the two supported languages wins", nav(["en-US", "es"], "en-US"), null, "en"],
    ["fr, es-MX: a language that is neither is skipped", nav(["fr-FR", "es-MX"], "fr-FR"), null, "es"],
    ["fr", nav(["fr"], "fr"), null, "en"],
    ["pt-BR, de", nav(["pt-BR", "de"], "pt-BR"), null, "en"],
    ["an empty list and no language", nav([], undefined), null, "en"],
    ["no list and no language", nav(undefined, undefined), null, "en"],
    ["no list, language ES-ar (any case)", nav(undefined, "ES-ar"), null, "es"],
    ["an empty list falls back to language", nav([], "es-ES"), null, "es"],
    ["ast (Asturian) is not Spanish", nav(["ast"], "ast"), null, "en"],
    ["est (Estonian) is not Spanish: only 'es' and 'es-*' are", nav(["est"], "est"), null, "en"],
    ["es_AR (an underscore)", nav(["es_AR"], "es_AR"), null, "es"],
    ["a null entry", nav([null, "es"], null), null, "es"],
    ["a list that is not a list", nav("es-AR", "es-AR"), null, "es"],
    ["stored en beats a Spanish browser", nav(["es-AR"], "es-AR"), { "ludus.language": "en" }, "en"],
    ["stored es beats an English browser", nav(["en-US"], "en-US"), { "ludus.language": "es" }, "es"],
    ["stored value in capitals", nav(["en-US"], "en-US"), { "ludus.language": "ES" }, "es"],
    ["stored value that is no language means the default (Spanish)", nav(["en-US"], "en-US"), { "ludus.language": "fr" }, "es"],
    ["an empty stored value is no choice", nav(["en-US"], "en-US"), { "ludus.language": "" }, "en"],
  ];
  table.forEach(([label, navigator, stored, expected]) => {
    const app = appLanguage(navigator, stored, false);
    const boot = bootLanguage(navigator, stored, false);
    assert.strictEqual(app, expected, `js/ludus.js: ${label}`);
    assert.strictEqual(boot, app, `js/boot.js and js/ludus.js agree: ${label}`);
  });
  // Blocked storage: the browser's language decides, in both.
  assert.strictEqual(bootLanguage(nav(["es-AR"], "es-AR"), null, true), "es");
  assert.strictEqual(bootLanguage(nav(["fr"], "fr"), null, true), "en");
  assert.strictEqual(appLanguage(nav(["es-AR"], "es-AR"), null, true), "es");
  // A navigator that throws on access is English in both (no guess).
  const throwing = {};
  Object.defineProperty(throwing, "languages", { get() { throw new Error("no"); } });
  assert.strictEqual(bootLanguage(throwing, null, false), "en");
}

// ---------- PC-3: the language buttons are named, and the landing says what own-game rounds keep ----------

{
  // "ES" / "EN" alone are read out letter by letter: each button is named in its own language, with that language as its lang.
  const button = (id) => new RegExp(`<button id="${id}"[^>]*>`).exec(html)[0];
  assert.ok(/lang="es"/.test(button("language-btn-es")) && /aria-label="Español"/.test(button("language-btn-es")));
  assert.ok(/lang="en"/.test(button("language-btn-en")) && /aria-label="English"/.test(button("language-btn-en")));
  // The privacy card of the landing (js/ui/home.js) says, in both languages, what is stored, that nothing reaches the authors and how to delete it.
  const home = fs.readFileSync(path.join(repoRoot, "js", "ui", "home.js"), "utf8");
  const card = (lang) => {
    const block = home.split(lang === "es" ? "  es: {" : "  en: {")[1];
    return /"ld\.private\.b\.body": "([^"]*)"/.exec(block)[1];
  };
  const es = card("es");
  const en = card("en");
  assert.ok(/usuario/.test(es) && /rivales/.test(es) && /enlace/.test(es) && /servidor/.test(es) && /nos llega/.test(es) && /Cuenta/.test(es), es);
  assert.ok(/username/.test(en) && /opponents/.test(en) && /link/.test(en) && /no server/.test(en) && /reaches us/.test(en) && /Account/.test(en), en);
  // README and the Google notes say it too, in both languages.
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  const google = fs.readFileSync(path.join(repoRoot, "docs", "GOOGLE_SIGNIN.md"), "utf8");
  ["**Usernames and game links.**", "**Usuarios y enlaces a partidas.**"].forEach((heading) => assert.ok(google.includes(heading), `GOOGLE_SIGNIN.md: ${heading}`));
  assert.ok(/Usernames and game links/.test(readme) && /Usuarios y enlaces a partidas/.test(readme), "README.md says it in both languages");
}

// ---------- the file itself ----------

{
  // It has to parse on an old engine: no arrow functions, template literals, let/const, optional chaining or classes.
  const code = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/=>|`|\blet\b|\bconst\b|\?\.|\?\?|\bclass\b/.test(code), "js/boot.js is written in ES5");
  // It is the one script of <head>, before every stylesheet, so its flags are set before the first paint.
  const bootAt = html.indexOf('src="js/boot.js');
  const firstSheet = html.indexOf('rel="stylesheet"');
  assert.ok(bootAt > 0 && bootAt < firstSheet, "index.html loads js/boot.js before the stylesheets");
  assert.ok(html.indexOf("Content-Security-Policy") < bootAt, "the CSP meta comes first, so it covers the boot script");
  assert.ok(html.indexOf("</head>") > bootAt, "boot.js is in <head>");
  // The CSS that reacts to the three flags exists (the flags would be inert otherwise).
  ["html[data-returning] body:not([data-screen]) #landing-screen", "html[data-framed] body > :not(#boot-notice)", "html[data-unsupported] body > :not(#boot-notice)"].forEach((selector) => {
    assert.ok(css.includes(selector), `css/system.css reacts to the flag: ${selector}`);
  });
  // The hero variants boot.js preloads are the ones the stylesheet uses.
  const home = fs.readFileSync(path.join(repoRoot, "css", "home.css"), "utf8");
  ["maestro-1280.webp", "maestro-2000.webp", "maestro.webp"].forEach((file) => {
    assert.ok(source.includes(file) && home.includes(file), `${file} is referenced by boot.js and css/home.css`);
    assert.ok(fs.existsSync(path.join(repoRoot, "assets", "landing", file)), `${file} exists`);
  });
}

console.log("boot tests passed");
