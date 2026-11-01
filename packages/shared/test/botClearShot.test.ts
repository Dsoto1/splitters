import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, DEFAULT_DEATHMATCH_RULES, getWeapon, initPhysics, loadMap, weaponCode, type GameEvent, type MapDocument, type MapEntity } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/**
 * Bots and the line their rounds actually take (BotBrain.clearShot). The
 * owner, spectating Shingle Point: "that rock is blocking a bunch of
 * bullets" (a gully boulder pocked with holes). Bots fired whenever their
 * aim was lined up on the target, even when the line from their eye (where
 * the sim starts every shot) ran into something in between.
 */

/** Open courtyard (x -4..28, z -4..20) with extra entities. */
function yard(extra: MapEntity[]): MapDocument {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = 0; x < 4; x++) for (let z = 0; z < 3; z++) tiles.push({ id: `y${x}_${z}`, tile: 'core.yard', x, y: z, z: 0, rotation: 0 });
  const map = makeMap(tiles, [[0, 0, 8], [20, 0, 8]]);
  map.entities.push(...extra);
  const r = loadMap(map);
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.map;
}

const block = (id: string, x: number, z: number, size: [number, number, number]): MapEntity => ({ id, kind: 'block', position: [x, 0, z], size, yaw: 0, material: 'core.pbr_concrete', tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 });

const give = (c: Combatant, id: string) => {
  const def = getWeapon(id);
  c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  c.current = weaponCode(def);
};

/**
 * A bot 20 m from a player who stands still behind a wall `wallHeight` tall,
 * 1.5 m in front of them (only what's above the wall shows). Rounds the bot
 * fired that hit the player, and that struck the world short of them (into
 * the wall), pooled over a few seeds.
 */
function behindWall(wallHeight: number, opts: { look?: string; seeds?: number[] } = {}) {
  let rounds = 0;
  let hits = 0;
  let short = 0;
  let blocked = 0;
  for (const seed of opts.seeds ?? [1, 2, 3]) {
    const match = new Match(yard([block('wall', 18.5, 8, [0.6, wallHeight, 4])]), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0 }, seed);
    const target = match.addHuman('target')!;
    const bot = match.addBot('shooter', { ...CORE_BOT_PROFILES[3]!, accuracy: 50, rangePreference: 75, aggression: 20, tags: [] }, BOT_DIFFICULTIES.normal, false, opts.look ? { look: opts.look } : undefined)!;
    bot.move = { pos: { x: 0, y: 0, z: 8 }, velY: 0, grounded: true };
    target.move = { pos: { x: 20, y: 0, z: 8 }, velY: 0, grounded: true };
    give(bot, 'core.rifle');
    let seq = 0;
    for (let t = 0; t < 8 * 60; t++) {
      match.queueInputs(target.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: -Math.PI / 2, pitch: 0, buttons: 0 }]);
      target.health = bot.health = 100;
      // Stay put behind the wall (the bot closing in or walking round it is another test).
      target.move.pos.x = 20;
      target.move.pos.z = 8;
      for (const w of bot.weapons.values()) w.reserve = w.def.reserveMax;
      for (const e of match.step() as GameEvent[]) {
        if (e.e !== 'shot' || e.s !== bot.slot) continue;
        e.to.forEach((to, i) => {
          if (e.fl?.includes(i)) return;
          rounds++;
          if (e.hit[i] === target.slot) hits++;
          else if (to[0] < target.move.pos.x - 1) short++;
        });
      }
    }
    blocked += bot.bot!.blockedShots;
    match.destroy();
  }
  return { rounds, hits, short, blocked };
}

describe('bots shoot only along a clear line', () => {
  it('a player whose head and shoulders show over low cover: the bot aims at what shows, not into the wall', () => {
    const r = behindWall(1.3);
    const msg = JSON.stringify(r);
    // Before: the bot aimed at the chest (hidden) and fired anyway: 92 of 93 rounds went into the wall, 1 hit.
    // Now (when written): 37 rounds, 34 hits, 3 short.
    expect(r.rounds, msg).toBeGreaterThan(20);
    expect(r.short / r.rounds, msg).toBeLessThan(0.15);
    expect(r.hits / r.rounds, msg).toBeGreaterThan(0.6);
    expect(r.blocked, msg).toBeGreaterThan(0);
  }, 120_000);

  it('a wall well below the line (0.4 m) holds nothing up: the bot keeps firing and hitting', () => {
    // Before: 47 rounds, 29 hits, 18 short (the wandering aim dipped into the wall and the ground before it).
    const r = behindWall(0.4);
    expect(r.rounds, JSON.stringify(r)).toBeGreaterThan(20);
    expect(r.hits / r.rounds, JSON.stringify(r)).toBeGreaterThan(0.6);
  }, 120_000);

  it("a small character's eye is lower: it sees, and shoots, only over what its own eye clears", () => {
    // 1.45 m: a standard eye (1.6) clears it, a small one (0.78 × 1.6 = 1.25) doesn't. The target's head shows over
    // it, so a small bot that took its eye for a standard one saw them and fired into the wall.
    // Before: 95 rounds, all 95 into the wall. Now (when written): 30 rounds, 25 hits.
    const r = behindWall(1.45, { look: 'core.goblin' });
    expect(r.short, JSON.stringify(r)).toBeLessThanOrEqual(Math.max(4, r.rounds * 0.25));
  }, 120_000);
});
