import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RULES, PICKABLE_LOOKS, botLookOrder, castLooks, initPhysics, lookBase, lookTheme, validateBotSet, type MapDocument } from '../src/index.ts';
import { BotFiller, HostControl, Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

// Random bots' looks (owner, 2026-11-16: "make sure they are indeed random and not the first 60+ in the list; I would
// like more variety"): each match deals its own shuffle of the allowed looks, from the match seed.

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const yard = (cast?: string[]): MapDocument => {
  const tiles = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 4], [50, 0, 4], [10, 0, 10], [40, 0, 10]]);
  return cast ? { ...map, botCast: cast } : map;
};
const botsOf = (m: Match): Combatant[] => m.combatants().filter((c) => c.kind === 'bot');
const ROSTER = PICKABLE_LOOKS.map((l) => l.id);

function filled(seed: number, bots: number, cast?: string[]): Match {
  const half = Math.ceil((bots + 1) / 2);
  const match = new Match(yard(cast), { ...DEFAULT_RULES['core.tdm'], teamSizes: [half, half] }, seed);
  new BotFiller(match).join('Host', 'core.dale', bots + 1);
  return match;
}

describe('random bots: a per-match deal of looks', () => {
  it('the deal is a shuffle of the whole pool, the same for the same seed', () => {
    const a = botLookOrder(PICKABLE_LOOKS, 4242);
    expect([...a].sort()).toEqual([...ROSTER].sort());
    expect(botLookOrder(PICKABLE_LOOKS, 4242)).toEqual(a);
    expect(a).not.toEqual(botLookOrder(PICKABLE_LOOKS, 4243));
    expect(a.slice(0, 20)).not.toEqual(ROSTER.slice(1, 21));
  });

  it('two seeds give different casts; the same seed the same cast (host and dedicated host agree)', () => {
    const cast = (seed: number) => botsOf(filled(seed, 20)).map((c) => c.look);
    expect(cast(901)).toEqual(cast(901));
    expect(cast(901)).not.toEqual(cast(77_123));
    const shared = cast(901).filter((l) => cast(77_123).includes(l)).length;
    expect(shared).toBeLessThan(15);
  });

  it(`60 bots in one match wear 60 different looks (the core roster has ${ROSTER.length})`, () => {
    expect(ROSTER.length).toBeGreaterThanOrEqual(60);
    const list = botsOf(filled(31_337, 60));
    expect(list).toHaveLength(60);
    expect(new Set(list.map((c) => lookBase(c.look))).size).toBe(60);
    // Each a character of the roster (a bot may wear one of its variant looks: botVariants.test.ts).
    for (const c of list) expect(ROSTER).toContain(lookBase(c.look));
  });

  it('the spread covers the roster, not one end of it', () => {
    // Over many matches of 12 bots, looks come from every part of the roster, and no part takes most of them.
    const quarter = Math.ceil(ROSTER.length / 4);
    const parts = [0, 0, 0, 0];
    const seen = new Set<string>();
    for (let seed = 2; seed < 42; seed++) {
      for (const c of botsOf(filled(seed * 7919, 12))) {
        parts[Math.floor(ROSTER.indexOf(lookBase(c.look)) / quarter)]!++;
        seen.add(lookBase(c.look));
      }
    }
    const total = parts.reduce((a, b) => a + b, 0);
    for (const p of parts) expect(p / total).toBeGreaterThan(0.12);
    for (const p of parts) expect(p / total).toBeLessThan(0.4);
    expect(seen.size).toBeGreaterThan(ROSTER.length * 0.9);
    // One match too: its 12 bots are not the first 12 of the roster.
    const one = botsOf(filled(555, 12)).map((c) => ROSTER.indexOf(lookBase(c.look)));
    expect(Math.max(...one)).toBeGreaterThan(24);
  });

  it('names follow the look; a bot set keeps its hand picks; each random bot still a different look', () => {
    const set = validateBotSet({ name: 'Cast', entries: [{ name: 'Sir Clank', look: 'core.knight' }, { name: 'Zorp', look: 'core.visitor' }] })!.set;
    const match = new Match(yard(), { ...DEFAULT_RULES['core.deathmatch'] }, 2024);
    new BotFiller(match, undefined, { botSet: set }).rebalance(16);
    const list = botsOf(match);
    expect(list.find((c) => c.name === 'Sir Clank')?.look).toBe('core.knight');
    expect(list.find((c) => c.name === 'Zorp')?.look).toBe('core.visitor');
    expect(new Set(list.map((c) => c.look)).size).toBe(list.length);
  });

  it('a recast stays within the allowed categories, each bot a different look while the pool lasts', () => {
    const match = filled(8_675_309, 12);
    const control = new HostControl(match, new BotFiller(match), 13);
    control.apply({ c: 'bots', cast: ['legends', 'machines'] });
    const pool = castLooks(['legends', 'machines']).map((l) => l.id);
    const list = botsOf(match);
    for (const c of list) expect(pool).toContain(lookBase(c.look));
    expect(new Set(list.map((c) => lookBase(c.look))).size).toBe(Math.min(list.length, pool.length));
    control.apply({ c: 'bots', cast: ['soldiers'] });
    const soldiers = castLooks(['soldiers']).map((l) => l.id);
    for (const c of botsOf(match)) expect(soldiers).toContain(lookBase(c.look));
    expect(new Set(botsOf(match).map((c) => lookBase(c.look))).size).toBe(Math.min(list.length, soldiers.length));
  });
});
