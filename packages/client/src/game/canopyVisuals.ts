import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CHUTE_GLIDER, type LookHitbox } from '@tiletrigger/shared';
import { reduceFlashing } from './reduceFlashing.ts';

/** Canopies put away for reuse, by scene and kind (a big match drops dozens of players at once, and again on every respawn). */
const spare = new WeakMap<Scene, Map<number, TransformNode[]>>();
/** Canopy materials, shared by every canopy in a scene. */
const materials = new WeakMap<Scene, Map<string, StandardMaterial>>();
/** Canopies of a kind kept for reuse at most. */
const MAX_SPARE = 32;

/**
 * Canopies drawn over anyone under a parachute or a glider (see
 * shared/sim/parachute.ts), built in code: a round canopy of sixteen gores
 * on suspension lines and four risers that meet behind the wearer's neck,
 * or a delta wing with a control bar. The root sits at the wearer's feet
 * and turns with them. Done with one: releaseCanopy.
 */
export function createCanopy(scene: Scene, name: string, kind: number): TransformNode {
  const reused = spare.get(scene)?.get(kind)?.pop();
  if (reused) {
    reused.setEnabled(true);
    return reused;
  }
  return buildCanopy(scene, name, kind);
}

/** Put a canopy away for the next one of its kind (hidden), or dispose it if enough are put away. */
export function releaseCanopy(scene: Scene, node: TransformNode, kind: number): void {
  let byKind = spare.get(scene);
  if (!byKind) spare.set(scene, (byKind = new Map()));
  let list = byKind.get(kind);
  if (!list) byKind.set(kind, (list = []));
  if (list.length >= MAX_SPARE || node.isDisposed()) {
    // Its materials are shared: they stay.
    node.dispose(false, false);
    return;
  }
  node.setEnabled(false);
  list.push(node);
}

