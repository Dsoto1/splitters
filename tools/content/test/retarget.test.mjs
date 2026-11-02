import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { footDown, meshyName, plantedSpeed, qAngle, qFromTo, qinv, qmul, qrot, retargetClip, retargetFrame, reposeTurns, stripRootMotion, world } from '../retarget.mjs';
import { CLIP_SET_CLIPS } from '../character-manifests.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const axisAngle = (axis, a) => {
  const l = Math.hypot(...axis);
  return [...axis.map((x) => (x / l) * Math.sin(a / 2)), Math.cos(a / 2)];
};
const I = [0, 0, 0, 1];
const close = (a, b, eps = 1e-6) => a.every((x, i) => Math.abs(x - b[i]) < eps);

/**
 * A little skeleton in the shape both rigs share (hips, spine, one arm and one leg a side): `arm` is where the
 * upper arm points from the shoulder, `leg` where the thigh points; joint frames are turned by `frame` (rigs
 * differ in their joints' own axes) without moving the joints.
 */
function skeleton(names, { arm, leg, frame = I }) {
  const j = (n) => names[n] ?? n;
  const list = [
    [j('Hips'), null, [0, 1, 0]],
    [j('Spine'), j('Hips'), [0, 0.3, 0]],
    [j('LeftArm'), j('Spine'), [0.2, 0.2, 0]],
    [j('LeftForeArm'), j('LeftArm'), arm.map((x) => x * 0.3)],
    [j('LeftHand'), j('LeftForeArm'), arm.map((x) => x * 0.25)],
    [j('LeftUpLeg'), j('Hips'), [0.1, -0.05, 0]],
    [j('LeftLeg'), j('LeftUpLeg'), leg.map((x) => x * 0.45)],
    [j('LeftFoot'), j('LeftLeg'), leg.map((x) => x * 0.42)],
    [j('LeftToeBase'), j('LeftFoot'), [0, -0.05, 0.12]],
    [j('RightUpLeg'), j('Hips'), [-0.1, -0.05, 0]],
    [j('RightLeg'), j('RightUpLeg'), [0, -0.45, 0]],
    [j('RightFoot'), j('RightLeg'), [0, -0.42, 0]],
  ];
  const index = new Map(list.map(([n], i) => [n, i]));
  // Every joint's world frame is `frame`: locally the root carries it and the rest are identity, with offsets
  // expressed in the parent's (turned) frame.
  return {
    names: list.map(([n]) => n),
    parent: list.map(([, p]) => (p ? index.get(p) : -1)),
    rest: list.map(([, p, t]) => ({ t: p ? qrot(qinv(frame), t) : t, q: p ? I : frame, s: 1 })),
  };
}
const RIG_NAMES = { Hips: 'pelvis', Spine: 'spine_03', LeftArm: 'upperarm_l', LeftForeArm: 'lowerarm_l', LeftHand: 'hand_l', LeftUpLeg: 'thigh_l', LeftLeg: 'calf_l', LeftFoot: 'foot_l', LeftToeBase: 'ball_l', RightUpLeg: 'thigh_r', RightLeg: 'calf_r', RightFoot: 'foot_r' };
const MAP = Object.fromEntries(Object.entries(RIG_NAMES).map(([m, r]) => [r, m]));
// The source stands in an A-pose (arm 45 degrees down, legs apart); the rig in a T-pose with its own joint axes.
const SRC = skeleton({}, { arm: [Math.SQRT1_2, -Math.SQRT1_2, 0], leg: [0.12, -1, 0] });
const RIG = skeleton(RIG_NAMES, { arm: [1, 0, 0], leg: [0, -1, 0], frame: axisAngle([1, 0, 0], -Math.PI / 2) });
const byName = (skel, w) => new Map(skel.names.map((n, i) => [n, w[i]]));

describe('meshyName', () => {
  it('reads Mixamo names as Meshy names (the spine counted down from the chest)', () => {
    expect(meshyName('mixamorig:Spine')).toBe('Spine02');
    expect(meshyName('mixamorig:Spine2')).toBe('Spine');
    expect(meshyName('mixamorig:LeftArm')).toBe('LeftArm');
    expect(meshyName('Hips')).toBe('Hips');
  });
});

