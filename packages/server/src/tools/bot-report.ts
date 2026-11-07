import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { cpus, loadavg } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOT_DIFFICULTIES, CHARACTER_PROFILES, CORE_BOT_PROFILES, CORE_WEAPONS, THROWABLE_DEFS, TICK_RATE, WEAPON_SET_IDS, getWeaponSet, hasTag, initPhysics, isGameMode, isWeaponSetId, loadMap, mapCanRun, matchWeaponSet, rulesForMode, setThrowables, setWeaponIds, throwableWeaponId, type BotProfile, type GameEvent, type GameMode, type MapDocument } from '@tiletrigger/shared';
import { BreakthroughMode, CtfMode, FortsMode, KothMode, Match, ctfRoleOf, initNavigation, placeOn, simProfile } from '@tiletrigger/shared/match';
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
 *   pnpm bot-report iron_coast --mode=core.breakthrough --players=48 --seeds=1,2 --seconds=900
 *                                                 (Breakthrough: sectors taken, when each fell, how the round ended and
 *                                                  the attackers' reinforcements left; a match stops when its last round
 *                                                  is over)
 *   pnpm bot-report shingle_point halcyon_station --mode=core.tdm --set=military,scifi,chaos  (each match in each
 *                                                 weapon set: kills by weapon per set)
 *   --shard=k/n plays every n-th match of the list from the k-th (run n processes; --compare and --judge take
 *   several files joined with +). --suite=<mode> plays the maps that list that mode (ctf, koth, bomb, hostage, elim,
 *   forts, tdm). --pictures=dir after a run draws the maps it played, with their failed searches. --set=a,b plays
 *   every match once in each weapon set (absent: the map's own default); every report lists kills by weapon per set.
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
  /** The director's role (squad, camper, sniper, lone wolf; '' without one). */
  job?: string;
  /** Seconds in a fight (a target in sight, or fighting, in cover or retreating from one), and of those in cover. */
  fight?: number;
  coverFight?: number;
  /** Kills with a scoped gun (sniper, marksman, railgun), and of those from a vantage spot it held. */
  scopedKills?: number;
  postKills?: number;
  /** Vantage spots it got to (campers, snipers), and rounds it fired from one. */
  posts?: number;
  postShots?: number;
  /** Snipers: spots left after a shot or two or for being spotted, and seconds a shot was held for a better one. */
  moves?: number;
  held?: number;
  /** Its style: Arena, Tactical, or neither ('mixed': the character's own way between them). */
  style?: BotStyleName;
}

type BotStyleName = 'arena' | 'tactical' | 'mixed';
const STYLES: readonly BotStyleName[] = ['tactical', 'mixed', 'arena'];

function styleOf(p: BotProfile): BotStyleName {
  return hasTag(p, 'ARENA') ? 'arena' : hasTag(p, 'TACTICAL') ? 'tactical' : 'mixed';
}

/** A row's style (rows from before it was kept: by its character, as a match without a style setting plays it). */
function rowStyle(r: BotRow): BotStyleName {
  return r.style ?? (CHARACTER_PROFILES[r.look] ? styleOf(CHARACTER_PROFILES[r.look]!) : 'mixed');
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
  /** Team modes: each team's score at the end (kills, hill seconds, captures: what a score limit counts). */
  teams?: Record<string, number>;
  /** The most kills any one bot made (free-for-all: the leader's score). */
  top?: number;
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
  /**
   * Breakthrough (its first round, or both with the sides swapped): sectors taken of the map's, the second each fell,
   * how the round ended (`attack`: the attackers broke through; `defence`: the line held; `open`: still playing when
   * the report's time ran out), when, and the attackers' reinforcements at the start and left.
   */
  breakthrough?: { sectors: number; of: number; fell: number[]; outcome: 'attack' | 'defence' | 'open'; ended: number | null; poolStart: number; poolLeft: number };
  /** Failed route searches, where (at most FAIL_SPOTS a match, spread over it). */
  fails?: FailSpot[];
  /** Where stuck recoveries happened most: "x,y,z doing" (4 m cells) and how many. */
  stuckAt?: [string, number][];
  /**
   * Route variety (docs/BOTS.md, "Route variety"): per team and trip (match.botTrips, its corridors), bot-seconds of
   * its bots between a fifth and four fifths of the way along it, by the corridor they were on (within ROUTE_NEAR m of
   * it), and off them all.
   */
  routes?: { team: string; to: [number, number, number]; corridors: number; use: number[]; other: number; cross?: number[]; crossOther?: number; follow?: [number, number, number] }[];
  /** Group pushes per team (the team brain, bots/teamBrain.ts PushStats): waves set out, got there, lost half first, metres gained and seconds. */
  pushes?: Record<string, { started: number; reached: number; lostHalf: number; metres: number; seconds: number }>;
  /** The weapon set it played (sim/weaponSets.ts: --set, else the map's default), and the bots' kills by weapon id (not suicides). */
  set?: string;
  weaponKills?: Record<string, number>;
  bots: BotRow[];
}

const FAIL_SPOTS = 600;
/** On a corridor: within this of its route (m). */
const ROUTE_NEAR = 15;
/** A trip's route choice is judged with this many votes or more (bots past its middle). */
const WAY_VOTES = 6;
/** A corridor carries this share of a team's way or more: it is one of the routes the team uses. */
const ROUTE_USED = 0.15;
/** Weapons with a scope (a sniper's kill). */
const SCOPED = new Set(['core.sniper', 'core.marksman', 'core.railgun']);
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
/** --set=a,b: every match once in each weapon set (absent: the map's own default). */
const setArg = opt('set')?.split(',').filter(Boolean);
for (const s of setArg ?? []) if (!isWeaponSetId(s)) throw new Error(`unknown weapon set ${s} (${WEAPON_SET_IDS.join(', ')})`);

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
    // Per map, too (the job's log is where a run's numbers can be read back without its artifacts).
    printMaps(rows);
    const pictures = opt('pictures');
    if (pictures) {
      // (The pictures build each map's navmesh and level physics: both need their WASM first.)
      await Promise.all([initPhysics(), initNavigation()]);
      await drawNavPictures(here(pictures), mapsDir, rows);
    }
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
  const sets: (string | undefined)[] = limits || !setArg?.length ? [undefined] : setArg;
  const jobs = pairs.flatMap(([id, m]) => runSeeds.flatMap((seed) => sets.map((set) => ({ id, mode: m, seed, set })))).filter((_, i) => i % n === k);
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
    const row = play(map, job.mode, job.seed, runSeconds, job.set);
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
  return [...new Map(files.split('+').flatMap((p) => JSON.parse(readFileSync(here(p), 'utf8')) as MatchRow[]).map((m) => [`${m.map}|${m.mode}|${m.seed}|${m.set ?? ''}`, m] as const)).values()];
}

