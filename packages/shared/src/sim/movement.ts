import type RAPIER from '@dimforge/rapier3d-compat';
import type { Vec3 } from '../math.ts';
import { PLAYER, SPRINT, STANCES, TICK_DT, quantize, type Stance } from './constants.ts';
import type { GroundHeight, PhysicsWorld } from './physics.ts';
import { JET, LIQUID_SPECS, SWIM_DEPTH, liquidAt, type LiquidBox } from './liquids.ts';
import { mapPortals, portalLinks } from './portals.ts';
import { passageLinks } from './passages.ts';
import { CHUTE_GLIDER, CHUTE_PARACHUTE, chuteVelY, chuteWish, wantsChute, type ChuteKind } from './parachute.ts';
import { grabZipline, rideZipline, startRide, ziplineLinks, mapZiplines, type Zipline } from './zipline.ts';
import { hypot } from '../math.ts';
import { SLIDE, canStartMove, stepLean } from './moves.ts';

// The buttons, the input and the quick messages live in inputs.ts (the menu reads them without the movement code).
import { BUTTON_JUMP, BUTTON_FIRE, BUTTON_RELOAD, BUTTON_ZOOM, BUTTON_USE, BUTTON_ALT, BUTTON_THROW, BUTTON_SPRINT, BUTTON_CROUCH, BUTTON_PRONE, ADS_SPEED, BUTTON_RESPAWN, BUTTON_MELEE, BUTTON_STEER_LOOK, BUTTON_THIRD_PERSON, BUTTON_AUTO_RELOAD, BUTTON_USE_HOLD, BUTTON_LEAN_LEFT, BUTTON_LEAN_RIGHT, QUICK_MESSAGES, SAY_FOLLOW, SAY_HOLD, PING, EMOTE_DANCE, ALL_BUTTONS, type PlayerInput } from './inputs.ts';
export { BUTTON_JUMP, BUTTON_FIRE, BUTTON_RELOAD, BUTTON_ZOOM, BUTTON_USE, BUTTON_ALT, BUTTON_THROW, BUTTON_SPRINT, BUTTON_CROUCH, BUTTON_PRONE, ADS_SPEED, BUTTON_RESPAWN, BUTTON_MELEE, BUTTON_STEER_LOOK, BUTTON_THIRD_PERSON, BUTTON_AUTO_RELOAD, BUTTON_USE_HOLD, BUTTON_LEAN_LEFT, BUTTON_LEAN_RIGHT, QUICK_MESSAGES, SAY_FOLLOW, SAY_HOLD, PING, EMOTE_DANCE, type PlayerInput };

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
  /** Double jumps (MoveEnv.airJumps): jumps made since leaving the ground, and whether jump was held last tick. */
  airJumps?: number;
  jumpHeld?: boolean;
  /** Under an open canopy: parachute (1) or glider (2); see parachute.ts. */
  chute?: ChuteKind;
  /** Jumped out of something high (the plane, a flyer): the automatic opener is armed until you land. */
  drop?: boolean;
  /**
   * Riding a zipline (zipline.ts): the line (index in mapZiplines), how far
   * along it from its start (m) and the signed speed along it (m/s, + toward
   * its end). All three or none.
   */
  zip?: number;
  zs?: number;
  zv?: number;
  /**
   * Sliding (sim/moves.ts SLIDE): ticks since it started (absent when not). The slide's momentum is the push velocity
   * (`vx`, `vz`), which the slide slows itself instead of the ground's quick decay.
   */
  slide?: number;
  /** Ticks left before another stamina move (slide; later the dodge-step and roll) may start. */
  moveCd?: number;
  /** Leaning (peek): steps, -LEAN.steps (full left) .. LEAN.steps (full right); absent upright (sim/moves.ts). */
  lean?: number;
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
  /** Gravity multiple (map / match setting); 1 = normal. */
  gravity?: number;
  /** Low-gravity zones (map zones with `gravity`): inside one, gravity is further multiplied by its factor. */
  gravityZones?: readonly GravityZone[];
  /** Extra jumps in the air (a fresh press of jump each), e.g. 1 for a double jump (Classes). */
  airJumps?: number;
  /** Wearing a jetpack (fuel or not): jump is its thrust, so it never pulls the parachute's cord. */
  jetpack?: boolean;
  /** Carrying a glider: the canopy that opens is a glider instead of a parachute. */
  glider?: boolean;
  /** Always open a canopy before a long fall, and never cut it away (bots). */
  autoChute?: boolean;
  /** Coarse move over the terrain (bots no player is near): see PhysicsWorld.moveCharacter. */
  ground?: GroundHeight;
  /** The map's ziplines (mapZiplines): E grabs one within reach. */
  ziplines?: readonly Zipline[];
  /** Your team or faction (team-only ziplines). */
  team?: string | null;
  /** Character stats (sim/characterStats.ts): jump speed and how long stamina lasts, multiples of everyone's. */
  jump?: number;
  /**
   * The held weapon's running speed (gunplayOf(def).handling.move; spec §27): a multiple of walking and running, not
   * of sprinting (a sprint is as fast with every weapon). Absent: 1.
   */
  weaponMove?: number;
  stamina?: number;
}

