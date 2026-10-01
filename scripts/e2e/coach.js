// Browser end-to-end check of the play screen and the coach (index.html #game-layout,
// css/coach.css, js/ui/coach.js and the play code of app.js) in real Chromium, against the
// real Stockfish Worker.
//
// Playwright is NOT a project dependency (the app has no runtime or dev dependencies) and
// this script is not part of `npm test`. Run it by hand:
//
//   python3 -m http.server 5010 &                      # serve the repo root
//   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/coach.js
//
// Environment (all optional):
//   LUDUS_URL             page to test               (default http://127.0.0.1:5010/)
//   LUDUS_E2E_ONLY        run only the scenarios whose name contains this text (e.g. "duel")
//   LUDUS_E2E_VIEWPORTS   comma list of WIDTHxHEIGHT to use in "regimes" and "axe" instead of the ten
//                         defaults (e.g. 390x844,1280x800)
//   LUDUS_CHROMIUM        chrome binary if Playwright cannot launch its own
//                         (falls back to /opt/pw-browsers/chromium-1194/chrome-linux/chrome)
//   LUDUS_E2E_SHOTS       directory for screenshots (none are saved when unset)
//   LUDUS_AXE             path to axe.min.js: turns on the "axe" scenario (axe-core is not a project
//                         dependency; the scenario runs in a context that bypasses the CSP because axe
//                         is injected as a script, every other scenario enforces it)
//
// Scenarios (each in a fresh context with service workers blocked, CSP enforced):
//   regimes    Ten viewports (1440x900, 1280x800, 1024x768, 820x1180, 768x1024, 390x844, 360x740, 360x640, 320x568, 844x390)
//              in Spanish and in English. In each: a classic session, thinking -> hint -> a weak move
//              (evaluating) -> result -> next -> the best move -> summary -> reopen a position. At every
//              state: no horizontal scroll, the page itself never scrolls, the board is whole on screen,
//              header items, board, dock and panel do not overlap, the primary button is on screen,
//              nothing is wider than its scroll region, every control is at least 44x44, no id is
//              repeated and no raw text key is on screen. The board does not move (or change size) when
//              the answer is evaluated and when the result arrives.
//   classic    The long path at 1280x800: keyboard shortcuts and hints, the evaluating state, the
//              verdict and its focus, the engine lines stepped one move at a time (board follows),
//              exploring the board, the language switch in the middle of a result, a concept dialog, a
//              skip, the summary (positions reopen, "back to the summary"), share, play again, and the
//              guard that asks before leaving a running session by the address bar.
//   duel       Two players on one device, at 1280x800, 390x844 and 844x390: every position starts covered (the clock waits
//              for a tap or Enter) and the players take turns going first, the handoff hides the first answer, the
//              scoreboard follows the turn, the shared analysis names the winner, the summary crowns them with one card
//              per player and offers a rematch (which starts covered again, with the first player).
//   clock      A 5 second clock really runs out (verdict, chip, stopped clock) and an untimed one never does.
//   own        The own-games flow with the Lichess request answered from a PGN written here: the search
//              overlay (with its facts carousel) sits on the board at desktop and phone size, the card of
//              an own game links to its game safely.
//   motion     prefers-reduced-motion and the setting a11y.motion = reduce: nothing keeps moving in the
//              thinking, evaluating, result and summary states.
//   keyboard   Tab reaches everything in the thinking, result and summary states, every stop shows a visible
//              focus ring, N / H / E / B keys do what the legend says.
//   contrast   The text of the play screen measured on the pixels it sits on (axe cannot read text over gradients
//              and images, which is most of this screen): every visible text meets 4.5:1 (3:1 when large) in the
//              thinking, result (every quality of answer), duel result and summary states, in both languages, at a
//              desktop and a phone size, and in the high-contrast setting. A screenshot is taken with the text made
//              transparent, decoded here (no dependency) and each element's box is compared with its own colour. A measurement is only
//              kept if the boxes read before and after the screenshot are the same (the screen did not move in between) and a finding
//              only counts if a second measurement gives the very same one (RK-1).
//   polish     The polish pass: a long player name in the duel's "Ana plays White" line gets the ellipsis and the side to move
//              is never cut (320, 390 and 820 px, both languages, also with the 24 letters of a profile name), and the keyboard
//              ring of the coach scroll region, the handoff cover, the sheet handle and the header buttons sits inside what
//              clips it (the --focus-ring-offset pattern of css/system.css) and is never cut by an overflow:hidden parent.
//   axe        (with LUDUS_AXE) no serious or critical violation in thinking, evaluating, result, duel
//              result, handoff, summary, a reopened position, the search overlay and the concept dialog, at
//              four viewports in both languages.
//   landscape  (polish RK-1, RK-4, RK-5) The short-landscape and small-window regimes (568x320 up to 880x700, both languages): every dock
//              button has a translated tooltip with its key and keeps its accessible name, the exit button has air over the board, and
//              the layout probe's new check (a text cut off by an overflow:hidden ancestor, as the verdict card did with its headline) is
//              clean for all ten qualities of answer at every size; the tooltips follow a language change.
//   duel-ready (polish PF-2) The cover of a duel position with two names of 24 letters (a duel keeps all 24) at 320x568,
//              390x844, 844x390 and 1280x800 in both languages: it names who goes first and where the device goes, a
//              long name wraps, every part is inside it, nothing scrolls, the focus is on it (a polite live region says
//              it once), Space starts the round and the focus goes to the board; then the handoff, and position 2 starts
//              with the other player.
//
// Every scenario fails on any console error, uncaught page error or failed request, and reports the
// layout findings of all its states together. Exits 0 on success, 1 on the first failed scenario, 2 if
// Playwright is missing.

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright is not installed. Run with NODE_PATH=/opt/node22/lib/node_modules (see the header of this file).");
  process.exit(2);
}

const BASE_URL = process.env.LUDUS_URL || "http://127.0.0.1:5010/";
const FALLBACK_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SHOT_DIR = process.env.LUDUS_E2E_SHOTS || "";
const ONLY = process.env.LUDUS_E2E_ONLY || "";
const AXE_PATH = process.env.LUDUS_AXE || "";
const RESULT_TIMEOUT_MS = 60000;

const DEFAULT_VIEWPORTS = [
  { name: "desktop-1440", w: 1440, h: 900, touch: false },
  { name: "laptop-1280", w: 1280, h: 800, touch: false },
  { name: "tablet-land-1024", w: 1024, h: 768, touch: true },
  { name: "tablet-820", w: 820, h: 1180, touch: true },
  { name: "tablet-768", w: 768, h: 1024, touch: true },
  { name: "phone-390", w: 390, h: 844, touch: true },
  { name: "phone-360", w: 360, h: 740, touch: true },
  { name: "phone-360-short", w: 360, h: 640, touch: true },
  { name: "phone-320", w: 320, h: 568, touch: true },
  { name: "phone-land-844", w: 844, h: 390, touch: true },
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

// ---------- helpers ----------

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

async function shot(page, name) {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
}

// A fresh context per run, service workers blocked (the service worker is cache-first and would
// serve stale files), CSP enforced (unless axe has to be injected).
async function open(browser, vp, options = {}) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    locale: LOCALES[options.lang || "en"],
    serviceWorkers: "block",
    bypassCSP: Boolean(options.bypassCSP),
    hasTouch: Boolean(vp.touch),
    isMobile: Boolean(vp.touch) && Math.min(vp.w, vp.h) < 500,
    reducedMotion: options.reducedMotion ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  const problems = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => problems.push(`requestfailed: ${request.url()} (${request.failure() && request.failure().errorText})`));
  page.on("response", (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  await page.goto(BASE_URL);
  await page.waitForFunction(() => window.Ludus && Ludus.game && typeof Ludus.game.startSession === "function");
  // A returning person goes straight home; the landing page has its own checks (gate.js).
  await page.locator("#landing-start-btn").click();
  await page.waitForFunction(() => Ludus.router.current() === "home");
  return { context, page, problems, vp, lang: options.lang || "en", issues: [], tag: options.tag || vp.name, bypassCSP: Boolean(options.bypassCSP) };
}

async function collectEvents(page) {
  await page.evaluate(() => {
    window.__events = { started: [], rounds: [], completed: [] };
    Ludus.bus.on("session:started", (payload) => window.__events.started.push(payload.session));
    Ludus.bus.on("round:completed", (payload) => window.__events.rounds.push(payload.round));
    Ludus.bus.on("session:completed", (payload) => window.__events.completed.push(payload.session));
  });
}

const events = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__events)));
const evalState = (page, expression) => page.evaluate(`(${expression})`);
const square = (page, name) => page.locator(`#board .square[data-square="${name}"]`);
const phaseOf = (page) => page.locator("#game-layout").getAttribute("data-phase");
const textOf = async (page, selector) => ((await page.locator(selector).first().textContent()) || "").replace(/\s+/g, " ").trim();

async function startClassic(page, { count = 3, mode = "solo", names, options, kind = "classic", title } = {}) {
  return page.evaluate(async (args) => {
    await Ludus.Classics.load();
    const game = Ludus.Classics.list()[0];
    window.__positions = Ludus.Classics.positions(game.id, { count: args.count });
    await Ludus.game.startSession({
      kind: args.kind, title: args.title || game.title[Ludus.i18n.lang() === "en" ? "en" : "es"], mode: args.mode, names: args.names, positions: window.__positions, options: args.options,
    });
    return JSON.parse(JSON.stringify(window.__positions));
  }, { count, mode, names, options, kind, title });
}

// A duel starts covered (PF-2): the clock of the player who goes first waits for a tap on the cover. Resolves once the round runs.
async function startDuel(page, args) {
  const positions = await startClassic(page, { ...args, mode: "duel" });
  await waitPhase(page, "handoff");
  await page.locator("#handoff-overlay").click();
  await waitPhase(page, "thinking");
  return positions;
}

async function playUci(page, uci) {
  await square(page, uci.slice(0, 2)).click();
  await square(page, uci.slice(2, 4)).click();
  if (uci.length > 4) await page.locator(`#promotion-choice-${uci[4]}`).click();
}

// A legal move that is not in the reference lines: the engine has to search it.
const weakMove = (page) => page.evaluate(() => {
  const position = STATE.positions[STATE.index];
  const known = position.reference.lines.map((line) => line.uci);
  return new Chess(position.fen).generateMoves().map((move) => moveToUci(move)).filter((uci) => !known.includes(uci)).pop();
});

const waitPhase = (page, phase, timeout = RESULT_TIMEOUT_MS) => page.waitForFunction((wanted) => document.querySelector("#game-layout").getAttribute("data-phase") === wanted, phase, { timeout });
const waitResult = (page) => page.waitForFunction(() => STATE.ui.phase === "result" && Boolean(STATE.resultView.context) && document.querySelector("#game-layout").getAttribute("data-phase") === "result", null, { timeout: RESULT_TIMEOUT_MS });

// Settles the entrance animations of a state before a screenshot or a measurement.
const settle = (page, ms = 450) => page.waitForTimeout(ms);

// RK-1: a fixed wait is not enough under CPU load (the page runs its entrance transitions late, so a probe sampled a text and the card it
// sits on half way through one: 3.94:1 against 4.6:1 when the machine was idle). Waits until no CSS transition or animation that has an
// end is running on the page, with a cap, and resolves with what it saw so a test can prove it waited. Animations that never end (a
// loader's dots) are ignored: there is nothing to wait for.
function whenQuiet(capMs) {
  return new Promise((resolve) => {
    const started = performance.now();
    const running = () => document.getAnimations().filter((animation) => {
      if (animation.playState !== "running" && animation.playState !== "pending") return false;
      const timing = animation.effect && typeof animation.effect.getComputedTiming === "function" ? animation.effect.getComputedTiming() : null;
      return !(timing && timing.iterations === Infinity);
    });
    const poll = () => {
      const left = running();
      const waited = Math.round(performance.now() - started);
      if (!left.length || waited >= capMs) {
        resolve({ waited, left: left.length, names: left.slice(0, 4).map((animation) => animation.animationName || animation.transitionProperty || "?") });
        return;
      }
      setTimeout(poll, 25);
    };
    poll();
  });
}
const quiet = (page, capMs = 1500) => page.evaluate(whenQuiet, capMs);

function checkProblems(label, problems) {
  assert.deepStrictEqual(problems, [], `${label}: the page reported problems:\n  ${problems.join("\n  ")}`);
}

function checkIssues(label, issues) {
  assert.deepStrictEqual(issues, [], `${label}: layout and accessibility findings:\n  ${issues.join("\n  ")}`);
}

// ---------- the probes that run in the page ----------

