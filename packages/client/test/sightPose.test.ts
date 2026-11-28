import { describe, expect, it } from 'vitest';
import { CORE_WEAPONS, getWeapon } from '@tiletrigger/shared';
import { SIGHT_EXCLUDED, SIGHT_FITS } from '@tiletrigger/shared/sightFit';
import { WEAPON_OPTICS } from '@tiletrigger/shared/optics';
import { hasGlass, opticOf } from '../src/game/optics.ts';
import { HANDS_UNDER_AIM_DEG, SIGHT_TOLERANCE_DEG, STOCK_AHEAD, UNFITTED_OVER, aimPlacement, handsUnderAim, blendPlacement, offAxis, placed, sightError, sightPlacement, unfittedPlacement } from '../src/game/sightPose.ts';

/**
 * The weapons that aim down their own drawn sights, by name. A new gun joins this list when the sight fit finds its
 * sights (tools/content/sight-fit.mjs), after a look at it on the sight sheet (`?mode=sights`).
 */
// The Flare Gun, Grenade Launcher and Swarm Launcher's new models have sights of their own: fitted (weapon replacements batch 3).
// The Oil Slicker's and Flamethrower's new models too, and the Rocket Launcher from a line beside its tube (batch 4).
const FITTED = ['core.amarillo', 'core.auto_shotgun', 'core.burst_rifle', 'core.compact_carbine', 'core.disc_launcher', 'core.flamethrower', 'core.flare_gun', 'core.flintlock_pistol', 'core.freeze_ray', 'core.gilded_pistol', 'core.goo_gun', 'core.hand_cannon', 'core.laser_blaster', 'core.launcher', 'core.machine_pistol', 'core.nailgun', 'core.oil_slicker', 'core.pistol', 'core.pulse_pistol', 'core.revolver', 'core.rifle', 'core.rockets', 'core.runebreaker', 'core.shotgun', 'core.smg', 'core.swarm', 'core.woodland_smg'];
/** Of those, the ones whose fit was corrected by hand (content/sight-fit.json `corrections`, each with its reason). */
// Hand corrections (content/sight-fit.json): the obsidian pump's leaning front post, the Glock's nubs on its slide rail (2026-11-28).
// The heavy rocket launcher's AT4-style line beside its tube (2026-11-28, batch 4).
// The ricochet launcher's flip-up aperture (batch 4).
// The goo gun's nubs, level over its stock (batch 4).
const CORRECTED: string[] = ['core.auto_shotgun', 'core.disc_launcher', 'core.goo_gun', 'core.pistol', 'core.rockets'];
/**
 * The hand-held guns that aim without a fit, by name: their models have no usable sights (content/sight-fit.json
 * `excluded`, each with its reason), so they keep the placement every gun had before.
 */
const EXCLUDED_BY_HAND = ['core.arc_caster', 'core.arena_disc', 'core.blast_rockets', 'core.blaster_x42', 'core.bubble_blaster', 'core.desert_carbine', 'core.flak', 'core.guided', 'core.heart_taser', 'core.hornet', 'core.laser_rifle', 'core.lmg', 'core.plasma', 'core.sawed_off', 'core.singularity', 'core.twin_rifle'];
/** The rest never aim down sights in the hand (mounted, melee and tools), or aim through a scope or an optic. */
const BY_NATURE = ['core.baseball_bat', 'core.battle_axe', 'core.battle_rifle', 'core.builder', 'core.crossbow', 'core.grapple', 'core.katana', 'core.knife', 'core.lever_action', 'core.marksman', 'core.medi_beam', 'core.medkit', 'core.mount_mg', 'core.mount_rockets', 'core.nova6', 'core.railgun', 'core.scimitar', 'core.sentry_arc', 'core.sentry_gun', 'core.sniper', 'core.space_shield', 'core.speeder_guns', 'core.spear', 'core.tank_cannon'];

