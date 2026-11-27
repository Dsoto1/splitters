// MapMaker's team Layout chips (owner, 2026-11-26, "4b"): only the common layouts; an odd one a map was saved with
// still shows, first.
import { describe, expect, it } from 'vitest';
import { TEAM_PRESETS, teamLayoutChoices, teamLayoutLabel } from '../src/index.ts';

describe('team Layout chips', () => {
  it('offers only 1v1, 2v2, 4v4, 8v8 and the three- and four-team layouts', () => {
    expect(TEAM_PRESETS.map(teamLayoutLabel)).toEqual(['1v1', '2v2', '4v4', '8v8', '2v2v2', '3v3v3', '2v2v2v2', '4v4v4v4']);
  });

  it('a common layout adds nothing', () => {
    expect(teamLayoutChoices([4, 4]).map((c) => teamLayoutLabel(c.sizes))).toEqual(TEAM_PRESETS.map(teamLayoutLabel));
    expect(teamLayoutChoices([3, 3, 3]).some((c) => c.odd)).toBe(false);
  });

  it('an odd saved layout shows first, marked', () => {
    const odd = [2, 2, 2, 2, 2, 2, 2, 2];
    const c = teamLayoutChoices(odd);
    expect(c).toHaveLength(TEAM_PRESETS.length + 1);
    expect(c[0]).toEqual({ sizes: odd, odd: true });
    expect(teamLayoutChoices([1, 3])[0]!.odd).toBe(true);
  });
});
