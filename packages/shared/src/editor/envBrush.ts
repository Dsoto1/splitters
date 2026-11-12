import { ENV_SPECIES, envVariant, getEnvSpecies, isEnvModel, type EnvCategory, type EnvSpeciesData } from '../content/environment.ts';
import { createRng } from '../math.ts';
import type { MapDocument, MapEntity, PropEntity } from '../map/schema.ts';
import { settledPropY } from '../map/settle.ts';
import { TERRAIN_MATERIALS, terrainHeightAt, type TerrainData, type TerrainMaterial } from '../map/terrain.ts';
import { pathGeometry } from '../map/track.ts';
import { placementCells } from './operations.ts';
import { allowedScale } from './propRandom.ts';
import type { NewProp } from './scatter.ts';

/**
 * Environment Phase 3 (docs/PROCEDURAL_ENVIRONMENT.md §8): MapMaker's environment brush. It paints and erases our
 * species (`env.*`) as ordinary props, so every placement is stored with its own transform (authoritative: the host,
 * every client and the navmesh read the same trees, boulders and cliffs), and the map round-trips through import
 * and export unchanged. A dab is deterministic: the same brush settings, seed and spot give the same plants.
 *
 * Filters keep plants to the ground you want (slope, altitude, ground material, not inside buildings), and anything
 * that blocks play (movement or sight: trunks, boulders, cliffs, hedges, concealing bushes) keeps clear of spawns,
 * routes and objectives unless the author turns that off (MapMaker asks first). Ground cover that blocks nothing may
 * go anywhere.
 */

/** One species in the brush's mix: its weight (0: not painted) and variant (absent: the first; 'any': a random one each). */
export interface EnvBrushSpecies {
  model: string;
  variant?: number | 'any';
  weight: number;
}

export interface EnvFilters {
  /** Ground slope allowed, degrees [least, most] (a species' own steepest still applies). */
  slope: [number, number];
  /** Ground height allowed, metres; null ends are open. */
  altitude: [number | null, number | null];
  /** Terrain materials painted on; null: any. */
  materials: TerrainMaterial[] | null;
  /** Things that block play keep clear of spawns, routes and objectives (on by default; off asks first). */
  keepClear: boolean;
}

export interface EnvBrush {
  species: EnvBrushSpecies[];
  /** Plants per 100 m² the brush aims for (spacing may allow fewer). */
  density: number;
  /** Brush radius, metres. */
  radius: number;
  /** The brush's seed: the same seed and spot give the same plants. */
  seed: number;
  /** Size variation: each plant's scale in this range (kept within its species' own range). */
  size: [number, number];
  /** Turn variation: degrees either side of north (180: any way). */
  turn: number;
  filters: EnvFilters;
}

export const ENV_PRESET_IDS = ['temperate', 'jungle', 'alpine', 'arid'] as const;
export type EnvPresetId = (typeof ENV_PRESET_IDS)[number];

/** A species of a preset, its variant by name (resolved to the species' index). */
type PresetEntry = readonly [model: string, weight: number, variant?: string | 'any'];

interface EnvPreset {
  label: string;
  species: readonly PresetEntry[];
  /** The ground it suits (the brush's material filter when the preset is picked); null: any. */
  materials: readonly TerrainMaterial[] | null;
  density: number;
}

/** Biome presets (§8). A preset only sets the mix and filters: any species can be added to any mix. */
export const ENV_PRESETS: Record<EnvPresetId, EnvPreset> = {
  temperate: {
    label: 'Temperate woods',
    species: [['env.broadleaf.oak', 3], ['env.broadleaf.maple', 3], ['env.conifer.pine_tall', 1], ['env.shrub.broadleaf', 3], ['env.fern.bracken', 3], ['env.grass.clump', 6], ['env.flower.meadow', 2, 'any'], ['env.rock.boulder_angular', 0.5, 'moss'], ['env.rock.pebbles', 1]],
    materials: ['grass', 'dirt', 'moss', 'mud'],
    density: 6,
  },
  jungle: {
    label: 'Jungle',
    species: [['env.palm.coconut', 2], ['env.palm.leaning', 2], ['env.broadleaf.acacia', 1], ['env.shrub.laurel', 3], ['env.shrub.broadleaf', 2], ['env.fern.bracken', 5], ['env.grass.clump', 3], ['env.rock.boulder_angular', 0.5, 'moss']],
    materials: ['grass', 'dirt', 'moss', 'mud', 'sand'],
    density: 10,
  },
  alpine: {
    label: 'Alpine',
    species: [['env.conifer.spruce', 4], ['env.conifer.pine_tall', 3], ['env.rock.boulder_angular', 2], ['env.rock.pebbles', 2], ['env.grass.clump', 2], ['env.fern.bracken', 1]],
    materials: ['grass', 'dirt', 'stone', 'gravel', 'snow', 'moss'],
    density: 4,
  },
  arid: {
    label: 'Arid',
    species: [['env.cactus.saguaro', 3], ['env.broadleaf.acacia', 1, 'dry'], ['env.shrub.laurel', 1, 'dry'], ['env.grass.clump', 3, 'dry'], ['env.rock.pebbles', 2, 'sand'], ['env.rock.boulder_angular', 1]],
    materials: ['sand', 'dirt', 'gravel', 'stone'],
    density: 3,
  },
};

