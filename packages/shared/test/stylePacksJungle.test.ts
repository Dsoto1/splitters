import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PhysicsWorld, SCENARIO_PALETTE, blockBoxes, buildMapDecor, buildMapGeometry, coreCatalog, coreMaterials, coreThemes, getItem, getProp, getStylePack, initPhysics, liftLinks, loadMap, mapTerrainMesh, navLinks, propBoxes, validateMap, type MapDocument, type Rotation } from '../src/index.ts';
import { NavWorld, initNavigation, validateNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

type Tile = MapDocument['classicStructure']['tiles'][number];
const t = (id: string, tile: string, x: number, y: number, z = 0, rotation: Rotation = 0, extra: Partial<Tile> = {}): Tile => ({ id, tile, x, y, z, rotation, ...extra });

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url)).toString();

/** The tiles the Jungle Ruins pack had before the refresh: existing maps use them, so they must stay. */
const ORIGINAL_TILES = ['jungle.ziggurat', 'jungle.temple_gate', 'jungle.temple_wall', 'jungle.cliff', 'jungle.cliff_corner', 'jungle.cliff_ramp', 'jungle.cave', 'jungle.cave_mouth', 'jungle.waterfall_basin', 'jungle.river', 'jungle.giant_tree', 'jungle.ruined_court'];
const ORIGINAL_PROPS = ['jg_stone_idol', 'jg_serpent_statue', 'jg_carved_pillar', 'jg_altar_stone', 'jg_stele', 'jg_vine_curtain', 'jg_liana', 'jg_bridge_post', 'jg_waterfall', 'jg_giant_root', 'jg_banana_plant', 'jg_giant_fern', 'jg_monstera', 'jg_bamboo', 'jg_brazier', 'jg_rubble_blocks', 'jg_gold_idol'];

describe('Style Pack 06 Jungle Ruins (refreshed, Ancient Temple folded in)', () => {
  it('keeps every original tile, prop, material and theme, and adds the refresh', () => {
    const pack = getStylePack('jungle')!;
    expect(pack).toMatchObject({ number: '06', displayName: 'Jungle Ruins' });
    expect(pack.themes[0]).toBe('core.jungle_temple');
    for (const id of ['core.jungle_temple', 'core.ancient_temple']) expect(coreThemes.get(id), id).toBeDefined();
    for (const id of ORIGINAL_TILES) {
      expect(coreCatalog.get(id), id).toBeDefined();
      expect(pack.tiles, id).toContain(id);
    }
    for (const id of ORIGINAL_PROPS) {
      expect(getProp(`prop.${id}`), id).toBeDefined();
      expect(pack.props, id).toContain(`prop.${id}`);
    }
    for (const m of ['core.pbr_jungle_rock', 'core.pbr_mossy_cobble']) expect(pack.materials, m).toContain(m);
    const tiles = pack.tiles.filter((x) => x.startsWith('jungle.'));
    expect(tiles.length).toBeGreaterThanOrEqual(ORIGINAL_TILES.length + 18);
    for (const p of pack.props) expect(getProp(p), p).toBeDefined();
    for (const id of pack.tiles) expect(coreCatalog.get(id), id).toBeDefined();
    for (const m of pack.materials) expect(coreMaterials.get(m), m).toBeDefined();
    for (const k of pack.gameplay) expect(SCENARIO_PALETTE.some((e) => e.key === k), k).toBe(true);
    for (const i of pack.pickups) expect(getItem(i), i).toBeDefined();
  });

  it('the owner\'s must-haves are there: carved, relief and window walls, beamed and arch ceilings, a zipline post, a watch tower', () => {
    for (const id of ['jungle.wall_carved', 'jungle.wall_relief', 'jungle.wall_window', 'jungle.beamed_hall', 'jungle.arch_hall', 'jungle.watch_tower']) expect(coreCatalog.get(id), id).toBeDefined();
    expect(getProp('prop.jt_zipline_post')).toBeDefined();
  });

  it('our own new props come from code, licence Owned; the hero stand-ins keep stable ids', () => {
    const manifest = JSON.parse(read('content/props.json')) as { packs: Record<string, { license: string; url: string }>; props: { id: string; pack: string; category: string }[] };
    expect(manifest.packs['tiletrigger-jungle']).toMatchObject({ license: 'Owned', url: 'tools/content/prepare-jungle.mjs' });
    const ours = manifest.props.filter((p) => p.id.startsWith('jt_'));
    expect(ours.length).toBeGreaterThanOrEqual(18);
    for (const p of ours) {
      expect(p.pack, p.id).toBe('tiletrigger-jungle');
      expect(p.category, p.id).toBe('Jungle Ruins');
    }
    // Simple in-house versions of hero pieces; Meshy versions may replace them later under the same ids (HANDOFF.md).
    for (const id of ['jt_statue_large', 'jt_zipline_post', 'jt_crane']) expect(ours.some((p) => p.id === id), id).toBe(true);
    expect(read('assets-src/tiletrigger-jungle/License.txt')).toMatch(/no generative AI/);
  });
});

