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
import { createMountNode, mountGun } from './mountVisuals.ts';
import { createViewCamera, poseCamera } from './cameraPose.ts';
import { createCanopy, placeCanopy, releaseCanopy } from './canopyVisuals.ts';
import { BackdropVisuals } from '../backdrop.ts';
import { BorderVisuals } from '../borderVisuals.ts';
import { FoliageVisuals } from '../foliage.ts';
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
  gunplayOf,
  type MapDocument,
  type PickupEntity,
  type Vec3,
  type WeaponDefinition,
  type WorldBox,
  PROJECTILE_VISUALS,
  type ZoneSnapshot,
  FX_CLOAK,
  FX_JET,
  CHUTE_GLIDER,
  floatSurface,
  liquidAt,
  mapLiquids,
  type Liquid,
  type LiquidBox,
  type OBox,
  DEFAULT_BLOOD,
  EffectsWorld,
  mapTerrainMesh,
  type MapEntity,
  type Movers,
  MOUNT_WRECK_FADE_SECONDS,
  mountDamageState,
} from '@tiletrigger/shared';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Material } from '@babylonjs/core/Materials/material';
import { BloodVisuals, bloodPreference } from './bloodVisuals.ts';
import { PosedBody, RAGDOLL_PREWARM, Ragdoll, type DeadBody } from './ragdoll.ts';
import { fitBudget, tierFor, type RagdollTier } from './ragdollBudget.ts';
import { Atmosphere } from './atmosphere.ts';
import { ImpactVisuals } from './impactVisuals.ts';
import { ThrowArc } from './throwArc.ts';
import { createStarFlash, kickFlash } from './muzzleVisuals.ts';
import { MuzzleFlashRig, loadMuzzleFlashes, muzzleEffectFor } from './muzzleFlash.ts';
import { GodotVfx } from './godotVfx.ts';
import { buildPathMeshes } from '../pathMeshes.ts';

/** Seconds a physics debris chunk lies around before shrinking away. */
const DEBRIS_LIFE = 6;
const SHAKE_MS = 650;
import { MapStyler } from '../mapMeshes.ts';
import { buildRoadMeshes } from '../roadMeshes.ts';
import { ModelLibrary } from '../content/models.ts';
import { DROP_LIE_HEIGHT, PICKUP_HOVER, createPickupVisual } from './pickupVisuals.ts';
import { LIQUID_LOOKS, ScenarioVisuals } from './scenarioVisuals.ts';
import { createPropNode } from './propVisuals.ts';
import { CityVisuals } from './cityVisuals.ts';
import { SkyEffects } from './skyEffects.ts';
import { CharacterLibrary, type CharacterInstance } from '../content/characters.ts';
import { CharacterAnimator, type OneShot } from './characterAnimator.ts';
import { fitFirstPersonArms } from './firstPersonArms.ts';
import { FirstPersonBodyRig } from './firstPersonBody.ts';
import { loadFirstPersonMode, type FirstPersonMode } from './graphicsSettings.ts';
import { CreatureLibrary, type AvatarSpec } from '../content/creatures.ts';
import { CreatureAnimator } from './creatureAnimator.ts';
import type { RemotePose } from './interpolation.ts';

