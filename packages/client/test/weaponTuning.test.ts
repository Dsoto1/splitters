import { describe, expect, it } from 'vitest';
import { CORE_WEAPONS, falloffAt, flightTo, getWeapon, gunplayOf, kickOf } from '@tiletrigger/shared';
import { damageAt, dropAt, recoilPath, spreadCones, ttkAt, weaponStats } from '../src/tools/weaponTuningData.ts';
import { holdoverFor } from '../src/game/holdover.ts';

/** The weapon tuning screen's numbers (tools/weaponTuningData.ts) and the scope holdover marks (game/holdover.ts). */
describe('weapon tuning data (spec §45)', () => {
  it('recoil path: the first round is the first kick; a held SMG climbs round by round', () => {
    const smg = getWeapon('core.smg');
    const path = recoilPath(smg, 0, 30);
    expect(path).toHaveLength(Math.min(30, smg.magazine));
    const k = gunplayOf(smg).kick!;
    expect(path[0]!.pitch).toBeCloseTo(kickOf(k, 0).pitch, 9);
    expect(path[path.length - 1]!.pitch).toBeGreaterThan(path[0]!.pitch * 3);
    // A Heavy Revolver at its fastest still settles between rounds: each round kicks it from lower than the last peak.
    const rev = recoilPath(getWeapon('core.revolver'), 0, 6);
    expect(rev).toHaveLength(Math.min(6, getWeapon('core.revolver').magazine));
    expect(rev[1]!.pitch).toBeLessThan(rev[0]!.pitch * 2);
  });

  it('spread cones: sights tighten, running and jumping widen, a spray blooms', () => {
    const c = spreadCones(getWeapon('core.rifle'))!;
    expect(c.ads).toBeLessThan(c.hip);
    expect(c.moving).toBeGreaterThan(c.hip);
    expect(c.air).toBeGreaterThan(c.moving);
    expect(c.sprayed).toBeGreaterThan(c.hip);
    expect(c.pattern).toBe(0);
    expect(spreadCones(getWeapon('core.shotgun'))!.pattern).toBeGreaterThan(0);
    expect(spreadCones(getWeapon('core.rockets'))).toBeNull();
  });

  it('damage over distance follows the falloff under Arcade, nothing past reach, and drops sooner under Advanced', () => {
    const rifle = getWeapon('core.rifle');
    const gp = gunplayOf(rifle);
    for (const d of [5, 30, 60, 100]) expect(damageAt(rifle, d, 'arcade')).toBeCloseTo(rifle.damage * falloffAt(gp.falloff, d), 6);
    expect(damageAt(rifle, rifle.range + 1)).toBe(0);
    expect(damageAt(rifle, 60, 'advanced')).toBeLessThan(damageAt(rifle, 60, 'standard') + 1e-9);
    // Standard keeps the tuned distances (damage by impact speed: spec §37).
    expect(damageAt(rifle, gp.falloff!.start, 'standard')).toBeCloseTo(rifle.damage, 3);
  });

  it('time to kill: a one-shot weapon kills at once, others in whole intervals', () => {
    const sniper = getWeapon('core.sniper');
    if (sniper.damage >= 100) expect(ttkAt(sniper, 20)).toBe(0);
    const smg = getWeapon('core.smg');
    const shots = Math.ceil(100 / damageAt(smg, 5));
    expect(ttkAt(smg, 5)).toBeCloseTo(((shots - 1) * smg.fireIntervalTicks) / 60, 9);
    expect(ttkAt(smg, smg.range + 5)).toBeNull();
  });

  it('stats for every carried weapon are finite, and handling is in them', () => {
    for (const def of Object.values(CORE_WEAPONS).filter((d) => d.slot > 0)) {
      const s = weaponStats(def);
      for (const [k, v] of Object.entries(s)) if (v !== null) expect(Number.isFinite(v), `${def.id} ${k}`).toBe(true);
    }
    expect(weaponStats(getWeapon('core.lmg')).move).toBe(0.9);
    expect(weaponStats(getWeapon('core.pistol')).sprintExit).toBeCloseTo(3 / 60, 9);
  });

  it('drop angles are the bullet\'s drop over the distance', () => {
    const sniper = getWeapon('core.sniper');
    const b = gunplayOf(sniper).ballistic!;
    for (const m of dropAt(sniper)) expect(Math.tan(m.angle) * m.dist).toBeCloseTo(flightTo(b, m.dist).drop, 6);
    expect(dropAt(getWeapon('core.railgun'))).toEqual([]);
  });
});

describe('scope holdover marks (spec §5)', () => {
  it('sit below the centre by the drop at each distance, at the scope\'s zoom', () => {
    const sniper = getWeapon('core.sniper');
    const tanHalf = Math.tan(sniper.view.zoomFov! / 2);
    const marks = holdoverFor(sniper, {}, tanHalf);
    expect(marks.length).toBeGreaterThanOrEqual(2);
    for (const m of marks) {
      const dist = Number(m.label) * 100;
      expect(m.y).toBeCloseTo((100 * flightTo(gunplayOf(sniper).ballistic!, dist).drop) / dist / tanHalf, 1);
      expect(m.major).toBe(dist % 200 === 0);
    }
    // Never crowded: each at least the gap below the last.
    for (let i = 1; i < marks.length; i++) expect(marks[i]!.y - marks[i - 1]!.y).toBeGreaterThanOrEqual(2.6);
    // Zoomed further in (the second zoom), they spread out and more distances get a mark.
    const closer = holdoverFor(sniper, {}, tanHalf * 0.45);
    expect(closer.length).toBeGreaterThan(marks.length);
    expect(closer.length).toBeGreaterThanOrEqual(4);
    // Advanced ballistics drop more: the marks sit lower.
    expect(holdoverFor(sniper, { ballistics: 'advanced' }, tanHalf)[0]!.y).toBeGreaterThan(marks[0]!.y);
  });

  it('none for rounds that don\'t drop', () => {
    expect(holdoverFor(getWeapon('core.railgun'), {}, 0.25)).toEqual([]);
  });
});
