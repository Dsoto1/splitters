// A Dropship wedged on Shingle Point's beach (owner, 2026-11-07): a bot flew it into a landing craft wreck's hull and
// left it there, turned across the hull; nobody could get in by its nose or tail (4.8 m from its centre, past its
// 4.5 m enter radius), and bots kept walking back to it. The three fixes: flyers climb over what they are driven
// into, you get in near the hull (not only its centre), and bots that can't get in give up on that mount for longer
// each time; the match marks a wedged vehicle for every bot.
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, DEFAULT_DEATHMATCH_RULES, ENTER_HULL_REACH, MOUNT_DEFS, enterReach, initPhysics, type MapDocument, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { avoidSeconds, boardingSpot, inBoardingReach, vehicleFor, STUCK_AVOID_SECONDS, MAX_BOARD_FAILS, type MountView } from '../src/bots/vehicles.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

interface MountLike {
  index: number;
  pos: { x: number; y: number; z: number };
  yaw: number;
  speed: number;
  seats: (number | null)[];
  wedged?: { at: unknown };
  climbAssist: number;
}
const internals = (match: Match) => match as unknown as { mounts: MountLike[]; enterMount(c: Combatant): boolean; mountViews(actors: readonly Combatant[]): MountView[] };

/** An open yard 48 × 64 m (x -4..44, z -4..60), a vehicle at (20, 0, 6) facing +z, and a prop 12 m ahead of it. */
function yard(model: string, prop?: { model: string; yaw: number }): MapDocument {
  const tiles = [];
  for (let x = 0; x < 6; x++) for (let y = 0; y < 8; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[2, 0, 2]]);
  return {
    ...map,
    entities: [
      ...map.entities,
      { id: 'mount_0', kind: 'mount' as const, position: [20, 0, 6], model: model as 'dropship', yaw: 0, faction: null, respawnSeconds: null },
      ...(prop ? [{ id: 'prop_0', kind: 'prop' as const, position: [20, 0, 18] as [number, number, number], model: prop.model, yaw: prop.yaw, scale: 1, solid: true, tint: null }] : []),
    ],
  };
}

const rules = { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, respawnDelayTicks: 100_000 };

describe('getting in near the hull', () => {
  const ship = MOUNT_DEFS.dropship;
  const at = { x: 0, y: 0, z: 0 };
  it("the Dropship's nose and tail are past its enter radius from its centre, and in reach from its hull", () => {
    expect(ship.half[2]).toBeGreaterThan(ship.enterRadius);
    // Standing a pace off its nose (it faces +z at yaw 0) or its tail.
    expect(enterReach(ship, at, 0, { x: 0, y: 0, z: ship.half[2] + 0.8 })).not.toBeNull();
    expect(enterReach(ship, at, 0, { x: 0.5, y: 0, z: -ship.half[2] - 0.8 })).not.toBeNull();
    // Turned: its nose points along +x.
    expect(enterReach(ship, at, Math.PI / 2, { x: ship.half[2] + 1, y: 0, z: 0 })).not.toBeNull();
    expect(enterReach(ship, at, Math.PI / 2, { x: 0, y: 0, z: ship.half[2] + 1 })).toBeNull();
    // Too far off the hull, too far below it or above its roof: no.
    expect(enterReach(ship, at, 0, { x: 0, y: 0, z: ship.half[2] + ENTER_HULL_REACH + 0.3 })).toBeNull();
    expect(enterReach(ship, at, 0, { x: 2.5, y: -2.6, z: 0 })).toBeNull();
    expect(enterReach(ship, at, 0, { x: 2.5, y: 2.6, z: 0 })).toBeNull();
    // Small mounts keep their enter radius (a turret's hull is well inside it).
    const mg = MOUNT_DEFS.turret_mg;
    expect(enterReach(mg, at, 0, { x: mg.enterRadius - 0.1, y: 0, z: 0 })).not.toBeNull();
  });

  it('a player at the nose of a Dropship gets in (before: 4.8 m from its centre, refused)', () => {
    const match = new Match(yard('dropship'), rules, 1);
    const me = match.addHuman('me')!;
    match.step();
    me.move = { pos: { x: 20, y: 0, z: 6 + MOUNT_DEFS.dropship.half[2] + 0.8 }, velY: 0, grounded: true };
    expect(internals(match).enterMount(me)).toBe(true);
  });

  it("bots walk to a spot just off the hull, on their side of it, and can get in from there", () => {
    const m: MountView = { index: 0, kind: 'vehicle', pos: { x: 10, y: 0, z: 10 }, yaw: 0.7, health: 1, alive: true, enterRadius: 4.5, half: MOUNT_DEFS.dropship.half, seats: [{ role: 'driver', free: true }] };
    for (const from of [{ x: 30, y: 0, z: 10 }, { x: 10, y: 0, z: -20 }, { x: -5, y: 0, z: 25 }, { x: 10.2, y: 0, z: 10.4 }]) {
      const spot = boardingSpot(m, from);
      expect(inBoardingReach(m, spot)).toBe(true);
      // Outside the hull (not in its centre, where no route goes).
      const dx = spot.x - m.pos.x;
      const dz = spot.z - m.pos.z;
      const lx = dx * Math.cos(m.yaw) - dz * Math.sin(m.yaw);
      const lz = dx * Math.sin(m.yaw) + dz * Math.cos(m.yaw);
      expect(Math.abs(lx) > m.half![0] || Math.abs(lz) > m.half![2]).toBe(true);
    }
  });
});

