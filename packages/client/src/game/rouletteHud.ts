import {
  CORE_WEAPONS,
  ROULETTE_SAY_PICK,
  ROULETTE_SAY_REROLL,
  SPAWN_CARD_SECONDS,
  STORM_WARN_SECONDS,
  awardText,
  bodyLine,
  getLook,
  rouletteSignatures,
  signatureWeapon,
  weaponSetInPlay,
  type GameEvent,
  type MapDocument,
  type MatchPhase,
  type MatchRules,
  type RouletteAward,
  type RoulettePrivate,
} from '@tiletrigger/shared';
import type { Hud } from './hud.ts';
import type { InputState } from './input.ts';
import { reduceFlashing } from './reduceFlashing.ts';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The jackpot glow's brightest (the screen's edges only), its ease in and how long it holds and fades: with Reduce flashing on, dimmer and slower. */
const GLOW = { peak: 0.55, calmPeak: 0.32, easeIn: 0.45, calmEaseIn: 1.2, hold: 1.6, fadeOut: 1.6 };

/**
 * Roulette on the client (docs/ROULETTE_MODE_PLAN.md; sim/roulette.ts): the spawn card ("You are: Big Bab · Large:
 * tougher, slower"), the jackpot's glow and announcer lines, the death screen's next card, streak pick (1-3 or a click)
 * and reroll (R), Lunar's gravity-storm warning, and the awards at the end of the match. Nothing here flashes: the glow
 * and the storm's warning ease in and hold (Reduce flashing makes them dimmer and slower still).
 */
export class RouletteHud {
  private readonly root: HTMLElement;
  private readonly card: HTMLElement;
  private readonly glow: HTMLElement;
  private readonly pick: HTMLElement;
  private readonly next: HTMLElement;
  private readonly storm: HTMLElement;
  private readonly awards: HTMLElement;
  private cardUntil = 0;
  /** The glow's start (ms), or 0: none. */
  private glowAt = 0;
  /** The glow's brightest since the last jackpot began (tests). */
  private glowPeak = 0;
  private me: RoulettePrivate | null = null;
  private offerKey = '';
  private aw: RouletteAward[] = [];
  private stormState: [number, number, number, number] | null = null;

  constructor(
    private readonly hud: Hud,
    private readonly input: InputState,
    private readonly map: MapDocument,
    private readonly rules: () => MatchRules | null,
    private readonly slot: () => number,
    private readonly portraitOf?: (look: string) => Promise<string>,
  ) {
    const host = document.getElementById('hud') ?? document.body;
    this.root = el('div', 'rl-layer');
    this.glow = el('div', 'rl-glow');
    this.card = el('div', 'rl-card');
    this.next = el('div', 'rl-next');
    this.pick = el('div', 'rl-pick');
    this.storm = el('div', 'rl-storm');
    this.awards = el('div', 'rl-awards');
    for (const e of [this.card, this.next, this.pick, this.storm, this.awards]) e.hidden = true;
    this.glow.style.opacity = '0';
    this.glow.style.backgroundImage = `url(${glowPicture().toDataURL()})`;
    this.root.append(this.glow, this.card, this.next, this.pick, this.storm, this.awards);
    host.append(this.root);
  }

  dispose(): void {
    this.root.remove();
    this.input.roulettePick = 0;
    this.input.rouletteReroll = false;
  }

  /** The look's name, its body line and the weapon it spawns holding. */
  private describe(look: string, jackpot: boolean, tiny = false): { name: string; line: string; weapon: string | null } {
    const rules = this.rules() ?? ({} as MatchRules);
    const set = weaponSetInPlay(rules, this.map);
    const sig = rouletteSignatures(rules) ? signatureWeapon(look, jackpot, set) : null;
    return { name: getLook(look).name, line: bodyLine(look, rules, tiny ? 'tiny' : null), weapon: sig ? (CORE_WEAPONS[sig]?.displayName ?? null) : null };
  }

  /** You spawned as `look` (`roll` 1 jackpot, 2 tiny): the spawn card for a couple of seconds; a jackpot's glow. */
  spawned(look: string, roll?: 1 | 2): void {
    const d = this.describe(look, roll === 1, roll === 2);
    this.card.className = `rl-card${roll === 1 ? ' jackpot' : roll === 2 ? ' tiny' : ''}`;
    this.card.innerHTML = `${roll === 1 ? '<em>Jackpot!</em>' : roll === 2 ? '<em>Tiny roll!</em>' : ''}<small>You are</small><b>${escapeHtml(d.name)}</b><span>${escapeHtml(d.line)}</span>${d.weapon ? `<i>${escapeHtml(d.weapon)}${roll === 1 ? ' · +armour' : ''}</i>` : ''}`;
    this.card.hidden = false;
    this.cardUntil = performance.now() + SPAWN_CARD_SECONDS * 1000;
    if (roll === 1) {
      this.glowAt = performance.now();
      this.glowPeak = 0;
    }
    this.hidePick();
  }