function buildCanopy(scene: Scene, name: string, kind: number): TransformNode {
  const root = new TransformNode(name, scene);
  let mats = materials.get(scene);
  if (!mats) materials.set(scene, (mats = new Map()));
  const mat = (key: string, hex: string) => {
    let m = mats.get(key);
    if (m) return m;
    m = new StandardMaterial(`canopy_${key}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.1, 0.1, 0.1);
    m.backFaceCulling = false;
    mats.set(key, m);
    return m;
  };
  const rig = new Color4(0.15, 0.15, 0.15, 1);
  if (kind === CHUTE_GLIDER) {
    // A hang-glider wing above the shoulders: a flat triangle, nose forward.
    const wing = CreateCylinder(`${name}_wing`, { diameter: 6.4, height: 0.06, tessellation: 3 }, scene);
    wing.parent = root;
    wing.rotation.y = -Math.PI / 2;
    wing.position.set(0, 2.9, -0.4);
    wing.scaling.set(1, 1, 0.75);
    wing.material = mat('wing', '#e2703a');
    const keel = CreateCylinder(`${name}_keel`, { diameter: 0.08, height: 3.4, tessellation: 6 }, scene);
    keel.parent = root;
    keel.rotation.x = Math.PI / 2;
    keel.position.set(0, 2.85, -0.4);
    keel.material = mat('keel', '#2a2d33');
    const lines = CreateLineSystem(`${name}_frame`, {
      lines: [
        [new Vector3(-0.55, 1.6, 0.35), new Vector3(0.55, 1.6, 0.35)],
        [new Vector3(-0.55, 1.6, 0.35), new Vector3(0, 2.85, 0.2)],
        [new Vector3(0.55, 1.6, 0.35), new Vector3(0, 2.85, 0.2)],
      ],
      colors: [[rig, rig], [rig, rig], [rig, rig]],
    }, scene);
    lines.parent = root;
  } else {
    // A round canopy hung from the harness point behind the neck (the rig: placeCanopy sways it there).
    const hang = new TransformNode(`${name}_rig`, scene);
    hang.parent = root;
    hang.position.set(0, HARNESS.up, -HARNESS.back);
    const shape = parachuteShape();
    const fabric = new Mesh(`${name}_dome`, scene);
    shape.fabric.applyToMesh(fabric);
    fabric.parent = hang;
    let cloth = mats.get('fabric');
    if (!cloth) {
      // One material for the whole canopy: the panels' colours are in the vertices. Outside and inside are separate
      // faces (the inside darker), so back faces are culled.
      cloth = new StandardMaterial('canopy_fabric', scene);
      cloth.diffuseColor = Color3.White();
      cloth.specularColor = new Color3(0.06, 0.06, 0.06);
      cloth.emissiveColor = new Color3(0.16, 0.16, 0.16);
      mats.set('fabric', cloth);
    }
    fabric.material = cloth;
    const rigging = CreateLineSystem(`${name}_lines`, { lines: shape.lines, colors: shape.lines.map(() => [LINE, LINE]) }, scene);
    rigging.parent = hang;
    root.metadata = { rig: hang };
  }
  for (const m of root.getChildMeshes()) m.isPickable = false;
  return root;
}

/** Where a parachute's risers meet on its wearer: this high over the feet and this far behind the body's middle (m). */
export interface CanopyHarness {
  up: number;
  back: number;
}
/** The harness point of a standard 1.8 m body: behind the neck. */
const HARNESS: CanopyHarness = { up: 1.48, back: 0.17 };

/**
 * A character's harness point from its measured shapes (the hitbox of its look, at its size): between the top of
 * the torso and the underside of the head, just behind the back. Shapes without a head or torso: a standard body's.
 */
export function canopyHarness({ box, scale }: { box: LookHitbox; scale: number }): CanopyHarness {
  const { head, torso } = box.stand;
  if (!head || !torso) return { up: HARNESS.up * scale, back: HARNESS.back * scale };
  const up = (torso.b[0] + Math.max(torso.b[0], head.y - head.r)) / 2;
  const back = torso.r + 0.05 - Math.min(torso.b[1], head.z);
  return { up: up * scale, back: Math.max(0.08, back) * scale };
}

/**
 * Put a canopy over its wearer (feet `pos`, facing `yaw`; a parachute hooked on at `harness`) with a slow sway and
 * a little breathing, so it reads as fabric in the wind: a few degrees over several seconds, from the time and the
 * wearer's slot alone (halved with Reduce flashing on).
 */
export function placeCanopy(node: TransformNode, pos: { x: number; y: number; z: number }, yaw: number, now: number, seed: number, harness: CanopyHarness = HARNESS): void {
  node.position.set(pos.x, pos.y, pos.z);
  const rig = (node.metadata as { rig?: TransformNode } | null)?.rig;
  if (!rig) {
    node.rotation.set(Math.sin(now / 900 + seed * 1.7) * 0.04, yaw, Math.sin(now / 700 + seed) * 0.06);
    return;
  }
  // The parachute: the root only turns with the wearer; the rig swings about the harness point behind the neck.
  node.rotation.set(0, yaw, 0);
  rig.position.set(0, harness.up, -harness.back);
  const calm = reduceFlashing() ? 0.5 : 1;
  rig.rotation.set(Math.sin(now / 1400 + seed * 1.7) * 0.035 * calm, Math.sin(now / 2600 + seed * 0.9) * 0.05 * calm, Math.sin(now / 1100 + seed) * 0.05 * calm);
  const breath = Math.sin(now / 950 + seed * 2.3) * 0.012 * calm;
  rig.scaling.set(1 + breath, 1 - breath * 0.6, 1 + breath);
}

/** The rigging lines' colour. */
const LINE = new Color4(0.17, 0.17, 0.19, 1);
/** Gores round the canopy (a suspension line on every seam). */
const GORES = 16;
/** The canopy's radius at the skirt and its height from skirt to crown (m): a shallow dome. */
const RADIUS = 2.8;
const CROWN = 1.5;
/** The skirt's height over the harness point (m). */
const SKIRT_UP = 3.7;
/** Rings from the vent's edge to the skirt, as angles from the crown (rad; past 90° the skirt turns in a little). */
const RINGS = [0.086, 0.5, 0.88, 1.22, 1.5, 1.72];
/** Pieces across a gore in each band between two rings: more toward the skirt, where the cloth billows between the lines. */
const ACROSS = [1, 1, 1, 2, 4];
/** How far the middle of a gore billows out past its seams at each ring, and how far the hem rises there (the scallops; m). */
const BILLOW = [0, 0, 0, 0, 0.09, 0.15];
const SCALLOP = 0.24;
/** Panel colours: orange and cream gores under a navy crown; the seams, the webbing, and how dark the inside is. */
const PANELS = ['#e8552b', '#f4ecd9'].map((h) => Color3.FromHexString(h));
const CROWN_COLOR = Color3.FromHexString('#23375c');
const SEAM = Color3.FromHexString('#3a2a26');
const WEBBING = Color3.FromHexString('#2a2d33');
const INSIDE = 0.7;
/** Where the four risers end and the lines begin, from the harness point: this far to each side, up, and front / back. */
const LINK = { x: 0.34, y: 0.85, front: 0.02, back: -0.26 };

let parachute: { fabric: VertexData; lines: Vector3[][] } | undefined;

/**
 * The parachute's shape, worked out once and shared by every canopy: the fabric (outside, inside, seams, risers and
 * the harness yoke in one mesh, coloured by vertex) and the suspension lines, about the harness point.
 */
function parachuteShape(): { fabric: VertexData; lines: Vector3[][] } {
  if (parachute) return parachute;
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const vert = (p: Vector3, n: Vector3, c: Color3, shade = 1): number => {
    positions.push(p.x, p.y, p.z);
    normals.push(n.x, n.y, n.z);
    colors.push(c.r * shade, c.g * shade, c.b * shade, 1);
    return positions.length / 3 - 1;
  };
  /** A triangle whose front faces along `out` (whichever way round its corners were given). */
  const tri = (a: number, b: number, c: number, out: Vector3): void => {
    const at = (i: number) => new Vector3(positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!);
    const [pa, pb, pc] = [at(a), at(b), at(c)];
    const face = Vector3.Cross(pb.subtract(pa), pc.subtract(pa));
    // (Babylon's front faces are the ones whose corners run clockwise: their cross product points away.)
    if (Vector3.Dot(face, out) > 0) indices.push(a, c, b);
    else indices.push(a, b, c);
  };
  const seamAt = (gore: number, ring: number): Vector3 => {
    const a = ((gore + 0.5) / GORES) * Math.PI * 2;
    const r = RADIUS * Math.sin(RINGS[ring]!);
    return new Vector3(Math.sin(a) * r, SKIRT_UP + CROWN * Math.cos(RINGS[ring]!), Math.cos(a) * r);
  };
  /** A point on gore `gore` at ring `ring`, `u` of the way from its seam to the next. */
  const at = (gore: number, ring: number, u: number): Vector3 => {
    const p = Vector3.Lerp(seamAt(gore, ring), seamAt(gore + 1, ring), u);
    // Billowing: a curve at the skirt; one ring up, straight from each seam to the middle (the band above has two pieces).
    const bow = ring === RINGS.length - 1 ? 4 * u * (1 - u) : 1 - Math.abs(2 * u - 1);
    const out = BILLOW[ring]! * bow;
    const flat = Math.hypot(p.x, p.z) || 1;
    p.x += (p.x / flat) * out;
    p.z += (p.z / flat) * out;
    if (ring === RINGS.length - 1) p.y += SCALLOP * bow;
    return p;
  };
  // The cloth's normals: each point's, averaged over the faces that meet there, so panels shade smoothly into each other.
  const key = (p: Vector3) => `${Math.round(p.x * 500)},${Math.round(p.y * 500)},${Math.round(p.z * 500)}`;
  const smooth = new Map<string, Vector3>();
  const quads: { corners: Vector3[]; gore: number; band: number }[] = [];
  for (let gore = 0; gore < GORES; gore++) {
    for (let band = 0; band < ACROSS.length; band++) {
      const n = ACROSS[band]!;
      for (let k = 0; k < n; k++) {
        const corners = [at(gore, band, k / n), at(gore, band, (k + 1) / n), at(gore, band + 1, (k + 1) / n), at(gore, band + 1, k / n)];
        quads.push({ corners, gore, band });
        const up = new Vector3(corners[0]!.x + corners[2]!.x, 0.6, corners[0]!.z + corners[2]!.z);
        for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]] as const) {
          const face = Vector3.Cross(corners[b]!.subtract(corners[a]!), corners[c]!.subtract(corners[a]!));
          if (Vector3.Dot(face, up) < 0) face.scaleInPlace(-1);
          for (const i of [a, b, c]) {
            const sum = smooth.get(key(corners[i]!));
            if (sum) sum.addInPlace(face);
            else smooth.set(key(corners[i]!), face.clone());
          }
        }
      }
    }
  }
  for (const n of smooth.values()) n.normalize();
  const normalAt = (p: Vector3) => smooth.get(key(p))!;
  for (const { corners, gore, band } of quads) {
    const color = band === 0 ? CROWN_COLOR : PANELS[gore % PANELS.length]!;
    // Outside, then inside (the same cloth facing down, darker).
    for (const side of [1, -1]) {
      const v = corners.map((p) => vert(p, normalAt(p).scale(side), color, side > 0 ? 1 : INSIDE));
      const out = normalAt(corners[0]!).add(normalAt(corners[2]!)).scale(side);
      tri(v[0]!, v[1]!, v[2]!, out);
      tri(v[0]!, v[2]!, v[3]!, out);
    }
  }
  // Seams: a thin darker tape along each one, just proud of the cloth.
  for (let gore = 0; gore < GORES; gore++) {
    const a = ((gore + 0.5) / GORES) * Math.PI * 2;
    const across = new Vector3(Math.cos(a), 0, -Math.sin(a)).scale(0.028);
    let last: number[] | undefined;
    for (let ring = 0; ring < RINGS.length; ring++) {
      const p = seamAt(gore, ring);
      const n = normalAt(p);
      const mid = p.add(n.scale(0.012));
      const pair = [vert(mid.subtract(across), n, SEAM), vert(mid.add(across), n, SEAM)];
      if (last) {
        tri(last[0]!, last[1]!, pair[1]!, n);
        tri(last[0]!, pair[1]!, pair[0]!, n);
      }
      last = pair;
    }
  }
  // Risers: four straps of webbing from the yoke behind the neck up to the links the lines are tied to.
  const links = [-1, 1].flatMap((side) => [LINK.front, LINK.back].map((z) => new Vector3(side * LINK.x, LINK.y, z)));
  const prism = (from: Vector3, to: Vector3, wide: number, sides: number): void => {
    const along = to.subtract(from).normalize();
    const u = Vector3.Cross(along, Math.abs(along.y) > 0.9 ? Vector3.Right() : Vector3.Up()).normalize();
    const w = Vector3.Cross(along, u);
    const ring = (p: Vector3, n: Vector3) => vert(p.add(n.scale(wide)), n, WEBBING);
    for (let i = 0; i < sides; i++) {
      const [a0, a1] = [(i / sides) * Math.PI * 2, ((i + 1) / sides) * Math.PI * 2];
      const [n0, n1] = [a0, a1].map((t) => u.scale(Math.cos(t)).add(w.scale(Math.sin(t))));
      const out = n0!.add(n1!);
      const v = [ring(from, n0!), ring(from, n1!), ring(to, n1!), ring(to, n0!)];
      tri(v[0]!, v[1]!, v[2]!, out);
      tri(v[0]!, v[2]!, v[3]!, out);
    }
  };
  for (const link of links) prism(new Vector3(Math.sign(link.x) * 0.05, 0, 0), link, 0.012, 3);
  // The yoke: a short bar of webbing across the back of the neck.
  prism(new Vector3(-0.09, 0, 0), new Vector3(0.09, 0, 0), 0.03, 4);
  const fabric = new VertexData();
  fabric.positions = positions;
  fabric.normals = normals;
  fabric.colors = colors;
  fabric.indices = indices;
  // Lines: from every seam's end on the skirt to the nearest riser's link.
  const lines: Vector3[][] = [];
  for (let gore = 0; gore < GORES; gore++) {
    const hem = seamAt(gore, RINGS.length - 1);
    const link = links.find((l) => Math.sign(l.x) === Math.sign(hem.x) && (l.z === LINK.front) === hem.z > 0)!;
    lines.push([link, hem]);
  }
  parachute = { fabric, lines };
  return parachute;
}
