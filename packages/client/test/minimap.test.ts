// MapMaker UI spec Phase 3 (docs/MAPMAKER_UI_SPEC.md): the live minimap's maths (editor/minimapModel.ts): the frame and
// its zoom, the camera's marker, the selection's marks, what a click picks, when the picture is made again, and the
// dock's kept tab and zoom (never in the map).
import { describe, expect, it } from 'vitest';
import { newMapDocument, planToScreen, placementCells, type MapDocument, type MapEntity } from '@tiletrigger/shared';
import { bakeDelay, bakeScale, boxLevel, minimapArea, pictureArea, cameraMarker, clampMinimapZoom, horizontalHalfFov, minimapFrame, minimapPick, selectionMarks, type MinimapReader } from '../src/editor/minimapModel.ts';
import { parseDockPrefs, serializeDockPrefs } from '../src/editor/dockPrefs.ts';

const area = { x0: -40, z0: -20, x1: 40, z1: 20 };

function testMap(): MapDocument {
  const doc = newMapDocument('Minimap test');
  // (Without the new map's room and spawn.)
  doc.classicStructure.tiles = [];
  doc.entities = [];
  const cell = doc.classicStructure.cellSize;
  doc.classicStructure.tiles.push({ id: 't0', tile: 'core.floor', x: 0, y: 0, z: 0, rotation: 0 } as MapDocument['classicStructure']['tiles'][number]);
  doc.classicStructure.tiles.push({ id: 't1', tile: 'core.floor', x: 2, y: 0, z: 1, rotation: 0 } as MapDocument['classicStructure']['tiles'][number]);
  const prop = (id: string, x: number, y: number, z: number): MapEntity => ({ id, kind: 'prop', position: [x, y, z], model: 'kit.drum.steel', yaw: 0, scale: 1, solid: true, tint: null }) as MapEntity;
  doc.entities.push(prop('near', 0.5, 0, 0.5), prop('far', 30, 0, 10), prop('up', 2 * cell, doc.classicStructure.levelHeight, 0));
  doc.setPieces = [{ id: 'sp1', piece: 'test.piece', x: -3, y: 0, z: 0, rotation: 0 } as NonNullable<MapDocument['setPieces']>[number]];
  return doc;
}

function reader(doc: MapDocument): MinimapReader {
  const lh = doc.classicStructure.levelHeight;
  return {
    tileCells: (t) => placementCells(t) ?? [[t.x, t.y, t.z]],
    pieceCells: (id) => (id === 'sp1' ? [[-3, 0, 0], [-4, 0, 0]] : null),
    entityLevel: (e) => Math.floor((e.position[1] + 0.5) / lh),
  };
}

describe('the minimap frame', () => {
  it('fits the whole level at zoom 1, north up', () => {
    const f = minimapFrame(area, 200, 100, 1);
    expect(f.cx).toBe(0);
    expect(f.cz).toBe(0);
    expect(f.halfW / f.halfH).toBeCloseTo(2);
    expect(f.halfW).toBeGreaterThanOrEqual(40);
    // North (+Z) is up the canvas, east (+X) to the right.
    const n = planToScreen(f, 200, 100, 0, 10);
    const e = planToScreen(f, 200, 100, 10, 0);
    expect(n.y).toBeLessThan(50);
    expect(e.x).toBeGreaterThan(100);
  });

  it('zooms in about the camera, but never off the level', () => {
    const fit = minimapFrame(area, 200, 100, 1);
    const f = minimapFrame(area, 200, 100, 4, { x: 10, z: 5 });
    expect(f.halfH).toBeCloseTo(fit.halfH / 4);
    expect(f.cx).toBe(10);
    expect(f.cz).toBe(5);
    // A camera far outside: the frame is held at the level's edge.
    const edge = minimapFrame(area, 200, 100, 4, { x: 500, z: -500 });
    expect(edge.cx + edge.halfW).toBeCloseTo(fit.cx + fit.halfW);
    expect(edge.cz - edge.halfH).toBeCloseTo(fit.cz - fit.halfH);
  });

  it("frames the boundary, else everything placed (props too)", () => {
    const doc = testMap();
    const a = minimapArea(doc);
    expect(a.x1).toBeGreaterThanOrEqual(33);
    expect(a.z1).toBeGreaterThanOrEqual(13);
    expect(minimapArea({ ...doc, bounds: { min: [-10, -10], max: [10, 10] } } as MapDocument)).toEqual({ x0: -10, z0: -10, x1: 10, z1: 10 });
  });

  it('keeps the zoom between the whole level and 16 times closer', () => {
    expect(clampMinimapZoom(0.2)).toBe(1);
    expect(clampMinimapZoom(40)).toBe(16);
    expect(clampMinimapZoom('x')).toBe(1);
    expect(clampMinimapZoom(Number.NaN)).toBe(1);
  });
});

