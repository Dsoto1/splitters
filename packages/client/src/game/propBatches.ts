import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Material } from '@babylonjs/core/Materials/material';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { pickPropLevel, propLodEdges } from './propLod.ts';
import { bySquare, smallCasts } from './shadowCasters.ts';

/**
 * Static props drawn in batches (docs/PERF_96.md, "Performance round 3"). Every placed prop used to be a node of
 * GPU instances (one per material of its merged model): one draw per model and material, but every copy was a mesh
 * Babylon looked at every frame (frustum, level of detail, its matrix copied into the instance buffer). Shingle Point's
 * 446 props were 630 of a frame's 1,300 active meshes. Here the copies of a model in each PROP_SECTOR square are thin
 * instances of one mesh per material: one mesh to look at and one draw per model, material and square, with buffers
 * that only change when a copy changes its level of detail.
 *
 * - **Tints** ride in the instance colour (the same albedo × tint product a tinted copy's own material made).
 * - **Levels of detail**: each copy picks its level by its distance to the camera whenever the camera has moved a
 *   metre, as the environment renderer does, at distances set by its size on screen with hysteresis (propLod.ts: no
 *   pop a few metres away, no flicker at the line); a batch's buffer is rebuilt only when a copy joins or leaves.
 * - **Shadows**: batches that never change (no levels of detail) are static thin instances, merged into the shadow
 *   proxies like the instances were. Batches with levels of detail cast as they draw (as instances did). Small clutter
 *   casts only within `smallReach` of the camera: one shadow-only batch per model holds the copies that near. With
 *   `shadowSets` (cheaper small casters, game/shadowCasters.ts; `?perfoff=smallcasters` turns it off) batches with
 *   levels of detail cast nothing: a static shadow-only batch per square at full detail does, merged into the proxies
 *   like the others, and small clutter's near batch takes copies in a band (in at 20 m, out past 24 m: no flicker).
 * - Collision and shots never used these meshes (the level's shapes and the server do); nothing about them changes.
 *
 * - **Breakable props** (a destruction map's, a log given health: shared `isBreakableProp`) are copies too, in batches of
 *   their own (`breakable`): a broken one leaves its batch's buffer (`shown`, from its root switched off: GameView's
 *   breakProp and applyPropStates) and comes back with the next round, the batch's meshes kept. Their batches are never
 *   merged into the shadow proxies, so a broken prop's shadow goes with it; they count their changes (`thinVersion`),
 *   so the static shadow cache (shadowCache.ts) keeps them while none breaks, as it keeps a door standing still.
 *
 * Models that can't be merged (animated, skinned, morphing) or carry a billboard level stay on the instance path, as do
 * props that ride movers (the caller keeps those out). `?perfoff=breakbatch` keeps breakable props out too (GameView).
 */

/** Batches are per model, material and square of this many metres (culled per square) at full detail. */
export const PROP_SECTOR = 128;
/**
 * Lighter levels of detail are batched by wider squares: twice as wide a level, at most four times (128, 256, 512 m).
 * Far copies are small and few to a square: St. John's beds, dressers and chairs at range were a draw for every few.
 */
export function propSectorSize(level: number): number {
  return PROP_SECTOR * Math.min(4, 2 ** Math.max(0, level));
}
/**
 * A model is batched only when the map has at least this many copies of it. Fewer copies draw as GPU instances: one
 * draw per material for all of them, where batches split them by square and level of detail (Market Town's 54 props,
 * five copies at most of any model, came out at twice the draws and no fewer meshes).
 */
export const PROP_BATCH_MIN = 8;
/**
 * Whether the game draws a prop in the batches: its model has PROP_BATCH_MIN copies on the map (`copies`), and it
 * doesn't break, or breakable props are batched too (`breakBatched`, on unless `?perfoff=breakbatch`; off, a prop the
 * map makes breakable (`breakable`: shared isBreakableProp) or the catalogue calls breakable is its own node, as before).
 */
export function joinsPropBatch(copies: number, breakable: boolean, catalogueBreakable: boolean, breakBatched: boolean): boolean {
  return copies >= PROP_BATCH_MIN && (breakBatched || (!breakable && !catalogueBreakable));
}

