// Unit tests for js/audio.js: the pure envelope/frequency helpers, the sound
// recipes, and the WebAudio scheduling driven through a fake AudioContext.
// Plain assert, no framework, no audio device.

"use strict";

const assert = require("assert");
const path = require("path");
const { load } = require("./_load.js");

const jsDir = path.resolve(__dirname, "..", "..", "js");
require(path.join(jsDir, "ludus.js"));
const AudioModule = require(path.join(jsDir, "audio.js"));
const { helpers, constants, SOUNDS, HAPTIC_PATTERNS } = AudioModule;

let assertions = 0;
const ok = (value, message) => { assertions += 1; assert.ok(value, message); };
const eq = (actual, expected, message) => { assertions += 1; assert.strictEqual(actual, expected, message); };
const same = (actual, expected, message) => { assertions += 1; assert.deepStrictEqual(actual, expected, message); };
const near = (actual, expected, epsilon, message) => { assertions += 1; assert.ok(Math.abs(actual - expected) <= epsilon, `${message || "near"}: ${actual} vs ${expected}`); };

async function settle() {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

const NAMES = ["move", "capture", "check", "correct", "great", "wrong", "levelup", "click"];

// ---------- Pure helpers ----------

// Frequencies and notes.
near(helpers.midiToFreq(69), 440, 1e-9, "A4");
near(helpers.midiToFreq(81), 880, 1e-9, "A5");
near(helpers.midiToFreq(60), 261.6256, 1e-3, "C4");
eq(helpers.noteToMidi("C4"), 60);
eq(helpers.noteToMidi("A4"), 69);
eq(helpers.noteToMidi("F#3"), 54);
eq(helpers.noteToMidi("Bb2"), 46);
eq(helpers.noteToMidi("c5"), 72);
eq(helpers.noteToMidi("C-1"), 0);
["", "H4", "C", "4", "C##4", "Cb", null, undefined, 60].forEach((bad) => ok(Number.isNaN(helpers.noteToMidi(bad)), `invalid note ${String(bad)}`));
near(helpers.noteFreq("E5"), 659.2551, 1e-3);
near(helpers.noteFreq(72), 523.2511, 1e-3, "midi numbers are accepted");
ok(Number.isNaN(helpers.noteFreq("nope")));

// Volume.
eq(helpers.normalizeVolume(0.3), 0.3);
eq(helpers.normalizeVolume(-1), 0);
eq(helpers.normalizeVolume(7), 1);
eq(helpers.normalizeVolume("0.25"), 0.25, "a numeric string is accepted");
eq(helpers.normalizeVolume("loud"), constants.DEFAULT_VOLUME);
eq(helpers.normalizeVolume(NaN), constants.DEFAULT_VOLUME);
eq(helpers.normalizeVolume(undefined), constants.DEFAULT_VOLUME);
eq(helpers.normalizeVolume(null, 0.9), 0.9, "explicit fallback");
eq(helpers.normalizeVolume({}, 0.1), 0.1);
eq(helpers.volumeToGain(0), 0);
near(helpers.volumeToGain(1), constants.MASTER_MAX_GAIN, 1e-12);
ok(helpers.volumeToGain(1) <= 1, "never above unity");
near(helpers.volumeToGain(0.5), Math.pow(0.5, constants.VOLUME_TAPER) * constants.MASTER_MAX_GAIN, 1e-12, "power taper");
ok(helpers.volumeToGain(0.5) < helpers.volumeToGain(1) / 2, "taper: half the slider is less than half the gain");
let previous = -1;
for (let v = 0; v <= 1.0001; v += 0.05) {
  const gain = helpers.volumeToGain(v);
  ok(gain >= previous, "monotonic");
  previous = gain;
}
eq(helpers.volumeToGain("garbage"), helpers.volumeToGain(constants.DEFAULT_VOLUME));

// Envelopes.
{
  const spec = { attack: 0.01, duration: 0.2, peak: 0.5 };
  const points = helpers.envelopePoints(spec);
  eq(points.length, 3);
  same(points.map((p) => p.curve), ["set", "linear", "exp"]);
  same(points.map((p) => p.t), [0, 0.01, 0.2]);
  eq(points[0].v, constants.ENVELOPE_FLOOR);
  eq(points[1].v, 0.5);
  eq(points[2].v, constants.ENVELOPE_FLOOR);
  ok(points.every((p) => p.v > 0), "exponential ramps need strictly positive values");
  eq(helpers.envelopePoints(spec, 0.5)[1].v, 0.25, "scale multiplies the peak");
  ok(helpers.envelopePoints(spec, 0)[1].v > 0, "even a zero scale keeps the values positive");
  eq(helpers.envelopePoints(spec, 3)[1].v, 0.5, "scale is clamped to 1");
  eq(helpers.envelopePoints(spec, "x")[1].v, 0.5, "invalid scale is ignored");
  // Degenerate specs stay sane: attack never exceeds half the duration, nothing is NaN.
  const odd = helpers.envelopePoints({ attack: 5, duration: 0.02, peak: 1 });
  ok(odd[1].t <= 0.01 + 1e-12 && odd[2].t === 0.02);
  const empty = helpers.envelopePoints({});
  ok(empty.every((p) => Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 0));
  ok(empty[1].t < empty[2].t);

  eq(helpers.envelopeAt(spec, -0.1), 0, "before the voice");
  eq(helpers.envelopeAt(spec, 0.5), 0, "after the voice");
  eq(helpers.envelopeAt(spec, NaN), 0);
  near(helpers.envelopeAt(spec, 0), constants.ENVELOPE_FLOOR, 1e-12, "starts at the floor");
  near(helpers.envelopeAt(spec, 0.01), 0.5, 1e-12, "peaks at the end of the attack");
  near(helpers.envelopeAt(spec, 0.005), (constants.ENVELOPE_FLOOR + 0.5) / 2, 1e-9, "linear attack");
  near(helpers.envelopeAt(spec, 0.2), constants.ENVELOPE_FLOOR, 1e-9, "decays to the floor");
  let last = Infinity;
  for (let i = 2; i <= 40; i += 1) {
    const value = helpers.envelopeAt(spec, i / 200);
    ok(value <= last + 1e-12, "monotonically decaying after the attack");
    ok(value > 0);
    last = value;
  }
  // Exponential: equal time steps give equal ratios.
  const r1 = helpers.envelopeAt(spec, 0.06) / helpers.envelopeAt(spec, 0.03);
  const r2 = helpers.envelopeAt(spec, 0.09) / helpers.envelopeAt(spec, 0.06);
  near(r1, r2, 1e-9, "constant decay ratio");
}

// Soft-clip transfer curve.
{
  const curve = helpers.softClipCurve(1024);
  eq(curve.length, 1024);
  ok(curve instanceof Float32Array);
  let increasing = true;
  for (let i = 1; i < curve.length; i += 1) if (!(curve[i] >= curve[i - 1])) increasing = false;
  ok(increasing, "monotonic");
  ok(curve.every((y) => Math.abs(y) < 0.77), "never reaches full scale");
  near(curve[0], -curve[curve.length - 1], 1e-6, "odd symmetry");
  const mid = (curve.length - 1) / 2;
  const x = (i) => (i / (curve.length - 1)) * 2 - 1;
  near(curve[Math.round(mid) + 20] / x(Math.round(mid) + 20), 1, 0.01, "unity slope for small levels: sounds are not coloured");
  eq(helpers.softClipCurve(0).length, 1024, "invalid size falls back");
  eq(helpers.softClipCurve(3).length, 3);
}

// Pitch glide.
{
  const voice = { freq: 300, freqEnd: 100, pitchTime: 0.1 };
  eq(helpers.pitchAt(voice, 0), 300);
  eq(helpers.pitchAt(voice, -1), 300);
  eq(helpers.pitchAt(voice, 0.1), 100);
  eq(helpers.pitchAt(voice, 5), 100);
  near(helpers.pitchAt(voice, 0.05), Math.sqrt(300 * 100), 1e-9, "geometric midpoint");
  eq(helpers.pitchAt({ freq: 440 }, 0.3), 440, "no glide");
}

// ---------- Sound recipes ----------

same(AudioModule.names.slice(), NAMES, "the documented names, in order");
same(Object.keys(SOUNDS).sort(), NAMES.slice().sort());
ok(Object.isFrozen(SOUNDS) && Object.isFrozen(SOUNDS.move.voices[0]), "recipes are immutable");
ok(Object.isFrozen(HAPTIC_PATTERNS));

const toneVoices = (name) => SOUNDS[name].voices.filter((voice) => voice.type === "tone");
const fundamentals = (name) => toneVoices(name).filter((voice) => voice.peak >= 0.2).sort((a, b) => a.start - b.start);

NAMES.forEach((name) => {
  const voices = SOUNDS[name].voices;
  ok(voices.length >= 1 && voices.length <= 8, `${name}: a handful of voices`);
  voices.forEach((voice, index) => {
    const label = `${name}[${index}]`;
    ok(voice.type === "tone" || voice.type === "noise", `${label} type`);
    ok(Number.isFinite(voice.start) && voice.start >= 0 && voice.start < 0.5, `${label} start`);
    ok(Number.isFinite(voice.duration) && voice.duration >= 0.005 && voice.duration <= 1, `${label} duration`);
    ok(Number.isFinite(voice.peak) && voice.peak > 0 && voice.peak <= 0.7, `${label} peak leaves headroom`);
    ok(voice.attack >= 0.001 && voice.attack <= voice.duration / 2, `${label} attack is long enough to avoid a click`);
    if (voice.type === "tone") {
      ok(["sine", "triangle"].includes(voice.wave), `${label} soft waveforms only`);
      ok(voice.freq >= 40 && voice.freq <= 8000, `${label} audible frequency`);
      if (voice.freqEnd !== undefined) {
        ok(voice.freqEnd >= 40 && voice.freqEnd <= 8000 && voice.pitchTime > 0 && voice.pitchTime <= voice.duration, `${label} glide`);
      }
    } else {
      ok(voice.filter && voice.filter.freq >= 100 && voice.filter.freq <= 12000 && voice.filter.q > 0 && voice.filter.q <= 12, `${label} noise is always filtered`);
    }
    if (voice.filter) ok(["lowpass", "bandpass", "highpass"].includes(voice.filter.type));
  });
  ok(helpers.soundDuration(name) <= 1, `${name} is short`);
});

ok(helpers.soundDuration("click") <= 0.05, "click is tiny");
ok(helpers.soundDuration("move") <= 0.12, "move is a tick");
ok(helpers.soundDuration("capture") > helpers.soundDuration("move"), "capture is longer than move");
const peakSum = (name) => SOUNDS[name].voices.reduce((sum, voice) => sum + voice.peak * voice.duration, 0);
ok(peakSum("capture") > peakSum("move") * 1.5, "capture carries clearly more energy than move");
ok(Math.min(...toneVoices("capture").map((voice) => voice.freq)) < Math.min(...toneVoices("move").map((voice) => voice.freq)), "capture reaches lower");
ok(peakSum("click") < peakSum("move"), "click is the quietest tick");

// correct: soft rising two-note chime.
{
  const notes = fundamentals("correct");
  eq(notes.length, 2);
  ok(notes[1].freq > notes[0].freq, "rising");
  ok(notes[1].start > notes[0].start);
  near(notes[0].freq, helpers.noteFreq("E5"), 1e-6);
  near(notes[1].freq, helpers.noteFreq("A5"), 1e-6);
  ok(SOUNDS.correct.voices.every((voice) => voice.type === "tone" && voice.wave === "sine"), "soft: sine only");
}
// great: three-note arpeggio.
{
  const notes = fundamentals("great");
  eq(notes.length, 3);
  ok(notes[0].freq < notes[1].freq && notes[1].freq < notes[2].freq, "ascending arpeggio");
  same(notes.map((voice) => Math.round(12 * Math.log2(voice.freq / notes[0].freq))), [0, 4, 7], "a major triad");
  ok(notes[2].duration > notes[1].duration, "the last note rings longer");
}
// levelup: a longer ascending arpeggio.
{
  const notes = fundamentals("levelup");
  ok(notes.length >= 4);
  for (let i = 1; i < notes.length; i += 1) ok(notes[i].freq > notes[i - 1].freq, "ascending");
  ok(helpers.soundDuration("levelup") > helpers.soundDuration("great"), "the biggest reward is the longest");
}
// wrong: a low soft thud, not a buzzer.
{
  const wrong = SOUNDS.wrong.voices;
  ok(wrong.every((voice) => voice.type === "noise" || voice.freq <= 200), "low pitch");
  ok(wrong.every((voice) => voice.filter && voice.filter.type === "lowpass" && voice.filter.freq <= 500), "everything is low-passed");
  ok(wrong.every((voice) => voice.wave !== "square" && voice.wave !== "sawtooth"));
  ok(wrong.every((voice) => voice.attack >= 0.004), "no sharp attack");
  ok(Math.max(...wrong.map((voice) => voice.peak)) <= 0.7, "gentle level");
  ok(helpers.soundDuration("wrong") < 0.4);
}
// check: distinguishable from move (has a bell above 800 Hz).
ok(toneVoices("check").some((voice) => voice.freq > 800) && !toneVoices("move").some((voice) => voice.freq > 800 && voice.peak > 0.15));

// describe() returns copies.
{
  const copy = helpers.describe("move");
  copy.voices[0].freq = 1;
  copy.voices.pop();
  ok(SOUNDS.move.voices[0].freq !== 1 && SOUNDS.move.voices.length === 3, "recipes cannot be changed through describe()");
  eq(helpers.describe("nope"), null);
  eq(helpers.describe("__proto__"), null);
  eq(helpers.soundDuration("nope"), 0);
}

// Haptic patterns.
NAMES.forEach((name) => {
  const pattern = helpers.hapticPattern(name);
  ok(Array.isArray(pattern) && pattern.length >= 1, `${name} has a pattern`);
  ok(pattern.every((ms) => Number.isInteger(ms) && ms >= 1 && ms <= 120), `${name}: sane durations`);
  ok(pattern.reduce((a, b) => a + b, 0) <= 400, `${name}: short`);
  ok(pattern.length % 2 === 1, `${name}: ends on a vibration, not a pause`);
});
same(helpers.hapticPattern("success"), helpers.hapticPattern("correct"));
same(helpers.hapticPattern("error"), helpers.hapticPattern("wrong"));
same(helpers.hapticPattern("warning"), helpers.hapticPattern("check"));
same(helpers.hapticPattern("tap"), helpers.hapticPattern("click"));
eq(helpers.hapticPattern("nope"), null);
eq(helpers.hapticPattern("__proto__"), null);
eq(helpers.hapticPattern(undefined), null);
{
  const a = helpers.hapticPattern("move");
  a.push(999);
  same(helpers.hapticPattern("move"), [10], "callers get a copy");
}

// ---------- Fakes ----------

class FakeParam {
  constructor(name) { this.name = name; this.value = 0; this.calls = []; }
  record(kind, value, time, extra) {
    assert.ok(Number.isFinite(value), `${this.name}.${kind}: finite value`);
    assert.ok(Number.isFinite(time), `${this.name}.${kind}: finite time`);
    this.calls.push({ kind, value, time, extra });
    return this;
  }
  setValueAtTime(value, time) { return this.record("set", value, time); }
  linearRampToValueAtTime(value, time) { return this.record("linear", value, time); }
  exponentialRampToValueAtTime(value, time) {
    if (!(value > 0)) throw new RangeError(`${this.name}: exponential ramp to ${value}`);
    return this.record("exp", value, time);
  }
  setTargetAtTime(value, time, constant) { return this.record("target", value, time, constant); }
}

function makeAudio(options = {}) {
  const instances = [];
  const clock = { t: 10000 };
  const state = { ctorThrows: false, initialState: options.initialState || "suspended", resumeRejects: false };

  class FakeNode {
    constructor(kind, context) { this.kind = kind; this.connections = []; this.disconnected = false; context.nodes.push(this); }
    connect(destination) { this.connections.push(destination); return destination; }
    disconnect() { this.disconnected = true; }
  }
  class FakeContext {
    constructor(opts) {
      if (state.ctorThrows) throw new Error("no audio here");
      this.options = opts;
      this.state = state.initialState;
      this.currentTime = 1.5;
      this.sampleRate = 48000;
      this.destination = { kind: "destination" };
      this.nodes = [];
      this.resumeCalls = 0;
      this.buffers = [];
      instances.push(this);
    }
    resume() {
      this.resumeCalls += 1;
      if (state.resumeRejects) return Promise.reject(new Error("still locked"));
      return Promise.resolve().then(() => { this.state = "running"; });
    }
    createGain() { const node = new FakeNode("gain", this); node.gain = new FakeParam("gain"); return node; }
    createOscillator() {
      const node = new FakeNode("oscillator", this);
      node.frequency = new FakeParam("frequency");
      node.type = "sine";
      node.start = (time) => { node.startedAt = time; };
      node.stop = (time) => { node.stoppedAt = time; };
      return node;
    }
    createBiquadFilter() {
      const node = new FakeNode("filter", this);
      node.frequency = new FakeParam("filter.frequency");
      node.Q = new FakeParam("filter.Q");
      return node;
    }
    createBufferSource() {
      const node = new FakeNode("noise", this);
      node.start = (time, offset) => { node.startedAt = time; node.offset = offset; };
      node.stop = (time) => { node.stoppedAt = time; };
      return node;
    }
    createWaveShaper() {
      const node = new FakeNode("shaper", this);
      node.curve = null;
      node.oversample = "none";
      return node;
    }
    createBuffer(channels, length, rate) {
      const data = new Float32Array(length);
      const buffer = { channels, length, sampleRate: rate, data, getChannelData: () => data };
      this.buffers.push(buffer);
      return buffer;
    }
    of(kind) { return this.nodes.filter((node) => node.kind === kind); }
  }

  const listeners = [];
  const doc = {
    hidden: false,
    addEventListener(type, fn, opts) { listeners.push({ type, fn, opts }); },
    removeEventListener(type, fn) {
      const index = listeners.findIndex((entry) => entry.type === type && entry.fn === fn);
      if (index >= 0) listeners.splice(index, 1);
    },
    fire(type) { listeners.filter((entry) => entry.type === type).forEach((entry) => entry.fn({ type })); },
  };
  const settingsValues = Object.assign({ "sound.enabled": true, "sound.volume": 0.5, haptics: true }, options.settings);
  const settings = options.noSettings ? undefined : {
    get(path) { return settingsValues[path]; },
    set(path, value) { settingsValues[path] = value; },
  };
  const vibrations = [];
  const navigator = options.noVibrate ? {} : {
    userActivation: options.userActivation,
    vibrate(pattern) { vibrations.push(pattern); return options.vibrateResult === undefined ? true : options.vibrateResult; },
  };
  const env = {
    AudioContext: options.noContext ? undefined : FakeContext,
    document: doc,
    navigator,
    settings,
    config: options.config,
    now: () => clock.t,
    maxVoices: options.maxVoices,
  };
  if (options.noContext) env.AudioContext = null;
  const audio = AudioModule.createInstance(env);
  return { audio, instances, clock, doc, listeners, settingsValues, vibrations, state, FakeContext, ctx: () => instances[0] };
}

// A gesture-unlocked, running context is what most tests need.
async function unlocked(options) {
  const t = makeAudio(options);
  t.audio.install();
  t.doc.fire("pointerdown");
  await settle();
  return t;
}

// ---------- Lazy unlock ----------

(async () => {
  // Nothing happens before a gesture: no context, no sound, no warning.
  {
    const t = makeAudio();
    eq(t.audio.isSupported(), true);
    eq(t.audio.play("move"), false, "no gesture yet: play refuses");
    eq(t.instances.length, 0, "and it does not create an AudioContext");
    eq(t.audio.isUnlocked(), false);
    ok(t.audio.install(), "install attaches listeners");
    ok(t.audio.install(), "idempotent");
    same(t.listeners.map((entry) => entry.type).sort(), ["click", "keydown", "pointerdown", "touchend"], "document-level gesture listeners, once each");
    ok(t.listeners.every((entry) => entry.opts && entry.opts.capture === true && entry.opts.passive === true), "capture + passive");
    eq(t.instances.length, 0, "installing creates nothing");
    t.doc.fire("keydown");
    eq(t.instances.length, 1, "the first gesture creates the context");
    eq(t.ctx().resumeCalls, 1, "and resumes it");
    await settle();
    eq(t.audio.isUnlocked(), true);
    eq(t.ctx().buffers.length, 1, "a silent buffer is played once to unlock iOS");
    eq(t.ctx().of("noise").length, 1);
    t.doc.fire("pointerdown");
    t.doc.fire("click");
    eq(t.instances.length, 1, "later gestures reuse the context");
    eq(t.ctx().resumeCalls, 1, "and do not resume a running one");
    t.audio.uninstall();
    eq(t.listeners.length, 0, "uninstall detaches everything");
  }

  // The context can also be unlocked explicitly, and browsers that report prior activation count.
  {
    const t = makeAudio();
    t.audio.unlock();
    eq(t.instances.length, 1);
    const t2 = makeAudio({ userActivation: { hasBeenActive: true } });
    eq(t2.audio.play("move"), true, "prior user activation is enough (no listener needed)");
    const t3 = makeAudio({ userActivation: { hasBeenActive: false } });
    eq(t3.audio.play("move"), false);
  }

  // ---------- Scheduling ----------

  {
    const t = await unlocked();
    const ctx = t.ctx();
    const nodesBefore = ctx.nodes.length;
    eq(t.audio.play("move"), true);
    const created = ctx.nodes.slice(nodesBefore);
    const oscillators = created.filter((node) => node.kind === "oscillator");
    const noises = created.filter((node) => node.kind === "noise");
    const recipe = SOUNDS.move.voices;
    eq(oscillators.length, recipe.filter((voice) => voice.type === "tone").length);
    eq(noises.length, recipe.filter((voice) => voice.type === "noise").length);
    const when = ctx.currentTime + 0.005;
    oscillators.forEach((osc, index) => {
      const voice = recipe.filter((v) => v.type === "tone")[index];
      near(osc.startedAt, when + voice.start, 1e-9, "start time");
      near(osc.stoppedAt, osc.startedAt + voice.duration + 0.03, 1e-9, "stop time");
      eq(osc.type, voice.wave);
      eq(osc.frequency.calls[0].kind, "set");
      eq(osc.frequency.calls[0].value, voice.freq);
      if (voice.freqEnd) {
        eq(osc.frequency.calls[1].kind, "exp");
        eq(osc.frequency.calls[1].value, voice.freqEnd);
        near(osc.frequency.calls[1].time, osc.startedAt + voice.pitchTime, 1e-9);
      }
      ok(osc.stoppedAt > osc.startedAt);
      // The oscillator feeds a gain node, which feeds the master.
      const gain = osc.connections[0];
      eq(gain.kind, "gain");
      const times = gain.gain.calls.map((call) => call.time);
      same(times.slice().sort((a, b) => a - b), times, "envelope times are ordered");
      same(gain.gain.calls.map((call) => call.kind), ["set", "linear", "exp"]);
      ok(gain.gain.calls.every((call) => call.value > 0));
      near(gain.gain.calls[1].value, voice.peak, 1e-12, "peak");
      near(gain.gain.calls[2].time, osc.startedAt + voice.duration, 1e-9, "decay ends with the voice");
    });
    noises.forEach((source) => {
      eq(source.connections[0].kind, "filter", "noise goes through its filter");
      ok(source.offset >= 0 && source.offset < 0.15);
      ok(source.stoppedAt > source.startedAt);
    });
    // Master chain: voice gains -> master -> soft clipper -> destination.
    const masterNode = ctx.of("gain")[0];
    const shaper = ctx.of("shaper")[0];
    ok(masterNode.connections.includes(shaper), "master feeds the soft clipper");
    ok(shaper.connections.includes(ctx.destination), "the soft clipper feeds the destination");
    eq(shaper.oversample, "2x");
    ok(shaper.curve instanceof Float32Array && shaper.curve.length === 1024, "a 1024-point transfer curve");
    const target = masterNode.gain.calls.filter((call) => call.kind === "set").pop();
    near(target.value, helpers.volumeToGain(0.5), 1e-12, "master gain follows the volume at play time");
    near(target.time, ctx.currentTime, 1e-12, "and takes effect immediately, not ramped from 1");
  }

  // All sounds schedule without a throw and with valid automation.
  {
    const t = await unlocked();
    for (const name of NAMES) {
      t.clock.t += 1000;
      eq(t.audio.play(name), true, name);
    }
    const ctx = t.ctx();
    ok(ctx.of("oscillator").length > 20);
    // (the first noise source is the silent iOS unlock buffer, which is not scheduled with a stop time)
    ctx.of("oscillator").concat(ctx.of("noise").slice(1)).forEach((node) => ok(node.stoppedAt > node.startedAt && Number.isFinite(node.startedAt)));
    ctx.of("oscillator").forEach((osc) => ok(osc.frequency.calls.every((call) => call.value >= 40 && call.value <= 8000)));
  }

  // Per-play options.
  {
    const t = await unlocked();
    const ctx = t.ctx();
    const before = ctx.nodes.length;
    t.audio.play("correct", { delay: 0.25, gain: 0.5 });
    const first = ctx.nodes.slice(before).find((node) => node.kind === "oscillator");
    near(first.startedAt, ctx.currentTime + 0.25 + 0.005, 1e-9, "delay shifts the start");
    near(first.connections[0].gain.calls[1].value, SOUNDS.correct.voices[0].peak * 0.5, 1e-12, "gain scales the peak");
    t.clock.t += 100;
    const before2 = ctx.nodes.length;
    t.audio.play("correct", { delay: 99, gain: 50 });
    const second = ctx.nodes.slice(before2).find((node) => node.kind === "oscillator");
    near(second.startedAt, ctx.currentTime + 2 + 0.005, 1e-9, "delay is capped at 2 s");
    near(second.connections[0].gain.calls[1].value, SOUNDS.correct.voices[0].peak, 1e-12, "gain is capped at 1");
    t.clock.t += 100;
    eq(t.audio.play("correct", { delay: "soon", gain: NaN }), true, "garbage options are ignored");
    eq(t.audio.play("move", null), true);
  }

  // ---------- Settings, hidden, config ----------

  {
    const t = await unlocked();
    const ctx = t.ctx();
    t.settingsValues["sound.enabled"] = false;
    const nodes = ctx.nodes.length;
    eq(t.audio.play("move"), false, "sound.enabled = false silences everything");
    eq(ctx.nodes.length, nodes, "and schedules nothing");
    t.settingsValues["sound.enabled"] = true;
    eq(t.audio.play("move"), true, "re-enabled at once: settings are read at play time");

    t.clock.t += 500;
    t.settingsValues["sound.volume"] = 1;
    t.audio.play("move");
    const masterNode = ctx.of("gain")[0];
    near(masterNode.gain.calls.filter((call) => call.kind === "set").pop().value, constants.MASTER_MAX_GAIN, 1e-12, "volume 1");
    t.clock.t += 500;
    t.settingsValues["sound.volume"] = 0.2;
    t.audio.play("move");
    near(masterNode.gain.calls.filter((call) => call.kind === "set").pop().value, helpers.volumeToGain(0.2), 1e-12, "volume 0.2");
    t.clock.t += 500;
    t.settingsValues["sound.volume"] = 0;
    eq(t.audio.play("move"), false, "volume 0 is silence");
    t.settingsValues["sound.volume"] = "not a number";
    t.clock.t += 500;
    eq(t.audio.play("move"), true, "an invalid volume falls back to the default");
    near(masterNode.gain.calls.filter((call) => call.kind === "set").pop().value, helpers.volumeToGain(constants.DEFAULT_VOLUME), 1e-12);
    t.settingsValues["sound.enabled"] = undefined;
    t.settingsValues["sound.volume"] = undefined;
    t.clock.t += 500;
    eq(t.audio.play("move"), true, "missing values fall back to on / default volume");
  }
  {
    const stub = await unlocked({ noSettings: true });
    eq(stub.audio.play("move"), true, "no Settings at all: defaults");
    const t = makeAudio();
    t.doc.fire("pointerdown");
  }
  {
    // Settings that throws must not break or silence anything.
    const t = makeAudio();
    t.audio.unlock();
    await settle();
    const settingsEnv = AudioModule.createInstance({
      AudioContext: t.FakeContext, document: t.doc, navigator: {}, now: () => t.clock.t,
      settings: { get() { throw new Error("broken settings"); } },
    });
    settingsEnv.unlock();
    eq(settingsEnv.play("move"), true);
    const emptyStub = AudioModule.createInstance({ AudioContext: t.FakeContext, document: t.doc, navigator: {}, now: () => t.clock.t, settings: {} });
    emptyStub.unlock();
    eq(emptyStub.play("click"), true, "a Settings stub without get()");
    eq(emptyStub.haptic("move"), false, "no vibrate on this navigator");
  }
  {
    const t = await unlocked();
    t.doc.hidden = true;
    eq(t.audio.play("move"), false, "nothing plays while the tab is hidden");
    t.doc.hidden = false;
    eq(t.audio.play("move"), true);
    const off = await unlocked({ config: { features: { audio: false } } });
    eq(off.audio.play("move"), false, "config.features.audio = false");
    const on = await unlocked({ config: { features: { audio: true } } });
    eq(on.audio.play("move"), true);
  }

  // ---------- Rate limit and voice cap ----------

  {
    const t = await unlocked();
    eq(t.audio.play("move"), true);
    t.clock.t += 59;
    eq(t.audio.play("move"), false, "an identical sound within 60 ms is dropped");
    eq(t.audio.play("capture"), true, "a different sound is not limited");
    t.clock.t += 1;
    eq(t.audio.play("move"), true, "exactly 60 ms later it plays again");
    t.clock.t -= 500;
    eq(t.audio.play("move"), true, "a clock that jumped back does not block sounds forever");
    for (const name of ["move", "capture", "check"]) {
      t.clock.t += 61;
      eq(t.audio.play(name), true);
    }
  }
  {
    const t = await unlocked({ maxVoices: 10 });
    const ctx = t.ctx();
    let played = 0;
    for (let i = 0; i < 20; i += 1) {
      t.clock.t += 100;
      if (t.audio.play("capture")) played += 1; // 4 voices each
    }
    eq(played, 2, "the voice cap stops a flood (10 voices, 4 per capture)");
    // Ended voices free their slot.
    ctx.of("oscillator").concat(ctx.of("noise")).forEach((node) => node.onended && node.onended());
    t.clock.t += 100;
    eq(t.audio.play("capture"), true, "slots are released when voices end");
    const released = ctx.of("gain").filter((node) => node.disconnected).length;
    ok(released >= 4, "finished voices disconnect their gain node");
  }

  // ---------- Robustness ----------

  {
    const t = await unlocked();
    [undefined, null, 5, {}, [], "", "nope", "MOVE", "__proto__", "constructor", "toString"].forEach((bad) => eq(t.audio.play(bad), false, `play(${String(bad)})`));
  }
  {
    // No AudioContext at all.
    const t = makeAudio({ noContext: true });
    eq(t.audio.isSupported(), false);
    eq(t.audio.install(), true);
    t.doc.fire("pointerdown");
    eq(t.audio.unlock(), false);
    eq(t.audio.play("move"), false);
    eq(t.audio.isUnlocked(), false);
    eq(t.audio.haptic("move"), true, "haptics do not need an AudioContext");
    t.audio.uninstall();
  }
  {
    // A constructor that throws: no exception, and no retry storm.
    const t = makeAudio();
    t.state.ctorThrows = true;
    t.audio.install();
    t.doc.fire("pointerdown");
    eq(t.audio.play("move"), false);
    eq(t.audio.isSupported(), false, "marked unsupported after a failed construction");
    t.state.ctorThrows = false;
    eq(t.audio.play("move"), false, "and not retried on every call");
  }
  {
    // A context whose resume() rejects: no unhandled rejection, still schedules.
    const t = makeAudio();
    t.state.resumeRejects = true;
    t.audio.unlock();
    await settle();
    eq(t.audio.isUnlocked(), false);
    eq(t.audio.play("move"), true, "sounds are scheduled; they play once the browser lets the context run");
    await settle();
  }
  {
    // A closed context is replaced.
    const t = await unlocked();
    t.ctx().state = "closed";
    t.clock.t += 500;
    eq(t.audio.play("move"), true);
    eq(t.instances.length, 2, "a new context replaces the closed one");
  }
  {
    // A context that is not running yet (resume pending) still accepts the sound and asks for resume.
    const t = makeAudio();
    t.audio.install();
    t.doc.fire("pointerdown");
    eq(t.ctx().state, "suspended");
    eq(t.audio.play("move"), true, "the very first sound after the gesture is not lost");
    ok(t.ctx().resumeCalls >= 2);
  }
  {
    // Old browsers without a WaveShaper node.
    const t = makeAudio();
    t.FakeContext.prototype.createWaveShaper = undefined;
    t.audio.unlock();
    await settle();
    eq(t.audio.play("move"), true);
    ok(t.ctx().of("gain")[0].connections.includes(t.ctx().destination), "master connects straight to the destination");
  }

  // ---------- Haptics ----------

  {
    const t = makeAudio({ userActivation: { hasBeenActive: true } });
    eq(t.audio.haptic("move"), true);
    same(t.vibrations, [[10]]);
    t.clock.t += 100;
    eq(t.audio.haptic("wrong"), true);
    same(t.vibrations[1], [45]);
    t.clock.t += 100;
    eq(t.audio.haptic("success"), true, "alias");
    same(t.vibrations[2], helpers.hapticPattern("correct"));
    eq(t.audio.haptic("check"), true);
    same(t.vibrations[3], [14, 40, 14]);
    t.vibrations[3].push(1);
    same(HAPTIC_PATTERNS.check, [14, 40, 14], "the pattern handed to the device is a copy");
    t.clock.t += 100;
    eq(t.audio.haptic("move"), true);
    t.clock.t += 10;
    eq(t.audio.haptic("move"), false, "identical haptics are rate limited");
    eq(t.audio.haptic("nope"), false);
    eq(t.audio.haptic(undefined), false);
    eq(t.audio.haptic("__proto__"), false);
    t.settingsValues.haptics = false;
    t.clock.t += 500;
    const count = t.vibrations.length;
    eq(t.audio.haptic("move"), false, "the haptics setting gates vibration");
    eq(t.vibrations.length, count);
    t.settingsValues.haptics = true;
    t.doc.hidden = true;
    eq(t.audio.haptic("move"), false, "no vibration while hidden");
    t.doc.hidden = false;
    eq(t.audio.haptic("move"), true);
    t.settingsValues["sound.enabled"] = false;
    t.clock.t += 500;
    eq(t.audio.haptic("move"), true, "haptics do not depend on the sound setting");
  }
  {
    eq(makeAudio({ noVibrate: true }).audio.haptic("move"), false, "no navigator.vibrate");
    eq(makeAudio({ userActivation: { hasBeenActive: false } }).audio.haptic("move"), false, "no user activation yet: Chrome would block and log");
    eq(makeAudio({ vibrateResult: false }).audio.haptic("move"), false, "the device refused");
    const throwing = makeAudio();
    throwing.audio.constructor;
    const audio = AudioModule.createInstance({ document: throwing.doc, navigator: { vibrate() { throw new Error("nope"); } }, settings: throwing.settingsValues && { get: () => true }, now: () => 1 });
    eq(audio.haptic("move"), false, "a throwing vibrate is swallowed");
  }

  // ---------- The shared instance in the real script order ----------

  {
    const fakeDom = require("./_fakedom.js").createFakeDom({ languages: ["en"] });
    const listeners = [];
    fakeDom.document.addEventListener = (type, fn, opts) => listeners.push({ type, fn, opts });
    const instances = [];
    class Ctx {
      constructor() { this.state = "suspended"; this.currentTime = 0; this.sampleRate = 44100; this.destination = {}; this.nodes = []; instances.push(this); }
      resume() { this.state = "running"; return Promise.resolve(); }
      createGain() { const n = { gain: new FakeParam("gain"), connect() {}, disconnect() {} }; this.nodes.push(n); return n; }
      createOscillator() { const n = { frequency: new FakeParam("f"), connect() {}, start() {}, stop() {} }; this.nodes.push(n); return n; }
      createBiquadFilter() { return { frequency: new FakeParam("f"), Q: new FakeParam("q"), connect() {} }; }
      createBufferSource() { return { connect() {}, start() {}, stop() {} }; }
      createBuffer(c, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
    }
    const env = load({
      app: false,
      dom: fakeDom,
      scripts: ["js/ludus.js", "js/scoring.js", "js/settings.js", "js/audio.js"],
      globals: { AudioContext: Ctx },
    });
    const Audio = env.Ludus.Audio;
    ok(Audio && typeof Audio.play === "function" && typeof Audio.haptic === "function", "Ludus.Audio is exposed");
    same(listeners.map((entry) => entry.type).sort(), ["click", "keydown", "pointerdown", "touchend"], "the shared instance installs its gesture listeners at load");
    eq(instances.length, 0, "and creates no AudioContext at load");
    eq(Audio.play("move"), false, "locked until the first gesture");
    listeners.find((entry) => entry.type === "pointerdown").fn({});
    eq(instances.length, 1);
    eq(Audio.play("move"), true, "after the gesture it plays");
    // Settings really drives it (real Ludus.Settings, real defaults).
    eq(env.Ludus.Settings.get("sound.enabled"), true, "default: sound on");
    ok(env.Ludus.Settings.set("sound.enabled", false));
    eq(Audio.play("capture"), false, "Settings sound.enabled=false is honoured");
    ok(env.Ludus.Settings.set("sound.enabled", true));
    ok(env.Ludus.Settings.set("sound.volume", 0));
    eq(Audio.play("capture"), false, "sound.volume=0 is silence");
    ok(env.Ludus.Settings.set("sound.volume", 0.8));
    eq(Audio.play("capture"), true);
  }
  {
    // In Node with no browser globals, the shared instance is inert but safe.
    eq(AudioModule.play("move"), false);
    eq(AudioModule.haptic("move"), false);
    eq(AudioModule.unlock(), false);
    eq(AudioModule.isSupported(), false);
    eq(Ludus.Audio, AudioModule);
  }

  console.log(`audio.test.js: ${assertions} assertions passed`);
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