// Everything about the geometry of the play screen in its current state. Returns facts and a
// list of findings; nothing here asserts, so a run reports every finding of every state.
function layoutProbe(options) {
  const opts = options || {};
  const issues = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const de = document.documentElement;
  const $ = (selector) => document.querySelector(selector);
  const rectOf = (el) => (el ? el.getBoundingClientRect() : null);
  const isShown = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !el.closest(".hidden, [hidden]");
  };
  const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1.5;
  const describe = (el) => (el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}.${String(el.className || "").split(/\s+/).filter(Boolean).slice(0, 2).join(".")}`);
  const px = (rect) => `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`;

  // 1. The page does not scroll: this screen is a fixed layout with a scroll region of its own.
  if (de.scrollWidth > de.clientWidth) issues.push(`the page scrolls horizontally (${de.scrollWidth} > ${de.clientWidth})`);
  if (document.body.scrollWidth > de.clientWidth) issues.push(`the body is wider than the window (${document.body.scrollWidth} > ${de.clientWidth})`);
  if (de.scrollHeight > vh + 1) issues.push(`the page scrolls vertically (${de.scrollHeight} > ${vh})`);

  // 2. The board is whole on screen and big enough to play on.
  const board = $("#board");
  const boardRect = rectOf(board);
  // The closing summary takes the whole screen: the board is not part of it.
  const summaryView = Boolean(document.querySelector("#game-layout") && document.querySelector("#game-layout").dataset.view === "summary");
  const expandedSheet = Boolean(document.querySelector("#game-layout") && document.querySelector("#game-layout").dataset.expanded === "true");
  if (summaryView) {
    if (isShown(board)) issues.push("the board is shown behind the summary");
  } else if (expandedSheet) {
    // The phone's sheet, opened over the board on purpose: the way back must be on screen.
    const handle = document.querySelector("#coach-expand");
    if (!isShown(handle) || handle.getBoundingClientRect().top < 0 || handle.getBoundingClientRect().bottom > vh) issues.push("the way back to the board is not on screen");
  } else if (!isShown(board)) {
    issues.push("the board is not shown");
  } else {
    if (boardRect.left < -0.5 || boardRect.top < -0.5 || boardRect.right > vw + 0.5 || boardRect.bottom > vh + 0.5) issues.push(`the board is not whole on screen (${px(boardRect)} in ${vw}x${vh})`);
    // 240px (the floor of the stylesheet: 30px squares, what a 320x568 phone leaves once the sheet has its share), or 60% of
    // the height when the window is short (a phone on its side has 390px).
    if (boardRect.width < Math.min(240, vh * 0.6)) issues.push(`the board is too small to play on (${Math.round(boardRect.width)}px)`);
    if (Math.abs(boardRect.width - boardRect.height) > 1.5) issues.push(`the board is not square (${px(boardRect)})`);
  }

  // 3. Nothing in the header overlaps (the title may be hidden on a phone, that is the design).
  const headItems = ["#restart-btn", ".co-head-info", "#session-dots", "#play-score", "#duel-score", "#solo-clock-rail", "#sound-btn"]
    .map((selector) => $(selector)).filter((el) => isShown(el));
  for (let i = 0; i < headItems.length; i += 1) {
    for (let j = i + 1; j < headItems.length; j += 1) {
      if (overlap(rectOf(headItems[i]), rectOf(headItems[j]))) issues.push(`header items overlap: ${describe(headItems[i])} and ${describe(headItems[j])}`);
    }
  }
  const head = $("#play-header");
  if (isShown(head)) {
    const headRect = rectOf(head);
    headItems.forEach((el) => {
      const r = rectOf(el);
      if (r.right > headRect.right + 1 || r.left < headRect.left - 1) issues.push(`${describe(el)} sticks out of the header`);
    });
  }

  // 3b. RK-5: the exit button is not flush with the board under it (on a phone on its side there were 2px between the button and the board's corner).
  const exitButton = $("#restart-btn");
  if (!summaryView && !expandedSheet && isShown(exitButton) && isShown(board)) {
    const e = rectOf(exitButton);
    const sharesColumn = Math.min(e.right, boardRect.right) - Math.max(e.left, boardRect.left) > 1.5;
    if (sharesColumn && boardRect.top >= e.bottom - 1 && boardRect.top - e.bottom < 4) issues.push(`the exit button is flush with the board (${Math.round((boardRect.top - e.bottom) * 10) / 10}px of air)`);
  }

  // 4. Board, dock and panel do not overlap (the phone's expanded sheet covers the board on purpose).
  const layout = $("#game-layout");
  const expanded = layout && layout.dataset.expanded === "true";
  const wrap = document.querySelector(".board-wrap");
  const dock = $("#board-dock");
  const panel = $("#coach-panel");
  if (isShown(wrap) && isShown(dock) && overlap(rectOf(wrap), rectOf(dock))) issues.push("the dock overlaps the board");
  if (!expanded) {
    if (isShown(wrap) && isShown(panel) && overlap(rectOf(wrap), rectOf(panel))) issues.push(`the panel overlaps the board (${px(rectOf(panel))} over ${px(rectOf(wrap))})`);
    if (isShown(dock) && isShown(panel) && overlap(rectOf(dock), rectOf(panel))) issues.push("the panel overlaps the dock");
  }
  if (isShown(panel)) {
    const p = rectOf(panel);
    if (p.right > vw + 0.5 || p.bottom > vh + 0.5 || p.left < -0.5 || p.top < -0.5) issues.push(`the panel is not whole on screen (${px(p)} in ${vw}x${vh})`);
  }

  // 5. The primary action is always on screen.
  const phase = layout ? layout.dataset.phase : "";
  const foot = $("#coach-foot");
  if ((phase === "result" || phase === "summary") && isShown(foot)) {
    const f = rectOf(foot);
    if (f.bottom > vh + 0.5 || f.top < 0) issues.push(`the footer is off screen (${px(f)} in ${vw}x${vh})`);
    const primary = phase === "summary" ? Array.from(document.querySelectorAll("#summary-actions button")).filter(isShown) : [$("#next-btn")].filter(isShown);
    if (!primary.length) issues.push(`no primary button is shown in the ${phase} state`);
    primary.forEach((el) => {
      const r = rectOf(el);
      if (r.bottom > vh + 0.5 || r.top < 0 || r.right > vw + 0.5 || r.left < -0.5) issues.push(`${describe(el)} is off screen (${px(r)})`);
    });
  }

  // 6. Nothing is wider than its scroll region, and nothing wider than the screen.
  const scroll = $("#coach-scroll");
  if (scroll && scroll.scrollWidth > scroll.clientWidth + 1) {
    const culprit = Array.from(scroll.querySelectorAll("*")).find((el) => el.getBoundingClientRect().right > scroll.getBoundingClientRect().right + 1 && isShown(el));
    issues.push(`the panel scrolls sideways (${scroll.scrollWidth} > ${scroll.clientWidth}${culprit ? `, ${describe(culprit)}` : ""})`);
  }
  document.querySelectorAll("#game-layout .btn, #game-layout .co-dock-btn").forEach((el) => {
    if (!isShown(el)) return;
    const label = el.querySelector(".btn-label") || el;
    // An icon-only dock hides the words visually (they stay for a screen reader): nothing is clipped.
    if (label !== el && label.clientWidth <= 2) return;
    if (label.scrollWidth > label.clientWidth + 1) issues.push(`${describe(el)} clips its label (${label.scrollWidth} > ${label.clientWidth})`);
    // The dock is a fixed row: a label that wraps to more lines than the button has room for is cut (it was three lines at 320px).
    if (el.classList.contains("co-dock-btn") && el.scrollHeight > el.clientHeight + 1) issues.push(`${describe(el)} is taller inside than it is (${el.scrollHeight} > ${el.clientHeight}): its label wraps too much`);
  });
  // The header says which position it is: cut to "Po..." it says nothing (it wraps to two lines instead).
  ["#round-status"].forEach((selector) => {
    const el = $(selector);
    if (!isShown(el)) return;
    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) issues.push(`${selector} is cut ("${el.textContent.trim()}": ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight})`);
  });
  // 6b. RK-4: words cut off by an overflow:hidden (or clip) ancestor. The checks above all measure boxes, never the words inside them, so the
  // hero card of the verdict (overflow: hidden) clipped its headline at 568x320 and nothing noticed. Deliberate cuts are not findings: an
  // ellipsis, a line clamp, text that only a screen reader reads (its box is a point), and whatever a scroll region cuts on the axis it
  // scrolls (the climb stops there on that axis: it is scrolled content, and what lies beyond it is the scroller's business).
  {
    const reported = new Set();
    const textWalker = document.createTreeWalker(layout || document.body, NodeFilter.SHOW_TEXT);
    for (let node = textWalker.nextNode(); node; node = textWalker.nextNode()) {
      if (!/\S/.test(node.textContent || "")) continue;
      const host = node.parentElement;
      if (!host || host.closest("#board, .sr-only, [hidden], .hidden, script, style, svg, .skeleton")) continue;
      const hostStyle = getComputedStyle(host);
      if (hostStyle.visibility === "hidden" || hostStyle.display === "none") continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const box = range.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) continue;
      let checkX = true;
      let checkY = true;
      for (let up = host; up && up !== document.body && up !== de; up = up.parentElement) {
        const style = getComputedStyle(up);
        if (Number(style.opacity) === 0 || style.visibility === "hidden") break;
        if (up.clientWidth <= 2 || up.clientHeight <= 2) {
          // A box clipped to a point holds text kept for a screen reader; an inline box has no overflow of its own.
          if (style.overflowX !== "visible" || style.overflowY !== "visible") break;
          continue;
        }
        const cuts = (value) => value === "hidden" || value === "clip";
        const scrolls = (value) => value === "auto" || value === "scroll";
        if (scrolls(style.overflowX)) checkX = false;
        if (scrolls(style.overflowY)) checkY = false;
        if (!checkX && !checkY) break;
        const deliberate = style.textOverflow === "ellipsis" || hostStyle.textOverflow === "ellipsis" || (style.webkitLineClamp && style.webkitLineClamp !== "none");
        if (deliberate) continue;
        const r = up.getBoundingClientRect();
        const left = r.left + up.clientLeft;
        const top = r.top + up.clientTop;
        const right = left + up.clientWidth;
        const bottom = top + up.clientHeight;
        // The box of a text is its font's content area (ascent + descent), taller than a line of small `line-height`: a fifth of its height may
        // lie outside (empty room above the capitals and under the descenders) without hiding a single stroke.
        const slackY = Math.max(1, box.height * 0.2);
        const outX = checkX && cuts(style.overflowX) && (box.right > right + 1 || box.left < left - 1);
        const outY = checkY && cuts(style.overflowY) && (box.bottom > bottom + slackY || box.top < top - slackY);
        if (outX || outY) {
          const key = `${describe(up)}|${node.textContent.trim().slice(0, 24)}`;
          if (!reported.has(key)) {
            reported.add(key);
            issues.push(`text is clipped by the overflow of ${describe(up)}: "${node.textContent.replace(/\s+/g, " ").trim().slice(0, 40)}" is ${px(box)} and only ${px({ left, top, width: right - left, height: bottom - top })} shows`);
          }
          break;
        }
      }
    }
  }
  // A celebration is never a toast over the play screen: the result card lists it.
  const toast = document.querySelector(".toast-stack .toast");
  if (toast && isShown(toast) && /achievement|levelup/.test(toast.className)) issues.push(`a celebration toast is over the play screen ("${toast.textContent.trim().slice(0, 40)}")`);

  // 7. Targets are at least 44x44 (a ::before hit area counts, that is how the small tokens get theirs).
  const targetSelector = "#game-layout button, #game-layout a[href], #game-layout [role='button'], #game-layout input:not([type='hidden']), #game-layout select, #game-layout summary";
  document.querySelectorAll(targetSelector).forEach((el) => {
    if (!isShown(el) || el.closest(".sr-only") || el.closest("#board")) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return;
    let w = r.width;
    let h = r.height;
    const before = getComputedStyle(el, "::before");
    if (before && before.position === "absolute" && before.content !== "none") {
      w = Math.max(w, parseFloat(before.width) || 0);
      h = Math.max(h, parseFloat(before.height) || 0);
    }
    if (w < 43.5 || h < 43.5) issues.push(`target too small: ${describe(el)} is ${Math.round(w)}x${Math.round(h)}`);
  });

  // 8. No id is repeated; no raw text key is on screen.
  const seen = new Map();
  document.querySelectorAll("[id]").forEach((el) => seen.set(el.id, (seen.get(el.id) || 0) + 1));
  seen.forEach((count, id) => {
    if (count > 1) issues.push(`the id ${id} is repeated ${count} times`);
  });
  const shown = layout ? layout.innerText : "";
  const raw = shown.match(/\b(?:coach|play|game|result|core|evaluation|buttons|labels|scoring|analysis|insight)\.[a-z][\w]*(?:\.[\w]+)*\b/);
  if (raw) issues.push(`a raw text key is on screen: ${raw[0]}`);

  return {
    phase,
    issues,
    board: boardRect ? [Math.round(boardRect.left * 10) / 10, Math.round(boardRect.top * 10) / 10, Math.round(boardRect.width * 10) / 10, Math.round(boardRect.height * 10) / 10] : null,
    panel: isShown(panel) ? [Math.round(rectOf(panel).left), Math.round(rectOf(panel).top), Math.round(rectOf(panel).width), Math.round(rectOf(panel).height)] : null,
  };
}

// Tab stops: every one that shows a ring for the keyboard. Returns what was reached.
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
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const ringWidth = parseFloat(cs.outlineWidth) || 0;
      const outline = cs.outlineStyle !== "none" && ringWidth >= 2 && cs.outlineColor !== "rgba(0, 0, 0, 0)" && cs.outlineColor !== "transparent";
      const shadow = Boolean(cs.boxShadow) && cs.boxShadow !== "none";
      const name = el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}.${String(el.className || "").split(/\s+/).filter(Boolean).slice(0, 2).join(".")}`;
      return { name, tag: el.tagName, visibleRing: outline || shadow, focusVisible: el.matches(":focus-visible"), inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth };
    }, scopeSelector || "");
    if (info) stops.push(info);
  }
  return stops;
}

// Animations that are running right now (a paused or finished one does not count).
const motionProbe = (page) => page.evaluate(() => document.getAnimations()
  .filter((animation) => animation.playState === "running")
  .map((animation) => ({ name: animation.animationName || animation.transitionProperty || "?", target: animation.effect && animation.effect.target ? (animation.effect.target.id || String(animation.effect.target.className || animation.effect.target.tagName)).slice(0, 50) : "?" })));

let axeSource = null;
async function axeScan(ctx, label, options = {}) {
  // axe is injected as an inline script: only a context that bypasses the CSP can run it (the others enforce the CSP).
  if (!AXE_PATH || !ctx.bypassCSP) return;
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
}

// The layout probe of a state, its findings kept for the end of the scenario, its screenshot.
// `quiet: false` is for a state that does not last (the evaluating overlay is only up for 1.2 s and its progress bar never stops moving: waiting for
// it to be still would wait for the result instead).
async function inspect(ctx, label, options = {}) {
  if (options.quiet !== false) await quiet(ctx.page);
  const facts = await ctx.page.evaluate(layoutProbe, options);
  facts.issues.forEach((issue) => ctx.issues.push(`${ctx.tag} ${label}: ${issue}`));
  await shot(ctx.page, `${ctx.tag}-${label}`);
  if (options.axe !== false) await axeScan(ctx, label);
  return facts;
}

function sameRect(a, b, tolerance = 1.5) {
  return Boolean(a && b) && a.every((value, index) => Math.abs(value - b[index]) <= tolerance);
}

// ---------- scenario: regimes ----------

