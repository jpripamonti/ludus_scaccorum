// Helper for the data tests (facts.test.js, classics.test.js): finds British spellings in an ENGLISH string.
//
// The English of the app is American ("analyzed", "color", "center", "Defense", "toward"). This list covers the words the
// data texts can plausibly contain (history facts, blurbs, moment notes, opening and event names, source notes); the UI
// tables are scanned by scripts/tests/ui-screens-spelling.test.js with a list of their own.
//
// Verbatim quotations and proper names of books, titles and institutions keep the spelling they were published with:
// they are listed in KEPT (exact phrases, each with the reason), masked before the scan, and the tests check that every
// phrase of the list is still used somewhere, so the list cannot go stale. Add a phrase only for a title as published.

"use strict";

// [pattern, American form]. Whole words; a family is one pattern.
const BRITISH = [
  [/\b(?:analys(?:e|ed|es|ing)|paralys(?:e|ed|ing)|catalys(?:e|ed|ing))\b/i, "analyze / paralyze / catalyze"],
  [/\b\w*(?:colour|favour|honour|neighbour|behaviour|labour|harbour|armour|rumour|vigour|humour|flavour|savour|odour|ardour|rigour|fervour|glamour|tumour|clamour|splendour|valour|vapour|endeavour)\w*/i, "-or (color, favorite, honor, ...)"],
  [/\b(?:cent|met|fib|lit|calib|sab|somb|meag|lust|spect)(?:re|res|red|ring)\b/i, "-er (center, meter, fiber, ...)"],
  [/\b(?:theatre|theatres|manoeuvre\w*|kilometre\w*|centimetre\w*|millimetre\w*)\b/i, "theater / maneuver / kilometer, ..."],
  [/\b\w*(?:defence|offence|pretence)\w*/i, "defense / offense / pretense"],
  [/\b(?:licence|licences)\b/i, "license"],
  [/\b\w*(?:catalogue|dialogue|analogue|monologue)\w*/i, "-og (catalog, dialog, analog)"],
  [/\b(?:travell|cancell|modell|levell|labell|fuell|signall|counsell|marshall)(?:ed|ing|er|ers|or|ors)\b/i, "single l (traveled, canceled, ...)"],
  [/\b(?:grey|greys|greyish|programme|programmes|practis(?:e|ed|es|ing)|judgement|judgements|acknowledgement|ageing|whilst|amongst|amidst)\b/i, "gray / program / practice (verb) / judgment / aging / while / among / amid"],
  [/\b(?:learnt|spelt|burnt|dreamt|leapt|spoilt|smelt|towards)\b/i, "learned / spelled / burned / toward, ..."],
  [/\b(?:storey|storeys|tyre|tyres|cheque|cheques|plough\w*|mould\w*|sulphur\w*|aluminium|kerb|pyjamas|draught\w*|tonne|tonnes|artefact\w*|sceptic\w*|mediaeval|encyclopaedi\w*|foetus|oestrogen|maths|moustache|enrol|enrolment|fulfil|instalment|skilful|wilful)\b/i, "story / tire / check / plow / mold / sulfur / aluminum / curb / pajamas / draft / ton / artifact / skeptic / medieval / encyclopedia / math, ..."],
  [/\b(?:semi-final|semi-finals|quarter-final|quarter-finals)\b/i, "semifinal / quarterfinal"],
];

// "-ise" and "-yse" verbs and their forms, British; the same ending also closes many words that are American too.
const ISE_GENERIC = /\b[a-z]{2,}(?:is|ys)(?:e|ed|es|ing|ation|ations)\b/gi;
const ISE_ALLOWED = new Set((
  "exercise exercises exercised exercising otherwise precise promise promises promised promising advise advised advises advising " +
  "revise revised revises revising surprise surprised surprises surprising compromise compromised compromises compromising noise noises " +
  "rise rises rising arise arises arising wise praise praised praises praising raise raised raises raising premise premises prise " +
  "enterprise enterprises comprise comprised comprises comprising supervise supervised supervises supervising devise devised " +
  "disguise disguised expertise franchise concise demise despise likewise clockwise paradise treatise treatises merchandise advertise advertised " +
  "advertises advertising crises analyses paralyses"
).split(" "));

// Titles and names as published (a book, an encyclopedia, a Wikipedia article, an organization): left as they are.
const KEPT = [
  { phrase: "Encyclopaedia Britannica", why: "title of the encyclopedia as published" },
  { phrase: "Encyclopaedia of Chess Openings", why: "title of the book (ECO) as published" },
  { phrase: "World Chess Boxing Organisation", why: "name of the organization as published" },
  { phrase: "L'Analyse des Échecs", why: "French title of the museum's page on Philidor's book" },
  { phrase: "Analyse du jeu des Échecs", why: "French title of Philidor's book (1749)" },
  { phrase: "Wikipedia 'Sicilian Defence'", why: "title of the Wikipedia article as published" },
];

function mask(text) {
  let out = String(text === undefined || text === null ? "" : text);
  KEPT.forEach((entry) => {
    out = out.split(entry.phrase).join(" ");
  });
  return out;
}

// [{ word, american }] for one string; the kept titles are not looked at.
function britishFindings(text) {
  const source = mask(text);
  const found = [];
  BRITISH.forEach(([pattern, american]) => {
    (source.match(new RegExp(pattern.source, "gi")) || []).forEach((word) => found.push({ word, american }));
  });
  (source.match(ISE_GENERIC) || []).forEach((word) => {
    if (!ISE_ALLOWED.has(word.toLowerCase()) && !found.some((entry) => entry.word.toLowerCase() === word.toLowerCase())) {
      found.push({ word, american: "the -ize / -yze spelling" });
    }
  });
  return found;
}

// Asserts that no string of `entries` ([[where, text], ...]) has a British spelling.
function assertAmerican(assert, entries, label) {
  const problems = [];
  entries.forEach(([where, text]) => {
    if (typeof text !== "string") return;
    britishFindings(text).forEach((finding) => problems.push(`${where}: "${finding.word}" (American: ${finding.american}) in: ${text.slice(0, 120)}`));
  });
  assert.strictEqual(problems.length, 0, `${label}: British spelling in an English string (American English; a title as published goes to KEPT in scripts/tests/_british.js):\n${problems.join("\n")}`);
}

// KEPT phrases that no string of `entries` contains any more (a stale entry would hide a future slip).
function unusedKept(entries) {
  const joined = entries.map(([, text]) => String(text)).join("\n");
  return KEPT.filter((entry) => !joined.includes(entry.phrase)).map((entry) => entry.phrase);
}

module.exports = { BRITISH, KEPT, britishFindings, assertAmerican, unusedKept };
