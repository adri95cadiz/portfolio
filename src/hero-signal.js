// The hero's live oscilloscope trace: a signal enters from the left edge, writes the AP logo
// as the last "word" of the headline, and leaves to the right as a never-ending sine wave.
import { blip } from './sfx.js';

const LOGO_UNITS = { x0: 8, x1: 190, top: 46, bottom: 208, base: 152, tailY: 176 }; // logo.svg geometry
const STROKE = 22;
const WEIGHT = 0.78; // thinner than the nav mark: at hero scale the full weight reads as a marker pen
const GHOST = [[-7, -3, '#9be7c4'], [7, 3, '#ff2e63']];
const GRADIENT = [[0, '#ff5b1f'], [0.55, '#ff2e63'], [1, '#c79bff']];
const MAX_DPR = 2;
const PLUCK_DECAY = 2.4;
const STEP = 5; // px between wave samples
const LOGO_SAMPLES = 260;
const BEAM_PERIOD = 3.2; // seconds for the light beam to run the whole signal
const BEAM_LEN = 0.016; // fraction of the trace lit by the beam

/** Samples the logo path into points (logo units) by arc length, so it can be drawn progressively. */
function sampleLogo(d) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  document.body.append(svg); // some engines only measure attached paths
  const total = path.getTotalLength();
  const pts = Array.from({ length: LOGO_SAMPLES + 1 }, (_, i) => {
    const p = path.getPointAtLength((total * i) / LOGO_SAMPLES);
    return [p.x, p.y];
  });
  svg.remove();
  return pts;
}

/**
 * @param {HTMLElement} hero section element
 * @param {{ reduceMotion: boolean }} opts
 */
