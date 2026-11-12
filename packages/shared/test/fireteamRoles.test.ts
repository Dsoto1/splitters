import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { initPhysics, loadMap, rulesForMode } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { CORE_BOT_PROFILES } from '../src/bots/profile.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

type Roles = { director: { roleOf(slot: number): string | null } | null };

// Fireteams: every bot plays in its squad. The roles are handed out as bots join, before the first tick makes the
// squads; they must be handed out again then. Before, the campers, snipers and lone wolves kept their roles: one that
// led a squad took it to a vantage spot and sat there (owner, 2026-11-12: squads on their side stood about until
// they shot the squad's leader, and the next bot led it on).
it('in Fireteams no bot keeps a camper, sniper or lone wolf role', () => {
  const r = loadMap(readFileSync(new URL('../../../maps/riot_junction.json', import.meta.url), 'utf8'));
  if (!r.ok) throw new Error('Riot Junction does not load');
  const lone = (fireteams: number | undefined) => {
    const rules = { ...rulesForMode(r.map, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0, teamSizes: [16, 16], ...(fireteams ? { fireteams } : {}) };
    const match = new Match(r.map, rules, 1);
    for (let i = 0; i < 32; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, undefined, true);
    for (let i = 0; i < 5; i++) match.step();
    const d = (match as unknown as Roles).director!;
    return match.combatants().filter((c) => c.bot && d.roleOf(c.slot) !== 'squad').length;
  };
  // (Without the variant this roster has some: else the test would say nothing.)
  expect(lone(undefined)).toBeGreaterThan(0);
  expect(lone(4)).toBe(0);
}, 120000);
