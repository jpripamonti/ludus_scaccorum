// Minimal DOM/window stubs shared by the Node tests (moved out of
// scripts/chess-regression-check.js so other tests can reuse them).
//
// This is deliberately NOT a DOM implementation: it only offers what app.js
// and the Ludus modules touch while they load and while tests drive them.
// `querySelector` always answers with a fresh element and `getElementById`
// creates elements on demand, exactly like the original stubs, because app.js
// looks up ~150 ids at load time and the regression check relies on that.
//
// Usage:
//   const { createFakeDom, FakeElement } = require("./_fakedom.js");
//   const dom = createFakeDom({ languages: ["es"] });
//   dom.document, dom.window, dom.localStorage, dom.storageMap, dom.elements

"use strict";

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  toggle(name, force) {
    const enabled = force === undefined ? !this.values.has(name) : Boolean(force);
    if (enabled) this.values.add(name);
    else this.values.delete(name);
    return enabled;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeTextNode {
  constructor(text) {
    this.nodeType = 3;
    this.textContent = String(text);
    this.data = this.textContent;
    this.parentNode = null;
  }
}

class FakeElement {
  constructor(tagName = "div") {
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList();
    this.dataset = {};
    this.style = {};
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
    this.disabled = false;
  }

  appendChild(child) {
    if (child && child.parentNode && child.parentNode !== this && typeof child.parentNode.removeChild === "function") {
      child.parentNode.removeChild(child);
    }
    this.children.push(child);
    if (child && typeof child === "object") child.parentNode = this;
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) this.children.splice(index, 1);
    if (child && typeof child === "object") child.parentNode = null;
    return child;
  }

  addEventListener(type, handler) {
    if (typeof handler !== "function") return;
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    const list = this.listeners.get(type);
    if (!list) return;
    this.listeners.set(type, list.filter((entry) => entry !== handler));
  }

  // Test helper (not part of the DOM): run the handlers registered for `type`.
  dispatch(type, event = {}) {
    (this.listeners.get(type) || []).slice().forEach((handler) => handler.call(this, { type, target: this, ...event }));
  }

  focus() {}

  remove() {
    if (this.parentNode && typeof this.parentNode.removeChild === "function") this.parentNode.removeChild(this);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  querySelector() {
    return new FakeElement();
  }

  querySelectorAll() {
    return [];
  }

  insertAdjacentHTML(_position, html) {
    this.innerHTML += html;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 512, height: 512 };
  }

  get clientWidth() {
    return 512;
  }

  get clientHeight() {
    return 512;
  }
}

// localStorage stand-in backed by a Map. `map` is exposed so tests can seed
// or inspect what was written.
function createFakeLocalStorage(map = new Map()) {
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    key: (index) => Array.from(map.keys())[index] ?? null,
    clear: () => { map.clear(); },
    get length() { return map.size; },
  };
}

// A localStorage whose every operation throws, like Safari private mode or a
// browser configured to block site data.
function createThrowingLocalStorage(message = "storage blocked") {
  const fail = () => { throw new Error(message); };
  return {
    getItem: fail,
    setItem: fail,
    removeItem: fail,
    key: fail,
    clear: fail,
    get length() { return fail(); },
  };
}

function createFakeDom(options = {}) {
  const languages = options.languages || ["en"];
  const elements = new Map();
  const storageMap = options.storageMap || new Map();
  const localStorage = options.localStorage || createFakeLocalStorage(storageMap);

  function elementFor(id) {
    if (!elements.has(id)) elements.set(id, new FakeElement());
    return elements.get(id);
  }

  const document = {
    documentElement: new FakeElement("html"),
    head: new FakeElement("head"),
    body: new FakeElement("body"),
    title: "",
    readyState: "complete",
    currentScript: { src: "app.js" },
    getElementById: elementFor,
    querySelector: () => new FakeElement(),
    querySelectorAll: () => [],
    createElement: (tagName) => new FakeElement(tagName),
    createElementNS: (_ns, tagName) => new FakeElement(tagName),
    createTextNode: (text) => new FakeTextNode(text),
    addEventListener: () => {},
  };

  const navigator = { languages, language: languages[0] };

  const window = {
    document,
    navigator,
    localStorage,
    addEventListener: () => {},
    scrollTo: () => {},
    confirm: () => true,
    requestIdleCallback: () => {},
  };

  return { document, window, navigator, localStorage, storageMap, elements, elementFor };
}

module.exports = {
  FakeClassList,
  FakeElement,
  FakeTextNode,
  createFakeDom,
  createFakeLocalStorage,
  createThrowingLocalStorage,
};