/** A zone that changes gravity inside it (an axis-aligned box from `min` to `max`), as movement sees it. */
export interface GravityZone {
  min: Vec3;
  max: Vec3;
  /** Multiplies the map's gravity inside (0.35: floaty; 2: heavy). */
  factor: number;
}

/** The gravity zones of a map (shared by the server and client prediction): zones with a `gravity` factor. */
export function mapGravityZones(entities: readonly { kind: string; position: [number, number, number]; size?: unknown; gravity?: number }[]): GravityZone[] {
  const out: GravityZone[] = [];
  for (const e of entities) {
    if (e.kind !== 'zone' || e.gravity === undefined || e.gravity === 1 || !Array.isArray(e.size)) continue;
    const [x, y, z] = e.position;
    const [w, h, d] = e.size as [number, number, number];
    out.push({ min: { x: x - w / 2, y, z: z - d / 2 }, max: { x: x + w / 2, y: y + h, z: z + d / 2 }, factor: e.gravity });
  }
  return out;
}

/**
 * Gravity multiple at a point (feet position): the factor of the gravity zone
 * the body is in (its middle, so stepping in from below or above counts), or
 * 1. Where zones overlap the weakest gravity wins.
 */
export function gravityAt(zones: readonly GravityZone[] | undefined, feet: Vec3): number {
  if (!zones?.length) return 1;
  const y = feet.y + 0.9;
  let g = 1;
  let found = false;
  for (const z of zones) {
    if (feet.x < z.min.x || feet.x > z.max.x || feet.z < z.min.z || feet.z > z.max.z || y < z.min.y || y > z.max.y) continue;
    g = found ? Math.min(g, z.factor) : z.factor;
    found = true;
  }
  return g;
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
    ...(i.fireMode !== undefined ? { fireMode: Math.max(0, Math.min(3, Math.trunc(finite(i.fireMode)))) } : {}),
    ...(i.build ? { build: Math.max(0, Math.min(63, Math.trunc(finite(i.build)))) } : {}),
    ...(Array.isArray(i.rc) ? { rc: [Math.max(-0.5, Math.min(0.5, finite(i.rc[0]))), Math.max(-0.5, Math.min(0.5, finite(i.rc[1])))] as [number, number] } : {}),
  };
}

/**
 * Advance one player by one fixed tick. Pure apart from moving the collider;
 * output is quantised so a client replaying the same inputs from a server
 * snapshot reproduces the server result exactly.
 */
