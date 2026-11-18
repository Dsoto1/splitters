import { describe, expect, it } from 'vitest';
import { leanMoves } from '../relean-built.mjs';

describe('fixes.lean on a built character (relean-built.mjs leanMoves)', () => {
  // A straight chain up the y axis (the body faces +z) with a collarbone off the top of the spine and a leg.
  const at = { pelvis: [0, 1, 0], spine_01: [0, 1.1, 0], spine_02: [0, 1.2, 0], spine_03: [0, 1.3, 0], neck_01: [0, 1.5, 0], Head: [0, 1.6, 0], clavicle_l: [0.05, 1.45, 0], upperarm_l: [0.2, 1.45, 0], thigh_l: [0.1, 0.95, 0] };
  const parent = { spine_01: 'pelvis', spine_02: 'spine_01', spine_03: 'spine_02', neck_01: 'spine_03', Head: 'neck_01', clavicle_l: 'spine_03', upperarm_l: 'clavicle_l', thigh_l: 'pelvis' };
  const names = Object.keys(at);
  const run = (lean) => leanMoves(names, (n) => parent[n] ?? null, (n) => at[n], lean);
  const apply = (m, p) => {
    const [x, y, z, w] = m.q;
    const v = [p[0] - m.at[0], p[1] - m.at[1], p[2] - m.at[2]];
    const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
    const r = [v[0] + w * t[0] + (y * t[2] - z * t[1]), v[1] + w * t[1] + (z * t[0] - x * t[2]), v[2] + w * t[2] + (x * t[1] - y * t[0])];
    return [r[0] + m.to[0], r[1] + m.to[1], r[2] + m.to[2]];
  };

  it('turns the chain back from each named joint up (the download names: Spine01 is spine_02), legs untouched', () => {
    const m = run({ Spine01: 10 });
    expect(m.get('spine_02').to).toEqual(at.spine_02);
    // A point 0.3 m above spine_02 tips back (toward -z) by 10 degrees.
    const p = apply(m.get('spine_03'), [0, 1.5, 0]);
    expect(p[2]).toBeCloseTo(-0.3 * Math.sin(Math.PI / 18), 6);
    expect(p[1]).toBeCloseTo(1.2 + 0.3 * Math.cos(Math.PI / 18), 6);
    expect(m.get('thigh_l').q).toEqual([0, 0, 0, 1]);
    expect(m.get('thigh_l').to).toEqual(at.thigh_l);
  });

  it('the head keeps facing unless `Head` is given, and the arms ride without turning', () => {
    const m = run({ Spine01: 10, Spine: 10 });
    expect(m.get('Head').q.map(Math.abs)).toEqual([0, 0, 0, 1]);
    expect(m.get('upperarm_l').q).toEqual([0, 0, 0, 1]);
    // The arm moves with the chest: its joint is carried back with the collarbone.
    expect(m.get('upperarm_l').to[2]).toBeLessThan(-0.01);
    expect(m.get('Head').to[2]).toBeLessThan(m.get('neck_01').to[2]);
    const h = run({ Spine01: 10, Head: 20 }).get('Head').q;
    expect(2 * Math.asin(-h[0]) * (180 / Math.PI)).toBeCloseTo(20, 6);
  });
});
