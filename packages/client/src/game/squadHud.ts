import { ORDER_LABELS, SPACING_TEXT, readSquad, type SquadView } from '@tiletrigger/shared';
import type { MinimapBlip } from './minimap.ts';

/**
 * Fireteams' squad HUD (docs/FIRETEAMS_PLAN.md, Part 2): your squad's portraits, each with its health and name (greyed
 * while down), under a line with the squad's order and spacing ("Squad · Hold here · Spread out"); your squadmates in
 * the squad's colour on the minimap (a ringed dot, apart from the rest of the team), the order's place there too (a
 * square: H, G or D), and the squad's colour on their markers over their heads.
 *
 * It reads the snapshot's squads (`fs`, sim/fireteams.ts squadSnapshot) and the health the snapshot already carries.
 * Nothing here blinks or flashes (Reduce flashing): a hurt squadmate's bar shortens and turns red, steadily.
 */

/** Your squad's colour (the Fireteams orange of the order wheel and the order line). */
export const SQUAD_COLOR = '#ffb347';
/** Its order's place on the minimap: the order's initial. */
const PLACE_LABEL: Readonly<Record<string, string>> = { hold: 'H', go: 'G', defend: 'D' };

export interface SquadMate {
  slot: number;
  name: string;
  look: string | undefined;
  /** Health, 0..1. */
  hp: number;
  alive: boolean;
}

export class SquadHud {
  private el: HTMLElement | null = null;
  private list: HTMLElement | null = null;
  private squad: SquadView | null = null;
  /** The cards by slot (made once each; a portrait asked for once per look). */
  private readonly cards = new Map<number, { el: HTMLElement; look: string | undefined; bar: HTMLElement; name: HTMLElement }>();
  private lastKey = '';

  constructor(
    private readonly root: HTMLElement,
    private readonly portraitOf?: (look: string) => Promise<string>,
  ) {}

  /** Your squad from the snapshot's squads (null: you lead none, or the variant is off). */
  read(fs: readonly (readonly number[])[] | undefined, me: number): SquadView | null {
    let mine: SquadView | null = null;
    if (fs) {
      for (const a of fs) {
        const v = readSquad(a);
        if (v.members.includes(me)) {
          mine = v;
          break;
        }
      }
    }
    this.squad = mine;
    return mine;
  }

  get current(): SquadView | null {
    return this.squad;
  }

  /** Is this player one of your squadmates (not you)? */
  isMate(slot: number, me: number): boolean {
    return !!this.squad && slot !== me && this.squad.members.includes(slot);
  }

  /** The panel, once a snapshot: the order line and a card per squadmate. */
  update(me: number, mate: (slot: number) => SquadMate): void {
    const s = this.squad;
    if (!s) {
      if (this.el) this.el.hidden = true;
      return;
    }
    const el = this.ensure();
    el.hidden = false;
    const order = ORDER_LABELS[s.order];
    const spacing = SPACING_TEXT[s.spacing];
    el.querySelector('#squad-order b')!.textContent = order;
    const sp = el.querySelector<HTMLElement>('#squad-order i')!;
    sp.textContent = spacing;
    sp.hidden = !spacing;
    const mates = s.members.filter((m) => m !== me).map(mate);
    const key = mates.map((m) => `${m.slot}:${Math.round(m.hp * 20)}:${m.alive ? 1 : 0}:${m.look ?? ''}:${m.name}`).join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;
    const keep = new Set(mates.map((m) => m.slot));
    for (const [slot, c] of this.cards) {
      if (keep.has(slot)) continue;
      c.el.remove();
      this.cards.delete(slot);
    }
    for (const m of mates) {
      let c = this.cards.get(m.slot);
      if (!c) {
        const card = document.createElement('div');
        card.className = 'sq-mate';
        card.dataset.slot = String(m.slot);
        const img = document.createElement('img');
        img.alt = '';
        const name = document.createElement('span');
        name.className = 'sq-name';
        const hp = document.createElement('span');
        hp.className = 'sq-hp';
        const bar = document.createElement('i');
        hp.append(bar);
        card.append(img, name, hp);
        c = { el: card, look: undefined, bar, name };
        this.cards.set(m.slot, c);
      }
      this.list!.append(c.el);
      if (c.look !== m.look) {
        c.look = m.look;
        const img = c.el.querySelector('img')!;
        img.removeAttribute('src');
        const want = m.look;
        if (want) void this.portraitOf?.(want).then((src) => c!.look === want && (img.src = src), () => undefined);
      }
      c.name.textContent = m.name;
      const pct = m.alive ? Math.max(0, Math.min(1, m.hp)) : 0;
      c.bar.style.width = `${Math.round(pct * 100)}%`;
      c.el.classList.toggle('down', !m.alive);
      c.el.classList.toggle('low', m.alive && pct < 0.35);
      c.el.title = m.alive ? `${m.name} · ${Math.round(pct * 100)}%` : `${m.name} · down`;
    }
  }

  /** Squad markers for the minimap: your squadmates alive (ringed dots) and the order's place. */
  blips(me: number, at: (slot: number) => { x: number; z: number; alive: boolean } | null): MinimapBlip[] {
    const s = this.squad;
    if (!s) return [];
    const out: MinimapBlip[] = [];
    for (const m of s.members) {
      if (m === me) continue;
      const p = at(m);
      if (p?.alive) out.push({ x: p.x, z: p.z, color: SQUAD_COLOR, ring: true });
    }
    if (s.place) out.push({ x: s.place.x, z: s.place.z, color: SQUAD_COLOR, label: PLACE_LABEL[s.order] ?? '' });
    return out;
  }

  private ensure(): HTMLElement {
    if (this.el) return this.el;
    // (The order line keeps its Part 1 id: `#squad-order b` is the order.)
    const el = document.createElement('div');
    el.id = 'squad-hud';
    el.innerHTML = '<div id="squad-order"><small>Squad</small><b></b><i hidden></i></div><div class="sq-mates"></div>';
    this.root.append(el);
    this.el = el;
    this.list = el.querySelector('.sq-mates');
    return el;
  }
}
