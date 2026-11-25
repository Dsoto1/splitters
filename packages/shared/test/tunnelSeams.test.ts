import { beforeAll, describe, expect, it } from 'vitest';
import { NavWorld, initNavigation } from '../src/nav/index.ts';
import {
  PhysicsWorld,
  STAIR_HEADROOM,
  boxCorners,
  buildMapDecor,
  buildMapGeometry,
  coreCatalog,
  flatNormalOf,
  flatOf,
  initPhysics,
  lowHeadroom,
  openEnds,
  stepMovement,
  type MapDocument,
  type Rotation,
  type WorldBox,
} from '../src/index.ts';
import { makeMap } from './helpers.ts';

/**
 * Seamless tunnels (owner, 2026-11-18 "2a"; docs/map-briefs/tunnels/PLAN_2026-11-13.md, "Seamless tunnels"): textures
 * run on across tunnel pieces whichever way they are turned, the kit's repeating parts keep one beat across joints,
 * and every family has a Stair Tunnel (down a level over two cells, standing headroom, walked and routed by bots).
 */
type Placed = { tile: string; x: number; y: number; z?: number; rotation?: number; family?: string };
const mapOf = (tiles: Placed[]): MapDocument =>
  makeMap(
    tiles.map((t, i) => ({ id: `t${i}`, z: 0, ...t, rotation: (t.rotation ?? 0) as Rotation })),
    [[0, 0.1, -40]],
  );
const boxesOf = (map: MapDocument): WorldBox[] => [...buildMapGeometry(map), ...buildMapDecor(map)];
const near = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) < eps;

describe('textures run on across turned tunnel pieces', () => {
  it("a vault's strips: along the run the texture is laid by the world position, whichever way a piece is turned", () => {
    // (As an unturned box there would lay it: x along an east-west run, z along a north-south one.)
    // East-west: turned 1, 3, 1 (a half turn between neighbours). North-south: turned 0, 2.
    const ew = boxesOf(mapOf([0, 1, 2].map((x, i) => ({ tile: 'core.tunnel_vault', x, y: 0, rotation: i === 1 ? 3 : 1 }))));
    const ns = boxesOf(mapOf([0, 1, 2].map((y, i) => ({ tile: 'core.tunnel_vault', x: 0, y, rotation: i === 1 ? 2 : 0 }))));
    for (const [boxes, axis] of [[ew, 0], [ns, 2]] as const) {
      const strips = boxes.filter((b) => b.roll || b.pitch);
      expect(strips.length).toBeGreaterThanOrEqual(30);
      for (const b of strips) for (const p of boxCorners(b)) expect(flatOf(b, p)[axis]).toBeCloseTo(p[axis], 6);
    }
  });

  it('a box that is not turned lays its texture on its world corners, as before', () => {
    const b: WorldBox = { min: [1, 2, 3], max: [4, 5, 6], kind: 'wall', sourceId: 'x' };
    for (const p of boxCorners(b)) expect(flatOf(b, p)).toEqual(p);
    // Tilted but not turned: unchanged too (a ramp's slab), save a strip that says where it lies along its curve.
    const r: WorldBox = { ...b, pitch: 0.3 };
    for (const p of boxCorners(r)) expect(flatOf(r, p)[1]).toBeCloseTo(flatOf({ ...r, pitch: 0.3 }, p)[1], 9);
  });

  it("across a vault (the Vaulted Tunnel's, a room's vaulted ceiling) and the brick arch, the texture runs on from strip to strip", () => {
    const check = (strips: WorldBox[], exact: boolean) => {
      // Neighbours: the strip whose inner edge meets this one's (corner 1: +x, low y, low z; corner 0: -x).
      let joined = 0;
      for (const a of strips) {
        const ca = boxCorners(a);
        for (const b of strips) {
          if (a === b) continue;
          const cb = boxCorners(b);
          for (const [i, j] of [[1, 0], [5, 4]] as const) {
            const d = Math.hypot(ca[i]![0] - cb[j]![0], ca[i]![1] - cb[j]![1], ca[i]![2] - cb[j]![2]);
            if (d > (exact ? 1e-3 : 0.1)) continue;
            joined++;
            const ua = flatOf(a, ca[i]!);
            const ub = flatOf(b, cb[j]!);
            // Across the strips: the horizontal axis the vault spans (the one its strips' corners differ on).
            const k = Math.abs(ca[i]![0] - ca[i ^ 1]![0]) > Math.abs(ca[i]![2] - ca[i ^ 1]![2]) ? 0 : 2;
            expect(Math.abs(ua[k] - ub[k]), `strips ${a.tex} and ${b.tex}`).toBeLessThan(exact ? 1e-3 : 0.1);
          }
        }
      }
      return joined;
    };
    for (const rotation of [0, 1, 2, 3]) {
      const vault = boxesOf(mapOf([{ tile: 'core.tunnel_vault', x: 0, y: 0, rotation }])).filter((b) => b.roll || b.pitch);
      expect(vault.every((b) => b.tex !== undefined)).toBe(true);
      expect(check(vault, true)).toBeGreaterThanOrEqual(2 * (vault.length - 1));
      const brick = boxesOf(mapOf([{ tile: 'core.tunnel_brick_straight', x: 0, y: 0, rotation }])).filter((b) => b.roll && b.surface?.material === 'core.pbr_brick_old');
      expect(check(brick, false)).toBeGreaterThanOrEqual(8);
    }
  });
});

