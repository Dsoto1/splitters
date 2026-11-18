import ownerAudio from '../../../../content/owner-audio.json';
import type { AudioSystem, SoundId, VoiceLine } from './audio.ts';
import { versioned } from '../assetUrl.ts';

/** Every announcer line (content/owner-audio.json). */
export const VOICE_LINES = Object.keys(ownerAudio.announcer) as VoiceLine[];

let voiceAsked = false;

/**
 * Load the announcer's lines into `audio` (about half a megabyte): once audio is unlocked and the game's own sounds
 * are in, when the page is idle, so a match (or MapMaker's Test) never waits on them; a line not in yet falls back
 * or is skipped. Once a page.
 */
export function loadVoiceLines(audio: AudioSystem): void {
  if (voiceAsked) return;
  voiceAsked = true;
  audio.onUnlock(() =>
    void audio.load().then(() => {
      const go = () => {
        const ctx = audio.context;
        if (!ctx) return;
        for (const id of VOICE_LINES) {
          void fetch(versioned(`${import.meta.env.BASE_URL}voice/${id}.ogg`))
            .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`${res.status}`))))
            .then((data) => ctx.decodeAudioData(data))
            .then(
              (buf) => {
                audio.voice.set(id, buf);
                audio.stats.voice++;
              },
              (err) => {
                audio.stats.voiceFailed++;
                console.warn(`announcer line ${id} failed to load`, err);
              },
            );
        }
      };
      if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 4000 });
      else setTimeout(go, 1000);
    }),
  );
}

/**
 * The announcer (docs/AUDIO_MUSIC_ANNOUNCER_PLAN.md, "Announcer"): which of the owner's lines to say, when.
 *
 * One line at a time, at least COOLDOWN seconds from one start to the next; when several wait, the most important
 * goes first (PRIORITY: match flow, objectives, multi-kills, streaks, special kills, hype), and a newer line of the
 * same kind takes a waiting one's place (a grenade's three kills say the best of them, once). A line that has
 * waited too long is dropped (old news). Kill lines are only ever queued for the player they're about (the session
 * calls `kill` with its own slot); team and match lines are heard by everyone. A line that can't be heard yet (not
 * loaded) falls back to the old Kenney line where there is one, or is skipped.
 */
export const PRIORITY = { flow: 0, objective: 1, multi: 2, streak: 3, special: 4, hype: 5 } as const;
export type Priority = keyof typeof PRIORITY;

/** Seconds from one line's start to the next's (and at least a short breath after it ends). */
export const COOLDOWN = 2.5;
const BREATH = 0.3;
/** Kills this close together (seconds) make a multi-kill chain (the kill sound's window, sessionAudio.ts). */
export const MULTI_KILL_WINDOW = 4;
/** Kills from one explosion arrive together: this close (seconds) and from the same blast. */
const BLAST_WINDOW = 0.25;
/** A headshot from this far (m) says "Dome shot". */
export const DOME_SHOT_RANGE = 40;
/** Seconds a line may wait before it's dropped (match flow and objectives wait longer). */
const STALE = { flow: 8, objective: 5, multi: 3, streak: 3.5, special: 3.5, hype: 4 } as const;
/** Hype: about one time in three, at most once in this many seconds, and a beat after the line before it. */
const HYPE_CHANCE = 1 / 3;
const HYPE_GAP = 20;
const HYPE_BEAT = 0.8;
/** "Hail to the chief" at most once a minute. */
const LEAD_GAP = 60;

export const HYPE_LINES: readonly VoiceLine[] = ['this_is_wild', 'incredible', 'can_you_believe_it', 'i_freakin_love_it', 'did_you_see_that', 'give_me_more'];
const HEADSHOT_LINES: readonly VoiceLine[] = ['headshot', 'brain_cave', 'dome_shot'];

/** What the announcer says through: an owner line (its length in seconds, or null if it can't be heard) or a Kenney sound. */
export interface AnnouncerOut {
  speak(line: VoiceLine): number | null;
  sound(id: SoundId): number | null;
}

