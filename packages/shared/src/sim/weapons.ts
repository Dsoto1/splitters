import { add, dot, scale, type Vec3 } from '../math.ts';
import { PLAYER } from './constants.ts';

export type WeaponKind = 'hitscan' | 'projectile' | 'melee';

/** Ammunition families: typed ammo pickups top up every owned weapon of that type. */
export const AMMO_TYPES = ['light', 'rifle', 'shells', 'sniper', 'explosive', 'cells', 'fuel', 'chem'] as const;
export type AmmoType = (typeof AMMO_TYPES)[number];
export const AMMO_LABELS: Record<AmmoType, string> = {
  light: 'Light rounds',
  rifle: 'Rifle rounds',
  shells: 'Shells',
  sniper: 'Sniper rounds',
  explosive: 'Explosives',
  cells: 'Energy cells',
  fuel: 'Fuel canisters',
  chem: 'Chem canisters',
};

/** How a projectile looks on the client (index sent in snapshots). */
export const PROJECTILE_VISUALS = [
  'grenade', 'rocket', 'plasma', 'orb', 'frag', 'mine',
  'bubble', 'goo', 'oil', 'flame', 'disc', 'nail', 'flare', 'swarm', 'vortex', 'shard', 'sticky', 'molotov', 'gas', 'bolt',
  'holy', 'banana', 'sheep', 'bomblet', 'bomb', 'sandbag', 'spear',
] as const;
export type ProjectileVisual = (typeof PROJECTILE_VISUALS)[number];

/**
 * Lingering effects a hit leaves on a player: `burn` and `poison` hurt over
 * time, `slow` cuts speed, `chill` builds up (freeze ray) until the target
 * freezes solid for a moment.
 */
export const STATUS_KINDS = ['burn', 'poison', 'slow', 'chill'] as const;
export type StatusKind = (typeof STATUS_KINDS)[number];
export interface StatusHit {
  kind: StatusKind;
  /** How long it lasts after the last hit (burn, poison, slow). */
  seconds: number;
  /** Chill added per hit (1 = frozen). */
  amount?: number;
}

/**
 * Ground hazards and fields left behind by impacts: burning ground, toxic
 * clouds, sticky goo, slippery oil (which catches fire from flames and
 * explosions) and singularities that drag players in, then implode.
 */
export const ZONE_KINDS = ['fire', 'toxic', 'goo', 'oil', 'singularity'] as const;
export type ZoneKind = (typeof ZONE_KINDS)[number];
/** Whether a player standing at `feet` is inside a zone: puddles are shallow discs, clouds and fields are spheres around the chest. */
export function zoneContains(kind: ZoneKind, center: Vec3, radius: number, feet: Vec3): boolean {
  if (kind === 'toxic' || kind === 'singularity') return Math.hypot(center.x - feet.x, center.y - (feet.y + PLAYER.height * 0.55), center.z - feet.z) <= radius;
  return Math.hypot(center.x - feet.x, center.z - feet.z) <= radius && feet.y >= center.y - 0.6 && feet.y <= center.y + 1.5;
}

/** Ground grip for movement: oil makes it slick. */
export const OIL_TRACTION = 0.3;

export interface ZoneSpec {
  kind: ZoneKind;
  radius: number;
  seconds: number;
}

export interface ProjectileSpec {
  /** Launch speed (m/s). */
  speed: number;
  /** Downward acceleration (m/s²); 0 flies straight. */
  gravity: number;
  /** Seconds before it explodes on its own. */
  fuseSeconds: number;
  splashRadius: number;
  /** Damage at the centre, falling linearly to `splashEdgeDamage` at the radius. */
  splashDamage: number;
  splashEdgeDamage: number;
  /** Fraction of splash damage the shooter takes from their own explosion. */
  selfDamageScale: number;
  visual: ProjectileVisual;
  /** Bounces off walls and floors (keeping this share of its speed) instead of exploding on them; still bursts on a player. */
  bounce?: number;
  /**
   * Sticks where it lands, arms after `armSeconds`, then explodes when an
   * enemy comes within `triggerRadius` (or its fuse runs out).
   */
  mine?: { armSeconds: number; triggerRadius: number };
  /** Direct-hit damage to the player it strikes, on top of the splash. */
  impactDamage?: number;
  /** With `bounce`: bursts after this many bounces (bubbles, ricochets). */
  maxBounces?: number;
  /** Sticks to whatever it hits: `world` surfaces only, or `any` (players too: it rides on them) until the fuse runs out. */
  sticky?: 'world' | 'any';
  /** Steers toward the nearest enemy ahead within `range` (m), turning up to `turnRate` rad/s. */
  homing?: { turnRate: number; range: number };
  /** Slows down over time (share of speed lost per second). */
  drag?: number;
  /** Leaves a hazard where it bursts. */
  zone?: ZoneSpec;
  /** Pushes players away from the burst (m/s at the centre); rocket jumps. */
  knockback?: number;
  /** Status put on players caught in the burst or struck. */
  status?: StatusHit;
  /** Sets oil alight where it bursts (flames, flares, explosions do by default when they have splash damage). */
  ignites?: boolean;
  /** Flies where its shooter is aiming, turning up to `turnRate` rad/s (laser-guided rockets). */
  guided?: { turnRate: number };
  /** Bursts into `count` bomblets thrown out at `speed` m/s (cluster bombs). */
  cluster?: { count: number; speed: number; spec: ProjectileSpec };
  /** Once it lands it walks along the ground at `speed` m/s, hopping over low obstacles and turning at walls; bursts on contact with an enemy or when the fuse runs out. */
  walker?: { speed: number };
  /** Spears: it stays where it lands (or drops under whoever it hit) for anyone out of them to pick back up. */
  retrievable?: boolean;
  /** Where it bursts, calls in `count` bombs falling from `height` m in a line `spacing` m apart along the thrower's facing. */
  airstrike?: { count: number; spacing: number; height: number; bomb: ProjectileSpec };
  /** Deployable cover: where it lands it becomes a solid wall (half extents, metres) facing the thrower, with its own health. */
  cover?: { half: [number, number, number]; health: number };
}

/**
 * A weapon's second trigger (right mouse). `shared` uses the magazine
 * (`cost` rounds per use); `own` has its own reserve (an underbarrel
 * grenade), refilled by explosive ammo.
 */
export interface AltFire {
  label: string;
  ammo: 'shared' | 'own';
  cost: number;
  /** Own-reserve size and the rounds a weapon pickup gives. */
  max?: number;
  pickup?: number;
  fireIntervalTicks: number;
  kind: 'hitscan' | 'projectile';
  damage?: number;
  pellets?: number;
  spread?: number;
  projectile?: ProjectileSpec;
}