/** Remote players' pack muzzle flashes: within this range of the camera (m), on at most this many guns. */
const REMOTE_FLASH_RANGE = 45;
const MAX_REMOTE_RIGS = 8;
/** Your own pack flash: this much bigger than the weapon's scale, starting this far (m) past the muzzle so the gun doesn't hide it. */
const OWN_FLASH_SCALE = 1.6;
const OWN_FLASH_AHEAD = 0.05;
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
  /** Team-colour marker over a teammate's head (Team Deathmatch). */
  tag?: { mesh: AbstractMesh; color: string };
  last?: { x: number; y: number; z: number; t: number };
  vel: { x: number; z: number };
  /** Status-effect shell (burning, poisoned, frozen…), made on first need. */
  aura?: Mesh;
  jet?: Mesh;
  /** How see-through it is drawn now (Classes: a cloaked Shade); 1 = solid. */
  shown?: number;
  /** Parachute or glider over them, and which. */
  canopy?: { node: TransformNode; kind: number };
  /** The body after death (until the next spawn): a ragdoll (full or cheap) or laid down (ragdoll.ts, ragdollBudget.ts). */
  ragdoll?: DeadBody;
  /** A body that died without a ragdoll (a creature) falls to the ground under gravity. */
  fall?: { y: number; vy: number; ground: number };
  wasAlive?: boolean;
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
/** Ragdoll parts parked in the effects world's pool when the map is built (a standard body's, this many times). */
const RAGDOLL_PREWARM_BODIES = 12;
/**
 * Crowd animation LOD: with more than this many remote characters, ones in
 * view past ANIM_LOD_NEAR metres are animated (clips sampled, bones, aim and
 * grip) at 15 Hz and past ANIM_LOD_FAR at 10 Hz instead of every frame (their
 * meshes already drop to the low-detail copy past LOD_DISTANCE).
 */
