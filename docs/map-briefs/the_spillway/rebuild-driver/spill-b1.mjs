// Phase B1: the two stair towers against the dam's downstream face, toe terrace (level 1) to the crest (level 7).
import { open, exportTo, project, pickTool, placeAt, setFields } from './.spill-lib-local.mjs';
const [src, out] = process.argv.slice(2);
const { b, page } = await open(src);
const tiles = () => page.evaluate(() => window.__editor.doc.classicStructure.tiles.map((t) => [t.tile, t.x, t.y, t.z, t.rotation]));
const look = async (x, z, h) => { await page.evaluate(([x, z, h]) => { const v = window.__editor.view; v.pitch = -1.5; v.yaw = 0; v.applyCamera(); v.camera.position.set(x, h, z - (h) * 0.0708); }, [x, z, h]); await page.waitForTimeout(400); };
async function tile(id, cx, cy, level, rot) {
  await pickTool(page, `tile:${id}`);
  await page.evaluate((l) => window.__editor.setLevel(l, true), level);
  for (let i = 0; i < 4 && (await page.evaluate(() => window.__editor.rotation)) !== rot; i++) { await page.keyboard.press('KeyR'); await page.waitForTimeout(150); }
  if ((await page.evaluate(() => window.__editor.rotation)) !== rot) throw new Error('rotation');
  const wx = cx * 8, wz = cy * 8, wy = level * 4;
  await look(wx, wz, wy + 70);
  const p = await project(page, wx, wy, wz);
  await page.mouse.move(p.x - 3, p.y - 3); await page.waitForTimeout(250);
  await page.mouse.move(p.x, p.y); await page.waitForTimeout(450);
  await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up(); await page.waitForTimeout(600);
  const ok = (await tiles()).some((t) => t[0] === id && t[1] === cx && t[2] === cy && t[3] === level && t[4] === rot);
  const toast = await page.evaluate(() => document.querySelector('.ed-toast, #ed-toast')?.textContent ?? '');
  if (!ok) throw new Error(`no ${id} at ${cx},${cy},${level} r${rot}: ${toast}`);
  console.log('tile', id, cx, cy, level, rot);
}
for (const cx of [-5, 5]) {
  await tile('core.corridor', cx, 5, 1, 0);
  for (const l of [1, 3, 5]) await tile('core.stairwell', cx, 6, l, 3);
  for (const l of [2, 4, 6]) await tile('core.stairwell', cx, 5, l, 1);
  await tile('core.bridge', cx, 6, 7, 0);
  await exportTo(page, out);
}
await page.evaluate(() => window.__editor.setLevel(0, true));
for (const cx of [-5, 5]) {
  await pickTool(page, 'scenario:block:solid');
  const id = await placeAt(page, cx * 8, 40 - 12);
  await setFields(page, id, [['Width (X)', 3.2, 'e.size[0]'], ['Thickness', 0.5, 'e.size[1]'], ['Depth (Z)', 2.4, 'e.size[2]'], ['X', cx * 8, 'e.position[0]'], ['Z', 53, 'e.position[2]'], ['Height', 27.5, 'e.position[1]'], ['Material', 'concrete', 'e.material']]);
  console.log('slab', id);
}
await exportTo(page, out);
await b.close();
