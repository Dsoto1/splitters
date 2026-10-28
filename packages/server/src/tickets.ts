import { createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, verify, type KeyObject } from 'node:crypto';

/**
 * Account tickets: how a game host learns, without trusting the player, that a
 * player is signed in (their Cognito account), so bans can name the account.
 * The hub checks the player's Cognito token (auth.ts) and signs a short
 * ticket for one join code with an Ed25519 key; any host checks it with the
 * hub's public key (GET /api/v1/ticket-keys). A host never sees the player's
 * Cognito token, and no host needs a secret: the hub holds the only private
 * key. The key is made when the hub starts (HUB_TICKET_KEY, a PKCS#8 PEM,
 * keeps one across restarts); hosts fetch keys again on an unknown `kid`.
 *
 * Ticket: base64url(JSON claims) "." base64url(signature). Claims: kid, sub
 * (the account), code (the join code it is for), iat, exp (iat + 120 s), jti.
 */
export interface TicketClaims {
  kid: string;
  sub: string;
  code: string;
  iat: number;
  exp: number;
  jti: string;
}

export const TICKET_TTL_SECONDS = 120;
const b64 = (b: Buffer) => b.toString('base64url');

export class TicketSigner {
  readonly kid: string;
  private readonly key: KeyObject;
  readonly publicKey: string;

  constructor(pem?: string) {
    this.key = pem ? createPrivateKey(pem) : generateKeyPairSync('ed25519').privateKey;
    const raw = createPublicKey(this.key).export({ format: 'jwk' }) as { x: string };
    this.publicKey = raw.x;
    this.kid = raw.x.slice(0, 8);
  }

  sign(sub: string, code: string, now = Date.now()): { ticket: string; exp: number } {
    const iat = Math.floor(now / 1000);
    const claims: TicketClaims = { kid: this.kid, sub, code, iat, exp: iat + TICKET_TTL_SECONDS, jti: randomBytes(8).toString('hex') };
    const body = b64(Buffer.from(JSON.stringify(claims)));
    return { ticket: `${body}.${b64(sign(null, Buffer.from(body), this.key))}`, exp: claims.exp };
  }

  keys(): { keys: { kid: string; x: string }[] } {
    return { keys: [{ kid: this.kid, x: this.publicKey }] };
  }
}

/** The claims of a ticket for `code`, checked against `keys` (kid → raw public key, base64url); null if anything is off. */
export function verifyTicket(ticket: string, code: string, keys: ReadonlyMap<string, string>, now = Date.now()): TicketClaims | null {
  if (typeof ticket !== 'string' || ticket.length > 1000) return null;
  const [body, sig] = ticket.split('.');
  if (!body || !sig) return null;
  let claims: TicketClaims;
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TicketClaims;
  } catch {
    return null;
  }
  const x = keys.get(claims?.kid);
  if (!x) return null;
  try {
    const key = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' });
    if (!verify(null, Buffer.from(body), key, Buffer.from(sig, 'base64url'))) return null;
  } catch {
    return null;
  }
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128) return null;
  if (claims.code !== code || typeof claims.exp !== 'number' || claims.exp * 1000 < now) return null;
  return claims;
}
