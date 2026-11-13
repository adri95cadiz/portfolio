// Self-hosted fonts and icons: no requests to Google Fonts or the Iconify API (privacy + speed).
import '@fontsource-variable/anybody/wdth.css';
import '@fontsource-variable/anybody/wdth-italic.css';
import '@fontsource-variable/martian-mono/wdth.css';
import { addCollection } from 'iconify-icon';
import icons from './icons.json';
// Vercel Web Analytics + Speed Insights: cookieless, aggregated, served from this same origin (/_vercel/...)
import { inject as injectAnalytics } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { gsap, ScrollTrigger, splitWords, startSmoothScroll, heroIntro, chapterReveals, trackChapters } from './motion.js';
import { mountMachine } from './machine-ui.js';
import { mountGame } from './game.js';
import { initContact } from './contact.js';
import { createAchievements } from './achievements.js';
import './audio.js'; // registers the mobile audio unlock on the first tap/click/key
import { SFX } from './sfx.js';
import { mountHeroSignal } from './hero-signal.js';
import { t, initLangSwitch } from './i18n.js';
import { initCursor } from './cursor.js';
import { initLcd } from './lcd.js';

icons.forEach((collection) => addCollection(collection));

const PILOT_SCORE = 100;
const DEMOLITION_BREAKS = 5;
const SCENE_IDLE_TIMEOUT = 2600; // ms: start the 3D world by then even if the main thread stays busy
// clicks on these never shoot: controls, panels with their own interactions, and the hero (it plucks the signal)
const NO_SHOOT = 'a, button, input, textarea, select, label, summary, iframe, [role="button"], .game, .machine, .form, .nav, dialog, .tuner, .spotify';
const STEPS_FOR_PRODUCER = 6;
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
let scene = null;
let ach = null;
let heroSignal = null;
let machine = null;
let game = null;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

async function initScene() {
  if (reduceMotion || !hasWebGL()) return; // CSS poster stays in place
  try {
    const { createScene } = await import('./scene.js');
    const canvas = document.querySelector('.stage__canvas');
    scene = createScene(canvas, { onContextLost: () => root.classList.remove('is-webgl') });
    root.classList.add('is-webgl');
  } catch (err) {
    console.error('[scene] WebGL init failed, using static poster', err);
    root.classList.remove('is-webgl');
    return;
  }

  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => scene.setProgress(self.progress) });

  const placeStations = () => {
    const max = ScrollTrigger.maxScroll(window) || 1;
    scene.placeStations([...document.querySelectorAll('[data-station]')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        progress: (r.top + window.scrollY + r.height / 2 - innerHeight / 2) / max,
        color: el.dataset.accent,
        kind: el.dataset.kind,
        side: Number(el.dataset.station),
      };
    }));
  };
  ScrollTrigger.addEventListener('refresh', placeStations);
  placeStations();

  if (finePointer) {
    window.addEventListener('pointermove', (e) => {
      scene.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
    }, { passive: true });
  }
}

function initHud() {
  const ch = document.querySelector('.hud__ch');
  const name = document.querySelector('.hud__name');
  const bar = document.querySelector('.hud__bar i');
  const links = document.querySelectorAll('.nav__links a');
  const chapters = document.querySelectorAll('.chapter');
  const seen = new Set();
  let current = '';

  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => { bar.style.transform = `scaleX(${self.progress})`; } });
  trackChapters(({ accent, ch: num, name: label, id }) => {
    root.style.setProperty('--accent', accent);
    scene?.setAccent(accent);
    if (id === current) return;
    current = id;
    ch.textContent = num;
    name.textContent = label;
    links.forEach((a) => a.setAttribute('aria-current', String(a.hash === `#${id}`)));
    seen.add(id);
    if (id !== 'top') ach.unlock('start');
    if (seen.size === chapters.length) ach.unlock('explorer');
  });
}

function initTuner() {
  const buttons = document.querySelectorAll('.tune');
  const tried = new Set();
  buttons.forEach((btn) => btn.addEventListener('click', () => {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    scene?.setShape(Number(btn.dataset.shape));
    tried.add(btn.dataset.shape);
    if (tried.size === buttons.length) ach.unlock('tuner');
  }));
  // leaving the chapter resets the terrain to its resting shape
  ScrollTrigger.create({
    trigger: '#capacidades', start: 'top 55%', end: 'bottom 55%',
    onToggle: (self) => {
      const pressed = document.querySelector('.tune[aria-pressed="true"]');
      scene?.setShape(self.isActive ? Number(pressed.dataset.shape) : 0);
    },
  });
}

