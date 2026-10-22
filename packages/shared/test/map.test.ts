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
    const codes = r.issues.map((i) => i.code).sort();
    expect(codes).toEqual(['id.duplicate', 'spawn.none', 'tile.overlap', 'tile.unknown']);
  });

  it('warns about spawns outside the layout', () => {
    const r = loadMap(makeMap([{ id: 'tile_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[0, 0, 0], [40, 0, 0]]));
    expect(r.ok).toBe(true);
    expect(r.issues.map((i) => [i.code, i.targetId])).toEqual([['spawn.no_floor', 'spawn_1']]);
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
    expect(() => migrateMapDocument({ ...loadArena() }, new Map(), 2)).toThrow(MapMigrationError);
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
