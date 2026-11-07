// Ray's side effect (scene picking, camera.getForwardRay): Babylon's pointer handling can pick on any scene, and
// only the MapMaker imported it before it loaded on demand.
import '@babylonjs/core/Culling/ray';
import type { PerfCounter } from '@babylonjs/core/Misc/perfCounter';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Frustum } from '@babylonjs/core/Maths/math.frustum';
import type { Plane } from '@babylonjs/core/Maths/math.plane';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { createMountNode, mountGun, mountTurret, setMountGlow, wheelsOf } from './mountVisuals.ts';
import { CockpitInterior, type CockpitDrive } from './cockpitInterior.ts';
import { createViewCamera, poseCamera } from './cameraPose.ts';
import { createCanopy, placeCanopy, releaseCanopy } from './canopyVisuals.ts';
import { BackdropVisuals } from '../backdrop.ts';
import { BorderVisuals } from '../borderVisuals.ts';
import { FoliageVisuals } from '../foliage.ts';
import { EnvironmentVisuals } from '../environment/environmentVisuals.ts';
import { envRendererOn } from '../environment/envFlag.ts';
import type { ClientMount } from './mountState.ts';
import { ARSENAL_LOOKS, ZoneVisuals, animateArsenalProjectile, createArc, createArsenalProjectile, createAura, createBeam, setAura } from './arsenalVisuals.ts';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { Mesh as MeshClass } from '@babylonjs/core/Meshes/mesh';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import {
  armsLookFor,
  PLAYER,
  POWERUP_DAMAGE_BIT,
  angleDelta,
  POWERUP_SPEED_BIT,
  WEAPONS_BY_SLOT,
  weaponByCode,
  getWeapon,
  heldModel,
  CORE_WEAPONS,
  gunplayOf,
  THROWABLE_DEFS,
  throwableModel,
  SMOKE,
  smokeBlocks,
  type SmokeCloud,
  type ThrowableKind,
  type MapDocument,
  type PropEntity,
  type PickupEntity,
  type Vec3,
  type WeaponDefinition,
  type WeaponHold,
  type WorldBox,
  PROJECTILE_VISUALS,
  type ZoneSnapshot,
  FX_CLOAK,
  FX_JET,
  CHUTE_GLIDER,
  CHUTE_PARACHUTE,
  floatSurface,
  liquidAt,
  mapLiquids,
  type Liquid,
  type LiquidBox,
  type OBox,
  DEFAULT_BLOOD,
  EffectsWorld,
  mapTerrainMesh,
  environmentShapes,
  type MapEntity,
  type Movers,
  MOUNT_WRECK_FADE_SECONDS,
  mountDamageState,
  getLook,
  hangDepth,
  mapZiplines,
  type Zipline,
  suspensionOf,
  hungPropLift,
  propFlushLifts,
  getProp,
  type Stance,
} from '@tiletrigger/shared';
// The props' contact faces (docs/LOOK.md, "No flicker: props"): with the match code, never in the menu's bundle.
import { PROP_CONTACTS } from '@tiletrigger/shared/propContacts';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Material } from '@babylonjs/core/Materials/material';
import { BloodVisuals, bloodPreference } from './bloodVisuals.ts';
import { PosedBody, RAGDOLL_PREWARM, Ragdoll, type DeadBody } from './ragdoll.ts';
import { RAGDOLL_BUDGET, fitBudget, screenShare, tierFor, type RagdollTier } from './ragdollBudget.ts';
import { Atmosphere, SMALL_CASTER_REACH } from './atmosphere.ts';
import { PROP_BATCH_MIN, PropBatches } from './propBatches.ts';
import { castSmall } from './shadowFlags.ts';
import { ImpactVisuals } from './impactVisuals.ts';
import { ThrowArc } from './throwArc.ts';
import { createStarFlash, kickFlash } from './muzzleVisuals.ts';
import { MuzzleFlashRig, loadMuzzleFlashes, muzzleEffectFor } from './muzzleFlash.ts';
import { GodotVfx, type VfxHandle } from './godotVfx.ts';
import { LastingFx } from './lastingFx.ts';
import { PropFlames } from './propFlames.ts';
import { ACCENT_RANGE, arcFx, explosionFor, gameplayFx, impactStyle, lastingFx, lastingKeys, mappedEffects, mappedPacks, meleeImpact, surfaceIndex, surfaceOfBox, weaponImpact, type FxRef, type Surface } from './fxMap.ts';
import { buildPathMeshes } from '../pathMeshes.ts';

/** Seconds a physics debris chunk lies around before shrinking away. */
const DEBRIS_LIFE = 6;
const SHAKE_MS = 650;
/** How fast a vehicle's drawn turret and barrel follow their gunner's aim (rad/s; View.turnTurret). */
const TURRET_TURN = 2.5;
import { MapStyler } from '../mapMeshes.ts';
import { buildRoadMeshes } from '../roadMeshes.ts';
import { ModelLibrary } from '../content/models.ts';
import { DROP_LIE_HEIGHT, PICKUP_HOVER, createPickupVisual } from './pickupVisuals.ts';
import { LIQUID_LOOKS, ScenarioVisuals } from './scenarioVisuals.ts';
import { createPropNode } from './propVisuals.ts';
import { CityVisuals } from './cityVisuals.ts';
import { SkyEffects } from './skyEffects.ts';
import { CharacterLibrary, setCharacterLodCrowd, setCharacterLodZoom, type CharacterInstance } from '../content/characters.ts';
import { CharacterAnimator, type OneShot } from './characterAnimator.ts';
import { ANIM_LOD_FAR, ANIM_LOD_NEAR, SHOT_OVERLAY_REACH, animStep } from './animLod.ts';
import { perfOn } from './perfSwitches.ts';
import { installAnimationPatches, trackAnimatedTargets } from './animPatches.ts';
import { freezeStaticMaterials, selectLiveCandidates } from './meshSelection.ts';
import { fitFirstPersonArms } from './firstPersonArms.ts';
import { FirstPersonBodyRig } from './firstPersonBody.ts';
import { loadFirstPersonMode, loadGraphicsQuality, loadRenderScale, renderRatio, type FirstPersonMode } from './graphicsSettings.ts';
import { levelMipBias } from '../levelMerge.ts';
import { CreatureLibrary, fitPlayerSkin, type AvatarSpec } from '../content/creatures.ts';
import { BodyHitbox, hitboxForSpec } from './hitboxOverlay.ts';
import { CreatureAnimator } from './creatureAnimator.ts';
import type { RemotePose } from './interpolation.ts';
import { COUNT, SYS, perfProbe } from './perfProbe.ts';
import { Effect } from '@babylonjs/core/Materials/effect';

/** Remote players' pack muzzle flashes: within this range of the camera (m), on at most this many guns. */
const REMOTE_FLASH_RANGE = 45;
/** Electric FX's zap: a bolt 6 m tall (its tubes, stretched to a jump's length) with a burst where it lands. */
const ZAP_LENGTH = 6;
const ZAP_TUBES = ['Zap', 'ZapExtra'] as const;
/** The bolt and the burst at its foot; the ground ring and streaks are left out (an arc lands on a body, not the floor). */
const ZAP_PARTS = ['Zap', 'ZapExtra', 'ZapSphere', 'ZapGlow'] as const;
const MAX_REMOTE_RIGS = 8;
/** Your own pack flash: this much bigger than the weapon's scale, starting this far (m) past the muzzle so the gun doesn't hide it. */
const OWN_FLASH_SCALE = 1.6;
const OWN_FLASH_AHEAD = 0.05;
/**
 * Projectile looks drawn with a throwable's own model (content/throwables.json `view`: the frag, sticky, gas,
 * incendiary, vortex, cluster and smoke grenades), by look: the throwable whose model it is (its model as the match's
 * weapon set shows it: throwableModel). The mine keeps its own drawing (it blinks once armed).
 */
const THROWN_KINDS: ReadonlyMap<string, ThrowableKind> = new Map(Object.values(THROWABLE_DEFS).flatMap((t) => (t.view && t.kind !== 'mine' ? [[t.projectile.visual, t.kind]] : [])));
/** How a throwable lies in your hands while you line up a throw: held like a pistol's grip, the support hand round it. */
const THROW_HOLD: WeaponHold = { style: 'pistol', grip: [0, -0.012, -0.012], support: [-0.03, -0.022, 0], rake: 0 };
/** Where that hold sits in your view (right, up, forward of the eye): low and a little right, as a pistol is held. */
const THROW_HOLD_AT = [0.14, -0.16, 0.34] as const;

/** How far ahead of a thrown spear's sim point its tip is drawn (m): the head goes a little way into what it hits. */
const SPEAR_TIP_AHEAD = 0.52;
const SLOT_COLORS = ['#e6544a', '#4aa3e6', '#f2c14e', '#5cc77a', '#b276e0', '#f28f3b', '#46c9c0', '#e872b0'];
export const slotColor = (slot: number): string => SLOT_COLORS[slot % SLOT_COLORS.length]!;

/** Default vertical FOV (~77°); an options screen will expose it. */
export const DEFAULT_FOV = 1.35;

interface Fx {
  mesh: Mesh | LinesMesh;
  born: number;
  ttl: number;
  /** Per-frame update with age fraction 0..1. */
  update?: (f: number) => void;
  /** Its material is shared: leave it when the effect ends. */
  shared?: boolean;
}

interface Avatar {
  root: TransformNode;
  /** Capsule shown until the character model loads. */
  placeholder: Mesh;
  mat: StandardMaterial;
  weaponSlot: number;
  weaponNode?: TransformNode;
  /** Never holds a weapon (zombies claw). */
  unarmed?: boolean;
  /** Soldiers and players get a character, creature NPCs their own animator. */
  anim?: CharacterAnimator | CreatureAnimator;
  specKey: string;
  /**
   * Team-colour marker over a teammate's head (Team Deathmatch): its own disc, or in crowds a plain node where the
   * disc goes, drawn through its colour's thin instances (GameView.drawTags).
   */
  tag?: { node: TransformNode; color: string };
  last?: { x: number; y: number; z: number; t: number };
  vel: { x: number; z: number };
  /** Status-effect shell (burning, poisoned, frozen…), made on first need. */
  aura?: Mesh;
  jet?: Mesh;
  /** How see-through it is drawn now (Classes: a cloaked Shade); 1 = solid. */
  shown?: number;
  /** Parachute or glider over them, and which. */
  canopy?: { node: TransformNode; kind: number };
  /** The zipline trolley over a rider's head (made on first ride). */
  trolley?: TransformNode;
  /** The body after death (until the next spawn): a ragdoll (full or cheap) or laid down (ragdoll.ts, ragdollBudget.ts). */
  ragdoll?: DeadBody;
  /** A body that died without a ragdoll (a creature) falls to the ground under gravity. */
  fall?: { y: number; vy: number; ground: number };
  wasAlive?: boolean;
  /** When this view first saw it dead (ms, and the scene's frame; its body may start a few frames later: deathsToStart). */
  diedAt?: number;
  diedFrame?: number;
  /** The held weapon and its muzzle in the weapon's own space (for tracers and flashes). */
  muzzle?: { node: TransformNode; local: Vector3 };
  /** Muzzle flash shown until this time. */
  flashUntil?: number;
  flash?: Mesh;
  /** The pack's muzzle flash for their gun (muzzleFlash.ts); `flash` is the plain star used before it loads and for the railgun. */
  flashRig?: MuzzleFlashRig;
  /** Climbing out of a hatch or burrow: rises from below the floor from this time. */
  emergeAt?: number;
  /** Team leader's crown (rules.leaders), made on first need. */
  crown?: Mesh;
  /** Crowds: far avatars animate every few frames; the frames counted and the time saved up since. */
  animFrame?: number;
  animDt?: number;
  /** The power-up glow last applied (it is only set again when it changes). */
  glowKey?: string;
  /** Crowds: left out of drawing while outside the view (see updateAvatars). */
  culled?: boolean;
  /** Your own body while you look through your own eyes: kept loaded, not drawn. */
  hiddenSelf?: boolean;
  /** Its hit shapes drawn over it (the Show hitboxes dev setting). */
  hitbox?: BodyHitbox;
}

/** How long an NPC takes to climb out of a hatch or burrow (ms), and from how deep. */
const EMERGE_MS = 650;
const EMERGE_DEPTH = 1.7;

/** A body left where it fell: stays all match, or sinks away after a while (player setting). */
interface Corpse {
  a: Avatar;
  slot: number;
  born: number;
}

export const BODIES_PREF_KEY = 'cs.bodies';
export type BodiesSetting = 'stay' | 'fade';
export function bodiesPreference(): BodiesSetting {
  try {
    return localStorage.getItem(BODIES_PREF_KEY) === 'fade' ? 'fade' : 'stay';
  } catch {
    return 'stay';
  }
}
/** Bodies kept at once (the oldest goes when another falls). */
const MAX_CORPSES = 32;
/** Time (ms) a frame may spend starting dead bodies before further fresh deaths wait for the next frame (at least one starts). */
const DEATH_START_MS = 4;
/**
 * A push (a hit, a blast) is used by a death this view saw within this long of it (ms), however many frames later its
 * body starts (a blast's starts are spread over frames: on a slow frame rate the last used to start after the push
 * had gone, and dropped where it stood instead of flying).
 */
const PUSH_KEEP_MS = 1200;
/**
 * Or within this many frames of it: the push comes with the snapshot and the death is drawn a moment later (the view
 * draws a little behind the snapshots), which on a page drawing a frame a second is past PUSH_KEEP_MS.
 */
const PUSH_KEEP_FRAMES = 3;
/** An enemy's marker colour (a downward triangle; allies get a diamond). */
const isEnemyTag = (color: string): boolean => color.toLowerCase() === '#ff3b3b';
/** The fog's colour and thickness inside a smoke cloud: a mid grey (not white) through which you see about 2-3 m. */
const SMOKE_FOG = new Color3(0.42, 0.44, 0.46);
const SMOKE_FOG_DENSITY = 0.42;
/** The way an avatar faces (its yaw; characters face +Z at yaw 0), for its ragdoll to tell front from back. */
const facingOf = (a: Avatar): Vec3 => ({ x: Math.sin(a.root.rotation.y), y: 0, z: Math.cos(a.root.rotation.y) });

/**
 * Characters kept for reuse per look (spec) when their avatar goes (a body that sank away, one past MAX_CORPSES, a player
 * who left): the next avatar of that look (a respawn) takes one at once instead of building a new one (10-25 ms each,
 * just after a frame: a busy match's respawns were most of its hitches' unexplained time).
 */
const BODY_POOL_PER_LOOK = 2;
/** Frames longer than this (ms: a CPU-rendered page) let more than one character be built after them (one per 16 ms). */
const BUILD_CATCH_UP_MS = 250;
/** Ragdoll parts parked in the effects world's pool when the map is built (a standard body's, this many times). */
const RAGDOLL_PREWARM_BODIES = 12;
/**
 * Crowds: with more than this many remote characters, characters out of view sleep (no clips, aim or grip), held guns
 * and team markers are GPU instances, low detail comes sooner and far ones cast no shadow. The animation LOD
 * (animLod.ts: rate and detail by distance) applies in every match.
 */
const ANIM_LOD_CROWD = 24;
/** Crowds: characters further than this (m) cast no shadow (a crowd's far shadows are a draw each for a few pixels). */
const CROWD_SHADOW_REACH = 30;
/**
 * Only this many characters cast shadows, the nearest in view (a crowd's shadow pass was a draw or three per
 * character), and anyone nearer than SHADOW_ALWAYS (m) whatever their rank, so nothing changes close by.
 */
export const SHADOW_CHARACTERS = 12;
const SHADOW_ALWAYS = 10;

/** How often (ms between evaluations, 0 every frame) a character in view at `dist` m animates at 60 fps (animLod.ts). */
export function animStepMs(dist: number): number {
  return animStep(dist).ms;
}
/** Crowds: a character is drawn while a sphere this big (m) round its middle touches the view (it covers the gun and most of a shadow). */
const CULL_RADIUS = 2.5;

/** Whether a sphere touches the view frustum (planes from Frustum.GetPlanes). */
function inView(planes: readonly Plane[], x: number, y: number, z: number, r: number): boolean {
  for (const p of planes) if (p.normal.x * x + p.normal.y * y + p.normal.z * z + p.d < -r) return false;
  return true;
}
/** "Fade" setting: seconds a body lies there, then seconds it takes to sink away. */
const CORPSE_STAY = 30;
const CORPSE_SINK = 3;

/** Characters face +Z (our yaw 0) after glTF import; fit them to the player height. */
const MODEL_YAW = 0;

function fitCharacter(ch: CharacterInstance): void {
  ch.root.rotation.y = MODEL_YAW;
  const { min, max } = ch.root.getHierarchyBoundingVectors(true);
  const h = max.y - min.y;
  // Keep any size multiplier already on the model (NPC heavies are bigger).
  if (h > 0.5) ch.root.scaling.scaleInPlace((PLAYER.height * ch.root.scaling.y) / h);
}

interface PickupVisual {
  root: TransformNode;
  baseY: number;
  phase: number;
  /** The item drawn (a random pickup's roll, from the snapshot), and the one placed in the map. */
  item: string;
  placed: string;
}

/** First-person match scene: map, viewmodel, remote avatars, pickups, projectiles and effects. */
export class GameView {
  readonly scene: Scene;
  /** Draw every body's hit shapes over it (Options → Display → Show hitboxes, a dev and test setting). */
  showHitboxes = false;
  readonly camera: FreeCamera;
  readonly models: ModelLibrary;
  /** City facades and building/street tile models. */
  readonly city: CityVisuals;
  private readonly skyEffects: SkyEffects;
  readonly scenario: ScenarioVisuals;
  readonly characters: CharacterLibrary;
  readonly creatures: CreatureLibrary;
  private readonly avatars = new Map<number, Avatar>();
  /** More remote players than ANIM_LOD_CROWD (the last updateAvatars): big-match savings apply. */
  private crowd = false;
  /** updateAvatars calls so far: the animation LOD's frame count (animLod.ts). */
  private avatarFrame = 0;
  private readonly pickups = new Map<string, PickupVisual>();
  /** Weapons the fallen dropped (snapshot `dw`), by drop ID: drawn lying where they fell. */
  private readonly drops = new Map<number, { root: TransformNode; item: string }>();
  private readonly projectiles = new Map<number, { node: TransformNode; look: number; born: number }>();
  /** Placed props by entity index (breakable ones disappear when broken). */
  private readonly props = new Map<number, TransformNode>();
  private effects: Fx[] = [];
  /** Binbun's hit and explosion effects (godotVfx.ts), once their packs are in. */
  private readonly vfx: GodotVfx;
  /** Pack effects that last while something burns or glows (fires, flares), the nearest drawn first. */
  private readonly lasting: LastingFx;
  /** Fire props' open flames (content/props.json `flame`), drawn with Flame FX near the camera. */
  private propFlames: PropFlames;
  /** Each placement's surface (stone, metal, wood …) for where rounds land (fxMap.ts), made with the map. */
  private surfaces: Map<string, Surface> | null = null;
  private sunLight?: DirectionalLight;
  private zoneVisuals!: ZoneVisuals;
  private readonly viewRoot: TransformNode;
  private readonly foliage: FoliageVisuals;
  /** The environment renderer (?env=1, environment/environmentVisuals.ts): made with the first map that has species. */
  environment: EnvironmentVisuals | null = null;
  private viewmodel?: TransformNode;
  private viewWeapon?: string;
  /** Your own character's arms in first person, gripping the viewmodel. */
  private fpArms?: { look: string; anim: CharacterAnimator | null; root: TransformNode };
  /** Your own look (setLocalLook): its arms are built when first person needs them. */
  private localLook?: string;
  /** First person: your whole character from its eyes, or arms only (Options → Display). */
  private fpMode: FirstPersonMode = loadFirstPersonMode();
  /** Full-body first person: your own avatar seen from its eyes, while it is (firstPersonBody.ts). */
  private fpBody?: { a: Avatar; rig: FirstPersonBodyRig; vel: { x: number; z: number }; last?: { x: number; z: number; t: number } };
  /** The camera is your own eyes this frame (not a vehicle's view, the kill cam or a spectator's): set by the session. */
  firstPersonEye = false;
  /** The gun is hidden this frame (scoped, third person, dead): the full body is too. */
  private viewHidden = true;
  /** The camera before any shake (the full body stands under the steady eye). */
  private readonly steadyEye = { pos: new Vector3(), yaw: 0, pitch: 0 };
  private viewLoad = 0;
  /** First-person guns built so far, by weapon ID, with their measurements (see setViewmodel). */
  private readonly viewmodels = new Map<string, { node: TransformNode; muzzleZ: number; muzzleY: number; sightTop: number; stockZ: number }>();
  /** Front of the loaded viewmodel along its forward axis, for the muzzle flash. */
  private muzzleZ = 0.2;
  /** Barrel height of the loaded viewmodel (the same estimate as remote guns: the bounds include the grip). */
  private muzzleY = 0.02;
  private kickAmount = 0;
  /** The last kick was a melee weapon's barrel going off (a gun's recoil, heavier), not a swing. */
  private kickShot = false;
  /** Smoke clouds from your own shots so far (tests). */
  readonly smokeClouds = { local: 0, remote: 0 };
  private bobPhase = 0;
  /** Weapon bob strength (0..1), eased so starting or stopping doesn't pop the gun. */
  private bobAmount = 0;
  private readonly flash: Mesh;
  private flashUntil = 0;
  /** Your gun's flash from the pack (muzzleFlash.ts); the star `flash` stays for the railgun and until the pack has loaded. */
  private readonly flashRig: MuzzleFlashRig;
  /** Remote players' flash rigs alive (at most MAX_REMOTE_RIGS). */
  private remoteRigs = 0;
  private starFlash = false;
  /** The ambient light (its colour tints the effects). Shots no longer brighten it: that lit every wall on the map, indoors and out. */
  private hemi?: HemisphericLight;
  /** Shadows, tone mapping and post effects (Options → Graphics). */
  readonly atmosphere: Atmosphere;
  private readonly brass: StandardMaterial;
  /** The map's static props, batched (buildMap; null with `?perfoff=propbatch`). */
  propBatches: PropBatches | null = null;
  /** The level's draw merge in progress (buildMap), and its outcome: draws before and after (null: not merged). */
  private levelMerge: Promise<{ before: number; after: number; merged: string[] } | null> | null = null;
  /** Level meshes before and after the merge, and the per-style meshes merged (by name; tests). */
  levelDraws: { before: number; after: number; merged: string[] } | null = null;

