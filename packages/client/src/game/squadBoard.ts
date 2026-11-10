import { readSquad, type MatchAward, type SquadView } from '@tiletrigger/shared';
import type { BoardRow, BoardSquad } from './scoreBoard.ts';

/**
 * Fireteams Part 3 (docs/FIRETEAMS_PLAN.md): the scoreboard's squads. A team's rows grouped by squad (the snapshot's
 * `fs`), the squads best first (points, then id), each squad's rows by points, then kills; the squad's name is its
 * leader's. At the end of the match the squad awards (sim/squadScores.ts) name each squad's MVP and the Best Squad.
 */

/** The squad awards as the board reads them: each squad's MVP (slot, points) and the Best Squad's id. */
export interface SquadHonours {
  mvp: Map<number, { slot: number; points: number }>;
  best: number | null;
}

export function squadHonours(aw: readonly MatchAward[]): SquadHonours {
  const out: SquadHonours = { mvp: new Map(), best: null };
  for (const a of aw) {
    if (a[0] === 'squadmvp') out.mvp.set(a[3], { slot: a[1], points: a[2] });
    else if (a[0] === 'bestsquad') out.best = a[3];
  }
  return out;
}

export function readSquads(fs: readonly (readonly number[])[] | null): SquadView[] {
  return fs ? fs.map(readSquad) : [];
}

/**
 * One team's squads for the board (`team`: the team's index), from its rows (`rows`: every row of the team). Rows of
 * the team in no squad (a moment as someone joins) come last, under "Joining". `name(slot)` names the leader.
 */
export function squadGroups(rows: readonly BoardRow[], squads: readonly SquadView[], team: number, me: number, honours: SquadHonours, name: (slot: number) => string): BoardSquad[] {
  const bySlot = new Map(rows.map((r) => [r.slot, r]));
  const used = new Set<number>();
  const pts = (r: BoardRow) => Number(r.pts) || 0;
  const order = (a: BoardRow, b: BoardRow) => pts(b) - pts(a) || b.k - a.k || a.d - b.d || a.slot - b.slot;
  const out: BoardSquad[] = [];
  for (const q of [...squads].filter((s) => s.team === team).sort((a, b) => b.points - a.points || a.id - b.id)) {
    const list = q.members.map((m) => bySlot.get(m)).filter((r): r is BoardRow => !!r && !used.has(r.slot));
    if (!list.length) continue;
    for (const r of list) used.add(r.slot);
    const lead = q.leader >= 0 ? q.leader : null;
    const mvp = honours.mvp.get(q.id);
    out.push({
      id: q.id,
      name: lead !== null ? `${name(lead)}'s squad` : 'Squad',
      points: q.points,
      mvp: mvp ? `${name(mvp.slot)} · ${mvp.points}` : '',
      best: honours.best === q.id,
      mine: q.members.includes(me),
      rows: list.map((r) => (r.slot === lead ? { ...r, squadLead: true } : r)).sort(order),
    });
  }
  const loose = rows.filter((r) => !used.has(r.slot));
  if (loose.length) out.push({ id: -1, name: 'Joining', points: 0, mvp: '', best: false, mine: loose.some((r) => r.slot === me), rows: [...loose].sort(order) });
  return out;
}
