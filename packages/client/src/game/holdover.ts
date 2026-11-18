import { gunplayOf, holdoverMarks, type MatchRules, type WeaponDefinition } from '@tiletrigger/shared';
import type { HoldoverMark } from './hud.ts';

/** The distances a scope marks (m), within the weapon's reach. */
export const HOLDOVER_DISTANCES = [200, 300, 400, 500, 600, 800] as const;
/** Marks closer to the centre than this (reticle units, 100 = its edge) would sit on the crosshair: left off. */
const MIN_Y = 1.5;
/** Nor past the fine crosshair into the thick post (scope) or most of the glass (optic). */
const MAX_Y = 60;

/**
 * Where a scope's holdover marks sit (docs/GUNPLAY_SPEC.md §5): for a bullet weapon, a mark for each distance the
 * drop at it (sim/gunplay.ts holdoverMarks, under the match's ballistics rule) below the centre. `tanHalf`: the
 * tangent of the half-angle the reticle's edge (100 units) spans: a zoomFov scope's half field of view, or an optic's
 * world half-angle over its glass's share of the screen. Rounds that don't drop (hitscan, beams) get none. A mark
 * closer than `gap` units to the last one kept is left off (at low magnification the far distances crowd together;
 * the second zoom spreads them out again).
 */
export function holdoverFor(def: WeaponDefinition, rules: Pick<MatchRules, 'ballistics'>, tanHalf: number, gap = 2.6): HoldoverMark[] {
  const b = gunplayOf(def).ballistic;
  if (!b || !(tanHalf > 0)) return [];
  const out: HoldoverMark[] = [];
  for (const m of holdoverMarks(b, rules, HOLDOVER_DISTANCES.filter((d) => d <= def.range))) {
    const y = (100 * Math.tan(m.angle)) / tanHalf;
    if (y < MIN_Y || (out.length && y - out[out.length - 1]!.y < gap)) continue;
    if (y > MAX_Y) break;
    out.push({ y, label: String(m.dist / 100), major: m.dist % 200 === 0 });
  }
  return out;
}
