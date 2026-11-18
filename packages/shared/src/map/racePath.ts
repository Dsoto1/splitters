import type { MapPath, PathUse } from './schema.ts';

/**
 * A path's uses and the map's race track (split from track.ts, which re-exports them, 2026-11-18: the menu's rules
 * ask whether a map has a track, and reaching track.ts took the track geometry, terrain and vehicle tables into the
 * menu's first JS; docs/LOADING.md).
 */

/** Does the path have this use? */
export const pathUses = (p: MapPath, use: PathUse): boolean => p.uses.includes(use);

/** The map's race track: its first path used as a race (null: none). */
export function racePath(map: { paths?: readonly MapPath[] | undefined }): MapPath | null {
  return map.paths?.find((p) => pathUses(p, 'race') && p.points.length >= 2) ?? null;
}
