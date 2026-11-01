import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { animateArsenalProjectile, createArsenalProjectile } from '../src/game/arsenalVisuals.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

/** Where the node's +Z (the spear's head) points in the world. */
function heading(node: ReturnType<typeof createArsenalProjectile>): Vector3 {
  node.computeWorldMatrix(true);
  return Vector3.TransformNormal(Vector3.Forward(), node.getWorldMatrix()).normalize();
}

describe('thrown spear', () => {
  it('points along its flight and keeps that heading where it sticks', () => {
    const engine = new NullEngine();
    engines.push(engine);
    const scene = new Scene(engine);
    const node = createArsenalProjectile(scene, 1, 'spear');
    // Thrown off to the side (not world +Z, which an unturned node would already face), coming down.
    const flight = new Vector3(-6, -3, 2);
    let at = new Vector3(0, 2, 0);
    for (let f = 0; f < 5; f++) {
      const next = at.add(flight.scale(1 / 60));
      node.position.copyFrom(next);
      animateArsenalProjectile(node, 'spear', f * 16, next.subtract(at), 0);
      at = next;
    }
    const want = flight.normalizeToNew();
    expect(Vector3.Dot(heading(node), want)).toBeGreaterThan(0.999);
    // Stuck: no movement, the heading stays.
    for (let f = 0; f < 3; f++) animateArsenalProjectile(node, 'spear', 100 + f * 16, Vector3.Zero(), 0);
    expect(Vector3.Dot(heading(node), want)).toBeGreaterThan(0.999);
  });
});
