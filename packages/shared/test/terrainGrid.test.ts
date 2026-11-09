// Map format v32 (MapMaker lane, the editor half of the Iron Coast job): a terrain up to 321 vertices a side,
// Terrain → Change grid (resampling heights, paint and plants, one undo step), the file's terrain rows, the migration.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TERRAIN_VERTS,
  FINE_GRID_PLANTS_AS,
  plantShare,
  EditHistory,
  GRID_SPACINGS,
  MAP_FORMAT_VERSION,
  MAX_TERRAIN_VERTS,
  Terrain,
  TERRAIN_MATERIALS,
  changeGridCommand,
  loadMap,
  migrateMapDocument,
  newTerrain,
  planGrid,
  resampleTerrain,
  serializeMap,
  terrainHeightAt,
  terrainSpacingFor,
  vertexY,
  type MapDocument,
  type MapEntity,
  type TerrainData,
} from '../src/index.ts';
import { makeMap } from './helpers.ts';

/** 80 × 60 m at 2.5 m: rolling ground, a 12 m cliff running across it at a slant, paint and plants in bands. */
function coastTerrain(): TerrainData {
  const t = newTerrain(80, 2.5, [0, 0], 'grass', 60);
  t.baseY = -0.15;
  for (let r = 0; r < t.rows; r++) {
    for (let c = 0; c < t.cols; c++) {
      const x = t.origin[0] + c * t.spacing;
      const z = t.origin[1] + r * t.spacing;
      const rolling = 60 * Math.sin(x * 0.11) * Math.cos(z * 0.09);
      // The cliff: 12 m up across one cell, along a slanted line (as Iron Coast's crest runs across the grid).
      const cliff = z > 0.3 * x + 4 ? 1200 : 0;
      t.heights[r * t.cols + c] = Math.round(100 + rolling + cliff);
    }
  }
  const w = t.cols - 1;
  t.materials = t.materials.map((_, i) => (i % w < w / 3 ? TERRAIN_MATERIALS.indexOf('sand') : i % w < (2 * w) / 3 ? TERRAIN_MATERIALS.indexOf('stone') : 0));
  t.foliage = t.materials.map((_, i) => (Math.floor(i / w) % 5));
  return t;
}

/** The steepest cell of a terrain (rise over run, its corners). */
function steepest(t: TerrainData): number {
  let s = 0;
  for (let r = 0; r < t.rows - 1; r++) {
    for (let c = 0; c < t.cols - 1; c++) {
      const hs = [vertexY(t, c, r), vertexY(t, c + 1, r), vertexY(t, c, r + 1), vertexY(t, c + 1, r + 1)];
      s = Math.max(s, (Math.max(...hs) - Math.min(...hs)) / t.spacing);
    }
  }
  return s;
}

describe('the cap: 321 vertices a side (format v32)', () => {
  it('the schema takes 321 a side and refuses 322; new terrains keep the old grid', () => {
    expect(MAX_TERRAIN_VERTS).toBe(321);
    expect(DEFAULT_TERRAIN_VERTS).toBe(161);
    const fine = newTerrain(400, 1.25);
    expect([fine.cols, fine.rows]).toEqual([321, 321]);
    expect(Terrain.safeParse(fine).success).toBe(true);
    const over = { ...fine, cols: 322, heights: new Array(322 * 321).fill(0), materials: new Array(321 * 320).fill(0) };
    expect(Terrain.safeParse(over).success).toBe(false);
    // Create terrain still makes a 400 m terrain 2.5 m apart (161 a side): finer is Change grid's choice.
    expect(terrainSpacingFor(400)).toBe(2.5);
    expect(terrainSpacingFor(380, 320)).toBe(2.5);
  });

  it('a 380 × 320 m terrain at 1.25 m (305 × 257) loads, plays its ground and fits the file budget', () => {
    const map = makeMap([], [[0, 0, 0]]);
    const t = resampleTerrain(coastTerrain(), 1.25);
    const big = { ...newTerrain(380, 2.5, [0, 0], 'grass', 320), baseY: -0.15 };
    const fine = resampleTerrain(big, 1.25);
    expect([fine.cols, fine.rows]).toEqual([305, 257]);
    const text = serializeMap({ ...map, terrain: fine });
    // A grid row to a line: well under the 2 MB budget (one value to a line it was over 2 MB).
    expect(text.length).toBeLessThan(1024 * 1024);
    const back = loadMap(text);
    expect(back.ok).toBe(true);
    expect(back.ok && back.map.terrain).toEqual(fine);
    expect(loadMap(serializeMap({ ...map, terrain: t })).ok).toBe(true);
  });
});

