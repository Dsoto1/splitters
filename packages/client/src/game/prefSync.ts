import { currentAccount } from '../account.ts';
import { cachedProfile, saveProfile } from '../profile.ts';
import { captionMode, parseCaptionMode, saveCaptionMode } from './captionPrefs.ts';
import { colourVision, isColourVision, saveColourVision } from './colourVision.ts';

/**
 * Small settings on the account (the profile's `prefs`; today Sound captions, game/captionPrefs.ts, and
 * Colour vision, game/colourVision.ts), brought in step
 * as a match starts (in-match code, so none of it is in the menu's first load): signed in, the account's value is
 * yours in this browser; an account with none takes this browser's (when it isn't the default). Options saves a
 * change on the account itself (frontend/frontEnd.ts); an older hub keeps it in the browser only.
 */
export function syncPrefs(): void {
  const p = currentAccount() ? cachedProfile() : null;
  if (!p) return;
  const prefs = p.prefs ?? {};
  const add: Record<string, string> = {};
  if (prefs.captions !== undefined) {
    if (parseCaptionMode(prefs.captions) !== captionMode()) saveCaptionMode(parseCaptionMode(prefs.captions), true);
  } else if (captionMode() !== 'off') add.captions = captionMode();
  if (prefs.colourVision !== undefined) {
    if (isColourVision(prefs.colourVision) && prefs.colourVision !== colourVision()) saveColourVision(prefs.colourVision);
  } else if (colourVision() !== 'default') add.colourVision = colourVision();
  if (Object.keys(add).length) void saveProfile({ prefs: { ...prefs, ...add } }).catch(() => undefined);
}
