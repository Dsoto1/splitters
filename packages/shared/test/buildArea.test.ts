import { describe, expect, it } from 'vitest';
import { MAX_TILE_CELL, MAX_TILE_LEVEL, buildLimitRect, buildZone, newMapDocument, newTerrain, placeTileCommand, playableRect, type MapDocument } from '../src/index.ts';

const withBounds = (doc: MapDocument): MapDocument => ({ ...doc, bounds: { min: [-40, -30], max: [40, 30], style: 'invisible', height: 8 } });

describe('MapMaker build area (playable boundary, build limit, scenery zone)', () => {
  it('the build limit is the outer edge of the last cell a tile may take', () => {
    const doc = newMapDocument('t');
    const r = buildLimitRect(doc);
    expect(r.max[0]).toBe((MAX_TILE_CELL + 0.5) * doc.classicStructure.cellSize);
    expect(r.min[1]).toBe(-r.max[1]);
  });

  it('the playable boundary is the bounds, else the terrain, else none', () => {
    const bare = newMapDocument('t');
    expect(playableRect(bare)).toBeNull();
    const terrain = { ...bare, terrain: newTerrain(100, 2, [0, 30]) };
    expect(playableRect(terrain)).toEqual({ min: [-50, -20], max: [50, 80], from: 'terrain' });
    expect(playableRect(withBounds(terrain))).toEqual({ min: [-40, -30], max: [40, 30], from: 'bounds' });
  });

  it('outside the boundary but inside the limit is scenery; past the limit is beyond', () => {
    const doc = withBounds(newMapDocument('t'));
    expect(buildZone(doc, 0, 0)).toBe('play');
    expect(buildZone(doc, 100, 0)).toBe('scenery');
    expect(buildZone(doc, 3000, 0)).toBe('beyond');
    // No boundary at all: everything inside the limit is the play area.
    expect(buildZone(newMapDocument('t'), 1000, 1000)).toBe('play');
  });

  it('a tile in the scenery zone places; one past the build limit is refused with a message naming it', () => {
    const doc = withBounds(newMapDocument('t'));
    expect('command' in placeTileCommand(doc, 'core.room', 40, 0, 0, 0)).toBe(true);
    expect('command' in placeTileCommand(doc, 'core.room', MAX_TILE_CELL, -MAX_TILE_CELL, 0, 0)).toBe(true);
    const across = placeTileCommand(doc, 'core.room', MAX_TILE_CELL + 1, 0, 0, 0);
    expect('error' in across && across.error).toMatch(/^past the build limit .*256 cells \(2,048 m\)/);
    const up = placeTileCommand(doc, 'core.room', 0, 0, MAX_TILE_LEVEL + 1, 0);
    expect('error' in up && up.error).toMatch(/^past the build limit: levels go 16 up and 16 down/);
  });
});
