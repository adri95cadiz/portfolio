import { SFX } from './sfx.js';
import { t } from './i18n.js';

const STORAGE_KEY = 'ap-logros';
const TOAST_MS = 3600;

const XP = { start: 10, boss: 20, tuner: 30, beat: 20, producer: 30, glitch: 30, pilot: 50, explorer: 40, demolition: 40, konami: 50, contact: 100 };
export const ACHIEVEMENTS = Object.entries(XP).map(([id, xp]) => ({
  id, xp, get title() { return t(`ach.${id}.t`); }, get desc() { return t(`ach.${id}.d`); },
}));
const TOTAL_XP = ACHIEVEMENTS.reduce((n, a) => n + a.xp, 0);

function load() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')); } catch { return new Set(); }
}
function save(set) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])); } catch { /* private mode: progress lasts this visit */ }
}

export function createAchievements() {
  const unlocked = load();
  const toasts = document.querySelector('.toasts');
  const xpLabel = document.querySelector('[data-xp]');
  const xpBar = document.querySelector('.trophy__bar i');
  const dialog = document.querySelector('.trophies');
  const list = dialog.querySelector('.trophies__list');

  const xp = () => ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).reduce((n, a) => n + a.xp, 0);

  function render() {
    xpLabel.textContent = `${unlocked.size}/${ACHIEVEMENTS.length}`;
    xpBar.style.transform = `scaleX(${xp() / TOTAL_XP})`;
    list.replaceChildren(...ACHIEVEMENTS.map((a) => {
      const li = document.createElement('li');
      const got = unlocked.has(a.id);
      li.className = got ? 'is-got' : '';
      li.innerHTML = `<span class="mono">${got ? `+${a.xp} XP` : t('ach.locked')}</span><strong></strong><small></small>`;
      li.querySelector('strong').textContent = got ? a.title : '???';
      li.querySelector('small').textContent = got ? a.desc : t('ach.keep');
      return li;
    }));
  }

  function toast(a) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span class="mono"></span><strong></strong><small></small><b class="mono"></b>';
    el.querySelector('span').textContent = t('ach.unlocked');
    el.querySelector('strong').textContent = a.title;
    el.querySelector('small').textContent = a.desc;
    el.querySelector('b').textContent = `+${a.xp} XP`;
    toasts.append(el);
    setTimeout(() => el.classList.add('is-out'), TOAST_MS);
    setTimeout(() => el.remove(), TOAST_MS + 500);
  }

  document.querySelector('.trophy').addEventListener('click', () => { render(); dialog.showModal(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog || e.target.closest('[data-close]')) dialog.close(); });
  render();

  return {
    has: (id) => unlocked.has(id),
    unlock(id) {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (!a || unlocked.has(id)) return;
      unlocked.add(id);
      save(unlocked);
      render();
      toast(a);
      SFX.achievement();
    },
  };
}
