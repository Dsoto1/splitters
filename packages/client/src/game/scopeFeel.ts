import type { WeaponDefinition } from '@tiletrigger/shared';
import { OPTIC_KINDS, SCOPE_FEEL, WEAPON_OPTICS } from '@tiletrigger/shared/optics';

export { SCOPE_FEEL };

/**
 * Scope feel (docs/GUNPLAY_SPEC.md §15, "Scope feel"; owner, 2026-11-18, the sights and scopes pass, step 3: "sway with
 * breath-hold on Shift/stamina, scope edge darkening, zoom steps, a soft sniper glint (calm under Reduce flashing)").
 * For the magnified optics: the 2-3x optics and the sniper scopes of content/optics.json. No engine code here.
 *
 *  - **Sway and breath**: through a magnified optic the aim drifts in a slow figure of eight (`SCOPE_FEEL.sway`, real
 *    aim). Shift holds your breath on a meter of its own: the drift settles to `swayHeld` of its size while it lasts;
 *    run out and it grows to `swaySpent` until the meter is back to `readyAt`. The size eases between the three
 *    (`settle`), so the aim never jumps when you take or lose your breath.
 *  - **Zoom steps**: the wheel moves through the optic's `steps` (shares of the weapon's own aimed field of view; the
 *    first is the zoom the gun comes up at).
 *  - **The eye box**: the scope's shadow. The picture darkens softly toward the edge of the glass, and a darker crescent
 *    slides in from the side as you turn, as the gun kicks and with the sway, settling when the gun is steady.
 *  - **The glint**: what others see of a sniper scope aimed their way (scopeGlint.ts draws it).
 */

/** A weapon's zoom steps on the wheel: shares of its aimed field of view, the first 1. [1]: one zoom. */
export function zoomSteps(def: Pick<WeaponDefinition, 'id'>): readonly number[] {
  const w = WEAPON_OPTICS[def.id];
  return w?.steps ?? (w ? OPTIC_KINDS[w.default].steps : undefined) ?? [1];
}

/** The zoom step after `wheel` notches (up: closer) from `level`. */
export function stepZoom(level: number, wheel: number, steps: readonly number[]): number {
  return Math.max(0, Math.min(steps.length - 1, level + Math.sign(wheel)));
}

/** Breath and the sway's size now. */
export interface Breath {
  /** The meter, 1 full. */
  level: number;
  /** Ran out: it cannot be held again until it is back to `readyAt`. */
  spent: boolean;
  /** The sway's size as a multiple of `SCOPE_FEEL.sway`, eased. */
  size: number;
}

export const freshBreath = (): Breath => ({ level: 1, spent: false, size: 1 });

/**
 * A frame of breath: `wants` (Shift held) while `scoped`. Returns whether the breath is being held. The meter drains
 * over `breathSeconds` and refills over `recoverSeconds`, scoped or not; the sway's size eases toward its multiple.
 */
export function stepBreath(b: Breath, dt: number, wants: boolean, scoped: boolean, feel: typeof SCOPE_FEEL = SCOPE_FEEL): boolean {
  const holding = scoped && wants && !b.spent;
  b.level = Math.max(0, Math.min(1, b.level + (holding ? -dt / feel.breathSeconds : dt / feel.recoverSeconds)));
  if (b.level === 0) b.spent = true;
  if (b.spent && b.level > feel.readyAt) b.spent = false;
  if (!scoped) {
    // The next time the scope comes up the drift starts at its plain size (or its out-of-breath size).
    b.size = b.spent ? feel.swaySpent : 1;
    return false;
  }
  const want = holding ? feel.swayHeld : b.spent ? feel.swaySpent : 1;
  b.size = feel.settle > 0 ? want + (b.size - want) * Math.exp(-dt / feel.settle) : want;
  return holding;
}

/** The drift `t` seconds into a scope, in units of the sway's size: a slow figure of eight (x across, y up). */
export function swayAt(t: number): { x: number; y: number } {
  return { x: Math.sin(t * 0.9) + Math.sin(t * 2.1) * 0.3, y: Math.sin(t * 1.4) * 0.75 };
}

