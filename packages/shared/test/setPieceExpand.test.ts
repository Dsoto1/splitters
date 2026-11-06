// Set pieces (format v27, docs/SET_PIECES_PLAN.md): expansion into ordinary parts (map/setPieces.ts). Every shipped
// piece in each turn × mirror × role pack; the transform checked against the unturned piece point by point (what
// collides and what is drawn), with test pieces that turn and mirror everything (multi-cell and tall tiles, edges,
// glass, upper floors, turned and tilted blocks, props, doors, ladders, lights); determinism; roles, overrides, ids.
import { describe, expect, it } from 'vitest';
import {
  SetPieceDefinition,
  StableId,
  boxBounds,
  boxQuat,
  buildMapDecor,
  buildMapGeometry,
  buildOccupancy,
  builtInSetPieces,
  coreCatalog,
  expandSetPieces,
  loadMap,
  mirrorWidth,
  placePoint,
  quatRotate,
  resolveEdge,
  serializeMap,
  setPieceFootprint,
  setPiecePorts,
  tileMirrorAxis,
  validateMap,
  type MapDocument,
  type MapEntity,
  type Rotation,
  type SetPieceDefinitionInput,
  type SetPieceLibrary,
  type SetPiecePlacement,
  type WorldBox,
} from '../src/index.ts';
import { makeMap } from './helpers.ts';

const shipped = builtInSetPieces();
const ROTATIONS: Rotation[] = [0, 1, 2, 3];

/** A map with one set piece placed at (ax, ay, az) and a spawn on a room far from it. */
function withPiece(placement: Omit<SetPiecePlacement, 'id'> & { id?: string }, theme = 'core.prototype'): MapDocument {
  const map = makeMap([{ id: 'home', tile: 'core.room', x: -20, y: -20, z: 0, rotation: 0 }], [[-160, 0, -160]]);
  return { ...map, classicStructure: { ...map.classicStructure, theme }, setPieces: [{ id: 'piece_1', ...placement } as SetPiecePlacement] };
}

/** The test library: the shipped packs and these pieces. */
const library = (defs: SetPieceDefinitionInput[]): SetPieceLibrary => ({ pieces: new Map(defs.map((d) => [d.id, SetPieceDefinition.parse(d)])), packs: shipped.packs });

/**
 * A piece that turns and mirrors everything: a vaulted room with an arch, a door and windows with glass; a long room
 * turned a quarter (2 × 1); a tall room with a floor added upstairs; turned and tilted blocks in roles; a prop, a door,
 * a ladder and lights. Every tile in it is its own mirror image.
 */
