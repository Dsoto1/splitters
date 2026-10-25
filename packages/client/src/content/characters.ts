import type { Scene } from '@babylonjs/core/scene';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Node } from '@babylonjs/core/node';
import type { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Animation } from '@babylonjs/core/Animations/animation';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/2.0';
import { NPC_LOOK_COLORS, NPC_ROLE_SPECS, PLAYER, firstPersonArms, getLook, npcLookRole, materialTint, textureFor, type BodyType, type CharacterLook } from '@chronosplit/shared';
import { GLB, versioned } from '../assetUrl.ts';
import { dyeTexture } from './dye.ts';
import { buildGear } from './gear.ts';

/** Beyond this camera distance (metres) characters draw their low-detail meshes. */
export const LOD_DISTANCE = 18;

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
  | 'idle_arms'
  | 'crouch_idle'
  | 'crouch_walk'
  | 'prone_idle'
  | 'prone_crawl';

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
  /** An NPC: a mannequin in a faction colour. */
  npc?: { color: string; scale: number; female?: boolean };
  /** Only the look's arms (the first-person view of your own character). */
  armsOnly?: boolean;
}

/**
 * Builds animated characters from the shared parts. A look is a set of outfit
 * parts (the first carries the skeleton), a head and hair, all re-skinned onto
 * that skeleton, with shared textures, colourways and tints applied;
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
      p = LoadAssetContainerAsync(versioned(`${CHARACTER_BASE}${file}`), this.scene, GLB);
      this.files.set(file, p);
    }
    return p;
  }

  /** Start fetching everything a spec needs (so first appearances don't hitch). */
  preload(spec: CharacterSpec): void {
    void this.load('rig.glb');
    if (spec.npc?.female) void this.load('mannequin_f.glb');
    if (spec.look) {
      const l = getLook(spec.look);
      for (const part of [...l.parts, l.head, ...l.hair]) void this.load(`${part}.glb`);
    }
  }

  async create(spec: CharacterSpec, name: string): Promise<CharacterInstance> {
    // A soldier NPC chosen as a player skin is drawn like that NPC (creatures go through the CreatureLibrary).
    const role = spec.armsOnly ? null : npcLookRole(spec.look);
    if (role && !NPC_ROLE_SPECS[role].creature) spec = { npc: { color: NPC_LOOK_COLORS[role] ?? '#d04a3a', scale: 1, female: role === 'sniper' } };
    const rig = await this.load('rig.glb');
    const holder = new TransformNode(name, this.scene);
    const meshes: AbstractMesh[] = [];
    /** Which file each mesh came from (0 = the carrier), for pairing low-detail copies. */
    const partOf = new Map<AbstractMesh, number>();
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
      meshes.push(...holder.getChildMeshes());
      if (spec.npc.female) {
        // Swap in the female mannequin, bound to the same skeleton.
        const female = await this.load('mannequin_f.glb');
        // Only the geometry goes (not __root__, which holds the skeleton's nodes).
        const male = meshes.filter((m) => m.getTotalVertices() > 0);
        const anchor = male[0]!.parent!;
        for (const m of male) m.dispose(true);
        meshes.splice(0, meshes.length, ...meshes.filter((m) => !male.includes(m)), ...this.attach(female, inst.skeletons[0]!, anchor, true));
      }
      for (const m of meshes) {
        const mat = m.material as PBRMaterial | null;
        if (mat && mat.name.startsWith('M_Main')) mat.albedoColor = Color3.FromHexString(spec.npc.color);
        else if (mat) mat.albedoColor = new Color3(0.12, 0.13, 0.15);
      }
      owned.push(...inst.skeletons);
      holder.scaling.setAll(spec.npc.scale);
      body = 'mannequin';
    } else {
      const look = getLook(spec.look);
      const files = spec.armsOnly ? [firstPersonArms(look)] : [...look.parts, look.head, ...look.hair];
      const [carrierC, ...rest] = await Promise.all(files.map((p) => this.load(`${p}.glb`)));
      // The first part carries the skeleton; every part shares it (all are bound to this body's pose).
      const carrier = carrierC!.instantiateModelsToScene((n) => n, true, { doNotInstantiate: true });
      for (const n of carrier.rootNodes) n.parent = holder;
      const skeleton = carrier.skeletons[0]!;
      joints = jointMap(carrier.rootNodes);
      const anchor = carrier.rootNodes[0]!;
      meshes.push(...holder.getChildMeshes());
      rest.forEach((part, i) => {
        const attached = this.attach(part, skeleton, anchor, true);
        for (const m of attached) partOf.set(m, i + 1);
        meshes.push(...attached);
      });
      this.dress(meshes, look);
      if (!spec.armsOnly && look.gear?.length) {
        const of = (i: number) => meshes.filter((m) => (partOf.get(m) ?? 0) === i);
        const headIndex = look.parts.length;
        const head = of(headIndex).filter((m) => !/_lod/.test(m.name));
        meshes.push(
          ...buildGear(this.scene, look, {
            root: holder,
            joints,
            head: head.filter((m) => !/Eye/.test(m.material?.name ?? '')),
            eyes: head.filter((m) => (m.material?.name ?? '') === 'MI_Eyes'),
            hair: meshes.filter((m) => (partOf.get(m) ?? 0) > headIndex && !/_lod/.test(m.name)),
            torso: of(0).filter((m) => !/_lod/.test(m.name)),
          }),
        );
      }
      owned.push(...carrier.skeletons);
      body = look.body;
      clips = this.retarget(rig, joints, `${name}_${look.body}`, look.body);
    }
    // Each mesh's low-detail copy (`<name>_lod`, in the same file) is drawn beyond LOD_DISTANCE.
    const low = meshes.filter((m) => /_lod(_primitive\d+)?$/.test(m.name));
    for (const m of low) {
      // Pair within the same part: different parts can share mesh names (the athlete top and the head do).
      const full = meshes.find((o) => o.name === m.name.replace(/_lod(_primitive\d+)?$/, '$1') && !low.includes(o) && (partOf.get(o) ?? 0) === (partOf.get(m) ?? 0)) as Mesh | undefined;
      if (!full || spec.armsOnly) {
        m.dispose();
        continue;
      }
      if (m.material && m.material !== full.material) m.material.dispose();
      m.material = full.material;
      full.addLODLevel(LOD_DISTANCE, m as Mesh);
    }
    meshes.splice(0, meshes.length, ...meshes.filter((m) => !m.isDisposed()));
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

  /** Instance a part's meshes onto an existing skeleton and return them. */
  private attach(part: AssetContainer, skeleton: Skeleton, anchor: Node, cloneMaterials: boolean): AbstractMesh[] {
    const inst = part.instantiateModelsToScene((n) => n, cloneMaterials, { doNotInstantiate: true });
    const out: AbstractMesh[] = [];
    for (const root of inst.rootNodes) {
      for (const m of root.getChildMeshes()) {
        if (m.skeleton) m.skeleton = skeleton;
        m.parent = anchor;
        out.push(m);
      }
    }
    for (const s of inst.skeletons) s.dispose();
    for (const n of inst.rootNodes) n.dispose(true);
    return out;
  }

  /** Shared textures, colourways and skin/hair tints for a look's (cloned) materials. */
  private dress(meshes: AbstractMesh[], look: CharacterLook): void {
    const done = new Set<PBRMaterial>();
    for (const m of meshes) {
      const mat = m.material as PBRMaterial | null;
      if (!mat || done.has(mat)) continue;
      done.add(mat);
      const tex = textureFor(mat.name, look);
      if (tex) {
        mat.albedoTexture = this.texture(tex);
        // Dyed outfits: the plain texture shows until the recoloured one is ready.
        const family = tex.split('_')[0]!;
        if ((look.cloth || look.trim) && (family === 'ranger' || family === 'peasant' || family === 'athlete')) {
          void this.dyed(tex, family, look.cloth ?? null, look.trim ?? null).then((t) => {
            if (t) mat.albedoTexture = t;
          });
        }
      }
      const tint = materialTint(mat.name);
      const color = tint === 'skin' ? look.skin : tint === 'hair' ? look.hairColor : null;
      if (color) mat.albedoColor = Color3.FromHexString(color);
    }
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

  private readonly dyes = new Map<string, Promise<Texture | null>>();

  /** A family texture recoloured with a look's dyes (shared by every character wearing the same dyes). */
  private dyed(tex: string, family: string, cloth: string | null, trim: string | null): Promise<Texture | null> {
    const key = `${tex}|${cloth}|${trim}`;
    let p = this.dyes.get(key);
    if (!p) {
      p = dyeTexture(versioned(`${CHARACTER_BASE}textures/${tex}.jpg`), family, cloth, trim).then(
        (url) => (url ? new Texture(url, this.scene, false, false) : null),
        () => null,
      );
      this.dyes.set(key, p);
    }
    return p;
  }

  private texture(id: string): Texture {
    let t = this.textures.get(id);
    if (!t) {
      // glTF textures are not flipped vertically.
      t = new Texture(versioned(`${CHARACTER_BASE}textures/${id}.jpg`), this.scene, false, false);
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
