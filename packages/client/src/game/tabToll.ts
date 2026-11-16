/**
 * "The tab is slowing" (docs/PERF_MAPMAKER_TRACE_2026-11-15.md, fix 3d). A tab worn down by a long session pays a
 * fixed toll each frame outside our script (the owner's recordings: 11 to 12.5 ms a frame in the old tab, under 1 ms
 * in a fresh one on the same Test), which halves the frame rate. This watches for it cheaply, from two clock reads a
 * frame: the time between frames less the time our frame callback took, counted only on a frame that came later than
 * the screen's refresh and our own work explain. When that stays over 8 ms a frame for 30 s, in a tab that earlier ran
 * clean, the match says once, calmly, that a reload helps (no flash: a plain message line; Reduce flashing is moot).
 */

/** Over this (ms a frame, on late frames) is the toll. */
export const TOLL_MS = 8;
/** For this many seconds in a row. */
export const TOLL_SECONDS = 30;
/** A second under this counts as running clean. */
const CLEAN_MS = 4;
/** Seconds of clean running this page must have had first (a slow machine from the start is not a worn tab). */
const CLEAN_SECONDS_FIRST = 20;

// Page-wide, across matches: the screen's refresh (the shortest steady frame seen), seconds run clean, whether the note was given.
let refreshMs = 1000 / 60;
let cleanSeconds = 0;
let told = false;

export const TAB_SLOWING_TEXT = 'This tab is slowing down after a long session. Reloading the page usually brings the speed back (MapMaker reopens your map).';

export class TabToll {
  private lastStart = 0;
  private dts: number[] = [];
  private outside = 0;
  private frames = 0;
  private secondAt = 0;
  private overSeconds = 0;
  /** The last second's figure: outside our script, ms a frame (late frames count, others are 0). */
  lastSecondMs = 0;
  /** Seconds in a row over TOLL_MS. */
  get streak(): number {
    return this.overSeconds;
  }

  /**
   * One frame: our callback ran from `start` to `end` (performance.now). `capFps` is the frame cap (0 for none).
   * Returns true the one time the note should be shown.
   */
  frame(start: number, end: number, capFps: number, hidden: boolean): boolean {
    const prev = this.lastStart;
    this.lastStart = start;
    if (!prev) {
      this.secondAt = start;
      return false;
    }
    const dt = start - prev;
    if (hidden || dt > 1000) {
      // A hidden tab (or a pause of the page) says nothing about the toll: start the second again.
      this.reset(start);
      return false;
    }
    const busy = end - start;
    this.dts.push(dt);
    // A frame is due at the next refresh after our own work (at the cap's pace with one); later than that is the toll.
    const period = Math.max(refreshMs, capFps > 0 ? 1000 / capFps : 0);
    const due = Math.max(1, Math.ceil(busy / period - 0.05)) * period;
    if (dt > due * 1.25) this.outside += Math.max(0, dt - busy);
    this.frames++;
    if (start - this.secondAt < 1000) return false;
    return this.second(start);
  }

  private reset(now: number): void {
    this.secondAt = now;
    this.dts = [];
    this.outside = 0;
    this.frames = 0;
  }

  private second(now: number): boolean {
    const sorted = this.dts.sort((a, b) => a - b);
    // The screen's refresh: the shortest steady frame (a tenth of the second's frames were this quick), at least 4 ms.
    const p10 = sorted[Math.floor(sorted.length * 0.1)];
    if (p10 !== undefined && sorted.length >= 10) refreshMs = Math.max(4, Math.min(refreshMs, p10));
    this.lastSecondMs = this.frames ? this.outside / this.frames : 0;
    this.reset(now);
    if (this.lastSecondMs < CLEAN_MS) cleanSeconds++;
    this.overSeconds = this.lastSecondMs > TOLL_MS ? this.overSeconds + 1 : 0;
    if (told || this.overSeconds < TOLL_SECONDS || cleanSeconds < CLEAN_SECONDS_FIRST) return false;
    told = true;
    return true;
  }
}

/** Whether the note has been given in this page (the recording notes it). */
export const tabSlowingTold = (): boolean => told;
