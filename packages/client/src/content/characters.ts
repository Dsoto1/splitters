import type { Scene } from '@babylonjs/core/scene';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
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
import './gltf.ts';
import { NPC_LOOK_COLORS, NPC_ROLE_SPECS, PLAYER, firstPersonArms, getLook, npcLookRole, materialTint, textureFor, type BodyType, type CharacterLook } from '@tiletrigger/shared';
import { GLB, versioned } from '../assetUrl.ts';
import { dyeTexture } from './dye.ts';
import { mergeSkinnedParts, skinGear } from './mergeParts.ts';
import { buildGear } from './gear.ts';
import { CharacterAtlas } from './characterAtlas.ts';
import { asNode } from './models.ts';

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
  | 'prone_crawl'
  | 'zombie_idle'
  | 'zombie_walk'
  | 'zombie_attack';

export interface CharacterInstance {
  /** Place and turn this node; the model stands on its origin facing +Z. */
  root: TransformNode;
  /** Skeleton joints by name (driven by the animation groups). */
  joints: Map<string, TransformNode>;
  clips: Map<Clip, AnimationGroup>;
  meshes: AbstractMesh[];
  body: BodyType | 'mannequin';
  /** Each hand as measured from its model at import (Meshy characters; tools/content/hands.mjs), when the file has it. */
  hands: { l?: HandData; r?: HandData };
  dispose(): void;
}

/**
 * A hand measured from its mesh (tools/content/hands.mjs, `extras.hand` on the
 * hand joints of a Meshy character's file), in the hand joint's own space,
 * model metres: where the palm's centre is, which way the fingers run, how
 * long (wrist joint to fingertips), wide and thick the hand is, and how far
 * its fingers close round a grip (0: a closed or rigid hand).
 */
export interface HandData {
  palm: [number, number, number];
  dir: [number, number, number];
  length: number;
  width: number;
  thickness: number;
  curl: number;
  fingers: 'split' | 'mitten' | 'none';
}

export interface CharacterSpec {
  /** A player look (CORE_LOOKS ID). */
  look?: string;
  /** An NPC: a mannequin in a faction colour. */
  npc?: { color: string; scale: number; female?: boolean; /** A zombie: grey-green skin, rags, and the shambling clips in place of the soldier's. */ zombie?: boolean };
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
/**
 * What a library hands back when its scene is disposed mid-load: a promise that
 * never settles, so callers' follow-ups (which would build into a dead scene)
 * simply never run.
 */
export const gone = <T>(): Promise<T> => new Promise<T>(() => {});

export class CharacterLibrary {
  private readonly files = new Map<string, Promise<AssetContainer>>();
  private readonly textures = new Map<string, Texture>();
  /** Hip offsets between the rig's rest pose and each body's, per clip. */
  private readonly hipAnims = new Map<string, Animation>();

  /** Skin, hair and eyes on one shared texture (see CharacterAtlas), when the owner asks for it (the game). */
  private readonly atlas: CharacterAtlas | null;
  /**
   * Waits for a character's turn to be built, once its files are in (the game: one a frame). Building
   * one takes a good part of a frame, and a dozen bots joining at once built a dozen in one frame.
   */
  turn: (() => Promise<void>) | null = null;

  constructor(
    private readonly scene: Scene,
    opts: { atlas?: boolean } = {},
  ) {
    this.atlas = opts.atlas ? new CharacterAtlas(scene) : null;
    if (this.atlas) scene.onDisposeObservable.addOnce(() => this.atlas?.dispose());
  }

  private load(file: string): Promise<AssetContainer> {
    let p = this.files.get(file);
    if (!p) {
      p = LoadAssetContainerAsync(versioned(`${CHARACTER_BASE}${file}`), this.scene, GLB);
      this.files.set(file, p);
    }
    return p;
  }

  /** Start fetching everything a spec needs (so first appearances don't hitch). */
  /** Start loading what a character needs; resolves when it has all arrived (failures included). */
  preload(spec: CharacterSpec): Promise<unknown> {
    const files = ['rig.glb'];
    if (spec.npc?.female) files.push('mannequin_f.glb');
    if (spec.look && !npcLookRole(spec.look)) {
      const l = getLook(spec.look);
      files.push(...(l.whole ? l.parts : [...l.parts, l.head, ...l.hair]).map((p) => `${p}.glb`));
      files.push(`${firstPersonArms(l)}.glb`);
    }
    return Promise.allSettled(files.map((f) => this.load(f)));
  }