// One full round trip of a classic session at one viewport in one language.
async function regimeFlow(browser, vp, lang, axeMode) {
  const ctx = await open(browser, vp, { lang, tag: `${vp.name}-${lang}`, bypassCSP: axeMode });
  const { page } = ctx;
  try {
    await collectEvents(page);
    const positions = await startClassic(page, { count: 2, options: { clock: { mode: "untimed" } } });
    await waitPhase(page, "thinking");
    await settle(page);

    const thinking = await inspect(ctx, "1-thinking");
    assert.ok(thinking.board, "the board is there");
    // The header says where you are, in the language of the page.
    const position = await textOf(page, "#round-status");
    assert.match(position, lang === "es" ? /Posición 1 de 2/ : /Position 1 of 2/, position);
    assert.strictEqual(await page.locator("#session-dots li").count(), 2, "one dot per position");
    assert.ok((await textOf(page, "#hint-btn-label")).includes("15"), "the hint button says what it costs");

    // A hint: the piece is marked, the words follow, the layout does not move.
    await page.locator("#hint-btn").click();
    await settle(page, 200);
    assert.strictEqual(await page.locator("#board .square.hint-from").count(), 1, "the hint marks a piece");
    const hinted = await inspect(ctx, "2-hint", { axe: false });
    assert.ok(sameRect(thinking.board, hinted.board), `a hint moved the board: ${thinking.board} -> ${hinted.board}`);

    // A move the engine has to search: the evaluating state keeps the shape of the result.
    await playUci(page, await weakMove(page));
    await waitPhase(page, "evaluating");
    await settle(page, 250);
    const evaluating = await inspect(ctx, "3-evaluating", { quiet: false });
    assert.strictEqual(await page.locator("#round-result [aria-busy='true'], #coach-thinking [aria-busy='true'], .co-hero-pending").count() > 0, true, "the evaluating state is announced as busy");
    assert.ok(sameRect(thinking.board, evaluating.board), `evaluating moved the board: ${thinking.board} -> ${evaluating.board}`);

    await waitResult(page);
    await settle(page, 700);
    const result = await inspect(ctx, "4-result");
    assert.ok(sameRect(thinking.board, result.board), `the result moved the board: ${thinking.board} -> ${result.board}`);
    assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("co-hero-title")), true, "the verdict takes the focus");
    const verdict = await textOf(page, ".co-hero-verdict");
    assert.ok(verdict.length > 10, "a verdict in words");
    assert.ok((await page.locator(".co-cmp-row").count()) >= 2, "your move and the best one are compared");
    assert.ok((await page.locator(".co-line").count()) >= 2, "the engine's lines are offered");
    assert.strictEqual(await page.locator("#next-btn").isEnabled(), true, "the next position can be asked for");

    // The panel is its own scroll region: its end is reachable and the primary button stays on screen.
    await page.evaluate(() => {
      document.querySelector("#coach-scroll").scrollTop = 99999;
    });
    await settle(page, 200);
    await inspect(ctx, "5-result-bottom", { axe: false });

    // On a phone the panel is a sheet that opens over the board and closes again.
    if (await page.locator("#coach-expand").isVisible()) {
      await page.locator("#coach-expand").click();
      await settle(page, 300);
      assert.strictEqual(await page.locator("#game-layout").getAttribute("data-expanded"), "true");
      assert.strictEqual(await page.locator("#coach-expand").getAttribute("aria-expanded"), "true");
      await inspect(ctx, "6-expanded", { axe: false });
      await page.locator("#coach-expand").click();
      await settle(page, 300);
      assert.strictEqual(await page.locator("#coach-expand").getAttribute("aria-expanded"), "false");
    }

    // Position 2: the best move is worth ten and the header keeps count.
    await page.locator("#next-btn").click();
    await waitPhase(page, "thinking");
    await settle(page, 300);
    assert.match(await textOf(page, "#round-status"), lang === "es" ? /Posición 2 de 2/ : /Position 2 of 2/);
    assert.ok(sameRect(thinking.board, (await inspect(ctx, "7-thinking2", { axe: false })).board), "the board is where it was for the second position");
    await playUci(page, positions[1].reference.lines[0].uci);
    await waitResult(page);
    await settle(page, 600);
    await inspect(ctx, "8-result-best", { axe: false });
    assert.strictEqual(await page.locator(".co-hero").first().getAttribute("data-q") !== null, true);

    // The summary.
    await page.locator("#next-btn").click();
    await waitPhase(page, "summary");
    await settle(page, 700);
    await inspect(ctx, "9-summary");
    assert.ok((await page.locator(".co-pos").count()) === 2, "both positions can be reopened");
    assert.strictEqual(await page.evaluate(() => Ludus.game.isActive()), false, "a finished session is no longer in progress");
    await page.locator(".co-pos").nth(0).click();
    await waitPhase(page, "result");
    await settle(page, 500);
    assert.strictEqual(await page.locator("#round-result .co-hero").isVisible(), true, "the panel shows the analysis of the position that was opened");
    assert.strictEqual(await page.locator("#session-summary-result").isVisible(), false, "not the summary");
    assert.match(await textOf(page, "#round-status"), lang === "es" ? /Posici\u00F3n 1 de 2/ : /Position 1 of 2/, "the header is on that position");
    await inspect(ctx, "10-reopened", { axe: false });
    await page.locator("#next-btn").click();
    await waitPhase(page, "summary");
    assert.ok((await page.locator("#summary-again-btn").isVisible()) && (await page.locator("#summary-menu-btn").isVisible()), "the summary offers play again and home");

    const log = await events(page);
    assert.strictEqual(log.rounds.length, 2, "two rounds were announced");
    assert.strictEqual(log.completed.length, 1, "one session record");
    checkProblems(ctx.tag, ctx.problems);
  } finally {
    await ctx.context.close();
  }
  return ctx.issues;
}

async function regimesScenario(browser) {
  console.log("scenario: regimes");
  const viewports = viewportsFromEnv();
  const jobs = [];
  viewports.forEach((vp) => ["es", "en"].forEach((lang) => jobs.push({ vp, lang })));
  const issues = [];
  // Two at a time: every page runs its own engine worker.
  for (let i = 0; i < jobs.length; i += 2) {
    const batch = jobs.slice(i, i + 2);
    const results = await Promise.all(batch.map(({ vp, lang }) => regimeFlow(browser, vp, lang, false).then((found) => ({ vp, lang, found }), (error) => {
      error.message = `${vp.name}-${lang}: ${error.message}`;
      throw error;
    })));
    results.forEach(({ vp, lang, found }) => {
      step(`${vp.w}x${vp.h} ${lang}: ${found.length ? `${found.length} finding(s)` : "clean"}`);
      issues.push(...found);
    });
  }
  checkIssues("regimes", issues);
}

// ---------- scenario: classic ----------

async function classicScenario(browser) {
  console.log("scenario: the long path (classic, 1280x800)");
  const ctx = await open(browser, { name: "laptop-1280", w: 1280, h: 800, touch: false }, { lang: "en", tag: "classic" });
  const { page, context } = ctx;
  try {
    await collectEvents(page);
    const positions = await startClassic(page, { count: 3, options: { clock: { mode: "untimed" } } });
    await waitPhase(page, "thinking");
    await settle(page);

    step("thinking: the header, the dots and the card of the position");
    assert.strictEqual((await textOf(page, "#solo-clock-value")), "∞", "an untimed session shows the infinity sign");
    assert.strictEqual(await page.locator("#solo-clock-rail").evaluate((el) => el.classList.contains("is-untimed")), true);
    assert.deepStrictEqual(await page.locator("#session-dots li").evaluateAll((items) => items.map((item) => item.dataset.state)), ["current", "todo", "todo"]);
    assert.strictEqual(await page.locator("#play-score-value").textContent(), "0");
    assert.ok(await page.locator("#coach-thinking .co-ctx").isVisible(), "the card of the position");
    assert.ok(await page.locator("#coach-thinking .co-goal").isVisible(), "and what to do");
    assert.strictEqual(await page.locator("#next-btn").isDisabled(), true, "nothing to go on to yet");
    assert.strictEqual(await page.locator("#reveal-best-btn").isVisible(), false, "the result tools wait for the result");
    assert.strictEqual(await page.locator("#skip-btn").isVisible(), true);
    await inspect(ctx, "thinking");

    step("keyboard: H asks for a hint, the button says what the next one costs, the panel says it in words");
    await page.locator("#board").focus().catch(() => {});
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press("h");
    assert.strictEqual(await page.locator("#board .square.hint-from").count(), 1, "the H key gave the first hint");
    assert.ok((await textOf(page, "#hint-btn-label")).includes("35"), await textOf(page, "#hint-btn-label"));
    // The announcement is written a beat after the key (the region is cleared first, so a repeated sentence is read again).
    await page.waitForFunction(() => document.querySelector("#hint-announce").textContent.trim().length > 0, null, { timeout: 3000 });
    assert.ok((await textOf(page, "#hint-announce")).includes(positions[0].reference.lines[0].uci.slice(0, 2)), "announced in words (the hint has a live region of its own)");
    // Two hints in a row need a beat between them (a double tap must not reveal the move): the second is a deliberate tap.
    await page.waitForTimeout(600);
    await page.locator("#hint-btn").click();
    assert.strictEqual(await page.locator("#board .square.hint-to").count(), 1, "the second hint marks the destination");
    assert.ok((await textOf(page, "#hint-btn-label")).includes("0"), "the last one warns that it gives the move away");

    step("a weak move: evaluating keeps the same shape, then the verdict takes the focus");
    await playUci(page, await weakMove(page));
    await waitPhase(page, "evaluating");
    assert.strictEqual(await page.locator("#hint-btn").isDisabled(), true, "no hint while it is evaluated");
    assert.strictEqual(await page.locator("#skip-btn").isDisabled(), true);
    assert.ok((await page.locator("#coach-thinking .co-hero-pending, #round-result .co-hero-pending, .co-skel").count()) >= 1, "skeletons hold the place of the result");
    await inspect(ctx, "evaluating", { quiet: false });
    await waitResult(page);
    await settle(page, 700);
    const weak = await page.evaluate(() => JSON.parse(JSON.stringify(STATE.resultView.context)));
    assert.notStrictEqual(weak.assessment.qualityCode, "perfect");
    assert.strictEqual(weak.hintsUsed, 2);
    assert.strictEqual(await page.evaluate(() => document.activeElement.classList.contains("co-hero-title")), true);
    assert.ok((await textOf(page, ".co-hero-title")).length > 2);
    assert.ok((await textOf(page, ".co-hero .co-chips")).match(/hint|Hint|35/i), "the chip says a hint was used");
    assert.ok((await page.locator(".co-cmp-row").count()) >= 2);
    assert.ok((await textOf(page, "#result-overlay-points")).match(/^You earned \d/), "the live region reads the points");
    assert.ok(["hit", "miss"].includes((await page.locator("#session-dots li").evaluateAll((items) => items.map((item) => item.dataset.state)))[0]), "the first dot is an answer now");
    assert.ok(Number(await page.locator("#play-score-value").textContent()) === weak.assessment.points, "the header score follows");
    assert.strictEqual(await page.locator("#skip-btn").isVisible(), false, "the dock switched to the result tools");
    assert.strictEqual(await page.locator("#reveal-best-btn").isVisible(), true);
    assert.strictEqual(await page.locator("#next-btn").isEnabled(), true);
    await inspect(ctx, "result-weak");

    step("the engine lines: one move at a time, and the board follows");
    const signature = () => page.evaluate(() => JSON.stringify(STATE.board.board));
    const startSignature = await signature();
    const firstLine = page.locator(".co-line").first();
    await firstLine.scrollIntoViewIfNeeded();
    await firstLine.click();
    await settle(page, 200);
    assert.strictEqual(await firstLine.getAttribute("aria-pressed"), "true");
    assert.strictEqual(await page.evaluate(() => STATE.resultView.pv.line), 0);
    assert.strictEqual(await page.evaluate(() => STATE.resultView.pv.ply), 1);
    assert.notStrictEqual(await signature(), startSignature, "the first move of the line is on the board");
    const stepper = page.locator(".co-stepper:not([hidden])").first();
    assert.ok(await stepper.isVisible(), "the stepper opens under the line");
    await stepper.locator(".co-step-btn").nth(2).click();
    assert.strictEqual(await page.evaluate(() => STATE.resultView.pv.ply), 2, "next");
    await stepper.locator(".co-step-btn").nth(3).click();
    assert.ok((await page.evaluate(() => STATE.resultView.pv.ply)) >= 2, "last");
    assert.strictEqual(await stepper.locator(".co-step-btn").nth(2).isDisabled(), true, "nothing after the end");
    await stepper.locator(".co-tok").nth(0).click();
    assert.strictEqual(await page.evaluate(() => STATE.resultView.pv.ply), 1, "a move of the line is a button");
    await inspect(ctx, "stepper");
    await stepper.locator(".co-step-btn").nth(0).click();
    assert.strictEqual(await page.evaluate(() => STATE.resultView.pv.ply), 0);
    assert.strictEqual(await signature(), startSignature, "the first button goes back to the position");
    await page.locator(".co-line").nth(1).click();
    assert.strictEqual(await page.locator(".co-line").nth(0).getAttribute("aria-pressed"), "false", "another line takes over");

    step("the language switch redraws the result and keeps the line that is open");
    const englishTitle = await textOf(page, ".co-hero-title");
    await page.evaluate(() => Ludus.i18n.setLanguage("es"));
    await settle(page, 200);
    assert.notStrictEqual(await textOf(page, ".co-hero-title"), englishTitle, "the verdict is in Spanish now");
    assert.strictEqual(await page.locator(".co-line").nth(1).getAttribute("aria-pressed"), "true", "the open line stays open");
    assert.match(await textOf(page, "#round-status"), /Posición 1 de 3/);
    assert.match(await textOf(page, "#next-btn-label"), /Siguiente|Ver|Terminar/);
    await inspect(ctx, "result-es", { axe: false });
    await page.evaluate(() => Ludus.i18n.setLanguage("en"));
    await settle(page, 200);
    assert.strictEqual(await textOf(page, ".co-hero-title"), englishTitle);

    step("exploring the board: the E key, the best move on demand, the way back");
    await page.locator(".co-line").nth(1).click();
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press("e");
    assert.strictEqual(await page.evaluate(() => STATE.resultView.analysisMode), true, "E explores the board");
    await page.locator(".co-line").nth(0).click();
    assert.notStrictEqual(await signature(), startSignature, "a line is on the board");
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press("e");
    assert.strictEqual(await signature(), startSignature, "a second E puts the position back");
    await page.locator("#reveal-best-btn").click();
    assert.strictEqual(await page.locator("#reveal-best-btn").getAttribute("aria-pressed"), "true");
    assert.ok((await page.locator("#board-arrows line, #board-arrows path").count()) >= 1, "the arrow of the best move");
    await page.locator("#reveal-best-btn").click();
    assert.strictEqual(await page.locator("#reveal-best-btn").getAttribute("aria-pressed"), "false");

    step("a concept opens as a dialog and gives the focus back");
    const chips = page.locator(".co-concept");
    if ((await chips.count()) > 0) {
      await chips.first().scrollIntoViewIfNeeded();
      await chips.first().click();
      await page.locator(".modal-backdrop .modal").first().waitFor({ state: "visible" });
      await inspect(ctx, "concept");
      await page.keyboard.press("Escape");
      await page.locator(".modal-backdrop .modal").first().waitFor({ state: "detached", timeout: 3000 }).catch(() => {});
      assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("co-concept")), true, "the focus is back on the chip");
    } else {
      step("(this position brings no concept chip: the dialog is covered by tests/coach.test.js)");
    }

    step("position 2: a skip, said in words; dots and score follow");
    await page.locator("#next-btn").click();
    await waitPhase(page, "thinking");
    // A skip is the one tap that throws a position away: the first arms it (the button asks), the second confirms.
    await page.locator("#skip-btn").click();
    await page.waitForTimeout(150);
    if ((await phaseOf(page)) === "thinking") await page.locator("#skip-btn").click();
    await waitResult(page);
    await settle(page, 500);
    assert.strictEqual(await page.locator(".co-hero").first().getAttribute("data-q"), "no_move");
    assert.match(await textOf(page, ".co-hero-verdict"), /skip|Skip|did not play|move/i);
    assert.match(await textOf(page, "#result-overlay-points"), /0 pts/);
    assert.strictEqual((await page.locator("#session-dots li").evaluateAll((items) => items.map((item) => item.dataset.state)))[1], "none", "a skipped position is a dot of its own");
    await inspect(ctx, "skip");

    step("position 3: the best move, the rewards, and the end");
    await page.locator("#next-btn").click();
    await waitPhase(page, "thinking");
    await playUci(page, positions[2].reference.lines[0].uci);
    await waitResult(page);
    await settle(page, 700);
    assert.ok(["perfect", "great", "brilliant"].includes(await page.locator(".co-hero").first().getAttribute("data-q")));
    assert.ok((await textOf(page, ".co-hero .co-chips")).match(/XP/), "the XP earned");
    assert.ok(await page.locator(".co-rewards").count() >= 1, "the progress card");
    assert.match(await textOf(page, "#next-btn-label"), /Finish|See|summary|result/i, "the last position says it ends the session");
    await page.locator("#next-btn").click();
    await waitPhase(page, "summary");
    await settle(page, 800);

    step("the summary: numbers, mix of answers, positions that reopen, actions");
    assert.strictEqual(await page.evaluate(() => Ludus.game.isActive()), false);
    assert.match(await textOf(page, ".co-sum-stats"), /\/ 30/);
    assert.ok((await page.locator(".co-seg-part").count()) >= 2, "the mix of answers");
    assert.strictEqual(await page.locator(".co-pos").count(), 3);
    assert.ok(await page.locator("#summary-again-btn").isVisible());
    assert.ok(await page.locator("#summary-share-btn").isVisible());
    assert.strictEqual(await page.locator("#next-btn").isVisible(), false, "the summary has actions instead of a next button");
    assert.strictEqual(await page.locator("#solo-clock-rail").isVisible(), false, "and no clock");
    assert.strictEqual(await page.evaluate(() => document.activeElement.classList.contains("co-sum-title")), true, "the summary takes the focus");
    await inspect(ctx, "summary");
    await page.locator(".co-pos").nth(1).click();
    await waitPhase(page, "result");
    assert.match(await textOf(page, "#next-btn-label"), /summary|Back/i, "next becomes back to the summary");
    assert.match(await textOf(page, "#round-status"), /Position 2 of 3/, "the header is on the position that was opened");
    assert.strictEqual(await page.locator("#round-result .co-hero").isVisible(), true, "the panel shows its analysis");
    assert.strictEqual(await page.locator("#session-summary-result").isVisible(), false, "and not the summary");
    assert.match(await textOf(page, "#round-status"), /Position 2/);
    await inspect(ctx, "reopened", { axe: false });
    await page.locator("#next-btn").click();
    await waitPhase(page, "summary");

    step("share: the text of the summary reaches the clipboard and a toast says so");
    await page.evaluate(() => {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
      Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text) => { window.__copied = text; } }, configurable: true });
    });
    await page.locator("#summary-share-btn").click();
    await page.waitForFunction(() => Boolean(window.__copied));
    const copied = await page.evaluate(() => window.__copied);
    assert.match(copied, /^Ludus Scaccorum\n/);
    assert.match(copied, /\/ 30/);
    assert.ok((await page.locator(".toast").count()) >= 1, "a toast says it was copied");

    step("play again: new positions, same session shape");
    await page.locator("#summary-again-btn").click();
    await waitPhase(page, "thinking");
    assert.match(await textOf(page, "#round-status"), /Posición 1 de 3|Position 1 of 3/);
    assert.strictEqual((await events(page)).started.length, 2);

    step("leaving a running session asks first: the address bar, then the exit button");
    await page.evaluate(() => {
      window.location.hash = "#/settings";
    });
    // The question is the page's own confirmation dialog (the same one the exit button asks).
    const dialog = page.locator("#consent-overlay");
    await dialog.waitFor({ state: "visible" });
    assert.strictEqual(await dialog.getAttribute("role"), "alertdialog");
    await inspect(ctx, "leave-dialog");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: 3000 });
    assert.strictEqual(await evalState(page, "Ludus.router.current()"), "game", "a no keeps the session");
    assert.strictEqual(await evalState(page, "Ludus.game.isActive()"), true);
    await page.waitForFunction(() => window.location.hash === "", null, { timeout: 3000 });
    await page.locator("#restart-btn").click();
    await dialog.waitFor({ state: "visible" });
    await page.locator("#consent-overlay-accept").click();
    await page.waitForFunction(() => Ludus.router.current() === "home", null, { timeout: 5000 });
    assert.strictEqual((await events(page)).completed.length, 1, "leaving early does not record a second session");

    step("no console errors, page errors or failed requests");
    checkProblems("classic", ctx.problems);
    checkIssues("classic", ctx.issues);
  } finally {
    await context.close();
  }
}

