import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { fitHands, rigHand } from '../hands.mjs';
import { bindRigid, bodySkin, fingerSkin, fixBodySkin } from '../skinfix.mjs';

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

const fit = (mesh, overrides, skin) => fitHands({ meshes: [mesh], jointNames, world: new Map(rig), rig, overrides, skin });
const heldBy = (mesh, i) => [0, 1, 2, 3].filter((k) => mesh.W[i * 4 + k] > 0.01).map((k) => jointNames[mesh.J[i * 4 + k]]);

const fingerOf = (mesh, i) => [...new Set(heldBy(mesh, i).filter((n) => /^(index|middle|ring|pinky)_/.test(n)).map((n) => n.split('_')[0]))];
const at = (mesh, f) => mesh.pts.findIndex(f);

describe('a look\'s own skin weights (fixes.skin)', () => {
  it('weights every hand as before without it', () => {
    const a = handMesh([palm, ...fingers]);
    const b = handMesh([palm, ...fingers]);
    fit(a);
    fit(b, {}, fingerSkin(undefined));
    expect(Array.from(b.W)).toEqual(Array.from(a.W));
    expect(Array.from(b.J)).toEqual(Array.from(a.J));
  });

  it('`tips`: a long fingertip measured out as a stray curls with its finger instead of staying on the hand', () => {
    // The middle finger runs on past the others, thin: its tip is past the stray cut-off from the hand's centre.
    const long = [0.2, 0.3, 0.007, 0.013, -0.004, 0.004];
    const plain = handMesh([palm, ...fingers, long]);
    fit(plain);
    const tip = at(plain, ([u]) => u > 0.28);
    expect(heldBy(plain, tip)).toEqual(['hand_r']);
    const fixed = handMesh([palm, ...fingers, long]);
    fit(fixed, {}, fingerSkin({ tips: 0.6 }));
    expect(heldBy(fixed, tip).some((n) => /_03_r$/.test(n))).toBe(true);
    // A strip far past the fingers still keeps its weights.
    const strap = handMesh([palm, ...fingers, [0.36, 0.48, -0.003, 0.003, -0.003, 0.003]]);
    fit(strap, {}, fingerSkin({ tips: 0.3 }));
    expect(heldBy(strap, at(strap, ([u]) => u > 0.45))).toEqual(['hand_r']);
  });

  it('`lanes`: skin on the boundary between two split fingers is shared by both', () => {
    const hard = handMesh([palm, ...fingers]);
    expect(fit(hard).data.r.fingers).toBe('split');
    const soft = handMesh([palm, ...fingers]);
    fit(soft, {}, fingerSkin({ lanes: 1 }));
    const shared = (mesh) => mesh.pts.filter(([u], i) => u > 0.13 && fingerOf(mesh, i).length > 1).length;
    expect(shared(hard)).toBe(0);
    expect(shared(soft)).toBeGreaterThan(0);
  });

  it('`fingers: lanes`: a mitten is split evenly into four fingers', () => {
    const slab = [0.11, 0.2, -0.03, 0.03, -0.008, 0.008];
    const mitten = handMesh([palm, slab]);
    expect(fit(mitten).data.r.fingers).toBe('mitten');
    const four = handMesh([palm, slab]);
    expect(fit(four, {}, fingerSkin({ fingers: 'lanes' })).data.r.fingers).toBe('split');
    const used = new Set(four.pts.flatMap((_, i) => fingerOf(four, i)));
    expect([...used].sort()).toEqual(['index', 'middle', 'pinky', 'ring']);
  });

  it('`joints`: a wider blend at each finger joint (more vertices share two joints of a finger)', () => {
    const count = (skin) => {
      const m = handMesh([palm, ...fingers]);
      fit(m, {}, fingerSkin(skin));
      return m.pts.filter((_, i) => heldBy(m, i).filter((n) => /^middle_0[123]_r$/.test(n)).length > 1).length;
    };
    expect(count({ joints: 0.25 })).toBeGreaterThan(count({}));
  });

  it('`hops` drops a far joint\'s share, `smooth` evens neighbours, and hands are left alone', () => {
    const name = (n) => jointNames.indexOf(n);
    const parentOf = new Map(joints.map((j) => [j.getName(), j.getParentNode()?.getName()]));
    // A strip of four vertices: thigh, thigh with a collarbone share (a belly vertex near the arm), then a sudden
    // switch to the other thigh; and one hand vertex with a far share.
    const pos = new Float32Array([0, 0, 0, 0.01, 0, 0, 0.02, 0, 0, 0.03, 0, 0, 0.5, 0.5, 0]);
    const Jv = new Uint16Array([name('thigh_r'), 0, 0, 0, name('thigh_r'), name('clavicle_r'), 0, 0, name('thigh_l'), 0, 0, 0, name('thigh_l'), 0, 0, 0, name('hand_r'), name('thigh_l'), 0, 0]);
    const Wv = new Float32Array([1, 0, 0, 0, 0.7, 0.3, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0.9, 0.1, 0, 0]);
    const m = { pos, J: Jv, W: Wv, idx: new Uint32Array([0, 1, 2, 1, 2, 3]) };
    const fix = bodySkin({ hops: 2, smooth: { joints: '^thigh_', passes: 1 }, tips: 0.2 });
    expect(fix).toEqual({ hops: 2, smooth: { joints: '^thigh_', passes: 1 } });
    fixBodySkin({ meshes: [m], jointNames, parentOf, fix });
    const of = (v) => Object.fromEntries([0, 1, 2, 3].filter((k) => m.W[v * 4 + k] > 1e-4).map((k) => [jointNames[m.J[v * 4 + k]], m.W[v * 4 + k]]));
    expect(of(1).clavicle_r).toBeUndefined();
    // After smoothing, the vertices either side of the switch share both thighs.
    expect(of(1).thigh_l).toBeGreaterThan(0);
    expect(of(2).thigh_r).toBeGreaterThan(0);
    // The hand vertex is fitHands' business.
    expect(of(4)).toEqual({ hand_r: expect.closeTo(0.9, 5), thigh_l: expect.closeTo(0.1, 5) });
    expect(bodySkin({ tips: 0.2 })).toBeNull();
  });

  it('`rigid`: a hard part held whole by one joint in the download\'s pose; the skin round it eased; a part of the excepted joint left', () => {
    // Source joints (a download's) and the rig joint each goes to.
    const rigOf = ['pelvis', 'spine_02', 'spine_03', 'neck_01', 'Head'];
    // A download 1 m tall (the first two points); a pack's box behind the back at half height, eased over 0.05.
    const pts = [
      [0, 0, 0],
      [0, 1, 0],
      [0, 0.5, -0.15], // in the pack
      [0.15, 0.45, -0.12], // in the pack's second box
      [0, 0.5, -0.07], // 0.03 in front of the box: eased
      [0, 0.5, 0.1], // the chest's front: left alone
      [0, 0.55, -0.15], // in the box, but the helmet's (held most by the head): left alone
    ];
    const n = pts.length;
    const Jv = new Uint16Array(n * 4);
    const Wv = new Float32Array(n * 4);
    for (let v = 0; v < n; v++) {
      Jv.set([1, 3, 0, 0], v * 4); // half spine_02, half neck_01: pulled two ways
      Wv.set([0.5, 0.5, 0, 0], v * 4);
    }
    Jv.set([4, 3, 0, 0], 6 * 4);
    Wv.set([0.75, 0.25, 0, 0], 6 * 4);
    const report = bindRigid({ count: n, at: (v) => pts[v], J: Jv, W: Wv, rigOf, regions: [{ joint: 'spine_03', box: [[-0.2, 0.4, -0.2, 0.2, 0.6, -0.1], [0.1, 0.4, -0.2, 0.3, 0.5, -0.1]], blend: 0.05, except: '^Head$' }] });
    expect(report).toEqual([{ joint: 'spine_03', bound: 2, eased: 1 }]);
    const of = (v) => Object.fromEntries([0, 1, 2, 3].filter((k) => Wv[v * 4 + k] > 1e-6).map((k) => [rigOf[Jv[v * 4 + k]], Wv[v * 4 + k]]));
    expect(of(2)).toEqual({ spine_03: 1 });
    expect(of(3)).toEqual({ spine_03: 1 });
    const eased = of(4);
    // 0.6 of the way out: smoothstep 0.648, so 0.352 on the chest and the rest shared as before.
    expect(eased.spine_03).toBeCloseTo(0.352, 3);
    expect(eased.spine_02).toBeCloseTo(0.324, 3);
    expect(eased.neck_01).toBeCloseTo(0.324, 3);
    expect(of(5)).toEqual({ spine_02: 0.5, neck_01: 0.5 });
    expect(of(6)).toEqual({ Head: 0.75, neck_01: 0.25 });
    // A joint the download lacks says so; the body and finger parts of fixes.skin leave `rigid` to the build.
    expect(() => bindRigid({ count: 1, at: () => [0, 0, 0], J: new Uint16Array(4), W: new Float32Array([1, 0, 0, 0]), rigOf, regions: [{ joint: 'thigh_l', box: [0, 0, 0, 1, 1, 1] }] })).toThrow(/no joint for thigh_l/);
    expect(bodySkin({ rigid: [{ joint: 'spine_03', box: [0, 0, 0, 1, 1, 1] }] })).toBeNull();
    expect(fingerSkin({ rigid: [{ joint: 'spine_03', box: [0, 0, 0, 1, 1, 1] }] })).toEqual({});
  });
});
