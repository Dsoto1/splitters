import { getProp } from '../content/props.ts';
import { envTilts, getEnvSpecies, isEnvModel } from '../content/environment.ts';
import type { Vec3 } from '../math.ts';
import { coreCatalog, type TileCatalog } from './catalog.ts';
import { blockBoxes, buildMapGeometry, propBoxes, type WorldBox } from './geometry.ts';
import { withPathsLaid } from './paths.ts';
import type { LightEntity, LightFixture, MapDocument, PropEntity } from './schema.ts';
import { terrainHeightAt, type TerrainData } from './terrain.ts';

/** What an environment tree stands on when settled on a slope: its trunk, not its crown's spread. */
const TRUNK_FOOTPRINT = [0.6, 0, 0.6] as const;

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
  const env = getEnvSpecies(e.model);
  const box = env?.category === 'tree' ? TRUNK_FOOTPRINT : def.category === 'Trees' && def.collision ? def.collision : def.size;
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
  if (isEnvModel(model)) return envTilts(model);
  return !!def && TILTED_PROP_CATEGORIES.has(def.category);
}

/** Top of whatever stands under (x, z) no higher than `y` + a little: floors, blocks, other props. */
export function supportUnder(boxes: readonly WorldBox[], x: number, z: number, y: number, skip: string): number {
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
/** Everything a prop can stand on: floors, blocks and other props. */
export function supportBoxes(map: MapDocument): WorldBox[] {
  return [...buildMapGeometry(map), ...blockBoxes(map), ...blockBoxes(map, true), ...propBoxes(map), ...propBoxes(map, true)];
}

export function floatingProps(map: MapDocument, boxes: readonly WorldBox[] = supportBoxes(map)): { id: string; gap: number }[] {
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

/**
 * Props bedded on the ground stay bedded when the ground changes under them.
 * MapMaker settles props on the map's own ground, but the game plays it with
 * the paths laid in (paths.ts: the ground under a walk is levelled to the
 * walk, its shoulders blended), so a bush or a lamp post beside a walk sat
 * sunk into it or stood off it by up to a quarter of a metre. A prop resting
 * on the ground before (its base within REBED_TOLERANCE of where settling
 * puts it) is moved by as much as its settled height moves; one held up by a
 * floor, block or another prop, or placed off the ground, stays put.
 */
export const REBED_TOLERANCE = 0.06;
export function rebedShift(before: TerrainData, after: TerrainData, e: Pick<PropEntity, 'model' | 'position' | 'yaw' | 'scale'>): number {
  const was = settledPropY(before, e);
  if (was === null || Math.abs(e.position[1] - was) > REBED_TOLERANCE) return 0;
  const now = settledPropY(after, e);
  return now === null ? 0 : Math.round((now - was) * 100) / 100;
}

/** Where rebedProps puts one prop's base when the ground goes from `before` to `after`, or null where it stays (held up by what's in `boxes`, or not on the ground). */
export function rebeddedY(before: TerrainData, after: TerrainData, boxes: readonly WorldBox[], e: Pick<PropEntity, 'id' | 'model' | 'position' | 'yaw' | 'scale'>): number | null {
  const dy = rebedShift(before, after, e);
  if (!dy) return null;
  if (supportUnder(boxes, e.position[0], e.position[2], e.position[1], e.id) > e.position[1] - FLOAT_TOLERANCE) return null;
  return Math.round((e.position[1] + dy) * 1000) / 1000;
}

/** The map's props on the ground re-bedded on `after` (the same map when none moves). `boxes`: what could hold a prop up instead. */
export function rebedProps(map: MapDocument, before: TerrainData, after: TerrainData, boxes: readonly WorldBox[]): MapDocument {
  let entities: MapDocument['entities'] | null = null;
  map.entities.forEach((e, i) => {
    if (e.kind !== 'prop') return;
    const y = rebeddedY(before, after, boxes, e);
    if (y === null) return;
    entities ??= [...map.entities];
    entities[i] = { ...e, position: [e.position[0], y, e.position[2]] };
  });
  return entities ? { ...map, entities } : map;
}

/**
 * Hung fixtures. Ceiling panels, strip lights, hanging bulbs and chandelier
 * lights, and props that hang (chandeliers, a ceiling light panel, a hanging
 * brazier), are drawn fastened to the underside of whatever is over them: a
 * panel placed a little under a ceiling is drawn flush against it, a bulb's
 * cord and a chandelier's chain reach up to it, and a hung prop is drawn
 * with its top against it. Only a ceiling within HANG_REACH counts: further
 * up there is nothing to hang from and the fixture stays where it was put.
 * The light itself (where it shines from) and the map data never change.
 */
export const HANG_REACH = 1.5;
/** Props drawn hanging from the ceiling over them. */
export const HANGING_PROPS: ReadonlySet<string> = new Set(['prop.hm_chandelier', 'prop.ge_chandelier', 'prop.hp_ceiling_light', 'prop.jt_hanging_brazier']);
/** How far above a light's position each fixture's top is (where it fastens to a ceiling). */
const FIXTURE_TOP: Partial<Record<LightFixture, number>> = { ceiling: 0.065, strip: 0.035, bulb: 0.6, chandelier: 0 };

/** The underside of the lowest box over (x, z) whose bottom is between `y` (less a hair) and `y` + `reach`, or null. */
export function ceilingOver(boxes: readonly WorldBox[], x: number, z: number, y: number, reach = HANG_REACH, skip = ''): number | null {
  let best: number | null = null;
  for (const b of boxes) {
    if (b.sourceId === skip || b.kind === 'barrier' || b.pitch || b.roll) continue;
    const bottom = b.min[1];
    if (bottom < y - 0.02 || bottom > y + reach || (best !== null && bottom >= best)) continue;
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
    if (px >= b.min[0] && px <= b.max[0] && pz >= b.min[2] && pz <= b.max[2]) best = bottom;
  }
  return best;
}

/** How far a light's fixture is drawn raised (ceiling panels, strips) or its cord/chain lengthened (bulbs, chandeliers) to reach the ceiling over it; 0 when there's none in reach or it already touches. */
export function fixtureGap(boxes: readonly WorldBox[], e: Pick<LightEntity, 'position' | 'fixture'>): number {
  const top = FIXTURE_TOP[e.fixture];
  if (top === undefined) return 0;
  const [x, y, z] = e.position;
  const ceiling = ceilingOver(boxes, x, z, y + top);
  const gap = ceiling === null ? 0 : ceiling - (y + top);
  return gap > 0.01 ? Math.round(gap * 1000) / 1000 : 0;
}

/** How far a hanging prop is drawn raised so its top meets the ceiling over it (0: not a hanging prop, no ceiling in reach, or touching). */
export function hungPropLift(boxes: readonly WorldBox[], e: Pick<PropEntity, 'id' | 'model' | 'position' | 'scale'>): number {
  if (!HANGING_PROPS.has(e.model)) return 0;
  const def = getProp(e.model);
  if (!def) return 0;
  const [x, y, z] = e.position;
  const top = y + def.size[1] * e.scale;
  const ceiling = ceilingOver(boxes, x, z, top, HANG_REACH, e.id);
  const gap = ceiling === null ? 0 : ceiling - top;
  return gap > 0.01 ? Math.round(gap * 1000) / 1000 : 0;
}

/**
 * Terrain kept under floors: wherever a floor lies over the ground, the
 * terrain beneath it is lowered so it never shows through (terrain a few
 * centimetres above or below a floor's top fights with it and shows as
 * streaks and patches, and terrain above a floor would be walked on). Inside
 * a floor the ground goes just under the slab; on the floor's edges just under
 * its top, so open ground outside meets the floor without a step. Only ground
 * near a floor is touched (within FLOOR_REACH of its top): a hill a floor is
 * buried in, or a valley far below a bridge, stays as it is. Returns the same
 * terrain when nothing needed lowering. It only ever lowers, so it is worked
 * out from the ground as made every time (withGroundAsPlayed: every load as
 * played, and MapMaker's view) and never stored: the map's file and MapMaker's
 * document keep the ground as made, and the ground under a floor that moves or
 * goes comes back as it was.
 */
export const FLOOR_REACH = 3;
export function terrainUnderFloors(map: MapDocument, boxes: readonly WorldBox[] = buildMapGeometry(map)): TerrainData | null {
  const t = map.terrain;
  if (!t) return t;
  let heights: number[] | null = null;
  const s = t.spacing;
  const cm = (y: number) => Math.floor((y - t.baseY) * 100);
  // Highest floors first: ground lowered under an upper floor may then reach a lower one, and goes under that
  // too in the same pass (so a second pass changes nothing).
  const floors = boxes.filter((b) => b.kind === 'floor' && !b.yaw && !b.pitch && !b.roll).sort((a, b) => b.max[1] - a.max[1]);
  for (const b of floors) {
    const top = b.max[1];
    const c0 = Math.max(0, Math.ceil((b.min[0] - 0.01 - t.origin[0]) / s));
    const c1 = Math.min(t.cols - 1, Math.floor((b.max[0] + 0.01 - t.origin[0]) / s));
    const r0 = Math.max(0, Math.ceil((b.min[2] - 0.01 - t.origin[1]) / s));
    const r1 = Math.min(t.rows - 1, Math.floor((b.max[2] + 0.01 - t.origin[1]) / s));
    for (let r = r0; r <= r1; r++) {
      const z = t.origin[1] + r * s;
      const zEdge = z <= b.min[2] + 0.01 || z >= b.max[2] - 0.01;
      for (let c = c0; c <= c1; c++) {
        const x = t.origin[0] + c * s;
        const edge = zEdge || x <= b.min[0] + 0.01 || x >= b.max[0] - 0.01;
        const i = r * t.cols + c;
        const h = (heights ?? t.heights)[i]!;
        const y = t.baseY + h / 100;
        if (y > top + FLOOR_REACH || y <= top - 0.05) continue;
        const want = cm(edge ? top - 0.05 : Math.min(top - 0.05, b.min[1] - 0.02));
        if (h > want) {
          heights ??= [...t.heights];
          heights[i] = want;
        }
      }
    }
  }
  return heights ? { ...t, heights } : t;
}

/**
 * The map on its ground as played (loadMap plays every map so; MapMaker's view draws the same, from the same
 * pieces): its paths laid into the terrain (paths.ts withPathsLaid), the terrain kept under every floor
 * (terrainUnderFloors), and the props bedded on the map's own ground re-bedded on that (rebedProps). `map` has its
 * set pieces expanded and its ground as made, which is what the map's file and MapMaker's document keep: this ground
 * is worked out from it, never stored, so it follows the paths and the floors (a floor that moves or goes takes its
 * dip with it), and a map loads as MapMaker showed it. The floors, and what holds a prop up, are the map's geometry as
 * made (the laid ground changes none of them); `boxes` is that geometry when the caller has it.
 */
export function withGroundAsPlayed(map: MapDocument, catalog: TileCatalog = coreCatalog, boxes?: readonly WorldBox[]): MapDocument {
  const laid = withPathsLaid(map);
  const made = map.terrain;
  if (!laid.terrain || !made) return laid;
  const geometry = boxes ?? buildMapGeometry(map, catalog);
  const ground = terrainUnderFloors(laid, geometry)!;
  const out = ground === made ? laid : rebedProps(laid, made, ground, geometry);
  return out.terrain === ground ? out : { ...out, terrain: ground };
}
