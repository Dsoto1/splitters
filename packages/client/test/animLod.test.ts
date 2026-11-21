import { describe, expect, it } from 'vitest';
import { ANIM_LOD_FAR, ANIM_LOD_FULL, ANIM_LOD_NEAR, ANIM_SHARE_FAR, ANIM_SHARE_FINE, CROWD_FAR_RANK, CROWD_KEEP, byNumber, crowdStep, rankIn, ANIM_SHARE_FULL, ANIM_SHARE_MID, ANIM_SHARE_NEAR, ANIM_SHARE_TINY, EVERY_FRAME, FrameCap, StepClock, TORSO_MEASURES_PER_FRAME, animStep, animStepByShare, blendAt } from '../src/game/animLod.ts';
import { screenShare } from '../src/game/ragdollBudget.ts';
import { DEFAULT_FOV } from '../src/game/view.ts';

/** Evaluations a second for a character at `dist` m when frames take `frameMs`, over `seconds`. */
function rate(dist: number, frameMs: number, seconds = 10, phase = 0, round2 = true): number {
  const clock = new StepClock();
  const step = animStep(dist, round2);
  let n = 0;
  const frames = Math.round((seconds * 1000) / frameMs);
  for (let f = 0; f < frames; f++) if (clock.due(f * frameMs, f, step, phase)) n++;
  return n / seconds;
}

/** Evaluations a second at a share of the view's height (round 4). */
function rateByShare(share: number, frameMs: number, seconds = 10): number {
  const clock = new StepClock();
  const step = animStepByShare(share);
  let n = 0;
  const frames = Math.round((seconds * 1000) / frameMs);
  for (let f = 0; f < frames; f++) if (clock.due(f * frameMs, f, step, 0)) n++;
  return n / seconds;
}

describe('character animation LOD by size on screen (round 4)', () => {
  const at = (m: number) => screenShare(m, DEFAULT_FOV);

  it('puts the bands at about 8, 15, 25, 40, 80 and 150 m with the usual field of view', () => {
    expect(at(7.5)).toBeGreaterThan(ANIM_SHARE_FINE);
    expect(at(8.5)).toBeLessThan(ANIM_SHARE_FINE);
    expect(at(14.5)).toBeGreaterThan(ANIM_SHARE_FULL);
    expect(at(15.5)).toBeLessThan(ANIM_SHARE_FULL);
    expect(at(24.5)).toBeGreaterThan(ANIM_SHARE_MID);
    expect(at(25.5)).toBeLessThan(ANIM_SHARE_MID);
    expect(at(39)).toBeGreaterThan(ANIM_SHARE_NEAR);
    expect(at(41)).toBeLessThan(ANIM_SHARE_NEAR);
    expect(at(78)).toBeGreaterThan(ANIM_SHARE_FAR);
    expect(at(82)).toBeLessThan(ANIM_SHARE_FAR);
    expect(at(145)).toBeGreaterThan(ANIM_SHARE_TINY);
    expect(at(155)).toBeLessThan(ANIM_SHARE_TINY);
  });

  it('animates every frame to 15 m (the fingers kept past 8 m), then 30, 20, 15, 10 and 5 Hz at 60 fps, every reduced rate smoothed', () => {
    expect(animStepByShare(at(5))).toBe(EVERY_FRAME);
    expect(animStepByShare(at(12)).detail).toBe('cached');
    expect(rateByShare(at(12), 1000 / 60)).toBeCloseTo(60, 0);
    expect(rateByShare(at(20), 1000 / 60)).toBeCloseTo(30, 0);
    expect(rateByShare(at(30), 1000 / 60)).toBeCloseTo(20, 0);
    expect(rateByShare(at(60), 1000 / 60)).toBeCloseTo(15, 0);
    expect(rateByShare(at(100), 1000 / 60)).toBeCloseTo(10, 0);
    expect(rateByShare(at(200), 1000 / 60)).toBeCloseTo(5, 0);
    for (const m of [20, 30, 60, 100, 200]) expect(animStepByShare(at(m)).smooth).toBe(true);
    expect(animStepByShare(at(12)).smooth).toBe(false);
    expect(animStepByShare(at(20)).detail).toBe('cached');
    expect(animStepByShare(at(30)).detail).toBe('coarse');
  });

  it('gives each distance at least the rate round 2 did', () => {
    for (const m of [5, 10, 16, 25, 34, 36, 50, 69, 71, 100, 140]) expect(rateByShare(at(m), 1000 / 60)).toBeGreaterThanOrEqual(rate(m, 1000 / 60) - 0.5);
  });

  it('brings a far character back to a full rate through a scope (a narrower field of view)', () => {
    const scoped = screenShare(60, DEFAULT_FOV / 4);
    expect(animStepByShare(scoped).ms).toBe(0);
  });

  it('still saves on slow frames: every 2nd, 3rd, 4th, 6th and 12th frame at 25 fps', () => {
    expect(rateByShare(at(20), 40)).toBeCloseTo(12.5, 0);
    expect(rateByShare(at(30), 40)).toBeCloseTo(25 / 3, 0);
    expect(rateByShare(at(60), 40)).toBeCloseTo(6.25, 0);
    expect(rateByShare(at(100), 40)).toBeCloseTo(25 / 6, 0);
    expect(rateByShare(at(200), 40)).toBeCloseTo(25 / 12, 0);
  });
});

