// Flatten a stray spike: Flatten dabs at a typed height round a point.
import { open, exportTo, project, heightAt, pickTool, lookDown } from './.spill-lib-local.mjs';
const [src, out, X, Z, Y, R] = process.argv.slice(2).map((v, i) => (i < 2 ? v : Number(v)));
const { b, page } = await open(src);
const set = (id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
await pickTool(page, 'terrain:flatten');
await set('ed-tr-radius', R);
await set('ed-tr-strength', 100);
await set('ed-tr-flatten-y', Y);
await lookDown(page, X, Z, 150);
for (let pass = 0; pass < 2; pass++) for (const [dx, dz] of [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6], [5, 5], [-5, -5], [5, -5], [-5, 5]]) {
  const p = await project(page, X + dx, await heightAt(page, X + dx, Z + dz), Z + dz);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(80);
  await page.mouse.down();
  await page.waitForTimeout(1200);
  await page.mouse.up();
}
console.log('now', await heightAt(page, X, Z), await heightAt(page, X + 4, Z), await heightAt(page, X, Z + 6));
await exportTo(page, out);
await b.close();
