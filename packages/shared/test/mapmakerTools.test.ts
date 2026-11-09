import { describe, expect, it } from 'vitest';
import {
  EditHistory,
  allowedScale,
  applyCommand,
  blockBoxes,
  buildMapGeometry,
  describeSegment,
  facingOf,
  jumpReach,
  jumpVerdict,
  measurePath,
  measureSegment,
  newMapDocument,
  newTerrain,
  placeTileCommand,
  PLAYER,
  PLAYER_JUMP,
  PROP_RANDOM_DEFAULTS,
  propBoxes,
  propDrop,
  restUnder,
  ringStep,
  rollProp,
  setFacingCommand,
  snapMeasurePoint,
  snapTurn,
  surfaceHit,
  terrainHeightAt,
  turnByCommand,
  turnLabel,
  yawToward,
  type MapDocument,
  type MapEntity,
  type WorldBox,
} from '../src/index.ts';

/** A map with the start room, a table in it, a room on Level 1 over the next cell (its floor: the roof below), and a block. */
function scene(): { doc: MapDocument; boxes: WorldBox[] } {
  let doc = newMapDocument('tools');
  const up = placeTileCommand(doc, 'core.room', 1, 0, 1, 0);
  if ('error' in up) throw new Error(up.error);
  doc = applyCommand(doc, up.command);
  const table: MapEntity = { id: 'table1', kind: 'prop', position: [0, 0, 0], model: 'prop.table', yaw: 0, scale: 1, solid: true, tint: null };
  doc = applyCommand(doc, { kind: 'addEntities', entities: [table] });
  const boxes = [...buildMapGeometry(doc), ...blockBoxes(doc), ...propBoxes(doc), ...propBoxes(doc, true)];
  return { doc, boxes };
}
const down = { x: 0, y: -1, z: 0 };

