// MapMaker overhaul Phase 3 part B (docs/MAPMAKER_OVERHAUL_PLAN.md, items 3-7): groups, copy and paste between maps,
// templates' helper, mirror for team maps, note pins, and map format v31. Every command and its undo, headless.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CLIPBOARD_FORMAT,
  EditHistory,
  MAP_FORMAT_VERSION,
  addNoteCommand,
  applyCommand,
  boxBounds,
  buildMapGeometry,
  builtInSetPieces,
  coreCatalog,
  copySelection,
  deleteCommand,
  deleteNotesCommand,
  duplicateCommand,
  editNoteCommand,
  flipCommand,
  groupCommand,
  groupOf,
  listNotes,
  loadMap,
  mapContentHash,
  mapHalf,
  migrateMapDocument,
  mirrorCommand,
  mirrorHalfCommand,
  mirrorTile,
  moveCommand,
  moveNoteCommand,
  noteTitle,
  parseClipboard,
  pasteCommand,
  placeSetPieceCommand,
  renameGroupCommand,
  rotateCommand,
  selectionGroup,
  serializeMap,
  snapMirrorAt,
  startFromTemplate,
  tidyGroupsCommand,
  tileMirrorTwin,
  ungroupCommand,
  withCopiedGroups,
  withGroups,
  withGroupsTidied,
  type EditCommand,
  type MapDocument,
  type MapEntity,
  type MirrorPlane,
  type Selection,
  type TilePlacement,
  type WorldBox,
} from '../src/index.ts';
import { makeMap } from './helpers.ts';

const ok = <T,>(r: T | { error: string }): T => {
  if (r && typeof r === 'object' && 'error' in r) throw new Error((r as { error: string }).error);
  return r as T;
};
const tile = (id: string, t: string, x: number, y: number, z = 0, rotation: 0 | 1 | 2 | 3 = 0): TilePlacement => ({ id, tile: t, x, y, z, rotation });
const prop = (id: string, x: number, z: number, yaw = 0): MapEntity => ({ id, kind: 'prop', model: 'prop.barrel', position: [x, 0, z], yaw, scale: 1 }) as MapEntity;

/** Two rooms and a barrel west of the middle, a corridor beside them, the spawn far away. */
function scene(): MapDocument {
  const doc = makeMap([tile('room_a', 'core.room', -3, 0), tile('room_b', 'core.room', -3, 1), tile('cor_a', 'core.corridor', -2, 0)], [[-60, 0, -60]]);
  return applyCommand(doc, { kind: 'addEntities', entities: [prop('barrel_a', -24, 2, 0.5)] });
}
const sel = (tiles: string[], entities: string[] = [], setPieces?: string[]): Selection => ({ tiles, entities, ...(setPieces ? { setPieces } : {}) });

/** Run a command through history, check undo gives the document back exactly, then redo. */
function roundTrip(doc: MapDocument, cmd: EditCommand): MapDocument {
  const h = new EditHistory(doc);
  h.execute('step', cmd);
  const after = h.doc;
  h.undo();
  expect(h.doc).toEqual(doc);
  h.redo();
  expect(h.doc).toEqual(after);
  return after;
}

describe('format v31: groups and note pins', () => {
  it('a v30 map migrates unchanged; groups and notes save and load; they are left out of the content hash', () => {
    expect(MAP_FORMAT_VERSION).toBe(31);
    const v30 = { ...JSON.parse(readFileSync(new URL('./fixtures/iron_compound_v26.json', import.meta.url), 'utf8')), formatVersion: 30 };
    const { doc, fromVersion } = migrateMapDocument(structuredClone(v30));
    expect(fromVersion).toBe(30);
    expect(doc).toEqual({ ...v30, formatVersion: 31 });
    expect(loadMap(structuredClone(v30)).ok).toBe(true);
    const map: MapDocument = { ...scene(), groups: [{ id: 'group_1', name: 'West rooms', members: ['room_a', 'room_b'] }], editorNotes: [{ id: 'note_1', position: [1, 2, 3], text: 'Door here?' }] };
    const back = loadMap(serializeMap(map));
    expect(back.ok && back.map.groups).toEqual(map.groups);
    expect(back.ok && back.map.editorNotes).toEqual(map.editorNotes);
    expect(mapContentHash(map)).toBe(mapContentHash(scene()));
    // A group of one, or an empty note, is refused.
    expect(loadMap(JSON.parse(serializeMap({ ...map, groups: [{ id: 'group_1', members: ['room_a'] }] }))).ok).toBe(false);
    expect(loadMap(JSON.parse(serializeMap({ ...map, editorNotes: [{ id: 'note_1', position: [0, 0, 0], text: '' }] }))).ok).toBe(false);
  });
});

