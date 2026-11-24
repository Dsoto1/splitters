import { choosePublished, type BuiltInRecord, type PublishedRelease } from '@tiletrigger/shared';
import { hubAddress } from './game/hub.ts';
import { testMode } from './testMode.ts';

/**
 * Maps the owner published from MapMaker (the hub's /api/v1/maps,
 * packages/server/src/publish.ts). A published version of one of our maps is
 * used over the one built into the site, everywhere a built-in map loads (the
 * map list, matches, MapMaker's templates); a published map with a new ID is
 * an official map of its own. No hub, a hub that doesn't publish, or test
 * mode: none, and the built-in maps are used as they are.
 *
 * Unless the built-in map is newer (shared publishedChoice.ts): a map changed in
 * the repository since the version it records, or a published copy that is an
 * older revision of it, is left out of `publishedMaps()`, so the site plays the
 * built-in map until the owner publishes again. The built-in maps' records come
 * from the map index (mapIndexPlugin.ts, worked out at build time).
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
  /** The published file's own release block (hubs from 2026-11-15 on). */
  release?: PublishedRelease;
}

/** The built-in maps' records (only maps with a release block have one). */
let records: Promise<Map<string, BuiltInRecord | undefined>> | undefined;
/**
 * Read when first needed, from the built-in maps' release records (mapIndexPlugin.ts `virtual:map-releases`, out of the
 * menu's first download; imported here lazily: unit tests that reach this module have no Vite). Every built-in map is
 * in the map, its record or undefined (a map with no release block).
 */
const builtInRecords = () =>
  (records ??= Promise.all([import('virtual:map-index'), import('virtual:map-releases')]).then(([m, r]) => {
    const recs = r.default as Record<string, BuiltInRecord>;
    return new Map((m.default as { key: string }[]).map((e) => [e.key, recs[e.key]]));
  }));

/** A hub API address (`maps`, `maps/<id>`, `owner`), or null when there is no hub. */
export function hubApi(path: string): string | null {
  const a = hubAddress();
  return a ? `${a.secure ? 'https' : 'http'}://${a.host}:${a.port}${a.path}api/v1/${path}` : null;
}

let listing: Promise<Map<string, PublishedEntry>> | undefined;
let inForce: Promise<Map<string, PublishedEntry>> | undefined;
const files = new Map<string, Promise<unknown>>();

/**
 * Whether a published version is used over the built-in map with that ID (shared choosePublished). `records`: the
 * built-in maps' records by key (undefined for a built-in map with no release block; a map not in it is not built in).
 */
export function publishedInForce(e: Pick<PublishedEntry, 'id' | 'hash' | 'at' | 'release'>, records: ReadonlyMap<string, BuiltInRecord | undefined>): boolean {
  if (!records.has(e.id)) return true;
  const record = records.get(e.id);
  // Built in, but with no release block: nothing to order them by, so the published version (as before).
  if (!record) return true;
  return choosePublished(record, e).use === 'published';
}

/**
 * The published maps used over the built-in ones, by ID (asked once per page; empty when there are none or the hub
 * doesn't answer quickly). A published copy older than the built-in map is left out (publishedInForce).
 */
export function publishedMaps(): Promise<Map<string, PublishedEntry>> {
  inForce ??= hubPublishedMaps().then(async (all) => {
    if (!all.size) return all;
    const recs = await builtInRecords();
    return new Map([...all].filter(([, e]) => publishedInForce(e, recs)));
  });
  return inForce;
}

/** Every map the hub publishes, by ID, including published copies older than the built-in map (the owner's Publish dialog). */
export function hubPublishedMaps(): Promise<Map<string, PublishedEntry>> {
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

/**
 * Whether the hub publishes this built-in map but the built-in one is used, being newer (MapMaker tells the owner:
 * "the game's version is newer than your last publish").
 */
export async function builtInNewerThanPublished(id: string): Promise<boolean> {
  const e = (await hubPublishedMaps()).get(id);
  const record = e ? (await builtInRecords()).get(id) : undefined;
  if (!e || !record) return false;
  const choice = choosePublished(record, e);
  return choice.use === 'built-in' && !choice.same;
}

/** Forget what was fetched (after the owner publishes, so this page sees the new version). */
export function forgetPublished(): void {
  listing = undefined;
  inForce = undefined;
  files.clear();
}
