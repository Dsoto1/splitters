import { isDrawnBox, visibleFaces, type RenderFace } from './faces.ts';
import type { WorldBox } from './geometry.ts';

/**
 * The drawn faces of a box list, kept between edits (MapMaker): after an edit, only the boxes near what changed are
 * clipped again; every other box keeps the faces it had.
 *
 * A box's faces depend only on the boxes it touches (visibleFaces cuts a face where another box covers it, backs onto
 * it or shares its plane), so a box that touches nothing that changed, before or after, draws exactly what it drew.
 * The boxes that do (`again`) are clipped among everything that touches them, in the list's own order (ties between
 * coplanar faces go by it).
 */
export interface FaceCache {
  boxes: readonly WorldBox[];
  faces: RenderFace[];
  /** Each box's faces (indices into `faces`), by the box's index. */
  byBox: number[][];
  /** What the last update did: the boxes clipped again (all of them after a full pass). */
  redone: number;
  full: boolean;
  /** The faces differ from the list before's (false: only what draws nothing changed, or the boxes' order in the list). */
  changed: boolean;
}

/** Touching, with room for visibleFaces' own tolerances (seams, slivers). */
const REACH = 0.05;
/** Past this share of the drawn boxes changed, clip them all (as cheap, and simpler). */
const FULL_SHARE = 0.25;

type Aabb = [number, number, number, number, number, number];

/** A box's bounds in the world: its own, or (turned or tilted) a cube round its centre that holds it however it is turned. */
function worldBounds(b: WorldBox): Aabb {
  if (!b.yaw && !b.pitch && !b.roll) return [b.min[0], b.min[1], b.min[2], b.max[0], b.max[1], b.max[2]];
  const cx = (b.min[0] + b.max[0]) / 2;
  const cy = (b.min[1] + b.max[1]) / 2;
  const cz = (b.min[2] + b.max[2]) / 2;
  const r = Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) / 2;
  return [cx - r, cy - r, cz - r, cx + r, cy + r, cz + r];
}

const touches = (a: Aabb, b: Aabb): boolean => a[0] <= b[3] + REACH && b[0] <= a[3] + REACH && a[1] <= b[4] + REACH && b[1] <= a[4] + REACH && a[2] <= b[5] + REACH && b[2] <= a[5] + REACH;

/** Everything about a box that its faces (and how they are painted) come from. */
function boxKey(b: WorldBox): string {
  return `${b.min[0]},${b.min[1]},${b.min[2]},${b.max[0]},${b.max[1]},${b.max[2]},${b.kind},${b.sourceId},${b.yaw ?? 0},${b.pitch ?? 0},${b.roll ?? 0},${b.surface ? `${b.surface.material}:${b.surface.tint ?? ''}` : ''},${b.roof ? 1 : 0}`;
}

function index(faces: readonly RenderFace[], count: number): number[][] {
  const byBox: number[][] = Array.from({ length: count }, () => []);
  faces.forEach((f, k) => byBox[f.box]!.push(k));
  return byBox;
}

function fullPass(boxes: readonly WorldBox[]): FaceCache {
  const faces = visibleFaces(boxes);
  return { boxes, faces, byBox: index(faces, boxes.length), redone: boxes.length, full: true, changed: true };
}

/**
 * The faces to draw for `boxes` (as visibleFaces gives them, in another order), from the faces of the list before
 * (`prev`, or null: a full pass). The same list again returns `prev` itself.
 */
export function updateVisibleFaces(prev: FaceCache | null, boxes: readonly WorldBox[]): FaceCache {
  if (!prev) return fullPass(boxes);
  if (prev.boxes === boxes) return prev;
  // Pair each drawn box with the same box in the list before (props and barriers draw nothing and hide nothing).
  const before = new Map<string, number[]>();
  let drawnBefore = 0;
  for (let j = prev.boxes.length - 1; j >= 0; j--) {
    const b = prev.boxes[j]!;
    if (!isDrawnBox(b)) continue;
    drawnBefore++;
    const k = boxKey(b);
    const l = before.get(k);
    if (l) l.push(j);
    else before.set(k, [j]);
  }
  const from = new Int32Array(boxes.length).fill(-1);
  const fresh: number[] = [];
  let drawn = 0;
  let last = -1;
  let reordered = false;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]!;
    if (!isDrawnBox(b)) continue;
    drawn++;
    const j = before.get(boxKey(b))?.pop();
    if (j === undefined) fresh.push(i);
    else {
      from[i] = j;
      // Ties between coplanar faces go by the order of the list: boxes that changed places are not worth following.
      if (j < last) reordered = true;
      last = j;
    }
  }
  const gone: number[] = [];
  for (const l of before.values()) gone.push(...l);
  if (reordered || fresh.length + gone.length > Math.max(8, FULL_SHARE * Math.max(drawn, drawnBefore))) return fullPass(boxes);
  if (!fresh.length && !gone.length) {
    // Nothing drawn changed (a prop moved, a spawn was added): the same faces, under the boxes' new indices.
    const faces: RenderFace[] = [];
    for (let i = 0; i < boxes.length; i++) if (from[i]! >= 0) for (const k of prev.byBox[from[i]!]!) faces.push(from[i] === i ? prev.faces[k]! : { ...prev.faces[k]!, box: i });
    return { boxes, faces, byBox: index(faces, boxes.length), redone: 0, full: false, changed: false };
  }
  const changed: Aabb[] = [...fresh.map((i) => worldBounds(boxes[i]!)), ...gone.map((j) => worldBounds(prev.boxes[j]!))];
  // Clipped again: the new boxes, and every box touching where something appeared, went or moved.
  const bounds: (Aabb | null)[] = boxes.map((b) => (isDrawnBox(b) ? worldBounds(b) : null));
  const again = new Uint8Array(boxes.length);
  for (const i of fresh) again[i] = 1;
  const redo: number[] = [];
  for (let i = 0; i < boxes.length; i++) {
    const bb = bounds[i];
    if (!bb) continue;
    if (!again[i] && changed.some((c) => touches(bb, c))) again[i] = 1;
    if (again[i]) redo.push(i);
  }
  if (redo.length > FULL_SHARE * drawn && redo.length > 8) return fullPass(boxes);
  // Among them and everything that touches one of them (which hides and outranks, but keeps its own faces).
  let lo: Aabb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const i of redo) {
    const bb = bounds[i]!;
    lo = [Math.min(lo[0], bb[0]), Math.min(lo[1], bb[1]), Math.min(lo[2], bb[2]), Math.max(lo[3], bb[3]), Math.max(lo[4], bb[4]), Math.max(lo[5], bb[5])];
  }
  const redoBounds = redo.map((i) => bounds[i]!);
  const part: number[] = [];
  for (let i = 0; i < boxes.length; i++) {
    const bb = bounds[i];
    if (!bb) continue;
    if (again[i] || (touches(bb, lo) && redoBounds.some((r) => touches(bb, r)))) part.push(i);
  }
  const partBoxes = part.map((i) => boxes[i]!);
  const clipped = visibleFaces(partBoxes, (k) => again[part[k]!] === 1);
  const faces: RenderFace[] = [];
  for (let i = 0; i < boxes.length; i++) {
    if (again[i] || from[i]! < 0) continue;
    for (const k of prev.byBox[from[i]!]!) faces.push(from[i] === i ? prev.faces[k]! : { ...prev.faces[k]!, box: i });
  }
  for (const f of clipped) faces.push({ ...f, box: part[f.box]! });
  return { boxes, faces, byBox: index(faces, boxes.length), redone: redo.length, full: false, changed: true };
}
