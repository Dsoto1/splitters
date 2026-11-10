import type { MapDocument, MapEntity } from '../map/schema.ts';
import { coreCatalog } from '../map/catalog.ts';
import { entityLabel, entityNumberKey, levelName, type Selection } from './operations.ts';

/**
 * MapMaker's outliner (docs/MAPMAKER_OVERHAUL_PLAN.md, Phase 2 item 3): everything in the map in one list, searchable,
 * grouped by kind and then by level. Hide and lock are editor-only: kept per map in the browser (OutlinerFlags), never
 * in the map file. The list is drawn virtualised (outlineWindow), so 4,096 things stay quick.
 */

export type OutlineKind = 'tile' | 'setpiece' | 'entity';

export interface OutlineEntry {
  id: string;
  kind: OutlineKind;
  /** The kind group it is listed under ("Tiles", "Props", "Spawns"…). */
  group: string;
  name: string;
  level: number;
  /** Lowercase text the search matches: name, group and id. */
  search: string;
}

/** The outliner's group for each kind of entity (several kinds share one: doors, objectives…). */
export const OUTLINE_ENTITY_GROUPS: Record<MapEntity['kind'], string> = {
  spawn: 'Spawns',
  pickup: 'Pickups',
  prop: 'Props',
  block: 'Blocks',
  water: 'Liquids',
  light: 'Lights',
  door: 'Doors',
  ladder: 'Climbing',
  zipline: 'Climbing',
  pad: 'Jump pads',
  mover: 'Movers',
  portal: 'Portals',
  button: 'Logic & triggers',
  zone: 'Logic & triggers',
  trap: 'Traps',
  destructible: 'Destructibles',
  encounter: 'NPC squads',
  mount: 'Vehicles',
  airplane: 'Drop routes',
  flag: 'Objectives',
  hill: 'Objectives',
  bombsite: 'Objectives',
  hostage: 'Objectives',
  rescue: 'Objectives',
  sector: 'Objectives',
  objective: 'Objectives',
};

/** The order groups are listed in. */
export const OUTLINE_GROUP_ORDER: readonly string[] = ['Tiles', 'Set pieces', 'Spawns', 'Objectives', 'Pickups', 'Vehicles', 'NPC squads', 'Props', 'Blocks', 'Doors', 'Climbing', 'Jump pads', 'Movers', 'Portals', 'Logic & triggers', 'Traps', 'Destructibles', 'Lights', 'Liquids', 'Drop routes'];

/** The level an entity stands on (as MapMaker's level filter counts it). */
export const entityLevelOf = (e: MapEntity, levelHeight: number): number => Math.floor((e.position[1] + 0.5) / levelHeight);

/** Every tile, set piece and entity in the map, named and placed on a level, in document order. */
export function outlineEntries(doc: MapDocument, pieceName: (piece: string) => string = (p) => p): OutlineEntry[] {
  const out: OutlineEntry[] = [];
  const entry = (id: string, kind: OutlineKind, group: string, name: string, level: number): OutlineEntry => ({ id, kind, group, name, level, search: `${name} ${group} ${id}`.toLowerCase() });
  for (const t of doc.classicStructure.tiles) out.push(entry(t.id, 'tile', 'Tiles', coreCatalog.get(t.tile)?.displayName ?? t.tile, t.z));
  for (const p of doc.setPieces ?? []) out.push(entry(p.id, 'setpiece', 'Set pieces', pieceName(p.piece), p.z));
  // "Door 2" numbering in one pass (entityLabel alone counts the whole map for each).
  const counts = new Map<string, number>();
  const lh = doc.classicStructure.levelHeight;
  for (const e of doc.entities) {
    const key = entityNumberKey(e);
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    out.push(entry(e.id, 'entity', OUTLINE_ENTITY_GROUPS[e.kind], entityLabel(doc, e, n), entityLevelOf(e, lh)));
  }
  return out;
}

export type OutlineRow =
  | { type: 'group'; key: string; label: string; count: number; open: boolean }
  | { type: 'level'; key: string; label: string; count: number; open: boolean }
  | { type: 'item'; entry: OutlineEntry };

/** Does the entry match every word of the query? */
export function outlineMatches(e: OutlineEntry, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => e.search.includes(w));
}

/**
 * The rows the outliner shows: a heading per kind group (with its count), a heading per level inside a group that
 * spans more than one, then its entries (by level, then document order). `closed` holds the group and level heading
 * keys folded shut; a search opens everything and lists only what matches.
 */
