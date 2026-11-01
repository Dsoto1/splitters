import type { Geometry as BabylonGeometry } from '@babylonjs/core/Meshes/geometry';
import type { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { SubMesh } from '@babylonjs/core/Meshes/subMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { MountDef } from '@tiletrigger/shared';
import { COCKPITS, type CockpitDef, type CockpitSurface } from '../content/cockpits.ts';
import { buildCockpit, needleAngle, type Groups, type Turning } from './cockpitGeometry.ts';

/** A box: [min, max]. */
export type ModelBox = [[number, number, number], [number, number, number]];

/**
 * Which triangles of an indexed mesh lie wholly inside one of `boxes` once their corners are taken through `toBox`.
 * Returns the indices reordered with the outside triangles first, and how many indices those are: the same
 * triangles in another order, so the mesh draws the same, and a submesh over the first `outside` indices draws the
 * mesh without them.
 */
export function partitionByBox(indices: ArrayLike<number>, positions: ArrayLike<number>, boxes: ModelBox | ModelBox[], toBox: (p: Vector3) => Vector3): { indices: Uint32Array; outside: number } {
  const list = (typeof boxes[0]![0] === 'number' ? [boxes] : boxes) as ModelBox[];
  const n = positions.length / 3;
  // Per vertex, a bit for each box it is in.
  const inside = new Uint32Array(n);
  const p = new Vector3();
  for (let v = 0; v < n; v++) {
    p.set(positions[v * 3]!, positions[v * 3 + 1]!, positions[v * 3 + 2]!);
    const q = toBox(p);
    list.forEach(([lo, hi], b) => {
      if (q.x >= lo[0] && q.x <= hi[0] && q.y >= lo[1] && q.y <= hi[1] && q.z >= lo[2] && q.z <= hi[2]) inside[v]! |= 1 << b;
    });
  }
  const out: number[] = [];
  const hidden: number[] = [];
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const [a, b, c] = [indices[i]!, indices[i + 1]!, indices[i + 2]!];
    // Only triangles wholly inside one box are hidden: one that straddles a box's face stays, so the body never
    // shows a gap where the cockpit's parts meet it.
    (inside[a]! & inside[b]! & inside[c]! ? hidden : out).push(a, b, c);
  }
  const all = new Uint32Array(out.length + hidden.length);
  all.set(out, 0);
  all.set(hidden, out.length);
  return { indices: all, outside: out.length };
}

/** What drives the moving parts: the front wheels' steering (-1..1, + right) and the speed along the nose (m/s). */
export interface CockpitDrive {
  steer: number;
  speed: number;
}

interface Built {
  root: TransformNode;
  wheel: { node: TransformNode; axis: Vector3; lock: number } | null;
  needles: { node: TransformNode; axis: Vector3; drive: 'speed' | 'revs'; max: number; value: number }[];
  triangles: number;
}

interface Shown {
  index: number;
  body: TransformNode;
  built: Built;
  /** Body meshes cut to their outside part, and the submeshes they drew before. */
  cut: { mesh: Mesh; subMeshes: SubMesh[] }[];
  cutDone: boolean;
}

/** Speed bands of a made-up gearbox for the rev counter (m/s at each change). */
const GEARS = [0, 4, 8, 12, 16, 20, 40];

/**
 * The cockpit of the vehicle you look out of, built in-house (content/cockpits.ts, made by cockpitGeometry.ts):
 * clean round cage tubes, seats with harnesses, a dash with gauges and a steering wheel that turns with the
 * steering. Drawn under the body's node (so it rides every tilt and spring), and only for you in the cockpit view:
 * the body's triangles inside the cockpit's `hide` boxes are left out of your copy of the body meanwhile (a
 * submesh over the body's indices, reordered once with those triangles last; other copies draw all of them, the
 * same as before). Chase view, the other vehicles and everyone else's game draw the body alone.
 */
export class CockpitInterior {
  private shown: Shown | null = null;
  /** Built cockpits by mount id, kept (disabled) once made. */
  private readonly built = new Map<string, Built>();
  /** Body geometry already reordered, with the index count that is outside the boxes. */
  private readonly parted = new WeakMap<BabylonGeometry, number>();
  private materials: Partial<Record<CockpitSurface, PBRMaterial>> | null = null;
  private last = 0;

  constructor(private readonly scene: Scene) {}

