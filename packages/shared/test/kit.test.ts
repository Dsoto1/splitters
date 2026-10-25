import { beforeAll, describe, expect, it } from 'vitest';
import { NavWorld, initNavigation } from '../src/nav/index.ts';
import { CORE_PROPS, SIDES, TILE_CATEGORIES, applyCommand, boxBounds, fitBounds, rotateXZ, yawXZ, buildMapDecor, buildMapGeometry, coreCatalog, edgeChoiceAt, edgeTargetAt, mapKillY, setEdgeCommand, validateMap, type MapDocument, type Rotation, type WorldBox } from '../src/index.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => initNavigation());

type Tile = MapDocument['classicStructure']['tiles'][number];
const t = (id: string, tile: string, x: number, y: number, z: number, rotation: Rotation = 0, edges?: Tile['edges']): Tile => ({ id, tile, x, y, z, rotation, ...(edges ? { edges } : {}) });
const inside = (boxes: readonly WorldBox[], p: [number, number, number]) => boxes.some((b) => b.min.every((v, i) => p[i]! >= v - 1e-6) && b.max.every((v, i) => p[i]! <= v + 1e-6));
const walls = (boxes: readonly WorldBox[]) => boxes.filter((b) => b.kind === 'wall');
/** Point-in-box that honours turned boxes. */
const insideTurned = (boxes: readonly WorldBox[], p: [number, number, number]) =>
  boxes.some((b) => {
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    const [lx, lz] = yawXZ(p[0] - cx, p[2] - cz, -(b.yaw ?? 0));
    const q = [cx + lx, p[1], cz + lz];
    return b.min.every((v, i) => q[i]! >= v - 1e-6) && b.max.every((v, i) => q[i]! <= v + 1e-6);
  });