/**
 * The eye box: how the scope's shadow moves. The glass's clear picture is a circle that slides off the middle by
 * `x`, `y` (shares of the glass's radius, x right, y down on screen); the dark comes in on the other side. Turning
 * moves it the way you turn (the eye leads the scope), a kick moves it against the kick, the sway carries it a little;
 * it eases back when the view is steady. `clear`: where the dark begins, from the picture's own middle; `full`: where
 * it is as dark as it gets. The middle of the glass always stays clear: `max` < `clear`.
 *
 * With Reduce flashing on (`calm`) it moves less far, less dark, and through a slow filter: turning fast back and
 * forth cannot swing a large dark area from side to side (CLAUDE.md, Accessibility).
 */
export const EYE_BOX = {
  /** Where the shadow begins and where it is full, in glass radii from the clear picture's middle. */
  clear: 0.8,
  full: 1.08,
  normal: { turn: 1.5, kick: 2.2, sway: 0.1, decay: 0.12, smooth: 0, max: 0.5, dark: 0.94 },
  calm: { turn: 1, kick: 1.2, sway: 0.06, decay: 0.12, smooth: 0.25, max: 0.3, dark: 0.6 },
  /** Coming up to the eye: the shadow starts this far off (from below) and opens as the scope's fade comes in. */
  enter: 0.45,
} as const;

export interface EyeBox {
  /** The raw offset (turning and kicks add to it; it decays). */
  rx: number;
  ry: number;
  /** As shown. */
  x: number;
  y: number;
}

export function freshEyeBox(calm = false): EyeBox {
  const y = -Math.min(EYE_BOX.enter, (calm ? EYE_BOX.calm : EYE_BOX.normal).max);
  return { rx: 0, ry: y, x: 0, y };
}

/**
 * A frame of the eye box. `turn`: how far the view turned this frame by your own hand (radians; x to the right, y up);
 * `kick`: how far the recoil moved it (the same axes); `fov`: the view's vertical field of view; `sway`: the drift now
 * in units of the plain sway (swayAt times the breath's size).
 */
export function stepEyeBox(e: EyeBox, dt: number, turn: { x: number; y: number }, kick: { x: number; y: number }, fov: number, sway: { x: number; y: number }, calm: boolean): EyeBox {
  const k = calm ? EYE_BOX.calm : EYE_BOX.normal;
  const f = Math.max(0.02, fov);
  const fade = Math.exp(-dt / k.decay);
  e.rx = e.rx * fade + (k.turn * turn.x - k.kick * kick.x) / f;
  e.ry = e.ry * fade + (-k.turn * turn.y + k.kick * kick.y) / f;
  const cap = (x: number, y: number): [number, number] => {
    const len = Math.hypot(x, y);
    return len > k.max ? [(x / len) * k.max, (y / len) * k.max] : [x, y];
  };
  // (The raw offset is capped too, a little over: a long fast turn must not wind up a shadow that lingers.)
  const rl = Math.hypot(e.rx, e.ry);
  if (rl > k.max * 1.5) {
    e.rx *= (k.max * 1.5) / rl;
    e.ry *= (k.max * 1.5) / rl;
  }
  const [wx, wy] = cap(e.rx + k.sway * sway.x, e.ry - k.sway * sway.y);
  const a = k.smooth > 0 ? 1 - Math.exp(-dt / k.smooth) : 1;
  e.x += (wx - e.x) * a;
  e.y += (wy - e.y) * a;
  return e;
}

/** How dark the shadow is `r` glass radii from the clear picture's middle (0..1 of its darkness): the shader's and the HUD's curve. */
export function eyeBoxShade(r: number): number {
  const t = Math.max(0, Math.min(1, (r - EYE_BOX.clear) / (EYE_BOX.full - EYE_BOX.clear)));
  return t * t * (3 - 2 * t);
}

/**
 * The scope's surround coming in and going out (the black round the glass, the reticle, the shadow): seconds to fade
 * in and out. Never a cut: leaving a scope by day would otherwise turn most of the screen from black to daylight in
 * one frame. Slower with Reduce flashing on, so aiming and letting go in quick turns cannot flash.
 */
export const SCOPE_FADE = { normal: { in: 0.16, out: 0.1 }, calm: { in: 0.22, out: 0.22 } } as const;

