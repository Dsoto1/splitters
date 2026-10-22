import { describe, expect, it } from 'vitest';
import {
  EditHistory,
  addSpawnCommand,
  applyCommand,
  checkPlacement,
  deleteCommand,
  duplicateCommand,
  invertCommand,
  loadMap,
  moveCommand,
  newMapDocument,
  placeTileCommand,
  rotateCommand,
  serializeMap,
  tileAt,
  type EditCommand,
  type MapDocument,
} from '../src/index.ts';
import { loadArena } from './helpers.ts';

const sorted = (d: MapDocument) => ({
  ...d,
  classicStructure: { ...d.classicStructure, tiles: [...d.classicStructure.tiles].sort((a, b) => a.id.localeCompare(b.id)) },
  entities: [...d.entities].sort((a, b) => a.id.localeCompare(b.id)),
});

const unwrap = <T extends object>(r: T | { error: string }): T => {
  if ('error' in r) throw new Error(r.error);
  return r;
};

describe('edit commands', () => {
  it('every command inverts back to the original document', () => {
    const doc = loadArena();
    const tile = doc.classicStructure.tiles[0]!;
    const spawn = doc.entities[0]!;
    const commands: EditCommand[] = [
      { kind: 'addTiles', tiles: [{ ...tile, id: 'new_tile', x: 9 }] },
      { kind: 'removeTiles', tiles: [tile] },
      { kind: 'updateTiles', before: [tile], after: [{ ...tile, rotation: 2 }] },
      { kind: 'addEntities', entities: [{ ...spawn, id: 'new_spawn' }] },
      { kind: 'removeEntities', entities: [spawn] },
      { kind: 'updateEntities', before: [spawn], after: [{ ...spawn, position: [1, 2, 3] }] },
      { kind: 'setMetadata', before: { name: doc.metadata.name }, after: { name: 'Renamed' } },
    ];
    commands.push({ kind: 'batch', commands: [commands[0]!, commands[2]!, commands[3]!, commands[6]!] });
    for (const cmd of commands) {
      const after = applyCommand(doc, cmd);
      expect(after).not.toEqual(doc);
      // Inversion restores the same items; order may differ (history keeps exact documents for that).
      expect(sorted(applyCommand(after, invertCommand(cmd)))).toEqual(sorted(doc));
    }
  });

  it('rejects inconsistent commands without touching history', () => {
    const h = new EditHistory(loadArena());
    const before = h.doc;
    expect(() => h.execute('bad', { kind: 'removeTiles', tiles: [{ id: 'nope', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }] })).toThrow();
    expect(() => h.execute('dup', { kind: 'addTiles', tiles: [before.classicStructure.tiles[0]!] })).toThrow();
    expect(h.doc).toBe(before);
    expect(h.canUndo).toBe(false);
  });
});

describe('EditHistory', () => {
  it('undoes and redoes in order; a new edit clears redo', () => {
    const h = new EditHistory(newMapDocument('t'));
    const original = h.doc;
    const a = unwrap(placeTileCommand(h.doc, 'core.corridor', 1, 0, 0, 1));
    h.execute('Place corridor', a.command);
    const b = unwrap(placeTileCommand(h.doc, 'core.room', 2, 0, 0, 0));
    h.execute('Place room', b.command);
    expect(h.doc.classicStructure.tiles).toHaveLength(3);
    expect(h.undo()).toBe('Place room');
    expect(h.doc.classicStructure.tiles).toHaveLength(2);
    expect(h.redo()).toBe('Place room');
    h.undo();
    h.undo();
    expect(h.doc).toEqual(original);
    expect(h.canUndo).toBe(false);
    h.redo();
    h.execute('Spawn', addSpawnCommand([8, 0, 0], 0).command);
    expect(h.canRedo).toBe(false);
  });

  it('records a multi-object operation as one step', () => {
    const doc = loadArena();
    const h = new EditHistory(doc);
    h.execute('Delete', deleteCommand(doc, { tiles: doc.classicStructure.tiles.map((t) => t.id), entities: doc.entities.map((e) => e.id) }));
    expect(h.doc.classicStructure.tiles).toHaveLength(0);
    expect(h.doc.entities).toHaveLength(0);
    h.undo();
    expect(h.doc).toEqual(doc);
  });
});

