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

/**
 * What the measure tool stands on: the map's boxes as shown (tiles, blocks, solid props) and the ground as shown. With
 * it, each stretch's verdict samples the ground along the line (`profileVerdict`); without it, only the two ends.
 */
export interface MeasureWorld {
  boxes: readonly WorldBox[];
  ground: TerrainData | null;
}

export function measureSegment(a: Vec3, b: Vec3, world?: MeasureWorld): MeasureSegment {
  const run = Math.hypot(b.x - a.x, b.z - a.z);
  const rise = b.y - a.y;
  const distance = Math.hypot(run, rise);
  const slopeDeg = run < 1e-9 && Math.abs(rise) < 1e-9 ? 0 : (Math.atan2(rise, run) * 180) / Math.PI;
  const slopePct = run < 1e-9 ? null : (rise / run) * 100;
  const verdict = world && run >= SAMPLE_STEP ? profileVerdict(sampleProfile(a, b, world)) : jumpVerdict(run, rise);
  return { a, b, distance, run, rise, slopeDeg, slopePct, verdict };
}

/** A path of points (a third click chains): every stretch, and the total. */
export function measurePath(points: readonly Vec3[], world?: MeasureWorld): Measurement {
  const segments: MeasureSegment[] = [];
  for (let i = 1; i < points.length; i++) segments.push(measureSegment(points[i - 1]!, points[i]!, world));
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
 * Could a player get from a to b on foot.
 * - `step`: 'walk' (no higher than a step), 'jumpable' (a jump lifts you that high), 'too high', or 'drop' (down,
 *   further than a step: you can always drop; the fall may hurt);
 * - `gap`: whether a sprinting jump carries you across ('jumpable' or 'too far'), with its `reach`; null when there is
 *   nothing to judge (no gap, or the step is too high to jump at all).
 * Without the map (`jumpVerdict`) it knows only the two ends: the stretch is one step up (or down) and one gap across,
 * so a slope you walk up reads as a step and a gap. With the map (`profileVerdict`, owner 2026-11-08) it samples the
 * ground and surfaces along the line, and `sampled` holds the steepest step up and the widest gap it found.
 */
export interface JumpVerdict {
  step: 'walk' | 'jumpable' | 'too high' | 'drop';
  gap: 'jumpable' | 'too far' | null;
  /** How far a sprinting jump carries you to that height (m), or null. */
  reach: number | null;
  /** From the ground along the line: the steepest step up (m) and the widest gap across (m; null: none). */
  sampled?: { step: number; gap: number | null };
}

export function jumpVerdict(run: number, rise: number): JumpVerdict {
  const reach = jumpReach(rise);
  const gap = reach === null ? null : run <= reach + 1e-9 ? 'jumpable' : 'too far';
  return { step: stepWord(rise), gap, reach };
}

function stepWord(rise: number): JumpVerdict['step'] {
  return rise > PLAYER_JUMP.height + 1e-9 ? 'too high' : rise > PLAYER_JUMP.step + 1e-9 ? 'jumpable' : rise < -PLAYER_JUMP.step - 1e-9 ? 'drop' : 'walk';
}

/** How far apart the profile's samples are (m): under a stair's tread, so a ledge is never stepped over between two. */
export const SAMPLE_STEP = 0.25;
/** At most this many samples a stretch (a 540 m diagonal stays near 0.25 m apart). */
const MAX_SAMPLES = 2400;

/**
 * The ground and surfaces along a stretch, as a player walking it meets them: the height of what is under each sample
 * (the highest box top or the ground there, `restUnder`), null over nothing. Only what lies no higher than a jump above
 * the higher end counts, so a roof or a bridge overhead isn't read as the floor. `spacing`: across the ground between
 * samples (m).
 */
export interface GroundProfile {
  heights: (number | null)[];
  spacing: number;
}

export function sampleProfile(a: Vec3, b: Vec3, world: MeasureWorld): GroundProfile {
  const run = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.min(MAX_SAMPLES, Math.ceil(run / SAMPLE_STEP - 1e-9)));
  const fromY = Math.max(a.y, b.y) + PLAYER_JUMP.height;
  // Only the boxes the stretch passes over (a turned box by its reach round its middle).
  const lo = [Math.min(a.x, b.x) - 0.1, Math.min(a.z, b.z) - 0.1] as const;
  const hi = [Math.max(a.x, b.x) + 0.1, Math.max(a.z, b.z) + 0.1] as const;
  const near = world.boxes.filter((bx) => {
    if (bx.kind === 'barrier' || bx.min[1] > fromY + 0.1) return false;
    const r = bx.yaw ? Math.hypot(bx.max[0] - bx.min[0], bx.max[2] - bx.min[2]) / 2 : 0;
    const cx = (bx.min[0] + bx.max[0]) / 2;
    const cz = (bx.min[2] + bx.max[2]) / 2;
    const hx = r || (bx.max[0] - bx.min[0]) / 2;
    const hz = r || (bx.max[2] - bx.min[2]) / 2;
    return cx + hx >= lo[0] && cx - hx <= hi[0] && cz + hz >= lo[1] && cz - hz <= hi[1];
  });
  const heights: (number | null)[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    heights.push(restUnder(near, world.ground, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, fromY)?.y ?? null);
  }
  // The ends stand where the points were put when nothing is under them (a point on a wall's face).
  if (heights[0] === null) heights[0] = a.y;
  if (heights[n] === null) heights[n] = b.y;
  return { heights, spacing: run / n };
}

