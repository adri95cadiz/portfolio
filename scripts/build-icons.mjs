// Extracts only the icons the site uses into src/icons.json, so iconify-icon never calls the Iconify API.
// Run: npm run icons (after adding a new icon="set:name" anywhere in index.html or src/).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getIcons } from '@iconify/utils';

const files = ['index.html', ...readdirSync('src').filter((f) => f.endsWith('.js')).map((f) => join('src', f))];
const used = new Set(files.flatMap((f) => readFileSync(f, 'utf8').match(/\b(solar|ph):[a-z0-9-]+/g) ?? []));
const bySet = {};
for (const id of used) { const [set, name] = id.split(':'); (bySet[set] ??= []).push(name); }
const collections = Object.entries(bySet).map(([set, names]) => {
  const data = JSON.parse(readFileSync(`node_modules/@iconify-json/${set}/icons.json`, 'utf8'));
  const subset = getIcons(data, names);
  const missing = names.filter((n) => !subset?.icons[n] && !subset?.aliases?.[n]);
  if (missing.length) throw new Error(`Unknown icons in ${set}: ${missing.join(', ')}`);
  return subset;
});
writeFileSync('src/icons.json', JSON.stringify(collections));
console.log(`icons.json: ${used.size} icons from ${collections.length} sets`);
