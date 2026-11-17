import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

/**
 * How far a held gun goes into the hands that hold it, as drawn (team tool, `?mode=grips`, `__grips.inside()`;
 * tools/content/grip-audit.mjs): for each hand, its skin's vertices (those its hand chain holds at least half) drawn
 * inside the gun: behind the face of the gun nearest them (the face's own winding says which side is in), within
 * REACH of it. `verts`: how many, `depth`: the deepest (world m; the grip page draws bodies at the game's 1.8 m). And
 * the other way, the gun's surface inside the hand's skin (ray parity), how many points and how deep: the grip
 * showing through a palm.
 * A palm sat on a grip, fingers round it, has none; a grip showing through the palm or fingers has many, centimetres
 * deep (owner, 2026-11-17: "some of the palms show the pistol grip through it").
 */
export interface GripInside {
  /** The hand's vertices inside the gun: how many, the deepest (m), of how many. */
  verts: number;
  depth: number;
  of: number;
  /** The gun's vertices inside the hand (behind the hand's nearest face: the grip showing through the palm). */
  gunVerts: number;
  gunDepth: number;
}

/** Further than this behind a gun's face is not "inside" it (a thin grip's far side, or a hand past the gun). */
const REACH = 0.04;
/** Less than this behind a face is the skin lying on it. */
const TOUCH = 0.002;

const HAND = (side: 'l' | 'r') => new RegExp(`(?:^|_)(hand|index|middle|ring|pinky|thumb)(_0\\d)?_${side}$`);

interface Tri {
  a: Vector3;
  b: Vector3;
  c: Vector3;
  n: Vector3;
}

/** The gun's triangles in world space (its drawn meshes, any detail it is drawn at). */
function gunTriangles(weapon: TransformNode): Tri[] {
  const out: Tri[] = [];
  for (const m of weapon.getChildMeshes(false)) {
    if (!m.isEnabled() || !m.isVisible) continue;
    const pos = m.getVerticesData(VertexBuffer.PositionKind);
    const idx = m.getIndices();
    if (!pos || !idx) continue;
    m.computeWorldMatrix(true);
    const w = m.getWorldMatrix();
    const at = (i: number) => Vector3.TransformCoordinates(new Vector3(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!), w);
    // A mirrored node turns its winding over.
    const flip = w.determinant() < 0 ? -1 : 1;
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const a = at(idx[t]!);
      const b = at(idx[t + 1]!);
      const c = at(idx[t + 2]!);
      const n = Vector3.Cross(b.subtract(a), c.subtract(a)).scale(flip);
      const l = n.length();
      if (l < 1e-12) continue;
      out.push({ a, b, c, n: n.scale(1 / l) });
    }
  }
  return out;
}

/** The nearest point on a triangle (Ericson, Real-Time Collision Detection, 5.1.5). */
function nearest(p: Vector3, t: Tri): Vector3 {
  const ab = t.b.subtract(t.a);
  const ac = t.c.subtract(t.a);
  const ap = p.subtract(t.a);
  const d1 = Vector3.Dot(ab, ap);
  const d2 = Vector3.Dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return t.a;
  const bp = p.subtract(t.b);
  const d3 = Vector3.Dot(ab, bp);
  const d4 = Vector3.Dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return t.b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return t.a.add(ab.scale(d1 / (d1 - d3)));
  const cp = p.subtract(t.c);
  const d5 = Vector3.Dot(ab, cp);
  const d6 = Vector3.Dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return t.c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return t.a.add(ac.scale(d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return t.b.add(t.c.subtract(t.b).scale((d4 - d3) / (d4 - d3 + (d5 - d6))));
  const den = 1 / (va + vb + vc);
  return t.a.add(ab.scale(vb * den)).add(ac.scale(vc * den));
}

/** Each hand's skin as drawn, in world space (skinned here through the skeleton's last matrices): its vertices and its triangles. */
function handSkin(meshes: readonly AbstractMesh[], side: 'l' | 'r'): { pts: Vector3[]; tris: Tri[] } {
  const re = HAND(side);
  const pts: Vector3[] = [];
  const tris: Tri[] = [];
  for (const mesh of meshes) {
    if (!mesh.skeleton || mesh.isDisposed() || !mesh.isEnabled() || /_lod/i.test(mesh.name)) continue;
    const bi = mesh.getVerticesData(VertexBuffer.MatricesIndicesKind);
    const bw = mesh.getVerticesData(VertexBuffer.MatricesWeightsKind);
    const pos = mesh.getVerticesData(VertexBuffer.PositionKind);
    const idx = mesh.getIndices();
    if (!bi || !bw || !pos) continue;
    const sk = mesh.skeleton;
    const on = sk.bones.map((b) => re.test(b.getTransformNode()?.name ?? b.name));
    const mats = sk.getTransformMatrices(mesh);
    mesh.computeWorldMatrix(true);
    const w = mesh.getWorldMatrix();
    const flip = w.determinant() < 0 ? -1 : 1;
    const count = Math.min(pos.length / 3, bw.length / 4);
    const drawn = new Map<number, Vector3>();
    for (let v = 0; v < count; v++) {
      let held = 0;
      for (let k = 0; k < 4; k++) if (on[bi[v * 4 + k]!]) held += bw[v * 4 + k]!;
      if (held < 0.5) continue;
      const x = pos[v * 3]!;
      const y = pos[v * 3 + 1]!;
      const z = pos[v * 3 + 2]!;
      let ax = 0;
      let ay = 0;
      let az = 0;
      for (let k = 0; k < 4; k++) {
        const wk = bw[v * 4 + k]!;
        if (!wk) continue;
        const o = bi[v * 4 + k]! * 16;
        ax += wk * (mats[o]! * x + mats[o + 4]! * y + mats[o + 8]! * z + mats[o + 12]!);
        ay += wk * (mats[o + 1]! * x + mats[o + 5]! * y + mats[o + 9]! * z + mats[o + 13]!);
        az += wk * (mats[o + 2]! * x + mats[o + 6]! * y + mats[o + 10]! * z + mats[o + 14]!);
      }
      const p = Vector3.TransformCoordinates(new Vector3(ax, ay, az), w);
      drawn.set(v, p);
      pts.push(p);
    }
    if (!idx) continue;
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const a = drawn.get(idx[t]!);
      const b = drawn.get(idx[t + 1]!);
      const c = drawn.get(idx[t + 2]!);
      if (!a || !b || !c) continue;
      const n = Vector3.Cross(b.subtract(a), c.subtract(a)).scale(flip);
      const l = n.length();
      if (l > 1e-12) tris.push({ a, b, c, n: n.scale(1 / l) });
    }
  }
  return { pts, tris };
}

/** Points behind the nearest of `faces` (inside what they wrap), within REACH: how many and the deepest. */
function behind(points: readonly Vector3[], faces: readonly Tri[]): { verts: number; depth: number } {
  const lo = new Vector3(Infinity, Infinity, Infinity);
  const hi = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const t of faces) for (const p of [t.a, t.b, t.c]) {
    lo.minimizeInPlace(p);
    hi.maximizeInPlace(p);
  }
  let verts = 0;
  let depth = 0;
  for (const p of points) {
    if (p.x < lo.x - REACH || p.y < lo.y - REACH || p.z < lo.z - REACH || p.x > hi.x + REACH || p.y > hi.y + REACH || p.z > hi.z + REACH) continue;
    let best = Infinity;
    let back = 0;
    for (const t of faces) {
      const q = nearest(p, t);
      const d = Vector3.DistanceSquared(p, q);
      if (d < best) {
        best = d;
        back = -Vector3.Dot(p.subtract(q), t.n);
      }
    }
    const dist = Math.sqrt(best);
    // Inside: behind its nearest face (and that face sees it square on: not past an edge), within reach.
    if (back > TOUCH && back > 0.7 * dist && dist < REACH) {
      verts++;
      depth = Math.max(depth, dist);
    }
  }
  return { verts, depth: Math.round(depth * 1000) / 1000 };
}

