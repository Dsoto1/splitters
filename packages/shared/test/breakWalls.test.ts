import { beforeAll, describe, expect, it } from 'vitest';
import { BREAK_WALL_HEALTH, MAX_BREAK_WALLS, buildMapDecor, buildMapGeometry, initPhysics, loadMap, wallSectionIndex, wallSections, type MapDocument, type TilePlacement } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** Two rooms side by side along x (cells 0 and 1): the wall between them is at x = 4. */
function twoRooms(a: Partial<TilePlacement> = {}, b: Partial<TilePlacement> = {}): MapDocument {
  return makeMap(
    [
      { id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0, ...a },
      { id: 'room_b', tile: 'core.room', x: 1, y: 0, z: 0, rotation: 0, ...b },
    ],
    [[-2, 0, 0]],
  );
}

const stateOf = (match: Match, i: number) => match.scenario.fullState().es?.find((s) => s[0] === i);
/** Whether a ray along +x from x = 1 at chest height, beside the doorway, reaches x = 7 (through the wall at x = 4). */
const through = (match: Match, z = 2.5, y = 1.2) => match.physics.raycastWorld({ x: 1, y, z }, { x: 1, y: 0, z: 0 }, 6) === null;

describe('breakable walls (map format v53)', () => {
  it('a wall between two pieces is one section, whichever side is marked, with both faces in it', () => {
    for (const map of [twoRooms({ breakWalls: { sides: ['0,0,0:E'] } }), twoRooms({}, { breakWalls: { sides: ['0,0,0:W'] } })]) {
      const s = wallSections(map);
      expect(s.length).toBe(1);
      expect(s[0]!.edge.edge).toBe('1,0,0:W');
      // Both rooms' walls on that line.
      expect(new Set(s[0]!.boxes.map((b) => b.sourceId))).toEqual(new Set(['room_a', 'room_b']));
      expect(s[0]!.edge.health).toBe(BREAK_WALL_HEALTH.default);
      expect(s[0]!.edge.shots).toBe(false);
    }
  });

  it('a piece with no sides listed has every wall breakable; others never', () => {
    const map = twoRooms({ breakWalls: {} });
    // Room A: four walls (its east one shared with B).
    expect(wallSections(map).length).toBe(4);
    expect(wallSections(twoRooms()).length).toBe(0);
  });

  it('a set piece placement passes its walls on to every tile part', async () => {
    const { expandSetPieces } = await import('../src/map/setPieces.ts');
    const { builtInSetPieces } = await import('../src/map/setPieceLibrary.ts');
    const lib = builtInSetPieces();
    const def = [...lib.pieces.values()].find((d) => d.parts.some((p) => p.kind === 'tile'))!;
    const map = makeMap([]);
    map.setPieces = [{ id: 'sp1', piece: def.id, x: 0, y: 0, z: 0, rotation: 0, mirror: false, breakWalls: { health: 500, shots: true } }];
    const out = expandSetPieces(map, lib).map;
    const tiles = out.classicStructure.tiles;
    expect(tiles.length).toBeGreaterThan(0);
    for (const t of tiles) expect(t.breakWalls).toEqual({ health: 500, shots: true });
  });

  it('play leaves the section out of the level and collides with it through the scenario', () => {
    const map = twoRooms({ breakWalls: { sides: ['0,0,0:E'] } });
    const geometry = buildMapGeometry(map);
    expect(geometry.filter((b) => b.breakWall === 0).length).toBeGreaterThan(0);
    // The section's trim (baseboards) goes with it.
    expect(buildMapDecor(map).some((b) => b.breakWall === 0)).toBe(true);
    const loaded = loadMap(map);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
    const match = new Match(loaded.map, undefined, 3);
    match.addHuman('me');
    match.step();
    expect(through(match)).toBe(false);
    expect(stateOf(match, wallSectionIndex(loaded.map, 0))?.[1]).toBe(100);
  });

  it('explosives break it into a hole; shots alone do not; it comes back next round', () => {
    const map = twoRooms({ breakWalls: { sides: ['0,0,0:E'], health: 200 } });
    const loaded = loadMap(map);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
    const match = new Match(loaded.map, undefined, 3);
    match.addHuman('me');
    match.step();
    const i = wallSectionIndex(loaded.map, 0);
    // Gunfire does nothing to an explosives-only wall.
    const hit = match.physics.raycastHit({ x: 1, y: 1.2, z: 2.5 }, { x: 1, y: 0, z: 0 }, 6);
    expect(hit).not.toBeNull();
    expect(match.scenario.damageBody(hit!.handle, 500, null)).toBe(true);
    expect(stateOf(match, i)?.[1]).toBe(100);
    // A blast takes some (less further off); a few break it.
    match.scenario.splash({ x: 3, y: 1, z: 0 }, 4, 100, 20, null, match.physics);
    const after = stateOf(match, i)![1];
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(100);
    for (let n = 0; n < 3; n++) match.scenario.splash({ x: 3, y: 1, z: 0 }, 4, 100, 20, null, match.physics);
    expect(stateOf(match, i)?.[1]).toBe(0);
    // A hole at chest height in the middle; the ends and the part over the hole still stand.
    expect(through(match)).toBe(true);
    expect(through(match, 3.8)).toBe(false);
    expect(through(match, 2.5, 3.7)).toBe(false);
    match.scenario.reset();
    expect(stateOf(match, i)?.[1]).toBe(100);
    expect(through(match)).toBe(false);
  });

  it('with shots, gunfire breaks it too', () => {
    const map = twoRooms({ breakWalls: { sides: ['0,0,0:E'], health: 50, shots: true } });
    const loaded = loadMap(map);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
    const match = new Match(loaded.map, undefined, 3);
    match.addHuman('me');
    match.step();
    const i = wallSectionIndex(loaded.map, 0);
    const hit = match.physics.raycastHit({ x: 1, y: 1.2, z: 2.5 }, { x: 1, y: 0, z: 0 }, 6);
    expect(hit).not.toBeNull();
    expect(match.scenario.damageBody(hit!.handle, 60, null)).toBe(true);
    expect(stateOf(match, i)?.[1]).toBe(0);
  });

  it('glass in a broken wall shatters with it and stays gone while it is', () => {
    const map = twoRooms({ breakWalls: { sides: ['0,0,0:E'] }, edges: { '0,0,0:E': 'window' }, glass: { '0,0,0:E': 'reinforced' } });
    const loaded = loadMap(map);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
    const s = wallSections(loaded.map);
    expect(s[0]!.glass.length).toBeGreaterThan(0);
    const match = new Match(loaded.map, undefined, 3);
    match.addHuman('me');
    match.step();
    for (let n = 0; n < 4; n++) match.scenario.splash({ x: 3, y: 1, z: 0 }, 4, 100, 20, null, match.physics);
    for (const g of s[0]!.glass) expect(stateOf(match, g)?.[1]).toBe(0);
  });

  it('remains are the same wherever they are worked out, and at most MAX_BREAK_WALLS sections play', () => {
    const map = twoRooms({ breakWalls: {} }, { breakWalls: {} });
    expect(JSON.stringify(wallSections(map).map((s) => s.remains))).toBe(JSON.stringify(wallSections(structuredClone(map)).map((s) => s.remains)));
    const many = makeMap(Array.from({ length: 30 }, (_, k) => ({ id: `r${k}`, tile: 'core.room', x: k * 2, y: 0, z: 0, rotation: 0 as const, breakWalls: {} })));
    expect(wallSections(many).length).toBe(MAX_BREAK_WALLS);
  });
});