/** A preset's mix as brush species: every species listed (the preset's own weighted, the rest at 0). */
export function presetSpecies(id: EnvPresetId): EnvBrushSpecies[] {
  const p = ENV_PRESETS[id];
  return ENV_SPECIES.map((s) => {
    const hit = p.species.find(([m]) => m === s.id);
    if (!hit) return { model: s.id, weight: 0 };
    const [, weight, name] = hit;
    const variant = name === 'any' ? 'any' : name ? s.variants.find((v) => v.name === name)?.index : undefined;
    return { model: s.id, weight, ...(variant !== undefined && variant !== 0 ? { variant } : {}) };
  });
}

/** The brush with a preset picked: its mix, density and ground; size, turn, radius, seed and the other filters kept. */
export function withPreset(brush: EnvBrush, id: EnvPresetId): EnvBrush {
  const p = ENV_PRESETS[id];
  return { ...brush, species: presetSpecies(id), density: p.density, filters: { ...brush.filters, materials: p.materials ? [...p.materials] : null } };
}

export const ENV_BRUSH_DEFAULTS: EnvBrush = {
  ...{ species: presetSpecies('temperate'), density: ENV_PRESETS.temperate.density },
  radius: 10,
  seed: 1,
  size: [0.85, 1.2],
  turn: 180,
  filters: { slope: [0, 40], altitude: [null, null], materials: null, keepClear: true },
};

/** Most plants one dab adds (a big brush can't flood the map in one click). */
export const MAX_ENV_PER_DAB = 150;

/** How a species affects play (MapMaker's collision and nav preview, and keep-clear). */
export interface EnvImpact {
  /** Stops players and bots walking (a trunk, a boulder, a cliff, a hedge): bots route round it. */
  movement: boolean;
  /** Stops shots (a limb overhead counts). */
  shots: boolean;
  /** Blocks sight: solid, or a bush you hide in. */
  sight: boolean;
  /** How far from the placement what blocks reaches, at scale 1 (m): trunks and boulders, or the hiding cylinder. */
  reach: number;
}

const impacts = new Map<string, EnvImpact>();
/** What a species variant blocks. Plants that block nothing (grass, flowers, pebbles) may go anywhere. */
export function envImpact(model: string, variant?: number): EnvImpact {
  const key = `${model}#${variant ?? 0}`;
  const hit = impacts.get(key);
  if (hit) return hit;
  const s = getEnvSpecies(model);
  const out: EnvImpact = { movement: false, shots: false, sight: false, reach: 0 };
  if (s) {
    for (const sh of envVariant(s, variant).shapes) {
      out.shots = true;
      out.sight = true;
      if (sh.blocks === 'all') out.movement = true;
      // Reach only of what stands at ground level (limbs overhead are shots and sight only).
      const pts: readonly (readonly [number, number, number])[] = sh.kind === 'capsule' ? [sh.a, sh.b] : sh.kind === 'box' ? [sh.min, sh.max, [sh.min[0], 0, sh.max[2]], [sh.max[0], 0, sh.min[2]]] : sh.kind === 'hull' ? sh.points : [];
      const pad = sh.kind === 'capsule' ? sh.r : 0;
      if (sh.kind === 'mesh') for (let i = 0; i < sh.positions.length; i += 3) out.reach = Math.max(out.reach, Math.hypot(sh.positions[i]!, sh.positions[i + 2]!));
      if (sh.blocks === 'all') for (const p of pts) out.reach = Math.max(out.reach, Math.hypot(p[0], p[2]) + pad);
    }
    if (s.conceals) {
      out.sight = true;
      out.reach = Math.max(out.reach, s.conceals.radius);
    }
    if (s.nav !== 'none' && !out.movement) out.movement = true;
    out.reach = Math.round(out.reach * 100) / 100;
  }
  impacts.set(key, out);
  return out;
}

