/**
 * Dual wielding, step 3, the first-person pair (docs/GUNPLAY_SPEC.md, "Akimbo / Dual Wield"): the mirror the second
 * gun is drawn in, where the pair sits, each gun's own reload dip and rise, which gun a shot leaves, where its
 * sounds are placed, and Reduce flashing's one shared flash. The pictures are the driver's (the spec, "As built: the
 * pair in first person"); the pair's rules are in akimbo.test.ts here and in shared.
 */
import { describe, expect, it } from 'vitest';
import { getWeapon, type WeaponDefinition } from '@tiletrigger/shared';
import type { AudioSystem, PlayOptions } from '../src/audio/audio.ts';
import { SessionAudio } from '../src/game/sessionAudio.ts';
import type { LocalPlayer } from '../src/game/prediction.ts';
import { MIRROR_X, PAIR_AWAY_DROP, PAIR_HOLD_3P, PAIR_LOWER_SECONDS, PAIR_PAN, PAIR_POSE, PairFlashGate, casingSide, easeUp, gunPan, mirrored, pairHold3p, pairPlace, pairReloadDip, reloadDipAmount, shotGun, stepPairUp } from '../src/game/pairView.ts';

const MP = getWeapon('core.machine_pistol');

describe('the mirror', () => {
  it('flips a camera-space point across the view axis and back', () => {
    expect(MIRROR_X).toBe(-1);
    const p = { x: 0.24, y: -0.2, z: 0.42 };
    expect(mirrored(p)).toEqual({ x: -0.24, y: -0.2, z: 0.42 });
    expect(mirrored(mirrored(p))).toEqual(p);
  });

  it('puts the second gun as far left of the view axis as the first is right, at the same height and depth', () => {
    for (const id of ['core.machine_pistol', 'core.pulse_pistol', 'core.sawed_off']) {
      const right = pairPlace(getWeapon(id).view.viewOffset, 1);
      const left = mirrored(right);
      expect(left.x, id).toBeCloseTo(-right.x, 9);
      expect(left.y, id).toBe(right.y);
      expect(left.z, id).toBe(right.z);
    }
  });
});

describe("the pair's place", () => {
  it('is higher and wider than the one gun, never nearer the middle, and the one gun at amount 0', () => {
    const off = MP.view.viewOffset;
    expect(pairPlace(off, 0)).toEqual({ x: off[0], y: off[1], z: off[2] });
    const at = pairPlace(off, 1);
    expect(at.x).toBeGreaterThan(off[0]);
    expect(at.y).toBeGreaterThan(off[1]);
    expect(at.x - off[0]).toBeCloseTo(PAIR_POSE.wider, 9);
    expect(at.y - off[1]).toBeCloseTo(PAIR_POSE.higher, 9);
    const half = pairPlace(off, 0.5);
    expect(half.x).toBeCloseTo((off[0] + at.x) / 2, 9);
  });

  it('keeps both muzzles clear of the crosshair: each well off the view axis', () => {
    for (const id of ['core.machine_pistol', 'core.pulse_pistol', 'core.sawed_off']) {
      const def = getWeapon(id);
      const at = pairPlace(def.view.viewOffset, 1);
      const m = def.view.muzzleAt ?? [0, 0, 0.2];
      // The muzzle's angle off the view axis, across and down (degrees).
      const across = (Math.atan2(at.x + m[0], at.z + m[2]) * 180) / Math.PI;
      const down = (Math.atan2(-(at.y + m[1]), at.z + m[2]) * 180) / Math.PI;
      expect(across, id).toBeGreaterThan(12);
      expect(down, id).toBeGreaterThan(5);
    }
  });
});

