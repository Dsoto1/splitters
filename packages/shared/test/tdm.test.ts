import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_FIRE, CORE_BOT_PROFILES, DEFAULT_TDM_RULES, DEFAULT_TEAMS, PLAYER, mapTeams, initPhysics, lookAngles, rulesForMap, validateMap, type Faction, type GameEvent } from '../src/index.ts';
import { BotFiller, Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const eye = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z });
const chest = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + 1.1, z: p.z });

function tdmMap() {
  const map = makeMap(
    [
      { id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 },
      { id: 'room_b', tile: 'core.room', x: 1, y: 0, z: 0, rotation: 0 },
    ],
    [[-2, 0, -2], [-2, 0, 2], [10, 0, -2], [10, 0, 2]],
  );
  map.metadata.supportedModes = ['core.tdm'];
  const [a, b] = DEFAULT_TEAMS as [Faction, Faction];
  map.entities.forEach((e, i) => {
    if (e.kind === 'spawn') e.faction = i < 2 ? a.id : b.id;
  });
  return map;
}

function fire(match: Match, from: { slot: number; move: { pos: { x: number; y: number; z: number } } }, at: { move: { pos: { x: number; y: number; z: number } } }, seq: number): GameEvent[] {
  const aim = lookAngles(eye(from.move.pos), chest(at.move.pos));
  match.queueInputs(from.slot, [{ seq, forward: 0, right: 0, yaw: aim.yaw, pitch: aim.pitch, buttons: BUTTON_FIRE }]);
  return match.step();
}

describe('Team Deathmatch', () => {
  it('is the rules a TDM map asks for', () => {
    expect(rulesForMap(tdmMap()).mode).toBe('core.tdm');
  });

  it('balances teams, spawns each team on its own spawns and reports teams in the roster', () => {
    const match = new Match(tdmMap(), DEFAULT_TDM_RULES);
    const players = [match.addHuman('a')!, match.addHuman('b')!, match.addHuman('c')!, match.addHuman('d')!];
    const [ta, tb] = DEFAULT_TEAMS as [Faction, Faction];
    expect(players.map((p) => p.faction)).toEqual([ta.id, tb.id, ta.id, tb.id]);
    for (const p of players) expect(p.move.pos.x < 4).toBe(p.faction === ta.id);
    expect(match.roster().map((r) => r.team)).toEqual([ta.id, tb.id, ta.id, tb.id]);
  });

  it('has no friendly fire, scores kills for the team and ends at the team limit', () => {
    const match = new Match(tdmMap(), { ...DEFAULT_TDM_RULES, scoreLimit: 2, respawnDelayTicks: 10_000 });
    const a1 = match.addHuman('a1')!;
    const b1 = match.addHuman('b1')!;
    const a2 = match.addHuman('a2')!;
    const b2 = match.addHuman('b2')!;
    // Line everyone up through the doorway between the rooms (|z| < 1.5).
    const place = (c: typeof a1, x: number, z: number) => (c.move.pos = { x, y: 0, z });
    place(a1, -2, -0.6);
    place(a2, 0, 0.6);
    place(b1, 10, -0.6);
    place(b2, 10, 0.8);
    for (let i = 0; i < 20; i++) match.step();
    // Shooting a teammate does nothing.
    fire(match, a1, a2, 1);
    expect(a2.health).toBe(PLAYER.maxHealth);
    // Let go of the trigger and wait out the cooldown (it only runs down as inputs arrive).
    for (let i = 0; i < 30; i++) {
      match.queueInputs(a1.slot, [{ seq: 2 + i, forward: 0, right: 0, yaw: a1.yaw, pitch: a1.pitch, buttons: 0 }]);
      match.step();
    }
    // Two kills by different team members reach the team's limit of 2.
    b1.health = 1;
    fire(match, a1, b1, 40);
    expect(b1.alive).toBe(false);
    expect(match.teamScores().get(a1.faction!)).toBe(1);
    b2.health = 1;
    const ev = fire(match, a2, b2, 1);
    expect(ev).toContainEqual({ e: 'round_end', winner: null, team: a1.faction });
    expect(match.phase).toBe('intermission');
  });

  it('keeps bot teams even as the filler removes bots', () => {
    const match = new Match(tdmMap(), DEFAULT_TDM_RULES);
    match.addHuman('h');
    const filler = new BotFiller(match);
    filler.rebalance(8);
    const count = (id: string) => match.combatants().filter((c) => c.faction === id).length;
    expect(count(DEFAULT_TEAMS[0].id)).toBe(4);
    filler.rebalance(5);
    expect(Math.abs(count(DEFAULT_TEAMS[0].id) - count(DEFAULT_TEAMS[1].id))).toBeLessThanOrEqual(1);
    void CORE_BOT_PROFILES;
  });

  it('warns when only one team has spawn points', () => {
    const map = tdmMap();
    for (const e of map.entities) if (e.kind === 'spawn') e.faction = DEFAULT_TEAMS[0].id;
    expect(validateMap(map).some((i) => i.code === 'tdm.spawn_missing')).toBe(true);
    expect(validateMap(tdmMap()).some((i) => i.code.startsWith('tdm.'))).toBe(false);
  });

  it('runs any team layout: 2v2v2v2v2v2v12 fills each team to its size, nobody shoots their own side', () => {
    const sizes = [2, 2, 2, 2, 2, 2, 12];
    const match = new Match(tdmMap(), { ...DEFAULT_TDM_RULES, teamSizes: sizes });
    match.addHuman('me');
    new BotFiller(match).rebalance(sizes.reduce((a, b) => a + b, 0));
    const teams = mapTeams(match.map, sizes.length);
    expect(match.teams?.map((t) => t.id)).toEqual(teams.map((t) => t.id));
    const count = (id: string) => match.combatants().filter((c) => c.faction === id).length;
    expect(teams.map((t) => count(t.id))).toEqual(sizes);
    // Teams beyond the map's two bases spawn on the shared points (or anyone's) and still play.
    for (let i = 0; i < 600; i++) match.step();
    for (const c of match.combatants()) expect(c.move.pos.y).toBeGreaterThan(-1);
    expect(match.teamScores().size).toBe(7);
    // A bot leaving takes from the team most over its size.
    new BotFiller(match).rebalance(23);
    expect(count(teams[6]!.id)).toBe(11);
  });

  it('the map can recommend a team layout, which the rules pick up', () => {
    const map = { ...tdmMap(), teamSetup: { sizes: [3, 3, 3] } };
    expect(rulesForMap(map).teamSizes).toEqual([3, 3, 3]);
    expect(mapTeams(map).map((t) => t.name)).toEqual(['Embers', 'Tide', 'Verdant']);
    expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
  });
});
