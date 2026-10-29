import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { FINGERS, fitHands, rigHand } from '../hands.mjs';

// The real rig: its joints at rest, world space.
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => a.map((x) => x * k);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qrot = (q, v) => {
  const t = scale(cross(q, v), 2);
  return add(add(v, scale(t, q[3])), cross(q, t));
};
const doc = await new NodeIO().read(join(import.meta.dirname, '../../../packages/client/public/characters/rig.glb'));
const cache = new Map();
const wr = (n) => {
  if (cache.has(n)) return cache.get(n);
  const p = n.getParentNode();
  const pw = p ? wr(p) : { q: [0, 0, 0, 1], t: [0, 0, 0] };
  const r = { q: qmul(pw.q, n.getRotation()), t: add(pw.t, qrot(pw.q, n.getTranslation())) };
  cache.set(n, r);
  return r;
};
const joints = doc.getRoot().listSkins()[0].listJoints();
const jointNames = joints.map((j) => j.getName());
const rig = new Map(joints.map((j) => [j.getName(), wr(j)]));
const ref = rigHand(rig, 'r');
const H = rig.get('hand_r');
const J = (n) => jointNames.indexOf(n);

/** A right hand made of points in the hand's frame (u along the fingers, v across, t through the palm), as a mesh in world space, all on hand_r. */
function handMesh(shape) {
  const pts = [];
  for (const [u0, u1, v0, v1, t0, t1] of shape) {
    for (let u = u0; u <= u1 + 1e-9; u += 0.006) for (let v = v0; v <= v1 + 1e-9; v += 0.002) for (const t of [t0, t1]) pts.push([u, v, t]);
  }
  const pos = new Float32Array(pts.length * 3);
  pts.forEach(([u, v, t], i) => pos.set(add(H.t, qrot(H.q, add(add(scale(ref.along, u), scale(ref.across, v)), scale(ref.palmSide, t)))), i * 3));
  const n = pts.length;
  const Ja = new Uint16Array(n * 4).fill(0);
  const Wa = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    Ja[i * 4] = J('hand_r');
    Wa[i * 4] = 1;
  }
  return { pos, J: Ja, W: Wa, pts };
}
const palm = [0.0, 0.11, -0.04, 0.04, -0.012, 0.012];
const fingers = [0.025, 0.012, -0.012, -0.025].map((v) => [0.11, 0.2, v - 0.005, v + 0.005, -0.008, 0.008]);

const fit = (mesh, overrides) => fitHands({ meshes: [mesh], jointNames, world: new Map(rig), rig, overrides });
const heldBy = (mesh, i) => [0, 1, 2, 3].filter((k) => mesh.W[i * 4 + k] > 0.01).map((k) => jointNames[mesh.J[i * 4 + k]]);

describe('hands', () => {
  it('splits a hand with gaps between its fingers into four, each weighted along its own chain', () => {
    const mesh = handMesh([palm, ...fingers]);
    const { moved, data } = fit(mesh);
    expect(data.r.fingers).toBe('split');
    expect(data.r.curl).toBeGreaterThan(0.9);
    expect(data.r.length).toBeCloseTo(0.2, 1);
    expect(data.r.thickness).toBeCloseTo(0.024, 2);
    // A fingertip of each finger follows that finger's last joint; the palm stays on the hand.
    FINGERS.forEach((f, k) => {
      const tip = mesh.pts.findIndex(([u, v]) => u > 0.195 && Math.abs(v - [0.025, 0.012, -0.012, -0.025][k]) < 0.003);
      expect(heldBy(mesh, tip), f).toEqual([`${f}_03_r`]);
    });
    const inPalm = mesh.pts.findIndex(([u, v]) => Math.abs(u - 0.04) < 0.004 && Math.abs(v) < 0.003);
    expect(heldBy(mesh, inPalm)).toEqual(['hand_r']);
    // The knuckles moved onto the hand's knuckle line, and the weights still sum to one.
    expect(moved.has('index_01_r') && moved.has('thumb_02_r')).toBe(true);
    for (let i = 0; i < mesh.pts.length; i++) expect(mesh.W[i * 4] + mesh.W[i * 4 + 1] + mesh.W[i * 4 + 2] + mesh.W[i * 4 + 3]).toBeCloseTo(1, 5);
  });

  it('bends a mitten once at the knuckle line', () => {
    const mesh = handMesh([palm, [0.11, 0.2, -0.03, 0.03, -0.008, 0.008]]);
    const { data } = fit(mesh);
    expect(data.r.fingers).toBe('mitten');
    const tip = mesh.pts.findIndex(([u]) => u > 0.195);
    expect(heldBy(mesh, tip)).toEqual(['middle_01_r']);
  });

  it('leaves a fist rigid', () => {
    const mesh = handMesh([[0.0, 0.12, -0.04, 0.04, -0.04, 0.04]]);
    const { data } = fit(mesh);
    expect(data.r.fingers).toBe('none');
    expect(data.r.curl).toBe(0);
    for (let i = 0; i < mesh.pts.length; i++) expect(heldBy(mesh, i)).toEqual(['hand_r']);
  });

  it('gives the same weights when run again, and takes overrides', () => {
    const mesh = handMesh([palm, ...fingers]);
    fit(mesh);
    const once = Float32Array.from(mesh.W);
    fit(mesh);
    expect(Array.from(mesh.W).every((w, i) => Math.abs(w - once[i]) < 1e-6)).toBe(true);
    const { data } = fit(handMesh([palm, ...fingers]), { palm: [0.01, 0.05, 0], r: { curl: 0.5 } });
    expect(data.r.palm).toEqual([0.01, 0.05, 0]);
    expect(data.r.curl).toBe(0.5);
  });
});
