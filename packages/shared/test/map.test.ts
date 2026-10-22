import { describe, expect, it } from 'vitest';
import { buildMapGeometry, isOpenEdge, buildOccupancy, loadMap, migrateMapDocument, serializeMap, MapMigrationError, type Migration } from '../src/index.ts';
import { loadArena, makeMap } from './helpers.ts';

describe('map loading', () => {
  it('loads the Phase 0 arena without errors or warnings', () => {
    const arena = loadArena();
    const result = loadMap(serializeMap(arena));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.issues).toEqual([]);
  });

  it('round-trips through serialisation unchanged', () => {
    const arena = loadArena();
    const again = loadMap(serializeMap(arena));
    expect(again.ok && again.map).toEqual(arena);
  });

  it('rejects invalid JSON, wrong format and future versions', () => {
    expect(loadMap('{not json').ok).toBe(false);
    expect(loadMap({ format: 'other', formatVersion: 1 }).ok).toBe(false);
    const future = loadMap({ ...loadArena(), formatVersion: 99 });
    expect(future.ok).toBe(false);
    expect(future.issues[0]?.message).toMatch(/newer/);
  });

  it('reports schema errors with a path', () => {
    const bad = { ...loadArena(), entities: [{ id: 'x', kind: 'spawn', position: [0, 0] }] };
    const r = loadMap(bad);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.message.startsWith('entities.0'))).toBe(true);
  });

  it('flags duplicate IDs, overlapping tiles, unknown tiles and missing spawns', () => {
    const map = makeMap(
      [
        { id: 'tile_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 },
        { id: 'tile_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 },
        { id: 'tile_c', tile: 'core.nope', x: 5, y: 0, z: 0, rotation: 0 },
      ],
      [],
    );
    const r = loadMap(map);
    expect(r.ok).toBe(false);
    const codes = r.issues.filter((i) => i.severity !== 'suggestion').map((i) => i.code).sort();
    expect(codes).toEqual(['id.duplicate', 'spawn.none', 'tile.overlap', 'tile.unknown']);
  });

  it('warns about spawns outside the layout', () => {
    const r = loadMap(makeMap([{ id: 'tile_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[0, 0, 0], [40, 0, 0]]));
    expect(r.ok).toBe(true);
    expect(r.issues.filter((i) => i.severity !== 'suggestion').map((i) => [i.code, i.targetId])).toEqual([['spawn.no_floor', 'spawn_1']]);
  });
});

describe('migrations', () => {
  it('runs registered steps in order without mutating the input', () => {
    const v1 = loadArena();
    const old = { ...v1, formatVersion: 1, legacyName: 'x' };
    const migrations = new Map<number, Migration>([
      [1, (d: Record<string, unknown>) => ({ ...d, stepOne: true })],
      [2, (d: Record<string, unknown>) => ({ ...d, stepTwo: d.stepOne === true })],
    ]);
    const { doc, fromVersion } = migrateMapDocument(old, migrations, 3);
    expect(fromVersion).toBe(1);
    expect(doc).toMatchObject({ formatVersion: 3, stepOne: true, stepTwo: true });
    expect(old.formatVersion).toBe(1);
    expect('stepOne' in old).toBe(false);
  });

  it('fails loudly on a gap in the chain', () => {
    expect(() => migrateMapDocument({ ...loadArena() }, new Map(), 4)).toThrow(MapMigrationError);
  });
});

describe('classic grid geometry', () => {
  it('opens doorways only where both neighbours have facing ports', () => {
    const map = makeMap([
      { id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 },
      { id: 'corr_b', tile: 'core.corridor', x: 1, y: 0, z: 0, rotation: 1 },
      { id: 'corr_c', tile: 'core.corridor', x: 0, y: 1, z: 0, rotation: 1 },
    ]);
    const { cells } = buildOccupancy(map);
    expect(isOpenEdge(cells, 0, 0, 0, 'E')).toBe(true); // room <-> E/W corridor
    expect(isOpenEdge(cells, 0, 0, 0, 'N')).toBe(false); // corridor above runs E/W, no S port
    expect(isOpenEdge(cells, 0, 0, 0, 'W')).toBe(false); // nothing there: auto-capped
  });

  it('rotates tile ports and solids', () => {
    const map = makeMap([
      { id: 'stair', tile: 'core.stairs', x: 0, y: 0, z: 0, rotation: 1 },
      { id: 'low', tile: 'core.room', x: 0, y: 1, z: 0, rotation: 0 },
      { id: 'high', tile: 'core.room', x: 0, y: -1, z: 1, rotation: 0 },
    ]);
    const { cells } = buildOccupancy(map);
    // Rotated once clockwise, the low (W) port faces N and the high (E) port faces S.
    expect(isOpenEdge(cells, 0, 0, 0, 'N')).toBe(true);
    expect(isOpenEdge(cells, 0, 0, 1, 'S')).toBe(true);
    const steps = buildMapGeometry(map).filter((b) => b.kind === 'solid');
    expect(steps).toHaveLength(16);
    const lowest = steps.reduce((a, b) => (a.max[1] < b.max[1] ? a : b));
    const highest = steps.reduce((a, b) => (a.max[1] > b.max[1] ? a : b));
    expect(lowest.max[2]).toBeGreaterThan(highest.max[2]); // climbs toward -Z (south)
  });

  it('produces walls with a 3 m doorway gap', () => {
    const map = makeMap([
      { id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 },
      { id: 'room_b', tile: 'core.room', x: 1, y: 0, z: 0, rotation: 0 },
    ]);
    const eastWall = buildMapGeometry(map).filter((b) => b.sourceId === 'room_a' && b.kind === 'wall' && b.min[0] === 3.5);
    expect(eastWall).toHaveLength(3);
    const lower = eastWall.filter((b) => b.min[1] === 0).map((b) => [b.min[2], b.max[2]]);
    expect(lower).toEqual([[-4, -1.5], [1.5, 4]]);
  });
});

describe('format v2 (surface styles)', () => {
  it('migrates a v1 map file to v2 without losing anything', async () => {
    const { readFileSync } = await import('node:fs');
    const v1 = JSON.parse(readFileSync(new URL('./fixtures/arena_v1.json', import.meta.url), 'utf8'));
    expect(v1.formatVersion).toBe(1);
    const r = loadMap(v1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.migratedFrom).toBe(1);
    const arena = loadArena();
    expect(r.map.classicStructure).toEqual(arena.classicStructure);
    expect(r.map.entities).toEqual(arena.entities.filter((e) => e.kind === 'spawn'));
  });

  it('rejects unknown materials, unknown themes and malformed tints', () => {
    const arena = loadArena();
    const tiles = arena.classicStructure.tiles.map((t, i) => (i === 0 ? { ...t, surfaces: { walls: { material: 'core.nope', tint: null } } } : t));
    const r = loadMap({ ...arena, classicStructure: { ...arena.classicStructure, theme: 'core.missing', tiles } });
    expect(r.ok).toBe(false);
    expect(r.issues.filter((i) => i.severity === 'error').map((i) => i.code).sort()).toEqual(['material.unknown', 'theme.unknown']);
    const badTint = arena.classicStructure.tiles.map((t, i) => (i === 0 ? { ...t, surfaces: { floor: { material: 'core.marble', tint: 'red' } } } : t));
    expect(loadMap({ ...arena, classicStructure: { ...arena.classicStructure, tiles: badTint } }).ok).toBe(false);
  });

  it('resolves tile overrides over theme defaults and maps box faces to slots', async () => {
    const { resolveSurface, faceSlot } = await import('../src/index.ts');
    const arena = loadArena();
    const tile = { ...arena.classicStructure.tiles[0]!, surfaces: { walls: { material: 'core.red_brick', tint: '#ff0000' } } };
    expect(resolveSurface(arena, tile, 'walls')).toMatchObject({ material: { id: 'core.red_brick' }, tint: '#ff0000' });
    expect(resolveSurface(arena, tile, 'floor')).toMatchObject({ material: { id: 'core.proto_floor' }, tint: null });
    const tomb = { ...arena, classicStructure: { ...arena.classicStructure, theme: 'core.tomb' } };
    expect(resolveSurface(tomb, undefined, 'floor').material.id).toBe('core.sandstone');
    expect(faceSlot({ kind: 'floor' }, [0, 1, 0])).toBe('floor');
    expect(faceSlot({ kind: 'floor' }, [0, -1, 0])).toBe('underside');
    expect(faceSlot({ kind: 'wall' }, [1, 0, 0])).toBe('walls');
  });
});

describe('format v3 (pickups)', () => {
  it('migrates a v2 map and validates pickup items', async () => {
    const { readFileSync } = await import('node:fs');
    const v2 = JSON.parse(readFileSync(new URL('./fixtures/arena_v2.json', import.meta.url), 'utf8'));
    const r = loadMap(v2);
    expect(r.ok && r.migratedFrom).toBe(2);
    const arena = loadArena();
    expect(arena.entities.filter((e) => e.kind === 'pickup').length).toBeGreaterThan(10);
    const bad = { ...arena, entities: [...arena.entities, { id: 'pk_bad', kind: 'pickup', position: [0, 0, 0], item: 'core.nope', respawnSeconds: null }] };
    const rb = loadMap(bad);
    expect(rb.ok).toBe(false);
    expect(rb.issues.map((i) => [i.code, i.targetId])).toEqual([['pickup.unknown', 'pk_bad']]);
  });
});
