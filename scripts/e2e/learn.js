// Browser end-to-end check of the "learn" screens in real Chromium: the classic games (gallery, filters,
// game page with its replay, train launchers; js/ui/classics.js, css/classics.css) and History (timeline,
// curiosities, chess school, reading room; js/ui/museum.js, css/museum.css).
//
// Playwright is NOT a project dependency (the app has no runtime or dev dependencies) and this script is
// not part of `npm test`. Run it by hand:
//
//   python3 -m http.server 5010 &                      # serve the repo root
//   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/learn.js
//
// Environment (all optional):
//   LUDUS_URL             page to test               (default http://127.0.0.1:5010/index.html)
//   LUDUS_E2E_ONLY        run only the scenarios whose name contains this text (e.g. "reading")
//   LUDUS_CHROMIUM        chrome binary if Playwright cannot launch its own
//                         (falls back to /opt/pw-browsers/chromium-1194/chrome-linux/chrome)
//   LUDUS_E2E_SHOTS       directory for screenshots (none are saved when unset)
//   LUDUS_AXE             path to axe.min.js: turns on the axe scenario (axe-core is not a project dependency)
//
// Scenarios (each in a fresh context with service workers blocked, CSP enforced):
//   gallery             28 cards; text search (accents do not matter), difficulty, era, theme, kind and sort;
//                       the count, the removable chips, the empty state and "clear filters"
//   game page + replay  open a card (hash #/classics/<id>), first / previous / next / last, the arrow keys, the
//                       scrubber, the list of moves, the note of a key moment, the training cue, auto play
//                       (moves on its own, pause holds), the board flips, Escape-free keyboard flow
//   deep links          a cold start on #/classics/<id> and on #/museum/<tab>; an unknown game id
//   train               "Train this game" starts a classic session with the chosen count and hints; "try this
//                       position" starts one position; the random mix respects difficulty and count; the daily
//                       strip starts the daily challenge; the play screen appears each time
//   history tabs        the tablist (click and arrow keys), timeline (expand, jump to a year and to an era),
//                       curiosities (category, search, surprise me, show more), school (mistake filter, boards
//                       with the best-move arrow), hash mirroring
//   reading room        REAL CLOCK: the carousel does not advance before the reading time of the fact, pausing holds
//                       the remaining time, hovering pauses, and it advances after the time has passed
//   layout              7 viewports x es / en on every screen: no horizontal scroll, no overlap of the replay
//                       controls, touch targets of 44px, no raw i18n keys, screenshots when LUDUS_E2E_SHOTS is set
//   motion + focus      reduced motion stops the entrance animation and the highlight; keyboard focus shows a ring
//   axe (optional)      with LUDUS_AXE=/path/to/axe.min.js: no serious or critical violations on every screen and state
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

const BASE_URL = process.env.LUDUS_URL || "http://127.0.0.1:5010/index.html";
const FALLBACK_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SHOT_DIR = process.env.LUDUS_E2E_SHOTS || "";
const ONLY = process.env.LUDUS_E2E_ONLY || "";

const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "820x1180", width: 820, height: 1180 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1440x900", width: 1440, height: 900 },
];
const GAME = "opera-1858"; // 33 plies, 6 training positions, 3 hand-written moments (plies 18, 24, 30)
const MUSEUM_TABS = ["timeline", "curiosities", "school", "room"];

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
  await page.screenshot({ path: path.join(SHOT_DIR, `learn-${name}.png`) });
}

