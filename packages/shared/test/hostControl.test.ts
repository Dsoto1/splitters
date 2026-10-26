import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RULES, initPhysics, parseClientMessage, rulesForTravel, type GameMode } from '../src/index.ts';
import { BotFiller, HostControl, Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const yard = () => {
  const tiles = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4], [50, 0, 4], [10, 0, 10], [40, 0, 10]]);
};

const setup = (mode: GameMode, fill: number, teamSizes?: number[]) => {
  const match = new Match(yard(), { ...DEFAULT_RULES[mode], ...(teamSizes ? { teamSizes } : {}) }, 3);
  const bots = new BotFiller(match);
  const me = bots.join('Host', undefined, fill)!;
  const control = new HostControl(match, bots, fill);
  return { match, bots, me, control };
};
const count = (m: Match, kind: 'bot' | 'human', team?: string) => m.combatants().filter((c) => c.kind === kind && (team === undefined || c.faction === team)).length;

describe('host controls mid-match', () => {
  it('free-for-all: the players stepper adds bots (spawned normally) and removes the worst-scoring first', () => {
    const { match, control, me } = setup('core.deathmatch', 4);
    expect(count(match, 'bot')).toBe(3);
    expect(control.state()).toMatchObject({ fill: 4, teamSize: null, teams: 0, skill: 'normal', style: 'mixed', mode: 'core.deathmatch' });
    const up = control.apply({ c: 'bots', fill: 8 });
    expect(up.notice).toBe('Host set the match to 8 players');
    expect(count(match, 'bot')).toBe(7);
    expect(match.combatants().every((c) => c.alive)).toBe(true);
    // Give the bots scores: going down drops the worst ones and keeps the best.
    const bots = match.combatants().filter((c) => c.kind === 'bot');
    bots.forEach((b, i) => (b.kills = i));
    const best = bots.slice(-2).map((b) => b.name);
    control.apply({ c: 'bots', fill: 3 });
    expect(count(match, 'bot')).toBe(2);
    expect(match.combatants().filter((c) => c.kind === 'bot').map((b) => b.name).sort()).toEqual([...best].sort());
    expect(match.slots[me.slot]).toBe(me);
  });

  it('team modes: a per-team size takes 4v4 to 8v8 and back, keeping the sides even', () => {
    const { match, control } = setup('core.tdm', 8, [4, 4]);
    const [a, b] = match.teams!.map((t) => t.id);
    expect(count(match, 'bot') + count(match, 'human')).toBe(8);
    expect(control.state()).toMatchObject({ teams: 2, teamSize: 4, fill: 8 });
    const r = control.apply({ c: 'bots', teamSize: 8 });
    expect(r.notice).toBe('Host set teams to 8v8');
    expect(match.rules.teamSizes).toEqual([8, 8]);
    expect(match.combatants().filter((c) => c.faction === a)).toHaveLength(8);
    expect(match.combatants().filter((c) => c.faction === b)).toHaveLength(8);
    control.apply({ c: 'bots', teamSize: 2 });
    expect(match.combatants().filter((c) => c.faction === a)).toHaveLength(2);
    expect(match.combatants().filter((c) => c.faction === b)).toHaveLength(2);
    expect(count(match, 'human')).toBe(1);
    // The shared default rules were left alone (the match took its own copy).
    expect(DEFAULT_RULES['core.tdm'].teamSizes).toBeUndefined();
  });

  it('48v48 fills the match; bot skill and style change live', () => {
    const { match, control } = setup('core.tdm', 8, [4, 4]);
    control.apply({ c: 'bots', teamSize: 48 });
    expect(match.combatants()).toHaveLength(96);
    const r = control.apply({ c: 'bots', skill: 'hard', style: 'tactical' });
    expect(r.notice).toBe('Host set bot skill to hard, bot style to tactical');
    const bots = match.combatants().filter((c) => c.kind === 'bot');
    expect(bots.every((c) => c.bot!.difficulty.id === 'hard')).toBe(true);
    expect(bots.every((c) => c.bot!.profile.tags.includes('TACTICAL'))).toBe(true);
    expect(control.state()).toMatchObject({ skill: 'hard', style: 'tactical' });
    for (let i = 0; i < 5; i++) match.step();
  });

  it('restart clears the scores; end goes to the scoreboard', () => {
    const { match, control, me } = setup('core.deathmatch', 4);
    match.ready(me.slot);
    for (let i = 0; i < 400 && match.phase !== 'playing'; i++) match.step();
    expect(match.phase).toBe('playing');
    me.kills = 5;
    expect(control.apply({ c: 'end' }).notice).toBe('Host ended the match');
    const ev = match.step();
    expect(match.phase).toBe('intermission');
    expect(ev.some((e) => e.e === 'round_end')).toBe(true);
    expect(control.apply({ c: 'end' }).error).toBeTruthy();
    expect(control.apply({ c: 'restart' }).notice).toBe('Host restarted the match');
    expect(me.kills).toBe(0);
    expect(match.phase).not.toBe('intermission');
  });

  it('a map change keeps the host\'s rules and players', () => {
    const map = yard();
    const ffa = rulesForTravel({ ...DEFAULT_RULES['core.deathmatch'], scoreLimit: 30, botStyle: 'arena', bodySizes: false }, map, 10);
    expect(ffa.fill).toBe(10);
    expect(ffa.rules).toMatchObject({ mode: 'core.deathmatch', scoreLimit: 30, botStyle: 'arena', bodySizes: false });
    const tdm = rulesForTravel({ ...DEFAULT_RULES['core.deathmatch'], scoreLimit: 30 }, map, 10, 'core.tdm');
    expect(tdm.rules.mode).toBe('core.tdm');
    expect(tdm.rules.scoreLimit).toBe(DEFAULT_RULES['core.tdm'].scoreLimit);
    expect(tdm.rules.teamSizes).toEqual([5, 5]);
    expect(tdm.fill).toBe(10);
    // A mode the map can't run falls back to the current one.
    expect(rulesForTravel(DEFAULT_RULES['core.tdm'], map, 16, 'core.ctf', 8)).toMatchObject({ fill: 16, rules: { mode: 'core.tdm', teamSizes: [8, 8] } });
  });

  it('host commands are checked for shape', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'bots', teamSize: 8, skill: 'hard' } }))).toEqual({ t: 'host', cmd: { c: 'bots', teamSize: 8, skill: 'hard' } });
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'bots', fill: -1 } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'bots', skill: 'godlike' } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'map', map: 'diamond_park', mode: 'core.tdm' } }))).toEqual({ t: 'host', cmd: { c: 'map', map: 'diamond_park', mode: 'core.tdm' } });
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'map', map: 'x', mode: 'core.nope' } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'nuke' } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'admin', token: 'abc' }))).toEqual({ t: 'admin', token: 'abc' });
    expect(parseClientMessage(JSON.stringify({ t: 'hello', protocol: 3, name: 'A', admin: 'abc' }))).toEqual({ t: 'hello', protocol: 3, name: 'A', admin: 'abc' });
  });
});
