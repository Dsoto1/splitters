import { ease } from './reduceFlashing.ts';

/**
 * The pack effects on two things of the map that matter to play (content/vfx.json map.lasting, `fixture`):
 * the swirl in a portal's frame (Binbun's Portal VFX, a gate, in the pair's colour) and the column of light
 * rising off a jump pad (Binbun's Magic Area VFX, the blue lift area). Lasting effects: placed after the
 * effects of the moment (fire, gas, a charge) and before every decoration (pickup glows, prop flames), the
 * nearest first (game/lastingFx.ts); one that gets no place keeps its plain look (the portal's painted swirl,
 * the pad's glowing ring), and the frame, the rim in the pair's colour, the plate and the chevrons never change.
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
