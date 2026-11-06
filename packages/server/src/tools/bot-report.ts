import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { cpus, loadavg } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, TICK_RATE, initPhysics, isGameMode, loadMap, mapCanRun, rulesForMode, type GameEvent, type GameMode, type MapDocument } from '@tiletrigger/shared';
import { CtfMode, FortsMode, KothMode, Match, ctfRoleOf, initNavigation, simProfile } from '@tiletrigger/shared/match';
import { Behaviour } from './botMeasures.ts';
import { drawNavPictures } from './navPictures.ts';

/**
 * Bot behaviour report and scorecard (docs/BOTS.md, "Measuring" and "Scorecard"): plays headless matches of Player
 * Bots and reports what they did, per map and per bot:
 * - where the time went: what each bot was doing (BotBrain.doing), moving or
 *   standing still; idle time (moved under 0.5 m in a second, alive, on foot)
 *   by its reason (holding a goal on purpose, a vantage spot, cover, squad
 *   waits, no route, lifts, corner checks... and "stuck": it meant to move and
 *   didn't), idle spells of 3 s and more with where they happened, and
 *   "frozen" time (standing still and not even turning, out of a fight: a
 *   statue);
 * - objective modes: time spent going to the mode's goal (BotBrain.doing
 *   'goal' while moving), at it, and per mode: CTF flag takes, captures,
 *   returns and drops (and each bot's role and every flag run); King of the
 *   Hill time held (one team alone on it) and contested; Bomb plants and
 *   defuses; Hostage rescues; Elimination round times; Fort Wars pieces built;
 * - route searches (and the share that found no way, with where they failed),
 *   stuck recoveries, map coverage, spawn deaths, kills, bot thinking and tick
 *   cost.
 *
 * Usage (from the repo root):
 *   pnpm bot-report diamond_park sunken_kingdom [--mode=core.ctf] [--seeds=1,2,3] [--seconds=240]
 *   pnpm bot-report --suite=ctf --seeds=1,2 --seconds=240 --json=after.json   (every map that offers CTF)
 *   pnpm bot-report --suite=all --seeds=1,2 --seconds=180 --shard=0/8 --json=s0.json (every scorecard mode, its maps)
 *   pnpm bot-report fernwood_moon --mode=core.tdm --players=32 --spells        (idle spells listed)
 *   pnpm bot-report --compare=before.json,after.json                          (before and after, per map)
 *   pnpm bot-report --check                       (the quick scorecard: a few maps, one seed, short matches, held to
 *                                                  bot-limits.json's checkLimits; exits 1 when bots got worse)
 *   pnpm bot-report --judge=s0.json+s1.json [--pictures=dir] [--summary=file.md]
 *                                                 (the nightly's results held to bot-limits.json's limits; the nav
 *                                                  pictures with each map's failed searches)
 *   --shard=k/n plays every n-th match of the list from the k-th (run n processes; --compare and --judge take
 *   several files joined with +). --suite=<mode> plays the maps that list that mode (ctf, koth, bomb, hostage, elim,
 *   forts, tdm). --pictures=dir after a run draws the maps it played, with their failed searches.
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
  /** Route searches for where it was going, and those that found no way. */
  searches: number;
  pathFailures: number;
  stuck: number;
  loops: number;
  kills: number;
  deaths: number;
  spells: Spell[];
}

/** A failed route search: from (x, y, z) toward (x, y, z). */
export type FailSpot = [number, number, number, number, number, number];

export interface MatchRow {
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
  /** Bot thinking a tick (ms, the match's bot pipeline, wall clock). */
  thinkMs?: number;
  /** Navmesh path queries in the match (every caller), and those that found no way. */
  navQueries?: number;
  navFails?: number;
  /** Map coverage a minute (share of 21 m regions some bot stood in), spread (0..1), deaths within 3 s of spawning. */
  coverage?: number;
  spread?: number;
  spawnDeaths?: number;
  deaths?: number;
  /** King of the Hill: seconds the hill was held by one team alone, contested, empty. */
  hill?: { held: number; contested: number; empty: number };
  /** Rounds (Elimination, Bomb, Hostage): how long each finished one lasted (s). */
  rounds?: number[];
  /** Fort Wars: pieces built. */
  pieces?: number;
  /** Failed route searches, where (at most FAIL_SPOTS a match, spread over it). */
  fails?: FailSpot[];
  /** Where stuck recoveries happened most: "x,y,z doing" (4 m cells) and how many. */
  stuckAt?: [string, number][];
  bots: BotRow[];
}