describe('MapMaker measure tool (overhaul Phase 1 item 3)', () => {
  it('measures distance, height difference and slope', () => {
    const s = measureSegment({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 4 });
    expect(s.run).toBeCloseTo(5);
    expect(s.rise).toBeCloseTo(4);
    expect(s.distance).toBeCloseTo(Math.hypot(5, 4));
    expect(s.slopeDeg).toBeCloseTo((Math.atan2(4, 5) * 180) / Math.PI);
    expect(s.slopePct).toBeCloseTo(80);
    const flat = measureSegment({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 10 });
    expect([flat.distance, flat.rise, flat.slopeDeg, flat.slopePct]).toEqual([10, 0, 0, 0]);
    const wall = measureSegment({ x: 2, y: 0, z: 2 }, { x: 2, y: 3, z: 2 });
    expect(wall.slopeDeg).toBeCloseTo(90);
    expect(wall.slopePct).toBeNull();
    const downhill = measureSegment({ x: 0, y: 2, z: 0 }, { x: 4, y: 0, z: 0 });
    expect(downhill.rise).toBe(-2);
    expect(downhill.slopePct).toBeCloseTo(-50);
    expect(describeSegment(s)).toMatch(/^6\.40 m · up 4\.00 m · 38\.7° \(80 %\) · too high/);
  });

  it('chains a path and totals it', () => {
    const m = measurePath([
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 0, z: 4 },
      { x: 3, y: 0, z: 10 },
    ]);
    expect(m.segments).toHaveLength(2);
    expect(m.total).toBeCloseTo(11);
    expect(measurePath([{ x: 0, y: 0, z: 0 }]).total).toBe(0);
  });

  it('says what a player could jump, from the movement numbers', () => {
    expect(PLAYER_JUMP.height).toBeCloseTo((PLAYER.jumpSpeed * PLAYER.jumpSpeed) / (2 * PLAYER.gravity));
    expect(jumpVerdict(1, 0.25).step).toBe('walk');
    expect(jumpVerdict(1, 1).step).toBe('jumpable');
    expect(jumpVerdict(1, PLAYER_JUMP.height + 0.05)).toEqual({ step: 'too high', gap: null, reach: null });
    expect(jumpVerdict(1, -3).step).toBe('drop');
    // A level gap: a sprinting jump's flight (2v/g) at sprint speed, plus a body's half width.
    const level = jumpReach(0)!;
    expect(level).toBeCloseTo(PLAYER_JUMP.speed * ((2 * PLAYER.jumpSpeed) / PLAYER.gravity) + PLAYER.radius);
    expect(jumpVerdict(level - 0.1, 0).gap).toBe('jumpable');
    expect(jumpVerdict(level + 0.1, 0).gap).toBe('too far');
    // Higher up, a jump carries you less far; lower down, further.
    expect(jumpReach(1)!).toBeLessThan(level);
    expect(jumpReach(-2)!).toBeGreaterThan(level);
  });

  it('snaps to cells, surfaces and objects\' tops; free with Ctrl or Alt', () => {
    const { boxes } = scene();
    // Onto the floor at (1.3, 0, 2.2): the 0.5 m grid, on the floor's top.
    const floor = surfaceHit({ x: 1.3, y: 10, z: 2.2 }, down, boxes, null)!;
    expect(floor.on).toBe('top');
    expect(snapMeasurePoint(floor, boxes, null, 0.5, false).at).toEqual({ x: 1.5, y: 0, z: 2 });
    expect(snapMeasurePoint(floor, boxes, null, 0.5, true)).toEqual({ at: { x: 1.3, y: 0, z: 2.2 }, snapped: 'free' });
    // The table's top: its middle, at its height.
    const top = surfaceHit({ x: 0.6, y: 10, z: 0.3 }, down, boxes, null)!;
    expect(top.box?.sourceId).toBe('table1');
    expect(snapMeasurePoint(top, boxes, null, 0.5, false, (id) => id === 'table1')).toEqual({ at: { x: 0, y: 0.8, z: 0 }, snapped: 'object' });
    // The ground, on terrain: the snapped spot's own height.
    const t = newTerrain(64, 2, [40, 0]);
    t.heights = t.heights.map((_, i) => (i % t.cols) * 0.25);
    const g = surfaceHit({ x: 40.3, y: 50, z: 0.2 }, down, [], t)!;
    expect(g.on).toBe('ground');
    const p = snapMeasurePoint(g, [], t, 0.5, false).at;
    expect([p.x, p.z]).toEqual([40.5, 0]);
    expect(p.y).toBeCloseTo(terrainHeightAt(t, 40.5, 0)!);
  });

  describe('the jump hint samples the ground along the line (owner, 2026-11-08)', () => {
    const slab = (id: string, x0: number, x1: number, top: number, bottom = top - 0.5): WorldBox => ({ id, sourceId: id, kind: 'floor', min: [x0, bottom, -4], max: [x1, top, 4] }) as unknown as WorldBox;
    const on = (boxes: WorldBox[], ground: ReturnType<typeof newTerrain> | null = null) => ({ boxes, ground });
    const at = (x: number, y: number) => ({ x, y, z: 0 });

    it('a ramp you walk up reads walkable (the two ends alone read too high)', () => {
      // A 30° ramp of ground (under the 50° a player walks up), 10 m long: 5.8 m up.
      const t = newTerrain(40, 1);
      const rise = Math.tan(Math.PI / 6);
      t.heights = t.heights.map((_, i) => Math.round(Math.max(0, (i % t.cols) - 15) * rise * 100));
      const a = at(-5, terrainHeightAt(t, -5, 0)!);
      const b = at(5, terrainHeightAt(t, 5, 0)!);
      expect(b.y - a.y).toBeGreaterThan(5);
      expect(measureSegment(a, b).verdict.step).toBe('too high');
      const s = measureSegment(a, b, on([], t));
      expect(s.verdict).toMatchObject({ step: 'walk', gap: null, sampled: { step: 0, gap: null } });
      expect(describeSegment(s)).toMatch(/step walkable · no gap$/);
      // A stair (0.25 m risers on 0.3 m treads) is walkable too.
      const stair = Array.from({ length: 12 }, (_, k) => slab(`st${k}`, k * 0.3, 10, (k + 1) * 0.25, -1));
      expect(measureSegment(at(-1, 0), at(4.5, 3), on([slab('f', -5, 0, 0), ...stair])).verdict.step).toBe('walk');
    });

    it('a ledge reads a step, by its height', () => {
      const floor = slab('floor', -10, 10, 0);
      const ledge = slab('ledge', 2, 10, 1, -1);
      const s = measureSegment(at(-4, 0), at(6, 1), on([floor, ledge]));
      expect(s.verdict).toMatchObject({ step: 'jumpable', gap: null, sampled: { step: 1, gap: null } });
      expect(describeSegment(s)).toMatch(/step 1\.00 m jumpable · no gap$/);
      // A wall's top higher than a jump: too high, even with both ends level (on the far side of it).
      const wall = slab('wall', 0, 0.5, 1.2 + PLAYER_JUMP.height, -1);
      const over = measureSegment(at(-4, 0), at(4, 1.2), on([floor, wall]));
      expect(over.verdict.step).toBe('too high');
      // Down off the ledge: a drop, no step.
      expect(measureSegment(at(6, 1), at(-4, 0), on([floor, ledge])).verdict).toMatchObject({ step: 'drop', gap: null });
    });

    it('a pit reads a gap: jumpable within a sprinting jump, too far past it', () => {
      const near = slab('near', -10, 0, 0);
      const far = (w: number) => slab('far', w, w + 10, 0);
      const level = jumpReach(0)!;
      const narrow = measureSegment(at(-4, 0), at(7, 0), on([near, far(3)]));
      expect(narrow.verdict).toMatchObject({ step: 'walk', gap: 'jumpable', sampled: { step: 0, gap: 3 } });
      expect(narrow.verdict.reach).toBeCloseTo(level);
      expect(describeSegment(narrow)).toMatch(/step walkable · gap 3\.00 m jumpable \(5\.86 m at most\)$/);
      const wide = measureSegment(at(-4, 0), at(12, 0), on([near, far(8)]));
      expect(wide.verdict).toMatchObject({ gap: 'too far', sampled: { gap: 8 } });
      // A pit with a floor too deep to climb out of is a gap too; a shallow ditch is a drop and a step, not a gap.
      const deep = measureSegment(at(-4, 0), at(7, 0), on([near, far(3), slab('bottom', -1, 4, -4)]));
      expect(deep.verdict).toMatchObject({ gap: 'jumpable', sampled: { gap: 3 } });
      const ditch = measureSegment(at(-4, 0), at(14, 0), on([near, far(8), slab('bottom', -1, 9, -1)]));
      expect(ditch.verdict).toMatchObject({ step: 'jumpable', gap: null, sampled: { step: 1, gap: null } });
      // Higher on the far side: a jump carries you less far.
      const up = measureSegment(at(-4, 0), at(8, 1), on([near, slab('far', 4, 14, 1)]));
      expect(up.verdict).toMatchObject({ step: 'jumpable', gap: 'jumpable', sampled: { step: 1, gap: 4 } });
      expect(up.verdict.reach).toBeCloseTo(jumpReach(1)!);
    });
  });
});

