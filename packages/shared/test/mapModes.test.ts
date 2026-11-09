import { describe, expect, it } from 'vitest';
import { hasRemovedMode, withMainMode, withoutRemovedModes } from '../src/editor/mapModes.ts';
import { EDITOR_KEYS } from '../src/index.ts';

describe('Map properties: removed modes (Race)', () => {
  it('spots a map that still lists Race', () => {
    expect(hasRemovedMode(['core.race', 'core.deathmatch'])).toBe(true);
    expect(hasRemovedMode(['core.tdm'])).toBe(false);
  });
  it('drops Race and keeps the rest in order', () => {
    expect(withoutRemovedModes(['core.race', 'core.deathmatch', 'core.tdm'])).toEqual(['core.deathmatch', 'core.tdm']);
    expect(withoutRemovedModes(['core.tdm', 'core.race'])).toEqual(['core.tdm']);
  });
  it('a map that listed only Race falls back to Deathmatch', () => {
    expect(withoutRemovedModes(['core.race'])).toEqual(['core.deathmatch']);
  });
  it('picking a main mode puts it first and drops Race', () => {
    expect(withMainMode(['core.race', 'core.deathmatch', 'core.tdm'], 'core.ctf')).toEqual(['core.ctf', 'core.deathmatch', 'core.tdm']);
    expect(withMainMode(['core.deathmatch', 'core.tdm'], 'core.tdm')).toEqual(['core.tdm', 'core.deathmatch']);
  });
  it('the key list says track / NPC traffic, not race', () => {
    const shiftG = EDITOR_KEYS.find((k) => k.action === 'raceTrack');
    expect(shiftG?.what).toMatch(/track/);
    expect(shiftG?.what).not.toMatch(/race/i);
  });
});
