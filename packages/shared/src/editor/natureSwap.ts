import { getEnvSpecies } from '../content/environment.ts';
import type { MapDocument, PropEntity } from '../map/schema.ts';
import { cellKind } from '../map/terrain.ts';
import type { EditCommand } from './commands.ts';

/**
 * Swap natural props for ours (the nature swap, owner 2026-11-18; docs/PROCEDURAL_ENVIRONMENT.md, "The nature swap"):
 * MapMaker's Environment pane turns every bought or downloaded tree, bush, plant, log and rock on the map (the
 * Quaternius Ultimate Nature pack, the Kenney kit rocks, the Meshy community rock piles and spires) into our
 * generated species, keeping each one's spot, turn and name; its size is its scale times the table's factor, so the
 * new one stands about as tall and as wide as the old. One undo step; the ids stay, so groups, logic and links keep
 * pointing at them.
 *
 * Play is kept: trees keep a trunk (now its real capsules), bushes stay crouch cover (they conceal), rocks keep
 * blocking shots and movement. A placement the table has no match for (the Red Rock Spires, wide formations a
 * map maker builds as cliffs by hand) is left as it is and counted.
 */

/** One generated match for an old prop: species, look (variant name), size factor and, for a mix, its weight. */
export interface NatureTarget {
  readonly model: string;
  readonly look: string;
  /** New scale = old scale × k. */
  readonly k: number;
  /** Share among the old prop's targets (deterministic per placement id). Absent: 1. */
  readonly weight?: number;
}

const t = (model: string, look: string, k: number, weight?: number): NatureTarget => ({ model, look, k, ...(weight ? { weight } : {}) });

/**
 * The table: old prop id → its generated match (or a mix). Factors from the side-by-side sheet (old height and
 * footprint against the species' at scale 1). docs/PROCEDURAL_ENVIRONMENT.md lists it in words.
 */