/** Reasons a bot may stand still in a fight (not "idle" in the owner's sense). */
const FIGHTING = new Set<string>(['fight', 'cover', 'retreat', 'chaseHold', 'throw', 'dodge']);

function play(map: MapDocument, mode: GameMode, seed: number, seconds: number, set?: string): MatchRow {
  const base = rulesForMode(map, mode);
  const rules = { ...base, scoreLimit: 0, timeLimitSeconds: 0, ...(style ? { botStyle: style } : {}), ...(set ? { weaponSet: set } : {}) };
  if (players && rules.teamSizes?.length) rules.teamSizes = rules.teamSizes.map((_, i, a) => Math.floor(players / a.length) + (i < players % a.length ? 1 : 0));
  const total = players ?? (rules.teamSizes?.length ? rules.teamSizes.reduce((a, b) => a + b, 0) : 16);
  const match = new Match(map, rules, seed);
  for (let i = 0; i < total; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal, true);
  const ctf = match.mode instanceof CtfMode ? match.mode : match.mode instanceof FortsMode ? match.mode.ctf : null;
  const koth = match.mode instanceof KothMode ? match.mode : null;
  const forts = match.mode instanceof FortsMode ? match.mode : null;
  const bt = match.mode instanceof BreakthroughMode ? match.mode : null;
  const btRow: MatchRow['breakthrough'] = bt ? { sectors: 0, of: bt.sectors.length, fell: [], outcome: 'open', ended: null, poolStart: bt.pool, poolLeft: bt.pool } : undefined;
  const bots = match.combatants().filter((c) => c.bot);
  const rec = new Map<number, BotRow>();
  for (const c of bots) {
    rec.set(c.slot, { slot: c.slot, name: c.name, team: c.faction, look: c.look, role: '', alive: 0, doing: {}, idle: 0, idleCalm: 0, frozen: 0, why: {}, goalTime: 0, towardGoal: 0, atGoal: 0, takes: 0, captures: 0, returns: 0, drops: 0, searches: 0, pathFailures: 0, stuck: 0, loops: 0, kills: 0, deaths: 0, spells: [], job: '', fight: 0, coverFight: 0, scopedKills: 0, postKills: 0, posts: 0, postShots: 0 });
  }
  // Route variety: each team's trips (to an objective) and the bot-seconds on each of their corridors.
  const trips = match.botTrips().filter((t) => t.kind !== 'carry' && t.trip.corridors.length > 0);
  const routeUse = trips.map((t) => ({ team: t.team, to: [Math.round(t.to.x), Math.round(t.to.y), Math.round(t.to.z)] as [number, number, number], corridors: t.trip.corridors.length, use: t.trip.corridors.map(() => 0), other: 0, cross: t.trip.corridors.map(() => 0), crossOther: 0, follow: [0, 0, 0] as [number, number, number] }));
  // Route choice: per bot and trip, its progress along the trip a second ago, and whether it has voted this life.
  const crossing = new Map<string, { along: number; voted: boolean }>();
  // Vantage spots: where each bot last held one (to count arrivals).
  const postAt = new Map<number, string>();
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
  const weaponKills: Record<string, number> = {};
  const out: MatchRow = { map: map.metadata.id, mode, seed, seconds, players: total, takes: 0, captures: 0, returns: 0, drops: 0, firstTake: null, firstCapture: null, runs, kills: 0, objective: {}, tickMs: 0, tickP95: 0, set: matchWeaponSet(rules, map), weaponKills, bots: [] };
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
  // Seconds played: all of them, or (Breakthrough) until the last round is over.
  let played = seconds;
  for (let k = 1; k <= seconds * TICK_RATE; k++) {
    if (btRow?.ended != null) {
      played = btRow.ended;
      break;
    }
    const t0 = performance.now();
    const events = match.step();
    tickMs.push(performance.now() - t0);
    const t = k / TICK_RATE;
    if (bt && btRow && btRow.poolStart === 0 && bt.pool > 0) btRow.poolStart = bt.pool;
    if (bt && btRow) btRow.poolLeft = bt.pool;
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
        if (killer && e.killer !== e.victim) {
          killer.kills++;
          weaponKills[e.weapon] = (weaponKills[e.weapon] ?? 0) + 1;
          if (SCOPED.has(e.weapon)) {
            killer.scopedKills!++;
            if (match.actor(e.killer!)?.bot?.vantage?.arrived) killer.postKills!++;
          }
        }
      }
      // Rounds fired from a vantage spot it holds.
      if (e.e === 'shot') {
        const r = rec.get(e.s);
        if (r && match.actor(e.s)?.bot?.vantage?.arrived) r.postShots!++;
      }
      if (e.e === 'bt' && btRow && bt) {
        // The pool is dealt when play begins (after the countdown): its first value is the start.
        if (e.a === 'start' && e.n === 1) btRow.poolStart = bt.pool;
        if (e.a === 'sector') {
          btRow.sectors++;
          btRow.fell.push(Math.round(t));
        }
        if (e.a === 'round' && e.n === bt.rounds) {
          btRow.outcome = e.team === bt.attackers ? 'attack' : 'defence';
          btRow.ended = Math.round(t);
        }
      }
      if (e.e === 'hill' || e.e === 'bomb' || e.e === 'elim' || e.e === 'hostage' || e.e === 'bt') {
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
        for (let i = 0; i < trips.length; i++) crossing.delete(`${c.slot}|${i}`);
        continue;
      }
      r.alive += dt;
      const p = c.move.pos;
      h.push({ x: p.x, y: p.y, z: p.z, yaw: c.yaw });
      if (h.length > RING + 1) h.shift();
      const doing: string = b.doing;
      // In a fight (a target in sight, or fighting, in cover or retreating from one), and in cover then.
      if (!c.mount && (b.target !== null || doing === 'fight' || doing === 'cover' || doing === 'retreat')) {
        r.fight! += dt;
        if (doing === 'cover' || (b.coverSpot && Math.hypot(c.move.pos.x - b.coverSpot.pos.x, c.move.pos.z - b.coverSpot.pos.z) < 1)) r.coverFight! += dt;
      }
      // A vantage spot it got to.
      const v = b.vantage;
      if (v?.arrived) {
        const key = `${Math.round(v.pos.x)},${Math.round(v.pos.z)}`;
        if (postAt.get(c.slot) !== key) {
          postAt.set(c.slot, key);
          r.posts!++;
        }
      } else postAt.delete(c.slot);
      // Route variety, once a second: between a fifth and four fifths of the way along a trip of its team's toward
      // the objective it is going for (any, without a goal: Team Deathmatch, Elimination before the hunt), on which
      // corridor.
      if (k % TICK_RATE === 0 && !c.mount && routeUse.length) {
        const goalNow = match.mode ? match.mode.botGoal(c, []) : null;
        for (let i = 0; i < trips.length; i++) {
          const t = trips[i]!;
          if (t.team !== c.faction) continue;
          if (goalNow && Math.hypot(goalNow.pos.x - t.to.x, goalNow.pos.z - t.to.z) > 10) continue;
          const dx = t.to.x - t.from.x;
          const dz = t.to.z - t.from.z;
          const along = ((p.x - t.from.x) * dx + (p.z - t.from.z) * dz) / Math.max(1, dx * dx + dz * dz);
          // Route choice: the first time this life it passes the middle of the trip, the corridor it is on.
          const key = `${c.slot}|${i}`;
          const cs = crossing.get(key);
          if (cs && !cs.voted && cs.along < 0.5 && along >= 0.5) {
            cs.voted = true;
            let pick = -1;
            let near = ROUTE_NEAR;
            t.trip.corridors.forEach((cor, j) => {
              const o = placeOn(cor, p).off;
              if (o < near) {
                near = o;
                pick = j;
              }
            });
            if (pick >= 0) routeUse[i]!.cross[pick]!++;
            else routeUse[i]!.crossOther++;
            // How it went: on the corridor it was following (the team brain's or its own pick), off it, or its own lane.
            const own = (b as unknown as { corridor: unknown }).corridor;
            const followed = own ? t.trip.corridors.indexOf(own as never) : -2;
            routeUse[i]!.follow[followed === -2 || followed === -1 ? 2 : followed === pick ? 0 : 1]++;
          }
          if (cs) cs.along = along;
          else crossing.set(key, { along, voted: false });
          if (along < 0.2 || along > 0.8) continue;
          let best = -1;
          let off = ROUTE_NEAR;
          t.trip.corridors.forEach((cor, j) => {
            const o = placeOn(cor, p).off;
            if (o < off) {
              off = o;
              best = j;
            }
          });
          if (best >= 0) routeUse[i]!.use[best]!++;
          else routeUse[i]!.other++;
        }
      }
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
    r.job = match.botRole(c.slot) ?? '';
    r.style = styleOf(c.bot!.profile);
    r.moves = c.bot!.relocations;
    r.held = c.bot!.heldShots;
    out.bots.push(r);
  }
  out.routes = routeUse.filter((u) => u.other + u.use.reduce((a, b) => a + b, 0) > 0);
  const pushes: NonNullable<MatchRow['pushes']> = {};
  for (const team of new Set(bots.map((c) => c.faction).filter((t): t is string => !!t))) {
    const st = match.teamBrain(team)?.stats;
    if (st && st.started) pushes[team] = { ...st, metres: Math.round(st.metres), seconds: Math.round(st.seconds) };
  }
  if (Object.keys(pushes).length) out.pushes = pushes;
  const sorted = [...tickMs].sort((x, y) => x - y);
  out.tickMs = tickMs.reduce((x, y) => x + y, 0) / tickMs.length;
  out.tickP95 = sorted[Math.floor(sorted.length * 0.95)]!;
  // What a score limit would count: the teams' scores, and free-for-all's leader (matchSetup.ts suggestedLimits is fitted to these).
  if (match.teams) out.teams = Object.fromEntries(match.teamScores());
  out.top = Math.max(0, ...bots.map((c) => c.kills));
  out.thinkMs = (simProfile.ms.get('bots') ?? 0) / tickMs.length;
  // Every navmesh path query (bots' routes, presses, sidesteps, lanes, modes...), and those that found no way.
  out.navQueries = simProfile.n.get('nav') ?? 0;
  out.navFails = simProfile.n.get('navFail') ?? 0;
  out.seconds = played;
  out.coverage = behaviour.coverage(played);
  if (btRow) out.breakthrough = btRow;
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

