import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, SERVER_RULES, applyServerRules, parseRuleValue, ruleSpec, rulesForMode, rulesFromSetup, serverRuleFor, serverRulesText, setServerRule, validateServerRules, type GameMode, type MatchRules, type MatchSetup, type ServerRules } from '../src/index.ts';
import { makeMap } from './helpers.ts';

const map = (() => {
  const m = makeMap([{ id: 'a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[0, 0, 0]]);
  return { ...m, metadata: { ...m.metadata, id: 'test_yard', supportedModes: ['core.tdm', 'core.ctf', 'core.koth', 'core.forts', 'core.race', 'core.deathmatch'] } };
})();
const setup = (mode: GameMode, over: Partial<MatchSetup> = {}): MatchSetup => ({ map: 'test_yard', mode, bots: 7, skill: 'normal', scoreLimit: DEFAULT_RULES[mode].scoreLimit, minutes: DEFAULT_RULES[mode].timeLimitSeconds / 60, ...over });
const served = (mode: GameMode, sr: ServerRules, fill = 8): MatchRules => applyServerRules(rulesForMode(map, mode), sr, map, fill).rules;

/**
 * Parity with the browser host: every rule Play → Match setup sets (rulesFromSetup) has a server rule that
 * puts the same thing in the match's rules. [server rule, value, mode, the Match setup that sets the same, fields to compare]
 */
const PARITY: [string, unknown, GameMode, Partial<MatchSetup>, (keyof MatchRules)[]][] = [
  ['score', 77, 'core.tdm', { scoreLimit: 77 }, ['scoreLimit']],
  ['time', 15, 'core.tdm', { minutes: 15 }, ['timeLimitSeconds']],
  ['respawn', 7, 'core.tdm', { respawn: 7 }, ['respawnDelayTicks']],
  ['ff', 'half', 'core.tdm', { friendlyFire: 'half' }, ['friendlyFire']],
  ['mix', true, 'core.tdm', { mixPickups: true }, ['mixPickups']],
  ['drops', false, 'core.tdm', { dropWeapons: false }, ['dropWeapons']],
  ['style', 'arena', 'core.tdm', { botStyle: 'arena' }, ['botStyle']],
  ['assign', 'random', 'core.tdm', { assign: 'random' }, ['teamAssign']],
  ['teamnames', ['Reds', 'Blues'], 'core.tdm', { teamNames: ['Reds', 'Blues'] }, ['teamNames']],
  ['teamcolors', ['#ff0000', '#0000ff'], 'core.tdm', { teamColors: ['#ff0000', '#0000ff'] }, ['teamColors']],
  ['leaders', 'vip', 'core.tdm', { leaders: 'vip' }, ['leaders']],
  ['squadspawn', false, 'core.tdm', { squadSpawn: false }, ['squadSpawn']],
  ['streaks', false, 'core.deathmatch', { killstreaks: false }, ['killstreaks']],
  ['sizes', false, 'core.deathmatch', { sizes: false }, ['bodySizes']],
  ['gravity', 'low', 'core.deathmatch', { gravity: 0.4 }, ['gravity']],
  ['fall', true, 'core.deathmatch', { fallDamage: true }, ['fallDamage']],
  ['lethality', 'tactical', 'core.deathmatch', { lethality: 'tactical' }, ['lethality']],
  ['ballistics', 'advanced', 'core.deathmatch', { ballistics: 'advanced' }, ['ballistics']],
  ['emotes', false, 'core.deathmatch', { emotes: false }, ['emotes']],
  ['weapons', 'spears', 'core.deathmatch', { spears: true }, ['weapons']],
  ['classes', '2', 'core.tdm', { classes: true, classLimit: 2 }, ['classes', 'classLimit']],
  ['vehicles', 'tough', 'core.deathmatch', { vehicleDamage: 'tough' }, ['vehicleDamage']],
  ['flagreturn', 45, 'core.ctf', { flagReturn: 45 }, ['flagReturnSeconds']],
  ['hill', 90, 'core.koth', { hill: 90 }, ['hillSeconds']],
  ['fortbuild', 4, 'core.forts', { fortBuild: 4 }, ['fortBuildSeconds']],
  ['fortcombat', 8, 'core.forts', { fortCombat: 8 }, ['fortCombatSeconds']],
  ['fortcycles', 3, 'core.forts', { fortCycles: 3 }, ['fortCycles']],
  ['fortbudget', 600, 'core.forts', { fortBudget: 600 }, ['fortBudget']],
  ['laps', 5, 'core.race', { raceLaps: 5 }, ['raceLaps']],
  ['racevehicle', 'buggy', 'core.race', { raceVehicle: 'buggy' }, ['raceVehicle']],
  ['racecombat', false, 'core.race', { raceCombat: false }, ['raceCombat']],
];

describe('server match rules (RULES): parity with the browser host', () => {
  it('every Match setup rule has a server rule that sets the same thing', () => {
    for (const [key, value, mode, over, fields] of PARITY) {
      const spec = ruleSpec(key)!;
      expect(spec, key).toBeDefined();
      const sr = setServerRule({}, key, value, { mode });
      const got = served(mode, sr);
      const want = rulesFromSetup(setup(mode, over), map).rules;
      for (const f of fields) expect([key, f, got[f]]).toEqual([key, f, want[f]]);
    }
  });

  it('covers every rule (none left out of the parity list), and the team count', () => {
    expect(new Set([...PARITY.map((p) => p[0]), 'teams'])).toEqual(new Set(SERVER_RULES.map((s) => s.key)));
    const four = applyServerRules(rulesForMode(map, 'core.tdm'), setServerRule({}, 'teams', 4, { mode: 'core.tdm' }), map, 16);
    expect(four.rules.teamSizes).toEqual([4, 4, 4, 4]);
    expect(four.fill).toBe(16);
    // Two-team modes stay two.
    expect(applyServerRules(rulesForMode(map, 'core.ctf'), { teams: 4 }, map, 16).rules.teamSizes).toHaveLength(2);
  });

  it('keeps score, time and respawn per mode, and lets one map override any rule', () => {
    let sr: ServerRules = {};
    sr = setServerRule(sr, 'score', 60, { mode: 'core.tdm' });
    sr = setServerRule(sr, 'time', 20, { mode: 'core.tdm', map: 'iron_maw' });
    sr = setServerRule(sr, 'ff', 'on', { mode: 'core.tdm' });
    expect(sr).toEqual({ modes: { tdm: { score: 60 } }, maps: { iron_maw: { time: 20 } }, ff: 'on' });
    expect(served('core.tdm', sr).scoreLimit).toBe(60);
    // CTF's own score limit is untouched by Team Deathmatch's.
    expect(served('core.ctf', sr).scoreLimit).toBe(DEFAULT_RULES['core.ctf'].scoreLimit);
    expect(serverRuleFor(sr, 'time', 'iron_maw', 'core.ctf')).toEqual({ value: 20, from: 'map' });
    expect(serverRuleFor(sr, 'time', 'frost_basin', 'core.tdm')).toBeNull();
    // Back to the default: the empty boxes go too.
    expect(setServerRule(setServerRule(sr, 'time', undefined, { mode: 'core.tdm', map: 'iron_maw' }), 'score', undefined, { mode: 'core.tdm' })).toEqual({ ff: 'on' });
  });

  it('puts a "next match" rule back to the mode\'s own when the server no longer sets it', () => {
    const low = served('core.deathmatch', { gravity: 'low', classes: 'on' });
    expect(low.gravity).toBe(0.4);
    const again = applyServerRules(low, {}, map, 8).rules;
    expect(again.gravity).toBeUndefined();
    expect(again.classes).toBeUndefined();
    // Spears only and classes don't mix.
    expect(served('core.deathmatch', { weapons: 'spears', classes: 'on' }).classes).toBeUndefined();
  });

  it('checks RULES from host.json and the console', () => {
    expect(validateServerRules('{"ff":"half","modes":{"tdm":{"score":"60","time":15}},"maps":{"iron_maw":{"gravity":"Low"}}}').rules).toEqual({ ff: 'half', modes: { tdm: { score: 60, time: 15 } }, maps: { iron_maw: { gravity: 'low' } } });
    expect(validateServerRules({ score: 60 }).error).toMatch(/per mode/);
    expect(validateServerRules({ wobble: 1 }).error).toMatch(/unknown rule "wobble"/);
    expect(validateServerRules({ modes: { space: {} } }).error).toMatch(/not a mode/);
    expect(validateServerRules({ modes: { tdm: { score: 5000 } } }).error).toMatch(/0 to 1000/);
    expect(validateServerRules('not json').error).toMatch(/JSON/);
    expect(parseRuleValue(ruleSpec('time')!, '∞')).toEqual({ ok: true, value: 0 });
    expect(parseRuleValue(ruleSpec('sizes')!, 'all equal')).toEqual({ ok: true, value: false });
    expect(parseRuleValue(ruleSpec('ff')!, 'Full')).toEqual({ ok: true, value: 'on' });
    expect(parseRuleValue(ruleSpec('teamcolors')!, '#ff0000, red').ok).toBe(false);
  });

  it('lists what plays and what waits for the console', () => {
    const now = rulesForMode(map, 'core.tdm');
    const text = serverRulesText({ modes: { tdm: { score: 60 } } }, now, 'test_yard');
    expect(text).toMatch(/score\s+40\s+→ 60 at the restart/);
    expect(text).not.toMatch(/laps/);
  });
});