  /** Whether a cockpit is drawn now (for tests). */
  isShown(): boolean {
    return !!this.shown?.built.root.isEnabled();
  }

  /** The cockpit drawn now, for tests: its triangles, the wheel's turn and the needles' readings (0..1). */
  state(): { triangles: number; wheel: number; needles: number[]; cut: boolean } | null {
    const s = this.shown;
    if (!s) return null;
    const q = s.built.wheel?.node.rotationQuaternion;
    return { triangles: s.built.triangles, wheel: q ? 2 * Math.acos(Math.min(1, Math.abs(q.w))) : 0, needles: s.built.needles.map((n) => n.value), cut: s.cut.length > 0 };
  }

  /**
   * Called every frame: `index` / `root` / `def` are the vehicle you look out of in the cockpit view, or null;
   * `drive` turns the wheel and the needles.
   */
  update(index: number | null, root: TransformNode | null, def: MountDef | null, drive: CockpitDrive | null = null): void {
    const cockpit = def ? COCKPITS[def.id] : undefined;
    if (index === null || !root || !def || !cockpit) {
      this.clear();
      return;
    }
    if (this.shown && (this.shown.index !== index || this.shown.body.isDisposed())) this.clear();
    if (!this.shown) {
      // Under the body node (mountVisuals.createMountNode: `<root>_gun`), the mount's own frame.
      const body = root.getChildTransformNodes(true, (n) => n.name === `${root.name}_gun`)[0];
      if (!body) return;
      const built = this.build(def.id, cockpit);
      built.root.parent = body;
      built.root.setEnabled(true);
      this.shown = { index, body, built, cut: [], cutDone: false };
    }
    // The body model loads in the background: cut it once it is there.
    if (!this.shown.cutDone) this.cutBody(this.shown, cockpit);
    this.animate(this.shown.built, drive);
  }

