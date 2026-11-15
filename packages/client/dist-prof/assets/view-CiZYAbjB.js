import { C as CreatePlane, F as FresnelParameters, a as CascadedShadowGenerator, D as DefaultRenderingPipeline, S as SSAO2RenderingPipeline, u as underSmall, m as markWholeSceneDepth, V as VolumetricLightScatteringPostProcess, b as CityVisuals, c as ScenarioVisuals, d as FoliageVisuals, W as WeatherVisuals, e as buildRoadMeshes, f as mergePathMeshes, g as buildPathMeshes, B as BackdropVisuals, h as BorderVisuals, i as isAmmoBoxPickup, p as pickupRoom, j as envBatchedOn, L as LIQUID_LOOKS, A as AMMO_BOX_MODEL, k as AMMO_BOX_KIT_HAND_SCALE, l as castSmall, n as createPickupVisual, P as PICKUP_HOVER, o as lootGlowKey, q as lootOutlineAlpha, r as lootOutlineRadii, s as createLootOutline, t as LOOT_GLOW_RANGE, v as lootGlowLevel, w as DROP_LIE_HEIGHT, x as AMMO_BOX_KIT_SCALE, y as PROP_CONTACTS } from "./abstractMesh-CcTXW9P4.js";
import { c as StandardMaterial, a as Color3, C as Color4, b as CreateDisc, M as Matrix, V as Vector3, Q as Quaternion, e as CreateBox, T as TransformNode, h as Mesh, j as VertexBuffer, bQ as SubMesh, i as VertexData, aB as PBRMaterial, bB as RawTexture, G as Texture, F as FreeCamera, ap as Constants, a1 as Vector4, a0 as Vector2, bM as Effect, ah as PostProcess, ce as Animatable, S as Scene, cf as AbstractMesh, H as HemisphericLight, D as DirectionalLight, cg as Frustum } from "./babylon-PnzH6wcM.js";
import { C as CreateCapsule } from "./capsuleBuilder-D5ktebP4.js";
import { c as createMountNode, m as mountGun, a as mountTurret, s as setMountGlow, w as wheelsOf, b as suspensionOf } from "./mountVisuals-DcqHY-wo.js";
import { C as CreateCylinder } from "./cylinderBuilder-B3IbC6dA.js";
import { C as CreateLineSystem, a as CreateLines } from "./linesBuilder-6E0Gh92-.js";
import { bi as reduceFlashing, bj as CHUTE_GLIDER, bk as STATUS_FROZEN, bl as STATUS_BURN, bm as STATUS_POISON, bn as STATUS_SLOW, bo as STATUS_CHILL, bp as ZONE_KINDS, bq as SMOKE, br as indicator, bs as SkeletonSpace, bt as applyWorldGrade, bu as perfOn, aE as loadGraphicsQuality, aD as versioned, bv as ease$1, P as PLAYER, bw as loadFirstPersonMode, M as ModelLibrary, C as CharacterLibrary, v as CreatureLibrary, bx as mapZiplines, by as renderRatio, bz as loadRenderScale, bA as mapLiquids, bB as WEAPONS_BY_SLOT, bC as CHUTE_PARACHUTE, w as CreatureAnimator, c as CharacterAnimator, bD as SHOT_OVERLAY_REACH, bE as BLAST_FADE_IN, bF as SAFE_MUZZLE, bG as hangDepth, bH as liquidAt, x as setCharacterLodZoom, bI as heldModel, bJ as CORE_WEAPONS, bK as throwableModel, d as getWeapon, ae as armsLookFor, bL as setCharacterLodCrowd, g as getLook, bM as POWERUP_DAMAGE_BIT, bN as POWERUP_SPEED_BIT, bO as FX_PROTECTED, bP as animStepByShare, bQ as animStep, bR as ANIM_LOD_FAR, bS as ANIM_LOD_NEAR, bT as angleDelta, bU as FX_CLOAK, bV as FX_JET, bW as weaponByCode, af as fitPlayerSkin, bX as disposeTree, bY as PROJECTILE_VISUALS, bZ as THROWABLE_DEFS, b_ as blastStrength, b$ as MOUNT_WRECK_FADE_SECONDS, c0 as floatSurface, c1 as mountDamageState, c2 as smokeBlocks } from "./index-BAsW2uYW.js";
import { EnvironmentVisuals } from "./environmentVisuals-DHOOYxSF.js";
import { C as CreateTorus } from "./torusBuilder-BTtpdox_.js";
import { C as CreateSphere } from "./sphereBuilder.pure-CT5peVwp.js";
import { D as DynamicTexture } from "./dynamicTexture.pure-Sh-mex-9.js";
import { e as envColliderDesc, S as ShadowGenerator, c as createPropNode } from "./shadowGenerator-_IcnNyty.js";
import { h as DEFAULT_BLOOD, i as SURFACE_TYPES, j as propSurface, l as guessSurface, m as materialSurface, e as environmentShapes, n as gunplayOf } from "./scenarioDefs-BcDISE-R.js";
import { S as ShaderMaterial } from "./shaderMaterial.pure-T5Xe2ebz.js";
import { M as MapStyler, l as levelMipBias, p as propFlushLifts } from "./mapMeshes-BbrFew7q.js";
import { h as hitboxForSpec, B as BodyHitbox } from "./hitboxOverlay-CUGIm5Wp.js";
import "./netProbe-Bv9gS1yd.js";
import { N as NC } from "./rapier-BmnBVapV.js";
import { ao as blockBoxes, g as getProp, G as boxQuat, ap as mapTerrainMesh, ai as propBoxes, _ as isBreakableProp, I as hungPropLift } from "./settle-BDJE4VMF.js";
const INDOOR_REACH = 5;
const INDOOR_MARGIN = 0.75;
const CELL = 8;
function indoorProps(doc, boxes) {
  const grid = /* @__PURE__ */ new Map();
  for (const b of [...boxes, ...blockBoxes(doc)]) {
    if (b.kind === "barrier" || b.kind === "prop" || b.kind === "trim" || b.pitch || b.roll) continue;
    const r = b.yaw ? Math.hypot(b.max[0] - b.min[0], b.max[2] - b.min[2]) / 2 : 0;
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    const x0 = b.yaw ? cx - r : b.min[0];
    const x1 = b.yaw ? cx + r : b.max[0];
    const z0 = b.yaw ? cz - r : b.min[2];
    const z1 = b.yaw ? cz + r : b.max[2];
    for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++) {
      for (let gz = Math.floor(z0 / CELL); gz <= Math.floor(z1 / CELL); gz++) {
        const k = `${gx},${gz}`;
        const list = grid.get(k);
        if (list) list.push(b);
        else grid.set(k, [b]);
      }
    }
  }
  const inside = (b, x, z) => {
    let px = x;
    let pz = z;
    if (b.yaw) {
      const cx = (b.min[0] + b.max[0]) / 2;
      const cz = (b.min[2] + b.max[2]) / 2;
      const c = Math.cos(-b.yaw);
      const s = Math.sin(-b.yaw);
      px = cx + (x - cx) * c + (z - cz) * s;
      pz = cz - (x - cx) * s + (z - cz) * c;
    }
    return px >= b.min[0] && px <= b.max[0] && pz >= b.min[2] && pz <= b.max[2];
  };
  const covered = (x, z, top, mid) => {
    for (const b of grid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
      const bottom = b.min[1];
      if (bottom >= top - 0.05 && bottom <= top + INDOOR_REACH && inside(b, x, z)) return true;
      if (mid !== null && b.min[1] <= mid && b.max[1] >= mid && inside(b, x, z)) return true;
    }
    return false;
  };
  return (e) => {
    const def = getProp(e.model);
    if (!def || e.model.startsWith("env.")) return false;
    const [x, y, z] = e.position;
    const top = y + def.size[1] * e.scale;
    const mid = y + (top - y) / 2;
    const m = INDOOR_MARGIN;
    return covered(x, z, top, null) && covered(x + m, z, top, mid) && covered(x - m, z, top, mid) && covered(x, z + m, top, mid) && covered(x, z - m, top, mid);
  };
}
const GROUP_STATIC = 1;
const GROUP_DEBRIS = 2;
const GROUP_RAGDOLL = 4;
const groups = (member, filter) => member << 16 | filter;
function sameShape(a, b) {
  if (a.kind !== b.kind) return false;
  const near = (x, y) => Math.abs(x - y) < 0.01;
  if (a.kind === "capsule" && b.kind === "capsule") return near(a.halfHeight, b.halfHeight) && near(a.radius, b.radius);
  if (a.kind === "ball" && b.kind === "ball") return near(a.radius, b.radius);
  if (a.kind === "box" && b.kind === "box") return near(a.half.x, b.half.x) && near(a.half.y, b.half.y) && near(a.half.z, b.half.z);
  return false;
}
const EFFECTS_FLOOR_MARGIN = 20;
function vehicleDebris(radius) {
  return [
    { size: Math.max(1, radius * 0.4), count: 16, speed: 1.8 },
    { size: Math.max(0.8, radius * 0.3), count: 6, speed: 2.2 }
  ];
}
function debrisBurst(at, size, count, speed, rnd2 = Math.random) {
  const out = [];
  for (let k = 0; k < count; k++) {
    const s = size * (0.15 + rnd2() * 0.2);
    const vel = { x: (rnd2() - 0.5) * 6 * speed, y: (2 + rnd2() * 4) * speed, z: (rnd2() - 0.5) * 6 * speed };
    const spin = { x: rnd2() * 8, y: rnd2() * 8, z: rnd2() * 8 };
    const start = { x: at.x + (rnd2() - 0.5) * size, y: at.y + (rnd2() - 0.5) * size, z: at.z + (rnd2() - 0.5) * size };
    out.push({ size: s, start, vel, spin });
  }
  return out;
}
function shapeBottom(sh) {
  if (sh.kind === "capsule") return Math.min(sh.a[1], sh.b[1]) - sh.r;
  const pts = sh.kind === "hull" ? sh.points : sh.positions;
  let y = Infinity;
  for (let i = 1; i < pts.length; i += 3) y = Math.min(y, pts[i]);
  return y;
}
class EffectsWorld {
  /** Gravity a multiple of the usual (Lunar's floaty ragdolls, the gravity storm). */
  setGravityScale(scale) {
    this.world.gravity = { x: 0, y: -20 * Math.max(0.05, scale), z: 0 };
  }
  world;
  acc = 0;
  /** The level box behind each static collider (the terrain has none): what a shot hit, for its impact (stone, metal, wood …). */
  boxes = /* @__PURE__ */ new Map();
  /** The environment shape behind each environment collider (trunks, limbs, boulders, cliffs): its surface. */
  envSurfaces = /* @__PURE__ */ new Map();
  /** The lowest point of the level's static shapes (terrain, boxes, environment): nothing can rest below it. */
  floor;
  constructor(boxes, terrain = null, shapes = []) {
    this.world = new NC.World({ x: 0, y: -20, z: 0 });
    let floor = Infinity;
    if (terrain) for (let i = 1; i < terrain.positions.length; i += 3) floor = Math.min(floor, terrain.positions[i]);
    for (const b of boxes) floor = Math.min(floor, b.min[1]);
    const statics = groups(GROUP_STATIC, GROUP_DEBRIS | GROUP_RAGDOLL | GROUP_STATIC);
    if (terrain) this.world.createCollider(NC.ColliderDesc.trimesh(terrain.positions, terrain.indices).setCollisionGroups(statics));
    for (const sh of shapes) {
      const desc = envColliderDesc(sh);
      if (desc) this.envSurfaces.set(this.world.createCollider(desc.setCollisionGroups(statics).setFriction(0.9)).handle, sh.surface);
    }
    for (const b of boxes) {
      if (b.kind === "barrier" && b.sourceId !== "ground") continue;
      const hx = (b.max[0] - b.min[0]) / 2;
      const hy = (b.max[1] - b.min[1]) / 2;
      const hz = (b.max[2] - b.min[2]) / 2;
      const desc = NC.ColliderDesc.cuboid(hx, hy, hz).setTranslation(b.min[0] + hx, b.min[1] + hy, b.min[2] + hz).setCollisionGroups(statics).setFriction(0.9);
      if (b.pitch || b.roll) desc.setRotation(boxQuat(b.yaw, b.pitch, b.roll));
      else if (b.yaw) desc.setRotation({ x: 0, y: Math.sin(b.yaw / 2), z: 0, w: Math.cos(b.yaw / 2) });
      this.boxes.set(this.world.createCollider(desc).handle, b);
    }
    for (const sh of shapes) floor = Math.min(floor, shapeBottom(sh));
    this.floor = Number.isFinite(floor) ? floor : 0;
    this.world.step();
  }
  /** A body this far down has fallen out of the world (through it, or off its edge): nothing will stop it now. */
  belowWorld(y) {
    return y < this.floor - EFFECTS_FLOOR_MARGIN;
  }
  /**
   * Where a debris chunk of half-height `half` starting at `start` should start so it isn't under the ground or in
   * a level shape: the first static surface under the burst's centre height (`at`), straight down over the chunk,
   * with the chunk lifted onto it when it starts below. A chunk started under the terrain's surface is beneath a
   * one-sided mesh with nothing below it and falls out of the world (a vehicle blowing up centres its burst only its
   * half-height above the ground, and scatters chunks over a cube up to 2.4 m across).
   */
  clearOfGround(at, start, half) {
    const top = Math.max(at.y, start.y) + half;
    const hit = this.raycast({ x: start.x, y: top, z: start.z }, { x: 0, y: -1, z: 0 }, top - start.y + half + 0.05);
    if (!hit) return start;
    const floor = top - hit.dist;
    return start.y - half < floor + 0.02 ? { x: start.x, y: floor + half + 0.02, z: start.z } : start;
  }
  /** Fixed 60 Hz steps taken so far (simulated time, for ragdolls' settle and freeze on slow frames too). */
  steps = 0;
  /** Advance by wall-clock `dt` in fixed 60 Hz steps (at most six per call, so a hitch can't snowball). */
  step(dt) {
    this.acc = Math.min(this.acc + dt, 6 / 60);
    while (this.acc >= 1 / 60) {
      this.stepWorld();
      this.steps++;
      this.acc -= 1 / 60;
    }
  }
  /**
   * One step of the world. Rapier's World.step() then walks every body and collider handle through a JS callback, and
   * every collider again, to pick up what the step made or removed itself (docs/PERF_96.md, "Performance round 4"):
   * on a map of a few thousand level colliders that was most of a step and half a megabyte of garbage each, as the
   * game's own physics found (sim/physics.ts, commit). Ours are all made and removed through the JS API, which keeps
   * its maps itself: the pipeline runs on its own, with a full walk now and then to be safe.
   */
  stepWorld() {
    const w = this.world;
    if (typeof w.physicsPipeline?.step !== "function" || typeof w.mapNewSoftBodies !== "function" || !("softBodies" in w) || this.steps % 600 === 0) {
      this.world.step();
      return;
    }
    w.physicsPipeline.step(w.gravity, w.integrationParameters, w.islands, w.broadPhase, w.narrowPhase, w.bodies, w.colliders, w.softBodies, w.impulseJoints, w.multibodyJoints, w.ccdSolver);
  }
  /**
   * First static surface along a ray: distance, the surface normal and the level box it belongs to (none: the
   * terrain), or the surface type of the environment shape it hit.
   */
  raycast(from, dir, maxDist) {
    const hit = this.world.castRayAndGetNormal(new NC.Ray(from, dir), maxDist, true, void 0, groups(65535, GROUP_STATIC));
    if (!hit) return null;
    const box = this.boxes.get(hit.collider.handle);
    const surface = this.envSurfaces.get(hit.collider.handle);
    return { dist: hit.timeOfImpact, normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z }, ...box ? { box } : {}, ...surface ? { surface } : {} };
  }
  /** First ragdoll body along a ray (a corpse in the way of a shot): the body, distance and surface normal. */
  raycastRagdoll(from, dir, maxDist) {
    const live = (c) => c.parent()?.isEnabled() ?? false;
    const hit = this.world.castRayAndGetNormal(new NC.Ray(from, dir), maxDist, true, void 0, groups(65535, GROUP_RAGDOLL), void 0, void 0, live);
    const body = hit?.collider.parent();
    return hit && body ? { body, dist: hit.timeOfImpact, normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z } } : null;
  }
  /** A dynamic body. Debris bumps into debris; ragdoll parts only into the level (their joints hold them together). */
  addBody(shape, pos, rot, layer, o = {}) {
    const body = this.world.createRigidBody(
      NC.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation(rot).setLinvel(o.vel?.x ?? 0, o.vel?.y ?? 0, o.vel?.z ?? 0).setAngvel(o.spin ?? { x: 0, y: 0, z: 0 }).setLinearDamping(layer === "ragdoll" ? 0.6 : 0.1).setAngularDamping(layer === "ragdoll" ? 1.6 : 0.2).setCcdEnabled(true)
    );
    const desc = shape.kind === "box" ? NC.ColliderDesc.cuboid(shape.half.x, shape.half.y, shape.half.z) : shape.kind === "capsule" ? NC.ColliderDesc.capsule(shape.halfHeight, shape.radius) : NC.ColliderDesc.ball(shape.radius);
    desc.setDensity(o.density ?? 1).setFriction(0.8).setRestitution(layer === "debris" ? 0.3 : 0.05);
    desc.setCollisionGroups(layer === "debris" ? groups(GROUP_DEBRIS, GROUP_STATIC | GROUP_DEBRIS) : groups(GROUP_RAGDOLL, GROUP_STATIC));
    this.world.createCollider(desc, body);
    return body;
  }
  /** A ball joint holding two bodies together at a shared point (anchors in each body's own frame). */
  ballJoint(a, b, anchorA, anchorB, limits) {
    const j = this.world.createImpulseJoint(NC.JointData.spherical(anchorA, anchorB), a, b, true);
    if (limits) {
      j.setLocalFrame1(anchorA, limits.frameA);
      j.setLocalFrame2(anchorB, limits.frameB);
      const raw = this.world.impulseJoints.raw;
      raw.jointSetLimits(j.handle, NC.JointAxis.AngX, limits.x[0], limits.x[1]);
      raw.jointSetLimits(j.handle, NC.JointAxis.AngY, limits.y[0], limits.y[1]);
      raw.jointSetLimits(j.handle, NC.JointAxis.AngZ, limits.z[0], limits.z[1]);
    }
    return j;
  }
  removeJoint(j) {
    this.world.removeImpulseJoint(j, true);
  }
  // Ragdoll body pool: a body that stops simulating is parked (disabled) and reused by the next death, so a
  // blast that kills ten allocates nothing. Keyed by part (a forearm comes back as a forearm, nearly its size).
  parked = /* @__PURE__ */ new Map();
  /** Bodies handed out by the pool and not yet given back. */
  pooledOut = 0;
  /** Park a few ragdolls' worth of bodies up front (key and shape for each). */
  prewarm(parts, times) {
    for (let i = 0; i < times; i++) {
      for (const p of parts) {
        const body = this.addBody(p.shape, { x: 0, y: -1e3 - i, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, "ragdoll");
        body.setEnabled(false);
        let list = this.parked.get(p.key);
        if (!list) this.parked.set(p.key, list = []);
        list.push({ body, shape: p.shape });
      }
    }
  }
  /** A ragdoll part from the pool (or a new one): placed, moving, awake. */
  takeRagdollBody(key, shape, pos, rot, o = {}) {
    this.pooledOut++;
    const p = this.parked.get(key)?.pop();
    if (!p) {
      const body2 = this.addBody(shape, pos, rot, "ragdoll", o);
      this.shapes.set(body2.handle, shape);
      return body2;
    }
    const body = p.body;
    body.setEnabled(true);
    const c = body.collider(0);
    if (!sameShape(p.shape, shape) || !c) {
      if (c) this.world.removeCollider(c, false);
      const desc = shape.kind === "box" ? NC.ColliderDesc.cuboid(shape.half.x, shape.half.y, shape.half.z) : shape.kind === "capsule" ? NC.ColliderDesc.capsule(shape.halfHeight, shape.radius) : NC.ColliderDesc.ball(shape.radius);
      desc.setDensity(o.density ?? 1).setFriction(0.8).setRestitution(0.05).setCollisionGroups(groups(GROUP_RAGDOLL, GROUP_STATIC));
      this.world.createCollider(desc, body);
    } else c.setDensity(o.density ?? 1);
    this.shapes.set(body.handle, shape);
    body.setTranslation(pos, false);
    body.setRotation(rot, false);
    body.setLinvel(o.vel ?? { x: 0, y: 0, z: 0 }, false);
    body.setAngvel(o.spin ?? { x: 0, y: 0, z: 0 }, false);
    body.setLinearDamping(0.6);
    body.setAngularDamping(1.6);
    body.wakeUp();
    return body;
  }
  /** Give a ragdoll part back to the pool (its joints must be gone). */
  parkRagdollBody(key, body) {
    this.pooledOut--;
    body.setEnabled(false);
    const shape = this.shapes.get(body.handle);
    if (!shape) {
      this.world.removeRigidBody(body);
      return;
    }
    let list = this.parked.get(key);
    if (!list) this.parked.set(key, list = []);
    list.push({ body, shape });
  }
  shapes = /* @__PURE__ */ new Map();
  remove(body) {
    this.world.removeRigidBody(body);
  }
  free() {
    this.world.free();
  }
}
class MeshPool {
  constructor(make, max) {
    this.make = make;
    this.max = max;
  }
  make;
  max;
  free = [];
  /** A mesh, shown (its position, scale and the like are the caller's to set). */
  take() {
    const m = this.free.pop() ?? this.make();
    m.setEnabled(true);
    return m;
  }
  /** Done with a mesh: hidden for reuse. */
  give(m) {
    if (this.free.length >= this.max) {
      m.dispose();
      return;
    }
    m.setEnabled(false);
    this.free.push(m);
  }
  /**
   * Draw one of these for a few frames while the match loads, far out of sight, so its shader is built
   * then instead of at the first hit (a stall). `pose` sets it up the way it's drawn (scale, fade).
   */
  warm(pose = () => void 0, frames = 3) {
    const m = this.take();
    m.position.set(0, -1e4, 0);
    pose(m);
    m.alwaysSelectAsActiveMesh = true;
    const scene = m.getScene();
    let left = frames;
    const obs = scene.onAfterRenderObservable.add(() => {
      if (--left > 0) return;
      scene.onAfterRenderObservable.remove(obs);
      m.alwaysSelectAsActiveMesh = false;
      this.give(m);
    });
  }
  dispose() {
    for (const m of this.free) m.dispose();
    this.free.length = 0;
  }
}
const BLOOD_PREF_KEY = "cs.blood";
function bloodPreference() {
  try {
    return localStorage.getItem(BLOOD_PREF_KEY) !== "off";
  } catch {
    return true;
  }
}
const MAX_SPLATS = 120;
const GRAVITY = 16;
const DROP_LIFE = 0.9;
const SPLAT_STAY = 7;
const SPLAT_FADE = 2;
const MAX_DROPS = 500;
const MAX_MIST = 64;
const EFFECT$4 = { effect: true };
class BloodVisuals {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    this.dropMat = new StandardMaterial("bloodDrop", scene);
    this.splatMat = new StandardMaterial("bloodSplat", scene);
    this.splatMat.zOffset = -2;
    this.mistMat = new StandardMaterial("bloodMist", scene);
    this.mistMat.alpha = 0.35;
    for (const m of [this.dropMat, this.splatMat, this.mistMat]) m.specularColor = new Color3(0.25, 0.25, 0.25);
    this.dropBase = CreateSphere("bloodDropBase", { diameter: 1, segments: 3 }, scene);
    this.dropBase.material = this.dropMat;
    this.dropBase.isPickable = false;
    this.dropBase.scaling.setAll(0);
    this.dropBase.alwaysSelectAsActiveMesh = true;
    this.dropBase.metadata = EFFECT$4;
    this.dropPool = new MeshPool(() => {
      const m = this.dropBase.createInstance("bloodDrop");
      m.isPickable = false;
      m.metadata = EFFECT$4;
      return m;
    }, MAX_DROPS);
    this.mistBase = CreateSphere("bloodMistBase", { diameter: 1, segments: 4 }, scene);
    this.mistBase.material = this.mistMat;
    this.mistBase.isPickable = false;
    this.mistBase.metadata = EFFECT$4;
    this.mistBase.registerInstancedBuffer("color", 4);
    this.mistBase.instancedBuffers.color = new Color4(1, 1, 1, 1);
    this.mistBase.hasVertexAlpha = true;
    this.mistBase.scaling.setAll(0);
    this.mistBase.alwaysSelectAsActiveMesh = true;
    this.mistPool = new MeshPool(() => {
      const m = this.mistBase.createInstance("bloodMist");
      m.isPickable = false;
      m.metadata = EFFECT$4;
      m.instancedBuffers.color = new Color4(1, 1, 1, 1);
      return m;
    }, MAX_MIST);
    this.splatBase = CreateDisc("bloodSplatBase", { radius: 1, tessellation: 9 }, scene);
    this.splatBase.material = this.splatMat;
    this.splatBase.isPickable = false;
    this.splatBase.metadata = { castsNoShadow: true };
    this.splatBase.thinInstanceSetBuffer("matrix", this.splatMatrices, 16, false);
    this.splatBase.thinInstanceSetBuffer("color", this.splatColors, 4, false);
    this.splatBase.thinInstanceCount = 0;
    this.splatBase.hasVertexAlpha = true;
    this.splatBase.alwaysSelectAsActiveMesh = true;
    this.splatBase.doNotSyncBoundingInfo = true;
    this.splatBase.freezeWorldMatrix();
    this.setLook(DEFAULT_BLOOD.color, DEFAULT_BLOOD.amount);
  }
  scene;
  physics;
  drops = [];
  splats = [];
  mist = [];
  dropBase;
  dropPool;
  /** Mist: GPU instances of one sphere, faded by their instance colour's alpha (one draw for them all). */
  mistBase;
  mistPool;
  /**
   * Splats: thin instances of one unit disc, scaled to their size and faded by their instance colour's alpha (one draw
   * and one mesh for them all; each was a mesh and a draw of its own, 50 in a busy fight's frame, then a GPU instance:
   * one draw, but still 50 meshes Babylon looked at every frame).
   */
  splatBase;
  splatMatrices = new Float32Array(MAX_SPLATS * 16);
  splatColors = new Float32Array(MAX_SPLATS * 4).fill(1);
  splatsDirty = false;
  splatMat;
  dropMat;
  mistMat;
  amount = DEFAULT_BLOOD.amount;
  enabled = true;
  /** Build blood's shaders while the match loads (see MeshPool.warm): a drop, mist, a splat and a fading splat. */
  warm() {
    this.dropPool.warm((m) => m.scaling.setAll(0.05));
    this.mistPool.warm((m) => m.scaling.setAll(0.3));
    this.splats.push({ matrix: Float32Array.from(Matrix.Compose(new Vector3(0.3, 0.25, 0.3), Quaternion.Identity(), new Vector3(0, -1e4, 0)).m), born: performance.now() - (SPLAT_STAY + SPLAT_FADE) * 1e3 + 50 });
    this.splatsDirty = true;
    this.flushSplats();
  }
  setLook(color2, amount) {
    this.amount = amount;
    const c = Color3.FromHexString(color2);
    this.dropMat.diffuseColor = c;
    this.dropMat.emissiveColor = c.scale(0.15);
    this.splatMat.diffuseColor = c.scale(0.8);
    this.mistMat.diffuseColor = c;
    this.mistMat.emissiveColor = c.scale(0.2);
  }
  /** Blood is drawn (the map allows it and the player hasn't switched it off). */
  get on() {
    return this.enabled && this.amount !== "off";
  }
  /** A hit at `at`, the shot travelling along `dir`; `strength` 1 for a bullet, more for big hits. */
  hit(at, dir, strength = 1) {
    if (!this.on) return;
    const heavy = this.amount === "heavy";
    const n = Math.round((heavy ? 14 : 6) * Math.min(2.5, strength));
    const d = new Vector3(dir.x, dir.y, dir.z).normalize();
    for (let i = 0; i < n; i++) {
      const v = d.scale(2 + Math.random() * 3 * strength).add(new Vector3((Math.random() - 0.5) * 3, Math.random() * 2.2, (Math.random() - 0.5) * 3));
      this.drop(new Vector3(at.x, at.y, at.z), v);
    }
    if (this.mist.length < MAX_MIST) {
      const puff = this.mistPool.take();
      puff.scaling.setAll(0.15);
      puff.instancedBuffers.color.a = 1;
      puff.position.set(at.x, at.y, at.z);
      this.mist.push({ mesh: puff, age: 0 });
    }
    const wall = this.physics()?.raycast(at, { x: d.x, y: d.y, z: d.z }, heavy ? 3 : 1.8);
    if (wall) this.splat(new Vector3(at.x + d.x * wall.dist, at.y + d.y * wall.dist, at.z + d.z * wall.dist), wall.normal, 0.25 + Math.random() * 0.2 * strength);
  }
  /** A kill: a bigger burst, and a small pool on the ground under the body. */
  kill(at) {
    if (!this.on) return;
    this.hit(at, { x: 0, y: 0.4, z: 0 }, 1.6);
    const ground = this.physics()?.raycast(at, { x: 0, y: -1, z: 0 }, 3);
    if (ground) this.splat(new Vector3(at.x, at.y - ground.dist, at.z), ground.normal, this.amount === "heavy" ? 0.9 : 0.55);
  }
  drop(pos, vel) {
    if (this.drops.length >= MAX_DROPS) return;
    const mesh = this.dropPool.take();
    mesh.scaling.setAll(0.03 + Math.random() * 0.05);
    mesh.position.copyFrom(pos);
    this.drops.push({ mesh, pos, vel, age: 0 });
  }
  splat(at, normal, radius) {
    const n = new Vector3(normal.x, normal.y, normal.z).normalize();
    const q = new Quaternion();
    const turn = new Quaternion();
    Quaternion.FromUnitVectorsToRef(new Vector3(0, 0, -1), n, q);
    q.multiplyToRef(Quaternion.RotationAxis(new Vector3(0, 0, 1), Math.random() * Math.PI * 2), turn);
    const m = Matrix.Compose(new Vector3(radius, radius * (0.6 + Math.random() * 0.5), radius), turn, at.add(n.scale(0.015)));
    this.splats.push({ matrix: Float32Array.from(m.m), born: performance.now() });
    const cap = this.amount === "heavy" ? MAX_SPLATS : 50;
    while (this.splats.length > cap) this.splats.shift();
    this.splatsDirty = true;
  }
  /** Splats lying now (tests). */
  get splatCount() {
    return this.splats.length;
  }
  /** The splats into their thin-instance buffers (when one came, went or is fading). */
  flushSplats() {
    if (!this.splatsDirty) return;
    this.splatsDirty = false;
    const now = performance.now();
    let i = 0;
    for (const s of this.splats) {
      const age = (now - s.born) / 1e3;
      this.splatMatrices.set(s.matrix, i * 16);
      this.splatColors[i * 4 + 3] = age > SPLAT_STAY ? Math.max(0, 1 - (age - SPLAT_STAY) / SPLAT_FADE) : 1;
      i++;
    }
    this.splatBase.thinInstanceCount = i;
    this.splatBase.thinInstanceBufferUpdated("matrix");
    this.splatBase.thinInstanceBufferUpdated("color");
    this.splatBase.setEnabled(i > 0);
  }
  /** Move drops, fade mist and old splats. Call every frame. */
  update(dt) {
    const physics = this.physics();
    this.drops = this.drops.filter((d) => {
      d.age += dt;
      d.vel.y -= GRAVITY * dt;
      const step = d.vel.scale(dt);
      const len2 = step.length();
      const hit = len2 > 0 && physics ? physics.raycast(d.pos, { x: step.x / len2, y: step.y / len2, z: step.z / len2 }, len2) : null;
      if (hit || d.age > DROP_LIFE) {
        if (hit && Math.random() < 0.6) this.splat(d.pos.add(step.scale(hit.dist / len2)), hit.normal, 0.05 + Math.random() * 0.09);
        this.dropPool.give(d.mesh);
        return false;
      }
      d.pos.addInPlace(step);
      d.mesh.position.copyFrom(d.pos);
      return true;
    });
    this.mist = this.mist.filter((m) => {
      m.age += dt;
      m.mesh.scaling.setAll(0.15 + m.age * 2.2);
      m.mesh.instancedBuffers.color.a = Math.max(0, 1 - m.age / 0.25);
      if (m.age < 0.25) return true;
      this.mistPool.give(m.mesh);
      return false;
    });
    const now = performance.now();
    const before = this.splats.length;
    this.splats = this.splats.filter((s) => (now - s.born) / 1e3 <= SPLAT_STAY + SPLAT_FADE);
    if (this.splats.length !== before || this.splats.some((s) => (now - s.born) / 1e3 > SPLAT_STAY)) this.splatsDirty = true;
    this.flushSplats();
  }
  dispose() {
    for (const d of this.drops) d.mesh.dispose();
    this.splats = [];
    for (const m of this.mist) m.mesh.dispose();
    for (const p of [this.dropPool, this.mistPool]) p.dispose();
    this.mistBase.dispose();
    this.splatBase.dispose();
    this.dropBase.dispose();
    for (const m of [this.dropMat, this.splatMat, this.mistMat]) m.dispose();
  }
}
const BULLET_SPEED = 260;
const MAX_HOLES = 700;
const STREAK_LENGTH = 2.2;
const DUST = new Color3(0.55, 0.52, 0.47);
const dustColours = /* @__PURE__ */ new Map();
function dustColour(hex) {
  if (!hex) return DUST;
  let c = dustColours.get(hex);
  if (!c) dustColours.set(hex, c = Color3.FromHexString(hex));
  return c;
}
const MAX_POOLED_STREAKS = 256;
const MAX_SPARKS = 600;
const MAX_CHIPS = 300;
const MAX_DUST = 200;
const MAX_PUFFS = 120;
const EFFECT$3 = { effect: true };
class ImpactVisuals {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    this.streak = CreateBox("bulletStreak", { width: 0.025, height: 0.025, depth: 1 }, scene);
    this.streak.bakeTransformIntoVertices(Matrix.Translation(0, 0, -0.5));
    const streakMat = new StandardMaterial("bulletStreakMat", scene);
    streakMat.disableLighting = true;
    streakMat.emissiveColor = Color3.White();
    this.streak.material = streakMat;
    this.streak.registerInstancedBuffer("color", 4);
    this.streak.instancedBuffers.color = new Color4(1, 0.9, 0.6, 1);
    this.prepareSource(this.streak);
    this.spark = CreateSphere("impactSpark", { diameter: 1, segments: 2 }, scene);
    const sparkMat = new StandardMaterial("impactSparkMat", scene);
    sparkMat.disableLighting = true;
    sparkMat.emissiveColor = new Color3(1, 0.78, 0.35);
    this.spark.material = sparkMat;
    this.prepareSource(this.spark);
    this.sparkPool = new MeshPool(() => {
      const m = this.spark.createInstance("spark");
      m.isPickable = false;
      return m;
    }, MAX_SPARKS);
    this.chip = CreateBox("impactChip", { width: 1, height: 0.35, depth: 0.5 }, scene);
    const chipMat = new StandardMaterial("impactChipMat", scene);
    chipMat.diffuseColor = new Color3(1, 1, 1);
    chipMat.specularColor = Color3.Black();
    this.chip.material = chipMat;
    this.chip.metadata = EFFECT$3;
    this.chip.registerInstancedBuffer("color", 4);
    this.chip.instancedBuffers.color = new Color4(1, 1, 1, 1);
    this.prepareSource(this.chip);
    this.chipPool = new MeshPool(() => {
      const m = this.chip.createInstance("chip");
      m.isPickable = false;
      m.metadata = EFFECT$3;
      m.instancedBuffers.color = new Color4(1, 1, 1, 1);
      return m;
    }, MAX_CHIPS);
    this.puffPool = new MeshPool(() => {
      const m = CreateSphere("puff", { diameter: 1, segments: 4 }, scene);
      m.isPickable = false;
      m.metadata = EFFECT$3;
      return m;
    }, MAX_PUFFS);
    this.dustMat = new StandardMaterial("impactDustMat", scene);
    this.dustMat.diffuseColor = new Color3(1, 1, 1);
    this.dustMat.specularColor = Color3.Black();
    this.dustMat.alpha = 0.5;
    this.dust = CreateSphere("impactDust", { diameter: 1, segments: 4 }, scene);
    this.dust.material = this.dustMat;
    this.dust.metadata = EFFECT$3;
    this.dust.registerInstancedBuffer("color", 4);
    this.dust.instancedBuffers.color = new Color4(1, 1, 1, 1);
    this.dust.hasVertexAlpha = true;
    this.prepareSource(this.dust);
    this.dustPool = new MeshPool(() => {
      const m = this.dust.createInstance("dust");
      m.isPickable = false;
      m.metadata = EFFECT$3;
      m.instancedBuffers.color = new Color4(1, 1, 1, 1);
      return m;
    }, MAX_DUST);
    this.holes = CreateDisc("bulletHoles", { radius: 0.05, tessellation: 10 }, scene);
    const holeMat = new StandardMaterial("bulletHoleMat", scene);
    holeMat.diffuseTexture = holeTexture(scene);
    holeMat.diffuseTexture.hasAlpha = true;
    holeMat.useAlphaFromDiffuseTexture = true;
    holeMat.specularColor = new Color3(0.05, 0.05, 0.05);
    holeMat.zOffset = -3;
    holeMat.backFaceCulling = false;
    this.holes.material = holeMat;
    this.holes.isPickable = false;
    this.holes.alwaysSelectAsActiveMesh = true;
    this.holes.thinInstanceSetBuffer("matrix", this.holeMatrices, 16, false);
    this.holes.thinInstanceCount = 0;
  }
  scene;
  physics;
  bullets = [];
  streakPool = [];
  sparks = [];
  /** Splinters, leaves and grit: lit flakes tinted per instance (the surface type's chip colour), falling like sparks. */
  chips = [];
  chip;
  chipPool;
  puffs = [];
  streak;
  spark;
  sparkPool;
  /** Wall-hit dust: GPU instances of one sphere, faded by their instance colour's alpha (one draw for them all). */
  dust;
  dustPool;
  dusts = [];
  /** Dust and smoke puffs (each its own mesh: they fade one by one). */
  puffPool;
  holes;
  dustMat;
  holeCount = 0;
  holeNext = 0;
  /** Holes made since the last upload (first and last index): sent to the GPU once a frame, not the whole buffer per hit. */
  holeDirty = null;
  holeMatrices = new Float32Array(MAX_HOLES * 16);
  /** Sources stay enabled (instances draw only while their source does) but shrunk away. */
  prepareSource(m) {
    m.isPickable = false;
    m.alwaysSelectAsActiveMesh = true;
    m.scaling.setAll(0);
  }
  /**
   * A round flying from `from` to `to`; `onArrive` runs when it gets there.
   * `speed` is its real velocity (bullets) and `tracer: false` flies it
   * without a streak (tracer intervals, GUNPLAY_SPEC §31): it still lands.
   */
  fire(from, to, color2, onArrive, startAt = 0, opts = {}) {
    const a = new Vector3(from.x, from.y, from.z);
    const d = new Vector3(to.x - from.x, to.y - from.y, to.z - from.z);
    const dist = d.length();
    if (dist < 0.05) {
      onArrive?.();
      return;
    }
    d.scaleInPlace(1 / dist);
    const speed = opts.speed ?? BULLET_SPEED;
    const length = Math.min(12, STREAK_LENGTH * Math.max(1, speed / BULLET_SPEED));
    if (opts.tracer === false) {
      this.bullets.push({ mesh: null, from: a, dir: d, dist, travelled: Math.min(startAt, dist * 0.5), speed, length, onArrive });
      return;
    }
    const mesh = this.streakPool.pop() ?? this.streak.createInstance("bullet");
    mesh.setEnabled(true);
    mesh.scaling.set(1, 1, 0.01);
    const c = Color3.FromHexString(color2);
    mesh.instancedBuffers.color = new Color4(Math.min(1, c.r * 0.6 + 0.5), Math.min(1, c.g * 0.6 + 0.5), Math.min(1, c.b * 0.6 + 0.45), 1);
    mesh.isPickable = false;
    mesh.rotationQuaternion = new Quaternion();
    Quaternion.FromUnitVectorsToRef(Vector3.Forward(), d, mesh.rotationQuaternion);
    mesh.position.copyFrom(a);
    this.bullets.push({ mesh, from: a, dir: d, dist, travelled: Math.min(startAt, dist * 0.5), speed, length, onArrive });
  }
  /** Done with a streak: back to the pool (hidden), or disposed past the pool's size. */
  release(mesh) {
    if (this.streakPool.length >= MAX_POOLED_STREAKS) {
      mesh.dispose();
      return;
    }
    mesh.setEnabled(false);
    this.streakPool.push(mesh);
  }
  /** Where a shot ending at `to` (coming from `from`) hits the level, if it does: point and surface normal. */
  surfaceHit(from, to) {
    const world = this.physics();
    if (!world) return null;
    const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const len2 = Math.hypot(d.x, d.y, d.z);
    if (len2 < 0.05) return null;
    const dir = { x: d.x / len2, y: d.y / len2, z: d.z / len2 };
    const hit = world.raycast(from, dir, len2 + 0.15);
    if (!hit || Math.abs(hit.dist - len2) > 0.35) return null;
    return { point: { x: from.x + dir.x * hit.dist, y: from.y + dir.y * hit.dist, z: from.z + dir.z * hit.dist }, normal: hit.normal, ...hit.box ? { box: hit.box } : {}, ...hit.surface ? { surface: hit.surface } : {} };
  }
  /**
   * A round hitting a wall or floor: a hole that stays (not in foliage), sparks, chips and dust, as the surface type's
   * `style` says (content/vfx.json map.impacts and content/surface-types.json, game/fxMap.ts: metal throws sparks, wood
   * and bark splinters, foliage leaves, each its own dust).
   */
  wallImpact(point, normal, size = 1, style) {
    const n = new Vector3(normal.x, normal.y, normal.z).normalize();
    if (style?.hole !== false) this.hole(point, n, size);
    for (let i = 0; i < (style?.sparks ?? 5) && this.sparks.length < MAX_SPARKS; i++) {
      const v = n.scale(2 + Math.random() * 3).add(new Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4));
      const mesh = this.sparkPool.take();
      mesh.scaling.setAll(0.025 + Math.random() * 0.02);
      const pos = new Vector3(point.x, point.y, point.z).add(n.scale(0.03));
      mesh.position.copyFrom(pos);
      this.sparks.push({ mesh, pos, vel: v, age: 0, life: 0.18 + Math.random() * 0.15 });
    }
    const chipColour = dustColour(style?.chip);
    for (let i = 0; i < (style?.chips ?? 0) && this.chips.length < MAX_CHIPS; i++) {
      const v = n.scale(1.5 + Math.random() * 2.5).add(new Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3));
      const mesh = this.chipPool.take();
      mesh.scaling.setAll((0.035 + Math.random() * 0.035) * Math.min(1.4, size));
      mesh.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
      mesh.instancedBuffers.color.set(chipColour.r, chipColour.g, chipColour.b, 1);
      const pos = new Vector3(point.x, point.y, point.z).add(n.scale(0.04));
      mesh.position.copyFrom(pos);
      this.chips.push({ mesh, pos, vel: v, age: 0, life: 0.45 + Math.random() * 0.35 });
    }
    if (style?.dust === null || this.dusts.length >= MAX_DUST) return;
    const dust = this.dustPool.take();
    dust.position.set(point.x + n.x * 0.12, point.y + n.y * 0.12, point.z + n.z * 0.12);
    dust.scaling.setAll(0.05);
    const c = dustColour(style?.dust);
    dust.instancedBuffers.color.set(c.r, c.g, c.b, 1);
    this.dusts.push({ mesh: dust, age: 0, life: 0.45, grow: 0.5 * size * (style?.dustSize ?? 1) });
  }
  /** A bullet hole that stays for the match (the oldest reused past MAX_HOLES). */
  hole(point, n, size) {
    const q = new Quaternion();
    Quaternion.FromUnitVectorsToRef(new Vector3(0, 0, -1), n, q);
    const twist = Quaternion.RotationAxis(new Vector3(0, 0, 1), Math.random() * Math.PI * 2);
    const s = size * (0.8 + Math.random() * 0.4);
    const m = Matrix.Compose(new Vector3(s, s, s), q.multiply(twist), new Vector3(point.x + n.x * 0.01, point.y + n.y * 0.01, point.z + n.z * 0.01));
    m.copyToArray(this.holeMatrices, this.holeNext * 16);
    this.holeDirty = this.holeDirty ? [Math.min(this.holeDirty[0], this.holeNext), Math.max(this.holeDirty[1], this.holeNext)] : [this.holeNext, this.holeNext];
    this.holeNext = (this.holeNext + 1) % MAX_HOLES;
    this.holeCount = Math.min(MAX_HOLES, this.holeCount + 1);
    this.holes.thinInstanceCount = this.holeCount;
  }
  /** A spray of hot sparks from a point (a badly damaged vehicle shorting out, a crash). */
  sparkBurst(at, count, speed = 3) {
    for (let i = 0; i < count && this.sparks.length < MAX_SPARKS; i++) {
      const vel = new Vector3((Math.random() - 0.5) * speed * 2, Math.random() * speed * 1.4, (Math.random() - 0.5) * speed * 2);
      const mesh = this.sparkPool.take();
      mesh.scaling.setAll(0.03 + Math.random() * 0.03);
      const pos = new Vector3(at.x, at.y, at.z);
      mesh.position.copyFrom(pos);
      this.sparks.push({ mesh, pos, vel, age: 0, life: 0.25 + Math.random() * 0.3 });
    }
  }
  puffMats = /* @__PURE__ */ new Map();
  /** A soft puff that grows, rises and fades (vehicle smoke and fire). */
  puff(at, hex, size, life, rise, glow2 = false, drift) {
    if (this.puffs.length >= MAX_PUFFS) return;
    let mat2 = this.puffMats.get(hex);
    if (!mat2) {
      mat2 = new StandardMaterial(`puff_${hex}`, this.scene);
      mat2.diffuseColor = Color3.FromHexString(hex);
      mat2.specularColor = Color3.Black();
      if (glow2) mat2.emissiveColor = Color3.FromHexString(hex);
      mat2.alpha = glow2 ? 0.85 : 0.55;
      this.puffMats.set(hex, mat2);
    }
    const mesh = this.takePuff(mat2);
    mesh.position.set(at.x, at.y, at.z);
    mesh.scaling.setAll(size * 0.3);
    this.puffs.push({ mesh, age: 0, life, grow: size, rise, base: size * 0.3, ...drift ? { drift: new Vector3(drift.x, drift.y, drift.z) } : {} });
  }
  takePuff(mat2) {
    const m = this.puffPool.take();
    m.material = mat2;
    m.visibility = 1;
    return m;
  }
  /** Build the sparks' and dust's shaders while the match loads (see MeshPool.warm). */
  warm() {
    this.sparkPool.warm((m) => m.scaling.setAll(0.03));
    this.chipPool.warm((m) => m.scaling.setAll(0.03));
    this.dustPool.warm((m) => {
      m.scaling.setAll(0.3);
      m.instancedBuffers.color.a = 0.5;
    });
    this.puffPool.warm((m) => {
      m.material = this.dustMat;
      m.scaling.setAll(0.3);
      m.visibility = 0.5;
    });
  }
  /** Bullet holes currently in the level (for tests). */
  get holesInLevel() {
    return this.holeCount;
  }
  update(dt) {
    if (this.holeDirty) {
      const [first, last] = this.holeDirty;
      this.holes.thinInstancePartialBufferUpdate("matrix", last - first + 1, first);
      this.holeDirty = null;
    }
    this.bullets = this.bullets.filter((b) => {
      b.travelled += b.speed * dt;
      const head = Math.min(b.travelled, b.dist);
      const tail = Math.max(0, head - b.length);
      if (b.mesh) {
        b.mesh.position.copyFrom(b.from.add(b.dir.scale(head)));
        b.mesh.scaling.z = Math.max(0.01, head - tail);
      }
      if (b.travelled < b.dist) return true;
      if (b.mesh) this.release(b.mesh);
      b.onArrive?.();
      return false;
    });
    this.sparks = this.sparks.filter((s) => {
      s.age += dt;
      s.vel.y -= 14 * dt;
      s.pos.addInPlace(s.vel.scale(dt));
      s.mesh.position.copyFrom(s.pos);
      if (s.age < s.life) return true;
      this.sparkPool.give(s.mesh);
      return false;
    });
    this.chips = this.chips.filter((s) => {
      s.age += dt;
      s.vel.y -= 9.8 * dt;
      s.vel.scaleInPlace(Math.max(0, 1 - 1.5 * dt));
      s.pos.addInPlace(s.vel.scale(dt));
      s.mesh.position.copyFrom(s.pos);
      s.mesh.rotation.x += 9 * dt;
      s.mesh.rotation.z += 6 * dt;
      if (s.age < s.life) return true;
      this.chipPool.give(s.mesh);
      return false;
    });
    this.puffs = this.puffs.filter((p) => {
      p.age += dt;
      const f = p.age / p.life;
      p.mesh.scaling.setAll((p.base ?? 0.05) + p.grow * f);
      if (p.rise) p.mesh.position.y += p.rise * dt;
      if (p.drift) p.mesh.position.addInPlace(p.drift.scale(dt * (1 - f) * (1 - f)));
      p.mesh.visibility = Math.max(0, 1 - f);
      if (f < 1) return true;
      this.puffPool.give(p.mesh);
      return false;
    });
    this.dusts = this.dusts.filter((d) => {
      d.age += dt;
      const f = d.age / d.life;
      d.mesh.scaling.setAll(0.05 + d.grow * f);
      d.mesh.instancedBuffers.color.a = Math.max(0, 1 - f);
      if (f < 1) return true;
      this.dustPool.give(d.mesh);
      return false;
    });
  }
  dispose() {
    for (const b of this.bullets) b.mesh?.dispose();
    for (const m of this.streakPool) m.dispose();
    for (const s of this.sparks) s.mesh.dispose();
    for (const s of this.chips) s.mesh.dispose();
    for (const p of this.puffs) p.mesh.dispose();
    for (const d of this.dusts) d.mesh.dispose();
    this.sparkPool.dispose();
    this.chipPool.dispose();
    this.chip.dispose();
    this.dustPool.dispose();
    this.dust.dispose();
    this.puffPool.dispose();
    this.streak.dispose();
    this.spark.dispose();
    this.holes.dispose();
  }
}
function holeTexture(scene) {
  const size = 64;
  const tex = new DynamicTexture("bulletHoleTex", { width: size, height: size }, scene, true);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, size, size);
  const c = size / 2;
  const rim = ctx.createRadialGradient(c, c, 4, c, c, c);
  rim.addColorStop(0, "rgba(20,18,16,1)");
  rim.addColorStop(0.3, "rgba(35,32,28,0.95)");
  rim.addColorStop(0.55, "rgba(120,112,100,0.55)");
  rim.addColorStop(1, "rgba(120,112,100,0)");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(30,27,24,0.6)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + i * 0.7;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * 7, c + Math.sin(a) * 7);
    ctx.lineTo(c + Math.cos(a) * (14 + i % 3 * 5), c + Math.sin(a) * (14 + i % 3 * 5));
    ctx.stroke();
  }
  tex.update();
  return tex;
}
const INDOOR_FILL = {
  /** The sky light under a roof: this much more (1: twice). Flatpack Depot's showroom then reads about as bright as
   *  with its lamps on Medium. */
  boost: 1,
  /** How fast the fill comes and goes (of the whole change a second). */
  rate: 0.9,
  /** How often (s) the camera looks up for a roof. */
  every: 0.25
};
function fillLevel(level, covered, dt) {
  const want = covered ? 1 : 0;
  const step = INDOOR_FILL.rate * Math.max(0, dt);
  return want > level ? Math.min(want, level + step) : Math.max(want, level - step);
}
class IndoorFill {
  constructor(hemi, roofOver) {
    this.hemi = hemi;
    this.roofOver = roofOver;
  }
  hemi;
  roofOver;
  level = 0;
  covered = false;
  lastCheck = -Infinity;
  lastAt = 0;
  /** The sky light's own intensity (what the map's sky set), and what this last wrote over it. */
  base = 0;
  written = -1;
  update(now) {
    const dt = this.lastAt ? Math.min(0.25, (now - this.lastAt) / 1e3) : 0;
    this.lastAt = now;
    if ((now - this.lastCheck) / 1e3 >= INDOOR_FILL.every) {
      this.lastCheck = now;
      this.covered = this.roofOver();
    }
    if (this.hemi.intensity !== this.written) this.base = this.hemi.intensity;
    this.level = fillLevel(this.level, this.covered, dt);
    this.written = this.base * (1 + INDOOR_FILL.boost * this.level);
    this.hemi.intensity = this.written;
  }
  /** 0 in the open, 1 fully filled (tests). */
  get fill() {
    return this.level;
  }
}
const TROOP_BUGGY = {
  hide: [
    // The cabin, inside the tub's walls: seats, floor, wheel and dash.
    [
      [-0.58, 0.4, -1.06],
      [0.58, 1.62, 1.12]
    ],
    // The cowl between the dash and the hood.
    [
      [-0.6, 0.85, 1],
      [0.6, 1.2, 1.32]
    ],
    // The cage above the tub's walls.
    [
      [-0.72, 0.98, -1.06],
      [0.72, 1.58, 1.2]
    ]
  ],
  palette: {
    cage: [0.3, 0.29, 0.26],
    sand: [0.66, 0.54, 0.41],
    seat: [0.11, 0.11, 0.115],
    bolster: [0.17, 0.17, 0.17],
    shell: [0.2, 0.2, 0.19],
    strap: [0.62, 0.18, 0.1],
    buckle: [0.72, 0.72, 0.74],
    dash: [0.15, 0.15, 0.145],
    floor: [0.3, 0.3, 0.29],
    rubber: [0.05, 0.05, 0.05],
    steel: [0.55, 0.55, 0.57],
    lamp: [0.85, 0.85, 0.8]
  },
  tubes: [
    // Rear hoop, behind the back row; the hoop behind the front seats.
    { path: [[-0.6, 0.86, -1], [-0.47, 1.47, -1], [0.47, 1.47, -1], [0.6, 0.86, -1]], r: 0.027, bend: 0.12, color: "cage", surface: "paint" },
    { path: [[-0.6, 0.9, 0.05], [-0.47, 1.47, 0.05], [0.47, 1.47, 0.05], [0.6, 0.9, 0.05]], r: 0.027, bend: 0.12, color: "cage", surface: "paint" },
    // Roof rails into the A-pillars, down to the hood.
    { path: [[-0.46, 1.47, -1.08], [-0.46, 1.47, 0.4], [-0.48, 1.42, 0.6], [-0.56, 1.05, 1.05], [-0.59, 0.94, 1.2]], r: 0.027, bend: 0.16, color: "cage", surface: "paint", mirror: true },
    // Front bar (lamps on it), the spine and the gun mount's cross bar.
    { path: [[-0.48, 1.43, 0.6], [0.48, 1.43, 0.6]], r: 0.024, color: "cage", surface: "paint" },
    { path: [[0, 1.49, -1.08], [0, 1.49, 0.6]], r: 0.022, color: "cage", surface: "paint" },
    // The brace from the front bar down the middle to the hood.
    { path: [[0, 1.45, 0.6], [0, 1.05, 1.22]], r: 0.022, color: "cage", surface: "paint" },
    { path: [[-0.46, 1.47, -0.35], [0.46, 1.47, -0.35]], r: 0.022, color: "cage", surface: "paint" },
    // Side bars along the tub's walls.
    { path: [[-0.62, 0.84, -1.06], [-0.62, 0.86, 0.05], [-0.6, 0.8, 1.05]], r: 0.022, bend: 0.2, color: "cage", surface: "paint", mirror: true },
    // Diagonals in the rear hoop and the front hoop's harness bar.
    { path: [[-0.58, 0.95, -1], [0.44, 1.45, -1]], r: 0.02, color: "cage", surface: "paint" },
    { path: [[-0.57, 1.18, 0.05], [0.57, 1.18, 0.05]], r: 0.02, color: "cage", surface: "paint" },
    // The passenger's grab handle on the dash.
    { path: [[0.12, 1.05, 1], [0.14, 1.13, 0.94], [0.46, 1.13, 0.94], [0.48, 1.05, 1]], r: 0.012, bend: 0.04, color: "cage", surface: "paint" }
  ],
  boxes: [
    // Floor pan, centre tunnel, toe boards up under the dash.
    { at: [0, 0.56, -0.1], size: [1.18, 0.04, 1.94], round: 0.015, color: "floor", surface: "metal" },
    { at: [0, 0.62, -0.1], size: [0.16, 0.12, 1.94], round: 0.03, color: "floor", surface: "metal" },
    { at: [0, 0.73, 0.98], size: [1.14, 0.04, 0.4], rot: [-0.85, 0, 0], round: 0.015, color: "floor", surface: "metal" },
    // Dash: a face panel turned up toward the driver, a sand shelf on top, the gauge pod before the wheel.
    { at: [0, 0.92, 0.97], size: [1.16, 0.2, 0.06], rot: [0.35, 0, 0], round: 0.02, color: "dash", surface: "plastic" },
    { at: [0, 1, 1.12], size: [1.18, 0.035, 0.36], rot: [0.1, 0, 0], round: 0.015, color: "sand", surface: "paint" },
    { at: [-0.32, 1, 0.95], size: [0.34, 0.12, 0.07], rot: [0.35, 0, 0], round: 0.025, color: "dash", surface: "plastic" },
    { at: [-0.32, 1.065, 0.94], size: [0.36, 0.02, 0.1], rot: [0.12, 0, 0], round: 0.01, color: "dash", surface: "plastic" },
    // Switch plate in the middle, pedals.
    { at: [0, 0.94, 0.94], size: [0.2, 0.09, 0.03], rot: [0.35, 0, 0], round: 0.01, color: "shell", surface: "plastic" },
    { at: [-0.4, 0.7, 0.88], size: [0.06, 0.1, 0.02], rot: [-0.5, 0, 0], round: 8e-3, color: "steel", surface: "metal" },
    { at: [-0.25, 0.7, 0.88], size: [0.07, 0.08, 0.02], rot: [-0.5, 0, 0], round: 8e-3, color: "steel", surface: "metal" }
  ],
  discs: [
    // Lamps on the front bar: round housings, their lenses ahead.
    { at: [-0.4, 1.47, 0.66], face: [0, 0, 1], r: 0.032, depth: 0.06, color: "cage", surface: "paint", mirror: true },
    { at: [-0.16, 1.47, 0.66], face: [0, 0, 1], r: 0.032, depth: 0.06, color: "cage", surface: "paint", mirror: true },
    { at: [-0.4, 1.47, 0.665], face: [0, 0, 1], r: 0.026, depth: 6e-3, color: "lamp", surface: "metal", mirror: true },
    { at: [-0.16, 1.47, 0.665], face: [0, 0, 1], r: 0.026, depth: 6e-3, color: "lamp", surface: "metal", mirror: true }
  ],
  seats: [
    { at: [-0.32, 0.79, 0.28], recline: 0.26, harness: true, mirror: true },
    { at: [-0.32, 0.77, -0.53], recline: 0.26, harness: true, mirror: true },
    { at: [-0.32, 0.66, -0.94], recline: 0.08, depth: 0.3, mirror: true }
  ],
  wheel: { at: [-0.32, 1, 0.78], toward: [0, 0.45, -0.9], r: 0.17, grip: 0.018, spokes: [-Math.PI / 2, Math.PI / 2, Math.PI], column: 0.36, lock: 1.6 },
  gauges: [
    { at: [-0.39, 1, 0.925], face: [0, 0.34, -0.94], r: 0.045, needle: "speed", max: 22 },
    { at: [-0.25, 1, 0.925], face: [0, 0.34, -0.94], r: 0.045, needle: "revs" },
    { at: [0.16, 0.95, 0.94], face: [0, 0.34, -0.94], r: 0.03 },
    { at: [0.26, 0.95, 0.94], face: [0, 0.34, -0.94], r: 0.03 }
  ],
  switches: [{ at: [0, 0.94, 0.925], face: [0, 0.34, -0.94], count: 4, gap: 0.04 }]
};
const SUPPLY_BUGGY = {
  hide: [
    // The cabin, inside the tub's walls: seats, floor, wheel and dash.
    [
      [-0.72, 0.4, -0.6],
      [0.72, 1.62, 0.92]
    ],
    // The cowl between the dash and the hood.
    [
      [-0.75, 0.95, 0.75],
      [0.75, 1.32, 1.08]
    ],
    // The cage above the tub's walls.
    [
      [-0.86, 1.1, -0.62],
      [0.86, 1.95, 1]
    ]
  ],
  palette: {
    cage: [0.16, 0.19, 0.2],
    sand: [0.55, 0.5, 0.4],
    seat: [0.11, 0.11, 0.115],
    bolster: [0.17, 0.17, 0.17],
    shell: [0.2, 0.2, 0.19],
    strap: [0.1, 0.55, 0.6],
    buckle: [0.72, 0.72, 0.74],
    dash: [0.13, 0.15, 0.155],
    floor: [0.25, 0.27, 0.27],
    rubber: [0.05, 0.05, 0.05],
    steel: [0.55, 0.55, 0.57],
    lamp: [0.85, 0.85, 0.8]
  },
  tubes: [
    // The hoop behind the cabin (the rear deck starts there); the hoop behind the seats.
    { path: [[-0.75, 0.92, -0.6], [-0.59, 1.65, -0.6], [0.59, 1.65, -0.6], [0.75, 0.92, -0.6]], r: 0.03, bend: 0.14, color: "cage", surface: "paint" },
    { path: [[-0.75, 0.95, -0.15], [-0.59, 1.65, -0.15], [0.59, 1.65, -0.15], [0.75, 0.95, -0.15]], r: 0.03, bend: 0.14, color: "cage", surface: "paint" },
    // Roof rails into the A-pillars, down to the hood.
    { path: [[-0.58, 1.65, -0.65], [-0.58, 1.65, 0.2], [-0.6, 1.59, 0.4], [-0.7, 1.14, 0.85], [-0.74, 1, 1]], r: 0.03, bend: 0.18, color: "cage", surface: "paint", mirror: true },
    // Front bar (lamps on it), the spine and a cross bar.
    { path: [[-0.6, 1.6, 0.4], [0.6, 1.6, 0.4]], r: 0.027, color: "cage", surface: "paint" },
    { path: [[0, 1.67, -0.65], [0, 1.67, 0.4]], r: 0.024, color: "cage", surface: "paint" },
    // The brace from the front bar down the middle to the hood.
    { path: [[0, 1.62, 0.4], [0, 1.14, 1]], r: 0.024, color: "cage", surface: "paint" },
    { path: [[-0.58, 1.65, -0.4], [0.58, 1.65, -0.4]], r: 0.024, color: "cage", surface: "paint" },
    // Side bars along the tub's walls.
    { path: [[-0.78, 0.88, -0.6], [-0.78, 0.9, -0.15], [-0.75, 0.83, 0.85]], r: 0.024, bend: 0.2, color: "cage", surface: "paint", mirror: true },
    // A diagonal in the rear hoop and the front hoop's harness bar.
    { path: [[-0.72, 1.02, -0.6], [0.55, 1.62, -0.6]], r: 0.022, color: "cage", surface: "paint" },
    { path: [[-0.71, 1.3, -0.15], [0.71, 1.3, -0.15]], r: 0.022, color: "cage", surface: "paint" },
    // The passenger's grab handle on the dash.
    { path: [[0.15, 1.14, 0.8], [0.18, 1.24, 0.74], [0.58, 1.24, 0.74], [0.6, 1.14, 0.8]], r: 0.013, bend: 0.05, color: "cage", surface: "paint" }
  ],
  boxes: [
    // Floor pan, centre tunnel, toe boards up under the dash.
    { at: [0, 0.53, 0.1], size: [1.48, 0.04, 1.3], round: 0.015, color: "floor", surface: "metal" },
    { at: [0, 0.6, 0.1], size: [0.18, 0.12, 1.3], round: 0.03, color: "floor", surface: "metal" },
    { at: [0, 0.71, 0.78], size: [1.42, 0.04, 0.4], rot: [-0.85, 0, 0], round: 0.015, color: "floor", surface: "metal" },
    // Dash: a face panel turned up toward the driver, a shelf on top, the gauge pod before the wheel.
    { at: [0, 1, 0.77], size: [1.45, 0.24, 0.06], rot: [0.35, 0, 0], round: 0.02, color: "dash", surface: "plastic" },
    { at: [0, 1.1, 0.92], size: [1.48, 0.035, 0.36], rot: [0.1, 0, 0], round: 0.015, color: "sand", surface: "paint" },
    { at: [-0.4, 1.1, 0.75], size: [0.38, 0.14, 0.07], rot: [0.35, 0, 0], round: 0.025, color: "dash", surface: "plastic" },
    { at: [-0.4, 1.175, 0.74], size: [0.4, 0.02, 0.1], rot: [0.12, 0, 0], round: 0.01, color: "dash", surface: "plastic" },
    // Switch plate in the middle, pedals.
    { at: [0, 1.03, 0.74], size: [0.22, 0.1, 0.03], rot: [0.35, 0, 0], round: 0.01, color: "shell", surface: "plastic" },
    { at: [-0.5, 0.7, 0.68], size: [0.06, 0.1, 0.02], rot: [-0.5, 0, 0], round: 8e-3, color: "steel", surface: "metal" },
    { at: [-0.31, 0.7, 0.68], size: [0.07, 0.08, 0.02], rot: [-0.5, 0, 0], round: 8e-3, color: "steel", surface: "metal" }
  ],
  discs: [
    // Lamps on the front bar: round housings, their lenses ahead.
    { at: [-0.5, 1.64, 0.46], face: [0, 0, 1], r: 0.036, depth: 0.06, color: "cage", surface: "paint", mirror: true },
    { at: [-0.2, 1.64, 0.46], face: [0, 0, 1], r: 0.036, depth: 0.06, color: "cage", surface: "paint", mirror: true },
    { at: [-0.5, 1.64, 0.465], face: [0, 0, 1], r: 0.029, depth: 6e-3, color: "lamp", surface: "metal", mirror: true },
    { at: [-0.2, 1.64, 0.465], face: [0, 0, 1], r: 0.029, depth: 6e-3, color: "lamp", surface: "metal", mirror: true }
  ],
  seats: [{ at: [-0.4, 0.82, 0.06], recline: 0.26, harness: true, mirror: true }],
  wheel: { at: [-0.4, 1.1, 0.58], toward: [0, 0.45, -0.9], r: 0.19, grip: 0.019, spokes: [-Math.PI / 2, Math.PI / 2, Math.PI], column: 0.36, lock: 1.6 },
  gauges: [
    { at: [-0.48, 1.1, 0.725], face: [0, 0.34, -0.94], r: 0.048, needle: "speed", max: 22 },
    { at: [-0.32, 1.1, 0.725], face: [0, 0.34, -0.94], r: 0.048, needle: "revs" },
    { at: [0.2, 1.04, 0.745], face: [0, 0.34, -0.94], r: 0.032 },
    { at: [0.32, 1.04, 0.745], face: [0, 0.34, -0.94], r: 0.032 }
  ],
  switches: [{ at: [0, 1.03, 0.725], face: [0, 0.34, -0.94], count: 4, gap: 0.045 }]
};
const TROOP_TRUCK = {
  hide: [
    [
      [-1.2, 1.55, 2.05],
      [1.2, 2.48, 2.7]
    ]
  ],
  palette: {},
  tubes: [],
  boxes: [],
  discs: [],
  seats: [],
  gauges: [],
  switches: []
};
const ARMORED_ROVER = {
  hide: [
    [
      [-1.15, 0.45, -1],
      [1.15, 2.1, 1.02]
    ]
  ],
  palette: {
    trim: [0.15, 0.16, 0.14],
    door: [0.3, 0.29, 0.22],
    dash: [0.11, 0.115, 0.11],
    pad: [0.2, 0.2, 0.18],
    floor: [0.2, 0.21, 0.2],
    seat: [0.12, 0.12, 0.11],
    bolster: [0.18, 0.18, 0.16],
    shell: [0.2, 0.2, 0.19],
    strap: [0.5, 0.42, 0.2],
    buckle: [0.72, 0.72, 0.74],
    rubber: [0.05, 0.05, 0.05],
    steel: [0.5, 0.5, 0.52]
  },
  tubes: [
    // A-pillars from the belt line up to the header, the header, B-pillars, the roof's side rails.
    { path: [[-1.02, 1.5, 0.98], [-0.97, 2.12, 0.62]], r: 0.05, color: "trim", surface: "paint", mirror: true },
    { path: [[-0.97, 2.12, 0.62], [0.97, 2.12, 0.62]], r: 0.045, color: "trim", surface: "paint" },
    { path: [[-1.04, 1.5, -0.55], [-1, 2.14, -0.55]], r: 0.05, color: "trim", surface: "paint", mirror: true },
    { path: [[-0.97, 2.13, 0.62], [-1, 2.15, -1]], r: 0.04, color: "trim", surface: "paint", mirror: true },
    // Grab handles: on the passenger's side of the dash, and over each door.
    { path: [[0.25, 1.5, 0.72], [0.27, 1.56, 0.66], [0.68, 1.56, 0.66], [0.7, 1.5, 0.72]], r: 0.014, bend: 0.04, color: "steel", surface: "metal" },
    { path: [[-0.93, 2.08, 0.25], [-0.9, 2.03, 0.22], [-0.9, 2.03, -0.08], [-0.93, 2.08, -0.11]], r: 0.012, bend: 0.03, color: "steel", surface: "metal", mirror: true }
  ],
  boxes: [
    // Floor, and the tunnel between the seats.
    { at: [0, 0.6, 0], size: [2.1, 0.04, 2], round: 0.015, color: "floor", surface: "metal" },
    { at: [0, 0.74, -0.1], size: [0.3, 0.26, 1.4], round: 0.04, color: "pad", surface: "plastic" },
    // The headliner under the roof (the shell's roof has no underside: the rack and the gunners' feet showed through),
    // and the cowl over the seam where the cut meets the hood.
    { at: [0, 2.16, -0.2], size: [2.04, 0.03, 1.7], round: 0.012, color: "pad", surface: "fabric" },
    { at: [0, 1.57, 1.04], size: [2.1, 0.07, 0.14], round: 0.03, color: "trim", surface: "paint" },
    // Doors up to the belt line, a padded rail on top of each, and a bulkhead behind the bench up to the roof (the
    // shell's back half is not cut: past it, its inside faces would show as shards again).
    { at: [-1.06, 1.05, 0], size: [0.06, 0.9, 2], round: 0.02, color: "door", surface: "paint", mirror: true },
    { at: [-1.03, 1.5, 0], size: [0.1, 0.06, 2], round: 0.025, color: "pad", surface: "plastic", mirror: true },
    { at: [0, 1.38, -1], size: [2.1, 1.56, 0.05], round: 0.02, color: "door", surface: "paint" },
    // The bench behind the front seats, against the back panel: a cushion and a backrest.
    { at: [0, 0.94, -0.72], size: [1.9, 0.14, 0.44], round: 0.04, color: "seat", surface: "fabric" },
    { at: [0, 1.28, -0.93], size: [1.9, 0.56, 0.08], rot: [-0.12, 0, 0], round: 0.035, color: "seat", surface: "fabric" },
    // Dash: a deep shelf under the screen at the hood's height, its face toward the seats, the gauge hood.
    { at: [0, 1.53, 0.86], size: [2.06, 0.05, 0.34], rot: [0.08, 0, 0], round: 0.02, color: "dash", surface: "plastic" },
    { at: [0, 1.36, 0.72], size: [2.06, 0.32, 0.06], rot: [0.3, 0, 0], round: 0.025, color: "dash", surface: "plastic" },
    { at: [-0.45, 1.5, 0.68], size: [0.44, 0.13, 0.08], rot: [0.3, 0, 0], round: 0.03, color: "pad", surface: "plastic" },
    // The switch plate in the middle, a radio box under it, pedals.
    { at: [0.05, 1.4, 0.69], size: [0.26, 0.1, 0.03], rot: [0.3, 0, 0], round: 0.01, color: "shell", surface: "plastic" },
    { at: [0.05, 1.24, 0.72], size: [0.3, 0.12, 0.1], round: 0.015, color: "shell", surface: "metal" },
    { at: [-0.56, 0.78, 0.66], size: [0.07, 0.11, 0.02], rot: [-0.5, 0, 0], round: 8e-3, color: "steel", surface: "metal" },
    { at: [-0.36, 0.78, 0.66], size: [0.08, 0.09, 0.02], rot: [-0.5, 0, 0], round: 8e-3, color: "steel", surface: "metal" }
  ],
  discs: [],
  seats: [{ at: [-0.45, 1.02, -0.15], recline: 0.2, width: 0.5, harness: true, mirror: true }],
  wheel: { at: [-0.45, 1.42, 0.5], toward: [0, 0.4, -0.92], r: 0.2, grip: 0.02, spokes: [-Math.PI / 2, Math.PI / 2, Math.PI], column: 0.3, lock: 1.6 },
  gauges: [
    { at: [-0.54, 1.5, 0.635], face: [0, 0.3, -0.95], r: 0.05, needle: "speed", max: 16 },
    { at: [-0.36, 1.5, 0.635], face: [0, 0.3, -0.95], r: 0.05, needle: "revs" }
  ],
  switches: [{ at: [0.05, 1.4, 0.67], face: [0, 0.3, -0.95], count: 5, gap: 0.045 }]
};
const HAULER = {
  hide: [
    [
      [-1.1, 0.4, 1.3],
      [1.1, 2.7, 3.6]
    ]
  ],
  palette: {},
  tubes: [],
  boxes: [],
  discs: [],
  seats: [],
  gauges: [],
  switches: []
};
const COCKPITS = { troop_buggy: TROOP_BUGGY, supply_buggy: SUPPLY_BUGGY, troop_truck: TROOP_TRUCK, armored_rover: ARMORED_ROVER, hauler: HAULER };
const GAUGE_SWEEP = Math.PI * 3 / 4;
function needleAngle(value) {
  return -GAUGE_SWEEP + 2 * GAUGE_SWEEP * Math.min(1, Math.max(0, value));
}
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => {
  const l = len(a);
  return l > 1e-9 ? mul(a, 1 / l) : [0, 1, 0];
};
const mirrorX = (a) => [-a[0], a[1], a[2]];
function eulerBasis(rot) {
  const [rx, ry, rz] = rot ?? [0, 0, 0];
  const turn = (v) => {
    let [x, y, z] = v;
    [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
    [z, x] = [z * Math.cos(ry) - x * Math.sin(ry), z * Math.sin(ry) + x * Math.cos(ry)];
    [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
    return [x, y, z];
  };
  return [turn([1, 0, 0]), turn([0, 1, 0]), turn([0, 0, 1])];
}
function across$1(n) {
  const f = norm(n);
  let right = sub([1, 0, 0], mul(f, f[0]));
  if (len(right) < 1e-3) right = sub([0, 0, 1], mul(f, f[2]));
  right = norm(right);
  let up = norm(cross(f, right));
  if (up[1] < 0) up = mul(up, -1);
  return [right, up];
}
const srgbToLinear = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
class Builder {
  groups = {};
  geo(surface) {
    return this.groups[surface] ??= { positions: [], normals: [], uvs: [], colors: [], indices: [] };
  }
  /** Adds vertices (position, normal, uv) and triangles given counter-clockwise seen from outside; stored the engine's way. */
  mesh(surface, color2, verts, tris) {
    const g = this.geo(surface);
    const base = g.positions.length / 3;
    const rgb = color2.map(srgbToLinear);
    for (const v of verts) {
      g.positions.push(v.p[0], v.p[1], v.p[2]);
      g.normals.push(v.n[0], v.n[1], v.n[2]);
      g.uvs.push(v.uv[0], v.uv[1]);
      g.colors.push(rgb[0], rgb[1], rgb[2], 1);
    }
    for (let i = 0; i + 2 < tris.length; i += 3) g.indices.push(base + tris[i], base + tris[i + 2], base + tris[i + 1]);
  }
  /** A round tube along `path`, its corners rounded at `bend`; `closed` joins the end to the start (a rim). */
  tube(surface, color2, path, r, bend = 0.1, closed = false, sides = 12) {
    const pts = closed ? path : rounded(path, bend);
    const n = pts.length;
    if (n < 2) return;
    const tangent = (i) => {
      const prev = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
      const next = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
      return norm(sub(next, prev));
    };
    let t = tangent(0);
    let u = across$1(t)[1];
    const verts = [];
    const tris = [];
    let along = 0;
    const rings = closed ? n + 1 : n;
    for (let i = 0; i < rings; i++) {
      const k = i % n;
      const tk = tangent(k);
      u = norm(sub(u, mul(tk, dot(u, tk))));
      t = tk;
      const v = cross(t, u);
      if (i > 0) along += len(sub(pts[k], pts[(i - 1) % n]));
      for (let s = 0; s <= sides; s++) {
        const a = s / sides * Math.PI * 2;
        const dir = add(mul(u, Math.cos(a)), mul(v, Math.sin(a)));
        verts.push({ p: add(pts[k], mul(dir, r)), n: dir, uv: [along * 4, s / sides] });
      }
      if (i > 0) {
        const a0 = (i - 1) * (sides + 1);
        const a1 = i * (sides + 1);
        for (let s = 0; s < sides; s++) tris.push(a0 + s, a0 + s + 1, a1 + s, a0 + s + 1, a1 + s + 1, a1 + s);
      }
    }
    this.mesh(surface, color2, verts, tris);
    if (!closed) {
      this.cap(surface, color2, pts[0], mul(tangent(0), -1), r, sides);
      this.cap(surface, color2, pts[n - 1], tangent(n - 1), r, sides);
    }
  }
  /** A flat round end facing `n`. */
  cap(surface, color2, c, n, r, sides) {
    const [a, b] = across$1(n);
    const verts = [{ p: c, n, uv: [0.5, 0.5] }];
    const tris = [];
    for (let s = 0; s <= sides; s++) {
      const t = s / sides * Math.PI * 2;
      verts.push({ p: add(c, add(mul(a, Math.cos(t) * r), mul(b, Math.sin(t) * r))), n, uv: [0.5 + Math.cos(t) / 2, 0.5 + Math.sin(t) / 2] });
      if (s > 0) tris.push(0, s, s + 1);
    }
    if (dot(cross(a, b), n) < 0) for (let i = 0; i < tris.length; i += 3) [tris[i + 1], tris[i + 2]] = [tris[i + 2], tris[i + 1]];
    this.mesh(surface, color2, verts, tris);
  }
  /** A box with rounded edges about `c`, its sides along the basis `ax` (unit vectors), `half` its half sizes. */
  box(surface, color2, c, half, ax, round, seg = 2) {
    const r = Math.max(0, Math.min(round, half[0], half[1], half[2]));
    const verts = [];
    const tris = [];
    const stops = (h) => {
      if (r <= 1e-5) return [-h, h];
      const out = [-h];
      for (let k = 1; k <= seg; k++) out.push(-h + r * (1 - Math.cos(k / seg * (Math.PI / 2))));
      out.push(h - r);
      for (let k = seg - 1; k >= 0; k--) out.push(h - r * (1 - Math.cos(k / seg * (Math.PI / 2))));
      return [...new Set(out.map((v) => Math.round(v * 1e6) / 1e6))];
    };
    const sx = stops(half[0]);
    const sy = stops(half[1]);
    const sz = stops(half[2]);
    const faces = [
      [0, 1, 1, 2],
      [0, -1, 2, 1],
      [1, 1, 2, 0],
      [1, -1, 0, 2],
      [2, 1, 0, 1],
      [2, -1, 1, 0]
    ];
    const S = [sx, sy, sz];
    for (const [axis, sign, ua, va] of faces) {
      const us = S[ua];
      const vs = S[va];
      const base = verts.length;
      for (const vv of vs)
        for (const uu of us) {
          const q = [0, 0, 0];
          q[axis] = sign * half[axis];
          q[ua] = uu;
          q[va] = vv;
          const inner = [Math.max(-half[0] + r, Math.min(half[0] - r, q[0])), Math.max(-half[1] + r, Math.min(half[1] - r, q[1])), Math.max(-half[2] + r, Math.min(half[2] - r, q[2]))];
          let d = sub(q, inner);
          let local;
          if (len(d) < 1e-7) {
            d = [0, 0, 0];
            d[axis] = sign;
            local = q;
          } else {
            d = norm(d);
            local = add(inner, mul(d, r));
          }
          const world = add(c, add(add(mul(ax[0], local[0]), mul(ax[1], local[1])), mul(ax[2], local[2])));
          const nw = norm(add(add(mul(ax[0], d[0]), mul(ax[1], d[1])), mul(ax[2], d[2])));
          verts.push({ p: world, n: nw, uv: [local[ua] * 2, local[va] * 2] });
        }
      const w = us.length;
      for (let j = 0; j + 1 < vs.length; j++)
        for (let i = 0; i + 1 < w; i++) {
          const a = base + j * w + i;
          tris.push(a, a + 1, a + w + 1, a, a + w + 1, a + w);
        }
    }
    this.mesh(surface, color2, verts, tris);
  }
  /** A box from Euler angles. */
  eulerBox(surface, color2, c, size, rot, round, seg = 2) {
    const half = mul(size, 0.5);
    this.box(surface, color2, c, half, eulerBasis(rot), round ?? Math.min(0.03, Math.min(...size) / 4), seg);
  }
  /** A flat strap from `a` to `b`, `width` wide across, lying on a surface whose normal is `n`. */
  strap(surface, color2, a, b, width, thick, n) {
    const along = norm(sub(b, a));
    const side = norm(cross(n, along));
    const up = cross(along, side);
    this.box(surface, color2, mul(add(a, b), 0.5), [width / 2, thick / 2, len(sub(b, a)) / 2], [side, up, along], 0, 1);
  }
  /** A cylinder whose round face looks along `face`, its front face at `c`. */
  disc(surface, color2, c, face, r, depth, sides = 20) {
    const f = norm(face);
    const back = sub(c, mul(f, depth));
    this.tubeStraight(surface, color2, back, c, r, sides);
  }
  tubeStraight(surface, color2, a, b, r, sides) {
    this.tube(surface, color2, [a, b], r, 0, false, sides);
  }
}
function rounded(path, bend) {
  if (path.length < 3 || bend <= 0) return path.slice();
  const out = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const p = path[i];
    const d0 = sub(p, path[i - 1]);
    const d1 = sub(path[i + 1], p);
    const l0 = len(d0);
    const l1 = len(d1);
    const u0 = mul(d0, 1 / l0);
    const u1 = mul(d1, 1 / l1);
    const turn = Math.acos(Math.max(-1, Math.min(1, dot(u0, u1))));
    if (turn < 1e-3) {
      out.push(p);
      continue;
    }
    const cut = Math.min(bend * Math.tan(turn / 2), l0 * 0.45, l1 * 0.45);
    const a = sub(p, mul(u0, cut));
    const b = add(p, mul(u1, cut));
    const steps = Math.max(2, Math.ceil(turn / (Math.PI / 14)));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      out.push(add(add(mul(a, (1 - t) * (1 - t)), mul(p, 2 * (1 - t) * t)), mul(b, t * t)));
    }
  }
  out.push(path[path.length - 1]);
  const dense = [out[0]];
  for (let i = 1; i < out.length; i++) {
    const a = out[i - 1];
    const b = out[i];
    const parts = Math.max(1, Math.ceil(len(sub(b, a)) / 0.5));
    for (let k = 1; k <= parts; k++) dense.push(add(a, mul(sub(b, a), k / parts)));
  }
  return dense;
}
const centred = (g, o) => {
  for (const geo of Object.values(g)) for (let i = 0; i < geo.positions.length; i += 3) for (let k = 0; k < 3; k++) geo.positions[i + k] -= o[k];
  return g;
};
function buildCockpit(def) {
  const b = new Builder();
  const color2 = (name) => def.palette[name] ?? [1, 0, 1];
  const each = (list, fn) => {
    for (const item of list) {
      fn(item, (v) => v, false);
      if (item.mirror) fn(item, mirrorX, true);
    }
  };
  each(def.tubes, (t, m) => b.tube(t.surface ?? "paint", color2(t.color), t.path.map(m), t.r, t.bend ?? 0.1));
  each(def.boxes, (x, m, flip) => {
    const rot = x.rot && flip ? [x.rot[0], -x.rot[1], -x.rot[2]] : x.rot;
    b.eulerBox(x.surface ?? "plastic", color2(x.color), m(x.at), x.size, rot, x.round);
  });
  each(def.discs, (d, m) => b.disc(d.surface ?? "plastic", color2(d.color), m(d.at), m(d.face), d.r, d.depth));
  each(def.seats, (s, m) => seat(b, color2, { ...s, at: m(s.at) }));
  for (const sw of def.switches) {
    const [right, up] = across$1(sw.face);
    const f = norm(sw.face);
    for (let i = 0; i < sw.count; i++) {
      const at = add(sw.at, mul(right, (i - (sw.count - 1) / 2) * sw.gap));
      b.disc("metal", color2("steel"), add(at, mul(f, 6e-3)), f, 8e-3, 6e-3, 10);
      const tip = add(add(at, mul(f, 0.03)), mul(up, i % 2 ? 0.012 : -0.012));
      b.tube("metal", color2("steel"), [add(at, mul(f, 4e-3)), tip], 35e-4, 0, false, 6);
    }
  }
  const needles = [];
  each(def.gauges, (g, m) => {
    const at = m(g.at);
    const f = norm(m(g.face));
    const [right, up] = across$1(f);
    b.disc("plastic", color2("dash"), add(at, mul(f, 0.012)), f, g.r * 1.18, 0.03, 24);
    b.disc("plastic", [0.02, 0.02, 0.022], add(at, mul(f, 0.014)), f, g.r, 4e-3, 24);
    const ticks = 10;
    for (let i = 0; i <= ticks; i++) {
      const ang = needleAngle(i / ticks);
      const dir = add(mul(up, Math.cos(ang)), mul(right, Math.sin(ang)));
      const major = i % 5 === 0;
      const a = add(add(at, mul(f, 0.0155)), mul(dir, g.r * (major ? 0.68 : 0.78)));
      const z = add(add(at, mul(f, 0.0155)), mul(dir, g.r * 0.92));
      b.strap("plastic", [0.92, 0.9, 0.84], a, z, major ? 5e-3 : 3e-3, 15e-4, f);
    }
    if (!g.needle) return;
    const nb = new Builder();
    const front = add(at, mul(f, 0.019));
    nb.strap("plastic", [0.95, 0.38, 0.1], sub(front, mul(up, g.r * 0.18)), add(front, mul(up, g.r * 0.85)), 4e-3, 2e-3, f);
    nb.disc("metal", color2("steel"), add(front, mul(f, 3e-3)), f, g.r * 0.12, 6e-3, 12);
    needles.push({ origin: at, axis: f, groups: centred(nb.groups, at), drive: g.needle, max: g.max ?? 20 });
  });
  let wheel = null;
  const w = def.wheel;
  if (w) {
    const toward = norm(w.toward);
    const [right, up] = across$1(toward);
    const wb = new Builder();
    const rim = [];
    for (let i = 0; i < 32; i++) {
      const a = i / 32 * Math.PI * 2;
      rim.push(add(w.at, add(mul(right, Math.cos(a) * w.r), mul(up, Math.sin(a) * w.r))));
    }
    wb.tube("plastic", color2("rubber"), rim, w.grip, 0, true, 12);
    const hub = sub(w.at, mul(toward, 0.03));
    for (const a of w.spokes) {
      const dir = add(mul(up, Math.cos(a)), mul(right, Math.sin(a)));
      wb.tube("metal", color2("steel"), [add(hub, mul(dir, 0.04)), add(w.at, mul(dir, w.r - w.grip * 0.5))], 9e-3, 0, false, 8);
    }
    wb.disc("plastic", color2("rubber"), add(hub, mul(toward, 0.025)), toward, 0.05, 0.05, 20);
    wb.disc("metal", color2("steel"), add(hub, mul(toward, 0.03)), toward, 0.022, 6e-3, 16);
    wheel = { origin: w.at, axis: toward, groups: centred(wb.groups, w.at), lock: w.lock };
    b.tube("plastic", color2("dash"), [sub(hub, mul(toward, 0.02)), sub(w.at, mul(toward, w.column))], 0.022, 0, false, 12);
  }
  return { groups: b.groups, wheel, needles };
}
function seat(b, color2, s) {
  const w = s.width ?? 0.46;
  const depth = s.depth ?? 0.42;
  const c = s.at;
  const bu = [0, Math.cos(s.recline), -Math.sin(s.recline)];
  const bf = [0, Math.sin(s.recline), Math.cos(s.recline)];
  const backAxes = [[1, 0, 0], bu, bf];
  const flat = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const at = (x, upBy, fwd) => add(c, add(add([x, 0, 0], mul(bu, upBy)), mul(bf, fwd)));
  const seatCol = color2("seat");
  const bolster = color2("bolster");
  b.box("fabric", seatCol, add(c, [0, -0.035, depth / 2]), [w / 2 - 0.04, 0.045, depth / 2], flat, 0.035);
  for (const x of [-1, 1]) b.box("fabric", bolster, add(c, [x * (w / 2 - 0.04), -0.01, depth / 2 - 0.01]), [0.045, 0.06, depth / 2 - 0.01], flat, 0.035, 1);
  b.box("fabric", seatCol, at(0, 0.27, -0.045), [w / 2 - 0.04, 0.27, 0.045], backAxes, 0.035);
  for (const x of [-1, 1]) b.box("fabric", bolster, at(x * (w / 2 - 0.045), 0.23, -0.02), [0.045, 0.23, 0.075], backAxes, 0.035, 1);
  b.box("fabric", seatCol, at(0, 0.62, -0.05), [0.14, 0.1, 0.045], backAxes, 0.04, 1);
  b.box("plastic", color2("shell"), add(c, [0, -0.13, depth / 2 - 0.02]), [w / 2 - 0.06, 0.06, depth / 2 - 0.04], flat, 0.02, 1);
  if (!s.harness) return;
  const strapCol = color2("strap");
  const buckle = add(c, [0, 0.03, depth * 0.38]);
  for (const x of [-1, 1]) {
    const over = at(x * 0.075, 0.54, -0.1);
    const top = at(x * 0.075, 0.54, 8e-3);
    const chest = at(x * 0.085, 0.2, 0.02);
    b.strap("fabric", strapCol, over, top, 0.045, 6e-3, bu);
    b.strap("fabric", strapCol, top, chest, 0.045, 6e-3, bf);
    b.strap("fabric", strapCol, chest, add(buckle, [x * 0.03, 0.01, -0.02]), 0.045, 6e-3, norm(add(bf, [0, 0.6, 0])));
    b.strap("fabric", strapCol, add(c, [x * (w / 2 - 0.08), 0.03, 0.05]), add(buckle, [x * 0.035, 0, 0]), 0.045, 6e-3, [0, 1, 0]);
  }
  b.strap("fabric", strapCol, add(c, [0, 0.012, depth * 0.85]), buckle, 0.04, 6e-3, [0, 1, 0]);
  b.box("metal", color2("buckle"), add(buckle, [0, 8e-3, 0]), [0.035, 8e-3, 0.035], flat, 8e-3, 1);
}
function partitionByBox(indices, positions, boxes, toBox) {
  const list = typeof boxes[0][0] === "number" ? [boxes] : boxes;
  const n = positions.length / 3;
  const inside = new Uint32Array(n);
  const p = new Vector3();
  for (let v = 0; v < n; v++) {
    p.set(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
    const q = toBox(p);
    list.forEach(([lo, hi], b) => {
      if (q.x >= lo[0] && q.x <= hi[0] && q.y >= lo[1] && q.y <= hi[1] && q.z >= lo[2] && q.z <= hi[2]) inside[v] |= 1 << b;
    });
  }
  const out = [];
  const hidden = [];
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]];
    (inside[a] & inside[b] & inside[c] ? hidden : out).push(a, b, c);
  }
  const all = new Uint32Array(out.length + hidden.length);
  all.set(out, 0);
  all.set(hidden, out.length);
  return { indices: all, outside: out.length };
}
const GEARS = [0, 4, 8, 12, 16, 20, 40];
class CockpitInterior {
  constructor(scene) {
    this.scene = scene;
  }
  scene;
  shown = null;
  /** Built cockpits by mount id, kept (disabled) once made. */
  built = /* @__PURE__ */ new Map();
  /** Body geometry already reordered, with the index count that is outside the boxes. */
  parted = /* @__PURE__ */ new WeakMap();
  materials = null;
  last = 0;
  /** Whether a cockpit is drawn now (for tests). */
  isShown() {
    return !!this.shown?.built.root.isEnabled();
  }
  /** The cockpit drawn now, for tests: its triangles, the wheel's turn and the needles' readings (0..1). */
  state() {
    const s = this.shown;
    if (!s) return null;
    const q = s.built.wheel?.node.rotationQuaternion;
    return { triangles: s.built.triangles, wheel: q ? 2 * Math.acos(Math.min(1, Math.abs(q.w))) : 0, needles: s.built.needles.map((n) => n.value), cut: s.cut.length > 0 };
  }
  /**
   * Called every frame: `index` / `root` / `def` are the vehicle you look out of in the cockpit view, or null;
   * `drive` turns the wheel and the needles.
   */
  update(index, root, def, drive = null) {
    const cockpit = def ? COCKPITS[def.id] : void 0;
    if (index === null || !root || !def || !cockpit) {
      this.clear();
      return;
    }
    if (this.shown && (this.shown.index !== index || this.shown.body.isDisposed())) this.clear();
    if (!this.shown) {
      const body = root.getChildTransformNodes(true, (n) => n.name === `${root.name}_gun`)[0];
      if (!body) return;
      const built = this.build(def.id, cockpit);
      built.root.parent = body;
      built.root.setEnabled(true);
      this.shown = { index, body, built, cut: [], cutDone: false };
    }
    if (!this.shown.cutDone) this.cutBody(this.shown, cockpit);
    this.animate(this.shown.built, drive);
  }
  animate(built, drive) {
    const now = performance.now();
    const dt = Math.min(0.1, Math.max(1e-3, (now - (this.last || now)) / 1e3));
    this.last = now;
    const steer = drive?.steer ?? 0;
    const speed = Math.abs(drive?.speed ?? 0);
    if (built.wheel) {
      const w = built.wheel;
      w.node.rotationQuaternion = Quaternion.RotationAxisToRef(w.axis, steer * w.lock, w.node.rotationQuaternion ?? new Quaternion());
    }
    for (const n of built.needles) {
      let want;
      if (n.drive === "speed") want = speed / n.max;
      else {
        let g = 1;
        while (g < GEARS.length - 1 && speed > GEARS[g]) g++;
        const lo = GEARS[g - 1];
        want = speed < 0.3 ? 0.12 : 0.25 + 0.7 * (speed - lo) / (GEARS[g] - lo);
      }
      n.value += (want - n.value) * Math.min(1, dt * 8);
      n.node.rotationQuaternion = Quaternion.RotationAxisToRef(n.axis, needleAngle(n.value), n.node.rotationQuaternion ?? new Quaternion());
    }
  }
  build(id, def) {
    const have = this.built.get(id);
    if (have && !have.root.isDisposed()) return have;
    const made = buildCockpit(def);
    const root = new TransformNode(`cockpit_${id}`, this.scene);
    let triangles = 0;
    const meshes = (groups2, parent, name) => {
      for (const [surface, g] of Object.entries(groups2)) {
        if (!g || !g.indices.length) continue;
        const mesh = new Mesh(`${name}_${surface}`, this.scene);
        const vd = new VertexData();
        vd.positions = g.positions;
        vd.normals = g.normals;
        vd.uvs = g.uvs;
        vd.colors = g.colors;
        vd.indices = g.indices;
        vd.applyToMesh(mesh);
        mesh.material = this.material(surface);
        mesh.parent = parent;
        mesh.isPickable = false;
        triangles += g.indices.length / 3;
      }
    };
    meshes(made.groups, root, `cockpit_${id}`);
    const turning = (t, name) => {
      const node = new TransformNode(name, this.scene);
      node.parent = root;
      node.position.set(t.origin[0], t.origin[1], t.origin[2]);
      node.rotationQuaternion = Quaternion.Identity();
      meshes(t.groups, node, name);
      return node;
    };
    const wheel = made.wheel ? { node: turning(made.wheel, `cockpit_${id}_wheel`), axis: new Vector3(...made.wheel.axis), lock: made.wheel.lock } : null;
    const needles = made.needles.map((n, i) => ({ node: turning(n, `cockpit_${id}_needle${i}`), axis: new Vector3(...n.axis), drive: n.drive, max: n.max, value: 0 }));
    const built = { root, wheel, needles, triangles };
    root.setEnabled(false);
    this.built.set(id, built);
    return built;
  }
  /** PBR surfaces over the parts' own (vertex) colours, with a little generated roughness variation. */
  material(surface) {
    if (!this.materials) {
      const grain = grainTexture(this.scene);
      const make = (name, roughness, metallic) => {
        const m = new PBRMaterial(`cockpit_${name}`, this.scene);
        m.albedoColor = Color3.White();
        m.roughness = roughness;
        m.metallic = metallic;
        m.metallicTexture = grain;
        m.useRoughnessFromMetallicTextureAlpha = false;
        m.useRoughnessFromMetallicTextureGreen = true;
        m.useMetallnessFromMetallicTextureBlue = true;
        return m;
      };
      this.materials = { paint: make("paint", 0.62, 0.1), fabric: make("fabric", 1, 0), plastic: make("plastic", 0.78, 0), metal: make("metal", 0.45, 0.85) };
    }
    return this.materials[surface];
  }
  cutBody(shown, def) {
    const model = shown.body.getChildTransformNodes(true).find((n) => n.name.endsWith("_model"));
    const bodies = model?.getChildMeshes(false).filter((m) => m instanceof Mesh && m.getTotalIndices() > 0 && !!m.geometry) ?? [];
    if (!bodies.length) return;
    shown.cutDone = true;
    const toMount = shown.body.computeWorldMatrix(true).clone().invert();
    const boxes = def.hide;
    for (const mesh of bodies) {
      const geometry = mesh.geometry;
      let outside = this.parted.get(geometry);
      if (outside === void 0) {
        const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
        const indices = mesh.getIndices();
        if (!positions || !indices) continue;
        const m = mesh.computeWorldMatrix(true).multiplyToRef(toMount, new Matrix());
        const q = new Vector3();
        const parted = partitionByBox(indices, positions, boxes, (p) => Vector3.TransformCoordinatesToRef(p, m, q));
        geometry.setIndices(parted.indices, mesh.getTotalVertices());
        outside = parted.outside;
        this.parted.set(geometry, outside);
      }
      const subMeshes = mesh.subMeshes;
      mesh.subMeshes = [];
      new SubMesh(0, 0, mesh.getTotalVertices(), 0, outside, mesh);
      shown.cut.push({ mesh, subMeshes });
    }
  }
  clear() {
    const s = this.shown;
    if (!s) return;
    this.shown = null;
    for (const { mesh, subMeshes } of s.cut) if (!mesh.isDisposed()) mesh.subMeshes = subMeshes;
    if (!s.built.root.isDisposed()) {
      s.built.root.setEnabled(false);
      s.built.root.parent = null;
    }
  }
}
function grainTexture(scene) {
  const n = 64;
  const px = new Uint8Array(n * n * 4);
  const lattice = (x, y) => {
    const h = Math.sin(x % 8 * 127.1 + y % 8 * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const gx = x / n * 8;
      const gy = y / n * 8;
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      const fx = gx - ix;
      const fy = gy - iy;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const a = lattice(ix, iy) + (lattice(ix + 1, iy) - lattice(ix, iy)) * sx;
      const b = lattice(ix, iy + 1) + (lattice(ix + 1, iy + 1) - lattice(ix, iy + 1)) * sx;
      const coarse = a + (b - a) * sy;
      const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const fine = h - Math.floor(h);
      const v = 0.78 + 0.16 * coarse + 0.06 * fine;
      const o = (y * n + x) * 4;
      px[o] = 255;
      px[o + 1] = Math.round(255 * Math.min(1, v));
      px[o + 2] = Math.round(255 * (0.85 + 0.15 * coarse));
      px[o + 3] = 255;
    }
  const tex = RawTexture.CreateRGBATexture(px, n, n, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  tex.name = "cockpit_grain";
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}
function createViewCamera(name, scene) {
  const camera = new FreeCamera(name, new Vector3(0, 10, -10), scene);
  camera.updateUpVectorFromRotation = true;
  return camera;
}
function poseCamera(camera, yaw, pitch, roll = 0) {
  camera.rotation.set(-pitch, yaw, roll);
}
const spare = /* @__PURE__ */ new WeakMap();
const materials$1 = /* @__PURE__ */ new WeakMap();
const MAX_SPARE = 32;
const MAX_SPARE_SCHEME = 12;
const spareKey = (kind, scheme) => kind * 64 + scheme;
function createCanopy(scene, name, kind, slot = 0) {
  const scheme = kind === CHUTE_GLIDER ? 0 : canopySchemeOf(slot);
  const reused = spare.get(scene)?.get(spareKey(kind, scheme))?.pop();
  if (reused) {
    reused.setEnabled(true);
    return reused;
  }
  return buildCanopy(scene, name, kind, scheme);
}
function canopySchemeOf(slot) {
  return (Math.trunc(slot) % SCHEMES.length + SCHEMES.length) % SCHEMES.length;
}
function releaseCanopy(scene, node, kind) {
  let byKind = spare.get(scene);
  if (!byKind) spare.set(scene, byKind = /* @__PURE__ */ new Map());
  const scheme = node.metadata?.scheme;
  const key = spareKey(kind, scheme ?? 0);
  let list = byKind.get(key);
  if (!list) byKind.set(key, list = []);
  if (list.length >= (scheme === void 0 ? MAX_SPARE : MAX_SPARE_SCHEME) || node.isDisposed()) {
    node.dispose(false, false);
    return;
  }
  node.setEnabled(false);
  list.push(node);
}
function buildCanopy(scene, name, kind, scheme) {
  const root = new TransformNode(name, scene);
  let mats = materials$1.get(scene);
  if (!mats) materials$1.set(scene, mats = /* @__PURE__ */ new Map());
  const mat2 = (key, hex) => {
    let m = mats.get(key);
    if (m) return m;
    m = new StandardMaterial(`canopy_${key}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.1, 0.1, 0.1);
    m.backFaceCulling = false;
    mats.set(key, m);
    return m;
  };
  const rig = new Color4(0.15, 0.15, 0.15, 1);
  if (kind === CHUTE_GLIDER) {
    const wing = CreateCylinder(`${name}_wing`, { diameter: 6.4, height: 0.06, tessellation: 3 }, scene);
    wing.parent = root;
    wing.rotation.y = -Math.PI / 2;
    wing.position.set(0, 2.9, -0.4);
    wing.scaling.set(1, 1, 0.75);
    wing.material = mat2("wing", "#e2703a");
    const keel = CreateCylinder(`${name}_keel`, { diameter: 0.08, height: 3.4, tessellation: 6 }, scene);
    keel.parent = root;
    keel.rotation.x = Math.PI / 2;
    keel.position.set(0, 2.85, -0.4);
    keel.material = mat2("keel", "#2a2d33");
    const lines = CreateLineSystem(`${name}_frame`, {
      lines: [
        [new Vector3(-0.55, 1.6, 0.35), new Vector3(0.55, 1.6, 0.35)],
        [new Vector3(-0.55, 1.6, 0.35), new Vector3(0, 2.85, 0.2)],
        [new Vector3(0.55, 1.6, 0.35), new Vector3(0, 2.85, 0.2)]
      ],
      colors: [[rig, rig], [rig, rig], [rig, rig]]
    }, scene);
    lines.parent = root;
  } else {
    const hang = new TransformNode(`${name}_rig`, scene);
    hang.parent = root;
    hang.position.set(0, HARNESS.up, -HARNESS.back);
    const shape = parachuteShape();
    const fabric = new Mesh(`${name}_dome`, scene);
    parachuteFabric(scheme).applyToMesh(fabric);
    fabric.parent = hang;
    let cloth = mats.get("fabric");
    if (!cloth) {
      cloth = new StandardMaterial("canopy_fabric", scene);
      cloth.diffuseColor = Color3.White();
      cloth.specularColor = new Color3(0.06, 0.06, 0.06);
      cloth.emissiveColor = new Color3(0.16, 0.16, 0.16);
      mats.set("fabric", cloth);
    }
    fabric.material = cloth;
    const rigging = CreateLineSystem(`${name}_lines`, { lines: shape.lines, colors: shape.lines.map(() => [LINE, LINE]) }, scene);
    rigging.parent = hang;
    root.metadata = { rig: hang, scheme };
  }
  for (const m of root.getChildMeshes()) m.isPickable = false;
  return root;
}
const HARNESS = { up: 1.48, back: 0.17 };
function canopyHarness({ box, scale }) {
  const { head, torso } = box.stand;
  if (!head || !torso) return { up: HARNESS.up * scale, back: HARNESS.back * scale };
  const up = (torso.b[0] + Math.max(torso.b[0], head.y - head.r)) / 2;
  const back = torso.r + 0.05 - Math.min(torso.b[1], head.z);
  return { up: up * scale, back: Math.max(0.08, back) * scale };
}
function placeCanopy(node, pos, yaw, now, seed, harness = HARNESS) {
  node.position.set(pos.x, pos.y, pos.z);
  const rig = node.metadata?.rig;
  if (!rig) {
    node.rotation.set(Math.sin(now / 900 + seed * 1.7) * 0.04, yaw, Math.sin(now / 700 + seed) * 0.06);
    return;
  }
  node.rotation.set(0, yaw, 0);
  rig.position.set(0, harness.up, -harness.back);
  const calm = reduceFlashing() ? 0.5 : 1;
  rig.rotation.set(Math.sin(now / 1400 + seed * 1.7) * 0.035 * calm, Math.sin(now / 2600 + seed * 0.9) * 0.05 * calm, Math.sin(now / 1100 + seed) * 0.05 * calm);
  const breath = Math.sin(now / 950 + seed * 2.3) * 0.012 * calm;
  rig.scaling.set(1 + breath, 1 - breath * 0.6, 1 + breath);
}
const LINE = new Color4(0.17, 0.17, 0.19, 1);
const GORES = 16;
const RADIUS = 2.8;
const CROWN = 1.5;
const SKIRT_UP = 3.7;
const RINGS = [0.086, 0.5, 0.88, 1.22, 1.5, 1.72];
const ACROSS = [1, 1, 1, 2, 4];
const BILLOW = [0, 0, 0, 0, 0.09, 0.15];
const SCALLOP = 0.24;
const SCHEMES = [
  // Sunset: orange-red and cream under navy.
  ["#e8552b", "#f4ecd9", "#23375c", "#3a2a26"],
  // Harbour: deep navy and white under amber.
  ["#22386b", "#f1f1ec", "#e0962e", "#141c33"],
  // Field: olive and sand under dark olive.
  ["#6b7a3a", "#dccb9c", "#39411f", "#2c3018"],
  // Hazard: yellow and black under black.
  ["#f0c22e", "#27282c", "#27282c", "#141416"],
  // Lagoon: teal and white under deep teal.
  ["#1f9a94", "#f2f4ef", "#0f5458", "#0c3a3d"],
  // Regal: purple and gold under dark purple.
  ["#6d3fa0", "#e8b93c", "#38205a", "#2a1845"],
  // Plain: white and pale grey under slate.
  ["#f4f2eb", "#d9d8d2", "#7d8792", "#8a8d93"],
  // Kite: orange and blue under cream.
  ["#ef8a2a", "#2d63b0", "#f4ecd9", "#2a2523"]
].map((hexes) => hexes.map((h) => Color3.FromHexString(h)));
const PANEL_A = 0;
const CROWN_PART = 2;
const SEAM_PART = 3;
const WEBBING_PART = 4;
const WEBBING = Color3.FromHexString("#2a2d33");
const INSIDE = 0.7;
const LINK = { x: 0.34, y: 0.85, front: 0.02, back: -0.26 };
let parachute;
const fabrics = [];
function parachuteShape() {
  if (parachute) return parachute;
  const positions = [];
  const normals = [];
  const parts = [];
  const shades = [];
  const indices = [];
  const vert = (p, n, part, shade = 1) => {
    positions.push(p.x, p.y, p.z);
    normals.push(n.x, n.y, n.z);
    parts.push(part);
    shades.push(shade);
    return positions.length / 3 - 1;
  };
  const tri = (a, b, c, out) => {
    const at2 = (i) => new Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    const [pa, pb, pc] = [at2(a), at2(b), at2(c)];
    const face = Vector3.Cross(pb.subtract(pa), pc.subtract(pa));
    if (Vector3.Dot(face, out) > 0) indices.push(a, c, b);
    else indices.push(a, b, c);
  };
  const seamAt = (gore, ring) => {
    const a = (gore + 0.5) / GORES * Math.PI * 2;
    const r = RADIUS * Math.sin(RINGS[ring]);
    return new Vector3(Math.sin(a) * r, SKIRT_UP + CROWN * Math.cos(RINGS[ring]), Math.cos(a) * r);
  };
  const at = (gore, ring, u) => {
    const p = Vector3.Lerp(seamAt(gore, ring), seamAt(gore + 1, ring), u);
    const bow = ring === RINGS.length - 1 ? 4 * u * (1 - u) : 1 - Math.abs(2 * u - 1);
    const out = BILLOW[ring] * bow;
    const flat = Math.hypot(p.x, p.z) || 1;
    p.x += p.x / flat * out;
    p.z += p.z / flat * out;
    if (ring === RINGS.length - 1) p.y += SCALLOP * bow;
    return p;
  };
  const key = (p) => `${Math.round(p.x * 500)},${Math.round(p.y * 500)},${Math.round(p.z * 500)}`;
  const smooth = /* @__PURE__ */ new Map();
  const quads = [];
  for (let gore = 0; gore < GORES; gore++) {
    for (let band = 0; band < ACROSS.length; band++) {
      const n = ACROSS[band];
      for (let k = 0; k < n; k++) {
        const corners = [at(gore, band, k / n), at(gore, band, (k + 1) / n), at(gore, band + 1, (k + 1) / n), at(gore, band + 1, k / n)];
        quads.push({ corners, gore, band });
        const up = new Vector3(corners[0].x + corners[2].x, 0.6, corners[0].z + corners[2].z);
        for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
          const face = Vector3.Cross(corners[b].subtract(corners[a]), corners[c].subtract(corners[a]));
          if (Vector3.Dot(face, up) < 0) face.scaleInPlace(-1);
          for (const i of [a, b, c]) {
            const sum = smooth.get(key(corners[i]));
            if (sum) sum.addInPlace(face);
            else smooth.set(key(corners[i]), face.clone());
          }
        }
      }
    }
  }
  for (const n of smooth.values()) n.normalize();
  const normalAt = (p) => smooth.get(key(p));
  for (const { corners, gore, band } of quads) {
    const color2 = band === 0 ? CROWN_PART : PANEL_A + gore % 2;
    for (const side of [1, -1]) {
      const v = corners.map((p) => vert(p, normalAt(p).scale(side), color2, side > 0 ? 1 : INSIDE));
      const out = normalAt(corners[0]).add(normalAt(corners[2])).scale(side);
      tri(v[0], v[1], v[2], out);
      tri(v[0], v[2], v[3], out);
    }
  }
  for (let gore = 0; gore < GORES; gore++) {
    const a = (gore + 0.5) / GORES * Math.PI * 2;
    const across2 = new Vector3(Math.cos(a), 0, -Math.sin(a)).scale(0.028);
    let last;
    for (let ring = 0; ring < RINGS.length; ring++) {
      const p = seamAt(gore, ring);
      const n = normalAt(p);
      const mid = p.add(n.scale(0.012));
      const pair = [vert(mid.subtract(across2), n, SEAM_PART), vert(mid.add(across2), n, SEAM_PART)];
      if (last) {
        tri(last[0], last[1], pair[1], n);
        tri(last[0], pair[1], pair[0], n);
      }
      last = pair;
    }
  }
  const links = [-1, 1].flatMap((side) => [LINK.front, LINK.back].map((z) => new Vector3(side * LINK.x, LINK.y, z)));
  const prism = (from, to, wide, sides) => {
    const along = to.subtract(from).normalize();
    const u = Vector3.Cross(along, Math.abs(along.y) > 0.9 ? Vector3.Right() : Vector3.Up()).normalize();
    const w = Vector3.Cross(along, u);
    const ring = (p, n) => vert(p.add(n.scale(wide)), n, WEBBING_PART);
    for (let i = 0; i < sides; i++) {
      const [a0, a1] = [i / sides * Math.PI * 2, (i + 1) / sides * Math.PI * 2];
      const [n0, n1] = [a0, a1].map((t) => u.scale(Math.cos(t)).add(w.scale(Math.sin(t))));
      const out = n0.add(n1);
      const v = [ring(from, n0), ring(from, n1), ring(to, n1), ring(to, n0)];
      tri(v[0], v[1], v[2], out);
      tri(v[0], v[2], v[3], out);
    }
  };
  for (const link of links) prism(new Vector3(Math.sign(link.x) * 0.05, 0, 0), link, 0.012, 3);
  prism(new Vector3(-0.09, 0, 0), new Vector3(0.09, 0, 0), 0.03, 4);
  const fabric = { positions, normals, indices, parts, shades };
  const lines = [];
  for (let gore = 0; gore < GORES; gore++) {
    const hem = seamAt(gore, RINGS.length - 1);
    const link = links.find((l) => Math.sign(l.x) === Math.sign(hem.x) && l.z === LINK.front === hem.z > 0);
    lines.push([link, hem]);
  }
  parachute = { fabric, lines };
  return parachute;
}
function parachuteFabric(scheme) {
  const made = fabrics[scheme];
  if (made) return made;
  const { fabric } = parachuteShape();
  const colours = SCHEMES[scheme] ?? SCHEMES[0];
  const colors = [];
  for (let i = 0; i < fabric.parts.length; i++) {
    const c = colours[fabric.parts[i]] ?? WEBBING;
    const shade = fabric.shades[i];
    colors.push(c.r * shade, c.g * shade, c.b * shade, 1);
  }
  const data = new VertexData();
  data.positions = fabric.positions;
  data.normals = fabric.normals;
  data.indices = fabric.indices;
  data.colors = colors;
  fabrics[scheme] = data;
  return data;
}
const materials = /* @__PURE__ */ new WeakMap();
function mat(scene, hex, emissive = 0, alpha = 1) {
  let byKey = materials.get(scene);
  if (!byKey) materials.set(scene, byKey = /* @__PURE__ */ new Map());
  const key = `${hex}|${emissive}|${alpha}`;
  let m = byKey.get(key);
  if (!m) {
    m = new StandardMaterial(`arsenal_${key}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.2, 0.2, 0.2);
    if (emissive) m.emissiveColor = Color3.FromHexString(hex).scale(emissive);
    if (alpha < 1) {
      m.alpha = alpha;
      m.backFaceCulling = false;
    }
    byKey.set(key, m);
  }
  return m;
}
const SHEEP_LIFT = 0.4;
const ARSENAL_LOOKS = /* @__PURE__ */ new Set(["bubble", "goo", "oil", "flame", "disc", "nail", "flare", "swarm", "vortex", "shard", "sticky", "molotov", "gas", "bolt", "holy", "banana", "sheep", "bomblet", "bomb", "sandbag", "spear", "dynamite", "flareShot"]);
function createArsenalProjectile(scene, id, look) {
  const node = new TransformNode(`proj_${id}`, scene);
  const add2 = (m) => {
    m.parent = node;
    m.isPickable = false;
    return m;
  };
  switch (look) {
    case "bubble": {
      add2(CreateSphere(`bubble_${id}`, { diameter: 0.55, segments: 10 }, scene)).material = mat(scene, "#7dff6a", 0.5, 0.45);
      const core = add2(CreateSphere(`bubbleCore_${id}`, { diameter: 0.18, segments: 6 }, scene));
      core.material = mat(scene, "#c8ff40", 1);
      core.position.set(0.1, 0.1, 0);
      break;
    }
    case "goo":
      add2(CreateSphere(`goo_${id}`, { diameter: 0.28, segments: 8 }, scene)).material = mat(scene, "#ff5ac8", 0.5);
      break;
    case "oil":
      add2(CreateSphere(`oil_${id}`, { diameter: 0.26, segments: 8 }, scene)).material = mat(scene, "#2a2218", 0.05);
      break;
    case "flame":
      add2(CreateSphere(`flame_${id}`, { diameter: 0.35, segments: 6 }, scene)).material = mat(scene, "#ff8a2a", 1, 0.7);
      break;
    case "disc": {
      const d = add2(CreateCylinder(`disc_${id}`, { diameter: 0.5, height: 0.08, tessellation: 18 }, scene));
      d.material = mat(scene, "#7ad6ff", 0.9);
      add2(CreateTorus(`discRim_${id}`, { diameter: 0.52, thickness: 0.05, tessellation: 18 }, scene)).material = mat(scene, "#e8f8ff", 1);
      break;
    }
    case "spear": {
      const shaft = add2(CreateCylinder(`spear_${id}`, { diameter: 0.035, height: 1.5, tessellation: 6 }, scene));
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = -0.45;
      shaft.material = mat(scene, "#8a6238");
      const head = add2(CreateCylinder(`spearHead_${id}`, { diameterTop: 0, diameterBottom: 0.07, height: 0.24, tessellation: 4 }, scene));
      head.rotation.x = Math.PI / 2;
      head.position.z = 0.4;
      head.material = mat(scene, "#a7adb4", 0.1);
      break;
    }
    case "nail": {
      const n = add2(CreateCylinder(`nail_${id}`, { diameter: 0.03, height: 0.22, tessellation: 5 }, scene));
      n.rotation.x = Math.PI / 2;
      n.material = mat(scene, "#d8d8d8", 0.3);
      break;
    }
    case "flare":
      add2(CreateSphere(`flare_${id}`, { diameter: 0.16, segments: 6 }, scene)).material = mat(scene, "#ff4a2a", 1.2);
      add2(CreateSphere(`flareHalo_${id}`, { diameter: 0.5, segments: 6 }, scene)).material = mat(scene, "#ff7a3a", 0.8, 0.3);
      break;
    case "flareShot":
      add2(CreateSphere(`flareShot_${id}`, { diameter: 0.12, segments: 6 }, scene)).material = mat(scene, "#fff1c8", 1.4);
      add2(CreateSphere(`flareShotHalo_${id}`, { diameter: 0.55, segments: 6 }, scene)).material = mat(scene, "#ff3a1e", 0.9, 0.28);
      break;
    case "swarm": {
      const body = add2(CreateCylinder(`swarm_${id}`, { diameter: 0.08, height: 0.32, tessellation: 8 }, scene));
      body.rotation.x = Math.PI / 2;
      body.material = mat(scene, "#d0d4c0");
      const f = add2(CreateSphere(`swarmFlame_${id}`, { diameter: 0.14, segments: 6 }, scene));
      f.position.z = -0.2;
      f.scaling.z = 2;
      f.material = mat(scene, "#ffb347", 1);
      break;
    }
    case "vortex":
      add2(CreateSphere(`vortex_${id}`, { diameter: 0.45, segments: 10 }, scene)).material = mat(scene, "#1a0830", 0.2);
      add2(CreateTorus(`vortexRing_${id}`, { diameter: 0.75, thickness: 0.06, tessellation: 24 }, scene)).material = mat(scene, "#b07aff", 1.2);
      break;
    case "shard":
      add2(CreateSphere(`shard_${id}`, { diameter: 0.09, segments: 4 }, scene)).material = mat(scene, "#ffcf6a", 1.2);
      break;
    case "sticky": {
      add2(CreateSphere(`sticky_${id}`, { diameter: 0.2, segments: 8 }, scene)).material = mat(scene, "#5ad24a", 0.3);
      const l = add2(CreateSphere(`sticky_${id}_light`, { diameter: 0.07, segments: 6 }, scene));
      l.position.y = 0.1;
      l.material = mat(scene, "#ff3b3b", 1.2);
      break;
    }
    case "dynamite": {
      const b = add2(CreateCylinder(`dynamite_${id}`, { diameter: 0.08, height: 0.28, tessellation: 8 }, scene));
      b.material = mat(scene, "#b3261e", 0.15);
      const fuse = add2(CreateCylinder(`dynamiteFuse_${id}`, { diameter: 0.012, height: 0.1, tessellation: 4 }, scene));
      fuse.position.y = 0.18;
      fuse.material = mat(scene, "#d9cfae");
      const spark = add2(CreateSphere(`dynamite_${id}_light`, { diameter: 0.06, segments: 4 }, scene));
      spark.position.y = 0.24;
      spark.material = mat(scene, "#ffd24a", 1.4);
      break;
    }
    case "molotov": {
      const b = add2(CreateCylinder(`molotov_${id}`, { diameter: 0.1, height: 0.26, tessellation: 8 }, scene));
      b.material = mat(scene, "#7a5a2a", 0.1, 0.85);
      const f = add2(CreateSphere(`molotovRag_${id}`, { diameter: 0.1, segments: 6 }, scene));
      f.position.y = 0.17;
      f.material = mat(scene, "#ff8a2a", 1);
      break;
    }
    case "gas": {
      const c = add2(CreateCylinder(`gas_${id}`, { diameter: 0.12, height: 0.24, tessellation: 10 }, scene));
      c.material = mat(scene, "#6a7a5a", 0.1);
      const band = add2(CreateCylinder(`gasBand_${id}`, { diameter: 0.125, height: 0.04, tessellation: 10 }, scene));
      band.material = mat(scene, "#c8ff40", 0.8);
      break;
    }
    case "holy": {
      add2(CreateSphere(`holy_${id}`, { diameter: 0.34, segments: 12 }, scene)).material = mat(scene, "#ffd24a", 0.6);
      const v = add2(CreateCylinder(`holyV_${id}`, { diameter: 0.04, height: 0.22, tessellation: 6 }, scene));
      v.position.y = 0.25;
      v.material = mat(scene, "#fff2b0", 0.8);
      const h = add2(CreateCylinder(`holyH_${id}`, { diameter: 0.04, height: 0.14, tessellation: 6 }, scene));
      h.position.y = 0.28;
      h.rotation.z = Math.PI / 2;
      h.material = mat(scene, "#fff2b0", 0.8);
      break;
    }
    case "banana": {
      for (const [i, a] of [-0.5, 0, 0.5].entries()) {
        const b = add2(CreateCylinder(`banana_${id}_${i}`, { diameterTop: 0.03, diameterBottom: 0.08, height: 0.3, tessellation: 8 }, scene));
        b.rotation.z = a;
        b.position.x = a * 0.12;
        b.material = mat(scene, "#f5d33a", 0.2);
      }
      break;
    }
    case "sheep": {
      const fleece = add2(CreateSphere(`sheep_${id}`, { diameter: 0.6, segments: 8 }, scene));
      fleece.position.y = SHEEP_LIFT;
      fleece.material = mat(scene, "#f4f2ea");
      const head = add2(CreateSphere(`sheepHead_${id}`, { diameter: 0.26, segments: 8 }, scene));
      head.position.set(0, SHEEP_LIFT + 0.12, 0.34);
      head.material = mat(scene, "#22201e");
      for (const [x, z] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) {
        const leg = add2(CreateCylinder(`sheepLeg_${id}_${x}_${z}`, { diameter: 0.06, height: 0.24, tessellation: 6 }, scene));
        leg.position.set(x, SHEEP_LIFT - 0.28, z);
        leg.material = mat(scene, "#22201e");
      }
      break;
    }
    case "bomblet":
      add2(CreateSphere(`bomblet_${id}`, { diameter: 0.14, segments: 6 }, scene)).material = mat(scene, "#2a2d33", 0.1);
      break;
    case "sandbag":
      add2(CreateCylinder(`sandbag_${id}`, { diameter: 0.32, height: 0.55, tessellation: 8 }, scene)).material = mat(scene, "#b39b6b");
      break;
    case "bomb": {
      const b = add2(CreateCylinder(`bomb_${id}`, { diameterTop: 0.3, diameterBottom: 0.12, height: 0.7, tessellation: 10 }, scene));
      b.material = mat(scene, "#4a5340");
      const fin = add2(CreateCylinder(`bombFin_${id}`, { diameter: 0.34, height: 0.04, tessellation: 4 }, scene));
      fin.position.y = 0.36;
      fin.material = mat(scene, "#3a3f30");
      break;
    }
    case "bolt":
    default:
      add2(CreateSphere(`bolt_${id}`, { diameter: 0.18, segments: 6 }, scene)).material = mat(scene, "#c69bff", 1);
  }
  return node;
}
function animateArsenalProjectile(node, look, now, moved, born) {
  const along = () => {
    if (moved.lengthSquared() > 1e-6) node.lookAt(node.position.add(moved));
  };
  switch (look) {
    case "bubble":
      node.scaling.set(1 + Math.sin(now * 0.012) * 0.08, 1 + Math.cos(now * 0.014) * 0.08, 1);
      break;
    case "flame":
      node.scaling.setAll(Math.min(3, 1 + (now - born) / 200));
      break;
    case "disc":
      node.rotation.y += moved.lengthSquared() > 1e-6 ? 0.6 : 0.03;
      break;
    case "vortex":
      node.rotation.y += 0.25;
      node.rotation.x = 0.4;
      break;
    case "nail":
    case "swarm":
    // A spear points along its flight and keeps its last heading where it sticks.
    case "spear":
      along();
      break;
    case "sticky": {
      const light = node.getChildMeshes().find((m) => m.name.endsWith("_light"));
      if (light) {
        const blink = indicator(now / 1e3, 1e3 / 320);
        light.setEnabled(blink.on);
        light.visibility = blink.level;
      }
      break;
    }
    case "molotov":
    case "gas":
    case "dynamite": {
      node.rotation.x += 0.2;
      const spark = node.getChildMeshes().find((m) => m.name.endsWith("_light"));
      spark?.scaling.setAll(0.6 + Math.abs(Math.sin(now * 0.05)) * 0.9);
      break;
    }
    case "banana":
    case "holy":
      node.rotation.x += 0.25;
      break;
    case "sheep":
      const walking = moved.x * moved.x + moved.z * moved.z > 1e-6;
      if (walking) node.rotation.y = Math.atan2(moved.x, moved.z);
      const clips = node.getChildren((c) => !!c.metadata?.clips, true)[0]?.metadata?.clips;
      if (clips) {
        for (const g of clips) if (walking && !g.isPlaying) g.start(true);
        else if (!walking && g.isPlaying) g.pause();
      } else node.rotation.z = Math.sin(now * 0.03) * 0.12;
      break;
  }
}
const SMOKE_PUFFS = (() => {
  const out = [[0, 0, 0, 1.7]];
  let seed = 7;
  const rnd2 = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  for (let i = 0; i < 21; i++) {
    const a = rnd2() * Math.PI * 2;
    const r = 0.2 + 0.55 * Math.sqrt(rnd2());
    out.push([Math.cos(a) * r, (rnd2() - 0.4) * 0.6, Math.sin(a) * r, 1 + rnd2() * 0.6]);
  }
  return out;
})();
function smokeTexture(scene) {
  const cached = puffTextures.get(scene);
  if (cached) return cached;
  const tex = new DynamicTexture("smokePuff", { width: 64, height: 64 }, scene, true);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 64, 64);
  let seed = 3;
  const rnd2 = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  for (let i = 0; i < 14; i++) {
    const r = i === 0 ? 30 : 10 + rnd2() * 12;
    const a = rnd2() * Math.PI * 2;
    const d = i === 0 ? 0 : 6 + rnd2() * 14;
    const x = 32 + Math.cos(a) * d;
    const y = 32 + Math.sin(a) * d;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${i === 0 ? 0.8 : 0.45})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  tex.hasAlpha = true;
  tex.update();
  puffTextures.set(scene, tex);
  return tex;
}
const puffTextures = /* @__PURE__ */ new WeakMap();
function smokeMaterial(scene) {
  let byKey = materials.get(scene);
  if (!byKey) materials.set(scene, byKey = /* @__PURE__ */ new Map());
  let m = byKey.get("smoke");
  if (!m) {
    m = new StandardMaterial("arsenal_smoke", scene);
    const hemi = scene.getLightByName("hemi");
    const light = Math.max(0.35, Math.min(1, hemi?.intensity ?? 0.8));
    m.disableLighting = true;
    m.emissiveColor = Color3.FromHexString("#8a8e93").scale(light);
    m.diffuseTexture = smokeTexture(scene);
    m.useAlphaFromDiffuseTexture = true;
    m.backFaceCulling = false;
    m.disableDepthWrite = true;
    byKey.set("smoke", m);
  }
  return m;
}
class ZoneVisuals {
  constructor(scene) {
    this.scene = scene;
  }
  scene;
  zones = /* @__PURE__ */ new Map();
  /** Pack fires on burning patches (content/vfx.json map.lasting `fire.zone`); the plain tongues show where none is drawn. */
  lasting = null;
  apply(list, now) {
    const seen = /* @__PURE__ */ new Set();
    for (const z of list ?? []) {
      const kind = ZONE_KINDS[z[0]] ?? "fire";
      const key = `${z[1].toFixed(1)}:${z[2].toFixed(1)}:${z[3].toFixed(1)}`;
      seen.add(key);
      let m = this.zones.get(key);
      if (m && m.kind !== kind) {
        m.root.dispose();
        m = void 0;
      }
      if (!m) {
        m = this.create(kind, z[4]);
        m.root.position.set(z[1], z[2], z[3]);
        this.zones.set(key, m);
      }
      if (m.kind === "smoke") {
        if (z[4] > 0) m.radius = z[4];
        m.left = z[5];
      }
      const fade = Math.min(1, z[5]);
      if (m.kind === "fire" && this.lasting) this.burn(key, m, fade);
      if (m.kind === "toxic" && this.lasting) {
        const id = `zone:${key}`;
        const p = m.root.position;
        this.lasting.want(id, "cloud.toxic", { x: p.x, y: p.y + 0.1, z: p.z }, { size: m.radius, level: fade });
        for (const c of m.root.getChildMeshes()) c.visibility = this.lasting.drawn(id) ? 0.45 : 1;
      }
      this.animate(m, now, fade);
    }
    for (const [key, m] of this.zones) {
      if (!seen.has(key)) {
        m.root.dispose();
        this.zones.delete(key);
      }
    }
  }
  create(kind, radius) {
    const scene = this.scene;
    const root = new TransformNode(`zone_${kind}`, scene);
    const disc = (name, r, m, y = 0.04) => {
      const d = CreateDisc(name, { radius: r, tessellation: 32 }, scene);
      d.rotation.x = Math.PI / 2;
      d.position.y = y;
      d.material = m;
      d.parent = root;
      d.isPickable = false;
      return d;
    };
    switch (kind) {
      case "oil":
        disc("oil", radius, mat(scene, "#1c1810", 0.02, 0.9));
        disc("oilSheen", radius * 0.6, mat(scene, "#4a3a6a", 0.15, 0.35), 0.05);
        break;
      case "goo":
        disc("goo", radius, mat(scene, "#e04ab0", 0.35, 0.8));
        break;
      case "fire": {
        disc("scorch", radius, mat(scene, "#2a1408", 0, 0.85));
        disc("fire", radius * 0.9, mat(scene, "#ff6a1a", 1, 0.55), 0.06);
        const tongues = Math.round(6 + radius * 3);
        for (let i = 0; i < tongues; i++) {
          const a = i / tongues * Math.PI * 2 + i;
          const r = radius * (0.15 + 0.75 * (i * 37 % 10) / 10);
          const tongue = CreateCylinder(`flame${i}`, { diameterTop: 0, diameterBottom: 0.35, height: 0.9, tessellation: 5 }, scene);
          tongue.position.set(Math.cos(a) * r, 0.4, Math.sin(a) * r);
          tongue.material = mat(scene, i % 3 === 0 ? "#ffd24a" : "#ff6a1a", 1.1, 0.55);
          tongue.parent = root;
          tongue.isPickable = false;
        }
        break;
      }
      case "toxic": {
        const cloud = CreateSphere("toxic", { diameter: radius * 2, segments: 12 }, scene);
        cloud.scaling.y = 0.55;
        cloud.position.y = radius * 0.25;
        cloud.material = mat(scene, "#7dff3a", 0.35, 0.22);
        cloud.parent = root;
        cloud.isPickable = false;
        break;
      }
      case "smoke": {
        const material = smokeMaterial(scene);
        for (const [i, [x, y, z, size]] of SMOKE_PUFFS.entries()) {
          const puff = CreatePlane(`smoke${i}`, { size }, scene);
          puff.billboardMode = TransformNode.BILLBOARDMODE_ALL;
          puff.position.set(x, y + SMOKE.rise, z);
          puff.material = material;
          puff.parent = root;
          puff.isPickable = false;
        }
        break;
      }
      case "singularity": {
        const core = CreateSphere("singularity", { diameter: 1.2, segments: 14 }, scene);
        core.material = mat(scene, "#05010a", 0);
        core.parent = root;
        const ring = CreateTorus("singRing", { diameter: radius * 0.6, thickness: 0.12, tessellation: 40 }, scene);
        ring.material = mat(scene, "#b07aff", 1.4, 0.8);
        ring.parent = root;
        const outer = CreateSphere("singField", { diameter: radius * 2, segments: 16 }, scene);
        outer.material = mat(scene, "#6a3aff", 0.4, 0.08);
        outer.parent = root;
        for (const m of root.getChildMeshes()) m.isPickable = false;
        break;
      }
    }
    return { root, kind, radius, phase: Math.random() * 10 };
  }
  /** A burning patch's pack fires: three or four overlapping, round its middle, so the whole patch reads as burning. */
  burn(key, m, fade) {
    const n = Math.max(3, Math.min(4, Math.round(m.radius * 1.2)));
    const p = m.root.position;
    let all = true;
    for (let j = 0; j < n; j++) {
      const a = j / n * Math.PI * 2 + m.phase;
      const r = m.radius * 0.5;
      const id = `zone:${key}:${j}`;
      this.lasting.want(id, "fire.zone", { x: p.x + Math.cos(a) * r, y: p.y + 0.05, z: p.z + Math.sin(a) * r }, { size: Math.max(0.8, m.radius * 0.6), level: fade });
      all &&= this.lasting.drawn(id);
    }
    m.root.getChildMeshes().forEach((c, i) => {
      if (i >= 2) c.setEnabled(!all);
    });
  }
  /** The smoke clouds drawn now (their middles and radii), for what smoke hides on this screen (enemy markers). */
  smokeClouds() {
    const out = [];
    for (const m of this.zones.values()) {
      if (m.kind !== "smoke" || (m.left ?? 0) <= SMOKE.clearSeconds) continue;
      const p = m.root.position;
      out.push({ x: p.x, y: p.y + m.radius * SMOKE.rise, z: p.z, radius: m.radius });
    }
    return out;
  }
  animate(m, now, fade) {
    const t = now * 1e-3 + m.phase;
    if (m.kind === "smoke") {
      m.root.scaling.set(m.radius, m.radius * SMOKE.squash, m.radius);
      m.root.rotation.y = t * 0.05;
      const thin = Math.max(0, Math.min(1, (m.left ?? 3) / 2.5));
      m.root.getChildMeshes().forEach((c, i) => {
        c.scaling.setAll(1 + Math.sin(t * 0.6 + i * 1.3) * 0.05);
        c.rotation.z = (i % 2 ? 1 : -1) * t * 0.08 + i;
        c.visibility = thin;
      });
      return;
    }
    m.root.scaling.setAll(m.kind === "singularity" ? 1 : 0.5 + 0.5 * fade);
    if (m.kind === "fire") {
      m.root.getChildMeshes().forEach((c, i) => {
        if (i < 2) return;
        c.scaling.y = 0.7 + Math.abs(Math.sin(t * 9 + i * 1.7)) * 0.9;
        c.position.y = 0.45 * c.scaling.y;
      });
    } else if (m.kind === "toxic") {
      m.root.rotation.y = t * 0.3;
      m.root.scaling.y = (0.5 + 0.5 * fade) * (1 + Math.sin(t * 2) * 0.06);
    } else if (m.kind === "singularity") {
      m.root.rotation.y = t * 3;
      m.root.rotation.x = 0.35;
      const [core] = m.root.getChildMeshes();
      core?.scaling.setAll(0.8 + Math.sin(t * 14) * 0.15);
    }
  }
}
function createBeam(scene, from, to, color2, width) {
  const a = new Vector3(from.x, from.y - 0.08, from.z);
  const b = new Vector3(to.x, to.y, to.z);
  const len2 = Vector3.Distance(a, b);
  const beam = CreateCylinder("beam", { diameter: width, height: Math.max(0.01, len2), tessellation: 6 }, scene);
  beam.position = a.add(b).scale(0.5);
  const dir = b.subtract(a).normalize();
  const axis = Vector3.Cross(Vector3.Up(), dir);
  const angle = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(Vector3.Up(), dir))));
  if (axis.lengthSquared() > 1e-9) beam.rotate(axis.normalize(), angle);
  const m = new StandardMaterial("beamMat", scene);
  m.emissiveColor = Color3.FromHexString(color2);
  m.diffuseColor = Color3.Black();
  m.alpha = 0.85;
  m.disableLighting = true;
  beam.material = m;
  beam.isPickable = false;
  return beam;
}
function createArc(scene, pts, color2) {
  const points = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const steps = Math.max(3, Math.round(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 0.8));
    for (let s = 0; s < steps; s++) {
      const f = s / steps;
      const j = s === 0 ? 0 : 0.35;
      points.push(new Vector3(a.x + (b.x - a.x) * f + (Math.random() - 0.5) * j, a.y + (b.y - a.y) * f + (Math.random() - 0.5) * j, a.z + (b.z - a.z) * f + (Math.random() - 0.5) * j));
    }
  }
  const last = pts[pts.length - 1];
  points.push(new Vector3(last.x, last.y, last.z));
  const lines = CreateLines("arc", { points }, scene);
  lines.color = Color3.FromHexString(color2);
  lines.isPickable = false;
  return lines;
}
function statusColor(bits) {
  if (bits & STATUS_FROZEN) return "#9fe8ff";
  if (bits & STATUS_BURN) return "#ff7a2a";
  if (bits & STATUS_POISON) return "#8aff3a";
  if (bits & STATUS_SLOW) return "#ff5ac8";
  if (bits & STATUS_CHILL) return "#c8f0ff";
  return null;
}
function createAura(scene, parent) {
  const shell = CreateCylinder("aura", { diameter: 1, height: 1.95, tessellation: 12 }, scene);
  shell.position.y = 0.95;
  shell.parent = parent;
  shell.isPickable = false;
  const rim = CreateSphere("aura_rim", { diameterX: 0.95, diameterY: 2, diameterZ: 0.95, segments: 10 }, scene);
  rim.parent = shell;
  rim.isPickable = false;
  auraRims.set(shell, rim);
  shell.setEnabled(false);
  return shell;
}
const auraRims = /* @__PURE__ */ new WeakMap();
const AURA_RIM = { edge: 0.9, middle: 0.05, power: 0.6 };
function rimMat(scene, hex) {
  let byKey = materials.get(scene);
  if (!byKey) materials.set(scene, byKey = /* @__PURE__ */ new Map());
  const key = `rim|${hex}`;
  let m = byKey.get(key);
  if (!m) {
    m = new StandardMaterial(`aura_rim_${hex}`, scene);
    m.disableLighting = true;
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    m.emissiveColor = Color3.FromHexString(hex);
    m.alpha = 0;
    m.opacityFresnelParameters = new FresnelParameters({ leftColor: new Color3(AURA_RIM.edge, AURA_RIM.edge, AURA_RIM.edge), rightColor: new Color3(AURA_RIM.middle, AURA_RIM.middle, AURA_RIM.middle), power: AURA_RIM.power, bias: 0 });
    m.disableDepthWrite = true;
    byKey.set(key, m);
  }
  return m;
}
function setAura(scene, aura, bits, _now) {
  const color2 = statusColor(bits);
  aura.setEnabled(!!color2);
  if (!color2) return;
  const frozen = (bits & STATUS_FROZEN) !== 0;
  const rim = auraRims.get(aura);
  aura.isVisible = frozen || !rim;
  if (aura.isVisible) aura.material = mat(scene, color2, frozen ? 0.4 : 0.9, frozen ? 0.55 : 0.18);
  aura.scaling.set(frozen ? 1.05 : 1, 1, frozen ? 1.05 : 1);
  if (rim) {
    rim.setEnabled(!frozen);
    if (!frozen) rim.material = rimMat(scene, color2);
  }
}
const TIER_BODIES = { full: 10, cheap: 3, posed: 0 };
const RAGDOLL_BUDGET = {
  /** Awake ragdoll bodies at once. */
  awakeBodies: 300,
  /** Always a full ragdoll this close (m), in view or not (you might turn round). */
  near: 10,
  /** In view: full up to here (m), cheap beyond (when the body's size on screen isn't known). */
  fullInView: 35,
  /** In view: full while the body stands at least this share of the view's height (a 1.8 m body), cheap below. */
  fullScreen: 0.033,
  /**
   * A ragdoll stops simulating (frozen into a static pose) as soon as it comes to rest, or once it has had this long
   * (s) and is moving slower than `stillSpeed` (m/s, its torso): a body still rolling down a long hill carries on
   * (owner, 3 Nov: one stopped halfway down), up to `maxSeconds` at most.
   */
  fullSeconds: 3,
  cheapSeconds: 2,
  stillSpeed: 0.6,
  maxSeconds: 15,
  /**
   * Landed and lying still (torso slower than `restSpeed`, on the ground) for this long (s): frozen at once, whatever
   * its time (a body that has landed doesn't wait out the clock; round 3 of docs/PERF_96.md).
   */
  restSeconds: 0.35,
  restSpeed: 0.3,
  /** Fresh deaths whose bodies start in one frame at most (nearest and biggest on screen first; the rest wait a frame). */
  startsPerFrame: 6
};
function tierFor(dist, inView2, screen) {
  if (dist <= RAGDOLL_BUDGET.near) return "full";
  if (!inView2) return "posed";
  if (screen !== void 0) return screen >= RAGDOLL_BUDGET.fullScreen ? "full" : "cheap";
  return dist <= RAGDOLL_BUDGET.fullInView ? "full" : "cheap";
}
function screenShare(dist, fov) {
  return 1.8 / (2 * Math.max(0.1, dist) * Math.tan(fov / 2));
}
const lower = (t) => t === "full" ? "cheap" : "posed";
function fitBudget(want, dist, moving, budget = RAGDOLL_BUDGET.awakeBodies) {
  let awake = moving.reduce((n, r) => n + TIER_BODIES[r.tier], 0);
  const tiers = moving.map((r) => r.tier);
  const drop = [];
  let tier = want;
  const order = moving.map((r, i) => ({ i, dist: r.dist })).sort((a, b) => b.dist - a.dist);
  while (awake + TIER_BODIES[tier] > budget && tier !== "posed") {
    const far = order.find((o) => tiers[o.i] !== "posed" && o.dist > dist);
    if (far) {
      const from = tiers[far.i];
      tiers[far.i] = lower(from);
      awake -= TIER_BODIES[from] - TIER_BODIES[tiers[far.i]];
      drop.push(far.i);
    } else tier = lower(tier);
  }
  return { tier, drop };
}
const JOINT_LIMITS = {
  neck: { x: [-0.6, 0.8], y: [-0.8, 0.8], z: [-0.5, 0.5] },
  spine: { x: [-0.4, 0.7], y: [-0.5, 0.5], z: [-0.4, 0.4] },
  shoulder: { x: [-1.55, 1.3], y: [-1, 1], z: [-1.5, 0.5] },
  elbow: { x: [-0.05, 2.6], y: [-0.5, 0.5], z: [-0.1, 0.1] },
  hip: { x: [-2, 0.45], y: [-0.5, 0.5], z: [-0.8, 0.25] },
  knee: { x: [-0.05, 2.5], y: [-0.12, 0.12], z: [-0.1, 0.1] }
};
const SLACK = 0.05;
const BENT = 0.26;
const unit = (v, fallback) => {
  const l = v.length();
  return l > 1e-4 ? v.scale(1 / l) : fallback.clone();
};
const across = (v, axis, fallback) => unit(v.subtract(axis.scale(Vector3.Dot(v, axis))), fallback);
const anyPerp = (v) => across(Math.abs(v.y) < 0.9 ? Vector3.Up() : Vector3.Right(), v, Vector3.Forward());
function bodyFrame(pelvis, neck, rightRef, facing) {
  const up = unit(neck.subtract(pelvis), Vector3.Up());
  let right = rightRef && rightRef.length() > 0.03 ? across(rightRef, up, Vector3.Zero()) : null;
  if (right && right.length() < 0.5) right = null;
  if (!right) right = facing ? across(Vector3.Cross(up, facing), up, anyPerp(up)) : anyPerp(up);
  let forward = Vector3.Cross(right, up);
  if (facing && Vector3.Dot(forward, facing) < 0) {
    right = right.scale(-1);
    forward = forward.scale(-1);
  }
  return { right, up, forward };
}
function hingeAxis(upper, lower2, bendToward) {
  const c = Vector3.Cross(upper, lower2);
  if (c.length() > BENT && Vector3.Dot(upper, lower2) > -0.95) return c.normalize();
  const b = across(bendToward, upper, anyPerp(upper));
  return unit(Vector3.Cross(upper, b), anyPerp(upper));
}
function frameOf(x, y) {
  const Y = unit(y, Vector3.Up());
  const X = across(x, Y, anyPerp(Y));
  const Z = Vector3.Cross(X, Y);
  return Quaternion.FromRotationMatrix(Matrix.FromValues(X.x, X.y, X.z, 0, Y.x, Y.y, Y.z, 0, Z.x, Z.y, Z.z, 0, 0, 0, 0, 1));
}
function jointAngles(parent, child) {
  const r = Quaternion.Inverse(parent).multiply(child);
  const s = r.w < 0 ? -1 : 1;
  const a = (v) => 2 * Math.asin(Math.max(-1, Math.min(1, v * s)));
  return new Vector3(a(r.x), a(r.y), a(r.z));
}
function jointSetup(kind, side, body, parentDir, childDir, hinge) {
  const s = side === "l" ? -1 : 1;
  let parent;
  let child;
  switch (kind) {
    case "neck":
    case "spine":
      parent = frameOf(body.right, parentDir);
      child = frameOf(body.right, childDir);
      break;
    case "shoulder": {
      parent = frameOf(body.forward.scale(s), body.right.scale(s));
      const h = hinge ?? hingeAxis(childDir, childDir, body.forward);
      child = frameOf(Vector3.Cross(h, childDir).scale(s), childDir);
      break;
    }
    case "hip":
      parent = frameOf(body.right, body.up.scale(-1));
      child = frameOf(hinge ?? body.right, childDir);
      break;
    case "elbow":
    case "knee": {
      const h = hinge ?? hingeAxis(parentDir, childDir, kind === "elbow" ? body.forward : body.forward.scale(-1));
      parent = frameOf(h, parentDir);
      child = frameOf(h, childDir);
      break;
    }
  }
  const base = JOINT_LIMITS[kind];
  const mirror = (r) => s < 0 ? [-r[1], -r[0]] : r;
  const now = jointAngles(parent, child);
  const widen = (r, v) => [Math.min(r[0], v - SLACK), Math.max(r[1], v + SLACK)];
  return { parent, child, limits: { x: widen(base.x, now.x), y: widen(base.y, now.y), z: widen(mirror(base.z), now.z) } };
}
const TRUNK = /* @__PURE__ */ new Set(["pelvis", "spine_02", "neck_01"]);
function planJoints(at, segments, facing) {
  const segs = segments.filter((s) => at(s.from) && at(s.to));
  const pelvis = at("pelvis") ?? Vector3.Zero();
  const hip = (s) => at(`thigh_${s}`) ?? at(`upperarm_${s}`);
  const hipL = hip("l");
  const hipR = hip("r");
  const frame = bodyFrame(pelvis, at("neck_01") ?? pelvis.add(Vector3.Up()), hipL && hipR ? hipR.subtract(hipL) : null, facing);
  const dirs = /* @__PURE__ */ new Map();
  for (const seg of segs) {
    const d = at(seg.to).subtract(at(seg.from));
    dirs.set(seg.bone, d.length() > 0.02 ? d.normalize() : TRUNK.has(seg.bone) ? frame.up.clone() : frame.up.scale(-1));
  }
  const hinges = /* @__PURE__ */ new Map();
  for (const s of ["l", "r"]) {
    for (const [upper, lower2, toward] of [
      [`upperarm_${s}`, `lowerarm_${s}`, frame.forward],
      [`thigh_${s}`, `calf_${s}`, frame.forward.scale(-1)]
    ]) {
      const u = dirs.get(upper);
      const l = dirs.get(lower2);
      if (!u) continue;
      const h = hingeAxis(u, l ?? u, toward);
      hinges.set(upper, h);
      if (l) hinges.set(lower2, h);
    }
  }
  const joints = /* @__PURE__ */ new Map();
  for (const seg of segs) {
    const p = seg.parent;
    const pd = p && dirs.get(p.segment);
    if (!p || !pd) continue;
    const out = Vector3.Dot(at(seg.from).subtract(pelvis), frame.right);
    const side = !seg.side ? null : Math.abs(out) > 0.02 ? out > 0 ? "r" : "l" : seg.side;
    joints.set(seg.bone, jointSetup(p.joint, side, frame, pd, dirs.get(seg.bone), hinges.get(seg.bone) ?? null));
  }
  return { frame, dirs, joints };
}
const FULL = [
  { bone: "pelvis", from: "pelvis", to: "neck_01", radius: 0.14 },
  { bone: "neck_01", from: "neck_01", to: "Head", radius: 0.1, extend: 0.18, parent: { segment: "pelvis", at: "neck_01", joint: "neck" } },
  ...["l", "r"].flatMap((s) => [
    { bone: `upperarm_${s}`, from: `upperarm_${s}`, to: `lowerarm_${s}`, radius: 0.055, side: s, parent: { segment: "pelvis", at: `upperarm_${s}`, joint: "shoulder" } },
    { bone: `lowerarm_${s}`, from: `lowerarm_${s}`, to: `hand_${s}`, radius: 0.05, extend: 0.1, side: s, parent: { segment: `upperarm_${s}`, at: `lowerarm_${s}`, joint: "elbow" } },
    { bone: `thigh_${s}`, from: `thigh_${s}`, to: `calf_${s}`, radius: 0.075, side: s, parent: { segment: "pelvis", at: `thigh_${s}`, joint: "hip" } },
    { bone: `calf_${s}`, from: `calf_${s}`, to: `foot_${s}`, radius: 0.06, extend: 0.08, side: s, parent: { segment: `thigh_${s}`, at: `calf_${s}`, joint: "knee" } }
  ])
];
const CHEAP = [
  { bone: "pelvis", from: "pelvis", to: "spine_02", radius: 0.15 },
  { bone: "spine_02", from: "spine_02", to: "neck_01", radius: 0.15, parent: { segment: "pelvis", at: "spine_02", joint: "spine" } },
  { bone: "neck_01", from: "neck_01", to: "Head", radius: 0.1, extend: 0.18, parent: { segment: "spine_02", at: "neck_01", joint: "neck" } }
];
const RAGDOLL_PREWARM = [
  ...FULL.map((s) => ({ key: `full:${s.bone}`, shape: { kind: "capsule", halfHeight: s.bone === "pelvis" ? 0.2 : s.bone === "neck_01" ? 0.06 : 0.12, radius: s.radius } })),
  ...CHEAP.map((s) => ({ key: `cheap:${s.bone}`, shape: { kind: "capsule", halfHeight: 0.08, radius: s.radius } }))
];
const TMP = { now: new Quaternion(), delta: new Quaternion(), q: new Quaternion(), m: new Matrix(), m2: new Matrix() };
class Ragdoll {
  constructor(world, joints, rootJoint, push, tier = "full", facing = null) {
    this.world = world;
    this.tier = tier;
    this.born = world.steps;
    this.space = new SkeletonSpace(rootJoint);
    rootJoint.computeWorldMatrix(true);
    this.fromSpace = rootJoint.getWorldMatrix().clone().setTranslation(Vector3.Zero());
    this.toSpace = this.fromSpace.clone().invert();
    this.pelvis = joints.get("pelvis");
    this.rootJoint = rootJoint;
    this.root0 = rootJoint.position.clone();
    this.pelvis0 = this.pelvis.position.clone();
    const parentWorld = rootJoint.parent?.computeWorldMatrix(true) ?? Matrix.Identity();
    this.rootLinear = rootJoint.getWorldMatrix().multiply(Matrix.Invert(parentWorld)).setTranslation(Vector3.Zero());
    const world0 = (n) => {
      const j = joints.get(n);
      j.computeWorldMatrix(true);
      return j.getAbsolutePosition().clone();
    };
    const byName = /* @__PURE__ */ new Map();
    const plan = planJoints((n) => joints.get(n) ? world0(n) : null, tier === "full" ? FULL : CHEAP, facing ? new Vector3(facing.x, 0, facing.z) : null);
    const segs = (tier === "full" ? FULL : CHEAP).filter((seg) => joints.get(seg.bone) && plan.dirs.has(seg.bone));
    for (const seg of segs) {
      const bone = joints.get(seg.bone);
      const a = world0(seg.from);
      let b = world0(seg.to);
      const axis = plan.dirs.get(seg.bone);
      if (seg.extend) b = b.add(axis.scale(seg.extend));
      const full = Vector3.Distance(a, b);
      const rot = new Quaternion();
      Quaternion.FromUnitVectorsToRef(Vector3.Up(), axis, rot);
      const mid = a.add(b).scale(0.5);
      const half = Math.max(0.01, full / 2 - seg.radius);
      const share = seg.bone === "pelvis" ? 1 : 0.8;
      const key = `${tier}:${seg.bone}`;
      const body = this.world.takeRagdollBody(key, { kind: "capsule", halfHeight: half, radius: seg.radius }, mid, rot, {
        vel: { x: push.x * share + (Math.random() - 0.5) * 0.6, y: push.y * share, z: push.z * share + (Math.random() - 0.5) * 0.6 },
        spin: { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * 2 },
        density: seg.bone === "pelvis" ? 1.2 : 0.9
      });
      const part = { seg, key, bone, body, body0: rot.clone(), body0Inv: Quaternion.Inverse(rot), bone0: this.space.rot(bone) };
      this.parts.push(part);
      byName.set(seg.bone, part);
      if (seg.parent) {
        const p = byName.get(seg.parent.segment);
        const j = plan.joints.get(seg.bone);
        if (p && j) {
          const at = world0(seg.parent.at);
          const frameA = p.body0Inv.multiply(j.parent);
          const frameB = part.body0Inv.multiply(j.child);
          this.joints.push(
            this.world.ballJoint(p.body, body, this.local(p.body, at), this.local(body, at), {
              frameA: { x: frameA.x, y: frameA.y, z: frameA.z, w: frameA.w },
              frameB: { x: frameB.x, y: frameB.y, z: frameB.z, w: frameB.w },
              ...j.limits
            })
          );
        }
      }
    }
    const torso = byName.get("pelvis");
    this.pelvisLocal = this.local(torso.body, world0("pelvis"));
  }
  world;
  tier;
  parts = [];
  joints = [];
  space;
  toSpace;
  fromSpace;
  pelvis;
  rootJoint;
  /** The root's and pelvis's positions at death, and the root's local linear transform (skeleton space → its parent's). */
  root0;
  pelvis0;
  rootLinear;
  /** Pelvis joint relative to the torso capsule's centre (world, at death, in the capsule's frame). */
  pelvisLocal;
  /** The effects world's step count at death: age is simulated time, so a slow frame doesn't cut a fall short. */
  born;
  settled = false;
  /** The effects world's step count since the body has lain still on the ground (-1: moving). */
  restSince = -1;
  /** No longer simulated: the bodies went back to the pool and the pose stays as it is. */
  frozen = false;
  /** Physics bodies this ragdoll keeps awake (0 once frozen). */
  get bodies() {
    return this.frozen ? 0 : this.parts.length;
  }
  /** The torso's velocity now (a ragdoll dropping a tier hands it on). */
  get velocity() {
    const torso = this.parts[0]?.body;
    if (!torso || this.frozen) return { x: 0, y: 0, z: 0 };
    const v = torso.linvel();
    return { x: v.x, y: v.y, z: v.z };
  }
  /** A world point in a body's own frame. */
  local(body, p) {
    const t = body.translation();
    const r = body.rotation();
    const inv = Quaternion.Inverse(new Quaternion(r.x, r.y, r.z, r.w));
    const v = p.subtract(new Vector3(t.x, t.y, t.z)).applyRotationQuaternion(inv);
    return { x: v.x, y: v.y, z: v.z };
  }
  /**
   * Pose the skeleton from the bodies (parents before children). Call every
   * frame after the physics step. Returns true when the ragdoll has just
   * frozen (it rested, or ran out of time): the caller then stops the pose.
   */
  update() {
    if (this.frozen) return false;
    for (const part of this.parts) {
      const r = part.body.rotation();
      const now = TMP.now.set(r.x, r.y, r.z, r.w);
      const delta = now.multiplyToRef(part.body0Inv, TMP.delta);
      Matrix.FromQuaternionToRef(delta, TMP.m);
      this.fromSpace.multiplyToRef(TMP.m, TMP.m2);
      TMP.m2.multiplyToRef(this.toSpace, TMP.m);
      TMP.m.decompose(void 0, TMP.q);
      this.space.setRot(part.bone, TMP.q.multiply(part.bone0), 1);
      if (part.bone === this.pelvis) {
        const t = part.body.translation();
        const at = new Vector3(this.pelvisLocal.x, this.pelvisLocal.y, this.pelvisLocal.z).applyRotationQuaternion(now).add(new Vector3(t.x, t.y, t.z));
        const move = this.space.point(at).subtract(this.pelvis0);
        this.rootJoint.position.copyFrom(this.root0.add(Vector3.TransformNormal(move, this.rootLinear)));
        this.pelvis.position.copyFrom(this.pelvis0);
        this.rootJoint.computeWorldMatrix(true);
        this.pelvis.computeWorldMatrix(true);
      }
    }
    const age = (this.world.steps - this.born) / 60;
    const torso = this.parts[0]?.body.linvel();
    const speed = torso ? Math.hypot(torso.x, torso.y, torso.z) : 0;
    const onGround = () => {
      const t = this.parts[0]?.body.translation();
      return !t || !!this.world.raycast({ x: t.x, y: t.y, z: t.z }, { x: 0, y: -1, z: 0 }, 0.75);
    };
    if (!this.settled && age > 0.6 && speed < 0.8 && onGround()) {
      this.settled = true;
      for (const p of this.parts) {
        p.body.setLinearDamping(3);
        p.body.setAngularDamping(7);
      }
    } else if (this.settled && speed > 1.6) {
      this.settled = false;
      for (const p of this.parts) {
        p.body.setLinearDamping(0.6);
        p.body.setAngularDamping(1.6);
      }
    }
    const still = speed < RAGDOLL_BUDGET.stillSpeed && onGround();
    const resting = this.settled && speed < RAGDOLL_BUDGET.restSpeed && this.parts.every((p) => {
      const v = p.body.linvel();
      return Math.hypot(v.x, v.y, v.z) < RAGDOLL_BUDGET.restSpeed * 2;
    });
    if (!resting) this.restSince = -1;
    else if (this.restSince < 0) this.restSince = this.world.steps;
    const rested = this.restSince >= 0 && (this.world.steps - this.restSince) / 60 >= RAGDOLL_BUDGET.restSeconds;
    const time = this.tier === "full" ? RAGDOLL_BUDGET.fullSeconds : RAGDOLL_BUDGET.cheapSeconds;
    if (this.parts.every((p) => p.body.isSleeping()) || rested || age > time && still || age > RAGDOLL_BUDGET.maxSeconds) {
      this.freeze();
      return true;
    }
    return false;
  }
  /** Whether `body` is one of this ragdoll's capsules. */
  owns(body) {
    return this.parts.some((p) => p.body === body);
  }
  /**
   * A round (or a blast) knocked the body about: it gets its time again, counted from now, and its
   * damping goes back to a fresh fall's, so it tumbles and settles limp instead of freezing mid-air
   * when the time it had from its death runs out.
   */
  kick() {
    if (this.frozen) return;
    this.born = this.world.steps;
    this.settled = false;
    this.restSince = -1;
    for (const p of this.parts) {
      p.body.setLinearDamping(0.6);
      p.body.setAngularDamping(1.6);
      p.body.wakeUp();
    }
  }
  /** Stop simulating: the bodies go back to the pool; the bones keep the pose they have. */
  freeze() {
    if (this.frozen) return;
    this.frozen = true;
    for (const j of this.joints) this.world.removeJoint(j);
    this.joints.length = 0;
    for (const p of this.parts) this.world.parkRagdollBody(p.key, p.body);
  }
  /** Every part has come to rest (or it is frozen): no need to re-pose the skeleton. */
  get resting() {
    return this.frozen || this.parts.every((p) => p.body.isSleeping());
  }
  dispose() {
    this.freeze();
    this.parts.length = 0;
  }
}
class PosedBody {
  tier = "posed";
  bodies = 0;
  resting = true;
  velocity = { x: 0, y: 0, z: 0 };
  frozen = false;
  frames = 0;
  update() {
    if (this.frozen || ++this.frames < 3) return false;
    this.frozen = true;
    return true;
  }
  freeze() {
    this.frozen = true;
  }
  dispose() {
  }
}
const PROXY_CELL = 48;
const THIN_VERTEX_CAP = 12e4;
const geometryOf = (m) => m.isAnInstance ? m.sourceMesh : m instanceof Mesh ? m : null;
function proxyable(m) {
  if (m.isDisposed() || !m.isEnabled() || !m.isVisible || !m.isWorldMatrixFrozen || m.renderingGroupId !== 0) return false;
  const g = geometryOf(m);
  if (!g || g.getTotalVertices() === 0 || g.skeleton || g.morphTargetManager || g.getLODLevels().length) return false;
  if (g.hasThinInstances && (!m.metadata?.staticThin || g.thinInstanceCount * g.getTotalVertices() > THIN_VERTEX_CAP)) return false;
  if (!m.isAnInstance && g.hasInstances) return false;
  const mat2 = g.material;
  if (!mat2 || mat2.alpha < 0.99 || mat2.needAlphaTesting?.() || mat2.needAlphaBlending?.() || mat2.opacityTexture) return false;
  if (!g.getVerticesData(VertexBuffer.PositionKind) || !g.getIndices()) return false;
  return m.getBoundingInfo().boundingBox.minimumWorld.y > -1e3;
}
function sortIntoCells(meshes) {
  const cells = /* @__PURE__ */ new Map();
  const p = new Vector3();
  const n = new Vector3();
  let merged = 0;
  for (const m of meshes) {
    const g = geometryOf(m);
    const pos = g?.getVerticesData(VertexBuffer.PositionKind);
    const nrm = g?.getVerticesData(VertexBuffer.NormalKind);
    const idx = g?.getIndices();
    if (!g || !pos || !idx) continue;
    merged++;
    const own = m.getWorldMatrix();
    const thin = (g.hasThinInstances ? g.thinInstanceGetWorldMatrices() : []).map((t) => t.multiply(own));
    for (const world of thin.length ? thin : [own]) {
      const flip = world.determinant() < 0;
      const mat2 = g.material;
      const cull = mat2?.backFaceCulling !== false ? "cull" : "both";
      const orientation = mat2?._getEffectiveOrientation?.(g) ?? 0;
      const remap = /* @__PURE__ */ new Map();
      for (let t = 0; t + 2 < idx.length; t += 3) {
        const a = idx[t];
        const b = idx[t + 1];
        const c = idx[t + 2];
        const cx = (pos[a * 3] + pos[b * 3] + pos[c * 3]) / 3;
        const cy = (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c * 3 + 1]) / 3;
        const cz = (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c * 3 + 2]) / 3;
        Vector3.TransformCoordinatesFromFloatsToRef(cx, cy, cz, world, p);
        const key = `${cull}:${orientation}:${Math.floor(p.x / PROXY_CELL)}:${Math.floor(p.z / PROXY_CELL)}`;
        let cell = cells.get(key);
        if (!cell) cells.set(key, cell = { positions: [], normals: [], indices: [] });
        let map = remap.get(key);
        if (!map) remap.set(key, map = /* @__PURE__ */ new Map());
        for (const v of flip ? [a, c, b] : [a, b, c]) {
          let at = map.get(v);
          if (at === void 0) {
            at = cell.positions.length / 3;
            map.set(v, at);
            Vector3.TransformCoordinatesFromFloatsToRef(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], world, p);
            cell.positions.push(p.x, p.y, p.z);
            if (nrm) {
              Vector3.TransformNormalFromFloatsToRef(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2], world, n);
              n.normalize();
              cell.normals.push(n.x, n.y, n.z);
            } else cell.normals.push(0, 1, 0);
          }
          cell.indices.push(at);
        }
      }
    }
  }
  return { cells, merged };
}
function buildShadowProxies(scene, meshes, tag = "0") {
  const sources = meshes.filter(proxyable);
  if (!sources.length) return { proxies: [], sources: [] };
  const { cells } = sortIntoCells(sources);
  const proxies = [];
  for (const [key, cell] of cells) {
    if (!cell.indices.length) continue;
    const [cull, orientation] = key.split(":");
    const matName = `shadowProxyMat_${cull}_${orientation}`;
    let mat2 = scene.getMaterialByName(matName);
    if (!mat2) {
      mat2 = new StandardMaterial(matName, scene);
      mat2.backFaceCulling = cull === "cull";
      mat2.sideOrientation = Number(orientation);
      mat2.disableLighting = true;
    }
    const mesh = new Mesh(`shadowProxy_${tag}_${key}`, scene);
    const vd = new VertexData();
    vd.positions = cell.positions;
    vd.normals = cell.normals;
    vd.indices = cell.positions.length / 3 > 65535 ? new Uint32Array(cell.indices) : cell.indices;
    vd.applyToMesh(mesh);
    mesh.material = mat2;
    mesh.isPickable = false;
    mesh.layerMask = 0;
    mesh.receiveShadows = false;
    mesh.freezeWorldMatrix();
    mesh.metadata = { shadowProxy: true };
    proxies.push(mesh);
  }
  return { proxies, sources };
}
const CASCADE_MARGIN = [0.25, 0.15, 0.12];
const REFRESH_FRAMES = 240;
const BOX_SLACK = 6;
const STILL_FRAMES = 60;
function cascadeHolds(cached, fresh) {
  return Math.hypot(fresh.x - cached.x, fresh.y - cached.y, fresh.z - cached.z) + fresh.r <= cached.r + 1e-6;
}
function centredSlice(eye, corners) {
  let r = 0;
  for (const c of corners) r = Math.max(r, Math.hypot(c.x - eye.x, c.y - eye.y, c.z - eye.z));
  return Math.ceil(r * 16) / 16;
}
function refreshDue(frame, layer, last) {
  return frame < last || frame - last >= REFRESH_FRAMES + layer * 7 % 11;
}
class DepthCopy {
  constructor(gl, texture, layers, size, array, stencil) {
    this.gl = gl;
    this.texture = texture;
    this.size = size;
    this.mask = gl.DEPTH_BUFFER_BIT | (stencil ? gl.STENCIL_BUFFER_BIT : 0);
    const attachment = stencil ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;
    const prev = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    for (let i = 0; i < layers; i++) {
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      if (array) gl.framebufferTextureLayer(gl.FRAMEBUFFER, attachment, texture, 0, i);
      else gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, texture, 0);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      this.fbos.push(fbo);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, prev);
  }
  gl;
  texture;
  size;
  fbos = [];
  mask;
  /** A cache for the depth texture of `rt` (null when it can't be made: then nothing is cached). */
  static create(engine, rt, layers, size) {
    const gl = engine._gl;
    const depth = rt._depthStencilTexture;
    if (!gl || engine.isWebGPU || (engine.webGLVersion ?? 1) < 2 || !depth?._hardwareTexture) return null;
    const stencil = !!rt._depthStencilTextureWithStencil;
    const array = layers > 1;
    const target = array ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D;
    const prevTex = gl.getParameter(array ? gl.TEXTURE_BINDING_2D_ARRAY : gl.TEXTURE_BINDING_2D);
    const tex = gl.createTexture();
    if (!tex) return null;
    try {
      gl.bindTexture(target, tex);
      const internal = engine._getInternalFormatFromDepthTextureFormat(depth.format, true, stencil);
      if (array) gl.texStorage3D(target, 1, internal, size, size, layers);
      else gl.texStorage2D(target, 1, internal, size, size);
      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    } finally {
      gl.bindTexture(target, prevTex);
    }
    const copy = new DepthCopy(gl, tex, layers, size, array, stencil);
    if (!copy.complete()) {
      copy.dispose();
      return null;
    }
    return copy;
  }
  complete() {
    const gl = this.gl;
    const prev = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    let ok = true;
    for (const f of this.fbos) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) ok = false;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, prev);
    return ok;
  }
  /** The bound shadow map layer's depth into the cache (`toCache`), or the cache's into it. */
  copy(layer, toCache) {
    const gl = this.gl;
    const fbo = this.fbos[layer];
    if (!fbo) return;
    const read = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
    const draw = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
    if (toCache) gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo);
    else gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
    const s = this.size;
    gl.blitFramebuffer(0, 0, s, s, 0, 0, s, s, this.mask, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, read);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, draw);
  }
  dispose() {
    for (const f of this.fbos) this.gl.deleteFramebuffer(f);
    this.fbos.length = 0;
    this.gl.deleteTexture(this.texture);
  }
}
const emptyList = () => ({ data: [], length: 0 });
const isStaticCaster = (m) => m.metadata?.shadowProxy === true;
function stillable(m) {
  const mesh = m;
  return !m.skeleton && !mesh.morphTargetManager && !m.isAnInstance && !mesh.hasInstances && !m.hasThinInstances && !m.metadata?.smallCaster;
}
class ShadowCache {
  constructor(scene, gen, csm, depth, layers) {
    this.scene = scene;
    this.gen = gen;
    this.csm = csm;
    this.depth = depth;
    this.layers = layers;
    this.redraw = new Array(layers).fill(true);
    this.copied = new Array(layers).fill(false);
    this.states = new Array(layers).fill(null);
    this.install();
  }
  scene;
  gen;
  csm;
  depth;
  layers;
  /** Per layer: draw the static casters this frame. */
  redraw;
  /** Per layer: the static casters were drawn and copied this frame. */
  copied;
  states;
  frame = 0;
  dirtyAll = true;
  /** Static draws this run (the perf probe): how many layer redraws, of how many layer renders. */
  stats = { redraws: 0, renders: 0 };
  lists = { s: [emptyList(), emptyList(), emptyList(), emptyList()], d: [emptyList(), emptyList(), emptyList(), emptyList()] };
  disposers = [];
  /** Casters that can move, watched: their world matrix's update flag, the frame it last changed, and whether cached now. */
  still = /* @__PURE__ */ new Map();
  /** A cache for `gen` (the cascaded one on high, the single box on medium), or null where it can't run (WebGPU, WebGL1). */
  static attach(scene, gen, csm) {
    const map = gen.getShadowMap();
    const rt = map?.renderTarget;
    if (!map || !rt) return null;
    const layers = csm ? csm.numCascades : 1;
    const depth = DepthCopy.create(scene.getEngine(), rt, layers, map.getSize().width);
    if (!depth) return null;
    return new ShadowCache(scene, gen, csm, depth, layers);
  }
  /** The layer being drawn now. */
  get layer() {
    return this.csm ? this.csm._currentLayer ?? 0 : 0;
  }
  /**
   * Is `m` drawn into the cache (a shadow proxy, or a movable caster standing still for STILL_FRAMES)? A movable caster
   * is watched from its first ask on.
   */
  isStatic(m) {
    if (isStaticCaster(m)) return true;
    const r = this.still.get(m);
    if (r) return r.cached;
    if (stillable(m)) {
      const w = m.getWorldMatrix();
      this.still.set(m, { flag: w.updateFlag, since: this.frame, cached: false, at: Float32Array.from(w.m) });
    }
    return false;
  }
  /** Each frame first: movable casters that moved, went or hid leave the cache (all layers redraw), still ones join it. */
  watchStill() {
    for (const [m, r] of this.still) {
      if (m.isDisposed()) {
        this.still.delete(m);
        if (r.cached) this.dirtyAll = true;
        continue;
      }
      const w = m.getWorldMatrix();
      const flag = w.updateFlag;
      if (flag !== r.flag && sameMatrix(r.at, w.m)) r.flag = flag;
      if (flag !== r.flag || !m.isEnabled() || !m.isVisible) {
        r.flag = flag;
        r.at.set(w.m);
        r.since = this.frame;
        if (r.cached) {
          r.cached = false;
          this.dirtyAll = true;
        }
      } else if (!r.cached && this.frame - r.since >= STILL_FRAMES) {
        r.cached = true;
        this.dirtyAll = true;
      }
    }
  }
  /** Whether layer `layer` draws its static casters this frame (else they come from the cache). */
  drawsStatic(layer) {
    return this.redraw[layer] ?? true;
  }
  /** The static casters changed (a batch of proxies built or rebuilt): every layer draws them again. */
  invalidate() {
    this.dirtyAll = true;
  }
  /** Medium graphics: the box moved this frame (its static casters are drawn again). */
  moved() {
    this.dirtyAll = true;
  }
  install() {
    const gen = this.gen;
    const map = this.gen.getShadowMap();
    const bind = map.onBeforeBindObservable.add(() => this.beginFrame());
    const clear = map.onClearObservable.add(() => {
      const L = this.layer;
      this.stats.renders++;
      this.copied[L] = false;
      if (!this.redraw[L]) this.depth.copy(L, false);
      else this.stats.redraws++;
    });
    const render = gen._renderForShadowMap.bind(gen);
    gen._renderForShadowMap = (opaque, alphaTest, transparent, depthOnly) => {
      const L = this.layer;
      if (!this.redraw[L] || this.copied[L]) return render(opaque, alphaTest, transparent, depthOnly);
      const { s, d } = this.lists;
      const isStatic = (m) => this.isStatic(m);
      split(opaque, s[0], d[0], isStatic);
      split(alphaTest, s[1], d[1], isStatic);
      split(transparent, s[2], d[2], isStatic);
      split(depthOnly, s[3], d[3], isStatic);
      render(s[0], s[1], s[2], s[3]);
      this.depth.copy(L, true);
      this.copied[L] = true;
      render(d[0], d[1], d[2], d[3]);
      for (const l of [...s, ...d]) {
        l.data.length = 0;
        l.length = 0;
      }
    };
    const after = map.onAfterRenderObservable.add(() => {
      const L = this.layer;
      if (this.redraw[L] && !this.copied[L]) {
        this.depth.copy(L, true);
        this.copied[L] = true;
      }
    });
    this.disposers.push(() => {
      map.onBeforeBindObservable.remove(bind);
      map.onClearObservable.remove(clear);
      map.onAfterRenderObservable.remove(after);
      gen._renderForShadowMap = render;
    });
    const csm = this.csm;
    if (csm) {
      const frustum = csm._computeCascadeFrustum.bind(csm);
      csm._computeCascadeFrustum = (i) => {
        frustum(i);
        const eye = csm.stabilizeCascades ? csm._getCamera()?.globalPosition : null;
        const corners = csm._frustumCornersWorldSpace[i];
        if (eye && corners?.length) {
          const r = centredSlice(eye, corners);
          csm._frustumCenter[i].copyFrom(eye);
          csm._cascadeMaxExtents[i].setAll(r);
          csm._cascadeMinExtents[i].setAll(-r);
        }
        const k = 1 + (CASCADE_MARGIN[i] ?? CASCADE_MARGIN[CASCADE_MARGIN.length - 1]);
        csm._cascadeMinExtents[i].scaleInPlace(k);
        csm._cascadeMaxExtents[i].scaleInPlace(k);
      };
      const compute = csm._computeMatrices.bind(csm);
      csm._computeMatrices = () => {
        compute();
        this.keepSquares();
      };
      this.disposers.push(() => {
        csm._computeCascadeFrustum = frustum;
        csm._computeMatrices = compute;
      });
    }
  }
  /** Before the layers each frame: which draw their static casters. */
  beginFrame() {
    if (this.csm) return;
    this.frame++;
    this.watchStill();
    const st = this.states[0];
    const due = this.dirtyAll || !st || refreshDue(this.frame, 0, st.drawn);
    this.redraw[0] = due;
    if (due) {
      this.dirtyAll = false;
      this.states[0] = { ...st ?? blankState(), drawn: this.frame };
    }
  }
  /** High graphics: per cascade, keep last frame's square (and its cached static depth) or take the new one. */
  keepSquares() {
    const csm = this.csm;
    this.frame++;
    this.watchStill();
    const all = this.dirtyAll;
    this.dirtyAll = false;
    for (let i = 0; i < this.layers; i++) {
      const center = csm._frustumCenter[i];
      const grown = csm._cascadeMaxExtents[i].x;
      const k = 1 + (CASCADE_MARGIN[i] ?? CASCADE_MARGIN[CASCADE_MARGIN.length - 1]);
      const fresh = { x: center.x, y: center.y, z: center.z, r: grown / k };
      const st = this.states[i];
      const keep = !all && !!st && Vector3.DistanceSquared(st.light, csm._lightDirection) < 1e-10 && cascadeHolds(st.sphere, fresh) && !refreshDue(this.frame, i, st.drawn);
      this.redraw[i] = !keep;
      if (keep) this.restore(i, st);
      else this.states[i] = this.snapshot(i, { x: fresh.x, y: fresh.y, z: fresh.z, r: grown }, st ?? null);
    }
  }
  snapshot(i, sphere, reuse) {
    const csm = this.csm;
    const st = reuse ?? blankState();
    st.sphere = sphere;
    st.view.copyFrom(csm._viewMatrices[i]);
    st.proj.copyFrom(csm._projectionMatrices[i]);
    st.transform.copyFrom(csm._transformMatrices[i]);
    st.min.copyFrom(csm._cascadeMinExtents[i]);
    st.max.copyFrom(csm._cascadeMaxExtents[i]);
    st.center.copyFrom(csm._frustumCenter[i]);
    st.cameraPos.copyFrom(csm._shadowCameraPos[i]);
    st.array.set(csm._transformMatricesAsArray.subarray(i * 16, i * 16 + 16));
    st.light.copyFrom(csm._lightDirection);
    st.drawn = this.frame;
    return st;
  }
  restore(i, st) {
    const csm = this.csm;
    csm._viewMatrices[i].copyFrom(st.view);
    csm._projectionMatrices[i].copyFrom(st.proj);
    csm._transformMatrices[i].copyFrom(st.transform);
    csm._cascadeMinExtents[i].copyFrom(st.min);
    csm._cascadeMaxExtents[i].copyFrom(st.max);
    csm._frustumCenter[i].copyFrom(st.center);
    csm._shadowCameraPos[i].copyFrom(st.cameraPos);
    csm._transformMatricesAsArray.set(st.array, i * 16);
  }
  dispose() {
    for (const d of this.disposers) d();
    this.disposers.length = 0;
    this.depth.dispose();
    void this.scene;
  }
}
function blankState() {
  return {
    sphere: { x: 0, y: 0, z: 0, r: 0 },
    view: Matrix.Identity(),
    proj: Matrix.Identity(),
    transform: Matrix.Identity(),
    min: new Vector3(),
    max: new Vector3(),
    center: new Vector3(),
    cameraPos: new Vector3(),
    array: new Float32Array(16),
    light: new Vector3(),
    drawn: 0
  };
}
function sameMatrix(a, b) {
  for (let i = 0; i < 16; i++) if (Math.abs(a[i] - b[i]) > 1e-6) return false;
  return true;
}
function split(from, s, d, isStatic) {
  s.length = 0;
  d.length = 0;
  for (let i = 0; i < from.length; i++) {
    const sub2 = from.data[i];
    const to = isStatic(sub2.getRenderingMesh()) ? s : d;
    to.data[to.length++] = sub2;
  }
}
const BOX = 45;
const AHEAD = 0.4;
const MIN_TEXELS = 6;
const SMALL_CASTER_REACH = 15;
const STATIC_SETTLE_MS = 500;
class Atmosphere {
  constructor(scene, camera, sun, viewRoot, quality = loadGraphicsQuality()) {
    this.scene = scene;
    this.camera = camera;
    this.sun = sun;
    this.viewRoot = viewRoot;
    this.quality = quality;
    applyWorldGrade(scene);
    if (quality === "low") return;
    const webgpu = scene.getEngine().isWebGPU === true;
    if (quality === "high") {
      const csm2 = new CascadedShadowGenerator(2048, sun);
      csm2.numCascades = 3;
      csm2.lambda = 0.85;
      csm2.shadowMaxZ = 120;
      csm2.stabilizeCascades = true;
      csm2.cascadeBlendPercentage = 0.08;
      this.shadows = csm2;
    } else {
      sun.autoUpdateExtends = false;
      sun.autoCalcShadowZBounds = false;
      sun.orthoLeft = -BOX;
      sun.orthoRight = BOX;
      sun.orthoTop = BOX;
      sun.orthoBottom = -BOX;
      sun.shadowMinZ = 1;
      sun.shadowMaxZ = 400;
      this.shadows = new ShadowGenerator(2048, sun);
      this.observers.push(scene.onBeforeRenderObservable.add(() => this.follow()));
    }
    const s = this.shadows;
    s.usePercentageCloserFiltering = true;
    s.filteringQuality = quality === "high" ? ShadowGenerator.QUALITY_HIGH : ShadowGenerator.QUALITY_MEDIUM;
    s.bias = 1e-3;
    s.normalBias = 0.014;
    s.darkness = 0.1;
    s.transparencyShadow = false;
    const reach = quality === "high" ? 180 : BOX * Math.SQRT2 + BOX * AHEAD + 10;
    const near = [];
    const nearMoving = [];
    let nearFrame = -1;
    const csm = s instanceof CascadedShadowGenerator ? s : null;
    const at = new Vector3();
    const map = s.getShadowMap();
    const square = { frame: -1, layer: -1, ok: false, kx: 0, ky: 0, minRadius: 0 };
    let counted = -1;
    this.cache = map && perfOn("shadowcache") ? ShadowCache.attach(scene, s, csm) : null;
    const cache = this.cache;
    if (map) {
      map.getCustomRenderList = (pass, list, length) => {
        if (!list) return null;
        const frame = scene.getFrameId();
        const pick = () => cache && !cache.drawsStatic(pass) ? nearMoving : near;
        if (frame === nearFrame) return pick();
        nearFrame = frame;
        near.length = 0;
        nearMoving.length = 0;
        const c = this.camera.globalPosition;
        const off = this.shadowless;
        for (let i = 0; i < length; i++) {
          const m = list[i];
          const b = m.getBoundingInfo().boundingSphere;
          const d = Vector3.Distance(b.centerWorld, c) - b.radiusWorld;
          if (d > reach) continue;
          if (d > SMALL_CASTER_REACH && m.metadata?.smallCaster) continue;
          if (off.size && underAny(m, off)) continue;
          near.push(m);
          if (!(cache ? cache.isStatic(m) : isStaticCaster(m))) nearMoving.push(m);
        }
        return pick();
      };
      s.customAllowRendering = (sub2) => {
        const m = sub2.getRenderingMesh();
        const frame = scene.getFrameId();
        if (counted !== frame) {
          counted = frame;
          this.casterCount = 0;
        }
        if (m.hasInstances) {
          this.casterCount++;
          return true;
        }
        const layer = csm ? csm._currentLayer ?? 0 : 0;
        if (square.frame !== frame || square.layer !== layer) {
          square.frame = frame;
          square.layer = layer;
          const lo = csm ? csm.getCascadeMinExtents(layer) : null;
          const hi = csm ? csm.getCascadeMaxExtents(layer) : null;
          square.ok = !csm || !!lo && !!hi && hi.x > lo.x && hi.y > lo.y;
          square.kx = csm && square.ok ? 2 / (hi.x - lo.x) : 1 / BOX;
          square.ky = csm && square.ok ? 2 / (hi.y - lo.y) : 1 / BOX;
          square.minRadius = MIN_TEXELS / (square.kx * map.getSize().width);
        }
        if (!square.ok) return true;
        const toMap = csm ? csm.getCascadeTransformMatrix(layer) : s.getTransformMatrix();
        if (!toMap) return true;
        const b = m.getBoundingInfo().boundingSphere;
        if (b.radiusWorld < square.minRadius && !m.hasThinInstances) return false;
        Vector3.TransformCoordinatesToRef(b.centerWorld, toMap, at);
        const r = b.radiusWorld;
        if (Math.abs(at.x) - r * square.kx > 1 || Math.abs(at.y) - r * square.ky > 1) return false;
        this.casterCount++;
        return true;
      };
    }
    for (const m of scene.meshes) this.pending.push(m);
    this.observers.push(scene.onNewMeshAddedObservable.add((m) => this.pending.push(m)));
    this.observers.push(scene.onBeforeRenderObservable.add(() => this.sortPending()));
    if (quality === "high") {
      try {
        this.pipeline = new DefaultRenderingPipeline("atmos", true, scene, [camera]);
        this.pipeline.bloomEnabled = true;
        this.pipeline.bloomThreshold = 0.82;
        this.pipeline.bloomWeight = 0.22;
        this.pipeline.bloomKernel = 48;
        if (webgpu || (scene.getEngine().webGLVersion ?? 1) >= 2) this.pipeline.samples = 4;
        else this.pipeline.fxaaEnabled = true;
        this.pipeline.imageProcessingEnabled = true;
        if (!webgpu) {
          this.ssao = new SSAO2RenderingPipeline("atmosAO", scene, { ssaoRatio: 0.5, blurRatio: 1 }, [camera]);
          this.ssao.radius = 1.3;
          this.ssao.totalStrength = 1.15;
          this.ssao.samples = 16;
          this.ssao.bilateralSoften = 0.04;
          this.ssao.maxZ = 120;
        }
      } catch {
        this.pipeline = null;
        this.ssao = null;
      }
    }
  }
  scene;
  camera;
  sun;
  viewRoot;
  quality;
  shadows = null;
  pipeline = null;
  ssao = null;
  pending = [];
  observers = [];
  /**
   * Nodes whose meshes cast no shadow for now (a crowd's far characters: see
   * GameView.updateAvatars). They still catch shadows.
   */
  shadowless = /* @__PURE__ */ new Set();
  /** Meshes the shadow map drew in the last frame (the performance overlay shows it). */
  casterCount = 0;
  /** The static shadow cache (null on low, WebGPU and WebGL1, or with `?perfoff=shadowcache`). */
  cache = null;
  /** Medium: where the shadow box was last put (it moves only past BOX_SLACK while the static cache is on). */
  boxAt = null;
  /**
   * Static casters wait here a moment (the level and the props stream in over a few frames) and then cast through
   * merged proxies (shadowProxy.ts), one batch at a time.
   */
  staticQueue = [];
  staticAt = 0;
  batches = [];
  batchCount = 0;
  /** Static casters queued for half a second without a new one: merge them into a batch of proxies. */
  flushStatic(now) {
    for (const b2 of this.batches) if (b2.dirty) this.rebuild(b2);
    if (!this.staticQueue.length || now - this.staticAt < STATIC_SETTLE_MS) return;
    const b = { sources: this.staticQueue.splice(0).filter((m) => !m.isDisposed()), proxies: [], dirty: false };
    this.batches.push(b);
    this.rebuild(b);
  }
  /** (Re)build a batch's proxies: its sources still there and still static; those that no longer are cast on their own. */
  rebuild(b) {
    const map = this.shadows?.getShadowMap();
    if (!map?.renderList) return;
    b.dirty = false;
    for (const p of b.proxies) p.dispose();
    const keep = b.sources.filter((m) => !m.isDisposed());
    const { proxies, sources } = buildShadowProxies(this.scene, keep, String(this.batchCount++));
    const merged = new Set(sources);
    for (const m of keep) {
      if (merged.has(m)) continue;
      if (m.metadata && m.metadata.shadowProxied) m.metadata.shadowProxied = false;
      if (!map.renderList.includes(m)) addCaster(map, m);
    }
    for (const m of sources) {
      if (!b.sources.includes(m)) continue;
      m.metadata = { ...m.metadata, shadowProxied: true };
      if (!this.watched.has(m)) {
        this.watched.add(m);
        m.onDisposeObservable.addOnce(() => {
          this.watched.delete(m);
          for (const x of this.batches) if (x.sources.includes(m)) x.dirty = true;
        });
      }
    }
    b.sources = sources;
    for (const p of proxies) addCaster(map, p);
    b.proxies = proxies;
    this.cache?.invalidate();
  }
  watched = /* @__PURE__ */ new Set();
  /** Shadow proxies in use, and how many meshes they stand in for (tests and the perf probe). */
  get proxyStats() {
    return { proxies: this.batches.reduce((n, b) => n + b.proxies.length, 0), sources: this.batches.reduce((n, b) => n + b.sources.length, 0) };
  }
  /** Is this mesh part of the world that should cast and catch shadows? */
  worldly(m) {
    if (m.isDisposed() || m.getTotalVertices() === 0) return false;
    if (m.renderingGroupId !== 0 || m.infiniteDistance) return false;
    for (let n = m; n; n = n.parent) if (n.name.startsWith("backdrop_")) return false;
    if (m.isDescendantOf(this.viewRoot)) return false;
    if (m.metadata?.effect) return false;
    const mat2 = m.material;
    if (mat2?.disableLighting) return false;
    return true;
  }
  sortPending() {
    if (!this.shadows) return;
    this.flushStatic(performance.now());
    if (!this.pending.length) return;
    const map = this.shadows.getShadowMap();
    if (!map) return;
    for (const m of this.pending.splice(0)) {
      if (!this.worldly(m)) continue;
      if (!m.isAnInstance) m.receiveShadows = true;
      const mat2 = m.material;
      if (mat2 && mat2.alpha !== void 0 && mat2.alpha < 0.99) continue;
      if (m.name.startsWith("foliage")) continue;
      if (m.metadata?.castsNoShadow) continue;
      if (underSmall(m)) m.metadata = { ...m.metadata, smallCaster: true };
      if (!m.metadata?.smallCaster && proxyable(m)) {
        this.staticQueue.push(m);
        this.staticAt = performance.now();
        continue;
      }
      addCaster(map, m);
    }
  }
  /** Medium: keep the shadow box centred on the camera, snapped to its texels so edges don't shimmer. */
  follow() {
    const dir = this.sun.direction.normalizeToNew();
    const step = BOX * 2 / 2048;
    const fwd = this.camera.getDirection(Vector3.Forward());
    const flat = Math.hypot(fwd.x, fwd.z) || 1;
    const c = this.camera.globalPosition;
    const cx = c.x + fwd.x / flat * BOX * AHEAD;
    const cz = c.z + fwd.z / flat * BOX * AHEAD;
    const at = new Vector3(Math.round(cx / step) * step, Math.round(c.y / step) * step, Math.round(cz / step) * step);
    if (this.cache && this.boxAt && Vector3.Distance(at, this.boxAt) < BOX_SLACK) return;
    this.boxAt = at;
    this.cache?.moved();
    this.sun.position = at.subtract(dir.scale(200));
  }
  dispose() {
    for (const o of this.observers) o.remove();
    for (const b of this.batches) for (const p of b.proxies) p.dispose();
    this.cache?.dispose();
    this.pipeline?.dispose();
    this.ssao?.dispose();
    this.shadows?.dispose();
  }
}
function addCaster(map, m) {
  map.renderList?.push(m);
  m.onDisposeObservable.addOnce(() => {
    const list = map.renderList;
    const i = list?.indexOf(m) ?? -1;
    if (list && i >= 0) list.splice(i, 1);
  });
}
function underAny(n, roots) {
  for (let p = n; p; p = p.parent) if (roots.has(p)) return true;
  return false;
}
const PROP_SECTOR = 128;
function propSectorSize(level) {
  return PROP_SECTOR * Math.min(4, 2 ** Math.max(0, level));
}
const PROP_BATCH_MIN = 8;
const HYSTERESIS = 0.1;
class PropBatches {
  constructor(scene, sources, smallReach) {
    this.scene = scene;
    this.sources = sources;
    this.smallReach = smallReach;
  }
  scene;
  sources;
  smallReach;
  models = /* @__PURE__ */ new Map();
  groups = /* @__PURE__ */ new Map();
  near = /* @__PURE__ */ new Map();
  lastX = Infinity;
  lastY = Infinity;
  lastZ = Infinity;
  seq = 0;
  disposed = false;
  /**
   * Draw the prop under `root` (placed and turned: its world matrix is the copy's) as a copy of model `path` in its
   * square's batch. Resolves false when the model can't be batched: the caller draws it as before.
   */
  add(path, root, small, tint, indoor = false) {
    const p = this.join(path, root, small, tint, indoor);
    this.pending.push(p);
    return p;
  }
  pending = [];
  /** Every copy added so far is in its batch (or turned away). */
  async settled() {
    await Promise.allSettled(this.pending);
  }
  async join(path, root, small, tint, indoor) {
    const model = await this.model(path);
    if (!model || this.disposed || root.isDisposed()) return false;
    root.computeWorldMatrix(true);
    root.freezeWorldMatrix();
    const w = root.getWorldMatrix();
    const matrix = Float32Array.from(w.m);
    const c = Vector3.TransformCoordinates(model.center, w);
    const s = Math.max(w.getRow(0).length(), w.getRow(1).length(), w.getRow(2).length());
    const color2 = tint ? [...Color3.FromHexString(tint).asArray(), 1] : [1, 1, 1, 1];
    let g = this.groups.get(path);
    if (!g) this.groups.set(path, g = { model, copies: [], tinted: false, stale: false, batches: /* @__PURE__ */ new Map() });
    const copy = { root, matrix, color: color2, x: c.x, y: c.y, z: c.z, r: model.radius * s, level: -1, small, indoor, quiet: small || indoor };
    g.copies.push(copy);
    if (tint) g.tinted = true;
    g.stale = true;
    if (small && !indoor) this.nearOf(model).copies.push(copy);
    this.lastX = Infinity;
    return true;
  }
  /** The model's levels for batching (null: not batchable). */
  model(path) {
    let p = this.models.get(path);
    if (!p) {
      p = this.sources(path).then(
        (src) => src ? toModel(path, src) : null,
        () => null
      );
      this.models.set(path, p);
    }
    return p;
  }
  /**
   * Each frame (cheap unless the camera moved a metre): every copy's level of detail from the camera, the batches
   * whose copies changed level rebuilt, and the small copies near the camera into the shadow-only batches.
   */
  update(camera) {
    if ((camera.x - this.lastX) ** 2 + (camera.y - this.lastY) ** 2 + (camera.z - this.lastZ) ** 2 < 1) return;
    this.lastX = camera.x;
    this.lastY = camera.y;
    this.lastZ = camera.z;
    for (const g of this.groups.values()) {
      if (g.stale) {
        g.stale = false;
        for (const b of g.batches.values()) this.disposeBatch(b);
        g.batches.clear();
        const loud = /* @__PURE__ */ new Set();
        for (const k of g.copies) if (!k.small && !k.indoor) loud.add(sectorKey(k, PROP_SECTOR));
        for (const k of g.copies) {
          k.level = -1;
          k.quiet = k.indoor || !loud.has(sectorKey(k, PROP_SECTOR));
        }
        for (let l = 0; l < g.model.levels.length; l++) for (const k of g.copies) this.batch(g, l, k);
      }
      const levels = g.model.levels;
      for (const c of g.copies) {
        const d = Math.hypot(c.x - camera.x, c.y - camera.y, c.z - camera.z);
        let level = 0;
        for (let i = 1; i < levels.length; i++) if (d >= levels[i].distance) level = i;
        if (c.level >= 0 && level !== c.level) {
          const edge = levels[Math.max(level, c.level)].distance;
          if (Math.abs(d - edge) < edge * HYSTERESIS) level = c.level;
        }
        if (level === c.level) continue;
        if (c.level >= 0) this.batch(g, c.level, c).dirty = true;
        this.batch(g, level, c).dirty = true;
        c.level = level;
      }
      for (const b of g.batches.values()) if (b.dirty) this.fill(b);
    }
    for (const n of this.near.values()) this.fillNear(n, camera);
  }
  /** The batch drawing copy `c` of group `g` at `level` (its square at that level's size, cast or quiet). */
  batch(g, level, c) {
    const size = propSectorSize(level);
    const sector = sectorKey(c, size);
    const key = `${level}|${sector}|${c.quiet ? 1 : 0}`;
    let b = g.batches.get(key);
    if (b) return b;
    const copies = g.copies.filter((o) => o.quiet === c.quiet && sectorKey(o, size) === sector);
    const n = copies.length;
    const matrices = new Float32Array(n * 16);
    const colors = g.tinted ? new Float32Array(n * 4) : null;
    const lod = g.model.levels.length > 1;
    const allSmall = c.quiet;
    const meshes = g.model.levels[level].parts.map((part, pi) => {
      const mesh = this.partMesh(`static_batch_${this.seq++}_${g.model.path}_l${level}_p${pi}_${sector}`, part);
      mesh.thinInstanceSetBuffer("matrix", matrices, 16, false);
      if (colors) mesh.thinInstanceSetBuffer("color", colors, 4, false);
      mesh.metadata = allSmall ? { castsNoShadow: true, propBatch: true } : lod ? { propBatch: true } : { staticThin: true, propBatch: true };
      return mesh;
    });
    b = { level, copies, meshes, matrices, colors, dirty: true };
    g.batches.set(key, b);
    return b;
  }
  /** A batch mesh from a level part: its own geometry (thin instance buffers live on the geometry), placed for good. */
  partMesh(name, part) {
    const mesh = new Mesh(name, this.scene);
    part.data.applyToMesh(mesh, false);
    mesh.material = part.material;
    mesh.sideOrientation = part.sideOrientation;
    mesh.hasVertexAlpha = part.hasVertexAlpha;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    mesh.doNotSyncBoundingInfo = true;
    return mesh;
  }
  fill(b) {
    b.dirty = false;
    let count = 0;
    for (const c of b.copies) {
      if (c.level !== b.level) continue;
      b.matrices.set(c.matrix, 16 * count);
      b.colors?.set(c.color, 4 * count);
      count++;
    }
    for (const mesh of b.meshes) {
      mesh.setEnabled(count > 0);
      if (!count) continue;
      mesh.thinInstanceCount = count;
      mesh.thinInstanceBufferUpdated("matrix");
      if (b.colors) mesh.thinInstanceBufferUpdated("color");
      mesh.thinInstanceRefreshBoundingInfo(false);
    }
  }
  nearOf(model) {
    let n = this.near.get(model.path);
    if (n) return n;
    const level = model.levels[0];
    const matrices = new Float32Array(16);
    const meshes = level.parts.map((part, pi) => {
      const mesh = this.partMesh(`static_batch_near_${this.seq++}_${model.path}_p${pi}`, part);
      mesh.layerMask = 0;
      mesh.thinInstanceSetBuffer("matrix", matrices, 16, false);
      mesh.setEnabled(false);
      mesh.metadata = { propBatch: true, nearCaster: true, smallCaster: true };
      return mesh;
    });
    n = { model, copies: [], meshes, matrices, shown: -1 };
    this.near.set(model.path, n);
    return n;
  }
  fillNear(n, camera) {
    if (n.matrices.length < n.copies.length * 16) {
      n.matrices = new Float32Array(n.copies.length * 16);
      for (const m of n.meshes) m.thinInstanceSetBuffer("matrix", n.matrices, 16, false);
      n.shown = -1;
    }
    let count = 0;
    for (const c of n.copies) {
      const d = Math.hypot(c.x - camera.x, c.y - camera.y, c.z - camera.z) - c.r;
      if (d > this.smallReach || !c.root.isEnabled()) continue;
      n.matrices.set(c.matrix, 16 * count++);
    }
    if (count === 0 && n.shown === 0) return;
    n.shown = count;
    for (const m of n.meshes) {
      m.setEnabled(count > 0);
      if (!count) continue;
      m.thinInstanceCount = count;
      m.thinInstanceBufferUpdated("matrix");
      m.thinInstanceRefreshBoundingInfo(false);
    }
  }
  disposeBatch(b) {
    for (const m of b.meshes) m.dispose(false, false);
  }
  /** Counts for tests and the perf probe. */
  stats() {
    let meshes = 0;
    let copies = 0;
    const models = /* @__PURE__ */ new Set();
    for (const g of this.groups.values()) {
      copies += g.copies.length;
      models.add(g.model.path);
      for (const b of g.batches.values()) meshes += b.meshes.length;
    }
    return { meshes, copies, models: models.size };
  }
  dispose() {
    this.disposed = true;
    for (const g of this.groups.values()) for (const b of g.batches.values()) this.disposeBatch(b);
    this.groups.clear();
    for (const n of this.near.values()) for (const m of n.meshes) m.dispose(false, false);
    this.near.clear();
  }
}
function toModel(path, sources) {
  if (!sources.length) return null;
  const part = (m) => ({ data: VertexData.ExtractFromMesh(m, true, true), material: m.material, sideOrientation: m.sideOrientation, hasVertexAlpha: m.hasVertexAlpha });
  const levels = [{ distance: 0, parts: sources.map(part) }];
  for (const l of sources[0].getLODLevels()) {
    if (l.mesh && l.mesh.billboardMode !== Mesh.BILLBOARDMODE_NONE) return null;
    levels.push({ distance: l.distanceOrScreenCoverage, parts: l.mesh ? [part(l.mesh)] : [] });
  }
  levels.sort((a, b) => a.distance - b.distance);
  let min = new Vector3(Infinity, Infinity, Infinity);
  let max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const m of sources) {
    const bb = m.getBoundingInfo().boundingBox;
    min = Vector3.Minimize(min, bb.minimum);
    max = Vector3.Maximize(max, bb.maximum);
  }
  const center = min.add(max).scale(0.5);
  return { path, levels, center, radius: max.subtract(min).length() / 2 };
}
function sectorKey(c, size) {
  return `${Math.floor(c.x / size)}:${Math.floor(c.z / size)}`;
}
const MAX_DOTS = 90;
class ThrowArc {
  dot;
  bounceRing;
  area;
  dots = [];
  rings = [];
  constructor(scene) {
    const glow2 = (name, hex, alpha = 1) => {
      const m = new StandardMaterial(name, scene);
      m.disableLighting = true;
      m.emissiveColor = Color3.FromHexString(hex);
      m.alpha = alpha;
      return m;
    };
    this.dot = CreateSphere("throwDot", { diameter: 0.07, segments: 4 }, scene);
    this.dot.material = glow2("throwDotMat", "#ffe27a");
    this.bounceRing = CreateTorus("throwBounce", { diameter: 0.35, thickness: 0.04, tessellation: 16 }, scene);
    this.bounceRing.material = glow2("throwBounceMat", "#ffffff");
    this.area = CreateDisc("throwArea", { radius: 1, tessellation: 40 }, scene);
    this.area.material = glow2("throwAreaMat", "#ff4a3a", 0.28);
    this.area.rotation.x = Math.PI / 2;
    for (const m of [this.dot, this.bounceRing, this.area]) m.isPickable = false;
    for (const m of [this.dot, this.bounceRing]) {
      m.scaling.setAll(0);
      m.alwaysSelectAsActiveMesh = true;
    }
    this.area.setEnabled(false);
  }
  /** Show the arc for `path`, ending in an area of `radius` metres; null hides it. */
  show(path, radius) {
    if (!path) {
      this.hide();
      return;
    }
    const step = Math.max(1, Math.ceil(path.points.length / MAX_DOTS));
    const wanted = path.points.filter((_, i) => i % step === 0 && i > 0);
    const instance = (src) => {
      const i = src.createInstance(`${src.name}I`);
      i.scaling.setAll(1);
      i.isPickable = false;
      return i;
    };
    while (this.dots.length < wanted.length) this.dots.push(instance(this.dot));
    this.dots.forEach((d, i) => {
      const p = wanted[i];
      d.setEnabled(!!p);
      if (p) d.position.set(p.x, p.y, p.z);
    });
    while (this.rings.length < path.bounces.length) this.rings.push(instance(this.bounceRing));
    this.rings.forEach((r, i) => {
      const p = path.bounces[i];
      r.setEnabled(!!p);
      if (p) r.position.set(p.x, p.y + 0.02, p.z);
    });
    this.area.setEnabled(true);
    this.area.position.set(path.end.x, path.end.y + 0.04, path.end.z);
    this.area.scaling.setAll(radius);
  }
  hide() {
    for (const d of this.dots) d.setEnabled(false);
    for (const r of this.rings) r.setEnabled(false);
    this.area.setEnabled(false);
  }
}
const textures = /* @__PURE__ */ new WeakMap();
function flashTexture(scene) {
  const cached = textures.get(scene);
  if (cached) return cached;
  const size = 128;
  const tex = new DynamicTexture("muzzleFlashTex", { width: size, height: size }, scene, true);
  const ctx = tex.getContext();
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  const glow2 = ctx.createRadialGradient(c, c, 0, c, c, c);
  glow2.addColorStop(0, "rgba(255,255,240,1)");
  glow2.addColorStop(0.18, "rgba(255,220,120,0.95)");
  glow2.addColorStop(0.45, "rgba(255,140,40,0.45)");
  glow2.addColorStop(1, "rgba(255,90,20,0)");
  ctx.fillStyle = glow2;
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + i % 2 * 0.3;
    const len2 = c * (i % 2 ? 0.65 : 0.98);
    const w = c * 0.1;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * len2, c + Math.sin(a) * len2);
    ctx.lineTo(c + Math.cos(a + Math.PI / 2) * w, c + Math.sin(a + Math.PI / 2) * w);
    ctx.lineTo(c - Math.cos(a) * w, c - Math.sin(a) * w);
    ctx.lineTo(c + Math.cos(a - Math.PI / 2) * w, c + Math.sin(a - Math.PI / 2) * w);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(c, c, c * 0.32, 0, Math.PI * 2);
  ctx.fill();
  tex.hasAlpha = true;
  tex.update();
  textures.set(scene, tex);
  return tex;
}
function createStarFlash(scene, name, size) {
  const plane = CreatePlane(name, { size }, scene);
  const mat2 = new StandardMaterial(`${name}Mat`, scene);
  mat2.diffuseTexture = flashTexture(scene);
  mat2.emissiveTexture = mat2.diffuseTexture;
  mat2.opacityTexture = mat2.diffuseTexture;
  mat2.emissiveColor = new Color3(1, 0.85, 0.6);
  mat2.disableLighting = true;
  mat2.backFaceCulling = false;
  mat2.alphaMode = Constants.ALPHA_ADD;
  plane.material = mat2;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  plane.setEnabled(false);
  return plane;
}
function kickFlash(flash, scale, opacity = 1) {
  flash.scaling.setAll(scale * (0.75 + Math.random() * 0.5));
  const mat2 = flash.material;
  mat2.alpha = opacity;
  const tex = mat2.diffuseTexture;
  if (tex) tex.wAng = Math.random() * Math.PI * 2;
}
const FX_MAP = {
  "muzzle": {
    "pistol": {
      "effect": "short_flash_01",
      "scale": 0.15
    },
    "revolver": {
      "effect": "short_flash_03",
      "scale": 0.18
    },
    "machine_pistol": {
      "effect": "short_flash_04",
      "scale": 0.15
    },
    "smg": {
      "effect": "muzzle_flash_02",
      "scale": 0.17
    },
    "rifle": {
      "effect": "muzzle_flash_01",
      "scale": 0.2
    },
    "marksman": {
      "effect": "muzzle_flash_05",
      "scale": 0.2
    },
    "precision": {
      "effect": "big_flash_06",
      "scale": 0.13
    },
    "lmg": {
      "effect": "big_flash_01",
      "scale": 0.13
    },
    "shotgun": {
      "effect": "wide_flash_01",
      "scale": 0.24
    },
    "projectile": {
      "effect": "big_flash_04",
      "scale": 0.14
    },
    "pellets": {
      "effect": "wide_flash_01",
      "scale": 0.22
    },
    "heavy": {
      "effect": "big_flash_01",
      "scale": 0.13
    },
    "default": {
      "effect": "muzzle_flash_01",
      "scale": 0.18
    }
  },
  "impacts": {
    "accentRange": 45,
    "concrete": {
      "sparks": 2,
      "dust": "#a39d92",
      "dustSize": 1,
      "accent": null
    },
    "stone": {
      "sparks": 2,
      "dust": "#a39d92",
      "dustSize": 1,
      "accent": null
    },
    "rock": {
      "sparks": 2,
      "dust": "#8f897e",
      "dustSize": 1.1,
      "chips": 3,
      "chip": "#6d6860",
      "accent": null
    },
    "brick": {
      "sparks": 1,
      "dust": "#a8735e",
      "dustSize": 1,
      "chips": 2,
      "chip": "#8c4a35",
      "accent": null
    },
    "plaster": {
      "dust": "#e0d9cb",
      "dustSize": 1.2,
      "accent": null
    },
    "wood": {
      "dust": "#8a6a45",
      "dustSize": 0.9,
      "chips": 4,
      "chip": "#a07a4a",
      "accent": null
    },
    "thin_wood": {
      "dust": "#8a6a45",
      "dustSize": 0.9,
      "chips": 4,
      "chip": "#a8804e",
      "accent": null
    },
    "bark": {
      "dust": "#6e5238",
      "dustSize": 0.8,
      "chips": 5,
      "chip": "#5c4129",
      "accent": null
    },
    "foliage": {
      "dust": "#6a8240",
      "dustSize": 0.6,
      "chips": 6,
      "chip": "#4f7f2c",
      "accent": null
    },
    "metal": {
      "sparks": 8,
      "dust": "#8e8a84",
      "dustSize": 0.5,
      "accent": {
        "pack": "hit_fx",
        "effect": "vfx_strike_01",
        "scale": 0.1
      }
    },
    "sheet_metal": {
      "sparks": 8,
      "dust": "#8e8a84",
      "dustSize": 0.5,
      "accent": {
        "pack": "hit_fx",
        "effect": "vfx_strike_01",
        "scale": 0.1
      }
    },
    "glass": {
      "dust": "#d6e0e4",
      "dustSize": 0.4,
      "chips": 3,
      "chip": "#e4f0f4",
      "accent": null
    },
    "dirt": {
      "dust": "#7d6a52",
      "dustSize": 1.4,
      "accent": null
    },
    "grass": {
      "dust": "#6f6b48",
      "dustSize": 1.3,
      "accent": null
    },
    "sand": {
      "dust": "#cdb88e",
      "dustSize": 1.6,
      "accent": null
    },
    "gravel": {
      "dust": "#8a867e",
      "dustSize": 1.2,
      "chips": 2,
      "chip": "#6f6b65",
      "accent": null
    },
    "snow": {
      "dust": "#eef2f6",
      "dustSize": 1.6,
      "accent": null
    },
    "water": {
      "accent": {
        "pack": "hit_fx",
        "effect": "vfx_strike_02",
        "scale": 0.14
      }
    },
    "flesh": {
      "accent": {
        "pack": "hit_fx",
        "effect": "vfx_strike_03",
        "scale": 0.08
      }
    },
    "fabric": {
      "dust": "#b8ad93",
      "dustSize": 0.8,
      "accent": null
    },
    "plastic": {
      "dust": "#c4c4c0",
      "dustSize": 0.6,
      "chips": 2,
      "chip": "#d0d0cc",
      "accent": null
    },
    "armor": {
      "sparks": 10,
      "dust": "#8e8a84",
      "dustSize": 0.4,
      "accent": {
        "pack": "hit_fx",
        "effect": "vfx_strike_01",
        "scale": 0.1
      }
    },
    "energy": {
      "sparks": 4,
      "accent": null
    }
  },
  "weaponImpacts": {
    "core.railgun": {
      "pack": "hit_fx",
      "effect": "vfx_big_impact_01",
      "scale": 0.4
    },
    "melee": {
      "pack": "hit_fx",
      "effect": "vfx_hit_01",
      "scale": 0.22
    },
    "melee.alt": {
      "pack": "hit_fx",
      "effect": "vfx_hit_02",
      "scale": 0.22
    }
  },
  "explosions": {
    "grenade": {
      "pack": "explosion_fx",
      "effect": "vfx_ground_explosion_01",
      "scale": 0.38
    },
    "rocket": {
      "pack": "explosion_fx",
      "effect": "vfx_ground_explosion_03",
      "scale": 0.36
    },
    "core.tank_cannon": {
      "pack": "explosion_fx",
      "effect": "vfx_ground_explosion_04",
      "scale": 0.36
    },
    "orb": {
      "pack": "explosion_fx",
      "effect": "vfx_burst_explosion_02",
      "scale": 0.34
    },
    "disc": {
      "pack": "explosion_fx",
      "effect": "vfx_burst_explosion_01",
      "scale": 0.3
    },
    "plasma": {
      "pack": "hit_fx",
      "effect": "vfx_impact_04",
      "scale": 0.35
    },
    "flare": {
      "pack": "hit_fx",
      "effect": "vfx_impact_05",
      "scale": 0.4
    },
    "barrel": {
      "pack": "explosion_fx",
      "effect": "vfx_burst_explosion_03",
      "scale": 0.4
    },
    "core.ammo_box": {
      "pack": "explosion_fx",
      "effect": "vfx_burst_explosion_01",
      "scale": 0.28
    },
    "trap": {
      "pack": "explosion_fx",
      "effect": "vfx_ground_explosion_02",
      "scale": 0.38
    },
    "bomb": {
      "pack": "explosion_fx",
      "effect": "vfx_nuke_explosion_01",
      "scale": 0.3
    },
    "vehicle": {
      "pack": "explosion_fx",
      "effect": "vfx_ground_explosion_04",
      "scale": 0.5
    },
    "air": {
      "pack": "explosion_fx",
      "effect": "vfx_air_explosion_01",
      "scale": 0.38
    },
    "default": {
      "pack": "explosion_fx",
      "effect": "vfx_ground_explosion_01",
      "scale": 0.38
    }
  },
  "gameplay": {
    "pickup": {
      "pack": "hit_fx",
      "effect": "vfx_strike_02",
      "scale": 0.3
    },
    "pickup.health": {
      "pack": "hit_fx",
      "effect": "vfx_strike_03",
      "scale": 0.3
    },
    "pickup.weapon": {
      "pack": "hit_fx",
      "effect": "vfx_hit_01",
      "scale": 0.25
    },
    "pickup.powerup": {
      "pack": "hit_fx",
      "effect": "vfx_hit_07",
      "scale": 0.35
    },
    "pickup.armor": {
      "pack": "hit_fx",
      "effect": "vfx_strike_04",
      "scale": 0.3,
      "tint": "#2f6dff"
    },
    "armor.break": {
      "pack": "hit_fx",
      "effect": "vfx_hit_05",
      "scale": 0.24,
      "tint": "#8cc8ff"
    },
    "hit.big": {
      "pack": "hit_fx",
      "effect": "vfx_big_impact_01",
      "scale": 0.22
    },
    "streak": {
      "pack": "hit_fx",
      "effect": "vfx_big_impact_02",
      "scale": 0.22,
      "tint": "#ffc93c"
    },
    "spawn": {
      "pack": "hit_fx",
      "effect": "vfx_impact_03",
      "scale": 0.45
    },
    "portal": {
      "pack": "hit_fx",
      "effect": "vfx_impact_07",
      "scale": 0.45
    },
    "pad": {
      "pack": "hit_fx",
      "effect": "vfx_impact_04",
      "scale": 0.35
    },
    "trap": {
      "pack": "hit_fx",
      "effect": "vfx_impact_06",
      "scale": 0.4
    },
    "trap.shock": {
      "pack": "electric_fx",
      "effect": "vfx_impact_lightning_01",
      "scale": 0.5
    },
    "zipline": {
      "pack": "hit_fx",
      "effect": "vfx_strike_01",
      "scale": 0.14
    }
  },
  "arcs": {
    "default": {
      "zap": {
        "pack": "electric_fx",
        "effect": "vfx_zap_lightning_01",
        "scale": 0.4
      },
      "hit": {
        "pack": "electric_fx",
        "effect": "vfx_impact_lightning_01",
        "scale": 0.35
      },
      "speed": 3
    },
    "mount": {
      "zap": {
        "pack": "electric_fx",
        "effect": "vfx_zap_lightning_04",
        "scale": 0.36
      },
      "hit": {
        "pack": "electric_fx",
        "effect": "vfx_impact_lightning_04",
        "scale": 0.35
      },
      "speed": 4
    },
    "fence": {
      "zap": {
        "pack": "electric_fx",
        "effect": "vfx_zap_lightning_01",
        "scale": 0.22
      },
      "hit": {
        "pack": "electric_fx",
        "effect": "vfx_impact_lightning_01",
        "scale": 0.3
      },
      "speed": 2.5
    }
  },
  "lasting": {
    "charge.sentry_arc": {
      "pack": "electric_fx",
      "effect": "vfx_ball_lightning_04",
      "scale": 0.6
    },
    "shield.spawn": {
      "pack": "electric_fx",
      "effect": "vfx_ball_lightning_04",
      "scale": 1.1
    },
    "aura.damage": {
      "pack": "flame_fx",
      "effect": "vfx_purple_fire_02",
      "scale": 1.2
    },
    "aura.speed": {
      "pack": "flame_fx",
      "effect": "vfx_cold_fire_02",
      "scale": 1.2
    },
    "fire.zone": {
      "pack": "flame_fx",
      "effect": "vfx_basic_fire_02",
      "scale": 1.1
    },
    "fire.vehicle": {
      "pack": "flame_fx",
      "effect": "vfx_basic_fire_01",
      "scale": 1.1
    },
    "fire.wreck": {
      "pack": "flame_fx",
      "effect": "vfx_basic_fire_01",
      "scale": 0.5
    },
    "fire.flare": {
      "pack": "flame_fx",
      "effect": "vfx_basic_fire_01",
      "scale": 0.3
    },
    "smoke.flare": {
      "pack": "smoke_fx",
      "effect": "smoke_thin_vfx_01",
      "scale": 0.2,
      "tint": "#ff6a48"
    },
    "fire.trap": {
      "pack": "flame_fx",
      "effect": "vfx_basic_fire_02",
      "scale": 0.8
    },
    "cloud.toxic": {
      "pack": "poison_fx",
      "effect": "poison_cloud_vfx_01",
      "scale": 0.5
    },
    "smoke.wreck": {
      "pack": "smoke_fx",
      "effect": "smoke_thin_vfx_01",
      "scale": 0.35
    },
    "flame.brazier": {
      "pack": "flame_fx",
      "effect": "vfx_basic_fire_02",
      "scale": 1,
      "decor": true
    },
    "flame.torch": {
      "pack": "flame_fx",
      "effect": "vfx_basic_candle_02",
      "scale": 2,
      "decor": true
    },
    "flame.candle": {
      "pack": "flame_fx",
      "effect": "vfx_basic_candle_01",
      "scale": 2,
      "decor": true
    },
    "flame.campfire": {
      "pack": "flame_fx",
      "effect": "vfx_basic_bonfire",
      "scale": 1,
      "decor": true
    },
    "loot.weapon": {
      "pack": "loot_fx",
      "effect": "ground_loot_vfx_legendary",
      "scale": 1.25,
      "decor": true,
      "skip": [
        "Ring_02",
        "Flare2",
        "Pillar_01",
        "Pillar_02",
        "ShapeParticles"
      ]
    },
    "loot.health": {
      "pack": "loot_fx",
      "effect": "ground_loot_vfx_uncommon",
      "scale": 1.25,
      "decor": true,
      "skip": [
        "Ring_02",
        "Pillar_01"
      ]
    },
    "loot.armor": {
      "pack": "loot_fx",
      "effect": "ground_loot_vfx_rare",
      "scale": 1.25,
      "decor": true,
      "tint": "#3c8dff",
      "skip": [
        "Ring_02",
        "Flare2",
        "Pillar_01",
        "Pillar_02"
      ]
    },
    "loot.ammo": {
      "pack": "loot_fx",
      "effect": "ground_loot_vfx_common",
      "scale": 1.25,
      "decor": true,
      "skip": [
        "Pillar_01"
      ]
    },
    "portal": {
      "pack": "portal_fx",
      "effect": "gate_portal_vfx_01",
      "scale": 0.4,
      "fixture": true,
      "skip": [
        "StencilMesh",
        "GPUParticles3D"
      ]
    },
    "pad": {
      "pack": "magic_area_fx",
      "effect": "lift_area_vfx_02",
      "scale": 0.75,
      "fixture": true
    },
    "status.burn": {
      "pack": "status_fx",
      "effect": "vfx_status_flame",
      "scale": 0.9
    },
    "status.poison": {
      "pack": "status_fx",
      "effect": "vfx_status_poison",
      "scale": 0.9
    },
    "status.slow": {
      "pack": "status_fx",
      "effect": "vfx_status_rot",
      "scale": 0.9,
      "tint": "#ff5ac8"
    },
    "status.chill": {
      "pack": "status_fx",
      "effect": "vfx_status_ice",
      "scale": 0.9
    }
  }
};
const muzzle = FX_MAP.muzzle;
function muzzleEffectFor(def) {
  if (def.kind === "melee" || def.view.beam || def.id === "core.railgun") return null;
  const own = def.view.muzzle;
  if (own) return { id: own.effect, scale: own.scale ?? 0.2 };
  const m = def.family && muzzle[def.family] || (def.projectile ? muzzle.projectile : !def.ammo ? null : def.pellets > 1 ? muzzle.pellets : def.damage >= 60 ? muzzle.heavy : muzzle.default);
  return m ? { id: m.effect, scale: m.scale } : null;
}
function surfaceIndex(doc) {
  const out = /* @__PURE__ */ new Map();
  for (const e of doc.entities) if (e.kind === "prop") out.set(e.id, propSurface(e.model));
  const theme = doc.classicStructure.theme;
  for (const t of doc.classicStructure.tiles) out.set(t.id, guessSurface(`${t.tile} ${theme}`));
  return out;
}
function surfaceOfBox(box, index) {
  if (!box) return "dirt";
  if (box.surface?.material) return materialSurface(box.surface.material);
  return index?.get(box.sourceId) ?? SURFACE_GUESS_FALLBACK;
}
const SURFACE_GUESS_FALLBACK = guessSurface("");
const impacts = FX_MAP.impacts;
function impactStyle(surface) {
  const t = SURFACE_TYPES[surface] ?? SURFACE_TYPES[SURFACE_GUESS_FALLBACK];
  const s = impacts[t.id];
  const d = typeof s === "object" ? s : {};
  return { sparks: d.sparks ?? 0, dust: d.dust ?? null, dustSize: d.dustSize ?? 1, chips: d.chips ?? 0, chip: d.chip ?? "#808080", hole: t.impact.decal === "hole", sound: t.impact.sound, accent: d.accent ?? null };
}
function impactSoundId(sound) {
  switch (sound) {
    case "hard":
      return "impact.world";
    case "wood":
      return "impact.wood";
    case "metal":
      return "impact.metal";
    case "soft":
      return "impact.soft";
    case "glass":
      return "impact.glass";
    case "water":
      return "water.splash";
    default:
      return null;
  }
}
const ACCENT_RANGE = FX_MAP.impacts.accentRange ?? 45;
const weaponImpacts = FX_MAP.weaponImpacts;
function weaponImpact(def) {
  if (!def) return null;
  return weaponImpacts[def.id] ?? (def.projectile ? weaponImpacts[def.projectile.visual] : void 0) ?? null;
}
function meleeImpact(alt) {
  return weaponImpacts[alt ? "melee.alt" : "melee"] ?? weaponImpacts.melee ?? null;
}
const explosions = FX_MAP.explosions;
function explosionFor(weapon, kind, lookup) {
  const pick = () => {
    if (kind === "vehicle" && explosions.vehicle) return explosions.vehicle;
    if (weapon) {
      if (explosions[weapon]) return explosions[weapon];
      if (weapon === "core.barrel" && explosions.barrel) return explosions.barrel;
      if (weapon === "core.bomb" && explosions.bomb) return explosions.bomb;
      if (weapon.startsWith("core.trap_") && explosions.trap) return explosions.trap;
      const visual = lookup(weapon)?.projectile?.visual;
      if (visual && explosions[visual]) return explosions[visual];
    }
    return kind && kind !== "air" && explosions[kind] || explosions.default;
  };
  const fx = pick();
  return kind === "air" && explosions.air && /ground_explosion/.test(fx.effect) ? explosions.air : fx;
}
const gameplay = FX_MAP.gameplay;
function gameplayFx(key) {
  return gameplay[key] ?? gameplay[key.split(".")[0]] ?? null;
}
const arcs = FX_MAP.arcs ?? {};
function arcFx(source) {
  return arcs[source] ?? arcs.default ?? null;
}
const lasting = FX_MAP.lasting ?? {};
function lastingFx(key) {
  return lasting[key] ?? lasting[key.split(".")[0]] ?? null;
}
function lastingKeys() {
  return Object.keys(lasting);
}
function mappedEffects() {
  const seen = /* @__PURE__ */ new Map();
  const visit = (r) => {
    if (!r || typeof r !== "object") return;
    if ("pack" in r && "effect" in r) seen.set(`${r.pack}/${r.effect}`, r);
    else for (const x of Object.values(r)) visit(x);
  };
  const { muzzle: _m, ...rest } = FX_MAP;
  visit(rest);
  return [...seen.values()];
}
function mappedPacks() {
  return [...new Set(mappedEffects().map((r) => r.pack))];
}
const FAR_FX_NEAR = 3;
const FAR_FX_MOST = 4;
const farFxSize = (d) => Math.max(1, Math.min(FAR_FX_MOST, d / FAR_FX_NEAR));
const SPEED = 1.6;
const EFFECT$2 = { effect: true };
const warmRigs = /* @__PURE__ */ new WeakMap();
const BASE$1 = `${"/"}vfx/`;
let pack = null;
let loading = null;
function loadMuzzleFlashes() {
  loading ??= fetch(versioned(`${BASE$1}muzzle_flash.json`)).then((r) => r.ok ? r.json() : null).then((p) => pack = p && p.effects ? p : null).catch(() => null);
  return loading;
}
Effect.ShadersStore.ttFlashVertexShader = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 world;
uniform mat4 viewProjection;
uniform vec2 cup;
varying vec2 vUV;
void main(void) {
  vec3 p = position;
  // A front flash is cupped: its edges pushed back along the barrel (a radial gradient to a power).
  if (cup.x != 0.0) p.z += pow(clamp(length(uv - 0.5) * 2.0, 0.0, 1.0), cup.y) * cup.x;
  vUV = uv;
  gl_Position = viewProjection * world * vec4(p, 1.0);
}`;
Effect.ShadersStore.ttFlashFragmentShader = `
precision highp float;
varying vec2 vUV;
#ifndef GLOW
uniform sampler2D atlas;
uniform sampler2D noiseTex;
#endif
uniform vec4 tile;
uniform float life;
uniform vec4 fade;
uniform vec2 scroll;
uniform vec2 smoothing;
uniform float time;
uniform float emission;
uniform float opacity;
uniform vec3 primary;
uniform vec3 secondary;
vec2 alignUv(vec2 uv, float a) {
  if (a < 0.5) return uv;
  if (a < 1.5) return uv.yx;
  if (a < 2.5) return vec2(1.0 - uv.x, uv.y);
  return vec2(1.0 - uv.y, uv.x);
}
void main(void) {
#ifdef GLOW
  // The glow: a soft round mask, coloured from the second colour at its rim to the first at its heart.
  float mask = pow(clamp(1.0 - length(vUV - 0.5) * 2.0, 0.0, 1.0), fade.x);
  vec3 col = mix(secondary, primary, mask) * min(1.6, 0.55 + 0.25 * emission);
  gl_FragColor = vec4(col, mask * life * opacity);
#else
  // Godot's UVs run down from the top; the atlas is upright.
  vec2 t = clamp(alignUv(vUV, tile.w), 0.004, 0.996);
  float v = texture2D(atlas, vec2((tile.x + t.x) * tile.z, 1.0 - (tile.y + t.y) * tile.z)).r;
  // Eaten away from the muzzle end as it fades, then dimmed, then broken up by noise.
  v = clamp(v - clamp((vUV.y - 1.0) + life * fade.y * 1.3, 0.0, 1.0), 0.0, 1.0);
  v = mix(v, v * (1.0 - life), fade.x);
  v *= 1.0 - (1.0 - texture2D(noiseTex, vUV + time * scroll).r) * fade.w;
  float a = smoothstep(0.0, max(0.001, smoothing.y), v);
  a *= step(fade.z, min(min(vUV.x, 1.0 - vUV.x), min(vUV.y, 1.0 - vUV.y)));
  vec3 col = mix(secondary, primary, smoothstep(0.0, max(0.001, smoothing.x), v));
  // A hot, paler heart where it's densest (the pack gets this from its emission and the renderer's glow).
  col = mix(col, vec3(1.0, 0.98, 0.9), smoothstep(0.7, 1.0, v) * 0.55) * min(1.4, 0.55 + 0.25 * emission);
  gl_FragColor = vec4(col, a * opacity);
#endif
}`;
function sampleCurve(points, x, fallback) {
  if (!points?.length) return fallback;
  const first = points[0];
  const last = points[points.length - 1];
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i + 1 < points.length; i++) {
    const [x0, y0, , r0] = points[i];
    const [x1, y1, l1] = points[i + 1];
    if (x > x1) continue;
    const d = x1 - x0;
    const t = d > 0 ? (x - x0) / d : 0;
    const c1 = y0 + r0 * d / 3;
    const c2 = y1 - l1 * d / 3;
    const u = 1 - t;
    return u * u * u * y0 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * y1;
  }
  return last[1];
}
const shared = /* @__PURE__ */ new WeakMap();
function noiseTexture$1(scene) {
  const n = 64;
  const cells = 6;
  const pts = [];
  let seed = 7;
  const rnd2 = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  for (let i = 0; i < cells * cells; i++) pts.push([(i % cells + rnd2()) / cells, (Math.floor(i / cells) + rnd2()) / cells]);
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let best = 9;
      for (const [px, py] of pts) {
        let dx = Math.abs(x / n - px);
        let dy = Math.abs(y / n - py);
        dx = Math.min(dx, 1 - dx);
        dy = Math.min(dy, 1 - dy);
        best = Math.min(best, Math.hypot(dx, dy));
      }
      const v = Math.round(Math.min(1, best * cells * 1.1) * 255);
      data.set([v, v, v, 255], (y * n + x) * 4);
    }
  }
  const tex = RawTexture.CreateRGBATexture(data, n, n, scene, false, false, Texture.BILINEAR_SAMPLINGMODE);
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}
function quad(scene, name, kind) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const n = kind === "front" ? 8 : 1;
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const v = j / n;
      if (kind === "blade") positions.push(0, u - 0.5, 1 - v);
      else positions.push(u - 0.5, 0.5 - v, 0);
      uvs.push(u, v);
    }
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      indices.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2);
    }
  }
  const vd = new VertexData();
  vd.positions = positions;
  vd.uvs = uvs;
  vd.indices = indices;
  const mesh = new Mesh(name, scene);
  vd.applyToMesh(mesh);
  mesh.isPickable = false;
  mesh.setEnabled(false);
  return mesh;
}
function pieceOf$1(quad2, name) {
  const mesh = new Mesh(name, quad2.getScene());
  quad2.geometry?.applyToMesh(mesh);
  mesh.isPickable = false;
  return mesh;
}
function sceneShared(scene) {
  let s = shared.get(scene);
  if (!s) {
    const atlas = new Texture(versioned(`${BASE$1}muzzle_flash.webp`), scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
    atlas.wrapU = Texture.CLAMP_ADDRESSMODE;
    atlas.wrapV = Texture.CLAMP_ADDRESSMODE;
    s = { atlas, noise: noiseTexture$1(scene), blade: quad(scene, "flashBlade", "blade"), front: quad(scene, "flashFront", "front"), glow: quad(scene, "flashGlow", "glow") };
    shared.set(scene, s);
  }
  return s;
}
function flashMaterial(scene, name, glow2) {
  const m = new ShaderMaterial(name, scene, { vertex: "ttFlash", fragment: "ttFlash" }, {
    attributes: ["position", "uv"],
    uniforms: ["world", "viewProjection", "cup", "tile", "life", "fade", "scroll", "smoothing", "time", "emission", "opacity", "primary", "secondary"],
    samplers: glow2 ? [] : ["atlas", "noiseTex"],
    defines: glow2 ? ["#define GLOW"] : [],
    needAlphaBlending: true
  });
  m.blockDirtyMechanism = true;
  m.backFaceCulling = false;
  m.disableDepthWrite = true;
  m.alphaMode = Constants.ALPHA_COMBINE;
  return m;
}
class MuzzleFlashRig {
  constructor(scene, name, opts = {}) {
    this.scene = scene;
    this.name = name;
    this.root = new TransformNode(name, scene);
    this.renderingGroupId = opts.renderingGroupId ?? 0;
  }
  scene;
  name;
  root;
  pieces = [];
  firedAt = -1;
  length = 0;
  effectId = "";
  renderingGroupId;
  /** Whether the pack's settings are in (until then, callers draw their own flash). */
  static ready() {
    return !!pack;
  }
  build(id) {
    if (id === this.effectId) return true;
    const fx = pack?.effects[id];
    if (!fx || !pack) return false;
    this.clear();
    this.effectId = id;
    const s = sceneShared(this.scene);
    const cols = pack.atlas.cols;
    const primary = Color3.FromArray(fx.primary);
    const secondary = Color3.FromArray(fx.secondary);
    fx.layers.forEach((layer, li) => {
      for (let i = 0; i < layer.count; i++) {
        const mat2 = flashMaterial(this.scene, `${this.name}_m${li}_${i}`, false);
        mat2.setTexture("atlas", s.atlas);
        mat2.setTexture("noiseTex", s.noise);
        mat2.setVector4("tile", new Vector4(layer.tile % cols, Math.floor(layer.tile / cols), 1 / cols, layer.align));
        mat2.setVector4("fade", new Vector4(layer.fadeBasic, layer.fadeDir, layer.cutoff, layer.noise));
        mat2.setVector2("scroll", new Vector2(layer.scroll[0], layer.scroll[1]));
        mat2.setVector2("smoothing", new Vector2(layer.colorSmooth, layer.edgeSmooth));
        mat2.setVector2("cup", layer.cup ? new Vector2(layer.cup.dist / Math.max(1e-3, layer.w), layer.cup.exp) : new Vector2(0, 1));
        mat2.setFloat("emission", layer.emission);
        mat2.setFloat("opacity", 1);
        mat2.setColor3("primary", primary);
        mat2.setColor3("secondary", secondary);
        const mesh = pieceOf$1(layer.type === "front" ? s.front : s.blade, `${this.name}_${li}_${i}`);
        mesh.metadata = EFFECT$2;
        mesh.material = mat2;
        mesh.parent = this.root;
        mesh.renderingGroupId = this.renderingGroupId;
        mesh.setEnabled(false);
        const delay = i / layer.count * layer.life * (1 - layer.explode);
        this.pieces.push({ mesh, mat: mat2, layer, delay, size: 1, opacity: 1 });
      }
    });
    if (fx.glow) {
      const mat2 = flashMaterial(this.scene, `${this.name}_glow`, true);
      mat2.setVector4("fade", new Vector4(fx.glow.maskExp, 0, 0, 0));
      mat2.setFloat("emission", fx.glow.emission);
      mat2.setFloat("opacity", fx.glow.alphaMul);
      mat2.setColor3("primary", primary);
      mat2.setColor3("secondary", secondary);
      mat2.setVector2("cup", new Vector2(0, 1));
      const mesh = pieceOf$1(s.glow, `${this.name}_glow`);
      mesh.metadata = EFFECT$2;
      mesh.material = mat2;
      mesh.parent = this.root;
      mesh.renderingGroupId = this.renderingGroupId;
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
      mesh.position.z = fx.glow.at - fx.glow.height * 0.75;
      mesh.scaling.setAll(fx.glow.radius * 2.2);
      mesh.setEnabled(false);
      this.pieces.push({ mesh, mat: mat2, layer: null, delay: 0, size: 1, opacity: fx.glow.alphaMul });
    }
    this.length = fx.length;
    return true;
  }
  /**
   * A shot: the effect (built the first time) at this scale, with fresh random turns and sizes; `opacity` scales how
   * strongly it shows (Reduce flashing: your own flash dimmer). False when it can't be drawn yet.
   */
  fire(id, scale, opacity = 1) {
    if (!this.build(id)) return false;
    this.root.scaling.setAll(scale);
    this.firedAt = performance.now();
    for (const p of this.pieces) {
      if (opacity !== this.opacity) p.mat.setFloat("opacity", p.opacity * opacity);
      const l = p.layer;
      if (!l) continue;
      p.size = l.scale[0] + Math.random() * (l.scale[1] - l.scale[0]);
      const turn = l.spin ? Math.random() * Math.PI * 2 : 0;
      if (l.type === "blade") {
        p.mesh.position.set(0, 0, l.at + (l.mid - l.h / 2) * p.size);
        p.mesh.rotation.set(0, 0, turn);
        p.mesh.scaling.set(1, l.w * p.size, l.h * p.size);
      } else {
        p.mesh.position.set(0, 0, l.at);
        p.mesh.rotation.set(0, 0, turn);
        p.mesh.scaling.set(l.w * p.size, l.h * p.size, l.w * p.size);
      }
    }
    this.opacity = opacity;
    return true;
  }
  /** The opacity the pieces were last fired at. */
  opacity = 1;
  /**
   * Build these flashes once (the shared pieces, the materials) while the match loads: the first shot of each
   * built them mid-fight. One hidden rig per scene does it.
   */
  static warm(scene, ids) {
    let rig = warmRigs.get(scene);
    if (!rig) warmRigs.set(scene, rig = new MuzzleFlashRig(scene, "muzzleFlashWarm"));
    for (const id of ids) rig.build(id);
  }
  /** Tests and screenshots: hold every flash at this many ms after its shot (undefined: play normally). */
  static hold;
  /** Animate; returns whether anything is showing. */
  update(now = performance.now()) {
    if (this.firedAt < 0) return false;
    if (MuzzleFlashRig.hold !== void 0) now = this.firedAt + MuzzleFlashRig.hold;
    const t = (now - this.firedAt) / 1e3 * SPEED;
    let any = false;
    for (const p of this.pieces) {
      const l = p.layer;
      if (!l) {
        const x2 = this.length > 0 ? t / this.length : 1;
        const on2 = x2 < 1;
        p.mesh.setEnabled(on2);
        if (on2) p.mat.setFloat("life", (1 - x2) * (1 - x2));
        any ||= on2;
        continue;
      }
      const x = (t - p.delay) / l.life;
      const on = x >= 0 && x < 1;
      p.mesh.setEnabled(on);
      if (!on) continue;
      any = true;
      p.mat.setFloat("life", Math.min(1, Math.max(0, sampleCurve(l.alpha, x, x))));
      p.mat.setFloat("time", now / 1e3);
      if (l.size) {
        const k = p.size * sampleCurve(l.size, x, 1);
        if (l.type === "blade") p.mesh.scaling.set(1, l.w * k, l.h * k);
        else p.mesh.scaling.set(l.w * k, l.h * k, l.w * k);
      }
    }
    if (!any) this.firedAt = -1;
    return any;
  }
  hide() {
    this.firedAt = -1;
    for (const p of this.pieces) p.mesh.setEnabled(false);
  }
  clear() {
    for (const p of this.pieces) {
      p.mat.dispose();
      p.mesh.dispose();
    }
    this.pieces = [];
    this.effectId = "";
    this.opacity = 1;
  }
  dispose() {
    this.clear();
    this.root.dispose();
  }
}
const STEADY_ARC = { attack: 0.1, hold: 0.3, release: 0.35 };
const FOLLOW = 14;
const EFFECT$1 = { effect: true };
class SteadyArcs {
  constructor(scene) {
    this.scene = scene;
  }
  scene;
  beams = /* @__PURE__ */ new Map();
  last = 0;
  /** An arc from `key` (a shooter, a turret, a stretch of fence) through `pts`, in `color`. */
  hit(key, pts, color2, now = performance.now()) {
    if (pts.length < 2) return;
    let beam = this.beams.get(key);
    if (!beam) {
      const c = Color3.FromHexString(color2);
      const coreMat = this.material(`steadyArcCore_${key}`, Color3.Lerp(c, Color3.White(), 0.35));
      const glowMat = this.material(`steadyArcGlow_${key}`, c.scale(0.85));
      const end2 = CreateSphere(`steadyArcEnd_${key}`, { diameter: 1, segments: 8 }, this.scene);
      end2.material = glowMat;
      this.prepare(end2);
      const last = pts[pts.length - 1];
      beam = { segments: [], end: end2, endAt: new Vector3(last.x, last.y, last.z), endTo: new Vector3(last.x, last.y, last.z), last: now, coreMat, glowMat };
      this.beams.set(key, beam);
    }
    beam.last = now;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      let s = beam.segments[i];
      if (!s) {
        const core = CreateCylinder(`steadyArc_${key}_${i}`, { diameter: 1, height: 1, tessellation: 6 }, this.scene);
        const glow2 = CreateCylinder(`steadyArcGlow_${key}_${i}`, { diameter: 1, height: 1, tessellation: 8 }, this.scene);
        core.material = beam.coreMat;
        glow2.material = beam.glowMat;
        this.prepare(core);
        this.prepare(glow2);
        s = { core, glow: glow2, a: new Vector3(a.x, a.y, a.z), b: new Vector3(b.x, b.y, b.z), ta: new Vector3(), tb: new Vector3(), level: 0, live: true };
        beam.segments[i] = s;
      }
      s.ta.set(a.x, a.y, a.z);
      s.tb.set(b.x, b.y, b.z);
      s.live = true;
    }
    for (let i = pts.length - 1; i < beam.segments.length; i++) beam.segments[i].live = false;
    const end = pts[pts.length - 1];
    beam.endTo.set(end.x, end.y, end.z);
  }
  /** Each frame: ends glide, beams come up, hold and fade; faded ones go. */
  update(now = performance.now()) {
    const dt = Math.min(0.1, Math.max(0, (now - (this.last || now)) / 1e3));
    this.last = now;
    const k = Math.min(1, dt * FOLLOW);
    for (const [key, beam] of this.beams) {
      const held = now - beam.last < STEADY_ARC.hold * 1e3;
      let shown = 0;
      for (const s of beam.segments) {
        s.level = ease$1(s.level, held && s.live ? 1 : 0, dt, 1 / STEADY_ARC.attack, 1 / STEADY_ARC.release);
        s.a.addInPlace(s.ta.subtract(s.a).scaleInPlace(k));
        s.b.addInPlace(s.tb.subtract(s.b).scaleInPlace(k));
        const on = s.level > 1e-3;
        s.core.setEnabled(on);
        s.glow.setEnabled(on);
        if (!on) continue;
        shown = Math.max(shown, s.level);
        place(s.core, s.a, s.b, 0.035);
        place(s.glow, s.a, s.b, 0.16);
      }
      beam.endAt.addInPlace(beam.endTo.subtract(beam.endAt).scaleInPlace(k));
      beam.end.setEnabled(shown > 1e-3);
      beam.end.position.copyFrom(beam.endAt);
      beam.end.scaling.setAll(0.3);
      beam.coreMat.alpha = 0.9 * shown;
      beam.glowMat.alpha = 0.32 * shown;
      if (!held && shown <= 1e-3) {
        for (const s of beam.segments) {
          s.core.dispose();
          s.glow.dispose();
        }
        beam.end.dispose();
        beam.coreMat.dispose();
        beam.glowMat.dispose();
        this.beams.delete(key);
      }
    }
  }
  /** Beams drawn now (tests). */
  get count() {
    return this.beams.size;
  }
  dispose() {
    for (const beam of this.beams.values()) {
      for (const s of beam.segments) {
        s.core.dispose();
        s.glow.dispose();
      }
      beam.end.dispose();
      beam.coreMat.dispose();
      beam.glowMat.dispose();
    }
    this.beams.clear();
  }
  material(name, color2) {
    const m = new StandardMaterial(name, this.scene);
    m.emissiveColor = color2;
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    m.disableLighting = true;
    m.alphaMode = Constants.ALPHA_ADD;
    m.alpha = 0;
    m.disableDepthWrite = true;
    return m;
  }
  prepare(mesh) {
    mesh.isPickable = false;
    mesh.metadata = EFFECT$1;
    mesh.rotationQuaternion = Quaternion.Identity();
    mesh.setEnabled(false);
  }
}
function place(mesh, a, b, width) {
  const d = b.subtract(a);
  const len2 = Math.max(0.01, d.length());
  mesh.position.copyFrom(a.add(b).scaleInPlace(0.5));
  mesh.scaling.set(width, len2, width);
  Quaternion.FromUnitVectorsToRef(Vector3.Up(), d.scaleInPlace(1 / len2), mesh.rotationQuaternion);
}
const BASE = `${"/"}vfx/`;
const EFFECT = { effect: true };
const packs = /* @__PURE__ */ new Map();
function loadVfxPack(name) {
  let p = packs.get(name);
  if (!p) {
    p = fetch(versioned(`${BASE}${name}.json`)).then((r) => r.ok ? r.json() : null).catch(() => null);
    packs.set(name, p);
  }
  return p;
}
const loaded = /* @__PURE__ */ new Map();
const num = (v, d) => typeof v === "number" ? v : d;
const bool = (v, d) => typeof v === "boolean" ? v : d;
const ctor = (v, name) => {
  const a = v && typeof v === "object" ? v[`@${name}`] : void 0;
  return Array.isArray(a) ? a : null;
};
const vec3 = (v, d) => {
  const a = ctor(v, "Vector3");
  return a ? [a[0], a[1], a[2]] : d;
};
const vec2 = (v, d) => {
  const a = ctor(v, "Vector2");
  return a ? [a[0], a[1]] : d;
};
const color = (v, d) => {
  const a = ctor(v, "Color");
  return a ? [a[0], a[1], a[2], a[3] ?? 1] : d;
};
const hexColor = (hex) => {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 1];
};
const packed = (v) => {
  if (!v || typeof v !== "object") return [];
  for (const k of ["@PackedFloat32Array", "@PackedColorArray", "@PackedVector2Array"]) {
    const a = v[k];
    if (Array.isArray(a)) return a;
  }
  return [];
};
const curveOf = (v) => {
  const c = v;
  if (!c) return null;
  const curve = c.type === "CurveTexture" ? c.curve : c;
  const data = curve?._data;
  if (!Array.isArray(data)) return null;
  const pts = [];
  for (let i = 0; i + 2 < data.length; i += 5) {
    const p = ctor(data[i], "Vector2");
    if (p) pts.push([p[0], p[1], num(data[i + 1], 0), num(data[i + 2], 0)]);
  }
  return pts;
};
const scaleCurves = (v) => {
  const c = v;
  if (!c) return null;
  if (c.type === "CurveXYZTexture") return [curveOf(c.curve_x), curveOf(c.curve_y), curveOf(c.curve_z)];
  const one = curveOf(c);
  return [one, one, one];
};
const gradientOf = (v) => {
  const t = v;
  const g = t?.gradient ?? null;
  if (!t) return null;
  if (!g) return { offsets: [0, 1], colors: [0, 0, 0, 1, 1, 1, 1, 1] };
  const offsets = packed(g.offsets);
  const colors = packed(g.colors);
  return { offsets: offsets.length ? offsets : [0, 1], colors: colors.length ? colors : [0, 0, 0, 1, 1, 1, 1, 1] };
};
function sampleGradient(g, x, out) {
  const { offsets, colors } = g;
  const n = offsets.length;
  if (x <= offsets[0]) return out.splice(0, 4, ...colors.slice(0, 4)), out;
  for (let i = 0; i + 1 < n; i++) {
    const a = offsets[i];
    const b = offsets[i + 1];
    if (x > b) continue;
    const t = b > a ? (x - a) / (b - a) : 0;
    for (let k = 0; k < 4; k++) out[k] = colors[i * 4 + k] + (colors[(i + 1) * 4 + k] - colors[i * 4 + k]) * t;
    return out;
  }
  for (let k = 0; k < 4; k++) out[k] = colors[(n - 1) * 4 + k];
  return out;
}
function ease(x, c) {
  if (x < 0) x = 0;
  if (x > 1) x = 1;
  if (c > 0) return c < 1 ? 1 - Math.pow(1 - x, 1 / c) : Math.pow(x, c);
  if (c < 0) return x < 0.5 ? Math.pow(x * 2, -c) * 0.5 : (1 - Math.pow(1 - (x - 0.5) * 2, -c)) * 0.5 + 0.5;
  return 0;
}
function trackAt(tr, t) {
  const times = tr.keys.times?.["@PackedFloat32Array"] ?? [];
  const values = tr.keys.values ?? [];
  const trans = tr.keys.transitions?.["@PackedFloat32Array"] ?? [];
  if (!times.length) return void 0;
  if (t <= times[0]) return values[0];
  let i = 0;
  while (i + 1 < times.length && t >= times[i + 1]) i++;
  if (i + 1 >= times.length || tr.keys.update === 1 || tr.keys.update === 2) return values[i];
  const a = values[i];
  const b = values[i + 1];
  const f = ease((t - times[i]) / (times[i + 1] - times[i]), trans[i] ?? 1);
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * f;
  const va = ctor(a, "Vector3");
  const vb = ctor(b, "Vector3");
  if (va && vb) return { "@Vector3": va.map((x, k) => x + (vb[k] - x) * f) };
  return f < 0.5 ? a : b;
}
function hash(x, y, s) {
  let h = x * 374761393 + y * 668265263 + s * 2147483647 | 0;
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
function smoothNoise(x, y, p, s) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const g = (i, j) => {
    const a2 = hash((i % p + p) % p, (j % p + p) % p, s) * Math.PI * 2;
    return [Math.cos(a2), Math.sin(a2)];
  };
  const dot2 = (i, j) => {
    const [gx, gy] = g(xi + i, yi + j);
    return gx * (xf - i) + gy * (yf - j);
  };
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const a = dot2(0, 0) + (dot2(1, 0) - dot2(0, 0)) * u;
  const b = dot2(0, 1) + (dot2(1, 1) - dot2(0, 1)) * u;
  return (a + (b - a) * v) * 0.7 + 0.5;
}
function cellNoise(x, y, p, s, manhattan) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let best = 9;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i;
      const cy = yi + j;
      const px = cx + hash((cx % p + p) % p, (cy % p + p) % p, s);
      const py = cy + hash((cx % p + p) % p, (cy % p + p) % p, s + 17);
      const dx = Math.abs(x - px);
      const dy = Math.abs(y - py);
      best = Math.min(best, manhattan ? (dx + dy) * 0.7 : Math.hypot(dx, dy));
    }
  }
  return Math.min(1, best);
}
const noiseCache = /* @__PURE__ */ new WeakMap();
function noiseTexture(scene, spec, fold = false) {
  let cache = noiseCache.get(scene);
  if (!cache) noiseCache.set(scene, cache = /* @__PURE__ */ new Map());
  const key = `${fold ? "f" : ""}${JSON.stringify(spec ?? {})}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const n = spec?.noise ?? {};
  const type = num(n.noise_type, 1);
  const width = num(spec?.width, 512);
  const freq = num(n.frequency, 0.01);
  const fractal = num(n.fractal_type, 1);
  const octaves = fractal === 0 ? 1 : Math.min(4, num(n.fractal_octaves, 5));
  const gain = num(n.fractal_gain, 0.5);
  const pingPong = num(n.fractal_ping_pong_strength, 2);
  const seed = num(n.seed, 0) + 1;
  const manhattan = num(n.cellular_distance_function, 0) === 1;
  const SIZE = 128;
  const period = Math.max(1, Math.round(freq * width));
  const data = new Float32Array(SIZE * SIZE);
  let lo = Infinity;
  let hi = -Infinity;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let v = 0;
      let amp = 1;
      let total = 0;
      for (let o = 0; o < octaves; o++) {
        const p = period << o;
        const fx = x / SIZE * p;
        const fy = y / SIZE * p;
        let s = type === 2 ? cellNoise(fx, fy, p, seed + o, manhattan) : smoothNoise(fx, fy, p, seed + o);
        if (fractal === 2) s = 1 - Math.abs(s * 2 - 1);
        else if (fractal === 3 && fold) {
          const t = s * 2 * pingPong;
          const f = t - Math.floor(t * 0.5) * 2;
          s = f < 1 ? f : 2 - f;
        }
        v += s * amp;
        total += amp;
        amp *= gain;
      }
      v /= total;
      data[y * SIZE + x] = v;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  const invert = bool(spec?.invert, false);
  const rgba = new Uint8Array(SIZE * SIZE * 4);
  const asNormal = bool(spec?.as_normal_map, false);
  const bump = num(spec?.bump_strength, 8);
  const h = (x, y) => {
    let v = (data[(y % SIZE + SIZE) % SIZE * SIZE + (x % SIZE + SIZE) % SIZE] - lo) / Math.max(1e-6, hi - lo);
    return invert ? 1 - v : v;
  };
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      if (asNormal) {
        const dx = (h(x + 1, y) - h(x - 1, y)) * bump * 0.25;
        const dy = (h(x, y + 1) - h(x, y - 1)) * bump * 0.25;
        const l = Math.hypot(dx, dy, 1);
        rgba.set([(-dx / l * 0.5 + 0.5) * 255, (-dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255, 255], i);
      } else {
        const v = Math.round(h(x, y) * 255);
        rgba.set([v, v, v, 255], i);
      }
    }
  }
  const tex = RawTexture.CreateRGBATexture(rgba, SIZE, SIZE, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  cache.set(key, tex);
  return tex;
}
function gradientTexture(scene, spec) {
  let cache = noiseCache.get(scene);
  if (!cache) noiseCache.set(scene, cache = /* @__PURE__ */ new Map());
  const key = `g${JSON.stringify(spec)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const SIZE = 64;
  const g = gradientOf(spec) ?? { offsets: [0, 1], colors: [0, 0, 0, 1, 1, 1, 1, 1] };
  const radial = num(spec.fill, 0) === 1;
  const square = num(spec.fill, 0) === 2;
  const from = vec2(spec.fill_from, [0, 0]);
  const to = vec2(spec.fill_to, [1, 0]);
  const rgba = new Uint8Array(SIZE * SIZE * 4);
  const c = [0, 0, 0, 0];
  const len2 = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = (x + 0.5) / SIZE;
      const v = (y + 0.5) / SIZE;
      const t = square ? Math.max(Math.abs(u - from[0]), Math.abs(v - from[1])) / (Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])) || 1) : radial ? Math.hypot(u - from[0], v - from[1]) / len2 : ((u - from[0]) * (to[0] - from[0]) + (v - from[1]) * (to[1] - from[1])) / (len2 * len2);
      sampleGradient(g, Math.min(1, Math.max(0, t)), c);
      rgba.set([c[0] * 255, c[1] * 255, c[2] * 255, c[3] * 255], (y * SIZE + x) * 4);
    }
  }
  const tex = RawTexture.CreateRGBATexture(rgba, SIZE, SIZE, scene, false, false, Texture.BILINEAR_SAMPLINGMODE);
  tex.wrapU = Texture.CLAMP_ADDRESSMODE;
  tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  cache.set(key, tex);
  return tex;
}
function packTexture(scene, file) {
  let cache = noiseCache.get(scene);
  if (!cache) noiseCache.set(scene, cache = /* @__PURE__ */ new Map());
  const key = `t${file}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const tex = new Texture(versioned(`${BASE}${file}`), scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  cache.set(key, tex);
  return tex;
}
const baseData = /* @__PURE__ */ new WeakMap();
function pieceOf(base, name) {
  const mesh = new Mesh(name, base.getScene());
  let data = baseData.get(base);
  if (!data) baseData.set(base, data = VertexData.ExtractFromMesh(base, false, true));
  data.applyToMesh(mesh, false);
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.doNotSyncBoundingInfo = true;
  return mesh;
}
function godotMesh(scene, spec, name) {
  const type = String(spec.type);
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const grid = (cols, rows) => {
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i;
        indices.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
      }
    }
  };
  if (type === "QuadMesh" || type === "PlaneMesh") {
    const [w, h] = vec2(spec.size, type === "PlaneMesh" ? [2, 2] : [1, 1]);
    const off = vec3(spec.center_offset, [0, 0, 0]);
    const orient = num(spec.orientation, type === "PlaneMesh" ? 1 : 2);
    const sx = Math.min(16, num(spec.subdivide_width, 0)) + 1;
    const sy = Math.min(16, num(spec.subdivide_depth, 0)) + 1;
    for (let j = 0; j <= sy; j++) {
      for (let i = 0; i <= sx; i++) {
        const u = i / sx;
        const v = j / sy;
        const a = (u - 0.5) * w;
        const b = (0.5 - v) * h;
        if (orient === 2) positions.push(a + off[0], b + off[1], off[2]), normals.push(0, 0, 1);
        else if (orient === 1) positions.push(a + off[0], off[1], -b + off[2]), normals.push(0, 1, 0);
        else positions.push(off[0], b + off[1], -a + off[2]), normals.push(1, 0, 0);
        uvs.push(u, v);
      }
    }
    grid(sx, sy);
  } else if (type === "SphereMesh") {
    const r = num(spec.radius, 0.5);
    const height = num(spec.height, 1);
    const hemi = bool(spec.is_hemisphere, false);
    const seg = Math.max(8, Math.min(32, num(spec.radial_segments, 64) / 2));
    const rings = Math.max(4, Math.min(16, num(spec.rings, 32) / 2));
    for (let j = 0; j <= rings; j++) {
      const v = j / rings;
      const lat = hemi ? v * Math.PI / 2 : v * Math.PI;
      const y = Math.cos(lat) * (hemi ? height : height / 2);
      const rr = Math.sin(lat) * r;
      for (let i = 0; i <= seg; i++) {
        const u = i / seg;
        const a = u * Math.PI * 2;
        const x = Math.sin(a) * rr;
        const z = Math.cos(a) * rr;
        positions.push(x, y, z);
        const n = new Vector3(x / r, y / Math.max(1e-6, hemi ? height : height / 2), z / r).normalize();
        normals.push(n.x, n.y, n.z);
        uvs.push(u, v);
      }
    }
    grid(seg, rings);
  } else if (type === "TorusMesh") {
    const inner = num(spec.inner_radius, 0.5);
    const outer = num(spec.outer_radius, 1);
    const R = (inner + outer) / 2;
    const r = (outer - inner) / 2;
    const seg = Math.max(8, Math.min(32, num(spec.rings, 64)));
    const side = Math.max(4, Math.min(12, num(spec.ring_segments, 32)));
    for (let j = 0; j <= side; j++) {
      const v = j / side;
      const b = v * Math.PI * 2;
      for (let i = 0; i <= seg; i++) {
        const u = i / seg;
        const a = u * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        positions.push(ca * (R + r * Math.cos(b)), r * Math.sin(b), sa * (R + r * Math.cos(b)));
        normals.push(ca * Math.cos(b), Math.sin(b), sa * Math.cos(b));
        uvs.push(u, v);
      }
    }
    grid(seg, side);
  } else {
    const top = type === "TubeTrailMesh" ? num(spec.radius, 0.5) : num(spec.top_radius, 0.5);
    const bottom = type === "TubeTrailMesh" ? num(spec.radius, 0.5) : num(spec.bottom_radius, 0.5);
    const height = type === "TubeTrailMesh" ? num(spec.section_length, 0.2) * num(spec.sections, 5) : num(spec.height, 2);
    const seg = Math.max(6, Math.min(24, num(spec.radial_segments, 24)));
    const rings = Math.max(4, Math.min(32, num(spec.rings, 4)));
    for (let j = 0; j <= rings; j++) {
      const v = j / rings;
      const y = (0.5 - v) * height;
      const rr = top + (bottom - top) * v;
      for (let i = 0; i <= seg; i++) {
        const u = i / seg;
        const a = u * Math.PI * 2;
        positions.push(Math.sin(a) * rr, y, Math.cos(a) * rr);
        normals.push(Math.sin(a), (bottom - top) / Math.max(1e-6, height), Math.cos(a));
        uvs.push(u, type === "TubeTrailMesh" ? v : v * 0.5);
      }
    }
    grid(seg, rings);
  }
  const vd = new VertexData();
  vd.positions = positions;
  vd.normals = normals;
  vd.uvs = uvs;
  vd.indices = indices;
  const mesh = new Mesh(name, scene);
  vd.applyToMesh(mesh, true);
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.doNotSyncBoundingInfo = true;
  return mesh;
}
const PORTS = {
  // ---- hits
  four_point_star: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 0.8, 0.4], emission: 2, emission_mult: 1, star_shape: 2, star_smoothness: 0.1 },
    blend: "add",
    fragment: `
      vec2 uv = abs(vUV * 2.0 - 1.0);
      float decay = vColor.a;
      float value = clamp(pow(uv.x, u_star_shape * decay) + pow(uv.y, u_star_shape * decay), 0.0, 2.0);
      // No smoothness is a hard edge (smoothstep with equal edges is undefined in GLSL).
      value = u_star_smoothness < 0.001 ? 1.0 - step(0.95, value) : smoothstep(0.95, 0.95 - u_star_smoothness, value);
      outColor = mix(u_secondary_color, u_primary_color, value) * vColor.rgb * u_emission * u_emission_mult;
      outAlpha = value;`
  },
  flare: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 0.8, 0.4], emission: 2, emission_mult: 1, streaks_amount: 4, variance1_amplitude: 12, variance2_amplitude: 5, edge_hardness: 0.5, edge_position: 0.1 },
    samplers: ["flare_texture"],
    blend: "add",
    cull: false,
    billboardUniform: true,
    fragment: `
      float flare = texture2D(flare_texture, vUV).r;
      flare = pow(flare, 8.0) * 0.8;
      vec2 c = vUV - 0.5;
      float angle = atan(c.x, c.y);
      float idOff = vExtra.x;
      float streaks = pow(cos((angle + idOff) * u_streaks_amount) * 0.5 + 0.5, 16.0);
      streaks *= sin((angle + idOff) * u_variance1_amplitude) * 0.5 + 0.5;
      float value = overlay(flare, streaks);
      value = max(value, flare * 0.5);
      value *= 0.5 + (sin((angle + idOff) * u_variance2_amplitude + idOff) * 0.5 + 0.5) * 0.5;
      value = smoothstep(mix(0.0, u_edge_position, u_edge_hardness), mix(1.0, u_edge_position + 0.01, u_edge_hardness), value);
      outColor = mix(u_secondary_color, u_primary_color, value) * vColor.rgb * u_emission * vColor.a * u_emission_mult;
      outAlpha = value;`
  },
  streaks: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 0.8, 0.4], emission: 2, emission_mult: 1, streaks1_count: 5, streaks2_count: 11, streaks_fade: 0.4, streaks_thickness: 0.5, center_radius: 0.1, fade_radius: 0.4 },
    blend: "add",
    billboardUniform: true,
    fragment: `
      vec2 c = vUV - 0.5;
      float angle = atan(c.x, c.y);
      float radius = length(c) * 2.0;
      float viewOffset = vNormal.x * 0.5 + 0.5;
      if (vNormal.z > 0.0) viewOffset = 1.0 - viewOffset;
      viewOffset *= 6.2831853;
      float s1 = sin(angle * u_streaks1_count + viewOffset + u_time);
      float s2 = sin(angle * u_streaks2_count - viewOffset - u_time);
      float value = overlay(s1, s2);
      value -= (1.0 - radius) * u_streaks_fade;
      value *= 1.0 - (radius - value * u_streaks_thickness);
      float mask = max(1.0 - radius, 0.0);
      value *= mask;
      value = min(value, mask);
      value = smoothstep(0.1, 1.0, value);
      value *= pow(clamp((radius - u_center_radius) / (u_fade_radius - u_center_radius), 0.0, 1.0), 4.0);
      outColor = mix(u_secondary_color, u_primary_color, value) * vColor.rgb * u_emission * u_emission_mult;
      outAlpha = value * vColor.a;`
  },
  glow: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 0.8, 0.4], emission: 2, emission_mult: 1 },
    blend: "add",
    fragment: `
      float fresnel = clamp(pow(max(dot(normalize(vNormal), normalize(vView)), 0.0), 8.0), 0.0, 1.0);
      outColor = mix(u_secondary_color, u_primary_color, fresnel) * vColor.a * u_emission * u_emission_mult;
      outAlpha = fresnel;`
  },
  impact_core: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 0.8, 0.4], emission: 2, emission_mult: 1, alpha_as_factor: 0, grow_factor: 0.5, streak_amount: 7, clearance: 0, variance_amplitude: 10, variance_strength: 0.1, edge_hardness: 0.5, edge_position: 0.5 },
    blend: "mix",
    billboardUniform: true,
    fragment: `
      vec2 c = vUV * 2.0 - 1.0;
      float radius = length(c);
      float angle = atan(c.x, c.y);
      float factor = u_alpha_as_factor > 0.5 ? vColor.a : u_grow_factor;
      factor = factor * 4.0 - 1.0;
      float offset = (abs(sin(angle * (u_streak_amount * 0.5) + u_time)) * radius) + u_clearance;
      offset += (sin(angle * u_variance_amplitude) * radius) * u_variance_strength;
      radius += offset * 0.5;
      float value = 1.0 - abs(radius * 2.0 - factor);
      value *= max(pow(max(1.0 - radius, 0.0), 0.1), 0.0);
      value = smoothstep(mix(0.0, u_edge_position, u_edge_hardness), mix(1.0, u_edge_position + 0.01, u_edge_hardness), value);
      outColor = mix(u_secondary_color, u_primary_color, value) * vColor.rgb * u_emission * u_emission_mult;
      outAlpha = value;`
  },
  impact_slash: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 0.6, 0.2], emission: 2, emission_mult: 1, pinch_amount: 0.4, alpha_as_factor: 0, animation_factor: 0.5, noise_scale: [1, 0.4], edge_hardness: 0.8 },
    samplers: ["noise_texture"],
    blend: "mix",
    fragment: `
      float factor = u_alpha_as_factor > 0.5 ? vColor.a : u_animation_factor;
      vec2 s = (1.0 - vUV - vec2(0.5, 0.0)) * vec2(2.0, 1.0);
      float r = length(s);
      float gradient = pow(max(1.0 - vUV.y, 0.0), 0.5) * 2.0;
      r /= (1.0 - u_pinch_amount) + gradient * u_pinch_amount;
      float idOff = vExtra.x / 3.14159265;
      float noise = texture2D(noise_texture, (vUV + vec2(0.0, factor) + idOff) * u_noise_scale).r;
      float shape = (r - noise * 0.5) * 2.0;
      float value = 1.0 - abs(shape * 2.0 - (factor * 4.0 - 1.0));
      value *= clamp(1.0 - shape * shape * shape, 0.0, 1.0) * gradient;
      value *= pow(max(factor, 0.0), 0.1);
      value *= min(vUV.y * 8.0, 1.0);
      value = smoothstep(mix(0.0, 0.19, u_edge_hardness), mix(1.0, 0.2, u_edge_hardness), value);
      outColor = mix(u_secondary_color, u_primary_color, value) * vColor.rgb * u_emission * u_emission_mult;
      outAlpha = value;`
  },
  impact_sphere: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 0.8, 0.4], emission: 2, emission_mult: 1, alpha_as_factor: 0, animation_factor: 0.5, scroll: [0.2, 0.2], edge_hardness: 0.5, edge_position: 0.5, noise_displacement: 0.2, displacement: 0.2 },
    samplers: ["noise_texture"],
    blend: "add",
    cull: false,
    vertex: `
      float pole = max(uv.y, 1.0 - uv.y) * 2.0 - 1.0;
      pole = 1.0 - pow(pole, 8.0);
      float nz = min(texture2D(noise_texture, uv + u_scroll * u_time).r, 1.0) * pole;
      float factor = u_alpha_as_factor > 0.5 ? pcolor.a : max(u_animation_factor, 0.0);
      p += n * nz * u_noise_displacement * factor;
      p += n * u_displacement * factor;`,
    fragment: `
      float pole = max(vUV.y, 1.0 - vUV.y) * 2.0 - 1.0;
      pole = 1.0 - pow(pole, 8.0);
      float noise = min(texture2D(noise_texture, vUV + u_scroll * u_time).r, 1.0) * pole;
      float factor = u_alpha_as_factor > 0.5 ? vColor.a : max(u_animation_factor, 0.0);
      noise += (1.0 - factor) * 2.0 - 1.0;
      float value = smoothstep(mix(0.0, u_edge_position, u_edge_hardness), mix(1.0, u_edge_position + 0.01, u_edge_hardness), clamp(noise, 0.0, 1.0));
      vec3 col = mix(u_secondary_color, u_primary_color, value) * u_emission * u_emission_mult;
      if (!gl_FrontFacing) col = u_secondary_color;
      outColor = col * u_emission;
      outAlpha = value;`
  },
  spiral_dust: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 0.8, 0.4], emission: 4, emission_mult: 1, alpha_as_factor: 0, grow_factor: 0.5, streak_count: 3, streak_twist: 3, streak_exponent: 2, streak_scroll: 3, noise_scroll: 0.2, noise_twist: 2, spiral_noise_scale: [1, 1], edge_hardness: 0, edge_position: 0.5 },
    samplers: ["noise_texture"],
    blend: "add",
    fragment: `
      vec2 c = vUV * 2.0 - 1.0;
      float angle = atan(c.x, c.y);
      float radius = clamp(length(c), 0.0, 1.0);
      vec2 nuv = vec2((angle + radius * u_noise_twist) / 6.2831853, radius - u_time * u_noise_scroll);
      float noise = texture2D(noise_texture, nuv * u_spiral_noise_scale).r;
      float spiral = abs(sin((angle * (u_streak_count * 0.5) + vExtra.x) + (radius * u_streak_twist) - u_time * u_streak_scroll));
      spiral = pow(spiral, u_streak_exponent);
      float factor = u_alpha_as_factor > 0.5 ? vColor.a : u_grow_factor;
      float mask = radius + (1.0 - spiral) * 0.05;
      mask = max(1.0 - abs(mask * 2.0 - factor * 3.0), 0.0) * (1.0 - mask);
      mask = clamp(sqrt(max(mask, 0.0)), 0.0, 1.0);
      noise *= mask * spiral;
      noise = pow(noise, 4.0) * 10.0;
      noise = smoothstep(mix(0.0, u_edge_position, u_edge_hardness), mix(1.0, u_edge_position + 0.01, u_edge_hardness), noise);
      outColor = mix(u_secondary_color, u_primary_color, noise) * vColor.rgb * u_emission * u_emission_mult;
      outAlpha = sqrt(max(noise, 0.0)) * vColor.a;`
  },
  // ---- explosions
  explosion_bits: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 1, 1], emission: 2 },
    blend: "cut",
    cut: -1,
    fragment: `
      outColor = mix(u_secondary_color, u_primary_color, vColor.a) * u_emission;
      outAlpha = 1.0;`
  },
  explosion_core: {
    uniforms: { primary_color: [1, 1, 1], emission: 3, noise_scale: [1, 1], noise_scroll: [0, 0.2], noise_shape: 1 },
    samplers: ["noise_texture"],
    blend: "cut",
    cut: 0.1,
    cull: false,
    vertex: `
      float nz = texture2D(noise_texture, uv * 2.0).r;
      p += n * nz * 0.4 * (1.0 - pcolor.a);`,
    fragment: `
      float noise = texture2D(noise_texture, vUV * 2.0 * u_noise_scale + u_time * u_noise_scroll).r;
      noise = pow(noise, u_noise_shape);
      outAlpha = clamp((noise + 1.0) - ((1.0 - vColor.a) * 2.0), 0.0, 1.0);
      outColor = u_primary_color * 20.0;`
  },
  explosion_impact: {
    uniforms: { primary_color: [1, 1, 1], emission: 2, effect_decay: 0, noise_scale: [1, 1], noise_scroll: [0, 0.2], noise_shape: 1, streak_amount: 7 },
    samplers: ["noise_texture"],
    blend: "add",
    cut: 0.2,
    cull: false,
    fragment: `
      float noise = texture2D(noise_texture, vUV * 2.0 * u_noise_scale + u_time * u_noise_scroll).r;
      noise = pow(noise, u_noise_shape);
      float wave = sin(vUV.x * 6.2831853 * u_streak_amount);
      float decay = 1.0 - vColor.a;
      float y = vUV.y * 4.0 - 1.0;
      float shape = 1.0 - abs((y - ((1.0 - decay) - 0.25)) + wave * 0.25 * decay);
      shape = (shape - 0.75) / 0.25;
      float value = shape - (2.0 - noise) * (0.2 + pow(decay, 2.0) * 0.8);
      outAlpha = max(value, 0.0);
      outColor = u_primary_color * u_emission;`
  },
  explosion_rings: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 1, 1], emission: 2, noise_scale: [1, 1], noise_scroll: [0, 0.2], noise_shape: 1 },
    samplers: ["noise_texture"],
    blend: "add",
    cut: 0.2,
    cull: false,
    fragment: `
      float decay = 1.0 - vColor.a;
      float mask = 1.0 - abs(vUV.y * 4.0 - 1.0);
      float noise = texture2D(noise_texture, (vUV * vec2(2.0, 1.0) * u_noise_scale) + u_noise_scroll * u_time).r;
      noise = pow(noise, u_noise_shape);
      float value = max(mask - (1.0 - noise) - decay, 0.0);
      outColor = (gl_FrontFacing ? u_primary_color : u_secondary_color) * u_emission;
      outAlpha = value;`
  },
  explosion_smoke: {
    uniforms: { effect_decay: 0, is_particle: 1, primary_color: [1, 1, 1], secondary_color: [1, 1, 1], tertiary_color: [0.13, 0.13, 0.13], emission: 2, noise_scale: [1, 1], extra_scale: [1, 1], noise_scroll: [0, 0.2], use_stepped_shading: 1, shadow_steps: 3, displacement_amount: 0.2, pole_displacement_amount: 0 },
    samplers: ["smoke_texture", "normal_texture"],
    blend: "cut",
    cut: 0.5,
    lit: true,
    vertex: `
      float rnd = pcolor.r;
      vec2 nuv = (uv + rnd + u_noise_scroll * u_time) * u_noise_scale;
      float nz = texture2D(smoke_texture, nuv).r;
      float mask = sin(uv.y * 3.14159265);
      p += n * nz * u_displacement_amount * mask;
      p += n * pow(mask - 1.0, 3.0) * u_pole_displacement_amount;`,
    fragment: `
      float rnd = vColor.r;
      float decay = u_is_particle > 0.5 ? (1.0 - vColor.a * (1.0 - max(u_effect_decay, vExtra.y))) : max(u_effect_decay, vExtra.y);
      vec2 nuv = (vUV + rnd + u_noise_scroll * u_time) * u_noise_scale * u_extra_scale;
      float noise = texture2D(smoke_texture, nuv).r;
      float nv = max((1.0 - noise) - clamp(decay * 2.0, 0.0, 1.0), 0.0);
      nv = smoothstep(0.0, 0.5, nv);
      vec3 albedo = mix(u_tertiary_color, u_primary_color, nv);
      outAlpha = clamp((1.0 + noise) - (min(decay, 1.0) * 2.0), 0.0, 1.0);
      // Lit in steps (toon smoke): the sun on the perturbed normal, plus the sky.
      vec3 nm = texture2D(normal_texture, nuv).rgb * 2.0 - 1.0;
      vec3 N = normalize(normalize(vNormal) + nm * 0.6);
      float light = max(dot(N, -u_sunDir), 0.0);
      if (u_use_stepped_shading > 0.5) light = floor(light * u_shadow_steps) / (u_shadow_steps - 1.0);
      outColor = albedo * (u_ambient + u_sunColor * light) + albedo * nv * u_emission;`
  },
  explosion_sphere: {
    uniforms: { effect_decay: 0, primary_color: [1, 1, 1], secondary_color: [1, 1, 1], emission: 2, noise_scale: [1, 1], noise_scroll: [-0.2, 0.2], noise_shape: 1, noise_twist: 0.5 },
    samplers: ["noise_texture"],
    blend: "cut",
    cut: 1e-3,
    vertex: `
      vec2 nuv = uv * u_noise_scale + u_noise_scroll * u_time;
      nuv.x += nuv.y * u_noise_twist;
      float value = texture2D(noise_texture, nuv).r;
      float decay = max(u_effect_decay, pextra.y);
      p += n * value * 0.4 * sin(uv.y * 3.14159265) + n * decay;`,
    fragment: `
      vec2 nuv = vUV * u_noise_scale + u_noise_scroll * u_time;
      nuv.x += nuv.y * u_noise_twist;
      float value = texture2D(noise_texture, nuv).r;
      float decay = max(u_effect_decay, vExtra.y);
      outAlpha = clamp(value - decay, 0.0, 1.0);
      outColor = mix(u_secondary_color, u_primary_color, max(value - decay, 0.0)) * u_emission;`
  },
  explosion_trails: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 1, 1], emission: 2, noise_scale: [1, 1], noise_scroll: [0, 0.2] },
    samplers: ["noise_texture"],
    blend: "add",
    cut: 0.2,
    vertex: `
      float wave = sin((uv.x + uv.y - u_time) * 6.2831853 * 2.0) * 0.5 + 0.5;
      p += n * wave * 0.2 * (uv.y * 2.0);`,
    fragment: `
      float decay = 1.0 - vColor.a;
      float noise = texture2D(noise_texture, vUV).r;
      float value = overlay(1.0 - vUV.y * 2.0, noise);
      outAlpha = max(value - decay, 0.0);
      outColor = mix(u_secondary_color, u_primary_color, smoothstep(0.0, 1.0, value)) * u_emission;`
  },
  smoke_trail: {
    uniforms: { tertiary_color: [0.13, 0.13, 0.13] },
    samplers: ["noise_texture"],
    blend: "cut",
    cut: 0.1,
    lit: true,
    billboardUniform: true,
    fragment: `
      float radius = length(vUV * 2.0 - 1.0);
      float noise = texture2D(noise_texture, vUV * 0.5 + vColor.r).r;
      float value = noise - (1.0 - vColor.a) - pow(radius, 4.0);
      outAlpha = clamp(value, 0.0, 1.0);
      outColor = u_tertiary_color * (u_ambient + u_sunColor * 0.6);`
  }
};
PORTS["ElectricFX/glow"] = {
  uniforms: { primary_color: [1, 1, 1], secondary_color: [0, 0.84, 1], emission: 2, exponent: 4 },
  blend: "add",
  fragment: `
      float fresnel = clamp(pow(max(dot(normalize(vView), normalize(vNormal)), 0.0), u_exponent), 0.0, 1.0);
      outColor = mix(u_secondary_color, u_primary_color, fresnel) * u_emission;
      outAlpha = fresnel * vColor.a * vExtra.w;`
};
PORTS["ElectricFX/impact_sphere"] = {
  uniforms: { primary_color: [1, 1, 1], emission: 2, noise_scale: [1, 1], edge_hardness: 0.5 },
  samplers: ["noise_texture"],
  blend: "mix",
  fragment: `
      float noise = texture2D(noise_texture, vUV * u_noise_scale).r;
      float a = smoothstep(1.0 - vColor.a, 1.0, noise);
      a = smoothstep(0.5 * u_edge_hardness, 1.0 - 0.5 * u_edge_hardness, a);
      outColor = u_primary_color * u_emission;
      outAlpha = a * vExtra.w;`
};
PORTS.zap = {
  uniforms: { primary_color: [1, 1, 1], secondary_color: [0, 0.84, 1], noise_scale: [1, 1], noise_strength: 0.4, frequency: 0.4, amplitude: 0.4, zap_shape: 1 },
  samplers: ["noise_texture"],
  blend: "cut",
  cut: 0.5,
  cull: false,
  vertex: `
      // Metres along the bolt (Godot reads the world height of a bolt standing up; ours may lie along any line).
      float y = p.y * length(fw[1].xyz) / max(length(fw[0].xyz), 1e-4);
      float motion = u_time * 0.1;
      float rnd = pcolor.r;
      vec4 w;
      for (int i = 0; i < 4; i++) {
        float fr = (i == 1 || i == 3) ? u_frequency * 1.5 : u_frequency;
        float off = i == 0 ? motion + rnd : i == 1 ? 3.14159265 - motion - rnd : i == 2 ? -3.14159265 + motion + rnd : -6.2831853 - motion - rnd;
        float wave = abs(fract(y * fr + off) * 2.0 - 1.0) - 0.5;
        if (u_zap_shape > 2.5) wave = wave * wave * wave * wave * wave * 30.0;
        else if (u_zap_shape > 1.5) wave = wave * wave * wave * 6.0;
        w[i] = wave;
      }
      vec2 offset = vec2(w.x + w.y, w.z + w.w);
      float mask = pow(max(1.0 - uv.y * 2.0, 0.0), 0.5);
      p.xz += offset * u_amplitude * mask * (1.0 + (1.0 - pcolor.a));
      float detail = texture2D(noise_texture, vec2(uv.x, y) * u_noise_scale).r * u_noise_strength * mask;
      p.xz += n.xz * detail * offset;`,
  fragment: `
      float fresnel = pow(max(dot(normalize(vView), normalize(vNormal)), 0.0), 2.0);
      float noise = texture2D(noise_texture, vec2(vUV.x, vUV.y * 2.0) * u_noise_scale).r;
      float a = step(1.0 - vColor.a * vExtra.w, noise);
      a = clamp(a * (vUV.y * 4.0), 0.0, 1.0);
      outColor = mix(u_secondary_color, u_primary_color, step(0.5, fresnel)) * 3.0;
      outAlpha = a;`
};
PORTS.electric_particle = {
  uniforms: { primary_color: [1, 1, 1], secondary_color: [0, 0.84, 1], emission: 2, noise_scale: [1, 1], frequency: 1.5, amplitude: 0.3, edge_hardness: 1, edge_position: 0 },
  samplers: ["noise_texture"],
  blend: "cut",
  cut: 0.5,
  cull: false,
  vertex: `
      float mask = 1.0 - abs(uv.y * 4.0 - 1.0);
      float motion = u_time * 0.1;
      float rnd = pcolor.r;
      float w1 = abs(fract(uv.y * 2.0 * u_frequency + motion + rnd) * 2.0 - 1.0) - 0.5;
      float w2 = abs(fract(uv.y * 2.0 * u_frequency + 3.14159265 + motion - rnd) * 2.0 - 1.0) - 0.5;
      p.xz *= mask;
      p.xz += vec2(w1, w2) * u_amplitude;`,
  fragment: `
      float fresnel = pow(max(dot(normalize(vView), normalize(vNormal)), 0.0), 2.0);
      float noise = texture2D(noise_texture, vUV * u_noise_scale).r;
      noise -= 1.0 - vColor.a * vExtra.w;
      noise *= fresnel;
      noise -= u_edge_position;
      float a = u_edge_hardness >= 0.999 ? step(0.0001, noise) : smoothstep(0.0, 1.0 - u_edge_hardness, noise);
      float value = mix(fresnel, step(0.6, fresnel), u_edge_hardness);
      outColor = mix(u_secondary_color, u_primary_color, value) * u_emission;
      outAlpha = a;`
};
PORTS.ground_impact = {
  uniforms: { primary_color: [1, 1, 1], secondary_color: [0, 0.84, 1], emission: 2, impact_frequency: 4, grow_amount: 0.5, edge_hardness: 0.5, edge_position: 0.5 },
  blend: "mix",
  cull: false,
  fragment: `
      vec2 c = vUV * 2.0 - 1.0;
      float radius = length(c);
      float angle = atan(c.x, c.y);
      float r = vColor.r;
      float f = u_impact_frequency;
      float wave = (sin(angle * f + radius + r * 3.14159265) * 0.5 + 0.5) * 2.0
        + (sin(angle * f * 1.76 - radius - r * 0.5) * 0.5 + 0.5) * 1.5
        + (sin(angle * f * 3.14159265 + radius + r * 3.14159265) * 0.5 + 0.5)
        + (sin(angle * (f * 10.0 + 1.0) + radius - r * 0.5) * 0.5 + 0.5) * 0.2;
      float factor = max(1.0 - vColor.a * vExtra.w, 1e-3);
      float value = radius + wave * 0.1;
      value -= u_grow_amount - factor;
      value = max(1.0 - abs(value / factor), 0.0);
      value = clamp((value - u_edge_position) / (1.0 - u_edge_position), 0.0, 1.0);
      float a = smoothstep(0.1 * u_edge_hardness, 1.0 - 0.9 * u_edge_hardness, value);
      value = mix(value, floor(value * 4.0) / 3.0, u_edge_hardness);
      outColor = mix(u_secondary_color, u_primary_color, value) * 0.5 * (1.0 + value * u_emission);
      outAlpha = a;`
};
PORTS.ground_streaks = {
  uniforms: { primary_color: [1, 1, 1], emission: 4, streaks_frequency: 8, edge_hardness: 0.5, edge_position: 0.5 },
  blend: "add",
  cull: false,
  fragment: `
      float y = vUV.y;
      float sf = u_streaks_frequency;
      float wave = (sin(vUV.x * 6.2831853 * sf + u_time) * 0.5 + 0.5) * 2.0
        + (sin(vUV.x * 6.2831853 * (sf + 1.0) - u_time) * 0.5 + 0.5) * 2.0
        + (sin(vUV.x * 6.2831853 * (sf * 8.0) + u_time) * 0.5 + 0.5);
      float value = clamp(y - wave * 0.1, 0.0, 1.0);
      value = min(value, y);
      float ep = pow(u_edge_position, 3.0);
      value = clamp((value - ep) / (1.0 - ep), 0.0, 1.0);
      float a = smoothstep(0.009 * u_edge_hardness, 1.0 - 0.99 * u_edge_hardness, value) * vColor.a * vExtra.w;
      outColor = u_primary_color * u_emission * 2.0;
      outAlpha = a;`
};
PORTS.fire_particle = {
  uniforms: { primary_color: [1, 0.72, 0.29], secondary_color: [0.69, 0, 0.18], emission: 4, color_curve: 1, noise_scale: [1, 1], noise_scroll: [0, 1], flame_density: 0.5, wobble_amount: 1, wobble_frequency: 12, wobble_scroll: 4, edge_hardness: 0.9, edge_position: 0.2, effect_amount: 1, speed_scale: 1 },
  samplers: ["noise_texture"],
  blend: "mix",
  billboard: true,
  fragment: `
      float wobble = sin(vWorld.y * u_wobble_frequency - (u_time * u_wobble_scroll * u_speed_scale)) * (u_wobble_amount * 0.1);
      vec2 scroll = u_noise_scroll * u_time * u_speed_scale;
      vec2 wuv = ((vWorld.xy + vWorld.zz * 0.5) * u_noise_scale + vec2(wobble, 0.0)) * vec2(-1.0, 1.0);
      float off = texture2D(noise_texture, wuv * 0.5).r * 0.1;
      float noise = texture2D(noise_texture, wuv + vec2(0.0, off) - scroll).r;
      float mask = max((1.0 - length(vUV * 2.0 - 1.0)) - (1.0 - vColor.a), 0.0);
      float value = noise * mask;
      value += pow(mask, (1.0 - u_flame_density) * 8.0) * pow(vColor.a, 8.0);
      value -= 1.0 - u_effect_amount * vExtra.w;
      value = clamp(value, 0.0, 1.0);
      value = smoothstep(u_edge_position, mix(1.0, u_edge_position + 0.01, u_edge_hardness), value);
      vec3 col = mix(u_primary_color, u_secondary_color, pow(max(vColor.r, 0.0), u_color_curve));
      outColor = col * u_emission * (1.0 - vColor.r);
      outAlpha = value;`
};
PORTS.fire_core = {
  uniforms: { primary_color: [1, 0.72, 0.29], secondary_color: [0.69, 0, 0.18], emission: 4, noise_scale: [1, 1], noise_scroll: [0, 1], flame_scale: [1, 1], edge_hardness: 0.9, edge_position: 0.2, effect_amount: 1, speed_scale: 1 },
  samplers: ["noise_texture"],
  blend: "mix",
  billboard: true,
  fragment: `
      vec2 scroll = u_noise_scroll * u_time * u_speed_scale;
      float mask = max(1.0 - length(vUV * 2.0 - 1.0), 0.0);
      float noise = texture2D(noise_texture, (vUV * u_flame_scale * u_noise_scale) + scroll).r;
      float value = (mask * 4.0 - (1.0 - noise)) / 4.0;
      value -= 1.0 - u_effect_amount * vExtra.w;
      value = clamp(value, 0.0, 1.0);
      value = smoothstep(u_edge_position, mix(1.0, u_edge_position + 0.01, u_edge_hardness), value);
      outColor = u_primary_color * u_emission;
      outAlpha = value;`
};
const VOL1_HELPERS = `
float blendf(float a, float b, float mode) {
  if (mode < 0.5) return a + b;
  if (mode < 1.5) return a - b;
  if (mode < 2.5) return a * b;
  if (mode < 3.5) return min(a, b);
  if (mode < 4.5) return max(a, b);
  if (mode < 5.5) return 1.0 - (1.0 - a) * (1.0 - b);
  if (mode < 6.5) return a < 0.5 ? 2.0 * a * b : 1.0 - 2.0 * (1.0 - a) * (1.0 - b);
  if (mode < 7.5) return b < 0.5 ? 2.0 * a * b : 1.0 - 2.0 * (1.0 - a) * (1.0 - b);
  if (mode < 8.5) return b < 0.5 ? 2.0 * a * b + a * a * (1.0 - 2.0 * b) : sqrt(max(a, 0.0)) * (2.0 * b - 1.0) + 2.0 * a * (1.0 - b);
  if (mode < 9.5) return a / max(1.0 - b, 1e-3);
  if (mode < 10.5) return 1.0 - (1.0 - a) / max(b, 1e-3);
  return a + b - 1.0;
}
vec2 uvAlign(vec2 uv, float m) {
  if (m < 0.5) return uv;
  if (m < 1.5) return uv.yx;
  if (m < 2.5) return vec2(1.0 - uv.x, uv.y);
  return vec2(1.0 - uv.y, uv.x);
}
vec2 uvRadial(vec2 uv) {
  vec2 c = uv - 0.5;
  return vec2(atan(c.x, c.y) / 6.2831853, length(c));
}
vec2 uvRotate(vec2 uv, float a) {
  mat2 r = mat2(vec2(sin(a), -cos(a)), vec2(cos(a), sin(a)));
  return (uv - 0.5) * r + 0.5;
}
float maskOne(sampler2D tex, vec2 uv, vec2 scale, vec2 scroll, float radial, float rot, float offset) {
  vec2 mapped = (radial > 0.5 ? uvRadial(uv) : uv) * scale + vec2(offset);
  vec2 muv = uvRotate(uvAlign(mapped, u_uv_alignment) + vec2(u_time * u_time_scale) * scroll, u_time * rot);
  return texture2D(tex, muv).r;
}
float vol1Mask(vec2 uv, float offset) {
  float m = maskOne(mask1_texture, uv, u_mask1_scale, u_mask1_scroll, u_mask1_radial, u_mask1_rotation, offset);
  if (u_use_mask2 > 0.5) m = mix(m, blendf(m, maskOne(mask2_texture, uv, u_mask2_scale, u_mask2_scroll, u_mask2_radial, u_mask2_rotation, 0.0), u_mask2_blend_mode), u_mask2_strength);
  if (u_use_mask3 > 0.5) m = mix(m, blendf(m, maskOne(mask3_texture, uv, u_mask3_scale, u_mask3_scroll, u_mask3_radial, u_mask3_rotation, 0.0), u_mask3_blend_mode), u_mask3_strength);
  return m;
}`;
const VOL1_UNIFORMS = {
  mask1_scroll: [0, 0],
  mask1_scale: [1, 1],
  mask1_radial: 0,
  mask1_rotation: 0,
  use_mask2: 0,
  mask2_scroll: [0, 0],
  mask2_scale: [1, 1],
  mask2_strength: 0,
  mask2_blend_mode: 0,
  mask2_radial: 0,
  mask2_rotation: 0,
  use_mask3: 0,
  mask3_scroll: [0, 0],
  mask3_scale: [1, 1],
  mask3_strength: 0,
  mask3_blend_mode: 0,
  mask3_radial: 0,
  mask3_rotation: 0,
  primary_color: [1, 1, 1],
  secondary_color: [0.5, 0.5, 0.5],
  tertiary_color: [0.2, 0.2, 0.2],
  use_tertiary: 0,
  color_smoothness: 0.5,
  displacement_scale: 0,
  displacement_offset: 0.5,
  time_scale: 1,
  uv_alignment: 0,
  emission_strength: 2,
  alpha_smoothness: 0.954,
  alpha_multiplier: 0.954,
  alpha_mode: 0,
  alpha_cutoff: 0.05,
  edge_cutoff: [0, 0, 0, 0]
};
const vol1Fragment = (offset, tertiaryMixesB = false) => `
      float m = vol1Mask(vUV, ${offset});
      float cm = smoothstep(0.5 - u_color_smoothness * 0.5, 0.5 + u_color_smoothness * 0.5, m);
      vec3 albedo = ${tertiaryMixesB ? "mix(mix(u_secondary_color, u_primary_color, pow(cm, 2.0)), u_tertiary_color, vColor.b)" : "u_use_tertiary > 0.5 ? mix(u_tertiary_color, u_secondary_color, pow(cm, 3.0)) : mix(u_secondary_color, u_primary_color, pow(cm, 3.0))"};
      // Godot lights these (toon-ish) and adds EMISSION = albedo × strength: the sun, the sky and the glow.
      outColor = albedo * (u_ambient * 0.8 + u_sunColor * 0.35) + albedo * u_emission_strength * 0.5;
      // (Godot's clamp(lo, hi, mask) is min(hi, mask).)
      float am = min(0.5 + u_alpha_smoothness * 0.5, m);
      float a = clamp(pow(am, 3.0) * u_alpha_multiplier * vColor.a * vExtra.w, 0.0, 1.0);
      if (vUV.x < u_edge_cutoff.x || vUV.y < u_edge_cutoff.y || vUV.x > 1.0 - u_edge_cutoff.z || vUV.y > 1.0 - u_edge_cutoff.w) a = 0.0;
      if (u_alpha_mode > 0.5 && a < u_alpha_cutoff) a = 0.0;
      outAlpha = a;`;
const vol1Vertex = (offset) => `
      p += n * (vol1Mask(uv, ${offset}) - u_displacement_offset) * u_displacement_scale;`;
PORTS.transparent = {
  uniforms: VOL1_UNIFORMS,
  samplers: ["mask1_texture", "mask2_texture", "mask3_texture"],
  helpers: VOL1_HELPERS,
  blend: "mix",
  billboardUniform: true,
  vertex: vol1Vertex("0.0"),
  fragment: vol1Fragment("0.0")
};
PORTS.particle = { ...PORTS.transparent, vertex: vol1Vertex("pcolor.r"), fragment: vol1Fragment("vColor.r") };
PORTS.opaque = { ...PORTS.transparent, blend: "cut", cut: 0.05 };
PORTS["magic_areas/transparent"] = {
  ...PORTS.transparent,
  blend: "add",
  cull: false,
  pingPong: true,
  fragment: `${vol1Fragment("0.0")}
      outColor = albedo * u_emission_strength;
      outAlpha = clamp(a * 3.0, 0.0, 1.0);`
};
PORTS.smoke = { ...PORTS.transparent, vertex: "", fragment: vol1Fragment("vColor.r", true) };
PORTS.glow_fresnel = {
  uniforms: { fresnel_amount: 1, fresnel_exponent: 1, enable_mask: 0, mask_scroll: [0, 0], mask_scale: [1, 1], mask_blend_mode: 0, mask_blend: 0, emission_strength: 1, primary_color: [1, 1, 1], secondary_color: [0.5, 0.5, 0.5], alpha_multiplier: 0.954 },
  samplers: ["fresnel_gradient", "mask_texture"],
  helpers: VOL1_HELPERS.slice(0, VOL1_HELPERS.indexOf("vec2 uvAlign")),
  blend: "add",
  fragment: `
      float fres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), u_fresnel_amount);
      float value = pow(texture2D(fresnel_gradient, vec2(fres, 0.5)).r, u_fresnel_exponent);
      if (u_enable_mask > 0.5) value = clamp(mix(value, blendf(value, texture2D(mask_texture, vUV * u_mask_scale + vec2(u_time) * u_mask_scroll).r, u_mask_blend_mode), u_mask_blend), 0.0, 1.0);
      outColor = mix(u_secondary_color, u_primary_color, value) * u_emission_strength;
      outAlpha = value * u_alpha_multiplier * vColor.a * vExtra.w;`
};
const LOOT_HELPERS = `
const float LOOT_LIFT = 3.0;
vec2 toPolar(vec2 uv) {
  vec2 d = uv - 0.5;
  return vec2(atan(d.y, d.x) / 6.2831853, length(d) * 2.0);
}
vec3 shiftHue(vec3 c, float s) {
  vec3 g = vec3(0.57735);
  vec3 pr = g * dot(g, c);
  vec3 u = c - pr;
  vec3 v = cross(g, u);
  return u * cos(s * 6.2831853) + v * sin(s * 6.2831853) + pr;
}`;
PORTS.billboard_flare = {
  uniforms: { primary_color: [1, 1, 1], secondary_color: [0.5, 0.5, 1], emission: 2, hue_variation: 0.05, flare_streaks: 20, flare_ring: 0.6, flare_amount: 1, edge_hardness: 0 },
  samplers: ["noise_texture"],
  helpers: LOOT_HELPERS,
  blend: "add",
  billboardUniform: true,
  fragment: `
      vec2 pu = toPolar(vUV);
      float vo = vNormal.x * 4.0;
      float g1 = sin(pu.x * 3.14159265 * (u_flare_streaks * 0.4) + vo + u_time);
      float g2 = -sin(pu.x * 3.14159265 * u_flare_streaks - vo - u_time);
      float value = clamp(g1 * g2, 0.0, 1.0);
      float fm = pow(max(sin(pu.y * 3.14159265), 0.0), 8.0);
      value = pow(value, pu.y * 2.0);
      value = smoothstep(0.4 * u_edge_hardness, mix(1.0, 0.41, u_edge_hardness), value) * fm;
      float ring = max(1.0 - abs(pu.y * 2.0 - 1.0), 0.0);
      value += ring * ring * ring * ring * u_flare_ring;
      value *= u_flare_amount * vExtra.w;
      vec3 col = mix(u_secondary_color, u_primary_color, value);
      col = shiftHue(col, (texture2D(noise_texture, vUV).r * 2.0 - 1.0) * u_hue_variation);
      outColor = col * u_emission;
      outAlpha = value * 0.2 * LOOT_LIFT;`
};
PORTS.glow_core = {
  uniforms: { primary_color: [1, 1, 1], secondary_color: [0.5, 0.5, 1], emission: 2, hue_variation: 0.05, glow_amount: 1, edge_hardness: 0, fade_bottom: 0, bob_amount: 0.05 },
  samplers: ["noise_texture"],
  helpers: LOOT_HELPERS,
  blend: "add",
  vertex: `
      p.y += sin(u_time * 2.0) * u_bob_amount;`,
  fragment: `
      float f = pow(max(dot(normalize(vView), normalize(vNormal)), 0.0), 4.0) * u_glow_amount;
      f = smoothstep(0.0, 1.0, f);
      if (u_fade_bottom > 0.01) f = mix(f, f * pow(max((1.0 - vUV.y) * 2.0 - 1.0, 0.0), 0.2), u_fade_bottom);
      vec3 col = mix(u_secondary_color, u_primary_color, f);
      col = shiftHue(col, (texture2D(noise_texture, vUV).r * 2.0 - 1.0) * (min(vUV.y, 1.0 - vUV.y) * 2.0) * u_hue_variation);
      outColor = col * u_emission;
      outAlpha = clamp(f, 0.0, 1.0) * vExtra.w;`
};
PORTS.glow_tube = {
  uniforms: { primary_color: [1, 1, 1], secondary_color: [0.5, 0.5, 1], emission: 2, hue_variation: 0.05, align: 0, edge_hardness: 0, direction: [1, 0], detail_direction: [0, 1], density: 0.6, streaks: 8, scroll: 1, scale: 2, falloff: 4 },
  samplers: ["noise_texture"],
  helpers: LOOT_HELPERS,
  blend: "add",
  cull: false,
  vertex: `
      p.y += sin(u_time * 2.0) * 0.05;`,
  fragment: `
      float dir = dot(vUV, u_direction);
      float gr = 1.0 - abs(mod((dir - 0.5) * u_scale * 2.0 + u_time * u_scroll, 2.0) - 1.0);
      gr *= gr;
      float fr = abs(dot(normalize(vView), normalize(vNormal)));
      fr = fr * fr * fr;
      float glow = gr * fr;
      vec2 duv = u_align > 0.5 ? vUV.yx : vUV;
      float detail = abs(mod((dot(duv, u_detail_direction) - 0.5) * u_streaks + u_time, 2.0) - 1.0);
      detail = sqrt(detail) * 2.0 - (2.0 - u_density);
      glow *= detail;
      glow = smoothstep(0.03 * u_edge_hardness, mix(0.4, 0.03, u_edge_hardness), glow);
      float noise = texture2D(noise_texture, vUV).r;
      glow = overlay(glow, noise);
      vec3 col = shiftHue(mix(u_secondary_color, u_primary_color, fr), (noise * 2.0 - 1.0) * u_hue_variation);
      outColor = col * (u_emission / 2.0) * LOOT_LIFT;
      outAlpha = clamp(glow, 0.0, 1.0) * vExtra.w;`
};
PORTS.particle_star = {
  uniforms: { primary_color: [1, 1, 1], use_texture: 0, lock: 0, emission: 2 },
  samplers: ["particle_texture"],
  blend: "mix",
  vertex: `
      p.y += sin(u_time * 2.0 + pextra.x) * 0.05;`,
  fragment: `
      float shape;
      if (u_use_texture > 0.5 && u_lock < 0.5) shape = texture2D(particle_texture, vUV).a;
      else shape = smoothstep(1.0, 1.2, length(fract(vUV - 0.5) * 2.0 - 1.0));
      outColor = u_primary_color * u_emission;
      outAlpha = shape * vColor.a * vExtra.w;`
};
const PORTAL_HELPERS = `
varying vec3 vTanView;
vec2 portalAspect(vec2 uv) {
  vec2 c = uv * 2.0 - 1.0;
  c *= u_size.y < u_size.x ? vec2(1.0, u_size.y / u_size.x) : vec2(u_size.x / u_size.y, 1.0);
  return mod(c / 2.0 - 0.5, vec2(1.0));
}
float portalShape(vec2 uv, float opened) {
  return clamp(texture2D(shape_texture, uv).r / max(opened, 1e-4), 0.0, 1.0);
}`;
const PORTAL_LOD = `
      float lod = max(0.0, log2(max(length(dFdx(vUV)), length(dFdy(vUV))) * 128.0 * 1.5));`;
PORTS.portal = {
  uniforms: {
    size: [2, 2],
    primary_color: [1, 1, 1],
    secondary_color: [0.5, 0.5, 1],
    emission_strength: 2,
    shape_warp: 0.1,
    open_amount: 1,
    density: 0.4,
    edge_softness: 0.5,
    shrink_amount: 0.5,
    layers: 8,
    depth_amount: 1,
    depth_mult: 1,
    fade_amount: 1,
    fade_mult: 1,
    speed_scale: 1,
    spin_motion: 0.5,
    inward_motion: 1,
    base_motion: 0.2
  },
  samplers: ["noise_texture", "shape_texture"],
  helpers: PORTAL_HELPERS,
  blend: "mix",
  cull: false,
  vertex: `
      // The view from this spot in the quad's own frame (across, up, out), for the fragment's parallax.
      vec3 pv = eye - (fw * vec4(p, 1.0)).xyz;
      vTanView = vec3(dot(pv, normalize(mat3(fw) * vec3(1.0, 0.0, 0.0))), dot(pv, normalize(mat3(fw) * vec3(0.0, 1.0, 0.0))), dot(pv, normalize(mat3(fw) * n)));
      p += n * ((pow(1.0 - portalShape(uv, u_open_amount), 0.2) * 2.0 - 1.0) * 0.2) * u_open_amount;`,
  fragment: `
      vec2 uv = portalAspect(vUV);
      vec2 par = vec2(-vTanView.x, vTanView.y) / max(abs(vTanView.z), 0.001);${PORTAL_LOD}
      float tm = u_time * u_speed_scale;
      float value = 0.0;
      for (int i = 0; i < 16; i++) {
        if (float(i) >= u_layers) break;
        float t = float(i) / u_layers;
        vec2 off = par * (t * u_depth_amount * u_depth_mult);
        float circle = portalShape(vUV + off, u_open_amount - t * u_shrink_amount);
        circle = clamp((circle - (0.5 - u_density)) / (1.5 - u_density), 0.0, 1.0);
        vec2 nuv = uv + off;
        vec2 motion = vec2(tm) * (t + u_base_motion) * vec2(u_spin_motion, u_inward_motion) + vec2(t, 0.0);
        vec2 c2 = nuv * 4.0 - 2.0;
        vec2 q = vec2(atan(c2.x, c2.y) / 2.0, length(c2)) / 3.14159265 + motion;
        q.x *= 2.0;
        float warp = texture2DLodEXT(noise_texture, q, lod).r;
        vec2 c1 = nuv * (1.0 - warp * u_shape_warp) * 2.0 - 1.0;
        q = vec2(atan(c1.x, c1.y) / 2.0, length(c1)) / 3.14159265 + motion;
        float noise = texture2DLodEXT(noise_texture, q, lod).r;
        float sheet = overlay(circle, noise);
        sheet = smoothstep(mix(0.4, 0.8, 1.0 - u_edge_softness), mix(1.0, 0.8, 1.0 - u_edge_softness) + 1e-4, sheet);
        value = max(value, sheet * pow(1.0 - t, u_fade_amount * u_fade_mult));
      }
      float edge = portalShape(vUV, u_open_amount);
      vec3 col = clamp(mix(u_secondary_color, u_primary_color, value), 0.0, 1.0);
      // (The pack cuts the edge with step(); a hair of smoothing keeps it from crawling.)
      float a = smoothstep(0.18, 0.22, smoothstep(0.0, 0.5, 1.0 - edge));
      // The pack's portal is its own light (EMISSION twice its colour, under Godot's glow): drawn unlit and in its
      // colours as they are (the roll-off below undone), so a pair's colour is the colour seen, by day and by night.
      outColor = -log(vec3(1.0) - clamp(col, 0.0, 0.97)) / max(u_bright, 1e-3);
      outAlpha = a * vExtra.w;`
};
PORTS.portal_glow = {
  uniforms: { size: [2, 2], primary_color: [1, 1, 1], secondary_color: [0.5, 0.5, 1], emission_strength: 2, shape_warp: 0.1, open_amount: 1, edge_softness: 0.5, speed_scale: 1 },
  samplers: ["noise_texture", "shape_texture"],
  helpers: PORTAL_HELPERS,
  blend: "mix",
  cull: false,
  vertex: `
      vTanView = vec3(0.0);
      p += n * ((pow(1.0 - portalShape(uv, u_open_amount), 0.2) * 2.0 - 1.5) * 0.4) * pow(u_open_amount, 8.0);`,
  fragment: `
      vec2 uv = portalAspect(vUV);${PORTAL_LOD}
      float shape = clamp((1.0 - portalShape(vUV, sqrt(u_open_amount))) * 2.4, 0.0, 1.0);
      float inner = 1.0 - portalShape(vUV, u_open_amount);
      float innerMask = sqrt(clamp(inner - 0.43, 0.0, 1.0)) * 1.5;
      shape -= innerMask;
      vec2 motion = vec2(u_time * u_speed_scale) * vec2(0.05, 0.1);
      vec2 c3 = uv * 6.0 - 3.0;
      vec2 q = vec2(atan(c3.x, c3.y), length(c3)) / 3.14159265 + motion;
      q.x *= 3.0;
      float warp = texture2DLodEXT(noise_texture, q, lod).r;
      vec2 c1 = uv * (1.0 - warp * u_shape_warp) * 2.0 - 1.0;
      float noise = texture2DLodEXT(noise_texture, vec2(atan(c1.x, c1.y), length(c1)) / 3.14159265 + motion, lod).r;
      float glow = clamp(shape - (1.0 - noise), 0.0, 1.0);
      float rim = pow(clamp(inner * 2.4, 0.0, 1.0), 3.0) - innerMask;
      glow += clamp((rim - 0.5) / 0.45, 0.0, 1.0) * 0.5;
      glow = smoothstep(mix(0.4, 0.0, u_edge_softness), mix(0.4, 1.0, u_edge_softness) + 1e-4, glow);
      vec3 col = mix(u_secondary_color, u_primary_color, glow);
      outColor = -log(vec3(1.0) - clamp(col, 0.0, 0.97)) / max(u_bright, 1e-3);
      outAlpha = glow * vExtra.w;`
};
const STATUS_HELPERS = `
vec3 statusHue(vec3 color, float shift) {
  vec3 gray = vec3(0.57735);
  vec3 proj = gray * dot(gray, color);
  vec3 U = color - proj;
  vec3 V = cross(gray, U);
  return U * cos(shift * 6.2831853) + V * sin(shift * 6.2831853) + proj;
}
float statusEdge(float a, float pos, float hard) {
  return clamp((a - pos) / max(1.0 - hard, 1e-3), 0.0, 1.0);
}`;
const STATUS_COLOURS = { primary_color: [1, 0.8, 0.2], secondary_color: [1, 0.4, 0.1], tertiary_color: [0.6, 0.1, 0.05], emission: 2, color_curve: 1, hue_variation: 0.1, edge_hardness: 0, edge_position: 0 };
PORTS["StatusFX/aura_particle"] = {
  uniforms: { ...STATUS_COLOURS, use_secondary: 0, noise_scale: [0.5, 0.5], noise_scroll: [0, 0.1], shape_curve: 2, noise_twist: 0, waviness: 0.2 },
  samplers: ["noise_texture"],
  blend: "mix",
  helpers: STATUS_HELPERS,
  fragment: `
      float r = length(vUV * 2.0 - 1.0);
      vec2 nuv = (vec2(vUV.x + vUV.y * u_noise_twist, vUV.y) + vColor.r) * u_noise_scale + u_noise_scroll * u_time;
      nuv.x += sin(vUV.y * 20.0 + u_time * 6.0) * 0.1 * u_waviness;
      float noise = texture2D(noise_texture, nuv).r;
      float value = pow(max(noise - r, 0.0), u_shape_curve) * vColor.a;
      float cv = pow(value, u_color_curve);
      cv = mix(cv, floor(cv * 6.0) / 5.0, u_edge_hardness);
      vec3 col = mix(u_tertiary_color, u_use_secondary > 0.5 ? u_secondary_color : u_primary_color, cv);
      col = statusHue(col, (vColor.r - 0.5) * u_hue_variation) * (0.5 + vColor.r * 0.5);
      outColor = col * u_emission;
      outAlpha = statusEdge(value, u_edge_position, u_edge_hardness) * vExtra.w;`
};
PORTS["StatusFX/aura_sphere"] = {
  uniforms: { ...STATUS_COLOURS, hue_variation: 0, edge_position: 0.2, noise_scale: [3, 1], noise_scroll: [0.1, 0.4], noise_twist: 1, shape_curve: 2, waviness: 0.2 },
  samplers: ["noise_texture"],
  blend: "add",
  cull: false,
  helpers: STATUS_HELPERS,
  fragment: `
      vec2 suv = vUV + vec2(sin(vUV.y * 40.0 - u_time) * 0.1 * u_waviness, 0.0);
      vec2 nuv = vec2(suv.x - suv.y * u_noise_twist, suv.y) * u_noise_scale + u_time * u_noise_scroll;
      float noise = texture2D(noise_texture, nuv).r;
      // (Godot's pow of a negative number gives nothing past the band; here it is cut off.)
      float mask = pow(max((1.0 - abs(suv.y * 2.0 - 1.0) - 0.5) / 0.5, 0.0), 0.2);
      float value = smoothstep(0.5, 0.8, max(noise * mask, 0.0));
      vec3 col = gl_FrontFacing ? mix(u_secondary_color, u_primary_color, value) : u_tertiary_color;
      float hueWave = sin(vUV.x * 25.1327412 + u_time) + sin(vUV.y * 31.4159265 + u_time);
      col = statusHue(col, hueWave * u_hue_variation);
      outColor = col * u_emission;
      outAlpha = statusEdge(value, u_edge_position, u_edge_hardness) * vExtra.w;`
};
PORTS["StatusFX/noise_particle"] = {
  uniforms: { primary_color: [1, 0.8, 0.2], secondary_color: [1, 0.4, 0.1], emission: 2, hue_variation: 0.1, noise_scale: [3, 1], noise_scroll: [0.1, 0.4], edge_hardness: 0, edge_position: 0.2 },
  samplers: ["noise_texture"],
  blend: "mix",
  cull: false,
  helpers: STATUS_HELPERS,
  fragment: `
      float noise = texture2D(noise_texture, (vUV + vColor.r) * 0.3 * u_noise_scale + u_time * u_noise_scroll).r;
      float shape = smoothstep(0.2, 0.8, (1.0 - length(vUV * 2.0 - 1.0)) * noise);
      vec3 col = statusHue(mix(u_secondary_color, u_primary_color, noise), (vColor.r - 0.5) * u_hue_variation);
      outColor = col * u_emission;
      outAlpha = statusEdge(shape, u_edge_position, u_edge_hardness) * vExtra.w;`
};
PORTS["StatusFX/bubble_particle"] = {
  uniforms: { ...STATUS_COLOURS, edge_position: 0.2, bubble_warp: 0.03 },
  blend: "mix",
  helpers: STATUS_HELPERS,
  fragment: `
      vec2 cuv = vUV - 0.5;
      float angle = atan(cuv.x, cuv.y);
      float rand1 = floor(vColor.r * 4.0);
      float rand2 = mod(vExtra.x, 4.0);
      float wave = cos((angle + u_time) * (3.0 + rand1)) + sin((angle - u_time) * (3.0 + rand2));
      float r = length(vUV * 2.0 - 1.0);
      float sr = max(r + wave * u_bubble_warp * r, 0.0);
      float inside = step(sr, 0.8);
      float shape = max((0.2 + sr * sr * sr * sr) * inside - (1.0 - vColor.a), 0.0);
      float shine = max(1.0 - (length(vUV * 2.0 - 0.7) + 0.8) - (1.0 - vColor.a), 0.0);
      shape += sqrt(shine) * inside;
      vec3 col = mix(u_secondary_color, u_primary_color, shape);
      col = statusHue(col, (vColor.r - 0.5) * u_hue_variation) * (0.5 + vColor.r * 0.5);
      outColor = col * u_emission;
      outAlpha = statusEdge(shape, u_edge_position, u_edge_hardness) * vExtra.w;`
};
PORTS["StatusFX/ice_particle"] = {
  uniforms: { primary_color: [1, 0.8, 0.2], secondary_color: [1, 0.4, 0.1], emission: 2, hue_variation: 0.1, edge_hardness: 0, edge_position: 0.2 },
  blend: "mix",
  helpers: STATUS_HELPERS,
  fragment: `
      vec2 cuv = vUV * 2.0 - 1.0;
      float r = length(cuv);
      float angle = atan(cuv.x, cuv.y);
      float rand1 = floor(vColor.r * 5.0);
      float rand2 = mod(vExtra.x, 3.0);
      float disc = max(1.0 - r, 0.0);
      float branches = pow(sin(r * 3.14159265 * (3.0 + rand1)) * 0.5 + 0.5, 10.0) * disc;
      float streaks = cos(angle * (5.0 + rand2)) + disc * disc * disc * disc * 4.0 + branches * 3.0;
      streaks = step(1.0, streaks * vColor.a);
      vec3 col = statusHue(mix(u_secondary_color, u_primary_color, 1.0 - vUV.y), (vColor.r - 0.5) * u_hue_variation);
      outColor = col * u_emission;
      outAlpha = statusEdge(streaks, u_edge_position, u_edge_hardness) * vExtra.w;`
};
const VERTEX = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
#ifdef INSTANCES
attribute vec4 world0;
attribute vec4 world1;
attribute vec4 world2;
attribute vec4 world3;
#endif
attribute vec4 pcolor;
attribute vec4 pextra;
uniform mat4 world;
uniform mat4 view;
uniform mat4 viewProjection;
uniform vec3 eye;
uniform float u_time;
UNIFORMS
varying vec2 vUV;
varying vec4 vColor;
varying vec4 vExtra;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vWorld;
HELPERS
void main(void) {
  mat4 fw = world;
#ifdef INSTANCES
  fw = world * mat4(world0, world1, world2, world3);
#endif
  vec3 p = position;
  vec3 n = normal;
  VERTEX_BODY
#ifdef BILLBOARD
  vec3 centre = (fw * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 right = vec3(view[0][0], view[1][0], view[2][0]);
  vec3 up = vec3(view[0][1], view[1][1], view[2][1]);
  float ca = cos(pextra.z);
  float sa = sin(pextra.z);
  vec2 q = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
  vec3 wp = centre + right * q.x * length(fw[0].xyz) + up * q.y * length(fw[1].xyz);
  vec3 wn = -vec3(view[0][2], view[1][2], view[2][2]);
#else
  vec3 wp = (fw * vec4(p, 1.0)).xyz;
  vec3 wn = normalize(mat3(fw) * n);
#endif
  vUV = uv;
  vColor = pcolor;
  vExtra = pextra;
  vNormal = (view * vec4(wn, 0.0)).xyz;
  vView = (view * vec4(eye - wp, 0.0)).xyz;
  vWorld = wp;
#ifdef WORLD_NORMAL
  vNormal = wn;
#endif
  gl_Position = viewProjection * vec4(wp, 1.0);
}`;
const FRAGMENT = `
precision highp float;
varying vec2 vUV;
varying vec4 vColor;
varying vec4 vExtra;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vWorld;
uniform float u_time;
uniform float u_bright;
uniform float u_gain;
uniform vec3 u_sunDir;
uniform vec3 u_sunColor;
uniform vec3 u_ambient;
UNIFORMS
float overlay(float base, float blend) {
  float limit = step(0.5, base);
  return mix(2.0 * base * blend, 1.0 - 2.0 * (1.0 - base) * (1.0 - blend), limit);
}
HELPERS
void main(void) {
  vec3 outColor = vec3(0.0);
  float outAlpha = 1.0;
  FRAGMENT_BODY
  // Godot shows these through a tone map with glow; a soft roll-off keeps the hues instead of clipping to white.
  // (Not named c: the shader bodies use that name.)
  vec3 toned = vec3(1.0) - exp(-max(outColor, vec3(0.0)) * u_bright);
  // Brightness of this play (1, or less where Reduce flashing dims a blast near the camera: GodotVfx gain). Light that
  // adds to the scene is scaled down; a piece drawn over it (smoke, debris, a cut-out fireball) is capped instead, so a
  // dimmed blast's bright parts come down while its smoke keeps its own grey: scaling those turned smoke black.
#ifdef ADDITIVE
  toned *= u_gain;
#else
  toned = min(toned, vec3(0.3 + 0.7 * u_gain));
#endif
#ifdef CUT
  if (outAlpha < CUT) discard;
  gl_FragColor = vec4(toned, 1.0);
#else
  gl_FragColor = vec4(toned, clamp(outAlpha, 0.0, 1.0));
#endif
}`;
function glslUniforms(port) {
  const lines = [];
  for (const [k, v] of Object.entries(port.uniforms)) lines.push(`uniform ${Array.isArray(v) ? v.length === 2 ? "vec2" : v.length === 4 ? "vec4" : "vec3" : "float"} u_${k};`);
  for (const s of port.samplers ?? []) lines.push(`uniform sampler2D ${s};`);
  return lines.join("\n");
}
const shaderId = (name) => name.replace(/[^A-Za-z0-9_]/g, "_");
function portName(set, name) {
  if (set && PORTS[`${set}/${name}`]) return `${set}/${name}`;
  return PORTS[name] ? name : null;
}
let registered = false;
function registerShaders() {
  if (registered) return;
  registered = true;
  for (const [key, port] of Object.entries(PORTS)) {
    const u = glslUniforms(port);
    const name = shaderId(key);
    Effect.ShadersStore[`gv_${name}VertexShader`] = VERTEX.replace("UNIFORMS", u).replace("HELPERS", port.helpers ?? "").replace("VERTEX_BODY", port.vertex ?? "");
    Effect.ShadersStore[`gv_${name}FragmentShader`] = FRAGMENT.replace("UNIFORMS", u).replace("HELPERS", port.helpers ?? "").replace("FRAGMENT_BODY", port.fragment);
  }
}
function materialFor(scene, mat2, root, set, billboardAlign, key, cache, gain = 1, tint) {
  const portKey = portName(set, String(mat2.shader?.shader ?? ""));
  if (!portKey) return null;
  const port = PORTS[portKey];
  const shaderName = shaderId(portKey);
  const hit = cache.get(key);
  if (hit) return hit;
  registerShaders();
  const billboard = billboardAlign || port.billboard === true || port.billboardUniform === true && bool(mat2["shader_parameter/billboard"], false);
  const defines = [...billboard ? ["#define BILLBOARD"] : [], ...port.blend === "cut" || port.cut !== void 0 && port.blend !== "add" ? [`#define CUT ${(port.cut ?? 0.5) < 0 ? "-1.0" : (port.cut ?? 0.5).toFixed(3)}`] : [], ...port.lit ? ["#define WORLD_NORMAL"] : [], ...port.blend === "add" ? ["#define ADDITIVE"] : []];
  const uniforms = ["world", "view", "viewProjection", "eye", "u_time", "u_bright", "u_gain", "u_sunDir", "u_sunColor", "u_ambient", ...Object.keys(port.uniforms).map((k) => `u_${k}`)];
  const m = new ShaderMaterial(`gv_${key}`, scene, { vertex: `gv_${shaderName}`, fragment: `gv_${shaderName}` }, {
    attributes: ["position", "normal", "uv", "pcolor", "pextra"],
    uniforms,
    samplers: port.samplers ?? [],
    defines,
    needAlphaBlending: port.blend !== "cut" && !(port.cut !== void 0 && port.blend === "mix")
  });
  m.backFaceCulling = port.cull !== false && !billboard;
  if (port.blend === "add") m.alphaMode = Constants.ALPHA_ADD;
  else if (port.blend === "mix") m.alphaMode = Constants.ALPHA_COMBINE;
  if (port.blend !== "cut") m.disableDepthWrite = true;
  const tinted = tint ? hexColor(tint) : null;
  const param = (k) => {
    if (tinted && (k === "secondary_color" || k === "tertiary_color")) return { "@Color": tinted };
    if (tinted && k === "primary_color") return { "@Color": [0.55 + 0.45 * tinted[0], 0.55 + 0.45 * tinted[1], 0.55 + 0.45 * tinted[2], 1] };
    const own = mat2[`shader_parameter/${k}`];
    if (own !== void 0) return own;
    if (["primary_color", "secondary_color", "tertiary_color", "emission", "noise_scale", "noise_scroll", "noise_shape"].includes(k)) return root[k];
    return void 0;
  };
  for (const [k, d] of Object.entries(port.uniforms)) {
    const v = param(k);
    if (Array.isArray(d) && d.length === 4) {
      const a = ctor(v, "Vector4") ?? d;
      m.setVector4(`u_${k}`, new Vector4(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, a[3] ?? 0));
    } else if (Array.isArray(d) && d.length === 3) {
      const c = color(v, [d[0], d[1], d[2], 1]);
      m.setColor3(`u_${k}`, new Color3(c[0], c[1], c[2]));
    } else if (Array.isArray(d)) {
      const c = vec2(v, [d[0], d[1]]);
      m.setVector2(`u_${k}`, new Vector2(c[0], c[1]));
    } else m.setFloat(`u_${k}`, typeof v === "boolean" ? v ? 1 : 0 : num(v, d));
  }
  for (const s of port.samplers ?? []) {
    let spec = mat2[`shader_parameter/${s}`] ?? (s === "noise_texture" ? root.noise_texture : s === "smoke_texture" ? root.smoke_texture : null);
    if (s === "normal_texture" && !spec && root.smoke_texture) spec = { ...root.smoke_texture, as_normal_map: true, bump_strength: 32 };
    m.setTexture(s, spec && typeof spec.texture === "string" ? packTexture(scene, spec.texture) : spec && (spec.type === "GradientTexture2D" || spec.type === "GradientTexture1D" || spec.gradient && !spec.noise) ? gradientTexture(scene, spec) : noiseTexture(scene, spec, port.pingPong === true));
  }
  m.setFloat("u_bright", 0.55);
  m.setFloat("u_gain", gain);
  cache.set(key, m);
  return m;
}
function procOf(p) {
  const ring = num(p.emission_shape, 0) === 6;
  return {
    shape: num(p.emission_shape, 0),
    radius: num(p.emission_sphere_radius, 1),
    box: vec3(p.emission_box_extents, [1, 1, 1]),
    offset: vec3(p.emission_shape_offset, [0, 0, 0]),
    shapeScale: vec3(p.emission_shape_scale, [1, 1, 1]),
    ...ring ? { ring: { axis: vec3(p.emission_ring_axis, [0, 0, 1]), height: num(p.emission_ring_height, 1), radius: num(p.emission_ring_radius, 1), inner: num(p.emission_ring_inner_radius, 0) } } : {},
    dir: vec3(p.direction, [1, 0, 0]),
    spread: num(p.spread, 45),
    vel: [num(p.initial_velocity_min, 0), num(p.initial_velocity_max, 0)],
    gravity: vec3(p.gravity, [0, -9.8, 0]),
    damp: [num(p.damping_min, 0), num(p.damping_max, 0)],
    scale: [num(p.scale_min, 1), num(p.scale_max, 1)],
    scaleCurve: scaleCurves(p.scale_curve),
    alpha: curveOf(p.alpha_curve),
    ramp: p.color_ramp ? gradientOf(p.color_ramp) : null,
    initRamp: p.color_initial_ramp ? gradientOf(p.color_initial_ramp) : null,
    angle: [num(p.angle_min, 0), num(p.angle_max, 0)],
    radial: [num(p.radial_accel_min, 0), num(p.radial_accel_max, 0)],
    radialCurve: curveOf(p.radial_accel_curve),
    radialVel: [num(p.radial_velocity_min, 0), num(p.radial_velocity_max, 0)],
    velLimit: curveOf(p.velocity_limit_curve),
    orbit: p.orbit_velocity_curve?.type === "CurveXYZTexture" ? curveOf(p.orbit_velocity_curve.curve_y) : curveOf(p.orbit_velocity_curve),
    orbitVel: p.orbit_velocity_curve?.type === "CurveXYZTexture" ? [num(p.orbit_velocity_min, 0), num(p.orbit_velocity_max, 0)] : null,
    alignY: bool(p.particle_flag_align_y, false),
    rotateY: bool(p.particle_flag_rotate_y, false)
  };
}
const rnd = (a, b) => a + Math.random() * (b - a);
const DEG = Math.PI / 180;
function spawnPosition(pr) {
  let x = 0;
  let y = 0;
  let z = 0;
  if (pr.shape === 1 || pr.shape === 2) {
    const u = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = pr.radius * (pr.shape === 2 ? 1 : Math.cbrt(Math.random()));
    x = s * Math.cos(a) * r;
    y = u * r;
    z = s * Math.sin(a) * r;
  } else if (pr.shape === 3) {
    x = rnd(-1, 1) * pr.box[0];
    y = rnd(-1, 1) * pr.box[1];
    z = rnd(-1, 1) * pr.box[2];
  } else if (pr.shape === 6 && pr.ring) {
    const a = Math.random() * Math.PI * 2;
    const r = rnd(pr.ring.inner, pr.ring.radius);
    const h = rnd(-0.5, 0.5) * pr.ring.height;
    const ax = new Vector3(...pr.ring.axis).normalize();
    const t1 = Math.abs(ax.y) < 0.9 ? Vector3.Cross(ax, Vector3.Up()).normalize() : Vector3.Cross(ax, Vector3.Right()).normalize();
    const t2 = Vector3.Cross(ax, t1);
    const v = t1.scale(Math.cos(a) * r).add(t2.scale(Math.sin(a) * r)).add(ax.scale(h));
    x = v.x;
    y = v.y;
    z = v.z;
  }
  return new Vector3(x * pr.shapeScale[0] + pr.offset[0], y * pr.shapeScale[1] + pr.offset[1], z * pr.shapeScale[2] + pr.offset[2]);
}
function spawnVelocity(pr) {
  const d = new Vector3(...pr.dir);
  if (d.lengthSquared() < 1e-9) d.set(1, 0, 0);
  d.normalize();
  const spread = pr.spread * DEG;
  const cosT = 1 - Math.random() * (1 - Math.cos(spread));
  const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
  const phi = Math.random() * Math.PI * 2;
  const t1 = Math.abs(d.y) < 0.9 ? Vector3.Cross(d, Vector3.Up()).normalize() : Vector3.Cross(d, Vector3.Right()).normalize();
  const t2 = Vector3.Cross(d, t1);
  const dir = d.scale(cosT).add(t1.scale(sinT * Math.cos(phi))).add(t2.scale(sinT * Math.sin(phi)));
  return dir.scale(rnd(pr.vel[0], pr.vel[1]));
}
class Emitter {
  mesh;
  /** A second draw pass (Godot's draw_pass_2): another mesh drawn with the same particles. */
  mesh2 = null;
  /** The playing effect's strength (fading in or out), handed to the shaders as pextra.w. */
  level = 1;
  proc;
  parts = [];
  spawned = 0;
  emitFrom = -1;
  emitTo = Infinity;
  matrices;
  colors;
  extras;
  node;
  amount;
  lifetime;
  explode;
  oneShot;
  sub;
  align;
  trail;
  cap;
  constructor(base, node, nodeMatrix, material, sub2) {
    this.mesh = base;
    this.mesh.material = material;
    this.proc = procOf(node.process_material ?? {});
    this.amount = Math.max(1, Math.min(256, num(node.amount, 8)));
    this.lifetime = num(node.lifetime, 1);
    this.explode = num(node.explosiveness, 0);
    this.oneShot = bool(node.one_shot, false);
    this.align = num(node.transform_align, 0);
    this.trail = bool(node.trail_enabled, false);
    this.node = nodeMatrix;
    if (sub2) this.sub = sub2;
    this.cap = this.amount * (node.__subTarget ? 4 : 1);
    this.matrices = new Float32Array(this.cap * 16);
    this.colors = new Float32Array(this.cap * 4);
    this.extras = new Float32Array(this.cap * 4);
    this.mesh.thinInstanceSetBuffer("matrix", this.matrices, 16, false);
    this.mesh.thinInstanceSetBuffer("pcolor", this.colors, 4, false);
    this.mesh.thinInstanceSetBuffer("pextra", this.extras, 4, false);
    this.mesh.thinInstanceCount = 0;
  }
  /** Starts as if it had been running (VfxOptions.prefill): most of its particles out already, at every age. */
  prefill = false;
  /** Emitting from `t` (seconds since the effect began) until `until`. */
  start(t, until) {
    this.emitFrom = t;
    this.emitTo = until;
    this.spawned = 0;
    if (this.prefill && !this.oneShot) {
      const n = Math.floor(this.amount * 0.7);
      for (let i = 0; i < n; i++) this.spawnAt(t - (i + Math.random()) / n * this.lifetime * 0.9, null);
      this.spawned = 0;
    }
  }
  /** Stop putting out particles at `t`; those out finish their lives. */
  stop(t) {
    this.emitTo = Math.min(this.emitTo, t);
    if (this.oneShot && this.emitFrom >= 0) this.spawned = Math.max(this.spawned, this.amount);
  }
  /** A lasting effect's one-shot emitter that has finished goes again (Godot's looping emitters). */
  rearm(t) {
    if (this.oneShot && this.emitFrom >= 0 && this.emitTo === Infinity && this.spawned >= this.amount && t >= this.emitFrom + this.lifetime) this.start(t, Infinity);
  }
  /** Share the particles with a second mesh (draw_pass_2). */
  addPass(mesh, material) {
    mesh.material = material;
    mesh.thinInstanceSetBuffer("matrix", this.matrices, 16, false);
    mesh.thinInstanceSetBuffer("pcolor", this.colors, 4, false);
    mesh.thinInstanceSetBuffer("pextra", this.extras, 4, false);
    mesh.thinInstanceCount = 0;
    this.mesh2 = mesh;
  }
  /** A particle at `pos` (sub-emitters: where the parent is now). */
  spawnAt(t, pos) {
    if (this.parts.length >= this.cap) {
      this.spawned++;
      return;
    }
    const pr = this.proc;
    const p = {
      born: t,
      life: this.lifetime,
      pos: pos ? pos.clone().add(new Vector3(...pr.offset)) : spawnPosition(pr),
      vel: spawnVelocity(pr),
      scale: rnd(pr.scale[0], pr.scale[1]),
      angle: rnd(pr.angle[0], pr.angle[1]) * DEG,
      damp: rnd(pr.damp[0], pr.damp[1]),
      radial: rnd(pr.radial[0], pr.radial[1]),
      radialVel: rnd(pr.radialVel[0], pr.radialVel[1]),
      orbit: pr.orbitVel ? rnd(pr.orbitVel[0], pr.orbitVel[1]) : 1,
      init: pr.initRamp ? sampleGradient(pr.initRamp, Math.random(), [1, 1, 1, 1]) : [1, 1, 1, 1],
      id: this.spawned++,
      nextSub: t
    };
    this.parts.push(p);
  }
  lastT = 0;
  get alive() {
    return this.parts.length > 0 || this.emitFrom >= 0 && !this.doneEmitting;
  }
  get doneEmitting() {
    return this.oneShot ? this.spawned >= this.amount : this.lastT >= this.emitTo;
  }
  update(t, dt, cam, root) {
    this.lastT = t;
    const pr = this.proc;
    if (this.emitFrom >= 0 && t >= this.emitFrom) {
      if (this.oneShot) {
        const spanT = this.lifetime * (1 - this.explode);
        while (this.spawned < this.amount && t >= this.emitFrom + spanT * this.spawned / this.amount) this.spawnAt(this.emitFrom + spanT * this.spawned / this.amount, null);
      } else if (t < this.emitTo) {
        const want = Math.min(this.spawned + this.cap, Math.floor((t - this.emitFrom) / Math.max(1e-3, this.lifetime) * this.amount));
        while (this.spawned <= want) this.spawnAt(t, null);
      }
    }
    const g = pr.gravity;
    let n = 0;
    const m = Matrix.Identity();
    const q = new Quaternion();
    const tmp = Matrix.Identity();
    const col = [1, 1, 1, 1];
    const camView = cam?.getViewMatrix();
    this.parts = this.parts.filter((p) => {
      const age = t - p.born;
      const x = age / p.life;
      if (x >= 1 || age < 0) return age < 0;
      p.vel.x += g[0] * dt;
      p.vel.y += g[1] * dt;
      p.vel.z += g[2] * dt;
      if (p.radial) {
        const r = p.pos.clone();
        if (r.lengthSquared() > 1e-8) p.vel.addInPlace(r.normalize().scale(p.radial * sampleCurve(pr.radialCurve, x, 1) * dt));
      }
      if (p.damp) {
        const s = p.vel.length();
        if (s > 0) p.vel.scaleInPlace(Math.max(0, s - p.damp * dt) / s);
      }
      if (pr.orbit && p.orbit) {
        const w = sampleCurve(pr.orbit, x, 0) * p.orbit * Math.PI * 2 * dt;
        const c = Math.cos(w);
        const s = Math.sin(w);
        const px = p.pos.x;
        p.pos.x = px * c - p.pos.z * s;
        p.pos.z = px * s + p.pos.z * c;
      }
      if (pr.velLimit) {
        const lim = sampleCurve(pr.velLimit, x, Infinity);
        const sp = p.vel.length();
        if (sp > lim && sp > 0) p.vel.scaleInPlace(lim / sp);
      }
      p.pos.addInPlace(p.vel.scale(dt));
      if (p.radialVel) {
        const l = p.pos.length();
        if (l > 1e-6) p.pos.scaleInPlace(Math.max(0, l + p.radialVel * dt) / l);
      }
      if (this.sub && t >= p.nextSub) {
        p.nextSub = t + 1 / Math.max(1, this.sub.freq);
        this.sub.emitter.spawnAt(t, p.pos);
      }
      if (n >= this.cap) return true;
      const sc = pr.scaleCurve;
      const sx = p.scale * (sc ? sampleCurve(sc[0], x, 1) : 1);
      const sy = p.scale * (sc ? sampleCurve(sc[1], x, 1) : 1);
      const sz = p.scale * (sc ? sampleCurve(sc[2], x, 1) : 1);
      let angle = 0;
      if (pr.alignY || this.align === 2 || this.trail) {
        const mv = p.radialVel && p.pos.lengthSquared() > 1e-8 ? p.vel.add(p.pos.normalizeToNew().scale(p.radialVel)) : p.vel;
        const v = mv.lengthSquared() > 1e-8 ? mv.normalizeToNew() : Vector3.Up();
        const ref = Math.abs(v.y) < 0.95 ? Vector3.Up() : Vector3.Right();
        const xAxis = Vector3.Cross(v, ref).normalize();
        const zAxis = Vector3.Cross(xAxis, v);
        Quaternion.FromRotationMatrixToRef(Matrix.FromValues(xAxis.x, xAxis.y, xAxis.z, 0, v.x, v.y, v.z, 0, zAxis.x, zAxis.y, zAxis.z, 0, 0, 0, 0, 1), q);
      } else if (pr.rotateY) Quaternion.RotationYawPitchRollToRef(p.angle, 0, 0, q);
      else {
        Quaternion.RotationYawPitchRollToRef(0, 0, this.align === 1 ? 0 : p.angle, q);
        angle = p.angle;
      }
      if (this.align === 3 && camView) {
        const v = Vector3.TransformNormal(p.vel, camView);
        angle = Math.atan2(-v.x, v.y);
      }
      let stretch = 1;
      if (this.trail) stretch = Math.max(0.2, p.vel.length() * 0.3);
      Matrix.ComposeToRef(new Vector3(sx, sy * stretch, sz), q, p.pos, m);
      m.multiplyToRef(this.node, tmp);
      tmp.multiplyToRef(root, m);
      m.copyToArray(this.matrices, n * 16);
      if (pr.ramp) sampleGradient(pr.ramp, x, col);
      else col.splice(0, 4, 1, 1, 1, 1);
      this.colors[n * 4] = col[0] * p.init[0];
      this.colors[n * 4 + 1] = col[1] * p.init[1];
      this.colors[n * 4 + 2] = col[2] * p.init[2];
      this.colors[n * 4 + 3] = col[3] * p.init[3] * sampleCurve(pr.alpha, x, 1);
      this.extras[n * 4] = p.id;
      this.extras[n * 4 + 1] = 0;
      this.extras[n * 4 + 2] = angle;
      this.extras[n * 4 + 3] = this.level;
      n++;
      return true;
    });
    for (const mesh of this.mesh2 ? [this.mesh, this.mesh2] : [this.mesh]) {
      mesh.thinInstanceCount = n;
      if (n) {
        mesh.thinInstanceBufferUpdated("matrix");
        mesh.thinInstanceBufferUpdated("pcolor");
        mesh.thinInstanceBufferUpdated("pextra");
      }
      mesh.setEnabled(n > 0);
    }
  }
  dispose() {
    this.mesh.dispose();
    this.mesh2?.dispose();
  }
}
class Prop {
  constructor(mesh, name, base) {
    this.name = name;
    this.base = base;
    this.mesh = mesh;
    const t = base.getTranslation();
    this.pos = [t.x, t.y, t.z];
    mesh.thinInstanceSetBuffer("matrix", this.matrix, 16, false);
    mesh.thinInstanceSetBuffer("pcolor", this.colorBuf, 4, true);
    mesh.thinInstanceSetBuffer("pextra", this.extraBuf, 4, false);
  }
  name;
  base;
  mesh;
  matrix = new Float32Array(16);
  colorBuf = new Float32Array([1, 1, 1, 1]);
  extraBuf = new Float32Array([0, 0, 0, 1]);
  scale = [1, 1, 1];
  pos;
  rot = [0, 0, 0];
  decay = 0;
  /** The playing effect's strength (pextra.w). */
  level = 1;
  update(root) {
    const s = new Vector3();
    const r = new Quaternion();
    const tr = new Vector3();
    this.base.decompose(s, r, tr);
    const q = Quaternion.RotationYawPitchRoll(this.rot[1], this.rot[0], this.rot[2]).multiply(r);
    const m = Matrix.Compose(new Vector3(s.x * this.scale[0], s.y * this.scale[1], s.z * this.scale[2]), q, new Vector3(...this.pos)).multiply(root);
    m.copyToArray(this.matrix, 0);
    this.extraBuf[1] = this.decay;
    this.extraBuf[3] = this.level;
    this.mesh.thinInstanceBufferUpdated("matrix");
    this.mesh.thinInstanceBufferUpdated("pextra");
  }
}
function godotMatrix(v) {
  const t = ctor(v, "Transform3D");
  if (!t) return Matrix.Identity();
  return Matrix.FromValues(t[0], t[3], t[6], 0, t[1], t[4], t[7], 0, t[2], t[5], t[8], 0, t[9], t[10], t[11], 1);
}
const GAIN_STEPS = 10;
const QUALITY = {
  low: { playing: 6, minor: 3, loops: 4, density: 0.5 },
  medium: { playing: 12, minor: 7, loops: 10, density: 1 },
  high: { playing: 16, minor: 10, loops: 16, density: 1 }
};
const FADE = 0.25;
function rootMatrix(at, place2) {
  const scale = place2.scale ?? 1;
  const q = place2.up && Math.abs(place2.up.y) < 0.999 ? Quaternion.FromUnitVectorsToRef(Vector3.Up(), place2.up.clone().normalize(), new Quaternion()) : place2.up && place2.up.y < 0 ? Quaternion.RotationAxis(Vector3.Right(), Math.PI) : Quaternion.Identity();
  if (place2.yaw) q.multiplyInPlace(Quaternion.RotationAxis(Vector3.Up(), place2.yaw));
  return Matrix.Compose(new Vector3(scale, scale, scale), q, at);
}
class GodotVfx {
  constructor(scene) {
    this.scene = scene;
  }
  scene;
  playing = [];
  materials = /* @__PURE__ */ new Map();
  /** Materials of steady plays (VfxOptions.steady): their clock is never advanced. */
  still = /* @__PURE__ */ new Set();
  /** Materials of slowed plays (VfxOptions.slow) and the share of the clock's speed they run at. */
  slowed = /* @__PURE__ */ new Map();
  meshes = /* @__PURE__ */ new Map();
  serial = 0;
  sun = { dir: new Vector3(-0.4, -1, 0.3).normalize(), color: new Color3(1, 0.97, 0.9), ambient: new Color3(0.45, 0.45, 0.5) };
  caps = QUALITY.medium;
  /** Low graphics plays fewer effects at once and thins the lasting ones; high plays more. */
  set quality(q) {
    this.caps = QUALITY[q] ?? QUALITY.medium;
  }
  /** Light the lit effects (smoke) like the scene: the sun's direction and colour, and the sky's. */
  setLight(dir, sunColor, ambient) {
    this.sun = { dir: dir.normalize(), color: sunColor, ambient };
  }
  static async preload(...names) {
    await Promise.all(
      names.map(async (n) => {
        const p = await loadVfxPack(n);
        if (p) loaded.set(n, p);
      })
    );
  }
  /** Whether that pack's effects can be played now. */
  static ready(pack2) {
    return loaded.has(pack2);
  }
  /**
   * Play `effect` of `pack` at `at`, `scale` times its size; `up` turns it to stand on a surface. False when the pack
   * isn't in yet or too many are playing. `minor` effects (an impact's accent, a pickup's sparkle) stop at
   * MAX_MINOR, so they never crowd out an explosion.
   */
  play(pack2, effect, at, opts = {}) {
    const oneShots = this.playing.length - this.loopCount;
    if (oneShots >= (opts.minor ? this.caps.minor : this.caps.playing)) return false;
    return !!this.begin(pack2, effect, at, opts, false);
  }
  /**
   * Start a lasting effect (a fire, a charge ball, a glow): it runs, fading in, until its handle stops it. Null when
   * the pack isn't in or as many lasting effects play as the quality allows (callers keep their plain look).
   */
  start(pack2, effect, at, opts = {}) {
    if (this.liveLoops >= this.caps.loops) return null;
    const p = this.begin(pack2, effect, at, opts, true);
    if (!p) return null;
    const self = this;
    return {
      move(to, place2) {
        p.root = rootMatrix(to, { scale: opts.scale, up: opts.up, yaw: opts.yaw, ...place2 });
      },
      setLevel(level) {
        p.want = Math.max(0, Math.min(1, level));
      },
      stop() {
        if (p.stopAt === null) p.stopAt = p.t;
      },
      get done() {
        return !self.playing.includes(p);
      }
    };
  }
  /**
   * How many more lasting effects may start now (by graphics quality). One that was stopped and is fading out no
   * longer counts: it is on its way out (0.2-0.6 s), and on Low a flame trap cycling out of sight held one of the four
   * places through every fade, so the pads and portals in view lost theirs and faded in and out.
   */
  get loopRoom() {
    return Math.max(0, this.caps.loops - this.liveLoops);
  }
  /** Lasting effects playing now and not stopped (the ones fading out after a stop are left out). */
  get liveLoops() {
    let n = 0;
    for (const p of this.playing) if (p.loop && p.stopAt === null) n++;
    return n;
  }
  /** Lasting effects playing now. */
  get loopCount() {
    let n = 0;
    for (const p of this.playing) if (p.loop) n++;
    return n;
  }
  begin(pack2, effect, at, opts, loop) {
    const fx = loaded.get(pack2)?.effects[effect];
    if (!fx) return null;
    const root = rootMatrix(at, opts);
    const anim = (loop ? fx.animations.open ?? fx.animations.main : fx.animations.main) ?? Object.values(fx.animations).find((a) => a.length > 0.01);
    const emitters = /* @__PURE__ */ new Map();
    const props = [];
    const pieces = [];
    const dim = !loop && ((opts.gain ?? 1) < 1 || (opts.fadeIn ?? 0) > 0);
    const id = this.serial++;
    const wanted = (name) => (!opts.only || opts.only.includes(name)) && !opts.skip?.includes(name);
    const slow = opts.slow !== void 0 && opts.slow > 0 && opts.slow < 1 ? opts.slow : 1;
    const tk = `${opts.tint ? `#t${opts.tint}` : ""}${opts.steady ? "#still" : ""}${slow < 1 ? `#slow${slow}` : ""}`;
    const byName = new Map(fx.nodes.map((n) => [String(n.name), n]));
    const placeOf = (node) => {
      let m = godotMatrix(node.transform);
      for (let parent = typeof node.parent === "string" ? node.parent : null, guard = 0; parent && guard < 8; guard++) {
        const up = byName.get(parent.split("/").pop());
        if (!up) break;
        m = m.multiply(godotMatrix(up.transform));
        parent = typeof up.parent === "string" ? up.parent : null;
      }
      const stretch = opts.stretch && opts.stretch.nodes.includes(String(node.name)) ? opts.stretch.by : 1;
      return stretch !== 1 ? m.multiply(Matrix.Scaling(1, stretch, 1)) : m;
    };
    const subTargets = new Set(fx.nodes.map((n) => n.sub_emitter).filter((s) => typeof s === "string").map((s) => s.replace(/^\.\.\//, "")));
    const order = [...fx.nodes].sort((a, b) => Number(subTargets.has(String(b.name))) - Number(subTargets.has(String(a.name))));
    for (const node of order) {
      const name = String(node.name);
      if (!wanted(name) || node.visible === false) continue;
      if (node.type === "GPUParticles3D") {
        if (opts.steady) continue;
        const meshSpec = node.draw_pass_1;
        const matSpec = node.material_override;
        if (!meshSpec || !matSpec) continue;
        const align = num(node.transform_align, 0) === 1 || num(node.transform_align, 0) === 3;
        const material = materialFor(this.scene, matSpec, fx.root, fx.set, align, `${pack2}/${effect}/${name}${tk}`, this.materials, 1, opts.tint);
        if (!material) continue;
        if (slow < 1) this.slowed.set(material, slow);
        const mesh = pieceOf(this.baseMesh(`${pack2}/${effect}/${name}`, meshSpec), `gv_${name}_${id}`);
        mesh.metadata = EFFECT;
        mesh.setEnabled(false);
        const subName = typeof node.sub_emitter === "string" ? node.sub_emitter.replace(/^\.\.\//, "") : null;
        const target = subName ? emitters.get(subName) : void 0;
        const freq = num(node.process_material?.sub_emitter_frequency, 4);
        const thin = loop && this.caps.density < 1 && num(node.amount, 8) > 4 ? { amount: Math.max(2, Math.round(num(node.amount, 8) * this.caps.density)) } : {};
        const e = new Emitter(mesh, { ...subTargets.has(name) ? { ...node, __subTarget: true } : node, ...thin }, placeOf(node), material, target ? { emitter: target, freq } : void 0);
        const pass2 = num(node.draw_passes, 1) > 1 ? node.draw_pass_2 : void 0;
        if (opts.prefill && loop) e.prefill = true;
        if (pass2) {
          const m2 = pieceOf(this.baseMesh(`${pack2}/${effect}/${name}#2`, pass2), `gv_${name}2_${id}`);
          m2.metadata = EFFECT;
          m2.setEnabled(false);
          e.addPass(m2, material);
        }
        if (dim) pieces.push({ meshes: e.mesh2 ? [e.mesh, e.mesh2] : [e.mesh], at: (s) => s >= GAIN_STEPS ? material : materialFor(this.scene, matSpec, fx.root, fx.set, align, `${pack2}/${effect}/${name}${tk}#g${s}`, this.materials, s / GAIN_STEPS, opts.tint) });
        emitters.set(name, e);
      } else if (node.type === "MeshInstance3D") {
        const meshSpec = node.mesh;
        const matSpec = node.material_override ?? node["surface_material_override/0"];
        if (!meshSpec || !matSpec) continue;
        const material = materialFor(this.scene, matSpec, fx.root, fx.set, false, `${pack2}/${effect}/${name}${tk}`, this.materials, 1, opts.tint);
        if (!material) continue;
        if (opts.steady) this.still.add(material);
        else if (slow < 1) this.slowed.set(material, slow);
        const mesh = pieceOf(this.baseMesh(`${pack2}/${effect}/${name}`, meshSpec), `gv_${name}_${id}`);
        mesh.metadata = EFFECT;
        mesh.material = material;
        if (dim) pieces.push({ meshes: [mesh], at: (s) => s >= GAIN_STEPS ? material : materialFor(this.scene, matSpec, fx.root, fx.set, false, `${pack2}/${effect}/${name}${tk}#g${s}`, this.materials, s / GAIN_STEPS, opts.tint) });
        const prop = new Prop(mesh, name, placeOf(node));
        prop.decay = num(matSpec["shader_parameter/effect_decay"], 0);
        props.push(prop);
      }
    }
    if (!emitters.size && !props.length) return null;
    const tracks = anim?.tracks ?? [];
    const started = /* @__PURE__ */ new Set();
    for (const [name, e] of emitters) {
      const node = byName.get(name);
      const tr = tracks.find((t) => t.path === `${name}:emitting`);
      if (!tr && node.emitting !== false && ![...emitters.values()].some((x) => x.sub?.emitter === e)) {
        e.start(0, loop ? Infinity : anim?.length ?? 1);
        started.add(name);
      }
    }
    const level = loop ? 0 : 1;
    const gain = dim ? Math.max(0, Math.min(1, opts.gain ?? 1)) : 1;
    const p = { t: 0, length: anim?.length ?? 1, root, emitters, props, tracks, started, speed: (opts.speed ?? 1) * slow, slowed: slow < 1, loop, stopAt: null, level, want: 1, minor: !!opts.minor, gain, fadeIn: dim ? Math.max(0, opts.fadeIn ?? 0) : 0, age: 0, step: GAIN_STEPS, pieces };
    if (dim) this.applyGain(p);
    this.playing.push(p);
    return p;
  }
  /** A dimmed play's pieces drawn at the brightness step its gain (and fade-in) calls for now. */
  applyGain(p) {
    const g = p.gain * (p.fadeIn > 0 ? Math.min(1, p.age / p.fadeIn) : 1);
    const step = Math.max(1, Math.min(GAIN_STEPS, Math.round(g * GAIN_STEPS)));
    if (step === p.step) return;
    p.step = step;
    for (const piece of p.pieces) {
      const m = piece.at(step);
      if (m) for (const mesh of piece.meshes) mesh.material = m;
    }
  }
  baseMesh(key, spec) {
    let m = this.meshes.get(key);
    if (!m) {
      m = godotMesh(this.scene, spec, `gvBase_${this.meshes.size}`);
      m.setEnabled(false);
      this.meshes.set(key, m);
    }
    return m;
  }
  update(dtMs) {
    if (!this.playing.length) return;
    const wall = Math.min(0.05, dtMs / 1e3);
    const now = performance.now() / 1e3;
    for (const m of this.materials.values()) {
      m.setFloat("u_time", this.still.has(m) ? 0 : now % 1e3 * (this.slowed.get(m) ?? 1));
      m.setVector3("u_sunDir", this.sun.dir);
      m.setColor3("u_sunColor", this.sun.color);
      m.setColor3("u_ambient", this.sun.ambient);
      m.setVector3("eye", this.scene.activeCamera?.globalPosition ?? Vector3.Zero());
    }
    const cam = this.scene.activeCamera;
    this.playing = this.playing.filter((p) => {
      const dt = wall * p.speed;
      p.t += dt;
      p.age += wall;
      if (p.pieces.length) this.applyGain(p);
      if (p.loop) {
        const target = p.stopAt !== null ? 0 : p.want;
        p.level += Math.sign(target - p.level) * Math.min(Math.abs(target - p.level), wall / FADE);
        if (p.stopAt !== null) for (const e of p.emitters.values()) e.stop(p.stopAt);
        else for (const e of p.emitters.values()) e.rearm(p.t);
      }
      for (const tr of p.tracks) {
        const [node, prop] = tr.path.split(":");
        if (!node || !prop) continue;
        const v = trackAt(tr, p.t);
        if (prop === "emitting") {
          const e = p.emitters.get(node);
          if (!e) continue;
          const on = v === true;
          if (on && !p.started.has(node) && p.stopAt === null) {
            p.started.add(node);
            const times = tr.keys.times?.["@PackedFloat32Array"] ?? [];
            const vals = tr.keys.values ?? [];
            const i = vals.findIndex((x, k) => x === false && times[k] > p.t - dt);
            e.start(p.t, i >= 0 ? times[i] : Infinity);
          }
          continue;
        }
        const pr = p.props.find((x) => x.name === node);
        if (!pr || v === void 0) continue;
        const v3 = ctor(v, "Vector3");
        if (prop === "scale" && v3) pr.scale = [v3[0], v3[1], v3[2]];
        else if (prop === "position" && v3) pr.pos = [v3[0], v3[1], v3[2]];
        else if (prop === "rotation" && v3) pr.rot = [v3[0], v3[1], v3[2]];
        else if (prop.endsWith("effect_decay") && typeof v === "number") pr.decay = v;
      }
      const showProps = p.loop ? p.level > 1e-3 : p.t < p.length;
      let alive = p.loop ? p.stopAt === null || p.level > 1e-3 : p.t < p.length;
      for (const e of p.emitters.values()) {
        e.level = p.level;
        e.update(p.t, dt, cam, p.root);
        alive ||= e.alive;
      }
      for (const pr of p.props) {
        pr.level = p.level;
        pr.mesh.setEnabled(showProps);
        pr.update(p.root);
      }
      if (p.slowed && p.loop && p.stopAt !== null && p.level <= 1e-3) alive = false;
      if (!alive) {
        for (const e of p.emitters.values()) e.dispose();
        for (const pr of p.props) pr.mesh.dispose();
      }
      return alive;
    });
  }
  /**
   * Make an effect's meshes and materials before it's first needed (played out of sight and gone at once): its
   * first play otherwise built them mid-fight. What it made stays cached for later plays. (Not forceCompilation:
   * it polls every 16 ms until the material is ready, for ever once its mesh is gone.)
   */
  warm(pack2, effect, draw = false) {
    const p = this.begin(pack2, effect, new Vector3(0, -1e4, 0), {}, false);
    if (!p) return null;
    const end = () => {
      const i = this.playing.indexOf(p);
      if (i < 0) return;
      this.playing.splice(i, 1);
      for (const e of p.emitters.values()) e.dispose();
      for (const pr of p.props) pr.mesh.dispose();
    };
    if (draw) return end;
    end();
    return null;
  }
  /** At most this many one-shot effects play at once on medium graphics (each is a handful of meshes and particles). */
  static MAX_PLAYING = QUALITY.medium.playing;
  /** Minor effects play only while fewer than this many one-shots are playing (medium graphics). */
  static MAX_MINOR = QUALITY.medium.minor;
  /** How many effects are playing (tests). */
  get count() {
    return this.playing.length;
  }
  dispose() {
    for (const p of this.playing) {
      for (const e of p.emitters.values()) e.dispose();
      for (const pr of p.props) pr.mesh.dispose();
    }
    this.playing = [];
    for (const m of this.materials.values()) m.dispose();
    for (const m of this.meshes.values()) m.dispose();
  }
}
const KEEP_MS = 300;
const RANGE = 70;
const LOOT_FAR = 2.5;
const NEAR = 4;
const VIEW_RADIUS = 2;
const RANK_IN_VIEW = [0, 1, 2];
const RANK_OUT_OF_VIEW = [3, 4, 5];
const LOOT_SHARE = 0.5;
class LastingFx {
  constructor(vfx) {
    this.vfx = vfx;
  }
  vfx;
  wants = /* @__PURE__ */ new Map();
  live = /* @__PURE__ */ new Map();
  /** When `update` last ran (ms). */
  updated = 0;
  /** Ask for the effect `key` (`fire.zone` …) under `id` (one per thing) at `at` this frame. */
  want(id, key, at, place2 = {}) {
    const w = this.wants.get(id);
    if (w) {
      w.key = key;
      w.at = at;
      w.place = place2;
      w.seen = performance.now();
    } else this.wants.set(id, { id, key, at, place: place2, seen: performance.now() });
  }
  /** Whether `id`'s effect is drawn now (else its owner's plain look should show). */
  drawn(id) {
    const l = this.live.get(id);
    return !!l && !l.h.done;
  }
  /**
   * Draw the nearest wanted effects, stop the rest. `inView` (the camera's frustum: a spot and a radius in metres)
   * ranks what the camera can't see after everything it can: a flame trap behind the camera or off to the side no
   * longer takes a pad's, a portal's or a pickup's place on Low (4 places). Without it everything counts as seen.
   */
  update(cam, inView2) {
    const now = performance.now();
    for (const [id, w] of this.wants) if (now - w.seen > KEEP_MS && w.seen < this.updated) this.wants.delete(id);
    this.updated = now;
    const order = [...this.wants.values()].map((w) => ({ w, d: Math.hypot(w.at.x - cam.x, w.at.y - cam.y, w.at.z - cam.z) })).filter((x) => x.d <= Math.min(RANGE, x.w.place.range ?? RANGE)).map((x) => {
      const ref = lastingFx(x.w.key);
      const tier = ref?.decor ? 2 : ref?.fixture ? 1 : 0;
      const seen = !inView2 || x.d <= NEAR || inView2(x.w.at, VIEW_RADIUS * (x.w.place.size ?? 1));
      return { ...x, d: x.w.key.startsWith("loot.") ? x.d * LOOT_FAR : x.d, tier: seen ? RANK_IN_VIEW[tier] : RANK_OUT_OF_VIEW[tier] };
    }).sort((a, b) => a.tier - b.tier || a.d - b.d);
    const room = this.vfx.loopRoom + this.live.size;
    const lootRoom = Math.floor(room * LOOT_SHARE);
    const keep = /* @__PURE__ */ new Set();
    let loot = 0;
    for (const { w } of order) {
      if (keep.size >= room) break;
      if (w.key.startsWith("loot.") && loot++ >= lootRoom) continue;
      keep.add(w);
    }
    for (const [id, l] of this.live) {
      const w = this.wants.get(id);
      if (!w || !keep.has(w) || l.h.done || l.fx !== w.key || l.steady !== !!w.place.steady || l.slow !== (w.place.slow ?? 1) || l.tint !== (w.place.tint ?? "")) {
        l.h.stop();
        this.live.delete(id);
      }
    }
    for (const { w } of order) {
      if (!keep.has(w)) continue;
      const ref = lastingFx(w.key);
      if (!ref) continue;
      const at = new Vector3(w.at.x, w.at.y, w.at.z);
      const place2 = { scale: ref.scale * (w.place.size ?? 1), ...w.place.up ? { up: new Vector3(w.place.up.x, w.place.up.y, w.place.up.z) } : {}, ...w.place.yaw ? { yaw: w.place.yaw } : {} };
      const colour = w.place.tint ?? ref.tint;
      const tint = colour ? { tint: colour } : {};
      const id = w.id;
      let l = this.live.get(id);
      if (!l) {
        const steady = !!w.place.steady;
        const h = this.vfx.start(ref.pack, ref.effect, at, { ...place2, ...tint, ...ref.skip ? { skip: ref.skip } : {}, ...steady ? { steady } : {}, ...w.place.slow !== void 0 ? { slow: w.place.slow } : {}, ...w.place.prefill ? { prefill: true } : {}, ...w.place.stretch ? { stretch: w.place.stretch } : {} });
        if (!h) continue;
        this.live.set(id, l = { h, fx: w.key, steady, tint: w.place.tint ?? "", slow: w.place.slow ?? 1 });
      } else l.h.move(at, place2);
      l.h.setLevel(w.place.level ?? 1);
    }
  }
  /** How many are drawn (tests and the performance report). */
  get count() {
    return this.live.size;
  }
  dispose() {
    for (const l of this.live.values()) l.h.stop();
    this.live.clear();
    this.wants.clear();
  }
}
const ASK_RANGE = 75;
class PropFlames {
  /** `enabled` false (low graphics): no pack flames, the models' own flames only. */
  constructor(lasting2, enabled) {
    this.lasting = lasting2;
    this.enabled = enabled;
  }
  lasting;
  enabled;
  entries = [];
  add(entityId, root, flame, scale, moving) {
    this.entries.push({
      id: `prop:${entityId}`,
      key: `flame.${flame.fx}`,
      root,
      local: new Vector3(flame.at[0], flame.at[1], flame.at[2]),
      size: flame.size * scale,
      smoke: (flame.smoke ?? 0) * scale,
      moving,
      world: null,
      hide: flame.hide ?? [],
      plain: null,
      plainShown: true
    });
  }
  get size() {
    return this.entries.length;
  }
  /** Ask for the flames near the camera (before LastingFx.update). */
  want(cam) {
    if (!this.enabled) return;
    for (const e of this.entries) {
      if (!e.root.isEnabled(false)) continue;
      const at = this.flamePoint(e);
      const dx = at.x - cam.x;
      const dy = at.y - cam.y;
      const dz = at.z - cam.z;
      if (dx * dx + dy * dy + dz * dz > ASK_RANGE * ASK_RANGE) continue;
      this.lasting.want(e.id, e.key, at, { size: e.size });
      if (e.smoke) this.lasting.want(`${e.id}:smoke`, "smoke.wreck", at, { size: e.smoke });
    }
  }
  /** Show each model's own flame where its pack flame isn't drawn (after LastingFx.update). */
  show() {
    for (const e of this.entries) {
      if (!e.hide.length) continue;
      const shown = !this.lasting.drawn(e.id);
      if (shown === e.plainShown && e.plain) continue;
      const plain = this.plainOf(e);
      if (!plain) continue;
      for (const m of plain) m.setEnabled(shown);
      e.plainShown = shown;
    }
  }
  flamePoint(e) {
    if (e.world && !e.moving) return e.world;
    const w = Vector3.TransformCoordinates(e.local, e.root.computeWorldMatrix(true));
    e.world = { x: w.x, y: w.y, z: w.z };
    return e.world;
  }
  /** The model's meshes drawn with one of the `hide` materials (null until the model is in). */
  plainOf(e) {
    if (e.plain) return e.plain;
    const meshes = e.root.getChildMeshes(false);
    if (!meshes.length) return null;
    e.plain = meshes.filter((m) => !!m.material && e.hide.some((h) => m.material.name === h || m.material.name.startsWith(`${h}_#`)));
    return e.plain;
  }
  dispose() {
    this.entries.length = 0;
  }
}
const STATUS_FX_RANGE = 40;
const STATUS_FX_MAX = 3;
const STATUS_FX = {
  level: 0.8,
  calmLevel: 0.65,
  rise: 3,
  calmRise: 0.8,
  calmSlow: 0.5
};
function statusFxKind(bits) {
  if (bits & STATUS_FROZEN) return "chill";
  if (bits & STATUS_BURN) return "burn";
  if (bits & STATUS_POISON) return "poison";
  if (bits & STATUS_SLOW) return "slow";
  if (bits & STATUS_CHILL) return "chill";
  return null;
}
function plainStatus(bits, worn) {
  if (!worn) return bits;
  if (bits & STATUS_FROZEN) return STATUS_FROZEN;
  const kind = statusFxKind(bits);
  return kind === "poison" ? STATUS_POISON : kind === "slow" ? STATUS_SLOW : 0;
}
function statusFxLevel(level, drawn, dt, calm) {
  if (!drawn) return 0;
  return ease$1(level, calm ? STATUS_FX.calmLevel : STATUS_FX.level, dt, calm ? STATUS_FX.calmRise : STATUS_FX.rise, 4);
}
class StatusFx {
  constructor(lasting2) {
    this.lasting = lasting2;
  }
  lasting;
  asks = [];
  levels = /* @__PURE__ */ new Map();
  last = 0;
  /** A live character (not your own) with status `bits`, standing at `feet`, `size` times the usual height, as seen from `cam`. */
  ask(slot, bits, feet, size, cam) {
    const kind = statusFxKind(bits);
    if (!kind) return;
    const d2 = (feet.x - cam.x) ** 2 + (feet.y - cam.y) ** 2 + (feet.z - cam.z) ** 2;
    if (d2 > STATUS_FX_RANGE ** 2) return;
    this.asks.push({ slot, kind, at: { x: feet.x, y: feet.y + 0.95 * size, z: feet.z }, size, d2 });
  }
  /** Whether `slot`'s aura is drawn now (else its plain shell shows). */
  worn(slot) {
    return this.lasting.drawn(`status:${slot}`);
  }
  /** Ask for the nearest characters' auras this frame (`now` in ms; `calm`: Reduce flashing on). */
  flush(now, calm) {
    const dt = this.last ? Math.min(0.1, Math.max(0, (now - this.last) / 1e3)) : 0;
    this.last = now;
    const near = this.asks.sort((a, b) => a.d2 - b.d2).slice(0, STATUS_FX_MAX);
    this.asks = [];
    const seen = /* @__PURE__ */ new Set();
    for (const a of near) {
      seen.add(a.slot);
      const id = `status:${a.slot}`;
      const level = statusFxLevel(this.levels.get(a.slot) ?? 0, this.lasting.drawn(id), dt, calm);
      this.levels.set(a.slot, level);
      this.lasting.want(id, `status.${a.kind}`, a.at, { size: a.size, level, range: STATUS_FX_RANGE, prefill: true, ...calm ? { slow: STATUS_FX.calmSlow } : {} });
    }
    for (const slot of this.levels.keys()) if (!seen.has(slot)) this.levels.delete(slot);
  }
}
Effect.ShadersStore.heightFogFragmentShader = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform sampler2D depthSampler;
uniform mat4 invViewProj;
uniform vec3 camPos;
uniform vec3 camForward;
uniform vec3 fogColor;
uniform float density;
uniform float baseY;
uniform float falloff;
uniform float maxFog;
void main(void) {
  vec4 color = texture2D(textureSampler, vUV);
  float viewZ = texture2D(depthSampler, vUV).r;
  vec4 far = invViewProj * vec4(vUV * 2.0 - 1.0, 1.0, 1.0);
  vec3 dir = normalize(far.xyz / far.w - camPos);
  // Nothing drawn here (the sky): fog it as if the ground went on a long way, so the horizon blends.
  float dist = viewZ > 5000.0 || viewZ <= 0.0 ? 600.0 : viewZ / max(dot(dir, camForward), 0.05);
  float dy = dir.y * dist;
  float k = falloff * dy;
  float along = abs(k) > 1e-4 ? (1.0 - exp(-k)) / k : 1.0;
  float amount = density * exp(-falloff * (camPos.y - baseY)) * dist * along;
  float f = clamp(1.0 - exp(-amount), 0.0, maxFog);
  gl_FragColor = vec4(mix(color.rgb, fogColor, f), color.a);
}`;
const PREPASS_DEPTH = 5;
function prePass(scene) {
  return scene.prePassRenderer ?? null;
}
function prePassDepth(scene) {
  const pp = prePass(scene);
  if (!pp?.enabled) return null;
  const i = pp.getIndex(PREPASS_DEPTH);
  return i >= 0 ? pp.getRenderTarget()?.textures?.[i] ?? null : null;
}
const SUNNY = /* @__PURE__ */ new Set(["clear", "cloudy", "sunrise", "sunset", "dusk", "misty", "snowy"]);
const OCCLUDER_RADIUS = 2;
const OCCLUDER_REFRESH_MS = 2e3;
const SUN_DIAMETER = 36;
const SUN_DISTANCE = 900;
const SUN_CONE = 2 * (SUN_DIAMETER / 2) / SUN_DISTANCE + 0.01;
const SUN_CONE_TAN = Math.tan(SUN_CONE);
const SUN_CONE_COS = Math.cos(SUN_CONE);
function coversSun(m, eye, toSun) {
  const b = m.getBoundingInfo().boundingSphere;
  const c = b.centerWorld;
  const r = b.radiusWorld;
  const vx = c.x - eye.x;
  const vy = c.y - eye.y;
  const vz = c.z - eye.z;
  const t = vx * toSun.x + vy * toSun.y + vz * toSun.z;
  if (t < -r) return false;
  const off = Math.sqrt(Math.max(0, vx * vx + vy * vy + vz * vz - t * t));
  return off <= Math.max(t, 0) * SUN_CONE_TAN + r / SUN_CONE_COS;
}
const SUN_VIEW_MARGIN = 0.35;
function sunInView(camera, toSun) {
  const engine = camera.getEngine();
  const aspect = engine.getAspectRatio(camera);
  const vertical = camera.fovMode === 0 ? camera.fov : 2 * Math.atan(Math.tan(camera.fov / 2) / Math.max(aspect, 1e-3));
  const t = Math.tan(vertical / 2);
  const corner = Math.atan(t * Math.sqrt(1 + aspect * aspect));
  const forward = camera.getDirection(Vector3.Forward());
  const cos = Vector3.Dot(forward, toSun) / Math.max(forward.length(), 1e-6);
  return Math.acos(Math.max(-1, Math.min(1, cos))) <= corner + SUN_VIEW_MARGIN;
}
class SkyEffects {
  constructor(scene, camera, quality) {
    this.scene = scene;
    this.camera = camera;
    this.quality = quality;
  }
  scene;
  camera;
  quality;
  fog = null;
  depth = null;
  rays = null;
  observer = null;
  apply(doc, backdrop, sky) {
    this.dispose();
    if (this.quality === "low") return;
    const mist = backdrop.mist ?? 0;
    if (mist > 0 && sky.id !== "space") {
      if (this.quality === "high") this.addFog(doc, mist, Color3.FromHexString(sky.horizon));
      else this.foldMist(mist, Color3.FromHexString(sky.horizon));
    }
    if (this.quality === "high" && SUNNY.has(sky.id) && sky.light.elevation < 75) this.addRays(sky);
  }
  dispose() {
    this.fog?.dispose(this.camera);
    if (this.rays) {
      this.rays.mesh.material?.dispose();
      this.rays.mesh.dispose();
      this.rays.dispose(this.camera);
    }
    if (this.observer) this.scene.onBeforeRenderObservable.remove(this.observer);
    if (this.depth) this.scene.disableDepthRenderer(this.camera);
    this.fog = this.rays = this.depth = null;
    this.observer = null;
  }
  /**
   * Medium: the mist thickens the scene's own distance fog, worked out in each material as it draws.
   * The height fog needs the scene's depth, and drawing that took a second pass over the whole scene
   * every frame (hundreds of draw calls in a city map).
   */
  foldMist(mist, color2) {
    if (this.scene.fogMode !== 2 || this.scene.fogDensity === 0) {
      this.scene.fogMode = 2;
      this.scene.fogColor = color2;
      this.scene.fogDensity = 0;
    }
    this.scene.fogDensity += mist * 6e-3;
  }
  addFog(doc, mist, color2) {
    const shared2 = perfOn("fogprepass") && !!prePass(this.scene);
    if (!shared2) this.wholeDepth();
    const t = doc.terrain;
    const baseY = t ? t.baseY + [...t.heights].sort((a, b) => a - b)[Math.floor(t.heights.length * 0.2)] / 100 : 0;
    const fog = new PostProcess("heightFog", "heightFog", ["invViewProj", "camPos", "camForward", "fogColor", "density", "baseY", "falloff", "maxFog"], ["depthSampler"], 1, this.camera);
    const inv = new Matrix();
    fog.onApply = (effect) => {
      this.camera.getTransformationMatrix().invertToRef(inv);
      const depth = (this.depth ? null : prePassDepth(this.scene)) ?? this.wholeDepth().getDepthMap();
      effect.setTexture("depthSampler", depth);
      effect.setMatrix("invViewProj", inv);
      effect.setVector3("camPos", this.camera.globalPosition);
      effect.setVector3("camForward", this.camera.getDirection(Vector3.Forward()));
      effect.setColor3("fogColor", color2);
      effect.setFloat("density", 15e-4 + mist * 0.011);
      effect.setFloat("baseY", baseY);
      effect.setFloat("falloff", 0.32 - mist * 0.16);
      effect.setFloat("maxFog", 0.35 + mist * 0.35);
    };
    this.fog = fog;
  }
  /** The scene's depth map of the whole view (made on first use; water shares it and leaves it whole). */
  wholeDepth() {
    if (!this.depth) {
      this.depth = this.scene.enableDepthRenderer(this.camera, false, true, Texture.NEAREST_SAMPLINGMODE, true);
      markWholeSceneDepth(this.depth);
    }
    return this.depth;
  }
  addRays(sky) {
    const sun = this.scene.getLightByName("sun");
    if (!sun) return;
    const disc = CreateSphere("sunDisc", { diameter: 1, segments: 12 }, this.scene);
    disc.scaling.setAll(SUN_DIAMETER);
    disc.isPickable = false;
    const mat2 = new StandardMaterial("sunDiscMat", this.scene);
    mat2.disableLighting = true;
    mat2.emissiveColor = Color3.FromHexString(sky.light.sunColor);
    disc.material = mat2;
    const rays = new VolumetricLightScatteringPostProcess("sunRays", { postProcessRatio: 1, passRatio: 0.5 }, this.camera, disc, 64, Texture.BILINEAR_SAMPLINGMODE, this.scene.getEngine(), false, this.scene);
    rays.exposure = 0.2;
    rays.decay = 0.965;
    rays.weight = 0.5;
    rays.density = 0.9;
    const pass = rays.getPass();
    const scene = this.scene;
    const camera = this.camera;
    let occluders = [disc];
    const near = [disc];
    const sunOnly = [disc];
    const toSun = new Vector3();
    let inView2 = true;
    let nearFrame = -1;
    pass.getCustomRenderList = () => {
      if (!inView2) return sunOnly;
      const frame = scene.getFrameId();
      if (frame === nearFrame) return near;
      nearFrame = frame;
      near.length = 1;
      const p = camera.globalPosition;
      for (const m of occluders) if (m !== disc && !m.isDisposed() && coversSun(m, p, toSun)) near.push(m);
      return near;
    };
    const collect = () => {
      const list = [disc];
      for (const m of scene.meshes) {
        if (m === disc || !m.isEnabled() || m.renderingGroupId !== 0 || m.metadata?.effect) continue;
        if (m.getBoundingInfo().boundingSphere.radiusWorld >= OCCLUDER_RADIUS) list.push(m);
      }
      occluders = list;
      pass.renderList = list;
    };
    let next = 0;
    this.observer = scene.onBeforeRenderObservable.add(() => {
      sun.direction.normalizeToRef(toSun).scaleInPlace(-1);
      disc.position.copyFrom(camera.globalPosition).addInPlace(toSun.scale(SUN_DISTANCE));
      const now = performance.now();
      if (now >= next) {
        next = now + OCCLUDER_REFRESH_MS;
        collect();
      }
      inView2 = sunInView(camera, toSun);
    });
    this.rays = rays;
  }
}
class FrameSpread {
  constructor(budgetMs, drainFrames = 20, clock = () => performance.now()) {
    this.budgetMs = budgetMs;
    this.drainFrames = drainFrames;
    this.clock = clock;
  }
  budgetMs;
  drainFrames;
  clock;
  steps = [];
  head = 0;
  /** Steps waiting. */
  get size() {
    return this.steps.length - this.head;
  }
  /** Queue steps, to run in this order after everything queued before them. */
  push(...steps) {
    this.steps.push(...steps);
  }
  /** This frame's share: steps until the budget is used, at least its share of the queue. Returns how many ran. */
  run() {
    if (!this.size) return 0;
    const t0 = this.clock();
    const least = Math.ceil(this.size / this.drainFrames);
    let ran = 0;
    do {
      this.next();
      ran++;
    } while (this.size && (ran < least || this.clock() - t0 < this.budgetMs));
    this.compact();
    return ran;
  }
  /** Everything at once (the view is going: nothing may be left waiting). */
  flush() {
    while (this.size) this.next();
    this.compact();
  }
  next() {
    const step = this.steps[this.head];
    this.head++;
    step();
  }
  compact() {
    if (!this.size) {
      this.steps.length = 0;
      this.head = 0;
    } else if (this.head > 64) {
      this.steps.splice(0, this.head);
      this.head = 0;
    }
  }
}
let installed = false;
const animated = /* @__PURE__ */ new WeakSet();
const tracked = /* @__PURE__ */ new WeakSet();
function installAnimationPatches() {
  if (installed) return;
  installed = true;
  const proto = Animatable.prototype;
  const stop = proto.stop;
  proto.stop = function(animationName, targetMask, useGlobalSplice = false, skipOnAnimationEnd = false) {
    if (useGlobalSplice && !animationName && !targetMask) {
      const runtime = this._runtimeAnimations;
      if (!runtime.length) return;
      for (let i = 0; i < runtime.length; i++) runtime[i].dispose();
      runtime.length = 0;
      if (!skipOnAnimationEnd) this._raiseOnAnimationEnd();
      return;
    }
    return stop.call(this, animationName, targetMask, useGlobalSplice, skipOnAnimationEnd);
  };
  const append = proto.appendAnimations;
  proto.appendAnimations = function(target, animations) {
    if (target && typeof target === "object") animated.add(target);
    return append.call(this, target, animations);
  };
  const sceneProto = Scene.prototype;
  const stopAnimation = sceneProto.stopAnimation;
  sceneProto.stopAnimation = function(target, animationName, targetMask) {
    if (tracked.has(this) && target && typeof target === "object" && !animated.has(target)) return;
    return stopAnimation.call(this, target, animationName, targetMask);
  };
}
function trackAnimatedTargets(scene) {
  if (installed) tracked.add(scene);
}
function selectLiveCandidates(scene) {
  const list = [];
  const view = { data: list, length: 0 };
  let frame = -1;
  const original = scene.getActiveMeshCandidates;
  scene.getActiveMeshCandidates = () => {
    const f = scene.getFrameId();
    if (f !== frame) {
      frame = f;
      const all = scene.meshes;
      let n = 0;
      for (let i = 0; i < all.length; i++) {
        const m = all[i];
        const flags = m._nodeDataStorage;
        if (flags ? !flags._isEnabled || !flags._isParentEnabled : !m.isEnabled()) continue;
        if (m.layerMask === 0 && m.isWorldMatrixFrozen) continue;
        list[n++] = m;
      }
      list.length = n;
      view.length = n;
    }
    return view;
  };
  return () => {
    scene.getActiveMeshCandidates = original;
  };
}
const SETTLE_FRAMES = 120;
const FREEZE_EVERY = 60;
function freezeStaticMaterials(scene, isStatic) {
  const born = /* @__PURE__ */ new WeakMap();
  const frozen = /* @__PURE__ */ new Set();
  const added = scene.onNewMeshAddedObservable.add((m) => {
    born.set(m, scene.getFrameId());
    const mat2 = m.material;
    if (mat2 && frozen.has(mat2)) {
      mat2.unfreeze();
      frozen.delete(mat2);
    }
  });
  const tick = scene.onAfterRenderObservable.add(() => {
    const frame = scene.getFrameId();
    if (frame % FREEZE_EVERY !== 0) return;
    const ok = /* @__PURE__ */ new Map();
    for (const m of scene.meshes) {
      const mat2 = m.material;
      if (!mat2 || mat2.isFrozen) continue;
      const kind = mat2.getClassName();
      const fine = (kind === "StandardMaterial" || kind === "PBRMaterial") && isStatic(m) && frame - (born.get(m) ?? -Infinity) > SETTLE_FRAMES;
      ok.set(mat2, (ok.get(mat2) ?? true) && fine);
    }
    for (const [mat2, fine] of ok) {
      if (!fine) continue;
      mat2.freeze();
      frozen.add(mat2);
    }
  });
  return () => {
    added.remove();
    tick.remove();
    for (const m of frozen) m.unfreeze();
    frozen.clear();
  };
}
const FIT_Z = -0.08;
function fitFirstPersonArms(ch, parent) {
  const head = ch.joints.get("Head");
  head?.computeWorldMatrix(true);
  const headY = head ? head.getAbsolutePosition().y : PLAYER.eyeHeight;
  const scale = PLAYER.height / (headY + 0.2);
  ch.root.parent = parent;
  ch.root.scaling.setAll(scale);
  ch.root.position.set(0, -(headY + 0.07) * scale, FIT_Z);
}
const FP_NECK_BACK = 0.1;
const FP_NECK_DROP = 0.17;
const FP_HEAD_TIP = 0.75;
const FP_HEAD_TIP_MAX = 0.9;
const PIN_ACROSS = 1.6;
const PIN_UP = 0.08;
const FOREARM = /^(lowerarm|hand|index|middle|ring|pinky|thumb)_/;
class FirstPersonBodyRig {
  constructor(scene, ch, anim, holder) {
    this.anim = anim;
    this.holder = holder;
    this.neck = ch.joints.get("neck_01") ?? ch.joints.get("Head");
    this.headSize = 0.24;
    this.forearms = forearmMeshes(ch);
    this.headless = this.neck ? cutHead(ch, this.neck) : { hidden: [], cuts: [], shrink: true };
    for (const m of this.headless.hidden) m.setEnabled(false);
    const ball = CreateSphere(`${ch.root.name}_fpHead`, { diameter: 1, segments: 6 }, scene);
    const mat2 = new StandardMaterial(`${ch.root.name}_fpHeadMat`, scene);
    mat2.disableColorWrite = true;
    mat2.disableDepthWrite = true;
    ball.material = mat2;
    ball.isPickable = false;
    ball.scaling.set(this.headSize * 0.8, this.headSize, this.headSize * 0.9);
    this.headShadow = ball;
    anim.setFirstPerson({ place: () => this.place(), shrinkHead: this.headless.shrink });
  }
  anim;
  holder;
  /** Where the feet go this frame (world), before the neck is pinned under the eye. */
  base = new Vector3();
  /** Facing (radians, the game's yaw). */
  yaw = 0;
  /** The camera's position (world) and pitch (radians, the game's: + looks up). */
  eye = new Vector3();
  pitch = 0;
  forearms;
  /** The head taken off (cutHead): meshes not drawn while seen from inside, and the headless copies drawn instead (the ball casts the head's shadow). */
  headless;
  headShadow;
  neck;
  headSize;
  enabled = true;
  /** What is drawn of the body in place of its own meshes (the headless copies), for measuring where it is drawn. */
  get drawnMeshes() {
    return this.headless.cuts;
  }
  /** The head's stand-in for shadows. */
  get shadowMesh() {
    return this.headShadow;
  }
  /** Show it (or not: arms-only first person, third person, dead). */
  setEnabled(on) {
    if (on === this.enabled) return;
    this.enabled = on;
    for (const m of this.forearms) m.setEnabled(on);
    for (const m of this.headless.cuts) m.setEnabled(on);
    this.headShadow.setEnabled(on);
  }
  /** After the clips and the aim: move the body (a little) so the base of its neck is just behind and below the eye. */
  place() {
    const h = this.holder;
    h.position.copyFrom(this.base);
    h.rotation.y = this.yaw;
    const neck = this.neck;
    if (!neck) return;
    refreshDown(neck, h);
    const at = neck.getAbsolutePosition();
    const look = Math.max(0, Math.min(Math.PI / 2, -this.pitch));
    const tip = Math.min(FP_HEAD_TIP_MAX, Math.max(0, this.pitch) * FP_HEAD_TIP);
    const back = look > 0 ? FP_NECK_BACK * Math.cos(look) + FP_NECK_DROP * Math.sin(look) : FP_NECK_BACK * Math.cos(tip) - FP_NECK_DROP * Math.sin(tip);
    const drop = FP_NECK_DROP * Math.cos(tip) + FP_NECK_BACK * Math.sin(tip);
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const dx = clamp(this.eye.x - fx * back - at.x, -PIN_ACROSS, PIN_ACROSS);
    const dz = clamp(this.eye.z - fz * back - at.z, -PIN_ACROSS, PIN_ACROSS);
    const dy = clamp(this.eye.y - drop - at.y, -0.25, PIN_UP);
    this.headShadow.position.set(at.x + dx, at.y + dy + this.headSize * 0.7, at.z + dz);
    this.headShadow.rotation.y = this.yaw;
    h.position.set(h.position.x + dx, h.position.y + dy, h.position.z + dz);
    h.computeWorldMatrix(true);
    for (const n of h.getDescendants(false)) if (n instanceof TransformNode && !(n instanceof AbstractMesh)) n.computeWorldMatrix(true);
  }
  dispose() {
    this.anim.setFirstPerson(null);
    for (const m of this.forearms) m.dispose();
    for (const m of this.headless.cuts) m.dispose();
    for (const m of this.headless.hidden) if (!m.isDisposed()) m.setEnabled(true);
    this.headShadow.material?.dispose();
    this.headShadow.dispose();
  }
}
function fitFirstPersonBody(ch, holder) {
  ch.root.parent = holder;
  ch.root.rotation.y = 0;
  const { min, max } = ch.root.getHierarchyBoundingVectors(true);
  const h = max.y - min.y;
  if (h > 0.5) ch.root.scaling.scaleInPlace(PLAYER.height * ch.root.scaling.y / h);
}
function refreshDown(node, top) {
  const chain = [];
  for (let n = node; n; n = n.parent) {
    chain.push(n);
    if (n === top) break;
  }
  for (let i = chain.length - 1; i >= 0; i--) chain[i].computeWorldMatrix(true);
}
function boneShares(m, on) {
  const bi = m.getVerticesData(VertexBuffer.MatricesIndicesKind);
  const bw = m.getVerticesData(VertexBuffer.MatricesWeightsKind);
  if (!bi || !bw || !m.skeleton) return null;
  const bix = m.getVerticesData(VertexBuffer.MatricesIndicesExtraKind);
  const bwx = m.getVerticesData(VertexBuffer.MatricesWeightsExtraKind);
  const pick = m.skeleton.bones.map((b) => on(b.getTransformNode(), b.getTransformNode()?.name ?? b.name));
  const n = m.getTotalVertices();
  const share = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    let w = 0;
    for (let k = 0; k < 4; k++) {
      if (pick[bi[v * 4 + k]]) w += bw[v * 4 + k];
      if (bix && bwx && pick[bix[v * 4 + k]]) w += bwx[v * 4 + k];
    }
    share[v] = w;
  }
  return share;
}
function copyTriangles(m, kept, suffix) {
  const vd = VertexData.ExtractFromMesh(m, false, true);
  vd.indices = kept;
  const fm = new Mesh(`${m.name}_${suffix}`, m.getScene());
  vd.applyToMesh(fm);
  fm.parent = m.parent;
  fm.position.copyFrom(m.position);
  if (m.rotationQuaternion) fm.rotationQuaternion = m.rotationQuaternion.clone();
  else fm.rotation.copyFrom(m.rotation);
  fm.scaling.copyFrom(m.scaling);
  fm.skeleton = m.skeleton;
  fm.numBoneInfluencers = m.numBoneInfluencers;
  fm.material = m.material;
  fm.sideOrientation = m.sideOrientation;
  fm.hasVertexAlpha = m.hasVertexAlpha;
  fm.useVertexColors = m.useVertexColors;
  fm.receiveShadows = m.receiveShadows;
  fm.isPickable = false;
  fm.alwaysSelectAsActiveMesh = true;
  fm.renderingGroupId = m.renderingGroupId;
  return fm;
}
const usable = (m) => m instanceof Mesh && !m.isDisposed() && !m.isBlocked && !!m.skeleton && !m.morphTargetManager && m.getTotalVertices() > 0 && !!m.getIndices();
function forearmMeshes(ch) {
  const out = [];
  for (const m of ch.meshes) {
    if (!usable(m)) continue;
    const share = boneShares(m, (_j, name) => FOREARM.test(name));
    const indices = m.getIndices();
    if (!share) continue;
    const kept = [];
    for (let t = 0; t < indices.length; t += 3) {
      const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
      if (share[a] + share[b] + share[c] > 1.5) kept.push(a, b, c);
    }
    if (!kept.length) continue;
    const fm = copyTriangles(m, kept, "fpForearms");
    fm.renderingGroupId = 1;
    fm.metadata = { castsNoShadow: true };
    out.push(fm);
  }
  return out;
}
const HEAD_SHARE = 0.3;
const ABOVE_NECK = 0.12;
function aboveNeck(m) {
  const bones = m.skeleton?.bones ?? [];
  const find = (re) => bones.find((b) => re.test(b.getTransformNode()?.name ?? b.name));
  const neck = find(/^(neck_01|Head)$/);
  const hips = find(/^pelvis$/);
  const pos = m.getVerticesData(VertexBuffer.PositionKind);
  if (!neck || !hips || !pos) return null;
  const at = (b) => {
    const inv = b.getAbsoluteInverseBindMatrix();
    return inv.clone().invert().getTranslation();
  };
  const n0 = at(neck);
  const spine = n0.subtract(at(hips));
  const len2 = spine.length();
  if (len2 < 1e-6) return null;
  const up = spine.scale(1 / len2);
  const arms = boneShares(m, (_j, name) => /^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)_/.test(name));
  const out = new Uint8Array(pos.length / 3);
  for (let v = 0; v < out.length; v++) {
    const h = (pos[v * 3] - n0.x) * up.x + (pos[v * 3 + 1] - n0.y) * up.y + (pos[v * 3 + 2] - n0.z) * up.z;
    if (h > ABOVE_NECK * len2 && (!arms || arms[v] < 0.5)) out[v] = 1;
  }
  return out;
}
const PAD_OUT = 0.33;
const PAD_ALONG = 0.45;
function shoulderPads(m) {
  const bones = m.skeleton?.bones ?? [];
  const pos = m.getVerticesData(VertexBuffer.PositionKind);
  if (!pos) return null;
  const at = (name) => {
    const b = bones.find((x) => (x.getTransformNode()?.name ?? x.name) === name);
    return b ? b.getAbsoluteInverseBindMatrix().clone().invert().getTranslation() : null;
  };
  const sides = ["l", "r"].map((side) => {
    const a = at(`upperarm_${side}`);
    const e = at(`lowerarm_${side}`);
    const share = boneShares(m, (_j, name) => name === `upperarm_${side}` || name === `clavicle_${side}`);
    return a && e && share ? { a, axis: e.subtract(a), share } : null;
  });
  if (!sides.some((x) => x)) return null;
  const out = new Uint8Array(pos.length / 3);
  for (let v = 0; v < out.length; v++) {
    for (const sd of sides) {
      if (!sd || sd.share[v] < 0.5) continue;
      const len2 = sd.axis.lengthSquared();
      const dx = pos[v * 3] - sd.a.x;
      const dy = pos[v * 3 + 1] - sd.a.y;
      const dz = pos[v * 3 + 2] - sd.a.z;
      const t = (dx * sd.axis.x + dy * sd.axis.y + dz * sd.axis.z) / len2;
      if (t > PAD_ALONG) continue;
      const px = dx - sd.axis.x * t;
      const py = dy - sd.axis.y * t;
      const pz = dz - sd.axis.z * t;
      if (px * px + py * py + pz * pz > PAD_OUT * PAD_OUT * len2) out[v] = 1;
    }
  }
  return out;
}
function cutHead(ch, neck) {
  const onHead = /* @__PURE__ */ new Set([neck, ...neck.getDescendants(false).filter((n) => n instanceof TransformNode && !(n instanceof AbstractMesh))]);
  const hidden = [];
  const cuts = [];
  let shrink = false;
  for (const m of ch.meshes) {
    if (m.isDisposed() || m instanceof Mesh && m.isBlocked) continue;
    if (!m.skeleton) {
      if (m.parent && onHead.has(m.parent)) hidden.push(m);
      continue;
    }
    const share = usable(m) ? boneShares(m, (j) => !!j && onHead.has(j)) : null;
    if (!share) {
      shrink = true;
      continue;
    }
    const high = aboveNeck(m);
    const pads = shoulderPads(m);
    const off = (v) => share[v] >= HEAD_SHARE || !!high && high[v] === 1 || !!pads && pads[v] === 1;
    const indices = m.getIndices();
    const kept = [];
    for (let t = 0; t < indices.length; t += 3) {
      const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
      if (!off(a) && !off(b) && !off(c)) kept.push(a, b, c);
    }
    if (kept.length === indices.length) continue;
    hidden.push(m);
    if (kept.length) cuts.push(copyTriangles(m, kept, "fpBody"));
  }
  return { hidden, cuts, shrink };
}
function takeOverViewmodel(old, copy) {
  copy.parent = old.parent;
  copy.setEnabled(old.isEnabled(false));
}
const SYS = {
  /** GameView.updateAvatars: placing characters, their state machines, animation LOD, deaths. */
  avatars: 0,
  /** Babylon's clip evaluation and the after-animation aim and grip (inside render). */
  anim: 1,
  /** Skeletons' bone matrices (skinning on the CPU side, inside render). */
  skin: 2,
  /** One-shot and lasting effects (godotVfx, lastingFx), hit sparks, blood, remote muzzle flashes. */
  fx: 3,
  /** The effects physics step: ragdolls, debris, falling bodies. */
  ragdoll: 4,
  /** Prop flames (which flames are drawn this frame). */
  flames: 5,
  /** The HUD, minimap, overlay and pause menu. */
  hud: 6,
  /** Shadow maps and other render targets (the mist's depth map, reflections), inside render. */
  shadow: 7,
  /** Post-processing, inside render. */
  post: 8,
  /** The active-mesh evaluation (culling, LOD choice, world matrices), inside render, without skinning. */
  cull: 9
};
const SYS_NAMES = Object.keys(SYS);
const SYS_LABELS = {
  avatars: "tt:characters (update)",
  anim: "tt:characters (clips + aim)",
  skin: "tt:characters (skinning)",
  fx: "tt:effects",
  ragdoll: "tt:ragdolls + effects physics",
  flames: "tt:prop flames",
  hud: "tt:hud",
  shadow: "tt:render: shadow + depth maps",
  post: "tt:render: post-processing",
  cull: "tt:render: mesh evaluation"
};
const COUNT = {
  /** Characters whose clips were evaluated this frame (animation LOD skips the others). */
  animated: 0,
  /** Skeletons whose bone matrices were computed this frame. */
  skinned: 1,
  /** Ragdolls awake (moving under physics). */
  ragdolls: 2,
  /** Lasting effects drawn (fires, gas, glows). */
  lasting: 3,
  /** One-shot effects playing. */
  effects: 4,
  /** Characters let through to be built this frame (one per 16 ms; their build runs after the frame). */
  built: 5
};
const COUNT_NAMES = Object.keys(COUNT);
const perfProbe = {
  on: false,
  /** Who wants the probe on (the overlay, a match recording, a trace): it runs while anyone does. */
  users: /* @__PURE__ */ new Set(),
  use(who, on) {
    if (on) this.users.add(who);
    else this.users.delete(who);
    this.on = this.users.size > 0;
  },
  frames: [],
  /** Keep only this many frames (the performance overlay's rolling minute); 0 keeps them all (perf runs). */
  keep: 0,
  /** Accumulated since the last frame. */
  sim: 0,
  ticks: 0,
  batch: 0,
  msg: 0,
  lastFrame: 0,
  /** Start of the frame being measured, and its render time. */
  frameStart: 0,
  render: 0,
  /** This frame's per-system ms and counts so far. */
  sys: new Array(SYS_NAMES.length).fill(0),
  n: new Array(COUNT_NAMES.length).fill(0),
  /**
   * Trace capture: while set, every span is also a `performance.measure` (named SYS_LABELS, seen in a
   * Chrome DevTools Performance recording) and kept in `spans` for the JSON export.
   */
  trace: false,
  spans: [],
  /** A span of system `i` that began at `t0` (performance.now) ends now. Returns now. */
  add(i, t0) {
    const t = performance.now();
    this.sys[i] += t - t0;
    if (this.trace) this.mark(SYS_LABELS[SYS_NAMES[i]], t0, t);
    return t;
  },
  /** A traced span by name (frames, render, net): a measure in the trace only. */
  mark(name, t0, t1) {
    try {
      performance.measure(name, { start: t0, end: t1 });
    } catch {
    }
    if (this.spans.length < 4e5) this.spans.push({ name, ts: Math.round(t0 * 1e3), dur: Math.max(1, Math.round((t1 - t0) * 1e3)) });
  },
  /** The sim loop ran `ticks` ticks taking `ms` (this thread). */
  addSim(ms, ticks) {
    this.sim += ms;
    this.ticks += ticks;
    this.batch = Math.max(this.batch, ticks);
  },
  beginFrame(now) {
    this.frameStart = now;
    this.render = 0;
  },
  endFrame(end) {
    const dt = this.lastFrame ? this.frameStart - this.lastFrame : 0;
    this.lastFrame = this.frameStart;
    const total = end - this.frameStart;
    if (this.trace) {
      this.mark("tt:frame", this.frameStart, end);
      this.mark("tt:render", end - this.render, end);
    }
    if (dt > 0) {
      const f = { dt, sim: this.sim, ticks: this.ticks, batch: this.batch, msg: this.msg, js: Math.max(0, total - this.render), render: this.render, sys: this.sys.slice(), n: this.n.slice() };
      this.frames.push(f);
      this.last = f;
    }
    if (this.keep && this.frames.length > this.keep + 600) this.frames.splice(0, this.frames.length - this.keep);
    this.sim = this.ticks = this.batch = this.msg = 0;
    this.sys.fill(0);
    this.n.fill(0);
  },
  /** The frame just finished (the match recording reads it). */
  last: null,
  reset() {
    this.frames = [];
    this.sim = this.ticks = this.batch = this.msg = 0;
    this.sys.fill(0);
    this.n.fill(0);
    this.lastFrame = 0;
  }
};
globalThis.__perf = perfProbe;
const DEBRIS_LIFE = 6;
const SHAKE_MS = 650;
const TURRET_TURN = 2.5;
const REMOTE_FLASH_RANGE = 45;
const ZAP_LENGTH = 6;
const ZAP_TUBES = ["Zap", "ZapExtra"];
const ZAP_PARTS = ["Zap", "ZapExtra", "ZapSphere", "ZapGlow"];
const MAX_REMOTE_RIGS = 8;
const OWN_FLASH_SCALE = 1.6;
const OWN_FLASH_AHEAD = 0.05;
const THROWN_KINDS = new Map(Object.values(THROWABLE_DEFS).flatMap((t) => t.view && !t.view.handOnly && t.kind !== "mine" ? [[t.projectile.visual, t.kind]] : []));
const THROW_HOLD = { style: "pistol", grip: [0, -0.012, -0.012], support: [-0.03, -0.022, 0], rake: 0 };
const THROW_HOLD_AT = [0.14, -0.16, 0.34];
const SPEAR_TIP_AHEAD = 0.52;
const SLOT_COLORS = ["#e6544a", "#4aa3e6", "#f2c14e", "#5cc77a", "#b276e0", "#f28f3b", "#46c9c0", "#e872b0"];
const slotColor = (slot) => SLOT_COLORS[slot % SLOT_COLORS.length];
const DEFAULT_FOV = 1.35;
const CALM_MOMENT = { scale: 0.8, gain: 0.55 };
const SHIELD_SHIMMER = 0.32;
const SHIELD_GLOW = new Color3(0.35, 0.7, 1);
const SHIELD_GLOW_PEAK = 0.08;
const EMERGE_MS = 650;
const EMERGE_DEPTH = 1.7;
const BODIES_PREF_KEY = "cs.bodies";
function bodiesPreference() {
  try {
    return localStorage.getItem(BODIES_PREF_KEY) === "fade" ? "fade" : "stay";
  } catch {
    return "stay";
  }
}
const MAX_CORPSES = 32;
const MAX_CORPSES_KEPT = 96;
const DEATH_START_MS = 4;
const PUSH_KEEP_MS = 1200;
const PUSH_KEEP_FRAMES = 3;
const isEnemyTag = (color2) => color2.toLowerCase() === "#ff3b3b";
const SMOKE_FOG = new Color3(0.42, 0.44, 0.46);
const SMOKE_FOG_DENSITY = 0.42;
function setGlow(mat2, color2) {
  if (!mat2.emissiveColor.equals(color2)) mat2.emissiveColor = color2;
}
const facingOf = (a) => ({ x: Math.sin(a.root.rotation.y), y: 0, z: Math.cos(a.root.rotation.y) });
const BODY_POOL_PER_LOOK = 2;
const BODY_POOL_TOTAL = 16;
const RETIRE_MS = 1.5;
const BUILD_CATCH_UP_MS = 250;
const RAGDOLL_PREWARM_BODIES = 12;
const ANIM_LOD_CROWD = 24;
const CROWD_SHADOW_REACH = 30;
const SHADOW_CHARACTERS = 12;
const SHADOW_ALWAYS = 10;
const CULL_RADIUS = 2.5;
function inView(planes, x, y, z, r) {
  for (const p of planes) if (p.normal.x * x + p.normal.y * y + p.normal.z * z + p.d < -r) return false;
  return true;
}
const CORPSE_STAY = 30;
const CORPSE_SINK = 3;
const MODEL_YAW = 0;
function fitCharacter(ch) {
  ch.root.rotation.y = MODEL_YAW;
  const { min, max } = ch.root.getHierarchyBoundingVectors(true);
  const h = max.y - min.y;
  if (h > 0.5) ch.root.scaling.scaleInPlace(PLAYER.height * ch.root.scaling.y / h);
}
class GameView {
  scene;
  /** Draw every body's hit shapes over it (Options → Display → Show hitboxes, a dev and test setting). */
  showHitboxes = false;
  camera;
  models;
  /** City facades and building/street tile models. */
  city;
  skyEffects;
  /** The match's weather (map format v34; weatherVisuals.ts): set by the session once it knows the rules (setWeather). */
  weather;
  /** The sky the map was built under and the low ground its fog banks lie on (for setWeather). */
  weatherSky = null;
  weatherGround = 0;
  scenario;
  characters;
  creatures;
  avatars = /* @__PURE__ */ new Map();
  /** More remote players than ANIM_LOD_CROWD (the last updateAvatars): big-match savings apply. */
  crowd = false;
  /** updateAvatars calls so far: the animation LOD's frame count (animLod.ts). */
  avatarFrame = 0;
  pickups = /* @__PURE__ */ new Map();
  /** When pickups were last updated (ms; their glows ease by the time since). */
  pickupsAt = 0;
  /** Weapons the fallen dropped (snapshot `dw`), by drop ID: drawn lying where they fell. */
  drops = /* @__PURE__ */ new Map();
  projectiles = /* @__PURE__ */ new Map();
  /** Placed props by entity index (breakable ones disappear when broken). */
  props = /* @__PURE__ */ new Map();
  effects = [];
  /** Binbun's hit and explosion effects (godotVfx.ts), once their packs are in. */
  vfx;
  /** Lightning with flashing reduced: a steady beam per source instead of crackling bolts (steadyArcs.ts). */
  steadyArcs;
  /** Pack effects that last while something burns or glows (fires, flares), the nearest drawn first. */
  lasting;
  /** Pack auras round other characters with a status (statusFx.ts). */
  statusFx;
  /** Fire props' open flames (content/props.json `flame`), drawn with Flame FX near the camera. */
  propFlames;
  /** Each placement's surface (stone, metal, wood …) for where rounds land (fxMap.ts), made with the map. */
  surfaces = null;
  sunLight;
  zoneVisuals;
  viewRoot;
  foliage;
  /** The environment renderer (environment/environmentVisuals.ts; off with ?env=0): made with the first map that has species. */
  environment = null;
  viewmodel;
  viewWeapon;
  /** Your own character's arms in first person, gripping the viewmodel. */
  fpArms;
  /** Your own look (setLocalLook): its arms are built when first person needs them. */
  localLook;
  /** First person: your whole character from its eyes, or arms only (Options → Display). */
  fpMode = loadFirstPersonMode();
  /** Full-body first person: your own avatar seen from its eyes, while it is (firstPersonBody.ts). */
  fpBody;
  /** The camera is your own eyes this frame (not a vehicle's view, the kill cam or a spectator's): set by the session. */
  firstPersonEye = false;
  /** The gun is hidden this frame (scoped, third person, dead): the full body is too. */
  viewHidden = true;
  /** The camera before any shake (the full body stands under the steady eye). */
  steadyEye = { pos: new Vector3(), yaw: 0, pitch: 0 };
  viewLoad = 0;
  /** First-person guns built so far, by weapon ID, with their measurements (see setViewmodel). */
  viewmodels = /* @__PURE__ */ new Map();
  /** Front of the loaded viewmodel along its forward axis, for the muzzle flash. */
  muzzleZ = 0.2;
  /** Barrel height of the loaded viewmodel (the same estimate as remote guns: the bounds include the grip). */
  muzzleY = 0.02;
  kickAmount = 0;
  /** The last kick was a melee weapon's barrel going off (a gun's recoil, heavier), not a swing. */
  kickShot = false;
  /** Smoke clouds from your own shots so far (tests). */
  smokeClouds = { local: 0, remote: 0 };
  bobPhase = 0;
  /** Weapon bob strength (0..1), eased so starting or stopping doesn't pop the gun. */
  bobAmount = 0;
  flash;
  flashUntil = 0;
  /** Your gun's flash from the pack (muzzleFlash.ts); the star `flash` stays for the railgun and until the pack has loaded. */
  flashRig;
  /** Remote players' flash rigs alive (at most MAX_REMOTE_RIGS). */
  remoteRigs = 0;
  starFlash = false;
  /** The ambient light (its colour tints the effects). Shots no longer brighten it: that lit every wall on the map, indoors and out. */
  hemi;
  /** Shadows, tone mapping and post effects (Options → Graphics). */
  atmosphere;
  brass;
  /** The map's static props, batched (buildMap; null with `?perfoff=propbatch`). */
  propBatches = null;
  /** The level's draw merge in progress (buildMap), and its outcome: draws before and after (null: not merged). */
  levelMerge = null;
  /** Level meshes before and after the merge, and the per-style meshes merged (by name; tests). */
  levelDraws = null;
  constructor(engine) {
    installAnimationPatches();
    this.scene = new Scene(engine);
    trackAnimatedTargets(this.scene);
    if (perfOn("meshsel")) {
      selectLiveCandidates(this.scene);
      freezeStaticMaterials(this.scene, (m) => {
        if (!m.isWorldMatrixFrozen || m.skeleton) return false;
        let root = m;
        while (root.parent) root = root.parent;
        return /^(map_|prop_|static_)/.test(root.name);
      });
    }
    this.scene.clearColor = new Color4(0.52, 0.62, 0.72, 1);
    this.scene.skipPointerMovePicking = true;
    this.camera = createViewCamera("camera", this.scene);
    this.camera.minZ = 0.1;
    this.camera.maxZ = 4e3;
    this.camera.fov = DEFAULT_FOV;
    this.camera.inputs.clear();
    this.models = new ModelLibrary(this.scene);
    this.city = new CityVisuals(this.models);
    this.scenario = new ScenarioVisuals(this.scene);
    this.zoneVisuals = new ZoneVisuals(this.scene);
    this.characters = new CharacterLibrary(this.scene, { atlas: true });
    const turns = [];
    let lastTurn = performance.now();
    this.characters.turn = () => new Promise((go) => turns.push(go));
    this.scene.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      const dt = now - lastTurn;
      for (let n = dt < BUILD_CATCH_UP_MS ? 1 : Math.floor(dt / 16); n > 0 && turns.length; n--) {
        turns.shift()();
        if (perfProbe.on) perfProbe.n[COUNT.built]++;
      }
      lastTurn = now;
    });
    this.creatures = new CreatureLibrary(this.scene);
    this.foliage = new FoliageVisuals(this.scene, this.models);
    this.blood = new BloodVisuals(this.scene, () => this.physics);
    this.impacts = new ImpactVisuals(this.scene, () => this.physics);
    this.throwArc = new ThrowArc(this.scene);
    this.blood.enabled = bloodPreference();
    const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.1), this.scene);
    hemi.intensity = 0.8;
    hemi.groundColor = new Color3(0.35, 0.33, 0.3);
    this.hemi = hemi;
    const sun = new DirectionalLight("sun", new Vector3(-0.4, -1, 0.3), this.scene);
    this.sunLight = sun;
    sun.intensity = 0.6;
    this.viewRoot = new TransformNode("viewRoot", this.scene);
    this.viewRoot.parent = this.camera;
    this.atmosphere = new Atmosphere(this.scene, this.camera, sun, this.viewRoot);
    this.skyEffects = new SkyEffects(this.scene, this.camera, this.atmosphere.quality);
    this.weather = new WeatherVisuals(this.scene, this.atmosphere.quality, (at) => !!this.physics?.raycast({ x: at.x, y: at.y + 0.2, z: at.z }, { x: 0, y: 1, z: 0 }, 40));
    this.flash = createStarFlash(this.scene, "muzzleFlash", 0.32);
    this.flash.renderingGroupId = 1;
    this.flash.billboardMode = Mesh.BILLBOARDMODE_NONE;
    void loadMuzzleFlashes();
    Object.defineProperty(window, "__flashHold", { configurable: true, set: (v) => MuzzleFlashRig.hold = v, get: () => MuzzleFlashRig.hold });
    this.vfx = new GodotVfx(this.scene);
    this.steadyArcs = new SteadyArcs(this.scene);
    this.vfx.quality = this.atmosphere.quality;
    this.lasting = new LastingFx(this.vfx);
    this.statusFx = new StatusFx(this.lasting);
    this.propFlames = new PropFlames(this.lasting, this.atmosphere.quality !== "low");
    this.zoneVisuals.lasting = this.lasting;
    this.scenario.lasting = this.lasting;
    void GodotVfx.preload(...mappedPacks());
    this.flashRig = new MuzzleFlashRig(this.scene, "muzzleFlashRig", { renderingGroupId: 1 });
    this.flashRig.root.parent = this.viewRoot;
    this.brass = new StandardMaterial("brassMat", this.scene);
    this.brass.diffuseColor = new Color3(0.78, 0.6, 0.22);
    this.brass.specularColor = new Color3(0.9, 0.8, 0.5);
    instrumentRender(this.scene);
    Effect.PersistentMode = true;
  }
  /** A free camera made the active one, for map screenshots (tools/content/capture-map-shots.mjs). */
  photoCamera() {
    const cam = new FreeCamera("photo", this.camera.globalPosition.clone(), this.scene);
    cam.minZ = 0.1;
    cam.maxZ = 2e3;
    this.scene.activeCameras = [cam];
    this.scene.activeCamera = cam;
    return cam;
  }
  buildMap(doc, boxes) {
    this.ziplines = mapZiplines(doc.entities);
    const styler = new MapStyler(this.scene);
    styler.terrainDrawStep = loadGraphicsQuality() === "low" ? 2 : 1;
    styler.terrainBlend = loadGraphicsQuality() !== "low";
    styler.build(doc, boxes);
    const engine = this.scene.getEngine();
    if (perfOn("levelmerge") && !engine.isWebGPU && (engine.webGLVersion ?? 1) >= 2) {
      this.levelMerge = styler.merge("map", levelMipBias(window.devicePixelRatio || 1, renderRatio(loadRenderScale()))).catch((e) => {
        console.warn("level merge skipped:", e);
        return null;
      });
      void this.levelMerge.then((r) => this.levelDraws = r);
    }
    buildRoadMeshes(this.scene, doc, styler);
    mergePathMeshes(buildPathMeshes(this.scene, doc, doc.terrain, styler));
    const backdropVisuals = new BackdropVisuals(this.scene, styler, this.models);
    const backdrop = backdropVisuals.build(doc, boxes);
    if (backdropVisuals.sky) this.skyEffects.apply(doc, backdrop, backdropVisuals.sky);
    this.weatherSky = backdropVisuals.sky;
    const t = doc.terrain;
    this.weatherGround = t ? t.baseY + [...t.heights].sort((a, b) => a - b)[Math.floor(t.heights.length * 0.2)] / 100 : 0;
    this.border?.dispose();
    this.border = new BorderVisuals(this.scene, styler, this.models);
    this.border.update(doc, boxes);
    this.city.setMap(doc);
    this.liquids = mapLiquids(doc.entities);
    this.surfaces = surfaceIndex(doc);
    this.physics?.free();
    try {
      this.physics = new EffectsWorld(boxes, mapTerrainMesh(doc), environmentShapes(doc));
      this.physics.prewarm(RAGDOLL_PREWARM, RAGDOLL_PREWARM_BODIES);
    } catch {
      this.physics = null;
    }
    const blood = doc.blood ?? DEFAULT_BLOOD;
    this.blood.setLook(blood.color, blood.amount);
    this.scenario.surface = (m, t2) => styler.surfaceMaterial(doc, m, t2);
    this.scenario.liquids.levelBoxes = boxes;
    void this.foliage.grow(doc.terrain, boxes, doc.metadata.id, this.liquids.filter((l) => l.liquid === "water" || l.liquid === "swamp"));
    {
      const pickups = doc.entities.filter((e) => e.kind === "pickup" && !isAmmoBoxPickup(e));
      const solid2 = pickups.length ? [...boxes, ...blockBoxes(doc), ...propBoxes(doc)] : [];
      for (const e of pickups) this.addPickup(e, e.item, pickupRoom(e.position, solid2));
    }
    const carried = new Set(doc.entities.flatMap((e) => e.kind === "mover" ? e.props ?? [] : []));
    const env = envBatchedOn() ? doc.entities.filter((e) => e.kind === "prop" && !carried.has(e.id) && EnvironmentVisuals.draws(e) && !isBreakableProp(e)) : [];
    if (env.length) {
      this.environment ??= new EnvironmentVisuals(this.scene, loadGraphicsQuality());
      void this.environment.setPlacements(env, doc.terrain);
    }
    const drawnAsEnv = new Set(env.map((e) => e.id));
    const flush = propFlushLifts(doc, PROP_CONTACTS, boxes);
    this.propBatches?.dispose();
    this.propBatches = perfOn("propbatch") ? new PropBatches(this.scene, (path) => this.models.staticSources(path), SMALL_CASTER_REACH) : null;
    const batches = this.propBatches;
    const copies = /* @__PURE__ */ new Map();
    const modelKey = (e) => `${e.model}|${e.variant ?? ""}`;
    for (const e of doc.entities) if (e.kind === "prop" && !drawnAsEnv.has(e.id) && !carried.has(e.id)) copies.set(modelKey(e), (copies.get(modelKey(e)) ?? 0) + 1);
    const indoor = perfOn("indoorshadow") ? indoorProps(doc, boxes) : () => false;
    doc.entities.forEach((e, i) => {
      if (e.kind !== "prop" || drawnAsEnv.has(e.id)) return;
      const batch = batches && (copies.get(modelKey(e)) ?? 0) >= PROP_BATCH_MIN && !isBreakableProp(e, !!doc.metadata.destruction) ? batches : null;
      const node = createPropNode(this.scene, this.models, e, `prop_${e.id}`, !carried.has(e.id), true, doc.terrain, batch, !carried.has(e.id) && indoor(e));
      if (!carried.has(e.id)) node.position.y += hungPropLift(boxes, e);
      const lift = flush.get(e.id);
      if (lift) node.position.addInPlaceFromFloats(lift[0], lift[1], lift[2]);
      this.props.set(i, node);
      const flame = getProp(e.model)?.flame;
      if (flame) this.propFlames.add(e.id, node, flame, e.scale, carried.has(e.id));
    });
    this.scenario.build(doc.entities, doc);
    this.entrances = doc.entities.filter((e) => e.kind === "encounter" && (e.entrance ?? "none") !== "none");
    for (const w of WEAPONS_BY_SLOT) void this.models.load(w.view.model);
    void this.models.load("projectiles/grenade.glb");
    void loadMuzzleFlashes().then(() => {
      if (this.scene.isDisposed) return;
      const ids = new Set(WEAPONS_BY_SLOT.map((w) => muzzleEffectFor(w)?.id).filter((id) => !!id));
      MuzzleFlashRig.warm(this.scene, [...ids]);
    });
    this.blood.warm();
    this.impacts.warm();
    void GodotVfx.preload(...mappedPacks()).then(() => {
      if (this.scene.isDisposed) return;
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
  async prewarm(specs, guns = [], veiled = () => false, filesIn = () => {
  }) {
    const t0 = performance.now();
    if (this.levelMerge) await Promise.race([this.levelMerge, new Promise((r) => setTimeout(r, 15e3))]);
    if (this.propBatches) {
      await Promise.race([this.propBatches.settled(), new Promise((r) => setTimeout(r, 15e3))]);
      await this.afterFrames(2, 1500);
    }
    const ready = () => this.scene.isDisposed ? Promise.resolve() : Promise.race([this.scene.whenReadyAsync(), new Promise((r) => setTimeout(r, 8e3))]);
    this.scenario.liquids.fx.warm(4e3);
    const stage = new TransformNode("prewarm", this.scene);
    stage.position.set(0, -1e4, 0);
    const place2 = this.scene.onBeforeRenderObservable.add(() => {
      const cam = this.scene.activeCamera;
      if (!cam || !veiled()) return void stage.position.set(0, -1e4, 0);
      const f = cam.getDirection(Vector3.Forward());
      const flat = Math.hypot(f.x, f.z) || 1;
      const c = cam.globalPosition;
      stage.position.set(c.x + f.x / flat * 7, c.y - 1.6, c.z + f.z / flat * 7);
      stage.rotation.y = Math.atan2(f.x, f.z) + Math.PI;
    });
    const spot = (n, i, row) => n.position.set((i % 8 - 3.5) * 0.9, 0, row + Math.floor(i / 8) * 1.2);
    const gunCopies = guns.flatMap((path, i) => [
      ...[true, false].map(
        (instanced, k) => (
          // As a crowd's hands and the pickups hold them (merged instances), and as a copy of its own.
          (instanced ? this.models.instantiateWhole(path, `prewarm_gun_${i}_${k}`) : this.models.instantiate(path, `prewarm_gun_${i}_${k}`)).then(
            (node) => {
              if (stage.isDisposed()) return void node.dispose();
              node.parent = stage;
              spot(node, i * 2 + k, 4.5);
              node.position.y = 1.2;
              return node;
            },
            () => void 0
          )
        )
      ),
      // And as your own first-person gun: under the view root, drawn over the world and catching no shadows (another
      // program than a copy in the world; the first gun of a kind in your hands built its own mid-match).
      this.models.instantiate(path, `prewarm_gun_${i}_view`).then(
        (node) => {
          if (stage.isDisposed()) return void node.dispose();
          node.parent = this.viewRoot;
          node.position.set(0, -1e4, 0);
          for (const m of node.getChildMeshes()) m.renderingGroupId = 1;
          return node;
        },
        () => void 0
      )
    ]);
    const tracer = CreateLines("prewarm_tracer", { points: [new Vector3(0, 1, 0), new Vector3(0, 1.5, 3)] }, this.scene);
    tracer.color = Color3.White();
    tracer.isPickable = false;
    tracer.parent = stage;
    const canopies = [CHUTE_PARACHUTE, CHUTE_GLIDER].map((kind, i) => {
      const node = createCanopy(this.scene, `prewarm_canopy_${kind}`, kind);
      node.parent = stage;
      node.position.set((i - 0.5) * 6, 0, 9);
      return { node, kind };
    });
    const making = Promise.all(
      specs.slice(0, 32).map(
        (spec, i) => this.characters.create(spec, `prewarm_${i}`).then(
          (ch) => {
            if (stage.isDisposed()) return void ch.dispose();
            ch.root.parent = stage;
            spot(ch.root, i, 0);
            for (const g of ch.clips.values()) g.stop();
            return ch;
          },
          () => void 0
        )
      )
    );
    let effects = 0;
    try {
      await GodotVfx.preload(...mappedPacks());
      const ends = [];
      for (const r of mappedEffects()) {
        const end = this.vfx.warm(r.pack, r.effect, true);
        if (end) ends.push(end);
      }
      effects = ends.length;
      await this.afterFrames(4, 2500);
      await ready();
      for (const end of ends) end();
    } catch {
    }
    if (this.scene.isDisposed) return 0;
    const [made, held] = await Promise.all([making, Promise.all(gunCopies)]);
    if (this.auraWarm)
      for (const [i, ch] of made.entries()) {
        if (!ch || i > 3) continue;
        for (const m of ch.root.getChildMeshes()) {
          m.renderOutline = i % 2 === 0;
          m.renderOverlay = i % 2 === 1 || i === 2;
        }
      }
    filesIn();
    if (this.scene.isDisposed) return 0;
    for (const m of [...stage.getChildMeshes(), ...held.flatMap((g) => g?.getChildMeshes() ?? [])]) m.alwaysSelectAsActiveMesh = true;
    await this.afterFrames(3, 2e3);
    await ready();
    place2.remove();
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
  prewarmed = null;
  /** After `n` rendered frames (or `ms` at most: a hidden tab renders none). */
  afterFrames(n, ms) {
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
  border = null;
  /** Client-only physics for ragdolls, debris and blood (built with the map). */
  physics = null;
  blood;
  /** How hard each recently hit player was pushed (shots and blasts), for the ragdoll's throw. */
  pushes = /* @__PURE__ */ new Map();
  lastFrame = performance.now();
  debrisBodies = [];
  impacts;
  /** Squads that come in through a vent, hatch, burrow or breach (their NPCs get an entrance). */
  entrances = [];
  throwArc;
  corpses = [];
  /** Players whose body is lying as a corpse and who haven't respawned yet. */
  lyingDead = /* @__PURE__ */ new Set();
  bodies = bodiesPreference();
  /** Bodies stay where they fall whatever the Bodies setting, and more of them (owner, 2026-11-11: Zombies' dead remain). The session sets it by mode. */
  keepBodies = false;
  /** Remember a push on a player (from a hit or a blast) so their ragdoll flies the right way if it kills them. */
  pushPlayer(slot, v, max = 3.5) {
    const now = performance.now();
    const old = this.pushes.get(slot);
    const keep = old && now - old.t < 250 ? old.v : { x: 0, y: 0, z: 0 };
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
  flinchPlayer(slot, dir, zone, strength) {
    const a = this.avatars.get(slot);
    const anim = a?.anim;
    if (!a || !(anim instanceof CharacterAnimator)) return;
    const k = Math.min(1, strength / 2);
    anim.flinch(zone, dir, 0.35 + 0.65 * k);
    const eye = this.scene.activeCamera?.globalPosition;
    const near = !eye || Math.hypot(a.root.position.x - eye.x, a.root.position.z - eye.z) <= SHOT_OVERLAY_REACH;
    if (strength >= 1.6 && near) anim.trigger(zone === 1 ? "hit_head" : "hit");
  }
  cameraPosition() {
    const p = this.camera.position;
    return { x: p.x, y: p.y, z: p.z };
  }
  /**
   * A blast throws anyone near it, so the ones it kills fly up and away from
   * it with its force (shaped like the game's own throw, sim/impact.ts
   * blastThrow: out, and up harder from below).
   */
  blast(at, radius) {
    const force = Math.min(16, 6 + radius * 1.4);
    for (const [slot, a] of this.avatars) {
      const d = { x: a.root.position.x - at.x, y: a.root.position.y + 1 - at.y, z: a.root.position.z - at.z };
      const dist = Math.hypot(d.x, d.y, d.z);
      if (dist > radius * 1.5) continue;
      const speed = force * (1 - 0.6 * (dist / (radius * 1.5)));
      const flat = Math.hypot(d.x, d.z) || 1;
      const out = speed * 0.85;
      const up = speed * Math.max(0.5, 0.9 + 0.35 * (d.y / Math.max(0.3, dist)));
      this.pushPlayer(slot, { x: d.x / flat * out, y: up, z: d.z / flat * out }, force);
    }
  }
  /** Where a player's chest is drawn (for blood on kills). */
  chestOf(slot) {
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
  startRagdoll(slot, a, planes) {
    const root = a.anim?.skeletonRoot;
    if (!(a.anim instanceof CharacterAnimator) || !root || !this.physics) return;
    const push = this.pushes.get(slot);
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
    const fov = this.scene.activeCamera?.fov ?? DEFAULT_FOV;
    const fit = fitBudget(tierFor(dist, seen, screenShare(dist, fov)), dist, moving.map((m) => ({ tier: m.body.tier, dist: m.dist })));
    for (const i of fit.drop) this.dropTier(moving[i].a);
    this.ragdollTiers[fit.tier]++;
    this.lastDeath = { slot, tier: fit.tier, dist: Math.round(dist * 10) / 10, seen };
    try {
      if (fit.tier === "posed") this.layDown(a, v);
      else {
        a.anim.ragdoll(fit.tier === "cheap" ? "limp" : "stop");
        a.ragdoll = new Ragdoll(this.physics, a.anim.ch.joints, root, v, fit.tier, facingOf(a));
      }
    } catch {
      a.ragdoll = void 0;
    }
  }
  /** The fresh deaths that may start their bodies this frame: the nearest RAGDOLL_BUDGET.startsPerFrame. */
  deathsToStart(poses, eye) {
    const fresh = [];
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
  lastDeath = null;
  /** The push (m/s) each player's last body started with (tests: a blast's dead fly with it). */
  deathPush = /* @__PURE__ */ new Map();
  /** Deaths so far by the tier they got (tests and the perf check read these). */
  ragdollTiers = { full: 0, cheap: 0, posed: 0 };
  /** Ragdolls still simulating, with their distance from the camera. */
  movingRagdolls() {
    const cam = this.scene.activeCamera?.globalPosition;
    const out = [];
    const add2 = (a) => {
      const r = a.ragdoll;
      if (!(r instanceof Ragdoll) || r.frozen) return;
      const p = a.root.position;
      out.push({ a, body: r, dist: cam ? Math.hypot(p.x - cam.x, p.y - cam.y, p.z - cam.z) : 0 });
    };
    for (const a of this.avatars.values()) add2(a);
    for (const c of this.corpses) add2(c.a);
    return out;
  }
  /**
   * The nearest dead body along a ray whose ragdoll has come to rest (frozen), tested against a sphere at
   * its pelvis and one at its chest (it lies on the ground, so these cover most of it).
   */
  restingBodyOnRay(from, dir, len2) {
    let best = null;
    const test = (a) => {
      const r = a.ragdoll;
      if (!(r instanceof Ragdoll) || !r.frozen || !(a.anim instanceof CharacterAnimator)) return;
      for (const name of ["pelvis", "spine_02"]) {
        const j = a.anim.ch.joints.get(name);
        if (!j) continue;
        const c = j.getAbsolutePosition();
        const t = (c.x - from.x) * dir.x + (c.y - from.y) * dir.y + (c.z - from.z) * dir.z;
        if (t < 0 || t > len2 + 0.4) continue;
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
  rewake(a, push) {
    const root = a.anim?.skeletonRoot;
    if (!(a.anim instanceof CharacterAnimator) || !root || !this.physics) return false;
    const p = a.root.position;
    const cam = this.scene.activeCamera?.globalPosition;
    const dist = cam ? Math.hypot(p.x - cam.x, p.y - cam.y, p.z - cam.z) : 0;
    const moving = this.movingRagdolls();
    const fit = fitBudget(tierFor(dist, true), dist, moving.map((m) => ({ tier: m.body.tier, dist: m.dist })));
    if (fit.tier === "posed") return false;
    for (const i of fit.drop) this.dropTier(moving[i].a);
    try {
      a.ragdoll?.dispose();
      a.anim.thawPose();
      a.anim.ragdoll(fit.tier === "cheap" ? "limp" : "stop");
      a.ragdoll = new Ragdoll(this.physics, a.anim.ch.joints, root, push, fit.tier, facingOf(a));
      return true;
    } catch {
      return false;
    }
  }
  /** Past the budget: a full ragdoll carries on as a cheap one (same motion); a cheap one freezes where it is. */
  dropTier(a) {
    const r = a.ragdoll;
    const root = a.anim?.skeletonRoot;
    if (!(r instanceof Ragdoll) || !(a.anim instanceof CharacterAnimator)) return;
    if (r.tier === "cheap" || !root || !this.physics) {
      r.freeze();
      a.anim.freezePose();
      return;
    }
    const v = r.velocity;
    r.dispose();
    a.anim.ragdoll("limp");
    a.ragdoll = new Ragdoll(this.physics, a.anim.ch.joints, root, v, "cheap", facingOf(a));
  }
  /** Out of view: no simulation; the body lies on the ground along the hit, in the death's final pose. */
  layDown(a, v) {
    const anim = a.anim;
    const p = a.root.position;
    const hit = this.physics?.raycast({ x: p.x, y: p.y + 1, z: p.z }, { x: 0, y: -1, z: 0 }, 60);
    if (hit) p.y = p.y + 1 - hit.dist;
    if (Math.hypot(v.x, v.z) > 0.3) a.root.rotation.y = Math.atan2(-v.x, -v.z);
    a.root.rotation.x = 0;
    anim.lieDown();
    a.ragdoll = new PosedBody();
  }
  /** Dead bodies now: by tier, frozen, and physics bodies awake (the perf check reads these). */
  ragdollStats() {
    const out = { full: 0, cheap: 0, posed: 0, frozen: 0, awakeBodies: 0, pooled: this.physics?.pooledOut ?? 0, deaths: { ...this.ragdollTiers } };
    const add2 = (a) => {
      const r = a.ragdoll;
      if (!r) return;
      out[r.tier]++;
      if (r.frozen) out.frozen++;
      out.awakeBodies += r.bodies;
    };
    for (const a of this.avatars.values()) add2(a);
    for (const c of this.corpses) add2(c.a);
    return out;
  }
  /** Where a body that died without a ragdoll comes to rest: the first solid thing below it. */
  startFall(x, y, z) {
    const hit = this.physics?.raycast({ x, y: y + 0.3, z }, { x: 0, y: -1, z: 0 }, 200);
    return { y, vy: 0, ground: hit ? y + 0.3 - hit.dist : y };
  }
  stepFall(a, dt) {
    const f = a.fall;
    if (f.y <= f.ground) return;
    f.vy -= PLAYER.gravity * dt;
    f.y = Math.max(f.ground, f.y + f.vy * dt);
    a.root.position.y = f.y;
  }
  /** The fallen body becomes a corpse that outlives the player's respawn. */
  toCorpse(slot, a) {
    this.avatars.delete(slot);
    this.atmosphere.shadowless.delete(a.root);
    this.lyingDead.add(slot);
    a.tag?.node.dispose(false, a.tag.node instanceof Mesh);
    a.tag = void 0;
    a.aura?.setEnabled(false);
    a.jet?.setEnabled(false);
    a.trolley?.setEnabled(false);
    a.crown?.setEnabled(false);
    a.hitbox?.hide();
    this.dropCanopy(a);
    a.flash?.setEnabled(false);
    a.flashRig?.hide();
    this.corpses.push({ a, slot, born: performance.now() });
    while (this.corpses.length > (this.keepBodies ? MAX_CORPSES_KEPT : MAX_CORPSES)) this.retireAvatar(this.corpses.shift().a);
  }
  /** Ray test against the level's static shapes (null before the map is built). */
  raycastLevel(from, dir, maxDist) {
    return this.physics?.raycast(from, dir, maxDist) ?? null;
  }
  /** Bodies currently lying in the level (for tests). */
  corpseCount() {
    return this.corpses.length;
  }
  /** Remove every body (a new round). */
  clearCorpses() {
    for (const c of this.corpses) this.retireAvatar(c.a);
    this.corpses = [];
    this.lyingDead.clear();
  }
  // ---------------------------------------------------------------- shots
  /** World position of your own gun's muzzle (the viewmodel), or null while it isn't shown. */
  localMuzzle() {
    if (!this.viewmodel || !this.viewRoot.isEnabled(false)) return null;
    this.viewRoot.computeWorldMatrix(true);
    const p = Vector3.TransformCoordinates(new Vector3(0, this.muzzleY, this.muzzleZ + 0.02), this.viewRoot.getWorldMatrix());
    return { x: p.x, y: p.y, z: p.z };
  }
  /** World position of a remote player's muzzle, or null when their gun isn't drawn. */
  muzzleOf(slot) {
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
  shotVisual(o) {
    if (o.def?.view.beam) {
      if (reduceFlashing() && o.def.fireIntervalTicks <= 15) this.steadyArcs.hit(`beam:${o.local ? "me" : o.slot ?? "other"}`, [o.muzzle ?? o.eye, o.to], o.def.view.tracer);
      else this.addShot(o.def, o.muzzle ?? o.eye, o.to, o.color);
      this.landRound(o);
      return;
    }
    this.impacts.fire(o.muzzle ?? { x: o.eye.x, y: o.eye.y - 0.1, z: o.eye.z }, o.to, o.color, o.land === false ? void 0 : () => this.landRound(o), o.local ? 1.5 : 0, { ...o.speed ? { speed: o.speed } : {}, ...o.tracer === false ? { tracer: false } : {} });
  }
  /** What happens where a round lands (see shotVisual). */
  landRound(o) {
    const d = { x: o.to.x - o.eye.x, y: o.to.y - o.eye.y, z: o.to.z - o.eye.z };
    const len2 = Math.hypot(d.x, d.y, d.z) || 1;
    const dir = { x: d.x / len2, y: d.y / len2, z: d.z / len2 };
    const hit = this.physics?.raycastRagdoll(o.eye, dir, len2);
    const owner = hit ? this.movingRagdolls().find((m) => m.body.owns(hit.body)) : void 0;
    const body = owner ? hit : null;
    if (body) {
      const at = { x: o.eye.x + dir.x * body.dist, y: o.eye.y + dir.y * body.dist, z: o.eye.z + dir.z * body.dist };
      body.body.applyImpulseAtPoint({ x: dir.x * 4 * o.strength, y: dir.y * 4 * o.strength + 0.4, z: dir.z * 4 * o.strength }, at, true);
      this.blood.hit(at, dir, o.strength);
      owner?.body.kick();
    } else {
      const rest = this.restingBodyOnRay(o.eye, dir, len2);
      if (rest) {
        const push = { x: dir.x * 2.5 * o.strength, y: 0.6 + dir.y * 2.5 * o.strength, z: dir.z * 2.5 * o.strength };
        if (this.rewake(rest.a, push)) this.blood.hit(rest.at, dir, o.strength);
      }
    }
    if (o.victim !== null) {
      this.blood.hit(o.to, dir, o.zone === 1 ? o.strength * 1.8 : o.strength);
      this.accent(impactStyle("flesh").accent, o.to);
      return;
    }
    const pane = this.scenario.glass.strike(o.eye, o.to);
    if (pane) {
      this.impacts.sparkBurst(pane.point, 3, 1.2);
      return;
    }
    const wall = this.impacts.surfaceHit(o.eye, o.to);
    if (wall) {
      const style = impactStyle(wall.surface ?? surfaceOfBox(wall.box, this.surfaces));
      this.impacts.wallImpact(wall.point, wall.normal, Math.min(1.6, 0.7 + o.strength * 0.4), style);
      this.accent(style.accent, wall.point, wall.normal);
    }
  }
  /** The surface type a round from `from` landing at `to` struck in the level (null: nothing there, or a body). */
  surfaceStruck(from, to) {
    const wall = this.impacts.surfaceHit(from, to);
    return wall ? wall.surface ?? surfaceOfBox(wall.box, this.surfaces) : null;
  }
  /** The accent of a surface hit somewhere other than the level (a round going into water). */
  surfaceAccent(surface, at) {
    this.accent(impactStyle(surface).accent, at);
  }
  /** A minor effect near the camera (an impact's accent): skipped far away and when many effects are playing. */
  accent(fx, at, up) {
    if (!fx) return;
    const cam = this.scene.activeCamera?.globalPosition;
    if (cam && Math.hypot(cam.x - at.x, cam.y - at.y, cam.z - at.z) > ACCENT_RANGE) return;
    this.vfx.play(fx.pack, fx.effect, new Vector3(at.x, at.y, at.z), { scale: fx.scale, minor: true, ...up ? { up: new Vector3(up.x, up.y, up.z) } : {} });
  }
  /** `at` moved `by` metres toward the camera (an effect on a body: on its near side, not inside it). */
  towardCamera(at, by) {
    const cam = this.scene.activeCamera?.globalPosition;
    if (!cam) return at;
    const d = Math.hypot(cam.x - at.x, cam.y - at.y, cam.z - at.z);
    if (d < by * 2) return at;
    const k = by / d;
    return { x: at.x + (cam.x - at.x) * k, y: at.y + (cam.y - at.y) * k, z: at.z + (cam.z - at.z) * k };
  }
  /**
   * A size for a burst at `at` that keeps it as big on screen as it is 3 m off (fxMap.ts farFxSize: 1 nearer, at most 4): a pickup's sparkle or a streak's burst seen across a room reads, and one beside you is no bigger.
   */
  farSize(at) {
    const cam = this.scene.activeCamera?.globalPosition;
    if (!cam) return 1;
    return farFxSize(Math.hypot(cam.x - at.x, cam.y - at.y, cam.z - at.z));
  }
  /** A moment of play's effect (content/vfx.json map.gameplay: `pickup.health`, `spawn`, `portal`, `pad`, `trap.shock`, `zipline` …). */
  playGameplayFx(key, at, o = {}) {
    const fx = gameplayFx(key);
    if (!fx) return false;
    const cam = this.scene.activeCamera?.globalPosition;
    if (cam && Math.hypot(cam.x - at.x, cam.y - at.y, cam.z - at.z) > ACCENT_RANGE * 2) return false;
    const calm = !!o.calmable && reduceFlashing();
    return this.vfx.play(fx.pack, fx.effect, new Vector3(at.x, at.y, at.z), { scale: fx.scale * (o.size ?? 1) * (calm ? CALM_MOMENT.scale : 1), minor: !o.calmable, ...fx.tint ? { tint: fx.tint } : {}, ...calm ? { gain: CALM_MOMENT.gain, fadeIn: BLAST_FADE_IN } : {} });
  }
  /**
   * A stylised hit from Binbun's Hit FX (godotVfx.ts; content/vfx.json map.weaponImpacts): `melee` on a body, else
   * where a round of `def` lands when that weapon has an impact of its own (the railgun). False when it has none or the pack isn't in.
   */
  hitFx(at, kind) {
    const fx = kind === "melee" ? meleeImpact(Math.random() < 0.5) : weaponImpact(kind);
    return !!fx && this.vfx.play(fx.pack, fx.effect, new Vector3(at.x, at.y, at.z), { scale: fx.scale });
  }
  /** A brief muzzle flash on a remote player's gun: the pack's flash for that weapon (muzzleFlash.ts), else the plain star. */
  remoteFlash(slot, def, alt = false) {
    const a = this.avatars.get(slot);
    if (!a?.muzzle) return;
    const barrel = alt ? def?.view.altShot : void 0;
    const fx = barrel ? { id: barrel.flash.effect, scale: barrel.flash.scale ?? 0.2 } : def ? muzzleEffectFor(def) : null;
    if (barrel?.smoke) {
      a.muzzle.node.computeWorldMatrix(true);
      const m = a.muzzle.node.getWorldMatrix();
      const at = Vector3.TransformCoordinates(a.muzzle.local, m);
      const fwd = Vector3.TransformNormal(new Vector3(0, 0, 1), m).normalize();
      this.muzzleSmoke(at, fwd, barrel.smoke);
      this.smokeClouds.remote++;
    }
    const near = Vector3.DistanceSquared(a.root.position, this.camera.globalPosition) < REMOTE_FLASH_RANGE * REMOTE_FLASH_RANGE;
    if (fx && near && MuzzleFlashRig.ready() && (a.flashRig || this.remoteRigs < MAX_REMOTE_RIGS)) {
      if (!a.flashRig) {
        a.flashRig = new MuzzleFlashRig(this.scene, `${a.root.name}_flashRig`);
        this.remoteRigs++;
      }
      const calm = reduceFlashing();
      if (a.flashRig.fire(fx.id, fx.scale * 1.25 * (calm ? SAFE_MUZZLE.scale : 1), calm ? SAFE_MUZZLE.opacity : 1)) {
        this.placeRemoteFlash(a);
        return;
      }
    }
    a.flash ??= this.createFlash(a.root.name);
    a.flashUntil = performance.now() + 55;
    kickFlash(a.flash, reduceFlashing() ? SAFE_MUZZLE.scale : 1, reduceFlashing() ? SAFE_MUZZLE.opacity : 1);
  }
  /** Put a remote flash rig at the muzzle, pointing down the barrel. */
  placeRemoteFlash(a) {
    if (!a.flashRig || !a.muzzle) return;
    a.muzzle.node.computeWorldMatrix(true);
    const m = a.muzzle.node.getWorldMatrix();
    const at = Vector3.TransformCoordinates(a.muzzle.local, m);
    const fwd = Vector3.TransformNormal(new Vector3(0, 0, 1), m).normalize();
    a.flashRig.root.position.copyFrom(at);
    a.flashRig.root.lookAt(at.add(fwd));
  }
  createFlash(name) {
    return createStarFlash(this.scene, `${name}_flash`, 0.55);
  }
  /** Step the effects physics and everything riding on it. */
  updateEffects() {
    const now = performance.now();
    const wall = Math.min(1, (now - this.lastFrame) / 1e3);
    const dt = Math.min(0.1, wall);
    this.lastFrame = now;
    const prof = perfProbe.on;
    let t = prof ? now : 0;
    this.propFlames.want(this.camera.globalPosition);
    if (prof) t = perfProbe.add(SYS.flames, t);
    {
      const cam = this.scene.activeCamera;
      const planes = cam ? Frustum.GetPlanes(cam.getTransformationMatrix()) : null;
      this.lasting.update(this.camera.globalPosition, planes ? (at, r) => inView(planes, at.x, at.y, at.z, r) : void 0);
    }
    if (prof) t = perfProbe.add(SYS.fx, t);
    this.propFlames.show();
    if (prof) t = perfProbe.add(SYS.flames, t);
    if (this.vfx.count) {
      if (this.sunLight) this.vfx.setLight(this.sunLight.direction.clone(), this.sunLight.diffuse.scale(this.sunLight.intensity), (this.hemi?.diffuse ?? Color3.White()).scale((this.hemi?.intensity ?? 0.8) * 0.7));
      this.vfx.update(dt * 1e3);
    }
    this.impacts.update(wall);
    this.steadyArcs.update(now);
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
      const settle = (a) => {
        if (!a.ragdoll || a.ragdoll.frozen) return;
        if (prof) perfProbe.n[COUNT.ragdolls]++;
        if (a.ragdoll.update() && a.anim instanceof CharacterAnimator) a.anim.freezePose();
      };
      for (const a of this.avatars.values()) settle(a);
      const eye = this.camera.globalPosition;
      this.corpses = this.corpses.filter((c) => {
        settle(c.a);
        if (this.crowd && Math.hypot(c.a.root.position.x - eye.x, c.a.root.position.z - eye.z) > CROWD_SHADOW_REACH) this.atmosphere.shadowless.add(c.a.root);
        else this.atmosphere.shadowless.delete(c.a.root);
        if (this.bodies !== "fade" || this.keepBodies) return true;
        const age = (now - c.born) / 1e3 - CORPSE_STAY;
        if (age <= 0) return true;
        if (age >= CORPSE_SINK) {
          this.retireAvatar(c.a);
          return false;
        }
        if (c.a.ragdoll) {
          c.a.ragdoll.dispose();
          c.a.ragdoll = void 0;
          if (c.a.anim instanceof CharacterAnimator) c.a.anim.thawPose();
        }
        c.a.root.position.y -= dt * 0.5;
        return true;
      });
      this.debrisBodies = this.debrisBodies.filter((d) => {
        const age = (now - d.born) / 1e3;
        if (age > DEBRIS_LIFE || this.physics.belowWorld(d.body.translation().y)) {
          if (!d.shared) d.mesh.material?.dispose();
          d.mesh.dispose();
          this.physics.remove(d.body);
          return false;
        }
        const t2 = d.body.translation();
        const r = d.body.rotation();
        d.mesh.position.set(t2.x, t2.y, t2.z);
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
  dropCanopy(a) {
    if (a.canopy) releaseCanopy(this.scene, a.canopy.node, a.canopy.kind);
    a.canopy = void 0;
  }
  localCanopy;
  /** Your own slot (from updateAvatars): your first-person parachute wears its colours, as others see it. */
  canopySlot = 0;
  /** Your own canopy in first person (overhead, where looking up shows it); null packs it away. */
  updateLocalCanopy(pos, yaw, kind) {
    if (this.localCanopy && (this.localCanopy.kind !== kind || !pos)) {
      releaseCanopy(this.scene, this.localCanopy.node, this.localCanopy.kind);
      this.localCanopy = void 0;
    }
    if (!pos || !kind) return;
    this.localCanopy ??= { node: createCanopy(this.scene, "canopy_local", kind, this.canopySlot), kind };
    placeCanopy(this.localCanopy.node, pos, yaw, performance.now(), 0);
  }
  /** A jetpack flame (a glowing cone pointing down behind the shoulders). */
  /** The map's ziplines (riders' poses name one by index). */
  ziplines = [];
  localTrolley;
  /**
   * A zipline trolley: a steel block with two grooved wheels riding the
   * cable and a T-bar hanging down to the rider's hands. Built at the origin
   * with the cable along +Z at y 0; `parent` places it.
   */
  createTrolley(name, parent, y) {
    const root = new TransformNode(name, this.scene);
    root.parent = parent;
    root.position.y = y;
    const steel = glow(this.scene, "trolleySteel", "#3a3f46", 0.15);
    const bright = glow(this.scene, "trolleyBright", "#c9ccd0", 0.2);
    const part = (m, x, py, z) => {
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
  updateLocalTrolley(pos, zip, scale = 1) {
    const line = zip !== void 0 ? this.ziplines[zip] : void 0;
    if (!pos || !line) {
      this.localTrolley?.setEnabled(false);
      return;
    }
    this.localTrolley ??= this.createTrolley("trolley_local", null, 0);
    this.localTrolley.setEnabled(true);
    this.localTrolley.position.set(pos.x, pos.y + hangDepth(scale), pos.z);
    this.localTrolley.rotation.y = Math.atan2(line.dir.x, line.dir.z);
    this.localTrolley.rotation.x = -Math.asin(line.dir.y);
  }
  createJetFlame(parent) {
    const flame = CreateCylinder("jetFlame", { diameterTop: 0.22, diameterBottom: 0.02, height: 0.8, tessellation: 10 }, this.scene);
    flame.parent = parent;
    flame.position.set(0, 0.75, -0.28);
    flame.material = glow(this.scene, "jetFlameMat", "#ffa040");
    flame.isPickable = false;
    return flame;
  }
  /**
   * Under the surface of a liquid the view is hazed in its colour (the backdrop's haze comes back on the way out).
   * Reduce flashing: the haze comes and goes over a third of a second, so bobbing at the surface doesn't flicker the
   * whole screen between the two.
   */
  updateUnderwater() {
    const l = this.liquids.length ? liquidAt(this.liquids, this.camera.position) : null;
    const kind = l?.liquid ?? null;
    if (kind !== this.underLiquid) {
      if (this.underLiquid === null && this.underHaze === 0) this.dryFog = { mode: this.scene.fogMode, color: this.scene.fogColor.clone(), density: this.scene.fogDensity };
      this.underLiquid = kind;
      if (kind) this.underLook = { color: Color3.FromHexString(LIQUID_LOOKS[kind].color).scale(0.6), density: kind === "water" ? 0.09 : 0.5 };
    }
    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0, (now - (this.underAt || now)) / 1e3));
    this.underAt = now;
    const want = kind ? 1 : 0;
    const was = this.underHaze;
    this.underHaze = reduceFlashing() ? ease$1(was, want, dt, 3) : want;
    if (this.underHaze === was && (want === was || !this.dryFog)) return;
    const dry = this.dryFog;
    const look = this.underLook;
    if (!dry || !look) return;
    const k = this.underHaze;
    if (k <= 0) {
      this.scene.fogMode = dry.mode;
      this.scene.fogColor = dry.color;
      this.scene.fogDensity = dry.density;
      return;
    }
    this.scene.fogMode = 2;
    const dryDensity = dry.mode === 2 ? dry.density : 0;
    this.scene.fogColor = Color3.Lerp(dry.color, look.color, k);
    this.scene.fogDensity = dryDensity + (look.density - dryDensity) * k;
  }
  /** How far into a liquid's haze the view is (0 dry, 1 under), eased with flashing reduced. */
  underHaze = 0;
  underAt = 0;
  underLook = null;
  liquids = [];
  underLiquid = null;
  dryFog = null;
  /** Place the view. `roll` is only ever set riding a vehicle (its gentle lean); on foot the view is always level. */
  setCamera(eye, yaw, pitch, fov, roll = 0) {
    this.camera.position.set(eye.x, eye.y, eye.z);
    this.steadyEye.pos.set(eye.x, eye.y, eye.z);
    this.steadyEye.yaw = yaw;
    this.steadyEye.pitch = pitch;
    const shake = this.currentShake();
    if (shake > 0) {
      const t = performance.now() / 1e3;
      const k = shake * shake;
      poseCamera(this.camera, yaw + Math.sin(t * 47 + 1.3) * 0.035 * k, pitch - Math.sin(t * 61) * 0.035 * k, roll + Math.sin(t * 53 + 2.1) * 0.025 * k);
      this.camera.position.y += Math.sin(t * 71) * 0.06 * k;
    } else poseCamera(this.camera, yaw, pitch, roll);
    this.camera.fov = fov;
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
  sightTop = 0.1;
  stockZ = -0.3;
  setViewmodel(def) {
    if (def?.id === this.viewWeapon) return;
    this.viewWeapon = def?.id;
    const load = ++this.viewLoad;
    this.viewmodel?.setEnabled(false);
    this.viewmodel = void 0;
    if (!def) return;
    const show = (v) => {
      ({ muzzleZ: this.muzzleZ, muzzleY: this.muzzleY, sightTop: this.sightTop, stockZ: this.stockZ } = v);
      v.node.setEnabled(true);
      this.viewmodel = v.node;
      this.fpArms?.anim?.gripExternal(v.node, def.view.hold);
      if (this.fpBody?.a.anim instanceof CharacterAnimator) this.fpBody.a.anim.gripExternal(v.node, def.view.hold);
    };
    const kept = this.viewmodels.get(def.id);
    if (kept) return show(kept);
    void this.models.instantiate(def.view.model, `view_${def.id}`).then((node) => {
      const bounds = node.getHierarchyBoundingVectors(true);
      node.parent = this.viewRoot;
      for (const m of node.getChildMeshes()) m.renderingGroupId = 1;
      const at = def.view.muzzleAt;
      const v = { node, muzzleZ: at ? at[2] : bounds.max.z, muzzleY: at ? at[1] : (bounds.min.y + bounds.max.y) / 2 + (bounds.max.y - bounds.min.y) * 0.2, sightTop: bounds.max.y, stockZ: bounds.min.z };
      this.viewmodels.set(def.id, v);
      this.viewmodelPaths.set(def.id, def.view.model);
      node.setEnabled(false);
      if (load === this.viewLoad) show(v);
      const held = heldModel(def, this.atmosphere.quality);
      if (held) this.sharpenViewmodel(def, v, held);
    });
  }
  /** Which copy of each kept first-person gun is drawn (tests): the model path. */
  viewmodelPaths = /* @__PURE__ */ new Map();
  /**
   * Guns no longer carried (dropped, or the match changed hands) leave the kept first-person guns, and a sharper held
   * copy's maps leave the GPU with them: held copies at High are about 30 MB of video memory each, so only the guns
   * you carry keep theirs (docs/ARSENAL.md, "Texture tiers"). `carried`: weapon ids.
   */
  trimViewmodels(carried) {
    for (const [id, v] of this.viewmodels) {
      if (carried.has(id) || id === this.viewWeapon) continue;
      if (this.viewmodel === v.node) this.viewmodel = void 0;
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
  throwHold = null;
  /** Each throwable's model in your hands, made once and kept (hidden) like the guns you have held. */
  throwModels = /* @__PURE__ */ new Map();
  throwRoot = null;
  /**
   * Lining up a throw (G held) with `kind`, or null when not: the gun goes away and the throwable's model
   * (content/throwables.json `view`) comes up in both hands, held like a pistol's grip with the support hand round
   * it; let go and the same model flies off. Throwables drawn in code (no model) leave the gun in hand.
   */
  setThrowHold(kind) {
    const path = kind ? throwableModel(kind, this.setLook) : null;
    if (this.throwHold?.kind === kind && this.throwHold?.path === path) return;
    if (this.throwHold) {
      this.throwHold.node?.setEnabled(false);
      this.throwHold = null;
      this.restoreGrip();
    }
    if (!kind || !path) return;
    const hold = { kind, path, node: null };
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
  throwHoldShown() {
    return this.throwHold?.node?.isEnabled() ? this.throwHold.path : null;
  }
  throwModel(path) {
    let p = this.throwModels.get(path);
    if (!p) {
      if (!this.throwRoot) {
        this.throwRoot = new TransformNode("throwRoot", this.scene);
        this.throwRoot.parent = this.camera;
        this.throwRoot.position.set(...THROW_HOLD_AT);
      }
      const root = this.throwRoot;
      p = this.models.instantiate(path, `throwHold_${this.throwModels.size}`).then(
        (node) => {
          node.parent = root;
          if (path === AMMO_BOX_MODEL) node.scaling.setAll(AMMO_BOX_KIT_HAND_SCALE);
          for (const m of node.getChildMeshes()) m.renderingGroupId = 1;
          node.setEnabled(false);
          return node;
        },
        () => null
      );
      this.throwModels.set(path, p);
    }
    return p;
  }
  /** The hands back on the gun after a throw hold. */
  restoreGrip() {
    const def = this.viewWeapon ? getWeapon(this.viewWeapon) : void 0;
    const node = def ? this.viewmodel ?? null : null;
    node?.setEnabled(true);
    this.fpArms?.anim?.gripExternal(node, def?.view.hold ?? null);
    if (this.fpBody?.a.anim instanceof CharacterAnimator) this.fpBody.a.anim.gripExternal(node, def?.view.hold ?? null);
  }
  /**
   * Swap a kept first-person gun for its sharper copy (view.held: the same mesh with bigger maps, docs/ARSENAL.md
   * "Texture tiers"): fetched only for the guns you hold, drawn the moment it is in; until then (or if it fails) the
   * copy everyone else sees stays in your hands. Same mesh, so the muzzle, sight and hold numbers carry over.
   */
  sharpenViewmodel(def, v, path) {
    void this.models.instantiate(path, `view_${def.id}_held`).then(
      (node) => {
        if (this.viewmodels.get(def.id) !== v || this.scene.isDisposed) return node.dispose();
        for (const m of node.getChildMeshes()) m.renderingGroupId = 1;
        const old = v.node;
        takeOverViewmodel(old, node);
        v.node = node;
        this.viewmodelPaths.set(def.id, path);
        if (this.viewmodel === old) {
          this.viewmodel = node;
          this.fpArms?.anim?.gripExternal(node, def.view.hold);
          if (this.fpBody?.a.anim instanceof CharacterAnimator) this.fpBody.a.anim.gripExternal(node, def.view.hold);
        }
        old.dispose();
      },
      () => void 0
    );
  }
  /**
   * Show your own character's arms in first person, holding the viewmodel.
   * The arms hang from the camera at shoulder height; the gun keeps its
   * viewmodel placement (bob, recoil, reload dip) and the hands follow it by IK.
   */
  /** The match's weapon set (sim/weaponSets.ts), whose looks grenades wear in hands, in flight and as pickups. */
  setLook;
  /** The match's weapon set (the session, on joining and when the host changes it): grenades drawn from now on wear its looks. */
  setWeaponSetLook(set) {
    this.setLook = set;
  }
  setLocalLook(look) {
    this.localLook = look;
    if (this.fpMode === "arms") this.buildFpArms();
  }
  /** First person: your whole character ('body') or arms only ('arms'); applies from the next frame. */
  setFirstPersonMode(mode) {
    this.fpMode = mode;
    if (mode === "arms") this.buildFpArms();
  }
  get firstPersonMode() {
    return this.fpMode;
  }
  /** Whether your own whole body is drawn in first person now (tests). */
  hasFirstPersonBody() {
    return !!this.fpBody;
  }
  /** Build your look's first-person arms (arms-only first person, and full body's fallback in a seat). */
  buildFpArms() {
    const look = this.localLook;
    if (!look || this.fpArms?.look === look) return;
    this.fpArms?.anim?.dispose();
    this.fpArms?.root.dispose();
    const root = new TransformNode("fpArms", this.scene);
    root.parent = this.camera;
    const arms = { look, anim: null, root };
    this.fpArms = arms;
    void this.characters.create({ look: armsLookFor(look), armsOnly: true }, "fpArmsChar").then((ch) => {
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
  strikeMotion = null;
  /** Your own punches and kicks so far (tests). */
  strikes = { punch: 0, kick: 0 };
  /** Your boot, seen for a kick (made on first need). */
  boot;
  /**
   * Your own punch or kick (quick melee) in first person: for a punch the
   * gun dips aside and the arms throw a jab or a cross; for a kick the gun
   * dips and your boot comes up into view and snaps forward.
   */
  localStrike(kind, jab) {
    this.strikeMotion = { kind, t0: performance.now() };
    this.strikes[kind]++;
    if (kind === "punch") this.fpArms?.anim?.trigger(jab ? "jab" : "melee");
    if (kind === "punch") this.fpBody?.a.anim?.trigger(jab ? "jab" : "melee");
    if (kind === "kick" && !this.boot) {
      const boot = CreateBox("fpBoot", { width: 0.13, height: 0.11, depth: 0.3 }, this.scene);
      const mat2 = new StandardMaterial("fpBootMat", this.scene);
      mat2.diffuseColor = new Color3(0.16, 0.13, 0.11);
      mat2.specularColor = new Color3(0.05, 0.05, 0.05);
      boot.material = mat2;
      boot.isPickable = false;
      boot.parent = this.camera;
      boot.renderingGroupId = this.viewRoot.getChildMeshes()[0]?.renderingGroupId ?? 0;
      boot.setEnabled(false);
      this.boot = boot;
    }
  }
  /** 0..1..0 over a strike: quick out, slower back. */
  strikeAmount(now, seconds) {
    const m = this.strikeMotion;
    if (!m) return 0;
    const t = (now - m.t0) / 1e3 / seconds;
    if (t >= 1) return 0;
    return t < 0.3 ? Math.sin(t / 0.3 * (Math.PI / 2)) : Math.cos((t - 0.3) / 0.7 * (Math.PI / 2));
  }
  /** Recoil kick and muzzle flash for a predicted shot (`alt`: the second trigger). */
  kick(def, alt = false) {
    const barrel = alt ? def.view.altShot : void 0;
    this.kickShot = !!barrel;
    const calm = reduceFlashing();
    const size = calm ? SAFE_MUZZLE.scale : 1;
    const opacity = calm ? SAFE_MUZZLE.opacity : 1;
    if (barrel) {
      this.kickAmount = 1;
      this.flashUntil = performance.now() + 60;
      this.starFlash = !this.flashRig.fire(barrel.flash.effect, (barrel.flash.scale ?? 0.2) * OWN_FLASH_SCALE * size, opacity);
      if (this.starFlash) kickFlash(this.flash, 1.8 * size, opacity);
      const at = this.localMuzzle();
      if (at && barrel.smoke) {
        const m = this.viewRoot.getWorldMatrix();
        const fwd = Vector3.TransformNormal(new Vector3(0, 0, 1), m).normalize();
        this.muzzleSmoke(at, fwd, barrel.smoke);
        this.smokeClouds.local++;
      }
      return;
    }
    const rail = def.id === "core.railgun";
    const visual = gunplayOf(def).kick?.visual;
    this.kickAmount = Math.min(1, this.kickAmount + (def.kind === "melee" ? 0.9 : visual !== void 0 ? Math.min(1, visual * 0.75) : rail || def.pellets > 1 || def.projectile ? 1 : 0.45));
    if (rail) {
      this.flashUntil = performance.now() + 80;
      this.starFlash = true;
      kickFlash(this.flash, 2 * size, opacity);
      return;
    }
    if (def.kind === "melee" || def.view.beam) return;
    this.flashUntil = performance.now() + 45;
    const fx = muzzleEffectFor(def);
    this.starFlash = !(fx && this.flashRig.fire(fx.id, fx.scale * OWN_FLASH_SCALE * size, opacity));
    if (this.starFlash) kickFlash(this.flash, (def.pellets > 1 || def.damage >= 60 ? 1.5 : def.damage < 15 ? 0.7 : 1) * size, opacity);
    if (def.kind === "hitscan" && def.ammo) this.ejectCasing(def.pellets > 1 ? 1.6 : def.damage >= 60 ? 1.4 : 1);
  }
  /**
   * Black-powder smoke: a cloud of grey-white puffs rolling out along the barrel from the
   * muzzle, thinning and rising as it hangs in the air. `amount` 1 is a blunderbuss.
   */
  muzzleSmoke(at, dir, amount) {
    const n = Math.round(7 * amount);
    for (let i = 0; i < n; i++) {
      const t = 0.1 + i / n * 0.9 * amount + Math.random() * 0.15;
      const j = () => (Math.random() - 0.5) * 0.18 * (1 + t);
      const p = { x: at.x + dir.x * t + j(), y: at.y + dir.y * t + j() * 0.6, z: at.z + dir.z * t + j() };
      const speed = (1 - i / n) * 2.6 + 0.4;
      this.impacts.puff(p, i % 3 === 0 ? "#bdb7ad" : "#dcd8d0", (0.45 + Math.random() * 0.35) * amount * (0.7 + t * 0.4), 1.6 + Math.random() * 1.4, 0.25 + Math.random() * 0.3, false, { x: dir.x * speed, y: dir.y * speed + 0.1, z: dir.z * speed });
    }
  }
  /** A spent case flips out of the right side of your gun and rattles on the floor. */
  ejectCasing(size) {
    if (!this.physics || !this.viewmodel) return;
    this.viewRoot.computeWorldMatrix(true);
    const m = this.viewRoot.getWorldMatrix();
    const at = Vector3.TransformCoordinates(new Vector3(0.04, 0.05, this.muzzleZ * 0.35), m);
    const right = Vector3.TransformNormal(new Vector3(1, 0, 0), m).normalize();
    const up = Vector3.TransformNormal(new Vector3(0, 1, 0), m).normalize();
    const back = Vector3.TransformNormal(new Vector3(0, 0, -1), m).normalize();
    const v = right.scale(2.2 + Math.random()).add(up.scale(1.6 + Math.random())).add(back.scale(0.6));
    const shell = CreateCylinder("casing", { height: 0.03 * size, diameter: 0.011 * size, tessellation: 6 }, this.scene);
    shell.material = this.brass;
    shell.isPickable = false;
    shell.position.copyFrom(at);
    const body = this.physics.addBody({ kind: "box", half: { x: 6e-3 * size, y: 0.015 * size, z: 6e-3 * size } }, at, { x: 0, y: 0, z: 0, w: 1 }, "debris", { vel: v, spin: { x: Math.random() * 20, y: Math.random() * 20, z: 15 }, density: 2 });
    this.debrisBodies.push({ mesh: shell, body, born: performance.now(), shared: true });
    while (this.debrisBodies.filter((d) => d.shared).length > 40) {
      const i = this.debrisBodies.findIndex((d2) => d2.shared);
      const d = this.debrisBodies.splice(i, 1)[0];
      d.mesh.dispose();
      this.physics.remove(d.body);
    }
  }
  /** Position the viewmodel: offset, bob while moving, recoil, and dips for raising/reloading. */
  updateViewmodel(dt, o) {
    const def = this.viewWeapon ? getWeapon(this.viewWeapon) : void 0;
    this.viewRoot.setEnabled(!o.hidden && !!def);
    this.viewHidden = o.hidden || !def;
    const arms = !o.hidden && !!def && !this.fpBody;
    this.fpArms?.root.setEnabled(arms);
    if (arms && this.fpArms?.anim) this.fpArms.anim.update(dt, { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0, celebrate: false });
    if (!def) return;
    this.kickAmount = Math.max(0, this.kickAmount - dt * 6);
    const pace = o.moving ? o.speed === void 0 ? 1 : Math.min(1.5, o.speed / PLAYER.runSpeed) : 0;
    this.bobPhase += dt * 9 * pace;
    this.bobAmount += (Math.min(1, pace) - this.bobAmount) * Math.min(1, dt * 8);
    const ads = o.ads ?? 0;
    const bob = this.bobAmount * (1 - ads * 0.8);
    const [vx, vy, vz] = def.view.viewOffset;
    const adsY = -(this.sightTop + 6e-3);
    const adsZ = Math.max(vz, 0.2 - this.stockZ);
    const x = vx * (1 - ads);
    const y = vy + (adsY - vy) * ads;
    const z = vz + (adsZ - vz) * ads;
    const melee = def.kind === "melee" && !this.kickShot;
    const heavy = this.kickShot ? 2.6 : 1;
    this.viewRoot.position.set(
      x + Math.sin(this.bobPhase) * 0.012 * bob,
      y + Math.abs(Math.cos(this.bobPhase)) * 0.01 * bob - o.raise * 0.25 - o.reload * 0.08,
      z - this.kickAmount * (melee ? -0.25 : 0.06 * heavy) * (1 - ads * 0.5)
    );
    this.viewRoot.rotation.set(-this.kickAmount * (melee ? -0.6 : 0.12 * heavy) + o.reload * 0.6, melee ? this.kickAmount * 0.5 : 0, o.reload * 0.4);
    const now = performance.now();
    const kicking = this.strikeMotion?.kind === "kick";
    const strike = this.strikeAmount(now, kicking ? 0.5 : 0.36);
    if (strike > 0) {
      this.viewRoot.position.y -= strike * (kicking ? 0.1 : 0.14);
      this.viewRoot.position.x += strike * (kicking ? 0 : 0.06);
      this.viewRoot.rotation.z += strike * (kicking ? 0.1 : 0.45);
    } else if (this.strikeMotion && now - this.strikeMotion.t0 > 600) this.strikeMotion = null;
    if (this.boot) {
      this.boot.setEnabled(kicking && strike > 0);
      if (kicking && strike > 0) {
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
  updateAvatars(poses, localSlot, spec, celebrate = false, allyColor = () => null, seated = /* @__PURE__ */ new Set(), sitting = /* @__PURE__ */ new Map()) {
    const now = performance.now();
    this.canopySlot = localSlot;
    this.avatarFrame++;
    const crowd = poses.length > ANIM_LOD_CROWD;
    this.crowd = crowd;
    setCharacterLodCrowd(crowd);
    const planes = crowd && this.scene.activeCamera ? Frustum.GetPlanes(this.scene.activeCamera.getTransformationMatrix()) : null;
    const fov = this.scene.activeCamera?.fov ?? DEFAULT_FOV;
    const eye = this.scene.activeCamera?.globalPosition;
    let shadowCut = Infinity;
    if (eye) {
      const near = [];
      for (const p of poses) {
        if (p.slot === localSlot || !p.alive) continue;
        if (planes && !inView(planes, p.x, p.y + 0.9, p.z, CULL_RADIUS)) continue;
        near.push((p.x - eye.x) ** 2 + (p.z - eye.z) ** 2);
      }
      if (near.length > SHADOW_CHARACTERS) shadowCut = near.sort((x, y) => x - y)[SHADOW_CHARACTERS - 1];
    }
    const seen = /* @__PURE__ */ new Set();
    let deathMs = 0;
    let deathsStarted = 0;
    this.retiring.run();
    const starting = this.deathsToStart(poses, eye);
    for (const p of poses) {
      if (p.slot === localSlot) {
        if (!p.alive) continue;
        seen.add(p.slot);
        const want2 = spec(p.slot);
        const key2 = JSON.stringify(want2);
        let a2 = this.avatars.get(p.slot);
        if (a2 && a2.specKey !== key2) {
          this.disposeAvatar(a2);
          a2 = void 0;
        }
        if (!a2) this.avatars.set(p.slot, a2 = this.createAvatar(p.slot, want2, key2));
        a2.hiddenSelf = true;
        a2.wasAlive = true;
        a2.last = void 0;
        a2.vel = { x: 0, z: 0 };
        const bodyOk = !want2.look || getLook(want2.look).whole?.body !== false;
        if (this.fpMode === "body" && bodyOk && this.firstPersonEye && !seated.has(p.slot) && a2.anim instanceof CharacterAnimator) {
          this.showFpBody(a2, p, now);
          continue;
        }
        if (this.fpBody) this.dropFpBody();
        if (this.fpMode === "arms" || !bodyOk || !this.firstPersonEye || seated.has(p.slot)) this.buildFpArms();
        a2.root.setEnabled(false);
        a2.root.position.set(p.x, p.y, p.z);
        a2.root.rotation.y = p.yaw;
        if (a2.anim instanceof CharacterAnimator) a2.anim.setDormant(true);
        continue;
      }
      seen.add(p.slot);
      if (p.alive) this.lyingDead.delete(p.slot);
      else if (this.lyingDead.has(p.slot) && !this.avatars.has(p.slot)) continue;
      let a = this.avatars.get(p.slot);
      const want = spec(p.slot);
      const key = JSON.stringify(want);
      if (a && a.specKey !== key) {
        this.retireAvatar(a);
        a = void 0;
      }
      if (!a) {
        a = this.createAvatar(p.slot, want, key);
        this.avatars.set(p.slot, a);
        if (want.npc && p.alive) this.arrive(a, p, now);
      }
      const dt = a.last ? (now - a.last.t) / 1e3 : 0;
      if (a.last && dt > 0) {
        const k = Math.min(1, dt * 12);
        a.vel.x += ((p.x - a.last.x) / dt - a.vel.x) * k;
        a.vel.z += ((p.z - a.last.z) / dt - a.vel.z) * k;
        if (Math.hypot(p.x - a.last.x, p.z - a.last.z) > 4) a.vel = { x: 0, z: 0 };
      }
      if (a.last) {
        a.last.x = p.x;
        a.last.y = p.y;
        a.last.z = p.z;
        a.last.t = now;
      } else a.last = { x: p.x, y: p.y, z: p.z, t: now };
      const d2 = eye ? (p.x - eye.x) ** 2 + (p.z - eye.z) ** 2 : 0;
      if (crowd && d2 > CROWD_SHADOW_REACH ** 2 || p.alive && d2 > shadowCut && d2 > SHADOW_ALWAYS ** 2) this.atmosphere.shadowless.add(a.root);
      else this.atmosphere.shadowless.delete(a.root);
      if (a.hiddenSelf) {
        if (this.fpBody?.a === a) this.dropFpBody();
        a.hiddenSelf = false;
        a.root.setEnabled(!a.culled);
        if (a.anim instanceof CharacterAnimator) {
          a.anim.setDormant(!!a.culled);
          a.anim.settleSeat(sitting.has(p.slot));
        }
      }
      if (a.wasAlive && !p.alive && a.anim instanceof CreatureAnimator) {
        a.anim.update(0, { speed: 0, moveAngle: 0, airborne: false, alive: false, pitch: 0, celebrate: false });
        a.fall = this.startFall(a.root.position.x, a.root.position.y, a.root.position.z);
        this.toCorpse(p.slot, a);
        continue;
      }
      if (p.alive) a.diedAt = a.diedFrame = void 0;
      else if (a.wasAlive && a.diedAt === void 0) {
        a.diedAt = now;
        a.diedFrame = this.scene.getFrameId();
      }
      if (a.wasAlive && !p.alive && a.anim && this.physics && !a.ragdoll) {
        if (deathsStarted > 0 && deathMs > DEATH_START_MS || !starting.has(p.slot)) continue;
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
        a.ragdoll = void 0;
        if (a.anim instanceof CharacterAnimator) a.anim.thawPose();
      }
      a.wasAlive = p.alive;
      if (!a.ragdoll) {
        if (p.alive) a.fall = void 0;
        else a.fall ??= this.startFall(p.x, p.y, p.z);
        a.root.position.set(p.x, a.fall ? a.fall.y : p.y, p.z);
        if (a.emergeAt !== void 0) {
          const t = (now - a.emergeAt) / EMERGE_MS;
          if (t >= 1) a.emergeAt = void 0;
          else a.root.position.y -= EMERGE_DEPTH * (1 - t) * (1 - t);
        }
        a.root.rotation.y = p.yaw;
      }
      if (this.showHitboxes && p.alive && !a.ragdoll) {
        const h = hitboxForSpec(want);
        (a.hitbox ??= new BodyHitbox(this.scene)).show(a.root, h.box, p.stance ?? 0, h.scale);
      } else a.hitbox?.hide();
      const out = !!planes && !a.ragdoll && !inView(planes, p.x, p.y + 0.9, p.z, CULL_RADIUS);
      if (out !== !!a.culled) {
        a.culled = out;
        a.root.setEnabled(!out);
        if (a.anim instanceof CharacterAnimator) a.anim.setDormant(out);
      }
      a.placeholder.setEnabled(p.alive && !a.anim);
      const glowColor = p.powerups & POWERUP_DAMAGE_BIT ? "#c03cff" : p.powerups & POWERUP_SPEED_BIT ? "#36d6ff" : null;
      const glowKey = `${glowColor}|${a.anim ? 1 : 0}`;
      const reglow = a.glowKey !== glowKey;
      a.glowKey = glowKey;
      if (reglow) setGlow(a.mat, glowColor ? Color3.FromHexString(glowColor).scale(0.55) : Color3.Black());
      const size = a.root.scaling.y || 1;
      const shielded = p.alive && (p.status & FX_PROTECTED) !== 0;
      if (shielded && !reduceFlashing() && !a.culled) this.lasting.want(`shield:${p.slot}`, "shield.spawn", { x: p.x, y: p.y + 0.95 * size, z: p.z }, { size, level: SHIELD_SHIMMER });
      const aura = p.alive && !a.culled ? p.powerups & POWERUP_DAMAGE_BIT ? "aura.damage" : p.powerups & POWERUP_SPEED_BIT ? "aura.speed" : null : null;
      if (aura) this.lasting.want(`aura:${p.slot}`, aura, { x: p.x, y: p.y + 0.02, z: p.z }, { size, level: 0.85 });
      const shieldGlow = shielded ? 1 : 0;
      a.shieldGlow = a.culled ? shieldGlow : ease$1(a.shieldGlow ?? 0, shieldGlow, dt, 4, 3);
      const step = Math.round(a.shieldGlow * 10);
      if (step !== (a.shieldStep ?? 0) || reglow && step) {
        a.shieldStep = step;
        const k = step / 10 * SHIELD_GLOW_PEAK;
        const base = glowColor ? Color3.FromHexString(glowColor).scale(0.55) : Color3.Black();
        setGlow(a.mat, base.add(SHIELD_GLOW.scale(k)));
        if (a.anim instanceof CharacterAnimator) {
          for (const m of a.anim.ch.meshes) if (m.material && "emissiveColor" in m.material) setGlow(m.material, (glowColor ? Color3.FromHexString(glowColor).scale(0.35) : Color3.Black()).add(SHIELD_GLOW.scale(k)));
        }
      }
      if (a.anim) {
        const sit = sitting.get(p.slot);
        const speed = seated.has(p.slot) ? 0 : Math.hypot(a.vel.x, a.vel.z);
        const far = eye && p.alive ? Math.hypot(p.x - eye.x, p.z - eye.z) : 0;
        a.animDt = (a.animDt ?? 0) + dt;
        let run;
        let stepped;
        if (a.anim instanceof CharacterAnimator && !a.culled) {
          const step2 = perfOn("animlod4") ? animStepByShare(screenShare(far, fov)) : animStep(far, perfOn("animlod2"));
          run = a.anim.stepAt(now, step2, this.avatarFrame, p.slot * 37 % 100);
          stepped = step2.frames > 1;
          if (run && perfProbe.on) perfProbe.n[COUNT.animated]++;
          const unposed = !a.anim.posed;
          if (unposed !== !!a.awaitingPose) {
            a.awaitingPose = unposed;
            a.anim.ch.root.setEnabled(!unposed);
          }
        } else if (a.anim instanceof CreatureAnimator && perfOn("animlod2")) {
          const step2 = animStep(far);
          run = a.anim.stepAt(now, step2, this.avatarFrame, p.slot * 37 % 100, !!a.culled);
          stepped = step2.frames > 1 || !!a.culled;
          if (a.culled) {
            a.animFrame = ((a.animFrame ?? 0) + 1) % 8;
            run = a.animFrame === 0;
          } else if (run && perfProbe.on) perfProbe.n[COUNT.animated]++;
        } else {
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
          ...p.aimYaw ? { aimYaw: p.aimYaw } : {},
          celebrate: (celebrate || !!p.emote) && p.alive,
          stance: p.stance ?? 0,
          sprinting: !!p.sprinting,
          ...sit ? { seated: true, legDrop: sit.legDrop, straddle: sit.straddle ?? 0, seatFacing: angleDelta(p.yaw, sit.yaw) } : {}
        });
        if (reglow && a.anim instanceof CharacterAnimator) {
          for (const m of a.anim.ch.meshes) if (m.material && "emissiveColor" in m.material) setGlow(m.material, glowColor ? Color3.FromHexString(glowColor).scale(0.35) : Color3.Black());
        }
      }
      if (p.weapon !== a.weaponSlot) this.setAvatarWeapon(a, p.weapon);
      if (p.status && p.alive && !a.culled && eye && !(p.status & FX_CLOAK)) this.statusFx.ask(p.slot, p.status, p, a.root.scaling.y || 1, eye);
      if (p.status || a.aura) {
        a.aura ??= createAura(this.scene, a.root);
        setAura(this.scene, a.aura, p.alive ? plainStatus(p.status, this.statusFx.worn(p.slot)) : 0);
      }
      const jetting = p.alive && (p.status & FX_JET) !== 0;
      if (jetting || a.jet) {
        a.jet ??= this.createJetFlame(a.root);
        a.jet.setEnabled(jetting);
        if (jetting) a.jet.scaling.set(1, 0.8 + Math.random() * 0.5, 1);
      }
      const line = p.alive && p.zip !== void 0 ? this.ziplines[p.zip] : void 0;
      if (line || a.trolley) {
        a.trolley ??= this.createTrolley(`trolley_${p.slot}`, a.root, hangDepth());
        a.trolley.setEnabled(!!line);
        if (line) a.trolley.rotation.y = Math.atan2(line.dir.x, line.dir.z) - p.yaw;
      }
      const chute = p.alive && !seated.has(p.slot) ? p.chute ?? 0 : 0;
      if (a.canopy && a.canopy.kind !== chute) this.dropCanopy(a);
      if (chute) {
        a.canopy ??= { node: createCanopy(this.scene, `canopy_${p.slot}`, chute, p.slot), kind: chute };
        placeCanopy(a.canopy.node, a.root.position, p.yaw, now, p.slot, a.canopy.harness ??= canopyHarness(hitboxForSpec(want)));
      }
      if (!a.ragdoll) {
        const glide = chute === CHUTE_GLIDER;
        a.root.rotation.x = glide ? 1.1 : 0;
        if (glide) a.root.position.set(a.root.position.x - Math.sin(p.yaw) * 0.9, a.root.position.y + 0.8, a.root.position.z - Math.cos(p.yaw) * 0.9);
      }
      if (this.auraOf) this.applyAura(a, p.alive ? this.auraOf(p.slot) : null);
      const tag = p.alive ? allyColor(p.slot) : null;
      const cloaked = p.alive && (p.status & FX_CLOAK) !== 0;
      const enemy = !tag || tag.toLowerCase() === "#ff3b3b";
      const shown = cloaked ? enemy ? 0.06 : 0.35 : 1;
      const smoked = enemy && !!tag && this.smoke.length > 0 && this.smokeHides({ x: a.root.position.x, y: a.root.position.y + 1.4, z: a.root.position.z });
      this.setTag(a, (cloaked || smoked) && enemy ? null : tag);
      const leads = p.alive && !cloaked && this.leaderSlots.has(p.slot);
      if (leads || a.crown) {
        a.crown ??= this.createCrown(a.root);
        a.crown.setEnabled(leads);
      }
      if (shown !== 1 || (a.shown ?? 1) !== 1) {
        a.shown = shown;
        for (const m of a.root.getChildMeshes()) {
          if (m.isAnInstance) m.isVisible = shown === 1;
          else m.visibility = shown;
        }
      }
    }
    this.statusFx.flush(now, reduceFlashing());
    for (const [slot, a] of this.avatars) {
      if (!seen.has(slot)) {
        this.retireAvatar(a);
        this.avatars.delete(slot);
      }
    }
    this.drawTags();
  }
  /**
   * Roulette (sim/roulette.ts): each player's outline (its Teams variant: their team's colour, strong, so random looks
   * still show the sides) and glow (a jackpot life: a steady gold overlay, never a flash). Null: none.
   */
  auraOf = null;
  /** Roulette: the loading gate's warm-up also draws its samples outlined and glowing (their shaders built before play). */
  auraWarm = false;
  applyAura(a, aura) {
    const key = aura ? `${aura.outline}|${aura.glow}|${a.anim ? 1 : 0}|${a.specKey}` : "";
    if (a.auraKey === key) return;
    a.auraKey = key;
    const outline = aura?.outline ? Color3.FromHexString(aura.outline) : null;
    const glow2 = aura?.glow ? Color3.FromHexString(aura.glow) : null;
    for (const m of a.root.getChildMeshes()) {
      if (m.isAnInstance || m === a.placeholder) continue;
      m.renderOutline = !!outline;
      if (outline) {
        m.outlineColor = outline;
        m.outlineWidth = 0.025;
      }
      m.renderOverlay = !!glow2;
      if (glow2) {
        m.overlayColor = glow2;
        m.overlayAlpha = 0.22;
      }
    }
  }
  /** Floaty ragdolls (Lunar) and the gravity storm: the effects world's gravity, a multiple of the usual. */
  setEffectsGravity(scale) {
    this.physics?.setGravityScale(scale);
  }
  /** Play an upper-body action on a remote avatar (shooting, melee). */
  avatarAction(slot, action) {
    const a = this.avatars.get(slot);
    if (!a?.anim) return;
    const eye = this.scene.activeCamera?.globalPosition;
    if (action === "shoot" && eye && Math.hypot(a.root.position.x - eye.x, a.root.position.z - eye.z) > SHOT_OVERLAY_REACH) return;
    a.anim.trigger(action);
  }
  /**
   * Where hands are DRAWN on guns now (tests; handProbe.ts): your own in first person (full body or arms), and
   * every character in view holding a gun, nearest first, with its distance. For each: model metres from each
   * hand's skin to its point on the gun, and how its shooting hand lies on the grip (`aheadR`, `sideR`).
   */
  /** The meshes the main camera drew in its last pass (tests; recorded from the first call on). */
  mainDrawn = null;
  /**
   * What the main camera drew last frame. The scene's active-mesh list, read between frames, is whatever the last
   * evaluation left in it, and it was often empty there (the grip checks then saw nobody drawn: "0 of 0" bots, an Imp
   * with no report). So it is copied right after the main camera's own evaluation, once something asks for it.
   */
  drawnByCamera() {
    if (!this.mainDrawn) {
      this.mainDrawn = /* @__PURE__ */ new Set();
      this.scene.onAfterActiveMeshesEvaluationObservable.add(() => {
        if (this.scene.activeCamera !== this.camera) return;
        const am2 = this.scene.getActiveMeshes();
        this.mainDrawn = new Set(am2.data.slice(0, am2.length));
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
  drawnLevels(meshes, active) {
    const out = [];
    for (const m of meshes) {
      if (active.has(m)) {
        const level = m.getLOD(this.camera);
        if (level) out.push(level);
      } else for (const l of m.getLODLevels?.() ?? []) if (l.mesh && active.has(l.mesh)) out.push(l.mesh);
    }
    return out;
  }
  gripReport() {
    const active = this.drawnByCamera();
    let local = null;
    if (this.fpBody?.a.anim instanceof CharacterAnimator) {
      const g = this.fpBody.a.anim.drawnGrip([...this.fpBody.rig.drawnMeshes, ...this.fpBody.a.anim.ch.meshes]);
      if (g) local = { mode: "body", ...g };
    } else if (this.fpArms?.anim && this.fpArms.root.isEnabled()) {
      const g = this.fpArms.anim.drawnGrip();
      if (g) local = { mode: "arms", ...g };
    }
    const cam = this.scene.activeCamera?.globalPosition ?? Vector3.Zero();
    const remote = [];
    for (const [slot, a] of this.avatars) {
      if (a.hiddenSelf || a.culled || !a.root.isEnabled() || !(a.anim instanceof CharacterAnimator)) continue;
      const drawn = this.drawnLevels(a.anim.ch.meshes, active);
      const g = drawn.length ? a.anim.drawnGrip(drawn) : null;
      if (g) remote.push({ slot, dist: Math.hypot(a.root.position.x - cam.x, a.root.position.z - cam.z), ...g });
    }
    remote.sort((x, y) => x.dist - y.dist);
    const creatures = [];
    for (const [slot, a] of this.avatars) {
      if (a.hiddenSelf || !(a.anim instanceof CreatureAnimator) || !a.root.isEnabled()) continue;
      const drawn = this.drawnLevels(a.anim.ch.meshes, active);
      creatures.push({ slot, report: drawn.length ? a.anim.drawnGrip(drawn) : null });
    }
    return { local, remote, creatures };
  }
  /** Whether your own first-person arms (or full body) have loaded and hold the gun (for tests). */
  hasFirstPersonArms() {
    return !!this.fpArms?.anim || !!this.fpBody;
  }
  /**
   * Full-body first person, each frame: your own character (`p` is where prediction has you) under the steady
   * eye, its legs walking, running, crouching and jumping with you and its hands on the viewmodel. Hidden with
   * the gun (scoped, dead).
   */
  showFpBody(a, p, now) {
    const anim = a.anim;
    let fp = this.fpBody;
    if (fp?.a !== a) {
      this.dropFpBody();
      anim.hold(null);
      a.weaponSlot = -1;
      a.weaponNode?.dispose();
      a.weaponNode = void 0;
      fp = { a, rig: new FirstPersonBodyRig(this.scene, anim.ch, anim, a.root), vel: { x: 0, z: 0 } };
      this.fpBody = fp;
      if (this.viewmodel && this.viewWeapon) anim.gripExternal(this.viewmodel, getWeapon(this.viewWeapon).view.hold);
      this.fpArms?.root.setEnabled(false);
    }
    const shown = !this.viewHidden;
    a.root.setEnabled(shown);
    fp.rig.setEnabled(shown);
    anim.setDormant(!shown);
    if (!shown) return;
    const dt = fp.last ? Math.min(0.1, (now - fp.last.t) / 1e3) : 0;
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
      sprinting: !!p.sprinting
    });
  }
  /** Leave full-body first person: the head comes back and the body is hidden or drawn as anyone's. */
  dropFpBody() {
    const fp = this.fpBody;
    if (!fp) return;
    this.fpBody = void 0;
    fp.rig.dispose();
    if (fp.a.anim instanceof CharacterAnimator) fp.a.anim.gripExternal(null, null);
    fp.a.root.setEnabled(false);
  }
  /** Remote avatars currently shown as animated characters (for tests and the stats overlay). */
  characterCount() {
    return [...this.avatars.values()].filter((a) => a.anim && !a.hiddenSelf).length;
  }
  /** Avatars drawn with a creature body of this kind (tests: zombies in the zombie body). */
  creatureCount(kind) {
    return [...this.avatars.values()].filter((a) => !a.hiddenSelf && a.anim instanceof CreatureAnimator && a.anim.ch.kind === kind).length;
  }
  setAvatarWeapon(a, slot) {
    a.weaponSlot = slot;
    a.weaponNode?.dispose();
    a.weaponNode = void 0;
    a.muzzle = void 0;
    a.anim?.hold(null);
    const def = slot > 0 && !a.unarmed ? weaponByCode(slot) : void 0;
    if (!def) return;
    void (this.crowd ? this.models.instantiateWhole(def.view.model, `held_${slot}`) : this.models.instantiate(def.view.model, `held_${slot}`)).then((node) => {
      if (a.weaponSlot !== slot || a.root.isDisposed()) return node.dispose();
      castSmall(node);
      const { min, max } = node.getHierarchyBoundingVectors(true);
      const at = def.view.muzzleAt;
      a.muzzle = { node, local: at ? new Vector3(at[0], at[1], at[2]) : new Vector3(0, (min.y + max.y) / 2 + (max.y - min.y) * 0.2, max.z) };
      if (a.anim) {
        a.anim.hold(node, def.view.hold);
        return;
      }
      node.parent = a.placeholder;
      node.position.set(0.3, 0.25, 0.35);
      a.weaponNode = node;
    });
  }
  /**
   * A new NPC by a squad's entrance makes its entrance: it climbs out of a
   * hatch or burrow, and dust or debris bursts from the vent, hole or breach.
   */
  arrive(a, p, now) {
    for (const e of this.entrances) {
      const out = e.entrance === "breach" ? 0.8 : 0;
      const mx = e.position[0] + Math.sin(e.yaw) * out;
      const mz = e.position[2] + Math.cos(e.yaw) * out;
      const dy = p.y - e.position[1];
      if (Math.hypot(p.x - mx, p.z - mz) > 1.4 || dy < -0.5 || dy > (e.ventHeight ?? 3.5)) continue;
      const floor = { x: mx, y: e.position[1] + 0.2, z: mz };
      switch (e.entrance) {
        case "vent":
          this.impacts.puff({ x: e.position[0], y: e.position[1] + (e.ventHeight ?? 3.5) - 0.3, z: e.position[2] }, "#6b6760", 1.1, 0.9, -0.6);
          break;
        case "hatch":
          a.emergeAt = now;
          this.impacts.puff(floor, "#5d5955", 0.9, 0.7, 0.8);
          break;
        case "burrow":
          a.emergeAt = now;
          this.impacts.puff(floor, "#6e5440", 1.4, 1.1, 0.9);
          this.impacts.puff(floor, "#4a3828", 0.8, 0.6, 1.4);
          break;
        case "breach":
          this.impacts.puff({ x: e.position[0], y: e.position[1] + 1, z: e.position[2] }, "#a29d93", 1.3, 1, 0.5);
          break;
      }
      return;
    }
  }
  createAvatar(slot, spec, specKey) {
    const root = new TransformNode(`avatar_${slot}`, this.scene);
    const placeholder = CreateCapsule(`avatarcap_${slot}`, { height: PLAYER.height, radius: PLAYER.radius, tessellation: 12, subdivisions: 2 }, this.scene);
    placeholder.parent = root;
    placeholder.position.y = PLAYER.height / 2;
    const mat2 = solid(this.scene, `avatar_${slot}_mat`, spec.npc?.color ?? slotColor(slot));
    placeholder.material = mat2;
    placeholder.isPickable = false;
    const a = { root, placeholder, mat: mat2, weaponSlot: -1, specKey, vel: { x: 0, z: 0 }, ...spec.npc?.zombie ? { unarmed: true } : {} };
    if (spec.creature) {
      void this.creatures.create(spec.creature, `creature_${slot}`).then((ch) => {
        if (root.isDisposed()) return ch.dispose();
        ch.root.parent = root;
        if (spec.size && spec.size !== 1) ch.root.scaling.setAll(spec.size);
        if (spec.armed) {
          fitPlayerSkin(ch, PLAYER.height);
        }
        a.anim = new CreatureAnimator(this.scene, ch, !!spec.armed);
        placeholder.setEnabled(false);
        const slotNow = a.weaponSlot;
        a.weaponSlot = -1;
        if (spec.armed && slotNow >= 0) this.setAvatarWeapon(a, slotNow);
      });
      return a;
    }
    const kept = this.bodyPool.get(specKey)?.pop();
    if (kept) {
      this.pooled.delete(kept);
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
      const slotNow = a.weaponSlot;
      a.weaponSlot = -1;
      if (slotNow >= 0) this.setAvatarWeapon(a, slotNow);
    });
    return a;
  }
  /** Show a teammate marker in the team colour over the avatar (null hides it). */
  /** Slots leading their teams (rules.leaders), from the latest snapshot. */
  leaderSlots = /* @__PURE__ */ new Set();
  setLeaders(slots) {
    this.leaderSlots = slots;
  }
  createCrown(root) {
    const mesh = CreateDisc(`${root.name}_crown`, { radius: 0.16, tessellation: 5 }, this.scene);
    const mat2 = new StandardMaterial(`${root.name}_crownmat`, this.scene);
    mat2.emissiveColor = Color3.FromHexString("#ffd23f");
    mat2.disableLighting = true;
    mesh.material = mat2;
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    mesh.parent = root;
    mesh.position.y = PLAYER.height + 0.68;
    mesh.isPickable = false;
    return mesh;
  }
  setTag(a, color2) {
    if (a.tag && a.tag.color !== color2) {
      a.tag.node.dispose(false, a.tag.node instanceof Mesh);
      a.tag = void 0;
    }
    if (!color2 || a.tag) return;
    const node = this.crowd ? new TransformNode(`${a.root.name}_tag`, this.scene) : this.tagDisc(`${a.root.name}_tag`, color2);
    if (this.crowd) {
      this.tagBatch(color2);
      if (isEnemyTag(color2)) node.rotation.z = -Math.PI / 2;
    }
    node.billboardMode = Mesh.BILLBOARDMODE_ALL;
    node.parent = a.root;
    node.position.y = PLAYER.height + 0.35;
    if (node instanceof Mesh) node.isPickable = false;
    a.tag = { node, color: color2 };
  }
  /** A marker disc in a team colour. Allies: a diamond; enemies (red by default): a downward triangle, so the two read apart at a glance. */
  tagDisc(name, color2, turned = true) {
    const enemy = isEnemyTag(color2);
    const mesh = CreateDisc(name, { radius: enemy ? 0.13 : 0.11, tessellation: enemy ? 3 : 4 }, this.scene);
    if (enemy && turned) mesh.rotation.z = -Math.PI / 2;
    const mat2 = new StandardMaterial(`${name}mat`, this.scene);
    mat2.emissiveColor = Color3.FromHexString(color2);
    mat2.disableLighting = true;
    mesh.material = mat2;
    return mesh;
  }
  /** Per colour, the disc every crowd marker of that colour is a thin instance of, and their matrices. */
  tagBatches = /* @__PURE__ */ new Map();
  tagBatch(color2) {
    let b = this.tagBatches.get(color2);
    if (!b) {
      const mesh = this.tagDisc(`tag_${color2}`, color2, false);
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.metadata = { castsNoShadow: true };
      const matrices = new Float32Array(16 * 16);
      mesh.thinInstanceSetBuffer("matrix", matrices, 16, false);
      mesh.setEnabled(false);
      this.tagBatches.set(color2, b = { mesh, matrices, count: 0 });
    }
    return b;
  }
  /**
   * Each frame after the avatars: every crowd marker drawn where its node is, as its own disc was (hidden with its
   * body, and while its player is see-through, as instances were; never your own).
   */
  drawTags() {
    if (!this.tagBatches.size) return;
    for (const b of this.tagBatches.values()) b.count = 0;
    for (const a of this.avatars.values()) {
      const t = a.tag;
      if (!t || t.node instanceof Mesh || a.hiddenSelf || (a.shown ?? 1) !== 1 || !t.node.isEnabled()) continue;
      const b = this.tagBatches.get(t.color);
      if (!b) continue;
      if (b.matrices.length < (b.count + 1) * 16) {
        const more = new Float32Array(b.matrices.length * 2);
        more.set(b.matrices);
        b.matrices = more;
        b.mesh.thinInstanceSetBuffer("matrix", b.matrices, 16, false);
      }
      t.node.computeWorldMatrix(true).copyToArray(b.matrices, 16 * b.count++);
    }
    for (const b of this.tagBatches.values()) {
      b.mesh.setEnabled(b.count > 0);
      if (!b.count) continue;
      b.mesh.thinInstanceCount = b.count;
      b.mesh.thinInstanceBufferUpdated("matrix");
    }
  }
  /** Going characters' remaining steps (retireAvatar), RETIRE_MS of them a frame. */
  retiring = new FrameSpread(RETIRE_MS);
  /** Characters still being put away (tests). */
  retiringSteps() {
    return this.retiring.size;
  }
  /**
   * An avatar going (a body past MAX_CORPSES or sunk away, a new round, a look changed, a player gone): hidden and out
   * of every list at once, its ragdoll and the rest that ties it to the scene dropped; then over the next frames
   * (RETIRE_MS a frame) its character back in the body pool (thawing its frozen pose recomputes every joint) or
   * disposed, and its node tree. A frame that lost several bodies paid for every one (`?perfoff=bodyspread`: so again).
   */
  retireAvatar(a) {
    if (!perfOn("bodyspread") || this.scene.isDisposed) return this.disposeAvatar(a);
    if (this.fpBody?.a === a) this.dropFpBody();
    this.atmosphere.shadowless.delete(a.root);
    a.root.setEnabled(false);
    a.hitbox?.dispose();
    a.hitbox = void 0;
    a.flash?.material?.dispose();
    a.flash?.dispose();
    a.flash = void 0;
    if (a.flashRig) {
      a.flashRig.dispose();
      a.flashRig = void 0;
      this.remoteRigs--;
    }
    a.ragdoll?.dispose();
    a.ragdoll = void 0;
    this.dropCanopy(a);
    this.retiring.push(
      () => {
        if (a.anim instanceof CharacterAnimator && this.keepBody(a.specKey, a.anim)) a.anim = void 0;
      },
      () => {
        a.anim?.dispose();
        a.anim = void 0;
      },
      () => {
        a.weaponNode?.dispose();
        a.weaponNode = void 0;
        disposeTree(a.root, true);
      }
    );
  }
  disposeAvatar(a) {
    if (this.fpBody?.a === a) this.dropFpBody();
    a.hitbox?.dispose();
    this.atmosphere.shadowless.delete(a.root);
    a.flash?.material?.dispose();
    a.flash?.dispose();
    if (a.flashRig) {
      a.flashRig.dispose();
      this.remoteRigs--;
    }
    a.ragdoll?.dispose();
    if (a.anim instanceof CharacterAnimator && this.keepBody(a.specKey, a.anim)) a.anim = void 0;
    a.anim?.dispose();
    a.weaponNode?.dispose();
    this.dropCanopy(a);
    disposeTree(a.root, true);
  }
  /** Characters kept for the next avatar of their look (BODY_POOL_PER_LOOK), by spec key. */
  bodyPool = /* @__PURE__ */ new Map();
  /** Every kept body with its spec key, longest-kept first (BODY_POOL_TOTAL). */
  pooled = /* @__PURE__ */ new Map();
  /** Keep a going avatar's character for reuse (taken off the avatar, hidden, its clips paused); false: pool full. */
  keepBody(key, anim) {
    if (this.scene.isDisposed || anim.firstPerson || anim.ch.root.isDisposed()) return false;
    let list = this.bodyPool.get(key);
    if (!list) this.bodyPool.set(key, list = []);
    if (list.length >= BODY_POOL_PER_LOOK) return false;
    anim.standBy();
    anim.ch.root.parent = null;
    anim.ch.root.setEnabled(false);
    list.push(anim);
    this.pooled.set(anim, key);
    if (this.pooled.size > BODY_POOL_TOTAL) {
      const [oldest, itsKey] = this.pooled.entries().next().value;
      this.pooled.delete(oldest);
      const its = this.bodyPool.get(itsKey);
      const i = its ? its.indexOf(oldest) : -1;
      if (i >= 0) its.splice(i, 1);
      if (its && !its.length) this.bodyPool.delete(itsKey);
      oldest.dispose();
    }
    return true;
  }
  // ---------------------------------------------------------------- pickups
  addPickup(e, item = e.item, room = Infinity) {
    const root = createPickupVisual(this.scene, this.models, item, `pickup_${e.id}`, true, false, this.setLook, room);
    const baseY = e.position[1] + PICKUP_HOVER;
    root.position.set(e.position[0], baseY, e.position[2]);
    this.pickups.set(e.id, { root, baseY, phase: (e.position[0] * 7 + e.position[2] * 3) % (Math.PI * 2), item, placed: e.item, glowKey: lootGlowKey(item), glow: 0, room });
  }
  /** Tests (the flicker check's ring contrast, the effects checks): no pickup asks for a floor glow while this is set. */
  holdLootGlows = false;
  /** Tests: draw no dark outline under the glows (how they looked before it). */
  lootOutlines = true;
  /** Tests (ring contrast): pickups' own models hidden, their glows and outlines kept. */
  hidePickupModels = false;
  /** The glow's dark outline (lootGlow.ts): as dark as the glow is up, at the floor under the pickup; hidden with no glow. */
  placeLootOutline(id, p, calm) {
    const a = this.lootOutlines && p.glowKey ? lootOutlineAlpha(p.glow, calm) : 0;
    if (a <= 5e-3) {
      if (p.outline?.isEnabled()) p.outline.setEnabled(false);
      return;
    }
    if (!p.outline || p.outlineKey !== p.glowKey) {
      p.outline?.dispose(false, false);
      const radii = lootOutlineRadii(p.glowKey, lastingFx(p.glowKey)?.scale ?? 1);
      if (!radii) return;
      p.outline = createLootOutline(this.scene, radii[0], radii[1], `lootOutline_${id}`);
      p.outlineKey = p.glowKey;
    }
    p.outline.setEnabled(true);
    p.outline.position.set(p.root.position.x, p.baseY - PICKUP_HOVER + 0.015, p.root.position.z);
    p.outline.visibility = a;
  }
  /** How many pickups' floor glows are drawn now (tests). */
  pickupGlows() {
    let n = 0;
    for (const id of this.pickups.keys()) if (this.lasting.drawn(`loot:${id}`)) n++;
    return n;
  }
  /** The item a pickup is drawn as now (tests: a random pickup shows its roll). */
  pickupItem(id) {
    return this.pickups.get(id)?.item;
  }
  /**
   * Spin and bob pickups; hide the ones currently taken. `items`: random pickups holding something other than
   * what was placed (the snapshot's `pw`); a pickup whose item changed is drawn again as the new one.
   */
  updatePickups(taken, now, items) {
    const dt = Math.min(0.1, Math.max(0, (now - this.pickupsAt) / 1e3));
    this.pickupsAt = now;
    const cam = this.camera.globalPosition;
    const calm = reduceFlashing();
    for (const [id, p] of this.pickups) {
      const want = items?.get(id) ?? p.placed;
      if (want !== p.item) {
        const at = p.root.position.clone();
        p.root.dispose(false, false);
        p.root = createPickupVisual(this.scene, this.models, want, `pickup_${id}`, true, false, this.setLook, p.room);
        p.root.position.copyFrom(at);
        p.item = want;
        p.glowKey = lootGlowKey(want);
      }
      p.root.setEnabled(!taken.has(id) && !this.hidePickupModels);
      const pos = p.root.position;
      const glowId = `loot:${id}`;
      if (p.glowKey && !this.holdLootGlows && !taken.has(id) && (pos.x - cam.x) ** 2 + (p.baseY - cam.y) ** 2 + (pos.z - cam.z) ** 2 < LOOT_GLOW_RANGE ** 2) {
        p.glow = lootGlowLevel(p.glow, this.lasting.drawn(glowId), dt, calm);
        this.lasting.want(glowId, p.glowKey, { x: pos.x, y: p.baseY - PICKUP_HOVER + 0.02, z: pos.z }, { level: p.glow, steady: calm });
      } else p.glow = 0;
      this.placeLootOutline(id, p, calm);
      p.root.rotation.y = now * 15e-4 + p.phase;
      p.root.position.y = p.baseY + Math.sin(now * 3e-3 + p.phase) * 0.08;
    }
  }
  /**
   * Weapons dropped by the fallen, as the latest snapshot lists them ([drop ID, item ID, x, y, z, yaw]): new ones
   * appear lying on the ground, gone ones are removed.
   */
  updateDrops(drops) {
    if (!drops.length && !this.drops.size) return;
    const live = /* @__PURE__ */ new Set();
    for (const [id, item, x, y, z, yaw] of drops) {
      live.add(id);
      const had = this.drops.get(id);
      if (had && had.item === item) continue;
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
  dropsDrawn() {
    return [...this.drops].map(([id, d]) => [id, d.item]);
  }
  // ---------------------------------------------------------------- projectiles & effects
  /** Breakable props follow the replicated state (already broken when you join). */
  applyPropStates(states) {
    for (const [i, node] of this.props) {
      const s = states.get(i);
      if (s) node.setEnabled(s[0] > 0);
    }
  }
  /** Props carried by movers follow them (`tick` fractional, like the blocks they ride). */
  applyMoverProps(movers, tick) {
    for (const t of movers.propTransforms(tick)) {
      const node = this.props.get(t.prop.i);
      if (!node) continue;
      node.position.set(t.position.x, t.position.y, t.position.z);
      const q = node.rotationQuaternion ??= new Quaternion();
      q.set(t.rot.x, t.rot.y, t.rot.z, t.rot.w);
    }
  }
  /** A broken prop vanishes (the session adds its debris). */
  breakProp(index) {
    this.props.get(index)?.setEnabled(false);
  }
  updateProjectiles(positions) {
    const now = performance.now();
    for (const [id, pos] of positions) {
      let p = this.projectiles.get(id);
      if (!p) {
        p = { node: this.createProjectile(id, PROJECTILE_VISUALS[pos[3]] ?? "grenade"), look: pos[3], born: now };
        this.projectiles.set(id, p);
      }
      const prev = p.node.position.clone();
      p.node.position.set(pos[0], pos[1], pos[2]);
      const look = PROJECTILE_VISUALS[p.look];
      if (look === "flare") this.lasting.want(`proj:${id}`, "fire.flare", { x: pos[0], y: pos[1], z: pos[2] });
      else if (look === "flareShot") this.flareShotFx(id, p, pos, now);
      if (look && ARSENAL_LOOKS.has(look)) animateArsenalProjectile(p.node, look, now, p.node.position.subtract(prev), p.born);
      else if (look === "grenade" || look === "frag" || look === "vortexNade" || look === "smoke") {
        if (p.node.position.subtract(prev).lengthSquared() > 1e-6) p.node.rotation.x += 0.3;
      } else if (look === "rocket") {
        const d = p.node.position.subtract(prev);
        if (d.lengthSquared() > 1e-6) p.node.lookAt(p.node.position.add(d));
      } else if (look === "mine") {
        const light = p.node.getChildMeshes().find((m) => m.name.endsWith("_light"));
        if (light) {
          const blink = indicator(now / 1e3, 1e3 / 700);
          light.setEnabled(now - p.born > 1200 && blink.on);
          light.visibility = blink.level;
        }
      } else p.node.scaling.setAll(1 + Math.sin(now * 0.03) * 0.12);
    }
    for (const [id, p] of this.projectiles) {
      if (!positions.has(id)) {
        p.node.dispose();
        this.projectiles.delete(id);
      }
    }
  }
  /**
   * The Airstrike Flare's shot, in flight and where it lands to mark the strike: the pack's flame as a steady point of
   * light, a thin column of its smoke rising off it, and a few sparks fizzing (Reduce flashing: a steady glow; the sparks
   * fewer and slower, never a flash).
   */
  flareShotFx(id, p, pos, now) {
    const at = { x: pos[0], y: pos[1], z: pos[2] };
    this.lasting.want(`proj:${id}`, "fire.flare", at);
    this.lasting.want(`smoke:${id}`, "smoke.flare", at);
    const every = reduceFlashing() ? 420 : 140;
    if (now - (p.spark ?? 0) >= every) {
      p.spark = now;
      this.impacts.sparkBurst(at, reduceFlashing() ? 1 : 2, 1.6);
    }
  }
  createProjectile(id, look) {
    if (look === "spear") return this.spearProjectile(id);
    const kind = THROWN_KINDS.get(look);
    const thrown = kind ? throwableModel(kind, this.setLook) : null;
    if (thrown) return this.thrownProjectile(id, look, thrown);
    if (ARSENAL_LOOKS.has(look)) return createArsenalProjectile(this.scene, id, look);
    const node = new TransformNode(`proj_${id}`, this.scene);
    const model = look === "grenade" ? "projectiles/grenade.glb" : null;
    if (model) {
      void this.models.instantiate(model, `${look}_${id}`).then((m) => {
        if (node.isDisposed()) return m.dispose();
        m.parent = node;
      });
    } else if (look === "rocket") {
      const body = CreateCylinder(`rocket_${id}`, { diameter: 0.14, height: 0.6, tessellation: 10 }, this.scene);
      body.rotation.x = Math.PI / 2;
      body.material = solid(this.scene, "rocketMat", "#6e7a5c");
      body.parent = node;
      const tip = CreateSphere(`rocketTip_${id}`, { diameter: 0.15, segments: 6 }, this.scene);
      tip.position.z = 0.3;
      tip.material = solid(this.scene, "rocketTipMat", "#c8342a");
      tip.parent = node;
      const flame = CreateSphere(`rocketFlame_${id}`, { diameter: 0.28, segments: 6 }, this.scene);
      flame.position.z = -0.38;
      flame.scaling.z = 2;
      flame.material = glow(this.scene, "rocketFlameMat", "#ffb347", 1);
      flame.parent = node;
    } else if (look === "mine") {
      const disc = CreateCylinder(`mine_${id}`, { diameter: 0.34, height: 0.09, tessellation: 16 }, this.scene);
      disc.material = solid(this.scene, "mineMat", "#3c4038");
      disc.parent = node;
      void this.models.instantiate("guns/at_mine.glb", `mineModel_${id}`).then((model2) => {
        if (node.isDisposed()) return model2.dispose();
        model2.parent = node;
        disc.setEnabled(false);
      }, () => void 0);
      const light = CreateSphere(`mine_${id}_light`, { diameter: 0.07, segments: 6 }, this.scene);
      light.position.y = 0.1;
      light.material = glow(this.scene, "mineLightMat", "#ff3b3b", 1);
      light.parent = node;
      light.setEnabled(false);
    } else {
      const ball = CreateSphere(`${look}_${id}`, { diameter: look === "orb" ? 0.55 : 0.2, segments: 8 }, this.scene);
      ball.material = glow(this.scene, `${look}Mat`, look === "orb" ? "#9b7dff" : "#7dffb0", 1);
      ball.parent = node;
    }
    for (const m of node.getChildMeshes()) m.isPickable = false;
    return node;
  }
  /**
   * A thrown grenade, in flight and where it lies: its throwable's model (instanced: a bot match throws dozens), the
   * shapes drawn in code until it loads (and if it can't). The sticky grenade keeps its blinking light on top.
   */
  thrownProjectile(id, look, model) {
    const coded = ARSENAL_LOOKS.has(look);
    const node = coded ? createArsenalProjectile(this.scene, id, look) : new TransformNode(`proj_${id}`, this.scene);
    const shapes = node.getChildMeshes().filter((m) => !m.name.endsWith("_light"));
    void this.models.instantiate(model, `thrown_${id}`, true).then(
      (m) => {
        if (node.isDisposed()) return m.dispose();
        const size = m.getHierarchyBoundingVectors(true);
        const longest = Math.max(size.max.x - size.min.x, size.max.y - size.min.y, size.max.z - size.min.z);
        if (!(longest > 0.05 && longest < 5)) return m.dispose();
        m.parent = node;
        if (model === AMMO_BOX_MODEL) m.scaling.setAll(AMMO_BOX_KIT_SCALE);
        if (look === "sheep") m.position.y = THROWABLE_DEFS.sheep.view?.fit / 2;
        for (const s of shapes) s.setEnabled(false);
        const light = node.getChildMeshes().find((c) => c.name.endsWith("_light"));
        if (light) {
          const b = m.getHierarchyBoundingVectors(true);
          light.position.y = (b.max.y - b.min.y) / 2 + 0.01;
        }
      },
      () => void 0
    );
    for (const m of node.getChildMeshes()) m.isPickable = false;
    return node;
  }
  /** How many grenades in flight or lying are drawn with their throwable's model (tests). */
  thrownModelsDrawn() {
    let n = 0;
    for (const p of this.projectiles.values()) if (p.node.getChildren((c) => c.name.startsWith("thrown_"), true).length) n++;
    return n;
  }
  /** How tall (m) each grenade in flight or lying is drawn by its throwable's model, by its look (tests). */
  thrownModelSizes() {
    const out = [];
    for (const p of this.projectiles.values()) {
      const m = p.node.getChildren((c) => c.name.startsWith("thrown_"), true)[0];
      if (!m) continue;
      for (const c of m.getChildMeshes()) if (c.skeleton) c.refreshBoundingInfo({ applySkeleton: true, applyMorph: false });
      const b = m.getHierarchyBoundingVectors(true);
      out.push({ look: PROJECTILE_VISUALS[p.look] ?? "?", tall: +(b.max.y - b.min.y).toFixed(3) });
    }
    return out;
  }
  /**
   * A thrown spear, in flight and stuck where it lands: the Spear's own model (instanced: spears-only matches throw
   * dozens), its tip where the plain shapes' tip is (a little ahead of the point the sim moves); the shapes until it loads.
   */
  spearProjectile(id) {
    const node = createArsenalProjectile(this.scene, id, "spear");
    const shapes = node.getChildMeshes();
    void this.models.instantiate(getWeapon("core.spear").view.model, `spearModel_${id}`, true).then((model) => {
      if (node.isDisposed()) return model.dispose();
      const tip = model.getHierarchyBoundingVectors(true).max.z;
      model.parent = node;
      model.position.z = SPEAR_TIP_AHEAD - tip;
      for (const m of shapes) m.setEnabled(false);
    }, () => void 0);
    return node;
  }
  /** How many thrown spears are drawn with their model (tests). */
  spearModelsDrawn() {
    let n = 0;
    for (const p of this.projectiles.values()) if (p.node.getChildren((c) => c.name.startsWith("spearModel_"), true).length) n++;
    return n;
  }
  /**
   * How strongly a blast at `at` shows (0..1): 1, or with flashing reduced less the nearer it is to the camera (a blast
   * filling the view is the full-screen flash the setting caps; reduceFlashing.ts blastStrength).
   */
  blastStrength(at, radius) {
    if (!reduceFlashing()) return 1;
    const cam = this.camera.globalPosition;
    return blastStrength(Math.hypot(cam.x - at.x, cam.y - at.y, cam.z - at.z), radius);
  }
  /** The Binbun explosion for a blast (content/vfx.json map.explosions: by weapon, its projectile, the kind), sized to its radius. */
  blastFx(at, radius, weapon, kind, minScale) {
    const airborne = kind !== "vehicle" && !this.physics?.raycast({ x: at.x, y: at.y + 0.2, z: at.z }, { x: 0, y: -1, z: 0 }, 2.2);
    const fx = explosionFor(weapon, airborne ? "air" : kind, (id) => CORE_WEAPONS[id]);
    const y = airborne ? at.y : at.y - 0.3;
    const calm = reduceFlashing() ? { gain: this.blastStrength(at, radius), fadeIn: BLAST_FADE_IN } : {};
    return this.vfx.play(fx.pack, fx.effect, new Vector3(at.x, y, at.z), { scale: Math.max(minScale, radius * fx.scale), ...calm });
  }
  explosion(at, radius, weapon) {
    if (this.blastFx(at, radius, weapon, null, 0.5)) return;
    const ball = CreateSphere("boom", { diameter: 1, segments: 12 }, this.scene);
    const mat2 = glow(this.scene, "boomMat", "#ffb347", 1);
    ball.material = mat2;
    ball.position.set(at.x, at.y, at.z);
    ball.isPickable = false;
    const strength = this.blastStrength(at, radius);
    const rise = strength < 1 || reduceFlashing() ? 0.3 : 0;
    this.effects.push({
      mesh: ball,
      born: performance.now(),
      ttl: 380,
      update: (f) => {
        ball.scaling.setAll(radius * 2 * (0.3 + 0.7 * Math.sqrt(f)));
        mat2.alpha = 0.85 * strength * (1 - f) * (rise ? Math.min(1, f / rise) : 1);
      }
    });
  }
  /**
   * A vehicle blowing up, in layers: a white-hot flash, a fireball that
   * swells past the blast radius with smaller balls of flame bursting round
   * it, a shockwave ring racing out along the ground, a spray of sparks,
   * charred chunks thrown out on the effects physics, and a column of black
   * smoke. Nearby cameras shake (the caller does that and the sound).
   */
  vehicleExplosion(at, radius) {
    const now = performance.now();
    this.blastFx(at, radius, void 0, "vehicle", 0.8);
    const calm = reduceFlashing();
    const strength = this.blastStrength(at, radius);
    const ball = (name, hex, centre, size, delay, ttl, a0) => {
      const alpha = a0 * strength;
      const mesh = CreateSphere(name, { diameter: 1, segments: 10 }, this.scene);
      const mat2 = glow(this.scene, `${name}Mat`, hex, 1);
      mesh.material = mat2;
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
          mat2.alpha = alpha * (1 - f) * (1 - f * 0.3) * (calm ? Math.min(1, f / 0.25) : 1);
        }
      });
    };
    if (!calm) ball("boomFlash", "#fff4c8", at, radius * 1.1, 0, 160, 1);
    ball("boomCore", "#ffb347", at, radius * 1.6, 20, 650, 0.9);
    ball("boomOuter", "#e8541c", at, radius * 2.1, 60, 900, 0.55);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + Math.random();
      const d = radius * (0.35 + Math.random() * 0.4);
      ball("boomBurst", i % 2 ? "#ff8a2a" : "#ffcf5a", { x: at.x + Math.cos(a) * d, y: at.y + Math.random() * radius * 0.5, z: at.z + Math.sin(a) * d }, radius * (0.6 + Math.random() * 0.4), 80 + i * 55, 520, 0.85);
    }
    const ring = CreateTorus("boomRing", { diameter: 1, thickness: 0.06, tessellation: 40 }, this.scene);
    const ringMat = glow(this.scene, "boomRingMat", "#fff1d6", 1);
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
        ringMat.alpha = 0.7 * strength * (1 - f);
      }
    });
    this.impacts.sparkBurst(at, 40, 9);
    vehicleDebris(radius).forEach((b, i) => this.debris(at, i ? "#6b2a12" : "#26221f", b.size, b.count, b.speed));
    for (let i = 0; i < 10; i++) {
      const p = { x: at.x + (Math.random() - 0.5) * radius, y: at.y + Math.random() * radius * 0.6, z: at.z + (Math.random() - 0.5) * radius };
      this.impacts.puff(p, i % 3 ? "#1b1917" : "#3a3633", radius * (0.5 + Math.random() * 0.4), 2.2 + Math.random() * 1.5, 1.6 + Math.random());
    }
  }
  // Camera shake: kicks add up (to 1) and settle over SHAKE_MS.
  shakeAmount = 0;
  shakeAt = 0;
  /** Shake the camera (0..1; explosions and crashes near you). */
  shake(amount) {
    this.shakeAmount = Math.min(1, this.currentShake() + amount);
    this.shakeAt = performance.now();
  }
  currentShake() {
    return this.shakeAmount * Math.max(0, 1 - (performance.now() - this.shakeAt) / SHAKE_MS);
  }
  /** Chunks flying out of a broken crate, barrel or wall: real little bodies that bounce and settle (falls back to a canned arc without physics). */
  debris(at, color2, size, count = 10, speed = 1) {
    for (const c of debrisBurst(at, size, count, speed)) {
      const s = c.size;
      const chunk = CreateBox("debris", { size: s }, this.scene);
      chunk.material = solid(this.scene, "debrisMat", color2);
      chunk.isPickable = false;
      const v = new Vector3(c.vel.x, c.vel.y, c.vel.z);
      const spin = new Vector3(c.spin.x, c.spin.y, c.spin.z);
      if (this.physics) {
        const p = this.physics.clearOfGround(at, c.start, s / 2);
        const body = this.physics.addBody({ kind: "box", half: { x: s / 2, y: s / 2, z: s / 2 } }, p, { x: 0, y: 0, z: 0, w: 1 }, "debris", { vel: v, spin, density: 0.6 });
        chunk.position.set(p.x, p.y, p.z);
        this.debrisBodies.push({ mesh: chunk, body, born: performance.now() });
        continue;
      }
      const start = new Vector3(c.start.x, c.start.y, c.start.z);
      this.effects.push({
        mesh: chunk,
        born: performance.now(),
        ttl: 900,
        update: (f) => {
          const t = f * 0.9;
          chunk.position.set(start.x + v.x * t, Math.max(0.05 + at.y - size, start.y + v.y * t - 10 * t * t), start.z + v.z * t);
          chunk.rotation.set(spin.x * t, spin.y * t, spin.z * t);
          chunk.scaling.setAll(f > 0.7 ? (1 - f) / 0.3 : 1);
        }
      });
    }
  }
  /**
   * A pane of glass shattering: flat, see-through shards spread over the
   * pane's whole face (not from one point), falling mostly straight down with
   * a little outward burst, and a glint of sparkle. One shared material.
   */
  glassShards(box, tint) {
    const h = box.half;
    const thin = h.z <= h.x && h.z <= h.y ? "z" : h.x <= h.y ? "x" : "y";
    const [ua, va] = thin === "z" ? ["x", "y"] : thin === "x" ? ["z", "y"] : ["x", "z"];
    const area = h[ua] * h[va] * 4;
    const count = Math.round(Math.min(16, 6 + area * 3));
    const q = box.rot ? new Quaternion(box.rot.x, box.rot.y, box.rot.z, box.rot.w) : Quaternion.RotationYawPitchRoll(box.yaw, 0, 0);
    const axis = (k) => new Vector3(k === "x" ? 1 : 0, k === "y" ? 1 : 0, k === "z" ? 1 : 0).rotateByQuaternionToRef(q, new Vector3());
    const U = axis(ua);
    const V = axis(va);
    const N = axis(thin);
    const mat2 = this.scene.getMaterialByName(`glassShardMat_${tint}`) ?? glassShardMaterial(this.scene, tint);
    const centre = new Vector3(box.center.x, box.center.y, box.center.z);
    for (let k = 0; k < count; k++) {
      const w = 0.08 + Math.random() * Math.min(0.3, h[ua] * 0.35);
      const l = 0.06 + Math.random() * Math.min(0.26, h[va] * 0.4);
      const shard = CreateBox("glassShard", { width: w, height: l, depth: 0.012 }, this.scene);
      shard.material = mat2;
      shard.isPickable = false;
      const start = centre.add(U.scale((Math.random() * 2 - 1) * h[ua] * 0.9)).add(V.scale((Math.random() * 2 - 1) * h[va] * 0.9));
      const out = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 1.4);
      const v = N.scale(out).add(new Vector3((Math.random() - 0.5) * 0.8, Math.random() * 1.2, (Math.random() - 0.5) * 0.8));
      const spin = new Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      const rot = q.multiply(Quaternion.RotationYawPitchRoll(Math.random() * 0.6, Math.random() * 0.6, Math.random() * Math.PI));
      shard.rotationQuaternion = rot;
      shard.position.copyFrom(start);
      if (this.physics) {
        const body = this.physics.addBody({ kind: "box", half: { x: w / 2, y: l / 2, z: 6e-3 } }, start, { x: rot.x, y: rot.y, z: rot.z, w: rot.w }, "debris", { vel: v, spin, density: 2.5 });
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
        }
      });
    }
    this.impacts.sparkBurst(box.center, 6, 2);
  }
  /** Screen position (CSS px) of a world point, or null when it is behind the camera. */
  project(p) {
    const engine = this.scene.getEngine();
    const w = engine.getRenderWidth();
    const h = engine.getRenderHeight();
    const v = Vector3.Project(new Vector3(p.x, p.y, p.z), Matrix.IdentityReadOnly, this.scene.getTransformMatrix(), this.camera.viewport.toGlobal(w, h));
    if (v.z < 0 || v.z > 1) return null;
    const canvas = engine.getRenderingCanvas();
    const scale = canvas ? canvas.clientWidth / w : 1;
    return { x: v.x * scale, y: v.y * scale };
  }
  mountNodes = /* @__PURE__ */ new Map();
  /**
   * Turrets, sentries and vehicles at their smoothed poses; turret guns follow the aim. `manned` (the turret you are
   * gunning) is drawn too: you stand behind it and look along its gun, which turns with your own view (not the
   * smoothed aim the match sends back, which would trail your crosshair); ducked below its top it is left out.
   */
  updateMounts(mounts, manned = null) {
    let cockpit = null;
    for (const m of mounts) {
      let node = this.mountNodes.get(m.index);
      if (!node) {
        node = createMountNode(this.scene, this.models, m.model, `mount_${m.index}`, m.tint);
        this.mountNodes.set(m.index, node);
      }
      const now = performance.now();
      const fade = m.wreckGoneAt ? (now - m.wreckGoneAt) / (MOUNT_WRECK_FADE_SECONDS * 1e3) : 1;
      const shown = m.alive || m.wreck || fade < 1;
      const ducked = m.index === manned && this.steadyEye.pos.y - m.shown.pos.y < m.def.half[1] * 2 + 0.03;
      node.setEnabled(shown && !ducked);
      node.position.set(m.shown.pos.x, m.shown.pos.y, m.shown.pos.z);
      this.charMount(m.index, node, !m.alive && shown, m.alive ? 1 : m.wreck ? 1 : Math.max(0, 1 - fade));
      this.mountDamageFx(m, now);
      if (m.alive && m.def.vehicle && this.liquids.length) this.wake(m, now);
      node.rotation.y = m.shown.yaw;
      if (m.def.kind === "vehicle" && m.alive && !m.def.airplane) this.suspend(m, node);
      else if (!m.alive && shown) {
        node.rotation.x = 0.05;
        node.rotation.z = 0.07;
        node.position.y -= 0.15 + (m.wreck ? 0 : Math.min(1, fade) * 0.9);
      }
      this.cullCockpit(m.index, node, m.index === this.cockpit && m.alive);
      if (m.index === this.cockpit && m.alive && shown && m.index !== manned) cockpit = { m, node };
      if (m.def.kind !== "vehicle") {
        const gun = mountGun(node);
        if (gun) {
          let rel = m.shown.aimYaw - m.shown.yaw;
          const seat2 = m.index === manned && m.alive ? m.def.seats[0] : void 0;
          if (seat2) {
            const arc = seat2.arc ?? Math.PI;
            const own = this.steadyEye.yaw - m.shown.yaw;
            rel = Math.max(-arc, Math.min(arc, Math.atan2(Math.sin(own), Math.cos(own))));
          }
          gun.rotation.y = rel;
          const [ox, , oz] = seat2?.offset ?? [0, 0, 0];
          gun.position.set(ox - (ox * Math.cos(rel) + oz * Math.sin(rel)), 0, oz - (-ox * Math.sin(rel) + oz * Math.cos(rel)));
        }
      } else if (m.def.turret && m.alive) this.turnTurret(m, node);
      if (m.def.glow) this.arcSentryGlow(m, node, now);
    }
    let drive = null;
    if (cockpit) {
      const { m } = cockpit;
      drive = { steer: this.sprung.get(m.index)?.steer ?? 0, speed: m.vel.x * Math.sin(m.shown.yaw) + m.vel.z * Math.cos(m.shown.yaw) };
    }
    this.cockpitInterior.update(cockpit?.m.index ?? null, cockpit?.node ?? null, cockpit?.m.def ?? null, drive);
  }
  /**
   * A point of a mount (`offset` in its frame: +X right, +Y up, +Z forward) where its model is drawn this frame: its
   * shown pose with the suspension's height, pitch and roll (call after updateMounts). Null: not drawn yet.
   */
  seatPoint(mount, offset) {
    const node = this.mountNodes.get(mount);
    if (!node) return null;
    const m = node.computeWorldMatrix(true).m;
    const [x, y, z] = offset;
    return { x: x * m[0] + y * m[4] + z * m[8] + m[12], y: x * m[1] + y * m[5] + z * m[9] + m[13], z: x * m[2] + y * m[6] + z * m[10] + m[14] };
  }
  /** Each turning-gun vehicle's drawn turret yaw and barrel pitch (radians, in the vehicle's frame), by mount index. */
  turretAims = /* @__PURE__ */ new Map();
  /**
   * A vehicle that turns its own gun (MountDef.turret, the Tank): the turret follows its seat's aim about the upright,
   * within the seat's arc, and the barrel its pitch within `turret.pitch`; with nobody in that seat both ease back to
   * straight ahead. Eased (TURRET_TURN rad/s), so snapshot steps don't jerk it.
   */
  turnTurret(m, node) {
    const parts = mountTurret(node);
    if (!parts) return;
    const spec = m.def.turret;
    const seat2 = m.def.seats[spec.seat];
    const gunner = (m.seats[spec.seat] ?? -1) >= 0;
    const byDriver = !gunner && !!seat2?.driverFires && m.def.seats.some((s, i) => s.role === "driver" && (m.seats[i] ?? -1) >= 0);
    const manned = gunner || byDriver;
    const arc = (byDriver ? seat2?.driverArc ?? seat2?.arc : seat2?.arc) ?? Math.PI;
    const rel = Math.atan2(Math.sin(m.shown.aimYaw - m.shown.yaw - (seat2?.facing ?? 0)), Math.cos(m.shown.aimYaw - m.shown.yaw - (seat2?.facing ?? 0)));
    const [lo, hi] = spec.pitch ?? [-0.5, 0.75];
    const want = manned ? { yaw: (seat2?.facing ?? 0) + Math.max(-arc, Math.min(arc, rel)), pitch: Math.max(lo, Math.min(hi, m.shown.aimPitch)) } : { yaw: 0, pitch: 0 };
    let aim = this.turretAims.get(m.index);
    if (!aim) this.turretAims.set(m.index, aim = { ...want });
    const now = performance.now();
    const dt = Math.min(0.1, (now - (this.turretAt.get(m.index) ?? now)) / 1e3);
    this.turretAt.set(m.index, now);
    const step = TURRET_TURN * dt;
    const turn = Math.atan2(Math.sin(want.yaw - aim.yaw), Math.cos(want.yaw - aim.yaw));
    aim.yaw += Math.max(-step, Math.min(step, turn));
    aim.pitch += Math.max(-step, Math.min(step, want.pitch - aim.pitch));
    parts.turret.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), -aim.yaw);
    if (parts.barrel) parts.barrel.rotationQuaternion = Quaternion.RotationAxis(Vector3.Right(), -aim.pitch);
  }
  turretAt = /* @__PURE__ */ new Map();
  /** Arc sentries' charge orbs (over the gun, where their arc starts), by mount index: the plain sphere stands in when the pack's ball can't play. */
  chargeOrbs = /* @__PURE__ */ new Map();
  /** Arc sentries' balls of lightning (Electric FX, content/vfx.json map.lasting `charge.<mount>`) and their drawn size, by mount index. */
  chargeBalls = /* @__PURE__ */ new Map();
  /**
   * An arc sentry's tell: its body glows brighter through a wind-up and a ball of its colour grows over the gun
   * (where the arc will start), then both hold, flickering, while the arc is locked on. Idle: a faint glow, no ball.
   * Reduce flashing: no flicker, and the plain ball of light instead of the pack's crackling one.
   */
  arcSentryGlow(m, node, now) {
    const glow2 = m.def.glow;
    const windUp = (m.def.sentry?.arc?.windUpSeconds ?? 0.75) * 1e3;
    const calm = reduceFlashing();
    const flicker = calm ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.045);
    const charge = m.alive && m.charging ? Math.min(1, (now - m.charging) / windUp) : 0;
    const level = !m.alive ? 0 : m.arcing ? 0.8 + 0.2 * flicker : charge ? charge * (0.75 + 0.25 * flicker) : 0;
    setMountGlow(node, glow2, level);
    let orb = this.chargeOrbs.get(m.index);
    if (!orb) {
      orb = CreateSphere(`charge_${m.index}`, { diameter: 1, segments: 8 }, this.scene);
      const mat2 = new StandardMaterial(`charge_${m.index}`, this.scene);
      mat2.disableLighting = true;
      mat2.emissiveColor = Color3.FromHexString(glow2);
      mat2.alpha = 0.75;
      orb.material = mat2;
      orb.isPickable = false;
      this.chargeOrbs.set(m.index, orb);
    }
    const size = m.arcing ? 0.3 + 0.08 * flicker : charge ? 0.08 + 0.32 * charge : 0;
    const shown = size > 0 && node.isEnabled();
    const at = new Vector3(m.shown.pos.x, m.shown.pos.y + m.def.half[1] * 2 + 0.2, m.shown.pos.z);
    let ball = this.chargeBalls.get(m.index);
    if (!ball) this.chargeBalls.set(m.index, ball = { fx: null, size: 0 });
    const ref = calm ? null : lastingFx(`charge.${m.def.id}`);
    if (shown && ref && (!ball.fx || ball.fx.done)) ball.fx = this.vfx.start(ref.pack, ref.effect, at, { scale: size * ref.scale });
    else if ((!shown || !ref) && ball.fx) {
      ball.fx.stop();
      ball.fx = null;
    }
    if (ref) ball.fx?.move(at, { scale: size * ref.scale });
    ball.size = shown ? size : 0;
    orb.setEnabled(shown);
    orb.material.alpha = ball.fx ? 0.35 : 0.75;
    if (size > 0) {
      orb.scaling.setAll(size);
      orb.position.copyFrom(at);
    }
  }
  /** What starting each lasting effect costs (tools/perf/perf96.mjs): each started at `at` and stopped at once, in ms. */
  lastingProbe(at) {
    const out = {};
    for (const key of lastingKeys()) {
      const ref = lastingFx(key);
      const t0 = performance.now();
      const h = this.vfx.start(ref.pack, ref.effect, new Vector3(at.x, at.y, at.z), { scale: ref.scale });
      out[`lasting ${key}`] = Math.round((performance.now() - t0) * 10) / 10;
      h?.stop();
    }
    return out;
  }
  /** An arc sentry's charge orb as drawn now (tests): its size (0: hidden), or null (not an arc sentry). */
  chargeOrb(index) {
    const ball = this.chargeBalls.get(index);
    return ball ? ball.size : null;
  }
  /** The ridden vehicle's in-house cockpit (content/cockpits.ts), drawn only in your cockpit view. */
  cockpitInteriorRef = null;
  get cockpitInterior() {
    return this.cockpitInteriorRef ??= new CockpitInterior(this.scene);
  }
  /** Whether a vehicle's cockpit interior is drawn now (tests: shown in the cockpit view, never in the chase view). */
  cockpitInteriorShown() {
    return this.cockpitInteriorRef?.isShown() ?? false;
  }
  /** The cockpit drawn now (tests): triangles, the steering wheel's turn (radians), needle readings, body cut. */
  cockpitInteriorState() {
    return this.cockpitInteriorRef?.state() ?? null;
  }
  /** The vehicle you are looking out of in the cockpit view (its inner faces are culled), or null. */
  cockpit = null;
  culled = /* @__PURE__ */ new Map();
  cullMats = /* @__PURE__ */ new Map();
  /** Set (or clear) the vehicle the cockpit view looks out of; applied with the next updateMounts. */
  setCockpit(index) {
    this.cockpit = index;
  }
  /**
   * Most vehicle models are drawn double-sided, so from a seat inside a closed
   * body you would look at the inside of its roof and doors. In the cockpit
   * the ridden vehicle gets one-sided copies of its materials (shared per
   * source material): the hood, bonnet and frame in front of you still show,
   * the shell around your head doesn't. Put back when you leave the cockpit.
   */
  cullCockpit(index, node, on) {
    const done = this.culled.get(index);
    if (!on) {
      if (!done) return;
      for (const { mesh, mat: mat2 } of done) mesh.material = mat2;
      this.culled.delete(index);
      return;
    }
    if (done) return;
    const meshes = node.getChildMeshes().filter((mesh) => !("sourceMesh" in mesh) && mesh.material);
    if (!meshes.length) return;
    const list = meshes.map((mesh) => ({ mesh, mat: mesh.material }));
    for (const { mesh, mat: mat2 } of list) {
      if (!mat2 || mat2.backFaceCulling) continue;
      let one = this.cullMats.get(mat2);
      if (!one) {
        one = mat2.clone(`${mat2.name}_cockpit`) ?? mat2;
        one.backFaceCulling = true;
        this.cullMats.set(mat2, one);
      }
      mesh.material = one;
    }
    this.culled.set(index, list);
  }
  /** A vehicle's drawn tilt (its model's rotation.x, + nose down, and rotation.z), for the cockpit camera. */
  mountTilt(index) {
    const node = this.mountNodes.get(index);
    return node ? { pitch: node.rotation.x, roll: node.rotation.z } : { pitch: 0, roll: 0 };
  }
  /** A point in a mount's own frame (+Z forward), where its model is drawn now (tilt and springs included). */
  mountPoint(index, local) {
    const node = this.mountNodes.get(index);
    if (!node) return null;
    const p = Vector3.TransformCoordinates(new Vector3(local[0], local[1], local[2]), node.computeWorldMatrix(true));
    return { x: p.x, y: p.y, z: p.z };
  }
  /** Each charred mount's meshes and the materials they had (put back when it respawns). */
  charred = /* @__PURE__ */ new Map();
  charMats = /* @__PURE__ */ new Map();
  /**
   * Burn a wreck black: every mesh swaps to a darkened copy of its material
   * (shared per source material, so other vehicles of the model keep their
   * paint), and `visibility` fades it out. Undone when the mount is back.
   */
  charMount(index, node, on, visibility) {
    const done = this.charred.get(index);
    if (!on) {
      if (!done) return;
      for (const { mesh, mat: mat2 } of done) {
        mesh.material = mat2;
        mesh.visibility = 1;
      }
      this.charred.delete(index);
      return;
    }
    let list = done;
    if (!list) {
      const meshes = node.getChildMeshes().filter((mesh) => !("sourceMesh" in mesh));
      if (!meshes.length) return;
      list = meshes.map((mesh) => ({ mesh, mat: mesh.material }));
      for (const { mesh, mat: mat2 } of list) {
        if (!mat2) continue;
        let dark = this.charMats.get(mat2);
        if (!dark) {
          dark = mat2.clone(`${mat2.name}_charred`) ?? mat2;
          const d = dark;
          d.albedoColor?.scaleInPlace(0.12);
          d.diffuseColor?.scaleInPlace(0.12);
          d.emissiveColor?.scaleInPlace(0);
          if (d.roughness !== void 0) d.roughness = 1;
          this.charMats.set(mat2, dark);
        }
        mesh.material = dark;
      }
      this.charred.set(index, list);
    }
    for (const { mesh } of list) mesh.visibility = visibility;
  }
  mountFxAt = /* @__PURE__ */ new Map();
  wakeAt = /* @__PURE__ */ new Map();
  /**
   * A vehicle moving at the surface of water or swamp (riding on it, or
   * wading through the shallows) throws white spray off its stern and
   * sides, more the faster it goes. Drawing only.
   */
  wake(m, now) {
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
    const at = (along, side) => ({ x: p.x + f.x * along + r.x * side, y: top + 0.05, z: p.z + f.z * along + r.z * side });
    this.impacts.puff(at(-hz * 0.95, (Math.random() - 0.5) * hx), "#e4f0ee", 0.5 + k * 0.9, 0.7, 0.6);
    const s = Math.random() < 0.5 ? -1 : 1;
    this.impacts.puff(at(hz * (0.2 + Math.random() * 0.5), s * hx * 1.05), "#f4faf9", 0.35 + k * 0.5, 0.45, 1.2);
    this.wakeAt.set(m.index, now + 110 - k * 60);
  }
  /**
   * Damage you can read from across the map: light grey smoke under 60%
   * health, thick black smoke and sparks under 35%, flames under 15% (or set
   * alight); the wreck smoulders black. Drawing only.
   */
  mountDamageFx(m, now) {
    const state = m.wreck ? "wreck" : m.alive ? mountDamageState(m.health / 100, m.burning) : "gone";
    if (state === "intact" || state === "gone") return;
    const [hx, hy, hz] = m.def.half;
    const p = m.shown.pos;
    let fire = false;
    if (state === "burning" || state === "wreck") {
      const id = `mount:${m.index}`;
      this.lasting.want(id, state === "burning" ? "fire.vehicle" : "fire.wreck", { x: p.x, y: p.y + hy * 2 - 0.25, z: p.z }, { size: Math.max(0.8, Math.min(2.2, (hx + hz) * 0.6)) });
      fire = this.lasting.drawn(id);
    }
    let smoke = false;
    if (state === "heavy" || state === "burning" || state === "wreck") {
      const id = `mountSmoke:${m.index}`;
      this.lasting.want(id, "smoke.wreck", { x: p.x, y: p.y + hy * 2, z: p.z }, { size: Math.max(0.8, Math.min(2.2, (hx + hz) * 0.6)) });
      smoke = this.lasting.drawn(id);
    }
    if ((this.mountFxAt.get(m.index) ?? 0) > now) return;
    const spot = (spread) => ({ x: p.x + (Math.random() - 0.5) * hx * spread, y: p.y + hy * 2 - 0.1, z: p.z + (Math.random() - 0.5) * hz * spread });
    const size = Math.max(0.8, Math.min(2, (hx + hz) * 0.5));
    if (state === "smoking") {
      this.impacts.puff(spot(0.8), "#8c8884", size * 0.8, 1.8, 1.6);
      this.mountFxAt.set(m.index, now + 240);
    } else if (state === "heavy") {
      if (!smoke) this.impacts.puff(spot(0.9), "#2a2725", size * 1.2, 2.2, 2);
      if (Math.random() < 0.3) this.impacts.sparkBurst(spot(1.4), 6, 2.5);
      this.mountFxAt.set(m.index, now + 120);
    } else if (state === "burning") {
      if (!fire) {
        this.impacts.puff(spot(1.1), "#ff7a1a", size * 0.7, 0.45, 1.8, true);
        this.impacts.puff(spot(0.8), Math.random() < 0.5 ? "#ffb347" : "#e8541c", size * 0.5, 0.35, 2.2, true);
      }
      if (!smoke) this.impacts.puff(spot(0.9), "#151312", size * 1.5, 2.6, 2.4);
      if (Math.random() < 0.35) this.impacts.sparkBurst(spot(1.2), 8, 3);
      this.mountFxAt.set(m.index, now + 70);
    } else {
      if (!smoke) this.impacts.puff(spot(0.7), "#151312", size * 1.4, 3.2, 2.2);
      if (!fire && Math.random() < 0.4) this.impacts.puff(spot(1), "#ff6a14", size * 0.4, 0.4, 1.2, true);
      this.mountFxAt.set(m.index, now + 160);
    }
  }
  /** Per vehicle: drawn tilt, landing bounce and the last pose (to read speed, acceleration and turning). */
  suspension = /* @__PURE__ */ new Map();
  /**
   * Visual suspension: the body settles to the slope under its wheels (or
   * pads), squats when it accelerates and dives when it brakes, leans out of
   * turns, and bounces on its springs when it lands. Drawing only; the
   * simulation's collision box stays level.
   */
  suspend(m, node) {
    if (m.susp) {
      this.suspendSprung(m, node);
      return;
    }
    this.sprung.delete(m.index);
    const now = performance.now();
    const p = m.shown.pos;
    let st = this.suspension.get(m.index);
    if (!st) this.suspension.set(m.index, st = { pitch: 0, roll: 0, bounce: 0, bounceVel: 0, pos: { ...p }, yaw: m.shown.yaw, speed: 0, accel: 0, t: now, air: false });
    const dt = Math.min(0.1, Math.max(1e-3, (now - st.t) / 1e3));
    const fwd = { x: Math.sin(m.shown.yaw), z: Math.cos(m.shown.yaw) };
    const speed = m.vel.x * fwd.x + m.vel.z * fwd.z;
    st.accel += ((speed - st.speed) / dt - st.accel) * Math.min(1, dt * 4);
    const accel = st.accel;
    const yawRate = m.spin;
    const fell = -m.vel.y;
    const [hx, , hz] = m.def.half;
    const side = { x: Math.cos(m.shown.yaw), z: -Math.sin(m.shown.yaw) };
    const groundAt = (f, r) => {
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
    const hover = !!m.def.vehicle?.hover;
    const fly = !!m.def.vehicle?.fly;
    pitch += Math.max(-0.08, Math.min(0.08, -accel * 6e-3));
    if (fly) pitch += Math.max(-0.25, Math.min(0.25, -m.vel.y * 0.04));
    const bank = fly ? 0.3 : 0.12;
    roll += Math.max(-bank, Math.min(bank, yawRate * speed * (hover ? fly ? -0.012 : -6e-3 : 4e-3)));
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
  sprung = /* @__PURE__ */ new Map();
  /**
   * The body as the simulation's raycast suspension holds it (snapshot `ms`: height, pitch, roll, steering and each
   * wheel's spring), eased toward the latest values like the pose is (nothing here reads frame-to-frame movement).
   */
  suspendSprung(m, node) {
    const now = performance.now();
    const want = m.susp;
    let st = this.sprung.get(m.index);
    if (!st) this.sprung.set(m.index, st = { h: want.h, p: want.p, r: want.r, steer: want.steer, wheel: [...want.wheel], t: now });
    const dt = Math.min(0.1, Math.max(1e-3, (now - st.t) / 1e3));
    st.t = now;
    const k = Math.min(1, dt * 18);
    st.h += (want.h - st.h) * k;
    st.p += (want.p - st.p) * k;
    st.r += (want.r - st.r) * k;
    st.steer += (want.steer - st.steer) * k;
    want.wheel.forEach((w, i) => st.wheel[i] = (st.wheel[i] ?? w) + (w - (st.wheel[i] ?? w)) * k);
    node.rotation.x = -st.p;
    node.rotation.z = -st.r;
    node.position.y += st.h;
    this.turnWheels(m, node, dt, st);
  }
  /** Each wheel's roll angle (radians) per vehicle. */
  wheelRoll = /* @__PURE__ */ new Map();
  /**
   * Drawn wheels (MountDef.wheels, or a model's own on a vehicle with suspension): they roll with the vehicle's
   * speed (its tick-based velocity), the front ones steer, and each rides its spring (the body's height and tilt
   * are on the parent already, so a wheel's offset is along the body's up).
   */
  turnWheels(m, node, dt, st) {
    const wheels = wheelsOf(node);
    if (!wheels.length) return;
    const setup = suspensionOf(m.def);
    const radius = m.def.wheels?.radius ?? setup?.hubY ?? m.def.wheels?.at[0]?.[1] ?? 0.4;
    const speed = m.vel.x * Math.sin(m.shown.yaw) + m.vel.z * Math.cos(m.shown.yaw);
    const roll = ((this.wheelRoll.get(m.index) ?? 0) + speed * dt / radius) % (Math.PI * 2);
    this.wheelRoll.set(m.index, roll);
    const lock = setup?.steer ?? 0;
    for (const w of wheels) {
      w.pivot.rotation.x = roll;
      w.pivot.rotation.y = w.front && st ? st.steer * lock : 0;
      w.pivot.position.y = w.rest + (st && w.slot >= 0 ? st.wheel[w.slot] ?? 0 : 0);
    }
  }
  /** Ground hazards and fields from the latest snapshot. */
  updateZones(zones, now) {
    this.zoneVisuals.apply(zones, now);
    this.smoke = this.zoneVisuals.smokeClouds();
  }
  /** The smoke clouds drawn now (smoke grenades): enemy markers behind one aren't drawn; inside one, grey fog. */
  smoke = [];
  /** How deep in smoke your eye is, eased (0 clear, 1 thick): the fog follows it, so it never jumps. */
  smokeFog = 0;
  smokeFogAt = 0;
  smokeDryFog = null;
  /**
   * Inside a smoke cloud you see a couple of metres (the match's sight checks let a body SMOKE.opaque m off show):
   * the scene's fog turns a steady mid grey and thickens as your eye goes deeper, eased in and out over about two
   * thirds of a second. No flash, no white-out and no flicker. Under water, the water's fog wins.
   */
  updateSmokeFog() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - (this.smokeFogAt || now)) / 1e3);
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
    if (this.smokeFog < 5e-3) {
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
    const sky = this.scene.getMaterialByName("backdrop_skyMat");
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
  smokeSky = null;
  /** The sky back as it was, out of the smoke. */
  smokeSkyBack() {
    const s = this.smokeSky;
    if (!s) return;
    this.smokeSky = null;
    if (s.mat.reflectionTexture) s.mat.reflectionTexture.level = s.level;
    s.mat.emissiveColor = s.glow;
  }
  /** Whether smoke hides a point from your eye (tests, and enemy markers). */
  smokeHides(at) {
    if (!this.smoke.length) return false;
    const e = this.camera.position;
    return smokeBlocks({ x: e.x, y: e.y, z: e.z }, at, this.smoke);
  }
  /** A solid beam (lasers, rails, freeze rays) that thins away. */
  addBeam(from, to, color2, width = 0.05, ttlMs = 110) {
    const mesh = createBeam(this.scene, from, to, color2, width);
    this.effects.push({
      mesh,
      born: performance.now(),
      ttl: ttlMs,
      update: (f) => {
        mesh.scaling.x = mesh.scaling.z = 1 - f * 0.8;
      }
    });
  }
  /** Where the last rope (a grapple's) started when it was first drawn, world, and whether that was a gun's muzzle (tests). */
  lastRope = null;
  /**
   * A grapple's rope from a gun's muzzle to the hook, kept on the muzzle as it moves (you're pulled in along it).
   * `from` gives the muzzle each frame (null while no gun is drawn: then `fallback`, where the shot left).
   */
  addRope(from, fallback, to, color2, width, ttlMs) {
    const mesh = CreateCylinder("rope", { diameter: width, height: 1, tessellation: 6 }, this.scene);
    const mat2 = new StandardMaterial("ropeMat", this.scene);
    mat2.emissiveColor = Color3.FromHexString(color2);
    mat2.diffuseColor = Color3.Black();
    mat2.disableLighting = true;
    mesh.material = mat2;
    mesh.isPickable = false;
    mesh.rotationQuaternion = Quaternion.Identity();
    const b = new Vector3(to.x, to.y, to.z);
    let last = fallback;
    const place2 = () => {
      last = from() ?? last;
      const a = new Vector3(last.x, last.y, last.z);
      const d = b.subtract(a);
      const len2 = Math.max(0.01, d.length());
      mesh.position.copyFrom(a.add(b).scale(0.5));
      mesh.scaling.y = len2;
      Quaternion.FromUnitVectorsToRef(Vector3.Up(), d.scale(1 / len2), mesh.rotationQuaternion);
    };
    const muzzle2 = from();
    place2();
    this.lastRope = { from: { ...last }, muzzle: !!muzzle2 };
    this.effects.push({
      mesh,
      born: performance.now(),
      ttl: ttlMs,
      update: (f) => {
        place2();
        mesh.scaling.x = mesh.scaling.z = 1 - f * 0.6;
      }
    });
  }
  /**
   * Chain lightning through the points it jumped: a bolt of Binbun's Electric FX along each jump, rooted where it
   * lands, and a crackle where the last one lands (content/vfx.json map.arcs, by source: an arc sentry, an electric
   * fence or a gun). Each bolt plays a few times faster than the pack's, to last about as long as the game's gap
   * between arcs. Where the pack can't play (not in yet, or too many effects at once) the plain jagged line does.
   */
  addArc(pts, color2 = "#9fd8ff", source = "default", key) {
    if (reduceFlashing()) {
      const first = pts[0];
      this.steadyArcs.hit(key ?? (source === "fence" && first ? `fence:${Math.round(first.x)},${Math.round(first.z)}` : source), pts, color2);
      return;
    }
    const fx = arcFx(source);
    const plain = [];
    let drawn = 0;
    const cam = this.camera.globalPosition;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const d = new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
      const len2 = d.length();
      const ok = !!fx && len2 > 0.2 && Math.hypot(cam.x - b.x, cam.y - b.y, cam.z - b.z) <= ACCENT_RANGE * 2 && this.vfx.play(fx.zap.pack, fx.zap.effect, new Vector3(b.x, b.y, b.z), {
        scale: fx.zap.scale,
        up: d.scale(1 / Math.max(len2, 1e-3)),
        speed: fx.speed,
        only: ZAP_PARTS,
        stretch: { nodes: ZAP_TUBES, by: len2 / (ZAP_LENGTH * fx.zap.scale) }
      });
      if (ok) drawn++;
      else plain.push([a, b]);
    }
    const end = pts[pts.length - 1];
    if (drawn && fx?.hit && end) this.accent(fx.hit, end);
    for (const seg of plain) {
      this.effects.push({ mesh: createArc(this.scene, seg, color2), born: performance.now(), ttl: 140 });
      this.effects.push({ mesh: createArc(this.scene, seg, "#ffffff"), born: performance.now(), ttl: 70 });
    }
  }
  /** A shot's trail: beam weapons draw beams, everything else tracers. */
  addShot(def, from, to, color2, ttlMs = 90) {
    if (def?.id === "core.railgun") {
      this.addBeam(from, to, def.view.tracer, 0.14, 750);
      this.addBeam(from, to, "#ffffff", 0.04, 220);
    } else if (def?.view.beam) this.addBeam(from, to, def.view.tracer, 0.04, 90);
    else this.addTracer(from, to, color2, ttlMs);
  }
  addTracer(from, to, color2, ttlMs = 90) {
    const mesh = CreateLines("tracer", { points: [new Vector3(from.x, from.y - 0.08, from.z), new Vector3(to.x, to.y, to.z)] }, this.scene);
    mesh.color = Color3.FromHexString(color2);
    mesh.isPickable = false;
    this.effects.push({ mesh, born: performance.now(), ttl: ttlMs });
  }
  /** The engine's draw-call counter (Babylon only resets it per frame when asked: `countDraws`). */
  get drawCounter() {
    return this.scene.getEngine()._drawCalls;
  }
  /** Other players and NPCs drawn as characters (for the performance report). */
  get avatarCount() {
    return this.avatars.size;
  }
  /** Shader programs the engine has built so far (one built mid-match is a first-sight stall; perfRecorder). */
  shaderCount() {
    const fx = this.scene.getEngine()._compiledEffects;
    return fx ? Object.keys(fx).length : 0;
  }
  /** Start counting this frame's draw calls (before `render`), for the performance overlay. */
  countDraws() {
    this.drawCounter?.fetchNewFrame();
  }
  /** What the frame just rendered drew, for the performance overlay (after `countDraws` and `render`). */
  perfCounts() {
    const counter = this.drawCounter;
    counter?.addCount(0, true);
    let characters = 0;
    for (const a of this.avatars.values()) if (a.anim && !a.culled) characters++;
    return { draws: counter?.current ?? 0, meshes: this.scene.getActiveMeshes().length, casters: this.atmosphere.casterCount, characters, effects: this.vfx.count + this.effects.length };
  }
  /** Rooms without lamp light (phones on Low): see render. */
  indoorFill = null;
  render() {
    const now = performance.now();
    const cam = this.scene.activeCamera;
    if (this.propBatches && cam) this.propBatches.update(cam.globalPosition);
    if (this.scenario.lampsDropped && this.hemi && cam) {
      this.indoorFill ??= new IndoorFill(this.hemi, () => {
        const at = cam.globalPosition;
        return !!this.physics?.raycast({ x: at.x, y: at.y + 0.2, z: at.z }, { x: 0, y: 1, z: 0 }, 40);
      });
      this.indoorFill.update(now);
    }
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
  /**
   * The match's weather (map/weather.ts matchWeather: the host's choice, else the map's), fixed while it plays.
   * `quality`: draw it as another graphics setting would (the flicker check draws High's on its Low page).
   */
  setWeather(w, quality) {
    this.weather.set(w, this.weatherSky, this.weatherGround, quality);
  }
  dispose() {
    this.retiring.flush();
    this.weather.dispose();
    setCharacterLodCrowd(false);
    for (const list of this.bodyPool.values()) for (const anim of list) anim.dispose();
    this.bodyPool.clear();
    this.pooled.clear();
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
function instrumentRender(scene) {
  const skin = (t0) => {
    perfProbe.add(SYS.skin, t0);
    perfProbe.n[COUNT.skinned]++;
  };
  scene.onBeforeAnimationsObservable.add(() => void (CharacterAnimator.skinProbe = perfProbe.on ? skin : null), void 0, true);
  scene.onDisposeObservable.addOnce(() => void (CharacterAnimator.skinProbe = null));
  let anim = 0;
  let cull = 0;
  let skin0 = 0;
  let targets = 0;
  let post = 0;
  const on = () => perfProbe.on;
  scene.onBeforeAnimationsObservable.add(() => void (anim = on() ? performance.now() : 0), void 0, true);
  scene.onBeforeRenderObservable.add(() => {
    if (anim && on()) perfProbe.add(SYS.anim, anim);
    anim = 0;
  }, void 0, true);
  scene.onBeforeActiveMeshesEvaluationObservable.add(() => {
    cull = on() ? performance.now() : 0;
    skin0 = perfProbe.sys[SYS.skin];
  }, void 0, true);
  scene.onAfterActiveMeshesEvaluationObservable.add(() => {
    if (!cull || !on()) return;
    perfProbe.add(SYS.cull, cull);
    perfProbe.sys[SYS.cull] -= perfProbe.sys[SYS.skin] - skin0;
    cull = 0;
  }, void 0, true);
  scene.onBeforeRenderTargetsRenderObservable.add(() => void (targets = on() ? performance.now() : 0), void 0, true);
  scene.onAfterRenderTargetsRenderObservable.add(() => {
    if (targets && on()) perfProbe.add(SYS.shadow, targets);
    targets = 0;
  }, void 0, true);
  scene.onAfterDrawPhaseObservable.add(() => void (post = on() ? performance.now() : 0), void 0, true);
  scene.onAfterCameraRenderObservable.add(() => {
    if (post && on()) perfProbe.add(SYS.post, post);
    post = 0;
  }, void 0, true);
}
function solid(scene, name, hex) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = new Color3(0.1, 0.1, 0.1);
  return m;
}
function glow(scene, name, hex, strength = 1) {
  const m = solid(scene, name, hex);
  m.emissiveColor = Color3.FromHexString(hex).scale(strength);
  return m;
}
function glassShardMaterial(scene, tint) {
  const m = new StandardMaterial(`glassShardMat_${tint}`, scene);
  m.diffuseColor = Color3.FromHexString(tint);
  m.emissiveColor = Color3.FromHexString(tint).scale(0.15);
  m.specularColor = new Color3(1, 1, 1);
  m.specularPower = 200;
  m.alpha = 0.55;
  m.backFaceCulling = false;
  return m;
}
export {
  BLOOD_PREF_KEY as B,
  COUNT as C,
  DEFAULT_FOV as D,
  FirstPersonBodyRig as F,
  GameView as G,
  SYS as S,
  fitFirstPersonArms as a,
  perfProbe as b,
  createViewCamera as c,
  COUNT_NAMES as d,
  impactStyle as e,
  fitFirstPersonBody as f,
  BODIES_PREF_KEY as g,
  BULLET_SPEED as h,
  impactSoundId as i,
  statusColor as j,
  poseCamera as p,
  slotColor as s
};
