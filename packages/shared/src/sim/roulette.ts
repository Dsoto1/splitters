/**
 * Roulette (docs/ROULETTE_MODE_PLAN.md; the mode `core.roulette`, or `rules.roulette` in another mode): a new
 * character every life, dealt from each player's own shuffled deck of the roster, with character stats on, a spawn
 * card, a moment of spawn protection; and, unless switched off, signature loadouts, jackpot rolls (the Giant Slayer
 * bonus with them) and a streak pick. Its variants: earned rerolls, swap on kill, the variety bonus; and Lunar's extras
 * (sim/match.ts: air kills here, the gravity storm here, the knock-about blasts and stronger pads in the match).
 *
 * Everything is sim state and deterministic by the match seed: decks, rolls, picks and tokens. A player's pick and
 * reroll are small client inputs (`PlayerInput.say`, ROULETTE_SAY_*), checked here. The data (signatures, the jackpot
 * weapons, the odds) is content/roulette.json (content/roulette.generated.ts).
 */
import { ROULETTE_DATA } from '../content/roulette.generated.ts';
import { getLook } from '../content/looks.ts';
import type { GameEvent } from '../protocol.ts';
import { TICK_RATE } from './constants.ts';
import { lookGroup } from './npc.ts';
import { RANDOM_LOOK_POOL, lookMix } from './randomLooks.ts';
import type { MatchRules } from './rules.ts';
import { matchStats } from './characterStats.ts';
import { inSetOr, type WeaponSetDef } from './weaponSets.ts';

// ------------------------------------------------------------------ data

const SIGNATURES = ROULETTE_DATA.characters as Readonly<Record<string, string>>;
const GROUP_SIGNATURES = ROULETTE_DATA.groups as Readonly<Record<string, string>>;
const JACKPOT_WEAPONS = ROULETTE_DATA.jackpot as Readonly<Record<string, string>>;

/** Kills in one life that earn a streak pick, and cards a pick offers. */
export const STREAK_PICK_KILLS: number = ROULETTE_DATA.streakPick;
export const PICK_CARDS = 3;
/** Earned rerolls: kills per token, and tokens held at most. */
export const REROLL_EVERY: number = ROULETTE_DATA.rerollEvery;
export const REROLL_MAX: number = ROULETTE_DATA.rerollMax;
/** Per life: the chance of a jackpot roll and of a tiny roll; each card of a pick, its own jackpot chance. */
export const JACKPOT_ODDS: number = ROULETTE_DATA.odds.jackpot;
export const TINY_ODDS: number = ROULETTE_DATA.odds.tiny;
export const PICK_JACKPOT_ODDS: number = ROULETTE_DATA.odds.pickJackpot;
export const JACKPOT_ARMOR: number = ROULETTE_DATA.jackpotArmor;
/** A tiny roll's body (a multiple of the character's own size) and speed. */
export const TINY_SIZE: number = ROULETTE_DATA.tiny.size;
export const TINY_SPEED: number = ROULETTE_DATA.tiny.speed;
/** Variety bonus: a point each time the characters a player has scored as reach another this many. */
export const VARIETY_EVERY = 3;
/** The spawn card's seconds on screen (the client's). */
export const SPAWN_CARD_SECONDS = 2;
/** A streak pick holds the respawn this long at most (seconds after death) for the choice; choosing spawns at the usual time. */
export const PICK_HOLD_SECONDS = 6;
/** The gravity storm (Lunar): calm, then a 3-second warning, then gravity shifted for a while; every minute. */
export const STORM_EVERY_SECONDS = 60;
export const STORM_WARN_SECONDS = 3;
export const STORM_SECONDS = 12;
/** What a storm does to the match's gravity (a multiple), in turn from a seeded start: lighter or heavier. */
export const STORM_FACTORS: readonly number[] = [0.35, 2.5, 0.55, 3];
/** Window of deals with no card twice (across the end of one deck and the start of the next). */
export const NO_REPEAT = 6;

