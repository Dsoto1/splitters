import type { Scene } from '@babylonjs/core/scene';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Animation } from '@babylonjs/core/Animations/animation';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/2.0';
import { PLAYER, getLook, type BodyType } from '@chronosplit/shared';

/** Base URL of built character content (packages/client/public/characters). */
export const CHARACTER_BASE = `${import.meta.env.BASE_URL}characters/`;

/** Animation clip names in rig.glb (see tools/content/prepare-characters.mjs). */
export type Clip =
  | 'idle'
  | 'aim_idle'
  | 'walk'
  | 'run'
  | 'sprint'
  | 'jump_start'
  | 'jump_air'
  | 'jump_land'
  | 'death'
  | 'hit'
  | 'shoot'
  | 'reload'
  | 'melee'
  | 'melee_heavy'
  | 'interact'
  | 'dance'
  | 'knockback'
  | 'throw'
  | 'cheer'
  | 'idle_arms';

export interface CharacterInstance {
  /** Place and turn this node; the model stands on its origin facing +Z. */
  root: TransformNode;
  /** Skeleton joints by name (driven by the animation groups). */
  joints: Map<string, TransformNode>;
  clips: Map<Clip, AnimationGroup>;
  meshes: AbstractMesh[];
  body: BodyType | 'mannequin';
  dispose(): void;
}

export interface CharacterSpec {
  /** A player look (CORE_LOOKS ID). */
  look?: string;
  /** An NPC: the mannequin in a faction colour. */
  npc?: { color: string; scale: number };
}

/**
 * Builds animated characters from the shared parts. A look is an outfit (which
 * carries the skeleton) plus a head and hair re-skinned onto that skeleton;
 * the rig's animation clips are retargeted onto it by joint name. Everything
 * loads once per scene and is instanced per character.
 */
export class CharacterLibrary {
  private readonly files = new Map<string, Promise<AssetContainer>>();
  private readonly textures = new Map<string, Texture>();
  /** Hip offsets between the rig's rest pose and each body's, per clip. */
  private readonly hipAnims = new Map<string, Animation>();

  constructor(private readonly scene: Scene) {}

  private load(file: string): Promise<AssetContainer> {
    let p = this.files.get(file);
    if (!p) {
      p = LoadAssetContainerAsync(`${CHARACTER_BASE}${file}`, this.scene);
      this.files.set(file, p);
    }
    return p;
  }

  /** Start fetching everything a spec needs (so first appearances don't hitch). */
  preload(spec: CharacterSpec): void {
    void this.load('rig.glb');
    if (spec.look) {
      const l = getLook(spec.look);
      for (const part of [l.outfit, l.head, l.hair]) if (part) void this.load(`${part}.glb`);
    }
  }

