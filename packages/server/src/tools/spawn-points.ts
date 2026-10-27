import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, initPhysics, loadMap, rulesForMode, type GameMode } from '@tiletrigger/shared';
import { Match, initNavigation } from '@tiletrigger/shared/match';

/**
 * How many spawn points a big match makes up on each map (docs/BOTS.md, "Made-up spawn points"):
 *   pnpm --filter @tiletrigger/server spawn-points <players> <mode> <map.json>...
 * e.g. `spawn-points 96 core.tdm maps/frost_basin.json maps/riot_junction.json`. Prints the map's own
 * points, the made-up ones per side, the first few positions and the setup cost.
 */
await Promise.all([initPhysics(), initNavigation()]);
const args = process.argv.slice(2);
const n = Number(args[0]);
if (!(n > 0) || args.length < 3) {
  console.error('usage: spawn-points <players> <mode> <map.json>...');
  process.exit(1);
}
const mode = args[1] as GameMode;
for (const f of args.slice(2)) {
  const loaded = loadMap(readFileSync(resolve(process.env.INIT_CWD ?? process.cwd(), f), 'utf8'));
  if (!loaded.ok) continue;
  const rules = { ...rulesForMode(loaded.map, mode), scoreLimit: 0, timeLimitSeconds: 0 };
  if (rules.teamSizes?.length === 2) rules.teamSizes = [n / 2, n / 2];
  const t0 = performance.now();
  const m = new Match(loaded.map, rules, 42);
  const t1 = performance.now();
  for (let i = 0; i < n; i++) m.addBot(`b${i}`, CORE_BOT_PROFILES[i % 4]!, BOT_DIFFICULTIES.normal);
  for (let i = 0; i < 120; i++) m.step();
  const t2 = performance.now();
  const gen = m.spawnPoints.filter((s) => s.generated);
  const by = new Map<string | null, number>();
  for (const s of gen) by.set(s.team, (by.get(s.team) ?? 0) + 1);
  console.log(loaded.map.metadata.id, 'map spawns', m.spawnPoints.length - gen.length, 'made up', JSON.stringify([...by]), `build ${(t1 - t0).toFixed(0)} ms, add ${n} bots ${(t2 - t1).toFixed(0)} ms`);
  for (const s of gen.slice(0, 4)) console.log('  ', s.team, s.pos.x.toFixed(1), s.pos.y.toFixed(1), s.pos.z.toFixed(1));
  m.destroy();
}
