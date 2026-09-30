// Browser end-to-end check of the "track" screens in real Chromium: the mistake notebook (js/ui/notebook.js,
// css/notebook.css) and the progress dashboard (js/ui/progress.js, css/progress.css).
//
// Playwright is NOT a project dependency (the app has no runtime or dev dependencies) and this script is
// not part of `npm test`. Run it by hand:
//
//   python3 -m http.server 5010 &                      # serve the repo root
//   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/track.js
//
// Environment (all optional):
//   LUDUS_URL             page to test               (default http://127.0.0.1:5010/index.html)
//   LUDUS_E2E_ONLY        run only the scenarios whose name contains this text (e.g. "review")
//   LUDUS_CHROMIUM        chrome binary if Playwright cannot launch its own
//                         (falls back to /opt/pw-browsers/chromium-1194/chrome-linux/chrome)
//   LUDUS_E2E_SHOTS       directory for screenshots (none are saved when unset)
//   LUDUS_AXE             path to axe.min.js: turns on the axe scenario (axe-core is not a project dependency)
//
// The learner is seeded through the REAL Ludus.Profile API (scripts/e2e/track-seed.js: about 150 rounds across
// 40 days, varied qualities, tags, phases and sources, reviewed cards, cards that are due), never by writing
// storage. Scenarios (each in a fresh context with service workers blocked, CSP enforced):
//   notebook            the summary against Profile.notebook.counts; the 5 / 10 / 20 picker; the box chart and its
//                       table; weak spots; the list (boards with the best-move arrow, origin, moves, pips, dates);
//                       status, text, theme, phase, origin, quality filters and the three sorts; show more; the
//                       lesson dialog; the stored lines; the confirmed removal
//   review              "Review N now" starts a real review session (kind, title, the cards in due order, source
//                       notebook, card ids, references only from complete lines); a card is answered with its best
//                       move and Profile has graded it (box up, history with the round id, next date); a card is
//                       answered badly and it went back to box 1 with a lapse; one card with no stored lines is
//                       analysed at the root; "Train this weakness" only takes that theme; the screen never grades
//   notebook states     an empty notebook (invitation, buttons), nothing due (when the next card comes back, practise
//                       anyway starts a practice session)
//   progress            level, XP and streak against Profile.stats; the numbers; the heatmap (cells add up to the
//                       rounds, a list as its alternative); the trend (focusable points, arrow keys, tooltip, table,
//                       improvement); phases, origins, qualities; weak themes and their links (notebook filtered,
//                       lesson); achievements and filters; recent sessions; the profile switcher
//   progress states     empty (what is missing and how to get it), partial (3 rounds), streak at risk
//   layout              7 viewports x es / en on both screens: no horizontal scroll, nothing outside the window,
//                       no raw i18n keys, touch targets of 44px, screenshots when LUDUS_E2E_SHOTS is set
//   motion + focus      reduced motion stops the transitions; keyboard focus shows a ring on controls and on the
//                       points of the chart
//   axe (optional)      with LUDUS_AXE=/path/to/axe.min.js: no serious or critical violations on every state
//
// Every scenario fails on any console error, uncaught page error or failed request.
// Exits 0 on success, 1 on the first failed assertion, 2 if Playwright is missing.

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { seedProfile } = require("./track-seed.js");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright is not installed. Run with NODE_PATH=/opt/node22/lib/node_modules (see the header of this file).");
  process.exit(2);
}

const BASE_URL = process.env.LUDUS_URL || "http://127.0.0.1:5010/index.html";
const FALLBACK_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SHOT_DIR = process.env.LUDUS_E2E_SHOTS || "";
const ONLY = process.env.LUDUS_E2E_ONLY || "";
const RESULT_TIMEOUT_MS = 90000;

const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "820x1180", width: 820, height: 1180 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1440x900", width: 1440, height: 900 },
];

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

async function shot(page, name, fullPage = true) {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `track-${name}.png`), fullPage });
}

// A returning visitor (no landing page), in the language of the scenario, optionally with a seeded learner.
async function newSession(browser, options = {}) {
  const { lang = "es", seed = null, viewport = { width: 1280, height: 900 }, bypassCSP = false, ...contextOptions } = options;
  const context = await browser.newContext(Object.assign({
    viewport,
    serviceWorkers: "block",
    bypassCSP,
    deviceScaleFactor: 1,
  }, contextOptions));
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
  await page.addInitScript((language) => {
    try {
      if (!sessionStorage.getItem("__track_init")) {
        sessionStorage.setItem("__track_init", "1");
        localStorage.setItem("ludus.seen.v1", "1");
        localStorage.setItem("ludus.language", language);
      }
    } catch (error) {
      // storage may be blocked; the app copes
    }
  }, lang);
  await page.goto(BASE_URL);
  await page.waitForFunction(() => window.Ludus && Ludus.game && Ludus.Screens && Ludus.Screens.notebook && Ludus.Screens.progress && Ludus.Profile);
  let seedInfo = null;
  if (seed) {
    seedInfo = await seedProfile(page, seed === true ? {} : seed);
    // The seed unlocks achievements: their toasts are not what the scenario is about.
    await page.evaluate(() => Ludus.ui.clearToasts());
  }
  return { context, page, problems, seedInfo };
}

function checkProblems(label, problems) {
  assert.deepStrictEqual(problems, [], `${label}: the page reported problems:\n  ${problems.join("\n  ")}`);
}

async function openNotebook(page, params) {
  await page.evaluate((p) => Ludus.router.show("notebook", p), params || undefined);
  await page.waitForSelector("#screen-notebook .notebook-title", { timeout: 10000 });
  await page.waitForSelector("#screen-notebook .notebook-summary, #screen-notebook .notebook-empty", { timeout: 10000 });
}

async function openProgress(page, params) {
  await page.evaluate((p) => Ludus.router.show("progress", p), params || undefined);
  await page.waitForSelector("#screen-progress .progress-hero", { timeout: 10000 });
}

const routerCurrent = (page) => page.evaluate(() => Ludus.router.current());
const txt = (page, selector) => page.locator(selector).first().innerText().then((value) => value.replace(/\s+/g, " ").trim());