  /** Roulette's events: announcer lines and the feed, the storm, the awards. */
  event(ev: GameEvent): void {
    if (ev.e !== 'rl') return;
    const me = ev.s === this.slot();
    switch (ev.a) {
      case 'jackpot':
        if (!me) this.hud.say(ev.s!, `hit the jackpot as ${getLook(ev.l).name}!`);
        break;
      case 'pick':
        if (me) this.hud.showMessage('Streak pick! Choose your next character when you respawn', 3);
        break;
      case 'token':
        if (me) this.hud.showMessage(`Reroll token earned (${ev.n} held)`, 2);
        break;
      case 'giant':
        if (me) this.hud.showMessage('Giant Slayer! +1', 2);
        else this.hud.say(ev.s!, `Giant Slayer: downed ${this.hud.name(ev.t!)}`);
        break;
      case 'air':
        if (me) this.hud.showMessage('Air kill! +1', 1.5);
        break;
      case 'variety':
        if (me) this.hud.showMessage(`Variety bonus +1 (${ev.n} characters)`, 2);
        break;
      case 'swap':
        if (me) this.hud.showMessage(`You are now ${getLook(ev.l).name}`, 2);
        break;
      case 'reroll':
        if (me) this.hud.showMessage(`Rerolled: next up ${getLook(ev.l).name}`, 2);
        break;
      case 'storm':
        if (ev.n === 2) this.hud.showMessage(ev.g !== undefined && ev.g > (this.rules()?.gravity ?? 1) ? 'Gravity surge!' : 'Gravity storm: float!', 2.5);
        else if (ev.n === 0) this.hud.showMessage('The gravity storm is over', 2);
        break;
      case 'awards':
        this.aw = ev.aw ?? [];
        break;
    }
  }

  /** Your own Roulette state (the private snapshot) and whether you are alive: the death screen. */
  state(rp: RoulettePrivate | undefined, alive: boolean, phase: MatchPhase): void {
    this.me = rp ?? null;
    const down = !alive && phase === 'playing' && !!rp;
    const offer = down && rp?.o && (rp.oc ?? -1) < 0 ? rp.o : null;
    const tokens = rp?.t ?? 0;
    this.input.roulettePick = offer ? offer.length : 0;
    this.input.rouletteReroll = down && tokens > 0;
    if (offer) this.showPick(offer, rp!.oj ?? 0, tokens);
    else this.hidePick();
    if (down && !offer && rp) {
      const chosen = rp.o && rp.oc !== undefined && rp.oc >= 0 ? rp.o[rp.oc] : null;
      const look = chosen ?? rp.n;
      const d = this.describe(look, false);
      const key = `${look}|${tokens}|${chosen ? 1 : 0}`;
      if (this.next.dataset.key !== key) {
        this.next.dataset.key = key;
        this.next.innerHTML = `<small>${chosen ? 'You chose' : 'Next up'}</small><b>${escapeHtml(d.name)}</b><span>${escapeHtml(d.line)}</span>${tokens > 0 && !chosen ? `<button type="button" class="rl-reroll" id="rl-reroll">R: reroll <small>(${tokens} ${tokens === 1 ? 'token' : 'tokens'})</small></button>` : ''}`;
        this.next.querySelector('button')?.addEventListener('click', () => this.input.chooseRoulette(ROULETTE_SAY_REROLL));
      }
      this.next.hidden = false;
    } else this.next.hidden = true;
  }

  private showPick(cards: readonly string[], jackpots: number, tokens: number): void {
    const key = `${cards.join()}|${jackpots}|${tokens}`;
    if (this.offerKey === key && !this.pick.hidden) return;
    this.offerKey = key;
    this.pick.innerHTML = '';
    this.pick.append(Object.assign(document.createElement('h3'), { textContent: 'Streak pick: choose your next character' }));
    const row = document.createElement('div');
    row.className = 'rl-pick-row';
    cards.forEach((look, i) => {
      const jp = (jackpots & (1 << i)) !== 0;
      const d = this.describe(look, jp);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `rl-pick-card${jp ? ' jackpot' : ''}`;
      b.id = `rl-pick-${i}`;
      b.dataset.look = look;
      b.innerHTML = `<kbd>${i + 1}</kbd><img alt="" /><b>${escapeHtml(d.name)}</b><span>${escapeHtml(d.line)}</span>${d.weapon ? `<i>${escapeHtml(d.weapon)}</i>` : ''}${jp ? '<em>Jackpot</em>' : ''}`;
      b.addEventListener('click', () => this.input.chooseRoulette(ROULETTE_SAY_PICK + i));
      const img = b.querySelector('img')!;
      void this.portraitOf?.(look).then((src) => (img.src = src), () => undefined);
      row.append(b);
    });
    this.pick.append(row, Object.assign(document.createElement('p'), { textContent: `Press 1, 2 or 3 (or click)${tokens > 0 ? ' · R: reroll the three' : ''}. The first if you don't choose.` }));
    this.pick.hidden = false;
  }

