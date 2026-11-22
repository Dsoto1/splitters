// Terrain → Resize (owner, 2026-11-16): grow or shrink each edge without removing the terrain.
import { describe, expect, it } from 'vitest';
import { EditHistory, MAX_TERRAIN_VERTS, newTerrain, planResize, resizeTerrain, resizeTerrainCommand, terrainHeightAt, type MapDocument, type MapEntity, type TerrainData } from '../src/index.ts';
import { makeMap } from './helpers.ts';

/** 40 × 30 m at 2 m: a hill, paint in bands, plants. */
function hilly(): TerrainData {
  const t = newTerrain(40, 2, [0, 0], 'grass', 30);
  for (let r = 0; r < t.rows; r++) for (let c = 0; c < t.cols; c++) t.heights[r * t.cols + c] = Math.round(300 * Math.sin(c / 4) * Math.cos(r / 5)) + 200;
  t.grounds = ['core.sand'];
  t.materials = t.materials.map((_, i) => (i % 7 < 3 ? 1 : 0));
  t.foliage = t.materials.map((_, i) => i % 5);
  return t;
}

const docWith = (t: TerrainData, entities: MapEntity[] = []): MapDocument => ({ ...makeMap([]), terrain: t, entities });

describe('Terrain → Resize (resizeTerrain.ts)', () => {
  it('grows each edge keeping every height, paint and plant where it was; new ground continues the edge', () => {
    const t = hilly();
    const g = resizeTerrain(t, { north: 3, south: 2, east: 4, west: 1 });
    expect([g.cols, g.rows]).toEqual([t.cols + 5, t.rows + 5]);
    expect(g.origin).toEqual([t.origin[0] - 2, t.origin[1] - 4]);
    // Every old vertex: the same height at the same place.
    for (let r = 0; r < t.rows; r += 3) for (let c = 0; c < t.cols; c += 3) {
      const x = t.origin[0] + c * t.spacing;
      const z = t.origin[1] + r * t.spacing;
      expect(terrainHeightAt(g, x, z)).toBeCloseTo(terrainHeightAt(t, x, z)!, 6);
    }
    // Paint and plants of an old cell, at its new index.
    expect(g.materials[(5 + 2) * (g.cols - 1) + (6 + 1)]).toBe(t.materials[5 * (t.cols - 1) + 6]);
    expect(g.foliage[(5 + 2) * (g.cols - 1) + (6 + 1)]).toBe(t.foliage[5 * (t.cols - 1) + 6]);
    // Flat: the east edge's heights carried straight out.
    expect(g.heights[(4 + 2) * g.cols + g.cols - 1]).toBe(t.heights[4 * t.cols + t.cols - 1]);
    // Eased: down to the base at the far edge, the edge itself unchanged.
    const e = resizeTerrain(t, { north: 0, south: 0, east: 4, west: 0 }, 'eased');
    expect(e.heights[4 * e.cols + e.cols - 1]).toBe(0);
    expect(e.heights[4 * e.cols + t.cols - 1]).toBe(t.heights[4 * t.cols + t.cols - 1]);
  });

  it('a grown then shrunk terrain matches the original', () => {
    const t = hilly();
    const edges = { north: 3, south: 2, east: 4, west: 1 };
    const back = resizeTerrain(resizeTerrain(t, edges, 'eased'), { north: -3, south: -2, east: -4, west: -1 });
    expect(back).toEqual(t);
  });

  it('lists the things on cut-off ground, takes them away, and brings the boundary in; one undo step', () => {
    const t = hilly();
    const east = t.origin[0] + (t.cols - 1) * t.spacing;
    const on = (id: string, x: number, z: number, up = 0): MapEntity => ({ id, kind: 'pickup', position: [x, terrainHeightAt(t, x, z)! + up, z], item: 'core.ammo', respawnSeconds: null }) as MapEntity;
    const keep = on('keep_me', t.origin[0] + 10, t.origin[1] + 10);
    const cut = on('cut_off', east - 1, t.origin[1] + 10);
    const high = on('up_high', east - 1, t.origin[1] + 12, 6);
    const doc: MapDocument = { ...docWith(t, [keep, cut, high]), bounds: { min: [t.origin[0], t.origin[1] + 2], max: [east, t.origin[1] + 28], style: 'invisible', height: 8 } };
    const plan = planResize(doc, { north: 0, south: 0, east: -2, west: 0 });
    expect(plan.error).toBeNull();
    expect(plan.cut.map((e) => e.id)).toEqual(['cut_off']);
    const r = resizeTerrainCommand(doc, { north: 0, south: 0, east: -2, west: 0 });
    if ('error' in r) throw new Error(r.error);
    const h = new EditHistory(doc);
    h.execute('Resize terrain', r.command);
    expect(h.doc.terrain!.cols).toBe(t.cols - 2);
    expect(h.doc.entities.map((e) => e.id)).toEqual(['keep_me', 'up_high']);
    // The boundary's east edge lay on the terrain's: it moves in with it; the others stay.
    expect(h.doc.bounds!.max).toEqual([east - 4, t.origin[1] + 28]);
    expect(h.doc.bounds!.min).toEqual(doc.bounds!.min);
    h.undo();
    expect(h.doc.terrain).toEqual(t);
    expect(h.doc.entities.map((e) => e.id).sort()).toEqual(['cut_off', 'keep_me', 'up_high']);
    expect(h.doc.bounds).toEqual(doc.bounds);
  });

  it('refuses no change, too small, fractions and past the vertex cap', () => {
    const doc = docWith(hilly());
    expect(planResize(doc, { north: 0, south: 0, east: 0, west: 0 }).error).toMatch(/no edge/);
    expect(planResize(doc, { north: -14, south: 0, east: 0, west: 0 }).error).toMatch(/too small/);
    expect(planResize(doc, { north: 0.5, south: 0, east: 0, west: 0 }).error).toMatch(/whole cells/);
    expect(planResize(doc, { north: 0, south: 0, east: MAX_TERRAIN_VERTS, west: 0 }).error).toMatch(/at most/);
  });
});
