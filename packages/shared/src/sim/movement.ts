import type RAPIER from '@dimforge/rapier3d-compat';
import type { Vec3 } from '../math.ts';
import { PLAYER, SPRINT, STANCES, TICK_DT, quantize, type Stance } from './constants.ts';
import type { PhysicsWorld } from './physics.ts';
import { JET, LIQUID_SPECS, SWIM_DEPTH, liquidAt, type LiquidBox } from './liquids.ts';

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
/** Sprint while held (Shift): faster forward running that uses stamina. */
export const BUTTON_SPRINT = 128;
/** Wants to crouch / lie prone (held state; the client turns toggle keys into it). */
export const BUTTON_CROUCH = 256;
export const BUTTON_PRONE = 512;
/** Walking speed while aiming down the sights. */
export const ADS_SPEED = 0.75;
/** Ask to respawn now (stuck somewhere): you die where you stand and come back as usual. Counts as a suicide. */
export const BUTTON_RESPAWN = 1024;
const ALL_BUTTONS = BUTTON_JUMP | BUTTON_FIRE | BUTTON_RELOAD | BUTTON_ZOOM | BUTTON_USE | BUTTON_ALT | BUTTON_THROW | BUTTON_SPRINT | BUTTON_CROUCH | BUTTON_PRONE | BUTTON_RESPAWN;

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
  /** A quick message (1-QUICK_MESSAGES.length) or emote (EMOTE_DANCE) sent with this input. */
  say?: number;
}

/** Quick messages players can send (keys 1-6 while the quick-message menu is open). */
export const QUICK_MESSAGES = ['Follow me!', 'Need backup!', 'Enemy spotted!', 'On my way!', 'Thanks!', 'Nice shot!'] as const;
/** `say` value for the dance emote. */
export const EMOTE_DANCE = 100;

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
  /** The jetpack fired this tick (for fuel and the flame). */
  jet?: boolean;
  /** Swimming this tick. */
  swim?: boolean;
  /** Crouching (1) or prone (2); absent when standing. */
  stance?: 1 | 2;
  /** Stamina 0..1 (absent = full), ticks left before it starts recovering, and whether you're sprinting. */
  stamina?: number;
  rest?: number;
  sprint?: boolean;
  /** Ran dry: no sprinting until stamina is back to SPRINT.restart. */
  winded?: boolean;
  /** On a ladder this tick. */
  climb?: boolean;
}

/** Current stance of a move state. */
export const stanceOf = (s: MoveState): Stance => s.stance ?? 0;
/** Eye height above the feet in this state. */
export const eyeHeightOf = (s: MoveState, scale = 1): number => STANCES[stanceOf(s)].eye * scale;
/** Body (capsule) height in this state. */
export const bodyHeightOf = (s: MoveState, scale = 1): number => STANCES[stanceOf(s)].height * scale;

/** What else shapes a step: liquids to swim or wade in, and whether a jetpack has fuel. */
export interface MoveEnv {
  liquids?: readonly LiquidBox[];
  jet?: boolean;
  ladders?: readonly Ladder[];
  /** Body size (BODY_SIZES scale): heights, width and eyes scale with it. */
  scale?: number;
}

/** A ladder as movement sees it: its foot against the wall, facing out from the wall, how tall and wide. */
export interface Ladder {
  pos: Vec3;
  yaw: number;
  height: number;
  width: number;
}

/** Climbing speed on a ladder (m/s). */
export const CLIMB_SPEED = 3.2;

/** The ladders of a map (shared by the server and client prediction). */
export function mapLadders(entities: readonly { kind: string; position: [number, number, number]; yaw?: number; height?: number; width?: number }[]): Ladder[] {
  return entities.filter((e) => e.kind === 'ladder').map((e) => ({ pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, yaw: e.yaw ?? 0, height: e.height ?? 4, width: e.width ?? 0.9 }));
}

/** The ladder a player standing at `feet` is on (within reach of its face), if any. */
export function ladderAt(ladders: readonly Ladder[], feet: Vec3): Ladder | null {
  for (const l of ladders) {
    const fx = Math.sin(l.yaw);
    const fz = Math.cos(l.yaw);
    const dx = feet.x - l.pos.x;
    const dz = feet.z - l.pos.z;
    const out = dx * fx + dz * fz;
    const side = dx * fz - dz * fx;
    if (out < -0.3 || out > 0.75 || Math.abs(side) > l.width / 2 + 0.2) continue;
    if (feet.y < l.pos.y - 0.2 || feet.y > l.pos.y + l.height + 0.5) continue;
    return l;
  }
  return null;
}

/**
 * Navmesh links up and down each ladder (for bots): from just in front of
 * its foot to the floor at its top, and back.
 */
