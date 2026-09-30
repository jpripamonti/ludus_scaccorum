// The board (Ludus.Board): everything that happens INSIDE the play board, kept
// out of app.js so the game core only decides what is on the board and what a
// square means, and this module decides how it looks and how it is operated.
//
//   Pure helpers (no DOM, unit-tested in scripts/tests/board.test.js):
//     parseSquare / squareName / squareIndex / indexSquare / isDarkSquare
//     cellOf(square, orientation) / squareAtCell(col, row, orientation)
//     squareFromPoint(x, y, rect, orientation)         pointer -> square
//     nextSquare(square, key, orientation)             keyboard navigation
//     arrowGeometry(from, to, { orientation })         shaft polyline + head triangle
//     planMoves(prevPieces, nextPieces)                what slid, what was captured (FLIP)
//     motionEnabled({ animation, a11yMotion, prefersReduced }) / slideDuration(squares)
//     feedbackKind(move, givesCheck) / feedback(kind)  sound + haptics of a move
//     createDragMachine({ threshold, isLegal })        press -> drag -> drop as a state machine
//
//   The view:
//     const view = Ludus.Board.create({ el, arrowsEl, wrapEl, orientation, onSquare, onMove, onCancel,
//                                       onFocusSquare, describe, getSetting })
//     view.build(orientation)   64 squares, once per orientation (never on a normal render)
//     view.render(model)        diff-renders pieces, highlights, labels and arrows
//     view.announce(text)       polite live region under the board
//     view.destroy()
//   model = { pieces (Chess#board array | FEN), turn, interactive, selected, targets:[{square,capture}],
//             lastMove:{from,to}, check, hint:{from,to?}, marks:{best,game,user,userAlt}:{from,to},
//             arrows:[{kind,from,to}], focus, label, lang }. Squares are names ("e4").
//
// The DOM contract (classes, data attributes, sizing) is written at the top of css/board.css and in
// docs/ARCHITECTURE.md ("Board contract"). Nothing here runs at load time except registering i18n text,
// and every browser feature that might be missing (Pointer Events, Web Animations, matchMedia,
// ResizeObserver, a real layout) is checked before use so the module also loads under the Node fake DOM.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Board = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const FILES = "abcdefgh";
  const PIECE_CHARS = "PNBRQKpnbrqk";
  const PIECE_BASE = "assets/pieces/cburnett/";
  // Arrows are drawn in a fixed 800x800 box (100 units per square) and the svg scales with the board, so
  // they never need measuring and stay right when the board is resized or hidden.
  const UNIT = 100;
  // Same curve as --ease-out in styles.css; WAAPI cannot read a custom property.
  const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
  const KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"];
  const MARK_KINDS = ["best", "game", "user", "userAlt"];
  // Which arrow wins when two of them are the same move (the green one says "this was the best move").
  const ARROW_PRIORITY = ["hint", "userAlt", "user", "game", "best"];
  const LIST_LIMIT = 10;

  const L = () => root.Ludus || {};

  // ---------- Strings ----------

  function registerStrings() {
    const i18n = L().i18n;
    if (!i18n || typeof i18n.register !== "function") return;
    i18n.register({
      es: {
        "bd.live.selected": "Elegiste {square}. Podés mover a: {list}.",
        "bd.live.selectedMany": "Elegiste {square}. Tiene {count} jugadas posibles.",
        "bd.live.selectedNone": "Elegiste {square}. No tiene jugadas posibles.",
        "bd.live.cleared": "Selección cancelada.",
        "bd.live.illegal": "{square} no es una jugada posible.",
        "bd.state.check": ", rey en jaque",
        "bd.state.last": ", última jugada",
        "bd.state.best.from": ", mejor jugada: origen",
        "bd.state.best.to": ", mejor jugada: destino",
        "bd.state.user.from": ", tu jugada: origen",
        "bd.state.user.to": ", tu jugada: destino",
        "bd.state.userAlt.from": ", jugada del otro jugador: origen",
        "bd.state.userAlt.to": ", jugada del otro jugador: destino",
        "bd.state.game.from": ", jugada de la partida: origen",
        "bd.state.game.to": ", jugada de la partida: destino",
      },
      en: {
        "bd.live.selected": "Selected {square}. Can move to: {list}.",
        "bd.live.selectedMany": "Selected {square}. It has {count} legal moves.",
        "bd.live.selectedNone": "Selected {square}. It has no legal moves.",
        "bd.live.cleared": "Selection cleared.",
        "bd.live.illegal": "{square} is not a legal move.",
        "bd.state.check": ", king in check",
        "bd.state.last": ", last move",
        "bd.state.best.from": ", best move: from",
        "bd.state.best.to": ", best move: to",
        "bd.state.user.from": ", your move: from",
        "bd.state.user.to": ", your move: to",
        "bd.state.userAlt.from": ", other player's move: from",
        "bd.state.userAlt.to": ", other player's move: to",
        "bd.state.game.from": ", game move: from",
        "bd.state.game.to": ", game move: to",
      },
    });
  }
  registerStrings();

  function t(key, params) {
    const i18n = L().i18n;
    return i18n && typeof i18n.t === "function" ? i18n.t(key, params) : String(key);
  }

  // ---------- Squares (pure) ----------

  // Squares are names ("e4"); a "cell" is where a square is DRAWN: col 0..7 from the left, row 0..7 from
  // the top, which depends on which side is at the bottom. Piece arrays use Chess#board's order (index 0 = a8).
  function parseSquare(name) {
    if (typeof name !== "string" || name.length !== 2) return null;
    const file = FILES.indexOf(name[0]);
    const rank = name.charCodeAt(1) - 49;
    if (file < 0 || rank < 0 || rank > 7) return null;
    return { file, rank };
  }

  function squareName(file, rank) {
    if (!Number.isInteger(file) || !Number.isInteger(rank) || file < 0 || file > 7 || rank < 0 || rank > 7) return null;
    return FILES[file] + String(rank + 1);
  }

  function squareIndex(name) {
    const p = parseSquare(name);
    return p ? (7 - p.rank) * 8 + p.file : -1;
  }

  function indexSquare(index) {
    if (!Number.isInteger(index) || index < 0 || index > 63) return null;
    return squareName(index % 8, 7 - Math.floor(index / 8));
  }

  // a1 is a dark square (the corner to White's left hand is dark), h1 is light.
  function isDarkSquare(name) {
    const p = parseSquare(name);
    return p ? (p.file + p.rank) % 2 === 0 : false;
  }

  const isBlackSide = (orientation) => orientation === "b" || orientation === "black";

  function cellOf(name, orientation) {
    const p = parseSquare(name);
    if (!p) return null;
    return isBlackSide(orientation) ? { col: 7 - p.file, row: p.rank } : { col: p.file, row: 7 - p.rank };
  }

  function squareAtCell(col, row, orientation) {
    if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || col > 7 || row < 0 || row > 7) return null;
    return isBlackSide(orientation) ? squareName(7 - col, row) : squareName(col, 7 - row);
  }

  // rect: { left, top, width, height } of the board on screen; null when the point is outside it.
  function squareFromPoint(x, y, rect, orientation) {
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
    const fx = (x - rect.left) / rect.width;
    const fy = (y - rect.top) / rect.height;
    if (!(fx >= 0 && fx < 1 && fy >= 0 && fy < 1)) return null;
    return squareAtCell(Math.floor(fx * 8), Math.floor(fy * 8), orientation);
  }

  function centerOf(name, orientation, unit) {
    const cell = cellOf(name, orientation);
    if (!cell) return null;
    const u = unit || UNIT;
    return { x: (cell.col + 0.5) * u, y: (cell.row + 0.5) * u };
  }

  // Arrow keys are relative to the SCREEN (up is towards the top edge whichever side is at the bottom);
  // Home/End go to the left/right edge, PageUp/PageDown to the top/bottom edge. Null at the edge.
  function nextSquare(name, key, orientation) {
    const cell = cellOf(name, orientation);
    if (!cell || !KEYS.includes(key)) return null;
    let { col, row } = cell;
    if (key === "ArrowLeft") col -= 1;
    else if (key === "ArrowRight") col += 1;
    else if (key === "ArrowUp") row -= 1;
    else if (key === "ArrowDown") row += 1;
    else if (key === "Home") col = 0;
    else if (key === "End") col = 7;
    else if (key === "PageUp") row = 0;
    else if (key === "PageDown") row = 7;
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    if (col === cell.col && row === cell.row) return null;
    return squareAtCell(col, row, orientation);
  }

  function colorOf(piece) {
    if (typeof piece !== "string" || !piece) return null;
    return piece === piece.toUpperCase() ? "w" : "b";
  }

  function pieceUrl(piece) {
    const color = colorOf(piece);
    if (!color || !PIECE_CHARS.includes(piece)) return "";
    return `${PIECE_BASE}${color}${piece.toUpperCase()}.svg`;
  }

  // A Chess#board array, a FEN (or its placement field) or nothing -> 64 cells (piece char or null).
  function toCells(input) {
    const cells = new Array(64).fill(null);
    if (!input) return cells;
    if (typeof input === "string") {
      const placement = input.trim().split(/\s+/)[0] || "";
      let index = 0;
      for (const ch of placement) {
        if (ch === "/") continue;
        if (ch >= "1" && ch <= "8") {
          index += Number(ch);
        } else if (PIECE_CHARS.includes(ch) && index < 64) {
          cells[index] = ch;
          index += 1;
        } else {
          return new Array(64).fill(null);
        }
      }
      return cells;
    }
    for (let i = 0; i < 64; i += 1) {
      const p = input[i];
      cells[i] = typeof p === "string" && p.length === 1 && PIECE_CHARS.includes(p) ? p : null;
    }
    return cells;
  }

  // ---------- Arrows (pure) ----------

  // The shaft is a polyline (two legs for a knight's move, drawn as an L like the big apps do) that stops at
  // the base of the head; the head is a triangle. All numbers are fractions of a square, in a 100-unit square.
  function arrowGeometry(from, to, options) {
    const opts = options || {};
    const u = opts.unit || UNIT;
    const tail = (opts.tailInset === undefined ? 0.2 : opts.tailInset) * u;
    const tipInset = (opts.tipInset === undefined ? 0.1 : opts.tipInset) * u;
    const headLen = (opts.headLength === undefined ? 0.5 : opts.headLength) * u;
    const headWidth = (opts.headWidth === undefined ? 0.56 : opts.headWidth) * u;
    const a = parseSquare(from);
    const b = parseSquare(to);
    if (!a || !b || (a.file === b.file && a.rank === b.rank)) return null;
    const p0 = centerOf(from, opts.orientation, u);
    const p1 = centerOf(to, opts.orientation, u);
    const dx = Math.abs(b.file - a.file);
    const dy = Math.abs(b.rank - a.rank);
    const knight = opts.knight !== false && ((dx === 1 && dy === 2) || (dx === 2 && dy === 1));
    // The point where the first leg turns: along the long axis first, then the short one.
    const corner = knight ? (dy > dx ? { x: p0.x, y: p1.y } : { x: p1.x, y: p0.y }) : null;
    const lastFrom = corner || p0;
    const len = Math.hypot(p1.x - lastFrom.x, p1.y - lastFrom.y);
    const ux = (p1.x - lastFrom.x) / len;
    const uy = (p1.y - lastFrom.y) / len;
    const tip = { x: p1.x - ux * tipInset, y: p1.y - uy * tipInset };
    const base = { x: tip.x - ux * headLen, y: tip.y - uy * headLen };
    const first = corner || p1;
    const fl = Math.hypot(first.x - p0.x, first.y - p0.y);
    const start = { x: p0.x + ((first.x - p0.x) / fl) * tail, y: p0.y + ((first.y - p0.y) / fl) * tail };
    const nx = -uy;
    const ny = ux;
    const r1 = (n) => Math.round(n * 100) / 100;
    const pt = (p) => [r1(p.x), r1(p.y)];
    return {
      knight,
      points: (corner ? [start, corner, base] : [start, base]).map(pt),
      head: [tip, { x: base.x + nx * headWidth / 2, y: base.y + ny * headWidth / 2 }, { x: base.x - nx * headWidth / 2, y: base.y - ny * headWidth / 2 }].map(pt),
    };
  }

  // ---------- Motion (pure) ----------

  // "off" is always still; the in-app "reduce" (a11y.motion) beats "on"; "on" animates even when the system
  // asks for less motion (the person chose it here); "auto" follows the system.
  function motionEnabled(input) {
    const o = input || {};
    const animation = o.animation === "on" || o.animation === "off" ? o.animation : "auto";
    if (animation === "off") return false;
    if (o.a11yMotion === "reduce") return false;
    if (animation === "on") return true;
    return !o.prefersReduced;
  }

  // A hop of one square is quick, a long slide takes a little longer, never more than 300 ms.
  function slideDuration(squares) {
    const n = Number.isFinite(squares) ? squares : 1;
    return Math.round(Math.min(300, Math.max(170, 150 + n * 22)));
  }

  // ---------- Move planning (pure) ----------

  // Compares two positions and works out which pieces slid where (castling is two, a promotion is a pawn that
  // becomes the piece it slid as), which were captured (unmatched pieces that left) and whether the change is
  // one a person would call "a move" (`simple`). A completely different position is not simple: the view
  // fades that in instead of shuffling pieces across the board.
  function planMoves(prev, next) {
    const a = toCells(prev);
    const b = toCells(next);
    const removed = [];
    const added = [];
    let changed = 0;
    for (let i = 0; i < 64; i += 1) {
      if (a[i] === b[i]) continue;
      changed += 1;
      if (a[i]) removed.push({ index: i, piece: a[i] });
      if (b[i]) added.push({ index: i, piece: b[i] });
    }
    const dist = (i, j) => Math.max(Math.abs((i % 8) - (j % 8)), Math.abs(Math.floor(i / 8) - Math.floor(j / 8)));
    const pairs = [];
    removed.forEach((r, ri) => added.forEach((d, di) => {
      if (r.piece === d.piece) pairs.push({ ri, di, cost: dist(r.index, d.index) });
    }));
    pairs.sort((x, y) => x.cost - y.cost || x.ri - y.ri || x.di - y.di);
    const usedR = new Set();
    const usedD = new Set();
    const moves = [];
    const push = (r, d, extra) => moves.push(Object.assign({
      piece: d.piece,
      from: indexSquare(r.index),
      to: indexSquare(d.index),
      fromIndex: r.index,
      toIndex: d.index,
      promotedFrom: null,
    }, extra || {}));
    pairs.forEach((p) => {
      if (usedR.has(p.ri) || usedD.has(p.di)) return;
      usedR.add(p.ri);
      usedD.add(p.di);
      push(removed[p.ri], added[p.di]);
    });
    // A promotion: the pawn that left has no twin among the pieces that arrived, but a piece of its colour
    // stands on the last rank within one file of it.
    removed.forEach((r, ri) => {
      if (usedR.has(ri) || (r.piece !== "P" && r.piece !== "p")) return;
      const white = r.piece === "P";
      let best = -1;
      let bestDelta = 9;
      added.forEach((d, di) => {
        if (usedD.has(di) || /[PpKk]/.test(d.piece) || (colorOf(d.piece) === "w") !== white) return;
        if (Math.floor(d.index / 8) !== (white ? 0 : 7)) return;
        const delta = Math.abs((d.index % 8) - (r.index % 8));
        if (delta <= 1 && delta < bestDelta) {
          best = di;
          bestDelta = delta;
        }
      });
      if (best < 0) return;
      usedR.add(ri);
      usedD.add(best);
      push(r, added[best], { promotedFrom: r.piece });
    });
    moves.sort((x, y) => x.fromIndex - y.fromIndex);
    const captured = removed.filter((_, ri) => !usedR.has(ri)).map((r) => ({ index: r.index, square: indexSquare(r.index), piece: r.piece }));
    const appeared = added.filter((_, di) => !usedD.has(di)).map((d) => ({ index: d.index, square: indexSquare(d.index), piece: d.piece }));
    // A piece that reappears (undoing a capture) is part of a simple change too: it fades in where it stood.
    const simple = moves.length >= 1 && moves.length <= 4 && appeared.length <= 2 && captured.length <= 2 && changed <= 8;
    return { moves, captured, appeared, changed, simple };
  }

  // ---------- Sound and haptics ----------

  function feedbackKind(move, givesCheck) {
    if (givesCheck) return "check";
    if (move && (move.capture || move.enPassant)) return "capture";
    return "move";
  }

  // One call for the sound and the vibration of a move; both are optional and both honour the settings.
  function feedback(kind) {
    const audio = L().Audio;
    if (!audio) return;
    try {
      if (typeof audio.play === "function") audio.play(kind);
    } catch (error) {
      // Sound is decoration.
    }
    try {
      if (typeof audio.haptic === "function") audio.haptic(kind);
    } catch (error) {
      // So is the vibration.
    }
  }

  // ---------- Drag state machine (pure) ----------

  // Pointer input, decided without a DOM: the view feeds it pressed / moved / released points (with the square
  // under them) and executes the actions it returns. A press on the mover's own piece selects it at once; a
  // release without moving is a tap (a tap on a piece that was already selected deselects it); moving past the
  // threshold starts a drag; releasing over a legal target drops, over its own square keeps the selection,
  // over an illegal square snaps back (selection kept), outside the board cancels. Every press that this
  // machine took also swallows the click that follows it (`suppressClick`), so nothing is handled twice.
  function createDragMachine(options) {
    const opts = options || {};
    const threshold = Object.assign({ mouse: 4, pen: 5, touch: 8 }, opts.threshold);
    const isLegal = typeof opts.isLegal === "function" ? opts.isLegal : () => false;
    let state = "idle";
    let press = null;

    const distance = (e) => Math.hypot(e.x - press.x, e.y - press.y);
    const limit = () => (threshold[press.type] !== undefined ? threshold[press.type] : threshold.mouse);
    const reset = () => {
      state = "idle";
      press = null;
    };

    return {
      get state() { return state; },
      get from() { return press ? press.square : null; },
      get pointerId() { return press ? press.id : null; },
      down(e) {
        if (state !== "idle" || !e || !e.draggable || !e.square) return [];
        state = "pressed";
        press = { id: e.id, type: e.type || "mouse", x: e.x, y: e.y, square: e.square, wasSelected: Boolean(e.selected) };
        return press.wasSelected ? [] : [{ type: "select", square: e.square }];
      },
      move(e) {
        if (state === "idle" || !e || e.id !== press.id) return [];
        if (state === "pressed") {
          if (distance(e) < limit()) return [];
          state = "dragging";
          return [
            { type: "start", square: press.square, x: e.x, y: e.y },
            { type: "move", x: e.x, y: e.y, over: e.square || null, legal: Boolean(e.square && isLegal(e.square)) },
          ];
        }
        return [{ type: "move", x: e.x, y: e.y, over: e.square || null, legal: Boolean(e.square && isLegal(e.square)) }];
      },
      up(e) {
        if (state === "idle" || !e || e.id !== press.id) return [];
        const from = press.square;
        const wasSelected = press.wasSelected;
        const was = state;
        reset();
        const swallow = { type: "suppressClick" };
        if (was === "pressed") return wasSelected ? [{ type: "toggle", square: from }, swallow] : [swallow];
        const to = e.square || null;
        if (!to) return [{ type: "cancel", reason: "outside" }, swallow];
        if (to === from) return [{ type: "return", square: from }, swallow];
        if (isLegal(to)) return [{ type: "drop", from, to }, swallow];
        return [{ type: "snapback", from, to }, swallow];
      },
      cancel(reason) {
        if (state === "idle") return [];
        const was = state;
        reset();
        return was === "dragging" ? [{ type: "cancel", reason: reason || "cancel" }] : [];
      },
    };
  }

  // ---------- The view ----------

  function noop() {}

  function create(options) {
    const opts = options || {};
    const el = opts.el;
    if (!el || typeof el.appendChild !== "function") return null;
    const doc = opts.document || el.ownerDocument || root.document || null;
    const win = opts.window || root.window || root;
    const cb = {
      onSquare: typeof opts.onSquare === "function" ? opts.onSquare : noop,
      onMove: typeof opts.onMove === "function" ? opts.onMove : null,
      onCancel: typeof opts.onCancel === "function" ? opts.onCancel : noop,
      onFocusSquare: typeof opts.onFocusSquare === "function" ? opts.onFocusSquare : noop,
      describe: typeof opts.describe === "function" ? opts.describe : null,
    };

    const S = {
      orientation: isBlackSide(opts.orientation) ? "b" : "w",
      cells: [],
      byName: new Map(),
      model: null,
      prev: null,
      focus: null,
      anims: [],
      leaving: new Set(),
      drag: null,
      suppressClick: false,
      suppressTimer: null,
      dropNote: null,
      attrs: {},
      arrowsKey: null,
      live: null,
      liveTimer: null,
      lastLabel: null,
      offs: [],
      dead: false,
    };

    // Timers come from the global scope: under Node's fake DOM `window` is a bare object without them.
    const later = (fn, ms) => root.setTimeout(fn, ms);
    const unlater = (id) => root.clearTimeout(id);

    const h = (...args) => {
      const util = L().util;
      if (!util || typeof util.h !== "function") throw new Error("Ludus.Board needs Ludus.util.h");
      return util.h(...args);
    };

    function setting(path, fallback) {
      try {
        if (typeof opts.getSetting === "function") {
          const v = opts.getSetting(path);
          return v === undefined ? fallback : v;
        }
        const settings = L().Settings;
        if (settings && typeof settings.get === "function") {
          const v = settings.get(path);
          return v === undefined ? fallback : v;
        }
      } catch (error) {
        // Settings are a preference, never a requirement.
      }
      return fallback;
    }

    function prefersReducedMotion() {
      try {
        const de = doc && doc.documentElement;
        if (de && typeof de.getAttribute === "function" && de.getAttribute("data-motion") === "reduce") return true;
      } catch (error) {
        // fall through
      }
      try {
        return Boolean(win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches);
      } catch (error) {
        return false;
      }
    }

    const motionOn = () => motionEnabled({
      animation: setting("board.animation", "auto"),
      a11yMotion: setting("a11y.motion", "auto"),
      prefersReduced: prefersReducedMotion(),
    });
    const canAnimate = (node) => Boolean(node) && typeof node.animate === "function";
    const dragEnabled = () => setting("board.drag", true) !== false && typeof win.PointerEvent === "function";

    function clear(node) {
      const kids = Array.from(node.childNodes || node.children || []);
      kids.forEach((kid) => node.removeChild(kid));
    }

    function setData(name, value) {
      if (S.attrs[name] === value) return;
      S.attrs[name] = value;
      try {
        el.setAttribute(`data-${name}`, value);
      } catch (error) {
        // ignore
      }
    }

    function applySettingAttrs() {
      setData("coords", setting("board.coords", true) === false ? "off" : "on");
      setData("legal", setting("board.legalDots", true) === false ? "off" : "on");
      setData("drag", dragEnabled() ? "on" : "off");
    }

    // ----- Build -----

    function build(orientation) {
      S.orientation = isBlackSide(orientation) ? "b" : "w";
      cancelDrag("rebuild");
      cancelAnimations();
      clear(el);
      S.cells = new Array(64);
      S.byName = new Map();
      S.prev = null;
      S.arrowsKey = null;
      el.setAttribute("role", "grid");
      setData("orientation", S.orientation);
      applySettingAttrs();
      const leftCol = 0;
      const bottomRow = 7;
      for (let row = 0; row < 8; row += 1) {
        const rowEls = [];
        for (let col = 0; col < 8; col += 1) {
          const name = squareAtCell(col, row, S.orientation);
          const kids = [];
          if (col === leftCol) kids.push(h("span", { class: "coord coord-rank", "aria-hidden": "true" }, name[1]));
          if (row === bottomRow) kids.push(h("span", { class: "coord coord-file", "aria-hidden": "true" }, name[0]));
          const square = h("div", {
            class: `square ${isDarkSquare(name) ? "dark" : "light"}`,
            role: "gridcell",
            tabindex: -1,
            "aria-rowindex": row + 1,
            "aria-colindex": col + 1,
            "aria-selected": "false",
            dataset: { square: name },
          }, kids);
          const index = squareIndex(name);
          const cell = { name, index, el: square, piece: null, pieceEl: null, sig: null, cls: null };
          S.cells[index] = cell;
          S.byName.set(name, cell);
          rowEls.push(square);
        }
        el.appendChild(h("div", { class: "board-row", role: "row", "aria-rowindex": row + 1 }, rowEls));
      }
      S.focus = null;
    }

    // ----- Rendering -----

    function normalize(input) {
      const m = input || {};
      const targets = new Map();
      (Array.isArray(m.targets) ? m.targets : []).forEach((entry) => {
        const name = typeof entry === "string" ? entry : entry && entry.square;
        if (parseSquare(name)) targets.set(name, Boolean(entry && entry.capture));
      });
      const move = (v) => (v && parseSquare(v.from) && parseSquare(v.to) ? { from: v.from, to: v.to } : null);
      const marks = {};
      MARK_KINDS.forEach((kind) => {
        const v = move(m.marks && m.marks[kind]);
        if (v) marks[kind] = v;
      });
      const hint = m.hint && parseSquare(m.hint.from) ? { from: m.hint.from, to: parseSquare(m.hint.to) ? m.hint.to : null } : null;
      return {
        cells: toCells(m.pieces),
        turn: m.turn === "b" ? "b" : "w",
        interactive: Boolean(m.interactive),
        selected: parseSquare(m.selected) ? m.selected : null,
        targets,
        lastMove: move(m.lastMove),
        check: parseSquare(m.check) ? m.check : null,
        hint,
        marks,
        arrows: Array.isArray(m.arrows) ? m.arrows : [],
        focus: parseSquare(m.focus) ? m.focus : null,
        label: typeof m.label === "string" ? m.label : "",
        lang: String(m.lang || ""),
        raw: m,
      };
    }

    // Square name -> { cls, selected, ... }: only the few squares that carry a highlight get an entry.
    function flagsFor(m) {
      const flags = {};
      const at = (name) => flags[name] || (flags[name] = { cls: "" });
      const add = (name, cls, key) => {
        const f = at(name);
        f.cls += ` ${cls}`;
        if (key) f[key] = true;
      };
      if (m.selected) add(m.selected, "selected", "selected");
      m.targets.forEach((capture, name) => add(name, capture ? "capture" : "legal", capture ? "capture" : "legal"));
      if (m.lastMove && setting("board.lastMove", true) !== false) {
        add(m.lastMove.from, "bd-last", "last");
        add(m.lastMove.to, "bd-last", "last");
      }
      if (m.check) add(m.check, "bd-check", "check");
      if (m.hint) {
        add(m.hint.from, "hint-from", "hintFrom");
        if (m.hint.to) add(m.hint.to, "hint-to", "hintTo");
      }
      MARK_KINDS.forEach((kind) => {
        const mark = m.marks[kind];
        if (!mark) return;
        const css = kind === "userAlt" ? "user-alt" : kind;
        add(mark.from, `${css}-from`, `${kind}From`);
        add(mark.to, `${css}-to`, `${kind}To`);
      });
      if (S.drag) {
        add(S.drag.from, "bd-drag-src");
        if (S.drag.over) add(S.drag.over, "bd-over");
      }
      return flags;
    }

    function setClass(node, value) {
      node.setAttribute("class", value);
    }

    function makePiece(piece) {
      return h("img", {
        class: "bd-piece",
        src: pieceUrl(piece),
        alt: "",
        draggable: "false",
        "aria-hidden": "true",
        dataset: { piece: `${colorOf(piece)}${piece.toUpperCase()}` },
      });
    }

    function retarget(pieceEl, piece) {
      pieceEl.setAttribute("src", pieceUrl(piece));
      pieceEl.dataset.piece = `${colorOf(piece)}${piece.toUpperCase()}`;
    }

    function cancelAnimations() {
      const running = S.anims.splice(0);
      running.forEach((a) => {
        try {
          a.cancel();
        } catch (error) {
          // already finished
        }
      });
      S.leaving.forEach((node) => {
        try {
          if (node.parentNode) node.parentNode.removeChild(node);
        } catch (error) {
          // already gone
        }
      });
      S.leaving.clear();
    }

    function track(animation, done) {
      S.anims.push(animation);
      const finish = () => {
        const i = S.anims.indexOf(animation);
        if (i >= 0) S.anims.splice(i, 1);
        if (done) done();
      };
      animation.onfinish = finish;
      animation.oncancel = finish;
    }

    function fadeOut(node, delay) {
      S.leaving.add(node);
      node.classList.add("bd-leaving");
      const gone = () => {
        S.leaving.delete(node);
        try {
          if (node.parentNode) node.parentNode.removeChild(node);
        } catch (error) {
          // ignore
        }
      };
      if (!canAnimate(node)) {
        gone();
        return;
      }
      track(node.animate(
        [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(0.8)" }],
        { duration: 170, delay, easing: "ease-out", fill: "both" },
      ), gone);
    }

    // The piece part of a render: puts the pieces where `next` says with as few DOM operations as possible and
    // reports what should be animated once the DOM has settled. When the change is one move (a `simple` plan)
    // the moving elements are reused (re-parented into their new square) instead of recreated, which is what
    // lets them slide; the ones that were captured stay in their square until they have faded.
    function applyPieces(next, plan) {
      const slides = [];
      const leaving = [];
      const dropped = S.dropNote;
      if (plan) {
        const detach = (cell) => {
          if (!cell.pieceEl) return;
          leaving.push(cell.pieceEl);
          cell.pieceEl = null;
          cell.piece = null;
        };
        plan.captured.forEach((c) => detach(S.cells[c.index]));
        // Lift every moving piece out of its square first, so a piece that lands where another one is leaving
        // (a chain of moves after a reset) is not mistaken for a capture.
        const held = plan.moves.map((mv) => {
          const src = S.cells[mv.fromIndex];
          const pieceEl = src.pieceEl;
          src.pieceEl = null;
          src.piece = null;
          return pieceEl;
        });
        plan.moves.forEach((mv, i) => {
          const pieceEl = held[i];
          if (!pieceEl) return;
          const dst = S.cells[mv.toIndex];
          detach(dst);
          if (mv.promotedFrom) retarget(pieceEl, mv.piece);
          dst.el.appendChild(pieceEl);
          dst.pieceEl = pieceEl;
          dst.piece = mv.piece;
          // A piece the person just dropped there is already where it belongs: it does not slide.
          slides.push({ el: pieceEl, mv, still: Boolean(dropped && dropped.from === mv.from && dropped.to === mv.to) });
        });
      }
      const created = [];
      for (let i = 0; i < 64; i += 1) {
        const cell = S.cells[i];
        const want = next[i];
        if (cell.piece === want) continue;
        if (cell.pieceEl) {
          cell.el.removeChild(cell.pieceEl);
          cell.pieceEl = null;
        }
        cell.piece = want;
        if (want) {
          cell.pieceEl = makePiece(want);
          cell.el.appendChild(cell.pieceEl);
          created.push(cell.pieceEl);
        }
      }
      return { slides, leaving, created };
    }

    function playPieces(result, motion, fadeIn) {
      // A captured piece disappears when the piece that took it arrives, not before.
      const wait = result.slides.some((s) => !s.still) ? 120 : 0;
      result.leaving.forEach((node) => {
        if (motion) fadeOut(node, wait);
        else if (node.parentNode) node.parentNode.removeChild(node);
      });
      if (!motion) return;
      result.slides.forEach((s) => {
        if (s.still || !canAnimate(s.el)) return;
        const from = cellOf(s.mv.from, S.orientation);
        const to = cellOf(s.mv.to, S.orientation);
        const dx = (from.col - to.col) * 100;
        const dy = (from.row - to.row) * 100;
        s.el.classList.add("bd-moving");
        // The piece fills its square, so a percentage translation is a number of squares whatever the board size.
        track(s.el.animate(
          [{ transform: `translate(${dx}%, ${dy}%)` }, { transform: "translate(0%, 0%)" }],
          { duration: slideDuration(Math.max(Math.abs(dx), Math.abs(dy)) / 100), easing: EASE_OUT },
        ), () => s.el.classList.remove("bd-moving"));
      });
      // A different position: every piece fades in instead of teleporting; after a simple change only the pieces
      // that are new (a captured one coming back) do.
      const appearing = fadeIn ? S.cells.map((cell) => cell.pieceEl).filter(Boolean) : result.created;
      if (result.created.length || fadeIn) {
        appearing.forEach((node) => {
          if (canAnimate(node)) track(node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" }));
        });
      }
    }

    function describeSquare(cell, f, m, disabled) {
      const info = {
        square: cell.name,
        piece: cell.piece,
        selected: Boolean(f && f.selected),
        legal: Boolean(f && f.legal),
        capture: Boolean(f && f.capture),
        last: Boolean(f && f.last),
        check: Boolean(f && f.check),
        hintFrom: Boolean(f && f.hintFrom),
        hintTo: Boolean(f && f.hintTo),
        marks: {},
        disabled,
      };
      MARK_KINDS.forEach((kind) => {
        info.marks[kind] = { from: Boolean(f && f[`${kind}From`]), to: Boolean(f && f[`${kind}To`]) };
      });
      if (cb.describe) {
        try {
          const label = cb.describe(info);
          if (typeof label === "string") return label;
        } catch (error) {
          // fall back to the plain label below
        }
      }
      return cell.piece ? `${cell.name} ${cell.piece}` : cell.name;
    }

    function focusName(m) {
      if (m.focus && S.byName.has(m.focus)) return m.focus;
      if (S.focus && S.byName.has(S.focus)) return S.focus;
      return squareAtCell(0, 0, S.orientation);
    }

    function applySquares(m, flags) {
      const disabled = !m.interactive;
      const drag = dragEnabled() && m.interactive;
      const tab = focusName(m);
      S.focus = tab;
      for (let i = 0; i < 64; i += 1) {
        const cell = S.cells[i];
        const f = flags[cell.name];
        const canDrag = drag && cell.piece && colorOf(cell.piece) === m.turn;
        const cls = `square ${isDarkSquare(cell.name) ? "dark" : "light"}${f ? f.cls : ""}${canDrag ? " bd-can-drag" : ""}`;
        const isTab = cell.name === tab;
        const sig = `${cell.piece || ""}|${cls}|${isTab ? 1 : 0}|${disabled ? 1 : 0}|${m.lang}`;
        if (cell.sig === sig) continue;
        cell.sig = sig;
        if (cell.cls !== cls) {
          cell.cls = cls;
          setClass(cell.el, cls);
        }
        cell.el.setAttribute("aria-label", describeSquare(cell, f, m, disabled));
        cell.el.setAttribute("aria-selected", f && f.selected ? "true" : "false");
        cell.el.setAttribute("aria-disabled", disabled ? "true" : "false");
        cell.el.setAttribute("tabindex", isTab ? "0" : "-1");
      }
    }

    function applyArrows(m) {
      const svg = opts.arrowsEl;
      if (!svg || typeof svg.appendChild !== "function") return;
      const seen = new Map();
      const list = [];
      m.arrows.forEach((arrow) => {
        if (!arrow || !parseSquare(arrow.from) || !parseSquare(arrow.to) || arrow.from === arrow.to) return;
        const kind = ARROW_PRIORITY.includes(arrow.kind) ? arrow.kind : "best";
        const key = `${arrow.from}${arrow.to}`;
        const at = seen.get(key);
        if (at !== undefined) {
          if (ARROW_PRIORITY.indexOf(kind) > ARROW_PRIORITY.indexOf(list[at].kind)) list[at] = { kind, from: arrow.from, to: arrow.to };
          return;
        }
        seen.set(key, list.length);
        list.push({ kind, from: arrow.from, to: arrow.to });
      });
      list.sort((x, y) => ARROW_PRIORITY.indexOf(x.kind) - ARROW_PRIORITY.indexOf(y.kind));
      const key = `${S.orientation}|${list.map((a) => `${a.kind}:${a.from}${a.to}`).join(",")}`;
      if (key === S.arrowsKey) return;
      S.arrowsKey = key;
      clear(svg);
      svg.setAttribute("viewBox", `0 0 ${UNIT * 8} ${UNIT * 8}`);
      svg.setAttribute("preserveAspectRatio", "none");
      list.forEach((arrow) => {
        const g = arrowGeometry(arrow.from, arrow.to, { orientation: S.orientation });
        if (!g) return;
        const lines = [];
        for (let i = 0; i + 1 < g.points.length; i += 1) {
          lines.push(h("svg:line", {
            class: "board-arrow-line",
            x1: g.points[i][0],
            y1: g.points[i][1],
            x2: g.points[i + 1][0],
            y2: g.points[i + 1][1],
          }));
        }
        svg.appendChild(h(
          "svg:g",
          { class: `bd-arrow bd-arrow-${arrow.kind}`, dataset: { kind: arrow.kind, from: arrow.from, to: arrow.to } },
          lines,
          h("svg:polygon", { class: "bd-arrow-head", points: g.head.map((p) => p.join(",")).join(" ") }),
        ));
      });
    }

    function render(input, renderOptions) {
      if (S.dead || !S.cells.length) return false;
      const ro = renderOptions || {};
      const m = normalize(input);
      S.model = m;
      applySettingAttrs();
      if (m.label && m.label !== S.lastLabel) {
        S.lastLabel = m.label;
        el.setAttribute("aria-label", m.label);
      }
      const plan = S.prev ? planMoves(S.prev, m.cells) : null;
      // A render that moves pieces finishes whatever was still moving, so animations never stack. One that only
      // changes highlights or arrows (several run back to back in one turn) leaves a running slide alone.
      if (!plan || plan.changed > 0 || ro.instant) cancelAnimations();
      const motion = !ro.instant && motionOn();
      const result = applyPieces(m.cells, plan && plan.simple ? plan : null);
      applySquares(m, flagsFor(m));
      applyArrows(m);
      // No previous position, or one that is not a move away: a fresh position, faded in.
      playPieces(result, motion, !plan || (!plan.simple && plan.changed > 0));
      S.prev = m.cells;
      S.dropNote = null;
      return true;
    }

    // Redraws only the arrows (the game core calls this when the result appears or goes away).
    function setArrows(list) {
      if (S.dead || !S.model) return;
      S.model.arrows = Array.isArray(list) ? list : [];
      applyArrows(S.model);
    }

    // Repaints the squares from the last model (the drag changes highlights without a full render).
    function refresh() {
      if (!S.model) return;
      applySquares(S.model, flagsFor(S.model));
    }

    // ----- Live region -----

    function ensureLive() {
      if (S.live) return S.live;
      const host = opts.wrapEl || el.parentNode;
      if (!host || typeof host.appendChild !== "function") return null;
      try {
        S.live = h("div", { class: "bd-live sr-only", role: "status", "aria-live": "polite", "aria-atomic": "true" });
        host.appendChild(S.live);
      } catch (error) {
        S.live = null;
      }
      return S.live;
    }

    function announce(text) {
      const live = ensureLive();
      if (!live || !text) return;
      live.textContent = "";
      if (S.liveTimer) unlater(S.liveTimer);
      // Empty first, then the text on the next tick: the same sentence twice in a row is still announced.
      S.liveTimer = later(() => {
        S.liveTimer = null;
        live.textContent = String(text);
      }, 40);
    }

    function announceSelection() {
      const m = S.model;
      if (!m || !m.selected) return;
      const list = Array.from(m.targets.keys());
      if (!list.length) announce(t("bd.live.selectedNone", { square: m.selected }));
      else if (list.length > LIST_LIMIT) announce(t("bd.live.selectedMany", { square: m.selected, count: list.length }));
      else announce(t("bd.live.selected", { square: m.selected, list: list.join(", ") }));
    }

    // ----- Pointer: click, press, drag -----

    function squareOfNode(node) {
      let n = node;
      while (n && n !== el) {
        if (n.dataset && n.dataset.square) return n.dataset.square;
        n = n.parentNode;
      }
      return null;
    }

    const boardRect = () => (typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null);

    function activate(name, via) {
      const before = S.model ? S.model.selected : null;
      cb.onSquare(name, { via });
      const after = S.model ? S.model.selected : null;
      if (after && after !== before && via !== "drop") announceSelection();
    }

    function onClick(e) {
      if (S.suppressClick) {
        S.suppressClick = false;
        return;
      }
      let name = squareOfNode(e.target);
      if (!name && e.clientX !== undefined) name = squareFromPoint(e.clientX, e.clientY, boardRect(), S.orientation);
      if (name) activate(name, "click");
    }

    const machine = createDragMachine({ isLegal: (name) => Boolean(S.model && S.model.targets.has(name)) });

    function swallowClick() {
      S.suppressClick = true;
      if (S.suppressTimer) unlater(S.suppressTimer);
      // A click normally follows the release at once; if none does (released elsewhere), do not eat a later real one.
      S.suppressTimer = later(() => {
        S.suppressClick = false;
        S.suppressTimer = null;
      }, 400);
    }

    function ghostSize() {
      const rect = boardRect();
      return rect && rect.width > 0 ? rect.width / 8 : 48;
    }

    function startGhost(a, e) {
      const cell = S.byName.get(a.square);
      if (!cell || !cell.piece || !doc || !doc.body) return;
      const size = ghostSize();
      const ghost = h("img", { class: "bd-ghost", src: pieceUrl(cell.piece), alt: "", draggable: "false", "aria-hidden": "true" });
      ghost.style.width = `${size}px`;
      ghost.style.height = `${size}px`;
      // Padding in pixels: a percentage would be measured against the window, not against the piece.
      ghost.style.padding = `${Math.round(size * 0.035 * 10) / 10}px`;
      doc.body.appendChild(ghost);
      S.drag = { id: e.pointerId, type: e.pointerType || "mouse", from: a.square, over: null, ghost, size, x: a.x, y: a.y };
      doc.body.classList.add("bd-drag-active");
      if (doc.addEventListener) doc.addEventListener("keydown", onDocKey, true);
      refresh();
    }

    function moveGhost(a) {
      const d = S.drag;
      if (!d) return;
      d.x = a.x;
      d.y = a.y;
      const scale = d.type === "touch" ? 1.35 : 1.15;
      d.ghost.style.transform = `translate3d(${Math.round(a.x - d.size / 2)}px, ${Math.round(a.y - d.size / 2)}px, 0) scale(${scale})`;
      if (d.over !== a.over) {
        d.over = a.over;
        refresh();
      }
    }

    function endGhost(snap) {
      const d = S.drag;
      if (!d) return;
      S.drag = null;
      if (doc && doc.body) doc.body.classList.remove("bd-drag-active");
      if (doc && doc.removeEventListener) doc.removeEventListener("keydown", onDocKey, true);
      try {
        if (el.releasePointerCapture && d.id !== undefined) el.releasePointerCapture(d.id);
      } catch (error) {
        // capture already gone
      }
      const remove = () => {
        try {
          if (d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
        } catch (error) {
          // ignore
        }
      };
      const origin = snap && motionOn() && canAnimate(d.ghost) ? S.byName.get(d.from) : null;
      const rect = boardRect();
      if (origin && rect) {
        const cell = cellOf(d.from, S.orientation);
        const tx = rect.left + (cell.col + 0.5) * d.size - d.size / 2;
        const ty = rect.top + (cell.row + 0.5) * d.size - d.size / 2;
        const anim = d.ghost.animate(
          [{ transform: d.ghost.style.transform }, { transform: `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0) scale(1)` }],
          { duration: 150, easing: EASE_OUT, fill: "forwards" },
        );
        anim.onfinish = remove;
        anim.oncancel = remove;
      } else {
        remove();
      }
      refresh();
    }

    function run(actions, e) {
      actions.forEach((a) => {
        if (a.type === "select") {
          activate(a.square, "press");
        } else if (a.type === "toggle") {
          activate(a.square, "tap");
        } else if (a.type === "start") {
          startGhost(a, e);
        } else if (a.type === "move") {
          moveGhost(a);
        } else if (a.type === "drop") {
          endGhost(false);
          // The game core renders while it handles the drop: the note tells that render not to slide the piece.
          S.dropNote = { from: a.from, to: a.to };
          try {
            if (cb.onMove) cb.onMove(a.from, a.to, { via: "drag" });
            else {
              cb.onSquare(a.from, { via: "drop" });
              cb.onSquare(a.to, { via: "drop" });
            }
          } finally {
            S.dropNote = null;
          }
        } else if (a.type === "return") {
          endGhost(true);
        } else if (a.type === "snapback") {
          endGhost(true);
          announce(t("bd.live.illegal", { square: a.to }));
        } else if (a.type === "cancel") {
          endGhost(true);
          if (S.model && S.model.selected) cb.onCancel(a.reason);
        } else if (a.type === "suppressClick") {
          swallowClick();
        }
      });
    }

    function pointerPoint(e) {
      return {
        id: e.pointerId,
        type: e.pointerType || "mouse",
        x: e.clientX,
        y: e.clientY,
        square: squareFromPoint(e.clientX, e.clientY, boardRect(), S.orientation),
      };
    }

    function onPointerDown(e) {
      if (!dragEnabled() || e.isPrimary === false || (e.pointerType === "mouse" && e.button !== 0)) return;
      const p = pointerPoint(e);
      const m = S.model;
      const cell = p.square ? S.byName.get(p.square) : null;
      const draggable = Boolean(m && m.interactive && cell && cell.piece && colorOf(cell.piece) === m.turn);
      const actions = machine.down(Object.assign(p, { draggable, selected: Boolean(m && m.selected === p.square) }));
      if (!draggable) return;
      try {
        if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
      } catch (error) {
        // not capturable (already released); the window fallback below still ends the drag
      }
      try {
        if (cell.el.focus) cell.el.focus({ preventScroll: true });
      } catch (error) {
        // focus is a nicety
      }
      run(actions, e);
    }

    function onPointerMove(e) {
      if (machine.state === "idle" || e.pointerId !== machine.pointerId) return;
      run(machine.move(pointerPoint(e)), e);
    }

    function onPointerUp(e) {
      if (machine.state === "idle" || e.pointerId !== machine.pointerId) return;
      run(machine.up(pointerPoint(e)), e);
    }

    function cancelDrag(reason) {
      const actions = machine.cancel(reason);
      if (actions.length) run(actions, {});
      else if (S.drag) endGhost(false);
    }

    function onPointerCancel(e) {
      if (machine.state === "idle" || (e && e.pointerId !== machine.pointerId)) return;
      cancelDrag("pointercancel");
    }

    function onDocKey(e) {
      if (e.key !== "Escape" || !S.drag) return;
      e.preventDefault();
      e.stopPropagation();
      cancelDrag("escape");
    }

    // ----- Keyboard -----

    function setFocus(name, focusOptions) {
      const cell = S.byName.get(name);
      if (!cell) return;
      const prev = S.focus ? S.byName.get(S.focus) : null;
      if (prev && prev !== cell) {
        prev.el.setAttribute("tabindex", "-1");
        prev.sig = null;
      }
      cell.el.setAttribute("tabindex", "0");
      cell.sig = null;
      S.focus = name;
      if (focusOptions && focusOptions.focus && cell.el.focus) cell.el.focus();
    }

    function onKeyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const name = squareOfNode(e.target);
      if (!name) return;
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        activate(name, "key");
      } else if (KEYS.includes(e.key)) {
        const next = nextSquare(name, e.key, S.orientation);
        e.preventDefault();
        if (next) setFocus(next, { focus: true });
      } else if (e.key === "Escape" && S.model && S.model.selected) {
        e.preventDefault();
        cb.onCancel("escape");
        announce(t("bd.live.cleared"));
      }
    }

    function onFocusIn(e) {
      const name = squareOfNode(e.target);
      if (!name) return;
      if (S.focus !== name) setFocus(name);
      cb.onFocusSquare(name);
    }

    function on(target, type, fn, options2) {
      if (!target || typeof target.addEventListener !== "function") return;
      target.addEventListener(type, fn, options2);
      S.offs.push(() => target.removeEventListener && target.removeEventListener(type, fn, options2));
    }

    on(el, "click", onClick);
    on(el, "pointerdown", onPointerDown);
    on(el, "pointermove", onPointerMove);
    on(el, "pointerup", onPointerUp);
    on(el, "pointercancel", onPointerCancel);
    on(el, "lostpointercapture", (e) => {
      // Losing the capture in the middle of a drag (the tab lost focus, a dialog opened) ends it.
      if (S.drag && e.pointerId === machine.pointerId) cancelDrag("lostcapture");
    });
    on(el, "keydown", onKeyDown);
    on(el, "focusin", onFocusIn);
    on(el, "contextmenu", (e) => {
      // A long press on a piece must not open the browser's menu on top of a drag.
      if (machine.state !== "idle" || e.pointerType === "touch") e.preventDefault();
    });
    on(el, "dragstart", (e) => e.preventDefault());
    // If the capture could not be taken (or was lost), the release still ends the drag.
    on(win, "pointerup", onPointerUp);
    on(win, "pointercancel", onPointerCancel);
    on(win, "blur", () => cancelDrag("blur"));
    if (doc) on(doc, "visibilitychange", () => cancelDrag("hidden"));

    // ----- Settings -----

    function onSettings(payload) {
      const path = payload && payload.path ? String(payload.path) : "";
      // sound.* and haptics need nothing here: Ludus.Audio reads them every time it plays.
      if (!/^(board\.|a11y\.)/.test(path)) return;
      try {
        const settings = L().Settings;
        if (settings && typeof settings.applyToDocument === "function" && (path === "board.theme" || path.startsWith("a11y."))) settings.applyToDocument();
      } catch (error) {
        // the theme is applied by Settings itself on the next change
      }
      if (path === "board.drag" && S.drag) cancelDrag("settings");
      applySettingAttrs();
      if (path.startsWith("board.animation") || path.startsWith("a11y.")) cancelAnimations();
      if (S.model) {
        S.cells.forEach((cell) => { cell.sig = null; });
        render(S.model.raw, { instant: true });
      }
    }

    const bus = L().bus;
    if (bus && typeof bus.on === "function") {
      const off = bus.on("settings:changed", onSettings);
      if (typeof off === "function") S.offs.push(off);
    }

    function destroy() {
      S.dead = true;
      cancelDrag("destroy");
      cancelAnimations();
      S.offs.splice(0).forEach((off) => {
        try {
          off();
        } catch (error) {
          // ignore
        }
      });
      if (S.liveTimer) unlater(S.liveTimer);
    }

    build(S.orientation);
    // The pieces are the first thing a person waits for once a board shows, but the view is created at boot, long
    // before any board is on screen: the landing has none, and fetching the twelve SVGs there only competes with the
    // hero and the scripts. So they are warmed (when the browser is idle) the first time the router leaves the landing,
    // or at once when there is no router to ask. A service-worker precache also holds them for returning visitors.
    try {
      if (typeof win.Image === "function") {
        let warmed = false;
        const warm = () => {
          if (warmed) return;
          warmed = true;
          const fetchAll = () => "PNBRQKpnbrqk".split("").forEach((p) => { new win.Image().src = pieceUrl(p); });
          if (typeof win.requestIdleCallback === "function") win.requestIdleCallback(fetchAll, { timeout: 3000 });
          else fetchAll();
        };
        const router = L().router;
        const current = router && typeof router.current === "function" ? router.current() : null;
        if (current && current !== "landing") warm();
        else if (bus && typeof bus.on === "function" && router) {
          const off = bus.on("screen:changed", (payload) => {
            if (payload && payload.id && payload.id !== "landing") {
              warm();
              if (typeof off === "function") off();
            }
          });
        } else warm();
      }
    } catch (error) {
      // preloading is an optimisation
    }

    return {
      el,
      build,
      render,
      setArrows,
      announce,
      destroy,
      setFocus,
      cancelDrag: () => cancelDrag("api"),
      isDragging: () => Boolean(S.drag),
      squareEl: (name) => (S.byName.get(name) ? S.byName.get(name).el : null),
      get orientation() { return S.orientation; },
      get model() { return S.model; },
      get focus() { return S.focus; },
      // Flips the board and keeps what it shows (a "flip board" button); the game core rebuilds and renders itself.
      setOrientation(orientation) {
        const next = isBlackSide(orientation) ? "b" : "w";
        if (next === S.orientation && S.cells.length) return;
        build(next);
        if (S.model) render(S.model.raw, { instant: true });
      },
    };
  }

  return {
    FILES,
    UNIT,
    create,
    feedback,
    feedbackKind,
    motionEnabled,
    slideDuration,
    parseSquare,
    squareName,
    squareIndex,
    indexSquare,
    isDarkSquare,
    cellOf,
    squareAtCell,
    squareFromPoint,
    centerOf,
    nextSquare,
    colorOf,
    pieceUrl,
    toCells,
    arrowGeometry,
    planMoves,
    createDragMachine,
    registerStrings,
  };
});
