import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RULES, MAX_PLAYER_SLOTS, SETUP_PRESETS, initPhysics, modeOptions, normalizeSetup, parseClientMessage, playableModes, presetPlayers, rulesFromSetup, setupNotes, setupPlayers, setupTeams, validateTeamSizes, type MapDocument, type MatchSetup } from '../src/index.ts';
import { BotFiller, HostControl, Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const yard = (spawns = 4): MapDocument => {
  const tiles = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const at: [number, number, number][] = Array.from({ length: spawns }, (_, i) => [(i % 6) * 8 + 2, 0, Math.floor(i / 6) * 4 + 2]);
  const map = makeMap(tiles, at);
  return { ...map, metadata: { ...map.metadata, recommendedPlayers: { min: 2, max: 8 }, supportedModes: ['core.tdm', 'core.deathmatch'] } };
};
const base = (over: Partial<MatchSetup> = {}): MatchSetup => ({ map: 'test_map', mode: 'core.tdm', bots: 3, skill: 'normal', scoreLimit: 40, minutes: 10, ...over });

describe('team configuration', () => {
  it('keeps 2–8 teams of 1–48, at most 96 players in all', () => {
    expect(validateTeamSizes([2, 3, 5], 'core.tdm')).toEqual({ sizes: [2, 3, 5], fixes: [] });
    expect(validateTeamSizes([48, 48], 'core.tdm').sizes).toEqual([48, 48]);
    const big = validateTeamSizes([48, 48, 10], 'core.tdm');
    expect(big.sizes.reduce((a, b) => a + b, 0)).toBe(MAX_PLAYER_SLOTS);
    expect(big.fixes.join()).toMatch(/96/);
    expect(validateTeamSizes([0, 2.6, 99], 'core.tdm').sizes).toEqual([1, 3, 48]);
    expect(validateTeamSizes([1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 'core.tdm').sizes).toHaveLength(8);
    expect(validateTeamSizes([5], 'core.tdm').sizes).toEqual([5, 5]);
    expect(validateTeamSizes(['x', 2], 'core.tdm').sizes).toEqual([1, 2]);
    // Two-team modes keep the first two.
    const ctf = validateTeamSizes([3, 4, 5], 'core.ctf');
    expect(ctf.sizes).toEqual([3, 4]);
    expect(ctf.fixes.join()).toMatch(/two teams/);
  });

  it('presets cover the common shapes up to 48v48, free-for-all included', () => {
    const ids = SETUP_PRESETS.map((p) => p.id);
    for (const id of ['1v1', '2v2', '4v4', '8v8', '16v16', '24v24', '48v48', '2v2v2v2', '4x4', 'ffa8', 'ffa16']) expect(ids).toContain(id);
    expect(presetPlayers(SETUP_PRESETS.find((p) => p.id === '48v48')!)).toBe(96);
    expect(presetPlayers(SETUP_PRESETS.find((p) => p.id === 'ffa16')!)).toBe(16);
    for (const p of SETUP_PRESETS) if (p.sizes) expect(validateTeamSizes(p.sizes, 'core.tdm').fixes).toEqual([]);
  });

  it("uses the setup's teams, else the map's recommended ones", () => {
    const map = yard();
    expect(setupTeams(base(), map)).toEqual([4, 4]);
    expect(setupTeams(base(), { ...map, teamSetup: { sizes: [3, 3, 3] } })).toEqual([3, 3, 3]);
    expect(setupTeams(base({ teams: [2, 3, 5] }), map)).toEqual([2, 3, 5]);
    expect(setupPlayers(base({ teams: [2, 3, 5] }), map)).toBe(10);
    expect(setupPlayers(base({ mode: 'core.deathmatch', bots: 7 }), map)).toBe(8);
  });
});

describe('rules from a setup', () => {
  it('an uneven three-team setup with names, colours and a fixed team', () => {
    const { rules, fill } = rulesFromSetup(base({ teams: [2, 3, 5], teamNames: ['Reds', '', ' Blues '], teamColors: ['#ff0000', 'bad', ''], assign: 'fixed', playerTeam: 2, friendlyFire: 'half', respawn: 4 }), yard());
    expect(fill).toBe(10);
    expect(rules).toMatchObject({ mode: 'core.tdm', teamSizes: [2, 3, 5], teamNames: ['Reds', '', 'Blues'], teamColors: ['#ff0000', '', ''], teamAssign: 'fixed', hostTeam: 2, friendlyFire: 'half', respawnDelayTicks: 240, scoreLimit: 40, timeLimitSeconds: 600 });
  });

  it('two-team modes, free-for-all and co-op', () => {
    const ctf = rulesFromSetup(base({ mode: 'core.ctf', teams: [3, 4, 5], flagReturn: 10, assign: 'fixed', playerTeam: 5 }), yard());
    expect(ctf.rules.teamSizes).toEqual([3, 4]);
    expect(ctf.rules.flagReturnSeconds).toBe(10);
    expect(ctf.rules.hostTeam).toBe(1);
    expect(ctf.fill).toBe(7);
    const ffa = rulesFromSetup(base({ mode: 'core.deathmatch', bots: 15, scoreLimit: 25, minutes: 0, spears: true }), yard());
    expect(ffa.fill).toBe(16);
    expect(ffa.rules).toMatchObject({ scoreLimit: 25, timeLimitSeconds: 0, weapons: 'spears' });
    expect(ffa.rules.teamSizes).toBeUndefined();
    const coop = rulesFromSetup(base({ mode: 'core.coop', bots: 3, scoreLimit: 99 }), yard());
    expect(coop.rules.scoreLimit).toBe(DEFAULT_RULES['core.coop'].scoreLimit);
    expect(coop.fill).toBe(4);
    const forts = rulesFromSetup(base({ mode: 'core.forts', fortBudget: 600 }), yard());
    expect(forts.rules).toMatchObject({ timeLimitSeconds: 0, fortBudget: 600, fortBuildSeconds: 150 });
  });

  it('reads older saved setups', () => {
    const old = { map: 'sandgate', mode: 'core.tdm', bots: 3, skill: 'easy', scoreLimit: 40, minutes: 10, teams: [2, 2, 2, 2, 2, 2, 12], friendlyFire: 'on' };
    const s = normalizeSetup(old)!;
    expect(s).toMatchObject(old);
    expect(rulesFromSetup(s, yard()).rules.teamSizes).toEqual([2, 2, 2, 2, 2, 2, 12]);
    expect(normalizeSetup({ map: 'x', mode: 'core.nope', bots: 'many', teams: 'no' }, ['core.deathmatch'])).toMatchObject({ map: 'x', mode: 'core.deathmatch', bots: 3, skill: 'normal' });
    expect(normalizeSetup({ map: 'x', mode: 'core.ctf' }, ['core.tdm', 'core.deathmatch'])!.mode).toBe('core.tdm');
    expect(normalizeSetup(null)).toBeNull();
    expect(normalizeSetup({ mode: 'core.tdm' })).toBeNull();
  });
});

describe('fits the map', () => {
  it('greys out modes the map can not play, with the reason', () => {
    const map = yard();
    const opts = modeOptions(map, playableModes(map));
    expect(opts.find((o) => o.mode === 'core.tdm')!.ok).toBe(true);
    expect(opts.find((o) => o.mode === 'core.ctf')).toMatchObject({ ok: false, reason: expect.stringMatching(/flag base/) });
    expect(opts.find((o) => o.mode === 'core.bomb')!.reason).toMatch(/bomb sites/);
    expect(opts.find((o) => o.mode === 'core.race')!.reason).toMatch(/track/);
  });

  it('warns (without blocking) about shared spawns, crowding and big matches', () => {
    const map = yard(4);
    expect(setupNotes(base({ teams: [2, 2] }), map)).toEqual([]);
    const notes = setupNotes(base({ teams: [24, 24] }), map).map((n) => n.text).join('\n');
    expect(notes).toMatch(/spawns will be shared/);
    expect(notes).toMatch(/made for 2–8 players/);
    expect(notes).toMatch(/big match/);
    expect(setupNotes(base({ teams: [48, 48] }), map).some((n) => n.level === 'warn' && /very big/.test(n.text))).toBe(true);
    // Teams beyond the map's own sides use the shared spawns.
    const sided = { ...map, factions: [{ id: 'red', name: 'Red', color: '#ff0000', relations: {} }, { id: 'blue', name: 'Blue', color: '#0000ff', relations: {} }], entities: map.entities.map((e, i) => (e.kind === 'spawn' && i < 2 ? { ...e, faction: i ? 'blue' : 'red' } : e)) } as MapDocument;
    const three = setupNotes(base({ teams: [1, 1, 1] }), sided).map((n) => n.text).join('\n');
    expect(three).toMatch(/Verdant has no spawn points of its own/);
    expect(three).toMatch(/sides are Red and Blue/);
  });
});

describe('team assignment in the match', () => {
  const start = (s: MatchSetup, seed = 3) => {
    const map = yard(8);
    const { rules, fill } = rulesFromSetup(s, map);
    const match = new Match(map, rules, seed);
    const me = match.addHuman('You')!;
    const bots = new BotFiller(match);
    bots.rebalance(fill);
    return { match, me, bots, fill };
  };
  const sizes = (m: Match) => m.teams!.map((t) => m.combatants().filter((c) => c.faction === t.id).length);

  it('a custom uneven 3-team setup fills to its sizes', () => {
    const { match } = start(base({ teams: [2, 3, 5] }));
    expect(sizes(match)).toEqual([2, 3, 5]);
  });

  it('fixed: you join the team you picked, and the sizes still hold', () => {
    const { match, me } = start(base({ teams: [2, 3, 5], assign: 'fixed', playerTeam: 2 }));
    expect(me.faction).toBe(match.teams![2]!.id);
    expect(sizes(match)).toEqual([2, 3, 5]);
  });

  it('a friend joining takes a bot on the team that needs a person; random picks a team with room', () => {
    const { match, bots, fill } = start(base({ teams: [3, 3], assign: 'fixed', playerTeam: 1 }));
    const friend = bots.join('Friend', undefined, fill)!;
    expect(friend.faction).toBe(match.teams![0]!.id);
    expect(sizes(match)).toEqual([3, 3]);
    const seen = new Set<string>();
    for (let seed = 1; seed < 12; seed++) {
      const r = start(base({ teams: [2, 2, 2], assign: 'random' }), seed);
      seen.add(r.me.faction!);
      expect(sizes(r.match)).toEqual([2, 2, 2]);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('the host changes each team\'s size live; rules wait for the restart', () => {
    const { match, bots, fill } = start(base({ teams: [2, 3, 5] }));
    const control = new HostControl(match, bots, fill);
    expect(control.state()).toMatchObject({ teams: 3, sizes: [2, 3, 5], teamSize: 5 });
    expect(control.apply({ c: 'bots', teamSizes: [4, 1, 6] }).notice).toBe('Host set teams to 4v1v6');
    expect(sizes(match)).toEqual([4, 1, 6]);
    expect(control.fill).toBe(11);
    expect(control.apply({ c: 'rules', rules: { scoreLimit: 10, friendlyFire: 'on' } }).notice).toMatch(/next restart/);
    expect(match.rules.scoreLimit).toBe(40);
    expect(control.state().pending).toEqual({ scoreLimit: 10, friendlyFire: 'on' });
    control.apply({ c: 'restart' });
    expect(match.rules).toMatchObject({ scoreLimit: 10, friendlyFire: 'on' });
    expect(control.state().pending).toEqual({});
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'bots', teamSizes: [2, 3, 5] } }))).toEqual({ t: 'host', cmd: { c: 'bots', teamSizes: [2, 3, 5] } });
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'bots', teamSizes: [2] } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'rules', rules: { scoreLimit: 5, friendlyFire: 'half' } } }))).toEqual({ t: 'host', cmd: { c: 'rules', rules: { scoreLimit: 5, friendlyFire: 'half' } } });
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'rules', rules: { friendlyFire: 'always' } } }))).toBeNull();
  });
});
