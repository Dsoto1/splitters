import { BOT_DIFFICULTIES, CORE_BOT_PROFILES } from '../bots/profile.ts';
import { BotTrace } from '../bots/botTrace.ts';
import type { MapDocument } from '../map/schema.ts';
import type { GameEvent } from '../protocol.ts';
import { TICK_RATE } from '../sim/constants.ts';
import { mapNavigation } from '../sim/mapNav.ts';
import { Match } from '../sim/match.ts';
import type { NavWorld } from '../nav/index.ts';
import type { Vec3 } from '../math.ts';
import { KothMode } from '../sim/modes/index.ts';
import { isTeamMode, isTwoTeamMode, rulesForMode, type GameMode } from '../sim/rules.ts';
import type { BotTestSummary } from './botTestSummary.ts';
import { HEAT_LAYERS, addHeat, heatCellFor, heatCells, heatGrid, type HeatCell, type HeatGrid, type HeatLayer } from './heatmap.ts';
import { EXPOSURE_SAMPLES, longSightlines, samplePlaces, spawnExposure, type SpawnExposure, type Sightline } from './spawnExposure.ts';

/**
 * MapMaker's map tests (overhaul Phase 4, items 1 and 2), run in the editor's test worker (client
 * editor/mapTestWorker.ts) so the editor never waits on them:
 * - `BotTestRun`: a headless bot match on the map being edited, as `pnpm bot-report` plays one (the same Match, bots
 *   added as the server adds them, no score or time limit), stepped a slice at a time so progress shows and Cancel
 *   is instant; afterwards heatmaps (editor/heatmap.ts) of where bots went, got stuck, died and where their routes
 *   failed (botTrace.ts, the scorecard's own counts), and a short summary;
 * - `mapExposure`: each spawn's exposure and the long sightlines (editor/spawnExposure.ts), on the navmesh and
 *   physics a match builds.
 */

export interface BotTestOptions {
  mode: GameMode;
  /** Team modes: bots on each team. */
  teamSize: number;
  /** Free-for-all modes: bots in all. */
  bots: number;
  /** Match seconds to play. */
  seconds: number;
  seed?: number;
}

/** The most bots a test run plays (owner, 2026-11-09: 64; a few minutes of a big match is still minutes of CPU, in a worker). */
export const BOT_TEST_MAX_BOTS = 64;
/** Where bots went is sampled this often (match seconds). */
const VISIT_EVERY = 0.5;

export interface BotTestResult {
  summary: BotTestSummary;
  cell: number;
  layers: Record<HeatLayer, HeatCell[]>;
}

/** Cells to draw per layer, at most (the busiest). */
const MAX_CELLS = 4000;

const OBJECTIVE_LABELS: Record<string, string> = {
  'hill hold': 'Hill taken',
  'flag take': 'Flag taken',
  'flag capture': 'Flag captured',
  'flag return': 'Flag returned',
  'flag drop': 'Flag dropped',
  'bomb plant': 'Bomb planted',
  'bomb defuse': 'Bomb defused',
  'bomb explode': 'Bomb exploded',
  'hostage rescue': 'Hostage rescued',
  'bt sector': 'Sector taken',
  'elim win': 'Round won',
  'bt capture': 'Objective captured',
  'bt destroy': 'Objective destroyed',
};

/** The bots a run plays: per team in team modes, else in all (at most BOT_TEST_MAX_BOTS). */
export function botTestRules(map: MapDocument, o: BotTestOptions) {
  const base = rulesForMode(map, o.mode);
  const rules = { ...base, scoreLimit: 0, timeLimitSeconds: 0 };
  let total: number;
  if (isTeamMode(o.mode)) {
    // As the match forms its teams (sim/npc.ts matchTeams): two in the two-team modes, else the map's team count.
    const teams = isTwoTeamMode(o.mode) ? 2 : (rules.teamSizes?.length ?? 2);
    const per = Math.max(1, Math.min(Math.floor(BOT_TEST_MAX_BOTS / teams), Math.round(o.teamSize)));
    rules.teamSizes = Array.from({ length: teams }, () => per);
    total = per * teams;
  } else total = Math.max(1, Math.min(BOT_TEST_MAX_BOTS, Math.round(o.bots)));
  return { rules, total };
}

