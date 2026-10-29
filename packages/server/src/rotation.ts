import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isMapId, isRetiredMap, parseRotationPreset, playableModes, type GameMode, type MapDocument, type RotationLookup, type RotationPreset } from '@tiletrigger/shared';

/**
 * A dedicated server's (and Host Service's) side of the map rotation
 * (shared sim/rotation.ts): which maps of our suite it can name, and the
 * built-in presets in maps/rotations/.
 */

/**
 * Map names and playable modes by ID, from the suite folder (retired maps and
 * anything else left out). Read once per map: a rotation set mid-match must
 * not stall the tick loop loading 20 maps. `forget()` after the suite changes.
 */
export function suiteLookup(mapsDir: string): RotationLookup & { forget(): void } {
  const known = new Map<string, { name: string; modes: GameMode[] } | null>();
  const lookup = (id: string) => {
    if (!known.has(id)) {
      const file = join(mapsDir, `${id}.json`);
      let info: { name: string; modes: GameMode[] } | null = null;
      if (isMapId(id) && !isRetiredMap(id) && existsSync(file)) {
        try {
          // The raw document: the modes depend only on its metadata and entities (flags, hills, bomb sites…).
          const doc = JSON.parse(readFileSync(file, 'utf8')) as MapDocument;
          if (doc?.metadata && Array.isArray(doc.entities)) info = { name: String(doc.metadata.name ?? id), modes: playableModes(doc) };
        } catch {
          info = null;
        }
      }
      known.set(id, info);
    }
    return known.get(id) ?? null;
  };
  return Object.assign(lookup, { forget: () => known.clear() });
}

/** The built-in rotations (maps/rotations/*.json) whose maps are all in our suite, by name. */
export function readRotationPresets(mapsDir: string, lookup?: RotationLookup): RotationPreset[] {
  const dir = join(mapsDir, 'rotations');
  if (!existsSync(dir)) return [];
  const out: RotationPreset[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    try {
      const p = parseRotationPreset(JSON.parse(readFileSync(join(dir, f), 'utf8')));
      if (p && (!lookup || p.maps.every((m) => lookup(m.map)))) out.push(p);
    } catch {
      // Not a preset.
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Rotation settings as written in a config (ROTATION): "map[:mode]" items and
 * "preset:<id>" (a built-in rotation, its maps in place), or {map, mode}
 * objects. Returns the items to validate, and lines about presets that
 * aren't there.
 */
export function expandRotation(items: readonly unknown[], presets: readonly RotationPreset[]): { items: unknown[]; dropped: string[] } {
  const out: unknown[] = [];
  const dropped: string[] = [];
  for (const item of items) {
    const preset = typeof item === 'string' ? /^preset:(.+)$/.exec(item.trim())?.[1]?.trim() : undefined;
    if (preset === undefined) {
      out.push(item);
      continue;
    }
    const p = presets.find((x) => x.id === preset);
    if (p) out.push(...p.maps);
    else dropped.push(`no built-in rotation "${preset.slice(0, 40)}"`);
  }
  return { items: out, dropped };
}
