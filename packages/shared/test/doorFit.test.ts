/**
 * Doors that fit themselves (owner, 2026-11-18, "1a"; map format v52): a door placed in a wall, or given another look,
 * cuts the wall's doorway to match it on both faces, whatever the wall is built with, and hangs in the middle of the
 * wall's thickness; removing it leaves the doorway (editor/doorFit.ts, map/blockDoorways.ts).
 */
import { describe, expect, it } from 'vitest';
import {
  ARCHED_DOOR_HEIGHT,
  DOOR,
  EDGE_STYLES,
  MAP_FORMAT_VERSION,
  MIGRATIONS,
  applyCommand,
  blockBoxes,
  boxesRay,
  buildMapDecor,
  buildMapGeometry,
  buildOccupancy,
  doorLeaves,
  doorwayOf,
  fitDoor,
  loadMap,
  newScenarioEntities,
  resolveEdge,
  serializeMap,
  snapDoorToBlockWall,
  type EditCommand,
  type MapDocument,
  type MapEntity,
} from '../src/index.ts';
import { makeMap } from './helpers.ts';

type Door = Extract<MapEntity, { kind: 'door' }>;
type Block = Extract<MapEntity, { kind: 'block' }>;

const door = (position: [number, number, number], yaw: number, style?: Door['style']): Door => ({ id: 'door_1', kind: 'door', position, yaw, ...(style ? { style } : {}), startOpen: false, locked: false, auto: true });
const block = (id: string, position: [number, number, number], size: [number, number, number], extra: Partial<Block> = {}): Block => ({ id, kind: 'block', position, size, yaw: 0, material: null, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120, ...extra });
const room = (id: string, x: number, y: number) => ({ id, tile: 'core.room', x, y, z: 0, rotation: 0 as const });

/** Place `d` as MapMaker's door tool does: the door fitted, and the wall's edits, as one batch. */
function place(doc: MapDocument, d: Door): { doc: MapDocument; door: Door; fit: ReturnType<typeof fitDoor> } {
  const fit = fitDoor(doc, d);
  const add: EditCommand = { kind: 'addEntities', entities: [fit.door] };
  return { doc: applyCommand(doc, { kind: 'batch', commands: [add, ...fit.commands] }), door: fit.door, fit };
}

/** Re-look a placed door as the inspector does. */
function relook(doc: MapDocument, style: Door['style']): MapDocument {
  const d = doc.entities.find((e): e is Door => e.kind === 'door')!;
  const fit = fitDoor(doc, { ...d, style });
  return applyCommand(doc, { kind: 'batch', commands: [{ kind: 'updateEntities', before: [d], after: [fit.door] }, ...fit.commands] });
}

/** Whether a level ray across the wall at height y, u along it, hits stone (the wall runs along x at z = zWall). */
function stoneAt(doc: MapDocument, u: number, y: number, zWall: number, x0 = 0): boolean {
  const boxes = buildMapGeometry(doc);
  return boxesRay(boxes, { x: x0 + u, y, z: zWall - 2 }, { x: 0, y: 0, z: 1 }, 4) !== null;
}

describe('doors that fit themselves: the format', () => {
  it('is v52, with a migration from v51 that changes nothing', () => {
    expect(MAP_FORMAT_VERSION).toBeGreaterThanOrEqual(52);
    const doc = { format: 'tiletrigger.map', formatVersion: 51, anything: { kept: [1] } };
    expect(MIGRATIONS.get(51)!(doc)).toEqual(doc);
  });

  it('has the Arched doorway next to the Doorway, and each look its doorway', () => {
    expect(EDGE_STYLES.indexOf('door_arched')).toBe(EDGE_STYLES.indexOf('door') + 1);
    expect(doorwayOf('arched')).toBe('door_arched');
    for (const s of [undefined, 'sliding', 'blast', 'saloon', 'vault', 'portcullis', 'oak'] as const) expect(doorwayOf(s)).toBe('door');
  });

  it('the Arched door stands as high as its arch\'s crown', () => {
    const [a] = doorLeaves(door([0, 0, 0], 0, 'arched'), 0);
    expect(a.half.y * 2).toBeCloseTo(ARCHED_DOOR_HEIGHT);
    expect(doorLeaves(door([0, 0, 0], 0), 0)[0].half.y * 2).toBeCloseTo(DOOR.height);
  });
});

