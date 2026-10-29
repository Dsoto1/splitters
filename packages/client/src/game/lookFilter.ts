/**
 * Mouse-look deltas, cleaned up before they turn the view.
 *
 * Browsers disagree about locked-pointer movement, and Safari in particular:
 * - WebKit coalesces mouse moves to the rendering update, and the dispatched
 *   event's movementX/Y can be only the last sub-move's, not their sum (so the
 *   faster you move, the more is lost: it feels slow and "sticky"). Where the
 *   browser exposes the sub-moves (`getCoalescedEvents`, Safari 18.2+), their
 *   sum is used when it is larger.
 * - The first event after the lock (and after re-focusing) can carry the jump
 *   from where the cursor was to the lock point: hundreds of pixels at once.
 * - Single outliers (a sudden huge delta, sometimes reversed, between ordinary
 *   ones) show up in several browsers; they are dropped.
 * - The same move can be delivered twice (same timestamp, same delta).
 * Deltas are summed here and taken once per rendered frame, so the look speed
 * doesn't depend on how many events arrive per frame.
 *
 * Pure (no DOM): tests feed it synthetic event streams.
 */

export interface LookMove {
  /** movementX / movementY of the dispatched event, CSS pixels. */
  dx: number;
  dy: number;
  /** Event timestamp, ms. */
  t: number;
  /** The coalesced sub-moves, if the browser gives them. */
  coalesced?: readonly { dx: number; dy: number }[];
}

export interface LookStats {
  events: number;
  /** Events whose coalesced sub-moves added up to more than the event itself said. */
  resummed: number;
  /** Dropped: the jump after the lock, outliers, duplicates. */
  settle: number;
  spikes: number;
  duplicates: number;
}

/** No single event moves more than this (CSS px) from rest without being suspect. */
export const SPIKE_MIN = 300;
/** …or more than this many times the recent typical move. */
export const SPIKE_RATIO = 8;
/** After the lock, large moves within this window (ms) are the cursor's jump, not the player's. */
export const SETTLE_MS = 100;
/** "Large" for the settle window, CSS px. */
export const SETTLE_MAX = 60;
/** Movement nobody takes for this long (ms) is dropped rather than applied in one lump later. */
export const STALE_MS = 250;

export class LookFilter {
  private x = 0;
  private y = 0;
  /** Running typical move size (an average of recent magnitudes). */
  private typical = 0;
  private lockedAt = -Infinity;
  /** When the movement waiting for take() began (NaN: none waiting). */
  private pendingSince = NaN;
  private last: { dx: number; dy: number; t: number } | null = null;
  readonly stats: LookStats = { events: 0, resummed: 0, settle: 0, spikes: 0, duplicates: 0 };

  /**
   * @param scale per-browser normalisation, multiplied into every delta
   *   (e.g. for a browser that reports smaller movement than the others).
   */
  constructor(public scale = 1) {}

  /** The pointer was (re)locked at time `t`: forget history, ignore the jump that follows. */
  reset(t: number): void {
    this.x = this.y = 0;
    this.typical = 0;
    this.lockedAt = t;
    this.last = null;
    this.pendingSince = NaN;
  }

  push(m: LookMove): void {
    this.stats.events++;
    let { dx, dy } = m;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    // Coalesced sub-moves: per spec the event carries their sum. Where it doesn't
    // (WebKit), the sum is larger; where the sub-moves are zeroed (a Firefox bug
    // under pointer lock), the event is larger. Take the larger, per axis.
    if (m.coalesced && m.coalesced.length > 1) {
      let sx = 0;
      let sy = 0;
      for (const c of m.coalesced) {
        sx += Number.isFinite(c.dx) ? c.dx : 0;
        sy += Number.isFinite(c.dy) ? c.dy : 0;
      }
      if (Math.abs(sx) > Math.abs(dx) + 0.01 || Math.abs(sy) > Math.abs(dy) + 0.01) this.stats.resummed++;
      if (Math.abs(sx) > Math.abs(dx)) dx = sx;
      if (Math.abs(sy) > Math.abs(dy)) dy = sy;
    }
    if (dx === 0 && dy === 0) return;
    const mag = Math.hypot(dx, dy);
    // The cursor's jump to the lock point.
    if (m.t - this.lockedAt < SETTLE_MS && mag > SETTLE_MAX) {
      this.stats.settle++;
      return;
    }
    // The same move twice.
    const last = this.last;
    if (last && m.t === last.t && dx === last.dx && dy === last.dy) {
      this.stats.duplicates++;
      return;
    }
    // A lone outlier: far bigger than anything recent. A real flick builds up
    // over several events, raising `typical` as it goes, so it passes.
    if (mag > Math.max(SPIKE_MIN, this.typical * SPIKE_RATIO)) {
      this.stats.spikes++;
      // Still let it nudge `typical`, so a sustained very fast swipe gets through after a frame.
      this.typical += (Math.min(mag, SPIKE_MIN) - this.typical) * 0.5;
      return;
    }
    this.typical += (mag - this.typical) * 0.3;
    this.last = { dx, dy, t: m.t };
    // Nobody took the movement for a while (no frames: a hidden tab, no player in the match): it's stale.
    if (m.t - this.pendingSince > STALE_MS) this.x = this.y = 0;
    if (this.x === 0 && this.y === 0) this.pendingSince = m.t;
    this.x += dx * this.scale;
    this.y += dy * this.scale;
  }

  /** The movement since the last call, in normalised pixels. */
  take(): { dx: number; dy: number } {
    const out = { dx: this.x, dy: this.y };
    this.x = this.y = 0;
    this.pendingSince = NaN;
    return out;
  }
}

/**
 * Sensitivity while zoomed: the same on-screen movement per inch of mouse as
 * hip fire, measured at the crosshair ("monitor distance 0", the usual 1:1
 * zoom). `fov` and `baseFov` are the camera's (vertical) FOVs in radians; the
 * player's zoom multiplier comes in fully once the view is at least as zoomed
 * as aiming down the sights (`adsFov`), easing in before that.
 */
export function zoomLookScale(fov: number, baseFov: number, adsFov: number, multiplier = 1): number {
  if (!(fov > 0) || fov >= baseFov) return 1;
  const ratio = Math.tan(fov / 2) / Math.tan(baseFov / 2);
  const k = Math.min(1, (baseFov - fov) / Math.max(1e-6, baseFov - adsFov));
  return ratio * (1 + (multiplier - 1) * k);
}

/**
 * Per-browser normalisation of locked-pointer movement. Safari without the
 * coalesced sub-moves loses movement to coalescing (see above) and reported
 * about half of Chrome's; with them, it reports CSS pixels like everyone else.
 */
export function browserLookScale(userAgent: string, hasCoalesced: boolean): number {
  const safari = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(userAgent);
  return safari && !hasCoalesced ? 2 : 1;
}
