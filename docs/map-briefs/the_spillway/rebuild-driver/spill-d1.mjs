// Phase D1: vegetation. The environment brush (Temperate woods, on grass and moss only, keeping spawns and routes
// clear) stroked along the valley's sides and round the lake; the river's floor between the banks stays open.
import { open, exportTo, project, heightAt, pickTool } from './.spill-lib-local.mjs';
const [src, out] = process.argv.slice(2);
const { b, page } = await open(src);
await pickTool(page, 'envbrush');
await page.selectOption('#ed-env-preset', 'temperate');
for (const m of ['dirt', 'mud']) await page.evaluate((m) => { const c = document.getElementById(`ed-env-mat-${m}`); if (c?.checked) c.click(); }, m);
await page.evaluate(() => { const r = document.getElementById('ed-env-radius'); r.value = '14'; r.dispatchEvent(new Event('input', { bubbles: true })); });
const count = () => page.evaluate(() => window.__editor.doc.entities.filter((e) => e.kind === 'prop' && e.model.startsWith('env.')).length);
const view = async (x, z) => {
  await page.evaluate(([x, z]) => { const v = window.__editor.view; v.pitch = -1.5; v.yaw = 0; v.applyCamera(); v.camera.position.set(x, 170, z - 170 * 0.0708); }, [x, z]);
  let p = await project(page, x, 0, z);
  for (let i = 0; i < 14; i++) { await page.waitForTimeout(350); const q = await project(page, x, 0, z); const still = Math.hypot(q.x - p.x, q.y - p.y) < 0.5; p = q; if (still) break; }
};
const stroke = async (x0, x1, z) => {
  await view((x0 + x1) / 2, z);
  const a = await project(page, x0, await heightAt(page, x0, z), z);
  const c = await project(page, x1, await heightAt(page, x1, z), z);
  if ([a, c].some((p) => p.x < 330 || p.x > 1060 || p.y < 120 || p.y > 820)) { console.log('off view', x0, x1, z, JSON.stringify([a, c])); return; }
  await page.mouse.move(a.x, a.y); await page.waitForTimeout(200);
  await page.mouse.down(); await page.mouse.move(c.x, c.y, { steps: 10 }); await page.waitForTimeout(150); await page.mouse.up();
  await page.waitForTimeout(500);
};
const rows = [];
for (let z = -150; z <= 42; z += 24) for (const s of [-1, 1]) for (const [x0, x1] of [[40, 76], [78, 114], [116, 150]]) rows.push([s * x0, s * x1, z]);
for (const z of [100, 130]) for (const s of [-1, 1]) for (const [x0, x1] of [[96, 124], [126, 150]]) rows.push([s * x0, s * x1, z]);
let n = 0;
for (const [x0, x1, z] of rows) {
  await stroke(x0, x1, z);
  if (++n % 10 === 0) { console.log('strokes', n, 'plants', await count()); await exportTo(page, out); }
}
console.log('strokes', n, 'plants', await count());
await exportTo(page, out);
await b.close();
