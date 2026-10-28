/**
 * The scoreboard (Tab, the end of a round, and the pause menu's Match tab):
 * one component that lays the match out to fit its team setup and patches
 * its DOM in place, so it stays cheap at 96 players.
 *
 * Layouts (see `boardLayout`):
 * - two teams side by side, one column each;
 * - three or four teams in a 2 × 2 grid;
 * - five to eight teams in columns that fit the width (up to four across);
 * - free-for-all as one ranked list that splits column-major (1–8 down the
 *   first column, 9–16 down the next) into two or three columns when long;
 * - co-op as one list.
 * Each team's list scrolls inside its column; the local player's row is
 * sticky, so it stays in view (pinned to the list's bottom or top edge).
 */

/** One player's line. Strings are shown as they are (already formatted). */
export interface BoardRow {
  slot: number;
  name: string;
  bot: boolean;
  /** A person: a verified account (signed in, playing under their username), or a guest (shown only when others are playing). */
  who?: 'acct' | 'guest';
  /** Team colour (or the player's own colour in free-for-all). */
  color: string;
  /** Class name (Classes), else ''. */
  cls: string;
  k: number;
  d: number;
  /** The mode's objective stat for this player ('' when the mode has none). */
  obj: string;
  /** Round trip ('' offline or for bots). */
  ping: string;
  leader: boolean;
  dead: boolean;
  me: boolean;
}

export interface BoardGroup {
  id: string;
  name: string;
  color: string;
  /** The team's score in the mode's terms (captures, rounds, kills). */
  score: number;
  /** Top score among the teams (ties included). */
  lead: boolean;
  rows: BoardRow[];
}

export interface BoardData {
  /** Map · mode · time line. */
  head: string;
  kind: 'ffa' | 'teams' | 'coop';
  /** Teams (kind 'teams'), or a single group with every player, in display order. */
  groups: BoardGroup[];
  /** Columns shown besides name, K and D. */
  cls: boolean;
  obj: string | null;
  ping: boolean;
}

export interface BoardLayout {
  /** Root class: sb-t2 (two teams), sb-t4 (3–4), sb-tn (5–8), sb-ffa, sb-coop. */
  name: 't2' | 't4' | 'tn' | 'ffa' | 'coop';
  /** Columns across. */
  cols: number;
  /** Small rows (many players, or little room). */
  dense: boolean;
  /**
   * Three or more teams where one dwarfs the rest (2v2v2v2v2v2v12): that
   * team's index, given the last column at full height while the small teams
   * fill the others; else -1.
   */
  tall: number;
}

/** About how wide one team or list column needs to be (px) to read well. */
export const BOARD_COL_MIN = 230;

/** How the board lays out for this data at this width (px available). */
export function boardLayout(data: Pick<BoardData, 'kind' | 'groups'>, width: number): BoardLayout {
  const players = data.groups.reduce((n, g) => n + g.rows.length, 0);
  const fit = Math.max(1, Math.floor(width / BOARD_COL_MIN));
  const dense = players > 24 || data.groups.some((g) => g.rows.length > 12);
  if (data.kind === 'coop') return { name: 'coop', cols: 1, dense: players > 16, tall: -1 };
  if (data.kind === 'ffa') {
    const want = players <= 12 ? 1 : players <= 36 ? 2 : 3;
    const cols = Math.max(1, Math.min(want, fit));
    return { name: 'ffa', cols, dense: Math.ceil(players / cols) > 12, tall: -1 };
  }
  const n = data.groups.length;
  if (n <= 2) return { name: 't2', cols: 2, dense, tall: -1 };
  const tall = tallTeam(data.groups);
  if (n <= 4) return { name: 't4', cols: 2, dense: dense || n > 2, tall };
  return { name: 'tn', cols: Math.max(2, Math.min(4, n, Math.floor(width / 190))), dense: true, tall };
}

/** The one team much bigger than every other (over 6 players and at least twice the next), or -1. */
export function tallTeam(groups: readonly Pick<BoardGroup, 'rows'>[]): number {
  if (groups.length < 3) return -1;
  let big = -1;
  let next = 0;
  groups.forEach((g, i) => {
    const n = g.rows.length;
    if (big < 0 || n > groups[big]!.rows.length) {
      if (big >= 0) next = Math.max(next, groups[big]!.rows.length);
      big = i;
    } else next = Math.max(next, n);
  });
  const size = groups[big]!.rows.length;
  return size > 6 && size >= next * 2 ? big : -1;
}

/** Free-for-all: split the ranked rows column-major into `cols` columns. */
export function ffaColumns<T>(rows: readonly T[], cols: number): T[][] {
  const per = Math.max(1, Math.ceil(rows.length / cols));
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += per) out.push(rows.slice(i, i + per));
  return out.length ? out : [[]];
}

