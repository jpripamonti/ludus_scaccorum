// Browser end-to-end check of the Account screen (js/ui/account.js, css/account.css) in real Chromium: profiles, the
// export / import round trip, delete-all, the optional Google sync against MOCKED Google endpoints, install, about.
//
// Playwright is NOT a project dependency (the app has no runtime or dev dependencies) and this script is not
// part of `npm test`. Run it by hand:
//
//   python3 -m http.server 5010 &                      # serve the repo root
//   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/account.js
//
// Environment (all optional):
//   LUDUS_URL             page to test               (default http://127.0.0.1:5010/)
//   LUDUS_E2E_ONLY        run only the scenarios whose name contains this text (e.g. "google")
//   LUDUS_E2E_VIEWPORTS   comma list of WIDTHxHEIGHT to use in "layout" and "axe" instead of the seven defaults
//   LUDUS_CHROMIUM        chrome binary if Playwright cannot launch its own
//                         (falls back to /opt/pw-browsers/chromium-1194/chrome-linux/chrome)
//   LUDUS_E2E_SHOTS       directory for screenshots (none are saved when unset)
//   LUDUS_AXE             path to axe.min.js: turns on the axe scans (axe-core is not a project dependency; those
//                         scenarios run in a context that bypasses the CSP because axe is injected as a script)
//
// Nothing here reaches Google, Lichess or any other host: the Google Identity script, the userinfo endpoint and
// Drive (list, create, download, update, delete, with CORS preflights) are answered by an in-memory fake shared
// by every browser context of a scenario, so a second "device" is just a second context. window.LUDUS_CONFIG gets
// a client id through an init script that runs BEFORE config.js (whose assignment is merged, not obeyed).
//
// Scenarios (each in a fresh context with service workers blocked, CSP enforced):
//   profiles   Create (name + colour), rename, switch, delete with the typed name (the button stays off until it
//              matches), the four-profile limit, the header chip following every change, focus after each dialog.
//   data       Export downloads a dated JSON file; wipe; import it back (dry run summary, merge / replace);
//              a bad file, an oversized file and a foreign JSON are explained; drag and drop; delete all with the
//              typed word; the storage indicator.
//   nogoogle   Not configured: the quiet card, no dead button, no request to Google at all.
//   google     Configured: nothing is requested before the click; sign in (popup mocked), name escaped, first sync
//              creates the Drive file; sync now; a SECOND device merges and both converge; server error, popup
//              closed / blocked, Drive scope refused, an expired session asks to reconnect; reload shows the
//              remembered account with Reconnect; sign out; sign out and revoke.
//   install    beforeinstallprompt captured before the screen exists, the button, the accepted / dismissed answers,
//              the iOS hint.
//   about      Version, licence, safe external links, privacy notes, the keyboard cheat sheet.
//   keyboard   Tab reaches every control with a visible focus ring (also with the Google card signed in), the create
//              dialog opens from the keyboard, traps focus, closes with Escape and gives focus back; the import
//              drop area is a real file input reachable with Tab; the mode radios move with the arrow keys.
//   layout     Seven viewports x es / en, in the states the screen has: no horizontal scroll, nothing sticking out,
//              44x44 targets, no clipped label, no overlap, every text at 4.5:1 (3:1 large); axe with LUDUS_AXE.
//   axe        (with LUDUS_AXE) no serious or critical violation in: default, sync off, signed in, error, import
//              review, and the create / delete dialogs, four viewports, both languages.
//
// Every scenario fails on any console error, uncaught page error or failed request (except the ones a scenario
// causes on purpose and says so). Exits 0 on success, 1 on the first failed scenario, 2 if Playwright is missing.

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const common = require("./_settings-account-common.js");
const { assert, open, step, shot, settle, checkProblems, checkIssues, inspect, viewportsFromEnv, AXE_PATH, runScenarios } = common;

const DESKTOP = { name: "desktop-1280", w: 1280, h: 800, touch: false };
const PHONE = { name: "phone-390", w: 390, h: 844, touch: true };
const CLIENT_ID = "test.apps.googleusercontent.com";
const FILE_NAME = "ludus-progress-v1.json";
const PICTURE = "https://lh3.googleusercontent.com/a/test-photo=s96";
const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const openAccount = (browser, vp, options = {}) => open(browser, vp, Object.assign({ hash: "#/account", screen: "account" }, options));
const text = async (locator) => ((await locator.innerText()) || "").replace(/\s+/g, " ").trim();
const profiles = (page) => page.evaluate(() => Ludus.Profile.list().map((entry) => ({ id: entry.id, name: entry.name, active: entry.active, color: entry.color })));
const positions = (page, id) => page.evaluate((profileId) => Ludus.Profile.stats(profileId).totalPositions, id || null);

// ---------- seeding ----------

// Records `count` valid rounds (ids r<from>.. r<from+count-1>) in the active profile.
function seedRounds(page, from, count) {
  return page.evaluate(({ start, total }) => {
    const fenN = (n) => {
      const squareOf = (k) => (8 - (2 + Math.floor(k / 8))) * 8 + (k % 8);
      const i = n % 48;
      let j = Math.floor(n / 48) % 47;
      if (j >= i) j += 1;
      const board = Array(64).fill("");
      board[56] = "K"; board[7] = "k"; board[squareOf(i)] = "P"; board[squareOf(j)] = "p";
      const rows = [];
      for (let r = 0; r < 8; r += 1) {
        let row = ""; let empty = 0;
        for (let f = 0; f < 8; f += 1) { const piece = board[r * 8 + f]; if (piece) { if (empty) row += empty; empty = 0; row += piece; } else empty += 1; }
        if (empty) row += empty;
        rows.push(row);
      }
      return `${rows.join("/")} w - - 0 1`;
    };
    for (let n = start; n < start + total; n += 1) {
      Ludus.Profile.recordRound({
        id: `r${n}`, ts: Date.now() - 3600000 - n * 1000, sessionId: "s1", sessionKind: "classic", source: "classic", positionId: `classic:${n}`, fen: fenN(n), sideToMove: "w", phase: "middlegame",
        userUci: "e2e4", userSan: "e4", bestUci: "d2d4", bestSan: "d4", points: 7.5, accuracy: 75, qualityCode: "good", winLossPct: 4, cpLoss: 35, isBest: false, rank: 2, onlyMove: false,
        timeSpentMs: 12000, hintsUsed: 0, timedOut: false, tags: [], lines: [{ uci: "d2d4", san: "d4", score: 30, pv: ["d2d4", "d7d5", "c2c4"] }], meta: { players: "A vs B", event: "Test", year: 1900 },
      });
    }
  }, { start: from, total: count });
}

