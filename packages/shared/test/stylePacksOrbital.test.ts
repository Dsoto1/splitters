import { beforeAll, describe, expect, it } from 'vitest';
import { buildMapDecor, buildMapGeometry, coplanarOverlaps, coreCatalog, coreMaterials, getProp, getStylePack, initPhysics, propAlias, validateMap, visibleFaces, type MapDocument, type Rotation } from '../src/index.ts';
import { NavWorld, initNavigation } from '../src/match.ts';
import { orbitalPackTiles } from '../src/map/packTilesOrbital.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

type Tile = MapDocument['classicStructure']['tiles'][number];
const t = (id: string, tile: string, x: number, y: number, z = 0, rotation: Rotation = 0, extra: Partial<Tile> = {}): Tile => ({ id, tile, x, y, z, rotation, ...extra });
/** The pack's two kit tiles (content/tiles/core.json), then the research base drawn in code (packTilesOrbital.ts). */
const KIT = ['orbital.hangar', 'orbital.reactor_hall'];
const CODE = ['lab_module', 'airlock_tube', 'landing_pad', 'comms_array', 'greenhouse', 'sky_tube', 'rover_bay', 'hab_dome'].map((id) => `orbital.${id}`);
const OWN = [...KIT, ...CODE];

describe('Style Pack 04 Orbital Station: the research base', () => {
  it('keeps its number, theme and demo, and lists nine or more tiles of its own: the two kit tiles, then the code tiles', () => {
    const pack = getStylePack('orbital')!;
    expect(pack).toMatchObject({ number: '04', displayName: 'Orbital Station', demo: 'halcyon_station' });
    expect(pack.themes).toEqual(['core.orbital']);
    expect(OWN.length).toBeGreaterThanOrEqual(9);
    expect(pack.tiles.slice(0, OWN.length)).toEqual(OWN);
    expect(orbitalPackTiles().map((d) => d.id)).toEqual(CODE);
    // Both sources land in one catalog under one prefix, no id twice.
    const ids = coreCatalog.all().filter((d) => d.id.startsWith('orbital.')).map((d) => d.id);
    expect([...ids].sort()).toEqual([...OWN].sort());
    expect(new Set(pack.tiles).size).toBe(pack.tiles.length);
    for (const id of pack.tiles) expect(coreCatalog.get(id), id).toBeDefined();
    for (const p of pack.props) {
      expect(getProp(p), p).toBeDefined();
      expect(propAlias(p), `${p} is retired`).toBeUndefined();
    }
    for (const m of pack.materials) expect(coreMaterials.get(m), m).toBeDefined();
  });

  it('every tile validates on its own and draws no two faces in one plane, in every rotation', () => {
    for (const id of CODE) {
      for (const rotation of [0, 1, 2, 3] as Rotation[]) {
        const map = makeMap([t('a', id, 0, 0, 0, rotation)], [[0, 0, -20]]);
        expect(validateMap(map).filter((i) => i.severity === 'error'), id).toEqual([]);
        const boxes = [...buildMapGeometry(map), ...buildMapDecor(map)];
        const left = coplanarOverlaps(boxes, { faces: visibleFaces(boxes) });
        expect(left.slice(0, 5).map((o) => `${o.center.map((v) => v.toFixed(2))} (${o.area.toFixed(3)} m²)`), `${id} r${rotation}`).toEqual([]);
      }
    }
  });

  it('the pieces use materials that exist, and only steady lights (no new ones)', () => {
    const used = new Set(orbitalPackTiles().flatMap((d) => (d.solids ?? []).map((s) => s.surface?.material)));
    for (const m of used) expect(coreMaterials.get(m!), m).toBeDefined();
    for (const m of ['core.pbr_white_panel', 'core.orbital_panel', 'core.circuit', 'core.light_strip', 'core.glow_trim']) expect(used.has(m), m).toBe(true);
    const boxes = buildMapGeometry(makeMap([t('a', 'orbital.lab_module', 0, 0)]));
    expect(boxes.some((x) => x.sourceId === 'a' && x.surface?.material === 'core.pbr_white_panel')).toBe(true);
  });
});

