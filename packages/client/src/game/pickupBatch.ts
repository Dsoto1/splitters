import type { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Meshes/thinInstanceMesh';

/**
 * The game's pickups as thin instances (docs/PERF_96.md, "Performance round 3", next; done 2026-11-18): every pickup's
 * shapes (rings, boxes, discs) and models (the guns, the medkit, the ammo box) were a GPU instance each, so one draw
 * per shape and material but a mesh per part for the scene to look at every frame (frustum, its matrix copied into the
 * instance buffer): 35-55 meshes a map. Here each shape or model is one mesh whose thin instances are the pickups'
 * parts: one mesh to look at and one draw per shape (and material) for the pickups in each PICKUP_SECTOR square (one
 * batch for the whole map drew every pickup behind the camera too: a fifth more triangles at eye level).
 *
 * A pickup keeps its node tree (its root spins and bobs, a taken one is switched off): `adopt` swaps every GPU
 * instance under a node for a plain node in the same place and a slot in its source's batch, and `update` (once a
 * frame, after the pickups have moved) copies each slot's node's world matrix into its batch's buffer; a node that is
 * switched off (or under one that is) draws as nothing, a disposed one leaves its batch. MapMaker keeps its own meshes.
 */
/** Pickups are batched per shape and square of this many metres (culled per square). */
export const PICKUP_SECTOR = 48;

export class PickupBatch {
  private readonly batches = new Map<string, Batch>();
  private readonly ids = new WeakMap<Mesh, number>();
  private seq = 0;
  private disposed = false;

  constructor(private readonly scene: Scene) {}

  private readonly waiting: TransformNode[] = [];

  /**
   * Swap every GPU instance under `node` (its own children's too) for a slot in its source's batch, at the next
   * `update`: a model's loader callback measures and places it first (a pickup gun's size is read from its meshes).
   */
  adopt(node: TransformNode): void {
    if (!this.disposed) this.waiting.push(node);
  }

  private take(node: TransformNode): void {
    for (const m of node.getChildMeshes(false)) {
      if (!(m instanceof InstancedMesh)) continue;
      const stand = new TransformNode(m.name, this.scene);
      stand.parent = m.parent;
      stand.position.copyFrom(m.position);
      if (m.rotationQuaternion) stand.rotationQuaternion = m.rotationQuaternion.clone();
      else stand.rotation.copyFrom(m.rotation);
      stand.scaling.copyFrom(m.scaling);
      const at = m.computeWorldMatrix(true).getTranslation();
      const b = this.batchOf(m.sourceMesh, `${Math.floor(at.x / PICKUP_SECTOR)},${Math.floor(at.z / PICKUP_SECTOR)}`);
      b.slots.push(stand);
      b.dirty = true;
      m.dispose(false, false);
    }
  }

  private batchOf(source: Mesh, square: string): Batch {
    let id = this.ids.get(source);
    if (id === undefined) this.ids.set(source, (id = this.seq++));
    const key = `${id}|${square}`;
    let b = this.batches.get(key);
    if (!b || b.mesh.isDisposed()) {
      // Its own copy of the source (the same geometry and material): the source stays parked for its GPU instances
      // elsewhere (a crowd's held guns share the merged gun), and a thin-instanced mesh draws at its own world matrix.
      const mesh = source.clone(`pickupBatch_${id}_${source.name}`, null, true, false)!;
      mesh.parent = null;
      mesh.position.setAll(0);
      mesh.rotationQuaternion = null;
      mesh.rotation.setAll(0);
      mesh.scaling.setAll(1);
      mesh.unfreezeWorldMatrix();
      mesh.computeWorldMatrix(true);
      mesh.freezeWorldMatrix();
      mesh.isPickable = false;
      mesh.setEnabled(true);
      // Small and floating: its shadow counts as small clutter's (only near the camera: Atmosphere).
      mesh.metadata = { ...(mesh.metadata as object | null), smallCaster: true, pickupBatch: true };
      mesh.thinInstanceSetBuffer('matrix', new Float32Array(16), 16, false);
      mesh.thinInstanceCount = 0;
      b = { mesh, slots: [], matrices: new Float32Array(16), dirty: true };
      this.batches.set(key, b);
    }
    return b;
  }

  /** Copy every slot's place into its batch (once a frame, after the pickups have moved). */
  update(): void {
    for (const node of this.waiting.splice(0)) if (!node.isDisposed()) this.take(node);
    for (const b of this.batches.values()) {
      if (b.mesh.isDisposed()) continue;
      const before = b.slots.length;
      b.slots = b.slots.filter((n) => !n.isDisposed());
      const n = b.slots.length;
      if (n !== before) b.dirty = true;
      if (b.matrices.length < Math.max(1, n) * 16) {
        b.matrices = new Float32Array(Math.max(4, n * 2) * 16);
        b.dirty = true;
      }
      for (let i = 0; i < n; i++) {
        const node = b.slots[i]!;
        if (node.isEnabled()) node.computeWorldMatrix(true).copyToArray(b.matrices, i * 16);
        else b.matrices.fill(0, i * 16, i * 16 + 16);
      }
      if (b.dirty) {
        b.mesh.thinInstanceSetBuffer('matrix', b.matrices, 16, false);
        b.dirty = false;
      } else b.mesh.thinInstanceBufferUpdated('matrix');
      b.mesh.thinInstanceCount = n;
      b.mesh.setEnabled(n > 0);
      // Bounds over every copy (its shadow's reach is tested against them); a few dozen matrices.
      if (n) b.mesh.thinInstanceRefreshBoundingInfo(false);
    }
  }

  /** Batch meshes and the pickup parts they draw (tests and the perf probe). */
  stats(): { meshes: number; parts: number } {
    let meshes = 0;
    let parts = 0;
    for (const b of this.batches.values()) {
      if (b.mesh.isDisposed()) continue;
      meshes++;
      parts += b.slots.filter((s) => !s.isDisposed()).length;
    }
    return { meshes, parts };
  }

  /** Whether a node under `root` is a slot drawn now (tests: a pickup's gun has arrived). */
  draws(root: TransformNode, part = ''): boolean {
    for (const b of this.batches.values()) {
      if (b.mesh.isDisposed() || !b.mesh.getTotalVertices()) continue;
      for (const s of b.slots) if (!s.isDisposed() && s.name.startsWith(`${root.name}${part}`) && s.isDescendantOf(root) && s.isEnabled()) return true;
    }
    return false;
  }

  dispose(): void {
    this.disposed = true;
    this.waiting.length = 0;
    for (const b of this.batches.values()) b.mesh.dispose(false, false);
    this.batches.clear();
  }
}

interface Batch {
  mesh: Mesh;
  /** The nodes standing where each copy draws. */
  slots: TransformNode[];
  matrices: Float32Array;
  /** The buffer must be set again (its size or the copies changed). */
  dirty: boolean;
}