/** `PlayerInput.say` values: pick card 0-2 of a streak pick, or spend a reroll token (below the class screen's 200). */
export const ROULETTE_SAY_PICK = 180;
export const ROULETTE_SAY_REROLL = 185;
export const isRouletteSay = (say: number | undefined): boolean => say !== undefined && say >= ROULETTE_SAY_PICK && say <= ROULETTE_SAY_REROLL;

/** A life's roll: a jackpot (the glow, an announcer line, a better signature and armour), tiny (a smaller, quicker body), or plain. */
export type RouletteRoll = 'jackpot' | 'tiny' | null;

/** A look's signature weapon (its own, else its group's, else the rifle), before the weapon set has its say. */
export function signatureOf(look: string): string {
  return SIGNATURES[look] ?? GROUP_SIGNATURES[lookGroup(look) ?? ''] ?? 'core.rifle';
}

/** The weapon a life spawns holding: the signature (a jackpot's better one), as the weapon set allows (else its main gun); null where weapons are fixed. */
export function signatureWeapon(look: string, jackpot: boolean, set: WeaponSetDef | null): string | null {
  if (!set) return null;
  const sig = signatureOf(look);
  const better = jackpot ? JACKPOT_WEAPONS[sig] : undefined;
  const id = better ?? sig;
  return inSetOr(set, id);
}

/** A share 0..1 from a seeded hash (the same everywhere). */
const unit = (seed: number, a: number, b: number): number => lookMix(seed | 0, a | 0, b | 0) / 0x1_0000_0000;

/**
 * A slot's deck for a round of the roster: a seeded shuffle of the pool's indexes. The first NO_REPEAT cards are
 * never among the last NO_REPEAT of the round before, so no card comes back within NO_REPEAT deals.
 */
export function rouletteDeck(seed: number, slot: number, round: number, n = RANDOM_LOOK_POOL.length): number[] {
  const deck = shuffled(seed, slot, round, n);
  if (round === 0) return deck;
  const k = Math.min(NO_REPEAT, Math.floor(n / 3));
  const before = shuffled(seed, slot, round - 1, n);
  // (The round before was fixed up the same way only at its start: its tail is its shuffle's own.)
  const tail = new Set(before.slice(n - k));
  for (let i = 0; i < k; i++) {
    if (!tail.has(deck[i]!)) continue;
    for (let j = k; j < n; j++) {
      if (tail.has(deck[j]!)) continue;
      [deck[i], deck[j]] = [deck[j]!, deck[i]!];
      break;
    }
  }
  return deck;
}

