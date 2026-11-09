import type { MapDocument } from '../map/schema.ts';
import { newId } from './commands.ts';

/**
 * Starter layouts (docs/MAPMAKER_OVERHAUL_PLAN.md, Phase 3 item 5): New map → Start from. Each is a map file of its
 * own, `maps/templates/<id>.json`, built in MapMaker like any map. They live apart from the suite (maps/*.json), so
 * they are never in a map list, a playlist or the menu; MapMaker loads one only when you start from it, and the new
 * map gets its own id and name (the template stays as it is).
 */
export interface MapTemplate {
  id: string;
  label: string;
  /** What it starts you with. */
  note: string;
}

export const MAP_TEMPLATES: readonly MapTemplate[] = [
  { id: 'arena', label: 'Arena', note: 'A walled arena for free-for-all: a middle, four corners, cover and pickups' },
  { id: 'ctf', label: 'Symmetric CTF', note: 'Two mirrored bases with their flags and spawns, lanes between them' },
  { id: 'assault', label: 'Assault', note: 'Attackers push through two sectors of objectives to a final hold' },
  { id: 'open_terrain', label: 'Open terrain', note: 'Rolling ground with a few hills, a road and spawns round it' },
];

/** A new map started from a template: the template's layout with its own id, name and dates. */
export function startFromTemplate(template: MapDocument, name: string, now: Date = new Date()): MapDocument {
  const ts = now.toISOString();
  const { release: _r, thumbnail: _t, thumbnailCamera: _c, cardCamera: _k, ...metadata } = template.metadata;
  return { ...template, metadata: { ...metadata, id: newId('map'), name, author: '', createdAt: ts, updatedAt: ts, parentId: null } };
}
