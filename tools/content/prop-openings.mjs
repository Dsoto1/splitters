// The openings audit (docs/CONTENT_PIPELINE.md, "Prop collision"): every placeable prop's collision against its
// model. Collision that fills an opening you can see or walk through (a window, a hole, an arch, a doorway, the space
// under a table or a bridge: closed in by the model, or by the model and the ground) a MIN_OPENING square fits in
// stops rounds in the air and blocks players there (voxel-collision.mjs filledOpenings). Such a prop collides as
// `voxel` (or `frame` / `openings`), or says in its entry why its collision fills the opening (`fills`: a stair
// flight solid underneath so players and bots walk up it, a lattice too fine for its box budget).
//
//   node tools/content/prop-openings.mjs           the list: each prop whose collision fills an opening (id, collide
//                                                   mode, the opening's size, the maps placing it solid) and each
//                                                   `fills` prop with its reason
//   node tools/content/prop-openings.mjs --json    the same as JSON
//   node tools/content/prop-openings.mjs --check   fail (pnpm content:check runs this) on a prop that fills an opening
//                                                   without a `fills` reason, a stale `fills`, a voxel prop over its
//                                                   box budget or not rebuilt, a trunk column off its trunk
//   node tools/content/prop-openings.mjs --slack   props whose collision holds air round their outline (not an
//                                                   opening: the box round a stump's roots, over a car's bonnet)
//   node tools/content/prop-openings.mjs --fixture <git ref>
//                                                   rewrite packages/shared/test/fixtures/prop-openings.json against
//                                                   the props as they were at that ref (those whose collision changed,
//                                                   and digests of the rest): after a deliberate collision change
//   ONLY=<id>,… limits it to those props.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { loadPropManifest } from './props-manifest.mjs';
import { filledOpenings, MIN_OPENING, sceneTriangles, trunkBoxes, voxelBudget } from './voxel-collision.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TABLE = join(ROOT, 'packages/shared/src/content/props.generated.ts');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** The generated prop table (props.generated.ts, or another copy of it), read as data. */
export function propTable(path = TABLE) {
  const src = readFileSync(path, 'utf8');
  const body = src.slice(src.indexOf('CORE_PROPS: readonly PropDefinition[] = [') + 'CORE_PROPS: readonly PropDefinition[] = '.length, src.lastIndexOf('];') + 1);
  return new Function(`return ${body}`)();
}

/** Natural rocks collide as two tiers (map/geometry.ts propBoxes): the same here. */
const isRock = (def) => def.category === 'Rocks & Wood' && /rock|boulder|stone|cliff/.test(def.id);

/** A prop's collision as the game builds it (map/geometry.ts propBoxes), in its own space as drawn: boxes, or null. */
export function gameBoxes(def) {
  if (!def.collision) return null;
  if (def.boxes) return def.boxes.map((b) => [...b]);
  const [w, h, d] = def.collision;
  if (isRock(def) && h > 0.3) {
    const low = Math.min(h * 0.5, 0.7);
    return [
      [-(w / 2) * 0.85, 0, -(d / 2) * 0.85, (w / 2) * 0.85, low, (d / 2) * 0.85],
      [-(w / 2) * 0.55, low, -(d / 2) * 0.55, (w / 2) * 0.55, h * 0.92, (d / 2) * 0.55],
    ];
  }
  if (isRock(def)) return null;
  return [[-w / 2, 0, -d / 2, w / 2, h, d / 2]];
}

/** The model's triangles as the game draws it (x mirrored, as the collision boxes are). */
async function drawnTriangles(file) {
  const doc = await io.read(join(ROOT, 'packages/client/public', file));
  return sceneTriangles(doc.getRoot().listScenes()[0]).map((t) => t.map(([x, y, z]) => [-x, y, z]));
}

/** Where each prop is placed solid: { 'prop.id': { map: count } }. */
export function placements() {
  const out = {};
  for (const f of readdirSync(join(ROOT, 'maps')).sort()) {
    if (!f.endsWith('.json')) continue;
    const m = JSON.parse(readFileSync(join(ROOT, 'maps', f), 'utf8'));
    for (const e of m.entities ?? []) {
      if (e.kind !== 'prop' || !e.solid) continue;
      const at = (out[e.model] ??= {});
      at[f.slice(0, -5)] = (at[f.slice(0, -5)] ?? 0) + 1;
    }
  }
  return out;
}

