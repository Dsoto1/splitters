// MapMaker UI spec Phase 4a (docs/MAPMAKER_UI_SPEC.md): Tile View's maths (editor/tileViewModel.ts): the focus (a
// tile, set piece, group or area), local and world coordinates under the tile's turn, the fine snap, what a drag makes
// (one command), the things, parts and cell sides in it, what a click picks, and the dock's kept snap and frame.
import { describe, expect, it } from 'vitest';
import { applyCommand, EditHistory, newMapDocument, setEdgeCommand, transformCommand, type MapDocument, type MapEntity } from '@tiletrigger/shared';
import { parseDockPrefs, serializeDockPrefs } from '../src/editor/dockPrefs.ts';
import {
  breadcrumbs,
  buildFocus,
  dragMove,
  edgeClass,
  edgeName,
  focusChildren,
  focusEdges,
  focusRefAt,
  focusRefFor,
  localDirToWorld,
  localFacingDeg,
  snapTo,
  tileViewPick,
  toLocal,
  toWorld,
  turnQuarter,
  worldFacingDeg,
  type TileViewReader,
} from '../src/editor/tileViewModel.ts';

type Tile = MapDocument['classicStructure']['tiles'][number];

function testMap(): MapDocument {
  const doc = newMapDocument('Tile View test');
  doc.classicStructure.tiles = [];
  doc.entities = [];
  const tiles: Tile[] = [
    { id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 } as Tile,
    // A two-cell shop (cells [0,0] and [1,0] in its own frame), turned a quarter: its cells run south.
    { id: 'shop', tile: 'core.shop', x: 4, y: 0, z: 0, rotation: 1 } as Tile,
    { id: 'upper', tile: 'core.room', x: 0, y: 0, z: 1, rotation: 0 } as Tile,
  ];
  doc.classicStructure.tiles.push(...tiles);
  const prop = (id: string, x: number, y: number, z: number, yaw = 0): MapEntity => ({ id, kind: 'prop', position: [x, y, z], model: 'kit.drum.steel', yaw, scale: 1, solid: true, tint: null }) as MapEntity;
  const cell = doc.classicStructure.cellSize;
  const lh = doc.classicStructure.levelHeight;
  doc.entities.push(prop('crate', 1.5, 0, 2), prop('shelf', 4 * cell + 1, 0, -1, Math.PI / 2), prop('attic', 0.5, lh, 0.5), prop('field', 60, 0, 60), prop('field2', 62, 0, 61));
  doc.setPieces = [{ id: 'sp1', piece: 'test.piece', x: -4, y: 0, z: 0, rotation: 2 } as NonNullable<MapDocument['setPieces']>[number]];
  doc.groups = [{ id: 'g1', name: 'West base', members: ['room', 'crate'] }];
  return doc;
}

function reader(doc: MapDocument): TileViewReader {
  const lh = doc.classicStructure.levelHeight;
  return {
    pieceCells: (id) => (id === 'sp1' ? [[-4, 0, 0], [-5, 0, 0], [-4, 0, 1]] : null),
    pieceName: (id) => (id === 'sp1' ? 'Test Piece' : id),
    entityLevel: (e) => Math.floor((e.position[1] + 0.5) / lh),
  };
}

