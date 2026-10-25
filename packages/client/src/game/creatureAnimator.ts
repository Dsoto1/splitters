import type { Scene } from '@babylonjs/core/scene';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { CreatureInstance } from '../content/creatures.ts';
import type { MotionState, OneShot } from './characterAnimator.ts';

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

  constructor(
    private readonly scene: Scene,
    readonly ch: CreatureInstance,
    private readonly armed = false,
  ) {
    if (armed) for (const m of ch.meshes) if (/mace|stick|club/i.test(m.name)) m.setEnabled(false);
    this.alien = ch.spec.body === 'alien' || !ch.clips.has('walk');
    this.baseY = ch.body.position.y;
    this.hipScale = ch.hipHeight / RIG_HIPS;
    this.play('idle', 1);
    this.observer = scene.onBeforeRenderObservable.add(() => this.animateBody());
  }

  /** NPC creatures hold no weapon (whatever they're handed is dropped); a player's creature carries its gun. */
  hold(weapon: TransformNode | null): void {
    this.weapon?.dispose();
    this.weapon = null;
    if (!weapon) return;
    if (!this.armed) return weapon.dispose();
    this.weapon = weapon;
    weapon.parent = this.ch.root;
    weapon.rotationQuaternion = null;
    // Gun models point down -Z; creatures face +Z.
    weapon.rotation.set(0, Math.PI, 0);
    this.placeWeapon();
  }

  /** In the right hand when there is one; aliens (no hands) carry it floating at the chest. */
  private placeWeapon(): void {
    const w = this.weapon;
    if (!w) return;
    const hand = this.ch.joints.get('hand_r');
    if (hand && !this.alien) {
      this.ch.root.computeWorldMatrix(true);
      const inv = Matrix.Invert(this.ch.root.getWorldMatrix());
      w.position.copyFrom(Vector3.TransformCoordinates(hand.getAbsolutePosition(), inv));
    } else w.position.set(-0.28, 1.05, 0.45);
  }

  /** Creatures are never ragdolled (their skeletons aren't ours); they play their death instead. */
  get skeletonRoot(): undefined {
    return undefined;
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
    const want: Loop = s.speed < 0.5 ? 'idle' : this.alien || s.speed < 3 * this.hipScale ? (this.alien ? 'idle' : 'walk') : 'run';
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
      if (c === 'walk') g.speedRatio = Math.max(0.5, Math.min(2.5, s.speed / (RIG_WALK * this.hipScale)));
      else if (c === 'run') g.speedRatio = Math.max(0.6, Math.min(2.5, s.speed / (RIG_RUN * this.hipScale)));
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
    this.placeWeapon();
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
  }

  dispose(): void {
    this.scene.onBeforeRenderObservable.remove(this.observer);
    this.weapon?.dispose();
    this.ch.dispose();
  }
}
