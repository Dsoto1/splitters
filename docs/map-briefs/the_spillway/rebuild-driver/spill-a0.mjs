// Trial: clear the old map, a new 320 m terrain, one Flatten dab read back.
import { open, exportTo, overhead, project, heightAt } from './.spill-lib-local.mjs';
const [src, out] = process.argv.slice(2);
const { b, page } = await open(src);
// Everything placed goes (MapMaker's own selection, then Delete).
await page.evaluate(() => { const ed = window.__editor, d = ed.doc; ed.setSelection({ tiles: d.classicStructure.tiles.map((t) => t.id), entities: d.entities.map((e) => e.id), setPieces: (d.setPieces ?? []).map((s) => s.id) }, true); });
await page.evaluate(() => document.activeElement?.blur?.());
await page.keyboard.press('Delete');
console.log('after delete', await page.evaluate(() => { const d = window.__editor.doc; return [d.classicStructure.tiles.length, d.entities.length, (d.setPieces ?? []).length]; }));
await page.evaluate(() => document.getElementById('ed-tr-remove').click());
await page.waitForTimeout(500);
console.log('terrain gone', await page.evaluate(() => !window.__editor.doc.terrain));
await page.selectOption('#ed-tr-new-size', '320');
await page.evaluate(() => document.getElementById('ed-tr-new').click());
await page.waitForFunction(() => window.__editor.doc.terrain, null, { timeout: 30000 });
console.log('terrain', await page.evaluate(() => { const t = window.__editor.doc.terrain; return [t.origin, t.spacing, t.cols, t.rows, t.baseY]; }));
// One Flatten dab at 10 m.
await page.evaluate(() => document.querySelector('[data-tool="terrain:flatten"]').click());
await page.evaluate(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }; set('ed-tr-radius', 16); set('ed-tr-strength', 100); set('ed-tr-flatten-y', 10); });
await overhead(page, 0, 0, 420);
for (const [x, z] of [[0, 0], [100, -100]]) {
  const p = await project(page, x, 0, z);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(150);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  console.log('dab', x, z, 'screen', Math.round(p.x), Math.round(p.y), 'height now', await heightAt(page, x, z), 'beside', await heightAt(page, x + 8, z), await heightAt(page, x + 16, z));
}
await page.screenshot({ path: out + '.png', timeout: 120000 });
await exportTo(page, out);
await b.close();