// ---------- the Google fakes ----------

const GIS_SCRIPT = `
(function () {
  var g = window.__gis;
  window.google = { accounts: { oauth2: {
    initTokenClient: function (cfg) {
      return { requestAccessToken: function (overrides) {
        g.calls.push({ prompt: overrides && overrides.prompt, hint: overrides && overrides.hint, scope: cfg.scope });
        setTimeout(function () {
          var mode = g.mode;
          if (mode === "silent-fail" && overrides && overrides.prompt === "none") return cfg.error_callback({ type: "popup_failed_to_open" });
          if (mode === "closed") return cfg.error_callback({ type: "popup_closed" });
          if (mode === "blocked") return cfg.error_callback({ type: "popup_failed_to_open" });
          if (mode === "denied") return cfg.callback({ error: "access_denied" });
          if (mode === "no-drive") return cfg.callback({ access_token: "tok-" + (++g.tokenSeq), expires_in: 3600, scope: "openid email profile" });
          cfg.callback({ access_token: "tok-" + (++g.tokenSeq), expires_in: g.expiresIn, scope: cfg.scope });
        }, 25);
      } };
    },
    revoke: function (token, done) { g.revoked.push(token); setTimeout(function () { if (done) done({ successful: true }); }, 10); }
  } } };
})();
`;

// The page's own init script: the config (merged over config.js's assignment) and the GIS control panel.
function initScript(clientId) {
  return (id) => {
    let cfg = { googleClientId: id };
    Object.defineProperty(window, "LUDUS_CONFIG", {
      configurable: true,
      get() { return cfg; },
      set(value) { cfg = Object.assign({}, value, { googleClientId: id }); },
    });
    window.__gis = { mode: "ok", calls: [], revoked: [], tokenSeq: 0, expiresIn: 3600 };
  };
}

// One in-memory Google account with one Drive appDataFolder, shared by every context that installs it.
function createGoogle(options = {}) {
  const google = {
    user: Object.assign({ sub: "1001", name: "Ana <b>Pérez</b>", email: "ana@example.com", picture: PICTURE }, options.user),
    files: new Map(), // id -> { id, name, content, createdTime }
    seq: 0,
    requests: [],
    gsiLoads: 0,
    fail: null, // { status, times } answers the next Drive calls with that status
    preflights: 0,
  };
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS", "access-control-max-age": "600" };
  const json = (route, status, body) => route.fulfill({ status, headers: Object.assign({ "content-type": "application/json" }, cors), body: JSON.stringify(body) });

  google.install = async (context) => {
    await context.route("https://accounts.google.com/gsi/client", (route) => {
      google.gsiLoads += 1;
      return route.fulfill({ status: 200, contentType: "text/javascript", body: GIS_SCRIPT });
    });
    await context.route("https://lh3.googleusercontent.com/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG_1X1, headers: { "access-control-allow-origin": "*" } }));
    await context.route("https://www.googleapis.com/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      if (method === "OPTIONS") {
        google.preflights += 1;
        return route.fulfill({ status: 204, headers: cors });
      }
      const auth = request.headers().authorization || "";
      google.requests.push(`${method} ${url.pathname}${url.search ? "?" : ""}${url.searchParams.get("uploadType") || (url.searchParams.get("alt") ? `alt=${url.searchParams.get("alt")}` : "")}`);
      if (!/^Bearer tok-\d+$/.test(auth)) return json(route, 401, { error: { code: 401, message: "Invalid Credentials" } });
      if (url.pathname === "/oauth2/v3/userinfo") return json(route, 200, google.user);
      if (google.fail && google.fail.times > 0) {
        google.fail.times -= 1;
        return json(route, google.fail.status, { error: { code: google.fail.status, message: "injected", errors: [{ reason: google.fail.reason || "backendError" }] } });
      }
      if (method === "GET" && url.pathname === "/drive/v3/files") {
        const list = Array.from(google.files.values()).filter((file) => url.searchParams.get("q").includes(`name='${file.name}'`)).map((file) => ({ id: file.id, name: file.name, createdTime: file.createdTime }));
        return json(route, 200, { files: list });
      }
      const fileMatch = /^\/drive\/v3\/files\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
      if (fileMatch && method === "GET" && url.searchParams.get("alt") === "media") {
        const file = google.files.get(fileMatch[1]);
        if (!file) return json(route, 404, { error: { code: 404, message: "File not found" } });
        return route.fulfill({ status: 200, headers: Object.assign({ "content-type": "application/json" }, cors), body: file.content });
      }
      if (fileMatch && method === "DELETE") {
        google.files.delete(fileMatch[1]);
        return route.fulfill({ status: 204, headers: cors });
      }
      if (method === "POST" && url.pathname === "/upload/drive/v3/files") {
        const type = request.headers()["content-type"] || "";
        const boundary = /boundary=(.+)$/.exec(type)[1];
        const parts = request.postData().split(`--${boundary}`).filter((part) => /Content-Type/i.test(part));
        const body = parts[1].split(/\r?\n\r?\n/).slice(1).join("\n\n").replace(/\r?\n$/, "");
        const meta = JSON.parse(parts[0].split(/\r?\n\r?\n/).slice(1).join("\n\n"));
        google.seq += 1;
        const id = `file${google.seq}`;
        google.files.set(id, { id, name: meta.name, content: body, createdTime: new Date(Date.UTC(2026, 0, 1, 0, 0, google.seq)).toISOString(), parents: meta.parents });
        return json(route, 200, { id });
      }
      const uploadMatch = /^\/upload\/drive\/v3\/files\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
      if (uploadMatch && method === "PATCH") {
        const file = google.files.get(uploadMatch[1]);
        if (!file) return json(route, 404, { error: { code: 404, message: "File not found" } });
        file.content = request.postData();
        return json(route, 200, { id: file.id });
      }
      return json(route, 400, { error: { code: 400, message: `unhandled ${method} ${url.pathname}` } });
    });
  };
  google.file = () => Array.from(google.files.values())[0] || null;
  google.doc = () => (google.file() ? JSON.parse(google.file().content) : null);
  return google;
}