describe('local and world coordinates', () => {
  it("turn with the tile's quarter turns (east becomes south, as tiles turn)", () => {
    expect(turnQuarter(1, 0, 1)).toEqual([0, -1]);
    expect(turnQuarter(0, 1, 1)).toEqual([1, 0]);
    expect(turnQuarter(3, 2, 4)).toEqual([3, 2]);
    const f = { anchor: { x: 32, z: 0 }, rotation: 1 };
    // One metre east of the anchor is one metre "north" in the tile's own frame.
    expect(toLocal(f, 33, 0)).toEqual([0, 1]);
    expect(toWorld(f, 0, 1)).toEqual([33, 0]);
    expect(localDirToWorld(f, 0, 1)).toEqual([1, 0]);
  });

  it('go there and back for every turn', () => {
    for (let r = 0; r < 4; r++) {
      const f = { anchor: { x: -8, z: 16 }, rotation: r };
      for (const [x, z] of [[-3.25, 17.5], [0, 0], [12.345, -6.789]] as const) {
        const [lx, lz] = toLocal(f, x, z);
        expect(toWorld(f, lx, lz)).toEqual([x, z]);
      }
      expect(worldFacingDeg(f, localFacingDeg(f, 0.5))).toBeCloseTo((0.5 * 180) / Math.PI, 1);
    }
  });

  it("keep a thing's local place and facing when its tile is turned with it", () => {
    const doc = testMap();
    const before = buildFocus(doc, { kind: 'tile', id: 'shop' }, 0, reader(doc))!;
    const shelf = doc.entities.find((e) => e.id === 'shelf')!;
    const at = toLocal(before, shelf.position[0], shelf.position[2]);
    const facing = localFacingDeg(before, (shelf as { yaw: number }).yaw);
    // Turn the shop and the shelf together a quarter (the ring, R): the shelf stays put in the shop's own frame.
    const cmd = transformCommand(doc, { tiles: ['shop'], entities: ['shelf'] }, { turn: Math.PI / 2 });
    expect('error' in cmd).toBe(false);
    const after = applyCommand(doc, cmd as Exclude<typeof cmd, { error: string }>);
    const f2 = buildFocus(after, { kind: 'tile', id: 'shop' }, 0, reader(after))!;
    expect(f2.rotation).toBe((before.rotation + 1) % 4);
    const shelf2 = after.entities.find((e) => e.id === 'shelf')!;
    const at2 = toLocal(f2, shelf2.position[0], shelf2.position[2]);
    expect(at2[0]).toBeCloseTo(at[0], 2);
    expect(at2[1]).toBeCloseTo(at[1], 2);
    expect(localFacingDeg(f2, (shelf2 as { yaw: number }).yaw)).toBeCloseTo(facing, 1);
  });
});

describe('the fine snap and a drag', () => {
  it('snaps to 1, 5, 10 or 50 cm, or the millimetre when free', () => {
    expect(snapTo(1.234, 0.01)).toBe(1.23);
    expect(snapTo(1.234, 0.05)).toBe(1.25);
    expect(snapTo(1.234, 0.1)).toBe(1.2);
    expect(snapTo(1.234, 0.5)).toBe(1);
    expect(snapTo(1.23456, 0.5, true)).toBe(1.235);
  });

  it('lands on the step of the frame shown, local in a turned tile', () => {
    const f = { anchor: { x: 32, z: 0 }, rotation: 1 };
    // From local (0.33, 0.47) (world 32.47, -0.33), dragged 1.02 m east.
    const from = toWorld(f, 0.33, 0.47);
    const d = dragMove(f, from, [1.02, 0], 0.1, 'local');
    const [lx, lz] = toLocal(f, from[0] + d[0], from[1] + d[2]);
    expect(lx).toBeCloseTo(0.3, 6);
    expect(lz).toBeCloseTo(1.5, 6);
    expect(d[1]).toBe(0);
    // World: on the world's 10 cm.
    const w = dragMove(f, [1.234, 2.345], [0.5, 0], 0.1, 'world');
    expect(1.234 + w[0]).toBeCloseTo(1.7, 6);
    expect(2.345 + w[2]).toBeCloseTo(2.3, 6);
    // Free: the pointer's own travel, to the millimetre.
    expect(dragMove(f, [1, 1], [0.1234, 0.0004], 0.5, 'local', true)).toEqual([0.123, 0, 0]);
  });

  it('is one command and one undo step, through the shared transform', () => {
    const doc = testMap();
    const f = buildFocus(doc, { kind: 'tile', id: 'room' }, 0, reader(doc))!;
    const d = dragMove(f, [1.5, 2], [0.73, -0.41], 0.05, 'local');
    const h = new EditHistory(doc);
    const cmd = transformCommand(doc, { tiles: [], entities: ['crate'] }, { by: { metres: d } });
    expect('error' in cmd).toBe(false);
    h.execute('Move', cmd as Exclude<typeof cmd, { error: string }>);
    const moved = h.doc.entities.find((e) => e.id === 'crate')!;
    expect(moved.position[0]).toBeCloseTo(2.25, 6);
    expect(moved.position[2]).toBeCloseTo(1.6, 6);
    h.undo();
    expect(h.doc.entities.find((e) => e.id === 'crate')!.position).toEqual([1.5, 0, 2]);
  });
});

