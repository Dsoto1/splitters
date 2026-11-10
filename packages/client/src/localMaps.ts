/**
 * Your own maps, kept in this browser (docs/COMMUNITY_MAPS.md, decision 1: local saving is unlimited). They live in
 * IndexedDB, whose quota is a share of the disk (hundreds of MB or more), not localStorage's 5-10 MB (about 15 maps of
 * the median size). Nothing is uploaded: Export and Import move maps between browsers as files.
 *
 * The list of maps (id, name, when saved, size, what a map card needs) is held in memory, so it reads synchronously; a
 * map's file is read when it's opened. Writes update the list at once and reach the database a moment later. Where
 * IndexedDB is missing or refused (some private windows, tests), the maps stay in localStorage as before.
 *
 * The library before this (localStorage `cs.maps.index` and `cs.map.<id>`) is moved into IndexedDB once, the first time
 * the page opens it, and removed from localStorage once the move has been written.
 */

/** A saved map as the lists show it (no map file read). */
export interface LocalMapEntry {
  id: string;
  name: string;
  updatedAt: string;
  /** The file's size in characters. */
  bytes?: number;
  description?: string;
  author?: string;
  recommendedPlayers?: { min: number; max: number };
  /** The modes the map can be played in, as saved (a map card's tags). */
  modes?: string[];
}

const DB_NAME = 'tiletrigger-maps';
/** The list (card fields only) and the files, apart: opening the library reads the list, never every file. */
const META = 'meta';
const FILES = 'files';
const LEGACY_INDEX = 'cs.maps.index';
const legacyKey = (id: string) => `cs.map.${id}`;

interface Row extends LocalMapEntry {
  text: string;
}

let index = new Map<string, LocalMapEntry>();
let db: IDBDatabase | null = null;
let ready: Promise<void> | null = null;
/** Writes not yet in the database (a read in between gets the newest text). */
const pending = new Map<string, string | null>();

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function lsRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

/** The localStorage library (before IndexedDB, and the fallback without it). */
function legacyIndex(): LocalMapEntry[] {
  try {
    const list = JSON.parse(lsGet(LEGACY_INDEX) ?? '[]') as LocalMapEntry[];
    return Array.isArray(list) ? list.filter((e) => e && typeof e.id === 'string') : [];
  } catch {
    return [];
  }
}

/** What a card needs, read from a map file's JSON without loading it (the move from localStorage). */
function entryFromText(id: string, text: string, fallback?: LocalMapEntry): LocalMapEntry {
  try {
    const m = (JSON.parse(text) as { metadata?: Record<string, unknown> }).metadata ?? {};
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const rp = m.recommendedPlayers as { min?: unknown; max?: unknown } | undefined;
    return {
      id,
      name: str(m.name) ?? fallback?.name ?? id,
      updatedAt: str(m.updatedAt) ?? fallback?.updatedAt ?? new Date(0).toISOString(),
      bytes: text.length,
      ...(str(m.description) ? { description: str(m.description) } : {}),
      ...(str(m.author) ? { author: str(m.author) } : {}),
      ...(rp && typeof rp.min === 'number' && typeof rp.max === 'number' ? { recommendedPlayers: { min: rp.min, max: rp.max } } : {}),
      ...(Array.isArray(m.supportedModes) ? { modes: m.supportedModes.filter((x): x is string => typeof x === 'string') } : {}),
    };
  } catch {
    return { id, name: fallback?.name ?? id, updatedAt: fallback?.updatedAt ?? new Date(0).toISOString(), bytes: text.length };
  }
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(META, { keyPath: 'id' });
        req.result.createObjectStore(FILES, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function tx<T>(mode: IDBTransactionMode, run: (meta: IDBObjectStore, files: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('no database'));
    try {
      const t = db.transaction([META, FILES], mode);
      const req = run(t.objectStore(META), t.objectStore(FILES));
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = () => reject(t.error ?? new Error('storage failed'));
      t.onabort = () => reject(t.error ?? new Error('storage refused'));
    } catch (e) {
      reject(e as Error);
    }
  });
}

/**
 * Open the library (once; later calls wait for the same). Call before the lists are read: the main menu does as the
 * page starts. Never fails: without IndexedDB, the localStorage library is used.
 */
