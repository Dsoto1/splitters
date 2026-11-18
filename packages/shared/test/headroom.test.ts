// MapMaker's headroom check (map/headroom.ts; owner, 2026-11-18): stairs and ramps too low to walk standing.
import { describe, expect, it } from 'vitest';
import { STANDING_HEADROOM, headroomIssues, lowHeadroom, type MapEntity } from '../src/index.ts';
import { makeMap } from './helpers.ts';

/** Open stairs (one level up, climbing east) and, optionally, a slab over their middle `clear` m over the floor. */
function stairs(slabAt: number | null) {
  const map = makeMap([{ id: 'st', tile: 'core.stairs_open', x: 0, y: 0, z: 0, rotation: 0 }], [[-8, 0, 0]]);
  const slab: MapEntity[] = slabAt === null ? [] : [{ id: 'slab', kind: 'block', position: [0, slabAt, 0], size: [2, 0.3, 4], yaw: 0, material: 'core.concrete', tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 } as MapEntity];
  return { ...map, entities: [...map.entities, ...slab] };
}

describe('stair headroom', () => {
  it('open stairs alone have room to stand', () => {
    expect(lowHeadroom(stairs(null))).toEqual([]);
    expect(headroomIssues(stairs(null))).toEqual([]);
  });

  it('a slab low over the flight is flagged once, on the stairs, with its clear height', () => {
    // The flight's middle step tops out at 2 m: a slab from 3.2 m leaves 1.2 m there.
    const map = stairs(3.2);
    const low = lowHeadroom(map);
    expect(low.length).toBeGreaterThan(0);
    expect(Math.min(...low.map((l) => l.headroom))).toBeLessThan(STANDING_HEADROOM);
    expect(low.every((l) => l.over === 'slab')).toBe(true);
    const issues = headroomIssues(map);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'warning', code: 'stairs.headroom', targetId: 'st' });
    // High enough over every step: nothing.
    expect(headroomIssues(stairs(6.5))).toEqual([]);
  });
});
