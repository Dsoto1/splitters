import { describe, expect, it } from 'vitest';
import { CORE_WEAPONS, getWeapon } from '../src/index.ts';
import { BOT_TTK, BOT_TTK_DISTANCES } from '../src/bots/weaponBands.generated.ts';
import { botBand, effectiveBand, measuredBand } from '../src/bots/weaponBands.ts';

const D = [5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 75, 100, 125, 150];

describe("bots' weapon bands (G4: from gun-report's measured TTK)", () => {
  it('takes the run of distances around the quickest kill that stay within the slack', () => {
    // An SMG-like curve: quick up close, slow past 25 m. Limit max(0.8 s, 1.6 x 0.4, 0.4 + 0.5) = 0.9 s.
    const smg = [400, 400, 400, 550, 770, 1200, 1500, 2000, 3600, null, null, null, null, null];
    expect(effectiveBand(smg, D)).toEqual([0, 27.5]);
    // A long gun slow up close: its band starts where it gets good.
    const lr = [2600, 2600, 1300, 1000, 900, 900, 900, 900, 950, 950, 1000, 1000, 1100, 1200];
    expect(effectiveBand(lr, D)).toEqual([12.5, 150]);
    // One-shot up close (0 ms): anything within 0.8 s still counts.
    expect(effectiveBand([0, 750, 2250, 6000, null, null, null, null, null, null, null, null, null, null], D)).toEqual([0, 12.5]);
    // Never kills in time: no band.
    expect(effectiveBand([null, null, 3000, ...Array<null>(11).fill(null)], D)).toBeNull();
  });

  it('measured every gun bots fire, and every band is sane', () => {
    expect(BOT_TTK_DISTANCES).toEqual(D);
    for (const [id, curve] of Object.entries(BOT_TTK)) {
      expect(curve.length, id).toBe(D.length);
      expect(CORE_WEAPONS[id], id).toBeTruthy();
    }
    for (const id of ['core.pistol', 'core.smg', 'core.rifle', 'core.shotgun', 'core.sniper', 'core.rockets', 'core.machine_pistol']) {
      const b = measuredBand(id);
      expect(b, id).toBeTruthy();
      expect(b![0], id).toBeLessThan(b![1]);
    }
  });

  it('puts each benchmark gun where it kills best: shotgun closest, SMG inside the rifle, precision rifle furthest', () => {
    const far = (id: string) => botBand(getWeapon(id))[1];
    expect(far('core.shotgun')).toBeLessThan(far('core.smg'));
    expect(far('core.smg')).toBeLessThan(far('core.rifle'));
    expect(far('core.rifle')).toBeLessThan(far('core.sniper'));
    // A launcher is never fought inside its own blast.
    const rockets = getWeapon('core.rockets');
    expect(botBand(rockets)[0]).toBeGreaterThanOrEqual((rockets.projectile?.splashRadius ?? 0) + 1);
  });

  it('keeps the hand-set range for weapons without a measurement (melee)', () => {
    const knife = getWeapon('core.knife');
    expect(measuredBand('core.knife')).toBeUndefined();
    expect(botBand(knife)).toEqual(knife.botRange);
  });
});