export const NATURE_SWAP_TABLE: Readonly<Record<string, readonly NatureTarget[]>> = {
  // Quaternius Ultimate Nature: trees.
  'prop.nt_birch': [t('env.broadleaf.birch', 'summer', 0.74)],
  'prop.nt_birch_autumn': [t('env.broadleaf.birch', 'autumn', 0.74)],
  'prop.nt_birch_snow': [t('env.broadleaf.dead', 'pale', 1.43)],
  'prop.nt_common_tree': [t('env.broadleaf.oak', 'summer', 0.8, 2), t('env.broadleaf.maple', 'summer', 1.0, 1)],
  'prop.nt_common_tree_2': [t('env.broadleaf.maple', 'summer', 0.93)],
  'prop.nt_common_tree_autumn': [t('env.broadleaf.oak', 'autumn', 0.8, 2), t('env.broadleaf.maple', 'autumn', 1.0, 1)],
  'prop.nt_common_tree_snow': [t('env.broadleaf.dead', 'pale', 1.25)],
  'prop.nt_dead_tree': [t('env.broadleaf.dead', 'bare', 1.07)],
  'prop.nt_pine_tall': [t('env.conifer.pine_tall', 'summer', 0.82)],
  'prop.nt_pine_small': [t('env.conifer.spruce', 'summer', 0.67)],
  'prop.nt_pine_snow_tall': [t('env.conifer.pine_tall', 'snow', 0.82)],
  'prop.nt_pine_autumn': [t('env.conifer.larch', 'autumn', 0.62)],
  'prop.nt_palm_curved': [t('env.palm.leaning', 'green', 0.8)],
  'prop.nt_palm_tall': [t('env.palm.coconut', 'green', 0.74)],
  'prop.nt_willow': [t('env.broadleaf.jungle', 'green', 0.54)],
  'prop.nt_willow_autumn': [t('env.broadleaf.jungle', 'dry', 0.54)],
  'prop.nt_willow_dead': [t('env.broadleaf.dead', 'bare', 1.07)],
  'prop.nt_saguaro': [t('env.cactus.saguaro', 'green', 1.04)],
  // Plants and flowers (the bushes stay cover you hide in).
  'prop.nt_cactus_round': [t('env.cactus.barrel', 'green', 1.29)],
  'prop.nt_cactus_flowers': [t('env.cactus.barrel', 'green', 1.07)],
  'prop.nt_bush_leafy': [t('env.shrub.broadleaf', 'summer', 0.82, 3), t('env.shrub.laurel', 'green', 0.6, 1)],
  'prop.nt_bush_berries': [t('env.shrub.laurel', 'green', 0.54)],
  'prop.nt_bush_snow': [t('env.shrub.sagebrush', 'grey', 1.0)],
  'prop.nt_corn': [t('env.grass.tall', 'summer', 2.3)],
  'prop.nt_wheat': [t('env.grass.tall', 'dry', 1.16)],
  'prop.nt_wildflowers': [t('env.flower.meadow', 'white', 1), t('env.flower.meadow', 'yellow', 1), t('env.flower.meadow', 'purple', 1), t('env.flower.meadow', 'red', 1)],
  'prop.nt_fern_wide': [t('env.fern.bracken', 'summer', 1.6)],
  // Rocks and wood.
  'prop.nt_boulder_tall': [t('env.rock.boulder_shard', 'bare', 1.19)],
  'prop.nt_boulder': [t('env.rock.boulder_angular', 'bare', 0.85), t('env.rock.boulder_round', 'bare', 0.85)],
  'prop.nt_rock_flat': [t('env.rock.boulder_angular', 'bare', 0.54)],
  'prop.nt_boulder_moss': [t('env.rock.boulder_shard', 'lichen', 1.08)],
  'prop.nt_rock_moss': [t('env.rock.boulder_round', 'moss', 0.86)],
  'prop.nt_boulder_snow': [t('env.rock.boulder_shard', 'snow', 1.08)],
  'prop.nt_rock_snow': [t('env.rock.boulder_angular', 'bare', 0.81)],
  'prop.nt_stump_large': [t('env.deadwood.log', 'bare', 1.2)],
  'prop.nt_stump_moss': [t('env.deadwood.log', 'moss', 1.2)],
  'prop.nt_log_large': [t('env.deadwood.log', 'bare', 1.12)],
  'prop.nt_log_moss': [t('env.deadwood.log', 'moss', 1.22)],
  'prop.nt_log_snow': [t('env.deadwood.log', 'bare', 1.4)],
  // Kit rocks (Kenney nature, survival and graveyard kits), the Loafbrr cave rocks and the Meshy community rocks.
  'prop.rock_large': [t('env.rock.boulder_round', 'bare', 1.0), t('env.rock.boulder_angular', 'bare', 0.95)],
  'prop.rock_medium': [t('env.rock.boulder_angular', 'bare', 0.68)],
  'prop.rock_small': [t('env.rock.boulder_angular', 'bare', 0.47)],
  'prop.boulder_jagged': [t('env.rock.outcrop', 'bare', 1.1)],
  'prop.boulder_flat': [t('env.rock.outcrop', 'bare', 0.65)],
  'prop.boulder_round': [t('env.rock.outcrop', 'bare', 1.3)],
  'prop.rocks_tall': [t('env.rock.outcrop', 'bare', 1.0)],
  'prop.rock_spire_tall': [t('env.rock.boulder_shard', 'bare', 2.2)],
  'prop.rock_pile': [t('env.rock.boulder_angular', 'bare', 0.9)],
  'prop.rock_mossy_spire': [t('env.rock.boulder_angular', 'moss', 1.25)],
  'prop.mc_cave_rocks_b': [t('env.rock.boulder_shard', 'bare', 1.29)],
  'prop.mc_cave_rocks_d': [t('env.rock.boulder_angular', 'bare', 1.05)],
};

/**
 * How rocks come out: as the table lists them; mossy (boulders moss, shards lichen); sandstone (boulders as the
 * Sandstone Boulder, for desert ground); or auto: sandstone where the map's ground is mostly sand, else as listed.
 */
export const NATURE_ROCK_LOOKS = ['auto', 'listed', 'moss', 'sandstone'] as const;
export type NatureRockLook = (typeof NATURE_ROCK_LOOKS)[number];
export const NATURE_ROCK_LOOK_LABELS: Record<NatureRockLook, string> = { auto: 'Rocks: by the ground', listed: 'Rocks: grey (as listed)', moss: 'Rocks: mossy', sandstone: 'Rocks: sandstone' };

/** Boulders the rock look may change (shards keep their shape; mossy ones turn lichen). */
const BOULDERS = new Set(['env.rock.boulder_angular', 'env.rock.boulder_round', 'env.rock.outcrop', 'env.rock.slab']);
const SANDSTONE = 'env.rock.sandstone';
/** The map's ground counts as desert from this share of sand cells. */
const SANDY = 0.4;

/** True when the old prop is one the swap replaces. */
export const natureSwapHas = (model: string): boolean => model in NATURE_SWAP_TABLE;

