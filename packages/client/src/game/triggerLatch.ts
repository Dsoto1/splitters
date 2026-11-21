import { BUTTON_ALT, BUTTON_FIRE, BUTTON_SPRINT, TICK_DT } from '@tiletrigger/shared';

/**
 * Ticks after the trigger is let go before a held sprint (Shift, or the pad's L3) takes over again: 0.5 s, longer
 * than the gaps between taps of a gun fired in earnest; a slow gun (a pump, a bolt) keeps it its cycle and a quarter
 * second more, so the next round is never kept waiting by a sprint between them.
 */
export const SPRINT_AFTER_FIRE_TICKS = 30;
export const SPRINT_AFTER_CYCLE_TICKS = 15;

/**
 * Your trigger and your sprint, tick by tick, before the input goes to the host (owner, 2026-11-18: "gunshots are
 * lagging now… chugging, not natural like before"). Leaving a sprint holds the trigger for the gun's sprint-exit time
 * (GUNPLAY_SPEC §27, on the raise timer, host and prediction alike). With sprint held, every gap between taps ran
 * the sprint again, so every tap paid that time (a pistol 50 ms, an SMG 83 ms, a rifle 133 ms) and a click shorter
 * than it fired nothing at all. So:
 * - the trigger keeps the sprint off for SPRINT_AFTER_FIRE_TICKS after it is let go: taps and bursts fire at once;
 *   only a real sprint's first shot waits the exit time, as designed (a slow gun: its cycle and a quarter second);
 * - a pull made while the gun is coming up (out of a sprint, or any raise) is kept held until the gun is up, so a
 *   quick click out of a sprint fires the moment it can instead of being lost.
 * Only the buttons sent change (the host and prediction run the same rules on them), so it works on every host.
 *
 * Dual wielding (`paired`: a pair in hand): the second trigger (BUTTON_ALT, the second gun's) is a trigger like the
 * first: it keeps the sprint off the same way and a pull of it while the pair comes up is kept, by itself.
 */
export class TriggerLatch {
  /** Ticks left before a held sprint counts again. */
  private rest = 0;
  /** A pull made while the gun was coming up, held until it is up. */
  private buffered = false;
  /** The same for the second trigger of a pair. */
  private buffered2 = false;

  /**
   * One tick's buttons, as sent. `raising`: the gun isn't up yet (LocalPlayer.raiseTicks > 0); `sprinting`: this
   * tick starts in a sprint (a pull now ends it and starts the exit time); `cycleTicks`: the held gun's fire interval;
   * `paired`: a pair is in hand, so BUTTON_ALT is the second gun's trigger.
   */
  apply(buttons: number, raising: boolean, sprinting: boolean, cycleTicks = 0, paired = false): number {
    let b = buttons;
    if (b & BUTTON_FIRE && (raising || sprinting)) this.buffered = true;
    if (this.buffered) {
      b |= BUTTON_FIRE;
      // The gun is up this tick: the held pull fires now (the prediction counts the raise down first). A pull that
      // ends a sprint keeps it: the exit time starts this tick.
      if (!raising && !sprinting) this.buffered = false;
    }
    if (!paired) this.buffered2 = false;
    else {
      if (b & BUTTON_ALT && (raising || sprinting)) this.buffered2 = true;
      if (this.buffered2) {
        b |= BUTTON_ALT;
        if (!raising && !sprinting) this.buffered2 = false;
      }
    }
    if (b & BUTTON_FIRE || (paired && b & BUTTON_ALT)) this.rest = Math.max(SPRINT_AFTER_FIRE_TICKS, cycleTicks + SPRINT_AFTER_CYCLE_TICKS);
    else if (this.rest > 0) this.rest--;
    if (this.rest > 0) b &= ~BUTTON_SPRINT;
    return b;
  }

  /** A new life, a seat or a match: nothing carried over. */
  reset(): void {
    this.rest = 0;
    this.buffered = this.buffered2 = false;
  }
}

/** The most a shot's sound waits to keep its tick's spacing (s). */
export const SHOT_SPREAD_MAX = 0.05;

/**
 * Seconds to hold your own shot's sound so a slow frame's shots keep their ticks' spacing (owner, 2026-11-18,
 * "chugging", a 64-player match): the game runs its 60 ticks a second in each frame's catch-up loop, so at 25 frames a
 * second a 600-round-a-minute rifle's reports came in clumps on the frames (gaps of 80 and 120 ms, or two at once)
 * instead of every 100 ms. Each tick's sound is put back where its tick falls: `behind` (the loop's time still owed
 * after this tick, s) earlier than the frame's latest, against a budget of the smoothed frame time beyond a 60 Hz
 * frame, at most SHOT_SPREAD_MAX. At 60 frames a second nothing waits; slower, the reports are even at the cost of at
 * most that budget.
 */
export function shotDelay(behind: number, frameTime: number): number {
  const budget = Math.min(SHOT_SPREAD_MAX, Math.max(0, frameTime - TICK_DT));
  return Math.max(0, budget - Math.max(0, behind));
}