// Answers this scenario injects on purpose (a Drive 500, a 403) show up in the console and the network log:
// they are the expected side effect, everything else is still a failure.
const EXPECTED_GOOGLE_NOISE = [/status of (401|403|500)/, /^HTTP (401|403|500): https:\/\/www\.googleapis\.com\//];

const googleContext = (google, extra = {}) => Object.assign({
  initScript: initScript(CLIENT_ID),
  initArg: CLIENT_ID,
  routes: (context) => google.install(context),
  ignoreProblems: EXPECTED_GOOGLE_NOISE,
}, extra);

const gis = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__gis)));
const setGis = (page, patch) => page.evaluate((values) => Object.assign(window.__gis, values), patch);
const syncCard = (page) => page.locator("[data-card=\"sync\"]");
const syncStatus = (page) => syncCard(page).locator(".account-sync-status").getAttribute("data-status");
const waitStatus = (page, status, timeout = 15000) => page.waitForFunction((wanted) => {
  const el = document.querySelector("[data-card=\"sync\"] .account-sync-status");
  return Boolean(el) && el.getAttribute("data-status") === wanted;
}, status, { timeout });

// ---------- scenario: profiles ----------

async function profilesFlow(browser) {
  const ctx = await openAccount(browser, DESKTOP, { lang: "en", tag: "profiles" });
  const { page } = ctx;
  const cards = page.locator("li.account-profile");
  assert.strictEqual(await cards.count(), 1);
  assert.match(await text(cards.first()), /Player/);
  assert.ok(await cards.first().locator(".account-active").isVisible(), "the only profile is the active one");
  await shot(page, "profiles-start");

  // create: name + colour; a second profile that becomes the active one
  await page.locator("[data-action=\"add\"]").click();
  const dialog = page.locator(".modal");
  await dialog.waitFor();
  assert.match(await text(dialog.locator(".modal-title")), /New profile/);
  assert.ok(await dialog.locator("input[type=\"text\"]").evaluate((el) => document.activeElement === el), "the name field has focus");
  await dialog.locator(".modal-actions .btn-primary").click();
  assert.match(await text(dialog.locator(".field-error")), /Type a name/, "an empty name is refused inside the dialog");
  await dialog.locator("input[type=\"text\"]").fill("Bruno");
  await dialog.locator(".account-swatch").nth(3).click();
  await shot(page, "profiles-create-dialog");
  await dialog.locator(".modal-actions .btn-primary").click();
  await page.waitForSelector(".modal", { state: "detached" });
  const list = await profiles(page);
  assert.deepStrictEqual(list.map((entry) => entry.name), ["Player", "Bruno"]);
  assert.strictEqual(list[1].active, true, "the new profile is active (the box was ticked)");
  assert.strictEqual(list[1].color, await page.evaluate(() => Ludus.Profile.constants.PALETTE[3]));
  assert.ok(await page.locator("li.account-profile[data-active=\"true\"] .account-profile-name").evaluate((el) => document.activeElement === el), "focus lands on the new profile");
  assert.match(await page.locator(".sh-profile-btn, [aria-label*=\"Bruno\"]").first().getAttribute("aria-label"), /Bruno/, "the header chip follows");
  step("create: name and colour, refuses an empty name, switches");

  // rename
  const bruno = list[1];
  await page.locator(`[data-action="rename"][data-id="${bruno.id}"]`).click();
  await page.waitForSelector(".modal");
  const field = page.locator(".modal input[type=\"text\"]");
  assert.strictEqual(await field.inputValue(), "Bruno");
  await field.fill("Bruno Díaz");
  await page.keyboard.press("Enter");
  await page.waitForSelector(".modal", { state: "detached" });
  assert.strictEqual((await profiles(page))[1].name, "Bruno Díaz");
  assert.ok(await page.locator(`[data-action="rename"][data-id="${bruno.id}"]`).evaluate((el) => document.activeElement === el), "focus returns to the Rename button");
  assert.match(await page.locator("[aria-label*=\"Bruno Díaz\"]").first().getAttribute("aria-label"), /Bruno Díaz/);
  step("rename with Enter, focus back on the button, header chip follows");

  // switch back
  const first = list[0];
  await page.locator(`[data-action="use"][data-id="${first.id}"]`).click();
  assert.strictEqual((await profiles(page)).find((entry) => entry.active).id, first.id);
  assert.ok(await page.locator(`li.account-profile[data-profile-id="${first.id}"] .account-active`).isVisible());
  await page.locator(".toast").filter({ hasText: "You are now playing as Player" }).waitFor();
  step("switch");

  // delete with the typed name
  await seedRounds(page, 0, 3);
  await page.locator(`[data-action="delete"][data-id="${bruno.id}"]`).click();
  await page.waitForSelector(".modal");
  const confirm = page.locator(".modal .btn-danger");
  assert.ok(await confirm.isDisabled(), "the delete button is off until the name is typed");
  await page.locator(".modal input[type=\"text\"]").fill("bruno");
  assert.ok(await confirm.isDisabled(), "a part of the name is not enough");
  await page.locator(".modal input[type=\"text\"]").fill("bruno díaz");
  assert.ok(!(await confirm.isDisabled()), "case is forgiven");
  await shot(page, "profiles-delete-dialog");
  await confirm.click();
  await page.waitForSelector(".modal", { state: "detached" });
  assert.strictEqual((await profiles(page)).length, 1);
  assert.strictEqual(await positions(page), 3, "the other profile keeps its progress");
  step("delete: the typed name unlocks the button, the other profile is untouched");

  // the limit
  for (const name of ["Carla", "Dani", "Elena"]) {
    await page.locator("[data-action=\"add\"]").click();
    await page.locator(".modal input[type=\"text\"]").fill(name);
    await page.locator(".modal .modal-actions .btn-primary").click();
    await page.waitForSelector(".modal", { state: "detached" });
  }
  assert.strictEqual((await profiles(page)).length, 4);
  assert.strictEqual(await page.locator("[data-action=\"add\"]").count(), 0, "no add tile at the limit");
  assert.match(await text(page.locator("[data-card=\"profiles\"]")), /limit of 4 profiles/);
  await shot(page, "profiles-four", { fullPage: true });
  // deleting the only... delete all of them one by one: the app always keeps one
  for (let i = 0; i < 4; i += 1) {
    const current = await profiles(page);
    const target = current[current.length - 1];
    await page.locator(`[data-action="delete"][data-id="${target.id}"]`).click();
    await page.waitForSelector(".modal");
    await page.locator(".modal input[type=\"text\"]").fill(target.name);
    await page.locator(".modal .btn-danger").click();
    await page.waitForSelector(".modal", { state: "detached" });
    assert.ok((await profiles(page)).length >= 1, "there is always a profile");
  }
  step("the four-profile limit, and the last profile is replaced by a fresh one");
  checkProblems("profiles", ctx.problems);
  await ctx.context.close();
}

