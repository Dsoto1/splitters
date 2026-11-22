import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CORE_WEAPONS, getWeapon, gunplayOf, holdoverMarks, flightTo } from '@tiletrigger/shared';
import { OPTIC_KINDS, OPTIC_NONE, WEAPON_OPTICS, type OpticKindId } from '@tiletrigger/shared/optics';
import { SIGHT_FITS } from '@tiletrigger/shared/sightFit';
import { GLASS_SHARE, HIP_FOV, IRONS_DEPTH, IRONS_MAX, MARK_COLOUR, MARK_GAIN, MARK_GAIN_CALM, PICTURE_MAX, RING_TICK, aimedFov, builtHousing, eyepieceOf, glassCentre, glassHalf, hasGlass, onMark, opticChoices, opticFor, opticNone, opticOf, opticsVersion, pictureScale, setRosterOptics } from '../src/game/optics.ts';
import { ADS_FOV, SIGHT_TOLERANCE_DEG, aimPlacement, offAxis, placed, sightPicture } from '../src/game/sightPose.ts';
import { LENS_SHARE, opticFrame } from '../src/game/opticView.ts';
import { HOLDOVER_DISTANCES, holdoverFor } from '../src/game/holdover.ts';

/**
 * Which gun carries which optic, by name (content/optics.json; docs/GUNPLAY_SPEC.md §15, "Optics by gun"). A change is
 * made here too, after a look at the gun on the sight sheet (`?mode=sights`).
 */
const CARRIES: Record<OpticKindId, string[]> = {
  irons: ['core.amarillo', 'core.auto_shotgun', 'core.burst_rifle', 'core.compact_carbine', 'core.flintlock_pistol', 'core.freeze_ray', 'core.goo_gun', 'core.hand_cannon', 'core.laser_blaster', 'core.machine_pistol', 'core.nailgun', 'core.pistol', 'core.pulse_pistol', 'core.revolver', 'core.rifle', 'core.runebreaker', 'core.shotgun', 'core.smg'],
  reddot: ['core.bubble_blaster', 'core.laser_rifle', 'core.sawed_off'],
  holo: ['core.arc_caster', 'core.arena_disc', 'core.disc_launcher', 'core.flak', 'core.plasma'],
  scope: ['core.battle_rifle', 'core.crossbow', 'core.lever_action', 'core.marksman', 'core.nova6'],
  sniper: ['core.railgun', 'core.sniper'],
  // Built for the loadout's choice (step 4): no gun carries it by default.
  x2: [],
};
/**
 * The choice each gun offers in the loadout (docs/GUNPLAY_SPEC.md §15, "Optic choice"), its default first. Guns not named
 * offer none: snipers, the guns with a scope or a sight box of their own, the flintlock, and the guns with no optic.
 */
const CHOICES: Record<string, OpticKindId[]> = {
  'core.rifle': ['irons', 'reddot', 'holo', 'x2'],
  'core.smg': ['irons', 'reddot', 'holo', 'x2'],
  'core.compact_carbine': ['irons', 'reddot', 'holo', 'x2'],
  'core.amarillo': ['irons', 'holo', 'x2'],
  'core.burst_rifle': ['irons', 'x2'],
  'core.laser_rifle': ['reddot', 'holo', 'x2'],
  'core.shotgun': ['irons', 'reddot', 'holo'],
  'core.auto_shotgun': ['irons', 'reddot', 'holo'],
  'core.runebreaker': ['irons', 'reddot', 'holo'],
  'core.nailgun': ['irons', 'reddot', 'holo'],
  'core.freeze_ray': ['irons', 'reddot', 'holo'],
  'core.goo_gun': ['irons', 'reddot', 'holo'],
  'core.pistol': ['irons', 'reddot'],
  'core.revolver': ['irons', 'reddot'],
  'core.hand_cannon': ['irons', 'reddot'],
  'core.pulse_pistol': ['irons', 'reddot'],
  'core.machine_pistol': ['irons', 'reddot'],
  'core.laser_blaster': ['irons', 'reddot'],
  'core.bubble_blaster': ['reddot', 'holo'],
  'core.arc_caster': ['holo', 'reddot'],
  'core.flak': ['holo', 'reddot'],
  'core.disc_launcher': ['holo', 'reddot'],
  'core.arena_disc': ['holo', 'reddot'],
};
/** The hand-held guns that keep the aim they had (no sights, no optic), each with its reason in content/optics.json `none`. */
const KEEP_THEIR_AIM = ['core.blast_rockets', 'core.blaster_x42', 'core.desert_carbine', 'core.flamethrower', 'core.flare_gun', 'core.gilded_pistol', 'core.guided', 'core.heart_taser', 'core.hornet', 'core.launcher', 'core.lmg', 'core.oil_slicker', 'core.rockets', 'core.singularity', 'core.swarm', 'core.twin_rifle', 'core.woodland_smg'];
/**
 * Every weapon's aimed magnification over the hip view. A zoom is a feel and balance number: the optics pass changed
 * none of them (the sights' 0.72 of the hip field of view is 1.52x), and a change here is the owner's to approve.
 */
