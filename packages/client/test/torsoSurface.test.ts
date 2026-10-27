import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TorsoSurface, reachAlong } from '../src/game/torsoSurface.ts';
import type { CharacterInstance } from '../src/content/characters.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

/** A body facing +Z: a chest joint at 1.4 m, the right shoulder beside it, and a chest plate `depth` deep hung on the chest. */
function body(depth: number) {
  const engine = new NullEngine();
  engines.push(engine);
  const scene = new Scene(engine);
  const root = new TransformNode('root', scene);
  const chest = new TransformNode('spine_03', scene);
  chest.parent = root;
  chest.position.set(0, 1.4, 0);
  const shoulder = new TransformNode('upperarm_r', scene);
  shoulder.parent = chest;
  shoulder.position.set(0.18, 0.08, -0.05);
  const plate = CreateBox('plate', { width: 0.4, height: 0.4, depth }, scene);
  plate.parent = chest;
  const ch = { root, joints: new Map([['spine_03', chest], ['upperarm_r', shoulder]]), clips: new Map(), meshes: [plate], body: 'male', dispose: () => {} } as unknown as CharacterInstance;
  return { ch, chest };
}

describe('TorsoSurface', () => {
  it('moves a stock that starts inside the chest out to its front, and leaves one in front alone', () => {
    const { ch } = body(0.3);
    const torso = TorsoSurface.measure(ch)!;
    expect(torso).not.toBeNull();
    const forward = new Vector3(0, 0, 1);
    // A butt at the chest joint must come out to the plate's front face (0.15 ahead) plus the margin.
    expect(torso.clearance(new Vector3(0.1, 1.45, 0), forward, 0.04, 0.01)).toBeCloseTo(0.16, 2);
    expect(torso.clearance(new Vector3(0.1, 1.45, 0.3), forward, 0.04, 0.01)).toBe(0);
  });

  it('a deeper chest pushes the stock further', () => {
    const butt = new Vector3(0.1, 1.45, 0);
    const slim = TorsoSurface.measure(body(0.2).ch)!.clearance(butt, new Vector3(0, 0, 1), 0.04, 0);
    const bulky = TorsoSurface.measure(body(0.4).ch)!.clearance(butt, new Vector3(0, 0, 1), 0.04, 0);
    expect(bulky - slim).toBeCloseTo(0.1, 2);
  });

  it('sees a deep chest standing far ahead of the shoulder', () => {
    const butt = new Vector3(0.1, 1.45, 0);
    // A barrel-chested body: the plate's front face 0.35 ahead of the shoulder joint, beyond the sphere round it.
    const deep = TorsoSurface.measure(body(0.8).ch)!;
    expect(deep.clearance(butt, new Vector3(0, 0, 1), 0.04, 0)).toBeCloseTo(0.4, 2);
  });

  it('follows the chest joint as the body turns', () => {
    const { ch, chest } = body(0.3);
    const torso = TorsoSurface.measure(ch)!;
    chest.position.z = 0.1;
    expect(torso.clearance(new Vector3(0.1, 1.45, 0), new Vector3(0, 0, 1), 0.04, 0)).toBeCloseTo(0.25, 2);
  });
});

describe('reachAlong', () => {
  it('is how far a point can slide along a line and stay within reach', () => {
    expect(reachAlong(Vector3.Zero(), new Vector3(0, 0, 0.3), new Vector3(0, 0, 1), 0.5)).toBeCloseTo(0.2, 5);
    expect(reachAlong(Vector3.Zero(), new Vector3(0, 0, 0.6), new Vector3(0, 0, 1), 0.5)).toBe(0);
  });
});