// ---------- scenario: data ----------

async function dataFlow(browser) {
  const ctx = await openAccount(browser, DESKTOP, { lang: "en", tag: "data" });
  const { page } = ctx;
  await seedRounds(page, 0, 5);
  await page.evaluate(() => Ludus.Profile.rename(Ludus.Profile.active().id, "Ana María"));
  await page.evaluate(() => Ludus.router.show("account"));
  await page.waitForSelector("[data-action=\"export-active\"]");

  // export: a real download with a dated name
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-action=\"export-active\"]").click()]);
  assert.match(download.suggestedFilename(), /^ludus-scaccorum-ana-maria-\d{4}-\d{2}-\d{2}\.json$/);
  const file = path.join(os.tmpdir(), `ludus-e2e-${process.pid}-${Date.now()}.json`);
  await download.saveAs(file);
  const exported = fs.readFileSync(file, "utf8");
  const doc = JSON.parse(exported);
  assert.strictEqual(doc.kind, "ludus-progress");
  assert.strictEqual(doc.profiles.length, 1);
  assert.strictEqual(doc.profiles[0].data.rounds.length, 5);
  await page.locator(".toast").filter({ hasText: "Downloaded ludus-scaccorum-ana-maria-" }).waitFor();
  step(`export: ${download.suggestedFilename()} (${exported.length} bytes)`);

  // wipe (delete all with the typed word), then import the file
  const dropped = await page.locator("[data-storage=\"ok\"]").innerText();
  assert.match(dropped, /You use .* of about 5\.0 MB/);
  await page.locator("[data-action=\"delete-all\"]").click();
  await page.waitForSelector(".modal");
  const confirm = page.locator(".modal .btn-danger");
  assert.ok(await confirm.isDisabled());
  await page.locator(".modal input[type=\"text\"]").fill("DELETE");
  await confirm.click();
  await page.waitForSelector(".modal", { state: "detached" });
  assert.strictEqual(await positions(page), 0);
  assert.strictEqual((await profiles(page))[0].name, "Player");
  assert.ok(await page.locator("[data-action=\"delete-all\"]").evaluate((el) => document.activeElement === el), "focus returns to the delete button");
  step("delete all needs the typed word and leaves a fresh profile");

  await page.locator("input[type=\"file\"]").setInputFiles(file);
  await page.locator(".account-import-review").waitFor();
  const review = await text(page.locator(".account-import-review"));
  assert.match(review, /1 profile/);
  assert.match(review, /5 positions/);
  assert.strictEqual(await positions(page), 0, "a dry run wrote nothing");
  assert.ok(await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute("data-import-review")), "focus moves to the review");
  await shot(page, "data-import-review");
  await page.locator("[data-action=\"import-run\"]").click();
  await page.locator("[data-msg=\"data\"] .account-msg").waitFor();
  assert.match(await text(page.locator("[data-msg=\"data\"]")), /Done: 1 profile and 5 positions loaded\./);
  const restored = await profiles(page);
  assert.ok(restored.some((entry) => entry.name === "Ana María"), "the profile of the file is back");
  const anaId = restored.find((entry) => entry.name === "Ana María").id;
  assert.strictEqual(await positions(page, anaId), 5);
  step("import: dry run, merge, everything is back (export -> delete -> import round trip)");

  // replace: newer local progress is overwritten by the file for the matching profile
  await page.evaluate((id) => Ludus.Profile.setActive(id), anaId);
  await seedRounds(page, 100, 2);
  assert.strictEqual(await positions(page, anaId), 7);
  await page.locator("input[type=\"file\"]").setInputFiles(file);
  await page.locator(".account-import-review").waitFor();
  await page.locator(".account-mode").nth(1).click();
  await page.locator("[data-action=\"import-run\"]").click();
  await page.locator("[data-msg=\"data\"] .account-msg.is-ok").waitFor();
  assert.strictEqual(await positions(page, anaId), 5, "replace: the file wins");
  step("import: replace overwrites the matching profile");

  // errors, in words
  const bad = async (name, content, pattern) => {
    await page.locator("input[type=\"file\"]").setInputFiles({ name, mimeType: "application/json", buffer: Buffer.from(content) });
    const msg = page.locator("[data-msg=\"data\"] .account-msg.is-error");
    await msg.waitFor();
    assert.match(await text(msg), pattern, name);
    assert.strictEqual(await msg.getAttribute("role"), "alert");
    assert.strictEqual(await page.locator(".account-import-review").count(), 0);
  };
  await bad("broken.json", "{ nope", /not valid JSON/);
  await bad("foreign.json", JSON.stringify({ hello: "world" }), /does not look like a Ludus Scaccorum backup/);
  await bad("newer.json", JSON.stringify({ kind: "ludus-progress", v: 999, profiles: [] }), /newer version|does not look like|contains no profiles/);
  await bad("huge.json", `{"pad":"${"x".repeat(5 * 1024 * 1024 + 10)}"}`, /too large/);
  step("bad files: broken JSON, a foreign JSON, a newer version and an oversized file are explained");

  // drag and drop of a file onto the area
  await page.evaluate(async (content) => {
    const zone = document.querySelector(".account-drop");
    const transfer = new DataTransfer();
    transfer.items.add(new File([content], "dropped.json", { type: "application/json" }));
    ["dragenter", "dragover", "drop"].forEach((type) => zone.dispatchEvent(new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true })));
  }, exported);
  await page.locator(".account-import-review").waitFor();
  assert.match(await text(page.locator(".account-import-review")), /dropped\.json/);
  await page.locator("[data-action=\"import-cancel\"]").click();
  assert.ok(await page.locator(".account-drop").isVisible());
  step("drag and drop reaches the same review; cancel goes back");
  fs.unlinkSync(file);
  checkProblems("data", ctx.problems);
  await ctx.context.close();
}

// ---------- scenario: nogoogle ----------

