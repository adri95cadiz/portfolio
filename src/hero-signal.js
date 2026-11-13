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
const STEP = 4; // px between wave samples

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
  const logo = new Path2D(document.querySelector('.logo .l-main').getAttribute('d'));

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

  /** Lead-in (left) and tail (right) as polylines; the middle is the logo itself. */
  function wavePath(from, to, y0, side) {
    const p = new Path2D();
    const span = Math.abs(to - from) || 1;
    const base = 3 * geo.s * (1 + audio * 4);
    for (let x = from; side > 0 ? x <= to : x >= to; x += STEP * side) {
      const d = Math.abs(x - from) / span; // 0 at the logo, 1 at the screen edge
      const env = side > 0 ? Math.min(1, d * 6) : Math.min(1, d * 3);
      const amp = (side > 0 ? 9 * geo.s : base) * (1 + audio * 3) + bump(x) * 46 + pluck * 70 * Math.exp(-d * 2);
      const k = side > 0 ? 0.018 / geo.s * 2 : 0.05;
      const y = y0 + env * (side > 0
        ? Math.sin(Math.abs(x - from) * k - t * 4) * amp
        : (Math.sin(x * k + t * 6) * 0.6 + Math.sin(x * 0.013 - t * 2.3) * 0.4) * amp);
      if (x === from) p.moveTo(x, y); else p.lineTo(x, y);
    }
    return p;
  }

  function stroke(paths, color, dx, dy, widthPx) {
    g.save();
    g.translate(dx, dy);
    g.strokeStyle = color;
    g.lineWidth = widthPx;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const p of paths) g.stroke(p);
    g.save();
    g.translate(geo.ox, geo.oy);
    g.scale(geo.s, geo.s);
    g.lineWidth = STROKE * WEIGHT;
    g.stroke(logo);
    g.restore();
    g.restore();
  }

  function draw() {
    g.clearRect(0, 0, geo.w, geo.h);
    if (state.reveal <= 0) return;
    const sweep = state.reveal * (geo.w + 40);
    g.save();
    g.beginPath(); g.rect(0, 0, sweep, geo.h); g.clip();

    const lead = wavePath(toX(LOGO_UNITS.x0), 0, toY(LOGO_UNITS.base), -1);
    const tail = wavePath(toX(LOGO_UNITS.x1), geo.w + 10, toY(LOGO_UNITS.tailY), 1);
    const px = STROKE * WEIGHT * geo.s;
    for (const [dx, dy, c] of GHOST) stroke([lead, tail], c, dx * geo.s, dy * geo.s, px);
    const grad = g.createLinearGradient(0, 0, geo.w, 0);
    const gx0 = toX(LOGO_UNITS.x0) / geo.w;
    const gx1 = toX(LOGO_UNITS.x1) / geo.w;
    for (const [o, c] of GRADIENT) grad.addColorStop(Math.min(1, gx0 + o * (gx1 - gx0)), c);
    stroke([lead, tail], grad, 0, 0, px);
    g.restore();

    if (state.reveal < 1) { // phosphor beam at the sweep head
      g.fillStyle = '#ece6da';
      g.shadowColor = '#ff5b1f';
      g.shadowBlur = 24;
      g.beginPath(); g.arc(sweep, toY(LOGO_UNITS.base), px * 0.55, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
    }
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
