import { mapContentHash, releaseCurrent } from './identity.ts';
import type { MapDocument } from './schema.ts';

/**
 * Published or built-in (docs/HOSTING.md, "Publishing maps"): the owner publishes our maps from MapMaker to the hub
 * (server publish.ts), and the site, Host Services and the nightly Published maps workflow use the published version
 * over the one in the repository, unless the repository's map is the newer one. A map rebuilt in the repository after
 * its last publish (Flavius Rule's octagon, 2026-11-15) then plays as built until the owner publishes again.
 *
 * Every side asks `choosePublished` with what it knows: the built-in map's record (`builtInRecord`, worked out once:
 * at build time for the site, from the file for hosts and the workflow) and the hub's list entry, with the published
 * file's own release block where it is known (the hub lists it; a host or the workflow can read it from the file).
 * Content hashes and version IDs decide first; the clocks only when the versions can't be ordered otherwise.
 */

/** What a built-in map records of itself, for the choice (null fields when it has no release block). */
export interface BuiltInRecord {
  /** mapContentHash of the map as it is now, loaded for editing (as the hub hashes a published map). */
  hash: string;
  /** Whether its release block still describes it (releaseCurrent: its content unchanged since that export or publish). */
  current?: boolean;
  /** Its `metadata.release`: the version it records (from its last export or publish). */
  release?: { mapId: string; versionId: string; revision: number; contentHash: string; releasedAt: string };
}

/** A published map's own release block, as far as it describes it (`current`: it matches the published content). */
export interface PublishedRelease {
  mapId: string;
  versionId: string;
  revision: number;
  current: boolean;
}

/** What is known of a published version: the hub's hash and time, and its release block when known. */
export interface PublishedRef {
  hash: string;
  /** When the hub took it (ms). */
  at: number;
  release?: PublishedRelease;
}

export interface PublishedChoice {
  use: 'published' | 'built-in';
  /** The published copy is the built-in map's content (nothing is newer). */
  same?: boolean;
  /** Why, in a few words (logged by hosts and the workflow). */
  why: string;
}

/** The built-in map's record (load it for editing first, as the hub does). */
export function builtInRecord(map: MapDocument): BuiltInRecord {
  const r = map.metadata.release;
  return { hash: mapContentHash(map), ...(r ? { current: releaseCurrent(map), release: { mapId: r.mapId, versionId: r.versionId, revision: r.revision, contentHash: r.contentHash, releasedAt: r.releasedAt } } : {}) };
}

/** A published map's release block (undefined when it has none). */
export function publishedRelease(map: MapDocument): PublishedRelease | undefined {
  const r = map.metadata.release;
  return r ? { mapId: r.mapId, versionId: r.versionId, revision: r.revision, current: releaseCurrent(map) } : undefined;
}

/**
 * Which version of a map to use: the published one or the one built in (`builtIn` undefined: not built in).
 *   1. Not built in: published (an official map added by publishing).
 *   2. The same content: built in (nothing to fetch). The published version the built-in map records, while its
 *      release block still describes it, counts as the same.
 *   3. The built-in map records no release: published (nothing to order them by).
 *   4. The published version is the one the built-in map records (same content hash, or same version ID): built in,
 *      which has changed since.
 *   5. The published file's own release block, when it describes it and is of the same map: a lower revision is an
 *      older version (built in), a higher one a newer publish (published). MapMaker opens the version in use and
 *      Publish stamps the next revision, so the owner's publishes count up from the map the game has.
 *   6. Otherwise by time: published at or before the built-in map's release, built in; after it, published.
 */
export function choosePublished(builtIn: BuiltInRecord | undefined, p: PublishedRef): PublishedChoice {
  if (!builtIn) return { use: 'published', why: 'not built in' };
  const r = builtIn.release;
  const pr = p.release;
  const recorded = !!r && (p.hash === r.contentHash || (!!pr?.current && pr.versionId === r.versionId));
  // The same content (a release block that still describes the built-in map counts: the hash moves with a format bump).
  if (p.hash === builtIn.hash || (recorded && builtIn.current)) return { use: 'built-in', same: true, why: 'the same as the built-in map' };
  if (!r) return { use: 'published', why: 'the built-in map records no release' };
  if (recorded) return { use: 'built-in', why: `the published copy is revision ${r.revision}, which the built-in map has changed since` };
  if (pr?.current && pr.mapId === r.mapId && pr.revision !== r.revision) {
    return pr.revision < r.revision
      ? { use: 'built-in', why: `the built-in map is revision ${r.revision}, the published copy an older revision ${pr.revision}` }
      : { use: 'published', why: `the published copy is revision ${pr.revision}, newer than the built-in revision ${r.revision}` };
  }
  const releasedAt = Date.parse(r.releasedAt);
  if (Number.isFinite(releasedAt) && p.at <= releasedAt) return { use: 'built-in', why: `published ${new Date(p.at).toISOString()}, before the built-in revision ${r.revision} (${r.releasedAt})` };
  return { use: 'published', why: `published ${new Date(p.at).toISOString()}, after the built-in revision ${r.revision} (${r.releasedAt})` };
}