const EVERYTHING: SetPieceDefinitionInput = {
  id: 'setpiece.test_everything',
  displayName: 'Everything',
  family: 'test',
  category: 'Test',
  packs: ['collegiate', 'military'],
  footprint: { cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], levels: [0, 1] },
  mirror: 'free',
  ports: [{ side: 'W', cell: [0, 0], level: 0, kind: 'door' }, { side: 'N', cell: [2, 1], level: 0, kind: 'opening' }],
  parts: [
    { kind: 'tile', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0, edges: { '0,0,0:N': 'arch_segmental', '0,0,0:W': 'door', '0,0,0:S': 'windows', '0,0,0:E': 'open' }, glass: { '0,0,0:S': { role: 'glass' } }, options: { ceiling: 'vault' }, surfaces: { walls: { role: 'stone' }, trim: { role: 'trim' } } },
    { kind: 'tile', tile: 'core.room_long', x: 1, y: 1, z: 0, rotation: 1, edges: { '0,0,0:W': 'window', '0,1,0:N': 'wide' } },
    { kind: 'tile', tile: 'core.room_tall', x: 2, y: 0, z: 0, rotation: 2, upperFloors: ['0,0,1'], edges: { '0,0,1:E': 'windows', '0,0,0:N': 'door' }, glass: { '0,0,1:E': 'reinforced' } },
    { kind: 'tile', tile: 'core.room', x: 0, y: 1, z: 0, rotation: 3, edges: { '0,0,0:S': 'half' } },
    { kind: 'block', position: [3.1, 0, 2.2], size: [2, 1.2, 0.6], yaw: 0.3, material: { role: 'stone' } },
    { kind: 'block', position: [8.4, 1, 1.5], size: [1.5, 0.4, 2.5], yaw: 0.2, pitch: 0.25, roll: -0.15, material: 'core.pbr_planks' },
    { kind: 'block', position: [5, 0, 9], size: [3, 2, 1], yaw: Math.PI / 2, material: { role: 'trim' } },
    { kind: 'prop', model: 'prop.crate_large', position: [-1.5, 0, 9.5], yaw: 0.5, scale: 1 },
    { kind: 'door', position: [-4, 0, 0], yaw: Math.PI / 2, style: { role: 'door' } },
    { kind: 'ladder', position: [19.6, 0, 9], yaw: -Math.PI / 2, height: 4 },
    { kind: 'light', position: [0, 3.3, 0], fixture: 'ceiling' },
    { kind: 'light', position: [-3.47, 2.2, -2], yaw: Math.PI / 2, fixture: 'wall' },
  ],
};
/** A piece with stairs, which climb one way: it can't be mirrored. */
const STAIRS: SetPieceDefinitionInput = {
  id: 'setpiece.test_stairs',
  displayName: 'Stairs',
  family: 'test',
  category: 'Test',
  footprint: { cells: [[0, 0], [1, 0]], levels: [0, 1] },
  mirror: 'none',
  parts: [
    { kind: 'tile', tile: 'core.stairs', x: 0, y: 0, z: 0, rotation: 1 },
    { kind: 'tile', tile: 'core.room', x: 1, y: 0, z: 0, rotation: 0 },
  ],
};
const TEST = library([EVERYTHING, STAIRS, ...[...shipped.pieces.values()]]);

const piece = (id: string) => TEST.pieces.get(id)!;

/** Signed distance from p to a box (negative inside), in the box's own frame. */
function distance(b: WorldBox, p: readonly number[]): number {
  const c = [0, 1, 2].map((k) => (b.min[k]! + b.max[k]!) / 2);
  const q = boxQuat(b.yaw, b.pitch, b.roll);
  const d = quatRotate({ x: -q.x, y: -q.y, z: -q.z, w: q.w }, p[0]! - c[0]!, p[1]! - c[1]!, p[2]! - c[2]!);
  return Math.max(...[0, 1, 2].map((k) => Math.abs(d[k]!) - (b.max[k]! - b.min[k]!) / 2));
}
const bounds = new WeakMap<WorldBox, { min: number[]; max: number[] }>();
/** What is at p: the kinds of the boxes it is inside; null when it is within a millimetre of a face (too close to call). */
function at(boxes: readonly WorldBox[], p: readonly number[]): string | null {
  const kinds = new Set<string>();
  for (const b of boxes) {
    let bb = bounds.get(b);
    if (!bb) bounds.set(b, (bb = boxBounds(b)));
    if (p[0]! < bb.min[0]! - 0.01 || p[0]! > bb.max[0]! + 0.01 || p[1]! < bb.min[1]! - 0.01 || p[1]! > bb.max[1]! + 0.01 || p[2]! < bb.min[2]! - 0.01 || p[2]! > bb.max[2]! + 0.01) continue;
    const d = distance(b, p);
    if (Math.abs(d) < 1e-3) return null;
    if (d < 0) kinds.add(b.kind);
  }
  return [...kinds].sort().join(',');
}

/** The world point of the unturned, unmirrored piece that a point of the placed one comes from. */
function source(p: SetPiecePlacement, def: SetPieceDefinition, q: readonly number[]): [number, number, number] {
  const [cx, cz] = [p.x * 8, p.y * 8];
  let [x, z] = [q[0]! - cx, q[2]! - cz];
  for (let i = 0; i < p.rotation; i++) [x, z] = [-z, x];
  if (p.mirror) x = mirrorWidth(def) * 8 - x;
  return [cx + x, q[1]!, cz + z];
}

