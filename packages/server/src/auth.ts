import { createPublicKey, createVerify, type JsonWebKey, type KeyObject } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TicketSigner } from './tickets.ts';
import { KeyedLimiter } from '@tiletrigger/shared';
import { clientIp } from './clientIp.ts';

/**
 * Sign-in (optional: playing never needs it). The game signs players in with
 * the owner's Cognito user pool (managed login, authorization code + PKCE,
 * public app client, no secret); the hub only *verifies* the tokens the
 * browser holds: RS256 signature against the pool's published keys (JWKS,
 * cached), issuer, audience/client_id, token_use and expiry. No database,
 * no user records: a request either carries a valid token or it doesn't.
 *
 * Env: COGNITO_REGION (us-east-1), COGNITO_USER_POOL_ID (us-east-1_VdMsuDJ59),
 * COGNITO_APP_CLIENT_ID (default: the public "trigger" app client; "off" turns sign-in off).
 */
export interface CognitoConfig {
  region: string;
  userPoolId: string;
  clientId: string;
}

export const DEFAULT_COGNITO = { region: 'us-east-1', userPoolId: 'us-east-1_VdMsuDJ59', clientId: '2lrej6nsacfag8a7taeu3u6sc2' } as const;

export function cognitoFromEnv(env: NodeJS.ProcessEnv = process.env): CognitoConfig | null {
  const set = (v: string | undefined) => (v && v !== 'pending' ? v : undefined);
  const clientId = set(env.COGNITO_APP_CLIENT_ID) ?? set(env.COGNITO_CLIENT_ID) ?? DEFAULT_COGNITO.clientId;
  if (clientId === 'off') return null;
  return { region: env.COGNITO_REGION || DEFAULT_COGNITO.region, userPoolId: env.COGNITO_USER_POOL_ID || DEFAULT_COGNITO.userPoolId, clientId };
}

export const issuerOf = (c: CognitoConfig): string => `https://cognito-idp.${c.region}.amazonaws.com/${c.userPoolId}`;

/** The claims the hub uses from a verified token. */
export interface VerifiedUser {
  sub: string;
  tokenUse: 'id' | 'access';
  username?: string;
  name?: string;
  email?: string;
  exp: number;
}

export class TokenError extends Error {}

type Jwk = JsonWebKey & { kid?: string; alg?: string; kty?: string; use?: string };

/**
 * The pool's signing keys, fetched from its JWKS URL and cached (an hour; a
 * token naming an unknown key refetches, at most once a minute, for key
 * rotation).
 */
export class JwksCache {
  private keys = new Map<string, KeyObject>();
  private fetchedAt = 0;
  private pending: Promise<void> | null = null;

