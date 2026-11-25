import { emptyProgress, mapLock, mergeProgress, progressShape, readCampaign, recordWin, sameProgress, settleProgress, type CampaignData, type CampaignEvents, type CampaignProgress } from '@tiletrigger/shared';
import campaignJson from '../../../../content/campaign.json';
import { currentAccount } from '../account.ts';
import { cachedProfile, loadProfile, saveProfile } from '../profile.ts';
import { testMode } from '../testMode.ts';

/**
 * The player's Story progress (docs/CAMPAIGN.md; shared campaign/progress.ts). The device keeps a copy
 * (`tiletrigger.campaign`), so Story works signed out and offline; signed in, the hub keeps it on the profile too, and
 * the two merge by union (STORY_CAMPAIGN answer 2). Nothing here knows about matches: main.ts reports a Story win.
 */
export const CAMPAIGN: CampaignData = readCampaign(campaignJson);

const KEY = 'tiletrigger.campaign';

function readLocal(): CampaignProgress {
  try {
    return progressShape(JSON.parse(localStorage.getItem(KEY) ?? 'null')) ?? emptyProgress();
  } catch {
    return emptyProgress();
  }
}

function writeLocal(p: CampaignProgress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage blocked: this page only.
  }
}

/** Your progress: this device's, with your account's when signed in (and its profile is loaded), settled. */
export function myStoryProgress(): CampaignProgress {
  const account = currentAccount() ? cachedProfile()?.campaign : undefined;
  return settleProgress(account ? mergeProgress(readLocal(), account) : readLocal(), CAMPAIGN).progress;
}

/** Signed in: this device and the account brought in step (each gets what the other has). Best effort. */
export async function syncStoryProgress(): Promise<void> {
  if (!currentAccount()) return;
  const profile = await loadProfile();
  if (!profile) return;
  const merged = settleProgress(mergeProgress(readLocal(), profile.campaign), CAMPAIGN).progress;
  writeLocal(merged);
  if (!sameProgress(merged, profile.campaign)) await saveProfile({ campaign: merged }).catch(() => undefined);
}

/**
 * The completion event: you won a Story match on `map` of sector (or convergence) `owner`. Saved on this device at
 * once and sent to your account when signed in; a stage already won changes nothing.
 */
export function recordStoryWin(owner: string, map: string): CampaignEvents {
  const { progress, events } = recordWin(myStoryProgress(), CAMPAIGN, owner, map);
  if (!events.completed.length) return events;
  writeLocal(progress);
  if (currentAccount()) void saveProfile({ campaign: progress }).catch(() => undefined);
  return events;
}

/**
 * Map locks are on (owner, 2026-11-25: real progression). Browser tests (`?test=1`, automated browsers) and bots
 * play every map unless a test asks for the locks (`&maplocks=1`).
 */
export function mapLocksActive(): boolean {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('maplocks') === '1') return true;
  return !testMode() && !(typeof navigator !== 'undefined' && navigator.webdriver);
}

/**
 * Why you can't host this map yet (a sector's 2nd or 3rd map not won in Story), or null. `name` gives a map's name.
 * Joining a match someone else hosts on it is never refused.
 */
export function hostLockReason(map: string, name: (key: string) => string): string | null {
  if (!mapLocksActive()) return null;
  const lock = mapLock(CAMPAIGN, myStoryProgress(), map);
  if (!lock) return null;
  return lock.previousWon ? `Win ${name(map)} in Story to unlock it (${lock.sector.name}).` : `Win ${name(lock.previous)} in Story to unlock ${name(map)} (${lock.sector.name}).`;
}
