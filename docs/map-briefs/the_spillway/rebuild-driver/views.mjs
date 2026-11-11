// MapMaker views of a map file from given cameras: node .views-local.mjs <port> <map.json> <out prefix> "x,y,z>tx,ty,tz" ...
import { chromium } from 'playwright';
const [port, file, out, ...views] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('dialog', (d) => d.accept());
await page.goto(`http://localhost:${port}/?mode=editor&test=1`);
await page.waitForFunction(() => window.__editor, null, { timeout: 120000 });
await page.setInputFiles('#ed-import-file', file);
await page.waitForFunction(() => window.__editor.doc.terrain, null, { timeout: 60000 });
await page.evaluate(() => window.__editor.setShowAll(true, true));
// For the picture only: the other levels' pieces drawn solid (MapMaker ghosts them round the level in hand).
await page.evaluate(() => { for (const m of window.__editor.view.scene.meshes) if (m.name.startsWith('edmapdim')) m.visibility = 1; });
// The view alone: MapMaker's panels hidden for the picture.
await page.addStyleTag({ content: '#ed-top, #ed-palette, #ed-side, #ed-overlay, #ed-levels, #ed-bottom, .ed-toast, #ed-toast, aside, header, footer, nav { display: none !important; }' });
let i = 0;
for (const v of views) {
  const [p, t] = v.split('>').map((s) => s.split(',').map(Number));
  await page.evaluate(([p, t]) => {
    // The editor's own camera state (yaw, pitch), so it holds the view.
    const v = window.__editor.view, d = [t[0] - p[0], t[1] - p[1], t[2] - p[2]];
    v.yaw = Math.atan2(d[0], d[2]);
    v.pitch = Math.max(-1.5, Math.min(1.5, Math.atan2(d[1], Math.hypot(d[0], d[2]))));
    v.applyCamera();
    v.camera.position.set(p[0], p[1], p[2]);
    v.camera.maxZ = Math.max(v.camera.maxZ, 3000);
  }, [p, t]);
  await page.evaluate(() => { for (const m of window.__editor.view.scene.meshes) if (m.name.startsWith('edmapdim')) m.visibility = 1; });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${out}-${++i}.png`, timeout: 240000 });
}
await b.close();
