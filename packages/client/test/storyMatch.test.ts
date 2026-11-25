import { describe, expect, it } from 'vitest';
import type { MapDocument } from '@tiletrigger/shared';
import { storyStageSetup } from '../src/campaign/storyMatch.ts';

const map = { metadata: { recommendedPlayers: { min: 2, max: 16 } }, entities: [], teamSetup: undefined } as unknown as MapDocument;
const modes = ['core.tdm', 'core.deathmatch', 'core.ctf'] as const;

describe('a Story map’s match', () => {
  it('plays the map’s own mode and size: the picked crew plus allies against the enemies', () => {
    const s = storyStageSetup({ mode: 'core.tdm', picked: 10, allies: 4, enemies: 14 }, 10, map, 'x', modes, 64);
    expect(s.mode).toBe('core.tdm');
    expect(s.teams).toEqual([14, 14]);
    expect(s.bots).toBe(27);
    expect(s.playerTeam).toBe(0);
  });

  it('keeps a lopsided battle lopsided when the device runs fewer (14 v 50 on a phone)', () => {
    const s = storyStageSetup({ picked: 14, enemies: 50 }, 10, map, 'x', modes, 16);
    const [f, e] = s.teams!;
    expect(f! + e!).toBeLessThanOrEqual(16);
    expect(e!).toBeGreaterThan(f!);
  });

  it('falls back to Team Deathmatch when the map doesn’t play the mode asked, and to Quick Play’s size with none given', () => {
    const s = storyStageSetup({ mode: 'core.koth' }, 10, map, 'x', modes, 64);
    expect(s.mode).toBe('core.tdm');
    expect(s.teams).toEqual([8, 8]);
  });

  it('a free-for-all takes the enemies as its bots', () => {
    const s = storyStageSetup({ mode: 'core.deathmatch', enemies: 9 }, 10, map, 'x', modes, 64);
    expect(s.mode).toBe('core.deathmatch');
    expect(s.bots).toBe(9);
  });
});
