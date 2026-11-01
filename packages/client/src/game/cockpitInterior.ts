import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Geometry } from '@babylonjs/core/Meshes/geometry';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { SubMesh } from '@babylonjs/core/Meshes/subMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { MountDef } from '@tiletrigger/shared';
import type { ModelLibrary } from '../content/models.ts';

/** A box in a model's own (glTF) frame: [min, max]. */
export type ModelBox = [[number, number, number], [number, number, number]];

/**
 * Which triangles of an indexed mesh lie wholly inside `box` once their corners are taken through `toBox`.
 * Returns the indices reordered with the outside triangles first, and how many indices those are: the same
 * triangles in another order, so the mesh draws the same, and a submesh over the first `outside` indices draws the
 * mesh without the box.
 */
export function partitionByBox(indices: ArrayLike<number>, positions: ArrayLike<number>, box: ModelBox, toBox: (p: Vector3) => Vector3): { indices: Uint32Array; outside: number } {
  const [lo, hi] = box;
  const n = positions.length / 3;
  const inside = new Uint8Array(n);
  const p = new Vector3();
  for (let v = 0; v < n; v++) {
    p.set(positions[v * 3]!, positions[v * 3 + 1]!, positions[v * 3 + 2]!);
    const q = toBox(p);
    inside[v] = q.x >= lo[0] && q.x <= hi[0] && q.y >= lo[1] && q.y <= hi[1] && q.z >= lo[2] && q.z <= hi[2] ? 1 : 0;
  }
  const out: number[] = [];
  const hidden: number[] = [];
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const [a, b, c] = [indices[i]!, indices[i + 1]!, indices[i + 2]!];
    // Only triangles wholly inside are hidden: one that straddles the box's face stays, so the body never shows a
    // gap where the interior's own cut edge runs (the interior draws over it, see zOffset below).
    (inside[a] && inside[b] && inside[c] ? hidden : out).push(a, b, c);
  }
  const all = new Uint32Array(out.length + hidden.length);
  all.set(out, 0);
  all.set(hidden, out.length);
  return { indices: all, outside: out.length };
}

interface Shown {
  index: number;
  model: TransformNode;
  interior: TransformNode | null;
  /** Body meshes cut to their outside part, and the submeshes they drew before. */
  cut: { mesh: Mesh; subMeshes: SubMesh[] }[];
}

/**
 * The high-detail cockpit of the vehicle you look out of (MountDef.cockpitModel, built as a guns.json entry's
 * `interior` in the body's own frame). Loaded the first time you sit in such a cockpit, drawn under the body's
 * model node (so it rides every tilt and spring), and only for you in the cockpit view: the body's triangles
 * inside the interior's box are left out of your copy of the body meanwhile (a submesh over the body's indices,
 * reordered once with those triangles last; other copies draw all of them, the same as before). Chase view,
 * the other vehicles and everyone else's game draw the body alone.
 */
export class CockpitInterior {
  private shown: Shown | null = null;
  /** Geometry already reordered, with the index count that is outside the box. */
  private readonly parted = new WeakMap<Geometry, number>();
  private loading = 0;

  constructor(private readonly models: ModelLibrary) {}

  /** Whether the interior of a vehicle is drawn now (for tests). */
  isShown(): boolean {
    return !!this.shown?.interior?.isEnabled();
  }

  /**
   * Called every frame: `index` / `root` / `def` are the vehicle you look out of in the cockpit view, or null.
   */
  update(index: number | null, root: TransformNode | null, def: MountDef | null): void {
    const path = def?.cockpitModel;
    if (index === null || !root || !path) {
      this.clear();
      return;
    }
    if (this.shown?.index === index && !this.shown.model.isDisposed()) return;
    this.clear();
    // The body's model node (mountVisuals.createMountNode: `<root>_model`), once loaded.
    const model = root.getChildTransformNodes(false, (n) => n.name === `${root.name}_model`)[0];
    if (!model) return;
    const shown: Shown = { index, model, interior: null, cut: [] };
    this.shown = shown;
    const ticket = ++this.loading;
    void this.models
      .load(path)
      .then(async (container) => {
        const box = cockpitBox(container.transformNodes, container.meshes);
        const interior = await this.models.instantiate(path, `${root.name}_cockpit`);
        if (ticket !== this.loading || this.shown !== shown || model.isDisposed()) {
          interior.dispose();
          return;
        }
        interior.parent = model;
        for (const m of interior.getChildMeshes()) {
          m.isPickable = false;
          // Where a body triangle straddling the box's face lies on the interior's surface, the interior wins.
          if (m.material) m.material.zOffset = -1;
        }
        shown.interior = interior;
        if (box) this.cutBody(shown, box);
      })
      .catch(() => {
        // No interior (a missing file): the body alone, as before.
      });
  }

  private cutBody(shown: Shown, box: ModelBox): void {
    // The body's glTF frame: its loader root (the handedness turn) under the model node.
    const gltfRoot = shown.model.getChildren((n) => n !== shown.interior, true)[0] as TransformNode | undefined;
    if (!gltfRoot) return;
    const toGltf = gltfRoot.computeWorldMatrix(true).clone().invert();
    const bodies = shown.model.getChildMeshes(false).filter((m): m is Mesh => m instanceof Mesh && !m.isDescendantOf(shown.interior!) && m.getTotalIndices() > 0 && !!m.geometry);
    for (const mesh of bodies) {
      const geometry = mesh.geometry!;
      let outside = this.parted.get(geometry);
      if (outside === undefined) {
        const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
        const indices = mesh.getIndices();
        if (!positions || !indices) continue;
        const m = mesh.computeWorldMatrix(true).multiply(toGltf);
        const q = new Vector3();
        const parted = partitionByBox(indices, positions, box, (p) => Vector3.TransformCoordinatesToRef(p, m, q));
        geometry.setIndices(parted.indices, mesh.getTotalVertices());
        outside = parted.outside;
        this.parted.set(geometry, outside);
      }
      const subMeshes = mesh.subMeshes;
      mesh.subMeshes = [];
      new SubMesh(0, 0, mesh.getTotalVertices(), 0, outside, mesh);
      shown.cut.push({ mesh, subMeshes });
    }
  }

  private clear(): void {
    this.loading++;
    const s = this.shown;
    if (!s) return;
    this.shown = null;
    for (const { mesh, subMeshes } of s.cut) if (!mesh.isDisposed()) mesh.subMeshes = subMeshes;
    s.interior?.dispose();
  }
}

/** The hidden box an interior model carries in its glTF extras (`cockpit.box`, written by prepare-guns.mjs). */
function cockpitBox(nodes: TransformNode[], meshes: AbstractMesh[]): ModelBox | null {
  for (const n of [...nodes, ...meshes]) {
    const box = (n.metadata as { gltf?: { extras?: { cockpit?: { box?: ModelBox } } } } | null)?.gltf?.extras?.cockpit?.box;
    if (box) return box;
  }
  return null;
}

