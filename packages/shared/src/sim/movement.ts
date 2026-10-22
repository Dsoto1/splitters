import type RAPIER from '@dimforge/rapier3d-compat';
import type { Vec3 } from '../math.ts';
import { PLAYER, TICK_DT, quantize } from './constants.ts';
import type { PhysicsWorld } from './physics.ts';

export const BUTTON_JUMP = 1;
export const BUTTON_FIRE = 2;
export const BUTTON_RELOAD = 4;
export const BUTTON_ZOOM = 8;
const ALL_BUTTONS = BUTTON_JUMP | BUTTON_FIRE | BUTTON_RELOAD | BUTTON_ZOOM;

/** One tick of player intent. Humans and Player Bots produce exactly the same structure. */
export interface PlayerInput {
  seq: number;
  /** -1..1 forward/back. */
  forward: number;
  /** -1..1 strafe right/left. */
  right: number;
  yaw: number;
  pitch: number;
  buttons: number;
  /** Weapon slot the player wants held (0 = keep current). */
  weapon?: number;
  /** Server tick the player was looking at when this input was made (lag compensation). */
  viewTick?: number;
}

export interface MoveState {
  /** Feet position. */
  pos: Vec3;
  velY: number;
  grounded: boolean;
}

export const emptyInput = (seq = 0): PlayerInput => ({ seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 });

/** Clamp untrusted input to legal ranges. */
export function sanitizeInput(i: PlayerInput): PlayerInput {
  const finite = (v: number, d = 0) => (Number.isFinite(v) ? v : d);
  const clamp1 = (v: number) => Math.max(-1, Math.min(1, finite(v)));
  return {
    seq: Math.trunc(finite(i.seq)),
    forward: clamp1(i.forward),
    right: clamp1(i.right),
    yaw: finite(i.yaw) % (Math.PI * 2),
    pitch: Math.max(-1.55, Math.min(1.55, finite(i.pitch))),
    buttons: Math.trunc(finite(i.buttons)) & ALL_BUTTONS,
    weapon: Math.max(0, Math.min(9, Math.trunc(finite(i.weapon ?? 0)))),
    viewTick: Math.max(0, Math.trunc(finite(i.viewTick ?? 0))),
  };
}

/**
 * Advance one player by one fixed tick. Pure apart from moving the collider;
 * output is quantised so a client replaying the same inputs from a server
 * snapshot reproduces the server result exactly.
 */
export function stepMovement(physics: PhysicsWorld, collider: RAPIER.Collider, state: MoveState, input: PlayerInput, speedScale = 1, dt: number = TICK_DT): MoveState {
  // Horizontal wish velocity in the yaw frame (see viewDirection for axes).
  const sin = Math.sin(input.yaw);
  const cos = Math.cos(input.yaw);
  let wx = sin * input.forward + cos * input.right;
  let wz = cos * input.forward - sin * input.right;
  const wl = Math.hypot(wx, wz);
  if (wl > 1) {
    wx /= wl;
    wz /= wl;
  }
  wx *= PLAYER.runSpeed * speedScale;
  wz *= PLAYER.runSpeed * speedScale;

  let velY = state.velY;
  if (state.grounded && input.buttons & BUTTON_JUMP) velY = PLAYER.jumpSpeed;
  velY -= PLAYER.gravity * dt;

  const desiredY = velY * dt;
  const moved = physics.moveCharacter(collider, state.pos, { x: wx * dt, y: desiredY, z: wz * dt });
  let grounded = moved.grounded;
  if (grounded && velY < 0) velY = 0;
  // Bumped a ceiling while rising.
  if (velY > 0 && moved.movedY < desiredY - 1e-4) velY = 0;
  if (velY > 0) grounded = false;

  return {
    pos: { x: quantize(moved.feet.x), y: quantize(moved.feet.y), z: quantize(moved.feet.z) },
    velY: quantize(velY),
    grounded,
  };
}
