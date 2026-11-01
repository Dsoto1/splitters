import type { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
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
import { Geo, HeadMap, outline, ringHeight, v3, type P3 } from './headFit.ts';

/**
 * Gear (hats, glasses, vests, packs) hung on the skeleton, so it moves with the character. Head gear is made to fit
 * the wearer's own head: the head (and hair) is measured in the bind pose (headFit.ts) and hats, bands and straps are
 * laid over it, eyewear sits on its nose bridge and ears. Colours come from the look's dyes. Shaped gear is part of
 * our own toolkit, like the building kit. Gear with a `model` (the helmets) is a textured model from public/gear
 * (tools/content/prepare-gear.mjs), made in skull radii about the crown line: scaled by the wearer's skull and hung
 * on the Head joint.
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

/**
 * Some meshes' bind-pose surface as points in `space` (x, y, z triples): the vertices, and each triangle's middle
 * and edge midpoints, so a sparse low-poly head still fills a fine map.
 */
function surfacePoints(meshes: AbstractMesh[], space: TransformNode): Float32Array {
  const inv = Matrix.Invert(space.computeWorldMatrix(true));
  const out: number[] = [];
  const p = new Vector3();
  for (const m of meshes) {
    const pos = m.getVerticesData('position');
    if (!pos) continue;
    const toSpace = m.computeWorldMatrix(true).multiply(inv);
    const local = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i += 3) {
      Vector3.TransformCoordinatesFromFloatsToRef(pos[i]!, pos[i + 1]!, pos[i + 2]!, toSpace, p);
      local.set([p.x, p.y, p.z], i);
      out.push(p.x, p.y, p.z);
    }
    const idx = m.getIndices();
    if (!idx) continue;
    const P = (i: number): P3 => [local[i * 3]!, local[i * 3 + 1]!, local[i * 3 + 2]!];
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const [a, b, c] = [P(idx[t]!), P(idx[t + 1]!), P(idx[t + 2]!)];
      for (const q of [v3.lerp(a, b, 0.5), v3.lerp(b, c, 0.5), v3.lerp(c, a, 0.5), v3.scale(v3.add(v3.add(a, b), c), 1 / 3)]) out.push(...q);
    }
  }
  return Float32Array.from(out);
}

/** Points (triples) within a box, as a list. */
function within(points: Float32Array, test: (x: number, y: number, z: number) => boolean): P3[] {
  const out: P3[] = [];
  for (let i = 0; i + 2 < points.length; i += 3) if (test(points[i]!, points[i + 1]!, points[i + 2]!)) out.push([points[i]!, points[i + 1]!, points[i + 2]!]);
  return out;
}

/** A mesh from collected triangles. */
function meshOf(name: string, scene: Scene, g: Geo): Mesh {
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = g.positions;
  data.indices = g.indices;
  const normals: number[] = [];
  VertexData.ComputeNormals(g.positions, g.indices, normals);
  data.normals = normals;
  data.applyToMesh(mesh);
  return mesh;
}

export interface GearTargets {
  root: TransformNode;
  joints: Map<string, TransformNode>;
  /** The head (with eyes and brows), the hair, and the torso part's meshes. */
  head: AbstractMesh[];
  eyes: AbstractMesh[];
  hair: AbstractMesh[];
  torso: AbstractMesh[];
  /** Loaded gear models by name (gearModels); a piece whose model is missing is left off. */
  models?: ReadonlyMap<string, AssetContainer>;
  /** Every hair mesh, low-detail copies too: hair a hat covers is cut away (it would poke through). */
  hairAll?: AbstractMesh[];
}

/** Cut away the hair triangles wholly inside `covered` (character space), in the meshes' own copies of their geometry. */
function trimHair(meshes: AbstractMesh[], space: TransformNode, covered: (p: P3) => boolean): void {
  const inv = Matrix.Invert(space.computeWorldMatrix(true));
  const p = new Vector3();
  for (const m of meshes) {
    if (!(m instanceof Mesh)) continue;
    const pos = m.getVerticesData('position');
    const idx = m.getIndices();
    if (!pos || !idx) continue;
    const toSpace = m.computeWorldMatrix(true).multiply(inv);
    const inside = new Uint8Array(pos.length / 3);
    for (let i = 0; i < inside.length; i++) {
      Vector3.TransformCoordinatesFromFloatsToRef(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!, toSpace, p);
      inside[i] = covered([p.x, p.y, p.z]) ? 1 : 0;
    }
    const kept: number[] = [];
    for (let t = 0; t + 2 < idx.length; t += 3) if (!(inside[idx[t]!] && inside[idx[t + 1]!] && inside[idx[t + 2]!])) kept.push(idx[t]!, idx[t + 1]!, idx[t + 2]!);
    if (kept.length === idx.length) continue;
    m.makeGeometryUnique();
    m.setIndices(kept);
  }
}

