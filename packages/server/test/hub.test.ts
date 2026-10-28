import { createHmac, generateKeyPairSync, createSign, type KeyObject } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { LOBBY_HEARTBEAT_SECONDS, LOBBY_STALE_SECONDS } from '@tiletrigger/shared';
import { JwksCache, accountHandler, authConfigScript, cognitoFromEnv, verifyCognitoToken, type CognitoConfig } from '../src/auth.ts';
import { BROKER_LIMITS, createBroker } from '../src/broker.ts';
import { clientIp, rateKey } from '../src/clientIp.ts';
import { DEFAULT_ICE_TTL, coturnCredentials, iceFromEnv, parseIceUsername } from '../src/ice.ts';
import { LOBBY_LIMITS, LobbyStore, lobbyHandler, secretsMatch } from '../src/lobby.ts';

const advert = (over: Record<string, unknown> = {}) => ({ code: 'ABC234', name: 'Friday night', host: 'Dave', map: 'Sandgate', mapId: 'sandgate', mode: 'core.tdm', players: 2, max: 8, version: 2, relay: false, ...over });
const HASH = `sha256:${'a'.repeat(64)}`;

const servers: Server[] = [];
afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

async function serve(handler: (req: IncomingMessage, res: import('node:http').ServerResponse) => void): Promise<string> {
  const http = createServer(handler);
  servers.push(http);
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', () => r()));
  return `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
}

const req = (remote: string, xff?: string) => ({ socket: { remoteAddress: remote }, headers: xff ? { 'x-forwarded-for': xff } : {} }) as unknown as IncomingMessage;

describe('client address', () => {
  it('trusts X-Forwarded-For only behind our own proxy, and only its last entry', () => {
    expect(clientIp(req('203.0.113.9', '1.2.3.4'), false)).toBe('203.0.113.9');
    // Caddy on the same box appends the client it saw: earlier entries are the client's own claims.
    expect(clientIp(req('127.0.0.1', '6.6.6.6, 198.51.100.7'), true)).toBe('198.51.100.7');
    expect(clientIp(req('::ffff:127.0.0.1', '198.51.100.7'), true)).toBe('198.51.100.7');
    // Reached directly (not through the proxy): the header is ignored.
    expect(clientIp(req('203.0.113.9', '1.2.3.4'), true)).toBe('203.0.113.9');
    expect(clientIp(req('127.0.0.1', 'not an ip'), true)).toBe('127.0.0.1');
  });

  it('keys IPv6 callers by their /64', () => {
    expect(rateKey('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64');
    expect(rateKey('2001:db8:1:2:bbbb:cccc:dddd:eeee')).toBe('2001:db8:1:2::/64');
    expect(rateKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(rateKey('10.0.0.1')).toBe('10.0.0.1');
  });
});

describe('game browser listing rules', () => {
  it('compares secrets in constant time, whatever their length', () => {
    expect(secretsMatch('abc', 'abc')).toBe(true);
    expect(secretsMatch('abc', 'abd')).toBe(false);
    expect(secretsMatch('abc', 'abcd')).toBe(false);
    expect(secretsMatch('', 'x')).toBe(false);
  });

  it('lists suite maps as official-eligible and other maps only as labelled community maps', () => {
    const store = new LobbyStore(() => 0, { suite: new Set(['sandgate']) });
    expect(store.add(advert(), 'a')).toHaveProperty('secret');
    expect(store.add(advert({ code: 'BBB333', mapId: 'my_own_map' }), 'a')).toMatchObject({ status: 400 });
    expect(store.add(advert({ code: 'CCC444', mapId: 'm_abcdefghijklmnop', community: true }), 'a')).toMatchObject({ status: 400 });
    const ok = store.add(advert({ code: 'CCC444', mapId: 'm_abcdefghijklmnop', community: true, versionId: 'v_abcdefghijklmnop', contentHash: HASH }), 'a');
    expect(ok).toHaveProperty('secret');
    const byCode = Object.fromEntries(store.list().map((g) => [g.code, g.community]));
    expect(byCode).toEqual({ ABC234: false, CCC444: true });
  });

  it('hides a listing that misses a check-in, and drops it later', () => {
    let now = 0;
    const store = new LobbyStore(() => now);
    store.add(advert(), 'a');
    now += LOBBY_HEARTBEAT_SECONDS * 1000;
    expect(store.list()).toHaveLength(1);
    now = (LOBBY_STALE_SECONDS + 1) * 1000;
    expect(store.list()).toHaveLength(0);
    expect(store.hasCode('ABC234')).toBe(true);
    now = 70_000;
    expect(store.hasCode('ABC234')).toBe(false);
  });
});

describe('lobby HTTP', () => {
  it('limits body size and type, validates queries, and rate-limits reads', async () => {
    const handler = lobbyHandler(new LobbyStore());
    const base = await serve((q, s) => void handler(q, s, () => s.writeHead(404).end()));
    const post = (body: string, type = 'application/json') => fetch(`${base}/lobby/games`, { method: 'POST', headers: { 'Content-Type': type }, body });
    expect((await post(JSON.stringify(advert({ name: 'x'.repeat(LOBBY_LIMITS.maxBody) })))).status).toBe(413);
    expect((await post(JSON.stringify(advert()), 'text/plain')).status).toBe(415);
    expect((await post('{nope')).status).toBe(400);
    expect((await post(JSON.stringify(advert()))).status).toBe(201);
    expect((await fetch(`${base}/lobby/games?v=abc`)).status).toBe(400);
    expect((await fetch(`${base}/lobby/games`, { method: 'PATCH' })).status).toBe(405);
    let limited = false;
    for (let i = 0; i < 80 && !limited; i++) limited = (await fetch(`${base}/lobby/games?v=2`)).status === 429;
    expect(limited).toBe(true);
  });

  it('hands out relay credentials only for a live game, scoped to it', async () => {
    const store = new LobbyStore();
    const live = new Set(['QRT29B']);
    const ice = iceFromEnv({ TURN_SECRET: 'sekrit', TURN_URLS: 'turn:t.example:3478' });
    const handler = lobbyHandler(store, { ice, isLive: (c) => live.has(c) });
    const base = await serve((q, s) => void handler(q, s, () => s.writeHead(404).end()));
    const ask = async (qs: string) => {
      const r = await fetch(`${base}/lobby/ice${qs}`);
      return { status: r.status, body: (await r.json()) as { iceServers: { username?: string; credential?: string }[]; relay: boolean; ttl: number } };
    };
    const none = await ask('');
    expect(none.status).toBe(200);
    expect(none.body.relay).toBe(false);
    expect(none.body.iceServers.every((s) => !s.username)).toBe(true);
    expect((await ask('?session=ZZZZZZ')).status).toBe(404);
    expect((await ask('?session=bad!')).status).toBe(400);
    const host = await ask('?session=QRT29B&role=host');
    expect(host.body.relay).toBe(true);
    expect(host.body.ttl).toBe(DEFAULT_ICE_TTL);
    const turn = host.body.iceServers.find((s) => s.username)!;
    const parsed = parseIceUsername(turn.username!)!;
    expect(parsed).toMatchObject({ session: 's_QRT29B', peer: 'host' });
    expect(parsed.expires - Math.floor(Date.now() / 1000)).toBeGreaterThan(DEFAULT_ICE_TTL - 5);
    expect(parsed.expires - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(DEFAULT_ICE_TTL);
    expect(turn.credential).toBe(createHmac('sha1', 'sekrit').update(turn.username!).digest('base64'));
    const guest = await ask('?session=qrt29b');
    expect(parseIceUsername(guest.body.iceServers.find((s) => s.username)!.username!)!.peer).toMatch(/^p_[0-9a-f]{8}$/);
    // A listed game counts as live too.
    store.add(advert({ code: 'HKM234' }), '9.9.9.9');
    expect((await ask('?session=HKM234')).status).toBe(200);
    // A few a minute per address.
    let limited = false;
    for (let i = 0; i < 20 && !limited; i++) limited = (await ask('?session=QRT29B')).status === 429;
    expect(limited).toBe(true);
  });
});

describe('relay credentials', () => {
  it('coturn REST format: "<expiry>:<session>.<peer>", HMAC-SHA1 password, 1 h by default', () => {
    const s = coturnCredentials('sekrit', ['turn:t.example:3478'], 3600, 1_000_000_000_000, { session: 's_ABC234', peer: 'p_1234abcd' });
    expect(s.username).toBe('1000003600:s_ABC234.p_1234abcd');
    expect(s.credential).toBe(createHmac('sha1', 'sekrit').update(s.username!).digest('base64'));
    expect(parseIceUsername(s.username!)).toEqual({ expires: 1_000_003_600, session: 's_ABC234', peer: 'p_1234abcd' });
    // Nothing from a caller can inject separators into the username.
    expect(coturnCredentials('k', [], 60, 0, { session: 's_A:B.C', peer: 'x y' }).username).toBe('60:s_ABC.xy');
    expect(iceFromEnv({}).ttl).toBe(3600);
    expect(iceFromEnv({ ICE_TTL: '60' }).ttl).toBe(600);
    expect(iceFromEnv({ ICE_TTL: '7200' }).ttl).toBe(7200);
  });
});

describe('broker limits', () => {
  it('caps broker sockets per address and tracks which codes are open', async () => {
    const http = createServer();
    servers.push(http);
    const broker = createBroker(http, false, { ...BROKER_LIMITS, perIp: 3, connectsPerMinute: 100 });
    http.on('request', (q, s) => broker.handle(q, s, () => s.writeHead(404).end()));
    await new Promise<void>((r) => http.listen(0, '127.0.0.1', () => r()));
    const port = (http.address() as AddressInfo).port;
    const open = (id: string) =>
      new Promise<WebSocket | null>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/broker/peerjs?key=peerjs&id=${id}&token=t${id}`);
        ws.on('message', () => resolve(ws));
        ws.on('error', () => resolve(null));
        ws.on('unexpected-response', () => resolve(null));
      });
    const a = await open('tiletrigger-QRT29B');
    expect(a).not.toBeNull();
    expect(broker.isLive('QRT29B')).toBe(true);
    expect(broker.isLive('ZZZZZZ')).toBe(false);
    const b = await open('guest-1');
    const c = await open('guest-2');
    expect(b && c).toBeTruthy();
    expect(await open('guest-3')).toBeNull();
    a!.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(broker.isLive('QRT29B')).toBe(false);
    const d = await open('guest-4');
    expect(d).not.toBeNull();
    for (const w of [b, c, d]) w?.close();
  });
});