describe('MapMaker props snap to surfaces (overhaul Phase 1 item 4)', () => {
  const crate = { model: 'prop.crate_small', yaw: 0, scale: 1 };
  it('lands on a tabletop', () => {
    const { boxes } = scene();
    const d = propDrop({ x: 0.4, y: 5, z: 0.2 }, down, boxes, null, crate)!;
    expect(d.on).toBe('top');
    expect(d.sourceId).toBe('table1');
    expect(d.position).toEqual([0.4, 0.8, 0.2]);
  });

  it('lands on a roof (the floor of the room above)', () => {
    const { boxes } = scene();
    const d = propDrop({ x: 9, y: 20, z: 1 }, down, boxes, null, crate)!;
    expect(d.on).toBe('top');
    expect(d.position[1]).toBe(4);
  });

  it('lands on the ground, bedded into the slope', () => {
    const t = newTerrain(64, 2, [40, 0]);
    t.heights = t.heights.map((_, i) => (i % t.cols) * 0.25);
    const d = propDrop({ x: 41, y: 50, z: 3 }, down, [], t, crate)!;
    expect(d.on).toBe('ground');
    // Bedded: at or a hair under the lowest ground under its footprint.
    expect(d.position[1]).toBeLessThan(terrainHeightAt(t, 41, 3)!);
    expect(d.position[1]).toBeGreaterThan(terrainHeightAt(t, 41, 3)! - 0.5);
    // On the floor, where the floor is over the ground.
    const { boxes } = scene();
    const flat = newTerrain(64, 2, [0, 0]);
    flat.heights = flat.heights.map(() => -1);
    expect(propDrop({ x: -2, y: 5, z: -2 }, down, boxes, flat, crate)!.position).toEqual([-2, 0, -2]);
  });

  it('dropped against a wall, stands at its foot; snapped off the table\'s edge, on the floor beside it', () => {
    const { boxes } = scene();
    // Looking east at the room's east wall (x 3.5 to 4), at waist height.
    const d = propDrop({ x: 0, y: 1, z: 2 }, { x: 1, y: 0, z: 0 }, boxes, null, crate)!;
    expect(d.hit.on).toBe('side');
    expect(d.position[0]).toBeLessThan(3.5);
    expect(d.position[1]).toBe(0);
    // The table's edge is at x = 1.03: the 0.5 m snap puts the crate at 1.5, on the floor.
    const off = propDrop({ x: 1.0, y: 5, z: 0 }, down, boxes, null, crate, (v) => Math.round(v * 2) / 2)!;
    expect(off.position).toEqual([1, 0.8, 0]);
    const beyond = propDrop({ x: 1.02, y: 5, z: 0 }, down, boxes, null, crate, (v) => Math.round(v / 2) * 2)!;
    expect(beyond.position).toEqual([2, 0, 0]);
  });

  it('restUnder: the highest top under a point, or the ground', () => {
    const { boxes } = scene();
    expect(restUnder(boxes, null, 0, 0, 3)).toEqual({ y: 0.8, on: 'top', sourceId: 'table1' });
    expect(restUnder(boxes, null, 0, 0, 0.5)?.y).toBe(0);
    expect(restUnder([], null, 0, 0, 3)).toBeNull();
  });
});

