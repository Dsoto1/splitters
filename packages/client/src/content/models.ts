import type { Scene } from '@babylonjs/core/scene';
import { AssetContainer } from '@babylonjs/core/assetContainer';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
// Side-effect import: registers the glTF 2.0 loader plugin.
import '@babylonjs/loaders/glTF/2.0';
import { GLB, versioned } from '../assetUrl.ts';

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

  /** `path` is relative to public/models, or to public itself for placeable props, creatures and the city kit ("props/…", "creatures/…", "city/…"). */
  load(path: string): Promise<AssetContainer> {
    let p = this.containers.get(path);
    if (!p && path.startsWith('procedural/')) {
      p = Promise.resolve(proceduralModel(this.scene, path));
      this.containers.set(path, p);
    }
    if (!p) {
      p = LoadAssetContainerAsync(versioned(/^(props|creatures|city)\//.test(path) ? `${import.meta.env.BASE_URL}${path}` : `${MODEL_BASE}${path}`), this.scene, GLB);
      this.containers.set(path, p);
    }
    return p;
  }

  /**
   * A new copy of the model under its own root node. With `instanced`, its
   * meshes are GPU instances of the first copy (one draw call for all of
   * them; materials can't then differ per copy).
   */
  async instantiate(path: string, name: string, instanced = false): Promise<TransformNode> {
    const container = await this.load(path);
    const entries = container.instantiateModelsToScene((n) => `${name}_${n}`, false, { doNotInstantiate: !instanced });
    const root = new TransformNode(name, this.scene);
    for (const node of entries.rootNodes) node.parent = root;
    for (const m of root.getChildMeshes()) m.isPickable = false;
    return root;
  }
}

/**
 * Small models built from boxes in code ("procedural/<name>"), for kit we have
 * no model file for. Built into an AssetContainer so they load like any GLB.
 */
function proceduralModel(scene: Scene, path: string): AssetContainer {
  const c = new AssetContainer(scene);
  const material = (name: string, hex: string, emissive = 0) => {
    const m = new StandardMaterial(`${path}_${name}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.15, 0.15, 0.15);
    if (emissive) m.emissiveColor = Color3.FromHexString(hex).scale(emissive);
    scene.removeMaterial(m);
    c.materials.push(m);
    return m;
  };
  const root = new TransformNode(`${path}_root`, scene);
  scene.removeTransformNode(root);
  c.transformNodes.push(root);
  const box = (name: string, size: [number, number, number], at: [number, number, number], m: StandardMaterial) => {
    const b = CreateBox(`${path}_${name}`, { width: size[0], height: size[1], depth: size[2] }, scene);
    b.position.set(...at);
    b.material = m;
    b.parent = root;
    scene.removeMesh(b);
    c.meshes.push(b);
  };
  if (path === 'procedural/spear') {
    // A wooden shaft with a bound grip and an iron head, pointing along +z (held like a pistol, the head well forward).
    const wood = material('wood', '#8a6238');
    const iron = material('iron', '#a7adb4', 0.1);
    const wrap = material('wrap', '#4a3624');
    box('shaft', [0.03, 0.03, 1.5], [0, 0, 0.35], wood);
    box('grip', [0.04, 0.04, 0.18], [0, 0, 0], wrap);
    box('head', [0.06, 0.012, 0.2], [0, 0, 1.18], iron);
    box('tip', [0.03, 0.012, 0.08], [0, 0, 1.31], iron);
  }
  if (path === 'procedural/builder') {
    // Fort Wars Builder: a claw hammer with a steel head and a taped wooden handle, held like a pistol.
    const wood = material('wood', '#9a6b3f');
    const steel = material('steel', '#9aa3ab', 0.08);
    const tape = material('tape', '#d8a630', 0.2);
    box('handle', [0.035, 0.035, 0.34], [0, 0, 0.05], wood);
    box('grip', [0.042, 0.042, 0.12], [0, 0, -0.06], tape);
    box('head', [0.05, 0.05, 0.16], [0, 0.03, 0.23], steel);
    box('face', [0.06, 0.06, 0.03], [0, 0.03, 0.31], steel);
    box('claw', [0.03, 0.025, 0.08], [0, 0.07, 0.16], steel);
  }
  if (path === 'procedural/medkit') {
    // A white first-aid case with a red cross and a dark handle, held like a pistol (barrel along +z).
    const white = material('white', '#eeeeea');
    const red = material('red', '#d8262c', 0.35);
    const dark = material('dark', '#2a2d33');
    box('case', [0.2, 0.15, 0.26], [0, 0, 0.05], white);
    box('crossV', [0.04, 0.11, 0.005], [0, 0, -0.083], red);
    box('crossH', [0.11, 0.04, 0.005], [0, 0, -0.083], red);
    box('crossV2', [0.205, 0.11, 0.04], [0, 0, 0.05], red);
    box('handle', [0.05, 0.03, 0.1], [0, 0.09, 0.05], dark);
  }
  return c;
}
