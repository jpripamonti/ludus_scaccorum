// Shared helpers of scripts/e2e/settings.js and scripts/e2e/account.js (real Chromium through Playwright).
// Not a scenario file: run those two. Nothing here touches the repository or the network.
//
//   open(browser, vp, options)   a fresh context (service workers blocked, CSP enforced unless axe has to be
//                                injected), the page on the given hash route, every console error, page error,
//                                failed request and HTTP >= 400 collected in ctx.problems
//   layoutProbe(rootSelector)    (runs in the page) the geometry findings of a screen: no horizontal scroll,
//                                nothing sticking out of the window, 44x44 targets, no clipped labels, no
//                                overlapping controls, no repeated id, no raw text key
//   contrastProbe(rootSelector)  (runs in the page) the contrast of every visible text on the colours it sits
//                                on (composited through its ancestors), 4.5:1 (3:1 for large text)
//   focusProbe / motionProbe / axeScan / inspect / shot
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright is not installed. Run with NODE_PATH=/opt/node22/lib/node_modules (see the header of the script).");
  process.exit(2);
}

const BASE_URL = process.env.LUDUS_URL || "http://127.0.0.1:5010/";
const FALLBACK_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SHOT_DIR = process.env.LUDUS_E2E_SHOTS || "";
const ONLY = process.env.LUDUS_E2E_ONLY || "";
const AXE_PATH = process.env.LUDUS_AXE || "";

const DEFAULT_VIEWPORTS = [
  { name: "desktop-1440", w: 1440, h: 900, touch: false },
  { name: "laptop-1280", w: 1280, h: 800, touch: false },
  { name: "tablet-land-1024", w: 1024, h: 768, touch: true },
  { name: "tablet-820", w: 820, h: 1180, touch: true },
  { name: "tablet-768", w: 768, h: 1024, touch: true },
  { name: "phone-390", w: 390, h: 844, touch: true },
  { name: "phone-360", w: 360, h: 740, touch: true },
];

function viewportsFromEnv() {
  const wanted = String(process.env.LUDUS_E2E_VIEWPORTS || "").split(",").map((entry) => entry.trim()).filter(Boolean);
  if (!wanted.length) return DEFAULT_VIEWPORTS;
  return wanted.map((entry) => {
    const [w, h] = entry.split("x").map(Number);
    return DEFAULT_VIEWPORTS.find((vp) => vp.w === w && vp.h === h) || { name: `custom-${w}x${h}`, w, h, touch: Math.min(w, h) < 900 };
  });
}

const LOCALES = { es: "es-AR", en: "en-US" };

async function launchBrowser() {
  const args = ["--no-sandbox"];
  try {
    return await chromium.launch({ args });
  } catch (firstError) {
    const explicit = process.env.LUDUS_CHROMIUM || FALLBACK_CHROMIUM;
    if (!fs.existsSync(explicit)) throw firstError;
    return chromium.launch({ executablePath: explicit, args });
  }
}

function step(message) {
  console.log(`  - ${message}`);
}

async function shot(page, name, options = {}) {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: Boolean(options.fullPage) });
}

