// Route spread (BOT_AI_PLAN.md "Phase C, measured"): a loose bot sent to an objective down a side lane takes a
// corridor of its side's trip on that side, by its vias (brain.ts sideCorridor), instead of a place sampled to the side
// of the straight way (explore.ts laneWaypoint), which re-joined the main way by the trip's middle.
import { describe, expect, it } from 'vitest';
import { sideCorridor } from '../src/bots/brain.ts';
import type { Corridor } from '../src/nav/corridors.ts';
import type { PricedTrip } from '../src/bots/teamBrain.ts';

const corridor = (via: { x: number; z: number } | null, length: number): Corridor => ({ points: [], pointsAt: [], line: [], lineAt: [], length, shared: 0, via: via ? { x: via.x, y: 0, z: via.z } : null, viaApart: 10, vias: via ? [{ x: via.x, y: 0, z: via.z }] : [], polys: [] }) as unknown as Corridor;

/** A trip from (0, 0) to (0, 100): the straight corridor, one through x = -30 and one through x = +30. */
const trip = (cost = [100, 130, 130]): PricedTrip => ({
  trip: { from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: 100 }, corridors: [corridor(null, 100), corridor({ x: -30, z: 50 }, 130), corridor({ x: 30, z: 50 }, 130)] },
  cost,
  crowd: [0, 0, 0],
  deaths: [0, 0, 0],
  seen: [0, 0, 0],
});

describe('side lanes by a corridor of the trip', () => {
  const me = { x: 0, y: 0, z: 2 };
  const goal = { x: 0, y: 0, z: 100 };
  it('takes the corridor on its side of the way (laneWaypoint sides: heading +z, + is +x)', () => {
    const plus = sideCorridor([trip()], me, goal, 1)!;
    const minus = sideCorridor([trip()], me, goal, -1)!;
    expect(plus.via!.x).toBe(30);
    expect(minus.via!.x).toBe(-30);
  });

  it('never the shortest, nor one for another goal, nor one with no corridor that side', () => {
    expect(sideCorridor([trip()], me, { x: 80, y: 0, z: 100 }, 1)).toBeNull();
    const one = trip();
    (one.trip as { corridors: Corridor[] }).corridors = one.trip.corridors.slice(0, 2);
    expect(sideCorridor([one], me, goal, 1)).toBeNull();
    expect(sideCorridor([one], me, goal, -1)!.via!.x).toBe(-30);
    expect(sideCorridor(undefined, me, goal, 1)).toBeNull();
  });

  it('a via behind the bot (already past it) is no side lane', () => {
    expect(sideCorridor([trip()], { x: 0, y: 0, z: 80 }, goal, 1)).toBeNull();
  });
});