/** First-person and third-person presentation (client only; the server ignores it). */
export interface WeaponPresentation {
  /** Built model path under /models (see content/models.json). */
  model: string;
  /** Viewmodel offset from the camera (right, up, forward) in metres. */
  viewOffset: [number, number, number];
  /** Tracer colour. */
  tracer: string;
  /** Vertical FOV while aiming (radians); absent = no zoom. */
  zoomFov?: number;
  /** How characters hold the model in third person. */
  hold: WeaponHold;
  /** Sound to fire (default `fire.<weapon name>`). */
  sound?: string;
  /** Hitscan drawn as a solid beam instead of tracers (lasers, rails). */
  beam?: boolean;
}

/** A point on a weapon model, in model space (metres; +Z along the barrel, +Y up, +X right). */
export type ModelPoint = [number, number, number];

/**
 * Third-person hold. `pistol`: the gun sits in the right palm where the
 * animation puts it. `long`: the `shoulder` point is set in the right
 * shoulder pocket. In both cases the right palm goes to `grip` and the left
 * palm to `support`. `melee`: the weapon stays in the right hand.
 */
export interface WeaponHold {
  style: 'pistol' | 'long' | 'melee';
  grip: ModelPoint;
  support?: ModelPoint;
  shoulder?: ModelPoint;
}

/**
 * How the trigger works. `auto` fires while held, `semi` once per press,
 * `burst` a short burst per press.
 */
export type FireMode = 'auto' | 'semi' | 'burst';

/** Camera kick and spread bloom per shot; bloom recovers while not firing. */
export interface Recoil {
  /** Upward camera kick per shot (radians; client side). */
  kick: number;
  /** Spread added per shot (radians), up to `maxBloom`. */
  bloom: number;
  maxBloom: number;
  /** Bloom recovered per tick. */
  recover: number;
}

/** Data-driven weapon definition (v1 spec §5.2). Gameplay code never names a specific weapon. */
export interface WeaponDefinition {
  id: string;
  displayName: string;
  kind: WeaponKind;
  /** Inventory slot and number key, 1..9. */
  slot: number;
  /** Damage per hit (per pellet for multi-pellet weapons). */
  damage: number;
  pellets: number;
  /** Cone half-angle of random spread (radians). */
  spread: number;
  /** Minimum ticks between shots. */
  fireIntervalTicks: number;
  range: number;
  /** 0 = no ammunition (melee). */
  magazine: number;
  reserveMax: number;
  /** Reserve ammo granted when picked up (or topped up if already owned). */
  pickupAmmo: number;
  reloadTicks: number;
  /** Ticks after switching to this weapon before it can fire. */
  raiseTicks: number;
  projectile?: ProjectileSpec;
  /** Ammunition family (absent for melee). */
  ammo?: AmmoType;
  /** A medical tool: each use heals the teammate you aim at (or yourself) by this much instead of hurting. */
  heal?: number;
  /** A grapple: fired at a surface within `range`, it yanks you toward the hook point at about `speed` m/s. */
  grapple?: { speed: number };
  alt?: AltFire;
  /** Trigger behaviour (default `auto`). */
  fireMode?: FireMode;
  /** `burst`: shots per press and ticks between them. */
  burst?: { count: number; intervalTicks: number };
  /** Hold the trigger this long before it fires (spin-up, charge). `windupResets`: charge again after every shot. */
  windupTicks?: number;
  windupResets?: boolean;
  /** No ammunition: each shot adds heat; at 1 the weapon overheats and must cool right down. */
  heat?: { perShot: number; coolPerTick: number };
  /** Hitscan passes through this many players after the first. */
  pierce?: number;
  /** Hitscan lightning jumps from the target to `jumps` more enemies within `range`, each hit `falloff` times the last. */
  chain?: { jumps: number; range: number; falloff: number };
  /** Status put on players it hits. */
  status?: StatusHit;
  /** Hitscan push on the target (m/s). */
  knockback?: number;
  /** Damage multiplier for a head hit (default HEAD_MULTIPLIER; 1 for weapons that don't care where they land). */
  headshot?: number;
  recoil?: Recoil;
  /** AI: 0..1 general preference and the distance band (m) it is best at. */
  botDesirability: number;
  botRange: [number, number];
  view: WeaponPresentation;
}