describe('pose smoothing between evaluations', () => {
  it('runs one step behind: the pose before at an evaluation, the last one as the next is due', () => {
    // Evaluated at 100 and 133 ms (30 Hz): drawn from the pose of 100 at 133, halfway at 150, the pose of 133 at 166.
    expect(blendAt(133, 100, 133)).toBe(0);
    expect(blendAt(150, 100, 133)).toBeCloseTo(17 / 33, 3);
    expect(blendAt(166, 100, 133)).toBe(1);
    expect(blendAt(180, 100, 133)).toBe(1);
  });

  it('shows the last pose as it is after a long gap (just in a smoothed band, or back in view)', () => {
    expect(blendAt(1000, 0, 900)).toBe(1);
    expect(blendAt(1000, -1e9, 990)).toBe(1);
    expect(blendAt(1000, 990, 990)).toBe(1);
  });
});

describe('character animation LOD', () => {
  it('animates near characters every frame, in full detail', () => {
    expect(animStep(ANIM_LOD_FULL - 1)).toBe(EVERY_FRAME);
    expect(animStep(0).detail).toBe('full');
    expect(rate(5, 1000 / 60)).toBeCloseTo(60, 0);
    expect(rate(5, 40)).toBeCloseTo(25, 0);
  });

  it('steps 20 Hz, 12 Hz and 8 Hz by distance at 60 fps (round 2, `?perfoff=animlod4`)', () => {
    expect(rate(ANIM_LOD_FULL + 5, 1000 / 60)).toBeCloseTo(20, 0);
    expect(rate(ANIM_LOD_NEAR + 5, 1000 / 60)).toBeCloseTo(12, 0);
    expect(rate(ANIM_LOD_FAR + 5, 1000 / 60)).toBeCloseTo(8, 0);
  });

  it("keeps round 1's rates behind the switch: 30 Hz, 15 Hz and 10 Hz", () => {
    expect(rate(ANIM_LOD_FULL + 5, 1000 / 60, 10, 0, false)).toBeCloseTo(30, 0);
    expect(rate(ANIM_LOD_NEAR + 5, 1000 / 60, 10, 0, false)).toBeCloseTo(15, 0);
    expect(rate(ANIM_LOD_FAR + 5, 1000 / 60, 10, 0, false)).toBeCloseTo(10, 0);
  });

  it('still saves on slow frames, where a time step alone was due every frame', () => {
    // 25 fps (a busy fight on a laptop): every 3rd, 4th and 5th frame instead of every frame.
    expect(rate(ANIM_LOD_FULL + 5, 40)).toBeCloseTo(25 / 3, 0);
    expect(rate(ANIM_LOD_NEAR + 5, 40)).toBeCloseTo(6.25, 0);
    expect(rate(ANIM_LOD_FAR + 5, 40)).toBeCloseTo(5, 0);
  });

  it('keeps fingers from the last full close past the full-detail distance, and the coarse detail past the near one', () => {
    expect(animStep(ANIM_LOD_FULL + 1).detail).toBe('cached');
    expect(animStep(ANIM_LOD_NEAR - 1).detail).toBe('cached');
    expect(animStep(ANIM_LOD_NEAR + 1).detail).toBe('coarse');
    expect(animStep(ANIM_LOD_FAR + 50).detail).toBe('coarse');
    expect(animStep(ANIM_LOD_FAR + 50, false).detail).toBe('cached');
  });

  it('spreads a crowd over frames: characters on different phases step on different frames', () => {
    const step = animStep(ANIM_LOD_NEAR + 5);
    const clocks = Array.from({ length: 30 }, () => new StepClock());
    const perFrame: number[] = [];
    for (let f = 0; f < 120; f++) {
      let n = 0;
      clocks.forEach((c, slot) => {
        if (c.due(f * 40, f, step, (slot * 37) % 100)) n++;
      });
      perFrame.push(n);
    }
    // After the first frames (everyone's first step is at once), no frame carries much more than its share.
    const settled = perFrame.slice(8);
    expect(Math.max(...settled)).toBeLessThanOrEqual(Math.ceil(30 / step.frames) + 2);
    expect(Math.min(...settled)).toBeGreaterThan(0);
  });

  it('goes back to every frame at once when a character comes near', () => {
    const clock = new StepClock();
    const far = animStep(ANIM_LOD_FAR + 5);
    expect(clock.due(0, 0, far)).toBe(true);
    expect(clock.due(16, 1, far)).toBe(false);
    expect(clock.due(33, 2, EVERY_FRAME)).toBe(true);
    expect(clock.due(50, 3, EVERY_FRAME)).toBe(true);
  });
});