/**
 * Judge a profile against PLAYER's numbers (a standard body at normal gravity).
 * - **Steps:** a rise between two samples higher than a step and steeper than the steepest walkable slope
 *   (`maxSlopeDegrees`) is part of a step up; neighbouring steep rises add up to one step (a ledge, a cliff). A slope
 *   you can walk up is never a step, however high it climbs; stairs are many small steps.
 * - **Gaps:** the ground falls away (more than a step, steeply) and comes back to near where it fell from. That is a gap
 *   only when you couldn't climb back out on the far side (a pit deeper than a jump, or nothing under it); a ditch you
 *   can climb out of is a drop and a step. Its width is between the edges; it is jumpable when a sprinting jump to the
 *   far edge's height (`jumpReach`) carries that far. A far edge higher than a jump is a step too high.
 * - **Drops:** ground that falls away and never comes back to that height.
 * The verdict is the steepest step up and the widest gap (the one a jump clears by least).
 */
export function profileVerdict(profile: GroundProfile): JumpVerdict {
  const h = profile.heights;
  const ds = profile.spacing;
  const steep = Math.max(PLAYER_JUMP.step, ds * Math.tan((PLAYER.maxSlopeDegrees * Math.PI) / 180));
  const n = h.length - 1;
  const at = (i: number) => h[i] ?? -Infinity;
  const climbs: number[] = [];
  const gaps: { width: number; rise: number }[] = [];
  let dropped = false;
  let climb = 0;
  let i = 0;
  while (i < n) {
    // Over nothing (past a drop into the void): no step up from there.
    if (at(i) === -Infinity) {
      i++;
      continue;
    }
    const d = at(i + 1) - at(i);
    if (d > steep) {
      climb += d;
      i++;
      continue;
    }
    if (climb > 0) climbs.push(climb);
    climb = 0;
    if (d < -steep) {
      // The ground falls away after i: where does it come back to near this height (within a step)?
      // Or, lower down, rises in a wall too high to climb out by: its top is the far edge (a jump down across).
      const from = at(i);
      let j = i + 1;
      let bottom = Infinity;
      while (j <= n && at(j) < from - PLAYER_JUMP.step) {
        if (bottom > -Infinity && at(j) - bottom > PLAYER_JUMP.height + 1e-9) {
          while (j < n && at(j + 1) - at(j) > steep) j++;
          break;
        }
        bottom = Math.min(bottom, at(j++));
      }
      if (j <= n && (bottom === -Infinity || at(j) - bottom > PLAYER_JUMP.height + 1e-9)) {
        // A pit you couldn't climb out of: jump it, from i to j (its width to within a sample, on the long side).
        gaps.push({ width: (j - i) * ds, rise: at(j) - from });
        i = j;
        continue;
      }
      // It never comes back up (a drop), or you climb out of it (a drop, then its far side's step).
      dropped = true;
    }
    i++;
  }
  if (climb > 0) climbs.push(climb);
  const stepUp = Math.max(0, ...climbs, ...gaps.map((g) => g.rise));
  // The widest gap: the one a jump clears by least (the far edge's height counts: higher carries you less far).
  let worst: { width: number; reach: number | null; margin: number } | null = null;
  for (const g of gaps) {
    const reach = jumpReach(g.rise);
    const margin = reach === null ? -Infinity : reach - g.width;
    if (!worst || margin < worst.margin) worst = { width: g.width, reach, margin };
  }
  const step = stepUp > PLAYER_JUMP.step + 1e-9 ? stepWord(stepUp) : dropped ? 'drop' : 'walk';
  const gap = !worst ? null : worst.margin >= -1e-9 ? 'jumpable' : 'too far';
  return { step, gap, reach: worst?.reach ?? null, sampled: { step: round2(stepUp), gap: worst ? round2(worst.width) : null } };
}

const round2 = (v: number) => Math.round(v * 100) / 100 + 0;

/** The verdict in words: "step jumpable · gap jumpable (5.9 m at most)"; sampled, with the step's height and the gap's width. */
export function describeVerdict(v: JumpVerdict): string {
  const sv = v.sampled;
  const tall = sv && (v.step === 'jumpable' || v.step === 'too high') ? ` ${formatLength(sv.step)}` : '';
  const step = v.step === 'walk' ? 'step walkable' : v.step === 'drop' ? 'a drop' : v.step === 'jumpable' ? `step${tall} jumpable` : `too high${tall ? `: a step of${tall}` : ''} (a jump lifts ${formatLength(PLAYER_JUMP.height)})`;
  if (sv) {
    if (v.gap === null) return `${step} · no gap`;
    const width = formatLength(sv.gap ?? 0);
    return `${step} · gap ${width} ${v.gap === 'jumpable' ? 'jumpable' : 'too far'}${v.reach !== null ? ` (${formatLength(v.reach)} at most)` : ''}`;
  }
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