describe('sights that line up (docs/GUNPLAY_SPEC.md §15)', () => {
  it('every weapon has a sight fit or a stated reason for none', () => {
    for (const id of Object.keys(CORE_WEAPONS)) {
      const fitted = id in SIGHT_FITS;
      const excluded = id in SIGHT_EXCLUDED;
      expect(fitted || excluded, `${id} has no sight fit and no exclusion: run node tools/content/sight-fit.mjs, look at it on the sight sheet (?mode=sights), and give it a correction or an exclusion with its reason in content/sight-fit.json if the tool asks (docs/GUNPLAY_SPEC.md §15, "Adding a gun")`).toBe(true);
      expect(fitted && excluded, `${id} is both fitted and excluded`).toBe(false);
    }
    for (const id of [...Object.keys(SIGHT_FITS), ...Object.keys(SIGHT_EXCLUDED)]) expect(CORE_WEAPONS[id], `the sight table names ${id}, which is not a weapon`).toBeDefined();
  });

  it('the fitted, hand-corrected and excluded weapons are the ones named here', () => {
    // A gun cannot slip in or out unseen: a change to either list is made here too, by name.
    expect(Object.keys(SIGHT_FITS).sort(), 'the weapons with a sight fit: add a new one to FITTED after looking at its picture').toEqual(FITTED);
    expect(Object.keys(SIGHT_FITS).filter((id) => SIGHT_FITS[id]!.corrected).sort(), 'the hand-corrected fits').toEqual(CORRECTED);
    expect(Object.keys(SIGHT_EXCLUDED).sort(), 'the weapons without a sight fit').toEqual([...EXCLUDED_BY_HAND, ...BY_NATURE].sort());
    for (const id of EXCLUDED_BY_HAND) expect(SIGHT_EXCLUDED[id]!.length, `${id}'s reason`).toBeGreaterThan(12);
    for (const id of BY_NATURE) {
      const def = getWeapon(id);
      expect(def.slot === 0 || def.kind === 'melee' || !!def.view.zoomFov || !!def.view.optic, `${id} aims down sights in the hand, so it needs a fit or a reason of its own`).toBe(true);
    }
  });

  it(`every fitted weapon's sights lie within ${SIGHT_TOLERANCE_DEG}° of the aim, the eye on its eye point`, () => {
    for (const id of FITTED) {
      const fit = SIGHT_FITS[id]!;
      // Aimed down its iron sights (a gun whose own optic is a glass, the Woodland SMG's red dot, offers them too).
      const at = aimPlacement(getWeapon(id), { sightTop: 0, stockZ: 0 }, true, opticOf(getWeapon(id), 'irons'));
      // The eye point is the camera.
      const eye = placed(fit.eye, at);
      expect(Math.hypot(...eye), `${id}: the eye point`).toBeLessThan(1e-4);
      // The rear point and the front sight's top are on the view axis, the rear nearer.
      const rear = placed(fit.rear, at);
      const front = placed(fit.front, at);
      expect(offAxis(rear), `${id}: the rear sight`).toBeLessThan(SIGHT_TOLERANCE_DEG);
      expect(offAxis(front), `${id}: the front sight`).toBeLessThan(SIGHT_TOLERANCE_DEG);
      expect(sightError(fit, at), id).toBeLessThan(SIGHT_TOLERANCE_DEG);
      expect(rear[2], `${id}: the rear sight is beyond the camera's near plane`).toBeGreaterThan(0.2);
      expect(front[2], id).toBeGreaterThan(rear[2] + 0.05);
      // The gun stays roughly along the view: the sight line is within 4° of the barrel.
      expect(Math.abs(at.pitch) + Math.abs(at.yaw), id).toBeLessThan((4 * Math.PI) / 180);
    }
  });

  it('the hands stay out of the sight picture: each hand\'s point far enough under the aim, for every optic a gun may carry', () => {
    // Owner, 2026-11-22: aiming the Flintlock Pistol, its two fists filled the view (their points 9-10° under the aim).
    // A gun aimed down its own drawn sights or through a glass on it, with each optic it may carry.
    const bad: string[] = [];
    let checked = 0;
    for (const def of Object.values(CORE_WEAPONS)) {
      const hold = def.view.hold;
      if (!hold || hold.style === 'melee' || def.slot === 0 || def.kind === 'melee' || def.view.zoomFov || def.view.optic) continue;
      const kinds = WEAPON_OPTICS[def.id]?.allowed ?? [];
      for (const kind of kinds.length ? kinds : [null]) {
        const optic = kind ? opticOf(def, kind) : null;
        const irons = !!optic && optic.kind.housing === 'none';
        if (!(irons && SIGHT_FITS[def.id]) && !hasGlass(optic)) continue;
        // The stock's end is behind every point the hold names: the nearest the gun can sit (the most lenient).
        const stockZ = Math.min(hold.grip[2], hold.support?.[2] ?? 0, hold.shoulder?.[2] ?? 0);
        const at = aimPlacement(def, { sightTop: 0, stockZ }, true, optic);
        const under = handsUnderAim(def, at);
        const need = HANDS_UNDER_AIM_DEG[hold.style];
        checked++;
        for (const hand of ['grip', 'support'] as const) {
          const a = under[hand];
          if (a !== null && a < need[hand]) bad.push(`${def.id} (${kind ?? 'no optic'}): its ${hand} hand ${a.toFixed(1)}° under the aim, under ${need[hand]}°`);
        }
      }
    }
    expect(checked).toBeGreaterThan(40);
    expect(bad, 'a hand drawn in the sight picture: move the hold point down the grip (content/weapons, view.hold) or check the fit on the sight sheet (?mode=sights)').toEqual([]);
  });

  it('before the fit the same sights were off the aim by more than the tolerance on every gun', () => {
    for (const id of FITTED) {
      const def = getWeapon(id);
      const fit = SIGHT_FITS[id]!;
      // Where view.ts put the gun before: the top of its bounds (at least as high as its sights) just under the eye line.
      const top = Math.max(fit.rear[1], fit.front[1]);
      const before = unfittedPlacement(def, { sightTop: top, stockZ: -0.1 });
      expect(sightError(fit, before), id).toBeGreaterThan(SIGHT_TOLERANCE_DEG * 2);
    }
  });

  it('a gun without a fit keeps the placement it had: centred, its top under the eye line, its stock out of view', () => {
    const def = getWeapon('core.lmg');
    const bounds = { sightTop: 0.185, stockZ: -0.45 };
    const at = aimPlacement(def, bounds);
    expect(at).toEqual({ x: 0, y: -(0.185 + UNFITTED_OVER), z: Math.max(def.view.viewOffset[2], STOCK_AHEAD + 0.45), pitch: 0, yaw: 0 });
    // And `fitted: false` gives a fitted gun that placement too (the sight sheet's "before").
    expect(aimPlacement(getWeapon('core.rifle'), bounds, false)).toEqual(unfittedPlacement(getWeapon('core.rifle'), bounds));
  });

  it('a gun with an optic brings its eyepiece to the eye, as before', () => {
    const def = getWeapon('core.battle_rifle');
    const optic = def.view.optic!;
    const at = aimPlacement(def, { sightTop: 0.17, stockZ: -0.475 });
    expect(placed(optic.eye, at)).toEqual([0, 0, optic.relief ?? 0.12]);
  });

  it('the hip placement is the weapon\'s own, and the aim eases from it', () => {
    const def = getWeapon('core.rifle');
    const aim = sightPlacement(SIGHT_FITS['core.rifle']!);
    const [vx, vy, vz] = def.view.viewOffset;
    const hip = blendPlacement(def, aim, 0);
    expect([hip.x, hip.y, hip.z]).toEqual([vx, vy, vz]);
    expect(Math.abs(hip.pitch) + Math.abs(hip.yaw)).toBe(0);
    const full = blendPlacement(def, aim, 1);
    for (const k of ['x', 'y', 'z', 'pitch', 'yaw'] as const) expect(full[k]).toBeCloseTo(aim[k], 12);
    const half = blendPlacement(def, aim, 0.5);
    expect(half.x).toBeCloseTo((vx + aim.x) / 2);
    expect(half.pitch).toBeCloseTo(aim.pitch / 2);
  });
});