  constructor(engine: AbstractEngine) {
    // Cheaper clip stops and node disposals with thousands of animations running (animPatches.ts).
    installAnimationPatches();
    this.scene = new Scene(engine);
    trackAnimatedTargets(this.scene);
    // The meshes switched on, once a frame, for Babylon's two walks over every mesh (meshSelection.ts).
    if (perfOn('meshsel')) {
      selectLiveCandidates(this.scene);
      // The level's and the props' materials frozen once settled (they never change in a match).
      freezeStaticMaterials(this.scene, (m) => {
        if (!m.isWorldMatrixFrozen || m.skeleton) return false;
        let root: { name: string; parent: unknown } = m;
        while (root.parent) root = root.parent as typeof root;
        return /^(map_|prop_|static_)/.test(root.name);
      });
    }
    this.scene.clearColor = new Color4(0.52, 0.62, 0.72, 1);
    this.scene.skipPointerMovePicking = true;
    this.camera = createViewCamera('camera', this.scene);
    // Not too near: the depth buffer has to stretch to the distant scenery (4 km).
    this.camera.minZ = 0.1;
    // Far enough for the backdrop's distant scenery.
    this.camera.maxZ = 4000;
    this.camera.fov = DEFAULT_FOV;
    this.camera.inputs.clear();
    this.models = new ModelLibrary(this.scene);
    this.city = new CityVisuals(this.models);
    this.scenario = new ScenarioVisuals(this.scene);
    this.zoneVisuals = new ZoneVisuals(this.scene);
    this.characters = new CharacterLibrary(this.scene, { atlas: true });
    // Characters are built one a frame: the host adding a dozen bots, or a full match's first wave, built them all
    // in one long frame, a stall on every computer. A build (10-25 ms) runs just after the frame, outside its measured
    // spans (the "outside" time of a recording's hitches), so a slow frame no longer lets two or three through at once
    // (one per 16 ms it took, before); only a CPU-rendered page's very long frames (tests) still catch up that way.
    const turns: (() => void)[] = [];
    let lastTurn = performance.now();
    this.characters.turn = () => new Promise((go) => turns.push(go));
    this.scene.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      const dt = now - lastTurn;
      for (let n = dt < BUILD_CATCH_UP_MS ? 1 : Math.floor(dt / 16); n > 0 && turns.length; n--) {
        turns.shift()!();
        if (perfProbe.on) perfProbe.n[COUNT.built]!++;
      }
      lastTurn = now;
    });
    this.creatures = new CreatureLibrary(this.scene);
    this.foliage = new FoliageVisuals(this.scene, this.models);
    this.blood = new BloodVisuals(this.scene, () => this.physics);
    this.impacts = new ImpactVisuals(this.scene, () => this.physics);
    this.throwArc = new ThrowArc(this.scene);
    this.blood.enabled = bloodPreference();

    const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), this.scene);
    hemi.intensity = 0.8;
    hemi.groundColor = new Color3(0.35, 0.33, 0.3);
    this.hemi = hemi;
    const sun = new DirectionalLight('sun', new Vector3(-0.4, -1, 0.3), this.scene);
    this.sunLight = sun;
    sun.intensity = 0.6;

    this.viewRoot = new TransformNode('viewRoot', this.scene);
    this.viewRoot.parent = this.camera;
    this.atmosphere = new Atmosphere(this.scene, this.camera, sun, this.viewRoot);
    this.skyEffects = new SkyEffects(this.scene, this.camera, this.atmosphere.quality);
    this.flash = createStarFlash(this.scene, 'muzzleFlash', 0.32);
    this.flash.renderingGroupId = 1;
    // It rides on the gun in camera space and already faces you: billboarding it
    // made it trail the muzzle by a frame whenever you moved.
    this.flash.billboardMode = MeshClass.BILLBOARDMODE_NONE;
    void loadMuzzleFlashes();
    // Browser tests hold flashes still to look at them (window.__flashHold = ms after the shot).
    Object.defineProperty(window, '__flashHold', { configurable: true, set: (v: number | undefined) => (MuzzleFlashRig.hold = v), get: () => MuzzleFlashRig.hold });
    this.vfx = new GodotVfx(this.scene);
    // Low graphics plays fewer pack effects at once and thins the lasting ones (fires, charge balls).
    this.vfx.quality = this.atmosphere.quality;
    this.lasting = new LastingFx(this.vfx);
    // Low graphics keeps the fire props' own flames: its few lasting places go to the fires that matter.
    this.propFlames = new PropFlames(this.lasting, this.atmosphere.quality !== 'low');
    this.zoneVisuals.lasting = this.lasting;
    this.scenario.lasting = this.lasting;
    void GodotVfx.preload(...mappedPacks());
    this.flashRig = new MuzzleFlashRig(this.scene, 'muzzleFlashRig', { renderingGroupId: 1 });
    this.flashRig.root.parent = this.viewRoot;
    this.brass = new StandardMaterial('brassMat', this.scene);
    this.brass.diffuseColor = new Color3(0.78, 0.6, 0.22);
    this.brass.specularColor = new Color3(0.9, 0.8, 0.5);
    instrumentRender(this.scene);
    // Shader programs stay built once made (prewarm's samples go, the programs stay for the real thing).
    Effect.PersistentMode = true;
  }

  /** A free camera made the active one, for map screenshots (tools/content/capture-map-shots.mjs). */
  photoCamera(): FreeCamera {
    const cam = new FreeCamera('photo', this.camera.globalPosition.clone(), this.scene);
    cam.minZ = 0.1;
    cam.maxZ = 2000;
    // The view model's overlay camera (and any pipeline) render through activeCameras when set.
    this.scene.activeCameras = [cam];
    this.scene.activeCamera = cam;
    return cam;
  }

  buildMap(doc: MapDocument, boxes: readonly WorldBox[]): void {
    this.ziplines = mapZiplines(doc.entities);
    const styler = new MapStyler(this.scene);
    styler.build(doc, boxes);
    // The level's per-style meshes merged across styles over array textures (levelMerge.ts; WebGL2): the loading gate
    // (prewarm) waits for it, so its shader is built before play.
    const engine = this.scene.getEngine() as { isWebGPU?: boolean; webGLVersion?: number };
    if (perfOn('levelmerge') && !engine.isWebGPU && (engine.webGLVersion ?? 1) >= 2) {
      // Phones show a small drawing magnified: their level textures a touch softer, so speckled floors don't twinkle.
      this.levelMerge = styler.merge('map', levelMipBias(window.devicePixelRatio || 1, renderRatio(loadRenderScale()))).catch((e: unknown) => {
        console.warn('level merge skipped:', e);
        return null;
      });
      void this.levelMerge.then((r) => (this.levelDraws = r));
    }
    buildRoadMeshes(this.scene, doc, styler);
    // Paths (MapMaker's roads, streets and trails), on the ground as played (loadMap laid them in).
    buildPathMeshes(this.scene, doc, doc.terrain, styler);
    const backdropVisuals = new BackdropVisuals(this.scene, styler, this.models);
    const backdrop = backdropVisuals.build(doc, boxes);
    if (backdropVisuals.sky) this.skyEffects.apply(doc, backdrop, backdropVisuals.sky);
    this.border?.dispose();
    this.border = new BorderVisuals(this.scene, styler, this.models);
    this.border.update(doc, boxes);
    this.city.setMap(doc);
    this.liquids = mapLiquids(doc.entities);
    this.surfaces = surfaceIndex(doc);
    this.physics?.free();
    try {
      this.physics = new EffectsWorld(boxes, mapTerrainMesh(doc), environmentShapes(doc));
      // A blast that kills ten takes its ragdolls from the pool rather than allocating them mid-fight.
      this.physics.prewarm(RAGDOLL_PREWARM, RAGDOLL_PREWARM_BODIES);
    } catch {
      this.physics = null;
    }
    const blood = doc.blood ?? DEFAULT_BLOOD;
    this.blood.setLook(blood.color, blood.amount);
    this.scenario.surface = (m, t) => styler.surfaceMaterial(doc, m, t);
    // Water bakes its depth (clear shallows, foam on the shore) from the level under it.
    this.scenario.liquids.levelBoxes = boxes;
    void this.foliage.grow(doc.terrain, boxes, doc.metadata.id, this.liquids.filter((l) => l.liquid === 'water' || l.liquid === 'swamp'));
    for (const e of doc.entities) if (e.kind === 'pickup') this.addPickup(e);
    // Props riding movers (a locomotive, a mine cart) move, so their matrices stay live.
    const carried = new Set(doc.entities.flatMap((e) => (e.kind === 'mover' ? (e.props ?? []) : [])));
    // Environment species (`env.*`) with the new renderer (?env=1): chunked thin instances, not a node each.
    const env = envRendererOn() ? doc.entities.filter((e): e is PropEntity => e.kind === 'prop' && !carried.has(e.id) && EnvironmentVisuals.draws(e)) : [];
    if (env.length) {
      this.environment ??= new EnvironmentVisuals(this.scene, loadGraphicsQuality());
      void this.environment.setPlacements(env, doc.terrain);
    }
    const drawnAsEnv = new Set(env.map((e) => e.id));
    // Props flush on other props (a box on a crate, rail lengths laid end over end) are drawn a hair apart: no flicker.
    const flush = propFlushLifts(doc, PROP_CONTACTS, boxes);
    // Static props as thin instances per model, material and square (propBatches.ts), not a node of instances each.
    // A batch reads a prop's matrix once its model is in (never in this loop), so the hung and flush lifts below are in it.
    this.propBatches?.dispose();
    this.propBatches = perfOn('propbatch') ? new PropBatches(this.scene, (path) => this.models.staticSources(path), SMALL_CASTER_REACH) : null;
    const batches = this.propBatches;
    // Only models with enough copies on the map (PROP_BATCH_MIN) are batched.
    const copies = new Map<string, number>();
    const modelKey = (e: PropEntity) => `${e.model}|${e.variant ?? ''}`;
    for (const e of doc.entities) if (e.kind === 'prop' && !drawnAsEnv.has(e.id) && !carried.has(e.id)) copies.set(modelKey(e), (copies.get(modelKey(e)) ?? 0) + 1);
    doc.entities.forEach((e, i) => {
      if (e.kind !== 'prop' || drawnAsEnv.has(e.id)) return;
      const batch = batches && (copies.get(modelKey(e)) ?? 0) >= PROP_BATCH_MIN ? batches : null;
      const node = createPropNode(this.scene, this.models, e, `prop_${e.id}`, !carried.has(e.id), true, doc.terrain, batch);
      // A chandelier (and other hung props) is drawn with its top against the ceiling over it.
      if (!carried.has(e.id)) node.position.y += hungPropLift(boxes, e);
      const lift = flush.get(e.id);
      if (lift) node.position.addInPlaceFromFloats(lift[0], lift[1], lift[2]);
      this.props.set(i, node);
      const flame = getProp(e.model)?.flame;
      if (flame) this.propFlames.add(e.id, node, flame, e.scale, carried.has(e.id));
    });
    this.scenario.build(doc.entities, doc);
    this.entrances = doc.entities.filter((e): e is Extract<MapEntity, { kind: 'encounter' }> => e.kind === 'encounter' && (e.entrance ?? 'none') !== 'none');
    // Warm the model cache so first switches and pickups don't hitch.
    for (const w of WEAPONS_BY_SLOT) void this.models.load(w.view.model);
    void this.models.load('projectiles/grenade.glb');
    // And the effects: each one's meshes and shaders were made by its first shot or blast in a fight (a stall each).
    void loadMuzzleFlashes().then(() => {
      if (this.scene.isDisposed) return;
      const ids = new Set(WEAPONS_BY_SLOT.map((w) => muzzleEffectFor(w)?.id).filter((id): id is string => !!id));
      MuzzleFlashRig.warm(this.scene, [...ids]);
    });
    this.blood.warm();
    this.impacts.warm();
    void GodotVfx.preload(...mappedPacks()).then(() => {
      if (this.scene.isDisposed) return;
      // Every effect content/vfx.json's map can play (impacts, explosions, moments of play, lightning, lasting ones).
      for (const r of mappedEffects()) this.vfx.warm(r.pack, r.effect);
    });
  }

  /**
   * The loading gate's shader warm-up (session.prepareMatch waits for it): a character of each look in the
   * match is built out of sight, every effect the map can play plays once out of sight, and the scene waits
   * until every shader they and the map need (shadow-map ones too) is built. Effect.PersistentMode (set in the
   * constructor) keeps those programs when the samples go, so the first sight of a model or an effect mid-match
   * doesn't stall on a shader build. Resolves with how many shader programs were built by then.
   */
  async prewarm(specs: readonly AvatarSpec[], guns: readonly string[] = [], veiled: () => boolean = () => false): Promise<number> {
    const t0 = performance.now();
    // The merged level first (its textures load in a moment; its shader is then built with everyone else's).
    if (this.levelMerge) await Promise.race([this.levelMerge, new Promise((r) => setTimeout(r, 15000))]);
    // And the prop batches: their models in, their meshes made (the next frame), so their shaders are built below.
    if (this.propBatches) {
      await Promise.race([this.propBatches.settled(), new Promise((r) => setTimeout(r, 15000))]);
      await this.afterFrames(2, 1500);
    }
    const ready = () => (this.scene.isDisposed ? Promise.resolve() : Promise.race([this.scene.whenReadyAsync(), new Promise((r) => setTimeout(r, 8000))]));
    // Water's splash rings and drops (made on the first splash) draw a copy out of sight meanwhile.
    this.scenario.liquids.fx.warm(4000);
    // The effects first (they don't wait for the characters' files), ended as soon as their shaders are built.
    let effects = 0;
    try {
      await GodotVfx.preload(...mappedPacks());
      const ends: (() => void)[] = [];
      // Each effect plays out of sight for a few frames (its particles spawn: their pieces draw then).
      for (const r of mappedEffects()) {
        const end = this.vfx.warm(r.pack, r.effect, true);
        if (end) ends.push(end);
      }
      effects = ends.length;
      await this.afterFrames(4, 2500);
      await ready();
      for (const end of ends) end();
    } catch {
      // Effects that didn't load stay as they were (their first play builds them).
    }
    if (this.scene.isDisposed) return 0;
    // Then a character of each look and every gun the match can hold (a crowd's GPU instance and a plain copy: the
    // view model, a small match's held gun). While the loading screen is up they stand in front of the camera, so
    // every pass that will draw them in play draws them now (the main pass and its pre-pass outputs, the shadow
    // cascades, water's depth), each variant built: out of sight only the materials' own checks ran, and the first
    // gun or body seen in a shadow or in the depth map built its programs mid-match (round 3 of docs/PERF_96.md).
    // Once the game shows (a slow machine finishes this in the background) they are parked out of sight.
    const stage = new TransformNode('prewarm', this.scene);
    stage.position.set(0, -10000, 0);
    const place = this.scene.onBeforeRenderObservable.add(() => {
      const cam = this.scene.activeCamera;
      if (!cam || !veiled()) return void stage.position.set(0, -10000, 0);
      const f = cam.getDirection(Vector3.Forward());
      const flat = Math.hypot(f.x, f.z) || 1;
      const c = cam.globalPosition;
      stage.position.set(c.x + (f.x / flat) * 7, c.y - 1.6, c.z + (f.z / flat) * 7);
      stage.rotation.y = Math.atan2(f.x, f.z) + Math.PI;
    });
    const spot = (n: TransformNode, i: number, row: number) => n.position.set(((i % 8) - 3.5) * 0.9, 0, row + Math.floor(i / 8) * 1.2);
    const gunCopies = guns.flatMap((path, i) => [
      ...[true, false].map((instanced, k) =>
        // As a crowd's hands and the pickups hold them (merged instances), and as a copy of its own.
        (instanced ? this.models.instantiateWhole(path, `prewarm_gun_${i}_${k}`) : this.models.instantiate(path, `prewarm_gun_${i}_${k}`)).then(
          (node) => {
            if (stage.isDisposed()) return void node.dispose();
            node.parent = stage;
            spot(node, i * 2 + k, 4.5);
            node.position.y = 1.2;
            return node;
          },
          () => undefined,
        ),
      ),
      // And as your own first-person gun: under the view root, drawn over the world and catching no shadows (another
      // program than a copy in the world; the first gun of a kind in your hands built its own mid-match).
      this.models.instantiate(path, `prewarm_gun_${i}_view`).then(
        (node) => {
          if (stage.isDisposed()) return void node.dispose();
          node.parent = this.viewRoot;
          node.position.set(0, -10000, 0);
          for (const m of node.getChildMeshes()) m.renderingGroupId = 1;
          return node;
        },
        () => undefined,
      ),
    ]);
    // A shot's tracer (a line: its own shader, first built by the first tracer drawn in view).
    const tracer = CreateLines('prewarm_tracer', { points: [new Vector3(0, 1, 0), new Vector3(0, 1.5, 3)] }, this.scene);
    tracer.color = Color3.White();
    tracer.isPickable = false;
    tracer.parent = stage;
    // A parachute and a glider (fabric, and rigging lines in their own colours: made on the first jump), kept for the
    // first ones in play.
    const canopies = [CHUTE_PARACHUTE, CHUTE_GLIDER].map((kind, i) => {
      const node = createCanopy(this.scene, `prewarm_canopy_${kind}`, kind);
      node.parent = stage;
      node.position.set((i - 0.5) * 6, 0, 9);
      return { node, kind };
    });
    const made = await Promise.all(
      specs.slice(0, 32).map((spec, i) =>
        this.characters.create(spec, `prewarm_${i}`).then(
          (ch) => {
            if (stage.isDisposed()) return void ch.dispose();
            ch.root.parent = stage;
            spot(ch.root, i, 0);
            for (const g of ch.clips.values()) g.stop();
            return ch;
          },
          () => undefined,
        ),
      ),
    );
    const held = await Promise.all(gunCopies);
    if (this.scene.isDisposed) return 0;
    // Drawn every frame wherever the stage is: in front of the camera while the loading screen is up, and far below
    // the map (out of sight) once the game shows, so their main-pass programs are built either way (a slow machine or
    // a first visit still downloading finishes this after the start; parked, they were never drawn and the first gun
    // in your hands built its own mid-match).
    for (const m of [...stage.getChildMeshes(), ...held.flatMap((g) => g?.getChildMeshes() ?? [])]) m.alwaysSelectAsActiveMesh = true;
    // Three frames: the atmosphere sorts new meshes into the shadow map a frame later (their shaders differ). Capped
    // at 2 s even once the game shows: drawing the whole stage (and the effects above) out of sight for as long as a
    // slow machine's frames took made its first seconds of play stall (CI's hosted match dropped a friend's page).
    await this.afterFrames(3, 2000);
    await ready();
    place.remove();
    for (const c of canopies) {
      c.node.parent = null;
      for (const m of c.node.getChildMeshes()) m.alwaysSelectAsActiveMesh = false;
      releaseCanopy(this.scene, c.node, c.kind);
    }
    for (const ch of made) ch?.dispose();
    for (const g of held) g?.dispose();
    stage.dispose();
    this.prewarmed = { ms: Math.round(performance.now() - t0), shaders: this.shaderCount(), characters: made.filter(Boolean).length, effects, guns: held.filter(Boolean).length };
    return this.prewarmed.shaders;
  }

  /** What the loading gate's warm-up did (tests and perf96): how long it took, shader programs by then, samples. */
  prewarmed: { ms: number; shaders: number; characters: number; effects: number; guns: number } | null = null;

  /** After `n` rendered frames (or `ms` at most: a hidden tab renders none). */
  private afterFrames(n: number, ms: number): Promise<void> {
    return new Promise((done) => {
      let left = n;
      const end = () => {
        this.scene.onAfterRenderObservable.remove(obs);
        clearTimeout(timer);
        done();
      };
      const obs = this.scene.onAfterRenderObservable.add(() => void (--left <= 0 && end()));
      const timer = setTimeout(end, ms);
    });
  }

  /** Cliffs, city blocks, fence, forest or shore along the boundary (built with the map). */
  border: BorderVisuals | null = null;
  /** Client-only physics for ragdolls, debris and blood (built with the map). */
  private physics: EffectsWorld | null = null;
  readonly blood: BloodVisuals;
  /** How hard each recently hit player was pushed (shots and blasts), for the ragdoll's throw. */
  private readonly pushes = new Map<number, { v: Vec3; t: number; f: number }>();
  private lastFrame = performance.now();
  private debrisBodies: { mesh: Mesh; body: ReturnType<EffectsWorld['addBody']>; born: number; shared?: boolean }[] = [];
  readonly impacts: ImpactVisuals;
  /** Squads that come in through a vent, hatch, burrow or breach (their NPCs get an entrance). */
  private entrances: Extract<MapEntity, { kind: 'encounter' }>[] = [];
  readonly throwArc: ThrowArc;
  private corpses: Corpse[] = [];
  /** Players whose body is lying as a corpse and who haven't respawned yet. */
  private readonly lyingDead = new Set<number>();
  bodies: BodiesSetting = bodiesPreference();

  /** Remember a push on a player (from a hit or a blast) so their ragdoll flies the right way if it kills them. */
  pushPlayer(slot: number, v: Vec3, max = 3.5): void {
    const now = performance.now();
    const old = this.pushes.get(slot);
    const keep = old && now - old.t < 250 ? old.v : { x: 0, y: 0, z: 0 };
    // Bursts stack, but bodies drop and slump rather than fly: cap the total (blasts allow more).
    const sum = { x: keep.x + v.x, y: keep.y + v.y, z: keep.z + v.z };
    const flat = Math.hypot(sum.x, sum.z);
    const k = flat > max ? max / flat : 1;
    this.pushes.set(slot, { v: { x: sum.x * k, y: Math.min(sum.y, max * 0.9), z: sum.z * k }, t: now, f: this.scene.getFrameId() });
    const anim = this.avatars.get(slot)?.anim;
    if (anim instanceof CreatureAnimator) anim.flinch();
  }

  /**
   * A round or blow landed on a player: their body flinches at the part hit
   * (head, torso, legs), harder for heavier hits, and a heavy hit plays the
   * hit reaction on the upper body (characterAnimator flinch).
   */
  flinchPlayer(slot: number, dir: Vec3, zone: number, strength: number): void {
    const a = this.avatars.get(slot);
    const anim = a?.anim;
    if (!a || !(anim instanceof CharacterAnimator)) return;
    const k = Math.min(1, strength / 2);
    anim.flinch(zone, dir, 0.35 + 0.65 * k);
    // The hit clip over the flinch only where it shows (as remote shots' recoil, SHOT_OVERLAY_REACH).
    const eye = this.scene.activeCamera?.globalPosition;
    const near = !eye || Math.hypot(a.root.position.x - eye.x, a.root.position.z - eye.z) <= SHOT_OVERLAY_REACH;
    if (strength >= 1.6 && near) anim.trigger(zone === 1 ? 'hit_head' : 'hit');
  }

  cameraPosition(): Vec3 {
    const p = this.camera.position;
    return { x: p.x, y: p.y, z: p.z };
  }

  /**
   * A blast throws anyone near it, so the ones it kills fly up and away from
   * it with its force (shaped like the game's own throw, sim/impact.ts
   * blastThrow: out, and up harder from below).
   */
  blast(at: Vec3, radius: number): void {
    // Bigger blasts throw harder (a frag about 12 m/s at its heart, a big bomb 16).
    const force = Math.min(16, 6 + radius * 1.4);
    for (const [slot, a] of this.avatars) {
      const d = { x: a.root.position.x - at.x, y: a.root.position.y + 1 - at.y, z: a.root.position.z - at.z };
      const dist = Math.hypot(d.x, d.y, d.z);
      if (dist > radius * 1.5) continue;
      const speed = force * (1 - 0.6 * (dist / (radius * 1.5)));
      const flat = Math.hypot(d.x, d.z) || 1;
      const out = speed * 0.85;
      const up = speed * Math.max(0.5, 0.9 + 0.35 * (d.y / Math.max(0.3, dist)));
      this.pushPlayer(slot, { x: (d.x / flat) * out, y: up, z: (d.z / flat) * out }, force);
    }
  }

  /** Where a player's chest is drawn (for blood on kills). */
  chestOf(slot: number): Vec3 | null {
    const a = this.avatars.get(slot);
    if (!a) return null;
    return { x: a.root.position.x, y: a.root.position.y + 1.1, z: a.root.position.z };
  }

  /**
   * A fresh death becomes a dead body of the tier its place calls for (near or
   * in view: a full ragdoll; far: a cheap one; out of view: laid down), fitted
   * into the budget of awake ragdoll bodies: farther ragdolls drop a tier
   * first (ragdollBudget.ts). Every death ends up on the ground.
   */
  private startRagdoll(slot: number, a: Avatar, planes: readonly Plane[] | null): void {
    const root = a.anim?.skeletonRoot;
    if (!(a.anim instanceof CharacterAnimator) || !root || !this.physics) return;
    const push = this.pushes.get(slot);
    // A blast's push goes with every body it killed, however many frames later the body starts (PUSH_KEEP_MS).
    const died = a.diedAt ?? performance.now();
    const diedFrame = a.diedFrame ?? this.scene.getFrameId();
    const kept = !!push && (Math.abs(died - push.t) < PUSH_KEEP_MS || Math.abs(diedFrame - push.f) <= PUSH_KEEP_FRAMES);
    const fresh = kept ? push.v : { x: 0, y: 0, z: 0 };
    this.deathPush.set(slot, Math.round(Math.hypot(fresh.x, fresh.y, fresh.z) * 10) / 10);
    const v = { x: a.vel.x * 0.6 + fresh.x, y: 0.5 + fresh.y, z: a.vel.z * 0.6 + fresh.z };
    const p = a.root.position;
    const cam = this.scene.activeCamera?.globalPosition;
    const dist = cam ? Math.hypot(p.x - cam.x, p.y - cam.y, p.z - cam.z) : 0;
    const view = planes ?? (this.scene.activeCamera ? Frustum.GetPlanes(this.scene.activeCamera.getTransformationMatrix()) : null);
    const seen = !view || inView(view, p.x, p.y + 0.9, p.z, CULL_RADIUS);
    const moving = this.movingRagdolls();
    // Full physics for bodies near or big on screen (a scope makes far ones big), cheap for small ones in view.
    const fov = (this.scene.activeCamera as { fov?: number } | null)?.fov ?? DEFAULT_FOV;
    const fit = fitBudget(tierFor(dist, seen, screenShare(dist, fov)), dist, moving.map((m) => ({ tier: m.body.tier, dist: m.dist })));
    for (const i of fit.drop) this.dropTier(moving[i]!.a);
    this.ragdollTiers[fit.tier]++;
    this.lastDeath = { slot, tier: fit.tier, dist: Math.round(dist * 10) / 10, seen };
    try {
      if (fit.tier === 'posed') this.layDown(a, v);
      else {
        a.anim.ragdoll(fit.tier === 'cheap' ? 'limp' : 'stop');
        a.ragdoll = new Ragdoll(this.physics, a.anim.ch.joints, root, v, fit.tier, facingOf(a));
      }
    } catch {
      a.ragdoll = undefined;
    }
  }

  /** The fresh deaths that may start their bodies this frame: the nearest RAGDOLL_BUDGET.startsPerFrame. */
  private deathsToStart(poses: readonly RemotePose[], eye: Vector3 | undefined): Set<number> {
    const fresh: [number, number][] = [];
    for (const p of poses) {
      if (p.alive) continue;
      const a = this.avatars.get(p.slot);
      if (!a?.wasAlive || !(a.anim instanceof CharacterAnimator) || a.ragdoll) continue;
      fresh.push([p.slot, eye ? (p.x - eye.x) ** 2 + (p.z - eye.z) ** 2 : 0]);
    }
    if (fresh.length > RAGDOLL_BUDGET.startsPerFrame) fresh.sort((x, y) => x[1] - y[1]);
    return new Set(fresh.slice(0, RAGDOLL_BUDGET.startsPerFrame).map((f) => f[0]));
  }

  /** The last death's tier, distance from the camera and whether it was in view (tests). */
  lastDeath: { slot: number; tier: RagdollTier; dist: number; seen: boolean } | null = null;

  /** The push (m/s) each player's last body started with (tests: a blast's dead fly with it). */
  readonly deathPush = new Map<number, number>();

  /** Deaths so far by the tier they got (tests and the perf check read these). */
  readonly ragdollTiers: Record<RagdollTier, number> = { full: 0, cheap: 0, posed: 0 };

  /** Ragdolls still simulating, with their distance from the camera. */
  private movingRagdolls(): { a: Avatar; body: Ragdoll; dist: number }[] {
    const cam = this.scene.activeCamera?.globalPosition;
    const out: { a: Avatar; body: Ragdoll; dist: number }[] = [];
    const add = (a: Avatar) => {
      const r = a.ragdoll;
      if (!(r instanceof Ragdoll) || r.frozen) return;
      const p = a.root.position;
      out.push({ a, body: r, dist: cam ? Math.hypot(p.x - cam.x, p.y - cam.y, p.z - cam.z) : 0 });
    };
    for (const a of this.avatars.values()) add(a);
    for (const c of this.corpses) add(c.a);
    return out;
  }

  /**
   * The nearest dead body along a ray whose ragdoll has come to rest (frozen), tested against a sphere at
   * its pelvis and one at its chest (it lies on the ground, so these cover most of it).
   */
  private restingBodyOnRay(from: Vec3, dir: Vec3, len: number): { a: Avatar; at: Vec3 } | null {
    let best: { a: Avatar; at: Vec3; t: number } | null = null as { a: Avatar; at: Vec3; t: number } | null;
    const test = (a: Avatar) => {
      const r = a.ragdoll;
      if (!(r instanceof Ragdoll) || !r.frozen || !(a.anim instanceof CharacterAnimator)) return;
      for (const name of ['pelvis', 'spine_02']) {
        const j = a.anim.ch.joints.get(name);
        if (!j) continue;
        const c = j.getAbsolutePosition();
        const t = (c.x - from.x) * dir.x + (c.y - from.y) * dir.y + (c.z - from.z) * dir.z;
        if (t < 0 || t > len + 0.4) continue;
        const px = from.x + dir.x * t - c.x, py = from.y + dir.y * t - c.y, pz = from.z + dir.z * t - c.z;
        if (px * px + py * py + pz * pz > 0.3 * 0.3) continue;
        if (!best || t < best.t) best = { a, at: { x: from.x + dir.x * t, y: from.y + dir.y * t, z: from.z + dir.z * t }, t };
      }
    };
    for (const c of this.corpses) test(c.a);
    for (const a of this.avatars.values()) test(a);
    return best ? { a: best.a, at: best.at } : null;
  }

  /** A resting body hit again: a ragdoll from the pose it lies in, if the budget has room (else it stays as it is). */
  private rewake(a: Avatar, push: Vec3): boolean {
    const root = a.anim?.skeletonRoot;
    if (!(a.anim instanceof CharacterAnimator) || !root || !this.physics) return false;
    const p = a.root.position;
    const cam = this.scene.activeCamera?.globalPosition;
    const dist = cam ? Math.hypot(p.x - cam.x, p.y - cam.y, p.z - cam.z) : 0;
    const moving = this.movingRagdolls();
    const fit = fitBudget(tierFor(dist, true), dist, moving.map((m) => ({ tier: m.body.tier, dist: m.dist })));
    if (fit.tier === 'posed') return false;
    for (const i of fit.drop) this.dropTier(moving[i]!.a);
    try {
      a.ragdoll?.dispose();
      a.anim.thawPose();
      a.anim.ragdoll(fit.tier === 'cheap' ? 'limp' : 'stop');
      a.ragdoll = new Ragdoll(this.physics, a.anim.ch.joints, root, push, fit.tier, facingOf(a));
      return true;
    } catch {
      return false;
    }
  }

  /** Past the budget: a full ragdoll carries on as a cheap one (same motion); a cheap one freezes where it is. */
  private dropTier(a: Avatar): void {
    const r = a.ragdoll;
    const root = a.anim?.skeletonRoot;
    if (!(r instanceof Ragdoll) || !(a.anim instanceof CharacterAnimator)) return;
    if (r.tier === 'cheap' || !root || !this.physics) {
      r.freeze();
      a.anim.freezePose();
      return;
    }
    const v = r.velocity;
    r.dispose();
    a.anim.ragdoll('limp');
    a.ragdoll = new Ragdoll(this.physics, a.anim.ch.joints, root, v, 'cheap', facingOf(a));
  }

  /** Out of view: no simulation; the body lies on the ground along the hit, in the death's final pose. */
  private layDown(a: Avatar, v: Vec3): void {
    const anim = a.anim as CharacterAnimator;
    const p = a.root.position;
    const hit = this.physics?.raycast({ x: p.x, y: p.y + 1, z: p.z }, { x: 0, y: -1, z: 0 }, 60);
    if (hit) p.y = p.y + 1 - hit.dist;
    // The death falls backwards: face against the push, so the body lies along the way it was thrown.
    if (Math.hypot(v.x, v.z) > 0.3) a.root.rotation.y = Math.atan2(-v.x, -v.z);
    a.root.rotation.x = 0;
    anim.lieDown();
    a.ragdoll = new PosedBody();
  }

  /** Dead bodies now: by tier, frozen, and physics bodies awake (the perf check reads these). */
  ragdollStats(): { full: number; cheap: number; posed: number; frozen: number; awakeBodies: number; pooled: number; deaths: Record<RagdollTier, number> } {
    const out = { full: 0, cheap: 0, posed: 0, frozen: 0, awakeBodies: 0, pooled: this.physics?.pooledOut ?? 0, deaths: { ...this.ragdollTiers } };
    const add = (a: Avatar) => {
      const r = a.ragdoll;
      if (!r) return;
      out[r.tier]++;
      if (r.frozen) out.frozen++;
      out.awakeBodies += r.bodies;
    };
    for (const a of this.avatars.values()) add(a);
    for (const c of this.corpses) add(c.a);
    return out;
  }

  /** Where a body that died without a ragdoll comes to rest: the first solid thing below it. */
  private startFall(x: number, y: number, z: number): { y: number; vy: number; ground: number } {
    const hit = this.physics?.raycast({ x, y: y + 0.3, z }, { x: 0, y: -1, z: 0 }, 200);
    return { y, vy: 0, ground: hit ? y + 0.3 - hit.dist : y };
  }

  private stepFall(a: Avatar, dt: number): void {
    const f = a.fall!;
    if (f.y <= f.ground) return;
    f.vy -= PLAYER.gravity * dt;
    f.y = Math.max(f.ground, f.y + f.vy * dt);
    a.root.position.y = f.y;
  }

  /** The fallen body becomes a corpse that outlives the player's respawn. */
  private toCorpse(slot: number, a: Avatar): void {
    this.avatars.delete(slot);
    this.atmosphere.shadowless.delete(a.root);
    this.lyingDead.add(slot);
    a.tag?.node.dispose(false, a.tag.node instanceof MeshClass);
    a.tag = undefined;
    a.aura?.setEnabled(false);
    a.jet?.setEnabled(false);
    a.trolley?.setEnabled(false);
    this.dropCanopy(a);
    a.flash?.setEnabled(false);
    a.flashRig?.hide();
    this.corpses.push({ a, slot, born: performance.now() });
    while (this.corpses.length > MAX_CORPSES) this.disposeAvatar(this.corpses.shift()!.a);
  }

  /** Ray test against the level's static shapes (null before the map is built). */
  raycastLevel(from: Vec3, dir: Vec3, maxDist: number): { dist: number; normal: Vec3 } | null {
    return this.physics?.raycast(from, dir, maxDist) ?? null;
  }

  /** Bodies currently lying in the level (for tests). */
  corpseCount(): number {
    return this.corpses.length;
  }

  /** Remove every body (a new round). */
  clearCorpses(): void {
    for (const c of this.corpses) this.disposeAvatar(c.a);
    this.corpses = [];
    this.lyingDead.clear();
  }

  // ---------------------------------------------------------------- shots

  /** World position of your own gun's muzzle (the viewmodel), or null while it isn't shown. */
  localMuzzle(): Vec3 | null {
    if (!this.viewmodel || !this.viewRoot.isEnabled(false)) return null;
    this.viewRoot.computeWorldMatrix(true);
    const p = Vector3.TransformCoordinates(new Vector3(0, this.muzzleY, this.muzzleZ + 0.02), this.viewRoot.getWorldMatrix());
    return { x: p.x, y: p.y, z: p.z };
  }

  /** World position of a remote player's muzzle, or null when their gun isn't drawn. */
  muzzleOf(slot: number): Vec3 | null {
    const m = this.avatars.get(slot)?.muzzle;
    if (!m || m.node.isDisposed()) return null;
    m.node.computeWorldMatrix(true);
    const p = Vector3.TransformCoordinates(m.local, m.node.getWorldMatrix());
    return { x: p.x, y: p.y, z: p.z };
  }

  /**
   * Draw one round of a shot: it leaves the muzzle, flies to where the game
   * says it landed, and then the target reacts: blood on a body (strength by
   * damage, more on a head), or a hole, sparks and dust on a wall. Bodies
   * lying in the way take the hit too and are knocked about.
   */
  shotVisual(o: { eye: Vec3; muzzle: Vec3 | null; to: Vec3; color: string; victim: number | null; zone: number; strength: number; def?: WeaponDefinition; local?: boolean; speed?: number; time?: number; tracer?: boolean; land?: boolean }): void {
    if (o.def?.view.beam) {
      this.addShot(o.def, o.muzzle ?? o.eye, o.to, o.color);
      this.landRound(o);
      return;
    }
    // Bullets fly at their real speed (and only tracer rounds draw); `land: false` when the server's impact will land it.
    this.impacts.fire(o.muzzle ?? { x: o.eye.x, y: o.eye.y - 0.1, z: o.eye.z }, o.to, o.color, o.land === false ? undefined : () => this.landRound(o), o.local ? 1.5 : 0, { ...(o.speed ? { speed: o.speed } : {}), ...(o.tracer === false ? { tracer: false } : {}) });
  }

  /** What happens where a round lands (see shotVisual). */
  landRound(o: { eye: Vec3; to: Vec3; victim: number | null; zone: number; strength: number }): void {
    const d = { x: o.to.x - o.eye.x, y: o.to.y - o.eye.y, z: o.to.z - o.eye.z };
    const len = Math.hypot(d.x, d.y, d.z) || 1;
    const dir = { x: d.x / len, y: d.y / len, z: d.z / len };
    // A corpse in the line of fire.
    const hit = this.physics?.raycastRagdoll(o.eye, dir, len);
    const owner = hit ? this.movingRagdolls().find((m) => m.body.owns(hit.body)) : undefined;
    const body = owner ? hit : null;
    if (body) {
      const at = { x: o.eye.x + dir.x * body.dist, y: o.eye.y + dir.y * body.dist, z: o.eye.z + dir.z * body.dist };
      body.body.applyImpulseAtPoint({ x: dir.x * 4 * o.strength, y: dir.y * 4 * o.strength + 0.4, z: dir.z * 4 * o.strength }, at, true);
      this.blood.hit(at, dir, o.strength);
      // Its time to settle starts again from the hit (else a body hit late in its fall froze mid-tumble).
      owner?.body.kick();
    } else {
      // A body that has come to rest (its capsules went back to the pool) is a ragdoll again when hit.
      const rest = this.restingBodyOnRay(o.eye, dir, len);
      if (rest) {
        const push = { x: dir.x * 2.5 * o.strength, y: 0.6 + dir.y * 2.5 * o.strength, z: dir.z * 2.5 * o.strength };
        if (this.rewake(rest.a, push)) this.blood.hit(rest.at, dir, o.strength);
      }
    }
    if (o.victim !== null) {
      this.blood.hit(o.to, dir, o.zone === 1 ? o.strength * 1.8 : o.strength);
      this.accent(impactStyle('flesh').accent, o.to);
      return;
    }
    // A round stopped by a pane (bulletproof glass, a pane about to break): a star crack and a few glints, no dust.
    const pane = this.scenario.glass.strike(o.eye, o.to);
    if (pane) {
      this.impacts.sparkBurst(pane.point, 3, 1.2);
      return;
    }
    const wall = this.impacts.surfaceHit(o.eye, o.to);
    if (wall) {
      // The surface type it hit (content/surface-types.json, the same one the server's ballistic class comes from;
      // drawn as content/vfx.json map.impacts says): metal sparks, bark and wood splinters, foliage leaves.
      const style = impactStyle(wall.surface ?? surfaceOfBox(wall.box, this.surfaces));
      this.impacts.wallImpact(wall.point, wall.normal, Math.min(1.6, 0.7 + o.strength * 0.4), style);
      this.accent(style.accent, wall.point, wall.normal);
    }
  }

  /** The surface type a round from `from` landing at `to` struck in the level (null: nothing there, or a body). */
  surfaceStruck(from: Vec3, to: Vec3): Surface | null {
    const wall = this.impacts.surfaceHit(from, to);
    return wall ? (wall.surface ?? surfaceOfBox(wall.box, this.surfaces)) : null;
  }

  /** The accent of a surface hit somewhere other than the level (a round going into water). */
  surfaceAccent(surface: Surface, at: Vec3): void {
    this.accent(impactStyle(surface).accent, at);
  }

  /** A minor effect near the camera (an impact's accent): skipped far away and when many effects are playing. */
  private accent(fx: FxRef | null, at: Vec3, up?: Vec3): void {
    if (!fx) return;
    const cam = this.scene.activeCamera?.globalPosition;
    if (cam && Math.hypot(cam.x - at.x, cam.y - at.y, cam.z - at.z) > ACCENT_RANGE) return;
    this.vfx.play(fx.pack, fx.effect, new Vector3(at.x, at.y, at.z), { scale: fx.scale, minor: true, ...(up ? { up: new Vector3(up.x, up.y, up.z) } : {}) });
  }

  /** A moment of play's effect (content/vfx.json map.gameplay: `pickup.health`, `spawn`, `portal`, `pad`, `trap.shock`, `zipline` …). */
  playGameplayFx(key: string, at: Vec3): boolean {
    const fx = gameplayFx(key);
    if (!fx) return false;
    const cam = this.scene.activeCamera?.globalPosition;
    if (cam && Math.hypot(cam.x - at.x, cam.y - at.y, cam.z - at.z) > ACCENT_RANGE * 2) return false;
    return this.vfx.play(fx.pack, fx.effect, new Vector3(at.x, at.y, at.z), { scale: fx.scale, minor: true });
  }

  /**
   * A stylised hit from Binbun's Hit FX (godotVfx.ts; content/vfx.json map.weaponImpacts): `melee` on a body, else
   * where a round of `def` lands when that weapon has an impact of its own (the railgun). False when it has none or the pack isn't in.
   */
  hitFx(at: Vec3, kind: 'melee' | WeaponDefinition): boolean {
    const fx = kind === 'melee' ? meleeImpact(Math.random() < 0.5) : weaponImpact(kind);
    return !!fx && this.vfx.play(fx.pack, fx.effect, new Vector3(at.x, at.y, at.z), { scale: fx.scale });
  }

  /** A brief muzzle flash on a remote player's gun: the pack's flash for that weapon (muzzleFlash.ts), else the plain star. */
  remoteFlash(slot: number, def?: WeaponDefinition, alt = false): void {
    const a = this.avatars.get(slot);
    if (!a?.muzzle) return;
    const barrel = alt ? def?.view.altShot : undefined;
    const fx = barrel ? { id: barrel.flash.effect, scale: barrel.flash.scale ?? 0.2 } : def ? muzzleEffectFor(def) : null;
    if (barrel?.smoke) {
      // The cloud hangs where they fired, rolling out along the barrel.
      a.muzzle.node.computeWorldMatrix(true);
      const m = a.muzzle.node.getWorldMatrix();
      const at = Vector3.TransformCoordinates(a.muzzle.local, m);
      const fwd = Vector3.TransformNormal(new Vector3(0, 0, 1), m).normalize();
      this.muzzleSmoke(at, fwd, barrel.smoke);
      this.smokeClouds.remote++;
    }
    // The pack's flash only near the camera, on a few guns at a time (each rig is a dozen meshes);
    // further off, or in a crowd, the plain star does.
    const near = Vector3.DistanceSquared(a.root.position, this.camera.globalPosition) < REMOTE_FLASH_RANGE * REMOTE_FLASH_RANGE;
    if (fx && near && MuzzleFlashRig.ready() && (a.flashRig || this.remoteRigs < MAX_REMOTE_RIGS)) {
      if (!a.flashRig) {
        a.flashRig = new MuzzleFlashRig(this.scene, `${a.root.name}_flashRig`);
        this.remoteRigs++;
      }
      // A little bigger than your own: it's seen from further off.
      if (a.flashRig.fire(fx.id, fx.scale * 1.25)) {
        this.placeRemoteFlash(a);
        return;
      }
    }
    a.flash ??= this.createFlash(a.root.name);
    a.flashUntil = performance.now() + 55;
    kickFlash(a.flash, 1);
  }

  /** Put a remote flash rig at the muzzle, pointing down the barrel. */
  private placeRemoteFlash(a: Avatar): void {
    if (!a.flashRig || !a.muzzle) return;
    a.muzzle.node.computeWorldMatrix(true);
    const m = a.muzzle.node.getWorldMatrix();
    const at = Vector3.TransformCoordinates(a.muzzle.local, m);
    const fwd = Vector3.TransformNormal(new Vector3(0, 0, 1), m).normalize();
    a.flashRig.root.position.copyFrom(at);
    a.flashRig.root.lookAt(at.add(fwd));
  }

  private createFlash(name: string): Mesh {
    return createStarFlash(this.scene, `${name}_flash`, 0.55);
  }

  /** Step the effects physics and everything riding on it. */
  private updateEffects(): void {
    const now = performance.now();
    // Physics steps at most 0.1 s; short-lived effects age by the clock, or in slow frames (a struggling
    // computer) they lived several times longer while hits kept coming, and the pile slowed frames further.
    const wall = Math.min(1, (now - this.lastFrame) / 1000);
    const dt = Math.min(0.1, wall);
    this.lastFrame = now;
    // The performance split (perfProbe.SYS): prop flames, effects, ragdolls; one boolean check each when off.
    const prof = perfProbe.on;
    let t = prof ? now : 0;
    this.propFlames.want(this.camera.globalPosition);
    if (prof) t = perfProbe.add(SYS.flames, t);
    this.lasting.update(this.camera.globalPosition);
    if (prof) t = perfProbe.add(SYS.fx, t);
    this.propFlames.show();
    if (prof) t = perfProbe.add(SYS.flames, t);
    if (this.vfx.count) {
      // The packs' toon smoke is lit like everything else: this sun, this sky.
      if (this.sunLight) this.vfx.setLight(this.sunLight.direction.clone(), this.sunLight.diffuse.scale(this.sunLight.intensity), (this.hemi?.diffuse ?? Color3.White()).scale((this.hemi?.intensity ?? 0.8) * 0.7));
      this.vfx.update(dt * 1000);
    }
    this.impacts.update(wall);
    // Remote muzzle flashes follow the guns.
    for (const a of this.avatars.values()) {
      if (a.flashRig?.update(now)) this.placeRemoteFlash(a);
      if (!a.flash) continue;
      const on = now < (a.flashUntil ?? 0) && !!a.muzzle;
      a.flash.setEnabled(on);
      if (on && a.muzzle) {
        a.muzzle.node.computeWorldMatrix(true);
        a.flash.position.copyFrom(Vector3.TransformCoordinates(a.muzzle.local, a.muzzle.node.getWorldMatrix()));
      }
    }
    if (prof) t = perfProbe.add(SYS.fx, t);
    for (const a of this.avatars.values()) if (a.fall && !a.ragdoll) this.stepFall(a, dt);
    for (const c of this.corpses) if (c.a.fall && !c.a.ragdoll) this.stepFall(c.a, dt);
    if (this.physics) {
      this.physics.step(dt);
      // A body that stops (it rested, or its time ran out) keeps its pose as it is, at no cost per frame.
      const settle = (a: Avatar) => {
        if (!a.ragdoll || a.ragdoll.frozen) return;
        if (prof) perfProbe.n[COUNT.ragdolls]!++;
        if (a.ragdoll.update() && a.anim instanceof CharacterAnimator) a.anim.freezePose();
      };
      for (const a of this.avatars.values()) settle(a);
      const eye = this.camera.globalPosition;
      this.corpses = this.corpses.filter((c) => {
        settle(c.a);
        // Crowds: bodies past the shadow reach cast none, like the living.
        if (this.crowd && Math.hypot(c.a.root.position.x - eye.x, c.a.root.position.z - eye.z) > CROWD_SHADOW_REACH) this.atmosphere.shadowless.add(c.a.root);
        else this.atmosphere.shadowless.delete(c.a.root);
        if (this.bodies !== 'fade') return true;
        const age = (now - c.born) / 1000 - CORPSE_STAY;
        if (age <= 0) return true;
        if (age >= CORPSE_SINK) {
          this.disposeAvatar(c.a);
          return false;
        }
        // Sink into the ground: the ragdoll lets go and the body slides down.
        if (c.a.ragdoll) {
          c.a.ragdoll.dispose();
          c.a.ragdoll = undefined;
          if (c.a.anim instanceof CharacterAnimator) c.a.anim.thawPose();
        }
        c.a.root.position.y -= dt * 0.5;
        return true;
      });
      this.debrisBodies = this.debrisBodies.filter((d) => {
        const age = (now - d.born) / 1000;
        if (age > DEBRIS_LIFE) {
          if (!d.shared) d.mesh.material?.dispose();
          d.mesh.dispose();
          this.physics!.remove(d.body);
          return false;
        }
        const t = d.body.translation();
        const r = d.body.rotation();
        d.mesh.position.set(t.x, t.y, t.z);
        d.mesh.rotationQuaternion = new Quaternion(r.x, r.y, r.z, r.w);
        if (age > DEBRIS_LIFE - 0.6) d.mesh.scaling.setAll(Math.max(0.01, (DEBRIS_LIFE - age) / 0.6));
        return true;
      });
    }
    if (prof) t = perfProbe.add(SYS.ragdoll, t);
    this.blood.update(wall);
    if (prof) {
      perfProbe.add(SYS.fx, t);
      perfProbe.n[COUNT.lasting] = this.lasting.count;
      perfProbe.n[COUNT.effects] = this.vfx.count + this.effects.length;
    }
  }

  private dropCanopy(a: Avatar): void {
    if (a.canopy) releaseCanopy(this.scene, a.canopy.node, a.canopy.kind);
    a.canopy = undefined;
  }

  private localCanopy?: { node: TransformNode; kind: number };

  /** Your own canopy in first person (overhead, where looking up shows it); null packs it away. */
  updateLocalCanopy(pos: Vec3 | null, yaw: number, kind: number): void {
    if (this.localCanopy && (this.localCanopy.kind !== kind || !pos)) {
      releaseCanopy(this.scene, this.localCanopy.node, this.localCanopy.kind);
      this.localCanopy = undefined;
    }
    if (!pos || !kind) return;
    this.localCanopy ??= { node: createCanopy(this.scene, 'canopy_local', kind), kind };
    placeCanopy(this.localCanopy.node, pos, yaw, performance.now(), 0);
  }

  /** A jetpack flame (a glowing cone pointing down behind the shoulders). */
  /** The map's ziplines (riders' poses name one by index). */
  private ziplines: Zipline[] = [];
  private localTrolley?: TransformNode;

  /**
   * A zipline trolley: a steel block with two grooved wheels riding the
   * cable and a T-bar hanging down to the rider's hands. Built at the origin
   * with the cable along +Z at y 0; `parent` places it.
   */
  private createTrolley(name: string, parent: TransformNode | null, y: number): TransformNode {
    const root = new TransformNode(name, this.scene);
    root.parent = parent;
    root.position.y = y;
    const steel = glow(this.scene, 'trolleySteel', '#3a3f46', 0.15);
    const bright = glow(this.scene, 'trolleyBright', '#c9ccd0', 0.2);
    const part = (m: Mesh, x: number, py: number, z: number) => {
      m.parent = root;
      m.position.set(x, py, z);
      m.isPickable = false;
      return m;
    };
    part(CreateBox(`${name}_body`, { width: 0.07, height: 0.18, depth: 0.36 }, this.scene), 0.06, -0.02, 0).material = steel;
    for (const z of [-0.12, 0.12]) {
      const wheel = part(CreateCylinder(`${name}_wheel`, { diameter: 0.11, height: 0.05, tessellation: 12 }, this.scene), 0, 0.03, z);
      wheel.rotation.z = Math.PI / 2;
      wheel.material = bright;
    }
    const rod = part(CreateCylinder(`${name}_rod`, { diameter: 0.03, height: 0.3, tessellation: 6 }, this.scene), 0.06, -0.26, 0);
    rod.material = steel;
    const bar = part(CreateCylinder(`${name}_bar`, { diameter: 0.035, height: 0.5, tessellation: 6 }, this.scene), 0.06, -0.41, 0);
    bar.rotation.z = Math.PI / 2;
    bar.material = bright;
    return root;
  }

  /** Your own trolley in first person (overhead, where looking up shows it); null puts it away. */
  updateLocalTrolley(pos: Vec3 | null, zip: number | undefined, scale = 1): void {
    const line = zip !== undefined ? this.ziplines[zip] : undefined;
    if (!pos || !line) {
      this.localTrolley?.setEnabled(false);
      return;
    }
    this.localTrolley ??= this.createTrolley('trolley_local', null, 0);
    this.localTrolley.setEnabled(true);
    this.localTrolley.position.set(pos.x, pos.y + hangDepth(scale), pos.z);
    this.localTrolley.rotation.y = Math.atan2(line.dir.x, line.dir.z);
    this.localTrolley.rotation.x = -Math.asin(line.dir.y);
  }

  private createJetFlame(parent: TransformNode): Mesh {
    const flame = CreateCylinder('jetFlame', { diameterTop: 0.22, diameterBottom: 0.02, height: 0.8, tessellation: 10 }, this.scene);
    flame.parent = parent;
    flame.position.set(0, 0.75, -0.28);
    flame.material = glow(this.scene, 'jetFlameMat', '#ffa040');
    flame.isPickable = false;
    return flame;
  }

  /** Under the surface of a liquid the view is hazed in its colour (the backdrop's haze comes back on the way out). */
  private updateUnderwater(): void {
    const l = this.liquids.length ? liquidAt(this.liquids, this.camera.position) : null;
    const kind = l?.liquid ?? null;
    if (kind === this.underLiquid) return;
    if (this.underLiquid === null) this.dryFog = { mode: this.scene.fogMode, color: this.scene.fogColor.clone(), density: this.scene.fogDensity };
    this.underLiquid = kind;
    if (kind) {
      this.scene.fogMode = 2;
      this.scene.fogColor = Color3.FromHexString(LIQUID_LOOKS[kind].color).scale(0.6);
      this.scene.fogDensity = kind === 'water' ? 0.09 : 0.5;
    } else if (this.dryFog) {
      this.scene.fogMode = this.dryFog.mode;
      this.scene.fogColor = this.dryFog.color;
      this.scene.fogDensity = this.dryFog.density;
    }
  }

  private liquids: LiquidBox[] = [];
  private underLiquid: Liquid | null = null;
  private dryFog: { mode: number; color: Color3; density: number } | null = null;

  /** Place the view. `roll` is only ever set riding a vehicle (its gentle lean); on foot the view is always level. */
  setCamera(eye: Vec3, yaw: number, pitch: number, fov: number, roll = 0): void {
    this.camera.position.set(eye.x, eye.y, eye.z);
    this.steadyEye.pos.set(eye.x, eye.y, eye.z);
    this.steadyEye.yaw = yaw;
    this.steadyEye.pitch = pitch;
    const shake = this.currentShake();
    if (shake > 0) {
      // Trauma squared: big blasts jolt, small ones barely tremble.
      const t = performance.now() / 1000;
      const k = shake * shake;
      poseCamera(this.camera, yaw + Math.sin(t * 47 + 1.3) * 0.035 * k, pitch - Math.sin(t * 61) * 0.035 * k, roll + Math.sin(t * 53 + 2.1) * 0.025 * k);
      this.camera.position.y += Math.sin(t * 71) * 0.06 * k;
    } else poseCamera(this.camera, yaw, pitch, roll);
    this.camera.fov = fov;
    // Through a scope characters keep their full detail as far as they look as big as at the switch distance unzoomed.
    setCharacterLodZoom(Math.tan(DEFAULT_FOV / 2) / Math.tan(fov / 2));
    this.foliage.update(this.camera.position);
    this.environment?.update(this.camera.position);
    this.updateUnderwater();
    this.updateSmokeFog();
    this.updateEffects();
  }

  // ---------------------------------------------------------------- viewmodel

  /** Show the held weapon in first person (undefined hides it, e.g. while dead or scoped). */
  /** Viewmodel's top (where a sight sits) and rear, in its own space: placing it for aiming down the sights. */
  private sightTop = 0.1;
  private stockZ = -0.3;

  setViewmodel(def: WeaponDefinition | undefined): void {
    if (def?.id === this.viewWeapon) return;
    this.viewWeapon = def?.id;
    const load = ++this.viewLoad;
    // Guns you've held are kept (hidden), so switching back is instant: building one each switch hitched the frame,
    // badly when scrolling through several.
    this.viewmodel?.setEnabled(false);
    this.viewmodel = undefined;
    if (!def) return;
    const show = (v: { node: TransformNode; muzzleZ: number; muzzleY: number; sightTop: number; stockZ: number }) => {
      ({ muzzleZ: this.muzzleZ, muzzleY: this.muzzleY, sightTop: this.sightTop, stockZ: this.stockZ } = v);
      v.node.setEnabled(true);
      this.viewmodel = v.node;
      this.fpArms?.anim?.gripExternal(v.node, def.view.hold);
      if (this.fpBody?.a.anim instanceof CharacterAnimator) this.fpBody.a.anim.gripExternal(v.node, def.view.hold);
    };
    const kept = this.viewmodels.get(def.id);
    if (kept) return show(kept);
    void this.models.instantiate(def.view.model, `view_${def.id}`).then((node) => {
      // Measure before parenting, in the model's own space.
      const bounds = node.getHierarchyBoundingVectors(true);
      node.parent = this.viewRoot;
      // Draw on top of the world so the gun never clips into walls.
      for (const m of node.getChildMeshes()) m.renderingGroupId = 1;
      const at = def.view.muzzleAt;
      const v = { node, muzzleZ: at ? at[2] : bounds.max.z, muzzleY: at ? at[1] : (bounds.min.y + bounds.max.y) / 2 + (bounds.max.y - bounds.min.y) * 0.2, sightTop: bounds.max.y, stockZ: bounds.min.z };
      this.viewmodels.set(def.id, v);
      this.viewmodelPaths.set(def.id, def.view.model);
      node.setEnabled(false);
      if (load === this.viewLoad) show(v);
      // Medium and High: the sharper copy of the same model for your own hands, swapped in once it has loaded.
      const held = heldModel(def, this.atmosphere.quality);
      if (held) this.sharpenViewmodel(def, v, held);
    });
  }

  /** Which copy of each kept first-person gun is drawn (tests): the model path. */
  readonly viewmodelPaths = new Map<string, string>();

  /**
   * Guns no longer carried (dropped, or the match changed hands) leave the kept first-person guns, and a sharper held
   * copy's maps leave the GPU with them: held copies at High are about 30 MB of video memory each, so only the guns
   * you carry keep theirs (docs/ARSENAL.md, "Texture tiers"). `carried`: weapon ids.
   */
  trimViewmodels(carried: ReadonlySet<string>): void {
    for (const [id, v] of this.viewmodels) {
      if (carried.has(id) || id === this.viewWeapon) continue;
      if (this.viewmodel === v.node) this.viewmodel = undefined;
      v.node.dispose();
      this.viewmodels.delete(id);
      const path = this.viewmodelPaths.get(id);
      this.viewmodelPaths.delete(id);
      const def = CORE_WEAPONS[id];
      if (path && def?.view.held && path !== def.view.model) this.models.release(path);
    }
  }

  // ---------------------------------------------------------------- throw hold

  /** Your own throwable in your hands while you line up a throw (setThrowHold). */
  private throwHold: { kind: ThrowableKind; path: string; node: TransformNode | null } | null = null;
  /** Each throwable's model in your hands, made once and kept (hidden) like the guns you have held. */
  private readonly throwModels = new Map<string, Promise<TransformNode | null>>();
  private throwRoot: TransformNode | null = null;

  /**
   * Lining up a throw (G held) with `kind`, or null when not: the gun goes away and the throwable's model
   * (content/throwables.json `view`) comes up in both hands, held like a pistol's grip with the support hand round
   * it; let go and the same model flies off. Throwables drawn in code (no model) leave the gun in hand.
   */
  setThrowHold(kind: ThrowableKind | null): void {
    const path = kind ? throwableModel(kind, this.setLook) : null;
    if (this.throwHold?.kind === kind && this.throwHold?.path === path) return;
    if (this.throwHold) {
      this.throwHold.node?.setEnabled(false);
      this.throwHold = null;
      this.restoreGrip();
    }
    if (!kind || !path) return;
    const hold = { kind, path, node: null as TransformNode | null };
    this.throwHold = hold;
    void this.throwModel(path).then((node) => {
      if (this.throwHold !== hold || !node) return;
      hold.node = node;
      node.setEnabled(true);
      this.viewmodel?.setEnabled(false);
      this.fpArms?.anim?.gripExternal(node, THROW_HOLD);
      if (this.fpBody?.a.anim instanceof CharacterAnimator) this.fpBody.a.anim.gripExternal(node, THROW_HOLD);
    });
  }

  /** The model of the throwable in your hands now, or null (tests). */
  throwHoldShown(): string | null {
    return this.throwHold?.node?.isEnabled() ? this.throwHold.path : null;
  }

  private throwModel(path: string): Promise<TransformNode | null> {
    let p = this.throwModels.get(path);
    if (!p) {
      if (!this.throwRoot) {
        this.throwRoot = new TransformNode('throwRoot', this.scene);
        this.throwRoot.parent = this.camera;
        this.throwRoot.position.set(...THROW_HOLD_AT);
      }
      const root = this.throwRoot;
      p = this.models.instantiate(path, `throwHold_${this.throwModels.size}`).then(
        (node) => {
          node.parent = root;
          // Drawn over the world like the gun, so it never clips into a wall in front of you.
          for (const m of node.getChildMeshes()) m.renderingGroupId = 1;
          node.setEnabled(false);
          return node;
        },
        () => null,
      );
      this.throwModels.set(path, p);
    }
    return p;
  }

  /** The hands back on the gun after a throw hold. */
  private restoreGrip(): void {
    const def = this.viewWeapon ? getWeapon(this.viewWeapon) : undefined;
    const node = def ? (this.viewmodel ?? null) : null;
    node?.setEnabled(true);
    this.fpArms?.anim?.gripExternal(node, def?.view.hold ?? null);
    if (this.fpBody?.a.anim instanceof CharacterAnimator) this.fpBody.a.anim.gripExternal(node, def?.view.hold ?? null);
  }

  /**
   * Swap a kept first-person gun for its sharper copy (view.held: the same mesh with bigger maps, docs/ARSENAL.md
   * "Texture tiers"): fetched only for the guns you hold, drawn the moment it is in; until then (or if it fails) the
   * copy everyone else sees stays in your hands. Same mesh, so the muzzle, sight and hold numbers carry over.
   */
  private sharpenViewmodel(def: WeaponDefinition, v: { node: TransformNode }, path: string): void {
    void this.models.instantiate(path, `view_${def.id}_held`).then(
      (node) => {
        if (this.viewmodels.get(def.id) !== v || this.scene.isDisposed) return node.dispose();
        node.parent = this.viewRoot;
        for (const m of node.getChildMeshes()) m.renderingGroupId = 1;
        const old = v.node;
        node.setEnabled(old.isEnabled());
        v.node = node;
        this.viewmodelPaths.set(def.id, path);
        if (this.viewmodel === old) {
          this.viewmodel = node;
          this.fpArms?.anim?.gripExternal(node, def.view.hold);
          if (this.fpBody?.a.anim instanceof CharacterAnimator) this.fpBody.a.anim.gripExternal(node, def.view.hold);
        }
        old.dispose();
      },
      () => undefined,
    );
  }

  /**
   * Show your own character's arms in first person, holding the viewmodel.
   * The arms hang from the camera at shoulder height; the gun keeps its
   * viewmodel placement (bob, recoil, reload dip) and the hands follow it by IK.
   */
  /** The match's weapon set (sim/weaponSets.ts), whose looks grenades wear in hands, in flight and as pickups. */
  private setLook: string | undefined;

  /** The match's weapon set (the session, on joining and when the host changes it): grenades drawn from now on wear its looks. */
  setWeaponSetLook(set: string | undefined): void {
    this.setLook = set;
  }

  setLocalLook(look: string | undefined): void {
    this.localLook = look;
    // Full body draws your own character instead: the arms are built only if first person falls back to them.
    if (this.fpMode === 'arms') this.buildFpArms();
  }

  /** First person: your whole character ('body') or arms only ('arms'); applies from the next frame. */
  setFirstPersonMode(mode: FirstPersonMode): void {
    this.fpMode = mode;
    if (mode === 'arms') this.buildFpArms();
  }

  get firstPersonMode(): FirstPersonMode {
    return this.fpMode;
  }

  /** Whether your own whole body is drawn in first person now (tests). */
  hasFirstPersonBody(): boolean {
    return !!this.fpBody;
  }

  /** Build your look's first-person arms (arms-only first person, and full body's fallback in a seat). */
  private buildFpArms(): void {
    const look = this.localLook;
    if (!look || this.fpArms?.look === look) return;
    this.fpArms?.anim?.dispose();
    this.fpArms?.root.dispose();
    const root = new TransformNode('fpArms', this.scene);
    root.parent = this.camera;
    const arms = { look, anim: null as CharacterAnimator | null, root };
    this.fpArms = arms;
    void this.characters.create({ look: armsLookFor(look), armsOnly: true }, 'fpArmsChar').then((ch) => {
      if (this.fpArms !== arms) return ch.dispose();
      fitFirstPersonArms(ch, root);
      for (const m of ch.meshes) {
        m.renderingGroupId = 1;
        m.receiveShadows = false;
      }
      arms.anim = new CharacterAnimator(this.scene, ch);
      if (this.viewmodel && this.viewWeapon) arms.anim.gripExternal(this.viewmodel, getWeapon(this.viewWeapon).view.hold);
    });
  }

  /** Your own quick melee in first person: since when (ms), and a punch or a kick. */
  private strikeMotion: { kind: 'punch' | 'kick'; t0: number } | null = null;
  /** Your own punches and kicks so far (tests). */
  readonly strikes = { punch: 0, kick: 0 };
  /** Your boot, seen for a kick (made on first need). */
  private boot?: Mesh;

  /**
   * Your own punch or kick (quick melee) in first person: for a punch the
   * gun dips aside and the arms throw a jab or a cross; for a kick the gun
   * dips and your boot comes up into view and snaps forward.
   */
  localStrike(kind: 'punch' | 'kick', jab: boolean): void {
    this.strikeMotion = { kind, t0: performance.now() };
    this.strikes[kind]++;
    if (kind === 'punch') this.fpArms?.anim?.trigger(jab ? 'jab' : 'melee');
    if (kind === 'punch') this.fpBody?.a.anim?.trigger(jab ? 'jab' : 'melee');
    if (kind === 'kick' && !this.boot) {
      const boot = CreateBox('fpBoot', { width: 0.13, height: 0.11, depth: 0.3 }, this.scene);
      const mat = new StandardMaterial('fpBootMat', this.scene);
      mat.diffuseColor = new Color3(0.16, 0.13, 0.11);
      mat.specularColor = new Color3(0.05, 0.05, 0.05);
      boot.material = mat;
      boot.isPickable = false;
      boot.parent = this.camera;
      boot.renderingGroupId = this.viewRoot.getChildMeshes()[0]?.renderingGroupId ?? 0;
      boot.setEnabled(false);
      this.boot = boot;
    }
  }

  /** 0..1..0 over a strike: quick out, slower back. */
  private strikeAmount(now: number, seconds: number): number {
    const m = this.strikeMotion;
    if (!m) return 0;
    const t = (now - m.t0) / 1000 / seconds;
    if (t >= 1) return 0;
    return t < 0.3 ? Math.sin((t / 0.3) * (Math.PI / 2)) : Math.cos(((t - 0.3) / 0.7) * (Math.PI / 2));
  }

  /** Recoil kick and muzzle flash for a predicted shot (`alt`: the second trigger). */
  kick(def: WeaponDefinition, alt = false): void {
    const barrel = alt ? def.view.altShot : undefined;
    this.kickShot = !!barrel;
    if (barrel) {
      // A melee weapon's own barrel (the Battle Axe's blunderbuss): a gun's kick, a big flash and a cloud of smoke.
      this.kickAmount = 1;
      this.flashUntil = performance.now() + 60;
      this.starFlash = !this.flashRig.fire(barrel.flash.effect, (barrel.flash.scale ?? 0.2) * OWN_FLASH_SCALE);
      if (this.starFlash) kickFlash(this.flash, 1.8);
      const at = this.localMuzzle();
      if (at && barrel.smoke) {
        const m = this.viewRoot.getWorldMatrix();
        const fwd = Vector3.TransformNormal(new Vector3(0, 0, 1), m).normalize();
        this.muzzleSmoke(at, fwd, barrel.smoke);
        this.smokeClouds.local++;
      }
      return;
    }
    const rail = def.id === 'core.railgun';
    // Visual recoil (GUNPLAY_SPEC §29): the weapon's own kick strength when it has one; the camera's real climb is mechanical.
    const visual = gunplayOf(def).kick?.visual;
    this.kickAmount = Math.min(1, this.kickAmount + (def.kind === 'melee' ? 0.9 : visual !== undefined ? Math.min(1, visual * 0.75) : rail || def.pellets > 1 || def.projectile ? 1 : 0.45));
    if (rail) {
      // The rail slams back with a big blue-white flash.
      this.flashUntil = performance.now() + 80;
      this.starFlash = true;
      kickFlash(this.flash, 2);
      return;
    }
    if (def.kind === 'melee' || def.view.beam) return;
    this.flashUntil = performance.now() + 45;
    const fx = muzzleEffectFor(def);
    this.starFlash = !(fx && this.flashRig.fire(fx.id, fx.scale * OWN_FLASH_SCALE));
    if (this.starFlash) kickFlash(this.flash, def.pellets > 1 || def.damage >= 60 ? 1.5 : def.damage < 15 ? 0.7 : 1);
    if (def.kind === 'hitscan' && def.ammo) this.ejectCasing(def.pellets > 1 ? 1.6 : def.damage >= 60 ? 1.4 : 1);
  }

  /**
   * Black-powder smoke: a cloud of grey-white puffs rolling out along the barrel from the
   * muzzle, thinning and rising as it hangs in the air. `amount` 1 is a blunderbuss.
   */
  muzzleSmoke(at: Vec3, dir: { x: number; y: number; z: number }, amount: number): void {
    const n = Math.round(7 * amount);
    for (let i = 0; i < n; i++) {
      const t = 0.1 + (i / n) * 0.9 * amount + Math.random() * 0.15;
      const j = () => (Math.random() - 0.5) * 0.18 * (1 + t);
      const p = { x: at.x + dir.x * t + j(), y: at.y + dir.y * t + j() * 0.6, z: at.z + dir.z * t + j() };
      const speed = (1 - i / n) * 2.6 + 0.4;
      this.impacts.puff(p, i % 3 === 0 ? '#bdb7ad' : '#dcd8d0', (0.45 + Math.random() * 0.35) * amount * (0.7 + t * 0.4), 1.6 + Math.random() * 1.4, 0.25 + Math.random() * 0.3, false, { x: dir.x * speed, y: dir.y * speed + 0.1, z: dir.z * speed });
    }
  }

  /** A spent case flips out of the right side of your gun and rattles on the floor. */
  private ejectCasing(size: number): void {
    if (!this.physics || !this.viewmodel) return;
    this.viewRoot.computeWorldMatrix(true);
    const m = this.viewRoot.getWorldMatrix();
    const at = Vector3.TransformCoordinates(new Vector3(0.04, 0.05, this.muzzleZ * 0.35), m);
    const right = Vector3.TransformNormal(new Vector3(1, 0, 0), m).normalize();
    const up = Vector3.TransformNormal(new Vector3(0, 1, 0), m).normalize();
    const back = Vector3.TransformNormal(new Vector3(0, 0, -1), m).normalize();
    const v = right.scale(2.2 + Math.random()).add(up.scale(1.6 + Math.random())).add(back.scale(0.6));
    const shell = CreateCylinder('casing', { height: 0.03 * size, diameter: 0.011 * size, tessellation: 6 }, this.scene);
    shell.material = this.brass;
    shell.isPickable = false;
    shell.position.copyFrom(at);
    const body = this.physics.addBody({ kind: 'box', half: { x: 0.006 * size, y: 0.015 * size, z: 0.006 * size } }, at, { x: 0, y: 0, z: 0, w: 1 }, 'debris', { vel: v, spin: { x: Math.random() * 20, y: Math.random() * 20, z: 15 }, density: 2 });
    this.debrisBodies.push({ mesh: shell, body, born: performance.now(), shared: true });
    while (this.debrisBodies.filter((d) => d.shared).length > 40) {
      const i = this.debrisBodies.findIndex((d) => d.shared);
      const d = this.debrisBodies.splice(i, 1)[0]!;
      d.mesh.dispose();
      this.physics.remove(d.body);
    }
  }

  /** Position the viewmodel: offset, bob while moving, recoil, and dips for raising/reloading. */
  updateViewmodel(dt: number, o: { moving: boolean; raise: number; reload: number; hidden: boolean; ads?: number; speed?: number }): void {
    const def = this.viewWeapon ? getWeapon(this.viewWeapon) : undefined;
    this.viewRoot.setEnabled(!o.hidden && !!def);
    this.viewHidden = o.hidden || !def;
    // Full body: your own character's hands hold the gun instead of the arms.
    const arms = !o.hidden && !!def && !this.fpBody;
    this.fpArms?.root.setEnabled(arms);
    if (arms && this.fpArms?.anim) this.fpArms.anim.update(dt, { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0, celebrate: false });
    if (!def) return;
    this.kickAmount = Math.max(0, this.kickAmount - dt * 6);
    // The bob keeps pace with how fast you're actually going (a wall stops it; a sprint quickens it).
    const pace = o.moving ? (o.speed === undefined ? 1 : Math.min(1.5, o.speed / PLAYER.runSpeed)) : 0;
    this.bobPhase += dt * 9 * pace;
    this.bobAmount += (Math.min(1, pace) - this.bobAmount) * Math.min(1, dt * 8);
    const ads = o.ads ?? 0;
    const bob = this.bobAmount * (1 - ads * 0.8);
    const [vx, vy, vz] = def.view.viewOffset;
    // Aiming down the sights: the gun comes to the centre with the top of the receiver (where
    // the sight sits) just under the eye line, and far enough forward that the stock stays
    // out of view, so you look along the gun at the target (see the red dot on the HUD).
    const adsY = -(this.sightTop + 0.006);
    const adsZ = Math.max(vz, 0.2 - this.stockZ);
    const x = vx * (1 - ads);
    const y = vy + (adsY - vy) * ads;
    const z = vz + (adsZ - vz) * ads;
    // A melee weapon's barrel kicks like a heavy gun (back and up), not a swing.
    const melee = def.kind === 'melee' && !this.kickShot;
    const heavy = this.kickShot ? 2.6 : 1;
    this.viewRoot.position.set(
      x + Math.sin(this.bobPhase) * 0.012 * bob,
      y + Math.abs(Math.cos(this.bobPhase)) * 0.01 * bob - o.raise * 0.25 - o.reload * 0.08,
      z - this.kickAmount * (melee ? -0.25 : 0.06 * heavy) * (1 - ads * 0.5),
    );
    this.viewRoot.rotation.set(-this.kickAmount * (melee ? -0.6 : 0.12 * heavy) + o.reload * 0.6, melee ? this.kickAmount * 0.5 : 0, o.reload * 0.4);
    // A punch or kick: the gun dips out of the way (aside for a punch) while the fist or boot comes in.
    const now = performance.now();
    const kicking = this.strikeMotion?.kind === 'kick';
    const strike = this.strikeAmount(now, kicking ? 0.5 : 0.36);
    if (strike > 0) {
      this.viewRoot.position.y -= strike * (kicking ? 0.1 : 0.14);
      this.viewRoot.position.x += strike * (kicking ? 0 : 0.06);
      this.viewRoot.rotation.z += strike * (kicking ? 0.1 : 0.45);
    } else if (this.strikeMotion && now - this.strikeMotion.t0 > 600) this.strikeMotion = null;
    if (this.boot) {
      this.boot.setEnabled(kicking && strike > 0);
      if (kicking && strike > 0) {
        // From below the view, up and forward, toes first.
        this.boot.position.set(0.12, -0.95 + strike * 0.55, 0.35 + strike * 0.6);
        this.boot.rotation.set(-0.5 + strike * 0.4, 0, 0);
      }
    }
    const flashing = performance.now() < this.flashUntil;
    this.flash.setEnabled(flashing && this.starFlash);
    this.flashRig.root.position.set(0, this.muzzleY, this.muzzleZ + OWN_FLASH_AHEAD);
    this.flashRig.update();
    if (flashing) {
      this.flash.parent = this.viewRoot;
      this.flash.position.set(0, this.muzzleY, this.muzzleZ + 0.08);
    }
  }

  // ---------------------------------------------------------------- avatars

  /**
   * Update remote player and NPC avatars from interpolated poses. Each one is
   * a capsule until its character model has loaded, then an animated character.
   */
  updateAvatars(poses: readonly RemotePose[], localSlot: number, spec: (slot: number) => AvatarSpec, celebrate = false, allyColor: (slot: number) => string | null = () => null, seated: ReadonlySet<number> = new Set(), sitting: ReadonlyMap<number, { yaw: number; legDrop: number; straddle?: number }> = new Map()): void {
    const now = performance.now();
    this.avatarFrame++;
    const crowd = poses.length > ANIM_LOD_CROWD;
    this.crowd = crowd;
    // Crowds draw characters' low-detail meshes sooner.
    setCharacterLodCrowd(crowd);
    const planes = crowd && this.scene.activeCamera ? Frustum.GetPlanes(this.scene.activeCamera.getTransformationMatrix()) : null;
    // Shadows: the nearest SHADOW_CHARACTERS live characters in view cast (squared distance of the last that does).
    const eye = this.scene.activeCamera?.globalPosition;
    let shadowCut = Infinity;
    if (eye) {
      const near: number[] = [];
      for (const p of poses) {
        if (p.slot === localSlot || !p.alive) continue;
        if (planes && !inView(planes, p.x, p.y + 0.9, p.z, CULL_RADIUS)) continue;
        near.push((p.x - eye.x) ** 2 + (p.z - eye.z) ** 2);
      }
      if (near.length > SHADOW_CHARACTERS) shadowCut = near.sort((x, y) => x - y)[SHADOW_CHARACTERS - 1]!;
    }
    const seen = new Set<number>();
    let deathMs = 0;
    let deathsStarted = 0;
    // Fresh deaths start their bodies nearest first, RAGDOLL_BUDGET.startsPerFrame a frame at most (and DEATH_START_MS
    // of work): a blast that kills thirty spreads its starts over a few frames, the ones you see best first.
    const starting = this.deathsToStart(poses, eye);
    for (const p of poses) {
      if (p.slot === localSlot) {
        // Your own body in first person: kept loaded but not drawn (and not animated), so switching to
        // third person shows your character at once instead of a capsule while the model loads.
        if (!p.alive) continue;
        seen.add(p.slot);
        const want = spec(p.slot);
        const key = JSON.stringify(want);
        let a = this.avatars.get(p.slot);
        if (a && a.specKey !== key) {
          this.disposeAvatar(a);
          a = undefined;
        }
        if (!a) this.avatars.set(p.slot, (a = this.createAvatar(p.slot, want, key)));
        a.hiddenSelf = true;
        a.wasAlive = true;
        a.last = undefined;
        a.vel = { x: 0, z: 0 };
        // Full-body first person (from your own eyes; in a vehicle its view keeps the arms): your own character,
        // seen from its eyes, holding the gun.
        // (A character whose hat or cape would fill the view from its own eyes keeps the arms: its look's whole.body.)
        const bodyOk = !want.look || getLook(want.look).whole?.body !== false;
        if (this.fpMode === 'body' && bodyOk && this.firstPersonEye && !seated.has(p.slot) && a.anim instanceof CharacterAnimator) {
          this.showFpBody(a, p, now);
          continue;
        }
        if (this.fpBody) this.dropFpBody();
        // Arms only, or before your character has loaded.
        if (this.fpMode === 'arms' || !bodyOk || !this.firstPersonEye || seated.has(p.slot)) this.buildFpArms();
        a.root.setEnabled(false);
        a.root.position.set(p.x, p.y, p.z);
        a.root.rotation.y = p.yaw;
        if (a.anim instanceof CharacterAnimator) a.anim.setDormant(true);
        continue;
      }
      seen.add(p.slot);
      // Their body is lying as a corpse; they come back as a new avatar when they respawn.
      if (p.alive) this.lyingDead.delete(p.slot);
      else if (this.lyingDead.has(p.slot) && !this.avatars.has(p.slot)) continue;
      let a = this.avatars.get(p.slot);
      const want = spec(p.slot);
      const key = JSON.stringify(want);
      if (a && a.specKey !== key) {
        this.disposeAvatar(a);
        a = undefined;
      }
      if (!a) {
        a = this.createAvatar(p.slot, want, key);
        this.avatars.set(p.slot, a);
        if (want.npc && p.alive) this.arrive(a, p, now);
      }
      // Motion from successive interpolated positions.
      const dt = a.last ? (now - a.last.t) / 1000 : 0;
      if (a.last && dt > 0) {
        const k = Math.min(1, dt * 12);
        a.vel.x += ((p.x - a.last.x) / dt - a.vel.x) * k;
        a.vel.z += ((p.z - a.last.z) / dt - a.vel.z) * k;
        // Respawn teleports are not motion.
        if (Math.hypot(p.x - a.last.x, p.z - a.last.z) > 4) a.vel = { x: 0, z: 0 };
      }
      a.last = { x: p.x, y: p.y, z: p.z, t: now };
      // Shadows from the nearest few living characters (and anyone within SHADOW_ALWAYS); in crowds none past
      // CROWD_SHADOW_REACH, the dead and dying included (a body far off waiting for its ragdoll cast one before).
      const d2 = eye ? (p.x - eye.x) ** 2 + (p.z - eye.z) ** 2 : 0;
      if ((crowd && d2 > CROWD_SHADOW_REACH ** 2) || (p.alive && d2 > shadowCut && d2 > SHADOW_ALWAYS ** 2)) this.atmosphere.shadowless.add(a.root);
      else this.atmosphere.shadowless.delete(a.root);
      if (a.hiddenSelf) {
        // Back to third person: draw it again (it was kept loaded while hidden).
        if (this.fpBody?.a === a) this.dropFpBody();
        a.hiddenSelf = false;
        a.root.setEnabled(!a.culled);
        if (a.anim instanceof CharacterAnimator) a.anim.setDormant(!!a.culled);
      }
      // A creature plays its own death and is left lying where it fell (no ragdoll).
      if (a.wasAlive && !p.alive && a.anim instanceof CreatureAnimator) {
        a.anim.update(0, { speed: 0, moveAngle: 0, airborne: false, alive: false, pitch: 0, celebrate: false });
        a.fall = this.startFall(a.root.position.x, a.root.position.y, a.root.position.z);
        this.toCorpse(p.slot, a);
        continue;
      }
      // A fresh death hands the body to a ragdoll (when the effects world and the skeleton are ready).
      if (p.alive) a.diedAt = a.diedFrame = undefined;
      else if (a.wasAlive && a.diedAt === undefined) {
        a.diedAt = now;
        a.diedFrame = this.scene.getFrameId();
      }
      if (a.wasAlive && !p.alive && a.anim && this.physics && !a.ragdoll) {
        // A blast that kills twenty doesn't start twenty bodies in one frame: past a few milliseconds of
        // starting them, the rest hold their pose a frame or two and start on the next ones.
        if ((deathsStarted > 0 && deathMs > DEATH_START_MS) || !starting.has(p.slot)) continue;
        deathsStarted++;
        const t0 = performance.now();
        this.startRagdoll(p.slot, a, planes);
        deathMs += performance.now() - t0;
        if (a.ragdoll) {
          this.toCorpse(p.slot, a);
          continue;
        }
      }
      if (p.alive && a.ragdoll) {
        a.ragdoll.dispose();
        a.ragdoll = undefined;
        if (a.anim instanceof CharacterAnimator) a.anim.thawPose();
      }
      a.wasAlive = p.alive;
      // While ragdolled the body stays where it fell; physics moves the bones.
      if (!a.ragdoll) {
        // Dead without a ragdoll: the body falls from where it died instead of playing its death in mid-air.
        if (p.alive) a.fall = undefined;
        else a.fall ??= this.startFall(p.x, p.y, p.z);
        a.root.position.set(p.x, a.fall ? a.fall.y : p.y, p.z);
        if (a.emergeAt !== undefined) {
          const t = (now - a.emergeAt) / EMERGE_MS;
          if (t >= 1) a.emergeAt = undefined;
          else a.root.position.y -= EMERGE_DEPTH * (1 - t) * (1 - t);
        }
        a.root.rotation.y = p.yaw;
      }
      // Show hitboxes (dev and test setting): the shapes the host tests shots against, over the body.
      if (this.showHitboxes && p.alive && !a.ragdoll) {
        const h = hitboxForSpec(want);
        (a.hitbox ??= new BodyHitbox(this.scene)).show(a.root, h.box, (p.stance ?? 0) as Stance, h.scale);
      } else a.hitbox?.hide();
      // Crowds: characters outside the view (with a margin for their shadows) are left out of drawing
      // and the shadow map, and animate only now and then.
      const out = !!planes && !a.ragdoll && !inView(planes, p.x, p.y + 0.9, p.z, CULL_RADIUS);
      if (out !== !!a.culled) {
        a.culled = out;
        a.root.setEnabled(!out);
        // Its bones aren't drawn: pause its clips and skip the aim and grip until it is back in view.
        if (a.anim instanceof CharacterAnimator) a.anim.setDormant(out);
      }
      a.placeholder.setEnabled(p.alive && !a.anim);
      const glowColor = p.powerups & POWERUP_DAMAGE_BIT ? '#c03cff' : p.powerups & POWERUP_SPEED_BIT ? '#36d6ff' : null;
      // Only when it changes: setting a PBR colour marks every mesh using the material for a shader check.
      const glowKey = `${glowColor}|${a.anim ? 1 : 0}`;
      const reglow = a.glowKey !== glowKey;
      a.glowKey = glowKey;
      if (reglow) a.mat.emissiveColor = glowColor ? Color3.FromHexString(glowColor).scale(0.55) : Color3.Black();
      if (a.anim) {
        // Riders stand (or sit) still in their seats, however fast the vehicle goes.
        const sit = sitting.get(p.slot);
        const speed = seated.has(p.slot) ? 0 : Math.hypot(a.vel.x, a.vel.z);
        // Far characters animate every few frames, with the time saved up (a death always plays at once).
        const far = eye && p.alive ? Math.hypot(p.x - eye.x, p.z - eye.z) : 0;
        a.animDt = (a.animDt ?? 0) + dt;
        let run: boolean;
        let stepped: boolean;
        if (a.anim instanceof CharacterAnimator && !a.culled) {
          // Characters in view: past ANIM_LOD_FULL their clips, bones and aim are evaluated at 30 Hz (and at most
          // every 2nd frame), past ANIM_LOD_NEAR at 15 Hz (every 3rd), past ANIM_LOD_FAR at 10 Hz (every 4th), on each
          // one's own phase, with the fingers' pose kept from the last full close; the state machine runs with them.
          const step = animStep(far, perfOn('animlod2'));
          run = a.anim.stepAt(now, step, this.avatarFrame, (p.slot * 37) % 100);
          stepped = step.frames > 1;
          if (run && perfProbe.on) perfProbe.n[COUNT.animated]!++;
        } else if (a.anim instanceof CreatureAnimator && perfOn('animlod2')) {
          // Creatures: their clips and bones step by distance as characters' do (round 2; they were evaluated every
          // frame and only the state machine stepped), and not at all out of view; the state machine runs with them.
          const step = animStep(far);
          run = a.anim.stepAt(now, step, this.avatarFrame, (p.slot * 37) % 100, !!a.culled);
          stepped = step.frames > 1 || !!a.culled;
          if (a.culled) {
            // Out of view: the state machine every 8th frame, as before; the clips wait until it is seen again.
            a.animFrame = ((a.animFrame ?? 0) + 1) % 8;
            run = a.animFrame === 0;
          } else if (run && perfProbe.on) perfProbe.n[COUNT.animated]!++;
        } else {
          // Out of view (asleep) characters, and creatures: the state machine every few frames.
          const every = a.culled ? 8 : far > ANIM_LOD_FAR ? 4 : far > ANIM_LOD_NEAR ? 2 : 1;
          if (a.anim instanceof CharacterAnimator) a.anim.stepAt(now);
          a.animFrame = ((a.animFrame ?? 0) + 1) % every;
          run = a.animFrame === 0;
          stepped = every > 1;
        }
        const animDt = Math.min(stepped ? 0.25 : 0.1, a.animDt);
        if (run) a.animDt = 0;
        if (run) a.anim.update(animDt, {
          speed,
          moveAngle: speed > 0.3 ? angleDelta(p.yaw, Math.atan2(a.vel.x, a.vel.z)) : 0,
          airborne: !p.grounded && !seated.has(p.slot),
          alive: p.alive,
          pitch: p.pitch,
          ...(p.aimYaw ? { aimYaw: p.aimYaw } : {}),
          celebrate: (celebrate || !!p.emote) && p.alive,
          stance: p.stance ?? 0,
          sprinting: !!p.sprinting,
          ...(sit ? { seated: true, legDrop: sit.legDrop, straddle: sit.straddle ?? 0, seatFacing: angleDelta(p.yaw, sit.yaw) } : {}),
        });
        if (reglow && a.anim instanceof CharacterAnimator) for (const m of a.anim.ch.meshes) if (m.material && 'emissiveColor' in m.material) (m.material as unknown as { emissiveColor: Color3 }).emissiveColor = glowColor ? Color3.FromHexString(glowColor).scale(0.35) : Color3.Black();
      }
      if (p.weapon !== a.weaponSlot) this.setAvatarWeapon(a, p.weapon);
      if (p.status || a.aura) {
        a.aura ??= createAura(this.scene, a.root);
        setAura(this.scene, a.aura, p.alive ? p.status : 0, now);
      }
      // Jetpack firing: a flickering flame from the back.
      const jetting = p.alive && (p.status & FX_JET) !== 0;
      if (jetting || a.jet) {
        a.jet ??= this.createJetFlame(a.root);
        a.jet.setEnabled(jetting);
        if (jetting) a.jet.scaling.set(1, 0.8 + Math.random() * 0.5, 1);
      }
      // On a zipline: the trolley on the cable over their head, turned along the line (the body hangs, arms up in the air pose).
      const line = p.alive && p.zip !== undefined ? this.ziplines[p.zip] : undefined;
      if (line || a.trolley) {
        a.trolley ??= this.createTrolley(`trolley_${p.slot}`, a.root, hangDepth());
        a.trolley.setEnabled(!!line);
        if (line) a.trolley.rotation.y = Math.atan2(line.dir.x, line.dir.z) - p.yaw;
      }
      // Parachute or glider: the canopy over them; gliders fly lying forward.
      const chute = p.alive && !seated.has(p.slot) ? (p.chute ?? 0) : 0;
      if (a.canopy && a.canopy.kind !== chute) this.dropCanopy(a);
      if (chute) {
        a.canopy ??= { node: createCanopy(this.scene, `canopy_${p.slot}`, chute), kind: chute };
        placeCanopy(a.canopy.node, a.root.position, p.yaw, now, p.slot);
      }
      if (!a.ragdoll) {
        // Gliding: lying forward under the wing, tipped round the hips (not the feet) so the body stays under it.
        const glide = chute === CHUTE_GLIDER;
        a.root.rotation.x = glide ? 1.1 : 0;
        if (glide) a.root.position.set(a.root.position.x - Math.sin(p.yaw) * 0.9, a.root.position.y + 0.8, a.root.position.z - Math.cos(p.yaw) * 0.9);
      }
      // Classes: a cloaked Shade is a faint shimmer to enemies (no tag over it), a ghost to teammates.
      const tag = p.alive ? allyColor(p.slot) : null;
      const cloaked = p.alive && (p.status & FX_CLOAK) !== 0;
      const enemy = !tag || tag.toLowerCase() === '#ff3b3b';
      const shown = cloaked ? (enemy ? 0.06 : 0.35) : 1;
      // Behind smoke an enemy's marker isn't drawn either (the cloud hides the body; the marker would give it away).
      const smoked = enemy && !!tag && this.smoke.length > 0 && this.smokeHides({ x: a.root.position.x, y: a.root.position.y + 1.4, z: a.root.position.z });
      this.setTag(a, (cloaked || smoked) && enemy ? null : tag);
      // Team leaders wear a gold star over their marker, for both sides to see.
      const leads = p.alive && !cloaked && this.leaderSlots.has(p.slot);
      if (leads || a.crown) {
        a.crown ??= this.createCrown(a.root);
        a.crown.setEnabled(leads);
      }
      // Applied every frame while see-through: the model may finish loading under it.
      if (shown !== 1 || (a.shown ?? 1) !== 1) {
        a.shown = shown;
        // A crowd's held guns are GPU instances, which can't fade on their own: hidden while see-through.
        for (const m of a.root.getChildMeshes()) {
          if (m.isAnInstance) m.isVisible = shown === 1;
          else m.visibility = shown;
        }
      }
    }
    for (const [slot, a] of this.avatars) {
      if (!seen.has(slot)) {
        this.disposeAvatar(a);
        this.avatars.delete(slot);
      }
    }
    this.drawTags();
  }

  /** Play an upper-body action on a remote avatar (shooting, melee). */
  avatarAction(slot: number, action: OneShot): void {
    const a = this.avatars.get(slot);
    if (!a?.anim) return;
    // A far shot's recoil twitch is a pixel or two: left out (each shot restarts a clip on every joint of the arms).
    const eye = this.scene.activeCamera?.globalPosition;
    if (action === 'shoot' && eye && Math.hypot(a.root.position.x - eye.x, a.root.position.z - eye.z) > SHOT_OVERLAY_REACH) return;
    a.anim.trigger(action);
  }

  /**
   * Where hands are DRAWN on guns now (tests; handProbe.ts): your own in first person (full body or arms), and
   * every character in view holding a gun, nearest first, with its distance. For each: model metres from each
   * hand's skin to its point on the gun, and how its shooting hand lies on the grip (`aheadR`, `sideR`).
   */
  /** The meshes the main camera drew in its last pass (tests; recorded from the first call on). */
  private mainDrawn: Set<AbstractMesh> | null = null;

  /**
   * What the main camera drew last frame. The scene's active-mesh list, read between frames, is whatever the last
   * evaluation left in it, and it was often empty there (the grip checks then saw nobody drawn: "0 of 0" bots, an Imp
   * with no report). So it is copied right after the main camera's own evaluation, once something asks for it.
   */
  private drawnByCamera(): Set<AbstractMesh> {
    if (!this.mainDrawn) {
      this.mainDrawn = new Set();
      this.scene.onAfterActiveMeshesEvaluationObservable.add(() => {
        if (this.scene.activeCamera !== this.camera) return;
        const am = this.scene.getActiveMeshes();
        this.mainDrawn = new Set(am.data.slice(0, am.length));
      });
      const am = this.scene.getActiveMeshes();
      return new Set(am.data.slice(0, am.length));
    }
    return this.mainDrawn;
  }

  /**
   * Of a body's meshes, the ones the main camera drew (`active`), each at the level of detail it was drawn at: the
   * near mesh, or its low-detail copy far off. The active list names the near mesh either way, and a whole-body
   * character's low-detail copy has its own skeleton: only the one drawn is posed each frame (the other's matrices
   * are left as they were, or never set), so measuring the near mesh of a far character read a stale pose.
   */
  private drawnLevels(meshes: readonly AbstractMesh[], active: ReadonlySet<AbstractMesh>): AbstractMesh[] {
    const out: AbstractMesh[] = [];
    for (const m of meshes) {
      if (active.has(m)) {
        const level = m.getLOD(this.camera);
        if (level) out.push(level);
      } else for (const l of (m as Mesh).getLODLevels?.() ?? []) if (l.mesh && active.has(l.mesh)) out.push(l.mesh);
    }
    return out;
  }

  gripReport(): { local: ({ mode: 'body' | 'arms' } & NonNullable<ReturnType<CharacterAnimator['drawnGrip']>>) | null; remote: ({ slot: number; dist: number } & NonNullable<ReturnType<CharacterAnimator['drawnGrip']>>)[]; creatures: { slot: number; report: ReturnType<CreatureAnimator['drawnGrip']> }[] } {
    const active = this.drawnByCamera();
    let local: ReturnType<GameView['gripReport']>['local'] = null;
    if (this.fpBody?.a.anim instanceof CharacterAnimator) {
      const g = this.fpBody.a.anim.drawnGrip([...this.fpBody.rig.drawnMeshes, ...this.fpBody.a.anim.ch.meshes]);
      if (g) local = { mode: 'body', ...g };
    } else if (this.fpArms?.anim && this.fpArms.root.isEnabled()) {
      const g = this.fpArms.anim.drawnGrip();
      if (g) local = { mode: 'arms', ...g };
    }
    const cam = this.scene.activeCamera?.globalPosition ?? Vector3.Zero();
    const remote: ReturnType<GameView['gripReport']>['remote'] = [];
    for (const [slot, a] of this.avatars) {
      if (a.hiddenSelf || a.culled || !a.root.isEnabled() || !(a.anim instanceof CharacterAnimator)) continue;
      const drawn = this.drawnLevels(a.anim.ch.meshes, active);
      const g = drawn.length ? a.anim.drawnGrip(drawn) : null;
      if (g) remote.push({ slot, dist: Math.hypot(a.root.position.x - cam.x, a.root.position.z - cam.z), ...g });
    }
    remote.sort((x, y) => x.dist - y.dist);
    // Players in creature skins (third person, others): the same, and which way the gun points.
    const creatures: { slot: number; report: ReturnType<CreatureAnimator['drawnGrip']> }[] = [];
    for (const [slot, a] of this.avatars) {
      if (a.hiddenSelf || !(a.anim instanceof CreatureAnimator) || !a.root.isEnabled()) continue;
      const drawn = this.drawnLevels(a.anim.ch.meshes, active);
      creatures.push({ slot, report: drawn.length ? a.anim.drawnGrip(drawn) : null });
    }
    return { local, remote, creatures };
  }

  /** Whether your own first-person arms (or full body) have loaded and hold the gun (for tests). */
  hasFirstPersonArms(): boolean {
    return !!this.fpArms?.anim || !!this.fpBody;
  }

  /**
   * Full-body first person, each frame: your own character (`p` is where prediction has you) under the steady
   * eye, its legs walking, running, crouching and jumping with you and its hands on the viewmodel. Hidden with
   * the gun (scoped, dead).
   */
  private showFpBody(a: Avatar, p: RemotePose, now: number): void {
    const anim = a.anim as CharacterAnimator;
    let fp = this.fpBody;
    if (fp?.a !== a) {
      this.dropFpBody();
      // The third-person gun comes out of the hands (it is put back on the way to third person).
      anim.hold(null);
      a.weaponSlot = -1;
      a.weaponNode?.dispose();
      a.weaponNode = undefined;
      fp = { a, rig: new FirstPersonBodyRig(this.scene, anim.ch, anim, a.root), vel: { x: 0, z: 0 } };
      this.fpBody = fp;
      if (this.viewmodel && this.viewWeapon) anim.gripExternal(this.viewmodel, getWeapon(this.viewWeapon).view.hold);
      // Your own arms aren't needed while the body holds the gun.
      this.fpArms?.root.setEnabled(false);
    }
    const shown = !this.viewHidden;
    a.root.setEnabled(shown);
    fp.rig.setEnabled(shown);
    anim.setDormant(!shown);
    if (!shown) return;
    const dt = fp.last ? Math.min(0.1, (now - fp.last.t) / 1000) : 0;
    if (fp.last && dt > 0) {
      const k = Math.min(1, dt * 12);
      fp.vel.x += ((p.x - fp.last.x) / dt - fp.vel.x) * k;
      fp.vel.z += ((p.z - fp.last.z) / dt - fp.vel.z) * k;
      if (Math.hypot(p.x - fp.last.x, p.z - fp.last.z) > 4) fp.vel = { x: 0, z: 0 };
    }
    fp.last = { x: p.x, z: p.z, t: now };
    const { pos, yaw, pitch } = this.steadyEye;
    fp.rig.base.set(p.x, p.y, p.z);
    fp.rig.yaw = yaw;
    fp.rig.eye.copyFrom(pos);
    fp.rig.pitch = pitch;
    a.root.position.set(p.x, p.y, p.z);
    a.root.rotation.set(0, yaw, 0);
    const speed = Math.hypot(fp.vel.x, fp.vel.z);
    anim.stepAt(now);
    anim.update(dt, {
      speed,
      moveAngle: speed > 0.3 ? angleDelta(yaw, Math.atan2(fp.vel.x, fp.vel.z)) : 0,
      airborne: !p.grounded,
      alive: true,
      pitch,
      celebrate: false,
      stance: p.stance ?? 0,
      sprinting: !!p.sprinting,
    });
  }

  /** Leave full-body first person: the head comes back and the body is hidden or drawn as anyone's. */
  private dropFpBody(): void {
    const fp = this.fpBody;
    if (!fp) return;
    this.fpBody = undefined;
    fp.rig.dispose();
    if (fp.a.anim instanceof CharacterAnimator) fp.a.anim.gripExternal(null, null);
    fp.a.root.setEnabled(false);
  }

  /** Remote avatars currently shown as animated characters (for tests and the stats overlay). */
  characterCount(): number {
    return [...this.avatars.values()].filter((a) => a.anim && !a.hiddenSelf).length;
  }

  /** Avatars drawn with a creature body of this kind (tests: zombies in the zombie body). */
  creatureCount(kind: string): number {
    return [...this.avatars.values()].filter((a) => !a.hiddenSelf && a.anim instanceof CreatureAnimator && a.anim.ch.kind === kind).length;
  }

  private setAvatarWeapon(a: Avatar, slot: number): void {
    a.weaponSlot = slot;
    a.weaponNode?.dispose();
    a.weaponNode = undefined;
    a.muzzle = undefined;
    a.anim?.hold(null);
    // Unarmed (hostages, zombies): nothing in hand.
    const def = slot > 0 && !a.unarmed ? weaponByCode(slot) : undefined;
    if (!def) return;
    // Crowds: everyone's copy of a gun is a GPU instance of the model merged into one mesh (one draw per gun model and
    // material, not per player, and one mesh per gun for the scene to look at, not one per part: round 3 of
    // docs/PERF_96.md).
    void (this.crowd ? this.models.instantiateWhole(def.view.model, `held_${slot}`) : this.models.instantiate(def.view.model, `held_${slot}`)).then((node) => {
      if (a.weaponSlot !== slot || a.root.isDisposed()) return node.dispose();
      // A held gun's shadow is a speck past a few metres: it casts only near the camera.
      castSmall(node);
      // The muzzle is the front of the gun along its forward axis, measured before it's put in a hand.
      const { min, max } = node.getHierarchyBoundingVectors(true);
      const at = def.view.muzzleAt;
      a.muzzle = { node, local: at ? new Vector3(at[0], at[1], at[2]) : new Vector3(0, (min.y + max.y) / 2 + (max.y - min.y) * 0.2, max.z) };
      if (a.anim) {
        a.anim.hold(node, def.view.hold);
        return;
      }
      node.parent = a.placeholder;
      // Right hand, chest height, pointing where the player faces.
      node.position.set(0.3, 0.25, 0.35);
      a.weaponNode = node;
    });
  }

  /**
   * A new NPC by a squad's entrance makes its entrance: it climbs out of a
   * hatch or burrow, and dust or debris bursts from the vent, hole or breach.
   */
  private arrive(a: Avatar, p: RemotePose, now: number): void {
    for (const e of this.entrances) {
      const out = e.entrance === 'breach' ? 0.8 : 0;
      const mx = e.position[0] + Math.sin(e.yaw) * out;
      const mz = e.position[2] + Math.cos(e.yaw) * out;
      const dy = p.y - e.position[1];
      if (Math.hypot(p.x - mx, p.z - mz) > 1.4 || dy < -0.5 || dy > (e.ventHeight ?? 3.5)) continue;
      const floor = { x: mx, y: e.position[1] + 0.2, z: mz };
      switch (e.entrance) {
        case 'vent':
          this.impacts.puff({ x: e.position[0], y: e.position[1] + (e.ventHeight ?? 3.5) - 0.3, z: e.position[2] }, '#6b6760', 1.1, 0.9, -0.6);
          break;
        case 'hatch':
          a.emergeAt = now;
          this.impacts.puff(floor, '#5d5955', 0.9, 0.7, 0.8);
          break;
        case 'burrow':
          a.emergeAt = now;
          this.impacts.puff(floor, '#6e5440', 1.4, 1.1, 0.9);
          this.impacts.puff(floor, '#4a3828', 0.8, 0.6, 1.4);
          break;
        case 'breach':
          this.impacts.puff({ x: e.position[0], y: e.position[1] + 1, z: e.position[2] }, '#a29d93', 1.3, 1, 0.5);
          break;
      }
      return;
    }
  }

  private createAvatar(slot: number, spec: AvatarSpec, specKey: string): Avatar {
    const root = new TransformNode(`avatar_${slot}`, this.scene);
    const placeholder = CreateCapsule(`avatarcap_${slot}`, { height: PLAYER.height, radius: PLAYER.radius, tessellation: 12, subdivisions: 2 }, this.scene);
    placeholder.parent = root;
    placeholder.position.y = PLAYER.height / 2;
    const mat = solid(this.scene, `avatar_${slot}_mat`, spec.npc?.color ?? slotColor(slot));
    placeholder.material = mat;
    placeholder.isPickable = false;
    const a: Avatar = { root, placeholder, mat, weaponSlot: -1, specKey, vel: { x: 0, z: 0 }, ...(spec.npc?.zombie ? { unarmed: true } : {}) };
    if (spec.creature) {
      void this.creatures.create(spec.creature, `creature_${slot}`).then((ch) => {
        if (root.isDisposed()) return ch.dispose();
        ch.root.parent = root;
        if (spec.size && spec.size !== 1) ch.root.scaling.setAll(spec.size);
        if (spec.armed) {
          // A player in a creature skin is drawn at about a player's height (looks only: the hitbox is the player's;
          // an imp was half a player and held its gun at your knees).
          fitPlayerSkin(ch, PLAYER.height);
        }
        a.anim = new CreatureAnimator(this.scene, ch, !!spec.armed);
        placeholder.setEnabled(false);
        // Hand over the gun it was holding as a capsule.
        const slotNow = a.weaponSlot;
        a.weaponSlot = -1;
        if (spec.armed && slotNow >= 0) this.setAvatarWeapon(a, slotNow);
      });
      return a;
    }
    const kept = this.bodyPool.get(specKey)?.pop();
    if (kept) {
      // A body of this look kept from an avatar that went: back in play at once (it was fitted and sized for this spec).
      kept.ch.root.parent = root;
      kept.ch.root.setEnabled(true);
      kept.setDormant(false);
      a.anim = kept;
      placeholder.setEnabled(false);
      return a;
    }
    void this.characters.create(spec, `char_${slot}`).then((ch) => {
      if (root.isDisposed()) return ch.dispose();
      ch.root.parent = root;
      fitCharacter(ch);
      if (spec.size && spec.size !== 1) ch.root.scaling.scaleInPlace(spec.size);
      a.anim = new CharacterAnimator(this.scene, ch);
      if (a.culled) a.anim.setDormant(true);
      placeholder.setEnabled(false);
      // Move the held weapon from the capsule to the hand.
      const slotNow = a.weaponSlot;
      a.weaponSlot = -1;
      if (slotNow >= 0) this.setAvatarWeapon(a, slotNow);
    });
    return a;
  }

  /** Show a teammate marker in the team colour over the avatar (null hides it). */
  /** Slots leading their teams (rules.leaders), from the latest snapshot. */
  private leaderSlots: ReadonlySet<number> = new Set();

  setLeaders(slots: ReadonlySet<number>): void {
    this.leaderSlots = slots;
  }

  private createCrown(root: TransformNode): Mesh {
    const mesh = CreateDisc(`${root.name}_crown`, { radius: 0.16, tessellation: 5 }, this.scene);
    const mat = new StandardMaterial(`${root.name}_crownmat`, this.scene);
    mat.emissiveColor = Color3.FromHexString('#ffd23f');
    mat.disableLighting = true;
    mesh.material = mat;
    mesh.billboardMode = MeshClass.BILLBOARDMODE_ALL;
    mesh.parent = root;
    mesh.position.y = PLAYER.height + 0.68;
    mesh.isPickable = false;
    return mesh;
  }

  private setTag(a: Avatar, color: string | null): void {
    if (a.tag && a.tag.color !== color) {
      a.tag.node.dispose(false, a.tag.node instanceof MeshClass);
      a.tag = undefined;
    }
    if (!color || a.tag) return;
    // Crowds: a plain node where the disc goes; every marker of a colour is a thin instance of one disc, placed there
    // each frame (drawTags): one draw per colour and no mesh per player for the scene to look at.
    const node = this.crowd ? new TransformNode(`${a.root.name}_tag`, this.scene) : this.tagDisc(`${a.root.name}_tag`, color);
    if (this.crowd) {
      this.tagBatch(color);
      if (isEnemyTag(color)) node.rotation.z = -Math.PI / 2;
    }
    node.billboardMode = MeshClass.BILLBOARDMODE_ALL;
    node.parent = a.root;
    node.position.y = PLAYER.height + 0.35;
    if (node instanceof MeshClass) node.isPickable = false;
    a.tag = { node, color };
  }

  /** A marker disc in a team colour. Allies: a diamond; enemies (red by default): a downward triangle, so the two read apart at a glance. */
  private tagDisc(name: string, color: string, turned = true): Mesh {
    const enemy = isEnemyTag(color);
    const mesh = CreateDisc(name, { radius: enemy ? 0.13 : 0.11, tessellation: enemy ? 3 : 4 }, this.scene);
    if (enemy && turned) mesh.rotation.z = -Math.PI / 2;
    const mat = new StandardMaterial(`${name}mat`, this.scene);
    mat.emissiveColor = Color3.FromHexString(color);
    mat.disableLighting = true;
    mesh.material = mat;
    return mesh;
  }

  /** Per colour, the disc every crowd marker of that colour is a thin instance of, and their matrices. */
  private readonly tagBatches = new Map<string, { mesh: Mesh; matrices: Float32Array; count: number }>();

  private tagBatch(color: string): { mesh: Mesh; matrices: Float32Array; count: number } {
    let b = this.tagBatches.get(color);
    if (!b) {
      // At the world's origin (its thin instances carry each marker's whole matrix, turned and placed by its node).
      const mesh = this.tagDisc(`tag_${color}`, color, false);
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      // A handful of small discs: drawn without a bounds test (they move every frame), and they cast no shadow.
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.metadata = { castsNoShadow: true };
      const matrices = new Float32Array(16 * 16);
      mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
      mesh.setEnabled(false);
      this.tagBatches.set(color, (b = { mesh, matrices, count: 0 }));
    }
    return b;
  }

  /**
   * Each frame after the avatars: every crowd marker drawn where its node is, as its own disc was (hidden with its
   * body, and while its player is see-through, as instances were; never your own).
   */
  private drawTags(): void {
    if (!this.tagBatches.size) return;
    for (const b of this.tagBatches.values()) b.count = 0;
    for (const a of this.avatars.values()) {
      const t = a.tag;
      if (!t || t.node instanceof MeshClass || a.hiddenSelf || (a.shown ?? 1) !== 1 || !t.node.isEnabled()) continue;
      const b = this.tagBatches.get(t.color);
      if (!b) continue;
      if (b.matrices.length < (b.count + 1) * 16) {
        const more = new Float32Array(b.matrices.length * 2);
        more.set(b.matrices);
        b.matrices = more;
        b.mesh.thinInstanceSetBuffer('matrix', b.matrices, 16, false);
      }
      t.node.computeWorldMatrix(true).copyToArray(b.matrices, 16 * b.count++);
    }
    for (const b of this.tagBatches.values()) {
      // Kept at its last count while none show: an empty thin-instanced mesh would check its shaders as a plain one.
      b.mesh.setEnabled(b.count > 0);
      if (!b.count) continue;
      b.mesh.thinInstanceCount = b.count;
      b.mesh.thinInstanceBufferUpdated('matrix');
    }
  }

  private disposeAvatar(a: Avatar): void {
    if (this.fpBody?.a === a) this.dropFpBody();
    a.hitbox?.dispose();
    this.atmosphere.shadowless.delete(a.root);
    // The flash texture is shared by every flash: dispose the material, never the texture.
    a.flash?.material?.dispose();
    a.flash?.dispose();
    if (a.flashRig) {
      a.flashRig.dispose();
      this.remoteRigs--;
    }
    a.ragdoll?.dispose();
    if (a.anim instanceof CharacterAnimator && this.keepBody(a.specKey, a.anim)) a.anim = undefined;
    a.anim?.dispose();
    a.weaponNode?.dispose();
    this.dropCanopy(a);
    a.root.dispose(false, true);
  }

  /** Characters kept for the next avatar of their look (BODY_POOL_PER_LOOK), by spec key. */
  private readonly bodyPool = new Map<string, CharacterAnimator[]>();

  /** Keep a going avatar's character for reuse (taken off the avatar, hidden, its clips paused); false: pool full. */
  private keepBody(key: string, anim: CharacterAnimator): boolean {
    if (this.scene.isDisposed || anim.firstPerson || anim.ch.root.isDisposed()) return false;
    let list = this.bodyPool.get(key);
    if (!list) this.bodyPool.set(key, (list = []));
    if (list.length >= BODY_POOL_PER_LOOK) return false;
    anim.standBy();
    anim.ch.root.parent = null;
    anim.ch.root.setEnabled(false);
    list.push(anim);
    return true;
  }

  // ---------------------------------------------------------------- pickups

  private addPickup(e: PickupEntity, item = e.item): void {
    const root = createPickupVisual(this.scene, this.models, item, `pickup_${e.id}`, true, false, this.setLook);
    const baseY = e.position[1] + PICKUP_HOVER;
    root.position.set(e.position[0], baseY, e.position[2]);
    this.pickups.set(e.id, { root, baseY, phase: (e.position[0] * 7 + e.position[2] * 3) % (Math.PI * 2), item, placed: e.item });
  }

  /** The item a pickup is drawn as now (tests: a random pickup shows its roll). */
  pickupItem(id: string): string | undefined {
    return this.pickups.get(id)?.item;
  }

  /**
   * Spin and bob pickups; hide the ones currently taken. `items`: random pickups holding something other than
   * what was placed (the snapshot's `pw`); a pickup whose item changed is drawn again as the new one.
   */
  updatePickups(taken: ReadonlySet<string>, now: number, items?: ReadonlyMap<string, string>): void {
    for (const [id, p] of this.pickups) {
      const want = items?.get(id) ?? p.placed;
      if (want !== p.item) {
        const at = p.root.position.clone();
        // Not its materials: they are shared (the model library's, the ring colours' cache), and disposing them
        // drew every other copy of that gun, your own first-person one included, in plain white.
        p.root.dispose(false, false);
        p.root = createPickupVisual(this.scene, this.models, want, `pickup_${id}`, true, false, this.setLook);
        p.root.position.copyFrom(at);
        p.item = want;
      }
      p.root.setEnabled(!taken.has(id));
      p.root.rotation.y = now * 0.0015 + p.phase;
      p.root.position.y = p.baseY + Math.sin(now * 0.003 + p.phase) * 0.08;
    }
  }

  /**
   * Weapons dropped by the fallen, as the latest snapshot lists them ([drop ID, item ID, x, y, z, yaw]): new ones
   * appear lying on the ground, gone ones are removed.
   */
  updateDrops(drops: readonly (readonly [number, string, number, number, number, number])[]): void {
    if (!drops.length && !this.drops.size) return;
    const live = new Set<number>();
    for (const [id, item, x, y, z, yaw] of drops) {
      live.add(id);
      const had = this.drops.get(id);
      if (had && had.item === item) continue;
      // Never the materials: they're shared (see updatePickups).
      had?.root.dispose(false, false);
      const root = createPickupVisual(this.scene, this.models, item, `drop_${id}`, true, true);
      root.position.set(x, y + DROP_LIE_HEIGHT, z);
      root.rotation.y = yaw;
      this.drops.set(id, { root, item });
    }
    for (const [id, d] of this.drops) {
      if (live.has(id)) continue;
      d.root.dispose(false, false);
      this.drops.delete(id);
    }
  }

  /** Dropped weapons drawn now: [drop ID, item ID] (tests). */
  dropsDrawn(): [number, string][] {
    return [...this.drops].map(([id, d]) => [id, d.item]);
  }

  // ---------------------------------------------------------------- projectiles & effects

  /** Breakable props follow the replicated state (already broken when you join). */
  applyPropStates(states: ReadonlyMap<number, readonly [number, number]>): void {
    for (const [i, node] of this.props) {
      const s = states.get(i);
      if (s) node.setEnabled(s[0] > 0);
    }
  }

  /** Props carried by movers follow them (`tick` fractional, like the blocks they ride). */
  applyMoverProps(movers: Movers, tick: number): void {
    for (const t of movers.propTransforms(tick)) {
      const node = this.props.get(t.prop.i);
      if (!node) continue;
      node.position.set(t.position.x, t.position.y, t.position.z);
      const q = (node.rotationQuaternion ??= new Quaternion());
      q.set(t.rot.x, t.rot.y, t.rot.z, t.rot.w);
    }
  }

  /** A broken prop vanishes (the session adds its debris). */
  breakProp(index: number): void {
    this.props.get(index)?.setEnabled(false);
  }

  updateProjectiles(positions: ReadonlyMap<number, [number, number, number, number]>): void {
    const now = performance.now();
    for (const [id, pos] of positions) {
      let p = this.projectiles.get(id);
      if (!p) {
        p = { node: this.createProjectile(id, PROJECTILE_VISUALS[pos[3]] ?? 'grenade'), look: pos[3], born: now };
        this.projectiles.set(id, p);
      }
      const prev = p.node.position.clone();
      p.node.position.set(pos[0], pos[1], pos[2]);
      const look = PROJECTILE_VISUALS[p.look];
      // A flare burns in flight and where it sticks (Flame FX, map.lasting `fire.flare`).
      if (look === 'flare') this.lasting.want(`proj:${id}`, 'fire.flare', { x: pos[0], y: pos[1], z: pos[2] });
      if (look && ARSENAL_LOOKS.has(look)) animateArsenalProjectile(p.node, look, now, p.node.position.subtract(prev), p.born);
      // Grenades tumble while they fly and lie still where they stop.
      else if (look === 'grenade' || look === 'frag' || look === 'vortexNade' || look === 'smoke') {
        if (p.node.position.subtract(prev).lengthSquared() > 1e-6) p.node.rotation.x += 0.3;
      }
      else if (look === 'rocket') {
        // Point the rocket along its flight.
        const d = p.node.position.subtract(prev);
        if (d.lengthSquared() > 1e-6) p.node.lookAt(p.node.position.add(d));
      } else if (look === 'mine') {
        // Blink once armed.
        const light = p.node.getChildMeshes().find((m) => m.name.endsWith('_light'));
        light?.setEnabled(now - p.born > 1200 && Math.floor(now / 350) % 2 === 0);
      } else p.node.scaling.setAll(1 + Math.sin(now * 0.03) * 0.12);
    }
    for (const [id, p] of this.projectiles) {
      if (!positions.has(id)) {
        p.node.dispose();
        this.projectiles.delete(id);
      }
    }
  }

  private createProjectile(id: number, look: (typeof PROJECTILE_VISUALS)[number]): TransformNode {
    if (look === 'spear') return this.spearProjectile(id);
    const kind = THROWN_KINDS.get(look);
    const thrown = kind ? throwableModel(kind, this.setLook) : null;
    if (thrown) return this.thrownProjectile(id, look, thrown);
    if (ARSENAL_LOOKS.has(look)) return createArsenalProjectile(this.scene, id, look);
    const node = new TransformNode(`proj_${id}`, this.scene);
    const model = look === 'grenade' ? 'projectiles/grenade.glb' : null;
    if (model) {
      void this.models.instantiate(model, `${look}_${id}`).then((m) => {
        if (node.isDisposed()) return m.dispose();
        m.parent = node;
      });
    } else if (look === 'rocket') {
      const body = CreateCylinder(`rocket_${id}`, { diameter: 0.14, height: 0.6, tessellation: 10 }, this.scene);
      body.rotation.x = Math.PI / 2;
      body.material = solid(this.scene, 'rocketMat', '#6e7a5c');
      body.parent = node;
      const tip = CreateSphere(`rocketTip_${id}`, { diameter: 0.15, segments: 6 }, this.scene);
      tip.position.z = 0.3;
      tip.material = solid(this.scene, 'rocketTipMat', '#c8342a');
      tip.parent = node;
      const flame = CreateSphere(`rocketFlame_${id}`, { diameter: 0.28, segments: 6 }, this.scene);
      flame.position.z = -0.38;
      flame.scaling.z = 2;
      flame.material = glow(this.scene, 'rocketFlameMat', '#ffb347', 1);
      flame.parent = node;
    } else if (look === 'mine') {
      const disc = CreateCylinder(`mine_${id}`, { diameter: 0.34, height: 0.09, tessellation: 16 }, this.scene);
      disc.material = solid(this.scene, 'mineMat', '#3c4038');
      disc.parent = node;
      // The anti-tank mine model (Guns & Explosives pack, CC0) replaces the plain disc once it loads.
      void this.models.instantiate('guns/at_mine.glb', `mineModel_${id}`).then((model) => {
        if (node.isDisposed()) return model.dispose();
        model.parent = node;
        disc.setEnabled(false);
      }, () => undefined);
      const light = CreateSphere(`mine_${id}_light`, { diameter: 0.07, segments: 6 }, this.scene);
      light.position.y = 0.1;
      light.material = glow(this.scene, 'mineLightMat', '#ff3b3b', 1);
      light.parent = node;
      light.setEnabled(false);
    } else {
      // Plasma bolt or charged orb: a glowing ball.
      const ball = CreateSphere(`${look}_${id}`, { diameter: look === 'orb' ? 0.55 : 0.2, segments: 8 }, this.scene);
      ball.material = glow(this.scene, `${look}Mat`, look === 'orb' ? '#9b7dff' : '#7dffb0', 1);
      ball.parent = node;
    }
    for (const m of node.getChildMeshes()) m.isPickable = false;
    return node;
  }

  /**
   * A thrown grenade, in flight and where it lies: its throwable's model (instanced: a bot match throws dozens), the
   * shapes drawn in code until it loads (and if it can't). The sticky grenade keeps its blinking light on top.
   */
  private thrownProjectile(id: number, look: (typeof PROJECTILE_VISUALS)[number], model: string): TransformNode {
    const coded = ARSENAL_LOOKS.has(look);
    const node = coded ? createArsenalProjectile(this.scene, id, look) : new TransformNode(`proj_${id}`, this.scene);
    const shapes = node.getChildMeshes().filter((m) => !m.name.endsWith('_light'));
    void this.models.instantiate(model, `thrown_${id}`, true).then(
      (m) => {
        if (node.isDisposed()) return m.dispose();
        m.parent = node;
        for (const s of shapes) s.setEnabled(false);
        // The sticky grenade's light sits on the model's top (models are built centred on their bounds).
        const light = node.getChildMeshes().find((c) => c.name.endsWith('_light'));
        if (light) {
          const b = m.getHierarchyBoundingVectors(true);
          light.position.y = (b.max.y - b.min.y) / 2 + 0.01;
        }
      },
      () => undefined,
    );
    for (const m of node.getChildMeshes()) m.isPickable = false;
    return node;
  }

  /** How many grenades in flight or lying are drawn with their throwable's model (tests). */
  thrownModelsDrawn(): number {
    let n = 0;
    for (const p of this.projectiles.values()) if (p.node.getChildren((c) => c.name.startsWith('thrown_'), true).length) n++;
    return n;
  }

  /**
   * A thrown spear, in flight and stuck where it lands: the Spear's own model (instanced: spears-only matches throw
   * dozens), its tip where the plain shapes' tip is (a little ahead of the point the sim moves); the shapes until it loads.
   */
  private spearProjectile(id: number): TransformNode {
    const node = createArsenalProjectile(this.scene, id, 'spear');
    const shapes = node.getChildMeshes();
    void this.models.instantiate(getWeapon('core.spear').view.model, `spearModel_${id}`, true).then((model) => {
      if (node.isDisposed()) return model.dispose();
      const tip = model.getHierarchyBoundingVectors(true).max.z;
      model.parent = node;
      model.position.z = SPEAR_TIP_AHEAD - tip;
      for (const m of shapes) m.setEnabled(false);
    }, () => undefined);
    return node;
  }

  /** How many thrown spears are drawn with their model (tests). */
  spearModelsDrawn(): number {
    let n = 0;
    for (const p of this.projectiles.values()) if (p.node.getChildren((c) => c.name.startsWith('spearModel_'), true).length) n++;
    return n;
  }

  /** The Binbun explosion for a blast (content/vfx.json map.explosions: by weapon, its projectile, the kind), sized to its radius. */
  private blastFx(at: Vec3, radius: number, weapon: string | undefined, kind: string | null, minScale: number): boolean {
    // Nothing under it within a couple of metres: an air burst.
    const airborne = kind !== 'vehicle' && !this.physics?.raycast({ x: at.x, y: at.y + 0.2, z: at.z }, { x: 0, y: -1, z: 0 }, 2.2);
    const fx = explosionFor(weapon, airborne ? 'air' : kind, (id) => CORE_WEAPONS[id]);
    const y = airborne ? at.y : at.y - 0.3;
    return this.vfx.play(fx.pack, fx.effect, new Vector3(at.x, y, at.z), { scale: Math.max(minScale, radius * fx.scale) });
  }

  explosion(at: Vec3, radius: number, weapon?: string): void {
    // Binbun's explosion for this blast (godotVfx.ts), sized to it; the plain fireball until its pack is in.
    if (this.blastFx(at, radius, weapon, null, 0.5)) return;
    const ball = CreateSphere('boom', { diameter: 1, segments: 12 }, this.scene);
    const mat = glow(this.scene, 'boomMat', '#ffb347', 1);
    ball.material = mat;
    ball.position.set(at.x, at.y, at.z);
    ball.isPickable = false;
    this.effects.push({
      mesh: ball,
      born: performance.now(),
      ttl: 380,
      update: (f) => {
        ball.scaling.setAll(radius * 2 * (0.3 + 0.7 * Math.sqrt(f)));
        mat.alpha = 0.85 * (1 - f);
      },
    });
  }

  /**
   * A vehicle blowing up, in layers: a white-hot flash, a fireball that
   * swells past the blast radius with smaller balls of flame bursting round
   * it, a shockwave ring racing out along the ground, a spray of sparks,
   * charred chunks thrown out on the effects physics, and a column of black
   * smoke. Nearby cameras shake (the caller does that and the sound).
   */
  vehicleExplosion(at: Vec3, radius: number): void {
    const now = performance.now();
    this.blastFx(at, radius, undefined, 'vehicle', 0.8);
    const ball = (name: string, hex: string, centre: Vec3, size: number, delay: number, ttl: number, alpha: number) => {
      const mesh = CreateSphere(name, { diameter: 1, segments: 10 }, this.scene);
      const mat = glow(this.scene, `${name}Mat`, hex, 1);
      mesh.material = mat;
      mesh.position.set(centre.x, centre.y, centre.z);
      mesh.isPickable = false;
      mesh.scaling.setAll(0.01);
      this.effects.push({
        mesh,
        born: now + delay,
        ttl,
        update: (f) => {
          if (f < 0) return void mesh.scaling.setAll(0.01);
          mesh.scaling.setAll(size * (0.25 + 0.75 * Math.sqrt(f)));
          mesh.position.y = centre.y + f * size * 0.25;
          mat.alpha = alpha * (1 - f) * (1 - f * 0.3);
        },
      });
    };
    ball('boomFlash', '#fff4c8', at, radius * 1.1, 0, 160, 1);
    ball('boomCore', '#ffb347', at, radius * 1.6, 20, 650, 0.9);
    ball('boomOuter', '#e8541c', at, radius * 2.1, 60, 900, 0.55);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.random();
      const d = radius * (0.35 + Math.random() * 0.4);
      ball('boomBurst', i % 2 ? '#ff8a2a' : '#ffcf5a', { x: at.x + Math.cos(a) * d, y: at.y + Math.random() * radius * 0.5, z: at.z + Math.sin(a) * d }, radius * (0.6 + Math.random() * 0.4), 80 + i * 55, 520, 0.85);
    }
    // Shockwave: a flat ring racing out along the ground.
    const ring = CreateTorus('boomRing', { diameter: 1, thickness: 0.06, tessellation: 40 }, this.scene);
    const ringMat = glow(this.scene, 'boomRingMat', '#fff1d6', 1);
    ring.material = ringMat;
    ring.isPickable = false;
    ring.position.set(at.x, at.y - 0.3, at.z);
    this.effects.push({
      mesh: ring,
      born: now,
      ttl: 480,
      update: (f) => {
        const r = radius * 0.5 + radius * 3 * Math.sqrt(f);
        ring.scaling.set(r, 1 + 6 * (1 - f), r);
        ringMat.alpha = 0.7 * (1 - f);
      },
    });
    this.impacts.sparkBurst(at, 40, 9);
    this.debris(at, '#26221f', Math.max(1, radius * 0.4), 16, 1.8);
    this.debris(at, '#6b2a12', Math.max(0.8, radius * 0.3), 6, 2.2);
    for (let i = 0; i < 10; i++) {
      const p = { x: at.x + (Math.random() - 0.5) * radius, y: at.y + Math.random() * radius * 0.6, z: at.z + (Math.random() - 0.5) * radius };
      this.impacts.puff(p, i % 3 ? '#1b1917' : '#3a3633', radius * (0.5 + Math.random() * 0.4), 2.2 + Math.random() * 1.5, 1.6 + Math.random());
    }
  }

  // Camera shake: kicks add up (to 1) and settle over SHAKE_MS.
  private shakeAmount = 0;
  private shakeAt = 0;

  /** Shake the camera (0..1; explosions and crashes near you). */
  shake(amount: number): void {
    this.shakeAmount = Math.min(1, this.currentShake() + amount);
    this.shakeAt = performance.now();
  }

  private currentShake(): number {
    return this.shakeAmount * Math.max(0, 1 - (performance.now() - this.shakeAt) / SHAKE_MS);
  }

  /** Chunks flying out of a broken crate, barrel or wall: real little bodies that bounce and settle (falls back to a canned arc without physics). */
  debris(at: Vec3, color: string, size: number, count = 10, speed = 1): void {
    for (let k = 0; k < count; k++) {
      const s = size * (0.15 + Math.random() * 0.2);
      const chunk = CreateBox('debris', { size: s }, this.scene);
      chunk.material = solid(this.scene, 'debrisMat', color);
      chunk.isPickable = false;
      const v = new Vector3((Math.random() - 0.5) * 6 * speed, (2 + Math.random() * 4) * speed, (Math.random() - 0.5) * 6 * speed);
      const spin = new Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      const start = new Vector3(at.x + (Math.random() - 0.5) * size, at.y + (Math.random() - 0.5) * size, at.z + (Math.random() - 0.5) * size);
      if (this.physics) {
        const body = this.physics.addBody({ kind: 'box', half: { x: s / 2, y: s / 2, z: s / 2 } }, start, { x: 0, y: 0, z: 0, w: 1 }, 'debris', { vel: v, spin, density: 0.6 });
        chunk.position.copyFrom(start);
        this.debrisBodies.push({ mesh: chunk, body, born: performance.now() });
        continue;
      }
      // Each effect disposes its own material when it ends.
      this.effects.push({
      mesh: chunk,
      born: performance.now(),
      ttl: 900,
      update: (f) => {
        const t = f * 0.9;
        chunk.position.set(start.x + v.x * t, Math.max(0.05 + at.y - size, start.y + v.y * t - 10 * t * t), start.z + v.z * t);
        chunk.rotation.set(spin.x * t, spin.y * t, spin.z * t);
        chunk.scaling.setAll(f > 0.7 ? (1 - f) / 0.3 : 1);
      },
    });
    }
  }

  /**
   * A pane of glass shattering: flat, see-through shards spread over the
   * pane's whole face (not from one point), falling mostly straight down with
   * a little outward burst, and a glint of sparkle. One shared material.
   */
  glassShards(box: OBox, tint: string): void {
    const h = box.half;
    // The pane's face: its two longer axes; the thin one is its normal.
    const thin = h.z <= h.x && h.z <= h.y ? 'z' : h.x <= h.y ? 'x' : 'y';
    const [ua, va] = thin === 'z' ? (['x', 'y'] as const) : thin === 'x' ? (['z', 'y'] as const) : (['x', 'z'] as const);
    const area = h[ua] * h[va] * 4;
    const count = Math.round(Math.min(16, 6 + area * 3));
    const q = box.rot ? new Quaternion(box.rot.x, box.rot.y, box.rot.z, box.rot.w) : Quaternion.RotationYawPitchRoll(box.yaw, 0, 0);
    const axis = (k: 'x' | 'y' | 'z') => new Vector3(k === 'x' ? 1 : 0, k === 'y' ? 1 : 0, k === 'z' ? 1 : 0).rotateByQuaternionToRef(q, new Vector3());
    const U = axis(ua);
    const V = axis(va);
    const N = axis(thin);
    const mat = (this.scene.getMaterialByName(`glassShardMat_${tint}`) as StandardMaterial | null) ?? glassShardMaterial(this.scene, tint);
    const centre = new Vector3(box.center.x, box.center.y, box.center.z);
    for (let k = 0; k < count; k++) {
      const w = 0.08 + Math.random() * Math.min(0.3, h[ua] * 0.35);
      const l = 0.06 + Math.random() * Math.min(0.26, h[va] * 0.4);
      const shard = CreateBox('glassShard', { width: w, height: l, depth: 0.012 }, this.scene);
      shard.material = mat;
      shard.isPickable = false;
      const start = centre.add(U.scale((Math.random() * 2 - 1) * h[ua] * 0.9)).add(V.scale((Math.random() * 2 - 1) * h[va] * 0.9));
      const out = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 1.4);
      const v = N.scale(out).add(new Vector3((Math.random() - 0.5) * 0.8, Math.random() * 1.2, (Math.random() - 0.5) * 0.8));
      const spin = new Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      const rot = q.multiply(Quaternion.RotationYawPitchRoll(Math.random() * 0.6, Math.random() * 0.6, Math.random() * Math.PI));
      shard.rotationQuaternion = rot;
      shard.position.copyFrom(start);
      if (this.physics) {
        const body = this.physics.addBody({ kind: 'box', half: { x: w / 2, y: l / 2, z: 0.006 } }, start, { x: rot.x, y: rot.y, z: rot.z, w: rot.w }, 'debris', { vel: v, spin, density: 2.5 });
        this.debrisBodies.push({ mesh: shard, body, born: performance.now(), shared: true });
        continue;
      }
      this.effects.push({
        mesh: shard,
        born: performance.now(),
        ttl: 1200,
        shared: true,
        update: (f) => {
          const t = f * 1.2;
          shard.position.set(start.x + v.x * t, Math.max(box.center.y - h.y - 1, start.y + v.y * t - 10 * t * t), start.z + v.z * t);
          shard.scaling.setAll(f > 0.7 ? (1 - f) / 0.3 : 1);
        },
      });
    }
    // A glitter of tiny sparkles where it burst.
    this.impacts.sparkBurst(box.center, 6, 2);
  }

  /** Screen position (CSS px) of a world point, or null when it is behind the camera. */
  project(p: Vec3): { x: number; y: number } | null {
    const engine = this.scene.getEngine();
    const w = engine.getRenderWidth();
    const h = engine.getRenderHeight();
    const v = Vector3.Project(new Vector3(p.x, p.y, p.z), Matrix.IdentityReadOnly, this.scene.getTransformMatrix(), this.camera.viewport.toGlobal(w, h));
    if (v.z < 0 || v.z > 1) return null;
    const canvas = engine.getRenderingCanvas();
    const scale = canvas ? canvas.clientWidth / w : 1;
    return { x: v.x * scale, y: v.y * scale };
  }

  private readonly mountNodes = new Map<number, TransformNode>();

  /** Turrets, sentries and vehicles at their smoothed poses; turret guns follow the aim. `manned` (the turret you are gunning) is hidden, as your own body is. */
  updateMounts(mounts: Iterable<ClientMount>, manned: number | null = null): void {
    let cockpit: { m: ClientMount; node: TransformNode } | null = null;
    for (const m of mounts) {
      let node = this.mountNodes.get(m.index);
      if (!node) {
        node = createMountNode(this.scene, this.models, m.model, `mount_${m.index}`, m.tint);
        this.mountNodes.set(m.index, node);
      }
      const now = performance.now();
      const fade = m.wreckGoneAt ? (now - m.wreckGoneAt) / (MOUNT_WRECK_FADE_SECONDS * 1000) : 1;
      const shown = m.alive || m.wreck || fade < 1;
      node.setEnabled(shown && m.index !== manned);
      node.position.set(m.shown.pos.x, m.shown.pos.y, m.shown.pos.z);
      this.charMount(m.index, node, !m.alive && shown, m.alive ? 1 : m.wreck ? 1 : Math.max(0, 1 - fade));
      this.mountDamageFx(m, now);
      if (m.alive && m.def.vehicle && this.liquids.length) this.wake(m, now);
      node.rotation.y = m.shown.yaw;
      if (m.def.kind === 'vehicle' && m.alive && !m.def.airplane) this.suspend(m, node);
      else if (!m.alive && shown) {
        // The hulk sits low and askew, and sinks away as it fades.
        node.rotation.x = 0.05;
        node.rotation.z = 0.07;
        node.position.y -= 0.15 + (m.wreck ? 0 : Math.min(1, fade) * 0.9);
      }
      this.cullCockpit(m.index, node, m.index === this.cockpit && m.alive);
      if (m.index === this.cockpit && m.alive && shown && m.index !== manned) cockpit = { m, node };
      if (m.def.kind !== 'vehicle') {
        const gun = mountGun(node);
        if (gun) gun.rotation.y = m.shown.aimYaw - m.shown.yaw;
      } else if (m.def.turret && m.alive) this.turnTurret(m, node);
      if (m.def.glow) this.arcSentryGlow(m, node, now);
    }
    let drive: CockpitDrive | null = null;
    if (cockpit) {
      const { m } = cockpit;
      drive = { steer: this.sprung.get(m.index)?.steer ?? 0, speed: m.vel.x * Math.sin(m.shown.yaw) + m.vel.z * Math.cos(m.shown.yaw) };
    }
    this.cockpitInterior.update(cockpit?.m.index ?? null, cockpit?.node ?? null, cockpit?.m.def ?? null, drive);
  }

  /** Each turning-gun vehicle's drawn turret yaw and barrel pitch (radians, in the vehicle's frame), by mount index. */
  private readonly turretAims = new Map<number, { yaw: number; pitch: number }>();

  /**
   * A vehicle that turns its own gun (MountDef.turret, the Tank): the turret follows its seat's aim about the upright,
   * within the seat's arc, and the barrel its pitch within `turret.pitch`; with nobody in that seat both ease back to
   * straight ahead. Eased (TURRET_TURN rad/s), so snapshot steps don't jerk it.
   */
  private turnTurret(m: ClientMount, node: TransformNode): void {
    const parts = mountTurret(node);
    if (!parts) return;
    const spec = m.def.turret!;
    const seat = m.def.seats[spec.seat];
    const manned = (m.seats[spec.seat] ?? -1) >= 0;
    const arc = seat?.arc ?? Math.PI;
    const rel = Math.atan2(Math.sin(m.shown.aimYaw - m.shown.yaw - (seat?.facing ?? 0)), Math.cos(m.shown.aimYaw - m.shown.yaw - (seat?.facing ?? 0)));
    const [lo, hi] = spec.pitch ?? [-0.5, 0.75];
    const want = manned ? { yaw: (seat?.facing ?? 0) + Math.max(-arc, Math.min(arc, rel)), pitch: Math.max(lo, Math.min(hi, m.shown.aimPitch)) } : { yaw: 0, pitch: 0 };
    let aim = this.turretAims.get(m.index);
    if (!aim) this.turretAims.set(m.index, (aim = { ...want }));
    const now = performance.now();
    const dt = Math.min(0.1, (now - (this.turretAt.get(m.index) ?? now)) / 1000);
    this.turretAt.set(m.index, now);
    const step = TURRET_TURN * dt;
    aim.yaw += Math.max(-step, Math.min(step, want.yaw - aim.yaw));
    aim.pitch += Math.max(-step, Math.min(step, want.pitch - aim.pitch));
    // The parts sit inside the glTF import's mirrored root (x flipped): a turn about the upright reads the other way
    // round there, a pitch about x the same way; + pitch (up) is a turn of the barrel's nose up, -x in Babylon's frame.
    parts.turret.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), -aim.yaw);
    if (parts.barrel) parts.barrel.rotationQuaternion = Quaternion.RotationAxis(Vector3.Right(), -aim.pitch);
  }
  private readonly turretAt = new Map<number, number>();

  /** Arc sentries' charge orbs (over the gun, where their arc starts), by mount index: the plain sphere stands in when the pack's ball can't play. */
  private readonly chargeOrbs = new Map<number, Mesh>();
  /** Arc sentries' balls of lightning (Electric FX, content/vfx.json map.lasting `charge.<mount>`) and their drawn size, by mount index. */
  private readonly chargeBalls = new Map<number, { fx: VfxHandle | null; size: number }>();

  /**
   * An arc sentry's tell: its body glows brighter through a wind-up and a ball of its colour grows over the gun
   * (where the arc will start), then both hold, flickering, while the arc is locked on. Idle: a faint glow, no ball.
   */
  private arcSentryGlow(m: ClientMount, node: TransformNode, now: number): void {
    const glow = m.def.glow!;
    const windUp = (m.def.sentry?.arc?.windUpSeconds ?? 0.75) * 1000;
    const flicker = 0.5 + 0.5 * Math.sin(now * 0.045);
    const charge = m.alive && m.charging ? Math.min(1, (now - m.charging) / windUp) : 0;
    const level = !m.alive ? 0 : m.arcing ? 0.8 + 0.2 * flicker : charge ? charge * (0.75 + 0.25 * flicker) : 0;
    setMountGlow(node, glow, level);
    let orb = this.chargeOrbs.get(m.index);
    if (!orb) {
      orb = CreateSphere(`charge_${m.index}`, { diameter: 1, segments: 8 }, this.scene);
      const mat = new StandardMaterial(`charge_${m.index}`, this.scene);
      mat.disableLighting = true;
      mat.emissiveColor = Color3.FromHexString(glow);
      mat.alpha = 0.75;
      orb.material = mat;
      orb.isPickable = false;
      this.chargeOrbs.set(m.index, orb);
    }
    const size = m.arcing ? 0.3 + 0.08 * flicker : charge ? 0.08 + 0.32 * charge : 0;
    const shown = size > 0 && node.isEnabled();
    const at = new Vector3(m.shown.pos.x, m.shown.pos.y + m.def.half[1] * 2 + 0.2, m.shown.pos.z);
    // The pack's ball of lightning grows with the charge and crackles through the lock (the same size as the orb it
    // replaces: the tell's timing and reach are the game's); it fades out when the sentry lets go.
    let ball = this.chargeBalls.get(m.index);
    if (!ball) this.chargeBalls.set(m.index, (ball = { fx: null, size: 0 }));
    const ref = lastingFx(`charge.${m.def.id}`);
    if (shown && ref && (!ball.fx || ball.fx.done)) ball.fx = this.vfx.start(ref.pack, ref.effect, at, { scale: size * ref.scale });
    else if (!shown && ball.fx) {
      ball.fx.stop();
      ball.fx = null;
    }
    ball.fx?.move(at, { scale: size * ref!.scale });
    ball.size = shown ? size : 0;
    // The plain orb stays under the pack's ball, fainter: the tell reads as a solid ball of its colour from afar.
    orb.setEnabled(shown);
    (orb.material as StandardMaterial).alpha = ball.fx ? 0.35 : 0.75;
    if (size > 0) {
      orb.scaling.setAll(size);
      orb.position.copyFrom(at);
    }
  }

  /** What starting each lasting effect costs (tools/perf/perf96.mjs): each started at `at` and stopped at once, in ms. */
  lastingProbe(at: Vec3): Record<string, number> {
    const out: Record<string, number> = {};
    for (const key of lastingKeys()) {
      const ref = lastingFx(key)!;
      const t0 = performance.now();
      const h = this.vfx.start(ref.pack, ref.effect, new Vector3(at.x, at.y, at.z), { scale: ref.scale });
      out[`lasting ${key}`] = Math.round((performance.now() - t0) * 10) / 10;
      h?.stop();
    }
    return out;
  }

  /** An arc sentry's charge orb as drawn now (tests): its size (0: hidden), or null (not an arc sentry). */
  chargeOrb(index: number): number | null {
    const ball = this.chargeBalls.get(index);
    return ball ? ball.size : null;
  }

  /** The ridden vehicle's in-house cockpit (content/cockpits.ts), drawn only in your cockpit view. */
  private cockpitInteriorRef: CockpitInterior | null = null;
  private get cockpitInterior(): CockpitInterior {
    return (this.cockpitInteriorRef ??= new CockpitInterior(this.scene));
  }

  /** Whether a vehicle's cockpit interior is drawn now (tests: shown in the cockpit view, never in the chase view). */
  cockpitInteriorShown(): boolean {
    return this.cockpitInteriorRef?.isShown() ?? false;
  }

  /** The cockpit drawn now (tests): triangles, the steering wheel's turn (radians), needle readings, body cut. */
  cockpitInteriorState(): ReturnType<CockpitInterior['state']> {
    return this.cockpitInteriorRef?.state() ?? null;
  }

  /** The vehicle you are looking out of in the cockpit view (its inner faces are culled), or null. */
  private cockpit: number | null = null;
  private readonly culled = new Map<number, { mesh: AbstractMesh; mat: Material | null }[]>();
  private readonly cullMats = new Map<Material, Material>();

  /** Set (or clear) the vehicle the cockpit view looks out of; applied with the next updateMounts. */
  setCockpit(index: number | null): void {
    this.cockpit = index;
  }

  /**
   * Most vehicle models are drawn double-sided, so from a seat inside a closed
   * body you would look at the inside of its roof and doors. In the cockpit
   * the ridden vehicle gets one-sided copies of its materials (shared per
   * source material): the hood, bonnet and frame in front of you still show,
   * the shell around your head doesn't. Put back when you leave the cockpit.
   */
  private cullCockpit(index: number, node: TransformNode, on: boolean): void {
    const done = this.culled.get(index);
    if (!on) {
      if (!done) return;
      for (const { mesh, mat } of done) mesh.material = mat;
      this.culled.delete(index);
      return;
    }
    if (done) return;
    const meshes = node.getChildMeshes().filter((mesh) => !('sourceMesh' in mesh) && mesh.material);
    // The model is still loading: try again next frame.
    if (!meshes.length) return;
    const list = meshes.map((mesh) => ({ mesh, mat: mesh.material }));
    for (const { mesh, mat } of list) {
      if (!mat || mat.backFaceCulling) continue;
      let one = this.cullMats.get(mat);
      if (!one) {
        one = mat.clone(`${mat.name}_cockpit`) ?? mat;
        one.backFaceCulling = true;
        this.cullMats.set(mat, one);
      }
      mesh.material = one;
    }
    this.culled.set(index, list);
  }

  /** A vehicle's drawn tilt (its model's rotation.x, + nose down, and rotation.z), for the cockpit camera. */
  mountTilt(index: number): { pitch: number; roll: number } {
    const node = this.mountNodes.get(index);
    return node ? { pitch: node.rotation.x, roll: node.rotation.z } : { pitch: 0, roll: 0 };
  }

  /** A point in a mount's own frame (+Z forward), where its model is drawn now (tilt and springs included). */
  mountPoint(index: number, local: readonly [number, number, number]): Vec3 | null {
    const node = this.mountNodes.get(index);
    if (!node) return null;
    const p = Vector3.TransformCoordinates(new Vector3(local[0], local[1], local[2]), node.computeWorldMatrix(true));
    return { x: p.x, y: p.y, z: p.z };
  }

  /** Each charred mount's meshes and the materials they had (put back when it respawns). */
  private readonly charred = new Map<number, { mesh: AbstractMesh; mat: Material | null }[]>();
  private readonly charMats = new Map<Material, Material>();

  /**
   * Burn a wreck black: every mesh swaps to a darkened copy of its material
   * (shared per source material, so other vehicles of the model keep their
   * paint), and `visibility` fades it out. Undone when the mount is back.
   */
  private charMount(index: number, node: TransformNode, on: boolean, visibility: number): void {
    const done = this.charred.get(index);
    if (!on) {
      if (!done) return;
      for (const { mesh, mat } of done) {
        mesh.material = mat;
        mesh.visibility = 1;
      }
      this.charred.delete(index);
      return;
    }
    let list = done;
    if (!list) {
      // Instances share their source's material: leave those be.
      const meshes = node.getChildMeshes().filter((mesh) => !('sourceMesh' in mesh));
      if (!meshes.length) return;
      list = meshes.map((mesh) => ({ mesh, mat: mesh.material }));
      for (const { mesh, mat } of list) {
        if (!mat) continue;
        let dark = this.charMats.get(mat);
        if (!dark) {
          dark = mat.clone(`${mat.name}_charred`) ?? mat;
          const d = dark as Material & { albedoColor?: Color3; diffuseColor?: Color3; emissiveColor?: Color3; metallic?: number | null; roughness?: number | null };
          d.albedoColor?.scaleInPlace(0.12);
          d.diffuseColor?.scaleInPlace(0.12);
          d.emissiveColor?.scaleInPlace(0);
          if (d.roughness !== undefined) d.roughness = 1;
          this.charMats.set(mat, dark);
        }
        mesh.material = dark;
      }
      this.charred.set(index, list);
    }
    for (const { mesh } of list) mesh.visibility = visibility;
  }

  private readonly mountFxAt = new Map<number, number>();
  private readonly wakeAt = new Map<number, number>();

  /**
   * A vehicle moving at the surface of water or swamp (riding on it, or
   * wading through the shallows) throws white spray off its stern and
   * sides, more the faster it goes. Drawing only.
   */
  private wake(m: ClientMount, now: number): void {
    if ((this.wakeAt.get(m.index) ?? 0) > now) return;
    const p = m.shown.pos;
    const top = floatSurface(this.liquids, p, 0.6);
    if (top === null || p.y < top - 1.2) return;
    const speed = Math.hypot(m.vel.x, m.vel.z);
    if (speed < 3) return;
    const [hx, , hz] = m.def.half;
    const f = { x: Math.sin(m.shown.yaw), z: Math.cos(m.shown.yaw) };
    const r = { x: f.z, z: -f.x };
    const k = Math.min(1, speed / 25);
    const at = (along: number, side: number) => ({ x: p.x + f.x * along + r.x * side, y: top + 0.05, z: p.z + f.z * along + r.z * side });
    this.impacts.puff(at(-hz * 0.95, (Math.random() - 0.5) * hx), '#e4f0ee', 0.5 + k * 0.9, 0.7, 0.6);
    const s = Math.random() < 0.5 ? -1 : 1;
    this.impacts.puff(at(hz * (0.2 + Math.random() * 0.5), s * hx * 1.05), '#f4faf9', 0.35 + k * 0.5, 0.45, 1.2);
    this.wakeAt.set(m.index, now + 110 - k * 60);
  }

  /**
   * Damage you can read from across the map: light grey smoke under 60%
   * health, thick black smoke and sparks under 35%, flames under 15% (or set
   * alight); the wreck smoulders black. Drawing only.
   */
  private mountDamageFx(m: ClientMount, now: number): void {
    const state = m.wreck ? 'wreck' : m.alive ? mountDamageState(m.health / 100, m.burning) : 'gone';
    if (state === 'intact' || state === 'gone') return;
    const [hx, hy, hz] = m.def.half;
    const p = m.shown.pos;
    // Burning, and the wreck smouldering: the pack's fire on top (Flame FX, map.lasting `fire.vehicle` / `fire.wreck`),
    // sized to the vehicle; the plain flame puffs only where it isn't drawn.
    let fire = false;
    if (state === 'burning' || state === 'wreck') {
      const id = `mount:${m.index}`;
      this.lasting.want(id, state === 'burning' ? 'fire.vehicle' : 'fire.wreck', { x: p.x, y: p.y + hy * 2 - 0.25, z: p.z }, { size: Math.max(0.8, Math.min(2.2, (hx + hz) * 0.6)) });
      fire = this.lasting.drawn(id);
    }
    // Heavy damage, burning and the wreck: Smoke VFX's column over it (map.lasting `smoke.wreck`), in place of the black puffs.
    let smoke = false;
    if (state === 'heavy' || state === 'burning' || state === 'wreck') {
      const id = `mountSmoke:${m.index}`;
      this.lasting.want(id, 'smoke.wreck', { x: p.x, y: p.y + hy * 2, z: p.z }, { size: Math.max(0.8, Math.min(2.2, (hx + hz) * 0.6)) });
      smoke = this.lasting.drawn(id);
    }
    if ((this.mountFxAt.get(m.index) ?? 0) > now) return;
    const spot = (spread: number) => ({ x: p.x + (Math.random() - 0.5) * hx * spread, y: p.y + hy * 2 - 0.1, z: p.z + (Math.random() - 0.5) * hz * spread });
    const size = Math.max(0.8, Math.min(2, (hx + hz) * 0.5));
    if (state === 'smoking') {
      this.impacts.puff(spot(0.8), '#8c8884', size * 0.8, 1.8, 1.6);
      this.mountFxAt.set(m.index, now + 240);
    } else if (state === 'heavy') {
      if (!smoke) this.impacts.puff(spot(0.9), '#2a2725', size * 1.2, 2.2, 2);
      if (Math.random() < 0.3) this.impacts.sparkBurst(spot(1.4), 6, 2.5);
      this.mountFxAt.set(m.index, now + 120);
    } else if (state === 'burning') {
      if (!fire) {
        this.impacts.puff(spot(1.1), '#ff7a1a', size * 0.7, 0.45, 1.8, true);
        this.impacts.puff(spot(0.8), Math.random() < 0.5 ? '#ffb347' : '#e8541c', size * 0.5, 0.35, 2.2, true);
      }
      if (!smoke) this.impacts.puff(spot(0.9), '#151312', size * 1.5, 2.6, 2.4);
      if (Math.random() < 0.35) this.impacts.sparkBurst(spot(1.2), 8, 3);
      this.mountFxAt.set(m.index, now + 70);
    } else {
      // The wreck: a column of black smoke and the last licks of flame.
      if (!smoke) this.impacts.puff(spot(0.7), '#151312', size * 1.4, 3.2, 2.2);
      if (!fire && Math.random() < 0.4) this.impacts.puff(spot(1), '#ff6a14', size * 0.4, 0.4, 1.2, true);
      this.mountFxAt.set(m.index, now + 160);
    }
  }

  /** Per vehicle: drawn tilt, landing bounce and the last pose (to read speed, acceleration and turning). */
  private suspension = new Map<number, { pitch: number; roll: number; bounce: number; bounceVel: number; pos: Vec3; yaw: number; speed: number; accel: number; t: number; air: boolean }>();

  /**
   * Visual suspension: the body settles to the slope under its wheels (or
   * pads), squats when it accelerates and dives when it brakes, leans out of
   * turns, and bounces on its springs when it lands. Drawing only; the
   * simulation's collision box stays level.
   */
  private suspend(m: ClientMount, node: TransformNode): void {
    if (m.susp) {
      this.suspendSprung(m, node);
      return;
    }
    this.sprung.delete(m.index);
    const now = performance.now();
    const p = m.shown.pos;
    let st = this.suspension.get(m.index);
    if (!st) this.suspension.set(m.index, (st = { pitch: 0, roll: 0, bounce: 0, bounceVel: 0, pos: { ...p }, yaw: m.shown.yaw, speed: 0, accel: 0, t: now, air: false }));
    const dt = Math.min(0.1, Math.max(0.001, (now - st.t) / 1000));
    const fwd = { x: Math.sin(m.shown.yaw), z: Math.cos(m.shown.yaw) };
    // Speed, turn rate and fall from the mount's velocity and spin, measured on the server's clock (ticks), not from
    // how far the drawn pose moved since the last frame: that eases toward each snapshot as it arrives, so frame to
    // frame it surges and stalls, and reading acceleration off it shook the body (and the cockpit view) at speed.
    const speed = m.vel.x * fwd.x + m.vel.z * fwd.z;
    // Acceleration low-passed: the velocity steps once per snapshot, so its frame-to-frame change spikes.
    st.accel += ((speed - st.speed) / dt - st.accel) * Math.min(1, dt * 4);
    const accel = st.accel;
    const yawRate = m.spin;
    const fell = -m.vel.y;
    // Ground under the four corners.
    const [hx, , hz] = m.def.half;
    const side = { x: Math.cos(m.shown.yaw), z: -Math.sin(m.shown.yaw) };
    const groundAt = (f: number, r: number) => {
      const o = { x: p.x + fwd.x * f + side.x * r, y: p.y + 1.5, z: p.z + fwd.z * f + side.z * r };
      const hit = this.raycastLevel(o, { x: 0, y: -1, z: 0 }, 4);
      return hit ? o.y - hit.dist : null;
    };
    const front = groundAt(hz * 0.8, 0);
    const back = groundAt(-hz * 0.8, 0);
    const left = groundAt(0, -hx * 0.8);
    const rightG = groundAt(0, hx * 0.8);
    const under = groundAt(0, 0);
    const air = !m.def.vehicle?.hover && (under === null || p.y - under > 0.35);
    let pitch = 0;
    let roll = 0;
    if (!air) {
      if (front !== null && back !== null) pitch = -Math.atan2(front - back, hz * 1.6);
      if (left !== null && rightG !== null) roll = Math.atan2(rightG - left, hx * 1.6);
    } else pitch = st.pitch * 0.98;
    // Squat under power, dive under brakes, lean out of the turn; hovercraft bank into it instead.
    const hover = !!m.def.vehicle?.hover;
    const fly = !!m.def.vehicle?.fly;
    pitch += Math.max(-0.08, Math.min(0.08, -accel * 0.006));
    // Flyers bank harder and raise the nose to climb (lower it to dive): their attitude, which the cockpit view follows.
    if (fly) pitch += Math.max(-0.25, Math.min(0.25, -m.vel.y * 0.04));
    const bank = fly ? 0.3 : 0.12;
    roll += Math.max(-bank, Math.min(bank, yawRate * speed * (hover ? (fly ? -0.012 : -0.006) : 0.004)));
    // Springs: landing compresses them, then it rocks back.
    if (st.air && !air) st.bounceVel -= Math.min(4, Math.max(1, fell * 0.25));
    st.bounceVel += (-st.bounce * 90 - st.bounceVel * 9) * dt;
    st.bounce += st.bounceVel * dt;
    const k = Math.min(1, dt * 10);
    st.pitch += (pitch - st.pitch) * k;
    st.roll += (roll - st.roll) * k;
    node.rotation.x = st.pitch;
    node.rotation.z = st.roll;
    node.position.y += Math.max(-0.25, Math.min(0.15, st.bounce)) + (hover ? Math.sin(now / 260 + m.index) * 0.04 : 0);
    st.pos = { ...p };
    st.yaw = m.shown.yaw;
    st.speed = speed;
    st.t = now;
    st.air = air;
    this.turnWheels(m, node, dt, null);
  }

  /** Per vehicle with server suspension: the drawn (eased) body and wheels, the wheels' roll, and when it was drawn. */
  private sprung = new Map<number, { h: number; p: number; r: number; steer: number; wheel: number[]; t: number }>();

  /**
   * The body as the simulation's raycast suspension holds it (snapshot `ms`: height, pitch, roll, steering and each
   * wheel's spring), eased toward the latest values like the pose is (nothing here reads frame-to-frame movement).
   */
  private suspendSprung(m: ClientMount, node: TransformNode): void {
    const now = performance.now();
    const want = m.susp!;
    let st = this.sprung.get(m.index);
    if (!st) this.sprung.set(m.index, (st = { h: want.h, p: want.p, r: want.r, steer: want.steer, wheel: [...want.wheel], t: now }));
    const dt = Math.min(0.1, Math.max(0.001, (now - st.t) / 1000));
    st.t = now;
    const k = Math.min(1, dt * 18);
    st.h += (want.h - st.h) * k;
    st.p += (want.p - st.p) * k;
    st.r += (want.r - st.r) * k;
    st.steer += (want.steer - st.steer) * k;
    want.wheel.forEach((w, i) => (st.wheel[i] = (st.wheel[i] ?? w) + (w - (st.wheel[i] ?? w)) * k));
    // Babylon: rotation.x + is nose down, rotation.z + lifts the right side.
    node.rotation.x = -st.p;
    node.rotation.z = -st.r;
    node.position.y += st.h;
    this.turnWheels(m, node, dt, st);
  }

  /** Each wheel's roll angle (radians) per vehicle. */
  private wheelRoll = new Map<number, number>();

  /**
   * Drawn wheels (MountDef.wheels, or a model's own on a vehicle with suspension): they roll with the vehicle's
   * speed (its tick-based velocity), the front ones steer, and each rides its spring (the body's height and tilt
   * are on the parent already, so a wheel's offset is along the body's up).
   */
  private turnWheels(m: ClientMount, node: TransformNode, dt: number, st: { steer: number; wheel: number[] } | null): void {
    const wheels = wheelsOf(node);
    if (!wheels.length) return;
    const setup = suspensionOf(m.def);
    const radius = setup?.hubY ?? m.def.wheels?.at[0]?.[1] ?? 0.4;
    const speed = m.vel.x * Math.sin(m.shown.yaw) + m.vel.z * Math.cos(m.shown.yaw);
    const roll = ((this.wheelRoll.get(m.index) ?? 0) + (speed * dt) / radius) % (Math.PI * 2);
    this.wheelRoll.set(m.index, roll);
    const lock = setup?.steer ?? 0;
    for (const w of wheels) {
      w.pivot.rotation.x = roll;
      w.pivot.rotation.y = w.front && st ? st.steer * lock : 0;
      w.pivot.position.y = w.rest + (st && w.slot >= 0 ? (st.wheel[w.slot] ?? 0) : 0);
    }
  }

  /** Ground hazards and fields from the latest snapshot. */
  updateZones(zones: readonly ZoneSnapshot[] | undefined, now: number): void {
    this.zoneVisuals.apply(zones, now);
    this.smoke = this.zoneVisuals.smokeClouds();
  }

  /** The smoke clouds drawn now (smoke grenades): enemy markers behind one aren't drawn; inside one, grey fog. */
  private smoke: SmokeCloud[] = [];
  /** How deep in smoke your eye is, eased (0 clear, 1 thick): the fog follows it, so it never jumps. */
  private smokeFog = 0;
  private smokeFogAt = 0;
  private smokeDryFog: { mode: number; color: Color3; density: number } | null = null;

  /**
   * Inside a smoke cloud you see a couple of metres (the match's sight checks let a body SMOKE.opaque m off show):
   * the scene's fog turns a steady mid grey and thickens as your eye goes deeper, eased in and out over about two
   * thirds of a second. No flash, no white-out and no flicker. Under water, the water's fog wins.
   */
  private updateSmokeFog(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - (this.smokeFogAt || now)) / 1000);
    this.smokeFogAt = now;
    let deep = 0;
    const eye = this.camera.position;
    for (const c of this.smoke) {
      const dx = (eye.x - c.x) / c.radius;
      const dy = (eye.y - c.y) / (c.radius * SMOKE.squash);
      const dz = (eye.z - c.z) / c.radius;
      deep = Math.max(deep, Math.min(1, (1 - Math.sqrt(dx * dx + dy * dy + dz * dz)) * 2.5));
    }
    this.smokeFog += Math.max(-dt * 1.5, Math.min(dt * 1.5, deep - this.smokeFog));
    if (this.underLiquid) return;
    if (this.smokeFog < 0.005) {
      this.smokeFog = 0;
      if (this.smokeDryFog) {
        this.scene.fogMode = this.smokeDryFog.mode;
        this.scene.fogColor = this.smokeDryFog.color;
        this.scene.fogDensity = this.smokeDryFog.density;
        this.smokeDryFog = null;
      }
      this.smokeSkyBack();
      return;
    }
    this.smokeDryFog ??= { mode: this.scene.fogMode, color: this.scene.fogColor.clone(), density: this.scene.fogDensity };
    const dry = this.smokeDryFog;
    const grey = Math.min(1, this.smokeFog * 1.5);
    this.scene.fogMode = 2;
    this.scene.fogColor = Color3.Lerp(dry.color, SMOKE_FOG, grey);
    this.scene.fogDensity = dry.density + (SMOKE_FOG_DENSITY - dry.density) * this.smokeFog;
    // The sky draws without fog (backdrop.ts): it fades to the same grey, or the skyline, and anyone against it,
    // would show through the haze. Its brightness and glow are uniforms: no shader is built for it.
    const sky = this.scene.getMaterialByName('backdrop_skyMat');
    if (sky instanceof StandardMaterial && sky.reflectionTexture) {
      if (this.smokeSky?.mat !== sky) {
        this.smokeSkyBack();
        this.smokeSky = { mat: sky, level: sky.reflectionTexture.level, glow: sky.emissiveColor.clone() };
      }
      sky.reflectionTexture.level = this.smokeSky.level * (1 - grey);
      sky.emissiveColor = Color3.Lerp(this.smokeSky.glow, this.scene.fogColor, grey);
    }
  }

  /** The sky as it was before smoke faded it (updateSmokeFog), and how bright it was then. */
  private smokeSky: { mat: StandardMaterial; level: number; glow: Color3 } | null = null;

  /** The sky back as it was, out of the smoke. */
  private smokeSkyBack(): void {
    const s = this.smokeSky;
    if (!s) return;
    this.smokeSky = null;
    if (s.mat.reflectionTexture) s.mat.reflectionTexture.level = s.level;
    s.mat.emissiveColor = s.glow;
  }

  /** Whether smoke hides a point from your eye (tests, and enemy markers). */
  smokeHides(at: Vec3): boolean {
    if (!this.smoke.length) return false;
    const e = this.camera.position;
    return smokeBlocks({ x: e.x, y: e.y, z: e.z }, at, this.smoke);
  }

  /** A solid beam (lasers, rails, freeze rays) that thins away. */
  addBeam(from: Vec3, to: Vec3, color: string, width = 0.05, ttlMs = 110): void {
    const mesh = createBeam(this.scene, from, to, color, width);
    this.effects.push({
      mesh,
      born: performance.now(),
      ttl: ttlMs,
      update: (f) => {
        mesh.scaling.x = mesh.scaling.z = 1 - f * 0.8;
      },
    });
  }

  /** Where the last rope (a grapple's) started when it was first drawn, world, and whether that was a gun's muzzle (tests). */
  lastRope: { from: Vec3; muzzle: boolean } | null = null;

  /**
   * A grapple's rope from a gun's muzzle to the hook, kept on the muzzle as it moves (you're pulled in along it).
   * `from` gives the muzzle each frame (null while no gun is drawn: then `fallback`, where the shot left).
   */
  addRope(from: () => Vec3 | null, fallback: Vec3, to: Vec3, color: string, width: number, ttlMs: number): void {
    const mesh = CreateCylinder('rope', { diameter: width, height: 1, tessellation: 6 }, this.scene);
    const mat = new StandardMaterial('ropeMat', this.scene);
    mat.emissiveColor = Color3.FromHexString(color);
    mat.diffuseColor = Color3.Black();
    mat.disableLighting = true;
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.rotationQuaternion = Quaternion.Identity();
    const b = new Vector3(to.x, to.y, to.z);
    let last = fallback;
    const place = () => {
      last = from() ?? last;
      const a = new Vector3(last.x, last.y, last.z);
      const d = b.subtract(a);
      const len = Math.max(0.01, d.length());
      mesh.position.copyFrom(a.add(b).scale(0.5));
      mesh.scaling.y = len;
      Quaternion.FromUnitVectorsToRef(Vector3.Up(), d.scale(1 / len), mesh.rotationQuaternion!);
    };
    const muzzle = from();
    place();
    this.lastRope = { from: { ...last }, muzzle: !!muzzle };
    this.effects.push({
      mesh,
      born: performance.now(),
      ttl: ttlMs,
      update: (f) => {
        place();
        mesh.scaling.x = mesh.scaling.z = 1 - f * 0.6;
      },
    });
  }

  /**
   * Chain lightning through the points it jumped: a bolt of Binbun's Electric FX along each jump, rooted where it
   * lands, and a crackle where the last one lands (content/vfx.json map.arcs, by source: an arc sentry, an electric
   * fence or a gun). Each bolt plays a few times faster than the pack's, to last about as long as the game's gap
   * between arcs. Where the pack can't play (not in yet, or too many effects at once) the plain jagged line does.
   */
  addArc(pts: readonly Vec3[], color = '#9fd8ff', source: 'mount' | 'fence' | 'default' = 'default'): void {
    const fx = arcFx(source);
    const plain: Vec3[][] = [];
    let drawn = 0;
    const cam = this.camera.globalPosition;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const d = new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
      const len = d.length();
      // Far off the plain line reads as well and costs less.
      const ok =
        !!fx &&
        len > 0.2 &&
        Math.hypot(cam.x - b.x, cam.y - b.y, cam.z - b.z) <= ACCENT_RANGE * 2 &&
        this.vfx.play(fx.zap.pack, fx.zap.effect, new Vector3(b.x, b.y, b.z), {
          scale: fx.zap.scale,
          up: d.scale(1 / Math.max(len, 1e-3)),
          speed: fx.speed,
          only: ZAP_PARTS,
          stretch: { nodes: ZAP_TUBES, by: len / (ZAP_LENGTH * fx.zap.scale) },
        });
      if (ok) drawn++;
      else plain.push([a, b]);
    }
    const end = pts[pts.length - 1];
    if (drawn && fx?.hit && end) this.accent(fx.hit, end);
    for (const seg of plain) {
      this.effects.push({ mesh: createArc(this.scene, seg, color), born: performance.now(), ttl: 140 });
      this.effects.push({ mesh: createArc(this.scene, seg, '#ffffff'), born: performance.now(), ttl: 70 });
    }
  }

  /** A shot's trail: beam weapons draw beams, everything else tracers. */
  addShot(def: WeaponDefinition | undefined, from: Vec3, to: Vec3, color: string, ttlMs = 90): void {
    if (def?.id === 'core.railgun') {
      // A thick glowing rail that lingers, with a hot white core that snaps off first.
      this.addBeam(from, to, def.view.tracer, 0.14, 750);
      this.addBeam(from, to, '#ffffff', 0.04, 220);
    } else if (def?.view.beam) this.addBeam(from, to, def.view.tracer, 0.04, 90);
    else this.addTracer(from, to, color, ttlMs);
  }

  addTracer(from: Vec3, to: Vec3, color: string, ttlMs = 90): void {
    const mesh = CreateLines('tracer', { points: [new Vector3(from.x, from.y - 0.08, from.z), new Vector3(to.x, to.y, to.z)] }, this.scene);
    mesh.color = Color3.FromHexString(color);
    mesh.isPickable = false;
    this.effects.push({ mesh, born: performance.now(), ttl: ttlMs });
  }

  /** The engine's draw-call counter (Babylon only resets it per frame when asked: `countDraws`). */
  private get drawCounter(): PerfCounter | undefined {
    return (this.scene.getEngine() as unknown as { _drawCalls?: PerfCounter })._drawCalls;
  }

  /** Other players and NPCs drawn as characters (for the performance report). */
  get avatarCount(): number {
    return this.avatars.size;
  }

  /** Shader programs the engine has built so far (one built mid-match is a first-sight stall; perfRecorder). */
  shaderCount(): number {
    const fx = (this.scene.getEngine() as unknown as { _compiledEffects?: Record<string, unknown> })._compiledEffects;
    return fx ? Object.keys(fx).length : 0;
  }

  /** Start counting this frame's draw calls (before `render`), for the performance overlay. */
  countDraws(): void {
    this.drawCounter?.fetchNewFrame();
  }

  /** What the frame just rendered drew, for the performance overlay (after `countDraws` and `render`). */
  perfCounts(): { draws: number; meshes: number; casters: number; characters: number; effects: number } {
    const counter = this.drawCounter;
    counter?.addCount(0, true);
    let characters = 0;
    for (const a of this.avatars.values()) if (a.anim && !a.culled) characters++;
    return { draws: counter?.current ?? 0, meshes: this.scene.getActiveMeshes().length, casters: this.atmosphere.casterCount, characters, effects: this.vfx.count + this.effects.length };
  }

  render(): void {
    const now = performance.now();
    // Prop batches' levels of detail (and small props' near shadows) follow the camera.
    const cam = this.scene.activeCamera;
    if (this.propBatches && cam) this.propBatches.update(cam.globalPosition);
    this.effects = this.effects.filter((fx) => {
      const f = (now - fx.born) / fx.ttl;
      if (f >= 1) {
        if (!fx.shared) fx.mesh.material?.dispose();
        fx.mesh.dispose();
        return false;
      }
      fx.update?.(f);
      return true;
    });
    this.scene.render();
  }

  dispose(): void {
    setCharacterLodCrowd(false);
    for (const list of this.bodyPool.values()) for (const anim of list) anim.dispose();
    this.bodyPool.clear();
    this.atmosphere.dispose();
    this.propBatches?.dispose();
    this.blood.dispose();
    this.impacts.dispose();
    this.environment?.dispose();
    this.scene.dispose();
    this.physics?.free();
    this.physics = null;
  }
}

