import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { cpus, loadavg } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, TICK_RATE, initPhysics, isGameMode, loadMap, mapCanRun, rulesForMode, type GameEvent, type GameMode, type MapDocument } from '@tiletrigger/shared';
import { CtfMode, Match, ctfRoleOf, initNavigation } from '@tiletrigger/shared/match';

/**
 * Bot behaviour report (docs/BOTS.md, "Measuring"): plays headless matches
 * of Player Bots and reports what they did, per map and per bot:
 * - where the time went: what each bot was doing (BotBrain.doing), moving or
 *   standing still; idle time (moved under 0.5 m in a second, alive, on foot)
 *   by its reason (holding a goal on purpose, a vantage spot, cover, squad
 *   waits, no route, lifts, corner checks... and "stuck": it meant to move and
 *   didn't), idle spells of 3 s and more with where they happened, and
 *   "frozen" time (standing still and not even turning, out of a fight: a
 *   statue);
 * - objective modes: time spent going to the mode's goal (BotBrain.doing
 *   'goal' while moving), at it, and for CTF each bot's role, flag takes,
 *   captures, returns and drops, the flag runs (taken, captured, how long);
 * - route searches that found no way, stuck recoveries, kills, tick cost.
 *
 * Usage (from the repo root):
 *   pnpm bot-report diamond_park sunken_kingdom [--mode=core.ctf] [--seeds=1,2,3] [--seconds=240]
 *   pnpm bot-report --suite=ctf --seeds=1,2 --seconds=240 --json=after.json   (every map that offers CTF)
 *   pnpm bot-report fernwood_moon --mode=core.tdm --players=32 --spells        (idle spells listed)
 *   pnpm bot-report --compare=before.json,after.json                          (before and after, per map)
 *   --shard=k/n plays every n-th map from the k-th (run n processes; --compare takes several files: a+b,c+d).
 * Bots are added as the server adds them (as their characters, normal skill,
 * the match's bot style); --players=N overrides the map's team sizes.
 */

interface Spell {
  start: number;
  seconds: number;
  reason: string;
  at: [number, number, number];
}

interface BotRow {
  slot: number;
  name: string;
  team: string | null;
  look: string;
  role: string;
  alive: number;
  /** Seconds by what it was doing: [moving, standing]. */
  doing: Record<string, [number, number]>;
  idle: number;
  /** Idle out of a fight (no target, not in cover or retreating). */
  idleCalm: number;
  frozen: number;
  /** Idle by reason (s). */
  why: Record<string, number>;
  goalTime: number;
  towardGoal: number;
  atGoal: number;
  takes: number;
  captures: number;
  returns: number;
  drops: number;
  pathFailures: number;
  stuck: number;
  loops: number;
  kills: number;
  deaths: number;
  spells: Spell[];
}

interface MatchRow {
  map: string;
  mode: string;
  seed: number;
  seconds: number;
  players: number;
  takes: number;
  captures: number;
  returns: number;
  drops: number;
  firstTake: number | null;
  firstCapture: number | null;
  /** Each flag run: when taken, how long it lasted, how it ended, by whom. */
  runs: { t: number; seconds: number; end: 'capture' | 'drop' | 'open'; slot: number; from: number }[];
  kills: number;
  /** Other modes' objective events by kind and action ("hill hold", "bomb plant", "elim win"...). */
  objective: Record<string, number>;
  tickMs: number;
  tickP95: number;
  bots: BotRow[];
}

const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k: string) => flags.find((f) => f.startsWith(`--${k}=`))?.slice(k.length + 3);
const here = (p: string) => resolve(process.env.INIT_CWD ?? process.cwd(), p);
const mapsDir = fileURLToPath(new URL('../../../../maps/', import.meta.url));

const modeArg = opt('mode') ?? 'core.ctf';
if (!isGameMode(modeArg)) throw new Error(`unknown mode ${modeArg}`);
const mode = modeArg as GameMode;
const seeds = (opt('seeds') ?? '1').split(',').map(Number);
const seconds = Number(opt('seconds') ?? 240);
const players = opt('players') ? Number(opt('players')) : null;
const style = opt('style') as 'mixed' | 'arena' | 'tactical' | undefined;
const showSpells = flags.includes('--spells');
const showBots = flags.includes('--bots');
const jsonOut = opt('json');
const suite = opt('suite');

