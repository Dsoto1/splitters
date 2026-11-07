import { ease } from './reduceFlashing.ts';

/**
 * Taking damage: the screen's edge tints (the HUD's #hurt; hud.ts `hurt`). Two looks:
 * - classic (Reduce flashing off): a saturated red edge that snaps on with each hit and fades over 0.6 s;
 * - calm (Reduce flashing on): a darker, duller red (not a saturated red: R / (R + G + B) stays under 0.8 in linear
 *   light, WCAG's red flash test), reaching less far in, that comes up over 0.15 s, holds while hits keep coming and
 *   goes over 0.8 s: under fire it is a steady tint instead of a red pulse with every hit.
 */
export interface HurtLook {
  /** Where the tint starts, as a share of the way from the centre to a corner. */
  readonly inner: number;
  readonly color: readonly [number, number, number];
  /** Its opacity at the corners. */
  readonly alpha: number;
}

export const HURT_LOOKS: Readonly<Record<'classic' | 'calm', HurtLook>> = {
  classic: { inner: 0.55, color: [200, 0, 0], alpha: 0.55 },
  calm: { inner: 0.62, color: [118, 50, 44], alpha: 0.5 },
};

/** Calm: its strength at most (of the classic's for the same hit) and how fast it comes and goes (s). */
export const CALM_HURT = { peak: 0.75, rise: 0.15, hold: 0.35, fall: 0.8 } as const;
/** Classic: a hit shows at full this long, then fades over FADE (s). */
const CLASSIC_HOLD = 0.09;
const CLASSIC_FADE = 0.6;

/** How strong the vignette is over time (0..1), from the hits and the clock. */
export class HurtFade {
  level = 0;
  private peak = 0;
  private lastHit = -Infinity;
  private at = 0;

  /** A hit of `amount` (health and armour lost) at `now` (ms). */
  hit(amount: number, now: number): void {
    const strength = Math.min(1, 0.45 + amount / 40);
    // Calm keeps the strongest hit while they keep coming; classic shows each hit as it is.
    this.peak = now - this.lastHit < CALM_HURT.hold * 1000 ? Math.max(this.peak, strength) : strength;
    this.lastHit = now;
    this.sinceHit = strength;
  }
  /** The newest hit's own strength (classic). */
  private sinceHit = 0;

  /** The strength at `now` (ms), `calm` with Reduce flashing on. */
  update(now: number, calm: boolean): number {
    const dt = Math.min(0.1, Math.max(0, (now - (this.at || now)) / 1000));
    this.at = now;
    const t = (now - this.lastHit) / 1000;
    if (calm) {
      const want = t < CALM_HURT.hold ? this.peak * CALM_HURT.peak : 0;
      this.level = ease(this.level, want, dt, 1 / CALM_HURT.rise, 1 / CALM_HURT.fall);
    } else if (t < CLASSIC_HOLD) this.level = this.sinceHit;
    else {
      const x = Math.min(1, (t - CLASSIC_HOLD) / CLASSIC_FADE);
      this.level = this.sinceHit * (1 - x) * (1 - x);
    }
    return this.level;
  }
}

/**
 * The vignette as a picture (a corner-to-corner radial fade on a square, stretched over the screen: the same ellipse
 * as CSS's `radial-gradient(ellipse at center …)`). The HUD shows it, and the flicker check draws it over the frames.
 */
export function paintVignette(look: HurtLook, size = 256): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const mid = size / 2;
  const g = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid * Math.SQRT2);
  const [r, gr, b] = look.color;
  g.addColorStop(0, `rgba(${r}, ${gr}, ${b}, 0)`);
  g.addColorStop(look.inner, `rgba(${r}, ${gr}, ${b}, 0)`);
  g.addColorStop(1, `rgba(${r}, ${gr}, ${b}, ${look.alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}