export function stepMovement(physics: PhysicsWorld, collider: RAPIER.Collider, state: MoveState, input: PlayerInput, speedScale = 1, dt: number = TICK_DT, traction = 1, env: MoveEnv = {}): MoveState {
  // On a zipline: the line carries you; jump or E lets go (zipline.ts). E within reach of one grabs it.
  if (state.zip !== undefined) return rideZipline(physics, env.ziplines ?? [], state, (input.buttons & (BUTTON_JUMP | BUTTON_USE)) !== 0, (input.buttons & BUTTON_JUMP) !== 0, dt, env.scale ?? 1, env.gravity ?? 1);
  if (input.buttons & BUTTON_USE && env.ziplines?.length) {
    const grab = grabZipline(env.ziplines, state.pos, input.yaw, env.team);
    if (grab) return rideZipline(physics, env.ziplines, startRide(env.ziplines, state, grab), false, false, dt, env.scale ?? 1, env.gravity ?? 1);
  }
  const baseSpeed = speedScale;
  // Stance: what you ask for, unless there's no room to stand (or crouch) up. Jumping gets you up first.
  let jumpPressed = (input.buttons & BUTTON_JUMP) !== 0;
  const k = env.scale ?? 1;
  const g = (env.gravity ?? 1) * gravityAt(env.gravityZones, state.pos);
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
  // In liquid: swimming once it's up to your chest, wading before that. On a ladder: climbing.
  const chest = env.liquids?.length ? liquidAt(env.liquids, { x: state.pos.x, y: state.pos.y + SWIM_DEPTH, z: state.pos.z }) : null;
  const ladder = !chest && env.ladders?.length ? ladderAt(env.ladders, state.pos) : null;
  // The slide (sim/moves.ts): from a sprint, a fresh crouch on the ground starts it, if the stamina is there; it goes
  // on while crouch is held and you stay on the ground, and ends crouched.
  let moveCd = state.moveCd ?? 0;
  if (moveCd > 0) moveCd--;
  let slide = state.slide ?? 0;
  const footing = state.grounded && !chest && !ladder && !state.chute;
  const slideStart = !slide && !!state.sprint && was === 0 && want === 1 && stance === 1 && footing && canStartMove(SLIDE, stamina, winded, moveCd, env.stamina ?? 1);
  if (slide && !(want === 1 && stance === 1 && footing)) {
    slide = 0;
    moveCd = Math.round(SLIDE.cooldown / dt);
  } else if (slideStart || slide) slide++;
  // Aiming down the sights (or through a scope): no sprinting, and you walk at 75%.
  const aiming = (input.buttons & BUTTON_ZOOM) !== 0;
  const sprint = !aiming && (input.buttons & BUTTON_SPRINT) !== 0 && (input.buttons & BUTTON_FIRE) === 0 && input.forward > 0.3 && stance === 0 && !winded && stamina > 0;
  if (slideStart) {
    stamina = quantize(Math.max(0, stamina - SLIDE.cost / (env.stamina ?? 1)));
    if (stamina === 0) winded = true;
  }
  if (sprint || slide) {
    // Quantised here (not just on output) so running dry is seen the same on server and client.
    if (sprint) stamina = quantize(Math.max(0, stamina - (SPRINT.drain / (env.stamina ?? 1)) * dt));
    rest = Math.round(SPRINT.rest / dt);
    if (stamina === 0) winded = true;
  } else if (rest > 0) rest--;
  else stamina = quantize(Math.min(1, stamina + SPRINT.regen * dt));
  if (winded && stamina >= SPRINT.restart) winded = false;
  speedScale *= STANCES[stance].speed * (sprint ? SPRINT.speed : (env.weaponMove ?? 1)) * (aiming ? ADS_SPEED : 1);
  // The lean (peek): on the ground, standing or crouched, not sprinting or sliding; never into a wall (sim/moves.ts).
  const lean = stepLean(physics, state.pos, input.yaw, stance, state.lean ?? 0, input.buttons, footing && stance < 2 && !sprint && !slide, k);

  // Horizontal wish velocity in the yaw frame (see viewDirection for axes).
  const sin = Math.sin(input.yaw);
  const cos = Math.cos(input.yaw);
  let wx = sin * input.forward + cos * input.right;
  let wz = cos * input.forward - sin * input.right;
  const wl = hypot(wx, wz);
  if (wl > 1) {
    wx /= wl;
    wz /= wl;
  }
  const feet = chest ?? (env.liquids?.length ? liquidAt(env.liquids, { x: state.pos.x, y: state.pos.y + 0.1, z: state.pos.z }) : null);
  const wet = chest ? LIQUID_SPECS[chest.liquid].swim : feet ? LIQUID_SPECS[feet.liquid].wade : 1;
  wx *= PLAYER.runSpeed * speedScale * wet;
  wz *= PLAYER.runSpeed * speedScale * wet;

  // Push velocity. On a slick surface (traction < 1) running feeds momentum instead of moving you directly, so you slide.
  let vx = state.vx ?? 0;
  let vz = state.vz ?? 0;
  // Sliding: the momentum is the push; the legs only steer a little. It starts from the sprint's speed, the way you
  // were running (or facing).
  const slideFrom = slideStart ? PLAYER.runSpeed * baseSpeed * SPRINT.speed * SLIDE.boost * wet : 0;
  if (slideStart) {
    const l = hypot(wx, wz);
    vx += l > 1e-6 ? (wx / l) * slideFrom : sin * slideFrom;
    vz += l > 1e-6 ? (wz / l) * slideFrom : cos * slideFrom;
  }
  if (slide) {
    wx *= SLIDE.control;
    wz *= SLIDE.control;
  }
  if (traction < 1 && state.grounded) {
    vx += wx * (1 - traction) * 0.07;
    vz += wz * (1 - traction) * 0.07;
    wx *= traction;
    wz *= traction;
  }

  let velY = state.velY;
  const jump = jumpPressed;
  let airJumped = 0;
  let jet = false;
  // Canopy: packs up on the ground, in water or on a ladder; crouch cuts it away. Opens on jump
  // (not with a jetpack, which jump fires) or by itself when the automatic opener is armed.
  // A double jump still in hand takes a fresh press before the cord does.
  const canAirJump = !!env.airJumps && !state.jumpHeld && (state.airJumps ?? 0) < env.airJumps;
  let chute: ChuteKind | undefined = state.chute;
  let drop = !!state.drop;
  if (state.grounded || chest || ladder) {
    chute = undefined;
    drop = false;
  } else if (chute && input.buttons & BUTTON_CROUCH && !env.autoChute) chute = undefined;
  else if (!chute && wantsChute(physics, state.pos, velY, jump && !env.jet && !env.jetpack && !canAirJump, drop || !!env.autoChute)) chute = env.glider ? CHUTE_GLIDER : CHUTE_PARACHUTE;
  if (chute) drop = false;
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
    velY -= PLAYER.gravity * g * 0.15 * dt;
    velY *= Math.pow(0.9, dt * 60);
    if (jump) velY = state.pos.y + SWIM_DEPTH + 0.35 > chest.max.y ? Math.max(velY, 4.6) : Math.min(velY + 14 * dt, 3.2);
  } else if (chute) {
    // Under a canopy: a slow, steady sink and steering of its own (see parachute.ts).
    velY = chuteVelY(velY, chute, dt);
    const glide = chuteWish(chute, input.yaw, input.forward, input.right);
    wx = glide.x;
    wz = glide.z;
  } else {
    if (state.grounded && jump) velY = PLAYER.jumpSpeed * (env.jump ?? 1);
    else if (jump && env.airJumps && !state.grounded && !state.jumpHeld && (state.airJumps ?? 0) < env.airJumps) {
      // Double jump: a fresh press in the air kicks you up again.
      velY = PLAYER.jumpSpeed * 0.9 * (env.jump ?? 1);
      airJumped = 1;
    } else if (jump && env.jet && !state.grounded) {
      // Jetpack: thrust while jump is held in the air.
      velY = Math.min(velY + (JET.accel + PLAYER.gravity * g) * dt, Math.max(velY, JET.maxUp));
      jet = true;
    }
    velY -= PLAYER.gravity * g * dt;
  }

  const desiredY = velY * dt;
  const moved = physics.moveCharacter(collider, state.pos, { x: (wx + vx) * dt, y: desiredY, z: (wz + vz) * dt }, STANCES[stance].height * k, radius, env.ground);
  let grounded = moved.grounded;
  if (grounded && velY < 0) velY = 0;
  // Bumped a ceiling while rising.
  if (velY > 0 && moved.movedY < desiredY - 1e-4) velY = 0;
  if (velY > 0) grounded = false;

  if (slide) {
    // The slide slows itself: steadily on the flat, less downhill and more uphill (by the grade it just slid over), never
    // past its starting speed; it ends slow, after SLIDE.maxSeconds, against a wall, or off the ground.
    const v = hypot(vx, vz);
    const dx = moved.feet.x - state.pos.x;
    const dz = moved.feet.z - state.pos.z;
    const run = hypot(dx, dz);

    const grade = run > 1e-3 ? Math.max(-SLIDE.maxGrade, Math.min(SLIDE.maxGrade, -(moved.feet.y - state.pos.y) / run)) : 0;
    const top = slideStart ? slideFrom : Math.max(v, PLAYER.runSpeed * SLIDE.endSpeed);
    const next = Math.min(top, v + (PLAYER.gravity * g * SLIDE.slope * grade - SLIDE.decel) * dt);
    const blocked = run < v * dt * SLIDE.blocked;
    if (next <= PLAYER.runSpeed * SLIDE.endSpeed * baseSpeed || slide >= Math.round(SLIDE.maxSeconds / dt) || blocked || !grounded) {
      slide = 0;
      moveCd = Math.round(SLIDE.cooldown / dt);
      // Into the crouch walk without a lurch: the legs take back their full share of the speed, so the push keeps
      // only what is over a crouch walk (and none against a wall).
      const keep = blocked || v < 1e-6 ? 0 : Math.max(0, v - PLAYER.runSpeed * STANCES[1].speed * baseSpeed) / v;
      vx *= keep;
      vz *= keep;
    } else if (v > 1e-6) {
      vx *= next / v;
      vz *= next / v;
    }
  }
  const decay = slide ? 1 : grounded ? (traction < 1 ? 0.975 : 0.86) : chute ? CHUTE_PUSH_DECAY : AIR_PUSH_DECAY;
  vx = Math.abs(vx * decay) < 0.02 ? 0 : quantize(vx * decay);
  vz = Math.abs(vz * decay) < 0.02 ? 0 : quantize(vz * decay);
  // Built field by field in the same order the optional ones always had (no temporary object per optional
  // field: this runs for every body every tick, and the spread version was a hot spot for garbage).
  const out: MoveState = { pos: { x: quantize(moved.feet.x), y: quantize(moved.feet.y), z: quantize(moved.feet.z) }, velY: quantize(velY), grounded };
  if (vx || vz) {
    out.vx = vx;
    out.vz = vz;
  }
  if (jet) out.jet = jet;
  if (chest) out.swim = true;
  if (stance) out.stance = stance;
  if (stamina < 1) out.stamina = quantize(stamina);
  if (rest) out.rest = rest;
  if (sprint) out.sprint = sprint;
  if (winded) out.winded = winded;
  if (ladder && !jump) out.climb = true;
  if (env.airJumps && !grounded && (state.airJumps ?? 0) + airJumped) out.airJumps = (state.airJumps ?? 0) + airJumped;
  if (env.airJumps && jump) out.jumpHeld = true;
  if (chute && !grounded) out.chute = chute;
  if (drop && !grounded) out.drop = drop;
  if (slide) out.slide = slide;
  if (moveCd) out.moveCd = moveCd;
  if (lean) out.lean = lean;
  return out;
}

