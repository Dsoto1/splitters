/**
 * Team colours as shown with the Colour vision setting (colourVision.ts; docs/LOOK.md, "Colour vision"). Loaded with
 * the game, not the menu.
 */
import type { Faction } from '@tiletrigger/shared';
import { colourVision, type ColourVision } from './colourVision.ts';

/**
 * The team colours of each safe setting, in team order. The first two are the pair that matters most (two-team matches);
 * the rest are as far apart as could be found, and lean on the team symbols.
 */
export const TEAM_SAFE_COLOURS: Readonly<Record<Exclude<ColourVision, 'default'>, readonly string[]>> = {
  redgreen: ['#f0901e', '#2f7fe8', '#c6eef2', '#9a6a4a', '#9a9a9a', '#6a7488', '#ffd8a0', '#8fd0ff'],
  tritan: ['#e8306a', '#20b0c8', '#f0e442', '#6a7488', '#c6eef2', '#9a9a9a', '#c879c8', '#7a4aa8'],
};

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
