// Contact faces of every placeable prop (docs/LOOK.md, "No flicker: props"): the flat parts of a prop's model that lie
// in one of the six planes of its bounding box, where it meets a floor, a wall, a ceiling or another prop. Two drawn
// faces in one plane fight (z-fighting: the texture flicker), so the z-fighting audit (packages/shared/test/zfight.test.ts)
// and the drawn lift of props stacked flush on other props (propFlushLift, shared/src/map/propFaces.ts) read these.
//
// For each bounding-box plane, the model's triangles lying in it (within PLANE_TOL) are grouped by which way they face
// (+axis, -axis, or both: a double-sided material), with their area and bounds. Only groups of at least MIN_AREA count.
// Units: metres at scale 1, in the prop's space as the game draws it (centred on its footprint, standing on y = 0,
// facing +Z before its yaw; x mirrored from the GLB as Babylon's glTF import draws it). Levels of detail are left out.
//
//   node tools/content/prop-contacts.mjs          write packages/shared/src/content/propContacts.generated.ts
//   node tools/content/prop-contacts.mjs --check  fail when it is out of date (pnpm content:check runs this)
//   node tools/content/prop-contacts.mjs --print [ids…]

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const OUT_FILE = join(ROOT, 'packages/shared/src/content/propContacts.generated.ts');
const TABLE = join(ROOT, 'packages/shared/src/content/props.generated.ts');
const KIT_TABLE = join(ROOT, 'packages/shared/src/content/kitProps.generated.ts');
const PUBLIC = join(ROOT, 'packages/client/public');
/** A triangle lies in a bounding-box plane when all three corners are this close to it (m). */
const PLANE_TOL = 0.001;
/** Groups smaller than this (m²) are left out: a speck can't be seen fighting. */
const MIN_AREA = 0.0005;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const r4 = (v) => {
  const x = Math.round(v * 1e4) / 1e4;
  return Object.is(x, -0) ? 0 : x;
};

/** Every triangle of the model's full-detail meshes, in the drawn prop space, with whether its material is double-sided. */
async function triangles(file) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const out = [];
  const lodOf = (o) => (o?.getExtras?.() ?? {}).lod;
  const visit = (node) => {
    if (lodOf(node)) return;
    const mesh = node.getMesh();
    if (mesh && !lodOf(mesh)) {
      const w = node.getWorldMatrix();
      const det = w[0] * (w[5] * w[10] - w[6] * w[9]) - w[4] * (w[1] * w[10] - w[2] * w[9]) + w[8] * (w[1] * w[6] - w[2] * w[5]);
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMode() !== 4) continue;
        const pos = prim.getAttribute('POSITION');
        if (!pos) continue;
        const two = !!prim.getMaterial()?.getDoubleSided();
        const v = [0, 0, 0];
        const P = [];
        for (let i = 0; i < pos.getCount(); i++) {
          pos.getElement(i, v);
          // World (GLB) space, then x mirrored as the game draws it.
          P.push([-(w[0] * v[0] + w[4] * v[1] + w[8] * v[2] + w[12]), w[1] * v[0] + w[5] * v[1] + w[9] * v[2] + w[13], w[2] * v[0] + w[6] * v[1] + w[10] * v[2] + w[14]]);
        }
        const idx = prim.getIndices()?.getArray() ?? P.map((_, i) => i);
        for (let i = 0; i + 2 < idx.length; i += 3) {
          const a = P[idx[i]];
          let b = P[idx[i + 1]];
          let c = P[idx[i + 2]];
          // The mirror (and a mirrored node) turns the winding: keep the front face's normal by the cross product.
          if (det > 0) [b, c] = [c, b];
          out.push({ a, b, c, two });
        }
      }
    }
    for (const ch of node.listChildren()) visit(ch);
  };
  for (const n of scene.listChildren()) visit(n);
  return out;
}

