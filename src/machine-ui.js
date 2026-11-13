import { createMachine, TRACKS, STEPS, PRESETS } from './machine.js';
import { t } from './i18n.js';

const LABELS = { kick: 'Kick', snare: 'Snare', hat: 'Hat', open: 'Open', bass: t('mc.bass') };
const KEYS = 'asdfghjk';
const KEY_NOTES = [0, 2, 3, 5, 7, 8, 10, 12];
const KNOBS = [
  ['cutoff', 'Cutoff'], ['reso', 'Reso'], ['decay', 'Decay'], ['drive', 'Drive'], ['delay', 'Delay'],
];
const GROOVE = [['swing', 'Swing'], ['glitch', 'Glitch']];
const knob = (state) => ([p, l]) => `<label class="mc__knob"><input type="range" min="0" max="1" step="0.01" value="${state[p]}" data-param="${p}" /><span class="mono">${l}</span></label>`;

function template(state) {
  const steps = (tr) => Array.from({ length: STEPS }, (_, i) => `<button type="button" class="mc__step" data-track="${tr}" data-step="${i}" aria-pressed="${state.grid[tr][i]}" aria-label="${LABELS[tr]}, ${t('mc.step')} ${i + 1}"></button>`).join('');
  return `
  <div class="mc__head">
    <p class="mc__brand"><strong>ATH-16</strong><span class="mono">${t('mc.subtitle')}</span></p>
    <div class="mc__lcd mono" aria-hidden="true">
      <span><b data-lcd="bpm">${state.bpm}</b> BPM</span><span data-lcd="preset">${state.preset}</span>
      <span class="mc__leds">${'<i></i>'.repeat(STEPS)}</span>
    </div>
  </div>
  <div class="mc__transport">
    <button type="button" class="mc__play" aria-pressed="false"><iconify-icon icon="solar:play-bold" aria-hidden="true"></iconify-icon><span>Play</span></button>
    <label class="mc__bpm mono">BPM <input type="range" min="80" max="170" value="${state.bpm}" data-param="bpm" /></label>
    <div class="mc__presets" role="group" aria-label="${t('mc.presets')}">
      ${Object.keys(PRESETS).map((p) => `<button type="button" class="mc__chip mono" data-preset="${p}" aria-pressed="${p === state.preset}">${p}</button>`).join('')}
    </div>
    <button type="button" class="mc__chip mono" data-mutate>${t('mc.mutate')}</button>
    <div class="mc__groove">${GROOVE.map(knob(state)).join('')}</div>
  </div>
  <div class="mc__grid">
    ${TRACKS.map((tr) => `<div class="mc__row" data-row="${tr}"><span class="mc__label mono">${LABELS[tr]}</span><div class="mc__steps">${steps(tr)}</div></div>`).join('')}
  </div>
  <div class="mc__synth">
    <div class="mc__wave" role="group" aria-label="${t('mc.wave')}">
      <button type="button" class="mc__chip mono" data-wave="sawtooth" aria-pressed="true">Saw</button>
      <button type="button" class="mc__chip mono" data-wave="square" aria-pressed="false">Sqr</button>
    </div>
    ${KNOBS.map(knob(state)).join('')}
  </div>
  <div class="mc__keys" role="group" aria-label="${t('mc.keys')}">
    ${KEYS.split('').map((k, i) => `<button type="button" data-note="${KEY_NOTES[i]}">${k.toUpperCase()}</button>`).join('')}
  </div>`;
}

/**
 * Renders the ATH-16 into `root` and wires it to the audio engine.
 * @param {HTMLElement} root
 * @param {{ onStep?: (i:number) => void, onAction?: (type:string, value?:unknown) => void }} hooks
 */
