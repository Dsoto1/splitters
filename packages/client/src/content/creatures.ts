import type { Scene } from '@babylonjs/core/scene';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import './gltf.ts';
import { CREATURE_SPECS, type CreatureModel, type CreatureSpec } from '@tiletrigger/shared';
import { gone, type CharacterSpec } from './characters.ts';
import { GLB, versioned } from '../assetUrl.ts';

/**
 * Creature NPCs (imps, puglins, aliens, the zombie body): models with their own skeletons and
 * clips, kept apart from the soldier/player character path in characters.ts.
 * Built by tools/content/prepare-creatures.mjs into public/creatures.
 */

/** What an avatar is drawn as: a character (player look or soldier NPC), or a creature. */
/** A character, NPC or creature to draw; `size` scales a player's body (small and large looks). */
export type AvatarSpec = CharacterSpec & { creature?: CreatureModel; size?: number; /** A player in a creature skin: carries guns instead of its club. */ armed?: boolean };

export interface CreatureInstance {
  kind: CreatureModel;
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

  private load(kind: CreatureModel): Promise<AssetContainer> {
    let p = this.files.get(kind);
    if (!p) {
      p = LoadAssetContainerAsync(versioned(`${import.meta.env.BASE_URL}${CREATURE_SPECS[kind].model}`), this.scene, GLB);
      this.files.set(kind, p);
    }
    return p;
  }

  preload(kind: CreatureModel): void {
    void this.load(kind);
  }

  async create(kind: CreatureModel, name: string): Promise<CreatureInstance> {
    const spec = CREATURE_SPECS[kind];
    const container = await this.load(kind);
    // The scene went while the file loaded: build nothing into it.
    if (this.scene.isDisposed) return gone();
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
    // Our rig's joint names (retargeted creatures), or a Mixamo-style rig's (the zombie).
    const pelvis = joints.get('pelvis') ?? joints.get('Hips');
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

/** Widest (m, ears and arms included) a player's creature skin is grown to. */
const SKIN_MAX_WIDE = 1.3;

/**
 * Scale a player's creature skin to stand a player's height (looks only: the hitbox is the player's), big ones
 * shrunk to it and small ones grown to it, but a small one with a big head (the puglin's ears) only as far as it
 * stays no wider than SKIN_MAX_WIDE. The same in the match and on Character Select.
 */
export function fitPlayerSkin(ch: CreatureInstance, height: number): void {
  const { min, max } = ch.root.getHierarchyBoundingVectors(true);
  const tall = max.y - min.y;
  if (tall < 0.3) return;
  let s = height / tall;
  const wide = Math.max(max.x - min.x, max.z - min.z);
  if (s > 1 && wide * s > SKIN_MAX_WIDE) s = Math.max(1, SKIN_MAX_WIDE / wide);
  ch.root.scaling.scaleInPlace(s);
}
