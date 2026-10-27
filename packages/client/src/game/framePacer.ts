/**
 * Frame cap pacing. Display refreshes reach the page with a millisecond or
 * two of jitter (the callback runs when the main thread gets to it), so a rule
 * like "skip this refresh if less than 1000 / cap ms passed since the last
 * frame" drops frames at random on a screen that refreshes at the cap: a late
 * frame followed by an on-time one comes "too soon" and the next drawn frame
 * is two refreshes later, a visible hitch in anything moving. Instead, frames
 * fall due on a steady 1000 / cap ms beat and any refresh within `slack` of
 * the due time draws, so a 60 Hz screen with a 60 fps cap draws every refresh
 * and a 120 Hz one every other.
 */
export class FramePacer {
  private due: number | null = null;

  /** Whether to draw on the refresh at `now` (ms) with this cap (0: no cap). */
  tick(now: number, cap: number): boolean {
    if (!cap) {
      this.due = null;
      return true;
    }
    const interval = 1000 / cap;
    const slack = Math.min(4, interval * 0.4);
    if (this.due !== null && now < this.due - slack) return false;
    // On the beat; after a stall (or the first frame) the beat starts again from this one.
    this.due = this.due === null ? now + interval : Math.max(this.due + interval, now + interval - slack);
    return true;
  }
}
