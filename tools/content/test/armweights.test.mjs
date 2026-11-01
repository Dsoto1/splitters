import { describe, expect, it } from 'vitest';
import { keepArmsToArms } from '../armweights.mjs';

// A T-pose right arm along -x at shoulder height, a body panel at x = -0.1 to 0, a coat side hanging from the arm and
// joined to the body under it, and a sleeve flap hanging from the forearm alone; all wrongly held by the arm.
const jointNames = ['spine_03', 'upperarm_r', 'lowerarm_r', 'hand_r'];
const world = new Map([
  ['spine_03', { t: [0, 1.3, 0] }],
  ['upperarm_r', { t: [-0.18, 1.4, 0] }],
  ['lowerarm_r', { t: [-0.46, 1.4, 0] }],
  ['hand_r', { t: [-0.72, 1.4, 0] }],
]);

/** A grid of vertices from (x0, y0) to (x1, y1) at z, `nx` by `ny`, two triangles a cell; `joint(x, y)` holds each. */
function mesh() {
  const pos = [];
  const joints = [];
  const idx = [];
  const grid = (x0, x1, y0, y1, nx, ny, z, joint) => {
    const base = pos.length / 3;
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx; i++) {
        const x = x0 + ((x1 - x0) * i) / nx;
        const y = y0 + ((y1 - y0) * j) / ny;
        pos.push(x, y, z);
        joints.push([joint(x, y)].flat(2));
      }
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const a = base + j * (nx + 1) + i;
        idx.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1);
      }
    return base;
  };
  const arm = (x) => (x > -0.46 ? 1 : 2);
  // (`joint` gives a joint, or [joint, weight, joint, weight].)
  // The arm's skin (two rows round its bones), the body, the coat side (shares its top row with the arm's lower
  // row and its body edge with the body), and the sleeve flap (shares its top row with the arm's).
  grid(-0.1, -0.72, 1.36, 1.44, 31, 2, 0, arm);
  grid(-0.1, 0, 0.8, 1.5, 5, 35, 0, () => 0);
  // (Cloth the arm holds most of, not outright: what it holds outright is its limb, sleeve included.)
  const coat = grid(-0.1, -0.3, 1.36, 0.96, 10, 20, 0, (x) => (x === -0.1 ? 0 : [1, 0.8, 0, 0.2]));
  const sleeve = grid(-0.5, -0.66, 1.36, 0.96, 8, 20, 0, () => [2, 0.8, 0, 0.2]);
  const n = pos.length / 3;
  const J = new Uint16Array(n * 4);
  const W = new Float32Array(n * 4);
  // Each vertex: a joint, or [joint, weight, joint, weight].
  joints.forEach((j, i) => {
    const pairs = j.length === 1 ? [j[0], 1] : j;
    for (let k = 0; k < pairs.length / 2; k++) {
      J[i * 4 + k] = pairs[k * 2];
      W[i * 4 + k] = pairs[k * 2 + 1];
    }
  });
  const at = (x, y) => {
    let best = -1;
    let bd = Infinity;
    for (let v = 0; v < n; v++) {
      const d = Math.hypot(pos[v * 3] - x, pos[v * 3 + 1] - y);
      if (d < bd) [bd, best] = [d, v];
    }
    return best;
  };
  return { m: { pos: Float32Array.from(pos), J, W, idx: Uint32Array.from(idx) }, coat, sleeve, at };
}
const share = (m, v, joint) => [0, 1, 2, 3].filter((k) => m.J[v * 4 + k] === joint).reduce((a, k) => a + m.W[v * 4 + k], 0);

describe('armweights', () => {
  it('eases cloth off an arm by distance along the surface: a coat side joined to the body goes to it, a sleeve flap stays', () => {
    const { m, at } = mesh();
    const changed = keepArmsToArms({ meshes: [m], jointNames, world });
    expect(changed.r).toBeGreaterThan(0);
    // The coat's hem (past the shoulder region, round which the arm rightly holds the body) follows the spine.
    expect(share(m, at(-0.28, 0.98), 0)).toBeGreaterThan(0.8);
    // The sleeve flap's hem, joined to the body only through the arm, stays mostly on the forearm.
    expect(share(m, at(-0.58, 0.98), 2)).toBeGreaterThan(0.6);
    // The arm itself is untouched.
    expect(share(m, at(-0.3, 1.44), 1)).toBeCloseTo(1, 5);
    // Running again changes nothing more.
    const again = Float32Array.from(m.W);
    keepArmsToArms({ meshes: [m], jointNames, world });
    expect(Array.from(m.W)).toEqual(Array.from(again));
  });
});
