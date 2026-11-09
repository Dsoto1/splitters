import RAPIER from '@dimforge/rapier3d-compat';
import { boxQuat, type Rot, type WorldBox } from '../map/geometry.ts';
import type { Vec3 } from '../math.ts';
import { PLAYER } from './constants.ts';
import { simProfile } from './profile.ts';
import { hypot } from '../math.ts';
import type { EnvWorldShape } from '../map/environment.ts';
import type { SurfaceTypeId } from './surfaceTypes.ts';

/**
 * A Rapier collider for an environment shape (map/environment.ts), groups unset: a capsule turned from +Y onto its
 * axis, a convex hull, or a triangle mesh. Null when Rapier can't make it (a degenerate hull).
 */
export function envColliderDesc(sh: EnvWorldShape): RAPIER.ColliderDesc | null {
  if (sh.kind === 'capsule') {
    const d = { x: sh.b[0] - sh.a[0], y: sh.b[1] - sh.a[1], z: sh.b[2] - sh.a[2] };
    const len = Math.hypot(d.x, d.y, d.z);
    const c = { x: (sh.a[0] + sh.b[0]) / 2, y: (sh.a[1] + sh.b[1]) / 2, z: (sh.a[2] + sh.b[2]) / 2 };
    const desc = RAPIER.ColliderDesc.capsule(Math.max(1e-4, len / 2), sh.r).setTranslation(c.x, c.y, c.z);
    if (len > 1e-6) {
      // The shortest turn taking +Y onto the axis.
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
  if (sh.kind === 'hull') return RAPIER.ColliderDesc.convexHull(new Float32Array(sh.points));
  return RAPIER.ColliderDesc.trimesh(new Float32Array(sh.positions), new Uint32Array(sh.indices));
}

let initPromise: Promise<void> | undefined;

/** Load the Rapier WASM module once. Safe to call repeatedly. */
export function initPhysics(): Promise<void> {
  initPromise ??= RAPIER.init();
  return initPromise;
}

// Interaction groups: high 16 bits = membership, low 16 bits = filter.
const GROUP_WORLD = 0x0001;
const GROUP_PLAYER = 0x0002;
/** Force fields: they stop bodies moving (players, vehicles) but never shots, sight or other queries. */
const GROUP_FIELD = 0x0004;
/** The terrain: static geometry like the rest, in a group of its own so coarse moves can leave it out. */
const GROUP_TERRAIN = 0x0008;
const groups = (membership: number, filter: number): number => ((membership << 16) | filter) >>> 0;
const WORLD_COLLIDER_GROUPS = groups(GROUP_WORLD, 0xffff);
const TERRAIN_COLLIDER_GROUPS = groups(GROUP_TERRAIN, 0xffff);
const PLAYER_COLLIDER_GROUPS = groups(GROUP_PLAYER, 0xffff);
/** Queries that should only see static map geometry (movement, line of sight, shot occlusion). */
const WORLD_ONLY_QUERY = groups(0xffff, GROUP_WORLD | GROUP_TERRAIN);
const FIELD_COLLIDER_GROUPS = groups(GROUP_FIELD, 0xffff);
/** Breakable glass panes: they stop bodies moving, never shots or sight (shots break them on the way, see sim/glass.ts). */
const GROUP_GLASS = 0x0010;
/** Reinforced (bulletproof) glass: stops bodies and shots, never sight. */
const GROUP_ARMOR_GLASS = 0x0020;
const GLASS_COLLIDER_GROUPS = groups(GROUP_GLASS, 0xffff);
const ARMOR_GLASS_COLLIDER_GROUPS = groups(GROUP_ARMOR_GLASS, 0xffff);
/**
 * Environment shapes that stop shots and sight but not movement (a tree's thick limbs overhead: `blocks: 'shots'`,
 * content/environment.ts): in the shot and sight queries, never in movement.
 */
const GROUP_SHOTS_ONLY = 0x0040;
const SHOTS_ONLY_COLLIDER_GROUPS = groups(GROUP_SHOTS_ONLY, 0xffff);
/** Movement queries: static geometry, force fields and glass. */
const MOVE_QUERY = groups(0xffff, GROUP_WORLD | GROUP_FIELD | GROUP_TERRAIN | GROUP_GLASS | GROUP_ARMOR_GLASS);
/** Coarse moves (moveCharacter with a ground function): everything but the terrain, which the function stands in for. */
const MOVE_NO_TERRAIN_QUERY = groups(0xffff, GROUP_WORLD | GROUP_FIELD | GROUP_GLASS | GROUP_ARMOR_GLASS);
/** Shots and thrown things: static geometry, bulletproof glass and shots-only environment shapes. */
const SHOT_QUERY = groups(0xffff, GROUP_WORLD | GROUP_TERRAIN | GROUP_ARMOR_GLASS | GROUP_SHOTS_ONLY);
/** Sight lines and world rays: static geometry and shots-only environment shapes (a thick limb hides you too). */
const SIGHT_QUERY = groups(0xffff, GROUP_WORLD | GROUP_TERRAIN | GROUP_SHOTS_ONLY);
/** What wheels stand on (PhysicsWorld.groundBelow): everything solid but players and force fields. */
const GROUND_QUERY = groups(0xffff, GROUP_WORLD | GROUP_TERRAIN | GROUP_GLASS | GROUP_ARMOR_GLASS);
const DOWN = { x: 0, y: -1, z: 0 };
const MAX_SLOPE_TAN = Math.tan((PLAYER.maxSlopeDegrees * Math.PI) / 180);

/**
 * Fewer, bigger colliders for the same solid space: unturned boxes with the
 * same cross-section that touch or overlap end to end along x, then along z,
 * become one (a run of floor tiles, a wall along several rooms): fewer
 * candidates for every move and sight check, and no seams between
 * neighbouring boxes for a capsule to catch on. Turned boxes stay as they are.
 */
export function mergeBoxes(boxes: readonly WorldBox[]): WorldBox[] {
  const out: WorldBox[] = [];
  let flat: WorldBox[] = [];
  for (const b of boxes) (b.yaw || b.pitch || b.roll ? out : flat).push(b);
  const k = (n: number) => Math.round(n * 1e4);
  for (const axis of [0, 2] as const) {
    const other = axis === 0 ? 2 : 0;
    const groups = new Map<string, WorldBox[]>();
    for (const b of flat) {
      const key = `${k(b.min[1])},${k(b.max[1])},${k(b.min[other])},${k(b.max[other])}`;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = []));
      g.push(b);
    }
    const merged: WorldBox[] = [];
    for (const g of groups.values()) {
      g.sort((a, b) => a.min[axis] - b.min[axis]);
      let cur: WorldBox | null = null;
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

/** Height of the terrain at (x, z), or null off it (PhysicsWorld.moveCharacter's coarse moves). */
export type GroundHeight = (x: number, z: number) => number | null;

const CAPSULE_HALF_HEIGHT = (PLAYER.height - PLAYER.radius * 2) / 2;
const CONTROLLER_OFFSET = 0.02;
/**
 * Each move starts this far above the stored position. Quantised positions can
 * land a hair inside the controller's skin offset, which makes Rapier refuse to
 * move the capsule at all; starting slightly higher and letting snap-to-ground
 * settle it back keeps movement reliable and still deterministic.
 */
const START_LIFT = CONTROLLER_OFFSET / 2;

/**
 * Static map collision plus kinematic player capsules. Identical code runs on
 * the server (authoritative) and on the client (prediction), so both must be
 * built from the same WorldBox list.
 */
export class PhysicsWorld {
  readonly world: RAPIER.World;
  readonly controller: RAPIER.KinematicCharacterController;
  /** Set when a movable world collider changed; queries need a broad-phase update first. */
  private dirty = false;
  /** The level box behind each static collider (bullets read what it is made of). */
  private readonly staticBoxes = new Map<number, WorldBox>();
  /**
   * Bumped when a world collider appears, goes, or is switched on or off (a door, a
   * breakable, a built piece): caches of sight lines start over (see SightCache).
   */
  structureVersion = 0;
  /**
   * A collider shots pass through while set (raycastHit and raycastNormal): the vehicle a rider fires from, so
   * rounds leave through its own body. The match sets it around one shot or projectile step and clears it.
   */
  shotSkip: RAPIER.Collider | null = null;
  /** One ray for every cast (queries are synchronous): no allocation per sight line or shot. */
  private readonly ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });

  /** The environment shape behind each environment collider (map/environment.ts): its placement and surface. */
  private readonly staticShapes = new Map<number, { sourceId: string; surface: SurfaceTypeId }>();

  /** `shapes`: the map's environment colliders (map/environment.ts `environmentShapes`), next to its boxes. */
  constructor(boxes: readonly WorldBox[], terrain: { positions: Float32Array; indices: Uint32Array } | null = null, shapes: readonly EnvWorldShape[] = []) {
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    if (terrain) this.world.createCollider(RAPIER.ColliderDesc.trimesh(terrain.positions, terrain.indices).setCollisionGroups(TERRAIN_COLLIDER_GROUPS));
    for (const sh of shapes) {
      const desc = envColliderDesc(sh);
      if (!desc) continue;
      desc.setCollisionGroups(sh.blocks === 'all' ? WORLD_COLLIDER_GROUPS : SHOTS_ONLY_COLLIDER_GROUPS);
      this.staticShapes.set(this.world.createCollider(desc).handle, { sourceId: sh.sourceId, surface: sh.surface });
    }
    for (const b of mergeBoxes(boxes)) {
      const hx = (b.max[0] - b.min[0]) / 2;
      const hy = (b.max[1] - b.min[1]) / 2;
      const hz = (b.max[2] - b.min[2]) / 2;
      const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(b.min[0] + hx, b.min[1] + hy, b.min[2] + hz)
        .setCollisionGroups(WORLD_COLLIDER_GROUPS);
      if (b.pitch || b.roll) desc.setRotation(boxQuat(b.yaw, b.pitch, b.roll));
      else if (b.yaw) desc.setRotation({ x: 0, y: Math.sin(b.yaw / 2), z: 0, w: Math.cos(b.yaw / 2) });
      this.staticBoxes.set(this.world.createCollider(desc).handle, b);
    }
    this.controller = this.world.createCharacterController(CONTROLLER_OFFSET);
    this.controller.enableAutostep(PLAYER.maxStepHeight, 0.15, false);
    this.controller.enableSnapToGround(PLAYER.maxStepHeight);
    this.controller.setMaxSlopeClimbAngle((PLAYER.maxSlopeDegrees * Math.PI) / 180);
    this.controller.setApplyImpulsesToDynamicBodies(false);
    // Populate the broad phase so scene queries see the static colliders.
    this.world.step();
  }

  createPlayerCollider(): RAPIER.Collider {
    // Disabled: nothing queries player capsules (shots test players on their own), and the character
    // controller moves a disabled collider just the same. Out of the broad phase, the capsules that
    // move every tick cost nothing in physics updates (commit).
    const desc = RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, PLAYER.radius).setCollisionGroups(PLAYER_COLLIDER_GROUPS).setEnabled(false);
    return this.world.createCollider(desc);
  }

  /**
   * A world collider that scenario objects (doors, crates) move, enable and
   * disable. It blocks movement, shots and line of sight like static geometry.
   * `yaw` turns the box about the vertical axis (see viewDirection()).
   * A `field` box (force field) blocks movement only: shots, grenades, line
   * of sight and every other query pass through it.
   */
  createBox(center: Vec3, half: Vec3, yaw = 0, rotation?: Rot, field = false): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
      .setTranslation(center.x, center.y, center.z)
      .setRotation(rotation ?? { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
      .setCollisionGroups(field ? FIELD_COLLIDER_GROUPS : WORLD_COLLIDER_GROUPS);
    this.dirty = true;
    this.structureVersion++;
    return this.world.createCollider(desc);
  }

  /**
   * A glass pane (sim/glass.ts): it stops movement and never sight; a
   * `reinforced` pane also stops shots (raycastHit and raycastNormal hit it,
   * raycastWorld and lineOfSight don't).
   */
  createGlassBox(center: Vec3, half: Vec3, yaw = 0, reinforced = false, rotation?: Rot): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
      .setTranslation(center.x, center.y, center.z)
      .setRotation(rotation ?? { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
      .setCollisionGroups(reinforced ? ARMOR_GLASS_COLLIDER_GROUPS : GLASS_COLLIDER_GROUPS);
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
  shotLine(a: Vec3, b: Vec3): boolean {
    const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const len = hypot(d.x, d.y, d.z);
    if (len < 1e-6) return true;
    return this.raycastHit(a, { x: d.x / len, y: d.y / len, z: d.z / len }, len) === null;
  }

  moveBox(collider: RAPIER.Collider, center: Vec3): void {
    const t = collider.translation();
    if (t.x === center.x && t.y === center.y && t.z === center.z) return;
    collider.setTranslation(center);
    this.dirty = true;
  }

  /** Move and turn a box (vehicles, turning turrets). */
  setBoxPose(collider: RAPIER.Collider, center: Vec3, yaw: number): void {
    collider.setTranslation(center);
    collider.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
    this.dirty = true;
  }

  /** Move and turn a box to any orientation (movers carrying tilted or hinged blocks). */
  setBoxTransform(collider: RAPIER.Collider, center: Vec3, rotation: Rot): void {
    const t = collider.translation();
    const r = collider.rotation();
    if (t.x === center.x && t.y === center.y && t.z === center.z && r.x === rotation.x && r.y === rotation.y && r.z === rotation.z && r.w === rotation.w) return;
    collider.setTranslation(center);
    collider.setRotation(rotation);
    this.dirty = true;
  }

  /** A probe capsule that carries a vehicle over the ground (it collides with the world only, never players). */
  createVehicleProbe(radius: number): RAPIER.Collider {
    const halfHeight = Math.max(0.05, 0.5 - radius * 0.2);
    const probe = this.world.createCollider(RAPIER.ColliderDesc.capsule(halfHeight, radius).setCollisionGroups(PLAYER_COLLIDER_GROUPS).setEnabled(false));
    this.probeCenter.set(probe, halfHeight + radius);
    return probe;
  }

  /** How high over its feet each vehicle probe's centre sits (the low probe is no capsule, so it can't be read off the shape). */
  private readonly probeCenter = new WeakMap<RAPIER.Collider, number>();

  /** A vehicle probe's height over its feet (m). */
  probeHeight(probe: RAPIER.Collider): number {
    return 2 * (this.probeCenter.get(probe) ?? 0);
  }

  /**
   * The low probe for a vehicle whose probe capsule stands taller than its hull (`height`, m): the same round bottom
   * as the capsule of `radius` (so it rides the ground just the same), cut off flat at the hull's top. A vehicle
   * moves with it under a ceiling the capsule's dome would catch on (a deck, a beam, a low roof), as far as the hull
   * itself fits (Match.moveVehicleProbe). Null when the capsule is no taller than the hull.
   */
  createLowVehicleProbe(radius: number, height: number): RAPIER.Collider | null {
    const tall = 2 * (Math.max(0.05, 0.5 - radius * 0.2) + radius);
    if (height >= tall - 0.05) return null;
    // Points of the capsule's lower half (pole, rings every 9 degrees up to its equator), then a ring at the top.
    const pts: number[] = [];
    const c = height / 2;
    pts.push(0, -c, 0);
    const SEG = 24;
    const ring = (y: number, r: number) => {
      for (let k = 0; k < SEG; k++) pts.push(Math.cos((k / SEG) * Math.PI * 2) * r, y - c, Math.sin((k / SEG) * Math.PI * 2) * r);
    };
    for (let i = 1; i <= 10; i++) {
      const a = (i / 10) * (Math.PI / 2);
      const y = radius - radius * Math.cos(a);
      if (y >= height) break;
      ring(y, radius * Math.sin(a));
    }
    // The top: the capsule's width at that height (its full radius above the equator; less when it is lower).
    ring(height, height >= radius ? radius : Math.sqrt(radius * radius - (radius - height) ** 2));
    const desc = RAPIER.ColliderDesc.convexHull(new Float32Array(pts));
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
  overhead(feet: Vec3, from: number, to: number, radius: number, body: RAPIER.Collider): boolean {
    const half = (to - from) / 2;
    if (half <= 0.005) return false;
    const shape = new RAPIER.Cylinder(half, Math.max(0.05, radius - 0.03));
    const hit = this.world.intersectionWithShape({ x: feet.x, y: feet.y + from + half, z: feet.z }, { x: 0, y: 0, z: 0, w: 1 }, shape, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, MOVE_QUERY, body);
    return hit !== null;
  }

  /** Whether a vehicle probe with its base at `feet` overlaps anything it moves against (not its own hull). */
  private probeOverlaps(probe: RAPIER.Collider, feet: Vec3, centerY: number, body: RAPIER.Collider): boolean {
    return this.world.intersectionWithShape({ x: feet.x, y: feet.y + centerY, z: feet.z }, probe.rotation(), probe.shape, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, MOVE_QUERY, body) !== null;
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
  moveVehicle(probe: RAPIER.Collider, body: RAPIER.Collider, feet: Vec3, delta: Vec3, ground = true): { feet: Vec3; grounded: boolean; blocked: number } {
    const centerY = this.probeCenter.get(probe) ?? 0;
    const lift = 0.05;
    const skip = (c: RAPIER.Collider) => c.handle !== body.handle;
    probe.setTranslation({ x: feet.x, y: feet.y + lift + centerY, z: feet.z });
    this.controller.computeColliderMovement(probe, { x: delta.x, y: delta.y - lift, z: delta.z }, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, MOVE_QUERY, skip);
    let m = this.controller.computedMovement();
    let grounded = this.controller.computedGrounded();
    let start = lift;
    const want = hypot(delta.x, delta.z);
    // Refused: no headway, and not even the lift back down (the controller hardly moved it at all).
    const refused = ground && hypot(m.x, m.z) < 1e-4 && m.y > -1e-3 && m.y < lift * 0.5 && (want > 1e-6 || delta.y - lift < -1e-6);
    if (refused) {
      // Refused: no headway, and only the fall (if any) from where it is, without the lift.
      start = 0;
      probe.setTranslation({ x: feet.x, y: feet.y + centerY, z: feet.z });
      this.controller.computeColliderMovement(probe, { x: 0, y: Math.min(0, delta.y), z: 0 }, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, MOVE_QUERY, skip);
      const down = this.controller.computedMovement();
      m = { x: 0, y: Math.min(0, down.y), z: 0 };
      // Held where it is (refused that too: the pinch holds it up), or come down onto the ground: it rests.
      grounded = m.y > -1e-6 || this.controller.computedGrounded();
    }
    let next = { x: feet.x + m.x, y: feet.y + start + m.y, z: feet.z + m.z };
    // The controller can let the probe creep up into what is over it (climbing a sill under a lintel, or starting
    // within the lift of a ceiling): a move that ends inside the level when it didn't start there keeps its height
    // (or, if that is inside too, the vehicle stays where it was), as moveCharacter does for players.
    if (ground && next.y > feet.y + 1e-4 && this.probeOverlaps(probe, next, centerY, body) && !this.probeOverlaps(probe, feet, centerY, body)) {
      const level = { x: next.x, y: feet.y, z: next.z };
      next = this.probeOverlaps(probe, level, centerY, body) ? { ...feet } : level;
      m = { x: next.x - feet.x, y: 0, z: next.z - feet.z };
    }
    probe.setTranslation({ x: next.x, y: next.y + centerY, z: next.z });
    const got = hypot(m.x, m.z);
    return { feet: next, grounded, blocked: want > 1e-6 ? 1 - got / want : 0 };
  }

  setBoxEnabled(collider: RAPIER.Collider, enabled: boolean): void {
    if (collider.isEnabled() === enabled) return;
    collider.setEnabled(enabled);
    this.dirty = true;
    this.structureVersion++;
  }

  /** Bring scene queries up to date after boxes moved. Cheap when nothing changed. */
  commit(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const t0 = simProfile.on ? performance.now() : 0;
    // World.step() then walks every collider handle through a JS callback to pick up colliders the
    // step made itself, which a world with no bodies never does (ours are all created and removed
    // through the JS API, which keeps its own map): on a 3,000-collider map that walk cost as much
    // as the step. Run the pipeline directly when the build has the fields we expect.
    const w = this.world as unknown as Record<string, unknown> & { physicsPipeline?: { step?: (...a: unknown[]) => void } };
    if (typeof w.physicsPipeline?.step === 'function' && 'softBodies' in w) {
      w.physicsPipeline.step(w.gravity, w.integrationParameters, w.islands, w.broadPhase, w.narrowPhase, w.bodies, w.colliders, w.softBodies, w.impulseJoints, w.multibodyJoints, w.ccdSolver);
    } else this.world.step();
    if (simProfile.on) simProfile.add('commit', performance.now() - t0);
  }

  removeCollider(collider: RAPIER.Collider): void {
    this.world.removeCollider(collider, false);
    this.structureVersion++;
  }

  /**
   * Move a player capsule (feet position) by `delta`, sliding along static
   * geometry. Other players never block movement, which keeps client
   * prediction independent of remote player positions.
   */
  moveCharacter(collider: RAPIER.Collider, feet: Vec3, delta: Vec3, height: number = PLAYER.height, radius: number = PLAYER.radius, ground?: GroundHeight): { feet: Vec3; grounded: boolean; movedY: number } {
    if (!simProfile.on) return this.moveCharacterNow(collider, feet, delta, height, radius, ground);
    const t0 = performance.now();
    const r = this.moveCharacterNow(collider, feet, delta, height, radius, ground);
    simProfile.add('move', performance.now() - t0);
    simProfile.count(ground ? 'moveCoarse' : 'move');
    return r;
  }

  /**
   * With `ground` (a coarse move, for bots on foot in big matches: Match.relaxedMove)
   * the controller leaves the terrain out, the costliest thing it collides with
   * (about four times a move on flat boxes), and the terrain's height function
   * stands in for it: feet are kept on it, stepped down onto it, and slopes too
   * steep to climb stop the move.
   */
  private moveCharacterNow(collider: RAPIER.Collider, feet: Vec3, delta: Vec3, height: number, radius: number, ground?: GroundHeight): { feet: Vec3; grounded: boolean; movedY: number } {
    const query = ground ? MOVE_NO_TERRAIN_QUERY : MOVE_QUERY;
    // Crouching and prone shrink the capsule; small and large characters have their own.
    const half = Math.max(0.01, (height - radius * 2) / 2);
    const shape = collider.shape as RAPIER.Capsule;
    // A new shape rather than setHalfHeight, which left a grown capsule sunk into the floor.
    if (Math.abs(shape.halfHeight - half) > 1e-4 || Math.abs(shape.radius - radius) > 1e-4) collider.setShape(new RAPIER.Capsule(half, radius));
    const centerY = height / 2;
    const startY = feet.y + START_LIFT;
    collider.setTranslation({ x: feet.x, y: startY + centerY, z: feet.z });
    this.controller.computeColliderMovement(collider, { x: delta.x, y: delta.y - START_LIFT, z: delta.z }, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, query);
    const m = this.controller.computedMovement();
    let next = { x: feet.x + m.x, y: startY + m.y, z: feet.z + m.z };
    // The controller can let a capsule creep into a gap a little smaller than it (a standing
    // player through a window): refuse a move that ends inside the level when it didn't start there.
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
        // Too steep to walk up: stay where we were.
        next = { x: feet.x, y: next.y, z: feet.z };
        at = g0;
      }
      // Below the ground: up onto it. A little above it and not on anything else: down onto it.
      if (next.y < at || (!grounded && delta.y <= 0 && next.y - at < PLAYER.maxStepHeight + START_LIFT)) {
        movedY += at - next.y;
        next.y = at;
        grounded = true;
      }
    }
    collider.setTranslation({ x: next.x, y: next.y + centerY, z: next.z });
    return { feet: next, grounded, movedY };
  }

  /** Whether a player body `height` tall fits standing at `feet` (room to stand or crouch up). */
  headroom(feet: Vec3, height: number, radius: number = PLAYER.radius, query = MOVE_QUERY): boolean {
    const r = radius - 0.03;
    const half = Math.max(0.01, height / 2 - r);
    const hit = this.world.intersectionWithShape({ x: feet.x, y: feet.y + height / 2 + 0.03, z: feet.z }, { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Capsule(half, r), undefined, query);
    return !hit;
  }

  /** The level box a static collider was built from (undefined for terrain and scenario bodies). */
  boxAt(handle: number): WorldBox | undefined {
    return this.staticBoxes.get(handle);
  }

  /** The environment placement and surface behind a collider (undefined for everything else). */
  shapeAt(handle: number): { sourceId: string; surface: SurfaceTypeId } | undefined {
    return this.staticShapes.get(handle);
  }

  /** How many environment colliders the world has (tests, diagnostics). */
  get environmentColliders(): number {
    return this.staticShapes.size;
  }

  /** Like raycastWorld, but also returns the collider handle that was hit (shots: bulletproof glass stops them too). */
  raycastHit(origin: Vec3, dir: Vec3, maxDist: number): { dist: number; handle: number } | null {
    const hit = this.world.castRay(this.rayFrom(origin, dir), maxDist, true, undefined, SHOT_QUERY, this.shotSkip ?? undefined);
    return hit ? { dist: hit.timeOfImpact, handle: hit.collider.handle } : null;
  }

  /** Like raycastHit, plus the surface normal (for bouncing grenades and sticking mines). */
  raycastNormal(origin: Vec3, dir: Vec3, maxDist: number): { dist: number; handle: number; normal: Vec3 } | null {
    const hit = this.world.castRayAndGetNormal(this.rayFrom(origin, dir), maxDist, true, undefined, SHOT_QUERY, this.shotSkip ?? undefined);
    return hit ? { dist: hit.timeOfImpact, handle: hit.collider.handle, normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z } } : null;
  }

  /** Distance along a normalised ray to the first static surface, or null within maxDist. */
  raycastWorld(origin: Vec3, dir: Vec3, maxDist: number): number | null {
    const hit = this.world.castRay(this.rayFrom(origin, dir), maxDist, true, undefined, WORLD_ONLY_QUERY);
    return hit ? hit.timeOfImpact : null;
  }

  /**
   * Distance along a normalised ray to the first thing a body walks into or stands on (the level, terrain, glass,
   * force fields: what moves collide with), or null within maxDist. The navigation audit's falls and drop links.
   */
  moveRay(origin: Vec3, dir: Vec3, maxDist: number): number | null {
    if (this.dirty) this.commit();
    const hit = this.world.castRay(this.rayFrom(origin, dir), maxDist, true, undefined, MOVE_QUERY);
    return hit ? hit.timeOfImpact : null;
  }

  /**
   * Straight down from `origin` to the first thing a vehicle stands on (map geometry, terrain, glass, other
   * mounts), leaving out `skip` (the vehicle's own box): the distance, or null within maxDist. Suspension rays.
   */
  groundBelow(origin: Vec3, maxDist: number, skip: RAPIER.Collider): number | null {
    const hit = this.world.castRay(this.rayFrom(origin, DOWN), maxDist, true, undefined, GROUND_QUERY, skip);
    return hit ? hit.timeOfImpact : null;
  }

  /** The shared ray, set to `origin` and `dir`. */
  private rayFrom(origin: Vec3, dir: Vec3): RAPIER.Ray {
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
   */
  boxClear(center: Vec3, half: Vec3, skip?: RAPIER.Collider, levelOnly = false): boolean {
    if (this.dirty) this.commit();
    const shape = new RAPIER.Cuboid(Math.max(0.01, half.x), Math.max(0.01, half.y), Math.max(0.01, half.z));
    const level = levelOnly ? (c: RAPIER.Collider) => this.staticBoxes.has(c.handle) || this.staticShapes.has(c.handle) || c.collisionGroups() >>> 16 === GROUP_TERRAIN : undefined;
    return !this.world.intersectionWithShape(center, { x: 0, y: 0, z: 0, w: 1 }, shape, undefined, WORLD_ONLY_QUERY, skip, undefined, level);
  }

  /** True when nothing static blocks the segment a -> b. */
  lineOfSight(a: Vec3, b: Vec3): boolean {
    if (!simProfile.on) return this.lineOfSightNow(a, b);
    const t0 = performance.now();
    const r = this.lineOfSightNow(a, b);
    simProfile.add('los', performance.now() - t0);
    simProfile.count('los');
    return r;
  }

  private lineOfSightNow(a: Vec3, b: Vec3): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-6) return true;
    // Straight into the shared ray (no vectors made): a third cheaper than a fresh Ray per sight line.
    const r = this.ray;
    r.origin.x = a.x;
    r.origin.y = a.y;
    r.origin.z = a.z;
    r.dir.x = dx / len;
    r.dir.y = dy / len;
    r.dir.z = dz / len;
    return !this.world.castRay(r, len, true, undefined, SIGHT_QUERY);
  }

  free(): void {
    this.world.free();
  }
}
