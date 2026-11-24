/**
 * Map categories (map format v50; the owner's definitions of 2026-11-23, QUEUE "Match Setup redesign"). A map carries
 * a list of `{ category, tag }` pairs in `metadata.categories`, set in MapMaker's Map properties; it can sit in several
 * categories and under several tags of one. Match Setup's category tabs filter the map list by them.
 *
 * Five categories are tagged in the map's file. The sixth, Custom, is never tagged: it is worked out (the player's own
 * MapMaker maps and the community maps on the server, labelled "Community map"; no uploads).
 *
 * Plain data, no zod: the menu imports it (docs/LOADING.md); schema.ts builds its enums from these lists.
 */
import { isUnlistedMap } from './retired.ts';

/** The categories a map's file can name. */
export const MAP_CATEGORY_IDS = ['temporal', 'dimensional', 'environmental', 'fictional', 'anomalous'] as const;
export type MapCategoryId = (typeof MAP_CATEGORY_IDS)[number];
/** Every category tab Match Setup shows (Custom last: worked out, never in a file). */
export type MapCategoryTab = MapCategoryId | 'custom';

export interface MapCategoryDef {
  id: MapCategoryTab;
  label: string;
  /** The owner's definition, shown as the tab's tooltip and in MapMaker. */
  blurb: string;
  /** Its sub-tags: [id, label]. */
  tags: readonly (readonly [string, string])[];
}

/**
 * The owner's six categories and their sub-tags, in the order the tabs show them. Environmental's `arctic` and
 * `mountain` are the lead's additions (snow maps and mountain valleys fit none of the owner's seven), kept (owner, 2026-11-24).
 */
export const MAP_CATEGORIES: readonly MapCategoryDef[] = [
  {
    id: 'temporal',
    label: 'Temporal',
    blurb: 'A recognisable period: when does this place belong?',
    tags: [['prehistoric', 'Prehistoric'], ['ancient', 'Ancient'], ['medieval', 'Medieval'], ['industrial', 'Industrial'], ['modern', 'Modern'], ['future', 'Future']],
  },
  {
    id: 'dimensional',
    label: 'Dimensional',
    blurb: 'Alternate realities, alien worlds, parallel or fictional dimensions.',
    tags: [['alternate', 'Alternate reality'], ['alien', 'Alien world'], ['parallel', 'Parallel dimension']],
  },
  {
    id: 'environmental',
    label: 'Environmental',
    blurb: 'The physical surroundings.',
    tags: [['urban', 'Urban'], ['desert', 'Desert'], ['forest', 'Forest'], ['industrial', 'Industrial'], ['coastal', 'Coastal'], ['underground', 'Underground'], ['space', 'Space'], ['arctic', 'Arctic'], ['mountain', 'Mountain']],
  },
  {
    id: 'fictional',
    label: 'Fictional',
    blurb: 'Films and fiction, and the classic remakes: maps inspired by other games (until their rework).',
    tags: [['film', 'Film'], ['fiction', 'Fiction'], ['classic', 'Classic remake']],
  },
  {
    id: 'anomalous',
    label: 'Anomalous',
    blurb: 'Abstract arenas, impossible geometry, experimental maps.',
    tags: [['abstract', 'Abstract arena'], ['impossible', 'Impossible geometry'], ['experimental', 'Experimental']],
  },
  {
    id: 'custom',
    label: 'Custom',
    blurb: 'Your own MapMaker maps and the community maps on the server.',
    tags: [['mine', 'My maps'], ['community', 'Community maps']],
  },
];

/** One of a map's category tags. */
export interface MapCategoryTag {
  category: MapCategoryId;
  tag: string;
}

/** The most pairs a map carries (the schema's cap). */
export const MAX_MAP_CATEGORY_TAGS = 16;

const DEFS = new Map(MAP_CATEGORIES.map((c) => [c.id, c]));

export function mapCategory(id: MapCategoryTab): MapCategoryDef {
  return DEFS.get(id)!;
}

/** Whether `tag` is one of `category`'s sub-tags (Custom's are never in a file). */
export function isMapCategoryTag(category: string, tag: string): category is MapCategoryId {
  return (MAP_CATEGORY_IDS as readonly string[]).includes(category) && !!DEFS.get(category as MapCategoryId)?.tags.some(([t]) => t === tag);
}

/** A sub-tag's label ("Medieval"), or the tag itself when unknown. */
export function mapTagLabel(category: MapCategoryTab, tag: string): string {
  return DEFS.get(category)?.tags.find(([t]) => t === tag)?.[1] ?? tag;
}

/**
 * A map's pairs, cleaned: known pairs only, no repeats, in the definitions' order (categories, then tags). MapMaker
 * writes them this way, so a file's list never depends on the order they were ticked.
 */
export function normalizeMapCategories(list: readonly { category: string; tag: string }[] | undefined): MapCategoryTag[] {
  if (!list?.length) return [];
  const want = new Set(list.filter((p) => isMapCategoryTag(p.category, p.tag)).map((p) => `${p.category}:${p.tag}`));
  const out: MapCategoryTag[] = [];
  for (const c of MAP_CATEGORIES) {
    if (c.id === 'custom') continue;
    for (const [t] of c.tags) if (want.has(`${c.id}:${t}`)) out.push({ category: c.id, tag: t });
  }
  return out.slice(0, MAX_MAP_CATEGORY_TAGS);
}

/** What a map list entry needs for the category filter. */
export interface CategorizedMap {
  categories?: readonly { category: string; tag: string }[];
  /** The player's own MapMaker map (Custom → My maps). */
  own?: boolean;
  /** A community map from the server (Custom → Community maps; labelled "Community map"). */
  community?: boolean;
}

/**
 * Whether Match Setup lists the map at all: never a retired or a training map (isUnlistedMap), on any tab, category,
 * count or search. A player's own and the community maps are theirs, whatever their id.
 */
export function isListedMap(m: CategorizedMap & { key: string }): boolean {
  return !!m.own || !!m.community || !isUnlistedMap(m.key);
}

/** The category filter: every map (`null`), a category, or one of its tags. */
export interface CategoryFilter {
  category: MapCategoryTab;
  tag?: string | null;
}

/** Whether a map shows under the filter. Custom holds own and community maps only; the others read the map's pairs. */
export function inMapCategory(m: CategorizedMap, f: CategoryFilter | null): boolean {
  if (!f) return true;
  if (f.category === 'custom') return f.tag === 'mine' ? !!m.own : f.tag === 'community' ? !!m.community : !!m.own || !!m.community;
  return !!m.categories?.some((p) => p.category === f.category && (!f.tag || p.tag === f.tag));
}

/** How many maps each tab and tag would show (`category` and `category:tag` keys), for the tabs' counts. */
export function categoryCounts(maps: readonly CategorizedMap[]): Map<string, number> {
  const n = new Map<string, number>();
  const add = (k: string) => n.set(k, (n.get(k) ?? 0) + 1);
  for (const m of maps) {
    for (const c of MAP_CATEGORIES) {
      if (!inMapCategory(m, { category: c.id })) continue;
      add(c.id);
      for (const [t] of c.tags) if (inMapCategory(m, { category: c.id, tag: t })) add(`${c.id}:${t}`);
    }
  }
  return n;
}

/** The short line a card or the setup header shows: "Medieval · Urban" (the first few tags, Custom's label for own/community maps). */
export function categoryLine(m: CategorizedMap, max = 3): string {
  if (m.community) return 'Community map';
  if (m.own) return 'My map';
  return normalizeMapCategories(m.categories).slice(0, max).map((p) => mapTagLabel(p.category, p.tag)).join(' · ');
}
