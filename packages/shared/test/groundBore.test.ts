import { beforeAll, describe, expect, it } from 'vitest';
import { NavWorld, initNavigation } from '../src/nav/index.ts';
import {
  COVER_BANK,
  MOUTH_BANK,
  PhysicsWorld,
  buildMapGeometry,
  coreCatalog,
  cutGroundPolygon,
  groundCutAt,
  initPhysics,
  mapGroundBores,
  mapTerrainMesh,
  newMapDocument,
  newTerrain,
  openGroundAtMouths,
  stepMovement,
  terrainHeightAt,
  terrainTriangles,
  terrainTrianglesCut,
  terrainUnderFloors,
  tileOptionsOf,
  validateMap,
  withGroundAsPlayed,
  type GroundCut,
  type MapDocument,
  type P3,
  type Rotation,
} from '../src/index.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** The ridge's height over z (it runs east-west): 12 m at its crest, down 1 in 2 to flat ground from |z| = 24. */
const ridge = (z: number) => Math.max(0, 12 - Math.abs(z) * 0.5);

/**
 * A ridge 12 m high with a buried vaulted tunnel straight through it along x = 0: a portal in each slope (cells
 * y = ∓2, where the hill is 2 to 4 m over the floor) and three buried tunnels between. `spacing`: the terrain's grid.
 */
function ridgeMap(spacing = 2, tiles: [string, number, number, Rotation][] = [
  ['core.tunnel_portal', 0, -2, 0],
  ['core.tunnel_vault_buried', 0, -1, 0],
  ['core.tunnel_vault_buried', 0, 0, 0],
  ['core.tunnel_vault_buried', 0, 1, 0],
  ['core.tunnel_portal', 0, 2, 2],
]): MapDocument {
  const doc = newMapDocument('Ridge');
  const t = newTerrain(96, spacing);
  for (let r = 0; r < t.rows; r++) for (let c = 0; c < t.cols; c++) t.heights[r * t.cols + c] = Math.round(ridge(t.origin[1] + r * t.spacing) * 100);
  return {
    ...doc,
    terrain: t,
    entities: [],
    classicStructure: { ...doc.classicStructure, tiles: tiles.map(([tile, x, y, rotation], i) => ({ id: `tile_${i}`, tile, x, y, z: 0, rotation })) },
  };
}

const played = (doc: MapDocument): MapDocument => withGroundAsPlayed(doc);

describe('cutting a polygon of ground by a box', () => {
  const cut: GroundCut = { min: [-1, 0, -1], max: [1, 4, 1] };
  const area = (polys: readonly (readonly P3[])[]) => {
    let a = 0;
    for (const p of polys) for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j]![0] * p[i]![2] - p[i]![0] * p[j]![2]) / 2;
    return a;
  };
  const tri = (y: number): P3[] => [
    [-4, y, -4],
    [-4, y, 4],
    [4, y, 4],
  ];

  it('ground above the box, below it or beside it comes back as it was (the same array: nothing is redrawn)', () => {
    for (const y of [4, 9, 0, -3]) {
      const t = tri(y);
      const out = cutGroundPolygon(t, [cut]);
      expect(out.length).toBe(1);
      expect(out[0]).toBe(t);
    }
    const beside: P3[] = [
      [2, 1, 2],
      [2, 1, 6],
      [6, 1, 6],
    ];
    expect(cutGroundPolygon(beside, [cut])[0]).toBe(beside);
  });

  it('ground through the box loses exactly the box\'s footprint, and keeps its winding', () => {
    const t = tri(2);
    const out = cutGroundPolygon(t, [cut]);
    // The triangle (32 m², wound clockwise in x/z here) covers the half of the 2 × 2 footprint on its side of the diagonal.
    expect(area(out)).toBeCloseTo(area([t]) + 2, 6);
    for (const p of out) expect(Math.sign(area([p]))).toBe(Math.sign(area([t])));
    for (const p of out) for (const v of p) expect(groundCutAt([cut], v[0], v[1], v[2])).toBe(false);
  });

  it('a slope through the box keeps what is above its top and below its bottom', () => {
    // Rising 1 in 1 along x: y = x + 2 over the footprint is 1 to 3; a box from 1.5 to 2.5 takes the middle band.
    const slope: P3[] = [
      [-4, -2, -4],
      [-4, -2, 4],
      [4, 6, 4],
      [4, 6, -4],
    ];
    const band: GroundCut = { min: [-1, 1.5, -1], max: [1, 2.5, 1] };
    const out = cutGroundPolygon(slope, [band]);
    expect(Math.abs(area(out))).toBeCloseTo(64 - 2, 6);
    for (const p of out) for (const v of p) expect(v[1]).toBeCloseTo(v[0] + 2, 6);
  });
});

