import type { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { BoundingInfo } from '@babylonjs/core/Culling/boundingInfo';
import type { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

/** The still casters' box is worked out again at least this often (frames), besides whenever the casters' list changes. */
export const STILL_BOUNDS_FRAMES = 60;

/** What a cascaded shadow generator keeps for its casters' box (Babylon's own fields). */
interface CasterBoxOwner {
  _shadowMap: RenderTargetTexture | null;
  _scbiMin: Vector3;
  _scbiMax: Vector3;
  _shadowCastersBoundingInfo: BoundingInfo;
  _computeShadowCastersBoundingInfo(): void;
}

/**
 * A caster whose box never changes: a frozen world matrix on one mesh (thin instances' boxes follow their copies), or a
 * mesh made never to change (the shadow proxies, the trees' static shadow sets, never-changing batches: `shadowProxy`,
 * `staticCaster`, `staticThin`). The every-STILL_BOUNDS_FRAMES refresh catches a batch that gains copies.
 */
export function stillCaster(m: AbstractMesh): boolean {
  const meta = m.metadata as { shadowProxy?: boolean; staticCaster?: boolean; staticThin?: boolean } | null;
  if (meta?.shadowProxy || meta?.staticCaster || meta?.staticThin) return true;
  return m.isWorldMatrixFrozen && !m.hasThinInstances && !m.skeleton;
}

/**
 * The cascades fit their depth range to a box round every shadow caster (`_computeShadowCastersBoundingInfo`), which
 * Babylon works out afresh every frame from every caster on the map: 1.5 % of a 63-player St. John's frame on the owner's
 * M1 (docs/PERF_DRAWS_2026-11-23.md), nearly all of it the level and the props, which never move. Here the still casters'
 * box is kept (worked out again when the list changes and every STILL_BOUNDS_FRAMES frames) and only the moving ones are
 * added each frame: the same box. `?perfoff=casterbounds` leaves Babylon's.
 */
export function keepStillCasterBounds(generator: unknown, scene: Scene): void {
  const g = generator as CasterBoxOwner;
  const stillMin = new Vector3();
  const stillMax = new Vector3();
  const moving: AbstractMesh[] = [];
  let seen: AbstractMesh[] | null = null;
  let seenLength = -1;
  let seenFrame = -1;
  g._computeShadowCastersBoundingInfo = () => {
    g._scbiMin.copyFromFloats(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    g._scbiMax.copyFromFloats(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    const list = g._shadowMap?.renderList;
    if (list) {
      const frame = scene.getFrameId();
      if (list !== seen || list.length !== seenLength || frame - seenFrame >= STILL_BOUNDS_FRAMES) {
        seen = list;
        seenLength = list.length;
        seenFrame = frame;
        moving.length = 0;
        stillMin.copyFromFloats(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
        stillMax.copyFromFloats(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
        for (const m of list) {
          if (!m) continue;
          if (!stillCaster(m)) {
            moving.push(m);
            continue;
          }
          const box = m.getBoundingInfo().boundingBox;
          stillMin.minimizeInPlace(box.minimumWorld);
          stillMax.maximizeInPlace(box.maximumWorld);
        }
      }
      g._scbiMin.copyFrom(stillMin);
      g._scbiMax.copyFrom(stillMax);
      for (const m of moving) {
        if (m.isDisposed()) continue;
        const box = m.getBoundingInfo().boundingBox;
        g._scbiMin.minimizeInPlace(box.minimumWorld);
        g._scbiMax.maximizeInPlace(box.maximumWorld);
      }
    }
    g._shadowCastersBoundingInfo.reConstruct(g._scbiMin, g._scbiMax);
  };
}
