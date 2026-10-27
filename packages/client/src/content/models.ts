import type { Scene } from '@babylonjs/core/scene';
import { AssetContainer } from '@babylonjs/core/assetContainer';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Material } from '@babylonjs/core/Materials/material';
import '@babylonjs/core/Meshes/instancedMesh';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
// Side-effect import: registers the glTF 2.0 loader plugin.
import '@babylonjs/loaders/glTF/2.0';
import { MODEL_FALLBACKS } from '@tiletrigger/shared';
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
      p = LoadAssetContainerAsync(versioned(/^(props|creatures|city|packs)\//.test(path) ? `${import.meta.env.BASE_URL}${path}` : `${MODEL_BASE}${path}`), this.scene, GLB);
      // Models from pack downloads (content/guns.json) fall back to the ones they replaced.
      const fallback = MODEL_FALLBACKS[path];
      if (fallback) p = p.catch(() => this.load(fallback));
      this.containers.set(path, p);
    }
    return p;
  }

  private readonly merged = new Map<string, Promise<Mesh[] | null>>();

  /**
   * A static copy of a model (placed props in the game): GPU instances of
   * the model with its meshes merged per material, so a model of many parts
   * (a dresser of drawers, a kitchen) is one draw per material for every copy
   * on the map, and one mesh per material for the scene to look at. Falls
   * back to `instantiate` (instanced) for models that animate, skin or morph.
   */
  async instantiateStatic(path: string, name: string): Promise<TransformNode> {
    let p = this.merged.get(path);
    if (!p) {
      p = this.mergeModel(path).catch(() => null);
      this.merged.set(path, p);
    }
    const sources = await p;
    if (!sources) return this.instantiate(path, name, true);
    const root = new TransformNode(name, this.scene);
    for (const src of sources) {
      const inst = src.createInstance(`${name}_${src.name}`);
      // An instance starts at its source's place (parked far below): it sits at the model's origin instead.
      inst.position.setAll(0);
      inst.parent = root;
      inst.isPickable = false;
    }
    return root;
  }

  /** The model's meshes merged per material (in the model's own space), parked out of sight as instance sources. */
  private async mergeModel(path: string): Promise<Mesh[] | null> {
    const container = await this.load(path);
    if (container.animationGroups.length || container.skeletons.length) return null;
    const inst = container.instantiateModelsToScene((n) => `static_${n}`, false, { doNotInstantiate: true });
    const holder = new TransformNode(`static_${path}`, this.scene);
    for (const n of inst.rootNodes) n.parent = holder;
    const meshes = holder.getChildMeshes(false).filter((m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0);
    const groups = new Map<Material | null, Mesh[]>();
    let ok = meshes.length > 0;
    for (const m of meshes) {
      if (m.skeleton || m.morphTargetManager || m.hasThinInstances || !m.getIndices()) ok = false;
      let g = groups.get(m.material);
      if (!g) groups.set(m.material, (g = []));
      g.push(m);
    }
    // Faces' winding must agree within a merged mesh (the import mirrors the model, and marks which way its faces turn).
    if (ok && new Set(meshes.map((m) => m.sideOrientation)).size > 1) ok = false;
    const out: Mesh[] = [];
    if (ok) {
      holder.computeWorldMatrix(true);
      let i = 0;
      for (const [material, group] of groups) {
        const datas = group.map((m) => {
          m.computeWorldMatrix(true);
          const d = VertexData.ExtractFromMesh(m, true, true);
          // Into the model's space (flipping faces where a part is mirrored).
          d.transform(m.getWorldMatrix());
          return d;
        });
        const total = datas.reduce((n, d) => n + (d.positions?.length ?? 0) / 3, 0);
        let data: VertexData;
        try {
          data = datas.length > 1 ? datas[0]!.merge(datas.slice(1), total > 65535, false, false, true) : datas[0]!;
        } catch {
          ok = false;
          break;
        }
        const mesh = new Mesh(`static_${path}_${i++}`, this.scene);
        data.applyToMesh(mesh, false);
        mesh.material = material;
        mesh.sideOrientation = group[0]!.sideOrientation;
        mesh.hasVertexAlpha = group.some((m) => m.hasVertexAlpha);
        mesh.isPickable = false;
        // Parked out of sight: only its instances draw.
        mesh.position.y = -10000;
        mesh.freezeWorldMatrix();
        out.push(mesh);
      }
    }
    holder.dispose(false, false);
    if (!ok) {
      for (const m of out) m.dispose(false, false);
      return null;
    }
    return out;
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
    // The glTF loader's __root__ is an empty mesh (it turns the model into Babylon's handedness): a plain node
    // does the same without being one more mesh the scene checks for drawing every frame (a map's props had a thousand).
    for (const node of entries.rootNodes) if (node instanceof Mesh && !node.isAnInstance && !node.getTotalVertices() && !node.skeleton && !node.hasThinInstances) asNode(node);
    for (const m of root.getChildMeshes()) m.isPickable = false;
    return root;
  }
}

/** Swap an empty mesh for a transform node in its place (same transform, same children). */
export function asNode(mesh: Mesh): TransformNode {
  const node = new TransformNode(mesh.name, mesh.getScene());
  node.parent = mesh.parent;
  node.position.copyFrom(mesh.position);
  if (mesh.rotationQuaternion) node.rotationQuaternion = mesh.rotationQuaternion.clone();
  else node.rotation.copyFrom(mesh.rotation);
  node.scaling.copyFrom(mesh.scaling);
  node.setEnabled(mesh.isEnabled(false));
  for (const child of mesh.getChildren()) child.parent = node;
  mesh.dispose(true);
  return node;
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
