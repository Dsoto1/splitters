import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { WeaponHold } from '@tiletrigger/shared';

/**
 * Where a character's hands are DRAWN, for tests and the grip tool: the skin
 * of each hand (its vertices mostly on the hand and finger joints) put through
 * the skeleton's last prepared matrices, as the GPU draws it. The IK's own
 * measure (CharacterAnimator.gripMiss) says where the joints went; a hand whose
 * skin doesn't sit on its joint as the rig's does (a Meshy hand turned away
 * from the grip) passes that and still draws beside the gun. This doesn't.
 */
export interface DrawnHand {
  /** Centre of the hand's skin (world). */
  centre: Vector3;
  /** Wrist joint (world). */
  wrist: Vector3;
  /** From the wrist to the far end of the skin (the fingertips), unit (world). */
  along: Vector3;
  /** Across the hand's flat (its thinnest way: out of the palm or the back of the hand), unit, sign arbitrary (world). */
  flat: Vector3;
  /** Skin vertices measured. */
  count: number;
}

/** The thinnest direction of a cloud of points (the normal of its best-fit plane). */
function thinnest(pts: readonly Vector3[], centre: Vector3): Vector3 {
  const c = [0, 0, 0, 0, 0, 0]; // xx yy zz xy xz yz
  for (const p of pts) {
    const x = p.x - centre.x;
    const y = p.y - centre.y;
    const z = p.z - centre.z;
    c[0]! += x * x; c[1]! += y * y; c[2]! += z * z; c[3]! += x * y; c[4]! += x * z; c[5]! += y * z;
  }
  const mul = (v: Vector3) => new Vector3(c[0]! * v.x + c[3]! * v.y + c[4]! * v.z, c[3]! * v.x + c[1]! * v.y + c[5]! * v.z, c[4]! * v.x + c[5]! * v.y + c[2]! * v.z);
  const power = (start: Vector3, not?: Vector3) => {
    let v = start.normalize();
    for (let i = 0; i < 40; i++) {
      let next = mul(v);
      if (not) next = next.subtract(not.scale(Vector3.Dot(next, not)));
      if (next.lengthSquared() < 1e-20) break;
      v = next.normalize();
    }
    return v;
  };
  const a = power(new Vector3(0.6, 0.5, 0.62));
  const b = power(new Vector3(-0.3, 0.8, 0.1).subtract(a.scale(Vector3.Dot(new Vector3(-0.3, 0.8, 0.1), a))), a);
  return Vector3.Cross(a, b).normalize();
}

const HAND = (side: 'l' | 'r') => new RegExp(`^(hand|index|middle|ring|pinky|thumb)(_0\\d)?_${side}$`);

export function drawnHand(meshes: readonly AbstractMesh[], hand: TransformNode, side: 'l' | 'r'): DrawnHand | null {
  const re = HAND(side);
  const pts: Vector3[] = [];
  for (const m of meshes) {
    const sk = m.skeleton;
    if (!sk || m.isDisposed() || !m.isEnabled() || !m.isVisible) continue;
    const bi = m.getVerticesData(VertexBuffer.MatricesIndicesKind);
    const bw = m.getVerticesData(VertexBuffer.MatricesWeightsKind);
    const pos = m.getVerticesData(VertexBuffer.PositionKind);
    if (!bi || !bw || !pos) continue;
    const on = sk.bones.map((b) => re.test(b.getTransformNode()?.name ?? b.name));
    if (!on.some(Boolean)) continue;
    const mats = sk.getTransformMatrices(m);
    const world = m.getWorldMatrix();
    const n = Math.min(pos.length / 3, bw.length / 4);
    for (let v = 0; v < n; v++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (on[bi[v * 4 + k]!]) w += bw[v * 4 + k]!;
      if (w < 0.5) continue;
      const p = [pos[v * 3]!, pos[v * 3 + 1]!, pos[v * 3 + 2]!];
      const acc = [0, 0, 0];
      for (let k = 0; k < 4; k++) {
        const wk = bw[v * 4 + k]!;
        if (!wk) continue;
        const o = bi[v * 4 + k]! * 16;
        for (let c = 0; c < 3; c++) acc[c]! += wk * (mats[o + c]! * p[0]! + mats[o + 4 + c]! * p[1]! + mats[o + 8 + c]! * p[2]! + mats[o + 12 + c]!);
      }
      pts.push(Vector3.TransformCoordinates(new Vector3(acc[0], acc[1], acc[2]), world));
    }
    // The first mesh with the hand on it is the one drawn near (later ones are its copies or low-detail stand-ins).
    if (pts.length) break;
  }
  if (pts.length < 6) return null;
  hand.computeWorldMatrix(true);
  const wrist = hand.getAbsolutePosition().clone();
  const centre = pts.reduce((a, p) => a.addInPlace(p), Vector3.Zero()).scale(1 / pts.length);
  const far = pts.map((p) => ({ p, d: Vector3.Distance(p, wrist) })).sort((a, b) => b.d - a.d).slice(0, Math.max(3, Math.floor(pts.length * 0.15)));
  const tip = far.reduce((a, x) => a.addInPlace(x.p), Vector3.Zero()).scale(1 / far.length);
  return { centre, wrist, along: tip.subtract(wrist).normalize(), flat: thinnest(pts, centre), count: pts.length };
}

