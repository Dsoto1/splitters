import { describe, expect, it } from 'vitest';
import { HIT_KICK, addKick, kickAt, kickEnvelope } from '../src/game/hitKick.ts';

describe('the hit camera kick (owner, 2026-11-16: punchier hits)', () => {
  it('kicks up and away from the round, by stopping power: a shotgun blast far more than an SMG round', () => {
    const blast = addKick(null, 0, 1, 1, false);
    const smg = addKick(null, 0, 0.1, 1, false);
    expect(blast.pitch).toBeGreaterThan(smg.pitch * 4);
    // From the right: the view turns left (yaw down).
    expect(blast.yaw).toBeLessThan(0);
    expect(addKick(null, 0, 1, -1, false).yaw).toBeGreaterThan(0);
    // Small: under two degrees at its peak.
    expect(blast.pitch).toBeLessThan((2 * Math.PI) / 180);
  });

  it('rounds close together add up only to the cap, and it settles within 0.6 s', () => {
    let k = null;
    for (let i = 0; i < 20; i++) k = addKick(k, i * 0.05, 1, 0, false);
    expect(k!.pitch).toBeLessThanOrEqual(HIT_KICK.max + 1e-12);
    expect(kickAt(k, k!.t0 + HIT_KICK.seconds)).toEqual({ pitch: 0, yaw: 0 });
  });

  it('Reduce flashing: smaller, eased in (no snap) and slower to settle', () => {
    const calm = addKick(null, 0, 1, 1, true);
    const full = addKick(null, 0, 1, 1, false);
    expect(calm.pitch).toBeLessThan(full.pitch * 0.6);
    // Eased: a third of the way into its rise it has moved far less than a third, and the rise is longer.
    expect(kickEnvelope(HIT_KICK.calmRise / 3, true)).toBeLessThan(0.3);
    expect(HIT_KICK.calmRise).toBeGreaterThan(HIT_KICK.rise * 2);
    // Per frame (60 Hz) it never moves more than a fraction of a degree.
    let last = 0;
    let most = 0;
    for (let t = 0; t <= HIT_KICK.seconds; t += 1 / 60) {
      const p = kickAt(calm, t).pitch;
      most = Math.max(most, Math.abs(p - last));
      last = p;
    }
    expect(most).toBeLessThan((0.25 * Math.PI) / 180);
  });
});