function noRawKeys(text, label) {
  const raw = text.match(/\b(notebook|progress|achievement|quality|insight)\.[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*/g);
  assert.ok(!raw, `${label}: raw i18n keys on screen: ${raw && raw.join(", ")}`);
}

const square = (page, name) => page.locator(`#board .square[data-square="${name}"]`);

async function playUci(page, uci) {
  await square(page, uci.slice(0, 2)).click();
  await square(page, uci.slice(2, 4)).click();
  if (uci.length > 4) await page.locator(`#promotion-choice-${uci[4]}`).click();
}

async function waitForResult(page) {
  await page.waitForFunction(() => {
    const overlay = document.getElementById("result-overlay");
    const points = document.getElementById("result-overlay-points");
    return Boolean(overlay && !overlay.classList.contains("hidden") && points && /\d/.test(points.textContent));
  }, null, { timeout: RESULT_TIMEOUT_MS });
}

// The play screen is up with a review session.
async function expectReviewSession(page, count) {
  await page.waitForFunction(() => Ludus.router.current() === "game" && Ludus.game.isActive(), null, { timeout: 15000 });
  const info = await page.evaluate(() => {
    const s = Ludus.game.session();
    return {
      kind: s.kind,
      title: s.title,
      count: s.positions,
      positions: STATE.positions.map((p) => ({
        id: p.id,
        cardId: p.cardId,
        source: p.source,
        fen: p.fen,
        tags: p.tags,
        best: p.bestMoveUci || null,
        hasReference: Boolean(p.reference),
        lines: p.reference ? p.reference.lines.map((l) => l.uci) : [],
      })),
    };
  });
  assert.strictEqual(info.kind, "review", "session kind");
  if (count !== undefined) assert.strictEqual(info.count, count, "session length");
  await page.waitForSelector("#board .square[data-square='e4']");
  return info;
}

async function leaveGame(page) {
  await page.evaluate(() => Ludus.game.abort());
  await page.waitForFunction(() => !Ludus.game.isActive());
}

const cardOf = (page, id) => page.evaluate((cardId) => Ludus.Profile.notebook.get(cardId), id);

// A legal move that is not one of the given UCI moves (a mistake), or the first legal one.
const legalMoves = (page, fen) => page.evaluate((f) => {
  const { Chess, moveToUci } = Ludus.chess;
  return new Chess(f).generateMoves().map(moveToUci);
}, fen);

// Plays whatever the position needs: the given move, else the first legal one.
async function answer(page, position, uci) {
  const move = uci || (await legalMoves(page, position.fen))[0];
  await playUci(page, move);
  await waitForResult(page);
  return move;
}

// A few cards that are NOT due (mistakes reviewed and passed just now), through the real API.
async function seedNotDue(page, count) {
  return page.evaluate(async (n) => {
    await Ludus.Classics.load();
    const list = Ludus.Classics.random(n, {});
    const Profile = Ludus.Profile;
    Profile.ensureActive();
    const now = Date.now();
    const { Chess, moveToUci, moveToSan } = Ludus.chess;
    list.forEach((position, i) => {
      const chess = new Chess(position.fen);
      const moves = chess.generateMoves();
      const lines = position.reference.lines.slice(0, 3);
      const base = {
        sessionId: "s_nd", fen: position.fen, sideToMove: chess.turn, phase: "middlegame", userUci: moveToUci(moves[0]), userSan: moveToSan(chess, moves[0]),
        bestUci: lines[0].uci, bestSan: lines[0].san || "", winLossPct: 20, cpLoss: 100, rank: 3, onlyMove: false, timeSpentMs: 8000, hintsUsed: 0, timedOut: false,
        tags: i % 2 ? ["fork_available"] : ["hangs_piece"], lines, meta: position.meta || {},
      };
      Profile.recordRound(Object.assign({ id: `r_nd_a${i}`, ts: now - 3 * 86400000 - i * 1000, source: "classic", sessionKind: "classic", accuracy: 20, points: 2, qualityCode: "blunder", isBest: false }, base));
      Profile.recordRound(Object.assign({ id: `r_nd_b${i}`, ts: now - 60000 - i * 1000, source: "notebook", sessionKind: "review", accuracy: 92, points: 9.2, qualityCode: "very_good", isBest: true }, base, { tags: [] }));
    });
    return Profile.notebook.counts();
  }, count);
}

// ---------- layout checks ----------

// Interactive controls must be at least 44 CSS px in both directions. The system grows the hit area of small
// buttons and chips with a pseudo element (css/system.css: .btn-sm 4px each side, chips 6px), so those are
// measured with that margin. The points of the trend chart are reached by the crosshair (the nearest session
// to the pointer), not by hitting a dot, so they are exempt; the plot itself is checked to be big.
async function smallTargets(page, scopeSelector) {
  return page.evaluate((scope) => {
    const root = document.querySelector(scope) || document.body;
    const out = [];
    root.querySelectorAll("button, a[href], input:not([type=hidden]), select, summary, [role=tab]").forEach((el) => {
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none" || el.closest("[hidden]") || el.closest(".sr-only")) return;
      if (el.closest("details:not([open])") && el.tagName !== "SUMMARY") return;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      if (el.closest("nav.sh-nav, .sh-header, .sh-tabbar")) return; // the shell has its own check
      let w = r.width;
      let h = r.height;
      if (el.classList.contains("btn-sm")) { w += 4; h += 8; }
      if (el.matches("button.chip, a.chip")) { w += 4; h += 12; }
      if (w < 43.5 || h < 43.5) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)}"`);
    });
    return out;
  }, scopeSelector);
}

// Nothing may stick out of the window: every element of the screen is inside it, except what sits in a
// container that scrolls on purpose (the weak spots strip and the status pills), whose own box must be inside.
async function outsideWindow(page, scopeSelector) {
  return page.evaluate((scope) => {
    const root = document.querySelector(scope);
    const vw = document.documentElement.clientWidth;
    const out = [];
    root.querySelectorAll("*").forEach((el) => {
      if (el.closest(".sr-only") || el.closest("[hidden]") || el.closest(".notebook-weak-list") || el.closest(".notebook-status")) return;
      if (el.closest("svg") && !el.matches("svg")) return; // inner SVG geometry is clipped by its own viewBox
      const style = getComputedStyle(el);
      if (style.display === "none" || style.position === "fixed") return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.left < -1 || r.right > vw + 1) out.push(`${el.tagName.toLowerCase()}.${String(el.className.baseVal !== undefined ? el.className.baseVal : el.className).split(" ").slice(0, 2).join(".")} [${Math.round(r.left)}, ${Math.round(r.right)}] of ${vw}`);
    });
    return out.slice(0, 8);
  }, scopeSelector);
}

async function checkLayout(page, label, scope, name) {
  await page.waitForTimeout(150);
  const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert.ok(overflow.sw <= overflow.cw, `${label}: horizontal scroll ${overflow.sw} > ${overflow.cw}`);
  const outside = await outsideWindow(page, scope);
  assert.deepStrictEqual(outside, [], `${label}: elements outside the window:\n  ${outside.join("\n  ")}`);
  noRawKeys(await page.locator(scope).innerText(), label);
  const small = await smallTargets(page, scope);
  assert.deepStrictEqual(small, [], `${label}: targets under 44px:\n  ${small.join("\n  ")}`);
  await shot(page, name || label.replace(/\W+/g, "-"));
}

// ---------- scenarios: notebook ----------