describe('a crowd coming into view together (the match-start spike, docs/PERF_STJOHNS_2026-11-14.md)', () => {
  /** How many of `n` characters (phases as GameView gives them: slot * 37 % 100) evaluate in each of `frames` frames. */
  function perFrame(n: number, share: number, spread: boolean, frames = 12, frameMs = 33): number[] {
    const clocks = Array.from({ length: n }, () => new StepClock());
    const step = animStepByShare(share);
    const out: number[] = [];
    for (let f = 100; f < 100 + frames; f++) out.push(clocks.filter((c, i) => c.due(f * frameMs, f, step, (i * 37) % 100, spread)).length);
    return out;
  }

  it('spreads the first evaluations over the band\'s frames', () => {
    // 34 characters 40-80 m away (every 4th frame) all come into view in one frame.
    const counts = perFrame(34, (ANIM_SHARE_NEAR + ANIM_SHARE_FAR) / 2, true);
    expect(Math.max(...counts)).toBeLessThanOrEqual(Math.ceil(34 / 4) + 2);
    // Everyone is evaluated within the band's first 4 frames.
    expect(counts.slice(0, 4).reduce((a, b) => a + b, 0)).toBe(34);
  });

  it('without spreading (creatures), all at once as before', () => {
    const counts = perFrame(34, (ANIM_SHARE_NEAR + ANIM_SHARE_FAR) / 2, false);
    expect(counts[0]).toBe(34);
  });

  it('keeps every frame for near characters', () => {
    expect(perFrame(5, ANIM_SHARE_FINE * 2, true, 4)).toEqual([5, 5, 5, 5]);
  });

  it('waits at most the band\'s frame step', () => {
    for (let phase = 0; phase < 100; phase += 7) {
      const c = new StepClock();
      const step = animStepByShare(ANIM_SHARE_TINY / 2);
      let f = 50;
      while (!c.due(f * 16, f, step, phase, true)) f++;
      expect(f - 50).toBeLessThan(step.frames);
    }
  });

  it('caps first-time work a frame (FrameCap) and lets the rest through on later frames', () => {
    const cap = new FrameCap(TORSO_MEASURES_PER_FRAME);
    const waiting = new Set(Array.from({ length: 29 }, (_, i) => i));
    let frames = 0;
    for (let frame = 1; waiting.size && frame < 100; frame++, frames++) {
      let taken = 0;
      for (const w of [...waiting]) if (cap.take(frame)) (waiting.delete(w), taken++);
      expect(taken).toBeLessThanOrEqual(TORSO_MEASURES_PER_FRAME);
    }
    expect(waiting.size).toBe(0);
    expect(frames).toBe(Math.ceil(29 / TORSO_MEASURES_PER_FRAME));
  });
});

