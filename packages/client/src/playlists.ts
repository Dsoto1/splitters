import { isRetiredMap, parsePlaylist, type Playlist } from '@tiletrigger/shared';

/** Our suite's map IDs (file names in maps/, less retired ones): the only maps a chain may go on to or the game browser lists. */
const SUITE = new Set(
  Object.keys(import.meta.glob('../../../maps/*.json'))
    .map((k) => k.replace(/^.*\/|\.json$/g, ''))
    .filter((id) => !isRetiredMap(id)),
);

/** Scenario chains shipped in maps/playlists/ (each map must be in our suite, so a chain over a retired map drops out). */
export const PLAYLISTS: readonly Playlist[] = Object.values(import.meta.glob<unknown>('../../../maps/playlists/*.json', { eager: true, import: 'default' }))
  .map((json) => parsePlaylist(json, SUITE))
  .filter((p): p is Playlist => p !== null)
  .sort((a, b) => a.name.localeCompare(b.name));

/** Whether `id` names a map of our suite. */
export const inSuite = (id: string): boolean => SUITE.has(id);

/** A map the owner published with a new ID (publishedMaps.ts) is one of ours too. */
export const addToSuite = (id: string): void => void SUITE.add(id);
