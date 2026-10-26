import { readFileSync } from 'node:fs';
import { cpus, loadavg } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, MAX_PLAYER_SLOTS, SNAPSHOT_INTERVAL_TICKS, TICK_RATE, encodeSnapshots, initPhysics, isGameMode, loadMap, mapCanRun, rulesForMode, type GameEvent, type GameMode } from '@tiletrigger/shared';
import { Match, initNavigation, simProfile } from '@tiletrigger/shared/match';

/**
 * Headless load harness: runs a full match with N Player Bots as fast as
 * possible and reports per-tick cost against the 60 Hz budget.
 * Usage: pnpm bench [bots=96] [seconds=60] [map.json ...] [--npcs=N] [--mode=core.ctf] [--viewers=4]
 * (--viewers: how many of the bots stand in for connected players, see Match.watchers)
 * `pnpm bench:96`: the 48 v 48 check (96 bots, Frost Basin, Team Deathmatch, 60 s; target avg tick < 8 ms).
 * `pnpm bench:96:maps`: the same on the eight big maps, one after another, with a summary table.
 *
 * Each map reports avg/p50/p95/p99/max tick time (snapshots for --viewers
 * clients included) and where it goes: bot thinking, character moves, mounts
 * and ambient traffic, projectiles, scenario logic, snapshots; navmesh path
 * queries (count, failures, time), line-of-sight rays, stuck recoveries and
 * idle bots (alive and moved < 2 m over five seconds).
 *
 * --npcs adds N always-attacking enemy NPCs (spread over encounters at the
 * map's spawn points, endlessly reinforced) for mixed player + NPC load tests.
 * --mode plays that mode (with its default rules, no score or time limit; team
 * modes split the bots evenly) and reports its objective events: flag takes and
 * captures, hill holds, rounds, race checkpoints, laps and finishes.
 */
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const bots = Math.min(Number(args[0] ?? MAX_PLAYER_SLOTS), MAX_PLAYER_SLOTS);
const seconds = Number(args[1] ?? 60);
const npcs = Number(flags.find((f) => f.startsWith('--npcs='))?.slice(7) ?? 0);
const modeArg = flags.find((f) => f.startsWith('--mode='))?.slice(7);
if (modeArg !== undefined && !isGameMode(modeArg)) throw new Error(`unknown mode ${modeArg}`);
const mode = modeArg as GameMode | undefined;
/** Simulated clients the snapshots are encoded for (the server encodes one copy per connected player). */
const viewers = Number(flags.find((f) => f.startsWith('--viewers='))?.slice(10) ?? 4);
const here = (p: string) => resolve(process.env.INIT_CWD ?? process.cwd(), p);
const mapPaths = args.length > 2 ? args.slice(2).map(here) : [fileURLToPath(new URL('../../../../maps/phase0_arena.json', import.meta.url))];

