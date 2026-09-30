// Seeds a realistic learner into a running page through the REAL Ludus.Profile API (recordRound / recordSession /
// daily.complete), never by writing storage: about 150 rounds across 40 days with varied qualities, tags, phases
// and sources, sessions of 3 to 8 positions (one duel), an accuracy that improves over the period, mistake cards
// that were reviewed (some passed, some failed) and cards that are due. Used by scripts/e2e/track.js.
//
//   const { seedProfile } = require("./track-seed.js");
//   const info = await seedProfile(page, { rounds: 150, days: 40 });   // page = a Playwright page with the app loaded
//
// Options (all optional): rounds (150), days (40), seed (7), skipToday (false: no activity today, so the streak
// is "at risk"), name (renames the active profile), extraProfiles (create another profile and give it a little
// activity), noLines (share of rounds whose engine lines are not stored, like a round scored by the fallback
// engine; default 0.1).
//
// The positions come from Ludus.Classics (real positions with real engine lines); "own" rounds reuse them with
// the metadata of a game against a person, which is all the screens look at.

"use strict";

// This function runs INSIDE the page (it is serialised by Playwright): it may only use the page's globals.
async function seedInPage(options) {
  const opts = options || {};
  const totalRounds = opts.rounds || 150;
  const days = opts.days || 40;
  const noLines = typeof opts.noLines === "number" ? opts.noLines : 0.1;
  let seedState = (opts.seed || 7) >>> 0;
  const rand = () => {
    // mulberry32: deterministic, so a failing run can be reproduced
    seedState = (seedState + 0x6d2b79f5) >>> 0;
    let x = seedState;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => (rand() + rand() + rand() + rand() - 2) * 1.7;
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const Profile = Ludus.Profile;
  Profile.ensureActive();
  if (opts.name) {
    const active = Profile.active();
    if (active) Profile.rename(active.id, opts.name);
  }
  const profileName = (Profile.active() || {}).name || "Player";
  await Ludus.Classics.load();
  const pool = Ludus.Classics.random(400, {});
  if (!pool.length) throw new Error("no classic positions to seed with");
  const { Chess, uciToMove, moveToSan, moveToUci } = Ludus.chess;

  const qualityFor = (accuracy) => {
    if (accuracy >= 99.5) return "perfect";
    if (accuracy >= 90) return "very_good";
    if (accuracy >= 75) return "good";
    if (accuracy >= 55) return "interesting";
    if (accuracy >= 35) return "dubious";
    if (accuracy >= 10) return "bad";
    return "blunder";
  };
  const MISTAKE_TAGS = ["hangs_piece", "missed_capture", "fork_available", "back_rank", "king_safety", "pin_or_skewer", "missed_mate", "development", "endgame_technique", "open_file"];
  const GOOD_TAGS = ["solid", "quiet_best", "sacrifice_best"];
  const OPPONENTS = ["Marta_92", "chessfan77", "Diego R.", "Lucía", "Nico_B", "ajedrecista", "Tomás"];
  const EVENTS = ["Lichess blitz", "Lichess rapid", "Chess.com daily", "Torneo del club"];
  const SESSION_TITLES = { classic: ["Partidas clásicas", "Classic games"], own: ["Tus partidas", "Your games"], review: ["Repaso del cuaderno", "Notebook review"], daily: ["Desafío diario", "Daily challenge"] };
  const lang = Ludus.i18n.lang();

  const dayStart = (offset) => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset).getTime();
  };

  // Which days are active: most of them, with a few gaps, and either today or yesterday last.
  const activeDays = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    if (offset === 0 && opts.skipToday) continue;
    // A gap of a couple of days here and there; the last 6 days are always active (a live streak).
    const gap = offset > 6 && ((offset * 7 + 3) % 11 === 0 || (offset * 5 + 1) % 13 === 0);
    if (!gap) activeDays.push(offset);
  }
  // Reviews of due cards add rounds on top of these: about two thirds of the target is planned here.
  const perDay = Math.max(1, (totalRounds / activeDays.length) * 0.66);

  let roundSeq = 0;
  let sessionSeq = 0;
  let recorded = 0;
  const recordedSessions = [];

  function makeRound(position, source, kind, ts, sessionId, progress, forced) {
    roundSeq += 1;
    const chess = new Chess(position.fen);
    const legal = chess.generateMoves();
    const lines = (position.reference && position.reference.lines) || [];
    const best = lines[0] ? lines[0].uci : moveToUci(legal[0]);
    // The learner improves from about 50 to about 74 accuracy over the period; some tags are harder.
    let mean = 60 + 22 * progress;
    let tags = [];
    const hard = rand() < 0.42;
    if (hard) tags = [pick(MISTAKE_TAGS.slice(0, 5))];
    if (rand() < 0.25) tags.push(pick(MISTAKE_TAGS));
    if (hard) mean -= 16;
    else if (rand() < 0.5) tags = [pick(GOOD_TAGS)];
    let accuracy = clamp(mean + gauss() * 20, 0, 100);
    if (forced && typeof forced.accuracy === "number") accuracy = forced.accuracy;
    accuracy = Math.round(accuracy * 10) / 10;
    const isBest = accuracy >= 96;
    let userUci = best;
    if (!isBest) {
      const others = legal.map(moveToUci).filter((uci) => uci !== best);
      const fromLines = lines.slice(1).map((line) => line.uci).filter((uci) => others.includes(uci));
      userUci = accuracy >= 70 && fromLines.length ? pick(fromLines) : pick(others);
    }
    const userMove = uciToMove(userUci, chess);
    const userSan = moveToSan(chess, userMove);
    const bestMove = uciToMove(best, chess);
    const bestSan = moveToSan(chess, bestMove);
    // Insights classifies most classic positions as "opening" or "endgame"; a spread makes the phase chart meaningful.
    const roll = rand();
    const phase = roll < 0.28 ? "opening" : roll < 0.82 ? "middlegame" : "endgame";
    const stored = rand() >= noLines;
    const meta = Object.assign({}, position.meta || {});
    if (source === "own") {
      const opponent = pick(OPPONENTS);
      meta.players = rand() < 0.5 ? `${profileName} vs ${opponent}` : `${opponent} vs ${profileName}`;
      meta.event = pick(EVENTS);
      meta.site = "lichess.org";
      meta.year = new Date(ts).getFullYear();
      delete meta.eco;
    }
    return {
      id: `r_seed_${roundSeq}`,
      ts,
      sessionId,
      sessionKind: kind,
      source,
      positionId: `${source}:${roundSeq}`,
      fen: position.fen,
      sideToMove: chess.turn,
      phase,
      userUci,
      userSan,
      bestUci: stored ? best : null,
      bestSan: stored ? bestSan : "",
      points: Math.round(accuracy) / 10,
      accuracy,
      qualityCode: qualityFor(accuracy),
      winLossPct: Math.round((100 - accuracy) * 0.4 * 10) / 10,
      cpLoss: Math.round((100 - accuracy) * 3),
      isBest,
      rank: isBest ? 1 : 2 + Math.floor(rand() * 5),
      onlyMove: rand() < 0.12,
      timeSpentMs: Math.round(3500 + rand() * 42000),
      hintsUsed: rand() < 0.08 ? 1 : 0,
      timedOut: false,
      tags,
      lines: stored ? lines.slice(0, 3).map((line) => ({ uci: line.uci, san: line.san || "", score: line.score, pv: (line.pv || [line.uci]).slice(0, 6) })) : [],
      meta,
    };
  }

  function sessionSummary(id, kind, ts, rounds, title) {
    const points = rounds.reduce((sum, round) => sum + round.points, 0);
    const byQuality = {};
    rounds.forEach((round) => {
      byQuality[round.qualityCode] = (byQuality[round.qualityCode] || 0) + 1;
    });
    return {
      id,
      ts,
      kind,
      title,
      mode: "solo",
      positions: rounds.length,
      points: Math.round(points * 10) / 10,
      maxPoints: rounds.length * 10,
      avgAccuracy: Math.round((rounds.reduce((sum, round) => sum + round.accuracy, 0) / rounds.length) * 10) / 10,
      durationMs: rounds.reduce((sum, round) => sum + round.timeSpentMs, 0),
      byQuality,
      roundIds: rounds.map((round) => round.id),
    };
  }

  let poolIndex = 0;
  const nextPosition = () => {
    const position = pool[poolIndex % pool.length];
    poolIndex += 1;
    return position;
  };

  activeDays.forEach((offset, dayIndex) => {
    const progress = dayIndex / Math.max(1, activeDays.length - 1);
    let todayRounds = Math.max(1, Math.round(perDay + gauss() * 2.2));
    let clock = dayStart(offset) + (8 + Math.floor(rand() * 10)) * 3600000;
    // Today's activity ends before "now" so nothing is dated in the future.
    if (offset === 0) clock = Math.min(clock, Date.now() - todayRounds * 240000 - 60000);
    while (todayRounds > 0) {
      const size = Math.min(todayRounds, 3 + Math.floor(rand() * 6));
      todayRounds -= size;
      // A day may start with a real review of the cards that are due at that moment (Profile decides which
      // ones, from what it has recorded so far), so the boxes fill the way they do for a person.
      const dueCards = rand() < 0.7 ? Profile.notebook.due(clock, 3 + Math.floor(rand() * 4)) : [];
      const roll = rand();
      const kind = dueCards.length ? "review" : roll < 0.5 ? "classic" : roll < 0.9 ? "own" : "daily";
      sessionSeq += 1;
      const sessionId = `s_seed_${sessionSeq}`;
      const rounds = [];
      const count = kind === "review" ? dueCards.length : size;
      if (kind === "review") todayRounds += size - count;
      for (let i = 0; i < count; i += 1) {
        clock += 60000 + Math.floor(rand() * 90000);
        let round;
        if (kind === "review") {
          // It passes about two times out of three, more often when the card is in a higher box.
          const card = dueCards[i];
          const passes = rand() < 0.5 + 0.08 * card.box;
          round = makeRound({ fen: card.fen, reference: { lines: card.lines }, meta: card.meta }, "notebook", kind, clock, sessionId, progress, {
            accuracy: passes ? 76 + Math.round(rand() * 22) : 15 + Math.round(rand() * 45),
          });
        } else {
          const source = kind === "daily" ? "daily" : kind;
          round = makeRound(nextPosition(), source, kind, clock, sessionId, progress);
        }
        rounds.push(round);
      }
      rounds.forEach((round) => {
        const result = Profile.recordRound(round);
        if (!result || result.ok === false) throw new Error(`recordRound failed: ${Profile.lastError()}`);
        recorded += 1;
      });
      clock += 20000;
      const title = SESSION_TITLES[kind][lang === "en" ? 1 : 0];
      const session = sessionSummary(sessionId, kind, clock, rounds, title);
      Profile.recordSession(session);
      recordedSessions.push(session.id);
    }
    // The daily challenge on some of the days.
    if (rand() < 0.3) {
      const d = new Date(dayStart(offset) + 12 * 3600000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      try {
        Profile.daily.complete(key, 60 + Math.round(rand() * 35));
      } catch (error) {
        // the daily record is decoration for the screenshots
      }
    }
  });

  // One duel, recorded for the active profile.
  sessionSeq += 1;
  const duelRounds = [];
  for (let i = 0; i < 4; i += 1) duelRounds.push(makeRound(nextPosition(), "classic", "classic", dayStart(3) + 20 * 3600000 + i * 60000, `s_seed_${sessionSeq}`, 0.6));
  Profile.recordSession(Object.assign(sessionSummary(`s_seed_${sessionSeq}`, "classic", dayStart(3) + 20 * 3600000 + 400000, duelRounds, lang === "en" ? "Duel" : "Duelo"), {
    mode: "duel",
    duel: { names: [profileName, "Dani"], scores: [24.5, 21], me: 0 },
  }));

  if (opts.extraProfiles) {
    const other = Profile.create({ name: "Dani" });
    if (other && other.id) {
      for (let i = 0; i < 12; i += 1) {
        const round = makeRound(nextPosition(), "classic", "classic", dayStart(2) + 9 * 3600000 + i * 90000, `s_seed_x${i}`, 0.5);
        round.id = `r_seed_x${i}`;
        round.profileId = other.id;
        Profile.recordRound(round);
      }
    }
  }

  Profile.achievements.evaluate();
  const stats = Profile.stats();
  return { rounds: recorded, sessions: recordedSessions.length + 1, cards: Profile.notebook.counts(), positions: stats.totalPositions, level: stats.level.title, streak: stats.streak, unlocked: stats.achievements.unlocked };
}

async function seedProfile(page, options) {
  return page.evaluate(seedInPage, options || {});
}

module.exports = { seedProfile, seedInPage };
