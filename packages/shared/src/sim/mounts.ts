/**
 * Mounts: things you get into. Turrets (one gunner, stationary), sentries
 * (no seats: they aim and fire on their own) and vehicles (a driver, maybe a
 * gunner on a mounted gun, and passengers who shoot their own weapons).
 * Data only; the match runs them.
 *
 * Local frames: +Z is the mount's forward, +X its right, +Y up; positions are
 * metres from the mount's origin (its footprint centre on the ground).
 */

import { MOUNT_DEFS, MOUNT_MODELS, ROUTE_CRAFT_DEFS } from '../content/mounts.generated.ts';
import type { SuspensionTuning } from './suspension.ts';

/**
 * The mounts' tuning (speed, health, seats, mounted weapons, drawing numbers) is data: content/vehicles/<id>.json,
 * built by tools/content/vehicles.mjs into content/mounts.generated.ts (how to add one: docs/CONTENT_PIPELINE.md).
 * This file keeps the types and the behaviour helpers. MOUNT_MODELS is in MapMaker palette order (each file's `order`).
 */
export { MOUNT_DEFS, MOUNT_MODELS };
export type MountModel = (typeof MOUNT_MODELS)[number];

/** Snapshot index of a sentry a player built (Classes): this plus the builder's slot. */
export const BUILT_MOUNT_BASE = 10_000;
/** The transport plane of an `airplane` map entity: not placeable as a mount, it flies the entity's route. */
export const AIRPLANE_MODEL = 'airplane';

/**
 * Paint skins for vehicles (MapMaker inspector, per placed mount). `auto`
 * paints a team-owned vehicle (one given a team) in its team's colour and
 * leaves the rest in their factory paint; `team` always uses the team colour.
 */
export const MOUNT_SKINS = ['auto', 'factory', 'desert', 'forest', 'snow', 'urban', 'team'] as const;
export type MountSkin = (typeof MOUNT_SKINS)[number];
/** Tint per skin (multiplied over the model's own colours); null = unchanged. */
export const MOUNT_SKIN_TINTS: Readonly<Record<Exclude<MountSkin, 'auto' | 'team'>, string | null>> = {
  factory: null,
  desert: '#d9b77e',
  forest: '#7d9461',
  snow: '#eef2f6',
  urban: '#9097a0',
};
export const MOUNT_SKIN_LABELS: Readonly<Record<MountSkin, string>> = {
  auto: 'Automatic (team colour when it has a team)',
  factory: 'Factory paint',
  desert: 'Desert',
  forest: 'Forest',
  snow: 'Snow',
  urban: 'Urban grey',
  team: 'Team colour',
};
/** The tint a placed mount is drawn with: a skin colour, its team's colour, or null (factory paint). */
export function mountTint(skin: MountSkin | undefined, teamColor: string | null): string | null {
  const s = skin ?? 'auto';
  if (s === 'team' || s === 'auto') return teamColor;
  return MOUNT_SKIN_TINTS[s];
}

export type SeatRole = 'driver' | 'gunner' | 'passenger';

export interface SeatDef {
  role: SeatRole;
  label: string;
  /** Where the occupant's feet are, in the mount's frame. */
  offset: [number, number, number];
  /** Mounted weapon this seat fires instead of the occupant's own (absent: passengers use their own weapons, drivers can't shoot). */
  weapon?: string;
  /** How far the seat can aim either side of its facing (radians; absent = all round). */
  arc?: number;
  /**
   * Which way the seat's arc is centred, from the mount's forward (radians, + to the right): side door guns. Default 0.
   * A seated rider's hips and legs face this way too (drawing), whichever way they look.
   */
  facing?: number;
  /**
   * A real seat the rider sits in: `offset` is then the cushion (where the hips rest), not the feet. The rider is
   * drawn seated, their eye is a seated head height above the cushion (SEATED_EYE_HEIGHT; the sim gives them the
   * crouching eye and body height) and their rounds pass through the vehicle they ride in. Absent: standing.
   */
  seated?: boolean;
  /** Seated (drawing only): how far below the cushion the floor under the rider's feet is (m). Default 0.45: the shins hang straight down. */
  legDrop?: number;
  /**
   * Seated astride a saddle (drawing only: a snowmobile, a bike): how far each thigh turns out from straight ahead
   * (radians), so the knees pass either side of the saddle and the feet reach footrests at its sides. Default 0.
   */
  straddle?: number;
  /**
   * Limited ammunition for this seat's mounted gun (the Tank's cannon): `max` rounds aboard (and at a respawn, `start`
   * if given), one more back every `refillSeconds` (0: none back over time), and all of them back when the vehicle,
   * crewed, drives over one of the ammo pickups `pickups` names (the Tank's: the Ammo Box only). Absent: it never runs
   * dry (heat paces it, if anything).
   */
  ammo?: SeatAmmo;
  /**
   * While nobody sits in this gunner seat, the driver fires its gun (aimed where they look, the shot kept within the
   * seat's arc): a tank with a crew of one can still fight. The seat's gunner takes it back on getting in.
   */
  driverFires?: boolean;
  /**
   * With `driverFires`: how far either side of the seat's facing the DRIVER may aim its gun (radians), while the
   * seat's own gunner has `arc` (or all round). The Tank: a gunner turns the turret the full circle, a driver
   * alone only 0.6 rad either side of the hull (they steer by where they look). Absent: the seat's `arc`.
   */
  driverArc?: number;
}

