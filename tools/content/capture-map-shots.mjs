// Captures two pictures of every shipped map for the map picker:
//   packages/client/public/maps/shots/<id>-top.jpg   the play area from straight above (orthographic)
//   packages/client/public/maps/shots/<id>-view.jpg  a look across the map from the spawn nearest its middle
// Run against a built client being served (pnpm build, then vite preview):
//   node tools/content/capture-map-shots.mjs http://localhost:4799 [map ids…]
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'packages/client/public/maps/shots');
const base = process.argv[2] ?? 'http://localhost:4799';
const only = process.argv.slice(3);
const offlineKeys = { phase0_arena: 'arena', m3_vault: 'vault', m4_outpost: 'outpost' };
const ids = readdirSync(join(ROOT, 'maps')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).filter((id) => !only.length || only.includes(id));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const id of ids) {
  const map = JSON.parse(readFileSync(join(ROOT, 'maps', `${id}.json`), 'utf8'));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('tiletrigger.graphics', 'medium');
    } catch {}
  });
  const page = await ctx.newPage();
  try {
    await page.goto(`${base}/?offline=${offlineKeys[id] ?? id}`);
    await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() === 'playing', null, { timeout: 180000 });
    await page.addStyleTag({ content: '#hud, #pause, #crosshair, #countdown, #loading-screen { display: none !important; }' });
    // Bots out of the way; the camera is ours from here.
    const area = await page.evaluate((map) => {
      const m = window.__match;
      for (const c of m.slots) if (c && c.slot !== window.__cs.slot) Object.assign(c, { alive: false, respawnTick: 1e12 });
      const tiles = map.classicStructure.tiles;
      const cell = map.classicStructure.cellSize;
      let a = map.bounds ? { x0: map.bounds.min[0], z0: map.bounds.min[1], x1: map.bounds.max[0], z1: map.bounds.max[1] } : null;
      if (!a) {
        a = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
        for (const t of tiles) {
          a.x0 = Math.min(a.x0, t.x * cell - cell / 2);
          a.x1 = Math.max(a.x1, t.x * cell + cell / 2);
          a.z0 = Math.min(a.z0, t.y * cell - cell / 2);
          a.z1 = Math.max(a.z1, t.y * cell + cell / 2);
        }
      }
      return a;
    }, map);
    const cx = (area.x0 + area.x1) / 2;
    const cz = (area.z0 + area.z1) / 2;
    await page.waitForTimeout(4000);

    // From above: an orthographic camera fitted to the play area.
    await page.evaluate(({ area, cx, cz }) => {
      const view = window.__cs.view;
      const cam = view.photoCamera();
      const w = area.x1 - area.x0 + 4;
      const d = area.z1 - area.z0 + 4;
      const aspect = 1280 / 720;
      const half = Math.max(w / 2 / aspect, d / 2);
      cam.mode = 1;
      cam.orthoTop = half;
      cam.orthoBottom = -half;
      cam.orthoLeft = -half * aspect;
      cam.orthoRight = half * aspect;
      cam.position.set(cx, 400, cz);
      cam.upVector.set(0, 0, 1);
      cam.rotation.set(Math.PI / 2, 0, 0);
      cam.maxZ = 1000;
      view.scene.fogMode = 0;
      // Just the play area: the backdrop (scenery, ground beyond, sky) hidden, on a dark ground.
      window.__hidden = view.scene.meshes.filter((m) => /^backdrop_/.test(m.name) && m.isEnabled());
      for (const m of window.__hidden) m.setEnabled(false);
      window.__clear = view.scene.clearColor.clone();
      view.scene.clearColor.set(0.05, 0.075, 0.13, 1);

    }, { area, cx, cz });
    await page.waitForTimeout(6000);
    const top = await page.screenshot({ type: 'png', timeout: 240000 });
    await sharp(top).resize(640, 360).jpeg({ quality: 78, mozjpeg: true }).toFile(join(OUT, `${id}-top.jpg`));

    // Across the map: from the spawn nearest the middle, eye height plus a little, toward the farther side.
    const spawns = map.entities.filter((e) => e.kind === 'spawn');
    const s = spawns.sort((a, b) => Math.hypot(a.position[0] - cx, a.position[2] - cz) - Math.hypot(b.position[0] - cx, b.position[2] - cz))[0];
    const from = s ? s.position : [cx, 0, cz];
    const toX = Math.abs(from[0] - cx) + Math.abs(from[2] - cz) < 6 ? (area.x1 - area.x0 > area.z1 - area.z0 ? area.x1 : cx) : cx;
    const toZ = Math.abs(from[0] - cx) + Math.abs(from[2] - cz) < 6 ? (area.x1 - area.x0 > area.z1 - area.z0 ? cz : area.z1) : cz;
    await page.evaluate(({ from, toX, toZ }) => {
      const view = window.__cs.view;
      for (const m of window.__hidden) m.setEnabled(true);
      view.scene.clearColor = window.__clear;
      const cam = view.photoCamera();
      cam.position.set(from[0], from[1] + 2.6, from[2]);
      cam.setTarget(new cam.position.constructor(toX, from[1] + 1.2, toZ));
      cam.fov = 1.15;
    }, { from, toX, toZ });
    await page.waitForTimeout(6000);
    const shot = await page.screenshot({ type: 'png', timeout: 240000 });
    await sharp(shot).resize(640, 360).jpeg({ quality: 78, mozjpeg: true }).toFile(join(OUT, `${id}-view.jpg`));
    console.log(`${id}: ok`);
  } catch (e) {
    console.log(`${id}: FAILED ${String(e).slice(0, 160)}`);
  }
  await ctx.close();
}
await browser.close();
