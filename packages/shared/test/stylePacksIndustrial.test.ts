import { beforeAll, describe, expect, it } from 'vitest';
import { SCENARIO_PALETTE, THEME_BACKDROPS, buildMapDecor, buildMapGeometry, coplanarOverlaps, coreCatalog, coreMaterials, coreThemes, getItem, getProp, getStylePack, initPhysics, isKitModel, propAlias, validateMap, visibleFaces, type MapDocument, type Rotation } from '../src/index.ts';
import { NavWorld, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

type Tile = MapDocument['classicStructure']['tiles'][number];
const t = (id: string, tile: string, x: number, y: number, z = 0, rotation: Rotation = 0, extra: Partial<Tile> = {}): Tile => ({ id, tile, x, y, z, rotation, ...extra });
const OWN = ['factory_hall', 'pipe_rack', 'catwalk_cross', 'conveyor_line', 'loading_bay', 'silo', 'control_room'].map((id) => `industrial.${id}`);

describe('Style Pack 13 Industrial Factory', () => {
  // Its own pieces are tiles; its props are our kit families and pieces already in the game, so the "25–40 props of the
  // pack's own category" rule of the earlier packs does not apply: seven tiles of its own, 25 or more pieces in all.
  it('is registered with its own theme, a backdrop, seven tiles of its own and 25 or more pieces', () => {
    const pack = getStylePack('industrial')!;
    expect(pack).toMatchObject({ number: '13', displayName: 'Industrial Factory', demo: 'ironworks' });
    expect(pack.themes).toEqual(['core.industrial']);
    const theme = coreThemes.get('core.industrial')!;
    for (const slot of Object.values(theme.slots)) expect(coreMaterials.get(slot!.material), slot!.material).toBeDefined();
    expect(THEME_BACKDROPS['core.industrial']).toMatchObject({ sky: 'overcast', scenery: 'city' });
    expect(pack.tiles.slice(0, OWN.length)).toEqual(OWN);
    expect(coreCatalog.all().filter((d) => d.id.startsWith('industrial.')).map((d) => d.id)).toEqual(OWN);
    expect(pack.tiles.length + pack.props.length).toBeGreaterThanOrEqual(25);
    for (const id of pack.tiles) expect(coreCatalog.get(id), id).toBeDefined();
    for (const p of pack.props) {
      expect(getProp(p), p).toBeDefined();
      expect(propAlias(p), `${p} is retired`).toBeUndefined();
    }
    expect(pack.props.filter(isKitModel).length).toBeGreaterThanOrEqual(12);
    for (const m of pack.materials) expect(coreMaterials.get(m), m).toBeDefined();
    for (const k of pack.gameplay) expect(SCENARIO_PALETTE.some((e) => e.key === k), k).toBe(true);
    for (const i of pack.pickups) expect(getItem(i), i).toBeDefined();
  });

  it('every tile validates on its own and draws no two faces in one plane, in every rotation', () => {
    for (const id of OWN) {
      for (const rotation of [0, 1, 2, 3] as Rotation[]) {
        const map = makeMap([t('a', id, 0, 0, 0, rotation)], [[0, 0, -20]]);
        expect(validateMap(map).filter((i) => i.severity === 'error'), id).toEqual([]);
        const boxes = [...buildMapGeometry(map), ...buildMapDecor(map)];
        const left = coplanarOverlaps(boxes, { faces: visibleFaces(boxes) });
        expect(left.slice(0, 5).map((o) => `${o.center.map((v) => v.toFixed(2))} (${o.area.toFixed(3)} m²)`), `${id} r${rotation}`).toEqual([]);
      }
    }
  });

  it('the pieces keep their own steel, grating and sheet in any theme', () => {
    const boxes = buildMapGeometry(makeMap([t('a', 'industrial.factory_hall', 0, 0)]));
    const mats = new Set(boxes.filter((b) => b.sourceId === 'a').map((b) => b.surface?.material));
    for (const m of ['core.pbr_grey_corrugated', 'core.steel_grating', 'core.pbr_rusted_plate']) expect(mats.has(m), m).toBe(true);
  });
});

describe('Industrial pack navigation', () => {
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
  const hall = [t('m', 'industrial.factory_hall', 0, 0), ...yards(-1, -1, 2, 2, [[0, 0], [1, 0], [0, 1], [1, 1]])];
  const bay = [t('m', 'industrial.loading_bay', 0, 0), ...yards(-1, -1, 2, 1, [[0, 0], [1, 0]])];
  const cases: { name: string; tiles: Tile[]; from: [number, number, number]; to: [number, number, number] }[] = [
    { name: 'factory hall floor', tiles: hall, from: [4, 0, -6], to: [8, 0, 9.6] },
    { name: 'factory hall mezzanine', tiles: hall, from: [4, 0, -6], to: [2, 4, 9.6] },
    { name: 'catwalk north of the hall, through its mezzanine doorway', tiles: [t('m', 'industrial.factory_hall', 0, 0), t('c', 'snow.catwalk', 0, 2), ...yards(-1, -1, 2, 2, [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]])], from: [4, 0, -6], to: [0, 4, 17] },
    { name: 'far side of the pipe rack, under it', tiles: one('industrial.pipe_rack'), from: [0, 0, -6], to: [0, 0, 6] },
    { name: 'catwalk crossing by a metal stair', tiles: [t('s', 'snow.metal_stair', 0, 0), t('c', 'industrial.catwalk_cross', 0, 1), ...yards(-1, -1, 1, 2, [[0, 0], [0, 1]])], from: [0, 0, -6], to: [3.4, 4, 8] },
    { name: 'far side of the conveyor line', tiles: one('industrial.conveyor_line'), from: [-2, 0, -6], to: [2.5, 0, 0] },
    { name: 'loading bay dock by the ramp', tiles: bay, from: [0, 0, -6], to: [9, 1.25, -1] },
    { name: 'loading bay dock from the north, up the steps and through the doorway', tiles: bay, from: [6, 0, 6], to: [6, 1.25, 0] },
    { name: 'silo landing 4 m up', tiles: one('industrial.silo'), from: [0, 0, -6], to: [0, 4, -3.2] },
    { name: 'silo top deck', tiles: one('industrial.silo'), from: [0, 0, -6], to: [0, 8, 0.8] },
    { name: 'control room', tiles: one('industrial.control_room'), from: [0, 0, -6], to: [-1, 4, -1] },
    { name: 'catwalk north of the control room, off its balcony', tiles: [t('m', 'industrial.control_room', 0, 0), t('c', 'snow.catwalk', 0, 1), ...yards(-1, -1, 1, 1, [[0, 0], [0, 1]])], from: [0, 0, -6], to: [0, 4, 9] },
    { name: 'catwalk south of the silo, off its 4 m landing', tiles: [t('m', 'industrial.silo', 0, 0), t('c', 'snow.catwalk', 0, -1), ...yards(-1, -1, 1, 1, [[0, 0], [0, -1]])], from: [0, 0, 6], to: [0, 4, -9] },
    { name: 'ground under the control room', tiles: one('industrial.control_room'), from: [0, 0, -6], to: [-1, 0, 0] },
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
