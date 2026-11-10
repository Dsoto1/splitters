import type { EditCommand } from './commands.ts';

/**
 * MapMaker's first-time tour (MapMaker overhaul Phase 6): a short, skippable walk through making a tiny map with the
 * real tools: place a room, a spawn and a pickup, then test it. Each step waits for the person to do it, read from
 * the editor's history (the command an edit made) and its Test / Play from here, never from a timer.
 *
 * This file is the rules: the steps, their words, what moves each on, and what is remembered. The client draws it
 * (client/editor/tour.ts).
 */

export type TourStepId = 'welcome' | 'room' | 'spawn' | 'pickup' | 'test' | 'done';

export interface TourStep {
  id: TourStepId;
  /** The card's heading. */
  title: string;
  /** Its one line. */
  hint: string;
  /** The mode (`data-ws`) the step's tool is in: until the person is in it, the mode tab is what's highlighted. */
  mode?: string;
  /** What's highlighted: palette cards (`data-tool`) or page elements (`#id`), each that is shown. */
  targets?: readonly string[];
  /** What moves it on: its button (welcome, done), an edit, or a test match starting. */
  on: 'button' | 'edit' | 'test';
}

export const TOUR_STEPS: readonly TourStep[] = [
  { id: 'welcome', title: 'Welcome to MapMaker', hint: "Let's make a tiny map and play it. It takes about a minute.", on: 'button' },
  { id: 'room', title: 'Place a room', hint: 'Pick Room, then click the ground next to the first room.', mode: 'build', targets: ['tile:core.room'], on: 'edit' },
  { id: 'spawn', title: 'Add a spawn', hint: 'In Gameplay, pick Player Spawn and click inside your new room.', mode: 'entities', targets: ['spawn'], on: 'edit' },
  { id: 'pickup', title: 'Add a pickup', hint: 'Pick one, say Health (Small), and drop it near the spawn.', mode: 'entities', targets: ['pickup:core.health_small'], on: 'edit' },
  { id: 'test', title: 'Try it out', hint: '▶ Here plays from where you look; ▶ PLAY TEST starts at a spawn.', targets: ['#ed-test-here', '#ed-test'], on: 'test' },
  { id: 'done', title: 'Nice work!', hint: "That's the whole loop. Press ? for every key, and to take this tour again.", on: 'button' },
];

/** What the tour hears from the editor. */
export type TourEvent =
  /** An edit went into the history (`undo`: it was an undo, which never counts). */
  | { kind: 'edit'; command: EditCommand; undo?: boolean }
  /** A test match started (Test, ▶ Here, F5 or Shift+F5), past the check for errors. */
  | { kind: 'test' }
  /** The card's button (Let's go, Done). */
  | { kind: 'button' };

/** What the rules need to know about the map's pieces. */
export interface TourContext {
  /** A tile id that counts as a room (an enclosed room, hall or building tile). */
  isRoom(tile: string): boolean;
}

/** Every command a command is made of (batches opened up). */
function* parts(cmd: EditCommand): Generator<EditCommand> {
  if (cmd.kind === 'batch') for (const c of cmd.commands) yield* parts(c);
  else yield cmd;
}

/** Whether an event does the step: the step's button, a test match starting, or an edit that adds what it asks for. */
export function tourStepDone(step: TourStep, ev: TourEvent, ctx: TourContext): boolean {
  if (ev.kind !== step.on) return false;
  if (ev.kind !== 'edit') return true;
  if (ev.undo) return false;
  for (const c of parts(ev.command)) {
    if (step.id === 'room' && c.kind === 'addTiles' && c.tiles.some((t) => ctx.isRoom(t.tile))) return true;
    if (step.id === 'spawn' && c.kind === 'addEntities' && c.entities.some((e) => e.kind === 'spawn')) return true;
    if (step.id === 'pickup' && c.kind === 'addEntities' && c.entities.some((e) => e.kind === 'pickup')) return true;
  }
  return false;
}

/** The tour as it runs: the step showing, or off. `ended` says how the last run ended (what is remembered). */
export interface TourState {
  step: number | null;
  ended?: 'done' | 'skipped';
}

export const TOUR_OFF: TourState = { step: null };

export function startTour(): TourState {
  return { step: 0 };
}

/**
 * The state after an event: the next step when the event does this one. The test step's finishing is when the tour
 * counts as done (the closing card is only a word of thanks); its button then closes it.
 */
export function tourAdvance(state: TourState, ev: TourEvent, ctx: TourContext): TourState {
  if (state.step === null) return state;
  const step = TOUR_STEPS[state.step];
  // The closing card goes with its button or the next edit: it never stays in the way of the work.
  if (step?.id === 'done' && ev.kind === 'edit' && !ev.undo) return { step: null, ended: 'done' };
  if (!step || !tourStepDone(step, ev, ctx)) return state;
  if (step.id === 'done') return { step: null, ended: 'done' };
  const next = state.step + 1;
  return TOUR_STEPS[next]?.id === 'done' ? { step: next, ended: 'done' } : { step: next };
}

/** Esc or Skip, at any step: the tour ends, remembered as skipped (or done, once it got that far). */
export function skipTour(state: TourState): TourState {
  if (state.step === null) return state;
  return { step: null, ended: state.ended ?? 'skipped' };
}

/** Where the browser remembers that the tour was done or skipped. */
export const TOUR_STORE_KEY = 'tiletrigger.editor.tour';

/**
 * Whether entering MapMaker starts the tour by itself: only on a first visit (nothing remembered), and never in the
 * browser tests' test mode unless they ask for it (`?tour=1`).
 */
export function tourStartsByItself(o: { remembered: string | null; testMode: boolean; asked: boolean }): boolean {
  if (o.remembered === 'done' || o.remembered === 'skipped') return false;
  return !o.testMode || o.asked;
}
