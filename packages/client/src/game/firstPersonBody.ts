import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PLAYER } from '@tiletrigger/shared';
import type { CharacterInstance } from '../content/characters.ts';
import type { CharacterAnimator } from './characterAnimator.ts';

/**
 * Full-body first person: where the base of your neck sits from the eye (m),
 * looking level: behind it (along your facing) and below it. Natural
 * proportions (the eyes are in front of the neck, a head's height above its
 * base). Looking down, the neck goes further back, as a head tipping forward
 * carries the eyes out over the chest: you see your chest and feet from in
 * front of the collar, never down into it.
 */
export const FP_NECK_BACK = 0.1;
export const FP_NECK_DROP = 0.17;
/** How far (m) the body may be moved to put the neck there: across (prone lies a body's length ahead), and down / up. */
const PIN_ACROSS = 1.6;
const PIN_DOWN = 0.25;
const PIN_UP = 0.08;
/** Joints whose skin is drawn over the world with the gun (rendering group 1): forearms, hands and fingers. */
const FOREARM = /^(lowerarm|hand|index|middle|ring|pinky|thumb)_/;

/**
 * Your own whole character seen from its eyes (Options -> Display -> First
 * person: Full body). The body stands in the world (rendering group 0, so
 * walls and water hide it as they hide anyone), its neck just behind and
 * below the camera; the head and neck are shrunk away (CharacterAnimator
 * setFirstPerson) and a ball drawn only into the shadow map casts the head's
 * shadow. The forearms and hands are also drawn in group 1 with the viewmodel
 * (after the depth clear), so the hands on the gun never clip into a wall the
 * gun is drawn over. The game's view and the grip tool (tools/gripSheet.ts)
 * both build it here; each frame they set `base`, `yaw`, `eye` and `pitch`
 * before the scene renders.
 */
export class FirstPersonBodyRig {
  /** Where the feet go this frame (world), before the neck is pinned under the eye. */
  readonly base = new Vector3();
  /** Facing (radians, the game's yaw). */
  yaw = 0;
  /** The camera's position (world) and pitch (radians, the game's: + looks up). */
  readonly eye = new Vector3();
  pitch = 0;
  private readonly forearms: Mesh[];
  /** Meshes wholly on the head (a head, hair, a hat): not drawn at all while seen from inside (the ball casts their shadow). */
  private readonly headOnly: AbstractMesh[];
  private readonly headShadow: Mesh;
  private readonly neck?: TransformNode;
  private readonly headSize: number;
  private enabled = true;

  constructor(
    scene: Scene,
    ch: CharacterInstance,
    private readonly anim: CharacterAnimator,
    /** The node the character hangs from (placed and turned by the rig). */
    private readonly holder: TransformNode,
  ) {
    this.neck = ch.joints.get('neck_01') ?? ch.joints.get('Head');
    this.headSize = 0.24;
    this.forearms = forearmMeshes(ch);
    this.headOnly = this.neck ? headMeshes(ch, this.neck) : [];
    for (const m of this.headOnly) m.setEnabled(false);
    // The head's shadow: a ball drawn into the shadow map only (no colour, no depth on screen).
    const ball = CreateSphere(`${ch.root.name}_fpHead`, { diameter: 1, segments: 6 }, scene);
    const mat = new StandardMaterial(`${ch.root.name}_fpHeadMat`, scene);
    mat.disableColorWrite = true;
    mat.disableDepthWrite = true;
    ball.material = mat;
    ball.isPickable = false;
    ball.scaling.set(this.headSize * 0.8, this.headSize, this.headSize * 0.9);
    this.headShadow = ball;
    anim.setFirstPerson({ place: () => this.place() });
  }

  /** The head's stand-in for shadows. */
  get shadowMesh(): Mesh {
    return this.headShadow;
  }

  /** Show it (or not: arms-only first person, third person, dead). */
  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    for (const m of this.forearms) m.setEnabled(on);
    this.headShadow.setEnabled(on);
  }

  /** After the clips and the aim: move the body (a little) so the base of its neck is just behind and below the eye. */
  private place(): void {
    const h = this.holder;
    h.position.copyFrom(this.base);
    h.rotation.y = this.yaw;
    const neck = this.neck;
    if (!neck) return;
    refreshDown(neck, h);
    const at = neck.getAbsolutePosition();
    const look = Math.max(0, Math.min(Math.PI / 2, -this.pitch));
    const back = FP_NECK_BACK * Math.cos(look) + FP_NECK_DROP * Math.sin(look);
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const dx = clamp(this.eye.x - fx * back - at.x, -PIN_ACROSS, PIN_ACROSS);
    const dz = clamp(this.eye.z - fz * back - at.z, -PIN_ACROSS, PIN_ACROSS);
    const dy = clamp(this.eye.y - FP_NECK_DROP - at.y, -PIN_DOWN, PIN_UP);
    this.headShadow.position.set(at.x + dx, at.y + dy + this.headSize * 0.7, at.z + dz);
    this.headShadow.rotation.y = this.yaw;
    h.position.set(h.position.x + dx, h.position.y + dy, h.position.z + dz);
    // Everything under the holder: the grip that follows measures the joints where they now are.
    h.computeWorldMatrix(true);
    for (const n of h.getDescendants(false)) if (n instanceof TransformNode && !(n instanceof AbstractMesh)) n.computeWorldMatrix(true);
  }

  dispose(): void {
    this.anim.setFirstPerson(null);
    for (const m of this.forearms) m.dispose();
    for (const m of this.headOnly) if (!m.isDisposed()) m.setEnabled(true);
    this.headShadow.material?.dispose();
    this.headShadow.dispose();
  }
}

/** Hang a whole character under `holder` at the player's height, as the match draws everyone (the grip tool's full-body view). */
export function fitFirstPersonBody(ch: CharacterInstance, holder: TransformNode): void {
  ch.root.parent = holder;
  ch.root.rotation.y = 0;
  const { min, max } = ch.root.getHierarchyBoundingVectors(true);
  const h = max.y - min.y;
  if (h > 0.5) ch.root.scaling.scaleInPlace((PLAYER.height * ch.root.scaling.y) / h);
}

/** A character's meshes that lie wholly on the neck and head (skinned only to them, or hung from them). */
function headMeshes(ch: CharacterInstance, neck: TransformNode): AbstractMesh[] {
  const onHead = new Set<TransformNode>([neck, ...neck.getDescendants(false).filter((n): n is TransformNode => n instanceof TransformNode)]);
  const out: AbstractMesh[] = [];
  for (const m of ch.meshes) {
    if (m.isDisposed()) continue;
    if (m.parent && onHead.has(m.parent as TransformNode) && !m.skeleton) {
      out.push(m);
      continue;
    }
    if (!m.skeleton || !m.getTotalVertices()) continue;
    const bi = m.getVerticesData(VertexBuffer.MatricesIndicesKind);
    const bw = m.getVerticesData(VertexBuffer.MatricesWeightsKind);
    if (!bi || !bw || m.getVerticesData(VertexBuffer.MatricesIndicesExtraKind)) continue;
    const head = m.skeleton.bones.map((b) => {
      const t = b.getTransformNode();
      return !!t && onHead.has(t);
    });
    let all = true;
    for (let v = 0; v < bi.length && all; v += 4) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (head[bi[v + k]!]) w += bw[v + k]!;
      if (w < 0.99) all = false;
    }
    if (all) out.push(m);
  }
  return out;
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
