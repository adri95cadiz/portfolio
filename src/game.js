// SIGNAL RUN — a rhythm runner: the ATH-16 plays DnB and the tunnel, spawns and visuals move on its beat.
import { SFX, blip } from './sfx.js';
import { t } from './i18n.js';
import { render, W, H, DRONE_X, C, setDims } from './game-render.js';

const NARROW_PX = 700; // below this canvas width the playfield turns portrait-ish
const WIDE_DIMS = [960, 400];
const NARROW_DIMS = [640, 720];

const R = 13;
const GRAVITY = 980;
const THRUST = -1750;
const MAX_VY = 440;
const BEST_KEY = 'ap-signal-run-best';
const TECH = ['TS', 'Angular', 'Next', 'Three', 'Python', 'Node', 'SQL', 'IA', 'GSAP', 'ROS', 'Unity', 'WebGL', 'Docker', 'LLM'];
const ZONES = [
  { name: 'Origen', color: '#9be7c4' }, { name: 'Oficio', color: '#ffb23e' }, { name: 'Laboratorio', color: '#c79bff' },
  { name: 'Athetosis', color: '#ff2e63' }, { name: 'Producción', color: '#ff5b1f' },
];
const ZONE_LENGTH = 2600; // distance units per zone
const GAME_PRESET = 'dnb';
const FALLBACK_BPM = 174;
const COMBO_STEP = 5; // every 5 orbs in a row adds ×1
const NEAR_MISS = 9;
const MAX_PARTICLES = 320;

const readBest = () => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } };
const writeBest = (n) => { try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* ignore */ } };

/**
 * @param {HTMLElement} root  .game container
 * @param {{ music?: { playPreset(n:string):void, stop():void, isPlaying():boolean, bpm():number },
 *           onGameOver?: (score:number) => void }} hooks
 */
