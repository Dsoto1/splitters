import { beforeAll, describe, expect, it } from 'vitest';
import {
  BLAST,
  BUTTON_FIRE,
  DEFAULT_DEATHMATCH_RULES,
  IMPACT,
  PLAYER,
  TICK_RATE,
  blastKnockback,
  blastThrow,
  getWeapon,
  hitImpact,
  impactSpeed,
  initPhysics,
  lookAngles,
  newImpact,
  stepImpact,
  stoppingPower,
  weaponCode,
  type MapDocument,
  type PlayerInput,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
const room = (spawns: [number, number, number][]): MapDocument => makeMap([{ id: 'room', tile: 'core.room_large', x: 0, y: 0, z: 0, rotation: 0 }], spawns);

function give(c: Combatant, id: string): void {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
  c.raiseTicks = 0;
  c.fireCooldown = 0;
}

describe('stopping power', () => {
  it('scales by weapon: a pistol barely, a shotgun or sniper noticeably', () => {
    const pistol = stoppingPower(getWeapon('core.pistol'));
    const shotgun = stoppingPower(getWeapon('core.shotgun'));
    const sniper = stoppingPower(getWeapon('core.sniper'));
    expect(pistol).toBeLessThan(0.2);
    expect(shotgun).toBeGreaterThan(0.6);
    expect(sniper).toBeGreaterThan(0.6);
    expect(stoppingPower({ ...getWeapon('core.pistol'), stoppingPower: 0.7 })).toBe(0.7);
    const a = newImpact();
    const b = newImpact();
    expect(hitImpact(a, pistol)).toBeLessThan(hitImpact(b, shotgun) / 3);
    expect(impactSpeed(a)).toBeGreaterThan(0.9);
    expect(impactSpeed(b)).toBeLessThan(0.75);
  });

  it('adds pellets up to the weapon, caps the stack, and never stun-locks', () => {
    const shotgun = stoppingPower(getWeapon('core.shotgun'));
    const s = newImpact();
    let shove = 0;
    // Eight pellets of one blast: the full stagger, not eight of them.
    for (let i = 0; i < 8; i++) shove += hitImpact(s, shotgun, 1 / 8);
    expect(shove).toBeCloseTo(IMPACT.shove * shotgun, 5);
    expect(1 - impactSpeed(s)).toBeCloseTo(IMPACT.slow * shotgun, 5);
    // Point blank, again and again: the shove stops at the cap, the slow at its own.
    for (let i = 0; i < 10; i++) shove += hitImpact(s, 1, 1);
    expect(shove).toBeLessThanOrEqual(IMPACT.maxShove + 1e-9);
    expect(1 - impactSpeed(s)).toBeLessThanOrEqual(IMPACT.maxSlow + 1e-9);
    // Sustained fire: within any stretch the slowed share is bounded by window / (window + immunity).
    const t = newImpact();
    let slowed = 0;
    const ticks = TICK_RATE * 5;
    for (let i = 0; i < ticks; i++) {
      if (i % 4 === 0) hitImpact(t, 1, 1);
      if (impactSpeed(t) < 1) slowed++;
      stepImpact(t);
    }
    const window = IMPACT.maxStaggerSeconds / (IMPACT.maxStaggerSeconds + IMPACT.immunitySeconds);
    expect(slowed / ticks).toBeLessThanOrEqual(window + 0.05);
    expect(slowed).toBeGreaterThan(0);
  });

  it('gives a short immunity after a stagger', () => {
    const s = newImpact();
    hitImpact(s, 0.9, 1);
    let n = 0;
    while (s.ticks > 0 && n++ < 200) stepImpact(s);
    expect(n).toBeLessThanOrEqual(Math.round(IMPACT.maxStaggerSeconds * TICK_RATE));
    expect(hitImpact(s, 1, 1)).toBe(0);
    expect(impactSpeed(s)).toBe(1);
    for (let i = 0; i < Math.round(IMPACT.immunitySeconds * TICK_RATE); i++) stepImpact(s);
    expect(hitImpact(s, 1, 1)).toBeGreaterThan(0);
  });

  it('in a match: a shotgun hit shoves the victim along the shot and slows them; a pistol hit barely', () => {
    const hit = (weapon: string) => {
      const match = new Match(room([[0, 0, 0], [4, 0, 0]]), rules);
      const a = match.addHuman('a')!;
      const b = match.addHuman('b')!;
      a.move.pos = { x: 0, y: 0, z: 0 };
      b.move.pos = { x: 4, y: 0, z: 0 };
      b.health = 1000;
      give(a, weapon);
      const look = lookAngles({ x: 0, y: PLAYER.eyeHeight, z: 0 }, { x: 4, y: 1.2, z: 0 });
      let seq = 0;
      let push = 0;
      let slow = 1;
      for (let i = 0; i < 12; i++) {
        const input: PlayerInput = { seq: ++seq, forward: 0, right: 0, ...look, buttons: i === 0 ? BUTTON_FIRE : 0 };
        match.queueInputs(a.slot, [input]);
        match.queueInputs(b.slot, [{ ...input, buttons: 0 }]);
        match.step();
        push = Math.max(push, b.move.vx ?? 0);
        slow = Math.min(slow, impactSpeed(b.impact));
      }
      return { push, slow };
    };
    const shotgun = hit('core.shotgun');
    const pistol = hit('core.pistol');
    expect(shotgun.push).toBeGreaterThan(1.5);
    expect(shotgun.slow).toBeLessThan(0.8);
    expect(pistol.push).toBeGreaterThan(0);
    expect(pistol.push).toBeLessThan(shotgun.push / 3);
    expect(pistol.slow).toBeGreaterThan(0.9);
  });
});

describe('explosion knockback', () => {
  it('gives every real explosion a throw, scaled by its damage; flames none', () => {
    expect(blastKnockback({ splashDamage: 120 })).toBeGreaterThan(10);
    expect(blastKnockback({ splashDamage: 100 })).toBeGreaterThan(8);
    expect(blastKnockback({ splashDamage: 12 })).toBe(0);
    expect(blastKnockback({ knockback: 16, splashDamage: 200 })).toBe(16);
    expect(blastKnockback(getWeapon('core.rockets').projectile!)).toBeGreaterThan(10);
  });

  it('lifts people near a blast up and out, falling off with distance', () => {
    const side = { x: 0.9, y: 0.43, z: 0 };
    const near = blastThrow(side, 1.5, 5, 11);
    const far = blastThrow(side, 4.5, 5, 11);
    // Up at least as hard as out at the side of a blast (it used to lift at about 0.45× the push).
    expect(near.y).toBeGreaterThan(11 * 0.8);
    expect(near.x).toBeGreaterThan(6);
    expect(far.y).toBeLessThan(near.y);
    expect(far.x).toBeLessThan(near.x);
    expect(far.y).toBeGreaterThan(0);
    expect(blastThrow(side, 6, 5, 11)).toEqual({ x: 0, y: 0, z: 0 });
    // From below throws higher than from above.
    expect(blastThrow({ x: 0, y: 1, z: 0 }, 1, 5, 11).y).toBeGreaterThan(blastThrow({ x: 0, y: -1, z: 0 }, 1, 5, 11).y);
  });

  it('keeps rocket jumps: your own rocket at your feet lifts you about 2-3 m, more than a jump', () => {
    const k = blastKnockback(getWeapon('core.rockets').projectile!);
    const self = blastThrow({ x: 0.1, y: 0.99, z: 0 }, 1.1, getWeapon('core.rockets').projectile!.splashRadius, k, true);
    const height = (self.y * self.y) / (2 * PLAYER.gravity);
    expect(height).toBeGreaterThan(1.8);
    expect(height).toBeLessThan(3.2);
    expect(height).toBeGreaterThan((PLAYER.jumpSpeed * PLAYER.jumpSpeed) / (2 * PLAYER.gravity) * 1.5);
    // Less sideways than a bystander gets.
    expect(BLAST.selfOut).toBeLessThan(BLAST.out);
  });

  it('in a match: a rocket next to a bot throws it up and away, and a rocket at your feet lifts you', () => {
    const match = new Match(room([[0, 0, 0], [6, 0, 0]]), rules);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    a.move.pos = { x: 0, y: 0, z: 0 };
    b.move.pos = { x: 6, y: 0, z: 0 };
    b.health = 1000;
    for (let i = 0; i < 30; i++) match.step();
    give(a, 'core.rockets');
    // At the floor just short of b.
    const look = lookAngles({ x: 0, y: PLAYER.eyeHeight, z: 0 }, { x: 4.8, y: 0, z: 0 });
    let seq = 0;
    let topB = 0;
    let topA = 0;
    let outB = 0;
    for (let i = 0; i < 90; i++) {
      match.queueInputs(a.slot, [{ seq: ++seq, forward: 0, right: 0, ...look, buttons: i === 0 ? BUTTON_FIRE : 0 }]);
      match.queueInputs(b.slot, [{ seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 }]);
      match.step();
      topB = Math.max(topB, b.move.pos.y);
      outB = Math.max(outB, b.move.pos.x);
    }
    expect(topB).toBeGreaterThan(1);
    expect(outB).toBeGreaterThan(7);
    // ...and lands again.
    expect(b.move.grounded).toBe(true);
    // Rocket jump: straight down at your own feet.
    a.health = 1000;
    give(a, 'core.rockets');
    a.reloadTicks = 0;
    a.reload = null;
    for (let i = 0; i < 40; i++) {
      match.queueInputs(a.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: -Math.PI / 2 + 0.05, buttons: i === 0 ? BUTTON_FIRE : 0 }]);
      match.step();
      topA = Math.max(topA, a.move.pos.y);
    }
    expect(topA).toBeGreaterThan(1.5);
  });
});
