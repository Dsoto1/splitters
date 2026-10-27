import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { CharacterInstance } from '../content/characters.ts';

/** Joints that carry the chest and shoulders (not the arms or head): their skin is what a rifle stock rests against. */
const TORSO = new Set(['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'clavicle_l', 'clavicle_r']);
/** Joints whose meshes never count as torso (rigid gear hung on them is not in the stock's way). */
const LIMBS = /^(upperarm|lowerarm|hand|Head|thigh|calf|foot|index|middle|ring|pinky|thumb)/;
/** Only skin within this distance of the right shoulder joint (model metres) can be in a stock's way. */
const NEAR_SHOULDER = 0.3;
/** Most points kept (one per small cell), to bound the per-frame test. */
const CELL = 0.02;

/**
 * The front of a character's torso around the right shoulder, measured once
 * from its own meshes (body, armour, vests) and kept in the chest joint's
 * space, so it follows the spine as the body aims, leans and turns. Used to
 * set a rifle's stock on the body's surface instead of inside it: a knight's
 * plate or a big body's chest stands well in front of the shoulder joint.
 */
export class TorsoSurface {
  private readonly world: Vector3[];

  private constructor(
    private readonly chest: TransformNode,
    private readonly local: Vector3[],
  ) {
    this.world = local.map(() => Vector3.Zero());
  }

  /** Measure a character in its current pose (null when it has no chest joint or no torso skin). */
  static measure(ch: CharacterInstance): TorsoSurface | null {
    const chest = ch.joints.get('spine_03');
    const shoulder = ch.joints.get('upperarm_r');
    if (!chest || !shoulder) return null;
    ch.root.computeWorldMatrix(true);
    chest.computeWorldMatrix(true);
    shoulder.computeWorldMatrix(true);
    const toChest = chest.getWorldMatrix().clone().invert();
    const shoulderLocal = Vector3.TransformCoordinates(shoulder.getAbsolutePosition(), toChest);
    // The body's forward in chest space: only the front half of the torso matters.
    const forward = Vector3.TransformNormal(Vector3.TransformNormal(new Vector3(0, 0, 1), ch.root.getWorldMatrix()), toChest).normalize();
    const cells = new Map<string, Vector3>();
    const keep = (p: Vector3) => {
      const d = p.subtract(shoulderLocal);
      if (d.length() > NEAR_SHOULDER || Vector3.Dot(d, forward) < -0.05) return;
      const key = `${Math.round(p.x / CELL)},${Math.round(p.y / CELL)},${Math.round(p.z / CELL)}`;
      const had = cells.get(key);
      // Per cell, the point furthest forward (the surface).
      if (!had || Vector3.Dot(p, forward) > Vector3.Dot(had, forward)) cells.set(key, p);
    };
    for (const mesh of ch.meshes) {
      if (mesh.isDisposed() || !mesh.isEnabled() || /_lod/.test(mesh.name) || !mesh.getTotalVertices()) continue;
      const torso = torsoWeights(mesh);
      if (!torso) continue;
      mesh.skeleton?.prepare(true);
      const pos = mesh.getPositionData(!!mesh.skeleton);
      if (!pos) continue;
      mesh.computeWorldMatrix(true);
      const toLocal = mesh.getWorldMatrix().multiply(toChest);
      const at = (i: number) => Vector3.TransformCoordinates(new Vector3(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!), toLocal);
      const n = pos.length / 3;
      const on = (i: number) => torso === 'all' || torso[i]! >= 0.5;
      for (let i = 0; i < n; i++) if (on(i)) keep(at(i));
      // Triangle centres too: low-poly armour has big flat plates with few vertices on them.
      const tris = mesh.getIndices();
      if (tris) {
        for (let t = 0; t + 2 < tris.length; t += 3) {
          const [a, b, c] = [tris[t]!, tris[t + 1]!, tris[t + 2]!];
          if (on(a) && on(b) && on(c)) keep(at(a).add(at(b)).add(at(c)).scale(1 / 3));
        }
      }
    }
    return cells.size ? new TorsoSurface(chest, [...cells.values()]) : null;
  }

  /**
   * How far a stock butt at `butt` (world) must move along `dir` (unit, the
   * barrel's direction) so a stock of `radius` around that line clears the
   * torso, plus `margin`. 0 when it is already clear.
   */
  clearance(butt: Vector3, dir: Vector3, radius: number, margin: number): number {
    this.chest.computeWorldMatrix(true);
    const m = this.chest.getWorldMatrix();
    let push = -Infinity;
    const r2 = radius * radius;
    const d = new Vector3();
    for (let i = 0; i < this.local.length; i++) {
      const p = this.world[i]!;
      Vector3.TransformCoordinatesToRef(this.local[i]!, m, p);
      p.subtractToRef(butt, d);
      const along = Vector3.Dot(d, dir);
      if (d.lengthSquared() - along * along < r2 && along > push) push = along;
    }
    return push === -Infinity ? 0 : Math.max(0, push + margin);
  }
}

/** Per-vertex share of a mesh's skin on torso joints ('all' for rigid gear hung on the torso, null when none). */
function torsoWeights(mesh: AbstractMesh): Float32Array | 'all' | null {
  const skeleton = mesh.skeleton;
  if (!skeleton) {
    for (let n = mesh.parent as TransformNode | null; n; n = n.parent as TransformNode | null) {
      if (TORSO.has(n.name)) return 'all';
      if (LIMBS.test(n.name)) return null;
    }
    return null;
  }
  const indices = mesh.getVerticesData(VertexBuffer.MatricesIndicesKind);
  const weights = mesh.getVerticesData(VertexBuffer.MatricesWeightsKind);
  if (!indices || !weights) return null;
  const torsoBone: boolean[] = [];
  for (const b of skeleton.bones) torsoBone[b.getIndex()] = TORSO.has(b.getTransformNode()?.name ?? b.name);
  const out = new Float32Array(indices.length / 4);
  let any = false;
  for (let v = 0; v < out.length; v++) {
    let w = 0;
    for (let k = 0; k < 4; k++) if (torsoBone[indices[v * 4 + k]!]) w += weights[v * 4 + k]!;
    out[v] = w;
    any ||= w >= 0.5;
  }
  return any ? out : null;
}

/** How far an arm reaches from its shoulder joint to the palm, nearly straight (world units). */
export function armReach(upper: TransformNode, lower: TransformNode, hand: TransformNode, palm: Vector3): number {
  for (const n of [upper, lower, hand]) n.computeWorldMatrix(true);
  const [a, b, c] = [upper, lower, hand].map((n) => n.getAbsolutePosition());
  return (Vector3.Distance(a!, b!) + Vector3.Distance(b!, c!)) * 0.97 + Vector3.TransformNormal(palm, hand.getWorldMatrix()).length();
}

/** The furthest `target` can move along `dir` (unit) and stay within `reach` of `shoulder` (0 when it is already out of reach). */
export function reachAlong(shoulder: Vector3, target: Vector3, dir: Vector3, reach: number): number {
  const d = target.subtract(shoulder);
  const b = Vector3.Dot(d, dir);
  const c = d.lengthSquared() - reach * reach;
  if (c > 0) return 0;
  return -b + Math.sqrt(b * b - c);
}
