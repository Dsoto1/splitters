/**
 * Colour vision (Options → Accessibility; docs/LOOK.md, "Colour vision"; owner, 2026-11-19): teams told apart by more
 * than colour.
 * - **Default** keeps the teams' own colours (the map's, the host's or the palette's).
 * - **Red-green safe** (deuteranopia and protanopia) and **Tritanopia** (blue-yellow) give the teams, in order, colours
 *   that stay apart with that colour vision: orange and blue for red-green, raspberry and teal for tritanopia, then
 *   colours picked to stay as far apart as they can (TEAM_SAFE_COLOURS; their gaps are checked by simulation in
 *   colourVision.test.ts, colourSim.ts). A map's or host's own team colours give way to them.
 * Whatever the setting, every team also has its symbol beside its colour (teamSymbols.ts).
 * Saved in this browser, and with your profile when signed in (careerStats.ts, syncColourVision). The game reads it as
 * a match starts (the HUD, minimap, kill feed, scoreboard, flags, vehicles and forts all take the colours given here).
 */
import { COLOUR_VISION_IDS, isColourVisionId, type ColourVisionId, type Faction } from '@tiletrigger/shared';

export const COLOUR_VISIONS = COLOUR_VISION_IDS;
export type ColourVision = ColourVisionId;

export const COLOUR_VISION_LABELS: Readonly<Record<ColourVision, string>> = {
  default: 'Default',
  redgreen: 'Deuteranopia / Protanopia (red-green)',
  tritan: 'Tritanopia (blue-yellow)',
};

/**
 * The team colours of each safe setting, in team order. The first two are the pair that matters most (two-team matches);
 * the rest are as far apart as could be found, and lean on the team symbols.
 */
export const TEAM_SAFE_COLOURS: Readonly<Record<Exclude<ColourVision, 'default'>, readonly string[]>> = {
  redgreen: ['#f0901e', '#2f7fe8', '#c6eef2', '#9a6a4a', '#9a9a9a', '#6a7488', '#ffd8a0', '#8fd0ff'],
  tritan: ['#e8306a', '#20b0c8', '#f0e442', '#6a7488', '#c6eef2', '#9a9a9a', '#c879c8', '#7a4aa8'],
};

const KEY = 'tiletrigger.colourVision';
/** Fired on window when the setting changes (Options shows it; the profile keeps it: careerStats.ts). */
export const COLOUR_VISION_EVENT = 'tiletrigger:colour-vision';

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

/** Choose a setting: here, and (signed in) on your profile through the event. `quiet`: taken from the profile, not sent back. */
export function saveColourVision(v: ColourVision, quiet = false): void {
  current = v;
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // Lasts for this page.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(COLOUR_VISION_EVENT, { detail: { quiet } }));
}

/** Tests: forget the value read, so the next read comes from storage again. */
export function resetColourVisionCache(): void {
  current = null;
}

/** Team `index`'s colour as shown: its own with Default, else the setting's safe colour for its place in the order. */
export function teamColourFor(index: number, own: string, v: ColourVision = colourVision()): string {
  if (v === 'default') return own;
  const pal = TEAM_SAFE_COLOURS[v];
  return pal[index % pal.length]!;
}

/** A match's teams as shown: the same teams, their colours given by the setting (the same list with Default). */
export function visionTeams<T extends Faction>(teams: readonly T[], v: ColourVision = colourVision()): readonly T[] {
  if (v === 'default') return teams;
  return teams.map((t, i) => ({ ...t, color: teamColourFor(i, t.color, v) }));
}