describe('building kit', () => {
  it('every tile builds in every rotation, inside its own cells, with somewhere to stand', () => {
    for (const def of coreCatalog.all()) {
      for (const rotation of [0, 1, 2, 3] as Rotation[]) {
        const map = makeMap([t('a', def.id, 0, 0, 0, rotation)]);
        expect(validateMap(map).filter((i) => i.severity === 'error'), def.id).toEqual([]);
        const boxes = buildMapGeometry(map);
        expect(boxes.some((b) => b.kind === 'floor'), def.id).toBe(true);
        // Everything stays within the occupied cells' extent.
        const xs = def.cells.flatMap(([dx, dy]) => [dx, dy]);
        const reach = (Math.max(...xs.map(Math.abs)) + 0.5) * 8 + 1e-6;
        for (const b of boxes) for (const v of [...b.min, ...b.max]) expect(Number.isFinite(v)).toBe(true);
        for (const b of boxes) {
          // Turned pieces of curves overlap their neighbours by a few centimetres.
          const { min, max } = boxBounds(b);
          expect(Math.max(Math.abs(min[0]), Math.abs(max[0]), Math.abs(min[2]), Math.abs(max[2])), `${def.id} r${rotation}`).toBeLessThanOrEqual(reach + (b.yaw ? 0.1 : 0));
        }
      }
    }
  });

  it('has a broad palette: at least 34 pieces across every category', () => {
    const all = coreCatalog.all();
    expect(all.length).toBeGreaterThanOrEqual(34);
    expect(new Set(all.map((d) => d.category)).size).toBe(TILE_CATEGORIES.length);
  });

  it('builds no walls inside a multi-cell piece', () => {
    const boxes = walls(buildMapGeometry(makeMap([t('big', 'core.room_large', 0, 0, 0)])));
    // The internal boundaries are x = 4 and z = 4; nothing stands across them at head height.
    expect(inside(boxes, [4, 1.7, 0])).toBe(false);
    expect(inside(boxes, [0, 1.7, 4])).toBe(false);
    // The outside still has walls, and a perimeter port with a neighbour makes a doorway.
    expect(inside(boxes, [-3.9, 1.7, 2])).toBe(true);
    const joined = walls(buildMapGeometry(makeMap([t('big', 'core.room_large', 0, 0, 0), t('r', 'core.room', 2, 1, 0)])));
    expect(inside(joined, [11.9, 1.7, 8])).toBe(false);
    expect(inside(joined, [11.9, 1.7, 6])).toBe(true);
  });

  it('builds each edge style on the chosen side, following the rotation', () => {
    const at = (edges: Tile['edges'], rotation: Rotation = 0) => walls(buildMapGeometry(makeMap([t('r', 'core.room', 0, 0, 0, rotation, edges)])));
    const plain = at(undefined);
    expect(inside(plain, [0, 1.7, 3.9])).toBe(true);
    // Window: see through at eye height, solid below the sill.
    const win = at({ '0,0,0:N': 'window' });
    expect(inside(win, [0, 1.7, 3.9])).toBe(false);
    expect(inside(win, [0, 0.5, 3.9])).toBe(true);
    // Rotated a quarter turn clockwise, the tile's north side faces east.
    const turned = at({ '0,0,0:N': 'window' }, 1);
    expect(inside(turned, [3.9, 1.7, 0])).toBe(false);
    expect(inside(turned, [0, 1.7, 3.9])).toBe(true);
    // No wall, half wall, archway, railing.
    expect(walls(buildMapGeometry(makeMap([t('r', 'core.room', 0, 0, 0, 0, { '0,0,0:N': 'open' })]))).filter((b) => b.min[2] > 3).length).toBe(0);
    const half = at({ '0,0,0:S': 'half' });
    expect(inside(half, [0, 0.5, -3.9])).toBe(true);
    expect(inside(half, [0, 1.5, -3.9])).toBe(false);
    const arch = at({ '0,0,0:E': 'arch' });
    expect(inside(arch, [3.9, 2, 2.5])).toBe(false);
    expect(inside(arch, [3.9, 3.8, 0])).toBe(true);
    const rail = at({ '0,0,0:W': 'railing' });
    expect(inside(rail, [-3.95, 0.5, 0])).toBe(true);
    expect(inside(rail, [-3.7, 0.5, 0])).toBe(false);
  });

  it("uses the neighbour's choice for a shared side so both halves match", () => {
    const boxes = walls(buildMapGeometry(makeMap([t('a', 'core.room', 0, 0, 0, 0, { '0,0,0:N': 'window' }), t('b', 'core.corridor', 0, 1, 0, 1)])));
    // a's north and b's south half of the wall both have the window cut.
    expect(inside(boxes, [0, 1.7, 3.9])).toBe(false);
    expect(inside(boxes, [0, 1.7, 4.1])).toBe(false);
  });

  it('leaves platforms and bridges open at the edges, framing only the room side', () => {
    const plat = buildMapGeometry(makeMap([t('p', 'core.platform', 0, 0, 0)]));
    expect(walls(plat)).toEqual([]);
    const bridge = buildMapGeometry(makeMap([t('a', 'core.room', 0, -1, 0), t('b', 'core.bridge', 0, 0, 0), t('c', 'core.room', 0, 1, 0)]));
    const bridgeWalls = walls(bridge).filter((b) => b.sourceId === 'b');
    expect(bridgeWalls).toEqual([]);
    expect(inside(walls(bridge), [-3, 1.7, -4.1])).toBe(true);
    expect(inside(walls(bridge), [0, 1.7, -4.1])).toBe(false);
    // The deck is there; beside it is the drop.
    expect(inside(bridge, [0, -0.1, 0])).toBe(true);
    expect(inside(bridge, [3, -0.1, 0])).toBe(false);
    const rails = buildMapGeometry(makeMap([t('p', 'core.platform_rail', 0, 0, 0)]));
    expect(walls(rails).length).toBe(4);
  });

  it('keeps trim visual only', () => {
    const map = makeMap([t('r', 'core.room', 0, 0, 0, 0, { '0,0,0:N': 'window', '0,0,0:E': 'railing' })]);
    expect(buildMapGeometry(map).some((b) => b.kind === 'trim')).toBe(false);
    const decor = buildMapDecor(map);
    expect(decor.length).toBeGreaterThan(8);
    expect(decor.every((b) => b.kind === 'trim')).toBe(true);
  });

  it('kills a fall some way below the lowest floor', () => {
    expect(mapKillY(buildMapGeometry(makeMap([t('p', 'core.pit', 0, 0, 0)])))).toBeCloseTo(-14);
    expect(mapKillY(buildMapGeometry(makeMap([t('s', 'core.room_sunken', 0, 0, 0)])))).toBeCloseTo(-15.5);
  });

  it('accepts every edge style on every side', () => {
    for (const side of SIDES) {
      for (const style of ['wall', 'door', 'wide', 'arch', 'window', 'windows', 'slit', 'half', 'railing', 'open', 'auto'] as const) {
        const map = makeMap([t('r', 'core.room', 0, 0, 0, 0, { [`0,0,0:${side}`]: style })]);
        expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
      }
    }
  });
});

