import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { findSource, ownerAudioEntries } from '../owner-audio.mjs';

describe('owner audio', () => {
  it('finds a source by the start of its name, not a longer one', () => {
    const names = ['Arena_Music_1_-_Tile_Trigger_14514_Lyria_3_Pro.mp3', 'Arena_Music_10_x.mp3', 'Map_Maker_Music_5-_Tile_Trigge_39586_Lyria_3_Pro.mp3', 'Multi-kill_Showtime_MiniMax_02_HD_01a1.mp3', 'notes.txt'];
    expect(findSource(names, 'Arena_Music_1')).toBe(names[0]);
    expect(findSource(names, 'Map_Maker_Music_5')).toBe(names[2]);
    expect(findSource(names, 'Multi-kill')).toBe(names[3]);
    expect(findSource(names, 'Arena_Music_2')).toBeNull();
    expect(() => findSource(['Headshot_a.mp3', 'Headshot_b.mp3'], 'Headshot')).toThrow(/more than one/);
  });

  it('lists every track and line once, with distinct files', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../../content/owner-audio.json', import.meta.url), 'utf8'));
    const entries = ownerAudioEntries(manifest);
    expect(entries.filter((e) => e.kind === 'music').length).toBe(10);
    expect(entries.filter((e) => e.kind === 'voice').length).toBe(39);
    expect(new Set(entries.map((e) => e.file)).size).toBe(entries.length);
    expect(new Set(entries.map((e) => e.source)).size).toBe(entries.length);
  });
});