describe('Jungle Ruins refresh tiles', () => {
  it('every tile is in the catalog and validates on its own', () => {
    const ids = coreCatalog.all().filter((d) => d.id.startsWith('jungle.') && !ORIGINAL_TILES.includes(d.id)).map((d) => d.id);
    expect(ids.length).toBeGreaterThanOrEqual(18);
    for (const id of ids) {
      const map = makeMap([t('a', id, 0, 0)], [[0, 0, -20]]);
      expect(validateMap(map).filter((i) => i.severity === 'error'), id).toEqual([]);
    }
  });

  it('the temple keeps its carved and relief stone in any theme', () => {
    const map = makeMap([t('a', 'jungle.temple', 0, 0)]);
    const boxes = [...buildMapGeometry(map), ...buildMapDecor(map)];
    const mats = new Set(boxes.filter((b) => b.sourceId === 'a').map((b) => b.surface?.material));
    for (const m of ['core.carved_stone', 'core.relief_stone', 'core.mossy_stone', 'core.temple_inlay']) expect(mats.has(m), m).toBe(true);
  });

  it('terraces stack: a terrace stair and terraces one level up stand on the ones below', () => {
    const map = makeMap([t('s', 'jungle.terrace_stair', 0, 0), t('a', 'jungle.terrace', 0, 2), t('u', 'jungle.terrace_stair', 0, 1, 1)], [[0, 0, -10]]);
    expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
  });
});

