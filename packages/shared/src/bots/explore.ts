import { horizontalDistance, type Vec3, hypot } from '../math.ts';
import { TICK_RATE } from '../sim/constants.ts';

/**
 * What a bot remembers of the map in this life: where it has been (coarse
 * cells), so it advances into places it hasn't checked instead of circling,
 * and skips re-clearing rooms it just cleared.
 */
const CELL = 7;
const FLOOR = 2.5;
const MAX_CELLS = 256;

export class MapMemory {
  private readonly visited = new Map<number, number>();

  private key(p: Vec3): number {
    // Packed cell key (maps are well within ±2000 m and ±60 floors).
    return (Math.floor(p.x / CELL) + 512) * 1_000_000 + (Math.floor(p.z / CELL) + 512) * 1000 + (Math.floor(p.y / FLOOR) + 100);
  }

  clear(): void {
    this.visited.clear();
  }

  mark(p: Vec3, tick: number): void {
    const k = this.key(p);
    this.visited.delete(k);
    this.visited.set(k, tick);
    // Oldest entries go first (Map keeps insertion order).
    if (this.visited.size > MAX_CELLS) this.visited.delete(this.visited.keys().next().value!);
  }

  /** Seconds since the bot was last around `p` (Infinity if never). */
  ageSeconds(p: Vec3, tick: number): number {
    const t = this.visited.get(this.key(p));
    return t === undefined ? Infinity : (tick - t) / TICK_RATE;
  }
}

/**
 * Pick somewhere to advance to: places not visited for a while, at a
 * distance that suits the bot (explorers range further), with a little
 * randomness. `extra` are points of interest (spawns, pickups) always in the draw.
 */
export function pickExploreGoal(places: readonly Vec3[], extra: readonly Vec3[], from: Vec3, memory: MapMemory, tick: number, rng: () => number, exploration: number): Vec3 | null {
  const ideal = 14 + (exploration / 100) * 40;
  let best: { p: Vec3; s: number } | null = null;
  const consider = (p: Vec3) => {
    const d = horizontalDistance(p, from) + Math.abs(p.y - from.y) * 2;
    if (d < 6) return;
    const age = Math.min(90, memory.ageSeconds(p, tick)) / 90;
    const s = age * 2 - Math.abs(d - ideal) / 40 + rng() * 0.6;
    if (!best || s > best.s) best = { p, s };
  };
  for (const p of extra) consider(p);
  const n = Math.min(places.length, 14);
  for (let i = 0; i < n; i++) consider(places[Math.floor(rng() * places.length)]!);
  return best ? { ...(best as { p: Vec3 }).p } : null;
}

/**
 * A waypoint off to one side of the straight line from `from` to `to`
 * (lane -1 left, 0 middle, 1 right), so teammates heading the same way
 * spread over the map's routes instead of filing down one.
 */
export function laneWaypoint(places: readonly Vec3[], from: Vec3, to: Vec3, lane: number): Vec3 | null {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const D = hypot(dx, dz);
  if (D < 30) return null;
  const ux = dx / D;
  const uz = dz / D;
  const want = lane * Math.min(D * 0.3, 28);
  let best: Vec3 | null = null;
  let bestS = Infinity;
  for (const p of places) {
    const rx = p.x - from.x;
    const rz = p.z - from.z;
    const along = (rx * ux + rz * uz) / D;
    if (along < 0.3 || along > 0.65) continue;
    const side = rx * uz - rz * ux;
    const s = Math.abs(side - want) + Math.abs(along - 0.45) * 20 + Math.abs(p.y - from.y) * 2;
    if (s < bestS) {
      bestS = s;
      best = p;
    }
  }
  return best ? { ...best } : null;
}
