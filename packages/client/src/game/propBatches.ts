import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Material } from '@babylonjs/core/Materials/material';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import '@babylonjs/core/Meshes/thinInstanceMesh';

/**
 * Static props drawn in batches (docs/PERF_96.md, "Performance round 3"). Every placed prop used to be a node of
 * GPU instances (one per material of its merged model): one draw per model and material, but every copy was a mesh
 * Babylon looked at every frame (frustum, level of detail, its matrix copied into the instance buffer). Shingle Point's
 * 446 props were 630 of a frame's 1,300 active meshes. Here the copies of a model in each PROP_SECTOR square are thin
 * instances of one mesh per material: one mesh to look at and one draw per model, material and square, with buffers
 * that only change when a copy changes its level of detail.
 *
 * - **Tints** ride in the instance colour (the same albedo × tint product a tinted copy's own material made).
 * - **Levels of detail**: each copy picks its level by its distance to the camera (with hysteresis) whenever the camera
 *   has moved a metre, as the environment renderer does; a batch's buffer is rebuilt only when a copy joins or leaves.
 * - **Shadows**: batches that never change (no levels of detail) are static thin instances, merged into the shadow
 *   proxies like the instances were. Batches with levels of detail cast as they draw (as instances did). Small clutter
 *   casts only within `smallReach` of the camera: one shadow-only batch per model holds the copies that near.
 * - Collision and shots never used these meshes (the level's shapes and the server do); nothing about them changes.
 *
 * Models that can't be merged (animated, skinned, morphing) or carry a billboard level stay on the instance path, as do
 * props that break or ride movers (the caller keeps those out).
 */

/** Batches are per model, material and square of this many metres (culled per square). */
export const PROP_SECTOR = 128;
/** A copy changes level only once it is this share past the boundary (no flicker at the edge). */
const HYSTERESIS = 0.1;

interface Level {
  /** Camera distance (m) from which this level draws. */
  distance: number;
  /** The level's meshes (one per material), as geometry and material; empty: nothing drawn (culled at range). */
  parts: { data: VertexData; material: Material | null; sideOrientation: number; hasVertexAlpha: boolean }[];
}

interface Model {
  path: string;
  levels: Level[];
  /** Bounding-sphere centre (model space) and radius, for distances. */
  center: Vector3;
  radius: number;
}

interface Copy {
  root: TransformNode;
  matrix: Float32Array;
  color: [number, number, number, number];
  /** World centre and radius of its bounds. */
  x: number;
  y: number;
  z: number;
  r: number;
  level: number;
  small: boolean;
}

interface Batch {
  meshes: Mesh[];
  matrices: Float32Array;
  colors: Float32Array | null;
  dirty: boolean;
}

interface Group {
  model: Model;
  sector: string;
  copies: Copy[];
  tinted: boolean;
  /** Copies joined since the batches were made: they are made again (sizes change). */
  stale: boolean;
  batches: Map<number, Batch>;
}

/** Shadow-only batch of a model's small copies near the camera. */
interface NearCasters {
  model: Model;
  copies: Copy[];
  meshes: Mesh[];
  matrices: Float32Array;
  shown: number;
}

export interface PropBatchStats {
  /** Batch meshes (enabled or not). */
  meshes: number;
  /** Copies drawn through batches. */
  copies: number;
  /** Models batched. */
  models: number;
}

/** What a static model offers for batching: its merged per-material meshes with their levels (ModelLibrary.staticSources). */
export type StaticSources = (path: string) => Promise<Mesh[] | null>;

export class PropBatches {
  private readonly models = new Map<string, Promise<Model | null>>();
  private readonly groups = new Map<string, Group>();
  private readonly near = new Map<string, NearCasters>();
  private lastX = Infinity;
  private lastY = Infinity;
  private lastZ = Infinity;
  private seq = 0;
  private disposed = false;

  constructor(
    private readonly scene: Scene,
    private readonly sources: StaticSources,
    /** Small clutter casts within this many metres of the camera (Atmosphere.SMALL_CASTER_REACH). */
    private readonly smallReach: number,
  ) {}

  /**
   * Draw the prop under `root` (placed and turned: its world matrix is the copy's) as a copy of model `path` in its
   * square's batch. Resolves false when the model can't be batched: the caller draws it as before.
   */
  add(path: string, root: TransformNode, small: boolean, tint: string | null): Promise<boolean> {
    const p = this.join(path, root, small, tint);
    this.pending.push(p);
    return p;
  }

  private readonly pending: Promise<boolean>[] = [];

  /** Every copy added so far is in its batch (or turned away). */
  async settled(): Promise<void> {
    await Promise.allSettled(this.pending);
  }

