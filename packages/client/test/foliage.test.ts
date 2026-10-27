import { describe, expect, it } from 'vitest';
import { TERRAIN_MATERIALS, type TerrainData } from '@tiletrigger/shared';
import { place } from '../src/foliage.ts';

/** A flat 40 m square of grass at y = 0. */
function flat(): TerrainData {
  const cols = 21;
  return {
    origin: [-20, -20],
    spacing: 2,
    cols,
    rows: cols,
    baseY: 0,
    heights: new Array(cols * cols).fill(0),
    materials: new Array((cols - 1) * (cols - 1)).fill(TERRAIN_MATERIALS.indexOf('grass')),
    boundary: false,
    foliage: [],
  };
}

const kinds = (out: Map<string, Map<string, number[]>>) => new Set([...out.keys()].map((k) => k.split(':')[0]));
const models = (out: Map<string, Map<string, number[]>>, kind: string) => [...out].filter(([k]) => k.startsWith(`${kind}:`)).flatMap(([, m]) => [...m.keys()]);

describe('terrain plants', () => {
  it('grow eelgrass in shallow water only', () => {
    const t = flat();
    expect(kinds(place(t, [], 'seed')).has('reed')).toBe(false);
    // Shallow over the west half (0.3 m), too deep over the east half (2 m).
    const shallow = { min: { x: -20, y: -1, z: -20 }, max: { x: 0, y: 0.3, z: 20 } };
    const deep = { min: { x: 0, y: -1, z: -20 }, max: { x: 20, y: 2, z: 20 } };
    const out = place(t, [], 'seed', [shallow, deep]);
    expect(new Set(models(out, 'reed'))).toEqual(new Set(['prop.mn_eelgrass']));
    for (const [key, byModel] of out) {
      if (!key.startsWith('reed:')) continue;
      for (const m of byModel.values()) for (let i = 0; i < m.length; i += 16) expect(m[i + 12]!).toBeLessThan(0);
    }
    // Plants on dry land are unchanged in kind: grass on the grass.
    expect(kinds(out).has('reed')).toBe(true);
  });

  it('keeps a cell painted bare bare, even in shallow water', () => {
    const t = flat();
    t.foliage = new Array(t.materials.length).fill(0);
    const shallow = { min: { x: -20, y: -1, z: -20 }, max: { x: 20, y: 0.3, z: 20 } };
    expect(place(t, [], 'seed', [shallow]).size).toBe(0);
  });
});