describe('building kit navigation', () => {
  const cases: { name: string; tiles: Tile[]; from: [number, number, number]; to: [number, number, number] }[] = [
    { name: 'stairs', tiles: [t('s', 'core.stairs', 0, 0, 0), t('a', 'core.room', -1, 0, 0), t('b', 'core.room', 1, 0, 1)], from: [-8, 0, 0], to: [8, 4, 0] },
    { name: 'stairwell', tiles: [t('s', 'core.stairwell', 0, 0, 0), t('a', 'core.room', -1, 0, 0), t('b', 'core.room', -1, 0, 1)], from: [-8, 0, 0], to: [-8, 4, 0] },
    { name: 'ramp', tiles: [t('s', 'core.ramp', 0, 0, 0), t('a', 'core.room', -1, 0, 0), t('b', 'core.room', 2, 0, 1)], from: [-8, 0, 0], to: [16, 4, 0] },
    { name: 'open stairs', tiles: [t('s', 'core.stairs_open', 0, 0, 0), t('a', 'core.room', -1, 0, 0), t('b', 'core.room', 1, 0, 1)], from: [-8, 0, 0], to: [8, 4, 0] },
    { name: 'atrium', tiles: [t('m', 'core.atrium', 0, 0, 0), t('a', 'core.room', -1, 0, 0), t('b', 'core.room', 2, 1, 1)], from: [-8, 0, 0], to: [16, 4, 8] },
    { name: 'sunken room', tiles: [t('m', 'core.room_sunken', 0, 0, 0), t('a', 'core.room', 0, 1, 0)], from: [1, -1.5, -2.5], to: [0, 0, 8] },
    { name: 'raised ledge', tiles: [t('m', 'core.room_ledge', 0, 0, 0)], from: [0, 0, -2.5], to: [2.5, 1.5, 2.4] },
    { name: 'split level', tiles: [t('m', 'core.room_split', 0, 0, 0)], from: [0, 0, -2.5], to: [0, 1, 2.5] },
    { name: 'terrace', tiles: [t('m', 'core.terrace', 0, 0, 0)], from: [0, 0, -2.5], to: [0, 1, 2.5] },
    { name: 'watchtower', tiles: [t('m', 'core.tower', 0, 0, 0)], from: [-2, 0, 2], to: [2.4, 1.5, 1] },
    { name: 'bridge', tiles: [t('a', 'core.room', 0, -1, 0), t('b', 'core.bridge', 0, 0, 0), t('c', 'core.room', 0, 1, 0)], from: [0, 0, -8], to: [0, 0, 8] },
  ];
  // A quarter turn clockwise (the tiles' own rotation rule), for grid cells and world points alike.
  const turn = (x: number, z: number, r: number): [number, number] => {
    let [a, b] = [x, z];
    for (let i = 0; i < r; i++) [a, b] = [b, -a];
    return [a + 0, b + 0];
  };
  for (const c of cases) {
    it(`bots can climb the ${c.name} in every rotation`, () => {
      for (const r of [0, 1, 2, 3]) {
        const tiles = c.tiles.map((p) => {
          const [x, y] = turn(p.x, p.y, r);
          return { ...p, x, y, rotation: ((p.rotation + r) % 4) as Rotation };
        });
        const [fx, fz] = turn(c.from[0], c.from[2], r);
        const [tx, tz] = turn(c.to[0], c.to[2], r);
        const nav = NavWorld.build(buildMapGeometry(makeMap(tiles, [[fx, c.from[1], fz]])));
        const path = nav.findPath({ x: fx, y: c.from[1], z: fz }, { x: tx, y: c.to[1], z: tz });
        expect(path, `${c.name} r${r}`).not.toBeNull();
        const end = path![path!.length - 1]!;
        expect(Math.hypot(end.x - tx, end.y - c.to[1], end.z - tz), `${c.name} r${r}`).toBeLessThan(1.2);
        nav.destroy();
      }
    });
  }
});

