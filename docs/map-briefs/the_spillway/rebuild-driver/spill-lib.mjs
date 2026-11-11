// Shared helpers for The Spillway's rebuild driver: the real MapMaker of a vite preview build, worked as a person does.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
export const PORT = process.env.PORT ?? '4986';
export async function open(file) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(`http://localhost:${PORT}/?mode=editor`);
  await page.waitForFunction(() => window.__editor, null, { timeout: 120000 });
  await page.setInputFiles('#ed-import-file', file);
  const id = JSON.parse(readFileSync(file, 'utf8')).metadata.id;
  await page.waitForFunction((id) => window.__editor.doc.metadata.id === id, id, { timeout: 60000 });
  return { b, page };
}
/** Export (the top bar's button) to a file, as MapMaker writes it. */
export async function exportTo(page, out) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => document.getElementById('ed-export').click())]);
  writeFileSync(out, readFileSync(await download.path(), 'utf8'));
}
/** The camera straight over a point, high enough to see `span` metres across. */
export async function overhead(page, x, z, height) {
  await page.evaluate(([x, z, h]) => { const v = window.__editor.view; v.pitch = -1.5; v.yaw = 0; v.applyCamera(); v.camera.position.set(x, h, z - h * 0.0708); }, [x, z, height]);
  await page.waitForTimeout(400);
}
export const project = (page, x, y, z) => page.evaluate(([x, y, z]) => window.__editor.view.project({ x, y, z }), [x, y, z]);
export const heightAt = (page, x, z) => page.evaluate(([x, z]) => { const t = window.__editor.doc.terrain; const c = Math.round((x - t.origin[0]) / t.spacing), r = Math.round((z - t.origin[1]) / t.spacing); return t.baseY + t.heights[r * t.cols + c] / 100; }, [x, z]);
/**
 * An inspector row by its label (the first match in the document): type a value into its field, as a person does.
 * The inspector redraws after each edit, so the row is looked up afresh every time.
 */
export async function setRow(page, label, value) {
  const ok = await page.evaluate(([label, value]) => {
    const r = [...document.querySelectorAll('.row')].find((r) => r.firstChild?.textContent?.trim() === label && r.offsetParent !== null) ?? [...document.querySelectorAll('.row')].find((r) => r.firstChild?.textContent?.trim() === label);
    const c = r?.querySelector('input, select');
    if (!c) return false;
    if (c.type === 'checkbox') { if (c.checked !== !!value) c.click(); return true; }
    c.value = String(value);
    c.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, [label, value]);
  if (!ok) throw new Error(`no row "${label}"`);
  await page.waitForTimeout(120);
}

/** Pick a palette tool by its key (a click on its button). */
export async function pickTool(page, key) {
  const ok = await page.evaluate((key) => { const b = document.querySelector(`[data-tool="${key}"]`); if (!b) return false; b.click(); return true; }, key);
  if (!ok) throw new Error(`no tool ${key}`);
  await page.waitForTimeout(150);
}

/** The camera over (x, z), `h` up, looking straight down. */
export async function lookDown(page, x, z, h = 120) {
  await page.evaluate(([x, z, h]) => { const v = window.__editor.view; v.pitch = -1.5; v.yaw = 0; v.applyCamera(); v.camera.position.set(x, h, z - h * 0.0708); }, [x, z, h]);
  await page.waitForTimeout(350);
}

/**
 * Place one thing with the tool in hand: a click on the ground at (x, z) with the view over it; returns the new
 * entity's id (the one the map didn't have before the click).
 */
export async function placeAt(page, x, z) {
  await lookDown(page, x, z, 90);
  const before = await page.evaluate(() => window.__editor.doc.entities.map((e) => e.id));
  const y = await page.evaluate(([x, z]) => { const t = window.__editor.doc.terrain; if (!t) return 0; const c = Math.round((x - t.origin[0]) / t.spacing), r = Math.round((z - t.origin[1]) / t.spacing); return t.baseY + t.heights[r * t.cols + c] / 100; }, [x, z]);
  let p = await project(page, x, y, z);
  // (The view can still be settling after the last placement: look again until the point is mid-screen.)
  for (let i = 0; i < 5 && (p.x < 400 || p.x > 1000 || p.y < 200 || p.y > 700); i++) {
    await page.waitForTimeout(400);
    await lookDown(page, x, z, 90);
    p = await project(page, x, y, z);
  }
  // A person's click: the pointer arrives, rests, presses and lets go (a click fired in one instant places nothing).
  await page.mouse.move(p.x - 3, p.y - 3);
  await page.waitForTimeout(250);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(450);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(600);
  const id = await page.evaluate((before) => window.__editor.doc.entities.map((e) => e.id).find((i) => !before.includes(i)) ?? null, before);
  if (!id) throw new Error(`nothing placed at ${x}, ${z}`);
  return id;
}

/**
 * Set an entity's fields in the inspector, each checked on the entity and typed again if the inspector dropped it.
 * `fields`: [row label, value, (entity) => the value it should now have].
 */
export async function setFields(page, id, fields) {
  for (const [label, value, read] of fields) {
    let ok = false;
    for (let i = 0; i < 5 && !ok; i++) {
      await page.evaluate((id) => window.__editor.setSelection({ tiles: [], entities: [id] }, true), id);
      await page.waitForTimeout(200);
      await setRow(page, label, value);
      await page.waitForTimeout(300);
      const now = await page.evaluate(([id, fn]) => { const e = window.__editor.doc.entities.find((x) => x.id === id); return new Function('e', `return ${fn}`)(e); }, [id, read]);
      ok = typeof value === 'number' ? Math.abs(now - value) < 0.001 : now === value;
    }
    if (!ok) throw new Error(`${id}: ${label} didn't take ${value}`);
  }
}
