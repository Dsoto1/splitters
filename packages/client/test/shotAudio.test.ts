/**
 * Your own full-auto in a big match (owner, 2026-11-18: "gunshots are lagging now… chugging, not natural like
 * before", the Assault Rifle in a 64-player Deathmatch on St. John's). Two things cut and clumped your reports:
 * - the voice limit cut the oldest voice of a sound for each new one, and in that match about 110 bot rifle shots a
 *   second are heard (all inside the far range's 250 m; measured with the match at 63 bots), so your own 0.4 s
 *   report was cut within about 50 ms, every shot (audio.ts voiceToSteal);
 * - a slow frame ran several ticks at once, and their shots sounded together on the frame (triggerLatch.ts
 *   shotDelay).
 */
import { describe, expect, it } from 'vitest';
import { TICK_DT } from '@tiletrigger/shared';
import { WORLD_TAIL_FROM, voiceToSteal, worldTail, type VoiceSlot } from '../src/audio/audio.ts';
import { SHOT_SPREAD_MAX, shotDelay } from '../src/game/triggerLatch.ts';

const MAX_PER_SOUND = 6;
const MAX_ALL = 40;

/** The rule before: the oldest voice of the same sound, then the oldest of all. */
function oldRule(voices: readonly VoiceSlot[], id: string): { index: number; drop: boolean } {
  const same = voices.map((v, i) => ({ v, i })).filter((x) => x.v.id === id);
  if (same.length >= MAX_PER_SOUND) return { index: same[0]!.i, drop: false };
  return { index: voices.length >= MAX_ALL ? 0 : -1, drop: false };
}

/**
 * Four seconds of that match's sound, played through a voice rule: your rifle (10 a second, 0.4 s reports), 110 bot
 * rifle shots a second 10-250 m off, and 60 other world sounds a second (impacts, bodies, steps) 0.2-0.6 s long.
 * Returns how long each of your reports rang (s).
 */
function play(rule: (voices: readonly VoiceSlot[], id: string, own: boolean, dist: number) => { index: number; drop: boolean }): number[] {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  type V = VoiceSlot & { ends: number; mine?: { rang: number } };
  let voices: V[] = [];
  const mine: { start: number; rang: number }[] = [];
  const events: { t: number; id: string; own: boolean; dist: number; len: number }[] = [];
  for (let t = 0; t < 4; t += 0.1) events.push({ t, id: 'fire.rifle', own: true, dist: 0, len: 0.4 });
  for (let i = 0; i < 440; i++) events.push({ t: rand() * 4, id: 'fire.rifle', own: false, dist: 10 + rand() * 240, len: 0.4 });
  for (let i = 0; i < 240; i++) events.push({ t: rand() * 4, id: ['impact.world', 'impact.body', 'step'][i % 3]!, own: false, dist: 5 + rand() * 50, len: 0.2 + rand() * 0.4 });
  events.sort((a, b) => a.t - b.t);
  for (const e of events) {
    for (const v of voices) if (v.ends <= e.t && v.mine) v.mine.rang = v.ends - v.started;
    voices = voices.filter((v) => v.ends > e.t);
    const r = rule(voices, e.id, e.own, e.dist);
    if (r.drop) continue;
    if (r.index >= 0) {
      const cut = voices[r.index]!;
      if (cut.mine) cut.mine.rang = e.t - cut.started;
      voices.splice(r.index, 1);
    }
    const v: V = { id: e.id, own: e.own, dist: e.dist, started: e.t, ends: e.t + e.len };
    if (e.own) {
      const m = { start: e.t, rang: e.len };
      mine.push(m);
      v.mine = m;
    }
    voices.push(v);
  }
  return mine.filter((m) => m.start < 3.5).map((m) => m.rang);
}

