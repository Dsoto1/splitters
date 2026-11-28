// Retired maps and training maps (map/retired.ts): kept in maps/, offered by no list, vote or rotation (owner, 2026-11-24:
// Citadel retired; the Training Range only for training and testing, from Armory → Test my loadout).
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RETIRED_MAPS, TRAINING_MAPS, isRetiredMap, isTrainingMap, isUnlistedMap } from '../src/index.ts';

const file = (id: string) => new URL(`../../../maps/${id}.json`, import.meta.url);

describe('retired and training maps', () => {
  it('Citadel is retired; the Training Range is a training map, not a retired one', () => {
    expect(isRetiredMap('citadel')).toBe(true);
    expect(isTrainingMap('citadel')).toBe(false);
    expect(isTrainingMap('training_range')).toBe(true);
    expect(isRetiredMap('training_range')).toBe(false);
  });

  it('both leave the lists (isUnlistedMap); ordinary maps stay', () => {
    expect(isUnlistedMap('citadel')).toBe(true);
    expect(isUnlistedMap('training_range')).toBe(true);
    expect(isUnlistedMap('sandgate')).toBe(false);
    expect(isUnlistedMap('frost_basin')).toBe(false);
  });

  it('keeps their files (tests, ?offline= links, the tutorial and Test my loadout still load them)', () => {
    for (const id of [...RETIRED_MAPS, ...TRAINING_MAPS]) expect(existsSync(file(id)), id).toBe(true);
  });

  it('a map is never both', () => {
    for (const id of TRAINING_MAPS) expect(RETIRED_MAPS.has(id), id).toBe(false);
  });
});
