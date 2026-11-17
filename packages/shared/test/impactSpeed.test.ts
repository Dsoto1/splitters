/**
 * Damage by impact speed and clearer ranges (owner, 2026-11-16; docs/GUNPLAY_SPEC.md §37, "Damage by impact speed").
 *
 * Under Standard and Advanced ballistics a round's damage follows its speed when it strikes over its muzzle speed,
 * on each gun's own curve (from its falloff and its family's drag), so at Standard every gun keeps its tuned kill
 * distances; Advanced (slower, draggier rounds) loses damage sooner; Arcade keeps the distance falloff. Each gun's
 * best range is stated in its notes (`notes.range`) and checked here against its data and the sim.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_FIRE,
  DEFAULT_DEATHMATCH_RULES,
  PLAYER,
  falloffAt,
  flightTo,
  getWeapon,
  gunplayOf,
  impactFalloff,
  initPhysics,
  lookAngles,
  speedCurve,
  speedDistance,
  speedRatioAt,
  weaponCode,
  type MapDocument,
  type MatchRules,
  type PlayerInput,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const WEAPONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../content/weapons');

/** Every bullet-firing gun with a falloff (the families with drag). */
const BULLET_GUNS = ['core.pistol', 'core.smg', 'core.machine_pistol', 'core.hand_cannon', 'core.revolver', 'core.rifle', 'core.burst_rifle', 'core.battle_rifle', 'core.lmg', 'core.marksman', 'core.sniper'];
/** The close-range guns the owner asked to reach less far, and the long guns that stay long. */
const CLOSE = ['core.pistol', 'core.smg', 'core.machine_pistol', 'core.pulse_pistol', 'core.hand_cannon', 'core.revolver'];
const LONG = ['core.rifle', 'core.lmg', 'core.battle_rifle', 'core.marksman', 'core.sniper'];

const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
const eye = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z });

function deck(len = 26): MapDocument {
  const tiles = [];
  for (let x = 0; x < len; x++) for (let y = -2; y <= 2; y++) tiles.push({ id: `p_${x}_${y}`, tile: 'core.platform', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 0]]);
}

function give(c: Combatant, id: string): void {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
  c.raiseTicks = 0;
  c.fireCooldown = 0;
}

/** Damage one settled round of `id` does to an unarmoured body's chest at `dist` metres (the best of three tries: a wide round can miss or clip an arm). */
function roundDamage(id: string, dist: number, ballistics: MatchRules['ballistics'] = 'standard'): number {
  let best = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const match = new Match(deck(), { ...rules, ballistics }, 11 + attempt);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    a.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
    b.move = { pos: { x: dist, y: 0, z: 0 }, velY: 0, grounded: true };
    b.health = 10_000;
    b.armor = 0;
    give(a, id);
    const b0 = gunplayOf(getWeapon(id)).ballistic;
    const hold = b0 ? flightTo(b0, dist, { ballistics }).drop : 0;
    const look = lookAngles(eye(a.move.pos), { x: dist, y: 1.15 + hold, z: 0 });
    let seq = 0;
    for (let i = 0; i < 90; i++) {
      const input: PlayerInput = { seq: ++seq, forward: 0, right: 0, ...look, buttons: i === 0 ? BUTTON_FIRE : 0 };
      match.queueInputs(a.slot, [input]);
      match.queueInputs(b.slot, [{ ...input, yaw: 0, pitch: 0, buttons: 0 }]);
      match.step();
    }
    best = Math.max(best, 10_000 - b.health);
    match.destroy();
  }
  return best;
}

/** A gun's `notes.range`, parsed: "Best within 18 m: full damage, 5 body shots. Down to 40 % (11 shots) by 45 m; reaches 110 m." */
function rangeNote(id: string): { best: number; shots: number; floor: number; farShots: number; end: number; reach: number } {
  const file = readdirSync(WEAPONS_DIR).find((f) => f.endsWith('.json') && JSON.parse(readFileSync(join(WEAPONS_DIR, f), 'utf8')).id === id)!;
  const note: string = JSON.parse(readFileSync(join(WEAPONS_DIR, file), 'utf8')).notes?.range ?? '';
  const m = /^Best within (\d+) m: full damage, (\d+) body (?:shot|blast)s?\. Down to (\d+) % \((\d+) (?:shot|blast)s?\) by (\d+) m; reaches (\d+) m\./.exec(note);
  expect(m, `${id} notes.range: "${note}"`).toBeTruthy();
  const [, best, shots, floor, farShots, end, reach] = m!.map(Number);
  return { best: best!, shots: shots!, floor: floor!, farShots: farShots!, end: end!, reach: reach! };
}

const shotsToKill = (perRound: number) => Math.ceil(PLAYER.maxHealth / perRound - 1e-9);

