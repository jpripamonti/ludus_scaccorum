// American English in every English table the screens register (js/ui/*.js).
//
// The English of the app is American ("analyzed", "color", "license", "practice" the verb, "toward"). A British
// spelling in one string reads as a slip in a product that otherwise follows one style, and it is easy to
// reintroduce: the tables are long and written by several hands. This test loads every js/ui module, records the
// bundle each one hands to Ludus.i18n.register and scans the English half of it against a word list (an explicit list
// of British spellings and a generic "-ise/-yse" rule with an allow-list of words that really end that way).
//
// It checks the English values only (not the keys, which stay as they are, e.g. account.about.licence), and only what the
// tables register: a sentence assembled in code from fragments is out of its reach. The Spanish is not touched here.

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { load, localScripts, repoRoot } = require("./_load.js");

// ---------- The word list ----------

// British spellings (and the odd Briticism) with their American form, as a regular expression each. Whole words only;
// the endings are listed so that "licence" (noun) is caught and "license" (the American noun and the verb) is not.
const BRITISH = [
  // "analyses" is left out on purpose: it is also the American plural of "analysis".
  [/\banalys(?:e|ed|ing)\b/i, "analyze"],
  [/\bparalys(?:e|ed|ing)\b/i, "paralyze"],
  [/\bcatalys(?:e|ed|ing)\b/i, "catalyze"],
  [/\bcolour\w*/i, "color"],
  [/\bfavour\w*/i, "favor"],
  [/\bbehaviour\w*/i, "behavior"],
  [/\bcent(?:re|res|red|ring)\b/i, "center"],
  [/\b(?:defence|defences|offence|offences|pretence)\b/i, "defense / offense / pretense"],
  [/\bhonour\w*/i, "honor"],
  [/\bgrey\w*/i, "gray"],
  [/\bneighbour\w*/i, "neighbor"],
  [/\blicence[sd]?\b/i, "license"],
  [/\bprogrammes?\b/i, "program"],
  [/\bcatalogues?\b/i, "catalog"],
  [/\bartefacts?\b/i, "artifact"],
  [/\bmanoeuvr\w*/i, "maneuver"],
  [/\b(?:labour|humour|rumour|armour|harbour|savour|flavour|endeavour|tumour|odour|vigour|glamour)\w*/i, "labor, humor, ..."],
  [/\benrol(?:s|ment|ments)?\b/i, "enroll"],
  [/\b(?:fulfil|instalment|instalments|skilful|skilfully|wilful|wilfully)\b/i, "fulfill / installment / skillful / willful"],
  [/\b(?:judgement|judgements|acknowledgement|acknowledgements|ageing)\b/i, "judgment / acknowledgment / aging"],
  [/\b(?:whilst|amongst|amidst)\b/i, "while / among / amid"],
  [/\b(?:learnt|spelt|burnt|dreamt|leapt|spoilt|smelt)\b/i, "learned / spelled / burned / dreamed / leaped / spoiled"],
  [/\btowards\b/i, "toward"],
  [/\bsceptic\w*/i, "skeptic"],
  [/\bpractis(?:e|ed|es|ing)\b/i, "practice (verb)"],
  [/\b(?:travell|labell|modell|levell|fuell|signall|counsell|marshall|jewell|cancell)(?:ed|ing|er|ers|or|ors)\b/i, "single l (traveled, labeling, ...)"],
  [/\b(?:storey|storeys|tyre|tyres|cheque|cheques|plough\w*|mould\w*|sulphur\w*|aluminium|kerb|kerbs|pyjamas|draught\w*|tonne|tonnes)\b/i, "story / tire / check / plow / mold / sulfur / aluminum / curb / pajamas / draft / ton"],
  [/\b(?:fibre|fibres|litre|litres|metre|metres|theatre|theatres|calibre|sombre|lustre|cosy|maths)\b/i, "fiber / liter / meter / theater / caliber / somber / luster / cozy / math"],
  [/\banalogues?\b/i, "analog"],
];

// "-ise", "-isation" and "-yse" words: British when the verb is one of those, but the ending is also the end of many
// words that are spelled the same in American English, which are allowed here by name.
const ISE_GENERIC = /\b[a-z]{2,}(?:is|ys)(?:e|ed|es|ing|ation|ations)\b/gi;
const ISE_ALLOWED = new Set((
  "exercise exercises exercised exercising otherwise precise promise promises promised promising advise advised advises advising " +
  "revise revised revises revising surprise surprised surprises surprising surprisingly compromise compromised compromises compromising noise noises " +
  "rise rises rising arise arises arising wise praise praised praises praising raise raised raises raising premise premises " +
  "enterprise enterprises enterprising comprise comprised comprises comprising supervise supervised supervises supervising devise devised " +
  "disguise disguised expertise franchise concise demise despise likewise clockwise anticlockwise counterclockwise paradise treatise " +
  "merchandise advertise advertised advertises advertising crises analyses paralyses disguising despising devising premising"
).split(" "));

