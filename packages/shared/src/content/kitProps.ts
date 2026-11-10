/**
 * Kit props (docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6; docs/CONTENT_PIPELINE.md, "Kit props"): simple man-made
 * props generated in code from seeds by tools/content/kitprops.mjs, families `kit.<type>.<name>`.
 *
 * A family is an ordinary catalogue prop (content/props.ts `CORE_PROPS`, `getProp`): its size, collision box,
 * category, surface and breakable data are the family's, so collision, settling, budgets, MapMaker and the hub treat it
 * like any prop. Its variants (`PropEntity.variant`, as for the environment species) share all of that and differ only
 * in how they are drawn: each has its own model file (`kitModelFile`). Gameplay never depends on the variant.
 *
 * Retired catalogue props that a family replaces have an alias (content/kitprops.json `aliases`): as played, loadMap
 * gives their placements the family and variant instead (`withPropAliases`), so saved maps and old files upgrade with
 * no edit; MapMaker opens a map as made and offers "Replace all". The families take the retired props' exact sizes,
 * so an alias leaves collision as it was.
 */
import { KIT_ALIASES, KIT_FAMILIES, KIT_GENERATOR_VERSION, KIT_PROPS } from './kitProps.generated.ts';
import type { SurfaceTypeId } from '../sim/surfaceTypes.ts';

export interface KitVariantData {
  /** Stored on placements (`PropEntity.variant`). Never reused. */
  readonly index: number;
  readonly name: string;
  /** Its model, relative to the client's public folder (levels of detail inside it). */
  readonly file: string;
}

export interface KitFamilyData {
  readonly id: string;
  /** The generator that makes it (tools/content/kitprops.mjs KINDS). */
  readonly kind: string;
  /** Bumped (with a note in its content file) whenever its size, collision or surface changes: a gameplay change. */
  readonly assetVersion: number;
  /** What its impacts look and sound like and, through the surface's ballistic class, what rounds do to it. */
  readonly surface: SurfaceTypeId;
  /** Where each level of detail starts (m). */
  readonly lods: readonly number[];
  /** The most triangles any variant has at each level. */
  readonly triangles: readonly number[];
  readonly variants: readonly KitVariantData[];
}

/** A retired catalogue prop and what takes its place as played. */
export interface KitAlias {
  readonly from: string;
  readonly model: string;
  readonly variant: number;
  /** Multiplies the placement's own scale. */
  readonly scale: number;
}

export { KIT_ALIASES, KIT_FAMILIES, KIT_GENERATOR_VERSION, KIT_PROPS };

/** True for a kit-prop family id (`kit.<type>.<name>`). */
export const isKitModel = (model: string): boolean => model.startsWith('kit.');

let byId: Map<string, KitFamilyData> | undefined;
/** A kit family by id. */
export const getKitFamily = (id: string): KitFamilyData | undefined => (byId ??= new Map(KIT_FAMILIES.map((f) => [f.id, f]))).get(id);

/** A placement's variant: the one it names, else the family's first (index 0). */
export function kitVariant(family: KitFamilyData, index: number | undefined): KitVariantData {
  return (index !== undefined && family.variants.find((v) => v.index === index)) || family.variants[0]!;
}

/** The model file a kit placement draws (its variant's), or undefined for anything else. */
export function kitModelFile(model: string, variant?: number): string | undefined {
  const f = isKitModel(model) ? getKitFamily(model) : undefined;
  return f ? kitVariant(f, variant).file : undefined;
}

/** The surface a kit family is made of (kit ids only). */
export const kitSurfaceOf = (model: string): SurfaceTypeId | undefined => (isKitModel(model) ? getKitFamily(model)?.surface : undefined);

let aliases: Map<string, KitAlias> | undefined;
/** What takes a retired catalogue prop's place as played, if it has an alias. */
export const propAlias = (model: string): KitAlias | undefined => (aliases ??= new Map(KIT_ALIASES.map((a) => [a.from, a]))).get(model);
