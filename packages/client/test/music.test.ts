import { describe, expect, it } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MUSIC_TRACKS, ShuffleDeck } from '../src/audio/music.ts';

describe('music', () => {
  it('has five Map Maker tracks, the menu shuffling them in with its own five, each shipped', () => {
    expect(MUSIC_TRACKS.mapmaker.length).toBe(5);
    expect(MUSIC_TRACKS.menu.length).toBe(10);
    for (const id of MUSIC_TRACKS.mapmaker) expect(MUSIC_TRACKS.menu).toContain(id);
    for (const scene of ['menu', 'mapmaker'] as const) {
      for (const id of MUSIC_TRACKS[scene]) {
        const path = fileURLToPath(new URL(`../public/music/${id}.ogg`, import.meta.url));
        expect(existsSync(path)).toBe(true);
        expect(statSync(path).size).toBeLessThan(2_000_000);
      }
    }
  });

  it('shuffles without repeats until all have played, and never the same twice in a row', () => {
    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const deck = new ShuffleDeck(['a', 'b', 'c', 'd', 'e'], rng);
    let last: string | undefined;
    for (let round = 0; round < 50; round++) {
      const seen = new Set<string>();
      for (let i = 0; i < 5; i++) {
        const t = deck.next()!;
        expect(t).not.toBe(last);
        seen.add(t);
        last = t;
      }
      expect(seen.size).toBe(5);
    }
  });

  it('copes with one track and none', () => {
    const one = new ShuffleDeck(['a']);
    expect([one.next(), one.next()]).toEqual(['a', 'a']);
    expect(new ShuffleDeck<string>([]).next()).toBeUndefined();
  });
});