async function nogoogleFlow(browser) {
  const ctx = await openAccount(browser, DESKTOP, { lang: "en", tag: "nogoogle" });
  const { page } = ctx;
  const requests = [];
  page.on("request", (request) => { if (/google/.test(request.url())) requests.push(request.url()); });
  const off = page.locator("[data-card=\"sync-off\"]");
  assert.ok(await off.isVisible());
  assert.match(await text(off), /Cross-device sync with Google is not enabled on this site yet\. Meanwhile, exporting and importing a file moves your progress/);
  assert.match(await text(off), /docs\/GOOGLE_SIGNIN\.md/);
  assert.strictEqual(await off.locator("button").count(), 0, "no dead button");
  assert.strictEqual(await page.locator("[data-action=\"signin\"]").count(), 0);
  const link = off.locator("a");
  assert.strictEqual(await link.getAttribute("href"), "https://github.com/jpripamonti/ludus_scaccorum/blob/main/docs/GOOGLE_SIGNIN.md");
  assert.strictEqual(await link.getAttribute("target"), "_blank");
  assert.match(await link.getAttribute("rel"), /noopener/);
  await page.hover("[data-card=\"sync-off\"]");
  assert.deepStrictEqual(requests, [], "nothing at all was requested from Google");
  await shot(page, "nogoogle", { fullPage: true });
  checkProblems("nogoogle", ctx.problems);
  await ctx.context.close();
}

// ---------- scenario: google ----------

async function googleFlow(browser) {
  const google = createGoogle();
  const ctx = await openAccount(browser, DESKTOP, googleContext(google, { lang: "en", tag: "google-a" }));
  const { page } = ctx;
  await page.locator("[data-card=\"sync\"]").waitFor();
  assert.strictEqual(await page.locator("[data-card=\"sync-off\"]").count(), 0);
  assert.strictEqual(google.gsiLoads, 0, "the Google script is not loaded before anybody asks");
  assert.deepStrictEqual(google.requests, []);
  assert.match(await text(syncCard(page)), /Sign in with Google/);
  assert.match(await text(syncCard(page)), /What is stored, and where/);
  await shot(page, "google-signed-out");

  // hovering the button pre-loads the script; nothing is requested from Drive yet
  await seedRounds(page, 0, 3);
  await page.locator("[data-action=\"signin\"]").hover();
  await page.waitForFunction(() => Boolean(window.google && window.google.accounts));
  assert.strictEqual(google.gsiLoads, 1);
  assert.deepStrictEqual(google.requests, []);
  await page.locator("[data-action=\"signin\"]").click();
  await waitStatus(page, "signed_in");
  const card = syncCard(page);
  // the name is text: no element came out of it
  assert.ok((await text(card.locator(".account-user-name"))).includes("<b>Pérez</b>"), "the name is shown literally");
  assert.strictEqual(await card.locator("b").count(), 0);
  assert.match(await text(card), /ana@example\.com/);
  assert.strictEqual(await card.locator("img.account-photo").getAttribute("src"), PICTURE);
  assert.strictEqual(await card.locator("img.account-photo").getAttribute("alt"), "");
  // the first sync created the file in appDataFolder
  await page.waitForFunction(() => /Last sync: (just now|\d+ min ago)/.test(document.querySelector("[data-card=\"sync\"]").innerText));
  assert.strictEqual(google.files.size, 1, "the Drive file was created");
  assert.strictEqual(google.file().name, FILE_NAME);
  assert.deepStrictEqual(google.file().parents, ["appDataFolder"]);
  const cloud = google.doc();
  assert.strictEqual(cloud.kind, "ludus-progress");
  assert.strictEqual(cloud.profiles[0].googleSub, "1001");
  assert.strictEqual(cloud.profiles[0].data.rounds.length, 3);
  assert.strictEqual((await gis(page)).calls[0].scope.includes("drive.appdata"), true);
  assert.ok(await card.locator("[data-action=\"sync\"]").isVisible() && await card.locator("[data-action=\"signout\"]").isVisible() && await card.locator("[data-action=\"revoke\"]").isVisible());
  await shot(page, "google-signed-in");
  step("sign in: nothing before the click, name escaped, photo from googleusercontent, first sync created the Drive file");

  // sync now is idempotent
  await card.locator("[data-action=\"sync\"]").click();
  await waitStatus(page, "signed_in");
  assert.strictEqual(google.files.size, 1);
  step("sync now keeps one file");

  // a second device: its own progress, the same Google account
  const ctxB = await openAccount(browser, DESKTOP, googleContext(google, { lang: "en", tag: "google-b" }));
  const B = ctxB.page;
  await seedRounds(B, 500, 2);
  assert.strictEqual(await positions(B), 2);
  await B.locator("[data-action=\"signin\"]").click();
  await waitStatus(B, "signed_in");
  await B.waitForFunction(() => Ludus.Profile.stats().totalPositions === 5, null, { timeout: 15000 });
  assert.strictEqual(await positions(B), 5, "device B now has its own 2 and the 3 of device A");
  assert.strictEqual((await profiles(B)).length, 1, "one shared profile, not two");
  assert.strictEqual(google.files.size, 1, "still one Drive file");
  assert.strictEqual(google.doc().profiles[0].data.rounds.length, 5, "and it holds both");
  await card.locator("[data-action=\"sync\"]").click();
  await waitStatus(page, "signed_in");
  await page.waitForFunction(() => Ludus.Profile.stats().totalPositions === 5, null, { timeout: 15000 });
  assert.strictEqual(await positions(page), 5, "device A got B's positions on its next sync");
  step("a second device merges: both converge on the 5 positions through one Drive file");
  await ctxB.context.close();

  // errors: the server, then recovery
  google.fail = { status: 500, times: 3 };
  await card.locator("[data-action=\"sync\"]").click();
  await waitStatus(page, "error");
  const failure = card.locator(".field-error");
  assert.strictEqual(await failure.getAttribute("role"), "alert");
  assert.match(await text(failure), /Google had a temporary problem/);
  assert.match(await text(card.locator("[data-action=\"sync\"]")), /Try again/);
  assert.match(await text(card.locator(".account-status-badge")), /Sync error/);
  await shot(page, "google-error");
  google.fail = null;
  await card.locator("[data-action=\"sync\"]").click();
  await waitStatus(page, "signed_in");
  assert.strictEqual(await card.locator(".field-error").count(), 0);
  step("a server error is explained in words and Try again recovers");

  // an expired session asks to reconnect (silent refresh is refused)
  await setGis(page, { mode: "silent-fail", expiresIn: 30 });
  await card.locator("[data-action=\"signout\"]").click();
  await card.locator("[data-action=\"signin\"]").waitFor();
  // A token that lives 30 s is already "stale" (the app refreshes a minute early): the first sync asks Google for a
  // silent refresh, Google refuses, and the person is asked to reconnect with one click.
  await page.locator("[data-action=\"signin\"]").click();
  await page.waitForSelector("[data-action=\"reconnect\"]", { timeout: 15000 });
  assert.ok(await card.locator("[data-action=\"reconnect\"]").isVisible());
  assert.strictEqual(await card.locator("[data-action=\"sync\"]").count(), 0, "reconnect replaces sync");
  assert.match(await text(card.locator(".field-error")), /Your Google connection expired\. Press “Reconnect”/);
  await shot(page, "google-reconnect");
  await setGis(page, { mode: "ok", expiresIn: 3600 });
  await card.locator("[data-action=\"reconnect\"]").click();
  await waitStatus(page, "signed_in");
  assert.strictEqual(await card.locator("[data-action=\"reconnect\"]").count(), 0);
  step("an expired connection shows Reconnect and one click restores it");

  // a reload remembers the account but never reconnects by itself
  const callsBefore = (await gis(page)).calls.length;
  await page.reload();
  await page.waitForFunction(() => Ludus.router.current() === "account");
  const remembered = syncCard(page);
  await remembered.waitFor();
  assert.match(await text(remembered), /You signed in as .* on this device\. Reconnect to keep syncing\./);
  assert.ok(await remembered.locator("[data-action=\"reconnect\"]").isVisible());
  assert.strictEqual((await gis(page)).calls.length, 0, "no popup, no token request after a reload");
  assert.strictEqual(google.gsiLoads >= 1, true);
  assert.ok(callsBefore >= 1);
  await shot(page, "google-remembered");
  await remembered.locator("[data-action=\"reconnect\"]").click();
  await waitStatus(page, "signed_in");
  step("after a reload the account is remembered and Reconnect brings it back with one click");

  // sign out, then sign in again and sign out with revoke
  await remembered.locator("[data-action=\"signout\"]").click();
  await remembered.locator("[data-action=\"signin\"]").waitFor();
  assert.strictEqual(await page.evaluate(() => localStorage.getItem("ludus.auth.v1")), null, "the remembered hint is gone");
  assert.ok(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("data-action") === "signin"), "focus is on the sign-in button");
  await page.locator("[data-action=\"signin\"]").click();
  await waitStatus(page, "signed_in");
  await syncCard(page).locator("[data-action=\"revoke\"]").click();
  await syncCard(page).locator("[data-action=\"signin\"]").waitFor();
  assert.strictEqual((await gis(page)).revoked.length, 1, "the access was revoked at Google");
  assert.match((await gis(page)).revoked[0], /^tok-\d+$/);
  assert.strictEqual(google.files.size, 1, "signing out never touches the Drive file");
  step("sign out clears the hint; sign out and revoke asks Google to revoke");
  checkProblems("google-a", ctx.problems);
  await ctx.context.close();
}

