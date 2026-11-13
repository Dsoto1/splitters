import { beforeAll, describe, expect, it } from 'vitest';
import { NavWorld, initNavigation } from '../src/nav/index.ts';
import {
  PhysicsWorld,
  builtInSetPieces,
  buildMapGeometry,
  buriedPassageLines,
  coreCatalog,
  expandSetPieces,
  groundCutAt,
  initPhysics,
  ladderLinks,
  mapGroundBores,
  mapLadders,
  mapTerrainMesh,
  newMapDocument,
  newTerrain,
  openEnds,
  stepMovement,
  terrainHeightAt,
  withGroundAsPlayed,
  type MapDocument,
  type Rotation,
  type TilePlacement,
} from '../src/index.ts';

/**
 * Tileset 04 step 4 (docs/map-briefs/tunnels/PLAN_2026-11-13.md): the tunnel kit's pieces of more than one cell or
 * level. A flat field (0.15 m under level 0, as new ground lies) with the pieces under it.
 */
type Placed = Partial<TilePlacement> & { tile: string; x: number; y: number };
function field(tiles: Placed[], extra: Partial<MapDocument> = {}): MapDocument {
  const doc = newMapDocument('Tunnels');
  const t = newTerrain(96, 2);
  return { ...doc, terrain: { ...t, baseY: -0.15 }, entities: [], classicStructure: { ...doc.classicStructure, tiles: tiles.map((p, i) => ({ id: `tile_${i}`, z: -1, rotation: 0 as Rotation, ...p })) }, ...extra };
}
const FIELD = -0.15;

function world(map: MapDocument) {
  const geometry = buildMapGeometry(map);
  const physics = new PhysicsWorld(geometry, mapTerrainMesh(map));
  const nav = NavWorld.build(geometry, mapTerrainMesh(map));
  return { physics, nav, free: () => (nav.destroy(), physics.free()) };
}

/** Walk north from `from` until z passes `to`; where it ends, and the lowest and highest it was. */
function walkNorth(physics: PhysicsWorld, from: { x: number; y: number; z: number }, to: number, ticks = 1500) {
  const collider = physics.createPlayerCollider();
  let state = { pos: { ...from }, velY: 0, grounded: false };
  let low = Infinity;
  let high = -Infinity;
  for (let i = 0; i < ticks && state.pos.z < to; i++) {
    state = stepMovement(physics, collider, state, { seq: i, forward: 1, right: 0, yaw: 0, pitch: 0, buttons: 0 });
    low = Math.min(low, state.pos.y);
    high = Math.max(high, state.pos.y);
  }
  return { pos: state.pos, low, high };
}

beforeAll(async () => {
  await initPhysics();
  await initNavigation();
});

