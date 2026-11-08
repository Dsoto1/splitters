/**
 * Contextual first-time tips: a short hint the first time a situation happens in a match
 * (low ammo, a vehicle in reach, a pickup in sight, your first death, armour picked up, spawn protection), shown
 * once each, one at a time, never over the crosshair. Options → HUD turns them off or shows them all again.
 *
 * This file is the rules (what shows when, and what has been seen); coachHud.ts draws them.
 */

export type TipId = 'reload' | 'vehicle' | 'pickup' | 'armor' | 'shield' | 'death';

/** Every tip, in the order Options lists them. */
export const TIP_IDS: readonly TipId[] = ['reload', 'vehicle', 'pickup', 'armor', 'shield', 'death'];

/**
 * Each tip's words, for keyboard and mouse and for the touch controls. `[X]` marks a key or a button: the HUD
 * draws it as a key cap.
 */
export const TIP_TEXT: Record<TipId, { kb: string; touch: string }> = {
  reload: { kb: 'Low ammo: press [R] to reload', touch: 'Low ammo: tap [Reload]' },
  vehicle: { kb: 'Press [E] to get in. [E] again gets out', touch: 'Tap [Use] to get in, and again to get out' },
  pickup: { kb: 'Walk over pickups to take them: weapons, ammo, health and armour', touch: 'Walk over pickups to take them: weapons, ammo, health and armour' },
  armor: { kb: 'Armour (the blue bar) takes most of the damage before your health does', touch: 'Armour (the blue bar) takes most of the damage before your health does' },
  shield: { kb: "Spawn protection: you can't be hurt for a few seconds. Firing ends it", touch: "Spawn protection: you can't be hurt for a few seconds. Firing ends it" },
  death: { kb: 'You respawn in a moment. Meanwhile [←] [→] watch other players and [Space] switches the camera', touch: 'You respawn in a moment. Meanwhile [◀] [▶] watch other players and [Camera] switches the view' },
};

/** How long a tip shows (s), the quiet gap before the next one (s), and how long a waiting tip stays worth showing (s). */
export const TIP_SECONDS = 6;
export const TIP_GAP = 1.5;
export const TIP_STALE = 12;

/** What is kept between visits: tips switched off, and the ones already shown. */
export interface TipState {
  off: boolean;
  seen: TipId[];
}

const KEY = 'tiletrigger.tips';

export function loadTipState(): TipState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<TipState> | null;
    return { off: raw?.off === true, seen: Array.isArray(raw?.seen) ? raw.seen.filter((t): t is TipId => TIP_IDS.includes(t as TipId)) : [] };
  } catch {
    return { off: false, seen: [] };
  }
}

export function saveTipState(s: TipState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private windows: the tips are remembered for this page only.
  }
}

/** Options → HUD: tips on or off (seen ones stay seen). */
export function setTipsOn(on: boolean): void {
  saveTipState({ ...loadTipState(), off: !on });
}

/** Options → HUD → Show tips again: every tip shows once more (and tips are switched on). */
export function resetTips(): void {
  saveTipState({ off: false, seen: [] });
}

/**
 * The tips of one match: `trigger` says a situation happened, `update` (every frame, seconds) says which tip
 * shows. A tip shows once ever (seen is saved as it shows), one at a time with a short gap between them; a tip
 * that waited too long behind another is dropped unseen (its moment has passed: it shows the next time).
 */
export class TipBook {
  private state: TipState;
  private queue: { id: TipId; at: number }[] = [];
  private shown: { id: TipId; until: number } | null = null;
  private quietUntil = -Infinity;

  constructor(
    private readonly persist: { load(): TipState; save(s: TipState): void } = { load: loadTipState, save: saveTipState },
  ) {
    this.state = persist.load();
  }

  get enabled(): boolean {
    return !this.state.off;
  }

  /** Seen (shown once already, in this browser). */
  seen(id: TipId): boolean {
    return this.state.seen.includes(id);
  }

  /** The tip on screen, or null. */
  get current(): TipId | null {
    return this.shown?.id ?? null;
  }

  /** A situation happened at `now` (s): its tip waits to show, unless tips are off, it was seen, or it already waits. */
  trigger(id: TipId, now: number): void {
    if (!this.enabled || this.seen(id) || this.shown?.id === id || this.queue.some((q) => q.id === id)) return;
    this.queue.push({ id, at: now });
  }

  /** The tip to show at `now` (s): the one showing, or the next waiting one once the gap has passed. */
  update(now: number): TipId | null {
    if (this.shown && now >= this.shown.until) {
      this.shown = null;
      this.quietUntil = now + TIP_GAP;
    }
    this.queue = this.queue.filter((q) => now - q.at <= TIP_STALE);
    if (!this.shown && now >= this.quietUntil && this.enabled) {
      const next = this.queue.shift();
      if (next) {
        this.shown = { id: next.id, until: now + TIP_SECONDS };
        this.state = { ...this.state, seen: [...this.state.seen, next.id] };
        this.persist.save(this.state);
      }
    }
    return this.current;
  }

  /** Hide the tip showing now (it stays seen). */
  dismiss(now: number): void {
    if (!this.shown) return;
    this.shown = null;
    this.quietUntil = now + TIP_GAP;
  }
}
