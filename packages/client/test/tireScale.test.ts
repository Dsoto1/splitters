import { describe, expect, it } from 'vitest';
import { MOUNT_DEFS } from '@tiletrigger/shared';
import { tireScale } from '../src/game/mountVisuals.ts';

/** The Rugged Off-Road Tire as built (vehicles/offroad_tire.glb): 0.83 m across, 0.32 m wide. */
const TIRE = { radius: 0.415, width: 0.32 };

describe('drawn tire size (MountDef.wheels radius and width)', () => {
  it('no size given: the tire model as it is', () => {
    expect(tireScale(TIRE, {})).toEqual([1, 1, 1]);
  });

  it('a radius scales it all round; a width sets how wide on its own', () => {
    const [x, y, z] = tireScale(TIRE, { radius: 0.6 });
    expect(x).toBeCloseTo(0.6 / 0.415, 6);
    expect(y).toBe(x);
    expect(z).toBe(x);
    const wide = tireScale(TIRE, { radius: 0.6, width: 0.5 });
    expect(wide[0]).toBe(x);
    expect(wide[2]).toBeCloseTo(0.5 / 0.32, 6);
    expect(tireScale(TIRE, { width: 0.4 })).toEqual([1, 1, 0.4 / 0.32]);
  });

  it('the buggy, gun jeep, troop truck and armored rover ride on the separate tire, on the ground at each hub', () => {
    for (const id of ['buggy', 'gun_jeep', 'troop_truck', 'armored_rover'] as const) {
      const def = MOUNT_DEFS[id];
      const wheels = def.wheels!;
      expect(wheels.model).toBe('vehicles/offroad_tire.glb');
      expect(wheels.at).toHaveLength(id === 'troop_truck' ? 6 : 4);
      // Each hub is the tire's radius over the ground, and the tire stays inside the collision box across and along.
      for (const [x, y, z] of wheels.at) {
        expect(y).toBeCloseTo(wheels.radius!, 6);
        expect(Math.abs(x) + wheels.width! / 2).toBeLessThanOrEqual(def.half[0] + 1e-9);
        expect(Math.abs(z) + wheels.radius!).toBeLessThanOrEqual(def.half[2] + 1e-9);
      }
      // A left and a right tire per axle, and neighbours on a side don't run into each other.
      const left = wheels.at.filter((p) => p[0] < 0).map((p) => p[2]).sort((a, b) => a - b);
      expect(left).toHaveLength(wheels.at.length / 2);
      for (let i = 1; i < left.length; i++) expect(left[i]! - left[i - 1]!).toBeGreaterThan(wheels.radius! * 2);
      // The body is held where it stood on its own tires, and the vehicle has springs for them to ride and steer on.
      expect(def.rideHeight).toBeGreaterThan(0.2);
      expect(def.vehicle!.suspension!.wheels).toHaveLength(wheels.at.length);
    }
    // The truck's tires are bigger than the buggy's.
    expect(MOUNT_DEFS.troop_truck.wheels!.radius!).toBeGreaterThan(MOUNT_DEFS.buggy.wheels!.radius!);
  });
});
