import RAPIER from '@dimforge/rapier3d-compat';
import type { WorldBox } from '../map/geometry.ts';
import type { Vec3 } from '../math.ts';
import { PLAYER } from './constants.ts';

let initPromise: Promise<void> | undefined;

/** Load the Rapier WASM module once. Safe to call repeatedly. */
export function initPhysics(): Promise<void> {
  initPromise ??= RAPIER.init();
  return initPromise;
}

// Interaction groups: high 16 bits = membership, low 16 bits = filter.
const GROUP_WORLD = 0x0001;
const GROUP_PLAYER = 0x0002;
const groups = (membership: number, filter: number): number => ((membership << 16) | filter) >>> 0;
const WORLD_COLLIDER_GROUPS = groups(GROUP_WORLD, 0xffff);
const PLAYER_COLLIDER_GROUPS = groups(GROUP_PLAYER, 0xffff);
/** Queries that should only see static map geometry (movement, line of sight, shot occlusion). */
const WORLD_ONLY_QUERY = groups(0xffff, GROUP_WORLD);

const CAPSULE_HALF_HEIGHT = (PLAYER.height - PLAYER.radius * 2) / 2;
const CAPSULE_CENTER_Y = PLAYER.height / 2;
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

  constructor(boxes: readonly WorldBox[], terrain: { positions: Float32Array; indices: Uint32Array } | null = null) {
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    if (terrain) this.world.createCollider(RAPIER.ColliderDesc.trimesh(terrain.positions, terrain.indices).setCollisionGroups(WORLD_COLLIDER_GROUPS));
    for (const b of boxes) {
      const hx = (b.max[0] - b.min[0]) / 2;
      const hy = (b.max[1] - b.min[1]) / 2;
      const hz = (b.max[2] - b.min[2]) / 2;
      const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(b.min[0] + hx, b.min[1] + hy, b.min[2] + hz)
        .setCollisionGroups(WORLD_COLLIDER_GROUPS);
      this.world.createCollider(desc);
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
    const desc = RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, PLAYER.radius).setCollisionGroups(PLAYER_COLLIDER_GROUPS);
    return this.world.createCollider(desc);
  }

  /**
   * A world collider that scenario objects (doors, crates) move, enable and
   * disable. It blocks movement, shots and line of sight like static geometry.
   * `yaw` turns the box about the vertical axis (see viewDirection()).
   */
  createBox(center: Vec3, half: Vec3, yaw = 0): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
      .setTranslation(center.x, center.y, center.z)
      .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
      .setCollisionGroups(WORLD_COLLIDER_GROUPS);
    this.dirty = true;
    return this.world.createCollider(desc);
  }

  moveBox(collider: RAPIER.Collider, center: Vec3): void {
    const t = collider.translation();
    if (t.x === center.x && t.y === center.y && t.z === center.z) return;
    collider.setTranslation(center);
    this.dirty = true;
  }

  setBoxEnabled(collider: RAPIER.Collider, enabled: boolean): void {
    if (collider.isEnabled() === enabled) return;
    collider.setEnabled(enabled);
    this.dirty = true;
  }

  /** Bring scene queries up to date after boxes moved. Cheap when nothing changed. */
  commit(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.world.step();
  }

  removeCollider(collider: RAPIER.Collider): void {
    this.world.removeCollider(collider, false);
  }

  /**
   * Move a player capsule (feet position) by `delta`, sliding along static
   * geometry. Other players never block movement, which keeps client
   * prediction independent of remote player positions.
   */
  moveCharacter(collider: RAPIER.Collider, feet: Vec3, delta: Vec3): { feet: Vec3; grounded: boolean; movedY: number } {
    const startY = feet.y + START_LIFT;
    collider.setTranslation({ x: feet.x, y: startY + CAPSULE_CENTER_Y, z: feet.z });
    this.controller.computeColliderMovement(collider, { x: delta.x, y: delta.y - START_LIFT, z: delta.z }, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, WORLD_ONLY_QUERY);
    const m = this.controller.computedMovement();
    const next = { x: feet.x + m.x, y: startY + m.y, z: feet.z + m.z };
    collider.setTranslation({ x: next.x, y: next.y + CAPSULE_CENTER_Y, z: next.z });
    return { feet: next, grounded: this.controller.computedGrounded(), movedY: m.y + START_LIFT };
  }

  /** Like raycastWorld, but also returns the collider handle that was hit. */
  raycastHit(origin: Vec3, dir: Vec3, maxDist: number): { dist: number; handle: number } | null {
    const hit = this.world.castRay(new RAPIER.Ray(origin, dir), maxDist, true, undefined, WORLD_ONLY_QUERY);
    return hit ? { dist: hit.timeOfImpact, handle: hit.collider.handle } : null;
  }

  /** Like raycastHit, plus the surface normal (for bouncing grenades and sticking mines). */
  raycastNormal(origin: Vec3, dir: Vec3, maxDist: number): { dist: number; handle: number; normal: Vec3 } | null {
    const hit = this.world.castRayAndGetNormal(new RAPIER.Ray(origin, dir), maxDist, true, undefined, WORLD_ONLY_QUERY);
    return hit ? { dist: hit.timeOfImpact, handle: hit.collider.handle, normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z } } : null;
  }

  /** Distance along a normalised ray to the first static surface, or null within maxDist. */
  raycastWorld(origin: Vec3, dir: Vec3, maxDist: number): number | null {
    const hit = this.world.castRay(new RAPIER.Ray(origin, dir), maxDist, true, undefined, WORLD_ONLY_QUERY);
    return hit ? hit.timeOfImpact : null;
  }

  /** True when nothing static blocks the segment a -> b. */
  lineOfSight(a: Vec3, b: Vec3): boolean {
    const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const len = Math.hypot(d.x, d.y, d.z);
    if (len < 1e-6) return true;
    const dir = { x: d.x / len, y: d.y / len, z: d.z / len };
    return this.raycastWorld(a, dir, len) === null;
  }

  free(): void {
    this.world.free();
  }
}