/** A head measured for gear (character space, bind pose). */
interface HeadFit {
  /** The skin alone (eyewear), and the skin with the hair kept close (hats, bands, straps), as cloth lies over it. */
  skin: HeadMap;
  hat: HeadMap;
  skinPts: Float32Array;
  cx: number;
  eyeY: number;
  /** Eye centres, left (-x) and right (+x) of the middle. */
  eyes: [P3, P3];
  /** The top of the brows; the top of the head (hair kept close). */
  browTop: number;
  crown: number;
  /** Half the skull's width (hair kept close) at the brows. */
  half: number;
  /** The wearer's right: +1 when it is +x. */
  right: number;
}

function measureHead(t: GearTargets, headBox: Box): HeadFit {
  const skinMeshes = t.head.filter((m) => !/Hair/.test(m.material?.name ?? ''));
  const brows = t.head.filter((m) => /Hair/.test(m.material?.name ?? ''));
  const skinPts = surfacePoints(skinMeshes.length ? skinMeshes : t.head, t.root);
  const hairPts = surfacePoints(t.hair, t.root);
  const cx = (headBox.max.x + headBox.min.x) / 2;
  const eyeBox = bounds(t.eyes, t.root);
  const eyeY = eyeBox ? (eyeBox.min.y + eyeBox.max.y) / 2 : headBox.min.y + (headBox.max.y - headBox.min.y) * 0.62;
  const eyeHalf = eyeBox ? Math.max(0.02, (eyeBox.max.x - eyeBox.min.x) / 2 - 0.016) : 0.032;
  const eyeZ = eyeBox ? eyeBox.max.z - 0.01 : headBox.max.z - 0.03;
  const eyes: [P3, P3] = [[cx - eyeHalf, eyeY, eyeZ], [cx + eyeHalf, eyeY, eyeZ]];
  if (t.eyes.length) {
    const ep = surfacePoints(t.eyes, t.root);
    for (const s of [0, 1] as const) {
      const side = within(ep, (x) => (s === 0 ? x < cx : x > cx));
      if (side.length) {
        const lo = side.reduce((a, p) => [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.min(a[2], p[2])] as P3, [Infinity, Infinity, Infinity]);
        const hi = side.reduce((a, p) => [Math.max(a[0], p[0]), Math.max(a[1], p[1]), Math.max(a[2], p[2])] as P3, [-Infinity, -Infinity, -Infinity]);
        eyes[s] = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, hi[2]];
      }
    }
  }
  const browBox = bounds(brows, t.root);
  const browTop = browBox ? browBox.max.y : eyeY + 0.026;
  // The skull's middle, front to back, a little above the eyes.
  const cy = eyeY + 0.03;
  const level = within(skinPts, (x, y) => Math.abs(y - cy) < 0.012 && Math.abs(x - cx) < 0.03);
  const cz = level.length ? (Math.max(...level.map((p) => p[2])) + Math.min(...level.map((p) => p[2]))) / 2 : (headBox.max.z + headBox.min.z) / 2;
  const c: P3 = [cx, cy, cz];
  const skin = new HeadMap(c, skinPts);
  const hat = (hairPts.length ? new HeadMap(c, hairPts).over(skin, 0.012) : skin).draped(2);
  const crown = hat.point(0, Math.PI / 2)[1];
  const half = Math.max(hat.at(Math.PI / 2, 0.25), hat.at(-Math.PI / 2, 0.25)) * Math.cos(0.25);
  const arm = t.joints.get('upperarm_r');
  let right = 1;
  if (arm) {
    const p = Vector3.TransformCoordinates(arm.getAbsolutePosition(), Matrix.Invert(t.root.computeWorldMatrix(true)));
    right = p.x < cx ? -1 : 1;
  }
  return { skin, hat, skinPts, cx, eyeY, eyes, browTop, crown, half, right };
}

/**
 * The beard hairstyle (HAIR_STYLES' `hair_beard`), built here on the wearer's own face instead of the part file's
 * thin hair cards: a full beard from the sideburns down the jaw to the chin, a moustache over the upper lip, the
 * mouth left clear between them, its edges ragged like hair.
 */
export const BEARD = 'hair_beard';

