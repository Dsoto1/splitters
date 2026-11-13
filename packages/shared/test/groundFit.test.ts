// Fit the ground to a build, and settle a build onto the ground (MapMaker's selection menu and Paths pane; groundFit.ts).
import { describe, expect, it } from 'vitest';
import {
  MapEntity,
  MapPath,
  applyCommand,
  fitGroundToPathCommand,
  fitGroundToSelectionCommand,
  invertCommand,
  newMapDocument,
  newTerrain,
  settlePathOnGroundCommand,
  settleSelectionOnGroundCommand,
  terrainHeightAt,
  terrainUnderFloors,
  type MapDocument,
} from '../src/index.ts';

/** Open ground 80 m square, sloping up to the east: 1 m of height every 4 m (0 at x = 0). */
function slope(): MapDocument {
  const doc = newMapDocument('Fit');
  const t = newTerrain(80);
  t.heights = t.heights.map((_, i) => Math.round(((t.origin[0] + (i % t.cols) * t.spacing) / 4) * 100));
  return { ...doc, terrain: t };
}
const block = (id: string, position: [number, number, number], size: [number, number, number], yaw = 0) => MapEntity.parse({ id, kind: 'block', position, size, yaw });
const ok = <T,>(r: T | { error: string }): T => {
  if (r && typeof r === 'object' && 'error' in r) throw new Error(r.error);
  return r as T;
};
const ground = (d: MapDocument, x: number, z: number) => terrainHeightAt(d.terrain!, x, z)!;

describe('Fit ground to a build', () => {
  // A house of blocks on the slope: a slab 12 m square with its top at 2 m, and a wall along its west side.
  const house = (): MapDocument => {
    const d = slope();
    return { ...d, entities: [...d.entities, block('slab', [0, 1.5, 0], [12, 0.5, 12]), block('wall', [-5.75, 2, 0], [0.5, 3, 12])] };
  };
  const sel = { tiles: [], entities: ['slab', 'wall'] };

  it('brings the ground to the base under the build and a cell round it: raised on the low side, cut on the high side', () => {
    const d = house();
    // Before: the ground is 1.5 m under the slab's west edge and 1.5 m over its east edge.
    expect(ground(d, -6, 0)).toBeCloseTo(-1.5, 5);
    expect(ground(d, 6, 0)).toBeCloseTo(1.5, 5);
    const r = ok(fitGroundToSelectionCommand(d, sel, 6));
    expect(r.raised).toBeGreaterThan(0);
    expect(r.lowered).toBeGreaterThan(0);
    const fit = applyCommand(d, r.command);
    for (const [x, z] of [[-6, 0], [6, 0], [0, 0], [0, -6], [-6, 6], [7, 7], [-7.5, 0]] as const) expect(ground(fit, x, z), `${x},${z}`).toBeCloseTo(2, 5);
  });

  it('eases back into the ground about over the blend distance, and leaves the ground past it alone', () => {
    const d = house();
    const fit = applyCommand(d, ok(fitGroundToSelectionCommand(d, sel, 6)).command);
    // Well past the footprint, the cell round it and the bank: as made.
    expect(ground(fit, -34, 0)).toBeCloseTo(-8.5, 5);
    expect(ground(fit, 34, 0)).toBeCloseTo(8.5, 5);
    expect(ground(fit, 0, 30)).toBeCloseTo(0, 5);
    // Beside it (the ground there was level with it, a metre and a half off at most): back as made within the blend.
    expect(ground(fit, 0, 16)).toBeCloseTo(0, 5);
    // Within the bank: between the ground as made and the base, and never steeper than it can be walked (the
    // ground is 6 m under the base 16 m west of it: the bank runs further than the 6 m asked for).
    const mid = ground(fit, -11, 0);
    expect(mid).toBeGreaterThan(-2.75);
    expect(mid).toBeLessThan(2);
    for (let x = -38; x < 38; x += 2) expect(Math.abs(ground(fit, x + 2, 0) - ground(fit, x, 0)), `at ${x}`).toBeLessThan(1.6);
    // A wider blend reaches further.
    const wide = applyCommand(d, ok(fitGroundToSelectionCommand(d, sel, 30)).command);
    expect(ground(wide, 0, 30)).toBeGreaterThan(0.01);
    expect(ground(wide, -12, 0)).toBeGreaterThan(ground(fit, -12, 0));
    // No blend: only under the build and the cell round it.
    const none = applyCommand(d, ok(fitGroundToSelectionCommand(d, sel, 0)).command);
    expect(ground(none, 0, 0)).toBeCloseTo(2, 5);
    expect(ground(none, -10, 0)).toBeCloseTo(-2.5, 5);
  });

  it('is one undo step, touches only the stored heights, and says when there is nothing to do', () => {
    const d = house();
    const r = ok(fitGroundToSelectionCommand(d, sel));
    expect(r.command.kind).toBe('setTerrain');
    const fit = applyCommand(d, r.command);
    expect(fit.entities).toBe(d.entities);
    expect(fit.terrain!.materials).toBe(d.terrain!.materials);
    expect(applyCommand(fit, invertCommand(r.command)).terrain).toEqual(d.terrain);
    expect(fitGroundToSelectionCommand(fit, sel)).toEqual({ error: expect.stringMatching(/already meets/) });
    expect(fitGroundToSelectionCommand(d, { tiles: [], entities: [] })).toEqual({ error: 'nothing selected' });
    expect(fitGroundToSelectionCommand({ ...d, terrain: null }, sel)).toEqual({ error: expect.stringMatching(/no terrain/) });
  });

  it('goes by what stands on the ground: a roof or an upper floor over open ground brings nothing up', () => {
    const d = house();
    const withRoof = { ...d, entities: [...d.entities, block('roof', [10, 5, 0], [30, 0.5, 12])] };
    const fit = applyCommand(withRoof, ok(fitGroundToSelectionCommand(withRoof, { tiles: [], entities: ['slab', 'wall', 'roof'] }, 0)).command);
    // Under the far end of the roof (x = 22) the ground is as made.
    expect(ground(fit, 22, 0)).toBeCloseTo(5.5, 5);
    expect(ground(fit, 0, 0)).toBeCloseTo(2, 5);
  });

  it('fits to a room of tiles (its floor at the level), and the ground as played then lies just under the floor', () => {
    const d = slope();
    const room = { ...d, classicStructure: { ...d.classicStructure, tiles: [{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 as const }] } };
    const fit = applyCommand(room, ok(fitGroundToSelectionCommand(room, { tiles: ['room'], entities: [] })).command);
    expect(ground(fit, -4, 0)).toBeCloseTo(0, 5);
    expect(ground(fit, 4, 0)).toBeCloseTo(0, 5);
    const played = terrainUnderFloors(fit)!;
    expect(terrainHeightAt(played, 4, 0)!).toBeLessThan(0);
    expect(terrainHeightAt(played, 4, 0)!).toBeGreaterThan(-0.2);
  });

  it('follows a turned block', () => {
    const d = slope();
    const turned = { ...d, entities: [...d.entities, block('turned', [0, 3, 0], [20, 1.5, 2], Math.PI / 4)] };
    const fit = applyCommand(turned, ok(fitGroundToSelectionCommand(turned, { tiles: [], entities: ['turned'] }, 0)).command);
    // Along its length (the diagonal) the ground is at its bottom; off to the side it is as made.
    expect(ground(fit, 6, 6) === 3 || ground(fit, 6, -6) === 3).toBe(true);
    expect(ground(fit, 0, 0)).toBeCloseTo(3, 5);
    expect(ground(fit, -10, 0) < 0).toBe(true);
  });
});

