import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_CROUCH, BUTTON_FIRE, BUTTON_JUMP, BUTTON_PRONE, BUTTON_SPRINT, PLAYER, SPRINT, STANCES, PhysicsWorld, bodyHeightOf, buildMapGeometry, emptyInput, initPhysics, mapLadders, stepMovement, type MoveEnv, type MoveState, type PlayerInput } from '../src/index.ts';
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
    expect(quarterSecond.pos.z).toBeCloseTo(PLAYER.runSpeed * 0.25, 1);
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

  it('sprints faster on stamina, runs dry, and recovers after a rest; firing stops a sprint', () => {
    const physics = singleRoom();
    const start: MoveState = { pos: { x: 0, y: 0, z: -3 }, velY: 0, grounded: true };
    const walk = run(physics, start, { forward: 1 }, 15);
    const sprint = run(physics, start, { forward: 1, buttons: BUTTON_SPRINT }, 15);
    expect(sprint.pos.z - start.pos.z).toBeCloseTo((walk.pos.z - start.pos.z) * SPRINT.speed, 1);
    expect(sprint.stamina!).toBeLessThan(1);
    const shooting = run(physics, start, { forward: 1, buttons: BUTTON_SPRINT | BUTTON_FIRE }, 15);
    expect(shooting.pos.z).toBeCloseTo(walk.pos.z, 3);
    // Sprint on the spot until empty: winded, then it comes back after a rest.
    let s = run(physics, start, { forward: 1, right: 0, yaw: Math.PI / 2, buttons: BUTTON_SPRINT }, Math.ceil(60 / SPRINT.drain) + 10);
    expect(s.winded).toBe(true);
    expect(s.sprint).toBeUndefined();
    s = run(physics, s, {}, Math.ceil(60 * (SPRINT.rest + SPRINT.restart / SPRINT.regen)) + 5);
    expect(s.winded).toBeUndefined();
    s = run(physics, s, {}, 60 * 5);
    expect(s.stamina).toBeUndefined();
  });

  it('crouches and goes prone (slower, shorter), and can only stand where there is room', () => {
    const room = buildMapGeometry(makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]));
    // A low slab 1.4 m up over the north half of the room.
    const physics = new PhysicsWorld([...room, { min: [-4, 1.4, 1], max: [4, 1.7, 4], kind: 'floor', sourceId: 'slab' }]);
    const start: MoveState = { pos: { x: 0, y: 0, z: -2 }, velY: 0, grounded: true };
    const crouched = run(physics, start, { forward: 1, buttons: BUTTON_CROUCH }, 30);
    expect(crouched.stance).toBe(1);
    expect(bodyHeightOf(crouched)).toBe(STANCES[1].height);
    const walked = run(physics, start, { forward: 1 }, 30);
    expect(crouched.pos.z - start.pos.z).toBeCloseTo((walked.pos.z - start.pos.z) * STANCES[1].speed, 1);
    const prone = run(physics, start, { buttons: BUTTON_PRONE }, 5);
    expect(prone.stance).toBe(2);
    // Getting up again leaves you standing on the floor, not sunk into it.
    const risen = run(physics, prone, {}, 20);
    expect(risen.stance).toBeUndefined();
    expect(risen.pos.y).toBeCloseTo(start.pos.y, 1);
    expect(risen.grounded).toBe(true);
    // Crawl under the slab crouched, then try to stand: no room, so you stay down.
    let under = run(physics, start, { forward: 1, buttons: BUTTON_CROUCH }, 200);
    expect(under.pos.z).toBeGreaterThan(1.6);
    under = run(physics, under, {}, 5);
    expect(under.stance).toBe(1);
    // Out in the open again: you stand up.
    const out = run(physics, under, { forward: -1 }, 400);
    expect(out.stance).toBeUndefined();
    // Jumping from a crouch stands you up instead of jumping.
    const up = run(physics, crouched, { buttons: BUTTON_JUMP | BUTTON_CROUCH }, 1);
    expect(up.stance).toBeUndefined();
    expect(up.grounded).toBe(true);
  });

  it('jumps and crouches (legs tucked) through a window, which a standing jump cannot', () => {
    const map = makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0, edges: { '0,0,0:N': 'window' } }]);
    const physics = new PhysicsWorld(buildMapGeometry(map));
    const attempt = (crouch: boolean) => {
      const c = physics.createPlayerCollider();
      let s: MoveState = { pos: { x: 0, y: 0, z: 0.5 }, velY: 0, grounded: true };
      let jumped = -1;
      let furthest = 0;
      for (let t = 0; t < 120; t++) {
        let buttons = 0;
        if (jumped < 0 && s.pos.z > 1.6) {
          buttons = BUTTON_JUMP;
          jumped = t;
        } else if (crouch && jumped >= 0 && t > jumped + 6) buttons = BUTTON_CROUCH;
        s = stepMovement(physics, c, s, { ...emptyInput(t), forward: 1, buttons });
        furthest = Math.max(furthest, s.pos.z);
      }
      physics.removeCollider(c);
      return furthest;
    };
    expect(attempt(false)).toBeLessThan(3.6); // stopped by the wall
    expect(attempt(true)).toBeGreaterThan(4.6); // out through the window
  });

  it('climbs a ladder up a wall, and lets go with a jump', () => {
    const map = makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]);
    const physics = new PhysicsWorld(buildMapGeometry(map));
    const env: MoveEnv = { ladders: mapLadders([{ kind: 'ladder', position: [0, 0, 3.5], yaw: Math.PI, height: 4, width: 0.9 }]) };
    const c = physics.createPlayerCollider();
    let s: MoveState = { pos: { x: 0, y: 0, z: 2.4 }, velY: 0, grounded: true };
    let maxY = 0;
    let climbed = false;
    for (let t = 0; t < 150; t++) {
      s = stepMovement(physics, c, s, { ...emptyInput(t), forward: 1 }, 1, undefined, 1, env);
      climbed ||= !!s.climb;
      maxY = Math.max(maxY, s.pos.y);
    }
    expect(climbed).toBe(true);
    expect(maxY).toBeGreaterThan(3.9); // up onto the top of the wall
    // Halfway up, a jump pushes you off it, back into the room.
    let h: MoveState = { pos: { x: 0, y: 2, z: 3.05 }, velY: 0, grounded: false };
    h = stepMovement(physics, c, h, { ...emptyInput(0), forward: 1, buttons: BUTTON_JUMP }, 1, undefined, 1, env);
    for (let t = 1; t < 40; t++) h = stepMovement(physics, c, h, { ...emptyInput(t) }, 1, undefined, 1, env);
    expect(h.pos.z).toBeLessThan(2.4);
    physics.removeCollider(c);
  });
});

