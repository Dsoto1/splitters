// Flavius Rule's octagon, phase 1 (docs/map-briefs/sandfall_colosseum/OCTAGON_PLAN.md §3.1, §3.5, §3.7): the kit's
// `turned` and `wallRun` parts, plain arch collision, and doors turned off the grid (their blocker, nav opening and
// spawn check are their own slab). Shipped maps don't change: no kit tile uses the new parts yet and no map has a door
// off the grid (checked below).
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CORE_TILES,
  TILE_DIMENSIONS,
  TileCatalog,
  boxCorners,
  buildMapDecor,
  buildMapGeometry,
  faceSlot,
  initPhysics,
  loadMap,
  oboxAabb,
  offGrid,
  orientedAabb,
  resolveKitTile,
  segmentHitsAabb,
  turnBoxes,
  wallRunBoxes,
  doorway,
  DOOR,
  type KitPart,
  type LocalBox,
  type MapDocument,
  type MapEntity,
  type TileSpec,
  type WallRunPart,
  type WorldBox,
} from '../src/index.ts';
import { WALL_THICKNESS } from '../src/map/edgeShapes.ts';
import { Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const QUARTER = Math.PI / 2;
const EIGHTH = Math.PI / 4;

/** A kit tile of one cell with these parts. */
const spec = (id: string, solids: KitPart[]): TileSpec => ({ id, displayName: id, category: 'Special', cells: [[0, 0, 0]], floors: [0], ports: [], solids });
const partBoxes = (...parts: KitPart[]): readonly LocalBox[] => resolveKitTile(spec('test.parts', parts)).solids ?? [];

/** A box's corners, rounded and sorted, so two boxes (or sets of boxes) built different ways compare as shapes. */
const corners = (b: Pick<WorldBox, 'min' | 'max' | 'yaw' | 'pitch' | 'roll'>): string =>
  boxCorners(b)
    .map((p) => p.map((v) => (Math.round(v * 1e3) / 1e3 + 0).toFixed(3)).join(','))
    .sort()
    .join(' ');
const shapes = (boxes: readonly Pick<WorldBox, 'min' | 'max' | 'yaw' | 'pitch' | 'roll'>[]): string[] => boxes.map(corners).sort();
const asWorld = (b: LocalBox): WorldBox => ({ min: [...b.min], max: [...b.max], kind: 'solid', sourceId: 'x', ...(b.yaw ? { yaw: b.yaw } : {}), ...(b.pitch ? { pitch: b.pitch } : {}), ...(b.roll ? { roll: b.roll } : {}) });

describe('the kit part `turned`', () => {
  const flight: KitPart = { flight: { axis: 'x', dir: 1, from: -2, across: [-1, 1], steps: 8 } };

  it('at 0° builds its parts as they are', () => {
    expect(partBoxes({ turned: { turns: 0, parts: [flight] } })).toEqual(partBoxes(flight));
    expect(partBoxes({ turned: { yaw: 0, pivot: [3, 2], parts: [flight] } })).toEqual(partBoxes(flight));
  });

  it('at 90° is exactly the same flight built the other way round (plain boxes, no yaw)', () => {
    // A quarter turn takes +x to -z (a tile's R, a box's yaw): the flight climbing east from x = -2 climbs south from z = 2.
    const turned = partBoxes({ turned: { turns: 1, parts: [flight] } });
    const plain = partBoxes({ flight: { axis: 'z', dir: -1, from: 2, across: [-1, 1], steps: 8 } });
    expect(turned).toEqual(plain);
    expect(partBoxes({ turned: { yaw: QUARTER, parts: [flight] } })).toEqual(plain);
    // About another pivot: the same, moved.
    const about = partBoxes({ turned: { turns: 1, pivot: [1, 1], parts: [flight] } });
    expect(about).toEqual(plain.map((b) => ({ ...b, min: [b.min[0], b.min[1], b.min[2] + 2], max: [b.max[0], b.max[1], b.max[2] + 2] })));
    // Two quarter turns and four: half way round, and back where it began.
    expect(partBoxes({ turned: { turns: 4, parts: [flight] } })).toEqual(partBoxes(flight));
    expect(shapes(partBoxes({ turned: { turns: 2, parts: [flight] } }).map(asWorld))).toEqual(shapes(partBoxes({ flight: { axis: 'x', dir: -1, from: 2, across: [-1, 1], steps: 8 } }).map(asWorld)));
  });

  it('at 45° turns each box about the pivot and adds the yaw, keeping its size', () => {
    const plain = partBoxes(flight);
    const turned = partBoxes({ turned: { turns: 0.5, pivot: [0, 0], parts: [flight] } });
    expect(turned).toHaveLength(plain.length);
    const c = Math.cos(EIGHTH);
    turned.forEach((b, i) => {
      const p = plain[i]!;
      expect(b.yaw).toBeCloseTo(EIGHTH, 12);
      for (const k of [0, 1, 2]) expect(b.max[k]! - b.min[k]!).toBeCloseTo(p.max[k]! - p.min[k]!, 9);
      const [px, pz] = [(p.min[0] + p.max[0]) / 2, (p.min[2] + p.max[2]) / 2];
      expect((b.min[0] + b.max[0]) / 2).toBeCloseTo(px * c + pz * c, 9);
      expect((b.min[2] + b.max[2]) / 2).toBeCloseTo(-px * c + pz * c, 9);
      // The corners are the plain box's corners turned about the pivot.
      const want = boxCorners(asWorld(p)).map(([x, y, z]) => [x * c + z * c, y, -x * c + z * c] as [number, number, number]);
      expect(corners(asWorld(b))).toBe(want.map((q) => q.map((v) => (Math.round(v * 1e3) / 1e3 + 0).toFixed(3)).join(',')).sort().join(' '));
    });
    // `yaw` in radians and `turns` in quarter turns are the same turn.
    expect(partBoxes({ turned: { yaw: EIGHTH, parts: [flight] } })).toEqual(turned);
  });

  it('adds to boxes already turned or tilted, nests, and keeps trim as trim', () => {
    const [b] = partBoxes({ turned: { turns: 0.5, parts: [{ box: [-1, 0, -1, 1, 1, 1], yaw: 0.1, pitch: 0.2, kind: 'trim' }] } });
    expect(b).toMatchObject({ yaw: 0.1 + EIGHTH, pitch: 0.2, kind: 'trim' });
    const nested = partBoxes({ turned: { turns: 0.5, parts: [{ turned: { turns: 0.5, parts: [flight] } }] } });
    expect(nested).toEqual(partBoxes({ turned: { turns: 1, parts: [flight] } }));
    // The group's kind goes on what it builds, but its trim stays trim.
    const kinds = partBoxes({ turned: { turns: 0.5, parts: [flight, { box: [0, 0, 0, 1, 1, 1], kind: 'trim' }] }, kind: 'wall' }).map((x) => x.kind);
    expect(kinds.slice(0, 8).every((k) => k === 'wall')).toBe(true);
    expect(kinds[8]).toBe('trim');
    // turnBoxes on its own, a whole turn: nothing changes.
    expect(turnBoxes(partBoxes(flight), 2 * Math.PI)).toEqual(partBoxes(flight));
  });

  it('a tile with a 45° flight collides and draws in every rotation (the tile turn adds to it)', () => {
    const def = resolveKitTile(spec('test.turned_flight', [{ turned: { turns: 0.5, parts: [flight] } }, { turned: { turns: 0.5, parts: [{ box: [-2, 2, -1.1, 2, 2.1, -1], kind: 'trim' }] } }]));
    const catalog = new TileCatalog([...CORE_TILES, def]);
    for (const rotation of [0, 1, 2, 3] as const) {
      const map = makeMap([{ id: 'a', tile: def.id, x: 0, y: 0, z: 0, rotation }]);
      const steps = buildMapGeometry(map, catalog).filter((b) => b.sourceId === 'a' && b.kind === 'solid');
      expect(steps).toHaveLength(8);
      for (const s of steps) expect(s.yaw).toBeCloseTo(EIGHTH + rotation * QUARTER, 9);
      const trim = buildMapDecor(map, catalog).filter((b) => b.sourceId === 'a' && b.kind === 'trim' && b.yaw);
      expect(trim).toHaveLength(1);
    }
  });
});

describe('the kit part `wallRun`', () => {
  /** A one-cell room with one side's edge style chosen, and the boxes built on that side (collision and trim). */
  const side = (style: WallRunPart['style'], s: 'N' | 'E' | 'S' | 'W') => {
    const map = makeMap([{ id: 'r', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0, edges: { [`0,0,0:${s}`]: style } }]);
    const onSide = (b: WorldBox) => {
      const { min, max } = b;
      const band = 1.2;
      if (s === 'S') return max[2] <= -4 + band && min[2] >= -4 - band;
      if (s === 'N') return min[2] >= 4 - band && max[2] <= 4 + band;
      if (s === 'E') return min[0] >= 4 - band && max[0] <= 4 + band;
      return max[0] <= -4 + band && min[0] >= -4 - band;
    };
    return {
      walls: buildMapGeometry(map).filter((b) => b.sourceId === 'r' && b.kind === 'wall' && onSide(b)),
      trim: buildMapDecor(map).filter((b) => b.sourceId === 'r' && b.kind === 'trim' && onSide(b)),
    };
  };
  const run = (w: WallRunPart) => {
    const boxes = wallRunBoxes(w);
    return { walls: boxes.filter((b) => b.kind !== 'trim').map(asWorld), trim: boxes.filter((b) => b.kind === 'trim').map(asWorld), all: boxes };
  };
  // Each side of the cell as a segment: the line is the wall's outer face, the cell on its left (S, E) or right (N, W).
  const SIDES: [s: 'N' | 'E' | 'S' | 'W', from: [number, number], to: [number, number], side: 'left' | 'right'][] = [
    ['S', [-4, -4], [4, -4], 'left'],
    ['E', [4, -4], [4, 4], 'left'],
    ['N', [-4, 4], [4, 4], 'right'],
    ['W', [-4, -4], [-4, 4], 'right'],
  ];

  it.each(['wall', 'arch_round', 'arch_grand', 'window'] as const)('along a cell side (0° and 90°) builds exactly what the side does: %s', (style) => {
    for (const [s, from, to, which] of SIDES) {
      const want = side(style, s);
      const got = run({ from, to, style, side: which });
      expect(want.walls.length, `${style} ${s}`).toBeGreaterThan(0);
      expect(shapes(got.walls), `${style} ${s} walls`).toEqual(shapes(want.walls));
      // The side's trim, on its inner face and (nothing beyond) its outer one; the room's cornice and base on the
      // other sides end in the corners, so only the pieces along this side compare.
      const along = (b: WorldBox) => (s === 'N' || s === 'S' ? b.max[2] - b.min[2] < 1.2 : b.max[0] - b.min[0] < 1.2);
      const wantTrim = want.trim.filter((b) => along(b) || b.pitch || b.roll);
      expect(shapes(got.trim), `${style} ${s} trim`).toEqual(shapes(wantTrim));
    }
  });

  it('at 45° turns every piece onto the segment (a 45° Grand arch)', () => {
    const L = 8 * Math.SQRT2;
    const { walls, all } = run({ from: [-4, -4], to: [4, 4], style: 'arch_grand' });
    // From (-4, -4) to (4, 4) is 45° the other way from a quarter turn: yaw -45°.
    for (const b of all) expect(b.yaw).toBeCloseTo(-EIGHTH, 9);
    // The same pieces as a straight run as long, turned about its start.
    const straight = run({ from: [-4, -4], to: [-4 + L, -4], style: 'arch_grand' });
    expect(walls).toHaveLength(straight.walls.length);
    expect(shapes(walls)).toEqual(shapes(turnBoxes(wallRunBoxes({ from: [-4, -4], to: [-4 + L, -4], style: 'arch_grand' }).filter((b) => b.kind !== 'trim'), -EIGHTH, -4, -4).map(asWorld)));
    // The piers stand on the line: each pier's outer face is the segment (its centre half the thickness off it, inward).
    const piers = walls.filter((b) => b.min[1] === 0);
    expect(piers).toHaveLength(2);
    for (const p of piers) {
      const cx = (p.min[0] + p.max[0]) / 2;
      const cz = (p.min[2] + p.max[2]) / 2;
      // Distance from the line x = z, on its left (the side towards -x +z).
      expect((cz - cx) / Math.SQRT2).toBeCloseTo(0.4, 9);
    }
    // Bays: two arches along the same segment, each half as long.
    const two = run({ from: [-4, -4], to: [4, 4], style: 'arch_grand', bays: 2 });
    expect(two.walls.filter((b) => b.min[1] === 0)).toHaveLength(4);
    // centre: the wall straddles the line.
    const mid = run({ from: [-4, -4], to: [4, 4], style: 'wall', side: 'centre' }).walls[0]!;
    expect(((mid.min[2] + mid.max[2]) / 2 - (mid.min[0] + mid.max[0]) / 2) / Math.SQRT2).toBeCloseTo(0, 9);
  });

  it('plain: an arch collides as its piers and one lintel over the crown; the steps are drawn in the walls paint', () => {
    for (const [style, crown, top, steps] of [
      ['arch_round', 3, 4, 17],
      ['arch_grand', 6.8, 8, 17],
    ] as const) {
      const full = run({ from: [-4, 0], to: [4, 0], style });
      const plain = run({ from: [-4, 0], to: [4, 0], style, plain: true });
      expect(full.walls).toHaveLength(2 + steps);
      expect(plain.walls).toHaveLength(3);
      const lintel = plain.walls.find((b) => b.min[1] > 0)!;
      const piers = plain.walls.filter((b) => b.min[1] === 0);
      expect(piers.map((b) => [b.min[0], b.max[0]])).toEqual(full.walls.filter((b) => b.min[1] === 0).map((b) => [b.min[0], b.max[0]]));
      expect(lintel.min[1]).toBeCloseTo(crown, 9);
      expect(lintel.max[1]).toBe(top);
      expect(lintel.min[0]).toBe(piers[0]!.max[0]);
      expect(lintel.max[0]).toBe(piers[1]!.min[0]);
      // The steps over the curve are still there to see: trim painted like the walls (faceSlot), never collision.
      const drawn = plain.all.filter((b) => b.paint === 'walls');
      expect(drawn).toHaveLength(steps);
      expect(drawn.every((b) => b.kind === 'trim')).toBe(true);
      expect(faceSlot({ kind: 'trim', paint: 'walls' }, [1, 0, 0])).toBe('walls');
      // The trim (voussoirs, soffit, impost blocks) is the full arch's.
      expect(plain.trim.length - steps).toBe(full.trim.length);
    }
    // A style with at most one piece over its opening has nothing to make plain.
    expect(wallRunBoxes({ from: [-4, 0], to: [4, 0], style: 'window', plain: true })).toEqual(wallRunBoxes({ from: [-4, 0], to: [4, 0], style: 'window' }));
    expect(wallRunBoxes({ from: [-4, 0], to: [4, 0], style: 'wall', plain: true })).toEqual(wallRunBoxes({ from: [-4, 0], to: [4, 0], style: 'wall' }));
  });

  it('in a tile, the plain steps reach the renderer with the walls paint and stay out of collision', () => {
    const def = resolveKitTile(spec('test.wall_run', [{ wallRun: { from: [-4, -4], to: [4, 4], style: 'arch_round', plain: true } }]));
    const catalog = new TileCatalog([...CORE_TILES, def]);
    const map = makeMap([{ id: 'a', tile: def.id, x: 0, y: 0, z: 0, rotation: 1 }]);
    const solid = buildMapGeometry(map, catalog).filter((b) => b.sourceId === 'a' && b.kind === 'wall' && b.yaw);
    expect(solid).toHaveLength(3);
    const painted = buildMapDecor(map, catalog).filter((b) => b.sourceId === 'a' && b.paint === 'walls');
    expect(painted).toHaveLength(17);
    for (const b of painted) expect(b.yaw).toBeCloseTo(-EIGHTH + QUARTER, 9);
  });

  it('the edge pieces module keeps the kit wall thickness', () => {
    expect(WALL_THICKNESS).toBe(TILE_DIMENSIONS.wallThickness);
  });
});

describe('doors turned off the grid', () => {
  // An open room 16 m square with a locked door standing in its middle, turned 45°, and a button that opens it.
  const C = { x: 4, z: 4 };
  const door = (yaw: number): MapEntity => ({ id: 'door_1', kind: 'door', position: [C.x, 0, C.z], yaw, startOpen: false, locked: false, auto: false });
  const scene = (yaw: number) => {
    const map: MapDocument = makeMap([{ id: 'hall', tile: 'core.room_large', x: 0, y: 0, z: 0, rotation: 0 }], [[-2, 0, -2]]);
    map.entities.push(door(yaw), { id: 'button_1', kind: 'button', position: [0, 0, 8], yaw: 0, label: 'Open', once: false, cooldownSeconds: 0.5, startEnabled: true });
    map.logic.rules.push({ id: 'rule_1', name: '', enabled: true, once: false, if: [], when: { event: 'button_pressed', target: 'button_1' }, do: [{ type: 'door_open', target: 'door_1', value: 0, text: '', state: '' }] });
    const loaded = loadMap(map);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
    return new Match(loaded.map, undefined, 1);
  };

  it('a 45° door blocks bots with its own slab, not the 2.4 m square round it', () => {
    const match = scene(EIGHTH);
    const [b] = match.scenario.blockers(null);
    expect(b!.obox).toMatchObject({ yaw: EIGHTH, half: { x: DOOR.width / 2, z: DOOR.thickness } });
    // Its bounds are the square (as before), but the tests use the slab.
    expect(b!.max.x - b!.min.x).toBeCloseTo(2 * (1.5 + 0.2) * Math.SQRT1_2, 9);
    const at = (dx: number, dz: number) => ({ x: C.x + dx, y: 1, z: C.z + dz });
    // Straight through the door: blocked.
    expect(segmentHitsAabb(at(-1, -1), at(1, 1), b!)).toBe(true);
    // Across the square's corner, 1.5 m clear of the slab: open (the bounds alone would block it).
    expect(segmentHitsAabb(at(0.6, 1.6), at(1.6, 0.6), b!)).toBe(false);
    expect(segmentHitsAabb(at(0.6, 1.6), at(1.6, 0.6), { min: b!.min, max: b!.max })).toBe(true);
    // Along the slab's face, 0.3 m off it: open; with 0.15 m of padding still open, with 0.2 m it touches.
    const off = 0.3 / Math.SQRT2 + (0.2 / Math.SQRT2);
    expect(segmentHitsAabb(at(-1 + off, 1 + off), at(1 + off, -1 + off), b!)).toBe(false);
    // The button's door is the same box (BotBrain matches them by their bounds).
    expect(match.scenario.doorButtons(null)[0]!.door).toEqual(b);
    expect(match.scenario.openings()[0]).toEqual(b);
  });

  it('a 45° door keeps spawns out of its own slab only', () => {
    const match = scene(EIGHTH);
    const r = 0.4;
    expect(match.scenario.inShutDoor({ x: C.x, y: 0, z: C.z }, r)).toBe(true);
    // In the square's corner, 1.4 m from the slab: free (before: "in the door").
    expect(match.scenario.inShutDoor({ x: C.x + 1, y: 0, z: C.z + 1 }, r)).toBe(false);
    // Beside the slab's face: just clear, and just touching.
    const n = { x: Math.SQRT1_2, z: Math.SQRT1_2 };
    expect(match.scenario.inShutDoor({ x: C.x + n.x * (0.2 + r + 0.02), y: 0, z: C.z + n.z * (0.2 + r + 0.02) }, r)).toBe(false);
    expect(match.scenario.inShutDoor({ x: C.x + n.x * (0.2 + r - 0.02), y: 0, z: C.z + n.z * (0.2 + r - 0.02) }, r)).toBe(true);
    // Above the door: free.
    expect(match.scenario.inShutDoor({ x: C.x, y: 3.5, z: C.z }, r)).toBe(false);
  });

  /** The points NavWorld.markOpenings samples for a match's openings. */
  const samples = (match: Match): { x: number; z: number }[] => {
    const query = (match.nav as unknown as { query: { findNearestPoly: (p: { x: number; y: number; z: number }, o: unknown) => unknown } }).query;
    const real = query.findNearestPoly.bind(query);
    const seen: { x: number; z: number }[] = [];
    query.findNearestPoly = (p, o) => {
      seen.push({ x: p.x, z: p.z });
      return real(p, o);
    };
    try {
      match.nav.markOpenings(match.scenario.openings());
    } finally {
      query.findNearestPoly = real;
    }
    return seen;
  };

  it("a 45° door's nav opening is its own slab", () => {
    const match = scene(EIGHTH);
    const pts = samples(match);
    // 13 along the 3 m door, 2 across its 0.4 m slab (every 0.25 m): not 10 × 10 over the square round it.
    expect(pts).toHaveLength(13 * 2);
    for (const p of pts) {
      const dx = p.x - C.x;
      const dz = p.z - C.z;
      const c = Math.cos(EIGHTH);
      const s = Math.sin(EIGHTH);
      expect(Math.abs(dx * c - dz * s)).toBeLessThanOrEqual(1.5 + 1e-9);
      expect(Math.abs(dx * s + dz * c)).toBeLessThanOrEqual(0.2 + 1e-9);
    }
  });

  it('a door on the grid is exactly as before: its bounds, no turned box, the same samples', () => {
    for (const yaw of [0, QUARTER, Math.PI, -QUARTER, 3 * QUARTER]) {
      const match = scene(yaw);
      const [b] = match.scenario.blockers(null);
      const way = doorway(door(yaw) as Extract<MapEntity, { kind: 'door' }>);
      expect(b).toEqual(oboxAabb({ ...way, half: { ...way.half, z: DOOR.thickness } }));
      expect(b!.obox).toBeUndefined();
      // The sampling grid over its bounds, as markOpenings always walked it.
      const grid: { x: number; z: number }[] = [];
      for (let x = b!.min.x; x <= b!.max.x + 1e-6; x += 0.25) for (let z = b!.min.z; z <= b!.max.z + 1e-6; z += 0.25) grid.push({ x, z });
      expect(samples(match)).toEqual(grid);
    }
  });

  // One test per map (one test over every map neared its timeout under load, as terrainFloors did).
  const mapDir = new URL('../../../maps/', import.meta.url);
  const mapFiles = readdirSync(mapDir).filter((x) => x.endsWith('.json')).sort();
  let doors = 0;
  let gates = 0;
  for (const f of mapFiles) {
    it(`${f}: no door is off the grid, so every door blocks, opens and keeps spawns out as before`, () => {
      const loaded = loadMap(readFileSync(new URL(f, mapDir), 'utf8'));
      if (!loaded.ok) return;
      // (The coverage map, a test map, carries an Arena Corner (Gate): its 45° portcullis is off the grid. Flavius Rule
      // (phase 4) hangs its own Gate 1-4 portcullis doors at 45° in its four gate corners, each piece's own left out.)
      const gate = f === 'test_coverage.json' ? ((JSON.parse(readFileSync(new URL(f, mapDir), 'utf8')).setPieces ?? []) as { id: string; piece: string }[]).find((p) => p.piece === 'setpiece.arena_corner_gate') : undefined;
      for (const e of loaded.map.entities) {
        if (e.kind !== 'door') continue;
        if ((gate && e.id === `sp_${gate.id}_5`) || (f === 'sandfall_colosseum.json' && /^Gate [1-4]$/.test(e.name ?? ''))) {
          expect(offGrid(e.yaw)).toBe(true);
          // Its oriented slab, not the 45° square round it, is what blocks and keeps spawns out.
          const way = doorway(e);
          const plane = { ...way, half: { ...way.half, z: DOOR.thickness } };
          expect(orientedAabb(plane).obox).toBeTruthy();
          gates++;
          continue;
        }
        doors++;
        expect(offGrid(e.yaw), `${f} ${e.id} yaw ${e.yaw}`).toBe(false);
        const way = doorway(e);
        const plane = { ...way, half: { ...way.half, z: DOOR.thickness } };
        expect(orientedAabb(plane)).toEqual(oboxAabb(plane));
      }
    });
  }
  it('every shipped map was looked at: more than 20 doors on the grid, the coverage map\'s one 45° portcullis and Flavius Rule\'s four', () => {
    expect(doors).toBeGreaterThan(20);
    expect(gates).toBe(5);
  });
});
