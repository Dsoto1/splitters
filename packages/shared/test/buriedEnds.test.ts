import { describe, expect, it } from 'vitest';
import {
  PhysicsWorld,
  addPortalsCommand,
  buildMapGeometry,
  buildOccupancy,
  buriedOpenEnds,
  closeOpenEndsCommand,
  initPhysics,
  newMapDocument,
  newTerrain,
  validateMap,
  type MapDocument,
  type Rotation,
  type TilePlacement,
} from '../src/index.ts';

/**
 * MapMaker: building below ground, part 2 (QUEUE Features; owner, 2026-11-18): a buried tunnel's end that joins nothing
 * is closed with a plain face of its family until a portal, a Dead End or another piece goes there, in play and in
 * MapMaker, and validation warns about it.
 */

function mapOf(tiles: (Partial<TilePlacement> & { tile: string; x: number; y: number })[], hill = 8): MapDocument {
  const doc = newMapDocument('Ends');
  const t = newTerrain(96, 2);
  t.heights.fill(Math.round(hill * 100));
  return { ...doc, terrain: t, entities: [], classicStructure: { ...doc.classicStructure, tiles: tiles.map((p, i) => ({ id: `tile_${i}`, z: 0, rotation: 0 as Rotation, ...p })) } };
}

const caps = (doc: MapDocument) => buildMapGeometry(doc).filter((b) => b.endCap);

describe('buried tunnels: no open ends into the ground', () => {
  it('a lone buried passage is closed at both ends, in its own lining, solid to a shot down it', async () => {
    await initPhysics();
    const doc = mapOf([{ tile: 'core.tunnel_concrete_straight', x: 0, y: 0, family: 'mine' }]);
    const found = caps(doc);
    expect(found.length).toBe(2);
    // The mine's rock, from under the floor to the bore's top, across the whole side.
    for (const b of found) {
      expect(b.surface?.material).toBe('core.pbr_rock');
      expect(b.kind).toBe('wall');
      expect(b.max[0] - b.min[0]).toBeCloseTo(8, 5);
      expect(b.min[1]).toBeLessThan(0);
      expect(b.max[1]).toBeGreaterThan(3.2);
    }
    const physics = new PhysicsWorld(buildMapGeometry(doc), null);
    expect(physics.raycastWorld({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: 1 }, 10)).toBeCloseTo(3.7, 1);
    expect(physics.raycastWorld({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: -1 }, 10)).toBeCloseTo(3.7, 1);
    physics.free();
  });

  it('joined ends, portals and Dead Ends close nothing; Close open ends and Add portals take the caps away', () => {
    const run = mapOf([
      { tile: 'core.tunnel_concrete_straight', x: 0, y: 0 },
      { tile: 'core.tunnel_concrete_straight', x: 0, y: 1 },
    ]);
    expect(caps(run).map((b) => Math.sign(b.min[2]))).toEqual(expect.arrayContaining([-1, 1]));
    expect(caps(run).length).toBe(2);
    for (const make of [closeOpenEndsCommand, addPortalsCommand]) {
      const made = make(run);
      if ('error' in made) throw new Error(made.error);
      const done = { ...run, classicStructure: { ...run.classicStructure, tiles: [...run.classicStructure.tiles, ...made.placed] } };
      expect(caps(done), make.name).toEqual([]);
    }
  });

  it('an end walled up by the map maker is not capped again; open ground and pieces with no cover are never capped', () => {
    const walled = mapOf([{ tile: 'core.tunnel_concrete_straight', x: 0, y: 0, edges: { '0,0,0:N': 'wall' } }]);
    const { cells } = buildOccupancy(walled);
    const { cellSize, levelHeight } = walled.classicStructure;
    expect(buriedOpenEnds(cells, cellSize, levelHeight).map((e) => e.side)).toEqual(['S']);
    expect(caps(walled).length).toBe(1);
    // The vaulted tunnel above ground (no bore) and a portal (a mouth) stay as they were.
    expect(caps(mapOf([{ tile: 'core.tunnel_vault', x: 0, y: 0 }]))).toEqual([]);
    expect(caps(mapOf([{ tile: 'core.tunnel_concrete_portal', x: 0, y: 0 }]))).toEqual([]);
  });

  it('validation names each open end of a buried passage, whether or not the ground is over it', () => {
    const issues = (m: MapDocument) => validateMap(m).filter((i) => i.code === 'tunnel.mouth_buried');
    const under = issues(mapOf([{ tile: 'core.tunnel_concrete_straight', x: 0, y: 0 }]));
    expect(under.length).toBe(2);
    expect(under[0]!.message).toMatch(/closed with a plain face/);
    expect(issues(mapOf([{ tile: 'core.tunnel_concrete_straight', x: 0, y: 0 }], -10)).length).toBe(2);
  });
});
