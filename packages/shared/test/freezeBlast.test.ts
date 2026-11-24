import { beforeAll, describe, expect, it } from 'vitest';
import {
  BOT_DIFFICULTIES,
  BUTTON_ALT,
  CORE_BOT_PROFILES,
  BUTTON_FIRE,
  DEFAULT_DEATHMATCH_RULES,
  PLAYER,
  TICK_RATE,
  getWeapon,
  initPhysics,
  lookAngles,
  weaponCode,
  type GameEvent,
  type PlayerInput,
} from '../src/index.ts';
import { FREEZE_DPS, Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

/** The Freeze Ray's freeze blast (owner, 2026-11-24; QUEUE Features "Freeze Ray alt-fire: a freeze blast"). */
beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
const eye = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z });
const chest = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + 1, z: p.z });
const ray = getWeapon('core.freeze_ray');

function yard() {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4], [6, 0, 4], [12, 0, 4]]);
}

function setup() {
  const match = new Match(yard(), rules);
  let seq = 0;
  const input = (c: Combatant, i: Partial<PlayerInput>) => match.queueInputs(c.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
  const run = (n: number, each: () => void = () => {}) => {
    const out: GameEvent[] = [];
    for (let i = 0; i < n; i++) {
      each();
      out.push(...match.step());
    }
    return out;
  };
  const a = match.addHuman('a')!;
  const t = match.addHuman('t')!;
  const o = match.addHuman('o')!;
  a.move = { pos: { x: 0, y: 0, z: 4 }, velY: 0, grounded: true };
  t.move = { pos: { x: 6, y: 0, z: 4 }, velY: 0, grounded: true };
  o.move = { pos: { x: 12, y: 0, z: 4 }, velY: 0, grounded: true };
  a.weapons.set(weaponCode(ray), { def: ray, mag: 0, reserve: 0, alt: 0, heat: 0 });
  a.current = weaponCode(ray);
  a.raiseTicks = 0;
  const look = lookAngles(eye(a.move.pos), chest(t.move.pos));
  const aim = (buttons = 0) => input(a, { yaw: look.yaw, pitch: look.pitch, buttons });
  return { match, input, run, a, t, o, aim, heatAfter: 0 };
}

/** Fire the freeze blast at `t` and wait for the slow ball to arrive. */
function freeze(s: ReturnType<typeof setup>) {
  const ev = s.run(1, () => s.aim(BUTTON_ALT));
  s.heatAfter = s.a.weapons.get(weaponCode(ray))!.heat ?? 0;
  ev.push(...s.run(40, () => s.aim()));
  return ev;
}

describe('the freeze blast', () => {
  it('is the Freeze Ray\'s second trigger: a slow cold ball, a big share of the heat bar, its own 6 s cooldown', () => {
    expect(ray.alt).toMatchObject({ ammo: 'heat', kind: 'projectile', cooldownTicks: 6 * TICK_RATE });
    expect(ray.alt!.cost).toBeGreaterThanOrEqual(35);
    expect(ray.alt!.projectile).toMatchObject({ visual: 'frost', splashRadius: 0, status: { kind: 'freeze', seconds: 3 } });
    expect(ray.alt!.projectile!.speed).toBeLessThan(20);
  });

  it('holds whoever it hits in a solid block of ice: no moving or shooting, about 5 HP/s, full damage from anything else', () => {
    const s = setup();
    const ev = freeze(s);
    expect(ev.some((e) => e.e === 'ice' && e.on === 1 && e.s === s.t.slot)).toBe(true);
    expect(s.t.ice).toBeDefined();
    expect(s.t.frozenTicks).toBeGreaterThan(0);
    // The heat bar took its share.
    expect(s.heatAfter).toBeGreaterThan(0.5);
    // Frozen: can't walk.
    const at = { ...s.t.move.pos };
    const hp = s.t.health;
    s.run(TICK_RATE, () => s.input(s.t, { forward: 1 }));
    expect(Math.hypot(s.t.move.pos.x - at.x, s.t.move.pos.z - at.z)).toBeLessThan(0.01);
    expect(hp - s.t.health).toBeCloseTo(FREEZE_DPS, 0);
    // The block is in the snapshot (drawn, and solid in the clients' prediction).
    expect(s.match.snapshot([]).ic?.[0]?.[1]).toBe(s.t.slot);
    // Shots still reach them through the ice (the beam is hitscan).
    const before = s.t.health;
    s.run(6, () => s.aim(BUTTON_FIRE));
    expect(s.t.health).toBeLessThan(before - FREEZE_DPS * 0.2);
  });

  it('is solid to others while it lasts, then melts after about 3 s and they move again', () => {
    const s = setup();
    freeze(s);
    // Someone else walking into it from the far side stops at the ice.
    s.o.move = { pos: { x: 9, y: 0, z: 4 }, velY: 0, grounded: true };
    s.run(TICK_RATE, () => s.input(s.o, { yaw: -Math.PI / 2, forward: 1 }));
    expect(s.o.move.pos.x).toBeGreaterThan(s.t.move.pos.x + 0.5);
    // Melts at the end.
    const ev = s.run(3 * TICK_RATE);
    expect(ev.some((e) => e.e === 'ice' && e.on === 0 && !e.x)).toBe(true);
    expect(s.t.ice).toBeUndefined();
    expect(s.match.snapshot([]).ic).toBeUndefined();
    const at = s.t.move.pos.x;
    s.run(20, () => s.input(s.t, { yaw: Math.PI / 2, forward: 1 }));
    expect(Math.abs(s.t.move.pos.x - at)).toBeGreaterThan(0.3);
  });

  it('shatters when the one inside dies', () => {
    const s = setup();
    freeze(s);
    s.t.health = 1;
    const ev = s.run(TICK_RATE);
    expect(s.t.alive).toBe(false);
    expect(ev.some((e) => e.e === 'ice' && e.on === 0 && e.x === 1)).toBe(true);
  });

  it('waits out its cooldown (the beam fires on meanwhile)', () => {
    const s = setup();
    freeze(s);
    const w = s.a.weapons.get(weaponCode(ray))!;
    w.heat = 0;
    w.overheated = false;
    const again = s.run(30, () => s.aim(BUTTON_ALT));
    expect(again.filter((e) => e.e === 'shot' && e.alt)).toHaveLength(0);
    const beam = s.run(5, () => s.aim(BUTTON_FIRE));
    expect(beam.some((e) => e.e === 'shot' && !e.alt)).toBe(true);
    s.run(6 * TICK_RATE, () => s.aim());
    w.heat = 0;
    w.overheated = false;
    const ready = s.run(2, () => s.aim(BUTTON_ALT));
    expect(ready.some((e) => e.e === 'shot' && e.alt)).toBe(true);
  });

  it('a bot freezes a target up close with it, then keeps on the one held in the ice', () => {
    const match = new Match(yard(), rules);
    const t = match.addHuman('t')!;
    const bot = match.addBot('b', CORE_BOT_PROFILES[0]!, BOT_DIFFICULTIES.hard)!;
    bot.move = { pos: { x: 2, y: 0, z: 4 }, velY: 0, grounded: true };
    t.move = { pos: { x: 8, y: 0, z: 4 }, velY: 0, grounded: true };
    bot.weapons.clear();
    bot.weapons.set(weaponCode(ray), { def: ray, mag: 0, reserve: 0, alt: 0, heat: 0 });
    bot.current = weaponCode(ray);
    bot.raiseTicks = 0;
    let froze = false;
    let hurtWhileFrozen = 0;
    for (let i = 0; i < 8 * TICK_RATE && !froze; i++) {
      const hp = t.health;
      match.step();
      if (t.ice !== undefined) froze = true;
      if (froze) hurtWhileFrozen += hp - t.health;
    }
    expect(froze).toBe(true);
    const hp = t.health;
    for (let i = 0; i < TICK_RATE && t.alive; i++) match.step();
    // More than the ice's own 5 HP/s: the bot's beam on the frozen one.
    expect(hp - t.health + hurtWhileFrozen).toBeGreaterThan(FREEZE_DPS * 1.5);
  });
});