describe('editor operations', () => {
  it('refuses to place a tile on an occupied cell, including multi-cell tiles', () => {
    const doc = loadArena();
    expect(placeTileCommand(doc, 'core.room', 0, 0, 0, 0)).toEqual({ error: 'overlaps another tile' });
    // Stairs at (1,2,0) also reserve (1,2,1).
    expect(placeTileCommand(doc, 'core.room', 1, 2, 1, 0)).toEqual({ error: 'overlaps another tile' });
    expect('command' in placeTileCommand(doc, 'core.room', 5, 5, 0, 0)).toBe(true);
    expect(tileAt(doc, 1, 2, 1)?.id).toBe('t_stairs');
  });

  it('moves tiles together with selected entities, and refuses overlapping moves', () => {
    const doc = newMapDocument('m');
    const sel = { tiles: [doc.classicStructure.tiles[0]!.id], entities: [doc.entities[0]!.id] };
    const moved = applyCommand(doc, unwrap(moveCommand(doc, sel, 2, -1, 1)));
    expect(moved.classicStructure.tiles[0]).toMatchObject({ x: 2, y: -1, z: 1 });
    expect(moved.entities[0]!.position).toEqual([16, 4, -8]);
    const arena = loadArena();
    expect(moveCommand(arena, { tiles: ['t_room_sw'], entities: [] }, 1, 0, 0)).toEqual({ error: 'overlaps another tile' });
  });

  it('rotates tiles a quarter turn and spawns by 45 degrees', () => {
    const doc = loadArena();
    const r = applyCommand(doc, unwrap(rotateCommand(doc, { tiles: ['t_corr_s'], entities: ['sp_room_sw'] })));
    expect(r.classicStructure.tiles.find((t) => t.id === 't_corr_s')!.rotation).toBe(2);
    const spawn = r.entities.find((e) => e.id === 'sp_room_sw')!;
    expect(spawn.kind === 'spawn' ? spawn.yaw : NaN).toBeCloseTo(0.785 + Math.PI / 4, 2);
    // Stairs reserve the cell above them, which stays put under rotation, so this is allowed.
    expect('kind' in rotateCommand(doc, { tiles: ['t_stairs'], entities: [] })).toBe(true);
  });

  it('duplicates into the first free space with fresh IDs', () => {
    const doc = loadArena();
    const d = unwrap(duplicateCommand(doc, { tiles: ['t_room_sw'], entities: ['sp_room_sw'] }));
    const after = applyCommand(doc, d.command);
    const copy = after.classicStructure.tiles.find((t) => t.id === d.selection.tiles[0])!;
    expect(copy.x).toBe(3); // cells x=1,2 are taken
    expect(copy.id).not.toBe('t_room_sw');
    expect(checkPlacement(after, after.classicStructure.tiles).ok).toBe(true);
  });

  it('creates new maps that validate and survive a save/load round trip', () => {
    const doc = newMapDocument('Fresh');
    const r = loadMap(serializeMap(doc));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.map).toEqual(doc);
  });
});

describe('fine-grained edits', () => {
  it('replaces a tile type only when the new shape fits', async () => {
    const { updateTileCommand, moveEntitiesCommand } = await import('../src/index.ts');
    const doc = loadArena();
    const room = doc.classicStructure.tiles.find((t) => t.id === 't_room_ne')!;
    // Turning the room under the upper floor into stairs would need the occupied cell above.
    expect(updateTileCommand(doc, room, { ...room, tile: 'core.stairs' })).toEqual({ error: 'overlaps another tile' });
    const ok = updateTileCommand(doc, room, { ...room, tile: 'core.room_columns' });
    expect('kind' in ok).toBe(true);
    const moved = applyCommand(doc, moveEntitiesCommand(doc, ['sp_hub'], 0.5, 0, -0.5));
    expect(moved.entities.find((e) => e.id === 'sp_hub')!.position).toEqual([11, 0, 7.5]);
  });
});

describe('painting', () => {
  it('paints one surface, a whole tile type, a level, or everything — each as one undo step', async () => {
    const { paintCommand, setThemeCommand } = await import('../src/index.ts');
    const doc = loadArena();
    const h = new EditHistory(doc);
    const brick = { material: 'core.red_brick', tint: null };

    h.execute('Paint', paintCommand(h.doc, 't_hub', 'walls', brick));
    expect(h.doc.classicStructure.tiles.filter((t) => t.surfaces?.walls)).toHaveLength(1);

    h.execute('Paint', paintCommand(h.doc, 't_room_sw', 'floor', { material: 'core.checker', tint: '#ff6b6b' }, 'sameType'));
    const rooms = h.doc.classicStructure.tiles.filter((t) => t.tile === 'core.room');
    expect(rooms.every((t) => t.surfaces?.floor?.material === 'core.checker')).toBe(true);

    h.execute('Paint', paintCommand(h.doc, 't_upper_n', 'floor', { material: 'core.grate', tint: null }, 'level'));
    expect(h.doc.classicStructure.tiles.filter((t) => t.surfaces?.floor?.material === 'core.grate').map((t) => t.z)).toEqual([1, 1]);

    // Repainting with the same style records nothing.
    const rev = h.revision;
    h.execute('Paint', paintCommand(h.doc, 't_hub', 'walls', brick));
    expect(h.revision).toBe(rev);

    // Clearing restores the theme default and drops empty surface objects.
    h.execute('Clear', paintCommand(h.doc, 't_hub', 'walls', null));
    expect(h.doc.classicStructure.tiles.find((t) => t.id === 't_hub')!.surfaces).toBeUndefined();

    h.execute('Theme', setThemeCommand(h.doc, 'core.factory'));
    expect(h.doc.classicStructure.theme).toBe('core.factory');
    while (h.canUndo) h.undo();
    expect(h.doc).toEqual(doc);
  });
});
