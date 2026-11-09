import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FLOOR_REACH,
  applyCommand,
  builtInSetPieces,
  buildMapGeometry,
  cutGroundToFloorsCommand,
  deleteCommand,
  deleteSetPieceCommand,
  expandSetPieces,
  invertCommand,
  loadMap,
  moveEntitiesCommand,
  moveSetPieceCommand,
  newMapDocument,
  newTerrain,
  placeSetPieceCommand,
  rotateCommand,
  rotateSetPieceCommand,
  serializeMap,
  settledPropY,
  terrainHeightAt,
  terrainUnderFloors,
  vertexY,
  withGroundAsPlayed,
  withPathsLaid,
  type EditCommand,
  type MapDocument,
  type MapEntity,
  type TerrainData,
} from '../src/index.ts';

/** A one-room map on flat terrain at height `y` (metres). */
function roomOn(y: number): MapDocument {
  const doc = newMapDocument('Floors');
  const t = newTerrain(24);
  t.heights.fill(Math.round(y * 100));
  return { ...doc, terrain: t, classicStructure: { ...doc.classicStructure, tiles: [{ id: 'tile_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }] } };
}

/** The highest terrain vertex inside a floor's footprint (edges included), and the floor's top. */
function worstUnderFloors(doc: MapDocument, t: TerrainData): { over: number; top: number } {
  let over = -Infinity;
  let top = 0;
  for (const b of buildMapGeometry(doc)) {
    if (b.kind !== 'floor' || b.yaw) continue;
    top = b.max[1];
    for (let r = 0; r < t.rows; r++) {
      for (let c = 0; c < t.cols; c++) {
        const x = t.origin[0] + c * t.spacing;
        const z = t.origin[1] + r * t.spacing;
        if (x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2]) over = Math.max(over, vertexY(t, c, r) - top);
      }
    }
  }
  return { over, top };
}

/** The map on its ground as played: what loadMap plays and MapMaker draws (set pieces expanded, settle.ts withGroundAsPlayed). */
const played = (doc: MapDocument): MapDocument => withGroundAsPlayed(expandSetPieces(doc, builtInSetPieces()).map);
const ground = (doc: MapDocument): number[] => played(doc).terrain!.heights;

const block = (id: string, x: number, y: number, z: number, size: [number, number, number], yaw = 0): MapEntity => ({ id, kind: 'block', position: [x, y, z], size, yaw, material: null, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 });

/** A field of open ground 30 cm up (a 2 m grid, 96 m across) with a 12 m slab sunk in it at `x`: its top (20 cm) is under the grass, so the ground under it is lowered. */
function field(x = -30, entities: MapEntity[] = []): MapDocument {
  const doc = newMapDocument('Field');
  const t = newTerrain(96);
  t.heights.fill(30);
  return { ...doc, terrain: t, classicStructure: { ...doc.classicStructure, tiles: [] }, entities: [...doc.entities, block('slab', x, 0, 0, [12, 0.2, 12]), ...entities] };
}

/** The terrain vertices within `r` metres of (x, z) on the box round it, as heights in cm. */
function patch(t: TerrainData, x: number, z: number, r: number): number[] {
  const out: number[] = [];
  for (let row = 0; row < t.rows; row++) {
    for (let c = 0; c < t.cols; c++) {
      const vx = t.origin[0] + c * t.spacing;
      const vz = t.origin[1] + row * t.spacing;
      if (Math.abs(vx - x) <= r && Math.abs(vz - z) <= r) out.push(t.heights[row * t.cols + c]!);
    }
  }
  return out;
}

const run = (doc: MapDocument, cmd: EditCommand | { error: string }): MapDocument => {
  if ('error' in cmd) throw new Error(cmd.error);
  return applyCommand(doc, cmd);
};

describe('terrain under floors', () => {
  it('lowers ground that reaches a floor, and leaves ground well below or far above alone', () => {
    for (const y of [0, 0.02, 0.6, FLOOR_REACH - 0.1]) {
      const doc = roomOn(y);
      const t = terrainUnderFloors(doc)!;
      expect(worstUnderFloors(doc, t).over).toBeLessThan(-0.04);
    }
    const low = roomOn(-1);
    expect(terrainUnderFloors(low)).toBe(low.terrain);
    const buried = roomOn(FLOOR_REACH + 1);
    expect(terrainUnderFloors(buried)).toBe(buried.terrain);
  });

  it("MapMaker's edits leave the document's own ground alone; the ground as played is kept under the floors", () => {
    const doc = roomOn(0.3);
    const before = { ...doc, classicStructure: { ...doc.classicStructure, tiles: [] } };
    const after = applyCommand(before, { kind: 'addTiles', tiles: doc.classicStructure.tiles });
    expect(after.terrain).toBe(before.terrain);
    expect(worstUnderFloors(after, played(after).terrain!).over).toBeLessThan(-0.04);
    // Loading for editing keeps the ground as made; as played it is lowered under the floor, as MapMaker draws it.
    const text = serializeMap(after);
    const ed = loadMap(text, undefined, { forEditing: true });
    const pl = loadMap(text);
    expect(ed.ok && ed.map.terrain!.heights).toEqual(after.terrain!.heights);
    expect(pl.ok && pl.map.terrain!.heights).toEqual(ground(after));
  });

  it('a floor moved across a field and back: the ground under each place it leaves comes back, and none is lowered for good', () => {
    const start = field();
    let doc = start;
    // East in 4 m steps, 60 m across the field (each step is a MapMaker edit), then back the same way.
    const steps = [...Array.from({ length: 15 }, () => 4), ...Array.from({ length: 15 }, () => -4)];
    let x = -30;
    for (const dx of steps) {
      doc = run(doc, moveEntitiesCommand(doc, ['slab'], dx, 0, 0));
      x += dx;
      // The document's ground is never touched; as played it is the field's, lowered under the slab where it is now
      // (the same as a slab placed there to begin with), and nowhere else.
      expect(doc.terrain).toBe(start.terrain);
      const now = played(doc).terrain!;
      expect(now.heights).toEqual(ground(field(x)));
      expect(Math.max(...patch(now, x, 0, 5))).toBeLessThan(30);
      if (Math.abs(x + 30) > 14) expect(patch(now, -30, 0, 6).every((h) => h === 30)).toBe(true);
    }
    expect(x).toBe(-30);
    expect(serializeMap(doc)).toBe(serializeMap(start));
    expect(ground(doc)).toEqual(ground(start));
  });

  it('an edit and its undo leave the ground byte-identical', () => {
    const start = field(-30, [block('kerb', 30, 0.1, -20, [2, 0.25, 6])]);
    const piece = placeSetPieceCommand(start, 'setpiece.trench_straight', 2, 2, 0, 0);
    if ('error' in piece) throw new Error(piece.error);
    const edits: [string, EditCommand | { error: string }][] = [
      ['move a floor', moveEntitiesCommand(start, ['slab'], 7, 0, -5)],
      ['turn a floor', rotateCommand(start, { tiles: [], entities: ['slab'] }, undefined, { fine: true })],
      ['turn a floor a quarter', rotateCommand(start, { tiles: [], entities: ['slab'] })],
      ['delete a floor', deleteCommand(start, { tiles: [], entities: ['slab'] })],
      ['delete two', deleteCommand(start, { tiles: [], entities: ['slab', 'kerb'] })],
      ['raise a floor', moveEntitiesCommand(start, ['kerb'], 0, 0.5, 0)],
      ['add a room', { kind: 'addTiles', tiles: [{ id: 'tile_r', tile: 'core.room', x: 3, y: -3, z: 0, rotation: 0 }] }],
      ['place a trench', piece.command],
      ['sculpt', { kind: 'setTerrain', before: start.terrain, after: { ...start.terrain!, heights: start.terrain!.heights.map((h, i) => h + (i % 7)) } }],
    ];
    for (const [what, cmd] of edits) {
      if ('error' in cmd) throw new Error(`${what}: ${cmd.error}`);
      const after = applyCommand(start, cmd);
      const back = applyCommand(after, invertCommand(cmd));
      // (An undone delete puts the thing back at the end of the list: the ground is what has to come back exactly.)
      expect(JSON.stringify(back.terrain), what).toBe(JSON.stringify(start.terrain));
      expect(ground(back), what).toEqual(ground(start));
      // A redo after the undo gives the same ground again.
      expect(ground(applyCommand(back, cmd)), what).toEqual(ground(after));
    }
  });

  it('a floor deleted gives the ground under it back', () => {
    const start = field();
    expect(Math.max(...patch(played(start).terrain!, -30, 0, 5))).toBeLessThan(30);
    const gone = run(start, deleteCommand(start, { tiles: [], entities: ['slab'] }));
    expect(gone.terrain).toBe(start.terrain);
    // Nothing is lowered any more: the ground as played is the ground as made.
    expect(played(gone).terrain).toBe(start.terrain);
  });

  it('a turned floor is never lowered under; squared up it is, and moved on it gives the ground back', () => {
    const turned = field(-30);
    const askew = { ...turned, entities: turned.entities.map((e) => (e.id === 'slab' && e.kind === 'block' ? { ...e, yaw: 0.04 } : e)) };
    expect(played(askew).terrain).toBe(askew.terrain);
    // Squared up (the St. John's slab), then moved 40 m: the ground under where it was squared up comes back.
    const square = run(askew, { kind: 'updateEntities', before: [askew.entities.find((e) => e.id === 'slab')!], after: [turned.entities.find((e) => e.id === 'slab')!] });
    expect(ground(square)).toEqual(ground(field(-30)));
    const moved = run(square, moveEntitiesCommand(square, ['slab'], 40, 0, 0));
    expect(patch(played(moved).terrain!, -30, 0, 6).every((h) => h === 30)).toBe(true);
    expect(ground(moved)).toEqual(ground(field(10)));
    // A block turned a quarter is a turned floor too (its yaw is set): the ground under it as made.
    const quarter = run(square, rotateCommand(square, { tiles: [], entities: ['slab'] }));
    expect(played(quarter).terrain).toBe(quarter.terrain);
  });

  it('set pieces and sunken trenches carve their slot as on load, and the slot moves with them', () => {
    const doc = newMapDocument('Trench');
    const t = newTerrain(64);
    t.heights.fill(0);
    const before: MapDocument = { ...doc, terrain: t, classicStructure: { ...doc.classicStructure, tiles: [] } };
    const placed = placeSetPieceCommand(before, 'setpiece.trench_straight', 0, 0, 0, 0);
    if ('error' in placed) throw new Error(placed.error);
    const after = applyCommand(before, placed.command);
    const id = after.setPieces![0]!.id;
    // The document's ground is as made; the sunk channel takes the ground down with it as played.
    expect(after.terrain).toBe(t);
    const slot = played(after).terrain!;
    expect(Math.min(...slot.heights)).toBeLessThan(-100);
    expect(Math.min(...patch(slot, 0, 0, 3))).toBeLessThan(-100);
    // The exported map plays the same ground, and opens in MapMaker with the ground as made (no "changed since it was
    // exported" on reload).
    const text = serializeMap(after);
    const pl = loadMap(text);
    const ed = loadMap(text, undefined, { forEditing: true });
    expect(pl.ok && pl.map.terrain!.heights).toEqual(slot.heights);
    if (!ed.ok) throw new Error('the exported map does not load');
    expect(JSON.stringify(ed.map.terrain)).toBe(JSON.stringify(after.terrain));
    const again = serializeMap(ed.map);
    const ed2 = loadMap(again, undefined, { forEditing: true });
    expect(ed2.ok && serializeMap(ed2.map)).toBe(again);
    // Moved two cells east, the slot goes with it and the ground where it was comes back.
    const moved = run(after, moveSetPieceCommand(after, id, 2, 0, 0));
    const there = played(moved).terrain!;
    expect(patch(there, 0, 0, 3).every((h) => h === 0)).toBe(true);
    expect(Math.min(...patch(there, 16, 0, 3))).toBeLessThan(-100);
    // Turned a quarter, it carves across instead; deleted, the ground is the ground as made.
    const turned = run(after, rotateSetPieceCommand(after, id, 1));
    expect(ground(turned)).not.toEqual(slot.heights);
    expect(Math.min(...ground(turned))).toBeLessThan(-100);
    const gone = run(after, deleteSetPieceCommand(after, [id]));
    expect(played(gone).terrain).toBe(t);
    // A Sunken Trench tile on its own carves its slot as played, and the document keeps the ground as made.
    const tile = run(before, { kind: 'addTiles', tiles: [{ id: 'tile_t', tile: 'core.trench_sunk', x: -2, y: -2, z: 0, rotation: 0 }] });
    expect(tile.terrain).toBe(t);
    expect(Math.min(...patch(played(tile).terrain!, -16, -16, 3))).toBeLessThan(-100);
    const tl = loadMap(serializeMap(tile));
    expect(tl.ok && tl.map.terrain!.heights).toEqual(ground(tile));
  });

  it('props bedded on the ground beside a floor are played (and drawn) on the ground kept under it, and follow it when the floor goes', () => {
    // A rock on the grass just east of the sunk slab: one side of its footprint is over the slab's lowered edge.
    const rock = { id: 'rock', kind: 'prop', model: 'prop.rock_medium', position: [-22.5, 0, 0], yaw: 0, scale: 1, solid: true, tint: null } as Extract<MapEntity, { kind: 'prop' }>;
    const bare = field();
    const map = field(-30, [{ ...rock, position: [-22.5, settledPropY(bare.terrain!, rock)!, 0] }]);
    const made = map.entities.find((e) => e.id === 'rock')!;
    const asPlayed = played(map);
    const on = asPlayed.entities.find((e) => e.id === 'rock') as typeof rock;
    expect(on.position[1]).toBeLessThan(made.position[1] - 0.05);
    expect(on.position[1]).toBeCloseTo(settledPropY(asPlayed.terrain!, on)!, 2);
    // Exported and loaded: the same.
    const pl = loadMap(serializeMap(map));
    expect(pl.ok && pl.map.entities.find((e) => e.id === 'rock')!.position).toEqual(on.position);
    // The slab moved away: the ground comes back, and the rock is played where it was made, on it.
    const moved = run(map, moveEntitiesCommand(map, ['slab'], 30, 0, 0));
    expect(played(moved).entities.find((e) => e.id === 'rock')!.position).toEqual(made.position);
  });

  it('every shipped map loads for editing with its own ground, and as played with no terrain through a floor', () => {
    const dir = new URL('../../../maps/', import.meta.url);
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const text = readFileSync(new URL(f, dir), 'utf8');
      const raw = JSON.parse(text) as { terrain?: { heights: number[] } | null };
      if (!raw.terrain) continue;
      const r = loadMap(text);
      expect(r.ok, f).toBe(true);
      if (!r.ok) continue;
      expect(terrainUnderFloors(r.map), f).toBe(r.map.terrain);
      // MapMaker opens it with the ground as made: exported again with no edits, the ground is the same.
      const ed = loadMap(text, undefined, { forEditing: true });
      expect(ed.ok && ed.map.terrain!.heights, f).toEqual(raw.terrain.heights);
    }
  });

  it("MapMaker's view of the ground is loadMap's: the same pieces in the same order", () => {
    // The view (EditorView.setMap) lays the document's paths, keeps that ground under the floors of the geometry as
    // made and re-beds each prop with rebeddedY; withGroundAsPlayed does the same in one go.
    const r = loadMap(readFileSync(new URL('../../../maps/st_johns.json', import.meta.url), 'utf8'), undefined, { forEditing: true });
    if (!r.ok) throw new Error('st_johns does not load');
    const doc = expandSetPieces(r.map, builtInSetPieces()).map;
    const boxes = buildMapGeometry(doc);
    const laid = withPathsLaid(doc).terrain!;
    const view = terrainUnderFloors({ ...doc, terrain: laid }, boxes)!;
    const asPlayed = withGroundAsPlayed(doc, undefined, boxes);
    expect(view.heights).toEqual(asPlayed.terrain!.heights);
    expect(withGroundAsPlayed(doc).terrain!.heights).toEqual(asPlayed.terrain!.heights);
    // A spot check that the view's re-bedding is the loader's.
    const loaded = loadMap(serializeMap(r.map));
    expect(loaded.ok && loaded.map.terrain!.heights).toEqual(view.heights);
    if (loaded.ok) expect(loaded.map.entities.filter((e) => e.kind === 'prop').map((e) => e.position[1])).toEqual(asPlayed.entities.filter((e) => e.kind === 'prop').map((e) => e.position[1]));
    expect(terrainHeightAt(view, 0, 0)).not.toBeNull();
  });
});

/** Stairs (`tile`, turned `rotation`) on new terrain: flat, 0.15 m under level 0, as MapMaker makes it. */
function stairsOnNewGround(tile = 'core.stairs_open', rotation: 0 | 1 | 2 | 3 = 0): MapDocument {
  const doc = newMapDocument('Stairs');
  return { ...doc, terrain: { ...newTerrain(48), baseY: -0.15 }, classicStructure: { ...doc.classicStructure, tiles: [{ id: 'flight', tile, x: 0, y: 0, z: 0, rotation }] } };
}

describe('stair feet (MapMaker fixes 2, item 8)', () => {
  it('ground at the foot of a flight comes up to just under its base, so the first step is a step, not a 0.4 m lip', () => {
    for (const [tile, rotation, foot] of [['core.stairs_open', 0, [-4.3, 0]], ['core.stairs', 0, [-4.3, 1]], ['core.stairs_grand', 0, [2, -4.3]], ['core.stairs_open', 2, [4.3, 0]], ['core.stairs_open', 1, [0, 4.3]]] as const) {
      const doc = stairsOnNewGround(tile, rotation);
      const made = terrainHeightAt(doc.terrain!, foot[0], foot[1])!;
      const ground = played(doc).terrain!;
      const at = terrainHeightAt(ground, foot[0], foot[1])!;
      expect(made, tile).toBeCloseTo(-0.15, 5);
      // The first step is 0.25 m up: from the ground at its foot, within a step (PLAYER.maxStepHeight, 0.3 m).
      expect(0.25 - at, `${tile} turned ${rotation}: ${at}`).toBeLessThan(0.28);
      expect(at).toBeLessThan(0);
      // Worked out, never stored, and done once: a second pass changes nothing; far away the ground is as made.
      expect(terrainUnderFloors({ ...doc, terrain: ground })).toBe(ground);
      expect(terrainHeightAt(ground, 20, 20)).toBeCloseTo(-0.15, 5);
      expect(doc.terrain!.heights.every((h) => h === 0)).toBe(true);
    }
  });

  it('leaves ground well under a step alone (a drop, a ditch), and gives it back when the flight goes', () => {
    const deep = stairsOnNewGround();
    deep.terrain!.heights.fill(-100);
    expect(terrainHeightAt(played(deep).terrain!, -4.3, 0)).toBeCloseTo(-1.15, 5);
    const doc = stairsOnNewGround();
    const gone = run(doc, deleteCommand(doc, { tiles: ['flight'], entities: [] }));
    expect(played(gone).terrain!.heights).toEqual(doc.terrain!.heights);
  });
});

describe('Cut ground to floors (MapMaker fixes 2, item 9)', () => {
  it('lowers the ground as made over the selection\'s floors however deep, in one undo step', () => {
    const buried = roomOn(FLOOR_REACH + 2);
    // The ground as played keeps a hill over a floor buried deeper than FLOOR_REACH.
    expect(terrainUnderFloors(buried)).toBe(buried.terrain);
    const r = cutGroundToFloorsCommand(buried, { tiles: ['tile_a'], entities: [] });
    if ('error' in r) throw new Error(r.error);
    expect(r.deepest).toBeGreaterThan(FLOOR_REACH);
    const cut = applyCommand(buried, r.command);
    expect(worstUnderFloors(cut, cut.terrain!).over).toBeLessThan(-0.04);
    // Outside the room the hill is as it was.
    expect(terrainHeightAt(cut.terrain!, 10, 10)).toBeCloseTo(FLOOR_REACH + 2, 5);
    expect(applyCommand(cut, invertCommand(r.command)).terrain).toEqual(buried.terrain);
    expect(cutGroundToFloorsCommand(cut, { tiles: ['tile_a'], entities: [] })).toEqual({ error: expect.stringMatching(/already under/) });
    expect(cutGroundToFloorsCommand(buried, { tiles: [], entities: [] })).toEqual({ error: 'nothing selected' });
  });
});
