import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadMap, type MapDocument } from '../src/index.ts';

export const ARENA_PATH = fileURLToPath(new URL('../../../maps/phase0_arena.json', import.meta.url));

export function loadArena(): MapDocument {
  const result = loadMap(readFileSync(ARENA_PATH, 'utf8'));
  if (!result.ok) throw new Error(`arena failed to load: ${JSON.stringify(result.issues)}`);
  return result.map;
}

/** Minimal valid map with the given tiles and spawns. */
export function makeMap(tiles: MapDocument['classicStructure']['tiles'], spawns: [number, number, number][] = [[0, 0, 0]]): MapDocument {
  return {
    format: 'chronosplit.map',
    formatVersion: 4,
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
    logic: { variables: [], timers: [], objectives: [], rules: [] },
    dependencies: [],
  };
}
