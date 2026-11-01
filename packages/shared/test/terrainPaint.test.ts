import { describe, expect, it } from 'vitest';
import { CORE_MATERIALS, TERRAIN_MATERIALS, TERRAIN_SURFACES, terrainMaterialFor } from '../src/index.ts';

describe('painting the terrain with a ground swatch', () => {
  it('the eight terrain grounds paint as themselves', () => {
    for (const m of TERRAIN_MATERIALS) expect(terrainMaterialFor(TERRAIN_SURFACES[m])).toBe(m);
  });

  it("style packs' grounds paint the layer that reads closest (Packed Snow is snow, not the Terrain tab's ground)", () => {
    expect(terrainMaterialFor('core.packed_snow')).toBe('snow');
    expect(terrainMaterialFor('core.drift_snow')).toBe('snow');
    expect(terrainMaterialFor('core.lake_ice')).toBe('snow');
    expect(terrainMaterialFor('core.pbr_ice')).toBe('snow');
    expect(terrainMaterialFor('core.shingle')).toBe('gravel');
    expect(terrainMaterialFor('core.packed_dirt')).toBe('dirt');
    expect(terrainMaterialFor('core.root_cover')).toBe('dirt');
    expect(terrainMaterialFor('core.pbr_dusty_road')).toBe('dirt');
  });

  it('every Ground swatch on the palette paints some terrain layer', () => {
    for (const def of CORE_MATERIALS.filter((d) => d.category === 'Ground')) expect(terrainMaterialFor(def.id), def.id).not.toBeNull();
  });

  it('an unknown material has no ground (the Terrain tab decides)', () => {
    expect(terrainMaterialFor('nope.nothing')).toBeNull();
  });
});
