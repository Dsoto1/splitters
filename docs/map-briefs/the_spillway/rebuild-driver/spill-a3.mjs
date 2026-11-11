// Phase A3: the ground smoothed and painted, the water, the dam and its intake towers.
import { open, exportTo, project, heightAt, pickTool, lookDown, placeAt, setFields } from './.spill-lib-local.mjs';
import { centre, halfWidth, riverX, DAM } from './.spill-shape-local.mjs';
const [src, out] = process.argv.slice(2);
const { b, page } = await open(src);
const click = (id) => page.evaluate((id) => document.getElementById(id).click(), id);
const set = (id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
if (!process.env.FROM_WATER) {
// 1. The brush's dabs smoothed out (Smooth all, Light: slopes and banks keep their shape).
await set('ed-tr-smooth-all-amount', '1.5');
await click('ed-tr-smooth-all');
await page.waitForTimeout(1500);
console.log('smoothed');
// 2. Paint: gravel along the river, mud in its bed, dirt on the yards' benches, moss by the lake's shore.
const paint = async (ground, radius, points) => {
  await pickTool(page, 'terrain:paint');
  await page.evaluate((g) => document.querySelector(`[data-ground="${g}"]`).click(), ground);
  await set('ed-tr-radius', radius);
  let at = null;
  for (const [x, z] of points) {
    if (!at || Math.hypot(x - at[0], z - at[1]) > 45) { await lookDown(page, x, z, 150); at = [x, z]; }
    const p = await project(page, x, await heightAt(page, x, z), z);
    if (p.x < 340 || p.x > 1000 || p.y < 150 || p.y > 820) { await lookDown(page, x, z, 150); at = [x, z]; }
    const q = await project(page, x, await heightAt(page, x, z), z);
    await page.mouse.move(q.x, q.y);
    await page.waitForTimeout(40);
    await page.mouse.down();
    await page.waitForTimeout(120);
    await page.mouse.up();
  }
  console.log('painted', ground, points.length);
};
const river = [];
for (let z = 20; z >= -156; z -= 5) river.push([Math.round(riverX(z)), z]);
await paint('gravel', 9, river);
await paint('mud', 4, river);
const bench = (x0, x1, z0, z1, step = 8) => { const o = []; for (let z = z0; z <= z1; z += step) for (let x = x0; x <= x1; x += step) o.push([x, z]); return o; };
// The yards' benches (west maintenance yard, east switchyard, the toe terrace) and the abutments.
const westEdge = (z) => centre(z) - halfWidth(z);
const eastEdge = (z) => centre(z) + halfWidth(z);
const yards = [];
for (let z = -48; z <= 24; z += 8) for (let d = 8; d <= 42; d += 8) yards.push([Math.round(westEdge(z) - d), z]);
for (let z = 8; z <= 46; z += 8) for (let d = 8; d <= 36; d += 8) yards.push([Math.round(eastEdge(z) + d), z]);
await paint('dirt', 7, yards);
await paint('gravel', 7, bench(-56, 56, 26, 50));
const shore = [];
for (let z = 76; z <= 150; z += 6) { shore.push([Math.round(westEdge(z) - 2), z]); shore.push([Math.round(eastEdge(z) + 2), z]); }
await paint('moss', 6, shore);
// 3. Rock on every steep face.
await click('ed-tr-cliffs');
await page.waitForTimeout(800);
console.log('cliffs painted');
await exportTo(page, out);
}
// 4. Water: the reservoir behind the dam (to 17 m), and the river in its channel (the basin's ground stands above it).
const water = async (x, z, bottom, w, deep, len) => {
  await pickTool(page, 'scenario:water:water');
  const id = await placeAt(page, x, z);
  await setFields(page, id, [['Width (X)', w, 'e.size[0]'], ['Depth (deep)', deep, 'e.size[1]'], ['Length (Z)', len, 'e.size[2]'], ['X', x, 'e.position[0]'], ['Z', z, 'e.position[2]'], ['Height', bottom, 'e.position[1]']]);
  console.log('water', id, x, z);
  return id;
};
await water(30, 114, 5, 260, DAM.water - 5, 88);
await water(0, -68, -3.2, 280, 2.7, 180);
await exportTo(page, out);
// 5. The dam: three concrete blocks across the gorge's narrowest point, the crest at 20 m; three intake towers behind it.
const block = async (x, z, bottom, w, thick, depth, material) => {
  await pickTool(page, 'scenario:block:solid');
  const id = await placeAt(page, x, z);
  await setFields(page, id, [['Width (X)', w, 'e.size[0]'], ['Thickness', thick, 'e.size[1]'], ['Depth (Z)', depth, 'e.size[2]'], ['X', x, 'e.position[0]'], ['Z', z, 'e.position[2]'], ['Height', bottom, 'e.position[1]'], ['Material', material, 'e.material']]);
  console.log('block', id, x, z);
  return id;
};
const damZ = (DAM.z0 + DAM.z1) / 2;
for (const x of [-56, 0, 56]) await block(x, damZ, 0, 56, DAM.crest, DAM.z1 - DAM.z0, 'core.pbr_concrete');
for (const x of [-40, -4, 36]) await block(x, DAM.z1 + 6, 4, 9, 22, 9, 'core.pbr_concrete');
await page.evaluate(() => window.__editor.setSelection({ tiles: [], entities: [] }));
await exportTo(page, out);
console.log('done', JSON.stringify(await page.evaluate(() => { const d = window.__editor.doc; return d.entities.map((e) => [e.kind, e.position, e.size]); })));
await b.close();
