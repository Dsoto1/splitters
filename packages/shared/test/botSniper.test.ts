// Snipers who play like snipers (bots/sniper.ts; docs/BOTS.md, "Snipers"; BOT_AI_PLAN.md Phase B item 5).
import { describe, expect, it } from 'vitest';
import { CORE_BOT_PROFILES, type Vec3 } from '../src/index.ts';
import { goodShot, laneCover, relocatePrefer, shotsPerSpot, type ShotView, type VantageSpot } from '../src/match.ts';

const at = (x: number, z: number): Vec3 => ({ x, y: 0, z });
const shot = (over: Partial<ShotView>): ShotView => ({ dist: 60, reach: 120, lateral: 0, facing: 0, settled: true, tracked: 0.5, ...over });

describe('snipers', () => {
  it('take only calculated shots: settled, in reach, at a still or unaware target, or one lined up a while', () => {
    expect(goodShot(shot({}))).toBe(true);
    expect(goodShot(shot({ settled: false }))).toBe(false);
    expect(goodShot(shot({ dist: 130 }))).toBe(false);
    // Lined up a second, the aim is as settled as it gets at range.
    expect(goodShot(shot({ settled: false, tracked: 1.2 }))).toBe(true);
    // Walking across its view, looking its way: not yet; lined up 1.5 s, it takes it.
    expect(goodShot(shot({ lateral: 2.5, facing: 0.9 }))).toBe(false);
    expect(goodShot(shot({ lateral: 2.5, facing: 0.9, tracked: 1.6 }))).toBe(true);
    // Not looking its way: at once, even moving.
    expect(goodShot(shot({ lateral: 2.5, facing: 0.2 }))).toBe(true);
    // Sprinting across: never.
    expect(goodShot(shot({ lateral: 6, facing: 0.9, tracked: 10 }))).toBe(false);
  });

  it('move on after two shots, or three for the bold, somewhere else and not back the way they came', () => {
    expect(shotsPerSpot({ ...CORE_BOT_PROFILES[0]!, aggression: 30 })).toBe(2);
    expect(shotsPerSpot({ ...CORE_BOT_PROFILES[0]!, aggression: 70 })).toBe(3);
    const prefer = relocatePrefer(at(0, 0), at(-40, 0));
    expect(prefer(at(5, 5))).toBeLessThan(-1);
    expect(prefer(at(-25, 0))).toBe(-1);
    expect(prefer(at(30, 10))).toBe(0);
  });

  it('value spots that look down the ways the enemy comes', () => {
    const spot: VantageSpot = { pos: at(0, 0), kind: 'sniper', yaw: 0, reach: 80, height: 6, score: 1 };
    // A lane straight ahead (+z) and one behind.
    const ahead = Array.from({ length: 30 }, (_, i) => at(0, 15 + i * 2));
    const behind = Array.from({ length: 30 }, (_, i) => at(0, -15 - i * 2));
    const all = () => true;
    expect(laneCover(spot, [ahead], all)).toBe(1);
    expect(laneCover(spot, [behind], all)).toBe(0);
    // Half of it behind a wall.
    expect(laneCover(spot, [ahead], (_a, b) => b.z < 45)).toBeGreaterThan(0.3);
    expect(laneCover(spot, [ahead], (_a, b) => b.z < 45)).toBeLessThan(0.7);
  });
});
