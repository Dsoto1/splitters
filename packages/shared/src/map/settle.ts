import { getProp } from '../content/props.ts';
import type { Vec3 } from '../math.ts';
import { blockBoxes, buildMapGeometry, propBoxes, type WorldBox } from './geometry.ts';
import type { MapDocument, PropEntity } from './schema.ts';
import { terrainHeightAt, type TerrainData } from './terrain.ts';

/**
 * Props on sloping ground. A prop is "settled" when its base sits at the
 * lowest ground under its footprint, so no corner hangs in the air (the
 * uphill side is sunk a little instead, the way a rock or a crate beds into a
 * hillside). Rocks, logs, stumps and plants also lean with the slope when
 * drawn; trees, buildings and furniture stay upright.
 */

/** Categories drawn leaning with the ground under them. */
export const TILTED_PROP_CATEGORIES: ReadonlySet<string> = new Set(['Plants & Flowers', 'Rocks & Wood']);
/** The most a natural prop leans (radians): steeper ground just beds it deeper. */
export const MAX_PROP_TILT = (25 * Math.PI) / 180;
/** How far above the ground under it a prop may sit before the validator calls it floating (metres). */
export const FLOAT_TOLERANCE = 0.2;

/** The centre and the four corners of a prop's footprint (corners pulled in a little: models rarely fill their box). */
export function propFootprint(e: Pick<PropEntity, 'model' | 'position' | 'yaw' | 'scale'>): [number, number][] {
  const def = getProp(e.model);
  const [x, , z] = e.position;
  if (!def) return [[x, z]];
  // Trees stand on their trunk, not the spread of their crown.
  const box = def.category === 'Trees' && def.collision ? def.collision : def.size;
  const hx = (box[0] * e.scale * 0.85) / 2;
  const hz = (box[2] * e.scale * 0.85) / 2;
  const c = Math.cos(e.yaw);
  const s = Math.sin(e.yaw);
  const pts: [number, number][] = [[x, z]];
  for (const [dx, dz] of [
    [-hx, -hz],
    [hx, -hz],
    [hx, hz],
    [-hx, hz],
  ] as const) {
    pts.push([x + dx * c + dz * s, z - dx * s + dz * c]);
  }
  return pts;
}

/** Base height that beds a prop into the terrain at its X/Z (the lowest ground under its footprint), or null off the terrain. */
export function settledPropY(t: TerrainData, e: Pick<PropEntity, 'model' | 'position' | 'yaw' | 'scale'>): number | null {
  if (terrainHeightAt(t, e.position[0], e.position[2]) === null) return null;
  let low = Infinity;
  for (const [x, z] of propFootprint(e)) {
    const h = terrainHeightAt(t, x, z);
    if (h !== null) low = Math.min(low, h);
  }
  // A hair lower still, so the edge never shows a gap on bumpy ground.
  return Math.round((low - 0.03) * 100) / 100;
}

/** Ground normal under a point (from the slope across `span` metres), leaning at most `maxTilt`; null off the terrain. */
export function groundNormal(t: TerrainData, x: number, z: number, span = 0.6, maxTilt = MAX_PROP_TILT): Vec3 | null {
  const h = terrainHeightAt(t, x, z);
  if (h === null) return null;
  const hx0 = terrainHeightAt(t, x - span, z) ?? h;
  const hx1 = terrainHeightAt(t, x + span, z) ?? h;
  const hz0 = terrainHeightAt(t, x, z - span) ?? h;
  const hz1 = terrainHeightAt(t, x, z + span) ?? h;
  let n = { x: -(hx1 - hx0) / (2 * span), y: 1, z: -(hz1 - hz0) / (2 * span) };
  const flat = Math.hypot(n.x, n.z);
  const tilt = Math.atan(flat);
  if (tilt > maxTilt && flat > 0) {
    const k = Math.tan(maxTilt) / flat;
    n = { x: n.x * k, y: 1, z: n.z * k };
  }
  const len = Math.hypot(n.x, n.y, n.z);
  return { x: n.x / len, y: n.y / len, z: n.z / len };
}

/** Whether a prop leans with the ground when drawn. */
export function propTilts(model: string): boolean {
  const def = getProp(model);
  return !!def && TILTED_PROP_CATEGORIES.has(def.category);
}

/** Top of whatever stands under (x, z) no higher than `y` + a little: floors, blocks, other props. */
function supportUnder(boxes: readonly WorldBox[], x: number, z: number, y: number, skip: string): number {
  let best = -Infinity;
  for (const b of boxes) {
    if (b.sourceId === skip || b.kind === 'barrier') continue;
    const top = b.max[1];
    if (top > y + 0.1 || top <= best) continue;
    let px = x;
    let pz = z;
    if (b.yaw) {
      const cx = (b.min[0] + b.max[0]) / 2;
      const cz = (b.min[2] + b.max[2]) / 2;
      const c = Math.cos(-b.yaw);
      const s = Math.sin(-b.yaw);
      const dx = x - cx;
      const dz = z - cz;
      px = cx + dx * c + dz * s;
      pz = cz - dx * s + dz * c;
    }
    if (px >= b.min[0] - 0.05 && px <= b.max[0] + 0.05 && pz >= b.min[2] - 0.05 && pz <= b.max[2] + 0.05) best = top;
  }
  return best;
}

/**
 * Props standing over terrain with a visible gap under them: nothing below
 * (floor, block, another prop) holds them up and they sit more than
 * FLOAT_TOLERANCE above the lowest ground under their footprint. Props well
 * above the ground (more than 3 m) are taken to be deliberate (hung lamps,
 * signs) and left alone.
 */
export function floatingProps(map: MapDocument, boxes: readonly WorldBox[] = [...buildMapGeometry(map), ...blockBoxes(map), ...blockBoxes(map, true), ...propBoxes(map), ...propBoxes(map, true)]): { id: string; gap: number }[] {
  const t = map.terrain;
  if (!t) return [];
  const out: { id: string; gap: number }[] = [];
  for (const e of map.entities) {
    if (e.kind !== 'prop') continue;
    const ground = settledPropY(t, e);
    if (ground === null) continue;
    const gap = e.position[1] - (ground + 0.03);
    if (gap <= FLOAT_TOLERANCE || gap > 3) continue;
    if (supportUnder(boxes, e.position[0], e.position[2], e.position[1], e.id) > e.position[1] - FLOAT_TOLERANCE) continue;
    out.push({ id: e.id, gap: Math.round(gap * 100) / 100 });
  }
  return out;
}
