import { horizontalDistance, type Vec3 } from '../math.ts';
import { TICK_RATE } from '../sim/constants.ts';
import type { MapMemory } from './explore.ts';

/** Region size (m): a few rooms, a street, a stretch of field. */
export const REGION = 24;
const FLOOR = 4;

/** The regions of a navmesh (shared by every side's RegionMap of a match). */
export interface RegionLayout {
  /** A walkable spot per region (the sample place nearest its centre). */
  readonly spots: readonly Vec3[];
  readonly index: ReadonlyMap<number, number>;
}

const layouts = new WeakMap<readonly Vec3[], RegionLayout>();

const regionKey = (p: Vec3): number => ((Math.floor(p.x / REGION) + 1024) * 2048 + (Math.floor(p.z / REGION) + 1024)) * 128 + (Math.floor(p.y / FLOOR) + 64);

/** The regions over a navmesh's sample places (NavWorld.places()), built once per places list. */
export function regionLayout(places: readonly Vec3[]): RegionLayout {
  let l = layouts.get(places);
  if (l) return l;
  const best = new Map<number, { p: Vec3; d: number }>();
  for (const p of places) {
    const k = regionKey(p);
    const cx = (Math.floor(p.x / REGION) + 0.5) * REGION;
    const cz = (Math.floor(p.z / REGION) + 0.5) * REGION;
    const d = Math.hypot(p.x - cx, p.z - cz);
    const prev = best.get(k);
    if (!prev || d < prev.d) best.set(k, { p, d });
  }
  const keys = [...best.keys()].sort((a, b) => a - b);
  const index = new Map<number, number>();
  keys.forEach((k, i) => index.set(k, i));
  l = { spots: keys.map((k) => best.get(k)!.p), index };
  layouts.set(places, l);
  return l;
}

export interface RegionPick {
  from: Vec3;
  tick: number;
  rng: () => number;
  /** Distance the bot likes to go (m). */
  ideal: number;
  /** How much a region nobody on the side has been to lately counts (explorers more). */
  novelty: number;
  /** How much regions with teammates in them put the bot off (lone wolves more; squads less). */
  crowd: number;
  /** Team modes: the enemy's side of the map (regions toward it score higher, by `push`). */
  towards?: readonly Vec3[] | null;
  push?: number;
  /** The bot's own memory of where it has been this life. */
  memory?: MapMemory | null;
  /** Leave out regions another squad of the side is heading for. */
  avoidClaimed?: boolean;
  /** Regions sampled (bounded work). */
  samples?: number;
}

/**
 * One side's knowledge of the map at region level: when someone on the side
 * last stood in each region, how many are in it now, and which regions a
 * squad is heading for. Bots pick where to go next from it, so the side
 * spreads over the map instead of everyone heading down the same street.
 * Updated at low rate (Match: once a second); reading it is a few dozen
 * samples per pick.
 */
export class RegionMap {
  readonly lastVisit: Float64Array;
  readonly count: Uint16Array;
  readonly claimedUntil: Float64Array;

  constructor(readonly layout: RegionLayout) {
    const n = layout.spots.length;
    this.lastVisit = new Float64Array(n).fill(-Infinity);
    this.count = new Uint16Array(n);
    this.claimedUntil = new Float64Array(n);
  }

  get size(): number {
    return this.layout.spots.length;
  }

  regionOf(p: Vec3): number {
    return this.layout.index.get(regionKey(p)) ?? -1;
  }

  /** Where the side's living members are now. */
  update(members: readonly Vec3[], tick: number): void {
    this.count.fill(0);
    for (const p of members) {
      const i = this.regionOf(p);
      if (i < 0) continue;
      this.lastVisit[i] = tick;
      if (this.count[i]! < 65535) this.count[i]!++;
    }
  }

  claim(i: number, until: number): void {
    if (i >= 0) this.claimedUntil[i] = until;
  }

  /**
   * Somewhere worth going: regions nobody on the side has seen for a while
   * (and the bot hasn't either), at about the distance it likes, toward the
   * enemy in team modes, not crowded with teammates, not another squad's
   * goal. A walkable spot, or null.
   */
  pick(o: RegionPick): { pos: Vec3; region: number } | null {
    const n = this.size;
    if (!n) return null;
    const samples = Math.min(n, o.samples ?? 24);
    let best = -1;
    let bestS = -Infinity;
    let fromTowards = Infinity;
    if (o.towards?.length && o.push) for (const t of o.towards) fromTowards = Math.min(fromTowards, horizontalDistance(t, o.from));
    for (let s = 0; s < samples; s++) {
      const i = Math.floor(o.rng() * n);
      const p = this.layout.spots[i]!;
      const d = horizontalDistance(p, o.from) + Math.abs(p.y - o.from.y) * 2;
      if (d < 12) continue;
      const sideAge = Math.min(90, (o.tick - this.lastVisit[i]!) / TICK_RATE) / 90;
      const ownAge = o.memory ? Math.min(90, o.memory.ageSeconds(p, o.tick)) / 90 : 1;
      let score = (sideAge * 0.6 + ownAge * 0.4) * 2 * o.novelty - Math.abs(d - o.ideal) / 40 - Math.min(this.count[i]!, 6) * 0.25 * o.crowd + o.rng() * 0.6;
      if (o.avoidClaimed && o.tick < this.claimedUntil[i]!) score -= 1.5;
      if (o.towards?.length && o.push) {
        let near = Infinity;
        for (const t of o.towards) near = Math.min(near, horizontalDistance(t, p));
        // Closer to the enemy's side than the bot is now.
        score += Math.max(-1, Math.min(1, (fromTowards - near) / 60)) * o.push;
      }
      if (score > bestS) {
        bestS = score;
        best = i;
      }
    }
    return best < 0 ? null : { pos: { ...this.layout.spots[best]! }, region: best };
  }
}
