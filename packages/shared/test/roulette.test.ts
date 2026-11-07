// Roulette (docs/ROULETTE_MODE_PLAN.md; sim/roulette.ts): decks, signature loadouts, rolls, the streak pick, the
// variants (earned rerolls, swap on kill, variety, Lunar's extras and storm, teams) and the awards.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_FIRE,
  CORE_LOOKS,
  DEFAULT_ROULETTE_RULES,
  FX_JACKPOT,
  FX_PROTECTED,
  JACKPOT_ARMOR,
  JACKPOT_ODDS,
  NO_REPEAT,
  PICK_JACKPOT_ODDS,
  RANDOM_LOOK_POOL,
  REROLL_MAX,
  RETIRED_LOOKS,
  ROULETTE_SAY_PICK,
  ROULETTE_SAY_REROLL,
  RouletteDirector,
  STORM_SECONDS,
  STORM_WARN_SECONDS,
  STREAK_PICK_KILLS,
  TICK_RATE,
  TINY_ODDS,
  TINY_SIZE,
  awardText,
  bodyClass,
  getLook,
  getWeapon,
  getWeaponSet,
  initPhysics,
  lookGroup,
  matchStats,
  pickJackpot,
  playableModes,
  rouletteDeck,
  rouletteRoll,
  rulesFromSetup,
  setVariant,
  signatureOf,
  signatureWeapon,
  weaponCode,
  type GameEvent,
  type MapDocument,
  type MatchRules,
  type MatchSetup,
  type PlayerInput,
  type RouletteBody,
} from '../src/index.ts';
import { ROULETTE_DATA } from '../src/content/roulette.generated.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

function yard(spawns: [number, number, number][] = [[0, 0, 4], [12, 0, 4], [24, 0, 4]]): MapDocument {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, spawns);
}

