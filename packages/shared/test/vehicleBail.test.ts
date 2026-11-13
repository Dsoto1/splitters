// Left over from the hovercraft fix (HANDOFF, "Hovercraft under structures"): on Midnight Keel a bot bailed out of a
// Hauler at 12.7 m/s, the empty craft glided ~35 m on (an empty hovercraft only eased off at accel × 0.35) into the 3 m door
// at (0, 0, 28) and plugged it for 100 s, and foot bots' stuck recoveries went from 3.09 to 5.41 a bot-minute. Three
// fixes: an empty vehicle brakes to a stop (`vehicle.idleBrake`); a bot getting out slows under BAIL_SPEED first
// (unless it burns or is about to blow); bot drivers keep off routes their hull doesn't fit (vehicleRouteFits, at the
// vehicle's `routeFit` share of its half width; the tanks' routeFits, for every ground vehicle and hovercraft).
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, DEFAULT_DEATHMATCH_RULES, MOUNT_DEFS, TICK_RATE, initPhysics, loadMap, rulesForMode, type MapDocument, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { BAIL_SPEED } from '../src/bots/brain.ts';
import { routeFits, vehicleRouteFits, type MountView } from '../src/bots/vehicles.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

interface MountLike {
  index: number;
  def: (typeof MOUNT_DEFS)[keyof typeof MOUNT_DEFS];
  pos: { x: number; y: number; z: number };
  yaw: number;
  speed: number;
  slide: number;
  burning: boolean;
  body: unknown;
}
type Internals = {
  mounts: MountLike[];
  enterMount(c: Combatant): boolean;
  leaveMount(c: Combatant, step: boolean): void;
  mountViews(actors: readonly Combatant[]): MountView[];
  nav: { findPath(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): { x: number; y: number; z: number }[] | null; };
  physics: { setBoxPose(b: unknown, c: unknown, y: number): void };
};
const internals = (match: Match) => match as unknown as Internals;

const rules = { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, respawnDelayTicks: 100_000 };
const quiet = { ...CORE_BOT_PROFILES[3]!, exploration: 0, itemGreed: 0, tags: [] };

/** An open yard of `w` × `h` 8 m tiles from (-4, -4) with one `model` at (20, 0, 6) facing +z. */
function yard(model: string, w = 6, h = 14, spawns: [number, number, number][] = [[2, 0, 2]]): MapDocument {
  const tiles = [];
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, spawns);
  return { ...map, entities: [...map.entities, { id: 'mount_0', kind: 'mount' as const, position: [20, 0, 6], model: model as 'hauler', yaw: 0, faction: null, respawnSeconds: null }] };
}

const mapFile = (id: string): MapDocument => {
  const loaded = loadMap(readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8'));
  if (!loaded.ok) throw new Error(`${id} failed to load`);
  return loaded.map;
};

const place = (c: Combatant, x: number, y: number, z: number) => {
  c.move = { pos: { x, y, z }, velY: 0, grounded: true };
  c.bot?.onSpawn(c.yaw);
};

/** Put mount `m` at `at` facing `yaw`. */
function pose(match: Match, m: MountLike, at: [number, number, number], yaw: number) {
  m.pos = { x: at[0], y: at[1], z: at[2] };
  m.yaw = yaw;
  internals(match).physics.setBoxPose(m.body, { x: at[0], y: at[1] + m.def.half[1], z: at[2] }, yaw);
}

describe('an empty vehicle brakes to a stop (vehicle.idleBrake)', () => {
  const MODELS = ['hauler', 'speeder', 'hover_bike', 'snow_sled', 'troop_buggy', 'gun_jeep', 'tank'] as const;
  for (const model of MODELS) {
    it(`${model}: got out of flat out, it stops within its braking distance (not a long glide)`, () => {
      const match = new Match(yard(model, 16, 30), rules, 1);
      const driver = match.addHuman('driver')!;
      match.step();
      const m = internals(match).mounts[0]!;
      pose(match, m, [60, 0, 6], 0);
      place(driver, 60, 0, 6);
      expect(internals(match).enterMount(driver)).toBe(true);
      let seq = 0;
      const send = (i: Partial<PlayerInput>) => match.queueInputs(driver.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0, ...i }]);
      // Flat out (or 12.7 m/s, the Midnight Keel bail-out, whichever is less), straight ahead.
      const want = Math.min(12.7, m.def.vehicle!.maxSpeed * 0.95);
      for (let t = 0; t < TICK_RATE * 6 && m.speed < want; t++) {
        send({ forward: 1 });
        match.step();
      }
      expect(m.speed).toBeGreaterThan(want - 0.5);
      const v = m.speed;
      internals(match).leaveMount(driver, true);
      const from = { ...m.pos };
      let ticks = 0;
      while (Math.abs(m.speed) > 0.01 && ticks < TICK_RATE * 10) {
        match.step();
        ticks++;
      }
      const went = Math.hypot(m.pos.x - from.x, m.pos.z - from.z);
      const brake = m.def.vehicle!.idleBrake!;
      expect(brake).toBeGreaterThan(0);
      // v² / 2a, plus a tick or two of slack.
      expect(went).toBeLessThan((v * v) / (2 * brake) + v / 20 + 0.3);
      expect(Math.abs(m.slide)).toBeLessThan(0.05);
      // A Hauler at 12.7 m/s: about 7 m (before: ~35 m, at accel × 0.35).
      if (model === 'hauler') expect(went).toBeLessThan(8);
      // And it stays stopped.
      for (let t = 0; t < TICK_RATE; t++) match.step();
      expect(Math.hypot(m.pos.x - from.x, m.pos.z - from.z) - went).toBeLessThan(0.02);
    });
  }

  it('every vehicle that drives on the ground or hovers has an idleBrake in its data', () => {
    for (const def of Object.values(MOUNT_DEFS)) if (def.vehicle) expect(def.vehicle.idleBrake, def.id).toBeGreaterThan(0);
  });
});

