import { beforeAll, describe, expect, it } from 'vitest';
import { buildMapGeometry, initPhysics, loadMap, type MapDocument } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const room = (backdrop: MapDocument['backdrop']): MapDocument => ({ ...makeMap([{ id: 'yard_a', tile: 'core.yard', x: 0, y: 0, z: 0, rotation: 0 }], [[0, 0, 0]]), backdrop });
const ground = (map: MapDocument) => buildMapGeometry(map).filter((b) => b.sourceId === 'ground');

describe('ground round a built map', () => {
  it('is there where the backdrop draws land, fenced in, and not over water or in space', () => {
    const land = ground(room({ sky: 'clear', scenery: 'hills', ground: 'grass', haze: 0.5 }));
    expect(land.length).toBe(5);
    const slab = land[0]!;
    // Just under the floor, reaching well past the 8 m tile.
    expect(slab.max[1]).toBeCloseTo(-0.05, 5);
    expect(slab.min[0]).toBeLessThanOrEqual(-16);
    expect(slab.max[0]).toBeGreaterThanOrEqual(16);
    expect(ground(room({ sky: 'clear', scenery: 'ocean', ground: 'water', haze: 0.5 }))).toEqual([]);
    expect(ground(room({ sky: 'space', scenery: 'none', ground: 'none', haze: 0 }))).toEqual([]);
  });

  it('holds a player who steps off the tiles, and its edge stops them walking off', () => {
    const loaded = loadMap(room({ sky: 'clear', scenery: 'hills', ground: 'grass', haze: 0.5 }));
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
    const match = new Match(loaded.map, undefined, 1);
    const me = match.addHuman('me')!;
    me.move = { pos: { x: 10, y: 0.5, z: 0 }, velY: 0, grounded: false };
    let seq = 0;
    // Walk east for six seconds: off the tile, across the ground, into its edge.
    for (let i = 0; i < 360; i++) {
      match.queueInputs(me.slot, [{ seq: ++seq, forward: 1, right: 0, yaw: Math.PI / 2, pitch: 0, buttons: 0 }]);
      match.step();
    }
    expect(me.alive).toBe(true);
    expect(me.move.pos.y).toBeGreaterThan(-0.5);
    expect(me.move.pos.x).toBeLessThan(17);
  });
});