// ---------- scenario: duel ----------

async function duelFlow(browser, vp) {
  const ctx = await open(browser, vp, { lang: "en", tag: `duel-${vp.name}` });
  const { page, context } = ctx;
  try {
    await collectEvents(page);
    const positions = await startClassic(page, { count: 2, mode: "duel", names: ["Ana", "Beto"], options: { clock: { mode: "untimed" } } });
    await waitPhase(page, "handoff");
    await settle(page, 300);

    step(`${vp.w}x${vp.h}: position 1 starts covered too: who goes first, where the device goes, and no clock yet`);
    assert.strictEqual(await page.locator("#handoff-overlay").isVisible(), true, "a cover before position 1");
    assert.ok((await textOf(page, "#handoff-overlay-title")).includes("Ana"), "it names who goes first");
    assert.match(await textOf(page, "#handoff-overlay-subtitle"), /Pass the device to Ana/, "and says where the device goes");
    assert.strictEqual(await textOf(page, "#handoff-overlay-eyebrow"), "Position 1 of 2");
    assert.ok(!(await textOf(page, "#handoff-overlay-eyebrow")).includes("has played"), "nobody has played yet");
    assert.strictEqual(await evalState(page, "document.activeElement && document.activeElement.id"), "handoff-overlay", "the focus is on the cover");
    assert.strictEqual(await evalState(page, "Boolean(STATE.roundStartedAt)"), false, "no clock behind the cover");
    await inspect(ctx, "0-ready", { axe: false });
    await page.keyboard.press("Enter"); // the cover is a button: Enter (or Space) starts the clock the way a tap does
    await waitPhase(page, "thinking");
    assert.strictEqual(await evalState(page, "Boolean(STATE.roundStartedAt)"), true, "the keyboard started the round");
    await settle(page);

    step(`${vp.w}x${vp.h}: the scoreboard names both players and whose turn it is`);
    assert.strictEqual(await page.locator("#duel-score").isVisible(), true);
    assert.strictEqual(await page.locator("#play-score").isVisible(), false, "no solo score in a duel");
    assert.ok((await textOf(page, "#duel-a-name")).includes("Ana") && (await textOf(page, "#duel-b-name")).includes("Beto"));
    assert.strictEqual(await page.locator("#duel-a").getAttribute("aria-current"), "true");
    assert.strictEqual(await page.locator("#duel-b").getAttribute("aria-current"), null);
    assert.ok((await textOf(page, "#coach-thinking .co-turnbanner")).includes("Ana"), "the panel says it is Ana's turn");
    await inspect(ctx, "1-p1");

    step(`${vp.w}x${vp.h}: the handoff hides the first answer`);
    await playUci(page, positions[0].reference.lines[0].uci);
    await waitPhase(page, "handoff");
    await settle(page, 400);
    assert.strictEqual(await page.locator("#handoff-overlay").isVisible(), true);
    assert.strictEqual(await page.locator("#round-result").evaluate((el) => el.textContent.trim()), "", "nothing of the first answer is on screen");
    assert.strictEqual(await page.locator("#result-overlay").isVisible(), false);
    assert.ok((await textOf(page, "#handoff-overlay")).includes("Beto"), "the handoff names the next player");
    await inspect(ctx, "2-handoff");
    await page.locator("#handoff-overlay").click();
    await waitPhase(page, "thinking");
    await settle(page, 300);
    assert.strictEqual(await page.locator("#duel-b").getAttribute("aria-current"), "true", "the scoreboard follows the turn");
    assert.ok((await textOf(page, "#coach-thinking .co-turnbanner")).includes("Beto"));
    await inspect(ctx, "3-p2", { axe: false });

    step(`${vp.w}x${vp.h}: a weak move by the second player; one analysis names the winner`);
    await playUci(page, await weakMove(page));
    await waitResult(page);
    await settle(page, 800);
    assert.ok((await textOf(page, ".co-duel-banner")).includes("Ana"), "Ana wins the round");
    assert.strictEqual(await page.locator(".co-player").count(), 2);
    assert.strictEqual(await page.locator(".co-player.is-winner").count(), 1);
    assert.ok((await page.locator(".co-line").count()) >= 2, "one shared analysis");
    assert.match(await textOf(page, "#result-overlay-points"), /^R1: Ana 10 · Beto \d/);
    assert.match(await textOf(page, "#duel-a-score"), /^10$/);
    await inspect(ctx, "4-result");

    step(`${vp.w}x${vp.h}: the second position starts covered: the first player's clock waits for a tap`);
    await page.locator("#next-btn").click();
    await waitPhase(page, "handoff");
    await settle(page, 300);
    assert.strictEqual(await page.locator("#handoff-overlay").isVisible(), true, "a cover on the new position");
    // The players take turns going first (PF-2): position 2 starts with the second player.
    assert.ok((await textOf(page, "#handoff-overlay-title")).includes("Beto"), "it names whose turn it is: Beto goes first this time");
    assert.ok(!(await textOf(page, "#handoff-overlay-eyebrow")).includes("has played"), "and is not the handoff of a player who has moved");
    assert.strictEqual(await page.locator("#duel-b").getAttribute("aria-current"), "true");
    assert.strictEqual(await page.locator("#duel-a").getAttribute("aria-current"), null);
    const started = await evalState(page, "STATE.roundStartedAt");
    // (A real touch lands on the cover, which is the tap that starts the round: the board is asked directly.)
    await page.evaluate(() => onSquareClick("e2"));
    assert.strictEqual(await evalState(page, "Boolean(STATE.selection)"), false, "the covered board ignores the touch");
    assert.strictEqual(await page.locator("#hint-btn").isDisabled(), true, "no hint while covered");
    await inspect(ctx, "4b-ready", { axe: false });
    await page.waitForTimeout(150);
    await page.locator("#handoff-overlay").click();
    await waitPhase(page, "thinking");
    assert.ok((await evalState(page, "STATE.roundStartedAt")) > started, "the tap starts the round");
    assert.ok((await textOf(page, "#coach-thinking .co-turnbanner")).includes("Beto"), "the panel says it is Beto's turn");
    await playUci(page, positions[1].reference.lines[0].uci);
    await waitPhase(page, "handoff");
    assert.ok((await textOf(page, "#handoff-overlay-title")).includes("Ana"), "the device goes to Ana after Beto");
    assert.ok((await textOf(page, "#handoff-overlay-eyebrow")).includes("Beto"), "and the cover says Beto has played");
    await page.locator("#handoff-overlay").click();
    await waitPhase(page, "thinking");
    assert.ok((await textOf(page, "#coach-thinking .co-turnbanner")).includes("Ana"));
    await playUci(page, positions[1].reference.lines[0].uci);
    await waitResult(page);
    await settle(page, 600);
    assert.strictEqual(await page.locator(".co-duel-banner.is-tie").count(), 1, "the same move is a tie");
    await page.locator("#next-btn").click();
    await waitPhase(page, "summary");
    await settle(page, 800);
    assert.ok((await textOf(page, ".co-sum-title")).includes("Ana"), "the headline is the winner");
    assert.strictEqual(await page.locator(".co-sum-duelist").count(), 2);
    assert.strictEqual(await page.locator(".co-sum-rewards").count(), 0, "a duel is nobody's progress");
    assert.strictEqual(await page.locator(".co-breakdown").count(), 0, "no merged mix of two people's moves");
    assert.ok(!/points/i.test(await textOf(page, ".co-sum-hero")), "no merged points over two people");
    assert.strictEqual(await page.locator(".toast").count(), 0, "no toast over the summary");
    assert.strictEqual(await page.locator("#play-header .co-duel").isVisible(), false, "the header scoreboard would repeat the cards");
    assert.match(await textOf(page, "#summary-again-btn"), /Rematch/i);
    await inspect(ctx, "5-summary");
    await page.locator("#summary-again-btn").click();
    // A rematch starts covered like any duel, with the first player again.
    await waitPhase(page, "handoff");
    assert.ok((await textOf(page, "#handoff-overlay-title")).includes("Ana"), "the rematch starts with Ana");
    await page.locator("#handoff-overlay").click();
    await waitPhase(page, "thinking");
    // A rematch is the same duel (mode, names, number of positions); the positions themselves are drawn again (UX-021).
    const same = await page.evaluate(() => STATE.positions.length === 2 && STATE.session.mode === "duel" && STATE.session.names[0] === "Ana" && STATE.session.names[1] === "Beto");
    assert.strictEqual(same, true, "a rematch is a new duel of the same length with the same names");
    await page.evaluate(() => Ludus.game.abort());

    checkProblems(`duel ${vp.name}`, ctx.problems);
  } finally {
    await context.close();
  }
  return ctx.issues;
}

