/**
 * Movement moves on top of running (docs/GUNPLAY_SPEC.md section 27, "Slide and peek"): the slide, which costs stamina
 * the way sprinting does, and the lean (peek), which doesn't. Shared by the host and client prediction, so both step
 * them alike; plain arithmetic and the level's own rays, quantised like the rest of a move.
 *
 * Stamina moves (the slide now; a dodge-step and a combat roll later) are rows of STAMINA_MOVES: a lump of stamina to
 * start, and one cooldown they share (MoveState.moveCd), so they can't be chained back to back.
 */
import type { Vec3 } from '../math.ts';
import { STANCES, type Stance } from './constants.ts';
import type { PhysicsWorld } from './physics.ts';
import { BUTTON_LEAN_LEFT, BUTTON_LEAN_RIGHT } from './inputs.ts';

/** A move that costs stamina: what it takes to start (1 = a full bar) and the shared cooldown after it (s). */
export interface StaminaMove {
  readonly cost: number;
  readonly cooldown: number;
}

/**
 * The slide: sprint, then crouch. It starts a little faster than the sprint, keeps that momentum (steering only a
 * little), slows to a crouch walk over about 0.75 s on the flat, and ends crouched.
 */
export const SLIDE = {
  /** Stamina to start: about a second of sprinting (SPRINT.drain 0.22/s). */
  cost: 0.2,
  /** Seconds after a slide before another stamina move. */
  cooldown: 0.5,
  /** Starting speed, × the sprint. */
  boost: 1.1,
  /** Slowing on the flat (m/s²): 8.6 → 2.6 m/s in 0.75 s. */
  decel: 8,
  /** The share of gravity along a slope that speeds it up (downhill) or slows it (uphill). */
  slope: 0.5,
  /** Steepest grade (rise over run) the slope term takes. */
  maxGrade: 0.6,
  /** Ends below this speed (× walking pace)... */
  endSpeed: 0.5,
  /** ...or after this many seconds, downhill included. */
  maxSeconds: 1.1,
  /** How much of the crouch walk's own steering is kept while sliding. */
  control: 0.25,
  /** Moving less than this share of the slide's speed (a wall in the way) ends it. */
  blocked: 0.35,
} as const;

/** Every stamina move. The dodge-step and combat roll go here (cost and cooldown) when they come. */
export const STAMINA_MOVES: { readonly slide: StaminaMove } = { slide: SLIDE };

/** Can a stamina move start: enough stamina (character stats `staminaScale` stretch it as they stretch a sprint), not winded, no cooldown left? */
export function canStartMove(move: StaminaMove, stamina: number, winded: boolean, cooldown: number, staminaScale = 1): boolean {
  return !winded && cooldown <= 0 && stamina >= move.cost / staminaScale;
}

/**
 * The lean (peek): Q/E-style, held. `steps` ticks to lean all the way (0.17 s); the upper body rolls about the hips by
 * up to `angle` and shifts by `shift` at the hips, so the eye moves about 0.33 m out standing (0.24 m crouched). Never
 * into a wall: the lean stops `margin` short of one.
 */
export const LEAN = {
  steps: 10,
  /** Roll of the upper body at a full lean (rad, about 17°). */
  angle: 0.3,
  /** Sideways shift of the whole upper body at a full lean (m at a 1.8 m body). */
  shift: 0.12,
  /** The head keeps this far from a wall (m). */
  margin: 0.2,
} as const;

/** Which way the lean buttons ask for: -1 left, 1 right, 0 neither (or both). */
export function leanWanted(buttons: number): -1 | 0 | 1 {
  const l = (buttons & BUTTON_LEAN_LEFT) !== 0;
  const r = (buttons & BUTTON_LEAN_RIGHT) !== 0;
  return l === r ? 0 : l ? -1 : 1;
}

/** The hips' height, the pivot the upper body rolls about (unscaled metres at a 1.8 m body): half the stance's height. */
export const leanPivot = (stance: Stance): number => STANCES[stance].height * 0.5;

/**
 * How a lean of `lean` steps (-LEAN.steps..LEAN.steps, + right) moves a point `height` metres up the body (unscaled,
 * above the feet) in a body of size `scale`: `side` along the body's right and `down`, in world metres. Points below
 * the hips don't move (the legs stay put).
 */
export function leanShift(lean: number, stance: Stance, height: number, scale = 1): { side: number; down: number } {
  if (!lean) return { side: 0, down: 0 };
  const f = Math.max(-1, Math.min(1, lean / LEAN.steps));
  const arm = Math.max(0, height - leanPivot(stance));
  const a = LEAN.angle * f;
  return { side: (LEAN.shift * f + arm * Math.sin(a)) * scale, down: arm * (1 - Math.cos(a)) * scale };
}

/** The eye of a body standing at `feet`, facing `yaw`, in `stance`, leaning `lean` steps. */
export function eyePoint(feet: Vec3, yaw: number, stance: Stance, lean: number, scale = 1): Vec3 {
  const eye = STANCES[stance].eye;
  if (!lean) return { x: feet.x, y: feet.y + eye * scale, z: feet.z };
  const s = leanShift(lean, stance, eye, scale);
  // The body's right: (cos yaw, 0, -sin yaw) (forward is (sin yaw, 0, cos yaw)).
  return { x: feet.x + Math.cos(yaw) * s.side, y: feet.y + eye * scale - s.down, z: feet.z - Math.sin(yaw) * s.side };
}

/**
 * One tick of the lean: toward what the buttons ask (`allowed` false: back upright), a step a tick, never so far that
 * the head would pass within LEAN.margin of a wall (a ray from the upright eye out to that side; a wall that comes
 * closer pulls the lean in at once). Rays only while leaning or asked to.
 */
export function stepLean(physics: PhysicsWorld, feet: Vec3, yaw: number, stance: Stance, lean: number, buttons: number, allowed: boolean, scale = 1): number {
  const want = allowed ? leanWanted(buttons) : 0;
  if (!want && !lean) return 0;
  let reach: number = LEAN.steps;
  const side = want || Math.sign(lean);
  const full = leanShift(LEAN.steps, stance, STANCES[stance].eye, scale).side;
  if (full > 0) {
    const eye = { x: feet.x, y: feet.y + STANCES[stance].eye * scale, z: feet.z };
    const dir = { x: Math.cos(yaw) * side, y: 0, z: -Math.sin(yaw) * side };
    const margin = LEAN.margin * scale;
    const hit = physics.moveRay(eye, dir, full + margin);
    if (hit !== null) reach = Math.max(0, Math.floor((LEAN.steps * (hit - margin)) / full));
  }
  const target = want * reach;
  // Pulled in at once when a wall leaves less room than the lean has; otherwise a step a tick.
  if (Math.sign(lean) === side && Math.abs(lean) > reach) return side * reach;
  return lean + Math.sign(target - lean);
}
