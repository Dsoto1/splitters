import type { Vec3 } from '../math.ts';
import { PLAYER, quantize } from './constants.ts';
import type { MoveState } from './movement.ts';

/**
 * Portals (Style Packs 03 Imperial Arena and 09 Sands of Egypt): linked pairs
 * of surfaces. Going into the front of one brings you out of the front of the
 * other, moving the same way relative to it: a rigid turn about the vertical
 * by the difference in the portals' facings (plus a half turn, since you go
 * in against one's facing and come out along the other's). Positions,
 * velocities and view directions all turn by that one angle, so speed is kept.
 *
 * Shared by the server (Match), client prediction (LocalPlayer) and the bots'
 * navigation, so everyone teleports at exactly the same tick.
 */

/** A portal as movement sees it. */
export interface Portal {
  /** Entity index of the portal (logic switches it by this). */
  i: number;
  id: string;
  pair: string;
  /** Centre of its bottom edge. */
  pos: Vec3;
  yaw: number;
  /** Facing (out of its front), horizontal unit vector. */
  nx: number;
  nz: number;
  width: number;
  height: number;
  /** Index (in the list) of the portal it leads to; -1: unpaired (it does nothing). */
  link: number;
}

/** How far in front of its surface a body is caught by a portal (the capsule's radius plus a hand's breadth). */
export const PORTAL_REACH = PLAYER.radius + 0.12;
/** How far in front of the exit portal you come out (clear of its catch, so you never bounce straight back). */
export const PORTAL_EXIT = PLAYER.radius + 0.3;

type PortalLike = { kind: string; id: string; position: [number, number, number]; yaw?: number; size?: unknown; pair?: string };

/** The portals of a map, each linked to the other one of its pair (pairs of more or fewer than two do nothing). */
export function mapPortals(entities: readonly PortalLike[]): Portal[] {
  const out: Portal[] = [];
  entities.forEach((e, i) => {
    if (e.kind !== 'portal' || typeof e.pair !== 'string') return;
    const yaw = e.yaw ?? 0;
    const [w, h] = Array.isArray(e.size) ? (e.size as [number, number]) : [2.4, 3.2];
    out.push({ i, id: e.id, pair: e.pair, pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, yaw, nx: Math.sin(yaw), nz: Math.cos(yaw), width: w, height: h, link: -1 });
  });
  const byPair = new Map<string, number[]>();
  out.forEach((p, k) => byPair.set(p.pair, [...(byPair.get(p.pair) ?? []), k]));
  for (const ks of byPair.values()) {
    if (ks.length !== 2) continue;
    out[ks[0]!]!.link = ks[1]!;
    out[ks[1]!]!.link = ks[0]!;
  }
  return out;
}

/** The turn (radians about +Y, in yaw terms) from going into `a` to coming out of `b`. */
export const portalTurn = (a: Portal, b: Portal): number => b.yaw - a.yaw + Math.PI;

/** Turn a horizontal vector by `turn` in yaw terms: the direction a yaw θ looks along becomes the one θ + turn does. */
export function turnXZ(x: number, z: number, turn: number): [number, number] {
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  return [x * c + z * s, -x * s + z * c];
}

/** A point's place relative to a portal: across (to its right seen from the front), up from its base, out from its surface. */
function local(p: Portal, at: Vec3): { across: number; up: number; out: number } {
  const dx = at.x - p.pos.x;
  const dz = at.z - p.pos.z;
  return { across: dx * p.nz - dz * p.nx, up: at.y - p.pos.y, out: dx * p.nx + dz * p.nz };
}

/** Where a point relative to `a` comes out relative to `b` (the rigid turn), set `out` metres in front of `b`. */
export function throughPortal(a: Portal, b: Portal, at: Vec3, out: number): Vec3 {
  const [rx, rz] = turnXZ(at.x - a.pos.x, at.z - a.pos.z, portalTurn(a, b));
  const shift = out - (rx * b.nx + rz * b.nz);
  return { x: b.pos.x + rx + b.nx * shift, y: b.pos.y + Math.max(0, at.y - a.pos.y), z: b.pos.z + rz + b.nz * shift };
}

/** Whether a body at `feet` (height `height`, radius `radius`) is inside a portal's opening, side to side and top to bottom. */
function inOpening(p: Portal, feet: Vec3, radius: number, height: number): boolean {
  const l = local(p, feet);
  return Math.abs(l.across) <= p.width / 2 - radius * 0.5 && l.up >= -0.6 && l.up + Math.min(height, 1.2) <= p.height + 0.1;
}

