// MapMaker's two painters (docs/MAPMAKER_PAINTING_PLAN.md Phase 1; the owner's answers 1a 2a 5a): which targets
// Structure paint takes (tile, block, thin wall, bars, set-piece part) and refuses (the ground, a prop, glass), which
// materials go where (ground materials on floors and roofs only), and set-piece paint (format v41): across the piece
// by default, one part with "This surface only", winning over the look, kept through a theme change, a mirror, a turn,
// Explode and the map file.
import { describe, expect, it } from 'vitest';
import {
  GROUND_REFUSAL,
  applyCommand,
  buildMapGeometry,
  builtInSetPieces,
  explodeSetPieceCommand,
  expandSetPieces,
  loadMap,
  materialRefusal,
  roleTakesGround,
  serializeMap,
  structurePaintCommand,
  structurePaintTarget,
  type MapDocument,
  type MapEntity,
  type SetPiecePlacement,
  type StructureTarget,
  type WorldBox,
} from '../src/index.ts';
import { makeMap } from './helpers.ts';

const library = builtInSetPieces();
const BRICK = { material: 'core.pbr_brick_old', tint: null };
const GOLD = { material: 'core.gold_leaf', tint: null };

const block = (id: string, extra: Partial<Extract<MapEntity, { kind: 'block' }>> = {}): MapEntity =>
  ({ id, kind: 'block', position: [40, 0, 0], size: [2, 2, 2], yaw: 0, material: null, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120, ...extra }) as MapEntity;

/** A room, a block, a glass pane, a crate and a Cage Block (cells 2..3, -3..-2) on the Imperial theme. */
function scene(cage: Partial<SetPiecePlacement> = {}): MapDocument {
  const map = makeMap([{ id: 'room', tile: 'core.room', x: -3, y: 0, z: 0, rotation: 0, edges: { '0,0,0:S': 'bars' } }], [[-60, 0, -60]]);
  return {
    ...map,
    classicStructure: { ...map.classicStructure, theme: 'core.imperial' },
    entities: [...map.entities, block('blok'), block('pane', { position: [44, 0, 0], size: [2, 2, 0.05], glass: 'breakable' }), { id: 'crate', kind: 'prop', model: 'prop.crate_small', position: [48, 0, 0], yaw: 0, scale: 1 } as MapEntity],
    setPieces: [{ id: 'cage', piece: 'setpiece.cage_block', x: 2, y: -3, z: 0, rotation: 0, mirror: false, ...cage }],
  };
}

const expansion = (doc: MapDocument) => expandSetPieces(doc, library);
const boxesOf = (doc: MapDocument) => buildMapGeometry(expansion(doc).map);
const target = (doc: MapDocument, box: WorldBox | null, normal: [number, number, number] = [0, 0, -1]) => structurePaintTarget(doc, expansion(doc), library, box ? { box, normal } : null);
const ok = (t: ReturnType<typeof target>): StructureTarget => {
  expect(t.kind).not.toBe('refused');
  return t as StructureTarget;
};

describe('Structure paint: what it takes', () => {
  const doc = scene();
  const boxes = boxesOf(doc);
  const find = (pred: (b: WorldBox) => boolean) => {
    const b = boxes.find(pred);
    expect(b).toBeDefined();
    return b!;
  };

  it('never the ground: it says to use Ground paint', () => {
    const t = target(doc, null);
    expect(t).toEqual({ kind: 'refused', reason: 'ground', message: GROUND_REFUSAL });
    expect(GROUND_REFUSAL).toBe("Structure paint doesn't paint the ground. Use Ground paint (Shift+B).");
  });

  it("a tile's walls, floor and bars (its Metal surface)", () => {
    expect(ok(target(doc, find((b) => b.sourceId === 'room' && b.kind === 'wall' && !b.paint)))).toMatchObject({ kind: 'tile', slot: 'walls' });
    expect(ok(target(doc, find((b) => b.sourceId === 'room' && b.kind === 'floor'), [0, 1, 0]))).toMatchObject({ kind: 'tile', slot: 'floor' });
    expect(ok(target(doc, find((b) => b.sourceId === 'room' && b.paint === 'metal')))).toMatchObject({ kind: 'tile', slot: 'metal' });
  });

  it('a free block, and a thin one; never glass or a prop', () => {
    expect(ok(target(doc, find((b) => b.sourceId === 'blok')))).toMatchObject({ kind: 'block' });
    expect(target(doc, { min: [0, 0, 0], max: [1, 1, 0.05], kind: 'solid', sourceId: 'pane' })).toMatchObject({ kind: 'refused', reason: 'glass' });
    expect(target(doc, { min: [47, 0, -1], max: [49, 1, 1], kind: 'prop', sourceId: 'crate' })).toMatchObject({ kind: 'refused', reason: 'prop', message: 'Prop: its own model, not paintable' });
  });

  it("a set piece's part: a pen's bars, the passage floor", () => {
    const bars = ok(target(doc, find((b) => b.sourceId === 'sp_cage_2' && b.paint === 'metal')));
    expect(bars).toMatchObject({ kind: 'part', index: 2, slot: 'metal' });
    const floor = ok(target(doc, find((b) => b.sourceId === 'sp_cage_0' && b.kind === 'floor' && !b.roof && b.max[1] < 0.01), [0, 1, 0]));
    expect(floor).toMatchObject({ kind: 'part', index: 0, slot: 'floor' });
  });

  it('ground materials go on floors and roofs (and blocks), never on walls, trim, pillars or metal (2a)', () => {
    const t = (slot: string): StructureTarget => ({ kind: 'tile', tile: doc.classicStructure.tiles[0]!, slot: slot as never });
    for (const slot of ['floor', 'roof']) expect(materialRefusal(t(slot), 'core.pbr_gravel')).toBeNull();
    for (const slot of ['walls', 'trim', 'solids', 'underside', 'metal']) expect(materialRefusal(t(slot), 'core.pbr_gravel')).toMatch(/is a ground: on buildings it goes on floors and roofs only/);
    for (const slot of ['walls', 'floor', 'metal']) expect(materialRefusal(t(slot), 'core.pbr_brick_old')).toBeNull();
    expect(materialRefusal({ kind: 'block', block: doc.entities.find((e) => e.id === 'blok') as never }, 'core.pbr_asphalt')).toBeNull();
    expect([roleTakesGround('paving'), roleTakesGround('floor'), roleTakesGround('roof'), roleTakesGround('stone'), roleTakesGround('metal')]).toEqual([true, true, true, false, false]);
  });
});

