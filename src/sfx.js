// Synthesized UI sounds (no samples): chiptune blips, laser shots, explosions and the dog.
import { getAudioContext as audio } from './audio.js';

let noiseBuf = null;

function noise(a, t, len) {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const n = a.createBufferSource();
  n.buffer = noiseBuf;
  n.start(t, Math.random() * 0.5);
  n.stop(t + len);
  return n;
}

/** Gain node with an attack/decay envelope. */
function env(a, t, peak, attack, release) {
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  return g;
}

function saturator(a, amount) {
  const ws = a.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = i / 127.5 - 1; curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x)); }
  ws.curve = curve;
  return ws;
}

/** @param {number[]} notes frequencies in Hz, played in sequence */
export function blip(notes, { type = 'square', step = 0.07, gain = 0.08 } = {}) {
  const a = audio();
  if (!a) return;
  notes.forEach((hz, i) => {
    const t = a.currentTime + i * step;
    const o = a.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    o.connect(env(a, t, gain, 0.004, step * 1.5)).connect(a.destination);
    o.start(t);
    o.stop(t + step * 1.7);
  });
}

/** Classic "pew": one continuous, very fast pitch dive, a click at the front and a short space echo. */
function laser() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.005;
  const out = env(a, t, 0.13, 0.004, 0.24);
  const echo = a.createDelay(0.3);
  const fb = a.createGain();
  echo.delayTime.value = 0.085;
  fb.gain.value = 0.32;
  out.connect(a.destination);
  out.connect(echo).connect(fb).connect(echo);
  fb.connect(a.destination);
  for (const [type, mult, detune] of [['square', 1, 0], ['sawtooth', 1.5, 12]]) {
    const o = a.createOscillator();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(2200 * mult, t);
    o.frequency.exponentialRampToValueAtTime(140 * mult, t + 0.2);
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(6000, t);
    lp.frequency.exponentialRampToValueAtTime(900, t + 0.22);
    o.connect(lp).connect(out);
    o.start(t);
    o.stop(t + 0.26);
  }
  const click = a.createBiquadFilter();
  click.type = 'highpass'; click.frequency.value = 3000;
  noise(a, t, 0.02).connect(click).connect(env(a, t, 0.08, 0.001, 0.015)).connect(a.destination);
}

/** Low thump + a noise blast whose filter closes as it dies. */
function boom() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.005;
  const o = a.createOscillator();
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
  o.connect(env(a, t, 0.35, 0.005, 0.4)).connect(a.destination);
  o.start(t); o.stop(t + 0.45);
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2400, t);
  lp.frequency.exponentialRampToValueAtTime(90, t + 0.55);
  noise(a, t, 0.6).connect(lp).connect(env(a, t, 0.28, 0.004, 0.55)).connect(a.destination);
}

// a dog's vocal tract, roughly: three resonances (Hz, Q, level)
const FORMANTS = [[620, 2.2, 1], [1350, 3, 0.65], [2700, 4, 0.3]];

/** One bark: rough saturated source through throat formants, growl tremolo, breath noise, yelp-up-then-drop pitch. */
function bark(a, t, f0) {
  const len = 0.14 + Math.random() * 0.04;
  const out = env(a, t, 0.5, 0.006, len);
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 4200;
  lp.connect(out).connect(a.destination);

  // growl: fast amplitude wobble
  const trem = a.createGain();
  trem.gain.value = 0.7;
  const lfo = a.createOscillator();
  const lfoDepth = a.createGain();
  lfo.type = 'square'; lfo.frequency.value = 38 + Math.random() * 14;
  lfoDepth.gain.value = 0.3;
  lfo.connect(lfoDepth).connect(trem.gain);
  lfo.start(t); lfo.stop(t + len + 0.05);

  const formants = FORMANTS.map(([hz, q, level]) => {
    const bp = a.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = hz * (0.92 + Math.random() * 0.16); bp.Q.value = q;
    const g = a.createGain(); g.gain.value = level * 2.2;
    bp.connect(g).connect(lp);
    return bp;
  });
  const drive = saturator(a, 18);
  trem.connect(drive);
  formants.forEach((bp) => drive.connect(bp));

  for (const detune of [-14, 14]) {
    const o = a.createOscillator();
    o.type = 'sawtooth';
    o.detune.value = detune;
    o.frequency.setValueAtTime(f0 * 0.85, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.25, t + 0.025); // yelp up
    o.frequency.exponentialRampToValueAtTime(f0 * 0.62, t + len); // and drop
    o.connect(trem);
    o.start(t); o.stop(t + len + 0.05);
  }
  // breath: noise through the same throat, strongest at the onset
  const breath = env(a, t, 0.5, 0.003, len * 0.6);
  noise(a, t, len).connect(breath);
  formants.forEach((bp) => breath.connect(bp));
}

export const SFX = {
  /** "¡Guau, guau!" — two barks, a little different every time. */
  woof() {
    const a = audio();
    if (!a) return;
    const f0 = 300 + Math.random() * 90;
    bark(a, a.currentTime + 0.01, f0);
    bark(a, a.currentTime + 0.27 + Math.random() * 0.06, f0 * (0.9 + Math.random() * 0.08));
  },
  laser,
  boom,
  pickup: () => blip([880, 1320], { step: 0.05 }),
  crash: () => blip([220, 160, 110, 70], { type: 'sawtooth', step: 0.09, gain: 0.06 }),
  achievement: () => blip([523, 659, 784, 1047], { step: 0.08, gain: 0.06 }),
};
