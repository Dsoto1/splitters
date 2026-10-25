import { beforeAll, describe, expect, it } from 'vitest';
import { NavWorld, initNavigation } from '../src/nav/index.ts';
import { CEILINGS, CORNERS, FLOOR_INSERTS, ROOM_LAYOUTS, boxBounds, buildMapDecor, buildMapGeometry, coreCatalog, footprintSize, loadMap, validateMap, yawXZ, type MapDocument, type Rotation, type WorldBox } from '../src/index.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => initNavigation());

type Tile = MapDocument['classicStructure']['tiles'][number];
const t = (id: string, tile: string, x: number, y: number, z: number, rotation: Rotation = 0, extra: Partial<Tile> = {}): Tile => ({ id, tile, x, y, z, rotation, ...extra });
const tileGeometry = (map: MapDocument) => buildMapGeometry(map).filter((b) => b.sourceId !== 'ground');
const insideTurned = (boxes: readonly WorldBox[], p: [number, number, number]) =>
  boxes.some((b) => {
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    const [lx, lz] = yawXZ(p[0] - cx, p[2] - cz, -(b.yaw ?? 0));
    const q = [cx + lx, p[1], cz + lz];
    return b.min.every((v, i) => q[i]! >= v - 1e-6) && b.max.every((v, i) => q[i]! <= v + 1e-6);
  });

