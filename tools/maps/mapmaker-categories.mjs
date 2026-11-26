// Picks maps' category in MapMaker (map format v51; Map properties → Category, one pick a map), the way a map maker does,
// and saves what MapMaker exports back into maps/<id>.json. The picks come from a step list (docs/map-briefs/categories/steps.json):
// data, not code, so the owner can move a map there and replay, or pick it in MapMaker by hand.
//
// Run against a built client being served (pnpm build, then vite preview: a dev server reloads the page as maps/ changes):
//   pnpm --filter @tiletrigger/client exec vite preview --port 4799 --host 127.0.0.1
//   node tools/maps/mapmaker-categories.mjs http://127.0.0.1:4799 [map ids…]
// CHROMIUM=<path> launches that browser. A map already saved at v51 with that pick is left as it is.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const only = process.argv.slice(3);
const steps = JSON.parse(readFileSync(join(ROOT, 'docs/map-briefs/categories/steps.json'), 'utf8'));
const ids = Object.keys(steps.maps).filter((id) => !only.length || only.includes(id));

const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
// One MapMaker for every map (Import replaces the map open): starting MapMaker afresh for each was minutes a map.
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept());
await page.goto(`${base}/?mode=editor&test=1`);
await page.waitForFunction(() => window.__editor, null, { timeout: 180000 });
let changed = 0;
for (const id of ids) {
  const want = steps.maps[id];
  const file = join(ROOT, 'maps', `${id}.json`);
  const before = JSON.parse(readFileSync(file, 'utf8'));
  if (before.formatVersion >= 51 && (before.metadata.category ?? 'modern') === want) {
    console.log(`${id}: already ${want}`);
    continue;
  }
  const t0 = Date.now();
  // A slow machine can time a step out: MapMaker is opened afresh and the map tried again (twice at most).
  for (let attempt = 1; ; attempt++) {
    try {
      await tagOne(id, file, want);
      break;
    } catch (e) {
      if (attempt >= 3) throw e;
      console.log(`${id}: ${e.message.split('\n')[0]}; again`);
      await page.goto(`${base}/?mode=editor&test=1`, { timeout: 180000 });
      await page.waitForFunction(() => window.__editor, null, { timeout: 180000 });
    }
  }
  changed++;
  console.log(`${id}: ${want} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
await browser.close();
console.log(`${changed} map${changed === 1 ? '' : 's'} picked and exported`);

async function tagOne(id, file, want) {
  await page.setInputFiles('#ed-import-file', file, { timeout: 180000 });
  await page.waitForFunction((i) => window.__editor.doc.metadata.id === i, id, { timeout: 180000 });
  // Map settings: the top bar's title opens them in the right dock.
  // (Clicked in the page: right after an import a software-drawn frame can keep Playwright's own click waiting.)
  await page.evaluate(() => document.getElementById('ed-map-settings')?.hidden !== false && document.getElementById('ed-title').click());
  await page.waitForSelector('#ed-prop-category', { state: 'attached', timeout: 180000 });
  // One pick (one undoable step, as by hand): the category's chip.
  await page.evaluate((v) => {
    const chip = document.querySelector(`#ed-prop-category [data-value="${v}"]`);
    chip.scrollIntoView({ block: 'center' });
    if (!chip.classList.contains('on')) chip.click();
  }, want);
  const now = await page.evaluate(() => window.__editor.doc.metadata.category ?? 'modern');
  if (now !== want) throw new Error(`${id}: MapMaker holds ${now}, wanted ${want}`);
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.evaluate(() => document.getElementById('ed-export').click())]);
  writeFileSync(file, readFileSync(await download.path(), 'utf8'));
}
