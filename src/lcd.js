// Hero status LCD: on hover the characters scramble and decode into a new message each time.
import { t } from './i18n.js';
import { blip } from './sfx.js';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*/<>[]{}=+?';
const STAGGER_MS = 28;
const JITTER_MS = 220;
const SWAP_MS = 45; // how often an unresolved cell changes glyph
const RESTORE_MS = 1400;

const rand = (s) => s[Math.floor(Math.random() * s.length)];

/** Scrambles `el` from its current text to `to`, resolving left to right. */
function scramble(el, to, reduceMotion, onDone) {
  if (reduceMotion) { el.textContent = to; onDone?.(); return () => {}; }
  const from = el.textContent;
  const len = Math.max(from.length, to.length);
  const resolveAt = Array.from({ length: len }, (_, i) => i * STAGGER_MS + Math.random() * JITTER_MS);
  const start = performance.now();
  let raf = 0;
  let lastSwap = 0;
  let cells = [...from.padEnd(len)];
  const step = (now) => {
    const elapsed = now - start;
    const swap = now - lastSwap > SWAP_MS;
    if (swap) lastSwap = now;
    let done = true;
    cells = cells.map((c, i) => {
      if (elapsed >= resolveAt[i]) return to[i] ?? '';
      done = false;
      return swap ? (to[i] === ' ' ? ' ' : rand(GLYPHS)) : c;
    });
    el.textContent = cells.join('');
    if (done) { el.textContent = to; onDone?.(); return; }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

export function initLcd({ reduceMotion }) {
  const lcd = document.querySelector('.hero__lcd');
  const msg = lcd?.querySelector('[data-lcd="msg"]');
  const loc = lcd?.querySelector('[data-lcd="loc"]');
  if (!msg) return;
  const defaults = { msg: msg.textContent, loc: loc?.textContent ?? '' };
  const messages = t('lcd.msgs').split('|');
  let i = -1;
  let cancel = [];
  let restoreTimer = 0;

  const run = (toMsg, toLoc) => {
    cancel.forEach((c) => c());
    lcd.classList.add('is-scrambling');
    let pending = 2;
    const done = () => { if (--pending === 0) lcd.classList.remove('is-scrambling'); };
    cancel = [scramble(msg, toMsg, reduceMotion, done), loc ? scramble(loc, toLoc, reduceMotion, done) : (done(), () => {})];
  };

  lcd.addEventListener('pointerenter', () => {
    clearTimeout(restoreTimer);
    i = (i + 1) % messages.length;
    run(messages[i], t('lcd.coords'));
    blip([1568, 2093, 1760, 2349, 1975], { type: 'square', step: 0.025, gain: 0.025 }); // data chatter
  });
  lcd.addEventListener('pointerleave', () => {
    restoreTimer = setTimeout(() => run(defaults.msg, defaults.loc), RESTORE_MS);
  });
}
