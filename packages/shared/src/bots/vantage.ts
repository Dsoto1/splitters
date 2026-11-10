import { horizontalDistance, type Vec3 } from '../math.ts';
import { laneCover } from './sniper.ts';

/**
 * Vantage spots (docs/BOTS.md "Roles"): places worth holding, worked out once
 * per map from the navmesh's sample places and a few sight lines each, never
 * per tick. Sniper spots look a long way down one direction, ideally from
 * up high; camp spots are tucked in (walls on two or more sides) with a view
 * of 10–50 m. Bots claim a spot while they use it, so two don't share one.
 */
export type VantageKind = 'sniper' | 'camp';

export interface VantageSpot {
  pos: Vec3;
  kind: VantageKind;
  /** The direction to watch (yaw) and how far one can see that way (m). */
  yaw: number;
  reach: number;
  /** How much higher than the ground around it (m). */
  height: number;
  score: number;
  /** Only parkour gets there (a roof or ledge a jump reaches: nav/parkour.ts): where others don't normally go. */
  parkour?: boolean;
  /** From the map's bot hints (hints.ts; the hint's id), and the team it is for (absent: every side's). */
  hint?: string;
  team?: string;
}

/** Sample places looked at (a spread-out subset of the navmesh's places), and spots kept of each kind. */
const SAMPLES = 640;
const KEEP = 36;
const SPACING = 14;
const DIRS = 8;
const EYE = 1.5;
const FAR = 90;
/** A sniper spot only parkour reaches: worth this much more (the owner: "where others don't normally go (roofs, etc)"). */
const PARKOUR_SPOT = 0.45;
/** Places only parkour reaches looked at, at most (all of them are, on top of the spread-out samples). */
const PARKOUR_SAMPLES = 160;

export type Raycast = (origin: Vec3, dir: Vec3, maxDist: number) => number | null;

/**
 * Vantage spots for a navmesh: SAMPLES places × DIRS horizontal rays (about
 * 5,000 rays, tens of milliseconds, at match start). Deterministic.
 */
export function computeVantage(places: readonly Vec3[], raycast: Raycast, parkour: readonly Vec3[] = []): VantageSpot[] {
  if (!places.length) return [];
  // Height of the ground round about: the lowest of the average heights of nearby 16 m cells.
  const CELL = 16;
  const cellY = new Map<number, { sum: number; n: number }>();
  const ck = (x: number, z: number) => (Math.floor(x / CELL) + 4096) * 8192 + (Math.floor(z / CELL) + 4096);
  for (const p of places) {
    const k = ck(p.x, p.z);
    const c = cellY.get(k);
    if (c) {
      c.sum += p.y;
      c.n++;
    } else cellY.set(k, { sum: p.y, n: 1 });
  }
  const groundNear = (p: Vec3): number => {
    let low = Infinity;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const c = cellY.get(ck(p.x + dx * CELL, p.z + dz * CELL));
        if (c) low = Math.min(low, c.sum / c.n);
      }
    }
    return Number.isFinite(low) ? low : p.y;
  };
  const stride = Math.max(1, places.length / SAMPLES);
  const sniper: VantageSpot[] = [];
  const camp: VantageSpot[] = [];
  const dist = new Float64Array(DIRS);
  // The spread-out samples, then the places only parkour reaches (each looked at: few, and the spots worth most).
  const samples: { p: Vec3; parkour: boolean }[] = [];
  for (let f = 0; f < places.length; f += stride) samples.push({ p: places[Math.floor(f)]!, parkour: false });
  const pStride = Math.max(1, parkour.length / PARKOUR_SAMPLES);
  for (let f = 0; f < parkour.length; f += pStride) samples.push({ p: parkour[Math.floor(f)]!, parkour: true });
  for (const { p, parkour: only } of samples) {
    const eye = { x: p.x, y: p.y + EYE, z: p.z };
    for (let k = 0; k < DIRS; k++) {
      const a = (k / DIRS) * Math.PI * 2;
      dist[k] = raycast(eye, { x: Math.sin(a), y: 0, z: Math.cos(a) }, FAR) ?? FAR;
    }
    // The most open sector (three neighbouring directions), and walls close by.
    let bestK = 0;
    let bestOpen = -1;
    let walls = 0;
    for (let k = 0; k < DIRS; k++) {
      const open = (dist[(k + DIRS - 1) % DIRS]! + dist[k]! * 2 + dist[(k + 1) % DIRS]!) / 4;
      if (open > bestOpen) {
        bestOpen = open;
        bestK = k;
      }
      if (dist[k]! < 3) walls++;
    }
    const yaw = (bestK / DIRS) * Math.PI * 2;
    const height = p.y - groundNear(p);
    const backed = dist[(bestK + DIRS / 2) % DIRS]! < 4 ? 1 : 0;
    if (bestOpen >= 40 && walls < DIRS - 2) {
      // High, tucked away (walls close on the sides), a wall behind (Phase B item 5: the owner's "tucked away high
      // spots"), and a long view.
      const score = Math.min(bestOpen, FAR) / FAR + Math.max(0, Math.min(height / 8, 1)) * 0.8 + backed * 0.5 + Math.min(walls, 4) * 0.12 + (only ? PARKOUR_SPOT : 0);
      sniper.push({ pos: { ...p }, kind: 'sniper', yaw, reach: bestOpen, height, score, ...(only ? { parkour: true } : {}) });
    }
    if (walls >= 2 && walls <= DIRS - 3 && bestOpen >= 10 && bestOpen <= 55) {
      const score = (walls / DIRS) * 1.2 + (Math.min(bestOpen, 40) / 40) * 0.6 + (height > 1.5 ? 0.2 : 0) + backed * 0.2;
      camp.push({ pos: { ...p }, kind: 'camp', yaw, reach: bestOpen, height, score });
    }
  }
  return [...spread(sniper), ...spread(camp)];
}

