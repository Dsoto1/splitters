import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_JUMP, BUTTON_USE, ScenarioBodies, TICK_RATE, blockBoxes, dynamicBlockIds, emptyInput, gravityAt, initPhysics, mapGravityZones, mapPads, newScenarioEntities, padLandings, PhysicsWorld, buildMapGeometry, stepMovement, validateMap, type MapEntity, type MoveState } from '../src/index.ts';
import { initNavigation } from '../src/match.ts';
import { EAST, act, block, button, codes, loaded, rule, start, twoRooms } from './kit20.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** A zone entity (Style Packs: low gravity when `gravity` is set). */
const zone = (id: string, position: [number, number, number], size: [number, number, number], gravity?: number): MapEntity => ({ id, kind: 'zone', position, size, who: 'any', count: 1, startEnabled: true, ...(gravity !== undefined ? { gravity } : {}) });

/** Jump straight up from where the driver stands and return the highest the feet got. */
function jumpPeak(d: ReturnType<typeof start>, x: number, z: number): number {
  d.place(x, 0, z);
  d.run(3);
  d.input({ buttons: BUTTON_JUMP });
  let peak = d.me.move.pos.y;
  for (let i = 0; i < TICK_RATE * 4 && !(d.me.move.grounded && i > 5); i++) {
    d.input();
    peak = Math.max(peak, d.me.move.pos.y);
  }
  return peak;
}

describe('low-gravity zones', () => {
  it('jumps go about 1 / factor higher inside the zone, and the same code predicts it exactly', () => {
    // Zone over the east room only.
    const map = twoRooms([zone('zone_lowg', [8, 0, 0], [7, 8, 7], 0.35)]);
    expect(codes(validateMap(loaded(map)))).toEqual([]);
    const d = start(map);
    const outside = jumpPeak(d, -1, 0);
    const inside = jumpPeak(d, 8, 0);
    expect(outside).toBeGreaterThan(0.6);
    expect(inside / outside).toBeGreaterThan(2.4);
    expect(inside / outside).toBeLessThan(3.4);

    // Client prediction runs stepMovement with the same zones: replaying the jump reproduces the server's arc.
    const doc = loaded(map);
    const physics = new PhysicsWorld(buildMapGeometry(doc));
    const collider = physics.createPlayerCollider();
    const zones = mapGravityZones(doc.entities);
    expect(zones).toHaveLength(1);
    let s: MoveState = { pos: { x: 8, y: 0, z: 0 }, velY: 0, grounded: true };
    for (let t = 0; t < 3; t++) s = stepMovement(physics, collider, s, emptyInput(t), 1, undefined, 1, { gravityZones: zones });
    s = stepMovement(physics, collider, s, { ...emptyInput(3), buttons: BUTTON_JUMP }, 1, undefined, 1, { gravityZones: zones });
    let peak = s.pos.y;
    for (let t = 4; t < TICK_RATE * 4; t++) {
      s = stepMovement(physics, collider, s, emptyInput(t), 1, undefined, 1, { gravityZones: zones });
      peak = Math.max(peak, s.pos.y);
    }
    expect(peak).toBeCloseTo(inside, 5);
  });

  it('reads the factor where the body is, takes the weakest of overlapping zones and ignores factor-1 zones', () => {
    const zones = mapGravityZones([zone('zone_a', [0, 0, 0], [4, 4, 4], 0.5), zone('zone_b', [1, 0, 0], [4, 4, 4], 0.25), zone('zone_c', [20, 0, 0], [4, 4, 4], 1), zone('zone_d', [30, 0, 0], [4, 4, 4])]);
    expect(zones).toHaveLength(2);
    expect(gravityAt(zones, { x: -1.5, y: 0, z: 0 })).toBe(0.5);
    expect(gravityAt(zones, { x: 0.5, y: 0, z: 0 })).toBe(0.25);
    expect(gravityAt(zones, { x: 0, y: 5, z: 0 })).toBe(1);
    expect(gravityAt(zones, { x: 20, y: 0, z: 0 })).toBe(1);
  });

  it('jump-pad flights through a zone carry further, and bots are given that landing', () => {
    const pad: MapEntity = { id: 'pad_1', kind: 'pad', position: [-2, 0, 0], yaw: EAST, power: 9, push: 3 };
    const plain = loaded(twoRooms([pad]));
    const floaty = loaded(twoRooms([pad, zone('zone_lowg', [4, 0, 0], [15, 8, 7], 0.4)]));
    const reach = (doc: typeof plain) => {
      const physics = new PhysicsWorld(buildMapGeometry(doc));
      const [link] = padLandings(mapPads(doc.entities), physics, 1, mapGravityZones(doc.entities));
      return link!.end.x;
    };
    expect(reach(floaty)).toBeGreaterThan(reach(plain) + 1.2);
  });

  it('the palette places an 8 m low-gravity zone', () => {
    const [z] = newScenarioEntities('zone:lowgrav', [0, 0, 0], 0);
    expect(z).toMatchObject({ kind: 'zone', gravity: 0.35, size: [8, 8, 8] });
  });
});

