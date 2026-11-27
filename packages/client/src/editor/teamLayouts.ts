/**
 * MapMaker's team Layout chips (owner, 2026-11-26, "4b"): only the common layouts; any other mix (2v2v2v2v2v2v2v2,
 * 1v3 and the like) is set with the team steppers, as Match Setup does. (Shared sim/npc.ts TEAM_PRESETS, the longer
 * list it replaces, is no longer used.)
 */
export const TEAM_LAYOUTS: readonly (readonly number[])[] = [
  [1, 1], [2, 2], [4, 4], [8, 8], [2, 2, 2], [3, 3, 3], [2, 2, 2, 2], [4, 4, 4, 4],
];

/** The Layout chips for a map set up as `sizes`: the common layouts, and that one first when it's another (a saved odd layout still shows, lit). */
export function teamLayoutChoices(sizes: readonly number[]): { sizes: readonly number[]; odd: boolean }[] {
  const key = sizes.join(',');
  const common = TEAM_LAYOUTS.map((p) => ({ sizes: p, odd: false }));
  return sizes.length && !TEAM_LAYOUTS.some((p) => p.join(',') === key) ? [{ sizes, odd: true }, ...common] : common;
}
