// Getting out of a moving speeder (owner, 2026-11-27: jumping out of their moving speeder killed them; they want to be
// put out behind it). Before: the exit spots were tried left, right, back, front whatever the speed, the rider set
// down still beside a hull that kept gliding, and it ran them over (Match.runOver: the seat just left, no driver to
// check friendly fire against, speed × 5 damage).
import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_USE, DEFAULT_DEATHMATCH_RULES, TICK_RATE, initPhysics, type GameEvent, type MapDocument, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

interface MountLike {
  def: { half: [number, number, number]; vehicle?: { maxSpeed: number } };
  pos: { x: number; y: number; z: number };
  yaw: number;
  speed: number;
  vel?: { x: number; z: number };
  body: unknown;
}
type Internals = { mounts: MountLike[]; enterMount(c: Combatant): boolean; physics: { setBoxPose(b: unknown, c: unknown, y: number): void } };
const internals = (m: Match) => m as unknown as Internals;

/** An open yard of 8 m tiles, a speeder at (20, 0, 6) facing +z. */
function yard(w = 16, h = 30): MapDocument {
  const tiles = [];
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[2, 0, 2]]);
  return { ...map, entities: [...map.entities, { id: 'mount_0', kind: 'mount' as const, position: [20, 0, 6], model: 'speeder' as 'hauler', yaw: 0, faction: null, respawnSeconds: null }] };
}

/** At the controls of the speeder, flat out up the yard (+z, or turned `yaw`); the match, driver and speeder. */
function flatOut(yaw = 0) {
  const match = new Match(yard(), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, respawnDelayTicks: 100_000 }, 1);
  const driver = match.addHuman('driver')!;
  match.step();
  const m = internals(match).mounts[0]!;
  m.pos = { x: 60, y: 0, z: 10 };
  m.yaw = yaw;
  internals(match).physics.setBoxPose(m.body, { x: 60, y: m.def.half[1], z: 10 }, yaw);
  driver.move = { pos: { x: 60, y: 0, z: 10 }, velY: 0, grounded: true };
  expect(internals(match).enterMount(driver)).toBe(true);
  let seq = 0;
  const send = (i: Partial<PlayerInput>) => match.queueInputs(driver.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: driver.yaw, pitch: 0, buttons: 0, ...i }]);
  for (let t = 0; t < TICK_RATE * 4 && m.speed < m.def.vehicle!.maxSpeed * 0.95; t++) {
    send({ forward: 1 });
    match.step();
  }
  return { match, driver, m, send };
}

describe('getting out of a moving speeder', () => {
  it('flat out, the driver presses E: they get out behind it, unhurt, and it glides on away from them', () => {
    const { match, driver, m, send } = flatOut();
    expect(m.speed).toBeGreaterThan(m.def.vehicle!.maxSpeed * 0.9);
    const events: GameEvent[] = [];
    send({ buttons: BUTTON_USE });
    events.push(...match.step());
    expect(driver.mount).toBeUndefined();
    // Behind it: back along its way (it was going +z).
    expect(driver.move.pos.z).toBeLessThan(m.pos.z - m.def.half[2]);
    expect(Math.abs(driver.move.pos.x - m.pos.x)).toBeLessThan(m.def.half[0]);
    for (let t = 0; t < TICK_RATE * 2; t++) {
      send({});
      events.push(...match.step());
    }
    expect(driver.alive).toBe(true);
    expect(driver.health).toBe(driver.maxHealth);
    expect(events.some((e) => e.e === 'kill' && e.victim === driver.slot)).toBe(false);
    expect(m.pos.z - driver.move.pos.z).toBeGreaterThan(4);
  });

  it('behind it by its way, not its nose: drifting sideways, out on the side it came from', () => {
    const { match, driver, m, send } = flatOut();
    // (Sliding along x, its nose still up the yard: as after a hard turn.)
    m.vel = { x: -m.speed, z: 0 };
    const { x: cx } = m.pos;
    send({ buttons: BUTTON_USE });
    match.step();
    // Behind along its way: on its +x side (before: its left, -x, the side it was sliding onto).
    expect(driver.move.pos.x).toBeGreaterThan(cx + m.def.half[0]);
    for (let t = 0; t < TICK_RATE * 2; t++) {
      send({});
      match.step();
    }
    expect(driver.alive).toBe(true);
  });

  it('for a second after, its own vehicle can’t run them over; then it can', () => {
    const { match, driver, m, send } = flatOut();
    send({ buttons: BUTTON_USE });
    match.step();
    // Put back in its path, just ahead of its nose, at once: unhurt.
    const ahead = (d: number) => (driver.move = { pos: { x: m.pos.x, y: m.pos.y, z: m.pos.z + m.def.half[2] + d }, velY: 0, grounded: true });
    ahead(0.3);
    send({});
    match.step();
    expect(driver.health).toBe(driver.maxHealth);
    // Past the second, still at speed: it hits.
    for (let t = 0; t < TICK_RATE; t++) {
      send({});
      match.step();
    }
    if (m.speed > 5) {
      ahead(0.3);
      send({});
      match.step();
      expect(driver.health).toBeLessThan(driver.maxHealth);
    }
  });
});
