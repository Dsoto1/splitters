import type { IncomingMessage } from 'node:http';
import { isIP } from 'node:net';

/**
 * The address a request came from, for rate limits.
 *
 * Without TRUST_PROXY: the socket's own address. With it (the hub behind
 * Caddy on the same box): X-Forwarded-For is believed only when the request
 * came from loopback (our own proxy), and then only its *last* entry, the one
 * Caddy appended for the client it saw. Earlier entries are whatever the
 * client sent and are ignored, so a client can't pick its own address. A hub
 * with TRUST_PROXY reached directly (not through the proxy) falls back to the
 * socket address. Put another proxy (CloudFront…) in front only with a
 * matching change here.
 *
 * IPv6 addresses are keyed by their /64 (one household or server), IPv4 by
 * the full address.
 */
export function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  const remote = normaliseIp(req.socket.remoteAddress ?? '');
  if (trustProxy && isLoopback(remote)) {
    const raw = req.headers['x-forwarded-for'];
    const list = (Array.isArray(raw) ? raw.join(',') : (raw ?? '')).split(',').map((s) => s.trim()).filter(Boolean);
    const last = normaliseIp(list.at(-1) ?? '');
    if (last && isIP(last)) return rateKey(last);
  }
  return remote ? rateKey(remote) : 'unknown';
}

export function normaliseIp(ip: string): string {
  const v = ip.trim().replace(/^\[|\]$/g, '');
  return /^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(v) ? v.slice(7) : v;
}

export function isLoopback(ip: string): boolean {
  return ip === '::1' || /^127\./.test(ip);
}

/** IPv4 as is; IPv6 cut to its /64 network. */
export function rateKey(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const [head, tail = ''] = ip.toLowerCase().split('::') as [string, string?];
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const full = ip.includes('::') ? [...left, ...Array<string>(8 - left.length - right.length).fill('0'), ...right] : left;
  return `${full.slice(0, 4).map((h) => h.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}