describe('animation in a crowd (Flavius Rule, 2026-11-16)', () => {
  const at = (m: number) => screenShare(m, DEFAULT_FOV);
  /** Evaluations a second of a step at 60 fps. */
  const hz = (step: ReturnType<typeof animStepByShare>): number => {
    const clock = new StepClock();
    let n = 0;
    for (let f = 0; f < 600; f++) if (clock.due((f * 1000) / 60, f, step, 0)) n++;
    return n / 10;
  };

  it('leaves a small group alone, and the nearest of a crowd', () => {
    for (const m of [10, 20, 30, 60, 100, 200]) {
      const band = animStepByShare(at(m));
      expect(crowdStep(band, 20, at(m), CROWD_KEEP)).toBe(band);
      expect(crowdStep(band, CROWD_KEEP - 1, at(m), 60)).toBe(band);
    }
  });

  it('never slows anyone within about 8 m, however big the crowd', () => {
    const band = animStepByShare(at(6));
    expect(crowdStep(band, 50, at(6), 60)).toBe(band);
    expect(hz(crowdStep(band, 50, at(6), 60))).toBe(60);
  });

  it('slows the rest a rung, and the far ranks two, keeping each band\'s detail and smoothing', () => {
    // 8-15 m: every frame → 30 Hz, then 20 Hz.
    const near = animStepByShare(at(12));
    expect(hz(near)).toBe(60);
    const one = crowdStep(near, CROWD_KEEP, at(12), 60);
    const two = crowdStep(near, CROWD_FAR_RANK, at(12), 60);
    expect(hz(one)).toBe(30);
    expect(hz(two)).toBe(20);
    for (const s of [one, two]) {
      expect(s.detail).toBe(near.detail);
      expect(s.smooth).toBe(true);
    }
    // 25-40 m: 20 Hz → 15 Hz; 80-150 m: 10 Hz → 5 Hz at most two rungs down, and never past the last rung.
    expect(hz(crowdStep(animStepByShare(at(30)), CROWD_KEEP, at(30), 60))).toBe(15);
    expect(hz(crowdStep(animStepByShare(at(100)), CROWD_FAR_RANK, at(100), 60))).toBe(5);
    expect(hz(crowdStep(animStepByShare(at(300)), CROWD_FAR_RANK, at(300), 60))).toBe(5);
    // Every step is slower than or as slow as its band's, never faster.
    for (const m of [9, 14, 18, 30, 50, 90, 120, 200]) for (const r of [CROWD_KEEP, CROWD_FAR_RANK]) expect(hz(crowdStep(animStepByShare(at(m)), r, at(m), 60))).toBeLessThanOrEqual(hz(animStepByShare(at(m))));
  });

  it('makes no new step objects frame to frame', () => {
    const band = animStepByShare(at(30));
    expect(crowdStep(band, 30, at(30), 60)).toBe(crowdStep(band, 31, at(31), 60));
  });

  it('ranks by squared distance among those in view', () => {
    const d2 = [400, 25, 900, 100, 25].sort(byNumber);
    expect(rankIn(d2, 25)).toBe(0);
    expect(rankIn(d2, 100)).toBe(2);
    expect(rankIn(d2, 900)).toBe(4);
    expect(rankIn(d2, 1e6)).toBe(5);
    expect(rankIn([], 4)).toBe(0);
  });
});