const make = (tag: string, cls: string, text = ''): HTMLElement => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
};

interface RowEls {
  el: HTMLElement;
  rank: HTMLElement;
  mark: HTMLElement;
  name: HTMLElement;
  cls: HTMLElement;
  k: HTMLElement;
  d: HTMLElement;
  obj: HTMLElement;
  ping: HTMLElement;
  key: string;
}

interface GroupEls {
  el: HTMLElement;
  name: HTMLElement | null;
  score: HTMLElement | null;
  list: HTMLElement;
  hd: HTMLElement;
}

export class ScoreBoard {
  private head: HTMLElement | null = null;
  private body: HTMLElement | null = null;
  private groups: GroupEls[] = [];
  private rows = new Map<number, RowEls>();
  private shape = '';
  /** Which optional cells the rows have (set with the layout). */
  private cells = { rank: false, cls: false, obj: false, ping: false };

  /**
   * `maxWidth`: the most room the board may take (px); it uses less when the
   * window is narrower. `sizeSelf`: set its own width from the layout (the HUD
   * overlay), else fill the container (pause menu).
   */
  constructor(
    readonly root: HTMLElement,
    private readonly opts: { maxWidth: number; sizeSelf: boolean },
  ) {}

  /** Forget the DOM (the container was emptied, or a new match starts). */
  clear(): void {
    this.root.replaceChildren();
    this.head = this.body = null;
    this.groups = [];
    this.rows.clear();
    this.shape = '';
  }

  render(data: BoardData): void {
    const width = Math.min(this.opts.maxWidth, (window.innerWidth || this.opts.maxWidth) * 0.96 - 24);
    const layout = boardLayout(data, width);
    const columns = data.kind === 'ffa' ? ffaColumns(data.groups[0]?.rows ?? [], layout.cols) : data.groups.map((g) => g.rows);
    const flags = `${data.cls ? 1 : 0}${data.obj ?? '-'}${data.ping ? 1 : 0}`;
    const shape = `${layout.name}|${layout.cols}|${layout.dense}|${layout.tall}|${flags}|${data.kind === 'ffa' ? columns.length : data.groups.map((g) => g.id).join(',')}`;
    if (shape !== this.shape || !this.body || this.body.parentNode !== this.root) this.build(data, layout, columns.length, shape);
    if (this.head!.textContent !== data.head) this.head!.textContent = data.head;
    // Teams: name and score.
    if (data.kind === 'teams') {
      data.groups.forEach((g, i) => {
        const ge = this.groups[i]!;
        if (ge.name!.textContent !== g.name) ge.name!.textContent = g.name;
        const score = String(g.score);
        if (ge.score!.textContent !== score) ge.score!.textContent = score;
        ge.score!.classList.toggle('lead', g.lead && data.groups.length > 1);
      });
    }
    // Rows: patch each, then put each list in order.
    const seen = new Set<number>();
    let rank = 0;
    columns.forEach((rows, i) => {
      const ge = this.groups[i]!;
      const want: HTMLElement[] = [ge.hd];
      for (const r of rows) {
        rank++;
        seen.add(r.slot);
        want.push(this.row(r, data.kind === 'ffa' ? rank : 0).el);
      }
      const have = ge.list.children;
      let same = have.length === want.length;
      for (let j = 0; same && j < want.length; j++) same = have[j] === want[j];
      if (!same) ge.list.replaceChildren(...want);
    });
    for (const [slot, r] of this.rows) {
      if (seen.has(slot)) continue;
      r.el.remove();
      this.rows.delete(slot);
    }
  }

