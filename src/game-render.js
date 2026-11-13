import { t } from './i18n.js';
// SIGNAL RUN — drawing. Pure functions of the game state; no game logic lives here.
// playfield size in game units; live bindings, switched by setDims() for narrow screens
export let W = 960;
export let H = 400;
export let DRONE_X = 200;
export function setDims(w, h) { W = w; H = h; DRONE_X = Math.round(w * 0.21); }
export const C = { ink: '#0c0d10', ink2: '#121419', bone: '#ece6da', dim: '#6f6a61', bug: '#ff4d6d', mint: '#9be7c4', pink: '#ff2e63' };
const BARS = 48;

const zoneName = (s) => t(`zone.${s.zone.name}`);
const font = (w, px, fam = '"Anybody Variable", sans-serif') => `${w} ${px}px ${fam}`;
const MONO = '"Martian Mono Variable", monospace';

function text(g, str, x, y, { size = 16, weight = 700, color = C.bone, align = 'center', fam, alpha = 1 } = {}) {
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.textAlign = align;
  g.font = font(weight, size, fam);
  g.fillText(str, x, y);
  g.globalAlpha = 1;
}

/** Chromatic title, like the logo: mint/pink ghosts behind a bone face. */
function glitchText(g, str, x, y, size, jitter) {
  const j = jitter * 6;
  text(g, str, x - 4 - j, y - 2, { size, color: C.mint, alpha: 0.85 });
  text(g, str, x + 4 + j, y + 2, { size, color: C.pink, alpha: 0.85 });
  text(g, str, x, y, { size });
}

function background(g, s) {
  g.fillStyle = C.ink;
  g.fillRect(0, 0, W, H);
  // far graticule, scrolls slowly
  g.strokeStyle = 'rgba(236,230,218,0.045)';
  g.lineWidth = 1;
  const off = (s.dist * 0.25) % 48;
  for (let x = -off; x < W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 50) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  // spectrum analyser bars that breathe with the beat
  const bw = W / BARS;
  g.fillStyle = s.zone.color;
  for (let i = 0; i < BARS; i++) {
    const n = Math.sin(i * 1.7 + s.t * 2) * 0.5 + Math.sin(i * 0.37 - s.t * 3.1) * 0.5;
    const h = (0.25 + Math.abs(n) * 0.5 + s.beat * 0.6 * ((i + s.step) % 4 === 0 ? 1 : 0.35)) * 90;
    g.globalAlpha = 0.07 + s.beat * 0.08;
    g.fillRect(i * bw + 2, H / 2 - h / 2, bw - 4, h);
  }
  g.globalAlpha = 1;
}

function walls(g, s, top, bottom) {
  const edge = (fn) => { g.beginPath(); for (let x = 0; x <= W; x += 8) g.lineTo(x, fn(x)); };
  for (const [fn, end] of [[top, 0], [bottom, H]]) {
    edge(fn); g.lineTo(W, end); g.lineTo(0, end); g.closePath();
    g.fillStyle = C.ink2; g.fill();
  }
  // chromatic ghosts kick in on the beat
  const ghost = 2 + s.beat * 5;
  g.lineWidth = 3;
  for (const [fn] of [[top], [bottom]]) {
    g.globalAlpha = 0.6;
    g.strokeStyle = C.mint; g.save(); g.translate(-ghost, -1); edge(fn); g.stroke(); g.restore();
    g.strokeStyle = C.pink; g.save(); g.translate(ghost, 1); edge(fn); g.stroke(); g.restore();
    g.globalAlpha = 1;
    g.strokeStyle = s.zone.color;
    g.shadowColor = s.zone.color; g.shadowBlur = 14 + s.beat * 16;
    edge(fn); g.stroke();
    g.shadowBlur = 0;
  }
}

function drone(g, s) {
  if (s.mode === 'dying' || s.mode === 'over') return;
  const tilt = Math.max(-0.4, Math.min(0.4, s.vy / 900));
  g.save();
  g.translate(DRONE_X, s.y);
  g.rotate(tilt);
  if (s.shield > 0) {
    g.strokeStyle = C.mint; g.lineWidth = 2; g.globalAlpha = 0.6 + Math.sin(s.t * 12) * 0.3;
    g.beginPath(); g.arc(0, 0, 26, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
  }
  g.shadowColor = s.zone.color; g.shadowBlur = 18;
  g.fillStyle = C.bone;
  g.fillRect(-15, -5, 30, 10);
  g.fillRect(-24, -9, 48, 3);
  g.shadowBlur = 0;
  const spin = Math.abs(Math.sin(s.t * 45)) * 12 + 4;
  g.fillStyle = s.zone.color;
  g.fillRect(-24 - spin / 2, -14, spin, 3);
  g.fillRect(24 - spin / 2, -14, spin, 3);
  g.fillStyle = C.pink; g.fillRect(9, -2, 4, 4); // tail light
  g.restore();
}

function items(g, s) {
  for (const it of s.items) {
    if (it.kind === 'orb') {
      const r = 10 + s.beat * 3;
      g.strokeStyle = s.zone.color; g.lineWidth = 2.5;
      g.shadowColor = s.zone.color; g.shadowBlur = 12;
      g.beginPath(); g.arc(it.x, it.y, r, 0, Math.PI * 2); g.stroke();
      g.shadowBlur = 0;
      text(g, it.label, it.x, it.y - 20, { size: 12, weight: 500, fam: MONO });
    } else if (it.kind === 'shield') {
      g.strokeStyle = C.mint; g.lineWidth = 2.5;
      g.beginPath();
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + s.t; g.lineTo(it.x + Math.cos(a) * 13, it.y + Math.sin(a) * 13); }
      g.closePath(); g.stroke();
      text(g, 'HOTFIX', it.x, it.y - 22, { size: 11, weight: 500, color: C.mint, fam: MONO });
    } else {
      g.strokeStyle = C.bug; g.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        const wig = Math.sin(s.t * 20 + i + it.ph) * 3;
        g.beginPath(); g.moveTo(it.x - 15, it.y + i * 6 + wig); g.lineTo(it.x + 15, it.y + i * 6 - wig); g.stroke();
      }
      g.fillStyle = C.bug; g.beginPath(); g.ellipse(it.x, it.y, 9, 12, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.ink; g.fillRect(it.x - 5, it.y - 6, 3, 3); g.fillRect(it.x + 2, it.y - 6, 3, 3);
    }
  }
}

