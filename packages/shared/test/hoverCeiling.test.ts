// Hovercraft stuck under structures (owner, 2026-11-07): a Hauler wedged under Iron Tide's platforms at (-16, 5, -20)
// (the top of the stairs up to the deck, under the roof's lintel), and the Hauler, Speeder and Hover Bike wedged
// under structures on Iron Tide and Dune Harbor. A vehicle moves on a probe capsule whose radius follows its hull's
// width, so its dome stands well over the hull (Hauler 3.4 m against a 2 m hull; Speeder 2.8 against 1.3; Hover Bike
// 2.4 against 1.0): under a deck, beam or roof the hull fits under, the dome caught and the craft could go neither in
// nor out. With something over the hull, the vehicle now moves on a low probe of the same bottom cut off at the
// hull's top (Match.moveVehicleProbe); over open ground nothing changes.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_DEATHMATCH_RULES, MOUNT_DEFS, initPhysics, loadMap, rulesForMode, type MapDocument, type MapEntity, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { freshDrive, steer, type MountView } from '../src/bots/vehicles.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const HOVERCRAFT = ['hauler', 'speeder', 'hover_bike'] as const;
type Craft = (typeof HOVERCRAFT)[number];

interface MountLike {
  index: number;
  def: { id: string; half: [number, number, number] };
  pos: { x: number; y: number; z: number };
  yaw: number;
  speed: number;
  slide: number;
  velY: number;
  stall: number;
  body: unknown;
  wedged?: { at: unknown };
}
type Internals = { mounts: MountLike[]; enterMount(c: Combatant): boolean; physics: { setBoxPose(b: unknown, c: unknown, y: number): void; boxClear(c: unknown, h: unknown): boolean } };
const internals = (match: Match) => match as unknown as Internals;

const rules = { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, respawnDelayTicks: 100_000 };

/** Open yard (6 x 8 tiles: 48 x 64 m, x -4..44, z -4..60) with a hovercraft at (20, 0, 6) facing +z, and blocks. */
function yard(model: Craft, blocks: MapEntity[] = [], size: [number, number] = [6, 8]): MapDocument {
  const tiles = [];
  for (let x = 0; x < size[0]; x++) for (let y = 0; y < size[1]; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[2, 0, 2]]);
  return { ...map, entities: [...map.entities, { id: 'mount_0', kind: 'mount' as const, position: [20, 0, 6], model, yaw: 0, faction: null, respawnSeconds: null }, ...blocks] };
}

const slab = (id: string, x: number, bottom: number, z: number, w: number, d: number): MapEntity => ({ id, kind: 'block', position: [x, bottom, z], size: [w, 3, d], yaw: 0, material: null, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 });

const mapFile = (id: string): MapDocument => {
  const loaded = loadMap(readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8'));
  if (!loaded.ok) throw new Error(`${id} failed to load`);
  return loaded.map;
};

/** A driver (a player) in the first `model` of the match, put at `at` facing `yaw`. */
function seat(match: Match, model: string, at: [number, number, number], yaw: number) {
  const driver = match.addHuman('driver')!;
  match.step();
  const int = internals(match);
  const m = int.mounts.find((x) => x.def.id === model)!;
  m.pos = { x: at[0], y: at[1], z: at[2] };
  m.yaw = yaw;
  int.physics.setBoxPose(m.body, { x: at[0], y: at[1] + m.def.half[1], z: at[2] }, yaw);
  driver.move = { pos: { x: at[0], y: at[1], z: at[2] }, velY: 0, grounded: true };
  expect(int.enterMount.call(match, driver)).toBe(true);
  let seq = 0;
  const send = (i: Partial<PlayerInput>) => match.queueInputs(driver.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0, ...i }]);
  return { m, send };
}

/**
 * Whether the top of the hull's middle (its upper 40 %, over the probe: the probe's width) is clear of the world: the
 * craft is never pushed up into a deck, a lintel or a ceiling. (The lower part rides over steps and sills.) The
 * vehicle's own box is solid in the world, so it is moved out of the way for the test.
 */