/** A Breakthrough match in a line: "2 of 3 sectors (A 76 s, B 190 s), the line held at 410 s; reinforcements 48, 3 left". */
export function breakthroughText(b: NonNullable<MatchRow['breakthrough']>): string {
  const fell = b.fell.map((t, i) => `${String.fromCharCode(65 + (i % Math.max(1, b.of)))} ${t} s`).join(', ');
  const end = b.outcome === 'attack' ? `the attack broke through at ${b.ended} s` : b.outcome === 'defence' ? `the line held at ${b.ended} s` : 'still playing';
  return `${b.sectors} of ${b.of} sectors${fell ? ` (${fell})` : ''}, ${end}; reinforcements ${b.poolStart}, ${b.poolLeft} left`;
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

const pct = (v: number, of: number) => `${((v / Math.max(1e-9, of)) * 100).toFixed(1)}%`;
const sum = <T>(rs: readonly T[], f: (r: T) => number) => rs.reduce((a, r) => a + f(r), 0);

/** A weapon's name in the report: a gun's, a grenade's (its kill credit is core.<kind>), else its id. */
function weaponName(id: string): string {
  const w = CORE_WEAPONS[id];
  if (w) return w.displayName;
  const t = (Object.keys(THROWABLE_DEFS) as (keyof typeof THROWABLE_DEFS)[]).find((k) => throwableWeaponId(k) === id);
  return t ? THROWABLE_DEFS[t].displayName : id.replace(/^core\./, '');
}

/** A grenade that hurts nobody: no blast, bomblets, airstrike or harmful zone (the smoke grenade, sandbags). */
function harmless(kind: keyof typeof THROWABLE_DEFS): boolean {
  const p = THROWABLE_DEFS[kind].projectile;
  return !p.splashDamage && !p.cluster && !p.airstrike && (!p.zone || p.zone.kind === 'smoke');
}

/** Kills by weapon, most first: "Assault Rifle 31, Pistol 12". */
const killsText = (kills: ReadonlyMap<string, number>): string => [...kills].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([w, n]) => `${weaponName(w)} ${n}`).join(', ') || 'none';

