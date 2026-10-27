// Captures the automatic picture of every shipped map (retired maps excluded) for the map cards:
//   packages/client/public/maps/shots/<id>.jpg   640×360 JPEG, an in-game look at the map
// (The plan shown beside it is drawn live from the map: frontend/mapPlan.ts. Makers replace the
// picture with their own from MapMaker → Set thumbnail.)
//
// The camera is chosen, not fixed:
// 1. Candidate eye points across the play area (a grid at two heights, plus spawns, pickups and
//    objectives) are raised above the floor under them, kept under ceilings and out of geometry.
// 2. For each, 16 directions are scored by casting a fan of rays through the map's own collision
//    world: seeing far, seeing many distinct structures, looking across the play area toward its
//    middle and staying inside it score; anything solid within a few metres ahead, walls close by,
//    lots of sky or void lose.
// 3. The best few distinct views are rendered and scored again on the image itself (detail and
//    contrast; large flat areas — a wall, a blank sky, one material — lose). The best is kept.
// A map script can fix the camera with m.thumbnailCamera(position, target) (metadata.thumbnailCamera)
// where the automatic choice frames a poor view.
//
// Run against a built client being served (pnpm build, then vite preview):
//   pnpm --filter @tiletrigger/client exec vite preview --port 4799
//   node tools/content/capture-map-shots.mjs http://localhost:4799 [map ids…]
// SHOT_JOBS=2 captures maps in parallel; SHOT_CANDIDATES=<dir> also saves every rendered candidate there.
import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'packages/client/public/maps/shots');
const base = process.argv[2] ?? 'http://localhost:4799';
const only = process.argv.slice(3);
const CANDS = process.env.SHOT_CANDIDATES;
const retiredSrc = readFileSync(join(ROOT, 'packages/shared/src/map/retired.ts'), 'utf8');
const RETIRED = new Set([...retiredSrc.slice(retiredSrc.indexOf('new Set([')).matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]));
const ids = readdirSync(join(ROOT, 'maps'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5))
  .filter((id) => (only.length ? only.includes(id) : !RETIRED.has(id)));
mkdirSync(OUT, { recursive: true });
if (CANDS) mkdirSync(CANDS, { recursive: true });
/** Vertical field of view of the picture (radians). */
const FOV = 0.9;
/** How many of the best ray-scored views are rendered and judged on the image. */
const RENDERED = 3;

/**
 * Runs in the page: score candidate views through the match's physics world
 * (window.__match.physics) and return the best few distinct ones. Plain
 * function, serialised by Playwright.
 */
