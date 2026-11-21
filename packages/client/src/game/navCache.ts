// A browser host's navmeshes kept between matches, in its own storage (IndexedDB): the next match of the same map,
// even after a reload, takes its navmesh from here instead of building it (seconds on a big map;
// docs/SCALING_STUDY_2026-11-15.md, recommended order 1). Keyed by what the build reads (shared sim/mapNav.ts
// navInputKey, which includes the navmesh's settings) and this build of the navigation code (shared navBuildId: the
// match code's own file, whose name changes with its code), so any change builds again. At most MAX_ENTRIES navmeshes and MAX_BYTES in all, the
// least recently used go first. Every access is guarded: no storage (a private window, a blocked or full database)
// is the same as nothing kept. Not in the dev server (its files keep their names while their code changes).
import type { NavExport } from '@tiletrigger/shared/match';

const DB_NAME = 'tiletrigger-navmesh';
const STORE = 'navmesh';
const MAX_ENTRIES = 8;
const MAX_BYTES = 80 * 1024 * 1024;

interface Row {
  key: string;
  nav: NavExport;
  bytes: number;
  used: number;
}

/** A store of navmeshes by key: `get` resolves undefined for none (or no storage), `put` never fails. */
export interface NavStore {
  get(key: string): Promise<NavExport | undefined>;
  put(key: string, nav: NavExport): Promise<void>;
}

const promised = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('storage failed'));
  });

const done = (t: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error ?? new Error('storage failed'));
    t.onabort = () => reject(t.error ?? new Error('storage refused'));
  });

function openDb(factory: IDBFactory): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = factory.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** The navmesh store in `factory` (the browser's indexedDB), `build` naming this build of the navigation code (shared navBuildId); null without storage or in the dev server. */
export async function openNavStore(build: string, factory: IDBFactory | undefined = typeof indexedDB === 'undefined' ? undefined : indexedDB, dev = isDev(), limits = { entries: MAX_ENTRIES, bytes: MAX_BYTES }): Promise<NavStore | null> {
  if (!factory || !build || dev) return null;
  const db = await openDb(factory);
  if (!db) return null;
  const full = (key: string) => `${build}|${key}`;
  return {
    async get(key) {
      try {
        const t = db.transaction(STORE, 'readwrite');
        const store = t.objectStore(STORE);
        const row = (await promised(store.get(full(key)))) as Row | undefined;
        if (!row) return undefined;
        // Used now: the last to go.
        store.put({ ...row, used: Date.now() });
        await done(t).catch(() => undefined);
        return row.nav;
      } catch {
        return undefined;
      }
    },
    async put(key, nav) {
      try {
        const bytes = nav.mesh.byteLength + (nav.walkReach?.byteLength ?? 0) + nav.parkour.length * 100;
        if (bytes > limits.bytes) return;
        const t = db.transaction(STORE, 'readwrite');
        const store = t.objectStore(STORE);
        const rows = ((await promised(store.getAll())) as Row[]).filter((r) => r.key !== full(key));
        // Another build's navmeshes are of no use now; then the least recently used, until this one fits.
        rows.sort((a, b) => (a.key.startsWith(`${build}|`) ? 1 : 0) - (b.key.startsWith(`${build}|`) ? 1 : 0) || a.used - b.used);
        let total = rows.reduce((n, r) => n + r.bytes, 0) + bytes;
        let count = rows.length + 1;
        for (const r of rows) {
          if (count <= limits.entries && total <= limits.bytes && r.key.startsWith(`${build}|`)) break;
          store.delete(r.key);
          total -= r.bytes;
          count--;
        }
        store.put({ key: full(key), nav, bytes, used: Date.now() } satisfies Row);
        await done(t);
      } catch {
        // Storage full or refused: nothing kept, as without it.
      }
    },
  };
}

/** The dev server (its files keep their names while their code changes). */
function isDev(): boolean {
  try {
    return !!import.meta.env?.DEV;
  } catch {
    return false;
  }
}