describe('the file: terrain grids a row to a line', () => {
  it('is JSON that reads back exactly, one grid row to a line', () => {
    const map: MapDocument = { ...makeMap([], [[0, 0, 0]]), terrain: coastTerrain() };
    const text = serializeMap(map);
    expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(map)));
    const t = map.terrain!;
    const lines = text.split('\n');
    const at = lines.findIndex((l) => l === '    "heights": [');
    expect(at).toBeGreaterThan(0);
    expect(lines[at + 1]!.trim().split(', ')).toHaveLength(t.cols);
    expect(lines[at + 1]!.startsWith('      ')).toBe(true);
    // No terrain: the file as it always was.
    const bare = makeMap([], [[0, 0, 0]]);
    expect(serializeMap(bare)).toBe(`${JSON.stringify(bare, null, 2)}\n`);
    // Plants following the ground (no painted layer) stay an empty list.
    expect(serializeMap({ ...map, terrain: { ...t, foliage: [] } })).toContain('"foliage": []');
  });
});

describe('Change grid: resampling', () => {
  it('heights where old and new vertices meet are unchanged, finer and coarser, either way between them', () => {
    const t = coastTerrain();
    for (const mode of ['smooth', 'exact'] as const) {
      const fine = resampleTerrain(t, 1.25, mode);
      expect([fine.cols, fine.rows]).toEqual([65, 49]);
      expect(fine.origin).toEqual(t.origin);
      for (let r = 0; r < t.rows; r++) for (let c = 0; c < t.cols; c++) expect(fine.heights[r * 2 * fine.cols + c * 2]).toBe(t.heights[r * t.cols + c]);
      const coarse = resampleTerrain(t, 5, mode);
      for (let r = 0; r < coarse.rows; r++) for (let c = 0; c < coarse.cols; c++) expect(coarse.heights[r * coarse.cols + c]).toBe(t.heights[r * 2 * t.cols + c * 2]);
    }
  });

  it('exact at half the spacing is the same surface (drawn and collided as before)', () => {
    const t = coastTerrain();
    const fine = resampleTerrain(t, 1.25, 'exact');
    for (let i = 0; i < 400; i++) {
      const x = -39 + ((i * 7.3) % 78);
      const z = -29 + ((i * 3.1) % 58);
      expect(terrainHeightAt(fine, x, z)).toBeCloseTo(terrainHeightAt(t, x, z)!, 1);
    }
  });

  it('smooth keeps the cliff sharp and rounds rolling ground only inside its cells', () => {
    const t = coastTerrain();
    const fine = resampleTerrain(t, 1.25, 'smooth');
    // The cliff: as steep as it was, measured over the old cell width (a 12 m step over 2.5 m, or more on the finer grid).
    expect(steepest(fine)).toBeGreaterThanOrEqual(steepest(t) - 0.01);
    // Along the cliff's foot and lip the surface is the old one (no rounded lip players could climb).
    for (let x = -36; x <= 36; x += 3.7) {
      const zc = 0.3 * x + 4;
      for (const dz of [-1.3, 1.3]) expect(terrainHeightAt(fine, x, zc + dz)).toBeCloseTo(terrainHeightAt(t, x, zc + dz)!, 1);
    }
    // Rolling ground away from the cliff: the cubic differs from the facets, inside each old cell's corners.
    let differs = 0;
    for (let r = 1; r < fine.rows - 1; r += 2) {
      for (let c = 1; c < fine.cols - 1; c += 2) {
        const x = fine.origin[0] + c * fine.spacing;
        const z = fine.origin[1] + r * fine.spacing;
        if (Math.abs(z - (0.3 * x + 4)) < 8) continue;
        const h = fine.heights[r * fine.cols + c]!;
        const oc = (c - 1) / 2;
        const or = (r - 1) / 2;
        const corners = [t.heights[or * t.cols + oc]!, t.heights[or * t.cols + oc + 1]!, t.heights[(or + 1) * t.cols + oc]!, t.heights[(or + 1) * t.cols + oc + 1]!];
        expect(h).toBeGreaterThanOrEqual(Math.min(...corners));
        expect(h).toBeLessThanOrEqual(Math.max(...corners));
        if (Math.abs(h / 100 + fine.baseY - terrainHeightAt(t, x, z)!) > 0.005) differs++;
      }
    }
    expect(differs).toBeGreaterThan(100);
  });

  it('paint and plants come across: finer, each new cell from the old one it lies in; coarser, the commonest', () => {
    const t = coastTerrain();
    const fine = resampleTerrain(t, 1.25);
    expect(fine.materials).toHaveLength((fine.cols - 1) * (fine.rows - 1));
    expect(fine.foliage).toHaveLength(fine.materials.length);
    for (let r = 0; r < fine.rows - 1; r++) {
      for (let c = 0; c < fine.cols - 1; c++) {
        const old = Math.floor(r / 2) * (t.cols - 1) + Math.floor(c / 2);
        expect(fine.materials[r * (fine.cols - 1) + c]).toBe(t.materials[old]);
        expect(fine.foliage[r * (fine.cols - 1) + c]).toBe(t.foliage[old]);
      }
    }
    // Back to 2.5 m: the paint and plants as they were.
    const back = resampleTerrain(fine, 2.5);
    expect(back.materials).toEqual(t.materials);
    expect(back.foliage).toEqual(t.foliage);
    expect(back.heights).toEqual(t.heights);
    // Coarser: a 5 m cell over a stone/grass border takes what most of its old cells have.
    const coarse = resampleTerrain(t, 5);
    const counts = (vals: number[]) => TERRAIN_MATERIALS.map((_, k) => vals.filter((v) => v === k).length);
    const before = counts(t.materials);
    const after = counts(coarse.materials);
    for (const k of [0, TERRAIN_MATERIALS.indexOf('sand'), TERRAIN_MATERIALS.indexOf('stone')]) expect(after[k]! / coarse.materials.length).toBeCloseTo(before[k]! / t.materials.length, 1);
    // Plants following the ground (no painted layer) stay that way.
    expect(resampleTerrain({ ...t, foliage: [] }, 1.25).foliage).toEqual([]);
  });

  it('plans the grid: vertices, the new size, and what it refuses', () => {
    const t = coastTerrain();
    const p = planGrid(t, 1.25);
    expect(p).toMatchObject({ cols: 65, rows: 49, vertices: 65 * 49, before: 33 * 25, width: 80, depth: 60, error: null });
    expect(planGrid(t, 2.5).error).toMatch(/already/);
    expect(planGrid(t, 3).width).toBe(81); // 80 m is not a whole number of 3 m cells: 27 of them
    const wide = newTerrain(400, 2.5);
    expect(planGrid(wide, 1.25).error).toBeNull();
    expect(planGrid(wide, 1).error).toMatch(/at most 321 a side/);
    expect(GRID_SPACINGS).toContain(1.25);
  });
});