function suiteMaps(): string[] {
  const out: string[] = [];
  for (const f of readdirSync(mapsDir).sort()) {
    if (!f.endsWith('.json')) continue;
    const r = loadMap(readFileSync(mapsDir + f, 'utf8'));
    if (!r.ok || r.map.metadata.testOnly) continue;
    if (suite === 'ctf' ? r.map.metadata.supportedModes.includes('core.ctf') && mapCanRun(r.map, 'core.ctf') : mapCanRun(r.map, mode)) out.push(f.slice(0, -5));
  }
  return out;
}

async function main(): Promise<void> {
  const compare = opt('compare');
  if (compare) {
    // (Several files a side, joined with +: a later one's match of the same map and seed replaces an earlier one's.)
    const [a, b] = compare.split(',').map((ps) => [...new Map(ps.split('+').flatMap((p) => JSON.parse(readFileSync(here(p), 'utf8')) as MatchRow[]).map((m) => [`${m.map}|${m.mode}|${m.seed}`, m] as const)).values()]);
    printCompare(a!, b!);
    return;
  }
  // --shard=k/n: every n-th map from the k-th (several processes share a suite).
  const [k, n] = (opt('shard') ?? '0/1').split('/').map(Number) as [number, number];
  const ids = (suite ? suiteMaps() : args).filter((_, i) => i % n === k);
  await Promise.all([initPhysics(), initNavigation()]);
  const rows: MatchRow[] = [];
  for (const id of ids) {
    const path = id.endsWith('.json') ? here(id) : `${mapsDir}${id}.json`;
    const loaded = loadMap(readFileSync(path, 'utf8'));
    if (!loaded.ok) throw new Error(`${id} failed validation`);
    if (!mapCanRun(loaded.map, mode)) {
      console.log(`${id}: can't run ${mode}`);
      continue;
    }
    for (const seed of seeds) {
      const row = play(loaded.map, seed);
      rows.push(row);
      printMatch(row);
      if (jsonOut) writeFileSync(here(jsonOut), JSON.stringify(rows));
    }
  }
  if (rows.length > 1) printSummary(rows);
  console.log(`load average ${loadavg().map((l) => l.toFixed(2)).join(' ')} (${cpus().length} cores)`);
}

/** Reasons a bot may stand still in a fight (not "idle" in the owner's sense). */
const FIGHTING = new Set<string>(['fight', 'cover', 'retreat', 'chaseHold', 'throw', 'dodge']);

