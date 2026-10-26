import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_CROUCH,
  BUTTON_JUMP,
  CHUTE,
  CHUTE_GLIDER,
  CHUTE_PARACHUTE,
  DEFAULT_DEATHMATCH_RULES,
  PLAYER,
  PhysicsWorld,
  TICK_RATE,
  buildMapGeometry,
  emptyInput,
  initPhysics,
  stepMovement,
  type MapDocument,
  type MoveEnv,
  type MoveState,
  type PlayerInput,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** An open yard 40 × 32 m (x -4..36, z -4..28), open to the sky. */
function yard(extra: MapDocument['entities'] = []): MapDocument {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles);
  return { ...map, entities: [...map.entities, ...extra] };
}

function fall(physics: PhysicsWorld, state: MoveState, input: Partial<PlayerInput>, ticks: number, env: MoveEnv = {}, each?: (s: MoveState) => void): MoveState {
  const collider = physics.createPlayerCollider();
  let s = state;
  for (let i = 0; i < ticks; i++) {
    s = stepMovement(physics, collider, s, { ...emptyInput(i), ...input }, 1, undefined, 1, env);
    each?.(s);
  }
  physics.removeCollider(collider);
  return s;
}

const high = (y = 60): MoveState => ({ pos: { x: 16, y, z: 12 }, velY: 0, grounded: false });

describe('parachutes and gliders', () => {
  const physics = () => new PhysicsWorld(buildMapGeometry(yard()));

  it('holding jump while falling from height opens a parachute that settles to a slow sink', () => {
    let opened = -1;
    let tick = 0;
    const s = fall(physics(), high(), { buttons: BUTTON_JUMP }, TICK_RATE * 3, {}, (st) => {
      tick++;
      if (st.chute && opened < 0) opened = tick;
    });
    // It waits until you are actually falling (not on the way up from a jump).
    expect(opened).toBeGreaterThan(0);
    expect(s.chute).toBe(CHUTE_PARACHUTE);
    expect(s.velY).toBeCloseTo(-CHUTE.sink, 0);
    expect(s.pos.y).toBeGreaterThan(30);
  });

  it('does not open close to the ground, and packs up on landing', () => {
    // A plain jump with jump held never opens one.
    const jumped = fall(physics(), { pos: { x: 16, y: 0, z: 12 }, velY: 0, grounded: true }, { buttons: BUTTON_JUMP }, 40);
    expect(jumped.chute).toBeUndefined();
    // From 4 m (under the 5 m minimum) it stays shut.
    const low = fall(physics(), high(4), { buttons: BUTTON_JUMP }, 10);
    expect(low.chute).toBeUndefined();
    // Open high, then all the way down: grounded and packed away.
    const opened = fall(physics(), high(30), { buttons: BUTTON_JUMP }, 60);
    expect(opened.chute).toBe(CHUTE_PARACHUTE);
    const landed = fall(physics(), opened, {}, TICK_RATE * 12);
    expect(landed.grounded).toBe(true);
    expect(landed.chute).toBeUndefined();
  });

  it('steers with the movement keys, and crouch cuts it away', () => {
    const open = fall(physics(), high(), { buttons: BUTTON_JUMP }, 45);
    expect(open.chute).toBe(CHUTE_PARACHUTE);
    const steered = fall(physics(), open, { forward: 1, yaw: 0 }, TICK_RATE);
    expect(steered.pos.z - open.pos.z).toBeGreaterThan(CHUTE.steer * 0.8);
    expect(steered.chute).toBe(CHUTE_PARACHUTE);
    const cut = fall(physics(), steered, { buttons: BUTTON_CROUCH }, 20);
    expect(cut.chute).toBeUndefined();
    expect(cut.velY).toBeLessThan(-CHUTE.sink - 2);
  });

  it('a glider opens instead when you carry one: slower sink, fast forward flight', () => {
    const open = fall(physics(), high(), { buttons: BUTTON_JUMP }, 45, { glider: true });
    expect(open.chute).toBe(CHUTE_GLIDER);
    const flown = fall(physics(), open, { yaw: Math.PI / 2 }, TICK_RATE, { glider: true });
    expect(flown.pos.x - open.pos.x).toBeGreaterThan(CHUTE.glideSpeed * 0.8);
    expect(flown.velY).toBeGreaterThan(-CHUTE.sink);
  });

  it('the automatic opener (bots, and anyone jumping out of the plane) pulls the cord before the ground', () => {
    const bot = fall(physics(), high(), {}, TICK_RATE * 3, { autoChute: true });
    expect(bot.chute).toBe(CHUTE_PARACHUTE);
    const dropped = fall(physics(), { ...high(), drop: true }, {}, TICK_RATE * 3);
    expect(dropped.chute).toBe(CHUTE_PARACHUTE);
    expect(dropped.drop).toBeUndefined();
    // Nobody else's opens by itself.
    const plain = fall(physics(), high(), {}, TICK_RATE * 2);
    expect(plain.chute).toBeUndefined();
  });

  it('with a jetpack, jump is thrust, never the cord', () => {
    const s = fall(physics(), high(), { buttons: BUTTON_JUMP }, TICK_RATE * 2, { jetpack: true });
    expect(s.chute).toBeUndefined();
  });
});

describe('parachutes in a match', () => {
  const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000, fallDamage: true };
  let seq = 0;
  const input = (m: Match, c: Combatant, i: Partial<PlayerInput>) => m.queueInputs(c.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: c.yaw, pitch: 0, buttons: 0, ...i }]);

  it('landing under a parachute does no fall damage; the same drop without one kills', () => {
    const match = new Match(yard(), rules);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    match.step();
    a.move = high(50);
    b.move = { ...high(50), pos: { x: 6, y: 50, z: 6 } };
    let sawChute = false;
    for (let i = 0; i < TICK_RATE * 20; i++) {
      input(match, a, { buttons: BUTTON_JUMP });
      input(match, b, {});
      match.step();
      if (a.move.chute) sawChute = true;
      if (a.move.grounded && i > 10) break;
    }
    expect(sawChute).toBe(true);
    expect(a.alive).toBe(true);
    expect(a.health).toBe(PLAYER.maxHealth);
    expect(b.alive).toBe(false);
  });

  it('snapshots carry the canopy for other players to see, and a glider pickup changes it', () => {
    const match = new Match(yard([{ id: 'glider_1', kind: 'pickup', position: [16, 0, 12], item: 'core.glider', respawnSeconds: null }]), rules);
    const a = match.addHuman('a')!;
    match.step();
    a.move = { pos: { x: 16, y: 0, z: 12 }, velY: 0, grounded: true };
    input(match, a, {});
    match.step();
    expect(a.glider).toBe(true);
    expect(match.privateState(a.slot)?.gl).toBe(1);
    a.move = high(50);
    for (let i = 0; i < 40; i++) {
      input(match, a, { buttons: BUTTON_JUMP });
      match.step();
    }
    expect(match.playerSnapshots().find((p) => p.s === a.slot)?.ch).toBe(CHUTE_GLIDER);
  });
});
