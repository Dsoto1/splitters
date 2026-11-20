import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NodeIO, type Node as GltfNode } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { describe, expect, it } from 'vitest';
import type { WeaponHold } from '@tiletrigger/shared';
import { guardFrom, undersideAt } from '../src/game/guardUnderside.ts';

type P = [number, number, number];

/** Boxes (min, max corners) as triangles: 12 a box. */
function boxes(...list: [P, P][]): { positions: number[]; indices: number[] } {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const [a, b] of list) {
    const base = positions.length / 3;
    for (let i = 0; i < 8; i++) positions.push(i & 1 ? b[0] : a[0], i & 2 ? b[1] : a[1], i & 4 ? b[2] : a[2]);
    for (const f of [
      [0, 1, 3, 2],
      [4, 6, 7, 5],
      [0, 4, 5, 1],
      [2, 3, 7, 6],
      [0, 2, 6, 4],
      [1, 5, 7, 3],
    ]) indices.push(base + f[0]!, base + f[1]!, base + f[2]!, base + f[0]!, base + f[2]!, base + f[3]!);
  }
  return { positions, indices };
}

/** A rifle: a receiver, a handguard ahead of it (underside at y 0.02), a magazine under the receiver's front, a barrel inside the guard. */
const rifle = boxes(
  [[-0.02, -0.03, -0.2], [0.02, 0.06, 0.0]],
  [[-0.025, 0.02, 0.0], [0.025, 0.07, 0.25]],
  [[-0.01, 0.04, 0.0], [0.01, 0.055, 0.4]],
  [[-0.015, -0.15, -0.06], [0.015, -0.03, -0.01]],
);

describe('the handguard under a long gun\'s support point (guardUnderside.ts)', () => {
  it('finds the underside below a point inside the guard, and above a point under it', () => {
    expect(undersideAt(rifle.positions, rifle.indices, 0, 0.045, 0.15)).toBeCloseTo(0.02, 5);
    expect(undersideAt(rifle.positions, rifle.indices, 0, 0.0, 0.15)).toBeCloseTo(0.02, 5);
    // Nothing there: ahead of the gun.
    expect(undersideAt(rifle.positions, rifle.indices, 0, 0.045, 0.6)).toBeNull();
  });

  it('runs back along the guard and stops where the receiver and magazine are not the guard', () => {
    const g = guardFrom(rifle.positions, rifle.indices, [0, 0.045, 0.15], -0.1)!;
    expect(g.from).toBe(0);
    expect(g.under).toBeCloseTo(0.02, 5);
    // The guard runs from 0.15 back to 0.0; behind it the receiver's underside is 5 cm lower: not the guard.
    expect(g.back).toBeGreaterThanOrEqual(0.13);
    expect(g.back).toBeLessThan(0.15 + 0.06);
    expect(g.at(0.05)).toBeCloseTo(0.02, 5);
  });

  it('a vertical grip under the point: the guard starts behind it, on the rail it hangs from', () => {
    const gun = boxes([[-0.02, 0.02, -0.1], [0.02, 0.06, 0.3]], [[-0.012, -0.06, 0.2], [0.012, 0.02, 0.24]]);
    const g = guardFrom(gun.positions, gun.indices, [0, -0.01, 0.22], -0.05)!;
    expect(g.from).toBeGreaterThan(0.02);
    expect(g.under).toBeCloseTo(0.02, 5);
    expect(g.back).toBeGreaterThan(0.2);
  });
});

/** Every long gun's model, as the game loads it (its nodes' transforms applied: quantized meshes are scaled there). */
async function model(path: string): Promise<{ positions: number[]; indices: number[] }> {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.readBinary(new Uint8Array(readFileSync(fileURLToPath(new URL(`../public/models/${path}`, import.meta.url)))));
  const positions: number[] = [];
  const indices: number[] = [];
  const el: number[] = [];
  for (const node of doc.getRoot().listNodes() as GltfNode[]) {
    const mesh = node.getMesh();
    // (A model's far copy, `mesh_lod`, is drawn instead of it, not with it.)
    if (!mesh || /lod/i.test(node.getName())) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const base = positions.length / 3;
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, el);
        const [x, y, z] = el as P;
        positions.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
      }
      const idx = prim.getIndices();
      if (idx) for (let i = 0; i < idx.getCount(); i++) indices.push(base + idx.getScalar(i));
      else for (let i = 0; i < pos.getCount(); i++) indices.push(base + i);
    }
  }
  return { positions, indices };
}

const WEAPONS = fileURLToPath(new URL('../../../content/weapons/', import.meta.url));
const longGuns = readdirSync(WEAPONS)
  .filter((f) => f.endsWith('.json') && f !== 'families.json')
  .map((f) => JSON.parse(readFileSync(WEAPONS + f, 'utf8')) as { id?: string; view?: { model?: string; hold?: WeaponHold } })
  .filter((w) => w.view?.hold?.style === 'long' && w.view.hold.support && w.view.model);

describe('every long gun has a handguard under its support point for the support hand (third person)', () => {
  it('lists the long guns', () => expect(longGuns.length).toBeGreaterThan(15));
  for (const w of longGuns) {
    it(`${w.id ?? w.view!.model}: a guard the hand can cup, from its support point back`, async () => {
      const hold = w.view!.hold!;
      const s = hold.support!;
      const gun = await model(w.view!.model!);
      const g = guardFrom(gun.positions, gun.indices, s, hold.grip[2] + 0.12);
      expect(g, 'no handguard found under the support point').not.toBeNull();
      // The underside is near the point (not a bipod's or a magazine's end), and the guard starts at it or just behind it.
      expect(g!.under).toBeGreaterThan(s[1] - 0.036);
      expect(g!.under).toBeLessThan(s[1] + 0.061);
      expect(g!.from).toBeLessThanOrEqual(0.08);
    });
  }
});