/**
 * Kills by weapon per weapon set (docs/WEAPON_SETS_PLAN.md, "Proof"; sim/weaponSets.ts): a table row per set the
 * matches played, its matches and kills, the bots' kills by weapon (most first), and the set's weapons and grenades
 * that got none (Standard has no list of its own: as placed on each map).
 */
export function weaponSetRows(rows: readonly MatchRow[]): string[] {
  const bySet = new Map<string, MatchRow[]>();
  for (const r of rows) {
    if (!r.weaponKills) continue;
    const id = r.set ?? 'standard';
    (bySet.get(id) ?? bySet.set(id, []).get(id)!).push(r);
  }
  const order = (id: string) => (WEAPON_SET_IDS as readonly string[]).indexOf(id);
  const out: string[] = [];
  for (const [id, ms] of [...bySet].sort((a, b) => order(a[0]) - order(b[0]))) {
    const kills = new Map<string, number>();
    for (const m of ms) for (const [w, n] of Object.entries(m.weaponKills ?? {})) kills.set(w, (kills.get(w) ?? 0) + n);
    const set = getWeaponSet(id);
    const own = setWeaponIds(set);
    // Grenades that can't kill (smoke, sandbags) aren't missed for having no kills.
    const grenades = (setThrowables(set) ?? []).filter((k) => !harmless(k)).map((k) => throwableWeaponId(k));
    const none = own ? [...own, ...grenades].filter((w) => !kills.get(w)) : null;
    const total = [...kills.values()].reduce((a, b) => a + b, 0);
    out.push(`| ${set.name} | ${ms.length} | ${total} | ${killsText(kills)} | ${none === null ? 'as placed' : none.length ? none.map(weaponName).join(', ') : 'every one got kills'} |`);
  }
  return out;
}

/** The kills-by-weapon table (weaponSetRows) with its head, or nothing when no match recorded its kills. */
function weaponSetTable(rows: readonly MatchRow[]): string[] {
  const body = weaponSetRows(rows);
  return body.length ? ['| Weapon set | matches | kills | kills by weapon (bots, most first) | set weapons and grenades without a kill |', '|---|---|---|---|---|', ...body] : [];
}

