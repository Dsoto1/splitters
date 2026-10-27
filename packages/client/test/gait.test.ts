import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, type Animation, type AnimationSampler, type Node } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { GAIT, GAIT_CLIPS, gaitCycleRate, gaitWeights, matchPhase, type GaitClip } from '../src/game/gait.ts';

const RIG = join(dirname(fileURLToPath(import.meta.url)), '../public/characters/rig.glb');

type V3 = [number, number, number];
type Q = [number, number, number, number];
const qmul = (a: Q, b: Q): Q => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qrot = (q: Q, v: V3): V3 => {
  const p = qmul(qmul(q, [v[0], v[1], v[2], 0]), [-q[0], -q[1], -q[2], q[3]]);
  return [p[0], p[1], p[2]];
};

/** A sampler's value at time t (linear; quaternions normalised-lerped, close enough at 30 fps keys). */
function sample(s: AnimationSampler, t: number): number[] {
  const inp = s.getInput()!.getArray()!;
  const out = s.getOutput()!.getArray()!;
  const n = s.getOutput()!.getElementSize();
  let i = 0;
  while (i < inp.length - 1 && inp[i + 1]! < t) i++;
  const at = (k: number): number[] => Array.from(out.slice(k * n, k * n + n) as ArrayLike<number>);
  if (t <= inp[0]! || i >= inp.length - 1) return at(t <= inp[0]! ? 0 : inp.length - 1);
  const k = (t - inp[i]!) / (inp[i + 1]! - inp[i]!);
  const a = at(i);
  const b = at(i + 1);
  if (n !== 4) return a.map((x, j) => x + (b[j]! - x) * k);
  const sign = a.reduce((d, x, j) => d + x * b[j]!, 0) < 0 ? -1 : 1;
  const r = a.map((x, j) => x * (1 - k) + b[j]! * sign * k);
  const len = Math.hypot(...r);
  return r.map((x) => x / len);
}

/** World position of a joint in the rig (Y up, +Z forward) at time t of a clip. */
function jointAt(anim: Animation, joint: Node, t: number): V3 {
  const chain: Node[] = [];
  for (let n: Node | null = joint; n; n = n.getParentNode()) chain.unshift(n);
  let pos: V3 = [0, 0, 0];
  let rot: Q = [0, 0, 0, 1];
  for (const n of chain) {
    let tr = n.getTranslation() as number[];
    let r = n.getRotation() as number[];
    for (const ch of anim.listChannels()) {
      if (ch.getTargetNode() !== n) continue;
      if (ch.getTargetPath() === 'translation') tr = sample(ch.getSampler()!, t);
      if (ch.getTargetPath() === 'rotation') r = sample(ch.getSampler()!, t);
    }
    const off = qrot(rot, tr as V3);
    pos = [pos[0] + off[0], pos[1] + off[1], pos[2] + off[2]];
    rot = qmul(rot, r as Q);
  }
  return pos;
}

/** Measure a loop: its length, the speed at which the planted foot stays still, and when the left foot lands. */
function measure(anim: Animation, nodes: Map<string, Node>) {
  const seconds = Math.max(...anim.listSamplers().map((s) => s.getInput()!.getMax([])[0]!));
  const dt = 1 / 240;
  const n = Math.round(seconds / dt);
  const [l, r] = (['ball_l', 'ball_r'] as const).map((j) => Array.from({ length: n + 1 }, (_, i) => jointAt(anim, nodes.get(j)!, i * dt)));
  const minY = (tr: V3[]) => Math.min(...tr.map((p) => p[1]));
  const lo = [minY(l!), minY(r!)];
  // The planted foot (the lower one, within 2 cm of the ground) slides back at the body's speed.
  const v: number[] = [];
  for (let i = 1; i <= n; i++) {
    const k = l![i]![1] - lo[0]! < r![i]![1] - lo[1]! ? 0 : 1;
    const tr = k === 0 ? l! : r!;
    if (tr[i]![1] - lo[k]! < 0.02 && tr[i - 1]![1] - lo[k]! < 0.02) v.push(-(tr[i]![2] - tr[i - 1]![2]) / dt);
  }
  v.sort((a, b) => a - b);
  // Left touchdown: the left foot comes down to within 2 cm of its lowest.
  let down = 0;
  for (let i = 1; i <= n; i++) {
    if (l![i]![1] - lo[0]! < 0.02 && l![i - 1]![1] - lo[0]! >= 0.02) {
      down = (i * dt) / seconds;
      break;
    }
  }
  return { seconds, speed: v[Math.floor(v.length / 2)]!, footDown: down };
}

