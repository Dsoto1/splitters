import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { describe, expect, it } from 'vitest';
import { CORE_WEAPONS } from '../src/index.ts';

/**
 * How much of the screen the gun in your hands covers at rest (docs/MOBILE_AUDIT.md, "Viewmodels"). The Quaternius
 * sci-fi guns are tall, solid blocks; at the rifle's place the Flak Cannon covered 13.8 % of a 16:9 screen and the
 * Laser Rifle 17 % (the rifle 5 %), a grey wall over the right of the view that phones (whose touch buttons sit there
 * too) showed worst. Every weapon you carry in a slot now stays within VIEWMODEL_BUDGET at its `viewOffset`.
 *
 * The model's triangles are drawn into a 160 × 90 grid from the eye with the game's field of view (view.ts
 * DEFAULT_FOV, vertical), the gun at `viewOffset` in camera space as View.updateViewmodel places it (no bob, recoil
 * or aiming). Points nearer than the camera's near plane (0.1 m) are held at it. Mounted guns, sentries and vehicle
 * guns (slot 0) and guns drawn in code are not held in your hands.
 */
const VIEWMODEL_BUDGET = 11;
const FOV = 1.35;
const W = 160;
const H = 90;
const PUBLIC = join(__dirname, '../../client/public/models');

type Tri = [number, number, number][];

async function triangles(io: NodeIO, model: string): Promise<Tri[]> {
  const doc = await io.read(join(PUBLIC, model));
  const out: Tri[] = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const idx = prim.getIndices();
      const pts: [number, number, number][] = [];
      const e: number[] = [];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, e);
        const [x, y, z] = e as [number, number, number];
        pts.push([m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]);
      }
      const n = idx ? idx.getCount() : pos.getCount();
      for (let t = 0; t + 2 < n; t += 3) out.push([0, 1, 2].map((k) => pts[idx ? idx.getScalar(t + k) : t + k]!) as Tri);
    }
  }
  return out;
}

/** Per cent of a 16:9 screen the triangles cover with the model at `offset` in camera space. */
export function screenCover(tris: readonly Tri[], [vx, vy, vz]: readonly [number, number, number]): number {
  const t = Math.tan(FOV / 2);
  const aspect = W / H;
  const grid = new Uint8Array(W * H);
  const proj = (p: [number, number, number]): [number, number] => {
    const z = Math.max(0.1, p[2] + vz);
    return [(((p[0] + vx) / (z * t * aspect)) * 0.5 + 0.5) * W, (0.5 - ((p[1] + vy) / (z * t)) * 0.5) * H];
  };
  const edge = (a: [number, number], b: [number, number], px: number, py: number) => (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
  for (const tri of tris) {
    const [a, b, c] = tri.map(proj) as [[number, number], [number, number], [number, number]];
    const area = edge(a, b, c[0], c[1]);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const u = edge(a, b, x + 0.5, y + 0.5) / area;
        const v = edge(b, c, x + 0.5, y + 0.5) / area;
        const w = edge(c, a, x + 0.5, y + 0.5) / area;
        if (u >= 0 && v >= 0 && w >= 0) grid[y * W + x] = 1;
      }
    }
  }
  let covered = 0;
  for (const g of grid) covered += g;
  return (100 * covered) / grid.length;
}

describe('first-person guns', () => {
  it(`every gun you carry covers at most ${VIEWMODEL_BUDGET} % of the screen at rest`, async () => {
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    const held = Object.values(CORE_WEAPONS).filter((w) => w.slot !== 0 && !w.view.model.startsWith('procedural/'));
    expect(held.length).toBeGreaterThan(30);
    const cache = new Map<string, Tri[]>();
    const over: string[] = [];
    const covers: Record<string, number> = {};
    for (const w of held) {
      let tris = cache.get(w.view.model);
      if (!tris) cache.set(w.view.model, (tris = await triangles(io, w.view.model)));
      const c = screenCover(tris, w.view.viewOffset);
      covers[w.id] = c;
      if (c > VIEWMODEL_BUDGET) over.push(`${w.id} ${c.toFixed(1)} %`);
    }
    expect(over).toEqual([]);
    // The reference points: the rifle stays slim, the Flak Cannon now under the budget.
    expect(covers['core.rifle']).toBeLessThan(7);
    expect(covers['core.flak']).toBeLessThan(VIEWMODEL_BUDGET);
  }, 60000);
});
