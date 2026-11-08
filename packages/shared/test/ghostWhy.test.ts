import { describe, expect, it } from 'vitest';
import {
  MAX_TILE_CELL,
  MAX_TILE_LEVEL,
  SCENERY_NOTE,
  applyCommand,
  buildMapGeometry,
  checkNote,
  checkSetPiecePlacement,
  entityGhostNote,
  newTerrain,
  placeTileCommand,
  standsOnSomething,
  tileGhostCheck,
  zoneNote,
  type MapDocument,
  type SetPiecePlacement,
} from '../src/index.ts';
import { makeMap } from './helpers.ts';

const corridor = (): MapDocument => makeMap([{ id: 'c', tile: 'core.corridor', x: 0, y: 0, z: 0, rotation: 0 }]);
const short = (check: ReturnType<typeof tileGhostCheck>) => (check.ok ? null : check.short);
const withBounds = (doc: MapDocument): MapDocument => ({ ...doc, bounds: { min: [-40, -40], max: [40, 40], style: 'invisible', height: 8 } });

describe('the ghost says why (MapMaker Phase 1, item 1)', () => {
  it('a tile over another names it and the level', () => {
    expect(short(tileGhostCheck(corridor(), 'core.room', 0, 0, 0, 0))).toBe('Overlaps the Corridor on Ground');
    // A tall piece's upper storey is the piece too.
    const tall = makeMap([{ id: 't', tile: 'core.room_tall', x: 0, y: 0, z: 0, rotation: 0 }]);
    expect(short(tileGhostCheck(tall, 'core.corridor', 0, 0, 1, 0))).toBe('Overlaps the Tall Room on Level 1');
    // The long reason (toasts, the status line) still says what to do.
    const full = tileGhostCheck(corridor(), 'core.room', 0, 0, 0, 0);
    expect(!full.ok && full.reason).toMatch(/pick a free cell or another level/);
    expect(tileGhostCheck(corridor(), 'core.room', 1, 0, 0, 0).ok).toBe(true);
  });

  it('past the build limit, by level and by distance', () => {
    expect(short(tileGhostCheck(corridor(), 'core.room', 0, 0, MAX_TILE_LEVEL + 1, 0))).toBe(`Past the build limit (${MAX_TILE_LEVEL} levels up or down)`);
    expect(short(tileGhostCheck(corridor(), 'core.room', MAX_TILE_CELL + 1, 0, 0, 0))).toBe(`Past the build limit (${MAX_TILE_CELL} cells from the centre)`);
  });

  it('a Platform on an empty upper storey fits (it becomes that floor), as placing does', () => {
    const tall = makeMap([{ id: 't', tile: 'core.room_tall', x: 0, y: 0, z: 0, rotation: 0 }]);
    const placed = placeTileCommand(tall, 'core.platform', 0, 0, 1, 0);
    expect('floorOf' in placed && !!placed.floorOf).toBe(tileGhostCheck(tall, 'core.platform', 0, 0, 1, 0).ok);
  });

  it('set pieces say what their footprint meets', () => {
    let doc = makeMap([{ id: 'home', tile: 'core.room', x: -10, y: -10, z: 0, rotation: 0 }]);
    const room = placeTileCommand(doc, 'core.room', 3, 3, 0, 0);
    if ('error' in room) throw new Error(room.error);
    doc = applyCommand(doc, room.command);
    const p: SetPiecePlacement = { id: 'g', piece: 'setpiece.skybridge_2', x: 3, y: 2, z: 0, rotation: 0, mirror: false };
    expect(checkNote(checkSetPiecePlacement(doc, [p]))).toEqual({ tone: 'bad', text: 'Overlaps the Room on Ground' });
    expect(checkNote(checkSetPiecePlacement(doc, [{ ...p, x: 20, y: 20 }]))).toBeNull();
  });

  it('the scenery zone is a note, not a refusal', () => {
    const doc = withBounds(corridor());
    expect(zoneNote(doc, 0, 0)).toBeNull();
    expect(zoneNote(doc, 100, 0)).toEqual({ tone: 'note', text: SCENERY_NOTE });
    expect(tileGhostCheck(doc, 'core.room', 12, 0, 0, 0).ok).toBe(true);
  });

  it('entities with nothing under them, and outside the boundary', () => {
    const doc = corridor();
    const ground = { boxes: buildMapGeometry(doc), terrain: null };
    // On the corridor's floor: fine. Beside it, over nothing: no floor.
    expect(entityGhostNote(doc, 'spawn', [0, 0, 0], ground)).toBeNull();
    expect(entityGhostNote(doc, 'spawn', [20, 0, 0], ground)).toEqual({ tone: 'warn', text: 'No floor under it' });
    expect(entityGhostNote(doc, 'pickup', [0, 8, 0], ground)).toEqual({ tone: 'warn', text: 'No floor under it' });
    // A chandelier hangs; doors, zones and lights are left alone.
    expect(entityGhostNote(doc, 'prop', [20, 0, 0], ground, 'prop.hm_chandelier')).toBeNull();
    expect(entityGhostNote(doc, 'object', [20, 0, 0], ground)).toBeNull();
    // Ground under it is a floor too (as a spawn's check: within 1.5 m).
    const terrain = newTerrain(200, 2);
    expect(standsOnSomething({ boxes: [], terrain }, 20, 1, 0)).toBe(true);
    expect(standsOnSomething({ boxes: [], terrain }, 20, 4, 0)).toBe(false);
    // Outside the map's boundary: spawns must be inside it; other things are in the scenery zone.
    const bounded = withBounds({ ...doc, terrain });
    const g2 = { boxes: ground.boxes, terrain };
    expect(entityGhostNote(bounded, 'spawn', [60, 0, 0], g2)).toEqual({ tone: 'warn', text: 'Outside the map boundary: a spawn must be inside it' });
    expect(entityGhostNote(bounded, 'pickup', [60, 0, 0], g2)).toEqual({ tone: 'warn', text: 'Outside the map boundary (scenery zone)' });
    // No boundary set: the terrain's edge is the playable area, and past it is the scenery note.
    const open = { ...doc, terrain: newTerrain(40, 2) };
    expect(entityGhostNote(open, 'object', [60, 0, 0], { boxes: [], terrain: open.terrain })).toEqual({ tone: 'note', text: SCENERY_NOTE });
  });
});
