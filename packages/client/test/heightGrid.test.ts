import { describe, expect, it } from 'vitest';
import { MAX_TERRAIN_VERTS, Terrain, newTerrain, terrainHeightAt, type TerrainData } from '@tiletrigger/shared';
import { gridAreaHeightAt, gridHeightAt, parseAsciiGrid, terrainFromHeightGrid, type HeightGrid } from '../src/editor/heightGrid.ts';

const TerrainSchemaCheck = (t: TerrainData) => Terrain.safeParse(t).success;
const asc = (rows: number[][], header = 'xllcorner -2\nyllcorner -1\ncellsize 2\nNODATA_value -9999') => `ncols ${rows[0]!.length}\nnrows ${rows.length}\n${header}\n${rows.map((r) => r.join(' ')).join('\n')}\n`;

describe('parseAsciiGrid', () => {
  it('reads the header and flips the rows so the first row is the south one', () => {
    const g = parseAsciiGrid(asc([
      [10, 11, 12],
      [20, 21, 22],
    ])) as HeightGrid;
    expect(g.cols).toBe(3);
    expect(g.rows).toBe(2);
    // Corner -2, -1 with 2 m cells: the south-west cell's centre is (-1, 0).
    expect(g.x0).toBe(-1);
    expect(g.z0).toBe(0);
    // The file's last row is the south one.
    expect(Array.from(g.values)).toEqual([20, 21, 22, 10, 11, 12]);
    expect(gridHeightAt(g, -1, 0)).toBe(20);
    expect(gridHeightAt(g, 3, 2)).toBe(12);
    expect(gridHeightAt(g, 0, 1)).toBeCloseTo(15.5);
    expect(gridHeightAt(g, 5, 0)).toBeNull();
  });

  it('takes centre coordinates, missing data and refuses what is not a grid', () => {
    const g = parseAsciiGrid(asc([[1, -9999], [3, 4]], 'xllcenter 10\nyllcenter 20\ncellsize 1\nnodata_value -9999')) as HeightGrid;
    expect([g.x0, g.z0]).toEqual([10, 20]);
    expect(Number.isNaN(g.values[3]!)).toBe(true);
    expect(gridHeightAt(g, 11, 21)).toBeNull();
    expect(parseAsciiGrid('hello')).toHaveProperty('error');
    expect(parseAsciiGrid('ncols 2\nnrows 2\nxllcorner 0\nyllcorner 0\ncellsize 1\n1 2 3\n')).toHaveProperty('error');
    expect(parseAsciiGrid('ncols 2\nnrows 2\nxllcorner 0\nyllcorner 0\ncellsize 1\n1 2 x 4\n')).toHaveProperty('error');
  });
});