  private animate(built: Built, drive: CockpitDrive | null): void {
    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0.001, (now - (this.last || now)) / 1000));
    this.last = now;
    const steer = drive?.steer ?? 0;
    const speed = Math.abs(drive?.speed ?? 0);
    if (built.wheel) {
      const w = built.wheel;
      w.node.rotationQuaternion = Quaternion.RotationAxisToRef(w.axis, steer * w.lock, w.node.rotationQuaternion ?? new Quaternion());
    }
    for (const n of built.needles) {
      let want: number;
      if (n.drive === 'speed') want = speed / n.max;
      else {
        let g = 1;
        while (g < GEARS.length - 1 && speed > GEARS[g]!) g++;
        const lo = GEARS[g - 1]!;
        want = speed < 0.3 ? 0.12 : 0.25 + (0.7 * (speed - lo)) / (GEARS[g]! - lo);
      }
      // Needles swing over, they don't jump (snapshots come in steps; gear changes drop the revs).
      n.value += (want - n.value) * Math.min(1, dt * 8);
      n.node.rotationQuaternion = Quaternion.RotationAxisToRef(n.axis, needleAngle(n.value), n.node.rotationQuaternion ?? new Quaternion());
    }
  }

  private build(id: string, def: CockpitDef): Built {
    const have = this.built.get(id);
    if (have && !have.root.isDisposed()) return have;
    const made = buildCockpit(def);
    const root = new TransformNode(`cockpit_${id}`, this.scene);
    let triangles = 0;
    const meshes = (groups: Groups, parent: TransformNode, name: string): void => {
      for (const [surface, g] of Object.entries(groups) as [CockpitSurface, (typeof groups)[CockpitSurface]][]) {
        if (!g || !g.indices.length) continue;
        const mesh = new Mesh(`${name}_${surface}`, this.scene);
        const vd = new VertexData();
        vd.positions = g.positions;
        vd.normals = g.normals;
        vd.uvs = g.uvs;
        vd.colors = g.colors;
        vd.indices = g.indices;
        vd.applyToMesh(mesh);
        mesh.material = this.material(surface);
        mesh.parent = parent;
        mesh.isPickable = false;
        triangles += g.indices.length / 3;
      }
    };
    meshes(made.groups, root, `cockpit_${id}`);
    const turning = (t: Turning, name: string): TransformNode => {
      const node = new TransformNode(name, this.scene);
      node.parent = root;
      node.position.set(t.origin[0], t.origin[1], t.origin[2]);
      node.rotationQuaternion = Quaternion.Identity();
      meshes(t.groups, node, name);
      return node;
    };
    const wheel = made.wheel ? { node: turning(made.wheel, `cockpit_${id}_wheel`), axis: new Vector3(...made.wheel.axis), lock: made.wheel.lock } : null;
    const needles = made.needles.map((n, i) => ({ node: turning(n, `cockpit_${id}_needle${i}`), axis: new Vector3(...n.axis), drive: n.drive, max: n.max, value: 0 }));
    const built: Built = { root, wheel, needles, triangles };
    root.setEnabled(false);
    this.built.set(id, built);
    return built;
  }

  /** PBR surfaces over the parts' own (vertex) colours, with a little generated roughness variation. */
  private material(surface: CockpitSurface): PBRMaterial {
    if (!this.materials) {
      const grain = grainTexture(this.scene);
      const make = (name: CockpitSurface, roughness: number, metallic: number): PBRMaterial => {
        const m = new PBRMaterial(`cockpit_${name}`, this.scene);
        m.albedoColor = Color3.White();
        m.roughness = roughness;
        m.metallic = metallic;
        m.metallicTexture = grain;
        m.useRoughnessFromMetallicTextureAlpha = false;
        m.useRoughnessFromMetallicTextureGreen = true;
        m.useMetallnessFromMetallicTextureBlue = true;
        return m;
      };
      // Powder-coated tubes and painted panels, black seat fabric, dash plastic and rubber, bare steel.
      this.materials = { paint: make('paint', 0.62, 0.1), fabric: make('fabric', 1, 0), plastic: make('plastic', 0.78, 0), metal: make('metal', 0.45, 0.85) };
    }
    return this.materials[surface]!;
  }

  private cutBody(shown: Shown, def: CockpitDef): void {
    // The body's model node (mountVisuals.createMountNode: `<root>_model`), once loaded.
    const model = shown.body.getChildTransformNodes(true).find((n) => n.name.endsWith('_model'));
    const bodies = model?.getChildMeshes(false).filter((m): m is Mesh => m instanceof Mesh && m.getTotalIndices() > 0 && !!m.geometry) ?? [];
    if (!bodies.length) return;
    shown.cutDone = true;
    const toMount = shown.body.computeWorldMatrix(true).clone().invert();
    const boxes = def.hide as ModelBox[];
    for (const mesh of bodies) {
      const geometry = mesh.geometry!;
      let outside = this.parted.get(geometry);
      if (outside === undefined) {
        const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
        const indices = mesh.getIndices();
        if (!positions || !indices) continue;
        const m = mesh.computeWorldMatrix(true).multiplyToRef(toMount, new Matrix());
        const q = new Vector3();
        const parted = partitionByBox(indices, positions, boxes, (p) => Vector3.TransformCoordinatesToRef(p, m, q));
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
    const s = this.shown;
    if (!s) return;
    this.shown = null;
    for (const { mesh, subMeshes } of s.cut) if (!mesh.isDisposed()) mesh.subMeshes = subMeshes;
    if (!s.built.root.isDisposed()) {
      s.built.root.setEnabled(false);
      s.built.root.parent = null;
    }
  }
}

/** A small tiling grain (roughness in green, metalness in blue, both near 1 so the material's own values lead). */
function grainTexture(scene: Scene): RawTexture {
  const n = 64;
  const px = new Uint8Array(n * n * 4);
  // Value noise: a coarse lattice smoothed, plus a fine speckle.
  const lattice = (x: number, y: number): number => {
    const h = Math.sin((x % 8) * 127.1 + (y % 8) * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const gx = (x / n) * 8;
      const gy = (y / n) * 8;
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      const fx = gx - ix;
      const fy = gy - iy;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const a = lattice(ix, iy) + (lattice(ix + 1, iy) - lattice(ix, iy)) * sx;
      const b = lattice(ix, iy + 1) + (lattice(ix + 1, iy + 1) - lattice(ix, iy + 1)) * sx;
      const coarse = a + (b - a) * sy;
      const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const fine = h - Math.floor(h);
      const v = 0.78 + 0.16 * coarse + 0.06 * fine;
      const o = (y * n + x) * 4;
      px[o] = 255;
      px[o + 1] = Math.round(255 * Math.min(1, v));
      px[o + 2] = Math.round(255 * (0.85 + 0.15 * coarse));
      px[o + 3] = 255;
    }
  const tex = RawTexture.CreateRGBATexture(px, n, n, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  tex.name = 'cockpit_grain';
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}