describe('tunnel kit: stairs and slopes climb a level, buried', () => {
  for (const shape of ['stairs', 'slope']) {
    it(`${shape}: two levels down to one level down, under a field that stays as made; walked and routed both ways`, () => {
      const map = withGroundAsPlayed(
        field([
          { tile: 'core.tunnel_concrete_straight', x: 0, y: -1, z: -2 },
          { tile: `core.tunnel_concrete_${shape}`, x: 0, y: 0, z: -2 },
          { tile: 'core.tunnel_concrete_straight', x: 0, y: 1, z: -1 },
        ]),
      );
      const t = map.terrain!;
      // Its cover at the top is the upper tunnel's (0.1 m over the cap, the field's own height): nothing is raised.
      for (let z = -14; z <= 14; z += 1) for (let x = -10; x <= 10; x += 1) expect(terrainHeightAt(t, x, z), `${x},${z}`).toBeCloseTo(FIELD, 6);
      const w = world(map);
      // Up: from the low tunnel's floor (8 m down) to the upper one's (4 m down), on the flight all the way.
      const up = walkNorth(w.physics, { x: 0.5, y: -7.9, z: -11 }, 11);
      expect(up.pos.z).toBeGreaterThan(10.9);
      expect(up.pos.y).toBeCloseTo(-4, 1);
      expect(up.low).toBeGreaterThan(-8.06);
      expect(up.high).toBeLessThan(-3.9);
      // Headroom all the way: a shot up from 1 m over the flight's line meets the soffit 2 m or more on.
      for (const z of [-3.5, -2, 0, 2, 3.5]) {
        const floor = -8 + (z + 4) / 2;
        const hit = w.physics.raycastWorld({ x: 0.9, y: floor + 1.2, z }, { x: 0, y: 1, z: 0 }, 20)!;
        expect(hit, `over z ${z}`).toBeGreaterThan(1.9);
        expect(hit, `over z ${z}`).toBeLessThan(2.6);
      }
      // No slit to the sky where the climbing soffit meets the level ones: straight up from inside, every centimetre
      // across both joints (and every 10 cm between), the soffit is overhead.
      const zs: number[] = [];
      for (let z = -4.4; z <= -3.5; z += 0.01) zs.push(z);
      for (let z = -3.5; z <= 3.5; z += 0.1) zs.push(z);
      for (let z = 3.5; z <= 4.4; z += 0.01) zs.push(z);
      for (const z of zs) {
        const floor = -8 + Math.max(0, Math.min(4, (z + 4) / 2));
        // (The piece's own soffit, 3.3 m over the floor's line: not the field's underside further up.)
        for (const x of [-1.75, 0, 1.75]) expect(w.physics.raycastWorld({ x, y: floor + 1.5, z }, { x: 0, y: 1, z: 0 }, 30) ?? 99, `overhead at ${x}, ${z.toFixed(2)}`).toBeLessThan(2);
      }
      const path = w.nav.findPath({ x: 0, y: -8, z: -10 }, { x: 0, y: -4, z: 10 })!;
      expect(path).not.toBeNull();
      expect(path[path.length - 1]!.y).toBeCloseTo(-4, 0);
      const back = w.nav.findPath({ x: 0, y: -4, z: 10 }, { x: 0, y: -8, z: -10 })!;
      expect(back).not.toBeNull();
      expect(back[back.length - 1]!.y).toBeCloseTo(-8, 0);
      w.free();
    });
  }

  it('stairs up to the surface level: the earth climbs with the soffit and covers the top (Backwoods Lodge: the drain up into the cellar)', () => {
    const map = withGroundAsPlayed(
      field([
        { tile: 'core.tunnel_concrete_straight', x: 0, y: -1 },
        { tile: 'core.tunnel_concrete_stairs', x: 0, y: 0 },
        { tile: 'core.tunnel_concrete_straight', x: 0, y: 1, z: 0 },
      ]),
    );
    const t = map.terrain!;
    // Over the low tunnel the field; over the flight it climbs; over the top stretch it is over the soffit there (3.85 m).
    expect(terrainHeightAt(t, 0, -12)).toBeCloseTo(FIELD, 6);
    expect(terrainHeightAt(t, 0, -3)!).toBeGreaterThan(0.8);
    expect(terrainHeightAt(t, 0, 3)!).toBeGreaterThan(3.8);
    expect(terrainHeightAt(t, 0, 3)!).toBeLessThan(4.2);
    const w = world(map);
    const up = walkNorth(w.physics, { x: 0.5, y: -3.9, z: -11 }, 11);
    expect(up.pos.z).toBeGreaterThan(10.9);
    expect(up.pos.y).toBeCloseTo(0, 1);
    // The mound over it is walked over, side to side.
    expect(w.nav.findPath({ x: -20, y: FIELD, z: 0 }, { x: 20, y: FIELD, z: 0 })).not.toBeNull();
    w.free();
  });
});