describe('Change grid: the command', () => {
  it('is one undo step, and things standing on the ground move with it', () => {
    const t = coastTerrain();
    const doc: MapDocument = { ...makeMap([], [[0, 0, 0]]), terrain: t };
    // A barrel on rolling ground, between old vertices (the smooth surface differs a little there), a spawn high above it.
    const x = -26.3;
    const z = -21.7;
    const y = terrainHeightAt(t, x, z)!;
    const barrel = { id: 'barrel_a', kind: 'prop', model: 'prop.barrel', position: [x, y, z], yaw: 0, scale: 1 } as MapEntity;
    const high = { id: 'spawn_high', kind: 'spawn', position: [x, y + 5, z], yaw: 0, faction: null } as MapEntity;
    const start: MapDocument = { ...doc, entities: [...doc.entities, barrel, high] };
    const r = changeGridCommand(start, 1.25);
    if ('error' in r) throw new Error(r.error);
    const h = new EditHistory(start);
    h.execute('Change grid to 1.25 m', r.command);
    expect(h.doc.terrain!.spacing).toBe(1.25);
    const moved = h.doc.entities.find((e) => e.id === 'barrel_a')!;
    expect(moved.position[1]).toBeCloseTo(terrainHeightAt(h.doc.terrain!, x, z)!, 2);
    expect(h.doc.entities.find((e) => e.id === 'spawn_high')!.position).toEqual(high.position);
    expect(r.moved).toBe(1);
    h.undo();
    expect(h.doc).toEqual(start);
    expect(h.canUndo).toBe(false);
    h.redo();
    expect(h.doc.terrain).toEqual(r.terrain);
    expect(changeGridCommand(makeMap([], [[0, 0, 0]]), 1.25)).toEqual({ error: 'the map has no terrain' });
    expect('error' in changeGridCommand(start, 0.25)).toBe(true);
  });
});

describe('format v32', () => {
  it('a v31 map migrates unchanged and loads', () => {
    expect(MAP_FORMAT_VERSION).toBeGreaterThanOrEqual(32);
    const v31 = { ...JSON.parse(readFileSync(new URL('./fixtures/iron_compound_v26.json', import.meta.url), 'utf8')), formatVersion: 31 };
    const { doc, fromVersion } = migrateMapDocument(structuredClone(v31));
    expect(fromVersion).toBe(31);
    expect(doc).toEqual({ ...v31, formatVersion: MAP_FORMAT_VERSION });
    expect(loadMap(structuredClone(v31)).ok).toBe(true);
  });
});

describe('plants on fine grids (owner, 2026-11-09)', () => {
  it('grow as many to the square metre as a 2.5 m grid; 2 m and coarser grids as before', () => {
    const perSquareMetre = (s: number) => plantShare(s) / (s * s);
    expect(FINE_GRID_PLANTS_AS).toBe(2.5);
    for (const s of [1, 1.25, 1.5, 1.75]) expect(perSquareMetre(s)).toBeCloseTo(1 / (2.5 * 2.5), 9);
    for (const s of [2, 2.5, 3, 4]) expect(plantShare(s)).toBe(1);
  });
});
