/**
 * What an online page does when its match link ends (main.ts afterOnline): try again, or go back to the menu and say
 * why. Kept apart from the app so it can be tested.
 */

/** How long a lost link keeps trying to get back in (the server or host keeps the place for about as long). */
export const RECONNECT_FOR_MS = 60_000;

/**
 * Following the host to the next map (a vote's winner, the rotation, Change map): the host's browser loads that map
 * before its next match lets anyone in, which on a slow machine takes a while (on a loaded CI runner, over 40 s from
 * the travel to the match). A friend keeps trying this long, whatever each try says.
 */
export const FOLLOW_TRAVEL_MS = 120_000;

/** The game is gone (the host closed it): nothing to get back into, unless the host is only changing map. */
export const gameGoneReason = (reason: string | undefined): boolean => !!reason && /^no game open with code/.test(reason);

/**
 * `retry`: try again (a lost link, or any failed try while getting back in or following the host to its next map);
 * `menu`: a refusal, leaving on purpose, a game that's gone, or a first join that failed.
 * `rejoining`: a reconnect or a travel is under way; `following`: that one is a travel (the host changing map).
 */
export function afterLinkEnds(o: { reason: string | undefined; how: 'lost' | 'rejected' | undefined; rejoining: boolean; following: boolean }): 'retry' | 'menu' {
  if (o.how === 'rejected' || !o.reason) return 'menu';
  // Between the host's matches its join code can be briefly unanswered or turn a friend away: only a travel waits it out.
  if (o.following) return 'retry';
  if (gameGoneReason(o.reason)) return 'menu';
  return o.how === 'lost' || o.rejoining ? 'retry' : 'menu';
}
