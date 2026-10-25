import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FACADE_PIECES, buildFacades, buildMapGeometry, tileModels, validateMap, type MapDocument, type Rotation } from '../src/index.ts';
import { makeMap } from './helpers.ts';

type Tile = MapDocument['classicStructure']['tiles'][number];
const t = (id: string, tile: string, x: number, y: number, z = 0, rotation: Rotation = 0, extra: Partial<Tile> = {}): Tile => ({ id, tile, x, y, z, rotation, ...extra });

/** Node names in a GLB's JSON chunk. */
function glbNodes(path: string): string[] {
  const buf = readFileSync(path);
  const len = buf.readUInt32LE(12);
  return (JSON.parse(buf.subarray(20, 20 + len).toString('utf8')).nodes as { name?: string }[]).map((n) => n.name ?? '');
}

describe('city kit', () => {
  it('ships every facade piece the layout can ask for', () => {
    const nodes = glbNodes(new URL('../../client/public/city/facades.glb', import.meta.url).pathname);
    for (const p of FACADE_PIECES) expect(nodes, p).toContain(p);
  });

  it('dresses only outside walls: none between two rooms, bays across each side, a cornice under an open roof and columns on outer corners', () => {
    const map = makeMap([t('a', 'core.room', 0, 0, 0, 0, { options: { facade: 'brick' } }), t('b', 'core.room', 1, 0)]);
    expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
    const pieces = buildFacades(map);
    expect(pieces.length).toBeGreaterThan(0);
    // Nothing on the side shared with the next room (x = 4).
    expect(pieces.filter((p) => Math.abs(p.at[0] - 4) < 0.6 && p.piece !== 'Trim_Column_Center')).toEqual([]);
    // The west side is solid wall: three bays, windows either end.
    const west = pieces.filter((p) => p.at[0] < -4 && p.at[1] === 0 && p.piece !== 'Trim_Column_Center');
    expect(west.map((p) => p.piece)).toEqual(['Brick_Window_Trim_Single', 'Brick_BottomTrim', 'Brick_Window_Trim_Single']);
    expect(pieces.some((p) => p.piece === 'Cornice_Brick_Center' && p.at[1] === 4)).toBe(true);
    expect(pieces.filter((p) => p.piece === 'Trim_Column_Center').length).toBe(2);
    // Upstairs gets the upper-floor pieces, and the ground floor no cornice once something is built on top.
    const two = buildFacades(makeMap([t('a', 'core.room', 0, 0, 0, 0, { options: { facade: 'brick' } }), t('b', 'core.room', 0, 0, 1, 0, { options: { facade: 'brick' } })]));
    expect(two.some((p) => p.at[1] === 4 && p.piece === 'Brick_Plain_3')).toBe(true);
    expect(two.filter((p) => p.piece === 'Cornice_Brick_Center').every((p) => p.at[1] === 8)).toBe(true);
  });

  it('buildings are solid blocks with no walls round them, drawn centred on their cells', () => {
    for (const [tile, cells, height] of [['city.brownstone', 2, 22.7], ['city.midrise', 2, 28.6], ['city.highrise', 3, 33.6]] as const) {
      for (const rotation of [0, 1, 2, 3] as Rotation[]) {
        // A courtyard against its west side, whichever way it is turned.
        const west = rotation >= 2 ? -cells : -1;
        const map = makeMap([t('b', tile, 0, 0, 0, rotation), t('y', 'core.yard', west, 0)]);
        expect(validateMap(map).filter((i) => i.severity === 'error'), tile).toEqual([]);
        const boxes = buildMapGeometry(map);
        const block = boxes.find((b) => b.sourceId === 'b' && b.kind === 'prop')!;
        expect(block.max[1], tile).toBeCloseTo(height, 1);
        // The courtyard beside it puts up no wall against it.
        expect(boxes.filter((b) => b.sourceId === 'y' && b.kind === 'wall' && b.min[0] > west * 8 + 3)).toEqual([]);
        const [model] = tileModels(map);
        const span = (cells - 1) * 8;
        const [cx, cz] = [[span / 2, span / 2], [span / 2, -span / 2], [-span / 2, -span / 2], [-span / 2, span / 2]][rotation]!;
        expect(model!.at[0], `${tile} r${rotation}`).toBeCloseTo(cx!, 5);
        expect(model!.at[2], `${tile} r${rotation}`).toBeCloseTo(cz!, 5);
      }
    }
  });

  it('streets join up without walls and are walked at floor height', () => {
    const map = makeMap([t('x', 'city.crossroads', 0, 0), t('s', 'city.street', 4, 1), t('n', 'city.street', 1, 4, 0, 1)]);
    expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
    const boxes = buildMapGeometry(map);
    expect(boxes.filter((b) => b.kind === 'wall' && ['x', 's', 'n'].includes(b.sourceId) && b.min[0] > 2 && b.max[0] < 30 && b.min[2] > 2 && b.max[2] < 30)).toEqual([]);
    expect(boxes.filter((b) => b.kind === 'floor' && b.sourceId === 's').every((b) => b.max[1] === 0)).toBe(true);
  });
});