describe('groups (item 3)', () => {
  it('group, rename and ungroup, each one undo step; a group of one thing is refused', () => {
    const doc = scene();
    expect('error' in groupCommand(doc, sel(['room_a']))).toBe(true);
    const g = ok(groupCommand(doc, sel(['room_a', 'room_b'], ['barrel_a']), ' West base '));
    const grouped = roundTrip(doc, g.command);
    expect(grouped.groups).toEqual([{ id: g.group.id, name: 'West base', members: ['room_a', 'room_b', 'barrel_a'] }]);
    expect('error' in groupCommand(grouped, sel(['room_a']))).toBe(true); // already that group
    const renamed = roundTrip(grouped, ok(renameGroupCommand(grouped, g.group.id, 'Red base')));
    expect(renamed.groups![0]!.name).toBe('Red base');
    expect(roundTrip(renamed, ok(renameGroupCommand(renamed, g.group.id, '  '))).groups![0]!.name).toBeUndefined();
    const un = ok(ungroupCommand(renamed, sel(['room_b'])));
    expect(un.count).toBe(1);
    const back = roundTrip(renamed, un.command);
    expect(back.groups).toBeUndefined();
    expect('groups' in back).toBe(false);
    expect('error' in ungroupCommand(back, sel(['room_a']))).toBe(true);
  });

  it('picking one member selects the whole group; grouping across groups merges them', () => {
    const doc = applyCommand(scene(), ok(groupCommand(scene(), sel(['room_a', 'room_b']))).command);
    const picked = withGroups(doc, sel(['room_b']));
    expect(picked).toEqual(sel(['room_b', 'room_a']));
    expect(selectionGroup(doc, picked)?.members).toEqual(['room_a', 'room_b']);
    expect(withGroups(doc, sel(['cor_a']))).toEqual(sel(['cor_a']));
    const merged = applyCommand(doc, ok(groupCommand(doc, sel(['room_a', 'cor_a']))).command);
    expect(merged.groups).toHaveLength(1);
    expect(merged.groups![0]!.members.sort()).toEqual(['cor_a', 'room_a', 'room_b']);
  });

  it('moves, turns, mirrors and duplicates as one; the duplicate is a group of its own', () => {
    const doc = applyCommand(scene(), ok(groupCommand(scene(), sel(['room_a', 'room_b'], ['barrel_a']))).command);
    const all = withGroups(doc, sel([], ['barrel_a']));
    const moved = roundTrip(doc, ok(moveCommand(doc, all, 0, 3, 0)));
    expect(moved.classicStructure.tiles.filter((t) => t.id.startsWith('room')).map((t) => [t.x, t.y])).toEqual([[-3, 3], [-3, 4]]);
    expect(moved.entities.find((e) => e.id === 'barrel_a')!.position).toEqual([-24, 0, 26]);
    // Turned a quarter about its middle (the corridor moved out of the way first).
    const clear = applyCommand(doc, ok(moveCommand(doc, sel(['cor_a']), 3, 0, 0)));
    const turned = roundTrip(clear, ok(rotateCommand(clear, all)));
    expect(turned.classicStructure.tiles.filter((t) => t.id.startsWith('room')).map((t) => t.y)).toEqual([0, 0]);
    const flipped = roundTrip(doc, ok(flipCommand(doc, all)).command);
    // Flipped east ↔ west about its own middle: the two rooms stay on their cells, the barrel goes to the other side.
    expect(flipped.classicStructure.tiles.filter((t) => t.id.startsWith('room')).map((t) => [t.x, t.y])).toEqual([[-3, 0], [-3, 1]]);
    expect(flipped.entities.find((e) => e.id === 'barrel_a')!.position[0]).toBe(-24);
    const dup = withCopiedGroups(doc, all, ok(duplicateCommand(doc, all)));
    const two = roundTrip(doc, dup.command);
    expect(two.groups).toHaveLength(2);
    const copy = two.groups![1]!;
    expect(copy.id).not.toBe(doc.groups![0]!.id);
    expect(copy.members.sort()).toEqual([...dup.selection.tiles, ...dup.selection.entities].sort());
  });

  it('deleting members tidies the group in the same undo step (a group left with one thing goes)', () => {
    const doc = applyCommand(scene(), ok(groupCommand(scene(), sel(['room_a', 'room_b'], ['barrel_a']))).command);
    const one = roundTrip(doc, withGroupsTidied(doc, deleteCommand(doc, sel([], ['barrel_a']))));
    expect(one.groups![0]!.members).toEqual(['room_a', 'room_b']);
    const none = roundTrip(one, withGroupsTidied(one, deleteCommand(one, sel(['room_a']))));
    expect(none.groups).toBeUndefined();
    expect(tidyGroupsCommand(none)).toBeNull();
    expect(groupOf(none, 'room_b')).toBeNull();
  });
});