/** One kill, as the announcer needs it. */
export interface KillInfo {
  killer: number | null;
  victim: number;
  /** A team kill. */
  tk?: boolean;
  headshot?: boolean;
  /** Metres between killer and victim, where known. */
  distance?: number | null;
  melee?: boolean;
  /** Killed by a blast; `blast` tells explosions apart (the same blast's kills share it). */
  explosive?: boolean;
  blast?: string | null;
  /** The victim plays a character from the animals group. */
  victimAnimal?: boolean;
}

interface Pending {
  what: { line: VoiceLine } | { sound: SoundId };
  prio: Priority;
  /** A newer line of the same group replaces a waiting one. */
  group: string;
  at: number;
}

export class Announcer {
  private queue: Pending[] = [];
  /** When the next line may start, and when the last one ends. */
  private freeAt = 0;
  private lastEnd = 0;
  private lastHypeAt = -Infinity;
  private lastHype: VoiceLine | null = null;
  private headshotTurn = 0;
  /** Your kills this life, your kills in the current chain, deaths since your last kill. */
  private life = 0;
  private chain = 0;
  private chainAt = -Infinity;
  private chainExplosive = false;
  private boombastic = false;
  private blastKills = 0;
  private blastKey: string | null = null;
  private blastAt = -Infinity;
  private dryDeaths = 0;
  /** Everyone's kills this life (for "Later, gator": you end a streak of 5 or more). */
  private readonly lives = new Map<number, number>();
  /** Once a match. */
  private saidOneMinute = false;
  private saidTenLeft = false;
  private fightAt = -Infinity;
  private lastTime: number | null = null;
  private leading: boolean | null = null;
  private leadAt = -Infinity;
  private lastAliveRound: number | null = null;
  /** Lines said, for tests. */
  readonly said: string[] = [];

  constructor(
    private readonly out: AnnouncerOut,
    private readonly me: () => number,
    private readonly rng: () => number = Math.random,
  ) {}

  /** A new match (or rejoining): forget the last one's counts. */
  reset(): void {
    this.queue = [];
    this.life = this.chain = this.blastKills = this.dryDeaths = 0;
    this.chainAt = this.blastAt = -Infinity;
    this.lives.clear();
    this.saidOneMinute = this.saidTenLeft = false;
    this.lastTime = null;
    this.leading = null;
    this.lastAliveRound = null;
  }

  // ------------------------------------------------------------ the queue

  private push(what: Pending['what'], prio: Priority, group: string, now: number): void {
    this.queue = this.queue.filter((p) => p.group !== group);
    this.queue.push({ what, prio, group, at: now });
  }

  line(line: VoiceLine, prio: Priority, now: number, group: string = line): void {
    this.push({ line }, prio, group, now);
  }

  /** A Kenney announcer sound through the same queue (win, lose, tie: lines the owner's set has no match for). */
  sound(id: SoundId, prio: Priority, now: number, group: string = id): void {
    this.push({ sound: id }, prio, group, now);
  }

  /** Call every frame: say the most important waiting line once the last one is done. */
  update(now: number): void {
    this.queue = this.queue.filter((p) => now - p.at <= STALE[p.prio]);
    if (!this.queue.length || now < this.freeAt) return;
    this.queue.sort((a, b) => PRIORITY[a.prio] - PRIORITY[b.prio] || a.at - b.at);
    const next = this.queue[0]!;
    // Hype only into a quiet moment: never with another line waiting, and a beat after the last.
    if (next.prio === 'hype' && now < this.lastEnd + HYPE_BEAT) return;
    this.queue.shift();
    let secs: number | null;
    if ('line' in next.what) {
      secs = this.out.speak(next.what.line);
      if (secs === null) {
        const fb = FALLBACKS[next.what.line];
        secs = fb ? this.out.sound(fb) : null;
      }
      if (secs !== null) this.said.push(next.what.line);
    } else {
      secs = this.out.sound(next.what.sound);
      if (secs !== null) this.said.push(next.what.sound);
    }
    if (secs === null) return;
    this.lastEnd = now + secs;
    this.freeAt = Math.max(now + COOLDOWN, this.lastEnd + BREATH);
  }

  /** What waits to be said (tests). */
  waiting(): string[] {
    return this.queue.map((p) => ('line' in p.what ? p.what.line : p.what.sound));
  }

