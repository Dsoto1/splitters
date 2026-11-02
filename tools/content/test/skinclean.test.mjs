import { describe, expect, it } from 'vitest';
import { capTears, cleanSkin, tearStretched } from '../skinclean.mjs';

// A download standing with its left arm down by its side: source joints in the rig's names (one per rig joint), the
// arm hanging at x = 0.25 from the shoulder (0.2, 1.4) to the hand (0.25, 0.8), the hip at (0.1, 0.9).
const rig = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l', 'thigh_l', 'calf_l'];
const parent = [-1, 0, 1, 2, 3, 4, 5, 6, 0, 8];
const rest = [
  [0, 0.95, 0],
  [0, 1.05, 0],
  [0, 1.2, 0],
  [0, 1.35, 0],
  [0.05, 1.4, 0],
  [0.2, 1.4, 0],
  [0.23, 1.1, 0],
  [0.25, 0.85, 0],
  [0.1, 0.9, 0],
  [0.1, 0.5, 0],
];
const j = (name) => rig.indexOf(name);

/** One vertex each: its place, normal and (joint, share) pairs. */
function verts(list) {
  const P = list.map((v) => v.p);
  const N = list.map((v) => v.n);
  const J = new Uint16Array(list.length * 4);
  const W = new Float32Array(list.length * 4);
  list.forEach((v, i) => v.w.forEach(([name, w], k) => ((J[i * 4 + k] = j(name)), (W[i * 4 + k] = w))));
  return { P, N, J, W, count: list.length };
}
const run = (m, indices = null) =>
  cleanSkin({ rig, parent, rest, restAt: (v) => m.P[v], restNrm: (v) => m.N[v], count: m.count, J: m.J, W: m.W, indices });
const share = (m, v, name) => {
  let s = 0;
  for (let k = 0; k < 4; k++) if (m.J[v * 4 + k] === j(name)) s += m.W[v * 4 + k];
  return s;
};

describe('skin cleanup in the download pose', () => {
  it('takes the hips and thigh off a hand resting on the hip, and keeps its forearm', () => {
    const m = verts([{ p: [0.25, 0.83, 0.02], n: [0, 0, 1], w: [['hand_l', 0.5], ['pelvis', 0.3], ['thigh_l', 0.1], ['lowerarm_l', 0.1]] }]);
    run(m);
    expect(share(m, 0, 'pelvis')).toBe(0);
    expect(share(m, 0, 'thigh_l')).toBe(0);
    expect(share(m, 0, 'hand_l') + share(m, 0, 'lowerarm_l')).toBeCloseTo(1, 5);
  });

  it('keeps the inside of a sleeve (facing the body) on the arm', () => {
    const m = verts([{ p: [0.21, 1.1, 0], n: [-1, 0, 0], w: [['lowerarm_l', 0.55], ['spine_02', 0.45]] }]);
    run(m);
    expect(share(m, 0, 'spine_02')).toBe(0);
    expect(share(m, 0, 'lowerarm_l')).toBeCloseTo(1, 5);
  });

  it('gives the body its side under the arm (facing the arm) when that patch is joined to the body', () => {
    // 0: the body's side, held by the arm, facing it; 1, 2: the torso beside it.
    const m = verts([
      { p: [0.15, 1.15, 0], n: [1, 0, 0], w: [['upperarm_l', 1]] },
      { p: [0.13, 1.15, 0.05], n: [0.5, 0, 1], w: [['spine_02', 1]] },
      { p: [0.13, 1.15, -0.05], n: [0.5, 0, -1], w: [['spine_02', 1]] },
    ]);
    run(m, new Uint32Array([0, 1, 2]));
    expect(share(m, 0, 'upperarm_l')).toBe(0);
    expect(share(m, 0, 'spine_02')).toBeCloseTo(1, 5);
  });

  it('tears a triangle the turn stretched (a fingertip fused to the thigh) and closes the hole on each side', () => {
    // A fan of four triangles round vertex 0; triangle 0-1-2 stretches tenfold when "turned".
    const from = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, -1, 0, 0, 0, -1, 0].map((x) => x * 0.05));
    const to = new Float32Array(from);
    to.set([0.5, 0, 0], 3);
    const indices = new Uint32Array([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1]);
    const torn = tearStretched(indices, from, to, 1, 1.8);
    expect(torn.torn).toBe(2);
    expect(Array.from(torn.indices)).toEqual([0, 2, 3, 0, 3, 4]);
    // Nothing is torn where `spare` says so (an armpit).
    expect(tearStretched(indices, from, to, 1, 1.8, () => true).torn).toBe(0);
    const J = new Uint16Array(5 * 4);
    const W = new Float32Array(5 * 4).map((_, i) => (i % 4 === 0 ? 1 : 0));
    const out = capTears({ before: indices, after: torn.indices, pos: to, nrm: new Float32Array(15), uv: new Float32Array(10), J, W, side: () => 'body' });
    expect(out.capped).toBe(0); // a rim of two edges is too short to close
    expect(out.indices.length).toBe(torn.indices.length);
  });
});