describe('gait', () => {
  it("matches the rig's walk, run and sprint: planted-foot speed and left touchdown", async () => {
    const doc = await new NodeIO().readBinary(new Uint8Array(readFileSync(RIG)));
    const nodes = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
    for (const c of GAIT_CLIPS) {
      const anim = doc.getRoot().listAnimations().find((a) => a.getName() === c);
      expect(anim, c).toBeTruthy();
      const m = measure(anim!, nodes);
      expect(Math.abs(m.speed / GAIT[c].speed - 1), `${c} speed ${m.speed.toFixed(2)}`).toBeLessThan(0.06);
      const off = Math.abs(m.footDown - GAIT[c].footDown);
      expect(Math.min(off, 1 - off), `${c} touchdown ${m.footDown.toFixed(3)}`).toBeLessThan(0.03);
    }
  });

  it('runs at the rate that keeps the planted foot still', () => {
    const seconds: Record<GaitClip, number> = { walk: 1.333, run: 0.933, sprint: 0.667 };
    // Running pace (5.2 m/s) is all run, played a little slower than authored.
    const w = gaitWeights(5.2, 0);
    expect(w).toEqual({ walk: 0, run: 1, sprint: 0 });
    const rate = gaitCycleRate(5.2, w, seconds);
    expect(rate * seconds.run).toBeCloseTo(5.2 / 5.9, 3);
    // Feet move at ground speed whatever the blend: cycles/s × distance per cycle = speed.
    for (const speed of [0.8, 1.5, 2.4, 3.3, 4.5, 7.8]) {
      for (const sprint of [0, 0.5, 1]) {
        const ws = gaitWeights(speed, sprint);
        const total = GAIT_CLIPS.reduce((a, c) => a + ws[c], 0);
        expect(total).toBeCloseTo(1, 6);
        const r = gaitCycleRate(speed, ws, seconds);
        const dist = GAIT_CLIPS.reduce((a, c) => a + ws[c] * GAIT[c].speed * seconds[c], 0);
        expect(r * dist).toBeCloseTo(speed, 6);
      }
    }
    // A bigger body takes longer strides, so its loop plays slower.
    expect(gaitCycleRate(5.2, w, seconds, 1.2)).toBeCloseTo(gaitCycleRate(5.2, w, seconds) / 1.2, 6);
  });

  it('blends walk into run by speed, without steps', () => {
    let prev = gaitWeights(0.6, 0);
    for (let s = 0.6; s <= 8; s += 0.05) {
      const w = gaitWeights(s, 0);
      expect(Math.abs(w.run - prev.run)).toBeLessThan(0.03);
      prev = w;
    }
  });

  it('starts a loop in step with the one already playing', () => {
    // Run at its left touchdown -> walk at its left touchdown.
    expect(matchPhase('run', GAIT.run.footDown, 'walk')).toBeCloseTo(GAIT.walk.footDown, 6);
    expect(matchPhase('walk', 0.5 + GAIT.walk.footDown, 'sprint')).toBeCloseTo(0.5 + GAIT.sprint.footDown, 6);
    expect(matchPhase('sprint', 0.99, 'run')).toBeGreaterThanOrEqual(0);
  });
});
