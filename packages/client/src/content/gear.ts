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
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { gearInfo, type CharacterLook } from '@tiletrigger/shared';

/**
 * Gear (hats, glasses, vests, packs) built from simple shapes and hung on the
 * skeleton, so it moves with the character. Sizes come from the character's
 * own head and torso in the bind pose; colours from the look's dyes. Shaped
 * gear is part of our own toolkit, like the building kit. Gear with a `model`
 * (the helmets) is a textured model from public/gear (tools/content/prepare-gear.mjs),
 * made in skull radii about the crown line: scaled by the wearer's skull and
 * hung on the Head joint.
 */

/** Where the gear models are (packages/client/public/gear). */
export const GEAR_MODEL_BASE = `${import.meta.env.BASE_URL}gear/`;

/** The model files a look's gear needs (without .glb). */
export const gearModels = (look: Pick<CharacterLook, 'gear' | 'whole'>): string[] =>
  look.whole ? [] : (look.gear ?? []).flatMap((id) => (gearInfo(id)?.model ? [gearInfo(id)!.model!] : []));

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

/** Directions round a head contour (see contour). */
const AROUND = 48;

/**
 * The outline of some meshes' bind-pose vertices within `band` of height `y` (character space): for each of AROUND
 * directions round (cx, cz) (0 = +Z, the face; then towards +X), how far out the surface is. Directions with no
 * vertex take their neighbours'; the result is smoothed a little so a band laid on it doesn't follow every bump.
 */
function contour(meshes: AbstractMesh[], space: TransformNode, y: number, band: number, cx: number, cz: number): Float32Array | null {
  const inv = Matrix.Invert(space.computeWorldMatrix(true));
  const out = new Float32Array(AROUND);
  const p = new Vector3();
  let any = false;
  for (const m of meshes) {
    const pos = m.getVerticesData('position');
    if (!pos) continue;
    const toSpace = m.computeWorldMatrix(true).multiply(inv);
    for (let i = 0; i < pos.length; i += 3) {
      Vector3.TransformCoordinatesFromFloatsToRef(pos[i]!, pos[i + 1]!, pos[i + 2]!, toSpace, p);
      if (Math.abs(p.y - y) > band) continue;
      const dx = p.x - cx;
      const dz = p.z - cz;
      const k = Math.round(((Math.atan2(dx, dz) / (Math.PI * 2) + 1) % 1) * AROUND) % AROUND;
      const d = Math.hypot(dx, dz);
      if (d > out[k]!) out[k] = d;
      any = true;
    }
  }
  if (!any) return null;
  // Fill the gaps from the nearest filled direction either side.
  const filled = Float32Array.from(out);
  for (let k = 0; k < AROUND; k++) {
    if (out[k]! > 0) continue;
    for (let j = 1; j < AROUND / 2; j++) {
      const v = Math.max(out[(k + j) % AROUND]!, out[(k - j + AROUND) % AROUND]!);
      if (v > 0) {
        filled[k] = v;
        break;
      }
    }
  }
  // A band lies over the bumps: each direction is at least its neighbours' average, then smoothed.
  const smooth = new Float32Array(AROUND);
  for (let k = 0; k < AROUND; k++) {
    const a = filled[(k + AROUND - 1) % AROUND]!;
    const b = filled[(k + 1) % AROUND]!;
    smooth[k] = Math.max(filled[k]!, (a + b) / 2) * 0.5 + (a + b) * 0.25;
  }
  for (let k = 0; k < AROUND; k++) smooth[k] = Math.max(smooth[k]!, filled[k]!);
  return smooth;
}

/** Point k of a contour (scaled by `grow` and pushed out by `pad` metres) at height y. */
function around(radii: Float32Array, k: number, grow: number, pad: number, cx: number, cz: number): [number, number] {
  const a = (k / AROUND) * Math.PI * 2;
  const d = radii[k % AROUND]! * grow + pad;
  return [cx + Math.sin(a) * d, cz + Math.cos(a) * d];
}

/**
 * A closed band laid round a head: from `y0` up to `y1`, following contours measured at those heights (pushed out by
 * `pad`), `thick` metres thick, with faces on every side (so it reads from inside a hood or under a brim too).
 */
