import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, TICK_RATE, rulesFromSetup, type HostState, type MatchRules } from '@tiletrigger/shared';
import { makeMap } from '../../shared/test/helpers.ts';
import { changeWords, restartPatch, setupChanges, setupOfMatch } from '../src/game/hostSetup.ts';

const map = () => {
  const tiles = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4], [50, 0, 4], [10, 0, 10], [40, 0, 10]]);
};

const host = (over: Partial<HostState> = {}): HostState => ({ fill: 4, teamSize: null, teams: 0, max: 16, skill: 'normal', style: 'mixed', map: 'm', mode: 'core.deathmatch', ...over });

describe('the Host tab as Match Setup (hostSetup.ts)', () => {
  it('reads a match back as the setup that plays it', () => {
    const rules: MatchRules = { ...DEFAULT_RULES['core.tdm'], teamSizes: [3, 5], squadSpawn: false, killstreaks: false, friendlyFire: 'half', respawnDelayTicks: 7 * TICK_RATE, weather: 'rain', teamAssign: 'fixed', hostTeam: 1 };
    const s = setupOfMatch(rules, host({ mode: 'core.tdm', teams: 2, sizes: [3, 5], teamSize: 5, fill: 8, skill: 'hard', style: 'tactical' }), 'arena');
    expect(s).toMatchObject({ map: 'arena', mode: 'core.tdm', teams: [3, 5], skill: 'hard', botStyle: 'tactical', squadSpawn: false, killstreaks: false, friendlyFire: 'half', respawn: 7, weather: 'rain', assign: 'fixed', playerTeam: 1 });
    // Played again, it gives the match's rules back.
    const again = rulesFromSetup(s, map(), 16).rules;
    for (const k of ['mode', 'teamSizes', 'squadSpawn', 'killstreaks', 'friendlyFire', 'respawnDelayTicks', 'weather', 'teamAssign', 'hostTeam', 'scoreLimit', 'timeLimitSeconds'] as const) expect(again[k], k).toEqual(rules[k]);
  });

  it('sorts a change into now and at restart', () => {
    const base = setupOfMatch({ ...DEFAULT_RULES['core.deathmatch'] }, host(), 'arena');
    expect(setupChanges(base, { ...base })).toEqual({ live: [], restart: [], patched: true });
    // Bots, skill and the live rules apply now (score and time that follow the size come along without a restart).
    const more = setupChanges(base, { ...base, bots: 7, skill: 'hard', mixPickups: true, scoreLimit: base.scoreAuto ? 99 : base.scoreLimit });
    expect(more.live.sort()).toEqual(['bots', 'mixPickups', 'skill']);
    expect(more.restart).toEqual([]);
    // Score set by hand: the match's own restart takes it. Spawn on teammates (or anything new): a new match.
    expect(setupChanges(base, { ...base, scoreLimit: 40, scoreAuto: false })).toMatchObject({ restart: expect.arrayContaining(['scoreLimit']), patched: true });
    expect(setupChanges(base, { ...base, squadSpawn: false })).toEqual({ live: [], restart: ['squadSpawn'], patched: false });
    // A new mode: everything waits for the restart, bots too.
    expect(setupChanges(base, { ...base, mode: 'core.tdm', bots: 9 })).toMatchObject({ live: [], patched: false });
    // The teams: their sizes now, how many at restart.
    const teams = setupOfMatch({ ...DEFAULT_RULES['core.tdm'], teamSizes: [4, 4] }, host({ mode: 'core.tdm', teams: 2, sizes: [4, 4], teamSize: 4, fill: 8 }), 'arena');
    expect(setupChanges(teams, { ...teams, teams: [5, 5] }).live).toEqual(['teams']);
    expect(setupChanges(teams, { ...teams, teams: [4, 4, 4] }).restart).toContain('teams');
  });

  it('says a change in words, a new setting by its own name', () => {
    expect(changeWords(['squadSpawn', 'killstreaks', 'teamOutlinesX' as never])).toEqual(['spawn on teammates', 'kill streaks', 'team outlines x']);
    expect(restartPatch({ ...DEFAULT_RULES['core.deathmatch'], scoreLimit: 30 })).toMatchObject({ scoreLimit: 30, friendlyFire: 'off', weather: null });
  });
});
