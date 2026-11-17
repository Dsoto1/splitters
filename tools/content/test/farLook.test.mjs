// Far looks baked from the real model (tools/content/kit/farLook.mjs): the bake's output is sane (inside level 0's
// bounds, its proportions, within its cap, deterministic), it looks more like the model than the flat block it
// replaces, and the shipped families' baked levels are what the lock says.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KINDS, ROOT } from '../kitprops.mjs';
import { bakeFarLook, farCap, farLevel, meshBounds, pictureError, pictures, recolourLevel } from '../kit/farLook.mjs';

const family = (id) => {
  const [, type] = id.split('.');
  return JSON.parse(readFileSync(join(ROOT, `content/kitprops/${type}.json`), 'utf8')).props.find((p) => p.id === id);
};
const levelsOf = (id, variant = 0) => {
  const f = family(id);
  const v = f.variants[variant];
  const g = { ...f.generator, ...(v.set ?? {}) };
  return f.lods.map((_, i) => KINDS[g.kind](v.seed, f.size, g, v.look, i));
};
const ext = ([lo, hi]) => [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];

describe('far looks baked from the real model', () => {
  const shelf = levelsOf('kit.shelf.gondola');
  const chair = levelsOf('kit.seat.chair');

  it('a cell bake stays inside level 0 and keeps its proportions', () => {
    for (const [full, opts] of [[shelf[0], { cells: 8 }], [shelf[0], { cells: 6, box: true, tall: 2 }], [chair[0], { cells: 8 }]]) {
      const b = bakeFarLook(full, { ...opts, maxTriangles: 400 });
      const [lo, hi] = meshBounds(full);
      const [blo, bhi] = meshBounds(b);
      for (let k = 0; k < 3; k++) {
        expect(blo[k]).toBeGreaterThanOrEqual(lo[k] - 1e-6);
        expect(bhi[k]).toBeLessThanOrEqual(hi[k] + 1e-6);
      }
      // Proportions: each side within a cell of level 0's.
      const e0 = ext([lo, hi]);
      const e1 = ext([blo, bhi]);
      const cell = Math.max(...e0) / opts.cells;
      for (let k = 0; k < 3; k++) expect(Math.abs(e0[k] - e1[k])).toBeLessThanOrEqual(cell + 1e-6);
      // Nothing faces down at the ground; every normal is a unit axis.
      for (let v = 0; v < b.N.length; v += 3) {
        expect(Math.abs(b.N[v]) + Math.abs(b.N[v + 1]) + Math.abs(b.N[v + 2])).toBeCloseTo(1, 6);
        if (b.N[v + 1] < 0) expect(b.P[v + 1]).toBeGreaterThan(lo[1] + 1e-6);
      }
      for (const c of b.C) expect(c >= 0 && c <= 1).toBe(true);
    }
  });

  it('keeps within its cap, and is the same every time', () => {
    const a = bakeFarLook(shelf[0], { cells: 10, maxTriangles: 90 });
    const b = bakeFarLook(shelf[0], { cells: 10, maxTriangles: 90 });
    expect(a.triangles).toBeLessThanOrEqual(90);
    expect(b.P).toEqual(a.P);
    expect(b.C).toEqual(a.C);
    const r = recolourLevel(shelf[1], shelf[0], { maxTriangles: 200 });
    expect(r.triangles).toBeLessThanOrEqual(200);
  });

  it("a recoloured shelf shows its goods' colours, not one block a tier", () => {
    const colours = (m) => new Set(Array.from({ length: m.C.length / 3 }, (_, i) => m.C.slice(i * 3, i * 3 + 3).map((x) => Math.round(x * 20)).join()));
    const r = recolourLevel(shelf[1], shelf[0], { maxTriangles: farCap(1, shelf[0].triangles, shelf[1].triangles) });
    expect(colours(r).size).toBeGreaterThan(colours(shelf[1]).size * 1.5);
  });

  it('looks more like the model than the flat block it replaces', () => {
    for (const id of ['kit.shelf.gondola', 'kit.shelf.end', 'kit.bookcase.wide', 'kit.table.dining']) {
      const L = levelsOf(id);
      const last = L.length - 1;
      const r = farLevel(L[0], L[last], last);
      const ref = pictures(L[0], 32);
      expect(r.mesh.triangles, id).toBeLessThanOrEqual(farCap(last, L[0].triangles, L[last].triangles));
      expect(pictureError(ref, r.mesh, 32), id).toBeLessThan(pictureError(ref, L[last], 32));
    }
  }, 120000);

  it('the shipped baked families record their choice, within the caps', () => {
    const lock = JSON.parse(readFileSync(join(ROOT, 'content/kitprops.lock.json'), 'utf8'));
    const types = new Set(JSON.parse(readFileSync(join(ROOT, 'content/kitprops.json'), 'utf8')).farLooks);
    const baked = lock.files.filter((f) => types.has(f.src.split('.')[1]));
    expect(baked.length).toBeGreaterThan(50);
    for (const f of baked) {
      expect(f.far, f.src).toHaveLength(f.lodTriangles.length - 1);
      for (const p of f.far) expect(['own', 'recoloured', 'cells', 'picture box']).toContain(p.how);
      // Lighter levels stay lighter.
      for (let i = 1; i < f.lodTriangles.length; i++) expect(f.lodTriangles[i], f.src).toBeLessThanOrEqual(f.lodTriangles[i - 1]);
    }
    // Most of the flat blocks are gone.
    const last = baked.map((f) => f.far.at(-1).how);
    expect(last.filter((h) => h !== 'own').length / last.length).toBeGreaterThan(0.5);
  });
});