function printMatch(m: MatchRow): void {
  const alive = sum(m.bots, (r) => r.alive);
  const goalT = sum(m.bots, (r) => r.goalTime);
  console.log(`\n== ${m.map} ${m.mode} seed ${m.seed} | ${m.players} bots, ${m.seconds} s | tick ${m.tickMs.toFixed(2)} ms (p95 ${m.tickP95.toFixed(2)}), bot thinking ${(m.thinkMs ?? 0).toFixed(2)} ms`);
  if (m.mode === 'core.ctf' || m.mode === 'core.forts' || m.takes || m.captures) {
    const runs = m.runs.map((r) => `${r.t.toFixed(0)}s:${r.end}${r.end === 'open' ? '' : `@${r.seconds}s`}(${r.from}m)`).join(' ');
    console.log(`flags: captures ${m.captures} | takes ${m.takes} | drops ${m.drops} | returns ${m.returns} | first take ${m.firstTake?.toFixed(0) ?? '-'} s, first capture ${m.firstCapture?.toFixed(0) ?? '-'} s | runs ${runs || 'none'}`);
  }
  if (m.objective && Object.keys(m.objective).length) console.log(`objective: ${Object.entries(m.objective).map(([k, v]) => `${k} ${v}`).join(' | ')}`);
  const perMin = (n: number) => ((n / m.seconds) * 60).toFixed(1);
  const teams = Object.entries(m.teams ?? {});
  const lead = Math.max(0, ...teams.map(([, v]) => v));
  console.log(`scores: ${teams.length ? `${teams.map(([k, v]) => `${k} ${v}`).join(' · ')} (leading team ${perMin(lead)}/min) | ` : ''}top bot ${m.top ?? 0} kills (${perMin(m.top ?? 0)}/min)`);
  if (m.hill) console.log(`hill: held ${m.hill.held} s, contested ${m.hill.contested} s, empty ${m.hill.empty} s`);
  if (m.rounds) console.log(`rounds: ${m.rounds.length} finished${m.rounds.length ? `, ${(sum(m.rounds, (r) => r) / m.rounds.length).toFixed(0)} s on average (${m.rounds.join(', ')})` : ''}`);
  if (m.pieces !== undefined) console.log(`forts: ${m.pieces} pieces built`);
  if (m.breakthrough) console.log(`breakthrough: ${breakthroughText(m.breakthrough)}`);
  const searches = sum(m.bots, (r) => r.searches);
  const failures = sum(m.bots, (r) => r.pathFailures);
  console.log(`time: idle ${pct(sum(m.bots, (r) => r.idle), alive)} (out of a fight ${pct(sum(m.bots, (r) => r.idleCalm), alive)}, frozen ${pct(sum(m.bots, (r) => r.frozen), alive)}, no route ${pct(sum(m.bots, (r) => r.why.noPath ?? 0), alive)}) | going to the goal ${pct(sum(m.bots, (r) => r.towardGoal), goalT)} of goal time, at it ${pct(sum(m.bots, (r) => r.atGoal), goalT)} | kills ${m.kills} (${((m.kills / m.seconds) * 60).toFixed(1)}/min) | stuck recoveries ${sum(m.bots, (r) => r.stuck)} (loops ${sum(m.bots, (r) => r.loops)}) | route searches ${searches}, no route ${failures} (${pct(failures, searches)})`);
  if (m.coverage !== undefined) console.log(`map: coverage ${((m.coverage ?? 0) * 100).toFixed(1)}% a minute, spread ${(m.spread ?? 0).toFixed(3)} | spawn deaths ${m.spawnDeaths} of ${m.deaths} (${pct(m.spawnDeaths ?? 0, m.deaths ?? 0)})`);
  if (m.routes?.length) {
    const ways = m.routes.map((u) => {
      const total = u.use.reduce((a, b) => a + b, 0) + u.other;
      return `${u.team} to (${u.to[0]}, ${u.to[2]}): ${u.corridors} way${u.corridors === 1 ? '' : 's'}, ${u.use.map((v) => pct(v, total)).join('/')} (off them ${pct(u.other, total)}; ${total} bot-s)`;
    });
    console.log(`routes: ${ways.join(' | ')}`);
  }
  const fightT = sum(m.bots, (r) => r.fight ?? 0);
  const snipers = m.bots.filter((r) => r.job === 'sniper');
  if (m.weaponKills) console.log(`weapons (${getWeaponSet(m.set).name}): ${killsText(new Map(Object.entries(m.weaponKills)))}`);
  console.log(`fights: in cover ${pct(sum(m.bots, (r) => r.coverFight ?? 0), fightT)} of fight time | scoped kills ${sum(m.bots, (r) => r.scopedKills ?? 0)} (from a vantage spot ${sum(m.bots, (r) => r.postKills ?? 0)}) | snipers ${snipers.length}: spots ${sum(snipers, (r) => r.posts ?? 0)}, rounds from spots ${sum(snipers, (r) => r.postShots ?? 0)}, moved on after shots ${sum(snipers, (r) => r.moves ?? 0)}, shots held ${sum(snipers, (r) => r.held ?? 0)} s, kills ${sum(snipers, (r) => r.kills)} (scoped ${sum(snipers, (r) => r.scopedKills ?? 0)})`);
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
    ...routeMeasures(ms),
    coverFight: sum(bots, (r) => r.fight ?? 0) > 0 ? sum(bots, (r) => r.coverFight ?? 0) / sum(bots, (r) => r.fight ?? 0) : undefined,
    /** Time in cover in a fight by style (Phase B item 6: Tactical most, Arena least). */
    coverByStyle: Object.fromEntries(
      STYLES.map((st) => {
        const of = bots.filter((r) => rowStyle(r) === st);
        const fight = sum(of, (r) => r.fight ?? 0);
        return [st, fight > 0 ? sum(of, (r) => r.coverFight ?? 0) / fight : undefined];
      }),
    ) as Record<BotStyleName, number | undefined>,
    scopedKills: sum(bots, (r) => r.scopedKills ?? 0) / n,
    postKills: sum(bots, (r) => r.postKills ?? 0) / n,
    sniperPosts: sum(bots.filter((r) => r.job === 'sniper'), (r) => r.posts ?? 0) / n,
    sniperMoves: sum(bots.filter((r) => r.job === 'sniper'), (r) => r.moves ?? 0) / n,
    snipers: bots.filter((r) => r.job === 'sniper').length / n,
  };
}

/**
 * Route variety over some matches (docs/BOTS.md, "Route variety"): of each team's trips with two or more corridors
 * (and 20 bot-seconds measured on it), the share where the team used two routes or more (a corridor carrying
 * ROUTE_USED of its bots or more; those off every corridor count as one more route when they do), and the busiest
 * route's share on average; trips with only one way (a single bridge) are counted apart, not judged.
 */
export function routeMeasures(ms: readonly MatchRow[]): { routes2?: number; busiest?: number; routesUsed?: number; oneWay: number; tripsMeasured: number; ways2?: number; waysBusiest?: number } {
  const choice = wayMeasures(ms);
  let multi = 0;
  let two = 0;
  let busy = 0;
  let used = 0;
  let oneWay = 0;
  for (const m of ms) {
    for (const u of m.routes ?? []) {
      const total = u.use.reduce((a, b) => a + b, 0) + u.other;
      if (total < 20) continue;
      if (u.corridors < 2) {
        oneWay++;
        continue;
      }
      const shares = [...u.use, u.other].map((v) => v / total);
      const n = shares.filter((v) => v >= ROUTE_USED).length;
      multi++;
      used += n;
      if (n >= 2) two++;
      busy += Math.max(...shares);
    }
  }
  return multi ? { routes2: two / multi, busiest: busy / multi, routesUsed: used / multi, oneWay, tripsMeasured: multi, ...choice } : { oneWay, tripsMeasured: 0, ...choice };
}

/**
 * Route choice (each bot's way past the middle of a trip, once a life: the `cross` votes): of each team's trips with two
 * or more corridors and WAY_VOTES votes, the share where two ways or more took ROUTE_USED of them, and the busiest way's
 * share on average. Unlike `routes` (bot-seconds by the corridor they were near), a long fight on one corridor counts
 * once per bot, not once a second.
 */
