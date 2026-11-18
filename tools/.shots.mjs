// Pictures for the grips auto-fit: third-person rifle/pistol with the muzzle marked, and first-person arms.
import { chromium } from 'playwright';
import sharp from 'sharp';
const base = process.argv[2];
const out = process.argv[3];
const looks = process.argv[4].split(',');
const mode = process.argv[5] ?? 'third';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 300, height: 300 }, deviceScaleFactor: 2 });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?mode=grips&test=1`);
await page.waitForFunction(() => window.__grips, null, { timeout: 180000 });
const label = (s, w) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="36"><rect width="100%" height="100%" fill="#15181d"/><text x="8" y="24" font-family="sans-serif" font-size="20" fill="#e8e8e8">${s.replace(/&/g, '&amp;')}</text></svg>`);
const tiles = [];
for (const look of looks) {
  const row = [];
  for (const w of mode === 'third' ? ['core.rifle', 'core.pistol'] : ['core.rifle', 'core.pistol']) {
    for (const view of mode === 'third' ? ['side', 'front'] : ['first', 'body']) {
      try {
        await page.evaluate(([l, wp, v]) => window.__grips.pose(l, wp, v), [look, w, mode === 'third' ? 'third' : view]);
        if (mode === 'third') {
          await page.evaluate(() => window.__grips.markMuzzle());
          await page.evaluate(async ([v, wp]) => {
            const j = window.__grips.joints();
            const side = Math.sign(j.upperarm_r[0]) || 1;
            if (v === 'side' && wp === 'core.rifle') return window.__grips.upper('side');
            const a = v === 'side' ? (side > 0 ? 0 : Math.PI) : Math.PI / 2 - side * 0.6;
            await window.__grips.closeUp('hand_r', a, 1.35, wp === 'core.rifle' ? 1.25 : 0.85);
          }, [view, w]);
        }
        row.push(await page.screenshot({ type: 'png' }));
      } catch (e) { errs.push(`${look} ${w} ${view}: ${e.message.split('\n')[0]}`); row.push(null); }
    }
  }
  tiles.push({ look, row });
}
const T = 600;
const comp = [];
tiles.forEach((t, i) => {
  comp.push({ input: label(t.look.replace('core.', ''), T * 4), left: 0, top: i * (T + 36) });
  t.row.forEach((p, k) => p && comp.push({ input: p, left: k * T, top: i * (T + 36) + 36 }));
});
await sharp({ create: { width: T * 4, height: tiles.length * (T + 36), channels: 3, background: '#15181d' } }).composite(comp).png().toFile(out);
console.log(out, errs.join('; '));
await b.close();