function hullClear(match: Match, m: MountLike): boolean {
  const r = Math.min(m.def.half[0], m.def.half[2]) * 0.95 * 0.7;
  const h = m.def.half[1] * 2;
  const ph = internals(match).physics;
  ph.setBoxPose(m.body, { x: m.pos.x, y: m.pos.y - 500, z: m.pos.z }, m.yaw);
  const clear = ph.boxClear({ x: m.pos.x, y: m.pos.y + h * 0.8 - 0.025, z: m.pos.z }, { x: r, y: h * 0.2 - 0.025, z: r });
  ph.setBoxPose(m.body, { x: m.pos.x, y: m.pos.y + m.def.half[1], z: m.pos.z }, m.yaw);
  return clear;
}

/** Drive with `input` for `seconds` or until `done`; the ticks it took (or -1), and whether the hull stayed clear. */
function drive(match: Match, m: MountLike, send: (i: Partial<PlayerInput>) => void, input: Partial<PlayerInput>, seconds: number, done: () => boolean) {
  let clear = true;
  for (let t = 0; t < 60 * seconds; t++) {
    send(input);
    match.step();
    if (!hullClear(match, m)) clear = false;
    if (done()) return { ticks: t, clear };
  }
  return { ticks: -1, clear };
}

describe('hovercraft over open ground (unchanged by the low-ceiling fix)', () => {
  // Measured on main before the fix, the same drive: 2 s flat out, 2 s flat out turning hard right, 1 s coasting.
  // Ride height (feet over the yard's floor, lowest and highest), top speed, and where it ended up. The low probe only
  // comes in with something over the hull, so these match to the millimetre.
  const before: Record<Craft, { yMin: number; yMax: number; top: number; x: number; z: number; speed: number }> = {
    hauler: { yMin: 0.02, yMax: 0.0338, top: 13, x: 64.2711, z: 37.8082, speed: 10.9 },
    speeder: { yMin: 0.02, yMax: 0.032, top: 24, x: 83.178, z: 27.147, speed: 19.1 },
    hover_bike: { yMin: 0.02, yMax: 0.0338, top: 31, x: 82.3629, z: 19.109, speed: 24.7 },
  };
  for (const model of HOVERCRAFT) {
    it(`${model}: ride height and speed on flat ground`, () => {
      const match = new Match(yard(model, [], [16, 16]), rules, 1);
      const { m, send } = seat(match, model, [40, 0, 2], 0);
      let yMin = Infinity;
      let yMax = -Infinity;
      let top = 0;
      for (let t = 0; t < 60 * 5; t++) {
        send(t < 120 ? { forward: 1 } : t < 240 ? { forward: 1, right: 1 } : {});
        match.step();
        if (t > 10) {
          yMin = Math.min(yMin, m.pos.y);
          yMax = Math.max(yMax, m.pos.y);
        }
        top = Math.max(top, m.speed);
      }
      const got = { yMin, yMax, top, x: m.pos.x, z: m.pos.z, speed: m.speed };
      for (const k of Object.keys(got) as (keyof typeof got)[]) expect(got[k], k).toBeCloseTo(before[model][k], 3);
      // It rides level: a couple of centimetres over the floor all the way.
      expect(yMax - yMin).toBeLessThan(0.02);
    });
  }
});