/**
 * Step through a portal: a body that moved from `before` to `after` this tick
 * and came within reach of an enabled portal's front, moving toward it,
 * inside its opening, comes out of the linked portal. Returns the new state
 * and the turn (to add to the view's yaw), or null when nothing happened.
 */
export function applyPortals(portals: readonly Portal[], before: MoveState, after: MoveState, enabled: (entity: number) => boolean = () => true, scale = 1, height: number = PLAYER.height): { state: MoveState; turn: number; from: number; to: number } | null {
  if (!portals.length) return null;
  const radius = PLAYER.radius * scale;
  for (const a of portals) {
    if (a.link < 0) continue;
    const l0 = local(a, before.pos);
    const l1 = local(a, after.pos);
    // From in front (or on the surface), coming closer, now within reach of it.
    if (l0.out < -0.05 || l1.out > PORTAL_REACH * scale || l1.out >= l0.out - 1e-4) continue;
    if (!inOpening(a, after.pos, radius, height * scale)) continue;
    const b = portals[a.link]!;
    if (!enabled(a.i) || !enabled(b.i)) continue;
    const turn = portalTurn(a, b);
    const at = throughPortal(a, b, after.pos, PORTAL_EXIT * scale);
    const [vx, vz] = turnXZ(after.vx ?? 0, after.vz ?? 0, turn);
    const state: MoveState = {
      ...after,
      pos: { x: quantize(at.x), y: quantize(at.y), z: quantize(at.z) },
      ...(after.vx || after.vz ? { vx: quantize(vx), vz: quantize(vz) } : {}),
    };
    return { state, turn, from: a.i, to: b.i };
  }
  return null;
}

/**
 * A straight segment (a projectile's move this tick) crossing a portal's
 * surface from the front, inside its opening: how far along (0..1) it
 * crosses, the portal it leaves by and where and how it carries on.
 */
export function portalSegment(portals: readonly Portal[], from: Vec3, to: Vec3, enabled: (entity: number) => boolean = () => true): { t: number; a: Portal; b: Portal; turn: number } | null {
  let best: { t: number; a: Portal; b: Portal; turn: number } | null = null;
  for (const a of portals) {
    if (a.link < 0) continue;
    const d0 = local(a, from).out - 0.04;
    const d1 = local(a, to).out - 0.04;
    if (d0 < 0 || d1 >= 0) continue;
    const t = d0 / (d0 - d1);
    const hit = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t };
    const l = local(a, hit);
    if (Math.abs(l.across) > a.width / 2 || l.up < 0 || l.up > a.height) continue;
    const b = portals[a.link]!;
    if (!enabled(a.i) || !enabled(b.i)) continue;
    if (!best || t < best.t) best = { t, a, b, turn: portalTurn(a, b) };
  }
  return best;
}

/** Carry a moving point (projectile) through: where it comes out and its turned velocity. */
export function portalCarry(a: Portal, b: Portal, at: Vec3, vel: Vec3): { pos: Vec3; vel: Vec3 } {
  const turn = portalTurn(a, b);
  const p = throughPortal(a, b, at, 0.1);
  const [vx, vz] = turnXZ(vel.x, vel.z, turn);
  return { pos: { ...p, y: b.pos.y + (at.y - a.pos.y) }, vel: { x: vx, y: vel.y, z: vz } };
}

/** Where a bot steps into a portal (in front of its middle, on its base) and where it comes out. */
export function portalEntry(p: Portal, d = 1.0): Vec3 {
  return { x: p.pos.x + p.nx * d, y: p.pos.y, z: p.pos.z + p.nz * d };
}

/**
 * Navmesh links for bots: one each way through every pair, from just in
 * front of one portal to just in front of the other (the way out).
 */
export function portalLinks(portals: readonly Portal[]): { start: Vec3; end: Vec3; portal: string; reach: Vec3 }[] {
  const reach = { x: 1.2, y: 1.5, z: 1.2 };
  return portals.filter((p) => p.link >= 0).map((p) => ({ start: portalEntry(p, 0.9), end: portalEntry(portals[p.link]!, PORTAL_EXIT + 0.6), portal: p.id, reach }));
}
