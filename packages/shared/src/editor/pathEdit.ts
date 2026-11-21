import type { MapPath } from '../map/schema.ts';
import type { TerrainData } from '../map/terrain.ts';
import { pathGeometry, trackPointAt } from '../map/track.ts';

/** A path is never set shorter than this (m): two points this far apart still draw. */
export const PATH_MIN_LENGTH = 2;
const MAX_POINTS = 200;

const lengthOf = (path: MapPath, points: [number, number, number][]): number => pathGeometry({ ...path, points }).length;

/**
 * The path made `length` metres long (along its curve, as the Paths pane shows it) at its last point: shorter, it
 * ends where its own line was that far along (the points past there go); longer, it runs straight on from its end
 * (one more point; the last point is moved instead when it is only a little). `terrain`: the new end sits on it.
 * A loop has no end to move.
 */
export function pathWithLength(path: MapPath, length: number, terrain: TerrainData | null = null): MapPath | { error: string } {
  if (path.closed) return { error: 'a loop has no end to move: open it first' };
  if (!Number.isFinite(length) || length < PATH_MIN_LENGTH) return { error: `a path is at least ${PATH_MIN_LENGTH} m long` };
  const g = pathGeometry(path);
  if (Math.abs(g.length - length) < 0.05) return path;
  const pts = path.points;
  let kept: [number, number, number][];
  /** The new end is `base` + `dir` × d, d found below. */
  let base: [number, number, number];
  let dir: [number, number];
  let reach: number;
  if (length < g.length) {
    // Shorter: the points before the cut stay; the end goes on the line from the last of them to where the cut was.
    const along = pts.map((q, i) => (i === 0 ? 0 : (g.nearest(q[0], q[2], 8)?.sample.s ?? g.length)));
    let n = 1;
    while (n < pts.length - 1 && along[n]! < length - 0.5) n++;
    kept = pts.slice(0, n);
    const cut = g.at(length);
    base = kept[kept.length - 1]!;
    const dx = cut.x - base[0];
    const dz = cut.z - base[2];
    const l = Math.hypot(dx, dz);
    dir = l > 1e-6 ? [dx / l, dz / l] : [g.at(length).dx, g.at(length).dz];
    reach = l + length;
  } else {
    const end = g.at(g.length);
    const last = pts[pts.length - 1]!;
    const more = length - g.length;
    const prev = pts[pts.length - 2]!;
    // A little longer: the last point moves out. More than that: the path keeps its shape and gains a point.
    if (more < 2 || more < Math.hypot(last[0] - prev[0], last[2] - prev[2]) * 0.5) {
      kept = pts.slice(0, -1);
      base = prev;
      const dx = last[0] - prev[0];
      const dz = last[2] - prev[2];
      const l = Math.hypot(dx, dz) || 1;
      dir = [dx / l, dz / l];
      reach = l + more * 2 + 4;
    } else {
      if (pts.length >= MAX_POINTS) return { error: `a path has at most ${MAX_POINTS} points` };
      kept = [...pts];
      base = last;
      dir = [end.dx, end.dz];
      reach = more * 2 + 4;
    }
  }
  const endAt = (d: number): [number, number, number] => trackPointAt(terrain, base[0] + dir[0] * d, base[1], base[2] + dir[1] * d);
  // The curve's length grows with how far out the end is: halve the range until it is the length asked for.
  let lo = 0.25;
  let hi = Math.max(reach, 1);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const l = lengthOf(path, [...kept, endAt(mid)]);
    if (Math.abs(l - length) < 0.02) {
      lo = hi = mid;
      break;
    }
    if (l < length) lo = mid;
    else hi = mid;
  }
  return { ...path, points: [...kept, endAt((lo + hi) / 2)] };
}