// Opens the app on `hash` (for example "#/settings") in a fresh context.
//   options: lang, bypassCSP, reducedMotion, tag, initScript (function or string run before the page's scripts),
//            userAgent, storage ({key: value} written before the first script), routes(context) (set up routing)
async function open(browser, vp, options = {}) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    locale: LOCALES[options.lang || "en"],
    serviceWorkers: "block",
    acceptDownloads: true,
    bypassCSP: Boolean(options.bypassCSP),
    hasTouch: Boolean(vp.touch),
    isMobile: Boolean(vp.touch) && Math.min(vp.w, vp.h) < 500,
    reducedMotion: options.reducedMotion ? "reduce" : "no-preference",
    userAgent: options.userAgent || undefined,
  });
  if (typeof options.routes === "function") await options.routes(context);
  const page = await context.newPage();
  const problems = [];
  const ignored = options.ignoreProblems || [];
  const skip = (text) => ignored.some((pattern) => pattern.test(text));
  page.on("console", (message) => {
    if (message.type() === "error" && !skip(message.text())) problems.push(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    const line = `requestfailed: ${request.url()} (${request.failure() && request.failure().errorText})`;
    if (!skip(line)) problems.push(line);
  });
  page.on("response", (response) => {
    const line = `HTTP ${response.status()}: ${response.url()}`;
    if (response.status() >= 400 && !skip(line)) problems.push(line);
  });
  const seed = Object.assign({ "ludus.seen.v1": "1" }, options.storage || {});
  await page.addInitScript((entries) => {
    try {
      Object.keys(entries).forEach((key) => {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, entries[key]);
      });
    } catch (error) {
      // storage may be blocked on purpose by a scenario
    }
  }, seed);
  if (options.initScript) await page.addInitScript(options.initScript, options.initArg);
  await page.goto(`${BASE_URL}${options.hash || "#/home"}`);
  await page.waitForFunction(() => window.Ludus && Ludus.game && typeof Ludus.game.startSession === "function");
  if (options.lang) {
    await page.evaluate((lang) => Ludus.i18n.setLanguage(lang), options.lang);
  }
  if (options.screen) {
    await page.waitForFunction((id) => Ludus.router.current() === id, options.screen);
  }
  return { context, page, problems, vp, lang: options.lang || "en", issues: [], tag: options.tag || vp.name };
}

const settle = (page, ms = 450) => page.waitForTimeout(ms);

function checkProblems(label, problems) {
  assert.deepStrictEqual(problems, [], `${label}: the page reported problems:\n  ${problems.join("\n  ")}`);
}

function checkIssues(label, issues) {
  assert.deepStrictEqual(issues, [], `${label}: layout and accessibility findings:\n  ${issues.join("\n  ")}`);
}

// ---------- probes that run in the page ----------

