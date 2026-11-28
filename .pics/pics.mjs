// node pics.mjs <port> <outdir> <tag>: Profile and the Armory, desktop and a phone sideways.
import { chromium } from 'playwright';
const [port, out, tag] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM });
for (const [name, opts] of [['desktop', { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 }], ['phone', { viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]]) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`http://127.0.0.1:${port}/?test=1&name=Tester`);
  await p.waitForFunction(() => window.__front && !document.getElementById('menu').hidden, null, { timeout: 60000 });
  await p.click('#profile-badge');
  await p.waitForSelector('#profile-panel', { timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/profile-${tag}-${name}.png` });
  await p.evaluate(() => document.getElementById('profile-loadout')?.scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/profile-${tag}-${name}-loadout.png` });
  const btn = (await p.$('#profile-armory')) ? '#profile-armory' : null;
  if (btn) {
    await p.click(btn);
    await p.waitForFunction(() => document.querySelector('.screen.armory')?.dataset.shown && window.__front.scene.scene.getTransformNodeByName('armoryShow')?.getChildMeshes().length > 0, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${out}/armory-${tag}-${name}.png` });
  }
  await ctx.close();
}
await b.close();
