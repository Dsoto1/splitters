import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { DEFAULT_DEATHMATCH_RULES, MAP_FORMAT_VERSION, PROTOCOL_VERSION, parseServerInfo, type MapDocument, type ServerInfo, type ServerMessage } from '@tiletrigger/shared';
import { answerDiscovery, discoverLan, lanAddresses } from '../src/lan.ts';
import { LobbyStore, lobbyHandler } from '../src/lobby.ts';
import { startServer, type RunningServer } from '../src/server.ts';

const room: MapDocument = {
  format: 'tiletrigger.map',
  formatVersion: MAP_FORMAT_VERSION,
  metadata: { id: 'lan_room', name: 'LAN Room', author: '', description: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', parentId: null, recommendedPlayers: { min: 2, max: 4 }, supportedModes: ['core.deathmatch'] },
  classicStructure: { cellSize: 8, levelHeight: 4, theme: 'core.prototype', tiles: [{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }] },
  entities: [
    { id: 'spawn_a', kind: 'spawn', position: [-2, 0, -2], yaw: 0, faction: null },
    { id: 'spawn_b', kind: 'spawn', position: [2, 0, 2], yaw: 0, faction: null },
  ],
  factions: [],
  logic: { variables: [], timers: [], objectives: [], rules: [] },
  terrain: null,
  bounds: null,
  teamSetup: null,
  backdrop: null,
  blood: null,
  physics: null,
  dependencies: [],
};

let server: RunningServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

const info = (over: Partial<ServerInfo> = {}): ServerInfo => ({ game: 'tiletrigger', version: PROTOCOL_VERSION, name: 'Den', map: 'Sandgate', mode: 'core.tdm', players: 1, bots: 7, max: 96, addresses: ['ws://192.168.1.20:7777'], ...over });

describe('LAN', () => {
  it('a dedicated server answers GET /info on its game port (for browsers on the LAN), with CORS, and still plays over WebSocket', async () => {
    server = await startServer({ port: 0, map: room, botFill: 3, seed: 1, startGate: false, rules: DEFAULT_DEATHMATCH_RULES, name: 'Basement' });
    const res = await fetch(`http://127.0.0.1:${server.port}/info`);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const got = parseServerInfo(await res.json());
    expect(got).toMatchObject({ name: 'Basement', map: 'LAN Room', mode: 'core.deathmatch', players: 0, bots: 3, version: PROTOCOL_VERSION });
    expect(got!.addresses.length).toBeGreaterThan(0);
    // The game itself on the same port; the welcome carries the LAN addresses when the machine has any.
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
    const welcome = await new Promise<Extract<ServerMessage, { t: 'welcome' }>>((resolve) => {
      ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', protocol: PROTOCOL_VERSION, name: 'Lan' })));
      ws.on('message', (d) => {
        const m = JSON.parse(d.toString()) as ServerMessage;
        if (m.t === 'welcome') resolve(m);
      });
    });
    expect(welcome.lan ?? []).toEqual(lanAddresses(server.port));
    expect(server.info().players).toBe(1);
    ws.close();
  });

  it('servers answer a discovery probe over UDP, and a scan collects them', async () => {
    const a = await answerDiscovery(() => info({ name: 'A' }), 0, '127.0.0.1');
    try {
      const found = await discoverLan({ port: a.port, targets: ['127.0.0.1'], timeoutMs: 300 });
      expect(found.map((f) => f.name)).toContain('A');
    } finally {
      a.close();
    }
  });

  it('the hub passes LAN discovery on to browsers at /lobby/lan', async () => {
    const handler = lobbyHandler(new LobbyStore(), { lan: async () => ({ addresses: ['http://192.168.1.20:9000'], servers: [info()] }) });
    const http = createServer((req, res) => void handler(req, res, () => res.writeHead(404).end()));
    await new Promise<void>((r) => http.listen(0, '127.0.0.1', () => r()));
    try {
      const res = await fetch(`http://127.0.0.1:${(http.address() as AddressInfo).port}/lobby/lan`);
      const body = (await res.json()) as { addresses: string[]; servers: unknown[] };
      expect(body.addresses).toEqual(['http://192.168.1.20:9000']);
      expect(body.servers.map(parseServerInfo)).toEqual([info()]);
    } finally {
      http.close();
    }
  });

  it('rejects malformed server info', () => {
    expect(parseServerInfo({ ...info(), game: 'other' })).toBeNull();
    expect(parseServerInfo({ ...info(), mode: 'core.nope' })).toBeNull();
    expect(parseServerInfo({ ...info(), players: 500 })).toBeNull();
    expect(parseServerInfo({ ...info(), addresses: ['javascript:alert(1)', 'ws://10.0.0.2:7777'] })?.addresses).toEqual(['ws://10.0.0.2:7777']);
  });
});