  private async join(path: string, root: TransformNode, small: boolean, tint: string | null): Promise<boolean> {
    const model = await this.model(path);
    if (!model || this.disposed || root.isDisposed()) return false;
    root.computeWorldMatrix(true);
    // It never moves (props that ride movers aren't batched): its matrix is the copy's for good.
    root.freezeWorldMatrix();
    const w = root.getWorldMatrix();
    const matrix = Float32Array.from(w.m);
    const c = Vector3.TransformCoordinates(model.center, w);
    const s = Math.max(w.getRow(0)!.length(), w.getRow(1)!.length(), w.getRow(2)!.length());
    const color: [number, number, number, number] = tint ? [...Color3.FromHexString(tint).asArray(), 1] as [number, number, number, number] : [1, 1, 1, 1];
    const sector = `${Math.floor(c.x / PROP_SECTOR)}:${Math.floor(c.z / PROP_SECTOR)}`;
    const key = `${path}|${sector}`;
    let g = this.groups.get(key);
    if (!g) this.groups.set(key, (g = { model, sector, copies: [], tinted: false, stale: false, batches: new Map() }));
    const copy: Copy = { root, matrix, color, x: c.x, y: c.y, z: c.z, r: model.radius * s, level: -1, small };
    g.copies.push(copy);
    if (tint) g.tinted = true;
    g.stale = true;
    if (small) this.nearOf(model).copies.push(copy);
    this.lastX = Infinity;
    return true;
  }

  /** The model's levels for batching (null: not batchable). */
  private model(path: string): Promise<Model | null> {
    let p = this.models.get(path);
    if (!p) {
      p = this.sources(path).then(
        (src) => (src ? toModel(path, src) : null),
        () => null,
      );
      this.models.set(path, p);
    }
    return p;
  }

  /**
   * Each frame (cheap unless the camera moved a metre): every copy's level of detail from the camera, the batches
   * whose copies changed level rebuilt, and the small copies near the camera into the shadow-only batches.
   */
  update(camera: Vector3): void {
    if ((camera.x - this.lastX) ** 2 + (camera.y - this.lastY) ** 2 + (camera.z - this.lastZ) ** 2 < 1) return;
    this.lastX = camera.x;
    this.lastY = camera.y;
    this.lastZ = camera.z;
    for (const g of this.groups.values()) {
      if (g.stale) {
        // Copies joined (the props load in a burst): the group's batches are made again at their new size.
        g.stale = false;
        for (const b of g.batches.values()) this.disposeBatch(b);
        g.batches.clear();
        for (const k of g.copies) k.level = -1;
      }
      const levels = g.model.levels;
      for (const c of g.copies) {
        const d = Math.hypot(c.x - camera.x, c.y - camera.y, c.z - camera.z);
        let level = 0;
        for (let i = 1; i < levels.length; i++) if (d >= levels[i]!.distance) level = i;
        if (c.level >= 0 && level !== c.level) {
          const edge = levels[Math.max(level, c.level)]!.distance;
          if (Math.abs(d - edge) < edge * HYSTERESIS) level = c.level;
        }
        if (level === c.level) continue;
        if (c.level >= 0) this.batch(g, c.level).dirty = true;
        this.batch(g, level).dirty = true;
        c.level = level;
      }
      for (const [level, b] of g.batches) if (b.dirty) this.fill(g, level, b);
    }
    for (const n of this.near.values()) this.fillNear(n, camera);
  }

  private batch(g: Group, level: number): Batch {
    let b = g.batches.get(level);
    if (b) return b;
    const n = g.copies.length;
    const matrices = new Float32Array(n * 16);
    const colors = g.tinted ? new Float32Array(n * 4) : null;
    const lod = g.model.levels.length > 1;
    const allSmall = g.copies.every((c) => c.small);
    const meshes = g.model.levels[level]!.parts.map((part, pi) => {
      const mesh = this.partMesh(`static_batch_${this.seq++}_${g.model.path}_l${level}_p${pi}_${g.sector}`, part);
      mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
      if (colors) mesh.thinInstanceSetBuffer('color', colors, 4, false);
      // Never changing (no levels of detail): merged into the shadow proxies like the instances were (shadowProxy.ts).
      // Small clutter casts through its shadow-only batch near the camera instead.
      mesh.metadata = allSmall ? { castsNoShadow: true, propBatch: true } : lod ? { propBatch: true } : { staticThin: true, propBatch: true };
      return mesh;
    });
    b = { meshes, matrices, colors, dirty: true };
    g.batches.set(level, b);
    return b;
  }

  /** A batch mesh from a level part: its own geometry (thin instance buffers live on the geometry), placed for good. */
  private partMesh(name: string, part: Level['parts'][number]): Mesh {
    const mesh = new Mesh(name, this.scene);
    part.data.applyToMesh(mesh, false);
    mesh.material = part.material;
    mesh.sideOrientation = part.sideOrientation;
    mesh.hasVertexAlpha = part.hasVertexAlpha;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    mesh.doNotSyncBoundingInfo = true;
    return mesh;
  }