function buildBeard(scene: Scene, f: HeadFit, hairColor: string, shape: (name: string, g: Geo, mat: PBRMaterial) => void): void {
  const c = f.skin.c;
  const chinPts = within(f.skinPts, (x, _y, z) => Math.abs(x - f.cx) < 0.025 && z > c[2] + 0.04);
  const chin = chinPts.length ? Math.min(...chinPts.map((p) => p[1])) : f.eyeY - 0.12;
  const span = f.eyeY - chin;
  const nose = f.eyeY - 0.4 * span;
  const mouth = f.eyeY - 0.6 * span;
  const lip = f.eyeY - 0.7 * span;
  const face = f.skin.draped(1);
  const hug = (th: number, y: number, pad: number) => face.point(th, face.phiAt(th, y, pad), pad);
  // Ragged edges: a small zigzag along them.
  const rag = (k: number, a: number) => (k % 2 ? a : -a * 0.4);
  const reach = 1.55;
  const n = 31;
  const thetas = Array.from({ length: n }, (_, i) => -reach + (2 * reach * i) / (n - 1));
  // The beard: from its top line (sideburns high at the ears, down over the cheeks, under the lower lip in the middle) to below the jaw.
  const topAt = (th: number, k: number) => {
    const a = Math.abs(th) / reach;
    // Under the lower lip in the middle, along the lower cheeks to the sideburns, up in front of the ears.
    const top = a < 0.28 ? lip - 0.008 : a < 0.85 ? mouth + 0.004 + ((a - 0.28) / 0.57) * (f.eyeY - 0.024 - mouth - 0.004) : f.eyeY - 0.024 + ((a - 0.85) / 0.15) * 0.028;
    return top + rag(k, 0.003);
  };
  const rows: P3[][] = [];
  const m = 7;
  for (let j = 0; j <= m; j++) {
    const u = j / m;
    rows.push(
      thetas.map((th, k) => {
        const a = Math.abs(th) / reach;
        const top = topAt(th, k);
        // Down to the jaw line: under the chin in front, the jaw's corner at the sides (above the neck).
        const bottom = chin - 0.012 * (1 - a) ** 0.5 + a * a * 0.03 + (j === m ? rag(k, 0.006) : 0);
        const y = top + (bottom - top) * u;
        const pad = 0.003 + 0.009 * u * (1 - a * 0.6);
        return hug(th, y, pad);
      }),
    );
  }
  // Below the chin the beard hangs straight down a little rather than following the throat back.
  const g = new Geo();
  g.slab(rows, false, 0.004, { from: c });
  // The moustache: from the nose down over the upper lip, out to the mouth's corners and joining the beard.
  const mr = 0.62;
  const mn = 15;
  const mt = Array.from({ length: mn }, (_, i) => -mr + (2 * mr * i) / (mn - 1));
  const moustache = [0, 0.5, 1].map((u) =>
    mt.map((th, k) => {
      const a = Math.abs(th) / mr;
      const top = nose - 0.002 - a * 0.004;
      const bottom = mouth + 0.003 - a * a * (mouth - lip + 0.004) + rag(k, 0.002) * u;
      return hug(th, top + (bottom - top) * u, 0.003 + 0.004 * Math.sin(u * Math.PI) + 0.002 * u);
    }),
  );
  g.slab(moustache, false, 0.003, { from: c });
  shape('beard', g, material(scene, shade(hairColor, 1.06)));
}