/** The audit: { rows (props whose collision fills an opening, or that say why it does), problems }. */
export async function audit({ only = null, slack = false } = {}) {
  const manifest = loadPropManifest();
  const entries = new Map(manifest.props.map((p) => [`prop.${p.id}`, p]));
  const used = placements();
  const rows = [];
  const problems = [];
  for (const def of propTable()) {
    const p = entries.get(def.id);
    if (!p || (only && !only.includes(p.id))) continue;
    const boxes = gameBoxes(def);
    if (!boxes) {
      if (p.fills) problems.push(`${p.id}: "fills" but it has no collision`);
      continue;
    }
    const tris = await drawnTriangles(def.file);
    const all = filledOpenings(tris, boxes, { slack });
    const openings = all.filter((o) => !o.slack);
    const mode = p.collide ?? 'box';
    if (mode === 'voxel') {
      if (!def.boxes) problems.push(`${p.id}: collide "voxel" but props.generated.ts has no boxes for it (run node tools/content/prepare-props.mjs)`);
      else if (def.boxes.length > voxelBudget(p)) problems.push(`${p.id}: ${def.boxes.length} collision boxes, over its budget of ${voxelBudget(p)} (set a coarser voxelCell or a bigger voxelAir, or a voxelBudget with a reason)`);
    }
    if (mode === 'trunk') {
      // The column the build makes now (prepare-props.mjs, trunkBoxes), in the game's frame.
      const want = trunkBoxes(tris.map((t) => t.map(([x, y, z]) => [-x, y, z])), def.size)?.map(([x0, y0, z0, x1, y1, z1]) => [-x1, y0, z0, -x0, y1, z1]) ?? null;
      const same = (a, b) => (!a && !b) || (!!a && !!b && a.length === b.length && a.every((x, i) => x.every((v, k) => Math.abs(v - b[i][k]) < 2e-3)));
      if (!same(want, def.boxes ?? null)) problems.push(`${p.id}: its trunk column is not where the trunk is (run node tools/content/prepare-props.mjs)`);
    }
    if (openings.length && !p.fills) problems.push(`${p.id}: its collision (${mode}) fills an opening ${openings[0].size.join(' × ')} m (along ${openings[0].axis}): collide "voxel", or say why in "fills"`);
    if (!openings.length && p.fills) problems.push(`${p.id}: "fills" but its collision fills no opening now (drop it)`);
    const loose = all.filter((o) => o.slack);
    if (openings.length || p.fills || loose.length) rows.push({ id: p.id, collide: mode, boxes: boxes.length, openings, ...(loose.length ? { slack: loose } : {}), ...(p.fills ? { fills: p.fills } : {}), maps: used[def.id] ?? {} });
  }
  return { rows, problems };
}

/** Does the ray from `p` along `d` meet triangle `t` (Moller-Trumbore)? */
function rayHits(p, d, [a, b, c]) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
  const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
  if (Math.abs(det) < 1e-12) return false;
  const s = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det;
  if (u < 0 || u > 1) return false;
  const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
  const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
  return v >= 0 && u + v <= 1 && (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det > 0;
}

/** A prop's collision (its catalogue `collision` and `boxes`), as a short digest (propOpenings.test.ts makes the same). */
export const collisionDigest = (def) => createHash('sha256').update(JSON.stringify({ collision: def.collision ?? null, boxes: def.boxes ?? null })).digest('hex').slice(0, 12);

const FIXTURE = join(ROOT, 'packages/shared/test/fixtures/prop-openings.json');
const r3 = (v) => Math.round(v * 1000) / 1000;

/**
 * The fixture of packages/shared/test/propOpenings.test.ts: every prop whose collision differs from the table at
 * `ref` (git: props.generated.ts and content/props as they were), with its collide mode then and now, its boxes then, probes
 * (straight lines through what its old collision filled, now clear) and points of its model its new collision holds;
 * and a digest of every other prop's collision (unchanged).
 */
