import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_CROUCH,
  BUTTON_DODGE,
  BUTTON_FIRE,
  BUTTON_JUMP,
  BUTTON_LEAN_RIGHT,
  BUTTON_PRONE,
  BUTTON_SPRINT,
  BUTTON_ZOOM,
  DEFAULT_DEATHMATCH_RULES,
  DODGE,
  PLAYER,
  PhysicsWorld,
  ROLL,
  SLIDE,
  SPRINT,
  STAMINA_MOVES,
  TICK_RATE,
  buildMapGeometry,
  dodgeDirection,
  emptyInput,
  getWeapon,
  stepMovement,
  weaponCode,
  type GameEvent,
  type MoveState,
  type PlayerInput,
} from '../src/index.ts';
import { initPhysics } from '../src/index.ts';
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
/** Facing +z (yaw 0), on the yard's open floor. */
const start = (more: Partial<MoveState> = {}): MoveState => ({ pos: { x: 16, y: 0, z: 8 }, velY: 0, grounded: true, ...more });
/** Settle onto the floor first. */
const settled = (physics: PhysicsWorld, more: Partial<MoveState> = {}) => play(physics, start(more), repeat({}, 10));
/** A press of Dodge (one tick, as the client sends it), then `after` ticks of `hold`. */
const dodgeThen = (press: Partial<PlayerInput>, hold: Partial<PlayerInput>, after: number) => [{ ...press, buttons: (press.buttons ?? 0) | BUTTON_DODGE }, ...repeat(hold, after)];

