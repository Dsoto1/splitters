import { weaponByCode } from '@tiletrigger/shared';
import { weaponIcon } from '../frontend/weaponIcons.ts';
import { WHEEL_CATEGORIES, WHEEL_CATEGORY_LABELS, type WheelCategory, wheelCategoryOf } from './wheelCategories.ts';

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

/** A weapon's wheel slice (the order wheel's entries have no weapon: none). */
export function entryCategory(e: WheelEntry): WheelCategory | null {
  const def = e.weaponId ? weaponByCode(e.code) : undefined;
  return def ? wheelCategoryOf(def) : null;
}

/** The wheel's entries for an inventory (code → [magazine, reserve, alt ammo, heat]), in the order given. */
export function wheelEntries(codes: readonly number[], inventory: ReadonlyMap<number, readonly [number, number, number, number]>, held: number): WheelEntry[] {
  const out: WheelEntry[] = [];
  for (const code of codes) {
    const def = weaponByCode(code);
    const a = inventory.get(code);
    if (!def || !a) continue;
    const ammo = def.heat ? `${Math.round(a[3])}°` : def.magazine === 0 ? (def.alt?.reload ? `∞ · ${a[2]} / ${a[1]}` : '∞') : `${a[0]} / ${a[1]}`;
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

  /** `id`: the overlay's id ('order-wheel': Fireteams' order wheel, the same ring with orders on it, no icons). */
  constructor(parent: HTMLElement, id = 'weapon-wheel') {
    this.el = document.createElement('div');
    this.el.id = id;
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
      // Many weapons on you: smaller items so they fit round the ring (it holds about nine at full size), then the
      // names, then the ammo, go to the middle (which shows the one pointed at), leaving icons.
      const fit = Math.min(25, ((2 * Math.PI * 37) / Math.max(n, 1)) * 0.92);
      this.ring.style.setProperty('--ww-item', `${fit.toFixed(2)}%`);
      this.ring.classList.toggle('compact', n > 9);
      this.ring.classList.toggle('dense', n > 16);
      this.items = entries.map((e, i) => {
        const it = document.createElement('div');
        it.className = 'ww-item';
        it.dataset.code = String(e.code);
        // Clockwise from the top.
        const a = (i / n) * Math.PI * 2;
        it.style.left = `${50 + Math.sin(a) * 37}%`;
        it.style.top = `${50 - Math.cos(a) * 37}%`;
        const icon = e.weaponId ? weaponIcon(e.weaponId, 'ww-icon') : null;
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

/** Geometry of the category wheel, in shares of its half-width: the slices' ring, and the outer arc's radius. */
const SLICE_IN = 0.2;
const SLICE_OUT = 0.56;
const ARC_R = 0.8;
/** Pointing (the input's aim: 1 is full tilt, drawn on the outer arc) nearer the middle than this picks nothing… */
const CAT_DEAD = 0.25;
/** …out to this picks a slice (its last pick), and past it a weapon on the open slice's outer arc. */
const CAT_OUTER = 0.72;
const SLICE_ANGLE = (Math.PI * 2) / WHEEL_CATEGORIES.length;

/** Where the slice `k`'s outer arc puts each of its `n` weapons: `pick` sits in line with the slice, the rest either side. */
export function arcAngles(k: number, n: number, pick: number): number[] {
  // One weapon a step (about one item's width out on the arc), closer when a big slice would go most of the way round.
  const step = Math.min(0.34, (Math.PI * 1.6) / Math.max(1, n - 1));
  return Array.from({ length: n }, (_, i) => k * SLICE_ANGLE + (i - pick) * step);
}

/** Angle clockwise from the top, 0..2π. */
const angleOf = (x: number, y: number) => (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2);
/** The difference a − b folded into −π..π. */
const turn = (a: number, b: number) => ((((a - b) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

/** What the category wheel points at for an aim (pure, for tests): the slice and the weapon (its index in the slice), or nothing. */
export function categoryAim(x: number, y: number, slices: readonly { count: number; pick: number }[], open: number): { slice: number; item: number } | null {
  const len = Math.hypot(x, y);
  if (len < CAT_DEAD) return null;
  const a = angleOf(x, y);
  // Out on the arc: a weapon of the slice already open while the pointer stays over its arc…
  if (len >= CAT_OUTER && open >= 0 && slices[open]?.count) {
    const s = slices[open]!;
    const at = arcAngles(open, s.count, s.pick);
    const half = at.length > 1 ? Math.abs(at[1]! - at[0]!) / 2 : SLICE_ANGLE / 2;
    let best = -1;
    let bestD = Infinity;
    at.forEach((t, i) => {
      const d = Math.abs(turn(a, t));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (bestD <= Math.max(half, SLICE_ANGLE / 2) + 0.02) return { slice: open, item: best };
  }
  // …otherwise the slice under the pointer, with its last pick (an empty slice picks nothing).
  const k = Math.round(a / SLICE_ANGLE) % WHEEL_CATEGORIES.length;
  const s = slices[k];
  if (!s?.count) return null;
  if (len >= CAT_OUTER && k !== open) return categoryAim(x, y, slices, k);
  return { slice: k, item: s.pick };
}

/**
 * The weapon wheel by category (owner, 2026-11-22): eight slices (Pistols, SMGs, Rifles, Shotguns, Snipers, Heavy,
 * Energy, Melee & gadgets, clockwise from the top: number keys 1-8 in the same order), each with how many you hold
 * and its last pick; empty ones dimmed. Pointing at a slice opens its weapons on an outer arc (icon, name, ammo),
 * with the slice's last pick in line with it, so a quick flick to a slice and letting go brings that one back;
 * moving round the arc picks another. The input points it as it did the flat ring (mouse, right stick, a finger);
 * letting go switches. Only an overlay: the match keeps running, firing is held back while it's open (input.ts).
 */
export class CategoryWheel {
  readonly el: HTMLDivElement;
  private readonly ring: HTMLDivElement;
  private readonly label: HTMLDivElement;
  private readonly dot: HTMLElement;
  private readonly sliceEls: SVGPathElement[] = [];
  private readonly sliceTags: HTMLElement[] = [];
  private readonly arcs: HTMLElement[] = [];
  /** Each slice's weapons (in order) and the index of its last pick. */
  private slices: { entries: WheelEntry[]; pick: number }[] = WHEEL_CATEGORIES.map(() => ({ entries: [], pick: 0 }));
  private items: HTMLElement[][] = WHEEL_CATEGORIES.map(() => []);
  private open = -1;
  private hover: { slice: number; item: number } | null = null;
  private layoutKey = '';
  private key = '';
  /** The keys that pick each slice (Options → Controls), shown on the slices. */
  keyLabels: readonly string[] = WHEEL_CATEGORIES.map((_, i) => String(i + 1));
  onPoint?: (x: number, y: number) => void;
  onTouchPick?: () => void;
  onTouchCancel?: () => void;

  constructor(parent: HTMLElement, id = 'weapon-wheel') {
    this.el = document.createElement('div');
    this.el.id = id;
    this.el.hidden = true;
    this.ring = document.createElement('div');
    this.ring.className = 'ww-ring ww-cats';
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', '-1 -1 2 2');
    svg.setAttribute('class', 'ww-slices');
    const pt = (r: number, a: number) => `${(Math.sin(a) * r).toFixed(4)} ${(-Math.cos(a) * r).toFixed(4)}`;
    WHEEL_CATEGORIES.forEach((cat, k) => {
      const a0 = (k - 0.5) * SLICE_ANGLE + 0.012;
      const a1 = (k + 0.5) * SLICE_ANGLE - 0.012;
      const path = document.createElementNS(svgNs, 'path');
      path.setAttribute('d', `M ${pt(SLICE_OUT, a0)} A ${SLICE_OUT} ${SLICE_OUT} 0 0 1 ${pt(SLICE_OUT, a1)} L ${pt(SLICE_IN, a1)} A ${SLICE_IN} ${SLICE_IN} 0 0 0 ${pt(SLICE_IN, a0)} Z`);
      path.setAttribute('class', 'ww-slice');
      path.dataset.cat = cat;
      svg.append(path);
      this.sliceEls.push(path);
      const tag = document.createElement('div');
      tag.className = 'ww-slice-tag';
      tag.dataset.cat = cat;
      const mid = (SLICE_IN + SLICE_OUT) / 2;
      tag.style.left = `${50 + Math.sin(k * SLICE_ANGLE) * mid * 50}%`;
      tag.style.top = `${50 - Math.cos(k * SLICE_ANGLE) * mid * 50}%`;
      this.ring.append(tag);
      this.sliceTags.push(tag);
      const arc = document.createElement('div');
      arc.className = 'ww-arc';
      arc.dataset.cat = cat;
      this.ring.append(arc);
      this.arcs.push(arc);
    });
    this.ring.prepend(svg);
    this.label = document.createElement('div');
    this.label.className = 'ww-centre';
    this.dot = document.createElement('i');
    this.dot.className = 'ww-dot';
    this.ring.append(this.label, this.dot);
    this.el.append(this.ring);
    parent.append(this.el);
    // Touch (and a mouse without pointer lock): the finger points the wheel, letting go on a slice or a weapon picks it.
    const point = (e: PointerEvent) => {
      const r = this.ring.getBoundingClientRect();
      const half = r.width / 2;
      const rx = (e.clientX - r.left - half) / half;
      const ry = (e.clientY - r.top - half) / half;
      // The ring's edge is past the arc: the input's full tilt (1) is the arc's radius.
      const x = rx / ARC_R;
      const y = ry / ARC_R;
      this.aim(x, y);
      this.onPoint?.(x, y);
      return Math.hypot(rx, ry);
    };
    let outside = false;
    this.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        this.el.setPointerCapture(e.pointerId);
      } catch {
        // A pointer the browser no longer tracks: the press still points the wheel.
      }
      outside = point(e) > 1.05;
    });
    this.el.addEventListener('pointermove', (e) => {
      if (this.el.hasPointerCapture?.(e.pointerId)) point(e);
    });
    this.el.addEventListener('pointerup', (e) => {
      if (!this.el.hasPointerCapture?.(e.pointerId)) return;
      point(e);
      if (this.hover && !outside) this.onTouchPick?.();
      else this.onTouchCancel?.();
    });
  }

  get shown(): boolean {
    return !this.el.hidden;
  }

  /** Open (or refresh) the wheel with these weapons and each slice's last pick (by weapon code). */
  show(entries: WheelEntry[], picks: ReadonlyMap<WheelCategory, number> = new Map()): void {
    const key = entries.map((e) => `${e.code}:${e.ammo}:${e.empty ? 1 : 0}:${e.held ? 1 : 0}`).join(',') + `|${[...picks].join()}|${this.keyLabels.join()}`;
    if (this.shown && key === this.key) return;
    this.key = key;
    const slices = WHEEL_CATEGORIES.map(() => ({ entries: [] as WheelEntry[], pick: 0 }));
    for (const e of entries) {
      const cat = entryCategory(e);
      if (cat) slices[WHEEL_CATEGORIES.indexOf(cat)]!.entries.push(e);
    }
    slices.forEach((s, k) => {
      const want = picks.get(WHEEL_CATEGORIES[k]!);
      const at = s.entries.findIndex((e) => e.code === want);
      const held = s.entries.findIndex((e) => e.held);
      s.pick = at >= 0 ? at : held >= 0 ? held : 0;
    });
    this.slices = slices;
    const layout = slices.map((s) => `${s.entries.map((e) => e.code).join('.')}@${s.pick}`).join('/');
    if (!this.shown || layout !== this.layoutKey) {
      this.layoutKey = layout;
      this.build();
      if (!this.shown) this.open = -1;
      this.hover = null;
    }
    slices.forEach((s, k) => {
      s.entries.forEach((e, i) => {
        const it = this.items[k]![i]!;
        it.querySelector('small')!.textContent = e.ammo;
        it.classList.toggle('empty', e.empty);
        it.classList.toggle('held', e.held);
      });
      const tag = this.sliceTags[k]!;
      const pick = s.entries[s.pick];
      tag.replaceChildren();
      const kb = document.createElement('kbd');
      kb.textContent = this.keyLabels[k] ?? '';
      const name = document.createElement('b');
      name.textContent = WHEEL_CATEGORY_LABELS[WHEEL_CATEGORIES[k]!];
      const icon = pick?.weaponId ? weaponIcon(pick.weaponId, 'ww-icon') : null;
      const count = document.createElement('small');
      count.textContent = s.entries.length ? `${s.entries.length}` : '';
      tag.append(kb, ...(icon ? [icon] : []), name, count);
      const empty = !s.entries.length;
      tag.classList.toggle('empty', empty);
      this.sliceEls[k]!.classList.toggle('empty', empty);
      const held = s.entries.some((e) => e.held);
      tag.classList.toggle('held', held);
      this.sliceEls[k]!.classList.toggle('held', held);
    });
    this.el.hidden = false;
    this.paint();
  }

  /** Lay out every slice's outer arc (only the open one shows). */
  private build(): void {
    this.slices.forEach((s, k) => {
      const arc = this.arcs[k]!;
      arc.replaceChildren();
      const at = arcAngles(k, s.entries.length, s.pick);
      this.items[k] = s.entries.map((e, i) => {
        const it = document.createElement('div');
        it.className = 'ww-item';
        it.dataset.code = String(e.code);
        it.style.left = `${50 + Math.sin(at[i]!) * ARC_R * 50}%`;
        it.style.top = `${50 - Math.cos(at[i]!) * ARC_R * 50}%`;
        const icon = e.weaponId ? weaponIcon(e.weaponId, 'ww-icon') : null;
        const name = document.createElement('b');
        name.textContent = e.name;
        const ammo = document.createElement('small');
        it.append(...(icon ? [icon] : []), name, ammo);
        arc.append(it);
        return it;
      });
    });
  }

  /** Point the wheel (x right, y down; full tilt is length 1, on the outer arc). */
  aim(x: number, y: number): void {
    const hover = categoryAim(x, y, this.slices.map((s) => ({ count: s.entries.length, pick: s.pick })), this.open);
    const len = Math.hypot(x, y);
    const k = len > 1 ? 1 / len : 1;
    this.dot.style.left = `${50 + x * k * ARC_R * 50}%`;
    this.dot.style.top = `${50 + y * k * ARC_R * 50}%`;
    if (hover && hover.slice !== this.open) this.open = hover.slice;
    if (hover?.slice === this.hover?.slice && hover?.item === this.hover?.item) return;
    this.hover = hover;
    this.paint();
  }

  /** The weapon pointed at now, or null. */
  get picked(): number | null {
    return this.hover ? (this.slices[this.hover.slice]?.entries[this.hover.item]?.code ?? null) : null;
  }

  /** The slice open now (its arc showing), or null. */
  get openCategory(): WheelCategory | null {
    return this.open >= 0 ? WHEEL_CATEGORIES[this.open]! : null;
  }

  /** Close the wheel; returns the weapon it pointed at (or null). */
  hide(): number | null {
    const pick = this.picked;
    this.el.hidden = true;
    this.hover = null;
    this.open = -1;
    this.key = '';
    return pick;
  }

  dispose(): void {
    this.el.remove();
  }

  private paint(): void {
    this.arcs.forEach((arc, k) => arc.classList.toggle('open', k === this.open));
    this.sliceEls.forEach((p, k) => p.classList.toggle('on', k === this.hover?.slice));
    this.sliceTags.forEach((t, k) => t.classList.toggle('on', k === this.hover?.slice));
    this.items.forEach((list, k) => list.forEach((it, i) => it.classList.toggle('on', k === this.hover?.slice && i === this.hover.item)));
    const e = this.hover ? this.slices[this.hover.slice]?.entries[this.hover.item] : this.slices.flatMap((s) => s.entries).find((x) => x.held);
    this.label.replaceChildren();
    if (!e) return;
    const b = document.createElement('b');
    b.textContent = e.name;
    const s = document.createElement('small');
    s.textContent = e.empty ? 'Empty' : e.ammo;
    this.label.append(b, s);
  }
}
