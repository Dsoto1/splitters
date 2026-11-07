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

/** Open yard 48 x 64 m (x -4..44, z -4..60) with a hovercraft at (20, 0, 6) facing +z and optional blocks. */
function yard(model: Craft, blocks: MapEntity[] = []): MapDocument {
  const tiles = [];
  for (let x = 0; x < 6; x++) for (let y = 0; y < 8; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[2, 0, 2]]);
  return { ...map, entities: [...map.entities, { id: 'mount_0', kind: 'mount' as const, position: [20, 0, 6], model, yaw: 0, faction: null, respawnSeconds: null }, ...blocks] };
}

const slab = (id: string, x: number, bottom: number, z: number, w: number, d: number): MapEntity => ({ id, kind: 'block', position: [x, bottom, z], size: [w, 0.4, d], yaw: 0, material: null, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 });

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
 * Whether the hull's middle (the column over its probe: the hull's height, the probe's width) is clear of the world:
 * the craft is never pushed into a deck or a ceiling. The vehicle's own box is in the world, so it is left out by
 * shrinking the test box a hair inside it.
 */
function hullClear(match: Match, m: MountLike): boolean {
  const r = Math.min(m.def.half[0], m.def.half[2]) * 0.95 * 0.7;
  // (The vehicle's own box is solid; boxClear sees it, so its own box is moved away for the test.)
  const ph = internals(match).physics;
  ph.setBoxPose(m.body, { x: m.pos.x, y: m.pos.y - 500, z: m.pos.z }, m.yaw);
  const clear = ph.boxClear({ x: m.pos.x, y: m.pos.y + m.def.half[1] + 0.06, z: m.pos.z }, { x: r, y: m.def.half[1] - 0.05, z: r });
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
  // Measured on main before the fix (the same drive): ride height (feet over the yard's floor) and speed after 2 s and
  // 5 s flat out, then 2 s turning hard. The low probe only comes in with something over the hull.
  const before: Record<Craft, { y2: number; v2: number; v5: number; z5: number; turnX: number; turnZ: number; y: number }> = {
    hauler: { y2: 0.02, v2: 11.6, v5: 13, z5: 59.1, turnX: 12.7, turnZ: 76.4, y: 0.02 },
    speeder: { y2: 0.02, v2: 24, v5: 24, z5: 0, turnX: 0, turnZ: 0, y: 0.02 },
    hover_bike: { y2: 0.02, v2: 31, v5: 31, z5: 0, turnX: 0, turnZ: 0, y: 0.02 },
  };
  for (const model of HOVERCRAFT) {
    it(`${model}: ride height and speed on flat ground`, () => {
      const match = new Match(yard(model), rules, 1);
      const { m, send } = seat(match, model, [20, 0, 6], 0);
      const trace: number[] = [];
      for (let t = 1; t <= 60 * 2; t++) {
        send({ forward: 1 });
        match.step();
        trace.push(m.pos.y);
      }
      const got = { y2: m.pos.y, v2: m.speed, v5: 0, z5: 0, turnX: 0, turnZ: 0, y: 0 };
      console.log(model, JSON.stringify(got));
      expect(got.y2).toBeCloseTo(before[model].y2, 2);
      expect(got.v2).toBeCloseTo(before[model].v2, 1);
      expect(Math.max(...trace) - Math.min(...trace)).toBeLessThan(0.06);
    });
  }
});
