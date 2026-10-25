import type { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { gearInfo, type CharacterLook } from '@tiletrigger/shared';

/**
 * Gear (hats, glasses, vests, packs) built from simple shapes and hung on the
 * skeleton, so it moves with the character. Sizes come from the character's
 * own head and torso in the bind pose; colours from the look's dyes. Nothing
 * here is a model file: it is part of our own toolkit, like the building kit.
 */

/** Default colours when a look has no dye: the outfit family's own greens and browns. */
const DEFAULT_CLOTH = '#3e5230';
const DEFAULT_TRIM = '#5a3f2a';

interface Box {
  min: Vector3;
  max: Vector3;
}

const materials = new WeakMap<Scene, Map<string, PBRMaterial>>();
function material(scene: Scene, hex: string, finish: 'cloth' | 'hard' | 'glass' | 'metal' = 'cloth'): PBRMaterial {
  let cache = materials.get(scene);
  if (!cache) materials.set(scene, (cache = new Map()));
  const key = `${hex}|${finish}`;
  let m = cache.get(key);
  if (!m) {
    m = new PBRMaterial(`gear_${key}`, scene);
    m.albedoColor = Color3.FromHexString(hex).toLinearSpace();
    m.metallic = finish === 'metal' ? 0.7 : finish === 'glass' ? 0.2 : 0;
    m.roughness = finish === 'cloth' ? 0.9 : finish === 'hard' ? 0.55 : finish === 'glass' ? 0.12 : 0.35;
    cache.set(key, m);
  }
  return m;
}

/** Darken or lighten a #rrggbb colour by a factor. */
function shade(hex: string, k: number): string {
  const c = Color3.FromHexString(hex);
  const f = (v: number) => Math.max(0, Math.min(1, k >= 1 ? v + (1 - v) * (k - 1) : v * k));
  return new Color3(f(c.r), f(c.g), f(c.b)).toHexString();
}

/** The union of some meshes' bind-pose bounds, in `space`'s local coordinates. */
function bounds(meshes: AbstractMesh[], space: TransformNode): Box | null {
  const inv = Matrix.Invert(space.computeWorldMatrix(true));
  let out: Box | null = null;
  for (const m of meshes) {
    m.computeWorldMatrix(true);
    for (const v of m.getBoundingInfo().boundingBox.vectorsWorld) {
      const p = Vector3.TransformCoordinates(v, inv);
      if (!out) out = { min: p.clone(), max: p.clone() };
      else {
        out.min.minimizeInPlace(p);
        out.max.maximizeInPlace(p);
      }
    }
  }
  return out;
}

/** The extents of some meshes' bind-pose vertices within `band` of height `y` (character space). */
function slice(meshes: AbstractMesh[], space: TransformNode, y: number, band: number): Box | null {
  const inv = Matrix.Invert(space.computeWorldMatrix(true));
  let out: Box | null = null;
  const p = new Vector3();
  for (const m of meshes) {
    const pos = m.getVerticesData('position');
    if (!pos) continue;
    const toSpace = m.computeWorldMatrix(true).multiply(inv);
    for (let i = 0; i < pos.length; i += 3) {
      Vector3.TransformCoordinatesFromFloatsToRef(pos[i]!, pos[i + 1]!, pos[i + 2]!, toSpace, p);
      if (Math.abs(p.y - y) > band) continue;
      if (!out) out = { min: p.clone(), max: p.clone() };
      else {
        out.min.minimizeInPlace(p);
        out.max.maximizeInPlace(p);
      }
    }
  }
  return out;
}

export interface GearTargets {
  root: TransformNode;
  joints: Map<string, TransformNode>;
  /** The head (with eyes), the hair, and the torso part's meshes. */
  head: AbstractMesh[];
  eyes: AbstractMesh[];
  hair: AbstractMesh[];
  torso: AbstractMesh[];
}

/** Build a look's gear onto a character; returns the meshes (already parented to joints). */
export function buildGear(scene: Scene, look: CharacterLook, t: GearTargets): Mesh[] {
  const gear = look.gear ?? [];
  if (!gear.length) return [];
  const headBox = bounds(t.head, t.root);
  const headJoint = t.joints.get('Head');
  const chestJoint = t.joints.get('spine_03');
  if (!headBox || !headJoint || !chestJoint) return [];
  const eyeBox = bounds(t.eyes, t.root);
  const hairBox = bounds(t.hair, t.root);
  const torsoBox = bounds(t.torso, t.root);
  const cloth = look.cloth ?? DEFAULT_CLOTH;
  const trim = look.trim ?? DEFAULT_TRIM;

  // Head measurements (character space: +Y up, +Z forward).
  const hx = (headBox.max.x - headBox.min.x) / 2;
  const cx = (headBox.max.x + headBox.min.x) / 2;
  const top = Math.max(headBox.max.y, hairBox ? Math.min(hairBox.max.y, headBox.max.y + 0.04) : 0);
  const eyeY = eyeBox ? (eyeBox.min.y + eyeBox.max.y) / 2 : headBox.min.y + (headBox.max.y - headBox.min.y) * 0.6;
  const front = eyeBox ? eyeBox.max.z : headBox.max.z;
  const cz = (headBox.max.z + headBox.min.z) / 2;
  const r = hx * 1.12; // a skull's radius, a little over the head mesh (hair sits under hats)
  const crownY = top - r * 0.82;

  const made: Mesh[] = [];
  const add = (m: Mesh, parent: TransformNode, mat: PBRMaterial) => {
    m.material = mat;
    m.parent = t.root;
    m.isPickable = false;
    m.computeWorldMatrix(true);
    m.setParent(parent);
    made.push(m);
    return m;
  };
  /** A group built around a pivot: hang the pivot (and its children) on a joint. */
  const attachNode = (pivot: TransformNode, parent: TransformNode) => {
    pivot.parent = t.root;
    pivot.computeWorldMatrix(true);
    pivot.setParent(parent);
    for (const m of pivot.getChildMeshes() as Mesh[]) {
      m.isPickable = false;
      made.push(m);
    }
  };
  const head = (m: Mesh, mat: PBRMaterial) => add(m, headJoint, mat);
  const chest = (m: Mesh, mat: PBRMaterial) => add(m, chestJoint, mat);
  const dome = (name: string, radius: number, sy: number) => {
    const m = CreateSphere(name, { diameter: radius * 2, segments: 12, slice: 0.5 }, scene);
    m.scaling.set(1, sy, 1.08);
    m.position.set(cx, crownY, cz);
    return m;
  };

  for (const id of gear) {
    switch (gearInfo(id)?.id) {
      case 'cap': {
        head(dome('cap', r * 1.02, 0.78), material(scene, cloth));
        const brim = CreateCylinder('capBrim', { diameter: r * 1.7, height: 0.012, tessellation: 20 }, scene);
        brim.scaling.z = 0.75;
        brim.position.set(cx, crownY + 0.005, cz + r * 0.85);
        brim.rotation.x = 0.12;
        head(brim, material(scene, shade(cloth, 0.75)));
        break;
      }
      case 'beanie': {
        head(dome('beanie', r * 1.03, 1.05), material(scene, cloth));
        const cuff = CreateTorus('beanieCuff', { diameter: r * 2.02, thickness: 0.035, tessellation: 24 }, scene);
        cuff.scaling.z = 1.08;
        cuff.position.set(cx, crownY + 0.008, cz);
        head(cuff, material(scene, shade(cloth, 0.8)));
        break;
      }
      case 'helmet': {
        const steel = material(scene, shade(cloth, 0.7), 'hard');
        const shell = dome('helmet', r * 1.18, 0.86);
        shell.position.y = crownY - 0.012;
        head(shell, steel);
        const rim = CreateTorus('helmetRim', { diameter: r * 2.36, thickness: 0.024, tessellation: 28 }, scene);
        rim.scaling.z = 1.08;
        rim.position.set(cx, crownY - 0.012, cz);
        head(rim, steel);
        const strap = CreateTorus('helmetStrap', { diameter: r * 1.95, thickness: 0.01, tessellation: 20 }, scene);
        strap.rotation.z = Math.PI / 2;
        strap.scaling.set(1, 1.25, 1);
        strap.position.set(cx, eyeY - 0.03, cz + 0.005);
        head(strap, material(scene, '#2a2622'));
        break;
      }
      case 'beret': {
        const b = CreateSphere('beret', { diameter: r * 2.25, segments: 12 }, scene);
        b.scaling.set(1, 0.32, 1.02);
        b.position.set(cx - r * 0.12, top - 0.005, cz - 0.01);
        b.rotation.z = 0.22;
        head(b, material(scene, cloth));
        const band = CreateTorus('beretBand', { diameter: r * 2.04, thickness: 0.018, tessellation: 24 }, scene);
        band.scaling.z = 1.08;
        band.position.set(cx, top - r * 0.42, cz);
        band.rotation.z = 0.12;
        head(band, material(scene, shade(trim, 0.8)));
        break;
      }
      case 'brim': {
        const hat = material(scene, trim);
        const crown = CreateCylinder('brimCrown', { diameterTop: r * 1.55, diameterBottom: r * 2.15, height: r * 0.95, tessellation: 20 }, scene);
        crown.scaling.z = 1.1;
        crown.position.set(cx, crownY + r * 0.42, cz);
        head(crown, hat);
        const disc = CreateCylinder('brimDisc', { diameter: r * 3.6, height: 0.014, tessellation: 28 }, scene);
        disc.position.set(cx, crownY - 0.005, cz);
        head(disc, hat);
        const band = CreateCylinder('brimBand', { diameter: r * 2.14, height: 0.03, tessellation: 20 }, scene);
        band.scaling.z = 1.1;
        band.position.set(cx, crownY + 0.02, cz);
        head(band, material(scene, shade(cloth, 0.6)));
        break;
      }
      case 'headband': {
        const bandY = (eyeY + top) / 2 - 0.005;
        const band = CreateTorus('headband', { diameter: r * 1.86, thickness: 0.03, tessellation: 24 }, scene);
        band.scaling.set(1, 1, 1.12);
        band.position.set(cx, bandY, cz + 0.004);
        head(band, material(scene, cloth));
        const tail = CreateBox('headbandTail', { width: 0.025, height: 0.008, depth: 0.12 }, scene);
        tail.position.set(cx + 0.02, bandY - 0.04, headBox.min.z - 0.04);
        tail.rotation.x = -0.9;
        head(tail, material(scene, cloth));
        break;
      }
      case 'shades':
      case 'goggles': {
        const goggles = id === 'goggles';
        const lens = material(scene, goggles ? '#c8a050' : '#14161a', 'glass');
        const frame = material(scene, goggles ? '#2a2a2a' : '#0e0f12', 'hard');
        const spread = eyeBox ? (eyeBox.max.x - eyeBox.min.x) / 2 - 0.012 : hx * 0.45;
        for (const side of [-1, 1]) {
          const l = CreateCylinder(`lens${side}`, { diameter: goggles ? 0.046 : 0.04, height: 0.012, tessellation: 16 }, scene);
          l.rotation.x = Math.PI / 2;
          l.scaling.set(1, 1, goggles ? 0.85 : 0.7);
          l.position.set(cx + side * spread, eyeY + 0.004, front + 0.012);
          head(l, lens);
        }
        const bridge = CreateBox('bridge', { width: spread * 0.9, height: 0.008, depth: 0.008 }, scene);
        bridge.position.set(cx, eyeY + 0.01, front + 0.014);
        head(bridge, frame);
        // Strap (goggles) or arms (shades) round to the ears.
        const strap = CreateTorus('strap', { diameter: hx * 2.05, thickness: goggles ? 0.018 : 0.006, tessellation: 24 }, scene);
        strap.scaling.z = goggles ? 1.18 : 1.12;
        strap.position.set(cx, eyeY + 0.006, cz + 0.006);
        head(strap, goggles ? material(scene, '#3a3028') : frame);
        break;
      }
      case 'mask': {
        const m = CreateSphere('mask', { diameter: hx * 2.12, segments: 12, slice: 0.5 }, scene);
        m.rotation.x = Math.PI; // the lower half: chin and mouth
        m.scaling.set(1, 0.7, 1.12);
        m.position.set(cx, eyeY - 0.025, cz + 0.008);
        head(m, material(scene, cloth));
        const knot = CreateSphere('maskKnot', { diameter: 0.035, segments: 6 }, scene);
        knot.position.set(cx, eyeY - 0.03, headBox.min.z + 0.01);
        head(knot, material(scene, cloth));
        break;
      }
      case 'vest':
      case 'bandolier':
      case 'scarf':
      case 'pack':
      case 'radio':
      case 'tank': {
        if (!torsoBox) break;
        // The torso's real cross-section at chest height (bind pose), so gear sits on the body.
        const rootY = t.root.getAbsolutePosition().y;
        const chestY = chestJoint.getAbsolutePosition().y - rootY + 0.06;
        const sec = slice(t.torso, t.root, chestY, 0.03) ?? torsoBox;
        const waist = slice(t.torso, t.root, chestY - 0.2, 0.03) ?? sec;
        // Loose sleeves can widen the slice: no chest is wider than this.
        const w = Math.min((sec.max.x - sec.min.x) / 2, (waist.max.x - waist.min.x) / 2 + 0.02, 0.19);
        const zF = sec.max.z;
        const zB = sec.min.z;
        const zc = (zF + zB) / 2;
        const depth = zF - zB;
        const xc = (sec.max.x + sec.min.x) / 2;
        if (id === 'vest') {
          // A rounded carrier hugging the chest, a front plate and a row of pouches.
          const vest = material(scene, shade(cloth, 0.8), 'hard');
          const h = 0.3;
          const body = CreateCylinder('vest', { diameter: 1, height: h, tessellation: 14 }, scene);
          body.scaling.set(w * 2 * 1.08, 1, depth * 1.12);
          body.position.set(xc, chestY - 0.05, zc);
          chest(body, vest);
          const plate = CreateBox('vestPlate', { width: w * 1.15, height: h * 0.72, depth: 0.025 }, scene);
          plate.position.set(xc, chestY - 0.03, zF + depth * 0.06 + 0.008);
          chest(plate, material(scene, shade(cloth, 0.6), 'hard'));
          for (const x of [-1, 0, 1]) {
            const pouch = CreateBox('pouch', { width: w * 0.36, height: 0.075, depth: 0.035 }, scene);
            pouch.position.set(xc + x * w * 0.4, chestY - 0.15, zF + depth * 0.06 + 0.02);
            chest(pouch, material(scene, trim));
          }
        } else if (id === 'bandolier') {
          // A sash round the torso from the left shoulder to the right hip, shells along its front.
          const tilt = 0.62;
          const rx = (w * 1.16) / Math.cos(tilt);
          const rz = (depth / 2) * 1.22;
          const pivot = new TransformNode('bandolier', scene);
          pivot.position.set(xc, chestY - 0.08, zc);
          pivot.rotation.z = tilt;
          const belt = CreateTorus('bandolierBelt', { diameter: 2, thickness: 0.03, tessellation: 32 }, scene);
          belt.scaling.set(rx, 1, rz);
          belt.parent = pivot;
          belt.material = material(scene, trim);
          for (let i = 0; i < 7; i++) {
            const a = Math.PI / 2 + (i - 3) * 0.16;
            const shell = CreateCylinder('shell', { diameter: 0.016, height: 0.042, tessellation: 6 }, scene);
            shell.position.set(Math.cos(a) * rx, 0, Math.sin(a) * rz + 0.012);
            shell.parent = pivot;
            shell.material = material(scene, '#b08a3a', 'metal');
          }
          attachNode(pivot, chestJoint);
        } else if (id === 'scarf') {
          const neck = slice(t.head, t.root, headBox.min.y + 0.03, 0.03) ?? headBox;
          const nw = (neck.max.x - neck.min.x) / 2;
          const nd = (neck.max.z - neck.min.z) / 2;
          const neckY = headBox.min.y + 0.02;
          const wrap = CreateTorus('scarf', { diameter: 2, thickness: 0.07, tessellation: 20 }, scene);
          wrap.scaling.set(nw + 0.045, 1, nd + 0.045);
          wrap.position.set((neck.max.x + neck.min.x) / 2, neckY, (neck.max.z + neck.min.z) / 2);
          chest(wrap, material(scene, cloth));
          const tail = CreateBox('scarfTail', { width: 0.075, height: 0.24, depth: 0.022 }, scene);
          tail.position.set(xc + w * 0.35, neckY - 0.15, zF + 0.012);
          tail.rotation.set(-0.12, 0, 0.08);
          chest(tail, material(scene, cloth));
        } else {
          // Back gear sits against the back at shoulder-blade height.
          const back = Math.min(zB, waist.min.z);
          if (id === 'pack') {
            const bag = CreateCapsule('pack', { radius: 0.075, height: 0.34, tessellation: 12, subdivisions: 1 }, scene);
            bag.scaling.set(1.55, 1, 0.9);
            bag.position.set(xc, chestY - 0.1, back - 0.06);
            chest(bag, material(scene, cloth));
            const flap = CreateBox('packFlap', { width: 0.2, height: 0.12, depth: 0.025 }, scene);
            flap.position.set(xc, chestY - 0.02, back - 0.125);
            chest(flap, material(scene, trim));
            const roll = CreateCylinder('packRoll', { diameter: 0.075, height: 0.28, tessellation: 12 }, scene);
            roll.rotation.z = Math.PI / 2;
            roll.position.set(xc, chestY + 0.1, back - 0.055);
            chest(roll, material(scene, shade(cloth, 1.35)));
            for (const x of [-1, 1]) {
              const strap = CreateBox('packStrap', { width: 0.035, height: 0.3, depth: 0.012 }, scene);
              strap.position.set(xc + x * w * 0.5, chestY - 0.04, zF + 0.006);
              chest(strap, material(scene, trim));
            }
          } else if (id === 'radio') {
            const box = CreateBox('radio', { width: 0.22, height: 0.28, depth: 0.1 }, scene);
            box.position.set(xc, chestY - 0.08, back - 0.05);
            chest(box, material(scene, shade(cloth, 0.7), 'hard'));
            const dial = CreateCylinder('radioDial', { diameter: 0.04, height: 0.02, tessellation: 10 }, scene);
            dial.position.set(xc - 0.06, chestY + 0.065, back - 0.05);
            chest(dial, material(scene, '#1a1a1a', 'hard'));
            const aerial = CreateCylinder('radioAerial', { diameter: 0.008, height: 0.46, tessellation: 6 }, scene);
            aerial.position.set(xc + 0.07, chestY + 0.28, back - 0.045);
            aerial.rotation.z = -0.08;
            chest(aerial, material(scene, '#202020', 'metal'));
            for (const x of [-1, 1]) {
              const strap = CreateBox('radioStrap', { width: 0.035, height: 0.3, depth: 0.012 }, scene);
              strap.position.set(xc + x * w * 0.5, chestY - 0.04, zF + 0.006);
              chest(strap, material(scene, '#2a2622'));
            }
          } else {
            const steel = material(scene, shade(trim, 1.25), 'metal');
            for (const x of [-1, 1]) {
              const tank = CreateCapsule('tank', { radius: 0.05, height: 0.4, tessellation: 12, subdivisions: 1 }, scene);
              tank.position.set(xc + x * 0.058, chestY - 0.08, back - 0.05);
              chest(tank, steel);
            }
            const band = CreateBox('tankBand', { width: 0.24, height: 0.03, depth: 0.11 }, scene);
            band.position.set(xc, chestY - 0.02, back - 0.05);
            chest(band, material(scene, '#2a2622'));
          }
        }
        break;
      }
    }
  }
  return made;
}