describe('a buried tunnel under a ridge: the hill stays on top and opens at the mouths', () => {
  it('the tiles: every vaulted tunnel has an Under ground twin with a bore, and the portal opens the ground', () => {
    for (const id of ['core.tunnel_vault', 'core.tunnel_vault_bend', 'core.tunnel_vault_t', 'core.tunnel_vault_cross']) {
      const opts = tileOptionsOf(id);
      expect(opts.map((o) => o.option).sort()).toEqual(['sideWalls', 'underGround']);
      const twin = coreCatalog.get(`${id}_buried`)!;
      expect(twin.optionOf).toEqual({ tile: id, option: 'underGround' });
      expect(twin.bore?.cut?.length).toBe(1);
      expect(twin.ports).toEqual(coreCatalog.get(id)!.ports);
      // On the buried tile its own option is on and the other is offered off (one at a time).
      expect(tileOptionsOf(twin.id).map((o) => [o.option, o.on, o.off])).toEqual(expect.arrayContaining([['underGround', true, id], ['sideWalls', false, id]]));
      // The plain and side-walled tiles bore nothing: shipped maps play as they did.
      expect(coreCatalog.get(id)!.bore).toBeUndefined();
      expect(coreCatalog.get(`${id}_walled`)!.bore).toBeUndefined();
    }
    expect(coreCatalog.get('core.tunnel_portal')!.bore?.open?.length).toBe(1);
    const b = mapGroundBores(ridgeMap());
    // Each portal cuts twice (the stretch behind its headwall up to the cap, its apron at any height).
    expect(b.cuts.length).toBe(7);
    expect(b.openings.length).toBe(2);
    // The south portal's mouth (its south edge, facing south), and the north one's turned round.
    expect(b.openings[0]).toEqual({ x0: -3.4, z0: -20, x1: 3.4, z1: -20, y: 0, out: [0, -1] });
    expect(b.openings[1]).toEqual({ x0: -3.4, z0: 20, x1: 3.4, z1: 20, y: 0, out: [0, 1] });
    // Rims: the headwall's coping and two a wing wall; covers: earth over every cap.
    expect(b.rims.length).toBe(10);
    expect(b.covers.length).toBe(5);
  });

  for (const spacing of [2, 2.5, 4]) {
    it(`the hill is as made over the tunnel and away from the mouths (${spacing} m grid)`, () => {
      const doc = ridgeMap(spacing);
      const made = doc.terrain!;
      const t = played(doc).terrain!;
      // Over the tunnel's middle three cells the ground is untouched (the floors pull nothing down).
      for (let z = -6; z <= 6; z += 1) for (let x = -4; x <= 4; x += 1) expect(terrainHeightAt(t, x, z), `${x},${z}`).toBeCloseTo(terrainHeightAt(made, x, z)!, 6);
      // The map's own ground is not changed (the opening is worked out, never stored).
      expect(doc.terrain).toBe(made);
      // In front of each mouth the ground is down to just under the floor, out to where the ridge ends (daylight).
      // (Flat across the mouth's own width at the grid's fineness: on a coarse grid the banks' toes reach in from the
      // sides, at most a low step's height at the passage's edge on a 4 m grid.)
      for (const z of [-23.5, -22, -20.5, 20.5, 22, 23.5]) {
        expect(terrainHeightAt(t, 0, z)).toBeLessThanOrEqual(-0.05 + 1e-6);
        for (const x of [-1.7, 1.7]) expect(terrainHeightAt(t, x, z)!).toBeLessThanOrEqual(spacing > 2.5 ? 0.6 : spacing > 2 ? 0.25 : -0.05 + 1e-6);
      }
      // The earth meets each wing wall at its sloping top (3.6 m at the headwall to 1.2 m at its foot): never bare
      // masonry under it, never a hill hanging over it.
      for (const side of [-1, 1]) {
        for (const x of [-4.01, 4.01]) {
          // (Up to the last grid square before the mouth, which belongs to the way in where the grid doesn't line up.)
          for (let d = 0.2; d <= (spacing === 2 ? 2.6 : 3.5 - spacing); d += 0.4) {
            const z = side * (16.5 + d);
            const want = 3.6 + ((1.2 - 3.6) * d) / 2.8;
            expect(Math.abs(terrainHeightAt(t, x, z)! - want), `wing ${x},${z}`).toBeLessThan(0.65);
          }
        }
      }
      // Worked out twice it is the same ground (the same object: nothing to redraw).
      expect(terrainUnderFloors({ ...doc, terrain: t })).toBe(t);
      // Far along the ridge it is as made.
      for (const x of [-40, -24, 24, 40]) for (const z of [-20, -10, 0, 10, 20]) expect(terrainHeightAt(t, x, z)).toBeCloseTo(terrainHeightAt(made, x, z)!, 6);
    });

    it(`no ground is left inside the bore, and none is lost outside it (${spacing} m grid)`, () => {
      const map = played(ridgeMap(spacing));
      const { cuts } = mapGroundBores(map);
      const mesh = mapTerrainMesh(map)!;
      const whole = terrainTriangles(map.terrain!);
      let kept = 0;
      let inside = 0;
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const p = [0, 1, 2].map((k) => [...mesh.positions.subarray(mesh.indices[i + k]! * 3, mesh.indices[i + k]! * 3 + 3)]);
        const a = ((p[1]![0]! - p[0]![0]!) * (p[2]![2]! - p[0]![2]!) - (p[2]![0]! - p[0]![0]!) * (p[1]![2]! - p[0]![2]!)) / 2;
        // Counter-clockwise from above, like the grid's own triangles (Recast's up-facing sense).
        expect(a).toBeLessThan(1e-6);
        kept += Math.abs(a);
        const centre = [0, 1, 2].map((d) => (p[0]![d]! + p[1]![d]! + p[2]![d]!) / 3);
        if (groundCutAt(cuts, centre[0]!, centre[1]!, centre[2]!)) inside++;
      }
      expect(inside).toBe(0);
      // What was taken out: only within the two portals' cells: each apron and headwall (4.5 m of the cell, at any
      // height), and behind the headwall only what is under the cap, where the earth covering the cap begins.
      const t = map.terrain!;
      const all = ((t.cols - 1) * spacing) * ((t.rows - 1) * spacing);
      expect(whole.indices.length / 6).toBe((t.cols - 1) * (t.rows - 1));
      const lost = all - kept;
      expect(lost).toBeGreaterThan(8 * 2 * 3.5 - 0.5);
      expect(lost).toBeLessThan(8 * 2 * (4.5 + 2 * spacing));
      // Over the middle of the tunnel the surface is whole: straight down from the sky is the hill, not the tunnel.
      expect(terrainTrianglesCut(map.terrain!, []).indices.length).toBe(whole.indices.length);
    });

    it(`players walk in at one mouth and out at the other; shots pass through and stop in the hill (${spacing} m grid)`, () => {
      const map = played(ridgeMap(spacing));
      const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
      // A shot along the passage, 1.5 m over its floor, from outside one mouth to outside the other.
      expect(physics.raycastWorld({ x: 0, y: 1.5, z: -26 }, { x: 0, y: 0, z: 1 }, 52)).toBeNull();
      expect(physics.raycastWorld({ x: 0.9, y: 0.4, z: -26 }, { x: 0, y: 0, z: 1 }, 52)).toBeNull();
      // Beside the tunnel the hill stops it: at 1.5 m the ridge's face is 21 m from its middle.
      const hill = physics.raycastWorld({ x: 12, y: 1.5, z: -30 }, { x: 0, y: 0, z: 1 }, 60)!;
      expect(hill).toBeCloseTo(30 - 21, 0);
      // From the sky over the tunnel's middle: the hill's top (12 m), not the tunnel.
      expect(physics.raycastWorld({ x: 0, y: 30, z: 0 }, { x: 0, y: -1, z: 0 }, 60)).toBeCloseTo(18, 1);
      expect(physics.raycastWorld({ x: 0, y: 30, z: 8 }, { x: 0, y: -1, z: 0 }, 60)).toBeCloseTo(30 - 8, 1);
      // From inside, straight up: the vault, not the sky.
      expect(physics.raycastWorld({ x: 0.3, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }, 60)!).toBeLessThan(2.4);
      // Walk north from in front of the south mouth, through, and out the north one.
      const collider = physics.createPlayerCollider();
      let state = { pos: { x: 0.6, y: 0.5, z: -27 }, velY: 0, grounded: false };
      let low = Infinity;
      let high = -Infinity;
      for (let i = 0; i < 900 && state.pos.z < 27; i++) {
        state = stepMovement(physics, collider, state, { seq: i, forward: 1, right: 0, yaw: 0, pitch: 0, buttons: 0 });
        if (state.pos.z > -20 && state.pos.z < 20) {
          low = Math.min(low, state.pos.y);
          high = Math.max(high, state.pos.y);
        }
      }
      expect(state.pos.z).toBeGreaterThan(26.9);
      // On the tunnel's floor all the way (never up on the hill, never under the floor).
      expect(low).toBeGreaterThan(-0.06);
      expect(high).toBeLessThan(spacing > 2.5 ? 0.3 : 0.1);
      // And over the top: walking the hill above the tunnel stays on the hill.
      let over = { pos: { x: 0.6, y: ridge(-27) + 0.5, z: -27 }, velY: 0, grounded: false };
      const c2 = physics.createPlayerCollider();
      for (let i = 0; i < 400; i++) over = stepMovement(physics, c2, over, { seq: i, forward: 0, right: 1, yaw: 0, pitch: 0, buttons: 0 });
      for (let i = 0; i < 900 && over.pos.z < 0; i++) over = stepMovement(physics, c2, over, { seq: i, forward: 1, right: 0, yaw: 0, pitch: 0, buttons: 0 });
      expect(over.pos.z).toBeGreaterThanOrEqual(0);
      expect(over.pos.y).toBeGreaterThan(11);
      physics.free();
    });
  }

  it('bots route through the tunnel, not over the ridge', () => {
    const map = played(ridgeMap());
    const geometry = buildMapGeometry(map);
    const nav = NavWorld.build(geometry, mapTerrainMesh(map));
    const path = nav.findPath({ x: 0, y: 0, z: -28 }, { x: 0, y: 0, z: 28 })!;
    expect(path).not.toBeNull();
    let length = 0;
    for (let i = 1; i < path.length; i++) length += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y, path[i]!.z - path[i - 1]!.z);
    expect(length).toBeLessThan(60);
    expect(Math.max(...path.map((p) => p.y))).toBeLessThan(1);
    // And the hill's top over the tunnel is ground bots can stand on.
    const up = nav.findPath({ x: 30, y: 0, z: -28 }, { x: 0, y: 12, z: 0 });
    expect(up).not.toBeNull();
    expect(up![up!.length - 1]!.y).toBeGreaterThan(11);
    nav.destroy();
  });

  it('without bores nothing changes: the plain and side-walled tunnels pull the ground as they did', () => {
    const tiles: [string, number, number, Rotation][] = [['core.tunnel_vault', 0, -1, 0], ['core.tunnel_vault_walled', 0, 0, 0], ['core.tunnel_vault', 0, 1, 0]];
    const map = ridgeMap(2, tiles);
    expect(mapGroundBores(map).cuts).toEqual([]);
    expect(mapTerrainMesh(played(map))!.indices.length).toBe(terrainTriangles(map.terrain!).indices.length);
    expect(openGroundAtMouths(map.terrain!, [])).toBe(map.terrain);
  });

  it('a buried end that comes out into the hill with no portal is reported; with portals the map is clean of it', () => {
    const open = validateMap(ridgeMap(2, [['core.tunnel_vault_buried', 0, -2, 0], ['core.tunnel_vault_buried', 0, -1, 0]]));
    expect(open.filter((i) => i.code === 'tunnel.mouth_buried').length).toBe(2);
    expect(validateMap(ridgeMap()).filter((i) => i.code === 'tunnel.mouth_buried')).toEqual([]);
    // An end the map maker walls up (the side's wall style) is a dead end, not a buried mouth.
    const walled = ridgeMap(2, [['core.tunnel_vault_buried', 0, 0, 0]]);
    walled.classicStructure.tiles[0]!.edges = { '0,0,0:N': 'wall', '0,0,0:S': 'wall' };
    expect(validateMap(walled).filter((i) => i.code === 'tunnel.mouth_buried')).toEqual([]);
  });

  it('on flat ground a buried run is a mound: earth over every cap and up every outer wall, the mouths open', () => {
    const doc = ridgeMap();
    const flat = { ...doc, terrain: { ...doc.terrain!, heights: doc.terrain!.heights.map(() => -15) } };
    const t = played(flat).terrain!;
    // Over the three buried cells and the stretch behind each headwall: at least 0.2 m of earth on the 3.75 m cap.
    for (let z = -15; z <= 15; z += 1) for (let x = -4; x <= 4; x += 1) expect(terrainHeightAt(t, x, z), `${x},${z}`).toBeGreaterThanOrEqual(3.95 - 1e-6);
    // The mound falls away at a slope bots walk (COVER_BANK): half way down 3 m out, the field again 8 m out.
    for (const x of [-7, 7]) expect(terrainHeightAt(t, x, 0)).toBeCloseTo(3.95 - 3 * COVER_BANK, 1);
    for (const x of [-12, 12]) expect(terrainHeightAt(t, x, 0)).toBeCloseTo(-0.15, 6);
    // The wing walls hold earth to their tops, and the way in is open.
    for (const x of [-4.01, 4.01]) expect(terrainHeightAt(t, x, -17.5)!).toBeGreaterThan(2.3);
    const map = played(flat);
    const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
    expect(physics.raycastWorld({ x: 0, y: 1.5, z: -26 }, { x: 0, y: 0, z: 1 }, 52)).toBeNull();
    // From the side the mound is in the way of a shot at the tunnel's wall.
    expect(physics.raycastWorld({ x: 12, y: 2, z: 0 }, { x: -1, y: 0, z: 0 }, 20)!).toBeLessThan(7.5);
    // Bots cross the mound over the tunnel's top (and go through it).
    const nav = NavWorld.build(buildMapGeometry(map), mapTerrainMesh(map));
    const over = nav.findPath({ x: -20, y: -0.15, z: 0 }, { x: 0, y: 3.95, z: 0 });
    expect(over).not.toBeNull();
    expect(over![over!.length - 1]!.y).toBeGreaterThan(3.8);
    expect(Math.hypot(over![over!.length - 1]!.x, over![over!.length - 1]!.z)).toBeLessThan(1);
    nav.destroy();
    physics.free();
  });
});

