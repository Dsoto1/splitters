import { beforeAll, describe, expect, it } from 'vitest';
import {
  BOT_DIFFICULTIES,
  BUTTON_FIRE,
  BUTTON_THROW,
  CORE_BOT_PROFILES,
  DEFAULT_DEATHMATCH_RULES,
  PLAYER,
  SMOKE,
  THROWABLE_DEFS,
  getWeapon,
  initPhysics,
  loadMap,
  lookAngles,
  smokeBlocks,
  smokeRadius,
  weaponCode,
  type GameEvent,
  type MapDocument,
  type SmokeCloud,
  type ZoneSpec,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/**
 * The Smoke Grenade (owner, 2026-11-06): a cloud a few metres across for about 18 s that hides whoever is behind
 * it from players (drawn) and from bots and the match's sight checks, while bullets still go through.
 */

/** Open courtyard (x -4..28, z -4..20), nothing in it. */
function yard(): MapDocument {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = 0; x < 4; x++) for (let z = 0; z < 3; z++) tiles.push({ id: `y${x}_${z}`, tile: 'core.yard', x, y: z, z: 0, rotation: 0 });
  const r = loadMap(makeMap(tiles, [[0, 0, 8], [20, 0, 8]]));
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.map;
}

const give = (c: Combatant, id: string) => {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
  c.raiseTicks = 0;
};
const smokeZone = (match: Match, at: { x: number; y: number; z: number }) =>
  (match as unknown as { spawnZone(spec: ZoneSpec, at: { x: number; y: number; z: number }, owner: number, weapon: string): void }).spawnZone(THROWABLE_DEFS.smoke.projectile.zone!, at, -1, 'core.smoke');

