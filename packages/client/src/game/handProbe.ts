import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Bone } from '@babylonjs/core/Bones/bone';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
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
  /**
   * Across the hand's flat (its thinnest way), unit (world): out of the palm where the drawn knuckles tell which side
   * that is (`palm`), else out of the palm or the back of the hand.
   */
  flat: Vector3;
  /** `flat` is out of the palm (the hand's handedness read off its drawn knuckles; see skinHandFrame). */
  palm: boolean;
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

const HAND = (side: 'l' | 'r') => new RegExp(`(?:^|_)(hand|index|middle|ring|pinky|thumb)(_0\\d)?_${side}$`);

export function drawnHand(meshes: readonly AbstractMesh[], hand: TransformNode, side: 'l' | 'r'): DrawnHand | null {
  const re = HAND(side);
  const pts: Vector3[] = [];
  /** The same points posed in their mesh's own space (skinned, before its world matrix), for the handedness. */
  const local: Vector3[] = [];
  let world: Matrix | null = null;
  /** The hand's joints as drawn, in that mesh's space. */
  let joints: { wrist?: Vector3; index?: Vector3; little?: Vector3 } = {};
  for (const m of meshes) {
    const sk = m.skeleton;
    if (!sk || m.isDisposed() || !m.isEnabled() || !m.isVisible) continue;
    const bi = m.getVerticesData(VertexBuffer.MatricesIndicesKind);
    const bw = m.getVerticesData(VertexBuffer.MatricesWeightsKind);
    const pos = m.getVerticesData(VertexBuffer.PositionKind);
    if (!bi || !bw || !pos) continue;
    const names = sk.bones.map((b) => b.getTransformNode()?.name ?? b.name);
    const on = names.map((x) => re.test(x));
    if (!on.some(Boolean)) continue;
    const mats = sk.getTransformMatrices(m);
    const wm = m.getWorldMatrix();
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
      const q = new Vector3(acc[0], acc[1], acc[2]);
      local.push(q);
      pts.push(Vector3.TransformCoordinates(q, wm));
    }
    if (!pts.length) continue;
    // A joint as drawn: its bind position through its own skin matrix.
    const posed = (name: string): Vector3 | undefined => {
      const i = names.indexOf(name);
      if (i < 0) return undefined;
      return Vector3.TransformCoordinates(sk.bones[i]!.getAbsoluteInverseBindMatrix().clone().invert().getTranslation(), Matrix.FromArray(mats, i * 16));
    };
    world = wm;
    joints = { wrist: posed(`hand_${side}`), index: posed(`index_01_${side}`), little: posed(`pinky_01_${side}`) ?? posed(`ring_01_${side}`) ?? posed(`middle_01_${side}`) };
    // The first mesh with the hand on it is the one drawn near (later ones are its copies or low-detail stand-ins).
    break;
  }
  if (pts.length < 6 || !world) return null;
  hand.computeWorldMatrix(true);
  const wrist = hand.getAbsolutePosition().clone();
  const centre = pts.reduce((a, p) => a.addInPlace(p), Vector3.Zero()).scale(1 / pts.length);
  const far = pts.map((p) => ({ p, d: Vector3.Distance(p, wrist) })).sort((a, b) => b.d - a.d).slice(0, Math.max(3, Math.floor(pts.length * 0.15)));
  const tip = far.reduce((a, x) => a.addInPlace(x.p), Vector3.Zero()).scale(1 / far.length);
  let flat = thinnest(pts, centre);
  let palm = false;
  // Which side of the flat is the palm: the hand's handedness from its drawn knuckles, worked out in the mesh's own
  // (glTF, right-handed) space and carried into the world (whose import mirrors it).
  const { wrist: w0, index, little } = joints;
  if (w0 && index && little) {
    const lfar = local.map((p) => ({ p, d: Vector3.Distance(p, w0) })).sort((a, b) => b.d - a.d).slice(0, Math.max(3, Math.floor(local.length * 0.15)));
    const ltip = lfar.reduce((a, x) => a.addInPlace(x.p), Vector3.Zero()).scale(1 / lfar.length);
    const lalong = ltip.subtract(w0).normalize();
    const across = square(index.subtract(little), lalong);
    if (across.length() > 0.1 * Vector3.Distance(ltip, w0)) {
      const handed = Vector3.TransformNormal(handedPalm(lalong, across.normalize(), side), world).normalize();
      const agree = Vector3.Dot(handed, flat);
      if (Math.abs(agree) > 0.2) {
        if (agree < 0) flat = flat.scale(-1);
        palm = true;
      }
    }
  }
  return { centre, wrist, along: tip.subtract(wrist).normalize(), flat, palm, count: pts.length };
}

