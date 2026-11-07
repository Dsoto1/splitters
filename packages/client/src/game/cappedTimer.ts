/**
 * A countdown over drawn frames, each frame's step capped: a long frame (a hitch while a new body is built, a slow
 * machine) counts as `cap` seconds, so what it times (the Roulette spawn card) isn't used up before anyone sees it.
 */
export class CappedTimer {
  /** Seconds left; 0 or less: done. */
  left = 0;
  /** The last frame's time (ms), or null: none yet. */
  private last: number | null = null;
  constructor(private readonly cap = 0.1) {}

  /** Start (or restart) it: `seconds` of drawn frames from the next frame on. */
  start(seconds: number): void {
    this.left = seconds;
  }

  /** Each frame (`now` in ms); `run` false: the time passes without counting (held). True while time is left. */
  frame(now: number, run = true): boolean {
    const step = this.last === null ? 0 : Math.min(this.cap, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (run && this.left > 0) this.left -= step;
    return this.left > 0;
  }
}
