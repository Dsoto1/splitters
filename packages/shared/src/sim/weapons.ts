import { add, dot, scale, type Vec3, hypot } from '../math.ts';
import { PLAYER, type Stance } from './constants.ts';
import { lastHit, rayBody, type HitBody, type LookHitbox } from './hitbox.ts';
import type { AccuracySpec, BallisticSpec, FalloffSpec, KickSpec, ReloadSpec, WeaponFamily } from './gunplay.ts';
import { CORE_WEAPONS, THROWABLES, THROWABLE_DEFS, WEAPON_CODES } from '../content/weapons.generated.ts';

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
  'holy', 'banana', 'sheep', 'bomblet', 'bomb', 'sandbag', 'spear', 'dynamite',
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
  if (kind === 'toxic' || kind === 'singularity') return hypot(center.x - feet.x, center.y - (feet.y + PLAYER.height * 0.55), center.z - feet.z) <= radius;
  return hypot(center.x - feet.x, center.z - feet.z) <= radius && feet.y >= center.y - 0.6 && feet.y <= center.y + 1.5;
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
  /**
   * Arena discs (Disc Arena): no damage. A hit shoves the player `push` m/s
   * away (and `lift` m/s up). Then, or when its fuse runs out or it has bounced
   * `maxBounces` times, it drops to the ground for anyone to pick up (back to
   * its thrower over the void, or left lying 15 s). `split`: the
   * first bounce splits it in three.
   */
  disc?: { push: number; lift: number; split?: boolean };
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
  /** Hitscan reach (m); absent: the weapon's own range (a melee weapon's barrel needs its own). */
  range?: number;
  projectile?: ProjectileSpec;
  /**
   * Own rounds loaded one at a time (cosmetic open, `each` per round, close; ticks) from the
   * weapon's reserve (`reserveMax` / `pickupAmmo` / `ammo` of the weapon), up to `max`: the
   * Battle Axe's barrel. The reload key and an empty trigger start it. Absent: own rounds only
   * come from pickups (an underbarrel grenade).
   */
  reload?: { start: number; each: number; end: number };
  /** Mechanical recoil of this trigger (absent: none); a melee weapon also settles by it. */
  kick?: KickSpec;
  /** Damage over distance for this trigger's hitscan (absent: the weapon's own). */
  falloff?: FalloffSpec;
  /** Head multiple for this trigger's hitscan (absent: the weapon's own). */
  headshot?: number;
}

