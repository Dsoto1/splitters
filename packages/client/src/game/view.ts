import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { createMountNode, mountGun } from './mountVisuals.ts';
import { createCanopy, placeCanopy } from './canopyVisuals.ts';
import { BackdropVisuals } from '../backdrop.ts';
import { FoliageVisuals } from '../foliage.ts';
import type { ClientMount } from './mountState.ts';
import { ARSENAL_LOOKS, ZoneVisuals, animateArsenalProjectile, createArc, createArsenalProjectile, createAura, createBeam, setAura } from './arsenalVisuals.ts';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
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
  type MapDocument,
  type PickupEntity,
  type Vec3,
  type WeaponDefinition,
  type WorldBox,
  PROJECTILE_VISUALS,
  type ZoneSnapshot,
  FX_JET,
  CHUTE_GLIDER,
  liquidAt,
  mapLiquids,
  type Liquid,
  type LiquidBox,
  DEFAULT_BLOOD,
  EffectsWorld,
  mapTerrainMesh,
  type MapEntity,
} from '@tiletrigger/shared';
import { BloodVisuals, bloodPreference } from './bloodVisuals.ts';
import { Ragdoll } from './ragdoll.ts';
import { Atmosphere } from './atmosphere.ts';
import { ImpactVisuals } from './impactVisuals.ts';
import { ThrowArc } from './throwArc.ts';
import { createStarFlash, kickFlash } from './muzzleVisuals.ts';