/** How many times a ray from `o` along `d` crosses the triangles (Möller–Trumbore, both faces). */
function crossings(o: Vector3, d: Vector3, tris: readonly Tri[]): number {
  let n = 0;
  for (const t of tris) {
    const e1 = t.b.subtract(t.a);
    const e2 = t.c.subtract(t.a);
    const p = Vector3.Cross(d, e2);
    const det = Vector3.Dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det;
    const s = o.subtract(t.a);
    const u = Vector3.Dot(s, p) * inv;
    if (u < 0 || u > 1) continue;
    const q = Vector3.Cross(s, e1);
    const v = Vector3.Dot(d, q) * inv;
    if (v < 0 || u + v > 1) continue;
    if (Vector3.Dot(e2, q) * inv > 1e-6) n++;
  }
  return n;
}
/** Rays a point inside a hand crosses an odd number of times (three, a vote: the hand is open at the wrist). */
const RAYS = [new Vector3(0.577, 0.577, 0.577), new Vector3(-0.707, 0, 0.707), new Vector3(0, -0.894, -0.447)];

/**
 * The gun's surface inside a hand: points on the gun's faces near the hand (corners, edge middles, centres) inside
 * the hand's skin by ray parity, and how deep (their distance to the skin).
 */
function gunInHand(gun: readonly Tri[], hand: readonly Tri[]): { verts: number; depth: number } {
  if (!hand.length) return { verts: 0, depth: 0 };
  const lo = new Vector3(Infinity, Infinity, Infinity);
  const hi = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const t of hand) for (const p of [t.a, t.b, t.c]) {
    lo.minimizeInPlace(p);
    hi.maximizeInPlace(p);
  }
  const seen = new Set<string>();
  let verts = 0;
  let depth = 0;
  for (const t of gun) {
    const mid = t.a.add(t.b).add(t.c).scale(1 / 3);
    for (const p of [t.a, t.b, t.c, mid, t.a.add(t.b).scale(0.5), t.b.add(t.c).scale(0.5), t.c.add(t.a).scale(0.5)]) {
      if (p.x < lo.x || p.y < lo.y || p.z < lo.z || p.x > hi.x || p.y > hi.y || p.z > hi.z) continue;
      const key = `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let odd = 0;
      for (const d of RAYS) if (crossings(p, d, hand) % 2 === 1) odd++;
      if (odd < 2) continue;
      let best = Infinity;
      for (const h of hand) best = Math.min(best, Vector3.DistanceSquared(p, nearest(p, h)));
      const dist = Math.sqrt(best);
      if (dist < TOUCH) continue;
      verts++;
      depth = Math.max(depth, dist);
    }
  }
  return { verts, depth: Math.round(depth * 1000) / 1000 };
}

/** The gun inside each hand, as drawn: the hand's skin inside the gun, and the gun inside the hand. */
export function gripInside(meshes: readonly AbstractMesh[], weapon: TransformNode): Record<'l' | 'r', GripInside> {
  const gun = gunTriangles(weapon);
  const result = {} as Record<'l' | 'r', GripInside>;
  for (const side of ['l', 'r'] as const) {
    const hand = handSkin(meshes, side);
    const inGun = behind(hand.pts, gun);
    const inHand = gunInHand(gun, hand.tris);
    result[side] = { verts: inGun.verts, depth: inGun.depth, of: hand.pts.length, gunVerts: inHand.verts, gunDepth: inHand.depth };
  }
  return result;
}
