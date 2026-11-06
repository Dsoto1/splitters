// Set pieces in MapMaker's pure commands (editor/setPieceEdit.ts, editor/operations.ts): placement checks (a footprint
// can't overlap tiles or other set pieces; a tile can't be placed, moved or turned into one), place / move / turn /
// mirror / delete with undo, explode into ordinary parts as one undo step, save a selection as a piece, and the
// budgets counting what the pieces expand into.
import { describe, expect, it } from 'vitest';
import {
  EditHistory,
  MAP_BUDGETS,
  applyCommand,
  buildMapGeometry,
  builtInSetPieces,
  checkPlacement,
  checkSetPiecePlacement,
  deleteCommand,
  deleteSetPieceCommand,
  duplicateCommand,
  expandSetPieces,
  explodeSetPieceCommand,
  invertCommand,
  mirrorSetPieceCommand,
  moveCommand,
  moveSetPieceCommand,
  placeSetPieceCommand,
  placeTileCommand,
  rotateCommand,
  rotateSetPieceCommand,
  serializeMap,
  setPieceFromSelection,
  updateTileCommand,
  validateMap,
  addSetPieceDefCommand,
  type EditCommand,
  type MapDocument,
  type SetPiecePlacement,
} from '../src/index.ts';
import { makeMap } from './helpers.ts';

const library = builtInSetPieces();

/** A yard to build on: one room far away with the spawn. */
const base = (): MapDocument => makeMap([{ id: 'home', tile: 'core.room', x: -10, y: -10, z: 0, rotation: 0 }], [[-80, 0, -80]]);
const ok = <T,>(r: T | { error: string }): T => {
  if (r && typeof r === 'object' && 'error' in r) throw new Error((r as { error: string }).error);
  return r as T;
};
const place = (doc: MapDocument, piece: string, x: number, y: number, z: number, rotation: 0 | 1 | 2 | 3 = 0, mirror = false) => {
  const r = ok(placeSetPieceCommand(doc, piece, x, y, z, rotation, { mirror }));
  return { doc: applyCommand(doc, r.command), placement: r.placement };
};