describe("the second gun's rise", () => {
  it("comes up over the pair's raise and goes down quicker", () => {
    let up = 0;
    let frames = 0;
    while (up < 1 && frames < 1000) {
      up = stepPairUp(up, true, 1 / 60, 0.25);
      frames++;
    }
    // (A quarter second at 60 frames a second, give or take the last frame's rounding.)
    expect(frames).toBeGreaterThanOrEqual(15);
    expect(frames).toBeLessThanOrEqual(16);
    frames = 0;
    while (up > 0 && frames < 1000) {
      up = stepPairUp(up, false, 1 / 60, 0.25);
      frames++;
    }
    expect(frames / 60).toBeCloseTo(PAIR_LOWER_SECONDS, 1);
    expect(PAIR_LOWER_SECONDS).toBeLessThan(0.25);
  });

  it('stays inside 0..1 and eases at both ends', () => {
    expect(stepPairUp(0.99, true, 1, 0.2)).toBe(1);
    expect(stepPairUp(0.01, false, 1, 0.2)).toBe(0);
    expect(easeUp(0)).toBe(0);
    expect(easeUp(1)).toBe(1);
    expect(easeUp(0.5)).toBeCloseTo(0.5, 9);
    expect(easeUp(0.1)).toBeLessThan(0.1);
    expect(PAIR_AWAY_DROP).toBeGreaterThan(0.3);
  });
});

describe('a one-handed reload', () => {
  it('dips the gun out of view and brings it back, in and out over ten ticks', () => {
    const total = 80;
    expect(reloadDipAmount(0, total)).toBe(0);
    expect(reloadDipAmount(total, total)).toBe(0);
    expect(reloadDipAmount(total - 5, total)).toBeCloseTo(0.5, 9);
    expect(reloadDipAmount(40, total)).toBe(1);
    expect(reloadDipAmount(5, total)).toBeCloseTo(0.5, 9);
    const none = pairReloadDip(0);
    expect(none).toEqual({ drop: 0, pitch: 0, roll: 0 });
    const full = pairReloadDip(1);
    // Far enough down that the gun leaves the screen (the pair sits about 0.2 m under the eye, 0.42 m out).
    expect(full.drop).toBeGreaterThan(0.25);
    expect(pairReloadDip(0.5).drop).toBeGreaterThan(0);
    expect(pairReloadDip(0.5).drop).toBeLessThan(full.drop);
    expect(pairReloadDip(3)).toEqual(full);
  });

  it('a gun waiting its turn (its reload not begun) does not dip', () => {
    // The other waits at its start: all of its ticks still to go.
    expect(reloadDipAmount(64, 64)).toBe(0);
  });
});

describe('which gun a shot leaves', () => {
  it("the second gun's rounds leave the left gun, the first's the right; one gun is always the right", () => {
    expect(shotGun({ off: true }, true)).toBe('left');
    expect(shotGun({}, true)).toBe('right');
    expect(shotGun({ off: false }, true)).toBe('right');
    expect(shotGun({ off: true }, false)).toBe('right');
    expect(casingSide('left')).toBe(-1);
    expect(casingSide('right')).toBe(1);
  });
});

