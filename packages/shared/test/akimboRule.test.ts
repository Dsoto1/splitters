/**
 * Dual wielding's match rule with step 2's switch thrown (AKIMBO_READY true): what the dedicated server's rules, a
 * host's map change and a client then see. With the constant as shipped the rule is hidden (serverRules.test.ts).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/sim/rules.ts', async (original) => ({ ...(await original<typeof import('../src/sim/rules.ts')>()), AKIMBO_READY: true }));

import {
  AKIMBO_READY, DEFAULT_RULES, SERVER_RULES, akimboAllowed, applyServerRules, initPhysics, parseRuleValue, ruleSpec, ruleText, rulesForMode, rulesForTravel, rulesFromSetup, serverRuleFor, serverRulesText,
  setServerRule, validateServerRules, type GameMode, type MatchRules, type MatchSetup, type ServerMessage,
} from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

const map = (() => {
  const m = makeMap([{ id: 'a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[0, 0, 0]]);
  return { ...m, metadata: { ...m.metadata, id: 'test_yard', supportedModes: ['core.tdm', 'core.deathmatch', 'core.discs'] as GameMode[] } };
})();
const setup = (over: Partial<MatchSetup> = {}): MatchSetup => ({ map: 'test_yard', mode: 'core.tdm', bots: 7, skill: 'normal', scoreLimit: DEFAULT_RULES['core.tdm'].scoreLimit, minutes: 10, ...over });

describe('dual wielding as a match rule (AKIMBO_READY on)', () => {
  beforeAll(async () => {
    await initPhysics();
    await initNavigation();
  });

  it('is a server rule beside the weapon drops: on by default, for the next match, not in Disc Arena', () => {
    expect(AKIMBO_READY).toBe(true);
    const keys = SERVER_RULES.map((s) => s.key);
    expect(keys.indexOf('akimbo')).toBe(keys.indexOf('drops') + 1);
    const spec = ruleSpec('akimbo')!;
    expect([spec.label, spec.help, spec.apply, spec.type.kind]).toEqual(['Dual wielding', 'Pick up a second of the same small gun to hold one in each hand.', 'next', 'bool']);
    expect([spec.modes!('core.tdm'), spec.modes!('core.discs')]).toEqual([true, false]);
    expect(spec.read(DEFAULT_RULES['core.tdm'])).toBe(true);
    expect(parseRuleValue(spec, 'off')).toEqual({ ok: true, value: false });
    expect(ruleText(spec, false)).toBe('Off');
    const r: MatchRules = { ...DEFAULT_RULES['core.tdm'] };
    spec.write(r, false);
    expect(r.akimbo).toBe(false);
    spec.write(r, true);
    expect('akimbo' in r).toBe(false);
  });

  it('the server rule sets what Match Setup sets, and "default" puts it back on', () => {
    expect(validateServerRules({ akimbo: 'off', maps: { test_yard: { akimbo: true } } })).toEqual({ rules: { akimbo: false, maps: { test_yard: { akimbo: true } } } });
    const sr = setServerRule({}, 'akimbo', false, { mode: 'core.tdm' });
    expect(serverRuleFor(sr, 'akimbo', 'test_yard', 'core.tdm')).toEqual({ value: false, from: 'all' });
    const served = applyServerRules(rulesForMode(map, 'core.tdm'), sr, map, 8).rules;
    expect(served.akimbo).toBe(rulesFromSetup(setup({ akimbo: false }), map).rules.akimbo);
    expect(served.akimbo).toBe(false);
    // Nothing set on the server: the next match is back to the mode's own (on).
    expect('akimbo' in applyServerRules(served, {}, map, 8).rules).toBe(false);
    expect(serverRulesText(sr, served, 'test_yard')).toMatch(/akimbo\s+Off/);
    expect(serverRulesText({}, rulesForMode(map, 'core.tdm'), 'test_yard')).toMatch(/akimbo\s+On/);
    // A server from before the rule: on.
    expect(akimboAllowed(applyServerRules(rulesForMode(map, 'core.tdm'), validateServerRules({ ff: 'half' }).rules, map, 8).rules)).toBe(true);
  });

  it('travels from the setup to the host, the match and the client', () => {
    const { rules } = rulesFromSetup(setup({ akimbo: false }), map);
    // The host changes map: its own settings stay.
    expect(rulesForTravel(rules, map, 8).rules.akimbo).toBe(false);
    expect('akimbo' in rulesForTravel(rulesFromSetup(setup(), map).rules, map, 8).rules).toBe(false);
    // The match keeps the rule and sends it as it sends every rule (the "rules" message is the rules as JSON).
    const match = new Match(map, rules, 1);
    expect(match.rules.akimbo).toBe(false);
    const sent = JSON.parse(JSON.stringify({ t: 'rules', rules: match.rules } satisfies ServerMessage)) as Extract<ServerMessage, { t: 'rules' }>;
    expect(akimboAllowed(sent.rules)).toBe(false);
    const on = JSON.parse(JSON.stringify({ t: 'rules', rules: new Match(map, rulesFromSetup(setup(), map).rules, 1).rules } satisfies ServerMessage)) as Extract<ServerMessage, { t: 'rules' }>;
    expect(akimboAllowed(on.rules)).toBe(true);
  });
});