describe('Structure paint: what a click does', () => {
  it('a tile surface, a block, with the old scopes', () => {
    const doc = scene();
    const tile = ok(target(doc, boxesOf(doc).find((b) => b.sourceId === 'room' && b.paint === 'metal')!));
    const cmd = structurePaintCommand(doc, tile, GOLD, 'surface', 'piece');
    expect(applyCommand(doc, cmd).classicStructure.tiles.find((t) => t.id === 'room')!.surfaces).toEqual({ metal: GOLD });
    const blk = ok(target(doc, boxesOf(doc).find((b) => b.sourceId === 'blok')!));
    const painted = applyCommand(doc, structurePaintCommand(doc, blk, BRICK, 'surface', 'piece'));
    expect(painted.entities.find((e) => e.id === 'blok')).toMatchObject({ material: 'core.pbr_brick_old' });
    expect(painted.entities.find((e) => e.id === 'pane')).toMatchObject({ material: null });
    const reset = structurePaintCommand(painted, { kind: 'block', block: painted.entities.find((e) => e.id === 'blok') as never }, null, 'surface', 'piece');
    expect(applyCommand(painted, reset).entities.find((e) => e.id === 'blok')).toMatchObject({ material: null });
  });

  it('on a set piece, by default the material across the piece: its role in this placement (5a)', () => {
    const doc = scene();
    const floor = ok(target(doc, boxesOf(doc).find((b) => b.sourceId === 'sp_cage_0' && b.kind === 'floor' && !b.roof && b.max[1] < 0.01)!, [0, 1, 0]));
    const after = applyCommand(doc, structurePaintCommand(doc, floor, BRICK, 'surface', 'piece'));
    const cage = after.setPieces![0]!;
    expect(cage.overrides).toEqual({ roles: { paving: BRICK } });
    // Every part's floor that is Paving shows it.
    const floors = expansion(after).map.classicStructure.tiles.filter((t) => t.id.startsWith('sp_cage_')).map((t) => t.surfaces?.floor?.material);
    expect(floors).toEqual(['core.pbr_brick_old', 'core.pbr_brick_old', 'core.pbr_brick_old', 'core.pbr_brick_old']);
  });

  it('"This surface only": one part (the bars of one pen), winning over the look', () => {
    const doc = scene();
    const bars = ok(target(doc, boxesOf(doc).find((b) => b.sourceId === 'sp_cage_2' && b.paint === 'metal')!));
    const after = applyCommand(doc, structurePaintCommand(doc, bars, GOLD, 'surface', 'part'));
    expect(after.setPieces![0]!.overrides).toEqual({ paint: { '2': { metal: GOLD } } });
    const metal = expansion(after).map.classicStructure.tiles.filter((t) => t.id.startsWith('sp_cage_')).map((t) => t.surfaces?.metal?.material ?? null);
    // The other pen keeps the theme's metal (no surface of its own: iron in every look); the painted pen is gold.
    expect(metal).toEqual([null, null, 'core.gold_leaf', null]);
    // A role change later doesn't reach the painted part.
    const roles = applyCommand(after, { kind: 'updateSetPieces', before: after.setPieces!, after: [{ ...after.setPieces![0]!, overrides: { ...after.setPieces![0]!.overrides, roles: { metal: BRICK } } }] });
    expect(expansion(roles).map.classicStructure.tiles.find((t) => t.id === 'sp_cage_2')!.surfaces?.metal?.material).toBe('core.gold_leaf');
    // Reset (right-click) takes the part's paint off; the placement is as it was.
    const reset = applyCommand(after, structurePaintCommand(after, { ...bars, placement: after.setPieces![0]! } as StructureTarget, null, 'surface', 'part'));
    expect(reset.setPieces![0]!.overrides).toBeUndefined();
  });

  it('across the piece clears the parts it reaches, so the whole piece shows it', () => {
    const doc = scene({ overrides: { paint: { '0': { floor: GOLD }, '2': { metal: GOLD } } } });
    const floor = ok(target(doc, boxesOf(doc).find((b) => b.sourceId === 'sp_cage_1' && b.kind === 'floor' && !b.roof && b.max[1] < 0.01)!, [0, 1, 0]));
    const after = applyCommand(doc, structurePaintCommand(doc, floor, BRICK, 'surface', 'piece'));
    expect(after.setPieces![0]!.overrides).toEqual({ roles: { paving: BRICK }, paint: { '2': { metal: GOLD } } });
  });

  it("a block part with a fixed material: across the piece paints every block given the same way", () => {
    const doc = { ...scene(), setPieces: [{ id: 'dock', piece: 'setpiece.parking_deck_ramp', x: 6, y: 6, z: 0, rotation: 0, mirror: false } as SetPiecePlacement] };
    const def = library.pieces.get('setpiece.parking_deck_ramp')!;
    const asphalt = def.parts.map((p, i) => (p.kind === 'block' && p.material === 'core.pbr_asphalt' ? i : -1)).filter((i) => i >= 0);
    expect(asphalt.length).toBeGreaterThanOrEqual(2);
    const box = boxesOf(doc).find((b) => b.sourceId === `sp_dock_${asphalt[0]}`)!;
    const t = ok(target(doc, box));
    expect(t).toMatchObject({ kind: 'part', slot: null });
    const after = applyCommand(doc, structurePaintCommand(doc, t, BRICK, 'surface', 'piece'));
    expect(Object.keys(after.setPieces![0]!.overrides!.paint!).map(Number)).toEqual(asphalt);
    const drawn = expansion(after).map.entities.filter((e) => asphalt.some((i) => e.id === `sp_dock_${i}`));
    expect(drawn.every((e) => e.kind === 'block' && e.material === 'core.pbr_brick_old')).toBe(true);
  });
});

