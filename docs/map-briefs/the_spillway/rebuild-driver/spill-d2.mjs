// Phase D2: the plants the brush left past the map's boundary, selected and deleted.
import { open, exportTo } from './.spill-lib-local.mjs';
const [src, out] = process.argv.slice(2);
const { b, page } = await open(src);
const ids = await page.evaluate(() => { const d = window.__editor.doc, bd = d.bounds; return d.entities.filter((e) => e.kind === 'prop' && (e.position[0] < bd.min[0] || e.position[0] > bd.max[0] || e.position[2] < bd.min[1] || e.position[2] > bd.max[1])).map((e) => e.id); });
await page.evaluate((ids) => window.__editor.setSelection({ tiles: [], entities: ids }, true), ids);
await page.keyboard.press('Delete');
await page.waitForTimeout(600);
const left = await page.evaluate((ids) => window.__editor.doc.entities.filter((e) => ids.includes(e.id)).length, ids);
console.log('outside', ids.length, 'left', left);
if (left) throw new Error('not deleted');
await exportTo(page, out);
await b.close();