  constructor(
    private readonly url: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async key(kid: string): Promise<KeyObject | undefined> {
    const age = this.now() - this.fetchedAt;
    if (age > 3600_000 || (!this.keys.has(kid) && age > 60_000)) await this.refresh();
    return this.keys.get(kid);
  }

  private refresh(): Promise<void> {
    this.pending ??= (async () => {
      try {
        const res = await this.fetcher(this.url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new TokenError(`JWKS answered ${res.status}`);
        const body = (await res.json()) as { keys?: Jwk[] };
        const keys = new Map<string, KeyObject>();
        for (const k of body.keys ?? []) if (k.kid && k.kty === 'RSA' && (!k.use || k.use === 'sig')) keys.set(k.kid, createPublicKey({ key: k, format: 'jwk' }));
        this.keys = keys;
        this.fetchedAt = this.now();
      } finally {
        this.pending = null;
      }
    })();
    return this.pending;
  }
}

const b64url = (s: string): Buffer => Buffer.from(s, 'base64url');

/** Verify a Cognito ID or access token; throws TokenError when it isn't valid for this app. */
export async function verifyCognitoToken(token: string, config: CognitoConfig, jwks: JwksCache, now = Date.now()): Promise<VerifiedUser> {
  if (token.length > 8192) throw new TokenError('token too long');
  const parts = token.split('.');
  if (parts.length !== 3) throw new TokenError('not a JWT');
  const [h, p, sig] = parts as [string, string, string];
  let header: { alg?: string; kid?: string };
  let claims: Record<string, unknown>;
  try {
    header = JSON.parse(b64url(h).toString('utf8'));
    claims = JSON.parse(b64url(p).toString('utf8'));
  } catch {
    throw new TokenError('malformed token');
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new TokenError('unexpected algorithm');
  const key = await jwks.key(header.kid);
  if (!key) throw new TokenError('unknown signing key');
  const ok = createVerify('RSA-SHA256').update(`${h}.${p}`).verify(key, b64url(sig));
  if (!ok) throw new TokenError('bad signature');
  if (claims.iss !== issuerOf(config)) throw new TokenError('wrong issuer');
  const exp = claims.exp;
  if (typeof exp !== 'number' || exp * 1000 <= now) throw new TokenError('expired');
  if (typeof claims.iat === 'number' && claims.iat * 1000 > now + 5 * 60_000) throw new TokenError('issued in the future');
  const use = claims.token_use;
  if (use === 'id') {
    if (claims.aud !== config.clientId) throw new TokenError('wrong audience');
  } else if (use === 'access') {
    if (claims.client_id !== config.clientId) throw new TokenError('wrong client');
  } else throw new TokenError('not an ID or access token');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new TokenError('no subject');
  const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, 200) : undefined);
  return {
    sub: claims.sub,
    tokenUse: use,
    exp,
    ...(str(claims['cognito:username'] ?? claims.username) ? { username: str(claims['cognito:username'] ?? claims.username) } : {}),
    ...(str(claims.name) ? { name: str(claims.name) } : {}),
    ...(str(claims.email) ? { email: str(claims.email) } : {}),
  };
}

/**
 * The account API, under /api/v1 (MULTIPLAYER_PROTOCOL.md section 1):
 *   GET /api/v1/me   (Authorization: Bearer <Cognito ID or access token>) → { sub, name?, email?, tokenUse, exp }
 *   GET /api/v1/health → { ok, auth }
 *   GET /api/v1/ticket?code=<CODE> (Authorization as /me) → { ticket, exp }: an account ticket for joining that game (tickets.ts)
 *   GET /api/v1/ticket-keys → { keys: [{ kid, x }] }: the public keys hosts check tickets with
 * 30 requests a minute per address; 10 failed tokens a minute per address, then 429 for a quarter of an hour.
 */
export function accountHandler(config: CognitoConfig | null, trustProxy: boolean, jwks?: JwksCache, tickets?: TicketSigner) {
  const keys = config ? (jwks ?? new JwksCache(`${issuerOf(config)}/.well-known/jwks.json`)) : null;
  const asks = new KeyedLimiter({ perMinute: 30 });
  const failures = new KeyedLimiter({ perMinute: 10 });
  const blocked = new Map<string, number>();
  return async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    const path = new URL(req.url ?? '/', 'http://hub').pathname.replace(/\/+$/, '');
    if (!path.startsWith('/api/v1/') && path !== '/api/v1') return next();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return void ((res.statusCode = 204), res.end());
    if (req.method !== 'GET') return send(405, { error: 'method not allowed' });
    if (path === '/api/v1/health') return send(200, { ok: true, auth: !!config });
    if (path === '/api/v1/ticket-keys') return tickets ? send(200, tickets.keys()) : send(404, { error: 'no account tickets on this hub' });
    const wantsTicket = path === '/api/v1/ticket';
    if (path !== '/api/v1/me' && !wantsTicket) return send(404, { error: 'not found' });
    const code = (new URL(req.url ?? '/', 'http://hub').searchParams.get('code') ?? '').toUpperCase();
    if (wantsTicket && (!tickets || !/^[A-HJKMNP-Z2-9]{6}$/.test(code))) return send(tickets ? 400 : 404, { error: tickets ? 'bad code' : 'no account tickets on this hub' });
    if (!config || !keys) return send(404, { error: 'sign-in is not set up on this hub' });
    const ip = clientIp(req, trustProxy);
    const t = Date.now();
    if ((blocked.get(ip) ?? 0) > t || !asks.allow(ip)) return send(429, { error: 'slow down' });
    const m = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(String(req.headers.authorization ?? ''));
    if (!m) return send(401, { error: 'sign in first' });
    try {
      const user = await verifyCognitoToken(m[1]!, config, keys);
      if (wantsTicket) return send(200, tickets!.sign(user.sub, code));
      return send(200, { sub: user.sub, tokenUse: user.tokenUse, exp: user.exp, ...(user.name ? { name: user.name } : {}), ...(user.email ? { email: user.email } : {}) });
    } catch (e) {
      if (!failures.allow(ip)) {
        blocked.set(ip, t + 15 * 60_000);
        if (blocked.size > 10_000) for (const [k, until] of blocked) if (until < t) blocked.delete(k);
      }
      return send(401, { error: e instanceof TokenError ? e.message : 'sign-in could not be checked' });
    }
  };
}