/** Where the drawn hands are on a held gun (see gripReport). */
export interface GripReport {
  r: number | null;
  l: number | null;
  aheadR: number | null;
  sideR: number | null;
  palmL: number | null;
}

/**
 * How a held gun sits in the drawn hands: for each hand that has a point on
 * the gun, the distance (world m, divided by `scale` for model m) from its
 * skin's centre to that point. A hand on the grip wraps it, so its centre is
 * within a hand's half-thickness of the point; one beside, under or behind the
 * gun is several centimetres off. `aheadR`: how far the shooting hand's
 * fingers point along the barrel (1 straight ahead; a hand turned away from
 * the grip, fingers up or back, is near 0 or below). `sideR`: how squarely
 * the shooting palm faces the grip from its right side (1: palm in against
 * the grip; -1: the back of the hand against it, the palm facing out; near 0:
 * a hand lying palm up or down under or over the gun). `palmL`: how squarely
 * the support palm faces where it holds (a long gun's: up into the handguard;
 * a pistol's: up and in, round the shooting hand; negative: palm down or out).
 * The palm's side comes from the drawn knuckles (drawnHand); a hand without
 * them is read unsigned, as before.
 */
export function gripReport(meshes: readonly AbstractMesh[], arms: { r: { hand: TransformNode }; l: { hand: TransformNode } }, weapon: TransformNode, hold: WeaponHold, scale: number): GripReport {
  weapon.computeWorldMatrix(true);
  const wm = weapon.getWorldMatrix();
  const at = (p: readonly number[]) => Vector3.TransformCoordinates(new Vector3(p[0], p[1], p[2]), wm);
  const r = drawnHand(meshes, arms.r.hand, 'r');
  const l = hold.support ? drawnHand(meshes, arms.l.hand, 'l') : null;
  const s = Math.abs(scale) || 1;
  const up = Vector3.TransformNormal(new Vector3(0, 1, 0), wm).normalize();
  const ahead = Vector3.TransformNormal(new Vector3(0, 0, 1), wm).normalize();
  // The gun's right in the world (left-handed), whether or not its node is mirrored (as characterAnimator's gunAxes).
  const right = Vector3.Cross(up, ahead).normalize();
  const facing = (h: DrawnHand, want: Vector3) => (h.palm ? Vector3.Dot(h.flat, want) : Math.abs(Vector3.Dot(h.flat, want)));
  const supportWant = hold.style === 'long' ? up : up.scale(0.95).add(right.scale(0.3)).normalize();
  return {
    r: r ? Vector3.Distance(r.centre, at(hold.grip)) / s : null,
    l: l && hold.support ? Vector3.Distance(l.centre, at(hold.support)) / s : null,
    // The shooting hand's fingers run forward along the gun (round its grip), never back or out to the side.
    aheadR: r ? Vector3.Dot(r.along, ahead) : null,
    // ...and its palm lies against the grip's right side, facing in across the gun (1), not out, up or down.
    sideR: r ? facing(r, right.scale(-1)) : null,
    palmL: l ? facing(l, supportWant) : null,
  };
}

/** Which way a hand's palm faces, and what said so (the cue that decided, and every cue's vote: + agrees with the palm chosen). */
export interface PalmCues {
  /** The cue that set the palm's sign. */
  by: 'knuckles' | 'curl' | 'thumb' | 'measured' | 'old';
  /**
   * Each cue's say on the hand's flat (its thinnest way, + out of the palm chosen; null: not there or too weak to
   * count). `knuckles`: the hand's handedness (fingers ahead, index on the thumb's side, a right hand's palm on the
   * one side and a left's on the other); `curl`: the finger joints bend toward the palm; `thumb`: the thumb's tip
   * sits on the palm's side of the hand; `measured`: the import's palm side (hands.mjs `palmSide`); `old`: the
   * thumb's first joint against the wrist joint (what was used before 2026-11-05; it flipped hands).
   */
  votes: { knuckles: number | null; curl: number | null; thumb: number | null; measured: number | null; old: number | null };
}

