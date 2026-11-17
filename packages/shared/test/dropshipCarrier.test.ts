// The Dropship on its new model (the owner's hover carrier, 2026-11-16): on Shingle Point it takes a pilot and five
// riders, flies, lands and lets them out on the sand; its seats sit on the model's cushions and deck, inside its hull.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, MOUNT_DEFS, DROPSHIP_DROP_DEF, TICK_RATE, initPhysics, loadMap, rulesForMode, type MapDocument, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

interface MountLike {
  pos: { x: number; y: number; z: number };
  yaw: number;
  seats: (number | null)[];
  def: { id: string };
}
const internals = (match: Match) => match as unknown as { mounts: MountLike[]; enterMount(c: Combatant): boolean; leaveMount(c: Combatant, step: boolean): void };

function shingle(): MapDocument {
  const r = loadMap(readFileSync(new URL('../../../maps/shingle_point.json', import.meta.url), 'utf8'));
  if (!r.ok) throw new Error('shingle_point failed to load');
  return r.map;
}

describe('the Dropship, the hover carrier', () => {
  it("its seats are on the model's cushions and deck, inside its hull; the drop route's twelve on the benches", () => {
    const ship = MOUNT_DEFS.dropship;
    expect(ship.model).toBe('vehicles/hover_carrier.glb');
    expect(ship.fallback).toBe('vehicles/dropship.glb');
    for (const def of [ship, DROPSHIP_DROP_DEF]) {
      for (const s of def.seats) {
        expect(Math.abs(s.offset[0]), s.label).toBeLessThan(def.half[0]);
        expect(Math.abs(s.offset[2]), s.label).toBeLessThan(def.half[2]);
        expect(s.offset[1], s.label).toBeGreaterThan(0.5);
      }
    }
    const riders = ship.seats.filter((s) => s.role === 'passenger');
    expect(riders).toHaveLength(4);
    for (const s of riders) expect(s.seated && Math.sign(s.facing!) === -Math.sign(s.offset[0])).toBe(true);
    expect(DROPSHIP_DROP_DEF.model).toBe(ship.model);
    expect(DROPSHIP_DROP_DEF.seats).toHaveLength(12);
    // Every bench place on a cushion (measured on the drawn model, 2026-11-17: tops 1.24-1.26 m up, the floor 0.74 m,
    // the three cushions a side from z -0.25 to -3.75 at x 1.0-1.6; a seated rider's hip joint rides 0.07-0.17 m over a
    // place at 1.2), a rider's width (0.25 m) clear of the bench's ends.
    for (const def of [ship, DROPSHIP_DROP_DEF]) {
      for (const s of def.seats.filter((x) => x.role === 'passenger')) {
        expect(Math.abs(s.offset[0]), s.label).toBeCloseTo(1.3);
        expect(s.offset[1], s.label).toBeCloseTo(1.2);
        expect(s.offset[2], s.label).toBeLessThanOrEqual(-0.25 - 0.25);
        expect(s.offset[2], s.label).toBeGreaterThanOrEqual(-3.75 + 0.25);
      }
    }
  });

  it('on Shingle Point: a pilot and five bots aboard, it climbs, flies, lands and lets them all out on the ground', () => {
    const m = shingle();
    const match = new Match(m, { ...rulesForMode(m, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0, respawnDelayTicks: 1_000_000, teamSizes: [6, 6] }, 3);
    const pilot = match.addHuman('pilot')!;
    const bots = Array.from({ length: 5 }, (_, i) => match.addBot(`b${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal)!);
    match.step();
    const { mounts, enterMount, leaveMount } = internals(match);
    const ship = mounts.find((x) => x.def.id === 'dropship')!;
    const start = { ...ship.pos };
    for (const c of [pilot, ...bots]) {
      c.move = { pos: { ...ship.pos }, velY: 0, grounded: true };
      expect(enterMount.call(match, c)).toBe(true);
    }
    expect(ship.seats.every((s) => s !== null)).toBe(true);
    // The riders ride (a bot that wants to be elsewhere jumps out; that is the bots' own business, not the carrier's).
    for (const c of bots) {
      const brain = c.bot! as unknown as { think: (...a: unknown[]) => { buttons: number } };
      const think = brain.think.bind(brain);
      brain.think = (...a: unknown[]) => ({ ...think(...a), buttons: 0 });
    }
    let seq = 0;
    const fly = (ticks: number, forward: number, buttons: number) => {
      for (let t = 0; t < ticks; t++) {
        const i: PlayerInput = { seq: ++seq, forward, right: 0, yaw: ship.yaw, pitch: 0, buttons };
        match.queueInputs(pilot.slot, [i]);
        match.step();
      }
    };
    // Up (jump climbs) and forward along the beach, inland.
    fly(TICK_RATE * 3, 0, 1);
    const up = ship.pos.y - start.y;
    expect(up).toBeGreaterThan(8);
    fly(TICK_RATE * 3, 1, 0);
    const flown = Math.hypot(ship.pos.x - start.x, ship.pos.z - start.z);
    expect(flown).toBeGreaterThan(20);
    // Down (crouch dives) until it sits.
    fly(TICK_RATE * 8, 0, 256);
    fly(TICK_RATE, 0, 0);
    expect(ship.pos.y).toBeLessThan(start.y + 3);
    const aboard = [pilot, ...bots].filter((c) => c.mount).length;
    expect(aboard).toBe(6);
    // Everyone out beside the hull, standing on ground near it (the bots walk on), not under it or inside it.
    for (const c of [pilot, ...bots]) leaveMount.call(match, c, true);
    fly(TICK_RATE * 2, 0, 0);
    for (const c of [pilot, ...bots]) {
      expect(c.mount).toBeUndefined();
      expect(c.alive, c.name).toBe(true);
      expect(c.move.grounded, c.name).toBe(true);
      expect(Math.hypot(c.move.pos.x - ship.pos.x, c.move.pos.z - ship.pos.z), c.name).toBeLessThan(14);
      expect(Math.abs(c.move.pos.y - ship.pos.y), c.name).toBeLessThan(2);
    }
  }, 60_000);
});
