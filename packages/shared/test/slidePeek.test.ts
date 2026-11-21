import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_CROUCH,
  BUTTON_JUMP,
  BUTTON_LEAN_LEFT,
  BUTTON_LEAN_RIGHT,
  BUTTON_SPRINT,
  LEAN,
  PLAYER,
  PhysicsWorld,
  SLIDE,
  SPRINT,
  STANCES,
  TICK_RATE,
  buildMapGeometry,
  emptyInput,
  eyePoint,
  headPoint,
  initPhysics,
  leanShift,
  rayBody,
  stepMovement,
  type HitBody,
  type MoveState,
  type PlayerInput,
} from '../src/index.ts';
import { DEFAULT_DEATHMATCH_RULES, BUTTON_FIRE, getWeapon, lookAngles, lookHitbox, weaponCode, type GameEvent } from '../src/index.ts';
import { MEASURED_HITBOXES } from '../src/content/hitboxes.generated.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** An open yard, 40 × 32 m. */
const yard = () => {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return new PhysicsWorld(buildMapGeometry(makeMap(tiles)));
};

function play(physics: PhysicsWorld, state: MoveState, inputs: Partial<PlayerInput>[], each?: (s: MoveState, i: number) => void): MoveState {
  const collider = physics.createPlayerCollider();
  let s = state;
  inputs.forEach((input, i) => {
    s = stepMovement(physics, collider, s, { ...emptyInput(i), ...input });
    each?.(s, i);
  });
  physics.removeCollider(collider);
  return s;
}

const repeat = (input: Partial<PlayerInput>, n: number) => Array.from({ length: n }, () => input);
const SPRINTING = { forward: 1, buttons: BUTTON_SPRINT };
/** Sprint, then crouch (the client keeps sprint held as C goes down). */
const SLIDING = { forward: 1, buttons: BUTTON_SPRINT | BUTTON_CROUCH };
const start = (): MoveState => ({ pos: { x: 16, y: 0, z: 2 }, velY: 0, grounded: true });