  private fill(g: Group, level: number, b: Batch): void {
    b.dirty = false;
    let count = 0;
    for (const c of g.copies) {
      if (c.level !== level) continue;
      b.matrices.set(c.matrix, 16 * count);
      b.colors?.set(c.color, 4 * count);
      count++;
    }
    for (const mesh of b.meshes) {
      mesh.setEnabled(count > 0);
      if (!count) continue;
      mesh.thinInstanceCount = count;
      mesh.thinInstanceBufferUpdated('matrix');
      if (b.colors) mesh.thinInstanceBufferUpdated('color');
      // Bounds over the copies drawn, so the batch is culled on its own.
      mesh.thinInstanceRefreshBoundingInfo(false);
    }
  }

  private nearOf(model: Model): NearCasters {
    let n = this.near.get(model.path);
    if (n) return n;
    // Full detail, drawn only into the shadow map (layer mask 0: no camera draws it).
    const level = model.levels[0]!;
    const matrices = new Float32Array(16);
    const meshes = level.parts.map((part, pi) => {
      const mesh = this.partMesh(`static_batch_near_${this.seq++}_${model.path}_p${pi}`, part);
      mesh.layerMask = 0;
      mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
      mesh.thinInstanceCount = 0;
      mesh.setEnabled(false);
      mesh.metadata = { propBatch: true, nearCaster: true };
      return mesh;
    });
    n = { model, copies: [], meshes, matrices, shown: -1 };
    this.near.set(model.path, n);
    return n;
  }

  private fillNear(n: NearCasters, camera: Vector3): void {
    if (n.matrices.length < n.copies.length * 16) {
      n.matrices = new Float32Array(n.copies.length * 16);
      for (const m of n.meshes) m.thinInstanceSetBuffer('matrix', n.matrices, 16, false);
      n.shown = -1;
    }
    let count = 0;
    for (const c of n.copies) {
      const d = Math.hypot(c.x - camera.x, c.y - camera.y, c.z - camera.z) - c.r;
      if (d > this.smallReach || !c.root.isEnabled()) continue;
      n.matrices.set(c.matrix, 16 * count++);
    }
    if (count === 0 && n.shown === 0) return;
    n.shown = count;
    for (const m of n.meshes) {
      m.setEnabled(count > 0);
      if (!count) continue;
      m.thinInstanceCount = count;
      m.thinInstanceBufferUpdated('matrix');
      m.thinInstanceRefreshBoundingInfo(false);
    }
  }

  private disposeBatch(b: Batch): void {
    for (const m of b.meshes) m.dispose(false, false);
  }

  /** Counts for tests and the perf probe. */
  stats(): PropBatchStats {
    let meshes = 0;
    let copies = 0;
    const models = new Set<string>();
    for (const g of this.groups.values()) {
      copies += g.copies.length;
      models.add(g.model.path);
      for (const b of g.batches.values()) meshes += b.meshes.length;
    }
    return { meshes, copies, models: models.size };
  }

  dispose(): void {
    this.disposed = true;
    for (const g of this.groups.values()) for (const b of g.batches.values()) this.disposeBatch(b);
    this.groups.clear();
    for (const n of this.near.values()) for (const m of n.meshes) m.dispose(false, false);
    this.near.clear();
  }
}

/** The levels of a static model's merged meshes (ModelLibrary.mergeModel), or null when one is a billboard. */
function toModel(path: string, sources: readonly Mesh[]): Model | null {
  if (!sources.length) return null;
  const part = (m: Mesh) => ({ data: VertexData.ExtractFromMesh(m, true, true), material: m.material, sideOrientation: m.sideOrientation, hasVertexAlpha: m.hasVertexAlpha });
  const levels: Level[] = [{ distance: 0, parts: sources.map(part) }];
  for (const l of sources[0]!.getLODLevels()) {
    // A billboard turns per copy, which thin instances can't: such models keep their instances.
    if (l.mesh && l.mesh.billboardMode !== Mesh.BILLBOARDMODE_NONE) return null;
    levels.push({ distance: l.distanceOrScreenCoverage, parts: l.mesh ? [part(l.mesh)] : [] });
  }
  levels.sort((a, b) => a.distance - b.distance);
  // Bounds in the model's space (the sources are parked away from it: their own geometry is in the model's space).
  let min = new Vector3(Infinity, Infinity, Infinity);
  let max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const m of sources) {
    const bb = m.getBoundingInfo().boundingBox;
    min = Vector3.Minimize(min, bb.minimum);
    max = Vector3.Maximize(max, bb.maximum);
  }
  const center = min.add(max).scale(0.5);
  return { path, levels, center, radius: max.subtract(min).length() / 2 };
}
