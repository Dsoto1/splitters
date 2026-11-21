// MapMaker painting Phase 5 (docs/MAPMAKER_PAINTING_PLAN.md, "Phase 5"; map format v47): set-piece paint lasting
// through copy and paste (the rest of its lasting is in paintTargets.test.ts), and looks of your own: Save as my look
// names a piece's look as it shows (no silent swap), the map carries the looks its pieces wear (`lookDefs`), they go
// on other pieces, last through a theme change and the map file, are renamed and updated, and leave the map with the
// last piece that wears them.
import { describe, expect, it } from 'vitest';
import {
  MAP_FORMAT_VERSION,
  SetPieceLookDef,
  applyCommand,
  applyLookCommand,
  builtInSetPieces,
  copySelection,
  deleteSetPieceCommand,
  expandSetPieces,
  explodeSetPieceCommand,
  invertCommand,
  loadMap,
  lookIdFor,
  migrateMapDocument,
  pasteCommand,
  placementLookRoles,
  renameLookCommand,
  saveLookCommand,
  serializeMap,
  validateMap,
  type EditCommand,
  type MapDocument,
  type SetPieceLookDef as LookDef,
  type SetPiecePlacement,
} from '../src/index.ts';
import { makeMap } from './helpers.ts';

const library = builtInSetPieces();
const BRICK = { material: 'core.pbr_brick_old', tint: null };
const GOLD = { material: 'core.gold_leaf', tint: null };
const MARBLE = { material: 'core.pbr_checker', tint: null };

/** A Cage Block (paving painted brick across it, one pen's bars gold) and a Bus Shelter, on the Imperial theme. */
function scene(): MapDocument {
  const map = makeMap([], [[-60, 0, -60]]);
  return {
    ...map,
    classicStructure: { ...map.classicStructure, theme: 'core.imperial' },
    setPieces: [
      { id: 'cage', piece: 'setpiece.cage_block', x: 2, y: -3, z: 0, rotation: 0, mirror: false, overrides: { roles: { paving: BRICK }, paint: { '2': { metal: GOLD } } } },
      { id: 'shelter', piece: 'setpiece.bus_shelter', x: -4, y: 4, z: 0, rotation: 0, mirror: false },
    ],
  };
}

const run = (doc: MapDocument, cmd: EditCommand | { error: string } | { command: EditCommand }): MapDocument => {
  expect('error' in cmd ? cmd.error : null).toBeNull();
  return applyCommand(doc, 'command' in cmd ? cmd.command : (cmd as EditCommand));
};
/** Every part of a placement as drawn (its tiles' surfaces, its entities' materials), by part id. */
const drawn = (doc: MapDocument, id: string) => {
  const ex = expandSetPieces(doc, library).map;
  const mine = (x: { id: string }) => x.id.startsWith(`sp_${id}_`);
  return {
    tiles: ex.classicStructure.tiles.filter(mine).map((t) => [t.id, t.surfaces ?? null]),
    entities: ex.entities.filter(mine).map((e) => [e.id, 'material' in e ? e.material : null, 'tint' in e ? e.tint : null, 'style' in e ? e.style : null]),
  };
};
const metalOf = (doc: MapDocument) => expandSetPieces(doc, library).map.classicStructure.tiles.find((t) => t.id === 'sp_cage_2')!.surfaces?.metal?.material;
const pavingOf = (doc: MapDocument, id = 'cage') => expandSetPieces(doc, library).map.classicStructure.tiles.filter((t) => t.id.startsWith(`sp_${id}_`)).map((t) => t.surfaces?.floor?.material);

