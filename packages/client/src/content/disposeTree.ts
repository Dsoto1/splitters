import type { Node } from '@babylonjs/core/node';

/**
 * Dispose a node and everything under it, without Babylon's per-node animation search.
 *
 * Every node's `dispose` calls `scene.stopAnimation(node)`, which walks all of the scene's running animatables
 * (one per bone per playing clip: thousands in a 100-player match). A character is some hundred nodes, so letting
 * each search cost tens of milliseconds a body: a hitch at every respawn that changes a look (Roulette: every life).
 * Here the animatables aimed at the tree are stopped in one pass, and the per-node searches skipped meanwhile.
 */
export function disposeTree(root: Node, disposeMaterialAndTextures = false): void {
  const scene = root.getScene() as ReturnType<Node['getScene']> & { _activeAnimatables?: { target: unknown; stop(): void }[] };
  const running = scene._activeAnimatables;
  if (!running) return root.dispose(false, disposeMaterialAndTextures);
  if (running.length) {
    const nodes = new Set<unknown>(root.getDescendants(false));
    nodes.add(root);
    // (A copy: stopping takes an animatable out of the scene's list.)
    for (const a of running.filter((a) => nodes.has(a.target))) a.stop();
  }
  const search = scene.stopAnimation;
  scene.stopAnimation = () => {};
  // And the scene's lists of what it drew are freed once for the tree, not once a mesh (Babylon's own switch for this).
  const blocked = scene.blockfreeActiveMeshesAndRenderingGroups;
  scene.blockfreeActiveMeshesAndRenderingGroups = true;
  try {
    root.dispose(false, disposeMaterialAndTextures);
  } finally {
    scene.stopAnimation = search;
    scene.blockfreeActiveMeshesAndRenderingGroups = blocked;
  }
}
