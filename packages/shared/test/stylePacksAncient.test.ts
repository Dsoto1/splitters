import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  MODEL_FACADES,
  SCENARIO_PALETTE,
  blockBoxes,
  buildFacades,
  buildMapDecor,
  buildMapGeometry,
  coreCatalog,
  coreThemes,
  getProp,
  getStylePack,
  initPhysics,
  liftLinks,
  loadMap,
  mapPortals,
  mapTerrainMesh,
  navLinks,
  newScenarioEntities,
  PhysicsWorld,
  propBoxes,
  validateMap,
  type MapDocument,
  type MapEntity,
  type Rotation,
} from '../src/index.ts';
import { NavWorld, initNavigation, validateNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url)).toString();
type Tile = MapDocument['classicStructure']['tiles'][number];
const t = (id: string, tile: string, x: number, y: number, z = 0, rotation: Rotation = 0, extra: Partial<Tile> = {}): Tile => ({ id, tile, x, y, z, rotation, ...extra });

describe('Style Packs 03 Imperial Arena and 09 Sands of Egypt', () => {
  it('Sands of Egypt lives on inside 09 Desert City (which replaced it): its 26 pieces stay defined and listed', () => {
    expect(getStylePack('egypt')).toBeUndefined();
    const pack = getStylePack('desert')!;
    const egypt = [...pack.tiles.filter((x) => x.startsWith('egypt.')), ...pack.props.filter((p) => getProp(p)?.category === 'Sands of Egypt')];
    expect(egypt.length).toBe(26);
    expect(pack.themes).toContain('core.egypt');
    expect(pack.gameplay).toContain('portal');
  });

  it.each([['imperial', '03', 'Imperial Arena', 'core.imperial', 'sandfall_colosseum']])('%s is registered with its theme, demo map and 25–40 pieces of its own', (id, number, name, theme, demo) => {
    const pack = getStylePack(id)!;
    expect(pack).toBeDefined();
    expect(pack.number).toBe(number);
    expect(pack.displayName).toBe(name);
    expect(pack.themes[0]).toBe(theme);
    expect(coreThemes.get(theme)).toBeDefined();
    expect(pack.demo).toBe(demo);
    const own = pack.props.filter((p) => getProp(p)?.category === name).length + pack.tiles.filter((x) => x.startsWith(`${id}.`)).length;
    expect(own).toBeGreaterThanOrEqual(25);
    expect(own).toBeLessThanOrEqual(40);
    for (const k of pack.gameplay) expect(SCENARIO_PALETTE.some((e) => e.key === k), k).toBe(true);
    expect(pack.gameplay).toContain('portal');
  });

  it('our own props come from code, licence Owned, never from a generator', () => {
    const manifest = JSON.parse(read('content/props.json')) as { packs: Record<string, { license: string; url: string }>; props: { id: string; pack: string }[] };
    expect(manifest.packs['tiletrigger-ancient']).toMatchObject({ license: 'Owned', url: 'tools/content/prepare-ancient.mjs' });
    const ours = manifest.props.filter((p) => p.id.startsWith('im_') || p.id.startsWith('eg_'));
    expect(ours.length).toBeGreaterThanOrEqual(30);
    for (const p of ours) expect(p.pack, p.id).toBe('tiletrigger-ancient');
    expect(read('assets-src/tiletrigger-ancient/License.txt')).toMatch(/no generative AI/);
  });

  it('the Roman and Egyptian facades dress outside walls in their own stone, painted glyphs included', () => {
    for (const [facade, stone] of [['roman', 'core.pbr_limestone'], ['egyptian', 'core.pbr_sandstone_blocks']] as const) {
      expect(MODEL_FACADES.has(facade)).toBe(false);
      const map = makeMap([t('a', 'core.room', 0, 0, 0, 0, { options: { facade, ceiling: 'roof' }, edges: { '0,0,0:S': 'door' } })]);
      expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
      expect(buildFacades(map)).toEqual([]);
      const dressed = buildMapDecor(map).filter((b) => b.sourceId === 'a' && b.surface);
      expect(dressed.some((b) => b.surface!.material === stone), facade).toBe(true);
      // Nothing in the doorway.
      expect(dressed.filter((b) => b.max[2] < -3.9 && b.min[0] > -1.4 && b.max[0] < 1.4 && b.min[1] < 2.9 && b.max[1] > 0.6), facade).toEqual([]);
    }
    const eg = buildMapDecor(makeMap([t('a', 'core.room', 0, 0, 0, 0, { options: { facade: 'egyptian' } })]));
    expect(eg.some((b) => b.surface?.material === 'core.hieroglyphs_painted')).toBe(true);
  });

  it('tiles keep their stone in any theme', () => {
    const boxes = buildMapGeometry(makeMap([t('a', 'imperial.seating', 0, 0)]));
    expect(new Set(boxes.filter((b) => b.sourceId === 'a').map((b) => b.surface?.material))).toContain('core.pbr_limestone');
    const tomb = buildMapDecor(makeMap([t('a', 'egypt.tomb_corridor', 0, 0)]));
    expect(tomb.some((b) => b.surface?.material === 'core.hieroglyphs_painted')).toBe(true);
  });
});