/** Under a canopy, momentum (a jump out of a moving plane) bleeds off faster than in free fall. */
const CHUTE_PUSH_DECAY = 0.97;

/** How much of a push (pads, knockback) is left after each tick in the air. */
export const AIR_PUSH_DECAY = 0.99;

/** A jump pad as movement sees it. */
export interface JumpPad {
  pos: Vec3;
  /** Launch velocity: up, and along the pad's facing. */
  vy: number;
  vx: number;
  vz: number;
}

export const PAD_RADIUS = 1.1;

/** Lunar (MatchRules.lunar): jump pads launch this much harder. */
export const LUNAR_PAD_BOOST = 1.3;

/** The jump pads of a map (shared by the server and client prediction so both launch the same); `boost` scales their launch (Lunar). */
export function mapPads(entities: readonly { kind: string; position: [number, number, number]; yaw?: number; power?: number; push?: number }[], boost = 1): JumpPad[] {
  return entities
    .filter((e) => e.kind === 'pad')
    .map((e) => ({ pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, vy: (e.power ?? 14) * boost, vx: Math.sin(e.yaw ?? 0) * (e.push ?? 6) * boost, vz: Math.cos(e.yaw ?? 0) * (e.push ?? 6) * boost }));
}

/** Launch off a pad you are standing on (after moving). */
export function applyPads(pads: readonly JumpPad[], state: MoveState): MoveState {
  if (!pads.length || !state.grounded) return state;
  for (const p of pads) {
    if (hypot(state.pos.x - p.pos.x, state.pos.z - p.pos.z) > PAD_RADIUS || Math.abs(state.pos.y - p.pos.y) > 0.6) continue;
    return { ...state, velY: p.vy, grounded: false, ...(p.vx || p.vz ? { vx: quantize(p.vx), vz: quantize(p.vz) } : {}) };
  }
  return state;
}

