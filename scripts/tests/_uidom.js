// A small but real-enough fake DOM for the UI tests (kit.test.js, ui-screens.test.js):
// an element tree with attributes, classList, dataset, events that bubble, focus,
// a selector engine for what the UI code queries (tag, .class, #id, [attr],
// [attr="v"], :not([attr]), comma lists and descendant chains), and a value /
// checked model for form controls. It is deliberately not a browser: no layout,
// no CSS, no HTML parsing (setting innerHTML throws, which is how the tests prove
// the UI never builds markup from strings).
//
//   const { FakeDocument, findAll, byClass } = require("./_uidom.js");
//   const doc = new FakeDocument();

"use strict";

class FakeText {
  constructor(data) {
    this.nodeType = 3;
    this.data = String(data);
    this.parentNode = null;
    this.children = [];
  }

  get textContent() {
    return this.data;
  }
}

// One compound selector ("button.btn[aria-busy]:not([disabled])") -> rules.
function parseCompound(part) {
  const rules = { tag: null, id: null, classes: [], attrs: [], notAttrs: [] };
  let rest = part.trim();
  const tag = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(rest);
  if (tag) {
    rules.tag = tag[0].toLowerCase();
    rest = rest.slice(tag[0].length);
  }
  const token = /^(:not\((\[[^\]]+\])\)|\.([A-Za-z0-9_-]+)|#([A-Za-z0-9_-]+)|\[([^\]=]+)(?:="([^"]*)")?\])/;
  while (rest) {
    const m = token.exec(rest);
    if (!m) throw new Error(`fake selector engine cannot parse "${part}"`);
    if (m[2]) {
      const inner = /^\[([^\]=]+)(?:="([^"]*)")?\]$/.exec(m[2]);
      rules.notAttrs.push([inner[1], inner[2]]);
    } else if (m[3]) {
      rules.classes.push(m[3]);
    } else if (m[4]) {
      rules.id = m[4];
    } else {
      rules.attrs.push([m[5], m[6]]);
    }
    rest = rest.slice(m[0].length);
  }
  return rules;
}

// "a, b c" -> [[rulesA], [rulesB, rulesC]] (descendant combinator only).
function parseSelector(selector) {
  const groups = [];
  let depth = 0;
  let current = "";
  const flush = () => {
    if (current.trim()) groups.push(current.trim());
    current = "";
  };
  for (const ch of selector) {
    if (ch === "[" || ch === "(") depth += 1;
    if (ch === "]" || ch === ")") depth -= 1;
    if (ch === "," && depth === 0) flush();
    else current += ch;
  }
  flush();
  return groups.map((group) => {
    const chain = [];
    let buf = "";
    let d = 0;
    for (const ch of group) {
      if (ch === "[" || ch === "(") d += 1;
      if (ch === "]" || ch === ")") d -= 1;
      if (/\s/.test(ch) && d === 0) {
        if (buf) chain.push(buf);
        buf = "";
      } else {
        buf += ch;
      }
    }
    if (buf) chain.push(buf);
    return chain.map(parseCompound);
  });
}

class FakeElement {
  constructor(doc, tagName, namespaceURI) {
    this.ownerDocument = doc;
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.namespaceURI = namespaceURI || null;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this._classes = new Set();
    this._text = "";
    this._value = undefined;
    this.hidden = false;
    this.disabled = false;
    this.style = { props: {}, setProperty(name, value) { this.props[name] = String(value); } };
    const self = this;
    this.classList = {
      add(...names) { names.forEach((name) => self._classes.add(name)); },
      remove(...names) { names.forEach((name) => self._classes.delete(name)); },
      toggle(name, force) {
        const on = force === undefined ? !self._classes.has(name) : Boolean(force);
        if (on) self._classes.add(name);
        else self._classes.delete(name);
        return on;
      },
      contains(name) { return self._classes.has(name); },
    };
  }

  get textContent() {
    return this._text + this.children.map((child) => child.textContent).join("");
  }

  set textContent(value) {
    this.children.forEach((child) => { child.parentNode = null; });
    this.children = [];
    this._text = String(value);
  }

  // The UI must build nodes, never parse markup.
  set innerHTML(_value) { throw new Error("innerHTML must not be used"); }

  get innerHTML() { return ""; }

  get className() { return Array.from(this._classes).join(" "); }

  get firstChild() { return this.children[0] || null; }

  get isConnected() {
    let node = this;
    while (node.parentNode) node = node.parentNode;
    return node === this.ownerDocument.documentElement;
  }

  // Form controls: the property wins over the attribute once it has been set.
  get value() {
    if (this._value !== undefined) return this._value;
    return this.attributes.has("value") ? this.attributes.get("value") : "";
  }