async function googleErrorsFlow(browser) {
  // sign-in failures: popup closed, blocked, Drive not granted, denied; each is a message, none is a dead end
  const google = createGoogle();
  const ctx = await openAccount(browser, DESKTOP, googleContext(google, { lang: "en", tag: "google-errors" }));
  const { page } = ctx;
  const attempt = async (mode) => {
    await setGis(page, { mode });
    await page.locator("[data-action=\"signin\"]").click();
    await page.waitForFunction(() => {
      const el = document.querySelector("[data-card=\"sync\"] .account-sync-status");
      return el && el.getAttribute("data-status") !== "signing_in";
    });
  };
  await attempt("closed");
  assert.strictEqual(await syncStatus(page), "signed_out", "closing the popup is not an error");
  assert.strictEqual(await syncCard(page).locator(".field-error").count(), 0);
  await attempt("blocked");
  assert.strictEqual(await syncStatus(page), "error");
  assert.match(await text(syncCard(page).locator(".field-error")), /blocked the Google window/);
  assert.ok(await syncCard(page).locator("[data-action=\"signin\"]").isVisible(), "the button is still there to try again");
  await attempt("no-drive");
  assert.match(await text(syncCard(page).locator(".field-error")), /permission to store your progress in your Drive/);
  await attempt("denied");
  assert.strictEqual(await syncStatus(page), "signed_out");
  await shot(page, "google-errors");
  google.fail = { status: 403, times: 50, reason: "forbidden" };
  await attempt("ok");
  await waitStatus(page, "error");
  assert.match(await text(syncCard(page).locator(".field-error")), /denied access to Drive/);
  google.fail = null;
  step("popup closed / blocked, Drive not granted, denied and Drive forbidden are all explained and recoverable");
  checkProblems("google-errors", ctx.problems);
  await ctx.context.close();
}

// ---------- scenario: install ----------

