import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MODEL_FACADES, PhysicsWorld, SCENARIO_PALETTE, THEME_BACKDROPS, blockBoxes, buildFacades, buildMapDecor, buildMapGeometry, coreCatalog, coreThemes, getItem, getProp, getStylePack, initPhysics, liftLinks, loadMap, mapTerrainMesh, navLinks, newScenarioEntities, propBoxes, validateMap, type MapDocument, type Rotation } from '../src/index.ts';
import { NavWorld, initNavigation, validateNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

type Tile = MapDocument['classicStructure']['tiles'][number];
const t = (id: string, tile: string, x: number, y: number, z = 0, rotation: Rotation = 0, extra: Partial<Tile> = {}): Tile => ({ id, tile, x, y, z, rotation, ...extra });

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url)).toString();

describe('Style Pack 12 Snow Outpost', () => {
  it('is registered with its theme, a snowy backdrop, its demo map and 25–40 pieces of its own', () => {
    const pack = getStylePack('snow')!;
    expect(pack).toMatchObject({ number: '12', displayName: 'Snow Outpost', demo: 'whiteout_station' });
    expect(pack.themes[0]).toBe('core.snow_outpost');
    expect(coreThemes.get('core.snow_outpost')).toBeDefined();
    expect(THEME_BACKDROPS['core.snow_outpost']).toMatchObject({ sky: 'snowy', ground: 'snow' });
    const own = pack.props.filter((p) => getProp(p)?.category === 'Snow Outpost').length + pack.tiles.filter((x) => x.startsWith('snow.')).length;
    expect(own).toBeGreaterThanOrEqual(25);
    expect(own).toBeLessThanOrEqual(40);
    for (const p of pack.props) expect(getProp(p), p).toBeDefined();
    for (const id of pack.tiles) expect(coreCatalog.get(id), id).toBeDefined();
    for (const k of pack.gameplay) expect(SCENARIO_PALETTE.some((e) => e.key === k), k).toBe(true);
    for (const i of pack.pickups) expect(getItem(i), i).toBeDefined();
  });

  it('our own props come from code, licence Owned; the hero stand-ins keep stable ids', () => {
    const manifest = JSON.parse(read('content/props.json')) as { packs: Record<string, { license: string; url: string }>; props: { id: string; pack: string }[] };
    expect(manifest.packs['tiletrigger-snow']).toMatchObject({ license: 'Owned', url: 'tools/content/prepare-snow.mjs' });
    const ours = manifest.props.filter((p) => p.id.startsWith('so_'));
    expect(ours.length).toBeGreaterThanOrEqual(14);
    for (const p of ours) expect(p.pack, p.id).toBe('tiletrigger-snow');
    // Candidates for Meshy or community hero versions later, under the same ids (HANDOFF.md).
    for (const id of ['so_snowmobile', 'so_satellite_dish', 'so_generator']) expect(ours.some((p) => p.id === id), id).toBe(true);
    expect(read('assets-src/tiletrigger-snow/License.txt')).toMatch(/no generative AI/);
  });

  it('the roll-up door, ice block and thin ice are palette pieces', () => {
    const [panel, mover] = newScenarioEntities('mover:rollup_door', [0, 0, 0], 0);
    expect(panel).toMatchObject({ kind: 'block', size: [6, 4.6, 0.2] });
    expect(mover).toMatchObject({ kind: 'mover', mode: 'trigger', points: [[0, 0, 0], [0, 4.4, 0]], blocks: [panel!.id] });
    expect(newScenarioEntities('block:ice', [0, 0, 0], 0)[0]).toMatchObject({ kind: 'block', behaviour: 'breakable', material: 'core.glacier_ice' });
    expect(newScenarioEntities('block:thin_ice', [0, 0, 0], 0)[0]).toMatchObject({ kind: 'block', behaviour: 'crumble', trigger: 'step', material: 'core.lake_ice' });
  });
});

