import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { BUTTON_FIRE, DEFAULT_DEATHMATCH_RULES, PLAYER, PROTOCOL_VERSION, lookAngles, type MapDocument, type ServerMessage } from '@chronosplit/shared';
import { parseClientMessage, startServer, type RunningServer } from '../src/server.ts';

const room: MapDocument = {
  format: 'chronosplit.map',
  formatVersion: 4,
  metadata: {
    id: 'test_room',
    name: 'Test Room',
    author: '',
    description: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    parentId: null,
    recommendedPlayers: { min: 2, max: 2 },
    supportedModes: ['core.deathmatch'],
  },
  classicStructure: { cellSize: 8, levelHeight: 4, theme: 'core.prototype', tiles: [{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }] },
  entities: [
    { id: 'spawn_a', kind: 'spawn', position: [-2, 0, -2], yaw: 0, faction: null },
    { id: 'spawn_b', kind: 'spawn', position: [2, 0, 2], yaw: 0, faction: null },
  ],
  logic: { variables: [], timers: [], objectives: [], rules: [] },
  dependencies: [],
};

type Snapshot = Extract<ServerMessage, { t: 'snapshot' }>;

/** Minimal headless network client used to prove two-client play. */
class TestClient {
  readonly ws: WebSocket;
  readonly messages: ServerMessage[] = [];
  latest?: Snapshot;
  seq = 0;

  constructor(port: number, name: string) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}`);
    this.ws.on('open', () => this.ws.send(JSON.stringify({ t: 'hello', protocol: PROTOCOL_VERSION, name })));
    this.ws.on('message', (d) => {
      const m = JSON.parse(d.toString()) as ServerMessage;
      this.messages.push(m);
      if (m.t === 'snapshot') this.latest = m;
    });
  }

  waitFor<T extends ServerMessage['t']>(t: T, pred: (m: Extract<ServerMessage, { t: T }>) => boolean = () => true, timeoutMs = 5000): Promise<Extract<ServerMessage, { t: T }>> {
    return new Promise((resolve, reject) => {
      const check = () => {
        const m = this.messages.find((x): x is Extract<ServerMessage, { t: T }> => x.t === t && pred(x as Extract<ServerMessage, { t: T }>));
        if (m) {
          clearInterval(iv);
          clearTimeout(to);
          resolve(m);
        }
      };
      const iv = setInterval(check, 5);
      const to = setTimeout(() => {
        clearInterval(iv);
        reject(new Error(`timed out waiting for ${t}`));
      }, timeoutMs);
      check();
    });
  }

  input(yaw: number, pitch: number, buttons: number): void {
    this.ws.send(JSON.stringify({ t: 'input', inputs: [{ seq: ++this.seq, forward: 0, right: 0, yaw, pitch, buttons }] }));
  }
}

let server: RunningServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe('dedicated server', () => {
  it('runs a two-client match: welcome, snapshots, acked inputs, and a networked kill', async () => {
    server = await startServer({ port: 0, map: room, botFill: 0, seed: 1, rules: { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 600 } });
    const a = new TestClient(server.port, 'Alice');
    const b = new TestClient(server.port, 'Bob');
    const [wa, wb] = await Promise.all([a.waitFor('welcome'), b.waitFor('welcome')]);
    expect(wa.slot).not.toBe(wb.slot);
    expect(wa.maxSlots).toBe(32);
    expect(wa.map.metadata.id).toBe('test_room');
    await a.waitFor('roster', (r) => r.players.length === 2);

    const first = await a.waitFor('snapshot', (s) => s.players.length === 2);
    // Each client gets its own private inventory: knife (slot 1) and pistol (slot 2) at spawn.
    expect(first.me?.inv.map((w) => w[0])).toEqual([1, 2]);
    const kill = new Promise<void>((resolve, reject) => {
      const iv = setInterval(() => {
        const snap = a.latest!;
        const me = snap.players.find((p) => p.s === wa.slot)!;
        const them = snap.players.find((p) => p.s === wb.slot)!;
        const aim = lookAngles({ x: me.p[0], y: me.p[1] + PLAYER.eyeHeight, z: me.p[2] }, { x: them.p[0], y: them.p[1] + 1.1, z: them.p[2] });
        a.input(aim.yaw, aim.pitch, BUTTON_FIRE);
        b.input(0, 0, 0);
        if (a.messages.some((m) => m.t === 'snapshot' && m.ev.some((e) => e.e === 'kill' && e.killer === wa.slot && e.victim === wb.slot))) {
          clearInterval(iv);
          resolve();
        }
      }, 1000 / 60);
      setTimeout(() => {
        clearInterval(iv);
        reject(new Error('no kill within 5s'));
      }, 5000);
    });
    await kill;
    const after = await b.waitFor('snapshot', (s) => s.score.some((e) => e.s === wa.slot && e.k === 1));
    expect(after.players.find((p) => p.s === wb.slot)?.alive).toBe(0);
    // The server acknowledges the inputs it applied.
    const latestA = await a.waitFor('snapshot', (s) => s.ack > 10);
    expect(latestA.ack).toBeLessThanOrEqual(a.seq);
    a.ws.close();
    b.ws.close();
  });

  it('fills empty slots with bots and makes room when a human joins', async () => {
    server = await startServer({ port: 0, map: room, botFill: 3, seed: 2 });
    expect(server.match.combatants().filter((c) => c.kind === 'bot')).toHaveLength(3);
    const a = new TestClient(server.port, 'Alice');
    await a.waitFor('welcome');
    const roster = await a.waitFor('roster');
    expect(roster.players.filter((p) => p.bot)).toHaveLength(2);
    expect(roster.players.filter((p) => !p.bot).map((p) => p.name)).toEqual(['Alice']);
    a.ws.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(server.match.combatants().filter((c) => c.kind === 'bot')).toHaveLength(3);
  });

  it('rejects mismatched protocol versions', async () => {
    server = await startServer({ port: 0, map: room, botFill: 0 });
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
    const msg = await new Promise<ServerMessage>((resolve) => {
      ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', protocol: 999, name: 'x' })));
      ws.on('message', (d) => resolve(JSON.parse(d.toString())));
    });
    expect(msg.t).toBe('reject');
  });
});

describe('client message parsing', () => {
  it('rejects malformed or oversized messages', () => {
    expect(parseClientMessage('nope')).toBeNull();
    expect(parseClientMessage('{"t":"input","inputs":[{"seq":"1"}]}')).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'input', inputs: new Array(33).fill({ seq: 1, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 }) }))).toBeNull();
    expect(parseClientMessage('{"t":"admin"}')).toBeNull();
    expect(parseClientMessage('{"t":"ping","id":1,"ct":2}')).toEqual({ t: 'ping', id: 1, ct: 2 });
    expect(parseClientMessage('{"t":"input","inputs":[{"seq":1,"forward":0,"right":0,"yaw":0,"pitch":0,"buttons":0,"weapon":3,"viewTick":99}]}')).toEqual({
      t: 'input',
      inputs: [{ seq: 1, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0, weapon: 3, viewTick: 99 }],
    });
  });
});
