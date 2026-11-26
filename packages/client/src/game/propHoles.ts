import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { SURFACE_TYPES, type SurfaceTypeId, type Vec3, type WorldBox } from '@tiletrigger/shared';
import { BLOCK_HOLE_SLACK, rayBoxLocalHit, type LocalHit } from './blockHoles.ts';

/**
 * Bullet holes on breakable props (crates, barrels, every solid prop on an 'Everything breaks' map; owner, 2026-11-24).
 * Breakable props are not in the effects world's static shapes (shared `propBoxes` leaves them to the scenario), so a
 * round that stopped on one used to leave no hole. It is found here against the prop's collision boxes as the prop is
 * drawn now (its root node: batched or not, the root is where the prop is), and its hole goes on the root in the root's
 * own frame (ImpactVisuals.holeOn): it rides the prop, goes with it when it breaks (the root switched off) and is
 * cleared when it breaks or comes back (GameView.setPropShown). The same test and decal as blocks (blockHoles.ts).
 */

/** Bullet holes kept on one breakable prop (the oldest reused first). */
export const PROP_HOLE_CAP = 24;
/** Breakable props holed at once (each is one small draw): past it, the prop holed longest ago loses its holes. */
export const PROP_HOLED_MAX = 40;

/** One breakable prop a round can hole: its root, its collision boxes in the root's frame, a bounding sphere, its surface. */
export interface PropHoleTarget {
  node: TransformNode;
  /** Each box's frame relative to the root (box world = rel × root world) and its half sizes in that frame. */
  boxes: { rel: Matrix; half: Vec3 }[];
  /** A sphere round every box, its centre in the root's frame and its radius in the world: a round's ray is tested against it first. */
  centre: Vec3;
  radius: number;
  surface: SurfaceTypeId | null;
  /** Round (a drum, a barrel): its sides are found on the upright cylinder in its box, so holes sit on the curve. */
  round: boolean;
}

/** Props whose boxes stand for an upright cylinder (by model name): drums, barrels, kegs, casks. */
export const isRoundProp = (model: string): boolean => /drum|barrel|keg|cask/i.test(model);

/**
 * The hole targets for a map's breakable props: `boxes` its breakable props' collision boxes (shared `propBoxes(doc,
 * true)`), `nodeOf` a prop's drawn root by placement ID (its lifts already applied), `surfaceOf` a placement's surface.
 */
