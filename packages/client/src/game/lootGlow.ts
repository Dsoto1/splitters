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
