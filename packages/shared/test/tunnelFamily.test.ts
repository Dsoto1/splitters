import { describe, expect, it } from 'vitest';
import {
  MAP_FORMAT_VERSION,
  PhysicsWorld,
  addPortalsCommand,
  builtInSetPieces,
  expandSetPieces,
  initPhysics,
  applyCommand,
  buildMapDecor,
  buildMapGeometry,
  connectedRun,
  coreCatalog,
  invertCommand,
  isTileOptionTwin,
  loadMap,
  mapGroundBores,
  newMapDocument,
  newTerrain,
  openEnds,
  serializeMap,
  setTileFamilyCommand,
  tileFamilies,
  validateMap,
  type MapDocument,
  type Rotation,
  type TilePlacement,
} from '../src/index.ts';

const SHAPES = ['straight', 'curve', 't', 'cross', 'end', 'portal'];

function mapOf(tiles: (Partial<TilePlacement> & { tile: string; x: number; y: number })[], hill = 0): MapDocument {
  const doc = newMapDocument('Tunnels');
  const t = newTerrain(96, 2);
  t.heights.fill(Math.round(hill * 100));
  return { ...doc, terrain: t, entities: [], classicStructure: { ...doc.classicStructure, tiles: tiles.map((p, i) => ({ id: `tile_${i}`, z: 0, rotation: 0 as Rotation, ...p })) } };
}

/** A run west to east: straight, cross, straight, with a curve off the cross's north arm and nothing on its south. */
const run = (): MapDocument =>
  mapOf([
    { tile: 'core.tunnel_concrete_straight', x: -1, y: 0, rotation: 1 },
    { tile: 'core.tunnel_concrete_cross', x: 0, y: 0 },
    { tile: 'core.tunnel_concrete_straight', x: 1, y: 0, rotation: 1 },
    // Its ports turned to south and west: joined to the cross's north arm.
    { tile: 'core.tunnel_concrete_curve', x: 0, y: 1, rotation: 1 },
    // A vaulted tunnel joined on at the east, and a room that is no part of any run.
    { tile: 'core.tunnel_vault_buried', x: 2, y: 0, rotation: 1 },
    { tile: 'core.room', x: 5, y: 5 },
    // Another run, not joined.
    { tile: 'core.tunnel_concrete_straight', x: -4, y: 4 },
  ]);