async function notebookScenario(browser) {
  const s = await newSession(browser, { lang: "en", seed: true });
  const { page } = s;
  await openNotebook(page);
  const counts = await page.evaluate(() => Ludus.Profile.notebook.counts());
  const cards = await page.evaluate(() => Ludus.Profile.notebook.list({ sort: "due" }));
  assert.ok(counts.total >= 30 && counts.due >= 10 && counts.cleared >= 3, `a realistic notebook: ${JSON.stringify(counts)}`);

  step("the summary agrees with Profile.notebook.counts; the action says how many it takes");
  assert.strictEqual(await txt(page, ".notebook-due-count"), String(counts.due));
  assert.strictEqual(await txt(page, ".notebook-due-label"), "to review now");
  assert.strictEqual(await txt(page, "#notebook-start"), `Review ${Math.min(counts.due, 10)} now`);
  const stats = await page.locator(".notebook-stat-value").allInnerTexts();
  assert.deepStrictEqual(stats, [String(counts.total), String(cards.filter((c) => c.box >= 3).length), String(counts.new)]);
  assert.strictEqual(await page.locator(".notebook-boxes tbody tr").count(), 6, "the box chart has a table alternative");
  assert.deepStrictEqual(await page.locator(".notebook-boxes tbody tr td").allInnerTexts(), counts.byBox.map(String));
  assert.strictEqual(await page.locator(".notebook-boxes-svg .notebook-bar, .notebook-boxes-svg .notebook-bar-stub").count(), 6);
  assert.ok(await page.locator(".notebook-boxes-svg").evaluate((svg) => svg.getAttribute("aria-hidden") === "true"), "the drawing is hidden, the table speaks");

  step("the 5 / 10 / 20 picker changes the action and is remembered after a reload");
  await page.locator('.notebook-size-seg [data-size="5"]').click();
  assert.strictEqual(await txt(page, "#notebook-start"), "Review 5 now");
  assert.strictEqual(await page.evaluate(() => document.activeElement.getAttribute("data-size")), "5", "the focus stays on the picker");
  await page.locator('.notebook-size-seg [data-size="20"]').click();
  assert.strictEqual(await txt(page, "#notebook-start"), `Review ${Math.min(counts.due, 20)} now`);
  await page.reload();
  await page.waitForFunction(() => window.Ludus && Ludus.Screens && Ludus.Screens.notebook);
  await openNotebook(page);
  assert.strictEqual(await page.locator('.notebook-size-seg [data-size="20"]').getAttribute("aria-pressed"), "true", "remembered");
  await page.locator('.notebook-size-seg [data-size="10"]').click();

  step("weak spots: the most repeated open themes, each with its own training button");
  const weak = await page.locator(".notebook-weak-item").count();
  assert.ok(weak >= 2 && weak <= 4, `weak spots: ${weak}`);
  const firstTag = await page.locator(".notebook-weak-train").first().getAttribute("data-tag");
  const tagCards = cards.filter((c) => c.tags.includes(firstTag)).length;
  assert.ok(/\d+ cards? · \d+ not cleared/.test(await txt(page, ".notebook-weak-count")));
  assert.ok(tagCards >= 2);

  step("the list: a mini board with the best-move arrow, origin, your move and the best one, pips and dates");
  const shown = await page.locator(".notebook-card").count();
  assert.strictEqual(shown, Math.min(12, counts.total));
  const first = page.locator(".notebook-card").first();
  assert.strictEqual(await first.locator("svg.mini-board").count(), 1);
  const dueCard = cards[0];
  assert.strictEqual(await first.getAttribute("data-card"), dueCard.id, "the most overdue card first");
  const orientation = await first.locator("svg.mini-board").getAttribute("data-orientation");
  assert.strictEqual(orientation, dueCard.sideToMove, "the board looks from the side to move");
  if (dueCard.bestUci) assert.strictEqual(await first.locator(".mb-arrow").count(), 1, "the best move as an arrow");
  const cardText = await first.innerText();
  assert.ok(/Your move/.test(cardText) && /The best/.test(cardText), cardText);
  assert.ok(/Box \d of 5|New card/.test(await first.locator(".notebook-pips").getAttribute("aria-label")));
  assert.strictEqual(await first.locator(".notebook-pip").count(), 5);
  assert.ok(/Due|Overdue|Today/.test(await first.locator(".notebook-when").innerText()));
  assert.ok(await first.locator(".notebook-card-title").innerText());
  await shot(page, "notebook-desktop-en-top", false);

  step("status pills: due, new, learning, cleared each show what Profile counts");
  const total = () => page.locator(".notebook-count").innerText().then((v) => v.replace(/\s+/g, " ").trim());
  await page.locator('.notebook-status [data-status="due"]').click();
  assert.strictEqual(await total(), `${counts.due} of ${counts.total} cards`);
  await page.locator('.notebook-status [data-status="cleared"]').click();
  assert.strictEqual(await total(), counts.cleared === counts.total ? `${counts.total} cards` : `${cards.filter((c) => c.box >= 3).length} of ${counts.total} cards`);
  assert.ok((await page.locator(".notebook-card").count()) === 0 || (await page.locator(".notebook-card:not(.is-cleared)").count()) === 0, "only cleared cards");
  await page.locator('.notebook-status [data-status="new"]').click();
  assert.strictEqual(await total(), `${counts.new} of ${counts.total} cards`);
  await page.locator('.notebook-status [data-status="learning"]').click();
  assert.strictEqual(await total(), `${cards.filter((c) => c.box < 3 && c.reviews > 0).length} of ${counts.total} cards`);
  await page.locator('.notebook-status [data-status="all"]').click();

  step("text, theme, phase, origin and quality filters combine and can be cleared");
  const someone = (await page.evaluate(() => Ludus.Profile.notebook.list({}).map((c) => c.meta.players).filter(Boolean)))[0];
  const word = someone.split(/\s+/)[0].replace(/[^\p{L}\d]/gu, "");
  await page.locator("#notebook-search").fill(word.toLowerCase());
  await page.waitForFunction((n) => document.querySelectorAll(".notebook-card").length <= n, counts.total);
  const expectedText = await page.evaluate((w) => Ludus.Profile.notebook.list({}).filter((c) => `${c.meta.players || ""} ${c.meta.event || ""}`.toLowerCase().includes(w.toLowerCase())).length, word);
  assert.ok(expectedText >= 1);
  await page.waitForFunction((n) => /of \d+ cards|^\d+ cards?$/.test(document.querySelector(".notebook-count").textContent) && document.querySelector(".notebook-count").textContent.trim().startsWith(String(n)), expectedText, { timeout: 5000 }).catch(() => {});
  assert.ok(!(await page.locator(".notebook-clear").isHidden()), "clear filters appears");
  await page.locator(".notebook-clear").click();
  assert.strictEqual(await page.locator("#notebook-search").inputValue(), "");
  await page.locator(".notebook-more-summary").click();
  await page.selectOption("#notebook-f-tag", firstTag);
  assert.strictEqual(await page.locator(".notebook-card").count(), Math.min(12, tagCards));
  assert.ok(/More filters \(1\)/.test(await txt(page, ".notebook-more-summary")));
  const phase = await page.evaluate((tag) => Ludus.Profile.notebook.list({ tag })[0].phase, firstTag);
  assert.ok(phase, "the cards know their phase");
  await page.selectOption("#notebook-f-phase", phase);
  const both = await page.evaluate((args) => Ludus.Profile.notebook.list({ tag: args.tag, phase: args.phase }).length, { tag: firstTag, phase });
  assert.strictEqual(await page.locator(".notebook-card").count(), Math.min(12, both));
  await page.selectOption("#notebook-f-phase", "all");
  await page.selectOption("#notebook-f-tag", "all");
  await page.selectOption("#notebook-f-source", "classic");
  const classic = await page.evaluate(() => Ludus.Profile.notebook.list({ source: "classic" }).length);
  assert.strictEqual(await page.locator(".notebook-card").count(), Math.min(12, classic));
  await page.selectOption("#notebook-f-source", "all");
  // How bad the mistake was: the four buckets split the notebook, and every card shows a badge of its bucket.
  let bucketed = 0;
  for (const quality of ["blunder", "bad", "dubious", "mild"]) {
    await page.selectOption("#notebook-f-quality", quality);
    const n = Number((await total()).split(" ")[0]);
    bucketed += n;
    const badges = await page.locator(".notebook-card .q-badge").evaluateAll((els) => els.map((el) => el.className));
    const wrong = badges.filter((c) => (quality === "mild" ? /q-(blunder|bad|dubious)\b/.test(c) : !new RegExp(`q-${quality}\\b`).test(c)));
    assert.deepStrictEqual(wrong, [], `quality ${quality}: every visible card has a badge of that kind`);
  }
  assert.strictEqual(bucketed, counts.total, "the four buckets add up to the notebook");
  await page.selectOption("#notebook-f-quality", "all");
  await page.locator("#notebook-search").fill("zzzz-nothing");
  await page.waitForSelector(".notebook-list-empty");
  assert.match(await txt(page, ".notebook-list-empty"), /No card matches/);
  await page.locator(".notebook-list-empty button").click();
  assert.strictEqual(await page.locator(".notebook-card").count(), Math.min(12, counts.total));

  step("sorting: next review, most recent, worst first");
  const order = () => page.locator(".notebook-card").evaluateAll((els) => els.map((el) => el.getAttribute("data-card")));
  assert.deepStrictEqual(await order(), cards.slice(0, 12).map((c) => c.id), "by next review, like Profile");
  await page.selectOption("#notebook-sort", "recent");
  const recent = await page.evaluate(() => Ludus.Profile.notebook.list({ sort: "created" }).slice(0, 12).map((c) => c.id));
  assert.deepStrictEqual(await order(), recent);
  await page.selectOption("#notebook-sort", "worst");
  const accuracies = await page.locator(".notebook-card").evaluateAll((els) => els.map((el) => el.getAttribute("data-card")));
  const worst = await page.evaluate((ids) => ids.map((id) => Ludus.Profile.notebook.get(id).lastAccuracy), accuracies);
  assert.deepStrictEqual(worst, worst.slice().sort((a, b) => (a === null ? 101 : a) - (b === null ? 101 : b)), "lowest last accuracy first");
  await page.selectOption("#notebook-sort", "due");

  step("show more adds 12 and moves the focus to the first new card");
  if (counts.total > 12) {
    await page.locator(".notebook-more-btn").click();
    assert.strictEqual(await page.locator(".notebook-card").count(), Math.min(24, counts.total));
    assert.ok(await page.evaluate(() => document.activeElement.classList.contains("notebook-card-title")));
  }

  step("a theme chip opens its lesson in a dialog with a board and the example move; Escape closes it and gives the focus back");
  const chip = page.locator("button.notebook-tag").first();
  await chip.scrollIntoViewIfNeeded();
  await chip.click();
  const modal = page.locator(".notebook-concept-modal");
  await modal.waitFor({ state: "visible" });
  assert.ok((await modal.locator(".notebook-concept").count()) >= 1);
  assert.ok((await modal.locator("svg.mini-board .mb-arrow").count()) >= 1, "the example move as an arrow");
  assert.match(await modal.innerText(), /Move of the example/);
  await page.keyboard.press("Escape");
  await modal.waitFor({ state: "detached" });
  assert.ok(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("notebook-tag")), "the focus comes back to the chip");

  step("the stored lines and the history of a card open under it");
  const toggle = page.locator(".notebook-lines-toggle").first();
  await toggle.click();
  assert.strictEqual(await toggle.getAttribute("aria-expanded"), "true");
  const panel = page.locator(".notebook-panel:visible").first();
  await panel.waitFor({ state: "visible" });
  assert.ok((await panel.locator(".notebook-line").count()) >= 1 || /No lines are stored yet/.test(await panel.innerText()));
  assert.ok((await panel.locator(".notebook-history-item").count()) >= 1);

  step("removing a card asks first: cancel keeps it, confirming deletes it and the focus is not lost");
  const victim = page.locator(".notebook-card").nth(1);
  const victimId = await victim.getAttribute("data-card");
  await victim.locator(".notebook-remove").click();
  const dialog = page.locator(".modal[role=alertdialog]");
  await dialog.waitFor({ state: "visible" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await dialog.waitFor({ state: "detached" });
  assert.notStrictEqual(await cardOf(page, victimId), null, "cancel keeps the card");
  await page.locator(`.notebook-card[data-card="${victimId}"] .notebook-remove`).click();
  await dialog.waitFor({ state: "visible" });
  await dialog.getByRole("button", { name: "Remove card" }).click();
  await dialog.waitFor({ state: "detached" });
  await page.waitForFunction((id) => !document.querySelector(`.notebook-card[data-card="${id}"]`), victimId);
  assert.strictEqual(await cardOf(page, victimId), null, "removed from the profile");
  assert.ok(await page.evaluate(() => document.activeElement && document.activeElement.id === "notebook-list-title"), "the focus went to the list heading");
  await page.waitForSelector(".toast", { timeout: 3000 });
  assert.match(await page.locator(".toast").first().innerText(), /Card removed/);
  checkProblems("notebook", s.problems);
  await s.context.close();
}

async function reviewScenario(browser) {
  const s = await newSession(browser, { lang: "en", seed: { noLines: 0.15 } });
  const { page } = s;
  await openNotebook(page);
  const due = await page.evaluate(() => Ludus.Profile.notebook.due(Date.now(), 10));
  const before = await page.evaluate(() => JSON.parse(JSON.stringify(Ludus.Profile.notebook.list({}))));
  assert.ok(due.length >= 5);

  step("Review N now starts a real review session with the due cards, oldest first");
  await page.locator("#notebook-start").click();
  const info = await expectReviewSession(page, due.length);
  assert.strictEqual(info.title, "Notebook review");
  assert.deepStrictEqual(info.positions.map((p) => p.cardId), due.map((c) => c.id), "the due cards in order");
  info.positions.forEach((p, i) => {
    assert.strictEqual(p.source, "notebook");
    assert.strictEqual(p.fen, due[i].fen);
    assert.ok(p.id.startsWith("notebook:c_"));
    const complete = due[i].lines.length >= 2;
    assert.strictEqual(p.hasReference, complete, `card ${i}: the reference exists only with a complete set of lines (${due[i].lines.length} stored)`);
    assert.strictEqual(p.best, complete ? due[i].lines[0].uci : null, "no best move without lines: the round analyses at the root");
  });
  assert.deepStrictEqual(await page.evaluate(() => Ludus.Profile.notebook.list({}).map((c) => [c.id, c.box, c.reviews])), before.map((c) => [c.id, c.box, c.reviews]), "the notebook screen did not grade anything by itself");

  step("the first card is answered with the best move: Profile graded it (box up, history with the round id, a later due date)");
  const first = info.positions[0];
  const cardBefore = before.find((c) => c.id === first.cardId);
  assert.ok(first.best, "the first due card has lines");
  await answer(page, first, first.best);
  assert.match(await page.locator("#result-overlay-points").innerText(), /10 \/ 10/);
  const graded = await cardOf(page, first.cardId);
  assert.strictEqual(graded.reviews, cardBefore.reviews + 1);
  assert.strictEqual(graded.box, Math.min(5, cardBefore.box + 1));
  assert.strictEqual(graded.history[graded.history.length - 1].passed, true);
  const lastRound = await page.evaluate(() => Ludus.Profile.rounds(undefined, { limit: 1 })[0]);
  assert.strictEqual(graded.history[graded.history.length - 1].roundId, lastRound.id, "graded by the recorded round");
  assert.strictEqual(lastRound.source, "notebook");
  assert.strictEqual(lastRound.fen, first.fen, "the round is the card's position (Profile finds the card by its position)");
  assert.strictEqual(lastRound.positionId, first.id);
  assert.ok(graded.due > Date.now() || graded.box === 0, "due later");
  assert.ok(graded.lastAccuracy >= 99);

  step("the next card is answered badly: Profile sent it back to box 1 with a lapse");
  await page.locator("#next-btn").click();
  await page.waitForSelector("#board .square[data-square='e4']");
  const second = info.positions[1];
  const secondBefore = before.find((c) => c.id === second.cardId);
  const moves = await legalMoves(page, second.fen);
  const bad = moves.filter((m) => !second.lines.includes(m));
  assert.ok(bad.length > 0);
  await answer(page, second, bad[bad.length - 1]);
  const graded2 = await cardOf(page, second.cardId);
  const accuracy = graded2.lastAccuracy;
  const passed = accuracy >= 70;
  assert.strictEqual(graded2.reviews, secondBefore.reviews + 1);
  assert.strictEqual(graded2.history[graded2.history.length - 1].passed, passed);
  assert.strictEqual(graded2.box, passed ? Math.min(5, secondBefore.box + 1) : 1, `accuracy ${accuracy}`);
  assert.strictEqual(graded2.lapses, secondBefore.lapses + (passed ? 0 : 1));
  step(`(the move scored ${accuracy}: ${passed ? "still a pass" : "a failed review"})`);
  await leaveGame(page);

  step("back on the notebook: the numbers moved and the two cards are not due any more");
  await openNotebook(page);
  const countsAfter = await page.evaluate(() => Ludus.Profile.notebook.counts());
  const dueAfter = countsAfter.due;
  assert.strictEqual(dueAfter, before.filter((c) => c.due <= Date.now()).length - 2, "the two reviewed cards left the due list (one passed, one failed: both wait for a later day)");
  assert.strictEqual(await txt(page, ".notebook-due-count"), String(dueAfter));
  const notDue = await page.evaluate((ids) => ids.map((id) => Ludus.Profile.notebook.get(id).due > Date.now()), [first.cardId, second.cardId]);
  assert.ok(notDue[0], "the passed card is due later");

  step("one card with no stored lines is reviewed alone and analysed at the root");
  const bare = await page.evaluate(() => Ludus.Profile.notebook.list({}).find((c) => c.lines.length === 0));
  assert.ok(bare, "the seed makes some cards without lines");
  // Like a person would: "show more" until the card is on the page.
  const cardSelector = `.notebook-card[data-card="${bare.id}"]`;
  for (let guard = 0; guard < 20 && !(await page.locator(cardSelector).count()) && (await page.locator(".notebook-more-btn").count()); guard += 1) {
    await page.locator(".notebook-more-btn").click();
  }
  const button = page.locator(`${cardSelector} .notebook-action`).first();
  await button.scrollIntoViewIfNeeded();
  await button.click();
  const single = await expectReviewSession(page, 1);
  assert.strictEqual(single.title, "Review of one card");
  assert.strictEqual(single.positions[0].cardId, bare.id);
  assert.strictEqual(single.positions[0].hasReference, false);
  assert.strictEqual(single.positions[0].best, null);
  await answer(page, single.positions[0]);
  const rootGraded = await cardOf(page, bare.id);
  assert.strictEqual(rootGraded.reviews, bare.reviews + 1, "graded after a root analysis");
  const round = await page.evaluate(() => Ludus.Profile.rounds(undefined, { limit: 1 })[0]);
  assert.ok(round.accuracy >= 0 && round.accuracy <= 100 && round.points >= 0 && round.points <= 10);
  await leaveGame(page);

  step("Train this weakness reviews only the cards of that theme, due ones first");
  await openNotebook(page);
  const tag = await page.locator(".notebook-weak-train").first().getAttribute("data-tag");
  const tagLabel = await txt(page, ".notebook-weak-item:first-child .notebook-weak-name");
  await page.locator(".notebook-weak-train").first().click();
  const trained = await expectReviewSession(page);
  assert.strictEqual(trained.title, `Review: ${tagLabel}`);
  assert.ok(trained.count >= 2 && trained.count <= 10);
  assert.ok(trained.positions.every((p) => p.tags.includes(tag)), "every position has the theme");
  const dueFlags = await page.evaluate((ids) => ids.map((id) => Ludus.Profile.notebook.get(id).due <= Date.now()), trained.positions.map((p) => p.cardId));
  assert.deepStrictEqual(dueFlags, dueFlags.slice().sort((a, b) => Number(b) - Number(a)), "due cards first");
  await leaveGame(page);
  checkProblems("review", s.problems);
  await s.context.close();
}

async function notebookStatesScenario(browser) {
  step("an empty notebook: an invitation, two ways to play, how it works; no summary, no list");
  let s = await newSession(browser, { lang: "es" });
  await openNotebook(s.page);
  assert.strictEqual(await s.page.locator(".notebook-summary").count(), 0);
  assert.match(await txt(s.page, ".notebook-empty"), /Tu cuaderno todavía está vacío/);
  assert.strictEqual(await s.page.locator(".notebook-step").count(), 3);
  await shot(s.page, "notebook-empty-es");
  await s.page.getByRole("button", { name: "Jugar partidas clásicas" }).click();
  assert.strictEqual(await routerCurrent(s.page), "classics");
  await openNotebook(s.page);
  await s.page.getByRole("button", { name: "Analizar tus partidas" }).click();
  await s.page.waitForFunction(() => Ludus.router.current() === "setup", null, { timeout: 5000 });
  checkProblems("notebook empty", s.problems);
  await s.context.close();

  step("nothing due: it says so, when the next card comes back and offers to practise anyway");
  s = await newSession(browser, { lang: "en" });
  const counts = await seedNotDue(s.page, 4);
  assert.strictEqual(counts.due, 0, "every card is waiting for its next date");
  await openNotebook(s.page);
  assert.match(await txt(s.page, ".notebook-clear-title"), /You are all caught up/);
  assert.match(await txt(s.page, ".notebook-due-note"), /Next review: Tomorrow · \w+, \w+ \d+/);
  assert.match(await txt(s.page, ".notebook-due-note"), /\(4 cards\)/);
  assert.strictEqual(await txt(s.page, "#notebook-start"), "Practise anyway");
  assert.match(await txt(s.page, ".notebook-hint"), /counts as a review too/);
  assert.strictEqual(await s.page.locator(".notebook-card.is-due").count(), 0);
  assert.ok((await s.page.locator(".notebook-card").first().innerText()).includes("Tomorrow"), "the cards say when they come back");
  await shot(s.page, "notebook-clear-en");
  await s.page.locator("#notebook-start").click();
  const info = await expectReviewSession(s.page, 4);
  assert.strictEqual(info.title, "Notebook practice");
  await leaveGame(s.page);
  checkProblems("notebook clear", s.problems);
  await s.context.close();
}

// ---------- scenarios: progress ----------

async function progressScenario(browser) {
  const s = await newSession(browser, { lang: "es", seed: { extraProfiles: true } });
  const { page } = s;
  await openProgress(page);
  const stats = await page.evaluate(() => Ludus.Profile.stats());
  const sessions = await page.evaluate(() => Ludus.Profile.sessions(undefined, { limit: 60 }));

  step("level, XP bar and streak come from Profile.stats");
  assert.strictEqual(await txt(page, ".progress-level-title"), stats.level.title);
  assert.ok((await txt(page, ".progress-level")).toLowerCase().includes(`nivel ${stats.level.level} de 21`));
  const bar = page.locator(".progress-level .progress").first();
  assert.strictEqual(await bar.getAttribute("role"), "progressbar");
  assert.strictEqual(Number(await bar.getAttribute("aria-valuenow")), Math.round(stats.level.progress * 100));
  assert.strictEqual(await txt(page, ".progress-streak-count"), String(stats.streak.current));
  assert.ok((await txt(page, ".progress-streak-best")).includes(String(stats.streak.best)));
  assert.match(await txt(page, ".progress-streak-msg"), /Ya entrenaste hoy/);
  assert.strictEqual(await page.locator(".progress-streak-msg.is-risk").count(), 0);

  step("the four numbers: positions, average accuracy, points and practice time");
  const tiles = await page.locator(".progress-stat").evaluateAll((els) => els.map((el) => ({ label: el.querySelector(".progress-stat-label").textContent, value: el.querySelector(".progress-stat-value").textContent })));
  assert.strictEqual(tiles.length, 4);
  assert.strictEqual(tiles[0].value, String(stats.totalPositions));
  assert.strictEqual(tiles[1].value, `${String(stats.overallAccuracy).replace(".", ",")}%`);
  assert.match(tiles[3].value, /^(\d+ min|\d+ h( \d+ min)?)$/);

  step("the heatmap: one cell per day up to today, the cells add up to the rounds of 12 weeks, a list is its alternative");
  const cells = await page.locator(".progress-heat-cell").evaluateAll((els) => els.map((el) => ({ date: el.getAttribute("data-date"), count: Number(el.getAttribute("data-count")), today: el.classList.contains("is-today") })));
  assert.ok(cells.length >= 78 && cells.length <= 84, `cells: ${cells.length}`);
  assert.strictEqual(new Set(cells.map((c) => c.date)).size, cells.length, "no day twice");
  assert.strictEqual(cells.filter((c) => c.today).length, 1);
  const inWindow = await page.evaluate((dates) => Ludus.Profile.rounds().filter((r) => {
    const d = new Date(r.ts);
    return dates.includes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }).length, cells.map((c) => c.date));
  assert.strictEqual(cells.reduce((sum, c) => sum + c.count, 0), inWindow);
  assert.strictEqual(await page.locator(".progress-heat-svg").getAttribute("role"), "img");
  assert.ok((await page.locator(".progress-heat-svg").getAttribute("aria-label")).includes(`${inWindow} posiciones`));
  await page.locator(".progress-list-summary").click();
  assert.strictEqual(await page.locator(".progress-day-list li").count(), cells.filter((c) => c.count > 0).length);
  const heatBox = await page.locator(".progress-heat-svg").boundingBox();
  assert.ok(heatBox.width >= 240 && heatBox.height >= 120, `the heatmap is readable: ${JSON.stringify(heatBox)}`);
  await page.locator(".progress-list-summary").click();

  step("the trend: one point per session (20 at most, duels out), one tab stop, arrows, tooltip, table, improvement");
  const expected = sessions.filter((x) => x.mode !== "duel").slice(0, 20).reverse();
  const points = page.locator(".progress-pt");
  assert.strictEqual(await points.count(), expected.length);
  assert.strictEqual(await page.locator('.progress-pt[tabindex="0"]').count(), 1, "one tab stop");
  await page.locator('.progress-pt[tabindex="0"]').focus();
  const tip = page.locator(".progress-tip");
  await tip.waitFor({ state: "visible" });
  assert.ok((await tip.innerText()).includes(String(expected[expected.length - 1].avgAccuracy).replace(".", ",")), "the tooltip shows the accuracy of the focused session");
  await page.keyboard.press("ArrowLeft");
  assert.strictEqual(await page.evaluate(() => document.activeElement.getAttribute("data-index")), String(expected.length - 2));
  assert.ok((await tip.innerText()).includes(String(expected[expected.length - 2].avgAccuracy).replace(".", ",")), "the tooltip follows the arrow keys");
  await page.keyboard.press("Home");
  assert.strictEqual(await page.evaluate(() => document.activeElement.getAttribute("data-index")), "0");
  await page.keyboard.press("Escape");
  assert.ok(await tip.isHidden(), "Escape hides it");
  const plotBox = await page.locator(".progress-trend-svg").boundingBox();
  await page.mouse.move(plotBox.x + plotBox.width * 0.5, plotBox.y + plotBox.height * 0.4);
  await tip.waitFor({ state: "visible" });
  const hovered = await tip.innerText();
  assert.ok(expected.some((x) => hovered.includes(x.title || "")), "the pointer finds the nearest session");
  assert.strictEqual(await page.locator(".progress-trend .sr-only table tbody tr").count(), expected.length, "a table for screen readers");
  assert.ok(stats.improvement);
  assert.ok((await txt(page, ".progress-improve")).includes(`${stats.improvement.window} posiciones`));
  await page.mouse.move(2, 2);

  step("phases, origins and the quality of the moves");
  const bars = await page.locator(".progress-bar-row").evaluateAll((els) => els.map((el) => ({ aria: el.querySelector("[role=img]").getAttribute("aria-label"), text: el.textContent.replace(/\s+/g, " ").trim() })));
  assert.strictEqual(bars.length, 7);
  ["opening", "middlegame", "endgame"].forEach((phase, i) => {
    const bucket = stats.byPhase[phase];
    if (!bucket.count) {
      assert.ok(bars[i].text.includes("Sin datos todavía"), `${phase}: ${bars[i].text}`);
      return;
    }
    assert.ok(bars[i].text.includes(String(bucket.accuracy).replace(".", ",")), `${phase}: ${bars[i].text}`);
    assert.ok(bars[i].text.includes(`${bucket.count} posiciones`) || bars[i].text.includes("1 posición"), bars[i].text);
  });
  assert.ok(bars.every((b) => b.aria && b.aria.length > 10), "every bar has a text alternative");
  const legend = await page.locator(".progress-legend-count").allInnerTexts();
  assert.strictEqual(legend.reduce((sum, v) => sum + Number(v.split(" ")[0].replace(/\./g, "")), 0), stats.windowPositions, "the legend repeats every number of the bar");
  const swatches = await page.locator(".progress-seg").count();
  assert.strictEqual(swatches, legend.length);

  step("weak themes: with their sample size; the notebook link opens the notebook filtered; the lesson opens a dialog");
  const weakCount = stats.weakestTags.length;
  assert.strictEqual(await page.locator(".progress-weak-item").count(), weakCount);
  assert.ok(weakCount >= 1);
  const firstWeak = stats.weakestTags[0];
  assert.ok((await txt(page, ".progress-weak-item")).includes(`${firstWeak.count} posiciones`));
  const lesson = page.locator(".progress-weak-lesson").first();
  if (await lesson.count()) {
    await lesson.click();
    await page.locator(".notebook-concept-modal").waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await page.locator(".notebook-concept-modal").waitFor({ state: "detached" });
  }
  await page.locator(".progress-weak-notebook").first().click();
  assert.strictEqual(await routerCurrent(page), "notebook");
  await page.waitForSelector("#notebook-f-tag");
  assert.strictEqual(await page.locator("#notebook-f-tag").inputValue(), firstWeak.tag, "the notebook is filtered by that theme");
  assert.strictEqual(await page.locator(".notebook-more").getAttribute("open"), "", "the filter is visible, not hidden");
  await openProgress(page);

  step("achievements: the whole catalogue; unlocked with a date, locked with progress; the three filters");
  assert.strictEqual(await page.locator(".progress-ach").count(), 24);
  const unlocked = stats.achievements.unlocked;
  assert.strictEqual(await page.locator(".progress-ach.is-unlocked").count(), unlocked);
  assert.ok((await txt(page, ".progress-ach-card")).includes(`${unlocked} de 24 desbloqueados`));
  assert.match(await page.locator(".progress-ach.is-unlocked").first().innerText(), /Desbloqueado el /);
  const locked = page.locator(".progress-ach.is-locked").first();
  assert.strictEqual(await locked.locator(".progress").getAttribute("role"), "progressbar");
  await page.locator('.progress-ach-filter [data-filter="done"]').click();
  assert.strictEqual(await page.locator(".progress-ach").count(), unlocked);
  await page.locator('.progress-ach-filter [data-filter="todo"]').click();
  assert.strictEqual(await page.locator(".progress-ach").count(), 24 - unlocked);
  await page.locator('.progress-ach-filter [data-filter="all"]').click();

  step("recent sessions: eight, newest first, with the duel marked");
  assert.strictEqual(await page.locator(".progress-session").count(), 8);
  assert.ok((await page.locator(".progress-session-title").first().innerText()).length > 0);

  step("the profile switcher looks at another profile and leaves the active one alone");
  assert.strictEqual(await page.locator(".progress-switch").count(), 2);
  const activeBefore = await page.evaluate(() => Ludus.Profile.active().id);
  const otherId = await page.evaluate(() => Ludus.Profile.list().find((p) => !p.active).id);
  const otherStats = await page.evaluate((id) => Ludus.Profile.stats(id), otherId);
  await page.locator(`.progress-switch[data-profile="${otherId}"]`).click();
  await page.waitForFunction((n) => document.querySelector(".progress-stat-value").textContent === String(n), otherStats.totalPositions);
  assert.strictEqual(await page.evaluate(() => Ludus.Profile.active().id), activeBefore, "the active profile did not change");
  assert.ok(await page.evaluate(() => document.activeElement.classList.contains("progress-switch")), "the focus stays on the switch");
  await shot(page, "progress-other-profile", false);
  checkProblems("progress", s.problems);
  await s.context.close();
}

async function progressStatesScenario(browser) {
  step("no data: level, achievements and what appears with what it takes; nothing invented");
  let s = await newSession(browser, { lang: "es" });
  await openProgress(s.page);
  assert.strictEqual(await txt(s.page, ".progress-level-title"), "Peón I");
  assert.strictEqual(await s.page.locator(".progress-gap").count(), 5);
  assert.strictEqual(await s.page.locator(".progress-heat-svg, .progress-trend-svg, .progress-stats").count(), 0, "no chart and no numbers without data");
  assert.match(await txt(s.page, ".progress-gaps"), /Completá 2 sesiones \(llevás 0\)/);
  assert.match(await txt(s.page, ".progress-gaps"), /Jugá 20 posiciones \(llevás 0\)/);
  await shot(s.page, "progress-empty-es");
  await s.page.getByRole("button", { name: "Elegir cómo entrenar" }).click();
  assert.strictEqual(await routerCurrent(s.page), "home");
  checkProblems("progress empty", s.problems);
  await s.context.close();

  step("partial data: 3 rounds and 1 session say what is still missing and how many they have");
  s = await newSession(browser, { lang: "en" });
  await s.page.evaluate(async () => {
    await Ludus.Classics.load();
    const list = Ludus.Classics.random(3, {});
    const now = Date.now();
    const { Chess, moveToUci, moveToSan } = Ludus.chess;
    Ludus.Profile.ensureActive();
    list.forEach((position, i) => {
      const chess = new Chess(position.fen);
      const moves = chess.generateMoves();
      const lines = position.reference.lines.slice(0, 3);
      Ludus.Profile.recordRound({
        id: `r_part${i}`, ts: now - 60000 * (i + 1), sessionId: "s_part", sessionKind: "classic", source: "classic", fen: position.fen, sideToMove: chess.turn, phase: i === 2 ? "endgame" : "middlegame",
        userUci: moveToUci(moves[0]), userSan: moveToSan(chess, moves[0]), bestUci: lines[0].uci, bestSan: lines[0].san || "", points: [9, 4, 7][i], accuracy: [90, 40, 70][i],
        qualityCode: ["very_good", "dubious", "interesting"][i], winLossPct: 20, cpLoss: 80, isBest: false, rank: 2, onlyMove: false, timeSpentMs: 9000, hintsUsed: 0, timedOut: false, tags: ["hangs_piece"], lines, meta: {},
      });
    });
    Ludus.Profile.recordSession({ id: "s_part", ts: now, kind: "classic", title: "Classic games", mode: "solo", positions: 3, points: 20, maxPoints: 30, avgAccuracy: 66.7, durationMs: 90000, byQuality: { very_good: 1, dubious: 1, interesting: 1 }, roundIds: [] });
  });
  await openProgress(s.page);
  assert.strictEqual(await s.page.locator(".progress-gap").count(), 0, "there is data: no empty state");
  assert.match(await txt(s.page, ".progress-improve"), /we need 20 positions.*You have 3/);
  assert.strictEqual(await s.page.locator(".progress-pt").count(), 1);
  assert.match(await txt(s.page, ".progress-trend-card"), /One session gives a point/);
  assert.match(await txt(s.page, ".progress-weak"), /No theme has enough data yet|the one with the most has 3/);
  assert.ok((await s.page.locator(".progress-bar-n.is-small").count()) >= 1, "small samples are labelled");
  assert.match(await txt(s.page, ".progress-bars"), /No data yet/, "a phase without positions says so");
  await shot(s.page, "progress-partial-en");
  checkProblems("progress partial", s.problems);
  await s.context.close();

  step("the streak at risk: yesterday counts, today does not yet; the warning is announced");
  s = await newSession(browser, { lang: "es", seed: { skipToday: true } });
  await openProgress(s.page);
  const risk = s.page.locator(".progress-streak-msg.is-risk");
  await risk.waitFor();
  assert.strictEqual(await risk.getAttribute("role"), "status");
  assert.match(await risk.innerText(), /Entrená hoy para no perder tu racha de \d+ días\./);
  await shot(s.page, "progress-risk-es", false);
  checkProblems("progress risk", s.problems);
  await s.context.close();
}

// ---------- layout, motion, focus, axe ----------

async function layoutScenario(browser) {
  for (const lang of ["es", "en"]) {
    for (const viewport of VIEWPORTS) {
      const phone = viewport.width < 720;
      const { context, page, problems } = await newSession(browser, { lang, seed: { extraProfiles: true }, viewport: { width: viewport.width, height: viewport.height } });
      const label = `${viewport.name} ${lang}`;
      await openNotebook(page);
      await checkLayout(page, `${label} notebook`, "#screen-notebook", `notebook-${viewport.name}-${lang}`);
      // filters open and a card's lines open
      await page.locator(".notebook-more-summary").click();
      await page.locator(".notebook-lines-toggle").first().click();
      await checkLayout(page, `${label} notebook filters and lines open`, "#screen-notebook", `notebook-open-${viewport.name}-${lang}`);
      // a card's actions fit its row
      const actions = await page.locator(".notebook-actions").first().evaluate((el) => Array.from(el.children).map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), Math.round(r.top)]; }));
      const centres = await page.locator(".notebook-actions").first().evaluate((el) => Array.from(el.children).map((c) => { const r = c.getBoundingClientRect(); return Math.round(r.top + r.height / 2); }));
      assert.ok(centres.every((c) => Math.abs(c - centres[0]) <= 2), `${label}: the three card actions share one row: ${JSON.stringify(actions)} ${JSON.stringify(centres)}`);
      // the summary: the action and the picker do not overlap
      const boxes = await page.evaluate(() => ["#notebook-start", ".notebook-size"].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }));
      const overlap = !(boxes[0].bottom <= boxes[1].top + 1 || boxes[1].bottom <= boxes[0].top + 1 || boxes[0].right <= boxes[1].left + 1 || boxes[1].right <= boxes[0].left + 1);
      assert.ok(!overlap, `${label}: the action and the picker overlap`);
      await openProgress(page);
      await checkLayout(page, `${label} progress`, "#screen-progress", `progress-${viewport.name}-${lang}`);
      // the trend chart keeps its text readable: the drawing is shown at about its own size
      const scale = await page.evaluate(() => { const svg = document.querySelector(".progress-trend-svg"); const vb = svg.viewBox.baseVal; return svg.getBoundingClientRect().width / vb.width; });
      assert.ok(scale > 0.9 && scale < 1.12, `${label}: the chart is drawn at the size it is shown at (scale ${scale.toFixed(2)})`);
      const plot = await page.locator(".progress-trend-plot").boundingBox();
      assert.ok(plot.height >= 150 && plot.width >= 240, `${label}: a plot big enough for a finger: ${JSON.stringify(plot)}`);
      if (phone) assert.ok(plot.width <= viewport.width - 24);
      checkProblems(label, problems);
      await context.close();
    }
  }
  step("empty states at every width");
  for (const lang of ["es", "en"]) {
    for (const viewport of VIEWPORTS) {
      const { context, page, problems } = await newSession(browser, { lang, viewport: { width: viewport.width, height: viewport.height } });
      const label = `${viewport.name} ${lang}`;
      await openNotebook(page);
      await checkLayout(page, `${label} notebook empty`, "#screen-notebook", `notebook-empty-${viewport.name}-${lang}`);
      await openProgress(page);
      await checkLayout(page, `${label} progress empty`, "#screen-progress", `progress-empty-${viewport.name}-${lang}`);
      checkProblems(label, problems);
      await context.close();
    }
  }
}