/** Seconds a physics debris chunk lies around before shrinking away. */
const DEBRIS_LIFE = 6;
import { MapStyler } from '../mapMeshes.ts';
import { ModelLibrary } from '../content/models.ts';
import { PICKUP_HOVER, createPickupVisual } from './pickupVisuals.ts';
import { LIQUID_LOOKS, ScenarioVisuals } from './scenarioVisuals.ts';
import { createPropNode } from './propVisuals.ts';
import { CityVisuals } from './cityVisuals.ts';
import { SkyEffects } from './skyEffects.ts';
import { CharacterLibrary, type CharacterInstance } from '../content/characters.ts';
import { CharacterAnimator, type OneShot } from './characterAnimator.ts';
import { CreatureLibrary, type AvatarSpec } from '../content/creatures.ts';
import { CreatureAnimator } from './creatureAnimator.ts';
import type { RemotePose } from './interpolation.ts';

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
  tag?: { mesh: Mesh; color: string };
  last?: { x: number; y: number; z: number; t: number };
  vel: { x: number; z: number };
  /** Status-effect shell (burning, poisoned, frozen…), made on first need. */
  aura?: Mesh;
  jet?: Mesh;
  /** Parachute or glider over them, and which. */
  canopy?: { node: TransformNode; kind: number };
  /** Physics body after death (until the next spawn). */
  ragdoll?: Ragdoll;
  wasAlive?: boolean;
  /** The held weapon and its muzzle in the weapon's own space (for tracers and flashes). */
  muzzle?: { node: TransformNode; local: Vector3 };
  /** Muzzle flash shown until this time. */
  flashUntil?: number;
  flash?: Mesh;
  /** Climbing out of a hatch or burrow: rises from below the floor from this time. */
  emergeAt?: number;
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
  private readonly pickups = new Map<string, PickupVisual>();
  private readonly projectiles = new Map<number, { node: TransformNode; look: number; born: number }>();
  /** Placed props by entity index (breakable ones disappear when broken). */
  private readonly props = new Map<number, TransformNode>();
  private effects: Fx[] = [];
  private zoneVisuals!: ZoneVisuals;
  private readonly viewRoot: TransformNode;
  private readonly foliage: FoliageVisuals;
  private viewmodel?: TransformNode;
  private viewWeapon?: string;
  /** Your own character's arms in first person, gripping the viewmodel. */
  private fpArms?: { look: string; anim: CharacterAnimator | null; root: TransformNode };
  private viewLoad = 0;
  /** Front of the loaded viewmodel along its forward axis, for the muzzle flash. */
  private muzzleZ = 0.2;
  private kickAmount = 0;
  private bobPhase = 0;
  private readonly flash: Mesh;
  private flashUntil = 0;
  /** The ambient light, briefly brightened by your own shots (a real point light costs every pixel). */
  private hemi?: HemisphericLight;
  /** Shadows, tone mapping and post effects (Options → Graphics). */
  readonly atmosphere: Atmosphere;
  private hemiBase = 0.8;
  private hemiLit = false;
  private readonly brass: StandardMaterial;

  constructor(engine: AbstractEngine) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.52, 0.62, 0.72, 1);
    this.scene.skipPointerMovePicking = true;
    this.camera = new FreeCamera('camera', new Vector3(0, 10, -10), this.scene);
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
    this.characters = new CharacterLibrary(this.scene);
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
    this.brass = new StandardMaterial('brassMat', this.scene);
    this.brass.diffuseColor = new Color3(0.78, 0.6, 0.22);
    this.brass.specularColor = new Color3(0.9, 0.8, 0.5);
  }

  buildMap(doc: MapDocument, boxes: readonly WorldBox[]): void {
    const styler = new MapStyler(this.scene);
    styler.build(doc, boxes);
    const backdropVisuals = new BackdropVisuals(this.scene, styler, this.models);
    const backdrop = backdropVisuals.build(doc, boxes);
    if (backdropVisuals.sky) this.skyEffects.apply(doc, backdrop, backdropVisuals.sky);
    this.city.setMap(doc);
    this.liquids = mapLiquids(doc.entities);
    this.physics?.free();
    try {
      this.physics = new EffectsWorld(boxes, mapTerrainMesh(doc));
    } catch {
      this.physics = null;
    }
    const blood = doc.blood ?? DEFAULT_BLOOD;
    this.blood.setLook(blood.color, blood.amount);
    this.scenario.surface = (m, t) => styler.surfaceMaterial(doc, m, t);
    void this.foliage.grow(doc.terrain, boxes, doc.metadata.id);
    for (const e of doc.entities) if (e.kind === 'pickup') this.addPickup(e);
    doc.entities.forEach((e, i) => {
      if (e.kind === 'prop') this.props.set(i, createPropNode(this.scene, this.models, e, `prop_${e.id}`, true, true, doc.terrain));
    });
    this.scenario.build(doc.entities);
    this.entrances = doc.entities.filter((e): e is Extract<MapEntity, { kind: 'encounter' }> => e.kind === 'encounter' && (e.entrance ?? 'none') !== 'none');
    // Warm the model cache so first switches and pickups don't hitch.
    for (const w of WEAPONS_BY_SLOT) void this.models.load(w.view.model);
    void this.models.load('projectiles/grenade.glb');
  }

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
    this.pushes.set(slot, { v: { x: sum.x * k, y: Math.min(sum.y, max * 0.6), z: sum.z * k }, t: now });
    const anim = this.avatars.get(slot)?.anim;
    if (anim instanceof CreatureAnimator) anim.flinch();
  }

  cameraPosition(): Vec3 {
    const p = this.camera.position;
    return { x: p.x, y: p.y, z: p.z };
  }

  /** A blast throws anyone near it (so the ones it kills fly away from it). */
  blast(at: Vec3, radius: number): void {
    for (const [slot, a] of this.avatars) {
      const d = { x: a.root.position.x - at.x, y: a.root.position.y + 1 - at.y, z: a.root.position.z - at.z };
      const dist = Math.hypot(d.x, d.y, d.z);
      if (dist > radius * 1.5) continue;
      const k = (8 * (1 - dist / (radius * 1.5))) / Math.max(0.3, dist);
      this.pushPlayer(slot, { x: d.x * k, y: 4 + Math.max(0, d.y) * k, z: d.z * k }, 8);
    }
  }

  /** Where a player's chest is drawn (for blood on kills). */
  chestOf(slot: number): Vec3 | null {
    const a = this.avatars.get(slot);
    if (!a) return null;
    return { x: a.root.position.x, y: a.root.position.y + 1.1, z: a.root.position.z };
  }

  private startRagdoll(slot: number, a: Avatar): void {
    const root = a.anim?.skeletonRoot;
    if (!(a.anim instanceof CharacterAnimator) || !root || !this.physics) return;
    const push = this.pushes.get(slot);
    const fresh = push && performance.now() - push.t < 600 ? push.v : { x: 0, y: 0, z: 0 };
    const v = { x: a.vel.x * 0.6 + fresh.x, y: 0.5 + fresh.y, z: a.vel.z * 0.6 + fresh.z };
    try {
      a.anim.ragdoll();
      a.ragdoll = new Ragdoll(this.physics, a.anim.ch.joints, root, v);
    } catch {
      a.ragdoll = undefined;
    }
  }

  /** The fallen body becomes a corpse that outlives the player's respawn. */
  private toCorpse(slot: number, a: Avatar): void {
    this.avatars.delete(slot);
    this.lyingDead.add(slot);
    a.tag?.mesh.dispose(false, true);
    a.tag = undefined;
    a.aura?.setEnabled(false);
    a.jet?.setEnabled(false);
    this.dropCanopy(a);
    a.flash?.setEnabled(false);
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
    const p = Vector3.TransformCoordinates(new Vector3(0, 0.02, this.muzzleZ + 0.02), this.viewRoot.getWorldMatrix());
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
  shotVisual(o: { eye: Vec3; muzzle: Vec3 | null; to: Vec3; color: string; victim: number | null; zone: number; strength: number; def?: WeaponDefinition; local?: boolean }): void {
    if (o.def?.view.beam) {
      this.addShot(o.def, o.muzzle ?? o.eye, o.to, o.color);
      this.landRound(o);
      return;
    }
    this.impacts.fire(o.muzzle ?? { x: o.eye.x, y: o.eye.y - 0.1, z: o.eye.z }, o.to, o.color, () => this.landRound(o), o.local ? 1.5 : 0);
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
    const wall = this.impacts.surfaceHit(o.eye, o.to);
    if (wall) this.impacts.wallImpact(wall.point, wall.normal, Math.min(1.6, 0.7 + o.strength * 0.4));
  }

  /** A brief muzzle flash on a remote player's gun. */
  remoteFlash(slot: number): void {
    const a = this.avatars.get(slot);
    if (!a?.muzzle) return;
    a.flash ??= this.createFlash(a.root.name);
    a.flashUntil = performance.now() + 55;
    kickFlash(a.flash, 1);
  }

  private createFlash(name: string): Mesh {
    return createStarFlash(this.scene, `${name}_flash`, 0.55);
  }

  /** Step the effects physics and everything riding on it. */
  private updateEffects(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.impacts.update(dt);
    // Remote muzzle flashes follow the guns.
    for (const a of this.avatars.values()) {
      if (!a.flash) continue;
      const on = now < (a.flashUntil ?? 0) && !!a.muzzle;
      a.flash.setEnabled(on);
      if (on && a.muzzle) {
        a.muzzle.node.computeWorldMatrix(true);
        a.flash.position.copyFrom(Vector3.TransformCoordinates(a.muzzle.local, a.muzzle.node.getWorldMatrix()));
      }
    }
    if (this.physics) {
      this.physics.step(dt);
      for (const a of this.avatars.values()) a.ragdoll?.update();
      this.corpses = this.corpses.filter((c) => {
        if (!c.a.ragdoll?.resting) c.a.ragdoll?.update();
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
    this.blood.update(dt);
  }

  private dropCanopy(a: Avatar): void {
    a.canopy?.node.dispose(false, true);
    a.canopy = undefined;
  }

  private localCanopy?: { node: TransformNode; kind: number };

  /** Your own canopy in first person (overhead, where looking up shows it); null packs it away. */
  updateLocalCanopy(pos: Vec3 | null, yaw: number, kind: number): void {
    if (this.localCanopy && (this.localCanopy.kind !== kind || !pos)) {
      this.localCanopy.node.dispose(false, true);
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

  setCamera(eye: Vec3, yaw: number, pitch: number, fov: number): void {
    this.camera.position.set(eye.x, eye.y, eye.z);
    // Babylon: rotation.y is yaw (0 = +Z), positive rotation.x looks down.
    this.camera.rotation.set(-pitch, yaw, 0);
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
    this.viewmodel?.dispose();
    this.viewmodel = undefined;
    if (!def) return;
    void this.models.instantiate(def.view.model, `view_${def.id}`).then((node) => {
      if (load !== this.viewLoad) return node.dispose();
      // Measure before parenting, in the model's own space.
      const bounds = node.getHierarchyBoundingVectors(true);
      this.muzzleZ = bounds.max.z;
      this.sightTop = bounds.max.y;
      this.stockZ = bounds.min.z;
      node.parent = this.viewRoot;
      // Draw on top of the world so the gun never clips into walls.
      for (const m of node.getChildMeshes()) m.renderingGroupId = 1;
      this.viewmodel = node;
      this.fpArms?.anim?.gripExternal(node, def.view.hold);
    });
  }

  /**
   * Show your own character's arms in first person, holding the viewmodel.
   * The arms hang from the camera at shoulder height; the gun keeps its
   * viewmodel placement (bob, recoil, reload dip) and the hands follow it by IK.
   */
  setLocalLook(look: string | undefined): void {
    if (!look || this.fpArms?.look === look) return;
    this.fpArms?.anim?.dispose();
    this.fpArms?.root.dispose();
    const root = new TransformNode('fpArms', this.scene);
    root.parent = this.camera;
    const arms = { look, anim: null as CharacterAnimator | null, root };
    this.fpArms = arms;
    void this.characters.create({ look: armsLookFor(look), armsOnly: true }, 'fpArmsChar').then((ch) => {
      if (this.fpArms !== arms) return ch.dispose();
      // Same size as the full character (fitted to the player height: the head joint sits
      // about 0.2 m below the top of the head), placed so the eyes are at the camera.
      const head = ch.joints.get('Head');
      head?.computeWorldMatrix(true);
      const headY = head ? head.getAbsolutePosition().y : PLAYER.eyeHeight;
      const scale = PLAYER.height / (headY + 0.2);
      ch.root.parent = root;
      ch.root.scaling.setAll(scale);
      // A little forward of the eyes, so the support hand reaches long guns (the shoulders are never in view).
      ch.root.position.set(0, -(headY + 0.07) * scale, 0.2);
      for (const m of ch.meshes) {
        m.renderingGroupId = 1;
        m.receiveShadows = false;
      }
      arms.anim = new CharacterAnimator(this.scene, ch);
      if (this.viewmodel && this.viewWeapon) arms.anim.gripExternal(this.viewmodel, getWeapon(this.viewWeapon).view.hold);
    });
  }

  /** Recoil kick and muzzle flash for a predicted shot. */
  kick(def: WeaponDefinition): void {
    const rail = def.id === 'core.railgun';
    this.kickAmount = Math.min(1, this.kickAmount + (def.kind === 'melee' ? 0.9 : rail || def.pellets > 1 || def.projectile ? 1 : 0.45));
    if (rail) {
      // The rail slams back with a big blue-white flash.
      this.flashUntil = performance.now() + 80;
      kickFlash(this.flash, 2);
      return;
    }
    if (def.kind === 'melee' || def.view.beam) return;
    this.flashUntil = performance.now() + 45;
    kickFlash(this.flash, def.pellets > 1 || def.damage >= 60 ? 1.5 : def.damage < 15 ? 0.7 : 1);
    if (def.kind === 'hitscan' && def.ammo) this.ejectCasing(def.pellets > 1 ? 1.6 : def.damage >= 60 ? 1.4 : 1);
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
  updateViewmodel(dt: number, o: { moving: boolean; raise: number; reload: number; hidden: boolean; ads?: number }): void {
    const def = this.viewWeapon ? getWeapon(this.viewWeapon) : undefined;
    this.viewRoot.setEnabled(!o.hidden && !!def);
    this.fpArms?.root.setEnabled(!o.hidden && !!def);
    if (def && this.fpArms?.anim) this.fpArms.anim.update(dt, { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0, celebrate: false });
    if (!def) return;
    this.kickAmount = Math.max(0, this.kickAmount - dt * 6);
    if (o.moving) this.bobPhase += dt * 9;
    const ads = o.ads ?? 0;
    const bob = (o.moving ? 1 : 0) * (1 - ads * 0.8);
    const [vx, vy, vz] = def.view.viewOffset;
    // Aiming down the sights: the gun comes to the centre with the top of the receiver (where
    // the sight sits) just under the eye line, and far enough forward that the stock stays
    // out of view, so you look along the gun at the target (see the red dot on the HUD).
    const adsY = -(this.sightTop + 0.006);
    const adsZ = Math.max(vz, 0.2 - this.stockZ);
    const x = vx * (1 - ads);
    const y = vy + (adsY - vy) * ads;
    const z = vz + (adsZ - vz) * ads;
    const melee = def.kind === 'melee';
    this.viewRoot.position.set(
      x + Math.sin(this.bobPhase) * 0.012 * bob,
      y + Math.abs(Math.cos(this.bobPhase)) * 0.01 * bob - o.raise * 0.25 - o.reload * 0.08,
      z - this.kickAmount * (melee ? -0.25 : 0.06) * (1 - ads * 0.5),
    );
    this.viewRoot.rotation.set(-this.kickAmount * (melee ? -0.6 : 0.12) + o.reload * 0.6, melee ? this.kickAmount * 0.5 : 0, o.reload * 0.4);
    const flashing = performance.now() < this.flashUntil;
    this.flash.setEnabled(flashing);
    // The map may set its own light level, so the base is whatever it is between shots.
    if (this.hemi && !this.hemiLit) this.hemiBase = this.hemi.intensity;
    if (this.hemi) this.hemi.intensity = this.hemiBase * (flashing ? 1.18 : 1);
    this.hemiLit = flashing;
    if (flashing) {
      this.flash.parent = this.viewRoot;
      this.flash.position.set(0, 0.02, this.muzzleZ + 0.08);
    }
  }

  // ---------------------------------------------------------------- avatars

  /**
   * Update remote player and NPC avatars from interpolated poses. Each one is
   * a capsule until its character model has loaded, then an animated character.
   */
  updateAvatars(poses: readonly RemotePose[], localSlot: number, spec: (slot: number) => AvatarSpec, celebrate = false, allyColor: (slot: number) => string | null = () => null, seated: ReadonlySet<number> = new Set()): void {
    const now = performance.now();
    const seen = new Set<number>();
    for (const p of poses) {
      if (p.slot === localSlot) continue;
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
      // A creature plays its own death and is left lying where it fell (no ragdoll).
      if (a.wasAlive && !p.alive && a.anim instanceof CreatureAnimator) {
        a.anim.update(0, { speed: 0, moveAngle: 0, airborne: false, alive: false, pitch: 0, celebrate: false });
        this.toCorpse(p.slot, a);
        continue;
      }
      // A fresh death hands the body to a ragdoll (when the effects world and the skeleton are ready).
      if (a.wasAlive && !p.alive && a.anim && this.physics && !a.ragdoll) {
        this.startRagdoll(p.slot, a);
        if (a.ragdoll) {
          this.toCorpse(p.slot, a);
          continue;
        }
      }
      if (p.alive && a.ragdoll) {
        a.ragdoll.dispose();
        a.ragdoll = undefined;
      }
      a.wasAlive = p.alive;
      // While ragdolled the body stays where it fell; physics moves the bones.
      if (!a.ragdoll) {
        a.root.position.set(p.x, p.y, p.z);
        if (a.emergeAt !== undefined) {
          const t = (now - a.emergeAt) / EMERGE_MS;
          if (t >= 1) a.emergeAt = undefined;
          else a.root.position.y -= EMERGE_DEPTH * (1 - t) * (1 - t);
        }
        a.root.rotation.y = p.yaw;
      }
      a.placeholder.setEnabled(p.alive && !a.anim);
      const glowColor = p.powerups & POWERUP_DAMAGE_BIT ? '#c03cff' : p.powerups & POWERUP_SPEED_BIT ? '#36d6ff' : null;
      a.mat.emissiveColor = glowColor ? Color3.FromHexString(glowColor).scale(0.55) : Color3.Black();
      if (a.anim) {
        // Riders stand still in their seats, however fast the vehicle goes.
        const speed = seated.has(p.slot) ? 0 : Math.hypot(a.vel.x, a.vel.z);
        a.anim.update(Math.min(0.1, dt), {
          speed,
          moveAngle: speed > 0.3 ? angleDelta(p.yaw, Math.atan2(a.vel.x, a.vel.z)) : 0,
          airborne: !p.grounded && !seated.has(p.slot),
          alive: p.alive,
          pitch: p.pitch,
          celebrate: (celebrate || !!p.emote) && p.alive,
          stance: p.stance ?? 0,
          sprinting: !!p.sprinting,
        });
        if (a.anim instanceof CharacterAnimator) for (const m of a.anim.ch.meshes) if (m.material && 'emissiveColor' in m.material) (m.material as unknown as { emissiveColor: Color3 }).emissiveColor = glowColor ? Color3.FromHexString(glowColor).scale(0.35) : Color3.Black();
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
      this.setTag(a, p.alive ? allyColor(p.slot) : null);
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

  /** Whether your own first-person arms have loaded (for tests). */
  hasFirstPersonArms(): boolean {
    return !!this.fpArms?.anim;
  }

  /** Remote avatars currently shown as animated characters (for tests and the stats overlay). */
  characterCount(): number {
    return [...this.avatars.values()].filter((a) => a.anim).length;
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
    void this.models.instantiate(def.view.model, `held_${slot}`).then((node) => {
      if (a.weaponSlot !== slot || a.root.isDisposed()) return node.dispose();
      // The muzzle is the front of the gun along its forward axis, measured before it's put in a hand.
      const { min, max } = node.getHierarchyBoundingVectors(true);
      a.muzzle = { node, local: new Vector3(0, (min.y + max.y) / 2 + (max.y - min.y) * 0.2, max.z) };
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
      placeholder.setEnabled(false);
      // Move the held weapon from the capsule to the hand.
      const slotNow = a.weaponSlot;
      a.weaponSlot = -1;
      if (slotNow >= 0) this.setAvatarWeapon(a, slotNow);
    });
    return a;
  }

  /** Show a teammate marker in the team colour over the avatar (null hides it). */
  private setTag(a: Avatar, color: string | null): void {
    if (a.tag && a.tag.color !== color) {
      a.tag.mesh.dispose(false, true);
      a.tag = undefined;
    }
    if (!color || a.tag) return;
    // Allies: a diamond; enemies (red by default): a downward triangle, so the two read apart at a glance.
    const enemy = color.toLowerCase() === '#ff3b3b';
    const mesh = CreateDisc(`${a.root.name}_tag`, { radius: enemy ? 0.13 : 0.11, tessellation: enemy ? 3 : 4 }, this.scene);
    if (enemy) mesh.rotation.z = -Math.PI / 2;
    const mat = new StandardMaterial(`${a.root.name}_tagmat`, this.scene);
    mat.emissiveColor = Color3.FromHexString(color);
    mat.disableLighting = true;
    mesh.material = mat;
    mesh.billboardMode = MeshClass.BILLBOARDMODE_ALL;
    mesh.parent = a.root;
    mesh.position.y = PLAYER.height + 0.35;
    mesh.isPickable = false;
    a.tag = { mesh, color };
  }

  private disposeAvatar(a: Avatar): void {
    // The flash texture is shared by every flash: dispose the material, never the texture.
    a.flash?.material?.dispose();
    a.flash?.dispose();
    a.ragdoll?.dispose();
    a.anim?.dispose();
    a.weaponNode?.dispose();
    this.dropCanopy(a);
    a.root.dispose(false, true);
  }

  // ---------------------------------------------------------------- pickups

  private addPickup(e: PickupEntity): void {
    const root = createPickupVisual(this.scene, this.models, e.item, `pickup_${e.id}`);
    const baseY = e.position[1] + PICKUP_HOVER;
    root.position.set(e.position[0], baseY, e.position[2]);
    this.pickups.set(e.id, { root, baseY, phase: (e.position[0] * 7 + e.position[2] * 3) % (Math.PI * 2) });
  }

  /** Spin and bob pickups; hide the ones currently taken. */
  updatePickups(taken: ReadonlySet<string>, now: number): void {
    for (const [id, p] of this.pickups) {
      p.root.setEnabled(!taken.has(id));
      p.root.rotation.y = now * 0.0015 + p.phase;
      p.root.position.y = p.baseY + Math.sin(now * 0.003 + p.phase) * 0.08;
    }
  }

  // ---------------------------------------------------------------- projectiles & effects

  /** Breakable props follow the replicated state (already broken when you join). */
  applyPropStates(states: ReadonlyMap<number, readonly [number, number]>): void {
    for (const [i, node] of this.props) {
      const s = states.get(i);
      if (s) node.setEnabled(s[0] > 0);
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
    const model = look === 'grenade' ? 'projectiles/grenade.glb' : look === 'frag' ? 'projectiles/frag.glb' : null;
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
      const light = CreateSphere(`mine_${id}_light`, { diameter: 0.07, segments: 6 }, this.scene);
      light.position.y = 0.06;
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

  /** Chunks flying out of a broken crate, barrel or wall: real little bodies that bounce and settle (falls back to a canned arc without physics). */
  debris(at: Vec3, color: string, size: number): void {
    for (let k = 0; k < 10; k++) {
      const s = size * (0.15 + Math.random() * 0.2);
      const chunk = CreateBox('debris', { size: s }, this.scene);
      chunk.material = solid(this.scene, 'debrisMat', color);
      chunk.isPickable = false;
      const v = new Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6);
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
  private readonly mountSmokeAt = new Map<number, number>();

  /** Turrets, sentries and vehicles at their smoothed poses; turret guns follow the aim. `manned` (the turret you are gunning) is hidden, as your own body is. */
  updateMounts(mounts: Iterable<ClientMount>, manned: number | null = null): void {
    for (const m of mounts) {
      let node = this.mountNodes.get(m.index);
      if (!node) {
        node = createMountNode(this.scene, this.models, m.model, `mount_${m.index}`, m.tint);
        this.mountNodes.set(m.index, node);
      }
      node.setEnabled(m.alive && m.index !== manned);
      node.position.set(m.shown.pos.x, m.shown.pos.y, m.shown.pos.z);
      // Damaged vehicles smoke; badly damaged ones burn.
      if (m.alive && m.health < 50) {
        const now = performance.now();
        const next = this.mountSmokeAt.get(m.index) ?? 0;
        if (now >= next) {
          this.mountSmokeAt.set(m.index, now + (m.health < 25 ? 90 : 160));
          const top = { x: m.shown.pos.x + (Math.random() - 0.5) * m.def.half[0], y: m.shown.pos.y + m.def.half[1] * 2, z: m.shown.pos.z + (Math.random() - 0.5) * m.def.half[2] };
          this.impacts.puff(top, m.health < 25 ? '#2a2725' : '#5d5955', 1.2, 1.6, 1.8);
          if (m.health < 25) this.impacts.puff(top, '#ff7a1a', 0.5, 0.35, 1.5, true);
        }
      }
      node.rotation.y = m.shown.yaw;
      if (m.def.kind === 'vehicle' && m.alive && !m.def.airplane) this.suspend(m, node);
      if (m.def.kind !== 'vehicle') {
        const gun = mountGun(node);
        if (gun) gun.rotation.y = m.shown.aimYaw - m.shown.yaw;
      }
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
    pitch += Math.max(-0.08, Math.min(0.08, -accel * 0.006));
    roll += Math.max(-0.12, Math.min(0.12, yawRate * speed * (hover ? -0.006 : 0.004)));
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

  render(): void {
    const now = performance.now();
    this.effects = this.effects.filter((fx) => {
      const f = (now - fx.born) / fx.ttl;
      if (f >= 1) {
        fx.mesh.material?.dispose();
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