describe('Iron Tide: the Hauler under the platforms (the owner\'s spot, -16, 5, -20)', () => {
  // The deck (top 4.1 m) runs along x -18..-14; at z -20 it meets the stairs through a door 3 m wide (jambs at x -17.5
  // and -14.5, y 4-8, its lintel and the roof at 7-8 m). The Hauler's probe (3 m across) can't pass the door: pinched
  // between the jambs the controller refused every move, and the 5 cm each move starts up stayed, so the Hauler rose
  // up the door into the lintel and the roof (feet past 6 m, its body centre at 5 m and more) and stuck there.
  it('driven into the door from the deck, it stops at deck height (no climbing into the lintel) and backs out', () => {
    const match = new Match(mapFile('iron_tide'), { ...rulesForMode(mapFile('iron_tide'), 'core.tdm'), scoreLimit: 0, respawnDelayTicks: 100_000 }, 1);
    const { m, send } = seat(match, 'hauler', [-16, 4.1, -10], Math.PI);
    let top = 0;
    let clear = true;
    for (let t = 0; t < 60 * 5; t++) {
      send({ forward: 1 });
      match.step();
      top = Math.max(top, m.pos.y);
      if (!hullClear(match, m)) clear = false;
    }
    // At the door (it doesn't fit through), on the deck: before, its feet were at 6.2 m after 2 s, in the roof.
    expect(m.pos.z).toBeLessThan(-19);
    expect(top).toBeLessThan(4.3);
    expect(clear).toBe(true);
    const at = { ...m.pos };
    const out = drive(match, m, send, { forward: -1 }, 5, () => Math.hypot(m.pos.x - at.x, m.pos.z - at.z) > 8);
    expect(out.ticks).toBeGreaterThan(0);
    expect(out.clear).toBe(true);
    expect(m.pos.y).toBeLessThan(4.3);
    // Got out: no longer marked wedged (bots take it again).
    expect(m.wedged).toBeUndefined();
  });

  it('driven up the stairs from the ground floor to the same door, it stops low and backs out', () => {
    const map = mapFile('iron_tide');
    const match = new Match(map, { ...rulesForMode(map, 'core.tdm'), scoreLimit: 0, respawnDelayTicks: 100_000 }, 1);
    const { m, send } = seat(match, 'hauler', [-16, 0.3, -32], 0);
    const inn = drive(match, m, send, { forward: 1 }, 5, () => false);
    expect(inn.clear).toBe(true);
    // Before: bouncing 0.4-2.1 m up the stairs' doorway, pinched.
    expect(m.pos.y).toBeLessThan(0.5);
    const at = { ...m.pos };
    const out = drive(match, m, send, { forward: -1 }, 5, () => Math.hypot(m.pos.x - at.x, m.pos.z - at.z) > 5);
    expect(out.ticks).toBeGreaterThan(0);
    expect(out.clear).toBe(true);
  });
});

describe('Dune Harbor: a doorway with a low lintel', () => {
  // The arcade south of the middle (x -24): a 0.9 m sill and a lintel at 2.5 m (1.6 m clear over the sill), a roof at
  // 3.5 m behind it. A Speeder's hull (1.3 m) fits under the lintel; its probe (2.8 m) didn't, so it wedged there.
  const map = () => mapFile('dune_harbor');
  it('a Speeder drives through under the lintel', () => {
    const match = new Match(map(), { ...rulesForMode(map(), 'core.tdm'), scoreLimit: 0, respawnDelayTicks: 100_000 }, 1);
    const { m, send } = seat(match, 'speeder', [-24, 0, -24], 0);
    const run = drive(match, m, send, { forward: 1 }, 5, () => m.pos.z > 0);
    expect(run.ticks).toBeGreaterThan(0);
    expect(run.clear).toBe(true);
    expect(m.wedged).toBeUndefined();
  });

  it("a Hauler (its 2 m hull doesn't fit) stops at the doorway, outside the lintel, and backs out", () => {
    const match = new Match(map(), { ...rulesForMode(map(), 'core.tdm'), scoreLimit: 0, respawnDelayTicks: 100_000 }, 1);
    const { m, send } = seat(match, 'hauler', [-24, 0.5, -28], 0);
    const inn = drive(match, m, send, { forward: 1 }, 5, () => false);
    expect(inn.clear).toBe(true);
    expect(m.pos.z).toBeLessThan(-12);
    const at = { ...m.pos };
    const out = drive(match, m, send, { forward: -1 }, 5, () => Math.hypot(m.pos.x - at.x, m.pos.z - at.z) > 5);
    expect(out.ticks).toBeGreaterThan(0);
    expect(out.clear).toBe(true);
  });
});

