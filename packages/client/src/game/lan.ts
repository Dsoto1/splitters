import { LAN_GAME_PORTS, parseServerInfo, type ServerInfo } from '@tiletrigger/shared';
import { hubAddress } from './hub.ts';

/**
 * LAN discovery from a browser. Browsers can't send UDP broadcasts, so this
 * finds dedicated servers two ways:
 *  1. it asks `GET /info` on the usual game ports (7777–7780) of the hosts it
 *     can name: the one this page came from, this computer (localhost) and
 *     any addresses you added;
 *  2. it asks the community hub (`/lobby/lan`), which does broadcast on its
 *     network and passes on the servers that answered (`pnpm dev:hub`).
 * Limits: a page served over https can't reach http:// LAN addresses (mixed
 * content; localhost is allowed), and without a hub on your network only the
 * hosts above are tried, not the whole subnet.
 */
export interface LanGame {
  /** ws:// address to join with. */
  url: string;
  info: ServerInfo;
  /** How it was found. */
  via: 'direct' | 'hub';
}

const SAVED_KEY = 'tiletrigger.lanHosts';

/** Addresses (host or host:port) you added to the LAN list. */
export function savedLanHosts(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 16) : [];
  } catch {
    return [];
  }
}

export function saveLanHosts(list: readonly string[]): void {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...new Set(list)].slice(0, 16)));
  } catch {
    // Lasts for this page.
  }
}

/** "host", "host:port" or "ws://host:port" → the /info URLs to try. */
export function probeUrls(entry: string): string[] {
  const m = /^(?:wss?:\/\/|https?:\/\/)?(\[[^\]]+\]|[^:/\s]+)(?::(\d+))?\/?$/.exec(entry.trim());
  if (!m) return [];
  const ports = m[2] ? [Number(m[2])] : [...LAN_GAME_PORTS];
  return ports.map((p) => `http://${m[1]}:${p}/info`);
}

/** Whether this page may fetch an http:// address (https pages only reach localhost that way). */
export function reachable(url: string): boolean {
  if (location.protocol !== 'https:') return true;
  return /^http:\/\/(localhost|127\.|\[::1\])/.test(url);
}

async function probe(url: string, ms: number): Promise<ServerInfo | null> {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(ms) });
    return res.ok ? parseServerInfo(await res.json()) : null;
  } catch {
    return null;
  }
}

/** Look for games on the local network (see above). */
export async function scanLan(extra: readonly string[] = savedLanHosts(), ms = 900): Promise<{ games: LanGame[]; blocked: number }> {
  const hosts = [...new Set([location.hostname, 'localhost', ...extra].filter(Boolean))];
  const urls = [...new Set(hosts.flatMap(probeUrls))];
  const blocked = urls.filter((u) => !reachable(u)).length;
  const games = new Map<string, LanGame>();
  const direct = urls.filter(reachable).map(async (u) => {
    const info = await probe(u, ms);
    if (!info) return;
    // Join at the address we reached it by (it works from here), not one it reports.
    const url = u.replace(/^http/, 'ws').replace(/\/info$/, '');
    games.set(url, { url, info, via: 'direct' });
  });
  const hub = hubAddress();
  const fromHub = hub
    ? (async () => {
        try {
          const res = await fetch(`${hub.secure ? 'https' : 'http'}://${hub.host}:${hub.port}${hub.path}lobby/lan`, { cache: 'no-store', signal: AbortSignal.timeout(ms + 600) });
          if (!res.ok) return;
          const body = (await res.json()) as { servers?: unknown[] };
          for (const raw of body.servers ?? []) {
            const info = parseServerInfo(raw);
            const url = info?.addresses.find((a) => reachable(a.replace(/^ws/, 'http')));
            if (info && url && ![...games.values()].some((g) => g.info.addresses.includes(url))) games.set(url, { url, info, via: 'hub' });
          }
        } catch {
          // No hub on this network.
        }
      })()
    : Promise.resolve();
  await Promise.all([...direct, fromHub]);
  // The same server reached as localhost and by its LAN address: keep one.
  const seen = new Set<string>();
  const out = [...games.values()].filter((g) => {
    const key = `${g.info.name}|${g.info.map}|${g.url.split(':').pop()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { games: out, blocked };
}
