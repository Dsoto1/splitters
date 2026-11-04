import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { HITBOX_MARGIN, MEASURED_HITBOXES, creatureSkinScale, lookHitbox, shapesFor, type HitShapes, type LookHitbox, type Stance } from '@tiletrigger/shared';
import type { AvatarSpec } from '../content/creatures.ts';
export { hitboxOverlayAllowed, loadHitboxOverlay, saveHitboxOverlay } from './hitboxPrefs.ts';

/**
 * The hit-shape overlay (a dev and test setting: Options → Display → Show hitboxes, or `?hitboxes=1`; the character
 * viewer's Hitboxes button): every body's measured shapes (shared sim/hitbox.ts) drawn over it, the head red, the
 * torso yellow, arms green and legs blue, exactly as the host tests shots against them.
 */
/** The shapes and scale a drawn body is hit with (the same choice the host makes: sim/hitbox.ts lookHitbox / npcHitbox). */
export function hitboxForSpec(spec: AvatarSpec): { box: LookHitbox; scale: number } {
  const fallback = MEASURED_HITBOXES['base:male']!;
  if (spec.creature) {
    const box = MEASURED_HITBOXES[`creature:${spec.creature}`] ?? fallback;
    return { box, scale: spec.armed ? creatureSkinScale(box) : (spec.size ?? 1) };
  }
  if (spec.npc) return { box: MEASURED_HITBOXES[spec.npc.zombie ? 'base:zombie' : spec.npc.female ? 'base:female' : 'base:male'] ?? fallback, scale: spec.npc.scale };
  const h = lookHitbox(spec.look);
  return { box: h.box, scale: h.scale * (spec.size ?? 1) };
}

const COLORS = { head: '#ff3b30', torso: '#ffd60a', arms: '#34c759', legs: '#2f8cff' } as const;
type Mats = Record<keyof typeof COLORS, StandardMaterial>;
const mats = new WeakMap<Scene, { core: Mats; pad: Mats }>();
/** The measured shapes solid-ish, their margin (what shots are tested against) a faint shell round them. */
function materials(scene: Scene): { core: Mats; pad: Mats } {
  let m = mats.get(scene);
  if (!m) {
    const make = (name: string, hex: string, alpha: number) => {
      const mat = new StandardMaterial(`hitbox_${name}`, scene);
      mat.diffuseColor = Color3.Black();
      mat.specularColor = Color3.Black();
      mat.emissiveColor = Color3.FromHexString(hex);
      mat.disableLighting = true;
      mat.alpha = alpha;
      mat.backFaceCulling = false;
      return mat;
    };
    const set = (tag: string, alpha: number): Mats => ({ head: make(`head${tag}`, COLORS.head, alpha), torso: make(`torso${tag}`, COLORS.torso, alpha), arms: make(`arms${tag}`, COLORS.arms, alpha), legs: make(`legs${tag}`, COLORS.legs, alpha) });
    m = { core: set('', 0.42), pad: set('_pad', 0.14) };
    mats.set(scene, m);
  }
  return m;
}

/**
 * One stance's shapes as meshes under a node in the body's frame (x right, y up, z forward; unscaled metres): the
 * measured shapes, and round them a faint shell with the margin (HITBOX_MARGIN) that shots are tested against.
 */
export function drawHitShapes(scene: Scene, s: HitShapes, name: string): TransformNode {
  const root = new TransformNode(name, scene);
  const all = materials(scene);
  drawLayer(scene, s, name, root, all.core, 0, 0);
  drawLayer(scene, s, `${name}_pad`, root, all.pad, HITBOX_MARGIN.body, HITBOX_MARGIN.head);
  return root;
}

function drawLayer(scene: Scene, s: HitShapes, name: string, root: TransformNode, m: Mats, pad: number, padHead: number): void {
  const capsule = (part: 'torso' | 'arms' | 'legs', a: Vector3, b: Vector3, r0: number, squash = 1) => {
    const r = r0 + pad;
    const len = Vector3.Distance(a, b);
    const mesh = CreateCapsule(`${name}_${part}`, { radius: r, height: len + 2 * r, tessellation: 14, subdivisions: 2, capSubdivisions: 6 }, scene);
    mesh.material = m[part];
    mesh.isPickable = false;
    mesh.parent = root;
    mesh.position.copyFrom(a.add(b).scale(0.5));
    const dir = len > 1e-6 ? b.subtract(a).normalize() : Vector3.Up();
    mesh.rotationQuaternion = new Quaternion();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), dir, mesh.rotationQuaternion);
    // The torso is squashed across the body: its axis lies in the up/forward plane, so local x stays the body's x.
    mesh.scaling.x = squash;
  };
  if (s.head) {
    const h = CreateSphere(`${name}_head`, { diameter: (s.head.r + padHead) * 2, segments: 12 }, scene);
    h.material = m.head;
    h.isPickable = false;
    h.parent = root;
    h.position.set(s.head.x, s.head.y, s.head.z);
  }
  if (s.torso) {
    const t = s.torso;
    capsule('torso', new Vector3(t.x, t.a[0], t.a[1]), new Vector3(t.x, t.b[0], t.b[1]), t.r, (t.w + pad) / (t.r + pad));
  }
  for (const l of s.legs) capsule('legs', Vector3.FromArray(l.a), Vector3.FromArray(l.b), l.r);
  for (const l of s.arms) capsule('arms', Vector3.FromArray(l.a), Vector3.FromArray(l.b), l.r);
}

/** The overlay on one body: rebuilt when its shapes or stance change, scaled with it. */
export class BodyHitbox {
  private node: TransformNode | null = null;
  private key = '';
  constructor(private readonly scene: Scene) {}

  /** Show `box` in `stance` at `scale` under `parent` (placed at the feet, turned to the body's yaw). */
  show(parent: TransformNode, box: LookHitbox, stance: Stance, scale: number): void {
    const s = shapesFor(box, stance);
    const key = `${keyOf(box)}|${stance}`;
    if (key !== this.key) {
      this.node?.dispose();
      this.node = drawHitShapes(this.scene, s, `hitbox_${parent.name}`);
      this.key = key;
    }
    const n = this.node!;
    if (n.parent !== parent) n.parent = parent;
    n.setEnabled(true);
    n.scaling.setAll(scale);
  }

  hide(): void {
    this.node?.setEnabled(false);
  }

  dispose(): void {
    this.node?.dispose();
    this.node = null;
    this.key = '';
  }
}

const keys = new WeakMap<LookHitbox, string>();
let nextKey = 0;
function keyOf(box: LookHitbox): string {
  let k = keys.get(box);
  if (!k) keys.set(box, (k = String(nextKey++)));
  return k;
}
