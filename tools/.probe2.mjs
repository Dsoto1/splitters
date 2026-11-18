import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 2 });
await page.goto('http://127.0.0.1:4867/?mode=grips&test=1');
await page.waitForFunction(() => window.__grips, null, { timeout: 180000 });
const S = '/tmp/claude-0/-home-user/e3fb4e62-c9b1-5a73-a1a8-a7aba14a7f74/scratchpad/grips-shots';
for (const look of ['core.croakley', 'core.ranger']) {
  await page.evaluate((l) => window.__grips.pose(l, 'core.rifle', 'body'), look);
  await page.evaluate(() => window.__grips.look(-1.0));
  await page.evaluate(() => window.__grips.outside(Math.PI / 4));
  await page.screenshot({ path: `${S}/outside-${look}.png` });
  await page.evaluate(() => window.__grips.outside(null));
  await page.evaluate(() => window.__grips.look(-1.4));
  await page.screenshot({ path: `${S}/down-${look}.png` });
}
await b.close();
