// A lineup sheet per prop pack: its furniture and everyday props in rows beside a small, a standard and a large
// character (1.40, 1.80 and 2.12 m) and a 1 m ruler, with the reference heights of a seat, a table top, a counter and a
// door drawn across (docs/CONTENT_PIPELINE.md, "Real-world sizes"). Each row twice: from a standing player's eye (1.6 m,
// the game's field of view) and from the side (a true elevation, each prop turned to show its profile). The scenes come
// from the game's own renderer (tools/propLineup.ts, `?mode=lineup`, through `window.__lineup`).
//
// Run against a built client being served:
//   pnpm build && pnpm --filter @tiletrigger/client exec vite preview --port 4860
//   node tools/content/prop-lineup.mjs http://localhost:4860 <out dir>
//
// The out dir must be outside the repo (default: <tmp>/tiletrigger-prop-lineup). Every pack with furniture or everyday
// props (chairs, stools, sofas, benches, tables, desks, counters, beds, shelves, cabinets, doors, toilets, sinks,
// fridges, lamps, kitchen and office pieces) by default; PACKS=<pack ids> for some packs, ONLY=<prop ids> for some
// props (one sheet, "only"). PER_ROW=<n> props a row (default 5). SCALE=<factor> draws every prop that much bigger (a
// "game size" furniture factor to show the owner; the catalogue is unchanged). CHROMIUM=<path> uses that browser build.
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { isFurniture } from './furniture.mjs';
import { loadPropManifest } from './props-manifest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const base = process.argv[2] ?? 'http://localhost:4860';
const out = resolve(process.argv[3] ?? join(tmpdir(), 'tiletrigger-prop-lineup'));
if (!relative(ROOT, out).startsWith('..')) throw new Error(`lineup sheets go outside the repo, not ${out}`);
const PER_ROW = Number(process.env.PER_ROW ?? 5);
const SCALE = Number(process.env.SCALE ?? 1);

const manifest = loadPropManifest();
const only = process.env.ONLY?.split(',').filter(Boolean);
const packs = process.env.PACKS?.split(',').filter(Boolean);
const chosen = manifest.props.filter((p) => (only ? only.includes(p.id) : isFurniture(p) && (!packs || packs.includes(p.pack))));
const byPack = new Map();
for (const p of chosen) {
  const key = only ? 'only' : p.pack;
  if (!byPack.has(key)) byPack.set(key, []);
  byPack.get(key).push(p);
}
if (!byPack.size) throw new Error('no props to line up');

mkdirSync(out, { recursive: true });
const W = 1280;
const H = 720;
const browser = await chromium.launch({
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/?mode=lineup&test=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__lineup, null, { timeout: 300_000, polling: 500 });

const text = (s, w, h, size = 16, weight = 600) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#15181d"/><text x="12" y="${h / 2 + size / 3}" font-family="sans-serif" font-size="${size}" font-weight="${weight}" fill="#e8e8e8">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);

const LABEL = 30;
const TILE = { width: 960, height: 540 };
const index = {};
for (const [pack, props] of byPack) {
  const t0 = Date.now();
  const rows = [];
  for (let i = 0; i < props.length; i += PER_ROW) rows.push(props.slice(i, i + PER_ROW));
  const tiles = [];
  let top = LABEL * 2;
  for (const row of rows) {
    const ids = row.map((p) => `prop.${p.id}`);
    for (const [col, view] of ['eye', 'side'].entries()) {
      await page.evaluate(([ids, view, scale]) => window.__lineup.show(ids, view, ids.map(() => scale)), [ids, view, SCALE]);
      const shot = await page.screenshot({ type: 'png' });
      tiles.push({ input: await sharp(shot).resize(TILE.width, TILE.height).png().toBuffer(), left: col * TILE.width, top: top + LABEL });
      tiles.push({ input: text(view === 'eye' ? "From a standing player's eye (1.6 m, the game's field of view)" : 'From the side (true elevation)', TILE.width, LABEL, 14, 500), left: col * TILE.width, top });
    }
    top += LABEL + TILE.height;
  }
  const title = pack === 'only' ? 'Lineup' : (manifest.packs[pack]?.title ?? pack);
  tiles.push({ input: text(`${title} (${pack}): ${props.length} props beside a small, a standard and a large character${SCALE !== 1 ? `, every prop ×${SCALE}` : ''}`, 2 * TILE.width, LABEL * 2, 22, 700), left: 0, top: 0 });
  const file = join(out, `${pack}.png`);
  await sharp({ create: { width: 2 * TILE.width, height: top, channels: 3, background: '#15181d' } }).composite(tiles).png().toFile(file);
  index[pack] = props.map((p) => p.id);
  console.log(`${file}: ${props.length} props (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 1));
await browser.close();
if (errors.length) {
  console.error(`page errors: ${errors.join('; ')}`);
  process.exit(1);
}
