// The taller dam: the dam's blocks, the towers and the lake raised in the inspector; rock on the new steep faces.
import { open, exportTo, setFields } from './.spill-lib-local.mjs';
import { DAM } from './.spill-shape-local.mjs';
const [src, out] = process.argv.slice(2);
const { b, page } = await open(src);
const ents = await page.evaluate(() => window.__editor.doc.entities.map((e) => ({ id: e.id, kind: e.kind, size: e.size, position: e.position })));
for (const e of ents) {
  if (e.kind === 'block' && e.size[0] === 56) await setFields(page, e.id, [['Thickness', DAM.crest, 'e.size[1]']]);
  else if (e.kind === 'block' && e.size[0] === 9) await setFields(page, e.id, [['Thickness', DAM.crest + 6 - 4, 'e.size[1]']]);
  else if (e.kind === 'water' && e.position[2] > 60) await setFields(page, e.id, [['Depth (deep)', DAM.water - 5, 'e.size[1]']]);
}
await page.evaluate(() => window.__editor.setSelection({ tiles: [], entities: [] }));
await page.evaluate(() => document.getElementById('ed-tr-cliffs').click());
await page.waitForTimeout(800);
console.log(JSON.stringify(await page.evaluate(() => window.__editor.doc.entities.map((e) => [e.kind, e.position, e.size]))));
await exportTo(page, out);
await b.close();
