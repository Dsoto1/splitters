import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { Bone } from '@babylonjs/core/Bones/bone';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { setPalmRule, skinHandFrame } from '../src/game/handProbe.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  setPalmRule('joints');
  for (const e of engines.splice(0)) e.dispose();
});

type P = [number, number, number];

/**
 * One hand in a T-pose, in a glTF mesh's own (right-handed) space: the body faces +Z, so the right arm runs out along
 * -X and the left along +X; palm down (-Y), thumb forward (+Z), so the index knuckle is in front of the little
 * finger's. The skin is a flat slab, thinnest up and down. `thumbBase` puts the thumb's first joint above or below
 * the wrist (above: on the back of the hand, where the old rule read the palm from).
 */
function hand(side: 'l' | 'r', o: { thumbBase?: number; curl?: number; narrow?: boolean } = {}) {
  const engine = new NullEngine();
  engines.push(engine);
  const scene = new Scene(engine);
  const x = side === 'r' ? -1 : 1;
  const skeleton = new Skeleton('s', 's', scene);
  const node = new TransformNode(`hand_${side}`, scene);
  const at: Record<string, P> = {
    [`hand_${side}`]: [0.5 * x, 1.4, 0],
    [`index_01_${side}`]: [0.6 * x, 1.4, o.narrow ? 0.005 : 0.03],
    [`middle_01_${side}`]: [0.6 * x, 1.4, 0.01],
    [`ring_01_${side}`]: [0.6 * x, 1.4, -0.01],
    [`pinky_01_${side}`]: [0.6 * x, 1.4, o.narrow ? 0.002 : -0.03],
    [`thumb_01_${side}`]: [0.52 * x, 1.4 + (o.thumbBase ?? 0.012), 0.03],
    [`thumb_02_${side}`]: [0.55 * x, 1.4, 0.06],
    [`thumb_03_${side}`]: [0.58 * x, 1.4, 0.07],
  };
  // Finger chains, bent toward the palm by `curl` metres a joint (0: straight, as re-fitted fingers are).
  for (const f of ['index', 'middle', 'ring', 'pinky']) {
    const k = at[`${f}_01_${side}`]!;
    for (let j = 2; j <= 3; j++) at[`${f}_0${j}_${side}`] = [k[0] + 0.03 * (j - 1) * x, k[1] - (o.curl ?? 0) * (j - 1) * (j - 1), k[2]];
  }
  const names = Object.keys(at);
  for (const name of names) {
    const b = new Bone(name, skeleton, null, Matrix.Translation(...at[name]!));
    if (name === `hand_${side}`) b.linkTransformNode(node);
  }
  // The slab: 6 x 5 x 2 points from the wrist to the fingertips, 8 cm across, 3 cm thick.
  const positions: number[] = [];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) for (const y of [-0.015, 0.015]) positions.push((0.5 + i * 0.035) * x, 1.4 + y, -0.04 + j * 0.02);
  const n = positions.length / 3;
  const mesh = new Mesh('skin', scene);
  const vd = new VertexData();
  vd.positions = positions;
  vd.indices = [0, 1, 2];
  vd.applyToMesh(mesh);
  mesh.setVerticesData(VertexBuffer.MatricesIndicesKind, new Float32Array(n * 4));
  mesh.setVerticesData(VertexBuffer.MatricesWeightsKind, new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)));
  mesh.skeleton = skeleton;
  const joints = new Map<string, TransformNode>(names.map((name) => [name, name === `hand_${side}` ? node : new TransformNode(name, scene)]));
  return { meshes: [mesh], joint: (name: string) => joints.get(name) };
}

describe('skinHandFrame: which side of the hand is the palm', () => {
  for (const side of ['r', 'l'] as const) {
    it(`reads the ${side === 'r' ? 'right' : 'left'} palm from the hand's handedness, not the thumb's first joint`, () => {
      const h = hand(side);
      const f = skinHandFrame(h.meshes, h.joint, side)!;
      expect(f.by).toBe('knuckles');
      // The hand joint's space is the mesh's here (the bind is a translation): palm down, fingers out along the arm.
      expect(f.palm.y).toBeLessThan(-0.95);
      expect(f.along.x * (side === 'r' ? -1 : 1)).toBeGreaterThan(0.95);
      // The old rule read the thumb's first joint, here on the back of the hand: palm up (the flipped hands).
      expect(f.votes.old).toBe(-1);
      setPalmRule('old');
      expect(skinHandFrame(h.meshes, h.joint, side)!.palm.y).toBeGreaterThan(0.95);
    });
  }

  it('falls back to the fingers bending toward the palm where the knuckles are too close to tell', () => {
    // Knuckles squeezed together across the hand, fingers bent down toward the palm.
    const h = hand('r', { curl: 0.006, narrow: true });
    const f = skinHandFrame(h.meshes, h.joint, 'r')!;
    expect(f.by).toBe('curl');
    expect(f.votes.knuckles).toBeNull();
    expect(f.votes.curl).toBeGreaterThan(0.9);
    expect(f.palm.y).toBeLessThan(-0.95);
  });

  it('takes the import measured palm side over the old rule when nothing else speaks', () => {
    const h = hand('r');
    const f = skinHandFrame(h.meshes, h.joint, 'r', [0, -1, 0])!;
    expect(f.votes.measured).toBeGreaterThan(0.95);
    expect(f.votes.knuckles).toBeGreaterThan(0.9);
    expect(new Vector3(0, -1, 0).subtract(f.palm).length()).toBeLessThan(0.1);
  });
});
