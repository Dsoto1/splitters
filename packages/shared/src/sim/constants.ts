/** Architectural maximum (MASTER_SPEC_V2 §3.4). Never hard-code a smaller structural limit. */
export const MAX_PLAYER_SLOTS = 32;

export const TICK_RATE = 60;
export const TICK_DT = 1 / TICK_RATE;
/** Server sends a snapshot every N ticks (30 Hz at 60 Hz simulation). */
export const SNAPSHOT_INTERVAL_TICKS = 2;

export const PLAYER = {
  radius: 0.4,
  height: 1.8,
  eyeHeight: 1.6,
  /** Walking pace; sprinting is faster (SPRINT), crouching and prone slower (STANCES). */
  runSpeed: 5.2,
  jumpSpeed: 7,
  gravity: 20,
  maxStepHeight: 0.3,
  maxSlopeDegrees: 50,
  maxHealth: 100,
  /** Falling below this height kills the player. */
  killY: -40,
} as const;

/** Standing, crouching and prone: body height, eye height and speed (× runSpeed). */
/**
 * Character sizes. Small: a smaller, quicker target that fits through gaps
 * others must crouch for, with less health. Large: a bigger, slower target
 * that must crouch under some openings, with more health. `scale` sizes the
 * body (height, width, eyes); match setting `bodySizes: false` makes everyone standard.
 */
export type BodySize = 'small' | 'standard' | 'large';
export const BODY_SIZES: Record<BodySize, { scale: number; speed: number; health: number; label: string }> = {
  small: { scale: 0.78, speed: 1.06, health: 85, label: 'Small' },
  standard: { scale: 1, speed: 1, health: 100, label: 'Standard' },
  large: { scale: 1.18, speed: 0.94, health: 115, label: 'Large' },
};

export const STANCES = [
  { height: 1.8, eye: 1.6, speed: 1 },
  { height: 1.2, eye: 1.02, speed: 0.48 },
  { height: 0.8, eye: 0.42, speed: 0.22 },
] as const;
export type Stance = 0 | 1 | 2;

/** Sprinting: faster forward running that drains stamina (1 = full), which comes back after a short rest. */
export const SPRINT = {
  speed: 1.5,
  /** Stamina used and recovered per second. */
  drain: 0.22,
  regen: 0.3,
  /** Seconds without sprinting before stamina starts coming back. */
  rest: 0.8,
  /** Run dry and you can't sprint again until it's back to this. */
  restart: 0.25,
} as const;

/** Positions/velocities are quantised to this step on the server so clients can replay predicted input exactly. */
export const STATE_QUANTUM = 1000;
export const quantize = (v: number): number => Math.round(v * STATE_QUANTUM) / STATE_QUANTUM;