describe('tunnel kit: surface stairs (the mouth for flat ground)', () => {
  it('open to the sky between low walls, the field level to them; walked up out of the tunnel and routed down into it', () => {
    const map = withGroundAsPlayed(
      field([
        { tile: 'core.tunnel_concrete_straight', x: 0, y: -1 },
        { tile: 'core.tunnel_concrete_descent', x: 0, y: 0 },
      ]),
    );
    const t = map.terrain!;
    // The field is as made beside the walls and beyond the top (within the 0.1 m it is brought to the top step).
    for (const [x, z] of [[-6, 0], [6, 0], [-4, -3], [4, 3], [0, 10], [-6, 8]] as [number, number][]) expect(terrainHeightAt(t, x, z)!, `${x},${z}`).toBeCloseTo(FIELD, 1);
    expect(terrainHeightAt(t, 0, 5)!).toBeGreaterThan(-0.2);
    expect(terrainHeightAt(t, 0, 5)!).toBeLessThanOrEqual(0);
    // No ground over the steps: the sky is seen from them.
    const cuts = mapGroundBores(map).cuts;
    expect(groundCutAt(cuts, 0, FIELD, 0, 0)).toBe(true);
    expect(groundCutAt(cuts, 3, FIELD, 0, 0)).toBe(false);
    const w = world(map);
    expect(w.physics.raycastWorld({ x: 0.5, y: -1.5, z: 0 }, { x: 0, y: 1, z: 0 }, 40)).toBeNull();
    const up = walkNorth(w.physics, { x: 0.5, y: -3.9, z: -11 }, 10);
    expect(up.pos.z).toBeGreaterThan(9.9);
    expect(up.pos.y).toBeGreaterThan(-0.25);
    expect(up.pos.y).toBeLessThan(0.05);
    const down = w.nav.findPath({ x: 12, y: FIELD, z: -2 }, { x: 0, y: -4, z: -10 })!;
    expect(down).not.toBeNull();
    expect(down[down.length - 1]!.y).toBeCloseTo(-4, 0);
    w.free();
  });
});