describe('wall tool', () => {
  it('finds the side under the pointer from either face of a wall', () => {
    const doc = makeMap([t('a', 'core.room', 0, 0, 0), t('b', 'core.room', 1, 0, 0, 1)]);
    // Inside face of a's east wall, and the floor near a's north wall.
    expect(edgeTargetAt(doc, [3.5, 1.5, 0], [-1, 0, 0])).toEqual({ cell: [0, 0, 0], side: 'E' });
    expect(edgeTargetAt(doc, [1, 0, 3.2], [0, 1, 0])).toEqual({ cell: [0, 0, 0], side: 'N' });
    // Outside face of the map's west wall: the wall belongs to the room behind it.
    expect(edgeTargetAt(doc, [-4, 1.5, 0], [-1, 0, 0])).toEqual({ cell: [0, 0, 0], side: 'W' });
  });

  it('stores the choice in the tile frame and clears the neighbour so both halves match', () => {
    let doc = makeMap([t('a', 'core.room', 0, 0, 0, 1), t('b', 'core.room', 1, 0, 0, 0, { '0,0,0:W': 'half' })]);
    const cmd = setEdgeCommand(doc, { cell: [0, 0, 0], side: 'E' }, 'window');
    expect('kind' in cmd).toBe(true);
    doc = applyCommand(doc, cmd as never);
    // a is turned a quarter clockwise: world east is its local north. b's own choice is gone.
    expect(doc.classicStructure.tiles[0]!.edges).toEqual({ '0,0,0:N': 'window' });
    expect(doc.classicStructure.tiles[1]!.edges).toBeUndefined();
    expect(edgeChoiceAt(doc, { cell: [1, 0, 0], side: 'W' })).toBe('window');
    const back = applyCommand(doc, setEdgeCommand(doc, { cell: [0, 0, 0], side: 'E' }, 'auto') as never);
    expect(back.classicStructure.tiles[0]!.edges).toBeUndefined();
    expect(setEdgeCommand(makeMap([t('big', 'core.room_large', 0, 0, 0)]), { cell: [0, 0, 0], side: 'E' }, 'window')).toEqual({ error: 'that side is inside one piece' });
  });
});

