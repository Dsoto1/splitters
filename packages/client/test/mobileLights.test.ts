import { describe, expect, it } from 'vitest';
import { MASK_TILES, MIN_TILES, PHONE_LAMPS_PER_LAYER, lightMaskPlan, maskRows } from '../src/game/clusteredLights.ts';
import { FEED_LINES, SHORT_FEED_LINES, feedLines } from '../src/game/feedLimit.ts';
import { INDOOR_FILL, fillLevel } from '../src/game/indoorFill.ts';

/** The mask's height in texels: rows of tiles times layers. */
const height = (lamps: number, p: { perLayer: number; verticalTiles: number }) => p.verticalTiles * Math.ceil(Math.max(1, lamps) / p.perLayer);

describe('map lights tile mask (docs/MOBILE_AUDIT.md, proposal 1)', () => {
  it('a phone gets 4 lamps to a layer: a sum of at most 15, exact in any float target', () => {
    expect(PHONE_LAMPS_PER_LAYER).toBe(4);
    expect(2 ** PHONE_LAMPS_PER_LAYER - 1).toBeLessThanOrEqual(2 ** 6 - 1);
    expect(lightMaskPlan(138, 4096, 8, 4)).toEqual({ perLayer: 4, verticalTiles: 64 });
    // Neon Galleria's 202: 51 layers, 3,264 texels at 64 rows.
    expect(lightMaskPlan(202, 4096, 8, 4)).toEqual({ perLayer: 4, verticalTiles: 64 });
    expect(lightMaskPlan(202, 2048, 8, 4)).toEqual({ perLayer: 4, verticalTiles: 40 });
  });

  it('one lamp to a layer (?lampbatch=1) fits the texture limit by fewer rows (Flatpack Depot: 138 lamps)', () => {
    for (const max of [2048, 4096, 8192, 16384]) {
      const p = lightMaskPlan(138, max, 8, 1);
      expect(p.perLayer).toBe(1);
      expect(height(138, p)).toBeLessThanOrEqual(max);
      expect(p.verticalTiles).toBeGreaterThanOrEqual(MIN_TILES);
    }
    // 4,096: 29 rows (8,832 texels at 64 rows overflowed and put every lamp out).
    expect(lightMaskPlan(138, 4096, 8, 1).verticalTiles).toBe(29);
    expect(lightMaskPlan(138, 8192, 8, 1).verticalTiles).toBe(59);
  });

  it('a map with few lamps keeps the full 64 rows', () => {
    expect(lightMaskPlan(20, 4096, 8, 1)).toEqual({ perLayer: 1, verticalTiles: MASK_TILES });
    expect(lightMaskPlan(0, 4096, 8, 4)).toEqual({ perLayer: 4, verticalTiles: MASK_TILES });
  });

  it('only past MIN_TILES rows do more lamps share a layer, as few as fit', () => {
    // 4,096 / 8 = 512 layers at most.
    expect(lightMaskPlan(512, 4096, 8, 1).perLayer).toBe(1);
    const p = lightMaskPlan(600, 4096, 8, 1);
    expect(p.perLayer).toBe(2);
    expect(height(600, p)).toBeLessThanOrEqual(4096);
    expect(lightMaskPlan(3000, 4096, 8, 4).perLayer).toBe(6);
    // Never more than Babylon's own batch.
    expect(lightMaskPlan(100000, 4096, 8, 1).perLayer).toBe(8);
  });

  it('every lamp count up to 300 fits on every limit', () => {
    for (const max of [2048, 4096, 8192]) for (let n = 0; n <= 300; n++) for (const want of [1, 4]) {
      const p = lightMaskPlan(n, max, 8, want);
      expect(height(n, p)).toBeLessThanOrEqual(max);
    }
  });

  it("desktops keep Babylon's batch and 64 rows for our maps", () => {
    expect(lightMaskPlan(202, 16384, 23, 0)).toEqual({ perLayer: 23, verticalTiles: 64 });
    expect(lightMaskPlan(202, 4096, 23, 0)).toEqual({ perLayer: 23, verticalTiles: 64 });
  });

  it('no clustered lights: nothing to lay out', () => {
    expect(lightMaskPlan(50, 4096, 0, 4).perLayer).toBe(0);
  });

  it('a rebuild with more lamps shrinks the rows to fit (MapMaker)', () => {
    expect(maskRows(138, 1, 4096)).toBe(29);
    expect(maskRows(5000, 1, 4096)).toBe(1);
    expect(maskRows(10, 1, 4096)).toBe(64);
  });
});

describe('kill feed lines (proposal 12)', () => {
  it('3 on a phone sideways, 5 elsewhere', () => {
    expect(feedLines(true, 390)).toBe(SHORT_FEED_LINES);
    expect(feedLines(true, 320)).toBe(3);
    expect(feedLines(true, 800)).toBe(FEED_LINES);
    expect(feedLines(false, 390)).toBe(5);
    expect(feedLines(false, 1080)).toBe(5);
  });
});

describe('indoor fill (rooms without lamps on Low)', () => {
  it('eases in and out, never in one step', () => {
    expect(fillLevel(0, true, 1 / 60)).toBeCloseTo(INDOOR_FILL.rate / 60);
    let l = 0;
    for (let i = 0; i < 120; i++) l = fillLevel(l, true, 1 / 60);
    expect(l).toBe(1);
    expect(fillLevel(1, false, 0.1)).toBeCloseTo(1 - INDOOR_FILL.rate * 0.1);
    expect(fillLevel(0.5, false, 10)).toBe(0);
  });
});