describe('smoke clouds', () => {
  it('billow out over SMOKE.growSeconds, sit at the full radius, and thin out at the end', () => {
    const life = THROWABLE_DEFS.smoke.projectile.zone!.seconds;
    const R = THROWABLE_DEFS.smoke.projectile.zone!.radius;
    expect(R).toBeGreaterThanOrEqual(3);
    expect(life).toBeGreaterThanOrEqual(15);
    expect(life).toBeLessThanOrEqual(20);
    expect(smokeRadius(R, 0, life)).toBeCloseTo(R * SMOKE.start, 5);
    expect(smokeRadius(R, SMOKE.growSeconds / 4, life)).toBeLessThan(R);
    expect(smokeRadius(R, SMOKE.growSeconds, life)).toBeCloseTo(R, 5);
    expect(smokeRadius(R, life / 2, life)).toBeCloseTo(R, 5);
    expect(smokeRadius(R, life - SMOKE.fadeSeconds / 2, life)).toBeLessThan(R);
    expect(smokeRadius(R, life - SMOKE.clearSeconds / 2, life)).toBe(0);
  });

  it('block a sight line that crosses SMOKE.opaque metres of one, not one that passes beside it or a short one inside it', () => {
    const cloud: SmokeCloud[] = [{ x: 10, y: 2, z: 0, radius: 4 }];
    expect(smokeBlocks({ x: 0, y: 1.6, z: 0 }, { x: 20, y: 1.6, z: 0 }, cloud)).toBe(true);
    expect(smokeBlocks({ x: 0, y: 1.6, z: 6 }, { x: 20, y: 1.6, z: 6 }, cloud)).toBe(false);
    // Grazing its edge: 1.26 m of it (under SMOKE.opaque); a little further in, 1.78 m.
    expect(smokeBlocks({ x: 0, y: 2, z: 3.95 }, { x: 20, y: 2, z: 3.95 }, cloud)).toBe(false);
    expect(smokeBlocks({ x: 0, y: 2, z: 3.9 }, { x: 20, y: 2, z: 3.9 }, cloud)).toBe(true);
    // Inside it, someone a metre off is seen; someone 3 m off isn't.
    expect(smokeBlocks({ x: 10, y: 1.6, z: 0 }, { x: 11, y: 1.6, z: 0 }, cloud)).toBe(false);
    expect(smokeBlocks({ x: 10, y: 1.6, z: 0 }, { x: 13, y: 1.6, z: 0 }, cloud)).toBe(true);
    // Squashed up and down: a line over its top is clear.
    expect(smokeBlocks({ x: 0, y: 2 + 4 * SMOKE.squash + 0.3, z: 0 }, { x: 20, y: 2 + 4 * SMOKE.squash + 0.3, z: 0 }, cloud)).toBe(false);
  });

  it('come from the Smoke Grenade: thrown, it lies there, then a cloud billows up where it lies and is gone after about 18 s', () => {
    const match = new Match(yard(), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, respawnDelayTicks: 100_000 });
    const a = match.addHuman('a')!;
    a.move = { pos: { x: 2, y: 0, z: 8 }, velY: 0, grounded: true };
    a.throwable = { kind: 'smoke', count: 1 };
    let seq = 0;
    const look = lookAngles({ x: 2, y: PLAYER.eyeHeight, z: 8 }, { x: 10, y: 0, z: 8 });
    const step = (buttons = 0) => {
      match.queueInputs(a.slot, [{ seq: ++seq, forward: 0, right: 0, ...look, buttons }]);
      return match.step() as GameEvent[];
    };
    const thrown = [...step(BUTTON_THROW), ...step(BUTTON_THROW)];
    expect(thrown.some((e) => e.e === 'throw')).toBe(true);
    expect(match.smokeClouds()).toHaveLength(0);
    let first = -1;
    let full = 0;
    for (let t = 0; t < 25 * 60; t++) {
      step();
      const c = match.smokeClouds()[0];
      if (c && first < 0) {
        first = t;
        // Where it landed, a few metres out, its middle above the ground.
        expect(c.x).toBeGreaterThan(4);
        expect(c.y).toBeGreaterThan(0);
      }
      if (c) full = Math.max(full, c.radius);
      if (first >= 0 && !c) {
        const lasted = (t - first) / 60;
        expect(lasted).toBeGreaterThan(15);
        expect(lasted).toBeLessThan(20);
        break;
      }
    }
    expect(first).toBeGreaterThan(0);
    expect(full).toBeCloseTo(THROWABLE_DEFS.smoke.projectile.zone!.radius, 1);
    // Harmless: nobody standing in it was hurt.
    expect(a.health).toBe(PLAYER.maxHealth);
    match.destroy();
  });

  /** A bot at x 0 and a player at x 20 in an open yard, with or without a cloud halfway; the bot's shots at the player. */
  function standoff(smoke: boolean, seed: number): number {
    const match = new Match(yard(), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0 }, seed);
    const target = match.addHuman('target')!;
    const bot = match.addBot('shooter', { ...CORE_BOT_PROFILES[3]!, accuracy: 50, rangePreference: 75, aggression: 20, tags: [] }, BOT_DIFFICULTIES.normal, false)!;
    bot.move = { pos: { x: 0, y: 0, z: 8 }, velY: 0, grounded: true };
    target.move = { pos: { x: 20, y: 0, z: 8 }, velY: 0, grounded: true };
    give(bot, 'core.rifle');
    bot.throwable = null;
    if (smoke) {
      smokeZone(match, { x: 10, y: 0, z: 8 });
      // Let it billow out first (as it would while the bot was still looking elsewhere).
      for (let t = 0; t < SMOKE.growSeconds * 60; t++) match.step();
    }
    let seq = 0;
    let shots = 0;
    for (let t = 0; t < 4 * 60; t++) {
      match.queueInputs(target.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: -Math.PI / 2, pitch: 0, buttons: 0 }]);
      target.health = bot.health = 100;
      target.move.pos.x = 20;
      target.move.pos.z = 8;
      bot.move.pos.x = Math.min(bot.move.pos.x, 4);
      for (const e of match.step() as GameEvent[]) if (e.e === 'shot' && e.s === bot.slot) shots++;
    }
    match.destroy();
    return shots;
  }

  it("hide a player from a bot: it fires at them across open ground, and not through the cloud", () => {
    const open = [1, 2].reduce((n, s) => n + standoff(false, s), 0);
    const hidden = [1, 2].reduce((n, s) => n + standoff(true, s), 0);
    expect(open, `open ${open}, smoke ${hidden}`).toBeGreaterThan(5);
    expect(hidden, `open ${open}, smoke ${hidden}`).toBe(0);
  }, 120_000);

  it('let shots through: a round fired into the cloud still hits the player behind it', () => {
    const match = new Match(yard(), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, respawnDelayTicks: 100_000 });
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    a.move = { pos: { x: 0, y: 0, z: 8 }, velY: 0, grounded: true };
    b.move = { pos: { x: 20, y: 0, z: 8 }, velY: 0, grounded: true };
    give(a, 'core.rifle');
    smokeZone(match, { x: 10, y: 0, z: 8 });
    for (let t = 0; t < SMOKE.growSeconds * 60; t++) match.step();
    expect(match.sees({ x: 0, y: PLAYER.eyeHeight, z: 8 }, { x: 20, y: 1.2, z: 8 })).toBe(false);
    const look = lookAngles({ x: 0, y: PLAYER.eyeHeight, z: 8 }, { x: 20, y: 1.2, z: 8 });
    let seq = 0;
    let hit = false;
    for (let t = 0; t < 90 && !hit; t++) {
      match.queueInputs(a.slot, [{ seq: ++seq, forward: 0, right: 0, ...look, buttons: t < 2 ? BUTTON_FIRE : 0 }]);
      match.queueInputs(b.slot, [{ seq, forward: 0, right: 0, yaw: -Math.PI / 2, pitch: 0, buttons: 0 }]);
      match.step();
      hit = b.health < PLAYER.maxHealth;
    }
    expect(hit).toBe(true);
    match.destroy();
  });

  it('a hurt bot caught in the open throws smoke between itself and the enemy', () => {
    let threw = 0;
    for (const seed of [1, 2, 3]) {
      const match = new Match(yard(), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0 }, seed);
      const target = match.addHuman('target')!;
      const bot = match.addBot('tactician', { ...CORE_BOT_PROFILES[3]!, accuracy: 50, rangePreference: 75, aggression: 20, tags: [] }, BOT_DIFFICULTIES.normal, false)!;
      bot.move = { pos: { x: 0, y: 0, z: 8 }, velY: 0, grounded: true };
      target.move = { pos: { x: 22, y: 0, z: 8 }, velY: 0, grounded: true };
      give(bot, 'core.rifle');
      bot.throwable = { kind: 'smoke', count: 2 };
      let seq = 0;
      for (let t = 0; t < 8 * 60; t++) {
        match.queueInputs(target.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: -Math.PI / 2, pitch: 0, buttons: 0 }]);
        bot.health = 50;
        target.health = 100;
        target.move.pos.x = 22;
        target.move.pos.z = 8;
        match.step();
        const c = match.smokeClouds()[0];
        if (c) {
          // Between them, nearer the bot.
          expect(c.x).toBeGreaterThan(1);
          expect(c.x).toBeLessThan(16);
          threw++;
          break;
        }
      }
      match.destroy();
    }
    expect(threw).toBeGreaterThanOrEqual(2);
  }, 120_000);
});
