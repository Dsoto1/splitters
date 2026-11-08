import { MODE_LABELS, VOTE_RESULT_SECONDS, type VoteState } from '@tiletrigger/shared';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Between matches: the vote on the next map, under the end-of-match scoreboard (sim/mapVote.ts). Two or three map
 * cards (picture, name, mode, votes), the seconds left, your vote lit. Keys 1-3 (or a click, or a tap) vote; you
 * can change your mind until it closes. Then the winner, and "Loading in 3 s". Nothing flashes: the cards light up.
 */
export class MapVoteHud {
  readonly panel: HTMLElement;
  private state: VoteState | null = null;
  /** Your vote, as you cast it (the host's count follows a moment later). */
  private mine: number | null = null;
  private readonly onKey = (e: KeyboardEvent) => {
    if (!this.open || this.state?.w !== undefined || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = /^(?:Digit|Numpad)([1-4])$/.exec(e.code)?.[1];
    if (!n) return;
    const i = Number(n) - 1;
    if (i >= (this.state?.o.length ?? 0)) return;
    // The number keys pick weapons in play: during the vote they vote (and nothing else).
    e.preventDefault();
    e.stopImmediatePropagation();
    this.cast(i);
  };

  constructor(
    private readonly vote: (i: number) => void,
    /** A map's picture (its own, else the shipped one), by suite ID; null: none. */
    private readonly picture: (id: string) => string | null = () => null,
  ) {
    const host = document.getElementById('hud') ?? document.body;
    this.panel = document.createElement('div');
    this.panel.id = 'map-vote';
    this.panel.hidden = true;
    this.panel.setAttribute('role', 'group');
    this.panel.setAttribute('aria-label', 'Vote for the next map');
    host.append(this.panel);
    // Capture: ahead of the game's own number keys (weapon slots).
    window.addEventListener('keydown', this.onKey, { capture: true });
    this.panel.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-i]');
      if (b && !b.disabled) this.cast(Number(b.dataset.i));
    });
  }

  get open(): boolean {
    return !!this.state && !this.panel.hidden;
  }

  /** The vote as the host sends it (null: over). */
  update(v: VoteState | null): void {
    const fresh = !!v && (!this.state || this.state.o.map((o) => o.map).join() !== v.o.map((o) => o.map).join());
    if (fresh || !v) this.mine = null;
    this.state = v;
    this.render();
  }

  /** The leading map now (the winner once closed), for the scoreboard's "Next map" line. */
  leader(): { map: string; mode: VoteState['o'][number]['mode'] } | null {
    const s = this.state;
    if (!s) return null;
    const i = s.w ?? s.n.reduce((best, n, k) => (n > (s.n[best] ?? 0) ? k : best), 0);
    const o = s.o[i];
    return o ? { map: o.name, mode: o.mode } : null;
  }

  private cast(i: number): void {
    if (!this.state || this.state.w !== undefined) return;
    this.mine = i;
    this.vote(i);
    this.render();
  }

  private render(): void {
    const s = this.state;
    this.panel.hidden = !s;
    document.getElementById('hud')?.classList.toggle('vote-on', !!s);
    if (!s) return void this.panel.replaceChildren();
    const done = s.w !== undefined;
    const total = s.n.reduce((a, b) => a + b, 0);
    const head = done
      ? `<h3>Next map: <b>${escapeHtml(s.o[s.w!]?.name ?? '')}</b></h3><span class="mv-left">${s.by === 'host' ? 'Tie: the host decided · ' : s.by === 'order' ? 'Tie · ' : s.by === 'none' ? 'No votes · ' : ''}Loading in ${VOTE_RESULT_SECONDS} s</span>`
      : `<h3>Vote for the next map</h3><span class="mv-left" aria-live="polite">${s.left} s</span>`;
    const cards = s.o
      .map((o, i) => {
        const pic = this.picture(o.map);
        const cls = ['mv-card', this.mine === i ? 'mine' : '', done && s.w === i ? 'won' : '', done && s.w !== i ? 'lost' : ''].filter(Boolean).join(' ');
        const share = total ? Math.round(((s.n[i] ?? 0) / total) * 100) : 0;
        return `<button type="button" class="${cls}" data-i="${i}" data-map="${escapeHtml(o.map)}"${done ? ' disabled' : ''} aria-pressed="${this.mine === i}">`
          + `<span class="mv-pic"${pic ? ` style="background-image:url('${encodeURI(pic)}')"` : ''}><kbd>${i + 1}</kbd></span>`
          + `<span class="mv-name">${escapeHtml(o.name)}</span><span class="mv-mode">${escapeHtml(MODE_LABELS[o.mode] ?? o.mode)}</span>`
          + `<span class="mv-votes"><i style="width:${share}%"></i><b>${s.n[i] ?? 0}</b> vote${s.n[i] === 1 ? '' : 's'}</span>`
          + `</button>`;
      })
      .join('');
    const hint = done ? '' : `<p class="mv-hint">${this.mine === null ? 'Press 1-' + s.o.length + ', click or tap a map' : 'Voted: change it any time until the vote closes'}</p>`;
    this.panel.innerHTML = `<div class="mv-head">${head}</div><div class="mv-cards">${cards}</div>${hint}`;
    this.panel.classList.toggle('closed', done);
    this.layout();
  }

  /** The scoreboard and the awards make room above the cards (style.css `vote-on`). */
  private layout(): void {
    const hud = document.getElementById('hud');
    if (!hud) return;
    hud.style.setProperty('--vote-h', `${this.panel.offsetHeight + 16}px`);
    const aw = document.getElementById('match-awards');
    hud.style.setProperty('--awards-h', aw && !aw.hidden && aw.offsetHeight ? `${aw.offsetHeight + 8}px` : '0px');
  }

  /** For tests: what the panel shows. */
  debug(): { open: boolean; maps: string[]; votes: number[]; left: number; mine: number | null; winner: string | null } {
    const s = this.state;
    return { open: this.open, maps: s?.o.map((o) => o.map) ?? [], votes: s?.n ?? [], left: s?.left ?? 0, mine: this.mine, winner: s && s.w !== undefined ? (s.o[s.w]?.map ?? null) : null };
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey, { capture: true });
    document.getElementById('hud')?.classList.remove('vote-on');
    this.panel.remove();
  }
}