describe('tunnel kit: a shaft and a riser (ladders)', () => {
  it('the Tunnel Shaft set piece: a hatch level with the field, sky seen from under it, and a ladder whose foot and top bots reach', () => {
    const doc = field([
      { tile: 'core.tunnel_concrete_straight', x: 0, y: -1 },
      { tile: 'core.tunnel_concrete_straight', x: 0, y: 1 },
    ]);
    const placed: MapDocument = { ...doc, setPieces: [{ id: 'piece_shaft', piece: 'setpiece.tunnel_shaft', x: 0, y: 0, z: -1, rotation: 0, mirror: false }] };
    const map = withGroundAsPlayed(expandSetPieces(placed, builtInSetPieces()).map);
    const t = map.terrain!;
    for (let z = -14; z <= 14; z += 1) for (let x = -10; x <= 10; x += 1) expect(terrainHeightAt(t, x, z), `${x},${z}`).toBeCloseTo(FIELD, 6);
    const ladders = mapLadders(map.entities as never);
    expect(ladders.map((l) => [l.pos, l.height])).toEqual([[{ x: -1.75, y: -4, z: 0 }, 3.85]]);
    const w = world(map);
    // Under the hatch the sky; beside it the cap.
    expect(w.physics.raycastWorld({ x: -1.0, y: -3, z: 0 }, { x: 0, y: 1, z: 0 }, 40)).toBeNull();
    expect(w.physics.raycastWorld({ x: 1.0, y: -3, z: 0 }, { x: 0, y: 1, z: 0 }, 40)!).toBeLessThan(2.4);
    // The passage is still walked past the ladder.
    const through = walkNorth(w.physics, { x: 0.8, y: -3.9, z: -11 }, 11);
    expect(through.pos.z).toBeGreaterThan(10.9);
    // Bots: the ladder's links (as every ladder's) start on the tunnel's floor and end on the field by the hatch.
    const [upLink] = ladderLinks(ladders);
    expect(upLink!.end.y).toBeCloseTo(FIELD, 6);
    const toFoot = w.nav.findPath({ x: 0, y: -4, z: -10 }, upLink!.start)!;
    expect(toFoot).not.toBeNull();
    expect(Math.hypot(toFoot[toFoot.length - 1]!.x - upLink!.start.x, toFoot[toFoot.length - 1]!.z - upLink!.start.z)).toBeLessThan(0.5);
    expect(toFoot[toFoot.length - 1]!.y).toBeCloseTo(-4, 0);
    const fromTop = w.nav.findPath(upLink!.end, { x: 20, y: FIELD, z: 10 })!;
    expect(fromTop).not.toBeNull();
    expect(Math.hypot(fromTop[0]!.x - upLink!.end.x, fromTop[0]!.z - upLink!.end.z)).toBeLessThan(0.5);
    expect(fromTop[0]!.y).toBeCloseTo(FIELD, 0);
    w.free();
  });

  it('the Tunnel Riser set piece: a capped well between a tunnel two levels down and one a level down, a ladder between their floors', () => {
    const doc = field([
      { tile: 'core.tunnel_concrete_straight', x: 0, y: -1, z: -2 },
      { tile: 'core.tunnel_concrete_straight', x: 0, y: 1, z: -1 },
    ]);
    const placed: MapDocument = { ...doc, setPieces: [{ id: 'piece_riser', piece: 'setpiece.tunnel_riser', x: 0, y: 0, z: -2, rotation: 0, mirror: false }] };
    const map = withGroundAsPlayed(expandSetPieces(placed, builtInSetPieces()).map);
    const t = map.terrain!;
    for (let z = -14; z <= 14; z += 1) for (let x = -10; x <= 10; x += 1) expect(terrainHeightAt(t, x, z), `${x},${z}`).toBeCloseTo(FIELD, 6);
    const ladders = mapLadders(map.entities as never);
    expect(ladders.length).toBe(1);
    const w = world(map);
    // The well: 7.3 m clear from the low floor in front of the ladder; the low passage's own soffit further south.
    expect(w.physics.raycastWorld({ x: 0, y: -7, z: 0.5 }, { x: 0, y: 1, z: 0 }, 40)!).toBeCloseTo(6.3, 1);
    expect(w.physics.raycastWorld({ x: 0, y: -7, z: -3 }, { x: 0, y: 1, z: 0 }, 40)!).toBeCloseTo(2.3, 1);
    const [upLink] = ladderLinks(ladders);
    const toFoot = w.nav.findPath({ x: 0, y: -8, z: -10 }, upLink!.start)!;
    expect(toFoot).not.toBeNull();
    expect(toFoot[toFoot.length - 1]!.y).toBeCloseTo(-8, 0);
    expect(Math.hypot(toFoot[toFoot.length - 1]!.x - upLink!.start.x, toFoot[toFoot.length - 1]!.z - upLink!.start.z)).toBeLessThan(0.5);
    const fromTop = w.nav.findPath(upLink!.end, { x: 0, y: -4, z: 10 })!;
    expect(fromTop).not.toBeNull();
    expect(fromTop[0]!.y).toBeCloseTo(-4, 0);
    expect(Math.hypot(fromTop[0]!.x - upLink!.end.x, fromTop[0]!.z - upLink!.end.z)).toBeLessThan(0.5);
    w.free();
  });
});