  async create(spec: CharacterSpec, name: string): Promise<CharacterInstance> {
    // A soldier NPC chosen as a player skin is drawn like that NPC (creatures go through the CreatureLibrary).
    const role = spec.armsOnly ? null : npcLookRole(spec.look);
    if (role && !NPC_ROLE_SPECS[role].creature) spec = { npc: { color: NPC_LOOK_COLORS[role] ?? '#d04a3a', scale: 1, female: role === 'sniper' } };
    // Your own first-person arms don't wait: the view sets them up in order with the gun.
    if (this.turn && !spec.armsOnly) {
      // Everything in first, so the build below runs in one go on its turn.
      await this.preload(spec);
      await this.turn();
    }
    const rig = await this.load('rig.glb');
    // The scene went while the files loaded (left a match, closed a preview): build nothing into it.
    if (this.scene.isDisposed) return gone();
    const holder = new TransformNode(name, this.scene);
    const meshes: AbstractMesh[] = [];
    /** Which file each mesh came from (0 = the carrier), for pairing low-detail copies. */
    const partOf = new Map<AbstractMesh, number>();
    const owned: { dispose(): void }[] = [];
    let joints: Map<string, TransformNode>;
    let clips: Map<Clip, AnimationGroup>;
    let body: CharacterInstance['body'];
    let hands: CharacterInstance['hands'] = {};

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
        if (this.scene.isDisposed) return gone();
        // Only the geometry goes (not __root__, which holds the skeleton's nodes).
        const male = meshes.filter((m) => m.getTotalVertices() > 0);
        const anchor = male[0]!.parent!;
        for (const m of male) m.dispose(true);
        meshes.splice(0, meshes.length, ...meshes.filter((m) => !male.includes(m)), ...this.attach(female, inst.skeletons[0]!, anchor, true));
      }
      for (const m of meshes) {
        const mat = m.material as PBRMaterial | null;
        if (mat && mat.name.startsWith('M_Main')) mat.albedoColor = Color3.FromHexString(spec.npc.zombie ? '#56664a' : spec.npc.color);
        else if (mat) mat.albedoColor = spec.npc.zombie ? new Color3(0.2, 0.17, 0.14) : new Color3(0.12, 0.13, 0.15);
      }
      if (spec.npc.zombie) {
        // Stand, walk and strike like a zombie: the animator asks for the usual clips and gets these.
        const z = (name: Clip) => clips.get(name);
        for (const [as, from] of [
          ['idle', 'zombie_idle'],
          ['aim_idle', 'zombie_idle'],
          ['walk', 'zombie_walk'],
          ['run', 'zombie_walk'],
          ['sprint', 'zombie_walk'],
          ['melee', 'zombie_attack'],
          ['melee_heavy', 'zombie_attack'],
        ] as const) {
          const g = z(from);
          if (!g) continue;
          const own = clips.get(as);
          if (own && own !== g && own !== z('zombie_idle') && own !== z('zombie_walk') && own !== z('zombie_attack')) own.dispose();
          clips.set(as, g);
        }
      }
      owned.push(...inst.skeletons);
      holder.scaling.setAll(spec.npc.scale);
      body = 'mannequin';
    } else {
      const look = getLook(spec.look);
      const files = spec.armsOnly ? [firstPersonArms(look)] : look.whole ? look.parts : [...look.parts, look.head, ...look.hair];
      const [carrierC, ...rest] = await Promise.all(files.map((p) => this.load(`${p}.glb`)));
      if (this.scene.isDisposed) {
        holder.dispose();
        return gone();
      }
      // The first part carries the skeleton; every part shares it (all are bound to this body's pose).
      const carrier = carrierC!.instantiateModelsToScene((n) => n, true, { doNotInstantiate: true });
      hands = handsOf(carrierC!);
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
      // A whole-body character's first-person arms are its own (nothing to dye) or the universal ones, dyed to match it.
      this.dress(meshes, spec.armsOnly && look.whole ? { ...look, skin: look.whole.skin ?? null, cloth: look.whole.cloth ?? null, trim: look.whole.trim ?? null } : look);
      if (!spec.armsOnly && !look.whole && look.gear?.length) {
        const of = (i: number) => meshes.filter((m) => (partOf.get(m) ?? 0) === i);
        const headIndex = look.parts.length;
        const head = of(headIndex).filter((m) => !/_lod/.test(m.name));
        const gear = buildGear(this.scene, look, {
          root: holder,
          joints,
          head: head.filter((m) => !/Eye/.test(m.material?.name ?? '')),
          eyes: head.filter((m) => (m.material?.name ?? '') === 'MI_Eyes'),
          hair: meshes.filter((m) => (partOf.get(m) ?? 0) > headIndex && !/_lod/.test(m.name)),
          torso: of(0).filter((m) => !/_lod/.test(m.name)),
        });
        // Skinned onto the body's skeleton and merged per finish: one or two draws however many pieces.
        // Bound in the head's place (it is skinned on the same skeleton): with the character atlas, gear then merges with the head and hair.
        const skinned = (m: AbstractMesh): m is Mesh => !!m.skeleton && !/_lod/.test(m.name) && m.getTotalVertices() > 0;
        const skin = of(headIndex).find(skinned) ?? of(0).find(skinned);
        meshes.push(...(skin ? skinGear(gear, skin, `${name}_gear`) : gear));
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
    // Skin, hair and eyes onto the shared atlas: with their tints in the vertices they merge into one draw below.
    if (!spec.armsOnly && this.atlas) {
      // Only the shared skin and hair textures and the eyes: outfits (athlete bodies are tinted like skin) are dyed per look.
      const shared = new Set([...this.textures].filter(([id]) => /^(skin|hair)_/.test(id)).map(([, t]) => t));
      const mat = await this.atlas.apply(meshes, name, (m) => m.name === 'MI_Eyes' || (!!m.albedoTexture && shared.has(m.albedoTexture as Texture)));
      if (this.scene.isDisposed) return gone();
      if (mat) owned.push(mat);
    }
    // One draw per material instead of one per part (a look is 8–12 skinned parts, most sharing the outfit's or the skin's material).
    if (!spec.armsOnly) meshes.splice(0, meshes.length, ...mergeSkinnedParts(meshes, `${name}_body`));
    // The import's empty __root__ mesh (holding the skeleton's nodes and the parts): a plain node, one mesh fewer for the scene to check every frame.
    for (const n of holder.getChildren()) if (n instanceof Mesh && !n.isAnInstance && !n.getTotalVertices() && !n.skeleton) asNode(n);
    meshes.splice(0, meshes.length, ...meshes.filter((m) => !m.isDisposed()));
    for (const m of meshes) {
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true;
      // Eyes sit inside the head: their shadow would land on the inside of the skull.
      if (m.material?.name === 'MI_Eyes') m.metadata = { ...(m.metadata as object | null), castsNoShadow: true };
    }
    return {
      root: holder,
      joints,
      clips,
      meshes,
      body,
      hands,
      dispose: () => {
        for (const g of new Set(clips.values())) g.dispose();
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
    // Hips far lower or higher than the rig's (a short-legged cat): the hip track is scaled by the hip height
    // instead of shifted, so lying down (death) and crouching put the hips on the ground, not under it.
    const ratio = rigPelvis && pelvis ? pelvis.position.length() / Math.max(1e-6, rigPelvis.position.length()) : 1;
    const scale = Math.abs(ratio - 1) > 0.1 ? ratio : 1;
    if (scale !== 1) offset.copyFrom(pelvis!.position.subtract(rigPelvis!.position.scale(scale)));
    const out = new Map<Clip, AnimationGroup>();
    for (const src of rig.animationGroups) {
      const g = new AnimationGroup(`${name}_${src.name}`, this.scene);
      for (const ta of src.targetedAnimations) {
        const target = joints.get((ta.target as TransformNode).name);
        if (!target) continue;
        let anim = ta.animation;
        if (target.name === 'pelvis' && anim.targetProperty === 'position') anim = this.hipAnim(anim, body, offset, src.name, scale);
        g.addTargetedAnimation(anim, target);
      }
      g.normalize(src.from, src.to);
      out.set(src.name as Clip, g);
    }
    return out;
  }

  private hipAnim(anim: Animation, body: BodyType, offset: Vector3, clip: string, scale = 1): Animation {
    // Keyed by the hip offset too: whole-body characters share a body type but not a hip height.
    const key = `${body}:${clip}:${offset.x.toFixed(3)},${offset.y.toFixed(3)},${offset.z.toFixed(3)}:${scale.toFixed(3)}`;
    let a = this.hipAnims.get(key);
    if (!a) {
      a = anim.clone();
      a.setKeys(anim.getKeys().map((k) => ({ ...k, value: (k.value as Vector3).scale(scale).add(offset) })));
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

/** The measured hands a character file carries on its hand joints (glTF extras, read as metadata). */
function handsOf(container: AssetContainer): CharacterInstance['hands'] {
  const out: CharacterInstance['hands'] = {};
  for (const side of ['l', 'r'] as const) {
    const node = container.transformNodes.find((n) => n.name === `hand_${side}`);
    const hand = (node?.metadata as { gltf?: { extras?: { hand?: HandData } } } | null)?.gltf?.extras?.hand;
    if (hand && Array.isArray(hand.palm) && hand.palm.length === 3) out[side] = hand;
  }
  return out;
}

function jointMap(roots: readonly { getDescendants(directOnly?: boolean): unknown[] }[]): Map<string, TransformNode> {
  const map = new Map<string, TransformNode>();
  for (const r of roots) {
    for (const n of r.getDescendants(false)) if (n instanceof TransformNode && !(n as AbstractMesh).getTotalVertices) map.set(n.name, n);
  }
  return map;
}