describe("the camera's marker", () => {
  const f = minimapFrame(area, 200, 100, 1);
  it('stands where the camera is and looks the way it faces (yaw 0: north, up)', () => {
    const m = cameraMarker(f, 200, 100, { x: 0, z: 0, yaw: 0 }, 0.5, 20);
    expect(m.x).toBeCloseTo(100);
    expect(m.y).toBeCloseTo(50);
    expect(m.dx).toBeCloseTo(0);
    expect(m.dy).toBeCloseTo(-1);
    // The wedge spreads either side of up, left edge to the left.
    expect(m.left.x).toBeLessThan(m.x);
    expect(m.right.x).toBeGreaterThan(m.x);
    expect(m.left.y).toBeLessThan(m.y);
  });

  it('turns east (right) for a quarter turn, as the editor camera does', () => {
    const m = cameraMarker(f, 200, 100, { x: 0, z: 0, yaw: Math.PI / 2 }, 0.5, 20);
    expect(m.dx).toBeCloseTo(1);
    expect(m.dy).toBeCloseTo(0);
  });

  it("widens the vertical field of view by the view's aspect", () => {
    expect(horizontalHalfFov(1, 1)).toBeCloseTo(0.5);
    expect(horizontalHalfFov(1, 16 / 9)).toBeGreaterThan(0.5);
  });
});