describe('note pins (item 7)', () => {
  it('add, edit, move, list and delete, each one undo step', () => {
    const doc = scene();
    expect('error' in addNoteCommand(doc, [0, 0, 0], '   ')).toBe(true);
    const a = ok(addNoteCommand(doc, [1.23456, 0, -2], '  Sniper line from B is too long\nmaybe a wall  '));
    const one = roundTrip(doc, a.command);
    expect(listNotes(one)).toEqual([{ id: a.note.id, position: [1.235, 0, -2], text: 'Sniper line from B is too long\nmaybe a wall' }]);
    expect(noteTitle(a.note, 20)).toBe('Sniper line from B…');
    const b = ok(addNoteCommand(one, [8, 4, 8], 'Door here?'));
    const two = roundTrip(one, b.command);
    expect(listNotes(two).map((n) => n.text)).toEqual(['Sniper line from B is too long\nmaybe a wall', 'Door here?']);
    const edited = roundTrip(two, ok(editNoteCommand(two, b.note.id, 'Door here, yes')));
    expect(listNotes(edited)[1]!.text).toBe('Door here, yes');
    expect('error' in editNoteCommand(edited, b.note.id, '')).toBe(true);
    const moved = roundTrip(edited, ok(moveNoteCommand(edited, b.note.id, [10, 4, 12])));
    expect(listNotes(moved)[1]!.position).toEqual([10, 4, 12]);
    const gone = roundTrip(moved, ok(deleteNotesCommand(moved, [a.note.id, b.note.id])));
    expect('editorNotes' in gone).toBe(false);
    expect('error' in deleteNotesCommand(gone, ['nope'])).toBe(true);
  });

  it('notes never reach play: nothing is built from them', () => {
    const doc = applyCommand(scene(), ok(addNoteCommand(scene(), [0, 0, 0], 'note')).command);
    expect(buildMapGeometry(doc)).toEqual(buildMapGeometry(scene()));
  });
});

/** A box's bounds as a comparable key (kind and rounded corners). */
const boundsKey = (b: WorldBox) => {
  const { min, max } = boxBounds(b);
  const r = (v: number) => (Math.round(v * 100) / 100 + 0).toFixed(2);
  return `${b.kind} ${min.map(r).join(',')} ${max.map(r).join(',')}`;
};
/** World boxes mirrored by the plane (bounds only). */
const mirrorBounds = (b: WorldBox, m: MirrorPlane): WorldBox => {
  const { min, max } = boxBounds(b);
  const fx = m.across !== 'northSouth';
  const fz = m.across !== 'eastWest';
  return { ...b, min: [fx ? 2 * m.at[0] - max[0] : min[0], min[1], fz ? 2 * m.at[1] - max[2] : min[2]], max: [fx ? 2 * m.at[0] - min[0] : max[0], max[1], fz ? 2 * m.at[1] - min[2] : max[2]], yaw: undefined, pitch: undefined, roll: undefined };
};

