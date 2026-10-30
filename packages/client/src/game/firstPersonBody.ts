import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { CharacterInstance } from '../content/characters.ts';
import type { CharacterAnimator } from './characterAnimator.ts';

/**
 * Full-body first person: where the base of your neck sits from the eye (m):
 * behind it (along your facing) and below it. Natural proportions (the eyes
 * are in front of the neck, a head's height above its base); far enough back
 * that looking down shows the chest's outside, never the inside of the collar.
 */
export const FP_NECK_BACK = 0.1;
export const FP_NECK_DROP = 0.17;
/** How far (m) the body may be moved to put the neck there: across, and down / up (a crouch clip lower than the view). */
const PIN_ACROSS = 0.35;
const PIN_DOWN = 0.6;
const PIN_UP = 0.05;
/** Joints whose skin is drawn over the world with the gun (rendering group 1): forearms, hands and fingers. */
const FOREARM = /^(lowerarm|hand|index|middle|ring|pinky|thumb)_/;

/**
 * Your own whole character seen from its eyes (Options → Display → First
 * person: Full body). The body stands in the world (rendering group 0, so
 * walls and water hide it as they hide anyone), its neck just behind and
 * below the camera; the head and neck are shrunk away (CharacterAnimator
 * setFirstPerson) and a hidden ball casts the head's shadow. The forearms and
 * hands are also drawn in group 1 with the viewmodel (after the depth clear),
 * so the hands on the gun never clip into a wall the gun is drawn over. The
 * game's view and the grip tool (tools/gripSheet.ts) both build it here.
 */
export class FirstPersonBodyRig {
  /** Where the feet go this frame (world), before the neck is pinned under the eye. */
  readonly base = new Vector3();
  /** Facing (radians, the game's yaw). */
  yaw = 0;
  private readonly forearms: Mesh[];
  private readonly headShadow: Mesh;
  private readonly neck?: TransformNode;
  private readonly headSize: number;

  constructor(
    scene: Scene,
    private readonly ch: CharacterInstance,
    private readonly anim: CharacterAnimator,
    /** The camera (the eye). */
    private readonly eye: TransformNode,
    /** The node the character hangs from (placed and turned by the rig). */
    private readonly holder: TransformNode,
  ) {
    this.neck = ch.joints.get('neck_01') ?? ch.joints.get('Head');
    const scale = Math.abs(ch.root.scaling.y) || 1;
    this.headSize = 0.24 * scale * (Math.abs(holder.scaling.y) || 1);
    this.forearms = forearmMeshes(ch);
    // The head's shadow: a ball drawn into the shadow map only (no colour, no depth on screen).
    const ball = CreateSphere(`${ch.root.name}_fpHead`, { diameter: 1, segments: 6 }, scene);
    const mat = new StandardMaterial(`${ch.root.name}_fpHeadMat`, scene);
    mat.disableColorWrite = true;
    mat.disableDepthWrite = true;
    ball.material = mat;
    ball.isPickable = false;
    ball.scaling.set(this.headSize * 0.8, this.headSize, this.headSize * 0.9);
    ball.parent = holder;
    this.headShadow = ball;
    anim.setFirstPerson({ view: eye, place: () => this.place() });
  }

  /** Show it (or not: arms-only first person, third person, dead). */
  setEnabled(on: boolean): void {
    for (const m of this.forearms) m.setEnabled(on);
    this.headShadow.setEnabled(on);
  }

  /** After the clips: stand the body at `base`, then move it (a little) so the base of its neck is just behind and below the eye. */
  private place(): void {
    const h = this.holder;
    h.position.copyFrom(this.base);
    h.rotation.y = this.yaw;
    const neck = this.neck;
    if (!neck) return;
    refreshDown(neck, h);
    const at = neck.getAbsolutePosition();
    this.eye.computeWorldMatrix(true);
    const eye = this.eye.getAbsolutePosition();
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const dx = clamp(eye.x - fx * FP_NECK_BACK - at.x, -PIN_ACROSS, PIN_ACROSS);
    const dz = clamp(eye.z - fz * FP_NECK_BACK - at.z, -PIN_ACROSS, PIN_ACROSS);
    const dy = clamp(eye.y - FP_NECK_DROP - at.y, -PIN_DOWN, PIN_UP);
    h.position.set(h.position.x + dx, h.position.y + dy, h.position.z + dz);
    h.computeWorldMatrix(true);
    // The head's shadow, where the head would be (in the holder's own space: it turns with the body).
    const scale = Math.abs(h.scaling.y) || 1;
    this.headShadow.position.set((at.x + dx - h.position.x) / scale, (at.y + dy - h.position.y) / scale + this.headSize * 0.7, (at.z + dz - h.position.z) / scale);
    const c = Math.cos(-this.yaw);
    const s = Math.sin(-this.yaw);
    const { x, z } = this.headShadow.position;
    this.headShadow.position.x = x * c + z * s;
    this.headShadow.position.z = -x * s + z * c;
  }

