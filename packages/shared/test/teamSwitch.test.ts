import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RULES, TICK_RATE, initPhysics, parseClientMessage, type Combatant, type GameEvent } from '../src/index.ts';
import { BotFiller, Match, TEAM_SWITCH_COOLDOWN_SECONDS, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const yard = () => {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4], [30, 0, 4], [10, 0, 10], [20, 0, 10]]);
};

const run = (m: Match, n: number): GameEvent[] => {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) out.push(...m.step());
  return out;
};

/** Down for a respawn now (as a death would leave them, without counting one). */
const down = (m: Match, c: Combatant) => {
  c.alive = false;
  c.respawnTick = m.tick;
};

const msgs = (evs: GameEvent[], slot: number) => evs.flatMap((e) => (e.e === 'msg' && e.s === slot ? [e.text] : []));

const tdm = (fill: number, people: string[], seed = 3) => {
  const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], scoreLimit: 0, timeLimitSeconds: 0 }, seed);
  const filler = new BotFiller(match);
  const joined = people.map((n) => filler.join(n, undefined, fill)!);
  run(match, 30);
  return { match, filler, joined, teams: match.teams!.map((t) => t.id) };
};

describe('switch team during a match', () => {
  it('moves the player at their next spawn, a bot the other way to keep the teams even, and counts no death', () => {
    const { match, joined: [, ana], teams } = tdm(4, ['Host', 'Ana']);
    const from = ana!.faction!;
    const to = teams.find((t) => t !== from)!;
    const size = (t: string) => match.combatants().filter((c) => c.faction === t).length;
    expect([size(teams[0]!), size(teams[1]!)]).toEqual([2, 2]);
    ana!.deaths = 1;
    expect(match.switchTeam(ana!.slot)).toBe(true);
    let evs = run(match, 1);
    expect(msgs(evs, ana!.slot)[0]).toMatch(/^Switching to .* when you next respawn$/);
    expect(match.privateState(ana!.slot)!.tm).toBe(teams.indexOf(to));
    // Alive: nothing changes until her next spawn.
    run(match, 10);
    expect(ana!.faction).toBe(from);
    const moved = match.teamMoved;
    down(match, ana!);
    evs = run(match, 2);
    expect(ana!.faction).toBe(to);
    expect(ana!.alive).toBe(true);
    expect(ana!.deaths).toBe(1);
    expect(match.teamMoved).toBe(moved + 1);
    expect(msgs(evs, ana!.slot)).toContain(`You're on ${match.teams!.find((t) => t.id === to)!.name} now`);
    expect(match.privateState(ana!.slot)!.tm).toBeUndefined();
    expect(match.roster().find((p) => p.slot === ana!.slot)!.team).toBe(to);
    // The bot moving the other way goes at its own next spawn.
    const bot = match.combatants().find((c) => c.kind === 'bot' && c.faction === to)!;
    down(match, bot);
    run(match, 2);
    expect([size(teams[0]!), size(teams[1]!)]).toEqual([2, 2]);
    expect(match.combatants().filter((c) => c.kind === 'human').map((c) => c.faction).sort()).toEqual([to, to]);
  });

  it('refuses when it would leave the teams uneven and no bot can move the other way', () => {
    const { match, joined } = tdm(4, ['A', 'B', 'C', 'D']);
    expect(match.combatants().filter((c) => c.kind === 'bot')).toHaveLength(0);
    const p = joined[0]!;
    expect(match.switchTeam(p.slot)).toBe(false);
    expect(msgs(run(match, 1), p.slot)[0]).toMatch(/switching would leave the teams uneven$/);
    expect(match.privateState(p.slot)!.tm).toBeUndefined();
  });

  it('lets the bigger team give a player to the smaller one with no bot moving', () => {
    const { match, joined, teams } = tdm(3, ['A', 'B', 'C']);
    const count = (t: string) => match.combatants().filter((c) => c.faction === t).length;
    const big = teams.find((t) => count(t) === 2)!;
    const p = joined.find((c) => c.faction === big)!;
    expect(match.switchTeam(p.slot)).toBe(true);
    down(match, p);
    run(match, 2);
    expect(p.faction).not.toBe(big);
    expect(count(big)).toBe(1);
  });

  it('cancels on a second ask, then waits out the cooldown', () => {
    const { match, joined: [, ana] } = tdm(4, ['Host', 'Ana']);
    expect(match.switchTeam(ana!.slot)).toBe(true);
    expect(match.switchTeam(ana!.slot)).toBe(false);
    expect(msgs(run(match, 1), ana!.slot).at(-1)).toMatch(/^Staying on /);
    expect(match.privateState(ana!.slot)!.tm).toBeUndefined();
    // Cancelled: the bot that would have moved stays.
    down(match, ana!);
    const from = ana!.faction;
    run(match, 2);
    expect(ana!.faction).toBe(from);
    expect(match.switchTeam(ana!.slot)).toBe(false);
    expect(msgs(run(match, 1), ana!.slot)[0]).toMatch(/^Wait \d+ s to switch team again$/);
    run(match, TEAM_SWITCH_COOLDOWN_SECONDS * TICK_RATE);
    expect(match.switchTeam(ana!.slot)).toBe(true);
  });

  it('leaves the kills a player made with the team they left (Team Deathmatch)', () => {
    const { match, joined: [, ana], teams } = tdm(4, ['Host', 'Ana']);
    const from = ana!.faction!;
    const to = teams.find((t) => t !== from)!;
    ana!.kills = 5;
    const before = match.teamScores();
    match.switchTeam(ana!.slot);
    down(match, ana!);
    run(match, 2);
    expect(ana!.faction).toBe(to);
    expect(match.teamScores().get(from)).toBe(before.get(from));
    expect(match.teamScores().get(to)).toBe(before.get(to));
    ana!.kills = 7;
    expect(match.teamScores().get(to)).toBe(before.get(to)! + 2);
  });

  it('does nothing outside team modes, for bots, or for a team switch message that is out of range', () => {
    const match = new Match(yard(), DEFAULT_RULES['core.deathmatch'], 4);
    const filler = new BotFiller(match);
    const p = filler.join('Solo', undefined, 2)!;
    expect(match.switchTeam(p.slot)).toBe(false);
    const { match: m2 } = tdm(4, ['Host']);
    const bot = m2.combatants().find((c) => c.kind === 'bot')!;
    expect(m2.switchTeam(bot.slot)).toBe(false);
    expect(parseClientMessage('{"t":"team"}')).toEqual({ t: 'team' });
    expect(parseClientMessage('{"t":"team","i":1}')).toEqual({ t: 'team', i: 1 });
    expect(parseClientMessage('{"t":"team","i":-1}')).toEqual({ t: 'team', i: -1 });
    expect(parseClientMessage('{"t":"team","i":9}')).toBeNull();
    expect(parseClientMessage('{"t":"team","i":"x"}')).toBeNull();
  });
});