const FAIL_SPOTS = 600;
/** The modes the scorecard plays (docs/BOTS.md, "Scorecard"), each on the maps that list it. */
export const SCORECARD_MODES: readonly GameMode[] = ['core.ctf', 'core.koth', 'core.bomb', 'core.hostage', 'core.elim', 'core.forts', 'core.tdm'];

const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k: string) => flags.find((f) => f.startsWith(`--${k}=`))?.slice(k.length + 3);
const here = (p: string) => resolve(process.env.INIT_CWD ?? process.cwd(), p);
const mapsDir = fileURLToPath(new URL('../../../../maps/', import.meta.url));
const limitsPath = opt('limits') ? here(opt('limits')!) : fileURLToPath(new URL('./bot-limits.json', import.meta.url));

const modeArg = opt('mode') ?? 'core.ctf';
if (!isGameMode(modeArg)) throw new Error(`unknown mode ${modeArg}`);
const mode = modeArg as GameMode;
const seeds = (opt('seeds') ?? '1').split(',').map(Number);
const seconds = Number(opt('seconds') ?? 240);
const players = opt('players') ? Number(opt('players')) : null;
const style = opt('style') as 'mixed' | 'arena' | 'tactical' | undefined;
const showSpells = flags.includes('--spells');
const showBots = flags.includes('--bots');
const quiet = flags.includes('--quiet');
const jsonOut = opt('json');
const suite = opt('suite');

/** The (map, mode) pairs a suite plays: `ctf` (or any mode's short name) the maps that list the mode; `all` every scorecard mode. */
function suitePairs(name: string): [string, GameMode][] {
  const modes = name === 'all' ? SCORECARD_MODES : [(name.startsWith('core.') ? name : `core.${name}`) as GameMode];
  for (const m of modes) if (!isGameMode(m)) throw new Error(`unknown suite ${name}`);
  const out: [string, GameMode][] = [];
  for (const m of modes) {
    for (const f of readdirSync(mapsDir).sort()) {
      if (!f.endsWith('.json')) continue;
      const r = loadMap(readFileSync(mapsDir + f, 'utf8'));
      if (!r.ok || r.map.metadata.testOnly) continue;
      if (r.map.metadata.supportedModes.includes(m) && mapCanRun(r.map, m)) out.push([f.slice(0, -5), m]);
    }
  }
  return out;
}

interface Limits {
  about?: string;
  check: { seconds: number; seed: number; matches: [string, string][] };
  checkLimits: Record<string, Record<string, number>>;
  limits: Record<string, Record<string, number>>;
}

async function main(): Promise<void> {
  const compare = opt('compare');
  if (compare) {
    // (Several files a side, joined with +: a later one's match of the same map and seed replaces an earlier one's.)
    const [a, b] = compare.split(',').map((ps) => readRows(ps));
    printCompare(a!, b!);
    return;
  }
  const judge = opt('judge');
  if (judge) {
    const rows = readRows(judge);
    const limits = JSON.parse(readFileSync(limitsPath, 'utf8')) as Limits;
    const ok = printScorecard(rows, limits.limits, 'nightly');
    const pictures = opt('pictures');
    if (pictures) await drawNavPictures(here(pictures), mapsDir, rows);
    process.exitCode = ok ? 0 : 1;
    return;
  }
  const check = flags.includes('--check');
  const limits = check ? (JSON.parse(readFileSync(limitsPath, 'utf8')) as Limits) : null;
  // --shard=k/n: every n-th match from the k-th (several processes share a suite).
  const [k, n] = (opt('shard') ?? '0/1').split('/').map(Number) as [number, number];
  const pairs: [string, GameMode][] = limits ? limits.check.matches.map(([id, m]) => [id, m as GameMode]) : suite ? suitePairs(suite) : args.map((id) => [id, mode]);
  const runSeeds = limits ? [limits.check.seed] : seeds;
  const runSeconds = limits ? limits.check.seconds : seconds;
  const jobs = pairs.flatMap(([id, m]) => runSeeds.map((seed) => ({ id, mode: m, seed }))).filter((_, i) => i % n === k);
  await Promise.all([initPhysics(), initNavigation()]);
  const rows: MatchRow[] = [];
  const maps = new Map<string, MapDocument>();
  for (const job of jobs) {
    const path = job.id.endsWith('.json') ? here(job.id) : `${mapsDir}${job.id}.json`;
    let map = maps.get(path);
    if (!map) {
      const loaded = loadMap(readFileSync(path, 'utf8'));
      if (!loaded.ok) throw new Error(`${job.id} failed validation`);
      maps.set(path, (map = loaded.map));
    }
    if (!mapCanRun(map, job.mode)) {
      console.log(`${job.id}: can't run ${job.mode}`);
      continue;
    }
    const row = play(map, job.mode, job.seed, runSeconds);
    rows.push(row);
    if (!quiet) printMatch(row);
    if (jsonOut) writeFileSync(here(jsonOut), JSON.stringify(rows));
  }
  if (rows.length > 1 && !quiet) printSummary(rows);
  console.log(`load average ${loadavg().map((l) => l.toFixed(2)).join(' ')} (${cpus().length} cores)`);
  const pictures = opt('pictures');
  if (pictures) await drawNavPictures(here(pictures), mapsDir, rows);
  if (limits) process.exitCode = printScorecard(rows, limits.checkLimits, 'check') ? 0 : 1;
}