describe('set-piece paint lasts through copy and paste', () => {
  it('in the same map and in another (the painted part and the paint across the piece come along)', () => {
    const doc = scene();
    const clip = copySelection(doc, { tiles: [], entities: [], setPieces: ['cage'] }, undefined, library);
    expect('error' in clip).toBe(false);
    if ('error' in clip) return;
    for (const into of [doc, { ...makeMap([], [[-60, 0, -60]]), classicStructure: { ...doc.classicStructure, tiles: [] } }]) {
      const r = pasteCommand(into, clip, [12, 12], 0, undefined, library);
      expect('error' in r ? r.error : null).toBeNull();
      if ('error' in r) continue;
      const after = applyCommand(into, r.command);
      const copy = after.setPieces!.find((p) => p.id === r.selection.setPieces![0])!;
      expect(copy.overrides).toEqual({ roles: { paving: BRICK }, paint: { '2': { metal: GOLD } } });
      expect(expandSetPieces(after, library).map.classicStructure.tiles.find((t) => t.id === `sp_${copy.id}_2`)!.surfaces?.metal?.material).toBe('core.gold_leaf');
    }
  });
});

describe('looks of your own (format v47)', () => {
  it('an id from the name: my_<name>, free', () => {
    expect(lookIdFor('Rusty Harbour!', () => false)).toBe('my_rusty_harbour');
    expect(lookIdFor('Rusty Harbour', (id) => id === 'my_rusty_harbour')).toBe('my_rusty_harbour_2');
    expect(lookIdFor('???', () => false)).toBe('my_look');
    expect(lookIdFor('a'.repeat(60), () => false).length).toBeLessThanOrEqual(32);
  });

  it('Save as my look names the look as it shows: the piece looks exactly the same, now wearing it', () => {
    const doc = scene();
    const before = drawn(doc, 'cage');
    const r = saveLookCommand(doc, 'cage', '  Brick   yard ', 'my_brick_yard', library);
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.look.displayName).toBe('Brick yard');
    // The theme's look (Imperial) with your paint across the piece folded in.
    expect(r.look.roles.paving).toEqual(BRICK);
    expect(r.look.roles.stone).toEqual(library.packs.get('imperial')!.roles.stone);
    const after = applyCommand(doc, r.command);
    const cage = after.setPieces!.find((p) => p.id === 'cage')!;
    expect(cage.pack).toBe('my_brick_yard');
    // Paint across the piece is in the look now; paint on one part stays with the placement.
    expect(cage.overrides).toEqual({ paint: { '2': { metal: GOLD } } });
    expect(after.lookDefs).toEqual([r.look]);
    expect(drawn(after, 'cage')).toEqual(before);
    // One undo step puts it all back.
    expect(applyCommand(after, invertCommand(r.command))).toEqual(doc);
  });

  it('a role no layer gives is left out, so it keeps following the theme', () => {
    const doc = { ...scene(), classicStructure: { ...scene().classicStructure, theme: 'core.prototype' } };
    const roles = placementLookRoles(doc, doc.setPieces![1]!, library.pieces.get('setpiece.bus_shelter')!, library);
    const r = saveLookCommand(doc, 'shelter', 'Plain', 'my_plain', library);
    if ('error' in r) throw new Error(r.error);
    expect(r.look.roles).toEqual(roles);
    expect(drawn(applyCommand(doc, r.command), 'shelter')).toEqual(drawn(doc, 'shelter'));
  });

  it('goes on another piece, over the theme and under its paint; lasts through a theme change', () => {
    // The cage's metal painted gold across it (it has no metal part of its own: the look still carries it).
    const start = scene();
    start.setPieces![0] = { ...start.setPieces![0]!, overrides: { ...start.setPieces![0]!.overrides, roles: { paving: BRICK, metal: GOLD } } };
    const saved = saveLookCommand(start, 'cage', 'Brick yard', 'my_brick_yard', library);
    if ('error' in saved) throw new Error(saved.error);
    let doc = applyCommand(start, saved.command);
    doc = run(doc, applyLookCommand(doc, ['shelter'], 'my_brick_yard', { library }));
    expect(doc.setPieces!.find((p) => p.id === 'shelter')!.pack).toBe('my_brick_yard');
    expect(doc.lookDefs!.map((l) => l.id)).toEqual(['my_brick_yard']);
    const shelterMaterials = (d: MapDocument) => drawn(d, 'shelter').entities.map((e) => e[1]);
    expect(shelterMaterials(doc)).toContain('core.gold_leaf');
    expect(shelterMaterials(scene())).not.toContain('core.gold_leaf');
    const city = { ...doc, classicStructure: { ...doc.classicStructure, theme: 'core.city' } };
    expect(shelterMaterials(city)).toEqual(shelterMaterials(doc));
    expect(pavingOf(city)).toEqual(pavingOf(doc));
    expect(metalOf(city)).toBe('core.gold_leaf');
  });

  it('from your library into a map that has not got it, and back to the theme: the map keeps only the looks worn', () => {
    const look: LookDef = { id: 'my_marble', displayName: 'Marble', roles: { stone: MARBLE, paving: MARBLE } };
    let doc = scene();
    expect('error' in applyLookCommand(doc, ['shelter'], 'my_marble', { library })).toBe(true);
    doc = run(doc, applyLookCommand(doc, ['cage', 'shelter'], 'my_marble', { look, library }));
    expect(doc.lookDefs).toEqual([look]);
    expect(pavingOf(doc).every((m) => m === 'core.pbr_brick_old')).toBe(true); // the cage's own paint stays on top
    doc = run(doc, applyLookCommand(doc, ['cage'], 'imperial', { library }));
    expect(doc.lookDefs).toEqual([look]);
    doc = run(doc, applyLookCommand(doc, ['shelter'], '', { library }));
    expect(doc.lookDefs).toBeUndefined();
    expect(doc.setPieces!.find((p) => p.id === 'shelter')!.pack).toBeUndefined();
  });

  it('updated under the same id: every piece wearing it changes with it', () => {
    const look: LookDef = { id: 'my_marble', displayName: 'Marble', roles: { paving: MARBLE } };
    let doc: MapDocument = { ...scene(), setPieces: scene().setPieces!.map((p): SetPiecePlacement => (p.id === 'cage' ? { ...p, overrides: undefined } : p)) };
    doc = { ...doc, setPieces: [...doc.setPieces!, { id: 'cage2', piece: 'setpiece.cage_block', x: 2, y: 2, z: 0, rotation: 0, mirror: false }] };
    doc = run(doc, applyLookCommand(doc, ['cage', 'cage2'], 'my_marble', { look, library }));
    expect(pavingOf(doc, 'cage2').every((m) => m === 'core.pbr_checker')).toBe(true);
    // Paint the first cage's paving brick across it, then save over the look.
    doc = run(doc, { kind: 'updateSetPieces', before: [doc.setPieces![0]!], after: [{ ...doc.setPieces![0]!, overrides: { roles: { paving: BRICK } } }] });
    const r = saveLookCommand(doc, 'cage', 'Marble', 'my_marble', library);
    if ('error' in r) throw new Error(r.error);
    doc = applyCommand(doc, r.command);
    expect(doc.lookDefs!.length).toBe(1);
    expect(pavingOf(doc, 'cage2').every((m) => m === 'core.pbr_brick_old')).toBe(true);
  });

  it('renamed: its id stays, so the pieces keep wearing it', () => {
    const look: LookDef = { id: 'my_marble', displayName: 'Marble', roles: { paving: MARBLE } };
    let doc = run(scene(), applyLookCommand(scene(), ['shelter'], 'my_marble', { look, library }));
    const cmd = renameLookCommand(doc, 'my_marble', 'White marble');
    expect(cmd).not.toBeNull();
    doc = applyCommand(doc, cmd!);
    expect(doc.lookDefs).toEqual([{ ...look, displayName: 'White marble' }]);
    expect(renameLookCommand(doc, 'my_marble', 'White marble')).toBeNull();
    expect(renameLookCommand(doc, 'my_other', 'X')).toBeNull();
  });

  it('round-trips through the map file, and plays in it', () => {
    const saved = saveLookCommand(scene(), 'cage', 'Brick yard', 'my_brick_yard', library);
    if ('error' in saved) throw new Error(saved.error);
    const doc = applyCommand(scene(), saved.command);
    const editing = loadMap(serializeMap(doc), undefined, { forEditing: true, library });
    expect(editing.ok).toBe(true);
    if (!editing.ok) return;
    expect(editing.map.lookDefs).toEqual(doc.lookDefs);
    expect(editing.map.setPieces!.find((p) => p.id === 'cage')!.pack).toBe('my_brick_yard');
    // As played: the parts in the look, the look itself gone with the placements.
    const played = loadMap(serializeMap(doc));
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.map.lookDefs).toBeUndefined();
    const sheet = played.map.classicStructure.tiles.filter((t) => t.id.startsWith('sp_cage_')).map((t) => [t.id, t.surfaces ?? null]);
    expect(sheet).toEqual(drawn(scene(), 'cage').tiles.map(([id, s]) => [id, s]));
  });

  it('leaves the map with the last piece that wears it (delete, Explode)', () => {
    const look: LookDef = { id: 'my_marble', displayName: 'Marble', roles: { paving: MARBLE } };
    const doc = run(scene(), applyLookCommand(scene(), ['cage'], 'my_marble', { look, library }));
    expect(applyCommand(doc, deleteSetPieceCommand(doc, ['cage'])).lookDefs).toBeUndefined();
    const ex = explodeSetPieceCommand(doc, 'cage', undefined, library);
    if ('error' in ex) throw new Error(ex.error);
    const exploded = applyCommand(doc, ex.command);
    expect(exploded.lookDefs).toBeUndefined();
    // Exploded parts keep the look as they wore it.
    expect(exploded.classicStructure.tiles.filter((t) => t.id.startsWith('sp_cage_')).map((t) => t.surfaces?.floor?.material)).toEqual(pavingOf(doc));
  });

  it('copy and paste carries the looks the copied pieces wear; a different look of the same id is refused', () => {
    const look: LookDef = { id: 'my_marble', displayName: 'Marble', roles: { paving: MARBLE } };
    const doc = run(scene(), applyLookCommand(scene(), ['shelter'], 'my_marble', { look, library }));
    const clip = copySelection(doc, { tiles: [], entities: [], setPieces: ['shelter'] }, undefined, library);
    if ('error' in clip) throw new Error(clip.error);
    expect(clip.lookDefs).toEqual([look]);
    const other = { ...makeMap([], [[-60, 0, -60]]), classicStructure: { ...doc.classicStructure, tiles: [] } };
    const r = pasteCommand(other, clip, [10, 10], 0, undefined, library);
    if ('error' in r) throw new Error(r.error);
    expect(applyCommand(other, r.command).lookDefs).toEqual([look]);
    const clash = { ...other, lookDefs: [{ ...look, roles: { paving: BRICK } }] };
    const refused = pasteCommand(clash, clip, [10, 10], 0, undefined, library);
    expect('error' in refused && /different look/.test(refused.error)).toBe(true);
  });

  it('the format: my_ ids only, checked materials, a v46 map migrates as it is', () => {
    expect(MAP_FORMAT_VERSION).toBeGreaterThanOrEqual(47);
    expect(SetPieceLookDef.safeParse({ id: 'imperial', displayName: 'X', roles: {} }).success).toBe(false);
    expect(SetPieceLookDef.safeParse({ id: 'my_x', displayName: 'X', roles: { stone: MARBLE } }).success).toBe(true);
    const odd: MapDocument = {
      ...scene(),
      setPieces: [{ ...scene().setPieces![1]!, pack: 'my_x' }],
      lookDefs: [
        { id: 'my_x', displayName: 'X', roles: { stone: { material: 'core.nope', tint: null }, trim: { material: 'core.pbr_gravel', tint: null } } },
        { id: 'my_x', displayName: 'Again', roles: {} },
      ],
    };
    const issues = validateMap(odd);
    expect(issues.some((i) => i.code === 'setpiece.look_id' && i.severity === 'error')).toBe(true);
    expect(issues.filter((i) => i.code === 'setpiece.look').map((i) => i.message).join('\n')).toMatch(/core\.nope[\s\S]*core\.pbr_gravel/);
    const v46 = { ...scene(), formatVersion: 46 };
    const { doc: migrated } = migrateMapDocument(JSON.parse(JSON.stringify(v46)));
    expect(migrated).toEqual({ ...JSON.parse(JSON.stringify(v46)), formatVersion: MAP_FORMAT_VERSION });
  });
});
