// MapMaker's breakable-wall mark (QUEUE "Breakable walls: a mark in MapMaker's 3D view"): which faces it marks and
// its dashed outline. Editor-only: play's view never builds it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMapGeometry, type MapDocument, type WorldBox } from '@tiletrigger/shared';
import { MARK_DASH, MARK_GAP, MARK_HATCH, MARK_LIFT, breakWallMarkFaces, breakWallMarkKey, breakWallMarkLines, dashes, hatchLines, sectionOutlines } from '../src/editor/breakWallMarks.ts';

const wall = (min: [number, number, number], max: [number, number, number], extra: Partial<WorldBox> = {}): WorldBox => ({ min, max, kind: 'wall', sourceId: 't', ...extra });

describe('breakable-wall mark', () => {
  it('marks both faces of a breakable wall box, lifted off it, and nothing else', () => {
    const boxes = [wall([0, 0, 1.9], [4, 3, 2.1], { breakWall: 0 }), wall([0, 0, 0], [0.2, 3, 4]), { ...wall([0, 0, 1.9], [4, 0.2, 2.1], { breakWall: 0 }), kind: 'trim' as const }, wall([0, 0, 0], [4, 3, 0.2], { breakWall: 1, yaw: 0.5 })];
    const faces = breakWallMarkFaces(boxes);
    expect(faces).toHaveLength(2);
    expect(faces.map((f) => f.corners[0][2])).toEqual([1.9 - MARK_LIFT, 2.1 + MARK_LIFT]);
    expect(faces[0]!.width).toBe(4);
    expect(faces[0]!.height).toBe(3);
  });

  it('marks a wall that runs along z on its x faces', () => {
    const [a, b] = breakWallMarkFaces([wall([1.9, 0, 0], [2.1, 3, 4], { breakWall: 2 })]);
    expect(a!.corners.every((c) => c[0] === 1.9 - MARK_LIFT)).toBe(true);
    expect(b!.corners.every((c) => c[0] === 2.1 + MARK_LIFT)).toBe(true);
  });

  it('draws a dashed outline, a dash at each corner', () => {
    const d = dashes([0, 0, 0], [1, 0, 0]);
    expect(d[0]![0]).toEqual([0, 0, 0]);
    expect(d).toHaveLength(Math.round((1 + MARK_GAP) / (MARK_DASH + MARK_GAP)));
    expect(d.at(-1)![1][0]).toBeCloseTo(1);
    const short = dashes([0, 0, 0], [0.1, 0, 0]);
    expect(short).toHaveLength(1);
    expect(short[0]![1][0]).toBeCloseTo(0.1);
  });

  it('outlines a wall once round all its pieces (a window in it), per face', () => {
    // A wall in two pieces either side of a window, one section, and a second wall of its own.
    const faces = breakWallMarkFaces([wall([0, 0, 0], [1.5, 3, 0.2], { breakWall: 0 }), wall([2.5, 0, 0], [4, 3, 0.2], { breakWall: 0 }), wall([1.5, 0, 0], [2.5, 1, 0.2], { breakWall: 0 }), wall([4, 0, 0], [4.2, 3, 4], { breakWall: 1 })]);
    const outlines = sectionOutlines(faces);
    expect(outlines).toHaveLength(4);
    expect(outlines[0]![0]).toEqual([0, 0, -MARK_LIFT]);
    expect(outlines[0]![2]).toEqual([4, 3, -MARK_LIFT]);
  });

  it('hatches each face with diagonals that run on across its pieces, clipped to it', () => {
    const [f] = breakWallMarkFaces([wall([0, 0, 0], [4, 3, 0.2], { breakWall: 0 })]);
    const h = hatchLines(f!);
    expect(h.length).toBeGreaterThan(Math.floor(7 / MARK_HATCH) - 2);
    for (const [a, b] of h) {
      for (const p of [a, b]) {
        expect(p[0]).toBeGreaterThanOrEqual(-1e-9);
        expect(p[0]).toBeLessThanOrEqual(4 + 1e-9);
        expect(p[1]).toBeGreaterThanOrEqual(-1e-9);
        expect(p[1]).toBeLessThanOrEqual(3 + 1e-9);
        expect((p[0] + p[1]) / MARK_HATCH).toBeCloseTo(Math.round((a[0] + a[1]) / MARK_HATCH));
      }
    }
    // A slice of an arch is marked across the wall like the rest of it, not along it (it is deeper than it is long).
    const arch = breakWallMarkFaces([wall([0, 0, 0], [4, 1, 0.3], { breakWall: 2 }), wall([1, 2, 0], [1.1, 2.4, 0.3], { breakWall: 2 })]);
    expect(arch.map((a) => a.along)).toEqual(['x', 'x', 'x', 'x']);
    // A thin slice (an arch's) is only inside its wall's outline: no hatching of its own.
    expect(hatchLines(breakWallMarkFaces([wall([0, 2, 0], [0.1, 3, 0.2], { breakWall: 0 })])[0]!)).toEqual([]);
    expect(breakWallMarkLines([f!]).length).toBe(h.length + 2 * (dashes([0, 0, 0], [4, 0, 0]).length + dashes([0, 0, 0], [0, 3, 0]).length));
  });

  it('keys only the marked walls (a prop moving changes nothing)', () => {
    const a = [wall([0, 0, 0], [4, 3, 0.2], { breakWall: 0 }), wall([5, 0, 0], [6, 1, 1])];
    expect(breakWallMarkKey(a)).toBe(breakWallMarkKey([a[0]!]));
    expect(breakWallMarkKey([])).toBe('');
  });

  it("marks the coverage map's breakable walls", () => {
    const doc = JSON.parse(readFileSync(fileURLToPath(new URL('../../../maps/test_coverage.json', import.meta.url)), 'utf8')) as MapDocument;
    const boxes = buildMapGeometry(doc);
    expect(boxes.some((b) => b.breakWall !== undefined)).toBe(true);
    expect(breakWallMarkFaces(boxes).length).toBeGreaterThan(4);
  });

  it('is editor-only: play never builds it', () => {
    const view = readFileSync(fileURLToPath(new URL('../src/game/view.ts', import.meta.url)), 'utf8');
    expect(view).not.toContain('breakWallMarks');
  });
});
