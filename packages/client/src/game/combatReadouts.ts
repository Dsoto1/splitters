/**
 * Gunplay readouts and their options (docs/GUNPLAY_AUDIT.md, candidates 3, 5 and 6; owner-approved 2026-11-08):
 * - **Auto-reload** (Options → Controls, on by default): an empty magazine starts its reload by itself
 *   (BUTTON_AUTO_RELOAD; the host and prediction run it, gunplay.ts autoReloadDue).
 * - **Damage numbers** (Options → HUD, off by default; spec §21 "only if enabled"): what each of your hits did floats
 *   up from the target for a moment: white on a body, gold on a head hit, cyan where armour took part, a bolder
 *   number for the hit that killed, and grey on a board, crate or barrel (what that round would do to a body there).
 *   They fade in and out without flashing (Reduce flashing: nothing pops or blinks).
 * - **Spray pattern** (Options → HUD, off by default): a small panel plots where your last burst went, round by round,
 *   against a ring the width of a body at 25 m, with the group's spread and how long the aim took to settle. The
 *   Training Range's recoil wall shows the marks; this shows the pattern from any wall.
 */
import type { Vec3 } from '@tiletrigger/shared';

const AUTO_RELOAD_KEY = 'tiletrigger.autoReload';
const DAMAGE_NUMBERS_KEY = 'tiletrigger.damageNumbers';
const SPRAY_KEY = 'tiletrigger.sprayReadout';

function read(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function write(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    // Lasts for this page.
  }
}

/** Auto-reload: on unless switched off. Read each input (cheap), so a change applies at once. */
export const autoReloadOn = (): boolean => read(AUTO_RELOAD_KEY, true);
export const saveAutoReload = (on: boolean): void => write(AUTO_RELOAD_KEY, on);
/** Damage numbers: off unless switched on. */
export const damageNumbersOn = (): boolean => read(DAMAGE_NUMBERS_KEY, false);
export const saveDamageNumbers = (on: boolean): void => write(DAMAGE_NUMBERS_KEY, on);
/** The spray pattern panel: off unless switched on. */
export const sprayReadoutOn = (): boolean => read(SPRAY_KEY, false);
export const saveSprayReadout = (on: boolean): void => write(SPRAY_KEY, on);

/** Damage-number flags (PrivateState `dd`). */
export const DEALT_HEAD = 1;
export const DEALT_ARMOUR = 2;
export const DEALT_KILL = 4;
export const DEALT_TARGET = 8;

/** How long a number shows (ms) and how many at once. */
const NUMBER_MS = 900;
const MAX_NUMBERS = 24;

interface FloatingNumber {
  el: HTMLElement;
  at: Vec3;
  born: number;
}

/** Floating damage numbers over what you hit (HUD `#damage-numbers`). */
export class DamageNumbers {
  private readonly live: FloatingNumber[] = [];
  /** The newest host tick shown (entries repeat over a few snapshots). */
  private lastTick = -1;

  constructor(private readonly root: HTMLElement) {}

  /** A snapshot's entries: shows the new ones (when the option is on). */
  take(entries: readonly [number, number, number, number, number, number][] | undefined, now: number): void {
    if (!entries?.length) return;
    // The host's ticks went back (a new match, a new host): start again.
    if (entries[0]![0] < this.lastTick - 120) this.lastTick = -1;
    let newest = this.lastTick;
    const on = damageNumbersOn();
    for (const [tick, amount, flags, x, y, z] of entries) {
      if (tick <= this.lastTick) continue;
      newest = Math.max(newest, tick);
      if (on && amount > 0) this.add(amount, flags, { x, y, z }, now);
    }
    this.lastTick = newest;
  }

  /** A new match or host: its ticks start again. */
  reset(): void {
    this.lastTick = -1;
    for (const n of this.live) n.el.remove();
    this.live.length = 0;
  }

  private add(amount: number, flags: number, at: Vec3, now: number): void {
    const el = document.createElement('span');
    el.className = 'dmg-num';
    if (flags & DEALT_TARGET) el.classList.add('target');
    else {
      if (flags & DEALT_HEAD) el.classList.add('head');
      if (flags & DEALT_ARMOUR) el.classList.add('armour');
      if (flags & DEALT_KILL) el.classList.add('kill');
    }
    el.textContent = String(Math.round(amount));
    // Several numbers on one target in a burst: each starts a little to the side of the last.
    const sameSpot = this.live.filter((n) => Math.hypot(n.at.x - at.x, n.at.y - at.y, n.at.z - at.z) < 0.6).length;
    el.style.setProperty('--dx', `${[0, 14, -14, 28, -28][sameSpot % 5]}px`);
    // Hidden until the next frame puts it over the target (update).
    el.style.visibility = 'hidden';
    this.root.append(el);
    this.live.push({ el, at, born: now });
    while (this.live.length > MAX_NUMBERS) this.live.shift()!.el.remove();
  }

