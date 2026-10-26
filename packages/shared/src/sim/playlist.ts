import { z } from 'zod';
import { GAME_MODES } from './rules.ts';

/**
 * Scenario chains. A map ends its match and sends everyone on to another
 * map in two ways:
 *  - a playlist: a JSON file (maps/playlists/*.json) listing maps to play in
 *    order, each started once the one before it is won;
 *  - the MapMaker logic action "Next map" (`next_map`, its text the map's ID),
 *    which wins the match and names the map to load.
 * Either way the next map must be one of our own suite (a file in maps/,
 * named by its ID): hosts and servers check the ID before loading anything.
 * What carries over (your score and your weapons) is the playlist's choice;
 * a "Next map" link outside a playlist carries both.
 */

/** A suite map ID: the file name in maps/ without .json (lower case, digits, underscores). */
export const MAP_ID_RE = /^[a-z0-9_]{2,48}$/;

export const isMapId = (id: unknown): id is string => typeof id === 'string' && MAP_ID_RE.test(id);

export const Playlist = z.object({
  format: z.literal('tiletrigger.playlist'),
  id: z.string().regex(MAP_ID_RE),
  name: z.string().min(1).max(60),
  description: z.string().max(400).default(''),
  maps: z
    .array(
      z.object({
        map: z.string().regex(MAP_ID_RE),
        /** The mode to play it in (default: co-op when the map has it, else the map's own). */
        mode: z.enum(GAME_MODES).optional(),
      }),
    )
    .min(1)
    .max(24),
  carry: z.object({ score: z.boolean().default(true), loadout: z.boolean().default(true) }).default({ score: true, loadout: true }),
  /** Start again from the first map after the last one. */
  loop: z.boolean().default(false),
});
export type Playlist = z.infer<typeof Playlist>;

/** A playlist from untrusted JSON, or null. `suite`: when given, every map must be in it. */
export function parsePlaylist(json: unknown, suite?: ReadonlySet<string>): Playlist | null {
  const r = Playlist.safeParse(json);
  if (!r.success) return null;
  if (suite && r.data.maps.some((m) => !suite.has(m.map))) return null;
  return r.data;
}

/** The index of the map after `index`, or null at the end (unless the playlist loops). */
export function playlistNext(p: Playlist, index: number): number | null {
  if (index + 1 < p.maps.length) return index + 1;
  return p.loop ? 0 : null;
}

/** What a player takes into the next map of a chain: their score and weapons ([weapon ID, magazine, reserve]). */
export interface CarryOver {
  kills?: number;
  deaths?: number;
  weapons?: [string, number, number][];
}
