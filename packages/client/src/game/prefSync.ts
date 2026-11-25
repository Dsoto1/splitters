import { currentAccount } from '../account.ts';
import { cachedProfile, saveProfile } from '../profile.ts';
import { captionMode, parseCaptionMode, saveCaptionMode } from './captionPrefs.ts';

/**
 * Small settings on the account (the profile's `prefs`; today Sound captions, game/captionPrefs.ts), brought in step
 * as a match starts (in-match code, so none of it is in the menu's first load): signed in, the account's value is
 * yours in this browser; an account with none takes this browser's (when it isn't the default). Options saves a
 * change on the account itself (frontend/frontEnd.ts); an older hub keeps it in the browser only.
 */
export function syncPrefs(): void {
  const p = currentAccount() ? cachedProfile() : null;
  if (!p) return;
  const prefs = p.prefs ?? {};
  if (prefs.captions !== undefined) {
    if (parseCaptionMode(prefs.captions) !== captionMode()) saveCaptionMode(parseCaptionMode(prefs.captions), true);
  } else if (captionMode() !== 'off') void saveProfile({ prefs: { ...prefs, captions: captionMode() } }).catch(() => undefined);
}