describe('Ancient pack navigation', () => {
  const turn = (x: number, z: number, r: number): [number, number] => {
    let [a, b] = [x, z];
    for (let i = 0; i < r; i++) [a, b] = [b, -a];
    return [a + 0, b + 0];
  };
  const yard = (x: number, y: number) => t(`y${x}_${y}`.replace(/-/g, 'm'), 'core.yard', x, y);
  /** Open ground on every free cell of a box round the pieces (so their edges lead somewhere, as in a map). */
  const yards = (x0: number, y0: number, x1: number, y1: number, taken: readonly (readonly [number, number])[]): Tile[] => {
    const out: Tile[] = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (!taken.some(([a, b]) => a === x && b === y)) out.push(yard(x, y));
    return out;
  };
  const cases: { name: string; tiles: Tile[]; from: [number, number, number]; to: [number, number, number] }[] = [
    { name: 'seating (podium walkway to the top walkway)', tiles: [t('m', 'imperial.seating', 0, 0)], from: [0, 2, -2.8], to: [0, 4, 3.5] },
    { name: 'arcade stair', tiles: [t('m', 'imperial.arcade_stair', 0, 0), t('n', 'imperial.arcade', 1, 0), ...yards(-1, -1, 2, 1, [[0, 0], [1, 0]])], from: [-2, 0, -2], to: [8, 4, -2] },
    { name: "emperor's box", tiles: [t('m', 'imperial.emperor_box', 0, 0)], from: [0, 4, 3.5], to: [1.5, 3, -2.5] },
    { name: 'gladiator gate passage', tiles: [t('m', 'imperial.gate', 0, 0), yard(0, -1), yard(0, 1)], from: [0, 0, -6], to: [0, 0, 6] },
    { name: 'temple cella', tiles: [t('m', 'imperial.temple', 0, 0), ...yards(-1, -1, 1, 2, [[0, 0], [0, 1]])], from: [0, 0, -6], to: [0, 2, 7] },
    { name: 'forum rostrum', tiles: [t('m', 'imperial.forum', 0, 0)], from: [4, 0, -2], to: [4, 1.5, 5.4] },
    { name: 'hypogeum round a lift cage shaft', tiles: [t('m', 'imperial.hypogeum_lift', 0, 0), t('n', 'imperial.hypogeum', 1, 0), t('o', 'imperial.tunnel', 2, 0, 0, 1)], from: [-2.5, 0, 0], to: [18, 0, 0] },
    { name: 'pylon terrace', tiles: [t('m', 'egypt.pylon', 0, 0), ...yards(-1, -1, 3, 1, [[0, 0], [1, 0], [2, 0]])], from: [-2, 0, 6], to: [2, 4, 0] },
    { name: 'step pyramid platform', tiles: [t('m', 'egypt.pyramid', 0, 0), yard(1, 4), yard(2, 4)], from: [12, 0, 30], to: [8, 10, 10] },
    { name: 'tomb (down from the mastaba to the burial chamber)', tiles: [t('m', 'egypt.tomb_entrance', 0, 0, -1), t('n', 'egypt.tomb_corridor', 0, 1, -1), t('o', 'egypt.tomb_chamber', 0, 2, -1), yard(0, -1), yard(0, 1), yard(0, 2)], from: [0, 0, -6], to: [2.5, -4, 15] },
    { name: 'house roof terrace', tiles: [t('m', 'egypt.house', 0, 0), ...yards(-1, -1, 1, 1, [[0, 0]])], from: [0, 0, -6], to: [-1.5, 3, 0] },
    { name: 'quay down to the river bed', tiles: [t('m', 'egypt.quay', 0, 0), t('n', 'egypt.river', 0, 1), yard(0, -1)], from: [0, 0, -6], to: [0, -2.5, 8] },
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

describe('Imperial Arena gameplay pieces', () => {
  const place = (key: (typeof SCENARIO_PALETTE)[number]['key'], at: [number, number, number] = [0, 0, 0], yaw = 0): MapEntity[] => newScenarioEntities(key, at, yaw);

  it('the portcullis is a door look; the portcullis gate and the lift cage are movers that validate', () => {
    expect(place('door:portcullis')[0]).toMatchObject({ kind: 'door', style: 'portcullis', auto: false });
    expect(place('light:brazier')[0]).toMatchObject({ kind: 'light', fixture: 'bulb' });
    const gate = place('mover:portcullis');
    expect(gate.find((e) => e.kind === 'mover')).toMatchObject({ mode: 'trigger' });
    // A lift cage on the hypogeum floor (level -1) under an arena hatch: a lift bots ride, its hatch flush with the sand while down.
    const cage = place('mover:cage', [0, -4, 0]);
    const mover = cage.find((e) => e.kind === 'mover')!;
    const blocks = cage.filter((e) => e.kind === 'block') as Extract<MapEntity, { kind: 'block' }>[];
    expect(mover).toMatchObject({ mode: 'pingpong', points: [[0, 0, 0], [0, 4, 0]] });
    const hatch = blocks.find((b) => b.name === 'Hatch')!;
    expect(hatch.position[1] + hatch.size[1]).toBeCloseTo(0, 5);
    const map: MapDocument = { ...makeMap([t('h', 'imperial.hypogeum_lift', 0, 0, -1), t('a', 'imperial.arena_hatch', 0, 0)], [[3, 0, 3]]), entities: [{ id: 'spawn_0', kind: 'spawn', position: [3, 0, 3], yaw: 0, faction: null }, ...cage] };
    expect(validateMap(map).filter((i) => i.severity === 'error' || i.code.startsWith('mover'))).toEqual([]);
    expect(liftLinks(map)).toHaveLength(2);
    expect(blockBoxes(map, true).length).toBe(5);
  });
});

describe('Ancient pack demo maps', () => {
  const load = (id: string): MapDocument => {
    const r = loadMap(read(`maps/${id}.json`));
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.issues).toEqual([]);
    return r.map;
  };

  it.each(['sandfall_colosseum', 'pharaohs_reach'])('%s validates with no errors or warnings', { timeout: 180_000 }, (id) => {
    const map = load(id);
    const geometry = buildMapGeometry(map);
    const physics = new PhysicsWorld(geometry, mapTerrainMesh(map));
    const nav = NavWorld.build([...geometry, ...propBoxes(map, true), ...blockBoxes(map, true)], mapTerrainMesh(map), [...navLinks(map.entities, physics), ...liftLinks(map)]);
    physics.free();
    expect(validateNavigation(map, nav)).toEqual([]);
    nav.destroy();
  });

  it('Sandfall Colosseum has its arena, gates, lift cages, beast lift, traps and the hypogeum portal', () => {
    const map = load('sandfall_colosseum');
    expect(map.classicStructure.theme).toBe('core.imperial');
    const tiles = new Set(map.classicStructure.tiles.map((x) => x.tile));
    for (const id of ['imperial.seating', 'imperial.seating_corner', 'imperial.gate', 'imperial.emperor_box', 'imperial.arena_hatch', 'imperial.arcade', 'imperial.arcade_stair', 'imperial.hypogeum', 'imperial.hypogeum_lift', 'imperial.tunnel', 'imperial.forum', 'imperial.temple', 'imperial.triumphal_arch', 'imperial.aqueduct', 'imperial.colonnade']) expect(tiles.has(id), id).toBe(true);
    expect(map.entities.filter((e) => e.kind === 'door' && e.style === 'portcullis')).toHaveLength(3);
    expect(liftLinks(map).length).toBe(4);
    expect(map.entities.some((e) => e.kind === 'block' && e.behaviour === 'trapdoor' && e.trigger === 'logic')).toBe(true);
    expect(map.entities.filter((e) => e.kind === 'trap' && e.trap === 'spikes').length).toBeGreaterThanOrEqual(4);
    const portals = mapPortals(map.entities);
    expect(portals.map((p) => p.link)).toEqual([1, 0]);
    expect(portals[0]!.pos.y).toBe(-4);
    expect(map.logic.rules.find((r) => r.id === 'rule_seal')!.do.some((a) => a.type === 'disable' && a.target === 'portal_hypogeum')).toBe(true);
  });

  it("Pharaoh's Reach has its temple, pyramid, tomb with traps and the curse, the river and its boats, and the tomb portal", () => {
    const map = load('pharaohs_reach');
    expect(map.classicStructure.theme).toBe('core.egypt');
    const tiles = new Set(map.classicStructure.tiles.map((x) => x.tile));
    for (const id of ['egypt.pylon', 'egypt.hypostyle', 'egypt.sanctuary', 'egypt.pyramid', 'egypt.tomb_entrance', 'egypt.tomb_corridor', 'egypt.tomb_chamber', 'egypt.quay', 'egypt.river', 'egypt.avenue', 'egypt.house']) expect(tiles.has(id), id).toBe(true);
    expect(map.entities.some((e) => e.kind === 'water')).toBe(true);
    expect(map.entities.filter((e) => e.kind === 'mover' && e.props?.length).length).toBe(2);
    expect(map.entities.filter((e) => e.kind === 'trap' && e.position[1] < -3).length).toBeGreaterThanOrEqual(5);
    for (const prop of ['prop.eg_obelisk', 'prop.eg_sphinx', 'prop.eg_statue_pharaoh', 'prop.eg_sarcophagus', 'prop.eg_felucca', 'prop.eg_palm']) expect(map.entities.some((e) => e.kind === 'prop' && e.model === prop), prop).toBe(true);
    const portals = mapPortals(map.entities);
    expect(portals).toHaveLength(2);
    expect(portals.map((p) => p.pos.y).sort((a, b) => a - b)).toEqual([-4, 10]);
    const curse = map.logic.rules.find((r) => r.id === 'rule_curse')!;
    expect(curse.when).toEqual({ event: 'zone_enter', target: 'zone_curse' });
    expect(curse.do.filter((a) => a.type === 'disable').map((a) => a.target).sort()).toEqual(['portal_pyramid', 'portal_tomb']);
  });
});

describe('every ancient tile is in the catalog', () => {
  it('lists the tiles under their packs', () => {
    for (const id of [...getStylePack('imperial')!.tiles, ...getStylePack('desert')!.tiles]) expect(coreCatalog.get(id), id).toBeDefined();
  });
});
