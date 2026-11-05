import type { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';

/**
 * Active-mesh candidates (docs/PERF_96.md, "Performance round 2"). Babylon walks every mesh in the scene twice a
 * frame (once for world matrices, once to pick what the camera draws), and a 48-player match has some 3,300: pooled
 * effect instances (sparks, chips, dust, blood drops, kept hidden for reuse), parked effect sources, characters out of
 * view or kept for reuse, and the shadow proxies only the shadow map draws. About half are switched off at any moment.
 * Each frame, once, the candidates are the meshes that are switched on (the same test Babylon makes first, read
 * straight off the node), less the frozen ones no camera draws (layer mask 0: the shadow proxies). Both walks then
 * skip the rest; what they do with each candidate is unchanged.
 */

/** Babylon 9 keeps a node's own and its parents' enabled state here (Node.isEnabled reads the same two). */
interface NodeFlags {
  _nodeDataStorage?: { _isEnabled: boolean; _isParentEnabled: boolean };
}

export function selectLiveCandidates(scene: Scene): () => void {
  const list: AbstractMesh[] = [];
  const view = { data: list, length: 0 };
  let frame = -1;
  const original = scene.getActiveMeshCandidates;
  scene.getActiveMeshCandidates = () => {
    const f = scene.getFrameId();
    if (f !== frame) {
      frame = f;
      const all = scene.meshes;
      let n = 0;
      for (let i = 0; i < all.length; i++) {
        const m = all[i]!;
        const flags = (m as unknown as NodeFlags)._nodeDataStorage;
        if (flags ? !flags._isEnabled || !flags._isParentEnabled : !m.isEnabled()) continue;
        if (m.layerMask === 0 && m.isWorldMatrixFrozen) continue;
        list[n++] = m;
      }
      list.length = n;
      view.length = n;
    }
    return view as unknown as ReturnType<Scene['getActiveMeshCandidates']>;
  };
  return () => {
    scene.getActiveMeshCandidates = original;
  };
}

/** Frames a static mesh's material waits after the mesh comes (shadows and the like are set on it in its first frames). */
const SETTLE_FRAMES = 120;
/** Materials are looked at for freezing this often (frames). */
const FREEZE_EVERY = 60;

interface Freezable {
  isFrozen: boolean;
  freeze(): void;
  unfreeze(): void;
  getClassName(): string;
}

/**
 * Static materials frozen (docs/PERF_96.md, "Performance round 2"): a frozen material skips working out its shader
 * defines and most of its uniforms on every draw. Frozen are the materials that only static meshes (`isStatic`: the
 * level and the props) use, once those have been in the scene SETTLE_FRAMES; nothing changes those materials after
 * they are made, and every map light is in the clustered container, so each mesh sees the same lights. A new mesh
 * drawn with a frozen material thaws it; it freezes again once that mesh has settled.
 */
export function freezeStaticMaterials(scene: Scene, isStatic: (m: AbstractMesh) => boolean): () => void {
  const born = new WeakMap<AbstractMesh, number>();
  const frozen = new Set<Freezable>();
  const added = scene.onNewMeshAddedObservable.add((m) => {
    born.set(m, scene.getFrameId());
    const mat = m.material as Freezable | null;
    if (mat && frozen.has(mat)) {
      mat.unfreeze();
      frozen.delete(mat);
    }
  });
  const tick = scene.onAfterRenderObservable.add(() => {
    const frame = scene.getFrameId();
    if (frame % FREEZE_EVERY !== 0) return;
    const ok = new Map<Freezable, boolean>();
    for (const m of scene.meshes) {
      const mat = m.material as Freezable | null;
      if (!mat || mat.isFrozen) continue;
      const kind = mat.getClassName();
      const fine = (kind === 'StandardMaterial' || kind === 'PBRMaterial') && isStatic(m) && frame - (born.get(m) ?? -Infinity) > SETTLE_FRAMES;
      ok.set(mat, (ok.get(mat) ?? true) && fine);
    }
    for (const [mat, fine] of ok) {
      if (!fine) continue;
      mat.freeze();
      frozen.add(mat);
    }
  });
  return () => {
    added.remove();
    tick.remove();
    for (const m of frozen) m.unfreeze();
    frozen.clear();
  };
}
