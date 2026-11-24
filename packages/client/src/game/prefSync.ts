import { currentAccount } from '../account.ts';
import { cachedProfile, saveProfile } from '../profile.ts';
import { CAPTIONS_EVENT, captionMode, parseCaptionMode, saveCaptionMode } from './captionPrefs.ts';

/**
 * Small settings on the account (the profile's `prefs`; today Sound captions, game/captionPrefs.ts), as key bindings
 * are: signed in, the account's value is yours in this browser; an account with none takes this browser's (when it
 * isn't the default). Every change after that is saved on the account too; an older hub keeps it in the browser only.
 */
export function syncPrefs(): void {
  const who = currentAccount();
  const p = who ? cachedProfile() : null;
  if (!p) return;
  const prefs = p.prefs ?? {};
  const send = () => void saveProfile({ prefs: { ...(cachedProfile()?.prefs ?? {}), captions: captionMode() } }).catch(() => undefined);
  if (prefs.captions !== undefined) saveCaptionMode(parseCaptionMode(prefs.captions), true);
  else if (captionMode() !== 'off') send();
  if (prefSaving) return;
  prefSaving = true;
  window.addEventListener(CAPTIONS_EVENT, (e) => {
    if (!(e as CustomEvent<boolean>).detail && currentAccount()) send();
  });
}
let prefSaving = false;
