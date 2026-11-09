/**
 * Hit shapes: where a round meets a body (docs/CHARACTERS.md, "Hitboxes"; docs/GUNPLAY_SPEC.md §11).
 *
 * Every look has its own shapes, measured from its model as the game draws it standing, crouching and prone
 * (tools/content/hitboxes.mjs → content/hitboxes.generated.ts): a head sphere, a torso capsule squashed across the
 * body, a round capsule for each thigh and shin, and arm capsules where the arms stick out of the rest. The zone is
 * the shape the ray meets first (head sphere: head, legs: legs, torso and arms: body), not a height band. The
 * shapes turn with the body's yaw, take its stance, and scale with its size; there is no per-frame animation (the
 * host has no skeleton). The player's movement collider is separate (physics.ts) and unchanged.
 *
 * Deterministic (plain arithmetic, no caches that change results) and the same on the host and every client.
 * Which shapes a look has (the measured table) is sim/lookHitbox.ts, on its own: the menu reaches this module (weapons),
 * and the table it doesn't need (about 32 kB gzip) stays out of its first JS (docs/LOADING.md).
 */
import type { Vec3 } from '../math.ts';
import { HITBOX_MARGIN, type Stance } from './constants.ts';
import type { HitZone } from './weapons.ts';

/** A capsule squashed across the body: `x` its middle across, `w` half its width, `r` its depth radius, `a`→`b` its axis as [up, forward]. */
export interface BodyCapsule {
  readonly x: number;
  readonly w: number;
  readonly r: number;
  readonly a: readonly [number, number];
  readonly b: readonly [number, number];
}
/** A round capsule (a limb): ends [right, up, forward], radius. */
export interface LimbCapsule {
  readonly a: readonly [number, number, number];
  readonly b: readonly [number, number, number];
  readonly r: number;
}
/** One stance's shapes, in metres at a 1.8 m standard body: +x the body's right, +y up, +z the way it faces, feet at 0. */
export interface HitShapes {
  readonly head?: { readonly x: number; readonly y: number; readonly z: number; readonly r: number };
  readonly torso?: BodyCapsule;
  readonly legs: readonly LimbCapsule[];
  readonly arms: readonly LimbCapsule[];
}
/**
 * A look's measured shapes. `rest`: the model's rest height (the game fits it to 1.8 m); creatures (`creature`)
 * are in their own drawn metres instead, with `wide` (their widest) and `hover`. `crouch` / `prone` null: the
 * standing shapes in every stance (creatures have no such clips).
 */
export interface LookHitbox {
  readonly rest: number;
  readonly wide?: number;
  readonly hover?: number;
  readonly creature?: true;
  readonly stand: HitShapes;
  readonly crouch: HitShapes | null;
  readonly prone: HitShapes | null;
}

/** A body to shoot at: where it stands, which way it faces, its stance, its size and its shapes. */
export interface HitBody {
  feet: Vec3;
  yaw: number;
  stance: Stance;
  /** Multiplies the shapes (size class, a character-stats size, an NPC role's scale). */
  scale: number;
  box: LookHitbox;
}

export function shapesFor(box: LookHitbox, stance: Stance): HitShapes {
  return (stance === 2 ? box.prone : stance === 1 ? box.crouch : null) ?? box.stand;
}

/** A bounding sphere round one stance's shapes, on the body's centre line: [height of its centre, radius]. */
const bounds = new WeakMap<HitShapes, readonly [number, number]>();
export function shapesBounds(s: HitShapes): readonly [number, number] {
  let b = bounds.get(s);
  if (b) return b;
  let lo = Infinity;
  let hi = -Infinity;
  const ys = (y: number, r: number) => {
    lo = Math.min(lo, y - r);
    hi = Math.max(hi, y + r);
  };
  if (s.head) ys(s.head.y, s.head.r);
  if (s.torso) {
    ys(s.torso.a[0], s.torso.r);
    ys(s.torso.b[0], s.torso.r);
  }
  for (const l of [...s.legs, ...s.arms]) {
    ys(l.a[1], l.r);
    ys(l.b[1], l.r);
  }
  const cy = (lo + hi) / 2;
  let R = 0;
  const reach = (x: number, y: number, z: number, r: number) => {
    R = Math.max(R, Math.hypot(x, y - cy, z) + r);
  };
  if (s.head) reach(s.head.x, s.head.y, s.head.z, s.head.r);
  if (s.torso) {
    const w = Math.max(s.torso.w, s.torso.r);
    reach(Math.abs(s.torso.x), s.torso.a[0], s.torso.a[1], w);
    reach(Math.abs(s.torso.x), s.torso.b[0], s.torso.b[1], w);
  }
  for (const l of [...s.legs, ...s.arms]) {
    reach(l.a[0], l.a[1], l.a[2], l.r);
    reach(l.b[0], l.b[1], l.b[2], l.r);
  }
  b = [cy, R];
  bounds.set(s, b);
  return b;
}