export class BotTestRun {
  readonly match: Match;
  readonly totalTicks: number;
  private tick = 0;
  private readonly trace = new BotTrace();
  private readonly grids: Record<HeatLayer, HeatGrid>;
  private readonly firsts = new Map<string, { first: number; count: number }>();
  private readonly hill = { held: 0, contested: 0 };
  private kills = 0;
  private ms = 0;
  private readonly bots: number;

  /** Requires initPhysics() and initNavigation() to have resolved. */
  constructor(
    map: MapDocument,
    readonly opts: BotTestOptions,
  ) {
    const t0 = performance.now();
    const { rules, total } = botTestRules(map, opts);
    this.match = new Match(map, rules, opts.seed ?? 1);
    for (let i = 0; i < total; i++) this.match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal, true);
    this.bots = total;
    this.totalTicks = Math.max(1, Math.round(opts.seconds * TICK_RATE));
    let lo = Infinity;
    let hi = -Infinity;
    for (const b of this.match.geometry) {
      lo = Math.min(lo, b.min[0], b.min[2]);
      hi = Math.max(hi, b.max[0], b.max[2]);
    }
    const cell = heatCellFor(Number.isFinite(hi - lo) ? hi - lo : 100);
    this.grids = Object.fromEntries(HEAT_LAYERS.map((l) => [l, heatGrid(cell)])) as Record<HeatLayer, HeatGrid>;
    this.ms += performance.now() - t0;
  }

  get done(): boolean {
    return this.tick >= this.totalTicks;
  }

  /** Share of the run played (0..1). */
  get progress(): number {
    return this.tick / this.totalTicks;
  }

  /** Play up to `ticks` more ticks (fewer at the end). */
  advance(ticks: number): void {
    const t0 = performance.now();
    const visitEvery = Math.round(VISIT_EVERY * TICK_RATE);
    const end = Math.min(this.totalTicks, this.tick + ticks);
    const koth = this.match.mode instanceof KothMode ? this.match.mode : null;
    while (this.tick < end) {
      const events = this.match.step() as GameEvent[];
      this.tick++;
      const t = this.tick / TICK_RATE;
      for (const e of events) {
        if (e.e === 'kill') {
          this.kills++;
          const v = this.match.actor(e.victim);
          if (v) addHeat(this.grids.died, v.move.pos.x, v.move.pos.y, v.move.pos.z);
        }
        if (e.e === 'flag' || e.e === 'hill' || e.e === 'bomb' || e.e === 'hostage' || e.e === 'bt' || e.e === 'elim') {
          const k = `${e.e} ${e.a}`;
          if (!OBJECTIVE_LABELS[k]) continue;
          const f = this.firsts.get(k);
          if (f) f.count++;
          else this.firsts.set(k, { first: Math.round(t), count: 1 });
        }
      }
      if (koth) {
        if (koth.holder === 'contested') this.hill.contested += 1 / TICK_RATE;
        else if (koth.holder) this.hill.held += 1 / TICK_RATE;
      }
      if (this.tick % visitEvery) continue;
      for (const c of this.match.combatants()) {
        if (!c.bot) continue;
        const tr = this.trace.look(c)!;
        if (tr.stuck > 0) addHeat(this.grids.stuck, tr.at.x, tr.at.y, tr.at.z, tr.stuck);
        if (tr.failed > 0 && tr.noRoute) addHeat(this.grids.failed, tr.noRoute.from.x, tr.noRoute.from.y, tr.noRoute.from.z, tr.failed);
        if (c.alive && !c.mount) addHeat(this.grids.went, c.move.pos.x, c.move.pos.y, c.move.pos.z);
      }
    }
    this.ms += performance.now() - t0;
  }

  result(): BotTestResult {
    const bots = this.match.combatants().filter((c) => c.bot);
    const seconds = this.tick / TICK_RATE;
    const summary: BotTestSummary = {
      mode: this.opts.mode,
      bots: this.bots,
      seconds: Math.round(seconds),
      kills: this.kills,
      stuck: bots.reduce((a, c) => a + c.bot!.stuckCount, 0),
      searches: bots.reduce((a, c) => a + c.bot!.pathSearches, 0),
      failed: bots.reduce((a, c) => a + c.bot!.pathFailures, 0),
      objective: [...this.firsts].map(([k, f]) => ({ what: OBJECTIVE_LABELS[k]!, ...f })).sort((a, b) => a.first - b.first),
      ...(this.match.mode instanceof KothMode ? { hill: { held: Math.round(this.hill.held), contested: Math.round(this.hill.contested) } } : {}),
      ms: Math.round(this.ms),
      msPerSecond: seconds > 0 ? Math.round((this.ms / seconds) * 10) / 10 : 0,
    };
    const layers = Object.fromEntries(HEAT_LAYERS.map((l) => [l, heatCells(this.grids[l], 0, MAX_CELLS)])) as Record<HeatLayer, HeatCell[]>;
    return { summary, cell: this.grids.went.cell, layers };
  }

  destroy(): void {
    this.match.destroy();
  }
}

