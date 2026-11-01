import { MeshoptSimplifier } from 'meshoptimizer';
import { describe, expect, it } from 'vitest';
import { LOD_SHARE, lowDetailIndices } from '../character-lod.mjs';
import { manifestProblems } from '../character-manifests.mjs';

await MeshoptSimplifier.ready;

/**
 * A UV sphere whose texture layout is cut into `strips` charts (columns of segments): each chart has its own copies
 * of the vertices on its edges, as a Meshy download's seams do, and its own patch of the texture.
 */
function choppedSphere(rings, segs, strips) {
  const [P, UV, I] = [[], [], []];
  const per = segs / strips;
  for (let s = 0; s < strips; s++) {
    const base = P.length / 3;
    for (let i = 0; i <= rings; i++) {
      const a = (i / rings) * Math.PI;
      for (let j = 0; j <= per; j++) {
        const b = ((s * per + j) / segs) * Math.PI * 2;
        P.push(Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b));
        // Each chart's patch sits in its own column of the texture.
        UV.push((s + (0.1 + (0.8 * j) / per)) / strips, i / rings);
      }
    }
    for (let i = 0; i < rings; i++)
      for (let j = 0; j < per; j++) {
        const a = base + i * (per + 1) + j;
        I.push(a, a + 1, a + per + 1, a + 1, a + per + 2, a + per + 1);
      }
  }
  return { P: new Float32Array(P), UV: new Float32Array(UV), I: new Uint32Array(I) };
}

/** The chart (strip) each vertex is in. */
const chartOf = (rings, per) => (v) => Math.floor(v / ((rings + 1) * (per + 1)));

describe('character low-detail copy', () => {
  it('cuts to its share keeping triangles inside their texture charts', () => {
    const { P, UV, I } = choppedSphere(40, 64, 16);
    const { idx, kept, spanning } = lowDetailIndices(I, P, UV, LOD_SHARE);
    expect(kept).toBeLessThanOrEqual((I.length / 3) * LOD_SHARE * 1.15);
    expect(kept).toBeGreaterThan((I.length / 3) * LOD_SHARE * 0.5);
    const chart = chartOf(40, 4);
    let across = 0;
    for (let t = 0; t < idx.length; t += 3) if (chart(idx[t]) !== chart(idx[t + 1]) || chart(idx[t + 1]) !== chart(idx[t + 2])) across++;
    expect(across).toBe(spanning);
    // The old sloppy cut joined charts freely; this one keeps (nearly) every triangle on one patch of the texture.
    expect(across / kept).toBeLessThan(0.02);
    // It only picks among the mesh's own vertices (every attribute carries over).
    expect(Math.max(...idx)).toBeLessThan(P.length / 3);
  });

  it('a bigger share keeps more', () => {
    const { P, UV, I } = choppedSphere(40, 64, 16);
    expect(lowDetailIndices(I, P, UV, 0.5).kept).toBeGreaterThan(lowDetailIndices(I, P, UV, 0.3).kept);
  });
});

describe('manifest fixes for quality', () => {
  const base = {
    id: 'meshy_example',
    kind: 'character',
    use: 'player',
    order: 1,
    name: 'Example',
    look: 'core.example',
    bio: 'An example.',
    group: 'folk',
    body: 'male',
    source: { license: 'owned', author: 'example', date: '2026-11-01', url: null, meshy: { rig: '01a189fb-dbb4-7149-bf61-3776817a0c05' } },
    finish: { metallic: 0, roughness: 0.75 },
    firstPerson: { arms: 'own' },
  };
  it('accepts a low-detail share, a 1024 px normal map, a head share and a hold', () => {
    expect(manifestProblems({ ...base, fixes: { lod: 0.4, normalSize: 1024, headShare: 0.16, hold: { forward: 0.05, down: 0.08 } } })).toEqual([]);
  });
  it('refuses them out of range', () => {
    const problems = manifestProblems({ ...base, fixes: { lod: 0.9, normalSize: 2048, headShare: 0.5, hold: { forward: 0.4, up: 1 } } });
    expect(problems.some((p) => /fixes\.lod/.test(p))).toBe(true);
    expect(problems.some((p) => /fixes\.normalSize/.test(p))).toBe(true);
    expect(problems.some((p) => /fixes\.headShare/.test(p))).toBe(true);
    expect(problems.some((p) => /fixes\.hold/.test(p))).toBe(true);
  });
});
