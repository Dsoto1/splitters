import { createRng, horizontalDistance, type Vec3 } from '../math.ts';
import { TICK_RATE } from './constants.ts';
import { MATCH_PLAY } from '../content/matchPlay.generated.ts';
import { rouletteOn, type MatchRules } from './rules.ts';

/**
 * Spawning in big matches (docs/BOTS.md "Spawning"): which spawn point a
 * player gets (scored: enemies close or in sight, someone standing on it, how
 * recently it was used, the team's side), how many players a tick may spawn
 * (waves), and spawn points made up at match start when a map has too few,
 * or too bunched, for the players in it.
 */
export interface SpawnSpot {
  pos: Vec3;
  yaw: number;
  team: string | null;
  /** Made up for this match from the navmesh (never written to the map). */
  generated?: true;
}

/** How many players one spawn point serves comfortably (with spawn waves and the recent-use penalty). */
export const SPAWN_SHARE = 3;
/** Smaller matches never get made-up spawn points (the map's own are plenty, or the map's author chose them). */
export const IMPROMPTU_MIN_PLAYERS = 12;
/** Spawn points closer together than this count as one when judging how spread a side's spawns are (m). */
const SAME_SPOT = 5;
/** Made-up spawn points keep at least this far from each other and from the map's own (m). */
const MIN_SPACING = 6;
/** Farther apart than this, made-up spawn points are spread enough (m): the rest of the choice is about being near the side's base. */
const SPREAD_ENOUGH = 24;
/** Recently used: a spawn point's penalty fades over this long. */
export const SPAWN_RECENT_TICKS = TICK_RATE * 3;

// ------------------------------------------------------------------ waves

/** Combatants a match must have before bots spawn in waves (smaller matches spawn everyone at once, as before). */
export const WAVE_MIN_PLAYERS = 12;

/**
 * Bots that may (re)spawn in one tick: an eighth of the match, so a whole
 * roster is in within 8 ticks (0.13 s, quicker than any bot reacts: nobody
 * spawns into a fight the earlier waves have had time to start), spread
 * over ticks instead of all in one (one tick's worth of spawn scoring, first
 * paths and thinking).
 */
export function spawnsPerTick(players: number): number {
  return players < WAVE_MIN_PLAYERS ? Infinity : Math.max(1, Math.ceil(players / 8));
}

// ------------------------------------------------------------------ choosing a spawn point

export interface SpawnChoice {
  tick: number;
  candidates: readonly SpawnSpot[];
  /** Tick each spawn point was last used (by candidate object). */
  lastUsed: ReadonlyMap<SpawnSpot, number>;
  /** Where living enemies are. */
  enemies: readonly Vec3[];
  /** Where everyone alive is (anyone standing on a spawn point blocks it). */
  occupants: readonly Vec3[];
  /** Team modes: living teammates out of a fight (spawn near them, so each side keeps an area). */
  mates?: readonly Vec3[];
  /** Where the side's own spawns are (generated and shared spawns nearer it score higher in team modes). */
  home?: Vec3 | null;
  /**
   * Team modes on shared spawns: where the side has been spawning lately and where the other sides have (SpawnSides):
   * points nearer your own side's than an enemy side's win, so the sides don't swap ends (no spawn flips).
   */
  side?: { own: Vec3 | null; enemy: readonly Vec3[] } | null;
  /** Deaths lately (where and when): a spawn point beside a fresh body is a worse one. */
  deaths?: readonly SpawnDeath[];
  /** Line of sight between two eye points (a few rays, for the best-looking candidates only). */
  sees?: (from: Vec3, to: Vec3) => boolean;
  rng: () => number;
}

/** A death a spawn choice remembers (SpawnChoice.deaths). */
export interface SpawnDeath {
  pos: Vec3;
  tick: number;
}

/** The weights (content/match-play.json spawnChoice; what each means: its $comment). */
const W = MATCH_PLAY.spawnChoice;
/** A spawn point used a moment ago (fading over SPAWN_RECENT_TICKS): enough to break ties, not to send anyone nearer an enemy. */
const RECENT_PENALTY = 20;
/** Deaths kept for the spawn choice (the newest), and for how long. */
export const SPAWN_DEATHS_KEPT = 64;
export const SPAWN_DEATH_TICKS = Math.round(W.deathSeconds * TICK_RATE);

/** How far the nearest living enemy is from a spawn point (height counts double); Infinity with none. */
function nearestEnemy(sp: SpawnSpot, c: SpawnChoice): number {
  let nearest = Infinity;
  for (const e of c.enemies) {
    const d = horizontalDistance(sp.pos, e) + Math.abs(sp.pos.y - e.y) * 2;
    if (d < nearest) nearest = d;
  }
  return nearest;
}

