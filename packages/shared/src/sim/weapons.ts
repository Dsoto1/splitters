import { add, dot, scale, type Vec3 } from '../math.ts';
import { PLAYER } from './constants.ts';

/** Data-driven weapon definition (subset of the v1 spec §5.2 fields needed for Phase 0). */
export interface WeaponDefinition {
  id: string;
  displayName: string;
  kind: 'hitscan';
  damage: number;
  /** Minimum ticks between shots. */
  fireIntervalTicks: number;
  range: number;
  /** AI desirability, 0..1. */
  botDesirability: number;
}

export const CORE_WEAPONS: Readonly<Record<string, WeaponDefinition>> = {
  'core.rifle': {
    id: 'core.rifle',
    displayName: 'Rifle',
    kind: 'hitscan',
    damage: 20,
    fireIntervalTicks: 8,
    range: 150,
    botDesirability: 0.6,
  },
};

export function getWeapon(id: string): WeaponDefinition {
  const w = CORE_WEAPONS[id];
  if (!w) throw new Error(`unknown weapon ${id}`);
  return w;
}

/**
 * Ray vs upright player capsule standing with its feet at `feet`.
 * Returns the distance along the (normalised) ray, or null on miss.
 */
export function rayCapsule(origin: Vec3, dir: Vec3, feet: Vec3, radius: number = PLAYER.radius, height: number = PLAYER.height): number | null {
  const y0 = feet.y + radius;
  const y1 = feet.y + height - radius;
  let best: number | null = null;
  const consider = (t: number) => {
    if (t >= 0 && (best === null || t < best)) best = t;
  };

  // Infinite vertical cylinder, clipped to the segment's height range.
  const ox = origin.x - feet.x;
  const oz = origin.z - feet.z;
  const a = dir.x * dir.x + dir.z * dir.z;
  if (a > 1e-12) {
    const b = 2 * (ox * dir.x + oz * dir.z);
    const c = ox * ox + oz * oz - radius * radius;
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
        const y = origin.y + dir.y * t;
        if (y >= y0 && y <= y1) consider(t);
      }
    }
  }

  // End-cap spheres.
  for (const cy of [y0, y1]) {
    const oc = { x: origin.x - feet.x, y: origin.y - cy, z: origin.z - feet.z };
    const b = dot(oc, dir);
    const c = dot(oc, oc) - radius * radius;
    const disc = b * b - c;
    if (disc >= 0) consider(-b - Math.sqrt(disc));
  }
  return best;
}

export interface ShotTarget {
  slot: number;
  feet: Vec3;
}

export interface ShotResult {
  hitSlot: number | null;
  distance: number;
  end: Vec3;
}

/**
 * Resolve a hitscan shot: the nearest of the first static surface and any
 * target capsule wins. `worldDistance` is the result of a static raycast (null = nothing within range).
 */
export function resolveHitscan(origin: Vec3, dir: Vec3, range: number, worldDistance: number | null, targets: readonly ShotTarget[]): ShotResult {
  let distance = worldDistance ?? range;
  let hitSlot: number | null = null;
  for (const t of targets) {
    const d = rayCapsule(origin, dir, t.feet);
    if (d !== null && d < distance) {
      distance = d;
      hitSlot = t.slot;
    }
  }
  return { hitSlot, distance, end: add(origin, scale(dir, distance)) };
}