/** Contact groups of one model: [axis, side, facing, area, x0, y0, z0, x1, y1, z1]. */
export async function contactsOf(file) {
  const tris = await triangles(file);
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (const q of [t.a, t.b, t.c]) for (let k = 0; k < 3; k++) {
    mn[k] = Math.min(mn[k], q[k]);
    mx[k] = Math.max(mx[k], q[k]);
  }
  const groups = [];
  for (let k = 0; k < 3; k++) {
    for (const [side, plane] of [[-1, mn[k]], [1, mx[k]]]) {
      const acc = new Map();
      for (const t of tris) {
        if (!(Math.abs(t.a[k] - plane) < PLANE_TOL && Math.abs(t.b[k] - plane) < PLANE_TOL && Math.abs(t.c[k] - plane) < PLANE_TOL)) continue;
        const u = [0, 1, 2].map((j) => t.b[j] - t.a[j]);
        const w = [0, 1, 2].map((j) => t.c[j] - t.a[j]);
        const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
        const area = Math.hypot(n[0], n[1], n[2]) / 2;
        if (area < 1e-9) continue;
        const facing = t.two ? 0 : n[k] > 0 ? 1 : -1;
        let g = acc.get(facing);
        if (!g) acc.set(facing, (g = { area: 0, lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] }));
        g.area += area;
        for (const q of [t.a, t.b, t.c]) for (let j = 0; j < 3; j++) {
          g.lo[j] = Math.min(g.lo[j], q[j]);
          g.hi[j] = Math.max(g.hi[j], q[j]);
        }
      }
      for (const facing of [1, -1, 0]) {
        const g = acc.get(facing);
        if (!g || g.area < MIN_AREA) continue;
        // The plane itself, exactly (the bounds' own coordinate on that axis).
        g.lo[k] = g.hi[k] = plane;
        groups.push([k, side, facing, g.area, ...g.lo, ...g.hi].map(r4));
      }
    }
  }
  return groups;
}

function propFiles() {
  const src = readFileSync(TABLE, 'utf8');
  const packs = [...src.matchAll(/\{id: '([^']+)', file: '([^']+)'/g)].map((m) => ({ id: m[1], file: m[2] }));
  // The kit families (tools/content/kitprops.mjs): their first variant (every variant fills the same bounds).
  const kit = existsSync(KIT_TABLE) ? [...readFileSync(KIT_TABLE, 'utf8').matchAll(/\{ id: '(kit\.[^']+)', file: '([^']+)'/g)].map((m) => ({ id: m[1], file: m[2] })) : [];
  return [...packs, ...kit];
}

export async function measureAll() {
  const out = [];
  for (const p of propFiles()) {
    const file = join(PUBLIC, p.file);
    if (!existsSync(file)) continue;
    const groups = await contactsOf(file);
    if (groups.length) out.push([p.id, groups]);
  }
  return out;
}

export function source(entries) {
  const L = [
    '// Generated by tools/content/prop-contacts.mjs from the built prop models. Do not edit by hand: run',
    '// `node tools/content/prop-contacts.mjs` (pnpm content:check fails until you do).',
    "import type { PropContact } from '../map/propFaces.ts';",
    '',
    '/**',
    ' * Contact faces of each prop (docs/LOOK.md, "No flicker: props"): its triangles lying in a plane of its bounding box,',
    ' * by which way they face, as [axis, side, facing, area, x0, y0, z0, x1, y1, z1] (PropContact). Loaded on demand:',
    ' * `@tiletrigger/shared/propContacts`, never from the shared index (the menu bundle).',
    ' */',
    'export const PROP_CONTACTS: Readonly<Record<string, readonly PropContact[]>> = {',
  ];
  for (const [id, groups] of entries) L.push(`  '${id}': [${groups.map((g) => `[${g.join(',')}]`).join(', ')}],`);
  L.push('};', '');
  return L.join('\n');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  if (args[0] === '--print') {
    const ids = new Set(args.slice(1));
    for (const p of propFiles()) if (!ids.size || ids.has(p.id)) console.log(p.id, JSON.stringify(await contactsOf(join(PUBLIC, p.file))));
  } else {
    const entries = await measureAll();
    const src = source(entries);
    if (args[0] === '--check') {
      const old = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf8') : '';
      if (old !== src) {
        console.error('propContacts.generated.ts is out of date: run node tools/content/prop-contacts.mjs');
        process.exit(1);
      }
      console.log(`prop contacts: ${entries.length} props, up to date`);
    } else {
      writeFileSync(OUT_FILE, src);
      console.log(`prop contacts: wrote ${entries.length} props to ${OUT_FILE}`);
    }
  }
}
