import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { DEFAULT_DEATHMATCH_RULES, DEFAULT_RULES, MAP_FORMAT_VERSION, PROTOCOL_VERSION, type ClientMessage, type MapDocument, type ServerMessage } from '@tiletrigger/shared';
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

const connect = (port: number, name: string, admin?: string) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const got: ServerMessage[] = [];
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', protocol: PROTOCOL_VERSION, name, ...(admin ? { admin } : {}) })));
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
  const send = (m: ClientMessage) => ws.send(JSON.stringify(m));
  /** The next message of a kind from now on (earlier ones are dropped). */
  const next = <T extends ServerMessage['t']>(t: T, ms = 15000) => {
    got.length = 0;
    return waitFor(t, ms);
  };
  return { ws, waitFor, send, next, got };
};

describe('host controls on a dedicated server', () => {
  const suite = () => {
    const dir = mkdtempSync(join(tmpdir(), 'tt-host-'));
    writeFileSync(join(dir, 'room_a.json'), JSON.stringify(room('room_a')));
    writeFileSync(join(dir, 'room_b.json'), JSON.stringify(room('room_b')));
    return dir;
  };

  it('only the admin (ADMIN_TOKEN, at join or logged in later) may run the match; bots change live', async () => {
    const dir = suite();
    server = await startServer({ port: 0, map: join(dir, 'room_a.json'), mapsDir: dir, botFill: 4, seed: 1, startGate: false, mode: 'core.tdm', rules: { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2] }, adminToken: 'sesame' });
    const bob = connect(server.port, 'Bob');
    await bob.waitFor('welcome');
    // Not the admin: refused, nothing changes.
    const refused = bob.next('host');
    bob.send({ t: 'host', cmd: { c: 'bots', teamSize: 6 } });
    expect(await refused).toMatchObject({ state: null, error: expect.stringMatching(/admin/) });
    expect(server.match.combatants()).toHaveLength(4);
    // A wrong token is refused too; the right one makes Bob admin.
    const wrong = bob.next('host');
    bob.send({ t: 'admin', token: 'open up' });
    expect(await wrong).toMatchObject({ state: null, error: 'Wrong admin token' });
    const ok = bob.next('host');
    bob.send({ t: 'admin', token: 'sesame' });
    expect((await ok).state).toMatchObject({ teams: 2, teamSize: 2, fill: 4, mode: 'core.tdm', map: 'room_a' });
    // Joining with the token (?admin=…) makes you admin straight away.
    const alice = connect(server.port, 'Alice', 'sesame');
    expect((await alice.waitFor('host')).state).toMatchObject({ teamSize: 2 });
    const note = bob.next('notice');
    alice.send({ t: 'host', cmd: { c: 'bots', teamSize: 4, skill: 'hard' } });
    expect(await note).toEqual({ t: 'notice', text: 'Admin set teams to 4v4, bot skill to hard' });
    expect(server.match.combatants()).toHaveLength(8);
    expect(server.match.combatants().filter((c) => c.kind === 'human')).toHaveLength(2);
    expect(server.match.combatants().filter((c) => c.bot).every((c) => c.bot!.difficulty.id === 'hard')).toBe(true);
    const down = bob.next('roster');
    alice.send({ t: 'host', cmd: { c: 'bots', teamSize: 1 } });
    await down;
    expect(server.match.combatants()).toHaveLength(2);
    alice.ws.close();
    bob.ws.close();
  }, 30_000);

  it('a server without ADMIN_TOKEN refuses everyone', async () => {
    const dir = suite();
    server = await startServer({ port: 0, map: join(dir, 'room_a.json'), mapsDir: dir, botFill: 2, seed: 1, startGate: false });
    const a = connect(server.port, 'Alice', 'anything');
    await a.waitFor('welcome');
    const r = a.next('host');
    a.send({ t: 'host', cmd: { c: 'end' } });
    expect(await r).toMatchObject({ state: null, error: expect.stringMatching(/no admin/) });
    a.ws.close();
  }, 30_000);

  it('the admin changes map: only to a map of our suite, everyone travels and keeps the players', async () => {
    const dir = suite();
    server = await startServer({ port: 0, map: join(dir, 'room_a.json'), mapsDir: dir, botFill: 3, seed: 1, startGate: false, rules: { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 33 }, adminToken: 'sesame' });
    const admin = connect(server.port, 'Alice', 'sesame');
    await admin.waitFor('host');
    const err = admin.next('host');
    admin.send({ t: 'host', cmd: { c: 'map', map: 'not_ours' } });
    expect((await err).error).toMatch(/not a map of our suite/);
    admin.send({ t: 'host', cmd: { c: 'map', map: '../room_b' } });
    expect((await admin.next('host')).error).toMatch(/not a map of our suite/);
    expect(server.match.map.metadata.id).toBe('room_a');
    const note = admin.next('notice');
    admin.send({ t: 'host', cmd: { c: 'bots', fill: 5 } });
    await note;
    const travelling = admin.next('notice');
    admin.send({ t: 'host', cmd: { c: 'map', map: 'room_b', mode: 'core.deathmatch' } });
    expect((await travelling).text).toBe('Changing map to room b (Deathmatch)…');
    expect(await admin.waitFor('travel')).toEqual({ t: 'travel', map: 'room b' });
    await new Promise((r) => setTimeout(r, 100));
    expect(server.match.map.metadata.id).toBe('room_b');
    expect(server.match.rules.scoreLimit).toBe(33);
    // The game reconnects by itself (with the token it joined with) and is still admin.
    const again = connect(server.port, 'Alice', 'sesame');
    expect((await again.waitFor('welcome')).map.metadata.id).toBe('room_b');
    expect((await again.waitFor('host')).state).toMatchObject({ fill: 5, map: 'room_b' });
    expect(server.match.combatants()).toHaveLength(5);
    again.ws.close();
  }, 30_000);

  it('a map rotation: set from the config and by the admin, the next map after the scoreboard for everyone, skip', async () => {
    const dir = suite();
    writeFileSync(join(dir, 'room_c.json'), JSON.stringify(room('room_c')));
    const warn = console.warn;
    const dropped: string[] = [];
    console.warn = (...a: unknown[]) => void dropped.push(a.join(' '));
    try {
      server = await startServer({
        port: 0, map: join(dir, 'room_a.json'), mapsDir: dir, botFill: 2, seed: 1, startGate: false,
        rules: { ...DEFAULT_DEATHMATCH_RULES, intermissionTicks: 60 }, adminToken: 'sesame',
        rotation: ['room_b:deathmatch', 'not_ours:tdm', 'room_c:ctf', 'room_c'],
      });
    } finally {
      console.warn = warn;
    }
    // Unknown maps and modes a map can't play are dropped, with a log line each.
    expect(dropped.filter((l) => l.startsWith('[rotation] dropped'))).toHaveLength(2);
    expect(server.rotation()).toMatchObject({ items: ['room_b:deathmatch', 'room_c:deathmatch'], next: 0, current: null });
    const admin = connect(server.port, 'Alice', 'sesame');
    const first = (await admin.waitFor('host')).state!;
    expect(first.rotation).toMatchObject({ entries: [{ map: 'room_b', name: 'room b' }, { map: 'room_c' }], next: 0 });
    // The admin's own list: refused when nothing in it can play here.
    const bad = admin.next('host');
    admin.send({ t: 'host', cmd: { c: 'rotation', entries: [{ map: 'not_ours', mode: 'core.tdm' }] } });
    expect((await bad).error).toMatch(/None of those can be played/);
    const set = admin.next('host');
    admin.send({ t: 'host', cmd: { c: 'rotation', entries: [{ map: 'room_c', mode: 'core.deathmatch' }, { map: 'room_b', mode: 'core.deathmatch' }] } });
    expect((await set).state?.rotation).toMatchObject({ entries: [{ map: 'room_c' }, { map: 'room_b' }], next: 0, shuffle: false });
    // End of the match: everyone's scoreboard says where next, then everyone travels there.
    const bob = connect(server.port, 'Bob');
    await bob.waitFor('welcome');
    const ended = new Promise<unknown>((resolve) => bob.ws.on('message', (d) => {
      const m = JSON.parse(d.toString()) as ServerMessage;
      const up = m.t === 'snapshot' ? m.ev.find((e) => e.e === 'round_end') : undefined;
      if (up) resolve(up);
    }));
    admin.send({ t: 'host', cmd: { c: 'end' } });
    expect(await ended).toMatchObject({ e: 'round_end', up: { map: 'room c', mode: 'core.deathmatch' } });
    expect(await bob.waitFor('travel')).toEqual({ t: 'travel', map: 'room c' });
    await new Promise((r) => setTimeout(r, 100));
    expect(server.match.map.metadata.id).toBe('room_c');
    expect(server.rotation()).toMatchObject({ current: 0, next: 1 });
    // Skip to the next map now.
    const back = connect(server.port, 'Alice', 'sesame');
    await back.waitFor('host');
    const skipping = back.next('notice');
    back.send({ t: 'host', cmd: { c: 'skip' } });
    expect((await skipping).text).toBe('Changing map to room b (Deathmatch)…');
    await back.waitFor('travel');
    await new Promise((r) => setTimeout(r, 100));
    expect(server.match.map.metadata.id).toBe('room_b');
    // Round again: room c is next.
    expect(server.rotation()).toMatchObject({ current: 1, next: 0 });
    for (const c of [admin, bob, back]) c.ws.close();
  }, 30_000);
});