  // ------------------------------------------------------------ match flow

  /** The start countdown's seconds left: "3, 2, 1, FIGHT!" begins at 3 so its "FIGHT" lands on the start. */
  countdown(secondsLeft: number, now: number): boolean {
    if (secondsLeft !== 3 || now - this.fightAt < 6) return false;
    // Said at once, over anything else (nothing else is said in a countdown); not loaded yet, the start says "Fight!".
    const secs = this.out.speak('fight_321');
    if (secs === null) return false;
    this.said.push('fight_321');
    this.fightAt = now;
    this.queue = this.queue.filter((p) => p.group !== 'fight');
    this.lastEnd = now + secs;
    this.freeAt = Math.max(now + COOLDOWN, this.lastEnd + BREATH);
    return true;
  }

  /** The match or a round started (Fight!): the countdown's line if it hasn't just been said. */
  started(now: number): void {
    if (now - this.fightAt < 6) return;
    this.fightAt = now;
    this.line('fight_321', 'flow', now, 'fight');
  }

  /** Each snapshot while playing: the match clock (seconds; 0 when there is none). */
  clock(timeLeft: number, now: number): void {
    const before = this.lastTime;
    this.lastTime = timeLeft;
    if (this.saidOneMinute || before === null || timeLeft <= 0) return;
    if (before > 60 && timeLeft <= 60 && timeLeft > 45) {
      this.saidOneMinute = true;
      this.line('one_minute_left', 'flow', now);
    }
  }

  /**
   * Each snapshot while playing: the leader's score (the leading team's in team modes), the score limit (0: none),
   * and whether you (FFA) or your team lead outright.
   */
  scores(leader: number, limit: number, iLead: boolean, now: number): void {
    if (!this.saidTenLeft && limit >= 20 && leader >= limit - 10 && leader < limit) {
      this.saidTenLeft = true;
      this.line('ten_kills_left', 'flow', now);
    }
    const was = this.leading;
    this.leading = iLead;
    if (was === false && iLead && leader > 0 && now - this.leadAt >= LEAD_GAP) {
      this.leadAt = now;
      this.line('hail_to_the_cheet', 'special', now);
    }
  }

  /** A Breakthrough or Bomb round's end, by side. */
  sideWon(attackers: boolean, now: number): void {
    this.line(attackers ? 'attackers_win' : 'defenders_win', 'flow', now, 'round');
  }

  /** The match is over: you top the board (the long line), and the next map loads after the scoreboard. */
  matchOver(topScorer: boolean, nextMap: boolean, now: number): void {
    if (topScorer) this.line('this_is_my_rifle', 'flow', now);
    if (nextMap) this.line('next_in_queue', 'flow', now + 0.01);
  }

  // ------------------------------------------------------------ objectives (heard by all)

  flag(action: 'take' | 'drop' | 'return' | 'capture', now: number): void {
    const line = ({ take: 'flag_taken', drop: 'flag_dropped', return: 'flag_returned', capture: 'flag_captured' } as const)[action];
    this.line(line, 'objective', now, 'flag');
  }

  bomb(action: 'plant' | 'defuse', now: number): void {
    this.line(action === 'plant' ? 'bomb_planted' : 'bomb_disarmed', 'objective', now, 'bomb');
  }

  /** Elimination rounds: you're the last one standing on your team (once a round). */
  lastAlive(round: number, now: number): void {
    if (this.lastAliveRound === round) return;
    this.lastAliveRound = round;
    this.line('timmy', 'objective', now);
  }

  /** Roulette: your life rolled the jackpot. */
  jackpot(now: number): void {
    this.line('tree_fiddy', 'special', now);
  }

  // ------------------------------------------------------------ kills (yours only)