function particles(g, s) {
  for (const p of s.particles) {
    g.globalAlpha = Math.max(0, p.life / p.max);
    g.fillStyle = p.color;
    g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  g.globalAlpha = 1;
  for (const p of s.popups) {
    text(g, p.text, p.x, p.y, { size: p.size, color: p.color, alpha: Math.min(1, p.life * 2), fam: MONO, weight: 500 });
  }
}

function hud(g, s, best, musicOn) {
  text(g, String(s.score), 24, 42, { size: 30, align: 'left' });
  if (s.mult > 1) text(g, `×${s.mult}`, 24, 66, { size: 15, align: 'left', color: s.zone.color, fam: MONO, weight: 500 });
  text(g, `${t('game.best')} ${best}`, W - 24, 34, { size: 12, weight: 500, align: 'right', color: C.dim, fam: MONO });
  text(g, `${zoneName(s).toUpperCase()} · ${musicOn ? `${s.bpm} BPM` : t('game.noMusic')}`, W - 24, 52, { size: 12, weight: 500, align: 'right', color: s.zone.color, fam: MONO });
  if (s.banner > 0) {
    const a = Math.min(1, s.banner * 2);
    text(g, `${t('game.zone')} ${s.zoneIndex + 1}`, W / 2, H / 2 - 30, { size: 13, weight: 500, color: s.zone.color, alpha: a, fam: MONO });
    text(g, zoneName(s).toUpperCase(), W / 2, H / 2 + 8, { size: 40, alpha: a });
  }
}

function screens(g, s, best) {
  if (s.mode === 'idle') {
    g.fillStyle = 'rgba(12,13,16,0.55)'; g.fillRect(0, 0, W, H);
    glitchText(g, 'SIGNAL RUN', W / 2, H / 2 - 30, 68, s.beat);
    // on the narrow playfield the hint wraps one instruction per line
    const hints = W < 800 ? t('game.hint').split(' · ') : [t('game.hint')];
    hints.forEach((line, i) => text(g, line, W / 2, H / 2 + 12 + i * 24, { size: 15, weight: 500, color: C.dim, fam: MONO }));
    if (Math.sin(s.t * 5) > 0) text(g, t('game.press'), W / 2, H / 2 + 36 + hints.length * 24, { size: 14, weight: 500, color: C.mint, fam: MONO });
  }
  if (s.mode === 'over') {
    g.fillStyle = 'rgba(12,13,16,0.72)'; g.fillRect(0, 0, W, H);
    glitchText(g, t('game.lost'), W / 2, 110, 52, 0.4);
    const rows = [[t('game.points'), s.score], [t('game.techs'), s.orbs], [t('game.combo'), `×${s.bestCombo}`], [t('game.zone'), zoneName(s)]];
    const narrow = W < 800; // 2×2 stats on the portrait playfield
    rows.forEach(([k, v], i) => {
      const x = narrow ? W / 2 + (i % 2 ? 130 : -130) : W / 2 - 270 + i * 180;
      const y = narrow ? 200 + Math.floor(i / 2) * 90 : 165;
      text(g, k, x, y, { size: 11, weight: 500, color: C.dim, fam: MONO });
      text(g, String(v), x, y + 33, { size: 26 });
    });
    const by = narrow ? 420 : 238;
    if (s.newBest) text(g, t('game.newBest'), W / 2, by, { size: 14, weight: 500, color: C.mint, fam: MONO, alpha: Math.sin(s.t * 8) > 0 ? 1 : 0.4 });
    else text(g, `${t('game.best')} ${best}`, W / 2, by, { size: 12, weight: 500, color: C.dim, fam: MONO });
  }
}

export function render(g, s, { top, bottom, best, musicOn }) {
  g.save();
  if (s.shake > 0) g.translate((Math.random() - 0.5) * s.shake * 22, (Math.random() - 0.5) * s.shake * 22);
  background(g, s);
  walls(g, s, top, bottom);
  items(g, s);
  particles(g, s);
  drone(g, s);
  g.restore();
  if (s.flash > 0) { g.fillStyle = `rgba(255,77,109,${s.flash * 0.35})`; g.fillRect(0, 0, W, H); }
  hud(g, s, best, musicOn);
  screens(g, s, best);
}
