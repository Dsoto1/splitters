import type { MapDocument, MapEntity, PropEntity } from '../map/schema.ts';
import { settledPropY } from '../map/settle.ts';

/**
 * Scatter brush sets: a mix of props planted with a minimum spacing, random
 * turns and sizes. Trees keep solid trunks; bushes, flowers and grass can be
 * walked through.
 */
export interface ScatterSet {
  label: string;
  /** Props to pick from (`prop.` ids), with relative weights. */
  models: readonly (readonly [string, number])[];
  /** Least distance between two plants of the stroke (m). */
  spacing: number;
  scale: readonly [number, number];
  /** Tint for Kenney's grass and ferns (their greens are teal; this matches the terrain's grass). The painted mn_* plants keep their own colours (and their instancing). */
  tint?: string;
}

export const SCATTER_SETS = {
  forest: { label: 'Pine forest', models: [['prop.pine_tall', 3], ['prop.pine_tall_b', 2], ['prop.pine_round', 2], ['prop.pine_small', 2], ['prop.pine', 1]], spacing: 5, scale: [0.8, 1.25] },
  woods: { label: 'Leafy woods', models: [['prop.oak', 3], ['prop.tree_round', 2], ['prop.tree_detailed', 2], ['prop.tree_fat', 1], ['prop.tree_thin', 1]], spacing: 6, scale: [0.8, 1.2] },
  autumn: { label: 'Autumn woods', models: [['prop.oak_autumn', 3], ['prop.tree_round_autumn', 2], ['prop.oak', 1], ['prop.tree_autumn', 1]], spacing: 6, scale: [0.8, 1.2] },
  mixed: { label: 'Fir & birch forest', models: [['prop.mn_fir', 3], ['prop.mn_birch', 2], ['prop.mn_oak', 1], ['prop.mn_shrub', 2], ['prop.mn_fern', 2]], spacing: 5, scale: [0.85, 1.2] },
  jungle: { label: 'Jungle', models: [['prop.palm_tall', 2], ['prop.palm_short', 2], ['prop.tree_plateau', 1], ['prop.mn_banana', 2], ['prop.fern', 2], ['prop.mn_fern', 2], ['prop.bush_large', 2]], spacing: 3.5, scale: [0.8, 1.3] },
  undergrowth: { label: 'Undergrowth', models: [['prop.mn_shrub', 3], ['prop.mn_fern', 3], ['prop.bush_small', 1]], spacing: 1.8, scale: [0.75, 1.2] },
  bushes: { label: 'Bushes', models: [['prop.bush', 3], ['prop.bush_leafy', 2], ['prop.bush_large', 1], ['prop.bush_small', 3], ['prop.bush_cone', 1]], spacing: 2.2, scale: [0.8, 1.3] },
  meadow: { label: 'Flowers & grass', models: [['prop.flower_red', 2], ['prop.flower_yellow', 2], ['prop.flower_purple', 2], ['prop.grass_tall', 3], ['prop.grass_leafy', 2], ['prop.mushrooms', 0.5]], spacing: 1.8, scale: [0.5, 0.85], tint: '#c9d27a' },
  desert: { label: 'Desert scrub', models: [['prop.cactus', 3], ['prop.cactus_tall', 1], ['prop.plant_low', 3], ['prop.stones', 2], ['prop.palm_short', 0.5]], spacing: 3.5, scale: [0.8, 1.2] },
  water: { label: 'Water plants', models: [['prop.mn_eelgrass', 1]], spacing: 1.1, scale: [0.8, 1.3] },
  rocks: { label: 'Rocks', models: [['prop.boulder_round', 2], ['prop.boulder_jagged', 2], ['prop.boulder_flat', 2], ['prop.rock_medium', 2], ['prop.stones', 3]], spacing: 3, scale: [0.6, 1.3] },
} as const satisfies Record<string, ScatterSet>;
export type ScatterSetId = keyof typeof SCATTER_SETS;
export const SCATTER_SET_IDS = Object.keys(SCATTER_SETS) as ScatterSetId[];

/** Most plants one click adds, so a big brush can't flood the map with props. */
export const MAX_PER_DAB = 60;

/** Props without IDs (the caller numbers them). */
export type NewProp = Omit<PropEntity, 'id'>;

/**
 * Plants for one dab of the brush: a circle of `radius` m round (x, z),
 * standing on the terrain (or on `floorY` off it), kept `spacing` apart from
 * each other and from props already there, and clear of spawns, pickups and
 * vehicles. Deterministic for a given seed.
 */
export function scatterProps(doc: MapDocument, set: ScatterSetId, x: number, z: number, radius: number, floorY: number, seed: number): NewProp[] {
  const s: ScatterSet = SCATTER_SETS[set];
  const rand = mulberry(seed);
  const total = s.models.reduce((n, [, w]) => n + w, 0);
  const pick = () => {
    let r = rand() * total;
    for (const [m, w] of s.models) if ((r -= w) <= 0) return m;
    return s.models[0]![0];
  };
  const near = doc.entities.filter((e) => Math.hypot(e.position[0] - x, e.position[2] - z) < radius + s.spacing + 2);
  const taken: [number, number, number][] = near.map((e) => [e.position[0], e.position[2], keepClear(e, s.spacing)]);
  const out: NewProp[] = [];
  const tries = Math.ceil(((Math.PI * radius * radius) / (s.spacing * s.spacing)) * 2.5);
  for (let i = 0; i < tries && out.length < MAX_PER_DAB; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius;
    const px = x + Math.cos(a) * r;
    const pz = z + Math.sin(a) * r;
    if (taken.some(([tx, tz, d]) => Math.hypot(tx - px, tz - pz) < d)) continue;
    taken.push([px, pz, s.spacing]);
    const model = pick();
    const yaw = round(rand() * Math.PI * 2 - Math.PI);
    const scale = round(s.scale[0] + rand() * (s.scale[1] - s.scale[0]));
    // Bedded into the slope: the lowest ground under the footprint, so no edge hangs in the air.
    const ground = doc.terrain ? settledPropY(doc.terrain, { model, position: [px, 0, pz], yaw, scale }) : null;
    out.push({
      kind: 'prop',
      model,
      position: [round(px), ground ?? round(floorY - 0.05), round(pz)],
      yaw,
      scale,
      solid: true,
      tint: s.tint && /grass|fern/.test(model) && !model.startsWith('prop.mn_') ? s.tint : null,
    });
  }
  return out;
}

/** How far new plants stay from an existing entity: props by the brush's spacing, gameplay pieces by a little more. */
function keepClear(e: MapEntity, spacing: number): number {
  switch (e.kind) {
    case 'prop':
      return spacing * 0.9;
    case 'spawn':
    case 'pickup':
      return 2;
    case 'mount':
      return 4;
    default:
      return 1.5;
  }
}

const round = (v: number) => Math.round(v * 100) / 100;

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