/** Does this species (variant) block play: movement or sight? */
export const envBlocksPlay = (model: string, variant?: number): boolean => {
  const i = envImpact(model, variant);
  return i.movement || i.sight;
};

/** A place to keep clear of: a spawn, a route (or road, or track), an objective, a vehicle or pickup. */
export interface KeepClearZone {
  kind: 'spawn' | 'route' | 'objective' | 'vehicle' | 'pickup';
  /** What it is, for the author ("Player Spawn", "route path_3", "Flag Base"). */
  label: string;
  id: string;
  /** Is a circle `r` m round (x, z) on it? */
  hits(x: number, z: number, r: number): boolean;
}

const OBJECTIVE_LABEL: Partial<Record<MapEntity['kind'], string>> = { flag: 'Flag Base', hill: 'Hill', objective: 'Objective', bombsite: 'Bomb Site', hostage: 'Hostage', rescue: 'Rescue Zone' };

/** The map's keep-clear zones: spawns (3 m), objectives (their radius, at least 3 m), vehicles (4 m), pickups (1.5 m), every path (its width, 1 m either side). */
export function keepClearZones(doc: MapDocument): KeepClearZone[] {
  const out: KeepClearZone[] = [];
  const circle = (kind: KeepClearZone['kind'], label: string, id: string, x: number, z: number, radius: number): KeepClearZone => ({ kind, label, id, hits: (px, pz, r) => Math.hypot(px - x, pz - z) < radius + r });
  for (const e of doc.entities) {
    const [x, , z] = e.position;
    if (e.kind === 'spawn') out.push(circle('spawn', 'Player Spawn', e.id, x, z, 3));
    else if (e.kind === 'mount') out.push(circle('vehicle', 'vehicle', e.id, x, z, 4));
    else if (e.kind === 'pickup') out.push(circle('pickup', 'pickup', e.id, x, z, 1.5));
    else if (OBJECTIVE_LABEL[e.kind]) out.push(circle('objective', OBJECTIVE_LABEL[e.kind]!, e.id, x, z, Math.max(3, 'radius' in e && typeof e.radius === 'number' ? e.radius : 0)));
  }
  for (const p of doc.paths ?? []) {
    if (p.points.length < 2) continue;
    const g = pathGeometry(p);
    const half = p.width / 2 + 1;
    const what = p.uses.includes('route') && !p.uses.includes('road') ? 'route' : p.uses.includes('race') ? 'track' : 'road';
    // A quick box test first: most tries are nowhere near most paths.
    const xs = g.samples.map((s) => s.x);
    const zs = g.samples.map((s) => s.z);
    const box = [Math.min(...xs) - half, Math.max(...xs) + half, Math.min(...zs) - half, Math.max(...zs) + half] as const;
    out.push({ kind: 'route', label: `${what} ${p.id}`, id: p.id, hits: (x, z, r) => x > box[0] - r && x < box[1] + r && z > box[2] - r && z < box[3] + r && !!g.nearest(x, z, half + r) });
  }
  return out;
}

/** The first zone a circle of `r` m round (x, z) is on, or null. */
export function keepClearHit(zones: readonly KeepClearZone[], x: number, z: number, r: number): KeepClearZone | null {
  for (const zone of zones) if (zone.hits(x, z, r)) return zone;
  return null;
}

/**
 * What a placement of `model` at (x, z) would stand on, if it blocks play: the zone, or null (it blocks nothing, or is
 * clear). MapMaker asks before placing it there.
 */
export function blockingPlacement(doc: MapDocument, model: string, x: number, z: number, scale = 1, variant?: number, zones = keepClearZones(doc)): KeepClearZone | null {
  if (!isEnvModel(model) || !envBlocksPlay(model, variant)) return null;
  return keepClearHit(zones, x, z, envImpact(model, variant).reach * scale);
}

/** The ground under a point: its height, slope (degrees) and terrain material (null off the terrain or on a floor). */
export interface GroundSample {
  y: number;
  slope: number;
  material: TerrainMaterial | null;
}

/** Ground from the terrain MapMaker shows (`shownGround`), or a flat floor at `floorY` where there is none. */
export function groundSampler(t: TerrainData | null, floorY = 0): (x: number, z: number) => GroundSample | null {
  if (!t) return () => ({ y: floorY, slope: 0, material: null });
  const d = t.spacing / 2;
  return (x, z) => {
    const y = terrainHeightAt(t, x, z);
    if (y === null) return null;
    const h = (px: number, pz: number) => terrainHeightAt(t, px, pz) ?? y;
    const gx = (h(x + d, z) - h(x - d, z)) / (2 * d);
    const gz = (h(x, z + d) - h(x, z - d)) / (2 * d);
    const slope = (Math.atan(Math.hypot(gx, gz)) * 180) / Math.PI;
    const c = Math.min(t.cols - 2, Math.floor((x - t.origin[0]) / t.spacing));
    const r = Math.min(t.rows - 2, Math.floor((z - t.origin[1]) / t.spacing));
    const material = TERRAIN_MATERIALS[t.materials[r * (t.cols - 1) + c] ?? 0] ?? null;
    return { y, slope, material };
  };
}

