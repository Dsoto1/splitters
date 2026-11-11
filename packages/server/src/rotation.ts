import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isMapId, isRetiredMap, mapPlayerCaps, parseRotationPreset, playableModes, type GameMode, type MapDocument, type RotationLookup, type RotationPreset, type VoteCandidate } from '@tiletrigger/shared';

/**
 * A dedicated server's (and Host Service's) side of the map rotation
 * (shared sim/rotation.ts): which maps of our suite it can name, and the
 * built-in presets in maps/rotations/.
 */

/**
 * Map names and playable modes by ID, from the suite folder (retired maps, test
 * maps (metadata.testOnly) and anything else left out). Read once per map: a rotation set mid-match must
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
          if (doc?.metadata && Array.isArray(doc.entities) && !doc.metadata.testOnly) info = { name: String(doc.metadata.name ?? id), modes: playableModes(doc) };
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

/**
 * Between matches (shared sim/mapVote.ts): what a ballot can offer from our suite. Each map's playable modes and its
 * player cap (the most players) in each, read once per map and kept. `warm()` reads them a map at a time in the
 * background (one map every 0.1 s, each a few milliseconds' parse), so the first vote doesn't read the whole suite at once. `forget()` after the suite changes.
 */
export function suitePool(mapsDir: string): {
  /** Our suite's maps that play `mode`, with their caps for it (maps not read yet are read now). */
  forMode(mode: GameMode): VoteCandidate[];
  /** One map's candidate entry in `mode`, or null when it isn't ours or can't play it. */
  entry(id: string, mode: GameMode): VoteCandidate | null;
  warm(): void;
  forget(): void;
} {
  const known = new Map<string, { name: string; caps: Map<GameMode, number> } | null>();
  const ids = () => (existsSync(mapsDir) ? readdirSync(mapsDir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).filter((id) => isMapId(id) && !isRetiredMap(id)).sort() : []);
  const read = (id: string) => {
    if (!known.has(id)) {
      // The raw document (as suiteLookup reads it): parsing is ~15 times cheaper than a full load, so reading one never
      // stalls the tick loop (a full load of a big map takes a fifth of a second). Its modes and caps match the loaded
      // map's for every shipped map.
      let info: { name: string; caps: Map<GameMode, number> } | null = null;
      const file = join(mapsDir, `${id}.json`);
      if (isMapId(id) && !isRetiredMap(id) && existsSync(file)) {
        try {
          const m = JSON.parse(readFileSync(file, 'utf8')) as MapDocument;
          // (The vote's ballot is the core roster: an experimental map is played when the host puts it in the rotation.)
          if (m?.metadata && Array.isArray(m.entities) && !m.metadata.testOnly && m.metadata.tier !== 'experimental') info = { name: String(m.metadata.name ?? id), caps: new Map(playableModes(m).map((mode) => [mode, mapPlayerCaps(m, mode).max])) };
        } catch {
          info = null;
        }
      }
      known.set(id, info);
    }
    return known.get(id) ?? null;
  };
  const entry = (id: string, mode: GameMode): VoteCandidate | null => {
    const info = read(id);
    const max = info?.caps.get(mode);
    return info && max !== undefined ? { map: id, mode, name: info.name, max } : null;
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    forMode: (mode) => ids().flatMap((id) => entry(id, mode) ?? []),
    entry,
    warm() {
      const todo = ids().filter((id) => !known.has(id));
      const step = () => {
        const id = todo.shift();
        if (id === undefined) return void (timer = undefined);
        read(id);
        timer = setTimeout(step, 100);
        timer.unref?.();
      };
      if (!timer) step();
    },
    forget() {
      known.clear();
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
  };
}
