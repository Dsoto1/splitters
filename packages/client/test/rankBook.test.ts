import { beforeEach, describe, expect, it } from 'vitest';
import type { RosterEntry, ScoreEntry } from '@tiletrigger/shared';
import { RankBook, resetCarriedRanks } from '../src/game/rankBook.ts';
import { rankGlow } from '../src/game/rankGlow.ts';

const roster = (...e: Partial<RosterEntry>[]): Map<number, RosterEntry> => new Map(e.map((p, i) => [p.slot ?? i, { slot: i, name: `P${i}`, bot: true, look: 'core.scamp', team: null, ...p } as RosterEntry]));
const none = () => null;

describe('who ranks how (rankBook.ts)', () => {
  beforeEach(() => resetCarriedRanks());

  it('starts everyone on step 1, you on your career, a person on what they sent, leaders higher', () => {
    const b = new RankBook(() => 600);
    const r = roster({ slot: 0, bot: false, name: 'Me' }, { slot: 1, bot: false, name: 'Ann', rx: 260 }, { slot: 2, name: 'Sgt. Dunmore' }, { slot: 3, name: 'Lead' });
    const s: ScoreEntry[] = [0, 1, 2, 3].map((i) => ({ s: i, k: 0, d: 0 }));
    expect(b.update(r, s, 0, (slot) => (slot === 3 ? 'team' : null))).toEqual([]);
    expect([0, 1, 2, 3].map((i) => b.step(i))).toEqual([4, 3, 1, 4]);
  });

  it('ranks up quietly with kills, and says who just did', () => {
    const b = new RankBook(() => 0);
    const r = roster({ slot: 0, name: 'Bot' });
    b.update(r, [{ s: 0, k: 9, d: 0 }], 99, none);
    expect(b.step(0)).toBe(1);
    expect(b.update(r, [{ s: 0, k: 10, d: 0 }], 99, none)).toEqual([0]);
    expect(b.step(0)).toBe(2);
    expect(b.update(r, [{ s: 0, k: 11, d: 0 }], 99, none)).toEqual([]);
  });

  it('carries a bot from match to match by name, its Army rank left off', () => {
    const r1 = roster({ slot: 0, name: 'Sgt. Dunmore' });
    new RankBook(() => 0).update(r1, [{ s: 0, k: 30, d: 0 }], 99, none);
    // The next match: a new book, the same bot in another slot, under another rank.
    const b = new RankBook(() => 0);
    b.update(roster({ slot: 0, name: 'Pvt. Dunmore' }), [{ s: 0, k: 0, d: 0 }], 99, none);
    expect(b.step(0)).toBe(3);
    // Points starting again in a slot is a new match there too: from what was carried, never lower.
    b.update(roster({ slot: 0, name: 'Pvt. Dunmore' }), [{ s: 0, k: 20, d: 0 }], 99, none);
    b.update(roster({ slot: 0, name: 'Pvt. Dunmore' }), [{ s: 0, k: 0, d: 0 }], 99, none);
    expect(b.step(0)).toBe(4);
  });

  it('glows calmer with Reduce flashing, and for about a second', () => {
    expect(rankGlow(0, false)!.scale).toBe(1);
    expect(rankGlow(0.25, false)!.scale).toBeCloseTo(1.45);
    expect(rankGlow(0.5, true)!.scale).toBeCloseTo(1.2);
    let most = 0;
    for (let t = 0; t < 1; t += 0.01) most = Math.max(most, rankGlow(t, true)!.glow);
    expect(most).toBeLessThanOrEqual(0.3);
    expect(rankGlow(1, false)).toBeNull();
  });
});