export const CORE_WEAPONS: Readonly<Record<string, WeaponDefinition>> = {
  'core.knife': {
    id: 'core.knife',
    displayName: 'Knife',
    kind: 'melee',
    slot: 1,
    damage: 55,
    pellets: 1,
    spread: 0,
    fireIntervalTicks: 30,
    range: 2.2,
    magazine: 0,
    reserveMax: 0,
    pickupAmmo: 0,
    reloadTicks: 0,
    raiseTicks: 10,
    botDesirability: 0.15,
    botRange: [0, 2],
    view: { model: 'weapons/knife.glb', viewOffset: [0.2, -0.2, 0.42], tracer: '#ffffff', hold: { style: 'melee', grip: [0, 0, -0.1] } },
  },
  'core.pistol': {
    id: 'core.pistol',
    displayName: 'Pistol',
    kind: 'hitscan',
    slot: 2,
    damage: 22,
    pellets: 1,
    spread: 0.008,
    fireIntervalTicks: 12,
    range: 120,
    magazine: 12,
    reserveMax: 96,
    pickupAmmo: 24,
    reloadTicks: 60,
    raiseTicks: 15,
    ammo: 'light',
    botDesirability: 0.35,
    botRange: [2, 25],
    view: { model: 'weapons/pistol.glb', viewOffset: [0.2, -0.18, 0.42], tracer: '#ffe08a', hold: { style: 'pistol', grip: [0, -0.03, -0.075], support: [-0.02, -0.04, -0.065] } },
  },
  'core.rifle': {
    id: 'core.rifle',
    displayName: 'Assault Rifle',
    kind: 'hitscan',
    slot: 3,
    damage: 14,
    pellets: 1,
    spread: 0.02,
    fireIntervalTicks: 6,
    range: 150,
    magazine: 30,
    reserveMax: 180,
    pickupAmmo: 60,
    reloadTicks: 80,
    raiseTicks: 20,
    ammo: 'rifle',
    alt: {
      label: 'Underbarrel grenade',
      ammo: 'own',
      cost: 1,
      max: 4,
      pickup: 2,
      fireIntervalTicks: 50,
      kind: 'projectile',
      projectile: { speed: 24, gravity: 12, fuseSeconds: 3, splashRadius: 3.5, splashDamage: 85, splashEdgeDamage: 12, selfDamageScale: 0.6, visual: 'grenade' },
    },
    botDesirability: 0.7,
    botRange: [4, 35],
    view: { model: 'weapons/rifle.glb', viewOffset: [0.2, -0.2, 0.55], tracer: '#ffd36b', hold: { style: 'long', grip: [0, -0.05, -0.375], support: [0, 0.03, 0], shoulder: [0, 0.08, -0.58] } },
  },
  'core.shotgun': {
    id: 'core.shotgun',
    displayName: 'Shotgun',
    kind: 'hitscan',
    slot: 4,
    damage: 9,
    pellets: 8,
    spread: 0.085,
    fireIntervalTicks: 50,
    range: 45,
    magazine: 6,
    reserveMax: 36,
    pickupAmmo: 12,
    reloadTicks: 90,
    raiseTicks: 20,
    ammo: 'shells',
    alt: { label: 'Both barrels', ammo: 'shared', cost: 2, fireIntervalTicks: 70, kind: 'hitscan', damage: 9, pellets: 16, spread: 0.11 },
    botDesirability: 0.65,
    botRange: [0, 9],
    view: { model: 'weapons/shotgun.glb', viewOffset: [0.2, -0.2, 0.6], tracer: '#ffb38a', hold: { style: 'long', grip: [0, -0.01, -0.21], support: [0, 0, 0.1], shoulder: [0, -0.03, -0.47] } },
  },
  'core.sniper': {
    id: 'core.sniper',
    displayName: 'Sniper Rifle',
    kind: 'hitscan',
    slot: 5,
    damage: 75,
    pellets: 1,
    spread: 0,
    fireIntervalTicks: 75,
    range: 300,
    magazine: 5,
    reserveMax: 25,
    pickupAmmo: 10,
    reloadTicks: 110,
    raiseTicks: 25,
    ammo: 'sniper',
    headshot: 3,
    botDesirability: 0.6,
    botRange: [18, 120],
    view: { model: 'weapons/sniper.glb', viewOffset: [0.2, -0.2, 0.65], tracer: '#9ad7ff', zoomFov: 0.4, hold: { style: 'long', grip: [0, -0.04, -0.29], support: [0, -0.005, 0.02], shoulder: [0, -0.05, -0.57] } },
  },
  'core.launcher': {
    id: 'core.launcher',
    displayName: 'Grenade Launcher',
    kind: 'projectile',
    slot: 6,
    damage: 0,
    pellets: 1,
    spread: 0,
    fireIntervalTicks: 55,
    range: 0,
    magazine: 4,
    reserveMax: 16,
    pickupAmmo: 6,
    reloadTicks: 100,
    raiseTicks: 25,
    projectile: { speed: 26, gravity: 12, fuseSeconds: 3, splashRadius: 4.5, splashDamage: 100, splashEdgeDamage: 15, selfDamageScale: 0.6, visual: 'grenade' },
    ammo: 'explosive',
    botDesirability: 0.75,
    botRange: [6, 22],
    view: { model: 'weapons/launcher.glb', viewOffset: [0.22, -0.22, 0.55], tracer: '#c2c9a8', hold: { style: 'long', grip: [0, -0.1, -0.33], support: [0, -0.08, 0.02], shoulder: [0, 0, -0.45] } },
  },
  'core.smg': {
    id: 'core.smg',
    displayName: 'Submachine Gun',
    kind: 'hitscan',
    slot: 7,
    damage: 9,
    pellets: 1,
    spread: 0.035,
    fireIntervalTicks: 4,
    range: 80,
    magazine: 40,
    reserveMax: 240,
    pickupAmmo: 80,
    reloadTicks: 75,
    raiseTicks: 15,
    ammo: 'light',
    botDesirability: 0.6,
    botRange: [0, 18],
    view: { model: 'weapons/smg.glb', viewOffset: [0.19, -0.19, 0.45], tracer: '#ffe9a8', hold: { style: 'long', grip: [0, -0.05, -0.1], support: [0, -0.03, 0.12], shoulder: [0, 0.02, -0.25] } },
  },
  'core.rockets': {
    id: 'core.rockets',
    displayName: 'Rocket Launcher',
    kind: 'projectile',
    slot: 8,
    damage: 0,
    pellets: 1,
    spread: 0,
    fireIntervalTicks: 60,
    range: 0,
    magazine: 1,
    reserveMax: 8,
    pickupAmmo: 4,
    reloadTicks: 85,
    raiseTicks: 30,
    projectile: { speed: 30, gravity: 0, fuseSeconds: 4, splashRadius: 5, splashDamage: 120, splashEdgeDamage: 20, selfDamageScale: 0.6, visual: 'rocket', impactDamage: 30 },
    ammo: 'explosive',
    botDesirability: 0.8,
    botRange: [7, 40],
    view: { model: 'weapons/rockets.glb', viewOffset: [0.24, -0.24, 0.5], tracer: '#ffb347', hold: { style: 'long', grip: [0, -0.12, -0.18], support: [0, -0.1, 0.18], shoulder: [0, 0.02, -0.5] } },
  },
  'core.plasma': {
    id: 'core.plasma',
    displayName: 'Plasma Rifle',
    kind: 'projectile',
    slot: 9,
    damage: 0,
    pellets: 1,
    spread: 0.01,
    fireIntervalTicks: 7,
    range: 0,
    magazine: 40,
    reserveMax: 160,
    pickupAmmo: 60,
    reloadTicks: 90,
    raiseTicks: 20,
    projectile: { speed: 55, gravity: 0, fuseSeconds: 2, splashRadius: 1.2, splashDamage: 14, splashEdgeDamage: 8, selfDamageScale: 0.3, visual: 'plasma', impactDamage: 12 },
    ammo: 'cells',
    alt: {
      label: 'Charged orb',
      ammo: 'shared',
      cost: 8,
      fireIntervalTicks: 60,
      kind: 'projectile',
      projectile: { speed: 20, gravity: 0, fuseSeconds: 3, splashRadius: 4, splashDamage: 95, splashEdgeDamage: 20, selfDamageScale: 0.5, visual: 'orb', impactDamage: 20 },
    },
    botDesirability: 0.7,
    botRange: [3, 25],
    view: { model: 'weapons/plasma.glb', viewOffset: [0.21, -0.21, 0.52], tracer: '#7dffb0', hold: { style: 'long', grip: [0, -0.08, -0.25], support: [0, -0.06, 0.1], shoulder: [0, 0, -0.42] } },
  },
  ...arsenal(),
  ...mountWeapons(),
  // Added after the rest so existing weapon codes stay the same.
  'core.medkit': {
    id: 'core.medkit',
    displayName: 'Medkit',
    kind: 'melee',
    slot: 1,
    damage: 0,
    pellets: 1,
    spread: 0,
    fireIntervalTicks: 75,
    range: 3,
    magazine: 0,
    reserveMax: 0,
    pickupAmmo: 0,
    reloadTicks: 0,
    raiseTicks: 15,
    heal: 25,
    botDesirability: 0,
    botRange: [0, 0],
    view: { model: 'procedural/medkit', viewOffset: [0.2, -0.2, 0.42], tracer: '#ffffff', sound: 'pickup.health', hold: { style: 'pistol', grip: [0, -0.02, 0] } },
  },
  'core.grapple': {
    id: 'core.grapple',
    displayName: 'Grapple Hook',
    kind: 'melee',
    slot: 1,
    fireMode: 'semi',
    damage: 0,
    pellets: 1,
    spread: 0,
    fireIntervalTicks: 50,
    range: 32,
    magazine: 0,
    reserveMax: 0,
    pickupAmmo: 0,
    reloadTicks: 0,
    raiseTicks: 15,
    grapple: { speed: 17 },
    botDesirability: 0,
    botRange: [0, 0],
    view: sidearm('flare_gun', 0.32, '#d8d2c0', { sound: 'fire.flare' }),
  },
  'core.spear': {
    id: 'core.spear',
    displayName: 'Spear',
    kind: 'projectile',
    slot: 1,
    fireMode: 'semi',
    damage: 0,
    pellets: 1,
    spread: 0,
    fireIntervalTicks: 30,
    range: 60,
    magazine: 1,
    reserveMax: 0,
    pickupAmmo: 0,
    reloadTicks: 0,
    raiseTicks: 12,
    // One hit kills; it sticks where it lands until someone picks it up.
    projectile: { speed: 30, gravity: 9, fuseSeconds: 90, splashRadius: 0, splashDamage: 0, splashEdgeDamage: 0, selfDamageScale: 0, visual: 'spear', impactDamage: 250, sticky: 'world', retrievable: true },
    botDesirability: 0.6,
    botRange: [3, 30],
    view: { model: 'procedural/spear', viewOffset: [0.24, -0.16, 0.3], tracer: '#c8a46a', sound: 'throw', hold: { style: 'pistol', grip: [0, 0, 0] } },
  },
};

