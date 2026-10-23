import type RAPIER from '@dimforge/rapier3d-compat';
import type { Vec3 } from '../math.ts';
import { PLAYER, TICK_DT, quantize } from './constants.ts';
import type { PhysicsWorld } from './physics.ts';

export const BUTTON_JUMP = 1;
export const BUTTON_FIRE = 2;
export const BUTTON_RELOAD = 4;
export const BUTTON_ZOOM = 8;
/** Use / interact (E): press buttons, open manual doors. Sent once per key press. */
export const BUTTON_USE = 16;
/** Second trigger (right mouse on weapons that have one). */
export const BUTTON_ALT = 32;
/** Throw the carried grenade or mine (G). */
export const BUTTON_THROW = 64;
const ALL_BUTTONS = BUTTON_JUMP | BUTTON_FIRE | BUTTON_RELOAD | BUTTON_ZOOM | BUTTON_USE | BUTTON_ALT | BUTTON_THROW;

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
  /** Weapon code (see weaponCode) the player wants held (0 = keep current). */
  weapon?: number;
  /** Server tick the player was looking at when this input was made (lag compensation). */
  viewTick?: number;
}

export interface MoveState {
  /** Feet position. */
  pos: Vec3;
  velY: number;
  grounded: boolean;
  /**
   * Push velocity on top of running (m/s): knockback, jump pads and sliding
   * on oil. It dies away quickly on the ground and slowly in the air.
   */
  vx?: number;
  vz?: number;
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
    weapon: Math.max(0, Math.min(255, Math.trunc(finite(i.weapon ?? 0)))),
    viewTick: Math.max(0, Math.trunc(finite(i.viewTick ?? 0))),
  };
}

/**
 * Advance one player by one fixed tick. Pure apart from moving the collider;
 * output is quantised so a client replaying the same inputs from a server
 * snapshot reproduces the server result exactly.
 */
export function stepMovement(physics: PhysicsWorld, collider: RAPIER.Collider, state: MoveState, input: PlayerInput, speedScale = 1, dt: number = TICK_DT, traction = 1): MoveState {
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

  // Push velocity. On a slick surface (traction < 1) running feeds momentum instead of moving you directly, so you slide.
  let vx = state.vx ?? 0;
  let vz = state.vz ?? 0;
  if (traction < 1 && state.grounded) {
    vx += wx * (1 - traction) * 0.07;
    vz += wz * (1 - traction) * 0.07;
    wx *= traction;
    wz *= traction;
  }

  let velY = state.velY;
  if (state.grounded && input.buttons & BUTTON_JUMP) velY = PLAYER.jumpSpeed;
  velY -= PLAYER.gravity * dt;

  const desiredY = velY * dt;
  const moved = physics.moveCharacter(collider, state.pos, { x: (wx + vx) * dt, y: desiredY, z: (wz + vz) * dt });
  let grounded = moved.grounded;
  if (grounded && velY < 0) velY = 0;
  // Bumped a ceiling while rising.
  if (velY > 0 && moved.movedY < desiredY - 1e-4) velY = 0;
  if (velY > 0) grounded = false;

  const decay = grounded ? (traction < 1 ? 0.975 : 0.86) : 0.99;
  vx = Math.abs(vx * decay) < 0.02 ? 0 : quantize(vx * decay);
  vz = Math.abs(vz * decay) < 0.02 ? 0 : quantize(vz * decay);
  return {
    pos: { x: quantize(moved.feet.x), y: quantize(moved.feet.y), z: quantize(moved.feet.z) },
    velY: quantize(velY),
    grounded,
    ...(vx || vz ? { vx, vz } : {}),
  };
}

/** A jump pad as movement sees it. */
export interface JumpPad {
  pos: Vec3;
  /** Launch velocity: up, and along the pad's facing. */
  vy: number;
  vx: number;
  vz: number;
}

export const PAD_RADIUS = 1.1;

/** The jump pads of a map (shared by the server and client prediction so both launch the same). */
export function mapPads(entities: readonly { kind: string; position: [number, number, number]; yaw?: number; power?: number; push?: number }[]): JumpPad[] {
  return entities
    .filter((e) => e.kind === 'pad')
    .map((e) => ({ pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, vy: e.power ?? 14, vx: Math.sin(e.yaw ?? 0) * (e.push ?? 6), vz: Math.cos(e.yaw ?? 0) * (e.push ?? 6) }));
}

/** Launch off a pad you are standing on (after moving). */
export function applyPads(pads: readonly JumpPad[], state: MoveState): MoveState {
  if (!pads.length || !state.grounded) return state;
  for (const p of pads) {
    if (Math.hypot(state.pos.x - p.pos.x, state.pos.z - p.pos.z) > PAD_RADIUS || Math.abs(state.pos.y - p.pos.y) > 0.6) continue;
    return { ...state, velY: p.vy, grounded: false, ...(p.vx || p.vz ? { vx: quantize(p.vx), vz: quantize(p.vz) } : {}) };
  }
  return state;
}
