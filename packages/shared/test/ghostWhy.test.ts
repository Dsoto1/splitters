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
  ghostRefuses,
  PROPS_REFUSED_OUTSIDE,
  newTerrain,
  placeTileCommand,
  standsOnSomething,
  tileGhostCheck,
  zoneNote,
  type MapDocument,
  type SetPiecePlacement,
  type WorldBox,
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

  it('entities over nothing are refused (owner, 2026-11-08)', () => {
    const doc = corridor();
    const ground = { boxes: buildMapGeometry(doc), terrain: null };
    const none = { tone: 'bad', text: 'No floor under it' };
    // On the corridor's floor: fine. Beside it, over nothing: refused, every kind.
    expect(entityGhostNote(doc, 'spawn', [0, 0, 0], ground)).toBeNull();
    for (const kind of ['spawn', 'pickup', 'prop', 'mount', 'npc'] as const) expect(entityGhostNote(doc, kind, [20, 0, 0], ground, 'prop.crate')).toEqual(none);
    expect(entityGhostNote(doc, 'pickup', [0, 8, 0], ground)).toEqual(none);
    expect(ghostRefuses(entityGhostNote(doc, 'prop', [20, 0, 0], ground, 'prop.crate'))).toBe(true);
    // A chandelier hangs; doors, zones and lights are left alone (never refused).
    expect(entityGhostNote(doc, 'prop', [20, 0, 0], ground, 'prop.hm_chandelier')).toBeNull();
    expect(entityGhostNote(doc, 'object', [20, 0, 0], ground)).toBeNull();
    // Ground under it is a floor too (as a spawn's check: within 1.5 m).
    const terrain = newTerrain(200, 2);
    expect(standsOnSomething({ boxes: [], terrain }, 20, 1, 0)).toBe(true);
    expect(standsOnSomething({ boxes: [], terrain }, 20, 4, 0)).toBe(false);
    // On a prop's or block's top (the boxes as shown), and in or on a liquid (a boat on a pool), it stands.
    const crate = { min: [19, 0, -1], max: [21, 2, 1], kind: 'prop', sourceId: 'crate' } as unknown as WorldBox;
    expect(entityGhostNote(doc, 'pickup', [20, 2, 0], { boxes: [...ground.boxes, crate], terrain: null })).toBeNull();
    const pool = { position: [20, -2, 0], size: [10, 2, 10] } as const;
    expect(entityGhostNote(doc, 'mount', [20, -0.5, 0], { ...ground, liquids: [pool] })).toBeNull();
    expect(entityGhostNote(doc, 'mount', [20, 3, 0], { ...ground, liquids: [pool] })).toEqual(none);
  });

  it('spawns, pickups, vehicles and NPCs outside the boundary are refused; props there stay scenery', () => {
    const doc = corridor();
    const terrain = newTerrain(200, 2);
    const bounded = withBounds({ ...doc, terrain });
    const g2 = { boxes: buildMapGeometry(doc), terrain };
    expect(entityGhostNote(bounded, 'spawn', [60, 0, 0], g2)).toEqual({ tone: 'bad', text: 'Outside the map boundary: a spawn must be inside it' });
    expect(entityGhostNote(bounded, 'pickup', [60, 0, 0], g2)).toEqual({ tone: 'bad', text: 'Outside the map boundary: pickups go inside it' });
    expect(entityGhostNote(bounded, 'mount', [60, 0, 0], g2)).toEqual({ tone: 'bad', text: 'Outside the map boundary: vehicles go inside it' });
    expect(entityGhostNote(bounded, 'npc', [60, 0, 0], g2)).toEqual({ tone: 'bad', text: 'Outside the map boundary: NPCs go inside it' });
    expect(PROPS_REFUSED_OUTSIDE).toBe(false);
    expect(entityGhostNote(bounded, 'prop', [60, 0, 0], g2, 'prop.crate')).toEqual({ tone: 'warn', text: 'Outside the map boundary (scenery zone)' });
    expect(entityGhostNote(bounded, 'object', [60, 0, 0], g2)).toEqual({ tone: 'warn', text: 'Outside the map boundary (scenery zone)' });
    // Inside it: fine.
    expect(entityGhostNote(bounded, 'pickup', [10, 0, 0], g2)).toBeNull();
    // No boundary set: the terrain's edge is the playable area; past it a prop or object gets the scenery note.
    const open = { ...doc, terrain: newTerrain(40, 2) };
    const g3 = { boxes: [], terrain: open.terrain };
    expect(entityGhostNote(open, 'object', [60, 0, 0], g3)).toEqual({ tone: 'note', text: SCENERY_NOTE });
    expect(entityGhostNote(open, 'spawn', [60, 0, 0], g3)).toEqual({ tone: 'bad', text: 'Outside the playable area: a spawn must be inside it' });
    // Past the build limit: refused for props too; an object is warned.
    const far = (MAX_TILE_CELL + 2) * doc.classicStructure.cellSize;
    const crateAt = (x: number) => ({ min: [x - 1, -1, -1], max: [x + 1, 0, 1], kind: 'floor', sourceId: 'f' }) as unknown as WorldBox;
    expect(entityGhostNote(doc, 'prop', [far, 0, 0], { boxes: [{ ...crateAt(far) }], terrain: null }, 'prop.crate')).toEqual({ tone: 'bad', text: 'Past the build limit: outside the build area' });
    expect(entityGhostNote(doc, 'object', [far, 0, 0], { boxes: [], terrain: null })?.tone).toBe('warn');
  });
});
