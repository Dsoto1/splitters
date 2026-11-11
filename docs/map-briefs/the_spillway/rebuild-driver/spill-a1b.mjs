// The playable boundary out to the new ground (Map properties → Boundary), 4 m inside the terrain's edge.
import { open, exportTo, setRow } from './.spill-lib-local.mjs';
const [src, out] = process.argv.slice(2);
const { b, page } = await open(src);
await page.evaluate(() => window.__editor.setSelection({ tiles: [], entities: [] }));
for (const [label, v, at] of [['West (X)', -156, ['min', 0]], ['East (X)', 156, ['max', 0]], ['South (Z)', -156, ['min', 1]], ['North (Z)', 156, ['max', 1]]]) {
  for (let i = 0; i < 4; i++) {
    await setRow(page, label, v);
    await page.waitForTimeout(600);
    if ((await page.evaluate(([k, j]) => window.__editor.doc.bounds[k][j], at)) === v) break;
  }
}
console.log(JSON.stringify(await page.evaluate(() => window.__editor.doc.bounds)));
await exportTo(page, out);
await b.close();
