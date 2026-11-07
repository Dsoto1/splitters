// Test maps (metadata.testOnly, MapMaker's Map properties: maps/test_coverage.json) are left out of rotations.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { suiteLookup } from '../src/rotation.ts';

const MAPS = fileURLToPath(new URL('../../../maps', import.meta.url));

describe('test maps', () => {
  it('no rotation can take the coverage map; ordinary maps still can', () => {
    const lookup = suiteLookup(MAPS);
    expect(lookup('test_coverage')).toBeNull();
    expect(lookup('frost_basin')?.name).toBe('Frost Basin');
    // The Breakthrough Range is an ordinary map (it was a test map): a rotation can play it, in Breakthrough.
    expect(lookup('test_breakthrough')?.name).toBe('Breakthrough Range');
    expect(lookup('test_breakthrough')?.modes[0]).toBe('core.breakthrough');
  });
});
