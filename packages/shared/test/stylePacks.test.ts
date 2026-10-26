import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CITY_FACADES,
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
  initPhysics,
  liftLinks,
  loadMap,
  mapTerrainMesh,
  navLinks,
  newScenarioEntities,
  PhysicsWorld,
  propBoxes,
  stylePackHas,
  validateMap,
  type MapDocument,
  type MapEntity,
  type Rotation,
} from '../src/index.ts';
import { NavWorld, initNavigation, validateNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const root = (p: string) => new URL(`../../../${p}`, import.meta.url);
const read = (p: string) => readFileSync(root(p));
type Tile = MapDocument['classicStructure']['tiles'][number];
const t = (id: string, tile: string, x: number, y: number, z = 0, rotation: Rotation = 0, extra: Partial<Tile> = {}): Tile => ({ id, tile, x, y, z, rotation, ...extra });

describe('Style Packs', () => {
  it('lists Set 1: 01 Military Compound and 02 Frontier Dust, each with 25 or more pieces', () => {
    expect(STYLE_PACKS.map((p) => `${p.number} ${p.displayName}`)).toEqual(['01 Military Compound', '02 Frontier Dust']);
    for (const p of STYLE_PACKS) {
      const own = p.tiles.filter((id) => id.startsWith(`${p.id}.`)).length + p.props.length;
      expect(own, p.id).toBeGreaterThanOrEqual(25);
      expect(p.gameplay.length, p.id).toBeGreaterThanOrEqual(6);
    }
  });

  it('every pack piece resolves to a tile, prop, material, theme, palette entry, vehicle or item that ships', () => {
    const keys = new Set<string>(SCENARIO_PALETTE.map((e) => e.key));
    for (const p of STYLE_PACKS) {
      for (const id of p.tiles) expect(coreCatalog.get(id), id).toBeDefined();
      for (const id of p.themes) expect(coreThemes.get(id), id).toBeDefined();
      for (const id of p.materials) expect(coreMaterials.get(id)?.texture, id).toBeTruthy();
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
      expect(stylePackHas(p, 'tile:core.atrium')).toBe(false);
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
        const asset = coreMaterials.get(id)!.texture!;
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
      expect(CITY_FACADES.has(facade)).toBe(false);
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