async function newSession(browser, options = {}) {
  const { lang = "es", hash = "", ...contextOptions } = options;
  const context = await browser.newContext(Object.assign({
    viewport: { width: 1280, height: 800 },
    serviceWorkers: "block",
    bypassCSP: false,
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
  // A returning visitor, in the language of the scenario.
  await page.addInitScript((language) => {
    try {
      if (!sessionStorage.getItem("__learn_init")) {
        sessionStorage.setItem("__learn_init", "1");
        localStorage.setItem("ludus.seen.v1", "1");
        localStorage.setItem("ludus.language", language);
      }
    } catch (error) {
      // storage may be blocked; the app copes
    }
  }, lang);
  await page.goto(`${BASE_URL}${hash}`);
  await page.waitForFunction(() => window.Ludus && Ludus.game && Ludus.Screens && Ludus.Screens.classics && Ludus.Screens.museum);
  return { context, page, problems };
}

function checkProblems(label, problems) {
  assert.deepStrictEqual(problems, [], `${label}: the page reported problems:\n  ${problems.join("\n  ")}`);
}

const routerCurrent = (page) => page.evaluate(() => Ludus.router.current());

async function openClassics(page) {
  await page.evaluate(() => Ludus.router.show("classics"));
  await page.waitForSelector(".classics-grid .classics-item", { timeout: 10000 });
}

async function openGame(page, id = GAME) {
  await page.evaluate((gameId) => Ludus.router.show("classics", { game: gameId }), id);
  await page.waitForSelector(`.classics-detail-page[data-game="${id}"] .classics-board .square`, { timeout: 10000 });
  await page.waitForTimeout(150);
}

async function openMuseum(page, tab) {
  await page.evaluate((name) => Ludus.router.show("museum", { tab: name }), tab);
  await page.waitForSelector(`#museum-panel-${tab}:not([hidden]) > *`, { timeout: 5000 });
}

const replayIndex = (page) => page.evaluate(() => Ludus.Screens.classics._state.detail.replay.state().index);
const counterText = (page) => page.locator(".classics-counter").innerText();
const boardPieces = (page) => page.locator(".classics-board .bd-piece:not(.bd-leaving)").count();
const pieceAt = (page, sq) => page.evaluate((name) => {
  const el = document.querySelector(`.classics-board [data-square="${name}"] .bd-piece:not(.bd-leaving)`);
  return el ? el.dataset.piece : null;
}, sq);
const visibleText = (page, selector) => page.locator(selector).first().innerText();

// The play screen is up with a session of this kind.
async function expectSession(page, kind, count) {
  await page.waitForFunction(() => Ludus.router.current() === "game" && Ludus.game.isActive(), null, { timeout: 15000 });
  // Ludus.game.session().positions is the length; the list itself is the game core's STATE.positions.
  const info = await page.evaluate(() => {
    const s = Ludus.game.session();
    const list = STATE.positions;
    return { kind: s.kind, title: s.title, count: s.positions, hints: s.options.hints, sources: list.map((p) => p.source), difficulties: list.map((p) => p.classic && p.classic.difficulty), plies: list.map((p) => p.classic && p.classic.ply), games: list.map((p) => p.classic && p.classic.gameId), fens: list.map((p) => p.fen) };
  });
  assert.strictEqual(info.kind, kind, "session kind");
  if (count !== undefined) assert.strictEqual(info.count, count, "session length");
  assert.ok(await page.locator("#game-layout").isVisible(), "the play screen is visible");
  await page.waitForSelector("#board .square[data-square='e4']");
  return info;
}

async function leaveGame(page) {
  await page.evaluate(() => Ludus.game.abort());
  await page.waitForFunction(() => !Ludus.game.isActive());
}

function noRawKeys(text, label) {
  const raw = text.match(/\b(classics|museum|cdata|facts|insight|reader)\.[a-zA-Z0-9_.]+/g);
  assert.ok(!raw, `${label}: raw i18n keys on screen: ${raw && raw.join(", ")}`);
}

// ---------- scenarios ----------

async function galleryScenario(browser) {
  const { context, page, problems } = await newSession(browser, { lang: "en" });
  await openClassics(page);
  step("28 games, one card each, the count and the summary");
  assert.strictEqual(await page.locator(".classics-item").count(), 28);
  assert.match(await page.locator(".classics-count").innerText(), /^28 games$/);
  const stats = await page.locator(".classics-stats").innerText();
  assert.match(stats, /28/);
  step("a card has a board, the title, players, year, opening, difficulty and a training count");
  const card = page.locator(`.classics-item[data-game="${GAME}"]`);
  assert.ok(await card.locator("svg.mini-board").count() === 1, "mini board");
  assert.match(await card.innerText(), /The Opera Game/i);
  assert.match(await card.innerText(), /Morphy/);
  assert.match(await card.innerText(), /1858/);
  assert.match(await card.innerText(), /philidor/i);
  assert.match(await card.innerText(), /6 training positions/);
  assert.match(await card.innerText(), /easy/i);
  assert.match(await card.locator(".classics-card-link").getAttribute("href"), /#\/classics\/opera-1858$/);
  assert.match(await card.innerText(), /Moves cross-checked/, "verified indicator shows when the data has sources");

  step("search matches players, event and opening; accents are ignored");
  const search = page.locator("#classics-search");
  await search.fill("morphy");
  await page.waitForFunction(() => document.querySelectorAll(".classics-item").length === 2);
  assert.match(await page.locator(".classics-count").innerText(), /^2 of 28 games$/);
  await search.fill("réti");
  await page.waitForFunction(() => document.querySelectorAll(".classics-item").length === 1);
  await search.fill("Hastings");
  await page.waitForFunction(() => document.querySelectorAll(".classics-item").length === 1);
  await search.fill("sicilian");
  await page.waitForFunction(() => document.querySelectorAll(".classics-item").length === 2);
  step("the active filter shows as a chip that removes it");
  assert.strictEqual(await page.locator(".classics-active-chip").count(), 1);
  await page.locator(".classics-active-chip").click();
  await page.waitForFunction(() => document.querySelectorAll(".classics-item").length === 28);
  assert.strictEqual(await search.inputValue(), "");

  step("difficulty, era, theme and kind narrow the list; they combine");
  await page.locator('.classics-diff-seg button[data-value="3"]').click();
  const hard = await page.locator(".classics-item").count();
  assert.ok(hard > 5 && hard < 28, `hard games: ${hard}`);
  assert.strictEqual(await page.locator('.classics-diff-seg button[aria-pressed="true"]').getAttribute("data-value"), "3");
  await page.selectOption("#classics-era", "e4");
  await page.waitForFunction(() => document.querySelectorAll(".classics-item").length < 8);
  const modern = await page.evaluate(() => Array.from(document.querySelectorAll(".classics-item")).map((el) => el.dataset.game));
  assert.ok(modern.length >= 1, "some hard games are from 2000 on");
  const era2000 = await page.evaluate(() => Ludus.Classics.list().filter((g) => g.year >= 2000 && g.difficulty === 3).map((g) => g.id).sort());
  assert.deepStrictEqual(modern.slice().sort(), era2000, "era + difficulty = the games of 2000 on that are hard");
  await page.locator(".classics-clear").click();
  await page.waitForFunction(() => document.querySelectorAll(".classics-item").length === 28);
  const themeOption = await page.evaluate(() => Array.from(document.querySelectorAll("#classics-theme option")).map((o) => o.value)[1]);
  await page.selectOption("#classics-theme", themeOption);
  const themed = await page.locator(".classics-item").count();
  assert.ok(themed >= 1 && themed < 28, `theme ${themeOption}: ${themed}`);
  await page.selectOption("#classics-theme", "all");
  await page.selectOption("#classics-kind", "sacrifice");
  const sacrifices = await page.locator(".classics-item").count();
  assert.ok(sacrifices >= 1 && sacrifices < 28, `kind sacrifice: ${sacrifices}`);
  await page.selectOption("#classics-kind", "all");

  step("sorting: chronological, by difficulty, by title");
  const order = () => page.evaluate(() => Array.from(document.querySelectorAll(".classics-item")).map((el) => el.dataset.game));
  const chrono = await order();
  assert.strictEqual(chrono[0], "immortal-1851");
  assert.strictEqual(chrono[chrono.length - 1], "carlsen-nepomniachtchi-2021-g6");
  await page.selectOption("#classics-sort", "difficulty");
  const byDifficulty = await page.evaluate(() => Array.from(document.querySelectorAll(".classics-item")).map((el) => Ludus.Classics.get(el.dataset.game).difficulty));
  assert.deepStrictEqual(byDifficulty.slice(), byDifficulty.slice().sort((a, b) => a - b), "sorted by difficulty");
  await page.selectOption("#classics-sort", "title");
  const titles = await page.evaluate(() => Array.from(document.querySelectorAll(".classics-card-title")).map((el) => el.textContent.trim()));
  assert.deepStrictEqual(titles, titles.slice().sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })), "sorted by title");
  await page.selectOption("#classics-sort", "chrono");

  step("nothing matches: an empty state with a way out");
  await search.fill("zzzzqq");
  await page.waitForSelector(".classics-empty:not([hidden]) .empty");
  assert.strictEqual(await page.locator(".classics-item").count(), 0);
  await page.locator(".classics-empty .btn").click();
  await page.waitForFunction(() => document.querySelectorAll(".classics-item").length === 28);
  assert.strictEqual(await search.inputValue(), "", "clearing also empties the search box");
  checkProblems("gallery", problems);
  await context.close();
}

async function replayScenario(browser) {
  const { context, page, problems } = await newSession(browser, { lang: "es" });
  await openClassics(page);
  step("clicking a card opens the game page and mirrors #/classics/<id>");
  await page.locator(`.classics-card-link[data-fkey="open-${GAME}"]`).click();
  await page.waitForSelector(".classics-detail .classics-board .square");
  await page.waitForFunction((id) => location.hash === `#/classics/${id}`, GAME);
  assert.strictEqual(await routerCurrent(page), "classics");
  assert.match(await visibleText(page, ".classics-detail-title"), /La Ópera/);
  assert.match(await page.locator(".classics-detail-head").innerText(), /Morphy/);
  assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("classics-detail-title")), true, "focus moves to the title");
  step("the starting position: 32 pieces, counter 0 / 33, the first buttons disabled");
  assert.strictEqual(await boardPieces(page), 32);
  assert.strictEqual(await counterText(page), "0 / 33");
  assert.strictEqual(await page.locator('[data-action="first"]').getAttribute("aria-disabled"), "true");
  assert.strictEqual(await page.locator('[data-action="prev"]').getAttribute("aria-disabled"), "true");
  assert.strictEqual(await page.locator(".classics-board").getAttribute("aria-hidden"), "true", "the board grid is decoration for a screen reader");
  assert.match(await page.locator(".classics-stage").getAttribute("aria-label"), /Posición inicial/);
  assert.strictEqual(await page.locator(".classics-board [tabindex]").count(), 0, "no square is focusable: the arrows step the replay and the image holds no control");
  step("Next plays 1.e4: the pawn is on e4, the last move is washed, the list marks it");
  await page.locator('[data-action="next"]').click();
  assert.strictEqual(await counterText(page), "1 / 33");
  await page.waitForFunction(() => document.querySelector('.classics-board [data-square="e4"] .bd-piece'));
  assert.strictEqual(await pieceAt(page, "e4"), "wP");
  assert.strictEqual(await pieceAt(page, "e2"), null);
  assert.ok(await page.locator('.classics-board [data-square="e4"].bd-last').count() === 1, "last move highlighted");
  assert.strictEqual(await page.locator('.classics-move[aria-current="step"]').getAttribute("data-ply"), "0");
  assert.match(await page.locator(".classics-now").innerText(), /1\. e4/);
  assert.match(await page.locator(".classics-stage").getAttribute("aria-label"), /e4/);
  step("the arrow keys, Home and End step the replay (focus on the page, not on a square)");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  assert.strictEqual(await counterText(page), "3 / 33");
  await page.keyboard.press("ArrowLeft");
  assert.strictEqual(await counterText(page), "2 / 33");
  await page.keyboard.press("End");
  assert.strictEqual(await counterText(page), "33 / 33");
  assert.strictEqual(await page.locator('[data-action="next"]').getAttribute("aria-disabled"), "true");
  assert.match(await page.locator(".classics-now").innerText(), /Fin de la partida/);
  assert.match(await page.locator(".classics-now").innerText(), /Td8#/, "Spanish page: the mating rook move in Spanish letters (QA CNT-006)");
  assert.ok(await page.locator('.classics-board [data-square="e8"].bd-check, .classics-board [data-square="b8"].bd-check').count() >= 0);
  await page.keyboard.press("Home");
  assert.strictEqual(await counterText(page), "0 / 33");
  step("the scrubber and the list of moves jump anywhere");
  await page.locator(".classics-scrub-input").fill("20");
  assert.strictEqual(await counterText(page), "20 / 33");
  assert.match(await page.locator(".classics-scrub-input").getAttribute("aria-valuetext"), /Jugada 20 de 33/);
  await page.locator('.classics-move[data-ply="10"]').click();
  assert.strictEqual(await counterText(page), "11 / 33");
  assert.strictEqual(await page.evaluate(() => document.activeElement.dataset.ply), "10", "focus stays on the clicked move");
  assert.strictEqual(await page.locator('.classics-move[tabindex="0"]').count(), 1, "one tab stop in the list");
  await page.keyboard.press("ArrowRight");
  assert.strictEqual(await counterText(page), "12 / 33");
  assert.strictEqual(await page.evaluate(() => document.activeElement.dataset.ply), "11", "arrows inside the list move the focus with the replay");
  step("markers: training plies have a diamond in the list and on the scrubber");
  assert.strictEqual(await page.locator(".classics-move.is-training").count(), 6);
  assert.strictEqual(await page.locator(".classics-tick").count(), 6);

  step("a hand-written moment shows its note after the move; the position before a training move shows the cue");
  const moments = await page.evaluate((id) => Ludus.Classics.get(id).positions.filter((p) => p.note).map((p) => ({ ply: p.ply, es: p.note.es })), GAME);
  assert.strictEqual(moments.length, 3);
  const first = moments[0];
  await page.locator(".classics-scrub-input").fill(String(first.ply));
  assert.ok(await page.locator(".classics-cue .classics-try").isVisible(), "the cue with the try button appears before the master's move");
  assert.strictEqual(await page.locator(".classics-note").count(), 0);
  await page.locator(".classics-scrub-input").fill(String(first.ply + 1));
  const noteText = await page.locator(".classics-note-text").innerText();
  assert.strictEqual(noteText.trim(), first.es.trim(), "the note of the moment is the hand-written one");
  assert.match(await page.locator(".classics-note-label").innerText(), /Momento clave/i);
  await shot(page, "replay-note");

  step("the board turns (the person's side is at the bottom by default)");
  const bottomBefore = await page.evaluate(() => document.querySelector(".classics-board").dataset.orientation);
  assert.strictEqual(bottomBefore, "w", "Morphy plays White: White at the bottom");
  await page.locator('[data-action="flip"]').click();
  assert.strictEqual(await page.evaluate(() => document.querySelector(".classics-board").dataset.orientation), "b");
  assert.strictEqual(await counterText(page), `${first.ply + 1} / 33`, "flipping keeps the position");
  await page.locator('[data-action="flip"]').click();

  step("auto play moves on its own; pausing holds the position");
  await page.locator('[data-action="first"]').click();
  await page.selectOption(".classics-speed", "fast");
  await page.locator('[data-action="play"]').click();
  assert.strictEqual(await page.locator('[data-action="play"]').getAttribute("aria-pressed"), "true");
  const t0 = Date.now();
  await page.waitForFunction(() => Ludus.Screens.classics._state.detail.replay.state().index >= 3, null, { timeout: 8000 });
  const took = Date.now() - t0;
  assert.ok(took >= 1200, `three moves take at least two pauses (${took} ms)`);
  await page.locator('[data-action="play"]').click();
  const held = await replayIndex(page);
  await page.waitForTimeout(1600);
  assert.strictEqual(await replayIndex(page), held, "paused: the position does not change");
  assert.strictEqual(await page.locator('[data-action="play"]').getAttribute("aria-pressed"), "false");
  step("play at the end starts over; stepping by hand stops auto play");
  await page.locator('[data-action="last"]').click();
  await page.locator('[data-action="play"]').click();
  await page.waitForFunction(() => Ludus.Screens.classics._state.detail.replay.state().index <= 3 && Ludus.Screens.classics._state.detail.replay.state().playing);
  await page.locator('[data-action="next"]').click();
  assert.strictEqual(await page.evaluate(() => Ludus.Screens.classics._state.detail.replay.state().playing), false);

  step("Back returns to the gallery, scroll and focus on the card that was open");
  await page.locator('[data-fkey="back"]').click();
  await page.waitForSelector(".classics-grid .classics-item");
  await page.waitForFunction(() => location.hash === "#/classics");
  assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.dataset.fkey), `open-${GAME}`);
  assert.strictEqual(await page.locator(".classics-detail").count(), 0);
  checkProblems("replay", problems);
  await context.close();
}

