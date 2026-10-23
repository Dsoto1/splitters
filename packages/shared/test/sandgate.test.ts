import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, DEFAULT_TEAMS, initPhysics, loadMap, rulesForMap, validateMap, type GameEvent } from '../src/index.ts';
import { BotFiller, Match, initNavigation } from '../src/match.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const load = () => {
  const r = loadMap(readFileSync(new URL('../../../maps/sandgate.json', import.meta.url), 'utf8'));
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.map;
};

describe('Sandgate', () => {
  it('is a valid Team Deathmatch map with eight spawns per team', () => {
    const map = load();
    expect(validateMap(map)).toEqual([]);
    expect(rulesForMap(map).mode).toBe('core.tdm');
    for (const t of DEFAULT_TEAMS) expect(map.entities.filter((e) => e.kind === 'spawn' && e.faction === t.id).length).toBe(8);
  });

  it('connects both spawns to both squares, mid and long on the navmesh', () => {
    const match = new Match(load());
    const at = (x: number, z: number) => ({ x, y: 0, z });
    const places = { embers: at(32, -2), tide: at(32, 66), west: at(8, 48), east: at(72, 48), mid: at(40, 32), long: at(8, 20), tunnels: at(64, 16) };
    for (const [from, a] of Object.entries(places)) {
      for (const [to, b] of Object.entries(places)) {
        if (from < to) expect(match.nav.findPath(a, b), `${from} -> ${to}`).not.toBeNull();
      }
    }
  });

  it('runs a 12-bot Team Deathmatch with kills on both sides and nobody leaving the map', () => {
    const match = new Match(load(), rulesForMap(load()), 11);
    const filler = new BotFiller(match, BOT_DIFFICULTIES.normal);
    filler.rebalance(12);
    void CORE_BOT_PROFILES;
    const events: GameEvent[] = [];
    for (let i = 0; i < 60 * 45; i++) events.push(...match.step());
    const kills = events.filter((e): e is Extract<GameEvent, { e: 'kill' }> => e.e === 'kill' && e.killer !== null);
    expect(kills.length).toBeGreaterThan(10);
    const teamOf = (slot: number) => match.combatants().find((c) => c.slot === slot)?.faction;
    // No friendly kills, and both teams score.
    expect(kills.some((k) => teamOf(k.killer!) === teamOf(k.victim))).toBe(false);
    const scores = match.teamScores();
    for (const t of DEFAULT_TEAMS) expect(scores.get(t.id)).toBeGreaterThan(0);
    for (const c of match.combatants()) expect(c.move.pos.y).toBeGreaterThan(-1);
  });
});

describe('courtyard tiles', () => {
  it('leave no wall where two courtyards meet, but a doorway to a room', async () => {
    const { buildMapGeometry } = await import('../src/index.ts');
    const { makeMap } = await import('./helpers.ts');
    const map = makeMap([
      { id: 'yard_a', tile: 'core.yard', x: 0, y: 0, z: 0, rotation: 0 },
      { id: 'yard_b', tile: 'core.yard', x: 1, y: 0, z: 0, rotation: 0 },
      { id: 'room_c', tile: 'core.room', x: 2, y: 0, z: 0, rotation: 0 },
    ]);
    const walls = buildMapGeometry(map).filter((b) => b.kind === 'wall');
    // East-side wall slabs sit in the last half metre of a cell (x from cell edge - 0.5).
    const eastSide = (id: string, edge: number) => walls.filter((w) => w.sourceId === id && w.min[0] >= edge - 0.51 && w.max[0] <= edge + 0.01 && w.max[0] - w.min[0] < 1);
    expect(eastSide('yard_a', 4)).toEqual([]);
    expect(eastSide('yard_b', 12).length).toBe(3);
  });
});