/**
 * How a held gun sits in the drawn hands: for each hand that has a point on
 * the gun, the distance (world m, divided by `scale` for model m) from its
 * skin's centre to that point. A hand on the grip wraps it, so its centre is
 * within a hand's half-thickness of the point; one beside, under or behind the
 * gun is several centimetres off. `aheadR`: how far the shooting hand's
 * fingers point along the barrel (1 straight ahead; a hand turned away from
 * the grip, fingers up or back, is near 0 or below); `sideR`: how squarely
 * the shooting hand's flat faces across the gun (1: palm against the grip's
 * side; a hand lying palm up or down under or over the gun is near 0).
 */
export function gripReport(meshes: readonly AbstractMesh[], arms: { r: { hand: TransformNode }; l: { hand: TransformNode } }, weapon: TransformNode, hold: WeaponHold, scale: number): { r: number | null; l: number | null; aheadR: number | null; sideR: number | null } {
  weapon.computeWorldMatrix(true);
  const wm = weapon.getWorldMatrix();
  const at = (p: readonly number[]) => Vector3.TransformCoordinates(new Vector3(p[0], p[1], p[2]), wm);
  const r = drawnHand(meshes, arms.r.hand, 'r');
  const l = hold.support ? drawnHand(meshes, arms.l.hand, 'l') : null;
  const s = Math.abs(scale) || 1;
  return {
    r: r ? Vector3.Distance(r.centre, at(hold.grip)) / s : null,
    l: l && hold.support ? Vector3.Distance(l.centre, at(hold.support)) / s : null,
    // The shooting hand's fingers run forward along the gun (round its grip), never back or out to the side.
    aheadR: r ? Vector3.Dot(r.along, Vector3.TransformNormal(new Vector3(0, 0, 1), wm).normalize()) : null,
    // ...and lies flat against the grip's side: its palm faces across the gun (1), not up, down or along it.
    sideR: r ? Math.abs(Vector3.Dot(r.flat, Vector3.Cross(Vector3.TransformNormal(new Vector3(0, 1, 0), wm), Vector3.TransformNormal(new Vector3(0, 0, 1), wm)).normalize())) : null,
  };
}

/**
 * A hand's own frame from its skin in the bind pose, in the hand joint's
 * space: which way its fingers run (wrist to the far end of the skin) and the
 * palm's normal (the hand's thinnest way, on the thumb's side). A Meshy
 * character's hand needn't sit on its joint as the rig's hand does: the
 * dapper's lies turned a quarter round it, so the clips' hold (made for the
 * rig's hand) showed his palm to the camera and its edge to the grip. Null
 * when the skin has too little on the hand to tell.
 */
export function skinHandFrame(meshes: readonly AbstractMesh[], hand: TransformNode, thumb: TransformNode | undefined, side: 'l' | 'r'): { along: Vector3; palm: Vector3 } | null {
  const re = HAND(side);
  for (const m of meshes) {
    const sk = m.skeleton;
    if (!sk || m.isDisposed()) continue;
    const bi = m.getVerticesData(VertexBuffer.MatricesIndicesKind);
    const bw = m.getVerticesData(VertexBuffer.MatricesWeightsKind);
    const pos = m.getVerticesData(VertexBuffer.PositionKind);
    if (!bi || !bw || !pos) continue;
    const handBone = sk.bones.find((b) => b.getTransformNode() === hand);
    if (!handBone) continue;
    const on = sk.bones.map((b) => re.test(b.getTransformNode()?.name ?? b.name));
    const inv = handBone.getAbsoluteInverseBindMatrix();
    const pts: Vector3[] = [];
    const n = Math.min(pos.length / 3, bw.length / 4);
    for (let v = 0; v < n; v++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (on[bi[v * 4 + k]!]) w += bw[v * 4 + k]!;
      if (w >= 0.5) pts.push(Vector3.TransformCoordinates(new Vector3(pos[v * 3]!, pos[v * 3 + 1]!, pos[v * 3 + 2]!), inv));
    }
    if (pts.length < 24) return null;
    const centre = pts.reduce((a, p) => a.addInPlace(p), Vector3.Zero()).scale(1 / pts.length);
    const far = pts.map((p) => ({ p, d: p.length() })).sort((a, b) => b.d - a.d).slice(0, Math.max(3, Math.floor(pts.length * 0.15)));
    const along = far.reduce((a, x) => a.addInPlace(x.p), Vector3.Zero()).scale(1 / far.length).normalize();
    let palm = thinnest(pts, centre);
    palm = palm.subtract(along.scale(Vector3.Dot(palm, along))).normalize();
    // The palm is the thumb's side (as the rig's hands are read: palmSideWorld).
    const thumbBone = thumb ? sk.bones.find((b) => b.getTransformNode() === thumb) : undefined;
    if (thumbBone) {
      const at = Vector3.TransformCoordinates(thumbBone.getAbsoluteInverseBindMatrix().clone().invert().getTranslation(), inv);
      if (Vector3.Dot(at, palm) < 0) palm.scaleInPlace(-1);
    }
    return { along, palm };
  }
  return null;
}
