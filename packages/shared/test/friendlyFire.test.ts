import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RULES, initPhysics, type MatchRules } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { getWeapon } from '../src/sim/weapons.ts';
import { makeMap } from './helpers.ts';

/**
 * Friendly fire (owner, 2026-11-07: "turned on, shots still don't hurt teammates, blasts knock them about without
 * damage"). The rule was only read by `damage()`: every hit test before it (bullets, pellets, rockets, the knife's
 * trace, burning) left teammates out, so nothing reached it. Each path is fired for real here, at a teammate and at
 * an enemy, with the rule off, half and full.
 */

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));
const room = () => makeMap([{ id: 'room', tile: 'core.yard', x: 0, y: 0, z: 0, rotation: 0 }], [[4, 0, 4]]);

type FF = MatchRules['friendlyFire'];
interface Internals {
  fireNow(shooter: Combatant, def: ReturnType<typeof getWeapon>, viewTick: number): void;
}

/** A 2 v 2 team match: you, a teammate and an enemy, the target `dist` m straight ahead (+z) at chest height. */
function setUp(ff: FF, mode: MatchRules['mode'] = 'core.tdm') {
  const rules: MatchRules = { ...DEFAULT_RULES[mode], teamSizes: [2, 2], ...(ff ? { friendlyFire: ff } : {}) };
  const match = new Match(room(), rules);
  const me = match.addHuman('me')!;
  const others = [0, 1, 2].map((i) => match.addHuman(`p${i}`)!);
  const mate = others.find((o) => o.faction === me.faction)!;
  const enemy = others.find((o) => o.faction !== me.faction)!;
  for (let i = 0; i < 5; i++) match.step();
  const ground = me.move.pos.y;
  // Everyone out of the line of fire but the target.
  const park = (c: Combatant, x: number, z: number) => (c.move = { ...c.move, pos: { x, y: ground, z }, velY: 0, grounded: true, vx: 0, vz: 0 });
  const fire = (target: Combatant, weapon: string, dist: number, ticks = 30, hp?: number) => {
    for (const c of [me, ...others]) {
      c.health = c.maxHealth;
      c.armor = 0;
      c.burnTicks = c.poisonTicks = 0;
      c.invulnerable = false;
    }
    park(me, 0, -3);
    for (const [i, c] of others.entries()) if (c !== target) park(c, -3 + i * 1.5, -5.5);
    park(target, 0, -3 + dist);
    if (hp !== undefined) target.health = hp;
    me.yaw = 0;
    me.pitch = 0;
    // The primary trigger (a weapon's `alt` is its second trigger: fired as the weapon itself it would be that).
    (match as unknown as Internals).fireNow(me, { ...getWeapon(weapon), alt: undefined }, 0);
    for (let i = 0; i < ticks; i++) {
      // Held in place (bots and players alike drift otherwise).
      for (const c of [me, target]) c.move = { ...c.move, vx: 0, vz: 0 };
      match.step();
    }
    return target.maxHealth - (target.alive ? target.health : 0);
  };
  return { match, me, mate, enemy, fire };
}

const paths: [string, string, number, number][] = [
  // [what, weapon, distance (m), ticks to watch]
  ['bullets (ballistic rounds)', 'core.rifle', 5, 20],
  ['pellets', 'core.shotgun', 3, 10],
  ['a rocket (its hit and its blast)', 'core.rockets', 5, 30],
  ['a blade', 'core.knife', 1.2, 2],
  ['fire and its burn (damage over time)', 'core.flamethrower', 2.5, 150],
];

describe('friendly fire', () => {
  for (const [what, weapon, dist, ticks] of paths) {
    it(`${what}: hurt an enemy always, a teammate only with the rule on (half: about half)`, () => {
      const off = setUp(undefined);
      expect(off.fire(off.enemy, weapon, dist, ticks)).toBeGreaterThan(0);
      expect(off.fire(off.mate, weapon, dist, ticks)).toBe(0);
      const full = setUp('on');
      const fullHurt = full.fire(full.mate, weapon, dist, ticks);
      expect(fullHurt).toBeGreaterThan(0);
      const half = setUp('half');
      const halfHurt = half.fire(half.mate, weapon, dist, ticks);
      expect(halfHurt).toBeGreaterThan(0);
      // Both runs fire the same seeded shot, so half is half (a kill in full caps it: at most full).
      expect(halfHurt).toBeLessThanOrEqual(fullHurt);
      if (fullHurt < full.mate.maxHealth) expect(halfHurt / fullHurt).toBeGreaterThan(0.35);
      if (fullHurt < full.mate.maxHealth) expect(halfHurt / fullHurt).toBeLessThan(0.65);
    });
  }

  it('fire on a teammate keeps burning them (the burn lands with the rule on, never with it off)', () => {
    const on = setUp('on');
    on.fire(on.mate, 'core.flamethrower', 2.5, 20);
    expect(on.mate.burnTicks).toBeGreaterThan(0);
    const off = setUp(undefined);
    off.fire(off.mate, 'core.flamethrower', 2.5, 20);
    expect(off.mate.burnTicks).toBe(0);
  });

  it('co-op and Breakthrough take the rule too', () => {
    const bt = setUp('on', 'core.breakthrough');
    expect(bt.fire(bt.mate, 'core.rifle', 5, 20)).toBeGreaterThan(0);
  });

  it('a team kill earns nothing', () => {
    const on = setUp('on');
    on.fire(on.mate, 'core.rockets', 2, 30, 5);
    expect(on.mate.alive).toBe(false);
    expect(on.me.kills).toBe(0);
  });
});
