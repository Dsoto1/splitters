/**
 * The live match this tab is in, kept for the tab (sessionStorage), so a reload or a return to the site can go
 * straight back into it (docs/MOBILE_AUDIT.md, round 3: a tester's refresh lost her match).
 *
 * Online, the server or the friend's browser host keeps a dropped player's place about a minute
 * (rejoinPolicy.ts RECONNECT_FOR_MS) and gives it back to the same browser by its player key (playerKey.ts, in
 * localStorage, so it outlives the reload): all a reload has to remember is where the match was (the server's URL or
 * the join code, and the party). A match played in this tab (solo, or hosted in this browser) ends with the page, so
 * it is remembered only to say so.
 */
export type LiveMatch =
  | { kind: 'server'; url: string; name: string; seen: number }
  | { kind: 'code'; code: string; name: string; party?: string; seen: number }
  | { kind: 'local'; seen: number };

const KEY = 'tiletrigger.liveMatch';
/** How long after the page went away the place is still held (the server's hold, rejoinPolicy.ts RECONNECT_FOR_MS). */
export const PLACE_HELD_MS = 60_000;

/** The page is going away (a reload, a closed tab): the match it was in stays remembered, whatever ends it now. */
let leaving = false;
let watching = false;

function write(m: LiveMatch | null): void {
  try {
    if (m) sessionStorage.setItem(KEY, JSON.stringify(m));
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: a reload goes to the menu, as before.
  }
}

/** A stored value read back; anything damaged or unknown is null. */
export function parseLiveMatch(raw: string | null): LiveMatch | null {
  let v: Record<string, unknown> | null = null;
  try {
    v = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object' || typeof v.seen !== 'number' || !Number.isFinite(v.seen)) return null;
  const name = typeof v.name === 'string' ? v.name.slice(0, 40) : '';
  if (v.kind === 'server' && typeof v.url === 'string' && /^wss?:\/\//.test(v.url)) return { kind: 'server', url: v.url, name, seen: v.seen };
  if (v.kind === 'code' && typeof v.code === 'string' && /^[A-Z0-9]{6}$/.test(v.code)) return { kind: 'code', code: v.code, name, ...(typeof v.party === 'string' ? { party: v.party } : {}), seen: v.seen };
  if (v.kind === 'local') return { kind: 'local', seen: v.seen };
  return null;
}

/** The page went out of sight or away: from now the place is held for PLACE_HELD_MS. */
function stamp(): void {
  const m = readLiveMatch();
  if (m) write({ ...m, seen: Date.now() });
}

function watch(): void {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  window.addEventListener('pagehide', () => {
    leaving = true;
    stamp();
  });
  window.addEventListener('pageshow', () => (leaving = false));
  document.addEventListener('visibilitychange', () => document.hidden && stamp());
}

/** In a match now (online: let in; local: started). */
export function rememberLiveMatch(m: Omit<Extract<LiveMatch, { kind: 'server' }>, 'seen'> | Omit<Extract<LiveMatch, { kind: 'code' }>, 'seen'> | { kind: 'local' }): void {
  watch();
  write({ ...m, seen: Date.now() } as LiveMatch);
}

/** Out of the match on purpose, or it ended (not while the page is going away: then a reload brings it back). */
export function forgetLiveMatch(): void {
  if (!leaving) write(null);
}

export function readLiveMatch(): LiveMatch | null {
  try {
    return parseLiveMatch(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

/**
 * What a page just loaded does about the match its tab was in: `rejoin` (online, the place still held), `gone` (online,
 * away too long), `local` (it ran in this tab: nothing to rejoin) or null (none). The record is used up either way
 * (a rejoin that gets in remembers the match again).
 */
export function liveMatchOnLoad(now = Date.now()): { what: 'rejoin' | 'gone' | 'local'; match: LiveMatch } | null {
  const m = readLiveMatch();
  write(null);
  if (!m) return null;
  if (m.kind === 'local') return { what: 'local', match: m };
  return { what: now - m.seen <= PLACE_HELD_MS ? 'rejoin' : 'gone', match: m };
}