/** How palms are told apart from the backs of hands: `joints` (the hand's own joints, see skinHandFrame) or `old` (the rule before 2026-11-05; the grip audit's "before"). */
let palmRule: 'joints' | 'old' = 'joints';
/** The grip tool's before/after switch (`__grips.palmRule`): hands built after this read their palms by `rule`. */
export function setPalmRule(rule: 'joints' | 'old'): void {
  palmRule = rule;
}

/** A hand joint's bind position in its mesh's space (null: not a bone of this skeleton). */
function bindAt(bones: Map<string, Bone>, name: string): Vector3 | null {
  const b = bones.get(name);
  return b ? b.getAbsoluteInverseBindMatrix().clone().invert().getTranslation() : null;
}

/**
 * A hand's handedness as a palm direction: with the fingers running `along` and `across` pointing from the little
 * finger toward the index (the thumb's side), a right hand's palm is across x along and a left's along x across, in
 * a right-handed space (a glTF mesh's own; Babylon's world, which the import mirrors, has them the other way round).
 */
function handedPalm(along: Vector3, across: Vector3, side: 'l' | 'r'): Vector3 {
  return side === 'r' ? Vector3.Cross(across, along) : Vector3.Cross(along, across);
}

/** `v` with its part along unit `axis` taken out. */
function square(v: Vector3, axis: Vector3): Vector3 {
  return v.subtract(axis.scale(Vector3.Dot(v, axis)));
}

/**
 * A hand's own frame from its skin in the bind pose, in the hand joint's space: which way its fingers run (wrist
 * to the far end of the skin) and its palm's normal (the hand's thinnest way, out of the palm). A Meshy
 * character's hand needn't sit on its joint as the rig's hand does: the dapper's lies turned a quarter round it,
 * so the clips' hold (made for the rig's hand) showed his palm to the camera and its edge to the grip.
 *
 * Which side of the flat is the palm comes from the hand's joints, not the mesh: first its handedness (index and
 * little-finger knuckles across the fingers: a right hand's palm is on one side of them, a left's on the other),
 * then the finger joints' bend toward the palm, then the thumb's tip on the palm side, then the import's measured
 * palm side. (It used to be the thumb's first joint against the wrist joint, nearly level with the flat on most
 * hands: on some it said the back, and the grip turn put the shooting palm outward and the support palm down.)
 * Null when the skin has too little on the hand to tell.
 */