/**
 * The render parts of the performance split (perfProbe.SYS): spans inside `scene.render()` between Babylon's
 * own observables, first in each list so they bracket everyone else's. Off: one boolean check per observable.
 * Animation runs from before the clips to before the render (the clips, then the after-animation aim and grip);
 * mesh evaluation leaves out the skinning inside it (CharacterAnimator times that); render targets are the
 * shadow maps and the mist's depth map; post-processing from the end of the draw to the end of the camera.
 */
function instrumentRender(scene: Scene): void {
  const skin = (t0: number) => {
    perfProbe.add(SYS.skin, t0);
    perfProbe.n[COUNT.skinned]!++;
  };
  scene.onBeforeAnimationsObservable.add(() => void (CharacterAnimator.skinProbe = perfProbe.on ? skin : null), undefined, true);
  scene.onDisposeObservable.addOnce(() => void (CharacterAnimator.skinProbe = null));
  let anim = 0;
  let cull = 0;
  let skin0 = 0;
  let targets = 0;
  let post = 0;
  const on = () => perfProbe.on;
  scene.onBeforeAnimationsObservable.add(() => void (anim = on() ? performance.now() : 0), undefined, true);
  scene.onBeforeRenderObservable.add(() => {
    if (anim && on()) perfProbe.add(SYS.anim, anim);
    anim = 0;
  }, undefined, true);
  scene.onBeforeActiveMeshesEvaluationObservable.add(() => {
    cull = on() ? performance.now() : 0;
    skin0 = perfProbe.sys[SYS.skin]!;
  }, undefined, true);
  scene.onAfterActiveMeshesEvaluationObservable.add(() => {
    if (!cull || !on()) return;
    perfProbe.add(SYS.cull, cull);
    // Skinning ran inside: it is counted on its own.
    perfProbe.sys[SYS.cull]! -= perfProbe.sys[SYS.skin]! - skin0;
    cull = 0;
  }, undefined, true);
  scene.onBeforeRenderTargetsRenderObservable.add(() => void (targets = on() ? performance.now() : 0), undefined, true);
  scene.onAfterRenderTargetsRenderObservable.add(() => {
    if (targets && on()) perfProbe.add(SYS.shadow, targets);
    targets = 0;
  }, undefined, true);
  scene.onAfterDrawPhaseObservable.add(() => void (post = on() ? performance.now() : 0), undefined, true);
  scene.onAfterCameraRenderObservable.add(() => {
    if (post && on()) perfProbe.add(SYS.post, post);
    post = 0;
  }, undefined, true);
}

function solid(scene: Scene, name: string, hex: string): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = new Color3(0.1, 0.1, 0.1);
  return m;
}

function glow(scene: Scene, name: string, hex: string, strength = 1): StandardMaterial {
  const m = solid(scene, name, hex);
  m.emissiveColor = Color3.FromHexString(hex).scale(strength);
  return m;
}

/** See-through shards of a broken pane (one per tint, shared by every shard). */
function glassShardMaterial(scene: Scene, tint: string): StandardMaterial {
  const m = new StandardMaterial(`glassShardMat_${tint}`, scene);
  m.diffuseColor = Color3.FromHexString(tint);
  m.emissiveColor = Color3.FromHexString(tint).scale(0.15);
  m.specularColor = new Color3(1, 1, 1);
  m.specularPower = 200;
  m.alpha = 0.55;
  m.backFaceCulling = false;
  return m;
}
