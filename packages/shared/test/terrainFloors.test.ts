import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FLOOR_REACH, applyCommand, buildMapGeometry, loadMap, newMapDocument, newTerrain, terrainUnderFloors, vertexY, withTerrainUnderFloors, type MapDocument, type TerrainData } from '../src/index.ts';

/** A one-room map on flat terrain at height `y` (metres). */
function roomOn(y: number): MapDocument {
  const doc = newMapDocument('Floors');
  const t = newTerrain(24);
  t.heights.fill(Math.round(y * 100));
  return { ...doc, terrain: t, classicStructure: { ...doc.classicStructure, tiles: [{ id: 'tile_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }] } };
}

/** The highest terrain vertex inside a floor's footprint (edges included), and the floor's top. */
function worstUnderFloors(doc: MapDocument, t: TerrainData): { over: number; top: number } {
  let over = -Infinity;
  let top = 0;
  for (const b of buildMapGeometry(doc)) {
    if (b.kind !== 'floor' || b.yaw) continue;
    top = b.max[1];
    for (let r = 0; r < t.rows; r++) {
      for (let c = 0; c < t.cols; c++) {
        const x = t.origin[0] + c * t.spacing;
        const z = t.origin[1] + r * t.spacing;
        if (x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2]) over = Math.max(over, vertexY(t, c, r) - top);
      }
    }
  }
  return { over, top };
}

describe('terrain under floors', () => {
  it('lowers ground that reaches a floor, and leaves ground well below or far above alone', () => {
    for (const y of [0, 0.02, 0.6, FLOOR_REACH - 0.1]) {
      const doc = roomOn(y);
      const t = terrainUnderFloors(doc)!;
      expect(worstUnderFloors(doc, t).over).toBeLessThan(-0.04);
    }
    const low = roomOn(-1);
    expect(terrainUnderFloors(low)).toBe(low.terrain);
    const buried = roomOn(FLOOR_REACH + 1);
    expect(terrainUnderFloors(buried)).toBe(buried.terrain);
  });

  it('MapMaker edits lower the ground in the same undo step', () => {
    const doc = roomOn(0.3);
    const before = { ...doc, classicStructure: { ...doc.classicStructure, tiles: [] } };
    const cmd = withTerrainUnderFloors(before, { kind: 'addTiles', tiles: doc.classicStructure.tiles });
    expect(cmd.kind).toBe('batch');
    const after = applyCommand(before, cmd);
    expect(worstUnderFloors(after, after.terrain!).over).toBeLessThan(-0.04);
    // An edit that moves no floor passes through untouched.
    const meta = { kind: 'setMetadata' as const, before: {}, after: { name: 'x' } };
    expect(withTerrainUnderFloors(after, meta)).toBe(meta);
  });

  it('every shipped map loads with no terrain through a floor', () => {
    const dir = new URL('../../../maps/', import.meta.url);
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const r = loadMap(readFileSync(new URL(f, dir), 'utf8'));
      if (!r.ok || !r.map.terrain) continue;
      expect(terrainUnderFloors(r.map), f).toBe(r.map.terrain);
    }
  });
});