// Geometry findings of one screen. Returns { issues, facts }; nothing asserts here.
function layoutProbe(rootSelector) {
  const issues = [];
  const root = document.querySelector(rootSelector);
  if (!root) return { issues: [`${rootSelector} is not in the page`], facts: {} };
  const vw = window.innerWidth;
  const de = document.documentElement;
  const describe = (el) => (el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}.${String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || "").split(/\s+/).filter(Boolean).slice(0, 2).join(".")}`);
  const px = (r) => `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`;
  const isShown = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !el.closest("[hidden], .hidden");
  };

  if (de.scrollWidth > de.clientWidth) issues.push(`the page scrolls horizontally (${de.scrollWidth} > ${de.clientWidth})`);
  if (document.body.scrollWidth > de.clientWidth) issues.push(`the body is wider than the window (${document.body.scrollWidth} > ${de.clientWidth})`);

  // Nothing sticks out of the window unless it sits in a scroller made for that.
  const insideScroller = (el) => {
    for (let node = el.parentElement; node && node !== root; node = node.parentElement) {
      const cs = getComputedStyle(node);
      if (/(auto|scroll)/.test(cs.overflowX)) return true;
    }
    return false;
  };
  root.querySelectorAll("*").forEach((el) => {
    if (!isShown(el) || el.closest(".sr-only") || el.closest("svg")) return;
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && !insideScroller(el)) issues.push(`${describe(el)} sticks out of the window (${px(r)} in ${vw})`);
  });

  // Labels are not clipped.
  root.querySelectorAll("*").forEach((el) => {
    if (!isShown(el) || el.closest("svg") || el.closest(".sr-only") || el.classList.contains("sr-only")) return;
    const cs = getComputedStyle(el);
    if ((cs.overflowX === "hidden" || cs.overflowX === "clip") && el.scrollWidth > el.clientWidth + 1 && !el.classList.contains("settings-meter") && !el.classList.contains("progress-track")) {
      issues.push(`${describe(el)} clips its content (${el.scrollWidth} > ${el.clientWidth})`);
    }
    if (cs.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1) issues.push(`${describe(el)} truncates its text`);
  });

  // Targets are at least 44x44 (a ::before hit area counts, that is how the small buttons get theirs).
  const targets = [];
  root.querySelectorAll("button, a[href], input:not([type='hidden']), select, textarea, [role='button'], summary").forEach((el) => {
    if (!isShown(el) || el.closest(".sr-only")) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return;
    let w = r.width;
    let h = r.height;
    const before = getComputedStyle(el, "::before");
    if (before && before.position === "absolute" && before.content !== "none") {
      w = Math.max(w, parseFloat(before.width) || 0);
      h = Math.max(h, parseFloat(before.height) || 0);
      // inset: -4px -2px on a .btn-sm: its box grows by 8 x 4
      const inset = (side) => Math.abs(parseFloat(before[side]) || 0);
      if (!parseFloat(before.width) && inset("top") + inset("bottom") > 0) h = Math.max(h, r.height + inset("top") + inset("bottom"));
      if (!parseFloat(before.width) && inset("left") + inset("right") > 0) w = Math.max(w, r.width + inset("left") + inset("right"));
    }
    // Text links inside a sentence are exempt (WCAG 2.5.8 inline exception); a link on its own line is not.
    const inline = el.tagName === "A" && getComputedStyle(el).display === "inline";
    if ((w < 43.5 || h < 43.5) && !inline) issues.push(`target too small: ${describe(el)} is ${Math.round(w)}x${Math.round(h)}`);
    targets.push(el);
  });

  // Controls do not overlap one another (an input laid over its own label is nesting, not overlap).
  for (let i = 0; i < targets.length; i += 1) {
    for (let j = i + 1; j < targets.length; j += 1) {
      const a = targets[i];
      const b = targets[j];
      if (a.contains(b) || b.contains(a) || (a.closest("label") && a.closest("label") === b.closest("label"))) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 2 && oy > 2) issues.push(`controls overlap: ${describe(a)} (${px(ra)}) and ${describe(b)} (${px(rb)})`);
    }
  }

  // No id repeated on the page; no raw text key on screen.
  const seen = new Map();
  document.querySelectorAll("[id]").forEach((el) => seen.set(el.id, (seen.get(el.id) || 0) + 1));
  seen.forEach((count, id) => {
    if (count > 1) issues.push(`the id ${id} is repeated ${count} times`);
  });
  const shown = root.innerText.replace(/docs\/[A-Za-z_.]+/g, "");
  const raw = shown.match(/\b(?:settings|account|auth|profile|ui|quality|scoring|kit)\.[a-z][\w-]*(?:\.[\w-]+)*\b/);
  if (raw) issues.push(`a raw text key is on screen: ${raw[0]}`);

  // Every interactive control has a name.
  root.querySelectorAll("button, a[href], input:not([type='hidden']), select, textarea").forEach((el) => {
    if (!isShown(el) && !(el.type === "radio" || el.type === "checkbox" || el.type === "file")) return;
    if (el.closest("[hidden]")) return;
    const labelled = (el.getAttribute("aria-label") || "").trim()
      || (el.getAttribute("aria-labelledby") && document.getElementById(el.getAttribute("aria-labelledby").split(/\s+/)[0]) && document.getElementById(el.getAttribute("aria-labelledby").split(/\s+/)[0]).textContent.trim())
      || (el.labels && el.labels.length && Array.from(el.labels).some((label) => label.textContent.trim()))
      || (el.tagName === "BUTTON" || el.tagName === "A" ? el.textContent.trim() : "");
    if (!labelled) issues.push(`${describe(el)} has no accessible name`);
  });

  return { issues, facts: { targets: targets.length, scrollWidth: de.scrollWidth, clientWidth: de.clientWidth } };
}

// The contrast of every visible text of a screen on the colours it sits on.
function contrastProbe(rootSelector) {
  const root = document.querySelector(rootSelector);
  const issues = [];
  if (!root) return { issues: [`${rootSelector} is not in the page`], count: 0 };
  const parse = (value) => {
    const m = /rgba?\(([^)]+)\)/.exec(value || "");
    if (!m) return null;
    const parts = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const over = (top, bottom) => {
    const a = top.a + bottom.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a,
      g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a,
      b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a,
      a,
    };
  };
  const lum = (c) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const la = lum(a);
    const lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  // The colour behind an element: its own and its ancestors' backgrounds, composited from the top down.
  const backdropOf = (el) => {
    const layers = [];
    for (let node = el; node; node = node.parentElement) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0) layers.push(c);
      if (c && c.a >= 0.999) break;
    }
    let acc = { r: 4, g: 8, b: 14, a: 1 }; // the page background as a last resort
    for (let i = layers.length - 1; i >= 0; i -= 1) acc = over(layers[i], acc);
    return acc;
  };
  const opacityOf = (el) => {
    let value = 1;
    for (let node = el; node; node = node.parentElement) value *= parseFloat(getComputedStyle(node).opacity) || 0;
    return value;
  };
  const describe = (el) => (el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}.${String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || "").split(/\s+/).filter(Boolean).slice(0, 2).join(".")}`);
  let count = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const done = new Set();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || done.has(el) || !node.textContent.trim()) continue;
    done.add(el);
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || cs.visibility === "hidden" || cs.display === "none" || el.closest("[hidden], .hidden, .sr-only, svg, [aria-hidden='true']")) continue;
    if (el.closest("[disabled], [aria-disabled='true'], input:disabled")) continue;
    const opacity = opacityOf(el);
    if (opacity < 0.05) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    const bg = backdropOf(el);
    const text = over({ r: fg.r, g: fg.g, b: fg.b, a: fg.a * opacity }, bg);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const got = ratio(text, bg);
    count += 1;
    if (got < need - 0.02) issues.push(`contrast ${got.toFixed(2)}:1 < ${need}:1 for "${node.textContent.trim().slice(0, 40)}" in ${describe(el)} (${cs.color} on rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)}))`);
  }
  return { issues, count };
}

