import { DEFAULT_RULES, isGameMode, isTeamMode, type GameMode, type MapDocument, type MatchSetup, type StageMatch } from '@tiletrigger/shared';
import { quickSetup } from '../frontend/quickPlay.ts';

/**
 * A Story map's match (docs/CAMPAIGN.md, "A map's match"): a normal bot match, set up like Quick Play's, with the
 * campaign map's own mode and size where it gives them (owner, 2026-11-25). Your side is the picked crew plus the
 * local allies, the other side the enemies; both scaled down together to what this device runs (`deviceMax`).
 * Waves are kept in the data for the encounter step: nothing plays them yet.
 */
export function storyStageSetup(stage: StageMatch, crew: number, map: MapDocument, key: string, modes: readonly GameMode[], deviceMax: number): MatchSetup {
  const asked = stage.mode && isGameMode(stage.mode) && modes.includes(stage.mode) ? stage.mode : null;
  const mode: GameMode = asked ?? (modes.includes('core.tdm') ? 'core.tdm' : 'core.deathmatch');
  const sized = stage.picked !== undefined || stage.allies !== undefined || stage.enemies !== undefined;
  const base = quickSetup(mode === 'core.deathmatch' ? 'core.deathmatch' : 'core.tdm', map, key, deviceMax);
  const own = { ...base, mode, scoreLimit: DEFAULT_RULES[mode].scoreLimit };
  if (!isTeamMode(mode)) {
    if (stage.enemies === undefined) return own;
    return { ...own, bots: Math.max(1, Math.min(deviceMax - 1, stage.enemies)), teams: undefined };
  }
  if (!sized) return own;
  let friends = Math.max(1, (stage.picked ?? crew) + (stage.allies ?? 0));
  let enemies = Math.max(1, stage.enemies ?? friends);
  // Too many for this device: both sides shrink by the same share (a 14 v 50 stays lopsided on a phone).
  const total = friends + enemies;
  if (total > deviceMax) {
    const k = deviceMax / total;
    friends = Math.max(1, Math.floor(friends * k));
    enemies = Math.max(1, Math.min(deviceMax - friends, Math.floor(enemies * k)));
  }
  return { ...own, bots: friends + enemies - 1, teams: [friends, enemies], assign: 'fixed', playerTeam: 0 };
}
