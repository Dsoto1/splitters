import { PROTOCOL_VERSION, SnapshotDecoder, type ServerMessage } from '@tiletrigger/shared';
import { Unzipper } from '@tiletrigger/shared/peerZip';
import { PEER_PREFIX, loadPeer } from '../src/hubLink.ts';

/**
 * A player joining a host by join code exactly as the browser does
 * (client/src/game/peerLink.ts PeerTransport: PeerJS through the hub's broker,
 * raw serialization, compressed stream), in Node: for tests and measurements.
 */
export interface Guest {
  messages: ServerMessage[];
  bytes: number;
  snapshots: number;
  welcome: Extract<ServerMessage, { t: 'welcome' }> | null;
  rejected: string | null;
  closed: boolean;
  send(m: unknown): void;
  close(): void;
}

export async function joinAsGuest(hub: string, code: string, name: string, extra: Record<string, unknown> = {}): Promise<Guest> {
  const { Peer } = await loadPeer();
  const u = new URL(hub);
  const peer = new Peer({ host: u.hostname, port: Number(u.port || 80), path: '/broker', secure: false, debug: 0, config: { iceServers: [] } } as never);
  const unzip = new Unzipper();
  const decoder = new SnapshotDecoder();
  const g: Guest = { messages: [], bytes: 0, snapshots: 0, welcome: null, rejected: null, closed: false, send: () => undefined, close: () => peer.destroy() };
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('guest could not connect in 20 s')), 20_000);
    peer.on('error', (e) => (e as { type?: string }).type !== 'webrtc' && reject(e));
    peer.on('open', () => {
      const conn = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'raw', metadata: { z: 1 } });
      g.send = (m) => conn.open && conn.send(JSON.stringify(m));
      conn.on('error', () => undefined);
      conn.on('open', () => {
        clearTimeout(timer);
        g.send({ t: 'hello', protocol: PROTOCOL_VERSION, name, ...extra });
        resolve();
      });
      conn.on('data', (data) => {
        const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : (data as Uint8Array);
        g.bytes += bytes.length;
        const text = unzip.piece(bytes);
        if (text === null) return;
        const msg = JSON.parse(text) as ServerMessage;
        if (msg.t === 'snapshot') {
          decoder.snapshot(msg);
          g.snapshots++;
        }
        if (msg.t === 'welcome') g.welcome = msg;
        if (msg.t === 'reject') g.rejected = msg.reason;
        g.messages.push(msg);
        if (g.messages.length > 200) g.messages.splice(0, 100);
      });
      conn.on('close', () => (g.closed = true));
    });
  });
  return g;
}