function chooseViews({ map, keep }) {
  const phys = window.__match.physics;
  const cell = map.classicStructure.cellSize;
  // The play area: the boundary, else what's built and placed.
  let a = map.bounds ? { x0: map.bounds.min[0], z0: map.bounds.min[1], x1: map.bounds.max[0], z1: map.bounds.max[1] } : null;
  if (!a) {
    a = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
    const grow = (x, z, r = 0) => {
      a.x0 = Math.min(a.x0, x - r);
      a.x1 = Math.max(a.x1, x + r);
      a.z0 = Math.min(a.z0, z - r);
      a.z1 = Math.max(a.z1, z + r);
    };
    for (const t of map.classicStructure.tiles) grow(t.x * cell, t.y * cell, cell / 2);
    for (const e of map.entities) if (e.kind === 'spawn' || e.kind === 'pickup') grow(e.position[0], e.position[2], 4);
    if (!Number.isFinite(a.x0)) a = { x0: -20, z0: -20, x1: 20, z1: 20 };
  }
  const cx = (a.x0 + a.x1) / 2;
  const cz = (a.z0 + a.z1) / 2;
  const w = a.x1 - a.x0;
  const d = a.z1 - a.z0;
  const diag = Math.hypot(w, d);
  const inside = (x, z, m = 0) => x >= a.x0 - m && x <= a.x1 + m && z >= a.z0 - m && z <= a.z1 + m;
  const down = { x: 0, y: -1, z: 0 };
  const up = { x: 0, y: 1, z: 0 };
  const TOP = 400;
  /** The boundary and invisible walls aren't seen: rays pass them as if they were the edge. */
  const solidHit = (o, dir, max) => {
    const h = phys.raycastNormal(o, dir, max);
    if (!h) return null;
    const box = phys.boxAt(h.handle);
    return { ...h, box, barrier: box?.kind === 'barrier' };
  };

  // Mostly indoors (most spawns under a roof): eye points come from where players stand.
  const spawns = map.entities.filter((e) => e.kind === 'spawn');
  const roofed = (p) => !!phys.raycastWorld({ x: p[0], y: p[1] + 1, z: p[2] }, up, 14);
  const indoor = spawns.length > 0 && spawns.filter((s) => roofed(s.position)).length / spawns.length > 0.6;

  const rise = Math.max(3, Math.min(12, diag * 0.04));
  const cands = [];
  // Raised above the floor; under a ceiling, half a metre below it (never under eye height). Not inside anything.
  const tryPoint = (x, z, floorY, wanted, tag) => {
    const roof = phys.raycastWorld({ x, y: floorY + 0.3, z }, up, wanted + 1);
    const h = roof === null ? wanted : Math.max(1.7, Math.min(wanted, roof + 0.3 - 0.6));
    const eye = { x, y: floorY + h, z };
    if (!phys.boxClear(eye, { x: 0.5, y: 0.5, z: 0.5 })) return;
    cands.push({ eye, tag, raised: h });
  };
  const N = 9;
  const tops = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = a.x0 + w * (0.06 + (0.88 * i) / (N - 1));
      const z = a.z0 + d * (0.06 + (0.88 * j) / (N - 1));
      const hit = solidHit({ x, y: TOP, z }, down, TOP * 2);
      if (hit && !hit.barrier) tops.push({ x, z, y: TOP - hit.dist, built: !!hit.box });
    }
  }
  // Not from on top of a building or a big rock (the roof fills the foreground): built surfaces
  // well above the map's usual ground are roofs. Terrain hills are fine.
  const ys = tops.map((t) => t.y).sort((p, q) => p - q);
  const ground = ys.length ? ys[Math.floor(ys.length / 2)] : 0;
  if (!indoor) {
    for (const t of tops) {
      if (t.built && t.y > ground + 2.5) continue;
      tryPoint(t.x, t.z, t.y, rise, 'grid');
      tryPoint(t.x, t.z, t.y, rise * 1.9, 'high');
    }
  }
  const spots = map.entities.filter((e) => e.kind === 'spawn' || e.kind === 'pickup' || e.kind === 'flag' || e.kind === 'hill' || e.kind === 'bombsite');
  const step = Math.max(1, Math.floor(spots.length / 60));
  for (let i = 0; i < spots.length; i += step) {
    const p = spots[i].position;
    if (!inside(p[0], p[2], 2)) continue;
    const hit = solidHit({ x: p[0], y: p[1] + 1, z: p[2] }, down, 4);
    const floorY = hit ? p[1] + 1 - hit.dist : p[1];
    tryPoint(p[0], p[2], floorY, indoor ? 3.2 : rise, 'spot');
  }
  if (!cands.length) tryPoint(cx, cz, 0, 3, 'centre');

  const YAWS = 16;
  const SPREAD = [-0.62, -0.46, -0.3, -0.15, 0, 0.15, 0.3, 0.46, 0.62];
  const R = Math.min(260, Math.max(30, diag * 0.9));
  const scoreView = (eye, yaw, pitch) => {
    let depth = 0;
    let depthN = 0;
    let near = 0;
    let blocked = 0;
    let sky = 0;
    let voids = 0;
    let inb = 0;
    let rays = 0;
    const seen = new Set();
    for (const off of [-0.34, -0.2, -0.08, 0.04, 0.18]) {
      const p = pitch + off;
      for (const s of SPREAD) {
        const y = yaw + s;
        const dir = { x: Math.sin(y) * Math.cos(p), y: Math.sin(p), z: Math.cos(y) * Math.cos(p) };
        const h = solidHit(eye, dir, R);
        rays++;
        if (!h) {
          if (p > 0.02) sky++;
          else if (p < -0.06) voids++;
          else depth += 1, depthN++;
          continue;
        }
        const hx = eye.x + dir.x * h.dist;
        const hz = eye.z + dir.z * h.dist;
        if (inside(hx, hz, 2)) inb++;
        const wall = Math.abs(h.normal.y) < 0.6;
        if (wall && h.dist < 4 && !h.barrier) near++;
        // Anything solid in the middle of the frame within a few metres: the view is blocked.
        if (Math.abs(s) <= 0.3 && off >= -0.2 && off <= 0.04 && h.dist < 6 && !h.barrier) blocked++;
        if (off >= -0.08) {
          depth += Math.min(1, h.dist / (R * 0.6));
          depthN++;
        }
        if (h.box && !h.barrier) seen.add(h.handle);
        else if (!h.box) seen.add(`t${Math.round(hx / 12)}_${Math.round(hz / 12)}`);
      }
    }
    const toC = Math.atan2(cx - eye.x, cz - eye.z);
    const farFromCentre = Math.hypot(cx - eye.x, cz - eye.z) > diag * 0.12;
    const align = farFromCentre ? (Math.cos(toC - yaw) + 1) / 2 : 0.6;
    const parts = {
      depth: depthN ? depth / depthN : 0,
      variety: Math.min(1, seen.size / 14),
      align,
      inb: inb / rays,
      near: near / rays,
      blocked: blocked / 15,
      sky: sky / rays,
      voids: voids / rays,
    };
    const score = 1.3 * parts.depth + 0.9 * parts.variety + 0.7 * parts.align + 0.5 * parts.inb - 3 * parts.near - 4 * parts.blocked - 1.5 * Math.max(0, parts.sky - 0.25) - 1.5 * parts.voids;
    return { score, parts };
  };
  const views = [];
  for (const c of cands) {
    // Look down a little more from higher up, so the ground fills the lower half.
    const pitch = -Math.min(0.42, 0.06 + c.raised * 0.018);
    for (let k = 0; k < YAWS; k++) {
      const yaw = (k / YAWS) * Math.PI * 2;
      views.push({ ...scoreView(c.eye, yaw, pitch), eye: c.eye, yaw, pitch, tag: c.tag });
    }
  }
  views.sort((p, q) => q.score - p.score);
  // The best few that differ: another place, or the same place facing well away.
  const picked = [];
  for (const v of views) {
    if (picked.length >= keep) break;
    if (picked.some((p) => Math.hypot(p.eye.x - v.eye.x, p.eye.z - v.eye.z) < diag * 0.12 && Math.cos(p.yaw - v.yaw) > 0.5)) continue;
    // Refine its yaw.
    let best = v;
    for (let k = -4; k <= 4; k++) {
      const yaw = v.yaw + (k * Math.PI) / 64;
      const s = scoreView(v.eye, yaw, v.pitch);
      if (s.score > best.score) best = { ...v, ...s, yaw };
    }
    picked.push(best);
  }
  return { views: picked, indoor, candidates: cands.length };
}

