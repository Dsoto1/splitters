import { beforeAll, describe, expect, it } from 'vitest';
import { NavWorld, initNavigation } from '../src/nav/index.ts';
import {
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
    expect(b.cuts.length).toBe(5);
    expect(b.openings.length).toBe(2);
    // The south portal's apron (it faces south), and the north one's turned round.
    expect(b.openings[0]).toEqual({ x0: -3.4, z0: -20, x1: 3.4, z1: -16.5, y: 0, out: [0, -1] });
    expect(b.openings[1]).toEqual({ x0: -3.4, z0: 16.5, x1: 3.4, z1: 20, y: 0, out: [0, 1] });
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
      // Over each apron the ground is just under the floor; nothing anywhere was raised.
      for (const z of [-19.5, -18, -16.6, 16.6, 18, 19.5]) for (const x of [-3.3, 0, 3.3]) expect(terrainHeightAt(t, x, z)).toBeCloseTo(-0.05, 6);
      for (let i = 0; i < t.heights.length; i++) expect(t.heights[i]!).toBeLessThanOrEqual(made.heights[i]!);
      // The banks rise no steeper than MOUTH_BANK from the flat ground (measured between neighbouring vertices near a mouth).
      for (let r = 0; r < t.rows - 1; r++) {
        for (let c = 0; c < t.cols - 1; c++) {
          const i = r * t.cols + c;
          if (t.heights[i] === made.heights[i] && t.heights[i + 1] === made.heights[i + 1] && t.heights[i + t.cols] === made.heights[i + t.cols]) continue;
          expect(Math.abs(t.heights[i + 1]! - t.heights[i]!) / 100 / spacing).toBeLessThanOrEqual(MOUTH_BANK + 0.02);
          expect(Math.abs(t.heights[i + t.cols]! - t.heights[i]!) / 100 / spacing).toBeLessThanOrEqual(MOUTH_BANK + 0.02);
        }
      }
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
      // What was taken out: only within the two portals' cells, where the ground is under the cap (3.75 m): each apron
      // (3.5 m of the cell) and the hill cut back behind the headwall (3.75 m up at MOUTH_BANK, and up to two grid squares).
      const t = map.terrain!;
      const all = ((t.cols - 1) * spacing) * ((t.rows - 1) * spacing);
      expect(whole.indices.length / 6).toBe((t.cols - 1) * (t.rows - 1));
      const lost = all - kept;
      expect(lost).toBeGreaterThan(8 * 2 * (3.5 + 3.75 / MOUTH_BANK) - 0.5);
      expect(lost).toBeLessThan(8 * 2 * (3.5 + 3.75 / MOUTH_BANK + 2 * spacing));
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
      expect(high).toBeLessThan(0.1);
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
  });
});
