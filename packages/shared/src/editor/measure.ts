import type { Vec3 } from '../math.ts';
import type { WorldBox } from '../map/geometry.ts';
import { PLAYER, SPRINT } from '../sim/constants.ts';
import type { TerrainData } from '../map/terrain.ts';
import { restUnder, type SurfaceHit } from './surfaceSnap.ts';

/**
 * MapMaker's measure tool (overhaul Phase 1, item 3): the maths. Points are where the pointer met the map
 * (surfaceSnap.ts), snapped to the grid, to surfaces and to objects' tops. Measurements are editor-only: nothing here
 * goes into the map file.
 */

/** One stretch of a measurement, from `a` to `b`. */
export interface MeasureSegment {
  a: Vec3;
  b: Vec3;
  /** Straight-line length (m). */
  distance: number;
  /** Across the ground, ignoring height (m). */
  run: number;
  /** Height difference, b above a (m; negative: b is lower). */
  rise: number;
  /** Slope from a to b, degrees (0 flat, 90 straight up; negative going down). */
  slopeDeg: number;
  /** The same slope in percent (rise over run × 100); null for a straight drop or climb (run 0). */
  slopePct: number | null;
  /** Could a player get from a to b on foot: walk, jump, or not (jumpVerdict). */
  verdict: JumpVerdict;
}

/** A measurement: its stretches and their total length. */
export interface Measurement {
  segments: MeasureSegment[];
  /** Sum of the stretches' lengths (m). */
  total: number;
}

export function measureSegment(a: Vec3, b: Vec3): MeasureSegment {
  const run = Math.hypot(b.x - a.x, b.z - a.z);
  const rise = b.y - a.y;
  const distance = Math.hypot(run, rise);
  const slopeDeg = run < 1e-9 && Math.abs(rise) < 1e-9 ? 0 : (Math.atan2(rise, run) * 180) / Math.PI;
  const slopePct = run < 1e-9 ? null : (rise / run) * 100;
  return { a, b, distance, run, rise, slopeDeg, slopePct, verdict: jumpVerdict(run, rise) };
}

/** A path of points (a third click chains): every stretch, and the total. */
export function measurePath(points: readonly Vec3[]): Measurement {
  const segments: MeasureSegment[] = [];
  for (let i = 1; i < points.length; i++) segments.push(measureSegment(points[i - 1]!, points[i]!));
  return { segments, total: segments.reduce((s, x) => s + x.distance, 0) };
}

/**
 * The movement numbers (sim/constants.ts PLAYER and SPRINT, as sim/movement.ts uses them), for a standard body at
 * normal gravity: how high a jump lifts your feet, and how far a sprinting jump carries you to a ledge `rise` higher.
 */
export const PLAYER_JUMP = {
  /** Highest a jump lifts your feet: jumpSpeed² / 2g (m). */
  height: (PLAYER.jumpSpeed * PLAYER.jumpSpeed) / (2 * PLAYER.gravity),
  /** What you walk up without jumping (m). */
  step: PLAYER.maxStepHeight,
  /** Sprinting speed (m/s). */
  speed: PLAYER.runSpeed * SPRINT.speed,
};

/** How far (m, across the ground) a sprinting jump carries you while landing `rise` higher (or lower); null when it can't reach that high. */
export function jumpReach(rise: number): number | null {
  const v = PLAYER.jumpSpeed;
  const g = PLAYER.gravity;
  const disc = v * v - 2 * g * rise;
  if (disc < 0) return null;
  // On the way down through that height (the later of the two times the feet are there).
  const t = (v + Math.sqrt(disc)) / g;
  // A body's width helps: you land with your front edge on the ledge.
  return PLAYER_JUMP.speed * t + PLAYER.radius;
}

/**
 * Could a player get from a to b on foot, treating the stretch as a step up (or down) and a gap across:
 * - `step`: 'walk' (no higher than a step), 'jumpable' (a jump lifts you that high), 'too high', or 'drop' (down,
 *   further than a step: you can always drop; the fall may hurt);
 * - `gap`: whether a sprinting jump carries you that far across to that height ('jumpable' or 'too far'), with its
 *   `reach`; null when the step is too high to jump at all.
 * It knows only the two ends, not what lies between (a slope you walk up reads as a step and a gap).
 */
export interface JumpVerdict {
  step: 'walk' | 'jumpable' | 'too high' | 'drop';
  gap: 'jumpable' | 'too far' | null;
  /** How far a sprinting jump carries you to that height (m), or null. */
  reach: number | null;
}