function play(map: MapDocument, seed: number): MatchRow {
  const base = rulesForMode(map, mode);
  const rules = { ...base, scoreLimit: 0, timeLimitSeconds: 0, ...(style ? { botStyle: style } : {}) };
  if (players && rules.teamSizes?.length) rules.teamSizes = rules.teamSizes.map((_, i, a) => Math.floor(players / a.length) + (i < players % a.length ? 1 : 0));
  const total = players ?? (rules.teamSizes?.length ? rules.teamSizes.reduce((a, b) => a + b, 0) : 16);
  const match = new Match(map, rules, seed);
  for (let i = 0; i < total; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal, true);
  const ctf = match.mode instanceof CtfMode ? match.mode : null;
  const bots = match.combatants().filter((c) => c.bot);
  const rec = new Map<number, BotRow>();
  for (const c of bots) {
    rec.set(c.slot, { slot: c.slot, name: c.name, team: c.faction, look: c.look, role: '', alive: 0, doing: {}, idle: 0, idleCalm: 0, frozen: 0, why: {}, goalTime: 0, towardGoal: 0, atGoal: 0, takes: 0, captures: 0, returns: 0, drops: 0, pathFailures: 0, stuck: 0, loops: 0, kills: 0, deaths: 0, spells: [] });
  }
  const roles = new Map<number, Map<string, number>>();
  // Position and facing a second ago (ring of samples every SAMPLE ticks).
  const SAMPLE = 6;
  const RING = TICK_RATE / SAMPLE;
  const hist = new Map<number, { x: number; y: number; z: number; yaw: number }[]>();
  const open = new Map<number, Spell & { reasons: Map<string, number> }>();
  const lastGoalD = new Map<number, { x: number; z: number; d: number }>();
  const runs: MatchRow['runs'] = [];
  const openRun = new Map<string, MatchRow['runs'][number]>();
  const out: MatchRow = { map: map.metadata.id, mode, seed, seconds, players: total, takes: 0, captures: 0, returns: 0, drops: 0, firstTake: null, firstCapture: null, runs, kills: 0, objective: {}, tickMs: 0, tickP95: 0, bots: [] };
  const tickMs: number[] = [];
  const closeSpell = (slot: number) => {
    const s = open.get(slot);
    if (!s) return;
    open.delete(slot);
    if (s.seconds < 3) return;
    let best = '';
    let n = -1;
    for (const [k, v] of s.reasons) if (v > n) [best, n] = [k, v];
    rec.get(slot)!.spells.push({ start: s.start, seconds: s.seconds, reason: best, at: s.at });
  };
  for (let k = 1; k <= seconds * TICK_RATE; k++) {
    const t0 = performance.now();
    const events = match.step();
    tickMs.push(performance.now() - t0);
    const t = k / TICK_RATE;
    for (const e of events as GameEvent[]) {
      if (e.e === 'kill') {
        out.kills++;
        const v = rec.get(e.victim);
        if (v) v.deaths++;
        const killer = e.killer === null || e.killer === undefined ? undefined : rec.get(e.killer);
        if (killer && e.killer !== e.victim) killer.kills++;
      }
      if (e.e === 'hill' || e.e === 'bomb' || e.e === 'elim' || e.e === 'hostage') {
        const k = `${e.e} ${e.a}`;
        out.objective[k] = (out.objective[k] ?? 0) + 1;
      }
      if (e.e !== 'flag') continue;
      const r = e.s === null ? undefined : rec.get(e.s);
      if (e.a === 'take') {
        out.takes++;
        out.firstTake ??= t;
        if (r) r.takes++;
        const c = e.s === null ? undefined : match.actor(e.s);
        const home = ctf?.flags.find((f) => f.team === c?.faction)?.base;
        const run = { t, seconds: 0, end: 'open' as const, slot: e.s ?? -1, from: c && home ? Math.round(Math.hypot(c.move.pos.x - home.x, c.move.pos.z - home.z)) : -1 };
        runs.push(run);
        openRun.set(e.team, run);
      } else if (e.a === 'capture') {
        out.captures++;
        out.firstCapture ??= t;
        if (r) r.captures++;
        const run = openRun.get(e.team);
        if (run) Object.assign(run, { seconds: Math.round(t - run.t), end: 'capture' });
        openRun.delete(e.team);
      } else if (e.a === 'return') {
        out.returns++;
        if (r) r.returns++;
      } else if (e.a === 'drop') {
        out.drops++;
        if (r) r.drops++;
        const run = openRun.get(e.team);
        if (run) Object.assign(run, { seconds: Math.round(t - run.t), end: 'drop' });
        openRun.delete(e.team);
      }
    }
    if (k % SAMPLE) continue;
    const dt = SAMPLE / TICK_RATE;
    for (const c of bots) {
      const r = rec.get(c.slot)!;
      const b = c.bot!;
      let h = hist.get(c.slot);
      if (!h) hist.set(c.slot, (h = []));
      if (!c.alive) {
        h.length = 0;
        closeSpell(c.slot);
        lastGoalD.delete(c.slot);
        continue;
      }
      r.alive += dt;
      const p = c.move.pos;
      h.push({ x: p.x, y: p.y, z: p.z, yaw: c.yaw });
      if (h.length > RING + 1) h.shift();
      const doing: string = b.doing;
      const role = ctf ? ctfRoleOf(c, ctf.flags, ctf.botPlan) : b.doing === 'mounted' ? 'mounted' : 'free';
      const rm = roles.get(c.slot) ?? roles.set(c.slot, new Map()).get(c.slot)!;
      rm.set(role, (rm.get(role) ?? 0) + dt);
      const full = h.length > RING;
      const a = h[0]!;
      const moved = full ? Math.hypot(p.x - a.x, p.z - a.z) : Infinity;
      const climbed = full ? Math.abs(p.y - a.y) : Infinity;
      const still = moved < 0.5 && climbed < 0.5;
      const slot = r.doing[doing] ?? (r.doing[doing] = [0, 0]);
      slot[still ? 1 : 0] += dt;
      // Objective goal: going there (following it and moving), at it.
      const goal = match.mode && !c.mount ? match.mode.botGoal(c, []) : null;
      if (goal) {
        r.goalTime += dt;
        const d = Math.hypot(p.x - goal.pos.x, p.z - goal.pos.z);
        if (d <= goal.radius + 1 && Math.abs(p.y - goal.pos.y) < 2) r.atGoal += dt;
        else if (doing === 'goal' && moved > 1.5) r.towardGoal += dt;
        lastGoalD.set(c.slot, { x: goal.pos.x, z: goal.pos.z, d });
      }
      if (c.mount || !full) {
        closeSpell(c.slot);
        continue;
      }
      if (!still) {
        closeSpell(c.slot);
        continue;
      }
      const reason = c.move.climb ? 'ladder' : b.meantToMove && !FIGHTING.has(doing) ? `stuck(${doing})` : doing;
      r.idle += dt;
      r.why[reason] = (r.why[reason] ?? 0) + dt;
      const calm = !FIGHTING.has(doing) && b.target === null;
      if (calm) {
        r.idleCalm += dt;
        let turned = 0;
        for (let i = 1; i < h.length; i++) turned += Math.abs(angleDiff(h[i]!.yaw, h[i - 1]!.yaw));
        if (turned < 0.1) r.frozen += dt;
      }
      let s = open.get(c.slot);
      if (!s) open.set(c.slot, (s = { start: Math.round(t - 1), seconds: 1, reason, at: [Math.round(p.x), Math.round(p.y * 10) / 10, Math.round(p.z)], reasons: new Map() }));
      else s.seconds = Math.round((s.seconds + dt) * 10) / 10;
      s.reasons.set(reason, (s.reasons.get(reason) ?? 0) + 1);
    }
  }
  for (const slot of open.keys()) closeSpell(slot);
  for (const c of bots) {
    const r = rec.get(c.slot)!;
    r.pathFailures = c.bot!.pathFailures;
    r.stuck = c.bot!.stuckCount;
    r.loops = c.bot!.stuckLoops;
    let best = '';
    let n = -1;
    for (const [k, v] of roles.get(c.slot) ?? []) if (k !== 'carrier' && v > n) [best, n] = [k, v];
    r.role = best;
    out.bots.push(r);
  }
  const sorted = [...tickMs].sort((x, y) => x - y);
  out.tickMs = tickMs.reduce((x, y) => x + y, 0) / tickMs.length;
  out.tickP95 = sorted[Math.floor(sorted.length * 0.95)]!;
  match.destroy();
  return out;
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

const pct = (v: number, of: number) => `${((v / Math.max(1e-9, of)) * 100).toFixed(1)}%`;
const sum = <T>(rs: readonly T[], f: (r: T) => number) => rs.reduce((a, r) => a + f(r), 0);

function printMatch(m: MatchRow): void {
  const alive = sum(m.bots, (r) => r.alive);
  const goalT = sum(m.bots, (r) => r.goalTime);
  console.log(`\n== ${m.map} ${m.mode} seed ${m.seed} | ${m.players} bots, ${m.seconds} s | tick ${m.tickMs.toFixed(2)} ms (p95 ${m.tickP95.toFixed(2)})`);
  if (m.mode === 'core.ctf' || m.takes || m.captures) {
    const runs = m.runs.map((r) => `${r.t.toFixed(0)}s:${r.end}${r.end === 'open' ? '' : `@${r.seconds}s`}(${r.from}m)`).join(' ');
    console.log(`flags: captures ${m.captures} | takes ${m.takes} | drops ${m.drops} | returns ${m.returns} | first take ${m.firstTake?.toFixed(0) ?? '-'} s, first capture ${m.firstCapture?.toFixed(0) ?? '-'} s | runs ${runs || 'none'}`);
  }
  if (m.objective && Object.keys(m.objective).length) console.log(`objective: ${Object.entries(m.objective).map(([k, v]) => `${k} ${v}`).join(' | ')}`);
  console.log(`time: idle ${pct(sum(m.bots, (r) => r.idle), alive)} (out of a fight ${pct(sum(m.bots, (r) => r.idleCalm), alive)}, frozen ${pct(sum(m.bots, (r) => r.frozen), alive)}) | going to the goal ${pct(sum(m.bots, (r) => r.towardGoal), goalT)} of goal time, at it ${pct(sum(m.bots, (r) => r.atGoal), goalT)} | kills ${m.kills} (${((m.kills / m.seconds) * 60).toFixed(1)}/min) | stuck recoveries ${sum(m.bots, (r) => r.stuck)} (loops ${sum(m.bots, (r) => r.loops)}) | no-route searches ${sum(m.bots, (r) => r.pathFailures)}`);
  const why = new Map<string, number>();
  for (const r of m.bots) for (const [k, v] of Object.entries(r.why)) why.set(k, (why.get(k) ?? 0) + v);
  console.log(`idle by reason (% of alive time): ${[...why].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${pct(v, alive)}`).join(', ')}`);
  const doing = new Map<string, [number, number]>();
  for (const r of m.bots) for (const [k, [mv, st]] of Object.entries(r.doing)) {
    const d = doing.get(k) ?? doing.set(k, [0, 0]).get(k)!;
    d[0] += mv;
    d[1] += st;
  }
  console.log(`doing (% of alive time, moving/still): ${[...doing].sort((a, b) => b[1][0] + b[1][1] - a[1][0] - a[1][1]).slice(0, 14).map(([k, [mv, st]]) => `${k} ${pct(mv + st, alive)} (${pct(mv, alive)}/${pct(st, alive)})`).join(', ')}`);
  if (m.mode === 'core.ctf') {
    const byRole = new Map<string, BotRow[]>();
    for (const r of m.bots) (byRole.get(r.role) ?? byRole.set(r.role, []).get(r.role)!).push(r);
    console.log(`roles: ${[...byRole].map(([k, rs]) => `${k} ${rs.length} (idle out of a fight ${pct(sum(rs, (r) => r.idleCalm), sum(rs, (r) => r.alive))}, going to goal ${pct(sum(rs, (r) => r.towardGoal), sum(rs, (r) => r.goalTime))}, takes ${sum(rs, (r) => r.takes)}, caps ${sum(rs, (r) => r.captures)}, returns ${sum(rs, (r) => r.returns)}, kills ${sum(rs, (r) => r.kills)})`).join(' | ')}`);
  }
  const spells = m.bots.flatMap((r) => r.spells.map((s) => ({ ...s, bot: r })));
  const long = spells.filter((s) => s.seconds >= 10);
  const byWhy = new Map<string, number>();
  for (const s of long) byWhy.set(s.reason, (byWhy.get(s.reason) ?? 0) + 1);
  console.log(`idle spells: ${spells.length} of 3 s+, ${long.length} of 10 s+ (${[...byWhy].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}), longest ${Math.max(0, ...spells.map((s) => s.seconds)).toFixed(0)} s`);
  if (showSpells) {
    for (const s of spells.sort((a, b) => b.seconds - a.seconds).slice(0, 20)) console.log(`  ${s.bot.name} (${s.bot.look}, ${s.bot.role}) ${s.seconds.toFixed(0)} s from ${s.start} s: ${s.reason} at (${s.at.join(', ')})`);
  }
  if (showBots) {
    for (const r of m.bots) console.log(`  ${r.slot} ${r.name} ${r.look} ${r.team} ${r.role}: alive ${r.alive.toFixed(0)} s, idle ${pct(r.idle, r.alive)} (calm ${pct(r.idleCalm, r.alive)}, frozen ${pct(r.frozen, r.alive)}), to goal ${pct(r.towardGoal, r.goalTime)}, at goal ${pct(r.atGoal, r.goalTime)}, takes ${r.takes} caps ${r.captures} returns ${r.returns}, kills ${r.kills} deaths ${r.deaths}, stuck ${r.stuck}, no-route ${r.pathFailures} | ${Object.entries(r.why).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v.toFixed(0)}s`).join(', ')}`);
  }
}