async function writeFixture(ref) {
  // The table and the collide modes at `ref` (git), and now.
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 << 20 });
  const tmp = join(ROOT, 'node_modules/.cache/tiletrigger/props-before.generated.ts');
  mkdirSync(dirname(tmp), { recursive: true });
  writeFileSync(tmp, git('show', `${ref}:packages/shared/src/content/props.generated.ts`));
  const before = new Map(propTable(tmp).map((d) => [d.id, d]));
  const oldModes = new Map();
  for (const f of git('ls-tree', '--name-only', `${ref}:content/props`).split('\n').filter((n) => n.endsWith('.json')))
    for (const p of JSON.parse(git('show', `${ref}:content/props/${f}`)).props ?? []) oldModes.set(`prop.${p.id}`, p.collide ?? 'box');
  const entries = new Map(loadPropManifest().props.map((p) => [`prop.${p.id}`, p]));
  const modes = new Map([...entries].map(([id, p]) => [id, p.collide ?? 'box']));
  const changed = {};
  const unchanged = {};
  for (const def of propTable()) {
    const old = before.get(def.id);
    if (!old) continue;
    if (collisionDigest(old) === collisionDigest(def)) {
      unchanged[def.id] = collisionDigest(def);
      continue;
    }
    const tris = await drawnTriangles(def.file);
    const oldBoxes = gameBoxes(old) ?? [];
    const now = gameBoxes(def) ?? [];
    const blocks = (boxes, o, d, len) => boxes.some((b) => {
      let t0 = 0;
      let t1 = len;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(d[k]) < 1e-9) {
          if (o[k] <= b[k] || o[k] >= b[k + 3]) return false;
        } else {
          const [a, c] = [(b[k] - o[k]) / d[k], (b[k + 3] - o[k]) / d[k]];
          t0 = Math.max(t0, Math.min(a, c));
          t1 = Math.min(t1, Math.max(a, c));
        }
      }
      return t0 < t1;
    });
    // Probes: along x or z through the middle of each opening (and slack) the old collision filled.
    const lo = [0, 1, 2].map((k) => Math.min(...oldBoxes.map((b) => b[k]), ...now.map((b) => b[k])) - 1);
    const hi = [0, 1, 2].map((k) => Math.max(...oldBoxes.map((b) => b[k + 3]), ...now.map((b) => b[k + 3])) + 1);
    const probes = [];
    for (const o of filledOpenings(tris, oldBoxes, { slack: true })) {
      const k = o.axis === 'x' ? 0 : 2;
      const origin = k === 0 ? [lo[0], o.inner[1], o.inner[0]] : [o.inner[0], o.inner[1], lo[2]];
      const dir = k === 0 ? [1, 0, 0] : [0, 0, 1];
      const len = hi[k] - lo[k];
      if (!blocks(oldBoxes, origin, dir, len)) continue;
      if (blocks(now, origin, dir, len)) {
        console.warn(`  ${def.id}: still fills ${o.slack ? 'slack' : 'an opening'} ${o.size.join(' × ')} m along ${o.axis} at ${o.inner.join(', ')}`);
        continue;
      }
      probes.push([...origin, ...dir, len].map(r3));
    }
    // Points of the model the new collision holds: the middles of its largest faces (for a trunk column, the trunk's
    // middle low down, as the column only stands for the trunk).
    let solid;
    if (modes.get(def.id) === 'trunk') {
      // The trunk low down: the model's corners under 0.6 m inside the column, nearest its middle (none: the column
      // misses the model, which this whole change is against).
      const base = now.find((b) => b[1] === 0) ?? now[0];
      const mid = [(base[0] + base[3]) / 2, (base[2] + base[5]) / 2];
      // Points over each face (corners alone miss a long pole's middle).
      const pts = tris.flatMap((t) => [[1, 1, 1], [4, 1, 1], [1, 4, 1], [1, 1, 4]].map((w) => [0, 1, 2].map((k) => (w[0] * t[0][k] + w[1] * t[1][k] + w[2] * t[2][k]) / (w[0] + w[1] + w[2]))));
      const low = pts.filter((q) => q[1] > 0.05 && q[1] < 0.6 && now.some((b) => q[0] > b[0] && q[0] < b[3] && q[1] > b[1] && q[1] < b[4] && q[2] > b[2] && q[2] < b[5]));
      solid = low.sort((a, b) => Math.hypot(a[0] - mid[0], a[2] - mid[1]) - Math.hypot(b[0] - mid[0], b[2] - mid[1]) || a[1] - b[1]).slice(0, 4).map((q) => q.map(r3));
      // A column wholly inside a thick trunk holds no face of it: its middle low down, if the model closes round it.
      const inside = (p) => [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]].every((d) => tris.some((t) => rayHits(p, d, t)));
      const centre = [mid[0], 0.3, mid[1]];
      if (!solid.length && inside(centre)) solid = [centre.map(r3)];
      if (!solid.length) console.warn(`  ${def.id}: its trunk column holds none of its model low down`);
    } else {
      const area = (t) => {
        const u = [0, 1, 2].map((k) => t[1][k] - t[0][k]);
        const v = [0, 1, 2].map((k) => t[2][k] - t[0][k]);
        return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
      };
      const top = entries.get(def.id)?.shellTop ?? Infinity;
      solid = tris
        .filter((t) => Math.max(t[0][1], t[1][1], t[2][1]) <= top)
        .map((t, i) => [area(t), i, t])
        .sort((a, b) => b[0] - a[0] || a[1] - b[1])
        .slice(0, 8)
        .map(([, , t]) => [0, 1, 2].map((k) => r3((t[0][k] + t[1][k] + t[2][k]) / 3)));
    }
    changed[def.id] = {
      from: oldModes.get(def.id),
      to: modes.get(def.id),
      boxes: [oldBoxes.length, now.length],
      before: oldBoxes.map((b) => b.map(r3)),
      probes,
      solid,
    };
  }
  const out = {
    $comment: 'Props whose collision changed with voxel collision and trunk columns (tools/content/prop-openings.mjs --fixture <git ref before>): probes through what their old collision filled stay clear, points of their model stay inside it, and every other prop keeps its collision (digest). packages/shared/test/propOpenings.test.ts.',
    changed,
    unchanged,
  };
  // One prop a line (diffs stay readable).
  const lines = (o) => Object.entries(o).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n');
  writeFileSync(FIXTURE, `{\n "$comment": ${JSON.stringify(out.$comment)},\n "changed": {\n${lines(changed)}\n },\n "unchanged": {\n${lines(unchanged)}\n }\n}\n`);
  console.log(`wrote ${FIXTURE}: ${Object.keys(changed).length} changed, ${Object.keys(unchanged).length} unchanged`);
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes('--fixture')) {
  await writeFixture(process.argv[process.argv.indexOf('--fixture') + 1] ?? 'origin/main');
  process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const only = process.env.ONLY?.split(',').filter(Boolean) ?? null;
  const slack = process.argv.includes('--slack');
  const { rows, problems } = await audit({ only, slack });
  const maps = (r) => Object.entries(r.maps).map(([m, n]) => (n > 1 ? `${m} ×${n}` : m)).join(', ') || 'no map';
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
  else if (slack) {
    // Not openings: air round the outline inside the collision (the box round a stump's roots, over a car's bonnet).
    const loose = rows.filter((r) => r.slack).sort((a, b) => b.slack[0].square - a.slack[0].square);
    for (const r of loose) console.log(`${r.id.padEnd(30)} ${r.collide.padEnd(8)} ${r.slack[0].size.join(' × ')} m along ${r.slack[0].axis} (a ${r.slack[0].square} m square)  ${maps(r)}`);
    console.log(`${loose.length} props have slack a ${MIN_OPENING} m square fits in`);
  } else if (!process.argv.includes('--check')) {
    for (const r of rows.filter((r) => r.openings.length || r.fills)) {
      const o = r.openings[0];
      console.log(`${r.id.padEnd(30)} ${r.collide.padEnd(8)} ${o ? `${o.size.join(' × ')} m along ${o.axis}` : 'none'.padEnd(10)}  ${maps(r)}${r.fills ? `\n    fills: ${r.fills}` : ''}`);
    }
    console.log(`${rows.filter((r) => r.openings.length && !r.fills).length} props fill an opening, ${rows.filter((r) => r.fills).length} say why`);
  }
  if (problems.length) {
    for (const p of problems) console.error(`ERROR ${p}`);
    if (process.argv.includes('--check')) process.exit(1);
  } else if (process.argv.includes('--check')) console.log(`prop openings: ${rows.filter((r) => r.openings.length).length} props fill an opening, every one says why`);
}