/** Grid cells (`x,y` at or above ground level) that tiles fill: plants are never painted inside buildings. */
export function builtCells(doc: MapDocument): Set<string> {
  const out = new Set<string>();
  for (const t of doc.classicStructure.tiles) for (const [x, y, z] of placementCells(t) ?? []) if (z >= 0) out.add(`${x},${y}`);
  return out;
}

/** A dab's own seed: from the brush's seed and the spot (to the half metre), so the same spot repaints the same. */
export function envDabSeed(seed: number, x: number, z: number): number {
  let h = Math.imul((seed >>> 0) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ Math.round(x * 2), 0xc2b2ae35);
  h = Math.imul(h ^ Math.round(z * 2), 0x27d4eb2f);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Canopy (trees, boulders, cliffs, hedges, fallen logs) or undergrowth (shrubs, ferns, grass, pebbles): each layer spaces only within itself. */
const CANOPY: ReadonlySet<EnvCategory> = new Set(['tree', 'boulder', 'cliff', 'deadwood']);
const layerOf = (s: EnvSpeciesData): 'canopy' | 'under' => (CANOPY.has(s.category) || s.role === 'blocking' ? 'canopy' : 'under');
const spacingOf = (s: EnvSpeciesData): number => Math.max(0.3, s.placement.minSpacing);

/** What a dab did: the plants to add, and how many tries each filter turned away (the pane says so). */
export interface EnvDabResult {
  plants: NewProp[];
  /** Turned away by slope, altitude, ground material or a building. */
  filtered: number;
  /** Held back to keep spawns, routes and objectives clear. */
  keptClear: number;
  /** The first zone a plant was held back from (the status line names it). */
  clearOf: KeepClearZone | null;
  /** Stopped by the map's environment budget. */
  overBudget: boolean;
}

export interface EnvDabContext {
  ground: (x: number, z: number) => GroundSample | null;
  /** The terrain to bed plants into (the shown ground); null: they stand on the sample's height. */
  terrain: TerrainData | null;
  zones?: readonly KeepClearZone[];
  built?: ReadonlySet<string>;
  /** Placements the environment budget still allows: all, and those that collide. */
  room?: { placements: number; colliding: number };
}

/**
 * One dab of the brush at (x, z): plants for a circle of the brush's radius, picked by weight, spaced (each layer
 * within itself; undergrowth keeps off trunks), filtered, kept clear and within budget. Deterministic.
 */
export function envBrushDab(doc: MapDocument, brush: EnvBrush, x: number, z: number, ctx: EnvDabContext): EnvDabResult {
  const result: EnvDabResult = { plants: [], filtered: 0, keptClear: 0, clearOf: null, overBudget: false };
  const mix = brush.species.map((m) => ({ m, s: getEnvSpecies(m.model) })).filter((x): x is { m: EnvBrushSpecies; s: EnvSpeciesData } => !!x.s && x.m.weight > 0);
  const total = mix.reduce((n, x) => n + x.m.weight, 0);
  if (!mix.length || total <= 0) return result;
  const r = Math.max(0.5, brush.radius);
  const rand = createRng(envDabSeed(brush.seed, x, z));
  const cs = doc.classicStructure.cellSize;
  const built = ctx.built ?? builtCells(doc);
  const zones = brush.filters.keepClear ? (ctx.zones ?? keepClearZones(doc)) : [];
  const room = ctx.room ? { ...ctx.room } : { placements: Infinity, colliding: Infinity };
  // What is already there: env plants by layer, other props and gameplay pieces as small circles.
  type Taken = { x: number; z: number; layer: 'canopy' | 'under' | 'thing'; spacing: number; reach: number };
  const taken: Taken[] = [];
  const reachOut = r + 8;
  for (const e of doc.entities) {
    if (Math.abs(e.position[0] - x) > reachOut || Math.abs(e.position[2] - z) > reachOut) continue;
    const s = e.kind === 'prop' ? getEnvSpecies(e.model) : undefined;
    if (s && e.kind === 'prop') taken.push({ x: e.position[0], z: e.position[2], layer: layerOf(s), spacing: spacingOf(s) * e.scale, reach: envImpact(e.model, e.variant).reach * e.scale });
    else taken.push({ x: e.position[0], z: e.position[2], layer: 'thing', spacing: e.kind === 'prop' ? 1 : 1.5, reach: 0 });
  }
  const target = Math.min(MAX_ENV_PER_DAB, Math.max(1, Math.round((brush.density * Math.PI * r * r) / 100)));
  const tries = target * 4;
  const [smin, smax] = brush.size[0] <= brush.size[1] ? brush.size : [brush.size[1], brush.size[0]];
  const [amin, amax] = brush.filters.altitude;
  const mats = brush.filters.materials;
  for (let i = 0; i < tries && result.plants.length < target; i++) {
    // Every try draws the same numbers, so one filter's verdict never shifts the next try's plant.
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand()) * r;
    const pickAt = rand() * total;
    const sizeAt = rand();
    const turnAt = rand();
    const variantAt = rand();
    const px = x + Math.cos(a) * rr;
    const pz = z + Math.sin(a) * rr;
    let acc = 0;
    const chosen = mix.find((c) => (acc += c.m.weight) >= pickAt) ?? mix[mix.length - 1]!;
    const { s, m } = chosen;
    const variant = m.variant === 'any' ? s.variants[Math.floor(variantAt * s.variants.length)]!.index : m.variant;
    const g = ctx.ground(px, pz);
    if (!g) {
      result.filtered++;
      continue;
    }
    const steepest = Math.min(brush.filters.slope[1], s.placement.maxSlopeDegrees);
    const offGround = g.slope < brush.filters.slope[0] || g.slope > steepest || (amin !== null && g.y < amin) || (amax !== null && g.y > amax) || (mats !== null && g.material !== null && !mats.includes(g.material));
    if (offGround || built.has(`${Math.round(px / cs)},${Math.round(pz / cs)}`)) {
      result.filtered++;
      continue;
    }
    const [lo, hi] = allowedScale(s.id);
    const scale = round(Math.max(lo, Math.min(hi, smin + sizeAt * (smax - smin))));
    const layer = layerOf(s);
    const spacing = spacingOf(s) * scale;
    const reach = envImpact(s.id, variant).reach * scale;
    const crowded = taken.some((t) => {
      const d = Math.hypot(t.x - px, t.z - pz);
      if (t.layer === 'thing') return d < t.spacing + reach;
      if (t.layer === layer) return d < (t.spacing + spacing) / 2;
      // Across layers only a trunk or boulder keeps the other off.
      return d < Math.max(t.reach, reach) * 0.9 + 0.2;
    });
    if (crowded) continue;
    if (zones.length && envBlocksPlay(s.id, variant)) {
      const hit = keepClearHit(zones, px, pz, reach);
      if (hit) {
        result.keptClear++;
        result.clearOf ??= hit;
        continue;
      }
    }
    const colliding = s.nav !== 'none';
    if (room.placements <= 0 || (colliding && room.colliding <= 0)) {
      result.overBudget = true;
      continue;
    }
    room.placements--;
    if (colliding) room.colliding--;
    taken.push({ x: px, z: pz, layer, spacing, reach });
    const yaw = round(((turnAt * 2 - 1) * Math.min(180, Math.max(0, brush.turn)) * Math.PI) / 180);
    const at: [number, number, number] = [round(px), 0, round(pz)];
    const bed = ctx.terrain ? settledPropY(ctx.terrain, { model: s.id, position: at, yaw, scale }) : null;
    at[1] = bed ?? round(g.y - 0.03);
    result.plants.push({ kind: 'prop', model: s.id, position: at, yaw, scale, solid: true, tint: null, ...(variant !== undefined && variant !== 0 ? { variant } : {}) });
  }
  return result;
}

/** Environment placements a dab of the eraser takes: within `radius` of (x, z), of these species (null: any species). */
export function envEraseDab(doc: MapDocument, x: number, z: number, radius: number, models: ReadonlySet<string> | null): PropEntity[] {
  return doc.entities.filter((e): e is PropEntity => e.kind === 'prop' && isEnvModel(e.model) && (!models || models.has(e.model)) && Math.hypot(e.position[0] - x, e.position[2] - z) <= radius);
}

/** The species the brush paints (weight above 0), for the eraser's "only these" mode. */
export const brushModels = (brush: EnvBrush): Set<string> => new Set(brush.species.filter((s) => s.weight > 0).map((s) => s.model));

const round = (v: number) => Math.round(v * 100) / 100;