interface Level {
  /** Camera distance (m) from which this level draws, as the model was written (each copy's own: Copy.edges). */
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
  /** Where each level starts for this copy (propLod.ts propLodEdges: by its size on screen). */
  edges: number[];
  small: boolean;
  /** Under a roof or the floor above (shared `indoorProps`): out of the sun's shadow pass. */
  indoor: boolean;
  /** In its model's near-shadow batch now (small clutter, `shadowSets`: the band's memory). */
  nearIn: boolean;
  /** Whether it casts no shadow at range: every copy of the model in its PROP_SECTOR square is small clutter, or it is indoors. */
  quiet: boolean;
  /** It can break: in a batch of breakable copies, drawn only while its root is enabled. */
  breakable: boolean;
}

interface Batch {
  level: number;
  /** The copies that may draw in it (those at its level do). */
  copies: Copy[];
  meshes: Mesh[];
  matrices: Float32Array;
  colors: Float32Array | null;
  dirty: boolean;
}

/** The copies of one model, and their batches by level, square (that level's size) and whether they cast. */
interface Group {
  model: Model;
  copies: Copy[];
  tinted: boolean;
  /** Copies joined since the batches were made: they are made again (sizes change). */
  stale: boolean;
  batches: Map<string, Batch>;
  /** Static shadow-only batches at full detail (`shadowSets`, models with levels of detail). */
  shadows: Mesh[];
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
  /** Of `copies`, those that can break, and of those the ones broken now (out of their batch). */
  breakable?: number;
  hidden?: number;
  /** Static shadow-only batch meshes (`shadowSets`). */
  shadows?: number;
}

/** Where a copy is drawn (tests and the e2e flows): its batch's meshes, how many copies they draw, whether it is one. */
export interface PropCopyState {
  breakable: boolean;
  /** Its batch's meshes (one per material at its level of detail); empty before its first update. */
  meshes: string[];
  /** Copies its batch draws now (0 when the batch is switched off). */
  drawn: number;
  /** Whether its own matrix is among those drawn. */
  drawnHere: boolean;
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
  /** Each placed root's copy, for `shown` and `copyState`. */
  private readonly byRoot = new Map<TransformNode, { g: Group; copy: Copy }>();
  private seq = 0;
  private disposed = false;

  constructor(
    private readonly scene: Scene,
    private readonly sources: StaticSources,
    /** Small clutter casts within this many metres of the camera (Atmosphere.SMALL_CASTER_REACH). */
    private readonly smallReach: number,
    /** Cheaper small casters (game/shadowCasters.ts): static full-detail shadow batches, the near band. */
    private readonly shadowSets = false,
  ) {}

  /**
   * Draw the prop under `root` (placed and turned: its world matrix is the copy's) as a copy of model `path` in its
   * square's batch. Resolves false when the model can't be batched: the caller draws it as before. A `breakable` copy
   * draws only while `root` is enabled (tell `shown` when that changes).
   */
  add(path: string, root: TransformNode, small: boolean, tint: string | null, indoor = false, breakable = false): Promise<boolean> {
    const p = this.join(path, root, small, tint, indoor, breakable);
    this.pending.push(p);
    return p;
  }

  private readonly pending: Promise<boolean>[] = [];

  /** Every copy added so far is in its batch (or turned away). */
  async settled(): Promise<void> {
    await Promise.allSettled(this.pending);
  }

