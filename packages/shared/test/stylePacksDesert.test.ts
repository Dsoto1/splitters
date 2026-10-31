import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { MODEL_FACADES, PhysicsWorld, SCENARIO_PALETTE, STYLE_PACKS, blockBoxes, buildFacades, buildMapDecor, buildMapGeometry, coreCatalog, coreMaterials, coreThemes, getItem, getProp, getStylePack, initPhysics, liftLinks, loadMap, mapTerrainMesh, navLinks, newScenarioEntities, propBoxes, validateMap, type MapDocument, type Rotation } from '../src/index.ts';
import { NavWorld, initNavigation, validateNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

type Tile = MapDocument['classicStructure']['tiles'][number];
const t = (id: string, tile: string, x: number, y: number, z = 0, rotation: Rotation = 0, extra: Partial<Tile> = {}): Tile => ({ id, tile, x, y, z, rotation, ...extra });

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url)).toString();

/** The Sands of Egypt pieces (tiles, props, theme, facade, materials) that maps made before Desert City replaced it may use. */
const EGYPT = /"egypt\.|"prop\.eg_|"core\.egypt"|"core\.(hieroglyphs|hieroglyphs_painted|pbr_sandstone_blocks|pbr_rough_sandstone|lapis|gold_leaf)"|"egyptian"/;

