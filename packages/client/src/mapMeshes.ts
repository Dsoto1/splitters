import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { TERRAIN_MATERIALS, TERRAIN_SURFACES, axisFaces, buildMapDecor, boxQuat, quatRotate, coreMaterials, coreThemes, vertexY, yawXZ, faceSlot, resolveSurface, styleKey, type MapDocument, type MaterialDefinition, type ResolvedStyle, type TerrainMaterial, type RenderFace, type TilePlacement, type WorldBox, visibleFaces, LEVEL_DEPTH_BIAS } from '@tiletrigger/shared';
import { materialPixels, patternSize } from './materials/patterns.ts';
import { versioned } from './assetUrl.ts';
import { jpegPixels, mergeLevel, type MergeSource } from './levelMerge.ts';

/**
 * The level is drawn a hair behind whatever lies in its planes (docs/LOOK.md, "No flicker: props"): a rug's cloth on a
 * floor, the bottom board of open shelving, a crate's double-sided base, a sign flush with a wall. Those faces share a
 * plane with the floor or wall and fought it (the texture flicker), worst on a phone's depth buffer; with this depth
 * bias (polygon offset, in depth-buffer steps) the prop always wins, at any range. Level faces never share a plane with
 * each other (visibleFaces), so the bias changes nothing else.
 */
export function levelDepthBias(mat: { zOffset: number; zOffsetUnits: number }): void {
  mat.zOffset = LEVEL_DEPTH_BIAS.factor;
  mat.zOffsetUnits = LEVEL_DEPTH_BIAS.units;
}