async function duelScenario(browser) {
  console.log("scenario: duel");
  const issues = [];
  for (const vp of [{ name: "laptop-1280", w: 1280, h: 800, touch: false }, { name: "phone-390", w: 390, h: 844, touch: true }, { name: "phone-land-844", w: 844, h: 390, touch: true }]) {
    issues.push(...await duelFlow(browser, vp));
  }
  checkIssues("duel", issues);
}

// ---------- scenario: clock ----------

async function clockScenario(browser) {
  console.log("scenario: the clock");
  const ctx = await open(browser, { name: "laptop-1280", w: 1280, h: 800, touch: false }, { lang: "en", tag: "clock" });
  const { page, context } = ctx;
  try {
    await collectEvents(page);
    step("a 5 second clock counts down, warns, and runs out for real");
    await startClassic(page, { count: 2, options: { clock: { mode: "timed", seconds: 5 }, hints: false } });
    await waitPhase(page, "thinking");
    assert.strictEqual(await page.locator("#hint-btn").isVisible(), false, "the session turned hints off");
    assert.match(await textOf(page, "#solo-clock-value"), /^00:0\d$/);
    await inspect(ctx, "counting");
    await waitResult(page);
    await settle(page, 600);
    assert.strictEqual(await page.locator(".co-hero").first().getAttribute("data-q"), "no_move");
    assert.match(await textOf(page, ".co-hero-verdict"), /time|Time/i, "the verdict says the time ran out");
    assert.match(await textOf(page, "#result-overlay-points"), /^Time ran out: 0 pts\.$/);
    assert.ok(await page.locator(".co-hero .co-chip, .co-hero .chip").count() >= 1, "a chip says so too");
    assert.strictEqual(await page.locator("#solo-clock-rail").evaluate((el) => el.classList.contains("is-stopped")), true, "the clock stops with the result");
    const round = (await events(page)).rounds.pop();
    assert.strictEqual(round.timedOut, true);
    assert.strictEqual(round.points, 0);
    await inspect(ctx, "timeout");
    await page.evaluate(() => Ludus.game.abort());

    step("an untimed session never runs out");
    await startClassic(page, { count: 1, options: { clock: { mode: "untimed" } } });
    await waitPhase(page, "thinking");
    await page.waitForTimeout(1800);
    assert.strictEqual(await phaseOf(page), "thinking");
    assert.strictEqual(await textOf(page, "#solo-clock-value"), "∞");
    await page.evaluate(() => Ludus.game.abort());
    checkProblems("clock", ctx.problems);
    checkIssues("clock", ctx.issues);
  } finally {
    await context.close();
  }
}

// ---------- scenario: own games ----------

// Games in which TestUser errs badly, so the mistake search always finds something. Sixteen copies
// (different events) so that no fallback download is asked for.
function buildPgn() {
  const bodies = [
    ["Rival", "TestUser", "1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0"],
    ["TestUser", "Rival", "1. f3 e5 2. g4 Qh4# 0-1"],
    ["TestUser", "Rival", "1. e4 e5 2. Qh5 Nc6 3. Qxe5+ Nxe5 4. d4 Nc6 5. d5 Nb8 6. Nc3 Nf6 0-1"],
    ["Rival", "TestUser", "1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0"],
  ];
  const games = [];
  for (let copy = 0; copy < 4; copy += 1) {
    bodies.forEach(([white, black, moves], index) => {
      const result = moves.slice(moves.lastIndexOf(" ") + 1);
      games.push([
        `[Event "E2E ${copy * 4 + index + 1}"]`, '[Site "https://lichess.org/e2e"]', '[Date "2024.05.05"]', '[Round "-"]',
        `[White "${white}"]`, `[Black "${black}"]`, `[Result "${result}"]`, '[TimeControl "600+0"]', "", moves, "",
      ].join("\n"));
    });
  }
  return `${games.join("\n")}\n`;
}

async function ownFlow(browser, vp) {
  // With axe on, the context bypasses the CSP (axe is injected as a script); otherwise it is enforced.
  const ctx = await open(browser, vp, { lang: "en", tag: `own-${vp.name}`, bypassCSP: Boolean(AXE_PATH) });
  const { page, context } = ctx;
  try {
    await context.route("https://lichess.org/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/x-chess-pgn", body: buildPgn() });
    });
    await context.route("https://api.chess.com/**", (route) => route.abort());
    await collectEvents(page);
    await page.evaluate(() => Ludus.game.openOwnGamesSetup({ mode: "solo" }));
    await page.locator("#online-user-input").fill("TestUser");
    await page.locator("#wizard-next-btn").click();
    await page.locator("#session-size").fill("2");
    await page.locator("#session-size").dispatchEvent("input");
    await page.locator("#analyze-btn").click();
    await page.locator("#consent-overlay-username-input").fill("TestUser");
    await page.locator("#consent-overlay-accept").click();
    await page.waitForFunction(() => Ludus.router.current() === "game", null, { timeout: 120000 });
    await waitPhase(page, "thinking");
    await settle(page);

    step(`${vp.w}x${vp.h}: the card of an own game links to its game, safely`);
    const link = page.locator("#coach-thinking .co-ctx-link");
    assert.strictEqual(await link.count(), 1, "a Site tag on lichess.org is a link");
    assert.strictEqual(await link.getAttribute("href"), "https://lichess.org/e2e");
    assert.match(await link.getAttribute("rel"), /noopener/);
    assert.strictEqual(await link.getAttribute("target"), "_blank");
    assert.strictEqual(await page.locator("#coach-thinking .co-ctx-mover").count(), 0, "no master's name on your own game");
    await inspect(ctx, "1-thinking");
    // The waiting overlay in its fullest state (a cancellable search, with progress and a story), put up
    // directly: the real search is often over before a script can look at it (play-session.js follows it).
    step(`${vp.w}x${vp.h}: the waiting overlay sits on the board, its way out in reach`);
    await page.evaluate(() => {
      showPositionSearchOverlay("Searching next position...", "TestUser vs Rival \u00B7 1-0 \u00B7 move 12 \u00B7 2024", {
        cancellable: true, facts: true, showProgress: true, progressRatio: 0.4, progressLabel: "12 / 30", factsDelayMs: 0,
      });
    });
    await page.locator("#position-search-cancel-btn").waitFor({ state: "visible", timeout: 5000 });
    await settle(page, 500);
    const facts = await page.evaluate(() => {
      const cancel = document.querySelector("#position-search-cancel-btn").getBoundingClientRect();
      const overlayRect = document.querySelector("#position-search-overlay").getBoundingClientRect();
      const wrap = document.querySelector(".board-wrap").getBoundingClientRect();
      const card = document.querySelector(".co-search-card").getBoundingClientRect();
      const storyEl = document.querySelector("#position-search-facts");
      return {
        inside: overlayRect.left >= wrap.left - 1 && overlayRect.right <= wrap.right + 1 && overlayRect.top >= wrap.top - 1 && overlayRect.bottom <= wrap.bottom + 1,
        // The way out is on the card, on the board and on the screen, whatever the size of the board.
        cancelReachable: cancel.top >= card.top - 1 && cancel.bottom <= card.bottom + 1 && cancel.bottom <= overlayRect.bottom + 1 && cancel.bottom <= innerHeight && cancel.top >= 0,
        cancelH: cancel.height,
        cancelW: cancel.width,
        storyShown: storyEl.getBoundingClientRect().height > 0,
        boardHeight: wrap.height,
        detail: JSON.stringify({ overlay: [overlayRect.top, overlayRect.bottom], wrap: [wrap.top, wrap.bottom], card: [card.top, card.bottom], cancel: [cancel.top, cancel.bottom] }),
      };
    });
    assert.strictEqual(facts.inside, true, `the overlay stays on the board (${facts.detail})`);
    assert.strictEqual(facts.cancelReachable, true, `the cancel button is on the card, on the board and on the screen (${facts.detail})`);
    assert.ok(facts.cancelH >= 43.5 && facts.cancelW >= 43.5, `the cancel button is a real target (${facts.cancelW}x${facts.cancelH})`);
    // A big board tells a story while it waits; a small one keeps to what is happening.
    assert.strictEqual(facts.storyShown, facts.boardHeight > 545, `the story is shown only on a board taller than 545px (board ${facts.boardHeight}px, story ${facts.storyShown})`);
    await inspect(ctx, "3-searching", { axe: true, quiet: false });
    await page.evaluate(() => hidePositionSearchOverlay());
    await page.locator("#position-search-overlay").waitFor({ state: "hidden", timeout: 5000 });

    await playUci(page, await page.evaluate(() => STATE.positions[0].bestMoveUci));
    await waitResult(page);
    await settle(page, 700);
    assert.match(await textOf(page, ".co-hero-verdict"), /.{10}/);
    await inspect(ctx, "2-result");
    await page.locator("#next-btn").click();
    await page.waitForFunction(() => STATE.index === 1 && STATE.ui.phase === "playing", null, { timeout: 120000 });
    await page.evaluate(() => Ludus.game.abort());
    checkProblems(`own ${vp.name}`, ctx.problems);
  } finally {
    await context.close();
  }
  return ctx.issues;
}

async function ownScenario(browser) {
  console.log("scenario: own games");
  const issues = [];
  for (const vp of [{ name: "laptop-1280", w: 1280, h: 800, touch: false }, { name: "phone-390", w: 390, h: 844, touch: true }, { name: "phone-land-844", w: 844, h: 390, touch: true }]) {
    issues.push(...await ownFlow(browser, vp));
  }
  checkIssues("own games", issues);
}

// ---------- scenario: motion ----------

async function motionRun(browser, mode) {
  const vp = { name: "laptop-1280", w: 1280, h: 800, touch: false };
  const ctx = await open(browser, vp, { lang: "en", tag: `motion-${mode}`, reducedMotion: mode === "media" });
  const { page, context } = ctx;
  const running = {};
  try {
    if (mode === "setting") await page.evaluate(() => Ludus.Settings.set("a11y.motion", "reduce"));
    await startClassic(page, { count: 2, options: { clock: { mode: "untimed" } } });
    await waitPhase(page, "thinking");
    await settle(page, 700);
    running.thinking = await motionProbe(page);
    await playUci(page, await weakMove(page));
    await waitPhase(page, "evaluating");
    await settle(page, 400);
    running.evaluating = await motionProbe(page);
    await waitResult(page);
    await settle(page, 1200);
    running.result = await motionProbe(page);
    await page.locator("#next-btn").click();
    await waitPhase(page, "thinking");
    await playUci(page, await page.evaluate(() => STATE.positions[STATE.index].reference.lines[0].uci));
    await waitResult(page);
    await page.locator("#next-btn").click();
    await waitPhase(page, "summary");
    await settle(page, 1500);
    running.summary = await motionProbe(page);
    checkProblems(`motion ${mode}`, ctx.problems);
  } finally {
    await context.close();
  }
  return running;
}

async function motionScenario(browser) {
  console.log("scenario: reduced motion");
  // The probe itself: with nothing asked for, the evaluating state does move (skeletons, spinner).
  step("baseline: without the preference the waiting state is animated (so the probe can tell)");
  const baseline = await motionRun(browser, "normal");
  assert.ok(baseline.evaluating.length > 0, "the probe sees no animation in the evaluating state even without the preference");
  for (const mode of ["media", "setting"]) {
    step(mode === "media" ? "prefers-reduced-motion: reduce" : "the setting a11y.motion = reduce");
    const running = await motionRun(browser, mode);
    Object.keys(running).forEach((state) => {
      assert.deepStrictEqual(running[state], [], `${mode}: something keeps moving in the ${state} state: ${JSON.stringify(running[state])}`);
    });
  }
}

// ---------- scenario: keyboard ----------

async function keyboardScenario(browser) {
  console.log("scenario: keyboard and focus rings");
  const ctx = await open(browser, { name: "laptop-1280", w: 1280, h: 800, touch: false }, { lang: "en", tag: "keyboard" });
  const { page, context } = ctx;
  try {
    await collectEvents(page);
    const positions = await startClassic(page, { count: 2, options: { clock: { mode: "untimed" } } });
    await waitPhase(page, "thinking");
    await settle(page);

    const audit = (label, stops, required) => {
      const inside = stops.filter((stop) => !stop.outside);
      const unseen = inside.filter((stop) => !stop.visibleRing);
      assert.deepStrictEqual(unseen.map((stop) => stop.name), [], `${label}: these stops show no focus ring: ${unseen.map((stop) => stop.name).join(", ")}`);
      const notKeyboard = inside.filter((stop) => !stop.focusVisible);
      assert.deepStrictEqual(notKeyboard.map((stop) => stop.name), [], `${label}: these stops are not :focus-visible after Tab`);
      required.forEach((name) => assert.ok(inside.some((stop) => stop.name.includes(name)), `${label}: Tab never reached ${name} (reached: ${inside.map((stop) => stop.name).join(", ")})`));
    };

    step("thinking: Tab reaches the exit, the board, the hint, the skip and the panel, each with a ring");
    audit("thinking", await focusProbe(page, 22, "#game-layout"), ["#restart-btn", "#hint-btn", "#skip-btn", "#coach-scroll"]);

    step("H asks for a hint from anywhere on the page");
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press("h");
    assert.strictEqual(await page.locator("#board .square.hint-from").count(), 1);

    await playUci(page, positions[0].reference.lines[0].uci);
    await waitResult(page);
    await settle(page, 700);

    step("result: Tab reaches the tools, the lines, the panel and the next button, each with a ring");
    audit("result", await focusProbe(page, 40, "#game-layout"), ["#reveal-best-btn", "#result-analysis-btn", "co-line", "#next-btn"]);

    step("B shows the best move, E explores, N goes on");
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press("b");
    assert.strictEqual(await page.locator("#reveal-best-btn").getAttribute("aria-pressed"), "true");
    await page.keyboard.press("e");
    assert.strictEqual(await page.evaluate(() => STATE.resultView.analysisMode), true);
    await page.keyboard.press("e");
    await page.keyboard.press("n");
    await waitPhase(page, "thinking");
    assert.match(await textOf(page, "#round-status"), /Position 2 of 2/);

    await playUci(page, positions[1].reference.lines[0].uci);
    await waitResult(page);
    await page.keyboard.press("n");
    await waitPhase(page, "summary");
    await settle(page, 700);
    step("summary: Tab reaches every position and every action, each with a ring");
    audit("summary", await focusProbe(page, 24, "#game-layout"), ["co-pos", "#summary-again-btn", "#summary-share-btn", "#summary-menu-btn"]);

    checkProblems("keyboard", ctx.problems);
    checkIssues("keyboard", ctx.issues);
  } finally {
    await context.close();
  }
}