/** The surround's opacity a frame on. */
export function stepScopeFade(level: number, on: boolean, dt: number, calm: boolean): number {
  const k = calm ? SCOPE_FADE.calm : SCOPE_FADE.normal;
  return on ? Math.min(1, level + dt / k.in) : Math.max(0, level - dt / k.out);
}

/**
 * The sniper glint: a small, soft, steady point of light at the scope of a player who aims a sniper scope your way.
 * It is information (a sniper is looking at you), not a flare: no flicker, no burst, under the bloom threshold.
 *  - shown within `cone` degrees between their aim and the line to your eye, full within `full` degrees;
 *  - from `near[0]` metres, full from `near[1]` (closer you can see the gun itself), fading to `farLevel` by `far[1]`;
 *  - hidden behind walls by the scene's own depth (scopeGlint.ts).
 * With Reduce flashing on it is dimmer and comes up over half a second.
 */
export const GLINT = {
  cone: 14,
  full: 4,
  near: [18, 30],
  far: [120, 320],
  farLevel: 0.55,
  /** Its radius on screen at the hip's field of view, as the tangent of the angle it spans. */
  radius: 0.0075,
  /** How far ahead of their eye, along their aim, it sits (m): at the scope's front glass. */
  ahead: 0.55,
  normal: { level: 0.85, rise: 0.15 },
  calm: { level: 0.5, rise: 0.5 },
  /** Seconds to fade away. */
  fall: 0.25,
} as const;

const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** A unit vector along a yaw and pitch (the sim's convention: yaw 0 looks along +z, pitch up positive). */
export function aimDir(yaw: number, pitch: number): { x: number; y: number; z: number } {
  const c = Math.cos(pitch);
  return { x: Math.sin(yaw) * c, y: Math.sin(pitch), z: Math.cos(yaw) * c };
}

/**
 * How strongly a scope glints (0..1) for a viewer: `eye` the scoped player's eye, `yaw`/`pitch` their aim, `viewer`
 * your eye. 0 outside the cone or nearer than the least distance.
 */
export function glintStrength(eye: { x: number; y: number; z: number }, yaw: number, pitch: number, viewer: { x: number; y: number; z: number }): number {
  const d = { x: viewer.x - eye.x, y: viewer.y - eye.y, z: viewer.z - eye.z };
  const dist = Math.hypot(d.x, d.y, d.z);
  if (!(dist > GLINT.near[0])) return 0;
  const a = aimDir(yaw, pitch);
  const cos = (a.x * d.x + a.y * d.y + a.z * d.z) / dist;
  const off = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  if (off >= GLINT.cone) return 0;
  const angle = 1 - smooth((off - GLINT.full) / (GLINT.cone - GLINT.full));
  const near = smooth((dist - GLINT.near[0]) / (GLINT.near[1] - GLINT.near[0]));
  const far = 1 - (1 - GLINT.farLevel) * smooth((dist - GLINT.far[0]) / (GLINT.far[1] - GLINT.far[0]));
  return angle * near * far;
}

/** A glint's level a frame on, toward `want` (0..1 of its strength): up over `rise`, down over `fall`. */
export function stepGlint(level: number, want: number, dt: number, calm: boolean): number {
  const rise = calm ? GLINT.calm.rise : GLINT.normal.rise;
  return want > level ? Math.min(want, level + dt / rise) : Math.max(want, level - dt / GLINT.fall);
}

/**
 * Whether another player is aiming through a scope, as far as this client can tell. The snapshot does not say who is
 * aiming (PlayerSnapshot has no bit for it), so this reads what it does carry: alive, on their feet (not sprinting,
 * dancing, under a canopy or on a zipline), and for a bot its state (bots scope when they fight: `engage`, `cover`).
 * One bit in the snapshot ("aiming down a scope this tick") would replace this guess: see GUNPLAY_SPEC §15.
 */
export function seemsScoped(p: { alive: boolean; sprinting?: boolean; emote?: boolean; chute?: number; zip?: number; state?: string }): boolean {
  if (!p.alive || p.sprinting || p.emote || p.chute || p.zip !== undefined) return false;
  return p.state === undefined || p.state === 'engage' || p.state === 'cover';
}