describe('the focus', () => {
  it('is a tile: its cells on the level, anchor and turn', () => {
    const doc = testMap();
    const f = buildFocus(doc, { kind: 'tile', id: 'shop' }, 0, reader(doc))!;
    expect(f.kind).toBe('tile');
    expect(f.cells).toEqual([[4, 0], [4, -1]]);
    expect(f.anchor).toEqual({ x: 32, z: 0 });
    expect(f.rotation).toBe(1);
    expect(f.rect).toEqual({ x0: 28, z0: -12, x1: 36, z1: 4 });
    // A tile with nothing on the level asked for shows its own.
    expect(buildFocus(doc, { kind: 'tile', id: 'upper' }, 0, reader(doc))!.level).toBe(1);
    expect(buildFocus(doc, { kind: 'tile', id: 'gone' }, 0, reader(doc))).toBeNull();
  });

  it('is a set piece (its footprint on the level), a group, or an area', () => {
    const doc = testMap();
    const sp = buildFocus(doc, { kind: 'setpiece', id: 'sp1' }, 0, reader(doc))!;
    expect(sp.cells).toEqual([[-4, 0], [-5, 0]]);
    expect(sp.rotation).toBe(2);
    expect(sp.name).toBe('Test Piece');
    expect(buildFocus(doc, { kind: 'setpiece', id: 'sp1' }, 1, reader(doc))!.cells).toEqual([[-4, 0]]);
    const g = buildFocus(doc, { kind: 'group', id: 'g1' }, 0, reader(doc))!;
    expect(g.name).toBe('West base');
    expect(g.rect).toEqual({ x0: -4, z0: -4, x1: 4, z1: 4 });
    expect(g.anchor).toEqual({ x: -4, z: -4 });
    const area = buildFocus(doc, { kind: 'region', cells: { x0: 7, y0: 7, x1: 8, y1: 8 } }, 0, reader(doc))!;
    expect(area.cells).toHaveLength(4);
    expect(area.rect).toEqual({ x0: 52, z0: 52, x1: 68, z1: 68 });
  });

  it('comes from the selection: a group first, then a tile or set piece, then an area round things', () => {
    const doc = testMap();
    expect(focusRefFor(doc, { tiles: ['room'], entities: ['crate'] })).toEqual({ kind: 'group', id: 'g1' });
    expect(focusRefFor(doc, { tiles: ['shop'], entities: [] })).toEqual({ kind: 'tile', id: 'shop' });
    expect(focusRefFor(doc, { tiles: [], entities: [], setPieces: ['sp1'] })).toEqual({ kind: 'setpiece', id: 'sp1' });
    expect(focusRefFor(doc, { tiles: [], entities: ['field', 'field2'] })).toEqual({ kind: 'region', cells: { x0: 8, y0: 8, x1: 8, y1: 8 } });
    expect(focusRefFor(doc, { tiles: [], entities: [] })).toBeNull();
  });

  it("comes from a point on the minimap: the tile or set piece there, else that cell", () => {
    const doc = testMap();
    expect(focusRefAt(doc, 0, 33, -7, reader(doc))).toEqual({ kind: 'tile', id: 'shop' });
    expect(focusRefAt(doc, 0, -40, 1, reader(doc))).toEqual({ kind: 'setpiece', id: 'sp1' });
    expect(focusRefAt(doc, 1, 1, 1, reader(doc))).toEqual({ kind: 'tile', id: 'upper' });
    expect(focusRefAt(doc, 0, 100, 100, reader(doc))).toEqual({ kind: 'region', cells: { x0: 13, y0: 13, x1: 13, y1: 13 } });
  });
});

