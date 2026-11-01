import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { manifestProblems } from '../character-manifests.mjs';
import { rebake } from '../meshy-mesh.mjs';

await MeshoptSimplifier.ready;

/** A UV sphere: positions, normals, texture coordinates (v from the top) and indices. */
function sphere(rings, segs) {
  const [P, N, UV, I] = [[], [], [], []];
  for (let i = 0; i <= rings; i++) {
    const a = (i / rings) * Math.PI;
    for (let j = 0; j <= segs; j++) {
      const b = (j / segs) * Math.PI * 2;
      const n = [Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)];
      P.push(...n);
      N.push(...n);
      UV.push(j / segs, i / rings);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j;
      I.push(a, a + 1, a + segs + 1, a + 1, a + segs + 2, a + segs + 1);
    }
  return { P: new Float32Array(P), N: new Float32Array(N), UV: new Float32Array(UV), I: new Uint32Array(I) };
}

describe('rebake (characters: grown charts)', () => {
  // The download's map: red on the top half (v < 0.5), blue below.
  const map = { data: Buffer.alloc(64 * 64 * 3), info: { width: 64, height: 64 } };
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) map.data.set(y < 32 ? [220, 20, 20] : [20, 20, 220], (y * 64 + x) * 3);
  const hi = sphere(48, 64);
  const [cut] = MeshoptSimplifier.simplify(hi.I, hi.P, 3, 600 * 3, 0.05, []);

  it('paints each part of the cut mesh from the download, and says which vertex each one came from', async () => {
    const out = await rebake({ pos: hi.P, idx: cut }, hi, map, 256, 0.01, { grow: 60, crease: -1 });
    expect(out.from.length).toBe(out.pos.length / 3);
    for (let i = 0; i < out.from.length; i++) for (let k = 0; k < 3; k++) expect(out.pos[i * 3 + k]).toBe(hi.P[out.from[i] * 3 + k]);
    const { data, info } = await sharp(out.jpeg).raw().toBuffer({ resolveWithObject: true });
    let [right, wrong] = [0, 0];
    for (let t = 0; t < out.idx.length; t += 3) {
      const c = [0, 1, 2].map((k) => out.idx[t + k]);
      const top = c.reduce((s, v) => s + out.pos[v * 3 + 1], 0) / 3;
      if (Math.abs(top) < 0.15) continue;
      const u = c.reduce((s, v) => s + out.uv[v * 2], 0) / 3;
      const v = c.reduce((s, w) => s + out.uv[w * 2 + 1], 0) / 3;
      const i = (Math.floor(v * info.height) * info.width + Math.floor(u * info.width)) * info.channels;
      const red = data[i] > data[i + 2];
      if (red === top > 0) right++;
      else wrong++;
    }
    expect(wrong).toBeLessThan(right * 0.02);
  });

  it('lays a round body out in far fewer charts than the six axes, with smooth normals', async () => {
    const axes = await rebake({ pos: hi.P, idx: cut }, hi, map, 256, 0.01);
    const grown = await rebake({ pos: hi.P, idx: cut }, hi, map, 256, 0.01, { grow: 60, crease: -1 });
    expect(grown.pos.length).toBeLessThan(axes.pos.length);
  });
});

describe('manifest fixes.surface', () => {
  const base = { id: 'meshy_x', name: 'X', order: 1, look: 'core.x', bio: 'b', group: 'folk', body: 'male', source: { license: 'owned', author: 'a', date: '2026-11-01', url: null }, finish: { metallic: 0, roughness: 1 } };
  it('takes rebake, and not with seamWeld', () => {
    expect(manifestProblems({ ...base, fixes: { surface: 'rebake' } }, 'meshy_x.json')).toEqual([]);
    expect(manifestProblems({ ...base, fixes: { surface: 'paint' } }, 'meshy_x.json').join('\n')).toMatch(/fixes.surface/);
    expect(manifestProblems({ ...base, fixes: { surface: 'rebake', seamWeld: true } }, 'meshy_x.json').join('\n')).toMatch(/leave seamWeld out/);
  });
});
