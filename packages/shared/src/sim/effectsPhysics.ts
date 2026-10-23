import RAPIER from '@dimforge/rapier3d-compat';
import type { WorldBox } from '../map/geometry.ts';
import type { Vec3 } from '../math.ts';

/**
 * A physics world for looks only: ragdolls, flying debris and blood drops.
 * It has gravity and the level's static shapes but nothing it does feeds back
 * into the game (each client runs its own), so it can never cause a desync.
 */
const GROUP_STATIC = 0x0001;
const GROUP_DEBRIS = 0x0002;
const GROUP_RAGDOLL = 0x0004;
const groups = (member: number, filter: number) => (member << 16) | filter;

export type EffectShape = { kind: 'box'; half: Vec3 } | { kind: 'capsule'; halfHeight: number; radius: number } | { kind: 'ball'; radius: number };
export type EffectLayer = 'debris' | 'ragdoll';

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export class EffectsWorld {
  readonly world: RAPIER.World;
  private acc = 0;

  constructor(boxes: readonly WorldBox[], terrain: { positions: Float32Array; indices: Uint32Array } | null = null) {
    this.world = new RAPIER.World({ x: 0, y: -20, z: 0 });
    const statics = groups(GROUP_STATIC, GROUP_DEBRIS | GROUP_RAGDOLL | GROUP_STATIC);
    if (terrain) this.world.createCollider(RAPIER.ColliderDesc.trimesh(terrain.positions, terrain.indices).setCollisionGroups(statics));
    for (const b of boxes) {
      if (b.kind === 'barrier') continue;
      const hx = (b.max[0] - b.min[0]) / 2;
      const hy = (b.max[1] - b.min[1]) / 2;
      const hz = (b.max[2] - b.min[2]) / 2;
      const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(b.min[0] + hx, b.min[1] + hy, b.min[2] + hz).setCollisionGroups(statics).setFriction(0.9);
      if (b.yaw) desc.setRotation({ x: 0, y: Math.sin(b.yaw / 2), z: 0, w: Math.cos(b.yaw / 2) });
      this.world.createCollider(desc);
    }
  }

  /** Advance by wall-clock `dt` in fixed 60 Hz steps (at most six per call, so a hitch can't snowball). */
  step(dt: number): void {
    this.acc = Math.min(this.acc + dt, 6 / 60);
    while (this.acc >= 1 / 60) {
      this.world.step();
      this.acc -= 1 / 60;
    }
  }

  /** First static surface along a ray: distance and the surface normal. */
  raycast(from: Vec3, dir: Vec3, maxDist: number): { dist: number; normal: Vec3 } | null {
    const hit = this.world.castRayAndGetNormal(new RAPIER.Ray(from, dir), maxDist, true, undefined, groups(0xffff, GROUP_STATIC));
    return hit ? { dist: hit.timeOfImpact, normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z } } : null;
  }

  /** A dynamic body. Debris bumps into debris; ragdoll parts only into the level (their joints hold them together). */
  addBody(shape: EffectShape, pos: Vec3, rot: Quat, layer: EffectLayer, o: { vel?: Vec3; spin?: Vec3; density?: number } = {}): RAPIER.RigidBody {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation(rot)
        .setLinvel(o.vel?.x ?? 0, o.vel?.y ?? 0, o.vel?.z ?? 0)
        .setAngvel(o.spin ?? { x: 0, y: 0, z: 0 })
        .setLinearDamping(0.1)
        .setAngularDamping(layer === 'ragdoll' ? 0.8 : 0.2)
        .setCcdEnabled(true),
    );
    const desc = shape.kind === 'box' ? RAPIER.ColliderDesc.cuboid(shape.half.x, shape.half.y, shape.half.z) : shape.kind === 'capsule' ? RAPIER.ColliderDesc.capsule(shape.halfHeight, shape.radius) : RAPIER.ColliderDesc.ball(shape.radius);
    desc.setDensity(o.density ?? 1).setFriction(0.8).setRestitution(layer === 'debris' ? 0.3 : 0.05);
    desc.setCollisionGroups(layer === 'debris' ? groups(GROUP_DEBRIS, GROUP_STATIC | GROUP_DEBRIS) : groups(GROUP_RAGDOLL, GROUP_STATIC));
    this.world.createCollider(desc, body);
    return body;
  }

  /** A ball joint holding two bodies together at a shared point (anchors in each body's own frame). */
  ballJoint(a: RAPIER.RigidBody, b: RAPIER.RigidBody, anchorA: Vec3, anchorB: Vec3): void {
    this.world.createImpulseJoint(RAPIER.JointData.spherical(anchorA, anchorB), a, b, true);
  }

  remove(body: RAPIER.RigidBody): void {
    this.world.removeRigidBody(body);
  }

  free(): void {
    this.world.free();
  }
}