export function mountMachine(root, { onStep, onAction = () => {} } = {}) {
  let head = -1;
  const machine = createMachine({
    onStep: (i) => {
      cols[head]?.forEach((b) => b.classList.remove('is-head'));
      leds[head]?.classList.remove('is-on');
      head = i;
      cols[i]?.forEach((b) => b.classList.add('is-head'));
      leds[i]?.classList.add('is-on');
      onStep?.(i);
    },
  });
  const { state } = machine;
  root.innerHTML = template(state);

  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const cols = Array.from({ length: STEPS }, (_, i) => $$(`.mc__step[data-step="${i}"]`));
  const leds = $$('.mc__leds i');
  const playBtn = $('.mc__play');
  const bpmInput = $('[data-param="bpm"]');

  const syncGrid = () => $$('.mc__step').forEach((b) => b.setAttribute('aria-pressed', String(state.grid[b.dataset.track][b.dataset.step])));
  const syncLcd = () => { $('[data-lcd="bpm"]').textContent = state.bpm; $('[data-lcd="preset"]').textContent = state.preset; };
  const press = (btns, active) => btns.forEach((b) => b.setAttribute('aria-pressed', String(b === active)));

  const setPlaying = (on) => {
    playBtn.setAttribute('aria-pressed', String(on));
    playBtn.querySelector('span').textContent = on ? 'Stop' : 'Play';
    playBtn.querySelector('iconify-icon').setAttribute('icon', on ? 'solar:stop-bold' : 'solar:play-bold');
    root.classList.toggle('is-playing', on);
    document.documentElement.classList.toggle('is-playing', on); // the nav logo glitches along with the beat
  };

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b === playBtn) { setPlaying(machine.toggle()); onAction('play', state.playing); } else if (b.dataset.step) {
      b.setAttribute('aria-pressed', String(machine.toggleStep(b.dataset.track, Number(b.dataset.step))));
      onAction('step');
    } else if (b.dataset.preset) {
      machine.load(b.dataset.preset);
      press($$('[data-preset]'), b);
      bpmInput.value = state.bpm;
      $('[data-param="swing"]').value = state.swing;
      $('[data-param="glitch"]').value = state.glitch;
      syncGrid(); syncLcd();
      onAction('preset', b.dataset.preset);
    } else if ('mutate' in b.dataset) {
      machine.mutate();
      onAction('mutate');
      b.classList.remove('is-flash'); void b.offsetWidth; b.classList.add('is-flash');
    } else if (b.dataset.wave) { machine.set('wave', b.dataset.wave); press($$('[data-wave]'), b); }
  });

  root.addEventListener('input', (e) => {
    const { param } = e.target.dataset;
    if (!param) return;
    machine.set(param, Number(e.target.value));
    if (param === 'bpm') syncLcd();
    onAction('param', { param, value: Number(e.target.value) });
  });

  const keyBtns = $$('.mc__keys button');
  const hit = (btn) => {
    machine.note(Number(btn.dataset.note));
    onAction('note');
    btn.classList.add('is-on');
    setTimeout(() => btn.classList.remove('is-on'), 140);
  };
  keyBtns.forEach((btn) => btn.addEventListener('pointerdown', () => hit(btn)));
  keyBtns.forEach((btn) => btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hit(btn); }
  }));

  document.addEventListener('visibilitychange', () => { if (document.hidden && state.playing) { machine.stop(); setPlaying(false); } });

  return {
    tick: () => machine.tick(),
    /** Used by the arcade: load a preset and start it, keeping the panel UI in sync. */
    playPreset(name) {
      $(`[data-preset="${name}"]`)?.click();
      if (!state.playing) playBtn.click();
    },
    stop() { if (state.playing) playBtn.click(); },
    isPlaying: () => state.playing,
    bpm: () => state.bpm,
    /** Plays a key from the computer keyboard (A–K). Returns true when it handled the key. */
    key(k) {
      const idx = KEYS.indexOf(k);
      if (idx < 0) return false;
      hit(keyBtns[idx]);
      return true;
    },
  };
}