export function mountHeroSignal(hero, { reduceMotion }) {
  const canvas = hero.querySelector('.hero__signal');
  const anchor = hero.querySelector('[data-signal-anchor]');
  const title = hero.querySelector('.hero__title');
  const freqOut = hero.querySelector('[data-readout="freq"]');
  const ampOut = hero.querySelector('[data-readout="amp"]');
  const g = canvas.getContext('2d');
  const logoPts = sampleLogo(document.querySelector('.logo .l-main').getAttribute('d'));

  const state = { reveal: reduceMotion ? 1 : 0 };
  const geo = { w: 0, h: 0, s: 1, ox: 0, oy: 0 };
  const ptr = { x: -9999, y: 0, energy: 0 };
  let pluck = 0;
  let audio = 0;
  let t = 0;
  let raf = 0;
  let last = 0;
  let visible = true;

  // where the logo sits: right after the last line of the headline, or under it when there's no room
  function layout() {
    const dpr = Math.min(devicePixelRatio, MAX_DPR);
    const hr = hero.getBoundingClientRect();
    geo.w = hr.width; geo.h = hr.height;
    canvas.width = Math.round(geo.w * dpr);
    canvas.height = Math.round(geo.h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const line = anchor.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(title).fontSize);
    const logoH = LOGO_UNITS.bottom - LOGO_UNITS.top;
    // the flat signal runs just under the last line; the A spikes up beside the last word
    let s = (fs * 1.15) / logoH;
    let ox = line.right - hr.left + fs * 0.22 - LOGO_UNITS.x0 * s;
    let oy = line.bottom - hr.top + fs * 0.1 - LOGO_UNITS.base * s;
    if (ox + LOGO_UNITS.x1 * s > geo.w - 24) { // not enough room: centre it in the space reserved under the title
      s = Math.min(geo.w * 0.42, 260) / (LOGO_UNITS.x1 - LOGO_UNITS.x0);
      ox = (geo.w - (LOGO_UNITS.x1 - LOGO_UNITS.x0) * s) / 2 - LOGO_UNITS.x0 * s;
      oy = title.getBoundingClientRect().bottom - hr.top + 24 - LOGO_UNITS.top * s;
    }
    Object.assign(geo, { s, ox, oy });
    if (!raf) draw();
  }

  const toX = (u) => geo.ox + u * geo.s;
  const toY = (u) => geo.oy + u * geo.s;
  const bump = (x) => ptr.energy * Math.exp(-(((x - ptr.x) / 140) ** 2));

  // One continuous trace, left to right: wavy lead-in -> the AP mark -> sine tail. Built as points with
  // cumulative length so it can be drawn *along* its path (like a pen) and a beam can run over it.
  const xs = []; const ys = []; const cum = [];
  function buildTrace() {
    xs.length = 0; ys.length = 0; cum.length = 0;
    const lx0 = toX(LOGO_UNITS.x0);
    const base = toY(LOGO_UNITS.base);
    for (let x = 0; x < lx0; x += STEP) {
      const d = 1 - x / lx0; // 1 at the screen edge, 0 at the logo
      const env = Math.min(1, d * 3);
      const amp = 3 * geo.s * (1 + audio * 4) * (1 + audio * 3) + bump(x) * 46 + pluck * 70 * Math.exp(-d * 2);
      xs.push(x);
      ys.push(base + env * (Math.sin(x * 0.05 + t * 6) * 0.6 + Math.sin(x * 0.013 - t * 2.3) * 0.4) * amp);
    }
    for (const [ux, uy] of logoPts) { xs.push(toX(ux)); ys.push(toY(uy)); }
    const tx0 = toX(LOGO_UNITS.x1);
    const ty0 = toY(LOGO_UNITS.tailY);
    const span = geo.w + 10 - tx0 || 1;
    for (let x = tx0 + STEP; x <= geo.w + 10; x += STEP) {
      const d = (x - tx0) / span;
      const amp = 9 * geo.s * (1 + audio * 3) + bump(x) * 46 + pluck * 70 * Math.exp(-d * 2);
      xs.push(x);
      ys.push(ty0 + Math.min(1, d * 6) * Math.sin((x - tx0) * (0.036 / geo.s) - t * 4) * amp);
    }
    let len = 0;
    for (let i = 0; i < xs.length; i++) {
      if (i) len += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
      cum.push(len);
    }
  }

  /** Index of the last point at or before length `l` (binary search). */
  function indexAt(l) {
    let lo = 0; let hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid] <= l) lo = mid; else hi = mid - 1; }
    return lo;
  }
  function pointAt(l) {
    const i = Math.min(indexAt(l), cum.length - 2);
    const f = (l - cum[i]) / ((cum[i + 1] - cum[i]) || 1);
    return [xs[i] + (xs[i + 1] - xs[i]) * f, ys[i] + (ys[i + 1] - ys[i]) * f];
  }
  /** The part of the trace between lengths a and b. */
  function segment(a, b) {
    const p = new Path2D();
    const [sx, sy] = pointAt(a);
    p.moveTo(sx, sy);
    for (let i = indexAt(a) + 1; i < cum.length && cum[i] < b; i++) p.lineTo(xs[i], ys[i]);
    const [ex, ey] = pointAt(b);
    p.lineTo(ex, ey);
    return p;
  }

  function stroke(path, color, dx, dy, width) {
    g.save();
    g.translate(dx, dy);
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.stroke(path);
    g.restore();
  }

  function draw() {
    g.clearRect(0, 0, geo.w, geo.h);
    if (state.reveal <= 0 || !logoPts.length) return;
    buildTrace();
    const total = cum[cum.length - 1];
    const upTo = Math.min(total, state.reveal * total);
    const path = segment(0, upTo);
    const px = STROKE * WEIGHT * geo.s;
    for (const [dx, dy, c] of GHOST) stroke(path, c, dx * geo.s, dy * geo.s, px);
    const grad = g.createLinearGradient(0, 0, geo.w, 0);
    const gx0 = toX(LOGO_UNITS.x0) / geo.w;
    const gx1 = toX(LOGO_UNITS.x1) / geo.w;
    for (const [o, c] of GRADIENT) grad.addColorStop(Math.min(1, Math.max(0, gx0 + o * (gx1 - gx0))), c);
    stroke(path, grad, 0, 0, px);

    g.shadowColor = '#ff2e63';
    g.shadowBlur = 18;
    if (state.reveal < 1) { // the pen tip while drawing
      const [hx, hy] = pointAt(upTo);
      g.fillStyle = '#ece6da';
      g.beginPath(); g.arc(hx, hy, px * 0.45, 0, Math.PI * 2); g.fill();
    } else if (!reduceMotion) { // a beam that keeps running along the signal
      const a = ((t % BEAM_PERIOD) / BEAM_PERIOD) * total;
      stroke(segment(a, Math.min(total, a + total * BEAM_LEN)), '#ece6da', 0, 0, px * 0.42);
    }
    g.shadowBlur = 0;
  }

  function frame(ts) {
    raf = 0;
    const dt = Math.min(Math.max((ts - last) / 1000, 0), 0.05);
    last = ts;
    t += dt;
    pluck *= Math.exp(-dt * PLUCK_DECAY);
    ptr.energy *= Math.exp(-dt * 1.6);
    draw();
    if (freqOut) freqOut.textContent = `${(220 + (1 - ptr.y / (geo.h || 1)) * 660).toFixed(1)} Hz`;
    if (ampOut) ampOut.textContent = `${(9 + audio * 30 + ptr.energy * 46 + pluck * 70).toFixed(0)} mV`;
    loop();
  }
  const loop = () => { if (!raf && visible && !document.hidden && !reduceMotion) raf = requestAnimationFrame(frame); };

  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    const nx = e.clientX - r.left;
    ptr.energy = Math.min(1, ptr.energy + Math.abs(nx - ptr.x) / 400);
    ptr.x = nx; ptr.y = e.clientY - r.top;
  }, { passive: true });
  hero.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button')) return;
    pluck = 1;
    const hz = 220 + (1 - (e.clientY - hero.getBoundingClientRect().top) / geo.h) * 440;
    blip([hz, hz * 1.5, hz * 2], { type: 'triangle', step: 0.06, gain: 0.07 });
  });

  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) { last = performance.now(); loop(); } }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); loop(); } });
  window.addEventListener('resize', layout);
  document.fonts?.ready.then(layout);
  layout();
  last = performance.now();
  loop();

  return {
    state, // GSAP tweens state.reveal for the intro sweep
    setAudio(level) { audio = level; },
    redraw: draw,
  };
}