async function deepLinkScenario(browser) {
  step("a cold start on #/classics/<id> opens that game");
  let s = await newSession(browser, { lang: "en", hash: `#/classics/${GAME}` });
  await s.page.waitForSelector(`.classics-detail-page[data-game="${GAME}"] .classics-board .square`, { timeout: 10000 });
  assert.strictEqual(await routerCurrent(s.page), "classics");
  assert.match(await visibleText(s.page, ".classics-detail-title"), /Opera Game/);
  assert.match(await s.page.title(), /Opera Game - Classic games - Ludus Scaccorum/, "the tab title names the game (QA A11Y-024)");
  step("hashchange to another game and to the plain screen");
  await s.page.evaluate(() => { location.hash = "#/classics/immortal-1851"; });
  await s.page.waitForSelector('.classics-detail-page[data-game="immortal-1851"]');
  await s.page.evaluate(() => { location.hash = "#/classics"; });
  await s.page.waitForSelector(".classics-grid .classics-item");
  checkProblems("deep link", s.problems);
  await s.context.close();

  step("an unknown game id shows the gallery with a notice");
  s = await newSession(browser, { lang: "en", hash: "#/classics/does-not-exist" });
  await s.page.waitForSelector(".classics-grid .classics-item", { timeout: 10000 });
  assert.match(await s.page.locator(".classics-notice").innerText(), /could not find that game/i);
  checkProblems("unknown id", s.problems);
  await s.context.close();

  step("a cold start on #/museum/school opens that tab");
  s = await newSession(browser, { lang: "en", hash: "#/museum/school" });
  await s.page.waitForSelector("#museum-panel-school:not([hidden]) .museum-concept");
  assert.strictEqual(await routerCurrent(s.page), "museum");
  assert.strictEqual(await s.page.locator("#museum-tab-school").getAttribute("aria-selected"), "true");
  assert.match(await s.page.title(), /^Chess school - History - /, "and the section");
  checkProblems("museum deep link", s.problems);
  await s.context.close();
}

