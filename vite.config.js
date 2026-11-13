import { defineConfig, loadEnv } from 'vite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseHTML } from 'linkedom';

const ROOT = process.cwd();
const SRC_HTML = resolve(ROOT, 'index.html');
const EN_HTML = resolve(ROOT, 'en/index.html');
const I18N_PAGE = resolve(ROOT, 'src/i18n-page.js');
// production headers live in vercel.json; `vite preview` serves the same ones so the CSP can be tested locally
const PROD_HEADERS = Object.fromEntries(
  JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8')).headers[0].headers
    .filter((h) => h.key !== 'Strict-Transport-Security' && !h.value.includes('upgrade-insecure'))
    .map((h) => [h.key, h.value]),
);
const PREVIEW_CSP = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8')).headers[0].headers
  .find((h) => h.key === 'Content-Security-Policy').value.replace('; upgrade-insecure-requests', '');

// In dev, serve /api/contact through the same handler Vercel runs in production.
function devApi() {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/contact', async (req, res) => {
        const { default: handler } = await server.ssrLoadModule('/api/contact.js');
        await handler(req, res);
      });
    },
  };
}

const loadI18n = () => import(`${pathToFileURL(I18N_PAGE).href}?t=${Date.now()}`); // fresh copy in dev

/** Builds en/index.html from index.html: the English page is real HTML, so search engines index both. */
async function generateEnglish() {
  const { PAGE_EN } = await loadI18n();
  const { document } = parseHTML(readFileSync(SRC_HTML, 'utf8'));
  document.documentElement.setAttribute('lang', 'en');
  for (const [sel, spec] of PAGE_EN) {
    const els = document.querySelectorAll(sel);
    if (!els.length) console.warn(`[i18n] no match for selector: ${sel}`);
    for (const el of els) {
      if (spec.html !== undefined) el.innerHTML = spec.html;
      if (spec.text !== undefined) el.textContent = spec.text;
      for (const [a, v] of Object.entries(spec.attr ?? {})) el.setAttribute(a, v);
    }
  }
  for (const a of document.querySelectorAll('.lang a')) {
    if (a.getAttribute('hreflang') === 'en') a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  mkdirSync(resolve(ROOT, 'en'), { recursive: true });
  writeFileSync(EN_HTML, `<!doctype html>\n<!-- GENERATED from index.html + src/i18n-page.js by vite.config.js. Do not edit. -->\n${document.documentElement.outerHTML}\n`);
}

/** Per-language <head>: title, description, social tags, canonical and hreflang alternates. */
function i18nSeo(site) {
  let warned = false;
  const abs = (path) => `${site}${path}`;
  return {
    name: 'i18n-seo',
    enforce: 'pre',
    async config() { await generateEnglish(); },
    configureServer(server) {
      server.watcher.add(I18N_PAGE);
      server.watcher.on('change', async (file) => {
        if (resolve(file) === SRC_HTML || resolve(file) === I18N_PAGE) {
          await generateEnglish();
          server.ws.send({ type: 'full-reload' });
        }
      });
    },
    async transformIndexHtml(html, ctx) {
      if (!['/index.html', '/en/index.html'].includes(ctx.path)) return html; // legal pages carry their own head
      const { META } = await loadI18n();
      const lang = ctx.path.startsWith('/en/') ? 'en' : 'es';
      const m = META[lang];
      if (!site && !warned) { warned = true; console.warn('[i18n-seo] SITE_URL not set: canonical/hreflang/og:image use relative URLs. Set it in .env for production.'); }
      const { document } = parseHTML(html);
      const head = document.head;
      const setMeta = (attr, key, content) => {
        let el = head.querySelector(`meta[${attr}="${key}"]`);
        if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); head.append(el); }
        el.setAttribute('content', content);
      };
      const link = (attrs) => { const el = document.createElement('link'); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); head.append(el); };
      head.querySelector('title').textContent = m.title;
      setMeta('name', 'description', m.desc);
      setMeta('property', 'og:title', m.ogTitle);
      setMeta('property', 'og:description', m.ogDesc);
      setMeta('property', 'og:image', abs(m.ogImage));
      setMeta('property', 'og:image:alt', m.ogAlt);
      setMeta('property', 'og:locale', m.locale);
      setMeta('property', 'og:url', abs(m.path));
      link({ rel: 'canonical', href: abs(m.path) });
      for (const [l, meta] of Object.entries(META)) link({ rel: 'alternate', hreflang: l, href: abs(meta.path) });
      link({ rel: 'alternate', hreflang: 'x-default', href: abs(META.es.path) });
      return `<!doctype html>\n${document.documentElement.outerHTML}`;
    },
    async generateBundle() {
      const { META } = await loadI18n();
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n${site ? `\nSitemap: ${site}/sitemap.xml\n` : ''}` });
      if (!site) return;
      const alts = Object.entries(META).map(([l, m]) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${site}${m.path}"/>`).join('\n');
      const urls = Object.values(META).map((m) => `  <url>\n    <loc>${site}${m.path}</loc>\n${alts}\n  </url>`).join('\n');
      this.emitFile({
        type: 'asset', fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ROOT, '');
  Object.assign(process.env, env); // SMTP_* for the dev contact API
  const site = (env.SITE_URL || '').replace(/\/$/, '');
  return {
    plugins: [i18nSeo(site), devApi()],
    preview: { headers: { ...PROD_HEADERS, 'Content-Security-Policy': PREVIEW_CSP } },
    build: {
      chunkSizeWarningLimit: 700, // three.js lives in its own lazy chunk
      rollupOptions: {
        input: { main: SRC_HTML, en: EN_HTML, legal: resolve(ROOT, 'legal/index.html'), legalEn: resolve(ROOT, 'legal/en/index.html') },
      },
    },
  };
});
