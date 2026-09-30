// Browser end-to-end check of the board (Ludus.Board, js/ui/board.js, css/board.css) in real
// Chromium: how a person operates it with a mouse, a finger and the keyboard, how it looks in
// every theme and how it moves.
//
// Playwright is NOT a project dependency (the app has no runtime or dev dependencies) and this
// script is not part of `npm test`. Run it by hand:
//
//   python3 -m http.server 5010 &                      # serve the repo root
//   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/board.js
//
// Environment (all optional):
//   LUDUS_URL             page to test               (default http://127.0.0.1:5010/)
//   LUDUS_E2E_ONLY        run only the scenarios whose name contains this text (e.g. "touch")
//   LUDUS_CHROMIUM        chrome binary if Playwright cannot launch its own
//                         (falls back to /opt/pw-browsers/chromium-1194/chrome-linux/chrome)
//   LUDUS_E2E_SHOTS       directory for screenshots (none are saved when unset)
//   LUDUS_AXE             path to axe.min.js: turns on the axe scenario (axe-core is not a project dependency)
//
// Scenarios (each in a fresh context with service workers blocked, CSP enforced):
//   click move          select + destination: the piece lands, the last move is washed, the round is scored 10/10
//   mouse drag          ghost under the pointer, drop target marked, drop plays the move, no text selected
//   touch drag          CDP touch events at 390x844: the drag works, the page does not scroll while dragging a
//                       piece, but does scroll when the swipe starts on an empty square
//   keyboard move       arrows + Enter/Space, the labels and the live region say what happens, Escape cancels
//   cancel              Escape and a drop outside the board cancel a drag; an illegal drop snaps back
//   promotion by drag   the picker opens on the promotion file; a choice by click and by keyboard
//   animation           on: a move slides (Web Animations), a capture fades; off / reduced motion: nothing moves
//   settings live       coordinates, legal dots, last move, drag and theme react without a reload
//   themes              six themes: the squares change, the coordinates keep 4.5:1 (screenshots when set)
//   analysis            explore the board after a result: drag works, arrows step aside, reset brings them back
//   hints               level 1 and 2 mark the piece and the destination with their own classes
//   crisp + performance DPR 3: the pieces are vector images at the square size; renders take < 4 ms; the
//                       board does not move when pieces do
//   feedback            the person's own move plays move / capture / check with a haptic tick each, also in analysis
//   black side          Black at the bottom: mirrored squares, drag and labels in both languages
//   axe (optional)      with LUDUS_AXE=/path/to/axe.min.js: no serious or critical violations in five board states
//
// Every scenario fails on any console error, uncaught page error or failed request.
// Exits 0 on success, 1 on the first failed assertion, 2 if Playwright is missing.

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
const RESULT_TIMEOUT_MS = 60000;

// Scholar's mate in one for White: h5 x f7 is the best move, c4 x f7+ is a good one.
const MATE_FEN = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
const PROMO_FEN = "7k/P7/8/8/8/8/8/K7 w - - 0 1";
const CASTLE_FEN = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
const THEMES = ["walnut", "classic", "ocean", "forest", "slate", "contrast"];

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

async function shot(page, name, locator) {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const file = path.join(SHOT_DIR, `board-${name}.png`);
  if (locator) await locator.screenshot({ path: file });
  else await page.screenshot({ path: file });
}

async function newSession(browser, options = {}) {
  const context = await browser.newContext(Object.assign({
    viewport: { width: 1280, height: 900 },
    locale: "en-US",
    serviceWorkers: "block",
    bypassCSP: false,
  }, options));
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
  // A returning visitor: straight to the home hub.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("ludus.seen.v1", "1");
    } catch (error) {
      // storage may be blocked; the app copes
    }
  });
  await page.goto(BASE_URL);
  await page.waitForFunction(() => window.Ludus && Ludus.game && typeof Ludus.game.startSession === "function");
  return { context, page, problems };
}

// A one-position-per-round session on a FEN (two rounds, so "next" exists).
async function startFen(page, fen, extra = {}) {
  await page.evaluate(async ({ fen, extra }) => {
    const position = Object.assign({
      fen,
      source: "classic",
      meta: { players: "White vs Black", event: "Board check", year: "1900", moveNumber: 20 },
    }, extra);
    await Ludus.game.startSession({ kind: "classic", title: "Board check", positions: [position, Object.assign({}, position)], options: { hints: true } });
  }, { fen, extra });
  await page.waitForSelector('#board .square[data-square="e4"]');
  await page.waitForFunction(() => document.querySelectorAll("#board .bd-piece").length > 0);
  await page.evaluate(() => document.getElementById("board").scrollIntoView({ block: "center" }));
  await page.waitForTimeout(350);
}

const square = (page, name) => page.locator(`#board .square[data-square="${name}"]`);
const pieceAt = (page, name) => page.evaluate((sq) => {
  const el = document.querySelector(`#board [data-square="${sq}"] .bd-piece:not(.bd-leaving)`);
  return el ? el.dataset.piece : null;
}, name);
const classesAt = (page, name) => page.evaluate((sq) => Array.from(document.querySelector(`#board [data-square="${sq}"]`).classList), name);

