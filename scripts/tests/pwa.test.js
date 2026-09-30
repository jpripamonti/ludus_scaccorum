// Tests for the page side of the service worker (registerServiceWorker /
// watchServiceWorker in app.js, PERF-010): the offline-ready message, the "new
// version ready" prompt that never appears over a running session, the reload
// only when the person agrees, and a browser where service workers are stubbed
// out or blocked (Playwright's serviceWorkers: "block" makes register() resolve
// with nothing): the app must boot with no console error and no exception.
// The worker itself is tested in sw.test.js; real browser lifecycles in
// scripts/e2e/sw.js. Plain assert, fake DOM, no network.

"use strict";

const assert = require("assert");
const { load } = require("./_load.js");
const { createFakeDom } = require("./_fakedom.js");

let assertions = 0;
const ok = (value, message) => { assertions += 1; assert.ok(value, message); };
const eq = (actual, expected, message) => { assertions += 1; assert.strictEqual(actual, expected, message); };
const same = (actual, expected, message) => { assertions += 1; assert.deepStrictEqual(actual, expected, message); };

// Anything with addEventListener / dispatch.
function emitter(extra) {
  const listeners = {};
  return Object.assign({
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    emit(type, event) { (listeners[type] || []).slice().forEach((fn) => fn(event || {})); },
    listenerCount(type) { return (listeners[type] || []).length; },
  }, extra);
}

function worker(state) {
  const w = emitter({ state, posted: [], postMessage(message) { w.posted.push(message); } });
  w.transition = (next) => { w.state = next; w.emit("statechange"); };
  return w;
}

// Boots app.js in the fake DOM with a fake service worker container and returns
// handles to drive it. `container` undefined means "navigator.serviceWorker does not exist".
function boot(options = {}) {
  const dom = createFakeDom({ languages: [options.language || "es"] });
  const logs = { warn: [], info: [], error: [] };
  const fakeConsole = {
    log() {},
    info: (...args) => logs.info.push(args.join(" ")),
    warn: (...args) => logs.warn.push(args.join(" ")),
    error: (...args) => logs.error.push(args.join(" ")),
  };
  const windowHandlers = {};
  const documentHandlers = {};
  const reloads = { count: 0 };
  dom.window.location = { protocol: options.protocol || "https:", reload() { reloads.count += 1; } };
  dom.window.addEventListener = (type, fn) => { (windowHandlers[type] = windowHandlers[type] || []).push(fn); };
  dom.document.addEventListener = (type, fn) => { (documentHandlers[type] = documentHandlers[type] || []).push(fn); };
  dom.document.visibilityState = "visible";
  if (options.container !== undefined) dom.navigator.serviceWorker = options.container;
  const env = load({ dom, console: fakeConsole });
  const toasts = [];
  env.run(`Ludus.ui.toast = function (message, options) { globalThis.__toasts.push({ message, options }); return { dismiss() {} }; };`);
  // Reach the capture array from the context.
  env.context.__toasts = toasts;
  const fire = async () => {
    (windowHandlers.load || []).forEach((fn) => fn({}));
    for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setImmediate(resolve));
  };
  return { env, dom, logs, toasts, fire, reloads, documentHandlers, windowHandlers };
}