function britishFindings(text) {
  const found = [];
  BRITISH.forEach(([pattern, american]) => {
    const match = String(text).match(pattern);
    if (match) found.push({ word: match[0], american });
  });
  (String(text).match(ISE_GENERIC) || []).forEach((word) => {
    // A word the list above already named is reported once, with its own American form.
    if (!ISE_ALLOWED.has(word.toLowerCase()) && !found.some((entry) => entry.word.toLowerCase() === word.toLowerCase())) found.push({ word, american: "the -ize / -yze spelling" });
  });
  return found;
}

// ---------- Recording what each ui module registers ----------

function recordUiTables() {
  const scripts = localScripts().filter((file) => file !== "app.js");
  const firstUi = scripts.findIndex((file) => file.startsWith("js/ui/"));
  assert.ok(firstUi > 0, "index.html lists the js/ui modules");
  const env = load({ scripts: scripts.slice(0, firstUi) });
  const { Ludus } = env;
  const tables = {};
  let current = "";
  const register = Ludus.i18n.register;
  Ludus.i18n.register = function recording(bundle) {
    const table = tables[current] || (tables[current] = {});
    if (bundle && bundle.en && typeof bundle.en === "object") Object.assign(table, bundle.en);
    return register.call(this, bundle);
  };
  scripts.slice(firstUi).forEach((rel) => {
    current = rel;
    const file = path.join(repoRoot, rel);
    env.run(fs.readFileSync(file, "utf8"), file);
  });
  Ludus.i18n.register = register;
  return { tables, files: scripts.slice(firstUi) };
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

test("the scanner flags British spellings and lets the American ones and the shared -ise words through", () => {
  const flagged = [
    "You analysed it", "Analyse the game", "Analysing…", "Colour {n}", "The colours", "cancelled", "Cancelling", "your favourite", "Behaviour", "the centre",
    "A strong defence", "Licence", "Licence text", "organise your notebook", "Organisation", "recognised", "Recognise it", "practise daily", "judgement",
    "toward and towards", "synthesised", "grey", "Greyed out", "programme", "travelling", "labelled", "whilst", "learnt", "catalogue", "minimise", "customise it",
  ];
  flagged.forEach((text) => assert.ok(britishFindings(text).length > 0, `should be flagged: "${text}"`));
  const clean = [
    "You analyzed it", "Analysis engine", "Color {n}", "Colors", "canceled", "Cancellation of the session", "your favorite", "Behavior", "the center", "A strong defense",
    "License", "License text", "Organize your notebook", "recognized", "practice daily", "judgment", "Progress toward the next level", "synthesized", "gray",
    "traveling", "labeled", "while", "learned", "catalog", "Exercise", "Otherwise, rising ratings are surprising", "Advise, revise, promise and compromise", "the noise",
    "Licensed under the GPL", "A premise", "Practice makes perfect", "He will practice the opening",
  ];
  clean.forEach((text) => assert.deepStrictEqual(britishFindings(text), [], `should pass: "${text}"`));
});

test("every English table of js/ui/*.js is American English", () => {
  const { tables, files } = recordUiTables();
  // The scan must really have seen the tables: every module that has text registered something sizeable.
  const expectedBig = ["shell", "coach", "home", "classics", "notebook", "progress", "museum", "settings", "account"];
  expectedBig.forEach((name) => {
    const entries = Object.keys(tables[`js/ui/${name}.js`] || {}).length;
    assert.ok(entries > 30, `js/ui/${name}.js registered ${entries} English strings`);
  });
  assert.ok(Object.keys(tables["js/ui/kit.js"] || {}).length > 10, "the kit registered its strings");
  assert.ok(files.length >= 11, `scanned ${files.length} ui modules`);
  const problems = [];
  Object.keys(tables).forEach((file) => {
    Object.keys(tables[file]).forEach((key) => {
      britishFindings(tables[file][key]).forEach((finding) => problems.push(`${file} ${key}: "${finding.word}" (American: ${finding.american}) in "${tables[file][key].slice(0, 100)}"`));
    });
  });
  assert.deepStrictEqual(problems, [], `British spelling in English strings:\n${problems.join("\n")}`);
});

console.log(`ui-screens-spelling.test.js: ${passed} tests passed`);