export function wayMeasures(ms: readonly MatchRow[]): { ways2?: number; waysBusiest?: number } {
  let multi = 0;
  let two = 0;
  let busy = 0;
  for (const m of ms) {
    for (const u of m.routes ?? []) {
      if (!u.cross || u.corridors < 2) continue;
      const total = u.cross.reduce((a, b) => a + b, 0) + (u.crossOther ?? 0);
      if (total < WAY_VOTES) continue;
      const shares = [...u.cross, u.crossOther ?? 0].map((v) => v / total);
      multi++;
      if (shares.filter((v) => v >= ROUTE_USED).length >= 2) two++;
      busy += Math.max(...shares);
    }
  }
  return multi ? { ways2: two / multi, waysBusiest: busy / multi } : {};
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
  routes2: { better: 'high', of: (m) => m.routes2, label: 'team trips on two routes or more', pct: true },
  busiest: { better: 'low', of: (m) => m.busiest, label: "busiest route's share", pct: true },
  coverFight: { better: 'high', of: (m) => m.coverFight, label: 'time in cover in a fight', pct: true },
  postKills: { better: 'high', of: (m) => m.postKills, label: 'scoped kills from a vantage spot a match' },
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
  lines.push('| Mode | matches | failed searches | no-route idle | idle out of a fight | frozen | stuck a bot-min | going to the goal | coverage /min | spawn deaths | kills /min | two routes | busiest route | two ways | busiest way | cover in fights | scoped kills (from spots) | think ms | objective |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
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
    lines.push(`| ${k} | ${m.n} | ${f(m.failedSearches, true, 2)} | ${f(m.noRouteIdle, true, 2)} | ${f(m.calm, true)} | ${f(m.frozen, true)} | ${f(m.stuckPerBotMin, false, 2)} | ${f(m.goalTime > 0 ? m.toward : undefined, true)} | ${f(m.coverage, true)} | ${f(m.spawnDeaths, true)} | ${f(m.killsMin)} | ${f(m.routes2, true, 0)} | ${f(m.busiest, true, 0)} | ${f(m.ways2, true, 0)} | ${f(m.waysBusiest, true, 0)} | ${f(m.coverFight, true)} | ${f(m.scopedKills)} (${f(m.postKills)}) | ${f(m.thinkMs, false, 2)} | ${obj || '-'} |`);
  }
  const sets = weaponSetTable(rows);
  if (sets.length) lines.push('', '#### Kills by weapon, per weapon set', '', ...sets);
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

/** One line per map and mode: its objective and the measures every mode has (the judge's log: every map's numbers). */
function printMaps(rs: readonly MatchRow[]): void {
  const f = (v: number | undefined, d = 1, k = 1) => (v === undefined ? '-' : (v * k).toFixed(d));
  console.log('\n| Map | mode | matches | objective | idle out of a fight % | stuck a bot-min | kills/min | two routes % | busiest route % | busiest way % | cover in fights % | scoped kills (from spots) | pushes (reached, lost half) |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const byKey = new Map<string, MatchRow[]>();
  for (const r of rs) (byKey.get(`${r.map}|${r.mode}`) ?? byKey.set(`${r.map}|${r.mode}`, []).get(`${r.map}|${r.mode}`)!).push(r);
  for (const [key, ms] of [...byKey].sort((a, b) => a[0].localeCompare(b[0]))) {
    const [map, mode] = key.split('|');
    const m = measure(ms);
    const obj = [
      m.captures !== undefined ? `caps ${f(m.captures)} takes ${f(m.takes)}` : '',
      m.hillHeld !== undefined ? `held ${f(m.hillHeld, 1, 100)}% contested ${f(m.hillContested, 1, 100)}%` : '',
      m.plants !== undefined ? `plants ${f(m.plants)} defuses ${f(m.defuses)}` : '',
      m.rescues !== undefined ? `rescues ${f(m.rescues)}` : '',
      m.roundSeconds !== undefined ? `rounds ${f(m.rounds)} of ${f(m.roundSeconds, 0)} s` : '',
      m.pieces !== undefined ? `pieces ${f(m.pieces, 0)}` : '',
      breakthroughSummary(ms),
    ].filter(Boolean).join(', ') || '-';
    const s = ms.flatMap((r) => Object.values(r.pushes ?? {}));
    const pushes = s.length ? `${sum(s, (v) => v.started)} (${sum(s, (v) => v.reached)}, ${sum(s, (v) => v.lostHalf)})` : '-';
    console.log(`| ${map} | ${mode!.slice(5)} | ${m.n} | ${obj} | ${f(m.calm, 1, 100)} | ${f(m.stuckPerBotMin, 2)} | ${f(m.killsMin)} | ${m.routes2 === undefined ? (m.oneWay ? 'one way' : '-') : f(m.routes2, 0, 100)} | ${f(m.busiest, 0, 100)} | ${f(m.waysBusiest, 0, 100)} | ${f(m.coverFight, 1, 100)} | ${m.scopedKills.toFixed(1)} (${m.postKills.toFixed(1)}) | ${pushes} |`);
  }
}

function printSummary(rs: readonly MatchRow[]): void {
  console.log('\n| Map | matches | bots | captures/match | caps/min | flag takes/match | returns/match | matches with a capture | idle % | idle out of a fight % | frozen % | no-route idle % | going to goal % | stuck/match | searches/match | failed searches % | 10 s+ idle spells/match | coverage % | kills/min | two routes % | busiest route % | cover in fights % | scoped kills (from spots) | think ms | tick ms |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const f = (v: number | undefined, d = 1, k = 1) => (v === undefined ? '-' : (v * k).toFixed(d));
  for (const m of perMap(rs)) {
    console.log(`| ${m.map} | ${m.n} | ${m.players} | ${f(m.captures)} | ${m.capsMin.toFixed(2)} | ${f(m.takes)} | ${f(m.returns)} | ${m.withCapture}/${m.n} | ${f(m.idle, 1, 100)} | ${f(m.calm, 1, 100)} | ${f(m.frozen, 1, 100)} | ${f(m.noRouteIdle, 2, 100)} | ${f(m.toward, 1, 100)} | ${m.stuck.toFixed(0)} | ${m.searches.toFixed(0)} | ${f(m.failedSearches, 2, 100)} | ${m.spells10.toFixed(1)} | ${f(m.coverage, 1, 100)} | ${m.killsMin.toFixed(1)} | ${m.routes2 === undefined ? (m.oneWay ? 'one way' : '-') : f(m.routes2, 0, 100)} | ${f(m.busiest, 0, 100)} | ${f(m.coverFight, 1, 100)} | ${m.scopedKills.toFixed(1)} (${m.postKills.toFixed(1)}) | ${f(m.thinkMs, 2)} | ${m.tick.toFixed(2)} |`);
  }
  const sets = weaponSetTable(rs);
  if (sets.length) console.log(`\n${sets.join('\n')}`);
  const bt = [...new Set(rs.filter((r) => r.breakthrough).map((r) => `${r.map}|${r.players}`))];
  for (const k of bt) {
    const ms = rs.filter((r) => r.breakthrough && `${r.map}|${r.players}` === k);
    console.log(`\nbreakthrough ${ms[0]!.map}, ${ms[0]!.players} bots: ${breakthroughSummary(ms)}`);
    for (const m of ms) console.log(`  seed ${m.seed}: ${breakthroughText(m.breakthrough!)}`);
  }
}

/** Breakthrough over several matches: sectors taken on average, matches broken through, each sector's average fall time. */
function breakthroughSummary(ms: readonly MatchRow[]): string {
  const bs = ms.map((m) => m.breakthrough).filter((b): b is NonNullable<MatchRow['breakthrough']> => !!b);
  if (!bs.length) return '';
  const of = Math.max(...bs.map((b) => b.of));
  const fell = Array.from({ length: of }, (_, i) => bs.map((b) => b.fell[i]).filter((t): t is number => t !== undefined));
  const times = fell.map((ts, i) => (ts.length ? `${String.fromCharCode(65 + i)} ${ts.length}/${bs.length} at ${(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(0)} s` : `${String.fromCharCode(65 + i)} 0/${bs.length}`));
  return `sectors ${(bs.reduce((a, b) => a + b.sectors, 0) / bs.length).toFixed(1)} of ${of}, broke through ${bs.filter((b) => b.outcome === 'attack').length}/${bs.length} (${times.join(', ')})`;
}

function printCompare(before: readonly MatchRow[], after: readonly MatchRow[]): void {
  const a = new Map(perMap(before).map((m) => [m.key, m]));
  const b = perMap(after);
  const f = (x: number | undefined, d = 1, k = 1) => (x === undefined ? '-' : (x * k).toFixed(d));
  console.log('| Map | captures/match | flag takes/match | matches with a capture | idle out of a fight % | frozen % | no-route idle % | going to goal % | stuck/match | failed searches % | 10 s+ idle spells/match | kills/min | two routes % | busiest route % | cover in fights % | scoped kills (from spots) | think ms | tick ms |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const m of b) {
    const o = a.get(m.key);
    console.log(`| ${m.map} | ${f(o?.captures)} → ${f(m.captures)} | ${f(o?.takes)} → ${f(m.takes)} | ${o ? `${o.withCapture}/${o.n}` : '-'} → ${m.withCapture}/${m.n} | ${f(o?.calm, 1, 100)} → ${f(m.calm, 1, 100)} | ${f(o?.frozen, 1, 100)} → ${f(m.frozen, 1, 100)} | ${f(o?.noRouteIdle, 2, 100)} → ${f(m.noRouteIdle, 2, 100)} | ${f(o?.toward, 1, 100)} → ${f(m.toward, 1, 100)} | ${f(o?.stuck, 0)} → ${f(m.stuck, 0)} | ${f(o?.failedSearches, 2, 100)} → ${f(m.failedSearches, 2, 100)} | ${f(o?.spells10)} → ${f(m.spells10)} | ${f(o?.killsMin)} → ${f(m.killsMin)} | ${f(o?.routes2, 0, 100)} → ${f(m.routes2, 0, 100)} | ${f(o?.busiest, 0, 100)} → ${f(m.busiest, 0, 100)} | ${f(o?.coverFight, 1, 100)} → ${f(m.coverFight, 1, 100)} | ${f(o?.scopedKills)} (${f(o?.postKills)}) → ${f(m.scopedKills)} (${f(m.postKills)}) | ${f(o?.thinkMs, 2)} → ${f(m.thinkMs, 2)} | ${f(o?.tick, 2)} → ${f(m.tick, 2)} |`);
  }
  const tot = (rs: readonly MatchRow[], k: (m: MatchRow) => number) => rs.reduce((x, m) => x + k(m), 0);
  console.log(`\nall maps: captures ${tot(before, (m) => m.captures)} → ${tot(after, (m) => m.captures)} in ${before.length} → ${after.length} matches; matches with a capture ${before.filter((m) => m.captures > 0).length} → ${after.filter((m) => m.captures > 0).length}`);
  const ma = measure(before);
  const mb = measure(after);
  const g = (v: number | undefined, d = 2, k = 100) => (v === undefined ? '-' : (v * k).toFixed(d));
  console.log(`failed searches ${g(ma.failedSearches)} → ${g(mb.failedSearches)} % (${ma.noRoute.toFixed(0)} → ${mb.noRoute.toFixed(0)} a match of ${ma.searches.toFixed(0)} → ${mb.searches.toFixed(0)}); no-route idle ${g(ma.noRouteIdle)} → ${g(mb.noRouteIdle)} %; idle out of a fight ${g(ma.calm, 1)} → ${g(mb.calm, 1)} %; frozen ${g(ma.frozen, 1)} → ${g(mb.frozen, 1)} %; stuck ${ma.stuck.toFixed(0)} → ${mb.stuck.toFixed(0)} a match (${ma.stuckPerBotMin.toFixed(2)} → ${mb.stuckPerBotMin.toFixed(2)} a bot-minute); 10 s+ idle spells ${ma.spells10.toFixed(1)} → ${mb.spells10.toFixed(1)} a match; kills ${ma.killsMin.toFixed(1)} → ${mb.killsMin.toFixed(1)} a minute; think ${g(ma.thinkMs, 2, 1)} → ${g(mb.thinkMs, 2, 1)} ms`);
  console.log(`route choice (bots past a trip's middle, once a life): two ways or more ${g(ma.ways2, 0)} → ${g(mb.ways2, 0)} % of team trips, busiest way ${g(ma.waysBusiest, 0)} → ${g(mb.waysBusiest, 0)} %`);
  console.log(`routes: team trips on two routes or more ${g(ma.routes2, 0)} → ${g(mb.routes2, 0)} % (of ${ma.tripsMeasured} → ${mb.tripsMeasured} with two ways or more; ${ma.oneWay} → ${mb.oneWay} with one), busiest route ${g(ma.busiest, 0)} → ${g(mb.busiest, 0)} %; time in cover in a fight ${g(ma.coverFight, 1)} → ${g(mb.coverFight, 1)} %; scoped kills ${ma.scopedKills.toFixed(1)} → ${mb.scopedKills.toFixed(1)} a match (from a vantage spot ${ma.postKills.toFixed(1)} → ${mb.postKills.toFixed(1)}); sniper spots ${ma.sniperPosts.toFixed(1)} → ${mb.sniperPosts.toFixed(1)} a match (${ma.snipers.toFixed(1)} → ${mb.snipers.toFixed(1)} snipers), moved on after shots ${ma.sniperMoves.toFixed(1)} → ${mb.sniperMoves.toFixed(1)} a match`);
  console.log(`time in cover in a fight by style: ${STYLES.map((st) => `${st} ${g(ma.coverByStyle[st], 1)} → ${g(mb.coverByStyle[st], 1)} %`).join(', ')}`);
  const follow = (ms: readonly MatchRow[]) => {
    const f = [0, 0, 0];
    for (const m of ms) for (const u of m.routes ?? []) if (u.follow) for (let k = 0; k < 3; k++) f[k]! += u.follow[k]!;
    const t = f[0]! + f[1]! + f[2]!;
    return t ? f.map((v) => `${((v / t) * 100).toFixed(0)}`).join('/') : '-';
  };
  console.log(`route choice by how the bots went (on the corridor they followed / off it / their own lane, %): ${follow(before)} → ${follow(after)}`);
  // Retreating, of alive time (a hurt bot getting away from what it sees: BotBrain's 'retreat').
  const doingShare = (ms: readonly MatchRow[], what: string) => {
    let t = 0;
    let all = 0;
    for (const m of ms) for (const r of m.bots) {
      for (const [k, [mv, st]] of Object.entries(r.doing)) {
        all += mv + st;
        if (k === what) t += mv + st;
      }
    }
    return all ? ((t / all) * 100).toFixed(1) : '-';
  };
  console.log(`retreating ${doingShare(before, 'retreat')} → ${doingShare(after, 'retreat')} % of alive time`);
  // Per mode: each mode's objective and the measures every mode has.
  const modes = [...new Set([...before, ...after].map((m) => m.mode))].sort();
  if (modes.length > 1 || !modes.includes('core.ctf')) {
    console.log('\n| Mode | matches | objective | idle out of a fight % | stuck a bot-min | kills/min | two routes % | busiest route % | two ways % | busiest way % | cover in fights % | pushes (reached, lost half) | think ms |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const mode of modes) {
      const x = before.filter((m) => m.mode === mode);
      const y = after.filter((m) => m.mode === mode);
      if (!x.length || !y.length) continue;
      const p = measure(x);
      const q = measure(y);
      const obj = (m: Measures) =>
        [
          m.captures !== undefined ? `caps ${f(m.captures)} takes ${f(m.takes)}` : '',
          m.hillHeld !== undefined ? `held ${f(m.hillHeld, 1, 100)} % contested ${f(m.hillContested, 1, 100)} %` : '',
          m.plants !== undefined ? `plants ${f(m.plants)} defuses ${f(m.defuses)}` : '',
          m.rescues !== undefined ? `rescues ${f(m.rescues)}` : '',
          m.roundSeconds !== undefined ? `rounds ${f(m.rounds)} of ${f(m.roundSeconds, 0)} s` : '',
          m.pieces !== undefined ? `pieces ${f(m.pieces, 0)}` : '',
        ].filter(Boolean).join(', ') || '-';
      const pushes = (rs: readonly MatchRow[]) => {
        const s = rs.flatMap((m) => Object.values(m.pushes ?? {}));
        return s.length ? `${sum(s, (v) => v.started)} (${sum(s, (v) => v.reached)}, ${sum(s, (v) => v.lostHalf)})` : '-';
      };
      console.log(`| ${mode.slice(5)} | ${x.length} → ${y.length} | ${obj(p)} → ${obj(q)} | ${f(p.calm, 1, 100)} → ${f(q.calm, 1, 100)} | ${f(p.stuckPerBotMin, 2)} → ${f(q.stuckPerBotMin, 2)} | ${f(p.killsMin)} → ${f(q.killsMin)} | ${f(p.routes2, 0, 100)} → ${f(q.routes2, 0, 100)} | ${f(p.busiest, 0, 100)} → ${f(q.busiest, 0, 100)} | ${f(p.ways2, 0, 100)} → ${f(q.ways2, 0, 100)} | ${f(p.waysBusiest, 0, 100)} → ${f(q.waysBusiest, 0, 100)} | ${f(p.coverFight, 1, 100)} → ${f(q.coverFight, 1, 100)} | ${pushes(x)} → ${pushes(y)} | ${f(p.thinkMs, 2)} → ${f(q.thinkMs, 2)} |`);
    }
  }
}

await main();
