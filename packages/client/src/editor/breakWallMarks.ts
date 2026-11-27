import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import type { Scene } from '@babylonjs/core/scene';
import type { WorldBox } from '@tiletrigger/shared';

type P3 = [number, number, number];

/** How far off the wall's face the mark sits (clear of z-fighting, inside the trim). */
export const MARK_LIFT = 0.025;
/** The dashed outline: dash and gap along each edge, in metres. */
export const MARK_DASH = 0.35;
export const MARK_GAP = 0.2;
/** Amber: a calm, steady colour (no blinking, nothing bright: Reduce flashing). */
const MARK_COLOR = '#f0a830';

/** One face of a breakable wall box: its four corners (in order round it), and its width and height. */
export interface MarkFace {
  corners: [P3, P3, P3, P3];
  width: number;
  height: number;
}

/**
 * The faces MapMaker marks on breakable walls (format v54; shared map/geometry.ts tags a breakable side's wall boxes
 * `breakWall`): both big faces of every such wall box, lifted a little off it. Trim is left out (its wall says it), and
 * so is a turned box (side walls never are).
 */
export function breakWallMarkFaces(boxes: readonly WorldBox[]): MarkFace[] {
  const out: MarkFace[] = [];
  for (const b of boxes) {
    if (b.breakWall === undefined || b.kind !== 'wall' || b.yaw || b.pitch || b.roll) continue;
    const [x0, y0, z0] = b.min;
    const [x1, y1, z1] = b.max;
    const h = y1 - y0;
    if (h <= 0.01) continue;
    // The wall runs along its longer side; it is marked on both faces across its thickness.
    if (x1 - x0 >= z1 - z0) {
      for (const z of [z0 - MARK_LIFT, z1 + MARK_LIFT]) out.push({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], width: x1 - x0, height: h });
    } else {
      for (const x of [x0 - MARK_LIFT, x1 + MARK_LIFT]) out.push({ corners: [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]], width: z1 - z0, height: h });
    }
  }
  return out;
}

/** A dashed line from a to b: the dashes as segments, stretched a little so one starts and one ends at each corner. */
export function dashes(a: P3, b: P3, dash = MARK_DASH, gap = MARK_GAP): [P3, P3][] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const out: [P3, P3][] = [];
  if (len <= 0) return out;
  const n = Math.max(1, Math.round((len + gap) / (dash + gap)));
  const k = len / (n * dash + (n - 1) * gap);
  const at = (s: number): P3 => [a[0] + ((b[0] - a[0]) * s) / len, a[1] + ((b[1] - a[1]) * s) / len, a[2] + ((b[2] - a[2]) * s) / len];
  for (let i = 0; i < n; i++) {
    const s = i * (dash + gap) * k;
    out.push([at(s), at(i === n - 1 ? len : s + dash * k)]);
  }
  return out;
}

/** The line segments of the marks: each face's dashed outline. */
export function breakWallMarkLines(faces: readonly MarkFace[]): [P3, P3][] {
  return faces.flatMap((f) => f.corners.flatMap((c, i) => dashes(c, f.corners[(i + 1) % 4]!)));
}

/** A key for the marked boxes, so the marks are only built again when they change. */
export function breakWallMarkKey(boxes: readonly WorldBox[]): string {
  return boxes
    .filter((b) => b.breakWall !== undefined && b.kind === 'wall')
    .map((b) => `${b.breakWall}:${b.min.join(',')}:${b.max.join(',')}`)
    .join(';');
}

/**
 * MapMaker's breakable-wall mark (owner, 2026-11-26, QUEUE "Breakable walls: a mark in MapMaker's 3D view"): a faint
 * amber tint on every breakable wall face and a steady dashed outline round it, so which walls break shows without
 * opening the inspector. Editor-only (game/view.ts never builds it): not in play, Test or a map's picture. Drawn
 * with the level's depth (a wall in front hides it), never blinking.
 */
export class BreakWallMarks {
  private tint?: Mesh;
  private lines?: LinesMesh;
  private key = '';
  private on = true;
  private hidden = false;

  constructor(private readonly scene: Scene) {}

  /** The meshes (for photo mode and tests). */
  get meshes(): (Mesh | LinesMesh)[] {
    return [this.tint, this.lines].filter((m): m is Mesh | LinesMesh => !!m);
  }

  /** Marked faces drawn now. */
  count = 0;

  /** The level's boxes as shown (EditorView.setMap): marks for the breakable walls among them. */
  update(boxes: readonly WorldBox[]): void {
    const key = breakWallMarkKey(boxes);
    if (key === this.key) return;
    this.key = key;
    this.dispose();
    const faces = breakWallMarkFaces(boxes);
    this.count = faces.length;
    if (!faces.length) return;
    const positions: number[] = [];
    const indices: number[] = [];
    for (const f of faces) {
      const base = positions.length / 3;
      for (const c of f.corners) positions.push(...c);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const tint = new Mesh('edBreakWallTint', this.scene);
    const vd = new VertexData();
    vd.positions = positions;
    vd.indices = indices;
    vd.applyToMesh(tint);
    const mat = new StandardMaterial('edBreakWallTintMat', this.scene);
    mat.diffuseColor = Color3.Black();
    mat.emissiveColor = Color3.FromHexString(MARK_COLOR);
    mat.specularColor = Color3.Black();
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.alpha = 0.16;
    tint.material = mat;
    tint.isPickable = false;
    const c = Color3.FromHexString(MARK_COLOR);
    const segs = breakWallMarkLines(faces);
    const lines = CreateLineSystem('edBreakWallLines', { lines: segs.map(([a, b]) => [new Vector3(...a), new Vector3(...b)]), colors: segs.map(() => [new Color4(c.r, c.g, c.b, 0.9), new Color4(c.r, c.g, c.b, 0.9)]), useVertexAlpha: true }, this.scene);
    lines.isPickable = false;
    this.tint = tint;
    this.lines = lines;
    this.apply();
  }

  /** View → Breakable walls. */
  setOn(on: boolean): void {
    this.on = on;
    this.apply();
  }

  get shown(): boolean {
    return this.on;
  }

  /** Hidden for a while (photo mode, the Tiles layer off), whatever View says. */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.apply();
  }

  private apply(): void {
    for (const m of this.meshes) m.setEnabled(this.on && !this.hidden);
  }

  dispose(): void {
    this.tint?.material?.dispose();
    this.tint?.dispose();
    this.lines?.dispose();
    this.tint = undefined;
    this.lines = undefined;
    this.count = 0;
  }
}
