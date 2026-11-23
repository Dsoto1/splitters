import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { freshWorld, setGripFit } from '../src/game/freshWorld.ts';
import { slideSupport } from '../src/game/characterAnimator.ts';
import type { WeaponHold } from '@tiletrigger/shared';

/**
 * game/freshWorld.ts: a joint's world matrix brought up to date as Babylon's forced compute does it, number for number,
 * working out only the stale part of its chain; and first person's support hand slid along a handguard (slideSupport)
 * to the same place with its hand read once as with it read at every step.
 */

/** A seeded random number in [0, 1). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** A body's chain like a character's: holders, a mirrored glTF root, then joints down to the fingers. */
function chain(scene: Scene, top: TransformNode | null, depth: number): TransformNode[] {
  const nodes: TransformNode[] = [];
  let parent: TransformNode | null = top;
  for (let i = 0; i < depth; i++) {
    const n = new TransformNode(`j${i}`, scene);
    n.parent = parent;
    n.position.set(0.1 * i, 0.2, -0.05 * i);
    n.rotationQuaternion = Quaternion.RotationYawPitchRoll(0.1 * i, 0.2, -0.1);
    if (i === 2) n.scaling.set(-1, 1, 1);
    nodes.push(n);
    parent = n;
  }
  return nodes;
}

/** Turn, move or scale a random joint, each the ways the animator writes them. */
function poke(nodes: TransformNode[], r: () => number): void {
  const n = nodes[Math.floor(r() * nodes.length)]!;
  const k = r();
  if (k < 0.3) Quaternion.RotationAxis(new Vector3(r(), r(), r()).normalize(), r() - 0.5).multiplyToRef(n.rotationQuaternion!, n.rotationQuaternion!);
  else if (k < 0.5) n.rotationQuaternion = Quaternion.RotationYawPitchRoll(r(), r(), r());
  else if (k < 0.7) n.rotationQuaternion!.copyFrom(Quaternion.RotationYawPitchRoll(r(), r(), r()));
  else if (k < 0.9) n.position.copyFrom(new Vector3(r(), r(), r()));
  else n.scaling.setAll(0.5 + r());
}

describe('freshWorld', () => {
  it('gives the forced compute matrix, number for number, through any order of turns and reads', () => {
    const scene = new Scene(new NullEngine());
    const holder = new TransformNode('holder', scene);
    holder.rotationQuaternion = Quaternion.Identity();
    const nodes = chain(scene, holder, 16);
    const r = rng(7);
    let computes = 0;
    for (let step = 0; step < 3000; step++) {
      if (r() < 0.4) poke([holder, ...nodes], r);
      const n = nodes[Math.floor(r() * nodes.length)]!;
      const mine = Array.from(freshWorld(n).asArray());
      const theirs = n.computeWorldMatrix(true).asArray();
      expect(mine).toEqual(Array.from(theirs));
      computes++;
    }
    expect(computes).toBe(3000);
  });

  it('works out only what changed: reading an unchanged joint again computes nothing', () => {
    const scene = new Scene(new NullEngine());
    const nodes = chain(scene, null, 18);
    const finger = nodes[17]!;
    freshWorld(finger);
    let n = 0;
    const proto = TransformNode.prototype as unknown as { computeWorldMatrix: (...a: unknown[]) => unknown };
    const real = proto.computeWorldMatrix;
    proto.computeWorldMatrix = function (this: TransformNode, ...a: unknown[]) {
      n++;
      return real.apply(this, a);
    };
    try {
      for (let i = 0; i < 10; i++) freshWorld(finger);
      expect(n).toBe(0);
      // A turned hand: the hand and the finger below it, not the 15 joints above.
      nodes[15]!.rotationQuaternion!.copyFrom(Quaternion.RotationYawPitchRoll(0.3, 0.1, 0.2));
      freshWorld(finger);
      expect(n).toBeLessThanOrEqual(3);
      // The forced compute works out the whole chain.
      n = 0;
      finger.computeWorldMatrix(true);
      expect(n).toBe(18);
    } finally {
      proto.computeWorldMatrix = real;
    }
  });

  it('a chain under a camera or with a mesh in its stale part takes the forced compute, with the same result', () => {
    const scene = new Scene(new NullEngine());
    const cam = new FreeCamera('eye', new Vector3(1, 2, 3), scene);
    const underCam = chain(scene, null, 6);
    underCam[0]!.parent = cam;
    const mesh = new Mesh('root', scene);
    const underMesh = chain(scene, mesh, 6);
    const r = rng(3);
    for (let step = 0; step < 300; step++) {
      if (r() < 0.5) poke(underCam, r);
      if (r() < 0.5) poke(underMesh, r);
      if (r() < 0.2) mesh.position.x = r();
      if (r() < 0.2) cam.position.y = r();
      for (const n of [underCam[5]!, underMesh[5]!]) {
        const mine = Array.from(freshWorld(n).asArray());
        expect(mine).toEqual(Array.from(n.computeWorldMatrix(true).asArray()));
      }
    }
  });

  it('switched off (?perfoff=gripfit) it is the forced compute', () => {
    const scene = new Scene(new NullEngine());
    const nodes = chain(scene, null, 8);
    setGripFit(false);
    try {
      let n = 0;
      const proto = TransformNode.prototype as unknown as { computeWorldMatrix: (...a: unknown[]) => unknown };
      const real = proto.computeWorldMatrix;
      proto.computeWorldMatrix = function (this: TransformNode, ...a: unknown[]) {
        n++;
        return real.apply(this, a);
      };
      try {
        freshWorld(nodes[7]!);
        freshWorld(nodes[7]!);
      } finally {
        proto.computeWorldMatrix = real;
      }
      expect(n).toBe(16);
    } finally {
      setGripFit(null);
    }
  });
});

