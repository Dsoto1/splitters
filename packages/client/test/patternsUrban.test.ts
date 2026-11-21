/**
 * The four patterns painted for Style Pack 14 Urban & Civilian (Tileset 11, plan step B): parking bay lines, tactile
 * paving, graffiti on brick, damaged plaster. Our own painters (materials/patterns.ts): the same pixels every time,
 * and the shapes where the material's notes say they are.
 */
import { describe, expect, it } from 'vitest';
import { coreMaterials } from '@tiletrigger/shared';
import { materialPixels, patternSize } from '../src/materials/patterns.ts';

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** The pixel at (u, v) of a material's pattern (v up: row 0 is the foot of a wall). */
function at(id: string, u: number, v: number): number[] {
  const def = coreMaterials.get(id)!;
  const size = patternSize(def);
  const px = materialPixels(def, size);
  const i = (Math.min(size - 1, Math.floor(v * size)) * size + Math.min(size - 1, Math.floor(u * size))) * 4;
  return [px[i]!, px[i + 1]!, px[i + 2]!];
}
const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
const luma = (c: number[]) => 0.299 * c[0]! + 0.587 * c[1]! + 0.114 * c[2]!;
const chroma = (c: number[]) => Math.max(...c) - Math.min(...c);

describe('Urban & Civilian patterns', () => {
  const ids = ['core.parking_bays', 'core.tactile_paving', 'core.graffiti_brick', 'core.damaged_plaster'];

  it('are painted fine (256 px), opaque, and the same every time', () => {
    for (const id of ids) {
      const def = coreMaterials.get(id)!;
      expect(patternSize(def), id).toBe(256);
      const px = materialPixels(def, 256);
      expect(px.length).toBe(256 * 256 * 4);
      for (let i = 3; i < px.length; i += 4096) expect(px[i]).toBe(255);
      // (A second material object with the same fields paints the same pixels: nothing random.)
      expect(Array.from(materialPixels({ ...def, id: `${id}_again` }, 256))).toEqual(Array.from(px));
    }
  });

  it('parking bays: white lines every half repeat and a head line across, asphalt between', () => {
    const def = coreMaterials.get('core.parking_bays')!;
    const [road, paint] = [hex(def.base), hex(def.accent)];
    // Along a row through the middle of a bay: brighter on the lines at u = 0.5 and at the repeat's edge than between.
    const row = (u: number) => [0.2, 0.3, 0.4, 0.6, 0.7, 0.8].reduce((s, v) => s + luma(at('core.parking_bays', u, v)), 0) / 6;
    expect(row(0.5)).toBeGreaterThan(row(0.25) + 40);
    expect(row(0.002)).toBeGreaterThan(row(0.75) + 40);
    // The head line: across the repeat's edge in v.
    const col = (v: number) => [0.15, 0.25, 0.35, 0.65, 0.75, 0.85].reduce((s, u) => s + luma(at('core.parking_bays', u, v)), 0) / 6;
    expect(col(0.002)).toBeGreaterThan(col(0.5) + 40);
    expect(dist(at('core.parking_bays', 0.25, 0.5), road)).toBeLessThan(dist(at('core.parking_bays', 0.25, 0.5), paint));
  });

  it('tactile paving: 12 studs across a repeat, joints between the 2 x 2 slabs', () => {
    const def = coreMaterials.get('core.tactile_paving')!;
    const joint = hex(def.accent);
    // A stud's crown is brighter than the slab beside it; a joint is the dark accent.
    const crown = luma(at('core.tactile_paving', 1.5 / 12, 1.5 / 12));
    const flat = luma(at('core.tactile_paving', 2 / 12, 2 / 12));
    expect(crown).toBeGreaterThan(flat + 8);
    expect(dist(at('core.tactile_paving', 0.5, 0.3), joint)).toBeLessThan(90);
    expect(dist(at('core.tactile_paving', 0.3, 0.999), joint)).toBeLessThan(90);
  });

  it('graffiti: spray paint across the middle of the storey, bare brick at its foot and its head', () => {
    // Bare brick and mortar are dull reds and greys; the spray colours are strong. Count the strongly coloured pixels by band.
    const strong = (v0: number, v1: number) => {
      let n = 0;
      for (let v = v0; v < v1; v += 1 / 256) for (let u = 0; u < 1; u += 1 / 256) {
        const c = at('core.graffiti_brick', u, v);
        if (c[2]! > c[0]! + 20 || c[1]! > c[0]! + 20 || (chroma(c) > 110 && c[1]! > 120) || luma(c) > 200) n++;
      }
      return n;
    };
    expect(strong(0.2, 0.8)).toBeGreaterThan(2500);
    expect(strong(0, 0.04)).toBe(0);
    expect(strong(0.86, 1)).toBe(0);
    // The cloud's fill is teal to blue, the bolt pink.
    const cloud = at('core.graffiti_brick', 0.3, 0.46);
    expect(cloud[1]! + cloud[2]!).toBeGreaterThan(cloud[0]! * 3);
    const bolt = at('core.graffiti_brick', 0.68, 0.33);
    expect(bolt[0]!).toBeGreaterThan(bolt[1]! * 1.8);
  });

  it('damaged plaster: mostly plaster, brick showing in patches', () => {
    const def = coreMaterials.get('core.damaged_plaster')!;
    const [plaster, brick] = [hex(def.base), hex(def.accent)];
    let bare = 0;
    let coat = 0;
    for (let v = 0; v < 1; v += 1 / 128) for (let u = 0; u < 1; u += 1 / 128) {
      const c = at('core.damaged_plaster', u, v);
      if (dist(c, brick) < dist(c, plaster) && c[0]! > c[2]! + 30) bare++;
      else if (dist(c, plaster) < 60) coat++;
    }
    const all = 128 * 128;
    expect(bare / all).toBeGreaterThan(0.04);
    expect(bare / all).toBeLessThan(0.3);
    expect(coat / all).toBeGreaterThan(0.6);
  });
});
