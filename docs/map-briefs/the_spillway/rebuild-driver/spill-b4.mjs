// Phase B4: the first buildings, placed as set pieces: the powerhouse on the toe terrace, a loading dock on the west
// bench (the maintenance yard), a bunker on the east bench (the switchyard's guard post).
import { open, exportTo, project, pickTool, placeAt, setFields } from './.spill-lib-local.mjs';
const [src, out] = process.argv.slice(2);
const { b, page } = await open(src);
const tiles = () => page.evaluate(() => [...window.__editor.doc.classicStructure.tiles.map((t) => [t.tile, t.x, t.y, t.z, t.rotation]), ...(window.__editor.doc.setPieces ?? []).map((t) => [t.piece, t.x, t.y, t.z, t.rotation])]);
const look = async (x, z, h) => { await page.evaluate(([x, z, h]) => { const v = window.__editor.view; v.pitch = -1.5; v.yaw = 0; v.applyCamera(); v.camera.position.set(x, h, z - (h) * 0.0708); }, [x, z, h]); await page.waitForTimeout(400); };
async function tile(id, cx, cy, level, rot) {
  await pickTool(page, id.startsWith('setpiece.') ? `setpiece:${id}` : `tile:${id}`);
  await page.evaluate((l) => window.__editor.setLevel(l, true), level);
  for (let i = 0; i < 4 && (await page.evaluate(() => window.__editor.rotation)) !== rot; i++) { await page.keyboard.press('KeyR'); await page.waitForTimeout(150); }
  if ((await page.evaluate(() => window.__editor.rotation)) !== rot) throw new Error('rotation');
  const wx = cx * 8, wz = cy * 8, wy = level * 4;
  const has = async () => (await tiles()).some((t) => t[0] === id && t[1] === cx && t[2] === cy && t[3] === level && t[4] === rot);
  let p, ok = false;
  // (A click now and then lands before the view has settled: look and click again.)
  for (let n = 0; n < 4 && !ok; n++) {
    await look(wx, wz, wy + 70);
    p = await project(page, wx, wy, wz);
    for (let i = 0; i < 8 && (p.x < 400 || p.x > 1000 || p.y < 200 || p.y > 700); i++) { await page.waitForTimeout(500); await look(wx, wz, wy + 70); p = await project(page, wx, wy, wz); }
    // The view eases to where it was sent: wait until the point stops moving on screen.
    for (let i = 0; i < 12; i++) { await page.waitForTimeout(350); const q = await project(page, wx, wy, wz); const still = Math.hypot(q.x - p.x, q.y - p.y) < 0.5; p = q; if (still) break; }
    await page.mouse.move(p.x - 3, p.y - 3); await page.waitForTimeout(250);
    await page.mouse.move(p.x, p.y); await page.waitForTimeout(600);
    const hover = await page.evaluate(() => document.getElementById('ed-target')?.textContent ?? '');
    if (n) console.log('hover', hover);
    await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up(); await page.waitForTimeout(700);
    ok = await has();
  }
  const toast = await page.evaluate(() => [document.querySelector('.ed-toast, #ed-toast')?.textContent ?? '', document.getElementById('ed-target')?.textContent ?? ''].join(' | '));
  if (!ok) throw new Error(`no ${id} at ${cx},${cy},${level} r${rot}: ${toast} :: level ${await page.evaluate(() => window.__editor.level)} tool ${await page.evaluate(() => JSON.stringify(window.__editor.tool))} p ${JSON.stringify(p)}`);
  console.log('tile', id, cx, cy, level, rot);
}
if (await page.evaluate(() => !document.querySelector('[data-tool^="setpiece:"]')?.offsetParent)) await page.click('#ed-pal-tabs [data-pane="setpieces"]');
await tile('setpiece.power_core_hall', -1, 3, 1, 0);
await exportTo(page, out);
await tile('setpiece.loading_dock', -15, -2, 2, 0);
await exportTo(page, out);
await tile('setpiece.bunker', 14, 3, 5, 0);
await exportTo(page, out);
console.log(JSON.stringify(await page.evaluate(() => window.__editor.doc.setPieces)).slice(0, 600));
await b.close();
