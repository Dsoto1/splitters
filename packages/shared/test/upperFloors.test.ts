// Floors in a piece's own upper storeys (`upperFloors`, format v26): a cell holds one piece, so a floor (the ceiling of
// the storey below) over a piece that stands more than one level tall goes in as part of that piece. MapMaker: the
// inspector's "Floor on Level N", or a Platform placed on the cell.
import { describe, expect, it } from 'vitest';
import {
  MAP_FORMAT_VERSION,
  applyCommand,
  buildMapGeometry,
  buildMapDecor,
  canAddFloor,
  checkPlacement,
  coplanarOverlaps,
  coreCatalog,
  loadMap,
  placeTileCommand,
  serializeMap,
  setUpperFloorsCommand,
  upperFloorAt,
  upperFloorLevels,
  validateMap,
  visibleFaces,
  type EditCommand,
  type MapDocument,
  type Rotation,
  type TilePlacement,
  type WorldBox,
} from '../src/index.ts';
import { makeMap } from './helpers.ts';

const def = (id: string) => coreCatalog.get(id)!;
const unwrap = <T extends object>(r: T | { error: string }): T => {
  if ('error' in r) throw new Error(r.error);
  return r;
};
const arch = (rotation: Rotation = 0, extra: Partial<TilePlacement> = {}): TilePlacement => ({ id: 't_arch', tile: 'imperial.triumphal_arch', x: 2, y: 3, z: 0, rotation, ...extra });
const slabsOf = (doc: MapDocument, id: string) => buildMapGeometry(doc).filter((b) => b.kind === 'floor' && b.sourceId === id);
const key = (b: WorldBox) => JSON.stringify([b.min, b.max, b.kind, b.sourceId]);

describe('which storeys take a floor', () => {
  it('upper storeys a piece leaves without a floor; not the bottom one, stairs, model buildings or storeys with a floor', () => {
    expect(canAddFloor(def('imperial.triumphal_arch'), [0, 0, 1])).toBe(true);
    expect(canAddFloor(def('imperial.triumphal_arch'), [0, 0, 0])).toBe(false);
    expect(canAddFloor(def('core.room_tall'), [0, 0, 1])).toBe(true);
    expect(canAddFloor(def('egypt.pylon'), [2, 0, 2])).toBe(true);
    expect(canAddFloor(def('egypt.pylon'), [3, 0, 1])).toBe(false);
    // Their upper storey is the way up.
    expect(canAddFloor(def('core.stairs'), [0, 0, 1])).toBe(false);
    expect(canAddFloor(def('core.stairwell'), [0, 0, 1])).toBe(false);
    // Floorless on purpose at the bottom.
    expect(canAddFloor(def('core.room_sunken'), [0, 0, -1])).toBe(false);
    // Storeys drawn in the model.
    expect(canAddFloor(def('city.midrise'), [0, 0, 1])).toBe(false);
  });

  it('lists a piece’s storeys by level, over its whole footprint', () => {
    expect(upperFloorLevels({ id: 'p', tile: 'egypt.pylon', x: 0, y: 0, z: 0, rotation: 0, upperFloors: ['0,0,1'] })).toEqual([
      { dz: 1, keys: ['0,0,1', '1,0,1', '2,0,1'], on: 1 },
      { dz: 2, keys: ['0,0,2', '1,0,2', '2,0,2'], on: 0 },
    ]);
    expect(upperFloorLevels({ id: 'r', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 })).toEqual([]);
  });
});

describe('placing over a tall piece', () => {
  it('a tile on its upper storey is refused with what to do instead', () => {
    const doc = makeMap([arch()]);
    const r = placeTileCommand(doc, 'core.room', 2, 3, 1, 0);
    expect(r).toEqual({
      error: "overlaps Triumphal Arch: Level 1 here is its upper storey (it stands 2 levels tall). To put a floor there, place a Platform on it (it becomes the Triumphal Arch's floor), or select the Triumphal Arch and tick “Floor on Level 1”",
    });
    // Its other cells and levels are free as before.
    expect(checkPlacement(doc, [{ id: 'n', tile: 'core.room', x: 2, y: 3, z: 2, rotation: 0 }]).ok).toBe(true);
  });

  it('a Platform there becomes the piece’s own floor: one slab at the storey’s floor level, nothing else changes', () => {
    for (const rotation of [0, 1, 2, 3] as Rotation[]) {
      const doc = makeMap([arch(rotation)]);
      const before = buildMapGeometry(doc);
      const placed = unwrap(placeTileCommand(doc, 'core.platform', 2, 3, 1, 0));
      expect(placed.floorOf?.id).toBe('t_arch');
      const after = applyCommand(doc, placed.command);
      expect(after.classicStructure.tiles).toEqual([arch(rotation, { upperFloors: ['0,0,1'] })]);
      const added = buildMapGeometry(after).filter((b) => !before.some((o) => key(o) === key(b)));
      expect(added).toEqual([{ min: [12, 3.5, 20], max: [20, 4, 28], kind: 'floor', sourceId: 't_arch' }]);
      // Everything the piece had stays (collision included).
      const now = new Set(buildMapGeometry(after).map(key));
      expect(before.every((b) => now.has(key(b)))).toBe(true);
      // A second Platform is refused: the floor is there already.
      expect(placeTileCommand(after, 'core.platform', 2, 3, 1, 0)).toEqual({ error: expect.stringContaining('it has a floor there already') });
      expect(upperFloorAt(after, 2, 3, 1)).toMatchObject({ key: '0,0,1', has: true });
    }
  });

  it('on a turned multi-cell piece the floor lands in the cell clicked', () => {
    const pylon: TilePlacement = { id: 'p', tile: 'egypt.pylon', x: 0, y: 0, z: 0, rotation: 1 };
    const doc = makeMap([pylon]);
    // Turned a quarter, its three cells run south: (0,0), (0,-1), (0,-2).
    const placed = unwrap(placeTileCommand(doc, 'core.platform', 0, -2, 2, 0));
    const after = applyCommand(doc, placed.command);
    expect(after.classicStructure.tiles[0]!.upperFloors).toEqual(['2,0,2']);
    const slab = slabsOf(after, 'p').find((b) => b.max[1] === 8);
    expect(slab).toEqual({ min: [-4, 7.5, -20], max: [4, 8, -12], kind: 'floor', sourceId: 'p' });
  });

  it('only a floor-only piece goes in that way; stairs keep their upper storey', () => {
    const doc = makeMap([arch(), { id: 's', tile: 'core.stairs', x: 6, y: 0, z: 0, rotation: 0 }]);
    expect(placeTileCommand(doc, 'core.platform_rail', 2, 3, 1, 0)).toHaveProperty('error');
    expect(placeTileCommand(doc, 'core.yard', 2, 3, 1, 0)).toHaveProperty('error');
    expect(placeTileCommand(doc, 'core.platform', 6, 0, 1, 0)).toEqual({ error: expect.stringMatching(/^overlaps Stairs: Level 1 here is part of it/) });
  });
});