  private async join(path: string, root: TransformNode, small: boolean, tint: string | null, indoor: boolean, breakable: boolean): Promise<boolean> {
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
    let g = this.groups.get(path);
    if (!g) this.groups.set(path, (g = { model, copies: [], tinted: false, stale: false, batches: new Map(), shadows: [] }));
    const r = model.radius * s;
    const edges = propLodEdges(model.levels.map((l) => l.distance), r);
    const copy: Copy = { root, matrix, color, x: c.x, y: c.y, z: c.z, r, level: -1, edges, small, indoor, nearIn: false, quiet: small || indoor, breakable };
    g.copies.push(copy);
    this.byRoot.set(root, { g, copy });
    if (tint) g.tinted = true;
    g.stale = true;
    // Indoors (under a roof: shared map/indoors.ts) it casts nothing, near the camera or not: the sun never reaches it.
    if (small && !indoor) this.nearOf(model).copies.push(copy);
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
        // A copy is quiet (no shadow from its batches) when its model's copies in its PROP_SECTOR square are all small.
        const loud = new Set<string>();
        // An indoor copy is always quiet (in a quiet batch of its own square), and never makes its square loud.
        for (const k of g.copies) if (!k.small && !k.indoor) loud.add(sectorKey(k, PROP_SECTOR));
        for (const k of g.copies) {
          k.level = -1;
          k.quiet = k.indoor || !loud.has(sectorKey(k, PROP_SECTOR));
        }
        // Every level's batches made now, not when a copy first needs one: no meshes come and go as you walk about
        // (a new mesh thaws its frozen material), and the loading gate builds every level's shaders.
        for (let l = 0; l < g.model.levels.length; l++) for (const k of g.copies) this.batch(g, l, k);
        this.shadowBatches(g);
      }
      for (const c of g.copies) {
        const d = Math.hypot(c.x - camera.x, c.y - camera.y, c.z - camera.z);
        const level = pickPropLevel(d, c.edges, c.level);
        if (level === c.level) continue;
        if (c.level >= 0) this.batch(g, c.level, c).dirty = true;
        this.batch(g, level, c).dirty = true;
        c.level = level;
      }
      for (const b of g.batches.values()) if (b.dirty) this.fill(b);
    }
    for (const n of this.near.values()) this.fillNear(n, camera);
  }

  /**
   * A breakable copy's root was switched on or off (broken, or back at a new round; a late joiner's snapshot): its
   * batch's buffer is filled again now, without it or with it, the batch's meshes kept (no hitch, no frame drawn with
   * the broken prop still in), and so is its model's near-shadow batch if it is small clutter.
   */
  shown(root: TransformNode): void {
    const at = this.byRoot.get(root);
    // Not batched (yet: a copy whose model is still loading reads its root when its batch is first filled).
    if (!at || this.disposed) return;
    const { g, copy } = at;
    // Batches still to be made (copies joined since the last update) are filled from the roots when they are.
    if (g.stale || copy.level < 0) return;
    this.fill(this.batch(g, copy.level, copy));
    const near = copy.small && !copy.indoor && Number.isFinite(this.lastX) ? this.near.get(g.model.path) : undefined;
    if (near) this.fillNear(near, new Vector3(this.lastX, this.lastY, this.lastZ));
  }

  /** Where the copy under `root` is drawn (null: not batched). */
  copyState(root: TransformNode): PropCopyState | null {
    const at = this.byRoot.get(root);
    if (!at) return null;
    const { g, copy } = at;
    const b = !g.stale && copy.level >= 0 ? this.batch(g, copy.level, copy) : null;
    const mesh = b?.meshes[0];
    const drawn = mesh && mesh.isEnabled() ? mesh.thinInstanceCount : 0;
    let drawnHere = false;
    for (let i = 0; i < drawn && !drawnHere; i++) {
      let same = true;
      for (let k = 0; k < 16 && same; k++) same = b!.matrices[16 * i + k] === copy.matrix[k];
      drawnHere = same;
    }
    return { breakable: copy.breakable, meshes: b ? b.meshes.map((m) => m.name) : [], drawn, drawnHere };
  }

  /** The batch drawing copy `c` of group `g` at `level` (its square at that level's size, cast or quiet, breakable or not). */
  private batch(g: Group, level: number, c: Copy): Batch {
    const size = propSectorSize(level);
    const sector = sectorKey(c, size);
    const key = `${level}|${sector}|${c.quiet ? 1 : 0}|${c.breakable ? 1 : 0}`;
    let b = g.batches.get(key);
    if (b) return b;
    const copies = g.copies.filter((o) => o.quiet === c.quiet && o.breakable === c.breakable && sectorKey(o, size) === sector);
    const n = copies.length;
    const matrices = new Float32Array(n * 16);
    const colors = g.tinted ? new Float32Array(n * 4) : null;
    const lod = g.model.levels.length > 1;
    const allSmall = c.quiet;
    const meshes = g.model.levels[level]!.parts.map((part, pi) => {
      const mesh = this.partMesh(`static_batch_${this.seq++}_${g.model.path}_l${level}_p${pi}_${sector}`, part);
      mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
      if (colors) mesh.thinInstanceSetBuffer('color', colors, 4, false);
      // Never changing (no levels of detail, nothing that breaks): merged into the shadow proxies like the instances were
      // (shadowProxy.ts). Small clutter casts through its shadow-only batch near the camera instead. Breakable copies
      // are never merged: a proxy would keep a broken prop's shadow.
      // They say when their copies change (`thinVersion`), so the static shadow cache keeps them while they don't.
      // With `shadowSets` a batch with levels of detail casts nothing: the model's static shadow batches do.
      mesh.metadata = allSmall ? { castsNoShadow: true, propBatch: true, ...(c.breakable ? { breakable: true } : {}) } : c.breakable ? { propBatch: true, breakable: true, thinVersion: 0 } : lod ? (this.shadowSets ? { propBatch: true, castsNoShadow: true } : { propBatch: true }) : { staticThin: true, propBatch: true };
      return mesh;
    });
    b = { level, copies, meshes, matrices, colors, dirty: true };
    g.batches.set(key, b);
    return b;
  }

  /**
   * `shadowSets`: a model with levels of detail casts through static shadow-only batches of its full detail, one per
   * PROP_SECTOR square of its copies that cast (not quiet, not breakable: a broken prop's shadow goes with it), drawn by
   * no camera. They never change (until copies join), so they are merged into the shadow proxies (`staticThin`) and a
   * shadow no longer changes with the level the camera draws a copy at.
   */
  private shadowBatches(g: Group): void {
    for (const m of g.shadows) m.dispose(false, false);
    g.shadows = [];
    if (!this.shadowSets || g.model.levels.length < 2) return;
    const casting = g.copies.filter((k) => !k.quiet && !k.breakable);
    for (const [sector, copies] of bySquare(casting, PROP_SECTOR)) {
      const matrices = new Float32Array(copies.length * 16);
      copies.forEach((k, i) => matrices.set(k.matrix, 16 * i));
      g.model.levels[0]!.parts.forEach((part, pi) => {
        const mesh = this.partMesh(`static_shadow_${this.seq++}_${g.model.path}_p${pi}_${sector}`, part);
        mesh.thinInstanceSetBuffer('matrix', matrices, 16, true);
        mesh.thinInstanceRefreshBoundingInfo(false);
        mesh.layerMask = 0;
        mesh.metadata = { staticThin: true, propBatch: true, propShadow: true, thinVersion: 0 };
        g.shadows.push(mesh);
      });
    }
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

  private fill(b: Batch): void {
    b.dirty = false;
    let count = 0;
    for (const c of b.copies) {
      // A broken prop (its root switched off) is out of the buffer until it is back.
      if (c.level !== b.level || (c.breakable && !c.root.isEnabled(false))) continue;
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
      const meta = mesh.metadata as { thinVersion?: number } | null;
      if (meta?.thinVersion !== undefined) meta.thinVersion++;
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
      // One (empty) copy from the start, so its shaders are the thin-instanced ones from the first check on.
      mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
      mesh.setEnabled(false);
      // A small caster: never merged into the shadow proxies (it changes), and cast only near the camera.
      mesh.metadata = { propBatch: true, nearCaster: true, smallCaster: true };
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
      // With `shadowSets`, in within 20 m and out past 24 m (shadowCasters.ts smallCasts); before, a hard line.
      c.nearIn = this.shadowSets ? smallCasts(d, c.nearIn) : d <= this.smallReach;
      if (!c.nearIn || !c.root.isEnabled(false)) continue;
      n.matrices.set(c.matrix, 16 * count++);
    }
    if (count === 0 && n.shown === 0) return;
    n.shown = count;
    for (const m of n.meshes) {
      // Kept at its last count while hidden: an empty thin-instanced mesh would check its shaders as a plain one.
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
    let breakable = 0;
    let hidden = 0;
    let shadows = 0;
    const models = new Set<string>();
    for (const g of this.groups.values()) {
      copies += g.copies.length;
      models.add(g.model.path);
      for (const b of g.batches.values()) meshes += b.meshes.length;
      shadows += g.shadows.length;
      for (const c of g.copies) {
        if (!c.breakable) continue;
        breakable++;
        if (!c.root.isEnabled(false)) hidden++;
      }
    }
    const out: PropBatchStats = breakable ? { meshes, copies, models: models.size, breakable, hidden } : { meshes, copies, models: models.size };
    if (shadows) out.shadows = shadows;
    return out;
  }

  dispose(): void {
    this.disposed = true;
    for (const g of this.groups.values()) {
      for (const b of g.batches.values()) this.disposeBatch(b);
      for (const m of g.shadows) m.dispose(false, false);
    }
    this.groups.clear();
    this.byRoot.clear();
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
    // The distance the model was written with (ModelLibrary.mergeModel keeps it beside the one it gives instances).
    const authored = (l.mesh?.metadata as { lodAuthored?: number } | null | undefined)?.lodAuthored;
    levels.push({ distance: authored ?? l.distanceOrScreenCoverage, parts: l.mesh ? [part(l.mesh)] : [] });
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

/** A copy's square at a given size, as a key. */
function sectorKey(c: { x: number; z: number }, size: number): string {
  return `${Math.floor(c.x / size)}:${Math.floor(c.z / size)}`;
}