describe('doors that fit themselves: in a tile\'s side', () => {
  // Two rooms side by side along x: their shared wall is the boundary x = 4 (cells 0 and 1, cell size 8).
  const pair = () => makeMap([room('a', 0, 0), room('b', 1, 0)]);

  it('an arched door cuts an Arched doorway in a wall between two rooms, and hangs on the boundary (the wall\'s middle)', () => {
    const { doc, door: d } = place(pair(), door([4, 0, 0], Math.PI / 2, 'arched'));
    const { cells } = buildOccupancy(doc);
    expect(resolveEdge(cells, 0, 0, 0, 'E')).toBe('door_arched');
    expect(resolveEdge(cells, 1, 0, 0, 'W')).toBe('door_arched');
    expect(d.position).toEqual([4, 0, 0]);
    // The opening is arched: clear in the middle up to the crown, stone at the corner where a square door would be open.
    const ray = (u: number, y: number) => boxesRay(buildMapGeometry(doc), { x: 2, y, z: u }, { x: 1, y: 0, z: 0 }, 4) !== null;
    expect(ray(0, 3.4)).toBe(false);
    expect(ray(1.4, 2.9)).toBe(true);
    expect(ray(0, 3.8)).toBe(true);
    // Voussoirs on both faces: trim on either side of the boundary over the opening.
    const trim = buildMapDecor(doc).filter((b) => b.kind === 'trim' && b.min[1] > 2.5 && Math.abs(b.min[2] + b.max[2]) < 3.2);
    expect(trim.some((b) => b.max[0] <= 3.5)).toBe(true);
    expect(trim.some((b) => b.min[0] >= 4.5)).toBe(true);
  });

  it('in an outside wall the door moves into the middle of the wall\'s thickness, and the frame dresses both faces', () => {
    const { doc, door: d } = place(makeMap([room('a', 0, 0)]), door([4, 0, 0], Math.PI / 2));
    const { cells } = buildOccupancy(doc);
    expect(resolveEdge(cells, 0, 0, 0, 'E')).toBe('door');
    expect(d.position[0]).toBeCloseTo(3.75);
    // The Doorway's frame: on the inner face (x < 3.5) and the outer one (x > 4).
    const posts = buildMapDecor(doc).filter((b) => b.kind === 'trim' && b.max[1] > 2.5 && b.min[1] < 0.1 && Math.abs((b.min[2] + b.max[2]) / 2) > 1.4 && Math.abs((b.min[2] + b.max[2]) / 2) < 1.7);
    expect(posts.some((b) => b.max[0] <= 3.5 + 1e-6)).toBe(true);
    expect(posts.some((b) => b.min[0] >= 4 - 1e-6)).toBe(true);
  });

  it('changing the look re-cuts the doorway; removing the door leaves it', () => {
    let { doc } = place(pair(), door([4, 0, 0], Math.PI / 2, 'oak'));
    expect(resolveEdge(buildOccupancy(doc).cells, 0, 0, 0, 'E')).toBe('door');
    doc = relook(doc, 'arched');
    expect(resolveEdge(buildOccupancy(doc).cells, 0, 0, 0, 'E')).toBe('door_arched');
    doc = relook(doc, 'blast');
    expect(resolveEdge(buildOccupancy(doc).cells, 0, 0, 0, 'E')).toBe('door');
    doc = relook(doc, 'arched');
    const d = doc.entities.find((e) => e.kind === 'door')!;
    doc = applyCommand(doc, { kind: 'removeEntities', entities: [d] });
    expect(resolveEdge(buildOccupancy(doc).cells, 0, 0, 0, 'E')).toBe('door_arched');
  });

  it('a door already fitted needs nothing more, and a door in no wall is left alone', () => {
    const { doc, door: d } = place(pair(), door([4, 0, 0], Math.PI / 2, 'arched'));
    const again = fitDoor(doc, d);
    expect(again.commands).toEqual([]);
    expect(again.door.position).toEqual(d.position);
    const alone = fitDoor(pair(), door([30, 0, 30], 0));
    expect(alone.wall).toBeNull();
    expect(alone.commands).toEqual([]);
  });
});