describe('set-piece paint lasts (format v41)', () => {
  const painted = scene({ overrides: { roles: { paving: BRICK }, paint: { '2': { metal: GOLD } } } });
  const metalOf = (doc: MapDocument) =>
    expansion(doc)
      .map.classicStructure.tiles.filter((t) => t.id === 'sp_cage_2')
      .map((t) => t.surfaces?.metal?.material);

  it('through a theme change, a mirror and a turn', () => {
    expect(metalOf({ ...painted, classicStructure: { ...painted.classicStructure, theme: 'core.city' } })).toEqual(['core.gold_leaf']);
    expect(metalOf({ ...painted, setPieces: [{ ...painted.setPieces![0]!, mirror: true }] })).toEqual(['core.gold_leaf']);
    expect(metalOf({ ...painted, setPieces: [{ ...painted.setPieces![0]!, rotation: 1 }] })).toEqual(['core.gold_leaf']);
  });

  it('through Explode', () => {
    const ex = explodeSetPieceCommand(painted, 'cage', undefined, library);
    expect('error' in ex).toBe(false);
    const doc = applyCommand(painted, (ex as { command: Parameters<typeof applyCommand>[1] }).command);
    expect(doc.classicStructure.tiles.find((t) => t.id === 'sp_cage_2' || t.surfaces?.metal?.material === 'core.gold_leaf')?.surfaces?.metal?.material).toBe('core.gold_leaf');
  });

  it('through the map file', () => {
    const r = loadMap(serializeMap(painted), undefined, { forEditing: true, library });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.map.setPieces![0]!.overrides).toEqual({ roles: { paving: BRICK }, paint: { '2': { metal: GOLD } } });
  });

  it('paint on a part that has no such surface is a warning, and left alone', () => {
    const odd = scene({ overrides: { paint: { '2': GOLD, '99': { walls: GOLD } } } });
    const ex = expansion(odd);
    expect(ex.issues.some((i) => i.code === 'setpiece.paint' && /part 2, 99/.test(i.message))).toBe(true);
    expect(ex.map.classicStructure.tiles.find((t) => t.id === 'sp_cage_2')!.surfaces?.metal).toBeUndefined();
  });
});
