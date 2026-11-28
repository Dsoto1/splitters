import type { WeaponDefinition } from '@tiletrigger/shared';
import { armoryRole, armorySections, armoryStats, loadArmoryFavs } from '../frontend/armoryData.ts';
import { weaponIcon } from '../frontend/weaponIcons.ts';
import { PAD, glyphs } from '../inputMode.ts';
import './rangePicker.css';

/**
 * The ranges' weapon picker (owner, 2026-11-28: "I really dislike having to load into the level just to test it… give
 * them the weapon picker"; docs/FEATURES.md, "Ranges"): on the Practice range and Test my loadout, P (controller View,
 * the phone's Guns button) opens every weapon the Armory lists, by the same categories (frontend/armoryData.ts), your
 * Armory favourites first; a pick puts it in your hands at once (the host's `hand`: Match holdOnSpawn, so it stays for
 * the next life), no reload of the map. Each tile has its name and two key numbers; the one in focus its role and
 * every bar. Esc (controller B, the ✕) closes it; Q / E (LB / RB) in it, and [ / ] in play, go to the previous or next
 * weapon straight away. Loaded with the first opening (its own chunk: nothing of it in the menu's or the match's code).
 */

export interface RangePickerHost {
  /** The weapon in your hands now (its ID), or null. */
  held(): string | null;
  /** Put this weapon in your hands (and keep it for each life). */
  pick(id: string): void;
  /** The picker closed: `picked` when a pick closed it (a click, Enter, A), else Esc, B or the ✕. */
  closed(picked: boolean): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  const { class: cls, ...rest } = props;
  if (cls) e.className = cls;
  Object.assign(e, rest);
  e.append(...children);
  return e;
};

/** The two numbers a tile shows: its damage a pull, and its fire rate (else its range). */
function keyStats(d: WeaponDefinition): string {
  const stats = armoryStats(d);
  // (Splash and stream weapons read 0 a pull on the tuning page's numbers: their rate and range instead.)
  const dmg = stats.find((s) => s.key === 'damage' && s.text !== '0');
  const rate = stats.find((s) => s.key === 'rate');
  const range = stats.find((s) => s.key === 'range');
  const second = dmg ? (rate ?? range) : range;
  const first = dmg ? `${dmg.text} dmg` : rate ? `${rate.text} rpm` : '';
  return [first, second ? (second.key === 'rate' ? `${second.text} rpm` : second.text) : ''].filter(Boolean).join(' · ');
}

/** Every weapon in the picker's order: favourites first, then the Armory's sections. */
export function pickerOrder(favs: readonly string[] = loadArmoryFavs()): { id: string; label: string; weapons: WeaponDefinition[] }[] {
  const sections = armorySections();
  const all = sections.flatMap((s) => s.weapons);
  const fav = favs.map((id) => all.find((d) => d.id === id)).filter((d): d is WeaponDefinition => !!d);
  return [...(fav.length ? [{ id: 'favs', label: '★ Favourites', weapons: fav }] : []), ...sections];
}

/** The weapon `dir` steps from `id` in the Armory's order (wrapping round): the quick previous / next. */
export function stepWeapon(id: string | null, dir: 1 | -1): string {
  const all = armorySections().flatMap((s) => s.weapons.map((d) => d.id));
  const i = id ? all.indexOf(id) : -1;
  return all[(i < 0 ? (dir > 0 ? 0 : all.length - 1) : i + dir + all.length) % all.length]!;
}

export class RangePicker {
  readonly root: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly detail: HTMLDivElement;
  private readonly search: HTMLInputElement;
  private readonly chips: HTMLDivElement;
  private openNow = false;

