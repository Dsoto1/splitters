import { describe, expect, it } from 'vitest';
import { MATCH_PLAY, MatchAwards, awardText, type GameEvent } from '../src/index.ts';

const A = MATCH_PLAY.awards;
const all = () => true;
const rounds = (w: string) => w !== 'core.launcher';
/** Slots 0-9; 0-4 one team and 5-9 another when `teams`. */
const enemies = (teams: boolean) => (a: number, b: number) => a !== b && (!teams || a < 5 !== b < 5);
const shot = (s: number, hits: (number | null)[], w = 'core.rifle', fl?: number[]): GameEvent => ({ e: 'shot', s, w, from: [0, 0, 0], to: hits.map(() => [0, 0, 1] as [number, number, number]), hit: hits, ...(fl ? { fl } : {}) });

describe('end-of-match awards (sim/awards.ts)', () => {
  it('Most Accurate: hits on enemies over rounds fired, pellets each, in-flight rounds counted at their impact; launchers and teammates left out', () => {
    const aw = new MatchAwards();
    // Slot 1: 30 rounds, 15 on an enemy. Slot 2: 30 rounds, 24 on an enemy but 10 of those on a teammate.
    const ev: GameEvent[] = [];
    for (let i = 0; i < 30; i++) ev.push(shot(1, [i < 15 ? 6 : null]));
    for (let i = 0; i < 30; i++) ev.push(shot(2, [i < 14 ? 7 : i < 24 ? 3 : null]));
    // Slot 3: a shotgun's 10 pellets, 8 on target, one still flying (its impact hits later); and rockets, not counted.
    for (let i = 0; i < 3; i++) ev.push(shot(3, [8, 8, 8, 8, 8, 8, 8, 8, null, null], 'core.shotgun', [0]));
    ev.push({ e: 'impact', s: 3, w: 'core.shotgun', from: [0, 0, 0], to: [0, 0, 1], hit: 8 });
    for (let i = 0; i < 50; i++) ev.push(shot(3, [null], 'core.launcher'));
    aw.events(ev, all, enemies(true), rounds);
    expect(aw.stats(1)).toMatchObject({ shots: 30, hits: 15 });
    expect(aw.stats(2)).toMatchObject({ shots: 30, hits: 14 });
    expect(aw.stats(3)).toMatchObject({ shots: 30, hits: 22 });
    const out = aw.awards([1, 2, 3]);
    expect(out).toContainEqual(['accurate', 3, 73, 30]);
    // Under accuracyMinShots: no award at all.
    const few = new MatchAwards();
    few.events([shot(1, [6]), shot(1, [6])], all, enemies(false), rounds);
    expect(few.awards([1]).some((a) => a[0] === 'accurate')).toBe(false);
    expect(A.accuracyMinShots).toBeGreaterThan(2);
  });

  it('Longest Streak, Nemesis and Most Revenge Kills; ties to the lower slot; nobody below the thresholds', () => {
    const aw = new MatchAwards();
    // 4 kills a life for slot 2 (3 of them slot 5), then down; slot 1 three in a life.
    for (const v of [5, 5, 6, 5]) aw.kill(2, v);
    aw.kill(5, 2);
    for (const v of [6, 7, 8]) aw.kill(1, v);
    // Slot 5 got 2 back on slot 2? No: slot 2's revenge on 5.
    const calls = aw.kill(2, 5);
    expect(calls).toContainEqual({ a: 'revenge', s: 2, t: 5 });
    const out = aw.awards([1, 2, 5, 6, 7, 8]);
    expect(out).toContainEqual(['streak', 2, 4]);
    expect(out).toContainEqual(['nemesis', 2, 4, 5]);
    expect(out).toContainEqual(['revenge', 2, 1]);
    // A tie for the longest streak goes to the lower slot.
    const tie = new MatchAwards();
    for (const v of [5, 6, 7]) tie.kill(3, v);
    for (const v of [5, 6, 7]) tie.kill(1, v);
    expect(tie.awards([1, 3, 5, 6, 7])).toContainEqual(['streak', 1, 3]);
    // Two kills in a life, two of one player: no streak or nemesis award.
    const short = new MatchAwards();
    short.kill(1, 5);
    short.kill(1, 5);
    expect(short.awards([1, 5])).toEqual([]);
    // A player who left isn't given one.
    expect(tie.awards([3, 5, 6, 7]).find((a) => a[0] === 'streak')?.[1]).toBe(3);
  });

  it('callouts: revenge once for each time they downed you; nemesis at the run, which a kill back ends', () => {
    const aw = new MatchAwards();
    expect(aw.kill(1, 2)).toEqual([]);
    expect(aw.kill(2, 1)).toEqual([{ a: 'revenge', s: 2, t: 1 }]);
    // Only once.
    expect(aw.kill(2, 1)).toEqual([]);
    // 2 has now downed 1 twice in a row; the third makes 2 the nemesis.
    expect(aw.kill(2, 1)).toEqual([{ a: 'nemesis', s: 2, t: 1, n: MATCH_PLAY.callouts.nemesis }]);
    expect(aw.kill(2, 1)).toEqual([]);
    // 1 gets one back (revenge), ending the run: two more from 2 make no callout.
    expect(aw.kill(1, 2)).toEqual([{ a: 'revenge', s: 1, t: 2 }]);
    aw.kill(2, 1);
    expect(aw.kill(2, 1).some((c) => c.a === 'nemesis')).toBe(false);
    // A death with no killer just ends the streak.
    aw.kill(null, 2);
  });

  it('every award has a title and a line', () => {
    const name = (s: number) => `P${s}`;
    expect(awardText(['accurate', 1, 61, 40], name)).toEqual({ title: 'Most Accurate', line: 'P1: 61% of 40 rounds on target' });
    expect(awardText(['streak', 2, 7], name).title).toBe('Longest Streak');
    expect(awardText(['nemesis', 2, 5, 4], name).line).toBe('P2: downed P4 5 times');
    expect(awardText(['revenge', 3, 2], name).line).toBe('P3: 2 paybacks');
    expect(awardText(['shapeshifter', 1, 4], name).title).toBe('Shapeshifter');
  });
});
