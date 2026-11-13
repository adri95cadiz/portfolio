// Renders the share images from brand/og-source.html. Needs Playwright once: npm i -D playwright && npx playwright install chromium
// node scripts/render-og.mjs brand/og-source.html public/og.png
// node scripts/render-og.mjs brand/og-source.html public/og-en.png "?lang=en"
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const [, , htmlArg, out, query = ''] = process.argv;
const html = resolve(htmlArg);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto(pathToFileURL(html).href + query, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ready === true);
await p.screenshot({ path: out, type: 'png' });
await b.close();
