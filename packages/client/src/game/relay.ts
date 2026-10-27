import { fetchIce } from './hub.ts';

/**
 * Relays (TURN) for players whose networks block direct connections (strict
 * NATs, campus or mobile networks): traffic goes through the relay instead.
 * Two sources: one the player set in Options (kept in this browser, or
 * carried in an invite link), and the community hub's, which hands out
 * short-lived credentials for one game at a time (packages/server/src/ice.ts).
 * Nothing here knows about PeerJS: any signaling (signaling.ts) uses it.
 */
export interface RelayPrefs {
  /** e.g. `turn:global.relay.metered.ca:80` (several separated by spaces or commas). */
  url: string;
  user: string;
  pass: string;
}

const RELAY_KEY = 'tiletrigger.relay';

export function loadRelay(): RelayPrefs | null {
  const q = new URLSearchParams(location.search);
  if (q.get('relay')) return { url: q.get('relay')!, user: q.get('ru') ?? '', pass: q.get('rp') ?? '' };
  try {
    const r = JSON.parse(localStorage.getItem(RELAY_KEY) ?? 'null') as RelayPrefs | null;
    return r?.url ? r : null;
  } catch {
    return null;
  }
}

export function saveRelay(r: RelayPrefs | null): void {
  try {
    if (r?.url.trim()) localStorage.setItem(RELAY_KEY, JSON.stringify({ ...r, url: r.url.trim() }));
    else localStorage.removeItem(RELAY_KEY);
  } catch {
    // Private windows: lasts for this page.
  }
}

/** The relay as invite-link parameters, so a friend uses it too. */
export function relayParams(): string {
  const r = loadRelay();
  if (!r) return '';
  const q = new URLSearchParams({ relay: r.url });
  if (r.user) q.set('ru', r.user);
  if (r.pass) q.set('rp', r.pass);
  return `&${q}`;
}

/** Public STUN plus the player's own relay, if set. */
export function baseIceServers(): RTCIceServer[] {
  const list: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const r = loadRelay();
  if (r) {
    const urls = r.url.split(/[\s,]+/).filter(Boolean).map((u) => (/^turns?:/.test(u) ? u : `turn:${u}`));
    if (urls.length) list.push({ urls, username: r.user, credential: r.pass });
  }
  return list;
}

/**
 * The hub's relay credentials for one game (its join code), as host or as a
 * joining friend: { servers, relay, ttl }. Never fails: without them, direct
 * connections (and the player's own relay) only.
 */
export async function sessionIce(code: string, role: 'host' | 'guest'): Promise<{ servers: RTCIceServer[]; relay: boolean; ttl: number }> {
  const got = await fetchIce(code, role);
  return { servers: got?.relay ? got.iceServers.filter((s) => s.username) : [], relay: !!got?.relay, ttl: got?.ttl ?? 0 };
}
