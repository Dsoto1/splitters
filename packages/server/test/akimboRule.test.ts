/**
 * Dual wielding's rule on a dedicated server with step 2's switch thrown (AKIMBO_READY true): the server keeps it,
 * plays it from the next match and tells who joins. As shipped (false) the rule isn't on offer (shared's
 * serverRules.test.ts).
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';

vi.mock('../../shared/src/sim/rules.ts', async (original) => ({ ...(await original<Record<string, unknown>>()), AKIMBO_READY: true }));

import { MAP_FORMAT_VERSION, PROTOCOL_VERSION, akimboAllowed, type MapDocument, type ServerMessage } from '@tiletrigger/shared';
import { startServer, type RunningServer } from '../src/server.ts';

const room = (id: string): MapDocument => ({
  format: 'tiletrigger.map',
  formatVersion: MAP_FORMAT_VERSION,
  metadata: { id, name: id, author: '', description: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', parentId: null, recommendedPlayers: { min: 1, max: 4 }, supportedModes: ['core.deathmatch'] },
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
});

let server: RunningServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

/** Joins and resolves with the welcome the server sends. */
const welcome = (port: number, name: string) =>
  new Promise<Extract<ServerMessage, { t: 'welcome' }>>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', protocol: PROTOCOL_VERSION, name })));
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString()) as ServerMessage;
      if (m.t !== 'welcome') return;
      ws.close();
      resolve(m);
    });
    ws.on('error', reject);
  });

const boot = async (serverRules = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'tt-akimbo-'));
  writeFileSync(join(dir, 'room_a.json'), JSON.stringify(room('room_a')));
  return (server = await startServer({ port: 0, map: join(dir, 'room_a.json'), mapsDir: dir, botFill: 2, seed: 1, startGate: false, mode: 'core.deathmatch', serverRules }));
};

describe('dual wielding on a dedicated server (AKIMBO_READY on)', () => {
  it('RULES turns it off for every match, and a joining client is told', async () => {
    const s = await boot({ akimbo: false });
    expect(s.match.rules.akimbo).toBe(false);
    const w = await welcome(s.port, 'Visitor');
    expect(akimboAllowed(w.rules)).toBe(false);
  }, 30_000);

  it('on by default; set from the console it waits for the next match, and "default" turns it back on', async () => {
    const s = await boot();
    expect(akimboAllowed((await welcome(s.port, 'Visitor')).rules)).toBe(true);
    expect('akimbo' in s.match.rules).toBe(false);
    expect(s.setRule('akimbo', false, 'Console')).toBeNull();
    expect(akimboAllowed(s.match.rules)).toBe(true);
    expect(s.rules().pending).toContain('akimbo');
    const before = s.match;
    expect(s.command({ c: 'restart' }, 'Console')).toBeNull();
    await vi.waitFor(() => expect(s.match).not.toBe(before), { timeout: 20_000, interval: 20 });
    expect(s.match.rules.akimbo).toBe(false);
    expect(s.rules().set).toEqual({ akimbo: false });
    expect(akimboAllowed((await welcome(s.port, 'Second')).rules)).toBe(false);
    const off = s.match;
    expect(s.setRule('akimbo', undefined, 'Console')).toBeNull();
    expect(s.command({ c: 'restart' }, 'Console')).toBeNull();
    await vi.waitFor(() => expect(s.match).not.toBe(off), { timeout: 20_000, interval: 20 });
    expect('akimbo' in s.match.rules).toBe(false);
  }, 60_000);
});