function initMachine() {
  let steps = 0;
  const onAction = (type, value) => {
    if (type === 'play' && value) ach.unlock('beat');
    if (type === 'step' && ++steps >= STEPS_FOR_PRODUCER) ach.unlock('producer');
    if (type === 'param' && value.param === 'glitch' && value.value >= 0.95) ach.unlock('glitch');
  };
  machine = mountMachine(document.querySelector('[data-machine]'), {
    onStep: (i) => { scene?.setStep(i); game?.step(i); },
    onAction,
  });
  let inMusic = false;
  ScrollTrigger.create({ trigger: '#athetosis', start: 'top 60%', end: 'bottom 40%', onToggle: (s) => { inMusic = s.isActive; } });
  window.addEventListener('keydown', (e) => {
    if (!inMusic || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest('input, textarea, select, button, canvas, [contenteditable]')) return;
    machine.key(e.key.toLowerCase());
  });
  gsap.ticker.add(() => {
    const level = machine.tick();
    scene?.setAudio(level);
    heroSignal?.setAudio(level);
  });
}

/** Spotify only loads on request (it sets third-party cookies); until then it's a plain link. */
function initSpotify() {
  const box = document.querySelector('.spotify');
  const link = box.querySelector('a');
  link.addEventListener('click', (e) => {
    if (box.querySelector('iframe')) return; // already loaded: the link now just opens Spotify
    e.preventDefault();
    const frame = document.createElement('iframe');
    frame.src = box.dataset.src;
    frame.title = t('spotify.title');
    frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    frame.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
    box.prepend(frame);
    box.querySelector('.spotify__note')?.remove();
    link.lastChild.textContent = ` ${t('spotify.open')}`;
  });
}

function initShooting() {
  const cursor = () => document.querySelector('.cursor');
  let breaks = 0;
  window.addEventListener('click', (e) => {
    if (!scene || e.detail > 1 || e.target.closest(NO_SHOOT)) return; // detail > 1: double-click is for selecting text
    const result = scene.shoot((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    SFX.laser();
    cursor()?.classList.remove('is-shot');
    void cursor()?.offsetWidth; // restart the recoil animation
    cursor()?.classList.add('is-shot');
    if (result === 'break') {
      setTimeout(SFX.boom, 60);
      if (++breaks >= DEMOLITION_BREAKS) ach.unlock('demolition');
    }
  });
}

function initEasterEggs() {
  const dog = document.querySelector('.portrait');
  const greet = () => {
    SFX.woof();
    ach.unlock('boss');
    if (!reduceMotion) gsap.fromTo(dog, { rotate: -6 }, { rotate: 3, duration: 0.8, ease: 'elastic.out(1, 0.35)' });
  };
  dog.querySelector('.portrait__btn').addEventListener('click', greet); // a native button: Enter/Space work out of the box

  let pos = 0;
  window.addEventListener('keydown', (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = key === KONAMI[pos] ? pos + 1 : Number(key === KONAMI[0]);
    if (pos < KONAMI.length) return;
    pos = 0;
    const on = root.classList.toggle('is-retro');
    scene?.setRetro(on);
    ach.unlock('konami');
  });
}

function init() {
  if (!new URLSearchParams(location.search).has('og')) { injectAnalytics(); injectSpeedInsights(); } // not in share-image captures
  if (new URLSearchParams(location.search).has('og')) root.classList.add('is-og'); // share-image capture mode
  document.querySelector('[data-year]').textContent = new Date().getFullYear();
  initLangSwitch();
  initCursor({ reduceMotion });
  initLcd({ reduceMotion });
  ach = createAchievements();
  splitWords();
  initContact({ onSent: () => ach.unlock('contact') });
  initSpotify();
  initMachine();
  initTuner();
  initHud();
  initEasterEggs();
  initShooting();
  game = mountGame(document.querySelector('.game'), {
    music: machine,
    onGameOver: (score) => { if (score >= PILOT_SCORE) ach.unlock('pilot'); },
  });

  heroSignal = mountHeroSignal(document.querySelector('.hero'), { reduceMotion });
  const intro = reduceMotion ? null : heroIntro(heroSignal.state);
  if (!reduceMotion) {
    startSmoothScroll();
    chapterReveals();
  }
  // The hero shows immediately; the 3D world (shader compile, ~90k points) starts once the intro is done
  // or the browser is idle, then fades in behind it. Keeps first paint fast and the intro smooth.
  let sceneStarted = false;
  const startScene = () => { if (!sceneStarted) { sceneStarted = true; initScene(); } };
  if (intro) {
    intro.eventCallback('onComplete', startScene);
    setTimeout(startScene, SCENE_IDLE_TIMEOUT + intro.duration() * 1000); // safety net if the tab was hidden
    requestAnimationFrame(() => intro.play());
  } else if ('requestIdleCallback' in window) {
    requestIdleCallback(startScene, { timeout: SCENE_IDLE_TIMEOUT });
  } else {
    setTimeout(startScene, 300);
  }
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
}

init();