describe('rest-pose compensation', () => {
  const srcRest = world(SRC, SRC.rest);
  const rigRest = world(RIG, RIG.rest);
  const rigByName = byName(RIG, rigRest);
  const turns = reposeTurns(SRC, srcRest, rigByName);
  const rigParent = new Map(RIG.names.map((n, i) => [n, RIG.parent[i] >= 0 ? RIG.names[RIG.parent[i]] : null]));

  it('turns the A-pose arm and spread leg onto the rig T-pose', () => {
    const arm = qrot(turns.get('LeftArm'), [Math.SQRT1_2, -Math.SQRT1_2, 0]);
    expect(close(arm, [1, 0, 0], 1e-9)).toBe(true);
    const leg = qrot(turns.get('LeftUpLeg'), [0.12, -1, 0].map((x) => x / Math.hypot(0.12, 1)));
    expect(close(leg, [0, -1, 0], 1e-9)).toBe(true);
    // A joint with no rule takes its parent's turn (the spine none at all).
    expect(qAngle(turns.get('Spine'), I)).toBeLessThan(1e-9);
  });

  /** Where a rig joint's bone points (to its child) in a rig pose given by local rotations. */
  const rigBone = (local, joint, child) => {
    const pose = RIG.rest.map((r, i) => (local.has(RIG.names[i]) ? { ...r, q: local.get(RIG.names[i]) } : r));
    const w = world(RIG, pose);
    const [a, b] = [w[RIG.names.indexOf(joint)].t, w[RIG.names.indexOf(child)].t];
    const d = [0, 1, 2].map((k) => b[k] - a[k]);
    return { dir: d.map((x) => x / Math.hypot(...d)), w };
  };

  it('puts the rig in the source\'s own pose: at the source\'s rest, the rig\'s T-pose arm hangs as the A-pose arm did', () => {
    const local = retargetFrame(byName(SRC, srcRest), byName(SRC, srcRest), turns, rigByName, rigParent, MAP);
    expect(close(rigBone(local, 'upperarm_l', 'lowerarm_l').dir, [Math.SQRT1_2, -Math.SQRT1_2, 0], 1e-6)).toBe(true);
    const leg = [0.12, -1, 0].map((x) => x / Math.hypot(0.12, 1));
    expect(close(rigBone(local, 'thigh_l', 'calf_l').dir, leg, 1e-6)).toBe(true);
    // The spine was not re-posed: at its rig rest.
    expect(qAngle(local.get('spine_03'), RIG.rest[RIG.names.indexOf('spine_03')].q)).toBeLessThan(1e-6);
  });

  it('applies a source joint\'s world turn to the rig\'s joint (whatever either rest pose and joint axes)', () => {
    const turn = axisAngle([0.3, 1, 0.2], 0.5);
    const pose = SRC.rest.map((r, i) => (SRC.names[i] === 'LeftArm' ? { ...r, q: qmul(qmul(qinv(srcRest[SRC.parent[i]].q), turn), srcRest[i].q) } : r));
    const now = world(SRC, pose);
    const local = retargetFrame(byName(SRC, now), byName(SRC, srcRest), turns, rigByName, rigParent, MAP);
    const { dir, w } = rigBone(local, 'upperarm_l', 'lowerarm_l');
    // The arm points where the source's does now.
    expect(close(dir, qrot(turn, [Math.SQRT1_2, -Math.SQRT1_2, 0]), 1e-6)).toBe(true);
    // Its frame: the rig's T-pose frame, re-posed onto the source's rest, then turned as the source's was.
    const ia = RIG.names.indexOf('upperarm_l');
    expect(qAngle(w[ia].q, qmul(qmul(turn, qinv(turns.get('LeftArm'))), rigRest[ia].q))).toBeLessThan(1e-6);
    // The forearm keeps its place on the upper arm.
    expect(close(rigBone(local, 'lowerarm_l', 'hand_l').dir, dir, 1e-6)).toBe(true);
  });

  it('qFromTo takes one direction onto another', () => {
    expect(close(qrot(qFromTo([0, 0, 1], [1, 0, 0]), [0, 0, 1]), [1, 0, 0], 1e-9)).toBe(true);
    expect(close(qrot(qFromTo([0, 1, 0], [0, -1, 0]), [0, 1, 0]), [0, -1, 0], 1e-9)).toBe(true);
  });
});

