import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  SIDES,
  VISIBLE_IMPORTED_MAPS,
  blockBoxes,
  buildMapGeometry,
  coreCatalog,
  loadMap,
  mapInspiration,
  propBoxes,
  resolveBackdrop,
  rotateSide,
  rotateXZ,
  tsFootprintCell,
  tsRotationToOurs,
  tsTurnSide,
  validateMap,
  type MapDocument,
} from '../src/index.ts';
import { NavWorld, initNavigation, validateNavigation } from '../src/nav/index.ts';

/** Maps converted from TimeSplitters MapMaker saves (packages/server/src/tools/import-timesplitters.ts). */
const dir = new URL('../../../maps/imported/', import.meta.url);
const ids = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5));
const load = (id: string): MapDocument => {
  const r = loadMap(readFileSync(new URL(`${id}.json`, dir), 'utf8'));
  if (!r.ok) throw new Error(`${id} does not load`);
  return r.map;
};

beforeAll(() => initNavigation());

describe('TimeSplitters grid conventions (decoder and converter)', () => {
  it('turns pieces counter-clockwise, the way the save does', () => {
    // A corridor exit pointing north at rotation 0 points west after one counter-clockwise quarter turn.
    expect(tsTurnSide('N', 1)).toBe('W');
    expect(tsTurnSide('E', 1)).toBe('N');
    expect(tsTurnSide('N', 2)).toBe('S');
    expect(tsTurnSide('N', 3)).toBe('E');
    expect(tsTurnSide('S', 4)).toBe('S');
  });

  it('anchors a turned footprint at its minimum corner (as tsdecode.py)', () => {
    // A 1 x 2 piece (local cells (0,0) south and (0,1) north) saved at (5, 7).
    const cells = (rot: number) => [tsFootprintCell(5, 7, rot, 1, 2, 0, 0), tsFootprintCell(5, 7, rot, 1, 2, 0, 1)];
    expect(cells(0)).toEqual([[5, 7], [5, 8]]); // north end up
    expect(cells(1)).toEqual([[6, 7], [5, 7]]); // north end turned to the west
    expect(cells(2)).toEqual([[5, 8], [5, 7]]); // north end turned to the south
    expect(cells(3)).toEqual([[5, 7], [6, 7]]); // north end turned to the east
    // A 3 x 3 room covers the same nine cells at every rotation.
    for (let rot = 0; rot < 4; rot++) {
      const room = new Set<string>();
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) room.add(tsFootprintCell(0, 0, rot, 3, 3, i, j).join(','));
      expect([...room].sort()).toEqual(['0,0', '0,1', '0,2', '1,0', '1,1', '1,2', '2,0', '2,1', '2,2']);
    }
  });

  it('maps the save rotation onto ours without mirroring a piece', () => {
    for (let rot = 0; rot < 4; rot++) {
      const ours = tsRotationToOurs(rot);
      // Every side of a piece ends up facing the same way in both frames...
      for (const s of SIDES) expect(rotateSide(s, ours)).toBe(tsTurnSide(s, rot));
      // ...and so does every cell of its footprint (up to where the footprint is anchored).
      for (const [w, h] of [[1, 2], [2, 3], [3, 1]] as const) {
        const theirs: [number, number][] = [];
        const mine: [number, number][] = [];
        for (let j = 0; j < h; j++) {
          for (let i = 0; i < w; i++) {
            theirs.push(tsFootprintCell(0, 0, rot, w, h, i, j));
            mine.push(rotateXZ(i, j, ours));
          }
        }
        const mx = Math.min(...mine.map((c) => c[0]));
        const my = Math.min(...mine.map((c) => c[1]));
        expect(mine.map(([x, y]) => [x - mx, y - my])).toEqual(theirs);
      }
    }
  });

  it('turns our stairs to climb toward the side the save goes up on', () => {
    // The converter turns our stairs (low port west, high port east) so the high port faces the upper level.
    for (const high of SIDES) {
      const r = SIDES.findIndex((_, q) => rotateSide('E', q) === high);
      expect(rotateSide('E', r)).toBe(high);
      expect(rotateSide('W', r)).toBe(rotateSide(high, 2));
    }
  });
});

describe('imported TimeSplitters maps', () => {
  it('stand on ground: no theme backdrop leaves sky under the map', () => {
    expect(ids.length).toBeGreaterThan(100);
    for (const id of ids) expect(resolveBackdrop(load(id)).ground, id).not.toBe('none');
  });

  it('list only maps that exist, credited to their game', () => {
    expect(VISIBLE_IMPORTED_MAPS.length).toBe(5);
    for (const id of VISIBLE_IMPORTED_MAPS) {
      expect(ids).toContain(id);
      expect(mapInspiration(id)).toMatch(/TimeSplitters/);
    }
  });

  it.each([...VISIBLE_IMPORTED_MAPS])('%s (visible) validates clean and bots reach every floor', (id) => {
    const map = load(id);
    const nav = NavWorld.build([...buildMapGeometry(map), ...propBoxes(map, true), ...blockBoxes(map, true)]);
    try {
      expect([...validateMap(map), ...validateNavigation(map, nav)]).toEqual([]);
      expect(map.entities.filter((e) => e.kind === 'spawn').length).toBeGreaterThanOrEqual(8);
      expect(map.entities.filter((e) => e.kind === 'pickup').length).toBeGreaterThanOrEqual(8);
      expect(map.entities.filter((e) => e.kind === 'light').length).toBeGreaterThan(0);
      // Every cell with a floor of its own can be walked to from the first spawn.
      const { cellSize, levelHeight } = map.classicStructure;
      const s = map.entities.find((e) => e.kind === 'spawn')!;
      const from = { x: s.position[0], y: s.position[1], z: s.position[2] };
      const cut: string[] = [];
      for (const t of map.classicStructure.tiles) {
        const def = coreCatalog.get(t.tile)!;
        if (def.category === 'Vertical') continue;
        for (const [dx, dy, dz] of def.cells) {
          if (!def.floors.includes(dz)) continue;
          const [rx, ry] = rotateXZ(dx, dy, t.rotation);
          const p = { x: (t.x + rx) * cellSize, y: (t.z + dz) * levelHeight + 0.05, z: (t.y + ry) * cellSize };
          const q = nav.closestPoint(p, { x: 3, y: 1.2, z: 3 });
          const path = q && nav.findPath(from, q);
          const end = path?.[path.length - 1];
          if (!q || !end || Math.hypot(end.x - q.x, end.z - q.z) > 1.5 || Math.abs(end.y - q.y) > 1.5) cut.push(`${t.x + rx},${t.y + ry},${t.z + dz}`);
        }
      }
      expect(cut).toEqual([]);
    } finally {
      nav.destroy();
    }
  });
});
