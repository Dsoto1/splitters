/**
 * Dual wielding with its switch off (rules.ts AKIMBO_READY false, as before step 4): the rule is not on offer
 * anywhere, and a match whose rules carry it keeps it. Shipped on since step 4 (serverRules.test.ts, akimboRule.test.ts).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/sim/rules.ts', async (original) => ({ ...(await original<typeof import('../src/sim/rules.ts')>()), AKIMBO_READY: false }));

import { AKIMBO_READY, applyServerRules, ruleSpec, rulesForMode, serverRulesText, validateServerRules, type GameMode } from '../src/index.ts';
import { makeMap } from './helpers.ts';

const map = (() => {
  const m = makeMap([{ id: 'a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[0, 0, 0]]);
  return { ...m, metadata: { ...m.metadata, id: 'test_yard', supportedModes: ['core.tdm', 'core.deathmatch'] as GameMode[] } };
})();

describe('dual wielding switched off (AKIMBO_READY false)', () => {
  it('leaves the rule out of the server rules and summaries', () => {
    expect(AKIMBO_READY).toBe(false);
    expect(ruleSpec('akimbo')).toBeUndefined();
    expect(validateServerRules({ akimbo: false }).error).toMatch(/unknown rule "akimbo"/);
    expect(serverRulesText({}, rulesForMode(map, 'core.tdm'), 'test_yard')).not.toMatch(/akimbo/);
    // A match whose rules carry it keeps it through the server's own rules.
    expect(applyServerRules({ ...rulesForMode(map, 'core.tdm'), akimbo: false }, {}, map, 8).rules.akimbo).toBe(false);
  });
});
