import { describe, expect, it } from 'vitest';
import { boardLayout, ffaColumns, tallTeam, type BoardGroup } from '../src/game/scoreBoard.ts';

const group = (id: string, n: number): BoardGroup => ({
  id,
  name: id,
  color: '#ffffff',
  score: 0,
  lead: false,
  rows: Array.from({ length: n }, (_, i) => ({ slot: i, name: `p${i}`, bot: true, color: '#fff', cls: '', k: 0, d: 0, obj: '', ping: '', leader: false, dead: false, me: false })),
});
const teams = (...sizes: number[]) => ({ kind: 'teams' as const, groups: sizes.map((n, i) => group(`t${i}`, n)) });

describe('scoreboard layout', () => {
  it('puts two teams side by side, 3–4 teams in a 2 × 2 grid', () => {
    expect(boardLayout(teams(8, 8), 1240)).toMatchObject({ name: 't2', cols: 2, dense: false });
    expect(boardLayout(teams(4, 4, 4), 1240)).toMatchObject({ name: 't4', cols: 2 });
    expect(boardLayout(teams(4, 4, 4, 4), 600)).toMatchObject({ name: 't4', cols: 2 });
  });

  it('fits 5–8 teams in up to four columns, fewer when narrow', () => {
    expect(boardLayout(teams(2, 2, 2, 2, 2, 2, 12), 1240)).toMatchObject({ name: 'tn', cols: 4, dense: true });
    expect(boardLayout(teams(2, 2, 2, 2, 2, 2, 12), 590)).toMatchObject({ name: 'tn', cols: 3 });
    expect(boardLayout(teams(2, 2, 2, 2, 2, 2, 12), 400)).toMatchObject({ name: 'tn', cols: 2 });
    expect(boardLayout(teams(2, 2, 2, 2, 2), 1240).cols).toBe(4);
  });

  it('gives one team that dwarfs the rest its own full-height column', () => {
    expect(boardLayout(teams(2, 2, 2, 2, 2, 2, 12), 1240).tall).toBe(6);
    expect(tallTeam(teams(12, 2, 2).groups)).toBe(0);
    expect(tallTeam(teams(4, 4, 4, 4).groups)).toBe(-1);
    expect(tallTeam(teams(8, 6, 2).groups)).toBe(-1);
    expect(tallTeam(teams(5, 1, 1).groups)).toBe(-1);
    expect(boardLayout(teams(24, 2), 1240).tall).toBe(-1);
  });

  it('goes dense for big teams (48v48)', () => {
    expect(boardLayout(teams(48, 48), 1240)).toMatchObject({ name: 't2', cols: 2, dense: true });
  });

  it('splits a long free-for-all into columns that fit, co-op stays one list', () => {
    const ffa = (n: number) => ({ kind: 'ffa' as const, groups: [group('all', n)] });
    expect(boardLayout(ffa(8), 1240).cols).toBe(1);
    expect(boardLayout(ffa(16), 1240).cols).toBe(2);
    expect(boardLayout(ffa(16), 600).cols).toBe(2);
    expect(boardLayout(ffa(48), 1240).cols).toBe(3);
    expect(boardLayout(ffa(48), 600).cols).toBe(2);
    expect(boardLayout({ kind: 'coop', groups: [group('all', 30)] }, 1240)).toMatchObject({ name: 'coop', cols: 1 });
  });

  it('ranks free-for-all column-major', () => {
    const cols = ffaColumns([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 2);
    expect(cols).toEqual([
      [1, 2, 3, 4, 5, 6, 7, 8],
      [9, 10, 11, 12, 13, 14, 15, 16],
    ]);
    expect(ffaColumns([1, 2, 3, 4, 5], 3)).toEqual([[1, 2], [3, 4], [5]]);
    expect(ffaColumns([], 2)).toEqual([[]]);
  });
});
