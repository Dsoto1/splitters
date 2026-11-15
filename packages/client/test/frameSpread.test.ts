import { describe, expect, it } from 'vitest';
import { FrameSpread } from '../src/game/frameSpread.ts';

/** A clock each step moves on by its own cost (ms). */
function spread(budget: number) {
  let now = 0;
  const q = new FrameSpread(budget, 20, () => now);
  const ran: string[] = [];
  const step = (name: string, ms: number) => () => {
    ran.push(name);
    now += ms;
  };
  return { q, ran, step };
}

describe('FrameSpread (a going body put away over frames)', () => {
  it('runs steps in order, a frame at a time, within the budget', () => {
    const { q, ran, step } = spread(1.5);
    // Five bodies going in one frame (a crowded match past its body limit), three steps each.
    for (let b = 0; b < 5; b++) q.push(step(`${b}a`, 1), step(`${b}b`, 0.4), step(`${b}c`, 0.6));
    expect(q.size).toBe(15);
    const perFrame: number[] = [];
    while (q.size) perFrame.push(q.run());
    expect(ran).toEqual([0, 1, 2, 3, 4].flatMap((b) => [`${b}a`, `${b}b`, `${b}c`]));
    // No frame ran more than the budget's worth past its first step: 1 + 0.4 (< 1.5), then the 0.6 step goes over and ends it.
    expect(Math.max(...perFrame)).toBeLessThanOrEqual(3);
    expect(perFrame.length).toBeGreaterThanOrEqual(5);
  });

  it('runs at least one step a frame, however slow it is', () => {
    const { q, ran, step } = spread(1);
    q.push(step('slow', 30), step('next', 0.1));
    expect(q.run()).toBe(1);
    expect(ran).toEqual(['slow']);
    expect(q.run()).toBe(1);
    expect(q.size).toBe(0);
    expect(q.run()).toBe(0);
  });

  it('drains a steady stream on a slow page instead of piling it up', () => {
    // A page drawing a frame a second while three bodies (nine steps) go every frame, each step 2 ms (over the budget).
    const { q, step } = spread(1.5);
    let most = 0;
    for (let frame = 0; frame < 600; frame++) {
      for (let i = 0; i < 9; i++) q.push(step('x', 2));
      q.run();
      most = Math.max(most, q.size);
    }
    // It settles where a frame's share (a twentieth) is what comes in: about 20 frames' worth, never more.
    expect(most).toBeLessThanOrEqual(9 * 21);
  });

  it('spreads a burst over about drainFrames frames however slow its steps are', () => {
    const { q, step } = spread(1.5);
    for (let i = 0; i < 96; i++) q.push(step('x', 5));
    const perFrame: number[] = [];
    while (q.size) perFrame.push(q.run());
    expect(perFrame[0]).toBe(5);
    expect(Math.max(...perFrame)).toBe(5);
    expect(perFrame.length).toBeGreaterThan(20);
    expect(perFrame.length).toBeLessThan(80);
  });

  it('flushes everything at once', () => {
    const { q, ran, step } = spread(0.5);
    for (let i = 0; i < 100; i++) q.push(step(String(i), 1));
    q.run();
    q.flush();
    expect(ran.length).toBe(100);
    expect(q.size).toBe(0);
  });

  it('keeps the order when steps are queued while it drains', () => {
    const { q, ran, step } = spread(0.5);
    for (let i = 0; i < 70; i++) q.push(step(String(i), 1));
    for (let i = 0; i < 68; i++) q.run();
    q.push(step('late', 1));
    q.flush();
    expect(ran.slice(-3)).toEqual(['68', '69', 'late']);
  });
});
