/**
 * Mounts: things you get into. Turrets (one gunner, stationary), sentries
 * (no seats: they aim and fire on their own) and vehicles (a driver, maybe a
 * gunner on a mounted gun, and passengers who shoot their own weapons).
 * Data only; the match runs them.
 *
 * Local frames: +Z is the mount's forward, +X its right, +Y up; positions are
 * metres from the mount's origin (its footprint centre on the ground).
 */

export const MOUNT_MODELS = ['turret_mg', 'turret_rocket', 'sentry', 'kart', 'speeder', 'buggy', 'hauler', 'skyfighter', 'dropship', 'tank'] as const;
export type MountModel = (typeof MOUNT_MODELS)[number];

export type SeatRole = 'driver' | 'gunner' | 'passenger';

export interface SeatDef {
  role: SeatRole;
  label: string;
  /** Where the occupant's feet are, in the mount's frame. */
  offset: [number, number, number];
  /** Mounted weapon this seat fires instead of the occupant's own (absent: passengers use their own weapons, drivers can't shoot). */
  weapon?: string;
  /** How far the seat can aim either side of the mount's forward (radians; absent = all round). */
  arc?: number;
}

export interface MountDef {
  id: MountModel;
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
  };
  sentry?: { weapon: string; range: number; turnRate: number };
  /** One line for MapMaker. */
  blurb: string;
}

const ALL_ROUND = undefined;

