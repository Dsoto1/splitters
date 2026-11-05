import type { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';

/**
 * Shadow proxies (docs/PERF_96.md, "Market Town on an M1 Pro"): the shadow map's stand-ins for static geometry.
 * The level is one mesh per material over the whole map (64 on Market Town) and every untinted prop model is a
 * source mesh per material with instances, so each shadow cascade drew all of them: about 400 of a high-quality
 * frame's 600 shadow draws, for triangles that never move. Here their triangles are merged, in world space, into one
 * mesh per PROXY_CELL square (and face-culling mode), drawn only into the shadow map; the originals still draw and
 * catch shadows as before. Anything that moves, is see-through or alpha-tested, skinned, or has levels of detail
 * casts on its own as before.
 */

/** Static casters are merged per square of this many metres (so each cascade draws only the squares it covers). */
export const PROXY_CELL = 48;
/** A thin-instanced mesh is merged only up to this many vertices over all its copies (the proxy copies each one). */
const THIN_VERTEX_CAP = 120_000;

interface Cell {
  positions: number[];
  normals: number[];
  indices: number[];
}

/** Triangles of static geometry sorted into squares, keyed `<cull>:<orientation>:<x>:<z>`. */
export interface ProxyCells {
  cells: Map<string, Cell>;
  /** Meshes merged (each now casts through its squares instead of itself). */
  merged: number;
}

/** The mesh whose geometry and material a (possibly instanced) mesh draws with. */
const geometryOf = (m: AbstractMesh): Mesh | null => (m.isAnInstance ? (m as InstancedMesh).sourceMesh : m instanceof Mesh ? m : null);

/**
 * Whether a mesh can cast through a proxy: placed for good (its world matrix frozen), drawn, opaque without an alpha
 * test, not skinned or morphed, no levels of detail, not a parked instance source (its copies are merged instead),
 * not hidden away out of the world (sources sit at y -10000).
 */
export function proxyable(m: AbstractMesh): boolean {
  if (m.isDisposed() || !m.isEnabled() || !m.isVisible || !m.isWorldMatrixFrozen || m.renderingGroupId !== 0) return false;
  const g = geometryOf(m);
  if (!g || g.getTotalVertices() === 0 || g.skeleton || g.morphTargetManager || g.getLODLevels().length) return false;
  // Thin instances only when they never change (the border's trees, rocks and facades say so); destructibles' do.
  if (g.hasThinInstances && (!(m.metadata as { staticThin?: boolean } | null)?.staticThin || g.thinInstanceCount * g.getTotalVertices() > THIN_VERTEX_CAP)) return false;
  if (!m.isAnInstance && g.hasInstances) return false;
  const mat = g.material as (StandardMaterial & { needAlphaTesting?: () => boolean; needAlphaBlending?: () => boolean }) | null;
  if (!mat || mat.alpha < 0.99 || mat.needAlphaTesting?.() || mat.needAlphaBlending?.() || mat.opacityTexture) return false;
  if (!g.getVerticesData(VertexBuffer.PositionKind) || !g.getIndices()) return false;
  return m.getBoundingInfo().boundingBox.minimumWorld.y > -1000;
}

/**
 * Sort the triangles of `meshes` (proxyable) into PROXY_CELL squares by their centre, in world space, faces turned so
 * that each square's culling (back faces culled or not, and which winding is the front) is the source's.
 */
export function sortIntoCells(meshes: readonly AbstractMesh[]): ProxyCells {
  const cells = new Map<string, Cell>();
  const p = new Vector3();
  const n = new Vector3();
  let merged = 0;
  for (const m of meshes) {
    const g = geometryOf(m);
    const pos = g?.getVerticesData(VertexBuffer.PositionKind);
    const nrm = g?.getVerticesData(VertexBuffer.NormalKind);
    const idx = g?.getIndices();
    if (!g || !pos || !idx) continue;
    merged++;
    // Each thin instance is a copy at its own matrix (then the mesh's own); a plain mesh is one copy.
    const own = m.getWorldMatrix();
    const thin = (g.hasThinInstances ? g.thinInstanceGetWorldMatrices() : []).map((t) => t.multiply(own));
    for (const world of thin.length ? thin : [own]) {
      const flip = world.determinant() < 0;
      const mat = g.material as { backFaceCulling?: boolean; _getEffectiveOrientation?: (mesh: Mesh) => number } | null;
      const cull = mat?.backFaceCulling !== false ? 'cull' : 'both';
      const orientation = mat?._getEffectiveOrientation?.(g) ?? 0;
      // Per square, this mesh's vertex index → the square's (each vertex copied once into each square that uses it).
      const remap = new Map<string, Map<number, number>>();
      for (let t = 0; t + 2 < idx.length; t += 3) {
        const a = idx[t]!;
        const b = idx[t + 1]!;
        const c = idx[t + 2]!;
        const cx = (pos[a * 3]! + pos[b * 3]! + pos[c * 3]!) / 3;
        const cy = (pos[a * 3 + 1]! + pos[b * 3 + 1]! + pos[c * 3 + 1]!) / 3;
        const cz = (pos[a * 3 + 2]! + pos[b * 3 + 2]! + pos[c * 3 + 2]!) / 3;
        Vector3.TransformCoordinatesFromFloatsToRef(cx, cy, cz, world, p);
        const key = `${cull}:${orientation}:${Math.floor(p.x / PROXY_CELL)}:${Math.floor(p.z / PROXY_CELL)}`;
        let cell = cells.get(key);
        if (!cell) cells.set(key, (cell = { positions: [], normals: [], indices: [] }));
        let map = remap.get(key);
        if (!map) remap.set(key, (map = new Map()));
        for (const v of flip ? [a, c, b] : [a, b, c]) {
          let at = map.get(v);
          if (at === undefined) {
            at = cell.positions.length / 3;
            map.set(v, at);
            Vector3.TransformCoordinatesFromFloatsToRef(pos[v * 3]!, pos[v * 3 + 1]!, pos[v * 3 + 2]!, world, p);
            cell.positions.push(p.x, p.y, p.z);
            if (nrm) {
              Vector3.TransformNormalFromFloatsToRef(nrm[v * 3]!, nrm[v * 3 + 1]!, nrm[v * 3 + 2]!, world, n);
              n.normalize();
              cell.normals.push(n.x, n.y, n.z);
            } else cell.normals.push(0, 1, 0);
          }
          cell.indices.push(at);
        }
      }
    }
  }
  return { cells, merged };
}

/**
 * Build the proxies for `meshes` (those that aren't proxyable are left out and returned in neither list): one mesh per
 * square and culling mode, drawn by no camera (layer mask 0; the shadow map's list is set by hand, without a layer
 * check). `tag` keeps batches' names apart.
 */
export function buildShadowProxies(scene: Scene, meshes: readonly AbstractMesh[], tag = '0'): { proxies: Mesh[]; sources: AbstractMesh[] } {
  const sources = meshes.filter(proxyable);
  if (!sources.length) return { proxies: [], sources: [] };
  const { cells } = sortIntoCells(sources);
  const proxies: Mesh[] = [];
  for (const [key, cell] of cells) {
    if (!cell.indices.length) continue;
    const [cull, orientation] = key.split(':');
    const matName = `shadowProxyMat_${cull}_${orientation}`;
    let mat = scene.getMaterialByName(matName) as StandardMaterial | null;
    if (!mat) {
      mat = new StandardMaterial(matName, scene);
      mat.backFaceCulling = cull === 'cull';
      mat.sideOrientation = Number(orientation);
      mat.disableLighting = true;
    }
    const mesh = new Mesh(`shadowProxy_${tag}_${key}`, scene);
    const vd = new VertexData();
    vd.positions = cell.positions;
    vd.normals = cell.normals;
    vd.indices = cell.positions.length / 3 > 65535 ? new Uint32Array(cell.indices) : cell.indices;
    vd.applyToMesh(mesh);
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.layerMask = 0;
    mesh.receiveShadows = false;
    mesh.freezeWorldMatrix();
    mesh.metadata = { shadowProxy: true };
    proxies.push(mesh);
  }
  return { proxies, sources };
}
