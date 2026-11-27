import { describe, expect, it } from 'vitest';
import { CORE_LOOKS, DEFAULT_CLIP_SET, MODULAR_PARTS_MALE, clipSetOf, decodeLook, encodeLook } from '../src/index.ts';
// @ts-expect-error: a plain .mjs tool without types
import { DEFAULT_CLIP_SET as TOOL_DEFAULT, readClipSets } from '../../../tools/content/character-manifests.mjs';

describe('clip sets', () => {
  it('every look on the rig moves with the default set unless it names another or opts out; a rolling body has none', () => {
    expect(clipSetOf({})).toBe(DEFAULT_CLIP_SET);
    expect(clipSetOf({ clips: 'other' })).toBe('other');
    expect(clipSetOf({ clips: false })).toBeNull();
    expect(clipSetOf({ locomotion: 'roll' })).toBeNull();
    expect(clipSetOf({ clips: 'other', locomotion: 'roll' })).toBeNull();
  });

  it('the default set is defined, and the manifest checker names the same one', () => {
    expect(TOOL_DEFAULT).toBe(DEFAULT_CLIP_SET);
    expect((readClipSets() as { id: string }[]).map((c) => c.id)).toContain(DEFAULT_CLIP_SET);
  });

  it('the offered looks: the modular ones and every walking whole body move with clips', () => {
    expect(clipSetOf(decodeLook(encodeLook({ body: 'male', parts: [...MODULAR_PARTS_MALE], hair: ['hair_simpleparted'], colorways: [], skin: null, hairColor: '#8a6a50' }))!)).toBe(DEFAULT_CLIP_SET);
    expect(clipSetOf(CORE_LOOKS.find((l) => l.id === 'core.paratrooper')!)).toBe(DEFAULT_CLIP_SET);
    expect(clipSetOf(CORE_LOOKS.find((l) => l.id === 'core.rollerbot')!)).toBeNull();
    // An opted-out look says why in its manifest (clipsWhy); the rest have a set.
    for (const l of CORE_LOOKS) if (!l.locomotion && l.clips !== false) expect(clipSetOf(l), l.id).toBeTruthy();
  });
});