describe('dodge-step', () => {
  it('a quick burst the way you move: about 2 m sideways in under half a second, then you walk on', () => {
    const physics = yard();
    const s0 = settled(physics);
    let endedAt = -1;
    const speeds: number[] = [];
    let prev = s0.pos;
    const s1 = play(physics, s0, dodgeThen({ right: 1 }, { right: 1 }, 40), (s, i) => {
      speeds.push(Math.hypot(s.pos.x - prev.x, s.pos.z - prev.z) * TICK_RATE);
      prev = s.pos;
      if (endedAt < 0 && i > 0 && !s.dodge) endedAt = i;
      if (i === 0) {
        expect(s.dodge).toBe(1);
        expect(s.roll).toBeUndefined();
        expect(s.stance).toBeUndefined();
      }
    });
    // Its burst is a sprint's speed or so, well over a walk (the legs keep only a little of their own).
    expect(speeds[1]!).toBeGreaterThan(PLAYER.runSpeed * 1.3);
    expect(speeds[1]!).toBeLessThan(PLAYER.runSpeed * (DODGE.speed + DODGE.control) * 1.05);
    expect(endedAt / TICK_RATE).toBeCloseTo(DODGE.seconds, 1);
    // Right of facing +z (yaw 0) is +x; then you walk on at your own pace (no lurch: the burst fades).
    const s2 = play(physics, s0, dodgeThen({ right: 1 }, {}, 24));
    expect(s2.pos.x - s0.pos.x).toBeGreaterThan(1.6);
    expect(s2.pos.x - s0.pos.x).toBeLessThan(2.6);
    expect(Math.abs(s2.pos.z - s0.pos.z)).toBeLessThan(0.05);
    expect(s1.stamina).toBeCloseTo(1 - DODGE.cost + 0, 1);
  });

  it('with no direction held it steps straight back; it costs DODGE.cost stamina and starts the shared cooldown', () => {
    const physics = yard();
    const s0 = settled(physics);
    const s1 = play(physics, s0, dodgeThen({}, {}, 30));
    expect(s0.pos.z - s1.pos.z).toBeGreaterThan(1.6);
    expect(Math.abs(s1.pos.x - s0.pos.x)).toBeLessThan(0.05);
    // Just after: the stamina's lump is gone and none has come back yet, the cooldown is running.
    const s2 = play(physics, s0, dodgeThen({}, {}, Math.round(DODGE.seconds * TICK_RATE) + 1));
    expect(s2.dodge).toBeUndefined();
    expect(s2.stamina).toBeCloseTo(1 - DODGE.cost, 3);
    expect(s2.moveCd).toBeGreaterThan(0);
    expect(dodgeDirection(0, 0, 0, 1)).toEqual({ x: 0, z: -1 });
    expect(dodgeDirection(0, 0, 0, 2)).toEqual({ x: 0, z: 1 });
  });

  it('is refused without the stamina, while winded, in the air, prone, mid-slide or in the cooldown', () => {
    const physics = yard();
    const s0 = settled(physics);
    const first = (s: MoveState, input: Partial<PlayerInput> = { right: 1 }) => play(physics, s, dodgeThen(input, {}, 0));
    expect(first(s0).dodge).toBe(1);
    expect(first({ ...s0, stamina: DODGE.cost - 0.01 }).dodge).toBeUndefined();
    expect(first({ ...s0, stamina: 0.5, winded: true }).dodge).toBeUndefined();
    expect(first({ ...s0, moveCd: 5 }).dodge).toBeUndefined();
    expect(first({ ...s0, grounded: false, velY: 3, pos: { ...s0.pos, y: 1 } }).dodge).toBeUndefined();
    expect(first({ ...s0, stance: 2 }, { right: 1, buttons: BUTTON_PRONE }).dodge).toBeUndefined();
    // Mid-slide: no dodge (and no roll); the slide goes on.
    const ran = play(physics, s0, repeat({ forward: 1, buttons: BUTTON_SPRINT }, 30));
    const sliding = play(physics, ran, repeat({ forward: 1, buttons: BUTTON_SPRINT | BUTTON_CROUCH }, 5));
    expect(sliding.slide).toBeGreaterThan(0);
    const after = first(sliding, { forward: 1, buttons: BUTTON_SPRINT | BUTTON_CROUCH });
    expect(after.dodge).toBeUndefined();
    expect(after.slide).toBeGreaterThan(0);
    // Just after a dodge, no slide either (one cooldown for every stamina move).
    const stepped = play(physics, s0, dodgeThen({ forward: 1 }, { forward: 1, buttons: BUTTON_SPRINT }, Math.round(DODGE.seconds * TICK_RATE) + 1));
    expect(stepped.moveCd).toBeGreaterThan(0);
    expect(play(physics, stepped, [{ forward: 1, buttons: BUTTON_SPRINT | BUTTON_CROUCH }]).slide).toBeUndefined();
  });

  it('a jump out of it carries no further than a sprint jump does', () => {
    const physics = yard();
    const s0 = settled(physics);
    const land = (inputs: Partial<PlayerInput>[]) => {
      let air = false;
      let at: MoveState | null = null;
      play(physics, s0, inputs, (s) => {
        if (!s.grounded) air = true;
        else if (air && !at) at = s;
      });
      return at!;
    };
    const sprintJump = land([...repeat({ forward: 1, buttons: BUTTON_SPRINT }, 30), { forward: 1, buttons: BUTTON_SPRINT | BUTTON_JUMP }, ...repeat({ forward: 1, buttons: BUTTON_SPRINT }, 80)]);
    const ranUp = play(physics, s0, repeat({ forward: 1, buttons: BUTTON_SPRINT }, 30)).pos.z - s0.pos.z;
    const dodgeJump = land([{ forward: 1, buttons: BUTTON_DODGE }, ...repeat({ forward: 1 }, 2), { forward: 1, buttons: BUTTON_JUMP }, ...repeat({ forward: 1 }, 80)]);
    const stepUp = play(physics, s0, [{ forward: 1, buttons: BUTTON_DODGE }, ...repeat({ forward: 1 }, 2)]).pos.z - s0.pos.z;
    expect(dodgeJump.pos.z - s0.pos.z - stepUp).toBeLessThanOrEqual(sprintJump.pos.z - s0.pos.z - ranUp + 0.2);
  });

  it('no lean while it lasts', () => {
    const physics = yard();
    const s0 = settled(physics);
    const s1 = play(physics, s0, dodgeThen({ right: 1, buttons: BUTTON_LEAN_RIGHT }, { right: 1, buttons: BUTTON_LEAN_RIGHT }, 3));
    expect(s1.dodge).toBeGreaterThan(0);
    expect(s1.lean).toBeUndefined();
  });
});