describe('doors that fit themselves: in a wall of free blocks', () => {
  // A stone wall 10 m long, 4 m high, 0.6 m thick, along x at z = 5.
  const wall = (extra: Partial<Block> = {}) => {
    const doc = makeMap([]);
    return { ...doc, entities: [...doc.entities, block('wall', [0, 0, 5], [10, 4, 0.6], { material: 'core.pbr_castle_stone', ...extra })] };
  };

  it('an arched door cuts an arched doorway through the block, and hangs on its middle plane', () => {
    const { doc, door: d, fit } = place(wall(), door([1, 0, 5.25], 0, 'arched'));
    expect(fit.wall).toBe('blocks');
    expect(d.position).toEqual([1, 0, 5]);
    const b = doc.entities.find((e): e is Block => e.id === 'wall')!;
    expect(b.doorways).toEqual([{ style: 'door_arched', at: 1 }]);
    // Open through the middle to near the crown; stone in the arch's corners, beside the opening and over it.
    expect(stoneAt(doc, 1, 1, 5)).toBe(false);
    expect(stoneAt(doc, 1, 3.4, 5)).toBe(false);
    expect(stoneAt(doc, 1 + 1.4, 2.9, 5)).toBe(true);
    expect(stoneAt(doc, 1, 3.8, 5)).toBe(true);
    expect(stoneAt(doc, -3, 1, 5)).toBe(true);
    // Its pieces keep the block's material.
    const pieces = blockBoxes(doc).filter((x) => x.sourceId === 'wall');
    expect(pieces.length).toBeGreaterThan(3);
    expect(pieces.every((x) => x.surface?.material === 'core.pbr_castle_stone')).toBe(true);
    // Voussoirs on both faces (z < 4.7 and z > 5.3) and a soffit through the thickness.
    const trim = buildMapDecor(doc).filter((x) => x.sourceId === 'wall');
    expect(trim.some((x) => x.max[2] <= 4.7 + 1e-6 && x.min[1] > 2)).toBe(true);
    expect(trim.some((x) => x.min[2] >= 5.3 - 1e-6 && x.min[1] > 2)).toBe(true);
    expect(trim.some((x) => x.min[2] <= 4.71 && x.max[2] >= 5.29)).toBe(true);
  });

  it('a square look cuts a square doorway with a frame both sides; a new look re-cuts it; removing the door leaves it', () => {
    let { doc } = place(wall(), door([0, 0, 5], 0, 'oak'));
    expect(doc.entities.find((e): e is Block => e.id === 'wall')!.doorways).toEqual([{ style: 'door', at: 0 }]);
    expect(stoneAt(doc, 1.4, 2.9, 5)).toBe(false);
    const frames = buildMapDecor(doc).filter((x) => x.sourceId === 'wall' && x.max[1] > 2.9 && x.min[1] < 0.1);
    expect(frames.some((x) => x.max[2] <= 4.7 + 1e-6)).toBe(true);
    expect(frames.some((x) => x.min[2] >= 5.3 - 1e-6)).toBe(true);
    doc = relook(doc, 'arched');
    expect(doc.entities.find((e): e is Block => e.id === 'wall')!.doorways).toEqual([{ style: 'door_arched', at: 0 }]);
    const d = doc.entities.find((e) => e.kind === 'door')!;
    doc = applyCommand(doc, { kind: 'removeEntities', entities: [d] });
    expect(doc.entities.find((e): e is Block => e.id === 'wall')!.doorways).toEqual([{ style: 'door_arched', at: 0 }]);
    expect(stoneAt(doc, 0, 1, 5)).toBe(false);
  });

  it('a door across two blocks cuts both; two doors in one block each get their doorway', () => {
    const doc0 = makeMap([]);
    const two = { ...doc0, entities: [...doc0.entities, block('w1', [-3, 0, 5], [6, 4, 0.5]), block('w2', [3, 0, 5], [6, 4, 0.5])] };
    const { doc } = place(two, door([0, 0, 5], 0));
    expect(doc.entities.find((e): e is Block => e.id === 'w1')!.doorways).toEqual([{ style: 'door', at: 3 }]);
    expect(doc.entities.find((e): e is Block => e.id === 'w2')!.doorways).toEqual([{ style: 'door', at: -3 }]);
    expect(stoneAt(doc, -1, 1, 5)).toBe(false);
    expect(stoneAt(doc, 1, 1, 5)).toBe(false);
    expect(stoneAt(doc, -2, 1, 5)).toBe(true);
    let long = place(wall(), door([-3, 0, 5], 0)).doc;
    long = place(long, { ...door([3, 0, 5], 0, 'arched'), id: 'door_2' }).doc;
    expect(long.entities.find((e): e is Block => e.id === 'wall')!.doorways).toEqual([{ style: 'door', at: -3 }, { style: 'door_arched', at: 3 }]);
    expect(stoneAt(long, -3, 1, 5)).toBe(false);
    expect(stoneAt(long, 3, 1, 5)).toBe(false);
    expect(stoneAt(long, 0, 1, 5)).toBe(true);
  });

  it('a turned wall, a raised floor and the door tool\'s snap', () => {
    const doc0 = makeMap([]);
    const turned = { ...doc0, entities: [...doc0.entities, block('t', [10, 0, 0], [0.6, 4, 10])] };
    const snap = snapDoorToBlockWall(turned, 10.2, 0, 1.2);
    expect(snap).not.toBeNull();
    expect(snap!.position[0]).toBeCloseTo(10);
    expect(snap!.position[2]).toBeCloseTo(1);
    const { doc } = place(turned, { ...door(snap!.position, snap!.yaw) });
    const b = doc.entities.find((e): e is Block => e.id === 't')!;
    expect(b.doorways?.length).toBe(1);
    expect(boxesRay(buildMapGeometry(doc), { x: 8, y: 1, z: 1 }, { x: 1, y: 0, z: 0 }, 4)).toBeNull();
    // A wall standing from below the floor (a plinth 1 m down): the doorway's sill is 1 m up the block.
    const low = { ...doc0, entities: [...doc0.entities, block('low', [0, -1, 5], [10, 5, 0.6])] };
    const cut = place(low, door([0, 0, 5], 0)).doc.entities.find((e): e is Block => e.id === 'low')!;
    expect(cut.doorways).toEqual([{ style: 'door', at: 0, y: 1 }]);
    expect(stoneAt(place(low, door([0, 0, 5], 0)).doc, 0, 1, 5)).toBe(false);
    expect(stoneAt(place(low, door([0, 0, 5], 0)).doc, 0, -0.5, 5)).toBe(true);
  });

  it('breakable, moving and glass blocks are not cut', () => {
    for (const extra of [{ behaviour: 'breakable' as const }, { glass: 'breakable' as const }, { pitch: 0.2 }]) {
      const fit = fitDoor(wall(extra), door([0, 0, 5], 0));
      expect(fit.commands).toEqual([]);
    }
  });

  it('saves and loads with its doorways', () => {
    const { doc } = place(wall(), door([1, 0, 5], 0, 'arched'));
    const back = loadMap(serializeMap(doc));
    expect(back.ok ? [] : back.issues.filter((i) => i.severity === 'error')).toEqual([]);
    if (back.ok) expect(back.map.entities.find((e): e is Block => e.id === 'wall')!.doorways).toEqual([{ style: 'door_arched', at: 1 }]);
  });

  it('the palette\'s Arched Door is an arched door', () => {
    expect(newScenarioEntities('door:arched', [0, 0, 0], 0)[0]).toMatchObject({ kind: 'door', style: 'arched' });
  });
});
