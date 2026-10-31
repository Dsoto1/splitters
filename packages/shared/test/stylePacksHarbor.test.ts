import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { MODEL_FACADES, PhysicsWorld, SCENARIO_PALETTE, blockBoxes, buildFacades, buildMapDecor, buildMapGeometry, coreCatalog, coreThemes, getItem, getProp, getStylePack, initPhysics, liftLinks, loadMap, mapLiquids, mapTerrainMesh, navLinks, newScenarioEntities, propBoxes, validateMap, type MapDocument, type Rotation } from '../src/index.ts';
import { NavWorld, initNavigation, validateNavigation } from '../src/match.ts';
import { HARBOR_BED, HARBOR_SEA } from '../src/map/packTilesHarbor.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

type Tile = MapDocument['classicStructure']['tiles'][number];
const t = (id: string, tile: string, x: number, y: number, z = 0, rotation: Rotation = 0, extra: Partial<Tile> = {}): Tile => ({ id, tile, x, y, z, rotation, ...extra });

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url)).toString();

describe('Style Pack 11 Coastal Harbor', () => {
  it('is registered with its theme, demo map and 25–40 pieces of its own', () => {
    const pack = getStylePack('harbor')!;
    expect(pack).toMatchObject({ number: '11', displayName: 'Coastal Harbor', demo: 'saltmarsh_harbor' });
    expect(pack.themes[0]).toBe('core.coastal');
    expect(coreThemes.get('core.coastal')).toBeDefined();
    const own = pack.props.filter((p) => getProp(p)?.category === 'Coastal Harbor').length + pack.tiles.filter((x) => x.startsWith('harbor.')).length;
    expect(own).toBeGreaterThanOrEqual(25);
    expect(own).toBeLessThanOrEqual(40);
    for (const p of pack.props) expect(getProp(p), p).toBeDefined();
    for (const id of pack.tiles) expect(coreCatalog.get(id), id).toBeDefined();
    for (const k of pack.gameplay) expect(SCENARIO_PALETTE.some((e) => e.key === k), k).toBe(true);
    for (const i of pack.pickups) expect(getItem(i), i).toBeDefined();
    expect(existsSync(new URL(`../../../maps/${pack.demo}.json`, import.meta.url))).toBe(true);
  });

  it('our own props come from code, licence Owned; the boat stand-in keeps its stable id', () => {
    const manifest = JSON.parse(read('content/props.json')) as { packs: Record<string, { license: string; url: string }>; props: { id: string; pack: string }[] };
    expect(manifest.packs['tiletrigger-harbor']).toMatchObject({ license: 'Owned', url: 'tools/content/prepare-harbor.mjs' });
    const ours = manifest.props.filter((p) => p.id.startsWith('hb_'));
    expect(ours.length).toBeGreaterThanOrEqual(16);
    for (const p of ours) expect(p.pack, p.id).toBe('tiletrigger-harbor');
    // The owner may swap it for a hero model later under the same id (HANDOFF.md).
    expect(ours.some((p) => p.id === 'hb_fishing_boat')).toBe(true);
    expect(read('assets-src/tiletrigger-harbor/License.txt')).toMatch(/no generative AI/);
  });

  it('Harbour Water sits on the bed with its surface under the quay, deep enough to swim', () => {
    const [w] = newScenarioEntities('water:harbour', [0, HARBOR_BED, 0], 0);
    expect(w).toMatchObject({ kind: 'water', liquid: 'water' });
    const [box] = mapLiquids([w!]);
    expect(box!.max.y).toBeCloseTo(HARBOR_SEA);
    expect(box!.max.y - box!.min.y).toBeGreaterThan(2);
  });
});