describe('combat roll', () => {
  it('from a crouch: about 3.3 m at crouch height, then crouched again while crouch is still on', () => {
    const physics = yard();
    const s0 = play(physics, settled(physics), repeat({ buttons: BUTTON_CROUCH }, 10));
    expect(s0.stance).toBe(1);
    let endedAt = -1;
    const s1 = play(physics, s0, dodgeThen({ forward: 1, buttons: BUTTON_CROUCH }, { buttons: BUTTON_CROUCH }, 50), (s, i) => {
      if (i === 0) expect(s.roll).toBe(true);
      if (s.dodge) expect(s.stance).toBe(1);
      if (endedAt < 0 && i > 0 && !s.dodge) endedAt = i;
    });
    expect(endedAt / TICK_RATE).toBeCloseTo(ROLL.seconds, 1);
    expect(s1.pos.z - s0.pos.z).toBeGreaterThan(3);
    expect(s1.pos.z - s0.pos.z).toBeLessThan(4);
    expect(s1.stance).toBe(1);
    expect(s1.stamina).toBeLessThan(1 - ROLL.cost + 0.05);
  });

  it('from a sprint: the way you run, then standing again (crouch was never on); no sprint or jump while it lasts', () => {
    const physics = yard();
    const ran = play(physics, settled(physics), repeat({ forward: 1, buttons: BUTTON_SPRINT }, 30));
    expect(ran.sprint).toBe(true);
    let rolled = false;
    const s1 = play(physics, ran, dodgeThen({ forward: 1, buttons: BUTTON_SPRINT }, { forward: 1, buttons: BUTTON_SPRINT | BUTTON_JUMP }, 34), (s, i) => {
      if (i === 0) rolled = !!s.roll;
      if (s.dodge) {
        expect(s.sprint).toBeUndefined();
        expect(s.stance).toBe(1);
        expect(s.grounded).toBe(true);
      }
    });
    expect(rolled).toBe(true);
    const s2 = play(physics, s1, repeat({ forward: 1 }, 10));
    expect(s2.stance).toBeUndefined();
  });

  it('costs more than a step: refused with a step\'s worth of stamina; a stamina stat stretches it', () => {
    const physics = yard();
    const s0 = play(physics, settled(physics), repeat({ buttons: BUTTON_CROUCH }, 10));
    expect(STAMINA_MOVES.roll.cost).toBeGreaterThan(STAMINA_MOVES.dodge.cost);
    expect(STAMINA_MOVES.dodge.cost).toBeLessThan(SLIDE.cost);
    const collider = physics.createPlayerCollider();
    const one = (s: MoveState, stamina?: number) => stepMovement(physics, collider, s, { ...emptyInput(1), forward: 1, buttons: BUTTON_CROUCH | BUTTON_DODGE }, 1, undefined, 1, stamina ? { stamina } : {});
    expect(one({ ...s0, stamina: 0.2 }).dodge).toBeUndefined();
    expect(one({ ...s0, stamina: 0.2 }, 2).roll).toBe(true);
    expect(one({ ...s0, stamina: 0.31 }).roll).toBe(true);
    physics.removeCollider(collider);
  });

  it('stops against a wall instead of pushing into it', () => {
    const physics = yard();
    // A wall of the level a little way to the side: a ray finds it, then the roll goes at it from just short of it.
    const s0 = play(physics, settled(physics), repeat({ buttons: BUTTON_CROUCH }, 10));
    const free = play(physics, s0, dodgeThen({ forward: -1, buttons: BUTTON_CROUCH }, { buttons: BUTTON_CROUCH }, 40));
    expect(s0.pos.z - free.pos.z).toBeGreaterThan(3);
    const wall = physics.moveRay({ x: s0.pos.x, y: s0.pos.y + 0.5, z: s0.pos.z }, { x: 0, y: 0, z: -1 }, 40);
    expect(wall).not.toBeNull();
    const near = play(physics, settled(physics, { pos: { x: s0.pos.x, y: 0, z: s0.pos.z - wall! + 1 } }), repeat({ buttons: BUTTON_CROUCH }, 10));
    let endedAt = -1;
    const s1 = play(physics, near, dodgeThen({ forward: -1, buttons: BUTTON_CROUCH }, { buttons: BUTTON_CROUCH }, 40), (s, i) => {
      if (endedAt < 0 && i > 0 && !s.dodge) endedAt = i;
    });
    expect(endedAt).toBeGreaterThan(0);
    expect(endedAt / TICK_RATE).toBeLessThan(ROLL.seconds - 0.1);
    expect(s1.vz ?? 0).toBe(0);
  });

  it('replays the same from any tick (what client prediction does after a correction)', () => {
    const physics = yard();
    const ran = play(physics, settled(physics), repeat({ forward: 1, buttons: BUTTON_SPRINT }, 30));
    const inputs = [...dodgeThen({ forward: 1, right: 0.5, buttons: BUTTON_SPRINT }, { forward: 1 }, 20), ...dodgeThen({ right: -1 }, {}, 40)];
    const states: MoveState[] = [];
    const whole = play(physics, ran, inputs, (s) => states.push(s));
    for (const from of [3, 17, 30, 45]) {
      const again = play(physics, states[from]!, inputs.slice(from + 1));
      expect(again).toEqual(whole);
    }
  });
});