export function outlineRows(entries: readonly OutlineEntry[], opts: { query?: string; closed?: ReadonlySet<string> } = {}): OutlineRow[] {
  const query = opts.query?.trim() ?? '';
  const closed = query ? new Set<string>() : (opts.closed ?? new Set<string>());
  const groups = new Map<string, OutlineEntry[]>();
  for (const e of entries) {
    if (query && !outlineMatches(e, query)) continue;
    let g = groups.get(e.group);
    if (!g) groups.set(e.group, (g = []));
    g.push(e);
  }
  const rank = (g: string) => {
    const i = OUTLINE_GROUP_ORDER.indexOf(g);
    return i < 0 ? OUTLINE_GROUP_ORDER.length : i;
  };
  const rows: OutlineRow[] = [];
  for (const [label, list] of [...groups].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))) {
    const key = `g:${label}`;
    const open = !closed.has(key);
    rows.push({ type: 'group', key, label, count: list.length, open });
    if (!open) continue;
    const levels = new Map<number, OutlineEntry[]>();
    for (const e of list) {
      let l = levels.get(e.level);
      if (!l) levels.set(e.level, (l = []));
      l.push(e);
    }
    const ordered = [...levels].sort((a, b) => a[0] - b[0]);
    if (ordered.length === 1) {
      for (const e of ordered[0]![1]) rows.push({ type: 'item', entry: e });
      continue;
    }
    for (const [level, items] of ordered) {
      const lkey = `${key}:${level}`;
      const lopen = !closed.has(lkey);
      rows.push({ type: 'level', key: lkey, label: levelName(level), count: items.length, open: lopen });
      if (lopen) for (const e of items) rows.push({ type: 'item', entry: e });
    }
  }
  return rows;
}

/** The rows a virtualised list draws: those in view, plus `overscan` either side. */
export function outlineWindow(scrollTop: number, viewHeight: number, rowHeight: number, total: number, overscan = 8): { start: number; end: number } {
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight);
  const start = Math.max(0, first - overscan);
  const end = Math.min(total, first + Math.ceil(Math.max(0, viewHeight) / rowHeight) + overscan);
  return { start, end: Math.max(start, end) };
}

// ---------------------------------------------------------------- hide and lock (editor-only)

/** What a map's maker hid or locked in MapMaker (browser storage, per map; never in the map file). */
export interface OutlinerFlags {
  hidden: string[];
  locked: string[];
}

export const emptyOutlinerFlags = (): OutlinerFlags => ({ hidden: [], locked: [] });

/** Stored flags, read back safely (anything malformed is dropped). */
export function parseOutlinerFlags(raw: string | null): OutlinerFlags {
  try {
    const v = JSON.parse(raw ?? '') as Partial<OutlinerFlags>;
    const ids = (a: unknown) => (Array.isArray(a) ? [...new Set(a.filter((x): x is string => typeof x === 'string'))] : []);
    return { hidden: ids(v?.hidden), locked: ids(v?.locked) };
  } catch {
    return emptyOutlinerFlags();
  }
}

/** The flags with `id` hidden (or locked) or not; ids no longer in the map are dropped. */
export function toggleOutlinerFlag(flags: OutlinerFlags, which: keyof OutlinerFlags, ids: readonly string[], on: boolean, inMap?: ReadonlySet<string>): OutlinerFlags {
  const set = new Set(flags[which]);
  for (const id of ids) on ? set.add(id) : set.delete(id);
  const keep = (list: Iterable<string>) => [...list].filter((id) => !inMap || inMap.has(id));
  return { ...flags, [which]: keep(set), [which === 'hidden' ? 'locked' : 'hidden']: keep(flags[which === 'hidden' ? 'locked' : 'hidden']) };
}

/**
 * The map as MapMaker draws it with hidden things left out. `partOf` (set pieces expanded: part id → placement id)
 * hides a hidden set piece's parts. The same document comes back when nothing is hidden.
 */
export function withoutHidden(view: MapDocument, hidden: ReadonlySet<string>, partOf?: ReadonlyMap<string, string>): MapDocument {
  if (!hidden.size) return view;
  const gone = (id: string) => hidden.has(id) || (!!partOf && hidden.has(partOf.get(id) ?? ''));
  return {
    ...view,
    classicStructure: { ...view.classicStructure, tiles: view.classicStructure.tiles.filter((t) => !gone(t.id)) },
    entities: view.entities.filter((e) => !gone(e.id)),
    ...(view.setPieces ? { setPieces: view.setPieces.filter((p) => !hidden.has(p.id)) } : {}),
  };
}

/** A selection without what can't be picked (locked or hidden things). */
export function pickableSelection(sel: Selection, blocked: ReadonlySet<string>): Selection {
  if (!blocked.size) return sel;
  const ok = (id: string) => !blocked.has(id);
  const pieces = (sel.setPieces ?? []).filter(ok);
  return { tiles: sel.tiles.filter(ok), entities: sel.entities.filter(ok), ...(pieces.length ? { setPieces: pieces } : {}) };
}
