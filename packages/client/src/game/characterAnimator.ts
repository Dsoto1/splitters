import type { Scene } from '@babylonjs/core/scene';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { AnimationGroupMask, AnimationGroupMaskMode } from '@babylonjs/core/Animations/animationGroupMask';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { ModelPoint, WeaponHold } from '@chronosplit/shared';
import type { CharacterInstance, Clip } from '../content/characters.ts';

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
}

export type OneShot = 'shoot' | 'melee' | 'melee_heavy' | 'reload' | 'hit' | 'throw' | 'interact';

const LOOPS: readonly Clip[] = ['aim_idle', 'walk', 'run', 'sprint', 'jump_air', 'dance'];
/** Natural ground speed of each locomotion clip (m/s), used to match foot speed. */
const CLIP_SPEED: Partial<Record<Clip, number>> = { walk: 1.6, run: 4.2, sprint: 6.5 };
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
const HANDS_OFF: ReadonlySet<OneShot> = new Set(['reload', 'melee', 'melee_heavy', 'throw', 'interact', 'hit']);
/** Upper-body turn (radians) that brings the left shoulder forward onto a long gun. */
const LONG_GUN_BLADE = 0.45;

/** An arm for the IK solver. */
interface Arm {
  upper: TransformNode;
  lower: TransformNode;
  hand: TransformNode;
  /** Palm centre in the hand's local space (where a grip sits). */
  palm: Vector3;
  /** Finger chains (index, middle, ring, pinky), knuckle first, for closing the hand. */
  fingers: TransformNode[][];
  /** Knuckles used to build the hand's frame. */
  index: TransformNode;
  pinky: TransformNode;
  knuckle: TransformNode;
  thumb: TransformNode;
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
      // The palm sits a little over halfway from the wrist to the middle knuckle.
      return { upper, lower, hand, palm: knuckle.position.scale(0.6), fingers, index, pinky, knuckle, thumb };
    };
    const [r, l] = [arm('r'), arm('l')];
    this.arms = r && l ? { r, l } : null;
    this.skelRoot = ch.joints.get('root');
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

  update(dt: number, s: MotionState): void {
    if (!s.alive) {
      if (!this.dead) this.die();
      return;
    }
    if (this.dead) this.revive();
    this.pitch = s.pitch;

    // Backpedal by playing the run in reverse; strafe by turning the hips toward the motion.
    const back = s.speed > 0.5 && Math.abs(s.moveAngle) > Math.PI * 0.6;
    const side = s.speed > 0.5 && !back ? Math.max(-1.1, Math.min(1.1, s.moveAngle)) : back ? Math.max(-0.6, Math.min(0.6, Math.PI - Math.abs(s.moveAngle))) * -Math.sign(s.moveAngle) : 0;
    this.twist += (side - this.twist) * Math.min(1, dt * 10);

    let want: Clip;
    if (s.celebrate) want = 'dance';
    else if (s.airborne) want = 'jump_air';
    else if (s.speed < 0.6) want = 'aim_idle';
    else if (s.speed < 3) want = 'walk';
    else if (s.speed < 7.6) want = 'run';
    else want = 'sprint';
    if (want !== this.current) {
      this.current = want;
      this.play(want, this.weights.get(want) ?? 0);
    }
    for (const c of LOOPS) {
      const target = c === this.current ? 1 : 0;
      let w = this.weights.get(c)!;
      w += Math.sign(target - w) * Math.min(Math.abs(target - w), dt * FADE_PER_SEC);
      this.weights.set(c, w);
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

    if (this.aimUpper) this.aimUpper.weight = 1 - (this.weights.get('dance') ?? 0);

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
  }

  /** Play an upper-body action once, over whatever the legs are doing. */
  trigger(action: OneShot): void {
    if (this.dead) return;
    const g = this.ch.clips.get(action);
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

  private die(): void {
    this.dead = true;
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
    if (this.dead || !this.spine.length) return;
    const root = this.ch.root;
    root.computeWorldMatrix(true);
    const rootRot = Quaternion.FromRotationMatrix(root.getWorldMatrix().getRotationMatrix());
    const right = Vector3.TransformNormal(Vector3.Right(), Matrix.FromQuaternionToRef(rootRot, new Matrix()));
    const up = Vector3.Up();
    const twist = this.twist - this.blade;
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
    if (grip.style === 'pistol') {
      gripped = { rot: aim, pos: palmWorld(arms.r).subtract(new Vector3(...grip.grip).scale(scale).applyRotationQuaternion(aim)) };
    } else if (grip.style === 'long' && grip.shoulder) {
      const shoulder = pos(arms.r.upper);
      const inward = pos(this.spine[this.spine.length - 1]!).subtract(shoulder);
      inward.y = 0;
      // The stock sits just inside the shoulder joint, a little in front and below.
      const pocket = shoulder.add(inward.normalize().scale(0.07 * scale)).add(new Vector3(0, -0.03, 0.05).scale(scale).applyRotationQuaternion(aim));
      gripped = { rot: aim, pos: pocket.subtract(new Vector3(...grip.shoulder).scale(scale).applyRotationQuaternion(aim)) };
    }

    const w = gripped ? this.ik : 0;
    if (gripped && w > 0) {
      const outward = pos(arms.r.upper).subtract(pos(arms.l.upper)).normalize();
      const down = new Vector3(0, -1, 0);
      if (grip.style === 'long') {
        solveArm(space, arms.r, point(gripped.pos, gripped.rot, grip.grip), pos(arms.r.upper).add(outward.scale(0.35)).add(down.scale(0.3)), w);
        closeHand(space, arms.r, w);
      } else closeHand(space, arms.r, w);
      if (grip.support) {
        solveArm(space, arms.l, point(gripped.pos, gripped.rot, grip.support), pos(arms.l.upper).subtract(outward.scale(0.1)).add(down.scale(0.4)), w);
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
    solveArm(space, arms.r, point(grip.grip), pos(arms.r.upper).add(outward.scale(0.35 * scale)).add(down.scale(0.3 * scale)), w);
    closeHand(space, arms.r, w);
    if (grip.support) {
      solveArm(space, arms.l, point(grip.support), pos(arms.l.upper).subtract(outward.scale(0.1 * scale)).add(down.scale(0.4 * scale)), w);
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
class SkeletonSpace {
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