/** A mounted gun's limited ammunition (SeatDef.ammo). */
export interface SeatAmmo {
  max: number;
  start?: number;
  refillSeconds: number;
  /** The pickup ids (ammo pickups, content/pickups.json) that refill it all when the crewed vehicle drives over one; absent: none does. */
  pickups?: readonly string[];
}

/** Pickup `item` refills this limited mounted ammunition (SeatAmmo.pickups). */
export const ammoRefilledBy = (a: SeatAmmo, item: string): boolean => !!a.pickups?.includes(item);

/**
 * Armour (MountDef.armour): what the hull is made of for bullets (a surface type: its ballistic class decides
 * penetration and ricochet, its impact the sparks and sound), the share of each kind of damage it takes, and whether
 * it shuts its crew in (`sealed`: nobody aboard can be hurt from outside; they die with it when it is destroyed).
 */
export interface MountArmour {
  surface?: string;
  sealed?: boolean;
  /** Damage taken from bullets and other hitscan rounds, from blasts (splash and a projectile's direct hit) and from melee. Default 1 each. */
  bullets?: number;
  blasts?: number;
  melee?: number;
}

/** What hurt a mount (damage shares: MountArmour). Crashes, falls and hazards always take full damage. */
export type MountHit = 'bullet' | 'blast' | 'melee' | 'other';

