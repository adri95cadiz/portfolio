// POST /api/contact — sends the portfolio contact form to my inbox via SMTP (nodemailer).
// Works as a Vercel serverless function and as Vite dev middleware (see vite.config.js).
import nodemailer from 'nodemailer';

const LIMITS = { nombre: 80, email: 120, mensajeMin: 20, mensajeMax: 2000, body: 10_000 };
const ALLOWED_TIPOS = new Set([
  'Plataforma SaaS / web app', 'MVP', 'Automatización / IA', 'Web interactiva / 3D', 'Front-end / consultoría',
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RATE = { windowMs: 10 * 60_000, max: 5 };

// ponytail: in-memory per-instance rate limit; move to Redis/Upstash if spam gets past it.
const hits = new Map();

export function rateLimited(ip, now = Date.now()) {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE.max;
}

/** @returns {{ ok: true, data: {nombre:string,email:string,mensaje:string,tipos:string[]} } | { ok: false, error: string }} */
export function validate(input) {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Petición no válida.' };
  if (input.web) return { ok: false, error: 'spam' }; // honeypot: humans never see this field
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const nombre = str(input.nombre).replace(/[\r\n]+/g, ' ');
  const email = str(input.email);
  const mensaje = str(input.mensaje);
  const tipos = Array.isArray(input.tipos) ? input.tipos.filter((t) => ALLOWED_TIPOS.has(t)) : [];
  if (!nombre || nombre.length > LIMITS.nombre) return { ok: false, error: 'Falta tu nombre.' };
  if (!EMAIL_RE.test(email) || email.length > LIMITS.email) return { ok: false, error: 'El email no parece válido.' };
  if (mensaje.length < LIMITS.mensajeMin || mensaje.length > LIMITS.mensajeMax) {
    return { ok: false, error: `Cuéntame un poco más: entre ${LIMITS.mensajeMin} y ${LIMITS.mensajeMax} caracteres.` };
  }
  return { ok: true, data: { nombre, email, mensaje, tipos } };
}

function readConfig() {
  const { SMTP_HOST, SMTP_PORT = '465', SMTP_USER, SMTP_PASS, CONTACT_TO, CONTACT_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  // messages go to your own inbox unless CONTACT_TO says otherwise; From must be your account (the visitor goes in Reply-To)
  return { host: SMTP_HOST, port: Number(SMTP_PORT), user: SMTP_USER, pass: SMTP_PASS, to: CONTACT_TO || SMTP_USER, from: CONTACT_FROM || SMTP_USER };
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body; // Vercel already parsed it
  // collect bytes and decode once: a multi-byte char (á, ñ, emoji) can be split across chunks
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > LIMITS.body) throw new Error('too large');
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { ok: false, error: 'Método no permitido.' }); }
  if (!String(req.headers['content-type'] ?? '').includes('application/json')) return send(res, 415, { ok: false, error: 'Formato no válido.' });

  const ip = String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown').split(',')[0].trim();
  if (rateLimited(ip)) return send(res, 429, { ok: false, error: 'Demasiados envíos seguidos. Prueba en unos minutos.' });

  let input;
  try { input = await readBody(req); } catch { return send(res, 400, { ok: false, error: 'Petición no válida.' }); }

  const result = validate(input);
  if (!result.ok) {
    // pretend success to bots so they don't retry with tweaks
    return result.error === 'spam' ? send(res, 200, { ok: true }) : send(res, 422, { ok: false, error: result.error });
  }

  const cfg = readConfig();
  if (!cfg) {
    console.error('[contact] SMTP env vars missing (SMTP_HOST, SMTP_USER, SMTP_PASS)');
    return send(res, 500, { ok: false, error: 'El formulario no está configurado ahora mismo.' });
  }

  const { nombre, email, mensaje, tipos } = result.data;
  try {
    const transport = nodemailer.createTransport({
      host: cfg.host, port: cfg.port, secure: cfg.port === 465, auth: { user: cfg.user, pass: cfg.pass },
    });
    await transport.sendMail({
      from: { name: 'Portfolio · Señal', address: cfg.from },
      to: cfg.to,
      replyTo: { name: nombre, address: email },
      subject: `Nuevo proyecto${tipos.length ? ` (${tipos.join(', ')})` : ''}: ${nombre}`,
      text: `${mensaje}\n\n—\nNombre: ${nombre}\nEmail: ${email}\nTipo: ${tipos.join(', ') || 'sin especificar'}\nIP: ${ip}`,
    });
    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('[contact] sendMail failed', err);
    return send(res, 502, { ok: false, error: 'No he podido enviar el mensaje.' });
  }
}