describe('tunnel families: a setting on the placed piece (map format v37)', () => {
  it('every shape comes in every family: the same cells, ports, collision and bore, other materials; the palette shows the first family only', () => {
    for (const shape of SHAPES) {
      const base = coreCatalog.get(`core.tunnel_concrete_${shape}`)!;
      const brick = coreCatalog.get(`core.tunnel_brick_${shape}`)!;
      expect(base.familyOf).toEqual({ base: base.id, family: 'concrete', label: 'Concrete' });
      expect(brick.familyOf).toEqual({ base: base.id, family: 'brick', label: 'Brick' });
      expect(isTileOptionTwin(base)).toBe(false);
      expect(isTileOptionTwin(brick)).toBe(true);
      expect(brick.cells).toEqual(base.cells);
      expect(brick.ports).toEqual(base.ports);
      expect(brick.bore).toEqual(base.bore);
      // What collides is box for box the same; only the material on it differs.
      const hard = (d: typeof base) => [...(d.extraFloors ?? []), ...(d.solids ?? []).filter((b) => b.kind !== 'trim')].map(({ surface: _s, ...b }) => b);
      expect(hard(brick)).toEqual(hard(base));
      expect(new Set((brick.solids ?? []).map((b) => b.surface?.material))).not.toEqual(new Set((base.solids ?? []).map((b) => b.surface?.material)));
      expect(coreCatalog.familiesOf(base.id).map((d) => d.id)).toEqual([base.id, brick.id]);
      expect(coreCatalog.familiesOf(brick.id).map((d) => d.id)).toEqual([base.id, brick.id]);
    }
    expect(coreCatalog.familiesOf('core.room')).toEqual([]);
    expect(coreCatalog.familiesOf('core.tunnel_vault_buried')).toEqual([]);
  });

  it('a placed piece\'s family changes how it is drawn and nothing else', () => {
    const plain = mapOf([{ tile: 'core.tunnel_concrete_cross', x: 0, y: 0 }]);
    const brick = mapOf([{ tile: 'core.tunnel_concrete_cross', x: 0, y: 0, family: 'brick' }]);
    const own = mapOf([{ tile: 'core.tunnel_brick_cross', x: 0, y: 0 }]);
    const shape = (m: MapDocument) => buildMapGeometry(m).filter((b) => b.sourceId === 'tile_0').map(({ surface: _s, ...b }) => b);
    const looks = (m: MapDocument) => new Set([...buildMapGeometry(m), ...buildMapDecor(m)].filter((b) => b.sourceId === 'tile_0').map((b) => b.surface?.material));
    expect(shape(brick)).toEqual(shape(plain));
    expect(looks(plain).has('core.pbr_concrete')).toBe(true);
    expect(looks(plain).has('core.pbr_brick_old')).toBe(false);
    expect(looks(brick).has('core.pbr_brick_old')).toBe(true);
    expect(looks(brick).has('core.pbr_concrete')).toBe(false);
    // The family's own tile id draws the same thing (both ways of saying it are valid).
    expect([...buildMapGeometry(own), ...buildMapDecor(own)].map(({ sourceId: _i, ...b }) => b)).toEqual([...buildMapGeometry(brick), ...buildMapDecor(brick)].map(({ sourceId: _i, ...b }) => b));
    expect(mapGroundBores(brick)).toEqual(mapGroundBores(plain));
    expect(tileFamilies(brick.classicStructure.tiles[0]!)).toEqual([
      { family: 'concrete', label: 'Concrete', on: false },
      { family: 'brick', label: 'Brick', on: true },
    ]);
  });

  it('the format: v37 keeps the field through save and load; a v36 map opens unchanged; a family the tile has none of is a warning and is ignored', () => {
    expect(MAP_FORMAT_VERSION).toBe(37);
    const brick = mapOf([{ tile: 'core.tunnel_concrete_cross', x: 0, y: 0, family: 'brick' }]);
    const again = loadMap(serializeMap(brick), undefined, { forEditing: true, openWithErrors: true });
    expect(again.ok && again.map.classicStructure.tiles[0]!.family).toBe('brick');
    const plain = mapOf([{ tile: 'core.tunnel_concrete_cross', x: 0, y: 0 }]);
    const old = loadMap({ ...JSON.parse(serializeMap(plain)), formatVersion: 36 }, undefined, { forEditing: true, openWithErrors: true });
    expect(old.ok).toBe(true);
    if (old.ok) {
      expect(old.migratedFrom).toBe(36);
      expect(old.map.classicStructure.tiles).toEqual(plain.classicStructure.tiles);
      expect('family' in old.map.classicStructure.tiles[0]!).toBe(false);
    }
    const odd = mapOf([{ tile: 'core.tunnel_concrete_cross', x: 0, y: 0, family: 'marzipan' }, { tile: 'core.room', x: 3, y: 0, family: 'brick' }]);
    expect(validateMap(odd).filter((i) => i.code === 'tile.family_unknown').map((i) => i.targetId)).toEqual(['tile_0', 'tile_1']);
    expect(coreCatalog.drawn(odd.classicStructure.tiles[0]!)!.id).toBe('core.tunnel_concrete_cross');
    expect(validateMap(brick).filter((i) => i.code === 'tile.family_unknown')).toEqual([]);
  });

  it('the Family switch: one piece, several, or the whole connected run in one undo step', () => {
    const doc = run();
    const one = setTileFamilyCommand(doc, ['tile_1'], 'brick');
    if ('error' in one) throw new Error(one.error);
    const after = applyCommand(doc, one);
    expect(after.classicStructure.tiles.map((t) => t.family)).toEqual([undefined, 'brick', undefined, undefined, undefined, undefined, undefined]);
    expect(applyCommand(after, invertCommand(one)).classicStructure.tiles).toEqual(doc.classicStructure.tiles);
    // Back to its own family: the field goes.
    const back = setTileFamilyCommand(after, ['tile_1'], 'concrete');
    if ('error' in back) throw new Error(back.error);
    expect('family' in applyCommand(after, back).classicStructure.tiles[1]!).toBe(false);
    expect('error' in setTileFamilyCommand(doc, ['tile_1'], 'concrete')).toBe(true);
    expect('error' in setTileFamilyCommand(doc, ['tile_5'], 'brick')).toBe(true);
    // The run from any one of its pieces: the four kit pieces and the vaulted tunnel joined to them; not the other run or the room.
    for (const from of ['tile_0', 'tile_3', 'tile_4']) expect(connectedRun(doc, [from])).toEqual(['tile_0', 'tile_1', 'tile_2', 'tile_3', 'tile_4']);
    expect(connectedRun(doc, ['tile_6'])).toEqual(['tile_6']);
    expect(connectedRun(doc, ['tile_5'])).toEqual([]);
    const whole = setTileFamilyCommand(doc, connectedRun(doc, ['tile_0']), 'brick');
    if ('error' in whole) throw new Error(whole.error);
    // (The vaulted tunnel has no families: it stays as it is.)
    expect(applyCommand(doc, whole).classicStructure.tiles.map((t) => t.family)).toEqual(['brick', 'brick', 'brick', 'brick', undefined, undefined, undefined]);
  });

  it('Add a portal: one on each open end, facing out, in the piece\'s family; walled-up ends and mouths are left', () => {
    const doc = run();
    // Open: the west straight's west end, the cross's south arm, the curve has none (south to the cross, west... to nothing).
    const ends = openEnds(doc, connectedRun(doc, ['tile_0']));
    expect(ends.map((e) => `${e.tile}:${e.side}@${e.x},${e.y}`).sort()).toEqual(['tile_0:W@-2,0', 'tile_1:S@0,-1', 'tile_3:W@-1,1', 'tile_4:E@3,0']);
    const brick = applyCommand(doc, setTileFamilyCommand(doc, ['tile_0'], 'brick') as never);
    const made = addPortalsCommand(brick, connectedRun(brick, ['tile_0']));
    if ('error' in made) throw new Error(made.error);
    const placed = Object.fromEntries(made.placed.map((p) => [`${p.x},${p.y}`, p]));
    // Turned so its tunnel side (north) faces the piece: mouth west is a quarter turn, mouth south none, mouth east three.
    expect(placed['-2,0']).toMatchObject({ tile: 'core.tunnel_concrete_portal', family: 'brick', rotation: 1 });
    expect(placed['0,-1']).toMatchObject({ tile: 'core.tunnel_concrete_portal', rotation: 0 });
    expect('family' in placed['0,-1']!).toBe(false);
    expect(placed['-1,1']).toMatchObject({ tile: 'core.tunnel_concrete_portal', rotation: 1 });
    // The vaulted tunnel's end takes the vaulted Tunnel Portal.
    expect(placed['3,0']).toMatchObject({ tile: 'core.tunnel_portal', rotation: 3 });
    const done = applyCommand(brick, made.command);
    expect(openEnds(done)).toEqual([{ tile: 'tile_6', side: 'N', x: -4, y: 5, z: 0 }, { tile: 'tile_6', side: 'S', x: -4, y: 3, z: 0 }]);
    // Under a hill the open ends are the validator's buried mouths; with the portals on, none of that run's are left.
    const buried = (m: MapDocument) => validateMap({ ...m, terrain: { ...m.terrain!, heights: m.terrain!.heights.map(() => 800) } }).filter((i) => i.code === 'tunnel.mouth_buried').map((i) => i.targetId);
    expect(buried(brick).sort()).toEqual(['tile_0', 'tile_1', 'tile_3', 'tile_4', 'tile_6', 'tile_6']);
    expect(buried(done)).toEqual(['tile_6', 'tile_6']);
    // An end walled up in the inspector is a dead end: no portal for it.
    const walled = { ...doc, classicStructure: { ...doc.classicStructure, tiles: doc.classicStructure.tiles.map((t) => (t.id === 'tile_1' ? { ...t, edges: { '0,0,0:S': 'wall' as const } } : t)) } };
    expect(openEnds(walled, ['tile_1'])).toEqual([]);
    expect('error' in addPortalsCommand(walled, ['tile_1'])).toBe(true);
  });

  it('liquid reaching into a buried passage above its floor is a warning; a pond beside it or under its floor is not', () => {
    const doc = mapOf([{ tile: 'core.tunnel_concrete_straight', x: 0, y: 0 }], 6);
    const water = (position: [number, number, number], size: [number, number, number]) => ({ ...doc, entities: [{ id: 'water_1', kind: 'water' as const, position, size, liquid: 'water' as const }] }) as MapDocument;
    const flooded = (m: MapDocument) => validateMap(m).filter((i) => i.code === 'tunnel.flooded').map((i) => i.targetId);
    expect(flooded(water([0, -0.4, 0], [6, 1, 14]))).toEqual(['water_1']);
    expect(flooded(water([0, -1.6, 0], [6, 1.4, 14]))).toEqual([]);
    expect(flooded(water([12, -0.4, 0], [6, 1, 14]))).toEqual([]);
    // A lake on the hill over the tunnel, its bed above the cap.
    expect(flooded(water([0, 5, 0], [20, 1, 20]))).toEqual([]);
  });

  it('the Lit Tunnel Run: three concrete modules and three real lights, open from end to end, part of a run, with a portal for each end', async () => {
    await initPhysics();
    const doc = mapOf([{ tile: 'core.tunnel_concrete_straight', x: 0, y: -1 }], 8);
    const placed: MapDocument = { ...doc, setPieces: [{ id: 'piece_lit', piece: 'setpiece.tunnel_lit_run', x: 0, y: 0, z: 0, rotation: 0, mirror: false }] };
    const built = expandSetPieces(placed, builtInSetPieces()).map;
    expect(built.classicStructure.tiles.filter((t) => t.tile === 'core.tunnel_concrete_straight').length).toBe(4);
    const lights = built.entities.filter((e) => e.kind === 'light');
    expect(lights.length).toBe(3);
    expect(lights.map((l) => l.position)).toEqual([[0, 3.1, 0], [0, 3.1, 8], [0, 3.1, 16]]);
    // Open along its whole length (and through the tile joined on at its south end): 32 m of passage.
    const physics = new PhysicsWorld(buildMapGeometry(built).filter((b) => b.kind !== 'barrier'), null);
    for (const [x, y] of [[0, 1.5], [1.6, 0.3], [-1.6, 3.1]] as [number, number][]) expect(physics.raycastWorld({ x, y, z: -11.9 }, { x: 0, y: 0, z: 1 }, 31.8)).toBeNull();
    physics.free();
    // The map's own tile and the piece's are one run; its open ends are the tile's south and the piece's north.
    expect(connectedRun(placed, ['tile_0'])).toEqual(['tile_0']);
    expect(openEnds(placed).map((e) => `${e.side}@${e.x},${e.y}`).sort()).toEqual(['N@0,3', 'S@0,-2']);
    const made = addPortalsCommand(placed);
    if ('error' in made) throw new Error(made.error);
    expect(made.placed.map((p) => `${p.tile}@${p.x},${p.y}r${p.rotation}`).sort()).toEqual(['core.tunnel_concrete_portal@0,-2r0', 'core.tunnel_concrete_portal@0,3r2']);
  });
});