/** Sample points over a placement's footprint, a little past it. */
function samples(p: SetPiecePlacement, def: SetPieceDefinition, n: number): [number, number, number][] {
  const cells = setPieceFootprint(p, def);
  const xs = cells.map((c) => c[0]);
  const ys = cells.map((c) => c[1]);
  const zs = cells.map((c) => c[2]);
  const [x0, x1, y0, y1, z0, z1] = [Math.min(...xs) * 8 - 4.5, Math.max(...xs) * 8 + 4.5, Math.min(...ys) * 8 - 4.5, Math.max(...ys) * 8 + 4.5, Math.min(...zs) * 4 - 0.6, (Math.max(...zs) + 1) * 4 + 1];
  let seed = 12345;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
  return Array.from({ length: n }, () => [x0 + (x1 - x0) * rnd(), z0 + (z1 - z0) * rnd(), y0 + (y1 - y0) * rnd()] as [number, number, number]);
}

const levelBoxes = (map: MapDocument) => buildMapGeometry(map).filter((b) => b.kind !== 'barrier');

describe('set pieces: the turn and the mirror move every part as one', () => {
  for (const id of ['setpiece.test_everything', 'setpiece.carriageway_2', 'setpiece.skybridge_3']) {
    it(`${id}: what collides, and what is drawn, in each turn and mirrored, is the unturned piece moved`, { timeout: 120_000 }, () => {
      const def = piece(id);
      // No facade (its battlements and buttresses are drawn bay by bay along each wall, as for any room).
      const reference = withPiece({ piece: id, x: 3, y: -2, z: 1, rotation: 0, mirror: false, overrides: { roles: { facade: 'none' } } });
      const refBoxes = levelBoxes(expandSetPieces(reference, TEST).map);
      const refDecor = buildMapDecor(expandSetPieces(reference, TEST).map);
      for (const rotation of ROTATIONS) {
        for (const mirror of [false, true]) {
          if (!rotation && !mirror) continue;
          const doc = withPiece({ piece: id, x: 3, y: -2, z: 1, rotation, mirror, overrides: { roles: { facade: 'none' } } });
          const ex = expandSetPieces(doc, TEST);
          expect(ex.issues, `${rotation} ${mirror}`).toEqual([]);
          const p = doc.setPieces![0]!;
          const boxes = levelBoxes(ex.map);
          const decor = buildMapDecor(ex.map);
          let compared = 0;
          for (const q of samples(p, def, 2500)) {
            const was = at(refBoxes, source(p, def, q));
            const now = at(boxes, q);
            if (was === null || now === null) continue;
            compared++;
            expect(now, `${id} turned ${rotation}${mirror ? ' mirrored' : ''}: collision at ${q.map((v) => v.toFixed(2))}`).toBe(was);
            const dWas = at(refDecor, source(p, def, q));
            const dNow = at(decor, q);
            if (dWas !== null && dNow !== null) expect(dNow, `${id} turned ${rotation}${mirror ? ' mirrored' : ''}: trim at ${q.map((v) => v.toFixed(2))}`).toBe(dWas);
          }
          expect(compared).toBeGreaterThan(2000);
        }
      }
    });
  }

  it('entities land where the turn and the mirror take them, facing the right way', () => {
    const def = piece('setpiece.test_everything');
    for (const rotation of ROTATIONS) {
      for (const mirror of [false, true]) {
        const doc = withPiece({ piece: def.id, x: -5, y: 7, z: 2, rotation, mirror });
        const p = doc.setPieces![0]!;
        const parts = expandSetPieces(doc, TEST).map.entities.filter((e) => e.id.startsWith('sp_'));
        def.parts.forEach((part, i) => {
          if (part.kind === 'tile') return;
          const e = parts.find((x) => x.id === `sp_piece_1_${i}`)!;
          expect(e.position).toEqual(placePoint(p, def, part.position));
          // Facing: the part's forward (sin yaw, cos yaw) carried through the mirror and the turn.
          if (part.kind === 'block' && !part.pitch && !part.roll) return;
          const yaw = (e as { yaw: number }).yaw;
          let [fx, fz] = [Math.sin(part.yaw), Math.cos(part.yaw)];
          if (mirror) fx = -fx;
          for (let k = 0; k < rotation; k++) [fx, fz] = [fz, -fx];
          expect(Math.sin(yaw)).toBeCloseTo(fx, 6);
          expect(Math.cos(yaw)).toBeCloseTo(fz, 6);
        });
      }
    }
  });

  it('an untilted block turned a quarter keeps its yaw with width and depth swapped; a tilted one turns; mirroring negates roll', () => {
    const doc = withPiece({ piece: 'setpiece.test_everything', x: 0, y: 0, z: 0, rotation: 1, mirror: true });
    const blocks = expandSetPieces(doc, TEST).map.entities.filter((e): e is Extract<MapEntity, { kind: 'block' }> => e.kind === 'block');
    const flat = blocks.find((b) => b.id === 'sp_piece_1_4')!;
    expect(flat.size).toEqual([0.6, 1.2, 2]);
    expect(flat.yaw).toBeCloseTo(-0.3, 9);
    const tilted = blocks.find((b) => b.id === 'sp_piece_1_5')!;
    expect(tilted.size).toEqual([1.5, 0.4, 2.5]);
    expect(tilted.yaw).toBeCloseTo(-0.2 + Math.PI / 2, 6);
    expect(tilted.pitch).toBe(0.25);
    expect(tilted.roll).toBe(0.15);
  });

  it('tiles mirror onto themselves (rooms, long and tall rooms); stairs do not, so their piece says mirror "none"', () => {
    for (const id of ['core.room', 'core.room_long', 'core.room_tall', 'core.room_large', 'core.hall', 'core.corridor_windows']) expect(tileMirrorAxis(coreCatalog.get(id)!), id).not.toBeNull();
    // The long corridor's cover block stands off to one side: no mirror image of itself.
    expect(tileMirrorAxis(coreCatalog.get('core.corridor_long')!)).toBeNull();
    expect(tileMirrorAxis(coreCatalog.get('core.room_long')!)).toBe(0);
    expect(tileMirrorAxis(coreCatalog.get('core.room_large')!)).toBe(1);
    expect(tileMirrorAxis(coreCatalog.get('core.stairs')!)).toBeNull();
    const doc = withPiece({ piece: 'setpiece.test_stairs', x: 0, y: 0, z: 0, rotation: 0, mirror: true });
    expect(expandSetPieces(doc, TEST).issues.map((i) => i.code)).toEqual(['setpiece.mirror']);
    expect(validateMap(doc, coreCatalog, TEST).some((i) => i.code === 'setpiece.mirror' && i.severity === 'error')).toBe(true);
  });

  it('ports turn and mirror with the piece: the carriageway arches face its openings, its doors its door ports', () => {
    const def = piece('setpiece.carriageway_2');
    for (const rotation of ROTATIONS) {
      for (const mirror of [false, true]) {
        const doc = withPiece({ piece: def.id, x: 2, y: 3, z: 0, rotation, mirror });
        const p = doc.setPieces![0]!;
        const { cells } = buildOccupancy(expandSetPieces(doc, TEST).map);
        for (const port of setPiecePorts(p, def)) {
          if (port.z !== 0) continue;
          expect(resolveEdge(cells, port.x, port.y, port.z, port.side), `${rotation} ${mirror} ${JSON.stringify(port)}`).toBe(port.kind === 'opening' ? 'arch_segmental' : 'door');
        }
      }
    }
  });
});

