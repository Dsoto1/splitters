// Playbooks per mode (bots/playbooks.ts; docs/BOTS.md, "Playbooks"; BOT_AI_PLAN.md Phase B item 3).
import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAYBOOK, PLAYBOOKS, ctfDefenders, ctfDefendersBy, playbookFor } from '../src/match.ts';

describe('playbooks', () => {
  it('every scorecard mode has one, and their numbers make sense', () => {
    for (const mode of ['core.ctf', 'core.koth', 'core.bomb', 'core.hostage', 'core.elim', 'core.forts', 'core.tdm', 'core.coop', 'core.zombies', 'core.breakthrough']) {
      const pb = playbookFor(mode).team;
      expect(PLAYBOOKS[mode], mode).toBeDefined();
      expect(pb.flank).toBeGreaterThanOrEqual(0);
      expect(pb.flank).toBeLessThan(1);
      expect(pb.stageMin).toBeLessThanOrEqual(pb.stageMax);
      expect(pb.stretch).toBeGreaterThanOrEqual(1);
      expect(pb.interceptors).toBeGreaterThanOrEqual(0);
    }
    // A mode without one plays by the default.
    expect(playbookFor('core.deathmatch').team).toBe(DEFAULT_PLAYBOOK);
  });

  it("Capture the Flag's defenders by team size are the owner's (2-3; 3 for 12 or more), from the playbook", () => {
    const roles = playbookFor('core.ctf').ctf!;
    expect([2, 3, 4, 8, 11, 12, 16].map((n) => ctfDefendersBy(roles, n))).toEqual([1, 1, 2, 2, 2, 3, 3]);
    expect([2, 3, 4, 8, 11, 12, 16].map(ctfDefenders)).toEqual([1, 1, 2, 2, 2, 3, 3]);
  });

  it('King of the Hill goes straight for the hill; Capture the Flag splits only on long trips, with no interceptors', () => {
    expect(playbookFor('core.koth').team.split).toBe('never');
    const ctf = playbookFor('core.ctf').team;
    expect(ctf.split).toBe('always');
    expect(ctf.groupsFromLength).toBeGreaterThanOrEqual(180);
    expect(ctf.interceptors).toBe(0);
    expect(ctf.bound).toBe('style');
  });

  it("Breakthrough's attackers spread over every trip and all bound; its defenders' shares leave some on the objective", () => {
    const b = playbookFor('core.breakthrough');
    expect(b.team.groupsFromLength).toBe(0);
    expect(b.team.bound).toBe('all');
    const r = b.breakthrough!;
    expect(r.guns + r.trenches + r.crestSnipers).toBeLessThan(1);
    expect(r.fallBack).toBeGreaterThan(0);
    expect(r.fallBackAt).toBeGreaterThan(0);
    expect(r.fallBackAt).toBeLessThan(1);
  });
});
