// Scored choices (bots/choices.ts; docs/BOTS.md, "Scored choices"; BOT_AI_PLAN.md Phase B item 1): what a bot does
// with nobody in sight, by its goal, its state and its personality.
import { describe, expect, it } from 'vitest';
import { CORE_BOT_PROFILES, type Vec3 } from '../src/index.ts';
import { GUN_WEIGHT, OPTIONS, OPT_CHASE, OPT_COVER, OPT_GOAL, OPT_NOISE, OPT_PICKUP, OPT_RETREAT, OPT_ROAM, bestChoice, scoreChoices, type ChoiceInput, type OrderGoal } from '../src/match.ts';

const profile = { ...CORE_BOT_PROFILES[0]!, aggression: 50, exploration: 50, pursuitPersistence: 50, objectivePriority: 50, tags: [] };
const at = (x: number, z: number): Vec3 => ({ x, y: 0, z });

function choice(over: Partial<ChoiceInput>, last = -1): number {
  const i: ChoiceInput = { me: at(0, 0), goal: null, profile, hurt: false, lowAmmo: false, cover: false, retreating: false, pickup: -Infinity, lost: null, noise: null, posted: false, ...over };
  const sc = new Float32Array(OPTIONS);
  scoreChoices(i, sc);
  return bestChoice(sc, last, !!i.goal);
}

const attack: OrderGoal = { pos: at(60, 0), radius: 0.5, push: true };
const defend: OrderGoal = { pos: at(0, 0), radius: 9, watch: at(80, 0) };
const carrier: OrderGoal = { pos: at(60, 0), radius: 0.6, push: true, detour: 0, run: true };
const order: OrderGoal = { pos: at(0, 0), radius: 3, order: true };

describe('scored choices', () => {
  it('an attacker on its way to the flag turns aside only for what happens close by, then back to the flag', () => {
    expect(choice({ goal: attack, lost: { pos: at(8, 0), age: 1 } }, OPT_GOAL)).toBe(OPT_CHASE);
    expect(choice({ goal: attack, lost: { pos: at(20, 0), age: 1 } }, OPT_GOAL)).toBe(OPT_GOAL);
    expect(choice({ goal: attack, noise: { pos: at(8, 3), age: 2 } }, OPT_GOAL)).toBe(OPT_NOISE);
    expect(choice({ goal: attack, noise: { pos: at(30, 0), age: 2 } }, OPT_GOAL)).toBe(OPT_GOAL);
    // A chase that has run its time (persistence 50: 4.5 s) is over.
    expect(choice({ goal: attack, lost: { pos: at(8, 0), age: 5 } }, OPT_CHASE)).toBe(OPT_GOAL);
  });

  it("a defender looks into what happens near its flag, not a fight 30 m off it", () => {
    expect(choice({ goal: defend, noise: { pos: at(14, 0), age: 1 } }, OPT_GOAL)).toBe(OPT_NOISE);
    expect(choice({ goal: defend, noise: { pos: at(40, 0), age: 1 } }, OPT_GOAL)).toBe(OPT_GOAL);
    expect(choice({ goal: defend, lost: { pos: at(22, 0), age: 0.5 } }, OPT_GOAL)).toBe(OPT_CHASE);
    expect(choice({ goal: defend, lost: { pos: at(45, 0), age: 0.5 } }, OPT_GOAL)).toBe(OPT_GOAL);
  });

  it("a carrier never leaves its run, and a person's order holds a bot", () => {
    expect(choice({ goal: carrier, lost: { pos: at(5, 0), age: 0.2 }, noise: { pos: at(4, 0), age: 0.2 } })).toBe(OPT_GOAL);
    expect(choice({ goal: order, noise: { pos: at(6, 0), age: 0.5 } }, OPT_GOAL)).toBe(OPT_GOAL);
    expect(choice({ goal: order, lost: { pos: at(25, 0), age: 0.2 } }, OPT_GOAL)).toBe(OPT_GOAL);
  });

  it('roaming, anything worth a look beats wandering', () => {
    expect(choice({ noise: { pos: at(40, 0), age: 9 } }, OPT_ROAM)).toBe(OPT_NOISE);
    expect(choice({ lost: { pos: at(40, 0), age: 4 } }, OPT_ROAM)).toBe(OPT_CHASE);
    expect(choice({}, -1)).toBe(OPT_ROAM);
  });

  it('keeps the tuned order: hide-and-peek in cover, a real gun, running on, then a chase, then a noise', () => {
    const lost = { pos: at(5, 0), age: 0 };
    const noise = { pos: at(5, 0), age: 0 };
    expect(choice({ cover: true, pickup: GUN_WEIGHT, retreating: true, lost, noise })).toBe(OPT_COVER);
    expect(choice({ pickup: GUN_WEIGHT, retreating: true, lost, noise })).toBe(OPT_PICKUP);
    expect(choice({ retreating: true, lost, noise })).toBe(OPT_RETREAT);
    expect(choice({ lost, noise })).toBe(OPT_CHASE);
  });

  it('weighs health and ammo: a hurt bot never chases and lets a noise go by on its way; short of ammo, an ammo box close by beats a stale chase', () => {
    expect(choice({ hurt: true, lost: { pos: at(5, 0), age: 0 } })).toBe(OPT_ROAM);
    expect(choice({ goal: attack, hurt: true, noise: { pos: at(6, 0), age: 3 } }, OPT_GOAL)).toBe(OPT_GOAL);
    const stale = { pos: at(6, 0), age: 3.5 };
    expect(choice({ goal: attack, lost: stale, pickup: 1.7 }, OPT_GOAL)).toBe(OPT_CHASE);
    expect(choice({ goal: attack, lowAmmo: true, lost: stale, pickup: 1.7 }, OPT_GOAL)).toBe(OPT_PICKUP);
  });

  it('a camper or sniper on its spot leaves it only for something close', () => {
    expect(choice({ posted: true, noise: { pos: at(25, 0), age: 1 } })).toBe(OPT_ROAM);
    expect(choice({ posted: true, noise: { pos: at(6, 0), age: 1 } })).toBe(OPT_NOISE);
  });

  it('the option chosen last counts a little more, so two close ones do not swap back and forth', () => {
    // A goal and a pickup on the way scored a little apart: whichever it chose last stays.
    const near = { goal: attack, pickup: 1.1 };
    expect(choice(near, OPT_GOAL)).toBe(OPT_GOAL);
    expect(choice(near, OPT_PICKUP)).toBe(OPT_PICKUP);
  });
});
