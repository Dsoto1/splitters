import type { Scene } from '@babylonjs/core/scene';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { WeaponHold } from '@tiletrigger/shared';
import type { CreatureInstance } from '../content/creatures.ts';
import { gripReport } from './handProbe.ts';
import { SkeletonSpace, armsFrom, holdWith, type HoldingArms, type MotionState, type OneShot } from './characterAnimator.ts';

/** Natural ground speed (m/s) of the rig's walk and run for a body with hips 0.92 m up. */
const RIG_WALK = 1.6;
const RIG_RUN = 4.2;
const RIG_HIPS = 0.92;
const FADE_PER_SEC = 8;
/** Overlays (attacks, flinches) outweigh locomotion. */
const OVERLAY_WEIGHT = 4;
/** Procedural motions of the aliens (seconds). */
const LUNGE_TIME = 0.45;
const FLINCH_TIME = 0.25;
const DEATH_TIME = 0.9;

type Loop = 'idle' | 'walk' | 'run';

/**
 * Drives a creature NPC. Humanoid creatures (our rig's clips retargeted onto
 * them) crossfade idle, walk and run by speed and play attack, hit and death
 * clips. Aliens have only an idle clip, so walking leans the body into the
 * motion and speeds the idle up, attacks lunge, hits jolt, and death drops the
 * body to the ground and rolls it over; all of this runs on the scene's clock,
 * so a body left lying as a corpse finishes falling on its own. Creatures
 * carry no weapon and are never ragdolled.
 */
export class CreatureAnimator {
  private readonly weights = new Map<Loop, number>([
    ['idle', 1],
    ['walk', 0],
    ['run', 0],
  ]);
  private current: Loop = 'idle';
  private overlay: { clip: AnimationGroup | null; until: number } | null = null;
  private dead = false;
  private readonly observer: Observer<Scene>;
  private readonly alien: boolean;
  /** Procedural pose of the body node: forward lean, roll, forward push, drop (aliens; deaths of all). */
  private lean = 0;
  private lunge: { start: number; length: number; reach: number } | null = null;
  private flinchAt = -1;
  private deathAt = -1;
  private readonly baseY: number;
  private readonly hipScale: number;
  private bob = 0;

  /** A player wearing this creature: its club is put away and it carries the player's gun. */
  private weapon: TransformNode | null = null;
  private grip: WeaponHold | null = null;
  /** Its arms for holding a gun (humanoids with our rig's arm joints), and their skeleton's root joint. */
  private readonly arms: HoldingArms | null;
  private readonly skelRoot: TransformNode | undefined;
  /** Aim pitch (radians, + up) and how far the hands are on the gun (0 while an attack swings). */
  private pitch = 0;
  private ik = 1;

  constructor(
    private readonly scene: Scene,
    readonly ch: CreatureInstance,
    private readonly armed = false,
  ) {
    if (armed) for (const m of ch.meshes) if (/mace|stick|club/i.test(m.name)) m.setEnabled(false);
    this.alien = ch.spec.body === 'alien' || !ch.clips.has('walk');
    this.baseY = ch.body.position.y;
    this.hipScale = ch.hipHeight / RIG_HIPS;
    this.arms = armed && !this.alien ? armsFrom(ch.joints, ch.meshes) : null;
    this.skelRoot = ch.joints.get('root');
    this.play('idle', 1);
    this.observer = scene.onBeforeRenderObservable.add(() => this.animateBody());
  }

  /** NPC creatures hold no weapon (whatever they're handed is dropped); a player's creature carries its gun. */
  hold(weapon: TransformNode | null, grip: WeaponHold | null = null): void {
    this.weapon?.dispose();
    this.weapon = null;
    this.grip = null;
    if (!weapon) return;
    if (!this.armed) return weapon.dispose();
    this.weapon = weapon;
    this.grip = grip;
    // Held at its own size, beside the body (not under the creature's scaled model).
    weapon.parent = this.ch.root.parent ?? null;
    weapon.rotationQuaternion = Quaternion.Identity();
    weapon.scaling.setAll(1);
    this.placeWeapon();
  }