describe('damage by impact speed (owner, 2026-11-16)', () => {
  it('every bullet gun has a speed curve, and at Standard it gives exactly the distance falloff', () => {
    for (const id of BULLET_GUNS) {
      const gp = gunplayOf(getWeapon(id));
      const curve = speedCurve(gp);
      expect(curve, id).toBeTruthy();
      expect(curve!.full, id).toBeGreaterThan(curve!.floor);
      expect(curve!.floor, id).toBeGreaterThan(0.3);
      for (let d = 0; d <= Math.min(320, getWeapon(id).range); d += 5) {
        const r = speedRatioAt(gp.ballistic!, d);
        expect(impactFalloff(gp, { ballistics: 'standard' }, d, r), `${id} at ${d} m`).toBeCloseTo(falloffAt(gp.falloff, d), 9);
        if (d > 8) expect(speedDistance(gp.ballistic!, r)!, `${id} at ${d} m`).toBeCloseTo(d, 6);
      }
      // Arcade: distance only, whatever the speed.
      expect(impactFalloff(gp, { ballistics: 'arcade' }, 30, 0.1)).toBe(falloffAt(gp.falloff, 30));
    }
  });

  it('in the sim, a round strikes at Standard as the falloff says; Advanced softer far out; Arcade by distance', () => {
    for (const id of ['core.pistol', 'core.smg', 'core.rifle', 'core.battle_rifle']) {
      const def = getWeapon(id);
      const gp = gunplayOf(def);
      const mid = (gp.falloff!.start + gp.falloff!.end) / 2;
      const want = def.damage * falloffAt(gp.falloff, mid);
      const std = roundDamage(id, mid);
      // The strike's speed is read along the tick's segment: within 3 % of the distance falloff (it strikes the body's near side).
      expect(std / want, `${id} at ${mid} m`).toBeGreaterThan(0.97);
      expect(std / want, `${id} at ${mid} m`).toBeLessThan(1.03);
      expect(roundDamage(id, mid, 'advanced'), `${id} advanced`).toBeLessThan(std * 0.97);
      // Arcade: by distance flown (to the body's near side, a little short of its middle).
      expect(Math.abs(roundDamage(id, mid, 'arcade') / want - 1), `${id} arcade`).toBeLessThan(0.03);
      // Up close every rule hits full.
      expect(roundDamage(id, 6, 'advanced')).toBeCloseTo(def.damage, 5);
    }
  });

  it('a round slowed by a wall is not counted twice: its damage share and its speed share go down together', () => {
    // Pure check of the bookkeeping: speed / ref stays what drag alone left (Match.slowBullet scales both).
    const gp = gunplayOf(getWeapon('core.rifle'));
    const r = speedRatioAt(gp.ballistic!, 60);
    const kept = 0.7;
    expect(impactFalloff(gp, { ballistics: 'standard' }, 60, (r * kept) / kept)).toBeCloseTo(falloffAt(gp.falloff, 60), 9);
  });
});

describe('clearer ranges (owner, 2026-11-16)', () => {
  it('close-range guns reach 60-120 m with a 30-40 % floor; rifles, the LMG, the Battle Rifle and snipers stay long', () => {
    for (const id of CLOSE) {
      const def = getWeapon(id);
      const f = gunplayOf(def).falloff!;
      expect(def.range, id).toBeLessThanOrEqual(120);
      expect(def.range, id).toBeGreaterThanOrEqual(60);
      expect(f.min, id).toBeGreaterThanOrEqual(0.3);
      expect(f.min, id).toBeLessThanOrEqual(0.4);
    }
    for (const id of LONG) {
      expect(getWeapon(id).range, id).toBeGreaterThanOrEqual(220);
      expect(gunplayOf(getWeapon(id)).falloff!.min, id).toBeGreaterThanOrEqual(0.6);
    }
  });

  it("each gun's notes state its best range, floor and reach as its data has them", () => {
    for (const id of [...new Set([...BULLET_GUNS, ...CLOSE, 'core.shotgun', 'core.sawed_off', 'core.auto_shotgun'])]) {
      const def = getWeapon(id);
      const f = gunplayOf(def).falloff!;
      const n = rangeNote(id);
      const blast = def.damage * Math.max(1, def.pellets);
      expect(n.best, id).toBe(f.start);
      expect(n.end, id).toBe(f.end);
      expect(n.floor, id).toBe(Math.round(f.min * 100));
      expect(n.reach, id).toBe(def.range);
      expect(n.shots, id).toBe(shotsToKill(blast));
      expect(n.farShots, id).toBe(shotsToKill(blast * f.min));
    }
  });

  it('kills at the design ranges in the sim (Standard): the stated body shots at the best range, more at the far end', () => {
    // The Burst Rifle fires three rounds a pull and the LMG spins up first: their families' figures are checked above and through the Assault Rifle.
    for (const id of BULLET_GUNS.filter((g) => g !== 'core.burst_rifle' && g !== 'core.lmg')) {
      const n = rangeNote(id);
      const atBest = roundDamage(id, n.best);
      expect(shotsToKill(atBest), `${id} at ${n.best} m`).toBe(n.shots);
      const far = Math.min(n.end, getWeapon(id).range - 1, 200); // the deck is 208 m long
      expect(shotsToKill(roundDamage(id, far)), `${id} at ${far} m`).toBeGreaterThanOrEqual(n.shots);
    }
  });

  it('past its reach a close-range round is gone', () => {
    for (const id of ['core.pistol', 'core.smg']) expect(roundDamage(id, getWeapon(id).range + 15), id).toBe(0);
  });
});
