import { readFileSync } from 'node:fs';
import { cpus, loadavg } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, MAX_PLAYER_SLOTS, SNAPSHOT_INTERVAL_TICKS, TICK_RATE, encodeSnapshots, initPhysics, isGameMode, loadMap, mapCanRun, rulesForMode, type GameEvent, type GameMode } from '@tiletrigger/shared';
import { Match, clumpArea, clumpInto, initNavigation, simProfile } from '@tiletrigger/shared/match';

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
 *
 * --warmup=S plays S seconds before measuring. --clump[=R] (two-team modes)
 * then puts every bot on a patch of open ground R m across (default 40) in
 * the middle of the map, each team on its own half, and puts each bot back
 * there when it respawns: everyone sees many enemies at once, the worst case
 * for bot thinking. --variants=spread,clump runs each map both ways.
 * `pnpm bench:96:clump`: 48 v 48 spread and clumped on three maps.
 * Every run also prints process CPU time per tick (avg and p95, measured
 * tick by tick) and a breakdown: bot thinking (perception, decisions, paths,
 * aim, line-of-sight rays), movement, combat (firing and bullets in flight)
 * and the rest. The breakdown is timed by the wall clock, so on a loaded box
 * it is scaled by CPU / wall to compare with the CPU columns.
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
const warmup = Number(flags.find((f) => f.startsWith('--warmup='))?.slice(9) ?? 0);
const clumpFlag = flags.find((f) => f === '--clump' || f.startsWith('--clump='));
const clumpSize = clumpFlag?.includes('=') ? Number(clumpFlag.slice(8)) : 40;
/** --skills=mixed: bots are easy, normal and hard in turn (accuracy is then reported per skill); default all normal. */
const mixedSkills = flags.includes('--skills=mixed');
const SKILLS = ['easy', 'normal', 'hard'] as const;
const variants = (flags.find((f) => f.startsWith('--variants='))?.slice(11).split(',') ?? [clumpFlag ? 'clump' : 'spread']) as ('spread' | 'clump')[];
const here = (p: string) => resolve(process.env.INIT_CWD ?? process.cwd(), p);
const mapPaths = args.length > 2 ? args.slice(2).map(here) : [fileURLToPath(new URL('../../../../maps/phase0_arena.json', import.meta.url))];