describe('a low ceiling, for every hovercraft', () => {
  // A slab across the yard (x 0..40, z 20..32) with its underside a little over the hull's top: room for the hull,
  // not for the probe's dome.
  for (const model of HOVERCRAFT) {
    const hull = MOUNT_DEFS[model].half[1] * 2;
    it(`${model}: drives in under a ${(hull + 0.3).toFixed(1)} m ceiling, through, and back out in reverse`, () => {
      const match = new Match(yard(model, [slab('roof', 20, hull + 0.3, 26, 40, 12)]), rules, 1);
      const { m, send } = seat(match, model, [20, 0, 6], 0);
      let low = 0;
      const through = drive(match, m, send, { forward: 1 }, 8, () => {
        if ((m as unknown as { low: boolean }).low) low++;
        return m.pos.z > 38;
      });
      // Under the slab on the low probe (not the capsule pushed through it).
      expect(low).toBeGreaterThan(20);
      expect(through.ticks).toBeGreaterThan(0);
      expect(through.clear).toBe(true);
      const back = drive(match, m, send, { forward: -1 }, 12, () => m.pos.z < 12);
      expect(back.ticks).toBeGreaterThan(0);
      expect(back.clear).toBe(true);
      expect(m.wedged).toBeUndefined();
    });

    it(`${model}: placed under it, drives out either way`, () => {
      for (const dir of [1, -1]) {
        const match = new Match(yard(model, [slab('roof', 20, hull + 0.3, 26, 40, 12)]), rules, 1);
        const { m, send } = seat(match, model, [20, 0, 26], 0);
        const out = drive(match, m, send, { forward: dir }, 8, () => Math.abs(m.pos.z - 26) > 10);
        expect(out.ticks, `forward ${dir}`).toBeGreaterThan(0);
        expect(out.clear).toBe(true);
      }
    });

    it(`${model}: a ceiling lower than its hull stops it outside, and it backs away`, () => {
      const match = new Match(yard(model, [slab('roof', 20, hull - 0.4, 26, 40, 12)]), rules, 1);
      const { m, send } = seat(match, model, [20, 0, 6], 0);
      const inn = drive(match, m, send, { forward: 1 }, 4, () => false);
      expect(inn.clear).toBe(true);
      expect(m.pos.y).toBeLessThan(0.1);
      expect(m.pos.z).toBeLessThan(20);
      const back = drive(match, m, send, { forward: -1 }, 4, () => m.pos.z < 10);
      expect(back.ticks).toBeGreaterThan(0);
    });
  }

  it('a doorway narrower than the probe: the craft stops in it at floor height (it rose 5 cm a tick before) and backs out', () => {
    // Two jambs 2.2 m apart (the Speeder's probe is 2.3 m across) under a lintel at 3 m.
    const wall = (id: string, x: number): MapEntity => ({ id, kind: 'block', position: [x, 0, 24], size: [2, 3, 1], yaw: 0, material: null, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 });
    const match = new Match(yard('speeder', [wall('l', 18.9 - 1), wall('r', 21.1 + 1), slab('lintel', 20, 3, 24, 6, 1)]), rules, 1);
    const { m, send } = seat(match, 'speeder', [20, 0, 6], 0);
    let top = 0;
    for (let t = 0; t < 60 * 5; t++) {
      send({ forward: 1 });
      match.step();
      top = Math.max(top, m.pos.y);
    }
    expect(m.pos.z).toBeLessThan(24);
    expect(top).toBeLessThan(0.2);
    expect(hullClear(match, m)).toBe(true);
    const back = drive(match, m, send, { forward: -1 }, 4, () => m.pos.z < 12);
    expect(back.ticks).toBeGreaterThan(0);
  });
});

describe('bot drivers', () => {
  it("a bot's steering takes a Hauler in under a low deck and out the far side", () => {
    // The bots drive with steer() (bots/vehicles.ts) toward the next point of their route.
    const hull = MOUNT_DEFS.hauler.half[1] * 2;
    const match = new Match(yard('hauler', [slab('roof', 20, hull + 0.3, 30, 40, 16)]), rules, 1);
    const { m, send } = seat(match, 'hauler', [20, 0, 6], 0);
    const st = freshDrive();
    const goal = { x: 20, y: 0, z: 52 };
    let clear = true;
    let t = 0;
    for (; t < 60 * 15 && m.pos.z < 48; t++) {
      const view = { index: 0, kind: 'vehicle', pos: m.pos, yaw: m.yaw, health: 1, alive: true, enterRadius: 4, seats: [{ role: 'driver', free: false }], maxSpeed: MOUNT_DEFS.hauler.vehicle!.maxSpeed, speed: Math.abs(m.speed) } as MountView;
      send(steer(st, match.tick, view, goal, Math.hypot(goal.x - m.pos.x, goal.z - m.pos.z)));
      match.step();
      if (!hullClear(match, m)) clear = false;
    }
    expect(m.pos.z).toBeGreaterThanOrEqual(48);
    expect(clear).toBe(true);
    expect(st.stuck).toBe(false);
  });
});
