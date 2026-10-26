import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { buildFacades, tileModels, type MapDocument } from '@tiletrigger/shared';
import type { ModelLibrary } from '../content/models.ts';

/**
 * The city kit in a map: facade pieces on rooms with a `facade` option (one
 * GPU-instanced mesh per piece and material, however many bays use it; the
 * city kit's and the Style Packs' facade files alike) and the models of
 * model-backed tiles (city buildings and streets, Neon Megacity towers). Rebuilt whenever the map changes;
 * `ready` settles once everything for the latest build is in the scene.
 */
export class CityVisuals {
  ready: Promise<void> = Promise.resolve();
  private meshes: Mesh[] = [];
  private nodes: TransformNode[] = [];
  private build = 0;

  constructor(
    private readonly models: ModelLibrary,
    private readonly name = 'city',
  ) {}

  setMap(doc: MapDocument): Promise<void> {
    const build = ++this.build;
    this.ready = this.make(doc, build).catch(() => undefined);
    return this.ready;
  }

  dispose(): void {
    this.build++;
    this.clear();
  }

  private clear(): void {
    for (const m of this.meshes) m.dispose();
    for (const n of this.nodes) n.dispose();
    this.meshes = [];
    this.nodes = [];
  }

  private async make(doc: MapDocument, build: number): Promise<void> {
    const pieces = buildFacades(doc);
    const tiles = tileModels(doc);
    const byFile = new Map<string, typeof pieces>();
    for (const p of pieces) (byFile.get(p.file) ?? byFile.set(p.file, []).get(p.file)!).push(p);
    const files = [...byFile.keys()];
    const facadeFiles = await Promise.all(files.map((f) => this.models.load(f)));
    const tileNodes = await Promise.all(tiles.map((t) => this.models.instantiate(t.file, `${this.name}_${t.id}`, true)));
    if (build !== this.build) {
      for (const n of tileNodes) n.dispose();
      return;
    }
    this.clear();
    tiles.forEach((t, i) => {
      const node = tileNodes[i]!;
      node.position.set(...t.at);
      node.rotation.y = t.yaw;
      this.nodes.push(node);
    });
    files.forEach((f, k) => this.instanceFacades(facadeFiles[k]!, byFile.get(f)!));
  }

  /** One file's facade pieces: each piece's meshes become thin instances, one per bay. */
  private instanceFacades(facades: Awaited<ReturnType<ModelLibrary['load']>>, pieces: ReturnType<typeof buildFacades>): void {
    const inst = facades.instantiateModelsToScene((n) => `${this.name}_${n}`, false, { doNotInstantiate: true });
    const byPiece = new Map<string, typeof pieces>();
    for (const p of pieces) (byPiece.get(p.piece) ?? byPiece.set(p.piece, []).get(p.piece)!).push(p);
    const roots = inst.rootNodes as TransformNode[];
    for (const root of roots) root.computeWorldMatrix(true);
    for (const root of roots) {
      for (const node of root.getChildTransformNodes(false)) {
        const list = byPiece.get(node.name.replace(`${this.name}_`, ''));
        const meshes = node.getChildMeshes(false) as Mesh[];
        if (node.getClassName() === 'Mesh') meshes.push(node as Mesh);
        for (const mesh of meshes) {
          if (!list) continue;
          // The piece's own transform (the glTF axis change) comes first, then each bay's.
          const base = mesh.computeWorldMatrix(true).clone();
          mesh.parent = null;
          mesh.position.setAll(0);
          mesh.rotationQuaternion = null;
          mesh.rotation.setAll(0);
          mesh.scaling.setAll(1);
          const buf = new Float32Array(list.length * 16);
          list.forEach((p, i) => {
            const m = Matrix.Compose(new Vector3(p.sx, p.sy, 1), Quaternion.RotationAxis(Vector3.Up(), p.yaw), new Vector3(...p.at));
            base.multiply(m).copyToArray(buf, i * 16);
          });
          mesh.thinInstanceSetBuffer('matrix', buf, 16, true);
          mesh.isPickable = false;
          mesh.alwaysSelectAsActiveMesh = false;
          mesh.thinInstanceRefreshBoundingInfo(false);
          this.meshes.push(mesh);
        }
      }
    }
    // Pieces with no bays and the empty import roots go.
    for (const m of inst.rootNodes.flatMap((r) => r.getChildMeshes(false))) if (!this.meshes.includes(m as Mesh)) m.dispose();
    for (const r of inst.rootNodes) r.dispose();
  }
}