describe('props', () => {
  const prop = (id: string, model: string, x: number, z: number, extra: Record<string, unknown> = {}) => ({ id, kind: 'prop' as const, model, position: [x, 0, z] as [number, number, number], yaw: 0, scale: 1, solid: true, tint: null, ...extra });
  it('has a catalogue of real-size props in several categories', () => {
    expect(CORE_PROPS.length).toBeGreaterThanOrEqual(140);
    const barrel = CORE_PROPS.find((p) => p.id === 'prop.barrel')!;
    expect(barrel.size[1]).toBeCloseTo(1.1);
    expect(barrel.collision).not.toBeNull();
    expect(CORE_PROPS.find((p) => p.id === 'prop.rug')!.collision).toBeNull();
  });

  it('blocks movement and bots with solid props only', () => {
    const map = makeMap([t('r', 'core.room', 0, 0, 0)]);
    map.entities.push(prop('p1', 'prop.rock_large', 2, 0), prop('p2', 'prop.rug', -2, 0), prop('p3', 'prop.rock_medium', 0, 2, { solid: false }), prop('p4', 'prop.tree', -2, -2, { scale: 2 }));
    expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
    const boxes = buildMapGeometry(map).filter((b) => b.kind === 'prop');
    // A boulder collides as two rounded tiers (a low one you can hop onto, a narrower top).
    expect(boxes.map((b) => b.sourceId)).toEqual(['p1', 'p1', 'p4']);
    expect(boxes[0]!.max[1]).toBeLessThanOrEqual(0.7 + 1e-6);
    expect(boxes[1]!.max[0] - boxes[1]!.min[0]).toBeLessThan(boxes[0]!.max[0] - boxes[0]!.min[0]);
    // A tree only blocks at its trunk, scaled.
    const tree = boxes[2]!;
    expect(tree.max[0] - tree.min[0]).toBeCloseTo(1);
    expect(tree.max[1]).toBeCloseTo(10);
    // Turned 45°, the collision covers the turned crate's footprint.
    const turned = makeMap([t('r', 'core.room', 0, 0, 0)]);
    turned.entities.push(prop('p1', 'prop.rock_large', 0, 0, { yaw: Math.PI / 4 }));
    const b = buildMapGeometry(turned).find((x) => x.kind === 'prop')!;
    expect(b.max[0] - b.min[0]).toBeGreaterThan(boxes[0]!.max[0] - boxes[0]!.min[0]);
  });

  it('rejects unknown prop models', () => {
    const map = makeMap([t('r', 'core.room', 0, 0, 0)]);
    map.entities.push(prop('p1', 'prop.nope', 0, 0));
    expect(validateMap(map).map((i) => i.code)).toContain('prop.unknown');
  });

  it('rounded corners: the curve meets the straight walls, blocks the corner, and bots walk round it', () => {
    for (const rotation of [0, 1, 2, 3] as Rotation[]) {
      // A medium round corner with a room joined on each straight side, everything turned together.
      const turn = (x: number, z: number) => rotateXZ(x, z, rotation);
      const [sx, sy] = turn(0, -1);
      const [wx, wy] = turn(-1, 0);
      const map = makeMap([t('c', 'core.round_corner_m', 0, 0, 0, rotation), t('s', 'core.room', sx, sy, 0), t('w', 'core.room', wx, wy, 0)], [[sx * 8, 0, sy * 8]]);
      expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
      const boxes = buildMapGeometry(map);
      // On the curve (radius 15.75 from the piece's outer corner, at 45°) there is wall.
      const d = 15.75 / Math.SQRT2;
      const [cx, cz] = turn(-4 + d, -4 + d);
      expect(insideTurned(walls(boxes), [cx, 1.7, cz]), `r${rotation} curve`).toBe(true);
      // Just inside the curve is open floor.
      const [ix, iz] = turn(-4 + d - 1, -4 + d - 1);
      expect(insideTurned(boxes.filter((b) => b.kind !== 'floor'), [ix, 1.7, iz]), `r${rotation} inside`).toBe(false);
      const nav = NavWorld.build(boxes);
      expect(nav.findPath({ x: sx * 8, y: 0, z: sy * 8 }, { x: wx * 8, y: 0, z: wy * 8 }), `r${rotation} path`).not.toBeNull();
      nav.destroy();
    }
  });

  it('curved trim is drawn but never collides', () => {
    const map = makeMap([t('c', 'core.round_corner_s', 0, 0, 0)]);
    expect(buildMapGeometry(map).some((b) => b.kind === 'trim')).toBe(false);
    expect(buildMapDecor(map).filter((b) => b.yaw !== undefined).length).toBeGreaterThan(10);
  });

  it('high and towering walls reach 2 and 4 storeys; the fence is see-through bars', () => {
    const at = (style: 'high' | 'tower' | 'fence') => walls(buildMapGeometry(makeMap([t('r', 'core.room', 0, 0, 0, 0, { '0,0,0:N': style })])));
    expect(Math.max(...at('high').map((b) => b.max[1]))).toBeCloseTo(8);
    expect(Math.max(...at('tower').map((b) => b.max[1]))).toBeCloseTo(16);
    const fence = at('fence');
    expect(inside(fence, [0.5, 1, 3.9])).toBe(false); // between posts, between rails
    expect(inside(fence, [0, 1.5, 3.95])).toBe(true); // a post
  });

  it('the map boundary fits round the map and nothing walks through it', () => {
    const base = makeMap([t('a', 'core.yard', 0, 0, 0), t('b', 'core.yard', 1, 0, 0)]);
    const fit = fitBounds(base, 2)!;
    expect(fit).toEqual({ min: [-6, -6], max: [14, 6] });
    for (const style of ['invisible', 'wall', 'fence'] as const) {
      const map = { ...base, bounds: { ...fit, style, height: 6 } };
      expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
      const boxes = buildMapGeometry(map);
      // Just outside the line there is always something solid, all the way up.
      expect(inside(boxes, [-6.5, 1, 0]), style).toBe(true);
      expect(inside(boxes, [-6.5, 40, 0]), style).toBe(true);
      expect(boxes.some((b) => b.kind === 'wall' && b.sourceId === '__bounds')).toBe(style !== 'invisible');
    }
  });
});