/**
 * The cheap part of a spawn point's score: farther from the nearest enemy is better (up to enemyRange; past
 * farRange a little worse again: out of the game), someone
 * standing on it or right next to it is bad, a point used in the last few seconds is worse, a fresh death beside it
 * is worse, teammates out of a fight near it help, and on shared spawns in team modes the side's own end of the map
 * helps.
 */
export function spawnScore(sp: SpawnSpot, c: SpawnChoice): number {
  const nearest = nearestEnemy(sp, c);
  // Safe up to enemyRange; far past farRange, a long walk back to the fight.
  let score = Math.min(nearest, W.enemyRange);
  if (c.enemies.length && nearest > W.farRange) score -= Math.min(15, (nearest - W.farRange) * W.farWeight);
  // Somebody on it (or about to be shoved off it): another spot.
  let crowd = 0;
  for (const o of c.occupants) {
    if (Math.abs(o.y - sp.pos.y) > 2) continue;
    const dx = o.x - sp.pos.x;
    const dz = o.z - sp.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 1.5 * 1.5) score -= 60;
    else if (d2 < 4 * 4 && crowd < 3) {
      crowd++;
      score -= 6;
    }
  }
  const used = c.lastUsed.get(sp);
  if (used !== undefined && c.tick - used < SPAWN_RECENT_TICKS) score -= RECENT_PENALTY * (1 - (c.tick - used) / SPAWN_RECENT_TICKS);
  // Fresh bodies: somebody just died here (whoever killed them may still be watching it).
  if (c.deaths) {
    let fresh = 0;
    for (const d of c.deaths) {
      const age = c.tick - d.tick;
      if (age < 0 || age >= SPAWN_DEATH_TICKS) continue;
      const dist = horizontalDistance(d.pos, sp.pos) + Math.abs(d.pos.y - sp.pos.y);
      if (dist < W.deathRadius) fresh += (1 - dist / W.deathRadius) * (1 - age / SPAWN_DEATH_TICKS);
    }
    // A killing ground, at most twice the penalty however many fell there.
    score -= W.deathPenalty * Math.min(2, fresh);
  }
  if (c.mates) {
    let near = 0;
    for (const m of c.mates) if (horizontalDistance(m, sp.pos) < W.mateRange && ++near >= W.mateMax) break;
    score += near * W.mateBonus;
  }
  if (c.side?.own && c.side.enemy.length) {
    // Nearer your own side's spawns than the nearest enemy side's: the sides keep their ends of the map.
    let enemy = Infinity;
    for (const e of c.side.enemy) enemy = Math.min(enemy, horizontalDistance(sp.pos, e));
    score += Math.max(-W.sideMax, Math.min(W.sideMax, (enemy - horizontalDistance(sp.pos, c.side.own)) * W.sideWeight));
  }
  if (c.home) score -= Math.min(40, horizontalDistance(sp.pos, c.home) * 0.15);
  return score;
}

/**
 * The spawn point to use (an index into `candidates`), the same rule for people and bots: every candidate's cheap
 * score (spawnScore); the best `sightCandidates` checked for enemies with a clear sight line to them (each of its
 * `sightEnemies` nearest enemies in range that can see it costs `seenPenalty`); then one picked at random among the
 * best `safeFew` within `margin` of the best (so nobody can learn where the next spawn will be, and a few spawn
 * points share the load). Bounded: at most sightCandidates × sightEnemies rays.
 */
export function pickSpawn(c: SpawnChoice): number {
  const n = c.candidates.length;
  if (n === 0) return -1;
  const scored: { i: number; s: number; seen: number }[] = [];
  for (let i = 0; i < n; i++) scored.push({ i, s: spawnScore(c.candidates[i]!, c), seen: 0 });
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  const checked = Math.min(n, W.sightCandidates);
  if (c.sees) {
    const near: { p: Vec3; d: number }[] = [];
    for (const s of scored.slice(0, checked)) {
      const sp = c.candidates[s.i]!;
      near.length = 0;
      for (const e of c.enemies) {
        const d = horizontalDistance(e, sp.pos);
        if (d < W.sightRange) near.push({ p: e, d });
      }
      near.sort((a, b) => a.d - b.d);
      const head = { x: sp.pos.x, y: sp.pos.y + 1.6, z: sp.pos.z };
      for (const e of near.slice(0, W.sightEnemies))
        if (c.sees({ x: e.p.x, y: e.p.y + 1.6, z: e.p.z }, head)) {
          s.s -= W.seenPenalty;
          s.seen++;
        }
    }
    scored.sort((a, b) => b.s - a.s || a.i - b.i);
  }
  // The safest few: within `margin` of the best (and checked for sight lines when there were any to check), none
  // with an enemy much nearer than the best's nearest (a random pick never puts anyone in someone's lap), none seen
  // when the best isn't.
  const top = scored[0]!;
  const safeAt = Math.min(W.enemyRange, nearestEnemy(c.candidates[top.i]!, c)) * 0.7;
  const few = scored.slice(0, Math.min(W.safeFew, checked)).filter((s) => s.s >= top.s - W.margin && Math.min(W.enemyRange, nearestEnemy(c.candidates[s.i]!, c)) >= safeAt && s.seen <= top.seen);
  return few[Math.min(few.length - 1, Math.floor(c.rng() * few.length))]!.i;
}