const SIGHTS = Math.tan(1.35 / 2) / Math.tan((1.35 * 0.72) / 2);
const ZOOM: Record<string, number> = {
  ...Object.fromEntries([...CARRIES.irons, ...CARRIES.reddot, ...CARRIES.holo].map((id) => [id, SIGHTS])),
  'core.battle_rifle': 3.5,
  'core.marksman': Math.tan(1.35 / 2) / Math.tan(0.7 / 2),
  // The weapons intake of 2026-11-18's scopes (new guns: their zoom is their own, not a change).
  'core.nova6': Math.tan(1.35 / 2) / Math.tan(0.65 / 2),
  'core.lever_action': Math.tan(1.35 / 2) / Math.tan(0.6 / 2),
  'core.crossbow': Math.tan(1.35 / 2) / Math.tan(0.7 / 2),
  'core.sniper': Math.tan(1.35 / 2) / Math.tan(0.4 / 2),
  'core.railgun': Math.tan(1.35 / 2) / Math.tan(0.5 / 2),
};
const deg = (tan: number) => (Math.atan(tan) * 180) / Math.PI;
/** A gun's bounds as view.ts measures them, near enough for the placement's depth (the test has no models). */
const BOUNDS = { sightTop: 0.15, stockZ: -0.3 };

describe('optics by gun (docs/GUNPLAY_SPEC.md §15)', () => {
  it('every weapon carries an optic or has a stated reason for none', () => {
    for (const def of Object.values(CORE_WEAPONS)) {
      const has = def.id in WEAPON_OPTICS;
      const none = def.id in OPTIC_NONE;
      expect(has || none, `${def.id} (${def.displayName}) has no optic and no reason for none: give it one in content/optics.json ("weapons": { "default": kind, "allowed": [kinds] }, or a reason under "none"), run node tools/content/optics.mjs, look at it on the sight sheet (?mode=sights), then name it in this test (docs/GUNPLAY_SPEC.md §15, "Optics by gun")`).toBe(true);
      expect(has && none, `${def.id} both carries an optic and has a reason for none`).toBe(false);
      if (none) expect(opticOf(def), def.id).toBeNull();
      else expect(opticNone(def), def.id).toBeUndefined();
    }
    for (const id of [...Object.keys(WEAPON_OPTICS), ...Object.keys(OPTIC_NONE)]) expect(CORE_WEAPONS[id], `the optics table names ${id}, which is not a weapon`).toBeDefined();
  });

  it('the guns carry the optics named here, and each allows its default', () => {
    for (const kind of Object.keys(OPTIC_KINDS) as OpticKindId[]) {
      expect(Object.keys(WEAPON_OPTICS).filter((id) => WEAPON_OPTICS[id]!.default === kind).sort(), `the guns that carry a ${kind}`).toEqual(CARRIES[kind]);
    }
    for (const [id, w] of Object.entries(WEAPON_OPTICS)) {
      expect(w.allowed, id).toContain(w.default);
      for (const k of w.allowed) expect(OPTIC_KINDS[k], `${id}: ${k}`).toBeDefined();
    }
    const byNature = Object.keys(OPTIC_NONE).filter((id) => getWeapon(id).slot === 0 || getWeapon(id).kind === 'melee');
    expect(Object.keys(OPTIC_NONE).filter((id) => !byNature.includes(id)).sort(), 'the hand-held guns without an optic').toEqual(KEEP_THEIR_AIM);
    for (const id of KEEP_THEIR_AIM) expect(OPTIC_NONE[id]!.length, `${id}'s reason`).toBeGreaterThan(12);
  });

  it('each kind is drawn the way its gun allows', () => {
    for (const [id, w] of Object.entries(WEAPON_OPTICS)) {
      const def = getWeapon(id);
      for (const k of w.allowed) {
        const kind = OPTIC_KINDS[k];
        if (kind.housing === 'none') expect(SIGHT_FITS[id], `${id}: iron sights need a sight fit`).toBeDefined();
        if (kind.housing === 'overlay') expect(def.view.zoomFov, `${id}: a scope overlay needs view.zoomFov`).toBeGreaterThan(0);
        if (kind.housing === 'model') expect(!!def.view.optic || !!def.view.zoomFov, `${id}: a 2-3x optic needs the model's own (view.optic) or a scope (view.zoomFov)`).toBe(true);
        if (kind.housing === 'tube' || kind.housing === 'frame' || kind.housing === 'magtube') {
          expect(!!w.mount || !!w.window, `${id}: a ${k} needs a mount or the model's own window`).toBe(true);
          expect(def.view.zoomFov ?? def.view.optic, id).toBeUndefined();
        }
      }
      // The model's own optic draws the reticle its kind names.
      if (def.view.optic) expect(def.view.optic.reticle, id).toBe(OPTIC_KINDS[w.default].reticle);
    }
  });

  it('no gun\'s aimed zoom changed: each optic matches the zoom its gun already had', () => {
    expect(readFileSync(new URL('../src/game/view.ts', import.meta.url), 'utf8'), 'view.ts DEFAULT_FOV is optics.ts HIP_FOV').toContain(`export const DEFAULT_FOV = ${HIP_FOV};`);
    expect(ADS_FOV).toBe(0.72);
    expect(Object.keys(ZOOM).sort()).toEqual(Object.keys(WEAPON_OPTICS).sort());
    for (const [id, zoom] of Object.entries(ZOOM)) {
      const def = getWeapon(id);
      const o = opticOf(def)!;
      const fov = aimedFov(o)!;
      expect(Math.tan(HIP_FOV / 2) / Math.tan(fov / 2), `${id}'s aimed magnification`).toBeCloseTo(zoom, 2);
      // And the view the game draws is the weapon's own: its scope's field of view, its optic's power, or the sights'.
      if (def.view.zoomFov) expect(fov, id).toBeCloseTo(def.view.zoomFov, 2);
      else if (def.view.optic) expect(opticFrame(def.view.optic, HIP_FOV * ADS_FOV, HIP_FOV, 1).mag, id).toBeCloseTo(zoom, 6);
      else expect(fov, id).toBeCloseTo(HIP_FOV * ADS_FOV, 9);
      if (o.kind.mag) {
        expect(zoom, `${id}: inside a ${o.id}'s range`).toBeGreaterThanOrEqual(o.kind.mag[0]);
        expect(zoom, id).toBeLessThanOrEqual(o.kind.mag[1]);
      }
    }
  });

  it(`a glass's mark is on the aim (within ${SIGHT_TOLERANCE_DEG}°), inside its window, at a usable size`, () => {
    const glassed = Object.keys(WEAPON_OPTICS).filter((id) => WEAPON_OPTICS[id]!.allowed.some((k) => OPTIC_KINDS[k].housing === 'tube' || OPTIC_KINDS[k].housing === 'frame'));
    expect(glassed.sort()).toEqual([...new Set([...CARRIES.reddot, ...CARRIES.holo, ...Object.keys(CHOICES).filter((id) => CHOICES[id]!.some((k) => k === 'reddot' || k === 'holo'))])].sort());
    for (const id of glassed) {
      const def = getWeapon(id);
      for (const k of WEAPON_OPTICS[id]!.allowed) {
        if (OPTIC_KINDS[k].housing !== 'tube' && OPTIC_KINDS[k].housing !== 'frame') continue;
        const o = opticOf(def, k)!;
        expect(hasGlass(o), `${id} ${k}`).toBe(true);
        const at = aimPlacement(def, BOUNDS, true, o);
        // The gun is level along the view and the glass's middle is on the view's axis: the aim passes through it.
        expect(Math.abs(at.pitch) + Math.abs(at.yaw), id).toBe(0);
        const c = placed(glassCentre(o), at);
        expect(offAxis(c), `${id} ${k}: the glass's middle off the aim`).toBeLessThan(SIGHT_TOLERANCE_DEG);
        expect(c[2], `${id} ${k}: the glass is beyond the camera's near plane`).toBeGreaterThan(0.15);
        // The mark is drawn about the view's axis itself (the shader's own test): its middle is the aim, and it is
        // the same either side of it, so its centre is 0° off.
        const kind = o.kind;
        expect(onMark(kind, [0, 0]), `${id} ${k}: the aim point is on the mark`).toBe(true);
        const reach = kind.reticle === 'ring' ? kind.mark!.ring! * RING_TICK : kind.mark!.dot;
        for (const t of [[reach * 0.99, 0], [0, reach * 0.99], [kind.mark!.dot * 0.7, kind.mark!.dot * 0.7]] as const) {
          expect(onMark(kind, t), `${id} ${k}`).toBe(onMark(kind, [-t[0], -t[1]]));
          expect(onMark(kind, [t[0], -t[1]]), `${id} ${k}`).toBe(onMark(kind, [-t[0], t[1]]));
        }
        expect(onMark(kind, [reach * 1.2, 0]), `${id} ${k}: nothing past the mark's reach`).toBe(false);
        expect(deg(kind.mark!.dot), `${id} ${k}: a dot under a quarter of a degree`).toBeLessThan(0.25);
        // A red dot reads at 720p: five to six pixels across at the sights' field of view, the same share of any screen.
        if (kind.reticle === 'dot') expect((2 * kind.mark!.dot) / ((2 * Math.tan((HIP_FOV * ADS_FOV) / 2)) / 720), `${id} ${k}: the dot's width in pixels at 720p`).toBeGreaterThan(5);
        // The whole mark shows inside the window at full aim, as large as the sight picture draws it.
        const picture = pictureScale(o, c[2], HIP_FOV * ADS_FOV);
        expect(picture, `${id} ${k}`).toBeGreaterThanOrEqual(1);
        expect(picture, `${id} ${k}`).toBeLessThanOrEqual(PICTURE_MAX);
        const [hw, hh] = glassHalf(o);
        expect((Math.min(hw, hh) * picture) / c[2], `${id} ${k}: the mark fits its window`).toBeGreaterThan(reach * 1.3);
        const share = (hh * picture) / c[2] / Math.tan((HIP_FOV * ADS_FOV) / 2);
        expect(share, `${id} ${k}: the window's half-height as a share of the screen's`).toBeGreaterThan(0.1);
        expect(share, `${id} ${k}`).toBeLessThanOrEqual(GLASS_SHARE + 1e-9);
      }
    }
  });

  it('the sight picture: long guns\' irons are drawn larger about the aim, handguns\' and scopes plainly, the sights still on the aim', () => {
    for (const id of CARRIES.irons) {
      const def = getWeapon(id);
      const at = aimPlacement(def, BOUNDS);
      const rear = placed(SIGHT_FITS[id]!.rear, at);
      const k = sightPicture(def, at);
      expect(k, id).toBeGreaterThanOrEqual(1);
      expect(k, id).toBeLessThanOrEqual(IRONS_MAX);
      expect(k, id).toBeCloseTo(Math.max(1, Math.min(IRONS_MAX, rear[2] / IRONS_DEPTH)), 9);
      // Drawn larger across the view axis only: a point on the axis stays on it, so the sights stay on the aim.
      expect(offAxis([rear[0] * k, rear[1] * k, rear[2]]), id).toBeLessThan(SIGHT_TOLERANCE_DEG);
    }
    // Handguns are near enough already (all but unchanged); rifles, shotguns and the SMG are not.
    for (const id of ['core.pistol', 'core.revolver', 'core.hand_cannon', 'core.pulse_pistol']) expect(sightPicture(getWeapon(id), aimPlacement(getWeapon(id), BOUNDS)), id).toBeLessThan(1.12);
    for (const id of ['core.rifle', 'core.burst_rifle', 'core.smg', 'core.shotgun']) expect(sightPicture(getWeapon(id), aimPlacement(getWeapon(id), BOUNDS)), id).toBeGreaterThan(1.2);
    for (const id of [...CARRIES.scope, ...CARRIES.sniper, ...KEEP_THEIR_AIM]) expect(sightPicture(getWeapon(id), aimPlacement(getWeapon(id), BOUNDS)), id).toBe(1);
  });

  it('iron sights and the guns without an optic draw no glass', () => {
    for (const id of [...CARRIES.irons, ...CARRIES.scope, ...CARRIES.sniper]) expect(hasGlass(opticOf(getWeapon(id))), id).toBe(false);
    expect(pictureScale(opticOf(getWeapon('core.rifle')), 0.5, 1)).toBe(1);
    expect(pictureScale(null, 0.5, 1)).toBe(1);
  });

  it('a mark is steady and capped: under full brightness, dimmer with Reduce flashing, a red that High\'s bloom leaves alone', () => {
    expect(MARK_GAIN).toBeLessThan(1);
    expect(MARK_GAIN_CALM).toBeLessThan(MARK_GAIN);
    for (const c of MARK_COLOUR) expect(c).toBeLessThanOrEqual(1);
    // Luma under the bloom threshold (atmosphere.ts: 0.82).
    expect(0.2126 * MARK_COLOUR[0] + 0.7152 * MARK_COLOUR[1] + 0.0722 * MARK_COLOUR[2]).toBeLessThan(0.5);
  });

  it('holdover marks match the ballistics at each magnified optic\'s field of view, at both zooms', () => {
    const magnified = [...CARRIES.scope, ...CARRIES.sniper];
    let marked = 0;
    for (const id of magnified) {
      const def = getWeapon(id);
      const b = gunplayOf(def).ballistic;
      for (const rules of [{}, { ballistics: 'arcade' as const }, { ballistics: 'advanced' as const }]) {
        // The half-angle the reticle's edge (100 units) spans: a scope's own half field of view (a 16:9 screen: its
        // short side), at its first and second zoom; a model optic's world half-angle over its glass's share.
        const spans = def.view.zoomFov ? [Math.tan(def.view.zoomFov / 2), Math.tan((def.view.zoomFov * 0.45) / 2)] : [Math.tan(opticFrame(def.view.optic!, HIP_FOV * ADS_FOV, HIP_FOV, 1).worldFov / 2) * opticFrame(def.view.optic!, HIP_FOV * ADS_FOV, HIP_FOV, 1).lens];
        for (const tanHalf of spans) {
          const marks = holdoverFor(def, rules, tanHalf);
          if (!b) {
            expect(marks, `${id}: no drop, no marks`).toEqual([]);
            continue;
          }
          const drops = holdoverMarks(b, rules, HOLDOVER_DISTANCES.filter((d) => d <= def.range));
          for (const m of marks) {
            marked++;
            const dist = Number(m.label) * 100;
            const drop = drops.find((d) => d.dist === dist)!;
            expect(drop, `${id}: a mark for ${dist} m`).toBeDefined();
            // On the reticle, the mark sits the drop's angle below the centre at this field of view...
            expect(m.y, `${id} ${dist} m`).toBeCloseTo((100 * Math.tan(drop.angle)) / tanHalf, 9);
            // ...and that angle is the round's own fall at that distance (the sim's flight).
            expect(Math.tan(drop.angle), `${id} ${dist} m`).toBeCloseTo(flightTo(b, dist, rules).drop / dist, 9);
            expect(m.y).toBeGreaterThan(0);
            expect(m.y).toBeLessThanOrEqual(60);
          }
        }
      }
    }
    expect(marked, 'some scope shows marks').toBeGreaterThan(8);
    // The optic's glass is the share of the screen the frame says.
    expect(opticFrame(getWeapon('core.battle_rifle').view.optic!, HIP_FOV * ADS_FOV, HIP_FOV, 1).lens).toBeCloseTo(LENS_SHARE, 9);
  });
});

