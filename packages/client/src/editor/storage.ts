import { loadMap, serializeMap, type MapDocument, type ValidationIssue } from '@chronosplit/shared';

/**
 * Local map storage. Browser storage can be missing or cleared (private
 * windows, quota), so every call is guarded and Export/Import to files stays
 * the durable path until accounts and cloud storage exist (Phase 5).
 */
const AUTOSAVE_KEY = 'cs.editor.autosave';
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

export function readAutosave(): { map: MapDocument; savedAt: string } | null {
  const raw = get(AUTOSAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { map: unknown; savedAt: string };
    const r = loadMap(parsed.map);
    return r.ok ? { map: r.map, savedAt: parsed.savedAt } : null;
  } catch {
    return null;
  }
}

export function writeAutosave(map: MapDocument): boolean {
  return set(AUTOSAVE_KEY, JSON.stringify({ map, savedAt: new Date().toISOString() }));
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

export function exportMap(map: MapDocument): void {
  const blob = new Blob([serializeMap(map)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${map.metadata.name.replace(/[^\w.-]+/g, '_') || 'map'}.cmap.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importMapFile(file: File): Promise<{ map: MapDocument; issues: ValidationIssue[] } | { issues: ValidationIssue[] }> {
  if (file.size > 4 * 1024 * 1024) return { issues: [{ severity: 'error', code: 'import.size', message: 'file is larger than 4 MB' }] };
  const r = loadMap(await file.text());
  return r.ok ? { map: r.map, issues: r.issues } : { issues: r.issues };
}