async function installFlow(browser) {
  const ctx = await openAccount(browser, DESKTOP, { lang: "en", tag: "install" });
  const { page } = ctx;
  const card = page.locator("[data-card=\"install\"]");
  assert.match(await text(card), /Your browser can install it from its menu/);
  assert.strictEqual(await card.locator("button").count(), 0, "no dead button");
  // the browser fires the event whenever it likes: while the screen is open...
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; return Promise.resolve(); };
    event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
    window.dispatchEvent(event);
    window.__installEvent = event;
  });
  const button = card.locator("[data-action=\"install\"]");
  await button.waitFor();
  assert.ok(await page.evaluate(() => window.__installEvent.defaultPrevented), "the mini-infobar is held back");
  await shot(page, "install-button");
  await button.click();
  await page.waitForFunction(() => window.__prompted === 1);
  await card.locator(".account-msg").waitFor();
  assert.match(await text(card), /Done, it is being installed\./);
  assert.strictEqual(await card.locator("[data-action=\"install\"]").count(), 0, "a captured event is used once");
  step("the button appears when the browser offers the prompt and uses it once");

  // ...or before the screen was ever shown
  const early = await openAccount(browser, DESKTOP, { lang: "es", tag: "install-early", hash: "#/home", screen: "home" });
  await early.page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = () => { window.__prompted = 1; return Promise.resolve(); };
    event.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(event);
  });
  await early.page.evaluate(() => Ludus.router.show("account"));
  const installEarly = early.page.locator("[data-card=\"install\"] [data-action=\"install\"]");
  await installEarly.waitFor();
  await installEarly.click();
  await early.page.locator("[data-card=\"install\"] .account-msg").waitFor();
  assert.match(await text(early.page.locator("[data-card=\"install\"]")), /Sin problema/);
  step("an event that fired before the screen existed is not lost; dismissing is answered kindly");
  checkProblems("install-early", early.problems);
  await early.context.close();

  // iOS: the Share hint, no button
  const ios = await openAccount(browser, PHONE, { lang: "en", tag: "install-ios", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1" });
  const iosCard = ios.page.locator("[data-card=\"install\"]");
  assert.match(await text(iosCard), /tap the Share button and choose “Add to Home Screen”/);
  assert.strictEqual(await iosCard.locator("button").count(), 0);
  await shot(ios.page, "install-ios");
  checkProblems("install-ios", ios.problems);
  await ios.context.close();
  checkProblems("install", ctx.problems);
  await ctx.context.close();
}

// ---------- scenario: about ----------

async function aboutFlow(browser) {
  const ctx = await openAccount(browser, DESKTOP, { lang: "en", tag: "about" });
  const { page } = ctx;
  const about = page.locator("[data-card=\"about\"]");
  assert.strictEqual(await text(about.locator("[data-about=\"licence\"]")), "GPL-3.0-or-later");
  const version = await text(about.locator("[data-about=\"version\"]"));
  assert.strictEqual(version, await page.evaluate(() => Ludus.version === "dev" ? "development" : String(Ludus.version)));
  assert.match(await text(about), /Stockfish 18/);
  assert.match(await text(about), /Colin M\. L\. Burnett/);
  const links = about.locator("a");
  assert.strictEqual(await links.count(), 3);
  for (let i = 0; i < 3; i += 1) {
    const link = links.nth(i);
    assert.match(await link.getAttribute("href"), /^https:\/\/github\.com\/jpripamonti\/ludus_scaccorum/);
    assert.strictEqual(await link.getAttribute("target"), "_blank");
    assert.match(await link.getAttribute("rel"), /noopener.*noreferrer|noreferrer.*noopener/);
  }
  assert.strictEqual(await about.locator(".account-privacy li").count(), 4);
  const keys = await about.locator("kbd").allInnerTexts();
  ["H", "N", "E", "B", "M", "Enter", "Esc", "Tab"].forEach((key) => assert.ok(keys.includes(key), `key ${key}`));
  // the keys are what the game really listens to: H asks for a hint on the play screen
  await page.evaluate(async () => {
    await Ludus.Classics.load();
    const game = Ludus.Classics.list()[0];
    await Ludus.game.startSession({ kind: "classic", title: game.title.en, mode: "solo", positions: Ludus.Classics.positions(game.id, { count: 2 }) });
  });
  await page.waitForFunction(() => document.body.classList.contains("playing-mode"));
  await page.keyboard.press("h");
  await page.waitForFunction(() => Boolean(document.querySelector("#board .hint-from, #board .square.hint-from")), null, { timeout: 8000 });
  await page.evaluate(() => Ludus.game.abort());
  step("version, licence, links that open safely, privacy notes and the shortcut sheet (H really asks for a hint)");
  await shot(page, "about", { fullPage: true });
  checkProblems("about", ctx.problems);
  await ctx.context.close();
}

// ---------- scenario: keyboard ----------

async function keyboardFlow(browser) {
  const google = createGoogle();
  const ctx = await openAccount(browser, DESKTOP, googleContext(google, { lang: "en", tag: "keyboard" }));
  const { page } = ctx;
  await seedRounds(page, 0, 3);
  await page.evaluate(() => { Ludus.Profile.create({ name: "Bruno" }); Ludus.router.show("account"); });
  await page.locator("[data-action=\"signin\"]").click();
  await waitStatus(page, "signed_in");
  const stops = await common.focusProbe(page, 70, "#screen-account");
  const inside = stops.filter((stop) => !stop.outside);
  assert.ok(inside.length > 15, `many tab stops inside the screen (${inside.length})`);
  const noRing = inside.filter((stop) => !stop.visibleRing || !stop.focusVisible);
  assert.deepStrictEqual(noRing.map((stop) => stop.name), [], "every tab stop shows a focus ring");
  step(`${inside.length} tab stops, every one with a visible ring`);

  // the create dialog from the keyboard: focus goes in, stays in, comes back
  const add = page.locator("[data-action=\"add\"]");
  await add.focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector(".modal");
  assert.ok(await page.evaluate(() => document.activeElement && document.activeElement.matches(".modal input[type=\"text\"]")), "the name field has focus");
  for (let i = 0; i < 20; i += 1) {
    await page.keyboard.press("Tab");
    assert.ok(await page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest(".modal"))), `Tab ${i + 1} stays inside the dialog`);
  }
  await page.keyboard.press("Escape");
  await page.waitForSelector(".modal", { state: "detached" });
  assert.ok(await add.evaluate((el) => document.activeElement === el), "focus is back on the button that opened the dialog");
  assert.strictEqual((await profiles(page)).length, 2, "nothing was created");

  // the colour swatches are one radio group: arrows move the choice
  await add.press("Enter");
  await page.waitForSelector(".modal");
  await page.waitForFunction(() => Boolean(document.activeElement && document.activeElement.matches(".modal input[type=\"text\"]"))); // the dialog's own initial focus has landed
  const swatches = page.locator(".modal .account-swatch-input");
  await swatches.first().focus();
  const before = await swatches.evaluateAll((list) => list.findIndex((el) => el.checked));
  await page.keyboard.press("ArrowRight");
  const after = await swatches.evaluateAll((list) => list.findIndex((el) => el.checked));
  assert.notStrictEqual(before, after, `an arrow key changes the colour (${before} -> ${after})`);
  await page.keyboard.press("Escape");
  await page.waitForSelector(".modal", { state: "detached" });

  // the file input is a real, focusable control (the drop area is its face)
  await page.locator("input[type=\"file\"]").focus();
  assert.ok(await page.evaluate(() => { const face = document.activeElement.nextElementSibling; return document.activeElement.type === "file" && getComputedStyle(face).outlineStyle !== "none"; }), "the picker shows a focus ring on the drop area");
  step("dialogs and the file picker work from the keyboard");
  checkProblems("keyboard", ctx.problems);
  await ctx.context.close();
}

