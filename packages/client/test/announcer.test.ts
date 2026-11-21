import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Announcer, COOLDOWN, HYPE_LINES, STREAK_LINES, VOICE_LINES, topScorer, type KillInfo } from '../src/audio/announcer.ts';
import type { SoundId, VoiceLine } from '../src/audio/audio.ts';

const ME = 1;
/** The spree's own lines (STREAK_LINES), left out where a test is about something else. */
const STREAK_LINES_SAID: string[] = ['give_me_more', 'killing_spree', 'this_is_wild', 'eviscerator', 'can_you_believe_it', 'never_stop'];

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
    // (The spree's own lines at 3 and 5 kills come after the chain's.)
    expect(heard.filter((l) => !STREAK_LINES_SAID.includes(l))).toEqual(['double_kill', 'multi_kill']);
    // Past the window: a new chain, and a double that doesn't beat the life's best says nothing.
    a.kill(kill({ victim: 7 }), 10);
    a.kill(kill({ victim: 8 }), 15);
    a.kill(kill({ victim: 9 }), 16);
    run(a, 10, 20);
    expect(heard.filter((l) => !STREAK_LINES_SAID.includes(l))).toEqual(['double_kill', 'multi_kill']);
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

  it('Mr Boombastic for a blast double, once a life', () => {
    const { a, heard } = make();
    a.kill(kill({ victim: 2, explosive: true, blast: 'b1' }), 0);
    a.kill(kill({ victim: 3, explosive: true, blast: 'b2' }), 2);
    run(a, 2, 5);
    a.kill(kill({ victim: 4, explosive: true, blast: 'b3' }), 5);
    run(a, 5, 12);
    expect(heard).toEqual(['mr_boombastic', 'triple_kill', 'give_me_more']);
  });

  it('one spree a life: streak lines at 3, 5, 7, 10, 12, 15, 20 and 25 kills, each once; a death starts it again', () => {
    expect([...STREAK_LINES.keys()]).toEqual([3, 5, 7, 10, 12, 15, 20, 25]);
    expect(STREAK_LINES.get(20)).toBe('server_overload');
    expect(STREAK_LINES.get(25)).toBe('mega_kill');
    // Kills 10 s apart (no chains), the dice never hype.
    const { a, heard } = make(0.5);
    for (let i = 1; i <= 26; i++) {
      a.kill(kill({ victim: 100 + i }), i * 10);
      run(a, i * 10, i * 10 + 3);
    }
    expect(heard).toEqual(['give_me_more', 'killing_spree', 'this_is_wild', 'eviscerator', 'can_you_believe_it', 'never_stop', 'server_overload', 'mega_kill']);
    // Dead: the next life's spree starts from the beginning.
    a.kill({ killer: 7, victim: ME }, 300);
    for (let i = 1; i <= 5; i++) {
      a.kill(kill({ victim: 300 + i }), 300 + i * 10);
      run(a, 300 + i * 10, 300 + i * 10 + 3);
    }
    expect(heard.slice(8)).toEqual(['give_me_more', 'killing_spree']);
  });

  it('Double and Triple at most once a life; after that a chain is called only when it beats the life\'s best', () => {
    const { a, heard } = make(0.5);
    let t = 0;
    const chain = (n: number) => {
      for (let i = 0; i < n; i++) a.kill(kill({ victim: 500 + t * 10 + i }), t + i);
      run(a, t, t + n + 6);
      t += n + 20;
    };
    chain(2);
    chain(2);
    chain(3);
    chain(2);
    chain(3);
    chain(4);
    const calls = heard.filter((l) => !STREAK_LINES_SAID.includes(l));
    expect(calls).toEqual(['double_kill', 'triple_kill', 'quadra_kill']);
    // No line twice in a life.
    expect(new Set(heard).size).toBe(heard.length);
    // A death: Double again.
    a.kill({ killer: 7, victim: ME }, t);
    chain(2);
    expect(heard.at(-1)).toBe('double_kill');
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
    expect(heard.filter((l) => !STREAK_LINES_SAID.includes(l))).toEqual(['headshot', 'brain_cave', 'dome_shot', 'twist_his_eggplant', 'blew_up_a_dog']);
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

  it('hype fills the quiet kills of a spree, about one in two, never the same twice running or a line the spree says', () => {
    // Lucky dice: kills 10 s apart, each without a line of its own, are filled with hype (at most once in 8 s).
    const lucky = make(0.5, 0);
    for (let i = 1; i <= 9; i++) {
      lucky.a.kill(kill({ victim: 10 + i }), i * 10);
      run(lucky.a, i * 10, i * 10 + 3);
    }
    // Kills 2, 4, 5 (after the spree's own at 3), 6… : the quiet ones get hype, the spree's own lines stay theirs.
    const hype = lucky.heard.filter((l) => HYPE_LINES.includes(l as VoiceLine) && !STREAK_LINES_SAID.includes(l));
    expect(hype.length).toBeGreaterThanOrEqual(3);
    expect(lucky.heard).toContain('killing_spree');
    // The spree's own lines are never used as filler, and a filler never follows itself.
    expect(lucky.heard.filter((l) => l === 'give_me_more' || l === 'this_is_wild')).toEqual(['give_me_more', 'this_is_wild']);
    const fills = lucky.heard.filter((l) => HYPE_LINES.includes(l as VoiceLine) && !STREAK_LINES_SAID.includes(l));
    expect(fills.filter((l, i) => i > 0 && l === fills[i - 1])).toEqual([]);
    // The first kill of a life is never hyped; unlucky dice, none.
    const unlucky = make(0.5, 0.9);
    for (let i = 1; i <= 4; i++) {
      unlucky.a.kill(kill({ victim: 10 + i }), i * 10);
      run(unlucky.a, i * 10, i * 10 + 3);
    }
    expect(unlucky.heard).toEqual(['give_me_more']);
    const first = make(0.5, 0);
    first.a.kill(kill(), 0);
    run(first.a, 0, 3);
    expect(first.heard).toEqual([]);
  });

  it('two hype lines never come back to back', () => {
    const { a, heard } = make(0.5, 0);
    a.line('incredible', 'hype', 0);
    run(a, 0, 4);
    a.line('did_you_see_that', 'hype', 4);
    run(a, 4, 8);
    expect(heard).toEqual(['incredible']);
    a.flag('take', 8);
    a.line('did_you_see_that', 'hype', 8);
    run(a, 8, 14);
    expect(heard).toEqual(['incredible', 'flag_taken', 'did_you_see_that']);
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
