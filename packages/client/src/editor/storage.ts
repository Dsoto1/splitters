import { loadMap, serializeMap, stampMapRelease, type MapDocument, type ValidationIssue } from '@tiletrigger/shared';

/**
 * Local map storage. Browser storage can be missing or cleared (private
 * windows, quota), so every call is guarded and Export/Import to files stays
 * the durable path until accounts and cloud storage exist (Phase 5).
 */
/** The single rolling autosave used before drafts; read once and moved into the drafts. */
const AUTOSAVE_KEY = 'cs.editor.autosave';
const DRAFTS_KEY = 'cs.editor.drafts';
const INDEX_KEY = 'cs.maps.index';
const mapKey = (id: string) => `cs.map.${id}`;

export interface LibraryEntry {
  id: string;
  name: string;
  updatedAt: string;
}

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Unsaved drafts: the rolling autosave, one per map, written only while a map
 * has unsaved changes. MapMaker always opens on a blank starter; drafts are
 * offered in Open… rather than restored automatically.
 */
export interface Draft {
  map: MapDocument;
  savedAt: string;
}

const MAX_DRAFTS = 5;

function storedDrafts(): { map: unknown; savedAt: string }[] {
  try {
    const list = JSON.parse(get(DRAFTS_KEY) ?? '[]') as { map: unknown; savedAt: string }[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Valid drafts, newest first. The old single autosave (before drafts) is moved in as a draft once. */
export function listDrafts(): Draft[] {
  const legacy = get(AUTOSAVE_KEY);
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as { map: unknown; savedAt: string };
      const r = loadMap(parsed.map);
      // Skip it when it is just the saved copy of a library map.
      const saved = r.ok ? openFromLibrary(r.map.metadata.id) : null;
      const same = r.ok && saved && 'map' in saved && sameContent(saved.map, r.map);
      if (r.ok && !same && !storedDrafts().some((d) => (d.map as MapDocument)?.metadata?.id === r.map.metadata.id)) {
        set(DRAFTS_KEY, JSON.stringify([{ map: r.map, savedAt: parsed.savedAt }, ...storedDrafts()].slice(0, MAX_DRAFTS)));
      }
    } catch {
      /* unreadable: drop it */
    }
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
    } catch {
      /* storage unavailable */
    }
  }
  const out: Draft[] = [];
  for (const d of storedDrafts()) {
    const r = loadMap(d.map);
    if (r.ok) out.push({ map: r.map, savedAt: d.savedAt });
  }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Keep this map's unsaved changes as its draft (replacing its older draft; the oldest drafts fall off). */
export function writeDraft(map: MapDocument): boolean {
  const rest = storedDrafts().filter((d) => (d.map as MapDocument)?.metadata?.id !== map.metadata.id);
  return set(DRAFTS_KEY, JSON.stringify([{ map, savedAt: new Date().toISOString() }, ...rest].slice(0, MAX_DRAFTS)));
}

/** Drop a map's draft (it was saved, or its changes were discarded on purpose). */
export function clearDraft(id: string): void {
  const list = storedDrafts();
  const rest = list.filter((d) => (d.map as MapDocument)?.metadata?.id !== id);
  if (rest.length !== list.length) set(DRAFTS_KEY, JSON.stringify(rest));
}

function sameContent(a: MapDocument, b: MapDocument): boolean {
  const strip = (m: MapDocument) => serializeMap({ ...m, metadata: { ...m.metadata, updatedAt: '' } });
  return strip(a) === strip(b);
}

/** Whether this map has been saved to the local library. */
export function inLibrary(id: string): boolean {
  return listLibrary().some((e) => e.id === id);
}

export function listLibrary(): LibraryEntry[] {
  try {
    const list = JSON.parse(get(INDEX_KEY) ?? '[]') as LibraryEntry[];
    return Array.isArray(list) ? list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [];
  } catch {
    return [];
  }
}

/** Save to the local library, stamping updatedAt. Returns the stored document, or null if storage failed. */
export function saveToLibrary(map: MapDocument): MapDocument | null {
  const stamped: MapDocument = { ...map, metadata: { ...map.metadata, updatedAt: new Date().toISOString() } };
  if (!set(mapKey(stamped.metadata.id), serializeMap(stamped))) return null;
  const list = listLibrary().filter((e) => e.id !== stamped.metadata.id);
  list.push({ id: stamped.metadata.id, name: stamped.metadata.name, updatedAt: stamped.metadata.updatedAt });
  return set(INDEX_KEY, JSON.stringify(list)) ? stamped : null;
}

export function openFromLibrary(id: string): { map: MapDocument } | { issues: ValidationIssue[] } {
  const raw = get(mapKey(id));
  if (!raw) return { issues: [{ severity: 'error', code: 'storage.missing', message: 'map not found in local storage' }] };
  const r = loadMap(raw);
  return r.ok ? { map: r.map } : { issues: r.issues };
}

export function deleteFromLibrary(id: string): void {
  try {
    localStorage.removeItem(mapKey(id));
  } catch {
    /* storage unavailable */
  }
  set(INDEX_KEY, JSON.stringify(listLibrary().filter((e) => e.id !== id)));
}

/**
 * Download the map as a file. It is stamped first (map/identity.ts): its map
 * ID stays, and its version ID changes only when the content did. Returns the
 * stamped map, so the editor keeps the same identity for the next export.
 */
export function exportMap(map: MapDocument): MapDocument {
  const stamped = stampMapRelease(map);
  const blob = new Blob([serializeMap(stamped)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${map.metadata.name.replace(/[^\w.-]+/g, '_') || 'map'}.cmap.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return stamped;
}

export async function importMapFile(file: File): Promise<{ map: MapDocument; issues: ValidationIssue[] } | { issues: ValidationIssue[] }> {
  if (file.size > 4 * 1024 * 1024) return { issues: [{ severity: 'error', code: 'import.size', message: 'file is larger than 4 MB' }] };
  const r = loadMap(await file.text());
  return r.ok ? { map: r.map, issues: r.issues } : { issues: r.issues };
}
