// MapMaker's breakable-wall mark (QUEUE "Breakable walls: a mark in MapMaker's 3D view"): which faces it marks and
// its dashed outline. Editor-only: play's view never builds it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMapGeometry, type MapDocument, type WorldBox } from '@tiletrigger/shared';
import { MARK_DASH, MARK_GAP, MARK_LIFT, breakWallMarkFaces, breakWallMarkKey, breakWallMarkLines, dashes } from '../src/editor/breakWallMarks.ts';

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
    const faces = breakWallMarkFaces([wall([0, 0, 0], [4, 3, 0.2], { breakWall: 0 })]);
    expect(breakWallMarkLines(faces).length).toBe(2 * 2 * (dashes([0, 0, 0], [4, 0, 0]).length + dashes([0, 0, 0], [0, 3, 0]).length));
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
