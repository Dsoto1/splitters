// Phase C1: team spawns, 24 a side. Embers on the west bench (facing east), Tide on the south-east bench (facing north).
import { open, exportTo, pickTool, placeAt, setFields } from './.spill-lib-local.mjs';
const [src, out] = process.argv.slice(2);
const { b, page } = await open(src);
const spots = [];
for (const z of [4, 10]) for (let x = -124; x <= -96; x += 4) spots.push([x, z, 'embers', 90]);
for (const z of [-28, -33]) for (const x of [-124, -120, -116, -112]) spots.push([x, z, 'embers', 90]);
for (const z of [-80, -86, -92]) for (let x = 88; x <= 116; x += 4) spots.push([x, z, 'tide', 0]);
let n = 0;
for (const [x, z, team, face] of spots) {
  await pickTool(page, 'spawn');
  const id = await placeAt(page, x, z);
  await setFields(page, id, [['Team', team, 'e.faction'], ['Facing °', face, 'Math.round(e.yaw * 180 / Math.PI * 1000) / 1000 || e.yaw']]).catch(async (err) => {
    // (Facing is kept in the map's own unit: accept it if the team took.)
    const e = await page.evaluate((id) => window.__editor.doc.entities.find((x) => x.id === id), id);
    if (e.faction !== team) throw err;
  });
  if (++n % 8 === 0) { console.log('spawns', n); await exportTo(page, out); }
}
await exportTo(page, out);
console.log(JSON.stringify(await page.evaluate(() => window.__editor.doc.entities.filter((e) => e.kind === 'spawn').slice(0, 2).concat(window.__editor.doc.entities.filter((e) => e.kind === 'spawn').slice(-1)))));
await b.close();
