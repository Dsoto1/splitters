import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { DEFAULT_DEATHMATCH_RULES, MAP_FORMAT_VERSION, PROTOCOL_VERSION, type MapDocument, type ServerMessage } from '@tiletrigger/shared';
import { startServer, type RunningServer } from '../src/server.ts';

const room = (id: string, next?: string): MapDocument => ({
  format: 'tiletrigger.map',
  formatVersion: MAP_FORMAT_VERSION,
  metadata: { id, name: id.replace('_', ' '), author: '', description: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', parentId: null, recommendedPlayers: { min: 1, max: 4 }, supportedModes: ['core.deathmatch'] },
  classicStructure: { cellSize: 8, levelHeight: 4, theme: 'core.prototype', tiles: [{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }] },
  entities: [
    { id: 'spawn_a', kind: 'spawn', position: [-2, 0, -2], yaw: 0, faction: null },
    { id: 'spawn_b', kind: 'spawn', position: [2, 0, 2], yaw: 0, faction: null },
  ],
  factions: [],
  logic: {
    variables: [],
    timers: [{ id: 'soon', name: 'Soon', seconds: 0.5, loop: false, visible: false }],
    objectives: [],
    rules: next
      ? [
          { id: 'start', name: '', enabled: true, once: true, when: { event: 'match_start', target: null }, if: [], do: [{ type: 'timer_start', target: 'soon', value: 0, text: '', state: '' }] },
          { id: 'go_on', name: '', enabled: true, once: true, when: { event: 'timer_done', target: 'soon' }, if: [], do: [{ type: 'next_map', target: null, value: 0, text: next, state: '' }] },
        ]
      : [],
  },
  terrain: null,
  bounds: null,
  teamSetup: null,
  backdrop: null,
  blood: null,
  physics: null,
  dependencies: [],
});

let server: RunningServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

const connect = (port: number, name: string) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const got: ServerMessage[] = [];
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', protocol: PROTOCOL_VERSION, name })));
  ws.on('message', (d) => got.push(JSON.parse(d.toString()) as ServerMessage));
  const waitFor = <T extends ServerMessage['t']>(t: T, ms = 15000) =>
    new Promise<Extract<ServerMessage, { t: T }>>((resolve, reject) => {
      const iv = setInterval(() => {
        const m = got.find((x) => x.t === t);
        if (m) {
          clearInterval(iv);
          resolve(m as Extract<ServerMessage, { t: T }>);
        }
      }, 10);
      setTimeout(() => (clearInterval(iv), reject(new Error(`no ${t}`))), ms);
    });
  return { ws, waitFor };
};

describe('scenario chains on a dedicated server', () => {
  it('a "Next map" to a map of our suite moves everyone on (travel, reconnect, score carried); one outside the suite does not', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tt-suite-'));
    writeFileSync(join(dir, 'room_a.json'), JSON.stringify(room('room_a', 'room_b')));
    writeFileSync(join(dir, 'room_b.json'), JSON.stringify(room('room_b')));
    server = await startServer({ port: 0, map: join(dir, 'room_a.json'), mapsDir: dir, botFill: 0, seed: 1, startGate: false, rules: { ...DEFAULT_DEATHMATCH_RULES, intermissionTicks: 60 } });
    const a = connect(server.port, 'Alice');
    expect((await a.waitFor('welcome')).map.metadata.id).toBe('room_a');
    server.match.slots[0]!.kills = 4;
    expect(await a.waitFor('travel')).toEqual({ t: 'travel', map: 'room b' });
    await new Promise((r) => setTimeout(r, 100));
    expect(server.match.map.metadata.id).toBe('room_b');
    // The player reconnects (the game does it by itself) and gets their score back.
    const again = connect(server.port, 'Alice');
    const w = await again.waitFor('welcome');
    expect(w.map.metadata.id).toBe('room_b');
    expect(server.match.slots[w.slot]!.kills).toBe(4);
    again.ws.close();
  }, 30_000);

  it('refuses a "Next map" that is not in our suite', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tt-suite-'));
    writeFileSync(join(dir, 'room_a.json'), JSON.stringify(room('room_a', 'elsewhere')));
    server = await startServer({ port: 0, map: join(dir, 'room_a.json'), mapsDir: dir, botFill: 0, seed: 1, startGate: false, rules: { ...DEFAULT_DEATHMATCH_RULES, intermissionTicks: 60 } });
    const a = connect(server.port, 'Alice');
    await a.waitFor('welcome');
    await new Promise((r) => setTimeout(r, 2500));
    expect(server.match.map.metadata.id).toBe('room_a');
    await expect(a.waitFor('travel', 100)).rejects.toThrow();
    a.ws.close();
  }, 30_000);
});

describe('between matches on a dedicated server: the vote on the next map', () => {
  const suite = () => {
    const dir = mkdtempSync(join(tmpdir(), 'tt-vote-'));
    for (const id of ['room_a', 'room_b', 'room_c']) writeFileSync(join(dir, `${id}.json`), JSON.stringify(room(id)));
    return dir;
  };

  it('the match ends, everyone gets the ballot (the map just played left out), a vote picks the map and everyone travels there', async () => {
    const dir = suite();
    server = await startServer({ port: 0, map: join(dir, 'room_a.json'), mapsDir: dir, botFill: 2, seed: 1, startGate: false, rules: { ...DEFAULT_DEATHMATCH_RULES, intermissionTicks: 60 } });
    const a = connect(server.port, 'Alice');
    await a.waitFor('welcome');
    expect(server.command({ c: 'end' }, 'test')).toBeNull();
    const open = await a.waitFor('vote');
    expect(open.v?.o.map((o) => o.map).sort()).toEqual(['room_b', 'room_c']);
    expect(open.v?.left).toBeGreaterThan(5);
    const want = open.v!.o.findIndex((o) => o.map === 'room_c');
    a.ws.send(JSON.stringify({ t: 'vote', i: want }));
    // The scoreboard is held (the match doesn't start itself over), and the winner comes with the vote's close.
    await new Promise((r) => setTimeout(r, 2000));
    expect(server.match.phase).toBe('intermission');
    expect(await a.waitFor('travel', 25_000)).toEqual({ t: 'travel', map: 'room c' });
    await new Promise((r) => setTimeout(r, 100));
    expect(server.match.map.metadata.id).toBe('room_c');
    expect(server.rotation().vote).toBe(true);
    a.ws.close();
  }, 40_000);

  it('MAP_VOTE off: plain rotation (here empty, so the map replays), and admins can turn it back on', async () => {
    const dir = suite();
    server = await startServer({ port: 0, map: join(dir, 'room_a.json'), mapsDir: dir, botFill: 2, seed: 1, startGate: false, mapVote: false, rules: { ...DEFAULT_DEATHMATCH_RULES, intermissionTicks: 60 } });
    const a = connect(server.port, 'Alice');
    await a.waitFor('welcome');
    server.command({ c: 'end' }, 'test');
    await new Promise((r) => setTimeout(r, 2500));
    await expect(a.waitFor('vote', 100)).rejects.toThrow();
    expect(server.match.map.metadata.id).toBe('room_a');
    expect(server.match.phase).not.toBe('intermission');
    expect(server.command({ c: 'rotation', vote: true }, 'test')).toBeNull();
    expect(server.mapVote()).toBe(true);
    a.ws.close();
  }, 30_000);
});
