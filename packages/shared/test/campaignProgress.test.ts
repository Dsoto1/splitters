import { describe, expect, it } from 'vitest';
import {
  characterUnlocked,
  convergenceTiles,
  mapLock,
  CHARACTER_LOCKS_ON,
  discoveredConvergences,
  emptyProgress,
  mergeProgress,
  progressShape,
  recordWin,
  sectorStatus,
  settleProgress,
  stageStates,
  startingCharacters,
  unlockState,
  type CampaignData,
  type CampaignProgress,
} from '../src/index.ts';

/** GDD §16.4's first test: two sectors and one convergence. */
const sector = (id: string) => ({
  id,
  name: id,
  classification: 'historical' as const,
  period: 'P',
  description: 'D',
  maps: [1, 2, 3].map((n) => ({ map: `${id}_map${n}`, unlock: `core.${id}${n}` })),
  boss: { character: `core.${id}boss`, companions: [] },
  rewards: [`core.${id}boss`],
  expedition: { crew: 10, allies: ['core.ally1', 'core.ally2', 'core.ally3', 'core.ally4'] },
});
const DATA: CampaignData = {
  sectors: [sector('a'), sector('b')],
  convergences: [{ id: 'ab', name: 'AB', description: 'D', sectors: ['a', 'b'], maps: ['ab_map'], rewards: ['core.hybrid'] }],
};

const winAll = (p: CampaignProgress, id: string) => [1, 2, 3].reduce((q, n) => recordWin(q, DATA, id, `${id}_map${n}`).progress, p);

describe('campaign progress', () => {
  it('lets either sector start first and unlocks its maps in order', () => {
    const p = emptyProgress();
    expect(stageStates(DATA.sectors[1]!, p).map((s) => s.state)).toEqual(['next', 'locked', 'locked']);
    // A win on a locked map counts for nothing.
    expect(recordWin(p, DATA, 'b', 'b_map2').events.completed).toEqual([]);
    const one = recordWin(p, DATA, 'b', 'b_map1');
    expect(one.events).toEqual({ completed: ['b/b_map1'], unlocked: ['core.b1'], repaired: [], discovered: [] });
    expect(stageStates(DATA.sectors[1]!, one.progress).map((s) => s.state)).toEqual(['done', 'next', 'locked']);
    expect(sectorStatus(DATA.sectors[1]!, one.progress)).toBe('in-progress');
    expect(sectorStatus(DATA.sectors[0]!, one.progress)).toBe('available');
  });

  it('repairs a sector on its last map and grants its rewards once', () => {
    const p = winAll(emptyProgress(), 'a');
    expect(p.sectors).toEqual(['a']);
    expect(p.characters).toEqual(['core.a1', 'core.a2', 'core.a3', 'core.aboss']);
    expect(sectorStatus(DATA.sectors[0]!, p)).toBe('repaired');
    // Replaying a completed map changes nothing (idempotent).
    const again = recordWin(p, DATA, 'a', 'a_map3');
    expect(again.progress).toEqual(p);
    expect(again.events).toEqual({ completed: [], unlocked: [], repaired: [], discovered: [] });
  });

  it('keeps the convergence completely hidden until both sectors are repaired, then discovers it once', () => {
    const a = winAll(emptyProgress(), 'a');
    expect(a.convergences).toEqual([]);
    expect(discoveredConvergences(DATA, a)).toEqual([]);
    // Its map can't be won before it is discovered.
    expect(recordWin(a, DATA, 'ab', 'ab_map').events.completed).toEqual([]);
    const two = [1, 2].reduce((q, n) => recordWin(q, DATA, 'b', `b_map${n}`).progress, a);
    const last = recordWin(two, DATA, 'b', 'b_map3');
    expect(last.events.discovered).toEqual(['ab']);
    expect(discoveredConvergences(DATA, last.progress).map((c) => c.id)).toEqual(['ab']);
    expect(recordWin(last.progress, DATA, 'b', 'b_map3').events.discovered).toEqual([]);
    const conv = recordWin(last.progress, DATA, 'ab', 'ab_map');
    expect(conv.events.unlocked).toEqual(['core.hybrid']);
  });

  it('merges the device and profile copies by union, then settles', () => {
    const device = recordWin(emptyProgress(), DATA, 'a', 'a_map1').progress;
    const profile = [1, 2, 3].reduce((q, n) => recordWin(q, DATA, 'b', `b_map${n}`).progress, emptyProgress());
    const merged = mergeProgress(device, profile);
    expect(merged.maps).toEqual(['a/a_map1', 'b/b_map1', 'b/b_map2', 'b/b_map3']);
    expect(mergeProgress(merged, merged)).toEqual(merged);
    expect(mergeProgress(device, profile)).toEqual(mergeProgress(profile, device));
    // A copy that missed a step (an older save) is brought up to date.
    const partial = { ...emptyProgress(), maps: ['a/a_map1', 'a/a_map2', 'a/a_map3', 'b/b_map1', 'b/b_map2', 'b/b_map3'] };
    const s = settleProgress(partial, DATA);
    expect(s.progress.sectors).toEqual(['a', 'b']);
    expect(s.progress.convergences).toEqual(['ab']);
  });

  it('checks a saved or sent copy', () => {
    expect(progressShape(null)).toBeNull();
    expect(progressShape({ maps: 'x' })).toBeNull();
    expect(progressShape({ maps: ['a/a_map1', 'a/a_map1', 'BAD', 7], characters: ['core.x'] })).toEqual({ maps: ['a/a_map1'], sectors: [], convergences: [], characters: ['core.x'] });
    expect(progressShape({})).toEqual(emptyProgress());
  });
});

