// Test maps (metadata.testOnly, MapMaker's Map properties: maps/test_coverage.json) are left out of rotations.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { suiteLookup } from '../src/rotation.ts';

const MAPS = fileURLToPath(new URL('../../../maps', import.meta.url));

describe('test maps', () => {
  it('no rotation can take the test maps (coverage, Breakthrough Range); ordinary maps still can', () => {
    const lookup = suiteLookup(MAPS);
    expect(lookup('test_coverage')).toBeNull();
    expect(lookup('frost_basin')?.name).toBe('Frost Basin');
    // The Breakthrough Range is a test map again (owner, 2026-11-08: hidden from every list): no rotation takes it.
    expect(lookup('test_breakthrough')).toBeNull();
    expect(lookup('iron_coast')?.modes).toContain('core.breakthrough');
  });
});
