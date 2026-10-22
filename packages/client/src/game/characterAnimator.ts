import type { Scene } from '@babylonjs/core/scene';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { AnimationGroupMask, AnimationGroupMaskMode } from '@babylonjs/core/Animations/animationGroupMask';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
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
  ...['l', 'r'].flatMap((s) => [`clavicle_${s}`, `upperarm_${s}`, `lowerarm_${s}`, `hand_${s}`, ...['index', 'middle', 'pinky', 'ring', 'thumb'].map((f) => `${f}_01_${s}`)]),
];

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

  /** Carry a weapon model in the right hand (null to empty the hands). */
  hold(weapon: TransformNode | null): void {
    this.weapon?.dispose();
    this.weapon = weapon;
    if (weapon) weapon.parent = this.ch.root;
  }

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
    }
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

  /** Bend the spine for aim pitch and counter-twist the hip turn, then place the weapon at the hand. */
  private afterAnimations(): void {
    if (this.dead || !this.spine.length) return;
    const root = this.ch.root;
    root.computeWorldMatrix(true);
    const rootRot = Quaternion.FromRotationMatrix(root.getWorldMatrix().getRotationMatrix());
    const right = Vector3.TransformNormal(Vector3.Right(), Matrix.FromQuaternionToRef(rootRot, new Matrix()));
    const up = Vector3.Up();
    for (const bone of this.spine) {
      const parent = bone.parent as TransformNode | null;
      if (!parent || !bone.rotationQuaternion) continue;
      parent.computeWorldMatrix(true);
      const inv = Quaternion.FromRotationMatrix(parent.getWorldMatrix().getRotationMatrix()).invert();
      const toLocal = Matrix.FromQuaternionToRef(inv, new Matrix());
      const pitchAxis = Vector3.TransformNormal(right, toLocal).normalize();
      const twistAxis = Vector3.TransformNormal(up, toLocal).normalize();
      const share = 1 / this.spine.length;
      const q = Quaternion.RotationAxis(pitchAxis, this.pitch * share).multiply(Quaternion.RotationAxis(twistAxis, -this.twist * share));
      bone.rotationQuaternion = q.multiply(bone.rotationQuaternion);
    }
    if (this.weapon && this.hand) {
      this.hand.computeWorldMatrix(true);
      const handWorld = this.hand.getAbsolutePosition();
      const invRoot = root.getWorldMatrix().clone().invert();
      this.weapon.position.copyFrom(Vector3.TransformCoordinates(handWorld, invRoot).divide(root.scaling));
      this.weapon.rotation.set(-this.pitch, 0, 0);
    }
  }

  dispose(): void {
    this.scene.onAfterAnimationsObservable.remove(this.observer);
    this.aimUpper?.dispose();
    this.weapon?.dispose();
    this.ch.dispose();
  }
}
