import { awardText, type GameEvent, type MatchAward, type MatchPhase } from '@tiletrigger/shared';
import type { Hud } from './hud.ts';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * The end-of-match awards on the scoreboard (sim/awards.ts: Most Accurate, Longest Streak, Nemesis, Most Revenge Kills,
 * and Roulette's own in Roulette), every mode; and the revenge and nemesis callouts for the players they're about.
 * Nothing flashes: the panel and the lines just appear.
 */
export class AwardsHud {
  private readonly panel: HTMLElement;
  private aw: MatchAward[] = [];

  constructor(
    private readonly hud: Hud,
    private readonly slot: () => number,
  ) {
    const host = document.getElementById('hud') ?? document.body;
    this.panel = document.createElement('div');
    this.panel.id = 'match-awards';
    this.panel.hidden = true;
    host.append(this.panel);
  }

  dispose(): void {
    this.panel.remove();
  }

  event(ev: GameEvent): void {
    if (ev.e === 'awards') this.aw = ev.aw;
    else if (ev.e === 'callout') {
      const me = this.slot();
      const them = (s: number) => this.hud.name(s);
      if (ev.a === 'revenge') {
        if (ev.s === me) this.hud.showMessage(`Revenge on ${them(ev.t)}!`, 2);
        else if (ev.t === me) this.hud.showMessage(`${them(ev.s)} got their revenge`, 2);
      } else if (ev.s === me) this.hud.showMessage(`You're ${them(ev.t)}'s nemesis: ${ev.n ?? 3} in a row`, 2.5);
      else if (ev.t === me) this.hud.showMessage(`${them(ev.s)} is your nemesis: ${ev.n ?? 3} in a row`, 2.5);
    }
  }

  /** The awards while the scoreboard is up (intermission); cleared once the next round is under way. */
  phase(phase: MatchPhase): void {
    const show = phase === 'intermission' && this.aw.length > 0;
    if (show && this.panel.hidden) {
      this.panel.innerHTML = `<h3>Awards</h3>${this.aw
        .map((a) => {
          const t = awardText(a, (s) => this.hud.name(s));
          return `<div class="award ${a[0]}"><b>${escapeHtml(t.title)}</b><span>${escapeHtml(t.line)}</span></div>`;
        })
        .join('')}`;
    }
    this.panel.hidden = !show;
    if (phase !== 'intermission' && phase !== 'playing') this.aw = [];
  }

  /** For tests: the awards last given. */
  debug(): { awards: number; kinds: string[] } {
    return { awards: this.aw.length, kinds: this.aw.map((a) => a[0]) };
  }

  /** Tests and the flashing flow's picture: show these awards as the scoreboard would. */
  show(aw: MatchAward[]): void {
    this.aw = aw;
    this.panel.hidden = true;
    this.phase('intermission');
  }
}