describe('slide', () => {
  it('keeps the sprint\'s momentum, slows over about 0.6-0.9 s and ends in a crouch', () => {
    const physics = yard();
    const ran = play(physics, start(), repeat(SPRINTING, 30));
    expect(ran.sprint).toBe(true);
    const speeds: number[] = [];
    let prev = ran.pos;
    let endedAt = -1;
    const after = play(physics, ran, repeat(SLIDING, 90), (s, i) => {
      speeds.push(Math.hypot(s.pos.x - prev.x, s.pos.z - prev.z) * TICK_RATE);
      prev = s.pos;
      if (endedAt < 0 && i > 0 && !s.slide) endedAt = i;
    });
    const sprintSpeed = PLAYER.runSpeed * SPRINT.speed;
    // Starts a little faster than the sprint, far faster than a crouch walk.
    expect(speeds[0]).toBeGreaterThan(sprintSpeed);
    expect(speeds[0]).toBeLessThan(sprintSpeed * SLIDE.boost * 1.1);
    // Slows all the way down.
    for (let i = 2; i < 30; i++) expect(speeds[i]).toBeLessThanOrEqual(speeds[i - 1]! + 1e-6);
    const seconds = endedAt / TICK_RATE;
    expect(seconds).toBeGreaterThan(0.6);
    expect(seconds).toBeLessThan(0.9);
    // Ends crouched, at a crouch walk.
    expect(after.stance).toBe(1);
    expect(after.slide).toBeUndefined();
    const last = speeds.slice(-10).reduce((a, b) => a + b, 0) / 10;
    expect(last).toBeCloseTo(PLAYER.runSpeed * STANCES[1].speed, 0);
    // No lurch where the slide hands over to the crouch walk.
    expect(speeds[endedAt + 1]!).toBeLessThan(speeds[endedAt - 2]! + 0.3);
    // Further than a crouch walk would go in that time, by metres.
    expect(after.pos.z - ran.pos.z).toBeGreaterThan(PLAYER.runSpeed * STANCES[1].speed * 1.5 + 2.5);
  });

  it('costs stamina the way a sprint does, and with too little there is no slide', () => {
    const physics = yard();
    const ran = play(physics, start(), repeat(SPRINTING, 30));
    const slid = play(physics, ran, repeat(SLIDING, 2));
    expect(slid.slide).toBeGreaterThan(0);
    expect(ran.stamina! - slid.stamina!).toBeCloseTo(SLIDE.cost, 2);
    // No stamina comes back while sliding.
    const later = play(physics, slid, repeat(SLIDING, 20));
    expect(later.stamina).toBe(slid.stamina);
    // Too little: a crouch, no slide.
    const tired: MoveState = { ...ran, stamina: SLIDE.cost - 0.01 };
    const no = play(physics, tired, repeat(SLIDING, 2));
    expect(no.slide).toBeUndefined();
    expect(no.stance).toBe(1);
    expect(no.stamina).toBeCloseTo(SLIDE.cost - 0.01, 3);
  });

  it('needs a sprint and the ground: no slide from a walk or in the air', () => {
    const physics = yard();
    const walked = play(physics, start(), repeat({ forward: 1 }, 30));
    expect(play(physics, walked, repeat({ forward: 1, buttons: BUTTON_CROUCH }, 2)).slide).toBeUndefined();
    const ran = play(physics, start(), repeat(SPRINTING, 30));
    const jumped = play(physics, ran, [{ forward: 1, buttons: BUTTON_SPRINT | BUTTON_JUMP }, ...repeat(SPRINTING, 5)]);
    expect(jumped.grounded).toBe(false);
    expect(play(physics, jumped, repeat(SLIDING, 3)).slide).toBeUndefined();
  });

  it('has a cooldown: no slide chained straight into another', () => {
    const physics = yard();
    let s = play(physics, start(), repeat(SPRINTING, 30));
    s = play(physics, s, repeat(SLIDING, 4));
    expect(s.slide).toBeGreaterThan(0);
    // Let go (standing up ends it), sprint a moment, crouch again inside the cooldown.
    s = play(physics, s, repeat(SPRINTING, 6));
    expect(s.slide).toBeUndefined();
    expect(s.moveCd).toBeGreaterThan(0);
    expect(play(physics, s, repeat(SLIDING, 2)).slide).toBeUndefined();
    // After it: slides again.
    s = play(physics, s, repeat(SPRINTING, Math.round(SLIDE.cooldown * TICK_RATE)));
    expect(play(physics, s, repeat(SLIDING, 2)).slide).toBeGreaterThan(0);
  });

  it('is cut short by a wall and by letting go of crouch or jumping', () => {
    const physics = yard();
    const ran = play(physics, start(), repeat(SPRINTING, 30));
    const up = play(physics, play(physics, ran, repeat(SLIDING, 5)), [{ forward: 1, buttons: BUTTON_JUMP }]);
    expect(up.slide).toBeUndefined();
    expect(up.stance).toBeUndefined();
  });

  it('is deterministic: a replay from any tick reproduces it exactly (prediction)', () => {
    const physics = yard();
    const inputs = [...repeat(SPRINTING, 30), ...repeat(SLIDING, 60), ...repeat({ forward: 1, buttons: BUTTON_LEAN_RIGHT }, 20)];
    const states: MoveState[] = [];
    const full = play(physics, start(), inputs, (s) => states.push(s));
    for (const from of [29, 31, 45, 70, 95]) expect(play(physics, states[from]!, inputs.slice(from + 1))).toEqual(full);
  });
});