/**
 * How good a rendered picture looks, from the image alone: detail (edges) and
 * contrast score; large flat areas (a wall in the face, blank sky, one
 * material everywhere) lose.
 */
async function judge(png) {
  const W = 160;
  const H = 90;
  const { data } = await sharp(png).resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  let sq = 0;
  let edge = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = data[y * W + x];
      sum += v;
      sq += v * v;
      if (x + 1 < W && y + 1 < H) edge += Math.abs(v - data[y * W + x + 1]) + Math.abs(v - data[(y + 1) * W + x]);
    }
  }
  const n = W * H;
  const mean = sum / n;
  const std = Math.sqrt(Math.max(0, sq / n - mean * mean));
  edge /= (W - 1) * (H - 1);
  // 10×10 blocks with (almost) no variation.
  let flat = 0;
  let blocks = 0;
  for (let by = 0; by < H; by += 10) {
    for (let bx = 0; bx < W; bx += 10) {
      let s = 0;
      let s2 = 0;
      for (let y = by; y < by + 10; y++) for (let x = bx; x < bx + 10; x++) (s += data[y * W + x]), (s2 += data[y * W + x] ** 2);
      const m = s / 100;
      if (Math.sqrt(Math.max(0, s2 / 100 - m * m)) < 3.5) flat++;
      blocks++;
    }
  }
  const parts = { edge, std, flat: flat / blocks, mean };
  const dark = mean < 35 ? (35 - mean) / 35 : 0;
  const score = 0.9 * Math.min(1, edge / 14) + 0.5 * Math.min(1, std / 55) - 1.4 * parts.flat - 0.8 * dark;
  return { score, parts };
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
async function captureOne(id) {
  const map = JSON.parse(readFileSync(join(ROOT, 'maps', `${id}.json`), 'utf8'));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('tiletrigger.graphics', 'medium');
      // The match on the page's own thread, so its physics world can be reached (window.__match).
      localStorage.setItem('tiletrigger.sim', 'main');
    } catch {}
  });
  const page = await ctx.newPage();
  const t0 = Date.now();
  try {
    await page.goto(`${base}/?offline=${id}`, { timeout: 600000 });
    await page.waitForFunction(() => window.__match && window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() === 'playing', null, { timeout: 600000 });
    await page.addStyleTag({ content: '#hud, #pause, #crosshair, #countdown, #loading-screen, #toast, .toast { display: none !important; }' });
    // Bots out of the way; the camera is ours from here.
    await page.evaluate(() => {
      const m = window.__match;
      for (const c of m.slots) if (c && c.slot !== window.__cs.slot) Object.assign(c, { alive: false, respawnTick: 1e12 });
    });
    // A few frames for the bots to leave the scene, then frames are drawn on demand (a software
    // renderer's render loop crawls under load).
    const f0 = await page.evaluate(() => window.__cs.view.scene.getFrameId());
    await page.waitForFunction((f0) => window.__cs.view.scene.getFrameId() > f0 + 3, f0, { timeout: 90000 }).catch(() => {});
    await page.evaluate(() => {
      window.__cs.view.scene.getEngine().stopRenderLoop();
      window.__photo = window.__cs.view.photoCamera();
    });
    const fixed = map.metadata.thumbnailCamera;
    let views;
    let info = '';
    if (fixed) {
      const [px, py, pz] = fixed.position;
      const [tx, ty, tz] = fixed.target;
      const yaw = Math.atan2(tx - px, tz - pz);
      const pitch = Math.atan2(ty - py, Math.hypot(tx - px, tz - pz));
      views = [{ eye: { x: px, y: py, z: pz }, yaw, pitch, tag: 'map script', score: 0, parts: {} }];
      info = 'camera from the map script';
    } else {
      const r = await page.evaluate(chooseViews, { map, keep: RENDERED });
      views = r.views;
      info = `${r.indoor ? 'indoor' : 'outdoor'}, ${r.candidates} eye points`;
    }
    let best = null;
    for (const [i, v] of views.entries()) {
      await page.evaluate(({ eye, yaw, pitch, fov }) => {
        const cam = window.__photo;
        cam.position.set(eye.x, eye.y, eye.z);
        const dir = { x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) };
        cam.setTarget(new cam.position.constructor(eye.x + dir.x * 10, eye.y + dir.y * 10, eye.z + dir.z * 10));
        cam.fov = fov;
      }, { ...v, fov: FOV });
      // Render until textures and models have streamed in (the first view waits longest).
      for (let n = 0; n < (i === 0 ? 12 : 5); n++) {
        const ready = await page.evaluate(() => {
          const scene = window.__cs.view.scene;
          scene.render();
          return scene.isReady();
        });
        if (ready && n >= 2) break;
        await page.waitForTimeout(600);
      }
      await page.evaluate(() => window.__cs.view.scene.render());
      const png = await page.screenshot({ type: 'png', timeout: 240000 });
      const img = await judge(png);
      const total = v.score + 1.6 * img.score;
      if (CANDS) await sharp(png).resize(480, 270).jpeg({ quality: 70 }).toFile(join(CANDS, `${id}-${i}.jpg`));
      const line = `  #${i} ${v.tag} rays ${v.score.toFixed(2)} image ${img.score.toFixed(2)} (edge ${img.parts.edge.toFixed(1)} std ${img.parts.std.toFixed(0)} flat ${img.parts.flat.toFixed(2)}) = ${total.toFixed(2)}`;
      if (!best || total > best.total) best = { total, png, v, i, line };
      console.log(`${id}${line}`);
    }
    const file = join(OUT, `${id}.jpg`);
    await sharp(best.png).resize(640, 360).jpeg({ quality: 74, mozjpeg: true }).toFile(file);
    const kb = statSync(file).size / 1024;
    const v = best.v;
    const cam = { position: [v.eye.x, v.eye.y, v.eye.z].map((n) => +n.toFixed(2)), target: [v.eye.x + Math.sin(v.yaw) * Math.cos(v.pitch) * 10, v.eye.y + Math.sin(v.pitch) * 10, v.eye.z + Math.cos(v.yaw) * Math.cos(v.pitch) * 10].map((n) => +n.toFixed(2)) };
    results.push({ id, pick: best.i, cam });
    console.log(`${id}: ok #${best.i} ${kb.toFixed(0)} KB (${info}; ${((Date.now() - t0) / 1000).toFixed(0)} s) camera ${JSON.stringify(cam)}`);
  } catch (e) {
    console.log(`${id}: FAILED ${String(e).slice(0, 200)}`);
  }
  await ctx.close();
}
const queue = [...ids];
await Promise.all(
  Array.from({ length: Math.max(1, Number(process.env.SHOT_JOBS) || 1) }, async () => {
    for (let id = queue.shift(); id; id = queue.shift()) await captureOne(id);
  }),
);
await browser.close();
