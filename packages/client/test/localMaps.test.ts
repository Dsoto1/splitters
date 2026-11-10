import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The local map library (localMaps.ts): IndexedDB, the move from the old localStorage library, and localStorage when
 * there is no IndexedDB. A small in-memory IndexedDB stands in for the browser's (the calls localMaps.ts makes).
 */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

function memoryIndexedDb(opts: { failWrites?: boolean } = {}) {
  const stores = new Map<string, Map<string, unknown>>();
  const request = <T>(result: () => T) => {
    const r: { result?: T; onsuccess?: () => void } = {};
    queueMicrotask(() => {
      r.result = result();
      r.onsuccess?.();
    });
    return r;
  };
  const db = {
    createObjectStore: (name: string) => stores.set(name, new Map()),
    transaction: (names: string[], mode: string) => {
      const t: { oncomplete?: () => void; onerror?: () => void; onabort?: () => void; error: Error | null; objectStore: (n: string) => unknown } = {
        error: null,
        objectStore: (n: string) => {
          const s = stores.get(n)!;
          return {
            get: (k: string) => request(() => structuredClone(s.get(k))),
            getAll: () => request(() => [...s.values()].map((v) => structuredClone(v))),
            put: (v: { id: string }) => request(() => (mode === 'readwrite' && !opts.failWrites ? s.set(v.id, structuredClone(v)) : undefined)),
            delete: (k: string) => request(() => s.delete(k)),
          };
        },
      };
      void names;
      setTimeout(() => {
        if (mode === 'readwrite' && opts.failWrites) {
          t.error = new Error('QuotaExceededError');
          t.onabort?.();
        } else t.oncomplete?.();
      }, 0);
      return t;
    },
  };
  return {
    stores,
    open: () => {
      const req: { result?: typeof db; onupgradeneeded?: () => void; onsuccess?: () => void } = {};
      setTimeout(() => {
        req.result = db;
        if (!stores.size) req.onupgradeneeded?.();
        req.onsuccess?.();
      }, 0);
      return req;
    },
  };
}

const mapText = (id: string, name: string) => JSON.stringify({ metadata: { id, name, updatedAt: '2026-11-01T10:00:00.000Z', supportedModes: ['core.tdm'], recommendedPlayers: { min: 2, max: 12 } } });

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('navigator', {});
});

describe('local map library', () => {
  it('keeps many maps in IndexedDB, well past what localStorage holds, and reads them back', async () => {
    const idb = memoryIndexedDb();
    vi.stubGlobal('indexedDB', idb);
    const lib = await import('../src/localMaps.ts');
    await lib.initLocalMaps();
    expect(lib.localMapsInDatabase()).toBe(true);
    // 40 maps of 300 KB (the median size): 12 MB, more than localStorage's 5-10 MB.
    const big = 'x'.repeat(300_000);
    for (let i = 0; i < 40; i++) expect(await lib.writeLocalMap({ id: `map_${i}`, name: `Map ${i}`, updatedAt: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString() }, big + i)).toBe(true);
    expect(lib.listLocalMaps()).toHaveLength(40);
    expect(lib.listLocalMaps()[0]!.id).toBe('map_39');
    expect(await lib.readLocalMap('map_7')).toBe(`${big}7`);
    // The list and the files are apart: the list never holds a file.
    expect([...idb.stores.get('meta')!.values()].every((e) => !('text' in (e as object)))).toBe(true);
    await lib.deleteLocalMap('map_7');
    expect(lib.hasLocalMap('map_7')).toBe(false);
    expect(await lib.readLocalMap('map_7')).toBe(null);
    // Opened again (a reload): the list comes back from the database.
    vi.resetModules();
    const again = await import('../src/localMaps.ts');
    await again.initLocalMaps();
    expect(again.listLocalMaps()).toHaveLength(39);
  });

  it('moves the old localStorage library in once, with what a map card needs', async () => {
    localStorage.setItem('cs.maps.index', JSON.stringify([{ id: 'old_one', name: 'Old One', updatedAt: '2026-10-01T00:00:00.000Z' }]));
    localStorage.setItem('cs.map.old_one', mapText('old_one', 'Old One'));
    vi.stubGlobal('indexedDB', memoryIndexedDb());
    const lib = await import('../src/localMaps.ts');
    await lib.initLocalMaps();
    const [e] = lib.listLocalMaps();
    expect(e).toMatchObject({ id: 'old_one', name: 'Old One', modes: ['core.tdm'], recommendedPlayers: { min: 2, max: 12 } });
    expect(await lib.readLocalMap('old_one')).toBe(mapText('old_one', 'Old One'));
    expect(localStorage.getItem('cs.maps.index')).toBe(null);
    expect(localStorage.getItem('cs.map.old_one')).toBe(null);
  });

  it('keeps the old library where it is when the move is refused, and a refused save says so', async () => {
    localStorage.setItem('cs.maps.index', JSON.stringify([{ id: 'old_one', name: 'Old One', updatedAt: '2026-10-01T00:00:00.000Z' }]));
    localStorage.setItem('cs.map.old_one', mapText('old_one', 'Old One'));
    vi.stubGlobal('indexedDB', memoryIndexedDb({ failWrites: true }));
    const lib = await import('../src/localMaps.ts');
    await lib.initLocalMaps();
    expect(lib.hasLocalMap('old_one')).toBe(true);
    expect(await lib.readLocalMap('old_one')).toContain('Old One');
    expect(localStorage.getItem('cs.map.old_one')).not.toBe(null);
    expect(await lib.writeLocalMap({ id: 'new_one', name: 'New', updatedAt: '2026-11-01T00:00:00.000Z' }, '{}')).toBe(false);
    expect(lib.hasLocalMap('new_one')).toBe(false);
  });

  it('uses localStorage without IndexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const lib = await import('../src/localMaps.ts');
    await lib.initLocalMaps();
    expect(lib.localMapsInDatabase()).toBe(false);
    expect(await lib.writeLocalMap({ id: 'a_map', name: 'A', updatedAt: '2026-11-01T00:00:00.000Z' }, '{"m":1}')).toBe(true);
    expect(localStorage.getItem('cs.map.a_map')).toBe('{"m":1}');
    expect(JSON.parse(localStorage.getItem('cs.maps.index')!)[0].id).toBe('a_map');
    expect(await lib.readLocalMap('a_map')).toBe('{"m":1}');
  });
});