/**
 * Ray (from `o`, along `d`) against a capsule `a`→`b` of radius `r`; `d` need not be unit length (the result is
 * in its units). Returns the entry distance, 0 when `o` is inside, or -1 on a miss.
 */
function capsule(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number): number {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const oax = ox - ax, oay = oy - ay, oaz = oz - az;
  const baba = bax * bax + bay * bay + baz * baz;
  const baoa = bax * oax + bay * oay + baz * oaz;
  // Inside already (a muzzle in someone's chest): hit at once.
  const tIn = baba > 1e-12 ? Math.max(0, Math.min(1, baoa / baba)) : 0;
  const ix = oax - bax * tIn, iy = oay - bay * tIn, iz = oaz - baz * tIn;
  if (ix * ix + iy * iy + iz * iz <= r * r) return 0;
  const dd = dx * dx + dy * dy + dz * dz;
  if (baba > 1e-12) {
    const bard = bax * dx + bay * dy + baz * dz;
    const rdoa = dx * oax + dy * oay + dz * oaz;
    const oaoa = oax * oax + oay * oay + oaz * oaz;
    const A = baba * dd - bard * bard;
    if (A > 1e-12) {
      const B = baba * rdoa - baoa * bard;
      const C = baba * oaoa - baoa * baoa - r * r * baba;
      const h = B * B - A * C;
      if (h < 0) return -1;
      const t = (-B - Math.sqrt(h)) / A;
      const y = baoa + t * bard;
      if (y > 0 && y < baba) return t >= 0 ? t : -1;
    }
  }
  // The end caps.
  let best = -1;
  for (let e = 0; e < 2; e++) {
    const cx = e ? ox - bx : oax, cy = e ? oy - by : oay, cz = e ? oz - bz : oaz;
    const B = dx * cx + dy * cy + dz * cz;
    const C = cx * cx + cy * cy + cz * cz - r * r;
    const h = B * B - dd * C;
    if (h < 0) continue;
    const t = (-B - Math.sqrt(h)) / dd;
    if (t >= 0 && (best < 0 || t < best)) best = t;
  }
  return best;
}

/** Least distance between the half-line from `o` along `d` (any length) and the segment `a`→`b`. */
function raySegment(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const dl = Math.hypot(dx, dy, dz) || 1;
  dx /= dl;
  dy /= dl;
  dz /= dl;
  const ex = bx - ax, ey = by - ay, ez = bz - az;
  const wx = ox - ax, wy = oy - ay, wz = oz - az;
  const b = dx * ex + dy * ey + dz * ez;
  const c = ex * ex + ey * ey + ez * ez;
  const dw = dx * wx + dy * wy + dz * wz;
  const ew = ex * wx + ey * wy + ez * wz;
  const den = c - b * b;
  let sAlong = 0;
  let u = c > 1e-12 ? ew / c : 0;
  if (den > 1e-12) {
    sAlong = (b * ew - c * dw) / den;
    u = (ew - b * dw) / den;
  }
  if (sAlong < 0) {
    sAlong = 0;
    u = c > 1e-12 ? ew / c : 0;
  }
  if (u < 0 || u > 1) {
    u = Math.max(0, Math.min(1, u));
    sAlong = Math.max(0, b * u - dw);
  }
  return Math.hypot(wx + dx * sAlong - ex * u, wy + dy * sAlong - ey * u, wz + dz * sAlong - ez * u);
}

/** The zone of the last hit `rayBody` found. */
export const lastHit: { zone: HitZone } = { zone: 0 };

/**
 * A ray against a body's shapes: the distance along `d` (unit length) to the nearest shape within `max`, or null.
 * The zone of that shape is left in `lastHit.zone`. `thick` (world metres) fattens every shape: a thrown spear or a
 * rocket is a body of its own, not a line.
 */
