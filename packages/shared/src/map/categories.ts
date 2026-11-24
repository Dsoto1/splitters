/**
 * Map categories (map format v51; owner, 2026-11-24, QUEUE "Match Setup: one tab per map": the six overlapping
 * categories of v50 were busy). A map names one category in `metadata.category`, picked in MapMaker's Map properties;
 * Match Setup shows a tab per category and every map is under exactly one, so the tabs' counts add up to the total.
 *
 * Four are picked in the map's file. The fifth, Custom, is never picked: it is worked out (the player's own MapMaker
 * maps and the community maps on the server, labelled "Community map"; no uploads). A built-in map with no pick is Modern.
 *
 * Plain data, no zod: the menu imports it (docs/LOADING.md); schema.ts builds its enum from MAP_CATEGORY_IDS.
 */
import { isUnlistedMap } from './retired.ts';

/** The categories a map's file can name. */
export const MAP_CATEGORY_IDS = ['modern', 'historic', 'future', 'weird'] as const;
export type MapCategoryId = (typeof MAP_CATEGORY_IDS)[number];
/** Every category tab Match Setup shows (Custom last: worked out, never in a file). */
export type MapCategoryTab = MapCategoryId | 'custom';

export interface MapCategoryDef {
  id: MapCategoryTab;
  label: string;
  /** What belongs there, shown as the tab's tooltip and in MapMaker. */
  blurb: string;
}

/** The owner's five tabs, in the order Match Setup shows them. */
export const MAP_CATEGORIES: readonly MapCategoryDef[] = [
  { id: 'modern', label: 'Modern', blurb: 'Today: cities, bases, towns and the wild as it is now.' },
  { id: 'historic', label: 'Historic', blurb: 'The past: prehistoric, ancient, medieval and the industrial era.' },
  { id: 'future', label: 'Future & Space', blurb: 'Tomorrow, space and alien worlds.' },
  { id: 'weird', label: 'Weird', blurb: 'Abstract arenas, impossible geometry, experiments and alternate realities.' },
  { id: 'custom', label: 'Custom', blurb: 'Your own MapMaker maps and the community maps on the server.' },
];

/** A built-in map's tab when its file names none. */
export const DEFAULT_MAP_CATEGORY: MapCategoryId = 'modern';

const DEFS = new Map(MAP_CATEGORIES.map((c) => [c.id, c]));

export function mapCategory(id: MapCategoryTab): MapCategoryDef {
  return DEFS.get(id)!;
}

/** Whether `id` is a category a map's file can name (never Custom). */
export const isMapCategoryId = (id: unknown): id is MapCategoryId => (MAP_CATEGORY_IDS as readonly unknown[]).includes(id);

/**
 * The v50 → v51 assignment (the lead's, from the old tags; the owner may move any map): an abstract, impossible,
 * experimental or alternate-reality tag makes it Weird; else future, space or alien makes it Future & Space; else a
 * prehistoric period, or an ancient, medieval or industrial-era one without modern, makes it Historic; else Modern.
 * Undefined for a map with no tags (it stays unpicked: Modern on the tab).
 */
export function categoryFromV50Tags(list: readonly { category?: unknown; tag?: unknown }[] | undefined): MapCategoryId | undefined {
  if (!Array.isArray(list) || !list.length) return undefined;
  const tags = new Set(list.map((p) => p?.tag));
  const eras = new Set(list.filter((p) => p?.category === 'temporal').map((p) => p.tag));
  if (['abstract', 'impossible', 'experimental', 'alternate'].some((t) => tags.has(t))) return 'weird';
  if (['future', 'space', 'alien'].some((t) => tags.has(t))) return 'future';
  if (eras.has('prehistoric') || (['ancient', 'medieval', 'industrial'].some((t) => eras.has(t)) && !eras.has('modern'))) return 'historic';
  return 'modern';
}

/** What a map list entry needs for the category tabs. */
export interface CategorizedMap {
  category?: string;
  /** The player's own MapMaker map (Custom). */
  own?: boolean;
  /** A community map from the server (Custom; labelled "Community map"). */
  community?: boolean;
}

/**
 * Whether Match Setup lists the map at all: never a retired or a training map (isUnlistedMap), on any tab, count or
 * search. A player's own and the community maps are theirs, whatever their id.
 */
export function isListedMap(m: CategorizedMap & { key: string }): boolean {
  return !!m.own || !!m.community || !isUnlistedMap(m.key);
}

/** The one tab a map is under: Custom for own and community maps, else its file's pick (Modern when none). */
export function mapTabOf(m: CategorizedMap): MapCategoryTab {
  if (m.own || m.community) return 'custom';
  return isMapCategoryId(m.category) ? m.category : DEFAULT_MAP_CATEGORY;
}

/** Whether a map shows under the tab (`null`: All maps). */
export function inMapCategory(m: CategorizedMap, tab: MapCategoryTab | null): boolean {
  return !tab || mapTabOf(m) === tab;
}

/** How many maps each tab shows; they add up to the number of maps. */
export function categoryCounts(maps: readonly CategorizedMap[]): Map<MapCategoryTab, number> {
  const n = new Map<MapCategoryTab, number>(MAP_CATEGORIES.map((c) => [c.id, 0]));
  for (const m of maps) {
    const t = mapTabOf(m);
    n.set(t, n.get(t)! + 1);
  }
  return n;
}

/** The short line a card or the setup header shows: the map's tab ("Historic"), or "Community map" / "My map". */
export function categoryLine(m: CategorizedMap): string {
  if (m.community) return 'Community map';
  if (m.own) return 'My map';
  return mapCategory(mapTabOf(m)).label;
}