describe('a bot getting out slows down first', () => {
  /** A bot at the wheel of a Hauler in a long yard heading for its far end (it gets out within 14 m of it). */
  function drive(burnAt?: number) {
    const match = new Match(yard('hauler', 6, 14), rules, 3);
    const bot = match.addBot('bot', quiet, BOT_DIFFICULTIES.normal)!;
    match.step();
    const m = internals(match).mounts[0]!;
    place(bot, 22, 0, 6);
    expect(internals(match).enterMount(bot)).toBe(true);
    (bot.bot as unknown as { roamGoal: { x: number; y: number; z: number } }).roamGoal = { x: 20, y: 0, z: 100 };
    let top = 0;
    let outAt = -1;
    let outSpeed = -1;
    for (let t = 0; t < TICK_RATE * 20 && outAt < 0; t++) {
      if (burnAt !== undefined && m.speed > burnAt) m.burning = true;
      match.step();
      top = Math.max(top, m.speed);
      if (!bot.mount) {
        outAt = t;
        outSpeed = Math.abs(m.speed);
      }
    }
    return { match, m, top, outAt, outSpeed };
  }

  it('arrived at speed: it brakes under BAIL_SPEED, then gets out; the empty Hauler stops within a metre', () => {
    const { match, m, top, outAt, outSpeed } = drive();
    expect(top).toBeGreaterThan(11);
    expect(outAt).toBeGreaterThan(0);
    expect(outSpeed).toBeLessThan(BAIL_SPEED + 0.3);
    const at = { ...m.pos };
    for (let t = 0; t < TICK_RATE * 3; t++) match.step();
    expect(Math.hypot(m.pos.x - at.x, m.pos.z - at.z)).toBeLessThan(1);
  });

  it('on fire: it gets out at once, at speed', () => {
    const { outAt, outSpeed } = drive(10);
    expect(outAt).toBeGreaterThan(0);
    expect(outSpeed).toBeGreaterThan(8);
  });

  it("on Midnight Keel's sea: it stays aboard a while rather than jump into the water", () => {
    const map = mapFile('iron_tide');
    const match = new Match(map, { ...rulesForMode(map, 'core.tdm'), scoreLimit: 0, respawnDelayTicks: 100_000 }, 4);
    const bot = match.addBot('bot', quiet, BOT_DIFFICULTIES.normal)!;
    match.step();
    const m = internals(match).mounts.find((x) => x.def.id === 'hauler')!;
    pose(match, m, [-60, -1.4, 72], 0);
    place(bot, -58, -1.4, 72);
    expect(internals(match).enterMount(bot)).toBe(true);
    for (let t = 0; t < 30; t++) match.step();
    expect(internals(match).mountViews([]).find((v) => v.index === m.index)!.overWater).toBe(true);
    // Arrived (its goal right here): it wants out.
    (bot.bot as unknown as { roamGoal: { x: number; y: number; z: number } }).roamGoal = { x: -60, y: -1.4, z: 74 };
    let out = -1;
    for (let t = 0; t < TICK_RATE * 14 && out < 0; t++) {
      match.step();
      if (!bot.mount) out = t;
    }
    // Not at once (before: out within a second); in the end it does get out (EXIT_GROUND_WAIT, 8 s).
    expect(out).toBeGreaterThan(TICK_RATE * 6);
  });
});

