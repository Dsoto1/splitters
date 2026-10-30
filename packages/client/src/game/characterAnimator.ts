import type { Scene } from '@babylonjs/core/scene';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { AnimationGroupMask, AnimationGroupMaskMode } from '@babylonjs/core/Animations/animationGroupMask';
import { Animatable } from '@babylonjs/core/Animations/animatable';
import type { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { ModelPoint, WeaponHold } from '@tiletrigger/shared';
import type { CharacterInstance, Clip } from '../content/characters.ts';
import { TorsoSurface, armReach, reachAlong } from './torsoSurface.ts';
import { GAIT, GAIT_CLIPS, gaitCycleRate, gaitWeights, matchPhase, type GaitClip } from './gait.ts';

/** What the animator needs to know each frame (from interpolated snapshots). */
export interface MotionState {
  /** Horizontal speed, m/s. */
  speed: number;
  /** Direction of travel relative to facing (radians, 0 = forward). */
  moveAngle: number;
  airborne: boolean;
  alive: boolean;
  /** Aim pitch (radians, positive = up). */
  pitch: number;
  /** Victory dance (intermission). */
  celebrate: boolean;
  /** Crouching (1) or prone (2). */
  stance?: number;
  /** Sprinting (plays the sprint even at the edge of its speed). */
  sprinting?: boolean;
}

export type OneShot = 'shoot' | 'melee' | 'melee_heavy' | 'reload' | 'hit' | 'hit_head' | 'throw' | 'interact' | 'jab' | 'kick';

/**
 * States crossfaded over time. 'run' stands for the whole upright gait: walk,
 * run and sprint blended by speed and kept in step (see gait.ts and driveGait).
 */
const LOOPS: readonly Clip[] = ['idle', 'aim_idle', 'run', 'jump_air', 'dance', 'crouch_idle', 'crouch_walk', 'prone_idle', 'prone_crawl'];
/** Natural ground speed of the low locomotion clips (m/s), used to match foot speed. */
const CLIP_SPEED: Partial<Record<Clip, number>> = { crouch_walk: 1.5, prone_crawl: 0.9 };
/** Moving faster than this starts the gait; it stops below the lower figure (no flicker at the edge). */
const MOVE_START = 0.6;
const MOVE_STOP = 0.45;
/** Sprinting shows from this speed even without the flag (speed boosts). */
const SPRINT_SPEED = 7.4;
/** speedRatio changes smaller than this are not applied (each change walks every animatable in the group). */
const RATIO_EPSILON = 0.004;
/**
 * Strafing: the hips turn toward the direction of travel by up to this much (radians), and the
 * spine turns back by the same. Without strafe clips, legs running straight ahead while the body
 * goes sideways slid the planted foot at the full ground speed.
 */
const HIP_TURN_MAX = 1.35;
/** Moving more than this share of a half turn away from facing plays the gait backwards (and stops below the second). */
const BACK_START = 0.6;
const BACK_STAY = 0.52;
/** Lying prone: the body tips forward onto its front around the hips (radians, metres). */
const PRONE_TILT = 1.45;
const HIP_HEIGHT = 0.95;
const FADE_PER_SEC = 8;
/** Overlays outweigh locomotion on the upper body. */
const OVERLAY_WEIGHT = 4;

const UPPER_BODY = [
  'spine_02',
  'spine_03',
  'neck_01',
  'Head',
  ...['l', 'r'].flatMap((s) => [
    `clavicle_${s}`,
    `upperarm_${s}`,
    `lowerarm_${s}`,
    `hand_${s}`,
    ...['index', 'middle', 'pinky', 'ring', 'thumb'].flatMap((f) => [1, 2, 3].map((j) => `${f}_0${j}_${s}`)),
  ]),
];
/** Actions during which the hands leave the grip (the weapon goes with the right hand). */
const HANDS_OFF: ReadonlySet<OneShot> = new Set(['reload', 'melee', 'melee_heavy', 'throw', 'interact', 'hit', 'hit_head', 'jab']);
/** Limb joints (arms, hands, legs, feet): a cheap ragdoll leaves them to a limp pose. */
const LIMB = /^(clavicle|upperarm|lowerarm|hand|index|middle|ring|pinky|thumb|thigh|calf|foot|ball)_/;
/** A hit flinch: how long it lasts (s), how fast it peaks (s), and how far each body part goes at full strength (radians). */
const FLINCH_SECONDS = 0.42;
const FLINCH_PEAK = 0.05;
const FLINCH_HEAD = 0.55;
const FLINCH_TWIST = 0.38;
const FLINCH_BUCKLE = 0.22;
/** The procedural kick (the library has no kick clip): length (s), thigh raise and lean back at its height (radians). */
const KICK_SECONDS = 0.5;
const KICK_THIGH = 1.35;
const KICK_LEAN = 0.22;
/** Upper-body turn (radians) that brings the left shoulder forward onto a long gun. */
const LONG_GUN_BLADE = 0.45;
/** Half the width of a rifle stock (m): torso skin within this of the barrel line is in its way. */
const STOCK_RADIUS = 0.035;
/** Short arms slide the support hand back along the handguard, but keep it this far ahead of the grip (model m). */
const SUPPORT_MIN_AHEAD = 0.12;
/** Furthest (model m) a stock the arms can't hold clear of the chest tucks out past the shoulder. */
const TUCK_MAX = 0.12;
const TUCK_FROM = 0.04;

/** An arm for the IK solver. */
interface Arm {
  upper: TransformNode;
  lower: TransformNode;
  hand: TransformNode;
  /** Palm centre in the hand's local space (where a grip sits). */
  palm: Vector3;
  /** How far the palm's centre rests from the grip's centre line (model m): half the grip and half the hand. */
  gripOffset: number;
  /** How far the fingers close on a grip (1: the full curl; 0: a rigid or already closed hand). */
  curl: number;
  /** Finger chains (index, middle, ring, pinky), knuckle first, for closing the hand. */
  fingers: TransformNode[][];
  /** Knuckles used to build the hand's frame. */
  index: TransformNode;
  pinky: TransformNode;
  knuckle: TransformNode;
  thumb: TransformNode;
}

/** A character's animation gate: while `skip` is set its clips are not evaluated (see CharacterAnimator.stepAt). */
interface AnimGate {
  skip: boolean;
}

let gatePatched = false;
/**
 * Babylon evaluates every playing clip on every frame. Animation targets that
 * carry a gate (a crowd's far characters, see stepAt) skip evaluation while it
 * is shut: their bones hold the last pose, and the next evaluation samples the
 * clip at the current time, so nothing falls behind.
 */
function patchAnimatables(): void {
  if (gatePatched) return;
  gatePatched = true;
  const proto = Animatable.prototype as unknown as { _animate(delay: number): boolean; target: { _animGate?: AnimGate } | null };
  const animate = proto._animate;
  proto._animate = function (this: typeof proto, delay: number): boolean {
    if (this.target?._animGate?.skip) return true;
    return animate.call(this, delay);
  };
}

/**
 * Drives one character: crossfaded locomotion loops chosen from speed and
 * airtime, upper-body one-shots (shooting, melee, reloads) over the legs, a
 * held death pose, aim pitch and a strafing twist applied to the spine after
 * the clips, and the weapon carried in the right hand.
 */
export class CharacterAnimator {
  private readonly weights = new Map<Clip, number>();
  private current: Clip = 'aim_idle';
  private overlay: { clip: AnimationGroup; until: number } | null = null;
  private dead = false;
  private readonly observer: Observer<Scene>;
  private pitch = 0;
  private twist = 0;
  /** Moving backwards (the gait plays in reverse); kept with a margin so it doesn't flicker at a sideways strafe. */
  private backing = false;
  private readonly pelvis?: TransformNode;
  private readonly spine: TransformNode[];
  private readonly hand?: TransformNode;
  private weapon: TransformNode | null = null;
  private grip: WeaponHold | null = null;
  private readonly arms: { r: Arm; l: Arm } | null;
  /** The skeleton's root joint: IK works in its space (the glTF import mirrors everything above it). */
  private readonly skelRoot?: TransformNode;
  /** 1 while the hands are on the weapon, 0 while an action has them elsewhere (blended). */
  private ik = 1;
  private handsOff = false;
  private blade = 0;
  /** The weapon relative to the right hand, from the last frame it was gripped. */
  private readonly inHand = { pos: Vector3.Zero(), rot: Quaternion.Identity(), valid: false };
  /** Where the torso's front is, for setting a stock on it (measured on the first long-gun frame). */
  private torso: TorsoSurface | null | undefined;
  private readonly mask = new AnimationGroupMask(UPPER_BODY, AnimationGroupMaskMode.Include);
  /** Legs-only locomotion, so the arms stay on the weapon while running. */
  private readonly legs = new AnimationGroupMask(UPPER_BODY, AnimationGroupMaskMode.Exclude);
  /** The aim pose held on the upper body under every locomotion loop except the dance. */
  private readonly aimUpper: AnimationGroup | null;

  constructor(
    private readonly scene: Scene,
    readonly ch: CharacterInstance,
  ) {
    this.spine = ['spine_01', 'spine_02', 'spine_03'].map((n) => ch.joints.get(n)).filter((n): n is TransformNode => !!n);
    this.hand = ch.joints.get('hand_r');
    const arm = (side: 'l' | 'r'): Arm | null => {
      const [upper, lower, hand, knuckle, index, pinky, thumb] = ['upperarm', 'lowerarm', 'hand', 'middle_01', 'index_01', 'pinky_01', 'thumb_02'].map((n) => ch.joints.get(`${n}_${side}`));
      if (!upper || !lower || !hand || !knuckle || !index || !pinky || !thumb) return null;
      const fingers = ['index', 'middle', 'ring', 'pinky'].map((f) => [1, 2, 3].map((j) => ch.joints.get(`${f}_0${j}_${side}`)).filter((n): n is TransformNode => !!n));
      // A hand measured at import (Meshy characters): its own palm centre, and its thickness sets how far
      // that centre rests from the grip, so a big hand wraps the grip instead of sinking into it.
      const measured = ch.hands[side];
      if (measured) {
        const gripOffset = Math.max(MIN_GRIP_OFFSET, GRIP_RADIUS_MEASURED + (measured.thickness - REF_HAND_THICKNESS) / 2);
        return { upper, lower, hand, palm: new Vector3(...measured.palm), gripOffset, curl: measured.curl, fingers, index, pinky, knuckle, thumb };
      }
      // The rig's own hands: the palm sits a little over halfway from the wrist to the middle knuckle.
      return { upper, lower, hand, palm: knuckle.position.scale(0.6), gripOffset: GRIP_RADIUS, curl: 1, fingers, index, pinky, knuckle, thumb };
    };
    const [r, l] = [arm('r'), arm('l')];
    this.arms = r && l ? { r, l } : null;
    this.skelRoot = ch.joints.get('root');
    this.pelvis = ch.joints.get('pelvis');
    for (const c of LOOPS) this.weights.set(c, 0);
    for (const c of ['walk', 'run', 'sprint', 'jump_air'] as const) {
      const g = ch.clips.get(c);
      if (g) g.mask = this.legs;
    }
    const aim = ch.clips.get('aim_idle');
    this.aimUpper = aim ? aim.clone(`${aim.name}_upper`) : null;
    if (this.aimUpper) {
      this.aimUpper.mask = this.mask;
      this.aimUpper.start(true);
    }
    this.play('aim_idle', 1);
    this.observer = scene.onAfterAnimationsObservable.add(() => this.afterAnimations());
    // The gate on every animated node, and the skeleton's matrices held while it is shut.
    patchAnimatables();
    for (const g of this.groups()) for (const t of g.targetedAnimations) if (t.target) (t.target as { _animGate?: AnimGate })._animGate = this.gate;
    const skeletons = new Set<Skeleton>();
    for (const m of ch.meshes) if (m.skeleton) skeletons.add(m.skeleton);
    for (const sk of skeletons) {
      const prepare = sk.prepare.bind(sk);
      sk.prepare = (dontCheckFrameId?: boolean) => {
        if (!this.gate.skip) prepare(dontCheckFrameId);
      };
    }
  }

  private readonly gate: AnimGate = { skip: false };
  /** Animation LOD: the next time (ms) the clips are evaluated, and the step between evaluations (0: every frame). */
  private nextStep = 0;

  /**
   * Animation LOD (a crowd's far characters): evaluate the clips, bones and
   * aim only every `stepMs` (0: every frame), from `phase` (ms) so a crowd's
   * evaluations spread over frames. Returns whether this frame evaluates (the
   * state machine should update then, with the time saved up). Clips are
   * sampled at the current time when they do, so motion keeps its speed.
   */
  stepAt(now: number, stepMs: number, phase = 0): boolean {
    if (stepMs <= 0 || this.dead) {
      this.gate.skip = false;
      this.nextStep = 0;
      return true;
    }
    if (now >= this.nextStep) {
      // On the character's own phase, so not every far character evaluates on the same frame.
      this.nextStep = now + stepMs - ((((now - phase) % stepMs) + stepMs) % stepMs);
      this.gate.skip = false;
      return true;
    }
    this.gate.skip = true;
    return false;
  }

  /** Carry a weapon model, held as `grip` describes (null to empty the hands). */
  hold(weapon: TransformNode | null, grip: WeaponHold | null = null): void {
    this.weapon?.dispose();
    this.weapon = weapon;
    this.grip = weapon ? grip : null;
    this.inHand.valid = false;
    if (weapon) {
      weapon.parent = this.ch.root;
      weapon.rotationQuaternion ??= Quaternion.Identity();
    }
  }

  /**
   * Put the hands on a weapon that is positioned by someone else (the
   * first-person viewmodel): the weapon is not moved or owned, only gripped.
   */
  gripExternal(weapon: TransformNode | null, grip: WeaponHold | null): void {
    this.weapon?.dispose();
    this.weapon = null;
    this.external = weapon && grip ? { node: weapon, grip } : null;
  }

  private external: { node: TransformNode; grip: WeaponHold } | null = null;

  /** Anything in the hands? Unarmed (hostages), the arms swing with the walk instead of holding the aim pose. */
  private get armed(): boolean {
    return !!this.weapon || !!this.external;
  }

  private legsOnly = true;

  private maskLegs(on: boolean): void {
    if (on === this.legsOnly) return;
    this.legsOnly = on;
    for (const c of ['walk', 'run', 'sprint', 'jump_air'] as const) {
      const g = this.ch.clips.get(c);
      if (g) g.mask = on ? this.legs : null;
    }
  }

  update(dt: number, s: MotionState): void {
    if (!s.alive) {
      if (!this.dead) this.die();
      return;
    }
    if (this.dead) this.revive();
    this.maskLegs(this.armed);
    this.pitch = this.armed ? s.pitch : 0;

    // Backpedal by playing the gait in reverse; strafe by turning the hips (and so the legs) toward
    // the motion while the spine turns back, so the shoulders and the gun stay on the aim. Moving
    // mostly backwards, the hips turn toward the opposite of the motion and the gait runs backwards.
    const moving = s.speed > 0.5;
    this.backing = moving && Math.abs(s.moveAngle) > Math.PI * (this.backing ? BACK_STAY : BACK_START);
    const back = this.backing;
    const legs = back ? s.moveAngle - Math.PI * Math.sign(s.moveAngle) : s.moveAngle;
    const side = moving ? Math.max(-HIP_TURN_MAX, Math.min(HIP_TURN_MAX, legs)) : 0;
    // Eased: bots dodging left and right while they shoot would otherwise swing their hips back and forth.
    this.twist += (side - this.twist) * Math.min(1, dt * 6);

    let want: Clip;
    const low = (s.stance ?? 0) > 0;
    // Real prone clips when the rig has them; otherwise the body is tipped over (below).
    const proneClips = s.stance === 2 && this.ch.clips.has('prone_idle');
    if (s.celebrate) want = 'dance';
    else if (s.airborne) want = 'jump_air';
    else if (proneClips) want = s.speed < 0.3 ? 'prone_idle' : 'prone_crawl';
    else if (low) want = s.speed < 0.4 ? 'crouch_idle' : 'crouch_walk';
    else if (s.speed < (this.current === 'run' ? MOVE_STOP : MOVE_START)) want = this.armed || !this.ch.clips.has('idle') ? 'aim_idle' : 'idle';
    else want = 'run';
    // Sprinting fades in over the run (both loops in step) rather than switching.
    const sprintTarget = s.sprinting || s.speed >= SPRINT_SPEED ? 1 : 0;
    this.sprintMix += Math.sign(sprintTarget - this.sprintMix) * Math.min(Math.abs(sprintTarget - this.sprintMix), dt * FADE_PER_SEC);
    // Prone: tip the whole body forward onto its front, pivoting at the hips over the feet.
    const tilt = s.stance === 2 && !s.celebrate && !proneClips ? PRONE_TILT : 0;
    // Lying down, the standing aim pose would pull the arms upright: leave the arms to the clip and the grip.
    this.lying = proneClips;
    this.prone += (tilt - this.prone) * Math.min(1, dt * 8);
    if (Math.abs(this.prone - tilt) < 1e-3) this.prone = tilt;
    this.applyProne();
    if (want !== this.current) {
      this.current = want;
      if (want !== 'run') this.play(want, this.weights.get(want) ?? 0);
    }
    for (const c of LOOPS) {
      const target = c === this.current ? 1 : 0;
      let w = this.weights.get(c)!;
      w += Math.sign(target - w) * Math.min(Math.abs(target - w), dt * FADE_PER_SEC);
      this.weights.set(c, w);
      if (c === 'run') {
        this.driveGait(w, s.speed, back);
        continue;
      }
      const g = this.ch.clips.get(c);
      if (!g) continue;
      if (w <= 0.001 && c !== this.current) {
        if (g.isPlaying) g.stop();
        continue;
      }
      g.weight = w;
      const natural = CLIP_SPEED[c];
      if (natural) g.speedRatio = Math.max(0.5, Math.min(2, s.speed / natural)) * (back ? -1 : 1);
    }

    if (this.aimUpper) this.aimUpper.weight = this.lying || !this.armed ? 0 : 1 - (this.weights.get('dance') ?? 0);

    if (this.overlay && performance.now() > this.overlay.until) {
      this.overlay.clip.stop();
      this.overlay = null;
      this.handsOff = false;
    }
    // Hands on the weapon unless an action needs them; long guns turn the shoulders into the stock.
    const ikTarget = this.handsOff || (this.grip?.style === 'melee' && !this.external) ? 0 : 1;
    this.ik += Math.sign(ikTarget - this.ik) * Math.min(Math.abs(ikTarget - this.ik), dt * 6);
    const bladeTarget = this.grip?.style === 'long' && !s.celebrate ? LONG_GUN_BLADE * this.ik : 0;
    this.blade += (bladeTarget - this.blade) * Math.min(1, dt * 8);
    // Clips the state machine started while asleep wait too.
    if (this.dormant) for (const g of this.groups()) if (g.isPlaying) g.pause();
  }

  /** 0..1: how far the gait has faded from the run into the sprint. */
  private sprintMix = 0;
  /** Gait cycles per second last applied to the loops (negative backwards). */
  private gaitRate = 0;

  /**
   * The upright gait: walk, run and sprint weighted by speed (gaitWeights),
   * all at the one cycle rate that keeps the planted foot still for this
   * speed and body size, and phase-locked: a loop joining the blend starts
   * where the one already playing is in its stride, so feet never swap or
   * skip as the speed crosses from walk to run or into a sprint.
   */
  private driveGait(weight: number, speed: number, back: boolean): void {
    const loops: [GaitClip, AnimationGroup][] = [];
    for (const c of GAIT_CLIPS) {
      const g = this.ch.clips.get(c);
      if (g) loops.push([c, g]);
    }
    if (!loops.length) return;
    // isStarted, not isPlaying: a sleeping crowd member's loops are paused, not stopped.
    if (weight <= 0.001 && this.current !== 'run') {
      for (const [, g] of loops) if (g.isStarted) g.stop();
      this.gaitRate = 0;
      return;
    }
    const mix = gaitWeights(speed, this.sprintMix);
    // A rig without one of the loops: the run (or whatever there is) takes its share.
    for (const c of GAIT_CLIPS) {
      if (this.ch.clips.has(c) || !mix[c]) continue;
      const to = this.ch.clips.has('run') ? 'run' : loops[0]![0];
      mix[to] += mix[c];
      mix[c] = 0;
    }
    const seconds: Record<GaitClip, number> = { walk: 0, run: 0, sprint: 0 };
    for (const [c, g] of loops) seconds[c] = (g.to - g.from) / (g.targetedAnimations[0]?.animation.framePerSecond || 60);
    const scale = Math.abs(this.ch.root.scaling.y) || 1;
    const rate = gaitCycleRate(speed, mix, seconds, scale) * (back ? -1 : 1);
    // The heaviest loop already playing sets the stride the others join at.
    let lead: { clip: GaitClip; phase: number } | null = null;
    for (const [c, g] of loops) {
      const frame = g.animatables[0]?.masterFrame;
      if (!g.isStarted || frame === undefined || (lead && mix[c] <= mix[lead.clip])) continue;
      const p = (frame - g.from) / (g.to - g.from || 1);
      lead = { clip: c, phase: p - Math.floor(p) };
    }
    let joined = false;
    for (const [c, g] of loops) {
      const w = weight * mix[c];
      if (w <= 0.001) {
        if (g.isStarted) g.stop();
        continue;
      }
      if (!g.isStarted) {
        joined = true;
        g.start(true);
        // In step with the loop already playing, or from a left footfall.
        const phase = lead ? matchPhase(lead.clip, lead.phase, c) : GAIT[c].footDown;
        g.goToFrame(g.from + phase * (g.to - g.from));
      }
      g.weight = w;
    }
    // One cycle rate for every loop, changed on all of them together so they stay in step.
    if (joined || Math.abs(rate - this.gaitRate) > RATIO_EPSILON * Math.max(1, Math.abs(rate))) {
      this.gaitRate = rate;
      for (const [c, g] of loops) if (g.isStarted) g.speedRatio = rate * seconds[c];
    }
  }

  /** Out of view in a crowd: clips paused where they are and no aiming or gripping until it is seen again. */
  private dormant = false;

  /**
   * Put the character to sleep while nobody can see it (a crowd's characters
   * behind the camera): its clips pause, so the bones cost nothing, and the
   * after-animation aim and grip are skipped. Waking resumes the clips where
   * they were; the state machine (update) keeps running all along.
   */
  setDormant(on: boolean): void {
    if (on === this.dormant) return;
    this.dormant = on;
    for (const g of this.groups()) {
      if (on && g.isPlaying) g.pause();
      else if (!on && g.isStarted && !g.isPlaying) g.restart();
    }
  }

  private groups(): Set<AnimationGroup> {
    const all = new Set(this.ch.clips.values());
    if (this.aimUpper) all.add(this.aimUpper);
    return all;
  }

  /** Body part hit (0 torso, 1 head, 2 legs), which way the round went (world), how hard (0..1), and when (ms). */
  private flinchState: { zone: number; dir: Vector3; amount: number; t0: number } | null = null;
  private kickAt = -1e9;

  /**
   * A hit flinch at the body part hit, added over whatever the clips do: the
   * head snaps back, the shoulders twist away from the round, a leg hit
   * buckles the body a little. Arcade-light: a fraction of a second, no
   * lockout (docs/GUNPLAY_SPEC.md, "Stopping power").
   */
  flinch(zone: number, dir: { x: number; y: number; z: number }, strength: number): void {
    if (this.dead || this.dormant) return;
    const now = performance.now();
    const left = this.flinchState ? this.flinchAmount(now) : 0;
    this.flinchState = { zone, dir: new Vector3(dir.x, 0, dir.z).normalize(), amount: Math.min(1, Math.max(left, strength)), t0: now };
  }

  private flinchAmount(now: number): number {
    const f = this.flinchState;
    if (!f) return 0;
    const t = (now - f.t0) / 1000;
    if (t >= FLINCH_SECONDS) return 0;
    return f.amount * (t < FLINCH_PEAK ? t / FLINCH_PEAK : Math.exp(-(t - FLINCH_PEAK) / 0.1));
  }

  /** Rotate a joint about a world axis by `angle` (after the clips). */
  private turnJoint(bone: TransformNode | undefined, axisWorld: Vector3, angle: number): void {
    const parent = bone?.parent as TransformNode | null | undefined;
    if (!bone?.rotationQuaternion || !parent || Math.abs(angle) < 1e-4) return;
    parent.computeWorldMatrix(true);
    const inv = Quaternion.FromRotationMatrix(parent.getWorldMatrix().getRotationMatrix()).invert();
    const axis = Vector3.TransformNormal(axisWorld, Matrix.FromQuaternionToRef(inv, new Matrix())).normalize();
    bone.rotationQuaternion = Quaternion.RotationAxis(axis, angle).multiply(bone.rotationQuaternion);
  }

  /** The flinch and the kick, on top of the pose (afterAnimations). */
  private applyReactions(right: Vector3, up: Vector3, rootRot: Quaternion): void {
    const now = performance.now();
    const e = this.flinchAmount(now);
    const f = this.flinchState;
    if (f && e > 0.001) {
      const head = this.ch.joints.get('neck_01');
      const chest = this.spine[this.spine.length - 1];
      if (f.zone === 1) {
        // Head snaps back, the neck and head sharing it.
        this.turnJoint(head, right, FLINCH_HEAD * e * 0.5);
        this.turnJoint(this.ch.joints.get('Head'), right, FLINCH_HEAD * e * 0.5);
      } else if (f.zone === 2) {
        // A leg hit buckles the body forward a little.
        this.turnJoint(this.spine[0], right, -FLINCH_BUCKLE * e);
      } else {
        // The shoulders twist away from the round (the side it came in on goes back), and lean back a touch.
        const forward = new Vector3(0, 0, 1).applyRotationQuaternion(rootRot);
        const side = Math.sign(Vector3.Dot(f.dir, right)) || 1;
        const facing = Vector3.Dot(f.dir, forward) < 0 ? 1 : -1;
        this.turnJoint(chest, up, -FLINCH_TWIST * e * side * facing);
        this.turnJoint(chest, right, FLINCH_TWIST * 0.4 * e);
      }
    } else if (f) this.flinchState = null;
    const k = (now - this.kickAt) / 1000 / KICK_SECONDS;
    if (k >= 0 && k < 1) {
      // Up fast, down slower: the thigh swings forward and the body leans back to balance it.
      const env = k < 0.35 ? Math.sin((k / 0.35) * (Math.PI / 2)) : Math.cos(((k - 0.35) / 0.65) * (Math.PI / 2));
      this.turnJoint(this.spine[0], right, KICK_LEAN * env);
      this.turnJoint(this.ch.joints.get('thigh_r'), right, KICK_THIGH * env);
      // Chambered on the way up, straight at full reach.
      this.turnJoint(this.ch.joints.get('calf_r'), right, -0.9 * env * (1 - Math.min(1, k / 0.35)));
    }
  }

  /** Play an upper-body action once, over whatever the legs are doing. */
  trigger(action: OneShot): void {
    if (this.dead || this.dormant) return;
    if (action === 'kick') {
      // A procedural kick on the legs (no clip); the hands come off the gun for it.
      this.kickAt = performance.now();
      return;
    }
    const g = this.ch.clips.get(action === 'hit_head' && !this.ch.clips.has('hit_head') ? 'hit' : action === 'jab' && !this.ch.clips.has('jab') ? 'melee' : (action as Clip));
    if (!g) return;
    this.overlay?.clip.stop();
    g.mask = this.mask;
    g.weight = OVERLAY_WEIGHT;
    g.start(false, action === 'shoot' ? 1.6 : 1.2);
    const seconds = (g.to - g.from) / 60 / (action === 'shoot' ? 1.6 : 1.2);
    this.overlay = { clip: g, until: performance.now() + Math.max(0.15, seconds) * 1000 };
    this.handsOff = HANDS_OFF.has(action);
  }

  private play(clip: Clip, weight: number): void {
    const g = this.ch.clips.get(clip);
    if (!g) return;
    g.weight = weight;
    if (!g.isPlaying) g.start(true);
  }

  /** The skeleton's root joint (ragdolls work in its space). */
  get skeletonRoot(): TransformNode | undefined {
    return this.skelRoot;
  }

  /**
   * Hand the body to a ragdoll: every animation stops where it is and the
   * weapon drops away; physics poses the bones until the next spawn.
   */
  ragdoll(limbs: 'stop' | 'limp' = 'stop'): void {
    this.dead = true;
    // Physics poses the bones from now on: they must be drawn every frame.
    this.gate.skip = false;
    for (const g of this.ch.clips.values()) if (g.isPlaying) g.stop();
    this.aimUpper?.stop();
    this.overlay = null;
    this.handsOff = false;
    this.weapon?.setEnabled(false);
    // A cheap ragdoll moves only the pelvis, chest and head: the limbs take the death's final, limp pose.
    if (limbs === 'limp') this.holdDeathPose([...this.ch.joints.keys()].filter((n) => LIMB.test(n)));
  }

  /**
   * Lie down at once, no physics (a death out of view): the whole body takes
   * the death's final pose. The caller lays the root on the ground along the hit.
   */
  lieDown(): void {
    this.dead = true;
    this.gate.skip = false;
    this.prone = 0;
    this.applyProne();
    for (const g of this.ch.clips.values()) if (g.isPlaying) g.stop();
    this.aimUpper?.stop();
    this.overlay = null;
    this.handsOff = false;
    this.weapon?.setEnabled(false);
    this.holdDeathPose(null);
  }

  /** The death clip's last frame, on these joints (null: all), held. */
  private holdDeathPose(joints: string[] | null): void {
    const d = this.ch.clips.get('death');
    if (!d) return;
    d.mask = joints ? new AnimationGroupMask(joints, AnimationGroupMaskMode.Include) : null;
    d.weight = 1;
    // One frame before the end, played out: the last frame stays.
    d.start(false, 1, Math.max(d.from, d.to - 1), d.to);
  }

  /** The pose is final (a frozen ragdoll, a body laid down): skip the skeleton and joint updates until thawed. */
  private frozenPose = false;

  freezePose(): void {
    if (this.frozenPose) return;
    this.frozenPose = true;
    this.gate.skip = true;
    for (const j of this.ch.joints.values()) j.freezeWorldMatrix();
  }

  thawPose(): void {
    if (!this.frozenPose) return;
    this.frozenPose = false;
    this.gate.skip = false;
    for (const j of this.ch.joints.values()) j.unfreezeWorldMatrix();
  }

  /** Current forward tip of the body (0 standing, PRONE_TILT lying down). */
  private prone = 0;
  private lying = false;

  /** Where the body sits before any prone offset (first-person arms are placed under the camera). */
  private rootBase: Vector3 | null = null;
  private applied = 0;

  private applyProne(): void {
    if (this.prone === this.applied) return;
    this.applied = this.prone;
    const root = this.ch.root;
    this.rootBase ??= root.position.clone();
    root.rotation.x = this.prone;
    // Rotating about the feet would throw the body a metre forward; keep the hips over the feet and lay it on the ground.
    // Lifted a little so the chest rests on the floor instead of sinking into it.
    root.position.set(this.rootBase.x, this.rootBase.y + 0.12 * (this.prone / PRONE_TILT), this.rootBase.z - HIP_HEIGHT * Math.sin(this.prone));
  }

  private die(): void {
    this.dead = true;
    this.gate.skip = false;
    // The ragdoll takes over from wherever the body is.
    this.prone = 0;
    this.applyProne();
    for (const g of this.ch.clips.values()) if (g.isPlaying) g.stop();
    this.aimUpper?.stop();
    this.overlay = null;
    this.handsOff = false;
    const d = this.ch.clips.get('death');
    if (d) {
      d.mask = null;
      d.weight = 1;
      // Hold the final frame: the body stays down until respawn.
      d.start(false, 1.1);
    }
    this.weapon?.setEnabled(false);
  }

  private revive(): void {
    this.dead = false;
    this.thawPose();
    const d = this.ch.clips.get('death');
    if (d) d.mask = null;
    this.ch.clips.get('death')?.stop();
    for (const c of LOOPS) this.weights.set(c, 0);
    this.current = 'aim_idle';
    this.weights.set('aim_idle', 1);
    this.play('aim_idle', 1);
    this.aimUpper?.start(true);
    this.weapon?.setEnabled(true);
  }

  /** Bend the spine for aim pitch and counter-twist the hip turn, then put the weapon in the hands. */
  private afterAnimations(): void {
    // Not evaluated this frame (animation LOD): the bones still hold last evaluation's aim and grip.
    if (this.dead || this.dormant || this.gate.skip || !this.spine.length) return;
    const root = this.ch.root;
    root.computeWorldMatrix(true);
    const rootRot = Quaternion.FromRotationMatrix(root.getWorldMatrix().getRotationMatrix());
    const right = Vector3.TransformNormal(Vector3.Right(), Matrix.FromQuaternionToRef(rootRot, new Matrix()));
    const up = Vector3.Up();
    // The hips (and with them the legs) turn toward the motion; the spine above turns back by as
    // much. Joint space is mirrored from the game's yaw (glTF import), hence the minus.
    const hipTurn = -this.twist;
    const twist = hipTurn - this.blade;
    const hips = this.pelvis;
    const hipsParent = hips?.parent as TransformNode | null | undefined;
    if (hips?.rotationQuaternion && hipsParent && Math.abs(hipTurn) > 1e-4) {
      hipsParent.computeWorldMatrix(true);
      const inv = Quaternion.FromRotationMatrix(hipsParent.getWorldMatrix().getRotationMatrix()).invert();
      const axis = Vector3.TransformNormal(up, Matrix.FromQuaternionToRef(inv, new Matrix())).normalize();
      hips.rotationQuaternion = Quaternion.RotationAxis(axis, hipTurn).multiply(hips.rotationQuaternion);
    }
    for (const bone of this.spine) {
      const parent = bone.parent as TransformNode | null;
      if (!parent || !bone.rotationQuaternion) continue;
      parent.computeWorldMatrix(true);
      const inv = Quaternion.FromRotationMatrix(parent.getWorldMatrix().getRotationMatrix()).invert();
      const toLocal = Matrix.FromQuaternionToRef(inv, new Matrix());
      const pitchAxis = Vector3.TransformNormal(right, toLocal).normalize();
      const twistAxis = Vector3.TransformNormal(up, toLocal).normalize();
      const share = 1 / this.spine.length;
      const q = Quaternion.RotationAxis(pitchAxis, this.pitch * share).multiply(Quaternion.RotationAxis(twistAxis, -twist * share));
      bone.rotationQuaternion = q.multiply(bone.rotationQuaternion);
    }
    this.applyReactions(right, up, rootRot);
    if (this.weapon && this.grip && this.arms && this.skelRoot) this.placeWeapon(root, rootRot, this.weapon, this.grip, this.arms, new SkeletonSpace(this.skelRoot));
    else if (this.external && this.arms && this.skelRoot && !this.external.node.isDisposed()) this.gripPlaced(this.external.node, this.external.grip, this.arms, new SkeletonSpace(this.skelRoot), root.absoluteScaling.x);
  }

  /**
   * Aim the weapon and close the hands on it: the gun points along the aim
   * (from the right palm for pistols, from the shoulder pocket for long guns),
   * two-bone IK brings the palms to the grip and support points, the hands
   * keep their animated orientation and the fingers close. While an action has
   * the hands elsewhere, the weapon rides in the right hand.
   */
  private placeWeapon(root: TransformNode, rootRot: Quaternion, weapon: TransformNode, grip: WeaponHold, arms: { r: Arm; l: Arm }, space: SkeletonSpace): void {
    const scale = root.absoluteScaling.x;
    const aim = rootRot.multiply(Quaternion.RotationAxis(Vector3.Right(), -this.pitch));
    const point = (origin: Vector3, rot: Quaternion, p: ModelPoint) => origin.add(new Vector3(p[0], p[1], p[2]).scale(scale).applyRotationQuaternion(rot));
    const pos = (n: TransformNode) => {
      n.computeWorldMatrix(true);
      return n.getAbsolutePosition().clone();
    };

    // Where the weapon goes when gripped (world space).
    let gripped: { pos: Vector3; rot: Quaternion } | null = null;
    let support = grip.support;
    if (grip.style === 'pistol') {
      gripped = { rot: aim, pos: palmWorld(arms.r).subtract(new Vector3(...grip.grip).scale(scale).applyRotationQuaternion(aim)) };
    } else if (grip.style === 'long' && grip.shoulder) {
      const shoulder = pos(arms.r.upper);
      const inward = pos(this.spine[this.spine.length - 1]!).subtract(shoulder);
      inward.y = 0;
      // The stock sits just inside the shoulder joint, a little in front and below.
      const pocket = shoulder.add(inward.normalize().scale(0.07 * scale)).add(new Vector3(0, -0.03, 0.05).scale(scale).applyRotationQuaternion(aim));
      // Out along the barrel onto the body's own surface: armour or a big chest stands well in front of the joint.
      // Measured once the body is fully in its aim (the chest turned across the gun), so the surface ahead of the shoulder is the one the barrel crosses.
      if (this.torso === undefined && this.ik >= 0.999 && Math.abs(this.blade - LONG_GUN_BLADE) < 0.01) this.torso = TorsoSurface.measure(this.ch);
      const barrel = new Vector3(0, 0, 1).applyRotationQuaternion(aim);
      const on = (p: ModelPoint) => point(pocket, aim, [p[0] - grip.shoulder![0], p[1] - grip.shoulder![1], p[2] - grip.shoulder![2]]);
      // Short arms (an otter's) hold the handguard nearer the grip rather than pull the gun back into the body.
      const slid = (shift: number): ModelPoint => [grip.support![0], grip.support![1], grip.support![2] - shift];
      const room = grip.support ? Math.max(0, grip.support[2] - grip.grip[2] - SUPPORT_MIN_AHEAD) : 0;
      const reach = (arm: Arm, p: ModelPoint) => reachAlong(pos(arm.upper), on(p), barrel, armReach(arm.upper, arm.lower, arm.hand, arm.palm));
      // ...but no further than the hands still reach their points on the gun (the support hand slid back as far as it goes).
      const clearOut = () => {
        const clear = this.torso?.clearance(pocket, barrel, STOCK_RADIUS * scale, 0.01 * scale) ?? 0;
        const push = clear > 0 ? Math.min(clear, reach(arms.r, grip.grip), grip.support ? reach(arms.l, slid(room)) : clear) : 0;
        pocket.addInPlace(barrel.scale(push));
        return clear - push;
      };
      const buried = clearOut();
      if (buried > TUCK_FROM * scale) {
        // Arms too short to hold it clear of a deep chest: the stock tucks out past the shoulder and a little lower,
        // by as much as it was still in (past a few centimetres a cheek weld hides), then out along the barrel again.
        const out = pos(arms.r.upper).subtract(pos(arms.l.upper));
        out.y = 0;
        const tuck = Math.min(buried - TUCK_FROM * scale, TUCK_MAX * scale);
        pocket.addInPlace(out.normalize().scale(tuck)).addInPlace(new Vector3(0, -0.4 * tuck, 0));
        clearOut();
      }
      if (grip.support && room > 0) {
        // The least slide that brings the support point within the left arm's reach.
        const shoulderL = pos(arms.l.upper);
        const reachL = armReach(arms.l.upper, arms.l.lower, arms.l.hand, arms.l.palm);
        let shift = 0;
        while (shift < room && Vector3.Distance(shoulderL, on(slid(shift))) > reachL) shift = Math.min(room, shift + 0.01);
        support = slid(shift);
      }
      gripped = { rot: aim, pos: pocket.subtract(new Vector3(...grip.shoulder).scale(scale).applyRotationQuaternion(aim)) };
    }

    const w = gripped ? this.ik : 0;
    if (gripped && w > 0) {
      const outward = pos(arms.r.upper).subtract(pos(arms.l.upper)).normalize();
      const down = new Vector3(0, -1, 0);
      if (grip.style === 'long') {
        solveArm(space, arms.r, palmOnGrip(arms.r, point(gripped.pos, gripped.rot, grip.grip), scale), pos(arms.r.upper).add(outward.scale(0.35)).add(down.scale(0.3)), w);
        closeHand(space, arms.r, w);
      } else closeHand(space, arms.r, w);
      if (support) {
        solveArm(space, arms.l, palmOnGrip(arms.l, point(gripped.pos, gripped.rot, support), scale), pos(arms.l.upper).subtract(outward.scale(0.1)).add(down.scale(0.4)), w);
        closeHand(space, arms.l, w * 0.7);
      }
    }

    // The weapon follows the right hand while the hands are off it.
    const hand = handFrame(arms.r);
    if (gripped && w >= 0.999) {
      const inv = Quaternion.Inverse(hand.rot);
      this.inHand.rot = inv.multiply(gripped.rot);
      this.inHand.pos = gripped.pos.subtract(hand.pos).scale(1 / scale).applyRotationQuaternion(inv);
      this.inHand.valid = true;
    } else if (!this.inHand.valid) {
      // Never gripped yet (a knife, or an action from the start): at the palm, pointing along the aim.
      const inv = Quaternion.Inverse(hand.rot);
      this.inHand.rot = inv.multiply(aim);
      this.inHand.pos = palmWorld(arms.r).subtract(hand.pos).scale(1 / scale).applyRotationQuaternion(inv).subtract(new Vector3(...grip.grip).applyRotationQuaternion(this.inHand.rot));
      this.inHand.valid = true;
    }
    if (!gripped) closeHand(space, arms.r, 1);
    const carried = { rot: hand.rot.multiply(this.inHand.rot), pos: hand.pos.add(this.inHand.pos.scale(scale).applyRotationQuaternion(hand.rot)) };
    const at = gripped ? Vector3.Lerp(carried.pos, gripped.pos, w) : carried.pos;
    const rot = gripped ? Quaternion.Slerp(carried.rot, gripped.rot, w) : carried.rot;

    // Into the root's space.
    weapon.position.copyFrom(Vector3.TransformCoordinates(at, root.getWorldMatrix().clone().invert()));
    weapon.rotationQuaternion = Quaternion.Inverse(rootRot).multiply(rot);
  }

  /** Hands onto a weapon placed elsewhere: palms to its grip and support points, fingers closed. */
  private gripPlaced(weapon: TransformNode, grip: WeaponHold, arms: { r: Arm; l: Arm }, space: SkeletonSpace, scale: number): void {
    weapon.computeWorldMatrix(true);
    const world = weapon.getWorldMatrix();
    const point = (p: ModelPoint) => Vector3.TransformCoordinates(new Vector3(p[0], p[1], p[2]), world);
    const pos = (n: TransformNode) => {
      n.computeWorldMatrix(true);
      return n.getAbsolutePosition().clone();
    };
    const outward = pos(arms.r.upper).subtract(pos(arms.l.upper)).normalize();
    const down = Vector3.TransformNormal(new Vector3(0, -1, 0), world).normalize();
    const w = this.ik;
    solveArm(space, arms.r, palmOnGrip(arms.r, point(grip.grip), scale), pos(arms.r.upper).add(outward.scale(0.35 * scale)).add(down.scale(0.3 * scale)), w);
    closeHand(space, arms.r, w);
    if (grip.support) {
      solveArm(space, arms.l, palmOnGrip(arms.l, point(grip.support), scale), pos(arms.l.upper).subtract(outward.scale(0.1 * scale)).add(down.scale(0.4 * scale)), w);
      closeHand(space, arms.l, w * 0.7);
    }
  }

  dispose(): void {
    this.scene.onAfterAnimationsObservable.remove(this.observer);
    this.aimUpper?.dispose();
    this.weapon?.dispose();
    this.ch.dispose();
  }
}


/**
 * The skeleton's own space (its root joint's). The glTF import mirrors the
 * scene above the skeleton, so world matrices of joints are not pure rotations;
 * relative to the root joint the mirror cancels and rotations compose normally.
 */
export class SkeletonSpace {
  private readonly toSpace: Matrix;

  constructor(private readonly rootJoint: TransformNode) {
    rootJoint.computeWorldMatrix(true);
    this.toSpace = rootJoint.getWorldMatrix().clone().invert();
  }

  point(world: Vector3): Vector3 {
    return Vector3.TransformCoordinates(world, this.toSpace);
  }

  pos(n: TransformNode): Vector3 {
    n.computeWorldMatrix(true);
    return this.point(n.getAbsolutePosition());
  }

  rot(n: TransformNode): Quaternion {
    if (n === this.rootJoint) return Quaternion.Identity();
    n.computeWorldMatrix(true);
    const m = n.getWorldMatrix().multiply(this.toSpace);
    const q = new Quaternion();
    m.decompose(undefined, q);
    return q;
  }

  /** Set a joint's rotation in this space (blended by `weight` from its current pose). */
  setRot(n: TransformNode, rot: Quaternion, weight: number): void {
    const parent = n.parent as TransformNode;
    const local = Quaternion.Inverse(this.rot(parent)).multiply(rot);
    n.rotationQuaternion = weight >= 1 ? local : Quaternion.Slerp(n.rotationQuaternion ?? Quaternion.Identity(), local, weight);
    n.computeWorldMatrix(true);
  }
}

const refreshArm = (arm: Arm) => {
  arm.upper.computeWorldMatrix(true);
  arm.lower.computeWorldMatrix(true);
  arm.hand.computeWorldMatrix(true);
};

/** Half the thickness of a gun's grip (m): the palm rests this far from the grip's centre line, so closed fingers wrap round it. */
const GRIP_RADIUS = 0.034;
/**
 * The same for a measured palm (its centre is the middle of the hand's thickness, about 1.2 cm nearer
 * the palm side than the rig's palm point): the offset that puts the rig's own mannequin hand where
 * GRIP_RADIUS does, for a hand REF_HAND_THICKNESS thick (the mannequin's, measured the same way).
 */
const GRIP_RADIUS_MEASURED = 0.022;
const REF_HAND_THICKNESS = 0.026;
/** A thin hand's palm still rests this far out (m), so the grip never ends up behind it. */
const MIN_GRIP_OFFSET = 0.012;

/** Where to put a palm so the grip point sits inside the closed hand rather than in the palm itself. */
function palmOnGrip(arm: Arm, gripPoint: Vector3, scale: number): Vector3 {
  return gripPoint.subtract(palmSideWorld(arm).scale(arm.gripOffset * scale));
}

/** Unit vector out of the palm (the side the fingers close toward), in world space. */
function palmSideWorld(arm: Arm): Vector3 {
  for (const n of [arm.hand, arm.knuckle, arm.index, arm.pinky, arm.thumb]) n.computeWorldMatrix(true);
  const wrist = arm.hand.getAbsolutePosition();
  const forward = arm.knuckle.getAbsolutePosition().subtract(wrist).normalize();
  const across = arm.index.getAbsolutePosition().subtract(arm.pinky.getAbsolutePosition()).normalize();
  const towardThumb = arm.thumb.getAbsolutePosition().subtract(wrist);
  const side = towardThumb.subtract(forward.scale(Vector3.Dot(towardThumb, forward))).subtract(across.scale(Vector3.Dot(towardThumb, across)));
  return side.lengthSquared() > 1e-10 ? side.normalize() : Vector3.Zero();
}

/** World position of a hand's palm centre. */
function palmWorld(arm: Arm): Vector3 {
  arm.hand.computeWorldMatrix(true);
  return Vector3.TransformCoordinates(arm.palm, arm.hand.getWorldMatrix());
}

/** A proper (unmirrored) world frame for a hand, from its knuckles: +Z along the fingers. */
function handFrame(arm: Arm): { pos: Vector3; rot: Quaternion } {
  for (const n of [arm.hand, arm.knuckle, arm.index, arm.pinky]) n.computeWorldMatrix(true);
  const wrist = arm.hand.getAbsolutePosition().clone();
  const forward = arm.knuckle.getAbsolutePosition().subtract(wrist).normalize();
  const across = arm.index.getAbsolutePosition().subtract(arm.pinky.getAbsolutePosition());
  const up = Vector3.Cross(forward, across).normalize();
  const rot = new Quaternion();
  Quaternion.FromLookDirectionLHToRef(forward, up, rot);
  return { pos: wrist, rot };
}

/**
 * Two-bone IK: turn the upper and lower arm so the palm reaches `palmTarget`
 * (world), with the elbow bending toward `pole` (world), keeping the hand's
 * orientation. `weight` blends from the animated pose (0) to the solved one (1).
 */
function solveArm(space: SkeletonSpace, arm: Arm, palmTarget: Vector3, pole: Vector3, weight: number): void {
  refreshArm(arm);
  const handRot = space.rot(arm.hand);
  const a = space.pos(arm.upper);
  const b = space.pos(arm.lower);
  const c = space.pos(arm.hand);
  // The wrist goes where the palm must be, given the hand keeps its orientation.
  const palmOffset = space.point(palmWorld(arm)).subtract(c);
  const target = space.point(palmTarget).subtract(palmOffset);
  const l1 = Vector3.Distance(a, b);
  const l2 = Vector3.Distance(b, c);
  const toTarget = target.subtract(a);
  const d = Math.min(Math.max(toTarget.length(), Math.abs(l1 - l2) + 1e-4), (l1 + l2) * 0.999);
  const dir = toTarget.normalize();
  const toPole = space.point(pole).subtract(a);
  const bend = toPole.subtract(dir.scale(Vector3.Dot(toPole, dir))).normalize();
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const elbow = a.add(dir.scale(l1 * cosA)).add(bend.scale(l1 * Math.sqrt(Math.max(0, 1 - cosA * cosA))));

  space.setRot(arm.upper, turn(b.subtract(a), elbow.subtract(a)).multiply(space.rot(arm.upper)), weight);
  refreshArm(arm);
  const b2 = space.pos(arm.lower);
  const c2 = space.pos(arm.hand);
  space.setRot(arm.lower, turn(c2.subtract(b2), a.add(dir.scale(d)).subtract(b2)).multiply(space.rot(arm.lower)), weight);
  refreshArm(arm);
  space.setRot(arm.hand, handRot, weight);
}

/** Curl the fingers toward the palm (the side the thumb is on), as if round a grip. */
function closeHand(space: SkeletonSpace, arm: Arm, weight: number): void {
  // A measured hand closes as far as it was found able to (not at all if it is rigid or already a fist).
  weight *= arm.curl;
  if (weight <= 0) return;
  const wrist = space.pos(arm.hand);
  const forward = space.pos(arm.knuckle).subtract(wrist).normalize();
  const across = space.pos(arm.index).subtract(space.pos(arm.pinky)).normalize();
  const towardThumb = space.pos(arm.thumb).subtract(wrist);
  const palmSide = towardThumb.subtract(forward.scale(Vector3.Dot(towardThumb, forward))).subtract(across.scale(Vector3.Dot(towardThumb, across)));
  // Rotating about `across` by +angle must move the fingers toward the palm side.
  const sign = Vector3.Dot(forward.applyRotationQuaternion(Quaternion.RotationAxis(across, 0.5)), palmSide) > 0 ? 1 : -1;
  const curl = [0.9, 1.1, 0.7];
  for (const chain of arm.fingers) {
    chain.forEach((joint, i) => {
      const q = Quaternion.RotationAxis(across, sign * curl[i]! * weight);
      space.setRot(joint, q.multiply(space.rot(joint)), 1);
    });
  }
}

/** The rotation taking direction `from` to direction `to`. */
function turn(from: Vector3, to: Vector3): Quaternion {
  const q = new Quaternion();
  Quaternion.FromUnitVectorsToRef(from.normalizeToNew(), to.normalizeToNew(), q);
  return q;
}