describe('Settle a build onto the ground', () => {
  it('drops blocks until their base is on the lowest ground under them, in one step, the ground untouched', () => {
    const d = slope();
    const up = { ...d, entities: [...d.entities, block('slab', [8, 7.5, 0], [8, 0.5, 8]), block('wall', [4.25, 8, 0], [0.5, 3, 8])] };
    const sel = { tiles: [], entities: ['slab', 'wall'] };
    const r = ok(settleSelectionOnGroundCommand(up, sel));
    // The slab's top (8 m) goes to the lowest ground under the build: 1 m, at x = 4.
    expect(r.by).toBeCloseTo(-7, 2);
    const down = applyCommand(up, r.command);
    expect(down.terrain).toBe(up.terrain);
    expect(down.entities.find((e) => e.id === 'slab')!.position[1]).toBeCloseTo(0.5, 2);
    expect(down.entities.find((e) => e.id === 'wall')!.position[1]).toBeCloseTo(1, 2);
    expect(applyCommand(down, invertCommand(r.command)).entities).toEqual(up.entities);
    expect(settleSelectionOnGroundCommand(down, sel)).toEqual({ error: expect.stringMatching(/on the ground already/) });
  });

  it('moves tiles by whole levels, to the level nearest the ground', () => {
    const d = slope();
    const t = newTerrain(80);
    t.heights.fill(900);
    const high = { ...d, terrain: t, classicStructure: { ...d.classicStructure, tiles: [{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 as const }] } };
    const r = ok(settleSelectionOnGroundCommand(high, { tiles: ['room'], entities: [] }));
    expect(r.by).toBe(8);
    expect(applyCommand(high, r.command).classicStructure.tiles[0]!.z).toBe(2);
    const near = { ...high, terrain: { ...t, heights: t.heights.map(() => 150) } };
    expect(settleSelectionOnGroundCommand(near, { tiles: ['room'], entities: [] })).toEqual({ error: expect.stringMatching(/nearest the ground already/) });
  });
});

describe('Fit ground to a path, and a path onto the ground', () => {
  const road = MapPath.parse({ id: 'road', points: [[-20, 3, 0], [0, 3, 0], [20, 3, 0]], width: 6, lay: false });

  it('brings the ground to the path across its width and eases it out either side and past its ends', () => {
    const d = { ...slope(), paths: [road] };
    const r = ok(fitGroundToPathCommand(d, 'road', 6));
    const fit = applyCommand(d, r.command);
    for (const x of [-20, -10, 0, 10, 20]) for (const z of [-2, 0, 2]) expect(ground(fit, x, z), `${x},${z}`).toBeCloseTo(3, 1);
    expect(ground(fit, 0, 30)).toBeCloseTo(0, 5);
    expect(ground(fit, -38, 30)).toBeCloseTo(-9.5, 5);
    const beside = ground(fit, -10, 8);
    expect(beside).toBeGreaterThan(-2.5);
    expect(beside).toBeLessThan(3);
    expect(applyCommand(fit, invertCommand(r.command)).terrain).toEqual(d.terrain);
    expect(fit.paths).toBe(d.paths);
  });

  it('settles a path onto the ground: each point at the ground there, one step', () => {
    const d = { ...slope(), paths: [road] };
    const r = ok(settlePathOnGroundCommand(d, 'road'));
    expect(r.moved).toBe(3);
    const down = applyCommand(d, r.command);
    expect(down.paths![0]!.points.map((p) => p[1])).toEqual([-5, 0, 5]);
    expect(down.terrain).toBe(d.terrain);
    expect(applyCommand(down, invertCommand(r.command)).paths).toEqual(d.paths);
    expect(settlePathOnGroundCommand(down, 'road')).toEqual({ error: expect.stringMatching(/on the ground already/) });
  });
});
