import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, TICK_RATE, initPhysics, loadMap, rulesForMode, type MapDocument, type Vec3 } from '../src/index.ts';
import { CtfMode, Match, ctfDefenders, initNavigation } from '../src/match.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/**
 * Capture the Flag bots run the flag (owner, 2026-11-05: "no bots are actually going for the flag, most just hang
 * out and do little"; 2026-11-06: "most of the team hung out in the tunnel/dugout area" on Diamond Park; "why would
 * some bots not be moving at all?" on Fernwood Moon). docs/BOTS.md, "Capture the Flag" and "Standing still".
 */

const maps = new Map<string, MapDocument>();
function map(id: string): MapDocument {
  let m = maps.get(id);
  if (!m) {
    const r = loadMap(readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8'));
    if (!r.ok) throw new Error(`${id} failed to load`);
    maps.set(id, (m = r.map));
  }
  return structuredClone(m);
}

/** A bot-only CTF match on the map's own team sizes (or `sizes`), bots added as the server adds them. */
function ctfMatch(id: string, seed: number, sizes?: number[]): Match {
  const m = map(id);
  const rules = { ...rulesForMode(m, 'core.ctf'), scoreLimit: 0, timeLimitSeconds: 0, ...(sizes ? { teamSizes: sizes } : {}) };
  const match = new Match(m, rules, seed);
  const n = rules.teamSizes!.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal, true);
  return match;
}

/** Fighting (or about to): standing still for it is fine. */
const FIGHTING = new Set(['fight', 'cover', 'retreat', 'chaseHold', 'throw', 'dodge']);

interface Watch {
  /** Seconds a bot out of a fight stood still (moved under 0.5 m in a second), all bots. */
  idle: number;
  alive: number;
  /** Seconds standing still with no route anywhere. */
  noPath: number;
  /** The longest a bot out of a fight stood still (s). */
  longest: number;
}

/** Plays until `stop` (checked every tick) or `seconds`, watching how long bots stand still. */
function watch(match: Match, seconds: number, stop: () => boolean): Watch {
  const w: Watch = { idle: 0, alive: 0, noPath: 0, longest: 0 };
  const last = new Map<number, Vec3>();
  const still = new Map<number, number>();
  for (let k = 1; k <= seconds * TICK_RATE && !stop(); k++) {
    match.step();
    if (k % TICK_RATE) continue;
    for (const c of match.combatants()) {
      if (!c.bot) continue;
      const before = last.get(c.slot);
      last.set(c.slot, { ...c.move.pos });
      if (!c.alive || c.mount || !before) {
        still.delete(c.slot);
        continue;
      }
      w.alive++;
      const moved = Math.hypot(c.move.pos.x - before.x, c.move.pos.z - before.z) + Math.abs(c.move.pos.y - before.y);
      if (moved >= 0.5 || FIGHTING.has(c.bot.doing) || c.bot.target !== null) {
        still.delete(c.slot);
        continue;
      }
      w.idle++;
      if (c.bot.doing === 'noPath') w.noPath++;
      const s = (still.get(c.slot) ?? 0) + 1;
      still.set(c.slot, s);
      w.longest = Math.max(w.longest, s);
    }
  }
  return w;
}

describe('CTF roles', () => {
  it('2 defenders a team on small teams, 3 on teams of 12 or more; everyone else attacks', () => {
    expect([2, 3, 4, 8, 11, 12, 16].map(ctfDefenders)).toEqual([1, 1, 2, 2, 2, 3, 3]);
    for (const [id, sizes, want] of [
      ['bunker_cross', [4, 4], 2],
      ['diamond_park', [12, 12], 3],
      ['sunken_kingdom', [16, 16], 3],
    ] as const) {
      const match = ctfMatch(id, 1, [...sizes]);
      match.step();
      const ctf = match.mode as CtfMode;
      for (const team of new Set(match.combatants().map((c) => c.faction))) {
        const roles = match.combatants().filter((c) => c.faction === team).map((c) => ctf.botPlan.roles.get(c.slot));
        expect(roles.filter((r) => r === 'defend').length, `${id} ${team}`).toBe(want);
        expect(roles.filter((r) => r === 'attack').length).toBe(roles.length - want);
      }
      match.destroy();
    }
  }, 120_000);
});

describe('CTF bots run the flag', () => {
  // Before (main 5739da41): Diamond Park 12 v 12, 0 and 1 captures in two 5-minute matches (0.5 and 4.5 flag
  // takes), bots standing still out of a fight 33 % of the time, 29 % with no route (the dugouts); Sunken Kingdom
  // 16 v 16, no capture in two (half a take a match). docs/BOTS.md has the numbers for every CTF map.
  it('Diamond Park: a capture within five minutes; nobody stands about (the dugouts are left)', () => {
    const match = ctfMatch('diamond_park', 1);
    let captures = 0;
    const ctf = match.mode as CtfMode;
    const w = watch(match, 300, () => (captures = [...ctf.captures.values()].reduce((a, b) => a + b, 0)) > 0);
    match.destroy();
    expect(captures).toBeGreaterThan(0);
    expect(w.idle / w.alive).toBeLessThan(0.08);
    expect(w.noPath / w.alive).toBeLessThan(0.01);
    expect(w.longest).toBeLessThan(30);
  }, 600_000);

  it('Sunken Kingdom: a capture over the 155 m between the flags within five minutes', () => {
    // (Seed 1: the first capture at 227 s, after 9 flag runs; seeds 2 and 3 at 233 s and 134 s.)
    const match = ctfMatch('sunken_kingdom', 1);
    let captures = 0;
    const ctf = match.mode as CtfMode;
    const w = watch(match, 300, () => (captures = [...ctf.captures.values()].reduce((a, b) => a + b, 0)) > 0);
    match.destroy();
    expect(captures).toBeGreaterThan(0);
    expect(w.idle / w.alive).toBeLessThan(0.1);
  }, 600_000);
});

describe('no standing about where the navmesh is cut off or a door is shut', () => {
  it("Diamond Park: a bot spawned in a dugout (a patch of navmesh the steps cut off) gets out", () => {
    const match = ctfMatch('diamond_park', 2, [1, 1]);
    match.step();
    const bot = match.combatants().find((c) => c.faction === 'away')!;
    bot.move = { pos: { x: 16, y: -1.2, z: -10 }, velY: 0, grounded: true };
    let out = -1;
    for (let t = 0; t < TICK_RATE * 20 && out < 0; t++) {
      match.step();
      if (bot.alive && bot.move.pos.y > -0.3 && (bot.move.pos.x < 8 || bot.move.pos.x > 24 || bot.move.pos.z > -7.5)) out = t;
    }
    match.destroy();
    expect(out).toBeGreaterThanOrEqual(0);
    expect(out).toBeLessThan(TICK_RATE * 12);
  }, 60_000);

  it("Capitol Mall: a bot that ends up in the reflecting pool climbs out over its rim (a patch the rim cuts off)", () => {
    const match = ctfMatch('capitol_mall', 1, [1, 1]);
    match.step();
    const bot = match.combatants()[0]!;
    bot.move = { pos: { x: -77, y: -0.75, z: 2 }, velY: 0, grounded: true };
    let out = -1;
    for (let t = 0; t < TICK_RATE * 20 && out < 0; t++) {
      match.step();
      if (bot.alive && bot.move.pos.y > -0.3 && Math.abs(bot.move.pos.z) > 7) out = t;
    }
    match.destroy();
    expect(out).toBeGreaterThanOrEqual(0);
    expect(out).toBeLessThan(TICK_RATE * 12);
  }, 60_000);

  it("Fernwood Moon: the Garrison's bots spawned in their bunker leave by their own rear door (the blast door is the enemy's)", () => {
    const match = ctfMatch('fernwood_moon', 1, [1, 1]);
    match.step();
    const bot = match.combatants().find((c) => c.faction === 'tide')!;
    bot.move = { pos: { x: -8.2, y: -0.15, z: -80.8 }, velY: 0, grounded: true };
    let out = -1;
    for (let t = 0; t < TICK_RATE * 20 && out < 0; t++) {
      match.step();
      if (bot.alive && bot.move.pos.z < -90.5) out = t;
    }
    match.destroy();
    expect(out).toBeGreaterThanOrEqual(0);
    expect(out).toBeLessThan(TICK_RATE * 12);
  }, 60_000);
});

describe('holding a spot looks alive', () => {
  it('a defender at its flag moves between places round it and looks about, crouching now and then', () => {
    // Two bots on one side and nobody on the other: one defends (a team of bots keeps an attacker), in peace.
    const m = map('bunker_cross');
    const match = new Match(m, { ...rulesForMode(m, 'core.ctf'), scoreLimit: 0, timeLimitSeconds: 0, teamSizes: [2, 2] }, 3);
    const ctf = match.mode as CtfMode;
    const team = ctf.flags[0]!.team;
    for (let i = 0; i < 2; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i + 1]!, BOT_DIFFICULTIES.normal, true, { team });
    match.step();
    const defender = match.combatants().find((c) => ctf.botPlan.roles.get(c.slot) === 'defend')!;
    expect(defender).toBeDefined();
    const base = ctf.flagOf(team)!.base;
    const spots = new Set<string>();
    let turned = 0;
    let crouched = 0;
    let yaw = defender.yaw;
    let seconds = 0;
    for (let t = 0; t < TICK_RATE * 40; t++) {
      match.step();
      if (!defender.alive || Math.hypot(defender.move.pos.x - base.x, defender.move.pos.z - base.z) > 10) continue;
      turned += Math.abs(Math.atan2(Math.sin(defender.yaw - yaw), Math.cos(defender.yaw - yaw)));
      yaw = defender.yaw;
      if (defender.move.stance === 1) crouched++;
      if (t % TICK_RATE === 0) {
        seconds++;
        spots.add(`${Math.round(defender.move.pos.x / 2)},${Math.round(defender.move.pos.z / 2)}`);
      }
    }
    match.destroy();
    expect(seconds).toBeGreaterThan(20);
    // Several places (2 m cells) in 40 s, a good deal of looking about, and some time crouched.
    expect(spots.size).toBeGreaterThanOrEqual(3);
    expect(turned / seconds).toBeGreaterThan(0.3);
    expect(crouched).toBeGreaterThan(TICK_RATE * 2);
  }, 60_000);
});