  async create(spec: CharacterSpec, name: string): Promise<CharacterInstance> {
    const rig = await this.load('rig.glb');
    const holder = new TransformNode(name, this.scene);
    const meshes: AbstractMesh[] = [];
    const owned: { dispose(): void }[] = [];
    let joints: Map<string, TransformNode>;
    let clips: Map<Clip, AnimationGroup>;
    let body: CharacterInstance['body'];

    if (spec.npc) {
      // The rig's own mannequin: skeleton and clips come along with the instance.
      const inst = rig.instantiateModelsToScene((n) => n, true, { doNotInstantiate: true });
      for (const n of inst.rootNodes) n.parent = holder;
      joints = jointMap(inst.rootNodes);
      clips = new Map(inst.animationGroups.map((g) => [g.name as Clip, g]));
      for (const g of inst.animationGroups) g.stop();
      for (const m of holder.getChildMeshes()) {
        meshes.push(m);
        const mat = m.material as PBRMaterial | null;
        if (mat && mat.name.startsWith('M_Main')) mat.albedoColor = Color3.FromHexString(spec.npc.color);
        else if (mat) mat.albedoColor = new Color3(0.12, 0.13, 0.15);
      }
      owned.push(...inst.skeletons);
      holder.scaling.setAll(spec.npc.scale);
      body = 'mannequin';
    } else {
      const look = getLook(spec.look);
      const [outfitC, headC, hairC] = await Promise.all([this.load(`${look.outfit}.glb`), this.load(`${look.head}.glb`), look.hair ? this.load(`${look.hair}.glb`) : Promise.resolve(null)]);
      // The outfit carries the skeleton; colourways need their own material copies.
      const outfit = outfitC.instantiateModelsToScene((n) => n, look.colorway !== null, { doNotInstantiate: true });
      for (const n of outfit.rootNodes) n.parent = holder;
      const skeleton = outfit.skeletons[0]!;
      joints = jointMap(outfit.rootNodes);
      const anchor = outfit.rootNodes[0]!;
      meshes.push(...holder.getChildMeshes());
      for (const part of [headC, hairC]) {
        if (!part) continue;
        const inst = part.instantiateModelsToScene((n) => n, false, { doNotInstantiate: true });
        const partRoot = inst.rootNodes[0]!;
        for (const m of partRoot.getChildMeshes()) {
          // Every part is bound to this body's rest pose, so it can share the outfit's skeleton.
          if (m.skeleton) m.skeleton = skeleton;
          m.parent = anchor;
          meshes.push(m);
        }
        for (const s of inst.skeletons) s.dispose();
        for (const n of inst.rootNodes) n.dispose(true);
      }
      if (look.colorway) {
        const tex = this.colorway(look.colorway);
        for (const m of meshes) {
          const mat = m.material as PBRMaterial | null;
          if (mat && /MI_(Ranger|Peasant)/.test(mat.name)) mat.albedoTexture = tex;
        }
      }
      owned.push(...outfit.skeletons);
      body = look.body;
      clips = this.retarget(rig, joints, `${name}_${look.body}`, look.body);
    }
    for (const m of meshes) {
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true;
    }
    return {
      root: holder,
      joints,
      clips,
      meshes,
      body,
      dispose: () => {
        for (const g of clips.values()) g.dispose();
        for (const o of owned) o.dispose();
        holder.dispose(false, false);
      },
    };
  }

  /** Clone the rig's clips onto another skeleton's joints, correcting the hip height for that body. */
  private retarget(rig: AssetContainer, joints: Map<string, TransformNode>, name: string, body: BodyType): Map<Clip, AnimationGroup> {
    const rigPelvis = rig.transformNodes.find((n) => n.name === 'pelvis');
    const pelvis = joints.get('pelvis');
    const offset = rigPelvis && pelvis ? pelvis.position.subtract(rigPelvis.position) : Vector3.Zero();
    const out = new Map<Clip, AnimationGroup>();
    for (const src of rig.animationGroups) {
      const g = new AnimationGroup(`${name}_${src.name}`, this.scene);
      for (const ta of src.targetedAnimations) {
        const target = joints.get((ta.target as TransformNode).name);
        if (!target) continue;
        let anim = ta.animation;
        if (target.name === 'pelvis' && anim.targetProperty === 'position') anim = this.hipAnim(anim, body, offset, src.name);
        g.addTargetedAnimation(anim, target);
      }
      g.normalize(src.from, src.to);
      out.set(src.name as Clip, g);
    }
    return out;
  }

  private hipAnim(anim: Animation, body: BodyType, offset: Vector3, clip: string): Animation {
    const key = `${body}:${clip}`;
    let a = this.hipAnims.get(key);
    if (!a) {
      a = anim.clone();
      a.setKeys(anim.getKeys().map((k) => ({ ...k, value: (k.value as Vector3).add(offset) })));
      this.hipAnims.set(key, a);
    }
    return a;
  }

  private colorway(id: string): Texture {
    let t = this.textures.get(id);
    if (!t) {
      // glTF textures are not flipped vertically.
      t = new Texture(`${CHARACTER_BASE}textures/${id}.jpg`, this.scene, false, false);
      this.textures.set(id, t);
    }
    return t;
  }

  /** Character height in metres before scaling, for fitting to the player capsule. */
  static readonly TARGET_HEIGHT = PLAYER.height;
}

function jointMap(roots: readonly { getDescendants(directOnly?: boolean): unknown[] }[]): Map<string, TransformNode> {
  const map = new Map<string, TransformNode>();
  for (const r of roots) {
    for (const n of r.getDescendants(false)) if (n instanceof TransformNode && !(n as AbstractMesh).getTotalVertices) map.set(n.name, n);
  }
  return map;
}
