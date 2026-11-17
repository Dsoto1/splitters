import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';

/**
 * Babylon keeps, on a mesh whose bounds it worked out through its skeleton (every clone of a skinned mesh: a body's
 * parts as the character library instances them), one Vector3 per vertex: the cache its CPU picking and collisions read
 * (`_internalAbstractMeshDataInfo._positions`). A body is never picked or collided that way (`isPickable` is off; hits
 * are the host's hitboxes), and a dense character keeps tens of thousands of them: about 230 MB of objects across a
 * 65-player Flavius Rule match, for the garbage collector to walk on every full collection
 * (docs/PERF_FLAVIUS_MEMORY_2026-11-16.md). Dropped here; a pick that ever wants it builds it again from the geometry.
 * Returns how many points were dropped.
 */
export function dropPointCaches(meshes: Iterable<AbstractMesh>): number {
  let n = 0;
  for (const m of meshes) {
    const info = (m as unknown as { _internalAbstractMeshDataInfo?: { _positions: unknown[] | null } })._internalAbstractMeshDataInfo;
    if (!info?._positions) continue;
    n += info._positions.length;
    info._positions = null;
  }
  return n;
}
