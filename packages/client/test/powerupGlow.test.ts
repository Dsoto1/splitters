import { describe, expect, it } from 'vitest';
import { PHANTOM_SHOWN, POWERUP_DAMAGE_BIT, POWERUP_KINDS, POWERUP_OVERDRIVE_BIT, POWERUP_REGEN_BIT } from '@tiletrigger/shared';
import { BASE_GLOW, OVERDRIVE_GLOW_HIGH, OVERDRIVE_GLOW_LOW, OVERDRIVE_GLOW_STEADY, OVERDRIVE_PULSE_HZ, PHANTOM_ALLY_SHOWN, bodyGlowColor, bodyGlowScale, easePhantom, phantomShown } from '../src/game/powerupGlow.ts';
import { POWERUP_LOOKS, powerupLine } from '../src/game/powerupLook.ts';

describe('power-up looks', () => {
  it('Overdrive glows gold, slower than once a second, and holds still with Reduce flashing', () => {
    expect(bodyGlowColor(POWERUP_OVERDRIVE_BIT | POWERUP_DAMAGE_BIT)).toBe(POWERUP_LOOKS.overdrive.color);
    expect(bodyGlowColor(POWERUP_REGEN_BIT)).toBeNull();
    expect(OVERDRIVE_PULSE_HZ).toBeLessThanOrEqual(1);
    // Sampled at 60 Hz over 3 s: within its range, at most one rise and fall a second, and never a jump.
    const xs = Array.from({ length: 180 }, (_, i) => bodyGlowScale(POWERUP_OVERDRIVE_BIT, i / 60, false));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(OVERDRIVE_GLOW_LOW);
    expect(Math.max(...xs)).toBeLessThanOrEqual(OVERDRIVE_GLOW_HIGH);
    let peaks = 0;
    for (let i = 1; i < xs.length; i++) {
      expect(Math.abs(xs[i]! - xs[i - 1]!)).toBeLessThanOrEqual(0.051);
      if (xs[i]! >= OVERDRIVE_GLOW_HIGH && xs[i - 1]! < OVERDRIVE_GLOW_HIGH) peaks++;
    }
    expect(peaks).toBeLessThanOrEqual(3);
    expect(new Set(Array.from({ length: 60 }, (_, i) => bodyGlowScale(POWERUP_OVERDRIVE_BIT, i / 20, true)))).toEqual(new Set([OVERDRIVE_GLOW_STEADY]));
    expect(bodyGlowScale(POWERUP_DAMAGE_BIT, 0.3, false)).toBe(BASE_GLOW);
  });

  it('Phantom is a faint shimmer to enemies, a ghost to teammates, eased in and out', () => {
    for (let t = 0; t < 3; t += 0.05) expect(Math.abs(phantomShown(t, true, false) - PHANTOM_SHOWN)).toBeLessThan(0.05);
    expect(phantomShown(1.234, true, true)).toBe(PHANTOM_SHOWN);
    expect(phantomShown(0, false, false)).toBe(PHANTOM_ALLY_SHOWN);
    expect(easePhantom(0, 1, 1 / 60)).toBeCloseTo(0.1, 5);
    expect(easePhantom(1, 0, 1)).toBe(0);
  });

  it('has a HUD line with icon, seconds and bar for every power-up', () => {
    for (const k of POWERUP_KINDS) {
      const html = powerupLine(k, 4.2, 10);
      expect(html).toContain(POWERUP_LOOKS[k].name);
      expect(html).toContain(' 5<');
      expect(html).toContain('width:40%');
    }
  });
});
