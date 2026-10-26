import { beforeAll, describe, expect, it } from 'vitest';
import { PhysicsWorld, blockBoxes, boxBounds, boxCorners, boxQuat, buildMapGeometry, emptyInput, initPhysics, loadMap, quatRotate, stepMovement, validateMap, type MapDocument } from '../src/index.ts';
import { NavWorld, initNavigation } from '../src/match.ts';
import { block, codes, loaded, twoRooms } from './kit20.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const deg = (d: number) => (d * Math.PI) / 180;

/** A 5 m ramp rising 20° to the north up to a ledge in the first room. */
function rampMap(pitch = deg(20)): MapDocument {
  const len = 5;
  const rise = Math.sin(pitch) * len;
  const top = -0.5 + (Math.cos(pitch) * len) / 2;
  return twoRooms([
    // Centre of the ramp's top face sits half the rise up; the block turns about its centre.
    block('ramp_1', [0, rise / 2 - 0.25, -0.5], { size: [2, 0.5, len], pitch }),
    block('ledge_1', [0, rise - 0.5, top + 1], { size: [3, 0.5, 2] }),
  ]);
}

describe('pitched blocks', () => {
  it('positive pitch lifts the +Z end; roll lifts +X; corners and bounds follow', () => {
    const q = boxQuat(0, deg(30), 0);
    expect(quatRotate(q, 0, 0, 1)[1]).toBeCloseTo(0.5, 5);
    expect(quatRotate(boxQuat(0, 0, deg(30)), 1, 0, 0)[1]).toBeCloseTo(0.5, 5);
    // Yaw then turns the lifted end: facing east, +Z (local) points to +X.
    const turned = quatRotate(boxQuat(Math.PI / 2, deg(30), 0), 0, 0, 1);
    expect(turned[0]).toBeCloseTo(Math.cos(deg(30)), 5);
    expect(turned[1]).toBeCloseTo(0.5, 5);
    const doc = loaded(rampMap());
    const box = blockBoxes(doc).find((b) => b.sourceId === 'ramp_1')!;
    expect(box.pitch).toBeCloseTo(deg(20), 6);
    const north = boxCorners(box).filter((c) => c[2] > 0);
    const south = boxCorners(box).filter((c) => c[2] < -2);
    expect(Math.max(...north.map((c) => c[1]))).toBeGreaterThan(Math.max(...south.map((c) => c[1])) + 1.5);
    const b = boxBounds(box);
    expect(b.max[1] - b.min[1]).toBeGreaterThan(2);
  });

  it('physics collides with the tilted box: a ray down hits the slope at its height', () => {
    const doc = loaded(rampMap());
    const physics = new PhysicsWorld(buildMapGeometry(doc));
    const ramp = doc.entities.find((e) => e.id === 'ramp_1')!;
    const centreTop = ramp.position[1] + 0.25 + 0.25 / Math.cos(deg(20));
    // 1.5 m north of the centre the slope is 1.5·tan(20°) higher.
    const d = physics.raycastWorld({ x: 0, y: 6, z: -0.5 + 1.5 }, { x: 0, y: -1, z: 0 }, 10)!;
    expect(6 - d).toBeCloseTo(centreTop + 1.5 * Math.tan(deg(20)), 1);
    physics.free();
  });

  it('players walk up a ramp under the slope limit, and navigation links the floor to the ledge', () => {
    const doc = loaded(rampMap());
    const physics = new PhysicsWorld(buildMapGeometry(doc));
    const collider = physics.createPlayerCollider();
    let state = { pos: { x: 0, y: 0, z: -3.4 }, velY: 0, grounded: true };
    for (let k = 0; k < 120; k++) state = stepMovement(physics, collider, state, { ...emptyInput(), seq: k, forward: 1, yaw: 0 });
    expect(state.pos.y).toBeGreaterThan(1.5);
    expect(state.pos.z).toBeGreaterThan(2.2);
    const nav = NavWorld.build(buildMapGeometry(doc));
    expect(nav.findPath({ x: 0, y: 0, z: -3.4 }, { x: 0, y: 1.71, z: 2.9 })).not.toBeNull();
    nav.destroy();
    physics.free();
  });

  it('tilts are capped at 45° by the schema and keep validation clean', () => {
    expect(codes(validateMap(loaded(rampMap())))).toEqual([]);
    expect(loadMap(rampMap(deg(50))).ok).toBe(false);
  });
});