describe('MapMaker randomise (overhaul Phase 1 item 4)', () => {
  const on = { ...PROP_RANDOM_DEFAULTS, on: true };
  it('is off by default, and off places plainly', () => {
    expect(PROP_RANDOM_DEFAULTS.on).toBe(false);
    expect(rollProp('prop.barrel', 0.5, PROP_RANDOM_DEFAULTS, 1, 0)).toEqual({ yaw: 0.5, scale: 1, variant: undefined });
  });
  it('is seeded: the same seed and roll give the same placement, the next roll another', () => {
    const a = rollProp('prop.barrel', 0, on, 7, 3);
    expect(rollProp('prop.barrel', 0, on, 7, 3)).toEqual(a);
    expect(rollProp('prop.barrel', 0, on, 7, 4)).not.toEqual(a);
    expect(rollProp('prop.barrel', 0, on, 8, 3)).not.toEqual(a);
  });
  it('keeps the turn and size in range, and the prop\'s allowed scale', () => {
    for (let n = 0; n < 200; n++) {
      const r = rollProp('prop.barrel', 0, { ...on, turn: 15, size: 0.1 }, 42, n);
      expect(Math.abs(r.yaw)).toBeLessThanOrEqual((15 * Math.PI) / 180 + 1e-3);
      expect(r.scale).toBeGreaterThanOrEqual(0.9);
      expect(r.scale).toBeLessThanOrEqual(1.1);
      expect(r.variant).toBeUndefined();
    }
    // A species keeps to its own range (Angular Boulder: 0.6 to 1.6), even asked for ±30 %… within the range.
    const [lo, hi] = allowedScale('env.rock.boulder_angular');
    expect([lo, hi]).toEqual([0.6, 1.6]);
    const fern = allowedScale('env.fern.bracken');
    for (let n = 0; n < 100; n++) {
      const r = rollProp('env.fern.bracken', 0, { ...on, size: 0.3 }, 1, n);
      expect(r.scale).toBeGreaterThanOrEqual(fern[0]);
      expect(r.scale).toBeLessThanOrEqual(fern[1]);
    }
    expect(allowedScale('prop.barrel')).toEqual([0.25, 4]);
  });
  it('picks a variant where the prop has them', () => {
    const seen = new Set<number | undefined>();
    for (let n = 0; n < 60; n++) seen.add(rollProp('env.flower.meadow', 0, on, 3, n).variant);
    expect(seen.size).toBe(4);
    expect(seen.has(undefined)).toBe(true);
    const none = new Set<number | undefined>();
    for (let n = 0; n < 30; n++) none.add(rollProp('env.flower.meadow', 0, { ...on, variant: false }, 3, n).variant);
    expect([...none]).toEqual([undefined]);
  });
});