export function initLocalMaps(): Promise<void> {
  ready ??= (async () => {
    db = await openDb();
    if (!db) {
      index = new Map(legacyIndex().map((e) => [e.id, e]));
      return;
    }
    let rows: LocalMapEntry[] = [];
    try {
      rows = ((await tx('readonly', (meta) => meta.getAll())) as LocalMapEntry[] | undefined) ?? [];
    } catch {
      rows = [];
    }
    index = new Map(rows.map((e) => [e.id, e]));
    // The move from localStorage: maps the database doesn't have yet go in, then leave localStorage.
    const legacy = legacyIndex();
    if (!legacy.length) return;
    const moved: Row[] = [];
    for (const e of legacy) {
      const text = lsGet(legacyKey(e.id));
      if (!text || index.has(e.id)) continue;
      moved.push({ ...entryFromText(e.id, text, e), text });
    }
    try {
      if (moved.length) await tx('readwrite', (meta, files) => void moved.forEach(({ text, ...e }) => (meta.put(e), files.put({ id: e.id, text }))));
      for (const r of moved) {
        const { text: _t, ...e } = r;
        index.set(e.id, e);
      }
      for (const e of legacy) lsRemove(legacyKey(e.id));
      lsRemove(LEGACY_INDEX);
    } catch {
      // Not moved (quota, a refused write): they stay in localStorage, listed from there, and the move is tried next time.
      for (const r of moved) {
        const { text: _t, ...e } = r;
        index.set(e.id, e);
        pending.set(e.id, r.text);
      }
    }
  })();
  return ready;
}

/** Whether the maps are in IndexedDB (false: localStorage, with its few MB). */
export function localMapsInDatabase(): boolean {
  return !!db;
}

/** Your saved maps, newest first. */
export function listLocalMaps(): LocalMapEntry[] {
  return [...index.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function hasLocalMap(id: string): boolean {
  return index.has(id);
}

/** A saved map's file, or null. */
export async function readLocalMap(id: string): Promise<string | null> {
  await initLocalMaps();
  if (pending.has(id)) return pending.get(id) ?? null;
  if (!db) return lsGet(legacyKey(id));
  try {
    const row = (await tx('readonly', (_m, files) => files.get(id))) as { text: string } | undefined;
    return row?.text ?? lsGet(legacyKey(id));
  } catch {
    return lsGet(legacyKey(id));
  }
}

let askedPersist = false;

/** Save a map's file under `entry.id`. The list shows it at once; resolves false if storage refused it. */
export async function writeLocalMap(entry: LocalMapEntry, text: string): Promise<boolean> {
  await initLocalMaps();
  const row: Row = { ...entry, bytes: text.length, text };
  const { text: _t, ...listed } = row;
  const before = index.get(entry.id);
  index.set(entry.id, listed);
  if (!db) {
    const ok = lsSet(legacyKey(entry.id), text) && lsSet(LEGACY_INDEX, JSON.stringify(listLocalMaps()));
    if (!ok) before ? index.set(entry.id, before) : index.delete(entry.id);
    return ok;
  }
  // Ask the browser to keep the library when the disk runs low (it may say no; nothing changes then).
  if (!askedPersist) {
    askedPersist = true;
    void navigator.storage?.persist?.().catch(() => false);
  }
  pending.set(entry.id, text);
  try {
    await tx('readwrite', (meta, files) => void (meta.put(listed), files.put({ id: entry.id, text })));
    if (pending.get(entry.id) === text) pending.delete(entry.id);
    return true;
  } catch {
    if (pending.get(entry.id) === text) pending.delete(entry.id);
    before ? index.set(entry.id, before) : index.delete(entry.id);
    return false;
  }
}

/** Remove a saved map. */
export async function deleteLocalMap(id: string): Promise<void> {
  await initLocalMaps();
  index.delete(id);
  lsRemove(legacyKey(id));
  if (!db) return void lsSet(LEGACY_INDEX, JSON.stringify(listLocalMaps()));
  pending.set(id, null);
  try {
    await tx('readwrite', (meta, files) => void (meta.delete(id), files.delete(id)));
  } catch {
    /* gone from the list; the row is tried again at the next delete */
  } finally {
    if (pending.get(id) === null) pending.delete(id);
  }
}