describe("the kit's repeating parts keep one beat across joints", () => {
  const trims = (id: string) => (coreCatalog.get(id)!.solids ?? []).filter((b) => b.kind === 'trim');
  const off = (v: number, every: number) => Math.abs((((Math.abs(v) - every / 2) % every) + every) % every);
  it("concrete's panel joints on the lattice (every 2 m, between cells' edges) in straights, curves and junctions", () => {
    for (const shape of ['straight', 'curve', 't', 'cross', 'end']) {
      const ribs = trims(`core.tunnel_concrete_${shape}`).filter((b) => b.surface?.material === 'core.pbr_concrete_dark' && b.max[1] - b.min[1] > 1.5);
      // A rib's place along the passage: its middle on the axis it is 4 cm thick on (a wall rib is 1.5 cm deep into
      // the passage the other way).
      const thin = ribs.map((b) => {
        const [dx, dz] = [b.max[0] - b.min[0], b.max[2] - b.min[2]];
        const alongZ = dz < 0.05 && (dx >= 0.05 || dz > dx);
        return alongZ ? (b.min[2] + b.max[2]) / 2 : dx < 0.05 ? (b.min[0] + b.max[0]) / 2 : null;
      }).filter((v) => v !== null);
      expect(thin.length, shape).toBeGreaterThan(0);
      for (const v of thin) expect(off(v!, 2), `${shape} ${v}`).toBeLessThan(1e-6);
    }
  });
  it("the mine's sleepers keep their spacing across a joint, and no arch ring stands at a cell's edge", () => {
    const sleepers = trims('core.tunnel_mine_straight').filter((b) => b.surface?.material === 'core.oak_beam' && b.max[1] <= 0.031).map((b) => (b.min[2] + b.max[2]) / 2).sort((a, b) => a - b);
    const gaps = sleepers.slice(1).map((z, i) => z - sleepers[i]!);
    const across = sleepers[0]! + 8 - sleepers[sleepers.length - 1]!;
    for (const g of [...gaps, across]) expect(g).toBeCloseTo(0.8, 6);
    for (const id of ['core.tunnel_brick_straight', 'core.tunnel_brick_wide_straight', 'core.tunnel_brick_stair_tunnel']) {
      const rings = trims(id).filter((b) => b.surface?.material === 'core.pbr_castle_stone' && b.roll);
      expect(rings.filter((b) => Math.abs(b.min[2] + 4) < 0.01 || Math.abs(b.max[2] - 4) < 0.01 || Math.abs(b.max[2] - 12) < 0.01), id).toEqual([]);
    }
  });
});

beforeAll(async () => {
  await initPhysics();
  await initNavigation();
});

/** Walk north from `from` until z passes `to`. */
function walkNorth(physics: PhysicsWorld, from: { x: number; y: number; z: number }, to: number, ticks = 2000) {
  const collider = physics.createPlayerCollider();
  let state = { pos: { ...from }, velY: 0, grounded: false };
  for (let i = 0; i < ticks && state.pos.z < to; i++) state = stepMovement(physics, collider, state, { seq: i, forward: 1, right: 0, yaw: 0, pitch: 0, buttons: 0 });
  return state.pos;
}

