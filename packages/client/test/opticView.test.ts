import { describe, expect, it } from 'vitest';
import { getWeapon } from '@tiletrigger/shared';
import { DEFAULT_RELIEF, LENS_SHARE, opticFrame } from '../src/game/opticView.ts';

const HIP = 1.35;
const ADS = HIP * 0.72;

describe('the Battle Rifle optic (opticView.ts)', () => {
  const optic = getWeapon('core.battle_rifle').view.optic!;

  it('is a 3.5x optic on the model\'s own scope tube, on the bore line, beyond the camera\'s near plane', () => {
    expect(optic.mag).toBe(3.5);
    expect(optic.eye[0]).toBe(0);
    expect(optic.relief ?? DEFAULT_RELIEF).toBeGreaterThan(0.1);
  });

  it('starts at the sights: no squash, the plain sights\' field of view', () => {
    const f = opticFrame(optic, ADS, HIP, 0);
    expect(f.worldFov).toBeCloseTo(ADS, 10);
    expect(f.gunFov).toBeCloseTo(ADS, 10);
    expect(f.squash).toBeCloseTo(1, 10);
  });

  it('on the eye: the world 3.5x the hip view, the glass filling its share of the screen, the gun squashed to match', () => {
    const f = opticFrame(optic, ADS, HIP, 1);
    expect(f.mag).toBeCloseTo(3.5, 10);
    expect(Math.tan(f.worldFov / 2)).toBeCloseTo(Math.tan(HIP / 2) / 3.5, 10);
    expect(f.lens).toBeCloseTo(LENS_SHARE, 10);
    // The gun drawn at its own field of view: its x/z on screen is tan(world)/tan(gun) of what the camera would draw.
    expect(f.squash).toBeCloseTo(Math.tan(f.worldFov / 2) / Math.tan(f.gunFov / 2), 10);
    // The glass's projection is exactly the HUD's circle: radius / relief over the gun's half-height tangent.
    expect(f.lens).toBeCloseTo(optic.radius / (optic.relief ?? DEFAULT_RELIEF) / Math.tan(f.gunFov / 2), 10);
  });

  it('eases monotonically: the magnification and the glass grow together as the eye comes on', () => {
    let last = opticFrame(optic, ADS, HIP, 0);
    for (let b = 0.1; b <= 1.0001; b += 0.1) {
      const f = opticFrame(optic, ADS, HIP, b);
      expect(f.mag).toBeGreaterThan(last.mag);
      expect(f.lens).toBeGreaterThan(last.lens);
      last = f;
    }
  });
});