describe('combat roll in the match: the gun is down for it', () => {
  const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
  const solo = () => {
    const tiles = [];
    for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
    const match = new Match(makeMap(tiles, [[0, 0, 4], [30, 0, 4]]), rules);
    const a = match.addHuman('a')!;
    a.move = { pos: { x: 8, y: 0, z: 8 }, velY: 0, grounded: true };
    a.yaw = 0;
    const def = getWeapon('core.battle_rifle');
    a.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
    a.current = weaponCode(def);
    a.raiseTicks = 0;
    let seq = 0;
    const input = (c: Combatant, i: Partial<PlayerInput>) => match.queueInputs(c.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
    const run = (n: number, i: Partial<PlayerInput>, each?: () => void) => {
      const out: GameEvent[] = [];
      for (let k = 0; k < n; k++) {
        input(a, i);
        out.push(...match.step());
        each?.();
      }
      return out;
    };
    return { match, a, run };
  };
  const shots = (ev: GameEvent[]) => ev.filter((e) => e.e === 'shot').length;

  it('no shot and no aim while rolling; the gun comes up after it in its sprint-exit time; a dodge-step fires', () => {
    const { a, run } = solo();
    run(20, { buttons: BUTTON_CROUCH });
    run(1, { forward: 1, buttons: BUTTON_CROUCH | BUTTON_DODGE });
    expect(a.move.roll).toBe(true);
    const during = run(Math.round(ROLL.seconds * TICK_RATE) - 4, { buttons: BUTTON_CROUCH | BUTTON_FIRE | BUTTON_ZOOM }, () => {
      if (a.move.dodge) expect(a.raiseTicks).toBeGreaterThan(0);
    });
    expect(shots(during)).toBe(0);
    expect(a.gun.ads).toBe(0);
    const after = run(40, { buttons: BUTTON_CROUCH | BUTTON_FIRE });
    expect(a.move.dodge).toBeUndefined();
    expect(shots(after)).toBeGreaterThan(0);
    // A dodge-step keeps the gun up.
    const { a: b, run: runB } = solo();
    runB(10, {});
    const step = runB(8, { right: 1, buttons: BUTTON_FIRE | BUTTON_DODGE });
    expect(b.move.dodge ?? 0).toBeGreaterThan(0);
    expect(shots(step)).toBeGreaterThan(0);
  });

  it('a press of Dodge in a backlog the host drops is kept (on the oldest input it keeps)', () => {
    const { match, a } = solo();
    const inputs = Array.from({ length: 40 }, (_, i) => ({ seq: 1000 + i, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: i === 2 ? BUTTON_DODGE : 0 }));
    match.queueInputs(a.slot, inputs);
    expect(a.queue.length).toBeLessThan(40);
    expect(a.queue[0]!.buttons & BUTTON_DODGE).toBe(BUTTON_DODGE);
    expect(a.queue.filter((i) => i.buttons & BUTTON_DODGE)).toHaveLength(1);
  });

  it('the snapshot says it: public dg [kind, ticks], private mv with the dodge', () => {
    const { match, a, run } = solo();
    run(10, {});
    run(1, { right: 1, buttons: BUTTON_DODGE });
    const snap = match.snapshot([]);
    const me = snap.players.find((p) => p.s === a.slot)!;
    expect(me.dg).toEqual([1, 1]);
    const priv = match.privateState(a.slot)!;
    expect(priv.mv).toEqual([0, 0, 1, 0]);
    run(30, {});
    expect(match.snapshot([]).players.find((p) => p.s === a.slot)!.dg).toBeUndefined();
    expect(SPRINT.speed).toBeGreaterThan(1);
  });
});