describe('the tunnel kit: one shell a shape, a family applied to it', () => {
  const SHAPES: Record<string, string[]> = { straight: ['N', 'S'], curve: ['S', 'E'], t: ['E', 'W', 'S'], cross: ['N', 'E', 'S', 'W'], end: ['S'], portal: ['N', 'S'] };

  it('every shape of the concrete family is a Tunnels tile with its ports, a bore and no theme paint', () => {
    for (const [shape, sides] of Object.entries(SHAPES)) {
      const def = coreCatalog.get(`core.tunnel_concrete_${shape}`)!;
      expect(def, shape).toBeDefined();
      expect(def.category).toBe('Tunnels');
      expect(def.ports.map((p) => p.side).sort()).toEqual([...sides].sort());
      expect(def.bore?.cut?.length).toBe(shape === 'portal' ? 2 : 1);
      expect(def.bore?.cover?.length).toBe(1);
      // The family's materials are on every part (a tunnel looks the same in any theme).
      for (const b of [...(def.solids ?? []), ...(def.extraFloors ?? [])]) expect(b.surface?.material, `${shape}`).toMatch(/^core\./);
      // What collides is the shell only: floor, masses, cap (and a portal's headwall and wings); the lining and trim are drawn.
      const hard = (def.solids ?? []).filter((b) => b.kind !== 'trim');
      expect(hard.length).toBeLessThanOrEqual(shape === 'portal' ? 20 : 9);
      expect((def.solids ?? []).some((b) => b.kind === 'trim')).toBe(true);
    }
    expect(coreCatalog.get('core.tunnel_concrete_portal')!.bore?.rim?.length).toBe(5);
  });

  it('the passage is the same clear box in every shape: 3.6 m wide, 3.3 m high, open to each port and closed elsewhere', () => {
    for (const [shape, sides] of Object.entries(SHAPES)) {
      // (The portal's middle is its headwall: its passage is checked behind it, below.)
      if (shape === 'portal') continue;
      const doc = ridgeMap(2, [[`core.tunnel_concrete_${shape}`, 0, 0, 0]]);
      const physics = new PhysicsWorld(buildMapGeometry(doc).filter((b) => b.sourceId === 'tile_0'), null);
      const out: Record<string, [number, number]> = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
      for (const [side, [dx, dz]] of Object.entries(out)) {
        for (const [off, y] of [[0, 0.2], [1.7, 0.2], [-1.7, 3.2], [1.7, 3.2]] as [number, number][]) {
          const hit = physics.raycastWorld({ x: -dz * off, y, z: dx * off }, { x: dx, y: 0, z: dz }, 4.5);
          if (sides.includes(side)) expect(hit, `${shape} ${side} ${off},${y}`).toBeNull();
          else expect(hit, `${shape} ${side} ${off},${y}`).toBeCloseTo(1.8, 1);
        }
      }
      // The soffit over the middle.
      expect(physics.raycastWorld({ x: 0.5, y: 1, z: 0.5 }, { x: 0, y: 1, z: 0 }, 5)).toBeCloseTo(2.3, 1);
      physics.free();
    }
    // The portal: the same passage behind its headwall, the same opening through it, then the apron between the wings.
    const doc = ridgeMap(2, [['core.tunnel_concrete_portal', 0, 0, 0]]);
    const physics = new PhysicsWorld(buildMapGeometry(doc).filter((b) => b.sourceId === 'tile_0'), null);
    for (const [x, y] of [[0, 0.2], [1.7, 0.2], [-1.7, 3.2], [1.7, 3.2]] as [number, number][]) {
      expect(physics.raycastWorld({ x, y, z: 2 }, { x: 0, y: 0, z: 1 }, 4)).toBeNull();
      expect(physics.raycastWorld({ x, y, z: 2 }, { x: 0, y: 0, z: -1 }, 8)).toBeNull();
    }
    expect(physics.raycastWorld({ x: 0, y: 1, z: 2 }, { x: 1, y: 0, z: 0 }, 5)).toBeCloseTo(1.8, 1);
    expect(physics.raycastWorld({ x: 0.5, y: 1, z: 2 }, { x: 0, y: 1, z: 0 }, 5)).toBeCloseTo(2.3, 1);
    // The headwall stops a shot beside and over the opening; the wing walls slope from 3.75 m down to 1.3 m.
    expect(physics.raycastWorld({ x: 2.5, y: 1, z: -3 }, { x: 0, y: 0, z: 1 }, 5)).toBeCloseTo(2.5, 1);
    expect(physics.raycastWorld({ x: 0, y: 4, z: -3 }, { x: 0, y: 0, z: 1 }, 5)).toBeCloseTo(2.5, 1);
    const wingTop = (z: number) => 6 - physics.raycastWorld({ x: 3.7, y: 6, z }, { x: 0, y: -1, z: 0 }, 8)!;
    expect(wingTop(-0.7)).toBeCloseTo(3.6, 0);
    expect(wingTop(-1.9)).toBeCloseTo(2.55, 0);
    expect(wingTop(-3.1)).toBeCloseTo(1.5, 0);
    expect(wingTop(-3.8)).toBeCloseTo(1.3, 1);
    physics.free();
  });

  it('a concrete tunnel through the ridge, joined to a vaulted one: walked and shot through, bots route through it', () => {
    const map = played(
      ridgeMap(2, [
        ['core.tunnel_concrete_portal', 0, -2, 0],
        ['core.tunnel_concrete_straight', 0, -1, 0],
        ['core.tunnel_concrete_cross', 0, 0, 0],
        ['core.tunnel_vault_buried', 0, 1, 0],
        ['core.tunnel_portal', 0, 2, 2],
        ['core.tunnel_concrete_end', -1, 0, 3],
        ['core.tunnel_concrete_curve', 1, 0, 1],
      ]),
    );
    expect(validateMap(map).filter((i) => i.code === 'tunnel.mouth_buried').length).toBe(1);
    const geometry = buildMapGeometry(map);
    const physics = new PhysicsWorld(geometry, mapTerrainMesh(map));
    expect(physics.raycastWorld({ x: 0, y: 1.5, z: -26 }, { x: 0, y: 0, z: 1 }, 52)).toBeNull();
    expect(physics.raycastWorld({ x: 0, y: 30, z: 0 }, { x: 0, y: -1, z: 0 }, 60)).toBeCloseTo(18, 1);
    const collider = physics.createPlayerCollider();
    let state = { pos: { x: 0.6, y: 0.5, z: -27 }, velY: 0, grounded: false };
    for (let i = 0; i < 900 && state.pos.z < 27; i++) state = stepMovement(physics, collider, state, { seq: i, forward: 1, right: 0, yaw: 0, pitch: 0, buttons: 0 });
    expect(state.pos.z).toBeGreaterThan(26.9);
    const nav = NavWorld.build(geometry, mapTerrainMesh(map));
    const path = nav.findPath({ x: 0, y: 0, z: -28 }, { x: 0, y: 0, z: 28 })!;
    expect(path).not.toBeNull();
    expect(Math.max(...path.map((q) => q.y))).toBeLessThan(1);
    // Into the dead end and back out.
    expect(nav.findPath({ x: 0, y: 0, z: -28 }, { x: -6, y: 0, z: 0 })).not.toBeNull();
    nav.destroy();
    physics.free();
  });
});
