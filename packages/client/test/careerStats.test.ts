import { beforeEach, describe, expect, it } from 'vitest';
import type { MatchSummary } from '@tiletrigger/shared';

const store = new Map<string, string>();
const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
Object.assign(globalThis, { localStorage: storage, sessionStorage: storage });
const { localCareer, myCareer, myFavClass, recordMatch, setFavClass } = await import('../src/careerStats.ts');

const match = (o: Partial<MatchSummary> = {}): MatchSummary => ({ mode: 'core.tdm', result: 'win', kills: 5, deaths: 2, shots: 50, hits: 20, headshots: 1, bestStreak: 3, seconds: 200, weaponKills: { 'core.rifle': 5 }, ...o });

describe('career stats in the browser', () => {
  beforeEach(() => store.clear());

  it("keeps a guest's matches and favourite class in this browser", async () => {
    expect(myCareer()).toMatchObject({ where: 'browser', career: { matches: 0 } });
    recordMatch(match());
    recordMatch(match({ result: 'loss' }));
    expect(localCareer()).toMatchObject({ matches: 2, wins: 1, kills: 10 });
    expect(myCareer().career.matches).toBe(2);
    expect(myFavClass()).toBeNull();
    await setFavClass('medic');
    expect(myFavClass()).toBe('medic');
    await setFavClass(null);
    expect(myFavClass()).toBeNull();
    // Damaged storage reads as no career.
    store.set('tiletrigger.career', '{oops');
    expect(localCareer().matches).toBe(0);
  });
});