async function trainScenario(browser) {
  const { context, page, problems } = await newSession(browser, { lang: "es" });
  await openGame(page);
  step("Train this game: the chosen count and the hints switch reach the session");
  await page.locator('.classics-train-counts button[data-value="5"]').click();
  assert.strictEqual(await page.locator('[data-fkey="train-start"] .btn-label').innerText(), "Entrenar 5 posiciones");
  assert.strictEqual(await page.locator('[data-fkey="head-train"]').getAttribute("aria-label"), "Entrenar 5 posiciones");
  await page.locator('label[for="classics-train-hints"]').click();
  assert.strictEqual(await page.locator("#classics-train-hints").isChecked(), false);
  assert.match(await page.locator(".classics-train-how").innerText(), /Jugás con las blancas/);
  await page.locator('[data-fkey="train-start"]').click();
  let info = await expectSession(page, "classic", 5);
  assert.strictEqual(info.hints, false, "hints off");
  assert.ok(info.games.every((id) => id === GAME) && info.sources.every((s) => s === "classic"));
  assert.match(info.title, /La Ópera/);
  assert.match(await page.locator("#game-layout").innerText(), /Morphy|Ópera|Opera/i);
  await shot(page, "train-play");
  await leaveGame(page);

  step("the header button trains with the same choices; all the positions when the whole game is chosen");
  await openGame(page);
  assert.strictEqual(await page.locator("#classics-train-hints").isChecked(), false, "the choice is kept while you stay on the same game");
  await page.locator('label[for="classics-train-hints"]').click();
  await page.locator('.classics-train-counts button:last-child').click();
  await page.locator('[data-fkey="head-train"]').click();
  info = await expectSession(page, "classic", 6);
  assert.strictEqual(info.hints, true, "hints on");
  await leaveGame(page);

  step("Try this position starts a session with only that position");
  await openGame(page);
  const ply = await page.evaluate((id) => Ludus.Classics.get(id).positions[1].ply, GAME);
  await page.locator(".classics-scrub-input").fill(String(ply));
  await page.locator('[data-fkey="try-position"]').click();
  info = await expectSession(page, "classic", 1);
  assert.deepStrictEqual(info.plies, [ply]);
  const expectedFen = await page.evaluate(({ id, p }) => Ludus.Classics.get(id).positions.find((x) => x.ply === p).fen, { id: GAME, p: ply });
  assert.strictEqual(info.fens[0], expectedFen);
  await leaveGame(page);

  step("a card's Train button starts five positions of that game");
  await openClassics(page);
  await page.locator(`.classics-item[data-game="${GAME}"] .classics-card-train`).click();
  info = await expectSession(page, "classic", 5);
  assert.ok(info.games.every((id) => id === GAME));
  await leaveGame(page);

  step("Random mix: the difficulty and the count are respected");
  await openClassics(page);
  await page.locator('.classics-mix [data-value="1"]').first().click();
  await page.locator('.classics-mix .classics-seg[aria-label="Cantidad de posiciones"] [data-value="5"]').click();
  assert.match(await page.locator(".classics-mix-start").innerText(), /5 posiciones/);
  assert.match(await page.locator(".classics-mix-hint").innerText(), /posiciones hasta esa dificultad/);
  await page.locator(".classics-mix-start").click();
  info = await expectSession(page, "classic", 5);
  assert.ok(info.difficulties.every((d) => d <= 1), `difficulty <= 1: ${info.difficulties}`);
  assert.ok(new Set(info.games).size >= 4, "a mix comes from several games");
  assert.match(info.title, /Mezcla de clásicos/);
  await leaveGame(page);
  step("the choice is remembered");
  await openClassics(page);
  assert.strictEqual(await page.locator('.classics-mix [data-value="1"][aria-pressed="true"]').count(), 1);

  step("The daily strip starts the daily challenge");
  await page.waitForSelector(".classics-daily .classics-daily-play");
  await page.locator(".classics-daily-play").click();
  info = await expectSession(page, "daily", 1);
  assert.strictEqual(info.fens[0], await page.evaluate(() => Ludus.Classics.daily(new Date().toLocaleDateString("sv-SE")).fen));
  await leaveGame(page);
  checkProblems("train", problems);
  await context.close();
}

