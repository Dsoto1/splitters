import { describe, expect, it } from 'vitest';
import {
  EditHistory,
  applyCommand,
  newMapDocument,
  newTerrain,
  pruneSelection,
  sameSelection,
  settledPropY,
  transformCommand,
  wholeSelection,
  type EditCommand,
  type MapDocument,
  type MapEntity,
  type PropEntity,
  type Selection,
} from '../src/index.ts';
import { block, twoRooms } from './kit20.ts';

/** MapMaker UI spec Phase 2: the shared transform command and the one selection's rules. */

const cmd = (c: EditCommand | { error: string }): EditCommand => {
  if ('error' in c) throw new Error(c.error);
  return c;
};
const ent = (d: MapDocument, id: string) => d.entities.find((e) => e.id === id)!;
const things = (ids: string[]): Selection => ({ tiles: [], entities: ids });
const yaw = (d: MapDocument, id: string) => (ent(d, id) as { yaw: number }).yaw;

/** A moving build: a mover carrying a block and a prop, beside two rooms. */
function buildMap(): MapDocument {
  const crate: PropEntity = { id: 'crate_1', kind: 'prop', model: 'core.crate', position: [-1, 0.3, 1], yaw: 0, scale: 1, solid: true, tint: null };
  const mover: MapEntity = { id: 'mover_1', kind: 'mover', position: [-1, 0, 1], yaw: 0, blocks: ['lift_1'], props: ['crate_1'], points: [[0, 0, 0], [0, 1.5, 0]], mode: 'pingpong', speed: 1, turnSpeed: 45, wait: 0.5, startActive: true };
  return twoRooms([block('lift_1', [-1, 0, 1], { size: [2.4, 0.3, 2.4] }), crate, mover]);
}

/** Open ground sloping up to the east (1 m in 10), with a crate resting on it. */
function slopeMap(): MapDocument {
  const doc = newMapDocument('Slope', new Date(0));
  const t = newTerrain(64, 2);
  t.heights = t.heights.map((_, i) => ((i % t.cols) * t.spacing + t.origin[0] + 32) * 10);
  const crate: PropEntity = { id: 'crate_1', kind: 'prop', model: 'core.crate', position: [0, 0, 0], yaw: 0, scale: 1, solid: true, tint: null };
  crate.position = [0, settledPropY(t, crate)!, 0];
  return { ...doc, classicStructure: { ...doc.classicStructure, tiles: [] }, terrain: t, entities: [...doc.entities, crate] };
}

