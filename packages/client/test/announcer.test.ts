import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Announcer, COOLDOWN, HYPE_LINES, topScorer, type KillInfo } from '../src/audio/announcer.ts';
import { VOICE_LINES, type SoundId, type VoiceLine } from '../src/audio/audio.ts';

const ME = 1;

/** An announcer whose lines all last `secs` (null: none loaded) and whose dice roll `roll`. */
function make(secs: number | null = 1, roll = 0.99) {
  const heard: string[] = [];
  const a = new Announcer(
    {
      speak: (line: VoiceLine) => (secs === null ? null : (heard.push(line), secs)),
      sound: (id: SoundId) => (heard.push(id), 1),
    },
    () => ME,
    () => roll,
  );
  return { a, heard };
}

const kill = (k: Partial<KillInfo> = {}): KillInfo => ({ killer: ME, victim: 2, ...k });

/** Run the clock from `from` to `to` (seconds) in frames. */
function run(a: Announcer, from: number, to: number): void {
  for (let t = from; t <= to + 1e-9; t += 0.05) a.update(t);
}

describe('announcer', () => {
  it('ships a file for every line', () => {
    const lock = JSON.parse(readFileSync(fileURLToPath(new URL('../../../content/owner-audio.lock.json', import.meta.url)), 'utf8')) as { files: { file: string }[] };
    expect(VOICE_LINES.length).toBe(39);
    for (const id of VOICE_LINES) {
      expect(lock.files.some((f) => f.file === `voice/${id}.ogg`)).toBe(true);
      expect(existsSync(fileURLToPath(new URL(`../public/voice/${id}.ogg`, import.meta.url)))).toBe(true);
    }
  });

  it('calls a multi-kill chain, the best of a burst once, with the window', () => {
    const { a, heard } = make();
    a.kill(kill({ victim: 2 }), 0);
    a.kill(kill({ victim: 3 }), 1);
    run(a, 1, 2);
    expect(heard).toEqual(['double_kill']);
    // Three more inside the window, together: one line for the best of them (the earlier ones are replaced).
    a.kill(kill({ victim: 4 }), 3);
    a.kill(kill({ victim: 5 }), 3);
    a.kill(kill({ victim: 6 }), 3);
    run(a, 3, 6);
    expect(heard).toEqual(['double_kill', 'multi_kill']);
    // Past the window: a new chain.
    a.kill(kill({ victim: 7 }), 10);
    a.kill(kill({ victim: 8 }), 15);
    run(a, 10, 16);
    expect(heard).toEqual(['double_kill', 'multi_kill']);
  });

  it('chains of 6-7 are Mega, 8 or 4 from one blast Server overload', () => {
    const { a, heard } = make(0.5);
    for (let i = 0; i < 6; i++) a.kill(kill({ victim: 10 + i }), i * 3);
    run(a, 15, 16);
    expect(heard.at(-1)).toBe('mega_kill');
    const b = make(0.5);
    for (let i = 0; i < 4; i++) b.a.kill(kill({ victim: 10 + i, explosive: true, blast: 'b1' }), 1);
    run(b.a, 1, 2);
    expect(b.heard).toEqual(['server_overload']);
  });

  it('Mr Boombastic for a blast double, once a chain', () => {
    const { a, heard } = make();
    a.kill(kill({ victim: 2, explosive: true, blast: 'b1' }), 0);
    a.kill(kill({ victim: 3, explosive: true, blast: 'b2' }), 2);
    run(a, 2, 5);
    a.kill(kill({ victim: 4, explosive: true, blast: 'b3' }), 5);
    run(a, 5, 8);
    expect(heard).toEqual(['mr_boombastic', 'triple_kill']);
  });

  it('streaks at 5, 10 and 15 kills in a life; a death resets them', () => {
    const { a, heard } = make(0.5);
    for (let i = 1; i <= 15; i++) {
      a.kill(kill({ victim: 100 + i }), i * 10);
      run(a, i * 10, i * 10 + 3);
    }
    expect(heard).toEqual(['killing_spree', 'eviscerator', 'never_stop']);
    a.kill({ killer: 7, victim: ME }, 200);
    for (let i = 1; i <= 4; i++) a.kill(kill({ victim: 300 + i }), 200 + i * 10);
    run(a, 200, 260);
    expect(heard).toEqual(['killing_spree', 'eviscerator', 'never_stop']);
  });

  it('special kills: headshots rotate, far ones are Dome shots; melee; a blown-up animal; Later gator', () => {
    const { a, heard } = make();
    const at = (t: number, k: Partial<KillInfo>) => {
      a.kill(kill({ victim: 50 + t, ...k }), t * 10);
      run(a, t * 10, t * 10 + 3);
    };
    at(1, { headshot: true, distance: 10 });
    at(2, { headshot: true, distance: 10 });
    at(3, { headshot: true, distance: 60 });
    at(4, { melee: true });
    at(5, { explosive: true, blast: 'x', victimAnimal: true });
    expect(heard.filter((l) => l !== 'killing_spree')).toEqual(['headshot', 'brain_cave', 'dome_shot', 'twist_his_eggplant', 'blew_up_a_dog']);
    // Someone on a streak of 5, ended by you.
    for (let i = 0; i < 5; i++) a.kill({ killer: 9, victim: 200 + i }, 100 + i * 10);
    a.kill(kill({ victim: 9 }), 160);
    run(a, 160, 163);
    expect(heard.at(-1)).toBe('later_gator');
  });

  it("only your kills are called; others' kills say nothing", () => {
    const { a, heard } = make();
    a.kill({ killer: 3, victim: 4, headshot: true }, 0);
    a.kill({ killer: 3, victim: 5 }, 0.5);
    run(a, 0, 3);
    expect(heard).toEqual([]);
  });

  it('three deaths without a kill: Irate now', () => {
    const { a, heard } = make();
    for (let i = 0; i < 3; i++) a.kill({ killer: 5, victim: ME }, i * 10);
    run(a, 20, 23);
    expect(heard).toEqual(['irate_now']);
  });

  it('one line at a time, the most important first, a cooldown between starts, stale lines dropped', () => {
    const { a, heard } = make(0.4);
    a.kill(kill({ headshot: true, distance: 5 }), 0);
    a.flag('take', 0);
    a.update(0);
    expect(heard).toEqual(['flag_taken']);
    a.update(COOLDOWN - 0.1);
    expect(heard).toEqual(['flag_taken']);
    a.update(COOLDOWN);
    expect(heard).toEqual(['flag_taken', 'headshot']);
    a.kill(kill({ victim: 9, headshot: true, distance: 5 }), 10);
    run(a, 20, 22);
    expect(heard.length).toBe(2);
  });

  it('hype: about one in three after a triple or a streak, into a quiet moment', () => {
    const lucky = make(0.5, 0);
    for (let i = 0; i < 3; i++) lucky.a.kill(kill({ victim: 10 + i }), 0);
    run(lucky.a, 0, 5);
    expect(lucky.heard[0]).toBe('triple_kill');
    expect(HYPE_LINES).toContain(lucky.heard[1]);
    const unlucky = make(0.5, 0.9);
    for (let i = 0; i < 3; i++) unlucky.a.kill(kill({ victim: 10 + i }), 0);
    run(unlucky.a, 0, 5);
    expect(unlucky.heard).toEqual(['triple_kill']);
  });

  it('match flow: 3-2-1 on the countdown (not again at the start), one minute once, ten left once, the lead at most once a minute', () => {
    const { a, heard } = make();
    expect(a.countdown(3, 0)).toBe(true);
    a.started(3);
    run(a, 3, 5);
    expect(heard).toEqual(['fight_321']);
    a.clock(61, 10);
    a.clock(60, 11);
    a.clock(59, 12);
    run(a, 11, 14);
    a.clock(61, 20);
    a.clock(60, 21);
    run(a, 21, 24);
    expect(heard).toEqual(['fight_321', 'one_minute_left']);
    a.scores(5, 30, false, 30);
    a.scores(20, 30, false, 31);
    a.scores(21, 30, false, 32);
    run(a, 31, 34);
    expect(heard.at(-1)).toBe('ten_kills_left');
    a.scores(21, 30, true, 40);
    run(a, 40, 43);
    a.scores(21, 30, false, 50);
    a.scores(22, 30, true, 51);
    run(a, 51, 54);
    expect(heard.filter((l) => l === 'hail_to_the_cheet').length).toBe(1);
    expect(heard.filter((l) => l === 'ten_kills_left').length).toBe(1);
  });

  it('falls back to the Kenney line where an owner line is not loaded, else says nothing', () => {
    const { a, heard } = make(null);
    expect(a.countdown(3, 0)).toBe(false);
    a.started(3);
    run(a, 3, 4);
    expect(heard).toEqual(['announce.fight']);
    a.kill(kill({ victim: 2 }), 10);
    a.kill(kill({ victim: 3 }), 11);
    a.kill(kill({ victim: 4, headshot: true }), 20);
    run(a, 11, 24);
    expect(heard).toEqual(['announce.fight', 'announce.multikill']);
  });

  it('the end: the result, then the top scorer, then the next map', () => {
    const { a, heard } = make(1);
    a.sound('announce.win', 'flow', 0, 'result');
    a.matchOver(true, true, 0.001);
    run(a, 0, 10);
    expect(heard).toEqual(['announce.win', 'this_is_my_rifle', 'next_in_queue']);
    expect(topScorer([{ s: 1, k: 5 }, { s: 2, k: 4 }], 1)).toBe(true);
    expect(topScorer([{ s: 1, k: 5 }, { s: 2, k: 5 }], 1)).toBe(false);
    expect(topScorer([{ s: 1, k: 0 }], 1)).toBe(false);
  });
});
