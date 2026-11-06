import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, BUTTON_USE, CORE_BOT_PROFILES, TICK_RATE, initPhysics, loadMap, rulesForMode, type MapDocument } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/**
 * Teammate bots riding in a player's vehicle (owner, 2 Nov: "bots tend to
 * get out of my vehicles when i start driving"). The rider's "parked" check
 * read a vehicle on the move (its idle clock unset, -Infinity) as parked for
 * good, so riders pressed E about a second after the driver set off. Riders
 * now stay while a teammate drives, and get out when it burns or is about to
 * blow, or when it has stood still a while.
 */

let ironMaw: MapDocument | null = null;
function map(): MapDocument {
  if (!ironMaw) {
    const r = loadMap(readFileSync(fileURLToPath(new URL('../../../maps/iron_maw.json', import.meta.url)), 'utf8'));
    if (!r.ok) throw new Error('iron_maw failed to load');
    ironMaw = r.map;
  }
  return ironMaw;
}

interface MountState {
  pos: { x: number; y: number; z: number };
  speed: number;
  health: number;
  burning: boolean;
  def: { id: string; health: number };
}

/** A player at the wheel of one of Iron Maw's buggies and two teammate bots beside it, who get in by themselves. */
function boarded(seed: number) {
  const m0 = map();
  const match = new Match(m0, { ...rulesForMode(m0, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0 }, seed);
  const team = (match as unknown as { teams: { id: string }[] }).teams[0]!.id;
  const me = match.addHuman('me', undefined, team)!;
  // Explicit looks: how they walk to the doors and fit the seats doesn't move with the roster.
  const riders = [0, 1].map((i) => match.addBot(`r${i}`, CORE_BOT_PROFILES[(i * 5 + 1) % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal, false, { team, look: 'core.ranger' })!);
  let seq = 0;
  const drive = (forward = 0, right = 0, buttons = 0) => match.queueInputs(me.slot, [{ seq: ++seq, forward, right, yaw: me.yaw, pitch: 0, buttons }]);
  for (let i = 0; i < 3; i++) {
    drive();
    match.step();
  }
  const buggy = (match as unknown as { mounts: MountState[] }).mounts.find((m) => m.def.id === 'buggy')!;
  const at = (c: Combatant, dx: number, dz: number) => (c.move = { pos: { x: buggy.pos.x + dx, y: buggy.pos.y, z: buggy.pos.z + dz }, velY: 0, grounded: true });
  at(me, 2.2, 0);
  riders.forEach((r, i) => at(r, 6 + i * 2, 4));
  drive(0, 0, BUTTON_USE);
  match.step();
  drive();
  match.step();
  expect(me.mount?.seat).toBe(0);
  let t = 0;
  for (; t < TICK_RATE * 10 && !riders.every((r) => r.mount); t++) {
    drive();
    match.step();
  }
  expect(riders.every((r) => r.mount)).toBe(true);
  return { match, me, riders, buggy, drive };
}

describe('bots riding with a teammate at the wheel', () => {
  it('stay in for a minute of driving over rough ground (stops at a junction included), and get out once it is on fire', () => {
    const { match, riders, buggy, drive } = boarded(1);
    const start = { ...buggy.pos };
    let travelled = 0;
    let last = { ...buggy.pos };
    let out = -1;
    for (let k = 0; k < TICK_RATE * 60; k++) {
      // Weaving across Iron Maw's slopes, with a 3 s stop every 20 s. The weave is blind: where it ends up hangs on
      // every bump on the way (a prop's collision a hand's width off sent it over the mine pit's edge, 48 m down), and
      // a crash that wrecks the buggy rightly empties it (the next test). Kept repaired, so only driving is tested.
      buggy.health = buggy.def.health;
      const stopped = k % (TICK_RATE * 20) >= TICK_RATE * 17;
      drive(stopped ? 0 : 1, Math.sin(k / 120) * 0.7);
      match.step();
      travelled += Math.hypot(buggy.pos.x - last.x, buggy.pos.z - last.z);
      last = { ...buggy.pos };
      if (out < 0 && !riders.every((r) => r.mount)) out = k;
    }
    expect(out).toBe(-1);
    // It really went somewhere (over the map's slopes), and wasn't on fire.
    expect(travelled).toBeGreaterThan(300);
    expect(Math.hypot(buggy.pos.x - start.x, buggy.pos.z - start.z)).toBeGreaterThan(40);
    expect(buggy.burning).toBe(false);
    // Set on fire while driving: both out within a second and a half (each after its own reaction).
    buggy.burning = true;
    let gone = -1;
    for (let k = 0; k < TICK_RATE * 3 && gone < 0; k++) {
      drive(1, 0);
      match.step();
      if (riders.every((r) => !r.mount)) gone = k;
    }
    expect(gone).toBeGreaterThanOrEqual(0);
    expect(gone).toBeLessThan(TICK_RATE * 1.5);
    expect(riders.every((r) => r.alive)).toBe(true);
  }, 180_000);

  it('get out when it is about to blow (badly damaged), and when it stands parked a while', () => {
    const { match, riders, buggy, drive } = boarded(2);
    for (let k = 0; k < TICK_RATE * 5; k++) {
      drive(1, 0.2);
      match.step();
    }
    expect(riders.every((r) => r.mount)).toBe(true);
    // Wrecked to a quarter (the burn threshold aside): about to blow.
    buggy.health = buggy.def.health * 0.25;
    let gone = -1;
    for (let k = 0; k < TICK_RATE * 3 && gone < 0; k++) {
      drive(0.5, 0);
      match.step();
      if (riders.every((r) => !r.mount)) gone = k;
    }
    expect(gone).toBeGreaterThanOrEqual(0);
    expect(gone).toBeLessThan(TICK_RATE * 1.5);

    // A fresh ride: the driver stops and stays stopped; the riders sit 8 s, then go about their business.
    const b = boarded(3);
    let out = -1;
    for (let k = 0; k < TICK_RATE * 14 && out < 0; k++) {
      b.drive();
      b.match.step();
      if (b.riders.some((r) => !r.mount)) out = k;
    }
    expect(out).toBeGreaterThan(TICK_RATE * 7);
    expect(out).toBeLessThan(TICK_RATE * 12);
  }, 180_000);
});
