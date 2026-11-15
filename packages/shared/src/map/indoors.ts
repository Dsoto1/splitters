import { getProp } from '../content/props.ts';
import { blockBoxes, type WorldBox } from './geometry.ts';
import type { MapDocument, PropEntity } from './schema.ts';

/**
 * Props indoors: under a ceiling, a roof or the floor above, all over their footprint. The sun never reaches them
 * (the roof's own shadow covers them), so their shadow in the sun's shadow map is a draw for nothing: the client leaves
 * them out of the sun's shadow pass (propVisuals.ts, propBatches.ts). A dorm hall's furniture was 250 casters on St.
 * John's (docs/map-briefs/st_johns/PLAN_2026-11-12.md 4b).
 *
 * "Covered" is read from the map's level geometry (tiles' floors, ceilings and roofs, walls, free blocks), not from
 * props: a shelf over a chair doesn't make the chair indoors. A point is covered when a level box's underside lies
 * between the prop's top and INDOOR_REACH above it; the prop is indoors when its middle and four points
 * INDOOR_MARGIN out from it (along x and z) are all covered, or stand in a wall (a desk against a room's outer wall), so a
 * prop under the edge of an awning or a bridge, which the sun reaches from the side, keeps its shadow.
 */
export const INDOOR_REACH = 5;
export const INDOOR_MARGIN = 0.75;
const CELL = 8;

export function indoorProps(doc: Pick<MapDocument, 'entities'>, boxes: readonly WorldBox[]): (e: Pick<PropEntity, 'model' | 'position' | 'scale'>) => boolean {
  // Level boxes that can be a ceiling, in a grid of CELL m squares by their (turned) footprint.
  const grid = new Map<string, WorldBox[]>();
  for (const b of [...boxes, ...blockBoxes(doc as MapDocument)]) {
    if (b.kind === 'barrier' || b.kind === 'prop' || b.kind === 'trim' || b.pitch || b.roll) continue;
    const r = b.yaw ? Math.hypot(b.max[0] - b.min[0], b.max[2] - b.min[2]) / 2 : 0;
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    const x0 = b.yaw ? cx - r : b.min[0];
    const x1 = b.yaw ? cx + r : b.max[0];
    const z0 = b.yaw ? cz - r : b.min[2];
    const z1 = b.yaw ? cz + r : b.max[2];
    for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++) {
      for (let gz = Math.floor(z0 / CELL); gz <= Math.floor(z1 / CELL); gz++) {
        const k = `${gx},${gz}`;
        const list = grid.get(k);
        if (list) list.push(b);
        else grid.set(k, [b]);
      }
    }
  }
  /** Whether (x, z) lies inside a level box that spans `y`: a wall or pier beside the prop. */
  const inside = (b: WorldBox, x: number, z: number): boolean => {
    let px = x;
    let pz = z;
    if (b.yaw) {
      const cx = (b.min[0] + b.max[0]) / 2;
      const cz = (b.min[2] + b.max[2]) / 2;
      const c = Math.cos(-b.yaw);
      const s = Math.sin(-b.yaw);
      px = cx + (x - cx) * c + (z - cz) * s;
      pz = cz - (x - cx) * s + (z - cz) * c;
    }
    return px >= b.min[0] && px <= b.max[0] && pz >= b.min[2] && pz <= b.max[2];
  };
  /** A ceiling over (x, z) within reach of `top`, or (for the points out from the middle) a wall there at `mid`. */
  const covered = (x: number, z: number, top: number, mid: number | null): boolean => {
    for (const b of grid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
      const bottom = b.min[1];
      if (bottom >= top - 0.05 && bottom <= top + INDOOR_REACH && inside(b, x, z)) return true;
      if (mid !== null && b.min[1] <= mid && b.max[1] >= mid && inside(b, x, z)) return true;
    }
    return false;
  };
  return (e) => {
    const def = getProp(e.model);
    // Trees and plants (environment species) keep their shadows: a crown can reach through a roof (St. John's red
    // church has a spruce standing in it).
    if (!def || e.model.startsWith('env.')) return false;
    const [x, y, z] = e.position;
    const top = y + def.size[1] * e.scale;
    const mid = y + (top - y) / 2;
    const m = INDOOR_MARGIN;
    return covered(x, z, top, null) && covered(x + m, z, top, mid) && covered(x - m, z, top, mid) && covered(x, z + m, top, mid) && covered(x, z - m, top, mid);
  };
}