function readRows(files: string): MatchRow[] {
  return [...new Map(files.split('+').flatMap((p) => JSON.parse(readFileSync(here(p), 'utf8')) as MatchRow[]).map((m) => [`${m.map}|${m.mode}|${m.seed}`, m] as const)).values()];
}

/** Reasons a bot may stand still in a fight (not "idle" in the owner's sense). */
const FIGHTING = new Set<string>(['fight', 'cover', 'retreat', 'chaseHold', 'throw', 'dodge']);

function play(map: MapDocument, mode: GameMode, seed: number, seconds: number): MatchRow {
  const base = rulesForMode(map, mode);
  const rules = { ...base, scoreLimit: 0, timeLimitSeconds: 0, ...(style ? { botStyle: style } : {}) };
  if (players && rules.teamSizes?.length) rules.teamSizes = rules.teamSizes.map((_, i, a) => Math.floor(players / a.length) + (i < players % a.length ? 1 : 0));
  const total = players ?? (rules.teamSizes?.length ? rules.teamSizes.reduce((a, b) => a + b, 0) : 16);
  const match = new Match(map, rules, seed);
  for (let i = 0; i < total; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal, true);
  const ctf = match.mode instanceof CtfMode ? match.mode : match.mode instanceof FortsMode ? match.mode.ctf : null;
  const koth = match.mode instanceof KothMode ? match.mode : null;
  const forts = match.mode instanceof FortsMode ? match.mode : null;
  const bots = match.combatants().filter((c) => c.bot);
  const rec = new Map<number, BotRow>();
  for (const c of bots) {
    rec.set(c.slot, { slot: c.slot, name: c.name, team: c.faction, look: c.look, role: '', alive: 0, doing: {}, idle: 0, idleCalm: 0, frozen: 0, why: {}, goalTime: 0, towardGoal: 0, atGoal: 0, takes: 0, captures: 0, returns: 0, drops: 0, searches: 0, pathFailures: 0, stuck: 0, loops: 0, kills: 0, deaths: 0, spells: [] });
  }
  const roles = new Map<number, Map<string, number>>();
  // Position and facing a second ago (ring of samples every SAMPLE ticks).
  const SAMPLE = 6;
  const RING = TICK_RATE / SAMPLE;
  const hist = new Map<number, { x: number; y: number; z: number; yaw: number }[]>();
  const open = new Map<number, Spell & { reasons: Map<string, number> }>();
  const runs: MatchRow['runs'] = [];
  const openRun = new Map<string, MatchRow['runs'][number]>();
  const hill = koth ? { held: 0, contested: 0, empty: 0 } : undefined;
  const rounds: number[] = [];
  let roundStart = 0;
  const pieceIds = new Set<number>();
  const fails: FailSpot[] = [];
  let failsSeen = 0;
  const lastFails = new Map<number, number>();
  const lastStuck = new Map<number, number>();
  const stuckAt = new Map<string, number>();
  const behaviour = new Behaviour(match);
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
  simProfile.reset();
  simProfile.on = true;
  for (let k = 1; k <= seconds * TICK_RATE; k++) {
    const t0 = performance.now();
    const events = match.step();
    tickMs.push(performance.now() - t0);
    const t = k / TICK_RATE;
    behaviour.events(match, events);
    if (k % TICK_RATE === 0) behaviour.sample(match);
    if (hill && koth) {
      if (koth.holder === 'contested') hill.contested += 1 / TICK_RATE;
      else if (koth.holder) hill.held += 1 / TICK_RATE;
      else hill.empty += 1 / TICK_RATE;
    }
    if (forts) for (const p of forts.pieces) pieceIds.add(p.id);
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
      if (e.e === 'elim') {
        if (e.a === 'start') roundStart = t;
        else rounds.push(Math.round((t - roundStart) * 10) / 10);
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
      // Stuck recoveries since the last sample: where (and what the bot was doing).
      const stuckNow = b.stuckCount - (lastStuck.get(c.slot) ?? 0);
      if (stuckNow > 0) {
        lastStuck.set(c.slot, b.stuckCount);
        const key = `${Math.round(c.move.pos.x / 4) * 4},${Math.round(c.move.pos.y)},${Math.round(c.move.pos.z / 4) * 4} ${b.doing}`;
        stuckAt.set(key, (stuckAt.get(key) ?? 0) + stuckNow);
      }
      // Failed searches since the last sample: where the last of them was (from, toward). Past FAIL_SPOTS, every third
      // one overwrites an older one in turn (deterministic), so late ones show too.
      const failed = b.pathFailures - (lastFails.get(c.slot) ?? 0);
      if (failed > 0) {
        lastFails.set(c.slot, b.pathFailures);
        const f = b.lastNoRoute;
        if (f) {
          failsSeen++;
          const spot = [f.from.x, f.from.y, f.from.z, f.goal.x, f.goal.y, f.goal.z].map((v) => Math.round(v * 10) / 10) as FailSpot;
          if (fails.length < FAIL_SPOTS) fails.push(spot);
          else if (failsSeen % 3 === 0) fails[(failsSeen / 3) % FAIL_SPOTS] = spot;
        }
      }
      let h = hist.get(c.slot);
      if (!h) hist.set(c.slot, (h = []));
      if (!c.alive) {
        h.length = 0;
        closeSpell(c.slot);
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
  simProfile.on = false;
  for (const slot of open.keys()) closeSpell(slot);
  for (const c of bots) {
    const r = rec.get(c.slot)!;
    r.searches = c.bot!.pathSearches;
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
  out.thinkMs = (simProfile.ms.get('bots') ?? 0) / tickMs.length;
  // Every navmesh path query (bots' routes, presses, sidesteps, lanes, modes...), and those that found no way.
  out.navQueries = simProfile.n.get('nav') ?? 0;
  out.navFails = simProfile.n.get('navFail') ?? 0;
  out.coverage = behaviour.coverage(seconds);
  out.spread = behaviour.spread();
  out.spawnDeaths = behaviour.spawnDeaths;
  out.deaths = behaviour.deaths;
  if (hill) out.hill = { held: Math.round(hill.held), contested: Math.round(hill.contested), empty: Math.round(hill.empty) };
  if (rounds.length || match.mode?.constructor.name.match(/Elim|Bomb|Hostage/)) out.rounds = rounds;
  if (forts) out.pieces = pieceIds.size;
  out.fails = fails;
  // Where stuck recoveries happen most (4 m cells, with what the bots were doing): the top 12.
  out.stuckAt = [...stuckAt].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12);
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
  console.log(`\n== ${m.map} ${m.mode} seed ${m.seed} | ${m.players} bots, ${m.seconds} s | tick ${m.tickMs.toFixed(2)} ms (p95 ${m.tickP95.toFixed(2)}), bot thinking ${(m.thinkMs ?? 0).toFixed(2)} ms`);
  if (m.mode === 'core.ctf' || m.mode === 'core.forts' || m.takes || m.captures) {
    const runs = m.runs.map((r) => `${r.t.toFixed(0)}s:${r.end}${r.end === 'open' ? '' : `@${r.seconds}s`}(${r.from}m)`).join(' ');
    console.log(`flags: captures ${m.captures} | takes ${m.takes} | drops ${m.drops} | returns ${m.returns} | first take ${m.firstTake?.toFixed(0) ?? '-'} s, first capture ${m.firstCapture?.toFixed(0) ?? '-'} s | runs ${runs || 'none'}`);
  }
  if (m.objective && Object.keys(m.objective).length) console.log(`objective: ${Object.entries(m.objective).map(([k, v]) => `${k} ${v}`).join(' | ')}`);
  if (m.hill) console.log(`hill: held ${m.hill.held} s, contested ${m.hill.contested} s, empty ${m.hill.empty} s`);
  if (m.rounds) console.log(`rounds: ${m.rounds.length} finished${m.rounds.length ? `, ${(sum(m.rounds, (r) => r) / m.rounds.length).toFixed(0)} s on average (${m.rounds.join(', ')})` : ''}`);
  if (m.pieces !== undefined) console.log(`forts: ${m.pieces} pieces built`);
  const searches = sum(m.bots, (r) => r.searches);
  const failures = sum(m.bots, (r) => r.pathFailures);
  console.log(`time: idle ${pct(sum(m.bots, (r) => r.idle), alive)} (out of a fight ${pct(sum(m.bots, (r) => r.idleCalm), alive)}, frozen ${pct(sum(m.bots, (r) => r.frozen), alive)}, no route ${pct(sum(m.bots, (r) => r.why.noPath ?? 0), alive)}) | going to the goal ${pct(sum(m.bots, (r) => r.towardGoal), goalT)} of goal time, at it ${pct(sum(m.bots, (r) => r.atGoal), goalT)} | kills ${m.kills} (${((m.kills / m.seconds) * 60).toFixed(1)}/min) | stuck recoveries ${sum(m.bots, (r) => r.stuck)} (loops ${sum(m.bots, (r) => r.loops)}) | route searches ${searches}, no route ${failures} (${pct(failures, searches)})`);
  if (m.coverage !== undefined) console.log(`map: coverage ${((m.coverage ?? 0) * 100).toFixed(1)}% a minute, spread ${(m.spread ?? 0).toFixed(3)} | spawn deaths ${m.spawnDeaths} of ${m.deaths} (${pct(m.spawnDeaths ?? 0, m.deaths ?? 0)})`);
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
    if (m.stuckAt?.length) console.log(`stuck recoveries, where (4 m cells) and doing what: ${m.stuckAt.map(([k, v]) => `${k} ${v}`).join(', ')}`);
  }
  if (showBots) {
    for (const r of m.bots) console.log(`  ${r.slot} ${r.name} ${r.look} ${r.team} ${r.role}: alive ${r.alive.toFixed(0)} s, idle ${pct(r.idle, r.alive)} (calm ${pct(r.idleCalm, r.alive)}, frozen ${pct(r.frozen, r.alive)}), to goal ${pct(r.towardGoal, r.goalTime)}, at goal ${pct(r.atGoal, r.goalTime)}, takes ${r.takes} caps ${r.captures} returns ${r.returns}, kills ${r.kills} deaths ${r.deaths}, stuck ${r.stuck}, searches ${r.searches}, no-route ${r.pathFailures} | ${Object.entries(r.why).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v.toFixed(0)}s`).join(', ')}`);
  }
}

/** Per map (and mode): averages over its seeds. */
function perMap(rs: readonly MatchRow[]) {
  const maps = new Map<string, MatchRow[]>();
  for (const r of rs) (maps.get(`${r.map}|${r.mode}`) ?? maps.set(`${r.map}|${r.mode}`, []).get(`${r.map}|${r.mode}`)!).push(r);
  const modes = new Set(rs.map((r) => r.mode));
  return [...maps].map(([key, ms]) => {
    const [map] = key.split('|');
    return { map: modes.size > 1 ? `${map} (${ms[0]!.mode.slice(5)})` : map!, key, ...measure(ms) };
  });
}

/** The scorecard's measures over a set of matches (docs/BOTS.md, "Scorecard"). Undefined: not measured there. */
export function measure(ms: readonly MatchRow[]) {
  const n = ms.length;
  const bots = ms.flatMap((m) => m.bots);
  const alive = sum(bots, (r) => r.alive);
  const minutes = sum(ms, (m) => m.seconds) / 60;
  const searches = sum(bots, (r) => r.searches ?? 0);
  const deaths = sum(ms, (m) => m.deaths ?? 0);
  const ctf = ms.some((m) => m.mode === 'core.ctf' || m.mode === 'core.forts');
  const hills = ms.filter((m) => m.hill);
  const roundRows = ms.filter((m) => m.rounds);
  const rounds = roundRows.flatMap((m) => m.rounds!);
  const has = (k: string) => ms.some((m) => m.mode === k);
  return {
    n,
    players: ms[0]!.players,
    captures: ctf ? sum(ms, (m) => m.captures) / n : undefined,
    capsMin: sum(ms, (m) => m.captures) / minutes,
    takes: ctf ? sum(ms, (m) => m.takes) / n : undefined,
    returns: ctf ? sum(ms, (m) => m.returns) / n : undefined,
    withCapture: ms.filter((m) => m.captures > 0).length,
    idle: sum(bots, (r) => r.idle) / alive,
    calm: sum(bots, (r) => r.idleCalm) / alive,
    frozen: sum(bots, (r) => r.frozen) / alive,
    noRouteIdle: sum(bots, (r) => r.why.noPath ?? 0) / alive,
    toward: sum(bots, (r) => r.towardGoal) / Math.max(1e-9, sum(bots, (r) => r.goalTime)),
    goalTime: sum(bots, (r) => r.goalTime),
    stuck: sum(bots, (r) => r.stuck) / n,
    stuckPerBotMin: sum(bots, (r) => r.stuck) / Math.max(1e-9, alive / 60),
    loops: sum(bots, (r) => r.loops) / n,
    searches: searches / n,
    noRoute: sum(bots, (r) => r.pathFailures) / n,
    failedSearches: searches ? sum(bots, (r) => r.pathFailures) / searches : undefined,
    spells10: bots.reduce((a, r) => a + r.spells.filter((s) => s.seconds >= 10).length, 0) / n,
    longest: Math.max(0, ...bots.flatMap((r) => r.spells.map((s) => s.seconds))),
    killsMin: sum(ms, (m) => m.kills) / minutes,
    coverage: ms.every((m) => m.coverage !== undefined) ? sum(ms, (m) => m.coverage!) / n : undefined,
    spawnDeaths: deaths ? sum(ms, (m) => m.spawnDeaths ?? 0) / deaths : undefined,
    thinkMs: ms.every((m) => m.thinkMs !== undefined) ? sum(ms, (m) => m.thinkMs!) / n : undefined,
    tick: sum(ms, (m) => m.tickMs) / n,
    hillHeld: hills.length ? sum(hills, (m) => m.hill!.held) / sum(hills, (m) => m.seconds) : undefined,
    hillContested: hills.length ? sum(hills, (m) => m.hill!.contested) / sum(hills, (m) => m.seconds) : undefined,
    plants: has('core.bomb') ? sum(ms, (m) => m.objective['bomb plant'] ?? 0) / n : undefined,
    defuses: has('core.bomb') ? sum(ms, (m) => m.objective['bomb defuse'] ?? 0) / n : undefined,
    rescues: has('core.hostage') ? sum(ms, (m) => m.objective['hostage rescue'] ?? 0) / n : undefined,
    rounds: roundRows.length ? rounds.length / roundRows.length : undefined,
    roundSeconds: rounds.length ? sum(rounds, (r) => r) / rounds.length : undefined,
    pieces: has('core.forts') ? sum(ms, (m) => m.pieces ?? 0) / n : undefined,
  };
}

type Measures = ReturnType<typeof measure>;

/**
 * What the limits hold (bot-limits.json): each measure and which way is worse. A limit on a "low" measure is the
 * most it may be; on a "high" one, the least.
 */
const METRICS: Record<string, { better: 'low' | 'high'; of: (m: Measures) => number | undefined; label: string; pct?: boolean }> = {
  failedSearches: { better: 'low', of: (m) => m.failedSearches, label: 'failed searches', pct: true },
  noRouteIdle: { better: 'low', of: (m) => m.noRouteIdle, label: 'no-route idle', pct: true },
  idleCalm: { better: 'low', of: (m) => m.calm, label: 'idle out of a fight', pct: true },
  frozen: { better: 'low', of: (m) => m.frozen, label: 'frozen', pct: true },
  stuckPerBotMin: { better: 'low', of: (m) => m.stuckPerBotMin, label: 'stuck recoveries a bot-minute' },
  spells10: { better: 'low', of: (m) => m.spells10, label: 'idle spells of 10 s+ a match' },
  longestIdle: { better: 'low', of: (m) => m.longest, label: 'longest idle spell (s)' },
  towardGoal: { better: 'high', of: (m) => (m.goalTime > 0 ? m.toward : undefined), label: 'going to the goal', pct: true },
  coverage: { better: 'high', of: (m) => m.coverage, label: 'coverage a minute', pct: true },
  spawnDeaths: { better: 'low', of: (m) => m.spawnDeaths, label: 'spawn deaths', pct: true },
  killsPerMin: { better: 'high', of: (m) => m.killsMin, label: 'kills a minute' },
  thinkMs: { better: 'low', of: (m) => m.thinkMs, label: 'bot thinking ms a tick' },
  captures: { better: 'high', of: (m) => m.captures, label: 'captures a match' },
  takes: { better: 'high', of: (m) => m.takes, label: 'flag takes a match' },
  returns: { better: 'high', of: (m) => m.returns, label: 'flag returns a match' },
  hillHeld: { better: 'high', of: (m) => m.hillHeld, label: 'hill held', pct: true },
  hillTaken: { better: 'high', of: (m) => (m.hillHeld === undefined ? undefined : m.hillHeld + (m.hillContested ?? 0)), label: 'hill held or contested', pct: true },
  plants: { better: 'high', of: (m) => m.plants, label: 'bomb plants a match' },
  defuses: { better: 'high', of: (m) => m.defuses, label: 'bomb defuses a match' },
  rescues: { better: 'high', of: (m) => m.rescues, label: 'hostage rescues a match' },
  rounds: { better: 'high', of: (m) => m.rounds, label: 'rounds finished a match' },
  roundSeconds: { better: 'low', of: (m) => m.roundSeconds, label: 'round time (s)' },
  pieces: { better: 'high', of: (m) => m.pieces, label: 'fort pieces built a match' },
};

/**
 * The scorecard: per mode (and all modes together), then the matches held to `limits` (keys `all`, a mode such as
 * `core.ctf`, or `core.ctf/diamond_park` for one map in one mode). Returns false when anything is worse than its
 * limit.
 */
function printScorecard(rows: readonly MatchRow[], limits: Record<string, Record<string, number>>, what: string): boolean {
  const groups = new Map<string, MatchRow[]>([['all', [...rows]]]);
  for (const r of rows) {
    (groups.get(r.mode) ?? groups.set(r.mode, []).get(r.mode)!).push(r);
    const k = `${r.mode}/${r.map}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  const f = (v: number | undefined, p = false, d = 1) => (v === undefined ? '-' : p ? `${(v * 100).toFixed(d)}%` : v.toFixed(d));
  const lines: string[] = [];
  lines.push(`### Bot scorecard (${what}): ${rows.length} matches, ${new Set(rows.map((r) => r.map)).size} maps`);
  lines.push('');
  lines.push('| Mode | matches | failed searches | no-route idle | idle out of a fight | frozen | stuck a bot-min | going to the goal | coverage /min | spawn deaths | kills /min | think ms | objective |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, ms] of groups) {
    if (k.includes('/')) continue;
    const m = measure(ms);
    const obj = [
      m.captures !== undefined ? `captures ${f(m.captures)}, takes ${f(m.takes)}, returns ${f(m.returns)} a match` : '',
      m.hillHeld !== undefined ? `hill held ${f(m.hillHeld, true)}, contested ${f(m.hillContested, true)}` : '',
      m.plants !== undefined ? `plants ${f(m.plants)}, defuses ${f(m.defuses)} a match` : '',
      m.rescues !== undefined ? `rescues ${f(m.rescues)} a match` : '',
      m.roundSeconds !== undefined && k !== 'all' ? `rounds ${f(m.rounds)} a match, ${f(m.roundSeconds, false, 0)} s each` : '',
      m.pieces !== undefined ? `pieces built ${f(m.pieces, false, 0)} a match` : '',
    ].filter(Boolean).join('; ');
    lines.push(`| ${k} | ${m.n} | ${f(m.failedSearches, true, 2)} | ${f(m.noRouteIdle, true, 2)} | ${f(m.calm, true)} | ${f(m.frozen, true)} | ${f(m.stuckPerBotMin, false, 2)} | ${f(m.goalTime > 0 ? m.toward : undefined, true)} | ${f(m.coverage, true)} | ${f(m.spawnDeaths, true)} | ${f(m.killsMin)} | ${f(m.thinkMs, false, 2)} | ${obj || '-'} |`);
  }
  const broken: string[] = [];
  let held = 0;
  for (const [key, ls] of Object.entries(limits)) {
    const ms = groups.get(key);
    if (!ms?.length) continue;
    const m = measure(ms);
    for (const [name, limit] of Object.entries(ls)) {
      const def = METRICS[name];
      if (!def) {
        broken.push(`${key}: unknown measure ${name} in the limits`);
        continue;
      }
      const v = def.of(m);
      if (v === undefined) continue;
      held++;
      const worse = def.better === 'low' ? v > limit + 1e-9 : v < limit - 1e-9;
      if (worse) broken.push(`${key}: ${def.label} ${f(v, def.pct, 2)} is ${def.better === 'low' ? 'over' : 'under'} its limit ${f(limit, def.pct, 2)}`);
    }
  }
  lines.push('');
  lines.push(broken.length ? `**Worse than the limits** (${broken.length} of ${held} held):` : `Every limit held (${held} measures, bot-limits.json).`);
  for (const b of broken) lines.push(`- ${b}`);
  const text = lines.join('\n');
  console.log(`\n${text}`);
  const summary = opt('summary');
  if (summary) writeFileSync(here(summary), `${text}\n`, { flag: 'a' });
  return broken.length === 0;
}

function printSummary(rs: readonly MatchRow[]): void {
  console.log('\n| Map | matches | bots | captures/match | caps/min | flag takes/match | returns/match | matches with a capture | idle % | idle out of a fight % | frozen % | no-route idle % | going to goal % | stuck/match | searches/match | failed searches % | 10 s+ idle spells/match | coverage % | kills/min | think ms | tick ms |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const f = (v: number | undefined, d = 1, k = 1) => (v === undefined ? '-' : (v * k).toFixed(d));
  for (const m of perMap(rs)) {
    console.log(`| ${m.map} | ${m.n} | ${m.players} | ${f(m.captures)} | ${m.capsMin.toFixed(2)} | ${f(m.takes)} | ${f(m.returns)} | ${m.withCapture}/${m.n} | ${f(m.idle, 1, 100)} | ${f(m.calm, 1, 100)} | ${f(m.frozen, 1, 100)} | ${f(m.noRouteIdle, 2, 100)} | ${f(m.toward, 1, 100)} | ${m.stuck.toFixed(0)} | ${m.searches.toFixed(0)} | ${f(m.failedSearches, 2, 100)} | ${m.spells10.toFixed(1)} | ${f(m.coverage, 1, 100)} | ${m.killsMin.toFixed(1)} | ${f(m.thinkMs, 2)} | ${m.tick.toFixed(2)} |`);
  }
}

function printCompare(before: readonly MatchRow[], after: readonly MatchRow[]): void {
  const a = new Map(perMap(before).map((m) => [m.key, m]));
  const b = perMap(after);
  const f = (x: number | undefined, d = 1, k = 1) => (x === undefined ? '-' : (x * k).toFixed(d));
  console.log('| Map | captures/match | flag takes/match | matches with a capture | idle out of a fight % | frozen % | no-route idle % | going to goal % | stuck/match | failed searches % | 10 s+ idle spells/match | kills/min | think ms | tick ms |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const m of b) {
    const o = a.get(m.key);
    console.log(`| ${m.map} | ${f(o?.captures)} → ${f(m.captures)} | ${f(o?.takes)} → ${f(m.takes)} | ${o ? `${o.withCapture}/${o.n}` : '-'} → ${m.withCapture}/${m.n} | ${f(o?.calm, 1, 100)} → ${f(m.calm, 1, 100)} | ${f(o?.frozen, 1, 100)} → ${f(m.frozen, 1, 100)} | ${f(o?.noRouteIdle, 2, 100)} → ${f(m.noRouteIdle, 2, 100)} | ${f(o?.toward, 1, 100)} → ${f(m.toward, 1, 100)} | ${f(o?.stuck, 0)} → ${f(m.stuck, 0)} | ${f(o?.failedSearches, 2, 100)} → ${f(m.failedSearches, 2, 100)} | ${f(o?.spells10)} → ${f(m.spells10)} | ${f(o?.killsMin)} → ${f(m.killsMin)} | ${f(o?.thinkMs, 2)} → ${f(m.thinkMs, 2)} | ${f(o?.tick, 2)} → ${f(m.tick, 2)} |`);
  }
  const tot = (rs: readonly MatchRow[], k: (m: MatchRow) => number) => rs.reduce((x, m) => x + k(m), 0);
  console.log(`\nall maps: captures ${tot(before, (m) => m.captures)} → ${tot(after, (m) => m.captures)} in ${before.length} → ${after.length} matches; matches with a capture ${before.filter((m) => m.captures > 0).length} → ${after.filter((m) => m.captures > 0).length}`);
  const ma = measure(before);
  const mb = measure(after);
  const g = (v: number | undefined, d = 2, k = 100) => (v === undefined ? '-' : (v * k).toFixed(d));
  console.log(`failed searches ${g(ma.failedSearches)} → ${g(mb.failedSearches)} % (${ma.noRoute.toFixed(0)} → ${mb.noRoute.toFixed(0)} a match of ${ma.searches.toFixed(0)} → ${mb.searches.toFixed(0)}); no-route idle ${g(ma.noRouteIdle)} → ${g(mb.noRouteIdle)} %; idle out of a fight ${g(ma.calm, 1)} → ${g(mb.calm, 1)} %; frozen ${g(ma.frozen, 1)} → ${g(mb.frozen, 1)} %; stuck ${ma.stuck.toFixed(0)} → ${mb.stuck.toFixed(0)} a match (${ma.stuckPerBotMin.toFixed(2)} → ${mb.stuckPerBotMin.toFixed(2)} a bot-minute); 10 s+ idle spells ${ma.spells10.toFixed(1)} → ${mb.spells10.toFixed(1)} a match; kills ${ma.killsMin.toFixed(1)} → ${mb.killsMin.toFixed(1)} a minute; think ${g(ma.thinkMs, 2, 1)} → ${g(mb.thinkMs, 2, 1)} ms`);
}

await main();
