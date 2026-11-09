/**
 * Heatmaps of a MapMaker bot test run (MapMaker overhaul Phase 4, item 1; the run: editor/mapTest.ts): where bots
 * went, got stuck, died and where their routes failed, binned into square cells seen from above. Each cell is also
 * split by height into bands, so two floors of a building over the same ground stay two cells, each drawn at the
 * mean height of what fell in it. Sparse: only cells something fell in are kept. Editor-only: nothing is in the map.
 */

export const HEAT_LAYERS = ['went', 'stuck', 'died', 'failed'] as const;
export type HeatLayer = (typeof HEAT_LAYERS)[number];

export const HEAT_LAYER_LABELS: Record<HeatLayer, string> = {
  went: 'Where bots went',
  stuck: 'Where they got stuck',
  died: 'Where they died',
  failed: 'Where routes failed',
};

/** Height bands within a column (m): a storey is about this high. */
export const HEAT_BAND = 2.5;

export interface HeatGrid {
  /** Cell size (m), seen from above. */
  cell: number;
  /** Per cell key: total weight and the weighted sum of heights. */
  cells: Map<number, { w: number; y: number }>;
}

/** A cell to draw: its centre, its mean height, its weight and that as a share of the busiest cell's (0..1]. */
export interface HeatCell {
  x: number;
  y: number;
  z: number;
  value: number;
  share: number;
}

const SPAN = 1 << 14;
const OFF = SPAN / 2;
const BANDS = 1 << 9;

/** A cell size for a map this many metres across: 2 m on small maps, coarser on big ones (at most ~150 a side). */
export function heatCellFor(extent: number): number {
  return Math.max(2, Math.min(8, Math.ceil(extent / 150)));
}

export function heatGrid(cell = 2): HeatGrid {
  return { cell, cells: new Map() };
}

function keyOf(g: HeatGrid, x: number, y: number, z: number): number | null {
  const c = Math.floor(x / g.cell) + OFF;
  const r = Math.floor(z / g.cell) + OFF;
  const b = Math.floor(y / HEAT_BAND) + BANDS / 2;
  if (c < 0 || c >= SPAN || r < 0 || r >= SPAN || b < 0 || b >= BANDS || !Number.isFinite(x + y + z)) return null;
  return (c * SPAN + r) * BANDS + b;
}

/** Add weight `w` at a point. False (nothing added) for a point off the grid's range or not a number. */
export function addHeat(g: HeatGrid, x: number, y: number, z: number, w = 1): boolean {
  const k = keyOf(g, x, y, z);
  if (k === null || !(w > 0)) return false;
  const c = g.cells.get(k);
  if (c) {
    c.w += w;
    c.y += y * w;
  } else g.cells.set(k, { w, y: y * w });
  return true;
}

export function heatTotal(g: HeatGrid): number {
  let t = 0;
  for (const c of g.cells.values()) t += c.w;
  return t;
}

/**
 * The cells to draw, busiest first (ties by place, so the order is stable), each with its share of the busiest
 * cell's weight; cells under `minShare` are left out, and at most `limit` are kept.
 */
export function heatCells(g: HeatGrid, minShare = 0, limit = Infinity): HeatCell[] {
  let max = 0;
  for (const c of g.cells.values()) max = Math.max(max, c.w);
  if (max <= 0) return [];
  const out: (HeatCell & { k: number })[] = [];
  for (const [k, c] of g.cells) {
    const share = c.w / max;
    if (share < minShare) continue;
    const col = Math.floor(k / BANDS / SPAN) - OFF;
    const row = (Math.floor(k / BANDS) % SPAN) - OFF;
    out.push({ k, x: (col + 0.5) * g.cell, z: (row + 0.5) * g.cell, y: c.y / c.w, value: c.w, share });
  }
  out.sort((a, b) => b.value - a.value || a.k - b.k);
  return out.slice(0, limit).map(({ k: _k, ...cell }) => cell);
}

/** A heat colour for a share (0..1): deep blue through cyan, yellow, to red, as [r, g, b] in 0..1. */
export function heatColor(share: number): [number, number, number] {
  const s = Math.max(0, Math.min(1, share));
  const stops: [number, [number, number, number]][] = [
    [0, [0.1, 0.2, 0.9]],
    [0.35, [0.1, 0.85, 0.95]],
    [0.65, [1, 0.9, 0.15]],
    [1, [1, 0.15, 0.1]],
  ];
  for (let i = 1; i < stops.length; i++) {
    const [s1, c1] = stops[i]!;
    const [s0, c0] = stops[i - 1]!;
    if (s <= s1) {
      const f = (s - s0) / (s1 - s0);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return stops[stops.length - 1]![1];
}
