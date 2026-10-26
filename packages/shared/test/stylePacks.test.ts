import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { FACADE_FILES, SCENARIO_PALETTE, STYLE_PACKS, PhysicsWorld, blockBoxes, buildFacades, buildMapGeometry, coreCatalog, coreThemes, getProp, initPhysics, liftLinks, loadMap, mapGravityZones, mapTerrainMesh, navLinks, propBoxes, tileModels, validateMap, type MapDocument } from '../src/index.ts';
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
    expect(STYLE_PACKS.map((p) => `${p.number} ${p.name}`)).toEqual(expect.arrayContaining(['04 Orbital Station', '07 Neon Megacity']));
    for (const p of STYLE_PACKS) expect(coreThemes.get(p.theme), p.theme).toBeTruthy();
  });

  it.each(STYLE_PACKS.map((p) => [p.id, p] as const))('%s: every tile, prop and gameplay piece resolves, and its files ship', (_id, pack) => {
    for (const id of pack.tiles) {
      const def = coreCatalog.get(id);
      expect(def, id).toBeTruthy();
      if (def?.model) expect(existsSync(new URL(def.model.file, PUBLIC)), def.model.file).toBe(true);
    }
    for (const id of pack.props) {
      const def = getProp(`prop.${id}`);
      expect(def, id).toBeTruthy();
      expect(existsSync(new URL(def!.file, PUBLIC)), def!.file).toBe(true);
    }
    for (const g of pack.gameplay) expect(SCENARIO_PALETTE.some((e) => e.key === g.key), g.key).toBe(true);
    // 25–40 pieces of its own: the pack's tiles (`<pack>.*`) and the props in its palette category.
    const own = pack.props.filter((id) => getProp(`prop.${id}`)!.category === pack.name).length + pack.tiles.filter((id) => id.startsWith(`${pack.id}.`)).length;
    expect(own, `${pack.name}: own pieces`).toBeGreaterThanOrEqual(25);
    expect(own, `${pack.name}: own pieces`).toBeLessThanOrEqual(40);
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
    expect(map.track?.ambient).toBe(2);
    const signs = map.entities.filter((e) => e.kind === 'light' && (e.fixture === 'sign' || e.fixture === 'billboard'));
    expect(signs.length).toBeGreaterThanOrEqual(10);
    const blackout = map.logic.rules.find((r) => r.id === 'rule_blackout')!;
    for (const s of signs) expect(blackout.do.some((a) => a.type === 'light_off' && a.target === s.id), s.id).toBe(true);
    expect(map.classicStructure.tiles.map((t) => t.tile)).toEqual(expect.arrayContaining(['neon.tower_a', 'neon.tower_c', 'neon.shop_a']));
  });
});
