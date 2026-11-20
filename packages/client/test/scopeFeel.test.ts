import { describe, expect, it } from 'vitest';
import { CORE_WEAPONS, getWeapon } from '@tiletrigger/shared';
import { OPTIC_KINDS, SCOPE_FEEL, WEAPON_OPTICS } from '@tiletrigger/shared/optics';
import { EYE_BOX, GLINT, SCOPE_FADE, eyeBoxShade, freshBreath, freshEyeBox, glintStrength, seemsScoped, stepBreath, stepEyeBox, stepGlint, stepScopeFade, stepZoom, swayAt, zoomSteps } from '../src/game/scopeFeel.ts';
import { HIP_FOV } from '../src/game/optics.ts';

const mag = (fov: number) => Math.tan(HIP_FOV / 2) / Math.tan(fov / 2);

describe('scope feel (docs/GUNPLAY_SPEC.md §15, "Scope feel")', () => {
  it('the feel numbers are the ones the owner has seen (a change here is theirs to approve)', () => {
    expect(SCOPE_FEEL).toEqual({ sway: 0.0035, swayHeld: 0.12, swaySpent: 2.2, settle: 0.15, breathSeconds: 3.5, recoverSeconds: 4, readyAt: 0.5 });
  });

  it("zoom steps: every gun's first step is its own zoom; the scope overlay's guns have a second on the wheel", () => {
    const steps: Record<string, readonly number[]> = { 'core.sniper': [1, 0.45], 'core.railgun': [1, 0.45], 'core.marksman': [1, 0.45], 'core.battle_rifle': [1] };
    for (const def of Object.values(CORE_WEAPONS)) {
      expect(zoomSteps(def), def.id).toEqual(steps[def.id] ?? [1]);
      expect(zoomSteps(def)[0], def.id).toBe(1);
    }
    // The second zooms, as magnifications over the hip view.
    expect(mag(getWeapon('core.sniper').view.zoomFov! * 0.45)).toBeCloseTo(8.87, 2);
    expect(mag(getWeapon('core.railgun').view.zoomFov! * 0.45)).toBeCloseTo(7.08, 2);
    expect(mag(getWeapon('core.marksman').view.zoomFov! * 0.45)).toBeCloseTo(5.04, 2);
    // Only magnified kinds have steps, and a gun's own steps belong to a magnified optic.
    for (const k of Object.values(OPTIC_KINDS)) expect(!!k.steps, k.name).toBe(!!k.mag);
    for (const [id, w] of Object.entries(WEAPON_OPTICS)) if (w.steps) expect(w.mag, id).toBeGreaterThan(1);
  });

  it('the wheel moves one step a notch and stops at the ends', () => {
    expect(stepZoom(0, 1, [1, 0.45])).toBe(1);
    expect(stepZoom(1, 3, [1, 0.45])).toBe(1);
    expect(stepZoom(1, -1, [1, 0.45])).toBe(0);
    expect(stepZoom(0, -1, [1, 0.45])).toBe(0);
    expect(stepZoom(0, 1, [1])).toBe(0);
    expect(stepZoom(1, 1, [1, 0.6, 0.3])).toBe(2);
  });

  it('breath: holds for 3.5 s, runs out, and can be held again once half back (2 s)', () => {
    const b = freshBreath();
    let held = 0;
    for (let i = 0; i < 600 && stepBreath(b, 1 / 60, true, true); i++) held++;
    expect(held / 60).toBeGreaterThan(3.4);
    expect(held / 60).toBeLessThan(3.6);
    expect(b.spent).toBe(true);
    // Still asking: not held while spent.
    let back = 0;
    while (!stepBreath(b, 1 / 60, true, true) && back < 600) back++;
    expect(back / 60).toBeGreaterThan(1.9);
    expect(back / 60).toBeLessThan(2.1);
    // Out of the scope it refills: 4 s from empty.
    const c = freshBreath();
    c.level = 0;
    for (let i = 0; i < 4 * 60 + 2; i++) stepBreath(c, 1 / 60, false, false);
    expect(c.level).toBe(1);
    // Shift does nothing to the meter when not scoped.
    const d = freshBreath();
    expect(stepBreath(d, 1, true, false)).toBe(false);
    expect(d.level).toBe(1);
  });

  it("the sway's size eases: it never jumps when the breath is taken or lost", () => {
    const b = freshBreath();
    let last = b.size;
    let most = 0;
    const run = (seconds: number, wants: boolean) => {
      for (let i = 0; i < seconds * 60; i++) {
        stepBreath(b, 1 / 60, wants, true);
        most = Math.max(most, Math.abs(b.size - last));
        last = b.size;
      }
    };
    run(1, true);
    expect(b.size).toBeLessThan(SCOPE_FEEL.swayHeld + 0.01);
    run(3, true);
    expect(b.spent).toBe(true);
    expect(b.size).toBeGreaterThan(SCOPE_FEEL.swaySpent - 0.1);
    run(3, false);
    expect(b.size).toBeCloseTo(1, 2);
    // The biggest change in one frame: a small part of the plain sway (it was 0.88 and 2.08 of it at once before).
    expect(most).toBeLessThan(0.25);
    // The figure of eight starts at rest in the middle.
    expect(swayAt(0)).toEqual({ x: 0, y: 0 });
  });

  it('the eye box: the shadow follows a turn, a kick and the sway, settles when steady, and never reaches the middle', () => {
    for (const calm of [false, true]) {
      const k = calm ? EYE_BOX.calm : EYE_BOX.normal;
      expect(k.max).toBeLessThan(EYE_BOX.clear - 0.25);
      const e = freshEyeBox(calm);
      const still = { x: 0, y: 0 };
      // Coming up to the eye it starts off the middle and opens.
      expect(Math.hypot(e.x, e.y)).toBeCloseTo(Math.min(EYE_BOX.enter, k.max), 6);
      for (let i = 0; i < 120; i++) stepEyeBox(e, 1 / 60, still, still, 0.4, still, calm);
      expect(Math.hypot(e.x, e.y)).toBeLessThan(0.01);
      // A fast turn to the right (3 rad/s at a 0.4 rad view): the clear picture leads right, capped.
      let most = 0;
      let jump = 0;
      for (let i = 0; i < 30; i++) {
        const before = e.x;
        stepEyeBox(e, 1 / 60, { x: 0.05, y: 0 }, still, 0.4, still, calm);
        most = Math.max(most, Math.hypot(e.x, e.y));
        jump = Math.max(jump, Math.abs(e.x - before));
      }
      expect(e.x).toBeGreaterThan(0.2);
      expect(most).toBeLessThanOrEqual(k.max + 1e-9);
      // Reduce flashing: it moves through a slow filter (no more than a twelfth of the glass's radius a frame).
      if (calm) expect(jump).toBeLessThan(0.03);
      for (let i = 0; i < 120; i++) stepEyeBox(e, 1 / 60, still, still, 0.4, still, calm);
      expect(Math.hypot(e.x, e.y)).toBeLessThan(0.01);
      // A kick up moves the clear picture down (the shadow comes in from the top).
      stepEyeBox(e, 1 / 60, still, { x: 0, y: 0.03 }, 0.4, still, calm);
      stepEyeBox(e, 1 / 60, still, still, 0.4, still, calm);
      expect(e.y).toBeGreaterThan(0);
      for (let i = 0; i < 120; i++) stepEyeBox(e, 1 / 60, still, still, 0.4, still, calm);
      // The sway carries it a little; holding breath (a small sway) leaves it all but still.
      for (let i = 0; i < 120; i++) stepEyeBox(e, 1 / 60, still, still, 0.4, { x: 1, y: 0 }, calm);
      expect(e.x).toBeCloseTo(k.sway, 2);
      for (let i = 0; i < 120; i++) stepEyeBox(e, 1 / 60, still, still, 0.4, { x: SCOPE_FEEL.swayHeld, y: 0 }, calm);
      expect(e.x).toBeLessThan(0.02);
    }
    // Turning back and forth four times a second with Reduce flashing on: the shadow barely swings.
    const e = freshEyeBox();
    e.rx = e.ry = e.x = e.y = 0;
    let swing = 0;
    for (let i = 0; i < 240; i++) {
      stepEyeBox(e, 1 / 60, { x: Math.floor(i / 7.5) % 2 ? -0.05 : 0.05, y: 0 }, { x: 0, y: 0 }, 0.4, { x: 0, y: 0 }, true);
      if (i > 60) swing = Math.max(swing, Math.abs(e.x));
    }
    expect(swing).toBeLessThan(0.2);
    expect(EYE_BOX.calm.dark).toBeLessThanOrEqual(0.6);
    // The shade's curve: clear inside, full at its edge.
    expect(eyeBoxShade(EYE_BOX.clear - 0.01)).toBe(0);
    expect(eyeBoxShade(EYE_BOX.full)).toBe(1);
    expect(eyeBoxShade((EYE_BOX.clear + EYE_BOX.full) / 2)).toBeCloseTo(0.5, 6);
  });

  it("the scope's surround comes in at once and fades out, slower with Reduce flashing on", () => {
    for (const calm of [false, true]) {
      const k = calm ? SCOPE_FADE.calm : SCOPE_FADE.normal;
      // In with the zoom: the magnified picture never shows round the glass.
      expect(stepScopeFade(0, true, 1 / 60, calm)).toBe(1);
      let level = 1;
      let frames = 0;
      while (level > 0 && frames < 100) {
        level = stepScopeFade(level, false, 1 / 60, calm);
        frames++;
      }
      expect(frames / 60).toBeCloseTo(k.out, 1);
      // Never a cut to the bright scene: at least three frames at 30 frames a second.
      expect(k.out * 30).toBeGreaterThanOrEqual(3);
    }
    expect(SCOPE_FADE.calm.out).toBeGreaterThanOrEqual(0.2);
  });

  it('the glint: inside the cone, beyond the least distance, fading with angle and distance', () => {
    const eye = { x: 0, y: 1.6, z: 0 };
    const at = (dist: number, offDeg = 0) => glintStrength(eye, (offDeg * Math.PI) / 180, 0, { x: 0, y: 1.6, z: dist });
    expect(at(10)).toBe(0);
    expect(at(GLINT.near[0])).toBe(0);
    expect(at(30)).toBeCloseTo(1, 6);
    expect(at(80)).toBeCloseTo(1, 6);
    expect(at(150)).toBeGreaterThan(0.9);
    expect(at(150)).toBeLessThan(1);
    expect(at(400)).toBeCloseTo(GLINT.farLevel, 6);
    expect(at(80, 3)).toBeCloseTo(1, 6);
    expect(at(80, 9)).toBeGreaterThan(0.2);
    expect(at(80, 9)).toBeLessThan(0.8);
    expect(at(80, GLINT.cone)).toBe(0);
    expect(at(80, 90)).toBe(0);
    expect(at(80, 180)).toBe(0);
    // Aiming up at you on a ledge counts the same.
    expect(glintStrength(eye, 0, Math.atan2(20, 80), { x: 0, y: 21.6, z: 80 })).toBeCloseTo(1, 6);
    // It only eases: 0.15 s up (half a second with Reduce flashing on), a quarter second down; dimmer when calm.
    expect(stepGlint(0, 1, 1 / 60, false)).toBeCloseTo(1 / 60 / 0.15, 6);
    expect(stepGlint(0, 1, 1 / 60, true)).toBeCloseTo(1 / 60 / 0.5, 6);
    expect(stepGlint(1, 0, 1 / 60, true)).toBeCloseTo(1 - 1 / 60 / GLINT.fall, 6);
    expect(stepGlint(0.5, 0.5, 1, false)).toBe(0.5);
    expect(GLINT.calm.level).toBeLessThan(GLINT.normal.level);
    expect(GLINT.calm.rise).toBeGreaterThanOrEqual(0.5);
  });

  it('who seems scoped, from what the snapshot carries (it has no bit for aiming)', () => {
    expect(seemsScoped({ alive: true })).toBe(true);
    expect(seemsScoped({ alive: false })).toBe(false);
    expect(seemsScoped({ alive: true, sprinting: true })).toBe(false);
    expect(seemsScoped({ alive: true, emote: true })).toBe(false);
    expect(seemsScoped({ alive: true, chute: 1 })).toBe(false);
    expect(seemsScoped({ alive: true, zip: 0 })).toBe(false);
    // Bots: only while they fight (they scope when they fire or wait on a shot).
    expect(seemsScoped({ alive: true, state: 'engage' })).toBe(true);
    expect(seemsScoped({ alive: true, state: 'cover' })).toBe(true);
    expect(seemsScoped({ alive: true, state: 'roam' })).toBe(false);
    expect(seemsScoped({ alive: true, state: 'retreat' })).toBe(false);
  });
});
