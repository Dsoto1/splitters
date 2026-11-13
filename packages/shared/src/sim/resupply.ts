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

/**
 * Throwables a resupply never tops up: the airstrike flare is a reward (Lunar Roulette), not stock; sandbags and the
 * Ammo Box Kit are deployables, not grenades (a box handing out boxes would never run dry).
 */
const NOT_RESTOCKED: ReadonlySet<ThrowableKind> = new Set(['airstrike', 'sandbag', 'ammo_box']);

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

// ---------------------------------------------------------------- ammo boxes

/**
 * Ammo boxes (owner, 2026-11-12/13: "a deployable ammo box (resupply) or ones that get automatically placed, the way
 * Far Cry 2 had an ammo box, where you could get ammo/grenades but also if it gets shot or enough damage would set off
 * a small round of explosions and pops in that vicinity (damaging slightly)"). Two kinds share this:
 * - placed: every Ammo Box pickup a map places (`core.ammo`, not a random one) is a solid crate (owner, 2026-11-13:
 *   "become resupply crates"): Use beside it resupplies; emptied or destroyed, it is gone until its pickup's respawn
 *   time has passed, then back full;
 * - deployed: the Ammo Box Kit (a throwable, carried like Sandbags) sets one down where it lands; one each, gone when
 *   empty, destroyed, or after DEPLOYED_BOX.lifeSeconds.
 * Shots and blasts damage it; destroyed with stock left it cooks off (cookOff).
 */
export const AMMO_BOX_ITEM = 'core.ammo';
/** The crate drawn and collided (the WWII Ammo Crate prop, props/ww2_ammo_crate.glb: 1.04 × 0.9 × 0.63 m). */
export const AMMO_BOX_MODEL = 'props/ww2_ammo_crate.glb';
export const AMMO_BOX_HALF: [number, number, number] = [0.52, 0.45, 0.31];
/** How near its middle your feet must be to resupply (m, across): beside the crate. */
export const AMMO_BOX_REACH = 1.5;
export const PLACED_BOX = { uses: 10, health: 80 } as const;
export const DEPLOYED_BOX = { uses: 10, health: 60, lifeSeconds: 120 } as const;
/** Seconds a player waits between two resupplies from boxes (as at the Supply Buggy). */
export const AMMO_BOX_WAIT = 4;

/**
 * The cook-off when a box is destroyed: a round of small blasts and pops round it for a few seconds, more of them the
 * more stock it held (a box with none left only bursts once). Each hurts slightly: about a sixth of a player's health
 * at its centre, little at its edge. `weapon` names them in the kill feed.
 */
export const COOK_OFF = { weapon: 'core.ammo_box', seconds: 2.6, radius: 2.4, damage: 16, edge: 3, spread: 1.6 } as const;

/**
 * The blasts of one cook-off: when (ticks from now, rising) and where (offset from the box, m), for `share` of its
 * stock left (0..1). Deterministic: `seed` (the box's) picks the places and the rhythm.
 */
export function cookOff(share: number, seed: number, tickRate: number): { tick: number; dx: number; dy: number; dz: number }[] {
  const count = 1 + Math.round(Math.max(0, Math.min(1, share)) * 7);
  let s = (seed >>> 0) || 1;
  const rnd = () => ((s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0) / 0x100000000);
  const out: { tick: number; dx: number; dy: number; dz: number }[] = [];
  const span = COOK_OFF.seconds * tickRate;
  for (let i = 0; i < count; i++) {
    // The first at once (where it was hit), the rest scattered through the span, bunching early like popping rounds.
    const t = i === 0 ? 0 : Math.round(span * Math.pow((i + rnd() * 0.8) / count, 1.4));
    const a = rnd() * Math.PI * 2;
    const r = i === 0 ? 0 : COOK_OFF.spread * Math.sqrt(rnd());
    out.push({ tick: t, dx: Math.sin(a) * r, dy: 0.2 + rnd() * 0.6, dz: Math.cos(a) * r });
  }
  return out.sort((a, b) => a.tick - b.tick);
}

/** A map pickup that plays as an ammo box crate (a placed Ammo Box, not a random one). */
export const isAmmoBoxPickup = (e: { item: string; random?: unknown }): boolean => e.item === AMMO_BOX_ITEM && !e.random;

/** How much smaller than its model the Ammo Box Kit is drawn as a pickup and in the hand (the crate model is 1 m long). */
export const AMMO_BOX_KIT_SCALE = 0.42;

/** Where a source's reach point is in the world (its `at`, the mount standing at `pos` turned `yaw`). */
export function resupplyPoint(spec: Pick<ResupplySpec, 'at'>, pos: { x: number; y: number; z: number }, yaw: number): { x: number; y: number; z: number } {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  const [ax, ay, az] = spec.at;
  return { x: pos.x + ax * c + az * s, y: pos.y + Math.max(0, ay - 1), z: pos.z - ax * s + az * c };
}
/** How far a bot goes out of its way to a Supply Buggy's tailgate (m). */
export const BOT_RESUPPLY_REACH = 60;
