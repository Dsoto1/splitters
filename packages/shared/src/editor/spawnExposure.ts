import type { ValidationIssue } from '../map/validate.ts';
import type { Vec3 } from '../math.ts';

/**
 * Sightlines and spawn exposure (MapMaker overhaul Phase 4, item 2): for each spawn point, how much of the map can
 * see it and from how far, and the map's long sightlines. The places looked from are the bots' own sample places on
 * the navmesh (NavWorld.mainPlaces: where anyone can walk to), and a place sees a spawn when the bots' line-of-sight
 * test (PhysicsWorld.lineOfSight, the ray bots aim and spot along) runs clear from a standing eye to the spawned
 * player's chest. The maths is here, pure; the run (navmesh, physics) is editor/mapTest.ts `mapExposure`, in
 * MapMaker's test worker. Nothing is stored in the map.
 */

/** Eye of someone standing at a place, and the chest of a player just spawned (m above the ground). */
export const EXPOSURE_EYE = 1.5;
export const EXPOSURE_CHEST = 1.2;
/** Places further than this don't count: past the bots' spotting range nobody picks a spawn off (m). */
export const EXPOSURE_RANGE = 120;
/** Places nearer than this are the spawn's own spot (m). */
export const EXPOSURE_NEAR = 4;
/** Places looked from, at most (a spread-out subset of the navmesh's places). */
export const EXPOSURE_SAMPLES = 400;
/** A spawn seen from this share of the map's places or more is warned about (the owner's call: see HANDOFF). */
export const EXPOSED_SHARE = 0.5;
/** A sightline this long or longer is drawn (m). */
export const LONG_SIGHTLINE = 50;

export type Sees = (from: Vec3, to: Vec3) => boolean;

export interface SpawnPoint {
  id: string;
  pos: Vec3;
  team?: string | null;
}

export interface SpawnExposure {
  id: string;
  pos: Vec3;
  team: string | null;
  /** Places that see it, of the places looked from (in range or not). */
  seenFrom: number;
  of: number;
  /** seenFrom / of: how much of the map can see it (0..1). */
  share: number;
  /** Distances (m, flat) of the places that see it: nearest, median and furthest (0 when none). */
  nearest: number;
  median: number;
  farthest: number;
  /** The longest lines it is seen along (from a place's eye to the spawn's chest), longest first. */
  lines: [Vec3, Vec3][];
}

export interface Sightline {
  a: Vec3;
  b: Vec3;
  length: number;
}

const flat = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);

/** At most `max` places, spread evenly through the list (deterministic: the same list gives the same subset). */
export function samplePlaces(places: readonly Vec3[], max = EXPOSURE_SAMPLES): Vec3[] {
  if (places.length <= max) return [...places];
  const out: Vec3[] = [];
  const stride = places.length / max;
  for (let i = 0; i < max; i++) out.push(places[Math.floor(i * stride)]!);
  return out;
}

/** The median of a sorted list (0 for none). */
function median(sorted: readonly number[]): number {
  if (!sorted.length) return 0;
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m]! : (sorted[m - 1]! + sorted[m]!) / 2;
}

/**
 * Each spawn's exposure: the places (already sampled) within `range` that see its chest from a standing eye.
 * `share` counts against every place looked from, so a spawn in the open on a big map scores lower than in a small
 * arena's bowl only if less of the map really is in sight of it.
 */
export function spawnExposure(spawns: readonly SpawnPoint[], places: readonly Vec3[], sees: Sees, o: { range?: number; near?: number; lines?: number } = {}): SpawnExposure[] {
  const range = o.range ?? EXPOSURE_RANGE;
  const near = o.near ?? EXPOSURE_NEAR;
  const keepLines = o.lines ?? 3;
  return spawns.map((s) => {
    const chest = { x: s.pos.x, y: s.pos.y + EXPOSURE_CHEST, z: s.pos.z };
    const dists: number[] = [];
    const seenAt: { eye: Vec3; d: number }[] = [];
    for (const p of places) {
      const d = flat(p, s.pos);
      if (d < near || d > range) continue;
      const eye = { x: p.x, y: p.y + EXPOSURE_EYE, z: p.z };
      if (!sees(eye, chest)) continue;
      dists.push(d);
      seenAt.push({ eye, d });
    }
    dists.sort((a, b) => a - b);
    seenAt.sort((a, b) => b.d - a.d);
    const share = places.length ? dists.length / places.length : 0;
    return {
      id: s.id,
      pos: s.pos,
      team: s.team ?? null,
      seenFrom: dists.length,
      of: places.length,
      share,
      nearest: dists[0] ?? 0,
      median: median(dists),
      farthest: dists[dists.length - 1] ?? 0,
      lines: seenAt.slice(0, keepLines).map((x) => [x.eye, chest] as [Vec3, Vec3]),
    };
  });
}

/**
 * The map's long sightlines: pairs of places (eye to eye) at least `min` apart that see each other, longest first,
 * at most `keep`, leaving out a line whose two ends are both within `apart` of a longer kept line's ends (the same
 * view). Pairs further than `max` aren't looked at.
 */
export function longSightlines(places: readonly Vec3[], sees: Sees, o: { min?: number; max?: number; keep?: number; apart?: number } = {}): Sightline[] {
  const min = o.min ?? LONG_SIGHTLINE;
  const max = o.max ?? EXPOSURE_RANGE * 2;
  const keep = o.keep ?? 24;
  const apart = o.apart ?? 12;
  const pairs: { i: number; j: number; d: number }[] = [];
  for (let i = 0; i < places.length; i++) {
    for (let j = i + 1; j < places.length; j++) {
      const d = flat(places[i]!, places[j]!);
      if (d >= min && d <= max) pairs.push({ i, j, d });
    }
  }
  pairs.sort((a, b) => b.d - a.d || a.i - b.i || a.j - b.j);
  const out: Sightline[] = [];
  const eye = (p: Vec3) => ({ x: p.x, y: p.y + EXPOSURE_EYE, z: p.z });
  for (const { i, j, d } of pairs) {
    if (out.length >= keep) break;
    const a = eye(places[i]!);
    const b = eye(places[j]!);
    const same = out.some((l) => (flat(l.a, a) < apart && flat(l.b, b) < apart) || (flat(l.a, b) < apart && flat(l.b, a) < apart));
    if (same || !sees(a, b)) continue;
    out.push({ a, b, length: d });
  }
  return out;
}

/** Warnings for spawns seen from `share` of the map's places or more (MapMaker's validator list). */
export function exposureIssues(results: readonly SpawnExposure[], share = EXPOSED_SHARE): ValidationIssue[] {
  return results
    .filter((r) => r.of > 0 && r.share >= share)
    .map((r) => ({
      severity: 'warning' as const,
      code: 'spawn.exposed',
      message: `Exposed spawn: ${Math.round(r.share * 100)}% of the map can see it (from up to ${Math.round(r.farthest)} m away): give it cover`,
      targetId: r.id,
    }));
}
