import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, MAX_PLAYER_SLOTS, TICK_RATE, initPhysics, loadMap } from '@chronosplit/shared';
import { Match, initNavigation } from '@chronosplit/shared/match';

/**
 * Headless load harness: runs a full match with N Player Bots as fast as
 * possible and reports per-tick cost against the 60 Hz budget.
 * Usage: pnpm bench [bots=32] [seconds=60] [map.json]
 */
const bots = Math.min(Number(process.argv[2] ?? MAX_PLAYER_SLOTS), MAX_PLAYER_SLOTS);
const seconds = Number(process.argv[3] ?? 60);
const mapPath = process.argv[4] ? resolve(process.env.INIT_CWD ?? process.cwd(), process.argv[4]) : fileURLToPath(new URL('../../../../maps/phase0_arena.json', import.meta.url));

await Promise.all([initPhysics(), initNavigation()]);
const loaded = loadMap(readFileSync(mapPath, 'utf8'));
if (!loaded.ok) throw new Error('map failed validation');
const match = new Match(loaded.map, undefined, 42);
for (let i = 0; i < bots; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal);

const tickMs: number[] = [];
const aiMs: number[] = [];
let kills = 0;
const start = performance.now();
for (let i = 0; i < seconds * TICK_RATE; i++) {
  const t0 = performance.now();
  kills += match.step().filter((e) => e.e === 'kill').length;
  tickMs.push(performance.now() - t0);
  aiMs.push(match.lastAiMs);
}
const wall = (performance.now() - start) / 1000;

const sorted = [...tickMs].sort((a, b) => a - b);
const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;
const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const budget = 1000 / TICK_RATE;
const stuck = match.combatants().reduce((s, c) => s + (c.bot?.stuckCount ?? 0), 0);

console.log(`bots ${bots} | simulated ${seconds}s in ${wall.toFixed(2)}s (${(seconds / wall).toFixed(1)}x realtime)`);
console.log(`tick ms  avg ${avg(tickMs).toFixed(3)}  p50 ${pct(0.5).toFixed(3)}  p99 ${pct(0.99).toFixed(3)}  max ${sorted[sorted.length - 1]!.toFixed(3)}  (budget ${budget.toFixed(2)})`);
console.log(`ai ms    avg ${avg(aiMs).toFixed(3)}  (${((avg(aiMs) / avg(tickMs)) * 100).toFixed(0)}% of tick)`);
console.log(`kills ${kills} | bot stuck recoveries ${stuck}`);
match.destroy();