/** First-person and third-person presentation (client only; the server ignores it). */
export interface WeaponPresentation {
  /** Built model path under /models (see content/models.json, content/guns.json). */
  model: string;
  /** The model drawn instead when `model` fails to load (the one it replaced: built from the repo, always there). */
  fallback?: string;
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
  /** Muzzle flash: an effect of public/vfx/muzzle_flash.json and its size (default: by family, client game/muzzleFlash.ts). */
  muzzle?: { effect: string; scale?: number };
  /** Where the muzzle is on the model (default: the front of its bounds, a little above the middle). */
  muzzleAt?: ModelPoint;
  /**
   * The second trigger's shot when it isn't the weapon's own (a melee weapon's barrel): its
   * sound and playback rate, its flash, and how much smoke it leaves (0..1.5, a puff cloud).
   */
  altShot?: { sound: string; rate?: number; flash: { effect: string; scale?: number }; smoke?: number };
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

/**
 * Legacy spread bloom per shot (the exotic arsenal's, before the gunplay pass); bloom recovers while not firing.
 * Its camera kick is now the weapon's `kick`.
 */
export interface Recoil {
  /** Spread added per shot (radians), up to `maxBloom`. */
  bloom: number;
  maxBloom: number;
  /** Bloom recovered per tick. */
  recover: number;
}

/**
 * Weapon categories, for random weapon pickups (a pickup set to "Random from
 * category", or every weapon pickup when the host mixes them up, rolls a
 * weapon of one category each time it comes back). Tools (medkit, grapple,
 * builder), mode-only weapons and mounted guns have none and never roll.
 */
export const WEAPON_CATEGORIES = ['pistol', 'smg', 'rifle', 'shotgun', 'sniper', 'explosive', 'melee', 'special'] as const;
export type WeaponCategory = (typeof WEAPON_CATEGORIES)[number];
export const WEAPON_CATEGORY_LABELS: Record<WeaponCategory, string> = {
  pistol: 'Pistols',
  smg: 'SMGs and machine guns',
  rifle: 'Rifles',
  shotgun: 'Shotguns',
  sniper: 'Snipers',
  explosive: 'Explosives',
  melee: 'Melee',
  special: 'Specials',
};
export const isWeaponCategory = (v: unknown): v is WeaponCategory => typeof v === 'string' && (WEAPON_CATEGORIES as readonly string[]).includes(v);

/** Data-driven weapon definition (v1 spec §5.2). Gameplay code never names a specific weapon. */
export interface WeaponDefinition {
  id: string;
  displayName: string;
  kind: WeaponKind;
  /** What random weapon pickups roll it as (absent: tools, mode-only weapons and mounted guns, which never roll). */
  category?: WeaponCategory;
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
  /** Hitscan push on the target (m/s), with a little lift: a deliberate shove on top of stopping power. */
  knockback?: number;
  /**
   * Stopping power 0..1 (sim/impact.ts): the small shove along the shot, the brief slow and the
   * flinch a hit gives. Default: by category (a pistol barely, a shotgun or sniper noticeably).
   */
  stoppingPower?: number;
  /** Damage multiplier for a head hit (default HEAD_MULTIPLIER; 1 for weapons that don't care where they land). */
  headshot?: number;
  /** Damage multiplier for a leg hit (default: the family's, else LEG_MULTIPLIER). */
  legshot?: number;
  /**
   * Legacy spread bloom, for weapons without a gunplay family (the exotic arsenal: their spread can't be moved to
   * `accuracy` without changing it). Family weapons use `accuracy`; their `maxBloom` only sets bots' burst length.
   */
  recoil?: Recoil;
  // ---- Gunplay (docs/GUNPLAY_SPEC.md §35; see sim/gunplay.ts). Each field overrides the family's default.
  /** Weapon family: velocity, spread, recoil, falloff and body-zone defaults. */
  family?: WeaponFamily;
  /** Ballistic bullets (hitscan weapons with a bullet family fly by default); null forces hitscan. */
  ballistic?: Partial<BallisticSpec> | null;
  /** Spread model: base / movement / air / sustained growth / max / recovery / ADS. */
  accuracy?: Partial<AccuracySpec>;
  /** Mechanical recoil pattern and recovery, plus visual kick strength. */
  kick?: Partial<KickSpec>;
  /** Staged magazine or round-by-round reloads (default: one magazine swap of `reloadTicks`). */
  reload?: ReloadSpec;
  /** Damage falloff over distance. */
  falloff?: FalloffSpec;
  /** AI: 0..1 general preference and the distance band (m) it is best at. */
  botDesirability: number;
  botRange: [number, number];
  view: WeaponPresentation;
}

/**
 * Every weapon, in network-code order. The data is content/weapons/*.json (families.json holds the defaults and the
 * gunplay families), built by tools/content/weapons.mjs; how to add one: docs/CONTENT_PIPELINE.md.
 */
export { CORE_WEAPONS };

/**
 * Thrown equipment (G): one kind carried at a time, with a count. The data is content/throwables.json (a snapshot
 * sends a kind's code: its index in THROWABLES), built by tools/content/weapons.mjs.
 */
export { THROWABLES, THROWABLE_DEFS };
export type ThrowableKind = (typeof THROWABLES)[number];
export interface ThrowableDefinition {
  kind: ThrowableKind;
  displayName: string;
  max: number;
  throwIntervalTicks: number;
  projectile: ProjectileSpec;
}
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
 * Every weapon has a small number code (from 1, its file's `code`) used on
 * the wire and as the inventory key: several weapons share a slot (the number
 * key cycles through them), so the slot can't identify a weapon. Codes never
 * change and are never reused (content/codes.lock.json).
 */
let byCode: Map<number, WeaponDefinition> | undefined; // built on first use (as in serverRules.ts): the menu sends no weapons
export const weaponCode = (def: Pick<WeaponDefinition, 'id'>): number => WEAPON_CODES[def.id] ?? 0;
export const weaponByCode = (code: number): WeaponDefinition | undefined => (byCode ??= new Map(Object.values(CORE_WEAPONS).map((w) => [WEAPON_CODES[w.id]!, w]))).get(code);

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
  /** Body height (crouching and prone players are shorter); standing when absent. Only used without `box`. */
  height?: number;
  /** Body radius (small and large characters); standard when absent. Only used without `box`. */
  radius?: number;
  /** The body's measured hit shapes (sim/hitbox.ts), facing `yaw` in `stance` at `scale`: what shots are tested against. */
  box?: LookHitbox;
  yaw?: number;
  stance?: Stance;
  scale?: number;
}

export interface ShotResult {
  hitSlot: number | null;
  distance: number;
  end: Vec3;
  /** Where on the body the shot landed (0 when nothing was hit). */
  zone: HitZone;
}

/** A shot target against its measured shapes (or, for a target given without them, the standard look's): distance, or null; the zone in `lastHit.zone`. */
export function rayTarget(origin: Vec3, dir: Vec3, t: ShotTarget, max = Infinity, thick = 0): number | null {
  if (!t.box) {
    const d = rayCapsule(origin, dir, t.feet, t.radius ?? PLAYER.radius, t.height ?? PLAYER.height);
    if (d === null || d > max) return null;
    lastHit.zone = hitZone(t.feet, origin.y + dir.y * d, t.height ?? PLAYER.height);
    return d;
  }
  scratchBody.feet = t.feet;
  scratchBody.yaw = t.yaw ?? 0;
  scratchBody.stance = t.stance ?? 0;
  scratchBody.scale = t.scale ?? 1;
  scratchBody.box = t.box;
  return rayBody(origin, dir, scratchBody, max, thick);
}

/**
 * How thick a thrown or launched projectile (a spear, a rocket, a grenade, a disc) is against bodies (m): it is an
 * object, not a line, so it strikes a body it passes this close to. Bullets and hitscan rounds are lines.
 */
export const PROJECTILE_THICKNESS = 0.12;
const scratchBody: HitBody = { feet: { x: 0, y: 0, z: 0 }, yaw: 0, stance: 0, scale: 1, box: undefined as unknown as LookHitbox };

/**
 * Resolve a hitscan shot: the nearest of the first static surface and any
 * target capsule wins. `worldDistance` is the result of a static raycast (null = nothing within range).
 */
/** Where a shot landed on a body: 0 torso and arms, 1 head, 2 legs. */
export type HitZone = 0 | 1 | 2;
/** Head hits hurt double (sniper rifles more); leg hits a bit less. */
export const HEAD_MULTIPLIER = 2;

/**
 * Unarmed quick melee (BUTTON_MELEE with no melee weapon in hand): a punch,
 * or a kick when moving forward or straight after a punch. Small damage and a
 * stagger (stopping power, sim/impact.ts); the kick also shoves. No lockout:
 * the gun stays ready, only the next strike waits for `cooldownTicks`.
 */
export const UNARMED = {
  punch: { id: 'core.punch', damage: 15, range: 1.9, cooldownTicks: 22, stopping: 0.5, shove: 0 },
  kick: { id: 'core.kick', damage: 22, range: 2.2, cooldownTicks: 42, stopping: 0.85, shove: 3.2 },
  /** A second press this soon after a punch kicks (ticks). */
  comboTicks: 36,
  /** Moving forward at least this much (input) kicks. */
  kickForward: 0.5,
} as const;
export type UnarmedStrike = 'punch' | 'kick';
/** Which strike a melee press throws: a kick when moving forward or soon after a punch, otherwise a punch. */
export function unarmedStrike(forward: number, ticksSincePunch: number): UnarmedStrike {
  return forward >= UNARMED.kickForward || ticksSincePunch <= UNARMED.comboTicks ? 'kick' : 'punch';
}
export const LEG_MULTIPLIER = 0.75;

/** The body zone at height `y` on a player standing at `feet` (`height` tall): the old height bands, for targets without measured shapes. */
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
  let zone: HitZone = 0;
  for (const t of targets) {
    const d = rayTarget(origin, dir, t, distance);
    if (d !== null && d < distance) {
      distance = d;
      hitSlot = t.slot;
      zone = lastHit.zone;
    }
  }
  return { hitSlot, distance, end: add(origin, scale(dir, distance)), zone };
}

/** Models a weapon or projectile falls back to when its own fails to load (see WeaponPresentation.fallback). */
export const MODEL_FALLBACKS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(Object.values(CORE_WEAPONS).flatMap((w) => (w.view.fallback ? [[w.view.model, w.view.fallback]] : []))),
  'guns/frag.glb': 'projectiles/frag.glb',
};
