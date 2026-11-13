import { describe, expect, it } from 'vitest';
import { TERRAIN_MATERIALS, buildMapDecor, buildMapGeometry, mapGroundBores, terrainCuts, withGroundAsPlayed, type TerrainData } from '@tiletrigger/shared';
import { makeMap } from '../../shared/test/helpers.ts';
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
  it('never grow under or through placed tiles (Temple Terraces and ground tiles on grass)', () => {
    const t = flat();
    t.foliage = new Array(t.materials.length).fill(4);
    const tile = (id: string, x: number, y: number, kind: string) => ({ id, tile: kind, x, y, z: 0, rotation: 0 as const });
    const map = { ...makeMap([tile('a', 0, 0, 'jungle.terrace'), tile('b', 1, 0, 'jungle.terrace'), tile('c', 0, 1, 'jungle.terrace'), tile('d', -1, -1, 'core.yard')]), terrain: t };
    const out = place(t, [...buildMapGeometry(map), ...buildMapDecor(map)], 'tiles');
    let n = 0;
    for (const byModel of out.values()) {
      for (const m of byModel.values()) {
        for (let i = 0; i < m.length; i += 16) {
          n++;
          const [x, z] = [m[i + 12]!, m[i + 14]!];
          const inCell = (cx: number, cz: number) => x > cx * 8 - 4 && x < cx * 8 + 4 && z > cz * 8 - 4 && z < cz * 8 + 4;
          expect(inCell(0, 0) || inCell(1, 0) || inCell(0, 1) || inCell(-1, -1), `a plant at ${x.toFixed(2)}, ${z.toFixed(2)}`).toBe(false);
        }
      }
    }
    // Round them the meadow still grows.
    expect(n).toBeGreaterThan(50);
  });

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

  it('never grow where a buried tunnel cut the ground away: a portal\'s apron and passage stay clear, its banks and the hill over the tunnel grow', () => {
    // A 6 m rise with a portal coming out of it (mouth south), a buried tunnel behind it, overgrown everywhere.
    const t = flat();
    t.foliage = new Array(t.materials.length).fill(4);
    for (let r = 0; r < t.rows; r++) for (let c = 0; c < t.cols; c++) t.heights[r * t.cols + c] = Math.round(Math.max(0, Math.min(6, (t.origin[1] + r * t.spacing + 10) * 0.6)) * 100);
    const tile = (id: string, y: number, kind: string) => ({ id, tile: kind, x: 0, y, z: 0, rotation: 0 as const });
    const made = { ...makeMap([tile('p', 0, 'core.tunnel_concrete_portal'), tile('s', 1, 'core.tunnel_concrete_straight')]), terrain: t };
    const map = withGroundAsPlayed(made);
    const cuts = mapGroundBores(map).cuts;
    expect(terrainCuts(map.terrain!)).toBe(cuts);
    const out = place(map.terrain!, [...buildMapGeometry(map), ...buildMapDecor(map)], 'tunnel');
    let n = 0;
    let onBanks = 0;
    for (const byModel of out.values()) {
      for (const m of byModel.values()) {
        for (let i = 0; i < m.length; i += 16) {
          n++;
          const [x, y, z] = [m[i + 12]!, m[i + 13]!, m[i + 14]!];
          // Nothing over the apron (the portal's cell south of its headwall), at any height.
          expect(Math.abs(x) < 4 && z > -4 && z < -0.5, `a plant on the apron at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`).toBe(false);
          // Nothing inside either cell below the caps.
          expect(Math.abs(x) < 4 && z > -4 && z < 12 && y < 3.7, `a plant in the tunnel at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`).toBe(false);
          if (Math.abs(x) > 4.3 && Math.abs(x) < 8 && z > -4 && z < 12) onBanks++;
        }
      }
    }
    expect(n).toBeGreaterThan(100);
    expect(onBanks).toBeGreaterThan(10);
    // Without the cuts remembered (a terrain that never went through the ground as played) plants would stand on the apron.
    const raw = place({ ...map.terrain! }, [...buildMapGeometry(map), ...buildMapDecor(map)], 'tunnel');
    let onApron = 0;
    for (const byModel of raw.values()) for (const m of byModel.values()) for (let i = 0; i < m.length; i += 16) if (Math.abs(m[i + 12]!) < 3.3 && m[i + 14]! > -3.8 && m[i + 14]! < -0.7) onApron++;
    expect(onApron).toBeGreaterThan(0);
  });
});
