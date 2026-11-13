/**
 * Resupply: one mechanic for everything players restock from (owner, 2026-11-12): the Supply Buggy's back (MountDef
 * `resupply`) now, the ammo box later. A resupply fills what you carry: every gun's reserve to its most, underbarrel
 * rounds to their most, and your grenades up to their kind's most (none carried: the weapon set's first kind, as at
 * a spawn). Each source holds a few uses; each player waits a moment between two.
 *
 * Scarcity is the balance (docs/GUNPLAY_DIRECTION.md, "Arena philosophy": ammo availability): a source runs dry
 * after its uses and comes back full only when it does (a vehicle's respawn).
 */
import type { ThrowableKind } from './weapons.ts';
import { THROWABLE_DEFS } from './weapons.ts';

/** A source's stock (MountDef.resupply): where in the mount's frame you stand, how near, how many uses, the wait per player (s). */
export interface ResupplySpec {
  /** The point you resupply at, in the mount's frame (x right, y up, z forward; m): the Supply Buggy's tailgate. */
  at: [number, number, number];
  /** How near that point your feet must be (m, across; height within RESUPPLY_HEIGHT). */
  reach: number;
  /** Resupplies it holds when it (re)spawns. */
  uses: number;
  /** Seconds one player waits before resupplying again (from any source). */
  wait: number;
}

/** How far above or below the reach point your feet may be (m): standing on the ground beside a vehicle's tailgate. */
export const RESUPPLY_HEIGHT = 1.6;

/** Throwables a resupply never tops up: the airstrike flare is a reward (Lunar Roulette), not stock. */
const NOT_RESTOCKED: ReadonlySet<ThrowableKind> = new Set(['airstrike']);

/**
 * Whether feet at `feet` are in reach of a source's point, the source standing at `pos` turned `yaw` (the mount
 * frame of sim/mounts.ts enterReach: right is (cos yaw, -sin yaw), forward (sin yaw, cos yaw)). The distance across,
 * or null when out of reach.
 */
export function resupplyReach(spec: Pick<ResupplySpec, 'at' | 'reach'>, pos: { x: number; y: number; z: number }, yaw: number, feet: { x: number; y: number; z: number }): number | null {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  const [ax, ay, az] = spec.at;
  const px = pos.x + ax * c + az * s;
  const pz = pos.z - ax * s + az * c;
  if (Math.abs(feet.y - (pos.y + ay)) > RESUPPLY_HEIGHT) return null;
  const d = Math.hypot(feet.x - px, feet.z - pz);
  return d <= spec.reach ? d : null;
}

/** What a resupply works on: a carried gun's stock. */
export interface ResupplyGun {
  def: { reserveMax: number; alt?: { ammo?: string; reload?: unknown; max?: number } };
  reserve: number;
  alt: number;
}

/**
 * Fill a loadout: every gun's reserve and underbarrel rounds to their most, the grenades up to their kind's most
 * (`spawnThrowable`: the kind given when none is carried; null: none). Returns the throwable to carry after it and
 * whether anything was given (false: nothing needed, so no use is spent).
 */
export function resupplyLoadout(guns: Iterable<ResupplyGun>, throwable: { kind: ThrowableKind; count: number } | null, spawnThrowable: ThrowableKind | null): { given: boolean; throwable: { kind: ThrowableKind; count: number } | null } {
  let given = false;
  for (const w of guns) {
    if (w.def.reserveMax > 0 && w.reserve < w.def.reserveMax) {
      w.reserve = w.def.reserveMax;
      given = true;
    }
    const alt = w.def.alt;
    if (alt?.ammo === 'own' && !alt.reload && w.alt < (alt.max ?? 0)) {
      w.alt = alt.max ?? 0;
      given = true;
    }
  }
  let next = throwable;
  const kind = throwable ? throwable.kind : spawnThrowable;
  if (kind && !NOT_RESTOCKED.has(kind)) {
    const max = THROWABLE_DEFS[kind].max;
    const have = throwable?.count ?? 0;
    if (have < max) {
      next = { kind, count: max };
      given = true;
    }
  }
  return { given, throwable: next };
}
