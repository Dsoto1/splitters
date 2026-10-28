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
  moverGroupOf,
  withMoverGroups,
  newMapDocument,
  placeTileCommand,
  rotateCommand,
  serializeMap,
  tileAt,
  NPC_PALETTE,
  MILITIA_FACTION,
  PLAYERS_FACTION,
  mapFactions,
  placeNpcCommand,
  relation,
  type EditCommand,
  type MapDocument,
} from '../src/index.ts';
import { readFileSync } from 'node:fs';
import { loadArena } from './helpers.ts';

/** One of our maps, from maps/<id>.json. */
const ourMap = (id: string): MapDocument => {
  const r = loadMap(readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8'));
  if (!r.ok) throw new Error(`${id} failed to load`);
  return r.map;
};
const entity = (d: MapDocument, id: string) => d.entities.find((e) => e.id === id)!;

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

  it("treats a moving build (a mover and what it carries) as one piece: select, duplicate, rotate, delete", () => {
    const doc = ourMap('glacier_line');
    const walker = moverGroupOf(doc, 'walker1_lb_foot')!;
    expect(walker[0]).toBe('mover_walker1');
    expect(walker).toHaveLength(25);
    expect(withMoverGroups(doc, ['walker1_lb_foot', 'mover_walker2']).length).toBe(50);
    expect(moverGroupOf(doc, 'sp_does_not_exist')).toBeNull();

    // Duplicate: the copied mover carries the copied blocks; the original still carries its own.
    const d = unwrap(duplicateCommand(doc, { tiles: [], entities: walker }));
    const dup = applyCommand(doc, d.command);
    const copyMover = dup.entities.find((e) => d.selection.entities.includes(e.id) && e.kind === 'mover')!;
    expect(copyMover.kind === 'mover' && copyMover.blocks.every((id) => d.selection.entities.includes(id))).toBe(true);
    expect(entity(dup, 'mover_walker1')).toEqual(entity(doc, 'mover_walker1'));
    expect(loadMap(serializeMap(dup)).ok).toBe(true);

    // Rotate: a quarter turn about the mover, route included; four of them come back to the start.
    const sel = { tiles: [], entities: walker };
    const once = applyCommand(doc, unwrap(rotateCommand(doc, sel)));
    const m0 = entity(doc, 'mover_walker1');
    const m1 = entity(once, 'mover_walker1');
    const foot0 = entity(doc, 'walker1_lb_foot').position;
    const foot1 = entity(once, 'walker1_lb_foot').position;
    // Offset (x, z) from the mover becomes (z, -x).
    expect(foot1[0] - m0.position[0]).toBeCloseTo(foot0[2] - m0.position[2], 2);
    expect(foot1[2] - m0.position[2]).toBeCloseTo(-(foot0[0] - m0.position[0]), 2);
    expect(m1.kind === 'mover' && m1.points[2]).toEqual([8, 0, 0]);
    let back = once;
    for (let i = 0; i < 3; i++) back = applyCommand(back, unwrap(rotateCommand(back, sel)));
    expect(entity(back, 'walker1_lb_foot').position[0]).toBeCloseTo(foot0[0], 2);
    expect(entity(back, 'walker1_lb_foot').position[2]).toBeCloseTo(foot0[2], 2);

    // Delete one carried block: the mover lets go of it. Delete the whole build: nothing is left behind.
    const one = applyCommand(doc, deleteCommand(doc, { tiles: [], entities: ['walker1_lb_foot'] }));
    const after = entity(one, 'mover_walker1');
    expect(after.kind === 'mover' && after.blocks.includes('walker1_lb_foot')).toBe(false);
    expect(loadMap(serializeMap(one)).ok).toBe(true);
    const all = applyCommand(doc, deleteCommand(doc, sel));
    expect(all.entities.some((e) => walker.includes(e.id))).toBe(false);
  });

  it('removes a mover whose last block is deleted, and links duplicated portals to each other', () => {
    const doc = ourMap('pharaohs_reach');
    const ferry = doc.entities.find((e) => e.kind === 'mover' && e.blocks.length === 1)!;
    const block = ferry.kind === 'mover' ? ferry.blocks[0]! : '';
    const r = applyCommand(doc, deleteCommand(doc, { tiles: [], entities: [block] }));
    expect(r.entities.some((e) => e.id === ferry.id)).toBe(false);
    const d = unwrap(duplicateCommand(doc, { tiles: [], entities: ['portal_tomb', 'portal_pyramid'] }));
    const copies = applyCommand(doc, d.command).entities.filter((e) => d.selection.entities.includes(e.id));
    const pairs = copies.map((e) => (e.kind === 'portal' ? e.pair : ''));
    expect(pairs[0]).toBe(pairs[1]);
    expect(pairs[0]).not.toBe('pyramid');
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

describe('NPC palette', () => {
  it('every entry places one valid encounter on the right side in one undo step', () => {
    for (const entry of NPC_PALETTE) {
      const doc = newMapDocument('NPCs');
      const r = unwrap(placeNpcCommand(doc, entry.key, [4, 0, 2], 0));
      const history = new EditHistory(doc);
      history.execute(r.label, r.command);
      const e = history.doc.entities.find((x) => x.id === r.id);
      if (e?.kind !== 'encounter') throw new Error(`${entry.key} placed no encounter`);
      expect(e.roster).toEqual(entry.roster);
      expect(e.order).toBe(entry.order);
      // The map still loads (schema-valid) and the squad's faction exists on the expected side.
      expect(loadMap(JSON.parse(serializeMap(history.doc))).ok).toBe(true);
      const factions = mapFactions(history.doc);
      expect(factions.some((f) => f.id === e.faction)).toBe(true);
      expect(relation(factions, e.faction, PLAYERS_FACTION)).toBe(entry.ally ? 'ally' : 'enemy');
      history.undo();
      expect(history.doc).toBe(doc);
    }
  });

  it('allies reuse a friendly faction the map already has', () => {
    const doc = { ...newMapDocument('NPCs'), factions: [{ id: 'syndicate', name: 'Syndicate', color: '#d04a3a', relations: {} }, MILITIA_FACTION] };
    const r = unwrap(placeNpcCommand(doc, 'militia', [0, 0, 0], 0));
    expect(r.command.kind).toBe('addEntities');
  });
});