export interface MountDef {
  id: MountModel | typeof AIRPLANE_MODEL | typeof DROPSHIP_DROP_MODEL;
  displayName: string;
  kind: 'turret' | 'sentry' | 'vehicle';
  /** Built model (content/models.json). */
  model: string;
  health: number;
  /** Collision box half extents (blocks players, shots and sight); its base sits on the ground. */
  half: [number, number, number];
  seats: SeatDef[];
  /** How close (m, from the mount's centre) you must be to get in. */
  enterRadius: number;
  respawnSeconds: number;
  /** Explosion when destroyed: radius and centre damage. */
  blast: { radius: number; damage: number };
  vehicle?: {
    /** Top speed forward and in reverse (m/s), acceleration (m/s²), turn rate at speed (rad/s). */
    maxSpeed: number;
    reverseSpeed: number;
    accel: number;
    turnRate: number;
    /** Hovercraft drift more and ride a little higher. */
    hover?: boolean;
    /** Share of sideways slide killed per tick (tyre grip; hovercraft low, so they drift). Default 0.25, hover 0.06. */
    grip?: number;
    /** Weight in tonnes: heavier ones shrug off pushes, lose less speed in crashes and land harder. Default 1. */
    mass?: number;
    /** Flyers: no gravity; the pilot climbs (jump) and dives (crouch) at `climb` m/s, up to `ceiling` m above where it is parked. */
    fly?: { climb: number; ceiling: number };
    /** Placed to ride on water (the mount entity's `onWater`): how deep its feet sit under the surface (m). Default FLOAT.draft. */
    draft?: number;
    /**
     * Raycast suspension (sim/suspension.ts): a sprung body on a ray per wheel, so it bounces, leans out of turns,
     * dives under braking and lands bouncing. Absent: the body is drawn settling to the ground (View.suspend).
     */
    suspension?: SuspensionTuning;
    /** Share of tyre grip lost at top speed (rising with the square of speed): loose at speed, so it powerslides. Default 0. */
    drift?: number;
    /** Tracks: turns on the spot at this rate (rad/s) standing still, fading out by 5 m/s (where steering takes over). Default none. */
    pivot?: number;
    /**
     * With nobody at the wheel it brakes to a stop at this rate (m/s², the slide too), so a vehicle got out of at speed
     * stops within a few metres instead of coasting on (into a doorway it then blocks). Default 10.
     */
    idleBrake?: number;
    /**
     * Bots drive only routes clear this share of its half width either side (bots/vehicles.ts routeFits), so they keep
     * out of doors and passages a person fits and it doesn't. Default 0.95 (the probe's width); the Tank 0.8 (it
     * pushes past a little scraping).
     */
    routeFit?: number;
  };
  sentry?: { weapon: string; range: number; turnRate: number; arc?: ArcSentrySpec };
  /**
   * Drawing: the model's energy colour (the Arc Turret's): its body is tinted toward it and glows in it, brighter
   * while it winds up (MOUNT_FLAG_CHARGING) and while its arc is locked on (MOUNT_FLAG_ARC); its arcs are this colour.
   */
  glow?: string;
  /** The transport plane: flies its map entity's route on its own, can't be hurt, and riders jump out (E or jump) to parachute down. */
  airplane?: boolean;
  /** Drawn this far above the ground (m) instead of the class default (hovercraft float 0.35 m; sleds sit on the snow). */
  rideHeight?: number;
  /**
   * Wheels drawn on a body that has none of its own (drawing only): one model, its axle along its own X once placed,
   * at each `at` (the wheel's centre in the mount's frame; a wheel with x < 0 is turned to face outwards on the left).
   * `radius` and `width` (m): the size the tire is drawn at, its model scaled to them (left out: the model's own
   * size; `width` alone left out: as much wider as it is bigger). With a `radius` the wheels roll by it.
   */
  wheels?: { model: string; at: [number, number, number][]; radius?: number; width?: number };
  /**
   * The driver's eye in the cockpit view, in the mount's frame (drawing only).
   * Absent: a seated head height above the driver's seat, a little forward (see cockpitEye).
   */
  cockpitEye?: [number, number, number];
  /**
   * A vehicle whose model turns its own gun (the Tank): the model's `turret` part turns with seat `seat`'s aim (yaw,
   * within the seat's arc) and its `barrel` part pitches with it, drawn within `pitch` ([lowest, highest] rad; default
   * the aim's own range). The vehicle's `aimYaw` / `aimPitch` are that seat's alone (other gunners don't turn it).
   * Built by content/guns.json `parts`.
   */
  /**
   * `traverse` (rad/s): the turret is a real one in the match, turning toward its gunner's aim at this rate (the
   * vehicle's `aimYaw` follows it, so every screen draws the same turret), and its gun holds its shot until the
   * barrel is on the aim (TURRET_ON_AIM). Absent: the aim is the gunner's look at once, as before.
   */
  turret?: { seat: number; pitch?: [number, number]; traverse?: number };
  /** A model drawn instead when `model` fails to load (the one it replaced: the Tank's Quaternius model). */
  fallback?: string;
  /** Armour: its surface, damage shares by kind and a sealed crew (MountArmour). Absent: metal, full damage, riders exposed. */
  armour?: MountArmour;
  /** Bots aboard get out below this share of health (default BAIL_HEALTH, bots/vehicles.ts), or once it is on fire. */
  bailHealth?: number;
  /** One line for MapMaker. */
  blurb: string;
}

/**
 * An arc sentry (the Arc Turret): instead of firing on sight it winds up on a target it can see (a visible,
 * audible charge), then locks an energy arc onto it that hits every `fireIntervalTicks` of its weapon without
 * missing and jumps to one enemy beside it (the weapon's `chain`). Breaking the line of sight, or leaving its
 * range, drops the lock: the next target needs the whole wind-up again. A lock lasts at most `lockSeconds`, then
 * it vents for `ventSeconds` and can't fire. Tuned in docs/ARSENAL.md (Arc Turret).
 */
export interface ArcSentrySpec {
  windUpSeconds: number;
  lockSeconds: number;
  ventSeconds: number;
}