// The system rule for reduced motion shortens every duration to a hundred thousandth of a second.
const isStill = (value) => String(value).split(",").every((part) => parseFloat(part) <= 0.001);

async function motionFocusScenario(browser) {
  step("reduced motion (the system setting): transitions and the entrance stop");
  let s = await newSession(browser, { lang: "en", seed: true, reducedMotion: "reduce" });
  await openNotebook(s.page);
  const still = await s.page.evaluate(() => {
    const icon = document.querySelector(".notebook-lines-toggle .ui-icon");
    const screen = document.querySelector("#screen-notebook");
    return { transition: getComputedStyle(icon).transitionDuration, animation: getComputedStyle(screen).animationName, duration: getComputedStyle(screen).animationDuration };
  });
  assert.ok(isStill(still.transition), `no transition: ${still.transition}`);
  assert.ok(still.animation === "none" || isStill(still.duration), `no entrance animation: ${JSON.stringify(still)}`);
  await openProgress(s.page);
  const dot = await s.page.evaluate(() => getComputedStyle(document.querySelector(".progress-pt-dot")).transitionDuration);
  assert.ok(isStill(dot), `the chart points do not animate: ${dot}`);
  checkProblems("reduced motion", s.problems);
  await s.context.close();

  step("reduced motion (the app setting a11y.motion) does the same");
  s = await newSession(browser, { lang: "en", seed: true });
  await s.page.evaluate(() => Ludus.Settings.set("a11y.motion", "reduce"));
  await openNotebook(s.page);
  const still2 = await s.page.evaluate(() => getComputedStyle(document.querySelector(".notebook-lines-toggle .ui-icon")).transitionDuration);
  assert.ok(isStill(still2), `no transition: ${still2}`);
  await s.context.close();

  step("keyboard focus is visible on the picker, the chips, the card actions and the points of the chart");
  s = await newSession(browser, { lang: "en", seed: true });
  await openNotebook(s.page);
  const ring = async (selector) => {
    await s.page.locator(selector).first().focus();
    await s.page.keyboard.press("Shift+Tab");
    await s.page.keyboard.press("Tab");
    return s.page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor, shadow: cs.boxShadow }; });
  };
  for (const selector of ["#notebook-start", '.notebook-size-seg [data-size="5"]', "button.notebook-tag", ".notebook-card .notebook-action", ".notebook-lines-toggle", ".notebook-remove", ".notebook-weak-train", '.notebook-status [data-status="due"]']) {
    const r = await ring(selector);
    assert.ok(r.style !== "none" && r.width >= 2, `${selector}: a focus ring, ${JSON.stringify(r)}`);
  }
  // Tab order: search, sort, status pills, more filters (a keyboard user reaches every control in a sensible order).
  await s.page.locator("#notebook-search").focus();
  await s.page.keyboard.press("Tab");
  assert.strictEqual(await s.page.evaluate(() => document.activeElement.id), "notebook-sort");
  await openProgress(s.page);
  await s.page.locator('.progress-pt[tabindex="0"]').focus();
  await s.page.keyboard.press("ArrowLeft");
  const focusRing = await s.page.evaluate(() => { const g = document.activeElement; const c = g.querySelector(".progress-pt-focus"); return { tag: g.className.baseVal, stroke: getComputedStyle(c).stroke }; });
  assert.ok(/progress-pt/.test(focusRing.tag) && focusRing.stroke !== "none" && !/^rgba\(0, 0, 0, 0\)$|transparent/.test(focusRing.stroke), `the focused point shows the ring: ${JSON.stringify(focusRing)}`);
  await s.page.locator(".progress-list-summary").focus();
  const summaryRing = await s.page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) }; });
  assert.ok(summaryRing.style !== "none" && summaryRing.width >= 2, "the list disclosure has a ring");
  checkProblems("focus", s.problems);
  await s.context.close();
}