  dispose(): void {
    this.anim.setFirstPerson(null);
    for (const m of this.forearms) m.dispose();
    this.headShadow.material?.dispose();
    this.headShadow.dispose();
  }
}

/** World matrices from `top` down to `node` (the joint chain, the clips have just moved it). */
function refreshDown(node: TransformNode, top: TransformNode): void {
  const chain: TransformNode[] = [];
  for (let n: TransformNode | null = node; n; n = n.parent as TransformNode | null) {
    chain.push(n);
    if (n === top) break;
  }
  for (let i = chain.length - 1; i >= 0; i--) chain[i]!.computeWorldMatrix(true);
}

/**
 * Copies of a character's forearm, hand and finger triangles (the skin mostly
 * on those joints), on the same skeleton and material, drawn in rendering
 * group 1 (over the world, with the viewmodel). The body keeps its own copy
 * in group 0: where both draw they are the same pixels.
 */
export function forearmMeshes(ch: CharacterInstance): Mesh[] {
  const out: Mesh[] = [];
  for (const m of ch.meshes) {
    if (!(m instanceof Mesh) || m.isDisposed() || m.isBlocked || !m.skeleton || m.morphTargetManager || !m.getTotalVertices()) continue;
    const indices = m.getIndices();
    const bi = m.getVerticesData(VertexBuffer.MatricesIndicesKind);
    const bw = m.getVerticesData(VertexBuffer.MatricesWeightsKind);
    if (!indices || !bi || !bw) continue;
    const bix = m.getVerticesData(VertexBuffer.MatricesIndicesExtraKind);
    const bwx = m.getVerticesData(VertexBuffer.MatricesWeightsExtraKind);
    const arm = m.skeleton.bones.map((b) => FOREARM.test(b.getTransformNode()?.name ?? b.name));
    const n = m.getTotalVertices();
    const share = new Float32Array(n);
    for (let v = 0; v < n; v++) {
      let w = 0;
      for (let k = 0; k < 4; k++) {
        if (arm[bi[v * 4 + k]!]) w += bw[v * 4 + k]!;
        if (bix && bwx && arm[bix[v * 4 + k]!]) w += bwx[v * 4 + k]!;
      }
      share[v] = w;
    }
    const kept: number[] = [];
    for (let t = 0; t < indices.length; t += 3) {
      const [a, b, c] = [indices[t]!, indices[t + 1]!, indices[t + 2]!];
      if (share[a]! + share[b]! + share[c]! > 1.5) kept.push(a, b, c);
    }
    if (!kept.length) continue;
    const vd = VertexData.ExtractFromMesh(m, false, true);
    vd.indices = kept;
    const fm = new Mesh(`${m.name}_fpForearms`, m.getScene());
    vd.applyToMesh(fm);
    fm.parent = m.parent;
    fm.position.copyFrom(m.position);
    if (m.rotationQuaternion) fm.rotationQuaternion = m.rotationQuaternion.clone();
    else fm.rotation.copyFrom(m.rotation);
    fm.scaling.copyFrom(m.scaling);
    fm.skeleton = m.skeleton;
    fm.numBoneInfluencers = m.numBoneInfluencers;
    fm.material = m.material;
    fm.sideOrientation = m.sideOrientation;
    fm.hasVertexAlpha = m.hasVertexAlpha;
    fm.useVertexColors = m.useVertexColors;
    fm.receiveShadows = m.receiveShadows;
    fm.isPickable = false;
    fm.alwaysSelectAsActiveMesh = true;
    fm.renderingGroupId = 1;
    fm.metadata = { castsNoShadow: true };
    out.push(fm);
  }
  return out;
}
