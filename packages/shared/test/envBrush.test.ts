import { describe, expect, it } from 'vitest';
import {
  ENV_BRUSH_DEFAULTS,
  ENV_PRESET_IDS,
  EditHistory,
  MAX_ENV_PER_DAB,
  blockingPlacement,
  brushModels,
  envBlocksPlay,
  envBrushDab,
  envEraseDab,
  envImpact,
  getEnvSpecies,
  groundSampler,
  keepClearZones,
  loadMap,
  newId,
  newMapDocument,
  newTerrain,
  presetSpecies,
  serializeMap,
  setIdRandom,
  withPreset,
  createRng,
  type EnvBrush,
  type MapDocument,
  type TerrainData,
} from '../src/index.ts';

const NOW = new Date('2026-11-09T00:00:00Z');

/** A 200 m terrain: flat grass in the west, a 45° stone slope rising east of x = 40, snow above 30 m. */
function hillside(): TerrainData {
  const t = newTerrain(200, 2);
  const heights = t.heights.slice();
  const materials = t.materials.slice();
  for (let r = 0; r < t.rows; r++)
    for (let c = 0; c < t.cols; c++) {
      const x = t.origin[0] + c * t.spacing;
      heights[r * t.cols + c] = Math.round(Math.max(0, x - 40) * 100);
    }
  for (let r = 0; r < t.rows - 1; r++)
    for (let c = 0; c < t.cols - 1; c++) {
      const x = t.origin[0] + (c + 0.5) * t.spacing;
      materials[r * (t.cols - 1) + c] = x > 40 ? 2 : 0; // stone : grass
    }
  return { ...t, heights, materials };
}

function map(t: TerrainData | null = hillside()): MapDocument {
  const doc = newMapDocument('Env brush', NOW);
  // An empty map (no starter room or spawn), so only what a test adds is in the way.
  return { ...doc, terrain: t, entities: [], classicStructure: { ...doc.classicStructure, tiles: [] } };
}

const ctx = (doc: MapDocument) => ({ ground: groundSampler(doc.terrain ?? null), terrain: doc.terrain ?? null });
const brush = (patch: Partial<EnvBrush> = {}): EnvBrush => ({ ...ENV_BRUSH_DEFAULTS, ...patch, filters: { ...ENV_BRUSH_DEFAULTS.filters, ...patch.filters } });

describe('environment brush: determinism', () => {
  it('the same seed and spot give the same plants; another seed gives others', () => {
    const doc = map();
    const a = envBrushDab(doc, brush(), -20, 0, ctx(doc)).plants;
    const b = envBrushDab(doc, brush(), -20, 0, ctx(doc)).plants;
    const c = envBrushDab(doc, brush({ seed: 2 }), -20, 0, ctx(doc)).plants;
    expect(a.length).toBeGreaterThan(10);
    expect(b).toEqual(a);
    expect(c).not.toEqual(a);
  });
  it('paints the weighted mix, within the size and turn ranges, never two canopy plants too close', () => {
    const doc = map(null);
    const only = brush({ species: [{ model: 'env.broadleaf.oak', weight: 1 }, { model: 'env.grass.clump', weight: 3 }], size: [0.9, 1.1], turn: 45, radius: 15, density: 20 });
    const plants = envBrushDab(doc, only, 0, 0, ctx(doc)).plants;
    expect(new Set(plants.map((p) => p.model))).toEqual(new Set(['env.broadleaf.oak', 'env.grass.clump']));
    for (const p of plants) {
      expect(p.scale).toBeGreaterThanOrEqual(0.9);
      expect(p.scale).toBeLessThanOrEqual(1.1);
      expect(Math.abs(p.yaw)).toBeLessThanOrEqual((45 * Math.PI) / 180 + 0.01);
      expect(Math.hypot(p.position[0], p.position[2])).toBeLessThanOrEqual(15.01);
    }
    const oaks = plants.filter((p) => p.model === 'env.broadleaf.oak');
    const spacing = getEnvSpecies('env.broadleaf.oak')!.placement.minSpacing;
    for (const a of oaks) for (const b of oaks) if (a !== b) expect(Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2])).toBeGreaterThanOrEqual(spacing * 0.9 * 0.99);
    // Grass never stands in a trunk.
    for (const g of plants.filter((p) => p.model === 'env.grass.clump')) for (const o of oaks) expect(Math.hypot(g.position[0] - o.position[0], g.position[2] - o.position[2])).toBeGreaterThan(envImpact('env.broadleaf.oak').reach * o.scale * 0.9);
  });
  it('one dab adds at most MAX_ENV_PER_DAB', () => {
    const doc = map(null);
    expect(envBrushDab(doc, brush({ species: [{ model: 'env.grass.clump', weight: 1 }], radius: 40, density: 100 }), 0, 0, ctx(doc)).plants.length).toBe(MAX_ENV_PER_DAB);
  });
});