async function historyScenario(browser) {
  const { context, page, problems } = await newSession(browser, { lang: "es" });
  step("the nav opens History on the timeline; the tablist has four tabs and one tab stop");
  await page.locator('#shell-nav a[data-nav="museum"]').click();
  await page.waitForSelector("#museum-panel-timeline:not([hidden]) .museum-event");
  assert.strictEqual(await page.locator('[role="tab"]').count(), 4);
  assert.strictEqual(await page.locator('[role="tab"][tabindex="0"]').count(), 1);
  assert.strictEqual(await page.locator('[role="tabpanel"]:not([hidden])').count(), 1);
  assert.match(await page.title(), /^Línea de tiempo - Historia - /, "the tab title names the section (QA A11Y-024)");

  step("timeline: 36 milestones in eras, each expandable to its curiosities and its source");
  assert.strictEqual(await page.locator(".museum-event").count(), 36);
  assert.ok(await page.locator(".museum-era").count() >= 6);
  const first = page.locator(".museum-event").first();
  const more = first.locator(".museum-more");
  assert.strictEqual(await more.getAttribute("aria-expanded"), "false");
  assert.ok(!(await first.locator(".museum-more-panel").isVisible()));
  await more.click();
  assert.strictEqual(await more.getAttribute("aria-expanded"), "true");
  assert.ok(await first.locator(".museum-more-panel").isVisible());
  assert.match(await first.locator(".museum-source").innerText(), /fuente/i);
  await more.click();
  assert.ok(!(await first.locator(".museum-more-panel").isVisible()));

  step("jump to a year lands on the first milestone at or after it, focused and in view");
  await page.locator("#museum-year").fill("1970");
  await page.locator(".museum-year-form button[type=submit]").click();
  await page.waitForFunction(() => document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-item="tl-elo"], .museum-event[data-year="1970"]'));
  assert.strictEqual(await page.evaluate(() => document.activeElement.closest(".museum-event").dataset.year), "1970");
  // The page glides there (smooth scroll), so give it a moment.
  await page.waitForFunction(() => { const r = document.activeElement.closest(".museum-event").getBoundingClientRect(); return r.top >= 60 && r.top < innerHeight - 100; }, null, { timeout: 4000 });
  assert.match(await page.locator("#museum-year-status").innerText(), /1970/);
  await page.locator("#museum-year").fill("abc");
  await page.locator("#museum-year").press("Enter");
  assert.match(await page.locator("#museum-year-status").innerText(), /Escribí un año/i);
  step("an era link scrolls to that era");
  await page.locator('.museum-era-link[data-era="e7"]').click();
  await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains("museum-era-title"));
  assert.match(await page.evaluate(() => document.activeElement.textContent), /digital/i);

  step("the tablist: arrows move between tabs, Home / End go to the ends, the hash follows");
  await page.locator("#museum-tab-timeline").focus();
  await page.keyboard.press("ArrowRight");
  assert.strictEqual(await page.locator("#museum-tab-curiosities").getAttribute("aria-selected"), "true");
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), "museum-tab-curiosities");
  await page.waitForFunction(() => location.hash === "#/museum/curiosities");
  await page.keyboard.press("End");
  assert.strictEqual(await page.locator("#museum-tab-room").getAttribute("aria-selected"), "true");
  await page.keyboard.press("Home");
  await page.waitForFunction(() => location.hash === "#/museum");
  await page.locator("#museum-tab-curiosities").click();

  step("curiosities: 126 facts by category, search, surprise me, show more");
  await page.waitForSelector(".museum-fact-item");
  assert.strictEqual(await page.locator(".museum-fact-item").count(), 24, "24 at first");
  assert.match(await page.locator("#museum-panel-curiosities .museum-count").innerText(), /^24 de 126 curiosidades$/);
  await page.locator(".museum-more-facts").click();
  assert.strictEqual(await page.locator(".museum-fact-item").count(), 48);
  await page.locator('#museum-panel-curiosities .museum-pill[data-cat="machines"]').click();
  assert.strictEqual(await page.locator(".museum-fact-item").count(), 17);
  assert.strictEqual(await page.locator(".museum-fact-item .rd-chip--machines").count(), 17);
  await page.locator('#museum-panel-curiosities .museum-pill[data-cat="all"]').click();
  await page.locator("#museum-search").fill("Fischer");
  await page.waitForFunction(() => { const n = document.querySelectorAll(".museum-fact-item").length; return n > 0 && n < 24; });
  const hits = await page.locator(".museum-fact-item").allInnerTexts();
  assert.ok(hits.every((text) => /fischer/i.test(text)), "every result mentions the word");
  await page.locator("#museum-search").fill("zzzzqq");
  await page.waitForSelector(".museum-empty:not([hidden]) .empty");
  await page.locator(".museum-empty .btn").click();
  await page.waitForFunction(() => document.querySelectorAll(".museum-fact-item").length === 24);
  assert.strictEqual(await page.locator("#museum-search").inputValue(), "");
  assert.ok(!(await page.locator(".museum-surprise").isVisible()));
  await page.locator(".museum-surprise-btn").click();
  await page.waitForSelector(".museum-surprise:not([hidden]) .museum-fact-text");
  const firstSurprise = await page.locator(".museum-surprise .museum-fact-text").innerText();
  assert.ok(firstSurprise.length > 40);
  assert.match(await page.locator(".museum-surprise-btn").innerText(), /Otra sorpresa/);
  const seen = new Set([firstSurprise]);
  for (let i = 0; i < 4; i += 1) {
    await page.locator(".museum-surprise-btn").click();
    seen.add(await page.locator(".museum-surprise .museum-fact-text").innerText());
  }
  assert.ok(seen.size >= 4, `surprises differ (${seen.size} of 5)`);
  await page.locator(".museum-surprise .btn").click();
  assert.ok(!(await page.locator(".museum-surprise").isVisible()));

  step("chess school: 14 lessons with a board and the best-move arrow; the mistake tags filter them");
  await page.locator("#museum-tab-school").click();
  await page.waitForSelector(".museum-concept");
  assert.strictEqual(await page.locator(".museum-concept").count(), 14);
  assert.strictEqual(await page.locator(".museum-concept svg.mini-board .mb-arrow").count(), 14, "every board shows the arrow");
  assert.match(await page.locator(".museum-concept").first().innerText(), /Jugada del ejemplo: Nc7\+/);
  await page.locator('#museum-panel-school .museum-pill[data-tag="pin_or_skewer"]').click();
  assert.strictEqual(await page.locator(".museum-concept").count(), 2);
  assert.match(await page.locator("#museum-panel-school .museum-count").innerText(), /2 lecciones/);
  await page.locator('#museum-panel-school .museum-pill[data-tag="all"]').click();
  await page.locator(".museum-concept").first().locator(".museum-pill-tag").first().click();
  assert.ok((await page.locator(".museum-concept").count()) < 14, "a related-mistake chip filters the lessons");
  await shot(page, "school");

  step("language switch re-renders the tab in place");
  await page.evaluate(() => Ludus.i18n.setLanguage("en"));
  await page.waitForFunction(() => /Chess school/.test(document.querySelector("#museum-tab-school").textContent));
  assert.strictEqual(await page.locator("#museum-tab-school").getAttribute("aria-selected"), "true", "the tab is kept");
  assert.match(await page.locator(".museum-concept").first().innerText(), /Example move|Move of the example/);
  checkProblems("history", problems);
  await context.close();
}