function shuffled(seed: number, slot: number, round: number, n: number): number[] {
  const deck = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = lookMix(seed ^ 0x52_4f_55_4c, slot * 4099 + round, i) % (i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

/** A life's roll (`life` from 1): jackpot, tiny or plain, from the odds. */
export function rouletteRoll(seed: number, slot: number, life: number): RouletteRoll {
  const u = unit(seed ^ 0x4a_50, slot, life);
  return u < JACKPOT_ODDS ? 'jackpot' : u < JACKPOT_ODDS + TINY_ODDS ? 'tiny' : null;
}

/** Whether card `card` of the streak pick a slot was offered in its `life`-th life is a jackpot. */
export const pickJackpot = (seed: number, slot: number, life: number, card: number): boolean => unit(seed ^ 0x50_4b, slot, life * 8 + card) < PICK_JACKPOT_ODDS;

/** A look's size class as the match plays it: small, standard or large (by its body size). */
export function bodyClass(look: string, rules: Pick<MatchRules, 'bodySizes' | 'characterStats'>): 'small' | 'standard' | 'large' {
  const size = matchStats(look, rules).size;
  return size < 0.9 ? 'small' : size > 1.1 ? 'large' : 'standard';
}

/** The spawn card's line under the name: "Large: tougher, slower" (the client's). */
export function bodyLine(look: string, rules: Pick<MatchRules, 'bodySizes' | 'characterStats'>, roll: RouletteRoll = null): string {
  if (roll === 'tiny') return 'Tiny: hard to hit, quick, fragile';
  const cls = bodyClass(look, rules);
  return cls === 'large' ? 'Large: tougher, slower' : cls === 'small' ? 'Small: quick, hard to hit, fragile' : 'Standard: all-round';
}

/** Whether the setting is on: the standard features unless switched off, the variants only when switched on. */
export const rouletteSignatures = (r: MatchRules): boolean => r.rouletteSignature !== false;
export const rouletteJackpots = (r: MatchRules): boolean => r.rouletteJackpots !== false;
export const rouletteStreakPicks = (r: MatchRules): boolean => r.rouletteStreakPick !== false;

// ------------------------------------------------------------------ the director

/** What Roulette needs of a player (sim/match.ts Combatant). */
export interface RouletteBody {
  slot: number;
  kind: 'human' | 'bot' | 'npc';
  look: string;
  alive: boolean;
  respawnTick: number;
  kills: number;
  size: number;
  speedMul: number;
  armor: number;
  name: string;
  move: { grounded: boolean; climb?: unknown; swim?: unknown; chute?: unknown; zip?: unknown };
  mount?: unknown;
}

interface Seat {
  round: number;
  pos: number;
  deck: number[];
  /** The card the next life plays (dealt ahead, so a reroll and the death screen can show it). */
  next: string;
  life: number;
  /** This life's roll and start (tick). */
  roll: RouletteRoll;
  spawnTick: number;
  lifeKills: number;
  pickEarned: boolean;
  /** A streak pick on offer while down: its cards, which are jackpots, and the choice (-1: none yet). */
  offer: { cards: string[]; jackpots: boolean[]; chosen: number } | null;
  /** The respawn time the match set, before a pick held it. */
  dueTick: number;
  tokens: number;
  towardToken: number;
  // The awards and the bonus.
  played: Set<string>;
  scoredAs: Set<string>;
  giantKills: number;
  airKills: number;
  bonus: number;
  picks: number;
  rerolls: number;
  jackpots: number;
  /** The shortest life (ticks) and the look it was in. */
  shortest: { ticks: number; look: string } | null;
}

export interface RouletteHost {
  readonly seed: number;
  readonly rules: MatchRules;
  tick(): number;
  emit(ev: GameEvent): void;
  /** The weapon set in play (null: fixed weapons). */
  weaponSet(): WeaponSetDef | null;
  /** The match's own gravity multiple (Lunar's low gravity), the storm's base. */
  readonly baseGravity: number;
}

/** An award at the end of a match: [kind, slot, value, look]. Value: characters, kills, air kills or tenths of a second. */
export type RouletteAward = [kind: 'shapeshifter' | 'giantslayer' | 'moonwalker' | 'unlucky', slot: number, value: number, look?: string];

/** The private part a player sees of their own Roulette state (PrivateState.rp). */
export interface RoulettePrivate {
  /** The next card (your next life's character). */
  n: string;
  /** Reroll tokens held (Earned rerolls). */
  t?: number;
  /** A streak pick on offer: its cards, which are jackpots (bits), and the choice (-1 none). */
  o?: string[];
  oj?: number;
  oc?: number;
  /** A pick earned this life (you choose at your next spawn). */
  pe?: 1;
  /** This life's roll: 1 jackpot, 2 tiny. */
  j?: 1 | 2;
  /** Kills this life. */
  lk?: number;
}

export class RouletteDirector {
  private readonly seats = new Map<number, Seat>();
  private readonly pool = RANDOM_LOOK_POOL;
  /** Gravity storm (Lunar): 0 calm, 1 warning, 2 on; the tick the phase ends; the storm's gravity; storms so far. */
  storm = { phase: 0 as 0 | 1 | 2, until: 0, gravity: 1, count: 0 };

  constructor(private readonly host: RouletteHost) {
    this.storm.gravity = host.baseGravity;
  }

  private get rules(): MatchRules {
    return this.host.rules;
  }

  private seat(c: { slot: number }): Seat {
    let s = this.seats.get(c.slot);
    if (!s) {
      const deck = rouletteDeck(this.host.seed, c.slot, 0, this.pool.length);
      s = { round: 0, pos: 0, deck, next: '', life: 0, roll: null, spawnTick: 0, lifeKills: 0, pickEarned: false, offer: null, dueTick: 0, tokens: 0, towardToken: 0, played: new Set(), scoredAs: new Set(), giantKills: 0, airKills: 0, bonus: 0, picks: 0, rerolls: 0, jackpots: 0, shortest: null };
      s.next = this.draw(s, c.slot);
      this.seats.set(c.slot, s);
    }
    return s;
  }

  /** The next card off a slot's deck (a new round of the roster when it runs out). */
  private draw(s: Seat, slot: number): string {
    if (s.pos >= s.deck.length) {
      s.round++;
      s.pos = 0;
      s.deck = rouletteDeck(this.host.seed, slot, s.round, this.pool.length);
    }
    return this.pool[s.deck[s.pos++]!]!;
  }

  /** The cards a slot will be dealt next (the client preloads them): its next card, then the deck's following ones. */
  upcoming(c: { slot: number }, n: number): string[] {
    const s = this.seat(c);
    const out = [s.next];
    let round = s.round;
    let pos = s.pos;
    let deck = s.deck;
    while (out.length < n) {
      if (pos >= deck.length) {
        round++;
        pos = 0;
        deck = rouletteDeck(this.host.seed, c.slot, round, this.pool.length);
      }
      out.push(this.pool[deck[pos++]!]!);
    }
    return out;
  }

  /**
   * A life begins: the look it plays (the pick chosen, else the next card) and its roll. The match then sets the
   * look's body and loadout, and calls `equip`.
   */
  deal(c: RouletteBody): { look: string; roll: RouletteRoll } {
    const s = this.seat(c);
    s.life++;
    let look = s.next;
    let roll: RouletteRoll = this.rolls ? rouletteRoll(this.host.seed, c.slot, s.life) : null;
    if (s.offer) {
      const i = Math.max(0, s.offer.chosen);
      look = s.offer.cards[i] ?? look;
      roll = s.offer.jackpots[i] && this.rolls ? 'jackpot' : roll === 'jackpot' ? null : roll;
      if (s.offer.chosen >= 0) s.picks++;
      s.offer = null;
    }
    s.next = this.draw(s, c.slot);
    s.roll = roll;
    s.spawnTick = this.host.tick();
    s.lifeKills = 0;
    s.pickEarned = false;
    s.played.add(look);
    if (roll === 'jackpot') s.jackpots++;
    return { look, roll };
  }

  private get rolls(): boolean {
    return rouletteJackpots(this.rules);
  }

  /** The weapon this life spawns holding (signature loadouts), or null: none to add. */
  signatureFor(c: RouletteBody): string | null {
    if (!rouletteSignatures(this.rules)) return null;
    return signatureWeapon(c.look, this.seat(c).roll === 'jackpot', this.host.weaponSet());
  }

  /** After the match set the body and the loadout: a jackpot's armour, a tiny body; the spawn's announcements (spawn protection is the match's: content/match-play.json). */
  equip(c: RouletteBody): void {
    const s = this.seat(c);
    if (s.roll === 'jackpot') {
      c.armor = Math.max(c.armor, JACKPOT_ARMOR);
      this.host.emit({ e: 'rl', a: 'jackpot', s: c.slot, l: c.look });
    } else if (s.roll === 'tiny') {
      c.size *= TINY_SIZE;
      c.speedMul *= TINY_SPEED;
    }
  }

  /** The look a slot plays this life, its roll (for snapshots and the spawn event). */
  rollOf(c: { slot: number }): RouletteRoll {
    return this.seats.get(c.slot)?.roll ?? null;
  }

  /**
   * A kill (after the match booked it; `killer` scores, not a team kill). Returns the bonus points the killer earns
   * (Giant Slayer, an air kill with Lunar, the variety bonus) and, with Swap on kill, the look the killer becomes.
   */
  onKill(victim: RouletteBody, killer: RouletteBody | null, scored: boolean): { bonus: number; swap: string | null } {
    const v = this.seat(victim);
    const lived = this.host.tick() - v.spawnTick;
    if (victim.kind !== 'npc' && (!v.shortest || lived < v.shortest.ticks) && v.life > 0) v.shortest = { ticks: lived, look: victim.look };
    let bonus = 0;
    let swap: string | null = null;
    if (killer && scored && killer !== victim && killer.kind !== 'npc') {
      const k = this.seat(killer);
      k.lifeKills++;
      // Streak pick: so many kills in one life earn a choice of three at the next spawn.
      if (rouletteStreakPicks(this.rules) && k.lifeKills === STREAK_PICK_KILLS && !k.pickEarned) {
        k.pickEarned = true;
        this.host.emit({ e: 'rl', a: 'pick', s: killer.slot });
      }
      // Earned rerolls: a token per so many kills, never more than the most.
      if (this.rules.rouletteRerolls && k.tokens < REROLL_MAX && ++k.towardToken >= REROLL_EVERY) {
        k.towardToken = 0;
        k.tokens++;
        this.host.emit({ e: 'rl', a: 'token', s: killer.slot, n: k.tokens });
      }
      // Giant Slayer: a small character downs a large one.
      if (this.rolls && bodyClass(killer.look, this.rules) === 'small' && bodyClass(victim.look, this.rules) === 'large') {
        k.giantKills++;
        bonus++;
        this.host.emit({ e: 'rl', a: 'giant', s: killer.slot, t: victim.slot });
      }
      // Lunar: a kill made off the ground.
      if (this.rules.lunar && !killer.move.grounded && !killer.move.climb && !killer.move.swim && killer.move.zip === undefined && !killer.mount) {
        k.airKills++;
        bonus++;
        this.host.emit({ e: 'rl', a: 'air', s: killer.slot });
      }
      // Variety bonus: kills as several different characters, a point each time the characters you have scored as
      // reach another VARIETY_EVERY (3, 6, 9…).
      if (this.rules.rouletteVariety && !k.scoredAs.has(killer.look)) {
        k.scoredAs.add(killer.look);
        if (k.scoredAs.size % VARIETY_EVERY === 0) {
          bonus++;
          this.host.emit({ e: 'rl', a: 'variety', s: killer.slot, n: k.scoredAs.size });
        }
      }
      if (this.rules.rouletteSwapOnKill && victim.look !== killer.look && victim.kind !== 'npc') {
        swap = victim.look;
        k.played.add(swap);
      }
      k.bonus += bonus;
    }
    // The fallen: a streak pick earned this life goes on offer for the next spawn.
    if (victim.kind !== 'npc' && v.pickEarned) this.offerPick(victim, v);
    return { bonus, swap };
  }

  /** A streak pick: three cards (the next and the two after), each with its own jackpot chance; the respawn waits for the choice. */
  private offerPick(c: RouletteBody, s: Seat): void {
    const cards = [s.next];
    while (cards.length < PICK_CARDS) cards.push(this.draw(s, c.slot));
    const jackpots = cards.map((_, i) => this.rolls && pickJackpot(this.host.seed, c.slot, s.life, i));
    s.offer = { cards, jackpots, chosen: -1 };
    s.pickEarned = false;
    s.dueTick = c.respawnTick;
    // People get a moment to choose; bots choose at once.
    if (c.kind === 'human') c.respawnTick = Math.max(c.respawnTick, this.host.tick() + Math.round(PICK_HOLD_SECONDS * TICK_RATE));
  }

  /** A player's Roulette input (`say`): pick a card of the streak pick, or spend a reroll token. True when it was Roulette's. */
  input(c: RouletteBody, say: number | undefined): boolean {
    if (!isRouletteSay(say)) return false;
    const s = this.seat(c);
    if (c.alive) return true;
    if (say === ROULETTE_SAY_REROLL) this.reroll(c, s);
    else this.choose(c, s, say! - ROULETTE_SAY_PICK);
    return true;
  }

  private choose(c: RouletteBody, s: Seat, i: number): void {
    if (!s.offer || s.offer.chosen >= 0 || i < 0 || i >= s.offer.cards.length) return;
    s.offer.chosen = i;
    // Chosen: back to the usual respawn time.
    c.respawnTick = Math.max(this.host.tick(), Math.min(c.respawnTick, s.dueTick || c.respawnTick));
    this.host.emit({ e: 'rl', a: 'chose', s: c.slot, l: s.offer.cards[i]! });
  }

  /** Earned rerolls: a token spent while down deals a new next card (or a new pick). */
  private reroll(c: RouletteBody, s: Seat): void {
    if (!this.rules.rouletteRerolls || s.tokens <= 0) return;
    if (s.offer && s.offer.chosen >= 0) return;
    s.tokens--;
    s.rerolls++;
    s.next = this.draw(s, c.slot);
    if (s.offer) {
      const cards = [s.next];
      while (cards.length < PICK_CARDS) cards.push(this.draw(s, c.slot));
      s.offer = { cards, jackpots: cards.map((_, i) => this.rolls && pickJackpot(this.host.seed, c.slot, s.life + 100 * s.rerolls, i)), chosen: -1 };
    }
    this.host.emit({ e: 'rl', a: 'reroll', s: c.slot, l: s.next, n: s.tokens });
  }

  /**
   * A bot's choices while down (it has no screen): the pick's jackpot card, else the body it plays best (the bigger
   * one for a pusher, the smaller for a flanker), else the first; a reroll token spent on a next card of a size it plays
   * badly, or rather than waste one at the most.
   */
  botChoose(c: RouletteBody, style: { push: boolean; flank: boolean }): void {
    const s = this.seats.get(c.slot);
    if (!s || c.alive) return;
    if (this.rules.rouletteRerolls && s.tokens > 0 && !s.offer) {
      const cls = bodyClass(s.next, this.rules);
      const bad = (style.push && cls === 'small') || (style.flank && cls === 'large');
      if (bad || s.tokens >= REROLL_MAX) this.reroll(c, s);
    }
    if (s.offer && s.offer.chosen < 0) {
      const score = (look: string, i: number): number => {
        const cls = bodyClass(look, this.rules);
        const fit = style.push ? (cls === 'large' ? 2 : cls === 'small' ? -1 : 0) : style.flank ? (cls === 'small' ? 2 : cls === 'large' ? -1 : 0) : 0;
        return (s.offer!.jackpots[i] ? 10 : 0) + fit + matchStats(look, this.rules).health / 100;
      };
      let best = 0;
      for (let i = 1; i < s.offer.cards.length; i++) if (score(s.offer.cards[i]!, i) > score(s.offer.cards[best]!, best)) best = i;
      this.choose(c, s, best);
    }
  }

  /** A player is leaving: their seat goes (a new one in the slot starts a deck of its own). */
  forget(slot: number): void {
    this.seats.delete(slot);
  }

  /** A new round: back to fresh decks, tokens and counts; the storm calms. */
  reset(): void {
    this.seats.clear();
    this.calm();
  }

  /** The match's own gravity (the storm over). */
  calmGravity(): number {
    this.storm.phase = 0;
    this.storm.gravity = this.host.baseGravity;
    return this.host.baseGravity;
  }

  /** Play begins (or begins again): the storm is calm, the next one a minute away. */
  calm(): void {
    this.storm = { phase: 0, until: this.host.tick() + this.stormCalm(), gravity: this.host.baseGravity, count: 0 };
  }

  private stormCalm(): number {
    return Math.round((STORM_EVERY_SECONDS - STORM_WARN_SECONDS) * TICK_RATE);
  }

  /**
   * Once a tick while in play: the gravity storm (Lunar). Returns the gravity multiple the match plays now (the base,
   * or the storm's while it blows).
   */
  step(): number {
    if (!this.rules.lunar) return this.host.baseGravity;
    const t = this.host.tick();
    const st = this.storm;
    if (st.until === 0) st.until = t + this.stormCalm();
    if (t >= st.until) {
      if (st.phase === 0) {
        st.phase = 1;
        st.until = t + STORM_WARN_SECONDS * TICK_RATE;
        const f = STORM_FACTORS[(lookMix(this.host.seed, 0x5354, 0) + st.count) % STORM_FACTORS.length]!;
        st.gravity = Math.max(0.1, Math.min(1.6, Math.round(this.host.baseGravity * f * 100) / 100));
        this.host.emit({ e: 'rl', a: 'storm', n: 1, g: st.gravity });
      } else if (st.phase === 1) {
        st.phase = 2;
        st.until = t + STORM_SECONDS * TICK_RATE;
        st.count++;
        this.host.emit({ e: 'rl', a: 'storm', n: 2, g: st.gravity });
      } else {
        st.phase = 0;
        st.until = t + this.stormCalm();
        st.gravity = this.host.baseGravity;
        this.host.emit({ e: 'rl', a: 'storm', n: 0, g: st.gravity });
      }
    }
    return st.phase === 2 ? st.gravity : this.host.baseGravity;
  }

  /** The storm for snapshots (`rl`): [phase, seconds left in it, gravity now ×100, the storm's gravity ×100]; null without Lunar. */
  snapshot(): [number, number, number, number] | null {
    if (!this.rules.lunar) return null;
    const st = this.storm;
    const left = Math.max(0, Math.ceil((st.until - this.host.tick()) / TICK_RATE));
    return [st.phase, left, Math.round((st.phase === 2 ? st.gravity : this.host.baseGravity) * 100), Math.round(st.gravity * 100)];
  }

  /** What a player sees of their own Roulette state (PrivateState.rp). */
  privateState(c: RouletteBody): RoulettePrivate {
    const s = this.seat(c);
    return {
      n: s.next,
      ...(this.rules.rouletteRerolls ? { t: s.tokens } : {}),
      ...(s.offer ? { o: s.offer.cards, oj: s.offer.jackpots.reduce((b, j, i) => b | (j ? 1 << i : 0), 0), oc: s.offer.chosen } : {}),
      ...(s.pickEarned ? { pe: 1 as const } : {}),
      ...(s.roll ? { j: s.roll === 'jackpot' ? (1 as const) : (2 as const) } : {}),
      ...(s.lifeKills ? { lk: s.lifeKills } : {}),
    };
  }

  /** Counts for the scorecard (bot-report): picks taken, rerolls spent, jackpots and Giant Slayer kills, and the characters each played. */
  stats(slot: number): { picks: number; rerolls: number; jackpots: number; giant: number; air: number; bonus: number; played: number } | null {
    const s = this.seats.get(slot);
    return s ? { picks: s.picks, rerolls: s.rerolls, jackpots: s.jackpots, giant: s.giantKills, air: s.airKills, bonus: s.bonus, played: s.played.size } : null;
  }

  /**
   * The awards at the end of a match, among the players still in it: Shapeshifter (most different characters),
   * Giant Slayer (most kills of large characters as a small one), Moonwalker (most air kills, with Lunar on), Unluckiest
   * Roll (the shortest life). Ties go to the lower slot; an award nobody earned isn't given.
   */
  awards(players: readonly RouletteBody[]): RouletteAward[] {
    const out: RouletteAward[] = [];
    const seats = players.filter((p) => p.kind !== 'npc').map((p) => [p, this.seats.get(p.slot)] as const).filter((x): x is readonly [RouletteBody, Seat] => !!x[1]);
    const best = (value: (s: Seat) => number): readonly [RouletteBody, Seat] | null => {
      let top: readonly [RouletteBody, Seat] | null = null;
      for (const x of seats) if (value(x[1]) > 0 && (!top || value(x[1]) > value(top[1]) || (value(x[1]) === value(top[1]) && x[0].slot < top[0].slot))) top = x;
      return top;
    };
    const shape = best((s) => s.played.size);
    if (shape && shape[1].played.size >= 2) out.push(['shapeshifter', shape[0].slot, shape[1].played.size]);
    const giant = best((s) => s.giantKills);
    if (giant) out.push(['giantslayer', giant[0].slot, giant[1].giantKills]);
    if (this.rules.lunar) {
      const moon = best((s) => s.airKills);
      if (moon) out.push(['moonwalker', moon[0].slot, moon[1].airKills]);
    }
    let unlucky: readonly [RouletteBody, Seat] | null = null;
    for (const x of seats) if (x[1].shortest && (!unlucky || x[1].shortest.ticks < unlucky[1].shortest!.ticks)) unlucky = x;
    if (unlucky) out.push(['unlucky', unlucky[0].slot, Math.round((unlucky[1].shortest!.ticks / TICK_RATE) * 10), unlucky[1].shortest!.look]);
    return out;
  }
}
