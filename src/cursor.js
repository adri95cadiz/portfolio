// Oscilloscope probe cursor: crosshair + lagging ring + live X/Y readout. Fine pointers only;
// text fields keep the native I-beam, and the arcade canvas gets its own crosshair state.
const INTERACTIVE = 'a, button, [role="button"], label, summary, input[type="range"], input[type="checkbox"], .tune, .mc__step';
// only compact, key-like controls get the wrapping frame; everything else just turns the ring into a dot
const WRAP = '.btn, .tune, .form__chips label, .nav__links a, .link-arrow, .direct a, .mc__play, .mc__chip, .game__music, .mc__keys button'; // not logo, language switch or trophy: they have their own look
const TEXT = 'input:not([type="range"]):not([type="checkbox"]), textarea, select, [contenteditable]';
const LAG = 0.38;

export function initCursor({ reduceMotion }) {
  if (!matchMedia('(pointer: fine)').matches) return;
  const root = document.documentElement;
  const el = document.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i class="cursor__ring"></i><i class="cursor__cross"></i><span class="cursor__read"></span><span class="cursor__paw"><iconify-icon icon="ph:paw-print-fill"></iconify-icon></span>';
  document.body.append(el);
  const ring = el.querySelector('.cursor__ring');
  const cross = el.querySelector('.cursor__cross');
  const read = el.querySelector('.cursor__read');
  const paw = el.querySelector('.cursor__paw');
  root.classList.add('has-cursor');

  const pos = { x: -100, y: -100 };
  const lag = { x: -100, y: -100 };
  let target = null; // hovered interactive element: the ring wraps it
  let raf = 0;

  const pad = (n) => String(Math.max(0, Math.round(n))).padStart(4, '0');

  function frame() {
    raf = 0;
    const k = reduceMotion ? 1 : LAG;
    let w = 34; let h = 34; let tx = pos.x; let ty = pos.y;
    if (target?.isConnected) {
      const r = target.getBoundingClientRect();
      w = r.width + 12; h = r.height + 12; tx = r.left + r.width / 2; ty = r.top + r.height / 2;
    }
    lag.x += (tx - lag.x) * k;
    lag.y += (ty - lag.y) * k;
    // position via `translate`, not `transform`: the recoil animates `scale`, which CSS applies before `transform`
    ring.style.translate = `${lag.x - w / 2}px ${lag.y - h / 2}px`;
    ring.style.width = `${w}px`;
    ring.style.height = `${h}px`;
    cross.style.translate = `${pos.x}px ${pos.y}px`;
    read.style.translate = `${pos.x + 16}px ${pos.y + 14}px`;
    paw.style.translate = `${pos.x - 14}px ${pos.y - 14}px`;
    read.textContent = `X ${pad(pos.x)} · Y ${pad(pos.y)}`;
    if (Math.abs(tx - lag.x) > 0.3 || Math.abs(ty - lag.y) > 0.3) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pos.x = e.clientX; pos.y = e.clientY;
    el.classList.add('is-on');
    kick();
  }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const text = e.target.closest?.(TEXT);
    const game = e.target.closest?.('.game__canvas');
    el.classList.toggle('is-paw', !!e.target.closest?.('.portrait')); // the dog photo gets a paw
    const hit = !text && !game && e.target.closest?.(INTERACTIVE);
    // form fields keep the native I-beam but still get the frame around them
    const field = text && e.target.closest('.form input, .form textarea');
    const wrap = field || (hit && e.target.closest(WRAP));
    target = wrap || null;
    el.classList.toggle('is-link', !!wrap);
    el.classList.toggle('is-hover', !!hit && !wrap);
    el.classList.toggle('is-text', !!text);
    el.classList.toggle('is-game', !!game);
    kick();
  });
  document.addEventListener('pointerdown', () => {
    el.classList.add('is-down');
    if (!target) { lag.x = pos.x; lag.y = pos.y; kick(); } // a shot lands exactly where you aim
  });
  document.addEventListener('pointerup', () => el.classList.remove('is-down'));
  document.documentElement.addEventListener('pointerleave', () => el.classList.remove('is-on'));
  window.addEventListener('scroll', kick, { passive: true }); // keep the ring glued to a hovered key while scrolling

  // modal dialogs live in the browser's top layer, above everything else: while one is open the cursor
  // moves inside it so it stays on top, and goes back to <body> when it closes
  const follow = () => {
    const open = [...document.querySelectorAll('dialog[open]')].pop();
    const host = open ?? document.body;
    if (el.parentNode !== host) host.append(el);
  };
  new MutationObserver(follow).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
}