describe('environment brush: filters', () => {
  it('slope: a 45° hillside gets no oaks (their limit is 30°); grass (45°) only when the brush allows it', () => {
    const doc = map();
    const oaks = envBrushDab(doc, brush({ species: [{ model: 'env.broadleaf.oak', weight: 1 }], radius: 12, density: 10 }), 70, 0, ctx(doc));
    expect(oaks.plants).toEqual([]);
    expect(oaks.filtered).toBeGreaterThan(0);
    const grass = brush({ species: [{ model: 'env.grass.clump', weight: 1 }], radius: 12, density: 10, filters: { ...ENV_BRUSH_DEFAULTS.filters, slope: [0, 60] } });
    expect(envBrushDab(doc, grass, 70, 0, ctx(doc)).plants.length).toBeGreaterThan(0);
    expect(envBrushDab(doc, { ...grass, filters: { ...grass.filters, slope: [0, 20] } }, 70, 0, ctx(doc)).plants).toEqual([]);
  });
  it('altitude and ground material', () => {
    const doc = map();
    const grass = brush({ species: [{ model: 'env.grass.clump', weight: 1 }], radius: 20, density: 5, filters: { ...ENV_BRUSH_DEFAULTS.filters, slope: [0, 90] } });
    const high = envBrushDab(doc, { ...grass, filters: { ...grass.filters, altitude: [20, null] } }, 60, 0, ctx(doc)).plants;
    expect(high.length).toBeGreaterThan(0);
    for (const p of high) expect(p.position[1]).toBeGreaterThanOrEqual(19.5);
    const onGrass = envBrushDab(doc, { ...grass, filters: { ...grass.filters, materials: ['grass'] } }, 40, 0, ctx(doc)).plants;
    expect(onGrass.length).toBeGreaterThan(0);
    for (const p of onGrass) expect(p.position[0]).toBeLessThanOrEqual(41);
  });
  it('never inside a building', () => {
    const doc = map(null);
    doc.classicStructure.tiles.push({ id: 'tile_room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 } as never);
    const plants = envBrushDab(doc, brush({ species: [{ model: 'env.grass.clump', weight: 1 }], radius: 12, density: 20 }), 0, 0, ctx(doc)).plants;
    const cs = doc.classicStructure.cellSize;
    for (const p of plants) expect(Math.round(p.position[0] / cs) === 0 && Math.round(p.position[2] / cs) === 0).toBe(false);
  });
});

describe('environment brush: keep clear of play', () => {
  const withSpawnAndRoute = (): MapDocument => {
    const doc = map(null);
    doc.entities.push({ id: 'spawn_a', kind: 'spawn', position: [0, 0, 0], yaw: 0, team: null } as never);
    doc.entities.push({ id: 'flag_a', kind: 'flag', position: [12, 0, 0], yaw: 0, team: 'embers' } as never);
    doc.paths = [{ id: 'route_a', points: [[-30, 0, 8], [30, 0, 8]], uses: ['route'], style: 'dirt', width: 3, closed: false, lay: false } as never];
    return doc;
  };
  it('trees and bushes keep off spawns, objectives and routes; grass may go there', () => {
    const doc = withSpawnAndRoute();
    const mix = brush({ species: [{ model: 'env.conifer.spruce', weight: 1 }, { model: 'env.shrub.laurel', weight: 1 }, { model: 'env.grass.clump', weight: 2 }], radius: 18, density: 12 });
    const res = envBrushDab(doc, mix, 0, 4, ctx(doc));
    expect(res.keptClear).toBeGreaterThan(0);
    const zones = keepClearZones(doc);
    for (const p of res.plants) if (envBlocksPlay(p.model, p.variant)) expect(blockingPlacement(doc, p.model, p.position[0], p.position[2], p.scale, p.variant, zones)).toBeNull();
    expect(res.plants.some((p) => p.model === 'env.grass.clump' && Math.hypot(p.position[0], p.position[2]) < 3)).toBe(true);
    // Turned off (MapMaker asks first), they may.
    const off = envBrushDab(doc, { ...mix, filters: { ...mix.filters, keepClear: false } }, 0, 4, ctx(doc));
    expect(off.keptClear).toBe(0);
    expect(off.plants.some((p) => envBlocksPlay(p.model) && blockingPlacement(doc, p.model, p.position[0], p.position[2], p.scale, p.variant, zones))).toBe(true);
  });
  it('a single placement names what it would block', () => {
    const doc = withSpawnAndRoute();
    expect(blockingPlacement(doc, 'env.broadleaf.oak', 0.5, 0)?.kind).toBe('spawn');
    expect(blockingPlacement(doc, 'env.broadleaf.oak', 0, 8)?.kind).toBe('route');
    expect(blockingPlacement(doc, 'env.broadleaf.oak', 12, 1)?.kind).toBe('objective');
    expect(blockingPlacement(doc, 'env.grass.clump', 0, 0)).toBeNull();
    expect(blockingPlacement(doc, 'env.broadleaf.oak', -20, -20)).toBeNull();
  });
  it('what blocks: trunks block movement, a laurel only sight, grass nothing', () => {
    expect(envImpact('env.broadleaf.oak')).toMatchObject({ movement: true, shots: true, sight: true });
    expect(envImpact('env.shrub.laurel')).toMatchObject({ movement: false, sight: true });
    expect(envImpact('env.grass.clump')).toMatchObject({ movement: false, shots: false, sight: false, reach: 0 });
    expect(envImpact('env.cliff.face').movement).toBe(true);
    expect(envImpact('env.broadleaf.oak').reach).toBeGreaterThan(0.2);
  });
});

describe('environment brush: budget, erase, presets', () => {
  it('stops at the environment budget', () => {
    const doc = map(null);
    const res = envBrushDab(doc, brush({ species: [{ model: 'env.conifer.spruce', weight: 1 }, { model: 'env.grass.clump', weight: 1 }], radius: 20, density: 10 }), 0, 0, { ...ctx(doc), room: { placements: 30, colliding: 4 } });
    expect(res.overBudget).toBe(true);
    expect(res.plants.length).toBeLessThanOrEqual(30);
    expect(res.plants.filter((p) => p.model === 'env.conifer.spruce').length).toBeLessThanOrEqual(4);
  });
  it('erase takes the brush species in the circle, or every species', () => {
    const doc = map(null);
    const plants = envBrushDab(doc, brush({ radius: 10, density: 10 }), 0, 0, ctx(doc)).plants.map((p) => ({ ...p, id: newId('prop') }));
    doc.entities.push(...plants, { id: 'crate', kind: 'prop', model: 'prop.crate', position: [0, 0, 0], yaw: 0, scale: 1, solid: true, tint: null } as never);
    const all = envEraseDab(doc, 0, 0, 5, null);
    expect(all.length).toBe(plants.filter((p) => Math.hypot(p.position[0], p.position[2]) <= 5).length);
    expect(all.every((e) => e.model.startsWith('env.'))).toBe(true);
    const oaksOnly = envEraseDab(doc, 0, 0, 10, new Set(['env.broadleaf.oak']));
    expect(oaksOnly.every((e) => e.model === 'env.broadleaf.oak')).toBe(true);
    expect(brushModels(brush()).has('env.broadleaf.oak')).toBe(true);
  });
  it('every preset paints only species we have, with their named variants', () => {
    for (const id of ENV_PRESET_IDS) {
      const mix = presetSpecies(id);
      expect(mix.filter((m) => m.weight > 0).length).toBeGreaterThan(3);
      for (const m of mix) expect(getEnvSpecies(m.model)).toBeTruthy();
    }
    expect(presetSpecies('arid').find((m) => m.model === 'env.grass.clump')?.variant).toBe(1); // dry
    const alpine = withPreset(brush(), 'alpine');
    expect(alpine.filters.materials).toContain('snow');
    expect(alpine.species.find((m) => m.model === 'env.conifer.spruce')!.weight).toBeGreaterThan(0);
  });
});

describe('environment brush: undo and the round trip', () => {
  it('a stroke of several dabs is one undo step; redo brings it back', () => {
    const doc = map();
    const h = new EditHistory(doc);
    const base = doc.entities.length;
    h.beginStroke();
    for (const x of [-60, -50, -40]) {
      const plants = envBrushDab(h.doc, brush(), x, 0, ctx(h.doc)).plants;
      h.execute('Paint Temperate woods', { kind: 'addEntities', entities: plants.map((p) => ({ ...p, id: newId('prop') })) });
    }
    h.endStroke();
    const painted = h.doc.entities.length;
    expect(painted - base).toBeGreaterThan(20);
    h.undo();
    expect(h.doc.entities.length).toBe(base);
    h.redo();
    expect(h.doc.entities.length).toBe(painted);
    h.beginStroke();
    const gone = envEraseDab(h.doc, -50, 0, 6, null);
    h.execute('Erase plants', { kind: 'removeEntities', entities: gone });
    h.endStroke();
    expect(h.doc.entities.length).toBe(painted - gone.length);
    h.undo();
    expect(h.doc.entities.length).toBe(painted);
  });
  it('painted plants survive export and import exactly, and the same strokes repaint the same map', () => {
    setIdRandom(createRng(7));
    const paint = () => {
      let doc = map();
      for (const [x, z] of [[-60, -10], [-45, 5], [-30, 0]] as const) {
        const plants = envBrushDab(doc, withPreset(brush({ seed: 42 }), 'temperate'), x, z, ctx(doc)).plants;
        doc = { ...doc, entities: [...doc.entities, ...plants.map((p) => ({ ...p, id: newId('prop') }))] };
      }
      return doc;
    };
    const doc = paint();
    const loaded = loadMap(serializeMap(doc), undefined, { forEditing: true, openWithErrors: true });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.map.entities).toEqual(doc.entities);
    // Export, import, export again: the same text.
    const once = serializeMap(loaded.map);
    const again = loadMap(once, undefined, { forEditing: true, openWithErrors: true });
    expect(again.ok && serializeMap(again.map)).toBe(once);
    setIdRandom(createRng(7));
    expect(paint().entities).toEqual(doc.entities);
    setIdRandom(Math.random);
  });
});
