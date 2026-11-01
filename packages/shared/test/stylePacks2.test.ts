/**
 * Style Packs 05 Gothic Estate, 06 Jungle Ruins and 08 Suburban Chaos: the
 * registry entries, their own tiles, facades and gameplay pieces, and the
 * demo maps (Ravenscroft Hall, Verdant Ziggurat, Cedar Lane).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CORE_PROPS,
  MODEL_FACADES,
  Movers,
  ROOM_TYPES,
  SCENARIO_PALETTE,
  STYLE_PACKS,
  blockBoxes,
  buildFacades,
  buildMapDecor,
  buildMapGeometry,
  coreCatalog,
  dressRoom,
  dressSpace,
  getProp,
  initPhysics,
  liftLinks,
  loadMap,
  mapTerrainMesh,
  navLinks,
  newScenarioEntities,
  PhysicsWorld,
  propBoxes,
  recipeModels,
  validateMap,
  type MapDocument,
  type MapEntity,
  type Rotation,
} from '../src/index.ts';
import { NavWorld, initNavigation, validateNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const load = (id: string): MapDocument => {
  const r = loadMap(readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8'));
  if (!r.ok) throw new Error(`${id}: ${JSON.stringify(r.issues)}`);
  return r.map;
};
type Tile = MapDocument['classicStructure']['tiles'][number];
const t = (id: string, tile: string, x: number, y: number, z = 0, rotation: Rotation = 0, extra: Partial<Tile> = {}): Tile => ({ id, tile, x, y, z, rotation, ...extra });
const PACKS = { gothic: 'Gothic Estate', jungle: 'Jungle Ruins', suburban: 'Suburban Chaos' } as const;

describe('Style Packs 05, 06 and 08', () => {
  it.each(Object.entries(PACKS))('%s is registered with 25–40 pieces of its own', (id, name) => {
    const pack = STYLE_PACKS.find((p) => p.id === id)!;
    expect(pack.displayName).toBe(name);
    const own = pack.props.filter((p) => getProp(p)!.category === name).length + pack.tiles.filter((x) => x.startsWith(`${id}.`)).length;
    expect(own).toBeGreaterThanOrEqual(25);
    // Jungle Ruins grew in its refresh from the owner's sheets (stylePacksJungle.test.ts).
    expect(own).toBeLessThanOrEqual(id === 'jungle' ? 80 : 40);
    // Its own props come first and are all ours (modelled in code).
    for (const p of pack.props.filter((x) => getProp(x)!.category === name)) expect(CORE_PROPS.find((d) => d.id === p)?.file, p).toMatch(/^props\/(ge|jg|jt|sb)_/);
    for (const f of pack.facades) expect(MODEL_FACADES.has(f)).toBe(false);
  });

  it('appliances break, and the gas ones go off', () => {
    for (const id of ['prop.sb_microwave', 'prop.sb_bbq_grill', 'prop.sb_propane_tank', 'prop.sb_gas_pump', 'prop.sb_lawnmower', 'prop.sb_sedan']) expect(CORE_PROPS.find((p) => p.id === id)?.breakable?.blast, id).toBeDefined();
    for (const id of ['prop.sb_fridge', 'prop.sb_washing_machine', 'prop.sb_tv_flat', 'prop.sb_picket_fence']) expect(CORE_PROPS.find((p) => p.id === id)?.breakable, id).toBeDefined();
  });

  it('the new facades dress outside walls with boxes and leave openings open', () => {
    for (const facade of ['gothic_stone', 'manor_brick', 'temple', 'overgrown', 'clapboard', 'suburban_brick'] as const) {
      const map = makeMap([t('a', 'core.room', 0, 0, 0, 0, { options: { facade, ceiling: 'roof' }, edges: { '0,0,0:S': 'door', '0,0,0:W': 'window' } }), t('b', 'core.room', 1, 0)]);
      expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
      expect(buildFacades(map)).toEqual([]);
      const dressed = buildMapDecor(map).filter((b) => b.sourceId === 'a' && b.surface);
      expect(dressed.length, facade).toBeGreaterThan(3);
      // Nothing on the side shared with the next room, nothing in the doorway.
      expect(dressed.filter((b) => b.min[0] > 3.9 && b.max[0] < 4.6 && b.max[1] < 3.9 && b.min[2] > -3.5 && b.max[2] < 3.5), facade).toEqual([]);
      expect(dressed.filter((b) => b.max[2] < -3.9 && b.min[0] > -1.4 && b.max[0] < 1.4 && b.min[1] < 2.9 && b.max[1] > 0.2), facade).toEqual([]);
    }
  });

  it('dresses parlours, crypts, conservatories and shrines from the pack props', () => {
    for (const type of ['parlour', 'crypt', 'conservatory', 'shrine'] as const) expect(ROOM_TYPES).toContain(type);
    expect(recipeModels('parlour')).toContain('prop.ge_wingback_chair');
    expect(recipeModels('shrine')).toContain('prop.jg_altar_stone');
    const map = makeMap([t('r', 'core.room_large', 0, 0)]);
    const space = dressSpace(map, [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]]);
    for (const type of ['parlour', 'crypt', 'conservatory', 'shrine'] as const) expect(dressRoom(space, type, { seed: 3 }).length, type).toBeGreaterThanOrEqual(3);
  });

  it('pitched roofs are tilted boxes that turn with their tile', () => {
    for (const r of [0, 1, 2, 3] as const) {
      const map = makeMap([t('h', 'suburban.house', 0, 0, 0, r)]);
      const roof = buildMapGeometry(map).filter((b) => b.sourceId === 'h' && b.pitch);
      expect(roof.length, `r${r}`).toBe(2);
      expect(roof.every((b) => Math.abs(Math.abs(b.pitch!) - 0.5) < 1e-9)).toBe(true);
    }
  });
});

describe('Style Pack 05/06/08 navigation', () => {
  const turn = (x: number, z: number, r: number): [number, number] => {
    let [a, b] = [x, z];
    for (let i = 0; i < r; i++) [a, b] = [b, -a];
    return [a + 0, b + 0];
  };
  const cases: { name: string; tiles: Tile[]; from: [number, number, number]; to: [number, number, number] }[] = [
    { name: 'library gallery', tiles: [t('m', 'gothic.library', 0, 0), t('a', 'core.yard', 0, -1), t('b', 'core.yard', 1, -1)], from: [4, 0, -6], to: [-2, 4, 6] },
    { name: 'mausoleum tomb', tiles: [t('m', 'gothic.mausoleum', 0, 0)], from: [0, 0, -3.5], to: [0, 0.25, 0.6] },
    { name: 'stepped temple shrine', tiles: [t('m', 'jungle.ziggurat', 0, 0), t('a', 'core.yard', 1, -1)], from: [8, 0, -6], to: [4, 6, 5] },
    { name: 'giant tree lookout', tiles: [t('m', 'jungle.giant_tree', 0, 0), t('a', 'core.yard', 0, -1)], from: [0, 0, -6], to: [-2.6, 7.5, 2.6] },
    { name: 'house upstairs', tiles: [t('m', 'suburban.house', 0, 0), t('a', 'core.yard', 0, -1)], from: [1, 0, -6], to: [-0.5, 4, 0.2] },
    { name: 'pool deep end', tiles: [t('m', 'suburban.pool', 0, 0)], from: [-3.2, 0, -3.2], to: [0, -1.8, 8] },
    { name: 'rock stair', tiles: [t('m', 'jungle.cliff_ramp', 0, 0), t('a', 'core.yard', -1, 0), t('b', 'core.platform', 1, 0, 1)], from: [-6, 0, 0], to: [8, 4, 0] },
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

describe('Style Pack 05/06/08 gameplay pieces', () => {
  const place = (key: (typeof SCENARIO_PALETTE)[number]['key'], yaw = 0): MapEntity[] => newScenarioEntities(key, [0, 0, 0], yaw);
  const withSpawn = (entities: MapEntity[], tiles: Tile[] = [t('y', 'core.platform', 0, 0), t('y2', 'core.platform', 0, 1), t('y3', 'core.platform', 0, -1)]): MapDocument => ({ ...makeMap(tiles, []), entities: [{ id: 'spawn_0', kind: 'spawn', position: [2, 0, -3], yaw: 0, faction: null }, ...entities] });

  it('every new palette entry places entities that validate', () => {
    for (const key of ['mover:bookcase', 'mover:shelf', 'block:rotten', 'light:candle', 'light:chandelier', 'block:rope_bridge', 'block:old_planks', 'ladder:vines', 'trap:rockfall', 'mover:garage_door', 'block:fence', 'block:roof', 'water:pool'] as const) {
      expect(SCENARIO_PALETTE.some((e) => e.key === key), key).toBe(true);
      const placed = place(key, Math.PI / 2);
      expect(placed.length, key).toBeGreaterThan(0);
      expect(validateMap(withSpawn(placed)).filter((i) => i.severity === 'error'), key).toEqual([]);
    }
  });

  it('the secret bookcase is a logic-sent mover carrying a walk-through bookcase; the moving one runs by itself', () => {
    const secret = place('mover:bookcase');
    const m = secret.find((e) => e.kind === 'mover')!;
    expect(m).toMatchObject({ kind: 'mover', mode: 'trigger' });
    expect(m.kind === 'mover' && m.props?.length).toBe(1);
    expect(secret.find((e) => e.kind === 'prop')).toMatchObject({ model: 'prop.ge_bookcase_tall', solid: false });
    expect(place('mover:shelf').find((e) => e.kind === 'mover')).toMatchObject({ mode: 'pingpong', startActive: true });
  });

  it('rotten floors and old planks crumble, fences break, candles are candle fixtures, vines are a ladder, falling rocks a crusher', () => {
    expect(place('block:rotten')[0]).toMatchObject({ kind: 'block', behaviour: 'crumble', material: 'core.pbr_floorboards' });
    expect(place('block:old_planks')[0]).toMatchObject({ kind: 'block', behaviour: 'crumble' });
    expect(place('block:fence')[0]).toMatchObject({ kind: 'block', behaviour: 'breakable' });
    expect(place('light:candle')[0]).toMatchObject({ kind: 'light', fixture: 'candle' });
    expect(place('light:chandelier')[0]).toMatchObject({ kind: 'light', fixture: 'chandelier' });
    expect(place('ladder:vines')[0]).toMatchObject({ kind: 'ladder', style: 'vines' });
    expect(place('trap:rockfall')[0]).toMatchObject({ kind: 'trap', trap: 'crusher', style: 'rockfall', activation: 'proximity' });
    expect(place('water:pool')[0]).toMatchObject({ kind: 'water', liquid: 'water' });
  });

  it('a rope bridge sags between its anchors with the middle planks rotten, every step walkable', () => {
    const placed = place('block:rope_bridge');
    const planks = placed.filter((e): e is Extract<MapEntity, { kind: 'block' }> => e.kind === 'block');
    expect(planks.length).toBe(8);
    expect(planks.filter((p) => p.behaviour === 'crumble').length).toBe(2);
    const tops = planks.map((p) => p.position[1] + p.size[1]);
    expect(Math.min(...tops)).toBeLessThan(-0.4);
    for (let i = 1; i < tops.length; i++) expect(Math.abs(tops[i]! - tops[i - 1]!)).toBeLessThan(0.3);
    expect(placed.filter((e) => e.kind === 'prop' && !e.solid).length).toBe(2);
  });

  it('a garage door swings up level, hinged at the top of its opening', () => {
    const placed = place('mover:garage_door');
    const movers = new Movers({ ...makeMap([]), entities: placed });
    const closed = [...movers.transforms(0)][0]!;
    expect(closed.center.y).toBeCloseTo(1.4, 2);
    movers.legs[0] = { from: 0, to: 1, start: 0 };
    const open = [...movers.transforms(600)][0]!;
    // Up at the hinge (2.8 m) and swung in (local -Z, behind the door), lying flat.
    expect(Math.abs(open.center.y - 2.8)).toBeLessThan(0.15);
    expect(open.center.z).toBeLessThan(-1.2);
  });

  it('a pitched roof is two slate slabs meeting at a ridge', () => {
    const roof = place('block:roof').filter((e): e is Extract<MapEntity, { kind: 'block' }> => e.kind === 'block');
    expect(roof.length).toBe(2);
    expect(roof.map((b) => Math.sign(b.pitch ?? 0)).sort()).toEqual([-1, 1]);
    expect(blockBoxes(withSpawn(roof)).length).toBe(2);
  });
});

describe('Style Pack 05/06/08 demo maps', () => {
  it.each([
    ['ravenscroft_hall', 'core.gothic_estate'],
    ['verdant_ziggurat', 'core.jungle_temple'],
    ['cedar_lane', 'core.suburban'],
  ])('%s validates with no errors or warnings, and every spawn and pickup is reachable', { timeout: 180_000 }, (id, theme) => {
    const map = load(id);
    expect(map.classicStructure.theme).toBe(theme);
    expect(validateMap(map).filter((i) => i.severity !== 'suggestion')).toEqual([]);
    const geometry = buildMapGeometry(map);
    const physics = new PhysicsWorld(geometry, mapTerrainMesh(map));
    const nav = NavWorld.build([...geometry, ...propBoxes(map, true), ...blockBoxes(map, true)], mapTerrainMesh(map), [...navLinks(map.entities, physics), ...liftLinks(map)]);
    expect(validateNavigation(map, nav).filter((i) => i.severity !== 'suggestion')).toEqual([]);
    nav.destroy();
    physics.free();
  });

  it('the demo maps show their packs off', () => {
    const tilesOf = (m: MapDocument) => m.classicStructure.tiles.map((x) => x.tile);
    const hall = load('ravenscroft_hall');
    expect(tilesOf(hall)).toEqual(expect.arrayContaining(['gothic.library', 'gothic.crypt', 'gothic.mausoleum', 'gothic.cemetery', 'gothic.hedge_maze']));
    expect(hall.entities.some((e) => e.kind === 'mover' && e.mode === 'trigger' && e.props?.length)).toBe(true);
    expect(hall.entities.some((e) => e.kind === 'block' && e.behaviour === 'crumble')).toBe(true);
    expect(hall.entities.filter((e) => e.kind === 'light' && (e.fixture === 'candle' || e.fixture === 'chandelier')).length).toBeGreaterThanOrEqual(4);
    expect(hall.logic.rules.some((r) => r.do.some((a) => a.type === 'light_blink'))).toBe(true);
    const zig = load('verdant_ziggurat');
    expect(tilesOf(zig)).toEqual(expect.arrayContaining(['jungle.ziggurat', 'jungle.giant_tree', 'jungle.waterfall_basin', 'jungle.cave']));
    expect(zig.entities.some((e) => e.kind === 'ladder' && e.style === 'vines')).toBe(true);
    expect(zig.entities.some((e) => e.kind === 'trap' && e.style === 'rockfall')).toBe(true);
    expect(zig.entities.filter((e) => e.kind === 'block' && e.behaviour === 'crumble').length).toBeGreaterThanOrEqual(2);
    const lane = load('cedar_lane');
    expect(tilesOf(lane)).toEqual(expect.arrayContaining(['suburban.house', 'suburban.garage', 'suburban.pool', 'suburban.store', 'suburban.gas_station', 'suburban.playground']));
    expect(lane.entities.some((e) => e.kind === 'mover' && e.angles?.some((a) => a !== 0))).toBe(true);
    expect(lane.entities.some((e) => e.kind === 'block' && e.behaviour === 'breakable')).toBe(true);
    expect(lane.entities.some((e) => e.kind === 'prop' && e.model === 'prop.sb_bbq_grill')).toBe(true);
    expect(lane.entities.some((e) => e.kind === 'water')).toBe(true);
    for (const m of [hall, zig, lane]) for (const tile of m.classicStructure.tiles) expect(coreCatalog.get(tile.tile), tile.tile).toBeDefined();
  });
});
