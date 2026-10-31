import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MODEL_FACADES, SCENARIO_PALETTE, buildFacades, buildMapDecor, buildMapGeometry, coreCatalog, coreThemes, getProp, getStylePack, initPhysics, newScenarioEntities, validateMap, type MapDocument, type Rotation } from '../src/index.ts';
import { NavWorld, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

type Tile = MapDocument['classicStructure']['tiles'][number];
const t = (id: string, tile: string, x: number, y: number, z = 0, rotation: Rotation = 0, extra: Partial<Tile> = {}): Tile => ({ id, tile, x, y, z, rotation, ...extra });

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url)).toString();

describe('Style Pack 10 Medieval Village', () => {
  it('is registered with its theme, demo map and 25–40 pieces of its own', () => {
    const pack = getStylePack('medieval')!;
    expect(pack).toMatchObject({ number: '10', displayName: 'Medieval Village', demo: 'market_town' });
    expect(pack.themes[0]).toBe('core.medieval');
    expect(coreThemes.get('core.medieval')).toBeDefined();
    const own = pack.props.filter((p) => getProp(p)?.category === 'Medieval Village').length + pack.tiles.filter((x) => x.startsWith('medieval.')).length;
    expect(own).toBeGreaterThanOrEqual(25);
    expect(own).toBeLessThanOrEqual(40);
    for (const p of pack.props) expect(getProp(p), p).toBeDefined();
    for (const k of pack.gameplay) expect(SCENARIO_PALETTE.some((e) => e.key === k), k).toBe(true);
  });

  it('our own props come from code, licence Owned; the hero stand-ins keep stable ids', () => {
    const manifest = JSON.parse(read('content/props.json')) as { packs: Record<string, { license: string; url: string }>; props: { id: string; pack: string }[] };
    expect(manifest.packs['tiletrigger-medieval']).toMatchObject({ license: 'Owned', url: 'tools/content/prepare-medieval.mjs' });
    const ours = manifest.props.filter((p) => p.id.startsWith('mv_'));
    expect(ours.length).toBeGreaterThanOrEqual(18);
    for (const p of ours) expect(p.pack, p.id).toBe('tiletrigger-medieval');
    // The owner may swap these for community downloads later under the same ids (HANDOFF.md).
    for (const id of ['mv_forge', 'mv_hay_cart', 'mv_well', 'mv_tarp_tent']) expect(ours.some((p) => p.id === id), id).toBe(true);
    expect(read('assets-src/tiletrigger-medieval/License.txt')).toMatch(/no generative AI/);
  });

  it('the oak door and wattle hurdle are palette pieces', () => {
    expect(newScenarioEntities('door:oak', [0, 0, 0], 0)[0]).toMatchObject({ kind: 'door', style: 'oak', auto: true });
    expect(newScenarioEntities('block:wattle', [0, 0, 0], 0)[0]).toMatchObject({ kind: 'block', behaviour: 'breakable', material: 'core.wattle' });
  });
});

