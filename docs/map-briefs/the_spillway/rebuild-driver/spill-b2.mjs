// Phase B2: a doorway into each stair tower's lobby from the toe terrace (the wall tool, Door, on the lobby's south side).
import { open, exportTo, project, pickTool } from './.spill-lib-local.mjs';
const [src, out] = process.argv.slice(2);
const { b, page } = await open(src);
// The view from the terrace, facing the lobby's south wall (the wall tool points at the wall itself).
const look = async (x, z, h) => { await page.evaluate(([x, z, h]) => { const v = window.__editor.view; v.yaw = 0; v.pitch = 0; v.applyCamera(); v.camera.position.set(x, h, z); }, [x, z, h]); await page.waitForTimeout(500); };
const lobby = (cx) => page.evaluate((cx) => JSON.stringify(window.__editor.doc.classicStructure.tiles.find((t) => t.tile === 'core.corridor' && t.x === cx)?.edges ?? null), cx);
await page.evaluate(() => window.__editor.setLevel(1, true));
for (const cx of [-5, 5]) {
  await pickTool(page, 'edge:door');
  const wx = cx * 8, wz = 36, wy = 5.6;
  let p;
  for (let i = 0; i < 8; i++) { await look(wx, 22, 5.6); p = await project(page, wx, wy, wz); if (p.x > 400 && p.x < 1000 && p.y > 200 && p.y < 700) break; await page.waitForTimeout(500); }
  await page.mouse.move(p.x - 3, p.y - 3); await page.waitForTimeout(250);
  await page.mouse.move(p.x, p.y); await page.waitForTimeout(450);
  await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up(); await page.waitForTimeout(600);
  const e = await lobby(cx);
  console.log('lobby', cx, e);
  if (!e || !e.includes('door')) throw new Error(`no door on lobby ${cx}`);
}
await exportTo(page, out);
await b.close();