describe('optic choice in the loadout (docs/GUNPLAY_SPEC.md §15, "Optic choice")', () => {
  it('each gun offers the choice named here, its default first; the rest offer none', () => {
    const offered = Object.fromEntries(Object.values(CORE_WEAPONS).map((d) => [d.id, opticChoices(d).map((c) => c.id)] as const).filter(([, c]) => c.length));
    expect(offered).toEqual(CHOICES);
    for (const [id, kinds] of Object.entries(CHOICES)) expect(kinds[0], `${id}: its default first`).toBe(WEAPON_OPTICS[id]!.default);
    // Snipers and the guns with a scope of their own keep it: a pick for them is ignored.
    for (const id of [...CARRIES.scope, ...CARRIES.sniper, 'core.plasma', 'core.flintlock_pistol']) {
      expect(opticChoices(getWeapon(id)), id).toEqual([]);
      for (const k of ['reddot', 'holo', 'x2', 'irons']) expect(opticOf(getWeapon(id), k)!.id, `${id} given ${k}`).toBe(WEAPON_OPTICS[id]!.default);
    }
    // Anything not allowed is the default; nonsense too.
    expect(opticOf(getWeapon('core.burst_rifle'), 'reddot')!.id).toBe('irons');
    expect(opticOf(getWeapon('core.rifle'), 'banana')!.id).toBe('irons');
  });

  it('the 2x optic: a tube on the gun\'s top, looked through at twice the hip view, the eyepiece on the aim', () => {
    const x2 = OPTIC_KINDS.x2;
    expect(x2.housing).toBe('magtube');
    expect(x2.reticle).toBe('chevron');
    expect(x2.power).toBe(2);
    for (const id of Object.keys(CHOICES).filter((i) => CHOICES[i]!.includes('x2'))) {
      const def = getWeapon(id);
      const o = opticOf(def, 'x2')!;
      expect(o.mag, id).toBe(2);
      expect(hasGlass(o), `${id}: no glass of its own (the HUD draws its reticle)`).toBe(false);
      expect(builtHousing(o), `${id}: built on its mount`).toBe(true);
      const eye = eyepieceOf(def, o)!;
      expect(eye, id).toBeDefined();
      // The eyepiece is the tube's rear end, on its glass's line, at the usual relief in front of the eye.
      const at = aimPlacement(def, BOUNDS, true, o);
      const e = placed(eye.eye, at);
      expect(offAxis([e[0], e[1], e[2] || 1e-9]), id).toBeLessThan(SIGHT_TOLERANCE_DEG);
      expect(e[2], id).toBeCloseTo(eye.relief!, 9);
      expect(sightPicture(def, at, o), `${id}: the optic's own frame, not the sight picture`).toBe(1);
      // Through it the world is twice the hip view, and its glass fills the share every model tube's does.
      const f = opticFrame(eye, HIP_FOV * ADS_FOV, HIP_FOV, 1);
      expect(f.mag, id).toBeCloseTo(2, 9);
      expect(f.lens, id).toBeCloseTo(LENS_SHARE, 9);
      // Its own iron sights or red dot otherwise: no eyepiece.
      expect(eyepieceOf(def, opticOf(def)), id).toBeUndefined();
    }
  });

  it('holdover marks on the 2x optic follow the round, as on every magnified optic', () => {
    const def = getWeapon('core.rifle');
    const o = opticOf(def, 'x2')!;
    const f = opticFrame(eyepieceOf(def, o)!, HIP_FOV * ADS_FOV, HIP_FOV, 1);
    const tanHalf = Math.tan(f.worldFov / 2) * f.lens;
    const b = gunplayOf(def).ballistic!;
    for (const m of holdoverFor(def, {}, tanHalf, 3.6)) {
      const dist = Number(m.label) * 100;
      expect(m.y, `${dist} m`).toBeCloseTo((100 * (flightTo(b, dist, {}).drop / dist)) / tanHalf, 6);
    }
  });

  it("each player's choice comes from the roster (yours from your loadout); bots and older hosts: every gun's default", () => {
    const rifle = getWeapon('core.rifle');
    expect(setRosterOptics([{ slot: 3, op: { 'core.rifle': 'holo' } }, { slot: 4 }, { slot: 5, op: { 'core.rifle': 'sniper' } }], 0)).toBe(true);
    const v = opticsVersion();
    expect(opticFor(rifle, 3)!.id).toBe('holo');
    expect(opticFor(rifle, 4)!.id).toBe('irons');
    expect(opticFor(rifle, 5)!.id, 'a kind it may not carry: its default').toBe('irons');
    expect(opticFor(rifle, 9)!.id, 'nobody in the roster').toBe('irons');
    // The same roster again changes nothing (the view rebuilds no gun).
    expect(setRosterOptics([{ slot: 3, op: { 'core.rifle': 'holo' } }, { slot: 4 }, { slot: 5, op: { 'core.rifle': 'sniper' } }], 0)).toBe(false);
    expect(opticsVersion()).toBe(v);
    expect(setRosterOptics([{ slot: 3, op: { 'core.rifle': 'x2' } }, { slot: 4 }], 0)).toBe(true);
    expect(opticsVersion()).toBe(v + 1);
    expect(opticFor(rifle, 3)!.id).toBe('x2');
  });
});

