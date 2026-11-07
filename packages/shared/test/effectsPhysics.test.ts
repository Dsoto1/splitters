import { beforeAll, describe, expect, it } from 'vitest';
import { EffectsWorld, initPhysics, type WorldBox } from '../src/index.ts';

beforeAll(() => initPhysics());

/** A floor and a few hundred level boxes, as a map has (the walk over them is what the direct step leaves out). */
function world(): EffectsWorld {
  const boxes: WorldBox[] = [{ min: [-50, -1, -50], max: [50, 0, 50], kind: 'solid', sourceId: 'floor' } as WorldBox];
  for (let i = 0; i < 300; i++) boxes.push({ min: [60 + i, 0, 60], max: [60.5 + i, 1, 60.5], kind: 'solid', sourceId: `b${i}` } as WorldBox);
  return new EffectsWorld(boxes);
}

describe('effects physics, stepped without the per-step handle walk (performance round 4)', () => {
  it('drops bodies made between steps onto the floor, and removes them', () => {
    const w = world();
    w.step(1 / 60);
    const a = w.addBody({ kind: 'ball', radius: 0.2 }, { x: 0, y: 3, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, 'debris');
    for (let i = 0; i < 60; i++) w.step(1 / 60);
    const b = w.addBody({ kind: 'box', half: { x: 0.1, y: 0.1, z: 0.1 } }, { x: 2, y: 3, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, 'debris');
    for (let i = 0; i < 120; i++) w.step(1 / 60);
    expect(a.translation().y).toBeGreaterThan(0.1);
    expect(a.translation().y).toBeLessThan(0.4);
    expect(b.translation().y).toBeLessThan(0.3);
    const bodies = w.world.bodies.len();
    w.remove(a);
    w.step(1 / 60);
    expect(w.world.bodies.len()).toBe(bodies - 1);
    expect(w.world.bodies.get(b.handle)).toBe(b);
    w.free();
  });

  it('finds a ragdoll part made after the world with a ray, through its JS objects', () => {
    const w = world();
    w.step(1 / 60);
    const body = w.takeRagdollBody('torso', { kind: 'capsule', halfHeight: 0.3, radius: 0.15 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0, w: 1 });
    w.step(1 / 60);
    const hit = w.raycastRagdoll({ x: 0, y: 1, z: -3 }, { x: 0, y: 0, z: 1 }, 10);
    expect(hit?.body).toBe(body);
    w.free();
  });
});