class Driver {
  seq = 0;
  constructor(readonly match: Match) {}
  input(c: Combatant, i: Partial<PlayerInput>): void {
    this.match.queueInputs(c.slot, [{ seq: ++this.seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
  }
  run(n: number, each: () => void = () => {}): GameEvent[] {
    const out: GameEvent[] = [];
    for (let i = 0; i < n; i++) {
      each();
      out.push(...this.match.step());
    }
    return out;
  }
}

/** The match's own kill (as a shot that downs `victim` would book it). */
const kill = (m: Match, victim: Combatant, killer: Combatant | null, weapon = 'core.pistol') => (m as unknown as { kill(v: Combatant, k: Combatant | null, w: string): void }).kill(victim, killer, weapon);
const hurt = (m: Match, victim: Combatant, amount: number, by: Combatant | null) => (m as unknown as { damage(v: Combatant, a: number, k: Combatant | null, w: string): void }).damage(victim, amount, by, 'core.pistol');

function roulette(extra: Partial<MatchRules> = {}, seed = 7) {
  const match = new Match(yard(), { ...DEFAULT_ROULETTE_RULES, respawnDelayTicks: 1, scoreLimit: 0, ...extra }, seed);
  const d = new Driver(match);
  const a = match.addHuman('a', 'core.sprout')!;
  const b = match.addHuman('b', 'core.knight')!;
  return { match, d, a, b };
}

/** A director on its own, for the deck and the awards. */
function director(rules: Partial<MatchRules> = {}, seed = 3) {
  let tick = 0;
  const events: GameEvent[] = [];
  const dir = new RouletteDirector({ seed, rules: { ...DEFAULT_ROULETTE_RULES, ...rules }, tick: () => tick, emit: (e) => events.push(e), weaponSet: () => getWeaponSet('standard'), baseGravity: 0.4 });
  const body = (slot: number, kind: RouletteBody['kind'] = 'human'): RouletteBody => ({ slot, kind, look: 'core.ranger', alive: true, respawnTick: 0, kills: 0, size: 1, speedMul: 1, armor: 0, name: `p${slot}`, move: { grounded: true } });
  return { dir, events, body, advance: (n: number) => (tick += n), now: () => tick };
}

describe('decks', () => {
  it('a deck is the whole roster, shuffled from the seed and the slot, the same every time', () => {
    const n = RANDOM_LOOK_POOL.length;
    const deck = rouletteDeck(9, 3, 0);
    expect([...deck].sort((x, y) => x - y)).toEqual(Array.from({ length: n }, (_, i) => i));
    expect(rouletteDeck(9, 3, 0)).toEqual(deck);
    expect(rouletteDeck(9, 4, 0)).not.toEqual(deck);
    expect(rouletteDeck(10, 3, 0)).not.toEqual(deck);
  });

  it('deals with no quick repeats, across the end of one deck and the start of the next', () => {
    for (const seed of [1, 2, 3, 99]) {
      const { dir, body } = director({}, seed);
      const p = body(5);
      const dealt: string[] = [];
      for (let i = 0; i < RANDOM_LOOK_POOL.length * 3; i++) dealt.push(dir.deal(p).look);
      for (let i = 0; i < dealt.length; i++) for (let j = i + 1; j < Math.min(dealt.length, i + NO_REPEAT + 1); j++) expect(dealt[j]).not.toBe(dealt[i]);
      // Every look once in each round of the roster.
      expect(new Set(dealt.slice(0, RANDOM_LOOK_POOL.length)).size).toBe(RANDOM_LOOK_POOL.length);
    }
  });

  it('the upcoming cards are what is dealt next (the client preloads them)', () => {
    const { dir, body } = director();
    const p = body(2);
    const next = dir.upcoming(p, 3);
    expect(next.length).toBe(3);
    expect([dir.deal(p).look, dir.deal(p).look, dir.deal(p).look]).toEqual(next);
  });

  it('in a match: a new character every life, from the deck, the same for the same seed, sent in the spawn event with the next cards', () => {
    const play = (seed: number) => {
      const { match, d, a } = roulette({}, seed);
      const seen: string[] = [];
      for (let life = 0; life < 5; life++) {
        const ev = d.run(3, () => d.input(a, {}));
        const sp = ev.find((e) => e.e === 'spawn' && e.s === a.slot);
        if (sp?.e === 'spawn') {
          seen.push(sp.l!);
          expect(sp.nx?.length).toBe(3);
        }
        expect(a.look).toBe(seen[seen.length - 1]);
        // Character stats on: the look's own size and health.
        expect(a.maxHealth).toBe(matchStats(a.look, match.rules).health);
        kill(match, a, null, 'core.fall');
      }
      return seen;
    };
    const one = play(5);
    expect(one.length).toBe(5);
    expect(new Set(one).size).toBe(5);
    expect(play(5)).toEqual(one);
    expect(play(6)).not.toEqual(one);
  });

  it('the roster: every look on the pool is a playable one (never retired, never an NPC skin)', () => {
    for (const id of RANDOM_LOOK_POOL) {
      expect(RETIRED_LOOKS[id]).toBeUndefined();
      expect(id.startsWith('npc:')).toBe(false);
    }
  });
});

describe('signature loadouts', () => {
  it('data: every character named is on the roster, every group has a fallback, every weapon is a carried one', () => {
    const roster = new Set(CORE_LOOKS.map((l) => l.id));
    for (const [look, w] of Object.entries(ROULETTE_DATA.characters)) {
      expect(roster.has(look), look).toBe(true);
      expect(getWeapon(w).slot).toBeGreaterThanOrEqual(1);
    }
    for (const g of ['soldiers', 'legends', 'folk', 'horror', 'animals', 'creatures']) expect((ROULETTE_DATA.groups as Record<string, string>)[g]).toBeTruthy();
  });

  it('the knight a spear, a soldier a rifle, an alien a ray gun; a look without its own takes its group’s', () => {
    expect(signatureOf('core.knight')).toBe('core.spear');
    expect(signatureOf('core.grunt68')).toBe('core.rifle');
    expect(signatureOf('core.visitor')).toBe('core.laser_rifle');
    // Every look on the roster has one, its own or its group's.
    for (const l of CORE_LOOKS) {
      const own = (ROULETTE_DATA.characters as Record<string, string>)[l.id];
      expect(signatureOf(l.id)).toBe(own ?? (ROULETTE_DATA.groups as Record<string, string>)[lookGroup(l.id)!]);
    }
  });

  it('as the weapon set allows: a signature outside it falls back to the set’s main gun; fixed weapons give none', () => {
    expect(signatureWeapon('core.knight', false, getWeaponSet('standard'))).toBe('core.spear');
    expect(signatureWeapon('core.knight', false, getWeaponSet('medieval'))).toBe('core.spear');
    // Military has no spears: its main gun (the assault rifle).
    expect(signatureWeapon('core.knight', false, getWeaponSet('military'))).toBe('core.rifle');
    expect(signatureWeapon('core.visitor', false, getWeaponSet('scifi'))).toBe('core.laser_rifle');
    expect(signatureWeapon('core.grunt68', false, getWeaponSet('scifi'))).toBe('core.plasma');
    expect(signatureWeapon('core.knight', false, null)).toBeNull();
    // A jackpot's better one (and it too as the set allows).
    expect(signatureWeapon('core.grunt68', true, getWeaponSet('standard'))).toBe('core.lmg');
    expect(signatureWeapon('core.grunt68', true, getWeaponSet('military'))).toBe('core.lmg');
    expect(signatureWeapon('core.visitor', true, getWeaponSet('military'))).toBe('core.rifle');
  });

  it('in a match: spawns holding it; off, the plain loadout', () => {
    const { match, d, a } = roulette();
    d.run(2);
    const held = a.weapons.get(a.current)!.def.id;
    expect(held).toBe(signatureWeapon(a.look, a.armor >= JACKPOT_ARMOR, match.weaponSet));
    const off = roulette({ rouletteSignature: false });
    off.d.run(2);
    expect([...off.a.weapons.values()].map((w) => w.def.id).sort()).toEqual(['core.knife', 'core.pistol']);
  });
});

describe('jackpot rolls', () => {
  it('odds as the data says: a jackpot about 1 in 20 lives, a tiny roll about 1 in 25, a pick card 15%', () => {
    let jackpots = 0;
    let tiny = 0;
    let cards = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const r = rouletteRoll(11, i % 64, 1 + Math.floor(i / 64));
      if (r === 'jackpot') jackpots++;
      if (r === 'tiny') tiny++;
      if (pickJackpot(11, i % 64, 1 + Math.floor(i / 64), i % 3)) cards++;
    }
    expect(jackpots / n).toBeGreaterThan(JACKPOT_ODDS * 0.8);
    expect(jackpots / n).toBeLessThan(JACKPOT_ODDS * 1.2);
    expect(tiny / n).toBeGreaterThan(TINY_ODDS * 0.8);
    expect(tiny / n).toBeLessThan(TINY_ODDS * 1.2);
    expect(cards / n).toBeGreaterThan(PICK_JACKPOT_ODDS * 0.85);
    expect(cards / n).toBeLessThan(PICK_JACKPOT_ODDS * 1.15);
    // Deterministic.
    expect(rouletteRoll(11, 3, 4)).toBe(rouletteRoll(11, 3, 4));
  });

  it('a jackpot life: armour, the better weapon, the glow, an announcer line; a tiny one a smaller, quicker body', () => {
    // Find a seed whose first life of slot 0 is a jackpot, and one whose is tiny.
    const seedFor = (want: 'jackpot' | 'tiny') => Array.from({ length: 4000 }, (_, i) => i).find((s) => rouletteRoll(s, 0, 1) === want)!;
    const j = roulette({}, seedFor('jackpot'));
    const ev = j.d.run(2);
    expect(j.a.armor).toBeGreaterThanOrEqual(JACKPOT_ARMOR);
    expect(ev.some((e) => e.e === 'rl' && e.a === 'jackpot' && e.s === j.a.slot)).toBe(true);
    expect(ev.find((e) => e.e === 'spawn' && e.s === j.a.slot)).toMatchObject({ j: 1 });
    expect(j.match.playerSnapshots().find((p) => p.s === j.a.slot)!.fx! & FX_JACKPOT).toBeTruthy();
    expect(j.a.weapons.get(j.a.current)!.def.id).toBe(signatureWeapon(j.a.look, true, j.match.weaponSet));
    const t = roulette({}, seedFor('tiny'));
    t.d.run(2);
    expect(t.a.size).toBeCloseTo(matchStats(t.a.look, t.match.rules).size * TINY_SIZE, 5);
    // Off: no rolls at all.
    const off = roulette({ rouletteJackpots: false }, seedFor('jackpot'));
    off.d.run(2);
    expect(off.a.armor).toBe(0);
  });

  it('Giant Slayer: a small character downing a large one scores a bonus point', () => {
    const { match, a, b } = roulette();
    a.look = 'core.sprout';
    b.look = 'core.knight';
    expect(bodyClass(a.look, match.rules)).toBe('small');
    expect(bodyClass(b.look, match.rules)).toBe('large');
    kill(match, b, a);
    expect(a.kills).toBe(2);
    expect(match.roulette!.stats(a.slot)!.giant).toBe(1);
    // The other way round it's just a kill.
    kill(match, a, b);
    expect(b.kills).toBe(1);
  });
});

describe('spawn protection', () => {
  it('a moment where other players’ hits do nothing; firing ends it; it runs out', () => {
    const { match, d, a, b } = roulette();
    d.run(1);
    expect(match.roulette!.protectedNow(a)).toBe(true);
    expect(match.playerSnapshots().find((p) => p.s === a.slot)!.fx! & FX_PROTECTED).toBeTruthy();
    const before = a.health;
    hurt(match, a, 30, b);
    expect(a.health).toBe(before);
    d.run(1, () => d.input(a, { buttons: BUTTON_FIRE }));
    expect(match.roulette!.protectedNow(a)).toBe(false);
    hurt(match, a, 30, b);
    expect(a.health).toBeLessThan(before);
    expect(match.roulette!.protectedNow(b)).toBe(true);
    d.run(2 * TICK_RATE + 2);
    expect(match.roulette!.protectedNow(b)).toBe(false);
  });
});

describe('streak pick', () => {
  it('3 kills in one life earn a pick of 3 at the next spawn: the chosen card plays; bad inputs are refused', () => {
    const { match, d, a, b } = roulette({ respawnDelayTicks: TICK_RATE * 2 });
    d.run(2);
    for (let i = 0; i < STREAK_PICK_KILLS; i++) {
      b.alive = true;
      kill(match, b, a);
    }
    expect(match.privateState(a.slot)!.rp!.pe).toBe(1);
    // A pick while alive does nothing.
    d.run(1, () => d.input(a, { say: ROULETTE_SAY_PICK + 2 }));
    expect(match.privateState(a.slot)!.rp!.o).toBeUndefined();
    kill(match, a, b);
    const rp = match.privateState(a.slot)!.rp!;
    expect(rp.o?.length).toBe(3);
    expect(new Set(rp.o).size).toBe(3);
    expect(rp.oc).toBe(-1);
    // Held for the choice (people get a few seconds).
    expect(a.respawnTick).toBeGreaterThan(match.tick + TICK_RATE * 2);
    // Out of range: refused.
    d.run(1, () => d.input(a, { say: ROULETTE_SAY_PICK + 3 }));
    expect(match.privateState(a.slot)!.rp!.oc).toBe(-1);
    d.run(1, () => d.input(a, { say: ROULETTE_SAY_PICK + 2 }));
    expect(match.privateState(a.slot)!.rp!.oc).toBe(2);
    // A second choice is refused.
    d.run(1, () => d.input(a, { say: ROULETTE_SAY_PICK }));
    expect(match.privateState(a.slot)!.rp!.oc).toBe(2);
    // Chosen: back to the usual respawn time, as the chosen card.
    const ev = d.run(TICK_RATE * 3);
    expect(a.alive).toBe(true);
    expect(ev.find((e) => e.e === 'spawn' && e.s === a.slot)).toMatchObject({ l: rp.o![2] });
    expect(match.roulette!.stats(a.slot)!.picks).toBe(1);
  });

  it('off: no pick; a pick not chosen plays the first card; bots choose at once, the jackpot card first', () => {
    const off = roulette({ rouletteStreakPick: false });
    off.d.run(2);
    for (let i = 0; i < 3; i++) kill(off.match, off.b, off.a);
    kill(off.match, off.a, off.b);
    expect(off.match.privateState(off.a.slot)!.rp!.o).toBeUndefined();
    const { match, d, a, b } = roulette();
    d.run(2);
    for (let i = 0; i < 3; i++) kill(match, b, a);
    kill(match, a, b);
    const cards = match.privateState(a.slot)!.rp!.o!;
    const ev = d.run(TICK_RATE * 7);
    expect(ev.find((e) => e.e === 'spawn' && e.s === a.slot)).toMatchObject({ l: cards[0] });
  });
});

describe('variants', () => {
  it('Earned rerolls: a token per 2 kills, 2 at most, spent while down for a new next card; never free', () => {
    const { match, d, a, b } = roulette({ rouletteRerolls: true, rouletteStreakPick: false, respawnDelayTicks: TICK_RATE * 2 });
    d.run(2);
    // None yet: a reroll does nothing.
    kill(match, a, b);
    const first = match.privateState(a.slot)!.rp!.n;
    d.run(1, () => d.input(a, { say: ROULETTE_SAY_REROLL }));
    expect(match.privateState(a.slot)!.rp!.n).toBe(first);
    d.run(TICK_RATE * 3);
    for (let i = 0; i < 6; i++) kill(match, b, a);
    expect(match.privateState(a.slot)!.rp!.t).toBe(REROLL_MAX);
    kill(match, a, b);
    const next = match.privateState(a.slot)!.rp!.n;
    d.run(1, () => d.input(a, { say: ROULETTE_SAY_REROLL }));
    const rp = match.privateState(a.slot)!.rp!;
    expect(rp.t).toBe(REROLL_MAX - 1);
    expect(rp.n).not.toBe(next);
    // Off: tokens never come.
    const off = roulette();
    for (let i = 0; i < 6; i++) kill(off.match, off.b, off.a);
    expect(off.match.privateState(off.a.slot)!.rp!.t).toBeUndefined();
  });

  it('Swap on kill: the killer becomes the victim’s character at once, keeping its share of health and its weapons', () => {
    const { match, d, a, b } = roulette({ rouletteSwapOnKill: true });
    d.run(2);
    a.look = 'core.ranger';
    b.look = 'core.knight';
    a.health = a.maxHealth / 2;
    const weapons = [...a.weapons.keys()];
    const ev: GameEvent[] = [];
    kill(match, b, a);
    ev.push(...match.step());
    expect(a.look).toBe('core.knight');
    expect(a.maxHealth).toBe(matchStats('core.knight', match.rules).health);
    expect(a.health).toBe(Math.round(a.maxHealth / 2));
    expect([...a.weapons.keys()]).toEqual(weapons);
    expect(ev.some((e) => e.e === 'rl' && e.a === 'swap' && e.s === a.slot && e.l === 'core.knight')).toBe(true);
  });

  it('Variety bonus: a point for a kill as each new character after the first', () => {
    const { match, a, b } = roulette({ rouletteVariety: true, rouletteJackpots: false });
    a.look = 'core.ranger';
    kill(match, b, a);
    kill(match, b, a);
    expect(a.kills).toBe(2);
    a.look = 'core.dapper';
    kill(match, b, a);
    expect(a.kills).toBe(4);
  });

  it('Lunar: a bonus for an air kill, and a gravity storm every minute after a 3-second warning', () => {
    const { match, d, a, b } = roulette({ lunar: true, gravity: 0.4, rouletteJackpots: false });
    d.run(2);
    a.move = { ...a.move, grounded: false };
    kill(match, b, a);
    expect(a.kills).toBe(2);
    expect(match.roulette!.stats(a.slot)!.air).toBe(1);
    // The storm: calm, the warning, then the gravity shifts, then back.
    const ev = d.run(TICK_RATE * (60 - 2));
    const warn = ev.find((e) => e.e === 'rl' && e.a === 'storm' && e.n === 1);
    expect(warn).toBeTruthy();
    expect(match.phys.gravity).toBe(0.4);
    const blow = d.run(STORM_WARN_SECONDS * TICK_RATE + 1).find((e) => e.e === 'rl' && e.a === 'storm' && e.n === 2);
    expect(blow).toBeTruthy();
    expect(match.phys.gravity).not.toBe(0.4);
    expect(match.snapshot([]).rl![0]).toBe(2);
    d.run(STORM_SECONDS * TICK_RATE + 1);
    expect(match.phys.gravity).toBe(0.4);
    // Without Lunar: no storm.
    const plain = roulette();
    expect(plain.d.run(TICK_RATE * 64).some((e) => e.e === 'rl' && e.a === 'storm')).toBe(false);
  });

  it('Teams (the setup): Team Deathmatch with Roulette on, the players split in two, team outlines; the chips write the settings', () => {
    const map = yard();
    const base: MatchSetup = { map: 'test_map', mode: 'core.roulette', bots: 9, skill: 'normal', scoreLimit: 20, minutes: 10 };
    expect(playableModes(map)).toContain('core.roulette');
    const plain = rulesFromSetup(base, map);
    expect(plain.rules).toMatchObject({ mode: 'core.roulette', characterStats: true });
    expect(plain.rules.rouletteSignature).toBeUndefined();
    const teams = rulesFromSetup(setVariant(base, 'rlteams', true), map);
    expect(teams.rules).toMatchObject({ mode: 'core.tdm', roulette: true, teamOutlines: true, teamSizes: [5, 5] });
    expect(teams.fill).toBe(10);
    const off = setVariant(setVariant(setVariant(base, 'signature', false), 'jackpots', false), 'streakpick', false);
    expect(off).toMatchObject({ rlSignature: false, rlJackpots: false, rlPick: false });
    expect(rulesFromSetup(off, map).rules).toMatchObject({ rouletteSignature: false, rouletteJackpots: false, rouletteStreakPick: false });
    expect(setVariant(off, 'signature', true).rlSignature).toBeUndefined();
    const on = setVariant(setVariant(setVariant(base, 'rerolls', true), 'swap', true), 'variety', true);
    expect(rulesFromSetup(on, map).rules).toMatchObject({ rouletteRerolls: true, rouletteSwapOnKill: true, rouletteVariety: true });
    expect(rulesFromSetup(setVariant(base, 'lunar', true), map).rules).toMatchObject({ gravity: 0.4, fallDamage: false, lunar: true });
    // In a match: two sides, each player dealt from the deck.
    const m = new Match(map, { ...teams.rules, respawnDelayTicks: 1 }, 4);
    const x = m.addHuman('x', 'core.sprout')!;
    m.step();
    expect(x.faction).not.toBeNull();
    expect(m.roulette).not.toBeNull();
  });
});

describe('awards', () => {
  it('Shapeshifter, Giant Slayer, Moonwalker (with Lunar), Unluckiest Roll; at the end of the match', () => {
    const { dir, body, advance } = director({ lunar: true });
    const a = body(0);
    const b = body(1);
    const c = body(2);
    for (const p of [a, b, c]) p.look = dir.deal(p).look;
    advance(TICK_RATE * 10);
    // a: small kills large (Giant Slayer), in the air (Moonwalker).
    a.look = 'core.sprout';
    b.look = 'core.knight';
    a.move.grounded = false;
    dir.onKill(b, a, true);
    b.look = dir.deal(b).look;
    advance(3);
    // b dies 3 ticks into its life: the unluckiest.
    dir.onKill(b, c, true);
    for (let i = 0; i < 4; i++) c.look = dir.deal(c).look;
    const aw = dir.awards([a, b, c]);
    expect(aw.find((x) => x[0] === 'shapeshifter')?.[1]).toBe(2);
    expect(aw.find((x) => x[0] === 'giantslayer')).toEqual(['giantslayer', 0, 1]);
    expect(aw.find((x) => x[0] === 'moonwalker')).toEqual(['moonwalker', 0, 1]);
    const unlucky = aw.find((x) => x[0] === 'unlucky')!;
    expect(unlucky[1]).toBe(1);
    expect(awardText(unlucky, (s) => `p${s}`).line).toMatch(/^p1 as .+: down in 0\.\d s$/);
    // Without Lunar: no Moonwalker.
    const plain = director();
    expect(plain.dir.awards([plain.body(0)]).some((x) => x[0] === 'moonwalker')).toBe(false);
  });

  it('in a match: the awards go out with the round’s end', () => {
    const { match, d, a, b } = roulette({ scoreLimit: 3 });
    d.run(2);
    a.look = 'core.sprout';
    for (let i = 0; i < 3; i++) {
      b.alive = true;
      b.look = 'core.ranger';
      kill(match, b, a);
    }
    const ev = d.run(1);
    const awards = ev.find((e) => e.e === 'rl' && e.a === 'awards');
    expect(awards?.e === 'rl' && awards.aw?.length).toBeTruthy();
    expect(ev.some((e) => e.e === 'round_end')).toBe(true);
    expect(getLook(b.look)).toBeTruthy();
    expect(weaponCode(getWeapon('core.pistol'))).toBeGreaterThan(0);
  });
});
