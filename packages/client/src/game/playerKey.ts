const PLAYER_KEY = 'tiletrigger.pk';
let memo: string | undefined;

/**
 * A random key for this browser ("p_…"): it proves nothing. A host bans a
 * guest by it (with their address), and a server keeps a dropped player's
 * place for the connection that brings it back (BotFiller.reclaim). One per
 * page even where storage is blocked, so a reconnect from the same page is
 * recognised.
 */
export function playerKey(): string {
  if (memo) return memo;
  try {
    const have = localStorage.getItem(PLAYER_KEY);
    if (have && /^p_[A-Za-z0-9_-]{8,32}$/.test(have)) return (memo = have);
    const made = `p_${Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join('')}`;
    localStorage.setItem(PLAYER_KEY, made);
    return (memo = made);
  } catch {
    return (memo = `p_${Math.random().toString(36).slice(2, 14).padEnd(8, '0')}`);
  }
}
