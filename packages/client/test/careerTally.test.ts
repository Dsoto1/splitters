import { describe, expect, it } from 'vitest';
import { emptyCareer, matchProblem, type GameEvent } from '@tiletrigger/shared';
import { CareerTally } from '../src/game/careerTally.ts';
import { cardLines } from '../src/game/profileCard.ts';

const ME = 3;
// Slots 0-3 on team A, 4-7 on team B.
const team = (s: number) => (s < 4 ? 'a' : 'b');
const tally = () => new CareerTally(() => ME, (a, b) => team(a) !== team(b), 0);
const shot = (s: number, w: string, hit: (number | null)[], fl?: number[]): GameEvent => ({ e: 'shot', s, w, from: [0, 0, 0], to: hit.map(() => [1, 1, 1]), hit, ...(fl ? { fl } : {}) });
const kill = (killer: number | null, victim: number, weapon = 'core.rifle', o: { hs?: 1; tk?: 1 } = {}): GameEvent => ({ e: 'kill', killer, victim, weapon, ...o });

describe('career tally', () => {
  it('counts your rounds, hits on enemies, kills, deaths, streaks and weapons from the events', () => {
    const t = tally();
    t.event(shot(ME, 'core.rifle', [5])); // a hit on an enemy
    t.event(shot(ME, 'core.rifle', [1])); // a teammate: no hit
    t.event(shot(ME, 'core.rifle', [null]));
    t.event(shot(ME, 'core.shotgun', [5, 6, null, 5])); // pellets
    t.event(shot(ME, 'core.rifle', [5], [0])); // still flying: its impact decides
    t.event({ e: 'impact', s: ME, w: 'core.rifle', from: [0, 0, 0], to: [1, 1, 1], hit: 6 });
    t.event(shot(4, 'core.rifle', [ME])); // someone else's
    t.event(kill(ME, 5, 'core.rifle', { hs: 1 }));
    t.event(kill(ME, 6, 'core.shotgun'));
    t.event(kill(ME, 1, 'core.rifle', { tk: 1 })); // a team kill counts nothing
    t.event(kill(4, ME));
    t.event(kill(ME, 7, 'core.rifle'));
    t.event(kill(ME, 4, 'core.fall')); // not a weapon: a kill, no weapon
    expect({ shots: t.shots, hits: t.hits, kills: t.kills, deaths: t.deaths, headshots: t.headshots, best: t.bestStreak }).toEqual({ shots: 8, hits: 5, kills: 4, deaths: 1, headshots: 1, best: 2 });
    const s = t.finish({ e: 'round_end', winner: null, team: 'a' }, 'core.tdm', 'a', 120_000, 'Phase 0 Arena');
    // (Phase 3: the map, and rounds and hits by gun.)
    expect(s).toEqual({ mode: 'core.tdm', result: 'win', kills: 4, deaths: 1, shots: 8, hits: 5, headshots: 1, bestStreak: 2, seconds: 120, weaponKills: { 'core.rifle': 2, 'core.shotgun': 1 }, map: 'Phase 0 Arena', weaponRounds: { 'core.rifle': [4, 2], 'core.shotgun': [4, 3] }, at: expect.any(Number) });
    expect(matchProblem(s)).toBeNull();
    // Once per match.
    expect(t.finish({ e: 'round_end', winner: null, team: 'a' }, 'core.tdm', 'a', 130_000)).toBeNull();
    t.reset(200_000);
    expect(t.kills).toBe(0);
  });

  it('reads the result for teams, free-for-all and co-op, and skips a match you were hardly in', () => {
    const at = (ev: Extract<GameEvent, { e: 'round_end' }>, myTeam: string | null = null) => tally().finish(ev, 'core.deathmatch', myTeam, 60_000)?.result;
    expect(at({ e: 'round_end', winner: null, team: 'b' }, 'a')).toBe('loss');
    expect(at({ e: 'round_end', winner: null, team: null }, 'a')).toBe('draw');
    expect(at({ e: 'round_end', winner: ME })).toBe('win');
    expect(at({ e: 'round_end', winner: 5 })).toBe('loss');
    expect(at({ e: 'round_end', winner: null })).toBe('draw');
    expect(at({ e: 'round_end', winner: null, outcome: 'victory' })).toBe('win');
    expect(at({ e: 'round_end', winner: null, outcome: 'defeat' })).toBe('loss');
    expect(tally().finish({ e: 'round_end', winner: ME }, 'core.deathmatch', null, 10_000)).toBeNull();
  });

  it("writes the profile card's lines", () => {
    const career = { ...emptyCareer(), matches: 3, wins: 1, kills: 30, deaths: 20, shots: 400, hits: 100, weaponKills: { 'core.rifle': 20 } };
    const l = cardLines({ name: 'Flavius', verified: true, character: 'Ranger', favClass: 'medic', career, where: 'account' }, { kills: 4, deaths: 2, shots: 10, hits: 3 }, true);
    expect(l.sub).toMatch(/^Ranger · ★ \S/);
    expect(l.match).toBe('This match: 4 K · 2 D · 30% accuracy');
    expect(l.career).toMatch(/^Career: 3 matches · 1 win \(33%\) · K\/D 1\.50 · 25% accuracy · \S/);
    expect(cardLines({ name: 'G', verified: false, character: 'Ranger', favClass: null, career: emptyCareer(), where: 'browser' }, null, false)).toMatchObject({ sub: 'Ranger', match: '', career: 'Career: your first match' });
  });
});
