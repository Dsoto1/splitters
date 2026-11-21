// Bots don't all react in the same instant (docs/BOTS.md, "After a kill"; the owner, 2026-11-16, Shingle Point Team
// Deathmatch, the only player among 63 bots: "I saw them all pause, crouch and look in the same direction after I was
// shot down"). Each takes a kill in after a beat of its own, then does one of several things; none chase or hold the
// dead player's spot.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, TICK_RATE, horizontalDistance, initPhysics, loadMap, rulesForMode, type Vec3 } from '../src/index.ts';
import { BotBrain, Match, initNavigation, type Combatant } from '../src/match.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

describe('after a kill', () => {
  it("each bot's beat before it takes a kill in is its own: 0.2-1.2 s, by skill tier and seed", () => {
    const beats = (tier: keyof typeof BOT_DIFFICULTIES) => {
      const all: number[] = [];
      for (let slot = 0; slot < 60; slot++) {
        const b = new BotBrain(slot, CORE_BOT_PROFILES[slot % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES[tier], 5);
        const view = { tick: 1000, self: { slot, pos: { x: 0, y: 0, z: 0 } }, others: [] };
        const r = b as unknown as { targetDied(v: unknown, slot: number): void; afterKill: { at: number } };
        r.targetDied(view, 99);
        all.push((r.afterKill.at - 1000) / TICK_RATE);
      }
      return all;
    };
    const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
    for (const tier of ['easy', 'normal', 'hard'] as const) {
      const b = beats(tier);
      expect(Math.min(...b)).toBeGreaterThanOrEqual(0.2);
      expect(Math.max(...b)).toBeLessThanOrEqual(1.2);
      // Spread out, not one beat for all: at least 20 different ticks among 60 bots.
      expect(new Set(b).size).toBeGreaterThanOrEqual(20);
    }
    expect(mean(beats('hard'))).toBeLessThan(mean(beats('normal')));
    expect(mean(beats('normal'))).toBeLessThan(mean(beats('easy')));
  });

  it('Shingle Point: when the one player many bots are shooting at goes down, few change on any tick and they face many ways', () => {
    const r = loadMap(readFileSync(new URL('../../../maps/shingle_point.json', import.meta.url), 'utf8'));
    if (!r.ok) throw new Error('shingle_point failed to load');
    const match = new Match(r.map, { ...rulesForMode(r.map, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0 }, 7);
    const me = match.addHuman('me')!;
    for (let i = 0; i < 47; i++) match.addBot(`b${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal, true);
    const enemies = () => match.combatants().filter((c) => c.bot && c.alive && c.faction !== me.faction);
    const kill = (match as unknown as { kill(v: Combatant, k: Combatant | null, w: string): void }).kill.bind(match);
    for (let t = 0; t < TICK_RATE * 25; t++) match.step();
    let rounds = 0;
    for (let round = 0; round < 4 && rounds < 2; round++) {
      // The player walks into the thickest knot of the enemy, and stays up until a crowd of them is shooting.
      const es = enemies();
      let best = es[0]!;
      let most = -1;
      for (const e of es) {
        const n = es.filter((o) => horizontalDistance(o.move.pos, e.move.pos) < 25).length;
        if (n > most) [most, best] = [n, e];
      }
      const p = best.move.pos;
      me.move = { pos: { x: p.x + 4, y: p.y + 1.5, z: p.z + 1.2 }, velY: 0, grounded: false };
      for (let k = 0; k < TICK_RATE * 8 && enemies().filter((c) => c.bot!.target === me.slot).length < 8; k++) {
        me.health = 100;
        match.step();
      }
      const shooting = enemies().filter((c) => c.bot!.target === me.slot);
      if (shooting.length < 6) {
        for (let t = 0; t < TICK_RATE * 10; t++) match.step();
        continue;
      }
      rounds++;
      const fell: Vec3 = { ...me.move.pos };
      kill(me, shooting[0]!, 'rifle');
      const key = (c: Combatant) => `${c.bot!.state}/${c.move.stance ?? 0}`;
      const prev = new Map(shooting.map((c) => [c.slot, key(c)]));
      let most1 = 0;
      let facing = 0;
      let up = 0;
      const corpseChasers = new Set<number>();
      for (let i = 1; i <= TICK_RATE * 3; i++) {
        match.step();
        let changed = 0;
        for (const c of shooting) {
          const s = key(c);
          if (s !== prev.get(c.slot)) changed++;
          prev.set(c.slot, s);
          // After every beat is over (1.2 s): nobody goes after, or holds, the dead player's spot.
          const seen = c.bot!.lastSeen;
          if (i > TICK_RATE * 1.3 && c.alive && seen && horizontalDistance(seen.pos, fell) < 2 && (c.bot!.state === 'chase' || c.bot!.state === 'engage' || c.bot!.state === 'cover')) corpseChasers.add(c.slot);
        }
        most1 = Math.max(most1, changed);
        if (i === TICK_RATE * 1.5) {
          for (const c of shooting) {
            if (!c.alive) continue;
            up++;
            const a = Math.atan2(fell.x - c.move.pos.x, fell.z - c.move.pos.z);
            const d = Math.abs(((((c.yaw - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
            if (d < 0.35) facing++;
          }
        }
      }
      // (Before: 4-7 of 12 on one tick, and 9-10 of 12 still facing where the player fell 1.5 s on.)
      expect(most1).toBeLessThanOrEqual(3);
      expect(facing).toBeLessThanOrEqual(Math.ceil(up / 2));
      expect([...corpseChasers]).toEqual([]);
      for (let t = 0; t < TICK_RATE * 12; t++) match.step();
    }
    match.destroy();
    expect(rounds).toBe(2);
  }, 180_000);
});