function fakeContainer(options = {}) {
  const container = emitter({ controller: options.controller || null, registered: [] });
  const registration = emitter({
    installing: options.installing || null,
    waiting: options.waiting || null,
    active: options.active || null,
    updates: 0,
    update() { registration.updates += 1; return Promise.resolve(); },
  });
  container.registration = registration;
  container.register = (url) => {
    container.registered.push(url);
    if (options.register) return options.register(registration, container);
    return Promise.resolve(registration);
  };
  return container;
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("no service worker support, or a stubbed one: the app boots with no error and nothing to watch", async () => {
  // navigator.serviceWorker missing.
  const a = boot({});
  await a.fire();
  same(a.logs.error, []);
  eq(a.toasts.length, 0);

  // Playwright serviceWorkers: "block": register() resolves with undefined.
  for (const [label, register, quiet] of [
    ["resolves undefined", () => Promise.resolve(undefined), true],
    ["resolves null", () => Promise.resolve(null), true],
    ["resolves a non-registration", () => Promise.resolve({}), true],
    ["returns undefined (not even a promise)", () => undefined, true],
    ["rejects", () => Promise.reject(new Error("SecurityError")), false],
    ["throws", () => { throw new Error("blocked"); }, false],
  ]) {
    const container = fakeContainer({ register });
    const b = boot({ container });
    await b.fire();
    eq(container.registered.length, 1, `${label}: it still tried to register`);
    same(b.logs.error, [], `${label}: no console error`);
    eq(b.toasts.length, 0, `${label}: no prompt`);
    // A stub that resolves with nothing is not a failure worth a warning: there is simply nothing to watch.
    if (quiet) same(b.logs.warn, [], `${label}: not even a warning`);
    else ok(b.logs.warn.some((line) => /could not be registered/.test(line)), `${label}: one warning, the app keeps working`);
  }
  // A container that is not an event target at all.
  const odd = boot({ container: { register: () => Promise.resolve(fakeContainer().registration) } });
  await odd.fire();
  same(odd.logs.error, []);

  // file: pages never register.
  const file = boot({ container: fakeContainer(), protocol: "file:" });
  await file.fire();
  eq(file.env.context.navigator.serviceWorker.registered.length, 0, "no registration from file:");
});

test("first install: ready offline, said once, in the page's language", async () => {
  const installing = worker("installing");
  const container = fakeContainer({ installing });
  const a = boot({ container });
  await a.fire();
  eq(container.registered[0], "sw.js");
  eq(a.toasts.length, 0, "nothing while it installs");
  installing.transition("installed");
  eq(a.toasts.length, 0, "an installed worker on a first visit is not an update");
  installing.transition("activated");
  eq(a.toasts.length, 1);
  ok(/sin conexión/.test(a.toasts[0].message), a.toasts[0].message);
  eq(a.toasts[0].options.kind, "success");
  ok(a.toasts[0].options.duration > 0, "it goes away by itself");
  eq(a.dom.localStorage.getItem("ludus.pwa.offline.v1"), "1", "and remembers it said so");

  // The same device, a later first-ever install of another browser profile state: already said.
  const again = boot({ container: fakeContainer({ installing: worker("installing") }), language: "en" });
  again.dom.localStorage.setItem("ludus.pwa.offline.v1", "1");
  await again.fire();
  again.env.context.navigator.serviceWorker.registration.installing.transition("activated");
  eq(again.toasts.length, 0, "never twice");

  // English.
  const en = boot({ container: fakeContainer({ installing: worker("installing") }), language: "en" });
  await en.fire();
  en.env.context.navigator.serviceWorker.registration.installing.transition("activated");
  ok(/Ready to use offline/.test(en.toasts[0].message), en.toasts[0].message);
});

test("a build waiting at load time: the prompt, and the swap only after the person agrees", async () => {
  const waiting = worker("installed");
  const container = fakeContainer({ controller: worker("activated"), waiting });
  const a = boot({ container });
  await a.fire();
  eq(a.toasts.length, 1);
  ok(/versión nueva/.test(a.toasts[0].message), a.toasts[0].message);
  eq(a.toasts[0].options.duration, 0, "it stays until the person decides");
  eq(a.toasts[0].options.action.label, "Recargar");
  eq(waiting.posted.length, 0, "nothing is swapped yet");
  eq(a.reloads.count, 0);
  a.toasts[0].options.action.onClick();
  eq(JSON.stringify(waiting.posted), '[{"type":"SKIP_WAITING"}]', "the waiting worker is asked to take over");
  eq(a.reloads.count, 0, "and the page reloads only when it has");
  container.emit("controllerchange");
  eq(a.reloads.count, 1, "reload once the new worker controls the page");

  // English.
  const en = boot({ container: fakeContainer({ controller: worker("activated"), waiting: worker("installed") }), language: "en" });
  await en.fire();
  ok(/new version of Ludus Scaccorum is ready/.test(en.toasts[0].message));
  eq(en.toasts[0].options.action.label, "Reload");
});

test("an update found while the page is open: prompted once it is installed, not before", async () => {
  const container = fakeContainer({ controller: worker("activated") });
  const a = boot({ container });
  await a.fire();
  const incoming = worker("installing");
  container.registration.installing = incoming;
  container.registration.emit("updatefound");
  eq(a.toasts.length, 0, "while it installs");
  incoming.transition("installed");
  eq(a.toasts.length, 1);
  ok(/versión nueva/.test(a.toasts[0].message));
  // A second update before the person reacts does not stack prompts.
  const next = worker("installing");
  container.registration.installing = next;
  container.registration.emit("updatefound");
  next.transition("installed");
  eq(a.toasts.length, 1, "one prompt is enough");
  // A failed update install is not shown to the person; it is logged and retried later.
  const failing = boot({ container: fakeContainer({ controller: worker("activated") }) });
  await failing.fire();
  const dead = worker("installing");
  failing.env.context.navigator.serviceWorker.registration.installing = dead;
  failing.env.context.navigator.serviceWorker.registration.emit("updatefound");
  dead.transition("redundant");
  eq(failing.toasts.length, 0);
  same(failing.logs.error, []);
  ok(failing.logs.info.some((line) => /could not be installed yet/.test(line)), "logged at info level");
});

test("never over a running session: the prompt waits for the session to end", async () => {
  const container = fakeContainer({ controller: worker("activated"), waiting: worker("installed") });
  const a = boot({ container });
  a.env.run("Ludus.game = { isActive: () => globalThis.__busy };");
  a.env.context.__busy = true;
  await a.fire();
  eq(a.toasts.length, 0, "a session is running: nothing is shown");
  a.env.context.__busy = false;
  a.env.run('Ludus.bus.emit("screen:changed", { id: "home" });');
  eq(a.toasts.length, 1, "it appears as soon as the session is over");
  a.env.run('Ludus.bus.emit("screen:changed", { id: "classics" });');
  eq(a.toasts.length, 1, "and only once");

  // A screen change during the session changes nothing.
  const b = boot({ container: fakeContainer({ controller: worker("activated"), waiting: worker("installed") }) });
  b.env.run("Ludus.game = { isActive: () => true };");
  await b.fire();
  b.env.run('Ludus.bus.emit("screen:changed", { id: "game" });');
  b.env.run('Ludus.bus.emit("session:completed", { session: {} });');
  eq(b.toasts.length, 0, "still running: still nothing");
});

test("another tab took the new worker: this page is offered a plain reload and is never reloaded by itself", async () => {
  const container = fakeContainer({ controller: worker("activated") });
  const a = boot({ container });
  await a.fire();
  container.emit("controllerchange"); // nobody asked from this tab
  eq(a.reloads.count, 0, "no surprise reload under the person's feet");
  eq(a.toasts.length, 1);
  a.toasts[0].options.action.onClick(); // no waiting worker any more
  eq(a.reloads.count, 1, "the person accepts: only the reload is needed");

  // The very first install claiming the page is not an update.
  const first = boot({ container: fakeContainer({ installing: worker("installing") }) });
  await first.fire();
  first.env.context.navigator.serviceWorker.emit("controllerchange");
  eq(first.reloads.count, 0);
  eq(first.toasts.length, 0);
});

test("a page opened on the very first visit still gets the whole update flow later (it is controlled from the claim on)", async () => {
  const installing = worker("installing");
  const container = fakeContainer({ installing });
  const a = boot({ container });
  await a.fire();
  // First install: activated, then it claims this page.
  installing.transition("activated");
  container.controller = installing;
  container.emit("controllerchange");
  eq(a.reloads.count, 0, "the claim is not an update");
  eq(a.toasts.length, 1, "only the ready-offline message so far");
  // Days later the page is still open and a newer build has been installed.
  const waiting = worker("installed");
  container.registration.installing = waiting;
  container.registration.waiting = waiting;
  container.registration.emit("updatefound");
  ok(a.toasts.length === 2 && /versión nueva/.test(a.toasts[1].message), "the update is offered");
  a.toasts[1].options.action.onClick();
  eq(JSON.stringify(waiting.posted), '[{"type":"SKIP_WAITING"}]');
  container.emit("controllerchange");
  eq(a.reloads.count, 1, "and the reload happens when the new worker has taken over (not ignored as a first claim)");
});

test("a first install that fails is logged as a warning (offline mode is off), and nothing else happens", async () => {
  const installing = worker("installing");
  const a = boot({ container: fakeContainer({ installing }) });
  await a.fire();
  installing.transition("redundant");
  ok(a.logs.warn.some((line) => /could not install/.test(line)), "a warning");
  same(a.logs.error, []);
  eq(a.toasts.length, 0);
});

test("what the worker could not do comes back as a message and is logged", async () => {
  const container = fakeContainer({ controller: worker("activated") });
  const a = boot({ container });
  await a.fire();
  container.emit("message", { data: { type: "ludus-sw", event: "cache-put-failed", detail: "quota" } });
  ok(a.logs.warn.some((line) => /service worker: cache-put-failed quota/.test(line)), a.logs.warn.join("|"));
  container.emit("message", { data: { type: "something-else" } });
  container.emit("message", { data: null });
  container.emit("message", {});
  eq(a.logs.warn.length, 1, "only the worker's own messages are logged");
  same(a.logs.error, []);
});

test("a long-lived window looks for a new build when it comes back, at most every half hour", async () => {
  const container = fakeContainer({ controller: worker("activated") });
  const a = boot({ container });
  await a.fire();
  const visible = a.documentHandlers.visibilitychange;
  ok(visible && visible.length >= 1, "it listens for the window coming back");
  const fire = () => visible.forEach((fn) => fn());
  fire();
  eq(container.registration.updates, 0, "just after load: nothing to check yet");
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 31 * 60 * 1000;
    // The page code runs in the vm context, which has its own Date; emulate through the clock it sees.
    a.env.run(`Date.now = () => ${realNow() + 31 * 60 * 1000};`);
    fire();
    eq(container.registration.updates, 1, "after half an hour it checks");
    fire();
    eq(container.registration.updates, 1, "and not again at once");
  } finally {
    Date.now = realNow;
  }
});

// ---------- Runner ----------

(async () => {
  let done = 0;
  for (const entry of tests) {
    try {
      await entry.fn();
      done += 1;
    } catch (error) {
      console.error(`\nFAILED: ${entry.name}`);
      console.error(error && error.stack ? error.stack : error);
      process.exit(1);
    }
  }
  console.log(`pwa.test.js: ${done} tests, ${assertions} assertions passed`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