describe('tunnel kit: a chamber', () => {
  const chamber = (rotation: Rotation = 0): MapDocument =>
    field([
      { tile: 'core.tunnel_concrete_chamber', x: 0, y: 0, rotation },
      { tile: 'core.tunnel_concrete_straight', x: 0, y: -1 },
      { tile: 'core.tunnel_concrete_straight', x: 0, y: 2 },
      { tile: 'core.tunnel_concrete_straight', x: -1, y: 0, rotation: 1 },
      { tile: 'core.tunnel_concrete_straight', x: 2, y: 0, rotation: 1 },
    ]);

  it('2 x 2 cells under a field that stays as made; a passage runs straight through it and bots route to every opening', () => {
    const map = withGroundAsPlayed(chamber());
    const t = map.terrain!;
    for (let z = -14; z <= 22; z += 1) for (let x = -14; x <= 22; x += 1) expect(terrainHeightAt(t, x, z), `${x},${z}`).toBeCloseTo(FIELD, 6);
    const w = world(map);
    const through = walkNorth(w.physics, { x: 0.5, y: -3.9, z: -11 }, 19, 2500);
    expect(through.pos.z).toBeGreaterThan(18.9);
    expect(through.high).toBeLessThan(-3.9);
    // The room is 14 m across inside, under one soffit.
    expect(w.physics.raycastWorld({ x: -2.9, y: -3, z: 9 }, { x: 1, y: 0, z: 0 }, 40)!).toBeCloseTo(13.9, 1);
    expect(w.physics.raycastWorld({ x: 8, y: -3.5, z: 8 }, { x: 0, y: 1, z: 0 }, 40)!).toBeCloseTo(2.8, 1);
    for (const to of [{ x: 0, z: 18 }, { x: -10, z: 0 }, { x: 18, z: 0 }, { x: 9, z: 9 }]) {
      const path = w.nav.findPath({ x: 0, y: -4, z: -10 }, { x: to.x, y: -4, z: to.z })!;
      expect(path, `${to.x},${to.z}`).not.toBeNull();
      const end = path[path.length - 1]!;
      expect(Math.hypot(end.x - to.x, end.z - to.z), `${to.x},${to.z}`).toBeLessThan(0.6);
    }
    w.free();
  });

  it('its openings are ends like any piece\'s (four when it stands alone, none when each has a tunnel on it), turned with it', () => {
    expect(openEnds(chamber())).toEqual(expect.arrayContaining([]));
    const joined = openEnds(chamber()).filter((e) => e.tile === 'tile_0');
    expect(joined).toEqual([]);
    const alone = field([{ tile: 'core.tunnel_concrete_chamber', x: 0, y: 0 }]);
    expect(openEnds(alone).map((e) => `${e.side}@${e.x},${e.y}`).sort()).toEqual(['E@2,0', 'N@0,2', 'S@0,-1', 'W@-1,0']);
    const turned = field([{ tile: 'core.tunnel_concrete_chamber', x: 0, y: 0, rotation: 1 }]);
    expect(openEnds(turned).length).toBe(4);
  });

  it('plans draw the pieces of more than one cell by their own sides (turned with the piece)', () => {
    const def = coreCatalog.get('core.tunnel_concrete_chamber')!;
    expect(def.cells.length).toBe(4);
    const lines = buriedPassageLines(field([{ tile: 'core.tunnel_concrete_chamber', x: 0, y: 0 }]));
    // All inside the piece's 16 m square, and its long sides are the room's (the inner faces, 1 m in).
    for (const l of lines) for (const [x, z] of [l.a, l.b]) expect(x >= -4 && x <= 12 && z >= -4 && z <= 12, `${x},${z}`).toBe(true);
    expect(lines.some((l) => l.a[1] === 11 && l.b[1] === 11 && Math.abs(l.b[0] - l.a[0]) > 8)).toBe(true);
    const stair = buriedPassageLines(field([{ tile: 'core.tunnel_concrete_stairs', x: 2, y: 3, rotation: 1 }]));
    // Turned a quarter: its two sides run east-west, 1.8 m either side of the cell's middle (z = 24).
    expect(stair.map((l) => [l.a[1], l.b[1]]).sort()).toEqual([[22.2, 22.2], [25.8, 25.8]]);
    expect(stair.every((l) => Math.min(l.a[0], l.b[0]) === 12 && Math.max(l.a[0], l.b[0]) === 20 && l.y === -4)).toBe(true);
  });
});

describe('tunnel kit: the new shapes come in every family', () => {
  it('stairs, slope, surface stairs, shaft, riser and chamber: the same cells, ports, collision and bore in brick', () => {
    for (const shape of ['stairs', 'slope', 'descent', 'shaft', 'riser', 'chamber']) {
      const base = coreCatalog.get(`core.tunnel_concrete_${shape}`)!;
      const brick = coreCatalog.get(`core.tunnel_brick_${shape}`)!;
      expect(brick.cells, shape).toEqual(base.cells);
      expect(brick.ports, shape).toEqual(base.ports);
      expect(brick.bore, shape).toEqual(base.bore);
      const hard = (d: typeof base) => [...(d.extraFloors ?? []), ...(d.solids ?? []).filter((b) => b.kind !== 'trim')].map(({ surface: _s, ...b }) => b);
      expect(hard(brick), shape).toEqual(hard(base));
    }
  });
});