/**
 * Team modes on shared spawn points: where each side has been spawning lately (a running average of its spawn
 * points), so a side keeps to its end of the map wherever the fight goes (SpawnChoice.side).
 */
export class SpawnSides {
  private readonly at = new Map<string, Vec3>();

  /** A side spawned at `p`: its end of the map moves a little that way. */
  note(side: string, p: Vec3): void {
    const a = this.at.get(side);
    if (!a) this.at.set(side, { ...p });
    else {
      const k = 0.15;
      a.x += (p.x - a.x) * k;
      a.y += (p.y - a.y) * k;
      a.z += (p.z - a.z) * k;
    }
  }

  /** For a spawn of `side`: its own end, and the other sides'. Null until two sides have spawned. */
  of(side: string): { own: Vec3 | null; enemy: Vec3[] } | null {
    const enemy = [...this.at].filter(([k]) => k !== side).map(([, v]) => v);
    return enemy.length ? { own: this.at.get(side) ?? null, enemy } : null;
  }
}

// ------------------------------------------------------------------ spawn protection

/**
 * Seconds of spawn protection a match gives each life (content/match-play.json spawnProtection, by mode; Roulette's
 * own in Roulette and its variants; the match's own `spawnProtection` rule first): a shield nobody else's damage
 * gets through, dropped the moment you fire.
 */
export function spawnProtection(rules: Pick<MatchRules, 'mode' | 'roulette' | 'spawnProtection'>): number {
  if (rules.spawnProtection !== undefined) return Math.max(0, Math.min(5, rules.spawnProtection));
  const by = MATCH_PLAY.spawnProtection as Readonly<Record<string, number>>;
  return (rouletteOn(rules) ? by['core.roulette'] : by[rules.mode]) ?? 0;
}

// ------------------------------------------------------------------ made-up spawn points

/** Spawn points of `pts` after merging those within SAME_SPOT of each other: how many distinct places they are. */
export function distinctSpots(pts: readonly Vec3[]): number {
  const kept: Vec3[] = [];
  for (const p of pts) if (!kept.some((k) => horizontalDistance(k, p) < SAME_SPOT && Math.abs(k.y - p.y) < 2)) kept.push(p);
  return kept.length;
}

/**
 * How many more spawn points each side needs for `players` (by side; `null` is
 * the shared pool, for free-for-all and teams without spawns of their own).
 * Nothing below IMPROMPTU_MIN_PLAYERS. Bunched points count as one.
 */
export function spawnShortfall(points: readonly SpawnSpot[], sides: readonly { id: string; players: number }[] | null, players: number): Map<string | null, number> {
  const out = new Map<string | null, number>();
  if (players < IMPROMPTU_MIN_PLAYERS) return out;
  const want = (n: number) => Math.ceil(n / SPAWN_SHARE);
  if (!sides) {
    // Free-for-all spawns on the shared points when the map has any (Match.spawn), else on all of them.
    const shared = points.filter((p) => p.team === null);
    const short = want(players) - distinctSpots((shared.length ? shared : points).map((p) => p.pos));
    if (short > 0) out.set(null, short);
    return out;
  }
  let sharedPlayers = 0;
  for (const s of sides) {
    const own = points.filter((p) => p.team === s.id).map((p) => p.pos);
    if (!own.length) {
      sharedPlayers += s.players;
      continue;
    }
    const short = want(s.players) - distinctSpots(own);
    if (short > 0) out.set(s.id, short);
  }
  if (sharedPlayers) {
    const shared = points.filter((p) => p.team === null).map((p) => p.pos);
    const short = want(sharedPlayers) - distinctSpots(shared.length ? shared : points.map((p) => p.pos));
    if (short > 0) out.set(null, short);
  }
  return out;
}

export interface SpawnGenOptions {
  /** Walkable sample points over the navmesh (NavWorld.places(): deterministic order). */
  places: readonly Vec3[];
  /** The spawn points already there (map's own and earlier generated ones). */
  existing: readonly SpawnSpot[];
  /** The side to make points for (null: shared / free-for-all). */
  side: string | null;
  count: number;
  seed: number;
  /** Team modes: the side's base (its spawns' centre) and the enemy's; points go on the own third of the line between. */
  home?: Vec3 | null;
  away?: Vec3 | null;
  /** Where points face (the middle of the map, or the enemy side). */
  faceTo: Vec3;
  /** Standing room, solid floor, no hazard, no water, not at a drop: a point a player can spawn on. */
  valid: (p: Vec3) => boolean;
  /** A walking route between two points (checked from the nearest point already accepted). */
  reachable: (a: Vec3, b: Vec3) => boolean;
}