/** Per map: averages over its seeds. */
function perMap(rs: readonly MatchRow[]) {
  const maps = new Map<string, MatchRow[]>();
  for (const r of rs) (maps.get(r.map) ?? maps.set(r.map, []).get(r.map)!).push(r);
  return [...maps].map(([map, ms]) => {
    const n = ms.length;
    const bots = ms.flatMap((m) => m.bots);
    const alive = sum(bots, (r) => r.alive);
    const minutes = sum(ms, (m) => m.seconds) / 60;
    return {
      map,
      n,
      players: ms[0]!.players,
      captures: sum(ms, (m) => m.captures) / n,
      capsMin: sum(ms, (m) => m.captures) / minutes,
      takes: sum(ms, (m) => m.takes) / n,
      returns: sum(ms, (m) => m.returns) / n,
      withCapture: ms.filter((m) => m.captures > 0).length,
      idle: sum(bots, (r) => r.idle) / alive,
      calm: sum(bots, (r) => r.idleCalm) / alive,
      frozen: sum(bots, (r) => r.frozen) / alive,
      toward: sum(bots, (r) => r.towardGoal) / Math.max(1e-9, sum(bots, (r) => r.goalTime)),
      stuck: sum(bots, (r) => r.stuck) / n,
      loops: sum(bots, (r) => r.loops) / n,
      noRoute: sum(bots, (r) => r.pathFailures) / n,
      spells10: bots.reduce((a, r) => a + r.spells.filter((s) => s.seconds >= 10).length, 0) / n,
      killsMin: sum(ms, (m) => m.kills) / minutes,
      tick: sum(ms, (m) => m.tickMs) / n,
    };
  });
}