describe('transformCommand (MapMaker UI spec Phase 2)', () => {
  it('typing X moves a thing like a drag: rounded to the millimetre', () => {
    const doc = buildMap();
    const typed = applyCommand(doc, cmd(transformCommand(doc, things(['lift_1']), { set: { id: 'lift_1', axis: 0, value: 2.123456 } })));
    expect(ent(typed, 'lift_1').position).toEqual([2.123, 0, 1]);
    // The same move made by a drag of (3.123456, 0) lands in the same place.
    const dragged = applyCommand(doc, cmd(transformCommand(doc, things(['lift_1']), { by: { metres: [3.123456, 0, 0] } })));
    expect(ent(dragged, 'lift_1').position).toEqual(ent(typed, 'lift_1').position);
  });

  it('typing X or Z beds a prop resting on the terrain where it lands; typing Height does not', () => {
    const doc = slopeMap();
    const t = doc.terrain!;
    const sel = things(['crate_1']);
    const east = applyCommand(doc, cmd(transformCommand(doc, sel, { set: { id: 'crate_1', axis: 0, value: 10 } })));
    const c = ent(east, 'crate_1') as PropEntity;
    expect(c.position[0]).toBe(10);
    expect(c.position[1]).toBe(settledPropY(t, c));
    expect(c.position[1]).toBeGreaterThan(ent(doc, 'crate_1').position[1] + 0.9);
    // The same move by drag gives the same height.
    const dragged = applyCommand(doc, cmd(transformCommand(doc, sel, { by: { metres: [10, 0, 0] } })));
    expect(ent(dragged, 'crate_1').position).toEqual(c.position);
    // Z on the slope's contour: still on the ground.
    const north = applyCommand(doc, cmd(transformCommand(doc, sel, { set: { id: 'crate_1', axis: 2, value: 6 } })));
    expect(ent(north, 'crate_1').position[1]).toBe(settledPropY(t, ent(north, 'crate_1') as PropEntity));
    // Height typed: exactly that height, not bedded again.
    const up = applyCommand(doc, cmd(transformCommand(doc, sel, { set: { id: 'crate_1', axis: 1, value: 2.5 } })));
    expect(ent(up, 'crate_1').position).toEqual([0, 2.5, 0]);
  });

  it('typing X on a moving build moves the mover with its blocks and props', () => {
    const doc = buildMap();
    const sel = wholeSelection(doc, things(['mover_1']));
    expect(new Set(sel.entities)).toEqual(new Set(['mover_1', 'lift_1', 'crate_1']));
    const after = applyCommand(doc, cmd(transformCommand(doc, sel, { set: { id: 'mover_1', axis: 0, value: 5 } })));
    expect(ent(after, 'mover_1').position).toEqual([5, 0, 1]);
    expect(ent(after, 'lift_1').position).toEqual([5, 0, 1]);
    expect(ent(after, 'crate_1').position).toEqual([5, 0.3, 1]);
    // Its route is offsets from the mover: unchanged.
    expect((ent(after, 'mover_1') as Extract<MapEntity, { kind: 'mover' }>).points).toEqual([[0, 0, 0], [0, 1.5, 0]]);
    // Alt-picked, a part alone moves alone.
    const part = applyCommand(doc, cmd(transformCommand(doc, wholeSelection(doc, things(['lift_1']), { single: true }), { set: { id: 'lift_1', axis: 2, value: 4 } })));
    expect(ent(part, 'lift_1').position).toEqual([-1, 0, 4]);
    expect(ent(part, 'mover_1').position).toEqual([-1, 0, 1]);
  });

  it('the Facing field turns a whole moving build about its mover, as R and the ring do', () => {
    const doc = buildMap();
    const sel = wholeSelection(doc, things(['mover_1']));
    const after = applyCommand(doc, cmd(transformCommand(doc, sel, { face: { id: 'mover_1', deg: 90 } })));
    expect(yaw(after, 'mover_1')).toBeCloseTo(Math.PI / 2, 3);
    expect(yaw(after, 'lift_1')).toBeCloseTo(Math.PI / 2, 3);
    expect(yaw(after, 'crate_1')).toBeCloseTo(Math.PI / 2, 3);
    const ring = applyCommand(doc, cmd(transformCommand(doc, sel, { turn: Math.PI / 2 })));
    expect(ring.entities).toEqual(after.entities);
    expect(transformCommand(after, sel, { face: { id: 'mover_1', deg: 90 } })).toEqual({ error: 'already facing 90°' });
  });

  it('tiles and set pieces move by whole cells through the layout check, carrying what is selected with them', () => {
    const doc = buildMap();
    const sel: Selection = { tiles: ['room_b'], entities: ['lift_1'] };
    // Into the other room: refused, with the layout check's reason.
    expect(transformCommand(doc, sel, { set: { id: 'room_b', axis: 0, value: 0 } })).toEqual({ error: expect.stringMatching(/overlaps/) });
    const after = applyCommand(doc, cmd(transformCommand(doc, sel, { set: { id: 'room_b', axis: 1, value: 2.4 } })));
    const room = after.classicStructure.tiles.find((t) => t.id === 'room_b')!;
    expect([room.x, room.y, room.z]).toEqual([1, 2, 0]);
    expect(ent(after, 'lift_1').position).toEqual([-1, 0, 17]);
    // A level up: the block rises a level's height.
    const up = applyCommand(doc, cmd(transformCommand(doc, sel, { by: { cells: [0, 0, 1] } })));
    expect(ent(up, 'lift_1').position).toEqual([-1, 4, 1]);
    // Metres that aren't whole cells can't move a tile.
    expect(transformCommand(doc, sel, { by: { metres: [3, 0, 0] } })).toEqual({ error: 'tiles and set pieces move by whole cells' });
    expect(transformCommand(doc, sel, { by: { metres: [8, 0, 0] } })).not.toHaveProperty('error');
  });

  it('a field of a thing outside the selection acts on that thing alone; no change is no command', () => {
    const doc = buildMap();
    const after = applyCommand(doc, cmd(transformCommand(doc, things(['lift_1']), { set: { id: 'crate_1', axis: 0, value: 0 } })));
    expect(ent(after, 'crate_1').position[0]).toBe(0);
    expect(ent(after, 'lift_1').position[0]).toBe(-1);
    expect(transformCommand(doc, things(['lift_1']), { set: { id: 'lift_1', axis: 0, value: -1.0001 } })).toEqual({ error: 'no move' });
    expect(transformCommand(doc, things(['lift_1']), { by: { metres: [0, 0, 0] } })).toEqual({ error: 'no move' });
    expect(transformCommand(doc, things(['lift_1']), { set: { id: 'nope', axis: 0, value: 1 } })).toEqual({ error: 'it is not in the map' });
  });

  it('is one undo step each, and undo puts everything back', () => {
    const doc = buildMap();
    const h = new EditHistory(doc);
    const sel = wholeSelection(doc, things(['lift_1']));
    h.execute('Move', cmd(transformCommand(h.doc, sel, { set: { id: 'mover_1', axis: 2, value: 9 } })));
    h.execute('Turn', cmd(transformCommand(h.doc, sel, { turn: Math.PI })));
    h.execute('Move', cmd(transformCommand(h.doc, sel, { by: { cells: [1, 0, 0] } })));
    expect(h.revision).toBe(3);
    h.undo();
    h.undo();
    expect(ent(h.doc, 'crate_1').position).toEqual([-1, 0.3, 9]);
    h.undo();
    expect(h.doc).toEqual(doc);
  });
});