describe('Style Pack 09 Desert City (in Sands of Egypt\'s place)', () => {
  it('is registered as 09 with its theme, demo map and 25–40 pieces of its own; Sands of Egypt is no longer a pack', () => {
    const pack = getStylePack('desert')!;
    expect(pack).toMatchObject({ number: '09', displayName: 'Desert City', demo: 'qasr_medina' });
    expect(pack.themes[0]).toBe('core.desert_city');
    expect(coreThemes.get('core.desert_city')).toBeDefined();
    expect(getStylePack('egypt')).toBeUndefined();
    expect(STYLE_PACKS.filter((p) => p.number === '09')).toHaveLength(1);
    const own = pack.props.filter((p) => getProp(p)?.category === 'Desert City').length + pack.tiles.filter((x) => x.startsWith('desert.')).length;
    expect(own).toBeGreaterThanOrEqual(25);
    expect(own).toBeLessThanOrEqual(40);
    for (const p of pack.props) expect(getProp(p), p).toBeDefined();
    for (const id of pack.tiles) expect(coreCatalog.get(id), id).toBeDefined();
    for (const m of pack.materials) expect(coreMaterials.get(m), m).toBeDefined();
    for (const k of pack.gameplay) expect(SCENARIO_PALETTE.some((e) => e.key === k), k).toBe(true);
  });

  it('keeps every Sands of Egypt tile, prop, material, theme and facade defined, and folds them into the Desert City pack', () => {
    const pack = getStylePack('desert')!;
    const egyptTiles = coreCatalog.all().filter((d) => d.id.startsWith('egypt.')).map((d) => d.id);
    expect(egyptTiles.length).toBe(11);
    for (const id of egyptTiles) expect(pack.tiles, id).toContain(id);
    for (const id of ['eg_obelisk', 'eg_sphinx', 'eg_statue_pharaoh', 'eg_anubis', 'eg_sarcophagus', 'eg_canopic_jars', 'eg_column_papyrus', 'eg_felucca', 'eg_reed_boat', 'eg_palm', 'eg_papyrus', 'eg_torch', 'eg_chest', 'eg_stele', 'eg_cat_statue']) {
      expect(getProp(`prop.${id}`), id).toBeDefined();
      expect(pack.props, id).toContain(`prop.${id}`);
    }
    for (const m of ['core.pbr_sandstone_blocks', 'core.pbr_rough_sandstone', 'core.hieroglyphs', 'core.hieroglyphs_painted', 'core.lapis', 'core.gold_leaf']) expect(coreMaterials.get(m), m).toBeDefined();
    expect(coreThemes.get('core.egypt')).toBeDefined();
    expect(pack.themes).toContain('core.egypt');
    expect(pack.facades).toContain('egyptian');
  });

  it('every map that uses Sands of Egypt pieces still loads with no issues and nothing lost', () => {
    const dir = new URL('../../../maps/', import.meta.url);
    const users = readdirSync(dir).filter((f) => f.endsWith('.json') && EGYPT.test(readFileSync(new URL(f, dir)).toString()));
    expect(users).toEqual(expect.arrayContaining(['pharaohs_reach.json', 'sunken_kingdom.json']));
    for (const f of users) {
      const text = readFileSync(new URL(f, dir)).toString();
      const r = loadMap(text);
      if (!r.ok) throw new Error(`${f}: ${JSON.stringify(r.issues)}`);
      expect(r.issues, f).toEqual([]);
      // No errors, and nothing it uses is unknown (After Hours keeps its own logic warning, unrelated).
      expect(validateMap(r.map).filter((i) => i.severity === 'error' || /^(tile|prop|material|theme)\.unknown$/.test(i.code)), f).toEqual([]);
      const raw = JSON.parse(text) as { classicStructure: { tiles: unknown[] }; entities: unknown[] };
      expect(r.map.classicStructure.tiles.length, f).toBe(raw.classicStructure.tiles.length);
      expect(r.map.entities.length, f).toBe(raw.entities.length);
      for (const tile of r.map.classicStructure.tiles) expect(coreCatalog.get(tile.tile), `${f} ${tile.tile}`).toBeDefined();
      for (const e of r.map.entities) if (e.kind === 'prop') expect(getProp(e.model), `${f} ${e.model}`).toBeDefined();
    }
  });

  it('our own props come from code, licence Owned; the hero stand-ins keep stable ids', () => {
    const manifest = JSON.parse(read('content/props.json')) as { packs: Record<string, { license: string; url: string }>; props: { id: string; pack: string }[] };
    expect(manifest.packs['tiletrigger-desert']).toMatchObject({ license: 'Owned', url: 'tools/content/prepare-desert.mjs' });
    const ours = manifest.props.filter((p) => p.id.startsWith('dc_'));
    expect(ours.length).toBeGreaterThanOrEqual(16);
    for (const p of ours) expect(p.pack, p.id).toBe('tiletrigger-desert');
    // Simple in-house versions under ids a better model can take over later (HANDOFF.md).
    for (const id of ['dc_well', 'dc_market_stall', 'dc_crane']) expect(ours.some((p) => p.id === id), id).toBe(true);
    expect(read('assets-src/tiletrigger-desert/License.txt')).toMatch(/no generative AI/);
  });

  it('the lattice screen is a breakable palette piece', () => {
    expect(newScenarioEntities('block:lattice', [0, 0, 0], 0)[0]).toMatchObject({ kind: 'block', behaviour: 'breakable', material: 'core.mashrabiya' });
  });
});

