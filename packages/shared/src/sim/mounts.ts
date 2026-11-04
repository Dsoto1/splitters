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
}

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
   */
  wheels?: { model: string; at: [number, number, number][] };
  /**
   * The driver's eye in the cockpit view, in the mount's frame (drawing only).
   * Absent: a seated head height above the driver's seat, a little forward (see cockpitEye).
   */
  cockpitEye?: [number, number, number];
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
