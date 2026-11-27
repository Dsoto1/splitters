import { stageKey, type CampaignData, type CampaignSector, type Convergence } from './campaign.ts';
import { convergenceTiles, discoveredSectors, mapLock, type CampaignProgress } from './progress.ts';

/**
 * Match Setup's Story tab (owner, 2026-11-25; docs/CAMPAIGN.md, "Match Setup by sector"): a row per sector the
 * database shows, in the data's order, built from the campaign data alone, so it re-sorts itself as sectors change.
 * Each row: the sector's maps in play order, each `open` (hostable: a sector's first map), `won` (in Story: hostable),
 * `next` (the one to win next in Story: still locked for hosting until it is won) or `locked` (for hosting, behind
 * the one before); joining a match on a locked map is never refused (mapLock). Then its convergence tiles (Unknown
 * until discovered: convergenceTiles).
 */
export type SetupMapState = 'open' | 'won' | 'next' | 'locked';

export interface StorySetupRow {
  sector: CampaignSector;
  maps: { map: string; state: SetupMapState }[];
  tiles: ({ known: Convergence } | { unknown: true })[];
}

/** `locks`: whether map locks apply (off in browser tests: every map then reads open or won). */
export function storySetupRows(data: CampaignData, p: CampaignProgress, locks = true): StorySetupRow[] {
  return discoveredSectors(data).map((sector) => ({
    sector,
    maps: sector.maps.map(({ map }): StorySetupRow['maps'][number] => {
      if (p.maps.includes(stageKey(sector.id, map))) return { map, state: 'won' };
      const lock = locks ? mapLock(data, p, map) : null;
      return { map, state: !lock ? 'open' : lock.previousWon ? 'next' : 'locked' };
    }),
    tiles: convergenceTiles(data, p, sector.id),
  }));
}
