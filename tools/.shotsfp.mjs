import { chromium } from 'playwright';
import sharp from 'sharp';
const [base, out, list] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 2 });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?mode=grips&test=1`);
await page.waitForFunction(() => window.__grips, null, { timeout: 180000 });
const W = 960, H = 540;
const label = (s) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * 4}" height="36"><rect width="100%" height="100%" fill="#15181d"/><text x="8" y="24" font-family="sans-serif" font-size="20" fill="#e8e8e8">${s}</text></svg>`);
const comp = [];
const looks = list.split(',');
for (const [i, look] of looks.entries()) {
  comp.push({ input: label(`${look.replace('core.', '')}: arms only rifle · full body rifle · full body looking down · full body pistol`), left: 0, top: i * (H + 36) });
  const shots = [['core.rifle', 'first', 0], ['core.rifle', 'body', 0], ['core.rifle', 'body', -1.0], ['core.pistol', 'body', 0]];
  for (const [k, [w, v, pitch]] of shots.entries()) {
    try {
      await page.evaluate(([l, wp, vv]) => window.__grips.pose(l, wp, vv), [look, w, v]);
      if (v === 'body') await page.evaluate((p) => window.__grips.look(p), pitch);
      comp.push({ input: await page.screenshot({ type: 'png' }), left: k * W, top: i * (H + 36) + 36 });
    } catch (e) { errs.push(`${look} ${w} ${v}: ${e.message.split('\n')[0]}`); }
  }
}
await sharp({ create: { width: W * 4, height: looks.length * (H + 36), channels: 3, background: '#15181d' } }).composite(comp).png().toFile(out);
console.log(out, errs.join('; '));
await b.close();