describe('the inspector’s Floor on Level N', () => {
  it('adds and takes out floors over the whole storey, undoably', () => {
    const t: TilePlacement = { id: 'p', tile: 'egypt.pylon', x: 0, y: 0, z: 0, rotation: 0 };
    const doc = makeMap([t]);
    const keys = upperFloorLevels(t)[0]!.keys;
    const on = applyCommand(doc, unwrap(setUpperFloorsCommand(doc, t, keys, true)) as EditCommand);
    expect(on.classicStructure.tiles[0]!.upperFloors).toEqual(['0,0,1', '1,0,1', '2,0,1']);
    expect(slabsOf(on, 'p').filter((b) => b.max[1] === 4)).toHaveLength(3);
    const off = applyCommand(on, unwrap(setUpperFloorsCommand(on, on.classicStructure.tiles[0]!, keys, false)) as EditCommand);
    expect(off.classicStructure.tiles[0]).toEqual(t);
    expect(setUpperFloorsCommand(doc, t, ['0,0,0'], true)).toEqual({ error: "Temple Pylon can't take a floor there" });
  });

  it('a floor somewhere it can’t go (another type now, hand edits) builds nothing', () => {
    const doc = makeMap([{ id: 's', tile: 'core.stairs', x: 0, y: 0, z: 0, rotation: 0, upperFloors: ['0,0,1', '0,0,0', '5,5,5'] }]);
    expect(buildMapGeometry(doc)).toEqual(buildMapGeometry(makeMap([{ id: 's', tile: 'core.stairs', x: 0, y: 0, z: 0, rotation: 0 }])));
  });

  it('spawns stand on it, and it saves and loads (format v26; v25 maps load as they were)', () => {
    const doc = makeMap([arch(0, { upperFloors: ['0,0,1'] })], [[16, 4, 24]]);
    expect(validateMap(doc).filter((i) => i.severity === 'error')).toEqual([]);
    const loaded = loadMap(serializeMap(doc));
    expect(loaded.ok && loaded.map.formatVersion).toBe(MAP_FORMAT_VERSION);
    expect(MAP_FORMAT_VERSION).toBe(26);
    expect(loaded.ok && loaded.map.classicStructure.tiles[0]!.upperFloors).toEqual(['0,0,1']);
    const old = loadMap(JSON.stringify({ ...makeMap([arch()]), formatVersion: 25 }));
    expect(old.ok && old.map.classicStructure.tiles[0]).toEqual(arch());
  });
});

// The flicker audit's rule for the new floors: every piece that takes one, with a floor in every storey it can,
// draws no two faces in one plane (the slab meets the piece's own tops, piers and columns at its level).
describe('no flicker from added floors', () => {
  const tall = coreCatalog.all().filter((d) => d.cells.some((c) => canAddFloor(d, c)));
  it('there are pieces to check', () => expect(tall.length).toBeGreaterThan(20));
  it.each(tall.map((d) => d.id))('%s with every upper floor draws no coplanar overlaps', (id) => {
    for (const rotation of [0, 1] as Rotation[]) {
      const t: TilePlacement = { id: 't', tile: id, x: 0, y: 0, z: 0, rotation };
      const upperFloors = upperFloorLevels(t).flatMap((l) => l.keys);
      const doc = makeMap([{ ...t, upperFloors }]);
      const boxes = [...buildMapGeometry(doc), ...buildMapDecor(doc)];
      const left = coplanarOverlaps(boxes, { faces: visibleFaces(boxes) });
      expect(left.map((o) => `${boxes[o.a]!.kind} / ${boxes[o.b]!.kind} at ${o.center.map((v) => v.toFixed(2))}`)).toEqual([]);
    }
  });
});