describe('force fields', () => {
  /** A field across the doorway between the two rooms (x = 4), switched by the button. */
  const fieldMap = () =>
    twoRooms([block('field_door', [4, 0, 0], { size: [3, 3, 0.2], yaw: EAST, field: true, tint: '#5ad8ff', trigger: 'logic', respawnSeconds: null }), button('button_1', [-2, 0, -3])], {
      rules: [rule({ when: { event: 'button_pressed', target: 'button_1' }, do: [act('block_drop', { target: 'field_door' }), act('wait', { value: 3 }), act('block_restore', { target: 'field_door' })] })],
    });

  it('is a dynamic block the navmesh sees, and validates clean', () => {
    const doc = loaded(fieldMap());
    expect(codes(validateMap(doc))).toEqual([]);
    expect(dynamicBlockIds(doc).has('field_door')).toBe(true);
    expect(blockBoxes(doc).map((b) => b.sourceId)).not.toContain('field_door');
    expect(blockBoxes(doc, true).map((b) => b.sourceId)).toContain('field_door');
  });

  it('stops players but not rays (shots, sight)', () => {
    const doc = loaded(fieldMap());
    const physics = new PhysicsWorld(buildMapGeometry(doc));
    // The scenario's colliders, built the way the match and client prediction build them.
    new ScenarioBodies(physics, doc);
    const collider = physics.createPlayerCollider();
    const moved = physics.moveCharacter(collider, { x: 2, y: 0, z: 0 }, { x: 4, y: 0, z: 0 });
    expect(moved.feet.x).toBeLessThan(3.8);
    // A ray at chest height from the west room straight through the doorway reaches the far wall.
    const hit = physics.raycastWorld({ x: 1, y: 1.4, z: 0 }, { x: 1, y: 0, z: 0 }, 20);
    expect(hit).not.toBeNull();
    expect(hit!).toBeGreaterThan(10);
    expect(physics.lineOfSight({ x: 1, y: 1.4, z: 0 }, { x: 7, y: 1.4, z: 0 })).toBe(true);
  });

  it('logic switches it off and on in a match', () => {
    const d = start(fieldMap());
    // Walk east into it: held at the doorway.
    d.place(1, 0, 0, EAST);
    d.run(TICK_RATE, { forward: 1, yaw: EAST });
    const blockedAt = d.me.move.pos.x;
    expect(blockedAt).toBeLessThan(3.8);
    expect(blockedAt).toBeGreaterThan(2.5);
    // Press the button: the field drops for 3 s.
    d.place(-2, 0, -1.6, Math.PI);
    d.input({ yaw: Math.PI, pitch: -0.2, buttons: BUTTON_USE });
    expect(d.match.scenario.destructibleAlive('field_door')).toBe(false);
    d.place(1, 0, 0);
    d.run(TICK_RATE, { forward: 1, yaw: EAST });
    expect(d.me.move.pos.x).toBeGreaterThan(5);
    // Back on after the wait (nobody inside it).
    d.run(TICK_RATE * 3);
    expect(d.match.scenario.destructibleAlive('field_door')).toBe(true);
  });

  it('shots cannot hurt it', () => {
    const d = start(fieldMap());
    d.match.scenario.splash({ x: 4, y: 1, z: 0 }, 6, 500, 500, null, d.match.physics);
    expect(d.match.scenario.destructibleAlive('field_door')).toBe(true);
  });

  it('the palette places a doorway-sized field that only logic drops', () => {
    const [f] = newScenarioEntities('block:field', [4, 0, 0], EAST);
    expect(f).toMatchObject({ kind: 'block', behaviour: 'solid', field: true, size: [3, 3, 0.2], trigger: 'logic' });
  });
});

describe('auto doors (Style Packs: station airlocks)', () => {
  it('slide open when someone comes close and close again after they leave', () => {
    const door: MapEntity = { id: 'door_lock', kind: 'door', position: [4, 0, 0], yaw: EAST, startOpen: false, locked: false, auto: true };
    const d = start(twoRooms([door]));
    d.place(-3, 0, 0);
    d.run(TICK_RATE);
    expect(d.match.scenario.doorOpen('door_lock')).toBe(0);
    d.place(2, 0, 0);
    d.run(TICK_RATE);
    expect(d.match.scenario.doorOpen('door_lock')).toBe(1);
    // Walk through.
    d.run(TICK_RATE, { forward: 1, yaw: EAST });
    expect(d.me.move.pos.x).toBeGreaterThan(6);
    d.place(10, 0, 0);
    d.run(TICK_RATE * 4);
    expect(d.match.scenario.doorOpen('door_lock')).toBe(0);
  });
});

describe('style pack movers', () => {
  it('the elevator rides three storeys; the tram carries its roof and posts along its facing', () => {
    const lift = newScenarioEntities('mover:elevator', [0, 0, 0], 0);
    const mover = lift.at(-1)!;
    expect(mover.kind === 'mover' && mover.points[1]).toEqual([0, 12, 0]);
    const tram = newScenarioEntities('mover:tram', [0, 0, 0], EAST);
    const m = tram.at(-1)!;
    expect(m.kind).toBe('mover');
    if (m.kind !== 'mover') return;
    expect(m.blocks).toHaveLength(6);
    expect(m.points[1]![0]).toBeCloseTo(24, 5);
    expect(m.points[1]![2]).toBeCloseTo(0, 5);
  });
});