/**
 * The transport plane (see AirplaneEntity and sim/airplane.ts): 24
 * passenger benches along the hold; it cannot be hurt and nobody flies it.
 */
export const AIRPLANE_DEF: MountDef = ROUTE_CRAFT_DEFS.airplane;

/** The dropship flying a drop route (an `airplane` entity with craft `dropship`): not the placeable Dropship vehicle. */
export const DROPSHIP_DROP_MODEL = 'dropship_drop';

/**
 * The dropship on a drop route: the Dropship's model, 12 riders on benches
 * along its deck; like the transport plane it cannot be hurt and nobody
 * flies it.
 */
export const DROPSHIP_DROP_DEF: MountDef = ROUTE_CRAFT_DEFS.dropship_drop;

/** The mount that flies an `airplane` entity's route (its craft). */
export const airCraftDef = (craft: string | undefined): MountDef => (craft === 'dropship' ? DROPSHIP_DROP_DEF : AIRPLANE_DEF);

export const getMountDef = (id: string): MountDef | undefined => (id === AIRPLANE_MODEL ? AIRPLANE_DEF : id === DROPSHIP_DROP_MODEL ? DROPSHIP_DROP_DEF : MOUNT_DEFS[id as MountModel]);

/**
 * Vehicles placed to ride on water (MountEntity.onWater). Over water or
 * swamp they float with their feet `draft` under the surface (rising to it
 * at up to `rise` m/s from below), top out at `speed` of their top speed
 * and keep only `grip` of their tyre or pad grip, so they slide more.
 */
export const FLOAT = { draft: 0.3, rise: 4, speed: 0.75, grip: 0.5 } as const;

/** Turn a mount-frame offset into world space for a mount at `pos` facing `yaw` (see viewDirection). */
export function mountToWorld(pos: { x: number; y: number; z: number }, yaw: number, o: readonly [number, number, number]): { x: number; y: number; z: number } {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  // Forward (+Z local) is (sin yaw, cos yaw); right (+X local) is (cos yaw, -sin yaw).
  return { x: pos.x + o[0] * c + o[2] * s, y: pos.y + o[1], z: pos.z - o[0] * s + o[2] * c };
}

/**
 * How far from a mount's hull (its footprint seen from above, m) you can still get in, wherever its centre is: a
 * long hull keeps you further from its centre than its enter radius (the Dropship's nose and tail are 4.8 m from it,
 * its enter radius 4.5), and one wedged between props or in a wreck may show only its nose or tail.
 */
export const ENTER_HULL_REACH = 1.6;
/** How far below a mount's base (m) you can climb in from; and above it, its roof plus this (standing on its deck). */
export const ENTER_BELOW = 2.5;
export const ENTER_ABOVE_ROOF = 0.6;

/**
 * Can someone standing at `feet` get into a mount at `pos` facing `yaw`? Within its enter radius of its centre, or
 * within ENTER_HULL_REACH of its hull; and at a height they could climb in from (ENTER_BELOW under its base up to
 * its roof). Returns the distance from its centre (the nearest mount in reach is the one you get into), or null out
 * of reach. The match, the client's prompt and the bots all ask this.
 */
export function enterReach(def: { half: readonly [number, number, number]; enterRadius: number }, pos: { x: number; y: number; z: number }, yaw: number, feet: { x: number; y: number; z: number }): number | null {
  const dy = feet.y - pos.y;
  if (dy <= -ENTER_BELOW || dy >= Math.max(ENTER_BELOW, def.half[1] * 2 + ENTER_ABOVE_ROOF)) return null;
  const dx = feet.x - pos.x;
  const dz = feet.z - pos.z;
  const centre = Math.hypot(dx, dz);
  if (centre <= def.enterRadius) return centre;
  // In the mount's frame: right (+X) is (cos yaw, -sin yaw), forward (+Z) is (sin yaw, cos yaw).
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  const gx = Math.max(0, Math.abs(dx * c - dz * s) - def.half[0]);
  const gz = Math.max(0, Math.abs(dx * s + dz * c) - def.half[2]);
  return Math.hypot(gx, gz) <= ENTER_HULL_REACH ? centre : null;
}

