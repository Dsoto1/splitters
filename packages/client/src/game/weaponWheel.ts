import { weaponByCode } from '@tiletrigger/shared';
import { weaponIcon } from '../frontend/weaponIcons.ts';

/** One weapon on the wheel. */
export interface WheelEntry {
  code: number;
  name: string;
  /** "12 / 48", "∞" (melee), "40°" (heat). */
  ammo: string;
  /** Nothing left to fire: shown dimmed (still pickable, as with the number keys). */
  empty: boolean;
  held: boolean;
  weaponId: string;
}

/** The wheel's entries for an inventory (code → [magazine, reserve, alt ammo, heat]), in the order given. */
export function wheelEntries(codes: readonly number[], inventory: ReadonlyMap<number, readonly [number, number, number, number]>, held: number): WheelEntry[] {
  const out: WheelEntry[] = [];
  for (const code of codes) {
    const def = weaponByCode(code);
    const a = inventory.get(code);
    if (!def || !a) continue;
    const ammo = def.heat ? `${Math.round(a[3])}°` : def.magazine === 0 ? '∞' : `${a[0]} / ${a[1]}`;
    out.push({ code, name: def.displayName, ammo, empty: def.magazine > 0 && !def.heat && a[0] === 0 && a[1] === 0, held: code === held, weaponId: def.id });
  }
  return out;
}

/** Below this far from the middle the wheel points at nothing (letting go keeps your weapon). */
const DEAD = 0.3;

/**
 * The weapon wheel: a ring of the weapons you carry (icon, name, ammo; empty
 * ones dimmed). The input points it (mouse, right stick, or a finger on the
 * wheel itself); letting go switches to the one highlighted. It is only an
 * overlay: the match keeps running (no slow motion: the server's sim is the
 * truth), only firing is held back while it's open (input.ts).
 */
export class WeaponWheel {
  readonly el: HTMLDivElement;
  private readonly ring: HTMLDivElement;
  private readonly label: HTMLDivElement;
  private readonly dot: HTMLElement;
  private entries: WheelEntry[] = [];
  private items: HTMLElement[] = [];
  private hover = -1;
  private key = '';
  /** A finger points the wheel (the input keeps where it points, as it does for the mouse). */
  onPoint?: (x: number, y: number) => void;
  /** A finger picked an entry on the wheel (touch): the session closes it with a pick. */
  onTouchPick?: () => void;
  /** A finger let go on the middle: close without switching. */
  onTouchCancel?: () => void;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'weapon-wheel';
    this.el.hidden = true;
    this.ring = document.createElement('div');
    this.ring.className = 'ww-ring';
    this.label = document.createElement('div');
    this.label.className = 'ww-centre';
    this.dot = document.createElement('i');
    this.dot.className = 'ww-dot';
    this.ring.append(this.label, this.dot);
    this.el.append(this.ring);
    parent.append(this.el);
    // Touch (and a mouse without pointer lock): point at an entry with the finger, let go on it to pick.
    const point = (e: PointerEvent) => {
      const r = this.ring.getBoundingClientRect();
      const half = r.width / 2;
      const x = (e.clientX - r.left - half) / half;
      const y = (e.clientY - r.top - half) / half;
      this.aim(x, y);
      this.onPoint?.(x, y);
      return Math.hypot(x, y);
    };
    /** The press began outside the ring (on the dimmed screen, e.g. the Weapons button again): letting go closes without a switch. */
    let outside = false;
    this.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        this.el.setPointerCapture(e.pointerId);
      } catch {
        // A pointer the browser no longer tracks: the press still points the wheel.
      }
      outside = point(e) > 1.1;
    });
    this.el.addEventListener('pointermove', (e) => {
      if (this.el.hasPointerCapture?.(e.pointerId)) point(e);
    });
    this.el.addEventListener('pointerup', (e) => {
      if (!this.el.hasPointerCapture?.(e.pointerId)) return;
      point(e);
      if (this.hover >= 0 && !outside) this.onTouchPick?.();
      else this.onTouchCancel?.();
    });
  }

  get shown(): boolean {
    return !this.el.hidden;
  }

  /** Open (or refresh) the wheel with these weapons. */
  show(entries: WheelEntry[]): void {
    const key = entries.map((e) => `${e.code}:${e.ammo}:${e.empty ? 1 : 0}:${e.held ? 1 : 0}`).join(',');
    if (this.shown && key === this.key) return;
    const layout = !this.shown || entries.map((e) => e.code).join() !== this.entries.map((e) => e.code).join();
    this.key = key;
    this.entries = entries;
    if (layout) {
      for (const it of this.items) it.remove();
      const n = entries.length;
      this.items = entries.map((e, i) => {
        const it = document.createElement('div');
        it.className = 'ww-item';
        it.dataset.code = String(e.code);
        // Clockwise from the top.
        const a = (i / n) * Math.PI * 2;
        it.style.left = `${50 + Math.sin(a) * 37}%`;
        it.style.top = `${50 - Math.cos(a) * 37}%`;
        const icon = weaponIcon(e.weaponId, 'ww-icon');
        const name = document.createElement('b');
        const ammo = document.createElement('small');
        it.append(...(icon ? [icon] : []), name, ammo);
        this.ring.append(it);
        return it;
      });
      this.hover = -1;
    }
    entries.forEach((e, i) => {
      const it = this.items[i]!;
      it.querySelector('b')!.textContent = e.name;
      it.querySelector('small')!.textContent = e.ammo;
      it.classList.toggle('empty', e.empty);
      it.classList.toggle('held', e.held);
    });
    this.el.hidden = false;
    this.paint();
  }

  /** Point the wheel (x right, y down; the rim is length 1). */
  aim(x: number, y: number): void {
    const len = Math.hypot(x, y);
    const n = this.entries.length;
    let hover = -1;
    if (n && len >= DEAD) {
      // Angle clockwise from the top, to the nearest entry.
      const a = (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2);
      hover = Math.round(a / ((Math.PI * 2) / n)) % n;
    }
    const k = len > 1 ? 1 / len : 1;
    this.dot.style.left = `${50 + x * k * 37}%`;
    this.dot.style.top = `${50 + y * k * 37}%`;
    if (hover === this.hover) return;
    this.hover = hover;
    this.paint();
  }

  /** The weapon highlighted now, or null. */
  get picked(): number | null {
    return this.hover >= 0 ? (this.entries[this.hover]?.code ?? null) : null;
  }

  /** Close the wheel; returns the weapon it pointed at (or null). */
  hide(): number | null {
    const pick = this.picked;
    this.el.hidden = true;
    this.hover = -1;
    this.key = '';
    return pick;
  }

  dispose(): void {
    this.el.remove();
  }

  private paint(): void {
    this.items.forEach((it, i) => it.classList.toggle('on', i === this.hover));
    const e = this.hover >= 0 ? this.entries[this.hover] : this.entries.find((x) => x.held);
    this.label.replaceChildren();
    if (!e) return;
    const b = document.createElement('b');
    b.textContent = e.name;
    const s = document.createElement('small');
    s.textContent = e.empty ? 'Empty' : e.ammo;
    this.label.append(b, s);
  }
}
