import { describe, expect, it } from 'vitest';
import { addMatch, careerAccuracy, careerKd, careerProblem, careerWinRate, emptyCareer, favouriteWeapon, matchProblem, readCareer, CAREER_WEAPONS, type MatchSummary } from '../src/index.ts';

const match = (o: Partial<MatchSummary> = {}): MatchSummary => ({ mode: 'core.tdm', result: 'win', kills: 10, deaths: 4, shots: 200, hits: 50, headshots: 2, bestStreak: 5, seconds: 300, weaponKills: { 'core.rifle': 8, 'core.pistol': 2 }, ...o });

describe('career stats', () => {
  it('sums matches and reads off K/D, accuracy, win rate and the favourite weapon', () => {
    let c = emptyCareer();
    expect(careerAccuracy(c)).toBeNull();
    expect(careerWinRate(c)).toBeNull();
    expect(favouriteWeapon(c)).toBeNull();
    c = addMatch(c, match());
    c = addMatch(c, match({ result: 'loss', kills: 2, deaths: 8, bestStreak: 1, headshots: 0, weaponKills: { 'core.shotgun': 2 } }));
    expect(c).toMatchObject({ matches: 2, wins: 1, kills: 12, deaths: 12, shots: 400, hits: 100, headshots: 2, bestStreak: 5, seconds: 600 });
    expect(careerKd(c)).toBe(1);
    expect(careerAccuracy(c)).toBe(25);
    expect(careerWinRate(c)).toBe(50);
    expect(favouriteWeapon(c)).toBe('core.rifle');
    // Kills alone before a death.
    expect(careerKd({ kills: 3, deaths: 0 })).toBe(3);
  });

  it('keeps only the most-used weapons', () => {
    let c = emptyCareer();
    for (let i = 0; i < CAREER_WEAPONS + 5; i++) c = addMatch(c, match({ kills: 1, headshots: 0, bestStreak: 1, weaponKills: { [`core.w${String(i).padStart(2, '0')}`]: 1 } }));
    expect(Object.keys(c.weaponKills)).toHaveLength(CAREER_WEAPONS);
  });

  it('refuses summaries no real match makes', () => {
    expect(matchProblem(match())).toBeNull();
    expect(matchProblem(null)).toMatch(/summary/);
    expect(matchProblem(match({ mode: 'DROP TABLE' }))).toMatch(/mode/);
    expect(matchProblem(match({ hits: 201 }))).toMatch(/hits/);
    expect(matchProblem(match({ headshots: 11 }))).toMatch(/headshots/);
    expect(matchProblem(match({ bestStreak: 11 }))).toMatch(/streak/);
    expect(matchProblem(match({ seconds: 29 }))).toMatch(/short/);
    expect(matchProblem(match({ deaths: -1 }))).toMatch(/range/);
    expect(matchProblem(match({ weaponKills: { 'core.rifle': 11 } }))).toMatch(/more than kills/);
    expect(matchProblem(match({ weaponKills: { '<script>': 1 } }))).toMatch(/bad weapon/);
  });

  it('reads stored careers safely and checks a guest career before it moves to an account', () => {
    expect(readCareer('nope')).toBeNull();
    expect(readCareer({ matches: 2, wins: 5, shots: 3, hits: 9, kills: -4, weaponKills: { 'core.rifle': 2, bad: 3 } })).toEqual({ ...emptyCareer(), matches: 2, wins: 2, shots: 3, hits: 3, weaponKills: { 'core.rifle': 2 } });
    const ok = addMatch(addMatch(emptyCareer(), match()), match());
    expect(careerProblem(ok)).toBeNull();
    expect(careerProblem(emptyCareer())).toMatch(/no matches/);
    expect(careerProblem({ ...ok, kills: 2 * 500 + 1 })).toMatch(/range/);
    expect(careerProblem({ ...ok, seconds: 10 })).toMatch(/range/);
  });
});