export function jumpVerdict(run: number, rise: number): JumpVerdict {
  const reach = jumpReach(rise);
  const step: JumpVerdict['step'] = rise > PLAYER_JUMP.height + 1e-9 ? 'too high' : rise > PLAYER_JUMP.step + 1e-9 ? 'jumpable' : rise < -PLAYER_JUMP.step - 1e-9 ? 'drop' : 'walk';
  const gap = reach === null ? null : run <= reach + 1e-9 ? 'jumpable' : 'too far';
  return { step, gap, reach };
}

/** The verdict in words: "step jumpable · gap jumpable (5.9 m at most)". */
export function describeVerdict(v: JumpVerdict): string {
  const step = v.step === 'walk' ? 'step walkable' : v.step === 'drop' ? 'a drop' : v.step === 'jumpable' ? 'step jumpable' : `too high (a jump lifts ${formatLength(PLAYER_JUMP.height)})`;
  if (v.gap === null || v.reach === null) return step;
  return `${step} · gap ${v.gap === 'jumpable' ? 'jumpable' : 'too far'} (${formatLength(v.reach)} at most)`;
}

/** A measurement point's snap: where a click lands, and what it snapped to (the tool says so). */
export interface MeasurePoint {
  at: Vec3;
  snapped: 'grid' | 'top' | 'object' | 'free';
}

/**
 * Snap a point the pointer met (surfaceHit) for measuring.
 * - An object's top (a prop or block, `isObject`): its top's middle.
 * - A surface's top or the ground: x and z to the grid step (`step` m; cell corners and middles are on it), then the
 *   height of what is under the snapped spot (the same top, or the ground).
 * - A side (a wall face): kept where it was hit, its height to the step (a wall's height in whole steps).
 * `free` (Ctrl or Alt) keeps the point as hit.
 */
export function snapMeasurePoint(hit: SurfaceHit, boxes: readonly WorldBox[], ground: TerrainData | null, step: number, free: boolean, isObject: (sourceId: string) => boolean = () => false): MeasurePoint {
  const r = (v: number) => Math.round(v * 1000) / 1000 + 0;
  const p = hit.point;
  if (free || step <= 0) return { at: { x: r(p.x), y: r(p.y), z: r(p.z) }, snapped: 'free' };
  const s = (v: number) => Math.round(v / step) * step;
  if (hit.box && hit.on === 'top' && isObject(hit.box.sourceId)) {
    const b = hit.box;
    return { at: { x: r((b.min[0] + b.max[0]) / 2), y: r(b.max[1]), z: r((b.min[2] + b.max[2]) / 2) }, snapped: 'object' };
  }
  if (hit.on === 'side') return { at: { x: r(p.x), y: r(s(p.y)), z: r(p.z) }, snapped: 'grid' };
  const x = s(p.x);
  const z = s(p.z);
  const rest = restUnder(boxes, ground, x, z, p.y + 0.01);
  return { at: { x: r(x), y: r(rest?.y ?? p.y), z: r(z) }, snapped: hit.on === 'top' ? 'top' : 'grid' };
}

/** A length for the tool's labels: centimetres under a metre, else metres to one decimal place (two under 10 m). */
export function formatLength(m: number): string {
  const a = Math.abs(m);
  if (a < 1) return `${Math.round(m * 100)} cm`;
  return `${m.toFixed(a < 10 ? 2 : 1)} m`;
}

/** One stretch in words: "6.32 m · up 1.20 m · 11.0° (19.4 %) · step jumpable · gap …". */
export function describeSegment(s: MeasureSegment): string {
  const p = segmentParts(s);
  return `${p.length} · ${p.rise} · ${p.slope} · ${describeVerdict(s.verdict)}`;
}

/** A stretch's words in parts, for the tool's labels on the view: the length, the rise, the slope, and the verdict in a word. */
export function segmentParts(s: MeasureSegment): { length: string; rise: string; slope: string; verdict: string } {
  const rise = Math.abs(s.rise) < 0.005 ? 'level' : `${s.rise > 0 ? 'up' : 'down'} ${formatLength(Math.abs(s.rise))}`;
  const slope = s.slopePct === null ? (Math.abs(s.rise) < 0.005 ? '0°' : `${s.rise > 0 ? '' : '-'}90°`) : `${s.slopeDeg.toFixed(1)}° (${Math.round(s.slopePct * 10) / 10} %)`;
  const v = s.verdict;
  const verdict = v.step === 'too high' ? 'too high' : v.gap === 'too far' ? 'too far to jump' : v.step === 'drop' ? 'a drop' : v.step === 'walk' ? 'walkable' : 'jumpable';
  return { length: formatLength(s.distance), rise, slope, verdict };
}
