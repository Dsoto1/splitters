// MapMaker overhaul Phase 6 (docs/MAPMAKER_OVERHAUL_PLAN.md): the first-time tour's steps, what moves each on (the
// editor's history and its test starting, never a timer), skipping, and what is remembered.
import { describe, expect, it } from 'vitest';
import {
  EditHistory,
  newMapDocument,
  skipTour,
  startTour,
  TOUR_OFF,
  TOUR_STEPS,
  tourAdvance,
  tourStartsByItself,
  type EditCommand,
  type HistoryChange,
  type MapEntity,
  type TourEvent,
  type TourState,
} from '../src/index.ts';

const ctx = { isRoom: (id: string) => id === 'core.room' || id === 'core.room_long' };
const tile = (id: string, tileId: string) => ({ id, tile: tileId, x: 0, y: 0, z: 0, rotation: 0 as const });
const addRoom: EditCommand = { kind: 'addTiles', tiles: [tile('t1', 'core.room')] };
const addCorridor: EditCommand = { kind: 'addTiles', tiles: [tile('t2', 'core.corridor')] };
const spawn: MapEntity = { id: 's1', kind: 'spawn', position: [0, 0, 0], yaw: 0, team: null } as unknown as MapEntity;
const pickup: MapEntity = { id: 'p1', kind: 'pickup', position: [2, 0, 0], item: 'core.health_small', respawnSeconds: null } as MapEntity;
const edit = (command: EditCommand, undo = false): TourEvent => ({ kind: 'edit', command, undo });
const id = (s: TourState) => (s.step === null ? null : TOUR_STEPS[s.step]!.id);
const run = (s: TourState, ...evs: TourEvent[]) => evs.reduce((st, ev) => tourAdvance(st, ev, ctx), s);

describe('MapMaker tour: steps', () => {
  it('has a welcome, four doing steps and a closing card, each with a short line', () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual(['welcome', 'room', 'spawn', 'pickup', 'test', 'done']);
    for (const s of TOUR_STEPS) {
      expect(s.title.length).toBeLessThanOrEqual(24);
      expect(s.hint.length).toBeLessThanOrEqual(80);
    }
    expect(TOUR_STEPS.find((s) => s.id === 'room')!.mode).toBe('build');
    expect(TOUR_STEPS.find((s) => s.id === 'spawn')!.mode).toBe('entities');
  });

  it('goes through the whole tour on the right commands', () => {
    let s = startTour();
    expect(id(s)).toBe('welcome');
    s = run(s, { kind: 'button' });
    expect(id(s)).toBe('room');
    s = run(s, edit(addRoom));
    expect(id(s)).toBe('spawn');
    s = run(s, edit({ kind: 'addEntities', entities: [spawn] }));
    expect(id(s)).toBe('pickup');
    s = run(s, edit({ kind: 'addEntities', entities: [pickup] }));
    expect(id(s)).toBe('test');
    s = run(s, { kind: 'test' });
    expect(id(s)).toBe('done');
    // Done once the test starts: that is what is remembered, even before the closing card goes.
    expect(s.ended).toBe('done');
    s = run(s, { kind: 'button' });
    expect(s).toEqual({ step: null, ended: 'done' });
  });

  it('waits on the wrong commands, undos and other events', () => {
    let s = run(startTour(), { kind: 'button' });
    s = run(s, edit(addCorridor), edit({ kind: 'addEntities', entities: [spawn] }), { kind: 'test' }, { kind: 'button' });
    expect(id(s)).toBe('room');
    // An undo that puts a room back isn't placing one.
    s = run(s, edit(addRoom, true));
    expect(id(s)).toBe('room');
    // A room inside a batch (placing with its dressing) counts.
    s = run(s, edit({ kind: 'batch', commands: [{ kind: 'addEntities', entities: [] }, addRoom] }));
    expect(id(s)).toBe('spawn');
    // A pickup isn't a spawn.
    s = run(s, edit({ kind: 'addEntities', entities: [pickup] }));
    expect(id(s)).toBe('spawn');
    // The welcome waits for its button, not an edit.
    expect(id(run(startTour(), edit(addRoom)))).toBe('welcome');
  });

  it('the closing card goes with the next edit too', () => {
    const s = run(startTour(), { kind: 'button' }, edit(addRoom), edit({ kind: 'addEntities', entities: [spawn] }), edit({ kind: 'addEntities', entities: [pickup] }), { kind: 'test' });
    expect(id(s)).toBe('done');
    expect(run(s, edit(addCorridor, true))).toBe(s);
    expect(run(s, edit(addCorridor))).toEqual({ step: null, ended: 'done' });
  });

  it('reads edits from the history: execute and redo count, undo does not', () => {
    const h = new EditHistory(newMapDocument('t'));
    const seen: HistoryChange[] = [];
    h.onChange = (c) => seen.push(c);
    h.execute('Place room', addRoom);
    h.undo();
    h.redo();
    expect(seen.map((c) => !!c.undo)).toEqual([false, true, false]);
    let s = run(startTour(), { kind: 'button' });
    s = run(s, edit(seen[1]!.command!, seen[1]!.undo));
    expect(id(s)).toBe('room');
    s = run(s, edit(seen[2]!.command!, seen[2]!.undo));
    expect(id(s)).toBe('spawn');
  });
});

describe('MapMaker tour: skipping and remembering', () => {
  it('Esc or Skip ends it at any step, remembered as skipped', () => {
    let s = startTour();
    for (let i = 0; i < 5; i++) {
      expect(skipTour(s)).toEqual({ step: null, ended: 'skipped' });
      s = run(s, [{ kind: 'button' }, edit(addRoom), edit({ kind: 'addEntities', entities: [spawn] }), edit({ kind: 'addEntities', entities: [pickup] }), { kind: 'test' }][i] as TourEvent);
    }
    // At the closing card it was already done.
    expect(id(s)).toBe('done');
    expect(skipTour(s)).toEqual({ step: null, ended: 'done' });
    expect(skipTour(TOUR_OFF)).toBe(TOUR_OFF);
    expect(run(TOUR_OFF, { kind: 'button' })).toBe(TOUR_OFF);
  });

  it('starts by itself only on a first visit, and in test mode only when asked', () => {
    expect(tourStartsByItself({ remembered: null, testMode: false, asked: false })).toBe(true);
    expect(tourStartsByItself({ remembered: 'done', testMode: false, asked: false })).toBe(false);
    expect(tourStartsByItself({ remembered: 'skipped', testMode: false, asked: false })).toBe(false);
    expect(tourStartsByItself({ remembered: null, testMode: true, asked: false })).toBe(false);
    expect(tourStartsByItself({ remembered: null, testMode: true, asked: true })).toBe(true);
    expect(tourStartsByItself({ remembered: 'done', testMode: true, asked: true })).toBe(false);
  });
});
