import type { Scene } from '@babylonjs/core/scene';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
// Side-effect import: registers the glTF 2.0 loader plugin.
import '@babylonjs/loaders/glTF/2.0';

/** Base URL of built content (packages/client/public/models). */
export const MODEL_BASE = `${import.meta.env.BASE_URL}models/`;

/**
 * Per-scene cache of loaded GLB models. Each model loads once into an
 * AssetContainer; callers get independent instances (cheap clones sharing
 * geometry and materials).
 */
export class ModelLibrary {
  private readonly containers = new Map<string, Promise<AssetContainer>>();

  constructor(private readonly scene: Scene) {}

  load(path: string): Promise<AssetContainer> {
    let p = this.containers.get(path);
    if (!p) {
      p = LoadAssetContainerAsync(`${MODEL_BASE}${path}`, this.scene);
      this.containers.set(path, p);
    }
    return p;
  }

  /** A new instance of the model under its own root node. */
  async instantiate(path: string, name: string): Promise<TransformNode> {
    const container = await this.load(path);
    const entries = container.instantiateModelsToScene((n) => `${name}_${n}`, false, { doNotInstantiate: true });
    const root = new TransformNode(name, this.scene);
    for (const node of entries.rootNodes) node.parent = root;
    for (const m of root.getChildMeshes()) m.isPickable = false;
    return root;
  }
}