  constructor(
    parent: HTMLElement,
    private readonly host: RangePickerHost,
  ) {
    this.root = el('div', { id: 'range-picker', class: 'range-picker', hidden: true });
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Weapons');
    const close = el('button', { type: 'button', class: 'rp-close', id: 'rp-close', textContent: '✕', title: 'Close (Esc)' });
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => this.close(false));
    this.search = el('input', { type: 'search', id: 'rp-search', class: 'rp-search', placeholder: 'Search…', maxLength: 30, autocomplete: 'off' });
    this.search.setAttribute('aria-label', 'Search weapons');
    this.search.addEventListener('input', () => this.filter());
    const prev = el('button', { type: 'button', class: 'rp-step', title: 'Previous weapon, now (Q, LB; in play: [)' }, ...glyphs('Q', 'LB'), el('span', { textContent: '◀' }));
    const next = el('button', { type: 'button', class: 'rp-step', title: 'Next weapon, now (E, RB; in play: ])' }, el('span', { textContent: '▶' }), ...glyphs('E', 'RB'));
    prev.setAttribute('aria-label', 'Previous weapon');
    next.setAttribute('aria-label', 'Next weapon');
    prev.addEventListener('click', () => this.step(-1));
    next.addEventListener('click', () => this.step(1));
    const head = el('div', { class: 'rp-head' }, el('b', { textContent: 'Weapons' }), prev, next, this.search, close);
    this.chips = el('div', { class: 'rp-chips' });
    this.grid = el('div', { class: 'rp-grid', id: 'rp-grid' });
    this.detail = el('div', { class: 'rp-detail', id: 'rp-detail' });
    const foot = el('small', { class: 'rp-foot', textContent: 'Click or Enter: in your hands (each life) · Esc closes · P opens · [ ] the previous or next in play' });
    this.root.append(head, this.chips, this.grid, this.detail, foot);
    this.build();
    // (Clicks and taps stay in the picker: nothing behind it fires or turns.)
    for (const ev of ['pointerdown', 'mousedown', 'touchstart', 'wheel'] as const) this.root.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return this.openNow;
  }

  private build(): void {
    const held = this.host.held();
    for (const s of pickerOrder()) {
      const chip = el('button', { type: 'button', class: 'rp-chip', textContent: s.label });
      chip.dataset.section = s.id;
      chip.addEventListener('click', () => this.jump(s.id));
      this.chips.append(chip);
      const tiles = s.weapons.map((d) => {
        const icon = weaponIcon(d.id, 'rp-icon');
        const t = el('button', { type: 'button', class: `rp-tile${d.id === held ? ' on' : ''}`, title: d.displayName }, ...(icon ? [icon] : []), el('span', { class: 'rp-name', textContent: d.displayName }), el('small', { textContent: keyStats(d) }));
        t.dataset.weapon = d.id;
        t.addEventListener('click', () => this.choose(d.id, true));
        t.addEventListener('focus', () => this.show(d));
        t.addEventListener('pointerenter', () => this.show(d));
        return t;
      });
      const sec = el('section', { class: 'rp-sec' }, el('h4', { textContent: s.label }), el('div', { class: 'rp-tiles' }, ...tiles));
      sec.dataset.section = s.id;
      this.grid.append(sec);
    }
  }

  /** The weapon in focus: its name, role and every bar. */
  private show(d: WeaponDefinition): void {
    const bars = armoryStats(d).map((s) => {
      const bar = el('span', { class: 'rp-bar' }, el('i'));
      (bar.firstChild as HTMLElement).style.width = `${Math.round(Math.max(0.02, s.share) * 100)}%`;
      return el('div', { class: 'rp-stat', title: s.help }, el('span', { textContent: s.label }), bar, el('b', { textContent: s.text }));
    });
    this.detail.replaceChildren(el('h3', { textContent: d.displayName }), el('p', { textContent: armoryRole(d) }), el('div', { class: 'rp-stats' }, ...bars));
    this.detail.dataset.weapon = d.id;
  }

  private filter(): void {
    const q = this.search.value.trim().toLowerCase();
    for (const sec of this.grid.querySelectorAll<HTMLElement>('.rp-sec')) {
      let n = 0;
      for (const t of sec.querySelectorAll<HTMLElement>('.rp-tile')) {
        t.hidden = !!q && !t.title.toLowerCase().includes(q);
        if (!t.hidden) n++;
      }
      sec.hidden = n === 0;
      this.chips.querySelector<HTMLElement>(`.rp-chip[data-section="${sec.dataset.section}"]`)?.toggleAttribute('hidden', sec.hidden);
    }
  }

  private jump(id: string): void {
    const sec = this.grid.querySelector<HTMLElement>(`.rp-sec[data-section="${id}"]`);
    if (!sec) return;
    this.grid.scrollTop = sec.offsetTop - this.grid.offsetTop;
    sec.querySelector<HTMLElement>('.rp-tile:not([hidden])')?.focus({ preventScroll: true });
  }

  private tiles(): HTMLElement[] {
    return [...this.grid.querySelectorAll<HTMLElement>('.rp-tile')].filter((t) => !t.hidden && !t.closest('[hidden]'));
  }

  /** Put `id` in your hands; `close` too (a click, Enter, A). */
  private choose(id: string, close: boolean): void {
    this.host.pick(id);
    this.mark(id);
    if (close) this.close(true);
  }

  private mark(id: string): void {
    for (const t of this.grid.querySelectorAll<HTMLElement>('.rp-tile')) t.classList.toggle('on', t.dataset.weapon === id);
  }

  /** The previous or next weapon in hand now (the picker stays as it is). */
  step(dir: 1 | -1): string {
    const id = stepWeapon(this.host.held(), dir);
    this.host.pick(id);
    this.mark(id);
    if (this.openNow) {
      const t = this.grid.querySelector<HTMLElement>(`.rp-sec:not([data-section="favs"]) .rp-tile[data-weapon="${id}"]`);
      t?.focus({ preventScroll: true });
      t?.scrollIntoView({ block: 'nearest' });
    }
    return id;
  }

  open(): void {
    if (this.openNow) return;
    this.openNow = true;
    this.root.hidden = false;
    const held = this.host.held();
    if (held) this.mark(held);
    const t = (held && this.grid.querySelector<HTMLElement>(`.rp-sec:not([data-section="favs"]) .rp-tile[data-weapon="${held}"]`)) || this.tiles()[0];
    if (t) {
      t.focus({ preventScroll: true });
      t.scrollIntoView({ block: 'center' });
    }
  }

  close(picked: boolean): void {
    if (!this.openNow) return;
    this.openNow = false;
    this.root.hidden = true;
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.host.closed(picked);
  }

  /** A key while open: true when it took it (Esc is the session's: it calls close). */
  key(e: KeyboardEvent): boolean {
    const typing = e.target === this.search;
    if (e.code === 'KeyQ' && !typing) return this.step(-1), true;
    if (e.code === 'KeyE' && !typing) return this.step(1), true;
    if (e.code === 'KeyP' && !typing) return this.close(false), true;
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.code] as [number, number] | undefined;
    if (dir && !(typing && dir[0])) return this.move(dir[0], dir[1]), true;
    if (e.code === 'Enter' && typing) {
      const t = this.tiles()[0];
      if (t) this.choose(t.dataset.weapon!, true);
      return true;
    }
    // A letter with nothing focused for it: into the search.
    if (!typing && e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this.search.focus();
      return false;
    }
    return false;
  }

  /** A controller button while open: true when it took it. */
  pad(button: number): boolean {
    if (button === PAD.b || button === 8) return this.close(false), true;
    if (button === PAD.lb) return this.step(-1), true;
    if (button === PAD.rb) return this.step(1), true;
    if (button === PAD.a) {
      const f = document.activeElement as HTMLElement | null;
      if (f?.dataset.weapon && this.root.contains(f)) this.choose(f.dataset.weapon, true);
      return true;
    }
    const dir = { [PAD.left]: [-1, 0], [PAD.right]: [1, 0], [PAD.up]: [0, -1], [PAD.down]: [0, 1] }[button] as [number, number] | undefined;
    if (dir) return this.move(dir[0], dir[1]), true;
    return false;
  }

  /** Arrow keys and the d-pad over the tiles (the Armory's grid move). */
  private move(dx: number, dy: number): void {
    const tiles = this.tiles();
    const f = document.activeElement as HTMLElement | null;
    const from = f && tiles.includes(f) ? f : null;
    let to: HTMLElement | undefined;
    if (!from) to = this.grid.querySelector<HTMLElement>('.rp-tile.on:not([hidden])') ?? tiles[0];
    else if (dx) to = tiles[tiles.indexOf(from) + dx];
    else {
      const r = from.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const rows = tiles.map((t) => ({ t, r: t.getBoundingClientRect() })).filter(({ r: o }) => (dy > 0 ? o.top >= r.bottom - 2 : o.bottom <= r.top + 2));
      if (rows.length) {
        const top = dy > 0 ? Math.min(...rows.map((o) => o.r.top)) : Math.max(...rows.map((o) => o.r.top));
        to = rows.filter((o) => Math.abs(o.r.top - top) < 2).sort((a, b) => Math.abs(a.r.left + a.r.width / 2 - cx) - Math.abs(b.r.left + b.r.width / 2 - cx))[0]?.t;
      }
    }
    if (!to) return;
    to.focus({ preventScroll: true });
    to.scrollIntoView({ block: 'nearest' });
  }

  dispose(): void {
    this.root.remove();
  }
}