  /**
   * A humanoid holds a gun as a player does: pointed along the aim from in front of the right shoulder (a long
   * gun's butt in the shoulder pocket, a pistol out in front of the chest), and the hands closed on its grip and
   * support by the arm IK. (It used to hang in the clip's right hand, barrel back and at the hip.) Aliens, with
   * no hands, carry it floating at the chest.
   */
  private placeWeapon(): void {
    const w = this.weapon;
    if (!w) return;
    const root = this.ch.root;
    root.computeWorldMatrix(true);
    const rm = root.getWorldMatrix();
    const fwd = Vector3.TransformNormal(new Vector3(0, 0, 1), rm);
    fwd.y = 0;
    if (fwd.lengthSquared() < 1e-8) fwd.set(0, 0, 1);
    fwd.normalize();
    const right = new Vector3(fwd.z, 0, -fwd.x);
    const aim = Quaternion.RotationYawPitchRoll(Math.atan2(fwd.x, fwd.z), -this.pitch, 0);
    const ahead = new Vector3(0, 0, 1).applyRotationQuaternion(aim);
    let pos: Vector3;
    const arms = this.arms;
    if (arms && this.grip && !this.dead) {
      for (const n of [arms.r.upper, arms.r.lower, arms.r.hand]) n.computeWorldMatrix(true);
      const s = arms.r.upper.getAbsolutePosition().clone();
      const reach = Vector3.Distance(s, arms.r.lower.getAbsolutePosition()) + Vector3.Distance(arms.r.lower.getAbsolutePosition(), arms.r.hand.getAbsolutePosition());
      const g = this.grip;
      const at = (p: readonly number[]) => new Vector3(p[0], p[1], p[2]).applyRotationQuaternion(aim);
      if (g.style === 'long' && g.shoulder) {
        // The butt against the chest under the shoulder (a creature's big head sits over its shoulders: a cheek weld put the gun through it).
        const pocket = s.add(right.scale(0.04)).add(ahead.scale(0.12)).add(new Vector3(0, -0.2, 0));
        pos = pocket.subtract(at(g.shoulder));
      } else {
        // A pistol out in front of the chest, its grip about three quarters of the arm's reach along the aim.
        const gripAt = s.subtract(right.scale(0.12)).add(ahead.scale(reach * 0.72)).add(new Vector3(0, -0.06, 0));
        pos = gripAt.subtract(at(g.grip));
      }
    } else if (!this.alien) {
      const hand = this.ch.joints.get('hand_r');
      pos = hand ? hand.getAbsolutePosition().clone() : Vector3.TransformCoordinates(new Vector3(0.28, 1.05, 0.45), rm);
    } else pos = Vector3.TransformCoordinates(new Vector3(-0.28, 1.05, 0.45), rm);
    // Into its parent's space.
    const parent = w.parent as TransformNode | null;
    if (parent) {
      parent.computeWorldMatrix(true);
      const pm = parent.getWorldMatrix();
      w.position.copyFrom(Vector3.TransformCoordinates(pos, Matrix.Invert(pm)));
      w.rotationQuaternion = Quaternion.Inverse(Quaternion.FromRotationMatrix(pm.getRotationMatrix())).multiply(aim);
    } else {
      w.position.copyFrom(pos);
      w.rotationQuaternion = aim;
    }
    w.computeWorldMatrix(true);
    if (arms && this.grip && this.skelRoot && !this.dead) holdWith(new SkeletonSpace(this.skelRoot), arms, w, this.grip, 1, this.ik);
  }

  /** Creatures are never ragdolled (their skeletons aren't ours); they play their death instead. */
  get skeletonRoot(): undefined {
    return undefined;
  }

  /**
   * Where the hands are drawn on the held gun (tests; handProbe.ts), and how the gun points: `facing` 1 when its
   * barrel runs the way the body faces (it was -1: carried backwards), `height` of its grip over the feet (m).
   */
  drawnGrip(): (ReturnType<typeof gripReport> & { facing: number; height: number }) | null {
    const w = this.weapon;
    if (!w || !this.grip || !this.arms || this.dead || w.isDisposed()) return null;
    w.computeWorldMatrix(true);
    this.ch.root.computeWorldMatrix(true);
    const barrel = Vector3.TransformNormal(new Vector3(0, 0, 1), w.getWorldMatrix()).normalize();
    const facing = Vector3.TransformNormal(new Vector3(0, 0, 1), this.ch.root.getWorldMatrix()).normalize();
    const grip = Vector3.TransformCoordinates(new Vector3(...this.grip.grip), w.getWorldMatrix());
    return { ...gripReport(this.ch.meshes, this.arms, w, this.grip, 1), facing: Vector3.Dot(barrel, facing), height: grip.y - this.ch.root.getAbsolutePosition().y };
  }

  get isDead(): boolean {
    return this.dead;
  }