describe("the selection's marks", () => {
  const doc = testMap();
  const read = reader(doc);
  const cell = doc.classicStructure.cellSize;

  it('outlines a tile round its cells, a set piece round its footprint, and rings an entity', () => {
    const marks = selectionMarks(doc, { tiles: ['t0'], entities: ['near'], setPieces: ['sp1'] }, 0, read);
    const t = marks.find((m) => m.id === 't0')!;
    expect([t.x0, t.z0, t.x1, t.z1]).toEqual([-cell / 2, -cell / 2, cell / 2, cell / 2]);
    expect(t.current).toBe(true);
    const sp = marks.find((m) => m.id === 'sp1')!;
    expect(sp.x0).toBeCloseTo(-4.5 * cell);
    expect(sp.x1).toBeCloseTo(-2.5 * cell);
    const e = marks.find((m) => m.id === 'near')!;
    expect([e.x0, e.z0, e.x1, e.z1]).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it('marks what is on another level as such (drawn dashed), and nothing for an empty selection', () => {
    const marks = selectionMarks(doc, { tiles: ['t1'], entities: ['up'] }, 0, read);
    expect(marks.map((m) => [m.id, m.current])).toEqual([
      ['t1', false],
      ['up', false],
    ]);
    expect(selectionMarks(doc, { tiles: ['t1'], entities: ['up'] }, 1, read).every((m) => m.current)).toBe(true);
    expect(selectionMarks(doc, { tiles: [], entities: [] }, 0, read)).toEqual([]);
  });
});

describe('a click on the minimap', () => {
  const doc = testMap();
  const read = reader(doc);
  const cell = doc.classicStructure.cellSize;

  it('picks the nearest thing within reach first, then the set piece, then the tile there', () => {
    expect(minimapPick(doc, 0, 0.6, 0.4, 1, read)).toEqual({ tiles: [], entities: ['near'] });
    expect(minimapPick(doc, 0, cell * 0.3, -cell * 0.3, 0.5, read)).toEqual({ tiles: ['t0'], entities: [] });
    expect(minimapPick(doc, 0, -3 * cell, 0, 0.5, read)).toEqual({ tiles: [], entities: [], setPieces: ['sp1'] });
  });

  it('picks only on the level shown; open ground picks nothing (the camera goes there)', () => {
    expect(minimapPick(doc, 0, 2 * cell, 0, 0.5, read)).toBeNull();
    expect(minimapPick(doc, 1, 2 * cell, 0, 0.5, read)).toEqual({ tiles: [], entities: ['up'] });
    expect(minimapPick(doc, 0, 20, -15, 1, read)).toBeNull();
  });

  it("skips what the outliner locks or hides and the map layers switched off", () => {
    expect(minimapPick(doc, 0, 0.6, 0.4, 1, read, { skip: (id) => id === 'near' })).toEqual({ tiles: ['t0'], entities: [] });
    expect(minimapPick(doc, 0, 0.6, 0.4, 1, read, { hiddenLayers: new Set(['prop', 'tile']) })).toBeNull();
  });
});

describe("the minimap's picture", () => {
  it('puts a floor on the level it is the top of, anything else on the level of its foot', () => {
    expect(boxLevel({ kind: 'floor', min: [0, -0.2, 0], max: [1, 0, 1] }, 4)).toBe(0);
    expect(boxLevel({ kind: 'floor', min: [0, 3.8, 0], max: [1, 4, 1] }, 4)).toBe(1);
    expect(boxLevel({ kind: 'wall', min: [0, 4, 0], max: [1, 8, 1] }, 4)).toBe(1);
    expect(boxLevel({ kind: 'solid', min: [0, -4, 0], max: [1, 0, 1] }, 4)).toBe(-1);
  });

  it('covers room round the framed area, for a frame of another shape', () => {
    expect(pictureArea(area)).toEqual({ x0: -40 - 80 / 3, z0: -36, x1: 40 + 80 / 3, z1: 36 });
  });

  it('is about 3 px a metre, at most 1,600 px on its long side', () => {
    expect(bakeScale(area)).toBe(3);
    expect(bakeScale({ x0: 0, z0: 0, x1: 1600, z1: 100 })).toBe(1);
    expect(bakeScale({ x0: 0, z0: 0, x1: 100000, z1: 10 })).toBe(0.25);
  });

  it('is made again at once for a new level, after edits pause (at most 1.5 s into a run), never during a drag', () => {
    expect(bakeDelay({ edited: false, firstEditAgo: 0, dragging: false })).toBe(0);
    expect(bakeDelay({ edited: true, firstEditAgo: 0, dragging: false })).toBe(350);
    expect(bakeDelay({ edited: true, firstEditAgo: 1400, dragging: false })).toBe(100);
    expect(bakeDelay({ edited: true, firstEditAgo: 4000, dragging: false })).toBe(0);
    expect(bakeDelay({ edited: true, firstEditAgo: 0, dragging: true })).toBeNull();
  });
});

describe("the dock's tab and the minimap's zoom (this browser only)", () => {
  it('keeps the Minimap tab and a zoom, and leaves the defaults out', () => {
    const p = parseDockPrefs('{"right":"expanded","left":"open","tab":"minimap","minimapZoom":3.456}');
    expect(p).toEqual({ right: 'expanded', left: 'open', tab: 'minimap', minimapZoom: 3.46 });
    expect(serializeDockPrefs(p)).toBe('{"left":"open","right":"expanded","tab":"minimap","minimapZoom":3.46}');
    expect(parseDockPrefs('{"tab":"other","minimapZoom":0.5}')).toEqual({ right: 'expanded', left: 'open' });
    expect(serializeDockPrefs({ right: 'compact', left: 'open', tab: 'outliner', minimapZoom: 1 })).toBe('{"left":"open","right":"compact"}');
  });
});
