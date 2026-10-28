import { hubApi } from '../publishedMaps.ts';

/**
 * A friend's account ticket, checked in this browser when it hosts (the hub
 * signs tickets with Ed25519; packages/server/src/tickets.ts). A good one
 * says which account the friend is and its username, so the match shows that
 * name as a verified account; anything else (no ticket, a browser without
 * Ed25519, no hub) and the friend plays as a guest. Each ticket counts once.
 */
export interface TicketProof {
  sub: string;
  name?: string;
}

let keys: Promise<Map<string, string>> | null = null;
let fetchedAt = 0;
const seen = new Map<string, number>();

function hubKeys(force = false): Promise<Map<string, string>> {
  if (!keys || (force && Date.now() - fetchedAt > 30_000)) {
    fetchedAt = Date.now();
    const url = hubApi('ticket-keys');
    keys = url
      ? fetch(url, { signal: AbortSignal.timeout(6000) })
          .then((r) => (r.ok ? (r.json() as Promise<{ keys?: { kid?: unknown; x?: unknown }[] }>) : { keys: [] }))
          .then((j) => new Map((j.keys ?? []).flatMap((k) => (typeof k.kid === 'string' && typeof k.x === 'string' && k.x.length < 100 ? [[k.kid, k.x] as [string, string]] : []))))
          .catch(() => new Map<string, string>())
      : Promise.resolve(new Map<string, string>());
  }
  return keys;
}

const unb64 = (s: string): Uint8Array<ArrayBuffer> => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

/** The account a ticket for join code `code` proves, or null. */
export async function checkTicket(ticket: string, code: string): Promise<TicketProof | null> {
  if (typeof ticket !== 'string' || ticket.length > 1000 || typeof crypto === 'undefined' || !crypto.subtle) return null;
  const [body, sig] = ticket.split('.');
  if (!body || !sig) return null;
  let claims: { kid?: unknown; sub?: unknown; code?: unknown; exp?: unknown; jti?: unknown; name?: unknown };
  try {
    claims = JSON.parse(new TextDecoder().decode(unb64(body))) as typeof claims;
  } catch {
    return null;
  }
  if (typeof claims.kid !== 'string' || typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128) return null;
  if (claims.code !== code || typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now() || typeof claims.jti !== 'string') return null;
  if (claims.name !== undefined && !(typeof claims.name === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{2,15}$/.test(claims.name))) return null;
  let x = (await hubKeys()).get(claims.kid);
  if (!x) x = (await hubKeys(true)).get(claims.kid);
  if (!x) return null;
  try {
    const key = await crypto.subtle.importKey('jwk', { kty: 'OKP', crv: 'Ed25519', x }, { name: 'Ed25519' }, false, ['verify']);
    if (!(await crypto.subtle.verify({ name: 'Ed25519' }, key, unb64(sig), new TextEncoder().encode(body)))) return null;
  } catch {
    // This browser can't check Ed25519: the friend plays as a guest.
    return null;
  }
  const now = Date.now();
  for (const [j, exp] of seen) if (exp * 1000 < now) seen.delete(j);
  if (seen.has(claims.jti)) return null;
  seen.set(claims.jti, claims.exp);
  return { sub: claims.sub, ...(typeof claims.name === 'string' ? { name: claims.name } : {}) };
}

/** The ticket in a friend's first message, if it is a hello carrying one. */
export function helloTicket(text: string): string | null {
  if (text.length > 4096 || !text.includes('"ticket"')) return null;
  try {
    const m = JSON.parse(text) as { t?: unknown; ticket?: unknown };
    return m.t === 'hello' && typeof m.ticket === 'string' ? m.ticket : null;
  } catch {
    return null;
  }
}
