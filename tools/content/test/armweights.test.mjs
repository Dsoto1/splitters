import { describe, expect, it } from 'vitest';
import { keepArmsToArms } from '../armweights.mjs';

// A T-pose right arm along -x at shoulder height, a body column at x = 0, and cloth hanging from the arm.
const jointNames = ['spine_03', 'upperarm_r', 'lowerarm_r', 'hand_r'];
const world = new Map([
  ['spine_03', { t: [0, 1.3, 0] }],
  ['upperarm_r', { t: [-0.18, 1.4, 0] }],
  ['lowerarm_r', { t: [-0.46, 1.4, 0] }],
  ['hand_r', { t: [-0.72, 1.4, 0] }],
]);

function mesh() {
  const pts = [];
  // The arm: rings of radius 4 cm round its bones, held outright by the upper or lower arm.
  for (let x = -0.18; x >= -0.72; x -= 0.01) for (let a = 0; a < 8; a++) pts.push({ p: [x, 1.4 + 0.04 * Math.cos(a), 0.04 * Math.sin(a)], j: x > -0.46 ? 1 : 2 });
  // The body: a column at x = 0, held by the spine.
  for (let y = 0.8; y <= 1.5; y += 0.01) for (let a = 0; a < 8; a++) pts.push({ p: [0.12 * Math.cos(a), y, 0.12 * Math.sin(a)], j: 0 });
  // A sleeve's hem hanging 35 cm under the forearm, wrongly held by the lower arm; and a wide sleeve 7 cm round it.
  const hem = pts.length;
  for (let x = -0.4; x >= -0.6; x -= 0.02) pts.push({ p: [x, 1.05, 0], j: 2 });
  // ...and one between the two, part eased.
  const mid = pts.length;
  pts.push({ p: [-0.5, 1.4 - 0.135, 0], j: 2 });
  const sleeve = pts.length;
  pts.push({ p: [-0.5, 1.4 - 0.07, 0], j: 2 });
  const pos = new Float32Array(pts.length * 3);
  const J = new Uint16Array(pts.length * 4);
  const W = new Float32Array(pts.length * 4);
  pts.forEach(({ p, j }, i) => {
    pos.set(p, i * 3);
    J[i * 4] = j;
    W[i * 4] = 1;
  });
  return { m: { pos, J, W }, hem, sleeve, mid };
}

describe('armweights', () => {
  it('hands cloth hanging well off an arm to the body, and keeps the arm and a sleeve round it', () => {
    const { m, hem, sleeve, mid } = mesh();
    const changed = keepArmsToArms({ meshes: [m], jointNames, world });
    expect(changed.r).toBeGreaterThan(0);
    // The hem now follows the spine.
    expect(m.J[hem * 4]).toBe(0);
    expect(m.W[hem * 4]).toBeCloseTo(1, 3);
    // The sleeve close round the forearm, and the arm itself, stay on the forearm.
    expect(m.J[sleeve * 4]).toBe(2);
    expect(m.J[0]).toBe(1);
    // Part way out, part eased (both kept, the arm's share less than all).
    const share = [0, 1, 2, 3].filter((k) => m.J[mid * 4 + k] === 2).reduce((a, k) => a + m.W[mid * 4 + k], 0);
    expect(share).toBeGreaterThan(0.05);
    expect(share).toBeLessThan(0.95);
    // Running again changes nothing more.
    const again = Float32Array.from(m.W);
    keepArmsToArms({ meshes: [m], jointNames, world });
    expect(Array.from(m.W)).toEqual(Array.from(again));
  });
});