const ANIM_LOD_CROWD = 24;
const ANIM_LOD_NEAR = 35;
const ANIM_LOD_FAR = 70;
/** Crowds: characters further than this (m) cast no shadow (a crowd's far shadows are a draw each for a few pixels). */
const CROWD_SHADOW_REACH = 30;
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
  private readonly pickups = new Map<string, PickupVisual>();
  /** Weapons the fallen dropped (snapshot `dw`), by drop ID: drawn lying where they fell. */
  private readonly drops = new Map<number, { root: TransformNode; item: string }>();
  private readonly projectiles = new Map<number, { node: TransformNode; look: number; born: number }>();
  /** Placed props by entity index (breakable ones disappear when broken). */
  private readonly props = new Map<number, TransformNode>();
  private effects: Fx[] = [];
  /** Binbun's hit and explosion effects (godotVfx.ts), once their packs are in. */
  private readonly vfx: GodotVfx;
  private sunLight?: DirectionalLight;
  private zoneVisuals!: ZoneVisuals;
  private readonly viewRoot: TransformNode;
  private readonly foliage: FoliageVisuals;
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

  constructor(engine: AbstractEngine) {
    this.scene = new Scene(engine);
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
    // Characters are built one per 16 ms (one a frame at 60 fps, more when frames are long): the host adding
    // a dozen bots, or a full match's first wave, built them all in one long frame, a stall on every computer.
    const turns: (() => void)[] = [];
    let lastTurn = performance.now();
    this.characters.turn = () => new Promise((go) => turns.push(go));
    this.scene.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      for (let n = Math.max(1, Math.floor((now - lastTurn) / 16)); n > 0 && turns.length; n--) turns.shift()!();
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
    void GodotVfx.preload('hit_fx', 'explosion_fx');
    this.flashRig = new MuzzleFlashRig(this.scene, 'muzzleFlashRig', { renderingGroupId: 1 });
    this.flashRig.root.parent = this.viewRoot;
    this.brass = new StandardMaterial('brassMat', this.scene);
    this.brass.diffuseColor = new Color3(0.78, 0.6, 0.22);
    this.brass.specularColor = new Color3(0.9, 0.8, 0.5);
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
    const styler = new MapStyler(this.scene);
    styler.build(doc, boxes);
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
    this.physics?.free();
    try {
      this.physics = new EffectsWorld(boxes, mapTerrainMesh(doc));
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
    doc.entities.forEach((e, i) => {
      if (e.kind === 'prop') this.props.set(i, createPropNode(this.scene, this.models, e, `prop_${e.id}`, !carried.has(e.id), true, doc.terrain));
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
    void GodotVfx.preload('hit_fx', 'explosion_fx').then(() => {
      if (this.scene.isDisposed) return;
      for (const [pack, effect] of [['hit_fx', 'vfx_hit_01'], ['hit_fx', 'vfx_hit_02'], ['hit_fx', 'vfx_big_impact_01'], ['explosion_fx', 'vfx_ground_explosion_01']] as const) this.vfx.warm(pack, effect);
    });
  }

  /** Cliffs, city blocks, fence, forest or shore along the boundary (built with the map). */
  border: BorderVisuals | null = null;
  /** Client-only physics for ragdolls, debris and blood (built with the map). */
  private physics: EffectsWorld | null = null;
  readonly blood: BloodVisuals;
  /** How hard each recently hit player was pushed (shots and blasts), for the ragdoll's throw. */
  private readonly pushes = new Map<number, { v: Vec3; t: number }>();
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
    this.pushes.set(slot, { v: { x: sum.x * k, y: Math.min(sum.y, max * 0.9), z: sum.z * k }, t: now });
    const anim = this.avatars.get(slot)?.anim;
    if (anim instanceof CreatureAnimator) anim.flinch();
  }

  /**
   * A round or blow landed on a player: their body flinches at the part hit
   * (head, torso, legs), harder for heavier hits, and a heavy hit plays the
   * hit reaction on the upper body (characterAnimator flinch).
   */
  flinchPlayer(slot: number, dir: Vec3, zone: number, strength: number): void {
    const anim = this.avatars.get(slot)?.anim;
    if (!(anim instanceof CharacterAnimator)) return;
    const k = Math.min(1, strength / 2);
    anim.flinch(zone, dir, 0.35 + 0.65 * k);
    if (strength >= 1.6) anim.trigger(zone === 1 ? 'hit_head' : 'hit');
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
    const fresh = push && performance.now() - push.t < 600 ? push.v : { x: 0, y: 0, z: 0 };
    const v = { x: a.vel.x * 0.6 + fresh.x, y: 0.5 + fresh.y, z: a.vel.z * 0.6 + fresh.z };
    const p = a.root.position;
    const cam = this.scene.activeCamera?.globalPosition;
    const dist = cam ? Math.hypot(p.x - cam.x, p.y - cam.y, p.z - cam.z) : 0;
    const view = planes ?? (this.scene.activeCamera ? Frustum.GetPlanes(this.scene.activeCamera.getTransformationMatrix()) : null);
    const seen = !view || inView(view, p.x, p.y + 0.9, p.z, CULL_RADIUS);
    const moving = this.movingRagdolls();
    const fit = fitBudget(tierFor(dist, seen), dist, moving.map((m) => ({ tier: m.body.tier, dist: m.dist })));
    for (const i of fit.drop) this.dropTier(moving[i]!.a);
    this.ragdollTiers[fit.tier]++;
    this.lastDeath = { slot, tier: fit.tier, dist: Math.round(dist * 10) / 10, seen };
    try {
      if (fit.tier === 'posed') this.layDown(a, v);
      else {
        a.anim.ragdoll(fit.tier === 'cheap' ? 'limp' : 'stop');
        a.ragdoll = new Ragdoll(this.physics, a.anim.ch.joints, root, v, fit.tier);
      }
    } catch {
      a.ragdoll = undefined;
    }
  }

  /** The last death's tier, distance from the camera and whether it was in view (tests). */
  lastDeath: { slot: number; tier: RagdollTier; dist: number; seen: boolean } | null = null;

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
    a.ragdoll = new Ragdoll(this.physics, a.anim.ch.joints, root, v, 'cheap');
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
    a.tag?.mesh.dispose(false, !a.tag.mesh.isAnInstance);
    a.tag = undefined;
    a.aura?.setEnabled(false);
    a.jet?.setEnabled(false);
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
    const body = this.physics?.raycastRagdoll(o.eye, dir, len);
    if (body) {
      const at = { x: o.eye.x + dir.x * body.dist, y: o.eye.y + dir.y * body.dist, z: o.eye.z + dir.z * body.dist };
      body.body.applyImpulseAtPoint({ x: dir.x * 4 * o.strength, y: dir.y * 4 * o.strength + 0.4, z: dir.z * 4 * o.strength }, at, true);
      this.blood.hit(at, dir, o.strength);
    }
    if (o.victim !== null) {
      this.blood.hit(o.to, dir, o.zone === 1 ? o.strength * 1.8 : o.strength);
      return;
    }
    // A round stopped by a pane (bulletproof glass, a pane about to break): a star crack and a few glints, no dust.
    const pane = this.scenario.glass.strike(o.eye, o.to);
    if (pane) {
      this.impacts.sparkBurst(pane.point, 3, 1.2);
      return;
    }
    const wall = this.impacts.surfaceHit(o.eye, o.to);
    if (wall) this.impacts.wallImpact(wall.point, wall.normal, Math.min(1.6, 0.7 + o.strength * 0.4));
  }

  /** A stylised hit from Binbun's Hit FX (godotVfx.ts): `melee` on a body, `heavy` where a railgun round lands. False before the pack is in. */
  hitFx(at: Vec3, kind: 'melee' | 'heavy'): boolean {
    const p = new Vector3(at.x, at.y, at.z);
    return kind === 'melee' ? this.vfx.play('hit_fx', Math.random() < 0.5 ? 'vfx_hit_01' : 'vfx_hit_02', p, { scale: 0.22 }) : this.vfx.play('hit_fx', 'vfx_big_impact_01', p, { scale: 0.4 });
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
    for (const a of this.avatars.values()) if (a.fall && !a.ragdoll) this.stepFall(a, dt);
    for (const c of this.corpses) if (c.a.fall && !c.a.ragdoll) this.stepFall(c.a, dt);
    if (this.physics) {
      this.physics.step(dt);
      // A body that stops (it rested, or its time ran out) keeps its pose as it is, at no cost per frame.
      const settle = (a: Avatar) => {
        if (a.ragdoll && !a.ragdoll.frozen && a.ragdoll.update() && a.anim instanceof CharacterAnimator) a.anim.freezePose();
      };
      for (const a of this.avatars.values()) settle(a);
      this.corpses = this.corpses.filter((c) => {
        settle(c.a);
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
    this.blood.update(wall);
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
    this.foliage.update(this.camera.position);
    this.updateUnderwater();
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
      node.setEnabled(false);
      if (load === this.viewLoad) show(v);
    });
  }

  /**
   * Show your own character's arms in first person, holding the viewmodel.
   * The arms hang from the camera at shoulder height; the gun keeps its
   * viewmodel placement (bob, recoil, reload dip) and the hands follow it by IK.
   */
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
  updateAvatars(poses: readonly RemotePose[], localSlot: number, spec: (slot: number) => AvatarSpec, celebrate = false, allyColor: (slot: number) => string | null = () => null, seated: ReadonlySet<number> = new Set(), sitting: ReadonlyMap<number, { yaw: number; legDrop: number }> = new Map()): void {
    const now = performance.now();
    const crowd = poses.length > ANIM_LOD_CROWD;
    this.crowd = crowd;
    const cam = crowd ? this.scene.activeCamera?.globalPosition : undefined;
    const planes = crowd && this.scene.activeCamera ? Frustum.GetPlanes(this.scene.activeCamera.getTransformationMatrix()) : null;
    const seen = new Set<number>();
    let deathMs = 0;
    let deathsStarted = 0;
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
        // Full-body first person (not in a seat: the vehicle's view keeps the arms): your own character, seen
        // from its eyes, holding the gun.
        if (this.fpMode === 'body' && !seated.has(p.slot) && a.anim instanceof CharacterAnimator) {
          this.showFpBody(a, p, now);
          continue;
        }
        if (this.fpBody) this.dropFpBody();
        // Arms only, or before your character has loaded.
        if (this.fpMode === 'arms' || seated.has(p.slot)) this.buildFpArms();
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
      if (a.wasAlive && !p.alive && a.anim && this.physics && !a.ragdoll) {
        // A blast that kills twenty doesn't start twenty bodies in one frame: past a few milliseconds of
        // starting them, the rest hold their pose a frame or two and start on the next ones.
        if (deathsStarted > 0 && deathMs > DEATH_START_MS) continue;
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
        // Far characters in a crowd animate every few frames, with the time saved up (a death always plays at once).
        const far = crowd && cam && p.alive ? Math.hypot(p.x - cam.x, p.z - cam.z) : 0;
        // Crowds: far characters cast no shadow.
        if (crowd && far > CROWD_SHADOW_REACH) this.atmosphere.shadowless.add(a.root);
        else this.atmosphere.shadowless.delete(a.root);
        a.animDt = (a.animDt ?? 0) + dt;
        let run: boolean;
        let stepped: boolean;
        if (a.anim instanceof CharacterAnimator && !a.culled) {
          // Characters in view: past ANIM_LOD_NEAR their clips, bones and aim are evaluated at 15 Hz, past
          // ANIM_LOD_FAR at 10 Hz (on each one's own phase), and the state machine runs with them.
          const stepMs = far > ANIM_LOD_FAR ? 100 : far > ANIM_LOD_NEAR ? 1000 / 15 : 0;
          run = a.anim.stepAt(now, stepMs, (p.slot * 37) % 100);
          stepped = stepMs > 0;
        } else {
          // Out of view (asleep) characters, and creatures: the state machine every few frames.
          const every = a.culled ? 8 : far > ANIM_LOD_FAR ? 4 : far > ANIM_LOD_NEAR ? 2 : 1;
          if (a.anim instanceof CharacterAnimator) a.anim.stepAt(now, 0);
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
          celebrate: (celebrate || !!p.emote) && p.alive,
          stance: p.stance ?? 0,
          sprinting: !!p.sprinting,
          ...(sit ? { seated: true, legDrop: sit.legDrop, seatFacing: angleDelta(p.yaw, sit.yaw) } : {}),
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
      this.setTag(a, cloaked && enemy ? null : tag);
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
  }

  /** Play an upper-body action on a remote avatar (shooting, melee). */
  avatarAction(slot: number, action: OneShot): void {
    this.avatars.get(slot)?.anim?.trigger(action);
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
    anim.stepAt(now, 0);
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
    // Crowds: everyone's copy of a gun is a GPU instance of one mesh (one draw per gun model and part, not per player).
    void this.models.instantiate(def.view.model, `held_${slot}`, this.crowd).then((node) => {
      if (a.weaponSlot !== slot || a.root.isDisposed()) return node.dispose();
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
          // A player in a creature skin is drawn no bigger than the player's own hitbox (big aliens shrink to fit).
          const { min, max } = ch.root.getHierarchyBoundingVectors(true);
          const tall = max.y - min.y;
          if (tall > PLAYER.height * 1.1) ch.root.scaling.scaleInPlace((PLAYER.height * 1.1) / tall);
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
      a.tag.mesh.dispose(false, !a.tag.mesh.isAnInstance);
      a.tag = undefined;
    }
    if (!color || a.tag) return;
    // Crowds: every marker of a colour is a GPU instance of one disc (one draw per colour, not per player).
    const mesh = this.crowd ? this.tagSource(color).createInstance(`${a.root.name}_tag`) : this.tagDisc(`${a.root.name}_tag`, color);
    mesh.billboardMode = MeshClass.BILLBOARDMODE_ALL;
    mesh.parent = a.root;
    mesh.position.y = PLAYER.height + 0.35;
    mesh.isPickable = false;
    a.tag = { mesh, color };
  }

  /** A marker disc in a team colour. Allies: a diamond; enemies (red by default): a downward triangle, so the two read apart at a glance. */
  private tagDisc(name: string, color: string): Mesh {
    const enemy = color.toLowerCase() === '#ff3b3b';
    const mesh = CreateDisc(name, { radius: enemy ? 0.13 : 0.11, tessellation: enemy ? 3 : 4 }, this.scene);
    if (enemy) mesh.rotation.z = -Math.PI / 2;
    const mat = new StandardMaterial(`${name}mat`, this.scene);
    mat.emissiveColor = Color3.FromHexString(color);
    mat.disableLighting = true;
    mesh.material = mat;
    return mesh;
  }

  private readonly tagSources = new Map<string, Mesh>();

  /** The shared disc a colour's crowd markers are instances of (parked out of sight; only its instances draw). */
  private tagSource(color: string): Mesh {
    let src = this.tagSources.get(color);
    if (!src) {
      src = this.tagDisc(`tag_${color}`, color);
      src.isPickable = false;
      src.position.y = -10000;
      src.freezeWorldMatrix();
      this.tagSources.set(color, src);
    }
    return src;
  }

  private disposeAvatar(a: Avatar): void {
    if (this.fpBody?.a === a) this.dropFpBody();
    this.atmosphere.shadowless.delete(a.root);
    // The flash texture is shared by every flash: dispose the material, never the texture.
    a.flash?.material?.dispose();
    a.flash?.dispose();
    if (a.flashRig) {
      a.flashRig.dispose();
      this.remoteRigs--;
    }
    a.ragdoll?.dispose();
    a.anim?.dispose();
    a.weaponNode?.dispose();
    this.dropCanopy(a);
    a.root.dispose(false, true);
  }

  // ---------------------------------------------------------------- pickups

  private addPickup(e: PickupEntity, item = e.item): void {
    const root = createPickupVisual(this.scene, this.models, item, `pickup_${e.id}`, true);
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
        p.root = createPickupVisual(this.scene, this.models, want, `pickup_${id}`, true);
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
      if (look && ARSENAL_LOOKS.has(look)) animateArsenalProjectile(p.node, look, now, p.node.position.subtract(prev), p.born);
      else if (look === 'grenade' || look === 'frag') p.node.rotation.x += 0.3;
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
    if (ARSENAL_LOOKS.has(look)) return createArsenalProjectile(this.scene, id, look);
    const node = new TransformNode(`proj_${id}`, this.scene);
    const model = look === 'grenade' ? 'projectiles/grenade.glb' : look === 'frag' ? 'guns/frag.glb' : null;
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

  explosion(at: Vec3, radius: number): void {
    // Binbun's ground explosion (godotVfx.ts), sized to the blast; the plain fireball until its pack is in.
    if (this.vfx.play('explosion_fx', 'vfx_ground_explosion_01', new Vector3(at.x, at.y - 0.3, at.z), { scale: Math.max(0.5, radius / 2.6) })) return;
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
    this.vfx.play('explosion_fx', 'vfx_ground_explosion_01', new Vector3(at.x, at.y - 0.3, at.z), { scale: Math.max(0.8, radius / 2) });
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
      if (m.def.kind !== 'vehicle') {
        const gun = mountGun(node);
        if (gun) gun.rotation.y = m.shown.aimYaw - m.shown.yaw;
      }
    }
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
    if ((this.mountFxAt.get(m.index) ?? 0) > now) return;
    const state = m.wreck ? 'wreck' : m.alive ? mountDamageState(m.health / 100, m.burning) : 'gone';
    if (state === 'intact' || state === 'gone') return;
    const [hx, hy, hz] = m.def.half;
    const p = m.shown.pos;
    const spot = (spread: number) => ({ x: p.x + (Math.random() - 0.5) * hx * spread, y: p.y + hy * 2 - 0.1, z: p.z + (Math.random() - 0.5) * hz * spread });
    const size = Math.max(0.8, Math.min(2, (hx + hz) * 0.5));
    if (state === 'smoking') {
      this.impacts.puff(spot(0.8), '#8c8884', size * 0.8, 1.8, 1.6);
      this.mountFxAt.set(m.index, now + 240);
    } else if (state === 'heavy') {
      this.impacts.puff(spot(0.9), '#2a2725', size * 1.2, 2.2, 2);
      if (Math.random() < 0.3) this.impacts.sparkBurst(spot(1.4), 6, 2.5);
      this.mountFxAt.set(m.index, now + 120);
    } else if (state === 'burning') {
      this.impacts.puff(spot(1.1), '#ff7a1a', size * 0.7, 0.45, 1.8, true);
      this.impacts.puff(spot(0.8), Math.random() < 0.5 ? '#ffb347' : '#e8541c', size * 0.5, 0.35, 2.2, true);
      this.impacts.puff(spot(0.9), '#151312', size * 1.5, 2.6, 2.4);
      if (Math.random() < 0.35) this.impacts.sparkBurst(spot(1.2), 8, 3);
      this.mountFxAt.set(m.index, now + 70);
    } else {
      // The wreck: a column of black smoke and the last licks of flame.
      this.impacts.puff(spot(0.7), '#151312', size * 1.4, 3.2, 2.2);
      if (Math.random() < 0.4) this.impacts.puff(spot(1), '#ff6a14', size * 0.4, 0.4, 1.2, true);
      this.mountFxAt.set(m.index, now + 160);
    }
  }

  /** Per vehicle: drawn tilt, landing bounce and the last pose (to read speed, acceleration and turning). */
  private suspension = new Map<number, { pitch: number; roll: number; bounce: number; bounceVel: number; pos: Vec3; yaw: number; speed: number; t: number; air: boolean }>();

  /**
   * Visual suspension: the body settles to the slope under its wheels (or
   * pads), squats when it accelerates and dives when it brakes, leans out of
   * turns, and bounces on its springs when it lands. Drawing only; the
   * simulation's collision box stays level.
   */
  private suspend(m: ClientMount, node: TransformNode): void {
    const now = performance.now();
    const p = m.shown.pos;
    let st = this.suspension.get(m.index);
    if (!st) this.suspension.set(m.index, (st = { pitch: 0, roll: 0, bounce: 0, bounceVel: 0, pos: { ...p }, yaw: m.shown.yaw, speed: 0, t: now, air: false }));
    const dt = Math.min(0.1, Math.max(0.001, (now - st.t) / 1000));
    const fwd = { x: Math.sin(m.shown.yaw), z: Math.cos(m.shown.yaw) };
    const speed = ((p.x - st.pos.x) * fwd.x + (p.z - st.pos.z) * fwd.z) / dt;
    const accel = (speed - st.speed) / dt;
    const yawRate = Math.atan2(Math.sin(m.shown.yaw - st.yaw), Math.cos(m.shown.yaw - st.yaw)) / dt;
    const fell = (st.pos.y - p.y) / dt;
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
  }

  /** Ground hazards and fields from the latest snapshot. */
  updateZones(zones: readonly ZoneSnapshot[] | undefined, now: number): void {
    this.zoneVisuals.apply(zones, now);
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

  /** Chain lightning through the points it jumped. */
  addArc(pts: readonly Vec3[], color = '#9fd8ff'): void {
    this.effects.push({ mesh: createArc(this.scene, pts, color), born: performance.now(), ttl: 140 });
    this.effects.push({ mesh: createArc(this.scene, pts, '#ffffff'), born: performance.now(), ttl: 70 });
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
    this.atmosphere.dispose();
    this.blood.dispose();
    this.impacts.dispose();
    this.scene.dispose();
    this.physics?.free();
    this.physics = null;
  }
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
