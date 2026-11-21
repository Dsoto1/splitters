import type { TerrainData } from './terrain.ts';

/**
 * A ground cut (groundBore.ts): a box in world space whose part of the ground's surface a buried tunnel takes out. The
 * small helpers here need nothing but the boxes, so roads and paths (track.ts, paths.ts: on the menu's first load) use
 * them without the tile catalogue groundBore.ts works the cuts out from.
 */
export interface GroundCut {
  min: [number, number, number];
  max: [number, number, number];
}

/** Whether the ground's surface at (x, z), `y` high, has been cut away there (or within `margin` of where it has). */
export function groundCutAt(cuts: readonly GroundCut[], x: number, y: number, z: number, margin = 0): boolean {
  for (const c of cuts) if (x > c.min[0] - margin && x < c.max[0] + margin && z > c.min[2] - margin && z < c.max[2] + margin && y > c.min[1] && y < c.max[1]) return true;
  return false;
}

const cutsOf = new WeakMap<object, readonly GroundCut[]>();
const NO_CUTS: readonly GroundCut[] = [];

/** Remember the cuts a ground as played was worked out with (settle.ts terrainUnderFloors). */
export function rememberTerrainCuts(t: TerrainData, cuts: readonly GroundCut[]): void {
  if (cuts.length) cutsOf.set(t, cuts);
}

/**
 * The cuts of a ground as played (the terrain loadMap plays and MapMaker shows), for what is placed on the ground by
 * its height alone: plants must not grow where the ground has been cut away (client foliage.ts).
 */
export function terrainCuts(t: TerrainData): readonly GroundCut[] {
  return cutsOf.get(t) ?? NO_CUTS;
}