describe('what is in it', () => {
  it("lists the things on its level, the map's own editable and a set piece's parts read-only", () => {
    const doc = testMap();
    const view: MapDocument = { ...doc, entities: [...doc.entities, { id: 'sp_sp1_0', kind: 'prop', position: [-33, 0, 1], model: 'kit.drum.steel', yaw: 0, scale: 1, solid: true, tint: null } as MapEntity] };
    const partOf = new Map([['sp_sp1_0', 'sp1']]);
    const room = buildFocus(doc, { kind: 'tile', id: 'room' }, 0, reader(doc))!;
    expect(focusChildren(doc, view, room, reader(doc), partOf).map((c) => c.id)).toEqual(['crate']);
    const sp = buildFocus(doc, { kind: 'setpiece', id: 'sp1' }, 0, reader(doc))!;
    const kids = focusChildren(doc, view, sp, reader(doc), partOf);
    expect(kids).toHaveLength(1);
    expect(kids[0]!.partOf).toBe('sp1');
    const up = buildFocus(doc, { kind: 'tile', id: 'upper' }, 1, reader(doc))!;
    expect(focusChildren(doc, view, up, reader(doc), partOf).map((c) => c.id)).toEqual(['attic']);
  });

  it("lists a tile's outer cell sides with what is built there, and follows a change of style", () => {
    const doc = testMap();
    const shop = buildFocus(doc, { kind: 'tile', id: 'shop' }, 0, reader(doc))!;
    const sides = focusEdges(doc, shop);
    // Two cells, the side between them inside the piece: 6 sides.
    expect(sides).toHaveLength(6);
    expect(sides.every((e) => e.tileId === 'shop')).toBe(true);
    const room = buildFocus(doc, { kind: 'tile', id: 'room' }, 0, reader(doc))!;
    const north = focusEdges(doc, room).find((e) => e.target.side === 'N')!;
    expect(north.a).toEqual([-4, 4]);
    expect(north.b).toEqual([4, 4]);
    const cmd = setEdgeCommand(doc, north.target, 'door');
    expect('error' in cmd).toBe(false);
    const after = applyCommand(doc, cmd as Exclude<typeof cmd, { error: string }>);
    const now = focusEdges(after, room).find((e) => e.target.side === 'N')!;
    expect(now.style).toBe('door');
    expect(edgeClass(now.style)).toBe('door');
    expect(edgeClass('window')).toBe('window');
    expect(edgeClass('wall')).toBe('wall');
    expect(edgeClass('none')).toBe('open');
    expect(edgeName(now.target)).toBe('North side of cell 0, 0');
    // A set piece's insides are generated: no sides to change.
    expect(focusEdges(doc, buildFocus(doc, { kind: 'setpiece', id: 'sp1' }, 0, reader(doc))!)).toEqual([]);
  });

  it('picks the nearest thing (its own before a part), else a side, never a locked one', () => {
    const kids = [
      { id: 'a', x: 0, z: 0, yaw: null, partOf: null, half: null },
      { id: 'p', x: 0, z: 0, yaw: null, partOf: 'sp1', half: null },
      { id: 'b', x: 2, z: 0, yaw: null, partOf: null, half: [1, 1] as [number, number] },
    ];
    const edges = [{ target: { cell: [0, 0, 0] as [number, number, number], side: 'N' as const }, tileId: 't', a: [-4, 4] as [number, number], b: [4, 4] as [number, number], style: 'wall' }];
    expect(tileViewPick(kids, edges, 0.1, 0, 0.5)).toEqual({ kind: 'child', id: 'a', part: null });
    expect(tileViewPick(kids, edges, 2.8, 0.5, 0.2)).toEqual({ kind: 'child', id: 'b', part: null });
    expect(tileViewPick(kids, edges, 0.1, 0, 0.5, (id) => id === 'a')).toEqual({ kind: 'child', id: 'p', part: 'sp1' });
    expect(tileViewPick(kids, edges, 1, 3.8, 0.5)?.kind).toBe('edge');
    expect(tileViewPick(kids, edges, -3, -3, 0.5)).toBeNull();
  });

  it('names where you are: Map › the focus › the child', () => {
    expect(breadcrumbs({ name: 'Small Room' }, null)).toEqual(['Map', 'Small Room']);
    expect(breadcrumbs({ name: 'Small Room' }, 'Door 2')).toEqual(['Map', 'Small Room', 'Door 2']);
  });
});

describe("Tile View's snap and frame, kept in this browser", () => {
  it('reads and writes them, ignoring nonsense', () => {
    const p = parseDockPrefs(JSON.stringify({ right: 'expanded', left: 'open', tileSnap: 5, tileFrame: 'world' }));
    expect(p.tileSnap).toBe(5);
    expect(p.tileFrame).toBe('world');
    expect(JSON.parse(serializeDockPrefs(p))).toMatchObject({ tileSnap: 5, tileFrame: 'world' });
    const bad = parseDockPrefs(JSON.stringify({ right: 'expanded', left: 'open', tileSnap: 7, tileFrame: 'up' }));
    expect(bad.tileSnap).toBeUndefined();
    expect(bad.tileFrame).toBeUndefined();
    // The defaults (10 cm, local) aren't written.
    expect(serializeDockPrefs({ right: 'expanded', left: 'open', tileSnap: 10 })).toBe('{"left":"open","right":"expanded"}');
  });
});