/** The best spots, at least SPACING apart, KEEP at most. */
function spread(list: VantageSpot[]): VantageSpot[] {
  list.sort((a, b) => b.score - a.score || a.pos.x - b.pos.x || a.pos.z - b.pos.z);
  const out: VantageSpot[] = [];
  for (const s of list) {
    if (out.length >= KEEP) break;
    if (out.some((o) => horizontalDistance(o.pos, s.pos) < SPACING && Math.abs(o.pos.y - s.pos.y) < 3)) continue;
    out.push(s);
  }
  return out;
}

/** Spots per map, by a fingerprint of its navmesh places (the same map in the next match reuses them). */
const cache = new Map<string, VantageSpot[]>();

function fingerprint(places: readonly Vec3[]): string {
  let h = 2166136261;
  for (let i = 0; i < places.length; i += Math.max(1, places.length >> 6)) {
    const p = places[i]!;
    h = Math.imul(h ^ Math.round(p.x * 10), 16777619);
    h = Math.imul(h ^ Math.round(p.y * 10), 16777619);
    h = Math.imul(h ^ Math.round(p.z * 10), 16777619);
  }
  return `${places.length}:${h >>> 0}`;
}

export function vantageFor(places: readonly Vec3[], raycast: Raycast, parkour: readonly Vec3[] = []): VantageSpot[] {
  const key = `${fingerprint(places)}+${fingerprint(parkour)}`;
  let spots = cache.get(key);
  if (!spots) {
    spots = computeVantage(places, raycast, parkour);
    if (cache.size >= 8) cache.delete(cache.keys().next().value!);
    cache.set(key, spots);
  }
  return spots;
}

/**
 * A match's vantage spots and who holds which (one bot a spot), plus spots
 * a bot found it couldn't reach (left alone for a while).
 */
export class VantageBoard {
  private readonly holder: Int32Array;
  private readonly holdUntil: Float64Array;
  private readonly badUntil: Float64Array;
  /** Each spot's worth for this match on top of its own score (snipers: how well it covers the ways the enemy comes). */
  readonly bonus: Float32Array;

  constructor(readonly spots: readonly VantageSpot[]) {
    this.holder = new Int32Array(spots.length).fill(-1);
    this.holdUntil = new Float64Array(spots.length);
    this.badUntil = new Float64Array(spots.length);
    this.bonus = new Float32Array(spots.length);
  }

  /**
   * The match's lanes (the trips' corridors' routes): each sniper spot's bonus is how well it covers them (sniper.ts
   * laneCover: the share of the lane points in its view it can see), × `weight`. A sight line per point checked, at most
   * 24 a spot, once per match.
   */
  lanes(lines: readonly (readonly Vec3[])[], sees: (a: Vec3, b: Vec3) => boolean, weight = 0.8): void {
    for (let i = 0; i < this.spots.length; i++) {
      const s = this.spots[i]!;
      if (s.kind === 'sniper') this.bonus[i] = laneCover(s, lines, sees) * weight;
    }
  }

  /**
   * The best free spot of a kind for a bot at `from`: by the spot's own score,
   * nearer is better (within `within` m), and `prefer` (0..1 per spot, e.g. the
   * middle of the map in team modes) on top. Returns its index, or -1.
   */
  pick(kind: VantageKind, from: Vec3, tick: number, within: number, rng: () => number, prefer?: (p: Vec3) => number, skip = -1, side?: string): number {
    let best = -1;
    let bestS = -Infinity;
    for (let i = 0; i < this.spots.length; i++) {
      const s = this.spots[i]!;
      if (s.kind !== kind || i === skip || (s.team !== undefined && s.team !== side) || tick < this.badUntil[i]! || (this.holder[i]! >= 0 && tick < this.holdUntil[i]!)) continue;
      const d = horizontalDistance(s.pos, from) + Math.abs(s.pos.y - from.y) * 2;
      if (d > within) continue;
      const score = s.score + this.bonus[i]! - d / within + (prefer ? prefer(s.pos) : 0) + rng() * 0.3;
      if (score > bestS) {
        bestS = score;
        best = i;
      }
    }
    return best;
  }

  claim(i: number, slot: number, until: number): void {
    this.holder[i] = slot;
    this.holdUntil[i] = until;
  }

  release(i: number, slot: number): void {
    if (this.holder[i] === slot) this.holder[i] = -1;
  }

  /** No way there: leave it alone for a while. */
  unreachable(i: number, slot: number, tick: number, ticks: number): void {
    this.release(i, slot);
    this.badUntil[i] = tick + ticks;
  }

  heldBy(i: number): number {
    return this.holder[i]!;
  }
}