describe('Style Pack 10 Medieval Village tiles', () => {
  it('every tile is in the catalog and validates on its own', () => {
    const ids = coreCatalog.all().filter((d) => d.id.startsWith('medieval.')).map((d) => d.id);
    expect(ids.length).toBeGreaterThanOrEqual(15);
    for (const id of ids) {
      const map = makeMap([t('a', id, 0, 0)], [[0, 0, -20]]);
      expect(validateMap(map).filter((i) => i.severity === 'error'), id).toEqual([]);
    }
  });

  it('houses keep their own stone, half-timbering and red roof tiles in any theme', () => {
    const boxes = buildMapGeometry(makeMap([t('a', 'medieval.house', 0, 0)]));
    const mats = new Set(boxes.filter((b) => b.sourceId === 'a').map((b) => b.surface?.material));
    for (const m of ['core.timber_frame', 'core.roof_tiles_red', 'core.pbr_castle_stone']) expect(mats.has(m), m).toBe(true);
  });

  it('the half-timbered and whitewash facades dress outside walls and leave the doorway clear', () => {
    for (const [facade, skin] of [['timber_frame', 'core.timber_frame'], ['village_plaster', 'core.whitewash']] as const) {
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

describe('Medieval pack navigation', () => {
  // Not here: the Bell Tower's belfry. Players climb it (steps of 0.25 m); the navmesh drops its stacked
  // switchback inside walls (a Recast region-building case), so bots stay below (HANDOFF.md).
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
    { name: 'house upper floor', tiles: [t('m', 'medieval.house', 0, 0), ...yards(-1, -1, 2, 1, [[0, 0], [1, 0]])], from: [0, 0, -6], to: [8, 4, -1.5] },
    { name: 'shop house upper floor', tiles: [t('m', 'medieval.house_shop', 0, 0), ...yards(-1, -1, 2, 1, [[0, 0], [1, 0]])], from: [0, 0, -6], to: [2, 4, -1.5] },
    { name: 'plaster house balcony', tiles: [t('m', 'medieval.house_balcony', 0, 0), ...yards(-1, -1, 2, 1, [[0, 0], [1, 0]])], from: [0, 0, -6], to: [8, 4, -2.5] },
    { name: 'roof by the outside stair', tiles: [t('m', 'medieval.house', 0, 0), t('s', 'medieval.outside_stair', 0, 1), ...yards(-1, -1, 2, 2, [[0, 0], [1, 0], [0, 1]])], from: [0, 0, -6], to: [4, 9.6, 2] },
    { name: 'next house through the upper doors', tiles: [t('m', 'medieval.house', 0, 0), t('n', 'medieval.house', 2, 0), ...yards(-1, -1, 4, 1, [[0, 0], [1, 0], [2, 0], [3, 0]])], from: [0, 4, -1.5], to: [20, 4, -1.5] },
    { name: 'walkway between houses', tiles: [t('m', 'medieval.house', 0, 0), t('w', 'medieval.walkway', 2, 0, 0, 1), t('n', 'medieval.house', 3, 0), ...yards(-1, -1, 5, 1, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]])], from: [0, 0, -6], to: [28, 4, -1.5] },
    { name: 'market hall upper floor', tiles: [t('m', 'medieval.market_hall', 0, 0), ...yards(-1, -1, 1, 2, [[0, 0], [0, 1]])], from: [0, 0, -6], to: [-1, 4, 8] },
    { name: 'town gate guard room', tiles: [t('m', 'medieval.town_gate', 0, 0), t('s', 'medieval.wall_stair', -2, 0), ...yards(-3, -1, 3, 1, [[0, 0], [1, 0], [2, 0], [-2, 0], [-1, 0]])], from: [8, 0, 6], to: [8, 4, 0] },
    { name: 'town wall walk from a wall stair', tiles: [t('m', 'medieval.wall_stair', 0, 0), t('n', 'medieval.town_wall', 2, 0), ...yards(-1, -1, 3, 1, [[0, 0], [1, 0], [2, 0]])], from: [0, 0, 6], to: [18, 4, -2] },
    { name: 'watchtower lookout', tiles: [t('m', 'medieval.watchtower', 0, 0), ...yards(-1, -1, 1, 1, [[0, 0]])], from: [0, 0, -6], to: [0, 7, -2.6] },
    { name: 'stone bridge over the stream', tiles: [t('m', 'medieval.bridge', 0, 0), t('a', 'medieval.stream', -1, 0), t('b', 'medieval.stream', 1, 0), ...yards(-1, -1, 1, -1, []), ...yards(-1, 1, 1, 1, [])], from: [0, 0, -6], to: [0, 0, 6] },
    { name: 'stream bed under the bridge and up the bank', tiles: [t('m', 'medieval.bridge', 0, 0), t('a', 'medieval.stream', -1, 0), t('b', 'medieval.stream', 1, 0), ...yards(-1, -1, 1, -1, []), ...yards(-1, 1, 1, 1, [])], from: [-8, -2, -1], to: [8, 0, 6] },
    { name: 'forge hearth', tiles: [t('m', 'medieval.forge', 0, 0), ...yards(-1, -1, 1, 1, [[0, 0]])], from: [0, 0, -6], to: [0, 0, 0.8] },
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