describe('Jungle Ruins refresh navigation', () => {
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
  const cases: { name: string; tiles: Tile[]; from: [number, number, number]; to: [number, number, number] }[] = [
    { name: 'terrace stair landing', tiles: [t('m', 'jungle.terrace_stair', 0, 0), ...yards(-1, -1, 1, 2, [[0, 0], [0, 1]])], from: [0, 0, -6], to: [0, 4, 9] },
    {
      name: 'second terrace up a stacked stair',
      tiles: [t('m', 'jungle.terrace_stair', 0, 0), t('a', 'jungle.terrace', 0, 2), t('u', 'jungle.terrace_stair', 0, 1, 1), ...yards(-1, -1, 1, 3, [[0, 0], [0, 1], [0, 2]])],
      from: [0, 0, -6],
      to: [0, 8, 17],
    },
    { name: 'carved temple roof', tiles: [t('m', 'jungle.temple', 0, 0), ...yards(-1, -1, 2, 1, [[0, 0], [1, 0]])], from: [0, 0, -8], to: [10, 4, 0] },
    { name: 'beamed colonnade roof from the temple roof', tiles: [t('m', 'jungle.temple', 0, 0), t('b', 'jungle.beamed_hall', 2, 0), ...yards(-1, -1, 3, 1, [[0, 0], [1, 0], [2, 0]])], from: [0, 0, -8], to: [16, 4, 0] },
    { name: 'carved temple back door', tiles: [t('m', 'jungle.temple', 0, 0), ...yards(-1, -1, 2, 1, [[0, 0], [1, 0]])], from: [0, 0, -8], to: [10, 0, 6] },
    { name: 'summit shrine altar', tiles: [t('m', 'jungle.shrine', 0, 0), ...yards(-1, -1, 1, 1, [[0, 0]])], from: [0, 0, -8], to: [0, 0, 0] },
    { name: 'watch tower lookout', tiles: [t('m', 'jungle.watch_tower', 0, 0), ...yards(-1, -1, 1, 1, [[0, 0]])], from: [0, 0, -6], to: [0, 7, -2.6] },
    { name: 'arched vault', tiles: [t('m', 'jungle.arch_hall', 0, 0), ...yards(-1, -1, 1, 1, [[0, 0]])], from: [0, 0, -6], to: [0, 0, 6] },
    { name: 'beamed colonnade', tiles: [t('m', 'jungle.beamed_hall', 0, 0), ...yards(-1, -1, 1, 1, [[0, 0]])], from: [0, 0, -6], to: [0, 0, 6] },
    { name: 'way through the arch wall', tiles: [t('m', 'jungle.wall_arch', 0, 0), ...yards(-1, -1, 1, 1, [[0, 0]])], from: [0, 0, -2], to: [0, 0, 6] },
    { name: 'passage behind the falls', tiles: [t('m', 'jungle.waterfall_wall', 0, 0), ...yards(-1, -1, 1, -1, [])], from: [0, 0, -6], to: [0, 0, 3.5] },
    { name: 'rope bridge over a chasm', tiles: [t('m', 'jungle.chasm_bridge', 0, 0), t('a', 'jungle.chasm', -1, 0), t('b', 'jungle.chasm', 1, 0), ...yards(-1, -1, 1, -1, []), ...yards(-1, 1, 1, 1, [])], from: [0, 0, -6], to: [0, 0, 6] },
    { name: 'gorge steps out of the chasm', tiles: [t('m', 'jungle.chasm_steps', 0, 0), t('a', 'jungle.chasm', 1, 0), t('b', 'jungle.chasm', 2, 0), ...yards(-1, -1, -1, 1, []), ...yards(0, -1, 2, -1, []), ...yards(0, 1, 2, 1, [])], from: [16, -4, 0], to: [-8, 0, 0] },
    {
      name: 'rope bridge span between terraces',
      tiles: [t('n', 'jungle.terrace', 0, 2), t('s', 'jungle.terrace', 0, 0), t('c', 'jungle.chasm', 0, 1), t('m', 'jungle.rope_bridge', 0, 1, 1)],
      from: [0, 4, 0],
      to: [0, 4, 16],
    },
    {
      name: 'stone bridge span between terraces',
      tiles: [t('n', 'jungle.terrace', 0, 2), t('s', 'jungle.terrace', 0, 0), t('c', 'core.yard', 0, 1), t('m', 'jungle.stone_bridge', 0, 1, 1)],
      from: [0, 4, 0],
      to: [0, 4, 16],
    },
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

/** Every map in maps/ that uses a Jungle Ruins tile, prop or theme. */
const jungleMaps = readdirSync(new URL('../../../maps/', import.meta.url))
  .filter((f) => f.endsWith('.json'))
  .filter((f) => /"jungle\.|prop\.jg_|prop\.jt_|core\.jungle_temple|core\.ancient_temple/.test(read(`maps/${f}`)) || f === 'jungle_steps.json');

describe('maps using Jungle Ruins pieces still load', () => {
  it('finds them (Verdant Ziggurat, Erosion, Jungle Steps and the rest)', () => {
    for (const f of ['verdant_ziggurat.json', 'erosion.json', 'jungle_steps.json', 'sunken_kingdom.json']) expect(jungleMaps, f).toContain(f);
  });
  for (const f of jungleMaps) {
    it(`${f} loads and validates with no errors`, () => {
      const r = loadMap(read(`maps/${f}`));
      if (!r.ok) throw new Error(JSON.stringify(r.issues));
      expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
      expect(validateMap(r.map).filter((i) => i.severity === 'error')).toEqual([]);
      for (const e of r.map.entities) if (e.kind === 'prop') expect(getProp(e.model), e.model).toBeDefined();
      for (const tile of r.map.classicStructure.tiles) expect(coreCatalog.get(tile.tile), tile.tile).toBeDefined();
    });
  }
});

describe('The pack\'s demo map', () => {
  it('validates with no issues, navigation included, and has the pack\'s landmarks', { timeout: 180_000 }, () => {
    const pack = getStylePack('jungle')!;
    const r = loadMap(read(`maps/${pack.demo}.json`));
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.issues).toEqual([]);
    const map = r.map;
    const tiles = new Set(map.classicStructure.tiles.map((x) => x.tile));
    for (const id of ['jungle.temple', 'jungle.terrace', 'jungle.terrace_stair', 'jungle.rope_bridge', 'jungle.waterfall_wall', 'jungle.watch_tower', 'jungle.chasm_bridge']) expect(tiles.has(id), id).toBe(true);
    const spawns = map.entities.filter((e) => e.kind === 'spawn');
    for (const team of ['embers', 'tide']) expect(spawns.filter((e) => e.faction === team).length, team).toBeGreaterThanOrEqual(8);
    expect(map.entities.filter((e) => e.kind === 'flag')).toHaveLength(2);
    for (const e of map.entities) if (e.kind === 'pickup') expect(getItem(e.item), e.item).toBeDefined();
    const geometry = buildMapGeometry(map);
    const physics = new PhysicsWorld(geometry, mapTerrainMesh(map));
    const nav = NavWorld.build([...geometry, ...propBoxes(map, true), ...blockBoxes(map, true)], mapTerrainMesh(map), [...navLinks(map.entities, physics), ...liftLinks(map)]);
    physics.free();
    expect(validateNavigation(map, nav)).toEqual([]);
    nav.destroy();
  });
});
