/**
 * Sound captions (Options → Accessibility; owner, 2026-11-19, "A"; docs/AUDIO.md, "Sound captions"): important sounds
 * written on screen ("Gunfire, left", "Grenade!", "Footsteps, behind") for hard-of-hearing players and phone play with
 * the sound off. Off (the default), On, or On with direction. Kept in this browser and, signed in, on the account
 * (careerStats.ts syncPrefs). The captions themselves are in-match code (soundCaptions.ts), out of the menu's bundle.
 */

export const CAPTION_MODES = ['off', 'on', 'dir'] as const;
export type CaptionMode = (typeof CAPTION_MODES)[number];
export const CAPTION_LABELS: Readonly<Record<CaptionMode, string>> = { off: 'Off', on: 'On', dir: 'On, with direction' };

const KEY = 'tiletrigger.captions';
/** Fired on window when the setting changes (a running match applies it at once). */
export const CAPTIONS_EVENT = 'tiletrigger:captions';

export const parseCaptionMode = (v: unknown): CaptionMode => CAPTION_MODES.find((m) => m === v) ?? 'off';

let current: CaptionMode | null = null;
const listeners = new Set<(m: CaptionMode) => void>();

/** The setting now (read from storage once). */
export function captionMode(): CaptionMode {
  if (current) return current;
  try {
    current = parseCaptionMode(localStorage.getItem(KEY));
  } catch {
    current = 'off';
  }
  return current;
}

/** Save the setting here; `fromAccount` when it came from the account (not sent back to it). */
export function saveCaptionMode(m: CaptionMode, fromAccount = false): void {
  const next = parseCaptionMode(m);
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Lasts for this page.
  }
  if (!fromAccount) for (const f of listeners) f(next);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CAPTIONS_EVENT));
}

/** Call `f` when the player changes the setting (not when the account's value is applied); returns a stop. */
export function onCaptionModeChange(f: (m: CaptionMode) => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** Tests: forget the value read. */
export function resetCaptionModeCache(): void {
  current = null;
}
