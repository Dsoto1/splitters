import { add, dot, scale, type Vec3 } from '../math.ts';
import { PLAYER } from './constants.ts';

export type WeaponKind = 'hitscan' | 'projectile' | 'melee';

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
    projectile: { speed: 26, gravity: 12, fuseSeconds: 3, splashRadius: 4.5, splashDamage: 100, splashEdgeDamage: 15, selfDamageScale: 0.6 },
    botDesirability: 0.75,
    botRange: [6, 22],
    view: { model: 'weapons/launcher.glb', viewOffset: [0.22, -0.22, 0.55], tracer: '#c2c9a8', hold: { style: 'long', grip: [0, -0.1, -0.33], support: [0, -0.08, 0.02], shoulder: [0, 0, -0.45] } },
  },
};

export function getWeapon(id: string): WeaponDefinition {
  const w = CORE_WEAPONS[id];
  if (!w) throw new Error(`unknown weapon ${id}`);
  return w;
}

/** Weapons ordered by slot, for switching and HUD. */
export const WEAPONS_BY_SLOT: readonly WeaponDefinition[] = Object.values(CORE_WEAPONS).sort((a, b) => a.slot - b.slot);

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
