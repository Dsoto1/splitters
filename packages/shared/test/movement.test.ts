import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_JUMP, PhysicsWorld, buildMapGeometry, emptyInput, initPhysics, stepMovement, type MoveState, type PlayerInput } from '../src/index.ts';
import { loadArena, makeMap } from './helpers.ts';

beforeAll(() => initPhysics());

function run(physics: PhysicsWorld, state: MoveState, input: Partial<PlayerInput>, ticks: number): MoveState {
  const collider = physics.createPlayerCollider();
  let s = state;
  for (let i = 0; i < ticks; i++) s = stepMovement(physics, collider, s, { ...emptyInput(i), ...input });
  physics.removeCollider(collider);
  return s;
}

describe('player movement', () => {
  const singleRoom = () => new PhysicsWorld(buildMapGeometry(makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }])));

  it('falls onto the floor and becomes grounded', () => {
    const s = run(singleRoom(), { pos: { x: 0, y: 2, z: 0 }, velY: 0, grounded: false }, {}, 90);
    expect(s.grounded).toBe(true);
    expect(s.pos.y).toBeGreaterThan(-0.01);
    expect(s.pos.y).toBeLessThan(0.1);
  });

  it('runs at full speed and is stopped by walls', () => {
    const physics = singleRoom();
    const start: MoveState = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
    const quarterSecond = run(physics, start, { forward: 1 }, 15);
    expect(quarterSecond.pos.z).toBeCloseTo(7 * 0.25, 2);
    const blocked = run(physics, start, { forward: 1 }, 120);
    expect(blocked.pos.z).toBeLessThan(3.5 - 0.39); // wall inner face at 3.5, capsule radius 0.4
    expect(blocked.pos.z).toBeGreaterThan(3.0);
  });

  it('jumps and lands', () => {
    const physics = singleRoom();
    let s: MoveState = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
    s = run(physics, s, { buttons: BUTTON_JUMP }, 1);
    expect(s.grounded).toBe(false);
    const peak = run(physics, s, {}, 20);
    expect(peak.pos.y).toBeGreaterThan(1);
    expect(run(physics, peak, {}, 60).grounded).toBe(true);
  });

  it('climbs the arena stairs to the upper level', () => {
    const physics = new PhysicsWorld(buildMapGeometry(loadArena()));
    // Room NW (0,16) -> east through the doorway onto the stairs (8,16) -> upper room (16,16,y=4).
    let s: MoveState = { pos: { x: 0, y: 0, z: 16 }, velY: 0, grounded: true };
    s = run(physics, s, { forward: 1, yaw: Math.PI / 2 }, 200);
    expect(s.pos.x).toBeGreaterThan(12.5);
    expect(s.pos.y).toBeCloseTo(4, 1);
  });

  it('is deterministic: replaying the same inputs gives identical states', () => {
    const physics = new PhysicsWorld(buildMapGeometry(loadArena()));
    const inputs = Array.from({ length: 240 }, (_, i) => ({ ...emptyInput(i), forward: 1, right: Math.sin(i / 20), yaw: i / 50, buttons: i % 37 === 0 ? BUTTON_JUMP : 0 }));
    const collider = physics.createPlayerCollider();
    const play = () => inputs.reduce<MoveState>((s, inp) => stepMovement(physics, collider, s, inp), { pos: { x: 8, y: 0, z: 8 }, velY: 0, grounded: true });
    expect(play()).toEqual(play());
  });
});
