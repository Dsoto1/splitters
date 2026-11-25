import type { CampaignProgress } from './progress.ts';

/**
 * Character locks (docs/CAMPAIGN.md, "Character locks"; STORY_CAMPAIGN answer 3: locked everywhere until unlocked,
 * new players start with the Chrono Crew, bots still use every character).
 *
 * **Off for now.** Non-campaign characters are to unlock through ordinary play (XP and challenges), and those rules
 * don't exist yet, so with locks on nearly the whole roster would be out of reach. This one switch turns them on once
 * they do; until then every character is unlocked and nothing changes for anyone.
 */
export const CHARACTER_LOCKS_ON = false;

/** What a lock check knows besides the switch: the starting characters (the Chrono Crew) and what was unlocked. */
export interface UnlockState {
  starting: ReadonlySet<string>;
  /** Unlocked through the campaign (CampaignProgress.characters); later also through play. */
  unlocked: readonly string[];
}

export const unlockState = (starting: ReadonlySet<string>, progress: Pick<CampaignProgress, 'characters'>): UnlockState => ({ starting, unlocked: progress.characters });

/**
 * Whether the player may pick this character (any mode: campaign, Quick Play, Match Setup, online). With locks off,
 * always. A player's own designed looks (not `core.` ids) are always theirs.
 */
export function characterUnlocked(id: string, state: UnlockState, locksOn: boolean = CHARACTER_LOCKS_ON): boolean {
  if (!locksOn) return true;
  if (!id.startsWith('core.')) return true;
  return state.starting.has(id) || state.unlocked.includes(id);
}

/** The starting characters: the Chrono Crew collection (Character Select's first section). */
export const startingCharacters = (roster: readonly { id: string; collection?: string | undefined }[]): Set<string> => new Set(roster.filter((l) => l.collection === 'chrono').map((l) => l.id));