describe('Orbital research base navigation', () => {
  const turn = (x: number, z: number, r: number): [number, number] => {
    let [a, b] = [x, z];
    for (let i = 0; i < r; i++) [a, b] = [b, -a];
    return [a + 0, b + 0];
  };
  const yards = (x0: number, y0: number, x1: number, y1: number, taken: readonly (readonly [number, number])[]): Tile[] => {
    const out: Tile[] = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (!taken.some(([a, b]) => a === x && b === y)) out.push(t(`y${x}_${y}`.replace(/-/g, 'm'), 'core.yard', x, y));
    return out;
  };
  const one = (id: string) => [t('m', id, 0, 0), ...yards(-1, -1, 1, 1, [[0, 0]])];
  const big = (id: string) => [t('m', id, 0, 0), ...yards(-1, -1, 2, 2, [[0, 0], [1, 0], [0, 1], [1, 1]])];
  const house = [t('m', 'orbital.greenhouse', 0, 0), ...yards(-1, -1, 2, 1, [[0, 0], [1, 0]])];
  const bay = [t('m', 'orbital.rover_bay', 0, 0), ...yards(-1, -1, 1, 2, [[0, 0], [0, 1]])];
  const cases: { name: string; tiles: Tile[]; from: [number, number, number]; to: [number, number, number] }[] = [
    { name: 'lab module', tiles: one('orbital.lab_module'), from: [0, 0, -6], to: [-1, 0, 0] },
    { name: 'lab module by its north door', tiles: one('orbital.lab_module'), from: [0, 0, 6], to: [-1, 0, -2] },
    { name: 'inside of the airlock tube', tiles: one('orbital.airlock_tube'), from: [0, 0, -6], to: [0, 0, 2] },
    { name: 'inside of the airlock tube from the north', tiles: one('orbital.airlock_tube'), from: [0, 0, 6], to: [0, 0, -2] },
    { name: 'landing pad by its south ramp', tiles: big('orbital.landing_pad'), from: [4, 0, -6], to: [4, 1, 4] },
    { name: 'landing pad by its north ramp', tiles: big('orbital.landing_pad'), from: [4, 0, 14], to: [8, 1, 8] },
    { name: 'comms array hut', tiles: one('orbital.comms_array'), from: [-1.3, 0, -6], to: [-1, 0, 0] },
    { name: 'far side of the comms array, past the hut', tiles: one('orbital.comms_array'), from: [2.6, 0, -6], to: [2.6, 0, 3] },
    { name: 'greenhouse', tiles: house, from: [0, 0, -6], to: [7, 0, 0] },
    { name: 'greenhouse by its east door', tiles: house, from: [14, 0, 0], to: [0, 0, 1] },
    { name: 'sky tube by a metal stair', tiles: [t('s', 'snow.metal_stair', 0, 0), t('c', 'orbital.sky_tube', 0, 1), ...yards(-1, -1, 1, 2, [[0, 0], [0, 1]])], from: [0, 0, -6], to: [0, 4, 9] },
    { name: 'catwalk north of the sky tube, through it', tiles: [t('s', 'snow.metal_stair', 0, 0), t('c', 'orbital.sky_tube', 0, 1), t('k', 'snow.catwalk', 0, 2), ...yards(-1, -1, 1, 3, [[0, 0], [0, 1], [0, 2]])], from: [0, 0, -6], to: [0, 4, 17] },
    { name: 'ground under the sky tube', tiles: one('orbital.sky_tube'), from: [-6, 0, 0], to: [0, 0, 0] },
    { name: 'rover bay over its sill', tiles: bay, from: [0, 0, -6], to: [2, 0.25, 5] },
    { name: 'rover bay by its north door', tiles: bay, from: [0, 0, 14], to: [2, 0.25, 5] },
    { name: 'hab dome', tiles: big('orbital.hab_dome'), from: [4, 0, -6], to: [2, 0, 8] },
  ];
  for (const c of cases) {
    it(`bots can reach the ${c.name} in every rotation`, () => {
      for (const r of [0, 1, 2, 3]) {
        const tiles = c.tiles.map((p) => {
          const [x, y] = turn(p.x, p.y, r);
          return { ...p, x, y, rotation: ((p.rotation + r) % 4) as Rotation };
        });
        const [fx, fz] = turn(c.from[0], c.from[2], r);
        const [tx, tz] = turn(c.to[0], c.to[2], r);
        const map = makeMap(tiles, [[fx, c.from[1], fz]]);
        expect(validateMap(map).filter((i) => i.severity === 'error'), `${c.name} r${r}`).toEqual([]);
        const nav = NavWorld.build(buildMapGeometry(map).filter((b) => b.sourceId !== 'ground'));
        const path = nav.findPath({ x: fx, y: c.from[1], z: fz }, { x: tx, y: c.to[1], z: tz });
        expect(path, `${c.name} r${r}`).not.toBeNull();
        const end = path![path!.length - 1]!;
        expect(Math.hypot(end.x - tx, end.y - c.to[1], end.z - tz), `${c.name} r${r}`).toBeLessThan(1.2);
        nav.destroy();
      }
    });
  }
});
