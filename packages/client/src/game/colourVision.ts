/**
 * Colour vision (Options → Accessibility; docs/LOOK.md, "Colour vision"; owner, 2026-11-19): teams told apart by more
 * than colour.
 * - **Default** keeps the teams' own colours (the map's, the host's or the palette's).
 * - **Red-green safe** (deuteranopia and protanopia) and **Tritanopia** (blue-yellow) give the teams, in order, colours
 *   that stay apart with that colour vision: orange and blue for red-green, raspberry and teal for tritanopia, then
 *   colours picked to stay as far apart as they can (teamColours.ts, TEAM_SAFE_COLOURS; their gaps are checked by
 *   simulation in colourVision.test.ts, colourSim.ts). A map's or host's own team colours give way to them.
 * Whatever the setting, every team also has its symbol beside its colour (teamSymbols.ts).
 * Saved in this browser, and with your profile when signed in (careerStats.ts, chooseColourVision). The game reads it as
 * a match starts (the HUD, minimap, kill feed, scoreboard, flags, vehicles and forts take teamColours.ts's colours).
 * The menu loads only this file (the setting); the colours are the game's (teamColours.ts).
 */
import { COLOUR_VISION_IDS, isColourVisionId, type ColourVisionId } from '@tiletrigger/shared';

export const COLOUR_VISIONS = COLOUR_VISION_IDS;
export type ColourVision = ColourVisionId;

export const COLOUR_VISION_LABELS: Readonly<Record<ColourVision, string>> = {
  default: 'Default',
  redgreen: 'Red-green (deuteranopia, protanopia)',
  tritan: 'Tritanopia (blue-yellow)',
};

const KEY = 'tiletrigger.colourVision';

export const isColourVision = isColourVisionId;

/** The saved setting: Default unless chosen. */
export function loadColourVision(): ColourVision {
  try {
    const v = localStorage.getItem(KEY);
    return isColourVision(v) ? v : 'default';
  } catch {
    // Private windows: the default.
    return 'default';
  }
}

let current: ColourVision | null = null;

/** The setting now (read from storage once). */
export function colourVision(): ColourVision {
  return (current ??= loadColourVision());
}

/** Keep a setting in this browser (Options goes through careerStats.ts chooseColourVision, which keeps it on your profile too). */
export function saveColourVision(v: ColourVision): void {
  current = v;
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // Lasts for this page.
  }
}

/** Tests: forget the value read, so the next read comes from storage again. */
export function resetColourVisionCache(): void {
  current = null;
}
