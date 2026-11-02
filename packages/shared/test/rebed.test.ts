import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REBED_TOLERANCE, buildMapGeometry, loadMap, newMapDocument, newTerrain, rebedProps, rebedShift, settledPropY, supportUnder, type MapDocument, type MapEntity } from '../src/index.ts';

type Prop = Extract<MapEntity, { kind: 'prop' }>;
const prop = (id: string, x: number, y: number, z: number, model = 'prop.bush_large'): Prop => ({ id, kind: 'prop', model, position: [x, y, z], yaw: 0, scale: 1, solid: false, tint: null });

describe('props stay bedded on the ground as played', () => {
  // The ground before and after: a walk laid in raised it 0.2 m round x = 0.
  const before = newTerrain(24);
  const after = { ...before, heights: before.heights.map((h, i) => (Math.abs(before.origin[0] + (i % before.cols) * before.spacing) <= 4 ? h + 20 : h)) };

  it('moves a prop resting on the ground by as much as its bed moves, and leaves props off the ground', () => {
    const bed = settledPropY(before, prop('p', 0, 0, 0))!;
    expect(rebedShift(before, after, prop('p', 0, bed, 0))).toBeCloseTo(0.2, 2);
    // Off the walk's reach: nothing moves.
    expect(rebedShift(before, after, prop('p', 10, bed, 0))).toBe(0);
    // Placed up off the ground (on a table, hung): stays where it was put.
    expect(rebedShift(before, after, prop('p', 0, bed + REBED_TOLERANCE + 0.1, 0))).toBe(0);
  });

  it('a prop held up by a block stays put', () => {
    const doc = newMapDocument('Rebed');
    const slab = { id: 'slab', kind: 'block', position: [0, -0.5, 0], size: [3, 0.48, 3], yaw: 0, material: null, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 } as MapEntity;
    const bed = settledPropY(before, prop('p', 0, 0, 0))!;
    const map: MapDocument = { ...doc, terrain: before, entities: [slab, prop('on_slab', 0, -0.02, 0, 'prop.crate_small'), prop('loose', 0, bed, 6)] };
    const boxes = buildMapGeometry(map);
    expect(supportUnder(boxes, 0, 0, -0.02, 'on_slab')).toBeGreaterThan(-0.1);
    const out = rebedProps(map, before, after, boxes);
    expect(out.entities.find((e) => e.id === 'on_slab')!.position[1]).toBe(-0.02);
    expect(out.entities.find((e) => e.id === 'loose')!.position[1]).toBeCloseTo(bed + 0.2, 2);
  });

  it("St. John's as played: every prop MapMaker bedded on the ground is bedded on the ground with the walks laid in", () => {
    const raw = JSON.parse(readFileSync(new URL('../../../maps/st_johns.json', import.meta.url), 'utf8')) as MapDocument;
    const r = loadMap(JSON.stringify(raw));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const played = new Map(r.map.entities.map((e) => [e.id, e]));
    const boxes = buildMapGeometry(r.map);
    let checked = 0;
    let moved = 0;
    const off: string[] = [];
    for (const e of raw.entities) {
      if (e.kind !== 'prop' || !raw.terrain) continue;
      const bed = settledPropY(raw.terrain, e);
      if (bed === null || Math.abs(e.position[1] - bed) > 0.01) continue;
      if (supportUnder(boxes, e.position[0], e.position[2], e.position[1], e.id) > e.position[1] - 0.2) continue;
      const p = played.get(e.id) as Prop;
      const now = settledPropY(r.map.terrain!, p)!;
      checked++;
      if (p.position[1] !== e.position[1]) moved++;
      if (Math.abs(p.position[1] - now) > 0.02) off.push(`${e.id} ${p.position[1]} vs ${now}`);
    }
    expect(off).toEqual([]);
    expect(checked).toBeGreaterThan(200);
    // The ones next to the walks moved (a lamp post, bushes and street trees sat up to 0.24 m off).
    expect(moved).toBeGreaterThan(5);
  });
});