// ---------- scenario: layout ----------

async function signInMock(page, google) {
  await page.locator("[data-action=\"signin\"]").click();
  await waitStatus(page, "signed_in");
  await page.waitForFunction(() => { const el = document.querySelector("[data-last-sync]"); return Boolean(el) && el.getAttribute("data-last-sync") !== "0"; });
}

async function layoutFlow(browser, axeMode) {
  for (const vp of viewportsFromEnv()) {
    for (const lang of ["es", "en"]) {
      // the local states
      const ctx = await openAccount(browser, vp, { lang, tag: `${vp.name}-${lang}`, bypassCSP: axeMode });
      const { page } = ctx;
      await seedRounds(page, 0, 4);
      await page.evaluate(() => { ["Bruno Díaz", "Carla"].forEach((name) => Ludus.Profile.create({ name })); });
      await page.evaluate(() => Ludus.router.show("account"));
      await settle(page, 600);
      await inspect(ctx, "default", "#screen-account", { axe: axeMode, fullPage: true });
      // an import under review
      const file = path.join(os.tmpdir(), `ludus-e2e-layout-${process.pid}.json`);
      fs.writeFileSync(file, await page.evaluate(() => Ludus.Profile.exportJSON("all")));
      await page.locator("input[type=\"file\"]").setInputFiles(file);
      await page.locator(".account-import-review").waitFor();
      await settle(page, 200);
      await inspect(ctx, "import-review", "#screen-account", { axe: axeMode, fullPage: true });
      fs.unlinkSync(file);
      await page.locator("[data-action=\"import-cancel\"]").click();
      // a message and the largest text with high contrast
      await page.evaluate(() => { Ludus.Settings.set("a11y.contrast", "high"); Ludus.Settings.set("a11y.textScale", 1.3); });
      await settle(page, 300);
      await inspect(ctx, "high-contrast-130", "#screen-account", { axe: axeMode, fullPage: true });
      // the dialogs (their own probe: the dialog is outside the screen)
      await page.evaluate(() => Ludus.Settings.reset());
      await page.locator("[data-action=\"add\"]").click();
      await page.waitForSelector(".modal");
      await settle(page, 300);
      await inspect(ctx, "dialog-create", ".modal", { axe: axeMode });
      await page.keyboard.press("Escape");
      await page.waitForSelector(".modal", { state: "detached" });
      await page.locator("[data-action=\"delete\"]").first().click();
      await page.waitForSelector(".modal");
      await settle(page, 300);
      await inspect(ctx, "dialog-delete", ".modal", { axe: axeMode });
      await page.keyboard.press("Escape");
      await page.waitForSelector(".modal", { state: "detached" });
      checkIssues(ctx.tag, ctx.issues);
      checkProblems(ctx.tag, ctx.problems);
      await ctx.context.close();

      // the Google states, against the mock
      const google = createGoogle({ user: { name: "Ana Pérez Rodríguez de la Fuente" } });
      const gctx = await openAccount(browser, vp, googleContext(google, { lang, tag: `${vp.name}-${lang}-google`, bypassCSP: axeMode }));
      const g = gctx.page;
      await seedRounds(g, 0, 2);
      await settle(g, 500);
      await inspect(gctx, "google-signed-out", "#screen-account", { axe: axeMode });
      await signInMock(g, google);
      await inspect(gctx, "google-signed-in", "#screen-account", { axe: axeMode, fullPage: true });
      google.fail = { status: 500, times: 3 };
      await g.locator("[data-action=\"sync\"]").click();
      await waitStatus(g, "error");
      await inspect(gctx, "google-error", "#screen-account", { axe: axeMode });
      google.fail = null;
      await setGis(g, { mode: "silent-fail", expiresIn: 30 });
      await g.locator("[data-action=\"signout\"]").click();
      await g.locator("[data-action=\"signin\"]").click();
      await g.waitForSelector("[data-action=\"reconnect\"]", { timeout: 15000 });
      await inspect(gctx, "google-reconnect", "#screen-account", { axe: axeMode });
      checkIssues(gctx.tag, gctx.issues);
      checkProblems(gctx.tag, gctx.problems);
      await gctx.context.close();
    }
    step(`${vp.name} (es + en): no findings`);
  }
}

// ---------- scenario: axe ----------

async function axeFlow(browser) {
  const views = [DESKTOP, { name: "tablet-768", w: 768, h: 1024, touch: true }, PHONE, { name: "phone-360", w: 360, h: 740, touch: true }];
  for (const vp of views) {
    for (const lang of ["es", "en"]) {
      const ctx = await openAccount(browser, vp, { lang, tag: `axe-${vp.name}-${lang}`, bypassCSP: true });
      const { page } = ctx;
      await seedRounds(page, 0, 3);
      await page.evaluate(() => Ludus.router.show("account"));
      await settle(page, 500);
      await common.axeScan(ctx, "default", { scope: "#screen-account" });
      await page.locator("[data-action=\"add\"]").click();
      await page.waitForSelector(".modal");
      await common.axeScan(ctx, "create-dialog", { scope: ".modal" });
      await page.keyboard.press("Escape");
      await page.waitForSelector(".modal", { state: "detached" });
      await page.locator("[data-action=\"delete-all\"]").click();
      await page.waitForSelector(".modal");
      await common.axeScan(ctx, "delete-all-dialog", { scope: ".modal" });
      await page.keyboard.press("Escape");
      await page.waitForSelector(".modal", { state: "detached" });
      checkIssues(ctx.tag, ctx.issues);
      await ctx.context.close();
    }
    step(`${vp.name} (es + en): no serious or critical axe violation`);
  }
}

const scenarios = [
  ["profiles", profilesFlow],
  ["data", dataFlow],
  ["nogoogle", nogoogleFlow],
  ["google", googleFlow],
  ["google-errors", googleErrorsFlow],
  ["install", installFlow],
  ["about", aboutFlow],
  ["keyboard", keyboardFlow],
  ["layout", (browser) => layoutFlow(browser, Boolean(AXE_PATH))],
];
if (AXE_PATH) scenarios.push(["axe", axeFlow]);

runScenarios("account e2e", scenarios);
