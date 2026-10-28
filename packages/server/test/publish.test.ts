import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { loadMap, serializeMap } from '@tiletrigger/shared';
import { TokenError, type VerifiedUser } from '../src/auth.ts';
import { PublishedMaps, publishHandler } from '../src/publish.ts';

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const f of cleanup.splice(0)) f();
});

const temp = () => {
  const d = mkdtempSync(join(tmpdir(), 'tt-publish-'));
  cleanup.push(() => rmSync(d, { recursive: true, force: true }));
  return d;
};
const mapText = (id: string) => readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8');
/** A suite map with a change: a new name (and so a new content hash). */
const renamed = (id: string, name: string) => {
  const r = loadMap(mapText(id));
  if (!r.ok) throw new Error('map failed to load');
  return serializeMap({ ...r.map, metadata: { ...r.map.metadata, name } });
};
const OWNER = { sub: 'owner-sub' };
/** What the API answers (a typed view for the tests). */
type Answer = { maps: { id: string }[]; error: string; versions: unknown[]; owner: boolean; sub: string };
const json = (r: Response) => r.json() as Promise<Answer>;
const BUILT_IN = new Set(['frost_basin', 'sandgate']);

describe('published maps', () => {
  it('keeps what the owner publishes, every version, and rolls back', () => {
    const dir = temp();
    const suite = new Set(BUILT_IN);
    let t = 1000;
    const store = new PublishedMaps(dir, BUILT_IN, suite, () => t);
    expect(store.list()).toEqual([]);
    const first = store.publish(renamed('frost_basin', 'Frost Basin Fixed'), OWNER);
    expect(first).toMatchObject({ id: 'frost_basin', name: 'Frost Basin Fixed', added: false, at: 1000 });
    expect(first.modes).toContain('core.tdm');
    t = 2000;
    store.publish(renamed('frost_basin', 'Frost Basin Again'), OWNER);
    expect(store.versions('frost_basin').map((v) => [v.at, v.name, v.current])).toEqual([
      [1000, 'Frost Basin Fixed', false],
      [2000, 'Frost Basin Again', true],
    ]);
    expect(JSON.parse(store.get('frost_basin')!).metadata.name).toBe('Frost Basin Again');
    t = 3000;
    expect(store.rollback('frost_basin', 1000, OWNER).name).toBe('Frost Basin Fixed');
    expect(store.versions('frost_basin')).toHaveLength(3);
    // A hub started again finds them.
    expect(new PublishedMaps(dir, BUILT_IN).list().map((e) => [e.id, e.name])).toEqual([['frost_basin', 'Frost Basin Fixed']]);
    // Taking it down: the built-in map is used again.
    expect(store.unpublish('frost_basin')).toBe(true);
    expect(store.get('frost_basin')).toBeNull();
  });

  it('adds a map with a new ID as an official one, and refuses maps that are broken', () => {
    const suite = new Set(BUILT_IN);
    const store = new PublishedMaps(temp(), BUILT_IN, suite);
    const r = loadMap(mapText('sandgate'));
    if (!r.ok) throw new Error('map failed to load');
    const added = store.publish(serializeMap({ ...r.map, metadata: { ...r.map.metadata, id: 'owner_new_map', name: 'New Map' } }), OWNER);
    expect(added.added).toBe(true);
    expect(suite.has('owner_new_map')).toBe(true);
    expect(() => store.publish('{"not":"a map"}', OWNER)).toThrow(/doesn't load/);
    expect(() => store.publish(serializeMap({ ...r.map, metadata: { ...r.map.metadata, id: 'Bad ID!' } }), OWNER)).toThrow();
    // No spawns: a validation error, refused.
    expect(() => store.publish(serializeMap({ ...r.map, metadata: { ...r.map.metadata, id: 'no_spawns' }, entities: r.map.entities.filter((e) => e.kind !== 'spawn') }), OWNER)).toThrow();
    expect(() => store.check(mapText('sandgate'), 'frost_basin')).toThrow(/not frost_basin/);
    expect(store.unpublish('owner_new_map')).toBe(true);
    expect(suite.has('owner_new_map')).toBe(false);
  });
});

describe('publishing over HTTP', () => {
  async function serve(owners: string[]) {
    const store = new PublishedMaps(temp(), BUILT_IN, new Set(BUILT_IN));
    const verify = async (token: string): Promise<VerifiedUser> => {
      if (token === 'bad') throw new TokenError('token expired');
      return { sub: token, tokenUse: 'access', exp: 0 };
    };
    const handler = publishHandler(store, { owners: new Set(owners), verify, trustProxy: false });
    const http: Server = createServer((req, res) => void handler(req, res, () => ((res.statusCode = 404), res.end('next'))));
    await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
    cleanup.push(() => http.close());
    const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}/api/v1`;
    return { store, base };
  }

  it('lets everyone read and only the owner write', async () => {
    const { base } = await serve(['owner-sub']);
    const put = (who: string, body: string | Buffer, gz = false) =>
      fetch(`${base}/maps/frost_basin`, { method: 'PUT', headers: { Authorization: `Bearer ${who}`, 'Content-Type': 'application/json', ...(gz ? { 'Content-Encoding': 'gzip' } : {}) }, body });
    expect((await fetch(`${base}/maps`).then(json)).maps).toEqual([]);
    expect((await fetch(`${base}/maps/frost_basin`)).status).toBe(404);
    // Signed out, a bad token, someone else: refused.
    expect((await fetch(`${base}/maps/frost_basin`, { method: 'PUT', body: '{}' })).status).toBe(401);
    expect((await put('bad', renamed('frost_basin', 'X'))).status).toBe(401);
    expect((await put('someone-else', renamed('frost_basin', 'X'))).status).toBe(403);
    expect(await fetch(`${base}/owner`, { headers: { Authorization: 'Bearer someone-else' } }).then(json)).toEqual({ owner: false, sub: 'someone-else' });
    // The owner, gzipped as the page sends it.
    const ok = await put('owner-sub', gzipSync(renamed('frost_basin', 'Frost Basin Fixed')), true);
    expect(ok.status).toBe(200);
    expect((await fetch(`${base}/maps`).then(json)).maps.map((m) => m.id)).toEqual(['frost_basin']);
    expect(JSON.parse(await fetch(`${base}/maps/frost_basin`).then((r) => r.text())).metadata.name).toBe('Frost Basin Fixed');
    // A map under another map's ID, and a broken one: refused with why.
    const wrong = await put('owner-sub', mapText('sandgate'));
    expect(wrong.status).toBe(400);
    expect((await json(wrong)).error).toMatch(/not frost_basin/);
    expect((await put('owner-sub', '{')).status).toBe(400);
    // Versions and rollback are the owner's.
    expect((await fetch(`${base}/maps/frost_basin/versions`, { headers: { Authorization: 'Bearer someone-else' } })).status).toBe(403);
    const versions = (await fetch(`${base}/maps/frost_basin/versions`, { headers: { Authorization: 'Bearer owner-sub' } }).then(json)).versions;
    expect(versions).toHaveLength(1);
    // Other paths aren't this handler's.
    expect(await fetch(`${base}/me`).then((r) => r.text())).toBe('next');
  });

  it('publishes nothing when no owner is set', async () => {
    const { base } = await serve([]);
    expect((await fetch(`${base}/maps/frost_basin`, { method: 'PUT', headers: { Authorization: 'Bearer anyone' }, body: renamed('frost_basin', 'X') })).status).toBe(403);
  });
});