describe('sign-in tokens (Cognito)', () => {
  const config: CognitoConfig = { region: 'us-east-1', userPoolId: 'us-east-1_TestPool1', clientId: 'client123' };
  const iss = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TestPool1';
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...(publicKey.export({ format: 'jwk' }) as object), kid: 'key1', alg: 'RS256', use: 'sig' };
  let fetches = 0;
  const jwksFetch = (async () => {
    fetches++;
    return new Response(JSON.stringify({ keys: [jwk] }));
  }) as unknown as typeof fetch;
  const sign = (claims: Record<string, unknown>, key: KeyObject = privateKey, kid = 'key1') => {
    const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid })).toString('base64url');
    const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const s = createSign('RSA-SHA256').update(`${h}.${p}`).sign(key).toString('base64url');
    return `${h}.${p}.${s}`;
  };
  const now = Date.now();
  const exp = Math.floor(now / 1000) + 3600;
  const idClaims = { sub: 'user-1', iss, aud: 'client123', token_use: 'id', exp, iat: exp - 3600, name: 'Ana' };
  const accessClaims = { sub: 'user-1', iss, client_id: 'client123', token_use: 'access', exp, iat: exp - 3600, username: 'google_123' };

  it('accepts valid ID and access tokens for this app and caches the keys', async () => {
    const jwks = new JwksCache('https://example/jwks.json', jwksFetch);
    expect(await verifyCognitoToken(sign(idClaims), config, jwks, now)).toMatchObject({ sub: 'user-1', tokenUse: 'id', name: 'Ana' });
    expect(await verifyCognitoToken(sign(accessClaims), config, jwks, now)).toMatchObject({ sub: 'user-1', tokenUse: 'access', username: 'google_123' });
    expect(fetches).toBe(1);
  });

  it('refuses tokens that are expired, for another app or pool, of another kind, or badly signed', async () => {
    const jwks = new JwksCache('https://example/jwks.json', jwksFetch);
    const bad: [Record<string, unknown>, RegExp][] = [
      [{ ...idClaims, exp: Math.floor(now / 1000) - 1 }, /expired/],
      [{ ...idClaims, aud: 'someone-else' }, /audience/],
      [{ ...accessClaims, client_id: 'someone-else' }, /client/],
      [{ ...idClaims, iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Other' }, /issuer/],
      [{ ...idClaims, token_use: 'refresh' }, /ID or access/],
    ];
    for (const [claims, why] of bad) await expect(verifyCognitoToken(sign(claims), config, jwks, now)).rejects.toThrow(why);
    await expect(verifyCognitoToken(sign(idClaims, other.privateKey), config, jwks, now)).rejects.toThrow(/signature/);
    await expect(verifyCognitoToken(sign(idClaims, privateKey, 'nokey'), config, jwks, now)).rejects.toThrow(/unknown signing key/);
    const none = `${Buffer.from('{"alg":"none","kid":"key1"}').toString('base64url')}.${Buffer.from(JSON.stringify(idClaims)).toString('base64url')}.`;
    await expect(verifyCognitoToken(none, config, jwks, now)).rejects.toThrow(/algorithm/);
    await expect(verifyCognitoToken('garbage', config, jwks, now)).rejects.toThrow();
  });

  it('GET /api/v1/me answers who a valid token belongs to', async () => {
    const handler = accountHandler(config, false, new JwksCache('https://example/jwks.json', jwksFetch));
    const base = await serve((q, s) => void handler(q, s, () => s.writeHead(404).end()));
    expect((await fetch(`${base}/api/v1/me`)).status).toBe(401);
    const ok = await fetch(`${base}/api/v1/me`, { headers: { Authorization: `Bearer ${sign(idClaims)}` } });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ sub: 'user-1', name: 'Ana', tokenUse: 'id' });
    expect((await fetch(`${base}/api/v1/me`, { headers: { Authorization: `Bearer ${sign({ ...idClaims, aud: 'x' })}` } })).status).toBe(401);
    const off = accountHandler(null, false);
    const base2 = await serve((q, s) => void off(q, s, () => s.writeHead(404).end()));
    expect((await fetch(`${base2}/api/v1/me`)).status).toBe(404);
  });
});

