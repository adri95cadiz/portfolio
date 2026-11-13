// One shared AudioContext for every sound on the site (drum machine, UI sounds, game).
// Mobile browsers (iOS especially) only let audio start inside a real user gesture — touchend/click/keydown,
// not pointerdown — so the context is unlocked on the first such gesture anywhere on the page.
let ctx = null;

export function getAudioContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function unlock() {
  // iOS 17+: treat this as media playback, so the ringer/silent switch doesn't mute it
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* unsupported */ }
  const a = getAudioContext();
  if (!a) return;
  // a 1-sample silent buffer started inside the gesture is what finally opens audio on older iOS
  const src = a.createBufferSource();
  src.buffer = a.createBuffer(1, 1, a.sampleRate);
  src.connect(a.destination);
  src.start(0);
  if (a.state === 'running') for (const type of GESTURES) window.removeEventListener(type, unlock, true);
}

const GESTURES = ['touchend', 'click', 'keydown'];
for (const type of GESTURES) window.addEventListener(type, unlock, { capture: true, passive: true });