export function ladderLinks(ladders: readonly Ladder[]): { start: Vec3; end: Vec3 }[] {
  return ladders.flatMap((l) => {
    const fx = Math.sin(l.yaw);
    const fz = Math.cos(l.yaw);
    const bottom = { x: l.pos.x + fx * 0.7, y: l.pos.y, z: l.pos.z + fz * 0.7 };
    const top = { x: l.pos.x - fx * 0.9, y: l.pos.y + l.height, z: l.pos.z - fz * 0.9 };
    return [{ start: bottom, end: top }, { start: top, end: bottom }];
  });
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
    ...(i.say ? { say: Math.max(0, Math.min(255, Math.trunc(finite(i.say)))) } : {}),
    viewTick: Math.max(0, Math.trunc(finite(i.viewTick ?? 0))),
  };
}

/**
 * Advance one player by one fixed tick. Pure apart from moving the collider;
 * output is quantised so a client replaying the same inputs from a server
 * snapshot reproduces the server result exactly.
 */
export function stepMovement(physics: PhysicsWorld, collider: RAPIER.Collider, state: MoveState, input: PlayerInput, speedScale = 1, dt: number = TICK_DT, traction = 1, env: MoveEnv = {}): MoveState {
  // Stance: what you ask for, unless there's no room to stand (or crouch) up. Jumping gets you up first.
  let jumpPressed = (input.buttons & BUTTON_JUMP) !== 0;
  const k = env.scale ?? 1;
  const radius = PLAYER.radius * k;
  const was = stanceOf(state);
  let want: Stance = input.buttons & BUTTON_PRONE ? 2 : input.buttons & BUTTON_CROUCH ? 1 : 0;
  if (jumpPressed && was > 0) {
    want = 0;
    jumpPressed = false;
  }
  if (want === 2 && !state.grounded) want = was === 2 ? 2 : 1;
  let stance: Stance = was;
  if (want > was) {
    stance = want;
    // Crouching in the air tucks your legs up (your head stays where it was): jump, then
    // crouch, and you clear a window sill or a crate you couldn't jump onto standing.
    if (!state.grounded && was === 0 && want === 1) {
      const tucked = { ...state.pos, y: state.pos.y + (STANCES[0].height - STANCES[1].height) * k };
      if (physics.headroom(tucked, STANCES[1].height * k, radius)) state = { ...state, pos: tucked };
    }
  } else if (want < was) {
    // Rise as far as the headroom allows; in the air, standing up drops your legs back down.
    for (let s = want; s < was; s++) {
      const drop = !state.grounded && was === 1 && s === 0 ? (STANCES[0].height - STANCES[1].height) * k : 0;
      const feet = drop ? { ...state.pos, y: state.pos.y - drop } : state.pos;
      if (physics.headroom(feet, STANCES[s].height * k, radius)) {
        stance = s as Stance;
        if (drop) state = { ...state, pos: feet };
        break;
      }
    }
  }
  // Sprint: forward, standing, not shooting, while stamina lasts.
  let stamina = state.stamina ?? 1;
  let rest = state.rest ?? 0;
  let winded = state.winded ?? false;
  // Aiming down the sights (or through a scope): no sprinting, and you walk at 75%.
  const aiming = (input.buttons & BUTTON_ZOOM) !== 0;
  const sprint = !aiming && (input.buttons & BUTTON_SPRINT) !== 0 && (input.buttons & BUTTON_FIRE) === 0 && input.forward > 0.3 && stance === 0 && !winded && stamina > 0;
  if (sprint) {
    // Quantised here (not just on output) so running dry is seen the same on server and client.
    stamina = quantize(Math.max(0, stamina - SPRINT.drain * dt));
    rest = Math.round(SPRINT.rest / dt);
    if (stamina === 0) winded = true;
  } else if (rest > 0) rest--;
  else stamina = quantize(Math.min(1, stamina + SPRINT.regen * dt));
  if (winded && stamina >= SPRINT.restart) winded = false;
  speedScale *= STANCES[stance].speed * (sprint ? SPRINT.speed : 1) * (aiming ? ADS_SPEED : 1);

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
  // In liquid: swimming once it's up to your chest, wading before that.
  const chest = env.liquids?.length ? liquidAt(env.liquids, { x: state.pos.x, y: state.pos.y + SWIM_DEPTH, z: state.pos.z }) : null;
  const feet = chest ?? (env.liquids?.length ? liquidAt(env.liquids, { x: state.pos.x, y: state.pos.y + 0.1, z: state.pos.z }) : null);
  const wet = chest ? LIQUID_SPECS[chest.liquid].swim : feet ? LIQUID_SPECS[feet.liquid].wade : 1;
  wx *= PLAYER.runSpeed * speedScale * wet;
  wz *= PLAYER.runSpeed * speedScale * wet;

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
  const jump = jumpPressed;
  let jet = false;
  const ladder = !chest && env.ladders?.length ? ladderAt(env.ladders, state.pos) : null;
  if (ladder) {
    // On a ladder: walking into it climbs (looking well down, or backing off, climbs down), no gravity,
    // a little sideways movement, and jump lets go, pushing you off it.
    const fx = Math.sin(ladder.yaw);
    const fz = Math.cos(ladder.yaw);
    const facing = -(sin * fx + cos * fz);
    const top = ladder.pos.y + ladder.height;
    let climb = 0;
    if (input.forward > 0.3) climb = facing > -0.2 && input.pitch > -0.6 ? 1 : -1;
    else if (input.forward < -0.3) climb = -1;
    if (jump) {
      velY = 4.5;
      vx = quantize(fx * 3);
      vz = quantize(fz * 3);
    } else {
      velY = climb * CLIMB_SPEED;
      if (state.grounded && climb < 0) velY = 0;
      // Only sideways movement on the rungs, unless stepping off at the top or the bottom.
      const lateral = (wx * fz - wz * fx) * 0.5;
      const atTop = state.pos.y > top - 0.15 && climb > 0;
      const offBottom = state.grounded && climb < 0;
      if (!offBottom) {
        wx = lateral * fz + (atTop ? -fx * 2 : 0);
        wz = -lateral * fx + (atTop ? -fz * 2 : 0);
      }
    }
  } else if (chest) {
    // Swimming: you sink slowly, water drags, jump swims up; near the surface it hops you out.
    velY -= PLAYER.gravity * 0.15 * dt;
    velY *= Math.pow(0.9, dt * 60);
    if (jump) velY = state.pos.y + SWIM_DEPTH + 0.35 > chest.max.y ? Math.max(velY, 4.6) : Math.min(velY + 14 * dt, 3.2);
  } else {
    if (state.grounded && jump) velY = PLAYER.jumpSpeed;
    else if (jump && env.jet && !state.grounded) {
      // Jetpack: thrust while jump is held in the air.
      velY = Math.min(velY + (JET.accel + PLAYER.gravity) * dt, Math.max(velY, JET.maxUp));
      jet = true;
    }
    velY -= PLAYER.gravity * dt;
  }

  const desiredY = velY * dt;
  const moved = physics.moveCharacter(collider, state.pos, { x: (wx + vx) * dt, y: desiredY, z: (wz + vz) * dt }, STANCES[stance].height * k, radius);
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
    ...(jet ? { jet } : {}),
    ...(chest ? { swim: true } : {}),
    ...(stance ? { stance } : {}),
    ...(stamina < 1 ? { stamina: quantize(stamina) } : {}),
    ...(rest ? { rest } : {}),
    ...(sprint ? { sprint } : {}),
    ...(winded ? { winded } : {}),
    ...(ladder && !jump ? { climb: true } : {}),
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

/**
 * Where each pad's launch comes down (for bots: the navmesh gets a one-way
 * link from the pad to its landing). Traces the flight with gravity and
 * returns the first floor hit on the way down; pads that never land are left out.
 */
export function padLandings(pads: readonly JumpPad[], physics: PhysicsWorld): { start: Vec3; end: Vec3 }[] {
  const out: { start: Vec3; end: Vec3 }[] = [];
  for (const p of pads) {
    let pos = { x: p.pos.x, y: p.pos.y + 0.9, z: p.pos.z };
    let vy = p.vy;
    for (let t = 0; t < 6; t += TICK_DT) {
      const next = { x: pos.x + p.vx * TICK_DT, y: pos.y + vy * TICK_DT, z: pos.z + p.vz * TICK_DT };
      vy -= PLAYER.gravity * TICK_DT;
      if (vy < 0) {
        const down = physics.raycastWorld({ x: next.x, y: next.y, z: next.z }, { x: 0, y: -1, z: 0 }, 1.0 + Math.abs(vy * TICK_DT));
        if (down !== null) {
          out.push({ start: { ...p.pos }, end: { x: next.x, y: next.y - down, z: next.z } });
          break;
        }
      }
      pos = next;
    }
  }
  return out;
}

/** Every one-way navmesh link a map needs for bots: jump pad flights and ladders up and down. */
export function navLinks(entities: Parameters<typeof mapPads>[0] & Parameters<typeof mapLadders>[0], physics: PhysicsWorld): { start: Vec3; end: Vec3 }[] {
  return [...padLandings(mapPads(entities), physics), ...ladderLinks(mapLadders(entities))];
}
