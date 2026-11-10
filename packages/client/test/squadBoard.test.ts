import { describe, expect, it } from 'vitest';
import { Fireteams, squadSnapshot, type MatchAward } from '@tiletrigger/shared';
import { readSquads, squadGroups, squadHonours } from '../src/game/squadBoard.ts';
import type { BoardRow } from '../src/game/scoreBoard.ts';

/** The scoreboard's squads (Fireteams Part 3; no DOM here: the board itself is the e2e flow `fireteams`'). */
describe('Fireteams scoreboard squads (Part 3)', () => {
  const ft = new Fireteams(4);
  const at = (slot: number, team = 'a') => ({ slot, team, human: slot === 0, lead: slot, pos: { x: slot, y: 0, z: 0 } });
  ft.sync([...[0, 1, 2, 3, 4, 5, 6, 7].map((s) => at(s)), ...[10, 11, 12, 13].map((s) => at(s, 'b'))], 0);
  const mine = ft.squadOf(0)!;
  const other = ft.squads.find((s) => s.team === 'a' && s !== mine)!;
  const row = (slot: number, k: number, pts: number): BoardRow => ({ slot, name: `P${slot}`, bot: slot !== 0, color: '#fff', cls: '', k, d: 0, obj: '', ping: '', pts: String(pts), leader: false, dead: false, me: slot === 0 });
  const names = (slot: number) => `P${slot}`;

  it('a team grouped by squad, yours first, then the best; each squad by points; the leader marked; your squad marked', () => {
    const fs = ft.squads.map((s) => squadSnapshot(s, s.team === 'a' ? 0 : 1, s === other ? 40 : s === mine ? 25 : 0));
    const rows = [0, 1, 2, 3, 4, 5, 6, 7].map((s) => row(s, s, s * 5));
    const groups = squadGroups(rows, readSquads(fs), 0, 0, squadHonours([]), names);
    expect(groups.map((g) => g.id)).toEqual([mine.id, other.id]);
    expect(groups.map((g) => g.points)).toEqual([25, 40]);
    expect(groups[0]).toMatchObject({ name: 'P0', mine: true, mvp: '', best: false });
    expect(groups[1]!.mine).toBe(false);
    // Watching from the other team (or as a spectator): best first.
    expect(squadGroups(rows, readSquads(fs), 0, 99, squadHonours([]), names).map((g) => g.id)).toEqual([other.id, mine.id]);
    // Rows by points, the leader marked.
    const m = groups[0]!.rows;
    expect(m.map((r) => r.slot)).toEqual([...mine.members].sort((a, b) => b - a));
    expect(m.find((r) => r.slot === 0)?.squadLead).toBe(true);
    expect(groups.flatMap((g) => g.rows).map((r) => r.slot).sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('the end of the match: each squad’s MVP on its line, the Best Squad marked', () => {
    const fs = ft.squads.map((s) => squadSnapshot(s, s.team === 'a' ? 0 : 1, 10));
    const aw: MatchAward[] = [['streak', 3, 4], ['bestsquad', 0, 30, mine.id], ['squadmvp', 0, 20, mine.id], ['squadmvp', other.members[1]!, 10, other.id]];
    const groups = squadGroups([0, 1, 2, 3, 4, 5, 6, 7].map((s) => row(s, 1, 1)), readSquads(fs), 0, 0, squadHonours(aw), names);
    const g = new Map(groups.map((x) => [x.id, x]));
    expect(g.get(mine.id)).toMatchObject({ mvp: 'P0', best: true });
    expect(g.get(other.id)).toMatchObject({ mvp: `P${other.members[1]}`, best: false });
  });

  it('a row in no squad yet (someone joining) comes last under "Joining"; the other team’s squads are left out', () => {
    const fs = ft.squads.map((s) => squadSnapshot(s, s.team === 'a' ? 0 : 1));
    const groups = squadGroups([...[0, 1, 2, 3, 4, 5, 6, 7].map((s) => row(s, 0, 0)), row(9, 0, 0)], readSquads(fs), 0, 0, squadHonours([]), names);
    expect(groups.at(-1)).toMatchObject({ id: -1, name: 'Joining' });
    expect(groups.at(-1)!.rows.map((r) => r.slot)).toEqual([9]);
    expect(groups.some((x) => x.rows.some((r) => r.slot >= 10))).toBe(false);
    expect(readSquads(null)).toEqual([]);
  });
});
