// Bot AI Phase C follow-up, part 2 (BOT_AI_PLAN.md): large bodies (1.18 × 1.8 m: 2.12 m) route round low roofs, the
// navmesh's low-headroom area (nav/solo.ts LOW_AREA) when the way round costs less than crouching through at
// LOW_ROOF_COST a metre (the moderate price, owner 2026-11-08), and crouch under one otherwise. Small and standard
// bodies keep their routes.
import { beforeAll, describe, expect, it } from 'vitest';
import { CORE_BOT_PROFILES, TICK_RATE, initPhysics, loadMap, type MapDocument, type Vec3 } from '../src/index.ts';
import { LOW_ROOF_COST, Match, initNavigation, mapNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const block = (id: string, center: [number, number], size: [number, number, number], y = 0) =>
  ({ id, kind: 'block', position: [center[0], y, center[1]], size, yaw: 0, material: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.5, respawnSeconds: null, health: 100 }) as MapDocument['entities'][number];

/**
 * Open yard tiles, 3 × 3 (x and z from -4 to 20), floor at 0, cut in two by a wall along x = 8 (3 m tall). A doorway
 * near the bots (z 1 to 5) under a lintel 2 m up: a standard body (1.8 m) walks under, a large one (2.12 m) doesn't.
 * With `open`, a second doorway with nothing over it at the far end (z 13 to 17). With `tunnel`, the low doorway is
 * a low tunnel that long (x), walled each side.
 */
const wallMap = (open: boolean, tunnel = 0): MapDocument => {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) tiles.push({ id: `yard${x}${z}`, tile: 'core.yard', x, y: z, z: 0, rotation: 0 });
  const doc = makeMap(tiles, [
    [0, 0, 3],
    [16, 0, 3],
  ]);
  const wall = (id: string, z0: number, z1: number) => block(id, [8, (z0 + z1) / 2], [0.4, 3, z1 - z0]);
  doc.entities.push(wall('wall1', -4, 1), block('lintel', [8, 3], [Math.max(0.4, tunnel), 1, 4], 2));
  if (tunnel) doc.entities.push(block('side1', [8, 0.8], [tunnel, 3, 0.4]), block('side2', [8, 5.2], [tunnel, 3, 0.4]));
  if (open) doc.entities.push(wall('wall2', 5, 13), wall('wall3', 17, 20));
  else doc.entities.push(wall('wall2', 5, 20));
  doc.entities.push({ id: 'gun_1', kind: 'pickup', position: [16, 0, 3], item: 'core.weapon_shotgun', respawnSeconds: null } as MapDocument['entities'][number]);
  const r = loadMap(doc);
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.map;
};

/** Where a route crosses the wall (x = 8): its z there. */
function crossing(path: readonly Vec3[]): number {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    if ((a.x - 8) * (b.x - 8) > 0) continue;
    const t = b.x === a.x ? 0 : (8 - a.x) / (b.x - a.x);
    return a.z + (b.z - a.z) * t;
  }
  return NaN;
}