function headBand(name: string, scene: Scene, lower: Float32Array, upper: Float32Array, y0: number, y1: number, pad: number, thick: number, cx: number, cz: number): Mesh {
  const positions: number[] = [];
  const indices: number[] = [];
  // Rings: outer bottom, outer top, inner top, inner bottom.
  const rings: [Float32Array, number, number][] = [
    [lower, y0, pad + thick],
    [upper, y1, pad + thick],
    [upper, y1, pad],
    [lower, y0, pad],
  ];
  for (const [radii, y, out] of rings) {
    for (let k = 0; k < AROUND; k++) {
      const [x, z] = around(radii, k, 1, out, cx, cz);
      positions.push(x, y, z);
    }
  }
  for (let r = 0; r < 4; r++) {
    const a = r * AROUND;
    const b = ((r + 1) % 4) * AROUND;
    for (let k = 0; k < AROUND; k++) {
      const k1 = (k + 1) % AROUND;
      indices.push(a + k, a + k1, b + k, b + k, a + k1, b + k1);
    }
  }
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  data.normals = normals;
  data.applyToMesh(mesh);
  return mesh;
}

export interface GearTargets {
  root: TransformNode;
  joints: Map<string, TransformNode>;
  /** The head (with eyes), the hair, and the torso part's meshes. */
  head: AbstractMesh[];
  eyes: AbstractMesh[];
  hair: AbstractMesh[];
  torso: AbstractMesh[];
  /** Loaded gear models by name (gearModels); a piece whose model is missing is left off. */
  models?: ReadonlyMap<string, AssetContainer>;
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
  /** The head's outline at a height, hair included where it sits close (never more than 2.5 cm out). */
  const outline = (y: number, withHair = true): Float32Array => {
    const skin = contour(t.head, t.root, y, 0.008, cx, cz);
    const fallback = new Float32Array(AROUND).fill(hx);
    if (!skin) return fallback;
    if (!withHair || !t.hair.length) return skin;
    const hair = contour(t.hair, t.root, y, 0.008, cx, cz);
    if (!hair) return skin;
    return skin.map((d, k) => Math.max(d, Math.min(hair[k]!, d + 0.025)));
  };

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
    const model = gearInfo(id)?.model;
    if (model) {
      const container = t.models?.get(model);
      if (!container) continue;
      // Made in skull radii with its origin on the crown line (see content/gear.json).
      const pivot = new TransformNode(`gear_${id}`, scene);
      pivot.position.set(cx, crownY, cz);
      pivot.scaling.setAll(r);
      const inst = container.instantiateModelsToScene((n) => `${id}_${n}`, false, { doNotInstantiate: true });
      for (const n of inst.rootNodes) n.parent = pivot;
      pivot.parent = t.root;
      pivot.computeWorldMatrix(true);
      pivot.setParent(headJoint);
      for (const m of pivot.getChildMeshes() as Mesh[]) {
        m.isPickable = false;
        if (m.getTotalVertices() > 0) made.push(m);
      }
      continue;
    }
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
      case 'beret': {
        // A band round the head at the crown line, a soft crown over the skull, and the beret's flat top pulled to one side.
        const felt = material(scene, cloth);
        const bandY = crownY + r * 0.05;
        head(headBand('beretBand', scene, outline(bandY - 0.012), outline(bandY + 0.014), bandY - 0.012, bandY + 0.014, 0.003, 0.01, cx, cz), material(scene, shade(trim, 0.8)));
        const cap = dome('beretCap', r * 1.04, 0.72);
        cap.position.y = bandY;
        head(cap, felt);
        const flat = CreateSphere('beret', { diameter: r * 2.3, segments: 16 }, scene);
        flat.scaling.set(1, 0.3, 1.02);
        flat.position.set(cx - r * 0.16, bandY + r * 0.62, cz - r * 0.02);
        flat.rotation.z = 0.2;
        head(flat, felt);
        break;
      }
      case 'brim': {
        // A crown sitting down over the skull, a band, and a brim a little wider than the shoulders' view of the head.
        const hat = material(scene, trim);
        const baseY = crownY - r * 0.06;
        const ring = outline(baseY);
        const rx = Math.max(...Array.from(ring, (d, k) => Math.abs(Math.sin((k / AROUND) * Math.PI * 2)) * d)) + 0.008;
        const rz = Math.max(...Array.from(ring, (d, k) => Math.abs(Math.cos((k / AROUND) * Math.PI * 2)) * d)) + 0.008;
        const crown = CreateCylinder('brimCrown', { diameterTop: 1.7, diameterBottom: 2, height: 1, tessellation: 28 }, scene);
        crown.scaling.set(rx, r * 0.9, rz);
        crown.position.set(cx, baseY + r * 0.45, cz);
        head(crown, hat);
        const dent = dome('brimTop', 1, 0.25);
        dent.scaling.set(rx * 0.85, r * 0.3, rz * 0.85);
        dent.position.set(cx, baseY + r * 0.9, cz);
        head(dent, hat);
        const disc = CreateCylinder('brimDisc', { diameter: 2, height: 0.01, tessellation: 36 }, scene);
        disc.scaling.set(rx * 1.75, 1, rz * 1.6);
        disc.position.set(cx, baseY + 0.004, cz);
        head(disc, hat);
        const band = CreateCylinder('brimBand', { diameterTop: 2 - 0.05 / 1, diameterBottom: 2, height: 1, tessellation: 28 }, scene);
        band.scaling.set(rx * 1.01, 0.028, rz * 1.01);
        band.position.set(cx, baseY + 0.022, cz);
        head(band, material(scene, shade(trim, 0.55)));
        break;
      }
      case 'headband': {
        // A cloth band laid on the forehead and round the hair, its tails knotted at the back.
        const bandY = eyeY + (top - eyeY) * 0.42;
        const lower = outline(bandY - 0.016);
        const upper = outline(bandY + 0.016);
        head(headBand('headband', scene, lower, upper, bandY - 0.016, bandY + 0.016, 0.002, 0.008, cx, cz), material(scene, cloth));
        const [bx, bz] = around(lower, AROUND / 2, 1, 0.01, cx, cz);
        for (const side of [-1, 1]) {
          const tail = CreateBox('headbandTail', { width: 0.022, height: 0.075, depth: 0.006 }, scene);
          tail.position.set(bx + side * 0.012, bandY - 0.04, bz - 0.006);
          tail.rotation.set(-0.35, 0, side * 0.25);
          head(tail, material(scene, cloth));
        }
        break;
      }
      case 'shades':
      case 'goggles': {
        const goggles = id === 'goggles';
        const lens = material(scene, goggles ? '#c8a050' : '#14161a', 'glass');
        const frame = material(scene, goggles ? '#2a2a2a' : '#0e0f12', 'hard');
        const spread = eyeBox ? Math.max(0.026, (eyeBox.max.x - eyeBox.min.x) / 2 - 0.014) : hx * 0.42;
        const ring = outline(eyeY + 0.004, goggles);
        // The face's front over each eye (the brow can stand out past the eyes), and the head's sides at eye height.
        const faceZ = Math.max(front, cz + ring[0]! - 0.004);
        const sideX = Math.max(ring[AROUND / 4]!, ring[(AROUND * 3) / 4]!);
        const lw = goggles ? 0.044 : 0.04;
        const lh = goggles ? 0.034 : 0.026;
        for (const side of [-1, 1]) {
          const l = CreateCylinder(`lens${side}`, { diameter: 1, height: goggles ? 0.016 : 0.006, tessellation: 20 }, scene);
          l.rotation.x = Math.PI / 2;
          l.scaling.set(lw, 1, lh);
          l.position.set(cx + side * spread, eyeY + 0.003, faceZ + (goggles ? 0.012 : 0.008));
          head(l, lens);
          const rim = CreateTorus(`lensRim${side}`, { diameter: 1, thickness: goggles ? 0.16 : 0.1, tessellation: 20 }, scene);
          rim.rotation.x = Math.PI / 2;
          rim.scaling.set(lw, lh, 0.02);
          rim.position.set(cx + side * spread, eyeY + 0.003, faceZ + (goggles ? 0.016 : 0.01));
          head(rim, frame);
        }
        const bridge = CreateBox('bridge', { width: spread * 2 - lw * 0.9, height: 0.007, depth: 0.007 }, scene);
        bridge.position.set(cx, eyeY + 0.008, faceZ + 0.012);
        head(bridge, frame);
        if (goggles) {
          // The strap: a band round the head and hair at eye height, from the lenses back.
          const strapY = eyeY + 0.004;
          head(headBand('strap', scene, outline(strapY - 0.011), outline(strapY + 0.011), strapY - 0.011, strapY + 0.011, 0.003, 0.006, cx, cz), material(scene, '#3a3028'));
        } else {
          // Arms from the lenses' outer edges back along the head's sides to the ears.
          const backZ = cz - 0.01;
          for (const side of [-1, 1]) {
            const hinge = CreateBox('shadesHinge', { width: Math.max(0.006, sideX + 0.006 - spread - lw / 2), height: 0.008, depth: 0.006 }, scene);
            hinge.position.set(cx + side * (spread + lw / 2 + (sideX + 0.006 - spread - lw / 2) / 2), eyeY + 0.008, faceZ + 0.006);
            head(hinge, frame);
            const arm = CreateBox('shadesArm', { width: 0.005, height: 0.007, depth: faceZ + 0.006 - backZ }, scene);
            arm.position.set(cx + side * (sideX + 0.006), eyeY + 0.008, (faceZ + 0.006 + backZ) / 2);
            head(arm, frame);
          }
        }
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