export interface ExposureResult {
  spawns: SpawnExposure[];
  lines: Sightline[];
  /** Places looked from. */
  places: number;
  ms: number;
}

/** Spacing of the places exposure looks from (m): half the navmesh's own (NavWorld.places, 7 m), so a small arena has enough. */
const DENSE = 3.5;

/**
 * The navmesh's main-area places (where routes reach: NavWorld.mainPlaces) with, round each, the points of the
 * navmesh DENSE m off along x and z, one per DENSE m cell and storey.
 */
export function densePlaces(nav: Pick<NavWorld, 'mainPlaces' | 'closestPoint' | 'inMain'>): Vec3[] {
  const out: Vec3[] = [];
  const seen = new Set<string>();
  const add = (p: Vec3) => {
    const k = `${Math.floor(p.x / DENSE)},${Math.floor(p.z / DENSE)},${Math.floor(p.y / 2.5)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(p);
  };
  const main = nav.mainPlaces();
  for (const p of main) add(p);
  for (const p of main) {
    for (const [dx, dz] of [[DENSE, 0], [-DENSE, 0], [0, DENSE], [0, -DENSE]] as const) {
      const want = { x: p.x + dx, y: p.y, z: p.z + dz };
      const q = nav.closestPoint(want, { x: 0.5, y: 1.5, z: 0.5 });
      if (q && Math.hypot(q.x - want.x, q.z - want.z) < 0.6 && nav.inMain(q)) add(q);
    }
  }
  return out;
}

/** Spawn exposure and the long sightlines on the navmesh and level physics a match builds (initPhysics and initNavigation first). */
export function mapExposure(map: MapDocument): ExposureResult {
  const t0 = performance.now();
  const built = mapNavigation(map);
  try {
    const places = samplePlaces(densePlaces(built.nav), EXPOSURE_SAMPLES);
    const sees = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => built.physics.lineOfSight(a, b);
    const spawns = map.entities.filter((e) => e.kind === 'spawn').map((e) => ({ id: e.id, pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, team: (e as { faction?: string | null }).faction ?? null }));
    const exposure = spawnExposure(spawns, places, sees);
    const lines = longSightlines(samplePlaces(places, 250), sees);
    return { spawns: exposure, lines, places: places.length, ms: Math.round(performance.now() - t0) };
  } finally {
    built.physics.free();
    built.nav.destroy();
  }
}
