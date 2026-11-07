// MapMaker's Set pieces tab (docs/SET_PIECES_PLAN.md, "As built: part 2"): every shipped piece has a palette picture
// in its own atlas, the tab groups pieces by family and narrows them to the Style Pack picked (whose look re-themes
// them), and the player's own pieces go in and out as JSON files (storage.ts): a definition as it is, or (the owner) a
// family file for content/setpieces/.
import { describe, expect, it } from 'vitest';
import { STYLE_PACKS, builtInSetPieces, setPieceFromSelection, applyCommand, placeSetPieceCommand, newMapDocument } from '@tiletrigger/shared';
import { atlasGroup, pictureKeys, setPieceFamilyLabel, setPieceFamilyOrder, setPieceSuitsStylePack, stylePackRoles } from '../src/editor/paletteCatalog.ts';
import { importSetPieceFile, officialSetPiece } from '../src/editor/storage.ts';

const library = builtInSetPieces();
const piece = (id: string) => library.pieces.get(id)!;

describe('the Set pieces tab', () => {
  it('pictures every shipped piece, in the setpieces atlas', () => {
    const keys = pictureKeys().filter((p) => p.setPiece);
    expect(keys.map((p) => p.setPiece).sort()).toEqual([...library.pieces.keys()].sort());
    for (const { key } of keys) expect(atlasGroup(key)).toBe('setpieces');
  });

  it('groups pieces by family, named; the player\'s own last', () => {
    expect(setPieceFamilyLabel('carriageway')).toBe('Carriageways');
    expect(setPieceFamilyLabel('custom')).toBe('My set pieces');
    expect(setPieceFamilyLabel('sea_wall')).toBe('Sea wall');
    const families = [...new Set([...library.pieces.values()].map((d) => d.family))];
    for (const f of families) expect(setPieceFamilyOrder(f), f).toBeLessThan(setPieceFamilyOrder('custom'));
    expect(setPieceFamilyOrder('carriageway')).toBeLessThan(setPieceFamilyOrder('trench'));
  });

  it('narrows to the Style Pack picked: a piece goes with a pack whose look it suits', () => {
    expect(setPieceSuitsStylePack(piece('setpiece.carriageway_1'), 'gothic', library.packs)).toBe(true);
    expect(setPieceSuitsStylePack(piece('setpiece.carriageway_1'), 'military', library.packs)).toBe(false);
    expect(setPieceSuitsStylePack(piece('setpiece.skybridge_2'), 'military', library.packs)).toBe(true);
    expect(setPieceSuitsStylePack(piece('setpiece.trench_bend'), 'medieval', library.packs)).toBe(false);
    // The player's pieces that name no look go with every pack.
    expect(setPieceSuitsStylePack({ packs: [] }, 'neon', library.packs)).toBe(true);
    // Every Style Pack offers something, and every piece shows under some pack (Collegiate Gothic has no Style Pack).
    for (const p of STYLE_PACKS) expect([...library.pieces.values()].some((d) => setPieceSuitsStylePack(d, p.id, library.packs)), p.id).toBe(true);
    for (const d of library.pieces.values()) expect(STYLE_PACKS.some((p) => setPieceSuitsStylePack(d, p.id, library.packs)), d.id).toBe(true);
  });

  it("the pack picker's look: the role pack made for that Style Pack", () => {
    for (const p of STYLE_PACKS) expect(stylePackRoles(p.id, library.packs), p.id).toBe(p.id);
    expect(stylePackRoles('nowhere', library.packs)).toBeNull();
  });
});

describe('your set pieces as files', () => {
  /** A piece saved from a selection: a placed carriageway's parts. */
  const saved = () => {
    const doc = newMapDocument('t');
    const r = placeSetPieceCommand(doc, 'setpiece.carriageway_1', 3, 3, 0);
    if ('error' in r) throw new Error(r.error);
    const made = setPieceFromSelection(applyCommand(doc, r.command), { tiles: [], entities: [], setPieces: [r.placement.id] }, [3, 3, 0], { displayName: 'Gate House' });
    if ('error' in made) throw new Error(made.error);
    return made.definition;
  };
  const file = (json: unknown) => new File([typeof json === 'string' ? json : JSON.stringify(json)], 'pieces.json', { type: 'application/json' });

  it('Export then Import gives the same piece back', async () => {
    const def = saved();
    expect(def.id).toBe('local.gate_house');
    const r = await importSetPieceFile(file(def));
    expect(r.problems).toEqual([]);
    expect(r.defs).toEqual([def]);
  });

  it("the owner's export is a family file for content/setpieces/: its id setpiece.<name>, no family field", async () => {
    const def = saved();
    const shipped = officialSetPiece(def);
    expect(shipped.id).toBe('setpiece.gate_house');
    expect('family' in shipped).toBe(false);
    expect(Object.keys(shipped).slice(0, 3)).toEqual(['id', 'displayName', 'category']);
    // Importing a family file (or a shipped piece) brings it in as the player's own (local.*), its family the file's.
    const back = await importSetPieceFile(file({ family: 'gates', pieces: [shipped] }));
    expect(back.defs.map((d) => [d.id, d.family])).toEqual([['local.gate_house', 'gates']]);
  });

  it('a list of pieces; untrusted data is checked and what is wrong is named', async () => {
    const def = saved();
    const r = await importSetPieceFile(file([def, { ...def, id: 'local.Bad Name' }, { nonsense: true }]));
    expect(r.defs).toHaveLength(1);
    expect(r.problems).toHaveLength(2);
    expect(r.problems[0]).toMatch(/^piece 2: id: set piece ids look like/);
    expect((await importSetPieceFile(file('{ not json'))).problems[0]).toMatch(/^not a JSON file/);
  });
});