describe('your own shots under a big match\'s sound', () => {
  it('before: the bots\' rifles cut your reports to a sliver; now each rings its whole length', () => {
    const before = play((v, id) => oldRule(v, id));
    const after = play(voiceToSteal);
    const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
    expect(median(before)).toBeLessThan(0.1);
    expect(Math.min(...after)).toBeCloseTo(0.4, 5);
  });

  it('keeps your own sounds; a far world sound gives way to near ones', () => {
    const v = (id: string, own: boolean, dist: number, started: number): VoiceSlot => ({ id, own, dist, started });
    // Six of your own reports: the next one replaces your oldest.
    const mine = [0, 1, 2, 3, 4, 5].map((t) => v('fire.rifle', true, 0, t));
    expect(voiceToSteal([...mine, v('fire.rifle', false, 30, 0)], 'fire.rifle', true, 0)).toEqual({ index: 0, drop: false });
    // The world's: the farthest of the sound gives way to a nearer one, and a farther one isn't played.
    const world = [10, 200, 50, 20, 80, 90].map((d, t) => v('fire.rifle', false, d, t));
    expect(voiceToSteal([...mine, ...world], 'fire.rifle', false, 40)).toEqual({ index: 7, drop: false });
    expect(voiceToSteal([...mine, ...world], 'fire.rifle', false, 220)).toEqual({ index: -1, drop: true });
    // Every voice in use: a world sound takes the farthest world voice, never one of yours.
    const full = [...mine, ...Array.from({ length: 34 }, (_, i) => v(`s${i}`, false, i, i))];
    expect(voiceToSteal(full, 'reload.start', true, 0)).toEqual({ index: full.length - 1, drop: false });
    expect(voiceToSteal(full, 'x', false, 10)).toEqual({ index: full.length - 1, drop: false });
    expect(voiceToSteal(full, 'x', false, 100)).toEqual({ index: -1, drop: true });
  });

  it('a slow frame\'s shots keep their ticks\' spacing (a 600-rpm rifle at 25 frames a second)', () => {
    /** The frame loop's catch-up (session.ts): a shot every 6 ticks, sounded at the frame plus `delay`. */
    const run = (frameMs: number, spread: boolean): number[] => {
      let acc = 0;
      let tick = 0;
      const at: number[] = [];
      for (let now = frameMs; now < 3000; now += frameMs) {
        acc += frameMs / 1000;
        while (acc >= TICK_DT - 1e-9) {
          acc -= TICK_DT;
          if (tick++ % 6 === 0) at.push(now / 1000 + (spread ? shotDelay(acc, frameMs / 1000) : 0));
        }
      }
      return at.slice(1).map((t, i) => Math.round((t - at[i]!) * 1000));
    };
    const clumped = run(40, false);
    expect(Math.max(...clumped) - Math.min(...clumped)).toBeGreaterThanOrEqual(30);
    for (const g of run(40, true)) expect(Math.abs(g - 100)).toBeLessThanOrEqual(1);
    // At 60 frames a second nothing waits.
    expect(shotDelay(0, 1 / 60)).toBe(0);
    expect(shotDelay(0, 1)).toBe(SHOT_SPREAD_MAX);
  });
});

/**
 * The slow guns' long reports (owner, 2026-11-23, docs/AUDIO.md "Slow guns ring out"): 1-1.5 s rings must not take the
 * world's 40 voices in a big match, so a far world copy rings shorter (audio.ts worldTail).
 */
describe('long gun reports in a crowd', () => {
  it('a far world copy rings shorter, a near one and short sounds whole, never under the floor', () => {
    expect(worldTail(0.4, 200, 250)).toBe(0.4);
    expect(worldTail(1.5, 0, 250)).toBe(1.5);
    expect(worldTail(1.5, 125, 250)).toBeCloseTo(0.75, 5);
    expect(worldTail(1.5, 240, 250)).toBe(WORLD_TAIL_FROM);
    expect(worldTail(1.5, 10, 250)).toBeGreaterThan(1.4);
  });

  it('averaged over where the shooters stand, a 1.5 s report holds a world voice no longer than the old 0.9 s cuts', () => {
    // Shooters spread evenly from 10 m to the far range's 250 m (a 64-bot match on St. John's).
    const n = 1000;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += worldTail(1.5, 10 + (240 * (i + 0.5)) / n, 250);
    expect(sum / n).toBeLessThanOrEqual(0.9);
  });
});
