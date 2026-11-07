// Corridors: two or three genuinely different ways between two places (nav/corridors.ts; docs/BOTS.md, "Route
// variety"; BOT_AI_PLAN.md Phase B item 4).
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics, loadMap, type MapDocument, type Vec3 } from '../src/index.ts';
import { findCorridors, initNavigation, mapNavigation, placeOn } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

function official(id: string): MapDocument {
  const r = loadMap(readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8'));
  if (!r.ok) throw new Error(`${id} failed to load`);
  return r.map;
}

const flagsOf = (map: MapDocument): Vec3[] => map.entities.filter((e) => e.kind === 'flag').map((e) => ({ x: e.position[0], y: e.position[1], z: e.position[2] }));

describe('corridors', () => {
  it("Bunker Cross: the three lanes between the flags (middle, north, south), each mostly its own ground, deterministically", () => {
    const map = official('bunker_cross');
    const built = mapNavigation(map);
    const [a, b] = flagsOf(map);
    const trip = findCorridors(built.nav, a!, b!);
    expect(trip.corridors.length).toBe(3);
    const [first, ...rest] = trip.corridors;
    for (const c of rest) {
      expect(c.shared).toBeLessThan(0.4);
      expect(c.length).toBeLessThan(first!.length * 1.6 + 30);
    }
    // The middle one is the shortest; the others go round either side of it (one north of the flags' line, one south).
    const side = (c: { line: readonly Vec3[] }) => {
      const mid = c.line[Math.floor(c.line.length / 2)]!;
      const dx = b!.x - a!.x;
      const dz = b!.z - a!.z;
      return Math.sign((mid.x - a!.x) * dz - (mid.z - a!.z) * dx);
    };
    expect(new Set(rest.map(side)).size).toBe(2);
    // Waypoints on the navmesh, about 12 m apart, start to goal.
    for (const c of trip.corridors) {
      for (const p of c.points) expect(built.nav.nearestPoly(p, { x: 1, y: 2, z: 1 })).not.toBeNull();
      expect(Math.hypot(c.points[0]!.x - a!.x, c.points[0]!.z - a!.z)).toBeLessThan(2);
      const last = c.points[c.points.length - 1]!;
      expect(Math.hypot(last.x - b!.x, last.z - b!.z)).toBeLessThan(2);
    }
    // Where a point is along one: the middle of a corridor is on it, and far off the others.
    const mid = first!.line[Math.floor(first!.line.length / 2)]!;
    expect(placeOn(first!, mid).off).toBeLessThan(0.5);
    for (const c of rest) expect(placeOn(c, mid).off).toBeGreaterThan(7);
    // Each one's via (the point bots go by to take it) is on it, well away from the others, between a fifth and four
    // fifths of the way.
    for (const c of trip.corridors) {
      const via = c.via!;
      expect(via).not.toBeNull();
      expect(placeOn(c, via).off).toBeLessThan(0.5);
      for (const o of trip.corridors) if (o !== c) expect(placeOn(o, via).off).toBeGreaterThan(7);
      const along = c.lineAt[placeOn(c, via).at]!;
      expect(along).toBeGreaterThanOrEqual(c.length * 0.15);
      expect(along).toBeLessThanOrEqual(c.length * 0.85);
      // The points a bot goes by to take it (its via), in order along it, each on it and away from the others.
      expect(c.vias.length).toBeGreaterThanOrEqual(1);
      expect(c.vias.length).toBeLessThanOrEqual(3);
      expect(c.vias.some((p) => p.x === via.x && p.z === via.z)).toBe(true);
      const ats = c.vias.map((p) => c.lineAt[placeOn(c, p).at]!);
      expect([...ats].sort((a, b) => a - b)).toEqual(ats);
      for (const p of c.vias) for (const o of trip.corridors) if (o !== c) expect(placeOn(o, p).off).toBeGreaterThan(7);
    }
    // The same again (and from the cache: the same object), and the same for a navmesh built again.
    expect(findCorridors(built.nav, a!, b!)).toBe(trip);
    const again = mapNavigation(map);
    expect(findCorridors(again.nav, a!, b!).corridors.map((c) => c.points)).toEqual(trip.corridors.map((c) => c.points));
    for (const x of [built, again]) {
      x.physics.free();
      x.nav.destroy();
    }
  }, 120_000);

  it('a single corridor where there is only one way (a walled lane), none where no route joins', () => {
    // Two rooms joined by a 3-wide straight of yard tiles: one way through.
    const tiles: MapDocument['classicStructure']['tiles'] = [];
    for (let x = 0; x < 6; x++) tiles.push({ id: `y${x}`, tile: 'core.room', x, y: 0, z: 0, rotation: 0 });
    const map = makeMap(tiles, [
      [0, 0, 0],
      [40, 0, 0],
    ]);
    const built = mapNavigation(map);
    const trip = findCorridors(built.nav, { x: 0, y: 0, z: 0 }, { x: 40, y: 0, z: 0 });
    expect(trip.corridors.length).toBe(1);
    expect(trip.corridors[0]!.length).toBeGreaterThan(35);
    // Off the navmesh entirely: nothing.
    expect(findCorridors(built.nav, { x: 0, y: 0, z: 0 }, { x: 500, y: 0, z: 500 }).corridors.length).toBe(0);
    built.physics.free();
    built.nav.destroy();
  });
});
