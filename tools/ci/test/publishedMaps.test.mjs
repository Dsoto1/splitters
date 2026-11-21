// The Published maps workflow's download (tools/ci/publishedMaps.mjs): a repository map newer than the published copy
// is skipped (shared publishedChoice.ts); a newer publish and a map not in the repository are written.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadMap, mapContentHash, serializeMap } from '../../../packages/shared/src/index.ts';
import { decide, syncPublished } from '../publishedMaps.mjs';

const text = readFileSync(new URL('../../../maps/frost_basin.json', import.meta.url), 'utf8');
const loaded = loadMap(text, undefined, { forEditing: true });
if (!loaded.ok) throw new Error('map failed to load');
const base = loaded.map;
const rel = base.metadata.release;
const later = Date.parse(rel.releasedAt) + 86_400_000;
/** Frost Basin under another name, stamped as the given revision. */
const variant = (name, versionId, revision) => {
  const m = { ...base, metadata: { ...base.metadata, name } };
  const hash = mapContentHash(m);
  return { map: m, text: serializeMap({ ...m, metadata: { ...m.metadata, release: { ...rel, versionId, revision, contentHash: hash } } }), hash };
};

describe('the Published maps download', () => {
  it('skips a published copy the repository has moved on from, and says why', async () => {
    // The repository changed Frost Basin since the version it records; that version is what is published.
    const repo = serializeMap({ ...base, metadata: { ...base.metadata, name: 'Frost Basin Rebuilt' } });
    const d = await decide({ id: 'frost_basin', hash: rel.contentHash, at: later }, repo, text);
    expect(d).toMatchObject({ write: false, why: expect.stringMatching(/changed since/) });
  });

  it('skips an older revision published later (read from the file when the hub lists no release block)', async () => {
    const older = variant('Frost Basin Older', 'v_aaaaaaaaaaaaaaaa', rel.revision - 1);
    expect(await decide({ id: 'frost_basin', hash: older.hash, at: later }, text, older.text)).toMatchObject({ write: false, why: expect.stringMatching(/older revision/) });
  });

  it('writes a newer publish, a map not in the repository, and a publish over a map with no release block', async () => {
    const newer = variant('Frost Basin Newer', 'v_bbbbbbbbbbbbbbbb', rel.revision + 1);
    expect((await decide({ id: 'frost_basin', hash: newer.hash, at: later }, text, newer.text)).write).toBe(true);
    expect((await decide({ id: 'owner_new', hash: newer.hash, at: 1 }, undefined, newer.text)).write).toBe(true);
    const unstamped = serializeMap({ ...base, metadata: { ...base.metadata, release: undefined } });
    expect((await decide({ id: 'frost_basin', hash: newer.hash, at: 1 }, unstamped, newer.text)).write).toBe(true);
  });

  it('downloads into the folder, leaving the skipped maps as they are', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tt-published-'));
    const repoRebuilt = serializeMap({ ...base, metadata: { ...base.metadata, name: 'Frost Basin Rebuilt' } });
    writeFileSync(join(dir, 'frost_basin.json'), repoRebuilt);
    const added = variant('Owner New', 'v_cccccccccccccccc', 1);
    const addedText = added.text.replace('"id":"frost_basin"', '"id":"owner_new"');
    const hub = {
      frost_basin: { name: 'Frost Basin', hash: rel.contentHash, at: later, text },
      owner_new: { name: 'Owner New', hash: 'sha256:x', at: later, text: addedText },
      '../evil': { name: 'Evil', hash: 'h', at: 1, text: '{}' },
    };
    const fetcher = async (url) => {
      const m = /\/api\/v1\/maps(?:\/([^?]+))?/.exec(url);
      if (!m[1]) return new Response(JSON.stringify({ maps: Object.entries(hub).map(([id, v]) => ({ id, name: v.name, hash: v.hash, at: v.at })) }));
      return hub[m[1]] ? new Response(hub[m[1]].text) : new Response('{}', { status: 404 });
    };
    const lines = [];
    const done = await syncPublished({ hub: 'http://hub', mapsDir: dir, fetcher, log: (l) => lines.push(l) });
    expect(done).toEqual({ written: ['owner_new'], skipped: ['frost_basin'] });
    expect(readFileSync(join(dir, 'frost_basin.json'), 'utf8')).toBe(repoRebuilt);
    expect(readFileSync(join(dir, 'owner_new.json'), 'utf8')).toBe(addedText);
    expect(lines.join('\n')).toMatch(/frost_basin: Frost Basin .*skipped, the repository's map is kept/);
  });
});
