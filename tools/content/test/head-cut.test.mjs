import { MeshoptSimplifier } from 'meshoptimizer';
import { describe, expect, it } from 'vitest';
import { HEAD_SHARE, cutKeepingHead } from '../meshy-mesh.mjs';

await MeshoptSimplifier.ready;

/** A dense UV sphere (radius r at height y) appended to positions and indices. */
function sphere(P, I, y, r, rings, segs) {
  const base = P.length / 3;
  for (let i = 0; i <= rings; i++) {
    const a = (i / rings) * Math.PI;
    for (let j = 0; j < segs; j++) {
      const b = (j / segs) * Math.PI * 2;
      P.push(r * Math.sin(a) * Math.cos(b), y + r * Math.cos(a), r * Math.sin(a) * Math.sin(b));
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segs; j++) {
      const a = base + i * segs + j;
      const b = base + i * segs + ((j + 1) % segs);
      I.push(a, a + segs, b, b, a + segs, b + segs);
    }
}

describe('cutKeepingHead', () => {
  it('keeps the head its share of the budget, and the cut near its target', () => {
    const P = [];
    const I = [];
    // A big body and a small head: by error alone the head's share would fall with its size.
    sphere(P, I, 0.9, 0.5, 120, 160);
    sphere(P, I, 1.65, 0.12, 60, 80);
    const pos = new Float32Array(P);
    const target = 2000;
    const cut = cutKeepingHead(new Uint32Array(I), pos, target, (v) => pos[v * 3 + 1] > 1.5, { errors: [0.01, 0.03], sloppy: true });
    let head = 0;
    for (let i = 0; i < cut.length; i += 3) if (pos[cut[i] * 3 + 1] > 1.5) head++;
    const tris = cut.length / 3;
    expect(tris).toBeLessThan(target * 1.5);
    expect(head / tris).toBeGreaterThan(HEAD_SHARE * 0.8);
  });
});
