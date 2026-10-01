// Profiles, records, notebook (Leitner spaced repetition), stats, XP/levels,
// achievements, daily challenge state, export / import / merge.
// Contract: docs/ARCHITECTURE.md section 11.
//
// Storage (every access goes through Ludus.storage, or an injected storage):
//   ludus.profiles.v1   { v, active, profiles: [{ id, name, color, createdAt, googleSub? }] }
//   ludus.p.<id>.v1     the profile data below
//
// Profile data (v: 1). Everything is JSON, validated on load and size-capped:
//   rounds        <= 600 RoundRecords, oldest first (the recent window stats are computed on)
//   sessions      <= 200 SessionRecords, oldest first
//   notebook      <= 1000 cards; id = "c_" + hash(FEN without move counters), so one
//                 position is one card on every device
//   achievements  { id: unlockedAt }
//   daily         { lastDate, streak, best, history: { "YYYY-MM-DD": accuracy } }
//   days          sorted "YYYY-MM-DD" list of days with activity (local time), <= 800;
//                 the activity streak is computed from it
//   xpLog         { "r:<roundId>" | "b:<bonusKey>": [xp, ts] }: every XP event; the
//                 total is a SUM over it, never a running counter, so it is exactly
//                 recomputable from rounds + bonuses and merging cannot double count
//   xpFloor       { upTo, xp, rounds, bonuses }: summary of the events older than
//                 `upTo` that fell out of the capped xpLog (also what makes "positions
//                 played" keep counting after the 600-round window rolls over)
//   xp            derived: xpFloor.xp + sum(xpLog). Never trusted from storage/import.
//   updatedAt
//
// Time: "today" and "streak" use calendar days in the LOCAL time zone, counted
// with day numbers computed from the local Y-M-D (so 23/25 hour DST days are still
// one day). The clock is injectable (`now`) for tests.
//
// The pure parts (sanitizers, merge, streaks, stats, levels) do not touch
// storage, DOM or clock except through the `ctx` they receive. `createInstance(env)`
// builds an isolated store (`storage`, `bus`, `now`, `uid`, `i18n`) for tests;
// the shared instance is what `Ludus.Profile` exposes.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Profile = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  // ---------- Constants ----------

  const INDEX_KEY = "ludus.profiles.v1";
  const DATA_PREFIX = "ludus.p.";
  const DATA_SUFFIX = ".v1";
  const INDEX_VERSION = 1;
  const DATA_VERSION = 1;
  const EXPORT_KIND = "ludus-progress";
  const EXPORT_VERSION = 1;
  const EXPORT_APP = "ludus-scaccorum";

  const MAX_IMPORT_CHARS = 5 * 1024 * 1024; // 5 MB of text
  const MAX_PROFILES = 4; // two people sharing a device is the design case
  const NAME_MAX = 24;
  // Serialized size one profile may take. MAX_PROFILES of them still export to
  // less than MAX_IMPORT_CHARS, so an "all profiles" backup always re-imports.
  const PROFILE_BUDGET_CHARS = 1100000;

  const CAPS = Object.freeze({
    rounds: 600,
    sessions: 200,
    notebook: 1000,
    days: 800,
    xpLog: 4000,
    dailyHistory: 120,
    cardHistory: 20,
    lines: 3,
    pvPlies: 6,
    tags: 12,
    sessionRoundIds: 200,
    // Upper bounds on how many array entries an import even looks at.
    inputRounds: 2000,
    inputSessions: 600,
    inputCards: 3000,
    inputMapEntries: 12000,
  });

  const DAY_MS = 86400000;
  const MIN_TS = Date.UTC(2000, 0, 1);
  const MAX_TS = Date.UTC(2100, 0, 1);
  const MAX_DAY = Math.round(MAX_TS / DAY_MS);
  const MAX_DUE_AHEAD_DAYS = 31; // longest Leitner interval; imported "due" is bounded by it

  // Spaced repetition (Leitner boxes). Box index -> days until the next review.
  // Box 0 is "new": due immediately. A failed review goes back to box 1.
  const LEITNER_DAYS = Object.freeze([0, 1, 3, 7, 14, 30]);
  const PASS_ACCURACY = 70; // >= passes a review; < creates / demotes a card
  const MISTAKE_QUALITIES = Object.freeze(["dubious", "bad", "blunder"]);
  const CLEARED_BOX = 3; // a card counts as "cleared" once it reaches this box (7 day interval)

  const MIN_TAG_SAMPLE = 5;
  const TREND_SESSIONS = 20;
  const IMPROVEMENT_WINDOW = 50;
  const WEAKEST_TAGS = 5;
  const HOT_STREAK_ACCURACY = 80;
  const HOT_STREAK_LENGTH = 10;
  const MATE_SCORE = 50000; // |score| >= this is a forced mate in Ludus's score encoding

  const STREAK_BONUS_STEP = 5;
  const STREAK_BONUS_MAX = 50;
  const DAILY_BASE_XP = 40;
  const DAILY_STREAK_XP_STEP = 5;
  const DAILY_STREAK_XP_DAYS = 7;
  const PERFECT_SESSION_XP = 50;
  const PERFECT_SESSION_MIN_POSITIONS = 5;

  const QUALITY_CODES = Object.freeze(["brilliant", "great", "perfect", "very_good", "good", "interesting", "dubious", "bad", "blunder", "no_move"]);
  const PERFECT_QUALITIES = Object.freeze(["brilliant", "great", "perfect"]);
  const SOURCES = Object.freeze(["own", "classic", "notebook", "daily"]);
  const SESSION_KINDS = Object.freeze(["own", "classic", "review", "daily"]);
  const PHASES = Object.freeze(["opening", "middlegame", "endgame"]);
  const PALETTE = Object.freeze(["#2f6f4f", "#8a4b2a", "#2b5f8a", "#7a3b8f", "#b3541e", "#1f7a7a", "#8a2f45", "#5a6b1f"]);

  const FORBIDDEN_KEYS = Object.freeze(["__proto__", "constructor", "prototype"]);
  const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
  const PROFILE_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
  const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
  const SAN_RE = /^[A-Za-z0-9+#=!?-]{1,16}$/;
  const TAG_RE = /^[a-z][a-z0-9_]{0,39}$/;
  const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
  const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
  const SUB_RE = /^[A-Za-z0-9_.-]{1,64}$/;
  const LEDGER_KEY_RE = /^[rb]:[A-Za-z0-9_.:-]{1,62}$/;
  const PIECES = "pnbrqkPNBRQK";

  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  // ---------- Small pure helpers ----------

  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function numIn(value, min, max, fallback) {
    return finite(value) ? clamp(value, min, max) : fallback;
  }

  function intIn(value, min, max, fallback) {
    return finite(value) ? clamp(Math.round(value), min, max) : fallback;
  }

  function roundTo(value, decimals) {
    const factor = 10 ** decimals;
    return (Math.round(value * factor) / factor) + 0; // "+ 0" turns -0 into 0
  }

  // Control characters and bidi overrides out, whitespace collapsed, length capped.
  function cleanText(value, max) {
    if (typeof value !== "string") return "";
    // Bound the work first: a hostile 5 MB string must not cost a 5 MB regex pass.
    return (value.length > max * 4 + 16 ? value.slice(0, max * 4 + 16) : value)
      .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  // How two profile names are compared (PC-5): capital letters, spaces of any kind and zero-width characters do not tell two names
  // apart, so "Marta" and "marta " are the same name. An empty key means the name shows nothing at all.
  function nameKey(value) {
    let text = cleanText(value, NAME_MAX);
    try {
      text = text.normalize("NFKC");
    } catch (error) {
      // No normalize(): the plain text is compared.
    }
    return text.replace(/[\s\u200b-\u200d\u2060\ufeff]+/g, "").toLowerCase();
  }

  // `base` as a name no key in `taken` (a Set of nameKey values) uses: "Marta", then "Marta 2", "Marta 3"... within the length cap.
  function freeName(taken, base) {
    if (!taken.has(nameKey(base))) return base;
    for (let n = 2; n < 100; n += 1) {
      const suffix = ` ${n}`;
      const candidate = `${cleanText(base, NAME_MAX - suffix.length)}${suffix}`;
      if (!taken.has(nameKey(candidate))) return candidate;
    }
    return base;
  }

  function idOrNull(value) {
    return typeof value === "string" && ID_RE.test(value) && !FORBIDDEN_KEYS.includes(value) ? value : null;
  }

  function uciOrNull(value) {
    return typeof value === "string" && UCI_RE.test(value) ? value : null;
  }

  function sanOrNull(value) {
    return typeof value === "string" && SAN_RE.test(value) ? value : null;
  }

  function pickEnum(value, list, fallback) {
    return typeof value === "string" && list.includes(value) ? value : fallback;
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function sortedMap(source) {
    const out = {};
    Object.keys(source).sort().forEach((key) => {
      out[key] = source[key];
    });
    return out;
  }

  function isSortedBy(list, compare) {
    for (let i = 1; i < list.length; i += 1) {
      if (compare(list[i - 1], list[i]) > 0) return false;
    }
    return true;
  }

  const byTsThenId = (a, b) => (a.ts - b.ts) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  // cyrb53, identical to Ludus.util.hashString, so card ids agree everywhere
  // and this module needs nothing from the namespace to compute them.
  function hashString(value) {
    const text = value === null || value === undefined ? "" : String(value);
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ code, 2654435761);
      h2 = Math.imul(h2 ^ code, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
  }

  let fallbackCounter = 0;
  function fallbackUid(prefix) {
    fallbackCounter = (fallbackCounter + 1) % 46656;
    const noise = Math.floor(Math.random() * 2821109907456).toString(36).padStart(8, "0");
    return `${prefix || ""}${Date.now().toString(36)}${noise}${fallbackCounter.toString(36).padStart(3, "0")}`;
  }

  // ---------- Dates (local time, DST safe) ----------

  const pad2 = (n) => String(n).padStart(2, "0");

  function dateKeyOf(ts) {
    const d = new Date(ts);
    return `${String(d.getFullYear()).padStart(4, "0")}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  // "YYYY-MM-DD" -> { n: days since the epoch } or null when it is not a real date.
  function parseDateKey(key) {
    if (typeof key !== "string" || !DATE_KEY_RE.test(key)) return null;
    const y = Number(key.slice(0, 4));
    const m = Number(key.slice(5, 7));
    const d = Number(key.slice(8, 10));
    if (y < 2000 || y > 2100) return null;
    const t = Date.UTC(y, m - 1, d);
    const check = new Date(t);
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
    return { n: Math.round(t / DAY_MS) };
  }

  const dayNumber = (key) => {
    const parsed = parseDateKey(key);
    return parsed ? parsed.n : null;
  };

  function keyFromDayNumber(n) {
    const d = new Date(n * DAY_MS);
    return `${String(d.getUTCFullYear()).padStart(4, "0")}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }

  const dayNumberOfTs = (ts) => dayNumber(dateKeyOf(ts));

  // Local midnight `plusDays` calendar days after the local day of `ts`.
  function startOfLocalDay(ts, plusDays) {
    const d = new Date(ts);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + plusDays).getTime();
  }

  // When a card in `box` is next due, given the moment of the review.
  function dueAt(box, ts) {
    const days = LEITNER_DAYS[clamp(box, 0, LEITNER_DAYS.length - 1)];
    return days === 0 ? ts : startOfLocalDay(ts, days);
  }

  // ---------- Validation contexts ----------
  //
  // strict: what an import / merge / new record may contain (nothing dated more
  //   than a day ahead of `now`);
  // trusted: our own stored data, which must survive the device clock moving
  //   backwards, so only an absolute sanity bound applies.

  function strictCtx(now, uid) {
    return { now, maxTs: now + DAY_MS, clampTs: now, maxDay: dayNumberOfTs(now) + 1, uid, dropped: 0 };
  }

  function trustedCtx(now, uid) {
    return { now, maxTs: MAX_TS, clampTs: MAX_TS, maxDay: MAX_DAY, uid, dropped: 0 };
  }

  // A timestamp inside [MIN_TS, ctx.maxTs], or null (the record is then dropped).
  function tsIn(value, ctx) {
    if (!finite(value)) return null;
    const ts = Math.floor(value);
    return ts >= MIN_TS && ts <= ctx.maxTs ? ts : null;
  }

  // Non-critical timestamps are repaired instead: garbage -> fallback, the far
  // future -> clamped to the context's ceiling.
  function tsOrClamp(value, ctx, fallback) {
    if (!finite(value)) return fallback;
    const ts = Math.floor(value);
    if (ts < MIN_TS) return fallback;
    return ts > ctx.maxTs ? ctx.clampTs : ts;
  }

  // ---------- Chess-shaped validators ----------

  function validFen(fen) {
    if (typeof fen !== "string" || fen.length < 15 || fen.length > 100) return false;
    const parts = fen.split(" ");
    if (parts.length < 2 || parts.length > 6) return false;
    const ranks = parts[0].split("/");
    if (ranks.length !== 8) return false;
    for (const rank of ranks) {
      let squares = 0;
      for (const ch of rank) {
        if (ch >= "1" && ch <= "8") squares += Number(ch);
        else if (PIECES.includes(ch)) squares += 1;
        else return false;
      }
      if (squares !== 8) return false;
    }
    if (parts[1] !== "w" && parts[1] !== "b") return false;
    if (parts[2] !== undefined && !/^(-|[KQkq]{1,4})$/.test(parts[2])) return false;
    if (parts[3] !== undefined && !/^(-|[a-h][36])$/.test(parts[3])) return false;
    if (parts[4] !== undefined && !/^\d{1,3}$/.test(parts[4])) return false;
    if (parts[5] !== undefined && !/^\d{1,4}$/.test(parts[5])) return false;
    return true;
  }

  // Placement, side, castling, en passant: the move counters do not make a
  // different position.
  function fenKey(fen) {
    const parts = fen.split(" ");
    return [parts[0], parts[1], parts[2] || "-", parts[3] || "-"].join(" ");
  }

  const cardIdFor = (fen) => `c_${hashString(fenKey(fen))}`;

  function sideOfFen(fen) {
    return fen.split(" ")[1] === "b" ? "b" : "w";
  }

  // ---------- Levels ----------

  const RANKS = Object.freeze(["pawn", "knight", "bishop", "rook", "queen", "king", "grandmaster"]);
  const SUB_LEVELS = 3;
  // Cumulative XP at which each of the 21 levels starts (7 ranks x 3 sub-levels).
  // One position is worth up to 100 XP (about 60-70 on a decent day).
  const LEVEL_THRESHOLDS = Object.freeze([
    0, 300, 700,
    1200, 1900, 2800,
    4000, 5500, 7500,
    10000, 13000, 17000,
    22000, 28000, 35000,
    43000, 52000, 63000,
    75000, 90000, 110000,
  ]);
  const ROMAN = Object.freeze(["I", "II", "III"]);

  function levelInfo(xpInput) {
    const xp = finite(xpInput) ? Math.max(0, Math.floor(xpInput)) : 0;
    let index = 0;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i -= 1) {
      if (xp >= LEVEL_THRESHOLDS[i]) {
        index = i;
        break;
      }
    }
    const rankIndex = Math.floor(index / SUB_LEVELS);
    const sub = (index % SUB_LEVELS) + 1;
    const floorXp = LEVEL_THRESHOLDS[index];
    const nextXp = index + 1 < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[index + 1] : null;
    return {
      level: index + 1,
      rank: RANKS[rankIndex],
      rankIndex,
      rankKey: `profile.rank.${RANKS[rankIndex]}`,
      sub,
      roman: ROMAN[sub - 1],
      xp,
      floorXp,
      nextXp,
      xpInLevel: xp - floorXp,
      xpToNext: nextXp === null ? 0 : nextXp - xp,
      progress: nextXp === null ? 1 : roundTo((xp - floorXp) / (nextXp - floorXp), 4),
      max: nextXp === null,
    };
  }

  // ---------- Achievements (catalog) ----------
  //
  // Every entry is a counter with a target: unlocked when measure(context) >= target.
  // That gives the UI a progress bar for free and keeps evaluation uniform.

  const ACHIEVEMENTS = [
    { id: "first_round", category: "volume", glyph: "♟", target: 1, measure: (c) => c.solvedPositions,
      text: [["Primer paso", "First step"], ["Resolvé tu primera posición.", "Solve your first position."]] },
    { id: "first_perfect", category: "moves", glyph: "★", target: 1, measure: (c) => c.perfectMoves,
      text: [["Jugada perfecta", "Perfect move"], ["Encontrá la mejor jugada de una posición, sin pistas.", "Find the best move in a position, without hints."]] },
    { id: "hot_streak", category: "moves", glyph: "✹", target: HOT_STREAK_LENGTH, measure: (c) => c.hotStreak,
      text: [["Racha caliente", "Hot streak"], ["Encadená 10 posiciones seguidas con más de 80% de precisión, sin pistas.", "Chain 10 positions in a row above 80% accuracy, without hints."]] },
    { id: "only_move", category: "moves", glyph: "⚑", target: 1, measure: (c) => c.onlyMovesFound,
      text: [["Jugada única", "Only move"], ["Encontrá una jugada única, sin pistas: la mejor estaba muy por encima de las demás.", "Find an only-move without hints: the best move stood far above the alternatives."]] },
    { id: "sacrifice", category: "moves", glyph: "⚔", target: 1, measure: (c) => c.sacrifices,
      text: [["Sacrificio inspirado", "Inspired sacrifice"], ["Encontrá la mejor jugada, sin pistas, cuando implicaba entregar material.", "Find the best move, without hints, when it meant giving up material."]] },
    { id: "mate_found", category: "moves", glyph: "♚", target: 1, measure: (c) => c.matesFound,
      text: [["Ojo de mate", "Mate in sight"], ["Encontrá la mejor jugada, sin pistas, en una posición con mate forzado.", "Find the best move, without hints, in a position with a forced mate."]] },
    { id: "quick_draw", category: "moves", glyph: "↯", target: 1, measure: (c) => c.quickDraws,
      text: [["Reflejos rápidos", "Quick draw"], ["Jugá una jugada casi perfecta en 5 segundos o menos, sin pistas.", "Play a near-perfect move in 5 seconds or less, without hints."]] },
    { id: "sharp_eye", category: "moves", glyph: "◉", target: 20, measure: (c) => c.cleanSharp,
      text: [["Ojo agudo", "Sharp eye"], ["Resolvé 20 posiciones con 90% o más de precisión y sin pistas.", "Solve 20 positions with 90% accuracy or more and no hints."]] },
    { id: "streak_3", category: "habit", glyph: "③", target: 3, measure: (c) => c.streakBest,
      text: [["Tres días seguidos", "Three-day streak"], ["Entrená 3 días seguidos.", "Train 3 days in a row."]] },
    { id: "streak_7", category: "habit", glyph: "⑦", target: 7, measure: (c) => c.streakBest,
      text: [["Semana de hierro", "Iron week"], ["Entrená 7 días seguidos.", "Train 7 days in a row."]] },
    { id: "streak_30", category: "habit", glyph: "▣", target: 30, measure: (c) => c.streakBest,
      text: [["Mes de constancia", "Month of dedication"], ["Entrená 30 días seguidos.", "Train 30 days in a row."]] },
    { id: "first_classic", category: "classics", glyph: "♛", target: 1, measure: (c) => c.classicSessions,
      text: [["Alumno de los maestros", "Pupil of the masters"], ["Completá tu primera partida clásica.", "Complete your first classic game."]] },
    { id: "classics_10", category: "classics", glyph: "♜", target: 10, measure: (c) => c.classicSessions,
      text: [["Coleccionista de clásicos", "Classics collector"], ["Completá 10 partidas clásicas.", "Complete 10 classic games."]] },
    { id: "explorer", category: "classics", glyph: "☉", target: 4, measure: (c) => c.sourcesSeen,
      text: [["Explorador", "Explorer"], ["Entrená con tus partidas, los clásicos, el cuaderno y el desafío diario.", "Train with your own games, the classics, the notebook and the daily challenge."]] },
    { id: "first_card_cleared", category: "notebook", glyph: "✓", target: 1, measure: (c) => c.clearedCards,
      text: [["Error superado", "Mistake overcome"], ["Superá tu primera tarjeta del cuaderno de errores.", "Clear your first card from the mistake notebook."]] },
    { id: "notebook_10", category: "notebook", glyph: "☷", target: 10, measure: (c) => c.clearedCards,
      text: [["Cuaderno al día", "Notebook up to date"], ["Superá 10 tarjetas del cuaderno de errores.", "Clear 10 mistake notebook cards."]] },
    { id: "positions_100", category: "volume", glyph: "Ⅽ", target: 100, measure: (c) => c.solvedPositions,
      text: [["Cien posiciones", "One hundred positions"], ["Resolvé 100 posiciones.", "Solve 100 positions."]] },
    { id: "positions_500", category: "volume", glyph: "Ⅾ", target: 500, measure: (c) => c.solvedPositions,
      text: [["Quinientas posiciones", "Five hundred positions"], ["Resolvé 500 posiciones.", "Solve 500 positions."]] },
    { id: "perfect_session", category: "sessions", glyph: "✦", target: 1, measure: (c) => c.perfectSessions,
      text: [["Sesión perfecta", "Perfect session"], ["Terminá una sesión de 5 o más posiciones con el puntaje máximo.", "Finish a session of 5 or more positions with full marks."]] },
    { id: "duel_win", category: "sessions", glyph: "⚔", target: 1, measure: (c) => c.duelWins,
      text: [["Ganaste el duelo", "Duel winner"], ["Ganá un duelo en un mismo dispositivo.", "Win a duel on one device."]] },
    { id: "daily_first", category: "daily", glyph: "☀", target: 1, measure: (c) => c.dailyDone,
      text: [["Desafío del día", "Daily challenger"], ["Completá tu primer desafío diario.", "Complete your first daily challenge."]] },
    { id: "daily_streak_7", category: "daily", glyph: "☄", target: 7, measure: (c) => c.dailyBest,
      text: [["Semana de desafíos", "Challenge week"], ["Completá el desafío diario 7 días seguidos.", "Complete the daily challenge 7 days in a row."]] },
    { id: "rank_knight", category: "progress", glyph: "♞", target: 4, measure: (c) => c.level,
      text: [["Salto de caballo", "Knight's leap"], ["Llegá al nivel Caballo.", "Reach the Knight level."]] },
    { id: "improver", category: "progress", glyph: "↗", target: 10, measure: (c) => c.improvementDelta,
      text: [["Cada vez mejor", "Getting better"], ["Mejorá tu precisión media al menos 10 puntos porcentuales entre tus primeras 50 y tus últimas 50 posiciones.", "Improve your average accuracy by at least 10 percentage points between your first 50 and your last 50 positions."]] },
  ];
  const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((def) => def.id));

  const CATEGORY_TEXT = {
    moves: ["Jugadas", "Moves"],
    habit: ["Constancia", "Consistency"],
    classics: ["Clásicos", "Classics"],
    notebook: ["Cuaderno", "Notebook"],
    volume: ["Volumen", "Volume"],
    sessions: ["Sesiones", "Sessions"],
    daily: ["Desafío diario", "Daily challenge"],
    progress: ["Progreso", "Progress"],
  };

  const RANK_TEXT = {
    pawn: ["Peón", "Pawn"],
    knight: ["Caballo", "Knight"],
    bishop: ["Alfil", "Bishop"],
    rook: ["Torre", "Rook"],
    queen: ["Dama", "Queen"],
    king: ["Rey", "King"],
    grandmaster: ["Gran Maestro", "Grandmaster"],
  };

  const IMPORT_ERROR_TEXT = {
    "too-large": ["El archivo es demasiado grande (máximo 5 MB).", "The file is too large (5 MB maximum)."],
    "invalid-json": ["El archivo no es un JSON válido.", "The file is not valid JSON."],
    "invalid-format": ["El archivo no parece una copia de Ludus Scaccorum.", "This file does not look like a Ludus Scaccorum backup."],
    "unsupported-version": ["El archivo es de una versión más nueva de la app. Actualizá e intentá de nuevo.", "This file comes from a newer version of the app. Update and try again."],
    "no-profiles": ["El archivo no contiene perfiles.", "The file contains no profiles."],
    "limit": ["No hay lugar para más perfiles (máximo {max}).", "There is no room for more profiles ({max} maximum)."],
    "storage-failed": ["No se pudo guardar: el almacenamiento del navegador está lleno o bloqueado.", "Could not save: browser storage is full or blocked."],
    "read-only": ["Estos datos vienen de una versión más nueva de la app y no se pueden modificar.", "This data comes from a newer version of the app and cannot be changed."],
    "invalid-mode": ["Modo de importación no válido.", "Invalid import mode."],
    "no-such-profile": ["No se encontró ese perfil.", "That profile was not found."],
    // PC-5: a name another profile already has ("Marta" and "marta " are the same); the account screen shows it through Profile.errorKey.
    "duplicate-name": ["Ya hay un perfil con ese nombre (no cuentan las mayúsculas ni los espacios). Elegí otro.", "A profile with that name already exists (capital letters and spaces do not count). Choose another name."],
    // A code of Profile.lastError() that a screen may want to explain (Profile.errorKey).
    "unknown-profile": ["Ese perfil ya no existe en este dispositivo, así que lo que jugaste no se guardó.", "That profile no longer exists on this device, so what you played was not saved."],
  };

  function buildBundle() {
    const bundle = { es: {}, en: {} };
    const put = (key, pair) => {
      bundle.es[key] = pair[0];
      bundle.en[key] = pair[1];
    };
    // Neutral in both languages ("Jugador" was the masculine generic, CNT-035).
    put("profile.defaultName", ["Participante", "Player"]);
    put("profile.level.title", ["{rank} {sub}", "{rank} {sub}"]);
    Object.keys(RANK_TEXT).forEach((rank) => put(`profile.rank.${rank}`, RANK_TEXT[rank]));
    Object.keys(CATEGORY_TEXT).forEach((category) => put(`achievement.category.${category}`, CATEGORY_TEXT[category]));
    ACHIEVEMENTS.forEach((def) => {
      put(`achievement.${def.id}.name`, def.text[0]);
      put(`achievement.${def.id}.desc`, def.text[1]);
    });
    Object.keys(IMPORT_ERROR_TEXT).forEach((code) => put(`profile.import.error.${code}`, IMPORT_ERROR_TEXT[code]));
    // The shell's "new profile" form looks its message up as shell.profile.error.<code> and shows a generic one when that key is missing
    // (js/ui/shell.js): the sentence for a taken name is supplied here so the form says why it refused (PC-5). A key the shell registers
    // itself later replaces this one.
    put("shell.profile.error.duplicate-name", IMPORT_ERROR_TEXT["duplicate-name"]);
    return bundle;
  }

  const I18N_BUNDLE = buildBundle();
  const registeredWith = new WeakSet();

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

  // ---------- Sanitizers (untrusted -> canonical) ----------
  //
  // Every sanitizer builds a NEW object with a fixed key order from a whitelist,
  // so unknown keys and prototype-pollution keys never survive and equal content
  // serializes identically (merge tie-breaks rely on that). Running one on its
  // own output changes nothing.

  function sanitizeLines(raw) {
    const out = [];
    if (!Array.isArray(raw)) return out;
    for (const item of raw.slice(0, CAPS.lines * 4)) {
      if (out.length >= CAPS.lines) break;
      if (!isObject(item)) continue;
      const uci = uciOrNull(item.uci);
      if (!uci) continue;
      const pv = [];
      if (Array.isArray(item.pv)) {
        for (const move of item.pv.slice(0, CAPS.pvPlies)) {
          const parsed = uciOrNull(move);
          if (!parsed) break;
          pv.push(parsed);
        }
      }
      out.push({ uci, san: sanOrNull(item.san) || "", score: intIn(item.score, -100000, 100000, 0), pv });
    }
    return out;
  }

  function sanitizeTags(raw) {
    const out = [];
    if (!Array.isArray(raw)) return out;
    for (const tag of raw.slice(0, CAPS.tags * 3)) {
      if (typeof tag === "string" && TAG_RE.test(tag) && !out.includes(tag)) out.push(tag);
      if (out.length >= CAPS.tags) break;
    }
    return out;
  }

  function sanitizeMeta(raw) {
    const out = {};
    if (!isObject(raw)) return out;
    ["players", "event", "site"].forEach((key) => {
      const text = cleanText(raw[key], 80);
      if (text) out[key] = text;
    });
    if (finite(raw.year) && raw.year >= 1 && raw.year <= 2200) out.year = Math.round(raw.year);
    else if (typeof raw.year === "string" && /^\d{1,4}$/.test(raw.year)) out.year = Number(raw.year);
    const eco = cleanText(raw.eco, 8);
    if (eco) out.eco = eco;
    const result = cleanText(raw.result, 10);
    if (result) out.result = result;
    if (finite(raw.moveNumber) && raw.moveNumber >= 0 && raw.moveNumber <= 999) out.moveNumber = Math.round(raw.moveNumber);
    if (raw.sideToMove === "w" || raw.sideToMove === "b") out.sideToMove = raw.sideToMove;
    return out;
  }

  function qualityFromAccuracy(accuracy) {
    if (accuracy >= 99.5) return "perfect";
    if (accuracy >= 90) return "very_good";
    if (accuracy >= 75) return "good";
    if (accuracy >= 55) return "interesting";
    if (accuracy >= 35) return "dubious";
    if (accuracy >= 10) return "bad";
    return "blunder";
  }

  // lenient: fill in a missing id / ts (a record we are about to create ourselves);
  // otherwise both must already be valid (stored / imported data).
  function sanitizeRound(raw, ctx, lenient) {
    if (!isObject(raw)) return null;
    if (!validFen(raw.fen)) return null;
    let id = idOrNull(raw.id);
    let ts = tsIn(raw.ts, ctx);
    if (lenient) {
      if (!id) id = ctx.uid("r_");
      if (ts === null) ts = ctx.now;
    } else if (!id || ts === null) {
      return null;
    }
    let points = numIn(raw.points, 0, 10, NaN);
    let accuracy = numIn(raw.accuracy, 0, 100, NaN);
    if (Number.isNaN(points) && Number.isNaN(accuracy)) return null;
    if (Number.isNaN(accuracy)) accuracy = points * 10;
    if (Number.isNaN(points)) points = accuracy / 10;
    points = roundTo(points, 2);
    accuracy = roundTo(accuracy, 2);

    const source = pickEnum(raw.source, SOURCES, "own");
    const out = {
      id,
      ts,
      sessionId: idOrNull(raw.sessionId) || "",
      sessionKind: pickEnum(raw.sessionKind, SESSION_KINDS, "own"),
      source,
      positionId: idOrNull(raw.positionId) || `${source}:${hashString(fenKey(raw.fen))}`,
      fen: raw.fen,
      sideToMove: raw.sideToMove === "w" || raw.sideToMove === "b" ? raw.sideToMove : sideOfFen(raw.fen),
      phase: pickEnum(raw.phase, PHASES, null),
      userUci: uciOrNull(raw.userUci),
      userSan: sanOrNull(raw.userSan),
      bestUci: uciOrNull(raw.bestUci),
      bestSan: sanOrNull(raw.bestSan),
    };
    const masterUci = uciOrNull(raw.masterUci);
    if (masterUci) {
      out.masterUci = masterUci;
      const masterSan = sanOrNull(raw.masterSan);
      if (masterSan) out.masterSan = masterSan;
    }
    out.points = points;
    out.accuracy = accuracy;
    out.qualityCode = pickEnum(raw.qualityCode, QUALITY_CODES, qualityFromAccuracy(accuracy));
    out.winLossPct = roundTo(numIn(raw.winLossPct, 0, 100, 0), 2);
    out.cpLoss = intIn(raw.cpLoss, 0, 2500, 0);
    out.isBest = typeof raw.isBest === "boolean" ? raw.isBest : null;
    out.rank = finite(raw.rank) && raw.rank >= 1 && raw.rank <= 64 ? Math.round(raw.rank) : null;
    out.onlyMove = raw.onlyMove === true;
    out.timeSpentMs = intIn(raw.timeSpentMs, 0, 3600000, 0);
    out.hintsUsed = intIn(raw.hintsUsed, 0, 3, 0);
    out.timedOut = raw.timedOut === true;
    out.tags = sanitizeTags(raw.tags);
    out.lines = sanitizeLines(raw.lines);
    out.meta = sanitizeMeta(raw.meta);
    return out;
  }

  function sanitizeSession(raw, ctx, lenient) {
    if (!isObject(raw)) return null;
    let id = idOrNull(raw.id);
    let ts = tsIn(raw.ts, ctx);
    if (lenient) {
      if (!id) id = ctx.uid("s_");
      if (ts === null) ts = ctx.now;
    } else if (!id || ts === null) {
      return null;
    }
    const positions = intIn(raw.positions, 0, 1000, 0);
    const out = {
      id,
      ts,
      kind: pickEnum(raw.kind, SESSION_KINDS, "own"),
      title: cleanText(raw.title, 80),
      mode: raw.mode === "duel" ? "duel" : "solo",
      positions,
      points: roundTo(numIn(raw.points, 0, 10000, 0), 2),
      maxPoints: roundTo(numIn(raw.maxPoints, 0, 10000, positions * 10), 2),
      avgAccuracy: roundTo(numIn(raw.avgAccuracy, 0, 100, 0), 2),
      durationMs: intIn(raw.durationMs, 0, DAY_MS, 0),
      byQuality: {},
      roundIds: [],
    };
    if (isObject(raw.byQuality)) {
      QUALITY_CODES.forEach((code) => {
        if (!hasOwn(raw.byQuality, code)) return;
        const count = intIn(raw.byQuality[code], 0, 1000, 0);
        if (count > 0) out.byQuality[code] = count;
      });
    }
    if (Array.isArray(raw.roundIds)) {
      const seen = new Set();
      for (const value of raw.roundIds.slice(0, CAPS.sessionRoundIds * 2)) {
        const roundId = idOrNull(value);
        if (roundId && !seen.has(roundId)) {
          seen.add(roundId);
          out.roundIds.push(roundId);
        }
        if (out.roundIds.length >= CAPS.sessionRoundIds) break;
      }
    }
    if (out.mode === "duel" && isObject(raw.duel)) {
      const names = Array.isArray(raw.duel.names) ? raw.duel.names : [];
      const scores = Array.isArray(raw.duel.scores) ? raw.duel.scores : [];
      const duel = {
        names: [cleanText(names[0], NAME_MAX), cleanText(names[1], NAME_MAX)],
        scores: [roundTo(numIn(scores[0], 0, 10000, 0), 2), roundTo(numIn(scores[1], 0, 10000, 0), 2)],
      };
      if (raw.duel.me === 0 || raw.duel.me === 1) duel.me = raw.duel.me;
      out.duel = duel;
    }
    return out;
  }

  function sanitizeHistory(raw, ctx) {
    const map = new Map();
    if (Array.isArray(raw)) {
      for (const item of raw.slice(0, CAPS.cardHistory * 3)) {
        if (!isObject(item)) continue;
        const ts = tsIn(item.ts, ctx);
        if (ts === null) continue;
        const entry = {
          ts,
          accuracy: roundTo(numIn(item.accuracy, 0, 100, 0), 2),
          passed: item.passed === true,
          box: intIn(item.box, 0, LEITNER_DAYS.length - 1, 0),
        };
        const roundId = idOrNull(item.roundId);
        if (roundId) entry.roundId = roundId;
        map.set(historyKey(entry), entry);
      }
    }
    return trimHistory(Array.from(map.values()));
  }

  // Two entries are the same review only if everything about them is equal.
  const historyKey = (entry) => `${entry.ts}|${entry.roundId || ""}|${entry.box}|${entry.passed ? 1 : 0}|${entry.accuracy}`;

  function trimHistory(list) {
    list.sort((a, b) => (a.ts - b.ts) || (historyKey(a) < historyKey(b) ? -1 : historyKey(a) > historyKey(b) ? 1 : 0));
    return list.length > CAPS.cardHistory ? list.slice(list.length - CAPS.cardHistory) : list;
  }

  function sanitizeCard(raw, ctx) {
    if (!isObject(raw)) return null;
    if (!validFen(raw.fen)) return null;
    const createdAt = tsOrClamp(raw.createdAt, ctx, ctx.now);
    const box = intIn(raw.box, 0, LEITNER_DAYS.length - 1, 0);
    const due = Math.min(tsOrClamp(raw.due, ctx, createdAt), ctx.maxTs + MAX_DUE_AHEAD_DAYS * DAY_MS);
    const source = pickEnum(raw.source, SOURCES, "own");
    return {
      id: cardIdFor(raw.fen), // canonical: never trust a supplied id
      fen: raw.fen,
      positionId: idOrNull(raw.positionId) || `${source}:${hashString(fenKey(raw.fen))}`,
      source,
      sideToMove: raw.sideToMove === "w" || raw.sideToMove === "b" ? raw.sideToMove : sideOfFen(raw.fen),
      phase: pickEnum(raw.phase, PHASES, null),
      bestUci: uciOrNull(raw.bestUci),
      bestSan: sanOrNull(raw.bestSan),
      lines: sanitizeLines(raw.lines),
      tags: sanitizeTags(raw.tags),
      meta: sanitizeMeta(raw.meta),
      box,
      due,
      createdAt,
      updatedAt: Math.max(createdAt, tsOrClamp(raw.updatedAt, ctx, createdAt)),
      lastReviewAt: raw.lastReviewAt === null || raw.lastReviewAt === undefined ? null : tsOrClamp(raw.lastReviewAt, ctx, null),
      clearedAt: raw.clearedAt === null || raw.clearedAt === undefined ? null : tsOrClamp(raw.clearedAt, ctx, null),
      reviews: intIn(raw.reviews, 0, 100000, 0),
      lapses: intIn(raw.lapses, 0, 100000, 0),
      lastAccuracy: finite(raw.lastAccuracy) ? roundTo(clamp(raw.lastAccuracy, 0, 100), 2) : null,
      history: sanitizeHistory(raw.history, ctx),
    };
  }

  function emptyDaily() {
    return { lastDate: null, streak: 0, best: 0, history: {} };
  }

  function sanitizeDaily(raw, ctx) {
    const out = emptyDaily();
    if (!isObject(raw)) return out;
    if (isObject(raw.history)) {
      Object.keys(raw.history).slice(0, CAPS.dailyHistory * 3).forEach((key) => {
        if (FORBIDDEN_KEYS.includes(key)) return;
        const n = dayNumber(key);
        if (n === null || n > ctx.maxDay) return;
        out.history[key] = roundTo(numIn(raw.history[key], 0, 100, 0), 1);
      });
    }
    const last = typeof raw.lastDate === "string" ? dayNumber(raw.lastDate) : null;
    if (last !== null && last <= ctx.maxDay) out.lastDate = raw.lastDate;
    out.streak = intIn(raw.streak, 0, 100000, 0);
    out.best = intIn(raw.best, 0, 100000, 0);
    return normalizeDaily(out);
  }

  // History newest 120, lastDate never older than the newest history entry,
  // streak 0 without a lastDate, best >= streak.
  function normalizeDaily(daily) {
    const keys = Object.keys(daily.history).sort();
    const kept = keys.length > CAPS.dailyHistory ? keys.slice(keys.length - CAPS.dailyHistory) : keys;
    const history = {};
    kept.forEach((key) => {
      history[key] = daily.history[key];
    });
    let lastDate = daily.lastDate;
    if (kept.length && (!lastDate || kept[kept.length - 1] > lastDate)) lastDate = kept[kept.length - 1];
    // Consecutive completed days in the history are a floor for the streak, so
    // the stored streak is canonical (merging a state with itself changes nothing).
    const streak = lastDate ? Math.max(daily.streak, runEndingAt(history, lastDate)) : 0;
    return { lastDate: lastDate || null, streak, best: Math.max(daily.best, streak), history };
  }

  function emptyData(now) {
    return {
      v: DATA_VERSION,
      rounds: [],
      sessions: [],
      notebook: [],
      xp: 0,
      achievements: {},
      daily: emptyDaily(),
      days: [],
      xpLog: {},
      xpFloor: { upTo: 0, xp: 0, rounds: 0, bonuses: 0 },
      updatedAt: now || 0,
    };
  }

  function uniqueById(list) {
    const map = new Map();
    list.forEach((item) => {
      const previous = map.get(item.id);
      if (!previous || JSON.stringify(item) < JSON.stringify(previous)) map.set(item.id, item);
    });
    return Array.from(map.values());
  }

  function sanitizeList(raw, limit, fn, ctx) {
    const out = [];
    if (!Array.isArray(raw)) return out;
    raw.slice(0, limit).forEach((item) => {
      const value = fn(item);
      if (value) out.push(value);
      else ctx.dropped += 1;
    });
    return out;
  }

  function sanitizeAchievements(raw, ctx) {
    const out = {};
    if (!isObject(raw)) return out;
    Object.keys(raw).slice(0, 200).forEach((id) => {
      if (FORBIDDEN_KEYS.includes(id) || !ACHIEVEMENT_IDS.has(id)) return;
      const ts = tsOrClamp(raw[id], ctx, null);
      if (ts !== null) out[id] = ts;
    });
    return sortedMap(out);
  }

  function sanitizeDays(raw, ctx) {
    const set = new Set();
    if (Array.isArray(raw)) {
      raw.slice(0, CAPS.days * 3).forEach((key) => {
        const n = dayNumber(key);
        if (n !== null && n <= ctx.maxDay) set.add(key);
      });
    }
    return Array.from(set).sort();
  }

  function sanitizeLedger(raw, ctx) {
    const log = {};
    if (!isObject(raw)) return log;
    Object.keys(raw).slice(0, CAPS.inputMapEntries).forEach((key) => {
      if (FORBIDDEN_KEYS.includes(key) || !LEDGER_KEY_RE.test(key)) return;
      const entry = raw[key];
      if (!Array.isArray(entry) || entry.length !== 2 || !finite(entry[0])) return;
      const ts = tsIn(entry[1], ctx);
      if (ts === null) return;
      log[key] = [intIn(entry[0], 0, key.startsWith("r:") ? 100 : 200, 0), ts];
    });
    return log;
  }

  // A floor without a valid `upTo` summarizes nothing, and its xp cannot exceed
  // what the events it claims to summarize could have paid (100 per round, 200
  // per bonus).
  function sanitizeFloor(raw, ctx) {
    const empty = { upTo: 0, xp: 0, rounds: 0, bonuses: 0 };
    if (!isObject(raw) || !finite(raw.upTo) || raw.upTo < MIN_TS) return empty;
    const rounds = intIn(raw.rounds, 0, 1e6, 0);
    const bonuses = intIn(raw.bonuses, 0, 1e6, 0);
    return {
      upTo: Math.min(Math.floor(raw.upTo), ctx.maxTs),
      xp: Math.min(intIn(raw.xp, 0, 1e9, 0), rounds * 100 + bonuses * 200),
      rounds,
      bonuses,
    };
  }

  // Raw (stored or imported) -> canonical, capped, self-consistent data.
  // `xp` in the input is ignored: it is recomputed from the ledger.
  function sanitizeData(raw, ctx) {
    const src = isObject(raw) ? raw : {};
    const data = emptyData(0);
    data.rounds = uniqueById(sanitizeList(src.rounds, CAPS.inputRounds, (item) => sanitizeRound(item, ctx, false), ctx));
    data.sessions = uniqueById(sanitizeList(src.sessions, CAPS.inputSessions, (item) => sanitizeSession(item, ctx, false), ctx));
    data.notebook = uniqueById(sanitizeList(src.notebook, CAPS.inputCards, (item) => sanitizeCard(item, ctx), ctx));
    data.achievements = sanitizeAchievements(src.achievements, ctx);
    data.daily = sanitizeDaily(src.daily, ctx);
    data.days = sanitizeDays(src.days, ctx);
    data.xpLog = sanitizeLedger(src.xpLog, ctx);
    data.xpFloor = sanitizeFloor(src.xpFloor, ctx);
    data.updatedAt = tsOrClamp(src.updatedAt, ctx, 0);
    return finalizeData(data);
  }

  // ---------- Canonical form: order, caps, ledger ----------

  const roundXp = (round) => Math.round(round.points * 10);

  // Which cards go first when there are more than the cap: cleared ones, then the
  // highest box, then the least recently touched. Deterministic (id last).
  function cardEvictionOrder(a, b) {
    return ((a.clearedAt ? 0 : 1) - (b.clearedAt ? 0 : 1))
      || (b.box - a.box)
      || (a.updatedAt - b.updatedAt)
      || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }

  function capCards(cards) {
    if (cards.length <= CAPS.notebook) return cards;
    return cards.slice().sort(cardEvictionOrder).slice(cards.length - CAPS.notebook);
  }

  const cardOrder = (a, b) => (a.createdAt - b.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  // Keeps the ledger a superset of the rounds it must pay for, drops what the
  // floor already summarizes, trims to the cap advancing the floor, and derives xp.
  function rebuildLedger(data) {
    const floor = data.xpFloor;
    const log = {};
    Object.keys(data.xpLog).forEach((key) => {
      const entry = data.xpLog[key];
      if (entry[1] > floor.upTo) log[key] = entry;
    });
    data.rounds.forEach((round) => {
      const key = `r:${round.id}`;
      if (round.ts <= floor.upTo) {
        delete log[key];
        return;
      }
      log[key] = [roundXp(round), round.ts]; // the round record is the authority on its own XP
    });
    let keys = Object.keys(log);
    if (keys.length > CAPS.xpLog) {
      const entries = keys.map((key) => ({ key, xp: log[key][0], ts: log[key][1] }));
      entries.sort((a, b) => (a.ts - b.ts) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      let cut = entries.length - CAPS.xpLog;
      const lastTs = entries[cut - 1].ts;
      while (cut < entries.length && entries[cut].ts === lastTs) cut += 1; // whole timestamps only
      for (let i = 0; i < cut; i += 1) {
        floor.xp += entries[i].xp;
        if (entries[i].key.startsWith("r:")) floor.rounds += 1;
        else floor.bonuses += 1;
        delete log[entries[i].key];
      }
      floor.upTo = lastTs;
      keys = Object.keys(log);
    }
    let total = floor.xp;
    keys.forEach((key) => {
      total += log[key][0];
    });
    data.xpLog = sortedMap(log);
    data.xp = total;
  }

  function finalizeData(data) {
    if (!isSortedBy(data.rounds, byTsThenId)) data.rounds.sort(byTsThenId);
    // The ledger is rebuilt BEFORE the window cap so a round about to roll off
    // still pays its XP and still counts as a position played.
    rebuildLedger(data);
    if (data.rounds.length > CAPS.rounds) data.rounds = data.rounds.slice(data.rounds.length - CAPS.rounds);
    if (!isSortedBy(data.sessions, byTsThenId)) data.sessions.sort(byTsThenId);
    if (data.sessions.length > CAPS.sessions) data.sessions = data.sessions.slice(data.sessions.length - CAPS.sessions);
    data.notebook = capCards(data.notebook);
    if (!isSortedBy(data.notebook, cardOrder)) data.notebook.sort(cardOrder);
    const days = Array.from(new Set(data.days)).sort();
    data.days = days.length > CAPS.days ? days.slice(days.length - CAPS.days) : days;
    data.daily = normalizeDaily(data.daily);
    data.achievements = sortedMap(data.achievements);
    return data;
  }

  // ---------- Streaks ----------

  // Activity streak from the sorted list of active days. `current` is alive while
  // the last active day is today or yesterday.
  function computeStreaks(days, todayKey) {
    let best = 0;
    let run = 0;
    let previous = null;
    days.forEach((key) => {
      const n = dayNumber(key);
      if (n === null) return;
      run = previous !== null && n === previous + 1 ? run + 1 : 1;
      previous = n;
      if (run > best) best = run;
    });
    const today = dayNumber(todayKey);
    const alive = previous !== null && today !== null && previous >= today - 1;
    return {
      current: alive ? run : 0,
      best,
      lastDate: days.length ? days[days.length - 1] : null,
      activeToday: previous !== null && previous === today,
      atRisk: alive && previous === today - 1,
    };
  }

  // ---------- Merge (pure) ----------

  const canonical = (value) => JSON.stringify(value);

  function pickCanonical(a, b) {
    return canonical(a) <= canonical(b) ? a : b;
  }

  function unionById(lists, pick) {
    const map = new Map();
    lists.forEach((list) => {
      list.forEach((item) => {
        const previous = map.get(item.id);
        map.set(item.id, previous ? pick(previous, item) : item);
      });
    });
    return Array.from(map.values());
  }

  function minNonNull(a, b) {
    if (a === null || a === undefined) return b === undefined ? null : b;
    if (b === null || b === undefined) return a;
    return Math.min(a, b);
  }

  // The tie-break ignores the three fields the merge itself rewrites (history,
  // createdAt, clearedAt), otherwise merging in a different order could pick a
  // different winner and the merge would not be associative.
  function cardTieKey(card) {
    const rest = Object.assign({}, card);
    delete rest.history;
    delete rest.createdAt;
    delete rest.clearedAt;
    return canonical(rest);
  }

  function mergeCards(a, b) {
    let winner;
    if (a.updatedAt !== b.updatedAt) winner = a.updatedAt > b.updatedAt ? a : b;
    else winner = cardTieKey(a) <= cardTieKey(b) ? a : b;
    const merged = Object.assign({}, winner);
    merged.createdAt = Math.min(a.createdAt, b.createdAt);
    merged.clearedAt = minNonNull(a.clearedAt, b.clearedAt);
    const history = new Map();
    a.history.concat(b.history).forEach((entry) => history.set(historyKey(entry), entry));
    merged.history = trimHistory(Array.from(history.values()));
    return merged;
  }

  function mergeAchievements(a, b) {
    const out = {};
    [a, b].forEach((source) => {
      Object.keys(source).forEach((id) => {
        out[id] = hasOwn(out, id) ? Math.min(out[id], source[id]) : source[id];
      });
    });
    return sortedMap(out);
  }

  // Consecutive days ending at `lastDate` that are present in `history`.
  function runEndingAt(history, lastDate) {
    let n = dayNumber(lastDate);
    let run = 0;
    while (n !== null && hasOwn(history, keyFromDayNumber(n))) {
      run += 1;
      n -= 1;
    }
    return run;
  }

  function mergeDaily(a, b) {
    const history = {};
    [a.history, b.history].forEach((source) => {
      Object.keys(source).forEach((key) => {
        history[key] = hasOwn(history, key) ? Math.max(history[key], source[key]) : source[key];
      });
    });
    const lastDate = [a.lastDate, b.lastDate].filter(Boolean).sort().pop() || null;
    let streak = 0;
    if (lastDate) {
      streak = runEndingAt(history, lastDate);
      if (a.lastDate === lastDate) streak = Math.max(streak, a.streak);
      if (b.lastDate === lastDate) streak = Math.max(streak, b.streak);
    }
    return normalizeDaily({ lastDate, streak, best: Math.max(a.best, b.best, streak), history });
  }

  function lexMaxFloor(a, b) {
    const key = (f) => [f.upTo, f.xp, f.rounds, f.bonuses];
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] !== kb[i]) return ka[i] > kb[i] ? a : b;
    }
    return a;
  }

  function mergeLedgers(a, b) {
    const out = {};
    [a, b].forEach((source) => {
      Object.keys(source).forEach((key) => {
        const entry = source[key];
        const previous = out[key];
        if (!previous || entry[0] > previous[0] || (entry[0] === previous[0] && entry[1] < previous[1])) out[key] = entry;
      });
    });
    return out;
  }

  // Both inputs are already canonical (sanitizeData output). Commutative,
  // associative for practical purposes and idempotent.
  function mergeData(a, b) {
    const out = emptyData(0);
    out.rounds = unionById([a.rounds, b.rounds], pickCanonical);
    out.sessions = unionById([a.sessions, b.sessions], pickCanonical);
    out.notebook = unionById([a.notebook, b.notebook], mergeCards);
    out.achievements = mergeAchievements(a.achievements, b.achievements);
    out.daily = mergeDaily(a.daily, b.daily);
    out.days = Array.from(new Set(a.days.concat(b.days)));
    out.xpFloor = Object.assign({}, lexMaxFloor(a.xpFloor, b.xpFloor));
    out.xpLog = mergeLedgers(a.xpLog, b.xpLog);
    out.updatedAt = Math.max(a.updatedAt, b.updatedAt);
    return finalizeData(out);
  }

  // ---------- Documents (export / import / sync) ----------

  function sanitizeProfileMeta(raw, index) {
    return {
      id: typeof raw.id === "string" && PROFILE_ID_RE.test(raw.id) && !FORBIDDEN_KEYS.includes(raw.id) ? raw.id : null,
      name: cleanText(raw.name, NAME_MAX),
      color: typeof raw.color === "string" && COLOR_RE.test(raw.color) ? raw.color.toLowerCase() : PALETTE[index % PALETTE.length],
      googleSub: typeof raw.googleSub === "string" && SUB_RE.test(raw.googleSub) ? raw.googleSub : "",
    };
  }

  // Raw parsed JSON -> { ok, profiles: [{ id|null, name, color, createdAt, googleSub, data }] }
  // or { ok: false, error }. Never throws.
  function sanitizeDocument(raw, ctx) {
    if (!isObject(raw) || raw.kind !== EXPORT_KIND) return { ok: false, error: "invalid-format" };
    if (!Number.isInteger(raw.v) || raw.v < 1) return { ok: false, error: "invalid-format" };
    if (raw.v > EXPORT_VERSION) return { ok: false, error: "unsupported-version" };
    if (!Array.isArray(raw.profiles)) return { ok: false, error: "invalid-format" };
    if (raw.profiles.length === 0) return { ok: false, error: "no-profiles" };
    const profiles = [];
    raw.profiles.slice(0, MAX_PROFILES * 4).forEach((entry, index) => {
      if (profiles.length >= MAX_PROFILES * 2) return;
      if (!isObject(entry)) {
        ctx.dropped += 1;
        return;
      }
      const meta = sanitizeProfileMeta(entry, index);
      meta.createdAt = tsOrClamp(entry.createdAt, ctx, ctx.now);
      meta.data = sanitizeData(entry.data, ctx);
      profiles.push(meta);
    });
    if (profiles.length === 0) return { ok: false, error: "no-profiles" };
    return { ok: true, profiles, exportedAt: tsOrClamp(raw.exportedAt, ctx, ctx.now) };
  }

  // Profiles matched by id. The result has one entry per distinct id.
  function mergeProfileEntries(a, b) {
    const name = (entry) => entry.name;
    const later = a.data.updatedAt !== b.data.updatedAt ? (a.data.updatedAt > b.data.updatedAt ? a : b) : (canonical([a.name, a.color]) <= canonical([b.name, b.color]) ? a : b);
    return {
      id: a.id,
      name: name(later),
      color: later.color,
      googleSub: [a.googleSub, b.googleSub].filter(Boolean).sort()[0] || "",
      createdAt: Math.min(a.createdAt, b.createdAt),
      data: mergeData(a.data, b.data),
    };
  }

  function mergeDocuments(a, b) {
    const byId = new Map();
    a.profiles.concat(b.profiles).forEach((entry) => {
      if (!entry.id) return;
      const previous = byId.get(entry.id);
      byId.set(entry.id, previous ? mergeProfileEntries(previous, entry) : entry);
    });
    const profiles = Array.from(byId.values()).sort((x, y) => (x.createdAt - y.createdAt) || (x.id < y.id ? -1 : 1));
    return { ok: true, profiles, exportedAt: Math.max(a.exportedAt, b.exportedAt) };
  }

  function documentToJson(doc, includeSub) {
    return {
      kind: EXPORT_KIND,
      v: EXPORT_VERSION,
      app: EXPORT_APP,
      exportedAt: doc.exportedAt,
      profiles: doc.profiles.map((entry) => {
        const meta = { id: entry.id, name: entry.name, color: entry.color, createdAt: entry.createdAt };
        if (includeSub && entry.googleSub) meta.googleSub = entry.googleSub;
        meta.data = entry.data;
        return meta;
      }),
    };
  }

  // ---------- Stats (pure) ----------

  function bucket() {
    return { count: 0, accuracySum: 0, pointsSum: 0, errors: 0 };
  }

  function addToBucket(target, round) {
    target.count += 1;
    target.accuracySum += round.accuracy;
    target.pointsSum += round.points;
    if (round.accuracy < PASS_ACCURACY) target.errors += 1;
  }

  function bucketOut(target) {
    return {
      count: target.count,
      accuracy: target.count ? roundTo(target.accuracySum / target.count, 1) : null,
      avgPoints: target.count ? roundTo(target.pointsSum / target.count, 2) : null,
      errorRate: target.count ? roundTo(target.errors / target.count, 3) : null,
    };
  }

  function mean(list, from, to) {
    let sum = 0;
    for (let i = from; i < to; i += 1) sum += list[i].accuracy;
    return sum / (to - from);
  }

  function lifetimeRounds(data) {
    let count = data.xpFloor.rounds;
    Object.keys(data.xpLog).forEach((key) => {
      if (key.charCodeAt(0) === 114) count += 1; // "r"
    });
    return Math.max(count, data.rounds.length);
  }

  // A round that was skipped, timed out or closed by the last hint (the move was
  // shown) is a position PLAYED (it pays no XP but it is on the record and it
  // can make a notebook card), not a position SOLVED: no achievement and no
  // "solved N positions" counter may count it (COR-010). Skips and timeouts
  // carry the quality "no_move"; a revealed answer carries hintsUsed 3.
  const isUnsolvedRound = (round) => round.qualityCode === "no_move" || round.hintsUsed >= 3 || round.timedOut === true;

  // Positions solved over the whole lifetime: the ledger counts every position
  // played (including the ones that rolled out of the 600-round window), and the
  // unsolved ones still in the window are taken out. Older unsolved rounds are
  // indistinguishable from solved ones in the ledger and stay counted.
  function solvedRounds(data) {
    let unsolved = 0;
    data.rounds.forEach((round) => {
      if (isUnsolvedRound(round)) unsolved += 1;
    });
    return Math.max(0, lifetimeRounds(data) - unsolved);
  }

  // A session counts as completed only when at least one position was answered
  // with a move. Sessions without a quality breakdown (older data) are trusted.
  function sessionAnswered(session) {
    const counts = session.byQuality || {};
    const total = Object.keys(counts).reduce((sum, code) => sum + counts[code], 0);
    if (total === 0) return true;
    return total - (counts.no_move || 0) > 0;
  }

  function improvementOf(rounds) {
    const window = Math.min(IMPROVEMENT_WINDOW, Math.floor(rounds.length / 2));
    if (window < 10) return null;
    const first = mean(rounds, 0, window);
    const last = mean(rounds, rounds.length - window, rounds.length);
    return { window, first: roundTo(first, 1), last: roundTo(last, 1), delta: roundTo(last - first, 1) };
  }

  function computeStats(data, ctx, options) {
    const minTag = options && Number.isInteger(options.minTagSample) ? clamp(options.minTagSample, 1, 1000) : MIN_TAG_SAMPLE;
    const rounds = data.rounds;
    const overall = bucket();
    let timeSpentMs = 0;
    const byPhase = { opening: bucket(), middlegame: bucket(), endgame: bucket() };
    const bySource = {};
    SOURCES.forEach((source) => {
      bySource[source] = bucket();
    });
    const byQuality = {};
    QUALITY_CODES.forEach((code) => {
      byQuality[code] = 0;
    });
    const tags = new Map();
    rounds.forEach((round) => {
      addToBucket(overall, round);
      timeSpentMs += round.timeSpentMs;
      if (round.phase) addToBucket(byPhase[round.phase], round);
      addToBucket(bySource[round.source], round);
      byQuality[round.qualityCode] += 1;
      round.tags.forEach((tag) => {
        if (!tags.has(tag)) tags.set(tag, bucket());
        addToBucket(tags.get(tag), round);
      });
    });

    const phaseOut = {};
    PHASES.forEach((phase) => {
      phaseOut[phase] = bucketOut(byPhase[phase]);
    });
    const sourceOut = {};
    SOURCES.forEach((source) => {
      sourceOut[source] = bucketOut(bySource[source]);
    });
    const tagRows = Array.from(tags.entries()).map(([tag, entry]) => Object.assign({ tag }, bucketOut(entry)));
    tagRows.sort((a, b) => (b.count - a.count) || (a.tag < b.tag ? -1 : 1));
    const weakest = tagRows
      .filter((row) => row.count >= minTag)
      .sort((a, b) => (a.accuracy - b.accuracy) || (b.count - a.count) || (a.tag < b.tag ? -1 : 1))
      .slice(0, WEAKEST_TAGS);

    const trend = data.sessions.slice(-TREND_SESSIONS).map((session) => ({
      id: session.id,
      ts: session.ts,
      kind: session.kind,
      positions: session.positions,
      accuracy: session.avgAccuracy,
      points: session.points,
      maxPoints: session.maxPoints,
    }));

    const todayKey = dateKeyOf(ctx.now);
    const streaks = computeStreaks(data.days, todayKey);
    const daily = data.daily;
    const dailyGap = daily.lastDate ? dayNumber(todayKey) - dayNumber(daily.lastDate) : null;
    const dailyAlive = dailyGap !== null && dailyGap >= -1 && dailyGap <= 1;

    let cleared = 0;
    let due = 0;
    const byBox = LEITNER_DAYS.map(() => 0);
    data.notebook.forEach((card) => {
      byBox[card.box] += 1;
      if (card.clearedAt) cleared += 1;
      if (card.due <= ctx.now) due += 1;
    });

    const level = levelInfo(data.xp);
    return {
      totalPositions: lifetimeRounds(data),
      solvedPositions: solvedRounds(data),
      windowPositions: rounds.length,
      overallAccuracy: overall.count ? roundTo(overall.accuracySum / overall.count, 1) : null,
      avgPoints: overall.count ? roundTo(overall.pointsSum / overall.count, 2) : null,
      totalPoints: roundTo(overall.pointsSum, 1),
      timeSpentMs,
      avgTimeMs: overall.count ? Math.round(timeSpentMs / overall.count) : 0,
      byPhase: phaseOut,
      byTag: tagRows,
      bySource: sourceOut,
      byQuality,
      trend,
      streak: { current: streaks.current, best: streaks.best, activeToday: streaks.activeToday, atRisk: streaks.atRisk, lastDate: streaks.lastDate },
      dailyStreak: { current: dailyAlive ? daily.streak : 0, best: daily.best, lastDate: daily.lastDate },
      weakestTags: weakest,
      improvement: improvementOf(rounds),
      xp: data.xp,
      level,
      sessions: data.sessions.length,
      notebook: { total: data.notebook.length, due, cleared, byBox },
      achievements: { unlocked: Object.keys(data.achievements).length, total: ACHIEVEMENTS.length },
    };
  }

  // ---------- Achievement evaluation ----------

  function buildAchievementContext(data) {
    const memo = {};
    const lazy = (name, compute) => {
      if (!hasOwn(memo, name)) memo[name] = compute();
      return memo[name];
    };
    const roundsScan = () => lazy("scan", () => {
      const scan = { perfectMoves: 0, onlyMovesFound: 0, sacrifices: 0, matesFound: 0, quickDraws: 0, cleanSharp: 0, hotStreak: 0, sources: new Set() };
      let run = 0;
      data.rounds.forEach((round) => {
        // Accuracy ignores hints by design (the points pay for them), but a
        // "you found it" achievement must not: a hint that marked the piece or
        // the square gave the answer away (COR-002).
        const unaided = round.hintsUsed === 0 && !isUnsolvedRound(round);
        if (unaided && (PERFECT_QUALITIES.includes(round.qualityCode) || round.accuracy >= 99.5)) scan.perfectMoves += 1;
        if (unaided && round.onlyMove && round.isBest) scan.onlyMovesFound += 1;
        if (unaided && (round.qualityCode === "brilliant" || (round.isBest && round.tags.includes("sacrifice_best")))) scan.sacrifices += 1;
        if (unaided && round.isBest && round.lines.length && round.lines[0].score >= MATE_SCORE) scan.matesFound += 1;
        if (round.accuracy >= 95 && round.hintsUsed === 0 && round.timeSpentMs > 0 && round.timeSpentMs <= 5000) scan.quickDraws += 1;
        if (round.accuracy >= 90 && round.hintsUsed === 0) scan.cleanSharp += 1;
        run = unaided && round.accuracy >= HOT_STREAK_ACCURACY ? run + 1 : 0;
        if (run > scan.hotStreak) scan.hotStreak = run;
        if (!isUnsolvedRound(round)) scan.sources.add(round.source);
      });
      return scan;
    });
    const sessionsScan = () => lazy("sessions", () => {
      const scan = { classic: 0, perfect: 0, duelWins: 0 };
      data.sessions.forEach((session) => {
        if (session.kind === "classic" && sessionAnswered(session)) scan.classic += 1;
        if (isPerfectSession(session)) scan.perfect += 1;
        if (session.mode === "duel" && session.duel) {
          const me = session.duel.me === 1 ? 1 : 0;
          if (session.duel.scores[me] > session.duel.scores[1 - me]) scan.duelWins += 1;
        }
      });
      return scan;
    });
    return {
      get totalPositions() { return lazy("total", () => lifetimeRounds(data)); },
      get solvedPositions() { return lazy("solved", () => solvedRounds(data)); },
      get perfectMoves() { return roundsScan().perfectMoves; },
      get onlyMovesFound() { return roundsScan().onlyMovesFound; },
      get sacrifices() { return roundsScan().sacrifices; },
      get matesFound() { return roundsScan().matesFound; },
      get quickDraws() { return roundsScan().quickDraws; },
      get cleanSharp() { return roundsScan().cleanSharp; },
      get hotStreak() { return roundsScan().hotStreak; },
      get sourcesSeen() { return roundsScan().sources.size; },
      get classicSessions() { return sessionsScan().classic; },
      get perfectSessions() { return sessionsScan().perfect; },
      get duelWins() { return sessionsScan().duelWins; },
      get streakBest() { return lazy("streaks", () => computeStreaks(data.days, "2000-01-01").best); },
      get clearedCards() { return lazy("cleared", () => data.notebook.filter((card) => card.clearedAt).length); },
      get dailyDone() { return Object.keys(data.daily.history).length || (data.daily.best > 0 ? 1 : 0); },
      get dailyBest() { return data.daily.best; },
      get level() { return levelInfo(data.xp).level; },
      get improvementDelta() {
        return lazy("improvement", () => {
          const improvement = improvementOf(data.rounds);
          return improvement && improvement.window >= IMPROVEMENT_WINDOW ? Math.max(0, improvement.delta) : 0;
        });
      },
    };
  }

  function isPerfectSession(session) {
    return session.positions >= PERFECT_SESSION_MIN_POSITIONS && session.maxPoints > 0 && session.points >= session.maxPoints - 0.05;
  }

  function achievementEntry(def, lang, tr) {
    return {
      id: def.id,
      category: def.category,
      glyph: def.glyph,
      target: def.target,
      nameKey: `achievement.${def.id}.name`,
      descKey: `achievement.${def.id}.desc`,
      name: tr(`achievement.${def.id}.name`, null, lang),
      description: tr(`achievement.${def.id}.desc`, null, lang),
    };
  }

  // ---------- Spaced repetition ----------

  const isMistake = (round) => round.accuracy < PASS_ACCURACY
    || (round.isBest === false && MISTAKE_QUALITIES.includes(round.qualityCode));

  // A review that used ANY hint is not a pass: level 1 marks the piece, level 2
  // the square and level 3 plays the move, so the card was not recalled unaided.
  // It is treated like a failed review (box 1, due tomorrow), which is what a
  // card that needed help deserves (COR-002).
  const passesReview = (accuracy, hintsUsed) => accuracy >= PASS_ACCURACY && !(hintsUsed > 0);

  function newCardFromRound(round, now) {
    return {
      id: cardIdFor(round.fen),
      fen: round.fen,
      positionId: round.positionId,
      source: round.source,
      sideToMove: round.sideToMove,
      phase: round.phase,
      bestUci: round.bestUci,
      bestSan: round.bestSan,
      lines: clone(round.lines),
      tags: round.tags.slice(),
      meta: clone(round.meta),
      box: 0,
      due: round.ts,
      createdAt: round.ts,
      updatedAt: Math.max(now, round.ts), // never before createdAt: sanitizeCard enforces it
      lastReviewAt: null,
      clearedAt: null,
      reviews: 0,
      lapses: 0,
      lastAccuracy: round.accuracy,
      history: [{ ts: round.ts, accuracy: round.accuracy, passed: false, box: 0, roundId: round.id }],
    };
  }

  // Applies one review result to a card in place. `t` is when it happened,
  // `now` stamps updatedAt. Returns { passed, box, newlyCleared }.
  function gradeCard(card, accuracy, passed, t, now, roundId) {
    const previousBox = card.box;
    card.box = passed ? Math.min(LEITNER_DAYS.length - 1, previousBox + 1) : 1;
    if (!passed) card.lapses += 1;
    card.reviews += 1;
    card.lastReviewAt = t;
    card.lastAccuracy = roundTo(accuracy, 2);
    card.due = dueAt(card.box, t);
    card.updatedAt = Math.max(now, card.createdAt);
    let newlyCleared = false;
    if (card.box >= CLEARED_BOX && !card.clearedAt) {
      card.clearedAt = t;
      newlyCleared = true;
    }
    const entry = { ts: t, accuracy: roundTo(accuracy, 2), passed, box: card.box };
    if (roundId) entry.roundId = roundId;
    const history = new Map(card.history.map((item) => [historyKey(item), item]));
    history.set(historyKey(entry), entry);
    card.history = trimHistory(Array.from(history.values()));
    return { passed, box: card.box, newlyCleared };
  }

  function refreshCardFromRound(card, round) {
    if (round.lines.length) card.lines = clone(round.lines);
    if (round.bestUci) {
      card.bestUci = round.bestUci;
      card.bestSan = round.bestSan;
    }
    const tags = card.tags.slice();
    round.tags.forEach((tag) => {
      if (!tags.includes(tag) && tags.length < CAPS.tags) tags.push(tag);
    });
    card.tags = tags;
    if (round.phase && !card.phase) card.phase = round.phase;
  }

  // The rules of ARCHITECTURE.md section 11 for one recorded round.
  function applyRoundToNotebook(data, round, now) {
    const id = cardIdFor(round.fen);
    const card = data.notebook.find((item) => item.id === id) || null;
    // The same round never grades a card twice (an explicit grade() with this
    // roundId, or recordRound seen through two paths).
    if (card && card.history.some((entry) => entry.roundId === round.id)) return null;
    const mistake = isMistake(round);
    if (!card) {
      if (!mistake) return null;
      const created = newCardFromRound(round, now);
      data.notebook.push(created);
      return { id, created: true, updated: false, passed: null, box: 0, due: created.due, newlyCleared: false };
    }
    if (round.source === "notebook") {
      const result = gradeCard(card, round.accuracy, passesReview(round.accuracy, round.hintsUsed), round.ts, now, round.id);
      refreshCardFromRound(card, round);
      return { id, created: false, updated: true, passed: result.passed, box: card.box, due: card.due, newlyCleared: result.newlyCleared };
    }
    if (mistake) {
      const result = gradeCard(card, round.accuracy, false, round.ts, now, round.id);
      refreshCardFromRound(card, round);
      return { id, created: false, updated: true, passed: false, box: card.box, due: card.due, newlyCleared: result.newlyCleared };
    }
    // A good answer outside the notebook only counts once the card is due, so
    // meeting the same position again cannot skip the spacing.
    if (passesReview(round.accuracy, round.hintsUsed) && card.due <= round.ts) {
      const result = gradeCard(card, round.accuracy, true, round.ts, now, round.id);
      return { id, created: false, updated: true, passed: true, box: card.box, due: card.due, newlyCleared: result.newlyCleared };
    }
    return null;
  }

  // ---------- Size management ----------

  const sizeOf = (data) => JSON.stringify(data).length;

  function slimRounds(data, keepNewest) {
    const cut = Math.max(0, data.rounds.length - keepNewest);
    for (let i = 0; i < cut; i += 1) {
      data.rounds[i].lines = [];
      data.rounds[i].meta = {};
    }
  }

  function slimCards(data) {
    data.notebook.forEach((card) => {
      card.history = card.history.slice(-8);
      card.lines = card.lines.slice(0, 2).map((line) => Object.assign({}, line, { pv: line.pv.slice(0, 4) }));
    });
  }

  // Last resort for card detail: the position, the box and the best move stay;
  // a card is still fully usable for review.
  function slimCardsHard(data) {
    data.notebook.forEach((card) => {
      card.history = card.history.slice(-4).map((entry) => ({ ts: entry.ts, accuracy: entry.accuracy, passed: entry.passed, box: entry.box }));
      card.lines = card.lines.slice(0, 1).map((line) => Object.assign({}, line, { pv: line.pv.slice(0, 3) }));
      card.meta = card.meta.players ? { players: card.meta.players } : {};
    });
  }

  function dropOldestRounds(data, fraction) {
    const drop = Math.min(data.rounds.length, Math.max(1, Math.ceil(data.rounds.length * fraction)));
    data.rounds = data.rounds.slice(drop); // their XP stays in the ledger
  }

  // Squeezes `data` under `budget` characters: cheapest information first
  // (analysis lines and metadata of old rounds, then card detail), and only then
  // whole old records. Progress (xp, positions, achievements, days) is never lost.
  function fitBudget(data, budget, force) {
    if (!force && data.rounds.length + data.notebook.length <= 150) return false;
    if (sizeOf(data) <= budget) return false;
    const steps = [
      () => slimRounds(data, 100),
      () => slimCards(data),
      () => slimRounds(data, 0),
      () => slimCardsHard(data),
      () => dropOldestRounds(data, 0.25),
      () => dropOldestRounds(data, 0.34),
    ];
    for (const step of steps) {
      step();
      if (sizeOf(data) <= budget) return true;
    }
    for (let guard = 0; guard < 40; guard += 1) {
      if (data.rounds.length > 20) dropOldestRounds(data, 0.3);
      else if (data.sessions.length > 20) data.sessions = data.sessions.slice(Math.ceil(data.sessions.length * 0.3));
      else if (data.notebook.length > 0) data.notebook = data.notebook.slice().sort(cardEvictionOrder).slice(Math.ceil(data.notebook.length * 0.2)).sort(cardOrder);
      else break;
      if (sizeOf(data) <= budget) break;
    }
    return true;
  }

  // ---------- The store ----------

  function createInstance(env) {
    const options = env || {};
    const ABSENT = Object.freeze({});
    let indexCache = null;
    let indexReadOnly = false;
    const dataCache = new Map();
    const readOnlyIds = new Set();
    let lastError = "";
    let listening = false;
    let detachFns = [];

    // ----- environment (all resolved at call time) -----

    const getLudus = () => root.Ludus || {};
    const getStorage = () => options.storage || getLudus().storage || null;
    const getBus = () => options.bus || getLudus().bus || null;
    const nowMs = () => {
      if (typeof options.now === "function") return options.now();
      const util = getLudus().util;
      return util && typeof util.now === "function" ? util.now() : Date.now();
    };
    const newId = (prefix) => {
      if (typeof options.uid === "function") return options.uid(prefix);
      const util = getLudus().util;
      return util && typeof util.uid === "function" ? util.uid(prefix) : fallbackUid(prefix);
    };
    const tr = (key, params, lang) => {
      try {
        const i18n = options.i18n || getLudus().i18n;
        return i18n ? i18n.t(key, params, lang) : key;
      } catch (error) {
        return key;
      }
    };
    const strict = () => strictCtx(nowMs(), newId);
    const trusted = () => trustedCtx(nowMs(), newId);

    function safeGet(key, fallback) {
      try {
        const storage = getStorage();
        return storage ? storage.get(key, fallback) : fallback;
      } catch (error) {
        return fallback;
      }
    }

    function safeSet(key, value) {
      let done = false;
      try {
        const storage = getStorage();
        done = Boolean(storage) && storage.set(key, value) === true;
      } catch (error) {
        done = false;
      }
      if (done) health.ok = true;
      else health.pendingKey = typeof key === "string" ? key : "";
      return done;
    }

    function safeRemove(key) {
      try {
        const storage = getStorage();
        if (storage) storage.remove(key);
        return true;
      } catch (error) {
        return false;
      }
    }

    function emit(evt, payload) {
      try {
        const bus = getBus();
        if (bus) bus.emit(evt, payload);
      } catch (error) {
        // A listener problem must never undo a stored change.
      }
    }

    const dataKey = (id) => `${DATA_PREFIX}${id}${DATA_SUFFIX}`;

    function fail(code) {
      lastError = code;
      if (code === "storage") noteStorageFailure();
      return false;
    }

    // ----- storage health (UX-007, PERF-009, COR-004) -----
    //
    // The game keeps going when the browser refuses to store anything (private
    // mode, blocked site data, a full quota): rounds are scored and celebrated
    // but nothing is saved. Nothing else may pretend otherwise, so a failed
    // operation is counted here and announced ONCE per page load on the bus as
    // "storage:failed" { reason: "blocked" | "quota", key, at } (also at attach()
    // when storage was unusable from the start). A screen that mounts later asks
    // storageStatus() instead. `ok` is about the LAST write (it turns true again
    // when a later write succeeds), the counters are cumulative since load.
    const health = { ok: true, failures: 0, unsavedRounds: 0, unsavedSessions: 0, lastFailureAt: 0, lastFailureKey: "", reason: "", pendingKey: "", announced: false };

    function storageUsable() {
      try {
        const storage = getStorage();
        return Boolean(storage) && storage.available !== false;
      } catch (error) {
        return false;
      }
    }

    function announceStorageFailure() {
      if (health.announced) return;
      health.announced = true;
      emit("storage:failed", { reason: health.reason || "quota", key: health.lastFailureKey, at: health.lastFailureAt });
    }

    function noteStorageFailure() {
      health.ok = false;
      health.failures += 1;
      health.lastFailureAt = nowMs();
      health.lastFailureKey = health.pendingKey;
      health.reason = storageUsable() ? "quota" : "blocked";
      announceStorageFailure();
    }

    function storageStatus() {
      const available = storageUsable();
      const ok = available && health.ok;
      return {
        ok,
        available,
        reason: ok ? "" : (available ? health.reason || "quota" : "blocked"),
        failures: health.failures,
        unsavedRounds: health.unsavedRounds,
        unsavedSessions: health.unsavedSessions,
        lastFailureAt: health.lastFailureAt,
        lastFailureKey: health.lastFailureKey,
        recovered: ok && health.failures > 0,
      };
    }

    function defaultName() {
      const name = cleanText(tr("profile.defaultName"), NAME_MAX);
      return name && name !== "profile.defaultName" ? name : "Player";
    }

    // ----- index -----

    function sanitizeIndex(raw, ctx) {
      const out = { v: INDEX_VERSION, active: null, profiles: [] };
      if (!isObject(raw) || raw.v !== INDEX_VERSION || !Array.isArray(raw.profiles)) return out;
      const seen = new Set();
      raw.profiles.slice(0, MAX_PROFILES * 4).forEach((entry) => {
        if (out.profiles.length >= MAX_PROFILES || !isObject(entry)) return;
        const meta = sanitizeProfileMeta(entry, out.profiles.length);
        if (!meta.id || seen.has(meta.id)) return;
        seen.add(meta.id);
        const profile = {
          id: meta.id,
          name: meta.name || defaultName(),
          color: meta.color,
          createdAt: tsOrClamp(entry.createdAt, ctx, ctx.now),
        };
        if (meta.googleSub) profile.googleSub = meta.googleSub;
        out.profiles.push(profile);
      });
      out.active = typeof raw.active === "string" && seen.has(raw.active) ? raw.active : (out.profiles[0] ? out.profiles[0].id : null);
      return out;
    }

    function readIndex() {
      if (indexCache) return indexCache;
      attachStorageListener();
      const raw = safeGet(INDEX_KEY, null);
      indexReadOnly = isObject(raw) && Number.isInteger(raw.v) && raw.v > INDEX_VERSION;
      indexCache = sanitizeIndex(raw, trusted());
      return indexCache;
    }

    function publicProfile(profile, index) {
      const out = { id: profile.id, name: profile.name, color: profile.color, createdAt: profile.createdAt, active: profile.id === index.active };
      if (profile.googleSub) out.googleSub = profile.googleSub;
      return out;
    }

    function mutateIndex(fn) {
      readIndex();
      if (indexReadOnly) return fail("read-only");
      const next = clone(indexCache);
      if (fn(next) === false) return false;
      if (!safeSet(INDEX_KEY, next)) return fail("storage");
      indexCache = next;
      return true;
    }

    function uniqueProfileId(taken) {
      for (let i = 0; i < 50; i += 1) {
        const id = newId("p_");
        if (PROFILE_ID_RE.test(id) && !taken.has(id) && !FORBIDDEN_KEYS.includes(id)) return id;
      }
      return `p_${hashString(String(nowMs()) + taken.size)}`;
    }

    function indexIds() {
      return new Set(readIndex().profiles.map((profile) => profile.id));
    }

    // ----- data -----

    function readData(id) {
      if (dataCache.has(id)) return dataCache.get(id);
      attachStorageListener();
      const raw = safeGet(dataKey(id), null);
      if (isObject(raw) && Number.isInteger(raw.v) && raw.v > DATA_VERSION) readOnlyIds.add(id);
      const data = raw === null ? emptyData(nowMs()) : sanitizeData(raw, trusted());
      dataCache.set(id, data);
      return data;
    }

    // Caps, ledger, budget. Returns nothing; `data` is finalized in place.
    function prepareData(data, evaluate) {
      finalizeData(data);
      let unlocked = [];
      if (evaluate) unlocked = evaluateAchievements(data, nowMs());
      fitBudget(data, PROFILE_BUDGET_CHARS, false);
      return unlocked;
    }

    function writeData(id, data) {
      if (safeSet(dataKey(id), data)) return true;
      // Most likely the quota. Squeeze harder once and try again.
      fitBudget(data, Math.floor(PROFILE_BUDGET_CHARS / 2), true);
      finalizeData(data);
      return safeSet(dataKey(id), data);
    }

    // Runs `fn(data, tx)` on the cached data, persists, then announces. When the
    // write fails the cache is dropped, so memory goes back to what is stored:
    // a failed change never half-applies.
    function mutate(id, fn, evaluate) {
      const data = readData(id);
      if (readOnlyIds.has(id)) {
        fail("read-only");
        return null;
      }
      const tx = { persist: true, unlocked: [], notebook: false, result: null };
      try {
        fn(data, tx);
        if (tx.persist) {
          tx.unlocked = prepareData(data, evaluate !== false);
          data.updatedAt = nowMs();
          if (!writeData(id, data)) {
            dataCache.delete(id);
            fail("storage");
            return null;
          }
        }
      } catch (error) {
        dataCache.delete(id);
        fail("internal");
        if (options.rethrow) throw error; // tests: surface bugs instead of swallowing them
        return null;
      }
      if (tx.persist) announce(id, data, tx);
      return tx;
    }

    function dueCount(data, now) {
      let due = 0;
      data.notebook.forEach((card) => {
        if (card.due <= now) due += 1;
      });
      return due;
    }

    function announce(id, data, tx) {
      emit("profile:changed", { profileId: id });
      if (tx.notebook) emit("notebook:changed", { count: data.notebook.length, due: dueCount(data, nowMs()), profileId: id });
      tx.unlocked.forEach((achievementId) => {
        const def = ACHIEVEMENTS.find((item) => item.id === achievementId);
        emit("achievement:unlocked", { achievement: Object.assign(achievementEntry(def, undefined, tr), { ts: data.achievements[achievementId] }), profileId: id });
      });
    }

    // Unlocks (in place) every achievement the data already earns; `dry` only reports them.
    function evaluateAchievements(data, now, dry) {
      const context = buildAchievementContext(data);
      const unlocked = [];
      ACHIEVEMENTS.forEach((def) => {
        if (hasOwn(data.achievements, def.id)) return;
        if (def.measure(context) >= def.target) {
          if (!dry) data.achievements[def.id] = now;
          unlocked.push(def.id);
        }
      });
      if (unlocked.length && !dry) data.achievements = sortedMap(data.achievements);
      return unlocked;
    }

    // ----- resolving which profile an API call means -----

    function resolveRead(id) {
      const index = readIndex();
      if (typeof id === "string" && id) return index.profiles.some((profile) => profile.id === id) ? id : null;
      return index.active;
    }

    // Which profile a write means. An omitted id (undefined, null or "") means the
    // active profile, created on first use. An id that is NAMED but unknown (the
    // profile was deleted in another tab while a session was still running) is
    // never redirected: crediting one person's rounds to whoever happens to be
    // active, or to a fresh "Player", is worse than refusing. It answers null
    // with lastError "unknown-profile" (COR-009).
    function resolveWrite(id) {
      const index = readIndex();
      if (id !== undefined && id !== null && id !== "") {
        if (typeof id === "string" && index.profiles.some((profile) => profile.id === id)) return id;
        fail("unknown-profile");
        return null;
      }
      const profile = ensureActive();
      return profile ? profile.id : null;
    }

    // ----- profiles -----

    function list() {
      const index = readIndex();
      return index.profiles.map((profile) => publicProfile(profile, index));
    }

    function active() {
      const index = readIndex();
      const profile = index.profiles.find((item) => item.id === index.active);
      return profile ? publicProfile(profile, index) : null;
    }

    function pickColor(index, requested) {
      if (typeof requested === "string" && COLOR_RE.test(requested)) return requested.toLowerCase();
      const used = new Set(index.profiles.map((profile) => profile.color));
      return PALETTE.find((color) => !used.has(color)) || PALETTE[index.profiles.length % PALETTE.length];
    }

    function createProfile(input) {
      lastError = "";
      const spec = isObject(input) ? input : {};
      const index = readIndex();
      if (indexReadOnly) return fail("read-only") || null;
      if (index.profiles.length >= MAX_PROFILES) return fail("limit") || null;
      const now = nowMs();
      const taken = new Set(index.profiles.map((item) => nameKey(item.name)));
      // A name that was typed must be free; a name nobody typed (the default) is numbered instead of refused: "Player", "Player 2".
      const typed = cleanText(spec.name, NAME_MAX);
      if (typed && nameKey(typed) && taken.has(nameKey(typed))) return fail("duplicate-name") || null;
      const profile = {
        id: uniqueProfileId(indexIds()),
        name: typed && nameKey(typed) ? typed : freeName(taken, defaultName()),
        color: pickColor(index, spec.color),
        createdAt: now,
      };
      const data = emptyData(now);
      // Data first, index second: a failure in between leaves an orphan key at
      // worst, never an index entry without data.
      if (!safeSet(dataKey(profile.id), data)) return fail("storage") || null;
      const next = clone(index);
      next.profiles.push(profile);
      if (!next.active) next.active = profile.id;
      if (!safeSet(INDEX_KEY, next)) {
        safeRemove(dataKey(profile.id));
        return fail("storage") || null;
      }
      indexCache = next;
      dataCache.set(profile.id, data);
      emit("profile:changed", { profileId: profile.id });
      return publicProfile(profile, next);
    }

    function rename(id, name) {
      lastError = "";
      const clean = cleanText(name, NAME_MAX);
      if (!clean || !nameKey(clean)) return fail("invalid-name");
      if (!indexIds().has(id)) return fail("not-found");
      const done = mutateIndex((index) => {
        // Another profile may not carry the same name; the profile itself may change the case or the spaces of its own.
        if (index.profiles.some((profile) => profile.id !== id && nameKey(profile.name) === nameKey(clean))) return fail("duplicate-name");
        index.profiles.find((profile) => profile.id === id).name = clean;
      });
      if (done) emit("profile:changed", { profileId: id });
      return done;
    }

    function setGoogleSub(id, sub) {
      lastError = "";
      if (!indexIds().has(id)) return fail("not-found");
      if (sub !== null && sub !== "" && !(typeof sub === "string" && SUB_RE.test(sub))) return fail("invalid-name");
      const done = mutateIndex((index) => {
        const profile = index.profiles.find((item) => item.id === id);
        if (sub) profile.googleSub = sub;
        else delete profile.googleSub;
      });
      if (done) emit("profile:changed", { profileId: id });
      return done;
    }

    function setActive(id) {
      lastError = "";
      if (!indexIds().has(id)) return fail("not-found");
      if (readIndex().active === id) return true;
      const done = mutateIndex((index) => {
        index.active = id;
      });
      if (done) emit("profile:changed", { profileId: id });
      return done;
    }

    function remove(id) {
      lastError = "";
      if (!indexIds().has(id)) return fail("not-found");
      const before = readIndex().active;
      const done = mutateIndex((index) => {
        index.profiles = index.profiles.filter((profile) => profile.id !== id);
        if (index.active === id) index.active = index.profiles[0] ? index.profiles[0].id : null;
      });
      if (!done) return false;
      safeRemove(dataKey(id));
      dataCache.delete(id);
      readOnlyIds.delete(id);
      emit("profile:changed", { profileId: id });
      const after = readIndex().active;
      if (before === id && after) emit("profile:changed", { profileId: after });
      return true;
    }

    function ensureActive() {
      const index = readIndex();
      const current = index.profiles.find((profile) => profile.id === index.active);
      if (current) return publicProfile(current, index);
      if (index.profiles.length) {
        setActive(index.profiles[0].id);
        return active();
      }
      return createProfile({ name: defaultName() });
    }

    // ----- records -----

    function fromMutation(tx, id, extra) {
      const data = dataCache.get(id);
      const after = data ? levelInfo(data.xp) : null;
      return Object.assign({ ok: true, profileId: id, unlocked: tx.unlocked.map((achievementId) => achievementEntry(ACHIEVEMENTS.find((def) => def.id === achievementId), undefined, tr)), level: after }, extra);
    }

    function recordRound(input) {
      lastError = "";
      const id = resolveWrite(input && input.profileId);
      if (!id) {
        // No profile could be made for it because nothing can be stored: still a lost round.
        if (lastError === "storage") health.unsavedRounds += 1;
        return lastError ? false : fail("no-profile");
      }
      const ctx = strict();
      const round = sanitizeRound(input, ctx, true);
      if (!round) return fail("invalid-round");
      const returned = clone(round); // taken now: compaction may slim the stored copy
      let xpBefore = 0;
      let card = null;
      let gained = 0;
      let bonusXp = 0;
      const tx = mutate(id, (data, state) => {
        if (data.rounds.some((item) => item.id === round.id)) {
          state.persist = false;
          state.duplicate = true;
          return;
        }
        xpBefore = data.xp;
        data.rounds.push(round);
        gained = roundXp(round);
        data.xpLog[`r:${round.id}`] = [gained, round.ts];
        const today = dateKeyOf(ctx.now);
        const dayKey = dateKeyOf(round.ts);
        if (!data.days.includes(dayKey)) {
          data.days.push(dayKey);
          data.days.sort();
          if (dayKey === today) {
            const streaks = computeStreaks(data.days, today);
            if (streaks.current >= 2) {
              bonusXp = Math.min(STREAK_BONUS_MAX, streaks.current * STREAK_BONUS_STEP);
              data.xpLog[`b:streak:${dayKey}`] = [bonusXp, ctx.now];
            }
          }
        }
        card = applyRoundToNotebook(data, round, ctx.now);
        state.notebook = Boolean(card);
      });
      if (!tx) {
        if (lastError === "storage") health.unsavedRounds += 1;
        return false;
      }
      if (tx.duplicate) return { ok: true, duplicate: true, profileId: id, round: returned, xpGained: 0, card: null, unlocked: [], level: levelInfo(dataCache.get(id).xp), levelUp: false };
      const result = fromMutation(tx, id, { round: returned, xpGained: gained + bonusXp, bonusXp, card });
      result.levelUp = result.level.level > levelInfo(xpBefore).level;
      return result;
    }

    // Sessions are stored for the profile(s) that played them. A duel that names
    // two local profiles in `duel.profileIds` (or `profileIds`) is recorded for
    // both (one write per profile: if the second fails the first stays and the
    // call reports false); otherwise the session belongs to session.profileId or
    // the active profile, and that player counts as player 1 (`duel.me` = 0).
    function sessionTargets(session) {
      const index = readIndex();
      const known = new Set(index.profiles.map((profile) => profile.id));
      const pair = (isObject(session.duel) && Array.isArray(session.duel.profileIds) ? session.duel.profileIds : Array.isArray(session.profileIds) ? session.profileIds : []).slice(0, 2);
      if (session.mode === "duel" && pair.length === 2 && pair.some((value) => known.has(value))) {
        const targets = [];
        pair.forEach((value, me) => {
          if (known.has(value) && !targets.some((target) => target.id === value)) targets.push({ id: value, me });
        });
        return targets;
      }
      // A duel that names local profiles, none of which exists any more, is not
      // redirected to the active profile either (COR-009).
      const named = pair.filter((value) => typeof value === "string" && value);
      if (session.mode === "duel" && named.length && !named.some((value) => known.has(value))) {
        fail("unknown-profile");
        return [];
      }
      const id = resolveWrite(session.profileId);
      return id ? [{ id, me: 0 }] : [];
    }

    function recordSession(input) {
      lastError = "";
      if (!isObject(input)) return fail("invalid-session");
      const ctx = strict();
      const base = sanitizeSession(input, ctx, true);
      if (!base) return fail("invalid-session");
      const targets = sessionTargets(input);
      if (!targets.length) {
        if (lastError === "storage") health.unsavedSessions += 1;
        return lastError ? false : fail("no-profile");
      }
      let first = null;
      for (const target of targets) {
        const session = clone(base);
        if (session.duel) session.duel.me = target.me;
        let bonusXp = 0;
        let xpBefore = 0;
        const tx = mutate(target.id, (data, state) => {
          if (data.sessions.some((item) => item.id === session.id)) {
            state.persist = false;
            state.duplicate = true;
            return;
          }
          xpBefore = data.xp;
          data.sessions.push(session);
          if (isPerfectSession(session)) {
            bonusXp = PERFECT_SESSION_XP;
            data.xpLog[`b:session:${session.id}`] = [bonusXp, ctx.now];
          }
        });
        if (!tx) {
          if (lastError === "storage") health.unsavedSessions += 1;
          return false;
        }
        const result = tx.duplicate
          ? { ok: true, duplicate: true, profileId: target.id, unlocked: [], level: levelInfo(dataCache.get(target.id).xp), levelUp: false }
          : fromMutation(tx, target.id, {});
        result.session = clone(session);
        result.xpGained = bonusXp;
        if (!tx.duplicate) result.levelUp = result.level.level > levelInfo(xpBefore).level;
        if (!first) first = result;
      }
      return first;
    }

    function rounds(id, opts) {
      const target = resolveRead(id);
      if (!target) return [];
      const o = isObject(opts) ? opts : {};
      let out = readData(target).rounds;
      if (o.source) out = out.filter((round) => round.source === o.source);
      if (finite(o.since)) out = out.filter((round) => round.ts >= o.since);
      out = out.slice().reverse();
      if (Number.isInteger(o.limit) && o.limit >= 0) out = out.slice(0, o.limit);
      return clone(out);
    }

    function sessions(id, opts) {
      const target = resolveRead(id);
      if (!target) return [];
      const o = isObject(opts) ? opts : {};
      let out = readData(target).sessions.slice().reverse();
      if (Number.isInteger(o.limit) && o.limit >= 0) out = out.slice(0, o.limit);
      return clone(out);
    }

    function stats(id, opts) {
      const target = resolveRead(id);
      const ctx = { now: nowMs() };
      const data = target ? readData(target) : emptyData(ctx.now);
      const out = computeStats(data, ctx, opts);
      out.level = levelFor(out.xp);
      out.profileId = target;
      return out;
    }

    function levelFor(xp, lang) {
      const info = levelInfo(xp);
      info.title = tr("profile.level.title", { rank: tr(info.rankKey, null, lang), sub: info.roman }, lang);
      return info;
    }

    // ----- notebook -----

    function notebookTarget(profileId) {
      return resolveRead(profileId);
    }

    function cardsOf(profileId) {
      const target = notebookTarget(profileId);
      return target ? readData(target).notebook : [];
    }

    function notebookList(filter) {
      const f = isObject(filter) ? filter : {};
      const now = finite(f.now) ? f.now : nowMs();
      let cards = cardsOf(f.profileId);
      const tagWanted = [];
      if (typeof f.tag === "string") tagWanted.push(f.tag);
      if (Array.isArray(f.tags)) f.tags.forEach((tag) => typeof tag === "string" && tagWanted.push(tag));
      const boxWanted = [];
      if (Number.isInteger(f.box)) boxWanted.push(f.box);
      if (Array.isArray(f.boxes)) f.boxes.forEach((box) => Number.isInteger(box) && boxWanted.push(box));
      const query = typeof f.query === "string" ? f.query.trim().toLowerCase() : "";
      cards = cards.filter((card) => {
        if (tagWanted.length && !tagWanted.some((tag) => card.tags.includes(tag))) return false;
        if (typeof f.phase === "string" && card.phase !== f.phase) return false;
        if (typeof f.source === "string" && card.source !== f.source) return false;
        if (boxWanted.length && !boxWanted.includes(card.box)) return false;
        if (f.dueOnly === true && card.due > now) return false;
        if (f.cleared === true && !card.clearedAt) return false;
        if (f.cleared === false && card.clearedAt) return false;
        if (query) {
          const haystack = `${card.meta.players || ""} ${card.meta.event || ""} ${card.bestSan || ""} ${card.tags.join(" ")}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      });
      const sorters = {
        due: (a, b) => (a.due - b.due) || (a.box - b.box) || (a.id < b.id ? -1 : 1),
        created: (a, b) => (b.createdAt - a.createdAt) || (a.id < b.id ? -1 : 1),
        box: (a, b) => (a.box - b.box) || (a.due - b.due) || (a.id < b.id ? -1 : 1),
        accuracy: (a, b) => ((a.lastAccuracy === null ? 101 : a.lastAccuracy) - (b.lastAccuracy === null ? 101 : b.lastAccuracy)) || (a.id < b.id ? -1 : 1),
      };
      cards = cards.slice().sort(typeof f.sort === "string" && hasOwn(sorters, f.sort) ? sorters[f.sort] : sorters.due);
      const offset = Number.isInteger(f.offset) && f.offset > 0 ? f.offset : 0;
      if (offset) cards = cards.slice(offset);
      if (Number.isInteger(f.limit) && f.limit >= 0) cards = cards.slice(0, f.limit);
      return clone(cards);
    }

    function notebookGet(id, profileId) {
      const card = cardsOf(profileId).find((item) => item.id === id);
      return card ? clone(card) : null;
    }

    function notebookDue(now, limit, profileId) {
      const at = finite(now) ? now : nowMs();
      const cap = Number.isInteger(limit) && limit >= 0 ? limit : Infinity;
      return notebookList({ dueOnly: true, now: at, limit: cap === Infinity ? undefined : cap, profileId });
    }

    function notebookCounts(now, profileId) {
      const at = finite(now) ? now : nowMs();
      const cards = cardsOf(profileId);
      const byBox = LEITNER_DAYS.map(() => 0);
      let due = 0;
      let cleared = 0;
      let fresh = 0;
      cards.forEach((card) => {
        byBox[card.box] += 1;
        if (card.due <= at) due += 1;
        if (card.clearedAt) cleared += 1;
        if (card.reviews === 0) fresh += 1;
      });
      return { total: cards.length, due, cleared, new: fresh, byBox };
    }

    // Adds a card for the position of `input` (a RoundRecord-like object)
    // regardless of the mistake threshold: "save this to my notebook".
    function notebookAdd(input, profileId) {
      lastError = "";
      const id = resolveWrite(profileId || (input && input.profileId));
      if (!id) return lastError ? null : (fail("no-profile") || null);
      const ctx = strict();
      const spec = isObject(input) && !finite(input.accuracy) && !finite(input.points) ? Object.assign({}, input, { accuracy: 0 }) : input;
      const round = sanitizeRound(spec, ctx, true);
      if (!round) return fail("invalid-round") || null;
      let out = null;
      const tx = mutate(id, (data, state) => {
        const existing = data.notebook.find((card) => card.id === cardIdFor(round.fen));
        if (existing) {
          out = clone(existing);
          state.persist = false;
          return;
        }
        const card = newCardFromRound(round, ctx.now);
        data.notebook.push(card);
        out = clone(card);
        state.notebook = true;
      }, false);
      return tx ? out : null;
    }

    function notebookRemove(id, profileId) {
      lastError = "";
      const target = notebookTarget(profileId);
      if (!target) return fail("no-profile");
      if (!readData(target).notebook.some((card) => card.id === id)) return fail("not-found");
      const tx = mutate(target, (data, state) => {
        data.notebook = data.notebook.filter((card) => card.id !== id);
        state.notebook = true;
      }, false);
      return Boolean(tx);
    }

    // Explicit review result. `extra` is a profile id or { profileId, hintsUsed, roundId }.
    function notebookGrade(id, accuracy, now, extra) {
      lastError = "";
      const o = typeof extra === "string" ? { profileId: extra } : (isObject(extra) ? extra : {});
      const target = notebookTarget(o.profileId);
      if (!target) return fail("no-profile");
      if (!finite(accuracy)) return fail("invalid-accuracy");
      if (!readData(target).notebook.some((card) => card.id === id)) return fail("not-found");
      const t = finite(now) ? Math.floor(now) : nowMs();
      const acc = clamp(accuracy, 0, 100);
      let result = null;
      const roundId = idOrNull(o.roundId);
      const tx = mutate(target, (data, state) => {
        const card = data.notebook.find((item) => item.id === id);
        const seen = roundId ? card.history.find((entry) => entry.roundId === roundId) : null;
        if (seen) {
          // Already applied (recordRound got there first): report, do not grade again.
          result = { ok: true, duplicate: true, card: clone(card), passed: seen.passed, box: card.box, due: card.due, newlyCleared: false };
          state.persist = false;
          return;
        }
        const outcome = gradeCard(card, acc, passesReview(acc, intIn(o.hintsUsed, 0, 3, 0)), t, nowMs(), roundId);
        result = { ok: true, card: clone(card), passed: outcome.passed, box: card.box, due: card.due, newlyCleared: outcome.newlyCleared };
        state.notebook = true;
      });
      if (!tx) return false;
      result.unlocked = fromMutation(tx, target, {}).unlocked;
      return result;
    }

    // ----- achievements -----

    function catalog(lang) {
      return ACHIEVEMENTS.map((def) => achievementEntry(def, lang, tr));
    }

    function unlockedList(id, lang) {
      const target = resolveRead(id);
      if (!target) return [];
      const map = readData(target).achievements;
      return ACHIEVEMENTS
        .filter((def) => hasOwn(map, def.id))
        .map((def) => Object.assign(achievementEntry(def, lang, tr), { ts: map[def.id] }))
        .sort((a, b) => (a.ts - b.ts) || (a.id < b.id ? -1 : 1));
    }

    function achievementProgress(id) {
      const target = resolveRead(id);
      const data = target ? readData(target) : emptyData(0);
      const context = buildAchievementContext(data);
      const out = {};
      ACHIEVEMENTS.forEach((def) => {
        const unlocked = hasOwn(data.achievements, def.id);
        out[def.id] = { current: unlocked ? def.target : Math.min(def.target, Math.max(0, roundTo(def.measure(context), 1))), target: def.target, unlocked };
      });
      return out;
    }

    // Unlocks whatever the data already earns; returns the newly unlocked.
    function evaluate(id) {
      lastError = "";
      const target = resolveRead(id);
      if (!target) return [];
      if (!evaluateAchievements(readData(target), nowMs(), true).length) return [];
      const tx = mutate(target, () => {}, true);
      if (!tx) return [];
      return fromMutation(tx, target, {}).unlocked;
    }

    // ----- daily challenge -----

    function toDateKey(input) {
      if (typeof input === "string") return dayNumber(input) === null ? null : input;
      if (input instanceof Date && !Number.isNaN(input.getTime())) return dateKeyOf(input.getTime());
      if (finite(input)) return dateKeyOf(input);
      if (input === undefined) return dateKeyOf(nowMs());
      return null;
    }

    function dailyStatus(date, profileId) {
      const key = toDateKey(date);
      if (!key) return null;
      const target = resolveRead(profileId);
      const daily = target ? readData(target).daily : emptyDaily();
      const gap = daily.lastDate ? dayNumber(key) - dayNumber(daily.lastDate) : null;
      const done = hasOwn(daily.history, key);
      const alive = gap !== null && (gap === 0 || gap === 1);
      return {
        date: key,
        done,
        accuracy: done ? daily.history[key] : null,
        streak: alive ? daily.streak : 0,
        best: daily.best,
        lastDate: daily.lastDate,
        atRisk: alive && gap === 1 && !done,
      };
    }

    // Marks the daily challenge of `date` done. Only yesterday, today and tomorrow
    // are accepted (time zones, playing across midnight), so the streak cannot be
    // back-filled. Completing the same day twice changes nothing but a better score.
    function dailyComplete(date, accuracy, profileId) {
      lastError = "";
      const key = toDateKey(date);
      if (!key) return fail("invalid-date");
      if (!finite(accuracy)) return fail("invalid-accuracy");
      const now = nowMs();
      const today = dayNumber(dateKeyOf(now));
      const n = dayNumber(key);
      if (n < today - 1 || n > today + 1) return fail("date-out-of-range");
      const id = resolveWrite(profileId);
      if (!id) return lastError ? false : fail("no-profile");
      const known = readData(id).daily;
      // Nothing earlier than the last completed day: that would back-fill the streak.
      if (known.lastDate && n < dayNumber(known.lastDate)) return fail("date-out-of-range");
      const acc = roundTo(clamp(accuracy, 0, 100), 1);
      let already = false;
      let gained = 0;
      let xpBefore = 0;
      const tx = mutate(id, (data, state) => {
        xpBefore = data.xp;
        const daily = data.daily;
        if (hasOwn(daily.history, key)) {
          already = true;
          if (acc > daily.history[key]) daily.history[key] = acc;
          else state.persist = false;
          return;
        }
        daily.history[key] = acc;
        if (!daily.lastDate || n > dayNumber(daily.lastDate)) {
          daily.streak = daily.lastDate && n - dayNumber(daily.lastDate) === 1 ? daily.streak + 1 : 1;
          daily.lastDate = key;
        }
        daily.best = Math.max(daily.best, daily.streak);
        gained = DAILY_BASE_XP + Math.round(acc * 0.4) + Math.min(daily.streak, DAILY_STREAK_XP_DAYS) * DAILY_STREAK_XP_STEP;
        data.xpLog[`b:daily:${key}`] = [gained, now];
      });
      if (!tx) return false;
      const data = dataCache.get(id);
      const result = fromMutation(tx, id, {
        date: key,
        accuracy: data.daily.history[key],
        already,
        streak: data.daily.streak,
        best: data.daily.best,
        xpGained: gained,
      });
      result.levelUp = result.level.level > levelInfo(xpBefore).level;
      return result;
    }

    // ----- export / import / merge -----

    function buildDocument(ids) {
      const index = readIndex();
      return {
        ok: true,
        exportedAt: nowMs(),
        profiles: ids.map((id) => {
          const profile = index.profiles.find((item) => item.id === id);
          return { id: profile.id, name: profile.name, color: profile.color, googleSub: profile.googleSub || "", createdAt: profile.createdAt, data: readData(id) };
        }),
      };
    }

    // exportJSON()          the active profile
    // exportJSON(id)        one profile
    // exportJSON("all")     every profile (opts.sync adds googleSub, for Drive sync)
    function exportJSON(which, opts) {
      lastError = "";
      const includeSub = Boolean(isObject(opts) && opts.sync);
      let ids;
      if (which === "all") {
        ids = readIndex().profiles.map((profile) => profile.id);
      } else if (typeof which === "string" && which) {
        if (!indexIds().has(which)) {
          fail("not-found");
          return "";
        }
        ids = [which];
      } else {
        const profile = ensureActive();
        ids = profile ? [profile.id] : [];
      }
      if (!ids.length) {
        fail("no-profile");
        return "";
      }
      const doc = buildDocument(ids);
      let text = JSON.stringify(documentToJson(doc, includeSub));
      if (text.length > MAX_IMPORT_CHARS) {
        // Cannot happen within the per-profile budget; degrade instead of emitting a file that cannot be re-imported.
        doc.profiles = doc.profiles.map((entry) => {
          const slim = clone(entry.data);
          slimRounds(slim, 0);
          slimCards(slim);
          return Object.assign({}, entry, { data: slim });
        });
        text = JSON.stringify(documentToJson(doc, includeSub));
        if (text.length > MAX_IMPORT_CHARS) {
          fail("too-large");
          return "";
        }
      }
      return text;
    }

    function parseInput(value) {
      if (typeof value === "string") {
        if (value.length > MAX_IMPORT_CHARS) return { error: "too-large" };
        try {
          return { value: JSON.parse(value.charCodeAt(0) === 0xfeff ? value.slice(1) : value) };
        } catch (error) {
          return { error: "invalid-json" };
        }
      }
      return { value };
    }

    // Pure. Accepts two export documents (objects or JSON text) and returns the
    // merged document as an object (see documentToJson shape), or two profile
    // data objects and returns the merged data. Profiles are matched by id.
    // Returns null when an input is not usable.
    function merge(a, b) {
      const left = parseInput(a);
      const right = parseInput(b);
      if (left.error || right.error) return null;
      const ctx = strict();
      const isDoc = (value) => isObject(value) && value.kind === EXPORT_KIND;
      if (isDoc(left.value) && isDoc(right.value)) {
        const da = sanitizeDocument(left.value, ctx);
        const db = sanitizeDocument(right.value, ctx);
        if (!da.ok && !db.ok) return null;
        const merged = mergeDocuments(da.ok ? da : { profiles: [], exportedAt: 0 }, db.ok ? db : { profiles: [], exportedAt: 0 });
        return documentToJson(merged, true);
      }
      if (isObject(left.value) && isObject(right.value) && !isDoc(left.value) && !isDoc(right.value)) {
        return mergeData(sanitizeData(left.value, ctx), sanitizeData(right.value, ctx));
      }
      return null;
    }

    function summarize(doc) {
      let rounds = 0;
      let sessions = 0;
      let cards = 0;
      doc.profiles.forEach((entry) => {
        rounds += entry.data.rounds.length;
        sessions += entry.data.sessions.length;
        cards += entry.data.notebook.length;
      });
      return { profiles: doc.profiles.length, rounds, sessions, cards };
    }

    function applyWrites(writes) {
      const done = [];
      for (const write of writes) {
        const previous = safeGet(write.key, ABSENT);
        if (!safeSet(write.key, write.value)) {
          for (let i = done.length - 1; i >= 0; i -= 1) {
            if (done[i].previous === ABSENT) safeRemove(done[i].key);
            else safeSet(done[i].key, done[i].previous);
          }
          return false;
        }
        done.push({ key: write.key, previous });
      }
      return true;
    }

    // importJSON(text, { mode, into, dryRun })
    //   mode "merge"   (default) matched profiles (by id, then by googleSub) are
    //                  merged; the others are added
    //   mode "replace" matched profiles are overwritten by the imported ones
    //   mode "add"     every imported profile becomes a new profile (fresh id)
    //   into           merge/replace the first imported profile into that local profile
    //   dryRun         validate and count, write nothing
    // All-or-nothing: every key is written or none is.
    function importJSON(text, opts) {
      lastError = "";
      const o = isObject(opts) ? opts : {};
      const mode = o.mode === undefined ? "merge" : o.mode;
      const fail2 = (error) => {
        lastError = error;
        return { ok: false, error };
      };
      if (!["merge", "replace", "add"].includes(mode)) return fail2("invalid-mode");
      if (typeof text !== "string") return fail2("invalid-format");
      const parsed = parseInput(text);
      if (parsed.error) return fail2(parsed.error);
      const ctx = strict();
      const doc = sanitizeDocument(parsed.value, ctx);
      if (!doc.ok) return fail2(doc.error);
      const counts = summarize(doc);
      const summary = Object.assign({ ok: true, mode, dropped: ctx.dropped }, counts);
      if (o.dryRun === true) return Object.assign(summary, { dryRun: true });

      const index = readIndex();
      if (indexReadOnly) return fail2("read-only");
      const locals = index.profiles;
      const plan = new Map(); // local id -> { meta, data, existing }
      const order = [];
      const taken = new Set(locals.map((profile) => profile.id));
      // Names stay unique here too (PC-5): a backup may carry a name this device already uses; the profile it creates is numbered
      // ("Marta 2") and a replacement that would take another profile's name keeps the name it had.
      const takenNames = new Set(locals.map((profile) => nameKey(profile.name)));
      let imported = doc.profiles;
      let into = null;
      if (o.into !== undefined) {
        into = locals.find((profile) => profile.id === o.into);
        if (!into) return fail2("no-such-profile");
        imported = imported.slice(0, 1);
      }

      for (const entry of imported) {
        let target = null;
        if (into) target = into;
        else if (mode !== "add") {
          target = locals.find((profile) => profile.id === entry.id) || (entry.googleSub ? locals.find((profile) => profile.googleSub === entry.googleSub) : null) || null;
        }
        if (target) {
          if (readOnlyIds.has(target.id)) return fail2("read-only");
          const planned = plan.get(target.id);
          if (planned) {
            planned.data = mode === "replace" && !into ? entry.data : mergeData(planned.data, entry.data);
          } else {
            order.push(target.id);
            const localData = readData(target.id);
            if (readOnlyIds.has(target.id)) return fail2("read-only");
            let replacementName = target.name;
            if (mode === "replace" && !into && entry.name && nameKey(entry.name)) {
              const before = nameKey(target.name);
              if (nameKey(entry.name) === before || !takenNames.has(nameKey(entry.name))) {
                takenNames.delete(before);
                takenNames.add(nameKey(entry.name));
                replacementName = entry.name;
              }
            }
            plan.set(target.id, {
              existing: true,
              meta: mode === "replace" && !into
                ? { id: target.id, name: replacementName, color: entry.color, createdAt: target.createdAt, googleSub: entry.googleSub || target.googleSub || "" }
                : { id: target.id, name: target.name, color: target.color, createdAt: target.createdAt, googleSub: target.googleSub || entry.googleSub || "" },
              data: mode === "replace" && !into ? entry.data : mergeData(localData, entry.data),
            });
          }
        } else {
          const wanted = mode !== "add" && entry.id && !taken.has(entry.id) ? entry.id : null;
          const id = wanted || uniqueProfileId(taken);
          taken.add(id);
          order.push(id);
          const newName = freeName(takenNames, entry.name && nameKey(entry.name) ? entry.name : defaultName());
          takenNames.add(nameKey(newName));
          plan.set(id, {
            existing: false,
            meta: { id, name: newName, color: entry.color, createdAt: entry.createdAt, googleSub: entry.googleSub },
            data: entry.data,
          });
        }
      }

      const created = order.filter((id) => !plan.get(id).existing);
      if (locals.length + created.length > MAX_PROFILES) {
        const result = fail2("limit");
        result.max = MAX_PROFILES;
        return result;
      }

      const writes = [];
      const unlockedBy = new Map();
      order.forEach((id) => {
        const item = plan.get(id);
        unlockedBy.set(id, prepareData(item.data, true));
        item.data.updatedAt = Math.max(item.data.updatedAt, nowMs());
        writes.push({ key: dataKey(id), value: item.data });
      });
      const nextIndex = clone(index);
      order.forEach((id) => {
        const item = plan.get(id);
        const meta = { id, name: item.meta.name, color: item.meta.color, createdAt: item.meta.createdAt };
        if (item.meta.googleSub) meta.googleSub = item.meta.googleSub;
        const position = nextIndex.profiles.findIndex((profile) => profile.id === id);
        if (position >= 0) nextIndex.profiles[position] = meta;
        else nextIndex.profiles.push(meta);
      });
      if (!nextIndex.active && nextIndex.profiles.length) nextIndex.active = nextIndex.profiles[0].id;
      writes.push({ key: INDEX_KEY, value: nextIndex });

      if (!applyWrites(writes)) {
        dataCache.clear();
        indexCache = null;
        return fail2("storage-failed");
      }
      indexCache = nextIndex;
      order.forEach((id) => dataCache.set(id, plan.get(id).data));

      order.forEach((id) => {
        announce(id, plan.get(id).data, { unlocked: unlockedBy.get(id), notebook: true });
      });
      return Object.assign(summary, { profileIds: order.slice(), created: created.length, merged: order.length - created.length });
    }

    // wipe(id)     clears one profile's data but keeps the profile
    // wipe("all")  removes every profile and its data
    function wipe(which) {
      lastError = "";
      if (which === "all") {
        readIndex();
        if (indexReadOnly) return fail("read-only");
        const keys = new Set(indexCache.profiles.map((profile) => dataKey(profile.id)));
        try {
          const storage = getStorage();
          if (storage && typeof storage.keys === "function") {
            storage.keys(DATA_PREFIX).forEach((key) => {
              if (/^ludus\.p\.[A-Za-z0-9_-]{1,40}\.v1$/.test(key)) keys.add(key);
            });
          }
        } catch (error) {
          // Only the known profile keys are removed then.
        }
        keys.forEach((key) => safeRemove(key));
        if (!safeRemove(INDEX_KEY)) return fail("storage");
        indexCache = null;
        dataCache.clear();
        readOnlyIds.clear();
        emit("profile:changed", { profileId: null });
        return true;
      }
      const id = resolveRead(which);
      if (!id) return fail("not-found");
      readData(id);
      if (readOnlyIds.has(id)) return fail("read-only");
      const fresh = emptyData(nowMs());
      if (!safeSet(dataKey(id), fresh)) return fail("storage");
      dataCache.set(id, fresh);
      emit("profile:changed", { profileId: id });
      emit("notebook:changed", { count: 0, due: 0, profileId: id });
      return true;
    }

    // ----- lifecycle -----

    // Drops every cache so the next call reads storage again (after a sync or
    // an import done elsewhere). Also what a "storage" event from another tab
    // triggers, so two tabs never write over each other's stale copy.
    function reload() {
      indexCache = null;
      dataCache.clear();
      readOnlyIds.clear();
      emit("profile:changed", { profileId: null });
    }

    function attachStorageListener() {
      if (listening || options.listenStorage === false) return;
      listening = true;
      try {
        if (typeof root.addEventListener !== "function") return;
        root.addEventListener("storage", (event) => {
          const key = event && event.key;
          if (key === null || (typeof key === "string" && (key === INDEX_KEY || key.startsWith(DATA_PREFIX)))) reload();
        });
      } catch (error) {
        // No window events here.
      }
    }

    // Records every "round:completed" / "session:completed" the game emits.
    // recordRound / recordSession ignore a duplicate id, so calling them
    // directly as well is harmless.
    //
    // A guest (a duel player without a local profile) is emitted with an explicit
    // `profileId: null` and belongs to nobody: recordRound() alone would file
    // that under the ACTIVE profile (null = "the active one" for a direct call),
    // so the bus path skips it. Likewise a session that names no profile at all
    // (`profileId` null and no linked player in `duel.profileIds`).
    function attach() {
      detach();
      const bus = getBus();
      if (!bus) return false;
      attachStorageListener();
      // Storage that was unusable from the start (blocked site data, private mode)
      // is announced right away, not at the first lost round.
      if (!storageUsable()) {
        health.reason = "blocked";
        announceStorageFailure();
      }
      detachFns = [
        bus.on("round:completed", (payload) => {
          if (payload && payload.round && payload.round.profileId !== null) recordRound(payload.round);
        }),
        bus.on("session:completed", (payload) => {
          const session = payload && payload.session;
          if (!session) return;
          const linked = isObject(session.duel) && Array.isArray(session.duel.profileIds)
            && session.duel.profileIds.some((value) => typeof value === "string" && value);
          if (session.profileId === null && !linked) return;
          recordSession(session);
        }),
      ];
      return true;
    }

    function detach() {
      detachFns.forEach((off) => {
        try {
          off();
        } catch (error) {
          // Already detached.
        }
      });
      detachFns = [];
    }

    registerText(options.i18n);

    return {
      list,
      active,
      create: createProfile,
      rename,
      setGoogleSub,
      remove,
      setActive,
      ensureActive,
      recordRound,
      recordSession,
      rounds,
      sessions,
      stats,
      levelFor,
      notebook: {
        list: notebookList,
        get: notebookGet,
        due: notebookDue,
        grade: notebookGrade,
        add: notebookAdd,
        remove: notebookRemove,
        counts: notebookCounts,
      },
      achievements: {
        catalog,
        unlocked: unlockedList,
        evaluate,
        progress: achievementProgress,
      },
      daily: { status: dailyStatus, complete: dailyComplete },
      exportJSON,
      importJSON,
      merge,
      wipe,
      reload,
      attach,
      detach,
      lastError: () => lastError,
      storageStatus,
      errorKey: (code) => `profile.import.error.${code}`,
    };
  }

  // The shared instance follows the real environment (Ludus.storage / bus / clock).
  const api = createInstance({});
  api.createInstance = createInstance;
  api.registerText = registerText;
  api.constants = Object.freeze({
    INDEX_KEY,
    DATA_PREFIX,
    DATA_SUFFIX,
    EXPORT_KIND,
    EXPORT_VERSION,
    MAX_IMPORT_CHARS,
    MAX_PROFILES,
    PROFILE_BUDGET_CHARS,
    CAPS,
    LEITNER_DAYS,
    PASS_ACCURACY,
    CLEARED_BOX,
    MIN_TAG_SAMPLE,
    LEVEL_THRESHOLDS,
    RANKS,
    PALETTE,
    QUALITY_CODES,
  });
  // Pure building blocks, exposed for tests and for other modules that need the
  // same validation (for example auth.js checking a downloaded document).
  api.internals = Object.freeze({
    sanitizeRound,
    sanitizeSession,
    sanitizeCard,
    sanitizeData,
    sanitizeDocument,
    mergeData,
    mergeDocuments,
    computeStreaks,
    computeStats,
    levelInfo,
    dateKeyOf,
    dayNumber,
    keyFromDayNumber,
    startOfLocalDay,
    dueAt,
    cardIdFor,
    fenKey,
    validFen,
    strictCtx,
    trustedCtx,
    emptyData,
    finalizeData,
    isMistake,
    ACHIEVEMENTS,
  });
  return api;
});
