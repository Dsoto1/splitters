import { hubAddress } from './game/hub.ts';
import { testMode } from './testMode.ts';

/**
 * Maps the owner published from MapMaker (the hub's /api/v1/maps,
 * packages/server/src/publish.ts). A published version of one of our maps is
 * used over the one built into the site, everywhere a built-in map loads (the
 * map list, matches, MapMaker's templates); a published map with a new ID is
 * an official map of its own. No hub, a hub that doesn't publish, or test
 * mode: none, and the built-in maps are used as they are.
 */
export interface PublishedEntry {
  id: string;
  name: string;
  description: string;
  author: string;
  recommendedPlayers: { min: number; max: number };
  modes: string[];
  at: number;
  hash: string;
  /** Not built into the site: added by publishing. */
  added: boolean;
}

/** A hub API address (`maps`, `maps/<id>`, `owner`), or null when there is no hub. */
export function hubApi(path: string): string | null {
  const a = hubAddress();
  return a ? `${a.secure ? 'https' : 'http'}://${a.host}:${a.port}${a.path}api/v1/${path}` : null;
}

let listing: Promise<Map<string, PublishedEntry>> | undefined;
const files = new Map<string, Promise<unknown>>();

/** The published maps by ID (asked once per page; empty when there are none or the hub doesn't answer quickly). */
export function publishedMaps(): Promise<Map<string, PublishedEntry>> {
  listing ??= (async () => {
    const url = testMode() ? null : hubApi('maps');
    if (!url) return new Map();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return new Map();
      const { maps } = (await res.json()) as { maps: PublishedEntry[] };
      return new Map(maps.map((m) => [m.id, m]));
    } catch {
      return new Map();
    }
  })();
  return listing;
}

/** A published map's file, or undefined when it isn't published (or can't be fetched: the built-in one is used). */
export async function publishedMapJson(id: string): Promise<unknown> {
  const entry = (await publishedMaps()).get(id);
  if (!entry) return undefined;
  if (!files.has(id)) {
    const url = hubApi(`maps/${id}`);
    files.set(
      id,
      url
        ? fetch(`${url}?v=${entry.at}`, { signal: AbortSignal.timeout(15000) })
            .then((r) => (r.ok ? r.json() : undefined))
            .catch(() => {
              files.delete(id);
              return undefined;
            })
        : Promise.resolve(undefined),
    );
  }
  return files.get(id);
}

/** Forget what was fetched (after the owner publishes, so this page sees the new version). */
export function forgetPublished(): void {
  listing = undefined;
  files.clear();
}
