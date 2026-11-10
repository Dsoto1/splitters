/**
 * How many lines the kill feed keeps. Desktop and tall screens: 5. A phone sideways (touch, at most SHORT_SCREEN
 * CSS px tall): 3, so the feed never reaches the Weapons button or the ammo panel above Reload (docs/MOBILE_AUDIT.md,
 * proposal 12).
 */
export const FEED_LINES = 5;
export const SHORT_FEED_LINES = 3;
export const SHORT_SCREEN = 480;

export function feedLines(touch: boolean, height: number): number {
  return touch && height <= SHORT_SCREEN ? SHORT_FEED_LINES : FEED_LINES;
}
