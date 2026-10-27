import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { coturnCredentials, iceFromEnv, normaliseIce } from '../src/ice.ts';

describe('relay credentials from the hub', () => {
  it('coturn: time-limited username, HMAC password', () => {
    const s = coturnCredentials('sekrit', ['turn:t.example:3478'], 3600, 1_000_000_000, { session: 's_ABC234', peer: 'host' });
    expect(s.username).toBe('1003600:s_ABC234.host');
    expect(s.credential).toBe(createHmac('sha1', 'sekrit').update('1003600:s_ABC234.host').digest('base64'));
  });

  it('reads both shapes of provider answers', () => {
    expect(normaliseIce({ iceServers: { urls: ['turn:a'], username: 'u', credential: 'c' } })).toHaveLength(1);
    expect(normaliseIce({ iceServers: [{ urls: 'stun:a' }, { urls: ['turn:b'], username: 'u', credential: 'c' }] })).toHaveLength(2);
    expect(normaliseIce([{ urls: 'turn:m', username: 'u', credential: 'c' }])).toHaveLength(1);
    expect(normaliseIce({ nonsense: true })).toEqual([]);
  });

  it('picks the configured provider and caches its answer', async () => {
    let calls = 0;
    const fake = (async (url: string) => {
      calls++;
      return new Response(JSON.stringify(url.includes('cloudflare') ? { iceServers: [{ urls: ['turn:cf'], username: 'u', credential: 'c' }] } : [{ urls: 'turn:m', username: 'u', credential: 'c' }]));
    }) as unknown as typeof fetch;
    const cf = iceFromEnv({ CLOUDFLARE_TURN_KEY_ID: 'k', CLOUDFLARE_TURN_API_TOKEN: 't' }, fake);
    expect(cf.provider).toBe('cloudflare');
    expect((await cf.get())[0]!.urls).toEqual(['turn:cf']);
    await cf.get();
    expect(calls).toBe(1);
    const metered = iceFromEnv({ METERED_DOMAIN: 'x.metered.live', METERED_API_KEY: 'k' }, fake);
    expect(metered.provider).toBe('metered');
    expect((await metered.get())[0]!.urls).toBe('turn:m');
    const own = iceFromEnv({ TURN_SECRET: 's', TURN_URLS: 'turn:a:3478 turns:a:5349' });
    expect(own.provider).toBe('coturn');
    expect((await own.get())[1]!.urls).toEqual(['turn:a:3478', 'turns:a:5349']);
    const none = iceFromEnv({});
    expect(none.provider).toBeNull();
    expect((await none.get()).every((s) => !s.username)).toBe(true);
  });
});