async function axeScenario(browser) {
  const axePath = process.env.LUDUS_AXE;
  if (!axePath) {
    step("skipped: set LUDUS_AXE=/path/to/axe.min.js to run it");
    return;
  }
  const source = fs.readFileSync(axePath, "utf8");
  let states = 0;
  for (const [lang, viewport] of [["es", { width: 1280, height: 800 }], ["en", { width: 390, height: 844 }], ["es", { width: 360, height: 740 }], ["en", { width: 820, height: 1180 }]]) {
    for (const seeded of [false, true]) {
      const { context, page, problems } = await newSession(browser, { lang, viewport, bypassCSP: true, seed: seeded ? { extraProfiles: true } : null });
      await page.addScriptTag({ content: source });
      const scan = async (label, scope) => {
        await page.waitForTimeout(250);
        const violations = await page.evaluate(async (include) => (await axe.run(include ? { include: [[include]] } : document, { resultTypes: ["violations"] })).violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`), scope || null);
        assert.deepStrictEqual(violations, [], `axe (${lang} ${viewport.width} ${label}): ${violations.join(" | ")}`);
        states += 1;
      };
      await openNotebook(page);
      await scan(seeded ? "notebook" : "notebook empty", "#screen-notebook");
      await openProgress(page);
      await scan(seeded ? "progress" : "progress empty", "#screen-progress");
      if (seeded) {
        await openNotebook(page);
        await page.locator(".notebook-more-summary").click();
        await page.locator(".notebook-lines-toggle").first().click();
        await scan("notebook filters and lines open", "#screen-notebook");
        await page.locator('.notebook-status [data-status="cleared"]').click();
        await scan("notebook cleared filter", "#screen-notebook");
        await page.locator("#notebook-search").fill("zzzz-nothing");
        await page.waitForSelector(".notebook-list-empty");
        await scan("notebook without matches", "#screen-notebook");
        await page.locator(".notebook-clear").click();
        await page.locator("button.notebook-tag").first().click();
        await page.locator(".notebook-concept-modal").waitFor({ state: "visible" });
        await scan("lesson dialog", null);
        await page.keyboard.press("Escape");
        await openProgress(page);
        await page.locator('.progress-pt[tabindex="0"]').focus();
        await scan("progress with the tooltip", "#screen-progress");
        await page.locator(".progress-list-summary").click();
        await scan("progress with the days list open", "#screen-progress");
        await page.locator('.progress-ach-filter [data-filter="todo"]').click();
        await scan("progress with pending achievements", "#screen-progress");
      }
      checkProblems(`axe ${lang} ${viewport.width}`, problems);
      await context.close();
    }
  }
  // Nothing due, and the streak at risk.
  for (const lang of ["es", "en"]) {
    const s = await newSession(browser, { lang, bypassCSP: true, viewport: { width: 390, height: 844 } });
    await s.page.addScriptTag({ content: source });
    await seedNotDue(s.page, 3);
    await openNotebook(s.page);
    await s.page.waitForTimeout(250);
    const violations = await s.page.evaluate(async () => (await axe.run({ include: [["#screen-notebook"]] }, { resultTypes: ["violations"] })).violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id));
    assert.deepStrictEqual(violations, [], `axe (${lang} nothing due)`);
    states += 1;
    await s.context.close();
  }
  step(`no serious or critical violations on ${states} states`);
}

// ---------- main ----------

const scenarios = [
  ["notebook", notebookScenario],
  ["review", reviewScenario],
  ["notebook states", notebookStatesScenario],
  ["progress", progressScenario],
  ["progress states", progressStatesScenario],
  ["layout", layoutScenario],
  ["motion + focus", motionFocusScenario],
  ["axe", axeScenario],
];

(async () => {
  const browser = await launchBrowser();
  let failed = false;
  try {
    for (const [name, run] of scenarios) {
      if (ONLY && !name.includes(ONLY)) continue;
      console.log(`\n[${name}]`);
      const started = Date.now();
      await run(browser);
      console.log(`  ok (${Math.round((Date.now() - started) / 1000)}s)`);
    }
  } catch (error) {
    failed = true;
    console.error(error && error.stack ? error.stack : error);
  } finally {
    await browser.close();
  }
  if (failed) process.exit(1);
  console.log("\ntrack e2e: all scenarios passed");
})();