describe('where a pair sounds', () => {
  it('each gun a little to its own side, one gun in the middle', () => {
    expect(gunPan(false, 'right')).toBe(0);
    expect(gunPan(false, 'left')).toBe(0);
    expect(gunPan(true, 'left')).toBe(-PAIR_PAN);
    expect(gunPan(true, 'right')).toBe(PAIR_PAN);
    expect(PAIR_PAN).toBeGreaterThan(0.1);
    expect(PAIR_PAN).toBeLessThanOrEqual(0.5);
  });

  const heard = () => {
    const played: { id: string; opts: PlayOptions }[] = [];
    const audio = { play: (id: string, opts: PlayOptions = {}) => played.push({ id, opts }) } as unknown as AudioSystem;
    return { played, sfx: new SessionAudio(audio, () => 0) };
  };

  it("the gun's own fire sound, panned for a pair and not for one gun", () => {
    const { played, sfx } = heard();
    sfx.localShot(MP, false, 0);
    sfx.localShot(MP, false, 0, gunPan(true, 'right'));
    sfx.localShot(MP, false, 0.01, gunPan(true, 'left'));
    const sound = MP.view.sound ?? 'fire.machine_pistol';
    expect(played.map((p) => p.id)).toEqual([sound, sound, sound]);
    expect(played[0]!.opts).toEqual({ delay: 0 });
    expect(played[1]!.opts.pan).toBe(PAIR_PAN);
    expect(played[2]!.opts).toEqual({ delay: 0.01, pan: -PAIR_PAN });
  });

  it("a pair's reloads sound from their own hands; one gun's as before", () => {
    const { played, sfx } = heard();
    const local = { alive: true, held: 14, paired: false, reloadTicks: 0, reloadTicks2: 0 } as unknown as LocalPlayer & { paired: boolean; reloadTicks: number; reloadTicks2: number };
    const frame = (o: Partial<{ paired: boolean; reloadTicks: number; reloadTicks2: number }>) => {
      Object.assign(local, o);
      sfx.localWeapon(local);
    };
    frame({});
    frame({ reloadTicks: 30 });
    frame({ reloadTicks: 0 });
    expect(played.map((p) => [p.id, p.opts.pan])).toEqual([
      ['reload.start', undefined],
      ['reload.end', undefined],
    ]);
    played.length = 0;
    frame({ paired: true });
    frame({ reloadTicks2: 40 });
    frame({ reloadTicks2: 0 });
    frame({ reloadTicks: 40 });
    frame({ reloadTicks: 0 });
    expect(played.map((p) => [p.id, p.opts.pan])).toEqual([
      ['reload.start', -PAIR_PAN],
      ['reload.end', -PAIR_PAN],
      ['reload.start', PAIR_PAN],
      ['reload.end', PAIR_PAN],
    ]);
  });
});

