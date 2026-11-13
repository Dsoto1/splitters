/**
 * Tileset 11 plan item C8 (a curb drop wedge): "check first whether vehicles need it at all". They do not: a vehicle
 * moves on the same character controller as a player (PhysicsWorld.moveVehicle: autostep 0.3 m), so it rides up the
 * street tiles' 0.15 m sidewalks from the road and back down. No wedge is built.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { PhysicsWorld, PLAYER, buildMapGeometry, initPhysics } from '../src/index.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => initPhysics());

describe('vehicles and the kerb', () => {
  for (const tile of ['core.street', 'suburban.street']) {
    it(`a vehicle probe drives from the road onto ${tile}'s sidewalk and back, either side`, () => {
      const geometry = buildMapGeometry(makeMap([{ id: 'street', tile, x: 0, y: 0, z: 0, rotation: 0 }]));
      // The sidewalks: the tile's low boxes with their tops between 0.1 and 0.3 m.
      const walks = geometry.filter((b) => b.sourceId === 'street' && b.kind !== 'trim' && b.max[1] > 0.1 && b.max[1] <= PLAYER.maxStepHeight && b.max[0] - b.min[0] > 0.5 && b.max[2] - b.min[2] > 0.5);
      expect(walks.length, 'sidewalks').toBeGreaterThanOrEqual(2);
      const physics = new PhysicsWorld(geometry);
      for (const radius of [0.7, 1.1]) {
        for (const walk of walks) {
          const top = walk.max[1];
          expect(top).toBeLessThanOrEqual(PLAYER.maxStepHeight);
          // Across the kerb's long edge, from the road side (the tile's middle) to the sidewalk's middle.
          const alongZ = walk.max[2] - walk.min[2] > walk.max[0] - walk.min[0];
          const mid = { x: (walk.min[0] + walk.max[0]) / 2, z: (walk.min[2] + walk.max[2]) / 2 };
          const probe = physics.createVehicleProbe(radius);
          const body = physics.createVehicleProbe(0.1);
          let feet = alongZ ? { x: 0, y: 0, z: mid.z } : { x: mid.x, y: 0, z: 0 };
          const to = alongZ ? { x: mid.x, z: mid.z } : { x: mid.x, z: mid.z };
          for (let i = 0; i < 400; i++) {
            const dx = to.x - feet.x;
            const dz = to.z - feet.z;
            const d = Math.hypot(dx, dz);
            if (d < 0.05) break;
            const r = physics.moveVehicle(probe, body, feet, { x: (dx / d) * 0.1, y: -0.2, z: (dz / d) * 0.1 });
            feet = r.feet;
          }
          // Up on it: its feet at the sidewalk's height, over it or resting on its edge (a 1.4 m sidewalk is narrower
          // than the wider probe, and a lamp or the tile's edge may keep it from the middle).
          const off = Math.hypot(Math.max(walk.min[0] - feet.x, 0, feet.x - walk.max[0]), Math.max(walk.min[2] - feet.z, 0, feet.z - walk.max[2]));
          expect(off, `${tile} r${radius}: at the sidewalk`).toBeLessThan(radius);
          expect(Math.abs(feet.y - top), `${tile} r${radius}: up on it`).toBeLessThan(0.03);
          // And back down onto the road.
          for (let i = 0; i < 400 && Math.hypot(feet.x, alongZ ? 0 : feet.z) > 0.05; i++) {
            const dx = (alongZ ? 0 : mid.x) - feet.x;
            const dz = (alongZ ? mid.z : 0) - feet.z;
            const d = Math.hypot(dx, dz) || 1;
            feet = physics.moveVehicle(probe, body, feet, { x: (dx / d) * 0.1, y: -0.2, z: (dz / d) * 0.1 }).feet;
          }
          expect(feet.y, `${tile} r${radius}: back on the road`).toBeLessThan(0.06);
        }
      }
      physics.free();
    });
  }
});
