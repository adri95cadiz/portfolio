// Contact form → POST /api/contact (nodemailer). Falls back to a direct email link on failure.
import { t } from './i18n.js';
const CONTACT_EMAIL = 'adri95cadiz@gmail.com';
const TIMEOUT_MS = 15000;

/** @param {{ onSent?: () => void }} hooks */
export function initContact({ onSent } = {}) {
  const form = document.querySelector('.form');
  const status = form.querySelector('.form__status');
  const submit = form.querySelector('button[type="submit"]');
  const say = (msg, kind) => { status.textContent = msg; status.className = `form__status mono ${kind ? `is-${kind}` : ''}`; };
  const fallback = () => {
    const a = document.createElement('a');
    a.href = `mailto:${CONTACT_EMAIL}`;
    a.textContent = CONTACT_EMAIL;
    status.append(` ${t('form.fallback')} `, a, '.');
  };

  form.addEventListener('input', (e) => e.target.removeAttribute('aria-invalid'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fields = [...form.querySelectorAll('input[required], textarea[required]')];
    const invalid = fields.filter((f) => !f.value.trim() || !f.checkValidity());
    fields.forEach((f) => f.setAttribute('aria-invalid', String(invalid.includes(f))));
    if (invalid.length) {
      invalid[0].focus();
      say(t('form.invalid'), 'error');
      return;
    }

    const data = new FormData(form);
    const payload = {
      nombre: data.get('nombre'), email: data.get('email'), mensaje: data.get('mensaje'),
      tipos: data.getAll('tipo'), web: data.get('web'),
    };
    submit.disabled = true;
    say(t('form.sending'));
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      form.reset();
      say(t('form.ok'), 'ok');
      onSent?.();
    } catch (err) {
      // server messages are Spanish-only, so map statuses to local copy
      const msg = { 422: t('form.invalid'), 429: t('form.rate') }[err?.status] ?? t('form.fail');
      say(msg, 'error');
      fallback();
    } finally {
      submit.disabled = false;
    }
  });
}
