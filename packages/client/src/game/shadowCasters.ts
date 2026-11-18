/**
 * Cheaper small shadow casters (docs/PERF_SHADOW_CASTERS_2026-11-17.md; `?perfoff=smallcasters` turns it off): the
 * rules, kept apart from the renderer so they can be tested without one.
 *
 * - **Static shadow sets for trees and rocks** (environment/environmentVisuals.ts): an environment species casts
 *   through batches of its own, made once per square and never changed, instead of through the batches it is drawn
 *   with (which change as the camera walks: a copy moves between levels of detail). They never change, so the static
 *   shadow cache (shadowCache.ts) keeps them: a still or slowly turning view draws none of them a frame. Each set is
 *   cascade-aware: the near cascades (and Medium's one map) take the full-detail set, the far cascade the lightest level
 *   that casts today (a far cascade's texel is a quarter metre: the full detail is lost in it).
 * - **Props with levels of detail cast through the shadow proxies at full detail** (game/shadowProxy.ts,
 *   game/propBatches.ts): the props on the map in fewer copies than a batch takes (GPU instances of a model with levels:
 *   St. John's kit walls, piers, lamp posts) and the batched ones with levels were each their own caster every frame,
 *   at whatever level the camera picked. Their full-detail triangles go into the merged proxies instead (one mesh per
 *   48 m square), drawn only when a cascade moves. A shadow never changes with a prop's level of detail any more.
 * - **Small clutter's near shadows with a band** (game/atmosphere.ts, game/propBatches.ts): small things cast within
 *   SMALL_REACH_IN of the camera and stop past SMALL_REACH_OUT (hysteresis: no shadow blinking on and off at the line),
 *   so nothing within 20 m pops.
 */

/** Small clutter starts casting within this many metres of the camera (its shadow is a speck further off). */
export const SMALL_REACH_IN = 20;
/** And stops casting only past this many (the band between is hysteresis: no flicker at the line). */
export const SMALL_REACH_OUT = 24;

/**
 * Whether a small caster at `distance` (m, from the camera to its bounds) casts now, given whether it did last time
 * (`was`): in within SMALL_REACH_IN, out past SMALL_REACH_OUT, and in the band between it keeps what it had.
 */
export function smallCasts(distance: number, was: boolean): boolean {
  if (distance <= SMALL_REACH_IN) return true;
  if (distance > SMALL_REACH_OUT) return false;
  return was;
}

/** Environment categories that cast only in the near cascades (envShadowSets' `small`). */
export const SMALL_ENV_CATEGORIES: ReadonlySet<string> = new Set(['plant', 'groundcover', 'rock']);

/** Cascades a static environment shadow set is drawn into: a bit per cascade (bit 0 is also Medium's one map). */
export const NEAR_CASCADES = 0b011;
export const FAR_CASCADES = 0b100;
export const ALL_CASCADES = 0b111;

/** Whether a caster tagged with a cascade mask (`shadowLayers` metadata; none: every cascade) draws into cascade `layer`. */
export function castsInLayer(mask: number | undefined, layer: number): boolean {
  return mask === undefined || (mask & (1 << layer)) !== 0;
}

/**
 * An environment species' static shadow sets, from its levels (nearest first; `crossed`: the card stand-in, which
 * never casts): the level the near cascades take (full detail) and the one the far cascade takes, each with its mask.
 * Today's rule for which levels cast at all is kept (environmentVisuals.ts: a level from max(2, levels - 1) on is
 * too light to cast): the far set is the lightest level that still casts. One casting level: one set for every cascade.
 * `small` (SMALL_ENV_CATEGORIES): the near set only.
 */
export function envShadowSets(levels: readonly { crossed: boolean }[], small = false): { level: number; mask: number }[] {
  const casting: number[] = [];
  const cut = Math.max(2, levels.length - 1);
  for (let i = 0; i < levels.length && i < cut; i++) if (!levels[i]!.crossed) casting.push(i);
  if (!casting.length) return [];
  const near = casting[0]!;
  // Small species (plants, ground cover, pebbles; environment Phase 5): no far-cascade shadow. Past the near cascades
  // a bush's or a fern's shadow is a speck of a quarter-metre texel; the trees', rocks' and cliffs' shadows stay.
  if (small) return [{ level: near, mask: NEAR_CASCADES }];
  const far = casting[casting.length - 1]!;
  if (near === far) return [{ level: near, mask: ALL_CASCADES }];
  return [
    { level: near, mask: NEAR_CASCADES },
    { level: far, mask: FAR_CASCADES },
  ];
}

/** The shadow sets' squares (m): the near set's are small (the near cascades are), the far set's wide (fewer draws). */
export function envShadowSector(mask: number): number {
  return mask === FAR_CASCADES ? 256 : 64;
}

/** A copy's square of side `size` as a key. */
export function squareKey(x: number, z: number, size: number): string {
  return `${Math.floor(x / size)}:${Math.floor(z / size)}`;
}

/**
 * Sort copies (world positions) into squares of side `size`: one static shadow batch per square. Every copy is in
 * exactly one square, so no copy casts twice and none is left out.
 */
export function bySquare<T extends { x: number; z: number }>(copies: readonly T[], size: number): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const c of copies) {
    const k = squareKey(c.x, c.z, size);
    let list = out.get(k);
    if (!list) out.set(k, (list = []));
    list.push(c);
  }
  return out;
}
