import { MeshoptSimplifier } from 'meshoptimizer';
import { describe, expect, it } from 'vitest';
import { HANDS_SHARE, HEAD_SHARE, cutKeeping } from '../meshy-mesh.mjs';

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

describe('cutKeeping', () => {
  it('keeps the head and the hands their share of the budget, and the cut near its target', () => {
    const P = [];
    const I = [];
    // A big body and a small head: by error alone the head's share would fall with its size.
    sphere(P, I, 0.9, 0.5, 120, 160);
    sphere(P, I, 1.65, 0.12, 60, 80);
    // ...and a small hand out to the side.
    const handFrom = P.length / 3;
    sphere(P, I, 1.3, 0.05, 40, 60);
    for (let v = handFrom; v < P.length / 3; v++) P[v * 3] += 0.8;
    const pos = new Float32Array(P);
    const target = 2000;
    const isHead = (v) => pos[v * 3 + 1] > 1.5;
    const isHand = (v) => pos[v * 3] > 0.6;
    const cut = cutKeeping(new Uint32Array(I), pos, target, [{ inside: isHead, share: HEAD_SHARE }, { inside: isHand, share: HANDS_SHARE }], { errors: [0.01, 0.03], sloppy: true });
    let head = 0;
    let hand = 0;
    for (let i = 0; i < cut.length; i += 3) {
      if (isHead(cut[i])) head++;
      if (isHand(cut[i])) hand++;
    }
    const tris = cut.length / 3;
    expect(tris).toBeLessThan(target * 1.5);
    expect(head / tris).toBeGreaterThan(HEAD_SHARE * 0.8);
    expect(hand / tris).toBeGreaterThan(HANDS_SHARE * 0.8);
  });
});
