// Classic games library: loader and selector over the generated data in
// js/data/classics.data.js (Ludus.ClassicsData). Contract: docs/ARCHITECTURE.md
// section 14; how the data is made and verified: docs/CLASSICS_DATA.md.
//
//   Ludus.Classics.load()                 lazy, idempotent -> Promise<data>
//   Ludus.Classics.list()                 metadata of every game (no moves, no lines)
//   Ludus.Classics.get(id)                the full (frozen) game record
//   Ludus.Classics.positions(gameId, { count, side, maxDifficulty, shuffle, random })
//   Ludus.Classics.random(count, { exclude, maxDifficulty, gameIds, random, includeTrivial })
//   Ludus.Classics.daily(dateKey, { maxDifficulty, includeTrivial })   same position for the same "YYYY-MM-DD"
//   Ludus.Classics.story(gameId)          the whole game as a playable list of plies
//   Ludus.Classics.displayName(raw, lang) / displayEvent(raw, lang)   the es/en form of a raw PGN White/Black/Event tag
//   Ludus.Classics.localizeQuotedMoves(text, textLang)   the moves quoted inside a blurb or note, spelled as the notation setting says
//
// Position objects have the shape of docs/ARCHITECTURE.md section 9 (source
// "classic", reference.lines from the precomputed Stockfish pass). `ply` is
// always the 0-based index of the master's move in the game (the same
// convention as app.js: moveNumber = floor(ply / 2) + 1).
//
// Everything except load() is synchronous and returns empty results ([] / null)
// until the data has been loaded. Pure logic: no DOM access at load time.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Classics = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const DATA_PATH = "js/data/classics.data.js";
  const DATA_VERSION = 1;
  const KINDS = ["only-move", "tactic", "sacrifice", "quiet", "endgame", "opening"];
  const MAX_COUNT = 200;

  // Controlled vocabulary for notes.json "themes" (the build/test reject others).
  const THEMES = {
    "attack": { es: "Ataque", en: "Attack" },
    "brilliancy": { es: "Joya de creación", en: "Brilliancy" },
    "counterattack": { es: "Contraataque", en: "Counterattack" },
    "development": { es: "Desarrollo", en: "Development" },
    "defence": { es: "Defensa", en: "Defence" },
    "double-check": { es: "Jaque doble", en: "Double check" },
    "endgame-technique": { es: "Técnica de finales", en: "Endgame technique" },
    "exchange-sacrifice": { es: "Sacrificio de calidad", en: "Exchange sacrifice" },
    "gambit": { es: "Gambito", en: "Gambit" },
    "initiative": { es: "Iniciativa", en: "Initiative" },
    "king-hunt": { es: "Cacería de rey", en: "King hunt" },
    "king-walk": { es: "Marcha de rey", en: "King walk" },
    "man-vs-machine": { es: "Hombre contra máquina", en: "Man vs machine" },
    "mating-net": { es: "Red de mate", en: "Mating net" },
    "miniature": { es: "Miniatura", en: "Miniature" },
    "opening-trap": { es: "Trampa de apertura", en: "Opening trap" },
    "pawn-storm": { es: "Avalancha de peones", en: "Pawn storm" },
    "piece-sacrifice": { es: "Sacrificio de pieza", en: "Piece sacrifice" },
    "positional": { es: "Juego posicional", en: "Positional play" },
    "prophylaxis": { es: "Profilaxis", en: "Prophylaxis" },
    "queen-sacrifice": { es: "Sacrificio de dama", en: "Queen sacrifice" },
    "romantic": { es: "Ajedrez romántico", en: "Romantic chess" },
    "space": { es: "Ventaja de espacio", en: "Space advantage" },
    "tactics": { es: "Táctica", en: "Tactics" },
    "zugzwang": { es: "Zugzwang", en: "Zugzwang" },
  };

  const KIND_TEXT = {
    "only-move": {
      label: { es: "Única jugada", en: "Only move" },
      hint: { es: "Las alternativas son claramente peores: una sola jugada saca lo mejor de la posición.", en: "The alternatives are clearly worse: one move gets the most out of the position." },
    },
    "tactic": {
      label: { es: "Táctica", en: "Tactic" },
      hint: { es: "Una combinación con jaques, capturas o amenazas directas.", en: "A combination built on checks, captures or direct threats." },
    },
    "sacrifice": {
      label: { es: "Sacrificio", en: "Sacrifice" },
      hint: { es: "Se entrega material a cambio de un ataque o de una ventaja mayor.", en: "Material is given up for an attack or a bigger advantage." },
    },
    "quiet": {
      label: { es: "Jugada tranquila", en: "Quiet move" },
      hint: { es: "Una decisión posicional sin capturas ni jaques inmediatos.", en: "A positional decision without immediate captures or checks." },
    },
    "endgame": {
      label: { es: "Final", en: "Endgame" },
      hint: { es: "Poco material en el tablero: cada tiempo cuenta.", en: "Little material on the board: every tempo counts." },
    },
    "opening": {
      label: { es: "Apertura", en: "Opening" },
      hint: { es: "Una decisión temprana de desarrollo o de estructura.", en: "An early decision about development or structure." },
    },
  };

  const DIFFICULTY_TEXT = {
    1: { es: "Fácil", en: "Easy" },
    2: { es: "Media", en: "Medium" },
    3: { es: "Difícil", en: "Hard" },
  };

  const PLAYING_TEXT = {
    w: { es: "Jugás con las blancas", en: "You play White" },
    b: { es: "Jugás con las negras", en: "You play Black" },
  };

  // ---------------------------------------------------------------- i18n

  let i18nRegistered = false;

  // Registered lazily (and again on load) because the order of module loading
  // is only guaranteed for js/ludus.js. Keys: cdata.kind.*, cdata.kindHint.*,
  // cdata.theme.*, cdata.difficulty.*, cdata.playing.*
  function registerI18n() {
    if (i18nRegistered) return;
    const i18n = root.Ludus && root.Ludus.i18n;
    if (!i18n || typeof i18n.register !== "function") return;
    const es = {};
    const en = {};
    KINDS.forEach((kind) => {
      es[`cdata.kind.${kind}`] = KIND_TEXT[kind].label.es;
      en[`cdata.kind.${kind}`] = KIND_TEXT[kind].label.en;
      es[`cdata.kindHint.${kind}`] = KIND_TEXT[kind].hint.es;
      en[`cdata.kindHint.${kind}`] = KIND_TEXT[kind].hint.en;
    });
    Object.keys(THEMES).forEach((id) => {
      es[`cdata.theme.${id}`] = THEMES[id].es;
      en[`cdata.theme.${id}`] = THEMES[id].en;
    });
    Object.keys(DIFFICULTY_TEXT).forEach((n) => {
      es[`cdata.difficulty.${n}`] = DIFFICULTY_TEXT[n].es;
      en[`cdata.difficulty.${n}`] = DIFFICULTY_TEXT[n].en;
    });
    Object.keys(PLAYING_TEXT).forEach((side) => {
      es[`cdata.playing.${side}`] = PLAYING_TEXT[side].es;
      en[`cdata.playing.${side}`] = PLAYING_TEXT[side].en;
    });
    i18n.register({ es, en });
    i18nRegistered = true;
  }

  function currentLang() {
    try {
      const i18n = root.Ludus && root.Ludus.i18n;
      const lang = i18n && typeof i18n.lang === "function" ? i18n.lang() : "es";
      return lang === "en" ? "en" : "es";
    } catch (error) {
      return "es";
    }
  }

  function pickLang(text, lang) {
    const l = lang === "en" ? "en" : lang === "es" ? "es" : currentLang();
    return text[l] || text.es;
  }

  function kindLabel(kind, lang) {
    return KIND_TEXT[kind] ? pickLang(KIND_TEXT[kind].label, lang) : String(kind || "");
  }

  function kindHint(kind, lang) {
    return KIND_TEXT[kind] ? pickLang(KIND_TEXT[kind].hint, lang) : "";
  }

  function themeLabel(id, lang) {
    return THEMES[id] ? pickLang(THEMES[id], lang) : String(id || "");
  }

  function difficultyLabel(n, lang) {
    return DIFFICULTY_TEXT[n] ? pickLang(DIFFICULTY_TEXT[n], lang) : "";
  }

  function playingLabel(side, lang) {
    return PLAYING_TEXT[side] ? pickLang(PLAYING_TEXT[side], lang) : "";
  }

  // The data keeps the raw PGN tags ("Garry Kasparov", "Casual game": stable keys that stored notebook cards also carry);
  // notes.json "names" / "events" hold their es/en display forms, one spelling per person and event in each language.
  // Anything unknown (a person's own games, or the data not being loaded yet) comes back unchanged.
  function displayForm(tableKey, raw, lang) {
    const text = String(raw === undefined || raw === null ? "" : raw);
    const p = prepare();
    const table = p && p.source[tableKey];
    const entry = table && Object.prototype.hasOwnProperty.call(table, text) ? table[text] : null;
    return entry ? pickLang(entry, lang) : text;
  }

  function displayName(raw, lang) {
    return displayForm("names", raw, lang);
  }

  function displayEvent(raw, lang) {
    return displayForm("events", raw, lang);
  }

  // ------------------------------------------------------- quoted moves in texts

  // Blurbs and moment notes quote moves ("15.Bxh7+ Kxh7 16.Qxh5+", "34...Kf2+"). Each language spells the pieces its own
  // way in the stored text (es: R rey, D dama, T torre, A alfil, C caballo; en: K Q R B N), so the Spanish page reads right
  // without any help. A person who chose another notation in Settings gets the quotes re-spelled by localizeQuotedMoves.
  const ES_TO_EN_LETTER = { R: "K", D: "Q", T: "R", A: "B", C: "N" };
  const QUOTED_MOVE = /^(?:O-O-O|O-O|[KQRBNDTAC]?[a-h]?[1-8]?x?[a-h][1-8](?:=[KQRBNDTAC])?)[+#]?[!?]{0,2}$/;

  // The runs of quoted moves in a text: [{ ply, words: [{ text, start, end }] }]. A run starts at a move number ("15." for
  // White, "15..." for Black) and goes on while the next words are moves (with or without their own number). `ply` is the
  // 0-based index of the run's first move in the game. `text` of a word is the move as written, annotations included.
  function quotedMoveRuns(text) {
    const source = String(text === undefined || text === null ? "" : text);
    const runs = [];
    const anchor = /(?<![A-Za-z0-9])(\d{1,3})(\.{1,3})(?=[KQRBNDTACOa-h])/g;
    let found = anchor.exec(source);
    while (found) {
      const words = [];
      let cursor = found.index;
      let ply = 2 * (Number(found[1]) - 1) + (found[2].length === 3 ? 1 : 0);
      const firstPly = ply;
      let consistent = true;
      while (cursor < source.length) {
        const word = /^\S+/.exec(source.slice(cursor));
        if (!word) break;
        let body = word[0];
        let offset = cursor;
        const numbered = /^(\d{1,3})(\.{1,3})(.+)$/.exec(body);
        if (numbered) {
          if (2 * (Number(numbered[1]) - 1) + (numbered[2].length === 3 ? 1 : 0) !== ply) consistent = false;
          offset += numbered[1].length + numbered[2].length;
          body = numbered[3];
        } else if (!words.length) {
          break;
        }
        const core = body.replace(/[.,;:)»”"]+$/, "");
        if (!QUOTED_MOVE.test(core)) break;
        words.push({ text: core, start: offset, end: offset + core.length });
        ply += 1;
        if (core.length !== body.length) break; // punctuation after a move closes the run
        cursor += word[0].length;
        while (/\s/.test(source[cursor] || "")) cursor += 1;
      }
      if (words.length && consistent) runs.push({ ply: firstPly, words });
      anchor.lastIndex = Math.max(anchor.lastIndex, cursor);
      found = anchor.exec(source);
    }
    return runs;
  }

  function englishSan(word, textLang) {
    if (textLang !== "es") return word;
    return word.replace(/^[RDTAC]/, (letter) => ES_TO_EN_LETTER[letter]).replace(/=([RDTAC])/, (match, letter) => `=${ES_TO_EN_LETTER[letter]}`);
  }

  // `textLang` is the language the text was written in ("es" | "en"). The moves come out as Ludus.chess.localizeSan would
  // write them for the current notation setting (auto = the language of the page). Without that helper the text is unchanged.
  function localizeQuotedMoves(text, textLang, options) {
    const source = String(text === undefined || text === null ? "" : text);
    const chess = root.Ludus && root.Ludus.chess;
    if (!chess || typeof chess.localizeSan !== "function") return source;
    const from = textLang === "es" ? "es" : "en";
    const lang = options && options.lang ? options.lang : currentLang();
    let out = "";
    let last = 0;
    quotedMoveRuns(source).forEach((run) => {
      run.words.forEach((word) => {
        out += source.slice(last, word.start) + chess.localizeSan(englishSan(word.text, from), lang, options);
        last = word.end;
      });
    });
    return out + source.slice(last);
  }

  // ---------------------------------------------------------------- data

  let prepared = null; // { source, byId, list, all }
  let loadPromise = null;

  function rawData() {
    const data = root.Ludus && root.Ludus.ClassicsData;
    return data && typeof data === "object" && Array.isArray(data.games) ? data : null;
  }

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach((key) => deepFreeze(value[key]));
    }
    return value;
  }

  function sideOfFen(fen) {
    return String(fen).split(" ")[1] === "b" ? "b" : "w";
  }

  // Validates the shape cheaply and builds the indexes. Returns null (and
  // leaves the library empty) when the data is missing or from another version.
  function prepare() {
    const data = rawData();
    if (!data) {
      prepared = null;
      return null;
    }
    if (prepared && prepared.source === data) return prepared;
    if (data.v !== DATA_VERSION) {
      prepared = null;
      return null;
    }
    deepFreeze(data);
    const byId = new Map();
    const all = [];
    data.games.forEach((game) => {
      if (!game || typeof game.id !== "string" || !Array.isArray(game.moves) || !Array.isArray(game.positions)) return;
      if (byId.has(game.id)) return;
      byId.set(game.id, game);
      game.positions.forEach((pos) => {
        if (pos && typeof pos.fen === "string" && Array.isArray(pos.lines) && pos.lines.length) all.push({ game, pos });
      });
    });
    // A stable order that does not depend on how the data file happens to be sorted.
    all.sort((a, b) => (a.game.id < b.game.id ? -1 : a.game.id > b.game.id ? 1 : a.pos.ply - b.pos.ply));
    prepared = { source: data, byId, all, story: new Map() };
    return prepared;
  }

  function load() {
    registerI18n();
    if (prepare()) return Promise.resolve(rawData());
    if (loadPromise) return loadPromise;
    const util = root.Ludus && root.Ludus.util;
    let attempt;
    if (typeof require === "function" && !(root.document && util && typeof util.loadScript === "function")) {
      // Node (tests, build tooling): the data file is a plain UMD-lite script.
      attempt = new Promise((resolve, reject) => {
        try {
          require("./data/classics.data.js");
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    } else if (util && typeof util.loadScript === "function") {
      attempt = util.loadScript(DATA_PATH);
    } else {
      attempt = Promise.reject(new Error("Classics.load: no way to load the data file"));
    }
    loadPromise = attempt.then(() => {
      if (!prepare()) throw new Error("Classics.load: data file loaded but it is empty or from another version");
      return rawData();
    }).catch((error) => {
      loadPromise = null; // allow a retry (offline, flaky network)
      throw error;
    });
    return loadPromise;
  }

  function isLoaded() {
    return Boolean(prepare());
  }

  // -------------------------------------------------------------- queries

  function metaOf(game) {
    const kinds = {};
    game.positions.forEach((p) => {
      kinds[p.kind] = (kinds[p.kind] || 0) + 1;
    });
    const shown = (tableKey, raw) => ({ es: displayForm(tableKey, raw, "es"), en: displayForm(tableKey, raw, "en") });
    return {
      id: game.id,
      title: game.title,
      white: game.white,
      black: game.black,
      event: game.event,
      site: game.site,
      display: { white: shown("names", game.white), black: shown("names", game.black), event: shown("events", game.event) },
      year: game.year,
      date: game.date,
      result: game.result,
      eco: game.eco,
      opening: game.opening,
      blurb: game.blurb,
      themes: game.themes,
      difficulty: game.difficulty,
      protagonist: game.protagonist,
      plies: game.moves.length,
      positionCount: game.positions.length,
      kinds,
    };
  }

  function list() {
    const p = prepare();
    if (!p) return [];
    return p.source.games.filter((g) => p.byId.get(g.id) === g).map(metaOf);
  }

  function get(id) {
    const p = prepare();
    return p ? p.byId.get(String(id)) || null : null;
  }

  function formatEval(score, lang) {
    const scoring = root.Ludus && root.Ludus.Scoring;
    if (scoring && typeof scoring.formatEval === "function") {
      try {
        return scoring.formatEval(score, lang || currentLang());
      } catch (error) {
        // fall through to the local formatter
      }
    }
    if (Math.abs(score) >= 50000) {
      const n = Math.round((100000 - Math.abs(score)) / 1000);
      return `${score < 0 ? "-" : ""}M${n}`;
    }
    const pawns = (score / 100).toFixed(2);
    return score > 0 ? `+${pawns}` : pawns;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // Builds a Position (docs/ARCHITECTURE.md section 9) from a stored training position.
  function toPosition(game, pos) {
    const util = root.Ludus && root.Ludus.util;
    const hash = util && typeof util.hashString === "function" ? util.hashString(pos.fen) : String(pos.ply);
    const best = pos.lines[0];
    const lossCp = Math.max(0, Math.min(2500, best.score - pos.ms));
    const position = {
      id: `classic:${hash}`,
      fen: pos.fen,
      source: "classic",
      meta: {
        players: `${game.white} vs ${game.black}`,
        event: game.event,
        year: String(game.year),
        site: game.site,
        eco: game.eco,
        result: game.result,
        moveNumber: Math.floor(pos.ply / 2) + 1,
        sideToMove: sideOfFen(pos.fen),
      },
      gameMoveUci: pos.uci,
      gameMoveSan: pos.san,
      gameEvalText: formatEval(pos.ms),
      bestMoveUci: best.uci,
      bestMoveSan: best.san,
      bestEvalText: formatEval(best.score),
      lossCp,
      phase: pos.phase,
      reference: {
        depth: rawData().depth || 18,
        lines: clone(pos.lines),
        origin: "precomputed",
      },
      classic: {
        gameId: game.id,
        ply: pos.ply,
        kind: pos.kind,
        difficulty: pos.difficulty,
      },
      tags: [pos.kind],
    };
    if (pos.note) position.classic.note = { es: pos.note.es, en: pos.note.en };
    return position;
  }

  function makeRandom(options) {
    if (options && typeof options.random === "function") return options.random;
    return Math.random;
  }

  function shuffled(items, random) {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.min(i, Math.floor(random() * (i + 1)));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  // `count` items spread evenly over the list (keeps the game's story arc).
  function spread(items, count) {
    if (count >= items.length) return items.slice();
    const out = [];
    for (let i = 0; i < count; i += 1) out.push(items[Math.floor(((i + 0.5) * items.length) / count)]);
    return out;
  }

  function cleanCount(count, fallback) {
    const n = Number(count);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.min(MAX_COUNT, Math.floor(n));
  }

  // A forced mate in one is a fine finish for a game story but a poor challenge on its
  // own, so random() and daily() leave those out unless includeTrivial is set.
  function isTrivial(pos) {
    return pos.lines[0].score >= 99000;
  }

  function cleanMaxDifficulty(value) {
    const n = Number(value);
    return n >= 1 && n <= 3 ? Math.floor(n) : 3;
  }

  // Positions of one game, chronologically (or shuffled), as Position objects.
  // side: "w" | "b" (default: every stored position, i.e. the protagonist's).
  function positions(gameId, options) {
    const opts = options || {};
    const p = prepare();
    const game = p ? p.byId.get(String(gameId)) : null;
    if (!game) return [];
    const maxDifficulty = cleanMaxDifficulty(opts.maxDifficulty);
    let items = game.positions.filter((pos) => pos.difficulty <= maxDifficulty && pos.lines.length);
    if (opts.side === "w" || opts.side === "b") items = items.filter((pos) => sideOfFen(pos.fen) === opts.side);
    const wanted = cleanCount(opts.count, items.length);
    if (opts.shuffle) items = shuffled(items, makeRandom(opts)).slice(0, wanted);
    else items = spread(items, wanted);
    return items.map((pos) => toPosition(game, pos));
  }

  function excludedSet(exclude) {
    if (!exclude) return new Set();
    return new Set(Array.isArray(exclude) ? exclude : exclude instanceof Set ? [...exclude] : []);
  }

  // A mix across games: round-robin over a shuffled list of games so no game
  // dominates. exclude: position ids and/or game ids to skip.
  function random(count, options) {
    const opts = options || {};
    const p = prepare();
    if (!p) return [];
    const rnd = makeRandom(opts);
    const maxDifficulty = cleanMaxDifficulty(opts.maxDifficulty);
    const skip = excludedSet(opts.exclude);
    const onlyGames = Array.isArray(opts.gameIds) && opts.gameIds.length ? new Set(opts.gameIds) : null;
    const buckets = [];
    p.source.games.forEach((game) => {
      if (p.byId.get(game.id) !== game || skip.has(game.id) || (onlyGames && !onlyGames.has(game.id))) return;
      const items = game.positions
        .filter((pos) => pos.difficulty <= maxDifficulty && pos.lines.length && (opts.includeTrivial || !isTrivial(pos)))
        .map((pos) => ({ game, pos, id: `classic:${root.Ludus.util.hashString(pos.fen)}` }))
        .filter((item) => !skip.has(item.id));
      if (items.length) buckets.push(shuffled(items, rnd));
    });
    const order = shuffled(buckets, rnd);
    const wanted = cleanCount(count, 10);
    const picked = [];
    let round = 0;
    while (picked.length < wanted) {
      let any = false;
      for (const bucket of order) {
        if (picked.length >= wanted) break;
        if (round < bucket.length) {
          picked.push(bucket[round]);
          any = true;
        }
      }
      if (!any) break;
      round += 1;
    }
    return picked.map((item) => toPosition(item.game, item.pos));
  }

  // 32-bit FNV-1a: only used to seed a shuffle, so it must be stable across platforms.
  function seedFrom(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // The same date key always gives the same position, and any N consecutive
  // calendar days (N = number of eligible positions) never repeat. Keys that
  // are not "YYYY-MM-DD" fall back to a hash.
  function daily(dateKey, options) {
    const opts = options || {};
    const p = prepare();
    if (!p) return null;
    const maxDifficulty = cleanMaxDifficulty(opts.maxDifficulty);
    const eligible = p.all.filter((item) => item.pos.difficulty <= maxDifficulty && (opts.includeTrivial || !isTrivial(item.pos)));
    if (!eligible.length) return null;
    const key = String(dateKey === undefined || dateKey === null ? "" : dateKey).trim();
    const order = shuffled(eligible, mulberry32(seedFrom("ludus-classics-daily-v1")));
    let index;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (match) {
      const days = Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
      index = ((days % order.length) + order.length) % order.length;
    } else {
      index = seedFrom(`ludus-classics-daily-key:${key}`) % order.length;
    }
    const item = order[index];
    return toPosition(item.game, item.pos);
  }

  // ---------------------------------------------------------- game story

  function chessApi() {
    const chess = root.Ludus && root.Ludus.chess;
    if (!chess || !chess.Chess) throw new Error("Classics.story needs Ludus.chess (load js/chess.js first)");
    return chess;
  }

  // The whole game as a list of plies with the position before/after each move,
  // ready for a "replay the game" view. Moments and training positions are
  // flagged on the ply they belong to.
  function story(gameId) {
    const p = prepare();
    const game = p ? p.byId.get(String(gameId)) : null;
    if (!game) return null;
    if (p.story.has(game.id)) return p.story.get(game.id);
    const { Chess, sanToMove } = chessApi();
    const chess = new Chess();
    const byPly = new Map(game.positions.map((pos) => [pos.ply, pos]));
    const plies = [];
    for (let i = 0; i < game.moves.length; i += 1) {
      const move = sanToMove(game.moves[i], chess);
      if (!move) throw new Error(`Classics.story: ${game.id} has an illegal move at ply ${i}`);
      const fenBefore = chess.fen();
      chess.makeMove(move);
      const pos = byPly.get(i);
      const entry = {
        ply: i,
        moveNumber: Math.floor(i / 2) + 1,
        color: i % 2 === 0 ? "w" : "b",
        san: game.moves[i],
        fenBefore,
        fen: chess.fen(),
        training: Boolean(pos),
        kind: pos ? pos.kind : null,
        note: pos && pos.note ? pos.note : null,
      };
      plies.push(entry);
    }
    const result = Object.freeze({
      id: game.id,
      title: game.title,
      blurb: game.blurb,
      white: game.white,
      black: game.black,
      result: game.result,
      protagonist: game.protagonist,
      startFen: Chess.START_FEN,
      plies: Object.freeze(plies.map((e) => Object.freeze(e))),
    });
    p.story.set(game.id, result);
    return result;
  }

  // "1. e4 e5 2. Nf3 ..." for display or copy to clipboard.
  function movesText(gameId, upToPly) {
    const game = get(gameId);
    if (!game) return "";
    const limit = Number.isFinite(upToPly) ? Math.max(0, Math.min(game.moves.length, upToPly)) : game.moves.length;
    let text = "";
    for (let i = 0; i < limit; i += 1) text += `${i % 2 === 0 ? `${i / 2 + 1}. ` : ""}${game.moves[i]} `;
    return text.trim();
  }

  return {
    DATA_PATH,
    KINDS: KINDS.slice(),
    THEMES: Object.freeze(Object.keys(THEMES)),
    load,
    isLoaded,
    list,
    get,
    positions,
    random,
    daily,
    story,
    movesText,
    kindLabel,
    kindHint,
    themeLabel,
    difficultyLabel,
    playingLabel,
    displayName,
    displayEvent,
    quotedMoveRuns,
    localizeQuotedMoves,
    registerI18n,
  };
});