/** A seated rider's eye above the seat's feet point, and how far forward of it (cockpit camera). */
export const SEATED_EYE_HEIGHT = 1.0;
export const SEATED_EYE_FORWARD = 0.15;
/** A seated rider's floor under the cushion when the seat doesn't say (SeatDef.legDrop): the shins hang straight down. */
export const SEAT_LEG_DROP = 0.45;

/**
 * Where a rider's eye is in the cockpit view, in the mount's frame: the
 * mount's own `cockpitEye` for the driver, otherwise a seated head height
 * above the seat and slightly forward. Drawing only: shots still leave from
 * the rider's standing eye on the server.
 */
export function cockpitEye(def: MountDef, seat: number): [number, number, number] {
  const s = def.seats[seat];
  if (!s) return [0, def.half[1] * 2 + SEATED_EYE_HEIGHT, 0];
  if (s.role === 'driver' && def.cockpitEye) return [...def.cockpitEye];
  return [s.offset[0], s.offset[1] + SEATED_EYE_HEIGHT, s.offset[2] + SEATED_EYE_FORWARD];
}

// ---------------------------------------------------------------- damage states

/** Health fractions where a mount starts to smoke, smokes black and throws sparks, and catches fire. */
export const MOUNT_SMOKE_FRACTION = 0.6;
export const MOUNT_HEAVY_SMOKE_FRACTION = 0.35;
export const MOUNT_BURN_FRACTION = 0.15;
/** A vehicle that catches fire at the burn threshold blows up this many seconds later, unless something finishes it first. */
export const MOUNT_BURN_SECONDS = 5;
/** Seconds a destroyed vehicle's charred wreck stays as cover (never longer than its respawn delay, less the fade). */
export const MOUNT_WRECK_SECONDS = 20;
/** Seconds the wreck takes to fade out on screen; it stops being solid when the fade starts. */
export const MOUNT_WRECK_FADE_SECONDS = 1.5;

/** The `alive` field of a mount snapshot carries these bits (0: gone). */
export const MOUNT_FLAG_ALIVE = 1;
export const MOUNT_FLAG_WRECK = 2;
export const MOUNT_FLAG_BURNING = 4;
/** An arc sentry winding up on a target (its charge glow and warning sound). */
export const MOUNT_FLAG_CHARGING = 8;
/** An arc sentry's arc locked onto a target. */
export const MOUNT_FLAG_ARC = 16;

export type MountDamageState = 'intact' | 'smoking' | 'heavy' | 'burning';

/** How damaged a mount looks: from its health fraction (0..1), or burning (set alight, e.g. by lava) whatever its health. */
export function mountDamageState(fraction: number, burning = false): MountDamageState {
  if (burning || fraction < MOUNT_BURN_FRACTION) return 'burning';
  if (fraction < MOUNT_HEAVY_SMOKE_FRACTION) return 'heavy';
  if (fraction < MOUNT_SMOKE_FRACTION) return 'smoking';
  return 'intact';
}

/** The share of an amount of damage of kind `hit` a mount takes (MountArmour; crashes and hazards always full). */
export function armourScale(def: MountDef, hit: MountHit): number {
  const a = def.armour;
  if (!a) return 1;
  return (hit === 'bullet' ? a.bullets : hit === 'blast' ? a.blasts : hit === 'melee' ? a.melee : 1) ?? 1;
}

/** Its crew can't be hurt from outside (and die with it): MountArmour.sealed. */
export const sealedMount = (def: MountDef): boolean => !!def.armour?.sealed;

/**
 * The seat whose mounted gun the rider of seat `seat` fires, or null: their own seat's gun; for the driver with none,
 * a gunner seat marked `driverFires` while it is empty (`taken(i)`: someone sits in seat i). The match, the client's
 * HUD and prediction, and the bots all ask this.
 */
export function firingSeat(def: MountDef, seat: number, taken: (i: number) => boolean): number | null {
  const s = def.seats[seat];
  if (!s) return null;
  if (s.weapon) return seat;
  if (s.role !== 'driver') return null;
  const i = def.seats.findIndex((x) => x.driverFires && x.weapon);
  return i >= 0 && !taken(i) ? i : null;
}

/** Ticks per round back of limited mounted ammunition (SeatAmmo.refillSeconds; 0: none back over time). */
export const ammoRefillTicks = (a: SeatAmmo, tickRate: number): number => (a.refillSeconds > 0 ? Math.max(1, Math.round(a.refillSeconds * tickRate)) : 0);

