// Kit props part 1 follow-up: MapMaker's Replace all for the seven retired crates, barrels and boxes, on every
// official map that places them. The real editor (no ?test=1): import the map, select one of each retired prop,
// Replace all (the suggested family, Keep scale) in the prop inspector, undo and redo checked, Export.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const PORT = process.env.PORT ?? '4986';
const OUT = process.argv[2];
const only = process.argv.slice(3);
const NEW = ['prop.machine','prop.machine_window','prop.hopper','prop.hopper_tall','prop.piston','prop.scanner','prop.lever','prop.cog','prop.pipe_glass','prop.big_pipe','prop.workbench','prop.cone','prop.nc_cone'];
const AL = JSON.parse(readFileSync('content/kitprops.json', 'utf8')).aliases;
const TO = Object.fromEntries(NEW.map((k) => [k, AL[k].variant ? `${AL[k].model}#${AL[k].variant}` : AL[k].model]));
const maps = readdirSync('maps').filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).filter((id) => !only.length || only.includes(id));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = [];
for (const id of maps) {
  const text = readFileSync(`maps/${id}.json`, 'utf8');
  const orig = JSON.parse(text);
  const want = {};
  for (const e of orig.entities ?? []) if (e.kind === 'prop' && TO[e.model]) want[e.model] = (want[e.model] ?? 0) + 1;
  if (!Object.keys(want).length) continue;
  let ctx;
  try {
  ctx = await b.newContext({ viewport: { width: 1400, height: 820 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(`http://localhost:${PORT}/?mode=editor`);
  await page.waitForFunction(() => window.__editor, null, { timeout: 120000 });
  await page.setInputFiles('#ed-import-file', `maps/${id}.json`);
  await page.waitForFunction((id) => window.__editor.doc.metadata.id === id, id, { timeout: 60000 });
  const count = (model) => page.evaluate((m) => { const [id, v] = m.split('#'); return window.__editor.doc.entities.filter((e) => e.kind === 'prop' && e.model === id && (v === undefined ? true : (e.variant ?? 0) === Number(v))).length; }, model);
  const done = {};
  for (const [from, n] of Object.entries(want)) {
    const to = TO[from];
    const before = await count(to);
    await page.evaluate((m) => { const e = window.__editor.doc.entities.find((x) => x.kind === 'prop' && x.model === m); window.__editor.setSelection({ tiles: [], entities: [e.id] }, true); }, from);
    await page.waitForSelector('#ed-replace-all', { state: 'attached', timeout: 180000 });
    const offered = await page.$eval('#ed-replace-with', (s) => s.value);
    if (offered !== to) throw new Error(`${id}: ${from} offers ${offered}, not ${to}`);
    await page.selectOption('#ed-replace-size', 'scale');
    await page.evaluate(() => document.getElementById('ed-replace-all').click());
    if ((await count(from)) !== 0 || (await count(to)) !== before + n) throw new Error(`${id}: ${from} not replaced (${await count(from)} left)`);
    await page.locator('canvas').first().click({ position: { x: 5, y: 5 }, button: 'middle' }).catch(() => {});
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    if ((await count(from)) !== n) throw new Error(`${id}: undo of ${from} gave ${await count(from)}`);
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(300);
    if ((await count(from)) !== 0) throw new Error(`${id}: redo of ${from} left ${await count(from)}`);
    done[from] = n;
  }
  const [download] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => document.getElementById('ed-export').click())]);
  const exported = readFileSync(await download.path(), 'utf8');
  writeFileSync(`${OUT}/${id}.export.json`, exported);
  report.push({ id, done, total: Object.values(done).reduce((a, x) => a + x, 0), errors });
  console.log(JSON.stringify(report.at(-1)));
  await ctx.close();
  } catch (err) { console.log('FAILED', id, String(err).slice(0, 300)); report.push({ id, failed: String(err).slice(0, 300), total: 0 }); await ctx?.close().catch(() => {}); }
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log('maps', report.length, 'placements', report.reduce((a, r) => a + r.total, 0));
await b.close();