// Tab stops: every one that shows a ring for the keyboard.
async function focusProbe(page, presses, scopeSelector) {
  await page.evaluate(() => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  });
  const stops = [];
  for (let i = 0; i < presses; i += 1) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate((scope) => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      if (scope && !el.closest(scope)) return { outside: true };
      // The ring of a radio tile / switch / swatch is on its face, the element next to the hidden input.
      const face = el.nextElementSibling && /(settings-tile-face|switch-track|account-swatch-face|account-drop-face|account-mode-face|check-box)/.test(el.nextElementSibling.className || "") ? el.nextElementSibling : el;
      const cs = getComputedStyle(face);
      const r = face.getBoundingClientRect();
      const ringWidth = parseFloat(cs.outlineWidth) || 0;
      const outline = cs.outlineStyle !== "none" && ringWidth >= 2 && cs.outlineColor !== "rgba(0, 0, 0, 0)" && cs.outlineColor !== "transparent";
      const shadow = Boolean(cs.boxShadow) && cs.boxShadow !== "none";
      const name = el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}.${String(el.className || "").split(/\s+/).filter(Boolean).slice(0, 2).join(".")}${el.getAttribute("data-value") ? `[${el.getAttribute("data-value")}]` : ""}`;
      return { name, tag: el.tagName, visibleRing: outline || shadow, focusVisible: el.matches(":focus-visible"), inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth };
    }, scopeSelector || "");
    if (info) stops.push(info);
  }
  return stops;
}

// Animations running right now inside a scope (a paused or finished one does not count).
const motionProbe = (page, scope) => page.evaluate((selector) => document.getAnimations()
  .filter((animation) => animation.playState === "running" && (!selector || (animation.effect && animation.effect.target && animation.effect.target.closest && animation.effect.target.closest(selector))))
  .map((animation) => ({ name: animation.animationName || animation.transitionProperty || "?", target: animation.effect && animation.effect.target ? (animation.effect.target.id || String(animation.effect.target.className || animation.effect.target.tagName)).slice(0, 50) : "?" })), scope || "");

let axeSource = null;
async function axeScan(ctx, label, options = {}) {
  if (!AXE_PATH) return;
  const { page } = ctx;
  if (axeSource === null) axeSource = fs.readFileSync(AXE_PATH, "utf8");
  const has = await page.evaluate(() => typeof window.axe !== "undefined");
  if (!has) await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async (scope) => {
    const target = scope ? document.querySelector(scope) || document : document;
    const run = await window.axe.run(target, { resultTypes: ["violations"] });
    return run.violations.map((violation) => ({
      id: violation.id, impact: violation.impact, help: violation.help,
      nodes: violation.nodes.slice(0, 4).map((node) => `${node.target.join(" ")} :: ${(node.failureSummary || "").replace(/\s+/g, " ").slice(0, 160)}`),
    }));
  }, options.scope || "");
  result.forEach((violation) => {
    const line = `axe ${violation.impact} ${violation.id}: ${violation.help} | ${violation.nodes.join(" | ")}`;
    if (violation.impact === "serious" || violation.impact === "critical") ctx.issues.push(`${ctx.tag} ${label}: ${line}`);
    else console.log(`    (axe ${violation.impact}, ${ctx.tag} ${label}) ${line}`);
  });
  return result;
}

// The layout probe, the contrast probe, a screenshot and axe of the current state; findings kept in ctx.issues.
async function inspect(ctx, label, rootSelector, options = {}) {
  const layout = await ctx.page.evaluate(layoutProbe, rootSelector);
  layout.issues.forEach((issue) => ctx.issues.push(`${ctx.tag} ${label}: ${issue}`));
  if (options.contrast !== false) {
    const contrast = await ctx.page.evaluate(contrastProbe, rootSelector);
    contrast.issues.forEach((issue) => ctx.issues.push(`${ctx.tag} ${label}: ${issue}`));
  }
  await shot(ctx.page, `${ctx.tag}-${label}`, { fullPage: options.fullPage });
  if (options.axe !== false) await axeScan(ctx, label, { scope: rootSelector });
  return layout;
}

// Runs the scenarios (each `fn(browser)`) whose name contains LUDUS_E2E_ONLY; exits 1 on the first failure.
async function runScenarios(title, scenarios) {
  let browser;
  try {
    browser = await launchBrowser();
  } catch (error) {
    console.error(`Could not launch Chromium: ${error.message}`);
    process.exit(2);
  }
  let failed = false;
  for (const [name, fn] of scenarios) {
    if (ONLY && !name.includes(ONLY)) continue;
    const started = Date.now();
    console.log(`\n[${title}] ${name}`);
    try {
      await fn(browser);
      console.log(`  ok (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    } catch (error) {
      failed = true;
      console.error(`  FAIL ${name}\n${error && error.stack ? error.stack : error}`);
      break;
    }
  }
  await browser.close();
  console.log(failed ? `\n${title}: FAILED` : `\n${title}: all scenarios passed`);
  process.exit(failed ? 1 : 0);
}

module.exports = {
  assert, BASE_URL, ONLY, AXE_PATH, SHOT_DIR, DEFAULT_VIEWPORTS, viewportsFromEnv, LOCALES,
  launchBrowser, open, step, shot, settle, checkProblems, checkIssues,
  layoutProbe, contrastProbe, focusProbe, motionProbe, axeScan, inspect, runScenarios,
};