describe('the Stair Tunnel: down a level over two cells, in every family', () => {
  const S = ['concrete', 'brick', 'mine', 'cave'];
  const L = ['road', 'concrete', 'brick'];
  const cases = [...S.map((f) => ({ f, id: `core.tunnel_${f}_stair_tunnel`, straight: `core.tunnel_${f}_straight` })), ...L.map((f) => ({ f, id: `core.tunnel_${f}_wide_stair_tunnel`, straight: `core.tunnel_${f}_wide_straight` }))];

  it('every family has one, in the palette as one shape a profile, with the same cells, ports and collision', () => {
    for (const { id } of cases) {
      const def = coreCatalog.get(id);
      expect(def, id).toBeDefined();
      expect(def!.cells).toEqual([[0, 0, 0], [0, 1, 0], [0, 0, 1], [0, 1, 1]]);
      expect(def!.ports.map((p) => `${p.side}${p.level}${p.cell?.join() ?? ''}`)).toEqual(['S0', 'N10,1']);
    }
    const shell = (id: string) => JSON.stringify(buildMapGeometry(mapOf([{ tile: id, x: 0, y: 0 }])).map((b) => [b.min, b.max, b.pitch ?? 0, b.kind]));
    for (const group of [cases.filter((c) => !c.id.includes('wide')), cases.filter((c) => c.id.includes('wide'))]) for (const c of group) expect(shell(c.id), c.id).toBe(shell(group[0]!.id));
  });

  for (const { f, id, straight } of cases) {
    it(`${id}: standing headroom over every step, no slit overhead, walked up and routed both ways`, () => {
      const map = mapOf([
        { tile: straight, x: 0, y: -1, z: 0 },
        { tile: id, x: 0, y: 0, z: 0 },
        { tile: straight, x: 0, y: 2, z: 1 },
      ]);
      expect(lowHeadroom(map)).toEqual([]);
      expect(openEnds(map).length).toBe(2);
      const geometry = buildMapGeometry(map);
      const physics = new PhysicsWorld(geometry, null);
      const nav = NavWorld.build(geometry, null);
      // Up from the low tunnel (level 0) to the high one (a level up), on the steps all the way.
      const up = walkNorth(physics, { x: 0.5, y: 0.1, z: -10 }, 19);
      expect(up.z, f).toBeGreaterThan(18.9);
      expect(up.y).toBeCloseTo(4, 1);
      // Overhead: the soffit everywhere along the run (no slit at the bends), at least the stair headroom over the steps.
      for (let z = -3.9; z < 11.95; z += 0.05) {
        const line = Math.max(0, Math.min(4, ((z + 2) * 4) / 12));
        const floor = Math.max(0, Math.min(4, Math.ceil(((z + 2) / 12) * 16 - 1e-9) * 0.25));
        for (const x of [-1.5, 0, 1.5]) {
          const hit = physics.raycastWorld({ x, y: line + 1, z }, { x: 0, y: 1, z: 0 }, 30) ?? 99;
          expect(hit, `${f} overhead at ${x}, ${z.toFixed(2)}`).toBeLessThan(3);
          expect(line + 1 + hit - floor, `${f} headroom at ${x}, ${z.toFixed(2)}`).toBeGreaterThan(STAIR_HEADROOM);
        }
      }
      const path = nav.findPath({ x: 0, y: 0, z: -10 }, { x: 0, y: 4, z: 18 });
      expect(path, f).not.toBeNull();
      expect(path![path!.length - 1]!.y).toBeCloseTo(4, 0);
      const back = nav.findPath({ x: 0, y: 4, z: 18 }, { x: 0, y: 0, z: -10 });
      expect(back).not.toBeNull();
      expect(back![back!.length - 1]!.y).toBeCloseTo(0, 0);
      nav.destroy();
      physics.free();
    });
  }

  it("the family's lining runs along the flight: drawn parts lie over the steps' line, none below the floor or in the way", () => {
    for (const { f, id } of cases) {
      const decor = buildMapDecor(mapOf([{ tile: id, x: 0, y: 0 }]));
      const half = coreCatalog.get(id)!.bore!.plan![0]![0]! * -1;
      expect(decor.length, f).toBeGreaterThan(20);
      expect(decor.some((b) => near(b.pitch ?? 0, Math.atan2(4, 12))), f).toBe(true);
      for (const b of decor) {
        for (const p of boxCorners(b)) {
          // Inside the bore's box, never under the landings or the steps' line by more than a step.
          const line = Math.max(0, Math.min(4, ((p[2] + 2) * 4) / 12));
          expect(p[1], `${f} ${JSON.stringify(b.min)}`).toBeGreaterThan(line - 0.3);
          expect(Math.abs(p[0]), f).toBeLessThan(half + 0.4);
        }
      }
    }
  });
});

describe('a turned block lays its texture as a block built that way', () => {
  it('a quarter-turned box: the same coordinates and face axes as the unturned box with the same corners', () => {
    const turned: WorldBox = { min: [-1, 0, -3], max: [1, 1, 3], yaw: Math.PI / 2, kind: 'wall', sourceId: 'a' };
    const plain: WorldBox = { min: [-3, 0, -1], max: [3, 1, 1], kind: 'wall', sourceId: 'b' };
    for (const p of boxCorners(turned)) expect(flatOf(turned, p).map((v) => +v.toFixed(9))).toEqual(p.map((v) => +v.toFixed(9)));
    for (const n of [[1, 0, 0], [0, 1, 0], [0, 0, -1]]) expect(flatNormalOf(turned, n)).toEqual(flatNormalOf(plain, n));
  });
});