describe('set pieces: placement checks', () => {
  it('a footprint can not overlap a tile or another set piece, on any of its levels', () => {
    let { doc } = place(base(), 'setpiece.carriageway_2', 0, 0, 0);
    // Over the carriageway's upper floor (level 1): taken.
    const onTop = placeSetPieceCommand(doc, 'setpiece.skybridge_2', 1, -1, 1);
    expect('error' in onTop && onTop.error).toMatch(/its footprint overlaps the Wide Carriageway set piece on Level 1/);
    // Next to it: fine, and a tile next to that is fine.
    expect('command' in placeSetPieceCommand(doc, 'setpiece.skybridge_2', 2, 0, 1)).toBe(true);
    doc = applyCommand(doc, ok(placeTileCommand(doc, 'core.room', 3, 3, 0, 0)).command);
    const overTile = placeSetPieceCommand(doc, 'setpiece.skybridge_2', 3, 2, 0);
    expect('error' in overTile && overTile.error).toMatch(/its footprint overlaps Room on Ground/);
    expect(validateMap(doc).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it("a tile can't be placed, moved or turned into a footprint; it says why", () => {
    let { doc } = place(base(), 'setpiece.carriageway_1', 0, 0, 0);
    const into = placeTileCommand(doc, 'core.room', 0, 0, 1, 0);
    expect('error' in into && into.error).toMatch(/inside the Carriageway set piece on Level 1 .* explode it into its parts to build into it/);
    // Level 2 over it is free (its footprint is levels 0 and 1).
    expect('command' in placeTileCommand(doc, 'core.room', 0, 0, 2, 0)).toBe(true);
    doc = applyCommand(doc, ok(placeTileCommand(doc, 'core.room', 1, 0, 0, 0)).command);
    const tile = doc.classicStructure.tiles.find((t) => t.x === 1)!;
    expect('error' in moveCommand(doc, { tiles: [tile.id], entities: [] }, -1, 0, 0)).toBe(true);
    expect('error' in updateTileCommand(doc, tile, { ...tile, x: 0 })).toBe(true);
    // A long room turned about its anchor sweeps into the carriageway.
    doc = applyCommand(doc, ok(placeTileCommand(doc, 'core.room_long', 0, 1, 0, 0)).command);
    const long = doc.classicStructure.tiles.find((t) => t.tile === 'core.room_long')!;
    expect(checkPlacement(doc, [{ ...long, rotation: 2 }], [long.id]).ok).toBe(false);
    expect(checkPlacement(doc, [{ ...long, rotation: 1 }], [long.id]).ok).toBe(true);
  });

  it('pieces that are not there, and mirrors a piece does not allow', () => {
    expect(checkSetPiecePlacement(base(), [{ id: 'p_1234', piece: 'setpiece.nope', x: 0, y: 0, z: 0, rotation: 0, mirror: false }])).toMatchObject({ ok: false, reason: 'unknown set piece setpiece.nope' });
    const far = placeSetPieceCommand(base(), 'setpiece.skybridge_4', 0, 254, 1, 0);
    expect('error' in far && far.error).toMatch(/past the build limit/);
  });
});

describe('set pieces: commands and undo', () => {
  it('place, move, turn, mirror, delete: each one undo step, and undo puts the document back exactly', () => {
    const h = new EditHistory(base());
    const start = serializeMap(h.doc);
    const p = ok(placeSetPieceCommand(h.doc, 'setpiece.carriageway_1', 2, 2, 0));
    h.execute('Place', p.command);
    expect(h.doc.setPieces).toEqual([p.placement]);
    h.execute('Move', ok(moveSetPieceCommand(h.doc, p.placement.id, 1, 0, 0)));
    h.execute('Turn', ok(rotateSetPieceCommand(h.doc, p.placement.id)));
    h.execute('Mirror', ok(mirrorSetPieceCommand(h.doc, p.placement.id)));
    expect(h.doc.setPieces![0]).toMatchObject({ x: 3, y: 2, rotation: 1, mirror: true });
    h.execute('Delete', deleteSetPieceCommand(h.doc, [p.placement.id]));
    // No set pieces: no key (a map without them saves as it did).
    expect('setPieces' in h.doc).toBe(false);
    for (let i = 0; i < 5; i++) h.undo();
    expect(serializeMap(h.doc)).toBe(start);
    for (let i = 0; i < 5; i++) h.redo();
    expect('setPieces' in h.doc).toBe(false);
  });

  it('the generic commands take set pieces in the selection: move, turn, duplicate and delete them with tiles', () => {
    let { doc, placement } = place(base(), 'setpiece.skybridge_2', 0, 0, 1);
    doc = applyCommand(doc, ok(placeTileCommand(doc, 'core.room', 0, -1, 1, 0)).command);
    const tile = doc.classicStructure.tiles.find((t) => t.y === -1)!;
    const sel = { tiles: [tile.id], entities: [], setPieces: [placement.id] };
    const moved = applyCommand(doc, ok(moveCommand(doc, sel, 2, 0, 0)));
    expect(moved.setPieces![0]).toMatchObject({ x: 2, y: 0, z: 1 });
    expect(moved.classicStructure.tiles.find((t) => t.id === tile.id)).toMatchObject({ x: 2, y: -1 });
    const turned = applyCommand(doc, ok(rotateCommand(doc, sel)));
    expect(validateMap(turned).filter((i) => i.severity === 'error')).toEqual([]);
    expect(turned.setPieces![0]!.rotation).toBe(1);
    const dup = ok(duplicateCommand(doc, sel));
    const copied = applyCommand(doc, dup.command);
    expect(copied.setPieces).toHaveLength(2);
    expect(dup.selection.setPieces).toHaveLength(1);
    expect(validateMap(copied).filter((i) => i.severity === 'error')).toEqual([]);
    const gone = applyCommand(doc, deleteCommand(doc, sel));
    expect('setPieces' in gone).toBe(false);
    expect(gone.classicStructure.tiles.some((t) => t.id === tile.id)).toBe(false);
  });

  it('explode: the placement becomes its parts, as ordinary pieces with the same ids; one undo puts it back', () => {
    const { doc, placement } = place(base(), 'setpiece.carriageway_2', 4, 4, 0, 3, true);
    const played = expandSetPieces(doc, library).map;
    const r = ok(explodeSetPieceCommand(doc, placement.id));
    const exploded = applyCommand(doc, r.command);
    expect('setPieces' in exploded).toBe(false);
    expect(serializeMap(exploded)).toBe(serializeMap(played));
    expect(r.selection.tiles.length + r.selection.entities.length).toBe(library.pieces.get('setpiece.carriageway_2')!.parts.length);
    expect(serializeMap(applyCommand(exploded, invertCommand(r.command)))).toBe(serializeMap(doc));
    // The parts are ordinary now: a tile can go where its footprint was empty (none here), they move one by one.
    const part = exploded.classicStructure.tiles.find((t) => t.id === `sp_${placement.id}_0`)!;
    expect(part).toBeDefined();
    expect(buildMapGeometry(exploded)).toEqual(buildMapGeometry(played));
  });

  it('save selection as a set piece: the parts of a placed piece make the same piece again, roles and all', () => {
    let { doc, placement } = place(base(), 'setpiece.carriageway_1', 6, 6, 0);
    doc = { ...doc, setPieces: [{ ...placement, pack: 'collegiate' }] };
    const exploded = applyCommand(doc, ok(explodeSetPieceCommand(doc, placement.id)).command);
    const sel = { tiles: exploded.classicStructure.tiles.filter((t) => t.id.startsWith('sp_')).map((t) => t.id), entities: exploded.entities.filter((e) => e.id.startsWith('sp_')).map((e) => e.id) };
    const made = setPieceFromSelection(exploded, sel, [6, 6, 0], { displayName: 'My Gate' });
    if ('error' in made) throw new Error(made.error);
    expect(made.problems).toEqual([]);
    expect(made.pack).toBe('collegiate');
    expect(made.definition).toMatchObject({ id: 'local.my_gate', displayName: 'My Gate', family: 'custom', mirror: 'free', footprint: { cells: [[0, 0]], levels: [0, 1] } });
    // Materials became roles where the pack gives them.
    const passage = made.definition.parts.find((p) => p.kind === 'tile' && p.z === 0);
    expect(passage && passage.kind === 'tile' && passage.surfaces).toEqual({ floor: { role: 'paving' }, walls: { role: 'stone' }, solids: { role: 'stone' }, trim: { role: 'trim' } });
    expect(made.definition.ports.filter((p) => p.level === 0).map((p) => `${p.side}:${p.kind}`).sort()).toEqual(['E:door', 'N:opening', 'S:opening', 'W:door']);
    // The map carries it; placed (themed by its pack) it builds what the shipped piece built.
    let mine = applyCommand(base(), ok(addSetPieceDefCommand(base(), made.definition)));
    const p = ok(placeSetPieceCommand(mine, 'local.my_gate', 6, 6, 0, 0, { pack: 'collegiate' }));
    mine = applyCommand(mine, p.command);
    expect(validateMap(mine).filter((i) => i.severity === 'error')).toEqual([]);
    const strip = (m: MapDocument) => buildMapGeometry(m).map((b) => ({ ...b, sourceId: b.sourceId.replace(/^sp_[^_]+_[a-z0-9]+_/, 'sp_') }));
    expect(strip(expandSetPieces(mine, library).map)).toEqual(strip(expandSetPieces(doc, library).map));
    // A local piece needs a local id.
    expect('error' in addSetPieceDefCommand(base(), { ...made.definition, id: 'setpiece.mine' })).toBe(true);
  });

  it('save selection: only tiles, blocks, props, doors, ladders and lights; nothing selected says so', () => {
    const map = base();
    expect(setPieceFromSelection(map, { tiles: [], entities: [] }, [0, 0, 0])).toMatchObject({ error: expect.stringMatching(/nothing selected/) });
    expect(setPieceFromSelection(map, { tiles: [], entities: ['spawn_0'] }, [0, 0, 0])).toMatchObject({ error: expect.stringMatching(/leave out the spawn/) });
  });
});

describe('set pieces: budgets count the parts', () => {
  it('lights, active pieces and tiles of the expansion count; the expansion has a hard cap', () => {
    let doc = base();
    // 40 skybridges of 4 cells: 160 tiles, 80 doors, 160 lights.
    for (let i = 0; i < 40; i++) doc = applyCommand(doc, ok(placeSetPieceCommand(doc, 'setpiece.skybridge_4', (i % 20) * 2, Math.floor(i / 20) * 5, 1)).command);
    expect(doc.entities).toHaveLength(1);
    const issues = validateMap(doc);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    const lights = 40 * 4;
    expect(lights).toBeLessThan(MAP_BUDGETS.lights);
    // Over the lights' budget with more of them: warned about, from the parts.
    for (let i = 0; i < 30; i++) doc = applyCommand(doc, ok(placeSetPieceCommand(doc, 'setpiece.skybridge_4', (i % 20) * 2, 12 + Math.floor(i / 20) * 5, 1)).command);
    expect(validateMap(doc).some((i) => i.code === 'budget.lights')).toBe(true);
    // A map whose set pieces expand past the hard cap is refused (1024 placements, each 4 tiles and 17 entities).
    const many: SetPiecePlacement[] = Array.from({ length: 1024 }, (_, i) => ({ id: `gate_${i}`, piece: 'setpiece.carriageway_2', x: (i % 32) * 3 - 100, y: Math.floor(i / 32) * 2 - 100, z: 0, rotation: 0, mirror: false }));
    const huge = expandSetPieces({ ...base(), setPieces: many }, library);
    expect(huge.issues.some((i) => i.code === 'budget.setpieces' && i.severity === 'error')).toBe(true);
    // The cap is on the map as played (what the schema takes again when a joining player loads it): pieces placed by
    // hand and parts together. 4,090 lights by hand and one wide carriageway (17 entities) is too many; the file alone is not.
    const lamps = Array.from({ length: 4090 }, (_, i) => ({ id: `lamp_${i}`, kind: 'light' as const, position: [-200 + (i % 64), 2, -200 + Math.floor(i / 64)] as [number, number, number], yaw: 0, fixture: 'none' as const, color: '#ffffff', intensity: 1, range: 4 }));
    const full: MapDocument = { ...base(), entities: [...base().entities, ...lamps] as MapDocument['entities'], setPieces: [{ id: 'gate_one', piece: 'setpiece.carriageway_2', x: 0, y: 0, z: 0, rotation: 0, mirror: false }] };
    expect(full.entities.length).toBeLessThanOrEqual(4096);
    const over = expandSetPieces(full, library).issues.find((i) => i.code === 'budget.setpieces');
    expect(over?.severity).toBe('error');
    expect(over?.message).toMatch(/as played the map has 5 tiles and 4108 entities \(its set pieces add 4 and 17\): at most 4096 and 4096/);
  });

  it('placement ids are unique among themselves and with tiles and entities', () => {
    const { doc, placement } = place(base(), 'setpiece.skybridge_2', 0, 0, 1);
    const twice = { ...doc, setPieces: [placement, { ...placement, x: 4 }] };
    expect(validateMap(twice).some((i) => i.code === 'id.duplicate' && i.severity === 'error')).toBe(true);
    const asTile = { ...doc, setPieces: [{ ...placement, id: 'home' }] };
    expect(validateMap(asTile).some((i) => i.code === 'id.duplicate')).toBe(true);
  });

  it('a command that touches nothing is empty', () => {
    const empty: EditCommand = { kind: 'removeSetPieces', setPieces: [] };
    const h = new EditHistory(base());
    h.execute('nothing', empty);
    expect(h.canUndo).toBe(false);
  });
});