describe('Reduce flashing: a pair shares one flash', () => {
  /** Flashes drawn over `ticks` with both triggers held on automatic guns (`offset`: the second gun's ticks behind the first). */
  const hold = (def: WeaponDefinition, ticks: number, o: { calm: boolean; paired: boolean; offset?: number }) => {
    const gate = new PairFlashGate();
    const drawn: { tick: number; gun: 'left' | 'right' }[] = [];
    const every = def.fireIntervalTicks;
    for (let tick = 0; tick < ticks; tick++) {
      const right = tick % every === 0;
      const left = o.paired && (tick - (o.offset ?? 0)) % every === 0 && tick >= (o.offset ?? 0);
      for (const gun of [...(right ? (['right'] as const) : []), ...(left ? (['left'] as const) : [])]) {
        if (gate.allow({ tick, gun, interval: every, paired: o.paired, calm: o.calm, together: right && left })) drawn.push({ tick, gun });
      }
    }
    return drawn;
  };
  const rate = (drawn: { tick: number }[], ticks: number) => drawn.length / ticks;
  const mostAtOnce = (drawn: { tick: number }[]) => Math.max(...[...new Set(drawn.map((d) => d.tick))].map((t) => drawn.filter((d) => d.tick === t).length));

  it('one gun flashes every round, the setting on or off', () => {
    for (const calm of [true, false]) expect(hold(MP, 600, { calm, paired: false })).toHaveLength(600 / MP.fireIntervalTicks);
  });

  it('the setting off: both guns flash every round', () => {
    const drawn = hold(MP, 600, { calm: false, paired: true });
    expect(drawn).toHaveLength((600 / MP.fireIntervalTicks) * 2);
    expect(mostAtOnce(drawn)).toBe(2);
  });

  it('the setting on: never two flashes at once, never more often than one gun, whatever the guns are out of step by', () => {
    const one = hold(MP, 600, { calm: true, paired: false });
    for (let offset = 0; offset < MP.fireIntervalTicks; offset++) {
      const drawn = hold(MP, 600, { calm: true, paired: true, offset });
      expect(mostAtOnce(drawn), `offset ${offset}`).toBe(1);
      expect(rate(drawn, 600), `offset ${offset}`).toBeLessThanOrEqual(rate(one, 600));
      // No two flashes nearer than one gun's own rounds.
      for (let i = 1; i < drawn.length; i++) expect(drawn[i]!.tick - drawn[i - 1]!.tick, `offset ${offset}`).toBeGreaterThanOrEqual(MP.fireIntervalTicks);
      // And the pair still flashes: as often as one gun does.
      expect(drawn.length, `offset ${offset}`).toBe(one.length);
    }
  });

  it('both triggers on the same tick take turns, so neither hand looks dead', () => {
    const drawn = hold(MP, 600, { calm: true, paired: true, offset: 0 });
    expect(drawn.slice(0, 4).map((d) => d.gun)).toEqual(['right', 'left', 'right', 'left']);
    expect(drawn.filter((d) => d.gun === 'left').length).toBe(drawn.filter((d) => d.gun === 'right').length);
  });

  it('semi-automatic guns pulled in turn faster than one fires still flash no faster than one', () => {
    const def = getWeapon('core.sawed_off');
    const gate = new PairFlashGate();
    const every = def.fireIntervalTicks;
    const drawn: number[] = [];
    // Right, then left half an interval later, and so on.
    for (let tick = 0; tick < 20 * every; tick++) {
      const gun = tick % every === 0 ? 'right' : tick % every === Math.floor(every / 2) ? 'left' : null;
      if (gun && gate.allow({ tick, gun, interval: every, paired: true, calm: true })) drawn.push(tick);
    }
    expect(drawn).toHaveLength(20);
    for (let i = 1; i < drawn.length; i++) expect(drawn[i]! - drawn[i - 1]!).toBeGreaterThanOrEqual(every);
  });

  it('a new match (the tick counter starting again) holds nothing against the first round', () => {
    const gate = new PairFlashGate();
    expect(gate.allow({ tick: 5000, gun: 'right', interval: 3, paired: true, calm: true })).toBe(true);
    expect(gate.allow({ tick: 2, gun: 'left', interval: 3, paired: true, calm: true })).toBe(true);
    gate.reset();
    expect(gate.allow({ tick: 3, gun: 'left', interval: 3, paired: true, calm: true })).toBe(true);
  });
});

describe('the pair in third person (step 4)', () => {
  it('holds each gun out in front at a little under arm\'s length, below the shoulder, about shoulder width apart', () => {
    const h = pairHold3p(0);
    expect(h).toEqual({ ...PAIR_HOLD_3P, pitch: 0, roll: 0 });
    // Within the arm's reach with a bend at the elbow (the IK can reach it), out in front of the body.
    const reach = Math.hypot(h.ahead, h.down, h.out);
    expect(reach).toBeGreaterThan(0.6);
    expect(reach).toBeLessThan(0.9);
    // In a little from each shoulder, never across the middle (the two guns stay apart).
    expect(h.out).toBeLessThanOrEqual(0);
    expect(h.out).toBeGreaterThan(-0.2);
  });

  it('a gun being reloaded, or the second gun not yet up, is drawn back, lower, tipped up and rolled outward', () => {
    const up = pairHold3p(0);
    const dipped = pairHold3p(1);
    expect(dipped.ahead).toBeLessThan(up.ahead);
    expect(dipped.down).toBeGreaterThan(up.down);
    expect(dipped.pitch).toBeGreaterThan(0.5);
    expect(dipped.roll).toBeGreaterThan(0.2);
    // Eased both ways, and out of range is clamped.
    expect(pairHold3p(0.5).pitch).toBeCloseTo(dipped.pitch / 2, 5);
    expect(pairHold3p(2)).toEqual(dipped);
    expect(pairHold3p(-1)).toEqual(up);
  });
});