/** Build a look's gear onto a character; returns the meshes (already parented to joints). */
export function buildGear(scene: Scene, look: CharacterLook, t: GearTargets): Mesh[] {
  const beard = look.hair.includes(BEARD);
  const gear = [...(look.gear ?? []), ...(beard ? [BEARD] : [])];
  if (!gear.length) return [];
  const headBox = bounds(t.head, t.root);
  const headJoint = t.joints.get('Head');
  const chestJoint = t.joints.get('spine_03');
  if (!headBox || !headJoint || !chestJoint) return [];
  const torsoBox = bounds(t.torso, t.root);
  const cloth = look.cloth ?? DEFAULT_CLOTH;
  const trim = look.trim ?? DEFAULT_TRIM;
  const hasHeadGear = beard || gear.some((id) => ['hat', 'face'].includes(gearInfo(id)?.slot ?? ''));
  const fit = hasHeadGear ? measureHead(t, headBox) : null;

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
  const shape = (name: string, g: Geo, mat: PBRMaterial) => head(meshOf(name, scene, g), mat);
  /** A hat's cover: the hair above its lower edge and under (or poking a little through) its crown is cut away. */
  const cover = (edge: (th: number) => number, poke = 0.03) => {
    const f = fit!;
    trimHair(t.hairAll ?? t.hair, t.root, (p) => {
      const d = v3.sub(p, f.hat.c);
      const th = Math.atan2(d[0], d[2]);
      return p[1] > edge(th) + 0.003 && v3.len(d) < f.hat.along(d) + poke;
    });
  };

  for (const id of gear) {
    const model = gearInfo(id)?.model;
    if (model) {
      const container = t.models?.get(model);
      if (!container || !fit) continue;
      // Made in skull radii with its origin on the crown line (see content/gear.json): scaled by this skull, each
      // mesh hung straight on the Head joint (so first person's head cut hides it with the head).
      const r = fit.half * 1.12;
      const pivot = new TransformNode(`gear_${id}`, scene);
      pivot.position.set(fit.cx, fit.crown - r * 0.82, fit.hat.c[2]);
      pivot.scaling.setAll(r);
      const inst = container.instantiateModelsToScene((n) => `${id}_${n}`, false, { doNotInstantiate: true });
      for (const n of inst.rootNodes) n.parent = pivot;
      pivot.parent = t.root;
      pivot.computeWorldMatrix(true);
      for (const m of pivot.getChildMeshes() as Mesh[]) {
        if (!m.getTotalVertices()) continue;
        m.computeWorldMatrix(true);
        m.setParent(headJoint);
        m.isPickable = false;
        made.push(m);
      }
      pivot.dispose();
      continue;
    }
    if (!fit && (id === BEARD || ['hat', 'face'].includes(gearInfo(id)?.slot ?? ''))) continue;
    const f = fit!;
    if (id === BEARD) {
      buildBeard(scene, f, look.hairColor ?? '#3a2a22', (name, g, mat) => shape(name, g, mat));
      continue;
    }
    const c = f.hat.c;
    const TH = 48;
    const around = (n: number, from = 0, to = Math.PI * 2) => Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - (to - from >= Math.PI * 2 - 1e-6 ? 0 : 1)));
    const full = (n: number) => around(n);
    /** Rows up a hat from its lower edge (height round the head) to the top, `pad` out from the head. */
    const crownRows = (thetas: number[], edge: (th: number) => number, pad: (th: number, u: number) => number, rows = 12, upTo = Math.PI / 2): P3[][] =>
      Array.from({ length: rows + 1 }, (_, j) => {
        const u = j / rows;
        return thetas.map((th) => {
          const p0 = f.hat.phiAt(th, edge(th), pad(th, 0));
          // Closer rows near the top, where the head turns over.
          const phi = p0 + (upTo - p0) * (1 - (1 - u) ** 1.4);
          return f.hat.point(th, phi, pad(th, u));
        });
      });
    /** A band round the head between two heights (each a function of θ). */
    const bandRows = (thetas: number[], lo: (th: number) => number, hi: (th: number) => number, pad: number | ((th: number) => number), rows = 2, map = f.hat): P3[][] =>
      Array.from({ length: rows + 1 }, (_, j) =>
        thetas.map((th) => {
          const pd = typeof pad === 'number' ? pad : pad(th);
          const y = lo(th) + ((hi(th) - lo(th)) * j) / rows;
          return map.point(th, map.phiAt(th, y, pd), pd);
        }),
      );
    switch (gearInfo(id)?.id) {
      case 'cap': {
        // A six-panel cap: crown laid over the head (taller in front), seams up to a button, and a curved peak.
        const edge = ringHeight(f.browTop + 0.012, f.browTop + 0.014, f.eyeY + 0.006);
        const pad = (th: number, u: number) => 0.003 + 0.007 * Math.max(0, Math.cos(th)) ** 2 * Math.sin(Math.min(1, u * 1.25) * Math.PI) ** 0.7;
        const thetas = full(TH);
        const rows = crownRows(thetas, edge, pad);
        const crown = new Geo();
        crown.slab(rows, true, 0.003, { from: c });
        shape('capCrown', crown, material(scene, cloth));
        cover(edge);
        const seams = new Geo();
        for (let k = 0; k < 6; k++) {
          const th = (k / 6) * Math.PI * 2;
          const p0 = f.hat.phiAt(th, edge(th), pad(th, 0));
          seams.tube(
            Array.from({ length: 10 }, (_, j) => {
              const u = 0.04 + (j / 9) * 0.93;
              return f.hat.point(th, p0 + (Math.PI / 2 - p0) * (1 - (1 - u) ** 1.4), pad(th, u) + 0.0012);
            }),
            0.0013,
            5,
          );
        }
        const top = f.hat.point(0, Math.PI / 2, pad(0, 1));
        const button = CreateSphere('capButton', { diameter: 0.014, segments: 6 }, scene);
        button.scaling.y = 0.45;
        button.position.set(top[0], top[1] + 0.002, top[2]);
        head(button, material(scene, shade(cloth, 0.7)));
        shape('capSeams', seams, material(scene, shade(cloth, 0.72)));
        // The peak: from the crown's front edge, out and a little down, its sides curving down.
        const span = 1.2;
        const peakThetas = around(25, -span, span);
        const base = peakThetas.map((th) => f.hat.point(th, f.hat.phiAt(th, edge(th), 0.004), 0.004));
        const peak = [0, 0.5, 1].map((s) =>
          base.map((b, i) => {
            const u = peakThetas[i]! / span;
            const outward = v3.norm([b[0] - c[0], 0, b[2] - c[2]]);
            const length = 0.074 * Math.sqrt(Math.max(0, 1 - u * u)) + 0.003;
            return v3.add(b, [outward[0] * length * s, -(length * s * 0.22 + 0.011 * u * u * s * s), outward[2] * length * s]);
          }),
        );
        const visor = new Geo();
        visor.slab(peak, false, 0.004, { dir: [0, 1, 0] });
        shape('capPeak', visor, material(scene, shade(cloth, 0.85)));
        break;
      }
      case 'beanie': {
        // A knitted beanie: soft crown rising a little over the head, and a ribbed turned-up cuff.
        const edge = ringHeight(f.browTop + 0.004, f.eyeY + 0.016, f.eyeY - 0.012);
        const rows = crownRows(full(TH), edge, (_th, u) => 0.006 + 0.016 * u ** 2);
        const body = new Geo();
        body.slab(rows, true, 0.004, { from: c });
        shape('beanie', body, material(scene, cloth));
        cover(edge);
        const thetas = full(144);
        const cuffRows = bandRows(thetas, edge, (th) => edge(th) + 0.034, (th) => 0.011 + 0.0016 * Math.cos(th * 36), 3);
        const cuff = new Geo();
        cuff.slab(cuffRows, true, 0.005, { from: c });
        shape('beanieCuff', cuff, material(scene, shade(cloth, 0.86)));
        break;
      }
      case 'beret': {
        // A beret: a leather band round the head, the cloth pulled over to the wearer's right and down over that
        // ear, the badge over the left eye.
        const s = f.right;
        const bandLo = ringHeight(f.browTop + 0.004, f.browTop + 0.002, f.eyeY + 0.002);
        const bandHi = (th: number) => bandLo(th) + 0.012;
        const thetas = full(64);
        const band = new Geo();
        band.slab(bandRows(thetas, bandLo, bandHi, 0.003, 2), true, 0.003, { from: c });
        shape('beretBand', band, material(scene, shade(trim, 0.7)));
        // The flat top lies on the crown on the left and runs out over the right, dropping towards that ear.
        const D: P3 = [f.cx + s * 0.03, f.crown - 0.01, c[2] - 0.004];
        const rxDrape = f.half * 1.62;
        const rxHigh = f.half * 0.98;
        const rz = (f.hat.at(0, 0.3) + f.hat.at(Math.PI, 0.3)) * 0.5 * Math.cos(0.3) * 1.18;
        const N: P3 = v3.norm([-s * 0.25, 1, 0.08]);
        const T = v3.add(D, [s * 0.015, 0.012, 0]);
        const quad = (a: P3, q: P3, b: P3, u: number) => v3.lerp(v3.lerp(a, q, u), v3.lerp(q, b, u), u);
        const rows: P3[][] = [];
        const lower = 7;
        const upper = 7;
        const prof = thetas.map((th) => {
          const p0 = f.hat.point(th, f.hat.phiAt(th, bandHi(th), 0.004), 0.004);
          const across = Math.sin(th) * s;
          const drape = Math.max(0, across);
          const rim: P3 = [D[0] + Math.sin(th) * (across > 0 ? rxDrape : rxHigh), D[1] - 0.06 * drape ** 1.6 - 0.008 * Math.cos(th) ** 2 + 0.006 * Math.max(0, -across), D[2] + Math.cos(th) * rz];
          const out = v3.norm([rim[0] - c[0], 0, rim[2] - c[2]]);
          const q1: P3 = v3.add([rim[0], p0[1] + (rim[1] - p0[1]) * 0.35, rim[2]], v3.scale(out, 0.008));
          const q2 = v3.add(v3.lerp(rim, T, 0.45), v3.scale(N, 0.006));
          return { p0, rim, q1, q2 };
        });
        for (let j = 0; j <= lower; j++) rows.push(prof.map((p) => quad(p.p0, p.q1, p.rim, j / lower)));
        for (let j = 1; j <= upper; j++) rows.push(prof.map((p) => quad(p.rim, p.q2, T, j / upper)));
        const cleared = rows.map((row) => row.map((p) => f.hat.clear(p, 0.004)));
        const body = new Geo();
        body.slab(cleared, true, 0.004, { from: c });
        shape('beret', body, material(scene, cloth));
        cover(bandLo, 0.02);
        // Badge on the band over the left eye.
        const bth = -s * 0.42;
        const bp = f.hat.point(bth, f.hat.phiAt(bth, bandLo(bth) + 0.009, 0.007), 0.007);
        const badge = CreateCylinder('beretBadge', { diameter: 0.018, height: 0.004, tessellation: 12 }, scene);
        badge.rotation.set(Math.PI / 2, bth, 0);
        badge.position.set(bp[0], bp[1] + 0.004, bp[2]);
        head(badge, material(scene, '#c9a54a', 'metal'));
        break;
      }
      case 'brim': {
        // A wide-brimmed hat: crown seated on the head and standing above it with a pinched top, a band, and a brim
        // whose sides turn up.
        const edge = ringHeight(f.browTop + 0.01, f.browTop + 0.022, f.browTop + 0.004);
        const thetas = full(64);
        const base = thetas.map((th) => f.hat.point(th, f.hat.phiAt(th, edge(th), 0.006), 0.006));
        const top = f.crown + 0.05;
        const mid: P3 = [c[0], 0, c[2]];
        const ring = (u: number, k: number) =>
          base.map((b, i) => {
            const th = thetas[i]!;
            const h = top - 0.008 * Math.cos(th);
            const p: P3 = [mid[0] + (b[0] - mid[0]) * k, b[1] + (h - b[1]) * u, mid[2] + (b[2] - mid[2]) * k];
            return p;
          });
        const rows: P3[][] = [];
        for (let j = 0; j <= 6; j++) rows.push(ring(j / 6, 1 - 0.12 * (j / 6) ** 1.5));
        for (const k of [0.8, 0.55, 0.3, 0.02]) {
          const r = ring(1, 0.88 * k);
          rows.push(r.map((p) => [p[0], p[1] + 0.006 * (1 - k) - 0.016 * (1 - k ** 2) * Math.exp(-(((p[0] - c[0]) / 0.03) ** 2)), p[2]] as P3));
        }
        const crown = new Geo();
        crown.slab(
          rows.map((row) => row.map((p) => f.hat.clear(p, 0.006))),
          true,
          0.004,
          { from: c },
        );
        const felt = material(scene, trim);
        shape('brimCrown', crown, felt);
        cover(edge, 0.05);
        const band = new Geo();
        band.slab([ring(0.03, 1.02), ring(0.3, 1 - 0.12 * 0.3 ** 1.5 + 0.02)], true, 0.003, { from: c });
        shape('brimBand', band, material(scene, shade(cloth, 0.55)));
        const brim = [0, 0.5, 1].map((u) =>
          base.map((b, i) => {
            const th = thetas[i]!;
            const out = v3.norm([b[0] - c[0], 0, b[2] - c[2]]);
            const w = (0.068 + 0.014 * Math.cos(th) ** 2) * u + 0.002;
            const lift = (0.024 * Math.sin(th) ** 2 - 0.008 * Math.cos(th) ** 2) * u * u;
            return v3.add(b, [out[0] * w, lift - 0.002, out[2] * w]);
          }),
        );
        const brimGeo = new Geo();
        brimGeo.slab(brim, true, 0.005, { dir: [0, 1, 0] });
        shape('brimDisc', brimGeo, felt);
        break;
      }
      case 'headband': {
        // A cloth band across the forehead and round the hair, knotted at the back with two tails.
        const lo = ringHeight(f.browTop + 0.009, f.browTop + 0.012, f.browTop + 0.004);
        const hi = (th: number) => lo(th) + 0.024;
        const g = new Geo();
        g.slab(bandRows(full(64), lo, hi, 0.0025, 2), true, 0.0025, { from: c });
        const knot = f.hat.point(Math.PI, f.hat.phiAt(Math.PI, lo(Math.PI) + 0.012, 0.008), 0.008);
        for (const side of [-1, 1]) {
          const tail = [0, 0.33, 0.66, 1].map((u): P3 => [knot[0] + side * (0.006 + 0.02 * u), knot[1] - 0.075 * u, knot[2] - 0.012 - 0.02 * u * (1 - u * 0.5)]);
          g.slab(
            [tail.map((p) => [p[0] - 0.009, p[1], p[2]] as P3), tail.map((p) => [p[0] + 0.009, p[1], p[2]] as P3)],
            false,
            0.003,
            { dir: [0, 0, -1] },
          );
        }
        shape('headband', g, material(scene, cloth));
        const k = CreateSphere('headbandKnot', { diameter: 0.022, segments: 6 }, scene);
        k.scaling.set(1, 0.8, 0.7);
        k.position.set(knot[0], knot[1], knot[2]);
        head(k, material(scene, shade(cloth, 0.9)));
        break;
      }
      case 'shades':
      case 'goggles': {
        // Lenses in front of the eyes (clear of the brow and cheeks), a bridge resting on the nose, and arms back
        // along the sides of the head to the ears (shades) or a strap round the head (goggles).
        const goggles = id === 'goggles';
        const lensMat = material(scene, goggles ? '#c8a050' : '#14161a', 'glass');
        const frameMat = material(scene, goggles ? '#2a2a2a' : '#0e0f12', 'hard');
        const half: [number, number] = goggles ? [0.025, 0.019] : [0.022, 0.0155];
        const lenses = new Geo();
        const frames = new Geo();
        const hinges: P3[] = [];
        const inner: P3[] = [];
        const ys = f.eyeY + (goggles ? 0.003 : 0.002);
        for (const [i, e] of f.eyes.entries()) {
          const side = i === 0 ? -1 : 1;
          const wrap = 0.18 * side;
          const ax: P3 = [Math.cos(wrap), 0, -Math.sin(wrap)];
          const tiltX = 0.12;
          const ay: P3 = [0, Math.cos(tiltX), Math.sin(tiltX)];
          const nrm = v3.norm(v3.cross(ay, ax));
          const fwd: P3 = nrm[2] < 0 ? v3.scale(nrm, -1) : nrm;
          // Clear of the face: the farthest skin forward under the lens (with a margin round it).
          const under = within(f.skinPts, (x, y) => Math.abs(x - e[0]) < half[0] + 0.004 && Math.abs(y - ys) < half[1] + 0.003);
          const faceZ = under.length ? Math.max(...under.map((p) => p[2] - (p[0] - e[0]) * Math.tan(-wrap))) : e[2] + 0.01;
          const centre: P3 = [e[0], ys, faceZ + (goggles ? 0.012 : 0.006)];
          const shapeY = goggles ? undefined : (x: number, y: number) => (y < 0 ? y * (1 - 0.25 * Math.max(0, -x * side)) : y);
          const ring = outline(centre, ax, ay, half, goggles ? 2.6 : 3.2, 28, shapeY);
          lenses.fan(centre, ring, fwd);
          frames.tube([...ring, ring[0]!, ring[1]!], goggles ? 0.0035 : 0.0022, 6);
          if (goggles) {
            // The cup back to the face: each rim point to the skin behind it.
            const back = ring.map((p) => {
              const near = within(f.skinPts, (x, y) => Math.abs(x - p[0]) < 0.006 && Math.abs(y - p[1]) < 0.006);
              const z = near.length ? Math.max(...near.map((q) => q[2])) + 0.002 : p[2] - 0.01;
              return [p[0], p[1], Math.min(p[2] - 0.002, z)] as P3;
            });
            frames.slab([[...ring, ring[0]!], [...back, back[0]!]], false, 0.002, { from: centre });
          }
          // Hinge: the lens's outer edge, a little above the middle; inner: its nose-side edge.
          hinges.push(v3.add(centre, v3.add(v3.scale(ax, side * half[0]), v3.scale(ay, half[1] * 0.45))));
          inner.push(v3.add(centre, v3.add(v3.scale(ax, -side * half[0]), v3.scale(ay, half[1] * 0.25))));
        }
        // Bridge over the nose: on the skin at the middle, between the lenses' inner edges.
        const nose = within(f.skinPts, (x, y) => Math.abs(x - f.cx) < 0.007 && Math.abs(y - (ys + 0.002)) < 0.006);
        const noseZ = nose.length ? Math.max(...nose.map((p) => p[2])) + 0.003 : (inner[0]![2] + inner[1]![2]) / 2;
        const bridgeMid: P3 = [f.cx, ys + 0.004, Math.min(noseZ, (inner[0]![2] + inner[1]![2]) / 2)];
        frames.tube([inner[0]!, v3.lerp(inner[0]!, bridgeMid, 0.5), bridgeMid, v3.lerp(inner[1]!, bridgeMid, 0.5), inner[1]!], goggles ? 0.004 : 0.0024, 6);
        if (goggles) {
          // The strap: round the head (hair kept close) from the lenses back, rising a little towards the back.
          const lo = ringHeight(ys - 0.009, ys - 0.007, ys + 0.008);
          const hi = (th: number) => lo(th) + 0.018;
          const strap = new Geo();
          const th0 = Math.atan2(hinges[1]![0] - c[0], hinges[1]![2] - c[2]);
          strap.slab(bandRows(around(40, th0, Math.PI * 2 - th0), lo, hi, 0.002, 1), false, 0.0025, { from: c });
          shape('gogglesStrap', strap, material(scene, '#3a3028'));
        } else {
          // Arms: from the hinges straight back along the side of the head, over the ear, then down behind it.
          for (const [i, hinge] of hinges.entries()) {
            const side = i === 0 ? -1 : 1;
            const y = hinge[1];
            const sideAt = (z: number) => {
              const near = within(f.skinPts, (x, py, pz) => (x - f.cx) * side > 0 && Math.abs(py - y) < 0.008 && Math.abs(pz - z) < 0.006);
              return near.length ? Math.max(...near.map((p) => (p[0] - f.cx) * side)) : f.half;
            };
            // The ear: where the head is widest at this height behind the face.
            let earZ = c[2];
            let earX = 0;
            for (let z = hinge[2] - 0.02; z > c[2] - 0.06; z -= 0.004) {
              const w = sideAt(z);
              if (w > earX) {
                earX = w;
                earZ = z;
              }
            }
            const path: P3[] = [hinge];
            const z0 = hinge[2] - 0.006;
            for (let k = 0; k <= 6; k++) {
              const z = z0 + ((earZ - 0.01 - z0) * k) / 6;
              const w = Math.max(sideAt(z), Math.abs(hinge[0] - f.cx) - 0.004 * k);
              path.push([f.cx + side * (w + 0.0035), y + 0.0015 * k, z]);
            }
            const last = path[path.length - 1]!;
            path.push([last[0] - side * 0.004, last[1] - 0.012, last[2] - 0.014]);
            path.push([last[0] - side * 0.007, last[1] - 0.026, last[2] - 0.016]);
            frames.tube(path, 0.0022, 5);
          }
        }
        shape(goggles ? 'gogglesLens' : 'shadesLens', lenses, lensMat);
        shape(goggles ? 'gogglesFrame' : 'shadesFrame', frames, frameMat);
        break;
      }
      case 'mask': {
        // A bandana over the nose and mouth, hanging in a point below the chin, tied round the back of the head.
        const top = f.eyeY - 0.022;
        const chinPts = within(f.skinPts, (x, _y, z) => Math.abs(x - f.cx) < 0.03 && z > c[2] + 0.04);
        const chin = chinPts.length ? Math.min(...chinPts.map((p) => p[1])) : top - 0.08;
        const span = 1.9;
        const thetas = around(33, -span, span);
        const face = f.skin.over(f.hat, 0).draped(1);
        const hug = (th: number, y: number, pad: number) => face.point(th, face.phiAt(th, y, pad), pad);
        const rows: P3[][] = [];
        const n = 6;
        for (let j = 0; j <= n; j++) rows.push(thetas.map((th) => hug(th, top - ((top - chin - 0.006) * j) / n, 0.006 + 0.004 * (j / n))));
        // Below the chin the cloth hangs: straight down from the chin row, to a point at the front.
        const chinRow = rows[n]!;
        for (const u of [0.5, 1])
          rows.push(
            chinRow.map((p, i) => {
              const th = thetas[i]!;
              const drop = (0.012 + 0.05 * Math.max(0, Math.cos(th)) ** 3) * u;
              const out = v3.norm([p[0] - c[0], 0, p[2] - c[2]]);
              return [p[0] + out[0] * 0.006 * u, p[1] - drop, p[2] + out[2] * 0.006 * u] as P3;
            }),
          );
        const g = new Geo();
        g.slab(rows, false, 0.003, { from: c });
        // The tie round the back.
        const lo = ringHeight(top - 0.02, top - 0.02, top - 0.004);
        g.slab(bandRows(around(20, span - 0.05, Math.PI * 2 - span + 0.05), lo, (th) => lo(th) + 0.016, 0.003, 1), false, 0.003, { from: c });
        shape('mask', g, material(scene, cloth));
        const kp = f.hat.point(Math.PI, f.hat.phiAt(Math.PI, lo(Math.PI) + 0.008, 0.01), 0.01);
        const knot = CreateSphere('maskKnot', { diameter: 0.026, segments: 6 }, scene);
        knot.scaling.set(1, 0.8, 0.7);
        knot.position.set(kp[0], kp[1], kp[2]);
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
