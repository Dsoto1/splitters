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
    expect(new Set(models(out, 'reed'))).toEqual(new Set(['env.water.eelgrass', 'env.water.eelgrass#1']));
    for (const [key, byModel] of out) {
      if (!key.startsWith('reed:')) continue;
      for (const m of byModel.values()) for (let i = 0; i < m.length; i += 16) expect(m[i + 12]!).toBeLessThan(0);
    }
    // Plants on dry land are unchanged in kind: grass on the grass.
    expect(kinds(out).has('reed')).toBe(true);
  });

  it('grows our generated grass, flowers, ferns and bushes at every plants level (no Kenney grass, flowers or shrubs)', () => {
    for (const level of [1, 2, 3, 4]) {
      const t = flat();
      t.foliage = new Array(t.materials.length).fill(level);
      const out = place(t, [], `seed${level}`);
      const all = [...out.values()].flatMap((m) => [...m.keys()]);
      expect(all.length, `level ${level}`).toBeGreaterThan(0);
      expect(all.filter((m) => !m.startsWith('env.')), `level ${level}`).toEqual([]);
    }
    const t = flat();
    t.foliage = new Array(t.materials.length).fill(4);
    const out = place(t, [], 'thick');
    expect(new Set(models(out, 'grass').map((m) => m.split('#')[0]))).toEqual(new Set(['env.grass.clump']));
    expect(new Set(models(out, 'flower').map((m) => m.split('#')[0]))).toEqual(new Set(['env.flower.meadow']));
    expect(new Set(models(out, 'shrub').map((m) => m.split('#')[0]))).toEqual(new Set(['env.fern.bracken']));
    expect(new Set(models(out, 'bush').map((m) => m.split('#')[0]))).toEqual(new Set(['env.shrub.broadleaf']));
    // The same terrain and seed grow the same plants (every machine draws the same meadow).
    expect([...place(t, [], 'thick')]).toEqual([...out]);
  });

  it('grows our generated pebbles on stone, gravel and snow (grey) and on sand (sandy), never Kenney stones', () => {
    for (const [material, want] of [['stone', 'env.rock.pebbles'], ['gravel', 'env.rock.pebbles'], ['snow', 'env.rock.pebbles'], ['sand', 'env.rock.pebbles#1']] as const) {
      const t = flat();
      t.materials.fill(TERRAIN_MATERIALS.indexOf(material));
      // Sand grows pebbles at level 2 (shrubs and grass above it).
      t.foliage = new Array(t.materials.length).fill(material === 'sand' ? 2 : 4);
      const out = place(t, [], `pebbles-${material}`);
      expect(new Set(models(out, 'pebbles')), material).toEqual(new Set([want]));
      expect([...out.values()].flatMap((m) => [...m.keys()]).filter((m) => !m.startsWith('env.')), material).toEqual([]);
    }
  });

  it('keeps a cell painted bare bare, even in shallow water', () => {
    const t = flat();
    t.foliage = new Array(t.materials.length).fill(0);
    const shallow = { min: { x: -20, y: -1, z: -20 }, max: { x: 20, y: 0.3, z: 20 } };
    expect(place(t, [], 'seed', [shallow]).size).toBe(0);
  });
});
