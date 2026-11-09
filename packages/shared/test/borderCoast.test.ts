// The "coast" border side (map format v32): the shore carried on past the line, cliffs tapering to headlands, forest
// only inland; scenery only (no collision, no navigation).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COAST_BEACH, BORDER_LABELS, BORDER_STYLES, borderBoxes, borderFloor, buildMapGeometry, coastHeight, coastHeightAt, coastSides, loadMap, serializeMap, type MapDocument } from '../src/index.ts';

/** Iron Coast as it is (sea south, forest north), its east and west ends made coast. */
function ironCoast(): MapDocument {
  const r = loadMap(readFileSync(new URL('../../../maps/iron_coast.json', import.meta.url), 'utf8'));
  if (!r.ok) throw new Error('iron_coast does not load');
  const map = r.map;
  return { ...map, backdrop: { ...map.backdrop!, borderSides: { north: 'forest', south: 'water', east: 'coast', west: 'coast' } } };
}

describe('the coast border side', () => {
  it('is a border style a side can take, saved and loaded', () => {
    expect(BORDER_STYLES).toContain('coast');
    expect(BORDER_LABELS.coast).toMatch(/Coast/);
    const map = ironCoast();
    const back = loadMap(serializeMap(map));
    expect(back.ok && back.map.backdrop?.borderSides).toEqual({ north: 'forest', south: 'water', east: 'coast', west: 'coast' });
  });

  it('is scenery only: no collision along a coast side', () => {
    const map = ironCoast();
    const floor = borderFloor(map, buildMapGeometry(map));
    const boxes = borderBoxes(map, floor);
    const t = map.terrain!;
    const x1 = t.origin[0] + (t.cols - 1) * t.spacing;
    // The forest (north) is solid; nothing stands past the east or west line (the bounds' invisible wall stays).
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes.filter((b) => b.min[0] >= x1 - 0.01 || b.max[0] <= t.origin[0] + 0.01).filter((b) => b.max[2] < t.origin[1] + (t.rows - 1) * t.spacing - 4)).toEqual([]);
    const onlyCoast = { ...map, backdrop: { ...map.backdrop!, border: 'coast' as const, borderSides: undefined } };
    expect(borderBoxes(onlyCoast, floor)).toEqual([]);
  });

  it('lays the shore from the sea end, forest only inland, the sea at the map\'s own water', () => {
    const map = ironCoast();
    const sides = coastSides(map, 0);
    expect(sides.map((s) => s.edge.side).sort()).toEqual(['east', 'west']);
    for (const s of sides) {
      // The map's sea is a water body whose top is at -0.4 m.
      expect(s.sea).toBeCloseTo(-0.45, 2);
      // The south end meets the sea (the water side), the north end doesn't.
      const southEnd = s.edge.a[1] < s.edge.b[1] ? 0 : 1;
      expect(s.seaward[southEnd]).toBe(true);
      expect(s.seaward[1 - southEnd]).toBe(false);
      expect(s.shore).toHaveLength(1);
      const [a, b] = s.shore[0]!;
      // The beach runs from the south corner to the cliff's foot, 100-150 m up the side.
      const along = southEnd === 0 ? b : s.edge.length - a;
      expect(along).toBeGreaterThan(90);
      expect(along).toBeLessThan(160);
      // Forest only inland: every inland stretch is at least 35 m from the shore.
      expect(s.inland.length).toBeGreaterThan(0);
      for (const [p, q] of s.inland) expect(Math.min(Math.abs(p - b), Math.abs(q - a), p >= b ? p - b : a - q)).toBeGreaterThanOrEqual(34.9);
    }
  });

  it('carries the shore on at its height, and tapers the cliffs to low headlands', () => {
    const map = ironCoast();
    const s = coastSides(map, 0).find((c) => c.edge.side === 'east')!;
    const e = s.edge;
    // A point on the beach and one on the cliff top, along the line.
    let beach = -1;
    let crest = -1;
    for (let u = 0; u <= e.length; u += 1) {
      const h = coastHeight(s, u, 0);
      if (beach < 0 && h > s.sea + 0.2 && h < s.sea + COAST_BEACH) beach = u;
      if (crest < 0 && h > s.sea + 12) crest = u;
    }
    expect(beach).toBeGreaterThanOrEqual(0);
    expect(crest).toBeGreaterThan(0);
    // The beach 40 m out is still a beach (within a metre or two of the sea, dunes aside), not sea bed or cliff.
    expect(coastHeight(s, beach, 40)).toBeGreaterThan(s.sea - 0.5);
    expect(coastHeight(s, beach, 40)).toBeLessThan(s.sea + COAST_BEACH + 2.7);
    // The crest stays up close, and far out is a low headland (well under half its height over the beach).
    const top = coastHeight(s, crest, 0) - s.sea;
    expect(coastHeight(s, crest, 2) - s.sea).toBeGreaterThan(top * 0.85);
    const far = coastHeight(s, crest, 80) - s.sea;
    expect(far).toBeLessThan(top * 0.5);
    expect(far).toBeGreaterThan(COAST_BEACH);
    // Iron Coast's backdrop is sea: the far end dips under it.
    expect(coastHeight(s, crest, 125)).toBeLessThan(s.sea);
    // The world-point lookup agrees; inside the map there is none.
    const [x, z] = [e.a[0] + ((e.b[0] - e.a[0]) * crest) / e.length + e.out[0] * 30, e.a[1] + ((e.b[1] - e.a[1]) * crest) / e.length + e.out[1] * 30];
    expect(coastHeightAt([s], x, z)).toBeCloseTo(coastHeight(s, crest, 30), 3);
    expect(coastHeightAt([s], 0, 0)).toBeNull();
  });

  it('needs a coast side', () => {
    const map = ironCoast();
    expect(coastSides({ ...map, backdrop: { ...map.backdrop!, borderSides: { east: 'forest', west: 'forest' } } }, 0)).toEqual([]);
  });
});
