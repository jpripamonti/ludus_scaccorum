// Browser end-to-end check of what the coach TEACHES (js/insights.js, js/scoring.js, Ludus.chess.localizeSan)
// in real Chromium, against the real Stockfish Worker: the words of the verdict, the sentences under it,
// the piece letters of the moves, and that a missed mate is scored by the new rule.
//
// Playwright is NOT a project dependency and this script is not part of `npm test`. Run it by hand:
//
//   python3 -m http.server 5113 &                          # serve the repo root
//   LUDUS_URL=http://127.0.0.1:5113/ NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/teach.js
//
// Environment (all optional): LUDUS_URL (default http://127.0.0.1:5113/), LUDUS_CHROMIUM (chrome binary),
// LUDUS_E2E_SHOTS (directory for screenshots of the results).
//
// Scenarios, each in a fresh context with service workers blocked and the CSP enforced:
//   notation   A Spanish page writes the rook as T (Txd5), an English page as R (Rxd5), the setting
//              notation.style overrides the language both ways, and a king move is R in Spanish; the
//              verdict line and the sentences under it agree.
//   mate       Missing Byrne-Fischer's forced mate with a move that keeps +15 is scored by the new rule (not the
//              old cap at 1.0), the verdict uses the new words, names the mate and is never "a solid alternative".
//   ladder     The quality words are one ladder in both languages (Scoring.qualityLabel, what the coach
//              shows), and a tactical blunder gets a sentence about material instead of "it may be positional".
//
// Every scenario fails on a console error, an uncaught page error or a failed request. Exits 0 on success,
// 1 on the first failure, 2 when Playwright is missing.

"use strict";

const assert = require("assert");
const fs = require("fs");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright is not installed. Run with NODE_PATH=/opt/node22/lib/node_modules (see the header of this file).");
  process.exit(2);
}

const BASE_URL = process.env.LUDUS_URL || "http://127.0.0.1:5113/";
const FALLBACK_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const RESULT_TIMEOUT_MS = 60000;
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

const step = (message) => console.log(`  - ${message}`);
const SHOT_DIR = process.env.LUDUS_E2E_SHOTS || "";
async function shot(page, name) {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
}

async function open(browser, lang, settings) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: LOCALES[lang], serviceWorkers: "block" });
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
  await page.locator("#landing-start-btn").click();
  await page.waitForFunction(() => Ludus.router.current() === "home");
  if (settings) await page.evaluate((entries) => Object.keys(entries).forEach((key) => Ludus.Settings.set(key, entries[key])), settings);
  return { context, page, problems, lang };
}

const square = (page, name) => page.locator(`#board .square[data-square="${name}"]`);
async function playUci(page, uci) {
  await square(page, uci.slice(0, 2)).click();
  await square(page, uci.slice(2, 4)).click();
}
const waitResult = (page) => page.waitForFunction(() => STATE.ui.phase === "result" && Boolean(STATE.resultView.context) && document.querySelector("#game-layout").getAttribute("data-phase") === "result", null, { timeout: RESULT_TIMEOUT_MS });
const startSession = (page, fens) => page.evaluate(async (list) => {
  await Ludus.game.startSession({ kind: "classic", title: "Teach", positions: list.map((fen, index) => ({ fen, source: "classic", id: `teach:${index}` })) });
}, fens);
const panelText = async (page) => ((await page.locator("#game-layout").textContent()) || "").replace(/\s+/g, " ");
const lastRound = (page) => page.evaluate(() => JSON.parse(JSON.stringify(STATE.resultView.context.answers[STATE.resultView.context.answers.length - 1])));

function done(label, problems) {
  assert.deepStrictEqual(problems, [], `${label}: the page reported problems:\n  ${problems.join("\n  ")}`);
}

// A free bishop: the best move is the rook capture, whatever else is played.
const FREE_BISHOP = "4k3/8/8/3b4/8/8/8/3RK3 w - - 0 1";

async function scenarioNotation(browser) {
  for (const [lang, settings, rook, king] of [["es", null, "Txd5", "Rf1"], ["en", null, "Rxd5", "Kf1"], ["en", { "notation.style": "spanish" }, "Txd5", "Rf1"], ["es", { "notation.style": "english" }, "Rxd5", "Kf1"]]) {
    const label = `notation ${lang}${settings ? ` (${JSON.stringify(settings)})` : ""}`;
    const { context, page, problems } = await open(browser, lang, settings);
    await startSession(page, [FREE_BISHOP]);
    await playUci(page, "e1e2");
    await waitResult(page);
    const text = await panelText(page);
    assert.ok(text.includes(rook), `${label}: the rook capture is written ${rook}. Panel: ${text.slice(0, 600)}`);
    const wrong = rook === "Txd5" ? "Rxd5" : "Txd5";
    assert.ok(!text.includes(wrong), `${label}: the other notation must not appear (${wrong}). Panel: ${text.slice(0, 600)}`);
    const localized = await page.evaluate(() => Ludus.chess.localizeSan("Kf1", Ludus.i18n.lang()));
    assert.strictEqual(localized, king, `${label}: a king move`);
    const spoken = await page.evaluate(() => Ludus.chess.spokenSan("Rxd5", Ludus.i18n.lang()));
    assert.ok(/torre captura en d5|rook takes d5/.test(spoken), `${label}: the spoken move (${spoken})`);
    await shot(page, `teach-notation-${lang}${settings ? "-" + Object.values(settings)[0] : ""}`);
    step(`${label}: ${rook} and ${localized}`);
    done(label, problems);
    await context.close();
  }
}