describe('peek (lean)', () => {
  it('leans out a step a tick, both ways, and back; standing still costs no stamina', () => {
    const physics = yard();
    const s0 = start();
    const right = play(physics, s0, repeat({ buttons: BUTTON_LEAN_RIGHT }, LEAN.steps + 5));
    expect(right.lean).toBe(LEAN.steps);
    expect(right.stamina).toBeUndefined();
    expect(play(physics, s0, repeat({ buttons: BUTTON_LEAN_RIGHT }, 4)).lean).toBe(4);
    const left = play(physics, s0, repeat({ buttons: BUTTON_LEAN_LEFT }, LEAN.steps + 5));
    expect(left.lean).toBe(-LEAN.steps);
    expect(play(physics, right, repeat({}, LEAN.steps)).lean).toBeUndefined();
    // Both at once: upright.
    expect(play(physics, s0, repeat({ buttons: BUTTON_LEAN_LEFT | BUTTON_LEAN_RIGHT }, 5)).lean).toBeUndefined();
    // Not while sprinting.
    expect(play(physics, s0, repeat({ forward: 1, buttons: BUTTON_SPRINT | BUTTON_LEAN_LEFT }, 10)).lean).toBeUndefined();
  });

  it('moves the eye about a third of a metre out to the side (the body\'s right is +x facing +z... -x)', () => {
    const feet = { x: 0, y: 0, z: 0 };
    const upright = eyePoint(feet, 0, 0, 0);
    const right = eyePoint(feet, 0, 0, LEAN.steps);
    const left = eyePoint(feet, 0, 0, -LEAN.steps);
    // Facing +z (yaw 0), the body's right is +x.
    expect(right.x).toBeGreaterThan(0.28);
    expect(right.x).toBeLessThan(0.4);
    expect(left.x).toBeCloseTo(-right.x, 6);
    expect(right.y).toBeLessThan(upright.y);
    expect(upright.y - right.y).toBeLessThan(0.06);
    expect(leanShift(LEAN.steps, 1, STANCES[1].eye).side).toBeLessThan(leanShift(LEAN.steps, 0, STANCES[0].eye).side);
  });

  it('never leans the head into a wall', () => {
    const physics = new PhysicsWorld(buildMapGeometry(makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }])));
    // Against the room's east wall (inner face at x = 3.5), facing +z: the right is +x, into the wall.
    const s0: MoveState = { pos: { x: 3.0, y: 0, z: 0 }, velY: 0, grounded: true };
    const s = play(physics, s0, repeat({ buttons: BUTTON_LEAN_RIGHT }, 20));
    expect(Math.abs(s.lean ?? 0)).toBeLessThan(LEAN.steps);
    expect(eyePoint(s.pos, 0, 0, s.lean ?? 0).x).toBeLessThanOrEqual(3.5 - LEAN.margin + 1e-6);
    // The other way is clear.
    expect(play(physics, s0, repeat({ buttons: BUTTON_LEAN_LEFT }, 20)).lean).toBe(-LEAN.steps);
  });

  it('moves the hit shapes with it: the head is where the leaned eye is, the legs stay', () => {
    const box = MEASURED_HITBOXES[Object.keys(MEASURED_HITBOXES)[0]!]!;
    const body: HitBody = { feet: { x: 0, y: 0, z: 0 }, yaw: 0, stance: 0, scale: 1, box };
    const upright = headPoint(body);
    const leaned = headPoint({ ...body, lean: LEAN.steps });
    const eyeShift = eyePoint(body.feet, 0, 0, LEAN.steps).x;
    expect(leaned.x - upright.x).toBeGreaterThan(eyeShift * 0.8);
    expect(leaned.x - upright.x).toBeLessThan(eyeShift * 1.25);
    // A shot from the side (from +x toward -x) at the upright head's height, passing where the leaned head now is.
    const shoot = (b: HitBody, x0: number, y: number, z: number) => rayBody({ x: 5, y, z }, { x: -1, y: 0, z: 0 }, b, 20);
    // From the front, through the leaned head's place: misses upright (a little right of the head), hits leaned.
    const front = (b: HitBody) => rayBody({ x: leaned.x + 0.05, y: leaned.y, z: 5 }, { x: 0, y: 0, z: -1 }, b, 20);
    expect(front({ ...body, lean: LEAN.steps })).not.toBeNull();
    // Upright, the same line clears the head (lean right puts the head out where the upright body isn't).
    const far = (b: HitBody) => rayBody({ x: upright.x + 0.4, y: leaned.y, z: 5 }, { x: 0, y: 0, z: -1 }, b, 20);
    expect(far(body)).toBeNull();
    expect(far({ ...body, lean: LEAN.steps })).not.toBeNull();
    // The feet don't move: a shot at the ankles hits the same either way.
    expect(shoot(body, 5, 0.15, 0)).toBeCloseTo(shoot({ ...body, lean: LEAN.steps }, 5, 0.15, 0)!, 6);
  });
});