// Helpers are function declarations: CORE_WEAPONS calls arsenal() while the module is still loading.

/** Presentation for a one-handed weapon, with a third-person hold scaled to the model's length (m). */
function sidearm(model: string, len: number, tracer: string, extra: Partial<WeaponPresentation> = {}): WeaponPresentation {
  return { model: `weapons/${model}.glb`, viewOffset: [0.2, -0.18, 0.42], tracer, hold: { style: 'pistol', grip: [0, -0.03, -0.34 * len], support: [-0.02, -0.04, -0.3 * len] }, ...extra };
}

/** Presentation for a two-handed weapon, shouldered, with holds scaled to the model's length (m). */
function longarm(model: string, len: number, tracer: string, extra: Partial<WeaponPresentation> = {}): WeaponPresentation {
  return { model: `weapons/${model}.glb`, viewOffset: [0.21, -0.21, 0.52], tracer, hold: { style: 'long', grip: [0, -0.06, -0.3 * len], support: [0, -0.04, 0.12 * len], shoulder: [0, 0, -0.5 * len] }, ...extra };
}

/**
 * Guns on turrets and vehicles (slot 0: never carried or picked up). They run
 * on heat, so a gunner never reloads but has to pace the trigger.
 */
function mountWeapons(): Record<string, WeaponDefinition> {
  const list: WeaponDefinition[] = [
    weapon({
      id: 'core.mount_mg', displayName: 'Mounted MG', kind: 'hitscan', slot: 0,
      damage: 11, spread: 0.018, fireIntervalTicks: 4, range: 160, magazine: 0, reserveMax: 0, pickupAmmo: 0, reloadTicks: 0, raiseTicks: 0,
      heat: { perShot: 0.022, coolPerTick: 0.008 }, botDesirability: 0, botRange: [0, 80],
      view: { model: 'turrets/mg.glb', viewOffset: [0, -0.35, 0.7], tracer: '#ffd36b', hold: { style: 'long', grip: [0, 0, 0] }, sound: 'fire.rifle' },
    }),
    weapon({
      id: 'core.mount_rockets', displayName: 'Mounted Rockets', kind: 'projectile', slot: 0,
      fireIntervalTicks: 45, magazine: 0, reserveMax: 0, pickupAmmo: 0, reloadTicks: 0, raiseTicks: 0,
      heat: { perShot: 0.3, coolPerTick: 0.004 },
      projectile: { speed: 34, gravity: 0, fuseSeconds: 4, splashRadius: 5, splashDamage: 110, splashEdgeDamage: 20, selfDamageScale: 0.6, visual: 'rocket', impactDamage: 30 },
      botDesirability: 0, botRange: [0, 80],
      view: { model: 'turrets/rocket.glb', viewOffset: [0, -0.35, 0.7], tracer: '#ffb347', hold: { style: 'long', grip: [0, 0, 0] }, sound: 'fire.rockets' },
    }),
    weapon({
      id: 'core.speeder_guns', displayName: 'Speeder Blasters', kind: 'projectile', slot: 0,
      fireIntervalTicks: 7, magazine: 0, reserveMax: 0, pickupAmmo: 0, reloadTicks: 0, raiseTicks: 0, spread: 0.02,
      heat: { perShot: 0.05, coolPerTick: 0.01 },
      projectile: { speed: 70, gravity: 0, fuseSeconds: 1.5, splashRadius: 1.5, splashDamage: 16, splashEdgeDamage: 8, selfDamageScale: 0, visual: 'plasma', impactDamage: 10 },
      botDesirability: 0, botRange: [0, 60],
      view: { model: 'vehicles/speeder.glb', viewOffset: [0, -0.6, 1.4], tracer: '#7dffb0', hold: { style: 'long', grip: [0, 0, 0] }, sound: 'fire.plasma' },
    }),
    weapon({
      id: 'core.sentry_gun', displayName: 'Sentry Gun', kind: 'hitscan', slot: 0,
      damage: 7, spread: 0.03, fireIntervalTicks: 7, range: 40, magazine: 0, reserveMax: 0, pickupAmmo: 0, reloadTicks: 0, raiseTicks: 0,
      botDesirability: 0, botRange: [0, 30],
      view: { model: 'turrets/sentry.glb', viewOffset: [0, 0, 0], tracer: '#ff6a5a', hold: { style: 'long', grip: [0, 0, 0] }, sound: 'fire.smg' },
    }),
  ];
  return Object.fromEntries(list.map((w) => [w.id, w]));
}

/** Defaults every weapon below starts from. */
function weapon(d: Partial<WeaponDefinition> & Pick<WeaponDefinition, 'id' | 'displayName' | 'kind' | 'slot' | 'view'>): WeaponDefinition {
  return { damage: 0, pellets: 1, spread: 0, fireIntervalTicks: 10, range: 120, magazine: 10, reserveMax: 40, pickupAmmo: 20, reloadTicks: 80, raiseTicks: 20, botDesirability: 0.5, botRange: [3, 30], ...d };
}

/**
 * The extended arsenal: every one fires differently. Sidearms in 2, rifles
 * in 3, shotguns in 4, precision in 5, lobbers in 6, automatics in 7, heavy
 * weapons in 8 and energy and chemical weapons in 9; pressing a number again
 * cycles through what you carry in that slot.
 */
