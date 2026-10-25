import { createHmac } from 'node:crypto';

/**
 * Relay (TURN) credentials handed out by the hub, so players on strict
 * networks connect without setting anything up. Configure one provider:
 *
 *   Cloudflare TURN:  CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN
 *   Metered:          METERED_DOMAIN (yourapp.metered.live) + METERED_API_KEY
 *   Own coturn:       TURN_URLS (space-separated, e.g. "turn:turn.example.com:3478 turns:turn.example.com:5349")
 *                     + TURN_SECRET (coturn's static-auth-secret, "use-auth-secret" mode)
 *
 * Credentials are short-lived (ICE_TTL seconds, default 6 h). Provider answers
 * are cached for a while so the hub doesn't call their API for every player.
 */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceConfig {
  provider: 'cloudflare' | 'metered' | 'coturn' | null;
  get(): Promise<IceServer[]>;
}

const STUN: IceServer = { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] };

/** coturn's TURN REST scheme: username "<expiry>:<id>", password base64(HMAC-SHA1(secret, username)). */
export function coturnCredentials(secret: string, urls: string[], ttl: number, now = Date.now(), id = 'tiletrigger'): IceServer {
  const username = `${Math.floor(now / 1000) + ttl}:${id}`;
  const credential = createHmac('sha1', secret).update(username).digest('base64');
  return { urls, username, credential };
}

/** Cloudflare's answer comes in two shapes (older "generate" and newer "generate-ice-servers"). */
export function normaliseIce(body: unknown): IceServer[] {
  const raw = (body as { iceServers?: unknown })?.iceServers ?? body;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.filter((s): s is IceServer => !!s && typeof s === 'object' && 'urls' in s);
}

export function iceFromEnv(env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch): IceConfig {
  const ttl = Math.max(600, Number(env.ICE_TTL ?? 6 * 3600));
  // Reuse a provider's answer for a third of its lifetime: everyone shares it, and it stays valid well past use.
  let cache: { at: number; servers: IceServer[] } | null = null;
  const cached = async (load: () => Promise<IceServer[]>) => {
    if (cache && Date.now() - cache.at < (ttl * 1000) / 3) return cache.servers;
    const servers = await load();
    cache = { at: Date.now(), servers };
    return servers;
  };
  if (env.CLOUDFLARE_TURN_KEY_ID && env.CLOUDFLARE_TURN_API_TOKEN) {
    return {
      provider: 'cloudflare',
      get: () =>
        cached(async () => {
          const res = await fetcher(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.CLOUDFLARE_TURN_KEY_ID}/credentials/generate-ice-servers`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${env.CLOUDFLARE_TURN_API_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ttl }),
          });
          if (!res.ok) throw new Error(`Cloudflare TURN answered ${res.status}`);
          return normaliseIce(await res.json());
        }),
    };
  }
  if (env.METERED_DOMAIN && env.METERED_API_KEY) {
    return {
      provider: 'metered',
      get: () =>
        cached(async () => {
          const res = await fetcher(`https://${env.METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${encodeURIComponent(env.METERED_API_KEY!)}`);
          if (!res.ok) throw new Error(`Metered answered ${res.status}`);
          return normaliseIce(await res.json());
        }),
    };
  }
  if (env.TURN_SECRET && env.TURN_URLS) {
    const urls = env.TURN_URLS.split(/[\s,]+/).filter(Boolean);
    return { provider: 'coturn', get: async () => [STUN, coturnCredentials(env.TURN_SECRET!, urls, ttl)] };
  }
  return { provider: null, get: async () => [STUN] };
}