  kill(k: KillInfo, now: number): void {
    const me = this.me();
    const victimStreak = this.lives.get(k.victim) ?? 0;
    this.lives.delete(k.victim);
    if (k.killer !== null && k.killer !== k.victim) {
      if (k.tk) this.lives.delete(k.killer);
      else this.lives.set(k.killer, (this.lives.get(k.killer) ?? 0) + 1);
    }
    if (k.victim === me) {
      this.life = 0;
      this.chain = 0;
      // Three deaths in a row without a kill (however they came).
      if (++this.dryDeaths >= 3) {
        this.dryDeaths = 0;
        this.line('irate_now', 'special', now);
      }
      return;
    }
    if (k.killer !== me) return;
    if (k.tk) {
      this.life = 0;
      return;
    }
    this.dryDeaths = 0;
    this.life++;
    // The chain: each kill within the window of the last.
    if (now - this.chainAt <= MULTI_KILL_WINDOW) {
      this.chain++;
      this.chainExplosive &&= !!k.explosive;
    } else {
      this.chain = 1;
      this.chainExplosive = !!k.explosive;
      this.boombastic = false;
    }
    this.chainAt = now;
    if (k.explosive && k.blast && k.blast === this.blastKey && now - this.blastAt <= BLAST_WINDOW) this.blastKills++;
    else this.blastKills = k.explosive ? 1 : 0;
    this.blastKey = k.explosive ? (k.blast ?? null) : null;
    this.blastAt = now;

    let hyped = false;
    const multi = this.multiLine();
    if (multi) {
      this.line(multi, 'multi', now, 'multi');
      hyped = multi !== 'double_kill' && multi !== 'mr_boombastic';
    }
    const streak = this.life === 5 ? 'killing_spree' : this.life === 10 ? 'eviscerator' : this.life === 15 ? 'never_stop' : null;
    if (streak) {
      this.line(streak, 'streak', now, 'streak');
      hyped = true;
    }
    const special = victimStreak >= 5 ? 'later_gator' : k.explosive && k.victimAnimal ? 'blew_up_a_dog' : k.melee ? 'twist_his_eggplant' : k.headshot ? this.headshotLine(k.distance) : null;
    if (special) this.line(special, 'special', now, 'special');
    if (hyped && now - this.lastHypeAt >= HYPE_GAP && this.rng() < HYPE_CHANCE) {
      this.lastHypeAt = now;
      const pool = HYPE_LINES.filter((l) => l !== this.lastHype);
      this.lastHype = pool[Math.floor(this.rng() * pool.length)] ?? HYPE_LINES[0]!;
      this.line(this.lastHype, 'hype', now, 'hype');
    }
  }

  private multiLine(): VoiceLine | null {
    const n = this.chain;
    if (this.blastKills >= 4 || n >= 8) return 'server_overload';
    if (n >= 6) return 'mega_kill';
    if (n === 5) return 'multi_kill';
    if (n === 4) return 'quadra_kill';
    // Two or three kills, every one of them a blast: "Mr Boombastic" (once a chain) in place of Double or Triple.
    if ((n === 2 || n === 3) && this.chainExplosive && !this.boombastic) {
      this.boombastic = true;
      return 'mr_boombastic';
    }
    if (n === 3) return 'triple_kill';
    if (n === 2) return 'double_kill';
    return null;
  }

  private headshotLine(distance: number | null | undefined): VoiceLine {
    if (distance !== null && distance !== undefined && distance >= DOME_SHOT_RANGE) return 'dome_shot';
    const line = HEADSHOT_LINES[this.headshotTurn % HEADSHOT_LINES.length]!;
    this.headshotTurn++;
    return line;
  }
}

/** The old Kenney lines stand in where an owner line isn't loaded yet. */
const FALLBACKS: Partial<Record<VoiceLine, SoundId>> = {
  fight_321: 'announce.fight',
  double_kill: 'announce.multikill',
  triple_kill: 'announce.multikill',
  quadra_kill: 'announce.multikill',
  multi_kill: 'announce.multikill',
  mega_kill: 'announce.multikill',
  server_overload: 'announce.multikill',
  mr_boombastic: 'announce.multikill',
};

/** Whether `slot` tops the board at the end: the most kills, above zero, nobody level. */
export function topScorer(scores: readonly { s: number; k: number }[], slot: number): boolean {
  const mine = scores.find((x) => x.s === slot)?.k ?? 0;
  return mine > 0 && scores.every((x) => x.s === slot || x.k < mine);
}
