import { describe, expect, it } from 'vitest';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { AIRPLANE_DEF, DROPSHIP_DROP_DEF, MOUNT_DEFS, getMountDef } from '@tiletrigger/shared';
import { paintColor } from '../src/game/mountVisuals.ts';

/** A team colour (Shingle Point's attackers, the owner's screenshot of 2026-11-17). */
const BLUE = '#3f7fd8';
/** The Dropship model's colour map (vehicles/hover_carrier.glb), its middle olive and its white, as linear colours. */
const OLIVE = Color3.FromHexString('#3c3f2a').toLinearSpace();
const WHITE = Color3.FromHexString('#b3b3b1').toLinearSpace();
const lum = (c: Color3) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

describe('mount paint strength (MountDef.paint)', () => {
  it('full strength (the default) is the tint itself; none would be white', () => {
    expect(paintColor(BLUE).equals(Color3.FromHexString(BLUE))).toBe(true);
    expect(paintColor(BLUE, 1).equals(Color3.FromHexString(BLUE))).toBe(true);
    const half = paintColor(BLUE, 0.5);
    const c = Color3.FromHexString(BLUE);
    expect(half.r).toBeCloseTo((1 + c.r) / 2, 6);
    expect(half.g).toBeCloseTo((1 + c.g) / 2, 6);
    expect(half.b).toBeCloseTo((1 + c.b) / 2, 6);
  });

  it("the Dropship keeps its olive under a team colour and its white still reads as the team's", () => {
    for (const def of [getMountDef('dropship')!, DROPSHIP_DROP_DEF]) {
      expect(def.paint, def.id).toBeDefined();
      const p = paintColor(BLUE, def.paint);
      // Full paint left the olive under half its brightness and turned it blue-black (blue over red and green).
      const full = OLIVE.multiply(Color3.FromHexString(BLUE));
      expect(lum(full) / lum(OLIVE)).toBeLessThan(0.5);
      expect(full.b).toBeGreaterThan(full.r);
      const olive = OLIVE.multiply(p);
      expect(lum(olive) / lum(OLIVE), def.id).toBeGreaterThan(0.65);
      expect(olive.g, def.id).toBeGreaterThan(olive.b);
      // The white parts carry the team colour: clearly bluer than they are red.
      const white = WHITE.multiply(p);
      expect(white.b / white.r, def.id).toBeGreaterThan(1.3);
    }
  });

  it('every vehicle takes its team colour at half strength (owner, 2026-11-17: all textured models); turrets keep the full colour', () => {
    const vehicles = Object.values(MOUNT_DEFS).filter((d) => d.kind === 'vehicle');
    expect(vehicles.length).toBeGreaterThan(10);
    for (const def of [...vehicles, AIRPLANE_DEF, DROPSHIP_DROP_DEF]) expect(def.paint, def.id).toBe(0.5);
    for (const def of Object.values(MOUNT_DEFS).filter((d) => d.kind !== 'vehicle')) expect(def.paint, def.id).toBeUndefined();
  });
});
