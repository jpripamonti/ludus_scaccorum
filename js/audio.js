// Synthesized sounds and haptics, no asset files. Contract: docs/ARCHITECTURE.md section 12.
//
//   Audio.play(name, { delay?, gain? })   name: move capture check correct great wrong levelup click
//   Audio.haptic(kind)                    navigator.vibrate patterns, gated by the "haptics" setting
//   Audio.unlock() / Audio.install()      normally automatic, see below
//
// Every sound is a small recipe (SOUNDS): a few voices, each a sine/triangle tone
// or a burst of filtered noise with a percussive envelope (linear attack, then an
// exponential decay to silence). The recipes and the maths that turn them into
// envelope points and frequencies are pure and exported, so they are unit-tested
// in Node without an AudioContext.
//
// Behaviour rules:
//   * The AudioContext is created lazily, and only after a user gesture: a
//     document-level pointerdown/keydown/touchend/click listener (installed when
//     this file loads in a browser) unlocks it, which is what autoplay policies
//     require and keeps the console free of "not allowed to start" warnings.
//   * "sound.enabled" and "sound.volume" are read from Ludus.Settings every time a
//     sound is played (so a slider change is heard at once), with safe defaults
//     when Settings is missing or a stub.
//   * Nothing plays while the tab is hidden, identical sounds are limited to one
//     per 60 ms, and a cap on live voices stops a runaway caller from flooding the
//     audio graph.
//   * Every public function is no-throw and returns false when it did nothing,
//     including when there is no AudioContext at all.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Audio = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  // ---------- Constants ----------

  const SOUND_NAMES = Object.freeze(["move", "capture", "check", "correct", "great", "wrong", "levelup", "click"]);
  const DEFAULT_VOLUME = 0.5;
  const MASTER_MAX_GAIN = 1;            // the recipes carry their own headroom; a limiter guards the sum
  const VOLUME_TAPER = 1.5;             // slider -> gain exponent (loudness is roughly logarithmic)
  const ENVELOPE_FLOOR = 0.0001;        // exponential ramps cannot reach 0
  const MIN_GAP_MS = 60;                // identical sounds are limited to one per this many ms
  const MAX_ACTIVE_VOICES = 48;
  const CLIP_CURVE_POINTS = 1024;
  const MAX_DELAY_S = 2;
  const STOP_TAIL_S = 0.03;
  const NOISE_SECONDS = 0.3;
  const HAPTIC_MIN_GAP_MS = 40;
  const GESTURE_EVENTS = Object.freeze(["pointerdown", "keydown", "touchend", "click"]);

  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
  const noop = () => {};

  // ---------- Pure helpers ----------

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (Number(midi) - 69) / 12);
  }

  const NOTE_OFFSETS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // "C4" -> 60, "F#3" -> 54, "Bb2" -> 46 (scientific pitch: A4 = 69 = 440 Hz); NaN when invalid.
  function noteToMidi(name) {
    const match = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(String(name).trim());
    if (!match) return NaN;
    const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
    return (Number(match[3]) + 1) * 12 + NOTE_OFFSETS[match[1].toUpperCase()] + accidental;
  }

  // A note name or a MIDI number -> Hz (NaN when invalid).
  function noteFreq(note) {
    return midiToFreq(typeof note === "number" ? note : noteToMidi(note));
  }

  // A slider value -> a linear gain with a power taper (loudness is roughly
  // logarithmic, so half the slider should not be half the amplitude).
  function normalizeVolume(value, fallback) {
    const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    if (!isFiniteNumber(number)) return fallback === undefined ? DEFAULT_VOLUME : fallback;
    return Math.min(1, Math.max(0, number));
  }

  function volumeToGain(volume) {
    const v = normalizeVolume(volume, DEFAULT_VOLUME);
    return MASTER_MAX_GAIN * Math.pow(v, VOLUME_TAPER);
  }

  // Transfer curve of the output soft clipper: tanh over [-1, 1] (odd, monotonic,
  // slope 1 at 0, never reaching +-1).
  function softClipCurve(points) {
    const count = Math.max(3, Math.floor(points) || CLIP_CURVE_POINTS);
    const curve = new Float32Array(count);
    for (let i = 0; i < count; i += 1) curve[i] = Math.tanh((i / (count - 1)) * 2 - 1);
    return curve;
  }

  // The gain automation of one voice as an ordered list of points:
  //   { t: seconds from the voice start, v: gain, curve: "set" | "linear" | "exp" }
  // "set" positions the value, "linear" ramps up to the peak, "exp" decays to the
  // floor. `scale` multiplies the peak (per-play loudness).
  function envelopePoints(spec, scale) {
    const duration = Math.max(0.005, Number(spec.duration) || 0.05);
    const attack = Math.min(Math.max(0.001, Number(spec.attack) || 0.002), duration * 0.5);
    const factor = isFiniteNumber(scale) ? Math.min(1, Math.max(0, scale)) : 1;
    const peak = Math.max(ENVELOPE_FLOOR * 2, (Number(spec.peak) || 0.3) * factor);
    return [
      { t: 0, v: ENVELOPE_FLOOR, curve: "set" },
      { t: attack, v: peak, curve: "linear" },
      { t: duration, v: ENVELOPE_FLOOR, curve: "exp" },
    ];
  }

  // The same envelope evaluated at time t (0 outside the voice's lifetime).
  function envelopeAt(spec, t, scale) {
    const [begin, top, end] = envelopePoints(spec, scale);
    if (!(t >= 0) || t > end.t) return 0;
    if (t <= top.t) return begin.v + (top.v - begin.v) * (t / top.t);
    return top.v * Math.pow(end.v / top.v, (t - top.t) / (end.t - top.t));
  }

  // The oscillator frequency at time t: an exponential glide from freq to freqEnd
  // over pitchTime (what exponentialRampToValueAtTime does), constant otherwise.
  function pitchAt(voice, t) {
    const from = Number(voice.freq);
    if (!isFiniteNumber(voice.freqEnd) || !(voice.pitchTime > 0)) return from;
    if (!(t > 0)) return from;
    if (t >= voice.pitchTime) return voice.freqEnd;
    return from * Math.pow(voice.freqEnd / from, t / voice.pitchTime);
  }

  // ---------- Sound recipes ----------

  // tone:  { type: "tone", wave, freq, freqEnd?, pitchTime?, start, attack, duration, peak, filter? }
  // noise: { type: "noise", start, attack, duration, peak, filter }
  // filter: { type: "lowpass" | "bandpass" | ..., freq, q }
  const tone = (wave, freq, start, duration, peak, extra) => Object.assign(
    { type: "tone", wave, freq, start, attack: 0.004, duration, peak }, extra,
  );
  const noise = (start, duration, peak, filterFreq, q, extra) => Object.assign(
    { type: "noise", start, attack: 0.001, duration, peak, filter: { type: "bandpass", freq: filterFreq, q } }, extra,
  );
  const note = (name) => noteFreq(name);

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach((key) => deepFreeze(value[key]));
    }
    return value;
  }

  const SOUNDS = deepFreeze({
    // A wooden tick: a short resonant body dropping in pitch, a soft click on top.
    move: {
      voices: [
        tone("sine", 330, 0, 0.09, 0.5, { freqEnd: 190, pitchTime: 0.04, attack: 0.002 }),
        tone("triangle", 660, 0, 0.04, 0.1, { attack: 0.002 }),
        noise(0, 0.03, 0.32, 2200, 1.2),
      ],
    },
    // Heavier: deeper body, a longer decay and a second clack (the captured piece leaving).
    capture: {
      voices: [
        tone("sine", 240, 0, 0.16, 0.65, { freqEnd: 105, pitchTime: 0.07, attack: 0.002 }),
        tone("sine", 95, 0, 0.14, 0.4, { freqEnd: 60, pitchTime: 0.1, attack: 0.003 }),
        noise(0, 0.05, 0.5, 1400, 1),
        noise(0.045, 0.045, 0.28, 900, 1.1),
      ],
    },
    // A knock followed by a small bell: noticeable, not alarming.
    check: {
      voices: [
        tone("sine", 380, 0, 0.09, 0.4, { freqEnd: 220, pitchTime: 0.04, attack: 0.002 }),
        noise(0, 0.03, 0.25, 2600, 1.2),
        tone("sine", note("B5"), 0.075, 0.3, 0.34, { attack: 0.005 }),
        tone("sine", note("B6"), 0.075, 0.16, 0.08, { attack: 0.005 }),
      ],
    },
    // A soft rising two-note chime (E5 then A5).
    correct: {
      voices: [
        tone("sine", note("E5"), 0, 0.3, 0.44, { attack: 0.006 }),
        tone("sine", note("E6"), 0, 0.14, 0.09, { attack: 0.006 }),
        tone("sine", note("A5"), 0.11, 0.38, 0.46, { attack: 0.006 }),
        tone("sine", note("A6"), 0.11, 0.18, 0.09, { attack: 0.006 }),
      ],
    },
    // A three-note major arpeggio (C5 E5 G5), the last one ringing longer.
    great: {
      voices: [
        tone("triangle", note("C5"), 0, 0.22, 0.38, { attack: 0.005 }),
        tone("triangle", note("E5"), 0.085, 0.22, 0.38, { attack: 0.005 }),
        tone("triangle", note("G5"), 0.17, 0.46, 0.4, { attack: 0.005 }),
        tone("sine", note("G6"), 0.17, 0.2, 0.08, { attack: 0.005 }),
      ],
    },
    // A low, soft thud: sine glide down through a low-pass, slow attack, no sharp edge.
    wrong: {
      voices: [
        tone("sine", 150, 0, 0.24, 0.62, { freqEnd: 68, pitchTime: 0.14, attack: 0.008, filter: { type: "lowpass", freq: 420, q: 0.7 } }),
        noise(0, 0.07, 0.2, 260, 0.6, { attack: 0.004, filter: { type: "lowpass", freq: 320, q: 0.5 } }),
      ],
    },
    // A rising C major arpeggio ending on a soft held chord.
    levelup: {
      voices: [
        tone("triangle", note("C5"), 0, 0.2, 0.36, { attack: 0.005 }),
        tone("triangle", note("E5"), 0.09, 0.2, 0.36, { attack: 0.005 }),
        tone("triangle", note("G5"), 0.18, 0.2, 0.36, { attack: 0.005 }),
        tone("triangle", note("C6"), 0.27, 0.62, 0.4, { attack: 0.005 }),
        tone("sine", note("E6"), 0.27, 0.6, 0.13, { attack: 0.01 }),
        tone("sine", note("G6"), 0.27, 0.6, 0.1, { attack: 0.01 }),
      ],
    },
    // The quietest one: a tiny, dry tick for buttons.
    click: {
      voices: [
        tone("sine", 1800, 0, 0.03, 0.4, { freqEnd: 1100, pitchTime: 0.015, attack: 0.002 }),
        noise(0, 0.01, 0.2, 3000, 1.5),
      ],
    },
  });

  // navigator.vibrate patterns in milliseconds (odd entries are pauses).
  const HAPTIC_PATTERNS = deepFreeze({
    click: [6],
    move: [10],
    capture: [18],
    check: [14, 40, 14],
    correct: [12, 30, 24],
    great: [10, 30, 10, 30, 30],
    wrong: [45],
    levelup: [16, 40, 16, 40, 16, 40, 60],
  });
  const HAPTIC_ALIASES = deepFreeze({
    tap: "click", selection: "click", light: "click", success: "correct", error: "wrong", warning: "check",
  });

  function describe(name) {
    return hasOwn(SOUNDS, name) ? JSON.parse(JSON.stringify(SOUNDS[name])) : null;
  }

  // Length of a sound in seconds (latest voice end).
  function soundDuration(name) {
    if (!hasOwn(SOUNDS, name)) return 0;
    return SOUNDS[name].voices.reduce((longest, voice) => Math.max(longest, voice.start + voice.duration), 0);
  }

  function hapticPattern(kind) {
    const key = hasOwn(HAPTIC_PATTERNS, kind) ? kind : hasOwn(HAPTIC_ALIASES, kind) ? HAPTIC_ALIASES[kind] : null;
    return key ? HAPTIC_PATTERNS[key].slice() : null;
  }

  // ---------- Instance ----------

  // env (all optional, for tests): { AudioContext, document, navigator, settings,
  // config, now, maxVoices }
  function createInstance(env) {
    const options = env || {};

    const getLudus = () => root.Ludus || {};
    const getSettings = () => options.settings || getLudus().Settings || null;
    const getConfig = () => options.config || getLudus().config || null;
    const getDocument = () => (options.document !== undefined ? options.document : root.document) || null;
    const getNavigator = () => (options.navigator !== undefined ? options.navigator : root.navigator) || null;
    const getContextClass = () => {
      if (options.AudioContext !== undefined) return options.AudioContext;
      return root.AudioContext || root.webkitAudioContext || null;
    };
    const nowMs = () => {
      if (typeof options.now === "function") return options.now();
      try {
        const perf = root.performance;
        if (perf && typeof perf.now === "function") return perf.now();
      } catch (error) {
        // Fall through to the wall clock.
      }
      return Date.now();
    };
    const maxVoices = Number.isInteger(options.maxVoices) && options.maxVoices > 0 ? options.maxVoices : MAX_ACTIVE_VOICES;

    let ctx = null;
    let master = null;
    let noiseBuffer = null;
    let unsupported = false;
    let gestureSeen = false;
    let installed = null;       // { doc, handler } while the gesture listeners are attached
    let activeVoices = 0;
    let noiseCounter = 0;
    let silentPlayed = false;
    const lastPlayed = Object.create(null);
    const lastHaptic = Object.create(null);

    // Settings are read on every call; anything missing or invalid falls back.
    function setting(path, fallback) {
      try {
        const settings = getSettings();
        if (settings && typeof settings.get === "function") {
          const value = settings.get(path);
          if (value !== undefined && value !== null) return value;
        }
      } catch (error) {
        // A broken Settings must never silence or break the app.
      }
      return fallback;
    }

    function featureEnabled() {
      try {
        const config = getConfig();
        return !(config && config.features && config.features.audio === false);
      } catch (error) {
        return true;
      }
    }

    function isHidden() {
      try {
        const doc = getDocument();
        return Boolean(doc && doc.hidden === true);
      } catch (error) {
        return false;
      }
    }

    function userHasActed() {
      if (gestureSeen) return true;
      try {
        const nav = getNavigator();
        return Boolean(nav && nav.userActivation && nav.userActivation.hasBeenActive === true);
      } catch (error) {
        return false;
      }
    }

    function isSupported() {
      return !unsupported && typeof getContextClass() === "function";
    }

    function safeCall(fn) {
      try {
        return fn();
      } catch (error) {
        return undefined;
      }
    }

    function setParam(param, name, value) {
      if (!param) return;
      try {
        if (typeof param[name] === "function") param[name](value.value, value.at, value.extra);
      } catch (error) {
        // An unsupported automation call only costs some polish.
      }
    }

    // voices -> master gain -> soft clipper -> destination. The clipper is a
    // tanh WaveShaper: linear for normal levels, it only rounds off the peaks when
    // several sounds overlap at full volume. (A DynamicsCompressor was tried and
    // rejected: browsers apply a fixed make-up curve that makes every sound about
    // 12 dB quieter and level-dependent.)
    function buildGraph(context) {
      master = context.createGain();
      let tail = master;
      if (typeof context.createWaveShaper === "function") {
        const shaper = safeCall(() => context.createWaveShaper());
        if (shaper) {
          safeCall(() => {
            shaper.curve = softClipCurve(CLIP_CURVE_POINTS);
            shaper.oversample = "2x";
          });
          master.connect(shaper);
          tail = shaper;
        }
      }
      tail.connect(context.destination);
    }

    function ensureContext() {
      if (ctx && ctx.state === "closed") {
        ctx = null;
        master = null;
        noiseBuffer = null;
        silentPlayed = false;
      }
      if (ctx) return ctx;
      if (unsupported) return null;
      const Context = getContextClass();
      if (typeof Context !== "function") {
        unsupported = true;
        return null;
      }
      try {
        try {
          ctx = new Context({ latencyHint: "interactive" });
        } catch (error) {
          ctx = new Context();
        }
        buildGraph(ctx);
      } catch (error) {
        ctx = null;
        master = null;
        unsupported = true;
        return null;
      }
      return ctx;
    }

    function resume() {
      if (!ctx || typeof ctx.resume !== "function") return;
      try {
        const result = ctx.resume();
        if (result && typeof result.catch === "function") result.catch(noop);
      } catch (error) {
        // Still locked: the next gesture tries again.
      }
    }

    // iOS keeps the context locked until something has actually been played
    // inside a gesture: a one-sample silent buffer does it.
    function playSilence() {
      if (!ctx || silentPlayed) return;
      try {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        silentPlayed = true;
      } catch (error) {
        // Not needed everywhere.
      }
    }

    // The gesture handler: creates the context (first time), resumes it when the
    // browser suspended it. Cheap once the context is running.
    function unlock() {
      try {
        gestureSeen = true;
        if (ctx && ctx.state === "running") return true;
        if (!ensureContext()) return false;
        resume();
        playSilence();
        return ctx.state === "running";
      } catch (error) {
        return false;
      }
    }

    // Attaches the document-level listeners that call unlock(). Idempotent.
    function install() {
      if (installed) return true;
      try {
        const doc = getDocument();
        if (!doc || typeof doc.addEventListener !== "function") return false;
        const handler = () => { unlock(); };
        GESTURE_EVENTS.forEach((type) => doc.addEventListener(type, handler, { capture: true, passive: true }));
        installed = { doc, handler };
        return true;
      } catch (error) {
        return false;
      }
    }

    function uninstall() {
      if (!installed) return;
      const { doc, handler } = installed;
      installed = null;
      GESTURE_EVENTS.forEach((type) => safeCall(() => doc.removeEventListener(type, handler, { capture: true })));
    }

    function getNoiseBuffer() {
      if (noiseBuffer) return noiseBuffer;
      const rate = Number(ctx.sampleRate) > 0 ? ctx.sampleRate : 44100;
      const length = Math.max(1, Math.floor(rate * NOISE_SECONDS));
      const buffer = ctx.createBuffer(1, length, rate);
      const data = buffer.getChannelData(0);
      // Deterministic white noise (xorshift): the same tick every time.
      let x = 0x2545f491;
      for (let i = 0; i < length; i += 1) {
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        data[i] = ((x >>> 0) / 4294967295) * 2 - 1;
      }
      noiseBuffer = buffer;
      return buffer;
    }

    function scheduleVoice(voice, when, scale) {
      const start = when + voice.start;
      const stop = start + voice.duration + STOP_TAIL_S;
      const gain = ctx.createGain();
      envelopePoints(voice, scale).forEach((point) => {
        const at = start + point.t;
        const method = point.curve === "set" ? "setValueAtTime" : point.curve === "linear" ? "linearRampToValueAtTime" : "exponentialRampToValueAtTime";
        setParam(gain.gain, method, { value: point.v, at });
      });

      let source;
      if (voice.type === "noise") {
        source = ctx.createBufferSource();
        source.buffer = getNoiseBuffer();
      } else {
        source = ctx.createOscillator();
        source.type = voice.wave;
        setParam(source.frequency, "setValueAtTime", { value: voice.freq, at: start });
        if (isFiniteNumber(voice.freqEnd) && voice.pitchTime > 0) {
          setParam(source.frequency, "exponentialRampToValueAtTime", { value: voice.freqEnd, at: start + voice.pitchTime });
        }
      }

      let head = source;
      if (voice.filter) {
        const filter = ctx.createBiquadFilter();
        filter.type = voice.filter.type;
        setParam(filter.frequency, "setValueAtTime", { value: voice.filter.freq, at: start });
        setParam(filter.Q, "setValueAtTime", { value: voice.filter.q, at: start });
        source.connect(filter);
        head = filter;
      }
      head.connect(gain);
      gain.connect(master);

      activeVoices += 1;
      let released = false;
      source.onended = () => {
        if (released) return;
        released = true;
        activeVoices = Math.max(0, activeVoices - 1);
        safeCall(() => gain.disconnect());
      };
      // Noise buffers are short: shift the start point so consecutive ticks are not sample-identical.
      if (voice.type === "noise") {
        noiseCounter += 1;
        source.start(start, (noiseCounter * 0.037) % (NOISE_SECONDS * 0.5));
      } else {
        source.start(start);
      }
      source.stop(stop);
    }

    // Returns true when the sound was scheduled.
    function play(name, opts) {
      try {
        if (typeof name !== "string" || !hasOwn(SOUNDS, name)) return false;
        if (!featureEnabled()) return false;
        if (setting("sound.enabled", true) === false) return false;
        if (isHidden()) return false;
        const volume = normalizeVolume(setting("sound.volume", DEFAULT_VOLUME), DEFAULT_VOLUME);
        if (volume <= 0) return false;
        if (!isSupported() || !userHasActed()) return false;

        const at = nowMs();
        if (hasOwn(lastPlayed, name) && at - lastPlayed[name] < MIN_GAP_MS && at >= lastPlayed[name]) return false;
        if (activeVoices + SOUNDS[name].voices.length > maxVoices) return false;

        if (!ensureContext()) return false;
        if (ctx.state !== "running") resume();
        lastPlayed[name] = at;

        const extra = opts && typeof opts === "object" ? opts : {};
        const delay = isFiniteNumber(extra.delay) ? Math.min(MAX_DELAY_S, Math.max(0, extra.delay)) : 0;
        const scale = isFiniteNumber(extra.gain) ? extra.gain : 1;
        const now = Number(ctx.currentTime) || 0;
        setParam(master.gain, "setValueAtTime", { value: volumeToGain(volume), at: now });
        const when = now + delay + 0.005;
        SOUNDS[name].voices.forEach((voice) => scheduleVoice(voice, when, scale));
        return true;
      } catch (error) {
        return false;
      }
    }

    // Returns true when a vibration pattern was handed to the device.
    function haptic(kind) {
      try {
        if (setting("haptics", true) === false) return false;
        if (isHidden()) return false;
        const pattern = hapticPattern(kind);
        if (!pattern) return false;
        const nav = getNavigator();
        if (!nav || typeof nav.vibrate !== "function") return false;
        // Chrome refuses (and logs an intervention) before the first user activation.
        if (nav.userActivation && nav.userActivation.hasBeenActive === false) return false;
        const at = nowMs();
        if (hasOwn(lastHaptic, kind) && at - lastHaptic[kind] < HAPTIC_MIN_GAP_MS && at >= lastHaptic[kind]) return false;
        lastHaptic[kind] = at;
        return Boolean(nav.vibrate(pattern));
      } catch (error) {
        return false;
      }
    }

    return {
      play,
      haptic,
      unlock,
      install,
      uninstall,
      isSupported,
      isUnlocked: () => Boolean(ctx) && ctx.state === "running",
      names: SOUND_NAMES,
    };
  }

  // The shared instance follows the real environment (Ludus.Settings, window,
  // navigator, the page's AudioContext). Loading this file in a browser only
  // attaches the gesture listeners; the AudioContext is created by the first
  // gesture, not here.
  const api = createInstance({});
  api.createInstance = createInstance;
  api.constants = Object.freeze({
    SOUND_NAMES,
    DEFAULT_VOLUME,
    MASTER_MAX_GAIN,
    VOLUME_TAPER,
    ENVELOPE_FLOOR,
    MIN_GAP_MS,
    MAX_ACTIVE_VOICES,
    GESTURE_EVENTS,
  });
  // Pure helpers (unit-tested without an AudioContext).
  api.helpers = Object.freeze({
    midiToFreq,
    noteToMidi,
    noteFreq,
    normalizeVolume,
    volumeToGain,
    envelopePoints,
    envelopeAt,
    softClipCurve,
    pitchAt,
    describe,
    soundDuration,
    hapticPattern,
  });
  api.SOUNDS = SOUNDS;
  api.HAPTIC_PATTERNS = HAPTIC_PATTERNS;
  try {
    api.install();
  } catch (error) {
    // No document (Node): the shared instance is simply never unlocked.
  }
  return api;
});