describe('Style Pack 11 Coastal Harbor tiles', () => {
  it('every tile is in the catalog and validates on its own', () => {
    const ids = coreCatalog.all().filter((d) => d.id.startsWith('harbor.')).map((d) => d.id);
    expect(ids.length).toBeGreaterThanOrEqual(18);
    for (const id of ids) {
      const map = makeMap([t('a', id, 0, 0)], [[0, 0, -20]]);
      expect(validateMap(map).filter((i) => i.severity === 'error'), id).toEqual([]);
    }
  });

  it('piers keep their decking and the lighthouse its bands in any theme', () => {
    const mats = (id: string) => new Set(buildMapGeometry(makeMap([t('a', id, 0, 0)])).filter((b) => b.sourceId === 'a').map((b) => b.surface?.material));
    expect(mats('harbor.pier').has('core.pier_decking')).toBe(true);
    expect(mats('harbor.quay').has('core.quay_granite')).toBe(true);
    expect(mats('harbor.lighthouse').has('core.lighthouse_bands')).toBe(true);
  });

  it('a pier leaves room to swim under it', () => {
    const boxes = buildMapGeometry(makeMap([t('a', 'harbor.pier', 0, 0)])).filter((b) => b.sourceId === 'a' && b.kind !== 'trim');
    // A swimmer's head stays below HARBOR_SEA + 0.9 m; nothing solid hangs there between the piles.
    const hit = boxes.filter((b) => b.min[1] < HARBOR_SEA + 1.0 && b.max[1] > HARBOR_SEA && b.min[0] < 1.5 && b.max[0] > -1.5);
    expect(hit).toEqual([]);
  });

  it('the harbour render and tarred timber facades dress outside walls and leave the doorway clear', () => {
    for (const [facade, skin] of [['harbour_render', 'core.harbour_render'], ['tarred_timber', 'core.tarred_boards']] as const) {
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

describe('Harbor pack navigation', () => {
  const turn = (x: number, z: number, r: number): [number, number] => {
    let [a, b] = [x, z];
    for (let i = 0; i < r; i++) [a, b] = [b, -a];
    return [a + 0, b + 0];
  };
  const fill = (tile: string, x0: number, y0: number, x1: number, y1: number, taken: readonly (readonly [number, number])[] = []): Tile[] => {
    const out: Tile[] = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (!taken.some(([a, b]) => a === x && b === y)) out.push(t(`${tile.slice(5, 8)}${x}_${y}`.replace(/-/g, 'm'), tile, x, y));
    return out;
  };
  const yards = (x0: number, y0: number, x1: number, y1: number, taken: readonly (readonly [number, number])[] = []) => fill('core.yard', x0, y0, x1, y1, taken);
  const water = (x0: number, y0: number, x1: number, y1: number, taken: readonly (readonly [number, number])[] = []) => fill('harbor.basin', x0, y0, x1, y1, taken);
  const B = HARBOR_BED;
  const cases: { name: string; tiles: Tile[]; from: [number, number, number]; to: [number, number, number]; near?: number }[] = [
    { name: 'warehouse upper floor', tiles: [t('m', 'harbor.warehouse', 0, 0), ...yards(-1, -1, 2, 1, [[0, 0], [1, 0]])], from: [0, 0, -6], to: [8, 4, -1.5] },
    { name: 'warehouse roof by an outside stair', tiles: [t('m', 'harbor.warehouse', 0, 0), t('s', 'medieval.outside_stair', 0, 1), ...yards(-1, -1, 2, 2, [[0, 0], [1, 0], [0, 1]])], from: [0, 0, -6], to: [4, 9.6, 2] },
    { name: "harbourmaster's balcony", tiles: [t('m', 'harbor.office', 0, 0), ...yards(-1, -1, 2, 1, [[0, 0], [1, 0]])], from: [0, 0, -6], to: [8, 4, -2.5] },
    { name: 'net shed loft', tiles: [t('m', 'harbor.net_shed', 0, 0), ...yards(-1, -1, 2, 1, [[0, 0], [1, 0]])], from: [0, 0, -6], to: [8, 4, -1.5] },
    // The gallery is a narrow strip behind the parapet: arriving anywhere on it counts.
    { name: 'lighthouse gallery', tiles: [t('m', 'harbor.lighthouse', 0, 0), ...yards(-1, -1, 1, 1, [[0, 0]])], from: [0, 0, -6], to: [0, 10.5, -2.4], near: 2 },
    { name: 'fish market aisle', tiles: [t('m', 'harbor.fish_market', 0, 0), ...yards(-1, -1, 2, 1, [[0, 0], [1, 0]])], from: [0, 0, -6], to: [8, 0, 0] },
    { name: 'arch passage', tiles: [t('m', 'harbor.arch', 0, 0), ...yards(-1, -1, 1, 1, [[0, 0]])], from: [0, 0, -6], to: [0, 0, 6] },
    { name: 'under the crane', tiles: [t('m', 'harbor.crane', 0, 0), ...yards(-1, -1, 1, 1, [[0, 0]])], from: [0, 0, -6], to: [0, 0, 6] },
    {
      name: 'pier head from the quay',
      tiles: [...fill('harbor.quay', -1, 0, 1, 0, [[0, 0]]), t('q', 'harbor.quayside', 0, 0), t('p', 'harbor.pier', 0, 1), t('h', 'harbor.pier_head', 0, 2), ...water(-1, 1, 1, 3, [[0, 1], [0, 2]]), ...yards(-1, -1, 1, -1)],
      from: [0, 0, -6],
      to: [0, 0, 18],
    },
    {
      name: 'harbour bed under the pier',
      tiles: [...fill('harbor.quay', -1, 0, 1, 0), t('p', 'harbor.pier', 0, 1), ...water(-1, 1, 1, 2, [[0, 1]]), ...yards(-1, -1, 1, -1)],
      from: [-8, B, 9],
      to: [8, B, 9],
    },
    {
      name: 'quay from the water by the sea wall steps',
      tiles: [t('s', 'harbor.quay_steps', 0, 0), ...fill('harbor.quay', -1, 0, 2, 0, [[0, 0], [1, 0]]), ...water(-1, 1, 2, 2), ...yards(-1, -1, 2, -1)],
      from: [6, B, 10],
      to: [-2, 0, -6],
    },
    { name: 'quay from the water up the slipway', tiles: [t('s', 'harbor.slipway', 0, 0), ...fill('harbor.quay', -1, 0, 1, 0, [[0, 0]]), ...water(-1, 1, 1, 2), ...yards(-1, -1, 1, -1)], from: [0, B, 12], to: [0, 0, -6] },
    { name: 'ground from the water up the beach', tiles: [t('s', 'harbor.beach', 0, 0), ...fill('harbor.quay', -1, 0, 1, 0, [[0, 0]]), ...water(-1, 1, 1, 2), ...yards(-1, -1, 1, -1)], from: [0, B, 12], to: [0, 0, -6] },
    {
      name: 'along the breakwater',
      tiles: [...fill('harbor.quay', -1, 0, 1, 0, [[0, 0]]), t('q', 'harbor.quayside', 0, 0), t('b1', 'harbor.breakwater', 0, 1), t('b2', 'harbor.breakwater', 0, 2), ...water(-1, 1, 1, 3, [[0, 1], [0, 2]]), ...yards(-1, -1, 1, -1)],
      from: [0, 0, -6],
      to: [0.5, 0, 18],
    },
    {
      name: 'boardwalk round its corner',
      tiles: [t('q', 'harbor.quayside', 0, 0), t('w', 'harbor.boardwalk', 0, 1), t('c', 'harbor.boardwalk_turn', 0, 2), t('e', 'harbor.boardwalk', 1, 2, 0, 1), ...water(-1, 1, 2, 3, [[0, 1], [0, 2], [1, 2]]), ...fill('harbor.quay', -1, 0, 2, 0, [[0, 0]]), ...yards(-1, -1, 2, -1)],
      from: [0, 0, -6],
      to: [10, 0, 16],
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
        expect(Math.hypot(end.x - tx, end.y - c.to[1], end.z - tz), `${c.name} r${r}`).toBeLessThan(c.near ?? 1.2);
        nav.destroy();
      }
    });
  }
});

describe("Saltmarsh Harbor (the pack's demo map)", () => {
  it("validates with no issues, navigation included, and has the harbour's landmarks", { timeout: 180_000 }, () => {
    const r = loadMap(read('maps/saltmarsh_harbor.json'));
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.issues).toEqual([]);
    const map = r.map;
    expect(map.classicStructure.theme).toBe('core.coastal');
    const tiles = new Set(map.classicStructure.tiles.map((x) => x.tile));
    for (const id of ['harbor.pier', 'harbor.pier_head', 'harbor.boardwalk', 'harbor.quay', 'harbor.quay_steps', 'harbor.slipway', 'harbor.breakwater', 'harbor.warehouse', 'harbor.office', 'harbor.net_shed', 'harbor.fish_market', 'harbor.lighthouse', 'harbor.crane', 'harbor.arch']) expect(tiles.has(id), id).toBe(true);
    const spawns = map.entities.filter((e) => e.kind === 'spawn');
    for (const team of ['embers', 'tide']) expect(spawns.filter((e) => e.faction === team).length, team).toBeGreaterThanOrEqual(12);
    expect(map.entities.filter((e) => e.kind === 'flag')).toHaveLength(2);
    expect(map.entities.some((e) => e.kind === 'water')).toBe(true);
    expect(map.entities.some((e) => e.kind === 'mount' && e.onWater)).toBe(true);
    for (const e of map.entities) if (e.kind === 'pickup') expect(getItem(e.item), e.item).toBeDefined();
    const geometry = buildMapGeometry(map);
    const physics = new PhysicsWorld(geometry, mapTerrainMesh(map));
    const nav = NavWorld.build([...geometry, ...propBoxes(map, true), ...blockBoxes(map, true)], mapTerrainMesh(map), [...navLinks(map.entities, physics), ...liftLinks(map)]);
    physics.free();
    expect(validateNavigation(map, nav)).toEqual([]);
    nav.destroy();
  });
});