describe('Style Pack 09 Desert City tiles', () => {
  it('every tile is in the catalog, validates on its own and stays inside its own cells in every rotation', () => {
    const defs = coreCatalog.all().filter((d) => d.id.startsWith('desert.'));
    expect(defs.length).toBeGreaterThanOrEqual(16);
    for (const def of defs) {
      for (const rotation of [0, 1, 2, 3] as Rotation[]) {
        const map = makeMap([t('a', def.id, 0, 0, 0, rotation)], [[0, 0, -20]]);
        expect(validateMap(map).filter((i) => i.severity === 'error'), def.id).toEqual([]);
        // The cells' footprint in world space (rotation turns the footprint about the first cell).
        const cells = def.cells.map(([dx, dy]) => {
          let [x, y] = [dx, dy];
          for (let i = 0; i < rotation; i++) [x, y] = [y, -x];
          return [x * 8, y * 8] as const;
        });
        const lo = [Math.min(...cells.map((c) => c[0])) - 4, Math.min(...cells.map((c) => c[1])) - 4];
        const hi = [Math.max(...cells.map((c) => c[0])) + 4, Math.max(...cells.map((c) => c[1])) + 4];
        for (const box of buildMapGeometry(map).filter((x) => x.sourceId === 'a')) {
          const r = box.yaw || box.pitch || box.roll ? 0.15 : 0.001;
          expect(box.min[0], `${def.id} r${rotation}`).toBeGreaterThanOrEqual(lo[0]! - r);
          expect(box.min[2], `${def.id} r${rotation}`).toBeGreaterThanOrEqual(lo[1]! - r);
          expect(box.max[0], `${def.id} r${rotation}`).toBeLessThanOrEqual(hi[0]! + r);
          expect(box.max[2], `${def.id} r${rotation}`).toBeLessThanOrEqual(hi[1]! + r);
        }
      }
    }
  });

  it('houses keep their own ashlar, plaster and tiles in any theme', () => {
    const boxes = buildMapGeometry(makeMap([t('a', 'desert.house_ashlar', 0, 0), t('b', 'desert.house', 0, 2)]));
    const mats = new Set(boxes.filter((b) => b.sourceId === 'a' || b.sourceId === 'b').map((b) => b.surface?.material));
    for (const m of ['core.ashlar', 'core.stucco', 'core.sandstone_tiles', 'core.cedar']) expect(mats.has(m), m).toBe(true);
  });

  it('the desert ashlar and plaster facades dress outside walls and leave the doorway clear', () => {
    for (const [facade, skin] of [['desert_ashlar', 'core.ashlar'], ['desert_plaster', 'core.stucco']] as const) {
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

describe('Desert City navigation', () => {
  // Not here: the Minaret (a landmark, not climbed) and the Domed Hall's roof (not reachable on purpose).
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
  const house = (id: string) => [t('m', id, 0, 0), ...yards(-1, -1, 2, 1, [[0, 0], [1, 0]])];
  const cases: { name: string; tiles: Tile[]; from: [number, number, number]; to: [number, number, number] }[] = [
    { name: 'plaster house upper floor', tiles: house('desert.house'), from: [0, 0, -6], to: [10, 4, 0] },
    { name: 'plaster house roof terrace', tiles: house('desert.house'), from: [0, 0, -6], to: [0, 8, 2] },
    { name: 'ashlar house roof terrace', tiles: house('desert.house_ashlar'), from: [0, 0, -6], to: [10, 8, 2] },
    { name: 'shop house roof terrace', tiles: house('desert.house_shop'), from: [0, 0, -6], to: [-2, 8, 0] },
    { name: 'next roof along the row', tiles: [t('m', 'desert.house', 0, 0), t('n', 'desert.house', 2, 0), ...yards(-1, -1, 4, 1, [[0, 0], [1, 0], [2, 0], [3, 0]])], from: [0, 0, -6], to: [22, 8, 2] },
    { name: 'roof by the outside stair', tiles: [t('m', 'desert.house', 0, 0), t('s', 'desert.outside_stair', 0, 1), ...yards(-1, -1, 2, 2, [[0, 0], [1, 0], [0, 1]])], from: [8, 0, 10], to: [8, 8, 0] },
    { name: 'rope bridge between roofs', tiles: [t('m', 'desert.house', 0, 0), t('w', 'desert.rope_bridge', 2, 0), t('n', 'desert.house', 3, 0), ...yards(-1, -1, 5, 1, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]])], from: [0, 8, 2], to: [30, 8, 2] },
    { name: 'cedar gallery between upper floors', tiles: [t('m', 'desert.house', 0, 0), t('w', 'desert.gallery', 2, 0), t('n', 'desert.house', 3, 0), ...yards(-1, -1, 5, 1, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]])], from: [0, 0, -6], to: [28, 4, -1] },
    { name: 'courtyard terrace', tiles: [t('m', 'desert.courtyard', 0, 0), ...yards(-1, -1, 2, 2, [[0, 0], [1, 0], [0, 1], [1, 1]])], from: [0, 0, -12], to: [10.5, 4, -2] },
    { name: 'courtyard fountain', tiles: [t('m', 'desert.courtyard', 0, 0), ...yards(-1, -1, 2, 2, [[0, 0], [1, 0], [0, 1], [1, 1]])], from: [16, 0, 16], to: [6.5, 0, 4] },
    { name: 'bazaar lane and alcoves', tiles: [t('m', 'desert.bazaar', 0, 0), ...yards(-1, -1, 1, 2, [[0, 0], [0, 1]])], from: [-8, 0, 0], to: [2.7, 0, 8] },
    { name: 'bazaar roof from a house\'s upper door', tiles: [t('m', 'desert.house', -2, 0), t('b', 'desert.bazaar', 0, 0), ...yards(-3, -1, 1, 2, [[-2, 0], [-1, 0], [0, 0], [0, 1]])], from: [-16, 0, -6], to: [2, 4, 6] },
    { name: 'market street', tiles: [t('m', 'desert.market_street', 0, 0), ...yards(-1, -1, 1, 1, [[0, 0]])], from: [0, 0, -8], to: [0, 0, 8] },
    { name: 'domed hall fountain', tiles: [t('m', 'desert.dome', 0, 0), ...yards(-1, -1, 1, 1, [[0, 0]])], from: [0, 0, -8], to: [1.6, 0, 1.6] },
    { name: 'watch tower lookout', tiles: [t('m', 'desert.tower', 0, 0), ...yards(-1, -1, 1, 1, [[0, 0]])], from: [0, 0, -8], to: [-2.6, 8, -2.7] },
    { name: 'city gate passage', tiles: [t('m', 'desert.city_gate', 0, 0), ...yards(-1, -1, 3, 1, [[0, 0], [1, 0], [2, 0]])], from: [8, 0, -8], to: [8, 0, 8] },
    { name: 'wall-walk over the gate', tiles: [t('m', 'desert.city_gate', 0, 0), t('w', 'desert.city_wall', 3, 0), ...yards(-1, -1, 4, 1, [[0, 0], [1, 0], [2, 0], [3, 0]])], from: [0, 0, 6], to: [24, 4, -1.5] },
    { name: 'wall-walk from a wall stair', tiles: [t('m', 'desert.wall_stair', 0, 0), t('n', 'desert.city_wall', 2, 0), ...yards(-1, -1, 3, 1, [[0, 0], [1, 0], [2, 0]])], from: [0, 0, 6], to: [18, 4, -2] },
    { name: 'terrace by an outside stair\'s landing', tiles: [t('m', 'desert.terrace', 0, 0), t('s', 'desert.outside_stair', 0, 1), ...yards(-1, -1, 1, 2, [[0, 0], [0, 1]])], from: [0, 0, -8], to: [2, 4, 0] },
    { name: 'well court', tiles: [t('m', 'desert.well_court', 0, 0), ...yards(-1, -1, 1, 1, [[0, 0]])], from: [0, 0, -8], to: [3, 0, 3] },
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

describe('Qasr Medina (the pack\'s demo map)', () => {
  it('validates with no issues, navigation included, and has the medina\'s landmarks', { timeout: 240_000 }, () => {
    const r = loadMap(read('maps/qasr_medina.json'));
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.issues).toEqual([]);
    const map = r.map;
    expect(map.classicStructure.theme).toBe('core.desert_city');
    const tiles = new Set(map.classicStructure.tiles.map((x) => x.tile));
    for (const id of ['desert.house', 'desert.house_ashlar', 'desert.house_shop', 'desert.outside_stair', 'desert.rope_bridge', 'desert.courtyard', 'desert.bazaar', 'desert.market_street', 'desert.dome', 'desert.tower', 'desert.minaret', 'desert.city_gate', 'desert.city_wall']) expect(tiles.has(id), id).toBe(true);
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