/** Weight in tonnes for crashes: vehicles their own; turrets and sentries are bolted down, so count as heavy. */
export const mountMass = (def: MountDef): number => def.vehicle?.mass ?? 4;

/** Match setting: how much damage vehicles take (turrets and sentries always take full damage). */
export type VehicleDamage = 'normal' | 'tough' | 'off';
export const VEHICLE_DAMAGE_SCALE: Record<VehicleDamage, number> = { normal: 1, tough: 0.5, off: 0 };

/**
 * Two mounts' footprints (boxes turned by yaw, seen from above) as a
 * separating-axis test: the gap between them (negative when they overlap)
 * and the unit normal pointing from `a` to `b` along the axis of least
 * overlap. Null when they are apart vertically.
 */
export function footprintGap(
  a: { pos: { x: number; y: number; z: number }; yaw: number; half: readonly [number, number, number] },
  b: { pos: { x: number; y: number; z: number }; yaw: number; half: readonly [number, number, number] },
): { gap: number; nx: number; nz: number } | null {
  if (Math.abs(a.pos.y + a.half[1] - (b.pos.y + b.half[1])) > a.half[1] + b.half[1]) return null;
  const axes = (yaw: number) => [
    { x: Math.cos(yaw), z: -Math.sin(yaw) },
    { x: Math.sin(yaw), z: Math.cos(yaw) },
  ];
  const ax = axes(a.yaw);
  const bx = axes(b.yaw);
  const radius = (half: readonly [number, number, number], own: { x: number; z: number }[], l: { x: number; z: number }) => half[0] * Math.abs(own[0]!.x * l.x + own[0]!.z * l.z) + half[2] * Math.abs(own[1]!.x * l.x + own[1]!.z * l.z);
  const d = { x: b.pos.x - a.pos.x, z: b.pos.z - a.pos.z };
  let best = { gap: -Infinity, nx: 0, nz: 1 };
  for (const l of [...ax, ...bx]) {
    const along = d.x * l.x + d.z * l.z;
    const gap = Math.abs(along) - radius(a.half, ax, l) - radius(b.half, bx, l);
    if (gap > best.gap) best = { gap, nx: along >= 0 ? l.x : -l.x, nz: along >= 0 ? l.z : -l.z };
  }
  return best;
}

/**
 * How close (m, across the ground) to a spawn an arc sentry may stand before MapMaker warns: nearer, a player
 * coming in can be inside its wind-up before they can move (it locks on in 0.75 s and can't be outrun in the open).
 */
export const ARC_SENTRY_SPAWN_CLEAR = 12;

/**
 * MapMaker checks for arc sentries (the Arc Turret): `mount.arc_spawn` when one stands within
 * ARC_SENTRY_SPAWN_CLEAR of a spawn it would shoot at (no team, or a spawn of another team or a shared one).
 */
export function arcSentryIssues(entities: readonly { kind: string; id: string; position: readonly number[]; model?: string; faction?: string | null }[]): { severity: 'warning'; code: string; message: string; targetId: string }[] {
  const out: { severity: 'warning'; code: string; message: string; targetId: string }[] = [];
  const spawns = entities.filter((e) => e.kind === 'spawn');
  for (const e of entities) {
    if (e.kind !== 'mount' || !e.model || !MOUNT_DEFS[e.model as MountModel]?.sentry?.arc) continue;
    let near: { id: string; d: number } | null = null;
    for (const s of spawns) {
      // Its own team's spawn is safe (it doesn't shoot its team).
      if (e.faction && s.faction === e.faction) continue;
      const d = Math.hypot(s.position[0]! - e.position[0]!, s.position[2]! - e.position[2]!);
      if (d < ARC_SENTRY_SPAWN_CLEAR && (!near || d < near.d)) near = { id: s.id, d };
    }
    if (near) out.push({ severity: 'warning', code: 'mount.arc_spawn', message: `${MOUNT_DEFS[e.model as MountModel].displayName} ${e.id} is ${near.d.toFixed(1)} m from spawn ${near.id}: players it shoots at could spawn inside its wind-up. Keep it ${ARC_SENTRY_SPAWN_CLEAR} m away, or give it that spawn's team`, targetId: e.id });
  }
  return out;
}