describe('flyers driven into something they cannot pass', () => {
  it('a Dropship flown at a landing craft wreck lifts over it instead of wedging, then settles back down', () => {
    // The wreck turned across its path: a hull 3.2-3.9 m tall (before, the Dropship stopped against it for good).
    const match = new Match(yard('dropship', { model: 'prop.landing_craft_wreck', yaw: Math.PI / 2 }), rules, 1);
    const pilot = match.addHuman('pilot')!;
    match.step();
    pilot.move = { pos: { x: 21, y: 0, z: 6 }, velY: 0, grounded: true };
    const { mounts, enterMount } = internals(match);
    expect(enterMount.call(match, pilot)).toBe(true);
    const ship = mounts[0]!;
    let seq = 0;
    let top = 0;
    let past = -1;
    for (let t = 0; t < 60 * 14; t++) {
      const i: PlayerInput = { seq: ++seq, forward: 1, right: 0, yaw: 0, pitch: 0, buttons: 0 };
      match.queueInputs(pilot.slot, [i]);
      match.step();
      top = Math.max(top, ship.pos.y);
      if (past < 0 && ship.pos.z > 26) past = t;
      // Over and well past it, short of the yard's far wall: down again (by as much as it rose on its own).
      if (past >= 0 && t > past + 60 * 3) break;
    }
    expect(past).toBeGreaterThan(0);
    expect(top).toBeGreaterThan(3.2);
    expect(ship.pos.y).toBeLessThan(top - 1.5);
    expect(ship.wedged).toBeUndefined();
  });
});

describe('a wedged vehicle', () => {
  it('the match marks a vehicle driven and going nowhere as wedged; bots leave it; moved away, it is free again', () => {
    const match = new Match(yard('gun_jeep'), rules, 2);
    const driver = match.addHuman('driver')!;
    match.step();
    driver.move = { pos: { x: 21, y: 0, z: 6 }, velY: 0, grounded: true };
    const { mounts, enterMount, mountViews } = internals(match);
    expect(enterMount.call(match, driver)).toBe(true);
    const jeep = mounts[0]!;
    let seq = 0;
    // Into the yard's far wall, head on: the throttle open and going nowhere.
    let stoppedAt = -1;
    for (let t = 0; t < 60 * 20 && !jeep.wedged; t++) {
      match.queueInputs(driver.slot, [{ seq: ++seq, forward: 1, right: 0, yaw: 0, pitch: 0, buttons: 0 }]);
      match.step();
      if (stoppedAt < 0 && jeep.pos.z > 50 && Math.abs(jeep.speed) < 6) stoppedAt = t;
    }
    expect(jeep.wedged).toBeDefined();
    const view = mountViews.call(match, match.combatants()).find((v) => v.index === jeep.index)!;
    expect(view.wedged).toBe(true);
    const free = { ...view, humanNear: false, seats: view.seats.map((s) => ({ ...s, free: true })) };
    // A bot beside it with a long trip the way it would go.
    const near = { x: jeep.pos.x + 2, y: 0, z: jeep.pos.z - 3 };
    const goal = { x: jeep.pos.x, y: 0, z: jeep.pos.z - 70 };
    expect(vehicleFor([free], near, goal, 22)).toBeNull();
    expect(vehicleFor([{ ...free, wedged: undefined }], near, goal, 22)?.index).toBe(jeep.index);
    // Got out (backed away from the wall): no longer wedged once it is a few metres from where it stuck.
    for (let t = 0; t < 60 * 4 && jeep.wedged; t++) {
      match.queueInputs(driver.slot, [{ seq: ++seq, forward: -1, right: 0, yaw: 0, pitch: 0, buttons: 0 }]);
      match.step();
    }
    expect(jeep.wedged).toBeUndefined();
  });
});

