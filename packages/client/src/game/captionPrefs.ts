/**
 * Sound captions (Options → Accessibility; owner, 2026-11-19, "A"; docs/AUDIO.md, "Sound captions"): important sounds
 * written on screen ("Gunfire, left", "Grenade!", "Footsteps, behind") for hard-of-hearing players and phone play with
 * the sound off. Off (the default), On, or On with direction ('dir'). Kept in this browser and, signed in, on the
 * account (game/prefSync.ts; Options saves there too). The captions themselves are in-match code (soundCaptions.ts), out of the menu's
 * bundle, so this file stays small.
 */

export const CAPTION_MODES = ['off', 'on', 'dir'] as const;
export type CaptionMode = (typeof CAPTION_MODES)[number];

const KEY = 'tiletrigger.captions';
/**
 * Fired on window when the setting changes (a running match applies it at once); `detail` is true when the value came
 * from the account (careerStats.ts doesn't send it back).
 */
export const CAPTIONS_EVENT = 'tiletrigger:captions';

export const parseCaptionMode = (v: unknown): CaptionMode => CAPTION_MODES.find((m) => m === v) ?? 'off';

/**
 * The setting now, read from storage each time (it is read only when a match starts or the setting changes; Options
 * writes the key itself: frontend/frontEnd.ts).
 */
export function captionMode(): CaptionMode {
  try {
    return parseCaptionMode(localStorage.getItem(KEY));
  } catch {
    return 'off';
  }
}

/** Save the setting here; `fromAccount` when it came from the account (game/prefSync.ts doesn't send it back). */
export function saveCaptionMode(m: CaptionMode, fromAccount = false): void {
  try {
    localStorage.setItem(KEY, parseCaptionMode(m));
  } catch {
    // Private windows: not kept.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CAPTIONS_EVENT, { detail: fromAccount }));
}
