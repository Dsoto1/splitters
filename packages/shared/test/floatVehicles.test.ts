import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_USE, DEFAULT_DEATHMATCH_RULES, FLOAT, MOUNT_DEFS, cockpitEye, initPhysics, loadMap, serializeMap, validateMap, type MapDocument, type MapEntity, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
const SURFACE = 1.5;

type Mount = Omit<Extract<MapEntity, { kind: 'mount' }>, 'id' | 'kind'>;

/** The 40 × 32 m yard (x -4..36, z -4..28), optionally flooded `SURFACE` m deep over most of it. */
function yard(mounts: Mount[], liquid: 'water' | 'lava' | null = 'water'): MapDocument {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 0]]);
  const pool: MapEntity[] = liquid ? [{ id: 'lake_1', kind: 'water', position: [16, 0, 12], size: [36, SURFACE, 28], liquid }] : [];
  return { ...map, entities: [...map.entities, ...pool, ...mounts.map((m, i) => ({ id: `mount_${i}`, kind: 'mount' as const, ...m }))] };
}

function drive(match: Match, me: Combatant, ticks: number, i: Partial<PlayerInput>, each: () => void = () => {}): void {
  for (let t = 0; t < ticks; t++) {
    match.queueInputs(me.slot, [{ seq: (seq += 1), forward: 0, right: 0, yaw: me.yaw, pitch: me.pitch, buttons: 0, ...i }]);
    match.step();
    each();
  }
}
let seq = 0;

interface Rt { pos: { x: number; y: number; z: number }; yaw: number; speed: number; alive: boolean; afloat: boolean }
const rt = (match: Match, i = 0) => (match as unknown as { mounts: Rt[] }).mounts[i]!;

/** Board the yard's first mount (a driver seat) and return the driver. */
function board(match: Match): Combatant {
  const me = match.addHuman('me')!;
  drive(match, me, 2, {});
  const m = rt(match);
  me.move = { pos: { x: m.pos.x + 2, y: SURFACE + 0.2, z: m.pos.z }, velY: 0, grounded: true };
  drive(match, me, 1, { buttons: BUTTON_USE });
  drive(match, me, 1, {});
  expect(me.mount).toBeDefined();
  return me;
}

describe('vehicles that ride on water', () => {
  it('a vehicle placed onWater rides at the surface within its draft while driven; one without sinks to the bed', () => {
    const run = (onWater: boolean) => {
      const match = new Match(yard([{ position: [4, SURFACE - FLOAT.draft, 6], model: 'speeder', yaw: Math.PI / 2, faction: null, respawnSeconds: null, ...(onWater ? { onWater } : {}) }]), rules);
      const me = board(match);
      let lo = Infinity;
      let hi = -Infinity;
      drive(match, me, 90, { forward: 1 }, () => {
        lo = Math.min(lo, rt(match).pos.y);
        hi = Math.max(hi, rt(match).pos.y);
      });
      return { lo, hi, end: rt(match), health: match.mountSnapshots()[0] };
    };
    const boat = run(true);
    // Feet a draft under the surface (0.2-0.4 m), all the way across.
    expect(boat.lo).toBeGreaterThan(SURFACE - 0.4 - 0.05);
    expect(boat.hi).toBeLessThan(SURFACE - 0.2 + 0.05);
    expect(boat.end.afloat).toBe(true);
    expect(boat.end.alive).toBe(true);
    expect(boat.end.pos.x).toBeGreaterThan(14);
    // Slower on water than its top speed.
    expect(boat.end.speed).toBeLessThanOrEqual(MOUNT_DEFS.speeder.vehicle!.maxSpeed * FLOAT.speed + 1e-6);
    const car = run(false);
    expect(car.end.pos.y).toBeLessThan(SURFACE - 1);
    expect(car.end.afloat).toBe(false);
  });

  it('lava carries nothing: a floater sinks into it and burns', () => {
    const match = new Match(yard([{ position: [10, 1, 10], model: 'speeder', yaw: 0, faction: null, respawnSeconds: null, onWater: true }], 'lava'), rules);
    for (let t = 0; t < 60 * 10 && rt(match).alive; t++) match.step();
    expect(rt(match).alive).toBe(false);
  });

  it('onWater survives saving and loading; v20 maps load unchanged', () => {
    const map = yard([{ position: [4, 1.2, 6], model: 'speeder', yaw: 0, faction: null, respawnSeconds: null, onWater: true }]);
    expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
    const again = loadMap(serializeMap(map));
    expect(again.ok && (again.map.entities.find((e) => e.kind === 'mount') as Extract<MapEntity, { kind: 'mount' }>).onWater).toBe(true);
    const old = loadMap({ ...yard([{ position: [4, 0, 6], model: 'speeder', yaw: 0, faction: null, respawnSeconds: null }]), formatVersion: 20 });
    expect(old.ok && old.migratedFrom).toBe(20);
  });
});

describe('the hover bike', () => {
  it('drives nose first, along its facing, with the rider facing forward', () => {
    for (const yaw of [0, Math.PI / 2, -2.3]) {
      const match = new Match(yard([{ position: [16, 0, 12], model: 'hover_bike', yaw, faction: null, respawnSeconds: null }], null), rules);
      const me = board(match);
      const start = { ...rt(match).pos };
      drive(match, me, 60, { forward: 1 });
      const m = rt(match);
      const d = { x: m.pos.x - start.x, z: m.pos.z - start.z };
      const along = d.x * Math.sin(yaw) + d.z * Math.cos(yaw);
      expect(along).toBeGreaterThan(4);
      expect(Math.abs(d.x * Math.cos(yaw) - d.z * Math.sin(yaw))).toBeLessThan(along * 0.1);
    }
    // The rider sits ahead of the middle (the nose is +Z; the exhausts trail), looking forward.
    const def = MOUNT_DEFS.hover_bike;
    expect(def.seats[0]!.offset[2]).toBeGreaterThanOrEqual(0);
    expect(cockpitEye(def, 0)[2]).toBeGreaterThan(0);
    expect(def.seats[0]!.facing ?? 0).toBe(0);
  });
});
