// A saved Match Setup naming a map that left the list plays on the default map, with a line saying why (owner, 2026-11-24).
import { describe, expect, it } from 'vitest';
import { unlistedMapNotice } from '../src/frontend/mapNotice.ts';

describe('saved setups on a map that left the list', () => {
  it('a retired map (Citadel) says so and names the map played instead', () => {
    expect(unlistedMapNotice('citadel', 'Sandgate')).toBe('Citadel is retired: your setup plays Sandgate instead.');
  });
  it('a training map points to Test weapons', () => {
    expect(unlistedMapNotice('training_range', 'Sandgate')).toBe('Training Range is only on Profile → Test weapons now: your setup plays Sandgate instead.');
  });
  it('nothing for a listed map, a missing one or no map', () => {
    expect(unlistedMapNotice('sandgate', 'Sandgate')).toBeNull();
    expect(unlistedMapNotice('own:gone', 'Sandgate')).toBeNull();
    expect(unlistedMapNotice(undefined, 'Sandgate')).toBeNull();
  });
});