function arsenal(): Record<string, WeaponDefinition> {
  const list: WeaponDefinition[] = [
    // ---------------------------------------------------------------- 2: sidearms
    weapon({
      id: 'core.pulse_pistol', displayName: 'Pulse Pistol', kind: 'hitscan', slot: 2, fireMode: 'semi',
      damage: 24, spread: 0.004, fireIntervalTicks: 9, range: 110, magazine: 15, reserveMax: 90, pickupAmmo: 30, reloadTicks: 55, raiseTicks: 12,
      ammo: 'cells', recoil: { kick: 0.012, bloom: 0.004, maxBloom: 0.02, recover: 0.0015 }, botDesirability: 0.42, botRange: [2, 28],
      view: sidearm('pulse_pistol', 0.3, '#c69bff', { sound: 'fire.pulse', beam: true }),
    }),
    weapon({
      id: 'core.hand_cannon', displayName: 'Hand Cannon', kind: 'hitscan', slot: 2, fireMode: 'semi',
      damage: 58, spread: 0.002, fireIntervalTicks: 30, range: 140, magazine: 6, reserveMax: 36, pickupAmmo: 12, reloadTicks: 100, raiseTicks: 22,
      ammo: 'light', knockback: 3, recoil: { kick: 0.09, bloom: 0.03, maxBloom: 0.05, recover: 0.0012 }, botDesirability: 0.55, botRange: [3, 35],
      view: sidearm('hand_cannon', 0.34, '#ffd08a', { sound: 'fire.heavy' }),
    }),
    weapon({
      id: 'core.gilded_pistol', displayName: 'Gilded Pistol', kind: 'hitscan', slot: 2, fireMode: 'semi',
      damage: 999, spread: 0, fireIntervalTicks: 45, range: 160, magazine: 1, reserveMax: 6, pickupAmmo: 3, reloadTicks: 85, raiseTicks: 25,
      ammo: 'light', recoil: { kick: 0.05, bloom: 0, maxBloom: 0, recover: 0 }, botDesirability: 0.9, botRange: [2, 40],
      view: sidearm('gilded_pistol', 0.24, '#ffe070', { sound: 'fire.heavy' }),
    }),
    weapon({
      id: 'core.flare_gun', displayName: 'Flare Gun', kind: 'projectile', slot: 2, fireMode: 'semi',
      fireIntervalTicks: 40, magazine: 1, reserveMax: 10, pickupAmmo: 4, reloadTicks: 50, raiseTicks: 15, ammo: 'fuel',
      projectile: { speed: 30, gravity: 9, fuseSeconds: 5, splashRadius: 1.6, splashDamage: 25, splashEdgeDamage: 10, selfDamageScale: 0.3, visual: 'flare', impactDamage: 20, sticky: 'any', status: { kind: 'burn', seconds: 4 }, zone: { kind: 'fire', radius: 1.8, seconds: 4 }, ignites: true },
      botDesirability: 0.45, botRange: [5, 25],
      view: sidearm('flare_gun', 0.32, '#ff7a3a', { sound: 'fire.flare' }),
    }),
    weapon({
      id: 'core.machine_pistol', displayName: 'Machine Pistol', kind: 'hitscan', slot: 2,
      damage: 7, spread: 0.03, fireIntervalTicks: 3, range: 60, magazine: 24, reserveMax: 144, pickupAmmo: 48, reloadTicks: 60, raiseTicks: 12,
      ammo: 'light', recoil: { kick: 0.008, bloom: 0.006, maxBloom: 0.07, recover: 0.002 }, botDesirability: 0.5, botRange: [0, 14],
      view: sidearm('machine_pistol', 0.38, '#ffe9a8', { sound: 'fire.smg' }),
    }),
    // ---------------------------------------------------------------- 3: rifles
    weapon({
      id: 'core.burst_rifle', displayName: 'Burst Rifle', kind: 'hitscan', slot: 3, fireMode: 'burst', burst: { count: 3, intervalTicks: 4 },
      damage: 17, spread: 0.008, fireIntervalTicks: 24, range: 160, magazine: 24, reserveMax: 144, pickupAmmo: 48, reloadTicks: 85, raiseTicks: 20,
      ammo: 'rifle', recoil: { kick: 0.018, bloom: 0.006, maxBloom: 0.03, recover: 0.002 }, botDesirability: 0.68, botRange: [5, 45],
      view: longarm('burst_rifle', 0.75, '#ffd36b', { sound: 'fire.rifle' }),
    }),
    weapon({
      id: 'core.laser_rifle', displayName: 'Laser Rifle', kind: 'hitscan', slot: 3,
      damage: 4, spread: 0, fireIntervalTicks: 2, range: 90, magazine: 0, reserveMax: 0, pickupAmmo: 0, reloadTicks: 0, raiseTicks: 20,
      heat: { perShot: 0.022, coolPerTick: 0.01 }, botDesirability: 0.66, botRange: [3, 40],
      view: longarm('laser_rifle', 0.95, '#ff3b4a', { sound: 'fire.laser', beam: true }),
    }),
    weapon({
      id: 'core.marksman', displayName: 'Marksman Rifle', kind: 'hitscan', slot: 3, fireMode: 'semi',
      damage: 38, spread: 0.001, fireIntervalTicks: 14, range: 220, magazine: 10, reserveMax: 40, pickupAmmo: 20, reloadTicks: 90, raiseTicks: 22,
      ammo: 'sniper', recoil: { kick: 0.035, bloom: 0.01, maxBloom: 0.03, recover: 0.0015 }, botDesirability: 0.6, botRange: [12, 90],
      view: longarm('marksman', 1.05, '#bfe4ff', { zoomFov: 0.7, sound: 'fire.sniper' }),
    }),
    // ---------------------------------------------------------------- 4: shotguns
    weapon({
      id: 'core.sawed_off', displayName: 'Sawed-Off', kind: 'hitscan', slot: 4, fireMode: 'semi',
      damage: 8, pellets: 14, spread: 0.15, fireIntervalTicks: 14, range: 25, magazine: 2, reserveMax: 30, pickupAmmo: 10, reloadTicks: 70, raiseTicks: 14,
      ammo: 'shells', knockback: 1.2, recoil: { kick: 0.08, bloom: 0, maxBloom: 0, recover: 0 }, botDesirability: 0.62, botRange: [0, 6],
      view: longarm('sawed_off', 0.55, '#ffb38a', { sound: 'fire.shotgun' }),
    }),
    weapon({
      id: 'core.auto_shotgun', displayName: 'Auto Shotgun', kind: 'hitscan', slot: 4,
      damage: 7, pellets: 7, spread: 0.09, fireIntervalTicks: 18, range: 40, magazine: 8, reserveMax: 40, pickupAmmo: 16, reloadTicks: 100, raiseTicks: 22,
      ammo: 'shells', recoil: { kick: 0.045, bloom: 0.012, maxBloom: 0.04, recover: 0.0015 }, botDesirability: 0.64, botRange: [0, 10],
      view: longarm('auto_shotgun', 0.9, '#ffb38a', { sound: 'fire.shotgun' }),
    }),
    weapon({
      id: 'core.flak', displayName: 'Flak Cannon', kind: 'projectile', slot: 4, pellets: 7, spread: 0.08,
      fireIntervalTicks: 50, magazine: 4, reserveMax: 24, pickupAmmo: 8, reloadTicks: 95, raiseTicks: 24, ammo: 'shells',
      projectile: { speed: 48, gravity: 6, fuseSeconds: 1.2, splashRadius: 0, splashDamage: 0, splashEdgeDamage: 0, selfDamageScale: 0, visual: 'shard', impactDamage: 13, bounce: 0.65, maxBounces: 2 },
      botDesirability: 0.62, botRange: [0, 14],
      view: longarm('flak', 0.7, '#ffcf6a', { sound: 'fire.flak' }),
    }),
    // ---------------------------------------------------------------- 5: precision
    weapon({
      // Charges briefly, then one body hit kills an unarmoured player.
      id: 'core.railgun', displayName: 'Railgun', kind: 'hitscan', slot: 5, windupTicks: 24, windupResets: true,
      damage: 100, spread: 0, fireIntervalTicks: 40, range: 320, magazine: 4, reserveMax: 16, pickupAmmo: 8, reloadTicks: 110, raiseTicks: 28,
      ammo: 'cells', pierce: 3, knockback: 6, recoil: { kick: 0.09, bloom: 0, maxBloom: 0, recover: 0 }, botDesirability: 0.7, botRange: [15, 150],
      view: longarm('railgun', 1.1, '#5fe0ff', { zoomFov: 0.5, sound: 'fire.railgun', beam: true }),
    }),
    // ---------------------------------------------------------------- 6: lobbers
    weapon({
      id: 'core.disc_launcher', displayName: 'Disc Launcher', kind: 'projectile', slot: 6,
      fireIntervalTicks: 50, magazine: 3, reserveMax: 18, pickupAmmo: 6, reloadTicks: 90, raiseTicks: 26, ammo: 'explosive',
      projectile: { speed: 34, gravity: 0, fuseSeconds: 3, splashRadius: 3.8, splashDamage: 75, splashEdgeDamage: 10, selfDamageScale: 0.45, visual: 'disc', impactDamage: 25, knockback: 10 },
      botDesirability: 0.72, botRange: [6, 35],
      view: longarm('disc_launcher', 0.85, '#7ad6ff', { sound: 'fire.disc' }),
    }),
    weapon({
      id: 'core.bubble_blaster', displayName: 'Bubble Blaster', kind: 'projectile', slot: 6,
      fireIntervalTicks: 22, magazine: 6, reserveMax: 30, pickupAmmo: 12, reloadTicks: 80, raiseTicks: 20, ammo: 'chem',
      projectile: { speed: 10, gravity: -0.6, drag: 0.12, fuseSeconds: 7, splashRadius: 2.4, splashDamage: 22, splashEdgeDamage: 8, selfDamageScale: 0.5, visual: 'bubble', bounce: 0.95, maxBounces: 7, zone: { kind: 'toxic', radius: 3, seconds: 5 }, status: { kind: 'poison', seconds: 3 } },
      botDesirability: 0.5, botRange: [3, 16],
      view: longarm('bubble_blaster', 0.55, '#7dff6a', { sound: 'fire.bubble' }),
    }),
    weapon({
      id: 'core.goo_gun', displayName: 'Goo Gun', kind: 'projectile', slot: 6,
      fireIntervalTicks: 12, magazine: 20, reserveMax: 80, pickupAmmo: 30, reloadTicks: 75, raiseTicks: 18, ammo: 'chem',
      projectile: { speed: 22, gravity: 12, fuseSeconds: 3, splashRadius: 1.8, splashDamage: 10, splashEdgeDamage: 6, selfDamageScale: 0, visual: 'goo', impactDamage: 8, zone: { kind: 'goo', radius: 2.4, seconds: 7 }, status: { kind: 'slow', seconds: 2.5 } },
      botDesirability: 0.45, botRange: [3, 20],
      view: sidearm('goo_gun', 0.42, '#ff6ad0', { sound: 'fire.goo' }),
    }),
    weapon({
      id: 'core.oil_slicker', displayName: 'Oil Slicker', kind: 'projectile', slot: 6,
      fireIntervalTicks: 10, magazine: 12, reserveMax: 48, pickupAmmo: 24, reloadTicks: 70, raiseTicks: 18, ammo: 'fuel',
      projectile: { speed: 17, gravity: 12, fuseSeconds: 3, splashRadius: 0, splashDamage: 0, splashEdgeDamage: 0, selfDamageScale: 0, visual: 'oil', zone: { kind: 'oil', radius: 3, seconds: 16 } },
      alt: {
        label: 'Igniter', ammo: 'shared', cost: 2, fireIntervalTicks: 30, kind: 'projectile',
        projectile: { speed: 26, gravity: 8, fuseSeconds: 3, splashRadius: 1.4, splashDamage: 12, splashEdgeDamage: 6, selfDamageScale: 0.3, visual: 'flare', ignites: true, status: { kind: 'burn', seconds: 3 }, zone: { kind: 'fire', radius: 1.5, seconds: 3 } },
      },
      botDesirability: 0.3, botRange: [4, 16],
      view: sidearm('oil_slicker', 0.45, '#8a7a5a', { sound: 'fire.goo' }),
    }),
    // ---------------------------------------------------------------- 7: automatics
    weapon({
      id: 'core.lmg', displayName: 'Spin Gun', kind: 'hitscan', slot: 7, windupTicks: 28,
      damage: 9, spread: 0.035, fireIntervalTicks: 3, range: 110, magazine: 120, reserveMax: 240, pickupAmmo: 120, reloadTicks: 150, raiseTicks: 40,
      ammo: 'rifle', recoil: { kick: 0.006, bloom: 0.002, maxBloom: 0.04, recover: 0.001 }, botDesirability: 0.72, botRange: [3, 40],
      view: longarm('lmg', 1.0, '#ffd36b', { sound: 'fire.smg' }),
    }),
    weapon({
      id: 'core.nailgun', displayName: 'Nailgun', kind: 'projectile', slot: 7, spread: 0.02,
      fireIntervalTicks: 5, magazine: 50, reserveMax: 200, pickupAmmo: 60, reloadTicks: 80, raiseTicks: 18, ammo: 'light',
      projectile: { speed: 75, gravity: 2, fuseSeconds: 1.5, splashRadius: 0, splashDamage: 0, splashEdgeDamage: 0, selfDamageScale: 0, visual: 'nail', impactDamage: 11, bounce: 0.75, maxBounces: 2 },
      botDesirability: 0.6, botRange: [2, 25],
      view: longarm('nailgun', 0.6, '#d8d8d8', { sound: 'fire.nail' }),
    }),
    // ---------------------------------------------------------------- 8: heavy
    weapon({
      id: 'core.swarm', displayName: 'Swarm Launcher', kind: 'projectile', slot: 8, pellets: 4, spread: 0.14,
      fireIntervalTicks: 70, magazine: 4, reserveMax: 12, pickupAmmo: 4, reloadTicks: 100, raiseTicks: 30, ammo: 'explosive',
      projectile: { speed: 20, gravity: 0, fuseSeconds: 4, splashRadius: 2.6, splashDamage: 40, splashEdgeDamage: 8, selfDamageScale: 0.5, visual: 'swarm', impactDamage: 10, homing: { turnRate: 2.6, range: 45 } },
      botDesirability: 0.78, botRange: [8, 45],
      view: longarm('swarm', 0.6, '#ffb347', { sound: 'fire.swarm' }),
    }),
    weapon({
      // Laser-guided: the rocket flies wherever you keep your crosshair. Slow, so steer it round corners.
      id: 'core.guided', displayName: 'Guided Rocket', kind: 'projectile', slot: 8, fireMode: 'semi',
      fireIntervalTicks: 75, magazine: 1, reserveMax: 6, pickupAmmo: 3, reloadTicks: 90, raiseTicks: 32, ammo: 'explosive',
      projectile: { speed: 17, gravity: 0, fuseSeconds: 8, splashRadius: 5, splashDamage: 130, splashEdgeDamage: 20, selfDamageScale: 0.6, visual: 'rocket', impactDamage: 35, guided: { turnRate: 3.2 } },
      botDesirability: 0.7, botRange: [10, 60],
      view: { model: 'weapons/rockets.glb', viewOffset: [0.24, -0.24, 0.5], tracer: '#ff4a3a', sound: 'fire.rockets', hold: { style: 'long', grip: [0, -0.12, -0.18], support: [0, -0.1, 0.18], shoulder: [0, 0.02, -0.5] } },
    }),
    weapon({
      id: 'core.singularity', displayName: 'Singularity Cannon', kind: 'projectile', slot: 8, fireMode: 'semi',
      fireIntervalTicks: 90, magazine: 1, reserveMax: 4, pickupAmmo: 2, reloadTicks: 110, raiseTicks: 34, ammo: 'cells',
      projectile: { speed: 13, gravity: 0, fuseSeconds: 1.6, splashRadius: 1, splashDamage: 0, splashEdgeDamage: 0, selfDamageScale: 0, visual: 'vortex', zone: { kind: 'singularity', radius: 8, seconds: 2.4 } },
      botDesirability: 0.65, botRange: [8, 30],
      view: longarm('singularity', 0.75, '#b07aff', { sound: 'fire.vortex' }),
    }),
    // ---------------------------------------------------------------- 9: energy and chemical
    weapon({
      id: 'core.arc_caster', displayName: 'Arc Caster', kind: 'hitscan', slot: 9,
      damage: 15, spread: 0.01, fireIntervalTicks: 9, range: 32, magazine: 0, reserveMax: 0, pickupAmmo: 0, reloadTicks: 0, raiseTicks: 20,
      heat: { perShot: 0.08, coolPerTick: 0.009 }, chain: { jumps: 3, range: 9, falloff: 0.7 }, botDesirability: 0.62, botRange: [2, 25],
      view: longarm('arc_caster', 0.8, '#9fd8ff', { sound: 'fire.arc', beam: true }),
    }),
    weapon({
      id: 'core.flamethrower', displayName: 'Flamethrower', kind: 'projectile', slot: 9, spread: 0.05,
      fireIntervalTicks: 3, magazine: 100, reserveMax: 200, pickupAmmo: 100, reloadTicks: 110, raiseTicks: 24, ammo: 'fuel',
      projectile: { speed: 17, gravity: -2, drag: 1.2, fuseSeconds: 0.55, splashRadius: 1.4, splashDamage: 5, splashEdgeDamage: 3, selfDamageScale: 0, visual: 'flame', impactDamage: 3, status: { kind: 'burn', seconds: 3 }, ignites: true },
      botDesirability: 0.58, botRange: [0, 8],
      view: longarm('flamethrower', 0.85, '#ff8a2a', { sound: 'fire.flame' }),
    }),
    weapon({
      id: 'core.freeze_ray', displayName: 'Freeze Ray', kind: 'hitscan', slot: 9,
      damage: 3, spread: 0, fireIntervalTicks: 3, range: 40, magazine: 0, reserveMax: 0, pickupAmmo: 0, reloadTicks: 0, raiseTicks: 20,
      heat: { perShot: 0.018, coolPerTick: 0.01 }, status: { kind: 'chill', seconds: 2, amount: 0.07 }, botDesirability: 0.5, botRange: [2, 30],
      view: sidearm('freeze_ray', 0.45, '#bff0ff', { sound: 'fire.freeze', beam: true }),
    }),
  ];
  return Object.fromEntries(list.map((w) => [w.id, w]));
}

