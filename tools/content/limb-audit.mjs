// Limb audit (lane A, 2026-11-27; docs/CHARACTER_LIMBS.md): every pickable character in Character Select's pose
// (standing, holding the rifle), measured by the game's own renderer (client tools/gripSheet.ts `__grips.limbs()`,
// tools/limbProbe.ts) and scored by tools/content/limbs.mjs: knee and ankle bow, sole roll, the drawn shin against its
// bones, and the elbows' direction. Writes the table, worst first, into docs/CHARACTER_LIMBS.md (between its
// "limb-table" marks) and the raw numbers to <out>/limbs.json.
//
//   pnpm build && pnpm --filter @tiletrigger/client exec vite preview --port 4860
//   node tools/content/limb-audit.mjs http://localhost:4860 <out dir>
//   node tools/content/limb-audit.mjs --table <out dir>      the table again from <out dir>/limbs.json
//
// ONLY=<look ids> for some; PICTURES=1 also saves each one front and side (whole body) and front and support side
// (upper body) as <out>/pics/<look>_{front,side,upper,support}.png; TUNE='{"elbowOut":0.1}' measures with that
// GripTune on every look (the elbow pole's before/after); CHROMIUM=<path> uses that browser build.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { limbMeasures, limbTable } from './limbs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DOC = join(ROOT, 'docs/CHARACTER_LIMBS.md');
const writeTable = (rows) => writeFileSync(DOC, readFileSync(DOC, 'utf8').replace(/<!-- limb-table -->[\s\S]*<!-- \/limb-table -->/, `<!-- limb-table -->\n${limbTable(rows)}\n<!-- /limb-table -->`));
// `--table <dir>`: rewrite the doc's table from a run's <dir>/limbs.json, without measuring again.
if (process.argv[2] === '--table') {
  writeTable(JSON.parse(readFileSync(join(resolve(process.argv[3]), 'limbs.json'), 'utf8')));
  process.exit(0);
}
const base = process.argv[2] ?? 'http://localhost:4860';
const out = resolve(process.argv[3] ?? join(tmpdir(), 'tiletrigger-limbs'));
if (!relative(ROOT, out).startsWith('..')) throw new Error(`the audit's output goes outside the repo, not ${out}`);
const only = process.env.ONLY?.split(',').filter(Boolean);
const pictures = process.env.PICTURES === '1';
const tune = process.env.TUNE ? JSON.parse(process.env.TUNE) : null;
mkdirSync(join(out, 'pics'), { recursive: true });

const browser = await chromium.launch({
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 360, height: 480 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/?mode=grips&test=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__grips, null, { timeout: 120_000 });
const looks = (await page.evaluate(() => window.__grips.looks())).filter((l) => (only ? only.includes(l.id) : l.pickable));

const rows = [];
for (const l of looks) {
  try {
    if (tune) await page.evaluate(([id, t]) => window.__grips.tune(id, { grip: t }), [l.id, tune]);
    await page.evaluate((id) => window.__grips.pose(id, 'core.rifle', 'third'), l.id);
    const raw = await page.evaluate(() => window.__grips.limbs());
    const m = limbMeasures(raw);
    rows.push({ id: l.id, name: l.name, ...m, raw });
    if (pictures) {
      for (const v of ['front', 'side']) {
        await page.evaluate((from) => window.__grips.body(from), v);
        await page.screenshot({ path: join(out, 'pics', `${l.id}_${v}.png`) });
      }
      for (const [v, from] of [['upper', 'front'], ['support', 'support']]) {
        await page.evaluate((f) => window.__grips.upper(f), from);
        await page.screenshot({ path: join(out, 'pics', `${l.id}_${v}.png`) });
      }
    }
    console.log(`${l.id}: legs ${m.legScore} elbows ${m.elbowScore}`);
  } catch (e) {
    console.error(`${l.id}: ${e.message.split('\n')[0]}`);
  }
}
await browser.close();
writeFileSync(join(out, 'limbs.json'), JSON.stringify(rows, null, 1));

if (!only && !tune) writeTable(rows);
else console.log(limbTable(rows));
if (errors.length) console.error(`page errors: ${errors.join('; ')}`);
