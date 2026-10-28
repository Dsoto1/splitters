import { loadMap, type GameMode, type MapDocument } from '@tiletrigger/shared';
import index from 'virtual:map-index';

/**
 * The built-in maps (maps/*.json). The menu draws from MAP_INDEX, worked out at
 * build time (mapIndexPlugin.ts: the same loadMap and playableModes as before);
 * each map file is its own chunk, loaded when a map is opened, drawn or played,
 * so the first visit doesn't fetch and parse every map. See docs/LOADING.md.
 */

/** What a map card shows before the map itself has loaded. */
export type MapMeta = Pick<MapDocument['metadata'], 'id' | 'name' | 'description' | 'author' | 'recommendedPlayers' | 'thumbnail'>;

export interface MapIndexEntry {
  /** The file name without .json. */
  key: string;
  metadata: MapMeta;
  /** playableModes(map). */
  modes: GameMode[];
}

/** Every built-in map that loads (sorted by key). */
export const MAP_INDEX: readonly MapIndexEntry[] = index as MapIndexEntry[];

const FILES = import.meta.glob<unknown>('../../../maps/*.json', { import: 'default' });
const path = (key: string) => `../../../maps/${key}.json`;

/** Whether maps/<key>.json is shipped. */
export const isBuiltInMap = (key: string): boolean => path(key) in FILES;

/** The file of a built-in map (undefined if there is none). */
export function builtInMapJson(key: string): Promise<unknown> {
  const load = FILES[path(key)];
  return load ? load() : Promise.resolve(undefined);
}

/** A built-in map, loaded and checked (null when there is none or it doesn't load). */
export async function loadBuiltInMap(key: string): Promise<MapDocument | null> {
  const json = await builtInMapJson(key);
  if (json === undefined) return null;
  const r = loadMap(json);
  return r.ok ? r.map : null;
}
