import { describe, expect, it } from 'vitest';
import { paceLines, paceWarnings } from '../src/tools/paceCompare.ts';

describe("a changed map's pace against the map before (bot-report --base)", () => {
  it('warns when kills a minute fall well below the map before (Iron Maw: about 17 to about 4)', () => {
    const w = paceWarnings({ killsMin: 17.2, firstFight: 6 }, { killsMin: 4.1, firstFight: 7 });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/kills a minute fell from 17\.2 to 4\.1 \(76% fewer\)/);
  });
  it('warns when the first fight comes much later', () => {
    expect(paceWarnings({ killsMin: 10, firstFight: 6 }, { killsMin: 9, firstFight: 14 })[0]).toMatch(/first fight after a spawn comes 8\.0 s later \(6\.0 s to 14\.0 s\)/);
    // Half as long again but under 5 s more: seed noise on a small map.
    expect(paceWarnings({ killsMin: 10, firstFight: 2 }, { killsMin: 10, firstFight: 4 })).toEqual([]);
  });
  it('says nothing for a map that plays about as before, or faster', () => {
    expect(paceWarnings({ killsMin: 10, firstFight: 6 }, { killsMin: 7, firstFight: 8 })).toEqual([]);
    expect(paceWarnings({ killsMin: 4, firstFight: 20 }, { killsMin: 17, firstFight: 5 })).toEqual([]);
    expect(paceWarnings({ killsMin: 0 }, { killsMin: 0 })).toEqual([]);
  });
  it('prints both numbers before and after, and a warning line', () => {
    const lines = paceLines('iron_maw', 'origin/main', { killsMin: 17.2, firstFight: 6 }, { killsMin: 4.1, firstFight: 7 });
    expect(lines[0]).toBe('iron_maw against origin/main: kills a minute 17.2 → 4.1; first fight after a spawn 6.0 → 7.0 s');
    expect(lines[1]).toMatch(/^WARNING +map\.pace +iron_maw: kills a minute fell/);
    expect(paceLines('a', 'origin/main', { killsMin: 5 }, { killsMin: 5 })).toEqual(['a against origin/main: kills a minute 5.0 → 5.0; first fight after a spawn - → - s']);
  });
});