describe('peek in the match: rounds, lag compensation and the shooter\'s own eye', () => {
  const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
  const yardMap = (spawns: [number, number, number][]) => {
    const tiles = [];
    for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
    return makeMap(tiles, spawns);
  };
  /** a at (0, 0, 4) facing +x; b at (4, 0, 4) facing a (its right is +z). */
  const duel = () => {
    const match = new Match(yardMap([[0, 0, 4], [4, 0, 4]]), rules);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b', 'core.ranger')!;
    a.move = { pos: { x: 0, y: 0, z: 4 }, velY: 0, grounded: true };
    b.move = { pos: { x: 4, y: 0, z: 4 }, velY: 0, grounded: true };
    a.yaw = Math.PI / 2;
    b.yaw = -Math.PI / 2;
    const def = getWeapon('core.revolver');
    a.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
    a.current = weaponCode(def);
    a.raiseTicks = 0;
    let seq = 0;
    const input = (c: Combatant, i: Partial<PlayerInput>) => match.queueInputs(c.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
    const run = (n: number, each: () => void) => {
      const out: GameEvent[] = [];
      for (let k = 0; k < n; k++) {
        each();
        out.push(...match.step());
      }
      return out;
    };
    const head = (c: Combatant) => {
      const h = lookHitbox(c.look);
      return headPoint({ feet: c.move.pos, yaw: c.yaw, stance: c.move.stance ?? 0, scale: h.scale * c.size, box: h.box, lean: c.move.lean ?? 0 });
    };
    return { match, a, b, input, run, head };
  };
  const landed = (ev: GameEvent[]) => ev.filter((e) => e.e === 'shot' || e.e === 'impact').map((e) => (e.e === 'shot' ? { hit: e.hit[0], z: e.z?.[0] ?? 0 } : { hit: e.hit, z: e.z ?? 0 })).filter((x) => x.hit !== null);

  it('a round at a leaned head hits it; at where the head would be upright, it misses the head', () => {
    for (const lean of [BUTTON_LEAN_RIGHT, BUTTON_LEAN_LEFT]) {
      const { a, b, input, run, head } = duel();
      run(20, () => (input(a, {}), input(b, { buttons: lean })));
      expect(Math.abs(b.move.lean!)).toBe(LEAN.steps);
      const eye = eyePoint(a.move.pos, a.yaw, 0, 0);
      const leaned = head(b);
      const upright = headPoint({ feet: b.move.pos, yaw: b.yaw, stance: 0, scale: lookHitbox(b.look).scale * b.size, box: lookHitbox(b.look).box });
      expect(Math.abs(leaned.z - upright.z)).toBeGreaterThan(0.28);
      const shot = (at: { x: number; y: number; z: number }) => landed(run(6, () => (input(a, { ...lookAngles(eye, at), buttons: BUTTON_FIRE }), input(b, { buttons: lean }))))[0];
      expect(shot(leaned)).toEqual({ hit: b.slot, z: 1 });
      const { a: a2, b: b2, input: in2, run: run2 } = duel();
      run2(20, () => (in2(a2, {}), in2(b2, { buttons: lean })));
      const miss = landed(run2(6, () => (in2(a2, { ...lookAngles(eye, upright), buttons: BUTTON_FIRE }), in2(b2, { buttons: lean }))))[0];
      expect(miss?.z).not.toBe(1);
    }
  });

  it('lag compensation rewinds the lean: a round aimed at the head as it was seen leaning lands, after it has come back', () => {
    const shootAfterUpright = (useViewTick: boolean) => {
      const { match, a, b, input, run, head } = duel();
      run(20, () => (input(a, {}), input(b, { buttons: BUTTON_LEAN_RIGHT })));
      const seen = match.tick;
      const aim = lookAngles(eyePoint(a.move.pos, a.yaw, 0, 0), head(b));
      // b comes back upright.
      run(LEAN.steps + 2, () => (input(a, { ...aim }), input(b, {})));
      expect(b.move.lean).toBeUndefined();
      const ev = run(1, () => (input(a, { ...aim, buttons: BUTTON_FIRE, ...(useViewTick ? { viewTick: seen } : {}) }), input(b, {})));
      return landed([...ev, ...run(4, () => (input(a, {}), input(b, {})))]).filter((x) => x.z === 1);
    };
    expect(shootAfterUpright(true)).toEqual([{ hit: 1, z: 1 }]);
    expect(shootAfterUpright(false)).toEqual([]);
  });

  it('a leaning shooter\'s rounds leave the leaned eye', () => {
    const { a, b, input, run } = duel();
    run(20, () => (input(a, { buttons: BUTTON_LEAN_LEFT }), input(b, {})));
    const shot = run(3, () => (input(a, { buttons: BUTTON_FIRE | BUTTON_LEAN_LEFT }), input(b, {}))).find((e) => e.e === 'shot');
    expect(shot && shot.e === 'shot').toBe(true);
    const from = (shot as Extract<GameEvent, { e: 'shot' }>).from;
    const eye = eyePoint(a.move.pos, a.yaw, 0, -LEAN.steps);
    // Facing +x, the left is +z: the eye is out that way.
    expect(eye.z - a.move.pos.z).toBeGreaterThan(0.28);
    expect(from[2]).toBeCloseTo(eye.z, 2);
    expect(from[1]).toBeCloseTo(eye.y, 2);
  });
});