function printSummary(rs: readonly MatchRow[]): void {
  console.log('\n| Map | matches | bots | captures/match | caps/min | flag takes/match | returns/match | matches with a capture | idle % | idle out of a fight % | frozen % | going to goal % | stuck/match | no-route/match | 10 s+ idle spells/match | kills/min | tick ms |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const m of perMap(rs)) {
    console.log(`| ${m.map} | ${m.n} | ${m.players} | ${m.captures.toFixed(1)} | ${m.capsMin.toFixed(2)} | ${m.takes.toFixed(1)} | ${m.returns.toFixed(1)} | ${m.withCapture}/${m.n} | ${(m.idle * 100).toFixed(1)} | ${(m.calm * 100).toFixed(1)} | ${(m.frozen * 100).toFixed(1)} | ${(m.toward * 100).toFixed(1)} | ${m.stuck.toFixed(0)} | ${m.noRoute.toFixed(0)} | ${m.spells10.toFixed(1)} | ${m.killsMin.toFixed(1)} | ${m.tick.toFixed(2)} |`);
  }
}

function printCompare(before: readonly MatchRow[], after: readonly MatchRow[]): void {
  const a = new Map(perMap(before).map((m) => [m.map, m]));
  const b = perMap(after);
  const f = (x: number | undefined, d = 1) => (x === undefined ? '-' : x.toFixed(d));
  console.log('| Map | captures/match | flag takes/match | matches with a capture | idle out of a fight % | frozen % | going to goal % | stuck/match | no-route/match | 10 s+ idle spells/match | kills/min | tick ms |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const m of b) {
    const o = a.get(m.map);
    console.log(`| ${m.map} | ${f(o?.captures)} → ${f(m.captures)} | ${f(o?.takes)} → ${f(m.takes)} | ${o ? `${o.withCapture}/${o.n}` : '-'} → ${m.withCapture}/${m.n} | ${f(o && o.calm * 100)} → ${f(m.calm * 100)} | ${f(o && o.frozen * 100)} → ${f(m.frozen * 100)} | ${f(o && o.toward * 100)} → ${f(m.toward * 100)} | ${f(o?.stuck, 0)} → ${f(m.stuck, 0)} | ${f(o?.noRoute, 0)} → ${f(m.noRoute, 0)} | ${f(o?.spells10)} → ${f(m.spells10)} | ${f(o?.killsMin)} → ${f(m.killsMin)} | ${f(o?.tick, 2)} → ${f(m.tick, 2)} |`);
  }
  const tot = (rs: readonly MatchRow[], k: (m: MatchRow) => number) => rs.reduce((x, m) => x + k(m), 0);
  console.log(`\nall maps: captures ${tot(before, (m) => m.captures)} → ${tot(after, (m) => m.captures)} in ${before.length} → ${after.length} matches; matches with a capture ${before.filter((m) => m.captures > 0).length} → ${after.filter((m) => m.captures > 0).length}`);
}

await main();