describe('room options', () => {
  it('every layout and floor builds inside the room, in every rotation, and bots can cross it', () => {
    for (const tile of ['core.room', 'core.hall']) {
      const def = coreCatalog.get(tile)!;
      const [w, d] = footprintSize(def);
      for (const layout of ROOM_LAYOUTS) {
        for (const floor of FLOOR_INSERTS) {
          for (const rotation of [0, 1, 2, 3] as Rotation[]) {
            const map = makeMap([t('a', tile, 0, 0, 0, rotation, { options: { layout, floor } })]);
            const name = `${tile} ${layout} ${floor} r${rotation}`;
            expect(validateMap(map).filter((i) => i.severity === 'error'), name).toEqual([]);
            const boxes = tileGeometry(map);
            // Everything within the footprint (which turns with the tile).
            const reach = (Math.max(w, d) - 0.5) * 8 + 0.2;
            for (const b of boxes) {
              const { min, max } = boxBounds(b);
              expect(Math.max(...[min[0], max[0], min[2], max[2]].map(Math.abs)), name).toBeLessThanOrEqual(reach);
            }
            if (rotation !== 0 && rotation !== 1) continue;
            // Corner to corner across the room, round whatever is in it (the far corner turns with the tile).
            const nav = NavWorld.build(boxes);
            // Floor spots near opposite corners that nothing stands on.
            // Clear for a body's width all round, and far enough from the walls for the navmesh.
            const clear = (x: number, z: number) => [[0, 0], [0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]].every(([dx, dz]) => !insideTurned(boxes, [x + dx!, 0.1, z + dz!]));
            const spot = (cx: number, cz: number, sx: number, sz: number) => {
              for (const k of [3, 2.4, 2, 1.6, 1.2, 0.8]) for (const j of [3, 2.4, 2, 1.6, 1.2, 0.8]) if (clear(cx + sx * k, cz + sz * j)) return { x: cx + sx * k, y: 0, z: cz + sz * j };
              return null;
            };
            const xs = rotation === 0 ? [0, (w - 1) * 8] : [0, (d - 1) * 8];
            const zs = rotation === 0 ? [0, (d - 1) * 8] : [0, -(w - 1) * 8];
            const a = spot(xs[0]!, zs[0]!, -1, rotation === 0 ? -1 : 1);
            const b = spot(xs[1]!, zs[1]!, 1, rotation === 0 ? 1 : -1);
            expect(a && b, name).toBeTruthy();
            expect(nav.findPath(a!, b!), name).not.toBeNull();
            nav.destroy();
          }
        }
      }
    }
  });

  it('a chosen layout replaces the furniture a room comes with', () => {
    const solids = (layout?: 'empty') => tileGeometry(makeMap([t('a', 'core.room_large', 0, 0, 0, 0, layout ? { options: { layout } } : {})])).filter((b) => b.kind === 'solid');
    expect(solids().length).toBe(4);
    expect(solids('empty').length).toBe(0);
  });

  it('bots climb onto the dais, the platform and the raised centre', () => {
    for (const options of [{ layout: 'dais' as const }, { layout: 'platform' as const }, { layout: 'empty' as const, floor: 'raised' as const }]) {
      const map = makeMap([t('a', 'core.hall', 0, 0, 0, 0, { options })]);
      const nav = NavWorld.build(tileGeometry(map));
      const top = options.layout === 'platform' ? 1.5 : options.layout === 'dais' ? 0.75 : 0.5;
      const path = nav.findPath({ x: -2, y: 0, z: -2 }, { x: 8, y: top, z: 8 });
      expect(path, JSON.stringify(options)).not.toBeNull();
      const end = path![path!.length - 1]!;
      expect(end.y, JSON.stringify(options)).toBeGreaterThan(top - 0.3);
      nav.destroy();
    }
  });

  it('roofs a room unless something is built on top, and a skylight leaves the middle open', () => {
    const roofs = (tiles: Tile[]) => tileGeometry(makeMap(tiles)).filter((b) => b.kind === 'floor' && Math.abs(b.max[1] - 4) < 1e-6);
    expect(roofs([t('a', 'core.room', 0, 0, 0)]).length).toBe(0);
    const roofed = roofs([t('a', 'core.room', 0, 0, 0, 0, { options: { ceiling: 'roof' } })]);
    expect(roofed.length).toBe(1);
    // The room above has its own floor there: no second slab.
    expect(roofs([t('a', 'core.room', 0, 0, 0, 0, { options: { ceiling: 'roof' } }), t('b', 'core.room', 0, 0, 1)]).length).toBe(1);
    const sky = roofs([t('a', 'core.room', 0, 0, 0, 0, { options: { ceiling: 'skylight' } })]);
    expect(sky.length).toBe(4);
    expect(insideTurned(sky, [0, 3.8, 0])).toBe(false);
    expect(insideTurned(sky, [3, 3.8, 3])).toBe(true);
    // Beams are trim under the roof.
    const beams = buildMapDecor(makeMap([t('a', 'core.room', 0, 0, 0, 0, { options: { ceiling: 'beams' } })])).filter((b) => b.kind === 'trim' && b.max[1] > 3.4 && b.max[1] < 3.6);
    expect(beams.length).toBe(3);
    for (const c of CEILINGS) expect(validateMap(makeMap([t('a', 'core.room', 0, 0, 0, 0, { options: { ceiling: c } })])).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('sinks the centre only where there is room below', () => {
    const pit = (tiles: Tile[]) => tileGeometry(makeMap(tiles)).some((b) => b.kind === 'floor' && Math.abs(b.max[1] - -0.5) < 1e-6);
    expect(pit([t('a', 'core.room', 0, 0, 0, 0, { options: { floor: 'sunken' } })])).toBe(true);
    // Upstairs over another room: stays a plain floor.
    const upstairs = makeMap([t('low', 'core.room', 0, 0, 0), t('a', 'core.room', 0, 0, 1, 0, { options: { floor: 'sunken' } })]);
    expect(tileGeometry(upstairs).some((b) => b.kind === 'floor' && Math.abs(b.max[1] - 3.5) < 1e-6)).toBe(false);
    expect(tileGeometry(upstairs).filter((b) => b.kind === 'floor' && Math.abs(b.max[1] - 4) < 1e-6).length).toBe(1);
  });

  it('puts corner pieces where two walls meet, not beside an archway', () => {
    for (const corners of CORNERS) {
      const map = makeMap([t('a', 'core.room', 0, 0, 0, 0, { options: { corners }, edges: { '0,0,0:N': 'arch' } })]);
      const walls = tileGeometry(map).filter((b) => b.kind === 'wall');
      const inSouthWest = insideTurned(walls, [-3.3, 1.5, -3.3]);
      const inNorthEast = insideTurned(walls, [3.3, 1.5, 3.3]);
      expect(inSouthWest, corners).toBe(corners !== 'square');
      // The north side is an archway: no corner piece against it.
      expect(inNorthEast, corners).toBe(false);
    }
  });

  it('new walls: bars stop players but not sight, a shutter is crouched under, a broken wall has a way through', () => {
    const at = (edge: 'bars' | 'shutter' | 'broken') => tileGeometry(makeMap([t('a', 'core.room', 0, 0, 0, 0, { edges: { '0,0,0:N': edge } })])).filter((b) => b.kind === 'wall');
    const bars = at('bars');
    const gaps = bars.filter((b) => b.max[1] - b.min[1] > 3).map((b) => b.min[0]).sort((a, b) => a - b);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]! - gaps[i - 1]! - 0.06).toBeLessThan(0.6);
    expect(insideTurned(bars, [0.01, 1.5, 3.9])).toBe(false);
    const shutter = at('shutter');
    expect(insideTurned(shutter, [0, 1, 3.9])).toBe(false);
    expect(insideTurned(shutter, [0, 2, 3.95])).toBe(true);
    const broken = at('broken');
    expect(insideTurned(broken, [0, 1.5, 3.8])).toBe(false);
  });

  it('options survive saving and loading', () => {
    const map = makeMap([t('room_a', 'core.room', 0, 0, 0, 0, { options: { layout: 'rubble', floor: 'raised', ceiling: 'beams', corners: 'columns' } })]);
    const r = loadMap(JSON.parse(JSON.stringify(map)));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.map.classicStructure.tiles[0]!.options).toEqual({ layout: 'rubble', floor: 'raised', ceiling: 'beams', corners: 'columns' });
    // Rubble is seeded by the tile: the same map builds the same rubble.
    expect(JSON.stringify(tileGeometry(map))).toBe(JSON.stringify(tileGeometry(JSON.parse(JSON.stringify(map)))));
  });
});