await Promise.all([initPhysics(), initNavigation()]);
const rows: string[] = [];
for (const mapPath of mapPaths) rows.push(benchMap(mapPath));
if (rows.length > 1) {
  console.log('\n| Map | avg ms | p95 ms | max ms | bots ms | moves ms | nav queries/s (failed) | CPU ms | kills | idle | load |\n|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) console.log(r);
}
console.log(`load average ${loadavg().map((l) => l.toFixed(2)).join(' ')} (${cpus().length} cores)`);

function benchMap(mapPath: string): string {
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
  const rules = mode ? { ...rulesForMode(map, mode), scoreLimit: 0, timeLimitSeconds: 0 } : undefined;
  // Two-team modes: an even split of the bots (48 v 48 for 96).
  if (rules?.teamSizes?.length === 2) rules.teamSizes = [Math.ceil(bots / 2), Math.floor(bots / 2)];
  const match = new Match(map, rules, 42);
  for (let i = 0; i < bots; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal);
  // The first --viewers bots stand in for players: snapshots are encoded for them, and bots near them move at full detail.
  for (const c of match.combatants().slice(0, viewers)) match.watchers.add(c.slot);

  const tickMs: number[] = [];
  const aiMs: number[] = [];
  let kills = 0;
  let snapMs = 0;
  const objective = new Map<string, number>();
  const count = (ev: GameEvent) => {
    const key = ev.e === 'flag' ? `flag ${ev.a}` : ev.e === 'hill' ? `hill ${ev.a}` : ev.e === 'elim' ? `round ${ev.a}` : ev.e === 'race' ? `race ${ev.a}` : ev.e === 'round_end' && mode === 'core.race' ? 'races won' : null;
    if (key) objective.set(key, (objective.get(key) ?? 0) + 1);
  };
  // Idle: alive for the last five seconds and moved less than 2 m in them.
  const trail = new Map<number, { x: number; z: number }[]>();
  const moved = (t: { x: number; z: number }[]) => Math.hypot(t[t.length - 1]!.x - t[0]!.x, t[t.length - 1]!.z - t[0]!.z);
  let idleSamples = 0;
  let idleChecks = 0;
  const stuckBefore = match.combatants().reduce((s, c) => s + (c.bot?.stuckCount ?? 0), 0);
  simProfile.reset();
  simProfile.on = true;
  const start = performance.now();
  const cpu0 = process.cpuUsage();
  let pending: GameEvent[] = [];
  for (let i = 0; i < seconds * TICK_RATE; i++) {
    const t0 = performance.now();
    const events = match.step();
    for (const e of events) pending.push(e);
    let t1 = performance.now();
    if (match.tick % SNAPSHOT_INTERVAL_TICKS === 0) {
      const body = match.snapshot(pending);
      encodeSnapshots(body, Array.from({ length: Math.min(viewers, bots) }, (_, s) => ({ slot: s, ack: match.slots[s]?.lastSeq ?? 0, me: match.privateState(s) })));
      pending = [];
      const t2 = performance.now();
      snapMs += t2 - t1;
      t1 = t2;
    }
    kills += events.filter((e) => e.e === 'kill').length;
    if (mode) events.forEach(count);
    tickMs.push(t1 - t0);
    aiMs.push(match.lastAiMs);
    if (match.tick % TICK_RATE === 0) {
      for (const c of match.combatants()) {
        let t = trail.get(c.slot);
        if (!t) trail.set(c.slot, (t = []));
        if (!c.alive) t.length = 0;
        else t.push({ x: c.move.pos.x, z: c.move.pos.z });
        if (t.length > 6) t.shift();
        if (t.length === 6 && match.tick > TICK_RATE * 10) {
          idleChecks++;
          if (moved(t) < 2) idleSamples++;
        }
      }
    }
  }
  simProfile.on = false;
  const wall = (performance.now() - start) / 1000;
  const cpu = process.cpuUsage(cpu0);
  const cpuMs = (cpu.user + cpu.system) / 1000;
  const ticks = tickMs.length;

  const sorted = [...tickMs].sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const budget = 1000 / TICK_RATE;
  const stuck = match.combatants().reduce((s, c) => s + (c.bot?.stuckCount ?? 0), 0) - stuckBefore;
  const per = (k: string) => (simProfile.ms.get(k) ?? 0) / ticks;
  const n = (k: string) => simProfile.n.get(k) ?? 0;
  const idlePct = idleChecks ? (idleSamples / idleChecks) * 100 : 0;
  const idleNow = [...trail.values()].filter((t) => t.length === 6 && moved(t) < 2).length;
  const load = loadavg()[0]!;

  console.log(`\n== ${map.metadata.id} ${mode ?? ''} | bots ${bots} | npcs ${npcs} (alive at end ${[...match.npcs.values()].filter((c) => c.alive).length}) | simulated ${seconds}s in ${wall.toFixed(2)}s (${(seconds / wall).toFixed(1)}x realtime) | load ${load.toFixed(2)}`);
  console.log(`tick ms  avg ${avg(tickMs).toFixed(3)}  p50 ${pct(0.5).toFixed(3)}  p95 ${pct(0.95).toFixed(3)}  p99 ${pct(0.99).toFixed(3)}  max ${sorted[sorted.length - 1]!.toFixed(3)}  (budget ${budget.toFixed(2)}) | process CPU ${(cpuMs / ticks).toFixed(3)} ms a tick`);
  console.log(`per tick ms: bots ${per('bots').toFixed(2)} (nav ${per('nav').toFixed(2)}) | players ${per('players').toFixed(2)} (character moves ${per('move').toFixed(2)}: ${(n('move') / ticks).toFixed(0)} full + ${(n('moveCoarse') / ticks).toFixed(0)} coarse a tick) | mounts+ambient ${per('mounts').toFixed(2)} (physics broad-phase updates ${per('commit').toFixed(2)}) | projectiles ${per('projectiles').toFixed(2)} | scenario/logic ${per('scenario').toFixed(2)} | snapshots ${(snapMs / ticks).toFixed(2)} (${viewers} viewers)`);
  console.log(`nav: ${n('nav')} path queries (${(n('nav') / seconds).toFixed(0)}/s), ${n('navFail')} failed | line-of-sight rays ${(n('los') / ticks).toFixed(0)}/tick`);
  console.log(`kills ${kills} | bot stuck recoveries ${stuck} | idle (moved < 2 m in 5 s) ${idlePct.toFixed(1)}% of samples, ${idleNow} at the end`);
  if (mode) {
    const scores = [...match.teamScores()].map(([t, s]) => `${t} ${s}`).join(', ');
    console.log(`${mode}: ${[...objective].map(([k, v]) => `${k} ${v}`).join(' | ') || 'no objective events'} | team scores: ${scores}`);
  }
  match.destroy();
  return `| ${map.metadata.id} | ${avg(tickMs).toFixed(1)} | ${pct(0.95).toFixed(1)} | ${sorted[sorted.length - 1]!.toFixed(0)} | ${per('bots').toFixed(1)} | ${per('move').toFixed(1)} | ${(n('nav') / seconds).toFixed(0)} (${n('navFail')}) | ${(cpuMs / ticks).toFixed(1)} | ${kills} | ${idlePct.toFixed(0)}% | ${load.toFixed(1)} |`;
}