// ---------- scenario: contrast ----------

// A PNG of 8-bit RGB or RGBA, decoded to { width, height, channels, data } (no dependency: zlib and the
// five row filters). Playwright's screenshots are always this kind.
function decodePng(buffer) {
  const zlib = require("zlib");
  assert.strictEqual(buffer.readUInt32BE(0), 0x89504e47, "not a PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const parts = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      assert.strictEqual(body[8], 8, "8-bit PNG expected");
      colorType = body[9];
      assert.ok(colorType === 2 || colorType === 6, `PNG colour type ${colorType}`);
      assert.strictEqual(body[12], 0, "no interlace expected");
    } else if (type === "IDAT") {
      parts.push(body);
    }
    offset += 12 + length;
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const data = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const row = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[row + x];
      const left = x >= channels ? data[y * stride + x - channels] : 0;
      const up = y > 0 ? data[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? data[(y - 1) * stride + x - channels] : 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      data[y * stride + x] = (value + predicted) & 255;
    }
  }
  return { width, height, channels, data };
}

const luminance = ([r, g, b]) => {
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrastOf = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// Collects the text of the play screen that is on screen right now: its box (clipped by every scroll
// region above it), its colour with the opacity of its ancestors folded in, and how large it is.
function collectTextBoxes() {
  const out = [];
  const layout = document.querySelector("#game-layout");
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  const toRgba = (css) => {
    g.clearRect(0, 0, 1, 1);
    g.fillStyle = "#000";
    g.fillStyle = css;
    g.fillRect(0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const walker = document.createTreeWalker(layout, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const textNode = node;
    const el = textNode.parentElement;
    node = walker.nextNode();
    if (!el || !/\S/.test(textNode.textContent || "")) continue;
    // The board has its own contract (its coordinates sit on pieces on purpose: tests/board and e2e/board).
    if (el.closest("#board, .sr-only, [hidden], .hidden, script, style") || el.matches(":disabled") || el.closest("[aria-disabled='true'], button:disabled")) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    // Text that is only there for a screen reader (clipped to a point) is not on screen.
    const own = el.getBoundingClientRect();
    if (own.width <= 2 || own.height <= 2 || (cs.position === "absolute" && /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(cs.clip))) continue;
    // The box of this text alone, not of its element (a block-level paragraph is as wide as its column,
    // a legend entry holds a key cap as well).
    const range = document.createRange();
    range.selectNodeContents(textNode);
    let rect = range.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    // Clipped by every ancestor that scrolls or hides overflow, and by the window.
    let left = Math.max(rect.left, 0);
    let top = Math.max(rect.top, 0);
    let right = Math.min(rect.right, innerWidth);
    let bottom = Math.min(rect.bottom, innerHeight);
    let opacity = 1;
    for (let up = el; up && up !== document.documentElement; up = up.parentElement) {
      const style = getComputedStyle(up);
      opacity *= Number(style.opacity);
      if (style.overflowX !== "visible" || style.overflowY !== "visible") {
        const r = up.getBoundingClientRect();
        left = Math.max(left, r.left);
        top = Math.max(top, r.top);
        right = Math.min(right, r.right);
        // The panel fades out over its last 22px (a mask, css/coach.css): text there is on its way out.
        bottom = Math.min(bottom, up.id === "coach-scroll" ? r.bottom - 22 : r.bottom);
      }
    }
    // Only what is fully readable: half a line at the edge of a scroll region is measured on its own scroll.
    if (right - left < 4 || bottom - top < 6) continue;
    if (bottom - top < rect.height - 1.5 || right - left < rect.width - 1.5) continue;
    const color = toRgba(cs.color);
    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const name = el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}.${String(el.className || "").split(/\s+/).filter(Boolean).slice(0, 2).join(".")}`;
    out.push({ name, text: textNode.textContent.replace(/\s+/g, " ").trim().slice(0, 40), left, top, right, bottom, color, opacity, large });
  }
  return out;
}

// The words of one measurement are the same words in the same places: same texts, boxes within half a pixel.
const sameBoxes = (a, b) => a.length === b.length && a.every((box, index) => box.text === b[index].text
  && ["left", "top", "right", "bottom"].every((side) => Math.abs(box[side] - b[index][side]) < 0.6));

// One measurement of every text on screen against the pixels behind it: the findings, as text. RK-1: the boxes are read before the screenshot
// and again after it; if the screen moved in between (a CSS transition, but also the content itself: the "backup engine" notice that the
// panel shows while Stockfish boots is removed when the engine is ready, which under CPU load happens well after the fixed wait, and shifted
// the card by 51px between the two reads) the pixels do not belong to the boxes and the measurement is repeated on the settled screen.
async function contrastMeasure(ctx, label) {
  const { page } = ctx;
  const deadline = Date.now() + 12000;
  for (;;) {
    // A toast floats over the screen and would be measured instead of what it covers (the kit owns its colours).
    await page.evaluate(() => Ludus.ui.clearToasts());
    await quiet(page);
    const boxes = await page.evaluate(collectTextBoxes);
    if (!boxes.length) return [];
    // The same screen with the text made invisible: what is left is what the text sits on. Transitions are off in it, so the change of
    // colour itself cannot be caught half way either.
    await page.addStyleTag({ content: "#game-layout, #game-layout * { color: transparent !important; text-shadow: none !important; -webkit-text-fill-color: transparent !important; caret-color: transparent !important; transition: none !important; }" }).then((handle) => handle.evaluate((el) => el.setAttribute("data-contrast-probe", "")));
    const image = decodePng(await page.screenshot({ scale: "css" }));
    const after = await page.evaluate(collectTextBoxes);
    await page.evaluate(() => document.querySelectorAll("style[data-contrast-probe]").forEach((el) => el.remove()));
    if (!sameBoxes(boxes, after)) {
      if (Date.now() > deadline) return [`${ctx.tag} ${label}: the panel kept changing for 12 s, so its contrast could not be measured`];
      await page.waitForTimeout(250);
      continue;
    }
    const findings = [];
    boxes.forEach((box) => {
      const x0 = Math.max(0, Math.floor(box.left));
      const x1 = Math.min(image.width, Math.ceil(box.right));
      const y0 = Math.max(0, Math.floor(box.top));
      const y1 = Math.min(image.height, Math.ceil(box.bottom));
      let worst = Infinity;
      let worstBg = null;
      const stepX = Math.max(1, Math.floor((x1 - x0) / 24));
      const stepY = Math.max(1, Math.floor((y1 - y0) / 6));
      for (let y = y0; y < y1; y += stepY) {
        for (let x = x0; x < x1; x += stepX) {
          const at = (y * image.width + x) * image.channels;
          const bg = [image.data[at], image.data[at + 1], image.data[at + 2]];
          const alpha = box.color[3] * box.opacity;
          const fg = [0, 1, 2].map((i) => box.color[i] * alpha + bg[i] * (1 - alpha));
          const ratio = contrastOf(fg, bg);
          if (ratio < worst) {
            worst = ratio;
            worstBg = bg;
          }
        }
      }
      const needed = box.large ? 3 : 4.5;
      if (worst < needed) {
        const rgb = (c) => `rgb(${c.map((v) => Math.round(v)).join(",")})`;
        findings.push(`${ctx.tag} ${label}: ${box.name} "${box.text}" has ${worst.toFixed(2)}:1 (needs ${needed}:1; ${rgb(box.color.slice(0, 3))} on ${rgb(worstBg)})`);
      }
    });
    return findings;
  }
}

// Contrast of every text on screen against the pixels behind it. Returns the findings. A finding is only real if a second measurement, on
// the screen settled again, gives the very same one (same text, same colours, same ratio): a text caught on something that was still
// changing never repeats exactly, a real contrast defect always does.
async function contrastProbe(ctx, label) {
  const first = await contrastMeasure(ctx, label);
  if (!first.length) return first;
  await ctx.page.waitForTimeout(150);
  const again = await contrastMeasure(ctx, label);
  return first.filter((line) => again.includes(line));
}

// Every state whose text is measured; the panel is scrolled in steps so its whole length is seen.
async function contrastState(ctx, label) {
  const { page } = ctx;
  const found = [];
  const hasScroll = await page.locator("#coach-scroll").isVisible();
  const total = hasScroll ? await page.evaluate(() => document.querySelector("#coach-scroll").scrollHeight - document.querySelector("#coach-scroll").clientHeight) : 0;
  const stepBy = hasScroll ? Math.max(120, await page.evaluate(() => Math.floor(document.querySelector("#coach-scroll").clientHeight * 0.7))) : 1;
  for (let at = 0; at <= total + 1; at += stepBy) {
    if (hasScroll) await page.evaluate((top) => { document.querySelector("#coach-scroll").scrollTop = top; }, at);
    await page.waitForTimeout(60);
    found.push(...await contrastProbe(ctx, `${label}@${at}`));
    if (total === 0) break;
  }
  if (hasScroll) await page.evaluate(() => { document.querySelector("#coach-scroll").scrollTop = 0; });
  // The same words often appear in several steps: keep one finding per element and text.
  return Array.from(new Set(found.map((line) => line.replace(/@\d+/, ""))));
}

async function contrastFlow(browser, vp, lang, highContrast) {
  const ctx = await open(browser, vp, { lang, tag: `contrast-${vp.name}-${lang}${highContrast ? "-hc" : ""}`, reducedMotion: true });
  const { page, context } = ctx;
  const findings = [];
  try {
    await collectEvents(page);
    if (highContrast) await page.evaluate(() => Ludus.Settings.set("a11y.contrast", "high"));
    const positions = await startClassic(page, { count: 3, options: { clock: { mode: "untimed" } } });
    await waitPhase(page, "thinking");
    await settle(page, 500);
    findings.push(...await contrastState(ctx, "thinking"));
    await page.locator("#hint-btn").click();
    await settle(page, 200);
    findings.push(...await contrastState(ctx, "thinking-hint"));
    await playUci(page, await weakMove(page));
    await waitResult(page);
    await settle(page, 600);
    // Every quality of answer has its own colours: draw the same result in each of them.
    const codes = await page.evaluate(() => Ludus.Coach.QUALITY_CODES);
    for (const code of codes) {
      await page.evaluate((quality) => {
        const context = STATE.resultView.context;
        const answer = context.answers[0];
        answer.assessment.qualityCode = quality;
        if (quality === "no_move") {
          answer.uci = "";
          answer.san = "";
          answer.noMoveReason = "manual_skip";
        }
        renderResultViewContext();
      }, code);
      await settle(page, 120);
      findings.push(...await contrastState(ctx, `result-${code}`));
    }
    await page.evaluate(() => Ludus.game.abort());

    // A duel result and the summaries.
    const duel = await startDuel(page, { count: 1, names: ["Ana", "Beto"], options: { clock: { mode: "untimed" } } });
    await playUci(page, duel[0].reference.lines[0].uci);
    await waitPhase(page, "handoff");
    await settle(page, 400);
    findings.push(...await contrastProbe(ctx, "handoff"));
    await page.locator("#handoff-overlay").click();
    await waitPhase(page, "thinking");
    findings.push(...await contrastState(ctx, "duel-thinking"));
    await playUci(page, await weakMove(page));
    await waitResult(page);
    await settle(page, 700);
    findings.push(...await contrastState(ctx, "duel-result"));
    await page.locator("#next-btn").click();
    await waitPhase(page, "summary");
    await settle(page, 700);
    findings.push(...await contrastState(ctx, "duel-summary"));
    await page.evaluate(() => Ludus.game.abort());

    await startClassic(page, { count: 2, options: { clock: { mode: "untimed" } } });
    await waitPhase(page, "thinking");
    for (let i = 0; i < 2; i += 1) {
      await playUci(page, await page.evaluate(() => STATE.positions[STATE.index].reference.lines[0].uci));
      await waitResult(page);
      await page.locator("#next-btn").click();
      if (i === 0) await waitPhase(page, "thinking");
    }
    await waitPhase(page, "summary");
    await settle(page, 800);
    findings.push(...await contrastState(ctx, "summary"));
    checkProblems(ctx.tag, ctx.problems);
    void positions;
  } finally {
    await context.close();
  }
  return findings;
}

async function contrastScenario(browser) {
  console.log("scenario: contrast");
  const jobs = [];
  [{ name: "laptop-1280", w: 1280, h: 800, touch: false }, { name: "phone-390", w: 390, h: 844, touch: true }].forEach((vp) => {
    ["es", "en"].forEach((lang) => jobs.push({ vp, lang, high: false }));
  });
  jobs.push({ vp: { name: "laptop-1280", w: 1280, h: 800, touch: false }, lang: "en", high: true });
  jobs.push({ vp: { name: "tablet-820", w: 820, h: 1180, touch: true }, lang: "en", high: false });
  jobs.push({ vp: { name: "phone-land-844", w: 844, h: 390, touch: true }, lang: "es", high: false });
  const issues = [];
  for (let i = 0; i < jobs.length; i += 2) {
    const results = await Promise.all(jobs.slice(i, i + 2).map((job) => contrastFlow(browser, job.vp, job.lang, job.high).then((found) => ({ job, found }))));
    results.forEach(({ job, found }) => {
      step(`${job.vp.w}x${job.vp.h} ${job.lang}${job.high ? " (high contrast)" : ""}: ${found.length ? `${found.length} finding(s)` : "every text meets its ratio"}`);
      issues.push(...found);
    });
  }
  checkIssues("contrast", issues);
}

// ---------- scenario: axe ----------

async function axeFlow(browser, vp, lang) {
  const ctx = await open(browser, vp, { lang, tag: `axe-${vp.name}-${lang}`, bypassCSP: true });
  const { page, context } = ctx;
  try {
    await collectEvents(page);
    await page.evaluate(() => Ludus.game.configureEngine({ minEvalVisibleMs: 6000 }));
    // The state of a quiet round: nothing is animating while axe reads the colours.
    await page.evaluate(() => Ludus.Settings.set("a11y.motion", "reduce"));
    const positions = await startClassic(page, { count: 2, options: { clock: { mode: "untimed" } } });
    await waitPhase(page, "thinking");
    await settle(page, 500);
    await axeScan(ctx, "thinking");
    await page.locator("#hint-btn").click();
    await axeScan(ctx, "thinking-hint");
    await playUci(page, await weakMove(page));
    await waitPhase(page, "evaluating");
    await settle(page, 300);
    await axeScan(ctx, "evaluating");
    await waitResult(page);
    await settle(page, 500);
    await axeScan(ctx, "result-weak");
    await page.locator(".co-line").first().scrollIntoViewIfNeeded();
    await page.locator(".co-line").first().click();
    await settle(page, 300);
    await axeScan(ctx, "result-stepper");
    const chips = page.locator(".co-concept");
    if ((await chips.count()) > 0) {
      await chips.first().scrollIntoViewIfNeeded();
      await chips.first().click();
      await page.locator(".modal-backdrop .modal").first().waitFor({ state: "visible" });
      await settle(page, 400);
      await axeScan(ctx, "concept-dialog");
      await page.keyboard.press("Escape");
      await settle(page, 300);
    }
    await page.locator("#next-btn").click();
    await waitPhase(page, "thinking");
    await playUci(page, positions[1].reference.lines[0].uci);
    await waitResult(page);
    await settle(page, 500);
    await axeScan(ctx, "result-best");
    await page.locator("#next-btn").click();
    await waitPhase(page, "summary");
    await settle(page, 700);
    await axeScan(ctx, "summary");
    await page.locator(".co-pos").first().click();
    await waitPhase(page, "result");
    await settle(page, 400);
    await axeScan(ctx, "summary-reopened");
    await page.evaluate(() => Ludus.game.abort());

    // A duel: the handoff and both results.
    const duelPositions = await startDuel(page, { count: 1, names: ["Ana", "Beto"], options: { clock: { mode: "untimed" } } });
    await axeScan(ctx, "duel-thinking");
    await playUci(page, duelPositions[0].reference.lines[0].uci);
    await waitPhase(page, "handoff");
    await settle(page, 500);
    await axeScan(ctx, "duel-handoff");
    await page.locator("#handoff-overlay").click();
    await waitPhase(page, "thinking");
    await playUci(page, await weakMove(page));
    await waitResult(page);
    await settle(page, 600);
    await axeScan(ctx, "duel-result");
    await page.locator("#next-btn").click();
    await waitPhase(page, "summary");
    await settle(page, 700);
    await axeScan(ctx, "duel-summary");
    await page.evaluate(() => Ludus.game.abort());
    checkProblems(ctx.tag, ctx.problems.filter((problem) => !/Refused to|Content Security/i.test(problem)));
  } finally {
    await context.close();
  }
  return ctx.issues;
}

async function axeScenario(browser) {
  if (!AXE_PATH) {
    console.log("scenario: axe");
    step("skipped: set LUDUS_AXE=/path/to/axe.min.js to run it");
    return;
  }
  console.log("scenario: axe");
  const wanted = process.env.LUDUS_E2E_VIEWPORTS ? viewportsFromEnv() : DEFAULT_VIEWPORTS.filter((vp) => ["laptop-1280", "tablet-820", "phone-390", "phone-land-844"].includes(vp.name));
  const jobs = [];
  wanted.forEach((vp) => ["es", "en"].forEach((lang) => jobs.push({ vp, lang })));
  const issues = [];
  for (let i = 0; i < jobs.length; i += 2) {
    const results = await Promise.all(jobs.slice(i, i + 2).map(({ vp, lang }) => axeFlow(browser, vp, lang).then((found) => ({ vp, lang, found }))));
    results.forEach(({ vp, lang, found }) => {
      step(`${vp.w}x${vp.h} ${lang}: ${found.length ? `${found.length} serious/critical finding(s)` : "no serious or critical violations"}`);
      issues.push(...found);
    });
  }
  checkIssues("axe", issues);
}

// ---------- scenario: polish (PL-3, PL-4) ----------

// What the duel's turn line looks like in the page: the name and the side to move, whether either is cut, and whether the line stays inside the screen.
const turnProbe = (page) => page.evaluate(() => {
  const el = document.getElementById("round-turn");
  const nameEl = el.querySelector(".co-turn-name");
  const sideEl = el.querySelector(".co-turn-side");
  const line = document.getElementById("round-turn-line");
  const box = line.getBoundingClientRect();
  const pad = getComputedStyle(line);
  const side = sideEl ? sideEl.getBoundingClientRect() : null;
  return {
    text: el.textContent,
    name: nameEl ? nameEl.textContent : "",
    title: nameEl ? nameEl.getAttribute("title") : "",
    side: sideEl ? sideEl.textContent : "",
    nameCut: nameEl ? nameEl.scrollWidth > nameEl.clientWidth + 1 : false,
    sideCut: sideEl ? sideEl.scrollWidth > sideEl.clientWidth + 1 : true,
    sideInside: side ? side.right <= box.right - parseFloat(pad.paddingRight) + 0.5 && side.left >= box.left + parseFloat(pad.paddingLeft) - 0.5 : false,
    pageScroll: document.documentElement.scrollWidth > innerWidth + 1,
  };
});

async function polishTurnRun(browser, vp, lang) {
  const ctx = await open(browser, vp, { lang, tag: `polish-turn-${vp.name}-${lang}` });
  const { page, context } = ctx;
  const sideWords = lang === "es" ? /^juega con las blancas$/ : /^plays White$/;
  try {
    // The longest name a duel accepts (20 characters, two words and no word wrapping anywhere).
    await startDuel(page, { count: 2, names: ["Maximiliano Alejandr", "Beto"], options: { clock: { mode: "untimed" } } });
    await settle(page, 300);
    let found = await turnProbe(page);
    step(`${vp.w}x${vp.h} ${lang}: "${found.text}"`);
    assert.strictEqual(found.name, "Maximiliano Alejandr", "the name of the player to move");
    assert.strictEqual(found.title, found.name, "the whole name is in its title");
    assert.match(found.side, sideWords, "the side to move is its own text");
    assert.strictEqual(found.sideCut, false, "the side to move is never shortened");
    assert.strictEqual(found.sideInside, true, "and stays inside the line");
    assert.strictEqual(found.pageScroll, false, "no sideways scroll");
    await shot(page, `polish-turn-${vp.name}-${lang}`);
    // The 24 letters a profile name may have, drawn by hand through the same function the game core calls, and a name far longer than that.
    for (const name of ["Maximiliano Alejandro Pe", "WWWWWWWWWWWWWWWWWWWWWWWW", "Maximiliano Alejandro Pérez de la Fuente Iglesias"]) {
      await page.evaluate((who) => {
        const sentence = t("play.turn.duel", { player: who, side: t("play.side.black") });
        Ludus.Coach.renderTurn(document.getElementById("round-turn"), { text: sentence, name: who });
      }, name);
      found = await turnProbe(page);
      assert.strictEqual(found.name, name);
      assert.strictEqual(found.sideCut, false, `${name.length} letters: the side to move is never shortened`);
      assert.strictEqual(found.sideInside, true, `${name.length} letters: the side stays inside the line`);
      assert.match(found.side, lang === "es" ? /^juega con las negras$/ : /^plays Black$/);
      assert.ok(found.text.startsWith(name), "what a screen reader reads is the whole sentence");
      assert.strictEqual(found.pageScroll, false);
    }
    // The real flow keeps working: the second player's turn names the second player.
    await page.evaluate(() => Ludus.game.abort());
    checkProblems(`polish turn ${vp.name} ${lang}`, ctx.problems);
  } finally {
    await context.close();
  }
}

// Is the keyboard ring of this element cut by a parent that clips? (The ring's outer edge: border box grown by offset + width.)
const ringProbe = (page, selector) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return { missing: true };
  el.focus();
  const cs = getComputedStyle(el);
  const width = parseFloat(cs.outlineWidth) || 0;
  const offset = parseFloat(cs.outlineOffset) || 0;
  const box = el.getBoundingClientRect();
  const grow = offset + width;
  const ring = { l: box.left - grow, t: box.top - grow, r: box.right + grow, b: box.bottom + grow };
  const cut = [];
  if (ring.l < -0.5 || ring.t < -0.5 || ring.r > innerWidth + 0.5 || ring.b > innerHeight + 0.5) cut.push("screen");
  for (let node = el.parentElement; node && node !== document.documentElement; node = node.parentElement) {
    const style = getComputedStyle(node);
    const clipsX = style.overflowX !== "visible";
    const clipsY = style.overflowY !== "visible";
    if (!clipsX && !clipsY) continue;
    const rect = node.getBoundingClientRect();
    const inner = { l: rect.left + (parseFloat(style.borderLeftWidth) || 0), t: rect.top + (parseFloat(style.borderTopWidth) || 0), r: rect.right - (parseFloat(style.borderRightWidth) || 0), b: rect.bottom - (parseFloat(style.borderBottomWidth) || 0) };
    const sides = [];
    if (clipsX && ring.l < inner.l - 0.5) sides.push("left");
    if (clipsX && ring.r > inner.r + 0.5) sides.push("right");
    if (clipsY && ring.t < inner.t - 0.5) sides.push("top");
    if (clipsY && ring.b > inner.b + 0.5) sides.push("bottom");
    if (sides.length) cut.push(`${node.id ? `#${node.id}` : `.${String(node.className).split(" ")[0]}`}:${sides.join("+")}`);
  }
  return { visible: el.matches(":focus-visible") && cs.outlineStyle !== "none" && width >= 2, offset, width, cut };
}, selector);

async function polishRingRun(browser, vp) {
  const ctx = await open(browser, vp, { lang: "en", tag: `polish-ring-${vp.name}` });
  const { page, context } = ctx;
  const expectRing = async (selector, wanted, label) => {
    await page.keyboard.press("Tab"); // keyboard modality: a script's focus() then matches :focus-visible
    const found = await ringProbe(page, selector);
    assert.ok(!found.missing, `${label}: ${selector} exists`);
    assert.strictEqual(found.visible, true, `${label}: a visible ring`);
    if (wanted !== null) assert.strictEqual(found.offset, wanted, `${label}: the ring is ${wanted < 0 ? "inside" : "outside"} (outline-offset ${wanted}px, computed ${found.offset}px)`);
    assert.deepStrictEqual(found.cut, [], `${label}: the ring is not cut by ${found.cut.join(", ")}`);
    return found;
  };
  try {
    step(`${vp.w}x${vp.h}: the ring of the exit and sound buttons, and of the scroll region while thinking`);
    await startClassic(page, { count: 2, mode: "solo", options: { clock: { mode: "untimed" } } });
    await waitPhase(page, "thinking");
    await settle(page, 400);
    await expectRing("#restart-btn", null, "exit button");
    await expectRing("#sound-btn", null, "sound button");
    // The notes of the position are a tab stop that sits flush inside a panel that clips: -3px, drawn inside.
    await expectRing("#coach-scroll", -3, "coach scroll region");
    // The buttons inside the notes keep their own ring (the offset is set on the focused region only: it is inherited otherwise).
    await page.evaluate(() => document.querySelector("#coach-scroll").blur());
    const inner = await page.evaluate(() => {
      const button = document.querySelector("#coach-scroll button, #coach-scroll a[href]");
      if (!button) return null;
      document.querySelector("#coach-scroll").setAttribute("data-probe", "1");
      button.focus();
      return getComputedStyle(button).outlineOffset;
    });
    if (inner !== null) assert.notStrictEqual(inner, "-3px", "a button inside the scroll region does not inherit the inset ring");
    await shot(page, `polish-ring-scroll-${vp.name}`);
    // A solo answer: on a phone the sheet handle is as wide as the panel, and its ring is inside too.
    const positions = await page.evaluate(() => JSON.parse(JSON.stringify(window.__positions)));
    await playUci(page, positions[0].reference.lines[0].uci);
    await waitResult(page);
    await settle(page, 700);
    if (await page.locator("#coach-expand").isVisible()) await expectRing("#coach-expand", -3, "sheet handle");
    await page.evaluate(() => Ludus.game.abort());

    step(`${vp.w}x${vp.h}: the ring of the duel's cover is inside it`);
    const duelPositions = await startDuel(page, { count: 2, names: ["Ana", "Beto"], options: { clock: { mode: "untimed" } } });
    await settle(page, 300);
    await playUci(page, duelPositions[0].reference.lines[0].uci);
    await waitPhase(page, "handoff");
    await settle(page, 400);
    await expectRing("#handoff-overlay", -6, "handoff cover");
    await shot(page, `polish-ring-handoff-${vp.name}`);
    await page.evaluate(() => Ludus.game.abort());
    checkProblems(`polish ring ${vp.name}`, ctx.problems);
  } finally {
    await context.close();
  }
}

async function polishScenario(browser) {
  console.log("scenario: polish");
  for (const vp of [{ name: "phone-320", w: 320, h: 568, touch: true }, { name: "phone-390", w: 390, h: 844, touch: true }, { name: "tablet-820", w: 820, h: 1180, touch: true }]) {
    for (const lang of ["es", "en"]) await polishTurnRun(browser, vp, lang);
  }
  for (const vp of [{ name: "laptop-1280", w: 1280, h: 800, touch: false }, { name: "phone-390", w: 390, h: 844, touch: true }, { name: "phone-320", w: 320, h: 568, touch: true }]) {
    await polishRingRun(browser, vp);
  }
}

// ---------- scenario: duel-ready (PF-2) ----------

// What the cover of a duel position looks like in the page: whether every part of it is inside it, whether the button of
// the cover (the whole cover is one) has a card that fits, and what the focus and the live region say.
const coverProbe = (page) => page.evaluate(() => {
  const cover = document.getElementById("handoff-overlay");
  const box = cover.getBoundingClientRect();
  const inside = (el) => {
    const rect = el.getBoundingClientRect();
    return rect.width === 0 || (rect.left >= box.left - 0.5 && rect.right <= box.right + 0.5 && rect.top >= box.top - 0.5 && rect.bottom <= box.bottom + 0.5);
  };
  const parts = ["handoff-overlay-eyebrow", "handoff-overlay-title", "handoff-overlay-subtitle"].map((id) => document.getElementById(id));
  const cta = cover.querySelector(".co-handoff-cta");
  const avatar = document.getElementById("handoff-overlay-avatar");
  const cut = (el) => el.scrollWidth > el.clientWidth + 1;
  return {
    visible: !cover.classList.contains("hidden") && box.width > 0,
    allInside: parts.every(inside) && inside(cta),
    ctaInside: inside(cta),
    avatarShown: getComputedStyle(avatar).display !== "none",
    coverScrolls: cover.scrollHeight > cover.clientHeight + 1,
    coverCutSideways: cut(cover),
    anyPartCut: parts.some(cut),
    pageScroll: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1,
    title: document.getElementById("handoff-overlay-title").textContent,
    subtitle: document.getElementById("handoff-overlay-subtitle").textContent,
    eyebrow: document.getElementById("handoff-overlay-eyebrow").textContent,
    focusId: document.activeElement && document.activeElement.id,
    live: cover.getAttribute("aria-live"),
    announce: document.getElementById("play-announce").textContent,
    ctaSize: cta.getBoundingClientRect().height,
  };
});

async function duelReadyRun(browser, vp, lang) {
  const ctx = await open(browser, vp, { lang, tag: `duel-ready-${vp.name}-${lang}` });
  const { page, context } = ctx;
  // 24 letters each: the longest a profile name may have, with and without a space to wrap at. A duel keeps all of them (RC-2, r2-core: marked edit, it kept 20 before).
  const long = ["Maximiliano Alejandro Pe", "WWWWWWWWWWWWWWWWWWWWWWWW"];
  const kept = long.slice();
  const words = lang === "es"
    ? { ready: "preparate", pass: "Pasale el dispositivo a", played: "ya jugó", position: "Posición 1 de 2" }
    : { ready: "get ready", pass: "Pass the device to", played: "has played", position: "Position 1 of 2" };
  try {
    await collectEvents(page);
    const positions = await startClassic(page, { count: 2, mode: "duel", names: long, options: { clock: { mode: "untimed" } } });
    await waitPhase(page, "handoff");
    await settle(page, 500);
    const found = await coverProbe(page);
    step(`${vp.w}x${vp.h} ${lang}: "${found.title}" / "${found.subtitle}"`);
    assert.strictEqual(found.visible, true, "a cover before position 1");
    assert.strictEqual(found.title, `${kept[0]}, ${words.ready}`, "it names who goes first (all 24 letters kept)");
    assert.ok(found.subtitle.startsWith(`${words.pass} ${kept[0]},`), "it says where the device goes");
    assert.ok(found.subtitle.includes(kept[1]), "and who waits");
    assert.strictEqual(found.eyebrow, words.position);
    assert.strictEqual(found.live, "polite", "the cover is a polite live region");
    assert.ok(found.announce.includes(found.title), "and the same words are announced once");
    assert.strictEqual(found.focusId, "handoff-overlay", "the focus is on the cover");
    assert.strictEqual(found.allInside, true, "every part of the cover is inside it");
    assert.strictEqual(found.anyPartCut, false, "no part of the cover is cut sideways (a long name wraps)");
    assert.strictEqual(found.coverCutSideways, false, "the cover does not scroll sideways");
    assert.strictEqual(found.pageScroll, false, "the page does not scroll");
    assert.strictEqual(found.coverScrolls, false, "the whole card is on screen: nothing to scroll to reach the tap target");
    assert.ok(found.ctaSize >= 36, `the call to action is a real target (${Math.round(found.ctaSize)}px)`);
    await shot(page, `duel-ready-${vp.name}-${lang}`);

    // Space starts the clock like a tap; the focus goes to the board.
    await page.keyboard.press("Space");
    await waitPhase(page, "thinking");
    await settle(page, 200);
    assert.strictEqual(await evalState(page, "document.activeElement && document.activeElement.classList.contains('square')"), true, "the focus is on the board once the round runs");
    if (vp.w === 390 || vp.w === 1280) {
      // The turns alternate: after position 1 the cover of position 2 names the other player, and the device goes back after.
      await playUci(page, positions[0].reference.lines[0].uci);
      await waitPhase(page, "handoff");
      const handoff = await coverProbe(page);
      assert.strictEqual(handoff.title, lang === "es" ? `Pasale el dispositivo a ${kept[1]}` : `Pass the device to ${kept[1]}`);
      assert.ok(handoff.eyebrow.includes(kept[0]) && handoff.eyebrow.includes(words.played), `"${handoff.eyebrow}"`);
      assert.strictEqual(handoff.allInside, true, "the handoff of long names fits too");
      assert.strictEqual(handoff.focusId, "handoff-overlay");
      await page.locator("#handoff-overlay").click();
      await waitPhase(page, "thinking");
      await playUci(page, positions[0].reference.lines[0].uci);
      await waitResult(page);
      await page.locator("#next-btn").click();
      await waitPhase(page, "handoff");
      await settle(page, 400);
      const second = await coverProbe(page);
      assert.strictEqual(second.title, `${kept[1]}, ${words.ready}`, "position 2 starts with the second player");
      assert.ok(second.subtitle.startsWith(`${words.pass} ${kept[1]},`));
      assert.strictEqual(second.allInside, true);
      assert.strictEqual(second.pageScroll, false);
      assert.strictEqual(await page.locator("#duel-b").getAttribute("aria-current"), "true", "the scoreboard points at them");
      await shot(page, `duel-ready-2-${vp.name}-${lang}`);
    }
    await page.evaluate(() => Ludus.game.abort());
    checkProblems(`duel-ready ${vp.name} ${lang}`, ctx.problems);
  } finally {
    await context.close();
  }
}

async function duelReadyScenario(browser) {
  console.log("scenario: duel-ready");
  for (const vp of [{ name: "phone-320", w: 320, h: 568, touch: true }, { name: "phone-390", w: 390, h: 844, touch: true }, { name: "phone-land-844", w: 844, h: 390, touch: true }, { name: "laptop-1280", w: 1280, h: 800, touch: false }]) {
    for (const lang of ["es", "en"]) await duelReadyRun(browser, vp, lang);
  }
}

// ---------- scenario: landscape (RK-1, RK-4, RK-5) ----------

// The tooltip of every dock button, its key, and the names the buttons keep. Runs in the page.
function dockFacts() {
  return Array.from(document.querySelectorAll("#board-dock .co-dock-btn")).map((button) => {
    const r = button.getBoundingClientRect();
    const label = button.querySelector(".btn-label");
    return {
      id: button.id,
      shown: r.width > 1 && r.height > 1 && getComputedStyle(button).display !== "none",
      title: button.getAttribute("title") || "",
      key: button.getAttribute("aria-keyshortcuts") || "",
      name: button.getAttribute("aria-label") || (label ? label.textContent : button.textContent).replace(/\s+/g, " ").trim(),
      describedby: button.getAttribute("aria-describedby"),
    };
  });
}

async function checkDock(ctx, label, lang) {
  const { page } = ctx;
  const facts = await page.evaluate(dockFacts);
  const expected = lang === "es"
    ? { "hint-btn": "Pista", "skip-btn": "Saltear esta posición (0 puntos)", "reveal-best-btn": "Mostrar la mejor jugada", "reveal-game-btn": "Mostrar la jugada de la partida", "result-analysis-btn": "Explorar el tablero", "result-analysis-reset-btn": "Volver a la posición", "confirm-move-btn": "Confirmar la jugada" }
    : { "hint-btn": "Hint", "skip-btn": "Skip this position (0 points)", "reveal-best-btn": "Show the best move", "reveal-game-btn": "Show the move of the game", "result-analysis-btn": "Explore the board", "result-analysis-reset-btn": "Back to the position", "confirm-move-btn": "Confirm your move" };
  assert.ok(facts.length >= 7, `${label}: the dock has its buttons (${facts.length})`);
  for (const fact of facts) {
    assert.ok(expected[fact.id], `${label}: ${fact.id} is a dock button the tooltips know`);
    assert.strictEqual(fact.title, fact.key ? `${expected[fact.id]} (${fact.key})` : expected[fact.id], `${label}: the tooltip of ${fact.id}`);
    assert.strictEqual(fact.describedby, null, `${label}: ${fact.id} has a title and no aria-describedby`);
    // The accessible name is what the button says (or its aria-label): the title only describes. The role query uses the browser's own computation.
    if (fact.shown) assert.strictEqual(await page.getByRole("button", { name: fact.name, exact: true }).count(), 1, `${label}: ${fact.id} is still named "${fact.name}"`);
  }
  return facts;
}

const LANDSCAPE_SIZES = [
  [568, 320], [640, 360], [664, 360], [667, 375], [700, 360], [740, 430], [760, 600], [800, 600], [844, 390], [880, 700], [932, 430], [1024, 600],
];

async function landscapeRun(browser, lang) {
  const ctx = await open(browser, { name: "phone-land-844", w: 844, h: 390, touch: true }, { lang, tag: `landscape-${lang}`, reducedMotion: true });
  const { page, context } = ctx;
  try {
    await collectEvents(page);
    await startClassic(page, { count: 2, options: { clock: { mode: "untimed" } } });
    await waitPhase(page, "thinking");
    await settle(page, 400);
    await checkDock(ctx, `${lang} thinking`, lang);
    for (const [w, h] of LANDSCAPE_SIZES) {
      await page.setViewportSize({ width: w, height: h });
      await settle(page, 150);
      const facts = await inspect(ctx, `thinking@${w}x${h}`, { axe: false });
      // RK-5: in the regime with the dock beside the board the header's exit button has air over the board's corner.
      if (w >= 560 && h <= 520) {
        const air = await page.evaluate(() => document.querySelector("#board").getBoundingClientRect().top - document.querySelector("#restart-btn").getBoundingClientRect().bottom);
        assert.ok(air >= 5.5, `${lang} ${w}x${h}: the exit button has ${air}px of air over the board`);
      }
      assert.ok(facts.board, `${lang} ${w}x${h}: a board`);
    }
    await page.setViewportSize({ width: 844, height: 390 });
    await settle(page, 200);
    await playUci(page, await weakMove(page));
    await waitResult(page);
    await settle(page, 700);
    await checkDock(ctx, `${lang} result`, lang);
    // A verdict card whose headline or sentence is cut off by the card's own overflow:hidden is a finding of the layout probe (RK-4): every quality
    // of answer, because the label decides how wide the headline is ("Inaccuracy" was the one that ran out of room).
    const codes = await page.evaluate(() => Ludus.Coach.QUALITY_CODES);
    // "No move" blanks the answer: every other quality starts again from the move that was played.
    await page.evaluate(() => {
      const answer = STATE.resultView.context.answers[0];
      window.__played = { uci: answer.uci, san: answer.san, noMoveReason: answer.noMoveReason };
    });
    for (const [w, h] of LANDSCAPE_SIZES) {
      await page.setViewportSize({ width: w, height: h });
      await settle(page, 150);
      for (const code of codes) {
        await page.evaluate((quality) => {
          const answer = STATE.resultView.context.answers[0];
          answer.assessment.qualityCode = quality;
          Object.assign(answer, window.__played);
          if (quality === "no_move") Object.assign(answer, { uci: "", san: "", noMoveReason: "manual_skip" });
          renderResultViewContext();
        }, code);
        // What is drawn is the quality asked for (a probe of the wrong card would pass for the wrong reason).
        assert.strictEqual(await page.locator(".co-hero").first().getAttribute("data-q"), code, `the verdict card shows ${code}`);
        await inspect(ctx, `result-${code}@${w}x${h}`, { axe: false });
      }
    }
    // The tooltips follow the language of the page, and the shortcuts: with them switched off the keys leave the tooltips.
    await page.setViewportSize({ width: 844, height: 390 });
    const other = lang === "es" ? "en" : "es";
    await page.evaluate((next) => Ludus.i18n.setLanguage(next), other);
    await settle(page, 300);
    await checkDock(ctx, `${lang} -> ${other} result`, other);
    await page.evaluate(() => {
      Ludus.Settings.set("a11y.shortcuts", false);
      // app.js writes (or removes) aria-keyshortcuts when it redraws the key legend; the coach's observer follows the attribute.
      syncShortcutAttributes();
    });
    await settle(page, 300);
    const withoutKeys = await page.evaluate(dockFacts);
    assert.ok(withoutKeys.every((fact) => fact.key === ""), "app.js removed the keys");
    withoutKeys.forEach((fact) => assert.ok(!/\([A-Z]\)$/.test(fact.title), `${fact.id}: no key in the tooltip with the shortcuts off (${fact.title})`));
    checkProblems(ctx.tag, ctx.problems);
  } finally {
    await context.close();
  }
  return ctx.issues;
}

async function landscapeScenario(browser) {
  console.log("scenario: landscape");
  const issues = [];
  for (const lang of ["es", "en"]) {
    const found = await landscapeRun(browser, lang);
    step(`${lang}: ${LANDSCAPE_SIZES.length} sizes, ${found.length ? `${found.length} finding(s)` : "tooltips, exit air and the verdict card are clean"}`);
    issues.push(...found);
  }
  checkIssues("landscape", issues);
}

// ---------- run ----------

const SCENARIOS = [
  ["regimes", regimesScenario],
  ["classic", classicScenario],
  ["duel", duelScenario],
  ["clock", clockScenario],
  ["own", ownScenario],
  ["motion", motionScenario],
  ["keyboard", keyboardScenario],
  ["contrast", contrastScenario],
  ["polish", polishScenario],
  ["axe", axeScenario],
  ["duel-ready", duelReadyScenario],
  ["landscape", landscapeScenario],
];

(async () => {
  const browser = await launchBrowser();
  try {
    for (const [name, run] of SCENARIOS) {
      if (ONLY && !name.includes(ONLY)) continue;
      await run(browser);
    }
    console.log("coach e2e passed");
  } catch (error) {
    console.error("coach e2e FAILED");
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