export function propHoleTargets(boxes: readonly WorldBox[], nodeOf: (id: string) => TransformNode | undefined, surfaceOf: (id: string) => SurfaceTypeId | null, roundOf: (id: string) => boolean = () => false): PropHoleTarget[] {
  const byId = new Map<string, WorldBox[]>();
  for (const b of boxes) {
    const list = byId.get(b.sourceId);
    if (list) list.push(b);
    else byId.set(b.sourceId, [b]);
  }
  const out: PropHoleTarget[] = [];
  for (const [id, list] of byId) {
    const node = nodeOf(id);
    if (!node) continue;
    const inv = node.computeWorldMatrix(true).clone().invert();
    let lo = [Infinity, Infinity, Infinity];
    let hi = [-Infinity, -Infinity, -Infinity];
    const parts = list.map((b) => {
      const c = new Vector3((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
      const half = { x: (b.max[0] - b.min[0]) / 2, y: (b.max[1] - b.min[1]) / 2, z: (b.max[2] - b.min[2]) / 2 };
      const r = Math.hypot(half.x, half.y, half.z);
      lo = [Math.min(lo[0]!, c.x - r), Math.min(lo[1]!, c.y - r), Math.min(lo[2]!, c.z - r)];
      hi = [Math.max(hi[0]!, c.x + r), Math.max(hi[1]!, c.y + r), Math.max(hi[2]!, c.z + r)];
      // The box as placed (its yaw about its centre, as a mesh's rotation.y), then into the root's frame.
      const world = Matrix.RotationY(b.yaw ?? 0).multiply(Matrix.Translation(c.x, c.y, c.z));
      return { rel: world.multiply(inv), half };
    });
    const c = { x: (lo[0]! + hi[0]!) / 2, y: (lo[1]! + hi[1]!) / 2, z: (lo[2]! + hi[2]!) / 2 };
    const centre = Vector3.TransformCoordinatesFromFloatsToRef(c.x, c.y, c.z, inv, new Vector3());
    out.push({ node, boxes: parts, centre: { x: centre.x, y: centre.y, z: centre.z }, radius: Math.hypot(hi[0]! - c.x, hi[1]! - c.y, hi[2]! - c.z), surface: surfaceOf(id), round: roundOf(id) });
  }
  return out;
}

const boxWorld = new Matrix();
const centreNow = new Vector3();

/**
 * The breakable prop a round from `from` stopped on at `to`, as drawn now: its root, the point and face normal in the
 * root's frame and in the world, and its surface. Null: none (a broken prop's root is off, so it is skipped).
 */
export function strikeProp(targets: readonly PropHoleTarget[], from: Vec3, to: Vec3): { node: TransformNode; local: LocalHit; point: Vec3; normal: Vec3; surface: SurfaceTypeId | null } | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len2 = dx * dx + dy * dy + dz * dz;
  if (len2 < 1e-6) return null;
  let best: { t: PropHoleTarget; hit: LocalHit; rel: Matrix } | null = null;
  for (const t of targets) {
    if (!t.node.isEnabled() || t.node.isDisposed()) continue;
    // Quick out: the round's segment passes clear of the prop's sphere, where the prop is now (most props, most rounds).
    const root = t.node.computeWorldMatrix(true);
    Vector3.TransformCoordinatesFromFloatsToRef(t.centre.x, t.centre.y, t.centre.z, root, centreNow);
    const ox = centreNow.x - from.x;
    const oy = centreNow.y - from.y;
    const oz = centreNow.z - from.z;
    const k = Math.max(0, Math.min(1, (ox * dx + oy * dy + oz * dz) / len2));
    const ex = ox - dx * k;
    const ey = oy - dy * k;
    const ez = oz - dz * k;
    if (ex * ex + ey * ey + ez * ez > t.radius * t.radius) continue;
    for (const b of t.boxes) {
      b.rel.multiplyToRef(root, boxWorld);
      let hit = rayBoxLocalHit(from, to, boxWorld, b.half);
      // A drum's side: on the cylinder in its box (none where the round only clipped the box's corner).
      if (hit && t.round && hit.normal.y === 0) hit = rayCylinderLocalHit(from, to, boxWorld, b.half);
      if (hit && (!best || hit.dist < best.hit.dist)) best = { t, hit, rel: b.rel };
    }
  }
  if (!best) return null;
  // From the box's frame into the root's (where the hole goes) and the world's (where the chips fly).
  const point = Vector3.TransformCoordinates(best.hit.point, best.rel);
  const normal = Vector3.TransformNormal(best.hit.normal, best.rel).normalize();
  const world = best.t.node.getWorldMatrix();
  const wp = Vector3.TransformCoordinates(point, world);
  const wn = Vector3.TransformNormal(normal, world).normalize();
  return { node: best.t.node, local: { dist: best.hit.dist, point, normal }, point: { x: wp.x, y: wp.y, z: wp.z }, normal: { x: wn.x, y: wn.y, z: wn.z }, surface: best.t.surface };
}

/**
 * Where a round from `from` that stopped at `to` met the upright cylinder inscribed in a box (half sizes `half`; `world`
 * its world matrix), in the box's frame: as rayBoxLocalHit, for a round prop's sides.
 */
export function rayCylinderLocalHit(from: Vec3, to: Vec3, world: Matrix, half: Vec3): LocalHit | null {
  const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  if (len < 0.05) return null;
  const inv = world.clone().invert();
  const a = Vector3.TransformCoordinates(new Vector3(from.x, from.y, from.z), inv);
  const d = Vector3.TransformCoordinates(new Vector3(to.x, to.y, to.z), inv).subtractInPlace(a);
  const r = Math.min(half.x, half.z);
  const qa = d.x * d.x + d.z * d.z;
  if (qa < 1e-12) return null;
  const qb = 2 * (a.x * d.x + a.z * d.z);
  const qc = a.x * a.x + a.z * a.z - r * r;
  const disc = qb * qb - 4 * qa * qc;
  if (disc < 0) return null;
  const t = (-qb - Math.sqrt(disc)) / (2 * qa);
  if (t < 0) return null;
  const point = a.add(d.scale(t));
  if (Math.abs(point.y) > half.y) return null;
  const dist = t * len;
  if (Math.abs(dist - len) > BLOCK_HOLE_SLACK) return null;
  return { dist, point, normal: new Vector3(point.x, 0, point.z).normalize() };
}

/**
 * The bookkeeping of holes on props (pure; ImpactVisuals keeps the meshes): a ring of up to `cap` slots per prop (the
 * oldest reused), at most `maxProps` props holed at once (the one holed longest ago given up for a new one).
 */
export class HoleBook<K> {
  private readonly rings = new Map<K, { count: number; next: number }>();

  constructor(
    readonly cap: number,
    readonly maxProps: number,
  ) {}

  /** A hole on `key`: the slot it takes, how many holes `key` now has, and the prop given up to make room (if any). */
  add(key: K): { slot: number; count: number; evicted: K | null } {
    let r = this.rings.get(key);
    let evicted: K | null = null;
    if (r) this.rings.delete(key);
    else {
      if (this.rings.size >= this.maxProps) {
        evicted = this.rings.keys().next().value as K;
        this.rings.delete(evicted);
      }
      r = { count: 0, next: 0 };
    }
    // Map order is the order last holed: re-inserted, `key` is now the newest.
    this.rings.set(key, r);
    const slot = r.next;
    r.next = (r.next + 1) % this.cap;
    r.count = Math.min(this.cap, r.count + 1);
    return { slot, count: r.count, evicted };
  }

  /** `key` broke or came back: no holes. True if it had any. */
  clear(key: K): boolean {
    return this.rings.delete(key);
  }

  count(key: K): number {
    return this.rings.get(key)?.count ?? 0;
  }

  /** Props holed now. */
  get size(): number {
    return this.rings.size;
  }

  keys(): IterableIterator<K> {
    return this.rings.keys();
  }
}

/**
 * How a hole looks on a surface: wood a pale splintered rim, metal a small bright dent, stone a wider chip, glass and ice
 * a small frosted pit, soft ground a darker, wider pock; else as walls.
 */
export interface HoleLook {
  key: 'wood' | 'metal' | 'stone' | 'glass' | 'soft' | 'plain';
  /** The decal's tint (multiplies its texture: the dark middle stays dark, the rim takes the colour). */
  tint: [number, number, number];
  /** Its size against a wall hole. */
  scale: number;
}

const LOOKS: Record<HoleLook['key'], HoleLook> = {
  wood: { key: 'wood', tint: [1.25, 1.0, 0.72], scale: 1 },
  metal: { key: 'metal', tint: [1.35, 1.4, 1.5], scale: 0.7 },
  stone: { key: 'stone', tint: [1.05, 1.05, 1.05], scale: 1.15 },
  glass: { key: 'glass', tint: [1.5, 1.65, 1.8], scale: 0.75 },
  soft: { key: 'soft', tint: [0.72, 0.64, 0.55], scale: 1.25 },
  plain: { key: 'plain', tint: [1, 1, 1], scale: 1 },
};

/** The hole look for a surface type (by its impact sound family: wood, metal and sheet, hard and stone, glass and ice, soft), plain when unknown. */
export function holeLook(surface: SurfaceTypeId | null | undefined): HoleLook {
  const sound = surface ? SURFACE_TYPES[surface]?.impact.sound : undefined;
  switch (sound) {
    case 'wood':
      return LOOKS.wood;
    case 'metal':
    case 'sheet':
      return LOOKS.metal;
    case 'hard':
    case 'stone':
      return LOOKS.stone;
    case 'glass':
    case 'ice':
      return LOOKS.glass;
    case 'soft':
      return LOOKS.soft;
    default:
      return LOOKS.plain;
  }
}
