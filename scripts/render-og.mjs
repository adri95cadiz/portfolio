// Renders the share images by capturing the real hero (?og mode) at 1200×630.
// Needs Playwright once: npm i -D playwright && npx playwright install chromium
// With the dev server running (npm run dev):  node scripts/render-og.mjs
import { chromium } from 'playwright';

const BASE = process.env.OG_BASE ?? 'http://localhost:5173';
const SETTLE_MS = 9000; // intro + 3D fade-in, generous for software-rendered GPUs
const shots = [['/?og', 'public/og.png', 'es-ES'], ['/en/?og', 'public/og-en.png', 'en-US']];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [path, out, locale] of shots) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, locale });
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('is-webgl'), null, { timeout: 30000 });
  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: out });
  console.log('wrote', out);
  await page.close();
}
await browser.close();