  private hidePick(): void {
    if (this.pick.hidden) return;
    this.pick.hidden = true;
    this.offerKey = '';
  }

  /** Lunar's gravity storm (the snapshot's `rl`): the warning's countdown, then the storm's line. */
  stormSnapshot(rl: [number, number, number, number] | undefined): void {
    this.stormState = rl ?? null;
    if (!rl || rl[0] === 0) {
      this.storm.hidden = true;
      return;
    }
    const heavy = rl[3] > (this.rules()?.gravity ?? 1) * 100;
    const text = rl[0] === 1 ? `Gravity storm in ${Math.max(1, Math.min(STORM_WARN_SECONDS, rl[1]))}` : `${heavy ? 'Gravity surge' : 'Gravity storm'}: ${rl[1]} s`;
    if (this.storm.textContent !== text) this.storm.textContent = text;
    this.storm.className = `rl-storm${rl[0] === 2 ? ' on' : ''}${heavy ? ' heavy' : ''}`;
    this.storm.hidden = false;
  }

  /** The awards while the scoreboard is up (intermission). */
  phase(phase: MatchPhase): void {
    const show = phase === 'intermission' && this.aw.length > 0;
    if (show && this.awards.hidden) {
      this.awards.innerHTML = `<h3>Awards</h3>${this.aw
        .map((a) => {
          const t = awardText(a, (s) => this.hud.name(s));
          return `<div class="rl-award ${a[0]}"><b>${escapeHtml(t.title)}</b><span>${escapeHtml(t.line)}</span></div>`;
        })
        .join('')}`;
    }
    this.awards.hidden = !show;
    if (phase !== 'intermission' && phase !== 'playing') this.aw = [];
    if (phase !== 'playing') {
      this.storm.hidden = true;
      this.next.hidden = true;
      this.hidePick();
    }
  }

  /** Tests (pictures on a slow page): the card and the glow stay as they are while held. */
  hold = false;

  /** Each frame: the card's time, the glow's ease (in, hold, out; never a flash). */
  frame(now: number): void {
    if (this.hold) return;
    if (!this.card.hidden && now > this.cardUntil) this.card.hidden = true;
    if (!this.glowAt) return;
    const calm = reduceFlashing();
    const t = (now - this.glowAt) / 1000;
    const easeIn = calm ? GLOW.calmEaseIn : GLOW.easeIn;
    const peak = calm ? GLOW.calmPeak : GLOW.peak;
    let v: number;
    if (t < easeIn) v = peak * smooth(t / easeIn);
    else if (t < easeIn + GLOW.hold) v = peak;
    else if (t < easeIn + GLOW.hold + GLOW.fadeOut) v = peak * (1 - smooth((t - easeIn - GLOW.hold) / GLOW.fadeOut));
    else {
      v = 0;
      this.glowAt = 0;
    }
    this.glow.style.opacity = v.toFixed(3);
    this.glowPeak = Math.max(this.glowPeak, v);
  }

  /** The jackpot glow as drawn (its picture and its opacity now): the flashing flow lays it over the frames it grabs. */
  glowOverlay(): { image: HTMLCanvasElement; opacity: number } {
    return { image: glowPicture(), opacity: Number(this.glow.style.opacity || 0) };
  }

  /** For tests: the glow's opacity now, the storm and the state last seen. */
  debug(): { glow: number; glowPeak: number; storm: [number, number, number, number] | null; me: RoulettePrivate | null; awards: number } {
    return { glow: Number(this.glow.style.opacity || 0), glowPeak: this.glowPeak, storm: this.stormState, me: this.me, awards: this.aw.length };
  }
}

let glowCanvas: HTMLCanvasElement | null = null;
/** The jackpot glow's picture: gold at the screen's edges, fading to nothing a third of the way in (stretched to the screen). */
function glowPicture(): HTMLCanvasElement {
  if (glowCanvas) return glowCanvas;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 144;
  const ctx = c.getContext('2d')!;
  ctx.save();
  ctx.translate(128, 72);
  ctx.scale(1, 144 / 256);
  const g = ctx.createRadialGradient(0, 0, 70, 0, 0, 182);
  g.addColorStop(0, 'rgba(255, 196, 60, 0)');
  g.addColorStop(0.55, 'rgba(255, 196, 60, 0.35)');
  g.addColorStop(1, 'rgba(255, 196, 60, 0.9)');
  ctx.fillStyle = g;
  ctx.fillRect(-128, -128, 256, 256);
  ctx.restore();
  return (glowCanvas = c);
}

const smooth = (x: number): number => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
};

function el(tag: string, id: string): HTMLElement {
  const e = document.createElement(tag);
  e.id = id;
  return e;
}
