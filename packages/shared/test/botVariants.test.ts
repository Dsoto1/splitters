import { beforeAll, describe, expect, it } from 'vitest';
import { CORE_LOOKS, DEFAULT_RULES, PICKABLE_LOOKS, botVariantPick, castVariants, initPhysics, lookBase, lookVariants, matchStats, type MapDocument } from '../src/index.ts';
import { BotFiller, HostControl, Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

// Random variants for bots (owner, 2026-11-27): a random bot dealt a character with variant looks wears one of that
// character's looks at random, the base included; a character counts once; seeded by the match seed and the slot;
// seed 1 keeps the base.

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const yard = (cast?: string[]): MapDocument => {
  const tiles = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 4], [50, 0, 4], [10, 0, 10], [40, 0, 10]]);
  return cast ? { ...map, botCast: cast } : map;
};
const botsOf = (m: Match): Combatant[] => m.combatants().filter((c) => c.kind === 'bot');
const BASES = PICKABLE_LOOKS.map((l) => l.id);
const WITH_VARIANTS = BASES.filter((id) => lookVariants(CORE_LOOKS, id).length > 1);

function filled(seed: number, bots: number, cast?: string[]): Match {
  const half = Math.ceil((bots + 1) / 2);
  const match = new Match(yard(cast), { ...DEFAULT_RULES['core.tdm'], teamSizes: [half, half] }, seed);
  new BotFiller(match).join('Host', 'core.dale', bots + 1);
  return match;
}

describe('random bots wear variant looks', () => {
  it('the roster has characters with variants (Ziggy, Dog Tag Doyle)', () => {
    expect(WITH_VARIANTS).toContain('core.chimp');
    expect(WITH_VARIANTS).toContain('core.undeadsoldier');
    expect(lookBase('core.chimp_cowboy')).toBe('core.chimp');
    expect(lookBase('core.chimp')).toBe('core.chimp');
    expect(lookBase('core.dale')).toBe('core.dale');
  });

  it('a character’s pool is its looks, the base first, a look to unlock (Patchwork Polly) included', () => {
    const ziggy = castVariants([], 'core.chimp').map((l) => l.id);
    expect(ziggy[0]).toBe('core.chimp');
    expect(ziggy).toContain('core.chimp_cowboy');
    expect(ziggy.length).toBe(lookVariants(CORE_LOOKS, 'core.chimp').length);
    expect(castVariants([], 'core.teddy').map((l) => l.id)).toContain('core.ragdoll');
    expect(castVariants([], 'core.dale').map((l) => l.id)).toEqual(['core.dale']);
  });

  it('seed 1 (tests, ?test=1) keeps the base look', () => {
    for (let slot = 0; slot < 40; slot++) expect(botVariantPick(castVariants([], 'core.chimp'), 1, slot)).toBe('core.chimp');
    for (const c of botsOf(filled(1, 60))) expect(BASES).toContain(c.look);
  });

  it('the pick is the same for the same seed and slot (host and dedicated host agree), and varies across them', () => {
    const pool = castVariants([], 'core.chimp');
    const seen = new Set<string>();
    for (let seed = 2; seed < 200; seed++) {
      for (let slot = 0; slot < 8; slot++) {
        const a = botVariantPick(pool, seed, slot);
        expect(botVariantPick(pool, seed, slot)).toBe(a);
        seen.add(a!);
      }
    }
    expect(seen.size).toBe(pool.length);
    // Whole matches: the same seed, the same looks on the same slots.
    const looks = (seed: number) => botsOf(filled(seed, 30)).map((c) => `${c.slot}:${c.look}`);
    expect(looks(4242)).toEqual(looks(4242));
  });

  it('each of a character’s looks is about as likely, the base included', () => {
    const pool = castVariants([], 'core.chimp');
    const counts = new Map<string, number>();
    const n = 20_000;
    for (let i = 0; i < n; i++) {
      const id = botVariantPick(pool, 2 + (i >> 4), i & 15)!;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const even = n / pool.length;
    for (const l of pool) expect(Math.abs((counts.get(l.id) ?? 0) - even) / even).toBeLessThan(0.15);
  });

  it('variants appear in matches; a character counts once (no likelier for its many looks), one bot each', () => {
    const byBase = new Map<string, number>();
    let variants = 0;
    let bots = 0;
    for (let seed = 2; seed < 80; seed++) {
      const list = botsOf(filled(seed * 7919, 12));
      // One bot a character while the pool lasts: two Ziggys in different looks never.
      expect(new Set(list.map((c) => lookBase(c.look))).size).toBe(list.length);
      for (const c of list) {
        const base = lookBase(c.look);
        expect(BASES).toContain(base);
        if (base !== c.look) variants++;
        byBase.set(base, (byBase.get(base) ?? 0) + 1);
        bots++;
      }
    }
    expect(variants).toBeGreaterThan(5);
    // Ziggy (11 looks) turns up about as often as any one character: 12 of BASES.length per match.
    const fair = bots / BASES.length;
    expect(byBase.get('core.chimp') ?? 0).toBeLessThan(fair * 3);
  });

  it('60 bots wear 60 different characters', () => {
    const list = botsOf(filled(31_337, 60));
    expect(new Set(list.map((c) => lookBase(c.look))).size).toBe(60);
    expect(list.some((c) => lookBase(c.look) !== c.look)).toBe(true);
  });

  it('names and body sizes follow the variant worn', () => {
    let checked = 0;
    for (let seed = 2; seed < 60 && checked < 6; seed++) {
      const match = filled(seed * 104_729, 40);
      for (const c of botsOf(match)) {
        if (lookBase(c.look) === c.look) continue;
        const look = CORE_LOOKS.find((l) => l.id === c.look)!;
        expect(c.name).toBe(look.name);
        expect(c.size).toBe(matchStats(c.look, match.rules).size);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(6);
  });

  it('a recast keeps bots in a variant of an allowed character', () => {
    // Find a match with a variant bot of an Animalia or Machines character, then allow just those groups.
    for (let seed = 2; seed < 400; seed++) {
      const match = filled(seed * 31, 20);
      const v = botsOf(match).find((c) => c.look !== lookBase(c.look) && ['animals', 'machines'].includes(CORE_LOOKS.find((l) => l.id === c.look)!.group!));
      if (!v) continue;
      const before = { look: v.look, name: v.name };
      const control = new HostControl(match, new BotFiller(match), 21);
      control.apply({ c: 'bots', cast: ['animals', 'machines'] });
      expect({ look: v.look, name: v.name }).toEqual(before);
      for (const c of botsOf(match)) expect(['animals', 'machines']).toContain(CORE_LOOKS.find((l) => l.id === c.look)!.group);
      // And a recast to the same setting changes nobody.
      expect(match.recastBots(() => 'x')).toBe(0);
      return;
    }
    throw new Error('no match with an Animalia or Machines variant bot');
  });
});
