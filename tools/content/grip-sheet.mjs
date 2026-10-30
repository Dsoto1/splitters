// A grip check sheet per character: each one holding a pistol, a rifle, a shotgun and a knife, in third
// person (framed on the hands) and first person (the game's own arms and viewmodel placement), in one
// picture per character, so a bad grip shows at a glance. The poses come from the game's own renderer
// (tools/gripSheet.ts, `?mode=grips`, through `window.__grips`).
//
// Run against a built client being served:
//   pnpm build && pnpm --filter @tiletrigger/client exec vite preview --port 4860
//   node tools/content/grip-sheet.mjs http://localhost:4860 <out dir>
//
// The out dir must be outside the repo (default: <tmp>/tiletrigger-grip-sheets). Every character
// in content/characters/*.json by default; ONLY=<ids> for some (manifest ids such as meshy_knight,
// or any look id such as core.ranger); WEAPONS=<weapon ids> for other weapons than the four.
// CHROMIUM=<path> uses that browser build.
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const base = process.argv[2] ?? 'http://localhost:4860';
const out = resolve(process.argv[3] ?? join(tmpdir(), 'tiletrigger-grip-sheets'));
if (!relative(ROOT, out).startsWith('..')) throw new Error(`grip sheets go outside the repo, not ${out}`);
const only = process.env.ONLY?.split(',').filter(Boolean);

/**
 * What each character holds (one of each hold style; the knife rides in the hand in third person).
 * WEAPONS=core.smg,core.lmg holds those instead (a new weapon's grip on a few characters).
 */
const WEAPONS = process.env.WEAPONS
  ? process.env.WEAPONS.split(',').filter(Boolean).map((id) => [id.replace(/^core\./, ''), id])
  : [
      ['Pistol', 'core.pistol'],
      ['Rifle', 'core.rifle'],
      ['Shotgun', 'core.shotgun'],
      ['Knife', 'core.knife'],
    ];
const VIEWS = [
  ['third person', 'third'],
  ['first person', 'first'],
];
/** Tile sizes: third person square, first person the game's 16:9 (the same field of view as in a match). */
const TILE = 480;
const FP_HEIGHT = 270;
const LABEL = 28;
const SHOT = { third: { width: TILE, height: TILE }, first: { width: 960, height: 540 } };
const rowHeight = (view) => (view === 'first' ? FP_HEIGHT : TILE);

// Characters: manifest ids to their look ids.
const MANIFESTS = join(ROOT, 'content/characters');
const manifests = existsSync(MANIFESTS)
  ? readdirSync(MANIFESTS)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join(MANIFESTS, f), 'utf8')))
      // Queued stubs aren't built yet.
      .filter((m) => m.status !== 'queued')
  : [];
const lookOf = new Map(manifests.map((m) => [m.id, m.look]));
const wanted = (only ?? manifests.map((m) => m.id)).map((id) => ({ id, look: lookOf.get(id) ?? id }));
if (!wanted.length) throw new Error('no characters: no manifests in content/characters, and no ONLY=<ids>');

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: TILE, height: TILE } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/?mode=grips&test=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__grips, null, { timeout: 120_000 });
const known = new Set((await page.evaluate(() => window.__grips.looks())).map((l) => l.id));

const text = (s, w, h, size = 16, weight = 600) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#15181d"/><text x="10" y="${h / 2 + size / 3}" font-family="sans-serif" font-size="${size}" font-weight="${weight}" fill="#e8e8e8">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);

const failed = [];
for (const { id, look } of wanted) {
  if (!known.has(look)) {
    failed.push(`${id}: no look ${look}`);
    continue;
  }
  const t0 = Date.now();
  const tiles = [];
  let top = LABEL * 2;
  for (const [viewLabel, view] of VIEWS) {
    await page.setViewportSize(SHOT[view]);
    for (const [wi, [label, weapon]] of WEAPONS.entries()) {
      try {
        await page.evaluate(([l, w, v]) => window.__grips.pose(l, w, v), [look, weapon, view]);
        const shot = await page.screenshot({ type: 'png' });
        tiles.push({ input: await sharp(shot).resize(TILE, rowHeight(view)).png().toBuffer(), left: wi * TILE, top: top + LABEL });
        tiles.push({ input: text(`${label}, ${viewLabel}`, TILE, LABEL, 14, 500), left: wi * TILE, top });
      } catch (e) {
        failed.push(`${id} ${weapon} ${view}: ${e.message.split('\n')[0]}`);
      }
    }
    top += LABEL + rowHeight(view);
  }
  const width = WEAPONS.length * TILE;
  const height = top;
  tiles.push({ input: text(`${id} (${look})`, width, LABEL * 2, 22, 700), left: 0, top: 0 });
  const file = join(out, `${id}.png`);
  await sharp({ create: { width, height, channels: 3, background: '#15181d' } }).composite(tiles).png().toFile(file);
  console.log(`${file} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
await browser.close();
if (failed.length || errors.length) {
  console.error(`failed: ${failed.join('; ')}${errors.length ? ` · page errors: ${errors.join('; ')}` : ''}`);
  process.exit(1);
}
