// Phase A1: sculpt the gorge with the Flatten brush at typed heights, where the ground is off the design.
// node .spill-a1-local.mjs <in.json> <out.json> <spacing> <radius> <tolerance> <hold ms>
import { open, exportTo, project, heightAt } from './.spill-lib-local.mjs';
import { height } from './.spill-shape-local.mjs';
const [src, out, SP, RAD, TOL, HOLD, TILE_ARG, CAM_ARG] = process.argv.slice(2).map((v, i) => (i < 2 ? v : Number(v)));
const { b, page } = await open(src);
const set = (id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
await page.evaluate(() => document.querySelector('[data-tool="terrain:flatten"]').click());
await set('ed-tr-radius', RAD);
await set('ed-tr-strength', 100);
// The view over one part of the map at a time, so the brush always works in the clear middle of the screen.
const TILE = TILE_ARG || 96;
const CAM = CAM_ARG || 250;
let dabs = 0, seen = 0, done = 0, moved = false;
const t0 = Date.now();
for (let tz = -160; tz < 160; tz += TILE) {
  for (let tx = -160; tx < 160; tx += TILE) {
    if (process.env.SKIP_TILES && done++ < Number(process.env.SKIP_TILES)) continue;
    const cx = tx + TILE / 2, cz = tz + TILE / 2;
    await page.evaluate(([x, z, h]) => { const v = window.__editor.view; v.pitch = -1.5; v.yaw = 0; v.applyCamera(); v.camera.position.set(x, h, z - h * 0.0708); }, [cx, cz, CAM]);
    await page.waitForTimeout(500);
    for (let z = tz; z < Math.min(160.01, tz + TILE); z += SP) {
      for (let x = tx; x < Math.min(160.01, tx + TILE); x += SP) {
        seen++;
        const want = height(x, z);
        const now = await heightAt(page, x, z);
        if (Math.abs(now - want) <= TOL) continue;
        await set('ed-tr-flatten-y', want);
        let p = await project(page, x, now, z);
        if (p.x < 340 || p.x > 1000 || p.y < 150 || p.y > 820) {
          // Under a panel: bring the view over this point, then back for the rest of the part.
          await page.evaluate(([x, z, h]) => { const v = window.__editor.view; v.camera.position.set(x, h, z - h * 0.0708); }, [x, z, CAM]);
          await page.waitForTimeout(250);
          p = await project(page, x, now, z);
          moved = true;
        }
        await page.mouse.move(p.x, p.y);
        await page.waitForTimeout(60);
        await page.mouse.down();
        await page.waitForTimeout(HOLD);
        await page.mouse.up();
        dabs++;
        if (moved) {
          await page.evaluate(([x, z, h]) => { const v = window.__editor.view; v.camera.position.set(x, h, z - h * 0.0708); }, [cx, cz, CAM]);
          await page.waitForTimeout(250);
          moved = false;
        }
      }
    }
    console.log(`tile ${tx},${tz}: ${dabs} dabs of ${seen} points, ${Math.round((Date.now() - t0) / 1000)} s`);
    await exportTo(page, out);
  }
}
// How far the ground is from the design now.
let worst = 0, sum = 0, n = 0;
for (let z = -160; z <= 160; z += 8) for (let x = -160; x <= 160; x += 8) { const e = Math.abs((await heightAt(page, x, z)) - height(x, z)); worst = Math.max(worst, e); sum += e; n++; }
console.log(`done: ${dabs} dabs; error avg ${(sum / n).toFixed(2)} m, worst ${worst.toFixed(1)} m`);
await exportTo(page, out);
await b.close();
