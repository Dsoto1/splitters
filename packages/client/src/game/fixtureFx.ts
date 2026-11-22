import { ease } from './reduceFlashing.ts';

/**
 * The pack effects on two things of the map that matter to play (content/vfx.json map.lasting, `fixture`):
 * the swirl in a portal's frame (Binbun's Portal VFX, a gate, in the pair's colour) and the column of light
 * rising off a jump pad (Binbun's Magic Area VFX, the blue lift area). Lasting effects: placed after the
 * effects of the moment (fire, gas, a charge) and before every decoration (pickup glows, prop flames), the
 * nearest first (game/lastingFx.ts); one that gets no place keeps its plain look (the portal's painted swirl,
 * the pad's glowing ring), and the frame, the rim in the pair's colour and the plate never change.
 *
 * A jump pad's own motion (padChevrons, padRings; owner, 2026-11-17: "it looks like it should have movement"):
 * chevrons glide over the plate the way it throws you and rings rise off it, at every distance and with Reduce
 * flashing on as well (motion is not flashing). Their brightness never changes: each comes in by growing from
 * nothing and goes by shrinking to nothing, in loops a second and a half or longer.
 */

/** Portals further than this from the camera keep their painted swirl. */
export const PORTAL_FX_RANGE = 60;
/** Jump pads further than this from the camera show no lift. */
export const PAD_FX_RANGE = 36;

/** The pack's gate: its swirl and glow quads are this wide and this tall (metres) at scale 1. */
export const PORTAL_GATE = { width: 2.5, height: 3.5, parts: ['PortalMesh', 'GlowMesh'] } as const;

/**
 * How strong each is and how fast it comes up (level a second). With Reduce flashing on it is dimmer, held still
 * (no turning swirl, no rising streaks: LastingPlace.steady) and comes up slowly; either way it eases in rather
 * than popping (a portal switched on, a pad walked into range).
 */
export const FIXTURE_FX = {
  portal: { level: 1, calmLevel: 0.7, rise: 1.2, calmRise: 0.35 },
  pad: { level: 1, calmLevel: 0.6, rise: 0.9, calmRise: 0.3 },
} as const;
export type FixtureKind = keyof typeof FIXTURE_FX;

/** The effect's level after `dt` seconds: toward its strength while it is drawn, nothing while it isn't. */
export function fixtureLevel(kind: FixtureKind, level: number, drawn: boolean, dt: number, calm: boolean): number {
  if (!drawn) return 0;
  const f = FIXTURE_FX[kind];
  return ease(level, calm ? f.calmLevel : f.level, dt, calm ? f.calmRise : f.rise, 4);
}

/** How much of a portal's painted swirl the pack's covers (0: none drawn, 1: fully up), so one hands over to the other. */
export function portalCover(level: number, calm: boolean): number {
  return Math.max(0, Math.min(1, level / (calm ? FIXTURE_FX.portal.calmLevel : FIXTURE_FX.portal.level)));
}

/** How a `width` x `height` portal places the pack's gate: times its size, and its quads stretched to the frame's shape. */
export function portalFit(width: number, height: number): { size: number; stretch: number } {
  return { size: width, stretch: height / width / (PORTAL_GATE.height / PORTAL_GATE.width) };
}

/**
 * A jump pad's motion, in its own frame (+Z the way it throws you; metres and seconds). Reduce flashing slows it.
 * Every loop is longer than a second, and a chevron or ring grows in and shrinks away at one steady brightness.
 */
export const PAD_MOTION = {
  chevrons: 3,
  /** A chevron's glide over the plate (z, from the back to the front). */
  from: -0.55,
  to: 0.7,
  period: 1.6,
  calmPeriod: 2.4,
  rings: 2,
  /** A ring's rise up the lift (height over the plate's foot), and its radius from bottom to top. */
  ringFrom: 0.2,
  ringTo: 2.4,
  ringRadius: [0.85, 0.45] as const,
  ringPeriod: 2,
  calmRingPeriod: 3,
} as const;

const frac = (v: number) => v - Math.floor(v);

/** The pad's chevrons at `t` seconds: where each is along the plate (z) and its size (0 to 1: grown in, then away). */
export function padChevrons(t: number, calm: boolean): { z: number; s: number }[] {
  const m = PAD_MOTION;
  const period = calm ? m.calmPeriod : m.period;
  return Array.from({ length: m.chevrons }, (_, k) => {
    const p = frac(t / period + k / m.chevrons);
    return { z: m.from + (m.to - m.from) * p, s: Math.sin(Math.PI * p) };
  });
}

/** The pad's rings at `t` seconds: height (y), radius (r) and size (s, 0 to 1: grown in at the foot, gone at the top). */
export function padRings(t: number, calm: boolean): { y: number; r: number; s: number }[] {
  const m = PAD_MOTION;
  const period = calm ? m.calmRingPeriod : m.ringPeriod;
  return Array.from({ length: m.rings }, (_, k) => {
    const p = frac(t / period + k / m.rings);
    // Quick off the plate, slowing as it goes up (as a thrown player does).
    const up = 1 - (1 - p) * (1 - p);
    return { y: m.ringFrom + (m.ringTo - m.ringFrom) * up, r: m.ringRadius[0] + (m.ringRadius[1] - m.ringRadius[0]) * p, s: Math.sin(Math.PI * p) };
  });
}
