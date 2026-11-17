import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';

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

let quiet = 0;
let patched = false;

/**
 * Run `fn` (instancing a character's files) with Babylon's bounds refreshes making no picking points: a clone of a
 * skinned mesh refreshes its bounds through the skeleton with `refreshBoundingInfo(true, true)`, which also builds the
 * per-vertex Vector3 cache that dropPointCaches throws away again, some 10 MB of short-lived objects a body (most of a
 * body's build garbage, docs/PERF_FLAVIUS_MEMORY_2026-11-16.md). The bounds come out the same; only the cache is left out.
 */
export function withoutPointCaches<T>(fn: () => T): T {
  if (!patched) {
    patched = true;
    // Mesh has its own (the clones'); AbstractMesh's serves the rest.
    for (const cls of [AbstractMesh, Mesh]) {
      if (!Object.prototype.hasOwnProperty.call(cls.prototype, 'refreshBoundingInfo')) continue;
      const proto = cls.prototype as unknown as { refreshBoundingInfo(a?: boolean | object, b?: boolean): AbstractMesh };
      const refresh = proto.refreshBoundingInfo;
      proto.refreshBoundingInfo = function (this: AbstractMesh, a: boolean | object = false, b = false): AbstractMesh {
        if (quiet && typeof a !== 'object') return refresh.call(this, { applySkeleton: a, applyMorph: b, updatePositionsArray: false });
        return refresh.call(this, a, b);
      };
    }
  }
  quiet++;
  try {
    return fn();
  } finally {
    quiet--;
  }
}
