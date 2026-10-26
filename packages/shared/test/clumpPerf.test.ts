import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, TICK_RATE, initPhysics, loadMap, rulesForMode } from '../src/index.ts';
import { Match, clumpArea, clumpInto, initNavigation, simProfile } from '../src/match.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/**
 * 48 v 48 with every bot in one fight (docs/MAP_BUDGETS.md, "Clumped 48 v
 * 48"): sight lines, aim and hit tests grow with the square of the crowd, so a
 * clump must not cost much more per tick than the same match spread out.
 * Measured as process CPU time over the same number of ticks in one process,
 * so the ratio holds on a busy CI box where absolute milliseconds don't.
 */
describe('clumped 96-bot match', () => {
  it('costs at most about a third more CPU a tick than spread out, with bounded sight-line work', () => {
    const loaded = loadMap(readFileSync(new URL('../../../maps/riot_junction.json', import.meta.url), 'utf8'));
    if (!loaded.ok) throw new Error('map failed validation');
    const match = new Match(loaded.map, { ...rulesForMode(loaded.map, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0, teamSizes: [48, 48] }, 42);
    for (let i = 0; i < 96; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal);
    for (const c of match.combatants().slice(0, 4)) match.watchers.add(c.slot);
    const ticks = TICK_RATE * 4;
    const run = (clumped: ReturnType<typeof clumpArea> | null): { cpu: number; rays: number; steering: number; kills: number } => {
      simProfile.reset();
      simProfile.on = true;
      const t0 = process.cpuUsage();
      let kills = 0;
      for (let i = 0; i < ticks; i++) {
        const events = match.step();
        for (const e of events) if (e.e === 'kill') kills++;
        if (clumped) {
          const back = events.filter((e) => e.e === 'spawn').map((e) => (e as { s: number }).s);
          if (back.length) clumpInto(match, clumped, back, match.tick);
        }
      }
      const t = process.cpuUsage(t0);
      simProfile.on = false;
      return { cpu: (t.user + t.system) / 1000 / ticks, rays: (simProfile.n.get('los') ?? 0) / ticks, steering: simProfile.n.get('botSteer') ?? 0, kills };
    };
    try {
      // Warm up (JIT, everyone spawned and on the move), then spread out vs everyone in one 40 m patch.
      for (let i = 0; i < TICK_RATE * 5; i++) match.step();
      const spread = run(null);
      const area = clumpArea(match, 20);
      clumpInto(match, area, undefined, 7);
      run(area);
      const clumped = run(area);
      process.stderr.write(`clumped 48 v 48: CPU ${clumped.cpu.toFixed(2)} ms a tick vs ${spread.cpu.toFixed(2)} spread (x${(clumped.cpu / spread.cpu).toFixed(2)}), ${clumped.rays.toFixed(0)} sight rays a tick, ${clumped.kills} kills\n`);
      // It is a fight: plenty of kills, fighting bots steer between thoughts.
      expect(clumped.kills).toBeGreaterThan(20);
      expect(clumped.steering).toBeGreaterThan(ticks * 5);
      // Perception casts a few rays per look however many enemies are in view (was ~200 a tick).
      expect(clumped.rays).toBeLessThan(90);
      // The budget: within 1.35x of the spread-out match's CPU a tick (it measured 0.9-1.2x).
      expect(clumped.cpu / spread.cpu).toBeLessThan(1.35);
    } finally {
      simProfile.on = false;
      match.destroy();
    }
  }, 180_000);
});
