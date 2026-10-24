import type { Scene } from '@babylonjs/core/scene';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/2.0';
import { CREATURE_SPECS, type CreatureKind, type CreatureSpec } from '@chronosplit/shared';
import type { CharacterSpec } from './characters.ts';

/**
 * Creature NPCs (imps, puglins, aliens): models with their own skeletons and
 * clips, kept apart from the soldier/player character path in characters.ts.
 * Built by tools/content/prepare-creatures.mjs into public/creatures.
 */

/** What an avatar is drawn as: a character (player look or soldier NPC), or a creature. */
/** A character, NPC or creature to draw; `size` scales a player's body (small and large looks). */
export type AvatarSpec = CharacterSpec & { creature?: CreatureKind; size?: number };

export interface CreatureInstance {
  kind: CreatureKind;
  spec: CreatureSpec;
  /** Place and turn this node; the creature stands (or hovers) over its origin facing +Z. */
  root: TransformNode;
  /** Scaled and lifted model under `root`; the animator tilts and moves it for procedural motion. */
  body: TransformNode;
  /** Skeleton joints by name. */
  joints: Map<string, TransformNode>;
  /** The model's clips by name (idle, walk, run, attack, hit, death; aliens have only idle). */
  clips: Map<string, AnimationGroup>;
  meshes: AbstractMesh[];
  /** Height of the hips above the feet (metres, humanoids), for matching foot speed. */
  hipHeight: number;
  dispose(): void;
}

export class CreatureLibrary {
  private readonly files = new Map<string, Promise<AssetContainer>>();

  constructor(private readonly scene: Scene) {}

  private load(kind: CreatureKind): Promise<AssetContainer> {
    let p = this.files.get(kind);
    if (!p) {
      p = LoadAssetContainerAsync(`${import.meta.env.BASE_URL}${CREATURE_SPECS[kind].model}`, this.scene);
      this.files.set(kind, p);
    }
    return p;
  }

  preload(kind: CreatureKind): void {
    void this.load(kind);
  }

  async create(kind: CreatureKind, name: string): Promise<CreatureInstance> {
    const spec = CREATURE_SPECS[kind];
    const container = await this.load(kind);
    const root = new TransformNode(name, this.scene);
    const body = new TransformNode(`${name}_body`, this.scene);
    body.parent = root;
    const inst = container.instantiateModelsToScene((n) => `${name}_${n}`, false, { doNotInstantiate: true });
    for (const n of inst.rootNodes) n.parent = body;
    // Our name prefix comes off again (clones may or may not carry it).
    const own = (n: string) => (n.startsWith(`${name}_`) ? n.slice(name.length + 1) : n);
    const clips = new Map<string, AnimationGroup>();
    for (const g of inst.animationGroups) {
      g.stop();
      clips.set(own(g.name), g);
    }
    const joints = new Map<string, TransformNode>();
    for (const n of body.getDescendants(false)) if (n instanceof TransformNode && !('getTotalVertices' in n)) joints.set(own(n.name), n);
    const meshes = body.getChildMeshes(false);
    for (const m of meshes) {
      m.isPickable = false;
      // Skinned meshes move away from their bind-pose bounds; don't let them be culled.
      m.alwaysSelectAsActiveMesh = true;
    }
    // Stand the model on the ground (or hover it): its lowest point in the bind pose goes to `hover`.
    body.scaling.setAll(spec.scale);
    root.computeWorldMatrix(true);
    const { min } = body.getHierarchyBoundingVectors(true);
    body.position.y = -min.y + spec.hover;
    const pelvis = joints.get('pelvis');
    root.computeWorldMatrix(true);
    const hipHeight = pelvis ? Math.max(0.2, pelvis.getAbsolutePosition().y - spec.hover) : 0.9;
    return {
      kind,
      spec,
      root,
      body,
      joints,
      clips,
      meshes,
      hipHeight,
      dispose: () => {
        for (const g of inst.animationGroups) g.dispose();
        for (const s of inst.skeletons) s.dispose();
        root.dispose(false, false);
      },
    };
  }
}