// Byrne-Fischer 1956, Black to move: Ng3+ mates; Bd4 keeps +15 but is not a mate.
const BYRNE_FISCHER_MATE = "1Q6/5pk1/2p3p1/1pbbN2p/4n2P/8/r5P1/5K2 b - - 5 36";

async function scenarioMate(browser) {
  for (const lang of ["en", "es"]) {
    const { context, page, problems } = await open(browser, lang);
    await page.evaluate(async (fen) => {
      await Ludus.Classics.load();
      const game = Ludus.Classics.list().find((entry) => entry.id === "byrne-fischer-1956");
      const position = Ludus.Classics.positions(game.id, { count: 99, shuffle: false }).find((entry) => entry.fen === fen);
      await Ludus.game.startSession({ kind: "classic", title: "Mate", positions: [position] });
    }, BYRNE_FISCHER_MATE);
    await playUci(page, "c5d4");
    await waitResult(page);
    const answer = await lastRound(page);
    assert.strictEqual(answer.assessment.reason, "missed_mate", `${lang}: missed mate`);
    assert.strictEqual(answer.assessment.keptWin, true, `${lang}: the move still wins`);
    assert.ok(answer.assessment.points > 3 && answer.assessment.points < 7 && ["interesting", "dubious"].includes(answer.assessment.qualityCode),
      `${lang}: the new rule, not the old cap at 1.0 (${answer.assessment.qualityCode} ${answer.assessment.points})`);
    const text = await panelText(page);
    assert.ok(lang === "en" ? /Inaccuracy|Dubious/.test(text) : /Imprecisa|Dudosa/.test(text), `${lang}: the verdict uses the new ladder. Panel: ${text.slice(0, 500)}`);
    assert.ok(lang === "en" ? /forced mate/i.test(text) : /mate forzado/i.test(text), `${lang}: the mate is named`);
    assert.ok(!/solid alternative|alternativa sólida|Serious mistake|Error grave/i.test(text), `${lang}: neither "solid" nor "serious mistake" next to a missed mate that keeps +15. Panel: ${text.slice(0, 500)}`);
    await shot(page, `teach-mate-${lang}`);
    step(`${lang}: missed mate scores ${answer.assessment.points} (${answer.assessment.qualityCode}), still winning`);
    done(`mate ${lang}`, problems);
    await context.close();
  }
}

async function scenarioLadder(browser) {
  const { context, page, problems } = await open(browser, "en");
  const words = await page.evaluate(() => {
    const out = {};
    ["es", "en"].forEach((lang) => {
      out[lang] = ["blunder", "bad", "dubious", "interesting", "good", "very_good", "perfect"].map((code) => Ludus.Scoring.qualityLabel(code, lang));
    });
    return out;
  });
  assert.deepStrictEqual(words.en, ["Serious mistake", "Mistake", "Dubious", "Inaccuracy", "Good", "Very good", "Perfect"]);
  assert.deepStrictEqual(words.es, ["Error grave", "Error", "Dudosa", "Imprecisa", "Buena", "Muy buena", "Perfecta"]);
  // The legacy copy in app.js is gone: the verdict chip of the round reads the same word as Scoring.
  await startSession(page, [FREE_BISHOP]);
  await playUci(page, "e1e2");
  await waitResult(page);
  const chip = await page.evaluate(() => document.querySelector("#game-layout").textContent.replace(/\s+/g, " "));
  const answer = await lastRound(page);
  const label = words.en[["blunder", "bad", "dubious", "interesting", "good", "very_good", "perfect"].indexOf(answer.assessment.qualityCode)];
  assert.ok(!label || chip.includes(label), `the verdict shows the ladder word "${label}" for ${answer.assessment.qualityCode}. Panel: ${chip.slice(0, 500)}`);
  // A free piece was left on the board: the sentence talks about material, not about "positional" comfort.
  assert.ok(/Rxd5 looks like it wins the bishop on d5/.test(chip), `the capture is explained. Panel: ${chip.slice(0, 600)}`);
  assert.ok(!/positional/i.test(chip), "a tactical miss is not called positional");
  step(`ladder: ${words.en.join(" / ")}; verdict "${label}"`);
  done("ladder", problems);
  await context.close();
}

(async () => {
  const browser = await launchBrowser();
  try {
    for (const [name, run] of [["notation", scenarioNotation], ["mate", scenarioMate], ["ladder", scenarioLadder]]) {
      console.log(`scenario ${name}`);
      await run(browser);
    }
    console.log("teach.js: all scenarios passed");
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
