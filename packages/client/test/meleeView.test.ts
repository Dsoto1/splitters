/**
 * Long melee weapons in first person (game/meleeView.ts; owner, 2026-11-22: the Katana, Scimitar, Baseball Bat and
 * Battle Axe showed only the blade, the hands below the frame). Every long melee weapon's two hand points land inside
 * the view at rest, for any length it could measure (a blade's and a polearm's); the swing and the draw end where they
 * started. The hands drawn on them are checked in the browser (e2e `characters2`, `__grips.handsOnScreen`).
 */
import { describe, expect, it } from 'vitest';
import { CORE_WEAPONS, type WeaponDefinition } from '@tiletrigger/shared';
import { DEFAULT_FOV } from '../src/game/view.ts';
import { POLE_REACH, firstPersonHold, isLongMelee, isPolearm, meleePlacement, placedPoint, swingSeconds } from '../src/game/meleeView.ts';

const all = Object.values(CORE_WEAPONS) as WeaponDefinition[];
const long = all.filter((d) => isLongMelee(d));
/** On screen at 16:9 with the game's field of view (vertical): normalised device coordinates. */
const ndc = ([x, y, z]: [number, number, number]) => {
  const t = Math.tan(DEFAULT_FOV / 2);
  return { x: x / z / (t * (16 / 9)), y: y / z / t, z };
};

describe('long melee weapons in first person', () => {
  it('are the long blades, the bat, the axe and the spear (by their grip), not the knife or the tools', () => {
    const ids = long.map((d) => d.id).sort();
    for (const id of ['core.katana', 'core.scimitar', 'core.baseball_bat', 'core.battle_axe', 'core.spear']) expect(ids).toContain(id);
    for (const id of ['core.knife', 'core.builder', 'core.space_shield', 'core.medkit', 'core.rifle']) expect(ids).not.toContain(id);
  });

  it('keep the third-person hold, and are held two-handed in first person', () => {
    for (const d of long) {
      const fp = firstPersonHold(d, 0.5);
      expect(fp.grip).toEqual(d.view.hold.grip);
      expect(fp.support).toBeDefined();
      expect(fp.style).toBe('long');
      // The support hand behind a blade's grip (toward the pommel), ahead of a polearm's.
      expect(fp.support![2]).toBeLessThan(d.view.hold.grip[2]);
      expect(firstPersonHold(d, d.view.hold.grip[2] + POLE_REACH + 0.5).support![2]).toBeGreaterThan(d.view.hold.grip[2]);
    }
    // Kept inside the pommel: a short handle behind the grip moves the support hand in (1.5 cm from the end).
    const axe = CORE_WEAPONS['core.battle_axe']!;
    const g = axe.view.hold.grip[2];
    expect(firstPersonHold(axe, 0.4, g - 0.2).support![2]).toBeCloseTo(g - 0.1, 9);
    expect(firstPersonHold(axe, 0.4, g - 0.08).support![2]).toBeCloseTo(g - 0.065, 9);
    const knife = CORE_WEAPONS['core.knife']!;
    expect(firstPersonHold(knife)).toBe(knife.view.hold);
  });

  it('show both hand points inside the view at rest, whatever their length', () => {
    for (const d of long) {
      for (const reach of [0.4, 0.6, 0.9, 1.5, 2]) {
        const tipZ = d.view.hold.grip[2] + reach;
        const p = meleePlacement(d, { tipZ });
        const hold = firstPersonHold(d, tipZ);
        for (const point of [hold.grip, hold.support!]) {
          const s = ndc(placedPoint(p, point));
          expect(s.z, `${d.id} ${reach}`).toBeGreaterThan(0.2);
          expect(Math.abs(s.x), `${d.id} ${reach} x`).toBeLessThan(0.8);
          expect(s.y, `${d.id} ${reach} y`).toBeGreaterThan(-0.8);
          expect(s.y, `${d.id} ${reach} y`).toBeLessThan(0);
        }
        // The grip sits in the lower right (the middle of the view clear for the crosshair).
        const g = ndc(placedPoint(p, hold.grip));
        expect(g.x).toBeGreaterThan(0.15);
        // A blade stands raised (its far end above the grip), a polearm points ahead.
        const tip = placedPoint(p, [0, 0, tipZ]);
        const grip = placedPoint(p, hold.grip);
        if (isPolearm(d, tipZ)) expect(tip[2] - grip[2]).toBeGreaterThan(reach * 0.9);
        else expect(tip[1] - grip[1]).toBeGreaterThan(reach * 0.5);
      }
    }
  });

  it('swing from rest and back, and draw up from below', () => {
    for (const d of long) {
      const rest = meleePlacement(d, { tipZ: 0.5 });
      expect(meleePlacement(d, { tipZ: 0.5, swing: 0 })).toEqual(rest);
      const end = meleePlacement(d, { tipZ: 0.5, swing: 1 });
      for (const k of ['x', 'y', 'z', 'pitch', 'yaw', 'roll'] as const) expect(end[k]).toBeCloseTo(rest[k], 9);
      // Mid-swing the weapon has moved well away from rest.
      const mid = meleePlacement(d, { tipZ: 0.5, swing: 0.45 });
      expect(Math.abs(mid.yaw - rest.yaw) + Math.abs(mid.pitch - rest.pitch)).toBeGreaterThan(0.5);
      // Just switched to: the grip starts lower than at rest.
      const drawn = meleePlacement(d, { tipZ: 0.5, raise: 1 });
      expect(placedPoint(drawn, d.view.hold.grip)[1]).toBeLessThan(placedPoint(rest, d.view.hold.grip)[1] - 0.2);
      expect(swingSeconds(d)).toBeGreaterThan(0.2);
      expect(swingSeconds(d)).toBeLessThanOrEqual(0.5);
    }
  });

  it('come level to the aim when the barrel goes off (the Battle Axe)', () => {
    const axe = CORE_WEAPONS['core.battle_axe']!;
    const p = meleePlacement(axe, { tipZ: 0.4, level: 1 });
    expect(p.pitch).toBe(0);
    expect(p.yaw).toBe(0);
    expect(p.roll).toBe(0);
  });
});
