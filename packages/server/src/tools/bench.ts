import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, MAX_PLAYER_SLOTS, TICK_RATE, initPhysics, isGameMode, loadMap, mapCanRun, rulesForMode, type GameEvent } from '@tiletrigger/shared';
import { Match, initNavigation } from '@tiletrigger/shared/match';

/**
 * Headless load harness: runs a full match with N Player Bots as fast as
 * possible and reports per-tick cost against the 60 Hz budget.
 * Usage: pnpm bench [bots=32] [seconds=60] [map.json] [--npcs=N] [--mode=core.ctf]
 *
 * --npcs adds N always-attacking enemy NPCs (spread over encounters at the
 * map's spawn points, endlessly reinforced) for mixed player + NPC load tests.
 * --mode plays that mode (with its default rules, no score or time limit) and
 * reports its objective events: flag takes and captures, hill holds, rounds,
 * race checkpoints, laps and finishes.
 */
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const bots = Math.min(Number(args[0] ?? MAX_PLAYER_SLOTS), MAX_PLAYER_SLOTS);
const seconds = Number(args[1] ?? 60);
const npcs = Number(flags.find((f) => f.startsWith('--npcs='))?.slice(7) ?? 0);
const mode = flags.find((f) => f.startsWith('--mode='))?.slice(7);
if (mode !== undefined && !isGameMode(mode)) throw new Error(`unknown mode ${mode}`);
const mapPath = args[2] ? resolve(process.env.INIT_CWD ?? process.cwd(), args[2]) : fileURLToPath(new URL('../../../../maps/phase0_arena.json', import.meta.url));

await Promise.all([initPhysics(), initNavigation()]);
const loaded = loadMap(readFileSync(mapPath, 'utf8'));
if (!loaded.ok) throw new Error('map failed validation');
const map = loaded.map;
if (npcs > 0) {
  const spawns = map.entities.filter((e) => e.kind === 'spawn');
  const groups = Math.min(spawns.length, Math.max(1, Math.ceil(npcs / 8)));
  for (let g = 0; g < groups; g++) {
    const size = Math.floor(npcs / groups) + (g < npcs % groups ? 1 : 0);
    map.entities.push({
      ...{ id: `bench_enc_${g}`, kind: 'encounter', position: spawns[(g * 3) % spawns.length]!.position, yaw: 0, faction: 'syndicate' },
      ...{ roster: { trooper: size, gunner: 0, heavy: 0 }, activeCap: size, reinforcements: 100000, perPlayer: 0, respawnSeconds: 0.5, radius: 4, order: 'attack', orderTarget: null, startActive: true, difficulty: 'normal' },
    } as (typeof map.entities)[number]);
  }
}
if (mode && !mapCanRun(map, mode)) throw new Error(`${map.metadata.id} can't run ${mode}`);
const match = new Match(map, mode ? { ...rulesForMode(map, mode), scoreLimit: 0, timeLimitSeconds: 0 } : undefined, 42);
for (let i = 0; i < bots; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal);

const tickMs: number[] = [];
const aiMs: number[] = [];
let kills = 0;
const objective = new Map<string, number>();
const count = (ev: GameEvent) => {
  const key = ev.e === 'flag' ? `flag ${ev.a}` : ev.e === 'hill' ? `hill ${ev.a}` : ev.e === 'elim' ? `round ${ev.a}` : ev.e === 'race' ? `race ${ev.a}` : ev.e === 'round_end' && mode === 'core.race' ? 'races won' : null;
  if (key) objective.set(key, (objective.get(key) ?? 0) + 1);
};
const start = performance.now();
for (let i = 0; i < seconds * TICK_RATE; i++) {
  const t0 = performance.now();
  const events = match.step();
  kills += events.filter((e) => e.e === 'kill').length;
  if (mode) events.forEach(count);
  tickMs.push(performance.now() - t0);
  aiMs.push(match.lastAiMs);
}
const wall = (performance.now() - start) / 1000;

const sorted = [...tickMs].sort((a, b) => a - b);
const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;
const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const budget = 1000 / TICK_RATE;
const stuck = match.combatants().reduce((s, c) => s + (c.bot?.stuckCount ?? 0), 0);

console.log(`bots ${bots} | npcs ${npcs} (alive at end ${[...match.npcs.values()].filter((c) => c.alive).length}) | simulated ${seconds}s in ${wall.toFixed(2)}s (${(seconds / wall).toFixed(1)}x realtime)`);
console.log(`tick ms  avg ${avg(tickMs).toFixed(3)}  p50 ${pct(0.5).toFixed(3)}  p99 ${pct(0.99).toFixed(3)}  max ${sorted[sorted.length - 1]!.toFixed(3)}  (budget ${budget.toFixed(2)})`);
console.log(`ai ms    avg ${avg(aiMs).toFixed(3)}  (${((avg(aiMs) / avg(tickMs)) * 100).toFixed(0)}% of tick)`);
console.log(`kills ${kills} | bot stuck recoveries ${stuck}`);
if (mode) {
  const scores = [...match.teamScores()].map(([t, n]) => `${t} ${n}`).join(', ');
  console.log(`${mode}: ${[...objective].map(([k, n]) => `${k} ${n}`).join(' | ') || 'no objective events'} | team scores: ${scores}`);
}
match.destroy();
