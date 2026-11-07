// The flicker check's measure (e2e/flicker.mjs): WCAG 2.3.1's general and red flash thresholds on synthetic frames.
import { describe, expect, it } from 'vitest';
import { FLICKER_LIMITS, analyseFrames, areaChange, luminance, mostInWindow, redness, transitionsOf } from '../../../e2e/flicker.mjs';

const W = 40;
const H = 20;
const FPS = 30;

/** A frame painted by `paint(x, y) → [r, g, b]`, RGBA. */
function frame(paint) {
  const px = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [r, g, b] = paint(x, y);
      px.set([r, g, b, 255], (y * W + x) * 4);
    }
  }
  return { px, w: W, h: H };
}
/** `seconds` of frames, frame i painted by `paint(i, x, y)`. */
const clip = (seconds, paint) => Array.from({ length: Math.round(seconds * FPS) }, (_, i) => frame((x, y) => paint(i, x, y)));
const grey = (v) => [v, v, v];
/** The left `share` of the screen (by columns). */
const left = (share) => (x) => x < W * share;

describe('the flicker measure', () => {
  it('reads relative luminance and red saturation like WCAG', () => {
    expect(luminance(0, 0, 0)).toBe(0);
    expect(luminance(255, 255, 255)).toBeCloseTo(1, 6);
    expect(luminance(128, 128, 128)).toBeCloseTo(0.2158, 3);
    expect(redness(255, 0, 0)).toBeCloseTo(320, 3);
    // Orange is not saturated red; neither is a dull brick red.
    expect(redness(255, 140, 0)).toBe(0);
    expect(redness(140, 60, 50)).toBe(0);
    expect(redness(200, 0, 0)).toBeGreaterThan(FLICKER_LIMITS.redDelta);
  });

  it('takes the change a quarter of the screen made', () => {
    const a = new Float32Array(100);
    const b = new Float32Array(100).map((_, i) => (i < 30 ? 0.5 : 0));
    expect(areaChange(a, b, 0.25)).toBeCloseTo(0.5, 2);
    // Only 20 % of it changed: no quarter of the screen moved.
    const c = new Float32Array(100).map((_, i) => (i < 20 ? 0.5 : 0));
    expect(areaChange(a, c, 0.25)).toBe(0);
    expect(areaChange(b, a, 0.25)).toBeCloseTo(-0.5, 2);
  });

  it('counts a slow change as one transition, and pairs of them as flashes', () => {
    // 0.03 a frame upwards for 5 frames, then down the same way: two transitions.
    const t = transitionsOf([0.03, 0.03, 0.03, 0.03, 0.03, -0.03, -0.03, -0.03, -0.03, -0.03], 0.1, FPS);
    expect(t.map((x) => x.dir)).toEqual([1, -1]);
    expect(t[0].frames).toBe(4);
    // Noise never adds up.
    expect(transitionsOf([0.02, -0.02, 0.02, -0.02, 0.02, -0.02], 0.1, FPS)).toEqual([]);
    expect(mostInWindow([{ t: 0 }, { t: 0.2 }, { t: 0.5 }, { t: 0.99 }, { t: 1.4 }])).toBe(4);
  });

  it('a steady picture passes', () => {
    const r = analyseFrames(clip(2, () => grey(90)), FPS);
    expect(r.pass).toBe(true);
    expect(r.transitions).toEqual([]);
  });

  it('a full-screen strobe fails; the same strobe on a fifth of the screen passes', () => {
    // Black and white, swapping every 3 frames (5 flashes a second).
    const strobe = (on) => (i, x) => (on(x) && Math.floor(i / 3) % 2 ? grey(255) : grey(10));
    const full = analyseFrames(clip(2, strobe(() => true)), FPS);
    expect(full.pass).toBe(false);
    expect(full.perSecond).toBeGreaterThan(FLICKER_LIMITS.maxTransitions);
    expect(full.reasons[0]).toMatch(/luminance transitions/);
    const small = analyseFrames(clip(2, strobe(left(0.2))), FPS);
    expect(small.pass).toBe(true);
    expect(small.transitions).toEqual([]);
    const third = analyseFrames(clip(2, strobe(left(0.3))), FPS);
    expect(third.pass).toBe(false);
  });

  it('a slow pulse passes (two transitions a second), and so do flashes between bright states', () => {
    const pulse = analyseFrames(clip(3, (i) => grey(Math.round(110 + 90 * Math.cos((2 * Math.PI * i) / FPS)))), FPS);
    expect(pulse.perSecond).toBeLessThanOrEqual(3);
    expect(pulse.pass).toBe(true);
    // Light grey to white: the darker state is above 0.8, not a flash.
    const bright = analyseFrames(clip(2, (i) => grey(Math.floor(i / 3) % 2 ? 255 : 235)), FPS);
    expect(luminance(235, 235, 235)).toBeGreaterThan(FLICKER_LIMITS.darkMax);
    expect(bright.transitions).toEqual([]);
  });

  it('a flash eased in over a few frames still counts when it comes and goes fast', () => {
    // Up over 3 frames, down over 3, 5 times a second.
    const eased = analyseFrames(clip(2, (i) => grey(Math.round(20 + 150 * Math.min(1, (i % 6) / 3, (6 - (i % 6)) / 3)))), FPS);
    expect(eased.pass).toBe(false);
  });

  it('a quarter of the screen turning saturated red fails at once; a dull red tint or a slow red pulse does not', () => {
    const snap = analyseFrames(clip(1, (i, x) => (i >= 10 && i < 14 && left(0.4)(x) ? [210, 0, 0] : grey(30))), FPS);
    expect(snap.pass).toBe(false);
    expect(snap.red.onsets.length).toBe(1);
    expect(snap.reasons.some((r) => /red flash/.test(r))).toBe(true);
    const dull = analyseFrames(clip(1, (i, x) => (i >= 10 && i < 14 && left(0.4)(x) ? [120, 52, 46] : grey(30))), FPS);
    expect(dull.red.onsets).toEqual([]);
    expect(dull.red.maxArea).toBe(0);
    // A red room pulsing gently once a second, never far from red.
    const slow = analyseFrames(clip(3, (i) => [Math.round(150 + 50 * Math.cos((2 * Math.PI * i) / FPS)), 0, 0]), FPS);
    expect(slow.red.onsets).toEqual([]);
    expect(slow.pass).toBe(true);
  });
});
