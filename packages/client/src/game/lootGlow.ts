import { getItem } from '@tiletrigger/shared';
import { ease } from './reduceFlashing.ts';

/**
 * The glow on the floor under a pickup waiting to be taken (Binbun's Loot VFX; content/vfx.json map.lasting
 * `loot.<kind>`): weapons gold, health green, armor blue, ammo pale. Decoration: drawn for the nearest few pickups
 * only, after every gameplay effect has its place (game/lastingFx.ts), and the pickup's own look never changes, so
 * one without a glow reads as it always did.
 */

/** Pickups further than this from the camera ask for no glow. */
export const LOOT_GLOW_RANGE = 28;

/**
 * How strong the glow is. With Reduce flashing on it is dimmer, held still (no scrolling streaks, no sparkles:
 * LastingPlace.steady) and comes up slowly; either way it eases in rather than popping (a pickup coming back).
 */
export const LOOT_GLOW = {
  level: 0.8,
  calmLevel: 0.5,
  /** Level a second, up: full in about a second, about two with Reduce flashing on. */
  rise: 0.9,
  calmRise: 0.25,
} as const;

/** The lasting effect for an item's glow (`loot.weapon` …), or null for the kinds that have none. */
export function lootGlowKey(itemId: string): string | null {
  const kind = getItem(itemId)?.effect.kind;
  return kind === 'weapon' || kind === 'health' || kind === 'armor' || kind === 'ammo' ? `loot.${kind}` : null;
}

/** The glow's level after `dt` seconds: toward its strength while it is drawn, nothing while it isn't. */
export function lootGlowLevel(level: number, drawn: boolean, dt: number, calm: boolean): number {
  if (!drawn) return 0;
  return ease(level, calm ? LOOT_GLOW.calmLevel : LOOT_GLOW.level, dt, calm ? LOOT_GLOW.calmRise : LOOT_GLOW.rise, 4);
}

/**
 * The glow's ring on the floor (the pack's Ring_01 torus, inner and outer radius in metres at scale 1:
 * public/vfx/loot_fx.json), per glow. Times the effect's scale (content/vfx.json, 1.25) it is where the dark outline
 * goes (LOOT_OUTLINE).
 */
export const LOOT_RING: Readonly<Record<string, readonly [number, number]>> = {
  'loot.ammo': [0.2, 0.35],
  'loot.health': [0.25, 0.4],
  'loot.armor': [0.35, 0.55],
  'loot.weapon': [0.35, 0.55],
};

/**
 * The thin dark outline round the glow's ring (owner's pick 3a, 2026-11-14: docs/FX_CHECKS_2026-11-13.md, section 2).
 * The glow only adds light, so on a pale floor (sand, snow, white tile) white plus a pale glow stayed near white:
 * 1.06-1.18 contrast on average. Two thin dark lines, one just inside the ring's inner edge and one just past its
 * outer edge, give the ring an edge on any floor and change nothing you'd see on a dark one. They add no brightness,
 * so Reduce flashing keeps them as they are: they follow the glow's own eased level (as a share of that level's full
 * strength), so they come and go with the glow, held still.
 * `width`: each line's width in metres, its soft edges (`feather`) included; `alpha`: how much it darkens at most.
 */
export const LOOT_OUTLINE = { width: 0.05, feather: 0.015, alpha: 0.6 } as const;

/** The ring's [inner, outer] edge in metres for a glow drawn at `scale`, which the outline's lines hug (null: that glow has no ring). */
export function lootOutlineRadii(key: string, scale: number): [number, number] | null {
  const ring = LOOT_RING[key];
  if (!ring) return null;
  return [ring[0] * scale, ring[1] * scale];
}

/** How dark the outline is (0..LOOT_OUTLINE.alpha) for the glow's level: the share of the glow's full level, either setting. */
export function lootOutlineAlpha(level: number, calm: boolean): number {
  const full = calm ? LOOT_GLOW.calmLevel : LOOT_GLOW.level;
  return LOOT_OUTLINE.alpha * Math.max(0, Math.min(1, level / full));
}
