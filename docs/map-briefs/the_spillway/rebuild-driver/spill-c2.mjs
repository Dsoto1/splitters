// Phase C2: one Tide spawn stood in the slope's rock: deleted, and placed again on the bench's open ground.
import { open, exportTo, pickTool, placeAt, setFields } from './.spill-lib-local.mjs';
const [src, out] = process.argv.slice(2);
const { b, page } = await open(src);
const bad = await page.evaluate(() => window.__editor.doc.entities.find((e) => e.kind === 'spawn' && e.position[0] === 116 && e.position[2] === -80)?.id);
await page.evaluate((id) => window.__editor.setSelection({ tiles: [], entities: [id] }, true), bad);
await page.keyboard.press('Delete');
await page.waitForTimeout(400);
if (await page.evaluate((id) => window.__editor.doc.entities.some((e) => e.id === id), bad)) throw new Error('not deleted');
await pickTool(page, 'spawn');
const id = await placeAt(page, 84, -86);
await setFields(page, id, [['Team', 'tide', 'e.faction']]);
await exportTo(page, out);
console.log('moved', bad, id);
await b.close();
