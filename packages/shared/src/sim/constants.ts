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
  runSpeed: 7,
  jumpSpeed: 7,
  gravity: 20,
  maxStepHeight: 0.3,
  maxSlopeDegrees: 50,
  maxHealth: 100,
  /** Falling below this height kills the player. */
  killY: -40,
} as const;

/** Positions/velocities are quantised to this step on the server so clients can replay predicted input exactly. */
export const STATE_QUANTUM = 1000;
export const quantize = (v: number): number => Math.round(v * STATE_QUANTUM) / STATE_QUANTUM;