describe('character locks', () => {
  const state = unlockState(startingCharacters([{ id: 'core.clio', collection: 'chrono' }, { id: 'core.other' }]), { characters: ['core.won'] });

  it('ship off: every character is unlocked', () => {
    expect(CHARACTER_LOCKS_ON).toBe(false);
    expect(characterUnlocked('core.other', state)).toBe(true);
  });

  it('with the switch on: the Chrono Crew, campaign unlocks and your own designs only', () => {
    expect(characterUnlocked('core.clio', state, true)).toBe(true);
    expect(characterUnlocked('core.won', state, true)).toBe(true);
    expect(characterUnlocked('core.other', state, true)).toBe(false);
    expect(characterUnlocked('custom:abc', state, true)).toBe(true);
  });
});

describe('map locks and convergence tiles', () => {
  it("locks a sector's 2nd and 3rd maps for hosting until each is won in Story", () => {
    const p = emptyProgress();
    expect(mapLock(DATA, p, 'a_map1')).toBeNull();
    expect(mapLock(DATA, p, 'elsewhere')).toBeNull();
    expect(mapLock(DATA, p, 'a_map2')).toMatchObject({ previous: 'a_map1', previousWon: false });
    const one = recordWin(p, DATA, 'a', 'a_map1').progress;
    // Winning map 1 opens map 2 in Story, not yet for hosting.
    expect(mapLock(DATA, one, 'a_map2')).toMatchObject({ previous: 'a_map1', previousWon: true });
    const two = recordWin(one, DATA, 'a', 'a_map2').progress;
    expect(mapLock(DATA, two, 'a_map2')).toBeNull();
    expect(mapLock(DATA, two, 'a_map3')).not.toBeNull();
  });

  it('shows an Unknown tile per sector until its convergence is discovered, never its name', () => {
    expect(convergenceTiles(DATA, emptyProgress(), 'a')).toEqual([{ unknown: true }]);
    const both = winAll(winAll(emptyProgress(), 'a'), 'b');
    expect(convergenceTiles(DATA, both, 'a')).toEqual([{ known: DATA.convergences[0] }]);
    expect(convergenceTiles({ ...DATA, convergences: [] }, both, 'a')).toEqual([{ unknown: true }]);
  });
});
