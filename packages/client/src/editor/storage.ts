import { loadMap, parseSetPiece, serializeMap, stampMapRelease, type MapDocument, type SetPieceDefinition, type ValidationIssue } from '@tiletrigger/shared';

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
      const r = loadMap(parsed.map, undefined, { forEditing: true });
      // Skip it when it is just the saved copy of a library map.
      const saved = r.ok ? openFromLibrary(r.map.metadata.id, true) : null;
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
    const r = loadMap(d.map, undefined, { forEditing: true });
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

/** A saved map: as played, or `forEditing` (MapMaker: paths kept out of the ground, see loadMap). */
export function openFromLibrary(id: string, forEditing = false): { map: MapDocument } | { issues: ValidationIssue[] } {
  const raw = get(mapKey(id));
  if (!raw) return { issues: [{ severity: 'error', code: 'storage.missing', message: 'map not found in local storage' }] };
  const r = loadMap(raw, undefined, { forEditing });
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
  download(serializeMap(stamped), `${map.metadata.name.replace(/[^\w.-]+/g, '_') || 'map'}.cmap.json`);
  return stamped;
}

/** Hand the browser a file to save. */
function download(text: string, name: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importMapFile(file: File): Promise<{ map: MapDocument; issues: ValidationIssue[] } | { issues: ValidationIssue[] }> {
  if (file.size > 4 * 1024 * 1024) return { issues: [{ severity: 'error', code: 'import.size', message: 'file is larger than 4 MB' }] };
  const r = loadMap(await file.text(), undefined, { forEditing: true });
  return r.ok ? { map: r.map, issues: r.issues } : { issues: r.issues };
}

// ---------------------------------------------------------------- the player's set pieces

/**
 * The player's own set pieces (MapMaker → Save selection as set piece), kept in this browser next to their maps: a
 * list of definitions named `local.<name>` (a map that places one carries its definition, so the map plays anywhere).
 * Export and Import move them between browsers as JSON files; nothing is uploaded (docs/MULTIPLAYER_DIRECTION.md).
 */
const SET_PIECES_KEY = 'cs.setpieces';
/** The library holds at most this many pieces (saving another drops the oldest). */
export const SET_PIECE_LIBRARY_MAX = 64;

interface StoredSetPiece {
  def: unknown;
  savedAt: string;
}

function storedSetPieces(): StoredSetPiece[] {
  try {
    const list = JSON.parse(get(SET_PIECES_KEY) ?? '[]') as StoredSetPiece[];
    return Array.isArray(list) ? list.filter((s) => s && typeof s === 'object') : [];
  } catch {
    return [];
  }
}

const storedId = (s: StoredSetPiece): unknown => (s.def as { id?: unknown } | null)?.id;

/** The library's pieces, newest first; each is read as untrusted data (one that no longer parses is left out). */
export function listSetPieces(): { def: SetPieceDefinition; savedAt: string }[] {
  const out: { def: SetPieceDefinition; savedAt: string }[] = [];
  for (const s of storedSetPieces()) {
    const r = parseSetPiece(s.def);
    if (r.ok && r.def.id.startsWith('local.')) out.push({ def: r.def, savedAt: String(s.savedAt ?? '') });
  }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Keep a piece in the library (replacing one with the same id). False when browser storage refused it. */
export function saveSetPiece(def: SetPieceDefinition): boolean {
  const rest = storedSetPieces().filter((s) => storedId(s) !== def.id);
  return set(SET_PIECES_KEY, JSON.stringify([{ def, savedAt: new Date().toISOString() }, ...rest].slice(0, SET_PIECE_LIBRARY_MAX)));
}

export function deleteSetPiece(id: string): void {
  set(SET_PIECES_KEY, JSON.stringify(storedSetPieces().filter((s) => storedId(s) !== id)));
}

/**
 * A piece as content/setpieces/<family>.json holds it (the owner ships a piece the way official maps are files):
 * its id `setpiece.<name>`, no `family` (the file's), its fields in the content files' order.
 */
export function officialSetPiece(def: SetPieceDefinition): Record<string, unknown> {
  const { id, displayName, category, blurb, packs, footprint, mirror, roles, ports, parts, markers } = def;
  return Object.fromEntries(
    Object.entries({ id: `setpiece.${id.slice(id.indexOf('.') + 1)}`, displayName, category, blurb, packs, footprint, mirror, roles, ports, parts, markers }).filter(([, v]) => v !== undefined),
  );
}

/**
 * Download a piece as a JSON file: the player's definition as it is (Import reads it back, in any browser), or with
 * `official` (the owner) as a family file for content/setpieces/<family>.json (docs/CONTENT_PIPELINE.md, "Set pieces").
 */
export function exportSetPiece(def: SetPieceDefinition, official?: { family: string }): void {
  const name = def.id.slice(def.id.indexOf('.') + 1);
  if (official) download(`${JSON.stringify({ family: official.family, pieces: [officialSetPiece(def)] }, null, 2)}\n`, `${official.family}.json`);
  else download(`${JSON.stringify(def, null, 2)}\n`, `${name}.setpiece.json`);
}

/**
 * Read set pieces from a file: one definition, a list of them, or a family file ({ family, pieces }, as in
 * content/setpieces/). Each is checked as untrusted data (parseSetPiece); a shipped id (setpiece.*) comes in as local.*.
 */
export async function importSetPieceFile(file: File): Promise<{ defs: SetPieceDefinition[]; problems: string[] }> {
  if (file.size > 2 * 1024 * 1024) return { defs: [], problems: ['the file is larger than 2 MB'] };
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch (e) {
    return { defs: [], problems: [`not a JSON file: ${(e as Error).message}`] };
  }
  const family = raw && typeof raw === 'object' && !Array.isArray(raw) && typeof (raw as { family?: unknown }).family === 'string' ? (raw as { family: string }).family : undefined;
  const pieces = (raw as { pieces?: unknown } | null)?.pieces;
  const list: unknown[] = Array.isArray(raw) ? raw : Array.isArray(pieces) ? pieces : [raw];
  const defs: SetPieceDefinition[] = [];
  const problems: string[] = [];
  list.slice(0, SET_PIECE_LIBRARY_MAX).forEach((item, i) => {
    const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
    const local = o && typeof o.id === 'string' ? { ...o, id: o.id.replace(/^setpiece\./, 'local.'), family: o.family ?? family ?? 'custom' } : item;
    const r = parseSetPiece(local);
    if (r.ok) defs.push(r.def);
    else problems.push(`piece ${i + 1}: ${r.problems.slice(0, 3).join('; ')}`);
  });
  return { defs, problems };
}