/**
 * Where each pad's launch comes down (for bots: the navmesh gets a one-way
 * link from the pad to its landing). Traces the flight with gravity and
 * returns the first floor hit on the way down; pads that never land are left out.
 */
/**
 * Something else a body comes down on, besides `physics`: the distance down a ray to it, or null (the scenario's solids
 * when the navmesh is built: sim/mapNav.ts). Kept a callback so movement, which the menu loads, needn't import the map
 * geometry code.
 */
export type ExtraRay = (origin: Vec3, dir: Vec3, maxDist: number) => number | null;

export function padLandings(pads: readonly JumpPad[], physics: PhysicsWorld, gravity = 1, zones: readonly GravityZone[] = [], extra?: ExtraRay): { start: Vec3; end: Vec3 }[] {
  const out: { start: Vec3; end: Vec3 }[] = [];
  for (const p of pads) {
    let pos = { x: p.pos.x, y: p.pos.y + 0.9, z: p.pos.z };
    let vy = p.vy;
    let vx = p.vx;
    let vz = p.vz;
    for (let t = 0; t < 6; t += TICK_DT) {
      const next = { x: pos.x + vx * TICK_DT, y: pos.y + vy * TICK_DT, z: pos.z + vz * TICK_DT };
      vy -= PLAYER.gravity * gravity * gravityAt(zones, { x: pos.x, y: pos.y - 0.9, z: pos.z }) * TICK_DT;
      // The push fades in the air as it does in movement (AIR_PUSH_DECAY), so the landing is where you really come down.
      vx *= AIR_PUSH_DECAY;
      vz *= AIR_PUSH_DECAY;
      if (vy < 0) {
        const reach = 1.0 + Math.abs(vy * TICK_DT);
        const world = physics.raycastWorld({ x: next.x, y: next.y, z: next.z }, { x: 0, y: -1, z: 0 }, reach);
        // The scenario's solids too (crumbling and breakable blocks, breakable props): they are there when the match
        // starts, and the navmesh is built with them (Erosion's corner pads throw you back up onto its crumbling decks).
        const more = extra ? extra(next, { x: 0, y: -1, z: 0 }, world ?? reach) : null;
        const down = more !== null && (world === null || more < world) ? more : world;
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

/** Every one-way navmesh link a map needs for bots: jump pad flights, ladders up and down, portal pairs both ways and zipline rides. */
export function navLinks(entities: Parameters<typeof mapPads>[0] & Parameters<typeof mapLadders>[0] & Parameters<typeof mapGravityZones>[0] & Parameters<typeof mapPortals>[0] & Parameters<typeof mapZiplines>[0] & Parameters<typeof passageLinks>[0], physics: PhysicsWorld, gravity = 1, extra?: ExtraRay): { start: Vec3; end: Vec3; reach?: Vec3 }[] {
  return [...padLandings(mapPads(entities), physics, gravity, mapGravityZones(entities), extra), ...ladderLinks(mapLadders(entities)), ...portalLinks(mapPortals(entities)), ...ziplineLinks(mapZiplines(entities), physics), ...passageLinks(entities)];
}
