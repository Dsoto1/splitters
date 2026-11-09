import { describe, expect, it } from 'vitest';
import type { RosterEntry } from '@tiletrigger/shared';
import { ffaPartyMate } from '../src/game/ffaParty.ts';

describe('free-for-all parties: who gets the friendly name and marker', () => {
  const roster = (...p: RosterEntry[]) => new Map(p.map((e) => [e.slot, e]));
  const person = (slot: number, py?: string, team: string | null = null): RosterEntry => ({ slot, name: `P${slot}`, bot: false, look: 'core.soldier', team, ...(py ? { py } : {}) });
  it('people of your party, not you, not strangers, not bots', () => {
    const r = roster(person(0, 'PARTY01'), person(1, 'PARTY01'), person(2, 'OTHER01'), person(3), { ...person(4, 'PARTY01'), bot: true });
    expect(ffaPartyMate(r, 0, 1)).toBe(true);
    expect(ffaPartyMate(r, 0, 0)).toBe(false);
    expect(ffaPartyMate(r, 0, 2)).toBe(false);
    expect(ffaPartyMate(r, 0, 3)).toBe(false);
    expect(ffaPartyMate(r, 0, 4)).toBe(false);
    // No party of your own: nobody.
    expect(ffaPartyMate(r, 3, 1)).toBe(false);
  });
  it('team modes keep team colours (the party is already on your side)', () => {
    const r = roster(person(0, 'PARTY01', 'red'), person(1, 'PARTY01', 'red'));
    expect(ffaPartyMate(r, 0, 1)).toBe(false);
  });
});