await Promise.all([initPhysics(), initNavigation()]);
const rows: string[] = [];
const cpuRows: string[] = [];
for (const mapPath of mapPaths) {
  for (const v of variants) {
    const r = benchMap(mapPath, v === 'clump');
    rows.push(r.row);
    cpuRows.push(r.cpuRow);
  }
}
if (rows.length > 1) {
  console.log('\n| Map | avg ms | p95 ms | max ms | bots ms | moves ms | nav queries/s (failed) | CPU ms | kills | idle | load |\n|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) console.log(r);
  console.log('\nProcess CPU per tick (breakdown scaled from wall clock by CPU / wall):');
  console.log('| Map | layout | CPU avg ms | CPU p95 ms | bot think | (perception | decisions | paths | aim | LOS rays/tick) | movement | combat | rest | kills | load |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of cpuRows) console.log(r);
}
console.log(`load average ${loadavg().map((l) => l.toFixed(2)).join(' ')} (${cpus().length} cores)`);

function benchMap(mapPath: string, clump: boolean): { row: string; cpuRow: string } {
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
  for (let i = 0; i < bots; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES[mixedSkills ? SKILLS[i % 3]! : 'normal']);
  // The first --viewers bots stand in for players: snapshots are encoded for them, and bots near them move at full detail.
  for (const c of match.combatants().slice(0, viewers)) match.watchers.add(c.slot);
  for (let i = 0; i < warmup * TICK_RATE; i++) match.step();
  if (clump && rules?.teamSizes?.length !== 2) throw new Error('--clump needs a two-team mode (--mode=core.tdm)');
  const area = clump ? clumpArea(match, clumpSize / 2) : null;
  if (area) clumpInto(match, area, undefined, 7);

  const tickMs: number[] = [];
  const aim = new Map<string, { rounds: number; hits: number }>();
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
  const cpuTick: number[] = [];
  let lastCpu = cpu0;
  for (let i = 0; i < seconds * TICK_RATE; i++) {
    const t0 = performance.now();
    const events = match.step();
    // Clumped: respawned bots go straight back into the fight.
    if (area) {
      const back = events.filter((e) => e.e === 'spawn').map((e) => (e as { s: number }).s);
      if (back.length) clumpInto(match, area, back, match.tick);
    }
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
    // Accuracy per bot skill: rounds fired, and rounds that hit someone (at once, or after flying).
    for (const e of events) {
      if (e.e !== 'shot' && e.e !== 'impact') continue;
      const skill = match.actor(e.s)?.bot?.difficulty.id;
      if (!skill) continue;
      const a = aim.get(skill) ?? aim.set(skill, { rounds: 0, hits: 0 }).get(skill)!;
      if (e.e === 'shot') {
        a.rounds += e.hit.length;
        for (const h of e.hit) if (h !== null) a.hits++;
      } else if (e.hit !== null) a.hits++;
    }
    if (mode) events.forEach(count);
    tickMs.push(t1 - t0);
    const nowCpu = process.cpuUsage();
    cpuTick.push((nowCpu.user - lastCpu.user + nowCpu.system - lastCpu.system) / 1000);
    lastCpu = nowCpu;
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

  const cpuSorted = [...cpuTick].sort((a, b) => a - b);
  const cpuP95 = cpuSorted[Math.min(cpuSorted.length - 1, Math.floor(cpuSorted.length * 0.95))]!;
  const wallTotal = tickMs.reduce((s, v) => s + v, 0);
  const k = cpuMs / wallTotal;
  const think = per('bots');
  const fire = per('fire');
  const movement = per('players') - fire + per('mounts');
  const combat = fire + per('projectiles');
  const rest = avg(tickMs) - think - movement - combat;
  const c2 = (v: number) => (v * k).toFixed(2);
  console.log(`\n== ${map.metadata.id} ${mode ?? ''} ${clump ? `CLUMPED (${clumpSize} m, ${area!.sides.size} sides, ${[...area!.sides.values()].map((s) => s.length).join('/')} spots)` : 'spread'} | warm-up ${warmup}s | bots ${bots} | npcs ${npcs} (alive at end ${[...match.npcs.values()].filter((c) => c.alive).length}) | simulated ${seconds}s in ${wall.toFixed(2)}s (${(seconds / wall).toFixed(1)}x realtime) | load ${load.toFixed(2)}`);
  console.log(`tick ms  avg ${avg(tickMs).toFixed(3)}  p50 ${pct(0.5).toFixed(3)}  p95 ${pct(0.95).toFixed(3)}  p99 ${pct(0.99).toFixed(3)}  max ${sorted[sorted.length - 1]!.toFixed(3)}  (budget ${budget.toFixed(2)}) | process CPU ${(cpuMs / ticks).toFixed(3)} ms a tick`);
  console.log(`per tick ms: bots ${per('bots').toFixed(2)} (nav ${per('nav').toFixed(2)}) | players ${per('players').toFixed(2)} (character moves ${per('move').toFixed(2)}: ${(n('move') / ticks).toFixed(0)} full + ${(n('moveCoarse') / ticks).toFixed(0)} coarse a tick) | mounts+ambient ${per('mounts').toFixed(2)} (physics broad-phase updates ${per('commit').toFixed(2)}) | projectiles ${per('projectiles').toFixed(2)} | scenario/logic ${per('scenario').toFixed(2)} | snapshots ${(snapMs / ticks).toFixed(2)} (${viewers} viewers)`);
  console.log(`CPU per tick avg ${(cpuMs / ticks).toFixed(3)} p95 ${cpuP95.toFixed(3)} | breakdown (CPU-scaled, x${k.toFixed(2)}): bot think ${c2(think)} [setup ${c2(think - per('botThink'))}, perception ${c2(per('botPerceive'))} (${(n('botPerceive') / ticks).toFixed(1)}/tick), ${(n('botThink') / ticks).toFixed(0)} bots a tick (${(n('botSteer') / ticks).toFixed(0)} only steering), decisions ${c2(per('botDecide'))}, paths ${c2(per('botPath'))} (nav ${c2(per('nav'))}), aim ${c2(per('botAim'))}; LOS rays ${c2(per('los'))}] | movement ${c2(movement)} | combat ${c2(combat)} (firing ${c2(fire)}, ${(n('fire') / ticks).toFixed(1)} shots/tick) | rest ${c2(rest)}`);
  console.log(`nav: ${n('nav')} path queries (${(n('nav') / seconds).toFixed(0)}/s), ${n('navFail')} failed | line-of-sight rays ${(n('los') / ticks).toFixed(0)}/tick (+ ${(n('losShared') / ticks).toFixed(0)}/tick answered from the shared sight cache)`);
  console.log(`accuracy (rounds that hit / fired): ${[...aim].sort(([a], [b]) => SKILLS.indexOf(a as never) - SKILLS.indexOf(b as never)).map(([k, a]) => `${k} ${((a.hits / Math.max(1, a.rounds)) * 100).toFixed(1)}% of ${a.rounds}`).join(' | ')}`);
  console.log(`kills ${kills} | bot stuck recoveries ${stuck} | idle (moved < 2 m in 5 s) ${idlePct.toFixed(1)}% of samples, ${idleNow} at the end`);
  if (mode) {
    const scores = [...match.teamScores()].map(([t, s]) => `${t} ${s}`).join(', ');
    console.log(`${mode}: ${[...objective].map(([k, v]) => `${k} ${v}`).join(' | ') || 'no objective events'} | team scores: ${scores}`);
  }
  match.destroy();
  const cpuRow = `| ${map.metadata.id} | ${clump ? 'clumped' : 'spread'} | ${(cpuMs / ticks).toFixed(2)} | ${cpuP95.toFixed(1)} | ${c2(think)} | ${c2(per('botPerceive'))} | ${c2(per('botDecide'))} | ${c2(per('botPath'))} | ${c2(per('botAim'))} | ${(n('los') / ticks).toFixed(0)}) | ${c2(movement)} | ${c2(combat)} | ${c2(rest)} | ${kills} | ${load.toFixed(1)} |`;
  return { cpuRow, row: `| ${map.metadata.id}${clump ? ' (clumped)' : ''} | ${avg(tickMs).toFixed(1)} | ${pct(0.95).toFixed(1)} | ${sorted[sorted.length - 1]!.toFixed(0)} | ${per('bots').toFixed(1)} | ${per('move').toFixed(1)} | ${(n('nav') / seconds).toFixed(0)} (${n('navFail')}) | ${(cpuMs / ticks).toFixed(1)} | ${kills} | ${idlePct.toFixed(0)}% | ${load.toFixed(1)} |` };
}