describe('bot drivers keep to routes their hull fits (vehicleRouteFits)', () => {
  const ironTide = mapFile('iron_tide');
  const tdm = { ...rulesForMode(ironTide, 'core.tdm'), scoreLimit: 0, respawnDelayTicks: 100_000 };

  it('each ground vehicle and hovercraft clears its route at its routeFit share (the Tank 0.8); flyers have none', () => {
    const match = new Match(yard('hauler'), rules, 1);
    match.step();
    const views = internals(match).mountViews([]);
    expect(views[0]!.routeHalfWidth).toBeCloseTo(MOUNT_DEFS.hauler.half[0] * 0.95, 6);
    expect(MOUNT_DEFS.tank.vehicle!.routeFit).toBe(0.8);
    for (const id of ['dropship', 'gunship', 'skyfighter'] as const) expect(MOUNT_DEFS[id].vehicle!.fly, id).toBeTruthy();
    const flyer = new Match(yard('skyfighter'), rules, 1);
    flyer.step();
    expect(internals(flyer).mountViews([])[0]!.routeHalfWidth).toBeUndefined();
  });

  it("Midnight Keel's 3 m door at (0, 0, 28): no route through it for a Hauler (3.04 m probe); a Hover Bike's fits", () => {
    const match = new Match(ironTide, tdm, 1);
    match.step();
    const path = internals(match).nav.findPath({ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: 45 })!;
    expect(path).toBeTruthy();
    const view = (id: 'hauler' | 'hover_bike' | 'speeder'): Pick<MountView, 'routeHalfWidth' | 'half'> => ({ half: MOUNT_DEFS[id].half, routeHalfWidth: Math.min(MOUNT_DEFS[id].half[0], MOUNT_DEFS[id].half[2]) * 0.95 });
    expect(vehicleRouteFits(match.physics, view('hauler'), path)).toBe(false);
    expect(vehicleRouteFits(match.physics, view('hover_bike'), path)).toBe(true);
    // Only the first `upTo` m are looked at: short of the door, it fits.
    expect(vehicleRouteFits(match.physics, view('hauler'), path, 8)).toBe(true);
    // A flyer (no routeHalfWidth) goes anywhere.
    expect(vehicleRouteFits(match.physics, { half: MOUNT_DEFS.hauler.half }, path)).toBe(true);
  });

  it("Midnight Keel's centre stairs (a beam at 3 m over their foot): a tank's or jeep's level hull doesn't fit up them", () => {
    // Driven up them, the tank and the gun jeep stop on the first step (their hull's rear meets the beam at x -4.5..-4,
    // 3-4 m up) and were left there, plugging the stairs: Midnight Keel's worst foot-bot stuck spot, (-4, 1, 16).
    const match = new Match(ironTide, tdm, 1);
    match.step();
    const path = internals(match).nav.findPath({ x: 1, y: 0, z: 16 }, { x: -11, y: 4, z: 16 })!;
    expect(path).toBeTruthy();
    const views = internals(match).mountViews([]);
    const view = (id: string) => views.find((v) => MOUNT_DEFS[id as 'tank'].half === v.half)!;
    expect(vehicleRouteFits(match.physics, view('tank'), path)).toBe(false);
    expect(vehicleRouteFits(match.physics, view('gun_jeep'), path)).toBe(false);
    // Without the hull's height (the clearance alone, as before) the tank's route passed.
    const tank = view('tank');
    expect(routeFits(match.physics, path, tank.routeHalfWidth!, 5)).toBe(true);
    // Across an open yard every vehicle's route fits.
    const field = new Match(yard('hauler', 8, 14), rules, 1);
    field.step();
    const open = internals(field).nav.findPath({ x: 4, y: 0, z: 4 }, { x: 50, y: 0, z: 100 })!;
    for (const id of ['tank', 'gun_jeep', 'speeder', 'hauler', 'hover_bike', 'armored_rover']) {
      const d = MOUNT_DEFS[id as 'tank'];
      expect(vehicleRouteFits(field.physics, { half: d.half, routeHalfWidth: Math.min(d.half[0], d.half[2]) * (d.vehicle!.routeFit ?? 0.95) }, open), id).toBe(true);
    }
  });

  it('a bot at the wheel of a Hauler, sent through that door, gets out short of it instead of driving in', () => {
    const match = new Match(ironTide, tdm, 2);
    const bot = match.addBot('bot', quiet, BOT_DIFFICULTIES.normal)!;
    match.step();
    const m = internals(match).mounts.find((x) => x.def.id === 'hauler')!;
    pose(match, m, [0, 0.1, 8], 0);
    place(bot, 2.5, 0.1, 8);
    expect(internals(match).enterMount(bot)).toBe(true);
    (bot.bot as unknown as { roamGoal: { x: number; y: number; z: number } }).roamGoal = { x: 0, y: 0, z: 45 };
    let nose = -Infinity;
    let out = -1;
    for (let t = 0; t < TICK_RATE * 10 && out < 0; t++) {
      match.step();
      nose = Math.max(nose, m.pos.z + m.def.half[2]);
      if (!bot.mount) out = t;
    }
    expect(out).toBeGreaterThan(0);
    // Never in the door (its jambs at z 27.5..28.5).
    expect(nose).toBeLessThan(27);
    for (let t = 0; t < TICK_RATE * 3; t++) match.step();
    expect(m.pos.z + m.def.half[2]).toBeLessThan(27);
  });
});
