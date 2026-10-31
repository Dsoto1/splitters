import { horizontalDistance, type Vec3, hypot } from '../math.ts';
import type { NavWorld } from '../nav/index.ts';
import { STANCES } from '../sim/constants.ts';
import type { PhysicsWorld } from '../sim/physics.ts';

/**
 * Cover finding on the navmesh: sample walkable points around the bot, keep
 * those right behind something solid (a short ray toward the threat from
 * crouched eye height is blocked close by), and work out how to shoot from
 * there: stand up over low cover, or lean out to one side of tall cover.
 * Costs a few dozen raycasts per search; bots search at most every second
 * or so, only while fighting.
 */

export interface CoverSpot {
  pos: Vec3;
  /** Low cover: hidden crouched, can shoot standing. */
  low: boolean;
  /** Tall cover: step this way (-1 left / 1 right of the threat direction) to shoot; 0 = no firing position. */
  peek: -1 | 0 | 1;
  /** Threat it was chosen against. */
  threat: Vec3;
}

export interface CoverQuery {
  physics: PhysicsWorld;
  nav: NavWorld;
  /** Bot's feet. */
  from: Vec3;
  /** Threat's eye. */
  threat: Vec3;
  /** Search radius (m). */
  radius: number;
  /** Preferred distance to the threat (m). */
  preferred: number;
  /** Spots to keep away from (allies' positions, so a team doesn't stack on one crate). */
  avoid?: readonly Vec3[];
  /** Fleeing: prefer spots further from the threat. */
  away?: boolean;
  rng: () => number;
}

const CROUCH_EYE = STANCES[1].eye - 0.1;
const STAND_EYE = STANCES[0].eye;
const DIRECTIONS = 10;
const RADII = [2.2, 4.5, 7.5];
/** Cover must be within this distance of the spot, between it and the threat. */
const HUG = 2.4;

/** Is a point hidden from the threat behind something close by? Returns the blocker's distance or null. */
function blockedNear(physics: PhysicsWorld, eye: Vec3, threat: Vec3): number | null {
  const dx = threat.x - eye.x;
  const dy = threat.y - eye.y;
  const dz = threat.z - eye.z;
  const d = hypot(dx, dy, dz);
  if (d < 1) return null;
  const hit = physics.raycastWorld(eye, { x: dx / d, y: dy / d, z: dz / d }, Math.min(d - 0.3, HUG));
  return hit;
}

/** Can a point at this eye height see the threat? */
export function exposedTo(physics: PhysicsWorld, eye: Vec3, threat: Vec3): boolean {
  return physics.lineOfSight(eye, threat);
}

export function findCover(q: CoverQuery): CoverSpot | null {
  const { physics, nav, from, threat } = q;
  const toThreat = hypot(threat.x - from.x, threat.z - from.z) || 1;
  let best: { spot: CoverSpot; score: number } | null = null;
  const tried: Vec3[] = [];
  const phase = q.rng() * Math.PI * 2;
  for (const r of RADII) {
    if (r > q.radius) break;
    for (let i = 0; i < DIRECTIONS; i++) {
      const a = phase + (i / DIRECTIONS) * Math.PI * 2;
      const want = { x: from.x + Math.sin(a) * r, y: from.y + 0.4, z: from.z + Math.cos(a) * r };
      const p = nav.closestPoint(want, { x: 1.2, y: 1.6, z: 1.2 });
      if (!p || Math.abs(p.y - from.y) > 2.5) continue;
      if (tried.some((t) => horizontalDistance(t, p) < 0.8)) continue;
      tried.push(p);
      const dThreat = hypot(threat.x - p.x, threat.z - p.z);
      if (dThreat < 3) continue;
      const crouchEye = { x: p.x, y: p.y + CROUCH_EYE, z: p.z };
      const blocker = blockedNear(physics, crouchEye, threat);
      if (blocker === null) continue;
      // The whole body must be hidden, not just its middle (e.g. at the edge of a gap).
      const sx = ((threat.z - p.z) / dThreat) * 0.35;
      const sz = (-(threat.x - p.x) / dThreat) * 0.35;
      if (blockedNear(physics, { x: crouchEye.x + sx, y: crouchEye.y, z: crouchEye.z + sz }, threat) === null) continue;
      if (blockedNear(physics, { x: crouchEye.x - sx, y: crouchEye.y, z: crouchEye.z - sz }, threat) === null) continue;
      // How to shoot from here.
      const standEye = { x: p.x, y: p.y + STAND_EYE, z: p.z };
      const low = exposedTo(physics, standEye, threat);
      let peek: -1 | 0 | 1 = 0;
      if (!low) {
        const lx = (threat.z - p.z) / dThreat;
        const lz = -(threat.x - p.x) / dThreat;
        for (const side of [1, -1] as const) {
          const lean = { x: p.x + lx * side * 1.1, y: p.y + STAND_EYE, z: p.z + lz * side * 1.1 };
          if (exposedTo(physics, lean, threat)) {
            peek = side;
            break;
          }
        }
      }
      const travel = horizontalDistance(from, p);
      let score = -travel * 0.8 - Math.abs(dThreat - q.preferred) * 0.25 + (low || peek ? 3 : 0) + (blocker < 1.2 ? 1 : 0);
      // Don't run toward a close threat to reach cover.
      if (dThreat < toThreat - 1 && toThreat < 12) score -= 4;
      if (q.away) score += (dThreat - toThreat) * 0.5;
      if (q.avoid?.some((o) => horizontalDistance(o, p) < 1.6)) score -= 6;
      if (!best || score > best.score) best = { spot: { pos: { x: p.x, y: p.y, z: p.z }, low, peek, threat: { ...threat } }, score };
    }
  }
  return best?.spot ?? null;
}

/** Is a spot still good cover against this threat (from crouched height)? */
export function stillCovered(physics: PhysicsWorld, spot: Vec3, threat: Vec3): boolean {
  return blockedNear(physics, { x: spot.x, y: spot.y + CROUCH_EYE, z: spot.z }, threat) !== null;
}
