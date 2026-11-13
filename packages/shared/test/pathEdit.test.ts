// pathWithLength (MapMaker's Paths pane, "Length"): a path made longer or shorter at its last point.
import { describe, expect, it } from 'vitest';
import { MapPath, newTerrain, pathGeometry, pathWithLength, terrainHeightAt, type MapPath as Path } from '../src/index.ts';

const path = (points: [number, number, number][], extra: Partial<Path> = {}): Path => MapPath.parse({ id: 'p', points, ...extra });
const len = (p: Path) => pathGeometry(p).length;
const ok = (r: Path | { error: string }): Path => {
  if ('error' in r) throw new Error(r.error);
  return r;
};

describe('pathWithLength', () => {
  const bend = path([[0, 0, 0], [20, 0, 0], [40, 0, 10], [60, 0, 30], [60, 0, 60]]);

  it('makes a path shorter along its own line: the points past the cut go, the start stays', () => {
    const before = len(bend);
    const r = ok(pathWithLength(bend, 35));
    expect(len(r)).toBeCloseTo(35, 0);
    expect(r.points[0]).toEqual(bend.points[0]);
    expect(r.points[1]).toEqual(bend.points[1]);
    expect(r.points.length).toBeLessThan(bend.points.length);
    // The new end is near where the old line was 35 m along.
    const cut = pathGeometry(bend).at(35);
    const end = r.points[r.points.length - 1]!;
    expect(Math.hypot(end[0] - cut.x, end[2] - cut.z)).toBeLessThan(3);
    expect(before).toBeGreaterThan(35);
  });

  it('makes a path longer straight on from its end, keeping every point it had', () => {
    const before = len(bend);
    const r = ok(pathWithLength(bend, before + 40));
    expect(len(r)).toBeCloseTo(before + 40, 0);
    expect(r.points.slice(0, bend.points.length)).toEqual(bend.points);
    expect(r.points).toHaveLength(bend.points.length + 1);
    const end = r.points[r.points.length - 1]!;
    // It ran on north (+z), the way the last stretch ran.
    expect(end[2]).toBeGreaterThan(90);
    expect(Math.abs(end[0] - 60)).toBeLessThan(8);
  });

  it('moves the last point for a small change, and leaves the path alone when the length is the same', () => {
    const before = len(bend);
    const r = ok(pathWithLength(bend, before + 1));
    expect(r.points).toHaveLength(bend.points.length);
    expect(len(r)).toBeCloseTo(before + 1, 0);
    expect(pathWithLength(bend, before)).toBe(bend);
  });

  it('works on a path of two points, and shortens down to two', () => {
    const straight = path([[0, 0, 0], [30, 0, 0]]);
    expect(len(ok(pathWithLength(straight, 12)))).toBeCloseTo(12, 1);
    expect(len(ok(pathWithLength(straight, 80)))).toBeCloseTo(80, 1);
    const short = ok(pathWithLength(bend, 5));
    expect(short.points).toHaveLength(2);
    expect(len(short)).toBeCloseTo(5, 0);
  });

  it('sets the new end on the ground', () => {
    const t = newTerrain(200);
    const hill = { ...t, heights: t.heights.map((_, i) => (i % t.cols) * 0.5) };
    const r = ok(pathWithLength(path([[0, 0, 0], [20, 0, 0]]), 50, hill));
    const end = r.points[r.points.length - 1]!;
    expect(end[1]).toBeCloseTo(terrainHeightAt(hill, end[0], end[2])!, 1);
    expect(end[1]).not.toBe(0);
  });

  it('refuses a loop, and a length under two metres', () => {
    expect(pathWithLength(path([[0, 0, 0], [20, 0, 0], [20, 0, 20]], { closed: true }), 30)).toHaveProperty('error');
    expect(pathWithLength(bend, 1)).toHaveProperty('error');
    expect(pathWithLength(bend, Number.NaN)).toHaveProperty('error');
  });
});