/** Faces of a box: corners (clockwise from outside), outward normal, and the same before any turn (texture coordinates are laid out on those). */
type Face = [corners: number[][], normal: readonly [number, number, number], flat: number[][], flatNormal: readonly [number, number, number]];
function boxFaces(b: WorldBox): Face[] {
  const faces = axisFaces(b.min, b.max);
  if (b.pitch || b.roll) {
    // Pitched blocks (ramps, roofs): turn and tilt about the box centre.
    const q = boxQuat(b.yaw, b.pitch, b.roll);
    const cx = (b.min[0] + b.max[0]) / 2;
    const cy = (b.min[1] + b.max[1]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    const tilt = (p: number[]) => {
      const [x, y, z] = quatRotate(q, p[0]! - cx, p[1]! - cy, p[2]! - cz);
      return [cx + x, cy + y, cz + z];
    };
    return faces.map(([c, n]) => [c.map(tilt), quatRotate(q, n[0], n[1], n[2]), c, n]);
  }
  if (!b.yaw) return faces.map(([c, n]) => [c, n, c, n]);
  const cx = (b.min[0] + b.max[0]) / 2;
  const cz = (b.min[2] + b.max[2]) / 2;
  const turn = (p: number[]) => {
    const [x, z] = yawXZ(p[0]! - cx, p[2]! - cz, b.yaw!);
    return [cx + x, p[1]!, cz + z];
  };
  return faces.map(([c, n]) => {
    const [nx, nz] = yawXZ(n[0], n[2], b.yaw!);
    return [c.map(turn), [nx, n[1], nz], c, n];
  });
}

class FaceBuffer {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  indices: number[] = [];

  /** Add one face (a convex polygon) with UVs in world metres divided by the material's repeat size. */
  /** `flat`/`fn`: the face before any turn, whose two axes perpendicular to the normal lay out the texture. */
  add(corners: number[][], n: readonly [number, number, number], uvScale: number, flat: number[][] = corners, fn: readonly [number, number, number] = n): void {
    const base = this.positions.length / 3;
    corners.forEach((c, i) => {
      const f = flat[i]!;
      this.positions.push(c[0]!, c[1]!, c[2]!);
      this.normals.push(n[0], n[1], n[2]);
      const u = fn[0] !== 0 ? f[2]! : f[0]!;
      const v = fn[1] !== 0 ? f[2]! : f[1]!;
      this.uvs.push(u * uvScale, v * uvScale);
    });
    // A fan: faces are convex (rectangles, or pieces of one cut by a turned box).
    for (let k = 1; k < corners.length - 1; k++) this.indices.push(base, base + k + 1, base + k);
  }

  toVertexData(): VertexData {
    const vd = new VertexData();
    vd.positions = this.positions;
    vd.normals = this.normals;
    vd.uvs = this.uvs;
    vd.indices = this.indices;
    return vd;
  }
}

/** Plain vertex data for a set of boxes (ghost previews, outlines). */
export function boxVertexData(boxes: readonly WorldBox[]): VertexData {
  const buf = new FaceBuffer();
  for (const b of boxes) for (const [corners, n, flat, fn] of boxFaces(b)) buf.add(corners, n, 0.5, flat, fn);
  return buf.toVertexData();
}

/**
 * Builds painted map meshes: every box face is assigned its tile's surface
 * style (override or theme default), and faces sharing a style merge into one
 * mesh, so draw calls scale with the number of distinct looks, not tiles.
 * Textures and materials are cached per scene.
 */
function terrainStyle(material: TerrainMaterial): ResolvedStyle {
  const def = coreMaterials.get(TERRAIN_SURFACES[material]) ?? coreMaterials.get('core.proto_floor')!;
  // Gravel's photo texture is near white in daylight; darken it so it reads as ground, not snow.
  return { material: def, tint: material === 'gravel' ? '#8f877b' : null };
}

/**
 * Soft paint borders (buildTerrainBlend): how fast a paint fades past its border (1: over a whole cell each way;
 * 1.5: over two thirds of one. Owner, 2026-11-10: a whole cell was "a tad too soft"), and how finely a border cell
 * is cut so the fade can end inside it (BLEND_CUTS / (2 × BLEND_SHARPNESS) must be a whole number of cuts).
 */
const BLEND_SHARPNESS = 1.5;
const BLEND_CUTS = 3;

export class MapStyler {
  private readonly textures: Map<string, RawTexture>;
  private readonly materials: Map<string, StandardMaterial>;
  private readonly images: Map<string, Texture>;
  private meshes: Mesh[] = [];
  private terrainMeshes: Mesh[] = [];
  /** The surface style each level and terrain mesh is drawn in (for merging, levelMerge.ts). */
  private readonly styleOf = new Map<Mesh, ResolvedStyle>();

  /** `share`: reuse another styler's textures and materials (a second mesh set in the same scene, e.g. MapMaker's ghosted levels). */
  constructor(
    private readonly scene: Scene,
    share?: MapStyler,
  ) {
    this.textures = share?.textures ?? new Map();
    this.materials = share?.materials ?? new Map();
    this.images = share?.images ?? new Map();
  }

  build(doc: MapDocument, boxes: readonly WorldBox[], name = 'map'): Mesh[] {
    // Trim (baseboards, cornices, frames) is drawn with the structure but never collides.
    this.buildBoxes(doc, [...boxes, ...buildMapDecor(doc)], name);
    this.buildTerrain(doc, name);
    return this.meshes;
  }

  /**
   * Style exactly these boxes (no trim, no terrain), replacing this styler's previous box meshes.
   * Each face draws only where it can be seen and no other face shares its plane (visibleFaces:
   * the build-time pass that ended the z-fighting flicker). `faces`: those faces, already worked
   * out (MapMaker clips every level against all of them, then draws them in two sets).
   */
  buildBoxes(doc: MapDocument, boxes: readonly WorldBox[], name = 'map', faces: readonly RenderFace[] = visibleFaces(boxes), keep = false): Mesh[] {
    const tiles = new Map<string, TilePlacement>(doc.classicStructure.tiles.map((t) => [t.id, t]));
    // `keep` (MapMaker, which builds again after every edit): a style whose faces are the ones its mesh was built
    // from keeps that mesh; only the styles an edit touched are built and sent to the graphics card again.
    const groups = new Map<string, { style: ResolvedStyle; faces: RenderFace[]; h1: number; h2: number }>();
    for (const f of faces) {
      const b = boxes[f.box]!;
      const tile = tiles.get(b.sourceId);
      // Free blocks carry their own material on every face.
      const own = b.surface ? { material: coreMaterials.get(b.surface.material), tint: b.surface.tint } : null;
      const style = own?.material ? (own as ResolvedStyle) : resolveSurface(doc, tile, faceSlot(b, f.normal));
      const key = styleKey(style);
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { style, faces: [], h1: 0, h2: 0 }));
      g.faces.push(f);
      if (keep) {
        // The face as two numbers, added up over the style's faces (whatever order they come in).
        let a = 0x811c9dc5;
        let c = 0x01000193;
        const mix = (n: number) => {
          const v = Math.round(n * 1000) | 0;
          a = Math.imul(a ^ v, 16777619);
          c = (Math.imul(c + v, 2246822519) ^ (c >>> 13)) | 0;
        };
        for (const p of f.corners) mix(p[0]), mix(p[1]), mix(p[2]);
        for (const p of f.flat) mix(p[0]), mix(p[1]), mix(p[2]);
        mix(f.normal[0]), mix(f.normal[1]), mix(f.normal[2]);
        mix(f.flatNormal[0]), mix(f.flatNormal[1]), mix(f.flatNormal[2]);
        g.h1 = (g.h1 + a) | 0;
        g.h2 = (g.h2 + c) | 0;
      }
    }
    const kept = new Map<string, { mesh: Mesh; sig: string }>();
    const old = this.meshes;
    this.meshes = [...groups.entries()].map(([key, g]) => {
      const sig = `${g.faces.length}:${g.h1}:${g.h2}`;
      const had = keep ? this.boxMeshes.get(key) : undefined;
      if (had && had.sig === sig && !had.mesh.isDisposed()) {
        kept.set(key, had);
        return had.mesh;
      }
      const buf = new FaceBuffer();
      for (const f of g.faces) buf.add(f.corners, f.normal, 1 / g.style.material.scale, f.flat, f.flatNormal);
      const mesh = new Mesh(`${name}_${key}`, this.scene);
      buf.toVertexData().applyToMesh(mesh);
      mesh.material = this.material(g.style);
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      this.styleOf.set(mesh, g.style);
      kept.set(key, { mesh, sig });
      return mesh;
    });
    const staying = new Set(this.meshes);
    for (const m of old) if (!staying.has(m)) m.dispose();
    this.boxMeshes = kept;
    return this.meshes;
  }

  /** The box meshes by style, and what each was built from (buildBoxes with `keep`). */
  private boxMeshes = new Map<string, { mesh: Mesh; sig: string }>();

  /**
   * Terrain: one mesh per ground material holding that material's cells, with
   * normals taken from the height grid so lighting runs smoothly across
   * material borders. Rebuilt on its own while MapMaker brushes are dragged.
   */
  /**
   * Draw a terrain finer than 2 m (map format v32, Change grid) at every `terrainDrawStep`-th vertex: the game sets 2 on
   * Low graphics (phones start there), a quarter of the vertices to draw. Collision and the navmesh always use every
   * vertex; the drawn surface leaves them only between the skipped vertices (on a grid made finer from a coarser one,
   * hardly at all).
   */
  terrainDrawStep = 1;

  buildTerrain(doc: MapDocument, name = 'map'): void {
    for (const m of this.terrainMeshes) m.dispose();
    this.terrainMeshes = [];
    const t = doc.terrain;
    if (!t) return;
    const s = t.spacing;
    const cols = t.cols;
    const rows = t.rows;
    const step = s < 2 && this.terrainDrawStep > 1 ? Math.round(this.terrainDrawStep) : 1;
    // The vertex columns and rows drawn (every one, or every step-th and always the last).
    const take = (n: number) => {
      const out: number[] = [];
      for (let i = 0; i < n - 1; i += step) out.push(i);
      out.push(n - 1);
      return out;
    };
    const ci = take(cols);
    const ri = take(rows);
    // Heights and normals once per vertex (they were worked out again for each of up to four cells sharing a vertex).
    const hy = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) hy[r * cols + c] = vertexY(t, c, r);
    const at = (c: number, r: number) => hy[Math.max(0, Math.min(rows - 1, r)) * cols + Math.max(0, Math.min(cols - 1, c))]!;
    const nrm = new Float32Array(cols * rows * 3);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const nx = -(at(c + 1, r) - at(c - 1, r)) / (2 * s);
        const nz = -(at(c, r + 1) - at(c, r - 1)) / (2 * s);
        const l = Math.hypot(nx, 1, nz);
        const i = (r * cols + c) * 3;
        nrm[i] = nx / l;
        nrm[i + 1] = 1 / l;
        nrm[i + 2] = nz / l;
      }
    }
    // Drawn cells (k = row of drawn cells × drawn columns + column), each the material of its first fine cell.
    const byMaterial = new Map<number, number[]>();
    const dc = ci.length - 1;
    for (let r = 0; r < ri.length - 1; r++) {
      for (let c = 0; c < dc; c++) {
        const m = t.materials[ri[r]! * (cols - 1) + ci[c]!]!;
        let list = byMaterial.get(m);
        if (!list) byMaterial.set(m, (list = []));
        list.push(r * dc + c);
      }
    }
    for (const [m, cells] of byMaterial) {
      const material = TERRAIN_MATERIALS[m] ?? 'grass';
      const style = terrainStyle(material);
      const def = style.material;
      const n = cells.length;
      const positions = new Float32Array(n * 12);
      const normals = new Float32Array(n * 12);
      const uvs = new Float32Array(n * 8);
      const indices = new Uint32Array(n * 6);
      const inv = 1 / def.scale;
      let k = 0;
      for (const i of cells) {
        const cc = i % dc;
        const rr = (i - cc) / dc;
        for (let q = 0; q < 4; q++) {
          // Corners 00, 10, 11, 01.
          const vc = ci[cc + (q === 1 || q === 2 ? 1 : 0)]!;
          const vr = ri[rr + (q >= 2 ? 1 : 0)]!;
          const vi = vr * cols + vc;
          const x = t.origin[0] + vc * s;
          const z = t.origin[1] + vr * s;
          const p = (k * 4 + q) * 3;
          positions[p] = x;
          positions[p + 1] = hy[vi]!;
          positions[p + 2] = z;
          normals[p] = nrm[vi * 3]!;
          normals[p + 1] = nrm[vi * 3 + 1]!;
          normals[p + 2] = nrm[vi * 3 + 2]!;
          uvs[(k * 4 + q) * 2] = x * inv;
          uvs[(k * 4 + q) * 2 + 1] = z * inv;
        }
        // Same diagonal as the collision mesh (00-11), wound so the faces point up.
        const base = k * 4;
        indices.set([base, base + 1, base + 2, base, base + 2, base + 3], k * 6);
        k++;
      }
      const vd = new VertexData();
      vd.positions = positions;
      vd.normals = normals;
      vd.uvs = uvs;
      vd.indices = indices;
      const mesh = new Mesh(`${name}_terrain_${material}`, this.scene);
      vd.applyToMesh(mesh);
      mesh.material = this.material(style);
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      this.styleOf.set(mesh, style);
      this.terrainMeshes.push(mesh);
    }
    if (this.terrainBlend && byMaterial.size > 1) this.buildTerrainBlend(t, name, ci, ri, hy, nrm);
  }

  /**
   * Blend the terrain's paint across cell borders (owner, 2026-11-10: painted paths read as chunky squares): the game
   * sets it off on Low graphics. Drawing only; the cells' materials (footsteps, bullets, the plan) are as painted.
   */
  terrainBlend = true;

  /**
   * Soft paint borders: over each cell, every other material painted on a neighbouring cell is drawn again, fading
   * from its share of the cells round each corner (half along a straight border, a quarter or three quarters at a
   * corner) to nothing at the corners it doesn't touch. Both sides of a border fade into each other, so the mix is
   * the same on either side of the cell edge: a path is a band that fades over a cell each way, not a row of squares.
   * One see-through mesh a material, on the very triangles of the ground under it (the same vertices and diagonal).
   */
  private buildTerrainBlend(t: NonNullable<MapDocument['terrain']>, name: string, ci: number[], ri: number[], hy: Float32Array, nrm: Float32Array): void {
    const cols = t.cols;
    const dc = ci.length - 1;
    const dr = ri.length - 1;
    const cell = (c: number, r: number): number => (c < 0 || r < 0 || c >= dc || r >= dr ? -1 : t.materials[ri[r]! * (cols - 1) + ci[c]!]!);
    // A material's share of the (up to four) cells round a drawn vertex.
    const share = (m: number, vc: number, vr: number): number => {
      let has = 0;
      let all = 0;
      for (let dz = -1; dz <= 0; dz++) {
        for (let dx = -1; dx <= 0; dx++) {
          const at = cell(vc + dx, vr + dz);
          if (at < 0) continue;
          all++;
          if (at === m) has++;
        }
      }
      return all ? has / all : 0;
    };
    const quads = new Map<number, number[]>();
    const others = new Set<number>();
    for (let r = 0; r < dr; r++) {
      for (let c = 0; c < dc; c++) {
        const own = cell(c, r);
        others.clear();
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) others.add(cell(c + dx, r + dz));
        others.delete(own);
        others.delete(-1);
        for (const m of others) {
          let list = quads.get(m);
          if (!list) quads.set(m, (list = []));
          list.push(c, r);
        }
      }
    }
    // Each border cell is cut into BLEND_CUTS × BLEND_CUTS, so the fade can end inside it (below).
    const N = BLEND_CUTS;
    const side = N + 1;
    const perCell = side * side;
    for (const [m, list] of quads) {
      const material = TERRAIN_MATERIALS[m] ?? 'grass';
      const style = terrainStyle(material);
      const inv = 1 / style.material.scale;
      const n = list.length / 2;
      const positions = new Float32Array(n * perCell * 3);
      const normals = new Float32Array(n * perCell * 3);
      const uvs = new Float32Array(n * perCell * 2);
      const colors = new Float32Array(n * perCell * 4);
      const indices = new Uint32Array(n * N * N * 6);
      for (let k = 0; k < n; k++) {
        const cc = list[k * 2]!;
        const rr = list[k * 2 + 1]!;
        // The cell's corners 00, 10, 01, 11: the ground's own vertices, and the material's share at each.
        const v00 = ri[rr]! * cols + ci[cc]!;
        const v10 = ri[rr]! * cols + ci[cc + 1]!;
        const v01 = ri[rr + 1]! * cols + ci[cc]!;
        const v11 = ri[rr + 1]! * cols + ci[cc + 1]!;
        const w00 = share(m, cc, rr);
        const w10 = share(m, cc + 1, rr);
        const w01 = share(m, cc, rr + 1);
        const w11 = share(m, cc + 1, rr + 1);
        const x0 = t.origin[0] + ci[cc]! * t.spacing;
        const z0 = t.origin[1] + ri[rr]! * t.spacing;
        const dx = (ci[cc + 1]! - ci[cc]!) * t.spacing;
        const dz = (ri[rr + 1]! - ri[rr]!) * t.spacing;
        const first = k * perCell;
        for (let b = 0; b <= N; b++) {
          for (let a = 0; a <= N; a++) {
            const u = a / N;
            const v = b / N;
            const at = first + b * side + a;
            const bil = (p00: number, p10: number, p01: number, p11: number) => p00 * (1 - u) * (1 - v) + p10 * u * (1 - v) + p01 * (1 - u) * v + p11 * u * v;
            // On the ground's own two triangles (its diagonal runs 00-11), not the curved sheet between the corners.
            const y = u >= v ? hy[v00]! + u * (hy[v10]! - hy[v00]!) + v * (hy[v11]! - hy[v10]!) : hy[v00]! + u * (hy[v11]! - hy[v01]!) + v * (hy[v01]! - hy[v00]!);
            positions[at * 3] = x0 + u * dx;
            positions[at * 3 + 1] = y;
            positions[at * 3 + 2] = z0 + v * dz;
            for (let d = 0; d < 3; d++) normals[at * 3 + d] = bil(nrm[v00 * 3 + d]!, nrm[v10 * 3 + d]!, nrm[v01 * 3 + d]!, nrm[v11 * 3 + d]!);
            uvs[at * 2] = (x0 + u * dx) * inv;
            uvs[at * 2 + 1] = (z0 + v * dz) * inv;
            colors[at * 4] = colors[at * 4 + 1] = colors[at * 4 + 2] = 1;
            // The share, steepened about a half: the two sides still add up to one on the border, and each paint
            // is gone 1 / BLEND_SHARPNESS of a cell from it.
            colors[at * 4 + 3] = Math.max(0, Math.min(1, (bil(w00, w10, w01, w11) - 0.5) * BLEND_SHARPNESS + 0.5));
          }
        }
        let o = k * N * N * 6;
        for (let b = 0; b < N; b++) {
          for (let a = 0; a < N; a++) {
            const p = first + b * side + a;
            // The ground's diagonal and winding in every small square.
            indices[o++] = p;
            indices[o++] = p + 1;
            indices[o++] = p + side + 1;
            indices[o++] = p;
            indices[o++] = p + side + 1;
            indices[o++] = p + side;
          }
        }
      }
      const vd = new VertexData();
      vd.positions = positions;
      vd.normals = normals;
      vd.uvs = uvs;
      vd.colors = colors;
      vd.indices = indices;
      const mesh = new Mesh(`${name}_terrainblend_${material}`, this.scene);
      vd.applyToMesh(mesh);
      mesh.hasVertexAlpha = true;
      mesh.material = this.blendMaterial(style);
      // Where three paints meet they are laid in the same order from every side.
      mesh.alphaIndex = m;
      mesh.isPickable = false;
      // The ground under it casts the shadow.
      mesh.metadata = { castsNoShadow: true };
      mesh.freezeWorldMatrix();
      this.terrainMeshes.push(mesh);
    }
  }

  /** A style's material for the soft paint borders: the same look, drawn just in front of the ground it lies on. */
  private blendMaterial(style: ResolvedStyle): StandardMaterial {
    const key = `blend:${styleKey(style)}`;
    let mat = this.materials.get(key);
    if (!mat) {
      mat = this.material(style).clone(`mat_${key}`);
      // Half the level's depth bias: in front of the ground (merged or not), still behind what lies on it (a rug, a crate's base).
      mat.zOffset = LEVEL_DEPTH_BIAS.factor / 2;
      mat.zOffsetUnits = LEVEL_DEPTH_BIAS.units / 2;
      this.materials.set(key, mat);
    }
    return mat;
  }

  /**
   * Level draw merging (levelMerge.ts, WebGL2): the level's and terrain's per-style meshes of every opaque, non-glowing
   * style become a few meshes over shared array textures, and the per-style meshes, and the materials and textures
   * nothing else uses, go. Resolves with how many draws the level was and is (null: nothing merged, all left as built).
   */
  async merge(name = 'map', mipBias = 0): Promise<{ before: number; after: number; merged: string[] } | null> {
    const all = [...this.meshes, ...this.terrainMeshes].filter((m) => !m.isDisposed());
    const sources = this.mergeSources();
    const result = await mergeLevel(this.scene, sources, name, mipBias);
    if (!result || this.scene.isDisposed) return null;
    const names = result.merged.map((m) => m.name);
    // The merged styles' meshes go (a style alone at its texture size stays as it was).
    for (const m of result.merged) {
      this.styleOf.delete(m);
      m.dispose();
    }
    this.meshes = [...this.meshes.filter((m) => !m.isDisposed()), ...result.meshes];
    this.terrainMeshes = this.terrainMeshes.filter((m) => !m.isDisposed());
    this.dropUnused();
    return { before: all.length, after: this.meshes.length + this.terrainMeshes.length, merged: names };
  }

  /** The level's and terrain's per-style meshes that can merge (opaque, not glowing), with their surfaces' textures. */
  mergeSources(): MergeSource[] {
    const all = [...this.meshes, ...this.terrainMeshes].filter((m) => !m.isDisposed());
    const sources: MergeSource[] = [];
    for (const mesh of all) {
      const style = this.styleOf.get(mesh);
      if (!style) continue;
      const def = style.material;
      if (def.emissive) continue;
      const tint = style.tint ? Color3.FromHexString(style.tint) : Color3.White();
      const specular = def.shine * 0.6;
      const power = 16 + def.shine * 96;
      if (def.texture) {
        const id = def.texture;
        const url = (map: string) => versioned(`${import.meta.env.BASE_URL}textures/${id}_${map}.jpg`);
        sources.push({ mesh, key: `img:${id}`, size: 512, color: () => jpegPixels(url('color'), 512), normal: () => jpegPixels(url('normal'), 512), tint, specular, power });
      } else {
        const size = patternSize(def);
        sources.push({ mesh, key: `pat:${def.id}`, size, color: async () => materialPixels(def, size), normal: null, tint, specular, power });
      }
    }
    return sources;
  }

  /** Materials and textures of this styler that nothing draws with any more (after a merge): freed, and made again if asked for. */
  private dropUnused(): void {
    const used = new Set<unknown>();
    for (const [key, mat] of this.materials) {
      if (mat.getBindedMeshes().length) {
        for (const t of mat.getActiveTextures()) used.add(t);
        continue;
      }
      mat.dispose(false, false);
      this.materials.delete(key);
    }
    for (const mat of this.scene.materials) for (const t of mat.getActiveTextures()) used.add(t);
    for (const [key, t] of this.images) {
      if (used.has(t)) continue;
      t.dispose();
      this.images.delete(key);
    }
    for (const [key, t] of this.textures) {
      if (used.has(t)) continue;
      t.dispose();
      this.textures.delete(key);
    }
  }

  /** A library material with a tint (null: the theme's solids), for blocks drawn outside the level mesh. */
  surfaceMaterial(doc: MapDocument, material: string | null, tint: string | null): StandardMaterial {
    const def = material ? coreMaterials.get(material) : undefined;
    return this.material(def ? { material: def, tint } : resolveSurface(doc, undefined, 'solids'));
  }

  /** The material terrain of this kind is drawn in (the backdrop's ground uses it too). */
  groundMaterial(material: TerrainMaterial): StandardMaterial {
    return this.material(terrainStyle(material));
  }

  /** Metres per repeat of that ground's texture. */
  groundScale(material: TerrainMaterial): number {
    return terrainStyle(material).material.scale;
  }

  /** Sky colour of the map's theme. */
  static skyColor(doc: MapDocument): Color3 {
    return Color3.FromHexString(coreThemes.get(doc.classicStructure.theme)?.sky ?? '#85a0b8');
  }

  private texture(def: MaterialDefinition): RawTexture {
    let tex = this.textures.get(def.id);
    if (!tex) {
      // Raw pixel upload (no canvas) keeps WebGPU on a plain buffer write.
      const size = patternSize(def);
      tex = RawTexture.CreateRGBATexture(materialPixels(def, size), size, size, this.scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
      tex.wrapU = Texture.WRAP_ADDRESSMODE;
      tex.wrapV = Texture.WRAP_ADDRESSMODE;
      tex.anisotropicFilteringLevel = 8;
      this.textures.set(def.id, tex);
    }
    return tex;
  }

  /** A scanned texture map (shared JPEG), cached per scene. */
  private image(id: string, map: 'color' | 'normal' | 'emission'): Texture {
    const key = `${id}_${map}`;
    let tex = this.images.get(key);
    if (!tex) {
      tex = new Texture(versioned(`${import.meta.env.BASE_URL}textures/${key}.jpg`), this.scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
      tex.anisotropicFilteringLevel = 8;
      this.images.set(key, tex);
    }
    return tex;
  }

  private material(style: ResolvedStyle): StandardMaterial {
    const key = styleKey(style);
    let mat = this.materials.get(key);
    if (!mat) {
      const def = style.material;
      mat = new StandardMaterial(`mat_${key}`, this.scene);
      levelDepthBias(mat);
      if (def.texture) {
        mat.diffuseTexture = this.image(def.texture, 'color');
        mat.bumpTexture = this.image(def.texture, 'normal');
        // OpenGL-convention normal maps in Babylon's left-handed space.
        mat.invertNormalMapY = true;
      } else mat.diffuseTexture = this.texture(def);
      mat.diffuseColor = style.tint ? Color3.FromHexString(style.tint) : Color3.White();
      mat.specularColor = new Color3(def.shine * 0.6, def.shine * 0.6, def.shine * 0.6);
      mat.specularPower = 16 + def.shine * 96;
      if (def.emissive && def.texture) {
        mat.emissiveTexture = this.image(def.texture, 'emission');
        mat.emissiveColor = style.tint ? Color3.FromHexString(style.tint) : Color3.White();
      } else if (def.emissive) {
        mat.emissiveTexture = this.texture(def);
        mat.emissiveColor = style.tint ? Color3.FromHexString(style.tint) : Color3.White();
      }
      this.materials.set(key, mat);
    }
    return mat;
  }
}