async function center(page, name) {
  const box = await square(page, name).boundingBox();
  assert.ok(box, `square ${name} has a box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, size: box.width };
}

// A mouse drag in small steps; `hold` leaves the button down and returns the last point.
async function mouseDrag(page, from, to, { hold = false, steps = 8 } = {}) {
  const a = await center(page, from);
  const b = typeof to === "string" ? await center(page, to) : to;
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 6, a.y - 6, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps });
  if (!hold) await page.mouse.up();
  return b;
}

async function waitForResult(page) {
  await page.waitForFunction(() => STATE.ui.phase === "result" && Boolean(STATE.resultView.context), null, { timeout: RESULT_TIMEOUT_MS });
}

const resultPoints = (page) => page.evaluate(() => STATE.resultView.context.assessment.points);
const roundStillOpen = (page) => page.evaluate(() => !STATE.roundSubmitted && !STATE.isResolvingRound);

// Waits until the page has stopped scrolling (a touch fling keeps going after the finger lifts).
async function settleScroll(page) {
  let last = -1;
  let stable = 0;
  for (let i = 0; i < 40 && stable < 4; i += 1) {
    const y = await page.evaluate(() => window.scrollY);
    stable = y === last ? stable + 1 : 0;
    last = y;
    await page.waitForTimeout(60);
  }
}

function checkProblems(label, problems) {
  assert.deepStrictEqual(problems, [], `${label}: the page reported problems:\n  ${problems.join("\n  ")}`);
}

async function setSetting(page, path, value) {
  await page.evaluate(([p, v]) => Ludus.Settings.set(p, v), [path, value]);
  await page.waitForTimeout(80);
}

// ---------- scenarios ----------

async function clickMove(browser) {
  const { context, page, problems } = await newSession(browser);
  await startFen(page, MATE_FEN, { bestMoveUci: "h5f7", bestMoveSan: "Qxf7#" });
  step("the board has 64 squares, a1 is dark, only the mover's pieces show a grab cursor");
  assert.strictEqual(await page.locator("#board .square").count(), 64);
  const a1 = await page.evaluate(() => document.querySelector('#board [data-square="a1"]').className);
  assert.ok(/\bdark\b/.test(a1), `a1 is a dark square (${a1})`);
  assert.ok((await classesAt(page, "h5")).includes("bd-can-drag"));
  assert.ok(!(await classesAt(page, "e5")).includes("bd-can-drag"));
  step("clicking the queen selects it and shows dots and capture rings");
  await square(page, "h5").click();
  assert.ok((await classesAt(page, "h5")).includes("selected"));
  assert.ok((await classesAt(page, "f7")).includes("capture"), "f7 is a legal capture");
  assert.ok((await classesAt(page, "h4")).includes("legal"), "h4 is a legal destination");
  assert.match(await square(page, "h5").getAttribute("aria-label"), /selected/i);
  // The highlights are layers of ::before: the wash is a gradient and the ring a real box-shadow (a broken
  // custom property would silently drop them all).
  const layers = await page.evaluate(() => {
    const before = getComputedStyle(document.querySelector('#board [data-square="h5"]'), "::before");
    return { image: before.backgroundImage, shadow: before.boxShadow };
  });
  assert.match(layers.image, /linear-gradient/, "the selection wash is painted");
  assert.notStrictEqual(layers.shadow, "none", "the selection ring is painted");
  step("clicking the queen again puts it back");
  await square(page, "h5").click();
  assert.ok(!(await classesAt(page, "h5")).includes("selected"));
  step("select + destination plays the move");
  await square(page, "h5").click();
  await square(page, "f7").click();
  assert.strictEqual(await pieceAt(page, "f7"), "wQ");
  assert.strictEqual(await pieceAt(page, "h5"), null);
  assert.ok((await classesAt(page, "f7")).includes("bd-last") && (await classesAt(page, "h5")).includes("bd-last"), "the last move is washed");
  assert.match(await page.evaluate(() => getComputedStyle(document.querySelector('#board [data-square="f7"]'), "::before").backgroundImage), /linear-gradient/, "the last-move wash is painted");
  assert.match(await page.evaluate(() => getComputedStyle(document.querySelector('#board [data-square="e8"]'), "::before").backgroundImage), /radial-gradient/, "the check glow is painted");
  assert.ok((await classesAt(page, "e8")).includes("bd-check"), "the king in check glows");
  await shot(page, "click-move", page.locator("#board"));
  step("while the answer is being scored the board takes no input");
  assert.ok(!(await classesAt(page, "f7")).includes("bd-can-drag"));
  assert.strictEqual(await square(page, "f7").getAttribute("aria-disabled"), "true");
  await waitForResult(page);
  assert.strictEqual(await resultPoints(page), 10, "the best move earns 10 / 10");
  checkProblems("click move", problems);
  await context.close();
}

async function mouseDragScenario(browser) {
  const { context, page, problems } = await newSession(browser);
  await startFen(page, MATE_FEN, { bestMoveUci: "h5f7", bestMoveSan: "Qxf7#" });
  step("pressing a piece selects it before it moves; the ghost follows the pointer");
  const target = await mouseDrag(page, "h5", "f7", { hold: true });
  assert.strictEqual(await page.locator(".bd-ghost").count(), 1, "one ghost piece");
  const ghost = await page.evaluate(() => {
    const g = document.querySelector(".bd-ghost");
    const r = g.getBoundingClientRect();
    return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, src: g.getAttribute("src"), position: getComputedStyle(g).position, pe: getComputedStyle(g).pointerEvents };
  });
  assert.ok(Math.abs(ghost.cx - target.x) < 2 && Math.abs(ghost.cy - target.y) < 2, "the ghost is centred under the pointer");
  assert.match(ghost.src, /wQ\.svg$/);
  assert.strictEqual(ghost.position, "fixed");
  assert.strictEqual(ghost.pe, "none");
  assert.ok((await classesAt(page, "h5")).includes("bd-drag-src"), "the piece left behind is dimmed");
  assert.ok((await classesAt(page, "f7")).includes("bd-over"), "the square under the pointer is marked");
  assert.ok(await page.evaluate(() => document.body.classList.contains("bd-drag-active")));
  assert.strictEqual(await page.evaluate(() => String(window.getSelection())), "", "no text gets selected while dragging");
  assert.strictEqual(await page.evaluate(() => getComputedStyle(document.body).cursor), "grabbing");
  await shot(page, "mouse-dragging", page.locator("#board"));
  await page.mouse.up();
  step("dropping on a legal square plays the move");
  await page.waitForFunction(() => !document.querySelector(".bd-ghost"));
  assert.strictEqual(await pieceAt(page, "f7"), "wQ");
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("bd-drag-active"))));
  assert.strictEqual(await page.locator("#board .bd-drag-src, #board .bd-over").count(), 0, "no leftover drag classes");
  await waitForResult(page);
  assert.strictEqual(await resultPoints(page), 10);
  checkProblems("mouse drag", problems);
  await context.close();
}

async function touchDragScenario(browser) {
  const { context, page, problems } = await newSession(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const cdp = await context.newCDPSession(page);
  await startFen(page, MATE_FEN, { bestMoveUci: "h5f7", bestMoveSan: "Qxf7#" });
  // Make sure the page can scroll so a swipe on empty squares has something to do.
  await page.evaluate(() => {
    document.body.style.minHeight = "4000px";
  });
  const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })) });
  async function swipe(from, to, steps = 8) {
    await touch("touchStart", [from]);
    for (let i = 1; i <= steps; i += 1) await touch("touchMove", [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }]);
    return async () => touch("touchEnd", []);
  }
  step("the board fits the 390px screen without a horizontal scroll");
  const fits = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, board: document.getElementById("board").getBoundingClientRect().width }));
  assert.ok(fits.sw <= fits.iw, `no horizontal scroll (${fits.sw} > ${fits.iw})`);
  assert.ok(fits.board >= 300, `the board is big enough to play on (${fits.board}px)`);
  step("a swipe that starts on an empty square scrolls the page (touch-action stays auto there)");
  // touch-action is not inherited but it is intersected along the ancestors: the board only disables double-tap zoom.
  assert.strictEqual(await page.evaluate(() => getComputedStyle(document.getElementById("board")).touchAction), "manipulation");
  assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('#board [data-square="e3"]')).touchAction), "auto");
  assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('#board [data-square="h5"]')).touchAction), "none", "own pieces do not pan");
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const e3 = await center(page, "e3");
  const end = await swipe(e3, { x: e3.x, y: e3.y - 160 }, 10);
  await end();
  await page.waitForTimeout(500);
  const scrollAfter = await page.evaluate(() => window.scrollY);
  assert.ok(scrollAfter > scrollBefore + 20, `the page scrolled from an empty square (${scrollBefore} -> ${scrollAfter})`);
  await page.evaluate(() => document.getElementById("board").scrollIntoView({ block: "center" }));
  await settleScroll(page);
  step("dragging a piece with a finger moves the ghost and does not scroll the page");
  const from = await center(page, "h5");
  const to = await center(page, "f7");
  const y0 = await page.evaluate(() => window.scrollY);
  const release = await swipe(from, to, 10);
  const mid = await page.evaluate(() => ({ ghost: document.querySelectorAll(".bd-ghost").length, active: document.body.classList.contains("bd-drag-active"), y: window.scrollY }));
  assert.strictEqual(mid.ghost, 1);
  assert.ok(mid.active);
  assert.strictEqual(mid.y, y0, "the page stayed where it was");
  assert.ok((await classesAt(page, "f7")).includes("bd-over"));
  await shot(page, "touch-dragging");
  await release();
  await page.waitForFunction(() => !document.querySelector(".bd-ghost"));
  assert.strictEqual(await pieceAt(page, "f7"), "wQ", "the finger drop played the move");
  await waitForResult(page);
  assert.strictEqual(await resultPoints(page), 10);
  checkProblems("touch drag", problems);
  await context.close();
}

async function keyboardScenario(browser) {
  const { context, page, problems } = await newSession(browser);
  await startFen(page, MATE_FEN, { bestMoveUci: "h5f7", bestMoveSan: "Qxf7#" });
  step("exactly one square is a tab stop; arrows move it without wrapping");
  assert.strictEqual(await page.locator('#board .square[tabindex="0"]').count(), 1);
  await square(page, "h5").focus();
  await page.keyboard.press("ArrowLeft");
  assert.strictEqual(await page.evaluate(() => document.activeElement.dataset.square), "g5");
  await page.keyboard.press("Home");
  assert.strictEqual(await page.evaluate(() => document.activeElement.dataset.square), "a5");
  await page.keyboard.press("ArrowLeft");
  assert.strictEqual(await page.evaluate(() => document.activeElement.dataset.square), "a5", "the edge does not wrap");
  assert.strictEqual(await page.locator('#board .square[tabindex="0"]').count(), 1);
  await page.keyboard.press("End");
  assert.strictEqual(await page.evaluate(() => document.activeElement.dataset.square), "h5");
  step("Enter selects, the label says so and a live region lists the moves");
  await page.keyboard.press("Enter");
  assert.match(await square(page, "h5").getAttribute("aria-label"), /selected/i);
  assert.strictEqual(await square(page, "h5").getAttribute("aria-selected"), "true");
  await page.waitForFunction(() => /Selected h5/.test((document.querySelector("#board")?.parentNode.querySelector(".bd-live") || {}).textContent || ""));
  assert.match(await square(page, "f7").getAttribute("aria-label"), /capture/i);
  step("Escape cancels the selection");
  await page.keyboard.press("Escape");
  assert.strictEqual(await square(page, "h5").getAttribute("aria-selected"), "false");
  assert.ok(await roundStillOpen(page));
  step("select, move the focus to f7 with the arrows, Space plays it");
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  assert.strictEqual(await page.evaluate(() => document.activeElement.dataset.square), "f7");
  await page.keyboard.press("Space");
  assert.strictEqual(await pieceAt(page, "f7"), "wQ");
  await waitForResult(page);
  assert.strictEqual(await resultPoints(page), 10);
  checkProblems("keyboard", problems);
  await context.close();
}

async function cancelScenario(browser) {
  const { context, page, problems } = await newSession(browser);
  await startFen(page, MATE_FEN, { bestMoveUci: "h5f7", bestMoveSan: "Qxf7#" });
  step("Escape during a drag puts the piece back and clears the selection");
  await mouseDrag(page, "h5", "f7", { hold: true });
  assert.strictEqual(await page.locator(".bd-ghost").count(), 1);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".bd-ghost"));
  await page.mouse.up();
  assert.strictEqual(await pieceAt(page, "h5"), "wQ");
  assert.strictEqual(await pieceAt(page, "f7"), "bP");
  assert.ok(!(await classesAt(page, "h5")).includes("selected"));
  assert.ok(await roundStillOpen(page), "nothing was played");
  step("dropping outside the board cancels");
  const board = await page.locator("#board").boundingBox();
  await mouseDrag(page, "h5", { x: board.x + board.width + 60, y: board.y + board.height / 2 });
  await page.waitForFunction(() => !document.querySelector(".bd-ghost"));
  assert.strictEqual(await pieceAt(page, "h5"), "wQ");
  assert.ok(await roundStillOpen(page));
  assert.ok(!(await classesAt(page, "h5")).includes("selected"));
  step("dropping on a square the piece cannot reach snaps back and keeps it selected");
  await mouseDrag(page, "h5", "a1");
  await page.waitForFunction(() => !document.querySelector(".bd-ghost"));
  assert.strictEqual(await pieceAt(page, "h5"), "wQ");
  assert.ok((await classesAt(page, "h5")).includes("selected"), "still selected: the next click can choose a destination");
  assert.ok(await roundStillOpen(page));
  step("dropping on its own square keeps the selection; a plain tap on it deselects");
  await mouseDrag(page, "h5", "h5", { steps: 2 });
  assert.ok(await roundStillOpen(page));
  await square(page, "h5").click();
  assert.ok(!(await classesAt(page, "h5")).includes("selected"));
  step("a click right after a drag is not treated as a second move");
  await mouseDrag(page, "h5", "h4");
  assert.strictEqual(await pieceAt(page, "h4"), "wQ");
  checkProblems("cancel", problems);
  await context.close();
}

async function promotionScenario(browser) {
  const { context, page, problems } = await newSession(browser);
  await startFen(page, PROMO_FEN);
  step("dragging a pawn to the last rank opens the picker on that file, queen first");
  await mouseDrag(page, "a7", "a8");
  await page.waitForSelector("#promotion-picker:not(.hidden)");
  assert.strictEqual(await pieceAt(page, "a7"), "wP", "the pawn is back on its square while the picker is open");
  assert.strictEqual(await page.locator(".bd-ghost").count(), 0);
  const geometry = await page.evaluate(() => {
    const board = document.getElementById("board").getBoundingClientRect();
    const panel = document.querySelector(".promotion-picker-panel").getBoundingClientRect();
    const picker = document.getElementById("promotion-picker");
    return { boardLeft: board.left, boardTop: board.top, panelLeft: panel.left, panelTop: panel.top, edge: picker.dataset.edge, buttons: Array.from(document.querySelectorAll(".promotion-choice")).map((b) => Math.round(b.getBoundingClientRect().height)) };
  });
  assert.strictEqual(geometry.edge, "top");
  assert.ok(Math.abs(geometry.panelLeft - geometry.boardLeft) < 3 && Math.abs(geometry.panelTop - geometry.boardTop) < 3, "the strip opens at the a8 corner");
  assert.ok(geometry.buttons.every((h) => h >= 44), `touch targets are at least 44px (${geometry.buttons})`);
  await shot(page, "promotion-picker", page.locator(".board-wrap"));
  step("Escape closes the picker without playing");
  await page.keyboard.press("Escape");
  await page.waitForSelector("#promotion-picker.hidden", { state: "attached" });
  assert.ok(await roundStillOpen(page));
  step("clicking the dark area around the strip cancels too");
  await mouseDrag(page, "a7", "a8");
  await page.waitForSelector("#promotion-picker:not(.hidden)");
  await page.mouse.click(geometry.boardLeft + 500, geometry.boardTop + 300);
  await page.waitForSelector("#promotion-picker.hidden", { state: "attached" });
  assert.ok(await roundStillOpen(page));
  step("choosing the knight plays the under-promotion");
  await mouseDrag(page, "a7", "a8");
  await page.waitForSelector("#promotion-picker:not(.hidden)");
  await page.locator("#promotion-choice-n").click();
  assert.strictEqual(await pieceAt(page, "a8"), "wN");
  await waitForResult(page);
  checkProblems("promotion", problems);
  await context.close();
}

async function animationScenario(browser) {
  const { context, page, problems } = await newSession(browser);
  await startFen(page, "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3");
  await setSetting(page, "board.animation", "on");
  await page.evaluate(() => Ludus.Settings.set("a11y.motion", "auto"));
  step("a move made by clicks slides the piece from its old square");
  await page.evaluate(() => {
    // Records what the board animates; the round would end the animation before we look.
    window.__anims = [];
    const original = Element.prototype.animate;
    Element.prototype.animate = function patched(frames, options) {
      const animation = original.call(this, frames, options);
      window.__anims.push({ piece: this.dataset && this.dataset.piece, cls: this.className, frames: JSON.stringify(frames), duration: options && options.duration });
      return animation;
    };
  });
  await square(page, "f3").click();
  await square(page, "e5").click();
  const slid = await page.evaluate(() => window.__anims.filter((a) => /translate/.test(a.frames)));
  assert.strictEqual(slid.length, 1, `one slide (${JSON.stringify(slid)})`);
  assert.strictEqual(slid[0].piece, "wN");
  assert.match(slid[0].frames, /translate\(100%, 200%\)/, "it starts one square to the right and two below");
  assert.ok(slid[0].duration >= 170 && slid[0].duration <= 300);
  const fades = await page.evaluate(() => window.__anims.filter((a) => /scale/.test(a.frames)));
  assert.strictEqual(fades.length, 1, "the captured pawn fades");
  assert.strictEqual(fades[0].piece, "bP");
  await waitForResult(page);
  step("the result puts the position back: the knight slides home");
  const back = await page.evaluate(() => window.__anims.filter((a) => /translate/.test(a.frames)).length);
  assert.ok(back >= 2, "the reset to the position is animated too");
  await context.close();

  step("with animation off nothing moves and nothing is left behind");
  const off = await newSession(browser);
  await startFen(off.page, "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3");
  await setSetting(off.page, "board.animation", "off");
  await off.page.evaluate(() => { window.__anims = []; const o = Element.prototype.animate; Element.prototype.animate = function p(f, x) { window.__anims.push(1); return o.call(this, f, x); }; });
  await square(off.page, "f3").click();
  await square(off.page, "e5").click();
  assert.strictEqual(await off.page.evaluate(() => window.__anims.length), 0);
  assert.strictEqual(await off.page.locator("#board .bd-leaving, #board .bd-moving").count(), 0);
  assert.strictEqual(await off.page.locator('#board [data-square="e5"] .bd-piece').count(), 1, "the captured pawn is gone at once");
  checkProblems("animation off", off.problems);
  await off.context.close();

  step("auto follows prefers-reduced-motion, and the in-app reduce setting beats 'on'");
  const reduced = await newSession(browser, { reducedMotion: "reduce" });
  await startFen(reduced.page, "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3");
  await reduced.page.evaluate(() => { window.__anims = []; const o = Element.prototype.animate; Element.prototype.animate = function p(f, x) { window.__anims.push(1); return o.call(this, f, x); }; });
  await square(reduced.page, "f3").click();
  await square(reduced.page, "e5").click();
  assert.strictEqual(await reduced.page.evaluate(() => window.__anims.length), 0, "reduced motion: instant");
  await reduced.context.close();
  const inApp = await newSession(browser);
  await startFen(inApp.page, "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3");
  await setSetting(inApp.page, "board.animation", "on");
  await setSetting(inApp.page, "a11y.motion", "reduce");
  await inApp.page.evaluate(() => { window.__anims = []; const o = Element.prototype.animate; Element.prototype.animate = function p(f, x) { window.__anims.push(1); return o.call(this, f, x); }; });
  await square(inApp.page, "f3").click();
  await square(inApp.page, "e5").click();
  assert.strictEqual(await inApp.page.evaluate(() => window.__anims.length), 0, "a11y.motion = reduce beats board.animation = on");
  await inApp.context.close();
  checkProblems("animation", problems);
}

async function settingsScenario(browser) {
  const { context, page, problems } = await newSession(browser);
  await startFen(page, MATE_FEN, { bestMoveUci: "h5f7", bestMoveSan: "Qxf7#" });
  const coordDisplay = () => page.evaluate(() => getComputedStyle(document.querySelector("#board .coord")).display);
  const dotDisplay = () => page.evaluate(() => getComputedStyle(document.querySelector('#board [data-square="h4"]'), "::after").display);
  await square(page, "h5").click();
  step("coordinates (board.coords)");
  assert.notStrictEqual(await coordDisplay(), "none");
  await setSetting(page, "board.coords", false);
  assert.strictEqual(await coordDisplay(), "none");
  await setSetting(page, "board.coords", true);
  assert.notStrictEqual(await coordDisplay(), "none");
  step("legal dots (board.legalDots) hide the dots but not the accessible state");
  assert.notStrictEqual(await dotDisplay(), "none");
  await setSetting(page, "board.legalDots", false);
  assert.strictEqual(await dotDisplay(), "none");
  assert.match(await square(page, "h4").getAttribute("aria-label"), /legal/i, "the label still names the destination");
  await setSetting(page, "board.legalDots", true);
  step("drag (board.drag) off: a press does not start a drag, click-click still plays");
  await square(page, "h5").click();
  await setSetting(page, "board.drag", false);
  assert.strictEqual(await page.locator("#board .bd-can-drag").count(), 0);
  await mouseDrag(page, "h5", "f7", { hold: true });
  assert.strictEqual(await page.locator(".bd-ghost").count(), 0, "no ghost");
  await page.mouse.up();
  await setSetting(page, "board.drag", true);
  assert.ok(await page.locator("#board .bd-can-drag").count() > 0, "live: drag is back");
  step("theme (board.theme) changes the squares at once");
  const dark = () => page.evaluate(() => getComputedStyle(document.querySelector('#board [data-square="a1"]')).backgroundColor);
  const walnut = await dark();
  await setSetting(page, "board.theme", "ocean");
  assert.notStrictEqual(await dark(), walnut);
  assert.strictEqual(await page.evaluate(() => document.documentElement.getAttribute("data-board-theme")), "ocean");
  await setSetting(page, "board.theme", "walnut");
  assert.strictEqual(await dark(), walnut);
  step("last move (board.lastMove) off removes the wash");
  await square(page, "h5").click();
  await square(page, "f7").click();
  assert.ok((await classesAt(page, "f7")).includes("bd-last"));
  await setSetting(page, "board.lastMove", false);
  assert.ok(!(await classesAt(page, "f7")).includes("bd-last"));
  checkProblems("settings", problems);
  await context.close();
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseRgb(text) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(text);
  assert.ok(m, `a colour: ${text}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

async function themesScenario(browser) {
  const { context, page, problems } = await newSession(browser);
  await startFen(page, "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 1 5");
  await square(page, "c4").click();
  const seen = new Set();
  for (const theme of THEMES) {
    await setSetting(page, "board.theme", theme);
    const info = await page.evaluate(() => {
      const bg = (sq) => getComputedStyle(document.querySelector(`#board [data-square="${sq}"]`)).backgroundColor;
      const coordColor = (sq) => getComputedStyle(document.querySelector(`#board [data-square="${sq}"] .coord`)).color;
      return { light: bg("a8"), dark: bg("a7"), h8: bg("h8"), onLight: coordColor("a8"), onDark: coordColor("a1") };
    });
    seen.add(`${info.light}|${info.dark}`);
    assert.notStrictEqual(info.light, info.dark, `${theme}: two different square colours`);
    for (const [name, text, bg] of [["light", info.onLight, info.light], ["dark", info.onDark, info.dark]]) {
      const a = luminance(parseRgb(text));
      const b = luminance(parseRgb(bg));
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      assert.ok(ratio >= 4.5, `${theme}: coordinates on ${name} squares reach 4.5:1 (${ratio.toFixed(2)})`);
    }
    await shot(page, `theme-${theme}`, page.locator("#board"));
  }
  assert.strictEqual(seen.size, THEMES.length, "every theme has its own square colours");
  step(`${THEMES.length} themes: distinct squares, coordinates >= 4.5:1`);
  checkProblems("themes", problems);
  await context.close();
}

async function hintScenario(browser) {
  const { context, page, problems } = await newSession(browser);
  await startFen(page, MATE_FEN, { bestMoveUci: "h5f7", bestMoveSan: "Qxf7#" });
  step("level 1 lights the piece to move");
  await page.locator("#hint-btn").click();
  await page.waitForSelector("#board .square.hint-from");
  assert.strictEqual(await page.locator("#board .square.hint-from").getAttribute("data-square"), "h5");
  assert.strictEqual(await page.locator("#board .square.hint-to").count(), 0);
  assert.match(await square(page, "h5").getAttribute("aria-label"), /hint|pista/i, "not colour alone");
  const glow = await page.evaluate(() => getComputedStyle(document.querySelector("#board .square.hint-from"), "::before").backgroundImage);
  assert.match(glow, /radial-gradient/, "the spotlight is painted");
  step("level 2 also marks the destination and draws an arrow");
  await page.locator("#hint-btn").click();
  await page.waitForSelector("#board .square.hint-to");
  assert.strictEqual(await page.locator("#board .square.hint-to").getAttribute("data-square"), "f7");
  assert.strictEqual(await page.locator("#board-arrows .bd-arrow-hint").count(), 1);
  assert.ok((await page.locator("#board-arrows line").count()) >= 1);
  await shot(page, "hint-2", page.locator(".board-wrap"));
  checkProblems("hints", problems);
  await context.close();
}

async function analysisScenario(browser) {
  const { context, page, problems } = await newSession(browser);
  await startFen(page, MATE_FEN, { bestMoveUci: "h5f7", bestMoveSan: "Qxf7#", gameMoveUci: "c4b5", gameMoveSan: "Bb5" });
  await square(page, "c4").click();
  await square(page, "f7").click();
  await waitForResult(page);
  step("the result shows the position again with your arrow; best and game arrows are asked for");
  assert.strictEqual(await pieceAt(page, "c4"), "wB");
  assert.strictEqual(await page.locator("#board-arrows .bd-arrow-user").count(), 1);
  await page.locator("#reveal-best-btn").click();
  await page.locator("#reveal-game-btn").click();
  assert.strictEqual(await page.locator("#board-arrows .bd-arrow-best").count(), 1);
  assert.strictEqual(await page.locator("#board-arrows .bd-arrow-game").count(), 1);
  const dashed = await page.evaluate(() => getComputedStyle(document.querySelector("#board-arrows .bd-arrow-game .board-arrow-line")).strokeDasharray);
  assert.notStrictEqual(dashed, "none", "the game arrow is dashed (not colour alone)");
  const colours = await page.evaluate(() => ["best", "user", "game"].map((k) => getComputedStyle(document.querySelector(`#board-arrows .bd-arrow-${k} .board-arrow-line`)).stroke));
  assert.strictEqual(new Set(colours).size, 3, `three distinct arrow colours (${colours})`);
  assert.ok((await classesAt(page, "f7")).includes("best-to") && (await classesAt(page, "c4")).includes("game-from"));
  await shot(page, "result-arrows", page.locator(".board-wrap"));
  step("explore the board: a dragged move is played without scoring, the arrows step aside");
  await page.locator("#result-analysis-btn").click();
  await page.waitForFunction(() => STATE.ui.phase === "result_analysis");
  assert.ok((await classesAt(page, "c4")).includes("bd-can-drag"), "the analysis board is playable");
  await mouseDrag(page, "c4", "d5");
  assert.strictEqual(await pieceAt(page, "d5"), "wB");
  assert.ok((await classesAt(page, "d5")).includes("bd-last"));
  assert.strictEqual(await page.locator("#board-arrows .bd-arrow").count(), 0, "the old arrows would point at the wrong squares");
  assert.strictEqual(await page.locator("#board .best-to").count(), 0);
  step("reset brings the position and the arrows back, and the bishop slides home");
  await page.locator("#result-analysis-reset-btn").click();
  await page.waitForFunction(() => document.querySelectorAll("#board-arrows .bd-arrow").length > 0);
  assert.strictEqual(await pieceAt(page, "c4"), "wB");
  assert.strictEqual(await pieceAt(page, "d5"), null);
  step("an analysis promotion asks for the piece too");
  checkProblems("analysis", problems);
  await context.close();
}

async function castleScenario(browser) {
  const { context, page, problems } = await newSession(browser);
  await startFen(page, CASTLE_FEN);
  await setSetting(page, "board.animation", "on");
  await page.evaluate(() => {
    window.__anims = [];
    const original = Element.prototype.animate;
    Element.prototype.animate = function patched(frames, options) {
      window.__anims.push({ piece: this.dataset && this.dataset.piece, frames: JSON.stringify(frames) });
      return original.call(this, frames, options);
    };
  });
  step("castling by drag of the king: both pieces end on their squares, the rook slides");
  await mouseDrag(page, "e1", "g1");
  assert.strictEqual(await pieceAt(page, "g1"), "wK");
  assert.strictEqual(await pieceAt(page, "f1"), "wR");
  const slid = await page.evaluate(() => window.__anims.filter((a) => /translate/.test(a.frames)).map((a) => a.piece));
  assert.ok(slid.includes("wR"), `the rook slides (${slid})`);
  assert.ok(!slid.includes("wK"), "the king was dropped where it is, it does not slide again");
  await waitForResult(page);
  checkProblems("castling", problems);
  await context.close();
}

async function crispScenario(browser) {
  const { context, page, problems } = await newSession(browser, { deviceScaleFactor: 3 });
  await startFen(page, MATE_FEN, { bestMoveUci: "h5f7" });
  step("pieces are vector images that fill their square (crisp at DPR 3)");
  const info = await page.evaluate(() => {
    const sq = document.querySelector('#board [data-square="h5"]').getBoundingClientRect();
    const img = document.querySelector('#board [data-square="h5"] .bd-piece');
    const r = img.getBoundingClientRect();
    return { dpr: window.devicePixelRatio, src: img.currentSrc, w: r.width, sq: sq.width, natural: img.naturalWidth, complete: img.complete };
  });
  assert.strictEqual(info.dpr, 3);
  assert.match(info.src, /\.svg$/);
  assert.ok(info.complete && info.natural > 0);
  assert.ok(Math.abs(info.w - info.sq) < 0.5, "the piece element fills the square");
  await shot(page, "dpr3", page.locator("#board"));
  step("a render takes under 4 ms, and moving pieces never moves the board");
  const stats = await page.evaluate(() => {
    const before = document.getElementById("board").getBoundingClientRect().toJSON();
    const times = [];
    const fens = ["r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 1 5", "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 b kq - 2 5"];
    Ludus.Settings.set("board.animation", "off");
    for (let i = 0; i < 120; i += 1) {
      STATE.board = new Chess(fens[i % 2]);
      const t = performance.now();
      renderBoard();
      times.push(performance.now() - t);
    }
    const after = document.getElementById("board").getBoundingClientRect().toJSON();
    times.sort((a, b) => a - b);
    return { avg: times.reduce((a, b) => a + b, 0) / times.length, p95: times[Math.floor(times.length * 0.95)], before, after };
  });
  console.log(`    render: avg ${stats.avg.toFixed(2)} ms, p95 ${stats.p95.toFixed(2)} ms`);
  assert.ok(stats.avg < 4 && stats.p95 < 8, "renders are cheap");
  assert.deepStrictEqual(stats.after, stats.before, "the board did not move or resize");
  checkProblems("crisp", problems);
  await context.close();
}

async function feedbackScenario(browser) {
  const { context, page, problems } = await newSession(browser);
  await startFen(page, "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1");
  await page.evaluate(() => {
    window.__fb = [];
    Ludus.Audio.play = (kind) => { window.__fb.push(["play", kind]); return true; };
    Ludus.Audio.haptic = (kind) => { window.__fb.push(["haptic", kind]); return true; };
  });
  const seen = () => page.evaluate(() => { const list = window.__fb.slice(); window.__fb.length = 0; return list; });
  step("a capture plays the capture sound and vibrates");
  await mouseDrag(page, "e4", "d5");
  assert.strictEqual(await pieceAt(page, "d5"), "wP");
  assert.deepStrictEqual(await seen(), [["play", "capture"], ["haptic", "capture"]]);
  await context.close();

  step("a quiet move plays the move sound; a move that gives check plays the check sound");
  const quiet = await newSession(browser);
  await startFen(quiet.page, "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1");
  await quiet.page.evaluate(() => {
    window.__fb = [];
    Ludus.Audio.play = (kind) => { window.__fb.push(["play", kind]); return true; };
    Ludus.Audio.haptic = (kind) => { window.__fb.push(["haptic", kind]); return true; };
  });
  await square(quiet.page, "e2").click();
  await square(quiet.page, "e3").click();
  assert.deepStrictEqual(await quiet.page.evaluate(() => window.__fb), [["play", "move"], ["haptic", "move"]]);
  await quiet.context.close();
  const check = await newSession(browser);
  await startFen(check.page, MATE_FEN, { bestMoveUci: "h5f7" });
  await check.page.evaluate(() => {
    window.__fb = [];
    Ludus.Audio.play = (kind) => { window.__fb.push(["play", kind]); return true; };
    Ludus.Audio.haptic = (kind) => { window.__fb.push(["haptic", kind]); return true; };
  });
  await mouseDrag(check.page, "h5", "f7");
  assert.deepStrictEqual(await check.page.evaluate(() => window.__fb.slice(0, 2)), [["play", "check"], ["haptic", "check"]]);
  await waitForResult(check.page);
  step("moves on the analysis board make their sound too");
  await check.page.evaluate(() => { window.__fb.length = 0; });
  await check.page.locator("#result-analysis-btn").click();
  await square(check.page, "h5").click();
  await square(check.page, "h4").click();
  assert.deepStrictEqual(await check.page.evaluate(() => window.__fb), [["play", "move"], ["haptic", "move"]]);
  checkProblems("feedback", problems.concat(quiet.problems, check.problems));
  await check.context.close();
}

async function blackScenario(browser) {
  for (const locale of ["es-AR", "en-US"]) {
    const { context, page, problems } = await newSession(browser, { locale });
    await startFen(page, "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
    step(`${locale}: Black at the bottom, the board is mirrored`);
    assert.strictEqual(await page.evaluate(() => document.querySelector("#board .square").dataset.square), "h1");
    assert.strictEqual(await page.locator("#board").getAttribute("data-orientation"), "b");
    const box = await page.locator("#board").boundingBox();
    const h1 = await square(page, "h1").boundingBox();
    assert.ok(h1.x < box.x + 2 && h1.y < box.y + 2, "h1 is the top-left square");
    assert.ok((await classesAt(page, "e7")).includes("bd-can-drag"), "Black's pieces are the movable ones");
    assert.ok(!(await classesAt(page, "e4")).includes("bd-can-drag"));
    await mouseDrag(page, "e7", "e5");
    assert.strictEqual(await pieceAt(page, "e5"), "bP");
    const label = await square(page, "e5").getAttribute("aria-label");
    assert.match(label, /e5/);
    assert.match(label, locale === "es-AR" ? /peón negro/ : /black pawn/);
    // Arrow keys follow the screen: up is towards rank 1 for Black.
    await square(page, "a8").focus();
    await page.keyboard.press("ArrowUp");
    assert.strictEqual(await page.evaluate(() => document.activeElement.dataset.square), "a7");
    checkProblems(`black ${locale}`, problems);
    await context.close();
  }
}

async function axeScenario(browser) {
  const axePath = process.env.LUDUS_AXE;
  if (!axePath) {
    step("skipped: set LUDUS_AXE=/path/to/axe.min.js to run it");
    return;
  }
  const source = fs.readFileSync(axePath, "utf8");
  const { context, page, problems } = await newSession(browser, { bypassCSP: true });
  await page.addScriptTag({ content: source });
  const scan = async (label) => {
    // Scoped to the board and what lives in its wrap (arrows, picker, live region): the panels around it are other screens' work.
    const violations = await page.evaluate(async () => (await axe.run({ include: [[".board-wrap"]] }, { resultTypes: ["violations"] })).violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`));
    assert.deepStrictEqual(violations, [], `axe (${label}): ${violations.join(" | ")}`);
  };
  await startFen(page, MATE_FEN, { bestMoveUci: "h5f7", gameMoveUci: "c4b5" });
  await scan("idle");
  await square(page, "h5").click();
  await scan("selected");
  await page.locator("#hint-btn").click();
  await scan("hint");
  await square(page, "h5").click();
  await square(page, "c4").click();
  await square(page, "f7").click();
  await waitForResult(page);
  await page.locator("#reveal-best-btn").click();
  await scan("result with arrows");
  await page.locator("#result-analysis-btn").click();
  await scan("analysis");
  step("five states, no serious or critical violations");
  checkProblems("axe", problems);
  await context.close();
}

// ---------- main ----------

const scenarios = [
  ["click move", clickMove],
  ["mouse drag", mouseDragScenario],
  ["touch drag", touchDragScenario],
  ["keyboard move", keyboardScenario],
  ["cancel", cancelScenario],
  ["promotion by drag", promotionScenario],
  ["animation", animationScenario],
  ["settings live", settingsScenario],
  ["themes", themesScenario],
  ["hints", hintScenario],
  ["analysis", analysisScenario],
  ["castling", castleScenario],
  ["crisp + performance", crispScenario],
  ["feedback", feedbackScenario],
  ["black side", blackScenario],
  ["axe", axeScenario],
];

(async () => {
  const browser = await launchBrowser();
  let failed = false;
  try {
    for (const [name, run] of scenarios) {
      if (ONLY && !name.includes(ONLY)) continue;
      console.log(`scenario: ${name}`);
      await run(browser);
    }
  } catch (error) {
    failed = true;
    console.error(error && error.stack ? error.stack : error);
  } finally {
    await browser.close();
  }
  if (failed) process.exit(1);
  console.log("board e2e passed");
})();