/**
 * Extra spawn points for a side, from the navmesh's sample places: valid
 * spots (see `valid`), reachable from the side's other spawns, on the side's
 * own part of the map in team modes, spread out (each new point as far as
 * possible from every spawn point already there: farthest-point sampling),
 * deterministic for a given map and seed. Checks run lazily on the chosen
 * spot only, so the cost is a few dozen rays and paths, at match start.
 */
export function generateSpawns(o: SpawnGenOptions): SpawnSpot[] {
  if (o.count <= 0 || !o.places.length) return [];
  const rng = createRng(o.seed);
  const anchors = o.existing.filter((s) => s.team === o.side || o.side === null).map((s) => s.pos);
  const sideOf = sideFilter(o.home ?? null, o.away ?? null);
  // Candidates: on the side's part of the map (a wider band if the narrow one is short of places).
  let cands = o.places.filter((p) => sideOf(p) <= 0.4);
  if (cands.length < o.count * 4) cands = o.places.filter((p) => sideOf(p) <= 0.5);
  if (!cands.length) return [];
  // Distance from each candidate to the nearest spawn point so far (anchors, then picks).
  const minD = new Float64Array(cands.length).fill(Infinity);
  // What a candidate costs whatever else is picked: a little randomness, being far from the side's
  // end of the map, and being up on a roof or a cliff (or far off) from the side's base.
  const fixed = new Float64Array(cands.length);
  const base = o.home ?? centroid(anchors);
  for (let i = 0; i < cands.length; i++) {
    const p = cands[i]!;
    fixed[i] = rng() * 2 - sideOf(p) * 25 - (base ? Math.abs(p.y - base.y) * 0.6 + horizontalDistance(p, base) * 0.03 : 0);
    for (const a of anchors) minD[i] = Math.min(minD[i]!, spotDist(p, a));
  }
  const rejected = new Uint8Array(cands.length);
  const accepted: Vec3[] = [...anchors];
  const out: SpawnSpot[] = [];
  let tries = 0;
  while (out.length < o.count && tries < o.count * 10) {
    // Farthest from everything so far (up to a point), then nearest the side's own end of the map and level with its base.
    let best = -1;
    let bestS = -Infinity;
    for (let i = 0; i < cands.length; i++) {
      if (rejected[i]) continue;
      // Spread matters up to SPREAD_ENOUGH; past that, the nearer and more level with the base the better.
      const s = Math.min(minD[i]!, SPREAD_ENOUGH) + fixed[i]!;
      if (s > bestS) {
        bestS = s;
        best = i;
      }
    }
    if (best < 0 || minD[best]! < MIN_SPACING) break;
    tries++;
    const p = cands[best]!;
    rejected[best] = 1;
    if (!o.valid(p)) continue;
    // Reachable from the nearest point already accepted (so all of them connect to the side's spawns).
    let from: Vec3 | null = null;
    let fromD = Infinity;
    for (const a of accepted) {
      const d = spotDist(a, p);
      if (d < fromD) {
        fromD = d;
        from = a;
      }
    }
    if (from && !o.reachable(from, p)) continue;
    accepted.push(p);
    for (let i = 0; i < cands.length; i++) if (!rejected[i]) minD[i] = Math.min(minD[i]!, spotDist(cands[i]!, p));
    out.push({ pos: { ...p }, yaw: Math.atan2(o.faceTo.x - p.x, o.faceTo.z - p.z), team: o.side, generated: true });
  }
  return out;
}

const spotDist = (a: Vec3, b: Vec3): number => horizontalDistance(a, b) + Math.abs(a.y - b.y) * 2;

/** 0 at the side's own base, 1 at the enemy's, along the line between them (0 everywhere without one). */
function sideFilter(home: Vec3 | null, away: Vec3 | null): (p: Vec3) => number {
  if (!home || !away) return () => 0;
  const ax = away.x - home.x;
  const az = away.z - home.z;
  const l2 = ax * ax + az * az;
  if (l2 < 1) return () => 0;
  return (p) => Math.max(0, Math.min(1, ((p.x - home.x) * ax + (p.z - home.z) * az) / l2));
}

/** Centre (mean position) of some points, or null. */
export function centroid(pts: readonly Vec3[]): Vec3 | null {
  if (!pts.length) return null;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  return { x: x / pts.length, y: y / pts.length, z: z / pts.length };
}
