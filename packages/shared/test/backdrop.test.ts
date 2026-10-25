import { describe, expect, it } from 'vitest';
import {
  CORE_PROPS,
  CORE_THEMES,
  SCATTER_SETS,
  SCATTER_SET_IDS,
  SCENERY_IDS,
  SKIES,
  SKY_IDS,
  THEME_BACKDROPS,
  TERRAIN_MATERIALS,
  applyBrush,
  cellFoliage,
  loadMap,
  newTerrain,
  resolveBackdrop,
  scatterProps,
  serializeMap,
  validateMap,
} from '../src/index.ts';
import { makeMap } from './helpers.ts';

describe('backdrops', () => {
  it('every sky id has a definition, and every theme a backdrop', () => {
    for (const id of SKY_IDS) expect(SKIES.get(id), id).toBeDefined();
    for (const t of CORE_THEMES) {
      const b = THEME_BACKDROPS[t.id];
      expect(b, t.id).toBeDefined();
      expect(SKY_IDS).toContain(b!.sky);
      expect(SCENERY_IDS).toContain(b!.scenery);
    }
  });

  it("a map without its own backdrop uses its theme's, with the ground following the terrain's edge", () => {
    const map = makeMap([{ id: 'tile_1', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]);
    expect(resolveBackdrop(map)).toEqual(THEME_BACKDROPS['core.prototype']);
    map.terrain = newTerrain(32, 2, [0, 0], 'snow');
    expect(resolveBackdrop(map).ground).toBe('snow');
    map.classicStructure.theme = 'core.station';
    expect(resolveBackdrop(map).ground).toBe('none');
  });

  it('a chosen backdrop round-trips through the file format and validates', () => {
    const map = makeMap([{ id: 'tile_1', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]);
    map.backdrop = { sky: 'sunset', scenery: 'mesas', ground: 'sand', haze: 0.3 };
    const back = loadMap(serializeMap(map));
    expect(back.ok ? 'ok' : JSON.stringify(back.issues)).toBe('ok');
    if (back.ok) expect(back.map.backdrop).toEqual(map.backdrop);
    expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
    const bad = loadMap(serializeMap({ ...map, backdrop: { ...map.backdrop, sky: 'aurora' as 'clear' } }));
    expect(bad.ok).toBe(false);
  });

  it('old maps (format 8) load with no backdrop and automatic plants', () => {
    const map = makeMap([{ id: 'tile_1', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]);
    const t = newTerrain(16);
    const raw = JSON.parse(serializeMap({ ...map, terrain: t }));
    raw.formatVersion = 8;
    delete raw.backdrop;
    delete raw.terrain.foliage;
    const back = loadMap(raw);
    expect(back.ok ? 'ok' : JSON.stringify(back.issues)).toBe('ok');
    if (back.ok) {
      expect(back.map.backdrop).toBeNull();
      expect(back.map.terrain!.foliage).toEqual([]);
    }
  });
});

describe('foliage', () => {
  it('without a painted layer, plants follow the ground: grass grows, stone stays bare', () => {
    const t = newTerrain(16, 2, [0, 0], 'grass');
    expect(cellFoliage(t, 0)).toBeGreaterThan(0);
    t.materials[0] = TERRAIN_MATERIALS.indexOf('stone');
    expect(cellFoliage(t, 0)).toBe(0);
  });

  it('the foliage brush paints a level inside its radius and keeps the automatic cover elsewhere', () => {
    const t = newTerrain(32, 2, [0, 0], 'grass');
    const painted = applyBrush(t, { brush: 'foliage', x: 0, z: 0, radius: 4, strength: 1, level: 4 });
    expect(painted.foliage).toHaveLength(t.materials.length);
    const w = t.cols - 1;
    const centre = Math.floor((t.rows - 1) / 2) * w + Math.floor(w / 2);
    expect(cellFoliage(painted, centre)).toBe(4);
    expect(cellFoliage(painted, 0)).toBe(cellFoliage(t, 0));
    // Heights are untouched.
    expect(painted.heights).toEqual(t.heights);
    expect(t.foliage).toEqual([]);
  });
});

describe('scatter brush', () => {
  const ids = new Set(CORE_PROPS.map((p) => p.id));

  it('every set only uses props that exist', () => {
    for (const id of SCATTER_SET_IDS) for (const [model] of SCATTER_SETS[id].models) expect(ids.has(model), `${id}: ${model}`).toBe(true);
  });

  it('plants a patch with its spacing, on the terrain, the same for the same seed', () => {
    const map = makeMap([], [[30, 0, 30]]);
    map.terrain = newTerrain(64, 2, [0, 0], 'grass');
    map.terrain.heights = map.terrain.heights.map(() => 150);
    const a = scatterProps(map, 'forest', 0, 0, 12, 0, 7);
    expect(a.length).toBeGreaterThan(5);
    expect(scatterProps(map, 'forest', 0, 0, 12, 0, 7)).toEqual(a);
    for (const p of a) {
      expect(Math.hypot(p.position[0], p.position[2])).toBeLessThanOrEqual(12.01);
      expect(p.position[1]).toBeCloseTo(1.45, 1);
    }
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) expect(Math.hypot(a[i]!.position[0] - a[j]!.position[0], a[i]!.position[2] - a[j]!.position[2])).toBeGreaterThanOrEqual(SCATTER_SETS.forest.spacing - 0.02);
  });

  it('keeps clear of spawns and pickups, and a full patch takes no more', () => {
    const map = makeMap([], [[0, 0, 0]]);
    const first = scatterProps(map, 'bushes', 0, 0, 6, 0, 1);
    for (const p of first) expect(Math.hypot(p.position[0], p.position[2])).toBeGreaterThanOrEqual(1.99);
    const full = { ...map, entities: [...map.entities, ...first.map((e, i) => ({ ...e, id: `p${i}` }))] };
    expect(scatterProps(full, 'bushes', 0, 0, 6, 0, 2).length).toBeLessThan(first.length * 0.6);
  });
});