  update(dt: number, s: MotionState): void {
    if (!s.alive) {
      if (!this.dead) this.die();
      return;
    }
    if (this.dead) this.revive();
    this.pitch = s.pitch;
    // The hands come off the gun while an attack swings and go back after (a flinch keeps them on).
    const ikTarget = this.overlay?.clip === this.ch.clips.get('attack') && this.overlay ? 0 : 1;
    this.ik += Math.sign(ikTarget - this.ik) * Math.min(Math.abs(ikTarget - this.ik), dt * 6);
    const gait = this.ch.spec.gait;
    const runFrom = gait ? gait.runFrom : 3 * this.hipScale;
    const want: Loop = s.speed < (gait ? 0.15 : 0.5) ? 'idle' : this.alien || s.speed < runFrom ? (this.alien ? 'idle' : 'walk') : 'run';
    if (want !== this.current) {
      this.current = want;
      this.play(want, this.weights.get(want) ?? 0);
    }
    for (const [c, w0] of this.weights) {
      const target = c === this.current ? 1 : 0;
      const w = w0 + Math.sign(target - w0) * Math.min(Math.abs(target - w0), dt * FADE_PER_SEC);
      this.weights.set(c, w);
      const g = this.ch.clips.get(c);
      if (!g) continue;
      if (w <= 0.001 && c !== this.current) {
        if (g.isPlaying) g.stop();
        continue;
      }
      g.weight = w;
      if (c === 'walk') g.speedRatio = Math.max(0.5, Math.min(gait ? 4 : 2.5, s.speed / (gait ? gait.walk : RIG_WALK * this.hipScale)));
      else if (c === 'run') g.speedRatio = Math.max(0.6, Math.min(2.5, s.speed / (gait ? gait.run : RIG_RUN * this.hipScale)));
      else if (this.alien) g.speedRatio = 1 + Math.min(2, s.speed * 0.35);
    }
    // Aliens lean into their motion and bob a little faster.
    const leanTarget = this.alien ? Math.min(0.35, s.speed * 0.06) : 0;
    this.lean += (leanTarget - this.lean) * Math.min(1, dt * 6);
    this.bob += dt * (2 + s.speed);
    if (this.overlay && performance.now() > this.overlay.until) {
      this.overlay.clip?.stop();
      this.overlay = null;
    }
  }

  /** Attack (any shot, swing or throw) or flinch. */
  trigger(action: OneShot): void {
    if (this.dead) return;
    if (action === 'hit') {
      this.flinch();
      return;
    }
    if (action === 'reload' || action === 'interact') return;
    // A player's creature fires its gun, not its claws (only a melee swing plays the attack).
    if (this.arms && action === 'shoot') return;
    if (!this.playOverlay('attack', 1.3)) this.lunge = { start: performance.now(), length: LUNGE_TIME * 1000, reach: 0.5 };
  }

  /** A hit landed on it. */
  flinch(): void {
    if (this.dead || this.overlay) return;
    if (!this.playOverlay('hit', 1.5)) this.flinchAt = performance.now();
  }

  private playOverlay(name: string, speed: number): boolean {
    const g = this.ch.clips.get(name);
    if (!g) return false;
    this.overlay?.clip?.stop();
    g.weight = OVERLAY_WEIGHT;
    g.start(false, speed);
    this.overlay = { clip: g, until: performance.now() + ((g.to - g.from) / 60 / speed) * 1000 };
    return true;
  }

  private play(clip: Loop, weight: number): void {
    const g = this.ch.clips.get(clip);
    if (!g) return;
    g.weight = weight;
    if (!g.isPlaying) g.start(true);
  }

  private die(): void {
    this.dead = true;
    this.overlay = null;
    const d = this.ch.clips.get('death');
    for (const g of this.ch.clips.values()) if (g !== d && g.isPlaying) g.stop();
    if (d) {
      d.weight = 1;
      // Holds its last frame: the body stays down.
      d.start(false, 1.1);
    } else {
      // Aliens: freeze where they are and fall (animateBody).
      this.ch.clips.get('idle')?.pause();
      this.deathAt = performance.now();
    }
  }

  private revive(): void {
    this.dead = false;
    this.deathAt = -1;
    this.ch.clips.get('death')?.stop();
    for (const c of this.weights.keys()) this.weights.set(c, c === 'idle' ? 1 : 0);
    this.current = 'idle';
    this.ch.clips.get('idle')?.stop();
    this.play('idle', 1);
  }

  /** Procedural body motion (every frame, also while lying dead). */
  private animateBody(): void {
    const body = this.ch.body;
    const now = performance.now();
    let tilt = this.lean;
    let push = 0;
    let roll = 0;
    let y = this.baseY + (this.alien && !this.dead ? Math.sin(this.bob) * 0.04 : 0);
    if (this.lunge) {
      const f = (now - this.lunge.start) / this.lunge.length;
      if (f >= 1) this.lunge = null;
      else {
        const k = Math.sin(f * Math.PI);
        tilt += 0.45 * k;
        push += this.lunge.reach * k;
      }
    }
    if (this.flinchAt >= 0) {
      const f = (now - this.flinchAt) / (FLINCH_TIME * 1000);
      if (f >= 1) this.flinchAt = -1;
      else tilt -= 0.25 * Math.sin(f * Math.PI);
    }
    if (this.deathAt >= 0) {
      // Drop to the floor and roll onto one side, easing out.
      const f = Math.min(1, (now - this.deathAt) / (DEATH_TIME * 1000));
      const e = 1 - (1 - f) * (1 - f);
      roll = 1.45 * e;
      tilt = 0.3 * e;
      // Floating aliens fall out of their hover; everything settles a little into the floor.
      y = this.baseY - (this.ch.spec.hover + 0.15 * this.ch.spec.scale) * e;
    }
    body.rotation.x = tilt;
    body.rotation.z = roll;
    body.position.z = push;
    body.position.y = y;
    // The gun and the hands on it, with the body where it is this frame.
    this.placeWeapon();
  }

  dispose(): void {
    this.scene.onBeforeRenderObservable.remove(this.observer);
    this.weapon?.dispose();
    this.ch.dispose();
  }
}
