/**
 * Mounts: things you get into. Turrets (one gunner, stationary), sentries
 * (no seats: they aim and fire on their own) and vehicles (a driver, maybe a
 * gunner on a mounted gun, and passengers who shoot their own weapons).
 * Data only; the match runs them.
 *
 * Local frames: +Z is the mount's forward, +X its right, +Y up; positions are
 * metres from the mount's origin (its footprint centre on the ground).
 */

export const MOUNT_MODELS = [
  'turret_mg', 'turret_rocket', 'sentry', 'kart', 'speeder', 'buggy', 'hauler', 'skyfighter', 'dropship', 'tank',
  // Sprint 5 lineup (see VEHICLES.md): each one is an existing handling class with its own tuning.
  'gun_jeep', 'armored_rover', 'hover_bike', 'gunship', 'ice_cream_truck', 'snow_sled',
] as const;
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
  /** Which way the seat's arc is centred, from the mount's forward (radians, + to the right): side door guns. Default 0. */
  facing?: number;
}

export interface MountDef {
  id: MountModel | typeof AIRPLANE_MODEL;
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
  };
  sentry?: { weapon: string; range: number; turnRate: number };
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

const ALL_ROUND = undefined;

export const MOUNT_DEFS: Readonly<Record<MountModel, MountDef>> = {
  turret_mg: {
    id: 'turret_mg',
    displayName: 'Heavy MG Turret',
    kind: 'turret',
    // The owner's toy machine gun on a tripod (Meshy, owned; content/guns.json, centred on its tripod).
    model: 'guns/tripod_mg.glb',
    health: 400,
    half: [0.6, 0.5, 0.6],
    seats: [{ role: 'gunner', label: 'Gunner', offset: [0, 0, -1.1], weapon: 'core.mount_mg', arc: 1.4 }],
    enterRadius: 2.4,
    respawnSeconds: 45,
    blast: { radius: 3, damage: 60 },
    blurb: 'A heavy machine gun on a tripod: one gunner, a wide arc, overheats instead of reloading',
  },
  turret_rocket: {
    id: 'turret_rocket',
    displayName: 'Rocket Turret',
    kind: 'turret',
    // A Meshy community cannon on a pedestal (CC0 per the owner; content/guns.json, centred on its pedestal).
    model: 'guns/arc_cannon_turret.glb',
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
    // The owner's Large Sentry Gun (Meshy, owned; content/guns.json, centred on its base).
    model: 'guns/sentry_turret.glb',
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
    // The owner's Tactical Off-Road Beast and its Rugged Off-Road Tire (Meshy, owned; content/guns.json): a long
    // tube-frame buggy with a roof gun, its hubs bare, so the tires go on at its hubs and it rides on them.
    model: 'vehicles/offroad_buggy.glb',
    rideHeight: 0.24,
    wheels: {
      model: 'vehicles/offroad_tire.glb',
      at: [
        [-1.0, 0.42, 1.74],
        [1.0, 0.42, 1.74],
        [-1.0, 0.42, -1.86],
        [1.0, 0.42, -1.86],
      ],
    },
    health: 450,
    half: [1.0, 0.6, 2.0],
    // On the model's seats: two rows (front at z 0.2, back at z -0.55, cushions 0.72 m up, 0.32 m either side of
    // the middle), the roof gun over the back row, its gunner standing in the cargo bay behind.
    seats: [
      { role: 'driver', label: 'Driver', offset: [-0.32, 0.72, 0.2] },
      { role: 'gunner', label: 'Gunner', offset: [0, 0.6, -1.15], weapon: 'core.mount_mg', arc: ALL_ROUND },
      { role: 'passenger', label: 'Passenger', offset: [0.32, 0.72, 0.2] },
      { role: 'passenger', label: 'Back seat', offset: [0.32, 0.75, -0.55] },
    ],
    // Just under the roof bars (1.45 m), looking over the wheel and dash.
    cockpitEye: [-0.32, 1.42, 0.15],
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
    // The Dispatcher's canopy sits behind its long nose prongs.
    cockpitEye: [0, 1.95, -0.8],
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
    // Low over the deck, looking down the nose.
    cockpitEye: [0, 2.3, 2.6],
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
    // The commander's hatch on the turret roof, left of and behind the gun: you look out over the barrel.
    cockpitEye: [-0.6, 3.5, -0.9],
    blurb: 'A heavy tank for three: a driver, a cannon gunner firing explosive shells ahead, and a roof machine gun',
  },
  gun_jeep: {
    id: 'gun_jeep',
    displayName: 'Gun Jeep',
    kind: 'vehicle',
    model: 'vehicles/gun_jeep.glb',
    health: 380,
    half: [1.0, 0.7, 2.1],
    seats: [
      { role: 'driver', label: 'Driver', offset: [-0.4, 0.8, 0.5] },
      { role: 'gunner', label: 'Roof gun', offset: [0, 1.25, -1.1], weapon: 'core.mount_mg', arc: ALL_ROUND },
      { role: 'passenger', label: 'Passenger', offset: [0.4, 0.8, 0.5] },
    ],
    enterRadius: 3.2,
    respawnSeconds: 40,
    blast: { radius: 4.5, damage: 85 },
    vehicle: { maxSpeed: 21, reverseSpeed: 8, accel: 12, turnRate: 2.0, grip: 0.26, mass: 1.1 },
    blurb: 'A light pickup with a machine gun on the back: a driver, a gunner who fires all round and one passenger',
  },
  armored_rover: {
    id: 'armored_rover',
    displayName: 'Armored Rover',
    kind: 'vehicle',
    model: 'vehicles/armored_rover.glb',
    health: 900,
    half: [1.25, 1.2, 2.65],
    seats: [
      { role: 'driver', label: 'Driver', offset: [-0.5, 1.1, 1.5] },
      { role: 'gunner', label: 'Front gun', offset: [0.4, 2.75, 0.9], weapon: 'core.mount_mg', arc: 1.3 },
      { role: 'gunner', label: 'Rear gun', offset: [0, 2.75, -1.7], weapon: 'core.mount_mg', arc: 1.6, facing: Math.PI },
      { role: 'passenger', label: 'Left bench', offset: [-0.6, 1.2, -0.8] },
      { role: 'passenger', label: 'Right bench', offset: [0.6, 1.2, -0.8] },
    ],
    enterRadius: 3.8,
    respawnSeconds: 60,
    blast: { radius: 5.5, damage: 110 },
    vehicle: { maxSpeed: 14, reverseSpeed: 6, accel: 7, turnRate: 1.25, grip: 0.38, mass: 3.6 },
    blurb: 'A heavy armoured truck for five: a driver, a front and a rear machine gunner and two riders in the back',
  },
  hover_bike: {
    id: 'hover_bike',
    displayName: 'Hover Bike',
    kind: 'vehicle',
    model: 'vehicles/hover_bike.glb',
    health: 170,
    half: [0.9, 0.5, 1.5],
    // Astride the canopy, ahead of the middle: the nose (+Z) leads and the twin exhausts trail.
    seats: [{ role: 'driver', label: 'Rider', offset: [0, 0.95, 0.25] }],
    enterRadius: 2.6,
    respawnSeconds: 30,
    blast: { radius: 3.5, damage: 70 },
    vehicle: { maxSpeed: 31, reverseSpeed: 8, accel: 18, turnRate: 2.4, hover: true, grip: 0.1, mass: 0.35 },
    blurb: 'The fastest thing on the map: one rider, no gun, drifts like a hovercraft',
  },
  gunship: {
    id: 'gunship',
    displayName: 'Gunship',
    kind: 'vehicle',
    model: 'vehicles/gunship.glb',
    health: 950,
    half: [2.4, 1.2, 4.3],
    seats: [
      { role: 'driver', label: 'Pilot', offset: [0, 3.1, 2.4], weapon: 'core.speeder_guns', arc: 0.3 },
      { role: 'gunner', label: 'Left door gun', offset: [-2.0, 2.4, -0.4], weapon: 'core.mount_mg', arc: 1.25, facing: -Math.PI / 2 },
      { role: 'gunner', label: 'Right door gun', offset: [2.0, 2.4, -0.4], weapon: 'core.mount_mg', arc: 1.25, facing: Math.PI / 2 },
    ],
    enterRadius: 4.5,
    respawnSeconds: 80,
    blast: { radius: 6, damage: 120 },
    vehicle: { maxSpeed: 17, reverseSpeed: 6, accel: 6, turnRate: 1.1, hover: true, grip: 0.06, mass: 3, fly: { climb: 5, ceiling: 30 } },
    // In the cockpit between its frames, not on the roof.
    cockpitEye: [0, 2.9, 2.8],
    blurb: 'A flying gunship (the dropship\'s flight model): the pilot fires blasters ahead, two door gunners cover the sides',
  },
  ice_cream_truck: {
    id: 'ice_cream_truck',
    displayName: 'Ice Cream Truck',
    kind: 'vehicle',
    model: 'vehicles/ice_cream_truck.glb',
    health: 520,
    half: [1.2, 1.1, 2.4],
    seats: [
      { role: 'driver', label: 'Driver', offset: [-0.45, 0.9, 1.2] },
      { role: 'passenger', label: 'Serving hatch', offset: [0.5, 0.9, 0.0] },
      { role: 'passenger', label: 'Back left', offset: [-0.5, 0.9, -1.2] },
      { role: 'passenger', label: 'Back right', offset: [0.5, 0.9, -1.2] },
    ],
    enterRadius: 3.4,
    respawnSeconds: 45,
    blast: { radius: 5, damage: 95 },
    vehicle: { maxSpeed: 16, reverseSpeed: 6, accel: 8, turnRate: 1.5, grip: 0.24, mass: 1.9 },
    blurb: 'A pastel van for four: no gun, but the three riders shoot out of the windows',
  },
  snow_sled: {
    id: 'snow_sled',
    displayName: 'Snow Sled',
    kind: 'vehicle',
    model: 'vehicles/snow_sled.glb',
    health: 200,
    half: [0.85, 0.5, 1.4],
    seats: [
      { role: 'driver', label: 'Driver', offset: [0, 0.75, 0.35] },
      { role: 'passenger', label: 'Passenger', offset: [0, 0.75, -0.75] },
    ],
    enterRadius: 2.8,
    respawnSeconds: 30,
    blast: { radius: 3.5, damage: 60 },
    vehicle: { maxSpeed: 23, reverseSpeed: 5, accel: 13, turnRate: 2.0, hover: true, grip: 0.12, mass: 0.45 },
    rideHeight: 0,
    blurb: 'A two-seat sled that skims over snow (hover handling): a driver and a passenger with their own gun',
  },
};

/**
 * The transport plane (see AirplaneEntity and sim/airplane.ts): 24
 * passenger benches along the hold; it cannot be hurt and nobody flies it.
 */
export const AIRPLANE_DEF: MountDef = {
  id: AIRPLANE_MODEL,
  displayName: 'Transport Plane',
  kind: 'vehicle',
  model: 'vehicles/transport_plane.glb',
  health: 1_000_000,
  half: [5.2, 2.6, 8],
  seats: Array.from({ length: 24 }, (_, i): SeatDef => ({ role: 'passenger', label: `Bench ${i + 1}`, offset: [i % 2 ? 1.4 : -1.4, 1.0, 6 - Math.floor(i / 2)] })),
  enterRadius: 0,
  respawnSeconds: 600,
  blast: { radius: 0, damage: 0 },
  airplane: true,
  blurb: 'Flies a fixed route; jump out with E or jump and parachute down',
};

export const getMountDef = (id: string): MountDef | undefined => (id === AIRPLANE_MODEL ? AIRPLANE_DEF : MOUNT_DEFS[id as MountModel]);

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
