import { horizontalDistance, normalize, viewDirection, type Vec3 } from '../math.ts';
import { TICK_DT } from '../sim/constants.ts';
import type { PhysicsWorld } from '../sim/physics.ts';
import type { ProjectileSpec } from '../sim/weapons.ts';

/**
 * Small geometric helpers for tactical movement: spotting doorways and
 * corners along a route, picking where to look when "pieing" a corner or
 * clearing a room, and working out a grenade throw that lands where it is
 * meant to (into the room, not into the door frame).
 */

const PROBE_HEIGHT = 1.2;

/**
 * A narrow opening at `at` for something travelling along (dx, dz): solid
 * close by on both sides. Two short raycasts.
 */
export function isDoorway(physics: PhysicsWorld, at: Vec3, dx: number, dz: number, halfWidth = 1.7): boolean {
  const len = Math.hypot(dx, dz) || 1;
  const px = -dz / len;
  const pz = dx / len;
  const o = { x: at.x, y: at.y + PROBE_HEIGHT, z: at.z };
  return physics.raycastWorld(o, { x: px, y: 0, z: pz }, halfWidth) !== null && physics.raycastWorld(o, { x: -px, y: 0, z: -pz }, halfWidth) !== null;
}

/** Turn angle (radians, 0..PI) at corner `b` of the route a → b → c. */
export function turnAngle(a: Vec3, b: Vec3, c: Vec3): number {
  const ux = b.x - a.x;
  const uz = b.z - a.z;
  const vx = c.x - b.x;
  const vz = c.z - b.z;
  const lu = Math.hypot(ux, uz);
  const lv = Math.hypot(vx, vz);
  if (lu < 1e-3 || lv < 1e-3) return 0;
  return Math.acos(Math.max(-1, Math.min(1, (ux * vx + uz * vz) / (lu * lv))));
}

/**
 * Points to look at across a space: rays fanned around `yaw` from `eye`,
 * each ending at the first wall (or `maxDist`). Used to sweep a doorway
 * before going in and to check a room's corners once inside.
 */
export function fanPoints(physics: PhysicsWorld, eye: Vec3, yaw: number, spread: number, count: number, maxDist = 18): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const a = count === 1 ? yaw : yaw - spread + (2 * spread * i) / (count - 1);
    const dir = { x: Math.sin(a), y: 0, z: Math.cos(a) };
    const d = physics.raycastWorld(eye, dir, maxDist) ?? maxDist;
    const reach = Math.max(1.5, d - 0.3);
    out.push({ x: eye.x + dir.x * reach, y: eye.y, z: eye.z + dir.z * reach });
  }
  return out;
}

/** Launch direction of a throw (the sim lifts throws a little so they arc). */
export const THROW_LIFT = 0.12;

/** Where a throw at this yaw/pitch first touches something, or null if it flies on past `maxTicks`. */
export function throwImpact(physics: PhysicsWorld, eye: Vec3, yaw: number, pitch: number, spec: ProjectileSpec, maxTicks = 150): Vec3 | null {
  const aim = normalize({ ...viewDirection(yaw, pitch), y: viewDirection(yaw, pitch).y + THROW_LIFT });
  let pos = { x: eye.x + aim.x * 0.5, y: eye.y + aim.y * 0.5, z: eye.z + aim.z * 0.5 };
  let vel = { x: aim.x * spec.speed, y: aim.y * spec.speed, z: aim.z * spec.speed };
  // Coarser steps than the sim (two ticks at a time) keep this cheap; good enough to land within a metre.
  const step = 2 * TICK_DT;
  for (let t = 0; t < maxTicks; t += 2) {
    vel = { x: vel.x, y: vel.y - spec.gravity * step, z: vel.z };
    const delta = { x: vel.x * step, y: vel.y * step, z: vel.z * step };
    const len = Math.hypot(delta.x, delta.y, delta.z);
    const hit = physics.raycastWorld(pos, { x: delta.x / len, y: delta.y / len, z: delta.z / len }, len);
    if (hit !== null) return { x: pos.x + (delta.x / len) * hit, y: pos.y + (delta.y / len) * hit, z: pos.z + (delta.z / len) * hit };
    pos = { x: pos.x + delta.x, y: pos.y + delta.y, z: pos.z + delta.z };
  }
  return null;
}

/**
 * Yaw and pitch that land a throw near `target` (aiming a little short so a
 * bouncing grenade rolls on to it). Tries the flat arc first (through
 * doorways), then a lob; checks each against the world. Null when neither
 * lands within `tolerance` metres.
 */
export function solveThrow(physics: PhysicsWorld, eye: Vec3, target: Vec3, spec: ProjectileSpec, tolerance = 2): { yaw: number; pitch: number; impact: Vec3 } | null {
  const baseYaw = Math.atan2(target.x - eye.x, target.z - eye.z);
  const full = horizontalDistance(eye, target);
  const v = spec.speed;
  const g = spec.gravity;
  // Straight at it first; then a little to either side (through the middle of a doorway rather than its frame).
  for (const off of [0, -0.12, 0.12, -0.24, 0.24]) {
    const yaw = baseYaw + off;
    // Aim a little short so a bouncing grenade rolls on to it.
    const D = full * (spec.bounce ? 0.85 : 1) / Math.cos(off);
    const H = target.y + 0.3 - eye.y;
    const disc = v ** 4 - g * (g * D * D + 2 * H * v * v);
    if (disc < 0 || D < 1) continue;
    for (const elev of [Math.atan((v * v - Math.sqrt(disc)) / (g * D)), Math.atan((v * v + Math.sqrt(disc)) / (g * D))]) {
      if (elev > 1.25) continue;
      // The sim adds THROW_LIFT to the view direction: find the pitch that gives this elevation.
      let pitch = elev;
      for (let i = 0; i < 4; i++) {
        const d = viewDirection(yaw, pitch);
        pitch += elev - Math.atan2(d.y + THROW_LIFT, Math.hypot(d.x, d.z));
      }
      pitch = Math.max(-1.4, Math.min(1.4, pitch));
      const impact = throwImpact(physics, eye, yaw, pitch, spec);
      // It must come down on the floor near the target, not strike a door frame or wall on the way.
      if (impact && horizontalDistance(impact, target) <= tolerance && Math.abs(impact.y - target.y) < 0.6) return { yaw, pitch, impact };
    }
  }
  return null;
}
