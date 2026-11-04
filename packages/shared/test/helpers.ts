import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MAP_FORMAT_VERSION, loadMap, type MapDocument } from '../src/index.ts';

export const ARENA_PATH = fileURLToPath(new URL('../../../maps/phase0_arena.json', import.meta.url));

export function loadArena(): MapDocument {
  const result = loadMap(readFileSync(ARENA_PATH, 'utf8'));
  if (!result.ok) throw new Error(`arena failed to load: ${JSON.stringify(result.issues)}`);
  return result.map;
}

/** Minimal valid map with the given tiles and spawns. */
export function makeMap(tiles: MapDocument['classicStructure']['tiles'], spawns: [number, number, number][] = [[0, 0, 0]]): MapDocument {
  return {
    format: 'tiletrigger.map',
    formatVersion: MAP_FORMAT_VERSION,
    metadata: {
      id: 'test_map',
      name: 'Test',
      author: '',
      description: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      parentId: null,
      recommendedPlayers: { min: 1, max: 2 },
      supportedModes: ['core.deathmatch'],
    },
    classicStructure: { cellSize: 8, levelHeight: 4, theme: 'core.prototype', tiles },
    entities: spawns.map((position, i) => ({ id: `spawn_${i}`, kind: 'spawn' as const, position, yaw: 0, faction: null })),
    factions: [],
    logic: { variables: [], timers: [], objectives: [], rules: [] },
    terrain: null,
    bounds: null,
    teamSetup: null,
    backdrop: null,
    blood: null,
    physics: null,
    dependencies: [],
  };
}

/** A prop as content/props/<pack>.json lists it, with its pack (the file it is in). */
export interface PropEntry {
  id: string;
  pack: string;
  category: string;
  [field: string]: unknown;
}

/** The prop packs and props of content/props/<pack>.json (tools/content/props-manifest.mjs reads them for the tools). */
export function propManifest(): { packs: Record<string, { title: string; creator: string; license: string; licenseFile: string; url: string; download?: string }>; props: PropEntry[] } {
  const dir = new URL('../../../content/props/', import.meta.url);
  const packs: ReturnType<typeof propManifest>['packs'] = {};
  const props: PropEntry[] = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    const data = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { pack: ReturnType<typeof propManifest>['packs'][string]; props: Omit<PropEntry, 'pack'>[] };
    const pack = f.slice(0, -5);
    packs[pack] = data.pack;
    for (const p of data.props) props.push({ ...p, pack } as PropEntry);
  }
  return { packs, props };
}