describe('root motion', () => {
  it('strips the travel across the ground and keeps the bob', () => {
    const n = 31;
    const pos = Array.from({ length: n }, (_, i) => [0.02 * Math.sin(i), 0.9 + 0.03 * Math.cos((i / (n - 1)) * 4 * Math.PI), -0.85 * (i / (n - 1))]);
    const out = stripRootMotion(pos);
    expect(close(out[0], pos[0], 1e-12)).toBe(true);
    expect(Math.abs(out[n - 1][2] - out[0][2])).toBeLessThan(1e-12);
    for (let i = 0; i < n; i++) expect(out[i][1]).toBe(pos[i][1]);
    // Midway the travel so far is gone (the sway stays).
    expect(out[15][2]).toBeCloseTo(0, 12);
    expect(out[15][0]).toBeCloseTo(pos[15][0] - (pos[n - 1][0] - pos[0][0]) * 0.5, 12);
  });

  it('measures a clip\'s ground speed and direction from the planted foot, and where the left foot lands', () => {
    // In place: each foot slides back under the body at 1.2 m/s for half the loop (on the ground), then swings forward.
    const n = 61;
    const dt = 1 / 30;
    const T = (n - 1) * dt;
    const foot = (offset) =>
      Array.from({ length: n }, (_, i) => {
        const p = (i / (n - 1) + offset) % 1;
        const stance = p < 0.5;
        const z = stance ? 0.3 - 1.2 * p * T : 0.3 - 1.2 * 0.5 * T + ((p - 0.5) / 0.5) * 1.2 * 0.5 * T;
        return [0.1, stance ? 0.08 : 0.08 + 0.1 * Math.sin(((p - 0.5) / 0.5) * Math.PI), z];
      });
    const left = foot(0.75);
    const r = plantedSpeed([left, foot(0.25)], dt);
    expect(r.speed).toBeCloseTo(1.2, 1);
    expect(r.dir[1]).toBeGreaterThan(0.99);
    // The left foot is set down a quarter of the loop in (its stance starts at p = 0, offset by 0.75).
    expect(footDown(left, r.dir)).toBeCloseTo(0.25, 1);
    // Walking backwards the planted foot slides forward: the direction turns round.
    const back = plantedSpeed([left, foot(0.25)].map((f) => f.map(([x, y, z]) => [x, y, -z])), dt);
    expect(back.dir[1]).toBeLessThan(-0.99);
  });
});

describe('retargetClip', () => {
  it('plays a source clip in place on the rig: hips scaled to its legs, travel stripped', () => {
    // The source walks forward 1 m in a second, bobbing 4 cm, its arm still.
    const times = Array.from({ length: 31 }, (_, i) => i / 30);
    const hips = times.flatMap((t) => [0, 1 + 0.04 * Math.sin(t * 2 * Math.PI), t]);
    const r = retargetClip(SRC, { Hips: { t: [times, hips] } }, times, RIG);
    const pelvis = RIG.names.indexOf('pelvis');
    // The rig's pelvis is its root here (no parent): the track is its world place.
    const rest = RIG.rest[pelvis].t;
    const k = r.legScale;
    expect(k).toBeGreaterThan(0.9);
    expect(k).toBeLessThan(1.1);
    expect(close(r.pelvis[0], rest, 1e-9)).toBe(true);
    expect(r.pelvis[30][2]).toBeCloseTo(rest[2], 9);
    expect(r.pelvis[8][1]).toBeCloseTo(rest[1] + 0.04 * Math.sin((8 / 30) * 2 * Math.PI) * k, 9);
    // Nothing turned: every frame the source's rest pose (the same rotations throughout).
    for (const f of r.frames) for (const [n, q] of f) expect(qAngle(q, r.frames[0].get(n))).toBeLessThan(1e-6);
  });
});

describe('the WWII Infantry clip set', () => {
  const file = join(ROOT, 'packages/client/public/characters/meshy_wwiisoldier_clips.glb');
  it.skipIf(!existsSync(file))('holds the clips its manifest names, on the rig\'s joints, with their measured loops', async () => {
    const doc = await new NodeIO().read(file);
    const manifest = JSON.parse(readFileSync(join(ROOT, 'content/characters/meshy_wwiisoldier.json'), 'utf8'));
    const names = doc.getRoot().listAnimations().map((a) => a.getName());
    expect(names.sort()).toEqual(Object.keys(manifest.clipsFrom).sort());
    for (const n of names) expect(CLIP_SET_CLIPS).toContain(n);
    const top = doc.getRoot().listScenes()[0].listChildren()[0];
    const loops = top.getExtras().clips;
    const rigNodes = new Set((await new NodeIO().read(join(ROOT, 'packages/client/public/characters/rig.glb'))).getRoot().listNodes().map((n) => n.getName()));
    for (const a of doc.getRoot().listAnimations()) {
      for (const ch of a.listChannels()) expect(rigNodes.has(ch.getTargetNode().getName())).toBe(true);
      // Only the hips move; every other joint only turns.
      expect(a.listChannels().filter((c) => c.getTargetPath() === 'translation').map((c) => c.getTargetNode().getName())).toEqual(['pelvis']);
      const l = loops[a.getName()];
      expect(l.speed).toBeGreaterThan(0.1);
      expect(l.seconds).toBeGreaterThan(0.3);
    }
    // Walking forward and back: which way each goes, and the run is the fastest.
    expect(loops.clip_run.dir[1]).toBeGreaterThan(0.95);
    expect(loops.clip_shoot_back.dir[1]).toBeLessThan(-0.95);
    expect(loops.clip_run.speed).toBeGreaterThan(loops.clip_walk.speed);
  });
});