describe('Style Pack 12 Snow Outpost tiles', () => {
  it('every tile is in the catalog and validates on its own', () => {
    const ids = coreCatalog.all().filter((d) => d.id.startsWith('snow.')).map((d) => d.id);
    expect(ids.length).toBeGreaterThanOrEqual(15);
    for (const id of ids) {
      const map = makeMap([t('a', id, 0, 0)], [[0, 0, -20]]);
      expect(validateMap(map).filter((i) => i.severity === 'error'), id).toEqual([]);
    }
  });

  it('huts keep their own panels, snow roofs and grating stairs in any theme', () => {
    const boxes = buildMapGeometry(makeMap([t('a', 'snow.hut', 0, 0)]));
    const mats = new Set(boxes.filter((b) => b.sourceId === 'a').map((b) => b.surface?.material));
    for (const m of ['core.prefab_red', 'core.drift_snow', 'core.steel_grating']) expect(mats.has(m), m).toBe(true);
  });

  it('the prefab and snowy concrete facades dress outside walls and leave the doorway clear', () => {
    for (const [facade, skin] of [['prefab', 'core.prefab_red'], ['snow_bunker', 'core.snowy_concrete']] as const) {
      expect(MODEL_FACADES.has(facade)).toBe(false);
      const map = makeMap([t('a', 'core.room', 0, 0, 0, 0, { options: { facade, ceiling: 'roof' }, edges: { '0,0,0:S': 'door' } })]);
      expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
      expect(buildFacades(map)).toEqual([]);
      const dressed = buildMapDecor(map).filter((b) => b.sourceId === 'a' && b.surface);
      expect(dressed.some((b) => b.surface!.material === skin), facade).toBe(true);
      expect(dressed.filter((b) => b.max[2] < -3.9 && b.min[0] > -1.4 && b.max[0] < 1.4 && b.min[1] < 2.9 && b.max[1] > 0.6), facade).toEqual([]);
    }
  });
});

describe('Snow pack navigation', () => {
  const turn = (x: number, z: number, r: number): [number, number] => {
    let [a, b] = [x, z];
    for (let i = 0; i < r; i++) [a, b] = [b, -a];
    return [a + 0, b + 0];
  };
  const yard = (x: number, y: number) => t(`y${x}_${y}`.replace(/-/g, 'm'), 'core.yard', x, y);
  const yards = (x0: number, y0: number, x1: number, y1: number, taken: readonly (readonly [number, number])[]): Tile[] => {
    const out: Tile[] = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (!taken.some(([a, b]) => a === x && b === y)) out.push(yard(x, y));
    return out;
  };
  const one = (id: string) => [t('m', id, 0, 0), ...yards(-1, -1, 1, 1, [[0, 0]])];
  const cases: { name: string; tiles: Tile[]; from: [number, number, number]; to: [number, number, number] }[] = [
    { name: 'prefab hut', tiles: one('snow.hut'), from: [0, 0, -6], to: [-1.3, 0, 0] },
    { name: 'prefab hut roof', tiles: one('snow.hut'), from: [0, 0, -6], to: [-1.5, 3.5, 0] },
    { name: 'comms hut roof', tiles: one('snow.comms_hut'), from: [0, 0, -6], to: [-1.5, 3.5, -2] },
    { name: 'barracks', tiles: [t('m', 'snow.barracks', 0, 0), ...yards(-1, -1, 2, 1, [[0, 0], [1, 0]])], from: [0, 0, -6], to: [8, 0, -1.3] },
    { name: 'barracks deck', tiles: [t('m', 'snow.barracks', 0, 0), ...yards(-1, -1, 2, 1, [[0, 0], [1, 0]])], from: [0, 0, -6], to: [8, 3.5, 2.6] },
    { name: 'barracks roof', tiles: [t('m', 'snow.barracks', 0, 0), ...yards(-1, -1, 2, 1, [[0, 0], [1, 0]])], from: [0, 0, -6], to: [6, 4.06, 0.2] },
    { name: 'hangar mezzanine', tiles: [t('m', 'snow.hangar', 0, 0), ...yards(-1, -1, 2, 2, [[0, 0], [1, 0], [0, 1], [1, 1]])], from: [4, 0, -6], to: [6, 4, 9.6] },
    { name: 'bunker', tiles: one('snow.bunker'), from: [0, 0, 6], to: [-1, 0, -1] },
    { name: 'bunker roof', tiles: one('snow.bunker'), from: [0, 0, 6], to: [-1.5, 3.2, -1] },
    { name: 'watchtower lookout', tiles: one('snow.watchtower'), from: [0, 0, -6], to: [0, 7, -2.6] },
    { name: 'radar dome', tiles: one('snow.radar_dome'), from: [0, 0, -6], to: [0, 0, 0] },
    { name: 'fuel depot', tiles: one('snow.fuel_depot'), from: [0, 0, -6], to: [-3.6, 0, 0] },
    { name: 'catwalk by the metal stair', tiles: [t('s', 'snow.metal_stair', 0, 0), t('c', 'snow.catwalk', 0, 1), ...yards(-1, -1, 1, 2, [[0, 0], [0, 1]])], from: [0, 0, -6], to: [0, 4, 10] },
    { name: 'frozen cliff top by a snow drift', tiles: [t('d', 'snow.drift_ramp', 0, 0), t('c', 'snow.ice_cliff', 0, 1), ...yards(-1, -1, 1, 2, [[0, 0], [0, 1]])], from: [0, 0, -6], to: [0, 4, 9] },
    { name: 'pressure ridge', tiles: one('snow.ice_ridge'), from: [0, 0, -6], to: [0, 0, 3] },
    { name: 'way out of the ice hole', tiles: one('snow.ice_hole'), from: [0, -1.5, -1.2], to: [0, 0, 6] },
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