describe('sign-in settings come from the environment', () => {
  it('is off unless the pool and the app client are both set', () => {
    expect(cognitoFromEnv({})).toBeNull();
    expect(cognitoFromEnv({ COGNITO_USER_POOL_ID: 'us-east-1_Abc123' })).toBeNull();
    expect(cognitoFromEnv({ COGNITO_USER_POOL_ID: 'us-east-1_Abc123', COGNITO_APP_CLIENT_ID: 'off' })).toBeNull();
    expect(cognitoFromEnv({ COGNITO_USER_POOL_ID: 'not a pool', COGNITO_APP_CLIENT_ID: 'abc' })).toBeNull();
    expect(cognitoFromEnv({ COGNITO_USER_POOL_ID: 'eu-west-2_Abc123', COGNITO_APP_CLIENT_ID: 'client123' })).toEqual({ region: 'eu-west-2', userPoolId: 'eu-west-2_Abc123', clientId: 'client123' });
  });
  it('gives the page its client, login domain and origin, or nothing', () => {
    const c = { region: 'us-east-1', userPoolId: 'us-east-1_Abc123', clientId: 'client123' };
    const js = authConfigScript(c, { COGNITO_DOMAIN: 'login.example.com', PUBLIC_ORIGIN: 'https://game.example.com' });
    const set = new Function(`const globalThis = {}; ${js}; return globalThis.__TT_AUTH;`)() as unknown;
    expect(set).toEqual({ clientId: 'client123', domain: 'login.example.com', origins: ['https://game.example.com'] });
    expect(authConfigScript(null, { COGNITO_DOMAIN: 'login.example.com' })).not.toContain('__TT_AUTH');
    expect(authConfigScript(c, {})).not.toContain('__TT_AUTH');
  });
});