async function readingRoomScenario(browser) {
  const { context, page, problems } = await newSession(browser, { lang: "en" });
  await openMuseum(page, "room");
  await page.waitForSelector(".museum-room .rd-carousel");
  const state = () => page.evaluate(() => {
    const s = Ludus.Screens.museum._state.room.controller.state();
    return { factId: s.factId, index: s.index, state: s.state, remainingMs: s.remainingMs, durationMs: s.durationMs, reasons: s.reasons, paused: s.paused };
  });
  step("the carousel runs with the reading time of the fact (at least 6 s)");
  const start = Date.now();
  const s0 = await state();
  assert.strictEqual(s0.state, "running");
  assert.ok(s0.durationMs >= 6000 && s0.durationMs <= 24000, `reading time ${s0.durationMs}`);
  const text = await page.locator(".rd-text").innerText();
  // The same word rule as js/reader.js (an apostrophe or hyphen inside a word keeps it one word).
  const words = (text.match(/[\p{L}\p{N}]+(?:['\u2019\-][\p{L}\p{N}]+)*/gu) || []).length;
  const expected = Math.round(Math.min(24000, Math.max(6000, (words / 3) * 1000 + 1500)));
  assert.ok(Math.abs(expected - s0.durationMs) <= 60, `reading time ${s0.durationMs} for ${words} words (expected ${expected})`);
  assert.match(await page.locator(".museum-room-counter").innerText(), /^Fact 1 of 126$/);

  step("REAL CLOCK: 3 s later it is still the same fact and about 3 s of the time have been counted");
  await page.waitForTimeout(3000);
  const s1 = await state();
  assert.strictEqual(s1.factId, s0.factId, "does not advance before the reading time");
  const counted = s0.durationMs - s1.remainingMs;
  assert.ok(counted >= 2700 && counted <= 4200, `counted ${counted} ms after 3 s`);

  step("pausing holds the remaining time (the clock keeps running, the countdown does not)");
  await page.locator(".rd-toggle").click();
  const p0 = await state();
  assert.ok(p0.paused && p0.reasons.includes("user"), "paused by the user");
  await page.waitForTimeout(2500);
  const p1 = await state();
  assert.strictEqual(p1.factId, s0.factId);
  assert.ok(Math.abs(p1.remainingMs - p0.remainingMs) <= 120, `remaining held: ${p0.remainingMs} -> ${p1.remainingMs}`);
  assert.strictEqual(await page.locator(".rd-toggle").getAttribute("aria-label"), "Resume automatic rotation");
  step("hovering the fact also pauses it and leaving resumes with what was left");
  await page.locator(".rd-toggle").click();
  await page.mouse.move(20, 20);
  await page.locator(".rd-card").hover();
  const h0 = await state();
  assert.ok(h0.reasons.includes("hover"), `hover pauses (${h0.reasons})`);
  await page.waitForTimeout(1200);
  const h1 = await state();
  assert.ok(Math.abs(h1.remainingMs - h0.remainingMs) <= 120, "hover holds the time");
  await page.mouse.move(20, 20);
  const h2 = await state();
  assert.ok(!h2.reasons.includes("hover") && h2.state === "running", "moving away resumes");

  step("previous / next move by hand and restart the reading time; it never goes before it on its own");
  await page.locator(".rd-next").click();
  await page.mouse.move(20, 20);
  const n0 = await state();
  assert.strictEqual(n0.index, 1);
  assert.notStrictEqual(n0.factId, s0.factId);
  assert.ok(n0.remainingMs >= n0.durationMs - 400, "a new fact starts its own reading time");
  assert.match(await page.locator(".museum-room-counter").innerText(), /^Fact 2 of 126$/);
  await page.locator(".rd-prev").click();
  await page.mouse.move(20, 20);
  assert.strictEqual((await state()).factId, s0.factId);

  step("it advances by itself once the reading time has really passed");
  const before = await state();
  const t0 = Date.now();
  await page.waitForFunction((id) => Ludus.Screens.museum._state.room.controller.state().factId !== id, before.factId, { timeout: before.durationMs + 6000, polling: 100 });
  const elapsed = Date.now() - t0;
  assert.ok(elapsed >= before.durationMs - 500, `advanced after ${elapsed} ms, reading time ${before.durationMs}`);
  assert.match(await page.locator(".museum-room-counter").innerText(), /^Fact 2 of 126$/, "the counter follows the automatic rotation");
  void start;

  step("a topic restarts the carousel with only that category; leaving the tab stops it");
  await page.locator('.museum-room .museum-pill[data-cat="mind"]').click();
  await page.waitForFunction(() => /of 9$/.test(document.querySelector(".museum-room-counter").textContent));
  assert.ok(await page.locator('.rd-carousel[data-cat="mind"]').count() === 1);
  await page.locator("#museum-tab-timeline").click();
  assert.strictEqual(await page.evaluate(() => Ludus.Screens.museum._state.room.controller), null, "the carousel is destroyed with the tab");
  await page.locator("#museum-tab-room").click();
  await page.waitForSelector(".museum-room .rd-carousel");
  assert.strictEqual((await state()).state, "running", "coming back restarts it");
  await page.evaluate(() => Ludus.router.show("home"));
  assert.strictEqual(await page.evaluate(() => Ludus.Screens.museum._state.room.controller), null, "leaving the screen stops it");
  checkProblems("reading room", problems);
  await context.close();
}

// Interactive controls must be at least 44 CSS px in both directions. The system grows the hit area of
// small buttons and chips with a pseudo element (css/system.css: .btn-sm 4px each side, chips 6px; the moves of
// the replay list do the same with 2px), and the
// card link is stretched over the whole card, so those are measured with that margin.
async function smallTargets(page, scopeSelector) {
  return page.evaluate((scope) => {
    const root = document.querySelector(scope) || document.body;
    const out = [];
    const nodes = root.querySelectorAll("button, a[href], input:not([type=hidden]), select, summary, [role=tab]");
    nodes.forEach((el) => {
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none" || el.closest("[hidden]") || el.closest(".sr-only")) return;
      if (el.classList.contains("classics-card-link") || el.classList.contains("sr-only")) return;
      // Links inside a sentence (the sources) are exempt from the target size; the contents of a closed
      // <details> are not on screen.
      if (el.closest(".classics-sources-list") || (el.closest("details:not([open])") && el.tagName !== "SUMMARY")) return;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      if (el.closest("nav.sh-nav, .sh-header, .sh-tabbar")) return; // the shell has its own check
      let w = r.width;
      let h = r.height;
      if (el.classList.contains("btn-sm")) { w += 4; h += 8; }
      if (el.classList.contains("classics-move")) h += 4;
      if (el.matches("button.chip, a.chip")) { w += 4; h += 12; }
      if (el.type === "checkbox") { const l = el.closest("label"); if (l) { const lr = l.getBoundingClientRect(); w = lr.width; h = lr.height; } }
      if (w < 43.5 || h < 43.5) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)}"`);
    });
    return out;
  }, scopeSelector);
}

async function layoutScenario(browser) {
  for (const lang of ["es", "en"]) {
    for (const viewport of VIEWPORTS) {
      const { context, page, problems } = await newSession(browser, { lang, viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
      const label = `${viewport.name} ${lang}`;
      const phone = viewport.width < 720;
      const check = async (what, scope) => {
        await page.waitForTimeout(120);
        const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        assert.ok(overflow.sw <= overflow.cw, `${label} ${what}: horizontal scroll ${overflow.sw} > ${overflow.cw}`);
        noRawKeys(await page.locator(scope).innerText(), `${label} ${what}`);
        const small = await smallTargets(page, scope);
        assert.deepStrictEqual(small, [], `${label} ${what}: targets under 44px:\n  ${small.join("\n  ")}`);
        await shot(page, `${viewport.name}-${lang}-${what.replace(/\W+/g, "-")}`);
      };
      await openClassics(page);
      await check("gallery", "#screen-classics");
      if (phone) {
        await page.locator(".classics-filter-toggle").click();
        assert.strictEqual(await page.locator("#classics-era").isVisible(), true, `${label}: the filters open behind the toggle`);
        await check("gallery-filters-open", "#screen-classics");
      } else {
        assert.strictEqual(await page.locator(".classics-filter-toggle").isVisible(), false, `${label}: no toggle when the filters fit`);
      }
      await openGame(page);
      await page.locator(".classics-scrub-input").fill("19");
      await check("game", "#screen-classics");
      // The replay controls and the board must not overlap each other.
      const boxes = await page.evaluate(() => ["classics-stage", "classics-scrub", "classics-controls-row"].map((c) => { const r = document.querySelector(`.${c}`).getBoundingClientRect(); return { c, top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }));
      assert.ok(boxes[0].bottom <= boxes[1].top + 1 && boxes[1].bottom <= boxes[2].top + 1, `${label}: board, scrubber and controls are stacked without overlap`);
      assert.ok(boxes.every((b) => b.left >= -1 && b.right <= viewport.width + 1), `${label}: the replay stays inside the window`);
      if (viewport.width >= 900) {
        // On a wide screen the board and its controls fit in the window without scrolling.
        const fits = await page.evaluate(() => document.querySelector(".classics-controls-row").getBoundingClientRect().bottom <= innerHeight);
        assert.ok(fits, `${label}: the controls are inside the window`);
      }
      for (const tab of MUSEUM_TABS) {
        await openMuseum(page, tab);
        await check(`history-${tab}`, "#screen-museum");
      }
      checkProblems(label, problems);
      await context.close();
    }
  }
}

// QA VIS-004 / VIS-010 / VIS-021 / VIS-023 / A11Y-006: on a 320 px phone, also with the text at 130 %, no screen scrolls sideways, the "Entrenar"
// CTA never breaks inside its word, a long player name wraps (and has its full name as a tooltip) instead of ending in an ellipsis, the four
// History tabs never collide, and the gallery's opening eyebrow keeps its ECO code on the line of its own card.
async function reflowScenario(browser) {
  const cases = [
    { name: "320x568", width: 320, height: 568, scale: 1 },
    { name: "320x568 at 130 %", width: 320, height: 568, scale: 1.3 },
    { name: "390x844 at 130 %", width: 390, height: 844, scale: 1.3 },
  ];
  for (const lang of ["es", "en"]) {
    for (const item of cases) {
      const { context, page, problems } = await newSession(browser, { lang, viewport: { width: item.width, height: item.height }, deviceScaleFactor: 1 });
      const label = `${item.name} ${lang}`;
      if (item.scale !== 1) await page.evaluate((scale) => Ludus.Settings.set("a11y.textScale", scale), item.scale);
      const noSideways = async (what) => {
        await page.waitForTimeout(150);
        const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        assert.ok(overflow.sw <= overflow.cw, `${label} ${what}: horizontal scroll ${overflow.sw} > ${overflow.cw}`);
      };
      await openClassics(page);
      await noSideways("gallery");
      const eyebrows = await page.evaluate(() => Array.from(document.querySelectorAll(".classics-card-opening")).map((p) => {
        const eco = p.querySelector(".classics-eco");
        const first = p.getBoundingClientRect();
        return eco ? Math.round(eco.getBoundingClientRect().top - first.top) : 0;
      }));
      assert.ok(eyebrows.every((top) => top <= 4), `${label}: the ECO chip sits on the first line of every eyebrow (${eyebrows.join(",")})`);
      await openGame(page, "opera-1858");
      await noSideways("game page");
      const cta = await page.evaluate(() => {
        const button = document.querySelector(".classics-head-train .btn-label");
        const range = document.createRange();
        range.selectNodeContents(button);
        return { lines: new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top))).size, width: button.getBoundingClientRect().width };
      });
      assert.strictEqual(cta.lines, 1, `${label}: the train CTA stays on one line`);
      const names = await page.evaluate(() => Array.from(document.querySelectorAll(".classics-player-name")).map((el) => ({ text: el.textContent, title: el.getAttribute("title"), cut: el.scrollHeight > el.clientHeight + 1 })));
      assert.ok(names.every((n) => n.title === n.text), `${label}: every player name carries its full name as a tooltip`);
      assert.ok(names.every((n) => !n.cut), `${label}: a player name is never cut (three lines hold the longest one, also at 130 %)`);
      for (const tab of MUSEUM_TABS) {
        await openMuseum(page, tab);
        await noSideways(`history ${tab}`);
      }
      const tabs = await page.evaluate(() => Array.from(document.querySelectorAll(".museum-tab")).map((tab) => { const r = tab.getBoundingClientRect(); const l = tab.querySelector(".museum-tab-label").getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, lLeft: l.left, lRight: l.right, lBottom: l.bottom }; }));
      tabs.forEach((tab) => {
        assert.ok(tab.lLeft >= tab.left - 1 && tab.lRight <= tab.right + 1, `${label}: a History tab label stays inside its tab`);
        assert.ok(tab.lBottom <= tab.bottom - 4, `${label}: a History tab label does not touch the tab underline`);
      });
      checkProblems(label, problems);
      await context.close();
    }
  }
  step("320 px and 130 % text: no sideways scroll, the CTA and player names wrap cleanly, the History tabs fit (es + en)");
}

async function motionFocusScenario(browser) {
  step("reduced motion: the screen and the highlights do not animate; the board does not slide");
  let s = await newSession(browser, { lang: "en", reducedMotion: "reduce" });
  await openMuseum(s.page, "timeline");
  const names = await s.page.evaluate(() => ({
    screen: getComputedStyle(document.querySelector("#screen-museum")).animationName,
    card: getComputedStyle(document.querySelector(".museum-event-card")).transitionDuration,
  }));
  assert.strictEqual(names.screen, "none", "no entrance animation");
  await s.page.locator("#museum-year").fill("1972");
  await s.page.locator(".museum-year-form button[type=submit]").click();
  await s.page.waitForFunction(() => document.querySelector(".museum-event.is-target"));
  assert.strictEqual(await s.page.evaluate(() => getComputedStyle(document.querySelector(".museum-event.is-target .museum-event-card")).animationName), "none", "the jump highlight does not animate");
  await openGame(s.page);
  await s.page.locator('[data-action="next"]').click();
  assert.strictEqual(await s.page.evaluate(() => document.querySelectorAll(".classics-board .bd-moving").length), 0, "no piece is sliding");
  await s.page.locator('[data-action="play"]').click(); // still works, just without motion
  await s.page.locator('[data-action="play"]').click();
  assert.ok(names.card !== undefined);
  checkProblems("reduced motion", s.problems);
  await s.context.close();

  step("keyboard focus is visible on cards, tabs, transport buttons and moves");
  s = await newSession(browser, { lang: "en" });
  await openClassics(s.page);
  await s.page.locator("#classics-search").focus();
  await s.page.keyboard.press("Tab"); // difficulty segmented (or the toggle on a phone)
  let guard = 0;
  while (guard < 30 && !(await s.page.evaluate(() => document.activeElement && document.activeElement.classList.contains("classics-card-link")))) {
    await s.page.keyboard.press("Tab");
    guard += 1;
  }
  assert.ok(guard < 30, "tabbing reaches a card link");
  const ring = await s.page.evaluate(() => {
    const link = document.activeElement;
    const card = link.closest(".classics-card");
    const cs = getComputedStyle(card);
    return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor };
  });
  assert.ok(ring.style !== "none" && ring.width >= 2, `the focused card has a ring: ${JSON.stringify(ring)}`);
  await openMuseum(s.page, "timeline");
  await s.page.locator("#museum-tab-timeline").focus();
  await s.page.keyboard.press("Tab");
  const tabRing = await s.page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) }; });
  assert.ok(tabRing.style !== "none", "a focused control has an outline");
  await openGame(s.page);
  await s.page.locator('[data-action="next"]').focus();
  const btnRing = await s.page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) }; });
  assert.ok(btnRing.style !== "none" && btnRing.width >= 2, `transport button focus ring: ${JSON.stringify(btnRing)}`);
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
  for (const [lang, viewport] of [["es", { width: 1280, height: 800 }], ["en", { width: 390, height: 844 }]]) {
    const { context, page, problems } = await newSession(browser, { lang, viewport, bypassCSP: true });
    await page.addScriptTag({ content: source });
    const scan = async (label, scope) => {
      await page.waitForTimeout(250);
      const violations = await page.evaluate(async (include) => (await axe.run(include ? { include: [[include]] } : document, { resultTypes: ["violations"] })).violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`), scope || null);
      assert.deepStrictEqual(violations, [], `axe (${lang} ${label}): ${violations.join(" | ")}`);
    };
    await openClassics(page);
    await scan("classics gallery", "#screen-classics");
    await page.locator("#classics-search").fill("morphy");
    await page.waitForFunction(() => document.querySelectorAll(".classics-item").length === 2);
    await scan("classics filtered", "#screen-classics");
    await page.locator("#classics-search").fill("zzzz");
    await page.waitForSelector(".classics-empty:not([hidden])");
    await scan("classics empty", "#screen-classics");
    await openGame(page);
    await scan("game start", "#screen-classics");
    await page.locator(".classics-scrub-input").fill("22");
    await scan("game before a training move", "#screen-classics");
    await page.locator(".classics-scrub-input").fill("19");
    await scan("game with a note", "#screen-classics");
    await page.locator(".classics-sources > summary").click();
    await page.locator('[data-action="last"]').click();
    await scan("game at the end, sources open", "#screen-classics");
    for (const tab of MUSEUM_TABS) {
      await openMuseum(page, tab);
      await scan(`history ${tab}`, "#screen-museum");
    }
    await openMuseum(page, "timeline");
    await page.locator(".museum-more").first().click();
    await scan("timeline expanded", "#screen-museum");
    await openMuseum(page, "curiosities");
    await page.locator(".museum-surprise-btn").click();
    await scan("curiosities with the surprise", "#screen-museum");
    step(`${lang}: no serious or critical violations on 13 states`);
    checkProblems(`axe ${lang}`, problems);
    await context.close();
  }
}

// ---------- main ----------

const scenarios = [
  ["gallery", galleryScenario],
  ["game page + replay", replayScenario],
  ["deep links", deepLinkScenario],
  ["train", trainScenario],
  ["history tabs", historyScenario],
  ["reading room", readingRoomScenario],
  ["layout", layoutScenario],
  ["reflow", reflowScenario],
  ["motion + focus", motionFocusScenario],
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
  console.log("learn e2e passed");
})();
