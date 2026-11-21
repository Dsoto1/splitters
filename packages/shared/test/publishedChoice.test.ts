// Published or built-in (map/publishedChoice.ts): a map changed in the repository since the version it records wins
// over that stale published copy, until the owner publishes again.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { builtInRecord, choosePublished, loadMap, mapContentHash, publishedRelease, stampMapRelease, type BuiltInRecord, type MapDocument } from '../src/index.ts';

const H = (c: string) => `sha256:${c.repeat(64)}`;
const T = (iso: string) => Date.parse(iso);
/** A built-in map stamped revision 32 at 14:45 (hash a) and changed since (hash b). */
const changed: BuiltInRecord = { hash: H('b'), current: false, release: { mapId: 'm_aaaaaaaaaaaaaaaa', versionId: 'v_aaaaaaaaaaaaaaaa', revision: 32, contentHash: H('a'), releasedAt: '2026-11-15T14:45:51.578Z' } };
/** The same map exported at 14:45 and unchanged since (its release block describes it). */
const exported: BuiltInRecord = { hash: H('a'), current: true, release: changed.release };

describe('published or built-in', () => {
  it('the same content: the built-in map (nothing to fetch)', () => {
    expect(choosePublished(exported, { hash: H('a'), at: T('2026-11-16T00:00:00Z') })).toMatchObject({ use: 'built-in', same: true });
    // Stamped at an older format: the hash now differs, the block still describes the map; the recorded version is the same.
    expect(choosePublished({ ...exported, hash: H('9') }, { hash: H('a'), at: T('2026-11-16T00:00:00Z') })).toMatchObject({ use: 'built-in', same: true });
  });

  it('the repository changed since the version it records: the built-in map, however late that was published', () => {
    // By content hash (the hub hashes the published file the same way).
    expect(choosePublished(changed, { hash: H('a'), at: T('2026-11-15T19:00:00Z') })).toMatchObject({ use: 'built-in', why: expect.stringMatching(/revision 32/) });
    expect(choosePublished(changed, { hash: H('a'), at: T('2026-11-15T19:00:00Z') }).same).toBeUndefined();
    // By version ID, where the published file's block describes it (a hash that drifted with a format change).
    expect(choosePublished(changed, { hash: H('c'), at: T('2026-11-15T19:00:00Z'), release: { mapId: 'm_aaaaaaaaaaaaaaaa', versionId: 'v_aaaaaaaaaaaaaaaa', revision: 32, current: true } }).use).toBe('built-in');
  });

  it('an older revision of the same map published after the repository moved on: the built-in map (Flavius Rule)', () => {
    const old = { mapId: 'm_aaaaaaaaaaaaaaaa', versionId: 'v_bbbbbbbbbbbbbbbb', revision: 27, current: true };
    expect(choosePublished(exported, { hash: H('d'), at: T('2026-11-15T18:00:00Z'), release: old })).toMatchObject({ use: 'built-in', why: expect.stringMatching(/older revision 27/) });
  });

  it('the owner published a newer version: the published one', () => {
    // A higher revision (MapMaker's Publish stamps the next one)...
    expect(choosePublished(changed, { hash: H('e'), at: T('2026-11-16T10:00:00Z'), release: { mapId: 'm_aaaaaaaaaaaaaaaa', versionId: 'v_cccccccccccccccc', revision: 33, current: true } }).use).toBe('published');
    // ...or, with no block to go by, published after the built-in map's release.
    expect(choosePublished(changed, { hash: H('e'), at: T('2026-11-16T10:00:00Z') }).use).toBe('published');
    // A block that doesn't describe the published content (published unstamped after an edit): the clock decides.
    expect(choosePublished(changed, { hash: H('e'), at: T('2026-11-16T10:00:00Z'), release: { mapId: 'm_aaaaaaaaaaaaaaaa', versionId: 'v_aaaaaaaaaaaaaaaa', revision: 32, current: false } }).use).toBe('published');
  });

  it('published before the built-in release, with nothing else to go by: the built-in map', () => {
    expect(choosePublished(changed, { hash: H('f'), at: T('2026-11-12T20:00:00Z') }).use).toBe('built-in');
  });

  it('no release block on the built-in map: the published one (as before)', () => {
    expect(choosePublished({ hash: H('b') }, { hash: H('a'), at: 1 }).use).toBe('published');
  });

  it('a map not built in: the published one', () => {
    expect(choosePublished(undefined, { hash: H('a'), at: 1 }).use).toBe('published');
  });

  it('records come from the maps as the hub hashes them, and a publish after a stamp counts up', () => {
    const r = loadMap(readFileSync(new URL('../../../maps/frost_basin.json', import.meta.url), 'utf8'), undefined, { forEditing: true });
    if (!r.ok) throw new Error('map failed to load');
    const built = stampMapRelease({ ...r.map, metadata: { ...r.map.metadata, release: undefined } }, new Date('2026-11-15T14:45:00Z'));
    const rec = builtInRecord(built);
    expect(rec.hash).toBe(mapContentHash(built));
    expect(rec.release?.contentHash).toBe(rec.hash);
    // The owner opens it in MapMaker, changes it and publishes: Publish stamps revision 2.
    const edited: MapDocument = { ...built, metadata: { ...built.metadata, name: 'Frost Basin Republished' } };
    const published = stampMapRelease(edited, new Date('2026-11-15T20:00:00Z'));
    const ref = { hash: mapContentHash(published), at: T('2026-11-15T20:00:01Z'), release: publishedRelease(published) };
    expect(ref.release).toMatchObject({ revision: 2, current: true });
    expect(choosePublished(rec, ref).use).toBe('published');
    // The nightly workflow brings it into the repository: the same again, and the built-in map is used.
    expect(choosePublished(builtInRecord(published), ref).use).toBe('built-in');
    // The repository changes that map afterwards (in MapMaker, exported): the built-in map, until the next publish.
    const later = stampMapRelease({ ...published, metadata: { ...published.metadata, description: 'Changed in the repository' } }, new Date('2026-11-16T09:00:00Z'));
    expect(choosePublished(builtInRecord(later), ref).use).toBe('built-in');
  });
});
