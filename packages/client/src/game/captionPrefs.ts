/**
 * Sound captions (Options → Accessibility; owner, 2026-11-19, "A"; docs/AUDIO.md, "Sound captions"): important sounds
 * written on screen ("Gunfire, left", "Grenade!", "Footsteps, behind") for hard-of-hearing players and phone play with
 * the sound off. Off (the default), On, or On with direction ('dir'). Kept in this browser and, signed in, on the
 * account (careerStats.ts syncPrefs). The captions themselves are in-match code (soundCaptions.ts), out of the menu's
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

let current: CaptionMode | null = null;

/** The setting now (read from storage once). */
export function captionMode(): CaptionMode {
  try {
    return (current ??= parseCaptionMode(localStorage.getItem(KEY)));
  } catch {
    return (current = 'off');
  }
}

/** Save the setting here; `fromAccount` when it came from the account. */
export function saveCaptionMode(m: CaptionMode, fromAccount = false): void {
  current = parseCaptionMode(m);
  try {
    localStorage.setItem(KEY, current);
  } catch {
    // Lasts for this page.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CAPTIONS_EVENT, { detail: fromAccount }));
}

/** Tests: forget the value read. */
export function resetCaptionModeCache(): void {
  current = null;
}
