// Persisted settings. Contract: docs/ARCHITECTURE.md section 10.
//
//   Ludus.Settings.get(path?)            value, group object, or the whole tree
//   Ludus.Settings.set(path, value)      validated / clamped; false when rejected
//   Ludus.Settings.reset(pathPrefix?)    one path, one group, or everything
//   Ludus.Settings.onChange([path], fn)  -> off()   (also: bus "settings:changed")
//   Ludus.Settings.scoringSettings()     -> Scoring.normalizeSettings() shape
//   Ludus.Settings.engineBudget()        -> { movetimeMs, multiPv }
//   Ludus.Settings.applyToDocument()     data-board-theme, data-contrast, data-motion, --text-scale
//   Ludus.Settings.schema / groups       what the settings screen renders generically
//
// Storage: "ludus.settings.v2" = { v: 2, values: { "<path>": value } } (a flat
// map: only known paths are ever read back, so a hostile or stale blob cannot
// smuggle in anything else). The legacy "ludus.setup.v1" key ({ turnTimeSeconds })
// is migrated once into clock.seconds when no v2 blob exists; the legacy key is
// left in place because app.js still reads it.
//
// The module keeps no DOM or storage access at load time: everything is looked
// up when a function is called, and `Settings.create({ storage, bus, doc })`
// builds an isolated instance for tests.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Settings = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const STORAGE_KEY = "ludus.settings.v2";
  const LEGACY_SETUP_KEY = "ludus.setup.v1";
  const VERSION = 2;
  const ABSENT = Object.freeze({}); // storage.get() fallback that cannot be a stored value

  // Paths the audio module may spell differently; both resolve to one setting.
  const ALIASES = Object.freeze({ "sound.haptics": "haptics" });

  // Engine strength presets (ms per position). "custom" uses engine.movetimeMs.
  const ENGINE_PRESET_MS = Object.freeze({ fast: 700, balanced: 1500, deep: 4000 });
  // Loss (centipawns) above which an own-game move counts as a mistake.
  const MISTAKE_THRESHOLD_CP = Object.freeze({ high: 50, standard: 80, low: 150 });
  // Only used when Ludus.Scoring is not loaded (it owns the real defaults).
  const HINT_COST_FALLBACK = Object.freeze({ level1: 0.15, level2: 0.35, reveal: 1 });

  const GROUP_IDS = Object.freeze(["board", "sound", "clock", "engine", "scoring", "hints", "mistakes", "a11y"]);

  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const noop = () => {};

  // ---------- Schema ----------
  //
  // Every entry: { path, group, type: "boolean" | "enum" | "number", default,
  //   labelKey, hintKey, options?: [{ value, labelKey }], min?, max?, step?,
  //   unit?, displayScale?, showWhen?: { path, value } }
  // The i18n keys follow one rule so a screen never has to guess:
  //   settings.<path>.label / settings.<path>.hint
  //   settings.<path>.option.<value>      (a "." in the value becomes "_": 1.15 -> 1_15)

  function optionKey(path, value) {
    return `settings.${path}.option.${String(value).replace(/\./g, "_")}`;
  }

  function entry(group, path, type, defaultValue, extra) {
    const spec = Object.assign({ path, group, type, default: defaultValue }, extra || {});
    spec.labelKey = `settings.${path}.label`;
    spec.hintKey = `settings.${path}.hint`;
    if (type === "enum") {
      spec.options = Object.freeze(spec.options.map((value) => Object.freeze({ value, labelKey: optionKey(path, value) })));
    }
    if (spec.showWhen) spec.showWhen = Object.freeze(Object.assign({}, spec.showWhen));
    return Object.freeze(spec);
  }

  const SCHEMA = Object.freeze([
    entry("board", "board.theme", "enum", "walnut", { options: ["walnut", "classic", "ocean", "forest", "slate", "contrast"] }),
    entry("board", "board.coords", "boolean", true),
    entry("board", "board.legalDots", "boolean", true),
    entry("board", "board.lastMove", "boolean", true),
    entry("board", "board.animation", "enum", "auto", { options: ["auto", "on", "off"] }),
    entry("board", "board.drag", "boolean", true),
    // Piece letters in written moves (Ludus.chess.localizeSan reads it): "auto" follows the language.
    entry("board", "notation.style", "enum", "auto", { options: ["auto", "english", "spanish"] }),
    entry("sound", "sound.enabled", "boolean", true),
    entry("sound", "sound.volume", "number", 0.5, { min: 0, max: 1, step: 0.05, unit: "%", displayScale: 100, showWhen: { path: "sound.enabled", value: true } }),
    entry("sound", "haptics", "boolean", true),
    entry("clock", "clock.mode", "enum", "timed", { options: ["timed", "untimed"] }),
    entry("clock", "clock.seconds", "number", 90, { min: 5, max: 360, step: 1, unit: "s", showWhen: { path: "clock.mode", value: "timed" } }),
    entry("engine", "engine.strength", "enum", "balanced", { options: ["fast", "balanced", "deep", "custom"] }),
    entry("engine", "engine.movetimeMs", "number", 1500, { min: 300, max: 10000, step: 100, unit: "ms", showWhen: { path: "engine.strength", value: "custom" } }),
    entry("engine", "engine.multiPv", "number", 3, { min: 1, max: 5, step: 1 }),
    entry("scoring", "scoring.model", "enum", "precision", { options: ["precision", "tiers"] }),
    entry("scoring", "scoring.strictness", "enum", "standard", { options: ["relaxed", "standard", "strict"] }),
    entry("scoring", "scoring.bestMode", "enum", "band", { options: ["engine", "band", "masters"] }),
    entry("scoring", "scoring.tolerancePct", "number", 1, { min: 0, max: 5, step: 0.1, unit: "%" }),
    entry("hints", "hints.enabled", "boolean", true),
    entry("mistakes", "mistakes.sensitivity", "enum", "standard", { options: ["high", "standard", "low"] }),
    entry("a11y", "a11y.textScale", "enum", 1, { options: [1, 1.15, 1.3] }),
    entry("a11y", "a11y.contrast", "enum", "normal", { options: ["normal", "high"] }),
    entry("a11y", "a11y.motion", "enum", "auto", { options: ["auto", "reduce"] }),
  ]);

  const BY_PATH = new Map(SCHEMA.map((spec) => [spec.path, spec]));

  const GROUPS = Object.freeze(GROUP_IDS.map((id) => Object.freeze({
    id,
    labelKey: `settings.group.${id}`,
    hintKey: `settings.group.${id}.hint`,
  })));

  // ---------- Validation ----------

  const BAD = Object.freeze({ ok: false });
  const good = (value) => ({ ok: true, value });

  function decimalsOf(number) {
    const text = String(number);
    const dot = text.indexOf(".");
    return dot === -1 ? 0 : text.length - dot - 1;
  }

  function snapNumber(value, spec) {
    const clamped = Math.min(spec.max, Math.max(spec.min, value));
    if (!(spec.step > 0)) return clamped;
    const steps = Math.round((clamped - spec.min) / spec.step);
    const snapped = spec.min + steps * spec.step;
    const decimals = Math.max(decimalsOf(spec.step), decimalsOf(spec.min));
    return Math.min(spec.max, Math.max(spec.min, Number(snapped.toFixed(decimals))));
  }

  // Numbers may arrive as numeric strings (an <input> value); anything else
  // that is not a finite number is refused rather than guessed.
  function toFiniteNumber(input) {
    if (typeof input === "number") return Number.isFinite(input) ? input : NaN;
    if (typeof input === "string" && input.trim() !== "") {
      const parsed = Number(input);
      return Number.isFinite(parsed) ? parsed : NaN;
    }
    return NaN;
  }

  function validateEntry(spec, input) {
    if (spec.type === "boolean") {
      return typeof input === "boolean" ? good(input) : BAD;
    }
    if (spec.type === "enum") {
      const numeric = typeof spec.default === "number";
      const wanted = numeric ? toFiniteNumber(input) : input;
      if (numeric && Number.isNaN(wanted)) return BAD;
      const match = spec.options.find((option) => (
        numeric ? Math.abs(option.value - wanted) < 1e-9 : option.value === wanted
      ));
      return match ? good(match.value) : BAD;
    }
    if (spec.type === "number") {
      const number = toFiniteNumber(input);
      return Number.isNaN(number) ? BAD : good(snapNumber(number, spec));
    }
    return BAD;
  }

  function resolvePath(path) {
    if (typeof path !== "string") return null;
    const key = hasOwn(ALIASES, path) ? ALIASES[path] : path;
    return BY_PATH.get(key) || null;
  }

  // Public, pure: { ok, value } where value is the clamped / snapped result.
  function validate(path, value) {
    const spec = resolvePath(path);
    if (!spec) return { ok: false, reason: "unknown-path" };
    const result = validateEntry(spec, value);
    return result.ok ? { ok: true, value: result.value } : { ok: false, reason: "invalid-value" };
  }

  // ---------- Defaults, nesting ----------

  function nest(getValue) {
    const tree = {};
    SCHEMA.forEach((spec) => {
      const parts = spec.path.split(".");
      let node = tree;
      for (let i = 0; i < parts.length - 1; i += 1) {
        if (!hasOwn(node, parts[i])) node[parts[i]] = {};
        node = node[parts[i]];
      }
      node[parts[parts.length - 1]] = getValue(spec);
    });
    return tree;
  }

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach((key) => deepFreeze(value[key]));
    }
    return value;
  }

  const DEFAULTS = deepFreeze(nest((spec) => spec.default));

  // A path is "under" a prefix when it is that path, starts with "<prefix>.", or
  // belongs to the group of that name (haptics is in the "sound" group although
  // its path has no "sound." in front).
  function isUnder(spec, prefix) {
    return spec.path === prefix || spec.path.startsWith(`${prefix}.`) || spec.group === prefix;
  }

  function pathsUnder(prefix) {
    if (prefix === undefined || prefix === null || prefix === "") return SCHEMA.map((spec) => spec.path);
    if (typeof prefix !== "string") return [];
    const key = hasOwn(ALIASES, prefix) ? ALIASES[prefix] : prefix;
    if (BY_PATH.has(key)) return [key];
    return SCHEMA.filter((spec) => isUnder(spec, key)).map((spec) => spec.path);
  }

  // ---------- i18n ----------

  // label + hint per path, then labels of the enum options. [es, en].
  const TEXT = {
    "board.theme": [["Tema del tablero", "Board theme"], ["Elegí los colores de las casillas y las piezas.", "Choose the colors of the squares and pieces."]],
    "board.coords": [["Mostrar coordenadas", "Show coordinates"], ["Letras y números en los bordes del tablero.", "Files and ranks along the board edges."]],
    "board.legalDots": [["Marcar jugadas legales", "Show legal moves"], ["Puntos sobre las casillas a las que puede ir la pieza elegida.", "Dots on the squares the selected piece can move to."]],
    "board.lastMove": [["Resaltar la última jugada", "Highlight the last move"], ["Pinta el origen y el destino de la última jugada.", "Tints the origin and destination of the last move."]],
    "board.animation": [["Animación de piezas", "Piece animation"], ["Automática respeta la configuración de tu sistema.", "Automatic follows your system setting."]],
    "board.drag": [["Arrastrar piezas", "Drag pieces"], ["Además de tocar origen y destino, podés arrastrar la pieza.", "Besides tapping origin and destination, you can drag the piece."]],
    "notation.style": [["Letras de las piezas", "Piece letters"], ["Cómo se escriben las jugadas. Automático sigue el idioma: en español la R es el rey, la D la dama, la T la torre, la A el alfil y la C el caballo.", "How moves are written. Automatic follows the language: in Spanish notation R is the king, D the queen, T the rook, A the bishop and C the knight."]],
    "sound.enabled": [["Sonidos", "Sounds"], ["Efectos al mover, capturar y acertar.", "Effects for moves, captures and good answers."]],
    "sound.volume": [["Volumen", "Volume"], ["Qué tan fuertes suenan los efectos.", "How loud the effects are."]],
    "haptics": [["Vibración", "Vibration"], ["Vibración corta en celulares compatibles.", "A short vibration on supported phones."]],
    "clock.mode": [["Reloj por jugada", "Move clock"], ["Con tiempo, cada posición tiene un límite; sin tiempo, pensás tranquilo.", "Timed gives each position a limit; untimed lets you think freely."]],
    "clock.seconds": [["Segundos por jugada", "Seconds per move"], ["Cuánto tiempo tenés para elegir tu jugada.", "How long you have to choose your move."]],
    "engine.strength": [["Profundidad del análisis", "Analysis depth"], ["Más profundo es más preciso, pero tarda más en cada posición.", "Deeper is more accurate but takes longer per position."]],
    "engine.movetimeMs": [["Tiempo de análisis", "Analysis time"], ["Milisegundos que el motor piensa en cada posición.", "Milliseconds the engine thinks on each position."]],
    "engine.multiPv": [["Jugadas candidatas", "Candidate moves"], ["Cuántas líneas compara el motor; con más se detectan mejor las jugadas únicas.", "How many lines the engine compares; more helps spot only-moves."]],
    "scoring.model": [["Modelo de puntaje", "Scoring model"], ["Precisión da puntos según qué tan cerca estuvo tu jugada; por niveles da puntos fijos por categoría.", "Precision scores how close your move was; tiers gives fixed points per category."]],
    "scoring.strictness": [["Exigencia", "Strictness"], ["Qué tanto castiga alejarse de la mejor jugada.", "How harshly moving away from the best move is punished."]],
    "scoring.bestMode": [["Qué cuenta como mejor jugada", "What counts as the best move"], ["Elegí si solo vale la jugada del motor o también las equivalentes y la de los maestros.", "Choose whether only the engine's move counts or also equivalent moves and the masters' move."]],
    "scoring.tolerancePct": [["Tolerancia de equivalencia", "Equivalence tolerance"], ["Las jugadas que pierden menos probabilidad de ganar que esto cuentan como la mejor.", "Moves that lose less win probability than this count as the best."]],
    "hints.enabled": [["Pistas", "Hints"], ["Permiten ver ayuda a cambio de puntos.", "Let you see help in exchange for points."]],
    "mistakes.sensitivity": [["Sensibilidad de errores", "Mistake sensitivity"], ["Qué tan grande tiene que ser la pérdida para que cuente como error en tus partidas.", "How large a loss must be to count as a mistake in your games."]],
    "a11y.textScale": [["Tamaño del texto", "Text size"], ["Agranda el texto de toda la app.", "Makes all text in the app larger."]],
    "a11y.contrast": [["Contraste", "Contrast"], ["Refuerza bordes y colores para leer mejor.", "Strengthens borders and colors for easier reading."]],
    "a11y.motion": [["Movimiento", "Motion"], ["Reducir quita animaciones y transiciones.", "Reduce removes animations and transitions."]],
  };

  const OPTION_TEXT = {
    "board.theme": {
      walnut: ["Nogal", "Walnut"], classic: ["Clásico", "Classic"], ocean: ["Océano", "Ocean"],
      forest: ["Bosque", "Forest"], slate: ["Pizarra", "Slate"], contrast: ["Alto contraste", "High contrast"],
    },
    "board.animation": { auto: ["Automática", "Automatic"], on: ["Activada", "On"], off: ["Desactivada", "Off"] },
    "notation.style": { auto: ["Según el idioma", "Follow the language"], english: ["Inglesas (K Q R B N)", "English (K Q R B N)"], spanish: ["Españolas (R D T A C)", "Spanish (R D T A C)"] },
    "clock.mode": { timed: ["Con tiempo", "Timed"], untimed: ["Sin tiempo", "Untimed"] },
    "engine.strength": {
      fast: ["Rápido", "Fast"], balanced: ["Equilibrado", "Balanced"], deep: ["Profundo", "Deep"], custom: ["Personalizado", "Custom"],
    },
    "scoring.model": { precision: ["Precisión", "Precision"], tiers: ["Por niveles", "Tiers"] },
    "scoring.strictness": { relaxed: ["Relajada", "Relaxed"], standard: ["Estándar", "Standard"], strict: ["Estricta", "Strict"] },
    "scoring.bestMode": {
      engine: ["Solo la del motor", "Engine's move only"],
      band: ["Cualquiera equivalente", "Any equivalent move"],
      masters: ["Equivalentes y la de los maestros", "Equivalent moves and the masters' move"],
    },
    "mistakes.sensitivity": {
      high: ["Alta (50 cp)", "High (50 cp)"], standard: ["Estándar (80 cp)", "Standard (80 cp)"], low: ["Baja (150 cp)", "Low (150 cp)"],
    },
    "a11y.textScale": { 1: ["Normal", "Normal"], 1.15: ["Grande", "Large"], 1.3: ["Muy grande", "Extra large"] },
    "a11y.contrast": { normal: ["Normal", "Normal"], high: ["Alto", "High"] },
    "a11y.motion": { auto: ["Automático", "Automatic"], reduce: ["Reducido", "Reduced"] },
  };

  const GROUP_TEXT = {
    board: [["Tablero", "Board"], ["Cómo se ve y se maneja el tablero.", "How the board looks and behaves."]],
    sound: [["Sonido y vibración", "Sound and haptics"], ["Efectos sonoros y vibración.", "Sound effects and vibration."]],
    clock: [["Reloj", "Clock"], ["El tiempo que tenés para cada posición.", "The time you get for each position."]],
    engine: [["Motor", "Engine"], ["Cuánto y cómo analiza Stockfish.", "How much and how Stockfish analyzes."]],
    scoring: [["Puntaje", "Scoring"], ["Cómo se puntúa cada jugada.", "How each move is scored."]],
    hints: [["Pistas", "Hints"], ["Ayudas durante la partida.", "Help while you play."]],
    mistakes: [["Errores", "Mistakes"], ["Qué se considera un error en tus partidas.", "What counts as a mistake in your games."]],
    a11y: [["Accesibilidad", "Accessibility"], ["Texto, contraste y movimiento.", "Text, contrast and motion."]],
  };

  function buildBundle() {
    const bundle = { es: {}, en: {} };
    Object.keys(TEXT).forEach((path) => {
      const [label, hint] = TEXT[path];
      bundle.es[`settings.${path}.label`] = label[0];
      bundle.en[`settings.${path}.label`] = label[1];
      bundle.es[`settings.${path}.hint`] = hint[0];
      bundle.en[`settings.${path}.hint`] = hint[1];
    });
    Object.keys(OPTION_TEXT).forEach((path) => {
      Object.keys(OPTION_TEXT[path]).forEach((value) => {
        const [es, en] = OPTION_TEXT[path][value];
        const key = optionKey(path, value);
        bundle.es[key] = es;
        bundle.en[key] = en;
      });
    });
    Object.keys(GROUP_TEXT).forEach((id) => {
      const [label, hint] = GROUP_TEXT[id];
      bundle.es[`settings.group.${id}`] = label[0];
      bundle.en[`settings.group.${id}`] = label[1];
      bundle.es[`settings.group.${id}.hint`] = hint[0];
      bundle.en[`settings.group.${id}.hint`] = hint[1];
    });
    return bundle;
  }

  const I18N_BUNDLE = buildBundle();
  const registeredWith = new WeakSet();

  // Idempotent per i18n instance; safe to call before ludus.js exists.
  function registerText(i18n) {
    try {
      const target = i18n || (root.Ludus && root.Ludus.i18n);
      if (!target || typeof target.register !== "function" || registeredWith.has(target)) return false;
      target.register(I18N_BUNDLE);
      registeredWith.add(target);
      return true;
    } catch (error) {
      return false;
    }
  }

  registerText();

  // ---------- Instances ----------

  function createSettings(env) {
    const options = env || {};
    let values = null; // Map<path, value>, filled on first use
    let listening = false;

    function getStorage() {
      return options.storage || (root.Ludus && root.Ludus.storage) || null;
    }

    function getBus() {
      return options.bus || (root.Ludus && root.Ludus.bus) || null;
    }

    function getDocument() {
      try {
        if (options.doc) return options.doc;
        return root.document || null;
      } catch (error) {
        return null;
      }
    }

    function storageGet(key, fallback) {
      try {
        const storage = getStorage();
        return storage ? storage.get(key, fallback) : fallback;
      } catch (error) {
        return fallback;
      }
    }

    function storageSet(key, value) {
      try {
        const storage = getStorage();
        return Boolean(storage) && storage.set(key, value) === true;
      } catch (error) {
        return false;
      }
    }

    function defaultsMap() {
      return new Map(SCHEMA.map((spec) => [spec.path, spec.default]));
    }

    // The old wizard preference becomes clock.seconds; nothing else in it is kept.
    function legacySeconds() {
      const legacy = storageGet(LEGACY_SETUP_KEY, null);
      if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) return null;
      if (!hasOwn(legacy, "turnTimeSeconds")) return null;
      const seconds = toFiniteNumber(legacy.turnTimeSeconds);
      if (Number.isNaN(seconds)) return null;
      const spec = BY_PATH.get("clock.seconds");
      return snapNumber(Math.round(seconds), spec);
    }

    function readFromStorage() {
      const map = defaultsMap();
      const stored = storageGet(STORAGE_KEY, ABSENT);
      let migrated = false;
      if (stored === ABSENT) {
        const seconds = legacySeconds();
        if (seconds !== null) {
          map.set("clock.seconds", seconds);
          migrated = true;
        }
      } else if (stored && typeof stored === "object" && !Array.isArray(stored)
        && stored.v === VERSION && stored.values && typeof stored.values === "object" && !Array.isArray(stored.values)) {
        SCHEMA.forEach((spec) => {
          // Own-property reads only: "__proto__" or "constructor" keys in a
          // tampered blob are never looked at because they are not schema paths.
          if (!hasOwn(stored.values, spec.path)) return;
          const result = validateEntry(spec, stored.values[spec.path]);
          if (result.ok) map.set(spec.path, result.value);
        });
      }
      return { map, migrated };
    }

    function persist() {
      const plain = {};
      SCHEMA.forEach((spec) => {
        plain[spec.path] = values.get(spec.path);
      });
      return storageSet(STORAGE_KEY, { v: VERSION, values: plain });
    }

    function attachStorageListener() {
      if (listening || options.listenStorage === false) return;
      listening = true;
      try {
        if (typeof root.addEventListener !== "function") return;
        root.addEventListener("storage", (event) => {
          if (event && event.key === STORAGE_KEY) reload();
        });
      } catch (error) {
        // Not every host has window events (Node, workers).
      }
    }

    function ensureLoaded() {
      if (values) return;
      registerText(options.i18n);
      const loaded = readFromStorage();
      values = loaded.map;
      if (loaded.migrated) persist();
      attachStorageListener();
    }

    function tree() {
      ensureLoaded();
      return nest((spec) => values.get(spec.path));
    }

    function get(path) {
      if (path === undefined || path === null || path === "") return tree();
      if (typeof path !== "string") return undefined;
      ensureLoaded();
      const key = hasOwn(ALIASES, path) ? ALIASES[path] : path;
      if (BY_PATH.has(key)) return values.get(key);
      const scoped = SCHEMA.filter((spec) => spec.path.startsWith(`${key}.`));
      if (!scoped.length) return undefined;
      let node = tree();
      for (const part of key.split(".")) {
        if (!node || typeof node !== "object" || !hasOwn(node, part)) return undefined;
        node = node[part];
      }
      return node;
    }

    function announce(paths) {
      if (options.autoApply === true) applyToDocument();
      const bus = getBus();
      if (!bus) return;
      const snapshot = tree();
      paths.forEach((path) => {
        try {
          bus.emit("settings:changed", { path, value: values.get(path), settings: snapshot });
        } catch (error) {
          // A listener problem must not undo the change.
        }
      });
    }

    // Returns true when the value was accepted (including "already that value"),
    // false for an unknown path or a value that does not validate.
    function set(path, value) {
      const spec = resolvePath(path);
      if (!spec) return false;
      const result = validateEntry(spec, value);
      if (!result.ok) return false;
      ensureLoaded();
      if (Object.is(values.get(spec.path), result.value)) return true;
      values.set(spec.path, result.value);
      persist();
      announce([spec.path]);
      return true;
    }

    // A leaf path, a group prefix ("board"), or nothing (everything).
    // Returns false for a prefix that matches nothing.
    function reset(pathPrefix) {
      const paths = pathsUnder(pathPrefix);
      if (!paths.length) return false;
      ensureLoaded();
      const changed = [];
      paths.forEach((path) => {
        const spec = BY_PATH.get(path);
        if (!Object.is(values.get(path), spec.default)) {
          values.set(path, spec.default);
          changed.push(path);
        }
      });
      if (changed.length) {
        persist();
        announce(changed);
      }
      return true;
    }

    // Re-reads storage (another tab wrote it, or a sync replaced it) and
    // announces whatever differs.
    function reload() {
      const before = values;
      values = null;
      ensureLoaded();
      if (!before) return;
      const changed = SCHEMA.map((spec) => spec.path).filter((path) => !Object.is(before.get(path), values.get(path)));
      if (changed.length) announce(changed);
    }

    // onChange(fn) or onChange("board", fn): fn({ path, value, settings }).
    function onChange(first, second) {
      const filter = typeof first === "function" ? null : first;
      const handler = typeof first === "function" ? first : second;
      const bus = getBus();
      if (typeof handler !== "function" || !bus) return noop;
      const wanted = typeof filter === "string" ? (hasOwn(ALIASES, filter) ? ALIASES[filter] : filter) : null;
      return bus.on("settings:changed", (payload) => {
        if (!payload) return;
        if (wanted) {
          const spec = BY_PATH.get(payload.path);
          if (!spec || !isUnder(spec, wanted)) return;
        }
        handler(payload);
      });
    }

    function scoringSettings() {
      ensureLoaded();
      const scoring = root.Ludus && root.Ludus.Scoring;
      const partial = {
        model: values.get("scoring.model"),
        strictness: values.get("scoring.strictness"),
        bestMode: values.get("scoring.bestMode"),
        tolerancePct: values.get("scoring.tolerancePct"),
      };
      if (scoring && typeof scoring.normalizeSettings === "function") return scoring.normalizeSettings(partial);
      return Object.assign(partial, { hintCost: Object.assign({}, HINT_COST_FALLBACK) });
    }

    function engineBudget() {
      ensureLoaded();
      const strength = values.get("engine.strength");
      const movetimeMs = strength === "custom" ? values.get("engine.movetimeMs") : ENGINE_PRESET_MS[strength];
      return { movetimeMs, multiPv: values.get("engine.multiPv") };
    }

    // Shape of Ludus.game.startSession({ options: { clock } }).
    function clockOptions() {
      ensureLoaded();
      return { mode: values.get("clock.mode"), seconds: values.get("clock.seconds") };
    }

    function mistakeThresholdCp() {
      ensureLoaded();
      return MISTAKE_THRESHOLD_CP[values.get("mistakes.sensitivity")];
    }

    // Reflects the settings on <html>. Returns false (and does nothing) when
    // there is no document, so it is safe under Node and before the DOM exists.
    function applyToDocument(doc) {
      try {
        ensureLoaded();
        const target = doc || getDocument();
        const el = target && target.documentElement;
        if (!el || typeof el.setAttribute !== "function") return false;
        el.setAttribute("data-board-theme", String(values.get("board.theme")));
        el.setAttribute("data-contrast", String(values.get("a11y.contrast")));
        el.setAttribute("data-motion", String(values.get("a11y.motion")));
        const scale = String(values.get("a11y.textScale"));
        if (el.style && typeof el.style.setProperty === "function") el.style.setProperty("--text-scale", scale);
        else if (el.style) el.style["--text-scale"] = scale;
        return true;
      } catch (error) {
        return false;
      }
    }

    return {
      get,
      set,
      reset,
      reload,
      onChange,
      validate,
      scoringSettings,
      engineBudget,
      clockOptions,
      mistakeThresholdCp,
      applyToDocument,
    };
  }

  // The shared instance follows the real environment and keeps <html> in sync.
  const api = createSettings({ autoApply: true });
  api.create = createSettings;
  api.schema = SCHEMA;
  api.groups = GROUPS;
  api.DEFAULTS = DEFAULTS;
  api.STORAGE_KEY = STORAGE_KEY;
  api.LEGACY_KEY = LEGACY_SETUP_KEY;
  api.ENGINE_PRESET_MS = ENGINE_PRESET_MS;
  api.MISTAKE_THRESHOLD_CP = MISTAKE_THRESHOLD_CP;
  api.registerText = registerText;
  return api;
});