describe('terrainFromHeightGrid', () => {
  it('puts the height at the centre point at the ground level of a new terrain', () => {
    // A slope rising 1 m per metre eastwards, 21 × 11 cells of 1 m round the centre.
    const rows = Array.from({ length: 11 }, () => Array.from({ length: 21 }, (_, c) => 100 + c));
    const g = parseAsciiGrid(asc(rows, 'xllcenter -10\nyllcenter -5\ncellsize 1')) as HeightGrid;
    const { terrain, datum, resampled } = terrainFromHeightGrid(g);
    expect(resampled).toBe(false);
    expect(datum).toBe(110);
    expect([terrain.cols, terrain.rows, terrain.spacing]).toEqual([21, 11, 1]);
    expect(terrain.origin).toEqual([-10, -5]);
    expect(terrainHeightAt(terrain, 0, 0)).toBeCloseTo(-0.15);
    expect(terrainHeightAt(terrain, 4, 2)).toBeCloseTo(3.85);
    expect(TerrainSchemaCheck(terrain)).toBe(true);
    // A typed ground level wins.
    expect(terrainHeightAt(terrainFromHeightGrid(g, { datum: 100 }).terrain, 0, 0)).toBeCloseTo(9.85);
  });

  it('thins a big grid to the vertex limit and keeps the old ground paint where it reaches', () => {
    const n = 401;
    const rows = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => (r + c) / 10));
    const g = parseAsciiGrid(asc(rows, 'xllcenter -200\nyllcenter -200\ncellsize 1')) as HeightGrid;
    const old = newTerrain(40, 2, [0, 0], 'sand');
    const { terrain, resampled } = terrainFromHeightGrid(g, { current: old });
    expect(resampled).toBe(true);
    expect(terrain.cols).toBeLessThanOrEqual(MAX_TERRAIN_VERTS);
    expect(terrain.spacing).toBe(2.5);
    expect(terrain.cols).toBe(161);
    const cell = (x: number, z: number) => terrain.materials[Math.floor((z - terrain.origin[1]) / terrain.spacing) * (terrain.cols - 1) + Math.floor((x - terrain.origin[0]) / terrain.spacing)];
    expect(cell(1, 1)).toBe(3); // sand, from the old terrain
    expect(cell(150, 150)).toBe(0); // grass, past it
    expect(TerrainSchemaCheck(terrain)).toBe(true);
  });

  it('fills missing heights from their neighbours', () => {
    const g = parseAsciiGrid(asc([[5, 5, 5], [5, -9999, 5], [-9999, -9999, -9999]], 'xllcenter -1\nyllcenter -1\ncellsize 1\nnodata_value -9999')) as HeightGrid;
    const { terrain } = terrainFromHeightGrid(g, { datum: 5 });
    expect(terrain.heights.every((h) => Number.isFinite(h))).toBe(true);
    expect(terrain.heights.every((h) => h === 0)).toBe(true);
  });

  it('averages the file round each vertex when it thins a grid, instead of picking one height', () => {
    // A level field at 100 m with a 1 m bump on every 5th height (lidar's kerbs and hedges): sampled every 2.5 m a
    // point sample lands on bumps in a pattern; the average sees them as the 20 cm they are over the area.
    const n = 401;
    const rows = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => (c % 5 === 0 && r % 5 === 0 ? 101 : 100)));
    const g = parseAsciiGrid(asc(rows, 'xllcenter -200\nyllcenter -200\ncellsize 1')) as HeightGrid;
    const { terrain } = terrainFromHeightGrid(g, { datum: 100 });
    expect(terrain.spacing).toBe(2.5);
    const inner = terrain.heights.filter((_, i) => i % terrain.cols > 2 && i % terrain.cols < terrain.cols - 3);
    const spread = Math.max(...inner) - Math.min(...inner);
    expect(spread).toBeLessThan(30); // cm: the point sample would be 100
    expect(gridAreaHeightAt(g, 0, 0, 2.5)).toBeGreaterThan(100);
    expect(gridAreaHeightAt(g, 0, 0, 2.5)).toBeLessThan(100.3);
    // A slope is kept: the average of a ramp is the ramp.
    const ramp = parseAsciiGrid(asc(Array.from({ length: n }, () => Array.from({ length: n }, (_, c) => c / 10)), 'xllcenter -200\nyllcenter -200\ncellsize 1')) as HeightGrid;
    expect(gridAreaHeightAt(ramp, 10, 0, 2.5)).toBeCloseTo(21, 5);
  });

  it('smooths the file before thinning when asked, and keeps a bank', () => {
    // A 6 m bank (from 100 to 106 m over 20 m) with noise of ±0.5 m on it.
    const n = 121;
    let k = 7;
    const noise = () => ((k = (k * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5);
    const rows = Array.from({ length: n }, () => Array.from({ length: n }, (_, c) => 100 + Math.max(0, Math.min(6, (c - 50) * 0.3)) + noise()));
    const g = parseAsciiGrid(asc(rows, 'xllcenter -60\nyllcenter -60\ncellsize 1')) as HeightGrid;
    const raw = terrainFromHeightGrid(g, { datum: 100 }).terrain;
    const smooth = terrainFromHeightGrid(g, { datum: 100, smoothing: 2 }).terrain;
    const bump = (t: TerrainData) => {
      let worst = 0;
      for (let r = 5; r < t.rows - 5; r++) for (let c = 5; c < 40; c++) worst = Math.max(worst, Math.abs(t.heights[r * t.cols + c]! - t.heights[r * t.cols + c + 1]!));
      return worst;
    };
    expect(bump(smooth)).toBeLessThan(bump(raw) / 2);
    // The bank keeps its height: low on the west, 6 m up on the east.
    expect(terrainHeightAt(smooth, -40, 0)! + 0.15).toBeCloseTo(0, 0);
    expect(terrainHeightAt(smooth, 40, 0)! + 0.15).toBeCloseTo(6, 0);
    expect(TerrainSchemaCheck(smooth)).toBe(true);
  });
});