/** Thrown equipment (G): one kind carried at a time, with a count. */
export const THROWABLES = ['frag', 'mine', 'sticky', 'incendiary', 'toxic', 'vortex', 'holy', 'cluster', 'sheep', 'airstrike', 'sandbag'] as const;
export type ThrowableKind = (typeof THROWABLES)[number];
export interface ThrowableDefinition {
  kind: ThrowableKind;
  displayName: string;
  max: number;
  throwIntervalTicks: number;
  projectile: ProjectileSpec;
}
export const THROWABLE_DEFS: Record<ThrowableKind, ThrowableDefinition> = {
  frag: {
    kind: 'frag',
    displayName: 'Frag Grenade',
    max: 4,
    throwIntervalTicks: 45,
    projectile: { speed: 16, gravity: 14, fuseSeconds: 2.5, splashRadius: 4.5, splashDamage: 100, splashEdgeDamage: 15, selfDamageScale: 0.8, visual: 'frag', bounce: 0.45 },
  },
  mine: {
    kind: 'mine',
    displayName: 'Proximity Mine',
    max: 3,
    throwIntervalTicks: 45,
    projectile: { speed: 11, gravity: 14, fuseSeconds: 90, splashRadius: 4, splashDamage: 110, splashEdgeDamage: 15, selfDamageScale: 0.8, visual: 'mine', mine: { armSeconds: 1.2, triggerRadius: 2.2 } },
  },
  sticky: {
    kind: 'sticky',
    displayName: 'Sticky Grenade',
    max: 3,
    throwIntervalTicks: 45,
    projectile: { speed: 17, gravity: 12, fuseSeconds: 2, splashRadius: 4, splashDamage: 115, splashEdgeDamage: 15, selfDamageScale: 0.8, visual: 'sticky', sticky: 'any' },
  },
  incendiary: {
    kind: 'incendiary',
    displayName: 'Incendiary',
    max: 3,
    throwIntervalTicks: 45,
    projectile: { speed: 15, gravity: 14, fuseSeconds: 1.6, splashRadius: 2.5, splashDamage: 25, splashEdgeDamage: 10, selfDamageScale: 0.5, visual: 'molotov', ignites: true, status: { kind: 'burn', seconds: 4 }, zone: { kind: 'fire', radius: 4, seconds: 7 } },
  },
  toxic: {
    kind: 'toxic',
    displayName: 'Gas Grenade',
    max: 3,
    throwIntervalTicks: 45,
    projectile: { speed: 15, gravity: 14, fuseSeconds: 1.8, splashRadius: 0, splashDamage: 0, splashEdgeDamage: 0, selfDamageScale: 0, visual: 'gas', bounce: 0.4, zone: { kind: 'toxic', radius: 4.5, seconds: 9 } },
  },
  vortex: {
    kind: 'vortex',
    displayName: 'Vortex Grenade',
    max: 2,
    throwIntervalTicks: 60,
    projectile: { speed: 15, gravity: 14, fuseSeconds: 1.5, splashRadius: 0, splashDamage: 0, splashEdgeDamage: 0, selfDamageScale: 0, visual: 'vortex', bounce: 0.3, zone: { kind: 'singularity', radius: 7, seconds: 2 } },
  },
  // ---------------------------------------------------------------- Worms-style specials
  holy: {
    kind: 'holy',
    displayName: 'Holy Bomb',
    max: 1,
    throwIntervalTicks: 90,
    // Heavy, slow fuse, enormous blast: get well clear.
    projectile: { speed: 12, gravity: 16, fuseSeconds: 3, splashRadius: 9, splashDamage: 200, splashEdgeDamage: 30, selfDamageScale: 1, visual: 'holy', bounce: 0.25, knockback: 16 },
  },
  cluster: {
    kind: 'cluster',
    displayName: 'Cluster Bomb',
    max: 2,
    throwIntervalTicks: 60,
    projectile: {
      speed: 15, gravity: 14, fuseSeconds: 2.2, splashRadius: 3, splashDamage: 50, splashEdgeDamage: 10, selfDamageScale: 0.8, visual: 'banana', bounce: 0.4,
      cluster: { count: 6, speed: 7, spec: { speed: 7, gravity: 14, fuseSeconds: 1.4, splashRadius: 3, splashDamage: 55, splashEdgeDamage: 8, selfDamageScale: 0.8, visual: 'bomblet', bounce: 0.35, maxBounces: 1 } },
    },
  },
  sheep: {
    kind: 'sheep',
    displayName: 'Sheep',
    max: 1,
    throwIntervalTicks: 90,
    // Lands, waddles off the way it was thrown, hops over low things, and goes off on the first enemy it bumps into.
    projectile: { speed: 9, gravity: 14, fuseSeconds: 7, splashRadius: 5, splashDamage: 130, splashEdgeDamage: 20, selfDamageScale: 0.8, visual: 'sheep', walker: { speed: 3.2 }, knockback: 10 },
  },
  airstrike: {
    kind: 'airstrike',
    displayName: 'Airstrike Flare',
    max: 1,
    throwIntervalTicks: 120,
    // A flare that marks the spot: two seconds later five bombs fall in a line along the way you threw it.
    projectile: {
      speed: 14, gravity: 14, fuseSeconds: 2, splashRadius: 0, splashDamage: 0, splashEdgeDamage: 0, selfDamageScale: 0, visual: 'flare', bounce: 0.3,
      airstrike: { count: 5, spacing: 3.5, height: 30, bomb: { speed: 0, gravity: 20, fuseSeconds: 4, splashRadius: 4.5, splashDamage: 110, splashEdgeDamage: 15, selfDamageScale: 0.8, visual: 'bomb' } },
    },
  },
  sandbag: {
    kind: 'sandbag',
    displayName: 'Sandbags',
    max: 3,
    throwIntervalTicks: 40,
    // Tossed a few metres ahead; where it lands it becomes a waist-high wall facing you.
    projectile: { speed: 7, gravity: 16, fuseSeconds: 1.5, splashRadius: 0, splashDamage: 0, splashEdgeDamage: 0, selfDamageScale: 0, visual: 'sandbag', cover: { half: [0.95, 0.5, 0.3], health: 300 } },
  },
};
/** Weapon IDs used for kill credit of thrown equipment. */
export const throwableWeaponId = (k: ThrowableKind): string => `core.${k}`;

