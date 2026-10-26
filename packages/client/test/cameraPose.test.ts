import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { createViewCamera, poseCamera } from '../src/game/cameraPose.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

function setup(make: (scene: Scene) => FreeCamera) {
  const engine = new NullEngine();
  engines.push(engine);
  const scene = new Scene(engine);
  const camera = make(scene);
  // Something hung from the camera, like the first-person gun and arms.
  const held = new TransformNode('viewRoot', scene);
  held.parent = camera;
  held.position.set(0.2, -0.2, 0.5);
  return { camera, held };
}

/** Degrees a node is rolled: how far its right axis leaves the horizontal plane. */
function rollDeg(node: TransformNode | FreeCamera): number {
  node.computeWorldMatrix(true);
  const right = Vector3.TransformNormal(Vector3.Right(), node.getWorldMatrix()).normalize();
  return (Math.asin(Math.abs(right.y)) * 180) / Math.PI;
}

/** A shake (rolling every frame) that ends while looking up, then turning and looking around level. */
function shakeThenLook(camera: FreeCamera, held: TransformNode): number {
  let worst = 0;
  for (let f = 0; f < 30; f++) {
    poseCamera(camera, 0.3, 0.5, Math.sin(f * 0.9) * 0.025);
    camera.getViewMatrix(true);
  }
  for (let f = 0; f < 120; f++) {
    const yaw = 0.3 + f * 0.05;
    // Still looking up on the frame the shake stops, then all around.
    const pitch = 0.5 * Math.cos(f * 0.1);
    poseCamera(camera, yaw, pitch);
    camera.getViewMatrix(true);
    worst = Math.max(worst, rollDeg(camera), rollDeg(held));
  }
  return worst;
}

describe('view camera', () => {
  it('stays level after a shake: no roll on the camera or anything hung from it', () => {
    const { camera, held } = setup((scene) => createViewCamera('camera', scene));
    expect(shakeThenLook(camera, held)).toBeLessThan(1);
    // And the gun is upright in view: its up axis is the camera's.
    held.computeWorldMatrix(true);
    const up = Vector3.TransformNormal(Vector3.Up(), held.getWorldMatrix()).normalize();
    const camUp = Vector3.TransformNormal(Vector3.Up(), camera.getWorldMatrix()).normalize();
    expect(Vector3.Dot(up, camUp)).toBeGreaterThan(Math.cos((1 * Math.PI) / 180));
  });

  it('still rolls while shaking', () => {
    const { camera, held } = setup((scene) => createViewCamera('camera', scene));
    poseCamera(camera, 1, 0.2, 0.05);
    camera.getViewMatrix(true);
    expect(rollDeg(held)).toBeGreaterThan(2);
  });

  it('(the bug) a plain Babylon camera keeps a tilted up vector after the shake ends', () => {
    const { camera, held } = setup((scene) => new FreeCamera('plain', new Vector3(0, 10, -10), scene));
    expect(shakeThenLook(camera, held)).toBeGreaterThan(5);
  });
});
