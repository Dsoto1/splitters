import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_FIRE,
  BUTTON_MELEE,
  CORE_BOT_PROFILES,
  DEFAULT_DEATHMATCH_RULES,
  UNARMED,
  getWeapon,
  impactSpeed,
  initPhysics,
  unarmedStrike,
  weaponCode,
  type GameEvent,
  type PlayerInput,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };

function duel() {
  const match = new Match(makeMap([{ id: 'room', tile: 'core.room_large', x: 0, y: 0, z: 0, rotation: 0 }], [[0, 0, 0], [1.4, 0, 0]]), rules);
  const a = match.addHuman('a')!;
  const b = match.addHuman('b')!;
  a.move.pos = { x: 0, y: 0, z: 0 };
  b.move.pos = { x: 1.4, y: 0, z: 0 };
  // Facing +x.
  a.yaw = Math.PI / 2;
  let seq = 0;
  const tick = (i: Partial<PlayerInput> = {}): GameEvent[] => {
    seq++;
    match.queueInputs(a.slot, [{ seq, forward: 0, right: 0, yaw: Math.PI / 2, pitch: -0.15, buttons: 0, ...i }]);
    match.queueInputs(b.slot, [{ seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 }]);
    return match.step();
  };
  for (let i = 0; i < 5; i++) tick();
  return { match, a, b, tick };
}

const strikes = (ev: GameEvent[]) => ev.filter((e): e is Extract<GameEvent, { e: 'melee' }> => e.e === 'melee');

describe('unarmed quick melee', () => {
  it('picks a punch standing still, a kick moving forward or right after a punch', () => {
    expect(unarmedStrike(0, 1000)).toBe('punch');
    expect(unarmedStrike(1, 1000)).toBe('kick');
    expect(unarmedStrike(0, 10)).toBe('kick');
    expect(unarmedStrike(0, UNARMED.comboTicks + 1)).toBe('punch');
  });

  it('punches with a gun in hand: small damage and a stagger, then a kick shoves', () => {
    const { a, b, tick } = duel();
    expect(getWeapon(a.weapons.get(a.current)!.def.id).kind).not.toBe('melee');
    const hp = b.health;
    const ev = strikes(tick({ buttons: BUTTON_MELEE }));
    expect(ev).toHaveLength(1);
    expect(ev[0]!.u).toBe(1);
    expect(ev[0]!.hit).toBe(b.slot);
    expect(hp - b.health).toBeCloseTo(UNARMED.punch.damage, 0);
    expect(impactSpeed(b.impact)).toBeLessThan(1);
    // Held: no second strike; the cooldown runs, then a press inside the combo window kicks.
    expect(strikes(tick({ buttons: BUTTON_MELEE }))).toHaveLength(0);
    for (let i = 0; i < UNARMED.punch.cooldownTicks; i++) tick();
    const before = b.health;
    const kick = strikes(tick({ buttons: BUTTON_MELEE }));
    expect(kick[0]?.u).toBe(2);
    expect(before - b.health).toBeCloseTo(UNARMED.kick.damage, 0);
    expect(b.move.vx ?? 0).toBeGreaterThan(1);
  });

  it('keeps the gun ready: firing straight after a punch works', () => {
    const { a, tick } = duel();
    const gun = a.weapons.get(a.current)!;
    const mag = gun.mag;
    tick({ buttons: BUTTON_MELEE });
    tick({ buttons: BUTTON_FIRE });
    expect(gun.mag).toBe(mag - 1);
  });

  it('swings a held melee weapon instead', () => {
    const { a, b, tick } = duel();
    const knife = getWeapon('core.knife');
    a.weapons.set(weaponCode(knife), { def: knife, mag: 0, reserve: 0, alt: 0 });
    a.current = weaponCode(knife);
    a.raiseTicks = 0;
    const hp = b.health;
    const ev = strikes(tick({ buttons: BUTTON_MELEE }));
    expect(ev).toHaveLength(1);
    expect(ev[0]!.u).toBeUndefined();
    expect(hp - b.health).toBeGreaterThan(UNARMED.kick.damage);
  });

  it('bots out of ammo up close punch or kick', () => {
    const match = new Match(makeMap([{ id: 'room', tile: 'core.room_large', x: 0, y: 0, z: 0, rotation: 0 }], [[0, 0, 0], [1.5, 0, 0]]), rules, 3);
    const h = match.addHuman('h')!;
    const bot: Combatant = match.addBot('b', CORE_BOT_PROFILES[0]!)!;
    h.invulnerable = true;
    h.move.pos = { x: 0, y: 0, z: 0 };
    bot.move.pos = { x: 1.5, y: 0, z: 0 };
    // Only an empty gun.
    const pistol = getWeapon('core.pistol');
    bot.weapons.clear();
    bot.weapons.set(weaponCode(pistol), { def: pistol, mag: 0, reserve: 0, alt: 0 });
    bot.current = weaponCode(pistol);
    let n = 0;
    for (let t = 0; t < 60 * 6; t++) {
      match.queueInputs(h.slot, [{ seq: t + 1, forward: 0, right: 0, yaw: -Math.PI / 2, pitch: 0, buttons: 0 }]);
      n += strikes(match.step()).filter((e) => e.s === bot.slot && e.u).length;
      // Keep them close.
      if (Math.hypot(bot.move.pos.x - h.move.pos.x, bot.move.pos.z - h.move.pos.z) > 1.8) bot.move = { ...bot.move, pos: { x: h.move.pos.x + 1.5, y: bot.move.pos.y, z: h.move.pos.z } };
    }
    expect(n).toBeGreaterThan(0);
  });
});