describe('MapMaker turning by mouse (overhaul Phase 3 item 9)', () => {
  const spot = (doc: MapDocument, e: MapEntity) => applyCommand(doc, { kind: 'addEntities', entities: [e] });
  it('snaps a drag by the selected thing\'s own step', () => {
    let doc = newMapDocument('turn');
    doc = spot(doc, { id: 'sp', kind: 'spawn', position: [0, 0, 0], yaw: 0, faction: null });
    doc = spot(doc, { id: 'pr', kind: 'prop', position: [2, 0, 0], model: 'prop.barrel', yaw: 0, scale: 1, solid: true, tint: null });
    const deg = (d: number) => (d * Math.PI) / 180;
    expect(ringStep(doc, { tiles: [], entities: ['sp'] })).toBeCloseTo(deg(45));
    expect(ringStep(doc, { tiles: [], entities: ['sp'] }, true)).toBeCloseTo(deg(15));
    expect(ringStep(doc, { tiles: [], entities: ['pr'] })).toBeCloseTo(deg(15));
    expect(ringStep(doc, { tiles: [], entities: ['pr'] }, true)).toBeCloseTo(deg(5));
    expect(ringStep(doc, { tiles: [], entities: ['sp', 'pr'] })).toBeCloseTo(deg(45));
    // Tiles stay on quarter turns, Shift or not.
    expect(ringStep(doc, { tiles: [doc.classicStructure.tiles[0]!.id], entities: [] }, true)).toBeCloseTo(deg(90));
    expect(ringStep(doc, { tiles: [], entities: [], setPieces: ['x'] }, true)).toBeCloseTo(deg(90));
    expect(snapTurn(deg(52), deg(45))).toBeCloseTo(deg(45));
    expect(snapTurn(deg(70), deg(45))).toBeCloseTo(deg(90));
    expect(snapTurn(deg(-200), deg(90))).toBeCloseTo(deg(180));
    expect(snapTurn(deg(7), deg(15))).toBe(0);
    expect(turnLabel(deg(-90))).toBe('-90°');
    expect(turnLabel(deg(45))).toBe('+45°');
    // The ring's angle: 0 along +Z, a quarter turn along +X, as yaw.
    expect(yawToward({ x: 0, z: 0 }, { x: 0, z: 5 })).toBe(0);
    expect(yawToward({ x: 0, z: 0 }, { x: 3, z: 0 })).toBeCloseTo(deg(90));
  });

  it('a drag is one undo step, about the selection\'s centre; tiles keep to quarter turns', () => {
    let doc = newMapDocument('turn');
    doc = spot(doc, { id: 'a', kind: 'prop', position: [2, 0, 0], model: 'prop.barrel', yaw: 0, scale: 1, solid: true, tint: null });
    doc = spot(doc, { id: 'b', kind: 'prop', position: [-2, 0, 0], model: 'prop.barrel', yaw: 0, scale: 1, solid: true, tint: null });
    const h = new EditHistory(doc);
    const cmd = turnByCommand(h.doc, { tiles: [], entities: ['a', 'b'] }, Math.PI / 4);
    if ('error' in cmd) throw new Error(cmd.error);
    h.execute('Turn', cmd);
    const a = h.doc.entities.find((e) => e.id === 'a')!;
    expect(a.position[0]).toBeCloseTo(Math.SQRT2);
    expect(a.position[2]).toBeCloseTo(-Math.SQRT2);
    expect((a as { yaw: number }).yaw).toBeCloseTo(Math.PI / 4, 3);
    h.undo();
    expect(h.doc).toEqual(doc);
    const tile = doc.classicStructure.tiles[0]!.id;
    expect(turnByCommand(doc, { tiles: [tile], entities: [] }, Math.PI / 4)).toEqual({ error: 'tiles, set pieces, zones and liquids turn in quarter turns' });
    const q = turnByCommand(doc, { tiles: [tile], entities: [] }, Math.PI / 2);
    if ('error' in q) throw new Error(q.error);
    expect(applyCommand(doc, q).classicStructure.tiles[0]!.rotation).toBe(1);
    expect(turnByCommand(doc, { tiles: [], entities: ['a'] }, 0)).toEqual({ error: 'no turn' });
  });

  it('quick facings set the facing in one step, for anything with one', () => {
    let doc = newMapDocument('turn');
    doc = spot(doc, { id: 'sp', kind: 'spawn', position: [1, 0, 1], yaw: 0.3, faction: null });
    const h = new EditHistory(doc);
    const to180 = setFacingCommand(h.doc, { tiles: [], entities: ['sp'] }, 180);
    if ('error' in to180) throw new Error(to180.error);
    h.execute('Face 180°', to180);
    expect(Math.abs(facingOf(h.doc, { tiles: [], entities: ['sp'] })!)).toBeCloseTo(Math.PI, 2);
    expect(h.doc.entities.find((e) => e.id === 'sp')!.position).toEqual([1, 0, 1]);
    h.undo();
    expect(h.doc).toEqual(doc);
    const tile = doc.classicStructure.tiles[0]!.id;
    const t270 = setFacingCommand(doc, { tiles: [tile], entities: [] }, 270);
    if ('error' in t270) throw new Error(t270.error);
    expect(applyCommand(doc, t270).classicStructure.tiles[0]!.rotation).toBe(3);
    expect(setFacingCommand(doc, { tiles: [tile], entities: [] }, 0)).toEqual({ error: 'already facing 0°' });
    expect(setFacingCommand(doc, { tiles: [], entities: [] }, 90)).toEqual({ error: 'select one thing with a facing' });
  });
});
