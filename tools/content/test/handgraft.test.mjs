import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { describe, expect, it } from 'vitest';
import { graftHands } from '../handgraft.mjs';
import { readManifests } from '../character-manifests.mjs';

// A synthetic right hand on joints at rest with no turn: the hand joint at `at`, its fingers along +y, across +x
// (index side), the palm +z. `len` long, `width` wide; a grid of points, each on the joint `holder(u, v)` names.
const FINGER = ['index', 'middle', 'ring', 'pinky'];
const NAMES = ['lowerarm_r', 'hand_r', ...FINGER.flatMap((f) => [1, 2, 3].map((i) => `${f}_0${i}_r`)), 'thumb_01_r', 'thumb_02_r', 'thumb_03_r'];
function hand({ at, len, width, holder, lod = false }) {
  const world = new Map(NAMES.map((n) => [n, { q: [0, 0, 0, 1], t: at.slice() }]));
  world.get('lowerarm_r').t = [at[0], at[1] - 0.25, at[2]];
  FINGER.forEach((f, k) => [1, 2, 3].forEach((i) => world.set(`${f}_0${i}_r`, { q: [0, 0, 0, 1], t: [at[0] + (0.375 - k * 0.25) * width, at[1] + len * (0.5 + 0.15 * i), at[2]] })));
  const pos = [];
  const J = [];
  const W = [];
  const uv = [];
  const rows = 8;
  const cols = 5;
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const u = r / rows;
      const v = c / cols - 0.5;
      pos.push(at[0] + v * width, at[1] + u * len, at[2]);
      J.push(NAMES.indexOf(holder(u, v)), 0, 0, 0);
      W.push(1, 0, 0, 0);
      uv.push(0.25 + 0.01 * c, 0.5 + 0.01 * r);
    }
  }
  const idx = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = r * (cols + 1) + c;
    idx.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
  }
  const mesh = { pos: Float32Array.from(pos), J: Uint16Array.from(J), W: Float32Array.from(W), uv: Float32Array.from(uv), nrm: Float32Array.from(pos.map((_, i) => (i % 3 === 2 ? 1 : 0))), idx: Uint32Array.from(idx), lod };
  return { jointNames: NAMES, world, meshes: [mesh] };
}
const fingerOf = (u, v) => (u < 0.5 ? 'hand_r' : `${FINGER[Math.min(3, Math.floor((0.5 - v) * 4))]}_0${Math.min(3, 1 + Math.floor((u - 0.5) * 6))}_r`);
const measured = (len, width) => ({ r: { palm: [0, len * 0.25, 0], dir: [0, 1, 0], across: [1, 0, 0], palmSide: [0, 0, 1], length: len, width, thickness: 0.03 } });

describe('new hand geometry (fixes.hands.graft, handgraft.mjs)', () => {
  const donor = hand({ at: [0.5, 1.4, 0], len: 0.18, width: 0.09, holder: fingerOf });
  // The old hand: a slab on the hand joint alone (a hand whose fingers can't curl), larger than the donor's.
  const target = hand({ at: [-0.6, 1.3, 0.05], len: 0.24, width: 0.14, holder: () => 'hand_r' });
  const sizes = new Map([[donor, [0.18, 0.09]], [target, [0.24, 0.14]]]);
  const out = graftHands({ target, donor, sides: ['r'], measure: (x) => measured(...sizes.get(x)), smooth: 0 });
  const m = target.meshes[0];

  it("drops the old hand and adds the donor's, sized to the old one", () => {
    expect(out.sides).toEqual(['r']);
    expect(m.drop.size).toBe(m.idx.length / 3);
    const added = m.added[0];
    expect(added.idx.length).toBe(donor.meshes[0].idx.length);
    const ys = added.pos.map((p) => p[1] - 1.3);
    const xs = added.pos.map((p) => p[0] + 0.6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.24, 5);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.14, 5);
  });

  it("keeps the donor's finger weights, by joint name", () => {
    const added = m.added[0];
    // Every new corner is held by the joint that held its donor vertex (here one joint each).
    const holder = (p) => fingerOf(Math.round(((p[1] - 1.3) / 0.24) * 1e6) / 1e6, Math.min(0.5, Math.max(-0.5, Math.round(((p[0] + 0.6) / 0.14) * 1e6) / 1e6)));
    for (let i = 0; i < added.pos.length; i++) expect(NAMES[added.J[i][0]]).toBe(holder(added.pos[i]));
  });

  it('moves the finger joints onto the new hand', () => {
    expect([...out.moved.keys()].sort()).toEqual(NAMES.filter((n) => /^(index|middle|ring|pinky|thumb)_/.test(n)).sort());
    // The middle finger's base: the donor's, mapped (half the hand's length plus a step, a share across).
    const d = donor.world.get('middle_01_r').t;
    const t = out.moved.get('middle_01_r');
    expect(t[1] - 1.3).toBeCloseTo(((d[1] - 1.4) / 0.18) * 0.24, 5);
    expect(t[0] + 0.6).toBeCloseTo(((d[0] - 0.5) / 0.09) * 0.14, 5);
  });

  it("reads its surface from the old hand's own texture, inside the old triangles", () => {
    const added = m.added[0];
    // The old hand's map runs u 0.25-0.30, v 0.50-0.58: every new corner reads within it.
    for (const [u, v] of added.uv) {
      expect(u).toBeGreaterThanOrEqual(0.25 - 1e-6);
      expect(u).toBeLessThanOrEqual(0.3 + 1e-6);
      expect(v).toBeGreaterThanOrEqual(0.5 - 1e-6);
      expect(v).toBeLessThanOrEqual(0.58 + 1e-6);
    }
    expect(new Set(added.uv.map((x) => x.map((k) => k.toFixed(3)).join())).size).toBeGreaterThan(10);
  });

  it('subdivides the donor hand once for smoother fingers', () => {
    const t2 = hand({ at: [-0.6, 1.3, 0.05], len: 0.24, width: 0.14, holder: () => 'hand_r' });
    sizes.set(t2, [0.24, 0.14]);
    graftHands({ target: t2, donor, sides: ['r'], measure: (x) => measured(...sizes.get(x)), smooth: 1 });
    expect(t2.meshes[0].added[0].idx.length).toBe(4 * donor.meshes[0].idx.length);
  });
});

describe('the looks with new hand geometry', () => {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const grafted = readManifests({ ready: true }).filter((m) => m.fixes?.hands?.graft);
  // Anoobys left the list on 2026-11-25 and Vanguard on 2026-11-26: the owner's new models have hands of their own.
  it('are the three whose low-poly fingers folded into shards', () => {
    expect(grafted.map((m) => m.id).sort()).toEqual(['meshy_alienbiker', 'meshy_beaniealien', 'meshy_zhao']);
  });
  it.each(grafted.map((m) => m.id))('%s: built with them, hands measured as their own fingers', async (id) => {
    for (const file of [`${id}.glb`, `${id}_fparms.glb`]) {
      const doc = await io.read(join(import.meta.dirname, '../../../packages/client/public/characters', file));
      const skin = doc.getRoot().listSkins()[0];
      expect(skin.getExtras()?.graft).toEqual(['l', 'r']);
      for (const s of ['l', 'r']) expect(skin.listJoints().find((j) => j.getName() === `hand_${s}`).getExtras()?.hand?.fingers).toBe('own');
    }
  });
});