describe('slideSupport', () => {
  it('slides the support palm to the same place with the hand read once as at every step', () => {
    const scene = new Scene(new NullEngine());
    const r = rng(11);
    for (let trial = 0; trial < 40; trial++) {
      const [upper, lower, hand, knuckle, index, pinky, thumb] = chain(scene, null, 3).concat(['k', 'i', 'p', 't'].map((name) => new TransformNode(name, scene)));
      lower!.position.set(0, -0.28, 0);
      hand!.position.set(0, -0.26, 0);
      for (const [n, at] of [[knuckle, [0, -0.09, 0.01]], [index, [0.03, -0.08, 0.01]], [pinky, [-0.03, -0.07, 0.01]], [thumb, [0.03, -0.03, 0.03]]] as const) {
        n!.parent = hand!;
        n!.position.set(at[0], at[1], at[2]);
      }
      hand!.rotationQuaternion = Quaternion.RotationYawPitchRoll(r() * 3, r() - 0.5, r() - 0.5);
      const measured = trial % 2 === 0;
      const arm = {
        upper: upper!, lower: lower!, hand: hand!, palm: new Vector3(0, -0.05, 0.01), gripOffset: 0.03 + r() * 0.02, curl: 1, span: 0.18,
        fingers: [], index: index!, pinky: pinky!, knuckle: knuckle!, thumb: thumb!, thumbs: [],
        ...(measured ? { frame: { along: new Vector3(0, -1, 0), palm: new Vector3(0, 0, 1) } } : {}),
      };
      const grip: WeaponHold = { style: 'long', grip: [0, -0.05, 0.05], support: [0, -0.02, 0.35 + r() * 0.2], shoulder: [0, 0, -0.3] } as WeaponHold;
      const origin = new Vector3(r(), 1 + r(), r());
      const point = (p: readonly number[]) => origin.add(new Vector3(p[0]!, p[1]!, p[2]!));
      const shoulder = new Vector3(origin.x - 0.2, origin.y + 0.1, origin.z);
      const reach = 0.15 + r() * 0.4;
      const at = point(grip.support!);
      setGripFit(false);
      const each = slideSupport(arm, grip, grip.support!, at.clone(), shoulder, reach, point, 1);
      setGripFit(true);
      const once = slideSupport(arm, grip, grip.support!, at.clone(), shoulder, reach, point, 1);
      setGripFit(null);
      expect([once.x, once.y, once.z]).toEqual([each.x, each.y, each.z]);
    }
  });
});