export function skinHandFrame(meshes: readonly AbstractMesh[], joint: (name: string) => TransformNode | undefined, side: 'l' | 'r', measuredPalm?: readonly number[]): ({ along: Vector3; palm: Vector3 } & PalmCues) | null {
  const re = HAND(side);
  const hand = joint(`hand_${side}`);
  if (!hand) return null;
  for (const m of meshes) {
    const sk = m.skeleton;
    if (!sk || m.isDisposed()) continue;
    const bi = m.getVerticesData(VertexBuffer.MatricesIndicesKind);
    const bw = m.getVerticesData(VertexBuffer.MatricesWeightsKind);
    const pos = m.getVerticesData(VertexBuffer.PositionKind);
    if (!bi || !bw || !pos) continue;
    const handBone = sk.bones.find((b) => b.getTransformNode() === hand);
    if (!handBone) continue;
    const bones = new Map(sk.bones.map((b) => [b.getTransformNode()?.name ?? b.name, b] as const));
    const on = sk.bones.map((b) => re.test(b.getTransformNode()?.name ?? b.name));
    // Everything in the mesh's own (bind, glTF: right-handed) space, then into the hand joint's.
    const pts: Vector3[] = [];
    const n = Math.min(pos.length / 3, bw.length / 4);
    for (let v = 0; v < n; v++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (on[bi[v * 4 + k]!]) w += bw[v * 4 + k]!;
      if (w >= 0.5) pts.push(new Vector3(pos[v * 3]!, pos[v * 3 + 1]!, pos[v * 3 + 2]!));
    }
    if (pts.length < 24) return null;
    const wrist = bindAt(bones, handBone.getTransformNode()?.name ?? handBone.name) ?? Vector3.Zero();
    const centre = pts.reduce((a, p) => a.addInPlace(p), Vector3.Zero()).scale(1 / pts.length);
    const far = pts.map((p) => ({ p, d: Vector3.Distance(p, wrist) })).sort((a, b) => b.d - a.d).slice(0, Math.max(3, Math.floor(pts.length * 0.15)));
    const tip = far.reduce((a, x) => a.addInPlace(x.p), Vector3.Zero()).scale(1 / far.length);
    const reach = Math.max(1e-4, Vector3.Distance(tip, wrist));
    const along = tip.subtract(wrist).normalize();
    const flat = square(thinnest(pts, centre), along).normalize();
    const at = (f: string) => bindAt(bones, `${f}_${side}`);

    // Handedness: the knuckles across the hand (index to little finger; the ring or middle finger where there's no little one).
    let knuckles: number | null = null;
    const index = at('index_01');
    const little = at('pinky_01') ?? at('ring_01') ?? at('middle_01');
    if (index && little) {
      const across = square(index.subtract(little), along);
      // Knuckles too close together across the fingers to say (under a fifth of the hand's length) don't count.
      if (across.length() > 0.1 * reach) knuckles = Vector3.Dot(handedPalm(along, across.normalize(), side).normalize(), flat);
    }
    // The fingers' bend: each finger chain's turn from one bone to the next, toward the palm.
    let bend = Vector3.Zero();
    let links = 0;
    for (const f of ['index', 'middle', 'ring', 'pinky']) {
      const chain = [at(`${f}_01`), at(`${f}_02`), at(`${f}_03`), bindAt(bones, `${f}_04_leaf_${side}`)].filter((p): p is Vector3 => !!p);
      for (let i = 2; i < chain.length; i++) {
        const a = chain[i - 1]!.subtract(chain[i - 2]!);
        const b = chain[i]!.subtract(chain[i - 1]!);
        if (a.lengthSquared() < 1e-10 || b.lengthSquared() < 1e-10) continue;
        bend = bend.add(square(b.normalize().subtract(a.normalize()), along));
        links++;
      }
    }
    // (A straight finger, as the re-fitted rigs' are, doesn't count: under about 6 degrees a link.)
    const curl = links && bend.length() / links > 0.1 ? Vector3.Dot(bend.normalize(), flat) : null;
    // The thumb's tip on the palm's side of the hand's flat (out of it by a tenth of the hand's length).
    const thumbTip = at('thumb_03') ?? at('thumb_02');
    const thumbOut = thumbTip ? Vector3.Dot(thumbTip.subtract(centre), flat) / reach : 0;
    const thumb = Math.abs(thumbOut) > 0.1 ? Math.sign(thumbOut) : null;
    const inv = handBone.getAbsoluteInverseBindMatrix();
    const bind = inv.clone().invert();
    const measured = measuredPalm ? Vector3.Dot(Vector3.TransformNormal(new Vector3(measuredPalm[0], measuredPalm[1], measuredPalm[2]), bind).normalize(), flat) : null;
    const thumb1 = at('thumb_01');
    const old = thumb1 ? Math.sign(Vector3.Dot(thumb1.subtract(wrist), flat)) || null : null;
    // The first cue that speaks clearly decides.
    const order: [PalmCues['by'], number | null, number][] = [
      ['knuckles', knuckles, 0.5],
      ['curl', curl, 0.3],
      ['thumb', thumb, 0.5],
      ['measured', measured, 0.3],
      ['old', old, 0],
    ];
    const pick = (palmRule === 'old' ? order.slice(4) : order).find(([, v, least]) => v !== null && Math.abs(v) > least) ?? (['old', 1, 0] as const);
    const sign = Math.sign(pick[1]!) || 1;
    const palm = flat.scale(sign);
    const say = (v: number | null) => (v === null ? null : Math.round(v * sign * 100) / 100);
    return {
      along: Vector3.TransformNormal(along, inv).normalize(),
      palm: square(Vector3.TransformNormal(palm, inv), Vector3.TransformNormal(along, inv).normalize()).normalize(),
      by: pick[0],
      votes: { knuckles: say(knuckles), curl: say(curl), thumb: say(thumb), measured: say(measured), old: say(old) },
    };
  }
  return null;
}