  /** Each frame: follow the targets on screen, drop the finished ones. */
  update(project: (p: Vec3) => { x: number; y: number } | null, now: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const n = this.live[i]!;
      if (now - n.born > NUMBER_MS) {
        n.el.remove();
        this.live.splice(i, 1);
        continue;
      }
      const s = project(n.at);
      if (!s) {
        n.el.style.visibility = 'hidden';
        continue;
      }
      n.el.style.visibility = '';
      n.el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px)`;
    }
  }

  /** Tests: the numbers showing now. */
  shown(): string[] {
    return this.live.map((n) => `${n.el.textContent}${n.el.classList.contains('head') ? 'h' : ''}${n.el.classList.contains('armour') ? 'a' : ''}${n.el.classList.contains('kill') ? 'k' : ''}${n.el.classList.contains('target') ? 't' : ''}`);
  }
}

/** A burst ends when the trigger has rested this long (ms). */
const BURST_GAP_MS = 450;
/** The aim has settled once its recoil offset is under this (radians). */
const SETTLED = 0.0005;
/** The panel's half-width in milliradians. */
const PANEL_MRAD = 60;
/** A body's half-width at 25 m, in milliradians: the ring drawn on the panel. */
const BODY_25M_MRAD = (0.3 / 25) * 1000;

/** The spray-pattern panel (HUD `#spray-readout`). */
export class SprayReadout {
  private points: [number, number][] = [];
  private origin: { yaw: number; pitch: number } | null = null;
  private lastShot = -Infinity;
  private settledIn: number | null = null;
  private weapon = '';
  private readonly svg: SVGSVGElement;
  private readonly dots: SVGGElement;
  private readonly label: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    const ns = 'http://www.w3.org/2000/svg';
    this.svg = document.createElementNS(ns, 'svg');
    this.svg.setAttribute('viewBox', `${-PANEL_MRAD} ${-PANEL_MRAD} ${PANEL_MRAD * 2} ${PANEL_MRAD * 2}`);
    const ring = document.createElementNS(ns, 'circle');
    ring.setAttribute('r', String(BODY_25M_MRAD));
    ring.setAttribute('class', 'ring');
    const cross = document.createElementNS(ns, 'path');
    cross.setAttribute('d', `M${-PANEL_MRAD} 0H${PANEL_MRAD}M0 ${-PANEL_MRAD}V${PANEL_MRAD}`);
    cross.setAttribute('class', 'axes');
    this.dots = document.createElementNS(ns, 'g');
    this.svg.append(cross, ring, this.dots);
    this.label = document.createElement('small');
    const title = document.createElement('b');
    title.textContent = 'Spray pattern';
    root.replaceChildren(title, this.svg, this.label);
  }

  /** A round of yours left along `dir` (a single-round hitscan gun). */
  shot(weapon: string, dir: Vec3, now: number): void {
    const yaw = Math.atan2(dir.x, dir.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
    if (now - this.lastShot > BURST_GAP_MS || weapon !== this.weapon || !this.origin) {
      this.points = [];
      this.origin = { yaw, pitch };
      this.weapon = weapon;
    }
    let dy = yaw - this.origin.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    // Screen-like: right is right, up is up (SVG y grows down).
    this.points.push([-dy * 1000, -(pitch - this.origin.pitch) * 1000]);
    if (this.points.length > 60) this.points.shift();
    this.lastShot = now;
    this.settledIn = null;
  }

  /** Each frame: the panel shows while the option is on and you have shot; times the settle from your gun's recoil offset. */
  update(recoil: { rp: number; ry: number }, now: number): void {
    const on = sprayReadoutOn() && this.points.length > 0;
    this.root.hidden = !on;
    if (!on) return;
    if (this.settledIn === null && now - this.lastShot > 0 && Math.abs(recoil.rp) < SETTLED && Math.abs(recoil.ry) < SETTLED) this.settledIn = now - this.lastShot;
    const ns = 'http://www.w3.org/2000/svg';
    if (this.dots.childElementCount !== this.points.length) {
      this.dots.replaceChildren(
        ...this.points.map(([x, y], i) => {
          const c = document.createElementNS(ns, 'circle');
          c.setAttribute('cx', x.toFixed(2));
          c.setAttribute('cy', y.toFixed(2));
          c.setAttribute('r', i === 0 ? '2.6' : '1.8');
          c.setAttribute('class', i === 0 ? 'first' : '');
          return c;
        }),
      );
    }
    const n = this.points.length;
    const mx = this.points.reduce((s, p) => s + p[0], 0) / n;
    const my = this.points.reduce((s, p) => s + p[1], 0) / n;
    const spread = Math.max(...this.points.map(([x, y]) => Math.hypot(x - mx, y - my)));
    const settle = this.settledIn === null ? (now - this.lastShot < 2000 ? '…' : '–') : `${Math.round(this.settledIn / 10) * 10} ms`;
    this.label.textContent = `${n} round${n === 1 ? '' : 's'} · group ${spread.toFixed(1)} mrad · settles ${settle}`;
  }

  /** Tests: the burst as plotted (milliradians). */
  pattern(): [number, number][] {
    return this.points.map(([x, y]) => [x, y]);
  }
}
