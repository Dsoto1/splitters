import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, GAME_MODES, MODE_LABELS } from '@tiletrigger/shared';
import { matchGoal } from '../src/game/matchGoal.ts';

describe('the match goal under the countdown (owner, 2026-11-18)', () => {
  it('says the goal in a few words for every mode', () => {
    expect(matchGoal({ ...DEFAULT_RULES['core.tdm'], scoreLimit: 50 })).toBe('First team to 50 kills');
    expect(matchGoal({ ...DEFAULT_RULES['core.deathmatch'], scoreLimit: 15 })).toBe('First to 15 kills');
    expect(matchGoal({ ...DEFAULT_RULES['core.deathmatch'], scoreLimit: 0, timeLimitSeconds: 600 })).toBe('Most kills in 10 min');
    expect(matchGoal(DEFAULT_RULES['core.ctf'])).toBe('First to 3 captures');
    for (const mode of GAME_MODES) {
      const goal = matchGoal(DEFAULT_RULES[mode]);
      expect(goal, MODE_LABELS[mode]).toBeTruthy();
      // A few words: it fits on one line under the number.
      expect(goal.length, goal).toBeLessThanOrEqual(40);
    }
  });
});