/** A placement id's stable pick among weighted targets (FNV-1a over the id). */
function pick(id: string, targets: readonly NatureTarget[]): NatureTarget {
  if (targets.length === 1) return targets[0]!;
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  const total = targets.reduce((s, x) => s + (x.weight ?? 1), 0);
  let r = (h / 0x100000000) * total;
  for (const x of targets) if ((r -= x.weight ?? 1) < 0) return x;
  return targets.at(-1)!;
}

/** The rock look `auto` resolves to for this map: sandstone on mostly sandy ground. */
export function autoRockLook(doc: MapDocument): Exclude<NatureRockLook, 'auto'> {
  const terr = doc.terrain;
  if (!terr || !terr.materials.length) return 'listed';
  let sand = 0;
  for (let i = 0; i < terr.materials.length; i++) if (cellKind(terr, i) === 'sand') sand++;
  return sand / terr.materials.length >= SANDY ? 'sandstone' : 'listed';
}

/** A target with the rock look applied. */
export function withRockLook(target: NatureTarget, look: Exclude<NatureRockLook, 'auto'>): NatureTarget {
  if (look === 'listed') return target;
  if (look === 'moss') {
    if (BOULDERS.has(target.model)) return { ...target, look: 'moss' };
    if (target.model === 'env.rock.boulder_shard' && target.look === 'bare') return { ...target, look: 'lichen' };
    return target;
  }
  if (!BOULDERS.has(target.model)) return target;
  // As tall and as wide as the boulder it stands for, between the two (the sandstone boulder is low and broad).
  const from = getEnvSpecies(target.model)!.variants[0]!.size;
  const to = getEnvSpecies(SANDSTONE)!.variants[0]!.size;
  const ratio = Math.sqrt((from[1] / to[1]) * (Math.max(from[0], from[2]) / Math.max(to[0], to[2])));
  return { model: SANDSTONE, look: 'tan', k: Math.round(target.k * ratio * 1000) / 1000 };
}

/** The generated placement for one old one (null: not in the table). */
export function natureSwapEntity(e: PropEntity, look: Exclude<NatureRockLook, 'auto'> = 'listed'): PropEntity | null {
  const targets = NATURE_SWAP_TABLE[e.model];
  if (!targets) return null;
  const target = withRockLook(pick(e.id, targets), look);
  const species = getEnvSpecies(target.model);
  if (!species) throw new Error(`nature swap: no species ${target.model}`);
  const variant = species.variants.find((v) => v.name === target.look);
  if (!variant) throw new Error(`nature swap: ${target.model} has no look ${target.look}`);
  const scale = Math.min(4, Math.max(0.25, Math.round((e.scale ?? 1) * target.k * 1000) / 1000));
  const { variant: _v, tint: _t, health, unbreakable, ...rest } = e;
  // Only logs can be made breakable (envCanBreak); the rest drop a health they could not use.
  const wood = species.category === 'deadwood';
  return { ...rest, model: target.model, scale, tint: null, ...(variant.index ? { variant: variant.index } : {}), ...(wood && health !== undefined ? { health } : {}), ...(wood && unbreakable !== undefined ? { unbreakable } : {}) } as PropEntity;
}

export interface NatureSwapResult {
  /** The edit (null: nothing on the map to swap). */
  readonly command: (EditCommand & { kind: 'updateEntities' }) | null;
  /** Swapped, by old prop id. */
  readonly swapped: Readonly<Record<string, number>>;
  /** The rock look used (auto resolved). */
  readonly rockLook: Exclude<NatureRockLook, 'auto'>;
  /** Placements whose size reached MapMaker's limits (0.25 to 4). */
  readonly clamped: number;
}

/** The whole map's swap as one edit. */
export function natureSwapCommand(doc: MapDocument, look: NatureRockLook = 'auto'): NatureSwapResult {
  const rockLook = look === 'auto' ? autoRockLook(doc) : look;
  const before: PropEntity[] = [];
  const after: PropEntity[] = [];
  const swapped: Record<string, number> = {};
  let clamped = 0;
  for (const e of doc.entities) {
    if (e.kind !== 'prop') continue;
    const next = natureSwapEntity(e, rockLook);
    if (!next) continue;
    const want = (e.scale ?? 1) * withRockLook(pick(e.id, NATURE_SWAP_TABLE[e.model]!), rockLook).k;
    if (want > 4 || want < 0.25) clamped++;
    before.push(e);
    after.push(next);
    swapped[e.model] = (swapped[e.model] ?? 0) + 1;
  }
  return { command: before.length ? { kind: 'updateEntities', before, after } : null, swapped, rockLook, clamped };
}
