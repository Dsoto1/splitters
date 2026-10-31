import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  FACADE_FILES,
  MODEL_FACADES,
  CORE_ITEMS,
  CORE_PROPS,
  MOUNT_MODELS,
  Movers,
  SCENARIO_PALETTE,
  STYLE_PACKS,
  THROWABLE_DEFS,
  blockBoxes,
  buildFacades,
  buildMapDecor,
  buildMapGeometry,
  coreCatalog,
  coreMaterials,
  coreThemes,
  getItem,
  getProp,
  initPhysics,
  liftLinks,
  loadMap,
  mapGravityZones,
  mapTerrainMesh,
  navLinks,
  newScenarioEntities,
  PhysicsWorld,
  propBoxes,
  stylePackHas,
  tileModels,
  validateMap,
  type MapDocument,
  type MapEntity,
  type Rotation,
  raceTrack,
} from '../src/index.ts';
import { NavWorld, initNavigation, validateNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const PUBLIC = new URL('../../client/public/', import.meta.url);
/** Node names in a GLB's JSON chunk. */
function glbNodes(file: string): string[] {
  const buf = readFileSync(new URL(file, PUBLIC));
  const len = buf.readUInt32LE(12);
  return (JSON.parse(buf.subarray(20, 20 + len).toString('utf8')).nodes as { name?: string }[]).map((n) => n.name ?? '');
}
const load = (id: string): MapDocument => {
  const r = loadMap(readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8'));
  if (!r.ok) throw new Error(`${id}: ${JSON.stringify(r.issues)}`);
  return r.map;
};

describe('style packs', () => {
  it('04 Orbital Station and 07 Neon Megacity are registered with their themes', () => {
    expect(STYLE_PACKS.map((p) => `${p.number} ${p.displayName}`)).toEqual(expect.arrayContaining(['04 Orbital Station', '07 Neon Megacity']));
    for (const p of STYLE_PACKS) expect(coreThemes.get(p.themes[0]!), p.themes[0]).toBeTruthy();
  });

  it.each(STYLE_PACKS.map((p) => [p.id, p] as const))('%s: every tile, prop and gameplay piece resolves, and its files ship', (_id, pack) => {
    for (const id of pack.tiles) {
      const def = coreCatalog.get(id);
      expect(def, id).toBeTruthy();
      if (def?.model) expect(existsSync(new URL(def.model.file, PUBLIC)), def.model.file).toBe(true);
    }
    for (const id of pack.props) {
      const def = getProp(id);
      expect(def, id).toBeTruthy();
      expect(existsSync(new URL(def!.file, PUBLIC)), def!.file).toBe(true);
    }
    for (const k of pack.gameplay) expect(SCENARIO_PALETTE.some((e) => e.key === k), k).toBe(true);
    for (const k of Object.keys(pack.gameplayNotes ?? {})) expect(pack.gameplay, k).toContain(k);
  });

  it.each(STYLE_PACKS.filter((p) => p.id === 'orbital' || p.id === 'neon').map((p) => [p.id, p] as const))('%s has 25–40 pieces of its own', (_id, pack) => {
    // The pack's tiles (`<pack>.*`) and the props in its palette category.
    const own = pack.props.filter((id) => getProp(id)!.category === pack.displayName).length + pack.tiles.filter((id) => id.startsWith(`${pack.id}.`)).length;
    expect(own, `${pack.displayName}: own pieces`).toBeGreaterThanOrEqual(25);
    expect(own, `${pack.displayName}: own pieces`).toBeLessThanOrEqual(40);
  });

  it('ships every facade piece the style pack facades ask for, in their own files', () => {
    for (const [file, pieces] of Object.entries(FACADE_FILES)) {
      const nodes = glbNodes(file);
      for (const p of pieces) expect(nodes, `${file}: ${p}`).toContain(p);
    }
  });

  it('dresses rooms with the station hull, glass tower and neon block facades from the pack files', () => {
    for (const [facade, file] of [['hull', 'packs/facades_orbital.glb'], ['glass', 'packs/facades_neon.glb'], ['neon', 'packs/facades_neon.glb']] as const) {
      const map = makeMap([{ id: 'r1', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0, options: { facade } }, { id: 'r2', tile: 'core.room', x: 0, y: 0, z: 1, rotation: 0, options: { facade, ceiling: 'roof' } }]);
      expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
      const pieces = buildFacades(map);
      expect(pieces.length, facade).toBeGreaterThan(8);
      expect(pieces.every((p) => p.file === file), facade).toBe(true);
    }
  });

  it('neon towers are solid to their roofs, drawn with their models, nothing walled round them', () => {
    const map = makeMap([{ id: 't1', tile: 'neon.tower_a', x: 0, y: 0, z: 0, rotation: 0 }], [[20, 0, 0]]);
    const boxes = buildMapGeometry(map);
    const top = Math.max(...boxes.filter((b) => b.sourceId === 't1').map((b) => b.max[1]));
    expect(top).toBeCloseTo(31.29, 2);
    expect(tileModels(map)).toEqual([{ id: 't1', file: 'packs/neon_tower_a.glb', at: [4, 0, 4], yaw: 0 }]);
  });
});

describe('style pack demo maps', () => {
  it.each([
    ['halcyon_station', 'core.orbital'],
    ['neon_spire', 'core.neon_megacity'],
  ])('%s validates with no errors or warnings, and every spawn and pickup is reachable', { timeout: 180_000 }, (id, theme) => {
    const map = load(id);
    expect(map.classicStructure.theme).toBe(theme);
    const issues = validateMap(map).filter((i) => i.severity !== 'suggestion');
    expect(issues).toEqual([]);
    const geometry = buildMapGeometry(map);
    const physics = new PhysicsWorld(geometry, mapTerrainMesh(map));
    const nav = NavWorld.build([...geometry, ...propBoxes(map, true), ...blockBoxes(map, true)], mapTerrainMesh(map), [...navLinks(map.entities, physics), ...liftLinks(map)]);
    expect(validateNavigation(map, nav).filter((i) => i.severity !== 'suggestion')).toEqual([]);
    nav.destroy();
    physics.free();
  });

  it('Halcyon Station has its low-gravity reactor, force fields and auto doors', () => {
    const map = load('halcyon_station');
    expect(mapGravityZones(map.entities).map((z) => z.factor).sort()).toEqual([0.25, 0.35]);
    expect(map.entities.filter((e) => e.kind === 'block' && e.field).map((e) => e.id).sort()).toEqual(['field_hangar', 'field_lab']);
    expect(map.entities.filter((e) => e.kind === 'door' && e.auto)).toHaveLength(2);
    expect(map.entities.some((e) => e.kind === 'prop' && e.model === 'prop.os_reactor_core')).toBe(true);
    expect(map.classicStructure.tiles.map((t) => t.tile)).toEqual(expect.arrayContaining(['orbital.hangar', 'orbital.reactor_hall']));
  });

  it('Neon Spire has its elevators, sky tram, skytrain loop and logic-lit signs', () => {
    const map = load('neon_spire');
    const movers = map.entities.filter((e) => e.kind === 'mover');
    expect(movers.map((e) => e.id).sort()).toEqual(['mover_lift_e', 'mover_lift_spire', 'mover_lift_w', 'mover_tram']);
    expect(liftLinks(map).length).toBe(6);
    expect(raceTrack(map)?.ambient).toBe(2);
    const signs = map.entities.filter((e) => e.kind === 'light' && (e.fixture === 'sign' || e.fixture === 'billboard'));
    expect(signs.length).toBeGreaterThanOrEqual(10);
    const blackout = map.logic.rules.find((r) => r.id === 'rule_blackout')!;
    for (const s of signs) expect(blackout.do.some((a) => a.type === 'light_off' && a.target === s.id), s.id).toBe(true);
    expect(map.classicStructure.tiles.map((t) => t.tile)).toEqual(expect.arrayContaining(['neon.tower_a', 'neon.tower_c', 'neon.shop_a']));
  });
});

const root = (p: string) => new URL(`../../../${p}`, import.meta.url);
const read = (p: string) => readFileSync(root(p));
type Tile = MapDocument['classicStructure']['tiles'][number];
const t = (id: string, tile: string, x: number, y: number, z = 0, rotation: Rotation = 0, extra: Partial<Tile> = {}): Tile => ({ id, tile, x, y, z, rotation, ...extra });

describe('Style Packs', () => {
  it('lists Set 1 in order by number, each with 25 or more pieces and its demo map', () => {
    expect(STYLE_PACKS.map((p) => `${p.number} ${p.displayName}`)).toEqual(expect.arrayContaining(['01 Military Compound', '02 Frontier Dust', '03 Imperial Arena', '04 Orbital Station', '05 Gothic Estate', '06 Jungle Ruins', '07 Neon Megacity', '08 Suburban Chaos', '09 Desert City']));
    expect(STYLE_PACKS.map((p) => p.number)).toEqual(STYLE_PACKS.map((p) => p.number).sort());
    expect(new Set(STYLE_PACKS.map((p) => p.id)).size).toBe(STYLE_PACKS.length);
    for (const p of STYLE_PACKS) {
      const own = p.tiles.filter((id) => id.startsWith(`${p.id}.`)).length + p.props.length;
      expect(own, p.id).toBeGreaterThanOrEqual(25);
      expect(p.gameplay.length, p.id).toBeGreaterThanOrEqual(6);
      expect(existsSync(root(`maps/${p.demo}.json`)), p.demo).toBe(true);
    }
  });

  it('every pack piece resolves to a tile, prop, material, theme, palette entry, vehicle or item that ships', () => {
    const keys = new Set<string>(SCENARIO_PALETTE.map((e) => e.key));
    for (const p of STYLE_PACKS) {
      for (const id of p.tiles) expect(coreCatalog.get(id), id).toBeDefined();
      for (const id of p.themes) expect(coreThemes.get(id), id).toBeDefined();
      for (const id of p.materials) expect(coreMaterials.get(id), id).toBeDefined();
      for (const k of p.gameplay) expect(keys.has(k), k).toBe(true);
      for (const m of p.mounts) expect(MOUNT_MODELS).toContain(m);
      for (const i of p.pickups) expect(getItem(i), i).toBeDefined();
      for (const id of p.props) {
        const def = CORE_PROPS.find((d) => d.id === id);
        expect(def, id).toBeDefined();
        expect(existsSync(root(`packages/client/public/${def!.file}`)), def!.file).toBe(true);
      }
      // The palette filter keeps a pack's own pieces and drops the rest.
      expect(stylePackHas(p, `tile:${p.tiles[0]}`)).toBe(true);
      expect(stylePackHas(p, `prop:${p.props[0]}`)).toBe(true);
      expect(stylePackHas(p, `tile:${coreCatalog.all().find((d) => !p.tiles.includes(d.id))!.id}`)).toBe(false);
      expect(stylePackHas(p, `mount:${MOUNT_MODELS.find((m) => !(p.mounts as readonly string[]).includes(m))}`)).toBe(false);
      expect(stylePackHas(p, 'edge:door')).toBe(true);
    }
  });

  it('ships every pack prop and texture exactly as the lock files record (content:check)', () => {
    const props = JSON.parse(read('content/props.lock.json').toString()) as { files: { file: string; sha256: string; source: string }[] };
    const manifest = JSON.parse(read('content/props.json').toString()) as { packs: Record<string, { license: string; licenseFile: string; download?: string }> };
    const files = new Map(props.files.map((f) => [f.file, f]));
    for (const p of STYLE_PACKS) {
      for (const id of p.props) {
        const def = CORE_PROPS.find((d) => d.id === id)!;
        const lock = files.get(def.file);
        expect(lock, def.file).toBeDefined();
        expect(createHash('sha256').update(read(`packages/client/public/${def.file}`)).digest('hex').slice(0, 16), def.file).toBe(lock!.sha256);
        const pack = manifest.packs[lock!.source]!;
        // CC0 kits (downloaded, never committed raw) and our own code-built pieces only.
        expect(['CC0-1.0', 'Owned'], `${id} ${lock!.source}`).toContain(pack.license);
        expect(existsSync(root(pack.licenseFile)), pack.licenseFile).toBe(true);
      }
    }
    // The new Kenney kits stay out of the repo: only their licence is kept.
    for (const kit of ['kenney-retro-urban-kit', 'kenney-city-kit-industrial']) {
      expect(manifest.packs[kit]?.download, kit).toBeTruthy();
      expect(existsSync(root(`assets-src/${kit}/License.txt`))).toBe(true);
      expect(existsSync(root(`assets-src/${kit}/Models`))).toBe(false);
    }
    const textures = JSON.parse(read('content/textures.lock.json').toString()) as { files: { file: string; asset: string; sha256: string }[] };
    for (const p of STYLE_PACKS) {
      for (const id of p.materials) {
        // Procedural materials (station panels, glow trim, neon tube) have no texture to ship.
        const asset = coreMaterials.get(id)!.texture;
        if (!asset) continue;
        const color = textures.files.find((f) => f.asset === asset && f.file.endsWith('_color.jpg'));
        expect(color, asset).toBeDefined();
        expect(createHash('sha256').update(read(`packages/client/public/${color!.file}`)).digest('hex').slice(0, 16)).toBe(color!.sha256);
      }
    }
  });

  it('pack tiles keep their own materials (sandbags, berms, rails) in any theme', () => {
    const boxes = [...buildMapGeometry(makeMap([t('a', 'military.trench', 0, 0)])), ...buildMapDecor(makeMap([t('a', 'military.trench', 0, 0)]))];
    const own = new Set(boxes.filter((b) => b.sourceId === 'a' && b.surface).map((b) => b.surface!.material));
    expect(own).toContain('core.pbr_burlap');
    expect(own).toContain('core.pbr_dusty_road');
    const rail = buildMapDecor(makeMap([t('r', 'frontier.rail_line', 0, 0, 0, 1)])).filter((b) => b.sourceId === 'r' && b.surface?.material === 'core.pbr_steel');
    // Turned a quarter, the rails run east to west.
    expect(rail.length).toBe(2);
    for (const b of rail) expect(b.max[0] - b.min[0]).toBeCloseTo(8, 5);
  });

  it('pack facades dress outside walls with boxes in their own materials and leave openings open', () => {
    for (const facade of ['concrete', 'corrugated', 'false_front', 'adobe'] as const) {
      expect(MODEL_FACADES.has(facade)).toBe(false);
      const map = makeMap([t('a', 'core.room', 0, 0, 0, 0, { options: { facade, ceiling: 'roof' }, edges: { '0,0,0:S': 'door' } }), t('b', 'core.room', 1, 0)]);
      expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
      // Drawn with the level, not by the city kit.
      expect(buildFacades(map)).toEqual([]);
      const dressed = buildMapDecor(map).filter((b) => b.sourceId === 'a' && b.surface);
      expect(dressed.length, facade).toBeGreaterThan(3);
      // Nothing on the side shared with the next room, nothing in the doorway.
      expect(dressed.filter((b) => b.min[0] > 3.9 && b.max[0] < 4.6 && b.max[1] < 3.9 && b.min[2] > -3.5 && b.max[2] < 3.5), facade).toEqual([]);
      expect(dressed.filter((b) => b.max[2] < -3.9 && b.min[0] > -1.4 && b.max[0] < 1.4 && b.min[1] < 2.9 && b.max[1] > 0.2), facade).toEqual([]);
    }
    // The false front rises over the street door; the adobe has its roof beams.
    const ff = buildMapDecor(makeMap([t('a', 'core.room', 0, 0, 0, 0, { options: { facade: 'false_front' }, edges: { '0,0,0:S': 'door' } })])).filter((b) => b.sourceId === 'a' && b.surface);
    expect(Math.max(...ff.map((b) => b.max[1]))).toBeGreaterThan(5.5);
  });
});

describe('Style Pack navigation', () => {
  const turn = (x: number, z: number, r: number): [number, number] => {
    let [a, b] = [x, z];
    for (let i = 0; i < r; i++) [a, b] = [b, -a];
    return [a + 0, b + 0];
  };
  const cases: { name: string; tiles: Tile[]; from: [number, number, number]; to: [number, number, number] }[] = [
    { name: 'guard tower lookout', tiles: [t('m', 'military.guard_tower', 0, 0), t('a', 'core.yard', 1, 0), t('b', 'core.yard', 0, -1), t('c', 'core.yard', -1, 0)], from: [1, 0, -2.5], to: [2, 3, 2] },
    { name: 'catwalk gantry', tiles: [t('m', 'military.gantry', 0, 0), t('a', 'core.yard', 1, 0), t('b', 'core.yard', 0, -1), t('c', 'core.yard', -1, 0)], from: [2, 0, -2.5], to: [0, 4, 10] },
    { name: 'saloon gallery', tiles: [t('m', 'frontier.saloon', 0, 0)], from: [4, 0.25, -3], to: [4, 4, 3.5] },
    { name: 'livery loft', tiles: [t('m', 'frontier.livery', 0, 0)], from: [4, 0, -2], to: [2, 3, 8] },
    { name: 'bank vault', tiles: [t('m', 'frontier.bank', 0, 0)], from: [1.5, 0.25, -3], to: [10, 0, 1] },
    { name: 'trench network', tiles: [t('a', 'military.trench_end', 0, 0, 0, 2), t('b', 'military.trench', 0, 1), t('c', 'military.trench_t', 0, 2, 0, 0), t('d', 'military.trench_corner', 1, 2, 0, 1), t('e', 'core.yard', 0, -1)], from: [0, 0, -8], to: [0, 0, 16] },
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

describe('Style Pack gameplay pieces', () => {
  const place = (key: (typeof SCENARIO_PALETTE)[number]['key'], yaw = 0): MapEntity[] => newScenarioEntities(key, [0, 0, 0], yaw);

  it('blast, saloon and vault doors are door variants', () => {
    const [blast] = place('door:blast');
    const [saloon] = place('door:saloon');
    const [vault] = place('door:vault');
    expect(blast).toMatchObject({ kind: 'door', style: 'blast', auto: false });
    expect(saloon).toMatchObject({ kind: 'door', style: 'saloon', auto: true });
    expect(vault).toMatchObject({ kind: 'door', style: 'vault', locked: true });
    expect(place('light:alarm')[0]).toMatchObject({ kind: 'light', off: true, color: '#ff3020' });
    expect(place('block:barrier')[0]).toMatchObject({ kind: 'block', behaviour: 'breakable', material: 'core.pbr_bunker_panels' });
    expect(place('block:planks')[0]).toMatchObject({ kind: 'block', behaviour: 'breakable', material: 'core.pbr_weathered_planks' });
  });

  it('the train and the mine cart are movers carrying walk-through models on blocks, and validate', () => {
    for (const key of ['mover:train', 'mover:minecart'] as const) {
      const placed = place(key, Math.PI / 2);
      const mover = placed.find((e) => e.kind === 'mover')!;
      expect(mover.kind === 'mover' && mover.props?.length, key).toBeGreaterThan(0);
      for (const e of placed) if (e.kind === 'prop') expect(e.solid).toBe(false);
      const map: MapDocument = { ...makeMap([t('y', 'core.platform', 0, 0)], [[0, 0, -3]]), entities: [{ id: 'spawn_0', kind: 'spawn', position: [0, 0, -3], yaw: 0, faction: null }, ...placed] };
      expect(validateMap(map).filter((i) => i.code.startsWith('mover')), key).toEqual([]);
      // The models never collide; the blocks do.
      expect(propBoxes(map).length).toBe(0);
      expect(blockBoxes(map, true).length).toBeGreaterThan(0);
    }
  });

  it('a solid prop on a mover is an error', () => {
    const placed = place('mover:minecart').map((e) => (e.kind === 'prop' ? { ...e, solid: true } : e));
    const map: MapDocument = { ...makeMap([t('y', 'core.platform', 0, 0)]), entities: [{ id: 'spawn_0', kind: 'spawn', position: [0, 0, -3], yaw: 0, faction: null }, ...placed] };
    expect(validateMap(map).map((i) => i.code)).toContain('mover.solid_prop');
  });

  it('carried props follow their mover, and a fast mover runs over whoever stands in its way', () => {
    const placed = place('mover:train', Math.PI / 2);
    const map: MapDocument = { ...makeMap([]), entities: placed };
    const movers = new Movers(map);
    movers.legs[0] = { from: 0, to: 1, start: 0 };
    const at = (tick: number) => [...movers.propTransforms(tick)].map((p) => p.position.x);
    const before = at(0);
    const later = at(120);
    for (let i = 0; i < before.length; i++) expect(later[i]! - before[i]!).toBeGreaterThan(5);
    // Mid-run, someone standing in front of the locomotive is struck; someone riding the flatbed is not.
    const tick = 240;
    const loco = [...movers.transforms(tick)][0]!;
    expect(movers.strike({ x: loco.center.x + 2.0, y: 0, z: loco.center.z }, 0.4, 1.8, tick)).toBeGreaterThan(4);
    const deck = [...movers.transforms(tick)].at(-1)!;
    expect(movers.strike({ x: deck.center.x, y: deck.center.y + deck.block.half.y, z: deck.center.z }, 0.4, 1.8, tick)).toBe(0);
    // A slow mine cart never does.
    const cart = new Movers({ ...makeMap([]), entities: place('mover:minecart') });
    cart.legs[0] = { from: 0, to: 1, start: 0 };
    const c = [...cart.transforms(120)][0]!;
    expect(cart.strike({ x: c.center.x, y: 0, z: c.center.z + 0.9 }, 0.4, 1.8, 120)).toBe(0);
  });

  it('dynamite is a throwable you can pick up, with a long fuse and a big blast', () => {
    const d = THROWABLE_DEFS.dynamite;
    expect(d.projectile.fuseSeconds).toBeGreaterThanOrEqual(3);
    expect(d.projectile.splashRadius).toBeGreaterThan(THROWABLE_DEFS.frag.projectile.splashRadius);
    expect(CORE_ITEMS.find((i) => i.id === 'core.dynamite')?.effect).toEqual({ kind: 'throwable', throwable: 'dynamite', count: 2 });
    // Dynamite crates and fuel drums go up when shot.
    for (const id of ['prop.dynamite_crate', 'prop.fuel_drum', 'prop.fuel_tank']) expect(CORE_PROPS.find((p) => p.id === id)?.breakable?.blast, id).toBeDefined();
  });
});

describe('Style Pack demo maps', () => {
  it.each(['iron_compound', 'dustwater'])('%s loads and validates with no errors or warnings', { timeout: 120_000 }, (id) => {
    const result = loadMap(read(`maps/${id}.json`).toString());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const map = result.map;
    const geometry = buildMapGeometry(map);
    const physics = new PhysicsWorld(geometry, mapTerrainMesh(map));
    const nav = NavWorld.build([...geometry, ...propBoxes(map, true), ...blockBoxes(map, true)], mapTerrainMesh(map), [...navLinks(map.entities, physics), ...liftLinks(map)]);
    physics.free();
    const issues = [...result.issues, ...validateNavigation(map, nav)];
    nav.destroy();
    expect(issues).toEqual([]);
  });

  it('the demo maps show their packs off', () => {
    const load = (id: string) => (loadMap(read(`maps/${id}.json`).toString()) as { ok: true; map: MapDocument }).map;
    const iron = load('iron_compound');
    expect(iron.classicStructure.theme).toBe('core.military');
    expect(iron.classicStructure.tiles.filter((x) => x.tile.startsWith('military.trench')).length).toBeGreaterThanOrEqual(6);
    expect(iron.entities.some((e) => e.kind === 'door' && e.style === 'blast')).toBe(true);
    expect(iron.entities.filter((e) => e.kind === 'mount' && e.model === 'turret_mg').length).toBeGreaterThanOrEqual(2);
    expect(iron.entities.some((e) => e.kind === 'block' && e.behaviour === 'breakable')).toBe(true);
    const dust = load('dustwater');
    expect(dust.classicStructure.theme).toBe('core.frontier');
    for (const tile of ['frontier.saloon', 'frontier.bank', 'frontier.jail', 'frontier.church', 'frontier.livery', 'frontier.station', 'frontier.mine_entrance']) expect(dust.classicStructure.tiles.some((x) => x.tile === tile), tile).toBe(true);
    expect(dust.entities.some((e) => e.kind === 'door' && e.style === 'saloon')).toBe(true);
    expect(dust.entities.some((e) => e.kind === 'door' && e.style === 'vault')).toBe(true);
    const train = dust.entities.find((e) => e.kind === 'mover' && e.id === 'train');
    expect(train?.kind === 'mover' && train.props?.length).toBeGreaterThanOrEqual(3);
    expect(dust.entities.some((e) => e.kind === 'mover' && e.id === 'mine_cart')).toBe(true);
    expect(dust.entities.some((e) => e.kind === 'pickup' && e.item === 'core.dynamite')).toBe(true);
  });
});