export function getWeapon(id: string): WeaponDefinition {
  const w = CORE_WEAPONS[id];
  if (!w) throw new Error(`unknown weapon ${id}`);
  return w;
}

/** Weapons ordered by slot (then definition order), for switching and HUD. */
export const WEAPONS_BY_SLOT: readonly WeaponDefinition[] = Object.values(CORE_WEAPONS)
  .map((w, i) => [w, i] as const)
  .filter(([w]) => w.slot > 0)
  .sort((a, b) => a[0].slot - b[0].slot || a[1] - b[1])
  .map(([w]) => w);

/**
 * Every weapon has a small number code (1-based, in definition order) used on
 * the wire and as the inventory key: several weapons share a slot (the number
 * key cycles through them), so the slot can't identify a weapon.
 */
const WEAPON_LIST: readonly WeaponDefinition[] = Object.values(CORE_WEAPONS);
const CODES = new Map(WEAPON_LIST.map((w, i) => [w.id, i + 1]));
export const weaponCode = (def: Pick<WeaponDefinition, 'id'>): number => CODES.get(def.id) ?? 0;
export const weaponByCode = (code: number): WeaponDefinition | undefined => WEAPON_LIST[code - 1];

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
  /** Body height (crouching and prone players are shorter); standing when absent. */
  height?: number;
  /** Body radius (small and large characters); standard when absent. */
  radius?: number;
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
/** Where a shot landed on a body: 0 torso and arms, 1 head, 2 legs. */
export type HitZone = 0 | 1 | 2;
/** Head hits hurt double (sniper rifles more); leg hits a bit less. */
export const HEAD_MULTIPLIER = 2;
export const LEG_MULTIPLIER = 0.75;

/** The body zone at height `y` on a player standing at `feet` (`height` tall). */
export function hitZone(feet: Vec3, y: number, height: number = PLAYER.height): HitZone {
  const up = y - feet.y;
  if (up >= height - 0.32) return 1;
  if (up < height * 0.47) return 2;
  return 0;
}

export function zoneMultiplier(zone: HitZone, headshot: number = HEAD_MULTIPLIER): number {
  return zone === 1 ? headshot : zone === 2 ? LEG_MULTIPLIER : 1;
}

export function resolveHitscan(origin: Vec3, dir: Vec3, range: number, worldDistance: number | null, targets: readonly ShotTarget[]): ShotResult {
  let distance = worldDistance ?? range;
  let hitSlot: number | null = null;
  for (const t of targets) {
    const d = rayCapsule(origin, dir, t.feet, t.radius ?? PLAYER.radius, t.height ?? PLAYER.height);
    if (d !== null && d < distance) {
      distance = d;
      hitSlot = t.slot;
    }
  }
  return { hitSlot, distance, end: add(origin, scale(dir, distance)) };
}
