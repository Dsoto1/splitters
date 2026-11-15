/**
 * Hold to use (owner, 2026-11-15: "for resupplying during a match… a certain time they hold E, not instant. same for
 * healing"). Restocking and patching up take a moment of standing still-ish with your hands busy, so they are a
 * choice made out of the fight, not a free refill in the middle of one:
 * - resupply: hold Use (E) at a Supply Buggy's tailgate or beside an Ammo Box (sim/resupply.ts) for RESUPPLY seconds;
 * - heal: hold the trigger with the Medkit out (a heal tool that is not a beam: weapons.ts `heal` with a slow
 *   fire interval) for HEAL seconds, on the hurt teammate you aimed at as you started, or else yourself.
 * Walk-over health packs on the floor stay walk-over (the arena's pace), and the Medi-Beam stays a beam.
 *
 * A hold is sim state (host-authoritative, deterministic: ticks only) and ends in one of three ways: done (the stock
 * or the heal is given), cancelled (one of HoldCancel), or replaced by nothing when its player dies or leaves. The
 * owning player sees its progress in PrivateState `hu`; a cancel is an event (`hold`) so the HUD can say why.
 */
import { TICK_RATE } from './constants.ts';

export type HoldKind = 'resupply' | 'heal';
export const HOLD_KINDS: readonly HoldKind[] = ['resupply', 'heal'];

/** Seconds each hold takes. */
export const HOLD_SECONDS: Readonly<Record<HoldKind, number>> = { resupply: 1.5, heal: 2.5 };

/** Why a hold stopped short. */
export type HoldCancel = 'released' | 'moved' | 'fired' | 'swapped' | 'hurt' | 'gone';
export const HOLD_CANCELS: readonly HoldCancel[] = ['released', 'moved', 'fired', 'swapped', 'hurt', 'gone'];

/** A hold in progress. */
export interface HoldUse {
  kind: HoldKind;
  /** What it works on: an ammo box (`box` id), a resupply mount (`mount` index), or whom a heal is for (`target` slot). */
  box?: number;
  mount?: number;
  target?: number;
  /** The tick it began, and how many ticks it takes. */
  start: number;
  ticks: number;
  /** The weapon in hand as it began (a swap cancels it). */
  weapon: number;
}

export const holdTicks = (kind: HoldKind): number => Math.round(HOLD_SECONDS[kind] * TICK_RATE);

export function startHold(kind: HoldKind, tick: number, weapon: number, on: { box?: number; mount?: number; target?: number }): HoldUse {
  return { kind, ...on, start: tick, ticks: holdTicks(kind), weapon };
}

/** What a hold sees each tick. */
export interface HoldTickState {
  /** The hold's button is down (Use for a resupply, the trigger for a heal). */
  held: boolean;
  /** Still in reach of what it works on (and it still stands, has stock, the target lives and is hurt). */
  inReach: boolean;
  /** Fired, threw or swung this tick (a resupply only: a heal's trigger is the hold itself). */
  fired: boolean;
  /** The weapon in hand now. */
  weapon: number;
  /** The tick its player last took damage (Combatant.hurtAt), if ever. */
  hurtAt?: number;
}

/**
 * One tick of a hold at `tick`: 'done' when it has run its time, a HoldCancel when it stops short, null while it goes
 * on. The checks run in the order the player would read them: let go, moved off, fired, swapped, got hurt.
 */
export function stepHold(h: HoldUse, tick: number, s: HoldTickState): 'done' | HoldCancel | null {
  if (!s.held) return 'released';
  if (!s.inReach) return 'moved';
  if (s.fired && h.kind === 'resupply') return 'fired';
  if (s.weapon !== h.weapon) return 'swapped';
  if (s.hurtAt !== undefined && s.hurtAt >= h.start) return 'hurt';
  return tick - h.start >= h.ticks ? 'done' : null;
}

/** Its progress at `tick`, 0..1. */
export const holdProgress = (h: HoldUse, tick: number): number => Math.max(0, Math.min(1, (tick - h.start) / h.ticks));

/** How a cancel reads on the HUD. */
export const HOLD_CANCEL_TEXT: Readonly<Record<HoldCancel, string>> = {
  released: 'let go too soon',
  moved: 'moved away',
  fired: 'fired',
  swapped: 'switched weapons',
  hurt: 'took a hit',
  gone: 'nothing left there',
};

/** How a hold reads on the HUD's ring. */
export const HOLD_LABEL: Readonly<Record<HoldKind, string>> = { resupply: 'Resupplying', heal: 'Healing' };

/** A heal tool held rather than clicked: the Medkit (a slow, close tool); the Medi-Beam (fast, from afar) stays a beam. */
export const isHoldHealTool = (def: { heal?: number; fireIntervalTicks: number }): boolean => !!def.heal && def.fireIntervalTicks >= 30;

/** The medkit's hold heals this many times its `heal` (one dressing for the wait: the Medkit's 25 → 50). */
export const HOLD_HEAL_SCALE = 2;
/** A heal's target may drift this much past the tool's range before it cancels (m). */
export const HOLD_HEAL_SLACK = 1;
