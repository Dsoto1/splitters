import type { RosterEntry } from '@tiletrigger/shared';

/**
 * Free-for-all parties (shared net/party.ts; docs/GAME_MODES.md "Parties"): friends who came together see each other
 * as friends in a free-for-all too. Their names (kill feed, messages, the scoreboard) wear a friendly colour and they
 * get the ally marker over their heads; the match leans their spawns towards each other (sim/spawns.ts). Nothing else
 * changes: they can still hurt each other, and their kills count as any other.
 */

/** The friendly colour (the ally marker's default; Options' ally colour when it isn't "team"). */
export const PARTY_COLOR = '#3ad1ff';

/**
 * Whether `slot` is in your (`self`'s) party in a free-for-all: both people (not bots), neither on a team, the same
 * party tag, and not you.
 */
export function ffaPartyMate(roster: ReadonlyMap<number, RosterEntry>, self: number, slot: number): boolean {
  if (slot === self) return false;
  const me = roster.get(self);
  const them = roster.get(slot);
  return !!me?.py && !me.bot && !me.team && !!them && !them.bot && !them.team && them.py === me.py;
}