  private build(data: BoardData, layout: BoardLayout, count: number, shape: string): void {
    this.root.replaceChildren();
    this.rows.clear();
    this.shape = shape;
    this.cells = { rank: data.kind === 'ffa', cls: data.cls, obj: !!data.obj, ping: data.ping };
    this.root.classList.remove('sb-t2', 'sb-t4', 'sb-tn', 'sb-ffa', 'sb-coop', 'sb-dense');
    this.root.classList.add('sb', `sb-${layout.name}`);
    this.root.classList.toggle('sb-dense', layout.dense);
    this.root.style.setProperty('--sb-cols', String(layout.cols));
    // Cell widths: rank, mark + name, class, K, D, objective, ping.
    const tpl = [data.kind === 'ffa' ? '2.1em' : '', 'minmax(0, 1fr)', data.cls ? 'minmax(0, 5.6em)' : '', '2.3em', '2.3em', data.obj ? '3.1em' : '', data.ping ? '2.9em' : ''].filter(Boolean).join(' ');
    this.root.style.setProperty('--sb-tpl', tpl);
    if (this.opts.sizeSelf) this.root.style.width = `min(${Math.round(layout.cols * (layout.name === 'tn' ? 270 : 330) + 32)}px, 96vw)`;
    this.head = make('div', 'sb-head');
    this.body = make('div', 'sb-body');
    this.groups = [];
    for (let i = 0; i < count; i++) {
      const g = data.kind === 'teams' ? data.groups[i]! : null;
      const el = make('section', g ? 'sb-group' : 'sb-group sb-col');
      el.dataset.group = g?.id ?? `col${i}`;
      let name: HTMLElement | null = null;
      let score: HTMLElement | null = null;
      if (g && i === layout.tall) {
        // The big team: the last column, as tall as the small teams' rows.
        el.style.gridColumn = String(layout.cols);
        el.style.gridRow = `1 / span ${Math.max(1, Math.ceil((count - 1) / (layout.cols - 1)))}`;
      }
      if (g) {
        el.style.setProperty('--team', g.color);
        const top = make('header', 'sb-ghead');
        name = make('span', 'sb-gname');
        score = make('b', 'sb-gscore');
        top.append(name, score);
        el.append(top);
      }
      const list = make('div', 'sb-list');
      const hd = make('div', 'sb-row sb-hd');
      const th = (cls: string, text: string, title = '') => {
        const c = make('span', cls, text);
        if (title) c.title = title;
        hd.append(c);
      };
      if (data.kind === 'ffa') th('sb-rank', '#', 'Rank');
      th('sb-name', data.kind === 'teams' ? 'Player' : data.kind === 'coop' ? 'Squad' : 'Player');
      if (data.cls) th('sb-cls', 'Class');
      th('sb-n', 'K', 'Kills');
      th('sb-n', 'D', 'Deaths');
      if (data.obj) th('sb-n', data.obj);
      if (data.ping) th('sb-n', 'Ping', 'Round trip (ms)');
      list.append(hd);
      el.append(list);
      this.body.append(el);
      this.groups.push({ el, name, score, list, hd });
    }
    this.root.append(this.head, this.body);
  }

  /** The row for a player, patched to `r` (only the cells that changed). */
  private row(r: BoardRow, rank: number): RowEls {
    let e = this.rows.get(r.slot);
    if (!e) {
      const el = make('div', 'sb-row');
      el.dataset.slot = String(r.slot);
      const rk = make('span', 'sb-rank');
      const nameCell = make('span', 'sb-name');
      const mark = make('i', 'sb-mark');
      const name = make('span', 'sb-nm');
      nameCell.append(mark, name);
      e = { el, rank: rk, mark, name, cls: make('span', 'sb-cls'), k: make('span', 'sb-n'), d: make('span', 'sb-n'), obj: make('span', 'sb-n'), ping: make('span', 'sb-n sb-ping'), key: '' };
      // Same cells as the header row.
      const f = this.cells;
      if (f.rank) el.append(rk);
      el.append(nameCell);
      if (f.cls) el.append(e.cls);
      el.append(e.k, e.d);
      if (f.obj) el.append(e.obj);
      if (f.ping) el.append(e.ping);
      this.rows.set(r.slot, e);
    }
    const key = `${rank}|${r.name}|${r.bot}|${r.who ?? ''}|${r.color}|${r.cls}|${r.k}|${r.d}|${r.obj}|${r.ping}|${r.leader}|${r.dead}|${r.me}`;
    if (key === e.key) return e;
    e.key = key;
    const set = (el: HTMLElement, text: string) => {
      if (el.textContent !== text) el.textContent = text;
    };
    set(e.rank, rank ? String(rank) : '');
    set(e.name, r.name);
    e.name.classList.toggle('bot', r.bot);
    e.name.classList.toggle('acct', r.who === 'acct');
    e.name.classList.toggle('guest', r.who === 'guest');
    e.name.title = r.who === 'acct' ? 'Signed in: a verified account' : r.who === 'guest' ? 'Guest: not signed in, so the name is just what they typed' : '';
    set(e.mark, r.leader ? '★' : '●');
    e.mark.style.color = r.leader ? '' : r.color;
    e.mark.classList.toggle('leader', r.leader);
    e.mark.title = r.leader ? 'Team leader' : '';
    set(e.cls, r.cls);
    set(e.k, String(r.k));
    set(e.d, String(r.d));
    set(e.obj, r.obj);
    set(e.ping, r.ping);
    e.el.classList.toggle('me', r.me);
    e.el.classList.toggle('dead', r.dead);
    return e;
  }
}
