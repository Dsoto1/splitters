import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { ExpressPeerServer } from 'peer';
import { WebSocketServer, type ServerOptions } from 'ws';
import { KeyedCounter, KeyedLimiter, MessageGuard } from '@tiletrigger/shared';
import { clientIp } from './clientIp.ts';

/**
 * Limits on the PeerJS broker (signaling). The broker only introduces
 * browsers to each other, so its traffic is small: a few messages to open a
 * code, an OFFER and some ICE candidates per join, a heartbeat every few
 * seconds. Anything well past that is abuse (or join-code guessing: each
 * guess is an OFFER to a code that may not exist).
 */
export const BROKER_LIMITS = {
  /** Broker sockets open at once, hub-wide (PeerJS concurrent_limit). */
  concurrent: 2000,
  /** Broker sockets open at once from one address (a household or a school shares one). */
  perIp: 16,
  /** New broker sockets per address per minute. */
  connectsPerMinute: 30,
  /** Messages per socket: 20 a second, bursts of 100 (a join's candidates arrive together). */
  message: { perSecond: 20, burst: 100, dropsToKick: 100, windowMs: 10_000 },
  /** Joins (OFFERs) per address per minute: bounds join-code guessing. */
  offersPerMinute: 30,
  /** Largest signaling message (an SDP offer is a few KB). */
  maxPayload: 16 * 1024,
  /** HTTP requests to the broker (/broker/peerjs/id…) per address per minute. */
  httpPerMinute: 60,
} as const;

const CODE_PREFIX = 'tiletrigger-';

export interface Broker {
  /** Handles /broker HTTP requests (call it only for paths under /broker). */
  handle(req: IncomingMessage, res: ServerResponse, next: () => void): void;
  /** Whether a host is registered on the broker under this join code right now. */
  isLive(code: string): boolean;
  /** Broker sockets open now. */
  readonly sockets: number;
}

export function createBroker(server: Server, trustProxy: boolean, limits = BROKER_LIMITS): Broker {
  const perIp = new KeyedCounter(limits.perIp);
  const connects = new KeyedLimiter({ perMinute: limits.connectsPerMinute });
  const offers = new KeyedLimiter({ perMinute: limits.offersPerMinute });
  const http = new KeyedLimiter({ perMinute: limits.httpPerMinute });
  const live = new Map<string, number>();
  let sockets = 0;

  const createWebSocketServer = (options: ServerOptions): WebSocketServer => {
    const wss = new WebSocketServer({
      ...options,
      maxPayload: limits.maxPayload,
      verifyClient: (info, done) => {
        const ip = clientIp(info.req, trustProxy);
        if (sockets >= limits.concurrent) return done(false, 503, 'broker full');
        if (!connects.allow(ip)) return done(false, 429, 'slow down');
        if (perIp.count(ip) >= limits.perIp) return done(false, 429, 'too many connections from your address');
        done(true);
      },
    });
    // Registered before PeerJS's own handler: count, rate-limit and track which codes are open.
    wss.on('connection', (socket, req) => {
      const ip = clientIp(req, trustProxy);
      if (!perIp.acquire(ip)) return socket.close(1008, 'too many connections');
      sockets++;
      const id = new URL(req.url ?? '', 'http://broker').searchParams.get('id') ?? '';
      live.set(id, (live.get(id) ?? 0) + 1);
      const guard = new MessageGuard(limits.message);
      socket.on('message', (data: Buffer) => {
        const v = guard.check();
        if (v === 'kick') return socket.close(1008, 'too many messages');
        if (data.length < limits.maxPayload && data.includes('"OFFER"')) {
          try {
            if ((JSON.parse(data.toString()) as { type?: string }).type === 'OFFER' && !offers.allow(ip)) socket.close(1008, 'too many joins');
          } catch {
            // PeerJS rejects it.
          }
        }
      });
      socket.on('close', () => {
        sockets--;
        perIp.release(ip);
        const n = (live.get(id) ?? 1) - 1;
        if (n > 0) live.set(id, n);
        else live.delete(id);
      });
    });
    return wss;
  };

  const app = ExpressPeerServer(server, {
    path: '/broker',
    proxied: false,
    concurrent_limit: limits.concurrent,
    allow_discovery: false,
    createWebSocketServer: createWebSocketServer as never,
  });
  // PeerJS sets itself up when mounted on an Express app; on a plain server, start it by hand. Express's own
  // mount step points the app's prototypes at its parent's: give it the ones it already has.
  const proto = (o: object) => Object.getPrototypeOf(o) as object;
  const self = app as unknown as { request: object; response: object; engines: object; settings: object };
  app.emit('mount', { request: proto(self.request), response: proto(self.response), engines: proto(self.engines), settings: proto(self.settings) });

  return {
    handle: (req, res, next) => {
      if (!http.allow(clientIp(req, trustProxy))) {
        res.statusCode = 429;
        res.setHeader('Content-Type', 'application/json');
        return void res.end('{"error":"slow down"}');
      }
      app(req as never, res as never, next);
    },
    isLive: (code) => live.has(CODE_PREFIX + code),
    get sockets() {
      return sockets;
    },
  };
}