describe('mirror for team maps (item 6)', () => {
  it("a mirrored tile's geometry is the mirror image of the tile's, at every turn, across both lines and through a point", () => {
    const planes: MirrorPlane[] = [
      { across: 'eastWest', at: [12, 0] },
      { across: 'eastWest', at: [16, 0] },
      { across: 'northSouth', at: [0, -4] },
      { across: 'point', at: [8, 20] },
    ];
    for (const id of ['core.corridor', 'core.corner', 'core.stairs', 'core.room_large', 'core.hall', 'core.corridor_long', 'core.round_corner_m', 'core.junction_t', 'core.ramp', 'military.helipad']) {
      for (const rotation of [0, 1, 2, 3] as const) {
        const t: TilePlacement = { ...tile('t1', id, 1, 2, 0, rotation), edges: undefined };
        for (const m of planes) {
          const after = ok(mirrorTile(t, m, 8, coreCatalog));
          const a = buildMapGeometry(makeMap([t])).map((b) => boundsKey(mirrorBounds(b, m))).sort();
          const b = buildMapGeometry(makeMap([after])).map(boundsKey).sort();
          expect(b, `${id} turned ${rotation}, ${m.across} at ${m.at}`).toEqual(a);
        }
      }
    }
  });

  it('walls, glass and upper floors set on a tile are mirrored with it', () => {
    const base: TilePlacement = { ...tile('t1', 'core.corridor', 1, 2, 0, 1), edges: { '0,0,0:N': 'window' }, glass: { '0,0,0:N': 'breakable' } };
    for (const m of [{ across: 'eastWest', at: [4, 0] }, { across: 'northSouth', at: [0, 4] }] as MirrorPlane[]) {
      const after = ok(mirrorTile(base, m, 8, coreCatalog));
      const a = buildMapGeometry(makeMap([base])).map((b) => boundsKey(mirrorBounds(b, m))).sort();
      const b = buildMapGeometry(makeMap([after])).map(boundsKey).sort();
      expect(b).toEqual(a);
      expect(Object.keys(after.glass!)).toEqual(Object.keys(after.edges!));
    }
  });

  it('a tile with no mirror image among its turns is refused across a line, but goes through a point', () => {
    const def = coreCatalog.get('core.room_cover')!;
    expect(tileMirrorTwin(def)).toBeNull();
    const t = tile('t1', 'core.room_cover', 0, 0);
    const r = mirrorTile(t, { across: 'eastWest', at: [12, 0] }, 8, coreCatalog);
    expect('error' in r && r.error).toMatch(/Cover.*can't be mirrored across a line/);
    expect(mirrorTile(t, { across: 'point', at: [12, 0] }, 8, coreCatalog)).toMatchObject({ x: 3, y: 0, rotation: 2 });
  });

  it('a mirrored copy swaps team things to the other team; one command, one undo step', () => {
    let doc = makeMap([tile('base', 'core.room', -3, 0)], []);
    doc = applyCommand(doc, {
      kind: 'addEntities',
      entities: [
        { id: 'sp_red', kind: 'spawn', position: [-26, 0, 2], yaw: Math.PI / 2, faction: 'embers' },
        { id: 'sp_any', kind: 'spawn', position: [-22, 0, -2], yaw: 0, faction: null },
        { id: 'flag_red', kind: 'flag', position: [-24, 0, 0], yaw: 0, team: 'embers' },
        { id: 'zone_red', kind: 'zone', position: [-24, 0, 0], size: [4, 3, 6], who: 'any', count: 1, startEnabled: true, team: 'embers' },
        { id: 'door_red', kind: 'door', position: [-20, 0, 0], yaw: Math.PI / 2, startOpen: false, locked: false, auto: true, team: 'embers' },
        { id: 'zip', kind: 'zipline', position: [-24, 0, 4], end: [-6, 0, 3], height: 3.6, speed: 12, twoWay: false, sag: 0.03 },
      ] as MapEntity[],
    });
    const all = sel(['base'], doc.entities.map((e) => e.id));
    const plane: MirrorPlane = { across: 'eastWest', at: [0.3, 0] };
    const r = ok(mirrorCommand(doc, all, plane, { copy: true, swapTeams: true }));
    const after = roundTrip(doc, r.command);
    expect(r.swapped).toBe(4);
    const copy = (id: string) => after.entities.find((e) => r.selection.entities.includes(e.id) && e.kind === doc.entities.find((x) => x.id === id)!.kind && (e.kind !== 'spawn' || (e as { faction: unknown }).faction !== null) === (id !== 'sp_any'))!;
    expect(after.classicStructure.tiles.find((t) => r.selection.tiles.includes(t.id))).toMatchObject({ tile: 'core.room', x: 3, y: 0 });
    expect(copy('sp_red')).toMatchObject({ position: [26, 0, 2], faction: 'tide' });
    expect((copy('sp_red') as { yaw: number }).yaw).toBeCloseTo(-Math.PI / 2, 3);
    expect(copy('sp_any')).toMatchObject({ position: [22, 0, -2], faction: null });
    expect(copy('flag_red')).toMatchObject({ position: [24, 0, 0], team: 'tide' });
    expect(copy('zone_red')).toMatchObject({ team: 'tide', size: [4, 3, 6] });
    expect(copy('door_red')).toMatchObject({ team: 'tide', position: [20, 0, 0] });
    expect(copy('zip')).toMatchObject({ position: [24, 0, 4], end: [6, 0, 3] });
    // The originals are as they were.
    expect(after.entities.filter((e) => doc.entities.some((x) => x.id === e.id))).toEqual(doc.entities);
    // North ↔ south: facing goes to π − yaw; through a point: yaw + π.
    const ns = ok(mirrorCommand(doc, sel([], ['sp_red']), { across: 'northSouth', at: [0, 8] }, { copy: true, swapTeams: true }));
    const nsSpawn = applyCommand(doc, ns.command).entities.find((e) => e.id === ns.selection.entities[0]) as Extract<MapEntity, { kind: 'spawn' }>;
    expect(nsSpawn.position).toEqual([-26, 0, 14]);
    expect(nsSpawn.yaw).toBeCloseTo(Math.PI / 2, 3);
    const pt = ok(mirrorCommand(doc, sel([], ['sp_red']), { across: 'point', at: [0, 0] }, { copy: true, swapTeams: false }));
    const ptSpawn = applyCommand(doc, pt.command).entities.find((e) => e.id === pt.selection.entities[0]) as Extract<MapEntity, { kind: 'spawn' }>;
    expect(ptSpawn).toMatchObject({ position: [26, 0, -2], faction: 'embers' });
    expect(ptSpawn.yaw).toBeCloseTo(-Math.PI / 2, 3);
  });

  it('the line snaps to a cell middle or edge; a copy that lands on something is refused', () => {
    expect(snapMirrorAt([3.1, -9.9], 8)).toEqual([4, -8]);
    const doc = scene();
    // Mirrored across x = -20 (an edge of the rooms' cells), the corridor lands on room_a's cell... no: on x = -2 → -3.
    const r = mirrorCommand(doc, sel(['cor_a']), { across: 'eastWest', at: [-20, 0] }, { copy: true });
    expect('error' in r && r.error).toMatch(/mirrored copy overlaps/);
  });

  it('set pieces flip their mirror across a line and keep their footprint mirrored', () => {
    const lib = builtInSetPieces();
    const placed = ok(placeSetPieceCommand(scene(), 'setpiece.carriageway_2', 4, 4, 0, 1, { mirror: false, library: lib }));
    const doc = applyCommand(scene(), placed.command);
    const r = ok(mirrorCommand(doc, sel([], [], [placed.placement.id]), { across: 'eastWest', at: [0, 0] }, { copy: true }));
    const after = roundTrip(doc, r.command);
    const copy = after.setPieces!.find((p) => p.id === r.selection.setPieces![0])!;
    expect(copy.mirror).toBe(true);
    expect(copy.rotation).toBe(3);
  });

  it('half the map: the west half copied onto the east, the line left alone; refused while the east half has things', () => {
    let doc = makeMap([tile('w1', 'core.room', -2, 0), tile('w2', 'core.corridor', -1, 0), tile('mid', 'core.room', 0, 3)], [[-12, 0, 0]]);
    doc = applyCommand(doc, { kind: 'addEntities', entities: [{ id: 'flag_w', kind: 'flag', position: [-16, 0, 0], yaw: 0, team: 'embers' }] as MapEntity[] });
    const plane: MirrorPlane = { across: 'eastWest', at: [0, 0] };
    const half = mapHalf(doc, plane, 'west');
    expect(half.from.tiles.sort()).toEqual(['w1', 'w2']);
    expect(half.from.entities.sort()).toEqual(['flag_w', 'spawn_0']);
    expect(half.onLine).toBe(1);
    const r = ok(mirrorHalfCommand(doc, plane, 'west'));
    expect(r.onLine).toBe(1);
    const after = roundTrip(doc, r.command);
    const added = after.classicStructure.tiles.filter((t) => !doc.classicStructure.tiles.some((x) => x.id === t.id));
    expect(added.map((t) => [t.tile, t.x, t.y]).sort()).toEqual([['core.corridor', 1, 0], ['core.room', 2, 0]]);
    expect(after.entities.find((e) => e.kind === 'flag' && e.id !== 'flag_w')).toMatchObject({ position: [16, 0, 0], team: 'tide' });
    const again = mirrorHalfCommand(after, plane, 'west');
    expect('error' in again && again.error).toMatch(/east half has 4 things/);
    expect('error' in mirrorHalfCommand(doc, plane, 'north')).toBe(true);
  });
});

describe('copy and paste between maps (item 4)', () => {
  it('copies to JSON and pastes into another map: new ids, placed relative to the cursor, groups kept; one undo step', () => {
    const src = applyCommand(scene(), ok(groupCommand(scene(), sel(['room_a', 'room_b']))).command);
    const clip = ok(copySelection(src, sel(['room_a', 'room_b', 'cor_a'], ['barrel_a'])));
    expect(clip.format).toBe(CLIPBOARD_FORMAT);
    expect(clip.anchor).toEqual([-2, 1, 0]);
    expect(clip.groups).toHaveLength(1);
    const back = parseClipboard(JSON.parse(JSON.stringify(clip)));
    expect(back!.tiles).toEqual(clip.tiles);
    expect(back!.anchor).toEqual(clip.anchor);
    expect(parseClipboard({ format: 'nope' })).toBeNull();
    const other = makeMap([tile('home', 'core.room', 10, 10)], [[80, 0, 80]]);
    const r = ok(pasteCommand(other, back!, [4, -2], 1));
    const after = roundTrip(other, r.command);
    const pasted = after.classicStructure.tiles.filter((t) => r.selection.tiles.includes(t.id));
    expect(pasted.map((t) => [t.tile, t.x, t.y, t.z])).toEqual([['core.room', 3, -3, 1], ['core.room', 3, -2, 1], ['core.corridor', 4, -3, 1]]);
    for (const t of pasted) expect(['room_a', 'room_b', 'cor_a']).not.toContain(t.id);
    const barrel = after.entities.find((e) => r.selection.entities.includes(e.id))!;
    expect(barrel.id).not.toBe('barrel_a');
    expect(barrel.position).toEqual([-24 + 6 * 8, 4, 2 - 3 * 8]);
    expect(after.groups).toHaveLength(1);
    expect(after.groups![0]!.members.sort()).toEqual(pasted.filter((t) => t.tile === 'core.room').map((t) => t.id).sort());
    // Pasting twice in the same place: refused (it would overlap), the reason given.
    const twice = pasteCommand(after, back!, [4, -2], 1);
    expect('error' in twice && twice.error).toMatch(/overlaps/);
  });

  it("refuses a map with another grid or theme, saying why; a copied set piece of the map's own travels with it", () => {
    const src = scene();
    const clip = ok(copySelection(src, sel(['room_a'])));
    const big = { ...makeMap([]), classicStructure: { ...makeMap([]).classicStructure, cellSize: 10 } };
    expect(pasteCommand(big, clip, [0, 0], 0)).toEqual({ error: expect.stringMatching(/8 m cells and 4 m levels; this map's are 10 m and 4 m/) });
    const themed = { ...makeMap([]), classicStructure: { ...makeMap([]).classicStructure, theme: 'core.industrial' } };
    expect(pasteCommand(themed, clip, [0, 0], 0)).toEqual({ error: expect.stringMatching(/another theme \(core\.prototype\); this map is core\.industrial/) });
    expect('error' in copySelection(src, sel([]))).toBe(true);
  });
});

describe('templates (item 5)', () => {
  it("a map started from a template is the template's layout with its own id, name and dates", () => {
    const tpl: MapDocument = { ...scene(), metadata: { ...scene().metadata, id: 'tpl_arena', name: 'Arena', author: 'Tile Trigger' } };
    const doc = startFromTemplate(tpl, 'My arena', new Date('2026-11-08T10:00:00Z'));
    expect(doc.metadata).toMatchObject({ name: 'My arena', author: '', createdAt: '2026-11-08T10:00:00.000Z', parentId: null });
    expect(doc.metadata.id).not.toBe('tpl_arena');
    expect(doc.classicStructure).toEqual(tpl.classicStructure);
  });
});
