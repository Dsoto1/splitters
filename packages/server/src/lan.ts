import { createSocket, type Socket } from 'node:dgram';
import { networkInterfaces } from 'node:os';
import { LAN_DISCOVERY_PORT, LAN_DISCOVERY_PROBE, parseServerInfo, type ServerInfo } from '@tiletrigger/shared';

/** This machine's IPv4 addresses on its local networks (no loopback), with each network's broadcast address. */
export function lanInterfaces(): { address: string; broadcast: string }[] {
  const out: { address: string; broadcast: string }[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const i of list ?? []) {
      if (i.family !== 'IPv4' || i.internal) continue;
      const ip = i.address.split('.').map(Number);
      const mask = i.netmask.split('.').map(Number);
      const broadcast = ip.map((b, k) => (b | (~mask[k]! & 255)) >>> 0).join('.');
      out.push({ address: i.address, broadcast });
    }
  }
  return out;
}

/** Join addresses for a game server on `port`: one ws:// URL per local network. */
export function lanAddresses(port: number): string[] {
  return lanInterfaces().map((i) => `ws://${i.address}:${port}`);
}

/**
 * Answer LAN discovery: a scanner broadcasts LAN_DISCOVERY_PROBE to the UDP
 * discovery port and every server on the network replies with its
 * ServerInfo. Several servers on one machine share the port (reuseAddr).
 */
export function answerDiscovery(info: () => ServerInfo, port = LAN_DISCOVERY_PORT, host?: string): Promise<{ close(): void; port: number }> {
  return new Promise((resolve, reject) => {
    const sock = createSocket({ type: 'udp4', reuseAddr: true });
    sock.on('message', (msg, from) => {
      if (msg.toString('utf8').trim() !== LAN_DISCOVERY_PROBE) return;
      sock.send(JSON.stringify(info()), from.port, from.address);
    });
    sock.once('error', reject);
    sock.bind(port, host, () => {
      sock.off('error', reject);
      // A failure later (the network went away) must not take the game server down.
      sock.on('error', (e) => console.warn(`[lan] discovery: ${e.message}`));
      resolve({ port: sock.address().port, close: () => sock.close() });
    });
  });
}

/**
 * Find game servers on the local networks: broadcast the probe (to
 * 255.255.255.255 and each network's broadcast address, plus any `targets`
 * such as 127.0.0.1) and gather the replies for `timeoutMs`.
 */
export function discoverLan(opts: { timeoutMs?: number; port?: number; targets?: string[] } = {}): Promise<ServerInfo[]> {
  const port = opts.port ?? LAN_DISCOVERY_PORT;
  return new Promise((resolve) => {
    const found = new Map<string, ServerInfo>();
    let sock: Socket;
    try {
      sock = createSocket('udp4');
    } catch {
      return resolve([]);
    }
    const done = () => {
      try {
        sock.close();
      } catch {
        // Already closed.
      }
      resolve([...found.values()]);
    };
    sock.on('error', done);
    sock.on('message', (msg) => {
      try {
        const info = parseServerInfo(JSON.parse(msg.toString('utf8')));
        if (info) found.set(info.addresses[0] ?? `${info.name}|${info.map}`, info);
      } catch {
        // Not ours.
      }
    });
    sock.bind(0, () => {
      sock.setBroadcast(true);
      const probe = Buffer.from(LAN_DISCOVERY_PROBE);
      const to = new Set(['255.255.255.255', ...lanInterfaces().map((i) => i.broadcast), ...(opts.targets ?? [])]);
      for (const addr of to) sock.send(probe, port, addr, () => undefined);
      setTimeout(done, opts.timeoutMs ?? 400);
    });
  });
}