describe('bots that cannot get in', () => {
  const quiet = { ...CORE_BOT_PROFILES[3]!, exploration: 0, itemGreed: 0, tags: [] };
  type Brain = { mountPlan: { index: number; until: number; drive: boolean } | null; state: string; avoidMounts: Map<number, number>; boarding: { tries: number; failed: number; gaveUp: number; back: number } };

  it(`give up on that mount after ${MAX_BOARD_FAILS} failed boardings, and stay away longer each time (no going back and forth)`, () => {
    const match = new Match(yard('gun_jeep'), rules, 3);
    const bot = match.addBot('bot', quiet, BOT_DIFFICULTIES.normal)!;
    match.step();
    const { mounts } = internals(match);
    const jeep = mounts[0]!;
    // Every use is refused (as at a vehicle the mode won't let it into, or one that turned out to be out of reach).
    (match as unknown as { enterMount: () => boolean }).enterMount = () => false;
    const brain = bot.bot as unknown as Brain;
    const tryBoarding = () => {
      bot.move = { pos: { x: 22, y: 0, z: 6 }, velY: 0, grounded: true };
      brain.mountPlan = { index: jeep.index, until: match.tick + 60 * 20, drive: true };
      brain.state = 'mount';
      let gaveUpAt = -1;
      for (let t = 0; t < 60 * 6 && gaveUpAt < 0; t++) {
        match.step();
        if (!brain.mountPlan) gaveUpAt = match.tick;
      }
      return gaveUpAt;
    };
    const first = tryBoarding();
    expect(first).toBeGreaterThan(0);
    expect(brain.boarding.failed).toBe(MAX_BOARD_FAILS);
    expect(brain.boarding.gaveUp).toBe(1);
    expect((brain.avoidMounts.get(jeep.index) ?? 0) - first).toBeGreaterThanOrEqual(60 * STUCK_AVOID_SECONDS - 2);
    // The next time it gives up on the same one (after the first spell is over), twice as long.
    brain.avoidMounts.set(jeep.index, match.tick - 1);
    const second = tryBoarding();
    expect(second).toBeGreaterThan(0);
    expect(brain.boarding.gaveUp).toBe(2);
    expect((brain.avoidMounts.get(jeep.index) ?? 0) - second).toBeGreaterThanOrEqual(60 * avoidSeconds(2) - 2);
    expect(avoidSeconds(2)).toBe(2 * STUCK_AVOID_SECONDS);
  });

  it('a bot at a Dropship gets in by its hull (it pressed use only within the centre radius before)', () => {
    const match = new Match(yard('dropship'), rules, 4);
    const bot = match.addBot('bot', quiet, BOT_DIFFICULTIES.normal)!;
    match.step();
    const jeep = internals(match).mounts[0]!;
    const brain = bot.bot as unknown as Brain;
    // Off its tail: 5.6 m from its centre.
    bot.move = { pos: { x: 20, y: 0, z: 6 - MOUNT_DEFS.dropship.half[2] - 0.8 }, velY: 0, grounded: true };
    brain.mountPlan = { index: jeep.index, until: match.tick + 60 * 10, drive: true };
    brain.state = 'mount';
    let inAt = -1;
    for (let t = 0; t < 60 * 3 && inAt < 0; t++) {
      match.step();
      if (bot.mount) inAt = t;
    }
    expect(inAt).toBeGreaterThanOrEqual(0);
    expect(brain.boarding.failed).toBe(0);
  });
});
