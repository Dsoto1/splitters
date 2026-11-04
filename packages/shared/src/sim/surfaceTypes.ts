/**
 * Surface types (content/surface-types.json, docs/CONTENT_PIPELINE.md "Surface types"): what a surface is made of,
 * for gameplay. One list for the server and the client: each type names its ballistic class (gunplay.ts
 * MATERIAL_BALLISTICS: what the server does to a round) and its impact (what the client draws and plays), so the two
 * can't disagree for anything that names its type.
 *
 * A library material (content/materials.json `surface`) or a prop (content/props/<pack>.json `surface`) names its
 * type. One that doesn't keeps today's guesses: the ballistic class from gunplay.ts materialClass, the effect from
 * the words in content/surface-types.json `guess` (what content/vfx.json map.surfaces held). Both retire as entries
 * get a surface.
 */
import type { BallisticMaterial } from './gunplay.ts';
import { PROP_SURFACES, SURFACE_GUESS, SURFACE_TYPE_IDS, SURFACE_TYPE_LIST } from '../content/surfaceTypes.generated.ts';
import { CORE_MATERIALS } from '../content/materials.generated.ts';

export { SURFACE_TYPE_IDS };
export type SurfaceTypeId = (typeof SURFACE_TYPE_IDS)[number];

/** The decal a round leaves: a bullet hole, or nothing (foliage, water, flesh, force fields). */
export type ImpactDecal = 'hole' | 'none';
/** What flies off a hit: dust puffs, splinters (wood), chips (stone, brick, glass grit), leaves, sparks. */
export type ImpactDebris = 'dust' | 'splinters' | 'chips' | 'leaves' | 'sparks';
/** The impact sound's family (client: impact.world, impact.wood, impact.metal, impact.soft, impact.glass, water.splash). */
export type ImpactSound = 'hard' | 'wood' | 'metal' | 'soft' | 'glass' | 'water' | 'none';
/** Footstep family, for later (not played yet). */
export type FootstepFamily = 'hard' | 'wood' | 'metal' | 'soft' | 'foliage' | 'sand' | 'gravel' | 'snow' | 'water';

export interface SurfaceTypeDefinition {
  readonly id: SurfaceTypeId;
  readonly name: string;
  /** Its ballistic class (penetration resistance, ricochet, destruction: gunplay.ts MATERIAL_BALLISTICS). */
  readonly ballistic: BallisticMaterial;
  readonly impact: { readonly decal: ImpactDecal; readonly debris: readonly ImpactDebris[]; readonly sound: ImpactSound };
  readonly footstep?: FootstepFamily;
}

export const SURFACE_TYPES: Readonly<Record<SurfaceTypeId, SurfaceTypeDefinition>> = Object.fromEntries(SURFACE_TYPE_LIST.map((t) => [t.id, t])) as Record<SurfaceTypeId, SurfaceTypeDefinition>;

export const isSurfaceType = (id: string): id is SurfaceTypeId => id in SURFACE_TYPES;

/** The surface a prop model (`prop.<id>`) names in its pack file, if it does. */
export const propSurfaceOf = (model: string): SurfaceTypeId | undefined => PROP_SURFACES[model];

const MATERIALS = new Map(CORE_MATERIALS.map((m) => [m.id, m]));

/** The surface a library material names in content/materials.json, if it does. */
export const materialSurfaceOf = (id: string | null | undefined): SurfaceTypeId | undefined => (id ? MATERIALS.get(id)?.surface : undefined);

/** The ballistic class a library material sets in content/materials.json: its `ballistic`, else its surface's, if either is set. */
export function materialBallisticOf(id: string | null | undefined): BallisticMaterial | undefined {
  const m = id ? MATERIALS.get(id) : undefined;
  if (!m) return undefined;
  return m.ballistic ?? (m.surface ? SURFACE_TYPES[m.surface].ballistic : undefined);
}

/** The legacy effect guess for a name with no surface: the first type whose words it contains, else the fallback. */
export function guessSurface(name: string): SurfaceTypeId {
  const n = name.toLowerCase();
  for (const [s, words] of SURFACE_GUESS.words) if (words.some((w) => n.includes(w))) return s;
  return SURFACE_GUESS.fallback;
}

/** The surface type a prop's impacts look and sound like: its own, else the guess from its model id. */
export const propSurface = (model: string): SurfaceTypeId => propSurfaceOf(model) ?? guessSurface(model);

/** The surface type a library material's impacts look and sound like: its own, else the guess from its id. */
export const materialSurface = (id: string): SurfaceTypeId => materialSurfaceOf(id) ?? guessSurface(id);
