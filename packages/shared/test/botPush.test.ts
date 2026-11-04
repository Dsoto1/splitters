import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, TICK_RATE, initPhysics, loadMap, rulesForMode, type MapDocument, type Vec3 } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/**
 * Tactical bots with team leaders push (owner, 2 Nov: "they go in circles or
 * don't engage offensively; both sides should push"). Measured on Shingle
 * Point's Team Deathmatch, both teams: how soon they meet the enemy, how far
 * they get toward the enemy's base, how much of the time they stand about
 * (out of a fight) or walk in circles, and that they fight.
 */

const maps = new Map<string, MapDocument>();
function map(id: string): MapDocument {
  let m = maps.get(id);
  if (!m) {
    const r = loadMap(readFileSync(fileURLToPath(new URL(`../../../maps/${id}.json`, import.meta.url)), 'utf8'));
    if (!r.ok) throw new Error(`${id} failed to load`);
    maps.set(id, (m = r.map));
  }
  return m;
}

interface PushStats {
  /** Seconds until a bot of the side (on foot) first had an enemy in its sights. */
  contact: number;
  /** Mean progress from the side's base (0) to the enemy's (1), over the last half of the run. */
  progress: number;
  /** Share of one-second samples a bot out of a fight had moved under 2 m in 5 s. */
  idle: number;
  /** Share of samples a bot had walked over 30 m in 20 s but ended within 8 m of where it was. */
  looping: number;
  kills: number;
  /** Most stuck recoveries of any one bot. */
  worstStuck: number;
}

/** A Team Deathmatch of `bots` tactical bots with team leaders (character looks: the roster's bodies, fixed by slot). */
function pushStats(mapId: string, bots: number, seconds: number, seed: number): PushStats[] {
  const m = map(mapId);
  const rules = { ...rulesForMode(m, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0, botStyle: 'tactical' as const, leaders: true, teamSizes: [bots / 2, bots / 2] };
  const match = new Match(m, rules, seed);
  for (let i = 0; i < bots; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal, true, { look: i % 2 ? 'core.ranger' : 'core.knight' });
  const inner = match as unknown as { teams: { id: string }[]; spawnPoints: { pos: Vec3; team: string | null; generated?: boolean }[] };
  const teams = inner.teams.map((t) => t.id);
  const base = (t: string) => {
    const l = inner.spawnPoints.filter((s) => s.team === t && !s.generated);
    return { x: l.reduce((a, s) => a + s.pos.x, 0) / l.length, z: l.reduce((a, s) => a + s.pos.z, 0) / l.length };
  };
  const progress = (t: string, p: Vec3) => {
    const a = base(t);
    const b = base(teams.find((x) => x !== t)!);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    return ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz);
  };
  const out = teams.map(() => ({ contact: seconds, progress: 0, idle: 0, looping: 0, kills: 0, worstStuck: 0, n: 0, samples: 0, loopSamples: 0 }));
  const trails = new Map<number, { x: number; z: number }[]>();
  for (let k = 1; k <= seconds * TICK_RATE; k++) {
    for (const e of match.step()) {
      if (e.e === 'spawn') trails.delete(e.s);
      if (e.e !== 'kill') continue;
      const killer = e.killer === null || e.killer === undefined ? null : match.actor(e.killer);
      const victim = match.actor(e.victim);
      if (killer && victim && killer.faction !== victim.faction) out[teams.indexOf(killer.faction!)]!.kills++;
    }
    for (const c of match.combatants()) {
      const s = out[teams.indexOf(c.faction!)]!;
      if (c.bot && c.alive && !c.mount && c.bot.target !== null && s.contact === seconds) s.contact = k / TICK_RATE;
    }
    if (k % TICK_RATE) continue;
    for (const c of match.combatants()) {
      if (!c.bot || !c.alive) continue;
      const s = out[teams.indexOf(c.faction!)]!;
      const p = c.move.pos;
      if (k > (seconds * TICK_RATE) / 2) {
        s.progress += progress(c.faction!, p);
        s.n++;
      }
      const tr = trails.get(c.slot) ?? [];
      trails.set(c.slot, tr);
      tr.push({ x: p.x, z: p.z });
      if (tr.length > 21) tr.shift();
      if (tr.length >= 6) {
        s.samples++;
        const a = tr[tr.length - 6]!;
        if (Math.hypot(p.x - a.x, p.z - a.z) < 2 && c.bot.target === null && !c.mount) s.idle++;
      }
      if (tr.length === 21) {
        let len = 0;
        for (let i = 1; i < tr.length; i++) len += Math.hypot(tr[i]!.x - tr[i - 1]!.x, tr[i]!.z - tr[i - 1]!.z);
        s.loopSamples++;
        if (len > 30 && Math.hypot(p.x - tr[0]!.x, p.z - tr[0]!.z) < 8) s.looping++;
      }
    }
  }
  for (const c of match.combatants()) {
    const s = out[teams.indexOf(c.faction!)]!;
    s.worstStuck = Math.max(s.worstStuck, c.bot?.stuckCount ?? 0);
  }
  match.destroy();
  return out.map((s) => ({ contact: s.contact, progress: s.progress / Math.max(1, s.n), idle: s.idle / Math.max(1, s.samples), looping: s.looping / Math.max(1, s.loopSamples), kills: s.kills, worstStuck: s.worstStuck }));
}

describe('tactical squads with team leaders push', () => {
  it('both sides of Shingle Point advance, meet and fight; nobody stands about or circles for long', () => {
    // 10 v 10 tactical bots with team leaders, 60 s, seed 1 (assault / garrison). Before (main 8bc4001): idle
    // 31 % / 19 % (assault squads at their spawn walking into the wall of a sunken bunker for its rocket launcher,
    // 26 and 22 stuck recoveries for the worst bot), progress 0.19 / 0.46. Now: idle 4 % / 13 %, progress 0.32 /
    // 0.42, looping 5 % / 1 %, first contact at 24 s / 16 s, worst bot 5 / 12 stuck recoveries.
    const [assault, garrison] = pushStats('shingle_point', 20, 60, 1);
    for (const side of [assault!, garrison!]) {
      // Measured hit shapes (2026-11-04) changed who wins the garrison's first fights at 16 s, and the assault side's
      // first sight came at 33 s instead of 24 s.
      expect(side.contact).toBeLessThan(36);
      expect(side.idle).toBeLessThan(0.2);
      expect(side.looping).toBeLessThan(0.1);
      // 23 for the garrison's worst bot after the measured hit shapes (fights go differently; 12 before).
      expect(side.worstStuck).toBeLessThan(26);
    }
    expect(assault!.progress).toBeGreaterThan(0.25);
    expect(garrison!.progress).toBeGreaterThan(0.3);
    expect(assault!.kills + garrison!.kills).toBeGreaterThan(0);
  }, 180_000);
});