describe('set pieces: every shipped piece in each turn, mirror and role pack', () => {
  it('expands into its parts with no errors, inside its footprint, with ids sp_<placement>_<part>', () => {
    expect(shipped.pieces.size).toBeGreaterThanOrEqual(5);
    for (const def of shipped.pieces.values()) {
      for (const rotation of ROTATIONS) {
        for (const mirror of def.mirror === 'free' ? [false, true] : [false]) {
          for (const pack of [undefined, ...def.packs]) {
            const doc = withPiece({ piece: def.id, x: 6, y: -4, z: 1, rotation, mirror, ...(pack ? { pack } : {}) });
            const errors = validateMap(doc).filter((i) => i.severity === 'error');
            expect(errors, `${def.id} ${rotation} ${mirror} ${pack}`).toEqual([]);
            const ex = expandSetPieces(doc, shipped);
            const parts = [...ex.map.classicStructure.tiles, ...ex.map.entities].filter((x) => x.id.startsWith('sp_'));
            expect(parts.length).toBe(def.parts.length);
            for (const x of parts) {
              expect(x.id).toMatch(/^sp_piece_1_\d+$/);
              expect(StableId.safeParse(x.id).success).toBe(true);
            }
            // Every tile cell the parts hold is a footprint cell.
            const fp = new Set(setPieceFootprint(doc.setPieces![0]!, def).map((c) => c.join(',')));
            for (const [key, occ] of buildOccupancy(ex.map).cells) if (occ.placement.id.startsWith('sp_')) expect(fp.has(key), `${def.id}: ${key}`).toBe(true);
          }
        }
      }
    }
  });

  it('the role packs re-theme it: Collegiate Gothic stone, trim, setts, oak doors, battlements, glass; the theme without a pack', () => {
    const doc = withPiece({ piece: 'setpiece.carriageway_1', x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate' });
    const map = expandSetPieces(doc, shipped).map;
    const passage = map.classicStructure.tiles.find((t) => t.id === 'sp_piece_1_0')!;
    expect(passage.surfaces).toEqual({ floor: { material: 'core.road_setts', tint: null }, walls: { material: 'core.pbr_castle_stone', tint: null }, solids: { material: 'core.pbr_castle_stone', tint: null }, trim: { material: 'core.stone_trim', tint: null } });
    expect(passage.options).toEqual({ ceiling: 'vault' });
    const above = map.classicStructure.tiles.find((t) => t.id === 'sp_piece_1_1')!;
    expect(above.options).toEqual({ ceiling: 'roof', facade: 'gothic_stone' });
    expect(above.glass).toEqual({ '0,0,0:N': 'breakable', '0,0,0:S': 'breakable' });
    const doors = map.entities.filter((e) => e.kind === 'door');
    expect(doors.map((d) => d.kind === 'door' && d.style)).toEqual(['oak', 'oak']);
    const guard = map.entities.find((e) => e.id === 'sp_piece_1_6')!;
    expect(guard.kind === 'block' && guard.material).toBe('core.pbr_castle_stone');
    // St. John's theme (Castle Keep) takes Collegiate Gothic without naming it.
    const castle = expandSetPieces(withPiece({ piece: 'setpiece.carriageway_1', x: 0, y: 0, z: 0, rotation: 0, mirror: false }, 'core.castle'), shipped).map;
    expect(castle.classicStructure.tiles.find((t) => t.id === 'sp_piece_1_0')!.surfaces).toEqual(passage.surfaces);
    // A theme no pack has: the theme paints it (no surfaces), sliding doors, no facade; the piece's own glass.
    const plain = expandSetPieces(withPiece({ piece: 'setpiece.carriageway_1', x: 0, y: 0, z: 0, rotation: 0, mirror: false }), shipped).map;
    expect(plain.classicStructure.tiles.find((t) => t.id === 'sp_piece_1_0')!.surfaces).toBeUndefined();
    expect(plain.classicStructure.tiles.find((t) => t.id === 'sp_piece_1_1')!.options).toEqual({ ceiling: 'roof' });
    expect(plain.classicStructure.tiles.find((t) => t.id === 'sp_piece_1_1')!.glass).toEqual({ '0,0,0:N': 'breakable', '0,0,0:S': 'breakable' });
    expect(plain.entities.filter((e) => e.kind === 'door').every((d) => d.kind === 'door' && d.style === undefined)).toBe(true);
    // Medieval: no glass.
    const medieval = expandSetPieces(withPiece({ piece: 'setpiece.carriageway_1', x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'medieval' }), shipped).map;
    expect(medieval.classicStructure.tiles.find((t) => t.id === 'sp_piece_1_1')!.glass).toBeUndefined();
  });

  it('overrides: a role of its own, and parts left out', () => {
    const doc = withPiece({ piece: 'setpiece.carriageway_1', x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate', overrides: { roles: { stone: { material: 'core.pbr_limestone', tint: '#c8c0b0' }, door: 'portcullis' }, hide: [6, 7, 8, 9] } });
    const map = expandSetPieces(doc, shipped).map;
    expect(map.classicStructure.tiles.find((t) => t.id === 'sp_piece_1_0')!.surfaces!.walls).toEqual({ material: 'core.pbr_limestone', tint: '#c8c0b0' });
    expect(map.entities.filter((e) => e.kind === 'door').map((d) => d.kind === 'door' && d.style)).toEqual(['portcullis', 'portcullis']);
    expect(map.entities.filter((e) => e.kind === 'block')).toEqual([]);
    expect(map.entities.some((e) => e.id === 'sp_piece_1_10')).toBe(true);
    // Hiding a part it doesn't have is a warning.
    const bad = validateMap(withPiece({ piece: 'setpiece.carriageway_1', x: 0, y: 0, z: 0, rotation: 0, mirror: false, overrides: { hide: [40] } }));
    expect(bad.some((i) => i.code === 'setpiece.hide' && i.severity === 'warning')).toBe(true);
  });
});

describe('set pieces: determinism and ids', () => {
  it('the same ids and parts every load', () => {
    const doc = withPiece({ piece: 'setpiece.carriageway_2', x: 4, y: 1, z: 0, rotation: 3, mirror: true, pack: 'gothic' });
    const json = serializeMap(doc);
    const a = loadMap(json);
    const b = loadMap(JSON.parse(json));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(serializeMap(a.map)).toBe(serializeMap(b.map));
    expect(a.map.setPieces).toBeUndefined();
    const ids = [...a.map.classicStructure.tiles, ...a.map.entities].map((x) => x.id).filter((x) => x.startsWith('sp_'));
    expect(ids).toEqual(piece('setpiece.carriageway_2').parts.map((_, i) => `sp_piece_1_${i}`).sort((x, y) => (a.map.classicStructure.tiles.some((t) => t.id === x) ? 0 : 1) - (a.map.classicStructure.tiles.some((t) => t.id === y) ? 0 : 1)));
  });

  it("a placement's id is at most 48 characters, so its parts' ids stay StableIds", () => {
    const long = 'p'.repeat(48);
    const doc = withPiece({ id: long, piece: 'setpiece.skybridge_4', x: 0, y: 0, z: 1, rotation: 0, mirror: false });
    const r = loadMap(serializeMap(doc));
    expect(r.ok).toBe(true);
    if (r.ok) for (const x of [...r.map.classicStructure.tiles, ...r.map.entities]) expect(StableId.safeParse(x.id).success, x.id).toBe(true);
    expect(loadMap(serializeMap(withPiece({ id: 'p'.repeat(49), piece: 'setpiece.skybridge_4', x: 0, y: 0, z: 1, rotation: 0, mirror: false }))).ok).toBe(false);
  });

  it('MapMaker keeps the placements (forEditing); play gets the parts', () => {
    const doc = withPiece({ piece: 'setpiece.skybridge_2', x: 0, y: 0, z: 1, rotation: 1, mirror: false });
    const edit = loadMap(serializeMap(doc), undefined, { forEditing: true });
    expect(edit.ok && edit.map.setPieces?.length).toBe(1);
    expect(edit.ok && edit.map.classicStructure.tiles.length).toBe(1);
    const play = loadMap(serializeMap(doc));
    expect(play.ok && play.map.setPieces).toBeUndefined();
    expect(play.ok && play.map.classicStructure.tiles.length).toBe(3);
  });

  it('unknown pieces and packs, and a grid that is not 8 m by 4 m', () => {
    expect(validateMap(withPiece({ piece: 'setpiece.nothing', x: 0, y: 0, z: 0, rotation: 0, mirror: false })).some((i) => i.code === 'setpiece.unknown' && i.severity === 'error')).toBe(true);
    expect(validateMap(withPiece({ piece: 'setpiece.skybridge_2', x: 0, y: 0, z: 1, rotation: 0, mirror: false, pack: 'baroque' })).some((i) => i.code === 'setpiece.pack' && i.severity === 'warning')).toBe(true);
    const big = withPiece({ piece: 'setpiece.skybridge_2', x: 0, y: 0, z: 1, rotation: 0, mirror: false });
    expect(validateMap({ ...big, classicStructure: { ...big.classicStructure, cellSize: 6 } }).some((i) => i.code === 'setpiece.grid')).toBe(true);
  });
});
