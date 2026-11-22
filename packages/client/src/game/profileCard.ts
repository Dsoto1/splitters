import { CLASS_DEFS, CORE_WEAPONS, careerAccuracy, careerKd, careerWinRate, favouriteWeapon, titleName, type Career } from '@tiletrigger/shared';
import { emblemSvg } from './emblemSvg.ts';

/** What your profile card shows (docs/PLAYER_PROFILES_PLAN.md, Phase 1): who you are, and your career so far. */
export interface ProfileCardData {
  /** Your name as players see it. */
  name: string;
  /** Signed in with a username (✓), else a guest. */
  verified: boolean;
  /** Your character's name. */
  character: string;
  /** Your favourite class (a ClassId), or null. */
  favClass: string | null;
  career: Career;
  /** Where the career is kept: on your account, or in this browser (a guest). */
  where: 'account' | 'browser';
  /** Your emblem (shared content/emblems.ts) and title (content/titles.ts), or null. */
  emblem?: string | null;
  title?: string | null;
}

/** This match so far (game/careerTally.ts). */
export interface MatchLine {
  kills: number;
  deaths: number;
  shots: number;
  hits: number;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v)}%`);

/** A weapon's name for the card (its id when it isn't one of ours). */
export const weaponName = (id: string | null): string => (id ? (CORE_WEAPONS[id]?.displayName ?? id) : '–');
/** A class's name for the card, or '' for none. */
export const className = (id: string | null): string => (id ? ((CLASS_DEFS as Record<string, { name: string } | undefined>)[id]?.name ?? '') : '');

/** The card's lines as text (the DOM is built from these; tests read them). */
export function cardLines(d: ProfileCardData, m: MatchLine | null, final: boolean): { who: string; sub: string; match: string; career: string } {
  const c = d.career;
  const cls = className(d.favClass);
  const title = titleName(d.title);
  return {
    who: d.name,
    sub: `${title ? `${title} · ` : ''}${d.character}${cls ? ` · ★ ${cls}` : ''}`,
    match: m ? `${final ? 'This match' : 'So far'}: ${m.kills} K · ${m.deaths} D · ${pct(careerAccuracy(m))} accuracy` : '',
    career: c.matches
      ? `Career: ${c.matches} ${c.matches === 1 ? 'match' : 'matches'} · ${c.wins} ${c.wins === 1 ? 'win' : 'wins'} (${pct(careerWinRate(c))}) · K/D ${careerKd(c).toFixed(2)} · ${pct(careerAccuracy(c))} accuracy · ${weaponName(favouriteWeapon(c))}`
      : 'Career: your first match',
  };
}

/**
 * Your profile card on the Tab scoreboard and the end-of-match board (a strip under the board): your character's
 * portrait, your name (✓ signed in, GUEST otherwise), your character and favourite class, this match so far and your
 * career. Patched only when its text changes (the board redraws a few times a second while it's up).
 */
export class ProfileCard {
  readonly el: HTMLElement;
  private readonly img: HTMLImageElement;
  private readonly text: HTMLElement;
  private key = '';

  constructor(portrait?: Promise<string>) {
    this.el = document.createElement('div');
    this.el.id = 'profile-card';
    this.el.className = 'profile-card';
    this.img = document.createElement('img');
    this.img.alt = '';
    this.img.hidden = true;
    this.text = document.createElement('div');
    this.text.className = 'pc-text';
    this.el.append(this.img, this.text);
    void portrait?.then(
      (src) => {
        this.img.src = src;
        this.img.hidden = false;
      },
      () => undefined,
    );
  }

  /** Point the portrait at another picture (Random characters gave you a new body). */
  setPortrait(src: string): void {
    this.img.src = src;
    this.img.hidden = false;
  }

  update(d: ProfileCardData, m: MatchLine | null, final: boolean): void {
    const l = cardLines(d, m, final);
    const key = `${l.who}|${l.sub}|${l.match}|${l.career}|${d.verified}|${d.where}|${d.emblem ?? ''}`;
    if (key === this.key) return;
    this.key = key;
    const tag = d.verified ? '<i class="acct in">✓</i>' : '<i class="acct guest">GUEST</i>';
    const where = d.where === 'browser' ? '<small class="pc-where">kept in this browser</small>' : '';
    this.text.innerHTML = `<div class="pc-who">${emblemSvg(d.emblem)}<b>${escapeHtml(l.who)}</b>${tag}<span>${escapeHtml(l.sub)}</span></div>${l.match ? `<div class="pc-match">${escapeHtml(l.match)}</div>` : ''}<div class="pc-career">${escapeHtml(l.career)}${where}</div>`;
  }
}