export function rayBody(o: Vec3, d: Vec3, body: HitBody, max = Infinity, thick = 0): number | null {
  const s = shapesFor(body.box, body.stance);
  const k = body.scale;
  // The margin (HITBOX_MARGIN, at the body's size) and a projectile's own thickness fatten every shape.
  const fat = HITBOX_MARGIN.body + thick / k;
  const fatHead = HITBOX_MARGIN.head + thick / k;
  // Broad phase: the stance's bounding sphere.
  const [cy, R0] = shapesBounds(s);
  const R = R0 + Math.max(fat, fatHead);
  const ex = o.x - body.feet.x;
  const ey = o.y - (body.feet.y + cy * k);
  const ez = o.z - body.feet.z;
  const bR = R * k;
  const bb = ex * d.x + ey * d.y + ez * d.z;
  const bc = ex * ex + ey * ey + ez * ez - bR * bR;
  if (bc > 0 && (bb > 0 || bb * bb - bc < 0)) return null;
  if (bc > 0 && -bb - Math.sqrt(bb * bb - bc) > max) return null;
  // Into the body's frame (right, up, forward), in its unscaled metres: t stays the world distance.
  const sin = Math.sin(body.yaw);
  const cos = Math.cos(body.yaw);
  const px = o.x - body.feet.x, py = o.y - body.feet.y, pz = o.z - body.feet.z;
  const lx = (px * cos - pz * sin) / k, ly = py / k, lz = (px * sin + pz * cos) / k;
  const qx = (d.x * cos - d.z * sin) / k, qy = d.y / k, qz = (d.x * sin + d.z * cos) / k;
  // The round strikes the nearest padded surface; its zone is the shape whose own (unpadded) core the line passes
  // deepest into or nearest to: a shot at the face over a padded forearm is still a head shot, one at the belt a body
  // shot, not the thigh's padding.
  let best = max;
  let zone: HitZone | -1 = -1;
  let depth = Infinity;
  const ql = Math.hypot(qx, qy, qz);
  const ux = qx / ql, uy = qy / ql, uz = qz / ql;
  const take = (t: number, z: HitZone, core: number) => {
    if (t < 0 || t > max) return;
    if (t < best) best = t;
    if (core < depth) {
      depth = core;
      zone = z;
    }
  };
  if (s.head) {
    const h = s.head;
    const cx = lx - h.x, cyy = ly - h.y, cz = lz - h.z;
    const dd = qx * qx + qy * qy + qz * qz;
    const B = qx * cx + qy * cyy + qz * cz;
    const hr = h.r + fatHead;
    const C = cx * cx + cyy * cyy + cz * cz - hr * hr;
    const disc = B * B - dd * C;
    const t = C <= 0 ? 0 : disc >= 0 ? (-B - Math.sqrt(disc)) / dd : -1;
    if (t >= 0) {
      // How near the line passes the head's centre, less its own radius.
      const along = Math.max(0, -(ux * cx + uy * cyy + uz * cz));
      take(t, 1, Math.hypot(cx + ux * along, cyy + uy * along, cz + uz * along) - h.r);
    }
  }
  if (s.torso) {
    const c = s.torso;
    const sq = (c.r + fat) / (c.w + fat);
    const t = capsule((lx - c.x) * sq, ly, lz, qx * sq, qy, qz, 0, c.a[0], c.a[1], 0, c.b[0], c.b[1], c.r + fat);
    if (t >= 0) {
      const cs = c.r / c.w;
      take(t, 0, raySegment((lx - c.x) * cs, ly, lz, qx * cs, qy, qz, 0, c.a[0], c.a[1], 0, c.b[0], c.b[1]) - c.r);
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    for (const l of pass ? s.arms : s.legs) {
      const t = capsule(lx, ly, lz, qx, qy, qz, l.a[0], l.a[1], l.a[2], l.b[0], l.b[1], l.b[2], l.r + fat);
      if (t >= 0) take(t, pass ? 0 : 2, raySegment(lx, ly, lz, qx, qy, qz, l.a[0], l.a[1], l.a[2], l.b[0], l.b[1], l.b[2]) - l.r);
    }
  }
  if (zone === -1) return null;
  lastHit.zone = zone;
  return best;
}

/**
 * Where a body's head is (world), for aiming at it: the head sphere's centre, or the top of the body less a
 * head's radius when the shapes have no head.
 */
export function headPoint(body: Pick<HitBody, 'feet' | 'yaw' | 'stance' | 'scale' | 'box'>): Vec3 {
  const s = shapesFor(body.box, body.stance);
  const k = body.scale;
  const h = s.head ?? { x: 0, y: (s.torso ? Math.max(s.torso.a[0], s.torso.b[0]) : 1.5), z: 0 };
  const sin = Math.sin(body.yaw);
  const cos = Math.cos(body.yaw);
  // Body frame to world: right = (cos, 0, -sin), forward = (sin, 0, cos).
  return { x: body.feet.x + (h.x * cos + h.z * sin) * k, y: body.feet.y + h.y * k, z: body.feet.z + (-h.x * sin + h.z * cos) * k };
}

/** A point in a body's frame (right, up, forward; unscaled metres) to the world. */
export function bodyToWorld(body: Pick<HitBody, 'feet' | 'yaw' | 'scale'>, x: number, y: number, z: number): Vec3 {
  const sin = Math.sin(body.yaw);
  const cos = Math.cos(body.yaw);
  const k = body.scale;
  return { x: body.feet.x + (x * cos + z * sin) * k, y: body.feet.y + y * k, z: body.feet.z + (-x * sin + z * cos) * k };
}
