const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/kernelBlur.fragment-C3vNR08K.js","assets/babylon-PnzH6wcM.js","assets/kernelBlurVaryingDeclaration-CsqcxP6P.js","assets/packingFunctions-BWnUrIa6.js","assets/kernelBlur.vertex-CbUxmsC3.js","assets/kernelBlur.fragment-D-AShHhQ.js","assets/kernelBlurVaryingDeclaration-oKLbhvFM.js","assets/packingFunctions-BMJqx468.js","assets/kernelBlur.vertex-DwUKVFP5.js","assets/shadowMap.fragment-DtVzk-T2.js","assets/clipPlaneFragment-BbExy4ec.js","assets/shadowMap.vertex-Dxf0en-t.js","assets/bonesVertex-Cpn2iSQy.js","assets/instancesVertex-23t-Q1Uk.js","assets/morphTargetsVertex-73_uAtmG.js","assets/helperFunctions-vFx73x84.js","assets/sceneUboDeclaration-CzhdE5li.js","assets/meshUboDeclaration-w24jovMr.js","assets/clipPlaneVertex-CtRrEuj6.js","assets/depthBoxBlur.fragment-DUnPpd7N.js","assets/shadowMapFragmentSoftTransparentShadow-bS-Q02FW.js","assets/shadowMap.fragment-tIvBebWc.js","assets/clipPlaneFragment-D8NTl-r6.js","assets/shadowMap.vertex-CuLCSojM.js","assets/bakedVertexAnimation-D_Sv770W.js","assets/morphTargetsVertex-ChAeSZCm.js","assets/helperFunctions-Cbwc0-4F.js","assets/sceneVertexDeclaration-CNTvPUi6.js","assets/sceneUboDeclaration-CFURaA3t.js","assets/meshUboDeclaration-DahcYBU-.js","assets/clipPlaneVertex-BdoNWmEf.js","assets/depthBoxBlur.fragment-BzLBGIJR.js","assets/shadowMapFragmentSoftTransparentShadow-hRc-8vU8.js"])))=>i.map(i=>d[i]);
import { N as NC } from "./rapier-BmnBVapV.js";
import { G as boxQuat, g as getProp, e as envModelFile, K as propTilts, d as groundNormal } from "./settle-BDJE4VMF.js";
import { P as PLAYER, aI as hypot, W as terrainHeightAt, aD as versioned, aL as GLB } from "./index-BAsW2uYW.js";
import { RegisterThinInstanceMesh } from "./thinInstanceMesh.pure-BG4P9X5v.js";
import { T as TransformNode, a as Color3, Q as Quaternion, V as Vector3, bX as LoadAssetContainerAsync, h as Mesh, i as VertexData, j as VertexBuffer, ab as EffectWrapper, a9 as __vitePreload, I as EngineStore, G as Texture, a8 as __runInitializers, y as SerializationHelper, ah as PostProcess, a7 as __esDecorate, bY as serializeAsVector2, bm as serialize, z as RegisterClass, aI as SceneComponentConstants, O as Observable, M as Matrix, bZ as RegisterRenderTargetTexture, aH as RenderTargetTexture, b_ as FloatingOriginCurrentScene, C as Color4, b$ as RenderingManager, a0 as Vector2, bo as DrawWrapper, ax as Light, l as TmpVectors, s as BindBonesParameters, x as BindMorphTargetParameters, t as BindClipPlane, r as BindSceneUniformBuffer, E as EffectFallbacks, o as PrepareDefinesAndAttributesForMorphTargets, p as PrepareStringDefinesForClipPlanes, n as PushAttributesForInstances, A as AddClipPlaneUniforms, c0 as GetFullOffsetViewProjectionToRef, X as _WarnImport } from "./babylon-PnzH6wcM.js";
import { k as kitModelFile } from "./scenarioDefs-BcDISE-R.js";
import { c as ENV_WIND_KIND } from "./envMaterials-BVmVluEo.js";
import { A as AddParser } from "./babylonFileParser.function-CbkFZ5Hm.js";
const simProfile = {
  on: false,
  /** Milliseconds per section, summed since reset(). */
  ms: /* @__PURE__ */ new Map(),
  /** Calls per counter, summed since reset(). */
  n: /* @__PURE__ */ new Map(),
  reset() {
    this.ms.clear();
    this.n.clear();
  },
  add(key, ms) {
    this.ms.set(key, (this.ms.get(key) ?? 0) + ms);
  },
  count(key, by = 1) {
    this.n.set(key, (this.n.get(key) ?? 0) + by);
  }
};
function envColliderDesc(sh) {
  if (sh.kind === "capsule") {
    const d = { x: sh.b[0] - sh.a[0], y: sh.b[1] - sh.a[1], z: sh.b[2] - sh.a[2] };
    const len = Math.hypot(d.x, d.y, d.z);
    const c = { x: (sh.a[0] + sh.b[0]) / 2, y: (sh.a[1] + sh.b[1]) / 2, z: (sh.a[2] + sh.b[2]) / 2 };
    const desc = NC.ColliderDesc.capsule(Math.max(1e-4, len / 2), sh.r).setTranslation(c.x, c.y, c.z);
    if (len > 1e-6) {
      const ux = d.x / len;
      const uy = d.y / len;
      const uz = d.z / len;
      const w = 1 + uy;
      if (w < 1e-6) desc.setRotation({ x: 1, y: 0, z: 0, w: 0 });
      else {
        const q = { x: uz, y: 0, z: -ux, w };
        const ql = Math.hypot(q.x, q.y, q.z, q.w);
        desc.setRotation({ x: q.x / ql, y: 0, z: q.z / ql, w: q.w / ql });
      }
    }
    return desc;
  }
  if (sh.kind === "hull") return NC.ColliderDesc.convexHull(new Float32Array(sh.points));
  return NC.ColliderDesc.trimesh(new Float32Array(sh.positions), new Uint32Array(sh.indices));
}
let initPromise;
function initPhysics() {
  initPromise ??= NC.init();
  return initPromise;
}
const GROUP_WORLD = 1;
const GROUP_PLAYER = 2;
const GROUP_FIELD = 4;
const GROUP_TERRAIN = 8;
const groups = (membership, filter) => (membership << 16 | filter) >>> 0;
const WORLD_COLLIDER_GROUPS = groups(GROUP_WORLD, 65535);
const TERRAIN_COLLIDER_GROUPS = groups(GROUP_TERRAIN, 65535);
const PLAYER_COLLIDER_GROUPS = groups(GROUP_PLAYER, 65535);
const WORLD_ONLY_QUERY = groups(65535, GROUP_WORLD | GROUP_TERRAIN);
const FIELD_COLLIDER_GROUPS = groups(GROUP_FIELD, 65535);
const GROUP_GLASS = 16;
const GROUP_ARMOR_GLASS = 32;
const GLASS_COLLIDER_GROUPS = groups(GROUP_GLASS, 65535);
const ARMOR_GLASS_COLLIDER_GROUPS = groups(GROUP_ARMOR_GLASS, 65535);
const GROUP_SHOTS_ONLY = 64;
const SHOTS_ONLY_COLLIDER_GROUPS = groups(GROUP_SHOTS_ONLY, 65535);
const MOVE_QUERY = groups(65535, GROUP_WORLD | GROUP_FIELD | GROUP_TERRAIN | GROUP_GLASS | GROUP_ARMOR_GLASS);
const MOVE_NO_TERRAIN_QUERY = groups(65535, GROUP_WORLD | GROUP_FIELD | GROUP_GLASS | GROUP_ARMOR_GLASS);
const SHOT_QUERY = groups(65535, GROUP_WORLD | GROUP_TERRAIN | GROUP_ARMOR_GLASS | GROUP_SHOTS_ONLY);
const SIGHT_QUERY = groups(65535, GROUP_WORLD | GROUP_TERRAIN | GROUP_SHOTS_ONLY);
const GROUND_QUERY = groups(65535, GROUP_WORLD | GROUP_TERRAIN | GROUP_GLASS | GROUP_ARMOR_GLASS);
const DOWN = { x: 0, y: -1, z: 0 };
const MAX_SLOPE_TAN = Math.tan(PLAYER.maxSlopeDegrees * Math.PI / 180);
function mergeBoxes(boxes) {
  const out = [];
  let flat = [];
  for (const b of boxes) (b.yaw || b.pitch || b.roll ? out : flat).push(b);
  const k = (n) => Math.round(n * 1e4);
  for (const axis of [0, 2]) {
    const other = axis === 0 ? 2 : 0;
    const groups2 = /* @__PURE__ */ new Map();
    for (const b of flat) {
      const key = `${k(b.min[1])},${k(b.max[1])},${k(b.min[other])},${k(b.max[other])}`;
      let g = groups2.get(key);
      if (!g) groups2.set(key, g = []);
      g.push(b);
    }
    const merged = [];
    for (const g of groups2.values()) {
      g.sort((a, b) => a.min[axis] - b.min[axis]);
      let cur = null;
      for (const b of g) {
        if (cur && b.min[axis] <= cur.max[axis] + 1e-4) {
          if (b.max[axis] > cur.max[axis]) cur.max[axis] = b.max[axis];
        } else {
          if (cur) merged.push(cur);
          cur = { ...b, min: [...b.min], max: [...b.max] };
        }
      }
      if (cur) merged.push(cur);
    }
    flat = merged;
  }
  return [...out, ...flat];
}
const CAPSULE_HALF_HEIGHT = (PLAYER.height - PLAYER.radius * 2) / 2;
const CONTROLLER_OFFSET = 0.02;
const START_LIFT = CONTROLLER_OFFSET / 2;
class PhysicsWorld {
  world;
  controller;
  /** Set when a movable world collider changed; queries need a broad-phase update first. */
  dirty = false;
  /** The level box behind each static collider (bullets read what it is made of). */
  staticBoxes = /* @__PURE__ */ new Map();
  /**
   * Bumped when a world collider appears, goes, or is switched on or off (a door, a
   * breakable, a built piece): caches of sight lines start over (see SightCache).
   */
  structureVersion = 0;
  /**
   * A collider shots pass through while set (raycastHit and raycastNormal): the vehicle a rider fires from, so
   * rounds leave through its own body. The match sets it around one shot or projectile step and clears it.
   */
  shotSkip = null;
  /** One ray for every cast (queries are synchronous): no allocation per sight line or shot. */
  ray = new NC.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  /** The environment shape behind each environment collider (map/environment.ts): its placement and surface. */
  staticShapes = /* @__PURE__ */ new Map();
  /** `shapes`: the map's environment colliders (map/environment.ts `environmentShapes`), next to its boxes. */
  constructor(boxes, terrain = null, shapes = []) {
    this.world = new NC.World({ x: 0, y: 0, z: 0 });
    if (terrain) this.world.createCollider(NC.ColliderDesc.trimesh(terrain.positions, terrain.indices).setCollisionGroups(TERRAIN_COLLIDER_GROUPS));
    for (const sh of shapes) {
      const desc = envColliderDesc(sh);
      if (!desc) continue;
      desc.setCollisionGroups(sh.blocks === "all" ? WORLD_COLLIDER_GROUPS : SHOTS_ONLY_COLLIDER_GROUPS);
      this.staticShapes.set(this.world.createCollider(desc).handle, { sourceId: sh.sourceId, surface: sh.surface });
    }
    for (const b of mergeBoxes(boxes)) {
      const hx = (b.max[0] - b.min[0]) / 2;
      const hy = (b.max[1] - b.min[1]) / 2;
      const hz = (b.max[2] - b.min[2]) / 2;
      const desc = NC.ColliderDesc.cuboid(hx, hy, hz).setTranslation(b.min[0] + hx, b.min[1] + hy, b.min[2] + hz).setCollisionGroups(WORLD_COLLIDER_GROUPS);
      if (b.pitch || b.roll) desc.setRotation(boxQuat(b.yaw, b.pitch, b.roll));
      else if (b.yaw) desc.setRotation({ x: 0, y: Math.sin(b.yaw / 2), z: 0, w: Math.cos(b.yaw / 2) });
      this.staticBoxes.set(this.world.createCollider(desc).handle, b);
    }
    this.controller = this.world.createCharacterController(CONTROLLER_OFFSET);
    this.controller.enableAutostep(PLAYER.maxStepHeight, 0.15, false);
    this.controller.enableSnapToGround(PLAYER.maxStepHeight);
    this.controller.setMaxSlopeClimbAngle(PLAYER.maxSlopeDegrees * Math.PI / 180);
    this.controller.setApplyImpulsesToDynamicBodies(false);
    this.world.step();
  }
  createPlayerCollider() {
    const desc = NC.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, PLAYER.radius).setCollisionGroups(PLAYER_COLLIDER_GROUPS).setEnabled(false);
    return this.world.createCollider(desc);
  }
  /**
   * A world collider that scenario objects (doors, crates) move, enable and
   * disable. It blocks movement, shots and line of sight like static geometry.
   * `yaw` turns the box about the vertical axis (see viewDirection()).
   * A `field` box (force field) blocks movement only: shots, grenades, line
   * of sight and every other query pass through it.
   */
  createBox(center, half, yaw = 0, rotation, field = false) {
    const desc = NC.ColliderDesc.cuboid(half.x, half.y, half.z).setTranslation(center.x, center.y, center.z).setRotation(rotation ?? { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }).setCollisionGroups(field ? FIELD_COLLIDER_GROUPS : WORLD_COLLIDER_GROUPS);
    this.dirty = true;
    this.structureVersion++;
    return this.world.createCollider(desc);
  }
  /**
   * An environment shape the scenario switches on and off like a box (a breakable log's hull: setBoxEnabled). Not
   * part of the level (shapeAt and the level-only queries don't know it). Null when Rapier can't make it.
   */
  createShape(sh) {
    const desc = envColliderDesc(sh);
    if (!desc) return null;
    desc.setCollisionGroups(sh.blocks === "all" ? WORLD_COLLIDER_GROUPS : SHOTS_ONLY_COLLIDER_GROUPS);
    this.dirty = true;
    this.structureVersion++;
    return this.world.createCollider(desc);
  }
  /**
   * A glass pane (sim/glass.ts): it stops movement and never sight; a
   * `reinforced` pane also stops shots (raycastHit and raycastNormal hit it,
   * raycastWorld and lineOfSight don't).
   */
  createGlassBox(center, half, yaw = 0, reinforced = false, rotation) {
    const desc = NC.ColliderDesc.cuboid(half.x, half.y, half.z).setTranslation(center.x, center.y, center.z).setRotation(rotation ?? { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }).setCollisionGroups(reinforced ? ARMOR_GLASS_COLLIDER_GROUPS : GLASS_COLLIDER_GROUPS);
    this.dirty = true;
    if (reinforced) this.armorGlass++;
    return this.world.createCollider(desc);
  }
  /** How many bulletproof panes the world has (bots only check shot lines when there are some). */
  armorGlass = 0;
  /**
   * True when a shot from a to b isn't stopped by anything static (sight
   * lines go through bulletproof glass; shots don't).
   */
  shotLine(a, b) {
    const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const len = hypot(d.x, d.y, d.z);
    if (len < 1e-6) return true;
    return this.raycastHit(a, { x: d.x / len, y: d.y / len, z: d.z / len }, len) === null;
  }
  moveBox(collider, center) {
    const t = collider.translation();
    if (t.x === center.x && t.y === center.y && t.z === center.z) return;
    collider.setTranslation(center);
    this.dirty = true;
  }
  /** Move and turn a box (vehicles, turning turrets). */
  setBoxPose(collider, center, yaw) {
    collider.setTranslation(center);
    collider.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
    this.dirty = true;
  }
  /** Move and turn a box to any orientation (movers carrying tilted or hinged blocks). */
  setBoxTransform(collider, center, rotation) {
    const t = collider.translation();
    const r = collider.rotation();
    if (t.x === center.x && t.y === center.y && t.z === center.z && r.x === rotation.x && r.y === rotation.y && r.z === rotation.z && r.w === rotation.w) return;
    collider.setTranslation(center);
    collider.setRotation(rotation);
    this.dirty = true;
  }
  /** A probe capsule that carries a vehicle over the ground (it collides with the world only, never players). */
  createVehicleProbe(radius) {
    const halfHeight = Math.max(0.05, 0.5 - radius * 0.2);
    const probe = this.world.createCollider(NC.ColliderDesc.capsule(halfHeight, radius).setCollisionGroups(PLAYER_COLLIDER_GROUPS).setEnabled(false));
    this.probeCenter.set(probe, halfHeight + radius);
    return probe;
  }
  /** How high over its feet each vehicle probe's centre sits (the low probe is no capsule, so it can't be read off the shape). */
  probeCenter = /* @__PURE__ */ new WeakMap();
  /** A vehicle probe's height over its feet (m). */
  probeHeight(probe) {
    return 2 * (this.probeCenter.get(probe) ?? 0);
  }
  /**
   * The low probe for a vehicle whose probe capsule stands taller than its hull (`height`, m): the same round bottom
   * as the capsule of `radius` (so it rides the ground just the same), cut off flat at the hull's top. A vehicle
   * moves with it under a ceiling the capsule's dome would catch on (a deck, a beam, a low roof), as far as the hull
   * itself fits (Match.moveVehicleProbe). Null when the capsule is no taller than the hull.
   */
  createLowVehicleProbe(radius, height) {
    const tall = 2 * (Math.max(0.05, 0.5 - radius * 0.2) + radius);
    if (height >= tall - 0.05) return null;
    const pts = [];
    const c = height / 2;
    pts.push(0, -c, 0);
    const SEG = 24;
    const ring = (y, r) => {
      for (let k = 0; k < SEG; k++) pts.push(Math.cos(k / SEG * Math.PI * 2) * r, y - c, Math.sin(k / SEG * Math.PI * 2) * r);
    };
    for (let i = 1; i <= 10; i++) {
      const a = i / 10 * (Math.PI / 2);
      const y = radius - radius * Math.cos(a);
      if (y >= height) break;
      ring(y, radius * Math.sin(a));
    }
    ring(height, height >= radius ? radius : Math.sqrt(radius * radius - (radius - height) ** 2));
    const desc = NC.ColliderDesc.convexHull(new Float32Array(pts));
    if (!desc) return null;
    const probe = this.world.createCollider(desc.setCollisionGroups(PLAYER_COLLIDER_GROUPS).setEnabled(false));
    this.probeCenter.set(probe, c);
    return probe;
  }
  /**
   * Whether anything a vehicle moves against (level, built pieces, other vehicles, glass, fields; not `body`, its
   * own hull) is in the band from `from` to `to` metres over `feet`, within `radius` of it: a ceiling over the hull
   * that its tall probe would catch on.
   */
  overhead(feet, from, to, radius, body) {
    const half = (to - from) / 2;
    if (half <= 5e-3) return false;
    const shape = new NC.Cylinder(half, Math.max(0.05, radius - 0.03));
    const hit = this.world.intersectionWithShape({ x: feet.x, y: feet.y + from + half, z: feet.z }, { x: 0, y: 0, z: 0, w: 1 }, shape, NC.QueryFilterFlags.EXCLUDE_SENSORS, MOVE_QUERY, body);
    return hit !== null;
  }
  /** Whether a vehicle probe with its base at `feet` overlaps anything it moves against (not its own hull). */
  probeOverlaps(probe, feet, centerY, body) {
    return this.world.intersectionWithShape({ x: feet.x, y: feet.y + centerY, z: feet.z }, probe.rotation(), probe.shape, NC.QueryFilterFlags.EXCLUDE_SENSORS, MOVE_QUERY, body) !== null;
  }
  /**
   * Move a vehicle probe (its base at `feet`) by `delta`, sliding along the
   * world and climbing gentle slopes, ignoring the vehicle's own body.
   *
   * Each move starts `lift` (5 cm) up and asks to come down by as much. Pinched between two contacts it can slide
   * along neither (a doorway or gap narrower than the probe: its jambs; a beam and the floor), the controller moves it
   * nowhere at all, not even down, and the lift stayed: the vehicle rose 5 cm a tick, up the door into its lintel
   * and the roof over it, and stuck there (a Hauler at the top of Midnight Keel's stairs, in the 3 m door under the
   * deck's roof). A move the controller refuses now keeps the vehicle where it was, resting (it still falls when it
   * can: the drop is tried on its own), so it can be driven back out the way it came; and a move that creeps up
   * into something over the probe (the controller lets it, climbing a sill under a lintel) keeps its height.
   * `ground` false (flyers) leaves both out: a flyer climbs its own way out (Match.driveVehicle's climbAssist).
   */
  moveVehicle(probe, body, feet, delta, ground = true) {
    const centerY = this.probeCenter.get(probe) ?? 0;
    const lift = 0.05;
    const skip = (c) => c.handle !== body.handle;
    probe.setTranslation({ x: feet.x, y: feet.y + lift + centerY, z: feet.z });
    this.controller.computeColliderMovement(probe, { x: delta.x, y: delta.y - lift, z: delta.z }, NC.QueryFilterFlags.EXCLUDE_SENSORS, MOVE_QUERY, skip);
    let m = this.controller.computedMovement();
    let grounded = this.controller.computedGrounded();
    let start = lift;
    const want = hypot(delta.x, delta.z);
    const refused = ground && hypot(m.x, m.z) < 1e-4 && m.y > -1e-3 && m.y < lift * 0.5 && (want > 1e-6 || delta.y - lift < -1e-6);
    if (refused) {
      start = 0;
      probe.setTranslation({ x: feet.x, y: feet.y + centerY, z: feet.z });
      this.controller.computeColliderMovement(probe, { x: 0, y: Math.min(0, delta.y), z: 0 }, NC.QueryFilterFlags.EXCLUDE_SENSORS, MOVE_QUERY, skip);
      const down = this.controller.computedMovement();
      m = { x: 0, y: Math.min(0, down.y), z: 0 };
      grounded = m.y > -1e-6 || this.controller.computedGrounded();
    }
    let next = { x: feet.x + m.x, y: feet.y + start + m.y, z: feet.z + m.z };
    if (ground && next.y > feet.y + 1e-4 && this.probeOverlaps(probe, next, centerY, body) && !this.probeOverlaps(probe, feet, centerY, body)) {
      const level = { x: next.x, y: feet.y, z: next.z };
      next = this.probeOverlaps(probe, level, centerY, body) ? { ...feet } : level;
      m = { x: next.x - feet.x, y: 0, z: next.z - feet.z };
    }
    probe.setTranslation({ x: next.x, y: next.y + centerY, z: next.z });
    const got = hypot(m.x, m.z);
    return { feet: next, grounded, blocked: want > 1e-6 ? 1 - got / want : 0 };
  }
  setBoxEnabled(collider, enabled) {
    if (collider.isEnabled() === enabled) return;
    collider.setEnabled(enabled);
    this.dirty = true;
    this.structureVersion++;
  }
  /** Bring scene queries up to date after boxes moved. Cheap when nothing changed. */
  commit() {
    if (!this.dirty) return;
    this.dirty = false;
    const t0 = simProfile.on ? performance.now() : 0;
    const w = this.world;
    if (typeof w.physicsPipeline?.step === "function" && "softBodies" in w) {
      w.physicsPipeline.step(w.gravity, w.integrationParameters, w.islands, w.broadPhase, w.narrowPhase, w.bodies, w.colliders, w.softBodies, w.impulseJoints, w.multibodyJoints, w.ccdSolver);
    } else this.world.step();
    if (simProfile.on) simProfile.add("commit", performance.now() - t0);
  }
  removeCollider(collider) {
    this.world.removeCollider(collider, false);
    this.structureVersion++;
  }
  /**
   * Move a player capsule (feet position) by `delta`, sliding along static
   * geometry. Other players never block movement, which keeps client
   * prediction independent of remote player positions.
   */
  moveCharacter(collider, feet, delta, height = PLAYER.height, radius = PLAYER.radius, ground) {
    if (!simProfile.on) return this.moveCharacterNow(collider, feet, delta, height, radius, ground);
    const t0 = performance.now();
    const r = this.moveCharacterNow(collider, feet, delta, height, radius, ground);
    simProfile.add("move", performance.now() - t0);
    simProfile.count(ground ? "moveCoarse" : "move");
    return r;
  }
  /**
   * With `ground` (a coarse move, for bots on foot in big matches: Match.relaxedMove)
   * the controller leaves the terrain out, the costliest thing it collides with
   * (about four times a move on flat boxes), and the terrain's height function
   * stands in for it: feet are kept on it, stepped down onto it, and slopes too
   * steep to climb stop the move.
   */
  moveCharacterNow(collider, feet, delta, height, radius, ground) {
    const query = ground ? MOVE_NO_TERRAIN_QUERY : MOVE_QUERY;
    const half = Math.max(0.01, (height - radius * 2) / 2);
    const shape = collider.shape;
    if (Math.abs(shape.halfHeight - half) > 1e-4 || Math.abs(shape.radius - radius) > 1e-4) collider.setShape(new NC.Capsule(half, radius));
    const centerY = height / 2;
    const startY = feet.y + START_LIFT;
    collider.setTranslation({ x: feet.x, y: startY + centerY, z: feet.z });
    this.controller.computeColliderMovement(collider, { x: delta.x, y: delta.y - START_LIFT, z: delta.z }, NC.QueryFilterFlags.EXCLUDE_SENSORS, query);
    const m = this.controller.computedMovement();
    let next = { x: feet.x + m.x, y: startY + m.y, z: feet.z + m.z };
    if (!this.headroom(next, height, radius, query) && this.headroom(feet, height, radius, query)) {
      const upright = { x: feet.x, y: next.y, z: feet.z };
      next = this.headroom(upright, height, radius, query) ? upright : { ...feet };
    }
    let grounded = this.controller.computedGrounded();
    let movedY = m.y + START_LIFT;
    const g1 = ground?.(next.x, next.z) ?? null;
    if (ground && g1 !== null) {
      let at = g1;
      const run = hypot(next.x - feet.x, next.z - feet.z);
      const g0 = ground(feet.x, feet.z) ?? g1;
      if (g1 > feet.y + 0.02 && run > 1e-6 && (g1 - g0) / run > MAX_SLOPE_TAN) {
        next = { x: feet.x, y: next.y, z: feet.z };
        at = g0;
      }
      if (next.y < at || !grounded && delta.y <= 0 && next.y - at < PLAYER.maxStepHeight + START_LIFT) {
        movedY += at - next.y;
        next.y = at;
        grounded = true;
      }
    }
    collider.setTranslation({ x: next.x, y: next.y + centerY, z: next.z });
    return { feet: next, grounded, movedY };
  }
  /** Whether a player body `height` tall fits standing at `feet` (room to stand or crouch up). */
  headroom(feet, height, radius = PLAYER.radius, query = MOVE_QUERY) {
    const r = radius - 0.03;
    const half = Math.max(0.01, height / 2 - r);
    const hit = this.world.intersectionWithShape({ x: feet.x, y: feet.y + height / 2 + 0.03, z: feet.z }, { x: 0, y: 0, z: 0, w: 1 }, new NC.Capsule(half, r), void 0, query);
    return !hit;
  }
  /** The level box a static collider was built from (undefined for terrain and scenario bodies). */
  boxAt(handle) {
    return this.staticBoxes.get(handle);
  }
  /** The environment placement and surface behind a collider (undefined for everything else). */
  shapeAt(handle) {
    return this.staticShapes.get(handle);
  }
  /** How many environment colliders the world has (tests, diagnostics). */
  get environmentColliders() {
    return this.staticShapes.size;
  }
  /** Like raycastWorld, but also returns the collider handle that was hit (shots: bulletproof glass stops them too). */
  raycastHit(origin, dir, maxDist) {
    const hit = this.world.castRay(this.rayFrom(origin, dir), maxDist, true, void 0, SHOT_QUERY, this.shotSkip ?? void 0);
    return hit ? { dist: hit.timeOfImpact, handle: hit.collider.handle } : null;
  }
  /** Like raycastHit, plus the surface normal (for bouncing grenades and sticking mines). */
  raycastNormal(origin, dir, maxDist) {
    const hit = this.world.castRayAndGetNormal(this.rayFrom(origin, dir), maxDist, true, void 0, SHOT_QUERY, this.shotSkip ?? void 0);
    return hit ? { dist: hit.timeOfImpact, handle: hit.collider.handle, normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z } } : null;
  }
  /** Distance along a normalised ray to the first static surface, or null within maxDist. */
  raycastWorld(origin, dir, maxDist) {
    const hit = this.world.castRay(this.rayFrom(origin, dir), maxDist, true, void 0, WORLD_ONLY_QUERY);
    return hit ? hit.timeOfImpact : null;
  }
  /**
   * Distance along a normalised ray to the first thing a body walks into or stands on (the level, terrain, glass,
   * force fields: what moves collide with), or null within maxDist. The navigation audit's falls and drop links.
   */
  moveRay(origin, dir, maxDist) {
    if (this.dirty) this.commit();
    const hit = this.world.castRay(this.rayFrom(origin, dir), maxDist, true, void 0, MOVE_QUERY);
    return hit ? hit.timeOfImpact : null;
  }
  /**
   * Straight down from `origin` to the first thing a vehicle stands on (map geometry, terrain, glass, other
   * mounts), leaving out `skip` (the vehicle's own box): the distance, or null within maxDist. Suspension rays.
   */
  groundBelow(origin, maxDist, skip) {
    const hit = this.world.castRay(this.rayFrom(origin, DOWN), maxDist, true, void 0, GROUND_QUERY, skip);
    return hit ? hit.timeOfImpact : null;
  }
  /** The shared ray, set to `origin` and `dir`. */
  rayFrom(origin, dir) {
    const r = this.ray;
    r.origin.x = origin.x;
    r.origin.y = origin.y;
    r.origin.z = origin.z;
    r.dir.x = dir.x;
    r.dir.y = dir.y;
    r.dir.z = dir.z;
    return r;
  }
  /**
   * True when no world collider (level, door, crate, built piece; not `skip`) overlaps the upright box. `levelOnly`:
   * only the level itself counts (its boxes, environment shapes and terrain; not vehicles, doors or built pieces).
   * `yaw` turns the box about the vertical (a vehicle's hull along its heading: bots/vehicles.ts hullFits).
   */
  boxClear(center, half, skip, levelOnly = false, yaw = 0) {
    if (this.dirty) this.commit();
    const shape = new NC.Cuboid(Math.max(0.01, half.x), Math.max(0.01, half.y), Math.max(0.01, half.z));
    const level = levelOnly ? (c) => this.staticBoxes.has(c.handle) || this.staticShapes.has(c.handle) || c.collisionGroups() >>> 16 === GROUP_TERRAIN : void 0;
    const rot = yaw ? { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) } : { x: 0, y: 0, z: 0, w: 1 };
    return !this.world.intersectionWithShape(center, rot, shape, void 0, WORLD_ONLY_QUERY, skip, void 0, level);
  }
  /** True when nothing static blocks the segment a -> b. */
  lineOfSight(a, b) {
    if (!simProfile.on) return this.lineOfSightNow(a, b);
    const t0 = performance.now();
    const r = this.lineOfSightNow(a, b);
    simProfile.add("los", performance.now() - t0);
    simProfile.count("los");
    return r;
  }
  lineOfSightNow(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-6) return true;
    const r = this.ray;
    r.origin.x = a.x;
    r.origin.y = a.y;
    r.origin.z = a.z;
    r.dir.x = dx / len;
    r.dir.y = dy / len;
    r.dir.z = dz / len;
    return !this.world.castRay(r, len, true, void 0, SIGHT_QUERY);
  }
  free() {
    this.world.free();
  }
}
RegisterThinInstanceMesh();
function createPropNode(scene, models, e, name, frozen = true, instanced = false, terrain = null, batches = null, indoor = false) {
  const root = new TransformNode(name, scene);
  root.position.set(e.position[0], e.position[1], e.position[2]);
  root.scaling.setAll(e.scale);
  orientProp(root, e, terrain);
  const def = getProp(e.model);
  if (!def) return root;
  const small = isSmallProp(def.size, !!def.collision, e.scale);
  const file = kitModelFile(e.model, e.variant) ?? envModelFile(e.model, e.variant) ?? def.file;
  const batched = batches && frozen && !def.breakable ? batches.add(file, root, small, e.tint ?? null, indoor) : Promise.resolve(false);
  const model = batched.then((ok) => ok ? null : instanced && !e.tint ? models.instantiateStatic(file, `${name}_model`) : models.instantiate(file, `${name}_model`, false));
  void model.then((node) => {
    if (!node) return;
    if (root.isDisposed()) return node.dispose();
    node.parent = root;
    for (const m of node.getChildMeshes()) {
      if (e.tint && m.material) {
        const mat = m.material.clone(`${m.material.name}_${e.tint}`);
        if (mat && "albedoColor" in mat) mat.albedoColor = (mat.albedoColor ?? Color3.White()).multiply(Color3.FromHexString(e.tint));
        else if (mat && "diffuseColor" in mat) mat.diffuseColor = mat.diffuseColor.multiply(Color3.FromHexString(e.tint));
        if (mat) {
          m.material = mat;
          owned(root).push(mat);
        }
      }
      if (frozen) m.freezeWorldMatrix();
      if (small) m.metadata = { ...m.metadata, smallCaster: true };
      if (indoor) m.metadata = { ...m.metadata, castsNoShadow: true };
    }
  });
  return root;
}
function isSmallProp(size, collides, scale) {
  const h = (size[1] ?? 0) * scale;
  return h < 0.75 || !collides && h < 1.2;
}
const ownMaterials = /* @__PURE__ */ new WeakMap();
function owned(root) {
  let list = ownMaterials.get(root);
  if (!list) ownMaterials.set(root, list = []);
  return list;
}
function disposePropNode(root) {
  const mats = ownMaterials.get(root) ?? [];
  ownMaterials.delete(root);
  root.dispose(false, false);
  for (const m of mats) m.dispose();
}
function orientProp(root, e, terrain) {
  const yaw = Quaternion.RotationAxis(Vector3.Up(), e.yaw);
  const ground = terrain ? terrainHeightAt(terrain, e.position[0], e.position[2]) : null;
  const onGround = ground !== null && Math.abs(e.position[1] - ground) < 0.6;
  const n = terrain && onGround && propTilts(e.model) ? groundNormal(terrain, e.position[0], e.position[2], Math.max(0.4, (getProp(e.model)?.size[0] ?? 1) * e.scale * 0.5)) : null;
  if (n && n.y < 0.9995) {
    const lean = new Quaternion();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), new Vector3(n.x, n.y, n.z), lean);
    root.rotationQuaternion = lean.multiply(yaw);
  } else root.rotationQuaternion = yaw;
}
async function loadEnvModel(scene, file) {
  const container = await LoadAssetContainerAsync(versioned(`${"/"}${file}`), scene, GLB);
  const byLevel = /* @__PURE__ */ new Map();
  for (const m of container.meshes) {
    if (!(m instanceof Mesh) || !m.getTotalVertices()) continue;
    const extras = m.metadata?.gltf?.extras ?? m.parent?.metadata?.gltf?.extras;
    const lod = extras?.lod ?? 0;
    let level = byLevel.get(lod);
    if (!level) byLevel.set(lod, level = { distance: extras?.distance ?? 0, crossed: !!extras?.crossed, parts: [] });
    m.computeWorldMatrix(true);
    const data = VertexData.ExtractFromMesh(m, true, true);
    data.transform(m.getWorldMatrix());
    const uv2 = m.getVerticesData(VertexBuffer.UV2Kind);
    const material = m.material?.name ?? "env.bark";
    const tex = m.material?.albedoTexture ?? null;
    level.parts.push({ material, data, wind: uv2 ? Float32Array.from(uv2) : null, sideOrientation: m.sideOrientation, texture: tex });
  }
  for (const m of [...container.meshes]) m.dispose(false, false);
  const levels = [...byLevel.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l);
  return { levels, triangles: levels.map((l) => l.parts.reduce((n, p) => n + (p.data.indices?.length ?? 0) / 3, 0)) };
}
function partMesh(scene, name, part, materials) {
  const mesh = new Mesh(name, scene);
  part.data.applyToMesh(mesh, false);
  if (part.wind) mesh.setVerticesData(ENV_WIND_KIND, part.wind, false, 2);
  mesh.sideOrientation = part.sideOrientation;
  mesh.material = materials.get(part.material, part.texture);
  mesh.isPickable = false;
  mesh.setEnabled(false);
  return mesh;
}
class ThinBlurPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(Promise.all([__vitePreload(() => import("./kernelBlur.fragment-C3vNR08K.js"), true ? __vite__mapDeps([0,1,2,3]) : void 0), __vitePreload(() => import("./kernelBlur.vertex-CbUxmsC3.js"), true ? __vite__mapDeps([4,1,2]) : void 0)]));
    } else {
      list.push(Promise.all([__vitePreload(() => import("./kernelBlur.fragment-D-AShHhQ.js"), true ? __vite__mapDeps([5,1,6,7]) : void 0), __vitePreload(() => import("./kernelBlur.vertex-DwUKVFP5.js"), true ? __vite__mapDeps([8,1,6]) : void 0)]));
    }
  }
  /**
   * Constructs a new blur post process
   * @param name Name of the effect
   * @param engine Engine to use to render the effect. If not provided, the last created engine will be used
   * @param direction Direction in which to apply the blur
   * @param kernel Kernel size of the blur
   * @param options Options to configure the effect
   */
  constructor(name, engine = null, direction, kernel, options) {
    const blockCompilationFinal = !!options?.blockCompilation;
    super({
      ...options,
      name,
      engine: engine || EngineStore.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: ThinBlurPostProcess.FragmentUrl,
      uniforms: ThinBlurPostProcess.Uniforms,
      samplers: ThinBlurPostProcess.Samplers,
      vertexUrl: ThinBlurPostProcess.VertexUrl,
      blockCompilation: true
    });
    this._packedFloat = false;
    this._staticDefines = "";
    this.textureWidth = 0;
    this.textureHeight = 0;
    this._staticDefines = options ? Array.isArray(options.defines) ? options.defines.join("\n") : options.defines || "" : "";
    this.options.blockCompilation = blockCompilationFinal;
    if (direction !== void 0) {
      this.direction = direction;
    }
    if (kernel !== void 0) {
      this.kernel = kernel;
    }
  }
  /**
   * Sets the length in pixels of the blur sample region
   */
  set kernel(v) {
    if (this._idealKernel === v) {
      return;
    }
    v = Math.max(v, 1);
    this._idealKernel = v;
    this._kernel = this._nearestBestKernel(v);
    if (!this.options.blockCompilation) {
      this._updateParameters();
    }
  }
  /**
   * Gets the length in pixels of the blur sample region
   */
  get kernel() {
    return this._idealKernel;
  }
  /**
   * Sets whether or not the blur needs to unpack/repack floats
   */
  set packedFloat(v) {
    if (this._packedFloat === v) {
      return;
    }
    this._packedFloat = v;
    if (!this.options.blockCompilation) {
      this._updateParameters();
    }
  }
  /**
   * Gets whether or not the blur is unpacking/repacking floats
   */
  get packedFloat() {
    return this._packedFloat;
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    this._drawWrapper.effect.setFloat2("delta", 1 / this.textureWidth * this.direction.x, 1 / this.textureHeight * this.direction.y);
  }
  /** @internal */
  _updateParameters(onCompiled, onError) {
    const n = this._kernel;
    const centerIndex = (n - 1) / 2;
    let offsets = [];
    let weights = [];
    let totalWeight = 0;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const w = this._gaussianWeight(u * 2 - 1);
      offsets[i] = i - centerIndex;
      weights[i] = w;
      totalWeight += w;
    }
    for (let i = 0; i < weights.length; i++) {
      weights[i] /= totalWeight;
    }
    const linearSamplingWeights = [];
    const linearSamplingOffsets = [];
    const linearSamplingMap = [];
    for (let i = 0; i <= centerIndex; i += 2) {
      const j = Math.min(i + 1, Math.floor(centerIndex));
      const singleCenterSample = i === j;
      if (singleCenterSample) {
        linearSamplingMap.push({ o: offsets[i], w: weights[i] });
      } else {
        const sharedCell = j === centerIndex;
        const weightLinear = weights[i] + weights[j] * (sharedCell ? 0.5 : 1);
        const offsetLinear = offsets[i] + 1 / (1 + weights[i] / weights[j]);
        if (offsetLinear === 0) {
          linearSamplingMap.push({ o: offsets[i], w: weights[i] });
          linearSamplingMap.push({ o: offsets[i + 1], w: weights[i + 1] });
        } else {
          linearSamplingMap.push({ o: offsetLinear, w: weightLinear });
          linearSamplingMap.push({ o: -offsetLinear, w: weightLinear });
        }
      }
    }
    for (let i = 0; i < linearSamplingMap.length; i++) {
      linearSamplingOffsets[i] = linearSamplingMap[i].o;
      linearSamplingWeights[i] = linearSamplingMap[i].w;
    }
    offsets = linearSamplingOffsets;
    weights = linearSamplingWeights;
    const maxVaryingRows = this.options.engine.getCaps().maxVaryingVectors - (this.options.shaderLanguage === 1 ? 1 : 0);
    const freeVaryingVec2 = Math.max(maxVaryingRows, 0) - 1;
    let varyingCount = Math.min(offsets.length, freeVaryingVec2);
    let defines = "";
    defines += this._staticDefines;
    if (this._staticDefines.indexOf("DOF") != -1) {
      defines += `#define CENTER_WEIGHT ${this._glslFloat(weights[varyingCount - 1])}
`;
      varyingCount--;
    }
    for (let i = 0; i < varyingCount; i++) {
      defines += `#define KERNEL_OFFSET${i} ${this._glslFloat(offsets[i])}
`;
      defines += `#define KERNEL_WEIGHT${i} ${this._glslFloat(weights[i])}
`;
    }
    let depCount = 0;
    for (let i = freeVaryingVec2; i < offsets.length; i++) {
      defines += `#define KERNEL_DEP_OFFSET${depCount} ${this._glslFloat(offsets[i])}
`;
      defines += `#define KERNEL_DEP_WEIGHT${depCount} ${this._glslFloat(weights[i])}
`;
      depCount++;
    }
    if (this.packedFloat) {
      defines += `#define PACKEDFLOAT 1`;
    }
    this.options.blockCompilation = false;
    this.updateEffect(defines, null, null, {
      varyingCount,
      depCount
    }, onCompiled, onError);
  }
  /**
   * Best kernels are odd numbers that when divided by 2, their integer part is even, so 5, 9 or 13.
   * Other odd kernels optimize correctly but require proportionally more samples, even kernels are
   * possible but will produce minor visual artifacts. Since each new kernel requires a new shader we
   * want to minimize kernel changes, having gaps between physical kernels is helpful in that regard.
   * The gaps between physical kernels are compensated for in the weighting of the samples
   * @param idealKernel Ideal blur kernel.
   * @returns Nearest best kernel.
   */
  _nearestBestKernel(idealKernel) {
    const v = Math.round(idealKernel);
    for (const k of [v, v - 1, v + 1, v - 2, v + 2]) {
      if (k % 2 !== 0 && Math.floor(k / 2) % 2 === 0 && k > 0) {
        return Math.max(k, 3);
      }
    }
    return Math.max(v, 3);
  }
  /**
   * Calculates the value of a Gaussian distribution with sigma 3 at a given point.
   * @param x The point on the Gaussian distribution to sample.
   * @returns the value of the Gaussian function at x.
   */
  _gaussianWeight(x) {
    const sigma = 1 / 3;
    const denominator = Math.sqrt(2 * Math.PI) * sigma;
    const exponent = -(x * x / (2 * sigma * sigma));
    const weight = 1 / denominator * Math.exp(exponent);
    return weight;
  }
  /**
   * Generates a string that can be used as a floating point number in GLSL.
   * @param x Value to print.
   * @param decimalFigures Number of decimal places to print the number to (excluding trailing 0s).
   * @returns GLSL float string.
   */
  _glslFloat(x, decimalFigures = 8) {
    return x.toFixed(decimalFigures).replace(/0+$/, "");
  }
}
ThinBlurPostProcess.VertexUrl = "kernelBlur";
ThinBlurPostProcess.FragmentUrl = "kernelBlur";
ThinBlurPostProcess.Uniforms = ["delta", "direction"];
ThinBlurPostProcess.Samplers = ["circleOfConfusionSampler"];
let BlurPostProcess = (() => {
  var _a;
  let _classSuper = PostProcess;
  let _instanceExtraInitializers = [];
  let _get_direction_decorators;
  let _set_kernel_decorators;
  let _set_packedFloat_decorators;
  return _a = class BlurPostProcess extends _classSuper {
    /** The direction in which to blur the image. */
    get direction() {
      return this._effectWrapper.direction;
    }
    set direction(value) {
      this._effectWrapper.direction = value;
    }
    /**
     * Sets the length in pixels of the blur sample region
     */
    set kernel(v) {
      this._effectWrapper.kernel = v;
    }
    /**
     * Gets the length in pixels of the blur sample region
     */
    get kernel() {
      return this._effectWrapper.kernel;
    }
    /**
     * Sets whether or not the blur needs to unpack/repack floats
     */
    set packedFloat(v) {
      this._effectWrapper.packedFloat = v;
    }
    /**
     * Gets whether or not the blur is unpacking/repacking floats
     */
    get packedFloat() {
      return this._effectWrapper.packedFloat;
    }
    /**
     * Gets a string identifying the name of the class
     * @returns "BlurPostProcess" string
     */
    getClassName() {
      return "BlurPostProcess";
    }
    /**
     * Creates a new instance BlurPostProcess
     * @param name The name of the effect.
     * @param direction The direction in which to blur the image.
     * @param kernel The size of the kernel to be used when computing the blur. eg. Size of 3 will blur the center pixel by 2 pixels surrounding it.
     * @param options The required width/height ratio to downsize to before computing the render pass. (Use 1.0 for full size)
     * @param camera The camera to apply the render pass to.
     * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
     * @param engine The engine which the post process will be applied. (default: current engine)
     * @param reusable If the post process can be reused on the same frame. (default: false)
     * @param textureType Type of textures used when performing the post process. (default: 0)
     * @param defines
     * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
     * @param textureFormat Format of textures used when performing the post process. (default: TEXTUREFORMAT_RGBA)
     */
    constructor(name, direction, kernel, options, camera = null, samplingMode = Texture.BILINEAR_SAMPLINGMODE, engine, reusable, textureType = 0, defines = "", blockCompilation = false, textureFormat = 5) {
      const blockCompilationFinal = typeof options === "number" ? blockCompilation : !!options.blockCompilation;
      const localOptions = {
        uniforms: ThinBlurPostProcess.Uniforms,
        samplers: ThinBlurPostProcess.Samplers,
        size: typeof options === "number" ? options : void 0,
        camera,
        samplingMode,
        engine,
        reusable,
        textureType,
        vertexUrl: ThinBlurPostProcess.VertexUrl,
        indexParameters: { varyingCount: 0, depCount: 0 },
        textureFormat,
        defines,
        ...options,
        blockCompilation: true
      };
      super(name, ThinBlurPostProcess.FragmentUrl, {
        effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinBlurPostProcess(name, engine, void 0, void 0, localOptions) : void 0,
        ...localOptions
      });
      __runInitializers(this, _instanceExtraInitializers);
      this._effectWrapper.options.blockCompilation = blockCompilationFinal;
      this.direction = direction;
      this.onApplyObservable.add(() => {
        this._effectWrapper.textureWidth = this._outputTexture ? this._outputTexture.width : this.width;
        this._effectWrapper.textureHeight = this._outputTexture ? this._outputTexture.height : this.height;
      });
      this.kernel = kernel;
    }
    /**
     * Updates the effect with the current post process compile time values and recompiles the shader
     * @param _defines the post process defines
     * @param _uniforms the post process uniforms
     * @param _samplers the post process samplers
     * @param _indexParameters the index parameters
     * @param onCompiled callback called when the shader is compiled
     * @param onError callback called if there is an error
     */
    updateEffect(_defines = null, _uniforms = null, _samplers = null, _indexParameters, onCompiled, onError) {
      this._effectWrapper._updateParameters(onCompiled, onError);
    }
    /**
     * @internal
     */
    static _Parse(parsedPostProcess, targetCamera, scene, rootUrl) {
      return SerializationHelper.Parse(() => {
        return new _a(parsedPostProcess.name, parsedPostProcess.direction, parsedPostProcess.kernel, parsedPostProcess.options, targetCamera, parsedPostProcess.renderTargetSamplingMode, scene.getEngine(), parsedPostProcess.reusable, parsedPostProcess.textureType, void 0, false);
      }, parsedPostProcess, scene, rootUrl);
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
    _get_direction_decorators = [serializeAsVector2()];
    _set_kernel_decorators = [serialize()];
    _set_packedFloat_decorators = [serialize()];
    __esDecorate(_a, null, _get_direction_decorators, { kind: "getter", name: "direction", static: false, private: false, access: { has: (obj) => "direction" in obj, get: (obj) => obj.direction }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _set_kernel_decorators, { kind: "setter", name: "kernel", static: false, private: false, access: { has: (obj) => "kernel" in obj, set: (obj, value) => {
      obj.kernel = value;
    } }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _set_packedFloat_decorators, { kind: "setter", name: "packedFloat", static: false, private: false, access: { has: (obj) => "packedFloat" in obj, set: (obj, value) => {
      obj.packedFloat = value;
    } }, metadata: _metadata }, null, _instanceExtraInitializers);
    if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a;
})();
let _Registered$1 = false;
function RegisterBlurPostProcess() {
  if (_Registered$1) {
    return;
  }
  _Registered$1 = true;
  RegisterClass("BABYLON.BlurPostProcess", BlurPostProcess);
}
class ShadowGeneratorSceneComponent {
  /**
   * Creates a new instance of the component for the given scene
   * @param scene Defines the scene to register the component in
   */
  constructor(scene) {
    this.name = SceneComponentConstants.NAME_SHADOWGENERATOR;
    this.scene = scene;
  }
  /**
   * Registers the component in a given scene
   */
  register() {
    this.scene._gatherRenderTargetsStage.registerStep(SceneComponentConstants.STEP_GATHERRENDERTARGETS_SHADOWGENERATOR, this, this._gatherRenderTargets);
  }
  /**
   * Rebuilds the elements related to this component in case of
   * context lost for instance.
   */
  rebuild() {
  }
  /**
   * Serializes the component data to the specified json object
   * @param serializationObject The object to serialize to
   */
  serialize(serializationObject) {
    serializationObject.shadowGenerators = [];
    const lights = this.scene.lights;
    for (const light of lights) {
      if (light.doNotSerialize) {
        continue;
      }
      const shadowGenerators = light.getShadowGenerators();
      if (shadowGenerators) {
        const iterator = shadowGenerators.values();
        for (let key = iterator.next(); key.done !== true; key = iterator.next()) {
          const shadowGenerator = key.value;
          if (shadowGenerator.doNotSerialize) {
            continue;
          }
          serializationObject.shadowGenerators.push(shadowGenerator.serialize());
        }
      }
    }
  }
  /**
   * Adds all the elements from the container to the scene
   * @param container the container holding the elements
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addFromContainer(container) {
  }
  /**
   * Removes all the elements in the container from the scene
   * @param container contains the elements to remove
   * @param dispose if the removed element should be disposed (default: false)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  removeFromContainer(container, dispose) {
  }
  /**
   * Rebuilds the elements related to this component in case of
   * context lost for instance.
   */
  dispose() {
  }
  _gatherRenderTargets(renderTargets) {
    const scene = this.scene;
    if (this.scene.shadowsEnabled) {
      for (let lightIndex = 0; lightIndex < scene.lights.length; lightIndex++) {
        const light = scene.lights[lightIndex];
        const shadowGenerators = light.getShadowGenerators();
        if (light.isEnabled() && light.shadowEnabled && shadowGenerators) {
          const iterator = shadowGenerators.values();
          for (let key = iterator.next(); key.done !== true; key = iterator.next()) {
            const shadowGenerator = key.value;
            const shadowMap = shadowGenerator.getShadowMap();
            if (scene.textures.indexOf(shadowMap) !== -1) {
              renderTargets.push(shadowMap);
            }
          }
        }
      }
    }
  }
}
let _Registered = false;
function RegisterShadowGeneratorSceneComponent(shadowGeneratorClass) {
  if (_Registered) {
    return;
  }
  _Registered = true;
  AddParser(SceneComponentConstants.NAME_SHADOWGENERATOR, (parsedData, scene) => {
    if (parsedData.shadowGenerators !== void 0 && parsedData.shadowGenerators !== null) {
      for (let index = 0, cache = parsedData.shadowGenerators.length; index < cache; index++) {
        const parsedShadowGenerator = parsedData.shadowGenerators[index];
        if (shadowGeneratorClass._CascadedShadowGeneratorParser && parsedShadowGenerator.className === "CascadedShadowGenerator") {
          shadowGeneratorClass._CascadedShadowGeneratorParser(parsedShadowGenerator, scene);
        } else {
          shadowGeneratorClass.Parse(parsedShadowGenerator, scene);
        }
      }
    }
  });
  shadowGeneratorClass._SceneComponentInitialization = (scene) => {
    let component = scene._getComponent(SceneComponentConstants.NAME_SHADOWGENERATOR);
    if (!component) {
      component = new ShadowGeneratorSceneComponent(scene);
      scene._addComponent(component);
    }
  };
}
class ShadowGenerator {
  /**
   * Gets the bias: offset applied on the depth preventing acnea (in light direction).
   */
  get bias() {
    return this._bias;
  }
  /**
   * Sets the bias: offset applied on the depth preventing acnea (in light direction).
   */
  set bias(bias) {
    this._bias = bias;
  }
  /**
   * Gets the normalBias: offset applied on the depth preventing acnea (along side the normal direction and proportional to the light/normal angle).
   */
  get normalBias() {
    return this._normalBias;
  }
  /**
   * Sets the normalBias: offset applied on the depth preventing acnea (along side the normal direction and proportional to the light/normal angle).
   */
  set normalBias(normalBias) {
    this._normalBias = normalBias;
  }
  /**
   * Gets the blur box offset: offset applied during the blur pass.
   * Only useful if useKernelBlur = false
   */
  get blurBoxOffset() {
    return this._blurBoxOffset;
  }
  /**
   * Sets the blur box offset: offset applied during the blur pass.
   * Only useful if useKernelBlur = false
   */
  set blurBoxOffset(value) {
    if (this._blurBoxOffset === value) {
      return;
    }
    this._blurBoxOffset = value;
    this._disposeBlurPostProcesses();
  }
  /**
   * Gets the blur scale: scale of the blurred texture compared to the main shadow map.
   * 2 means half of the size.
   */
  get blurScale() {
    return this._blurScale;
  }
  /**
   * Sets the blur scale: scale of the blurred texture compared to the main shadow map.
   * 2 means half of the size.
   */
  set blurScale(value) {
    if (this._blurScale === value) {
      return;
    }
    this._blurScale = value;
    this._disposeBlurPostProcesses();
  }
  /**
   * Gets the blur kernel: kernel size of the blur pass.
   * Only useful if useKernelBlur = true
   */
  get blurKernel() {
    return this._blurKernel;
  }
  /**
   * Sets the blur kernel: kernel size of the blur pass.
   * Only useful if useKernelBlur = true
   */
  set blurKernel(value) {
    if (this._blurKernel === value) {
      return;
    }
    this._blurKernel = value;
    this._disposeBlurPostProcesses();
  }
  /**
   * Gets whether the blur pass is a kernel blur (if true) or box blur.
   * Only useful in filtered mode (useBlurExponentialShadowMap...)
   */
  get useKernelBlur() {
    return this._useKernelBlur;
  }
  /**
   * Sets whether the blur pass is a kernel blur (if true) or box blur.
   * Only useful in filtered mode (useBlurExponentialShadowMap...)
   */
  set useKernelBlur(value) {
    if (this._useKernelBlur === value) {
      return;
    }
    this._useKernelBlur = value;
    this._disposeBlurPostProcesses();
  }
  /**
   * Gets the depth scale used in ESM mode.
   */
  get depthScale() {
    return this._depthScale !== void 0 ? this._depthScale : this._light.getDepthScale();
  }
  /**
   * Sets the depth scale used in ESM mode.
   * This can override the scale stored on the light.
   */
  set depthScale(value) {
    this._depthScale = value;
  }
  _validateFilter(filter) {
    return filter;
  }
  /**
   * Gets the current mode of the shadow generator (normal, PCF, ESM...).
   * The returned value is a number equal to one of the available mode defined in ShadowMap.FILTER_x like _FILTER_NONE
   */
  get filter() {
    return this._filter;
  }
  /**
   * Sets the current mode of the shadow generator (normal, PCF, ESM...).
   * The returned value is a number equal to one of the available mode defined in ShadowMap.FILTER_x like _FILTER_NONE
   */
  set filter(value) {
    value = this._validateFilter(value);
    if (this._light.needCube()) {
      if (value === ShadowGenerator.FILTER_BLUREXPONENTIALSHADOWMAP) {
        this.useExponentialShadowMap = true;
        return;
      } else if (value === ShadowGenerator.FILTER_BLURCLOSEEXPONENTIALSHADOWMAP) {
        this.useCloseExponentialShadowMap = true;
        return;
      } else if (value === ShadowGenerator.FILTER_PCF || value === ShadowGenerator.FILTER_PCSS) {
        this.usePoissonSampling = true;
        return;
      }
    }
    if (value === ShadowGenerator.FILTER_PCF || value === ShadowGenerator.FILTER_PCSS) {
      if (!this._scene.getEngine()._features.supportShadowSamplers) {
        this.usePoissonSampling = true;
        return;
      }
    }
    if (this._filter === value) {
      return;
    }
    this._filter = value;
    this._disposeBlurPostProcesses();
    this._applyFilterValues();
    this._light._markMeshesAsLightDirty();
  }
  /**
   * Gets if the current filter is set to Poisson Sampling.
   */
  get usePoissonSampling() {
    return this.filter === ShadowGenerator.FILTER_POISSONSAMPLING;
  }
  /**
   * Sets the current filter to Poisson Sampling.
   */
  set usePoissonSampling(value) {
    const filter = this._validateFilter(ShadowGenerator.FILTER_POISSONSAMPLING);
    if (!value && this.filter !== ShadowGenerator.FILTER_POISSONSAMPLING) {
      return;
    }
    this.filter = value ? filter : ShadowGenerator.FILTER_NONE;
  }
  /**
   * Gets if the current filter is set to ESM.
   */
  get useExponentialShadowMap() {
    return this.filter === ShadowGenerator.FILTER_EXPONENTIALSHADOWMAP;
  }
  /**
   * Sets the current filter is to ESM.
   */
  set useExponentialShadowMap(value) {
    const filter = this._validateFilter(ShadowGenerator.FILTER_EXPONENTIALSHADOWMAP);
    if (!value && this.filter !== ShadowGenerator.FILTER_EXPONENTIALSHADOWMAP) {
      return;
    }
    this.filter = value ? filter : ShadowGenerator.FILTER_NONE;
  }
  /**
   * Gets if the current filter is set to filtered ESM.
   */
  get useBlurExponentialShadowMap() {
    return this.filter === ShadowGenerator.FILTER_BLUREXPONENTIALSHADOWMAP;
  }
  /**
   * Gets if the current filter is set to filtered  ESM.
   */
  set useBlurExponentialShadowMap(value) {
    const filter = this._validateFilter(ShadowGenerator.FILTER_BLUREXPONENTIALSHADOWMAP);
    if (!value && this.filter !== ShadowGenerator.FILTER_BLUREXPONENTIALSHADOWMAP) {
      return;
    }
    this.filter = value ? filter : ShadowGenerator.FILTER_NONE;
  }
  /**
   * Gets if the current filter is set to "close ESM" (using the inverse of the
   * exponential to prevent steep falloff artifacts).
   */
  get useCloseExponentialShadowMap() {
    return this.filter === ShadowGenerator.FILTER_CLOSEEXPONENTIALSHADOWMAP;
  }
  /**
   * Sets the current filter to "close ESM" (using the inverse of the
   * exponential to prevent steep falloff artifacts).
   */
  set useCloseExponentialShadowMap(value) {
    const filter = this._validateFilter(ShadowGenerator.FILTER_CLOSEEXPONENTIALSHADOWMAP);
    if (!value && this.filter !== ShadowGenerator.FILTER_CLOSEEXPONENTIALSHADOWMAP) {
      return;
    }
    this.filter = value ? filter : ShadowGenerator.FILTER_NONE;
  }
  /**
   * Gets if the current filter is set to filtered "close ESM" (using the inverse of the
   * exponential to prevent steep falloff artifacts).
   */
  get useBlurCloseExponentialShadowMap() {
    return this.filter === ShadowGenerator.FILTER_BLURCLOSEEXPONENTIALSHADOWMAP;
  }
  /**
   * Sets the current filter to filtered "close ESM" (using the inverse of the
   * exponential to prevent steep falloff artifacts).
   */
  set useBlurCloseExponentialShadowMap(value) {
    const filter = this._validateFilter(ShadowGenerator.FILTER_BLURCLOSEEXPONENTIALSHADOWMAP);
    if (!value && this.filter !== ShadowGenerator.FILTER_BLURCLOSEEXPONENTIALSHADOWMAP) {
      return;
    }
    this.filter = value ? filter : ShadowGenerator.FILTER_NONE;
  }
  /**
   * Gets if the current filter is set to "PCF" (percentage closer filtering).
   */
  get usePercentageCloserFiltering() {
    return this.filter === ShadowGenerator.FILTER_PCF;
  }
  /**
   * Sets the current filter to "PCF" (percentage closer filtering).
   */
  set usePercentageCloserFiltering(value) {
    const filter = this._validateFilter(ShadowGenerator.FILTER_PCF);
    if (!value && this.filter !== ShadowGenerator.FILTER_PCF) {
      return;
    }
    this.filter = value ? filter : ShadowGenerator.FILTER_NONE;
  }
  /**
   * Gets the PCF or PCSS Quality.
   * Only valid if usePercentageCloserFiltering or usePercentageCloserFiltering is true.
   */
  get filteringQuality() {
    return this._filteringQuality;
  }
  /**
   * Sets the PCF or PCSS Quality.
   * Only valid if usePercentageCloserFiltering or usePercentageCloserFiltering is true.
   */
  set filteringQuality(filteringQuality) {
    if (this._filteringQuality === filteringQuality) {
      return;
    }
    this._filteringQuality = filteringQuality;
    this._disposeBlurPostProcesses();
    this._applyFilterValues();
    this._light._markMeshesAsLightDirty();
  }
  /**
   * Gets if the current filter is set to "PCSS" (contact hardening).
   */
  get useContactHardeningShadow() {
    return this.filter === ShadowGenerator.FILTER_PCSS;
  }
  /**
   * Sets the current filter to "PCSS" (contact hardening).
   */
  set useContactHardeningShadow(value) {
    const filter = this._validateFilter(ShadowGenerator.FILTER_PCSS);
    if (!value && this.filter !== ShadowGenerator.FILTER_PCSS) {
      return;
    }
    this.filter = value ? filter : ShadowGenerator.FILTER_NONE;
  }
  /**
   * Gets the Light Size (in shadow map uv unit) used in PCSS to determine the blocker search area and the penumbra size.
   * Using a ratio helps keeping shape stability independently of the map size.
   *
   * It does not account for the light projection as it was having too much
   * instability during the light setup or during light position changes.
   *
   * Only valid if useContactHardeningShadow is true.
   */
  get contactHardeningLightSizeUVRatio() {
    return this._contactHardeningLightSizeUVRatio;
  }
  /**
   * Sets the Light Size (in shadow map uv unit) used in PCSS to determine the blocker search area and the penumbra size.
   * Using a ratio helps keeping shape stability independently of the map size.
   *
   * It does not account for the light projection as it was having too much
   * instability during the light setup or during light position changes.
   *
   * Only valid if useContactHardeningShadow is true.
   */
  set contactHardeningLightSizeUVRatio(contactHardeningLightSizeUVRatio) {
    this._contactHardeningLightSizeUVRatio = contactHardeningLightSizeUVRatio;
  }
  /** Gets or sets the actual darkness of a shadow */
  get darkness() {
    return this._darkness;
  }
  set darkness(value) {
    this.setDarkness(value);
  }
  /**
   * Returns the darkness value (float). This can only decrease the actual darkness of a shadow.
   * 0 means strongest and 1 would means no shadow.
   * @returns the darkness.
   */
  getDarkness() {
    return this._darkness;
  }
  /**
   * Sets the darkness value (float). This can only decrease the actual darkness of a shadow.
   * @param darkness The darkness value 0 means strongest and 1 would means no shadow.
   * @returns the shadow generator allowing fluent coding.
   */
  setDarkness(darkness) {
    if (darkness >= 1) {
      this._darkness = 1;
    } else if (darkness <= 0) {
      this._darkness = 0;
    } else {
      this._darkness = darkness;
    }
    return this;
  }
  /** Gets or sets the ability to have transparent shadow */
  get transparencyShadow() {
    return this._transparencyShadow;
  }
  set transparencyShadow(value) {
    this.setTransparencyShadow(value);
  }
  /**
   * Sets the ability to have transparent shadow (boolean).
   * @param transparent True if transparent else False
   * @returns the shadow generator allowing fluent coding
   */
  setTransparencyShadow(transparent) {
    this._transparencyShadow = transparent;
    return this;
  }
  /**
   * Gets the main RTT containing the shadow map (usually storing depth from the light point of view).
   * @returns The render target texture if present otherwise, null
   */
  getShadowMap() {
    return this._shadowMap;
  }
  /**
   * Gets the RTT used during rendering (can be a blurred version of the shadow map or the shadow map itself).
   * @returns The render target texture if the shadow map is present otherwise, null
   */
  getShadowMapForRendering() {
    if (this._shadowMap2) {
      return this._shadowMap2;
    }
    return this._shadowMap;
  }
  /**
   * Gets the class name of that object
   * @returns "ShadowGenerator"
   */
  getClassName() {
    return ShadowGenerator.CLASSNAME;
  }
  /**
   * Helper function to add a mesh and its descendants to the list of shadow casters.
   * @param mesh Mesh to add
   * @param includeDescendants boolean indicating if the descendants should be added. Default to true
   * @returns the Shadow Generator itself
   */
  addShadowCaster(mesh, includeDescendants = true) {
    if (!this._shadowMap) {
      return this;
    }
    if (!this._shadowMap.renderList) {
      this._shadowMap.renderList = [];
    }
    if (this._shadowMap.renderList.indexOf(mesh) === -1) {
      this._shadowMap.renderList.push(mesh);
    }
    if (includeDescendants) {
      for (const childMesh of mesh.getChildMeshes()) {
        if (this._shadowMap.renderList.indexOf(childMesh) === -1) {
          this._shadowMap.renderList.push(childMesh);
        }
      }
    }
    return this;
  }
  /**
   * Helper function to remove a mesh and its descendants from the list of shadow casters
   * @param mesh Mesh to remove
   * @param includeDescendants boolean indicating if the descendants should be removed. Default to true
   * @returns the Shadow Generator itself
   */
  removeShadowCaster(mesh, includeDescendants = true) {
    if (!this._shadowMap || !this._shadowMap.renderList) {
      return this;
    }
    const index = this._shadowMap.renderList.indexOf(mesh);
    if (index !== -1) {
      this._shadowMap.renderList.splice(index, 1);
    }
    if (includeDescendants) {
      for (const child of mesh.getChildren()) {
        this.removeShadowCaster(child);
      }
    }
    return this;
  }
  /**
   * Returns the associated light object.
   * @returns the light generating the shadow
   */
  getLight() {
    return this._light;
  }
  /**
   * Gets the shader language used in this generator.
   */
  get shaderLanguage() {
    return this._shaderLanguage;
  }
  _getCamera() {
    return this._camera ?? this._scene.activeCamera;
  }
  /**
   * Gets or sets the size of the texture what stores the shadows
   */
  get mapSize() {
    return this._mapSize;
  }
  set mapSize(size) {
    this._mapSize = size;
    this._light._markMeshesAsLightDirty();
    this.recreateShadowMap();
  }
  /**
   * Gets or sets the light that is casting the shadows
   */
  get light() {
    return this._light;
  }
  set light(light) {
    if (this._light === light) {
      return;
    }
    this.dispose(false);
    this._light = light;
    this._createInstance();
  }
  /**
   * Gets or sets a value indicating whether the shadow map should use full float texture type (instead of half float, which is the default).
   * Use this option when you need more precision (for self shadowing, for instance).
   */
  get useFloat32TextureType() {
    return this._usefullFloatFirst;
  }
  set useFloat32TextureType(useFloat32TextureType) {
    if (this._usefullFloatFirst === useFloat32TextureType) {
      return;
    }
    this.dispose(false);
    this._usefullFloatFirst = useFloat32TextureType;
    this._createInstance();
  }
  /**
   * Gets or sets the camera associated with this shadow generator.
   * When null, the scene's active camera is used at render time.
   */
  get camera() {
    return this._camera;
  }
  set camera(camera) {
    if (this._camera === camera) {
      return;
    }
    this.dispose(false);
    this._camera = camera;
    this._createInstance();
  }
  /**
   * Gets or sets a value indicating whether the shadow map should use a red-channel-only texture format.
   * Using a single-channel format reduces memory usage when color data is not needed.
   */
  get useRedTextureFormat() {
    return this._useRedTextureType;
  }
  set useRedTextureFormat(useRedTextureFormat) {
    if (this._useRedTextureType === useRedTextureFormat) {
      return;
    }
    this.dispose(false);
    this._useRedTextureType = useRedTextureFormat;
    this._createInstance();
  }
  /**
   * Creates a ShadowGenerator object.
   * A ShadowGenerator is the required tool to use the shadows.
   * Each light casting shadows needs to use its own ShadowGenerator.
   * Documentation : https://doc.babylonjs.com/features/featuresDeepDive/lights/shadows
   * @param mapSize The size of the texture what stores the shadows. Example : 1024.
   * @param light The light object generating the shadows.
   * @param usefullFloatFirst By default the generator will try to use half float textures but if you need precision (for self shadowing for instance), you can use this option to enforce full float texture.
   * @param camera Camera associated with this shadow generator (default: null). If null, takes the scene active camera at the time we need to access it
   * @param useRedTextureType Forces the generator to use a Red instead of a RGBA type for the shadow map texture format (default: false)
   * @param forceGLSL defines a boolean indicating if the shader must be compiled in GLSL even if we are using WebGPU
   */
  constructor(mapSize, light, usefullFloatFirst, camera, useRedTextureType, forceGLSL = false) {
    this.onBeforeShadowMapRenderObservable = new Observable();
    this.onAfterShadowMapRenderObservable = new Observable();
    this.onBeforeShadowMapRenderMeshObservable = new Observable();
    this.onAfterShadowMapRenderMeshObservable = new Observable();
    this.doNotSerialize = false;
    this._bias = 5e-5;
    this._normalBias = 0;
    this._blurBoxOffset = 1;
    this._blurScale = 2;
    this._blurKernel = 1;
    this._useKernelBlur = false;
    this._filter = ShadowGenerator.FILTER_NONE;
    this._filteringQuality = ShadowGenerator.QUALITY_HIGH;
    this._contactHardeningLightSizeUVRatio = 0.1;
    this._darkness = 0;
    this._transparencyShadow = false;
    this.enableSoftTransparentShadow = false;
    this.useOpacityTextureForTransparentShadow = false;
    this.frustumEdgeFalloff = 0;
    this._shaderLanguage = 0;
    this.forceBackFacesOnly = false;
    this._lightDirection = Vector3.Zero();
    this._viewMatrix = Matrix.Zero();
    this._projectionMatrix = Matrix.Zero();
    this._transformMatrix = Matrix.Zero();
    this._cachedPosition = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    this._cachedDirection = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    this._currentFaceIndex = 0;
    this._currentFaceIndexCache = 0;
    this._defaultTextureMatrix = Matrix.Identity();
    this._shadersLoaded = false;
    this._mapSize = mapSize;
    this._light = light;
    this._usefullFloatFirst = !!usefullFloatFirst;
    this._scene = light.getScene();
    this._camera = camera ?? null;
    this._useRedTextureType = !!useRedTextureType;
    this._forceGLSL = forceGLSL;
    this._createInstance();
  }
  _createInstance() {
    this._initShaderSourceAsync(this._forceGLSL);
    let shadowGenerators = this._light._shadowGenerators;
    if (!shadowGenerators) {
      shadowGenerators = this._light._shadowGenerators = /* @__PURE__ */ new Map();
    }
    shadowGenerators.set(this._camera, this);
    this.id = this._light.id;
    this._useUBO = this._scene.getEngine().supportsUniformBuffers;
    if (this._useUBO) {
      this._sceneUBOs = [this._scene.createSceneUniformBuffer(`Scene for Shadow Generator (light "${this._light.name}")`, { forceMono: true })];
    }
    RegisterShadowGeneratorSceneComponent(ShadowGenerator);
    ShadowGenerator._SceneComponentInitialization(this._scene);
    RegisterRenderTargetTexture();
    const caps = this._scene.getEngine().getCaps();
    if (!this._usefullFloatFirst) {
      if (caps.textureHalfFloatRender && caps.textureHalfFloatLinearFiltering) {
        this._textureType = 2;
      } else if (caps.textureFloatRender && caps.textureFloatLinearFiltering) {
        this._textureType = 1;
      } else {
        this._textureType = 0;
      }
    } else {
      if (caps.textureFloatRender && caps.textureFloatLinearFiltering) {
        this._textureType = 1;
      } else if (caps.textureHalfFloatRender && caps.textureHalfFloatLinearFiltering) {
        this._textureType = 2;
      } else {
        this._textureType = 0;
      }
    }
    this._initializeGenerator();
    this._applyFilterValues();
  }
  _initializeGenerator() {
    this._light._markMeshesAsLightDirty();
    this._initializeShadowMap();
  }
  _createTargetRenderTexture() {
    const engine = this._scene.getEngine();
    this._shadowMap?.dispose();
    if (engine._features.supportDepthStencilTexture) {
      this._shadowMap = new RenderTargetTexture(this._light.name + "_shadowMap", this._mapSize, this._scene, false, true, this._textureType, this._light.needCube(), void 0, false, false, void 0, this._useRedTextureType ? 6 : 5);
      this._shadowMap.createDepthStencilTexture(engine.useReverseDepthBuffer ? 516 : 513, true, void 0, void 0, void 0, `DepthStencilForShadowGenerator-${this._light.name}`);
    } else {
      this._shadowMap = new RenderTargetTexture(this._light.name + "_shadowMap", this._mapSize, this._scene, false, true, this._textureType, this._light.needCube());
    }
    this._shadowMap.noPrePassRenderer = true;
  }
  _initializeShadowMap() {
    this._createTargetRenderTexture();
    if (this._shadowMap === null) {
      return;
    }
    this._shadowMap.wrapU = Texture.CLAMP_ADDRESSMODE;
    this._shadowMap.wrapV = Texture.CLAMP_ADDRESSMODE;
    this._shadowMap.anisotropicFilteringLevel = 1;
    this._shadowMap.updateSamplingMode(Texture.BILINEAR_SAMPLINGMODE);
    this._shadowMap.renderParticles = false;
    this._shadowMap.ignoreCameraViewport = true;
    if (this._storedUniqueId) {
      this._shadowMap.uniqueId = this._storedUniqueId;
    }
    this._shadowMap.customRenderFunction = (opaqueSubMeshes, alphaTestSubMeshes, transparentSubMeshes, depthOnlySubMeshes) => this._renderForShadowMap(opaqueSubMeshes, alphaTestSubMeshes, transparentSubMeshes, depthOnlySubMeshes);
    this._shadowMap.customIsReadyFunction = (mesh, _refreshRate, preWarm) => {
      if (!preWarm || !mesh.subMeshes) {
        return true;
      }
      let isReady = true;
      for (const subMesh of mesh.subMeshes) {
        const renderingMesh = subMesh.getRenderingMesh();
        const scene = this._scene;
        const engine2 = scene.getEngine();
        const material = subMesh.getMaterial();
        if (!material || subMesh.verticesCount === 0 || this.customAllowRendering && !this.customAllowRendering(subMesh)) {
          continue;
        }
        const batch = renderingMesh._getInstancesRenderList(subMesh._id, !!subMesh.getReplacementMesh());
        if (batch.mustReturn) {
          continue;
        }
        const hardwareInstancedRendering = engine2.getCaps().instancedArrays && (batch.visibleInstances[subMesh._id] !== null && batch.visibleInstances[subMesh._id] !== void 0 || renderingMesh.hasThinInstances);
        const isTransparent = material.needAlphaBlendingForMesh(renderingMesh);
        isReady = this.isReady(subMesh, hardwareInstancedRendering, isTransparent) && isReady;
      }
      return isReady;
    };
    const engine = this._scene.getEngine();
    this._shadowMap.onBeforeBindObservable.add(() => {
      this._currentSceneUBO = this._scene.getSceneUniformBuffer();
      if (engine._enableGPUDebugMarkers) {
        engine._debugPushGroup?.(`Shadow map generation for pass id ${engine.currentRenderPassId}`);
      }
    });
    this._shadowMap.onBeforeRenderObservable.add((faceIndex) => {
      if (this._sceneUBOs) {
        this._scene.setSceneUniformBuffer(this._sceneUBOs[0]);
      }
      this._currentFaceIndex = faceIndex;
      if (this._filter === ShadowGenerator.FILTER_PCF) {
        engine.setColorWrite(false);
      }
      this.getTransformMatrix();
      FloatingOriginCurrentScene.eyeAtCamera = false;
      this._scene.setTransformMatrix(this._viewMatrix, this._projectionMatrix);
      if (this._sceneUBOs) {
        this._scene.getSceneUniformBuffer().unbindEffect();
        this._scene.finalizeSceneUbo();
      }
    });
    this._shadowMap.onAfterUnbindObservable.add(() => {
      if (this._sceneUBOs) {
        this._scene.setSceneUniformBuffer(this._currentSceneUBO);
      }
      FloatingOriginCurrentScene.eyeAtCamera = true;
      this._scene.updateTransformMatrix();
      if (this._filter === ShadowGenerator.FILTER_PCF) {
        engine.setColorWrite(true);
      }
      if (!this.useBlurExponentialShadowMap && !this.useBlurCloseExponentialShadowMap) {
        engine._debugPopGroup?.();
        return;
      }
      const shadowMap = this.getShadowMapForRendering();
      if (shadowMap) {
        this._scene.postProcessManager.directRender(this._blurPostProcesses, shadowMap.renderTarget, true);
        engine.unBindFramebuffer(shadowMap.renderTarget, true);
      }
      if (engine._enableGPUDebugMarkers) {
        engine._debugPopGroup?.();
      }
    });
    const clearZero = new Color4(0, 0, 0, 0);
    const clearOne = new Color4(1, 1, 1, 1);
    this._shadowMap.onClearObservable.add((engine2) => {
      if (this._filter === ShadowGenerator.FILTER_PCF) {
        engine2.clear(clearOne, false, true, false);
      } else if (this.useExponentialShadowMap || this.useBlurExponentialShadowMap) {
        engine2.clear(clearZero, true, true, false);
      } else {
        engine2.clear(clearOne, true, true, false);
      }
    });
    this._shadowMap.onResizeObservable.add((rtt) => {
      this._storedUniqueId = this._shadowMap.uniqueId;
      this._mapSize = rtt.getRenderSize();
      this._light._markMeshesAsLightDirty();
      this.recreateShadowMap();
    });
    for (let i = RenderingManager.MIN_RENDERINGGROUPS; i < RenderingManager.MAX_RENDERINGGROUPS; i++) {
      this._shadowMap.setRenderingAutoClearDepthStencil(i, false);
    }
  }
  async _initShaderSourceAsync(forceGLSL = false) {
    const engine = this._scene.getEngine();
    if (engine.isWebGPU && !forceGLSL && !ShadowGenerator.ForceGLSL) {
      this._shaderLanguage = 1;
      await Promise.all([
        __vitePreload(() => import("./shadowMap.fragment-DtVzk-T2.js").then((n) => n.a), true ? __vite__mapDeps([9,1,3,10]) : void 0),
        __vitePreload(() => import("./shadowMap.vertex-Dxf0en-t.js").then((n) => n.a), true ? __vite__mapDeps([11,1,12,13,14,15,16,17,18]) : void 0),
        __vitePreload(() => import("./depthBoxBlur.fragment-DUnPpd7N.js"), true ? __vite__mapDeps([19,1]) : void 0),
        __vitePreload(() => import("./shadowMapFragmentSoftTransparentShadow-bS-Q02FW.js"), true ? __vite__mapDeps([20,1]) : void 0)
      ]);
    } else {
      await Promise.all([
        __vitePreload(() => import("./shadowMap.fragment-tIvBebWc.js").then((n) => n.a), true ? __vite__mapDeps([21,1,7,22]) : void 0),
        __vitePreload(() => import("./shadowMap.vertex-CuLCSojM.js").then((n) => n.a), true ? __vite__mapDeps([23,1,24,25,26,27,28,29,30]) : void 0),
        __vitePreload(() => import("./depthBoxBlur.fragment-BzLBGIJR.js"), true ? __vite__mapDeps([31,1]) : void 0),
        __vitePreload(() => import("./shadowMapFragmentSoftTransparentShadow-hRc-8vU8.js"), true ? __vite__mapDeps([32,1]) : void 0)
      ]);
    }
    this._shadersLoaded = true;
  }
  _initializeBlurRTTAndPostProcesses() {
    const engine = this._scene.getEngine();
    const targetSize = this._mapSize / this.blurScale;
    if (!this.useKernelBlur || this.blurScale !== 1) {
      this._shadowMap2 = new RenderTargetTexture(this._light.name + "_shadowMap2", targetSize, this._scene, false, true, this._textureType, void 0, void 0, false);
      this._shadowMap2.wrapU = Texture.CLAMP_ADDRESSMODE;
      this._shadowMap2.wrapV = Texture.CLAMP_ADDRESSMODE;
      this._shadowMap2.updateSamplingMode(Texture.BILINEAR_SAMPLINGMODE);
    }
    if (this.useKernelBlur) {
      this._kernelBlurXPostprocess = new BlurPostProcess(this._light.name + "KernelBlurX", new Vector2(1, 0), this.blurKernel, 1, null, Texture.BILINEAR_SAMPLINGMODE, engine, false, this._textureType);
      this._kernelBlurXPostprocess.width = targetSize;
      this._kernelBlurXPostprocess.height = targetSize;
      this._kernelBlurXPostprocess.externalTextureSamplerBinding = true;
      this._kernelBlurXPostprocess.onApplyObservable.add((effect) => {
        effect.setTexture("textureSampler", this._shadowMap);
      });
      this._kernelBlurYPostprocess = new BlurPostProcess(this._light.name + "KernelBlurY", new Vector2(0, 1), this.blurKernel, 1, null, Texture.BILINEAR_SAMPLINGMODE, engine, false, this._textureType);
      this._kernelBlurXPostprocess.autoClear = false;
      this._kernelBlurYPostprocess.autoClear = false;
      if (this._textureType === 0) {
        this._kernelBlurXPostprocess.packedFloat = true;
        this._kernelBlurYPostprocess.packedFloat = true;
      }
      this._blurPostProcesses = [this._kernelBlurXPostprocess, this._kernelBlurYPostprocess];
    } else {
      this._boxBlurPostprocess = new PostProcess(this._light.name + "DepthBoxBlur", "depthBoxBlur", ["screenSize", "boxOffset"], [], 1, null, Texture.BILINEAR_SAMPLINGMODE, engine, false, "#define OFFSET " + this._blurBoxOffset, this._textureType, void 0, void 0, void 0, void 0, this._shaderLanguage);
      this._boxBlurPostprocess.externalTextureSamplerBinding = true;
      this._boxBlurPostprocess.onApplyObservable.add((effect) => {
        effect.setFloat2("screenSize", targetSize, targetSize);
        effect.setTexture("textureSampler", this._shadowMap);
      });
      this._boxBlurPostprocess.autoClear = false;
      this._blurPostProcesses = [this._boxBlurPostprocess];
    }
  }
  _renderForShadowMap(opaqueSubMeshes, alphaTestSubMeshes, transparentSubMeshes, depthOnlySubMeshes) {
    let index;
    if (depthOnlySubMeshes.length) {
      for (index = 0; index < depthOnlySubMeshes.length; index++) {
        this._renderSubMeshForShadowMap(depthOnlySubMeshes.data[index]);
      }
    }
    for (index = 0; index < opaqueSubMeshes.length; index++) {
      this._renderSubMeshForShadowMap(opaqueSubMeshes.data[index]);
    }
    for (index = 0; index < alphaTestSubMeshes.length; index++) {
      this._renderSubMeshForShadowMap(alphaTestSubMeshes.data[index]);
    }
    if (this._transparencyShadow) {
      for (index = 0; index < transparentSubMeshes.length; index++) {
        this._renderSubMeshForShadowMap(transparentSubMeshes.data[index], true);
      }
    } else {
      for (index = 0; index < transparentSubMeshes.length; index++) {
        transparentSubMeshes.data[index].getEffectiveMesh()._internalAbstractMeshDataInfo._isActiveIntermediate = false;
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _bindCustomEffectForRenderSubMeshForShadowMap(subMesh, effect, mesh) {
    effect.setMatrix("viewProjection", this.getTransformMatrix());
  }
  _renderSubMeshForShadowMap(subMesh, isTransparent = false) {
    const renderingMesh = subMesh.getRenderingMesh();
    const effectiveMesh = subMesh.getEffectiveMesh();
    const scene = this._scene;
    const engine = scene.getEngine();
    const material = subMesh.getMaterial();
    effectiveMesh._internalAbstractMeshDataInfo._isActiveIntermediate = false;
    if (!material || subMesh.verticesCount === 0 || subMesh._renderId === scene.getRenderId()) {
      return;
    }
    const useRHS = scene.useRightHandedSystem;
    const detNeg = effectiveMesh._getWorldMatrixDeterminant() < 0;
    let sideOrientation = material._getEffectiveOrientation(renderingMesh);
    if (detNeg && !useRHS || !detNeg && useRHS) {
      sideOrientation = sideOrientation === 0 ? 1 : 0;
    }
    const reverseSideOrientation = sideOrientation === 0;
    engine.setState(material.backFaceCulling, void 0, void 0, reverseSideOrientation, material.cullBackFaces);
    const batch = renderingMesh._getInstancesRenderList(subMesh._id, !!subMesh.getReplacementMesh());
    if (batch.mustReturn) {
      return;
    }
    const hardwareInstancedRendering = engine.getCaps().instancedArrays && (batch.visibleInstances[subMesh._id] !== null && batch.visibleInstances[subMesh._id] !== void 0 || renderingMesh.hasThinInstances);
    if (this.customAllowRendering && !this.customAllowRendering(subMesh)) {
      return;
    }
    if (this.isReady(subMesh, hardwareInstancedRendering, isTransparent)) {
      subMesh._renderId = scene.getRenderId();
      const shadowDepthWrapper = material.shadowDepthWrapper;
      const drawWrapper = shadowDepthWrapper?.getEffect(subMesh, this, engine.currentRenderPassId) ?? subMesh._getDrawWrapper();
      const effect = DrawWrapper.GetEffect(drawWrapper);
      engine.enableEffect(drawWrapper);
      if (!hardwareInstancedRendering) {
        renderingMesh._bind(subMesh, effect, material.fillMode);
      }
      this.getTransformMatrix();
      effect.setFloat3("biasAndScaleSM", this.bias, this.normalBias, this.depthScale);
      if (this.getLight().getTypeID() === Light.LIGHTTYPEID_DIRECTIONALLIGHT) {
        effect.setVector3("lightDataSM", this._cachedDirection);
      } else {
        effect.setVector3("lightDataSM", this._cachedPosition.subtractToRef(this._scene.floatingOriginOffset, TmpVectors.Vector3[0]));
      }
      const camera = this._getCamera();
      effect.setFloat2("depthValuesSM", this.getLight().getDepthMinZ(camera), this.getLight().getDepthMinZ(camera) + this.getLight().getDepthMaxZ(camera));
      if (isTransparent && this.enableSoftTransparentShadow) {
        effect.setFloat2("softTransparentShadowSM", effectiveMesh.visibility * material.alpha, this._opacityTexture?.getAlphaFromRGB ? 1 : 0);
      }
      if (shadowDepthWrapper) {
        subMesh._setMainDrawWrapperOverride(drawWrapper);
        if (shadowDepthWrapper.standalone) {
          shadowDepthWrapper.baseMaterial.bindForSubMesh(effectiveMesh.getWorldMatrix(), renderingMesh, subMesh);
        } else {
          material.bindForSubMesh(effectiveMesh.getWorldMatrix(), renderingMesh, subMesh);
        }
        subMesh._setMainDrawWrapperOverride(null);
      } else {
        if (this._opacityTexture) {
          effect.setTexture("diffuseSampler", this._opacityTexture);
          effect.setMatrix("diffuseMatrix", this._opacityTexture.getTextureMatrix() || this._defaultTextureMatrix);
        }
        BindBonesParameters(renderingMesh, effect);
        BindMorphTargetParameters(renderingMesh, effect);
        if (renderingMesh.morphTargetManager && renderingMesh.morphTargetManager.isUsingTextureForTargets) {
          renderingMesh.morphTargetManager._bind(effect);
        }
        const bvaManager = subMesh.getMesh().bakedVertexAnimationManager;
        if (bvaManager && bvaManager.isEnabled) {
          bvaManager.bind(effect, hardwareInstancedRendering);
        }
        BindClipPlane(effect, material, scene);
      }
      if (!this._useUBO && !shadowDepthWrapper) {
        this._bindCustomEffectForRenderSubMeshForShadowMap(subMesh, effect, effectiveMesh);
      }
      BindSceneUniformBuffer(effect, this._scene.getSceneUniformBuffer());
      this._scene.getSceneUniformBuffer().bindUniformBuffer();
      const world = effectiveMesh.getWorldMatrix();
      if (hardwareInstancedRendering) {
        effectiveMesh.getMeshUniformBuffer().bindToEffect(effect, "Mesh");
        effectiveMesh.transferToEffect(world);
      }
      if (this.forceBackFacesOnly) {
        engine.setState(true, 0, false, true, material.cullBackFaces);
      }
      this.onBeforeShadowMapRenderMeshObservable.notifyObservers(renderingMesh);
      this.onBeforeShadowMapRenderObservable.notifyObservers(effect);
      renderingMesh._processRendering(effectiveMesh, subMesh, effect, material.fillMode, batch, hardwareInstancedRendering, (isInstance, worldOverride) => {
        if (effectiveMesh !== renderingMesh && !isInstance) {
          renderingMesh.getMeshUniformBuffer().bindToEffect(effect, "Mesh");
          renderingMesh.transferToEffect(worldOverride);
        } else {
          effectiveMesh.getMeshUniformBuffer().bindToEffect(effect, "Mesh");
          effectiveMesh.transferToEffect(isInstance ? worldOverride : world);
        }
      });
      if (this.forceBackFacesOnly) {
        engine.setState(true, 0, false, false, material.cullBackFaces);
      }
      this.onAfterShadowMapRenderObservable.notifyObservers(effect);
      this.onAfterShadowMapRenderMeshObservable.notifyObservers(renderingMesh);
    } else {
      if (this._shadowMap) {
        this._shadowMap.resetRefreshCounter();
      }
    }
  }
  _applyFilterValues() {
    if (!this._shadowMap) {
      return;
    }
    if (this.filter === ShadowGenerator.FILTER_NONE || this.filter === ShadowGenerator.FILTER_PCSS) {
      this._shadowMap.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
    } else {
      this._shadowMap.updateSamplingMode(Texture.BILINEAR_SAMPLINGMODE);
    }
  }
  /**
   * Forces all the attached effect to compile to enable rendering only once ready vs. lazily compiling effects.
   * @param onCompiled Callback triggered at the and of the effects compilation
   * @param options Sets of optional options forcing the compilation with different modes
   */
  forceCompilation(onCompiled, options) {
    const localOptions = {
      useInstances: false,
      ...options
    };
    const shadowMap = this.getShadowMap();
    if (!shadowMap) {
      if (onCompiled) {
        onCompiled(this);
      }
      return;
    }
    const renderList = shadowMap.renderList;
    if (!renderList) {
      if (onCompiled) {
        onCompiled(this);
      }
      return;
    }
    const subMeshes = [];
    for (const mesh of renderList) {
      subMeshes.push(...mesh.subMeshes);
    }
    if (subMeshes.length === 0) {
      if (onCompiled) {
        onCompiled(this);
      }
      return;
    }
    let currentIndex = 0;
    const checkReady = () => {
      if (!this._scene || !this._scene.getEngine()) {
        return;
      }
      while (this.isReady(subMeshes[currentIndex], localOptions.useInstances, subMeshes[currentIndex].getMaterial()?.needAlphaBlendingForMesh(subMeshes[currentIndex].getMesh()) ?? false)) {
        currentIndex++;
        if (currentIndex >= subMeshes.length) {
          if (onCompiled) {
            onCompiled(this);
          }
          return;
        }
      }
      setTimeout(checkReady, 16);
    };
    checkReady();
  }
  /**
   * Forces all the attached effect to compile to enable rendering only once ready vs. lazily compiling effects.
   * @param options Sets of optional options forcing the compilation with different modes
   * @returns A promise that resolves when the compilation completes
   */
  async forceCompilationAsync(options) {
    return await new Promise((resolve) => {
      this.forceCompilation(() => {
        resolve();
      }, options);
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _isReadyCustomDefines(defines, subMesh, useInstances) {
  }
  _prepareShadowDefines(subMesh, useInstances, defines, isTransparent) {
    defines.push("#define SM_LIGHTTYPE_" + this._light.getClassName().toUpperCase());
    defines.push("#define SM_FLOAT " + (this._textureType !== 0 ? "1" : "0"));
    defines.push("#define SM_ESM " + (this.useExponentialShadowMap || this.useBlurExponentialShadowMap ? "1" : "0"));
    defines.push("#define SM_DEPTHTEXTURE " + (this.usePercentageCloserFiltering || this.useContactHardeningShadow ? "1" : "0"));
    const mesh = subMesh.getMesh();
    defines.push("#define SM_NORMALBIAS " + (this.normalBias && mesh.isVerticesDataPresent(VertexBuffer.NormalKind) ? "1" : "0"));
    defines.push("#define SM_DIRECTIONINLIGHTDATA " + (this.getLight().getTypeID() === Light.LIGHTTYPEID_DIRECTIONALLIGHT ? "1" : "0"));
    defines.push("#define SM_USEDISTANCE " + (this._light.needCube() ? "1" : "0"));
    defines.push("#define SM_SOFTTRANSPARENTSHADOW " + (this.enableSoftTransparentShadow && isTransparent ? "1" : "0"));
    this._isReadyCustomDefines(defines, subMesh, useInstances);
    return defines;
  }
  /**
   * Determine whether the shadow generator is ready or not (mainly all effects and related post processes needs to be ready).
   * @param subMesh The submesh we want to render in the shadow map
   * @param useInstances Defines whether will draw in the map using instances
   * @param isTransparent Indicates that isReady is called for a transparent subMesh
   * @returns true if ready otherwise, false
   */
  isReady(subMesh, useInstances, isTransparent) {
    if (!this._shadersLoaded) {
      return false;
    }
    const material = subMesh.getMaterial(), shadowDepthWrapper = material?.shadowDepthWrapper;
    this._opacityTexture = null;
    if (!material) {
      return false;
    }
    const defines = [];
    this._prepareShadowDefines(subMesh, useInstances, defines, isTransparent);
    if (shadowDepthWrapper) {
      if (!shadowDepthWrapper.isReadyForSubMesh(subMesh, defines, this, useInstances, this._scene.getEngine().currentRenderPassId)) {
        return false;
      }
    } else {
      const subMeshEffect = subMesh._getDrawWrapper(void 0, true);
      let effect = subMeshEffect.effect;
      let cachedDefines = subMeshEffect.defines;
      const attribs = [VertexBuffer.PositionKind];
      const mesh = subMesh.getMesh();
      let useNormal = false;
      let uv1 = false;
      let uv2 = false;
      const color = false;
      if (this.normalBias && mesh.isVerticesDataPresent(VertexBuffer.NormalKind)) {
        attribs.push(VertexBuffer.NormalKind);
        defines.push("#define NORMAL");
        useNormal = true;
        if (mesh.nonUniformScaling) {
          defines.push("#define NONUNIFORMSCALING");
        }
      }
      const needAlphaTesting = material.needAlphaTestingForMesh(mesh);
      if (needAlphaTesting || material.needAlphaBlendingForMesh(mesh)) {
        if (this.useOpacityTextureForTransparentShadow) {
          this._opacityTexture = material.opacityTexture;
        } else {
          this._opacityTexture = material.getAlphaTestTexture();
        }
        if (this._opacityTexture) {
          if (!this._opacityTexture.isReady()) {
            return false;
          }
          const alphaCutOff = material.alphaCutOff ?? ShadowGenerator.DEFAULT_ALPHA_CUTOFF;
          defines.push("#define ALPHATEXTURE");
          if (needAlphaTesting) {
            defines.push(`#define ALPHATESTVALUE ${alphaCutOff}${alphaCutOff % 1 === 0 ? "." : ""}`);
          }
          if (mesh.isVerticesDataPresent(VertexBuffer.UVKind)) {
            attribs.push(VertexBuffer.UVKind);
            defines.push("#define UV1");
            uv1 = true;
          }
          if (mesh.isVerticesDataPresent(VertexBuffer.UV2Kind)) {
            if (this._opacityTexture.coordinatesIndex === 1) {
              attribs.push(VertexBuffer.UV2Kind);
              defines.push("#define UV2");
              uv2 = true;
            }
          }
        }
      }
      const fallbacks = new EffectFallbacks();
      if (mesh.useBones && mesh.computeBonesUsingShaders && mesh.skeleton) {
        attribs.push(VertexBuffer.MatricesIndicesKind);
        attribs.push(VertexBuffer.MatricesWeightsKind);
        if (mesh.numBoneInfluencers > 4) {
          attribs.push(VertexBuffer.MatricesIndicesExtraKind);
          attribs.push(VertexBuffer.MatricesWeightsExtraKind);
        }
        const skeleton = mesh.skeleton;
        defines.push("#define NUM_BONE_INFLUENCERS " + mesh.numBoneInfluencers);
        if (mesh.numBoneInfluencers > 0) {
          fallbacks.addCPUSkinningFallback(0, mesh);
        }
        if (skeleton.isUsingTextureForMatrices) {
          defines.push("#define BONETEXTURE");
        } else {
          defines.push("#define BonesPerMesh " + (skeleton.bones.length + 1));
        }
      } else {
        defines.push("#define NUM_BONE_INFLUENCERS 0");
      }
      const numMorphInfluencers = mesh.morphTargetManager ? PrepareDefinesAndAttributesForMorphTargets(
        mesh.morphTargetManager,
        defines,
        attribs,
        mesh,
        true,
        // usePositionMorph
        useNormal,
        // useNormalMorph
        false,
        // useTangentMorph
        uv1,
        // useUVMorph
        uv2,
        // useUV2Morph
        color
        // useColorMorph
      ) : 0;
      PrepareStringDefinesForClipPlanes(material, this._scene, defines);
      if (useInstances) {
        defines.push("#define INSTANCES");
        PushAttributesForInstances(attribs);
        if (subMesh.getRenderingMesh().hasThinInstances) {
          defines.push("#define THIN_INSTANCES");
        }
      }
      if (this.customShaderOptions) {
        if (this.customShaderOptions.defines) {
          for (const define of this.customShaderOptions.defines) {
            if (defines.indexOf(define) === -1) {
              defines.push(define);
            }
          }
        }
      }
      const bvaManager = mesh.bakedVertexAnimationManager;
      if (bvaManager && bvaManager.isEnabled) {
        defines.push("#define BAKED_VERTEX_ANIMATION_TEXTURE");
        if (useInstances) {
          attribs.push("bakedVertexAnimationSettingsInstanced");
        }
      }
      const join = defines.join("\n");
      if (cachedDefines !== join) {
        cachedDefines = join;
        let shaderName = "shadowMap";
        const uniforms = [
          "world",
          "mBones",
          "viewProjection",
          "diffuseMatrix",
          "lightDataSM",
          "depthValuesSM",
          "biasAndScaleSM",
          "morphTargetInfluences",
          "morphTargetCount",
          "boneTextureInfo",
          "softTransparentShadowSM",
          "morphTargetTextureInfo",
          "morphTargetTextureIndices",
          "bakedVertexAnimationSettings",
          "bakedVertexAnimationTextureSizeInverted",
          "bakedVertexAnimationTime",
          "bakedVertexAnimationTexture"
        ];
        const samplers = ["diffuseSampler", "boneSampler", "morphTargets", "bakedVertexAnimationTexture"];
        const uniformBuffers = ["Scene", "Mesh"];
        AddClipPlaneUniforms(uniforms);
        if (this.customShaderOptions) {
          shaderName = this.customShaderOptions.shaderName;
          if (this.customShaderOptions.attributes) {
            for (const attrib of this.customShaderOptions.attributes) {
              if (attribs.indexOf(attrib) === -1) {
                attribs.push(attrib);
              }
            }
          }
          if (this.customShaderOptions.uniforms) {
            for (const uniform of this.customShaderOptions.uniforms) {
              if (uniforms.indexOf(uniform) === -1) {
                uniforms.push(uniform);
              }
            }
          }
          if (this.customShaderOptions.samplers) {
            for (const sampler of this.customShaderOptions.samplers) {
              if (samplers.indexOf(sampler) === -1) {
                samplers.push(sampler);
              }
            }
          }
        }
        const engine = this._scene.getEngine();
        effect = engine.createEffect(shaderName, {
          attributes: attribs,
          uniformsNames: uniforms,
          uniformBuffersNames: uniformBuffers,
          samplers,
          defines: join,
          fallbacks,
          onCompiled: null,
          onError: null,
          indexParameters: { maxSimultaneousMorphTargets: numMorphInfluencers },
          shaderLanguage: this._shaderLanguage
        }, engine);
        subMeshEffect.setEffect(effect, cachedDefines);
      }
      if (!effect.isReady()) {
        return false;
      }
    }
    if (this.useBlurExponentialShadowMap || this.useBlurCloseExponentialShadowMap) {
      if (!this._blurPostProcesses || !this._blurPostProcesses.length) {
        this._initializeBlurRTTAndPostProcesses();
      }
    }
    if (this._kernelBlurXPostprocess && !this._kernelBlurXPostprocess.isReady()) {
      return false;
    }
    if (this._kernelBlurYPostprocess && !this._kernelBlurYPostprocess.isReady()) {
      return false;
    }
    if (this._boxBlurPostprocess && !this._boxBlurPostprocess.isReady()) {
      return false;
    }
    return true;
  }
  /**
   * Prepare all the defines in a material relying on a shadow map at the specified light index.
   * @param defines Defines of the material we want to update
   * @param lightIndex Index of the light in the enabled light list of the material
   */
  prepareDefines(defines, lightIndex) {
    const scene = this._scene;
    const light = this._light;
    if (!scene.shadowsEnabled || !light.shadowEnabled) {
      return;
    }
    defines["SHADOW" + lightIndex] = true;
    if (this.useContactHardeningShadow) {
      defines["SHADOWPCSS" + lightIndex] = true;
      if (this._filteringQuality === ShadowGenerator.QUALITY_LOW) {
        defines["SHADOWLOWQUALITY" + lightIndex] = true;
      } else if (this._filteringQuality === ShadowGenerator.QUALITY_MEDIUM) {
        defines["SHADOWMEDIUMQUALITY" + lightIndex] = true;
      }
    } else if (this.usePercentageCloserFiltering) {
      defines["SHADOWPCF" + lightIndex] = true;
      if (this._filteringQuality === ShadowGenerator.QUALITY_LOW) {
        defines["SHADOWLOWQUALITY" + lightIndex] = true;
      } else if (this._filteringQuality === ShadowGenerator.QUALITY_MEDIUM) {
        defines["SHADOWMEDIUMQUALITY" + lightIndex] = true;
      }
    } else if (this.usePoissonSampling) {
      defines["SHADOWPOISSON" + lightIndex] = true;
    } else if (this.useExponentialShadowMap || this.useBlurExponentialShadowMap) {
      defines["SHADOWESM" + lightIndex] = true;
    } else if (this.useCloseExponentialShadowMap || this.useBlurCloseExponentialShadowMap) {
      defines["SHADOWCLOSEESM" + lightIndex] = true;
    }
    if (light.needCube()) {
      defines["SHADOWCUBE" + lightIndex] = true;
    }
  }
  /**
   * Binds the shadow related information inside of an effect (information like near, far, darkness...
   * defined in the generator but impacting the effect).
   * @param lightIndex Index of the light in the enabled light list of the material owning the effect
   * @param effect The effect we are binding the information for
   */
  bindShadowLight(lightIndex, effect) {
    const light = this._light;
    const scene = this._scene;
    if (!scene.shadowsEnabled || !light.shadowEnabled) {
      return;
    }
    const camera = this._getCamera();
    const shadowMap = this.getShadowMap();
    if (!shadowMap) {
      return;
    }
    if (!light.needCube()) {
      const offset = scene.floatingOriginOffset;
      const transform = this.getTransformMatrix();
      const lightMatrix = scene.floatingOriginMode ? GetFullOffsetViewProjectionToRef(offset, this._viewMatrix, this._projectionMatrix, TmpVectors.Matrix[0]) : transform;
      effect.setMatrix("lightMatrix" + lightIndex, lightMatrix);
    }
    const shadowMapForRendering = this.getShadowMapForRendering();
    if (this._filter === ShadowGenerator.FILTER_PCF) {
      effect.setDepthStencilTexture("shadowTexture" + lightIndex, shadowMapForRendering);
      light._uniformBuffer.updateFloat4("shadowsInfo", this.getDarkness(), shadowMap.getSize().width, 1 / shadowMap.getSize().width, this.frustumEdgeFalloff, lightIndex);
    } else if (this._filter === ShadowGenerator.FILTER_PCSS) {
      effect.setDepthStencilTexture("shadowTexture" + lightIndex, shadowMapForRendering);
      effect.setTexture("depthTexture" + lightIndex, shadowMapForRendering);
      light._uniformBuffer.updateFloat4("shadowsInfo", this.getDarkness(), 1 / shadowMap.getSize().width, this._contactHardeningLightSizeUVRatio * shadowMap.getSize().width, this.frustumEdgeFalloff, lightIndex);
    } else {
      effect.setTexture("shadowTexture" + lightIndex, shadowMapForRendering);
      light._uniformBuffer.updateFloat4("shadowsInfo", this.getDarkness(), this.blurScale / shadowMap.getSize().width, this.depthScale, this.frustumEdgeFalloff, lightIndex);
    }
    light._uniformBuffer.updateFloat2("depthValues", this.getLight().getDepthMinZ(camera), this.getLight().getDepthMinZ(camera) + this.getLight().getDepthMaxZ(camera), lightIndex);
  }
  /**
   * Gets the view matrix used to render the shadow map.
   */
  get viewMatrix() {
    return this._viewMatrix;
  }
  /**
   * Gets the projection matrix used to render the shadow map.
   */
  get projectionMatrix() {
    return this._projectionMatrix;
  }
  /**
   * Gets the transformation matrix used to project the meshes into the map from the light point of view.
   * (eq to shadow projection matrix * light transform matrix)
   * @returns The transform matrix used to create the shadow map
   */
  getTransformMatrix() {
    const scene = this._scene;
    if (this._currentRenderId === scene.getRenderId() && this._currentFaceIndexCache === this._currentFaceIndex) {
      return this._transformMatrix;
    }
    this._currentRenderId = scene.getRenderId();
    this._currentFaceIndexCache = this._currentFaceIndex;
    let lightPosition = this._light.position;
    if (this._light.computeTransformedInformation()) {
      lightPosition = this._light.transformedPosition;
    }
    Vector3.NormalizeToRef(this._light.getShadowDirection(this._currentFaceIndex), this._lightDirection);
    if (Math.abs(Vector3.Dot(this._lightDirection, Vector3.Up())) === 1) {
      this._lightDirection.z = 1e-13;
    }
    if (this._light.needProjectionMatrixCompute() || !this._cachedPosition || !this._cachedDirection || !lightPosition.equals(this._cachedPosition) || !this._lightDirection.equals(this._cachedDirection)) {
      this._cachedPosition.copyFrom(lightPosition);
      this._cachedDirection.copyFrom(this._lightDirection);
      Matrix.LookAtLHToRef(lightPosition, lightPosition.add(this._lightDirection), Vector3.Up(), this._viewMatrix);
      const shadowMap = this.getShadowMap();
      if (shadowMap) {
        const renderList = shadowMap.renderList;
        if (renderList) {
          this._light.setShadowProjectionMatrix(this._projectionMatrix, this._viewMatrix, renderList);
        }
      }
      this._viewMatrix.multiplyToRef(this._projectionMatrix, this._transformMatrix);
    }
    return this._transformMatrix;
  }
  /**
   * Recreates the shadow map dependencies like RTT and post processes. This can be used during the switch between
   * Cube and 2D textures for instance.
   */
  recreateShadowMap() {
    const shadowMap = this._shadowMap;
    if (!shadowMap) {
      return;
    }
    const renderList = shadowMap.renderList;
    this._disposeRTTandPostProcesses();
    this._initializeGenerator();
    this.filter = this._filter;
    this._applyFilterValues();
    if (renderList) {
      if (!this._shadowMap.renderList) {
        this._shadowMap.renderList = [];
      }
      for (const mesh of renderList) {
        this._shadowMap.renderList.push(mesh);
      }
    } else {
      this._shadowMap.renderList = null;
    }
  }
  _disposeBlurPostProcesses() {
    if (this._shadowMap2) {
      this._shadowMap2.dispose();
      this._shadowMap2 = null;
    }
    if (this._boxBlurPostprocess) {
      this._boxBlurPostprocess.dispose();
      this._boxBlurPostprocess = null;
    }
    if (this._kernelBlurXPostprocess) {
      this._kernelBlurXPostprocess.dispose();
      this._kernelBlurXPostprocess = null;
    }
    if (this._kernelBlurYPostprocess) {
      this._kernelBlurYPostprocess.dispose();
      this._kernelBlurYPostprocess = null;
    }
    this._blurPostProcesses = [];
  }
  _disposeRTTandPostProcesses() {
    if (this._shadowMap) {
      this._shadowMap.dispose();
      this._shadowMap = null;
    }
    this._disposeBlurPostProcesses();
  }
  _disposeSceneUBOs() {
    if (this._sceneUBOs) {
      for (const ubo of this._sceneUBOs) {
        ubo.dispose();
      }
      this._sceneUBOs = [];
    }
  }
  /**
   * Disposes the ShadowGenerator.
   * @param clearObservables Defines whether to clear the observables or not (true by default).
   * Returns nothing.
   */
  dispose(clearObservables = true) {
    this._disposeRTTandPostProcesses();
    this._disposeSceneUBOs();
    if (this._light) {
      if (this._light._shadowGenerators) {
        const iterator = this._light._shadowGenerators.entries();
        for (let entry = iterator.next(); entry.done !== true; entry = iterator.next()) {
          const [camera, shadowGenerator] = entry.value;
          if (shadowGenerator === this) {
            this._light._shadowGenerators.delete(camera);
          }
        }
        if (this._light._shadowGenerators.size === 0) {
          this._light._shadowGenerators = null;
        }
      }
      this._light._markMeshesAsLightDirty();
    }
    if (clearObservables) {
      this.onBeforeShadowMapRenderMeshObservable.clear();
      this.onBeforeShadowMapRenderObservable.clear();
      this.onAfterShadowMapRenderMeshObservable.clear();
      this.onAfterShadowMapRenderObservable.clear();
    }
  }
  /**
   * Serializes the shadow generator setup to a json object.
   * @returns The serialized JSON object
   */
  serialize() {
    const serializationObject = {};
    const shadowMap = this.getShadowMap();
    if (!shadowMap) {
      return serializationObject;
    }
    serializationObject.className = this.getClassName();
    serializationObject.lightId = this._light.id;
    serializationObject.cameraId = this._camera?.id;
    serializationObject.id = this.id;
    serializationObject.mapSize = shadowMap.getRenderSize();
    serializationObject.forceBackFacesOnly = this.forceBackFacesOnly;
    serializationObject.darkness = this.getDarkness();
    serializationObject.transparencyShadow = this._transparencyShadow;
    serializationObject.frustumEdgeFalloff = this.frustumEdgeFalloff;
    serializationObject.bias = this.bias;
    serializationObject.normalBias = this.normalBias;
    serializationObject.usePercentageCloserFiltering = this.usePercentageCloserFiltering;
    serializationObject.useContactHardeningShadow = this.useContactHardeningShadow;
    serializationObject.contactHardeningLightSizeUVRatio = this.contactHardeningLightSizeUVRatio;
    serializationObject.filteringQuality = this.filteringQuality;
    serializationObject.useExponentialShadowMap = this.useExponentialShadowMap;
    serializationObject.useBlurExponentialShadowMap = this.useBlurExponentialShadowMap;
    serializationObject.useCloseExponentialShadowMap = this.useCloseExponentialShadowMap;
    serializationObject.useBlurCloseExponentialShadowMap = this.useBlurCloseExponentialShadowMap;
    serializationObject.usePoissonSampling = this.usePoissonSampling;
    serializationObject.depthScale = this.depthScale;
    serializationObject.blurBoxOffset = this.blurBoxOffset;
    serializationObject.blurKernel = this.blurKernel;
    serializationObject.blurScale = this.blurScale;
    serializationObject.useKernelBlur = this.useKernelBlur;
    serializationObject.renderList = [];
    if (shadowMap.renderList) {
      for (let meshIndex = 0; meshIndex < shadowMap.renderList.length; meshIndex++) {
        const mesh = shadowMap.renderList[meshIndex];
        serializationObject.renderList.push(mesh.id);
      }
    }
    return serializationObject;
  }
  /**
   * Parses a serialized ShadowGenerator and returns a new ShadowGenerator.
   * @param parsedShadowGenerator The JSON object to parse
   * @param scene The scene to create the shadow map for
   * @param constr A function that builds a shadow generator or undefined to create an instance of the default shadow generator
   * @returns The parsed shadow generator
   */
  static Parse(parsedShadowGenerator, scene, constr) {
    const light = scene.getLightById(parsedShadowGenerator.lightId);
    const camera = parsedShadowGenerator.cameraId !== void 0 ? scene.getCameraById(parsedShadowGenerator.cameraId) : null;
    const shadowGenerator = constr ? constr(parsedShadowGenerator.mapSize, light, camera) : new ShadowGenerator(parsedShadowGenerator.mapSize, light, void 0, camera);
    const shadowMap = shadowGenerator.getShadowMap();
    if (parsedShadowGenerator.renderList.length && shadowMap) {
      const renderSet = new Set(parsedShadowGenerator.renderList);
      let renderList = shadowMap.renderList;
      if (!renderList) {
        renderList = shadowMap.renderList = [];
      }
      const meshes = scene.meshes;
      for (const mesh of meshes) {
        if (renderSet.has(mesh.id)) {
          renderList.push(mesh);
        }
      }
    }
    if (parsedShadowGenerator.id !== void 0) {
      shadowGenerator.id = parsedShadowGenerator.id;
    }
    shadowGenerator.forceBackFacesOnly = !!parsedShadowGenerator.forceBackFacesOnly;
    if (parsedShadowGenerator.darkness !== void 0) {
      shadowGenerator.setDarkness(parsedShadowGenerator.darkness);
    }
    if (parsedShadowGenerator.transparencyShadow) {
      shadowGenerator.setTransparencyShadow(true);
    }
    if (parsedShadowGenerator.frustumEdgeFalloff !== void 0) {
      shadowGenerator.frustumEdgeFalloff = parsedShadowGenerator.frustumEdgeFalloff;
    }
    if (parsedShadowGenerator.bias !== void 0) {
      shadowGenerator.bias = parsedShadowGenerator.bias;
    }
    if (parsedShadowGenerator.normalBias !== void 0) {
      shadowGenerator.normalBias = parsedShadowGenerator.normalBias;
    }
    if (parsedShadowGenerator.usePercentageCloserFiltering) {
      shadowGenerator.usePercentageCloserFiltering = true;
    } else if (parsedShadowGenerator.useContactHardeningShadow) {
      shadowGenerator.useContactHardeningShadow = true;
    } else if (parsedShadowGenerator.usePoissonSampling) {
      shadowGenerator.usePoissonSampling = true;
    } else if (parsedShadowGenerator.useExponentialShadowMap) {
      shadowGenerator.useExponentialShadowMap = true;
    } else if (parsedShadowGenerator.useBlurExponentialShadowMap) {
      shadowGenerator.useBlurExponentialShadowMap = true;
    } else if (parsedShadowGenerator.useCloseExponentialShadowMap) {
      shadowGenerator.useCloseExponentialShadowMap = true;
    } else if (parsedShadowGenerator.useBlurCloseExponentialShadowMap) {
      shadowGenerator.useBlurCloseExponentialShadowMap = true;
    } else if (parsedShadowGenerator.useVarianceShadowMap) {
      shadowGenerator.useExponentialShadowMap = true;
    } else if (parsedShadowGenerator.useBlurVarianceShadowMap) {
      shadowGenerator.useBlurExponentialShadowMap = true;
    }
    if (parsedShadowGenerator.contactHardeningLightSizeUVRatio !== void 0) {
      shadowGenerator.contactHardeningLightSizeUVRatio = parsedShadowGenerator.contactHardeningLightSizeUVRatio;
    }
    if (parsedShadowGenerator.filteringQuality !== void 0) {
      shadowGenerator.filteringQuality = parsedShadowGenerator.filteringQuality;
    }
    if (parsedShadowGenerator.depthScale) {
      shadowGenerator.depthScale = parsedShadowGenerator.depthScale;
    }
    if (parsedShadowGenerator.blurScale) {
      shadowGenerator.blurScale = parsedShadowGenerator.blurScale;
    }
    if (parsedShadowGenerator.blurBoxOffset) {
      shadowGenerator.blurBoxOffset = parsedShadowGenerator.blurBoxOffset;
    }
    if (parsedShadowGenerator.useKernelBlur) {
      shadowGenerator.useKernelBlur = parsedShadowGenerator.useKernelBlur;
    }
    if (parsedShadowGenerator.blurKernel) {
      shadowGenerator.blurKernel = parsedShadowGenerator.blurKernel;
    }
    return shadowGenerator;
  }
}
ShadowGenerator.CLASSNAME = "ShadowGenerator";
ShadowGenerator.ForceGLSL = false;
ShadowGenerator.FILTER_NONE = 0;
ShadowGenerator.FILTER_EXPONENTIALSHADOWMAP = 1;
ShadowGenerator.FILTER_POISSONSAMPLING = 2;
ShadowGenerator.FILTER_BLUREXPONENTIALSHADOWMAP = 3;
ShadowGenerator.FILTER_CLOSEEXPONENTIALSHADOWMAP = 4;
ShadowGenerator.FILTER_BLURCLOSEEXPONENTIALSHADOWMAP = 5;
ShadowGenerator.FILTER_PCF = 6;
ShadowGenerator.FILTER_PCSS = 7;
ShadowGenerator.QUALITY_HIGH = 0;
ShadowGenerator.QUALITY_MEDIUM = 1;
ShadowGenerator.QUALITY_LOW = 2;
ShadowGenerator.DEFAULT_ALPHA_CUTOFF = 0.5;
ShadowGenerator._SceneComponentInitialization = (_) => {
  throw _WarnImport("ShadowGeneratorSceneComponent");
};
ShadowGenerator._CascadedShadowGeneratorParser = null;
export {
  BlurPostProcess as B,
  PhysicsWorld as P,
  RegisterBlurPostProcess as R,
  ShadowGenerator as S,
  ThinBlurPostProcess as T,
  createPropNode as c,
  disposePropNode as d,
  envColliderDesc as e,
  initPhysics as i,
  loadEnvModel as l,
  orientProp as o,
  partMesh as p,
  simProfile as s
};
