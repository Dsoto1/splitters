import { ease } from './reduceFlashing.ts';
import type { HurtLook } from './hurtVignette.ts';

/**
 * The low-health warning (owner, 2026-11-15: "need more helpful indicators to show I'm really hurting and need
 * health"). Below LOW_HEALTH.start of your health a steady warning comes up and grows as health falls:
 * - the screen's edges darken (a near-black, never a red: LOW_HEALTH_LOOK) and the world loses colour;
 * - a slow heartbeat (ui.heartbeat), faster as it gets worse but never more than once a second;
 * - the health bar brightens gently with each beat (low contrast, at most once a second);
 * - the HUD points at the nearest health (session.ts healthHint).
 * Nothing in it flashes: it eases in and out (slower with Reduce flashing on), it only ever darkens and greys the
 * picture, and the pulse is a small brightness step on a small bar (docs/LOOK.md, "Reduce flashing").
 */
export const LOW_HEALTH = {
  /** Share of full health below which it starts, and where it is at its strongest. */
  start: 0.35,
  worst: 0.05,
  /** Its strength as it starts (so it is visible at once), 0..1. */
  floor: 0.3,
  /** Seconds between two heartbeats as it starts and at its worst (never under 1: at most once a second). */
  beatSlow: 1.35,
  beatFast: 1,
  /** How fast it comes and goes (s); Reduce flashing on: slower in. */
  rise: 0.6,
  calmRise: 1.2,
  fall: 1,
  /** How much colour the world loses at full strength (Babylon's colour curves, -100..100). */
  desaturate: 45,
  /** The edge's opacity at full strength. */
  edge: 0.95,
} as const;

/** The darkened edge: near-black with a cool cast, reaching further in than the hurt vignette. */
export const LOW_HEALTH_LOOK: HurtLook = { inner: 0.3, color: [6, 8, 12], alpha: 0.92 };

/** How strong the warning wants to be at `share` of full health (0..1): 0 above LOW_HEALTH.start. */
export function lowHealthTarget(share: number): number {
  if (!(share < LOW_HEALTH.start) || share <= 0) return 0;
  const k = Math.min(1, (LOW_HEALTH.start - share) / (LOW_HEALTH.start - LOW_HEALTH.worst));
  return LOW_HEALTH.floor + (1 - LOW_HEALTH.floor) * k;
}

/** Seconds between two heartbeats at strength `level` (never under one second). */
export const beatPeriod = (level: number): number => Math.max(1, LOW_HEALTH.beatSlow + (LOW_HEALTH.beatFast - LOW_HEALTH.beatSlow) * Math.max(0, Math.min(1, level)));

export interface LowHealthFrame {
  /** Eased strength, 0..1. */
  level: number;
  /** The dark edge's opacity. */
  edge: number;
  /** Colour taken out of the world (to add to the grade's saturation, negative). */
  saturation: number;
  /** The health bar's brightening this frame, 0..1 (a soft bump with each beat). */
  pulse: number;
  /** A heartbeat starts this frame (play the sound). */
  beat: boolean;
}

/** The warning over time: eased toward what health asks for, a heartbeat clock running while it shows. */
export class LowHealthWarning {
  level = 0;
  private at = 0;
  /** Seconds into the current beat (NaN: no beat running). */
  private phase = Number.NaN;

  /** The frame at `now` (ms), at `share` of full health; `calm` with Reduce flashing on. */
  update(now: number, share: number, alive: boolean, calm: boolean): LowHealthFrame {
    const dt = Math.min(0.1, Math.max(0, (now - (this.at || now)) / 1000));
    this.at = now;
    const want = alive ? lowHealthTarget(share) : 0;
    // Gone at once when you die or respawn (the death screen has its own look); otherwise eased.
    this.level = !alive ? 0 : ease(this.level, want, dt, 1 / (calm ? LOW_HEALTH.calmRise : LOW_HEALTH.rise), 1 / LOW_HEALTH.fall);
    if (this.level < 0.01) {
      this.phase = Number.NaN;
      return { level: this.level, edge: this.level * LOW_HEALTH.edge, saturation: -this.level * LOW_HEALTH.desaturate, pulse: 0, beat: false };
    }
    const period = beatPeriod(this.level);
    let beat = false;
    if (Number.isNaN(this.phase) || this.phase + dt >= period) {
      this.phase = Number.isNaN(this.phase) ? 0 : this.phase + dt - period;
      beat = want > 0;
    } else this.phase += dt;
    // A soft bump over the first 0.4 s of the beat (sin², no edge), smaller with Reduce flashing on.
    const k = this.phase / 0.4;
    const bump = k < 1 ? Math.sin(Math.PI * k) ** 2 : 0;
    const pulse = bump * this.level * (calm ? 0.6 : 1);
    return { level: this.level, edge: this.level * LOW_HEALTH.edge, saturation: -this.level * LOW_HEALTH.desaturate, pulse, beat };
  }
}