export const MOUNT_DEFS: Readonly<Record<MountModel, MountDef>> = {
  turret_mg: {
    id: 'turret_mg',
    displayName: 'Heavy MG Turret',
    kind: 'turret',
    model: 'turrets/mg.glb',
    health: 400,
    half: [0.6, 0.5, 0.6],
    seats: [{ role: 'gunner', label: 'Gunner', offset: [0, 0, -1.1], weapon: 'core.mount_mg', arc: 1.4 }],
    enterRadius: 2.4,
    respawnSeconds: 45,
    blast: { radius: 3, damage: 60 },
    blurb: 'A twin machine gun on a pedestal: one gunner, a wide arc, overheats instead of reloading',
  },
  turret_rocket: {
    id: 'turret_rocket',
    displayName: 'Rocket Turret',
    kind: 'turret',
    model: 'turrets/rocket.glb',
    health: 400,
    half: [0.6, 0.5, 0.6],
    seats: [{ role: 'gunner', label: 'Gunner', offset: [0, 0, -1.1], weapon: 'core.mount_rockets', arc: 1.2 }],
    enterRadius: 2.4,
    respawnSeconds: 60,
    blast: { radius: 3.5, damage: 70 },
    blurb: 'A rocket launcher on a pedestal: slow, heavy hitting, one gunner',
  },
  sentry: {
    id: 'sentry',
    displayName: 'Sentry Gun',
    kind: 'sentry',
    model: 'turrets/sentry.glb',
    health: 220,
    half: [0.5, 0.5, 0.5],
    seats: [],
    enterRadius: 0,
    respawnSeconds: 40,
    blast: { radius: 3, damage: 50 },
    sentry: { weapon: 'core.sentry_gun', range: 30, turnRate: 2.4 },
    blurb: 'Shoots enemies of its team on sight (any team: everyone). Destroy it and it comes back later',
  },
  kart: {
    id: 'kart',
    displayName: 'Go-Kart',
    kind: 'vehicle',
    model: 'vehicles/kart.glb',
    health: 220,
    half: [0.7, 0.45, 1.0],
    seats: [{ role: 'driver', label: 'Driver', offset: [0, 0.35, -0.1] }],
    enterRadius: 2.6,
    respawnSeconds: 30,
    blast: { radius: 3.5, damage: 70 },
    vehicle: { maxSpeed: 20, reverseSpeed: 7, accel: 16, turnRate: 2.6, grip: 0.32, mass: 0.4 },
    blurb: 'One seat, very quick, no gun: run them over',
  },
  speeder: {
    id: 'speeder',
    displayName: 'Speeder',
    kind: 'vehicle',
    model: 'vehicles/speeder.glb',
    health: 300,
    half: [1.2, 0.65, 2.1],
    seats: [
      { role: 'driver', label: 'Pilot', offset: [0, 0.95, 0.5], weapon: 'core.speeder_guns', arc: 0.35 },
      { role: 'passenger', label: 'Passenger', offset: [0, 1.0, -0.8] },
    ],
    enterRadius: 3,
    respawnSeconds: 40,
    blast: { radius: 4, damage: 80 },
    vehicle: { maxSpeed: 24, reverseSpeed: 8, accel: 14, turnRate: 2.1, hover: true, grip: 0.07, mass: 0.6 },
    blurb: 'A hovering two-seater: the pilot fires twin blasters ahead, the passenger shoots their own gun',
  },
  buggy: {
    id: 'buggy',
    displayName: 'Buggy',
    kind: 'vehicle',
    model: 'vehicles/buggy.glb',
    health: 450,
    half: [1.0, 0.6, 2.0],
    seats: [
      { role: 'driver', label: 'Driver', offset: [-0.4, 0.75, 0.3] },
      { role: 'gunner', label: 'Gunner', offset: [0, 1.05, -1.3], weapon: 'core.mount_mg', arc: ALL_ROUND },
      { role: 'passenger', label: 'Passenger', offset: [0.4, 0.75, 0.3] },
      { role: 'passenger', label: 'Back seat', offset: [0.45, 0.85, -0.6] },
    ],
    enterRadius: 3.2,
    respawnSeconds: 45,
    blast: { radius: 4.5, damage: 90 },
    vehicle: { maxSpeed: 18, reverseSpeed: 7, accel: 10, turnRate: 1.8, grip: 0.22, mass: 1.4 },
    blurb: 'Four seats: a driver, a gunner on the roof machine gun and two passengers with their own weapons',
  },
  hauler: {
    id: 'hauler',
    displayName: 'Hauler',
    kind: 'vehicle',
    model: 'vehicles/hauler.glb',
    health: 700,
    half: [1.6, 1.0, 3.4],
    seats: [
      { role: 'driver', label: 'Pilot', offset: [0, 1.7, 2.2] },
      { role: 'gunner', label: 'Gunner', offset: [0, 2.4, -0.4], weapon: 'core.mount_rockets', arc: ALL_ROUND },
      { role: 'passenger', label: 'Left front', offset: [-0.9, 1.7, 0.8] },
      { role: 'passenger', label: 'Right front', offset: [0.9, 1.7, 0.8] },
      { role: 'passenger', label: 'Left back', offset: [-0.9, 1.7, -1.6] },
      { role: 'passenger', label: 'Right back', offset: [0.9, 1.7, -1.6] },
    ],
    enterRadius: 4,
    respawnSeconds: 60,
    blast: { radius: 5, damage: 100 },
    vehicle: { maxSpeed: 13, reverseSpeed: 5, accel: 6, turnRate: 1.1, hover: true, grip: 0.05, mass: 3 },
    blurb: 'A slow hovering transport for six: a pilot, a rocket gunner and four passengers',
  },
  skyfighter: {
    id: 'skyfighter',
    displayName: 'Skyfighter',
    kind: 'vehicle',
    model: 'vehicles/skyfighter.glb',
    health: 280,
    half: [1.6, 0.8, 2.2],
    seats: [{ role: 'driver', label: 'Pilot', offset: [0, 1.4, 0.3], weapon: 'core.speeder_guns', arc: 0.3 }],
    enterRadius: 3.2,
    respawnSeconds: 50,
    blast: { radius: 5, damage: 90 },
    vehicle: { maxSpeed: 28, reverseSpeed: 6, accel: 12, turnRate: 1.9, hover: true, grip: 0.08, mass: 0.7, fly: { climb: 7, ceiling: 30 } },
    blurb: 'A one-seat fighter that flies: jump to climb, crouch to dive; twin blasters ahead',
  },
  dropship: {
    id: 'dropship',
    displayName: 'Dropship',
    kind: 'vehicle',
    model: 'vehicles/dropship.glb',
    health: 750,
    half: [2.0, 0.85, 4.8],
    seats: [
      { role: 'driver', label: 'Pilot', offset: [0, 2.0, 3.2] },
      { role: 'gunner', label: 'Gunner', offset: [0, 2.1, 0.6], weapon: 'core.mount_mg', arc: ALL_ROUND },
      { role: 'passenger', label: 'Left front', offset: [-1.2, 2.0, 1.4] },
      { role: 'passenger', label: 'Right front', offset: [1.2, 2.0, 1.4] },
      { role: 'passenger', label: 'Left back', offset: [-1.2, 2.0, -1.6] },
      { role: 'passenger', label: 'Right back', offset: [1.2, 2.0, -1.6] },
    ],
    enterRadius: 4.5,
    respawnSeconds: 70,
    blast: { radius: 6, damage: 110 },
    vehicle: { maxSpeed: 15, reverseSpeed: 5, accel: 5, turnRate: 0.9, hover: true, grip: 0.05, mass: 3.5, fly: { climb: 4, ceiling: 25 } },
    blurb: 'A flying troop carrier for six: a pilot, a door gunner and four riding on the deck',
  },
  tank: {
    id: 'tank',
    displayName: 'Tank',
    kind: 'vehicle',
    model: 'vehicles/tank.glb',
    health: 1200,
    half: [2.1, 1.0, 3.0],
    seats: [
      { role: 'driver', label: 'Driver', offset: [-0.5, 2.0, 1.2] },
      { role: 'gunner', label: 'Cannon', offset: [0, 2.9, -0.4], weapon: 'core.tank_cannon', arc: 0.6 },
      { role: 'gunner', label: 'Roof gun', offset: [0.9, 2.9, -1.0], weapon: 'core.mount_mg', arc: ALL_ROUND },
    ],
    enterRadius: 4,
    respawnSeconds: 75,
    blast: { radius: 6, damage: 120 },
    vehicle: { maxSpeed: 11, reverseSpeed: 5, accel: 5, turnRate: 1.0, grip: 0.45, mass: 6 },
    blurb: 'A heavy tank for three: a driver, a cannon gunner firing explosive shells ahead, and a roof machine gun',
  },
};

export const getMountDef = (id: string): MountDef | undefined => MOUNT_DEFS[id as MountModel];

/** Turn a mount-frame offset into world space for a mount at `pos` facing `yaw` (see viewDirection). */
export function mountToWorld(pos: { x: number; y: number; z: number }, yaw: number, o: readonly [number, number, number]): { x: number; y: number; z: number } {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  // Forward (+Z local) is (sin yaw, cos yaw); right (+X local) is (cos yaw, -sin yaw).
  return { x: pos.x + o[0] * c + o[2] * s, y: pos.y + o[1], z: pos.z - o[0] * s + o[2] * c };
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