describe('large bots and low roofs', () => {
  it('marks the ground under the lintel as low headroom, and nothing else', () => {
    const built = mapNavigation(wallMap(true));
    try {
      expect(built.nav.lowSpans).toBeGreaterThan(0);
      const low = built.nav.lowCount();
      // The lintel's 0.4 m and a large body's radius each side, over the doorway's width (less the navmesh's margin).
      expect(low.area).toBeGreaterThan(0.5);
      expect(low.area).toBeLessThan(6);
    } finally {
      built.physics.free();
      built.nav.destroy();
    }
  });

  // The way round by the open doorway is about 15 m longer than the straight way. A lintel's strip (a metre or so)
  // costs a large body less than that to crouch through; an 11 m low tunnel costs it more (bots' cover routes price
  // the open yard of the way round up to 1.45 a metre too).
  const TUNNEL = 11;

  it('prices low ground moderately for a large body', () => expect(LOW_ROOF_COST).toBe(4));

  it('a large body routes round a low tunnel when an open doorway exists; small and standard ones go through it', () => {
    const built = mapNavigation(wallMap(true, TUNNEL));
    try {
      const a = { x: 0, y: 0, z: 3 };
      const b = { x: 16, y: 0, z: 3 };
      const plain = built.nav.findPath(a, b)!;
      expect(plain).not.toBeNull();
      expect(built.nav.lastLow).toBe(false);
      // Small and standard bodies (findPath without `tall`): the short way, under the lintel.
      const z = crossing(plain);
      expect(z).toBeGreaterThan(1);
      expect(z).toBeLessThan(5);
      const tall = built.nav.findPath(a, b, 0, true, 0, false, true)!;
      expect(tall).not.toBeNull();
      // Through the open doorway at the far end, and not under a low roof.
      const zt = crossing(tall);
      expect(zt).toBeGreaterThan(13);
      expect(zt).toBeLessThan(17);
      expect(built.nav.lastLow).toBe(false);
      // The plain route is the same with the tall search's filters made (no shared state changes it).
      expect(built.nav.findPath(a, b)).toEqual(plain);
    } finally {
      built.physics.free();
      built.nav.destroy();
    }
  });

  it('a large body crouches through a short low strip rather than walk a long way round', () => {
    const built = mapNavigation(wallMap(true));
    try {
      const tall = built.nav.findPath({ x: 2, y: 0, z: 3 }, { x: 14, y: 0, z: 3 }, 0, true, 0, false, true)!;
      const z = crossing(tall);
      expect(z).toBeGreaterThan(1);
      expect(z).toBeLessThan(5);
      expect(built.nav.lastLow).toBe(true);
    } finally {
      built.physics.free();
      built.nav.destroy();
    }
  });

  it('with no open way, a large body routes under the low roof (and says so)', () => {
    const built = mapNavigation(wallMap(false));
    try {
      const tall = built.nav.findPath({ x: 2, y: 0, z: 3 }, { x: 14, y: 0, z: 3 }, 0, true, 0, false, true)!;
      expect(tall).not.toBeNull();
      const z = crossing(tall);
      expect(z).toBeGreaterThan(1);
      expect(z).toBeLessThan(5);
      expect(built.nav.lastLow).toBe(true);
      // Asked again: the same route, from the lookup of start and end that had to go under.
      expect(built.nav.findPath({ x: 2, y: 0, z: 3 }, { x: 14, y: 0, z: 3 }, 0, true, 0, false, true)).toEqual(tall);
      expect(built.nav.lastLow).toBe(true);
    } finally {
      built.physics.free();
      built.nav.destroy();
    }
  });

  /** A bot of `look` from (0, 0, 3) for the gun at (16, 0, 3): where it crossed the wall, whether it got near it, and its ducking. */
  const run = (open: boolean, look: string, tunnel = 0) => {
    const match = new Match(wallMap(open, tunnel), undefined, 3);
    const bot = match.addBot('b', { ...CORE_BOT_PROFILES[0]!, exploration: 0, itemGreed: 100 }, undefined, false, { look })!;
    bot.move = { pos: { x: 0, y: 0, z: 3 }, velY: 0, grounded: true };
    let crossedAt = NaN;
    let arrived = false;
    let crouched = 0;
    for (let t = 0; t < TICK_RATE * 30 && !arrived; t++) {
      const was = { ...bot.move.pos };
      match.step();
      if (!bot.alive) continue;
      const p = bot.move.pos;
      if (Number.isNaN(crossedAt) && was.x < 8 && p.x >= 8) crossedAt = p.z;
      if (bot.move.stance === 1) crouched++;
      if (p.x > 13 && Math.abs(p.z - 3) < 2) arrived = true;
    }
    const ducked = bot.bot!.duckTicks;
    match.destroy();
    return { crossedAt, arrived, ducked, crouched };
  };

  it('a large bot walks round a low tunnel to the open doorway, standing; small and standard bots take the tunnel', () => {
    const large = run(true, 'core.knight', TUNNEL);
    expect(large.arrived).toBe(true);
    expect(large.crossedAt).toBeGreaterThan(12);
    expect(large.ducked).toBe(0);
    for (const look of ['core.goblin', 'core.dapper']) {
      const r = run(true, look, TUNNEL);
      expect(r.arrived).toBe(true);
      expect(r.crossedAt).toBeLessThan(5.5);
      expect(r.ducked).toBe(0);
    }
  });

  it('a large bot crouches through the low doorway when there is no other way, or the way round is long', () => {
    const far = run(true, 'core.knight');
    expect(far.arrived).toBe(true);
    expect(far.crossedAt).toBeLessThan(5.5);
    expect(far.ducked).toBeGreaterThan(0);
    const large = run(false, 'core.knight');
    expect(large.arrived).toBe(true);
    expect(large.crossedAt).toBeLessThan(5.5);
    expect(large.ducked).toBeGreaterThan(0);
    // A standard bot goes under standing.
    const std = run(false, 'core.dapper');
    expect(std.arrived).toBe(true);
    expect(std.ducked).toBe(0);
  });
});