  set value(next) { this._value = String(next); }

  setAttribute(name, value) {
    if (name === "class") this._classes = new Set(String(value).split(/\s+/).filter(Boolean));
    else this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    if (name === "class") return this._classes.size ? this.className : null;
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    if (name === "class") return this._classes.size > 0;
    if (name === "hidden") return this.hidden || this.attributes.has("hidden");
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    if (name === "class") this._classes = new Set();
    else this.attributes.delete(name);
    if (name === "hidden") this.hidden = false;
  }

  appendChild(child) {
    if (child.parentNode && child.parentNode !== this) child.parentNode.removeChild(child);
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  insertBefore(child, ref) {
    if (child.parentNode) child.parentNode.removeChild(child);
    const index = ref ? this.children.indexOf(ref) : -1;
    if (index === -1) this.children.push(child);
    else this.children.splice(index, 0, child);
    child.parentNode = this;
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  contains(node) {
    if (node === this) return true;
    return this.children.some((child) => typeof child.contains === "function" && child.contains(node));
  }

  addEventListener(type, handler) {
    if (typeof handler !== "function") return;
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    const list = this.listeners.get(type);
    if (list) this.listeners.set(type, list.filter((entry) => entry !== handler));
  }

  // Test helper: run the handlers for `type` on this node and its ancestors (bubbling).
  dispatch(type, event) {
    const evt = Object.assign({ type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} }, event);
    let node = this;
    while (node) {
      (node.listeners.get(type) || []).slice().forEach((handler) => handler.call(node, evt));
      node = node.parentNode;
    }
    return evt;
  }

  click() { return this.dispatch("click"); }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  scrollIntoView() {}

  getClientRects() {
    return this.isConnected ? [{}] : [];
  }

  matchesRules(rules) {
    if (rules.tag && this.tagName.toLowerCase() !== rules.tag) return false;
    if (rules.id && this.getAttribute("id") !== rules.id) return false;
    for (const name of rules.classes) if (!this._classes.has(name)) return false;
    for (const [name, value] of rules.attrs) {
      if (!this.hasAttribute(name)) return false;
      if (value !== undefined && this.getAttribute(name) !== value) return false;
    }
    for (const [name, value] of rules.notAttrs) {
      if (this.hasAttribute(name) && (value === undefined || this.getAttribute(name) === value)) return false;
    }
    return true;
  }

  // Does this element match one comma group (a descendant chain)?
  matchesChain(chain) {
    let node = this;
    let index = chain.length - 1;
    if (!node.matchesRules(chain[index])) return false;
    index -= 1;
    node = node.parentNode;
    while (index >= 0 && node && node.nodeType === 1) {
      if (node.matchesRules(chain[index])) index -= 1;
      node = node.parentNode;
    }
    return index < 0;
  }

  querySelectorAll(selector) {
    const groups = parseSelector(selector);
    const found = [];
    const walk = (node) => {
      node.children.forEach((child) => {
        if (child.nodeType !== 1) return;
        if (groups.some((chain) => child.matchesChain(chain))) found.push(child);
        walk(child);
      });
    };
    walk(this);
    return found;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  closest(selector) {
    const groups = parseSelector(selector);
    let node = this;
    while (node && node.nodeType === 1) {
      if (groups.some((chain) => node.matchesChain(chain))) return node;
      node = node.parentNode;
    }
    return null;
  }
}

class FakeDocument {
  constructor() {
    this.documentElement = new FakeElement(this, "html");
    this.head = new FakeElement(this, "head");
    this.body = new FakeElement(this, "body");
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.activeElement = this.body;
    this.title = "";
    this.listeners = new Map();
  }

  createElement(tag) { return new FakeElement(this, tag); }

  createElementNS(ns, tag) { return new FakeElement(this, tag, ns); }

  createTextNode(text) { return new FakeText(text); }

  getElementById(id) { return this.body.querySelector(`#${id}`) || this.head.querySelector(`#${id}`); }

  querySelector(selector) { return this.documentElement.querySelector(selector); }

  querySelectorAll(selector) { return this.documentElement.querySelectorAll(selector); }

  addEventListener(type, handler) {
    if (typeof handler !== "function") return;
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    const list = this.listeners.get(type);
    if (list) this.listeners.set(type, list.filter((entry) => entry !== handler));
  }
}

function findAll(node, predicate, out = []) {
  if (node && node.nodeType === 1 && predicate(node)) out.push(node);
  ((node && node.children) || []).forEach((child) => findAll(child, predicate, out));
  return out;
}

const byClass = (name) => (el) => el.classList.contains(name);

module.exports = { FakeText, FakeElement, FakeDocument, findAll, byClass };
