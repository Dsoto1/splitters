/**
 * Another player's card (docs/PLAYER_PROFILES_PLAN.md, Phase 2): click a row on the pause menu's Match tab or the
 * end-of-match board and that player's card opens beside it. What the match knows of everyone (their name, ✓ or
 * GUEST or BOT, character, emblem, title, class and this match's kills and deaths); for a signed-in player also their
 * career headline from the hub (GET /api/v1/profile/card, by the username their account ticket proved). A guest's
 * career stays in their own browser, so their card is the match's only; so is anyone's when the hub can't be reached
 * or doesn't have cards yet (an older hub).
 */
import { careerAccuracy, careerKd, careerWinRate, favouriteWeapon, titleName, vouchedLine, type Career, type PublicCard } from '@tiletrigger/shared';
import { emblemSvg } from './emblemSvg.ts';
import { className, weaponName } from './profileCard.ts';

/** Who the card is for, as the match knows them. */
export interface PlayerCardSubject {
  slot: number;
  /** Their name as shown (with a rank, when Ranks & badges is on). */
  name: string;
  /** The account's username (the roster's name of a ✓ player), for the hub's card; null for guests and bots. */
  username: string | null;
  kind: 'acct' | 'guest' | 'bot' | 'you';
  character: string;
  emblem: string | null;
  title: string | null;
  /** Their class this match (Classes), else ''. */
  cls: string;
  kills: number;
  deaths: number;
  /** Your own card: your career as your browser has it. */
  career?: Career;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v)}%`);

/** A career's headline line (the card's last line). */
export function careerHeadline(c: Career): string {
  if (!c.matches) return 'Career: no matches yet';
  return `Career: ${c.matches} ${c.matches === 1 ? 'match' : 'matches'} · ${c.wins} ${c.wins === 1 ? 'win' : 'wins'} (${pct(careerWinRate(c))}) · K/D ${careerKd(c).toFixed(2)} · ${pct(careerAccuracy(c))} accuracy · ${weaponName(favouriteWeapon(c))}`;
}

/** The card's text lines (tests read them; the DOM is built from them). `hub`: the hub's card, null when none, undefined while it loads. */
export function playerCardLines(p: PlayerCardSubject, hub: PublicCard | null | undefined): { tag: string; sub: string; match: string; career: string; vouched: string } {
  const title = titleName(hub?.title ?? p.title);
  const fav = hub?.favClass ? className(hub.favClass) : '';
  const tag = p.kind === 'acct' || (p.kind === 'you' && p.username) ? '✓' : p.kind === 'bot' ? 'BOT' : p.kind === 'you' ? 'YOU' : 'GUEST';
  const career =
    p.kind === 'bot'
      ? 'A bot: no career'
      : p.career
        ? careerHeadline(p.career)
        : p.kind === 'guest'
          ? 'A guest: their career stays in their own browser'
          : hub === undefined
            ? 'Career: loading…'
            : hub
              ? careerHeadline(hub.career)
              : 'Career: not available right now';
  return {
    tag,
    sub: [title, p.character, p.cls ? p.cls : fav ? `★ ${fav}` : ''].filter(Boolean).join(' · '),
    match: `This match: ${p.kills} K · ${p.deaths} D`,
    career,
    // Phase 4: what other people's hosts counted for them.
    vouched: hub && p.kind === 'acct' ? vouchedLine(hub.vouched) : '',
  };
}

export class PlayerCardView {
  readonly el: HTMLElement;
  private readonly img: HTMLImageElement;
  private readonly text: HTMLElement;
  private subject: PlayerCardSubject | null = null;
  private hub: PublicCard | null | undefined = undefined;
  /** Bumped at each show: a late portrait or hub card for an earlier one is dropped. */
  private shown = 0;
  private readonly outside = (e: PointerEvent) => {
    if (this.el.hidden || this.el.contains(e.target as Node)) return;
    if ((e.target as HTMLElement | null)?.closest?.('.sb-click')) return;
    this.close();
  };

  constructor(
    private readonly portraitOf: ((look: string) => Promise<string>) | undefined,
    private readonly loadCard: (username: string) => Promise<PublicCard | null>,
  ) {
    this.el = document.createElement('div');
    this.el.id = 'player-card';
    this.el.className = 'player-card panel';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.img = document.createElement('img');
    this.img.alt = '';
    this.text = document.createElement('div');
    this.text.className = 'plc-text';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'plc-close';
    close.textContent = '×';
    close.title = 'Close';
    close.addEventListener('click', () => this.close());
    this.el.append(this.img, this.text, close);
    document.body.append(this.el);
    document.addEventListener('pointerdown', this.outside, true);
  }

  get open(): boolean {
    return !this.el.hidden;
  }
  get slot(): number | null {
    return this.open ? (this.subject?.slot ?? null) : null;
  }

  /** Open the card for `p` beside `row` (a scoreboard row); the same player again closes it. */
  show(p: PlayerCardSubject, look: string, row: HTMLElement | null): void {
    if (this.open && this.subject?.slot === p.slot && this.subject.name === p.name) return this.close();
    this.subject = p;
    const shown = ++this.shown;
    this.hub = p.kind === 'acct' && p.username ? undefined : null;
    this.img.hidden = true;
    this.img.removeAttribute('src');
    void this.portraitOf?.(look).then(
      (src) => {
        if (this.shown !== shown) return;
        this.img.src = src;
        this.img.hidden = false;
      },
      () => undefined,
    );
    if (p.kind === 'acct' && p.username) {
      void this.loadCard(p.username).catch(() => null).then((card) => {
        if (this.shown !== shown || !this.subject) return;
        this.hub = card && card.username.toLowerCase() === p.username!.toLowerCase() ? card : null;
        this.draw();
      });
    }
    this.draw();
    this.el.hidden = false;
    this.place(row);
  }

  /** The match moved on (scores changed): the open card's kills and deaths. */
  refresh(p: PlayerCardSubject): void {
    if (!this.open || this.subject?.slot !== p.slot) return;
    this.subject = { ...p };
    this.draw();
  }

  close(): void {
    this.el.hidden = true;
    this.subject = null;
    this.shown++;
  }

  dispose(): void {
    document.removeEventListener('pointerdown', this.outside, true);
    this.el.remove();
  }

  private draw(): void {
    const p = this.subject;
    if (!p) return;
    const l = playerCardLines(p, this.hub);
    const tagCls = l.tag === '✓' ? 'acct in' : l.tag === 'GUEST' ? 'acct guest' : 'acct pick';
    this.el.dataset.kind = p.kind;
    this.text.innerHTML = `<div class="plc-who">${emblemSvg(this.hub?.emblem ?? p.emblem)}<b>${escapeHtml(p.name)}</b><i class="${tagCls}">${l.tag}</i></div>${l.sub ? `<div class="plc-sub">${escapeHtml(l.sub)}</div>` : ''}<div class="plc-match">${escapeHtml(l.match)}</div><div class="plc-career">${escapeHtml(l.career)}</div>${l.vouched ? `<div class="plc-vouched">${escapeHtml(l.vouched)}</div>` : ''}`;
  }

  /** Beside the row (right of it, else left), kept on screen. */
  private place(row: HTMLElement | null): void {
    const r = row?.getBoundingClientRect();
    const w = this.el.offsetWidth || 320;
    const h = this.el.offsetHeight || 120;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = r ? (r.right + 8 + w <= vw ? r.right + 8 : Math.max(8, r.left - 8 - w)) : (vw - w) / 2;
    if (r && x + w > vw - 8) x = Math.max(8, vw - 8 - w);
    let y = r ? r.top - 8 : (vh - h) / 2;
    y = Math.max(8, Math.min(vh - h - 8, y));
    // Over the row's own board when there's no room beside it (a phone): just under the row.
    if (r && x < r.right && x + w > r.left) y = Math.min(vh - h - 8, r.bottom + 6);
    this.el.style.left = `${Math.round(x)}px`;
    this.el.style.top = `${Math.round(y)}px`;
  }
}