describe('the one selection (MapMaker UI spec Phase 2)', () => {
  it('a pick from anywhere is made whole: moving builds and groups; Alt keeps the one; locks leave things out', () => {
    const doc: MapDocument = { ...buildMap(), groups: [{ id: 'g_1', members: ['crate_1', 'room_b'] }] } as MapDocument;
    const w = wholeSelection(doc, things(['lift_1']));
    expect(w.tiles).toEqual(['room_b']);
    expect(new Set(w.entities)).toEqual(new Set(['lift_1', 'mover_1', 'crate_1']));
    expect(w.entities[0]).toBe('lift_1');
    expect(wholeSelection(doc, things(['lift_1']), { single: true })).toEqual(things(['lift_1']));
    expect(wholeSelection(doc, things(['lift_1']), { blocked: new Set(['room_b']) }).tiles).toEqual([]);
    // A pick touching nothing whole comes back as it was.
    const spawn = doc.entities.find((e) => e.kind === 'spawn')!.id;
    const alone = things([spawn]);
    expect(wholeSelection(doc, alone)).toBe(alone);
  });

  it('an edit drops only the ids the map no longer has, and keeps the same selection when none went', () => {
    const doc = buildMap();
    const sel: Selection = { tiles: ['room_a'], entities: ['lift_1', 'crate_1'] };
    expect(pruneSelection(doc, sel)).toBe(sel);
    const gone = { ...doc, entities: doc.entities.filter((e) => e.id !== 'crate_1') };
    expect(pruneSelection(gone, sel)).toEqual({ tiles: ['room_a'], entities: ['lift_1'] });
    expect(sameSelection(sel, { tiles: ['room_a'], entities: ['lift_1', 'crate_1'] })).toBe(true);
    expect(sameSelection(sel, { tiles: ['room_a'], entities: ['crate_1', 'lift_1'] })).toBe(false);
  });
});
