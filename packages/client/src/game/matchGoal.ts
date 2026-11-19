import { type MatchRules } from '@tiletrigger/shared';

/**
 * The match's goal in a few words, for the loading screen and the line under the countdown's number (owner,
 * 2026-11-18: "First to 50 kills").
 */
export function matchGoal(rules: Pick<MatchRules, 'mode' | 'scoreLimit' | 'timeLimitSeconds'>): string {
  const n = rules.scoreLimit;
  const minutes = Math.round(rules.timeLimitSeconds / 60);
  const most = (what: string) => (minutes > 0 ? `Most ${what} in ${minutes} min` : `Most ${what}`);
  switch (rules.mode) {
    case 'core.deathmatch':
    case 'core.roulette':
    case 'core.discs':
      return n > 0 ? `First to ${n} kills` : most('kills');
    case 'core.tdm':
      return n > 0 ? `First team to ${n} kills` : most('kills');
    case 'core.ctf':
      return n > 0 ? `First to ${n} captures` : most('captures');
    case 'core.koth':
      return n > 0 ? `Hold the hill: first to ${n} points` : 'Hold the hill';
    case 'core.elim':
      return n > 0 ? `Last team standing: first to ${n} rounds` : 'Last team standing';
    case 'core.bomb':
      return n > 0 ? `Plant or defuse: first to ${n} rounds` : 'Plant or defuse the bomb';
    case 'core.hostage':
      return n > 0 ? `Rescue or guard: first to ${n} rounds` : 'Rescue or guard the hostages';
    case 'core.breakthrough':
      return 'Attack the sectors, or hold them';
    case 'core.forts':
      return 'Build your fort, then take their flag';
    case 'core.coop':
      return 'Complete the mission together';
    case 'core.zombies':
      return 'Survive the waves';
  }
}