export function mountGame(root, { music, onGameOver } = {}) {
  const canvas = root.querySelector('.game__canvas');
  const startBtn = root.querySelector('.game__start');
  const cta = root.querySelector('.game__cta');
  const musicBtn = root.querySelector('.game__music');
  const live = root.querySelector('.game__live');
  const g = canvas.getContext('2d');

  let s;
  let best = readBest();
  let thrust = false;
  let raf = 0; let last = 0; let visible = false;
  let musicOn = true;
  let startedMusic = false;
  let lastExternalBeat = -1;
  let clock = 0; // internal step clock when no music drives the beat

  const zoneAt = (dist) => Math.floor(dist / ZONE_LENGTH);
  function reset(mode = 'idle') {
    s = {
      mode, y: H / 2, vy: 0, t: 0, dist: 0, score: 0, orbs: 0, combo: 0, bestCombo: 0, mult: 1,
      items: [], particles: [], popups: [], shield: 0, shake: 0, flash: 0, beat: 0, step: 0,
      zoneIndex: 0, zone: ZONES[0], banner: 0, nearT: 0, dyingT: 0, newBest: false, bpm: FALLBACK_BPM,
    };
  }
  reset();

  const squeeze = () => Math.min(s.dist / 120, 90);
  const wave = (x, ph) => Math.sin((x + s.dist) * 0.011 + ph) * (24 + s.beat * 8) + Math.sin((x + s.dist) * 0.031 + ph * 2) * 11;
  const top = (x) => 40 + wave(x, 0) + squeeze() / 2;
  const bottom = (x) => H - 40 + wave(x, 1.7) - squeeze() / 2;

  function burst(x, y, color, n, speed = 260) {
    for (let i = 0; i < n && s.particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random());
      s.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, max: 0.9, size: 2 + Math.random() * 3, color });
    }
  }
  const popup = (text, x, y, color = C.bone, size = 14) => s.popups.push({ text, x, y, color, size, life: 0.9 });

  const MIN_GAP = 110; // px between spawns, so a burst of late beats can't stack items
  function spawn(kind) {
    const x = W + 30;
    if (s.items.some((it) => it.x > x - MIN_GAP)) return;
    const y = top(x) + 34 + Math.random() * Math.max(10, bottom(x) - top(x) - 68);
    s.items.push({ kind, x, y, y0: y, ph: Math.random() * 6, label: TECH[Math.floor(Math.random() * TECH.length)] });
  }

  /** One 16th-note step: drives spawns so pickups and bugs land on the groove. */
  function onStep(step) {
    s.step = step;
    if (step % 4 === 0) s.beat = 1;
    if (s.mode !== 'play') return;
    const level = s.zoneIndex;
    if (step % 4 === 2 && Math.random() < 0.55) spawn('orb');
    if ((step === 4 || step === 12) && Math.random() < 0.45 + level * 0.1) spawn('bug');
    if (step === 0 && Math.random() < 0.05 && !s.shield) spawn('shield');
  }

  function collect(it) {
    if (it.kind === 'shield') {
      s.shield = 1;
      popup('HOTFIX', it.x, it.y - 10, C.mint, 16);
      burst(it.x, it.y, C.mint, 24);
      blip([660, 990], { step: 0.05 });
      return;
    }
    s.combo += 1;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    s.mult = 1 + Math.floor(s.combo / COMBO_STEP);
    s.orbs += 1;
    const pts = 10 * s.mult;
    s.score += pts;
    popup(`+${pts} ${it.label}`, it.x, it.y - 14, s.zone.color);
    burst(it.x, it.y, s.zone.color, 16, 200);
    SFX.pickup();
    if (s.combo > 0 && s.combo % COMBO_STEP === 0) { popup(`COMBO ×${s.mult}`, DRONE_X + 60, s.y - 34, C.mint, 18); blip([880, 1175, 1568], { step: 0.05 }); }
  }

  function hit(it) {
    if (s.shield) {
      s.shield = 0;
      s.flash = 0.6;
      burst(it.x, it.y, C.mint, 30);
      popup(t('game.saved'), DRONE_X, s.y - 30, C.mint, 16);
      return;
    }
    crash();
  }

  function crash() {
    if (s.mode !== 'play') return;
    s.mode = 'dying';
    s.dyingT = 0.9;
    s.shake = 1;
    s.flash = 1;
    burst(DRONE_X, s.y, C.bone, 40, 380);
    burst(DRONE_X, s.y, s.zone.color, 40, 300);
    SFX.crash();
    thrust = false;
  }

  function gameOver() {
    s.mode = 'over';
    if (s.score > best) { best = s.score; s.newBest = true; writeBest(best); }
    live.textContent = t('game.over', { score: s.score, orbs: s.orbs, combo: s.bestCombo, best });
    startBtn.textContent = t('game.retry');
    startBtn.hidden = false;
    cta.hidden = false;
    if (startedMusic) { music?.stop(); startedMusic = false; }
    onGameOver?.(s.score);
  }

  function updateWorld(dt) {
    const speed = (270 + Math.min(s.t * 7, 260)) * (W / WIDE_DIMS[0]); // same crossing time on any playfield
    s.dist += speed * dt;
    s.score += Math.floor((s.dist % 40) < speed * dt ? 1 : 0);
    s.vy = Math.max(-MAX_VY, Math.min(MAX_VY, s.vy + (thrust ? THRUST : GRAVITY) * dt));
    s.y += s.vy * dt;
    if (thrust && Math.random() < 0.8) {
      s.particles.push({ x: DRONE_X - 8 + Math.random() * 16, y: s.y + 8, vx: -speed * 0.3, vy: 120 + Math.random() * 80, life: 0.3, max: 0.3, size: 2, color: s.zone.color });
    }
    s.particles.push({ x: DRONE_X - 18, y: s.y, vx: -speed, vy: 0, life: 0.35, max: 0.35, size: 3, color: s.zone.color });

    const z = zoneAt(s.dist);
    if (z !== s.zoneIndex) { s.zoneIndex = z; s.zone = ZONES[z % ZONES.length]; s.banner = 1.6; blip([523, 784, 1047], { step: 0.09 }); }

    for (const it of s.items) {
      it.x -= speed * dt;
      if (it.kind === 'bug') it.y = it.y0 + Math.sin(s.t * 3 + it.ph) * 28;
    }
    s.items = s.items.filter((it) => {
      if (Math.hypot(it.x - DRONE_X, it.y - s.y) < R + 13) {
        if (it.kind === 'bug') { hit(it); return false; }
        collect(it);
        return false;
      }
      if (it.x < DRONE_X - 40 && it.kind === 'orb' && !it.missed) { it.missed = true; s.combo = 0; s.mult = 1; }
      return it.x > -40;
    });

    const gapTop = s.y - R - top(DRONE_X);
    const gapBottom = bottom(DRONE_X) - (s.y + R);
    if (gapTop < 0 || gapBottom < 0) { if (s.shield) { s.shield = 0; s.vy = gapTop < 0 ? 200 : -200; s.flash = 0.5; } else crash(); }
    s.nearT -= dt;
    if (s.mode === 'play' && Math.min(gapTop, gapBottom) < NEAR_MISS && s.nearT <= 0) {
      s.nearT = 0.6; s.score += 5; popup(t('game.near'), DRONE_X + 40, s.y + (gapTop < gapBottom ? 30 : -24), C.bone, 13);
    }
  }

  function update(dt) {
    s.t += dt;
    s.beat *= Math.exp(-dt * 7);
    s.shake *= Math.exp(-dt * 6);
    s.flash *= Math.exp(-dt * 5);
    s.banner = Math.max(0, s.banner - dt);
    // internal clock keeps the groove going when the drum machine is not driving the beat
    if (performance.now() - lastExternalBeat > 400) {
      clock += dt * (FALLBACK_BPM / 60) * 4;
      if (clock >= 1) { clock -= 1; onStep((s.step + 1) % 16); }
    }
    if (s.mode === 'play') updateWorld(dt);
    if (s.mode === 'dying' && (s.dyingT -= dt) <= 0) gameOver();
    for (const p of s.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; }
    s.particles = s.particles.filter((p) => p.life > 0);
    for (const p of s.popups) { p.y -= 40 * dt; p.life -= dt; }
    s.popups = s.popups.filter((p) => p.life > 0);
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio, 2);
    const w = canvas.clientWidth;
    const [dw, dh] = w < NARROW_PX ? NARROW_DIMS : WIDE_DIMS;
    if (dw !== W) {
      setDims(dw, dh);
      canvas.style.aspectRatio = `${dw} / ${dh}`;
      if (s.mode !== 'play') reset(s.mode === 'over' ? 'idle' : s.mode);
    }
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round((w * H / W) * dpr);
    g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    render(g, s, { top, bottom, best, musicOn });
  }

  function frame(ts) {
    raf = 0;
    const dt = Math.min(Math.max((ts - last) / 1000, 0), 0.033); // rAF ts can precede performance.now() on the first frame
    last = ts;
    update(dt);
    render(g, s, { top, bottom, best, musicOn });
    loop();
  }
  const loop = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };

  function start() {
    reset('play');
    startBtn.hidden = true;
    cta.hidden = true;
    live.textContent = t('game.running');
    canvas.focus({ preventScroll: true });
    if (musicOn && music && !music.isPlaying()) { music.playPreset(GAME_PRESET); startedMusic = true; }
    s.bpm = music?.isPlaying() ? music.bpm() : FALLBACK_BPM;
    s.banner = 1.4;
    loop();
  }

  const isFlyKey = (e) => e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW';
  startBtn.addEventListener('click', start);
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); if (s.mode === 'idle' || s.mode === 'over') start(); thrust = true; });
  window.addEventListener('pointerup', () => { thrust = false; });
  canvas.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') { musicBtn.click(); return; }
    if (!isFlyKey(e)) return;
    e.preventDefault();
    if ((s.mode === 'idle' || s.mode === 'over') && !e.repeat) start();
    thrust = true;
  });
  canvas.addEventListener('keyup', (e) => { if (isFlyKey(e)) thrust = false; });
  canvas.addEventListener('blur', () => { thrust = false; });
  musicBtn.addEventListener('click', () => {
    musicOn = !musicOn;
    musicBtn.setAttribute('aria-pressed', String(musicOn));
    musicBtn.querySelector('span').textContent = musicOn ? t('game.musicOn') : t('game.musicOff');
    if (!musicOn && startedMusic) { music?.stop(); startedMusic = false; }
    if (musicOn && s.mode === 'play' && music && !music.isPlaying()) { music.playPreset(GAME_PRESET); startedMusic = true; s.bpm = music.bpm(); }
  });

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) loop(); else thrust = false;
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (document.hidden) thrust = false; else loop(); });
  window.addEventListener('resize', resize);
  document.fonts?.ready.then(resize);
  resize();

  return {
    /** Beat from the drum machine (16th-note step index). */
    step(i) {
      if (i < 0) return;
      lastExternalBeat = performance.now();
      onStep(i);
    },
  };
}
