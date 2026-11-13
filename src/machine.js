// ATH-16: a 16-step drum machine + monophonic bass synth, fully synthesized with Web Audio.
import { getAudioContext } from './audio.js';

export const TRACKS = ['kick', 'snare', 'hat', 'open', 'bass'];
export const STEPS = 16;

// swing: delay of odd 16ths (0..1); glitch: chance of ratchets and pitch jumps (0..1)
export const PRESETS = {
  boombap: { bpm: 90, swing: 0.55, glitch: 0, kick: 'x......x.x......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', open: '..............x.', bass: 'x......x.x....x.' },
  breakbeat: { bpm: 136, swing: 0.15, glitch: 0.05, kick: 'x.x.......xx....', snare: '....x..x.x..x..x', hat: 'x.x.x.x.x.x.x.x.', open: '..........x.....', bass: 'x.x.......x.x...' },
  garage: { bpm: 132, swing: 0.62, glitch: 0, kick: 'x.........x.....', snare: '....x.......x...', hat: '..x..xx...x..xx.', open: '......x.......x.', bass: 'x..x......x..x..' },
  dnb: { bpm: 174, swing: 0, glitch: 0.05, kick: 'x.........x.....', snare: '....x.......x...', hat: 'x.xxx.x.x.xxx.x.', open: '..x.......x.....', bass: 'x.....x...x...x.' },
  halftime: { bpm: 140, swing: 0.1, glitch: 0.1, kick: 'x.....x...x.....', snare: '........x.......', hat: 'x.xxx.x.x.xxx.xx', open: '......x.........', bass: 'x.....x...x...x.' },
  electro: { bpm: 112, swing: 0, glitch: 0, kick: 'x......x..x...x.', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', open: '......x.........', bass: 'x.x..x.xx..x.x..' },
  experimental: { bpm: 97, swing: 0.3, glitch: 0.65, kick: 'x..x...x.x..x...', snare: '...x..x.....x..x', hat: 'x.x..xx.x..x.xx.', open: '.x.......x......', bass: 'x..x.x...xx..x..' },
};

const SCALE = [0, 3, 5, 7, 10, 12, 15]; // minor pentatonic + octave
const BASS_HZ = 55; // A1
const LEAD_HZ = 110; // A2, for the playable keys
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

const midiHz = (base, semi) => base * 2 ** (semi / 12);

export function createMachine({ onStep } = {}) {
  const state = {
    playing: false, bpm: 90, preset: 'boombap', swing: 0.55, glitch: 0, grid: {}, notes: [],
    wave: 'sawtooth', cutoff: 0.45, reso: 0.6, decay: 0.35, drive: 0.3, delay: 0.25,
  };
  let ctx = null;
  let master; let synthBus; let send; let delayNode; let analyser; let buf; let noise; let curve;
  let timer = 0; let nextTime = 0; let step = 0;
  const queue = [];

  function boot() {
    if (ctx) { getAudioContext(); return true; } // resumes the shared context if the browser suspended it
    ctx = getAudioContext();
    if (!ctx) return false;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = 0.7;
    analyser = ctx.createAnalyser(); analyser.fftSize = 512;
    buf = new Float32Array(analyser.fftSize);
    master.connect(comp).connect(analyser).connect(ctx.destination);

    synthBus = ctx.createGain();
    synthBus.connect(master);
    const delay = ctx.createDelay(1);
    const fb = ctx.createGain();
    send = ctx.createGain();
    delay.delayTime.value = (60 / state.bpm) * 0.75; // dotted eighth
    fb.gain.value = 0.38;
    synthBus.connect(send).connect(delay).connect(fb).connect(delay);
    delay.connect(master);
    delayNode = delay;

    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyParams();
    return true;
  }

  function applyParams() {
    if (!ctx) return;
    send.gain.setTargetAtTime(state.delay * 0.7, ctx.currentTime, 0.05);
    delayNode.delayTime.setTargetAtTime((60 / state.bpm) * 0.75, ctx.currentTime, 0.05);
    const k = state.drive * 60;
    curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = (i / 127.5) - 1; curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
  }

  const env = (t, peak, len) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    return g;
  };
  const noiseSrc = (t, len) => {
    const s = ctx.createBufferSource();
    s.buffer = noise; s.start(t); s.stop(t + len + 0.02);
    return s;
  };

  const voices = {
    kick(t, pitch = 1) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(150 * pitch, t);
      o.frequency.exponentialRampToValueAtTime(38 * pitch, t + 0.14);
      o.connect(env(t, 1.1, 0.6)).connect(master);
      o.start(t); o.stop(t + 0.65);
    },
    snare(t, pitch = 1) {
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800 * pitch; f.Q.value = 0.7;
      noiseSrc(t, 0.22).connect(f).connect(env(t, 0.8, 0.2)).connect(master);
      const body = ctx.createOscillator(); body.type = 'triangle';
      body.frequency.setValueAtTime(190 * pitch, t);
      body.frequency.exponentialRampToValueAtTime(120 * pitch, t + 0.08);
      body.connect(env(t, 0.55, 0.12)).connect(master);
      body.start(t); body.stop(t + 0.15);
    },
    hat(t, pitch = 1, len = 0.05, peak = 0.35) {
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500 * pitch;
      noiseSrc(t, len).connect(f).connect(env(t, peak, len)).connect(master);
    },
    open(t, pitch = 1) { voices.hat(t, pitch, 0.32, 0.25); },
    bass(t, semi, base = BASS_HZ, len = 0.12 + state.decay * 0.7) {
      const o = ctx.createOscillator();
      o.type = state.wave;
      o.frequency.value = midiHz(base, semi);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = state.reso * 22;
      const cut = 70 * 2 ** (state.cutoff * 7.5);
      f.frequency.setValueAtTime(Math.min(cut * 4, 16000), t);
      f.frequency.exponentialRampToValueAtTime(cut, t + len * 0.6);
      const shaper = ctx.createWaveShaper(); shaper.curve = curve;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(f).connect(shaper).connect(g).connect(synthBus);
      o.start(t); o.stop(t + len + 0.05);
    },
  };

  const GLITCH_PITCHES = [0.5, 0.75, 1.5, 2];

  /** Fires one voice, sometimes ratcheted/pitched when glitch is up. */
  function hitVoice(tr, i, t, stepDur) {
    const glitchy = Math.random() < state.glitch * 0.45;
    const repeats = glitchy ? 2 + Math.floor(Math.random() * 3) : 1;
    const pitch = glitchy && Math.random() < 0.5 ? GLITCH_PITCHES[Math.floor(Math.random() * GLITCH_PITCHES.length)] : 1;
    for (let r = 0; r < repeats; r++) {
      const at = t + (r * stepDur) / repeats;
      if (tr === 'bass') voices.bass(at, state.notes[i] + (pitch === 1 ? 0 : 12 * Math.log2(pitch)));
      else voices[tr](at, pitch);
    }
  }

  function trigger(i, t, stepDur) {
    for (const tr of TRACKS) if (state.grid[tr][i]) hitVoice(tr, i, t, stepDur);
  }

  function schedule() {
    while (nextTime < ctx.currentTime + SCHEDULE_AHEAD) {
      const stepDur = 60 / state.bpm / 4;
      const at = nextTime + (step % 2 ? state.swing * stepDur * 0.5 : 0);
      trigger(step, at, stepDur);
      queue.push({ step, time: at });
      nextTime += stepDur;
      step = (step + 1) % STEPS;
    }
  }

  function load(name) {
    const p = PRESETS[name];
    state.preset = name;
    state.bpm = p.bpm;
    state.swing = p.swing;
    state.glitch = p.glitch;
    for (const tr of TRACKS) state.grid[tr] = [...p[tr]].map((ch) => ch === 'x');
    mutate();
    applyParams();
  }

  function mutate() {
    state.notes = Array.from({ length: STEPS }, (_, i) => (i % 8 === 0 ? 0 : SCALE[Math.floor(Math.random() * SCALE.length)]));
  }

  function play() {
    if (state.playing || !boot()) return;
    state.playing = true;
    step = 0;
    nextTime = ctx.currentTime + 0.05;
    schedule();
    timer = setInterval(schedule, LOOKAHEAD_MS);
  }

  function stop() {
    state.playing = false;
    clearInterval(timer);
    queue.length = 0;
    onStep?.(-1);
  }

  load('boombap');

  return {
    state,
    play, stop, load, mutate,
    toggle() { (state.playing ? stop : play)(); return state.playing; },
    toggleStep(track, i) { state.grid[track][i] = !state.grid[track][i]; return state.grid[track][i]; },
    set(param, value) { state[param] = value; applyParams(); },
    /** Live note from the keyboard, an octave above the bassline. */
    note(semi) { if (boot()) voices.bass(ctx.currentTime + 0.005, semi, LEAD_HZ, 0.25 + state.decay); },
    /** Call every frame: fires step callbacks in sync with audio time and returns output level 0..1. */
    tick() {
      if (!ctx) return 0;
      while (queue.length && queue[0].time <= ctx.currentTime) onStep?.(queue.shift().step);
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      return Math.min(Math.sqrt(sum / buf.length) * 3.5, 1);
    },
    close() { stop(); }, // the AudioContext is shared site-wide, so it isn't closed here
  };
}
