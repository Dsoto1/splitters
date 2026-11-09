import type { Vec3 } from '../math.ts';
import type { TrackGeometry } from '../map/track.ts';

/**
 * The map's track (its path used as a track: roads with checkpoints, where
 * ambient NPC cars lap in any mode; trackDriver.ts drives them) and how
 * vehicles handle on it.
 */

/** Tyre grip on the road and top speed off it (multiples), for wheeled vehicles on a map with a track. Hovercraft don't care. */
export function roadHandling(track: TrackGeometry | null, pos: Vec3, hover: boolean): { grip: number; speed: number } {
  if (!track || hover) return { grip: 1, speed: 1 };
  return track.onRoad(pos.x, pos.y, pos.z) ? { grip: 1.7, speed: 1 } : { grip: 1, speed: 0.85 };
}
