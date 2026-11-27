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
/** Orange: a calm, steady colour (no blinking, nothing bright: Reduce flashing). */
const MARK_COLOR = '#e8780e';

/** One face of a breakable wall box: its four corners (in order round it), its span along the wall and up, and its plane. */
export interface MarkFace {
  corners: [P3, P3, P3, P3];
  width: number;
  height: number;
  /** Which world axis the wall runs along ('x': a face at constant z), where its face plane is, and its section. */
  along: 'x' | 'z';
  plane: number;
  u0: number;
  u1: number;
  y0: number;
  y1: number;
  k: number;
}

/**
 * A face narrower or shorter than this (an arch's thin slices, a sliver beside a window) is only inside its wall's
 * outline: tinting and hatching each slice stacked up into a busy, dark patch.
 */
export const MARK_MIN = 0.25;
export const markedFace = (f: MarkFace): boolean => f.width >= MARK_MIN && f.height >= MARK_MIN;

/** Spacing of the diagonal hatching across a marked wall, in metres (along the wall). */
export const MARK_HATCH = 0.7;

const point = (along: 'x' | 'z', u: number, y: number, plane: number): P3 => (along === 'x' ? [u, y, plane] : [plane, y, u]);

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
    const along: 'x' | 'z' = x1 - x0 >= z1 - z0 ? 'x' : 'z';
    const [u0, u1, p0, p1] = along === 'x' ? [x0, x1, z0, z1] : [z0, z1, x0, x1];
    for (const plane of [p0 - MARK_LIFT, p1 + MARK_LIFT]) {
      out.push({ corners: [point(along, u0, y0, plane), point(along, u1, y0, plane), point(along, u1, y1, plane), point(along, u0, y1, plane)], width: u1 - u0, height: h, along, plane, u0, u1, y0, y1, k: b.breakWall });
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

/**
 * Diagonal hatching on a face: lines u + y = c (c a whole number of MARK_HATCH steps, so the lines run on from one box
 * of a wall to the next), clipped to the face.
 */
export function hatchLines(f: MarkFace, step = MARK_HATCH): [P3, P3][] {
  const out: [P3, P3][] = [];
  if (!markedFace(f)) return out;
  for (let c = Math.ceil((f.u0 + f.y0) / step) * step; c <= f.u1 + f.y1; c += step) {
    // Where u + y = c meets the face: u from max(u0, c - y1) to min(u1, c - y0).
    const ua = Math.max(f.u0, c - f.y1);
    const ub = Math.min(f.u1, c - f.y0);
    if (ub - ua < 0.05) continue;
    out.push([point(f.along, ua, c - ua, f.plane), point(f.along, ub, c - ub, f.plane)]);
  }
  return out;
}

/**
 * The outline of each marked wall face: one dashed rectangle round all the boxes of a section on one side of it (so a
 * wall with a window in it is outlined once, round the whole, not round each piece of it).
 */
export function sectionOutlines(faces: readonly MarkFace[]): [P3, P3, P3, P3][] {
  const groups = new Map<string, MarkFace[]>();
  for (const f of faces) {
    const key = `${f.k}:${f.along}:${f.plane.toFixed(2)}`;
    const g = groups.get(key);
    if (g) g.push(f);
    else groups.set(key, [f]);
  }
  return [...groups.values()].map((g) => {
    const { along, plane } = g[0]!;
    const u0 = Math.min(...g.map((f) => f.u0));
    const u1 = Math.max(...g.map((f) => f.u1));
    const y0 = Math.min(...g.map((f) => f.y0));
    const y1 = Math.max(...g.map((f) => f.y1));
    return [point(along, u0, y0, plane), point(along, u1, y0, plane), point(along, u1, y1, plane), point(along, u0, y1, plane)];
  });
}

/** The line segments of the marks: each section's dashed outline and the hatching across its faces. */
export function breakWallMarkLines(faces: readonly MarkFace[]): [P3, P3][] {
  const outlines = sectionOutlines(faces).flatMap((c) => c.flatMap((p, i) => dashes(p, c[(i + 1) % 4]!)));
  return [...outlines, ...faces.flatMap((f) => hatchLines(f))];
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
 * orange tint and diagonal hatching on every breakable wall face and a steady dashed outline round each wall, so which walls break shows without
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
    for (const f of faces.filter(markedFace)) {
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
    mat.alpha = 0.22;
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
